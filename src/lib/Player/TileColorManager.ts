import * as THREE from 'three';

/**
 * Check if an event is active (should be processed)
 * active: undefined | true | "" | "Enabled" -> active (process event)
 * active: false | "Disabled" -> inactive (skip event)
 */
export const isEventActive = (event: any): boolean => {
    return ![false, "Disabled"].includes(event.active);
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
 * Volume pulse data - stores amplitude for each tile
 * Used when trackColorType is "Volume" and trackColorPulse is not "None"
 */
export interface VolumePulseData {
    startFloor: number;
    pulseLength: number;
    amplitudes: number[]; // amplitudes[i] represents the volume at (startFloor + i)
}

/**
 * Manager for tile colors and color events
 */
export class TileColorManager {
    private tileColors: { color: string, secondaryColor: string }[] = [];
    private tileRecolorConfigs: (TileColorConfig | null)[] = [];
    private levelData: any;
    
    // Volume pulse data storage - maps tile index to its volume amplitude
    private volumePulseMap: Map<number, number> = new Map();
    
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

        // Initialize tileColors and configs
        this.tileColors = new Array(totalTiles);
        this.tileRecolorConfigs = new Array(totalTiles).fill(null);

        const globalConfig: TileColorConfig = {
            trackStyle: defaultStyle,
            trackColorType: defaultColorType,
            trackColor: defaultColor,  // Use original colors
            secondaryTrackColor: defaultSecondaryColor,  // Use original colors
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
                const eventTrackStyle = event.trackStyle || defaultStyle;

                currentConfig = {
                    trackStyle: eventTrackStyle,
                    trackColorType: event.trackColorType || defaultColorType,
                    trackColor: event.trackColor || defaultColor,  // Use original colors
                    secondaryTrackColor: event.secondaryTrackColor || defaultSecondaryColor,  // Use original colors
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
                        const config: TileColorConfig = {
                            trackStyle: event.trackStyle || defaultStyle,
                            trackColorType: event.trackColorType || defaultColorType,
                            trackColor: event.trackColor || defaultColor,  // Use original colors
                            secondaryTrackColor: event.secondaryTrackColor || defaultSecondaryColor,  // Use original colors
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
     * Set volume amplitude for a specific tile
     * Used for Volume color type with pulse effects
     * 
     * @param floor Tile index
     * @param amplitude Volume amplitude (0-1)
     */
    public setVolumePulseAmplitude(floor: number, amplitude: number): void {
        this.volumePulseMap.set(floor, Math.max(0, Math.min(1, amplitude)));
    }

    /**
     * Get volume amplitude for a specific tile
     * 
     * @param floor Tile index
     * @returns Volume amplitude (0-1), defaults to 0
     */
    public getVolumePulseAmplitude(floor: number): number {
        return this.volumePulseMap.get(floor) ?? 0;
    }

    /**
     * Clear all volume pulse data
     */
    public clearVolumePulseData(): void {
        this.volumePulseMap.clear();
    }

    /**
     * Set volume pulse data from amplitude array
     * This allows batch setting of amplitudes based on pulse pattern
     * 
     * @param startFloor Starting tile index
     * @param amplitudes Array of amplitudes indexed from startFloor
     */
    public setVolumePulseArray(startFloor: number, amplitudes: number[]): void {
        amplitudes.forEach((amp, index) => {
            this.setVolumePulseAmplitude(startFloor + index, amp);
        });
    }

    /**
     * Process position relative keywords
     */
    /**
     * Parse tile reference to absolute tile index
     * ADOFAI format: [offset, relativeTo] where relativeTo is:
     *   - "ThisTile" or 0: relative to current tile (event floor)
     *   - "Start" or 1: relative to start of level
     *   - "End" or 2: relative to end of level
     * 
     * @param input The tile reference (can be array [offset, relativeTo] or single number)
     * @param thisid The current tile ID (floor where event occurs)
     * @returns Absolute tile index
     */
    public PosRelativeTo(input: any, thisid: number): number {
        const totalTiles = this.levelData.tiles.length;

        // Handle array format [offset, relativeTo]
        if (Array.isArray(input) && input.length >= 2) {
            const offset = Number(input[0]) || 0;
            const relativeTo = input[1];
            
            let result: number;
            
            // Parse relativeTo (can be string or number)
            if (relativeTo === "ThisTile" || relativeTo === 0) {
                // Relative to current tile
                result = thisid + offset;
            } else if (relativeTo === "Start" || relativeTo === 1) {
                // Relative to start (absolute position)
                result = offset;
            } else if (relativeTo === "End" || relativeTo === 2) {
                // Relative to end (from last tile)
                result = totalTiles - 1 + offset;
            } else {
                // Default: treat as ThisTile
                result = thisid + offset;
            }
            
            // Clamp to valid range
            return Math.max(0, Math.min(result, totalTiles - 1));
        }
        
        // Handle legacy string format with keywords
        if (typeof input === 'string') {
            const replaced = input
                .replace(/Start/g, "0")
                .replace(/ThisTile/g, String(thisid))
                .replace(/End/g, String(totalTiles - 1));
            return Math.max(0, Math.min(Number(replaced), totalTiles - 1));
        }
        
        // Handle single number
        return Math.max(0, Math.min(Number(input) || 0, totalTiles - 1));
    }

    public parseColorTrackType(Type: string, inputColor: string, inputBgColor: string): { color: string, bgcolor: string } {
        // Ensure colors include '#' prefix and handle alpha channels
        const trackColorX = this.formatHexColor(inputColor);
        const trackbgColorX = this.formatHexColor(inputBgColor);

        let intValue = { color: trackColorX, bgcolor: trackbgColorX };

        // Process colors based on track style (matches ADOFAI original logic)
        if (Type === "Standard" || Type === "Gems" || Type === "Basic" || Type === "Minimal") {
            // Standard/Gems: Darker version of main color for border
            intValue.bgcolor = this.processHexColor(trackColorX)[1];
            intValue.color = trackColorX;
        } else if (Type === "Neon") {
            // Neon: Black fill, colored border (glow effect)
            intValue.color = "#000000";
            intValue.bgcolor = trackColorX;
        } else if (Type === "NeonLight") {
            // NeonLight: Lighter border, colored fill
            intValue.color = this.processHexColor(trackColorX)[0];
            intValue.bgcolor = trackColorX;
        }

        return intValue;
    }

    /**
     * Core tile color renderer based on trackColorType
     * Uses official ADOFAI pulse formula for accurate animation
     * 
     * For Volume color type:
     * - If trackColorPulse is "None": uses provided amplitude parameter
     * - If trackColorPulse is "Forward" or "Backward": uses volumePulseMap for tile-specific amplitudes
     */
    public getTileRenderer(id: number, time: number, rct: TileColorConfig, amplitude?: number): { color: string, bgcolor: string } {
        const {
            trackColorType, trackColor, secondaryTrackColor,
            trackColorPulse, trackColorAnimDuration, trackPulseLength,
            trackStyle
        } = rct;

        let renderer_tileClientColor = { color: trackColor, bgcolor: secondaryTrackColor };
        let shouldDraw = 0;

        const isNeon = trackStyle === "Neon";
        const isNeonLight = trackStyle === "NeonLight";

        // Calculate pulse percentage using official ADOFAI formula
        // Based on ffxRecolorFloorPlus.StartEffect() logic
        let pulsePercent = 0;
        
        if (trackColorType === "Stripes") {
            // Stripes uses tile position modulo for alternation
            pulsePercent = (id % trackPulseLength) / trackPulseLength;
        } else if (trackColorPulse === "None") {
            // Simple time-based pulse
            pulsePercent = (time % trackColorAnimDuration) / trackColorAnimDuration;
        } else if (trackColorPulse === "Forward") {
            // Forward pulse using official formula:
            // specialTimeOffset = (1 - 1/pulseLength * (id % pulseLength)) * animDuration
            const specialTimeOffset = (1 - (1 / trackPulseLength) * (id % trackPulseLength)) * trackColorAnimDuration;
            pulsePercent = ((time - specialTimeOffset) % trackColorAnimDuration) / trackColorAnimDuration;
        } else if (trackColorPulse === "Backward") {
            // Backward pulse using official formula:
            // specialTimeOffset = 1/pulseLength * (id % pulseLength) * animDuration
            const specialTimeOffset = (1 / trackPulseLength) * (id % trackPulseLength) * trackColorAnimDuration;
            pulsePercent = ((time - specialTimeOffset) % trackColorAnimDuration) / trackColorAnimDuration;
        }

        // Normalize to 0-1 range for calculations
        pulsePercent = (pulsePercent % 1 + 1) % 1;

        // A. Single - Solid color
        if (trackColorType === "Single") {
            // Ensure colors are properly formatted (strip alpha if present)
            const formattedColor = this.formatHexColor(trackColor);
            renderer_tileClientColor.color = formattedColor;
            
            if (!isNeon && !isNeonLight) {
                // Standard style: darker border
                renderer_tileClientColor.bgcolor = this.processHexColor(formattedColor)[1];
            } else if (isNeonLight) {
                // NeonLight: lighter border
                renderer_tileClientColor.bgcolor = this.processHexColor(formattedColor)[0];
            }
            // Neon: already has correct colors from parseColorTrackType
            shouldDraw = 1;
        }

        // B. Stripes - Alternating colors
        else if (trackColorType === "Stripes") {
            const useColor1 = (id % 2 === 0);
            const primaryColor = useColor1 ? trackColor : secondaryTrackColor;

            if (isNeon) {
                renderer_tileClientColor.color = "#000000";
                renderer_tileClientColor.bgcolor = primaryColor;
            } else if (isNeonLight) {
                renderer_tileClientColor.color = this.processHexColor(primaryColor)[0];
                renderer_tileClientColor.bgcolor = primaryColor;
            } else {
                renderer_tileClientColor.color = primaryColor;
                renderer_tileClientColor.bgcolor = this.processHexColor(primaryColor)[1];
            }
            shouldDraw = 1;
        }

        // C. Glow - Pulsing glow effect with intensity modulation
        else if (trackColorType === "Glow") {
            // ColorType.js formula: p = 1 - Math.abs(1 - 2 * percent)
            // Creates a smooth pulsing effect from 0 to 1 back to 0
            const p = 1 - Math.abs(1 - 2 * pulsePercent);
            
            // Glow blends between trackColor and secondaryTrackColor
            // The intensity modulation makes the glow more dynamic
            const glowIntensity = 0.5 + p * 0.5;  // Range: 0.5 to 1.0
            const glowColor = this.genColor(trackColor, secondaryTrackColor, p);
            
            // Apply intensity modulation to the glow color
            const modulated = this.modulateColorIntensity(glowColor, glowIntensity);

            if (isNeon) {
                // Neon: black fill, glowing border
                renderer_tileClientColor.color = "#000000";
                renderer_tileClientColor.bgcolor = modulated;
            } else if (isNeonLight) {
                // NeonLight: color fill with glow effect
                renderer_tileClientColor.color = modulated;
                renderer_tileClientColor.bgcolor = modulated;
            } else {
                // Standard: colored fill with glow
                renderer_tileClientColor.color = modulated;
                renderer_tileClientColor.bgcolor = this.processHexColor(modulated)[1];
            }
            shouldDraw = 1;
        }

        // D. Blink - Smooth blinking between two colors (matches ColorType.js logic)
        else if (trackColorType === "Blink") {
            // ColorType.js uses smooth RGB interpolation between colors
            // pulsePercent ranges 0-1, we use it to smoothly transition
            const blinkColor = this.genColor(trackColor, secondaryTrackColor, pulsePercent);

            if (isNeon) {
                renderer_tileClientColor.color = "#000000";
                renderer_tileClientColor.bgcolor = blinkColor;
            } else if (isNeonLight) {
                renderer_tileClientColor.color = this.processHexColor(blinkColor)[0];
                renderer_tileClientColor.bgcolor = blinkColor;
            } else {
                renderer_tileClientColor.color = blinkColor;
                renderer_tileClientColor.bgcolor = this.processHexColor(blinkColor)[1];
            }
            shouldDraw = 1;
        }

        // E. Switch - Smooth switching between two colors (matches ColorType.js logic)
        else if (trackColorType === "Switch") {
            // ColorType.js uses genColor for smooth transitions
            const switchColor = this.genColor(trackColor, secondaryTrackColor, pulsePercent);

            if (isNeon) {
                renderer_tileClientColor.color = "#000000";
                renderer_tileClientColor.bgcolor = switchColor;
            } else if (isNeonLight) {
                renderer_tileClientColor.color = this.processHexColor(switchColor)[0];
                renderer_tileClientColor.bgcolor = switchColor;
            } else {
                renderer_tileClientColor.color = switchColor;
                renderer_tileClientColor.bgcolor = this.processHexColor(switchColor)[1];
            }
            shouldDraw = 1;
        }

        // F. Rainbow - Rainbow animation through full color spectrum
        else if (trackColorType === "Rainbow") {
            // Use enriched Rainbow logic based on official ADOFAI HSV handling
            // Cycles through full hue spectrum with preserved saturation and value
            const rainbowColor = this.rainbowColorFromHSV(trackColor, secondaryTrackColor, pulsePercent);

            if (isNeon) {
                renderer_tileClientColor.color = "#000000";
                renderer_tileClientColor.bgcolor = rainbowColor;
            } else if (isNeonLight) {
                renderer_tileClientColor.color = this.processHexColor(rainbowColor)[0];
                renderer_tileClientColor.bgcolor = rainbowColor;
            } else {
                renderer_tileClientColor.color = rainbowColor;
                renderer_tileClientColor.bgcolor = this.processHexColor(rainbowColor)[1];
            }
            shouldDraw = 1;
        }

        // G. Volume - Audio amplitude based
        else if (trackColorType === "Volume") {
            // Get amplitude based on pulse type
            let amp = 0;
            if (trackColorPulse === "None") {
                // Use provided amplitude (real-time audio data)
                amp = amplitude || 0;
            } else if (trackColorPulse === "Forward" || trackColorPulse === "Backward") {
                // Use pre-computed volume pulse data from volumePulseMap
                // This allows volume to be baked per-tile for pulse effects
                amp = this.getVolumePulseAmplitude(id);
            }
            
            // Volume modulates lightness
            const baseColor = isNeon ? secondaryTrackColor : trackColor;
            const color = new THREE.Color(baseColor);
            const hsl = { h: 0, s: 0, l: 0 };
            color.getHSL(hsl);
            // Lightness goes from 0.2 to 0.8 based on amplitude
            color.setHSL(hsl.h, hsl.s, 0.2 + amp * 0.6);
            const volumeHex = '#' + color.getHexString();

            if (isNeon) {
                renderer_tileClientColor.color = "#000000";
                renderer_tileClientColor.bgcolor = volumeHex;
            } else {
                renderer_tileClientColor.color = volumeHex;
                renderer_tileClientColor.bgcolor = this.processHexColor(volumeHex)[1];
            }
            shouldDraw = 1;
        }

        // H. Default fallback for unsupported or custom color types
        // This includes types not in ColorType.js that may be added by mods or future updates
        if (shouldDraw === 0) {
            renderer_tileClientColor.color = trackColor;
            renderer_tileClientColor.bgcolor = secondaryTrackColor;
            shouldDraw = 1;
        }

        return renderer_tileClientColor;
    }

    /**
     * List of supported color types
     * Note: Some types like "Volume" have special handling for pulse effects
     */
    public static readonly SUPPORTED_COLOR_TYPES = [
        "Single",       // Solid color
        "Stripes",      // Alternating tile colors
        "Glow",         // Pulsing glow effect
        "Blink",        // On/off blinking
        "Switch",       // Smooth color transition
        "Rainbow",      // HSV rainbow animation
        "Volume"        // Audio amplitude based (with pulse support)
    ];

    /**
     * Validate if a color type is supported
     * Returns true for standard types and any unrecognized types (for forward compatibility)
     */
    public static isColorTypeSupported(colorType: string): boolean {
        return TileColorManager.SUPPORTED_COLOR_TYPES.includes(colorType) || colorType !== "";
    }

    /**
     * Enhanced Rainbow color animation using HSV color space
     * Based on official ADOFAI ColorFloor RainbowColor logic:
     * - Preserves saturation and value from base color
     * - Cycles through full hue spectrum
     */
    private rainbowColorFromHSV(baseColor: string, secondaryColor: string, percent: number): string {
        // Get HSV from base color
        const baseColorObj = new THREE.Color(baseColor);
        const hsl = { h: 0, s: 0, l: 0 };
        baseColorObj.getHSL(hsl);
        
        // Convert HSL to HSV approximation for richer color handling
        // H stays the same, S and V are preserved from base
        const hue = percent; // Cycle through full hue spectrum based on animation progress
        const saturation = Math.max(hsl.s, 0.75); // Ensure vibrant colors
        const value = Math.max(hsl.l, 0.55); // Ensure sufficient brightness
        
        // Create rainbow color with cycled hue
        const rainbowColor = new THREE.Color();
        rainbowColor.setHSL(hue, saturation, value);
        
        return '#' + rainbowColor.getHexString();
    }

    /**
     * Modulate color intensity by scaling RGB values
     * Used for glow intensity effects
     */
    private modulateColorIntensity(hexColor: string, intensity: number): string {
        const color = new THREE.Color(hexColor);
        // Scale RGB channels by intensity factor
        color.multiplyScalar(intensity);
        return '#' + color.getHexString();
    }

    /**
     * Interpolate between two colors using RGB space with gamma correction
     * This produces more vibrant results than HSL for glow effects
     */
    public genColor(c1: string, c2: string, t: number): string {
        const alpha = Math.max(0, Math.min(1, t));

        // Convert to RGB
        const color1 = new THREE.Color(c1);
        const color2 = new THREE.Color(c2);

        // Apply gamma correction for smoother blending
        const gamma = 2.2;
        const invGamma = 1.0 / gamma;

        const r1 = Math.pow(color1.r, gamma);
        const g1 = Math.pow(color1.g, gamma);
        const b1 = Math.pow(color1.b, gamma);

        const r2 = Math.pow(color2.r, gamma);
        const g2 = Math.pow(color2.g, gamma);
        const b2 = Math.pow(color2.b, gamma);

        // Linear interpolation
        const r = Math.pow(r1 + (r2 - r1) * alpha, invGamma);
        const g = Math.pow(g1 + (g2 - g1) * alpha, invGamma);
        const b = Math.pow(b1 + (b2 - b1) * alpha, invGamma);

        const result = new THREE.Color(r, g, b);
        return '#' + result.getHexString();
    }

    /**
     * Generate lighter and darker variants of a color for borders
     * Matches ADOFAI original color processing logic
     */
    public processHexColor(hex: string): [string, string] {
        let color = new THREE.Color(hex);

        // Generate lighter variant (for NeonLight borders)
        const lighter = new THREE.Color();
        lighter.copy(color);
        lighter.multiplyScalar(1.3); // 30% brighter
        lighter.r = Math.min(1, lighter.r);
        lighter.g = Math.min(1, lighter.g);
        lighter.b = Math.min(1, lighter.b);

        // Generate darker variant (for Standard borders)
        const darker = new THREE.Color();
        darker.copy(color);
        darker.multiplyScalar(0.5); // 50% darker

        return [
            '#' + lighter.getHexString(), // Lighter variant
            '#' + darker.getHexString()  // Darker variant
        ];
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
