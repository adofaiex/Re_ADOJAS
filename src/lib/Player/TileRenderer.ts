import * as THREE from 'three';
import createTrackMesh from '../Geo/mesh_reserve';
import { TileColorManager } from './TileColorManager';
import { PositionTrackManager } from './PositionTrackManager';
import { ILevelData } from './types';

/**
 * Configuration for tile rendering
 */
export interface TileRendererConfig {
    spatialGridSize: number;
    maxCachedTiles: number;
    tileZLevelBase: number;
}

/**
 * Manages tile mesh creation, visibility, and caching
 * Separated from Player class for better code organization
 */
export class TileRenderer {
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private levelData: ILevelData;
    private tileColorManager: TileColorManager;
    private positionTrackManager: PositionTrackManager | null;
    private tileEvents: Map<number, any[]>;
    
    // Configuration
    private config: TileRendererConfig = {
        spatialGridSize: 5,
        maxCachedTiles: 2000,
        tileZLevelBase: 12
    };
    
    // Tile storage
    private tiles: Map<string, THREE.Mesh> = new Map();
    private visibleTiles: Set<string> = new Set();
    
    // Spatial indexing for fast visibility checks
    private spatialGrid: Map<number, number[]> = new Map();
    
    // Geometry and material caching
    private geometryCache: Map<string, THREE.BufferGeometry> = new Map();
    
    // Camera position reference (updated externally)
    private cameraPosition: THREE.Vector3 = new THREE.Vector3();
    
    // Optimization: track last visibility check
    private lastVisibleCheckPos = new THREE.Vector3(Infinity, Infinity, Infinity);
    private lastVisibleCheckZoom = -1;
    
    // Tile limit settings
    private maxTileRenderLimit: number = 0;
    private clearPreviousTile: boolean = false;
    private currentTileIndex: number = 0;
    
    constructor(
        scene: THREE.Scene,
        camera: THREE.OrthographicCamera,
        levelData: ILevelData,
        tileColorManager: TileColorManager,
        positionTrackManager: PositionTrackManager | null,
        tileEvents: Map<number, any[]>,
        config?: Partial<TileRendererConfig>
    ) {
        this.scene = scene;
        this.camera = camera;
        this.levelData = levelData;
        this.tileColorManager = tileColorManager;
        this.positionTrackManager = positionTrackManager;
        this.tileEvents = tileEvents;
        
        if (config) {
            this.config = { ...this.config, ...config };
        }
        
        this.buildSpatialIndex();
    }
    
    /**
     * Update camera position reference (called from Player)
     */
    public setCameraPosition(pos: THREE.Vector3): void {
        this.cameraPosition.copy(pos);
    }
    
    /**
     * Update current tile index for tile limiting
     */
    public setCurrentTileIndex(index: number): void {
        this.currentTileIndex = index;
    }
    
    /**
     * Set tile render limit
     */
    public setMaxTileRenderLimit(limit: number): void {
        this.maxTileRenderLimit = limit;
        if (limit > 0) {
            this.clearPreviousTile = true;
        }
    }
    
    /**
     * Set clear previous tile mode
     */
    public setClearPreviousTile(enabled: boolean): void {
        this.clearPreviousTile = enabled;
    }
    
    /**
     * Get visible tiles count
     */
    public getVisibleTileCount(): number {
        return this.visibleTiles.size;
    }
    
    /**
     * Get total cached tiles count
     */
    public getTotalCachedTiles(): number {
        return this.tiles.size;
    }
    
    /**
     * Build spatial index for fast visibility checks
     * Groups tiles into grid cells for O(1) lookup
     */
    private buildSpatialIndex(): void {
        this.spatialGrid.clear();
        const tiles = this.levelData.tiles;
        if (!tiles) return;
        
        const gridSize = this.config.spatialGridSize;
        for (let i = 0; i < tiles.length; i++) {
            const pos = tiles[i].position;
            const cellX = Math.floor(pos[0] / gridSize);
            const cellY = Math.floor(pos[1] / gridSize);
            const key = cellX * 100000 + cellY;
            
            let list = this.spatialGrid.get(key);
            if (list === undefined) {
                list = [];
                this.spatialGrid.set(key, list);
            }
            list.push(i);
        }
    }
    
