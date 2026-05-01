import * as THREE from 'three';
import { EasingFunctions } from './Easing';

/**
 * Decoration placement type - where decoration is positioned relative to
 */
export enum DecPlacementType {
    Tile = 'Tile',
    Camera = 'Camera',
    CameraAspect = 'CameraAspect',
    LastPosition = 'LastPosition'
}

/**
 * Decoration types
 */
export enum DecorationType {
    Image = 'Image',
    Text = 'Text',
    Particle = 'Particle',
    Object = 'Object',
    Prefab = 'Prefab'
}

/**
 * Decoration configuration from AddDecoration event
 */
export interface DecorationConfig {
    // Identification
    id?: string;
    tag: string;
    
    // Image/Visual
    decorationImage: string;
    
    // Position
    position: [number, number];
    positionOffset: [number, number];
    relativeTo: DecPlacementType;
    
    // Transform
    rotation: number;
    rotationOffset: number;
    scale: [number, number];
    
    // Visual effects
    parallax: [number, number];
    parallaxOffset: [number, number];
    pivotOffset: [number, number];
    depth: number;
    color: string;
    opacity: number;
    
    // Camera lock settings
    lockScale: boolean;    // If true, decoration scales inversely with camera zoom
    lockRotation: boolean; // If true, decoration rotates with camera
    
    // State
    visible: boolean;
    
    // Animation state (for MoveDecorations)
    animating: boolean;
    animationStart: number;
    animationDuration: number;
    animationStartValues: Partial<DecorationConfig>;
    animationTargetValues: Partial<DecorationConfig>;
    animationEase: string;
    
    // Floor attachment
    floor?: number;
    parentFloorNum?: number;
}

/**
 * Default decoration config
 */
export const defaultDecorationConfig: DecorationConfig = {
    tag: '',
    decorationImage: '',
    position: [0, 0],
    positionOffset: [0, 0],
    relativeTo: DecPlacementType.Tile,
    rotation: 0,
    rotationOffset: 0,
    scale: [100, 100],
    parallax: [100, 100],
    parallaxOffset: [0, 0],
    pivotOffset: [0, 0],
    depth: 0,
    color: 'ffffff',
    opacity: 100,
    lockScale: false,
    lockRotation: false,
    visible: true,
    animating: false,
    animationStart: 0,
    animationDuration: 0,
    animationStartValues: {},
    animationTargetValues: {},
    animationEase: 'Linear'
};

/**
 * Individual decoration instance
 */
export class Decoration {
    public config: DecorationConfig;
    public mesh: THREE.Mesh | null = null;
    public sprite: THREE.Sprite | null = null;
    public container: THREE.Group;
    
    // Current animated values
    public currentScale: THREE.Vector2;
    public currentRotation: number;
    public currentColor: THREE.Color;
    public currentOpacity: number;
    public currentPosition: THREE.Vector2;
    public currentParallax: THREE.Vector2;
    public currentParallaxOffset: THREE.Vector2;
    
    // Start position (for Tile-relative positioning)
    public startPos: THREE.Vector2 = new THREE.Vector2(0, 0);
    public pivotPos: THREE.Vector2 = new THREE.Vector2(0, 0);
    
    // Cached colors for animation (avoid allocation per frame)
    private animStartColor: THREE.Color = new THREE.Color();
    private animTargetColor: THREE.Color = new THREE.Color();
    
    // Animation tweens
    private activeTweens: Map<string, { start: number; end: number; startTime: number; duration: number; ease: string }> = new Map();
    
