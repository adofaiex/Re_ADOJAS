/**
 * Hitsound Manager
 * Manages hit sound playback for tile hits
 */

// Available hitsound types
export type HitsoundType = 
  | 'Kick'
  | 'KickHouse'
  | 'KickChroma'
  | 'KickRupture'
  | 'Snare'
  | 'SnareHouse'
  | 'SnareVapor'
  | 'Clap'
  | 'ClapHit'
  | 'ClapHitEcho'
  | 'Hat'
  | 'HatHouse'
  | 'Chuck'
  | 'Hammer'
  | 'Shaker'
  | 'ShakerLoud'
  | 'Sidestick'
  | 'Stick'
  | 'ReverbClack'
  | 'ReverbClap'
  | 'Squareshot'
  | 'FireTile'
  | 'IceTile'
  | 'PowerUp'
  | 'PowerDown'
  | 'VehiclePositive'
  | 'VehicleNegative'
  | 'Sizzle'
  | 'None';

// Map hitsound type to file name
const hitsoundFileMap: Record<HitsoundType, string> = {
  'Kick': 'sndKick.wav',
  'KickHouse': 'sndKickHouse.wav',
  'KickChroma': 'sndKickChroma.wav',
  'KickRupture': 'sndKickRupture.wav',
  'Snare': 'sndSnareAcoustic2.wav',
  'SnareHouse': 'sndSnareHouse.wav',
  'SnareVapor': 'sndSnareVapor.wav',
  'Clap': 'sndClapHit.wav',
  'ClapHit': 'sndClapHit.wav',
  'ClapHitEcho': 'sndClapHitEcho.wav',
  'Hat': 'sndHat.wav',
  'HatHouse': 'sndHatHouse.wav',
  'Chuck': 'sndChuck.wav',
  'Hammer': 'sndHammer.wav',
  'Shaker': 'sndShaker.wav',
  'ShakerLoud': 'sndShakerLoud.wav',
  'Sidestick': 'sndSidestick.wav',
  'Stick': 'sndStick.wav',
  'ReverbClack': 'sndReverbClack.wav',
  'ReverbClap': 'sndReverbClap.wav',
  'Squareshot': 'sndSquareshot.wav',
  'FireTile': 'sndFireTile.wav',
  'IceTile': 'sndIceTile.wav',
  'PowerUp': 'sndPowerUp.wav',
  'PowerDown': 'sndPowerDown.wav',
  'VehiclePositive': 'sndVehiclePositive.wav',
  'VehicleNegative': 'sndVehicleNegative.wav',
  'Sizzle': 'sndSizzle.wav',
  'None': '',
};

// Audio buffer cache using AudioContext
let audioContext: AudioContext | null = null;
const audioBufferCache: Map<string, AudioBuffer> = new Map();

// Base64 sounds for static pages (Fallback)
const embeddedSounds: Record<string, string> = {
  // We can fill this with small base64 samples or leave empty for dynamic fetch
  // For now, we use a dynamic loader that works with Vite/Webpack assets
};

