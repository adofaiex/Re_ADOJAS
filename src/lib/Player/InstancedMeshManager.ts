import { Vector3, Euler, Color, InstancedMesh, Object3D, Scene, BufferGeometry, ShaderMaterial, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, Matrix4, Texture, Material, DataTexture, RGBAFormat, UnsignedByteType, PlaneGeometry } from 'three';

import instancedVert from '../shaders/instanced.vert'
import instancedFrag from '../shaders/instanced.frag'

/** 1x1 全透明贴图：辉光贴图未加载时占位，避免 sampler 绑定为 null。 */
function makeEmptyTexture(): DataTexture {
    const tex = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, RGBAFormat, UnsignedByteType);
    tex.needsUpdate = true;
    return tex;
}

// ── 砖块辉度（topGlow）叠加层着色器：单位正方形 + 每实例 alpha ──
const GLOW_VERT = `
attribute float iGlow;
varying vec2 vUv;
varying float vGlow;
void main() {
    vUv = uv;
    vGlow = iGlow;
    vec4 p = vec4( position, 1.0 );
    #ifdef USE_INSTANCING
        p = instanceMatrix * p;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * p;
}
`;

const GLOW_FRAG = `
uniform sampler2D uGlowTexture;
varying vec2 vUv;
varying float vGlow;
void main() {
    vec4 c = texture2D( uGlowTexture, vUv );
    float a = c.a * vGlow;
    if ( a < 0.003 ) discard;
    gl_FragColor = vec4( c.rgb, a );
    #include <colorspace_fragment>
}
`;

/** 辉光直径 = 砖块长度 × 该系数（官方 topGlow sprite 比砖大 1.28 倍）。 */
const GLOW_SCALE = 1.28;
/** 辉光四边形相对砖面的 z 偏移。砖的层级步进约 2e-4、深度分辨率约 6e-5，
 *  取 1.5e-4：既高于自身砖面（不 z-fighting），又低于相邻砖层（不会盖住前面的砖）。 */
const GLOW_Z_OFFSET = 0.00015;

/** setInstanceMatrix 用的临时矩阵，避免每帧分配。 */
const _tmpGlowMatrix = new Matrix4();

/**
 * Instance data for a single tile
 */
interface TileInstance {
    index: number;
    shapeKey: string;
    position: Vector3;
    rotation: Euler;
    scale: Vector3;
    color: Color;
    bgColor: Color;
    opacity: number;
    texSeed: number;
    visible: boolean;
    /** 砖块辉度层 alpha（topGlow，玩家经过后点亮）。0 = 不发光。 */
    glow: number;
    /** Depth layer offset (world z) assigned in real time from tile id for visible
     *  tiles. Kept separate from `position` so external position writers (MoveTrack,
     *  PositionTrack sync) never wipe it. Higher layerZ = closer to camera = on top. */
    layerZ: number;
}

/**
 * Instanced mesh data for a specific shape
 */
interface ShapeInstancedMesh {
    shapeKey: string;
    instancedMesh: InstancedMesh;
    dummy: Object3D;
    instances: Map<number, number>; // tileIndex -> instanceIndex
    tileIdsByPosition: number[]; // reverse lookup: bufferPosition -> tileIndex (avoids rebuilding Map on every insert)
    maxInstances: number;
    instanceCount: number;
    minTileIndex: number; // lowest tile ID in this mesh → highest render priority
    /** 砖块辉度（topGlow）叠加层：单位正方形，实例索引与 instancedMesh 一一对应。 */
    glowMesh: InstancedMesh;
    /** 局部变换：平移到砖几何中心 + 缩放到辉光直径（放在实例矩阵右侧）。 */
    glowLocal: Matrix4;
}

/**
 * Manager for GPU instanced mesh rendering
 * Optimizes performance by rendering many tiles with the same geometry in a single draw call
 */
export class InstancedMeshManager {
    private scene: Scene;
    private geometryCache: Map<string, BufferGeometry>;
    private instancedMeshes: Map<string, ShapeInstancedMesh>;
    private tileInstances: Map<number, TileInstance>;
    private onGeometryNeeded: (shapeKey: string) => BufferGeometry | null;
    private maxCacheSize: number = 100;
    private useInstancedMesh: boolean = true;
    private tileTexture: Texture | null = null;
    private texScale: number = 0.3;
    private iconAtlasTexture: Texture | null = null;
    private iconAtlasCols: number = 8;
    private iconSize: number = 0.44;
    /** 砖块辉度贴图（floor-top-glow.png）。默认 1x1 全透明，加载后替换。 */
    private glowTexture: Texture = makeEmptyTexture();

    /**
     * Set the tile texture overlay and tiling scale
     */
    public setTileTexture(texture: Texture | null, scale: number = 0.3): void {
        this.tileTexture = texture;
        this.texScale = scale;
        // Update uniform on all existing instanced meshes
        for (const shapeData of this.instancedMeshes.values()) {
            const mat = shapeData.instancedMesh.material as ShaderMaterial;
            if (mat.uniforms) {
                mat.uniforms.uTileTexture.value = texture;
                mat.uniforms.uTexScale.value = scale;
            }
        }
    }

