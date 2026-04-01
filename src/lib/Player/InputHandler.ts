import * as THREE from 'three';

/**
 * Interface for input event callbacks
 */
export interface InputHandlerCallbacks {
    onCameraMove: (deltaX: number, deltaY: number) => void;
    onZoom: (zoomDelta: number) => void;
}

/**
 * Manages mouse and touch input for camera control
 * Separated from Player class for better code organization
 */
export class InputHandler {
    private container: HTMLElement | null = null;
    private callbacks: InputHandlerCallbacks;
    
    // Mouse state
    private isDragging: boolean = false;
    private previousMousePosition: { x: number; y: number } = { x: 0, y: 0 };
    
    // Touch state
    private initialPinchDistance: number = 0;
    private initialZoom: number = 0;
    private isTouchDragging: boolean = false;
    private lastTouchPosition: { x: number; y: number } = { x: 0, y: 0 };
    
    // Bound handlers for cleanup
    private boundHandlers: { [key: string]: EventListenerOrEventListenerObject } = {};
    
    // Settings
    private zoomSpeed: number = 0.1;
    private enabled: boolean = true;
    
    constructor(callbacks: InputHandlerCallbacks) {
        this.callbacks = callbacks;
    }
    
    /**
     * Attach input handlers to a container element
     */
    public attach(container: HTMLElement): void {
        this.container = container;
        
        // Create bound handlers
        this.boundHandlers = {
            mousedown: this.onMouseDown.bind(this) as EventListener,
            mousemove: this.onMouseMove.bind(this) as EventListener,
            mouseup: this.onMouseUp.bind(this) as EventListener,
            mouseleave: this.onMouseUp.bind(this) as EventListener,
            wheel: this.onWheel.bind(this) as EventListener,
            touchstart: this.onTouchStart.bind(this) as EventListener,
            touchmove: this.onTouchMove.bind(this) as EventListener,
            touchend: this.onTouchEnd.bind(this) as EventListener,
            contextmenu: ((e: Event) => e.preventDefault()) as EventListener
        };
        
        // Attach event listeners
        container.addEventListener('mousedown', this.boundHandlers.mousedown);
        container.addEventListener('mousemove', this.boundHandlers.mousemove);
        container.addEventListener('mouseup', this.boundHandlers.mouseup);
        container.addEventListener('mouseleave', this.boundHandlers.mouseleave);
        container.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
        container.addEventListener('touchstart', this.boundHandlers.touchstart, { passive: false });
        container.addEventListener('touchmove', this.boundHandlers.touchmove, { passive: false });
        container.addEventListener('touchend', this.boundHandlers.touchend);
        container.addEventListener('contextmenu', this.boundHandlers.contextmenu);
    }
    
    /**
     * Detach input handlers from container
     */
    public detach(): void {
        if (!this.container) return;
        
        this.container.removeEventListener('mousedown', this.boundHandlers.mousedown);
        this.container.removeEventListener('mousemove', this.boundHandlers.mousemove);
        this.container.removeEventListener('mouseup', this.boundHandlers.mouseup);
        this.container.removeEventListener('mouseleave', this.boundHandlers.mouseleave);
        this.container.removeEventListener('wheel', this.boundHandlers.wheel);
        this.container.removeEventListener('touchstart', this.boundHandlers.touchstart);
        this.container.removeEventListener('touchmove', this.boundHandlers.touchmove);
        this.container.removeEventListener('touchend', this.boundHandlers.touchend);
        this.container.removeEventListener('contextmenu', this.boundHandlers.contextmenu);
        
        this.container = null;
        this.boundHandlers = {};
    }
    
    /**
     * Enable/disable input handling
     */
    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
    
    /**
     * Set zoom speed multiplier
     */
    public setZoomSpeed(speed: number): void {
        this.zoomSpeed = speed;
    }
    
    /**
     * Check if currently dragging
     */
    public isDraggingNow(): boolean {
        return this.isDragging || this.isTouchDragging;
    }
    
    // === Mouse Event Handlers ===
    
    private onMouseDown(event: MouseEvent): void {
        if (!this.enabled) return;
        
        if (event.button === 0) { // Left click
            this.isDragging = true;
            this.previousMousePosition = { x: event.clientX, y: event.clientY };
        }
    }
    
    private onMouseMove(event: MouseEvent): void {
        if (!this.enabled || !this.isDragging) return;
        
        const deltaX = event.clientX - this.previousMousePosition.x;
        const deltaY = event.clientY - this.previousMousePosition.y;
        
        this.callbacks.onCameraMove(deltaX, deltaY);
        
        this.previousMousePosition = { x: event.clientX, y: event.clientY };
    }
    
    private onMouseUp(): void {
        this.isDragging = false;
    }
    
    private onWheel(event: WheelEvent): void {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        const zoomDelta = event.deltaY > 0 ? -this.zoomSpeed : this.zoomSpeed;
        this.callbacks.onZoom(zoomDelta);
    }
    
    // === Touch Event Handlers ===
    
    private onTouchStart(event: TouchEvent): void {
        if (!this.enabled) return;
        
        if (event.touches.length === 1) {
            // Single touch - drag
            this.isTouchDragging = true;
            this.lastTouchPosition = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            };
        } else if (event.touches.length === 2) {
            // Pinch gesture
            this.isTouchDragging = false;
            this.initialPinchDistance = this.getPinchDistance(event.touches);
        }
    }
    
    private onTouchMove(event: TouchEvent): void {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        if (event.touches.length === 1 && this.isTouchDragging) {
            // Single touch drag
            const touch = event.touches[0];
            const deltaX = touch.clientX - this.lastTouchPosition.x;
            const deltaY = touch.clientY - this.lastTouchPosition.y;
            
            this.callbacks.onCameraMove(deltaX, deltaY);
            
            this.lastTouchPosition = { x: touch.clientX, y: touch.clientY };
        } else if (event.touches.length === 2) {
            // Pinch zoom
            const currentDistance = this.getPinchDistance(event.touches);
            if (this.initialPinchDistance > 0) {
                const scale = currentDistance / this.initialPinchDistance;
                const zoomDelta = (scale - 1) * 0.5; // Scale factor to zoom delta
                this.callbacks.onZoom(zoomDelta);
            }
        }
    }
    
    private onTouchEnd(): void {
        this.isTouchDragging = false;
        this.initialPinchDistance = 0;
    }
    
    private getPinchDistance(touches: TouchList): number {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Dispose input handler
     */
    public dispose(): void {
        this.detach();
    }
}
