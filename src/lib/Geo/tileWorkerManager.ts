// Tile Mesh Worker Manager
// Uses Web Workers to generate tile meshes in background threads

import * as THREE from 'three';
import { meshWorkerCode, MeshWorkerMessage, MeshWorkerResponse } from './meshWorker';

interface PendingRequest {
    resolve: (meshData: THREE.BufferGeometry | null) => void;
    startAngle: number;
    endAngle: number;
    isMidspin: boolean;
}

export class TileWorkerManager {
    private workers: Worker[] = [];
    private pendingRequests: Map<number, PendingRequest> = new Map();
    private requestId: number = 0;
    private maxWorkers: number;
    private currentWorkerIndex: number = 0;
    private enabled: boolean = true;

    constructor(maxWorkers: number = navigator.hardwareConcurrency || 4) {
        this.maxWorkers = Math.min(maxWorkers, 8);
        this.initWorkers();
    }

    private initWorkers(): void {
        const blob = new Blob([meshWorkerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);

        for (let i = 0; i < this.maxWorkers; i++) {
            const worker = new Worker(workerUrl);
            worker.onmessage = this.handleWorkerMessage.bind(this);
            this.workers.push(worker);
        }

        // Clean up blob URL after workers are created
        URL.revokeObjectURL(workerUrl);
    }

    private handleWorkerMessage(e: MessageEvent<MeshWorkerResponse>): void {
        const { type, id, meshData } = e.data;
        
        if (type === 'meshResult') {
            const pending = this.pendingRequests.get(id);
            if (pending) {
                this.pendingRequests.delete(id);
                
                if (meshData) {
                    const geometry = new THREE.BufferGeometry();
                    geometry.setIndex(meshData.faces);
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
                    geometry.setAttribute('color', new THREE.Float32BufferAttribute(meshData.colors, 3));
                    geometry.computeVertexNormals();
                    pending.resolve(geometry);
                } else {
                    pending.resolve(null);
                }
            }
        }
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    public isEnabled(): boolean {
        return this.enabled && this.workers.length > 0;
    }

    public createMeshAsync(
        startAngle: number,
        endAngle: number,
        isMidspin: boolean
    ): Promise<THREE.BufferGeometry | null> {
        return new Promise((resolve) => {
            if (!this.enabled || this.workers.length === 0) {
                resolve(null);
                return;
            }

            const id = this.requestId++;
            this.pendingRequests.set(id, { resolve, startAngle, endAngle, isMidspin });

            // Round-robin worker selection
            const worker = this.workers[this.currentWorkerIndex];
            this.currentWorkerIndex = (this.currentWorkerIndex + 1) % this.workers.length;

            const message: MeshWorkerMessage = {
                type: 'createMesh',
                id,
                startAngle,
                endAngle,
                isMidspin,
            };

            worker.postMessage(message);
        });
    }

    public createMeshSync(
        startAngle: number,
        endAngle: number,
        isMidspin: boolean
    ): THREE.BufferGeometry | null {
        // Fallback to main thread - handled by mesh_reserve.ts
        return null;
    }

    public dispose(): void {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
        this.pendingRequests.clear();
    }
}

// Singleton instance
let workerManager: TileWorkerManager | null = null;

export function getWorkerManager(): TileWorkerManager {
    if (!workerManager) {
        workerManager = new TileWorkerManager();
    }
    return workerManager;
}

export function disposeWorkerManager(): void {
    if (workerManager) {
        workerManager.dispose();
        workerManager = null;
    }
}