    /**
     * Enable or disable the tile texture overlay for ALL tiles at once.
     * When disabled, the fragment shader skips texture sampling entirely.
     *
     * @param enabled  true = textures on, false = textures off
     * @param clearSeed  also zero out per-instance texSeed attributes
     *   (only needed on explicit user toggle; auto zoom-disable should keep seeds intact)
     */
    public setTileTextureEnabled(enabled: boolean, clearSeed: boolean = false): void {
        const value = enabled ? 0.0 : 1.0;
        for (const shapeData of this.instancedMeshes.values()) {
            const mat = shapeData.instancedMesh.material as ShaderMaterial;
            if (mat.uniforms) {
                mat.uniforms.uDisableTexture.value = value;
            }

            if (!enabled && clearSeed) {
                const attr = shapeData.instancedMesh.geometry.getAttribute('iTexSeed') as InstancedBufferAttribute;
                if (attr) {
                    for (const [tileIdx, instIdx] of shapeData.instances) {
                        attr.array[instIdx] = 0;
                        const inst = this.tileInstances.get(tileIdx);
                        if (inst) inst.texSeed = 0;
                    }
                    attr.needsUpdate = true;
                }
            }
        }
    }

    constructor(
        scene: Scene,
        onGeometryNeeded: (shapeKey: string) => BufferGeometry | null,
        useInstancedMesh: boolean = true
    ) {
        this.scene = scene;
        this.geometryCache = new Map();
        this.instancedMeshes = new Map();
        this.tileInstances = new Map();
        this.onGeometryNeeded = onGeometryNeeded;
        this.useInstancedMesh = useInstancedMesh;
    }

    /**
     * Initialize an instanced mesh for a specific shape
     */
    private createInstancedMesh(shapeKey: string, maxInstances: number): ShapeInstancedMesh | undefined {
        const geometry = this.onGeometryNeeded(shapeKey);
        if (!geometry) return undefined;

        // Create a basic shader material that supports instance colors
        const material = new ShaderMaterial({
            uniforms: {
                uTileTexture: { value: this.tileTexture },
                uTexScale: { value: this.texScale },
                uIconAtlas: { value: this.iconAtlasTexture },
                uIconAtlasCols: { value: this.iconAtlasCols },
                uIconSize: { value: this.iconSize },
                uDisableTexture: { value: 0.0 }
            },
            vertexShader: instancedVert,
            fragmentShader: instancedFrag,
            vertexColors: true,
            side: DoubleSide,
            transparent: true,
            depthTest: true,
            // depthWrite=true + Z-ordering handles cross-shape tile ordering.
            // Transparent fragments are discarded in shader (alpha < 0.005) so they
            // don't write depth and occlude tiles behind them.
            depthWrite: true
        });

        // 辉光（topGlow）局部变换：平移到砖几何中心 + 缩放到直径 = 砖块长度 × 1.28。
        // 正圆、可超出砖宽（独立四边形，不受砖几何裁剪）。放在实例矩阵右侧，
        // 于是随砖的位置/旋转/缩放/隐藏（scale=0）一起变换。
        geometry.computeBoundingBox();
        const bb = geometry.boundingBox;
        const cx = bb ? (bb.min.x + bb.max.x) * 0.5 : 0;
        const cy = bb ? (bb.min.y + bb.max.y) * 0.5 : 0;
        const tileLength = (geometry.userData && geometry.userData.tileLength)
            ? geometry.userData.tileLength
            : (bb ? Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y) : 1);
        const glowSize = tileLength * GLOW_SCALE;
        const glowLocal = new Matrix4()
            .makeTranslation(cx, cy, GLOW_Z_OFFSET)
            .multiply(new Matrix4().makeScale(glowSize, glowSize, 1));

        const instancedMesh = new InstancedMesh(geometry, material, maxInstances);
        instancedMesh.instanceMatrix.setUsage(DynamicDrawUsage);
        instancedMesh.renderOrder = 0; // Standard tile level
        instancedMesh.frustumCulled = false; // Prevent tiles from disappearing when camera moves
        instancedMesh.count = 0; // Start with 0 visible instances

        // Create instance color attributes
        const iColor = new InstancedBufferAttribute(
            new Float32Array(maxInstances * 3),
            3
        );
        const iBgColor = new InstancedBufferAttribute(
            new Float32Array(maxInstances * 3),
            3
        );
        const iOpacity = new InstancedBufferAttribute(
            new Float32Array(maxInstances),
            1
        );
        const iTexSeed = new InstancedBufferAttribute(
            new Float32Array(maxInstances),
            1
        );
        const iFloorIconType = new InstancedBufferAttribute(
            new Float32Array(maxInstances),
            1
        );
        const iFloorIconAngle = new InstancedBufferAttribute(
            new Float32Array(maxInstances),
            1
        );

