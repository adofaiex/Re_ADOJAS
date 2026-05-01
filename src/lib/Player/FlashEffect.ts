/**
 * Flash Effect for Three.js
 * Creates a screen-wide color flash effect that transitions from startColor to endColor
 * Based on ADOFAI's ffxFlashPlus
 * 
 * Flash is rendered as an overlay on top of the scene using alpha blending.
 * BG flash renders first, then FG flash on top.
 */

import * as THREE from 'three';
import { EasingFunctions } from './Easing';

/**
 * Active flash transition
 */
interface FlashTransition {
    active: boolean;
    startTime: number;
    duration: number;
    startColor: THREE.Color;
    endColor: THREE.Color;
    startOpacity: number;
    endOpacity: number;
    ease: string;
}

/**
 * Flash Effect class
 * Manages flash transitions for both foreground and background layers
 */
export class FlashEffect {
    private enabled: boolean = true;
    
    // Flash transitions for FG and BG
    private fgTransition: FlashTransition;
    private bgTransition: FlashTransition;
    
    // Full-screen quads for rendering flash overlay
    private fgQuad: THREE.Mesh;
    private bgQuad: THREE.Mesh;
    private fgMaterial: THREE.MeshBasicMaterial;
    private bgMaterial: THREE.MeshBasicMaterial;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    
    constructor() {
        // Initialize FG transition
        this.fgTransition = {
            active: false,
            startTime: 0,
            duration: 0,
            startColor: new THREE.Color(1, 1, 1),
            endColor: new THREE.Color(0, 0, 0),
            startOpacity: 0,
            endOpacity: 0,
            ease: 'Linear'
        };
        
        // Initialize BG transition
        this.bgTransition = {
            active: false,
            startTime: 0,
            duration: 0,
            startColor: new THREE.Color(1, 1, 1),
            endColor: new THREE.Color(0, 0, 0),
            startOpacity: 0,
            endOpacity: 0,
            ease: 'Linear'
        };
        
        // Create flash materials with transparency
        this.fgMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false,
        });
        
        this.bgMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false,
        });
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // Full-screen quads
        const geometry = new THREE.PlaneGeometry(2, 2);
        
        // BG quad renders first (added first to scene)
        this.bgQuad = new THREE.Mesh(geometry, this.bgMaterial);
        this.bgQuad.position.z = -1;
        this.scene.add(this.bgQuad);
        
        // FG quad renders on top (added second to scene)
        this.fgQuad = new THREE.Mesh(geometry, this.fgMaterial);
        this.fgQuad.position.z = -0.5;
        this.scene.add(this.fgQuad);
    }
    
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
    
    getEnabled(): boolean {
        return this.enabled;
    }
    
    /**
     * Start a new flash effect
     * @param startTime Current time in seconds
     * @param duration Duration in seconds
     * @param startColor Start color (hex string)
     * @param endColor End color (hex string)
     * @param startOpacity Start opacity (0-1)
     * @param endOpacity End opacity (0-1)
     * @param ease Easing function name
     * @param plane 'FG' or 'BG'
     */
    startFlash(
        startTime: number,
        duration: number,
        startColor: string,
        endColor: string,
        startOpacity: number,
        endOpacity: number,
        ease: string,
        plane: 'FG' | 'BG'
    ): void {
        const transition = plane === 'FG' ? this.fgTransition : this.bgTransition;
        const material = plane === 'FG' ? this.fgMaterial : this.bgMaterial;
        
        transition.active = true;
        transition.startTime = startTime;
        transition.duration = duration;
        transition.startColor.set(this.normalizeHexColor(startColor));
        transition.endColor.set(this.normalizeHexColor(endColor));
        transition.startOpacity = startOpacity;
        transition.endOpacity = endOpacity;
        transition.ease = ease;
        
        // Immediately apply initial state
        material.color.copy(transition.startColor);
        material.opacity = transition.startOpacity;
    }
    
    /**
     * Normalize hex color (strip alpha if present)
     */
    private normalizeHexColor(hex: string): string {
        let result = hex.startsWith('#') ? hex.slice(1) : hex;
        // Handle 8-character hex (RRGGBBAA) - strip alpha channel
        if (result.length === 8) {
            result = result.slice(0, 6);
        }
        return '#' + result;
    }
    
    /**
     * Update a single transition and apply to material
     */
    private updateTransition(
        transition: FlashTransition,
        material: THREE.MeshBasicMaterial,
        currentTime: number
    ): boolean {
        if (!transition.active) {
            return false;
        }
        
        const elapsed = currentTime - transition.startTime;
        let t = transition.duration > 0 ? elapsed / transition.duration : 1;
        
        let finished = false;
        if (t >= 1) {
            t = 1;
            finished = true;
        } else if (t < 0) {
            t = 0;
        }
        
        // Apply easing
        const easeFunc = EasingFunctions[transition.ease] || EasingFunctions.Linear;
        const progress = easeFunc(t);
        
        // Interpolate color
        material.color.lerpColors(
            transition.startColor,
            transition.endColor,
            progress
        );
        
        // Interpolate opacity
        material.opacity = transition.startOpacity + (transition.endOpacity - transition.startOpacity) * progress;
        
        if (finished) {
            transition.active = false;
        }
        
        return !finished;
    }
    
    /**
     * Check if any flash effect is active
     */
    isActive(): boolean {
        return this.fgTransition.active || this.bgTransition.active;
    }
    
    /**
     * Check if FG flash is active
     */
    isFGActive(): boolean {
        return this.fgTransition.active;
    }
    
    /**
     * Check if BG flash is active
     */
    isBGActive(): boolean {
        return this.bgTransition.active;
    }
    
    /**
     * Render flash overlay on top of the scene
     * This should be called after rendering the main scene
     * Uses alpha blending: flash overlays on top of existing content
     */
    renderFlash(
        renderer: THREE.WebGLRenderer,
        currentTime: number
    ): void {
        if (!this.enabled) return;
        
        // Update transitions
        const fgActive = this.updateTransition(this.fgTransition, this.fgMaterial, currentTime);
        const bgActive = this.updateTransition(this.bgTransition, this.bgMaterial, currentTime);
        
        // Check if any flash is visible
        const fgVisible = this.fgMaterial.opacity > 0.001;
        const bgVisible = this.bgMaterial.opacity > 0.001;
        
        if (!fgVisible && !bgVisible) {
            return;
        }
        
        // Disable auto clear and clear depth for overlay rendering
        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.clearDepth();
        
        // Render flash overlay(s)
        renderer.render(this.scene, this.camera);
        
        renderer.autoClear = oldAutoClear;
    }
    
    /**
     * Get current FG flash opacity
     */
    getFGOpacity(): number {
        return this.fgMaterial.opacity;
    }
    
    /**
     * Get current BG flash opacity
     */
    getBGOpacity(): number {
        return this.bgMaterial.opacity;
    }
    
    /**
     * Stop all flash effects
     */
    stop(): void {
        this.fgTransition.active = false;
        this.bgTransition.active = false;
        this.fgMaterial.opacity = 0;
        this.bgMaterial.opacity = 0;
    }
    
    /**
     * Reset to default state
     */
    reset(): void {
        this.stop();
        this.fgTransition.startColor.set(1, 1, 1);
        this.fgTransition.endColor.set(0, 0, 0);
        this.fgTransition.startOpacity = 0;
        this.fgTransition.endOpacity = 0;
        this.bgTransition.startColor.set(1, 1, 1);
        this.bgTransition.endColor.set(0, 0, 0);
        this.bgTransition.startOpacity = 0;
        this.bgTransition.endOpacity = 0;
        this.fgMaterial.color.set(1, 1, 1);
        this.bgMaterial.color.set(1, 1, 1);
    }
    
    setSize(width: number, height: number): void {
        // No render targets needed, just full-screen quads
    }
    
    dispose(): void {
        this.fgMaterial.dispose();
        this.bgMaterial.dispose();
        this.fgQuad.geometry.dispose();
        this.bgQuad.geometry.dispose();
    }
}

export default FlashEffect;
