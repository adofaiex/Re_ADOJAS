import * as THREE from 'three';

/**
 * Instance data for a single tile
 */
interface TileInstance {
    index: number;
    shapeKey: string;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
    color: THREE.Color;
    bgColor: THREE.Color;
    opacity: number;
    visible: boolean;
}

/**
 * Instanced mesh data for a specific shape
 */
interface ShapeInstancedMesh {
    shapeKey: string;
    instancedMesh: THREE.InstancedMesh;
    dummy: THREE.Object3D;
    instances: Map<number, number>; // tileIndex -> instanceIndex
    maxInstances: number;
    instanceCount: number;
}

/**
 * Manager for GPU instanced mesh rendering
 * Optimizes performance by rendering many tiles with the same geometry in a single draw call
 */
export class InstancedMeshManager {
    private scene: THREE.Scene;
    private geometryCache: Map<string, THREE.BufferGeometry>;
    private instancedMeshes: Map<string, ShapeInstancedMesh>;
    private tileInstances: Map<number, TileInstance>;
    private onGeometryNeeded: (shapeKey: string) => THREE.BufferGeometry | null;
    private maxCacheSize: number = 100;
    private useInstancedMesh: boolean = true;

    constructor(
        scene: THREE.Scene,
        onGeometryNeeded: (shapeKey: string) => THREE.BufferGeometry | null,
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
        const material = new THREE.ShaderMaterial({
            uniforms: {},
            vertexShader: `
                attribute vec3 iColor;
                attribute vec3 iBgColor;
                attribute float iOpacity;
                
                varying vec3 vColor;
                varying vec3 vInstanceColor;
                varying vec3 vInstanceBgColor;
                varying float vOpacity;
                
                void main() {
                    vColor = color;
                    vInstanceColor = iColor;
                    vInstanceBgColor = iBgColor;
                    vOpacity = iOpacity;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying vec3 vInstanceColor;
                varying vec3 vInstanceBgColor;
                varying float vOpacity;
                
                void main() {
                    // Mix instance colors based on vertex color red channel
                    vec3 finalColor = mix(vInstanceBgColor, vInstanceColor, vColor.r);
                    gl_FragColor = vec4(finalColor, vOpacity);
                }
            `,
            vertexColors: true,
            side: THREE.DoubleSide,
            transparent: true,
            depthTest: true,
            depthWrite: true
        });

        const instancedMesh = new THREE.InstancedMesh(geometry, material, maxInstances);
        instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instancedMesh.renderOrder = 0; // Standard tile level
        instancedMesh.frustumCulled = false; // Prevent tiles from disappearing when camera moves
        instancedMesh.count = 0; // Start with 0 visible instances

        // Create instance color attributes
        const iColor = new THREE.InstancedBufferAttribute(
            new Float32Array(maxInstances * 3),
            3
        );
        const iBgColor = new THREE.InstancedBufferAttribute(
            new Float32Array(maxInstances * 3),
            3
        );
        const iOpacity = new THREE.InstancedBufferAttribute(
            new Float32Array(maxInstances),
            1
        );

        instancedMesh.geometry.setAttribute('iColor', iColor);
        instancedMesh.geometry.setAttribute('iBgColor', iBgColor);
        instancedMesh.geometry.setAttribute('iOpacity', iOpacity);

        instancedMesh.instanceMatrix.needsUpdate = true;

        const dummy = new THREE.Object3D();

        const shapeData: ShapeInstancedMesh = {
            shapeKey,
            instancedMesh,
            dummy,
            instances: new Map(),
            maxInstances,
            instanceCount: 0
        };

        this.scene.add(instancedMesh);
        this.instancedMeshes.set(shapeKey, shapeData);

        return shapeData;
    }

    /**
     * Update or add a tile instance
     */
    public updateTile(
        tileIndex: number,
        shapeKey: string,
        position: THREE.Vector3,
        rotation: THREE.Euler,
        scale: THREE.Vector3,
        color: string,
        bgColor: string,
        opacity: number = 1,
        visible: boolean = true
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

        // Store instance data
        const instance: TileInstance = {
            index: tileIndex,
            shapeKey,
            position: position.clone(),
            rotation: rotation.clone() as THREE.Euler,
            scale: scale.clone(),
            color: new THREE.Color(color),
            bgColor: new THREE.Color(bgColor),
            opacity,
            visible
        };

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
            // Add new instance
            if (shapeData.instanceCount >= shapeData.maxInstances) {
                // Need to expand the instanced mesh
                this.expandInstancedMesh(shapeData);
            }
            instanceIndex = shapeData.instanceCount;
            shapeData.instances.set(tileIndex, instanceIndex);
            shapeData.instanceCount++;
            shapeData.instancedMesh.count = shapeData.instanceCount;
        }