        instancedMesh.geometry.setAttribute('iColor', iColor);
        instancedMesh.geometry.setAttribute('iBgColor', iBgColor);
        instancedMesh.geometry.setAttribute('iOpacity', iOpacity);
        instancedMesh.geometry.setAttribute('iTexSeed', iTexSeed);
        instancedMesh.geometry.setAttribute('iFloorIconType', iFloorIconType);
        instancedMesh.geometry.setAttribute('iFloorIconAngle', iFloorIconAngle);

        instancedMesh.instanceMatrix.needsUpdate = true;

        const dummy = new Object3D();
        // 辉光叠加层：单位正方形，实例索引与 instancedMesh 一一对应。
        const glowMesh = this.createGlowMesh(maxInstances);

        const shapeData: ShapeInstancedMesh = {
            shapeKey,
            instancedMesh,
            dummy,
            instances: new Map(),
            tileIdsByPosition: [],
            maxInstances,
            instanceCount: 0,
            minTileIndex: Infinity, // will be set when first tile is added
            glowMesh,
            glowLocal
        };

        this.scene.add(instancedMesh);
        this.scene.add(glowMesh);
        this.instancedMeshes.set(shapeKey, shapeData);

        return shapeData;
    }

    /** 创建砖块辉度叠加层（单位正方形 + 每实例 alpha）。 */
    private createGlowMesh(capacity: number): InstancedMesh {
        const geo = new PlaneGeometry(1, 1);
        const iGlow = new InstancedBufferAttribute(new Float32Array(capacity), 1);
        iGlow.setUsage(DynamicDrawUsage);
        geo.setAttribute('iGlow', iGlow);

        const material = new ShaderMaterial({
            uniforms: { uGlowTexture: { value: this.glowTexture } },
            vertexShader: GLOW_VERT,
            fragmentShader: GLOW_FRAG,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            side: DoubleSide,
        });

        const mesh = new InstancedMesh(geo, material, capacity);
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.renderOrder = 1; // 在所有砖（renderOrder<=0）之后
        mesh.count = 0;
        return mesh;
    }

    /** 写入砖实例矩阵，并同步其辉光叠加层的矩阵。 */
    private setInstanceMatrix(s: ShapeInstancedMesh, i: number, tileMatrix: Matrix4): void {
        s.instancedMesh.setMatrixAt(i, tileMatrix);
        s.instancedMesh.instanceMatrix.needsUpdate = true;
        const glowMat = _tmpGlowMatrix.multiplyMatrices(tileMatrix, s.glowLocal);
        s.glowMesh.setMatrixAt(i, glowMat);
        s.glowMesh.instanceMatrix.needsUpdate = true;
    }

    /**
     * Update or add a tile instance
     */
    public updateTile(
        tileIndex: number,
        shapeKey: string,
        position: Vector3,
        rotation: Euler,
        scale: Vector3,
        color: string,
        bgColor: string,
        opacity: number = 1,
        visible: boolean = true,
        texSeed: number = 0,
        floorIconType: number = 0,
        floorIconAngle: number = 0,
        glow: number = 0
    ): void {
        if (!this.useInstancedMesh) return;

        // Check if tile already exists and if its shape has changed
        const existingInstance = this.tileInstances.get(tileIndex);
        if (existingInstance && existingInstance.shapeKey !== shapeKey) {
            // Remove from old shape instanced mesh
            const oldShapeData = this.instancedMeshes.get(existingInstance.shapeKey);
            if (oldShapeData) {
                const oldInstanceIndex = oldShapeData.instances.get(tileIndex);
                if (oldInstanceIndex !== undefined) {
                    // Hide in old mesh
                    oldShapeData.instancedMesh.geometry.attributes.iOpacity!.setX(oldInstanceIndex, 0);
                    oldShapeData.instancedMesh.geometry.attributes.iOpacity!.needsUpdate = true;
                    oldShapeData.instances.delete(tileIndex);
                }
            }
        }

        // Store instance data (preserve an existing depth layer across updates)
        const instance: TileInstance = {
            index: tileIndex,
            shapeKey,
            position: position.clone(),
            rotation: rotation.clone() as Euler,
            scale: scale.clone(),
            color: new Color(color),
            bgColor: new Color(bgColor),
            opacity,
            texSeed,
            visible,
            glow: this.tileInstances.get(tileIndex)?.glow ?? glow,
            layerZ: this.tileInstances.get(tileIndex)?.layerZ ?? 0
        };
        if (glow > 0) instance.glow = glow;

        this.tileInstances.set(tileIndex, instance);

        // Get or create instanced mesh for this shape
        let shapeData = this.instancedMeshes.get(shapeKey);
        if (!shapeData) {
            // Start with 100 instances, will grow if needed
            shapeData = this.createInstancedMesh(shapeKey, 100);
            if (!shapeData) return;
        }

        // Check if we need more instances
        let instanceIndex = shapeData.instances.get(tileIndex);
        if (instanceIndex === undefined) {
            if (shapeData.instanceCount >= shapeData.maxInstances) {
                this.expandInstancedMesh(shapeData);
            }

            const { instancedMesh } = shapeData;
            const count = shapeData.instanceCount;
            const idsByPos = shapeData.tileIdsByPosition;

            // Find insertion position to maintain DESCENDING tile ID order using binary search
            // tileIdsByPosition is sorted descending: [highestId, ..., lowestId]
            // New tile with higher ID goes earlier (lower index)
            let insertAt = count;
            if (count > 0) {
                let lo = 0, hi = count;
                while (lo < hi) {
                    const mid = (lo + hi) >>> 1;
                    if (idsByPos[mid] < tileIndex) {
                        hi = mid;
                    } else {
                        lo = mid + 1;
                    }
                }
                insertAt = lo;
            }

            // Shift instances at positions >= insertAt up by 1
            if (count > 0 && insertAt < count) {
                const { glowMesh } = shapeData;
                for (let i = count - 1; i >= insertAt; i--) {
                    const mat = new Matrix4();
                    instancedMesh.getMatrixAt(i, mat);
                    instancedMesh.setMatrixAt(i + 1, mat);
                    glowMesh.getMatrixAt(i, mat);
                    glowMesh.setMatrixAt(i + 1, mat);
                }

                const iColor = instancedMesh.geometry.attributes.iColor! as InstancedBufferAttribute;
                const iBgColor = instancedMesh.geometry.attributes.iBgColor! as InstancedBufferAttribute;
                const iOpacity = instancedMesh.geometry.attributes.iOpacity! as InstancedBufferAttribute;
                const iTexSeed = instancedMesh.geometry.attributes.iTexSeed! as InstancedBufferAttribute;
                const iFloorIconType = instancedMesh.geometry.attributes.iFloorIconType! as InstancedBufferAttribute;
                const iFloorIconAngle = instancedMesh.geometry.attributes.iFloorIconAngle! as InstancedBufferAttribute;
                const iGlow = glowMesh.geometry.attributes.iGlow! as InstancedBufferAttribute;

                for (let i = count - 1; i >= insertAt; i--) {
                    iColor.setXYZ(i + 1, iColor.getX(i), iColor.getY(i), iColor.getZ(i));
                    iBgColor.setXYZ(i + 1, iBgColor.getX(i), iBgColor.getY(i), iBgColor.getZ(i));
                    iOpacity.setX(i + 1, iOpacity.getX(i));
                    iTexSeed.setX(i + 1, iTexSeed.getX(i));
                    iFloorIconType.setX(i + 1, iFloorIconType.getX(i));
                    iFloorIconAngle.setX(i + 1, iFloorIconAngle.getX(i));
                    iGlow.setX(i + 1, iGlow.getX(i));
                }
                iColor.needsUpdate = true;
                iBgColor.needsUpdate = true;
                iOpacity.needsUpdate = true;
                iTexSeed.needsUpdate = true;
                iFloorIconType.needsUpdate = true;
                iFloorIconAngle.needsUpdate = true;
                iGlow.needsUpdate = true;
                instancedMesh.instanceMatrix.needsUpdate = true;
                glowMesh.instanceMatrix.needsUpdate = true;

                // Update tileIndex→instanceIndex mapping for shifted instances only
                for (const [tIdx, instIdx] of shapeData.instances) {
                    if (instIdx >= insertAt) {
                        shapeData.instances.set(tIdx, instIdx + 1);
                    }
                }
                // Shift tileIdsByPosition
                for (let i = count - 1; i >= insertAt; i--) {
                    idsByPos[i + 1] = idsByPos[i];
                }
            }

            idsByPos[insertAt] = tileIndex;
            shapeData.instances.set(tileIndex, insertAt);
            shapeData.instanceCount++;
            shapeData.instancedMesh.count = shapeData.instanceCount;
            shapeData.glowMesh.count = shapeData.instanceCount;

            // Update minTileIndex and renderOrder for between-shape draw order.
            // This is only a blending-order heuristic now: exact per-tile occlusion
            // comes from setTileLayer()'s per-instance z offsets via the depth buffer.
            if (tileIndex < shapeData.minTileIndex) {
                shapeData.minTileIndex = tileIndex;
                // Lower tile ID = higher layer = rendered last = higher renderOrder
                shapeData.instancedMesh.renderOrder = -tileIndex;
            }
            instanceIndex = insertAt;
        }

        // Update instance transform and color
        const { instancedMesh, dummy } = shapeData;

        dummy.position.set(position.x, position.y, position.z + instance.layerZ);
        dummy.rotation.copy(rotation);
        
        if (visible) {
            dummy.scale.copy(scale);
        } else {
            dummy.scale.set(0, 0, 0);
        }
        
        dummy.updateMatrix();

        this.setInstanceMatrix(shapeData, instanceIndex, dummy.matrix);

        // Update instance colors
        const color3 = new Color(color);
        const bgColor3 = new Color(bgColor);

        instancedMesh.geometry.attributes.iColor!.setXYZ(
            instanceIndex,
            color3.r,
            color3.g,
            color3.b
        );
        instancedMesh.geometry.attributes.iBgColor!.setXYZ(
            instanceIndex,
            bgColor3.r,
            bgColor3.g,
            bgColor3.b
        );
        instancedMesh.geometry.attributes.iOpacity!.setX(instanceIndex, opacity);
        instancedMesh.geometry.attributes.iTexSeed!.setX(instanceIndex, texSeed);
        instancedMesh.geometry.attributes.iFloorIconType!.setX(instanceIndex, floorIconType);
        instancedMesh.geometry.attributes.iFloorIconAngle!.setX(instanceIndex, floorIconAngle);
        const glowAttr = shapeData.glowMesh.geometry.attributes.iGlow! as InstancedBufferAttribute;
        glowAttr.setX(instanceIndex, instance.glow);
        glowAttr.needsUpdate = true;

        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.geometry.attributes.iColor!.needsUpdate = true;
        instancedMesh.geometry.attributes.iBgColor!.needsUpdate = true;
        instancedMesh.geometry.attributes.iOpacity!.needsUpdate = true;
        instancedMesh.geometry.attributes.iTexSeed!.needsUpdate = true;
        instancedMesh.geometry.attributes.iFloorIconType!.needsUpdate = true;
        instancedMesh.geometry.attributes.iFloorIconAngle!.needsUpdate = true;
    }

    /**
     * Update only transform for an existing tile
     * Skips GPU upload if nothing changed (dirty check)
     */
    public updateTileTransform(
        tileIndex: number,
        position: Vector3,
        rotation: Euler,
        scale: Vector3,
        opacity?: number
    ): void {
        const instance = this.tileInstances.get(tileIndex);
        if (!instance) return;

        // Dirty check — skip if nothing changed to avoid per-frame GPU upload
        const posChanged = !instance.position.equals(position);
        const rotChanged = !instance.rotation.equals(rotation);
        const scaleChanged = !instance.scale.equals(scale);
        const opacityChanged = opacity !== undefined && Math.abs(instance.opacity - opacity) > 1e-6;

        if (!posChanged && !rotChanged && !scaleChanged && !opacityChanged) return;

        if (posChanged) instance.position.copy(position);
        if (rotChanged) instance.rotation.copy(rotation);
        if (scaleChanged) instance.scale.copy(scale);
        if (opacityChanged) instance.opacity = opacity;

        // Find in instanced meshes
        for (const shapeData of this.instancedMeshes.values()) {
            const instanceIndex = shapeData.instances.get(tileIndex);
            if (instanceIndex !== undefined) {
                const { instancedMesh, dummy } = shapeData;

                if (posChanged || rotChanged || scaleChanged) {
                    dummy.position.set(position.x, position.y, position.z + instance.layerZ);
                    dummy.rotation.copy(rotation);
                    if (instance.visible) {
                        dummy.scale.copy(scale);
                    } else {
                        dummy.scale.set(0, 0, 0);
                    }
                    dummy.updateMatrix();

                    this.setInstanceMatrix(shapeData, instanceIndex, dummy.matrix);
                }

                if (opacityChanged) {
                    instancedMesh.geometry.attributes.iOpacity!.setX(instanceIndex, opacity!);
                    instancedMesh.geometry.attributes.iOpacity!.needsUpdate = true;
                }
                break;
            }
        }
    }

    /**
     * Update only color for an existing tile
     * Skips GPU upload if colors haven't changed (dirty check)
     */
    public updateTileColor(
        tileIndex: number,
        color: string,
        bgColor: string
    ): void {
        const instance = this.tileInstances.get(tileIndex);
        if (!instance) return;

        // Dirty check — parse incoming colors and compare with stored
        const newColor = new Color(color);
        const newBgColor = new Color(bgColor);
        const colorChanged = !instance.color.equals(newColor);
        const bgColorChanged = !instance.bgColor.equals(newBgColor);

        if (!colorChanged && !bgColorChanged) return;

        if (colorChanged) instance.color.copy(newColor);
        if (bgColorChanged) instance.bgColor.copy(newBgColor);

        // Find in instanced meshes
        for (const shapeData of this.instancedMeshes.values()) {
            const instanceIndex = shapeData.instances.get(tileIndex);
            if (instanceIndex !== undefined) {
                const { instancedMesh } = shapeData;

                if (colorChanged) {
                    instancedMesh.geometry.attributes.iColor!.setXYZ(
                        instanceIndex,
                        newColor.r,
                        newColor.g,
                        newColor.b
                    );
                }
                if (bgColorChanged) {
                    instancedMesh.geometry.attributes.iBgColor!.setXYZ(
                        instanceIndex,
                        newBgColor.r,
                        newBgColor.g,
                        newBgColor.b
                    );
                }

                if (colorChanged) instancedMesh.geometry.attributes.iColor!.needsUpdate = true;
                if (bgColorChanged) instancedMesh.geometry.attributes.iBgColor!.needsUpdate = true;
                break;
            }
        }
    }

    public setFloorIconType(tileIndex: number, iconType: number): void {
        for (const shapeData of this.instancedMeshes.values()) {
            const instanceIndex = shapeData.instances.get(tileIndex);
            if (instanceIndex !== undefined) {
                const attr = shapeData.instancedMesh.geometry.attributes.iFloorIconType!;
                attr.setX(instanceIndex, iconType);
                attr.needsUpdate = true;
                break;
            }
        }
    }

    public setFloorIconAngle(tileIndex: number, angle: number): void {
        for (const shapeData of this.instancedMeshes.values()) {
            const instanceIndex = shapeData.instances.get(tileIndex);
            if (instanceIndex !== undefined) {
                const attr = shapeData.instancedMesh.geometry.attributes.iFloorIconAngle!;
                attr.setX(instanceIndex, angle);
                attr.needsUpdate = true;
                break;
            }
        }
    }

    /**
     * 设置砖块辉度层 alpha（topGlow）。0 = 不发光；玩家经过该砖后由 Player 写入
     * `min(floorOpacity * trackGlowIntensity/100 * 0.8, colorAlpha)`。
     */
    public setTileGlow(tileIndex: number, glow: number): void {
        const instance = this.tileInstances.get(tileIndex);
        if (instance) {
            if (Math.abs(instance.glow - glow) < 1e-6) return;
            instance.glow = glow;
        }
        for (const shapeData of this.instancedMeshes.values()) {
            const instanceIndex = shapeData.instances.get(tileIndex);
            if (instanceIndex !== undefined) {
                const attr = shapeData.glowMesh.geometry.attributes.iGlow!;
                attr.setX(instanceIndex, glow);
                attr.needsUpdate = true;
                break;
            }
        }
    }

    public setIconAtlas(texture: Texture, atlasCols: number, iconSize: number): void {
        this.iconAtlasTexture = texture;
        this.iconAtlasCols = atlasCols;
        this.iconSize = iconSize;
        for (const shapeData of this.instancedMeshes.values()) {
            const mat = shapeData.instancedMesh.material as ShaderMaterial;
            if (mat.uniforms) {
                mat.uniforms.uIconAtlas.value = texture;
                mat.uniforms.uIconAtlasCols.value = atlasCols;
                mat.uniforms.uIconSize.value = iconSize;
            }
        }
    }

    /** 设置砖块辉度贴图（floor-top-glow.png）。 */
    public setGlowTexture(texture: Texture): void {
        this.glowTexture = texture;
        for (const shapeData of this.instancedMeshes.values()) {
            const mat = shapeData.glowMesh.material as ShaderMaterial;
            if (mat.uniforms && mat.uniforms.uGlowTexture) {
                mat.uniforms.uGlowTexture.value = texture;
            }
        }
    }

    /**
     * Expand an instanced mesh to accommodate more instances
     */
    private expandInstancedMesh(shapeData: ShapeInstancedMesh): void {
        const oldMax = shapeData.maxInstances;
        const newMax = oldMax * 2;

        console.log(`[InstancedMeshManager] Expanding instanced mesh for ${shapeData.shapeKey} from ${oldMax} to ${newMax}`);

        // Create new instanced mesh with double capacity
        const oldMesh = shapeData.instancedMesh;
        const geometry = oldMesh.geometry.clone();
        const material = Array.isArray(oldMesh.material)
            ? oldMesh.material.map(m => m.clone())
            : oldMesh.material.clone();

        const newMesh = new InstancedMesh(geometry, material, newMax);
        newMesh.instanceMatrix.setUsage(DynamicDrawUsage);
        newMesh.frustumCulled = false;
        newMesh.count = shapeData.instanceCount;
        newMesh.renderOrder = oldMesh.renderOrder;

        // Copy instance attributes
        const iColor = new InstancedBufferAttribute(
            new Float32Array(newMax * 3),
            3
        );
        const iBgColor = new InstancedBufferAttribute(
            new Float32Array(newMax * 3),
            3
        );
        const iOpacity = new InstancedBufferAttribute(
            new Float32Array(newMax),
            1
        );
        const iTexSeed = new InstancedBufferAttribute(
            new Float32Array(newMax),
            1
        );
        const iFloorIconType = new InstancedBufferAttribute(
            new Float32Array(newMax),
            1
        );
        const iFloorIconAngle = new InstancedBufferAttribute(
            new Float32Array(newMax),
            1
        );

        // Copy old data
        for (let i = 0; i < oldMax; i++) {
            const matrix = new Matrix4();
            oldMesh.getMatrixAt(i, matrix);
            newMesh.setMatrixAt(i, matrix);

            iColor.setXYZ(i,
                oldMesh.geometry.attributes.iColor!.getX(i),
                oldMesh.geometry.attributes.iColor!.getY(i),
                oldMesh.geometry.attributes.iColor!.getZ(i)
            );
            iBgColor.setXYZ(i,
                oldMesh.geometry.attributes.iBgColor!.getX(i),
                oldMesh.geometry.attributes.iBgColor!.getY(i),
                oldMesh.geometry.attributes.iBgColor!.getZ(i)
            );
            iOpacity.setX(i,
                oldMesh.geometry.attributes.iOpacity!.getX(i)
            );
            iTexSeed.setX(i,
                oldMesh.geometry.attributes.iTexSeed!.getX(i)
            );
            iFloorIconType.setX(i,
                oldMesh.geometry.attributes.iFloorIconType!.getX(i)
            );
            iFloorIconAngle.setX(i,
                oldMesh.geometry.attributes.iFloorIconAngle!.getX(i)
            );
        }

        newMesh.geometry.setAttribute('iColor', iColor);
        newMesh.geometry.setAttribute('iBgColor', iBgColor);
        newMesh.geometry.setAttribute('iOpacity', iOpacity);
        newMesh.geometry.setAttribute('iTexSeed', iTexSeed);
        newMesh.geometry.setAttribute('iFloorIconType', iFloorIconType);
        newMesh.geometry.setAttribute('iFloorIconAngle', iFloorIconAngle);

        // Replace old mesh
        this.scene.remove(oldMesh);
        this.scene.add(newMesh);

        shapeData.instancedMesh = newMesh;
        shapeData.maxInstances = newMax;

        // 重建辉光叠加层（容量翻倍），拷贝旧实例矩阵与 alpha。
        const oldGlow = shapeData.glowMesh;
        const newGlow = this.createGlowMesh(newMax);
        newGlow.count = shapeData.instanceCount;
        newGlow.renderOrder = oldGlow.renderOrder;
        const oldGlowMatrix = new Matrix4();
        const newGlowAttr = newGlow.geometry.attributes.iGlow! as InstancedBufferAttribute;
        const oldGlowAttr = oldGlow.geometry.attributes.iGlow;
        for (let i = 0; i < oldMax; i++) {
            oldGlow.getMatrixAt(i, oldGlowMatrix);
            newGlow.setMatrixAt(i, oldGlowMatrix);
            newGlowAttr.setX(i, oldGlowAttr ? oldGlowAttr.getX(i) : 0);
        }
        newGlow.instanceMatrix.needsUpdate = true;
        newGlowAttr.needsUpdate = true;
        this.scene.remove(oldGlow);
        oldGlow.geometry.dispose();
        if (oldGlow.material instanceof Material) oldGlow.material.dispose();
        shapeData.glowMesh = newGlow;
    }

    /**
     * Remove a tile instance
     */
    public removeTile(tileIndex: number): void {
        const instance = this.tileInstances.get(tileIndex);
        if (!instance) return;

        this.tileInstances.delete(tileIndex);

        // Find and remove from shape instanced mesh
        for (const shapeData of this.instancedMeshes.values()) {
            const instanceIndex = shapeData.instances.get(tileIndex);
            if (instanceIndex !== undefined) {
                // Mark instance as invisible (we'll handle compaction later)
                const opacityAttr = shapeData.instancedMesh.geometry.attributes.iOpacity;
                opacityAttr.setX(instanceIndex, 0);
                opacityAttr.needsUpdate = true;
                // 同时熄灭辉光（否则叠加层会残留）
                const glowAttr = shapeData.glowMesh.geometry.attributes.iGlow;
                if (glowAttr) {
                    glowAttr.setX(instanceIndex, 0);
                    glowAttr.needsUpdate = true;
                }
                shapeData.instances.delete(tileIndex);
                break;
            }
        }
    }

    /**
     * Set visibility for a tile instance
     */
    public setTileVisibility(tileIndex: number, visible: boolean): void {
        const instance = this.tileInstances.get(tileIndex);
        if (!instance) return;

        if (instance.visible === visible) return;
        instance.visible = visible;

        // Find in instanced meshes
        for (const shapeData of this.instancedMeshes.values()) {
            const instanceIndex = shapeData.instances.get(tileIndex);
            if (instanceIndex !== undefined) {
                const { instancedMesh, dummy } = shapeData;
                
                // We need to update the matrix for this instance
                dummy.position.set(instance.position.x, instance.position.y, instance.position.z + instance.layerZ);
                dummy.rotation.copy(instance.rotation);
                
                if (visible) {
                    dummy.scale.copy(instance.scale);
                } else {
                    dummy.scale.set(0, 0, 0);
                }
                
                dummy.updateMatrix();
                this.setInstanceMatrix(shapeData, instanceIndex, dummy.matrix);
                
                // Also sync opacity and colors when becoming visible
                // to prevent stale state from off-screen animations
                if (visible) {
                    instancedMesh.geometry.attributes.iOpacity!.setX(instanceIndex, instance.opacity);
                    instancedMesh.geometry.attributes.iOpacity!.needsUpdate = true;
                    
                    instancedMesh.geometry.attributes.iColor!.setXYZ(
                        instanceIndex,
                        instance.color.r,
                        instance.color.g,
                        instance.color.b
                    );
                    instancedMesh.geometry.attributes.iBgColor!.setXYZ(
                        instanceIndex,
                        instance.bgColor.r,
                        instance.bgColor.g,
                        instance.bgColor.b
                    );
                    instancedMesh.geometry.attributes.iColor!.needsUpdate = true;
                    instancedMesh.geometry.attributes.iBgColor!.needsUpdate = true;

                    instancedMesh.geometry.attributes.iTexSeed!.setX(instanceIndex, instance.texSeed);
                    instancedMesh.geometry.attributes.iTexSeed!.needsUpdate = true;
                } else {
                    // When hiding, also set opacity to 0 for extra safety
                    instancedMesh.geometry.attributes.iOpacity!.setX(instanceIndex, 0);
                    instancedMesh.geometry.attributes.iOpacity!.needsUpdate = true;
                }
                break;
            }
        }
    }

    /**
     * Assign a depth layer to a tile (real-time, derived from tile id for visible tiles).
     *
     * Floor sorting: tile[x] renders ABOVE tile[x+1]. Per-instance renderOrder
     * does not exist inside one InstancedMesh, so the layer is encoded as a small world-z
     * offset and resolved by the depth buffer (depthWrite=true), which works across ALL
     * instanced shape batches regardless of which mesh a tile belongs to.
     *
     * The band stays inside the decoration-safe range: bg decorations sit at z <= -0.01,
     * foreground at z >= 0.1 (see DecorationInstance.depthZ). Camera depth resolution
     * near the tile plane is ~6e-5 world units, so steps of 2e-4 are safely distinguishable.
     */
    public setTileLayer(tileIndex: number, layerZ: number): void {
        const instance = this.tileInstances.get(tileIndex);
        if (!instance || instance.layerZ === layerZ) return;
        instance.layerZ = layerZ;

        for (const shapeData of this.instancedMeshes.values()) {
            const instanceIndex = shapeData.instances.get(tileIndex);
            if (instanceIndex !== undefined) {
                const { instancedMesh, dummy } = shapeData;
                dummy.position.set(instance.position.x, instance.position.y, instance.position.z + layerZ);
                dummy.rotation.copy(instance.rotation);
                if (instance.visible) {
                    dummy.scale.copy(instance.scale);
                } else {
                    dummy.scale.set(0, 0, 0);
                }
                dummy.updateMatrix();
                this.setInstanceMatrix(shapeData, instanceIndex, dummy.matrix);
                break;
            }
        }
    }

    /**
     * Get a tile instance
     */
    public getTileInstance(tileIndex: number): TileInstance | undefined {
        return this.tileInstances.get(tileIndex);
    }

    /**
     * Clear all instances
     */
    public clear(): void {
        this.tileInstances.clear();

        for (const shapeData of this.instancedMeshes.values()) {
            shapeData.instances.clear();
            shapeData.instanceCount = 0;
            shapeData.instancedMesh.count = 0;
            shapeData.instancedMesh.instanceMatrix.needsUpdate = true;
            shapeData.glowMesh.count = 0;
            shapeData.glowMesh.instanceMatrix.needsUpdate = true;
        }
    }

    /**
     * Dispose all resources
     */
    public dispose(): void {
        this.tileInstances.clear();

        for (const shapeData of this.instancedMeshes.values()) {
            this.scene.remove(shapeData.instancedMesh);
            shapeData.instancedMesh.geometry.dispose();
            if (shapeData.instancedMesh.material instanceof Material) {
                shapeData.instancedMesh.material.dispose();
            }
            this.scene.remove(shapeData.glowMesh);
            shapeData.glowMesh.geometry.dispose();
            if (shapeData.glowMesh.material instanceof Material) {
                shapeData.glowMesh.material.dispose();
            }
            shapeData.instances.clear();
        }

        this.instancedMeshes.clear();
        this.geometryCache.clear();
    }

    /**
     * Enable or disable instanced mesh rendering
     */
    public setUseInstancedMesh(enabled: boolean): void {
        this.useInstancedMesh = enabled;
    }

    /**
     * Get statistics
     */
    public getStats(): {
        totalInstances: number;
        totalShapes: number;
        instancedMeshes: Array<{ shapeKey: string; instanceCount: number; maxInstances: number }>;
    } {
        const instancedMeshes: Array<{ shapeKey: string; instanceCount: number; maxInstances: number }> = [];

        for (const [shapeKey, shapeData] of this.instancedMeshes.entries()) {
            instancedMeshes.push({
                shapeKey,
                instanceCount: shapeData.instanceCount,
                maxInstances: shapeData.maxInstances
            });
        }

        return {
            totalInstances: this.tileInstances.size,
            totalShapes: this.instancedMeshes.size,
            instancedMeshes
        };
    }
}