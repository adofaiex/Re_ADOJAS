import * as THREE from 'three';

/**
 * Manages video background playback and synchronization
 * Separated from Player class for better code organization
 */
export class VideoBackground {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    
    // Video elements
    private videoElement: HTMLVideoElement | null = null;
    private videoTexture: THREE.VideoTexture | null = null;
    private videoMesh: THREE.Mesh | null = null;
    private videoOffset: number = 0; // ms
    
    // Playback state
    private isPlaying: boolean = false;
    private lastSyncTime: number = 0;
    
    constructor(scene: THREE.Scene, camera: THREE.Camera) {
        this.scene = scene;
        this.camera = camera;
    }
    
    /**
     * Load a video file as background
     */
    public load(src: string, offset: number = 0): void {
        this.dispose();
        
        this.videoOffset = offset;
        this.videoElement = new HTMLVideoElement();
        this.videoElement.src = src;
        this.videoElement.loop = true;
        this.videoElement.muted = true;
        this.videoElement.playsInline = true;
        this.videoElement.preload = 'auto';
        
        // Create video texture
        this.videoTexture = new THREE.VideoTexture(this.videoElement);
        this.videoTexture.minFilter = THREE.LinearFilter;
        this.videoTexture.magFilter = THREE.LinearFilter;
        
        // Create video mesh
        const geometry = new THREE.PlaneGeometry(16, 9); // Default aspect ratio
        const material = new THREE.MeshBasicMaterial({
            map: this.videoTexture,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false
        });
        
        this.videoMesh = new THREE.Mesh(geometry, material);
        this.videoMesh.position.z = -100; // Behind everything
        this.videoMesh.renderOrder = -1;
        
        this.scene.add(this.videoMesh);
        this.updateVideoSize();
    }
    
    /**
     * Set video offset in milliseconds
     */
    public setOffset(offset: number): void {
        this.videoOffset = offset;
    }
    
    /**
     * Start video playback
     */
    public play(): void {
        if (this.videoElement && this.videoElement.paused) {
            this.videoElement.play().catch(e => console.warn('Video play failed:', e));
            this.isPlaying = true;
        }
    }
    
    /**
     * Pause video playback
     */
    public pause(): void {
        if (this.videoElement && !this.videoElement.paused) {
            this.videoElement.pause();
            this.isPlaying = false;
        }
    }
    
    /**
     * Stop video playback and reset
     */
    public stop(): void {
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.currentTime = 0;
            this.isPlaying = false;
        }
    }
    
    /**
     * Seek video to specific time
     */
    public seek(time: number): void {
        if (this.videoElement) {
            this.videoElement.currentTime = Math.max(0, time);
        }
    }
    
    /**
     * Sync video with playback time
     * @param elapsedTime Current elapsed time in ms
     * @param countdownDuration Countdown duration in seconds
     */
    public sync(elapsedTime: number, countdownDuration: number): void {
        if (!this.videoElement || !this.isPlaying) return;
        
        // Only sync every 100ms to avoid performance issues
        const now = performance.now();
        if (now - this.lastSyncTime < 100) return;
        this.lastSyncTime = now;
        
        const currentTimeInSeconds = elapsedTime / 1000;
        const videoTime = currentTimeInSeconds - countdownDuration + this.videoOffset / 1000;
        
        // Only seek if significantly out of sync (> 0.5 seconds)
        if (Math.abs(this.videoElement.currentTime - videoTime) > 0.5) {
            this.videoElement.currentTime = Math.max(0, videoTime);
        }
    }
    
    /**
     * Update video size based on camera
     */
    public updateVideoSize(): void {
        if (!this.videoElement || !this.videoMesh) return;
        
        const videoWidth = this.videoElement.videoWidth || 16;
        const videoHeight = this.videoElement.videoHeight || 9;
        const videoAspect = videoWidth / videoHeight;
        
        // Get camera frustum size (assuming OrthographicCamera)
        const orthoCamera = this.camera as THREE.OrthographicCamera;
        const camZoom = orthoCamera.zoom || 1;
        const frustumHeight = (orthoCamera.top - orthoCamera.bottom) / camZoom;
        const frustumWidth = (orthoCamera.right - orthoCamera.left) / camZoom;
        const frustumAspect = frustumWidth / frustumHeight;
        
        // Scale to cover the viewport
        let scale: number;
        if (frustumAspect > videoAspect) {
            scale = frustumWidth / 16;
        } else {
            scale = frustumHeight / 9;
        }
        
        // Adjust mesh scale to maintain aspect ratio
        this.videoMesh.scale.set(
            scale * videoAspect,
            scale,
            1
        );
    }
    
    /**
     * Update video mesh position to follow camera
     */
    public updatePosition(cameraX: number, cameraY: number, cameraRotation: number): void {
        if (this.videoMesh) {
            this.videoMesh.position.x = cameraX;
            this.videoMesh.position.y = cameraY;
            this.videoMesh.rotation.z = cameraRotation;
        }
    }
    
    /**
     * Check if video is loaded
     */
    public isLoaded(): boolean {
        return this.videoElement !== null && this.videoElement.readyState >= 2;
    }
    
    /**
     * Check if video is playing
     */
    public isVideoPlaying(): boolean {
        return this.isPlaying && this.videoElement !== null && !this.videoElement.paused;
    }
    
    /**
     * Get video duration
     */
    public getDuration(): number {
        return this.videoElement?.duration || 0;
    }
    
    /**
     * Get current video time
     */
    public getCurrentTime(): number {
        return this.videoElement?.currentTime || 0;
    }
    
    /**
     * Dispose video resources
     */
    public dispose(): void {
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.src = '';
            this.videoElement.load();
            this.videoElement = null;
        }
        
        if (this.videoTexture) {
            this.videoTexture.dispose();
            this.videoTexture = null;
        }
        
        if (this.videoMesh) {
            this.scene.remove(this.videoMesh);
            if (this.videoMesh.geometry) {
                this.videoMesh.geometry.dispose();
            }
            if (this.videoMesh.material instanceof THREE.Material) {
                this.videoMesh.material.dispose();
            }
            this.videoMesh = null;
        }
        
        this.isPlaying = false;
    }
}