        // Update instance transform and color
        const { instancedMesh, dummy } = shapeData;

        dummy.position.copy(position);
        dummy.rotation.copy(rotation);
        
        if (visible) {
            dummy.scale.copy(scale);
        } else {
            dummy.scale.set(0, 0, 0);
        }
        
        dummy.updateMatrix();

        instancedMesh.setMatrixAt(instanceIndex, dummy.matrix);

        // Update instance colors
        const color3 = new THREE.Color(color);
        const bgColor3 = new THREE.Color(bgColor);

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

        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.geometry.attributes.iColor!.needsUpdate = true;
        instancedMesh.geometry.attributes.iBgColor!.needsUpdate = true;
        instancedMesh.geometry.attributes.iOpacity!.needsUpdate = true;
    }

    /**
     * Update only transform for an existing tile
     */
    public updateTileTransform(
        tileIndex: number,
        position: THREE.Vector3,
        rotation: THREE.Euler,
        scale: THREE.Vector3,
        opacity?: number
    ): void {
        const instance = this.tileInstances.get(tileIndex);
        if (!instance) return;

        instance.position.copy(position);
        instance.rotation.copy(rotation);
        instance.scale.copy(scale);
        if (opacity !== undefined) instance.opacity = opacity;

        // Find in instanced meshes
        for (const shapeData of this.instancedMeshes.values()) {
            const instanceIndex = shapeData.instances.get(tileIndex);
            if (instanceIndex !== undefined) {
                const { instancedMesh, dummy } = shapeData;
                
                dummy.position.copy(position);
                dummy.rotation.copy(rotation);
                if (instance.visible) {
                    dummy.scale.copy(scale);
                } else {
                    dummy.scale.set(0, 0, 0);
                }
                dummy.updateMatrix();
                
                instancedMesh.setMatrixAt(instanceIndex, dummy.matrix);
                instancedMesh.instanceMatrix.needsUpdate = true;
                
                if (opacity !== undefined) {
                    instancedMesh.geometry.attributes.iOpacity!.setX(instanceIndex, opacity);
                    instancedMesh.geometry.attributes.iOpacity!.needsUpdate = true;
                }
                break;
            }
        }
    }

    /**
     * Update only color for an existing tile
     */
    public updateTileColor(
        tileIndex: number,
        color: string,
        bgColor: string
    ): void {
        const instance = this.tileInstances.get(tileIndex);
        if (!instance) return;

        instance.color.set(color);
        instance.bgColor.set(bgColor);

        // Find in instanced meshes
        for (const shapeData of this.instancedMeshes.values()) {
            const instanceIndex = shapeData.instances.get(tileIndex);
            if (instanceIndex !== undefined) {
                const { instancedMesh } = shapeData;
                
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
                break;
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

        const newMesh = new THREE.InstancedMesh(geometry, material, newMax);
        newMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        newMesh.frustumCulled = false;
        newMesh.count = shapeData.instanceCount;
        newMesh.renderOrder = oldMesh.renderOrder;

        // Copy instance attributes
        const iColor = new THREE.InstancedBufferAttribute(
            new Float32Array(newMax * 3),
            3
        );
        const iBgColor = new THREE.InstancedBufferAttribute(
            new Float32Array(newMax * 3),
            3
        );
        const iOpacity = new THREE.InstancedBufferAttribute(
            new Float32Array(newMax),
            1
        );

        // Copy old data
        for (let i = 0; i < oldMax; i++) {
            const matrix = new THREE.Matrix4();
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
        }

        newMesh.geometry.setAttribute('iColor', iColor);
        newMesh.geometry.setAttribute('iBgColor', iBgColor);
        newMesh.geometry.setAttribute('iOpacity', iOpacity);

        // Replace old mesh
        this.scene.remove(oldMesh);
        this.scene.add(newMesh);

        shapeData.instancedMesh = newMesh;
        shapeData.maxInstances = newMax;
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
                dummy.position.copy(instance.position);
                dummy.rotation.copy(instance.rotation);
                
                if (visible) {
                    dummy.scale.copy(instance.scale);
                } else {
                    dummy.scale.set(0, 0, 0);
                }
                
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(instanceIndex, dummy.matrix);
                instancedMesh.instanceMatrix.needsUpdate = true;
                
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
            if (shapeData.instancedMesh.material instanceof THREE.Material) {
                shapeData.instancedMesh.material.dispose();
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