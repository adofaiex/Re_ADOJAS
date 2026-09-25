/**
 * ObjectFloorBatch — Object(Floor) 装饰的实例化渲染。
 *
 * 背景：一个 Object(Floor) 装饰就是"一块轨道"。原来每个装饰各建一个
 * BufferGeometry + MeshBasicMaterial + 逐顶点色数组，大关卡（本项测试的谱里 9107 块）
 * 就是 9107 个 mesh / 材质 / 几何，既慢又容易和其它系统（图标朝向、描边、透明度）
 * 对不齐 —— WebADOFAI 的做法是把这类对象编译成"一份外观"交给统一的轨道渲染器。
 *
 * 这里用实例化批次达到同样效果：
 *   - 按 geoKey（trackStyle + 角度 + midspin）共用一个几何（position + 掩码 aMask）；
 *   - 每实例的 fill / stroke / opacity 放 instanced attribute，着色器按掩码取色；
 *   - 每帧只写可见实例的矩阵与颜色。
 *
 * 于是 9107 块 → 几个 InstancedMesh，且描边/填充/透明度/朝向全部只有一份实现。
 */
import {
    BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, InstancedBufferAttribute,
    InstancedMesh, Matrix4, Object3D, ShaderMaterial, DoubleSide,
} from 'three';

// Matrix4 仅作为 ObjectFloorItem 的类型引用
export type { Matrix4 };

const VERT = `
attribute float aMask;
attribute vec3  aFill;
attribute vec3  aStroke;
attribute float aOpacity;
varying vec3  vColor;
varying float vOpacity;
void main() {
    // 掩码 0 = 描边（stroke），1 = 填充（fill）；与原顶点色实现等价
    vColor = mix( aStroke, aFill, step( 0.5, aMask ) );
    vOpacity = aOpacity;
    vec4 p = vec4( position, 1.0 );
    #ifdef USE_INSTANCING
        p = instanceMatrix * p;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * p;
}
`;

const FRAG = `
varying vec3  vColor;
varying float vOpacity;
void main() {
    if ( vOpacity <= 0.001 ) discard;
    gl_FragColor = vec4( vColor, vOpacity );
    #include <colorspace_fragment>
}
`;

/** 一个装饰在某一帧要画成什么样。 */
export interface ObjectFloorItem {
    geoKey: string;
    positions: Float32Array;
    indices: Uint32Array;
    mask: Float32Array;
    vertexCount: number;
    /** 轨道 mesh 所在节点的世界矩阵（含 container 的位置/旋转/缩放与 pivot）。 */
    matrixWorld: Matrix4;
    fill: Color;
    stroke: Color;
    opacity: number;
}

/** 标记「0..count」为本次要上传的区间（three r159+ 支持，老版本退回整块上传）。 */
function markRange(attr: InstancedBufferAttribute, count: number): void {
    const anyAttr = attr as any;
    if (typeof anyAttr.clearUpdateRanges === 'function' && typeof anyAttr.addUpdateRange === 'function') {
        anyAttr.clearUpdateRanges();
        if (count > 0) anyAttr.addUpdateRange(0, count);
    }
    attr.needsUpdate = true;
}

interface Batch {
    geo: BufferGeometry;
    mesh: InstancedMesh;
    material: ShaderMaterial;
    aFill: InstancedBufferAttribute;
    aStroke: InstancedBufferAttribute;
    aOpacity: InstancedBufferAttribute;
    count: number;
}

export class ObjectFloorBatchManager {
    private parent: Object3D;
    private batches: Map<string, Batch> = new Map();
    /** 每帧从 0 开始累加实例。 */
    private items: ObjectFloorItem[] = [];

    constructor(parent: Object3D) {
        this.parent = parent;
    }

    /** 每帧调用：登记一个可见的 Object(Floor) 实例。 */
    public add(item: ObjectFloorItem): void {
        this.items.push(item);
    }

