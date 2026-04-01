import * as THREE from 'three';
import { BloomEffect } from './BloomEffect';
import { FlashEffect } from './FlashEffect';
import { TileColorManager } from './TileColorManager';

/**
 * Timeline entry for events
 */
export interface TimelineEntry {
    time: number;
    event: any;
}

/**
 * Manages visual effects (Bloom, Flash, Recolor, CustomBG)
 * These effects are triggered at specific times during playback.
 * Separated from Player class for better code organization.
 */
export class EffectsManager {
    private scene: THREE.Scene;
    private tileColorManager: TileColorManager;
    private updateTileColor: (index: number, color: string, bgcolor: string) => void;
    
    // Bloom Effect
    private bloomEffect: BloomEffect | null = null;
    private bloomEnabled: boolean = false;
    private bloomTimeline: TimelineEntry[] = [];
    private lastBloomTimelineIndex: number = -1;
    
    // Flash Effect
    private flashEffect: FlashEffect | null = null;
    private flashTimeline: TimelineEntry[] = [];
    private lastFlashTimelineIndex: number = -1;
    
    // Recolor Track
    private recolorTimeline: TimelineEntry[] = [];
    private lastRecolorTimelineIndex: number = -1;
    
    // Custom Background
    private customBGTimeline: TimelineEntry[] = [];
    private lastCustomBGTimelineIndex: number = -1;
    private customBGMesh: THREE.Mesh | null = null;
    private customBGTexture: THREE.Texture | null = null;
    private customBGImages: Map<string, string> = new Map();
    
    constructor(
        scene: THREE.Scene,
        tileColorManager: TileColorManager,
        updateTileColor: (index: number, color: string, bgcolor: string) => void
    ) {
        this.scene = scene;
        this.tileColorManager = tileColorManager;
        this.updateTileColor = updateTileColor;
        
        // Initialize effects
        this.bloomEffect = new BloomEffect();
        this.flashEffect = new FlashEffect();
    }
    
    /**
     * Build all timelines from tile events
     */
    public buildTimelines(
        tileEvents: Map<number, any[]>,
        tileStartTimes: number[],
        tileBPM: number[]
    ): void {
        this.buildBloomTimeline(tileEvents, tileStartTimes, tileBPM);
        this.buildFlashTimeline(tileEvents, tileStartTimes, tileBPM);
        this.buildRecolorTimeline(tileEvents, tileStartTimes, tileBPM);
        this.buildCustomBGTimeline(tileEvents, tileStartTimes, tileBPM);
    }
    
    /**
     * Reset all timeline indices
     */
    public resetIndices(): void {
        this.lastBloomTimelineIndex = -1;
        this.lastFlashTimelineIndex = -1;
        this.lastRecolorTimelineIndex = -1;
        this.lastCustomBGTimelineIndex = -1;
        this.bloomEnabled = false;
    }
    
    /**
     * Update timelines based on current time
     * @param timeInLevel Current time in level (seconds)
     * @param elapsedTime Current elapsed time (ms)
     */
    public update(timeInLevel: number, elapsedTime: number): void {
        this.updateBloom(timeInLevel, elapsedTime);
        this.updateFlash(timeInLevel, elapsedTime);
        this.updateRecolor(timeInLevel);
        this.updateCustomBG(timeInLevel);
    }
    
    // === Bloom Timeline ===
    
    private buildBloomTimeline(
        tileEvents: Map<number, any[]>,
        tileStartTimes: number[],
        tileBPM: number[]
    ): void {
        const entries: TimelineEntry[] = [];
        
        tileEvents.forEach((events, floor) => {
            const startTime = tileStartTimes[floor] || 0;
            const bpm = tileBPM[floor] || 100;
            const secPerBeat = 60 / bpm;
            
            events.forEach(event => {
                if (event.eventType === 'Bloom') {
                    const angleOffset = event.angleOffset || 0;
                    const timeOffset = (angleOffset / 180) * secPerBeat;
                    const eventTime = startTime + timeOffset;
                    entries.push({ time: eventTime, event: { ...event, floor } });
                }
            });
        });
        
        entries.sort((a, b) => a.time - b.time);
        this.bloomTimeline = entries;
    }
    
    private updateBloom(timeInLevel: number, elapsedTime: number): void {
        // Reset if time went backwards
        if (this.lastBloomTimelineIndex >= 0) {
            const currentEntry = this.bloomTimeline[this.lastBloomTimelineIndex];
            if (currentEntry && timeInLevel < currentEntry.time) {
                this.bloomEnabled = false;
                this.lastBloomTimelineIndex = -1;
            }
        }
        
        // Process new bloom events
        while (
            this.lastBloomTimelineIndex + 1 < this.bloomTimeline.length &&
            this.bloomTimeline[this.lastBloomTimelineIndex + 1].time <= timeInLevel
        ) {
            this.lastBloomTimelineIndex++;
            const entry = this.bloomTimeline[this.lastBloomTimelineIndex];
            this.processBloomEvent(entry.event, elapsedTime);
        }
    }
    