// Get or create AudioContext
export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// Load audio buffer
async function loadAudioBuffer(fileName: string): Promise<AudioBuffer | null> {
  if (!fileName) return null;
  if (audioBufferCache.has(fileName)) {
    return audioBufferCache.get(fileName)!;
  }
  
  try {
    // Check if we have an embedded version
    if (embeddedSounds[fileName]) {
        const base64 = embeddedSounds[fileName];
        const binary = atob(base64);
        const arrayBuffer = new ArrayBuffer(binary.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        for (let i = 0; i < binary.length; i++) uint8Array[i] = binary.charCodeAt(i);
        const audioBuffer = await getAudioContext().decodeAudioData(arrayBuffer);
        audioBufferCache.set(fileName, audioBuffer);
        return audioBuffer;
    }

    // Try multiple possible paths for different environments
    const paths = [
        `/src/sounds/${fileName}`,
        `./src/sounds/${fileName}`,
        `./sounds/${fileName}`,
        `../sounds/${fileName}`
    ];

    let response: Response | null = null;
    for (const path of paths) {
        try {
            const res = await fetch(path);
            if (res.ok) {
                response = res;
                break;
            }
        } catch (e) { /* ignore and try next path */ }
    }

    if (!response || !response.ok) throw new Error(`Could not find ${fileName}`);

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await getAudioContext().decodeAudioData(arrayBuffer);
    audioBufferCache.set(fileName, audioBuffer);
    return audioBuffer;
  } catch (e) {
    console.warn(`Failed to load audio buffer: ${fileName}`, e);
    return null;
  }
}

/**
 * Hitsound Manager class
 * Optimised for high performance and pre-scheduling
 */
export class HitsoundManager {
  private hitsoundType: HitsoundType = 'Kick';
  private volume: number = 100; // 0-100
  private enabled: boolean = true;
  private currentBuffer: AudioBuffer | null = null;
  
  // Scheduler state
  private scheduledSources: AudioBufferSourceNode[] = [];
  private gainNode: GainNode | null = null;
  
  constructor(hitsoundType: HitsoundType = 'Kick', volume: number = 100) {
    this.hitsoundType = hitsoundType;
    this.volume = volume;
    this.preloadHitsound(hitsoundType);
  }
  
  private getGainNode(): GainNode {
    if (!this.gainNode) {
      const ctx = getAudioContext();
      this.gainNode = ctx.createGain();
      this.gainNode.connect(ctx.destination);
    }
    this.gainNode.gain.value = this.volume / 100;
    return this.gainNode;
  }
  
  /**
   * Preload a hitsound
   */
  private async preloadHitsound(type: HitsoundType): Promise<void> {
    if (type === 'None') return;
    
    const fileName = hitsoundFileMap[type];
    if (fileName) {
      this.currentBuffer = await loadAudioBuffer(fileName);
    }
  }
  
  /**
   * Set the hitsound type
   */
  setHitsoundType(type: HitsoundType): void {
    if (this.hitsoundType === type) return;
    this.hitsoundType = type;
    this.preloadHitsound(type);
  }
  
  /**
   * Set volume (0-100)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume / 100;
    }
  }
  
  /**
   * Enable or disable hitsounds
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
  }
  
  /**
   * Schedule all hitsounds based on tile timestamps
   * @param timestamps Array of times (in seconds) to play hitsounds
   * @param startTime The performance.now() reference for t=0
   */
  scheduleAll(timestamps: number[], startTime: number): void {
    if (!this.enabled || this.hitsoundType === 'None' || !this.currentBuffer) return;
    
    this.stopAll();
    
    const ctx = getAudioContext();
    const gain = this.getGainNode();
    
    // We schedule in batches if too many, but for now let's try direct
    // Only schedule if within reasonable range or just do all?
    // 60w nodes might be too many for the browser to handle at once.
    // ADOFAI high BPM usually means many hits in short time.
    
    // For 60w tiles, we should only schedule a "window" of hits.
    // However, the user wants "timestamp stitching" effect.
    // Scheduling nodes is very cheap compared to playing them in a loop.
    
    const now = ctx.currentTime;
    const baseTime = startTime / 1000; // startTime is usually performance.now()
    
    // Optimization: Only schedule what's ahead
    // But since this is called at startPlay, we schedule everything.
    
    for (let i = 0; i < timestamps.length; i++) {
        const t = timestamps[i];
        if (t < 0) continue; // Skip countdown hits if needed, or schedule them too
        
        const source = ctx.createBufferSource();
        source.buffer = this.currentBuffer;
        source.connect(gain);
        
        // ctx.currentTime + (t - currentLevelTime)
        // We assume t=0 is the moment we start playing.
        source.start(now + t);
        this.scheduledSources.push(source);
    }
    
    console.log(`Scheduled ${this.scheduledSources.length} hitsounds`);
  }

  /**
   * Stop all scheduled sounds
   */
  stopAll(): void {
    for (const source of this.scheduledSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped or not started
      }
    }
    this.scheduledSources = [];
  }
  
  /**
   * Play hit sound (Real-time fallback)
   */
  play(): void {
    if (!this.enabled || this.hitsoundType === 'None' || !this.currentBuffer) return;
    
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    
    const source = ctx.createBufferSource();
    source.buffer = this.currentBuffer;
    source.connect(this.getGainNode());
    source.start(0);
  }
  
  /**
   * Dispose and clear
   */
  dispose(): void {
    this.stopAll();
    this.currentBuffer = null;
    this.gainNode = null;
  }
}