    /**
     * Update visible tiles based on camera position and zoom
     */
    public updateVisibleTiles(): void {
        if (!this.scene || !this.levelData.tiles) return;
        
        const zoom = this.camera.zoom || 1.0;
        
        // Skip if camera hasn't moved significantly
        const distSq = this.cameraPosition.distanceToSquared(this.lastVisibleCheckPos);
        if (distSq < 0.01 && Math.abs(zoom - this.lastVisibleCheckZoom) < 0.01) {
            return;
        }
        
        this.lastVisibleCheckPos.copy(this.cameraPosition);
        this.lastVisibleCheckZoom = zoom;
        
        // Calculate visible bounds
        const left = this.cameraPosition.x + this.camera.left / zoom;
        const right = this.cameraPosition.x + this.camera.right / zoom;
        const bottom = this.cameraPosition.y + this.camera.bottom / zoom;
        const top = this.cameraPosition.y + this.camera.top / zoom;
        
        const margin = 2.0;
        const newVisibleTiles: number[] = [];
        
        // Query spatial grid for visible tiles
        const minCellX = Math.floor((left - margin) / this.config.spatialGridSize);
        const maxCellX = Math.floor((right + margin) / this.config.spatialGridSize);
        const minCellY = Math.floor((bottom - margin) / this.config.spatialGridSize);
        const maxCellY = Math.floor((top + margin) / this.config.spatialGridSize);
        
        for (let cx = minCellX; cx <= maxCellX; cx++) {
            for (let cy = minCellY; cy <= maxCellY; cy++) {
                const tileIndices = this.spatialGrid.get(cx * 100000 + cy);
                if (tileIndices) {
                    for (let i = 0; i < tileIndices.length; i++) {
                        newVisibleTiles.push(tileIndices[i]);
                    }
                }
            }
        }
        
        // Remove tiles that are no longer visible
        const idsInScene = Array.from(this.visibleTiles);
        for (let i = 0; i < idsInScene.length; i++) {
            const id = idsInScene[i];
            const idx = parseInt(id);
            if (!newVisibleTiles.includes(idx)) {
                const mesh = this.tiles.get(id);
                if (mesh) {
                    this.scene.remove(mesh);
                }
                this.visibleTiles.delete(id);
            }
        }
        
        // Add newly visible tiles
        for (let i = 0; i < newVisibleTiles.length; i++) {
            const idx = newVisibleTiles[i];
            const id = idx.toString();
            if (!this.visibleTiles.has(id)) {
                const tileMesh = this.getOrCreateTileMesh(idx);
                if (tileMesh) {
                    this.scene.add(tileMesh);
                    this.visibleTiles.add(id);
                }
            }
        }
        
        // Cleanup if cache is too large
        if (this.tiles.size > this.config.maxCachedTiles) {
            this.cleanupTileCache();
        }
    }
    
    /**
     * Enforce tile render limit (sliding window mode)
     * Called when tile limit is active during playback
     */
    public enforceTileLimit(): void {
        if (this.maxTileRenderLimit <= 0) return;
        
        const currentIdx = this.currentTileIndex;
        const limit = this.maxTileRenderLimit;
        
        // 1. Clear tiles before current tile (already triggered)
        if (this.clearPreviousTile) {
            const toRemove: string[] = [];
            this.visibleTiles.forEach(id => {
                const idx = parseInt(id);
                if (idx < currentIdx) {
                    toRemove.push(id);
                }
            });
            toRemove.forEach(id => {
                const mesh = this.tiles.get(id);
                if (mesh) {
                    this.scene.remove(mesh);
                }
                this.visibleTiles.delete(id);
            });
        }
        
        // 2. If still over limit, remove furthest tiles
        if (this.visibleTiles.size > limit) {
            const visibleArray = Array.from(this.visibleTiles).map(id => parseInt(id));
            visibleArray.sort((a, b) => b - a); // Descending order
            
            const toRemoveCount = this.visibleTiles.size - limit;
            for (let i = 0; i < toRemoveCount && i < visibleArray.length; i++) {
                const id = visibleArray[i].toString();
                const mesh = this.tiles.get(id);
                if (mesh) {
                    this.scene.remove(mesh);
                }
                this.visibleTiles.delete(id);
            }
        }
    }
    
    /**
     * Cleanup old tile meshes from cache
     */
    private cleanupTileCache(): void {
        const tileEntries = Array.from(this.tiles.entries());
        
        tileEntries.sort((a, b) => {
            const distA = a[1].position.distanceToSquared(this.cameraPosition);
            const distB = b[1].position.distanceToSquared(this.cameraPosition);
            return distB - distA;
        });
        
        const toRemoveCount = Math.floor(this.tiles.size * 0.3);
        let removed = 0;
        
        for (let i = 0; i < tileEntries.length && removed < toRemoveCount; i++) {
            const [id, mesh] = tileEntries[i];
            if (!this.visibleTiles.has(id)) {
                if (mesh.material instanceof THREE.Material) {
                    mesh.material.dispose();
                }
                this.tiles.delete(id);
                removed++;
            }
        }
    }
    
