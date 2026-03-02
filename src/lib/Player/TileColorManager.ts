import * as THREE from 'three';

/**
 * Check if an event is active (should be processed)
 * active: undefined | true | "" | "Enabled" -> active (process event)
 * active: false | "Disabled" -> inactive (skip event)
 */
export const isEventActive = (event: any): boolean => {
    if (event.active === undefined) return true;
    if (event.active === true) return true;
    if (event.active === "") return true;
    if (event.active === "Enabled") return true;
    if (event.active === false) return false;
    if (event.active === "Disabled") return false;
    // Default to active for unknown values
    return true;
};

/**
 * Tile color configuration
 */
export interface TileColorConfig {
    trackStyle: string;
    trackColorType: string;
    trackColor: string;
    secondaryTrackColor: string;
    trackColorPulse: string;
    trackColorAnimDuration: number;
    trackPulseLength: number;
}

/**
 * Manager for tile colors and color events
 */
export class TileColorManager {
    private tileColors: { color: string, secondaryColor: string }[] = [];
    private tileRecolorConfigs: (TileColorConfig | null)[] = [];
    private levelData: any;
    
    constructor(levelData: any) {
        this.levelData = levelData;
    }
    
    /**
     * Initialize tile colors from level settings
     */
    public initTileColors(): void {
        const totalTiles = this.levelData.tiles.length;
        const settings = this.levelData.settings;
        
        // Global defaults
        const defaultColor = settings.trackColor || 'debb7b';
        const defaultSecondaryColor = settings.secondaryTrackColor || 'ffffff';
        const defaultStyle = settings.trackStyle || 'Standard';
        const defaultColorType = settings.trackColorType || 'Single';

        // Parse global color base
        const globalColors = this.parseColorTrackType(defaultStyle, defaultColor, defaultSecondaryColor);

        // Initialize tileColors and configs
        this.tileColors = new Array(totalTiles);
        this.tileRecolorConfigs = new Array(totalTiles).fill(null);

        const globalConfig: TileColorConfig = {
            trackStyle: defaultStyle,
            trackColorType: defaultColorType,
            trackColor: globalColors.color,
            secondaryTrackColor: globalColors.bgcolor,
            trackColorPulse: settings.trackColorPulse || 'None',
            trackColorAnimDuration: settings.trackColorAnimDuration || 2,
            trackPulseLength: settings.trackPulseLength || 10
        };

        // Optimization: Sort non-justThisTile events to process in one pass (O(N + E log E))
        const colorTrackEvents: any[] = [];
        if (this.levelData.actions) {
            this.levelData.actions.forEach((event: any) => {
                if (event.eventType === 'ColorTrack' && !event.justThisTile) {
                    colorTrackEvents.push(event);
                }
            });
        }
        colorTrackEvents.sort((a, b) => a.floor - b.floor);

        let currentEventIdx = 0;
        let currentConfig = globalConfig;

        for (let i = 0; i < totalTiles; i++) {
            // Update currentConfig if we reached a new ColorTrack floor
            while (currentEventIdx < colorTrackEvents.length && colorTrackEvents[currentEventIdx].floor <= i) {
                const event = colorTrackEvents[currentEventIdx];
                const colors = this.parseColorTrackType(
                    event.trackStyle || defaultStyle, 
                    event.trackColor || defaultColor, 
                    event.secondaryTrackColor || defaultSecondaryColor
                );
                
                currentConfig = {
                    trackStyle: event.trackStyle || defaultStyle,
                    trackColorType: event.trackColorType || defaultColorType,
                    trackColor: colors.color,
                    secondaryTrackColor: colors.bgcolor,
                    trackColorPulse: event.trackColorPulse || settings.trackColorPulse || 'None',
                    trackColorAnimDuration: event.trackColorAnimDuration || settings.trackColorAnimDuration || 2,
                    trackPulseLength: event.trackPulseLength || settings.trackPulseLength || 10
                };
                currentEventIdx++;
            }

            this.tileRecolorConfigs[i] = currentConfig;
            const rendered = this.getTileRenderer(i, 0, currentConfig);
            this.tileColors[i] = { color: rendered.color, secondaryColor: rendered.bgcolor };
        }

        // Handle justThisTile events (Static Preview Logic) separately as O(1)
        if (this.levelData.actions) {
            this.levelData.actions.forEach((event: any) => {
                if (event.eventType === 'ColorTrack' && event.justThisTile) {
                    const floor = event.floor;
                    if (floor >= 0 && floor < totalTiles) {
                        const colors = this.parseColorTrackType(
                            event.trackStyle || defaultStyle, 
                            event.trackColor || defaultColor, 
                            event.secondaryTrackColor || defaultSecondaryColor
                        );
                        
                        const config: TileColorConfig = {
                            trackStyle: event.trackStyle || defaultStyle,
                            trackColorType: event.trackColorType || defaultColorType,
                            trackColor: colors.color,
                            secondaryTrackColor: colors.bgcolor,
                            trackColorPulse: event.trackColorPulse || settings.trackColorPulse || 'None',
                            trackColorAnimDuration: event.trackColorAnimDuration || settings.trackColorAnimDuration || 2,
                            trackPulseLength: event.trackPulseLength || settings.trackPulseLength || 10
                        };

                        this.tileRecolorConfigs[floor] = config;
                        const rendered = this.getTileRenderer(floor, 0, config);
                        this.tileColors[floor] = { color: rendered.color, secondaryColor: rendered.bgcolor };
                    }
                }
            });
        }
    }
    