    /** 每帧调用（在 add 之后）：写入实例数据并更新 count。 */
    public flush(): void {
        for (const b of this.batches.values()) b.count = 0;

        for (const it of this.items) {
            const b = this.ensureBatch(it);
            if (b.count >= b.mesh.instanceMatrix.count) continue;   // 容量满（下次 ensure 会扩容）
            const i = b.count++;
            b.mesh.setMatrixAt(i, it.matrixWorld);
            b.aFill.setXYZ(i, it.fill.r, it.fill.g, it.fill.b);
            b.aStroke.setXYZ(i, it.stroke.r, it.stroke.g, it.stroke.b);
            b.aOpacity.setX(i, it.opacity);
        }

        for (const b of this.batches.values()) {
            b.mesh.count = b.count;
            b.mesh.visible = b.count > 0;
            if (b.count > 0) {
                // 只上传用到的区间（整块上传在大批次下每帧要搬几百 KB）
                markRange(b.mesh.instanceMatrix, b.count * 16);
                markRange(b.aFill, b.count * 3);
                markRange(b.aStroke, b.count * 3);
                markRange(b.aOpacity, b.count);
            }
        }
        this.items.length = 0;
    }

    private ensureBatch(it: ObjectFloorItem): Batch {
        let b = this.batches.get(it.geoKey);
        if (!b) {
            // 初始容量按需增长：先用 64，满了两倍扩
            b = this.createBatch(it, 64);
            this.batches.set(it.geoKey, b);
        }
        if (b.count >= b.mesh.instanceMatrix.count) {
            this.grow(b, it);
        }
        return b;
    }

    private createBatch(it: ObjectFloorItem, capacity: number): Batch {
        const geo = new BufferGeometry();
        geo.setIndex(new BufferAttribute(it.indices, 1));
        geo.setAttribute('position', new BufferAttribute(it.positions, 3));
        geo.setAttribute('aMask', new BufferAttribute(it.mask, 1));

        const aFill = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        const aStroke = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        const aOpacity = new InstancedBufferAttribute(new Float32Array(capacity), 1);
        aFill.setUsage(DynamicDrawUsage);
        aStroke.setUsage(DynamicDrawUsage);
        aOpacity.setUsage(DynamicDrawUsage);
        geo.setAttribute('aFill', aFill);
        geo.setAttribute('aStroke', aStroke);
        geo.setAttribute('aOpacity', aOpacity);

        const material = new ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            transparent: true,
            depthTest: true,
            depthWrite: true,   // 与普通砖一致：深度缓冲决定层叠
            side: DoubleSide,
        });

        const mesh = new InstancedMesh(geo, material, capacity);
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.renderOrder = 0;        // 层级交给深度缓冲（实例矩阵里带 z）
        mesh.count = 0;
        this.parent.add(mesh);

        return { geo, mesh, material, aFill, aStroke, aOpacity, count: 0 };
    }

    /** 超出容量：原地扩容（保持 batches 里同一个 Batch 引用，调用方不受影响）。 */
    private grow(b: Batch, it: ObjectFloorItem): void {
        const oldCount = b.count;
        const oldMatrices = new Float32Array(b.mesh.instanceMatrix.array as Float32Array);
        const oldFill = new Float32Array(b.aFill.array as Float32Array);
        const oldStroke = new Float32Array(b.aStroke.array as Float32Array);
        const oldOpacity = new Float32Array(b.aOpacity.array as Float32Array);

        this.parent.remove(b.mesh);
        b.mesh.dispose();
        b.geo.dispose();
        b.material.dispose();

        const fresh = this.createBatch(it, Math.max(64, b.mesh.instanceMatrix.count * 2));
        b.geo = fresh.geo;
        b.mesh = fresh.mesh;
        b.material = fresh.material;
        b.aFill = fresh.aFill;
        b.aStroke = fresh.aStroke;
        b.aOpacity = fresh.aOpacity;

        (b.mesh.instanceMatrix.array as Float32Array).set(oldMatrices.subarray(0, oldCount * 16));
        b.aFill.array.set(oldFill.subarray(0, oldCount * 3));
        b.aStroke.array.set(oldStroke.subarray(0, oldCount * 3));
        b.aOpacity.array.set(oldOpacity.subarray(0, oldCount));
        b.count = oldCount;
    }

    public dispose(): void {
        for (const b of this.batches.values()) {
            this.parent.remove(b.mesh);
            b.mesh.dispose();
            b.geo.dispose();
            b.material.dispose();
        }
        this.batches.clear();
        this.items.length = 0;
    }
}