    private processBloomEvent(event: any, elapsedTime: number): void {
        const enabled = event.enabled;
        
        if (enabled === true || enabled === 'Enabled' || enabled === '') {
            this.bloomEnabled = true;
            if (event.threshold !== undefined) {
                this.bloomEffect?.setThreshold(event.threshold / 100);
            }
            if (event.intensity !== undefined) {
                this.bloomEffect?.setIntensity(event.intensity / 100);
            }
            if (event.color !== undefined) {
                let colorStr = event.color;
                if (Array.isArray(event.color)) {
                    const r = Math.round(event.color[0] * 255).toString(16).padStart(2, '0');
                    const g = Math.round(event.color[1] * 255).toString(16).padStart(2, '0');
                    const b = Math.round(event.color[2] * 255).toString(16).padStart(2, '0');
                    colorStr = r + g + b;
                }
                this.bloomEffect?.setColor(colorStr);
            }
        } else if (enabled === false || enabled === 'Disabled') {
            this.bloomEnabled = false;
        }
    }
    
    // === Flash Timeline ===
    
    private buildFlashTimeline(
        tileEvents: Map<number, any[]>,
        tileStartTimes: number[],
        tileBPM: number[]
    ): void {
        const entries: TimelineEntry[] = [];
        
        tileEvents.forEach((events, floor) => {
            const startTime = tileStartTimes[floor] || 0;
            const bpm = tileBPM[floor] || 100;
            const secPerBeat = 60 / bpm;
            
            events.forEach(event => {
                if (event.eventType === 'Flash') {
                    const angleOffset = event.angleOffset || 0;
                    const timeOffset = (angleOffset / 180) * secPerBeat;
                    const eventTime = startTime + timeOffset;
                    entries.push({ time: eventTime, event: { ...event, floor } });
                }
            });
        });
        
        entries.sort((a, b) => a.time - b.time);
        this.flashTimeline = entries;
    }
    
    private updateFlash(timeInLevel: number, elapsedTime: number): void {
        // Reset if time went backwards
        if (this.lastFlashTimelineIndex >= 0) {
            const currentEntry = this.flashTimeline[this.lastFlashTimelineIndex];
            if (currentEntry && timeInLevel < currentEntry.time) {
                this.flashEffect?.stop();
                this.flashEffect?.reset();
                this.lastFlashTimelineIndex = -1;
            }
        }
        
        // Process new flash events
        while (
            this.lastFlashTimelineIndex + 1 < this.flashTimeline.length &&
            this.flashTimeline[this.lastFlashTimelineIndex + 1].time <= timeInLevel
        ) {
            this.lastFlashTimelineIndex++;
            const entry = this.flashTimeline[this.lastFlashTimelineIndex];
            this.processFlashEvent(entry.event, elapsedTime);
        }
    }
    
    private processFlashEvent(event: any, elapsedTime: number): void {
        if (!this.flashEffect) return;
        
        const bpm = event.bpm || 100;
        const secPerBeat = 60 / bpm;
        
        const duration = (event.duration !== undefined ? event.duration : 1) * secPerBeat;
        const startColor = event.startColor || 'ffffff';
        const endColor = event.endColor || 'ffffff';
        const startOpacity = (event.startOpacity !== undefined ? event.startOpacity : 100) / 100;
        const endOpacity = (event.endOpacity !== undefined ? event.endOpacity : 0) / 100;
        const ease = event.ease || 'Linear';
        const plane = event.plane === 1 ? 'BG' : 'FG';
        
        this.flashEffect.startFlash(
            elapsedTime / 1000,
            duration,
            startColor,
            endColor,
            startOpacity,
            endOpacity,
            ease,
            plane
        );
    }
    
    // === Recolor Timeline ===
    
    private buildRecolorTimeline(
        tileEvents: Map<number, any[]>,
        tileStartTimes: number[],
        tileBPM: number[]
    ): void {
        const entries: TimelineEntry[] = [];
        
        tileEvents.forEach((events, floor) => {
            const startTime = tileStartTimes[floor] || 0;
            const bpm = tileBPM[floor] || 100;
            const secPerBeat = 60 / bpm;
            
            events.forEach(event => {
                if (event.eventType === 'RecolorTrack') {
                    const angleOffset = event.angleOffset || 0;
                    const timeOffset = (angleOffset / 180) * secPerBeat;
                    const eventTime = startTime + timeOffset;
                    entries.push({ time: eventTime, event: { ...event, floor } });
                }
            });
        });
        
        entries.sort((a, b) => a.time - b.time);
        this.recolorTimeline = entries;
    }
    
    private updateRecolor(timeInLevel: number): void {
        // Reset if time went backwards
        if (this.lastRecolorTimelineIndex >= 0) {
            const currentEntry = this.recolorTimeline[this.lastRecolorTimelineIndex];
            if (currentEntry && timeInLevel < currentEntry.time) {
                this.lastRecolorTimelineIndex = -1;
            }
        }
        
        // Process new recolor events
        while (
            this.lastRecolorTimelineIndex + 1 < this.recolorTimeline.length &&
            this.recolorTimeline[this.lastRecolorTimelineIndex + 1].time <= timeInLevel
        ) {
            this.lastRecolorTimelineIndex++;
            const entry = this.recolorTimeline[this.lastRecolorTimelineIndex];
            this.processRecolorEvent(entry.event);
        }
    }
    