    public getTileColors(): { color: string, secondaryColor: string }[] {
        return this.tileColors;
    }
    
    public getTileRecolorConfigs(): (TileColorConfig | null)[] {
        return this.tileRecolorConfigs;
    }
    
    public getTileColor(index: number): { color: string, secondaryColor: string } | undefined {
        return this.tileColors[index];
    }
    
    public getTileRecolorConfig(index: number): TileColorConfig | null {
        return this.tileRecolorConfigs[index];
    }
    
    public setTileColor(index: number, color: string, bgcolor: string): void {
        if (index >= 0 && index < this.tileColors.length) {
            this.tileColors[index] = { color, secondaryColor: bgcolor };
        }
    }
    
    public setTileRecolorConfig(index: number, config: TileColorConfig): void {
        if (index >= 0 && index < this.tileRecolorConfigs.length) {
            this.tileRecolorConfigs[index] = config;
        }
    }
    
    public getTotalTiles(): number {
        return this.tileColors.length;
    }

    /**
     * Process position relative keywords
     */
    public PosRelativeTo(input: any, thisid: number): number {
        const totalTiles = this.levelData.tiles.length;
        // ADOFAI logic: Start -> 0, ThisTile -> thisid + 0, End -> totalTiles (angleTestCount)

        const replaceKeywords = (val: any) => {
            if (typeof val !== 'string') return val;
            return val
                .replace(/Start/g, "0")
                .replace(/ThisTile/g, String(thisid + 0))
                .replace(/End/g, String(totalTiles));
        };

        if (Array.isArray(input)) {
            const processed = input.map(replaceKeywords);
            // Returning sum of first two items as per user logic
            return Number(processed[0]) + Number(processed[1]);
        } else {
            const processed = replaceKeywords(input);
            return Number(processed);
        }
    }

    public parseColorTrackType(Type: string, inputColor: string, inputBgColor: string): { color: string, bgcolor: string } {
        // Ensure colors include '#' prefix and handle alpha channels
        const trackColorX = this.formatHexColor(inputColor);
        const trackbgColorX = this.formatHexColor(inputBgColor);

        let intValue = { color: trackColorX, bgcolor: trackbgColorX };

        if (Type === "Standard" || Type === "Gems") {
            intValue.bgcolor = this.processHexColor(trackColorX)[1];
        } else if (Type === "Neon") {
            intValue.color = "#000000";
            intValue.bgcolor = trackColorX;
        } else if (Type === "NeonLight") {
            intValue.color = this.processHexColor(trackColorX)[0];
            intValue.bgcolor = trackColorX;
        }

        return intValue;
    }