    constructor(config: Partial<DecorationConfig>) {
        this.config = { ...defaultDecorationConfig, ...config };
        
        this.container = new THREE.Group();
        this.container.name = `decoration_${this.config.tag || 'untagged'}`;
        
        // Initialize current values
        this.currentScale = new THREE.Vector2(
            this.config.scale[0] / 100,
            this.config.scale[1] / 100
        );
        this.currentRotation = this.config.rotation + this.config.rotationOffset;
        this.currentColor = new THREE.Color(this.formatHexColor(this.config.color));
        this.currentOpacity = this.config.opacity / 100;
        this.currentPosition = new THREE.Vector2(
            this.config.position[0],
            this.config.position[1]
        );
        this.currentParallax = new THREE.Vector2(
            this.config.parallax[0] / 100,
            this.config.parallax[1] / 100
        );
        this.currentParallaxOffset = new THREE.Vector2(
            this.config.parallaxOffset[0],
            this.config.parallaxOffset[1]
        );
    }
    
    /**
     * Format hex color (add # if needed)
     */
    private formatHexColor(hex: string): string {
        if (!hex) return '#ffffff';
        return hex.startsWith('#') ? hex : `#${hex}`;
    }
    
    /**
     * Set up the decoration mesh/sprite
     */
    public setupVisual(texture: THREE.Texture | null): void {
        // Clear previous visual
        if (this.mesh) {
            this.container.remove(this.mesh);
            this.mesh.geometry.dispose();
            (this.mesh.material as THREE.Material).dispose();
            this.mesh = null;
        }
        if (this.sprite) {
            this.container.remove(this.sprite);
            (this.sprite.material as THREE.Material).dispose();
            this.sprite = null;
        }
        
        if (!texture) {
            // Create a placeholder mesh
            const geometry = new THREE.PlaneGeometry(1, 1);
            const material = new THREE.MeshBasicMaterial({
                color: 0xff00ff, // Magenta for visibility
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide
            });
            this.mesh = new THREE.Mesh(geometry, material);
            this.container.add(this.mesh);
        } else {
            // Use sprite for billboarding
            const material = new THREE.SpriteMaterial({
                map: texture,
                color: 0xffffff, // White to show texture colors correctly
                transparent: true,
                opacity: this.currentOpacity
            });
            this.sprite = new THREE.Sprite(material);
            
            // Set sprite scale based on texture aspect ratio
            // Use 1:1 if image data not yet available (will be updated when loaded)
            let aspectRatio = 1;
            if (texture.image && texture.image.width && texture.image.height) {
                aspectRatio = texture.image.width / texture.image.height;
            }
            
            // Sprite base scale - container scale will be applied on top
            // Scale sprite to maintain aspect ratio
            const baseSize = 1;
            if (aspectRatio >= 1) {
                this.sprite.scale.set(aspectRatio * baseSize, baseSize, 1);
            } else {
                this.sprite.scale.set(baseSize, baseSize / aspectRatio, 1);
            }
            
            // Set center to center
            this.sprite.center.set(0.5, 0.5);
            
            this.container.add(this.sprite);
        }
        
        this.updateTransform();
    }
    
    /**
     * Update transform based on current values
     * Note: scale is handled in updatePosition() to support lockScale
     */
    public updateTransform(): void {
        // Don't set scale here - it's handled in updatePosition() for lockScale support
        // Rotation is also handled in updatePosition() for lockRotation support
        this.container.rotation.z = this.currentRotation * (Math.PI / 180);
        
        // Depth system:
        // depth = -1: Highest layer (above planets), z = 0.2
        // depth = 0: Track level, below planets, z = -0.1
        // depth >= 1: Background layers, z = -0.5 - depth * 0.5
        const depth = this.config.depth;
        let zPos: number;
        let renderOrder: number;
        
        if (depth < 0) {
            // Above everything (highest priority)
            zPos = 0.2 + depth * 0.1; // -1 -> 0.1, -2 -> 0.0
            renderOrder = 200 + depth; // -1 -> 199, very high
        } else if (depth === 0) {
            // Track level, below planets
            zPos = -0.1;
            renderOrder = 0; // Same as tiles
        } else {
            // Background layers (depth >= 1)
            zPos = -0.5 - depth * 0.5;
            renderOrder = -depth * 10; // Lower render order for background
        }
        
        this.container.position.set(this.currentPosition.x, this.currentPosition.y, zPos);
        
        // Update render order for sprites/meshes
        if (this.mesh) {
            this.mesh.renderOrder = renderOrder;
            const mat = this.mesh.material as THREE.MeshBasicMaterial;
            mat.color.copy(this.currentColor);
            mat.opacity = this.currentOpacity;
        }
        if (this.sprite) {
            this.sprite.renderOrder = renderOrder;
            const mat = this.sprite.material as THREE.SpriteMaterial;
            mat.opacity = this.currentOpacity;
        }
    }
    