    /**
     * Get or create a tile mesh
     */
    private getOrCreateTileMesh(index: number): THREE.Mesh | null {
        const id = index.toString();
        if (this.tiles.has(id)) return this.tiles.get(id)!;
        
        const tile = this.levelData.tiles[index];
        if (!tile) return null;
        
        const [x, y] = tile.position;
        const zLevel = this.config.tileZLevelBase - index;
        
        // Calculate direction for mesh shape
        let pred = -180;
        if (index > 0) {
            const prevTile = this.levelData.tiles[index - 1];
            pred = (prevTile.direction || 0) - 180;
            if (prevTile.direction === 999 && index > 1) {
                pred = (this.levelData.tiles[index - 2].direction || 0);
            }
        }
        
        const currentDirection = tile.direction || 0;
        const is999 = (tile.angle === 0);
        
        // Get track style from tile color config
        const tileConfig = this.tileColorManager.getTileRecolorConfig(index);
        const trackStyle = tileConfig?.trackStyle || 'Standard';
        
        // Get or create geometry
        const shapeKey = `${pred}_${currentDirection}_${is999}_${trackStyle}`;
        let geometry = this.geometryCache.get(shapeKey);
        
        if (!geometry) {
            const meshData = createTrackMesh(pred, currentDirection, is999, undefined, undefined, undefined, trackStyle);
            if (!meshData || !meshData.faces) return null;
            
            geometry = new THREE.BufferGeometry();
            geometry.setIndex(meshData.faces);
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(meshData.colors, 3));
            geometry.computeVertexNormals();
            this.geometryCache.set(shapeKey, geometry);
        }
        
        // Get tile colors
        const colors = this.tileColorManager.getTileColor(index);
        const color = colors?.color || '#ffffff';
        const bgcolor = colors?.secondaryColor || color;
        
        // Create shader material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(color) },
                uBgColor: { value: new THREE.Color(bgcolor) }
            },
            vertexShader: `
                varying vec3 vColor;
                void main() {
                    vColor = color;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform vec3 uBgColor;
                varying vec3 vColor;
                void main() {
                    vec3 finalColor = mix(uBgColor, uColor, vColor.r);
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            vertexColors: true,
            side: THREE.DoubleSide,
            transparent: false
        });
        
        const tileMesh = new THREE.Mesh(geometry, material);
        
        // Apply PositionTrack transform
        if (this.positionTrackManager) {
            const transform = this.positionTrackManager.getTileTransform(index);
            if (transform) {
                tileMesh.position.copy(transform.position);
                tileMesh.rotation.z = transform.rotation * (Math.PI / 180);
                tileMesh.scale.copy(transform.scale);
                
                if (transform.opacity < 1 && (material as any).transparent !== undefined) {
                    (material as any).transparent = true;
                    (material as any).opacity = transform.opacity;
                }
            }
        } else {
            tileMesh.position.set(x, y, zLevel * 0.001);
        }
        
        tileMesh.castShadow = true;
        tileMesh.receiveShadow = true;
        
        // Cache the mesh
        this.tiles.set(id, tileMesh);
        
        return tileMesh;
    }
    
    /**
     * Update tile color (for RecolorTrack events)
     */
    public updateTileColor(index: number, color: string, bgcolor: string): void {
        const mesh = this.tiles.get(index.toString());
        if (mesh && mesh.material instanceof THREE.ShaderMaterial) {
            mesh.material.uniforms.uColor.value.set(color);
            mesh.material.uniforms.uBgColor.value.set(bgcolor || color);
        }
    }
    
    /**
     * Get tiles map reference (for MoveTrackManager)
     */
    public getTilesMap(): Map<string, THREE.Mesh> {
        return this.tiles;
    }
    
    /**
     * Clear all tiles (for level reload)
     */
    public clearAll(): void {
        // Remove all meshes from scene
        this.visibleTiles.forEach(id => {
            const mesh = this.tiles.get(id);
            if (mesh) {
                this.scene.remove(mesh);
            }
        });
        
        // Dispose materials
        this.tiles.forEach(mesh => {
            if (mesh.material instanceof THREE.Material) {
                mesh.material.dispose();
            }
        });
        
        this.tiles.clear();
        this.visibleTiles.clear();
        this.geometryCache.clear();
        this.spatialGrid.clear();
    }
    
    /**
     * Dispose all resources
     */
    public dispose(): void {
        this.clearAll();
    }
}