    private processRecolorEvent(event: any): void {
        const startIdx = this.tileColorManager.PosRelativeTo(event.startTile, event.floor);
        const endIdx = this.tileColorManager.PosRelativeTo(event.endTile, event.floor);
        const gap = (event.gapLength !== undefined) ? event.gapLength : 0;
        
        // Get default colors from the first tile's config or use hardcoded defaults
        const firstConfig = this.tileColorManager.getTileRecolorConfig(0);
        const defaultColor = firstConfig?.trackColor || 'debb7b';
        const defaultSecondaryColor = firstConfig?.secondaryTrackColor || 'ffffff';
        const defaultStyle = firstConfig?.trackStyle || 'Standard';
        
        // Apply colors to tiles
        for (let i = startIdx; i <= endIdx; i++) {
            if (i < 0 || gap > 0 && (i - startIdx) % (gap + 1) !== 0) continue;
            
            const color = event.trackColor || defaultColor;
            const secondaryColor = event.secondaryTrackColor || defaultSecondaryColor;
            
            this.tileColorManager.setTileColor(i, color, secondaryColor);
            this.updateTileColor(i, color, secondaryColor);
        }
    }
    
    // === Custom Background Timeline ===
    
    private buildCustomBGTimeline(
        tileEvents: Map<number, any[]>,
        tileStartTimes: number[],
        tileBPM: number[]
    ): void {
        const entries: TimelineEntry[] = [];
        
        tileEvents.forEach((events, floor) => {
            const startTime = tileStartTimes[floor] || 0;
            const bpm = tileBPM[floor] || 100;
            const secPerBeat = 60 / bpm;
            
            events.forEach(event => {
                if (event.eventType === 'SetCustomBG') {
                    const angleOffset = event.angleOffset || 0;
                    const timeOffset = (angleOffset / 180) * secPerBeat;
                    const eventTime = startTime + timeOffset;
                    entries.push({ time: eventTime, event: { ...event, floor } });
                }
            });
        });
        
        entries.sort((a, b) => a.time - b.time);
        this.customBGTimeline = entries;
    }
    
    private updateCustomBG(timeInLevel: number): void {
        // Reset if time went backwards
        if (this.lastCustomBGTimelineIndex >= 0) {
            const currentEntry = this.customBGTimeline[this.lastCustomBGTimelineIndex];
            if (currentEntry && timeInLevel < currentEntry.time) {
                this.lastCustomBGTimelineIndex = -1;
            }
        }
        
        // Process new custom BG events
        while (
            this.lastCustomBGTimelineIndex + 1 < this.customBGTimeline.length &&
            this.customBGTimeline[this.lastCustomBGTimelineIndex + 1].time <= timeInLevel
        ) {
            this.lastCustomBGTimelineIndex++;
            const entry = this.customBGTimeline[this.lastCustomBGTimelineIndex];
            this.processCustomBGEvent(entry.event);
        }
    }
    
    private processCustomBGEvent(event: any): void {
        // Custom BG implementation would go here
        // This is a placeholder for now
    }
    
    // === Render Methods ===
    
    /**
     * Apply bloom effect to renderer
     */
    public applyBloom(
        renderer: THREE.WebGLRenderer,
        sourceTexture: THREE.Texture,
        renderTarget: THREE.WebGLRenderTarget | null
    ): void {
        if (this.bloomEnabled && this.bloomEffect) {
            this.bloomEffect.render(renderer, sourceTexture, renderTarget);
        }
    }
    
    /**
     * Render flash effect overlay
     */
    public renderFlash(renderer: THREE.WebGLRenderer, currentTime: number): void {
        this.flashEffect?.renderFlash(renderer, currentTime);
    }
    
    /**
     * Check if bloom is enabled
     */
    public isBloomEnabled(): boolean {
        return this.bloomEnabled;
    }
    
    /**
     * Register custom background image
     */
    public registerCustomBGImage(filename: string, url: string): void {
        this.customBGImages.set(filename, url);
    }
    
    /**
     * Set render target size
     */
    public setSize(width: number, height: number): void {
        this.bloomEffect?.setSize(width, height);
        this.flashEffect?.setSize(width, height);
    }
    
    /**
     * Dispose all resources
     */
    public dispose(): void {
        this.bloomEffect?.dispose();
        this.bloomEffect = null;
        
        this.flashEffect?.dispose();
        this.flashEffect = null;
        
        if (this.customBGTexture) {
            this.customBGTexture.dispose();
            this.customBGTexture = null;
        }
        
        if (this.customBGMesh) {
            this.scene.remove(this.customBGMesh);
            this.customBGMesh = null;
        }
        
        this.customBGImages.clear();
        this.bloomTimeline = [];
        this.flashTimeline = [];
        this.recolorTimeline = [];
        this.customBGTimeline = [];
    }
}