    /**
     * Update position based on camera and parent floor
     */
    public updatePosition(
        cameraPosition: THREE.Vector3,
        cameraRotation: number,
        cameraZoom: number,
        deltaTime: number
    ): void {
        const config = this.config;
        
        // Handle lockScale: decoration maintains constant screen size
        // Official: camScaleMultiplier = lockScale ? (orthographicSize * 0.2 / (camZoom / 100)) : 1
        // In Three.js, higher zoom = things appear larger, so we need inverse scale
        let scaleMultiplier = 1;
        if (config.lockScale && cameraZoom > 0) {
            // Base zoom is typically 100, scale inversely with zoom
            // This makes the decoration appear the same size regardless of camera zoom
            scaleMultiplier = 100 / cameraZoom;
        }
        
        // Handle different placement types
        if (config.relativeTo === DecPlacementType.Camera || config.relativeTo === DecPlacementType.CameraAspect) {
            // Position relative to camera center - use position directly as offset from camera
            this.container.position.x = cameraPosition.x + this.config.position[0];
            this.container.position.y = cameraPosition.y + this.config.position[1];
            
            // Handle lock rotation for Camera-relative decorations
            if (config.lockRotation) {
                this.container.rotation.z = cameraRotation + this.currentRotation * (Math.PI / 180);
            } else {
                this.container.rotation.z = this.currentRotation * (Math.PI / 180);
            }
        } else {
            // Tile-relative or LastPosition - use currentPosition which was set during init
            // Apply parallax (reuse existing vectors to avoid allocation)
            const px = (cameraPosition.x - this.pivotPos.x) * this.currentParallax.x;
            const py = (cameraPosition.y - this.pivotPos.y) * this.currentParallax.y;
            
            this.container.position.x = this.currentPosition.x + px + this.currentParallaxOffset.x;
            this.container.position.y = this.currentPosition.y + py + this.currentParallaxOffset.y;
            
            // Handle lock rotation for Tile-relative decorations
            if (config.lockRotation) {
                this.container.rotation.z = cameraRotation + this.currentRotation * (Math.PI / 180);
            } else {
                this.container.rotation.z = this.currentRotation * (Math.PI / 180);
            }
        }
        
        // Apply lockScale multiplier to container scale
        this.container.scale.set(
            this.currentScale.x * scaleMultiplier,
            this.currentScale.y * scaleMultiplier,
            1
        );
    }
    