    /**
     * Core tile color renderer based on trackColorType
     */
    public getTileRenderer(id: number, time: number, rct: TileColorConfig, amplitude?: number): { color: string, bgcolor: string } {
        const { 
            trackColorType, trackColor, secondaryTrackColor, 
            trackColorPulse, trackColorAnimDuration, trackPulseLength,
            trackStyle
        } = rct;
        
        let renderer_tileClientColor = { color: trackColor, bgcolor: secondaryTrackColor };
        let shouldDraw = 0;

        const degToRad = (deg: number) => deg * (Math.PI / 180);

        const isNeon = trackStyle === "Neon";

        // A. 处理 Single/Rainbow/Volume
        if (trackColorType === "Single") {
            // Neon style already has black fill and colored border
            if (!isNeon) {
                renderer_tileClientColor.bgcolor = this.processHexColor(renderer_tileClientColor.bgcolor)[0];
            }
            shouldDraw = 1;
        } 
        else if (trackColorType === "Rainbow") {
            const hue = (time / trackColorAnimDuration) % 1;
            const color = new THREE.Color().setHSL(hue, 0.8, 0.6);
            const rainbowHex = '#' + color.getHexString();
            
            if (isNeon) {
                renderer_tileClientColor.color = "#000000";
                renderer_tileClientColor.bgcolor = rainbowHex;
            } else {
                renderer_tileClientColor.color = rainbowHex;
                renderer_tileClientColor.bgcolor = this.processHexColor(rainbowHex)[0];
            }
            shouldDraw = 1;
        }
        else if (trackColorType === "Volume") {
            const amp = amplitude || 0;
            const baseColor = isNeon ? secondaryTrackColor : trackColor;
            const color = new THREE.Color(baseColor);
            const hsl = { h: 0, s: 0, l: 0 };
            color.getHSL(hsl);
            color.setHSL(hsl.h, hsl.s, 0.2 + amp * 0.6);
            const volumeHex = '#' + color.getHexString();

            if (isNeon) {
                renderer_tileClientColor.color = "#000000";
                renderer_tileClientColor.bgcolor = volumeHex;
            } else {
                renderer_tileClientColor.color = volumeHex;
                renderer_tileClientColor.bgcolor = this.processHexColor(volumeHex)[0];
            }
            shouldDraw = 1;
        }

        // B. 处理 Stripes (条纹)
        else if (trackColorType === "Stripes") {
            const color = (id % 2 === 0) ? trackColor : secondaryTrackColor;
            if (isNeon) {
                renderer_tileClientColor.color = "#000000";
                renderer_tileClientColor.bgcolor = color;
            } else {
                renderer_tileClientColor.color = color;
                renderer_tileClientColor.bgcolor = this.processHexColor(color)[0];
            }
            shouldDraw = 1;
        } 

        // C. 处理 Glow (发光)
        else if (trackColorType === "Glow") {
            let t;
            if (trackColorPulse === "None") {
                t = 0.5 * Math.sin(degToRad(360 * (time / trackColorAnimDuration))) + 0.5;
            } else {
                let offset = (trackColorPulse === "Forward") ? id : -id;
                t = 0.5 * Math.sin(degToRad(360 * (time / trackColorAnimDuration) + (offset * trackPulseLength))) + 0.5;
            }
            
            if (isNeon) {
                 const darkerColor = '#' + new THREE.Color(secondaryTrackColor).multiplyScalar(0.3).getHexString();
                 renderer_tileClientColor.color = "#000000";
                 renderer_tileClientColor.bgcolor = this.genColor(darkerColor, secondaryTrackColor, t);
             } else {
                 renderer_tileClientColor.color = this.genColor(secondaryTrackColor, trackColor, t);
                 renderer_tileClientColor.bgcolor = this.processHexColor(renderer_tileClientColor.color)[0];
             }
             shouldDraw = 1;
         } 
 
         // D. 处理 Blink (闪烁)
         else if (trackColorType === "Blink") {
             let t;
             if (trackColorPulse === "None") {
                 t = (time / trackColorAnimDuration) % 1;
             } else {
                 let offset = (trackColorPulse === "Forward") ? id : -id;
                 t = ((time / trackColorAnimDuration) + (offset * trackPulseLength)) % 1;
             }
             
             if (isNeon) {
                 const darkerColor = '#' + new THREE.Color(secondaryTrackColor).multiplyScalar(0.1).getHexString();
                 renderer_tileClientColor.color = "#000000";
                 renderer_tileClientColor.bgcolor = this.genColor(darkerColor, secondaryTrackColor, t);
             } else {
                 renderer_tileClientColor.color = this.genColor(secondaryTrackColor, trackColor, t);
                 renderer_tileClientColor.bgcolor = this.processHexColor(renderer_tileClientColor.color)[0];
             }
            shouldDraw = 1;
        } 

        // E. 默认绘制逻辑
        if (shouldDraw === 0) {
            if (isNeon) {
                renderer_tileClientColor.color = "#000000";
            }
            shouldDraw = 1;
        } 

        return renderer_tileClientColor;
    }

    /**
     * Interpolate between two colors using HSL space for better brightness preservation
     */
    public genColor(c1: string, c2: string, t: number): string {
        const alpha = Math.max(0, Math.min(1, t));
        const color1 = new THREE.Color(c1);
        const color2 = new THREE.Color(c2);
        
        // Use HSL interpolation to prevent "muddy" or "black" midpoints
        const hsl1 = { h: 0, s: 0, l: 0 };
        const hsl2 = { h: 0, s: 0, l: 0 };
        color1.getHSL(hsl1);
        color2.getHSL(hsl2);
        
        // Handle hue wrap-around for smoother transitions
        let h1 = hsl1.h;
        let h2 = hsl2.h;
        if (Math.abs(h1 - h2) > 0.5) {
          if (h1 > h2) h2 += 1;
          else h1 += 1;
        }
        
        const h = (h1 + (h2 - h1) * alpha) % 1;
        const s = hsl1.s + (hsl2.s - hsl1.s) * alpha;
        const l = hsl1.l + (hsl2.l - hsl1.l) * alpha;
        
        color1.setHSL(h, s, l);
        return '#' + color1.getHexString();
    }

    public processHexColor(hex: string): [string, string] {
        let color = new THREE.Color(hex);
        
        // Half saturation as per user comment
        const hsl = { h: 0, s: 0, l: 0 };
        color.getHSL(hsl);
        color.setHSL(hsl.h, hsl.s * 0.5, hsl.l);
        
        const main = '#' + color.getHexString();
        
        // Shading for secondary
        color.multiplyScalar(0.7);
        const secondary = '#' + color.getHexString();
        
        return [main, secondary];
    }

    public formatHexColor(hex: string): string {
        if (!hex) return '#ffffff';
        
        // Remove '#' if present to normalize
        let cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
        
        // Handle 8-digit hex (RRGGBBAA) by stripping alpha
        if (cleanHex.length === 8) {
            cleanHex = cleanHex.slice(0, 6);
        }
        
        // Ensure it's a valid hex string length (3 or 6)
        if (cleanHex.length !== 3 && cleanHex.length !== 6) {
            // Fallback to black if invalid
            return '#000000';
        }
        
        return '#' + cleanHex;
    }
}
