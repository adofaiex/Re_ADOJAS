import * as THREE from 'three';
import { Decoration, DecorationConfig, DecPlacementType, defaultDecorationConfig } from './Decoration';
import { EasingFunctions } from './Easing';

/**
 * Interface for level data
 */
interface ILevelData {
    settings: any;
    tiles: any[];
    actions?: any[];
    decorations?: any[];
}

/**
 * Decoration Manager - handles creation, updates, and animation of decorations
 */
export class DecorationManager {
    private scene: THREE.Scene;
    private container: THREE.Group;
    private levelData: ILevelData;
    
    // All decorations indexed by ID
    private decorations: Map<string, Decoration> = new Map();
    
    // Decorations indexed by tag for MoveDecorations events
    private taggedDecorations: Map<string, Decoration[]> = new Map();
    
    // Decorations indexed by floor number
    private floorDecorations: Map<number, Decoration[]> = new Map();
    
    // Timeline for MoveDecorations events
    private decorationEventsTimeline: { time: number; event: any }[] = [];
    private lastDecorationEventIndex: number = -1;
    
    // Cached tile positions and timing
    private tileStartTimes: number[];
    private tileBPM: number[];
    
    // Texture cache
    private textureLoader: THREE.TextureLoader;
    private textureCache: Map<string, THREE.Texture> = new Map();
    private customImages: Map<string, string> = new Map(); // filename -> base64 or URL
    private placeholderTexture: THREE.Texture | null = null; // Cached placeholder
    
    // Loading state
    private texturesLoading: Set<string> = new Set();
    private texturesLoaded: Set<string> = new Set();
    
    // Tile size for coordinate conversion
    private tileSize: number = 1.0;
    
    constructor(
        scene: THREE.Scene,
        levelData: ILevelData,
        tileStartTimes: number[],
        tileBPM: number[]
    ) {
        this.scene = scene;
        this.levelData = levelData;
        this.tileStartTimes = tileStartTimes;
        this.tileBPM = tileBPM;
        
        this.container = new THREE.Group();
        this.container.name = 'DecorationContainer';
        this.scene.add(this.container);
        
        this.textureLoader = new THREE.TextureLoader();
    }
    
    /**
     * Preload all required textures asynchronously
     * Returns a promise that resolves when all textures are loaded
     */
    public async preloadTextures(): Promise<number> {
        // Collect all unique image filenames from decorations
        const imageFilenames = new Set<string>();
        
        this.decorations.forEach((decoration) => {
            const img = decoration.config.decorationImage;
            if (img) {
                imageFilenames.add(img);
            }
        });
        
        if (imageFilenames.size === 0) {
            return 0;
        }
        
        console.log('[DecorationManager] Preloading', imageFilenames.size, 'textures...');
        console.log('[DecorationManager] Images to load:', Array.from(imageFilenames));
        console.log('[DecorationManager] Custom images registered:', Array.from(this.customImages.keys()));
        
        // Load textures in parallel
        const loadPromises: Promise<void>[] = [];
        
        imageFilenames.forEach((filename) => {
            loadPromises.push(this.loadTextureAsync(filename));
        });
        
        await Promise.all(loadPromises);
        
        console.log('[DecorationManager] Preloaded', this.texturesLoaded.size, 'textures');
        
        // Update all decorations with loaded textures
        this.decorations.forEach((decoration) => {
            const filename = decoration.config.decorationImage;
            if (filename) {
                // Check cache by exact filename
                let texture = this.textureCache.get(filename);
                // If not found, check by base name
                if (!texture) {
                    const baseName = this.getBaseName(filename);
                    texture = this.textureCache.get(baseName);
                }
                if (texture) {
                    console.log('[DecorationManager] Updating decoration texture:', filename);
                    decoration.setupVisual(texture);
                } else {
                    console.log('[DecorationManager] No texture found for decoration:', filename);
                }
            }
        });
        
        return this.texturesLoaded.size;
    }
    