    /**
     * Update animation
     */
    public updateAnimation(currentTime: number): void {
        if (!this.config.animating) return;
        
        const elapsed = currentTime - this.config.animationStart;
        const duration = this.config.animationDuration;
        
        // Safety check for invalid duration
        if (duration <= 0) {
            this.config.animating = false;
            return;
        }
        
        if (elapsed >= duration) {
            // Animation complete
            this.config.animating = false;
            this.applyTargetValues();
            return;
        }
        
        // Calculate progress (clamped to 0-1)
        const progress = Math.max(0, Math.min(1, elapsed / duration));
        const ease = EasingFunctions[this.config.animationEase] || EasingFunctions.Linear;
        const easedProgress = ease(progress);
        
        // Interpolate values
        const start = this.config.animationStartValues;
        const target = this.config.animationTargetValues;
        
        if (start.positionOffset && target.positionOffset) {
            // Position offset now stores absolute positions (startPos + targetOffset)
            // Interpolate between start and target positions directly
            this.currentPosition.x = start.positionOffset[0] + 
                (target.positionOffset[0] - start.positionOffset[0]) * easedProgress;
            this.currentPosition.y = start.positionOffset[1] + 
                (target.positionOffset[1] - start.positionOffset[1]) * easedProgress;
            
            // Update pivot to track current position for parallax calculation
            this.pivotPos.x = this.currentPosition.x;
            this.pivotPos.y = this.currentPosition.y;
        }
        
        if (start.rotationOffset !== undefined && target.rotationOffset !== undefined) {
            this.currentRotation = this.config.rotation + start.rotationOffset + 
                (target.rotationOffset - start.rotationOffset) * easedProgress;
        }
        
        if (start.scale && target.scale) {
            this.currentScale.x = (start.scale[0] + (target.scale[0] - start.scale[0]) * easedProgress) / 100;
            this.currentScale.y = (start.scale[1] + (target.scale[1] - start.scale[1]) * easedProgress) / 100;
        }
        
        if (start.opacity !== undefined && target.opacity !== undefined) {
            this.currentOpacity = (start.opacity + (target.opacity - start.opacity) * easedProgress) / 100;
        }
        
        if (start.color && target.color) {
            // Use cached color objects to avoid allocation
            this.animStartColor.set(this.formatHexColor(start.color));
            this.animTargetColor.set(this.formatHexColor(target.color));
            this.currentColor.lerpColors(this.animStartColor, this.animTargetColor, easedProgress);
        }
        
        if (start.parallax && target.parallax) {
            this.currentParallax.x = (start.parallax[0] + (target.parallax[0] - start.parallax[0]) * easedProgress) / 100;
            this.currentParallax.y = (start.parallax[1] + (target.parallax[1] - start.parallax[1]) * easedProgress) / 100;
        }
        
        if (start.parallaxOffset && target.parallaxOffset) {
            this.currentParallaxOffset.x = start.parallaxOffset[0] + 
                (target.parallaxOffset[0] - start.parallaxOffset[0]) * easedProgress;
            this.currentParallaxOffset.y = start.parallaxOffset[1] + 
                (target.parallaxOffset[1] - start.parallaxOffset[1]) * easedProgress;
        }
        
        this.updateTransform();
    }
    
    /**
     * Apply target values at end of animation
     */
    private applyTargetValues(): void {
        const target = this.config.animationTargetValues;
        
        if (target.positionOffset) {
            // Position offset now stores absolute target position
            this.currentPosition.x = target.positionOffset[0];
            this.currentPosition.y = target.positionOffset[1];
            
            // Update pivot to track current position for parallax calculation
            this.pivotPos.x = this.currentPosition.x;
            this.pivotPos.y = this.currentPosition.y;
        }
        if (target.rotationOffset !== undefined) {
            this.currentRotation = this.config.rotation + target.rotationOffset;
        }
        if (target.scale) {
            this.currentScale.x = target.scale[0] / 100;
            this.currentScale.y = target.scale[1] / 100;
        }
        if (target.opacity !== undefined) {
            this.currentOpacity = target.opacity / 100;
        }
        if (target.color) {
            this.currentColor.set(this.formatHexColor(target.color));
        }
        if (target.parallax) {
            this.currentParallax.x = target.parallax[0] / 100;
            this.currentParallax.y = target.parallax[1] / 100;
        }
        if (target.parallaxOffset) {
            this.currentParallaxOffset.x = target.parallaxOffset[0];
            this.currentParallaxOffset.y = target.parallaxOffset[1];
        }
        if (target.depth !== undefined) {
            this.config.depth = target.depth;
        }
        if (target.visible !== undefined) {
            this.config.visible = target.visible;
            this.container.visible = target.visible;
        }
        
        this.updateTransform();
    }
    