    /**
     * Load a single texture asynchronously
     */
    private loadTextureAsync(filename: string): Promise<void> {
        return new Promise((resolve) => {
            // Check if already cached
            if (this.textureCache.has(filename)) {
                resolve();
                return;
            }
            
            // Find matching custom image URL (flexible matching)
            const customUrl = this.findCustomImageUrl(filename);
            if (!customUrl) {
                console.log('[DecorationManager] No custom image found for:', filename);
                // No custom image, will use placeholder
                resolve();
                return;
            }
            
            // Skip if already loading
            if (this.texturesLoading.has(filename)) {
                resolve();
                return;
            }
            
            console.log('[DecorationManager] Loading texture:', filename, 'from URL');
            this.texturesLoading.add(filename);
            
            this.textureLoader.load(
                customUrl,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    this.textureCache.set(filename, texture);
                    this.texturesLoaded.add(filename);
                    this.texturesLoading.delete(filename);
                    console.log('[DecorationManager] Texture loaded successfully:', filename);
                    resolve();
                },
                undefined,
                (error) => {
                    console.warn('[DecorationManager] Failed to load texture:', filename, error);
                    this.texturesLoading.delete(filename);
                    resolve(); // Resolve anyway, will use placeholder
                }
            );
        });
    }
    
    /**
     * Initialize decorations from level data
     */
    public init(): void {
        console.log('[DecorationManager] Initializing decorations...');
        this.clear();
        
        // Parse AddDecoration events from decorations array (if exists at root level)
        const rootDecorations = this.levelData.decorations || (this.levelData as any).__decorations;
        let decorationCount = 0;
        
        if (rootDecorations && Array.isArray(rootDecorations)) {
            console.log(`[DecorationManager] Found ${rootDecorations.length} root-level decorations`);
            rootDecorations.forEach((dec: any, index: number) => {
                if (dec.eventType === 'AddDecoration') {
                    const result = this.createDecoration(dec, decorationCount++);
                    if (result) {
                        console.log(`[DecorationManager] Created decoration: ${result.config.id} with image: ${result.config.decorationImage}`);
                    } else {
                        console.warn(`[DecorationManager] Failed to create decoration at index ${index}`);
                    }
                } else if (dec.eventType === 'AddText') {
                    this.createTextDecoration(dec, decorationCount++);
                }
            });
        }
        
        // Parse AddDecoration events from tiles.addDecorations (ADOFAI format)
        const tiles = this.levelData.tiles;
        if (tiles && Array.isArray(tiles)) {
            let tileDecoCount = 0;
            tiles.forEach((tile: any, tileIndex: number) => {
                if (tile.addDecorations && Array.isArray(tile.addDecorations)) {
                    tile.addDecorations.forEach((dec: any) => {
                        // Add floor property if not present
                        const decWithFloor = { ...dec, floor: dec.floor ?? tileIndex };
                        if (dec.eventType === 'AddDecoration') {
                            const result = this.createDecoration(decWithFloor, decorationCount++);
                            if (result) {
                                tileDecoCount++;
                                console.log(`[DecorationManager] Created tile decoration: ${result.config.id} on tile ${tileIndex}`);
                            }
                        } else if (dec.eventType === 'AddText') {
                            this.createTextDecoration(decWithFloor, decorationCount++);
                        }
                    });
                }
            });
            console.log(`[DecorationManager] Created ${tileDecoCount} tile-level decorations`);
        }
        
        console.log(`[DecorationManager] Total decorations created: ${this.decorations.size}`);
        console.log('[DecorationManager] Registered images:', Array.from(this.customImages.keys()));
        
        // Always build events timeline (MoveDecorations are in actions)
        this.buildDecorationEventsTimeline();
    }
    
    /**
     * Create a decoration from AddDecoration event
     * 
     * Based on official ADOFAI source (scrDecoration.cs Setup method):
     * - position: used as-is for coordinate calculation
     * - parallaxOffset: multiplied by tileSize
     * - pivotOffset: multiplied by tileSize (unless Camera-relative)
     * - scale/opacity: stored as percentages (100-based), converted in Decoration
     */
    private createDecoration(event: any, index: number): Decoration | null {
        const relativeTo = this.parsePlacementType(event.relativeTo);
        const isCameraRelative = relativeTo === DecPlacementType.Camera || relativeTo === DecPlacementType.CameraAspect;
        
        // Parse position (tileSize multiplier depends on relativeTo)
        const rawPosition = this.parseVector2(event.position, [0, 0]);
        
        // Parse parallaxOffset - always multiply by tileSize (official: vector4 * tileSize)
        const rawParallaxOffset = this.parseVector2(event.parallaxOffset, [0, 0]);
        const parallaxOffset: [number, number] = [
            rawParallaxOffset[0] * this.tileSize,
            rawParallaxOffset[1] * this.tileSize
        ];
        
        const config: Partial<DecorationConfig> = {
            id: `dec_${index}`,
            tag: event.tag || '',
            decorationImage: event.decorationImage || '',
            position: rawPosition,
            positionOffset: this.parseVector2(event.positionOffset, [0, 0]),
            relativeTo: relativeTo,
            rotation: event.rotation || 0,
            rotationOffset: event.rotationOffset || 0,
            scale: this.parseVector2(event.scale, [100, 100]),
            parallax: this.parseVector2(event.parallax, [100, 100]),
            parallaxOffset: parallaxOffset,
            depth: event.depth || 0,
            color: event.color || 'ffffff',
            opacity: event.opacity !== undefined ? event.opacity : 100,
            lockScale: event.lockScale === true,
            lockRotation: event.lockRotation === true,
            visible: event.visible !== undefined ? event.visible : true,
            floor: event.floor
        };
        
        const decoration = new Decoration(config);
        
        // Set initial position based on placement type
        // Official: SetPlacementType method determines startPos
        if (config.floor !== undefined && relativeTo === DecPlacementType.Tile) {
            // Tile-relative: position is added to tile position
            const tile = this.levelData.tiles[config.floor];
            if (tile && tile.position) {
                const tilePos = new THREE.Vector2(tile.position[0], tile.position[1]);
                // startPos = tile position + position * tileSize (official behavior)
                decoration.startPos.set(
                    tilePos.x + rawPosition[0],
                    tilePos.y + rawPosition[1]
                );
                decoration.pivotPos.copy(decoration.startPos);
                decoration.currentPosition.copy(decoration.startPos);
            }
        } else if (isCameraRelative) {
            // Camera-relative: position is direct offset from camera
            // Official: for Camera/CameraAspect, position is not multiplied by tileSize
            decoration.startPos.set(rawPosition[0], rawPosition[1]);
            decoration.pivotPos.set(0, 0);
            decoration.currentPosition.copy(decoration.startPos);
        } else {
            // Default: use position directly
            decoration.startPos.set(rawPosition[0], rawPosition[1]);
            decoration.currentPosition.copy(decoration.startPos);
        }
        
        // Load texture
        let textureAvailable = false;
        
        if (config.decorationImage) {
            textureAvailable = this.loadDecorationTexture(config.decorationImage, decoration);
            if (!textureAvailable) {
                // Texture not found, do not create decoration to save performance
                console.log(`[DecorationManager] Skipping decoration '${config.id}': texture '${config.decorationImage}' not found`);
                decoration.dispose();
                return null;
            }
        } else {
            // 没有指定图像 - 不创建装饰物以节省性能
            console.log(`[DecorationManager] Skipping decoration '${config.id}': no image specified`);
            decoration.dispose();
            return null;
        }

        // Register decoration
        this.decorations.set(config.id!, decoration);
        this.container.add(decoration.container);
        
        // Index by tag
        if (config.tag) {
            const tags = config.tag.split(' ').filter((t: string) => t.length > 0);
            tags.forEach((tag: string) => {
                if (!this.taggedDecorations.has(tag)) {
                    this.taggedDecorations.set(tag, []);
                }
                this.taggedDecorations.get(tag)!.push(decoration);
            });
        }
        
        // Index by floor
        if (config.floor !== undefined) {
            if (!this.floorDecorations.has(config.floor)) {
                this.floorDecorations.set(config.floor, []);
            }
            this.floorDecorations.get(config.floor)!.push(decoration);
        }
        
        // Set initial visibility
        decoration.container.visible = config.visible ?? true;
        
        return decoration;
    }
    
    /**
     * Create a text decoration from AddText event
     */
    private createTextDecoration(event: any, index: number): Decoration | null {
        // Text decorations are similar but use text rendering
        // For now, create a basic decoration with text as placeholder
        const config: Partial<DecorationConfig> = {
            id: `text_${index}`,
            tag: event.tag || '',
            decorationImage: '',
            position: this.parseVector2(event.position, [0, 0]),
            positionOffset: this.parseVector2(event.positionOffset, [0, 0]),
            relativeTo: this.parsePlacementType(event.relativeTo),
            rotation: event.rotation || 0,
            rotationOffset: event.rotationOffset || 0,
            scale: this.parseVector2(event.scale, [100, 100]),
            parallax: this.parseVector2(event.parallax, [100, 100]),
            parallaxOffset: this.parseVector2(event.parallaxOffset, [0, 0]),
            depth: event.depth || 0,
            color: event.color || 'ffffff',
            opacity: event.opacity !== undefined ? event.opacity : 100,
            visible: event.visible !== undefined ? event.visible : true,
            floor: event.floor
        };
        
        const decoration = new Decoration(config);
        
        // Create text placeholder (in real implementation, would use TextGeometry or canvas texture)
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(event.decText || 'Text', 256, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        decoration.setupVisual(texture);
        
        // Register
        this.decorations.set(config.id!, decoration);
        this.container.add(decoration.container);
        
        if (config.tag) {
            const tags = config.tag.split(' ').filter((t: string) => t.length > 0);
            tags.forEach((tag: string) => {
                if (!this.taggedDecorations.has(tag)) {
                    this.taggedDecorations.set(tag, []);
                }
                this.taggedDecorations.get(tag)!.push(decoration);
            });
        }
        
        return decoration;
    }
    
    /**
     * Load decoration texture (uses preloaded textures)
     * Returns true if texture is available (loaded or loading), false if not found
     */
    private loadDecorationTexture(filename: string, decoration: Decoration): boolean {
        // Check texture cache first (should be preloaded)
        let cachedTexture = this.textureCache.get(filename);
        if (cachedTexture) {
            decoration.setupVisual(cachedTexture);
            return true;
        }

        // Try to find matching custom image
        const customUrl = this.findCustomImageUrl(filename);
        if (customUrl && !this.texturesLoading.has(filename)) {
            // Load now if not already loading
            console.log(`[DecorationManager] Loading texture for '${filename}' on demand`);
            this.loadTextureAsync(filename).then(() => {
                const texture = this.textureCache.get(filename);
                if (texture) {
                    console.log(`[DecorationManager] Applying texture to decoration '${decoration.config.id}'`);
                    decoration.setupVisual(texture);
                } else {
                    console.warn(`[DecorationManager] Texture load failed for '${filename}', disposing decoration`);
                    decoration.dispose();
                    this.decorations.delete(decoration.config.id!);
                }
            });
            // Texture is loading, but we don't create decoration until it's loaded
            // Return false to indicate texture is not yet available
            return false;
        }

        // No image found at all, do not create decoration
        console.log(`[DecorationManager] No texture found for '${filename}', skipping decoration`);
        return false;

            }
    
    /**
     * Get or create cached placeholder texture
     */
    private getPlaceholderTexture(): THREE.Texture {
        if (!this.placeholderTexture) {
            this.placeholderTexture = this.createPlaceholderTexture();
        }
        return this.placeholderTexture;
    }
    
    /**
     * Create a placeholder texture
     */
    private createPlaceholderTexture(): THREE.Texture {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        
        // Checkerboard pattern
        const size = 8;
        for (let y = 0; y < 64; y += size) {
            for (let x = 0; x < 64; x += size) {
                ctx.fillStyle = ((x + y) / size) % 2 === 0 ? '#ff00ff' : '#000000';
                ctx.fillRect(x, y, size, size);
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }
    
    /**
     * Build decoration events timeline from actions
     */
    private buildDecorationEventsTimeline(): void {
        this.decorationEventsTimeline = [];
        
        const actions = this.levelData.actions;
        if (!actions || !Array.isArray(actions)) {
            console.log('[DecorationManager] No actions found');
            return;
        }
        
        let moveDecCount = 0;
        actions.forEach((action: any) => {
            if (action.eventType === 'MoveDecorations') {
                const floor = action.floor;
                const startTime = this.tileStartTimes[floor] || 0;
                const bpm = this.tileBPM[floor] || 100;
                const secPerBeat = 60 / bpm;
                
                const angleOffset = action.angleOffset || 0;
                const timeOffset = (angleOffset / 180) * secPerBeat;
                const eventTime = startTime + timeOffset;
                
                this.decorationEventsTimeline.push({
                    time: eventTime,
                    event: action
                });
                moveDecCount++;
            }
        });
        
        console.log('[DecorationManager] Found MoveDecorations events:', moveDecCount);
        
        // Sort by time
        this.decorationEventsTimeline.sort((a, b) => a.time - b.time);
    }
    
    /**
     * Register custom image URL
     * Note: Call preloadTextures() after registering all images
     */
    public registerCustomImage(filename: string, url: string): void {
        console.log('[DecorationManager] Registering custom image:', filename);
        this.customImages.set(filename, url);
        // Also store without path for flexible matching
        const baseName = this.getBaseName(filename);
        if (baseName !== filename) {
            this.customImages.set(baseName, url);
            console.log('[DecorationManager] Also registered as:', baseName);
        }
        // Clear any cached texture so it will be reloaded
        const existingTexture = this.textureCache.get(filename);
        if (existingTexture) {
            existingTexture.dispose();
            this.textureCache.delete(filename);
        }
        this.texturesLoaded.delete(filename);
    }

    /**
     * Get base name from filename (strip path)
     */
    private getBaseName(filename: string): string {
        const parts = filename.split(/[/\\]/);
        return parts[parts.length - 1];
    }
    
    /**
     * Try to find a matching custom image URL
     */
    private findCustomImageUrl(filename: string): string | undefined {
        // Try exact match first
        let url = this.customImages.get(filename);
        if (url) return url;
        
        // Try base name match
        const baseName = this.getBaseName(filename);
        url = this.customImages.get(baseName);
        if (url) return url;
        
        // Try to find any registered image that ends with this filename
        for (const [key, value] of this.customImages.entries()) {
            if (key.endsWith(filename) || filename.endsWith(key)) {
                return value;
            }
        }
        
        return undefined;
    }
    
    /**
     * Get list of registered custom images
     */
    public getCustomImages(): string[] {
        return Array.from(this.customImages.keys());
    }
    
    /**
     * Update all decorations
     */
    public update(
        elapsedTime: number,
        cameraPosition: THREE.Vector3,
        cameraRotation: number,
        cameraZoom: number
    ): void {
        // Cache time in seconds
        const timeInSeconds = elapsedTime / 1000;
        
        // Process MoveDecorations events
        this.processDecorationEvents(timeInSeconds);
        
        // Calculate visible bounds (with margin)
        const viewRange = 20 / cameraZoom; // Approximate visible range
        const margin = 5;
        const minX = cameraPosition.x - viewRange - margin;
        const maxX = cameraPosition.x + viewRange + margin;
        const minY = cameraPosition.y - viewRange - margin;
        const maxY = cameraPosition.y + viewRange + margin;
        
        // Update each decoration
        this.decorations.forEach((decoration) => {
            // Update animation (only if animating)
            if (decoration.config.animating) {
                decoration.updateAnimation(timeInSeconds);
            }
            
            // Update position with parallax
            decoration.updatePosition(
                cameraPosition,
                cameraRotation,
                cameraZoom,
                0
            );
            
            // Frustum culling - hide decorations outside visible area
            const pos = decoration.container.position;
            const isVisible = pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY;
            
            // Only update visibility if changed
            if (decoration.container.visible !== isVisible && decoration.config.visible) {
                decoration.container.visible = isVisible;
            }
        });
    }
    
    /**
     * Process MoveDecorations events
     */
    private processDecorationEvents(timeInSeconds: number): void {
        // Check if we need to reset
        if (this.lastDecorationEventIndex >= 0 && this.lastDecorationEventIndex < this.decorationEventsTimeline.length) {
            const lastEvent = this.decorationEventsTimeline[this.lastDecorationEventIndex];
            if (lastEvent && timeInSeconds < lastEvent.time) {
                // Reset - we went back in time
                this.resetDecorationAnimations();
                this.lastDecorationEventIndex = -1;
            }
        }
        
        // Process new events - with safety limit
        let safetyCounter = 0;
        const maxIterations = this.decorationEventsTimeline.length + 10;
        
        while (
            safetyCounter < maxIterations &&
            this.lastDecorationEventIndex + 1 < this.decorationEventsTimeline.length &&
            this.decorationEventsTimeline[this.lastDecorationEventIndex + 1].time <= timeInSeconds
        ) {
            this.lastDecorationEventIndex++;
            const entry = this.decorationEventsTimeline[this.lastDecorationEventIndex];
            if (entry) {
                this.processMoveDecorationsEvent(entry.event, timeInSeconds);
            }
            safetyCounter++;
        }
    }
    
    /**
     * Process a single MoveDecorations event
     */
    private processMoveDecorationsEvent(event: any, currentTime: number): void {
        const targetTag = event.tag || '';
        if (!targetTag) return;

        // Find decorations with matching tag
        const tags = targetTag.split(' ').filter((t: string) => t.length > 0);

        tags.forEach((tag: string) => {
            const decorations = this.taggedDecorations.get(tag);
            // 修复：装饰物查找失败处理 - 添加日志记录
            if (!decorations) {
                console.warn(`[DecorationManager] MoveDecorations: 未找到标签为 '${tag}' 的装饰物`);
                return;
            }

            decorations.forEach((decoration) => {
                // Calculate duration in seconds
                const floor = event.floor;
                const bpm = this.tileBPM[floor] || 100;
                const secPerBeat = 60 / bpm;
                const duration = (event.duration || 0) * secPerBeat;

                // Build target values (match ADOFAI ffxMoveDecorationsPlus.cs)
                const targetValues: Partial<DecorationConfig> = {};

                if (event.positionOffset !== undefined) {
                    const pos = this.parseVector2(event.positionOffset, [0, 0]);
                    // ADOFAI: this.targetPos = tileSize * vector2
                    targetValues.positionOffset = [pos[0] * this.tileSize, pos[1] * this.tileSize];
                }

                if (event.rotationOffset !== undefined) {
                    targetValues.rotationOffset = event.rotationOffset;
                }

                if (event.scale !== undefined) {
                    const scale = this.parseVector2(event.scale, [100, 100]);
                    // ADOFAI: this.targetScaleV2 = (Vector2)evnt.data["scale"] / 100f
                    targetValues.scale = [scale[0] / 100, scale[1] / 100];
                }

                if (event.color !== undefined) {
                    targetValues.color = event.color;
                }

                if (event.opacity !== undefined) {
                    // ADOFAI: this.targetOpacity = evnt.GetFloat("opacity") / 100f
                    targetValues.opacity = event.opacity / 100;
                }

                if (event.parallax !== undefined) {
                    const parallax = this.parseVector2(event.parallax, [100, 100]);
                    // ADOFAI: dec.parallax.multiplier = this.targetParallax / 100f
                    targetValues.parallax = [parallax[0] / 100, parallax[1] / 100];
                }

                if (event.parallaxOffset !== undefined) {
                    const po = this.parseVector2(event.parallaxOffset, [0, 0]);
                    // ADOFAI: this.targetParallaxOffset = tileSize * vector
                    targetValues.parallaxOffset = [po[0] * this.tileSize, po[1] * this.tileSize];
                }

                if (event.pivotOffset !== undefined) {
                    const piv = this.parseVector2(event.pivotOffset, [0, 0]);
                    // ADOFAI: this.targetPivot = tileSize * vector3
                    targetValues.pivotOffset = [piv[0] * this.tileSize, piv[1] * this.tileSize];
                }

                if (event.depth !== undefined) {
                    targetValues.depth = event.depth;
                }

                if (event.visible !== undefined) {
                    targetValues.visible = event.visible;
                }

                // Get placement type
                const movementType = this.parsePlacementType(event.relativeTo);

                // Start animation
                decoration.startAnimation(
                    targetValues,
                    duration,
                    event.ease || 'Linear',
                    currentTime,
                    movementType
                );
            });
        });
    }
    
    /**
     * Reset all decoration animations
     */
    private resetDecorationAnimations(): void {
        this.decorations.forEach((decoration) => {
            decoration.reset();
        });
    }
    
    /**
     * Reset all decorations to initial state
     */
    public reset(): void {
        this.decorations.forEach((decoration) => {
            decoration.reset();
        });
        this.lastDecorationEventIndex = -1;
    }
    
    /**
     * Clear all decorations
     */
    public clear(): void {
        this.decorations.forEach((decoration) => {
            decoration.dispose();
            this.container.remove(decoration.container);
        });
        
        this.decorations.clear();
        this.taggedDecorations.clear();
        this.floorDecorations.clear();
        this.decorationEventsTimeline = [];
        this.lastDecorationEventIndex = -1;
    }
    
    /**
     * Get decoration by tag
     */
    public getDecorationsByTag(tag: string): Decoration[] {
        return this.taggedDecorations.get(tag) || [];
    }
    
    /**
     * Get decoration by ID
     */
    public getDecoration(id: string): Decoration | undefined {
        return this.decorations.get(id);
    }
    
    /**
     * Parse vector2 value
     */
    private parseVector2(value: any, defaultValue: [number, number]): [number, number] {
        if (!value) return defaultValue;
        if (Array.isArray(value) && value.length >= 2) {
            return [Number(value[0]), Number(value[1])];
        }
        return defaultValue;
    }
    
    /**
     * Parse placement type
     */
    private parsePlacementType(value: any): DecPlacementType {
        if (!value) return DecPlacementType.Tile;
        switch (value) {
            case 'Tile':
            case DecPlacementType.Tile:
                return DecPlacementType.Tile;
            case 'Camera':
            case DecPlacementType.Camera:
                return DecPlacementType.Camera;
            case 'CameraAspect':
            case DecPlacementType.CameraAspect:
                return DecPlacementType.CameraAspect;
            case 'LastPosition':
            case DecPlacementType.LastPosition:
                return DecPlacementType.LastPosition;
            default:
                return DecPlacementType.Tile;
        }
    }
    
    /**
     * Dispose manager
     */
    public dispose(): void {
        this.clear();
        
        // Dispose textures
        this.textureCache.forEach((texture) => {
            texture.dispose();
        });
        this.textureCache.clear();
        
        // Dispose placeholder texture
        if (this.placeholderTexture) {
            this.placeholderTexture.dispose();
            this.placeholderTexture = null;
        }
        
        this.scene.remove(this.container);
    }
    
    /**
     * Set tile size for coordinate conversion
     */
    public setTileSize(size: number): void {
        this.tileSize = size;
    }
}

export default DecorationManager;