    /**
     * Start animation from MoveDecorations event
     * 
     * Based on official ADOFAI source (ffxMoveDecorationsPlus.cs):
     * - movementType determines start position:
     *   - LastPosition: animate from current position (pivotPosVec)
     *   - Other types: animate from initial position (startPos)
     * - Target position = startPos + targetPos (relative offset added to start)
     */
    public startAnimation(
        targetValues: Partial<DecorationConfig>,
        duration: number,
        ease: string,
        startTime: number,
        movementType: DecPlacementType = DecPlacementType.LastPosition
    ): void {
        // 修复：中断旧动画策略
        // 如果装饰物已在动画中，立即完成旧动画到其目标值
        // 这样可以避免快速连续事件导致的跳跃
        if (this.config.animating) {
            this.applyTargetValues();
            this.config.animating = false;
        }

        // Determine start position based on movementType
        // Official: Vector2 startPos = ((this.movementType == DecPlacementType.LastPosition) ? dec.pivotPosVec : dec.startPos);
        const animationStartPos = movementType === DecPlacementType.LastPosition
            ? new THREE.Vector2(this.currentPosition.x, this.currentPosition.y)
            : new THREE.Vector2(this.startPos.x, this.startPos.y);

        // Store start values (current state)
        this.config.animationStartValues = {
            positionOffset: [animationStartPos.x, animationStartPos.y],
            rotationOffset: this.currentRotation - this.config.rotation,
            scale: [this.currentScale.x * 100, this.currentScale.y * 100],
            color: this.config.color,
            opacity: this.currentOpacity * 100,
            parallax: [this.currentParallax.x * 100, this.currentParallax.y * 100],
            parallaxOffset: [this.currentParallaxOffset.x, this.currentParallaxOffset.y],
            depth: this.config.depth,
            visible: this.config.visible
        };

        // Store target values
        // For position, we need to calculate final target position
        // Official: startPos + this.targetPos (where targetPos is positionOffset * tileSize)
        this.config.animationTargetValues = { ...targetValues };

        // If positionOffset is provided, calculate the actual target position
        // The target is: animationStartPos + positionOffset (already includes tileSize in DecorationManager)
        if (targetValues.positionOffset) {
            this.config.animationTargetValues.positionOffset = [
                animationStartPos.x + targetValues.positionOffset[0],
                animationStartPos.y + targetValues.positionOffset[1]
            ];
        }

        // Set animation state
        this.config.animating = true;
        this.config.animationStart = startTime;
        this.config.animationDuration = duration;
        this.config.animationEase = ease;
    }
    
    /**
     * Reset decoration to initial state
     */
    public reset(): void {
        this.config.animating = false;
        this.config.animationStartValues = {};
        this.config.animationTargetValues = {};
        
        this.currentScale.set(this.config.scale[0] / 100, this.config.scale[1] / 100);
        this.currentRotation = this.config.rotation + this.config.rotationOffset;
        this.currentColor.set(this.formatHexColor(this.config.color));
        this.currentOpacity = this.config.opacity / 100;
        
        // Reset position to startPos (initial position set during creation)
        // startPos is the original position calculated in DecorationManager
        this.currentPosition.copy(this.startPos);
        
        // Reset pivot to startPos for parallax calculation
        this.pivotPos.copy(this.startPos);
        
        this.currentParallax.set(this.config.parallax[0] / 100, this.config.parallax[1] / 100);
        this.currentParallaxOffset.set(this.config.parallaxOffset[0], this.config.parallaxOffset[1]);
        
        this.container.visible = this.config.visible;
        this.updateTransform();
    }
    
    /**
     * Set visibility
     */
    public setVisible(visible: boolean): void {
        this.config.visible = visible;
        this.container.visible = visible;
    }
    
    /**
     * Set depth (z-order)
     */
    public setDepth(depth: number): void {
        this.config.depth = depth;
        this.updateTransform();
    }
    
    /**
     * Dispose resources
     */
    public dispose(): void {
        if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) {
                (this.mesh.material as THREE.Material).dispose();
            }
        }
        if (this.sprite) {
            if (this.sprite.material) {
                (this.sprite.material as THREE.Material).dispose();
            }
        }
        this.activeTweens.clear();
    }
}

export default Decoration;
