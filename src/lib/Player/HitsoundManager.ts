/**
 * Hitsound Manager
 * Pre-synthesizes all hitsounds at level load time for accurate timing
 */

// Static import of audio data JSON (Vite handles this at build time)
import audioData from '../../sounds/audio_data.json';

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

// Map hitsound type to JSON key
const hitsoundKeyMap: Record<HitsoundType, string> = {
  'Kick': 'sndKick',
  'KickHouse': 'sndKickHouse',
  'KickChroma': 'sndKickChroma',
  'KickRupture': 'sndKickRupture',
  'Snare': 'sndSnareAcoustic2',
  'SnareHouse': 'sndSnareHouse',
  'SnareVapor': 'sndSnareVapor',
  'Clap': 'sndClapHit',
  'ClapHit': 'sndClapHit',
  'ClapHitEcho': 'sndClapHitEcho',
  'Hat': 'sndHat',
  'HatHouse': 'sndHatHouse',
  'Chuck': 'sndChuck',
  'Hammer': 'sndHammer',
  'Shaker': 'sndShaker',
  'ShakerLoud': 'sndShakerLoud',
  'Sidestick': 'sndSidestick',
  'Stick': 'sndStick',
  'ReverbClack': 'sndReverbClack',
  'ReverbClap': 'sndReverbClap',
  'Squareshot': 'sndSquareshot',
  'FireTile': 'sndFireTile',
  'IceTile': 'sndIceTile',
  'PowerUp': 'sndPowerUp',
  'PowerDown': 'sndPowerDown',
  'VehiclePositive': 'sndVehiclePositive',
  'VehicleNegative': 'sndVehicleNegative',
  'Sizzle': 'sndSizzle',
  'None': '',
};

// Audio buffer cache using AudioContext
let audioContext: AudioContext | null = null;
const audioBufferCache: Map<string, AudioBuffer> = new Map();

// Get or create AudioContext
export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// Load audio buffer from dataURL in JSON
async function loadAudioBuffer(key: string): Promise<AudioBuffer | null> {
  if (!key) return null;
  if (audioBufferCache.has(key)) {
    return audioBufferCache.get(key)!;
  }
  
  try {
    const dataURL = (audioData as Record<string, string>)[key];
    if (!dataURL) {
      console.warn(`[HitsoundManager] Sound "${key}" not found in audio_data.json`);
      return null;
    }
    
    // Extract base64 data from dataURL
    const base64Match = dataURL.match(/^data:audio\/\w+;base64,(.+)$/);
    if (!base64Match) {
      console.warn(`[HitsoundManager] Invalid dataURL format for "${key}"`);
      return null;
    }
    
    const base64 = base64Match[1];
    const binary = atob(base64);
    const arrayBuffer = new ArrayBuffer(binary.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < binary.length; i++) {
      uint8Array[i] = binary.charCodeAt(i);
    }
    
    const audioBuffer = await getAudioContext().decodeAudioData(arrayBuffer);
    audioBufferCache.set(key, audioBuffer);
    console.log(`[HitsoundManager] Loaded "${key}" from JSON dataURL`);
    return audioBuffer;
  } catch (e) {
    console.warn(`[HitsoundManager] Failed to load audio buffer: ${key}`, e);
    return null;
  }
}

/**
 * Hitsound Manager class
 * Pre-synthesizes hitsounds at load time for perfect timing
 */
export class HitsoundManager {
  private hitsoundType: HitsoundType = 'Kick';
  private volume: number = 100; // 0-100
  private enabled: boolean = true;
  private currentBuffer: AudioBuffer | null = null;
  private gainNode: GainNode | null = null;
  
  // Pre-synthesized hitsound track
  private synthesizedBuffer: AudioBuffer | null = null;
  private synthesizedSource: AudioBufferSourceNode | null = null;
  private scheduledTimestamps: number[] = [];
  private totalDuration: number = 0;
  
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
    
    const key = hitsoundKeyMap[type];
    if (key) {
      this.currentBuffer = await loadAudioBuffer(key);
      console.log(`[HitsoundManager] Preloaded hitsound type "${type}", buffer:`, !!this.currentBuffer);
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
      this.stop();
    }
  }

  /**
   * Pre-synthesize hitsound track at level load time
   * @param timestamps Array of times (in seconds) to play hitsounds
   * @param totalDuration Total duration of the level in seconds
   */
  async preSynthesize(timestamps: number[], totalDuration: number): Promise<void> {
    console.log('[HitsoundManager] preSynthesize called, timestamps:', timestamps.length, 'duration:', totalDuration);
    
    // Wait for buffer to load if not ready
    if (!this.currentBuffer && this.hitsoundType !== 'None') {
      console.log('[HitsoundManager] Waiting for buffer to load...');
      const key = hitsoundKeyMap[this.hitsoundType];
      if (key) {
        this.currentBuffer = await loadAudioBuffer(key);
      }
    }
    
    console.log('[HitsoundManager] currentBuffer:', !!this.currentBuffer, 'hitsoundType:', this.hitsoundType);
    
    if (!this.currentBuffer || this.hitsoundType === 'None') {
      console.warn('[HitsoundManager] No currentBuffer or hitsoundType is None');
      this.synthesizedBuffer = null;
      return;
    }
    
    this.scheduledTimestamps = [...timestamps].sort((a, b) => a - b);
    this.totalDuration = totalDuration;
    
    const ctx = getAudioContext();
    const sampleRate = ctx.sampleRate;
    const hitDuration = this.currentBuffer.duration;
    const numChannels = this.currentBuffer.numberOfChannels;
    
    console.log('[HitsoundManager] Synthesizing - sampleRate:', sampleRate, 'hitDuration:', hitDuration, 'numChannels:', numChannels);
    
    // Calculate total buffer length (add some padding at the end for last hitsound)
    const bufferLength = Math.ceil((totalDuration + hitDuration + 1) * sampleRate);
    
    // Create offline context for synthesis
    const offlineCtx = new OfflineAudioContext(numChannels, bufferLength, sampleRate);
    
    // Get the hitsound data
    const hitBuffer = this.currentBuffer;
    
    // Place each hitsound at its timestamp
    let placedCount = 0;
    for (const t of this.scheduledTimestamps) {
      if (t < 0) continue; // Skip negative timestamps
      
      const source = offlineCtx.createBufferSource();
      source.buffer = hitBuffer;
      source.connect(offlineCtx.destination);
      source.start(t);
      placedCount++;
    }
    
    console.log('[HitsoundManager] Placed', placedCount, 'hitsounds in offline context');
    
    // Render the synthesized buffer
    try {
      this.synthesizedBuffer = await offlineCtx.startRendering();
      console.log(`[HitsoundManager] Pre-synthesized ${placedCount} hitsounds, duration: ${totalDuration.toFixed(2)}s, buffer duration: ${this.synthesizedBuffer.duration.toFixed(2)}s`);
    } catch (e) {
      console.error('[HitsoundManager] Failed to synthesize hitsounds:', e);
      this.synthesizedBuffer = null;
    }
  }

  /**
   * Start playing the pre-synthesized hitsound track
   * @param delay Delay in seconds before starting playback
   */
  start(delay: number = 0): void {
    console.log('[HitsoundManager] start called, delay:', delay, 'enabled:', this.enabled, 'hasBuffer:', !!this.synthesizedBuffer);
    if (!this.enabled || !this.synthesizedBuffer) {
      console.warn('[HitsoundManager] Cannot start - enabled:', this.enabled, 'synthesizedBuffer:', !!this.synthesizedBuffer);
      return;
    }
    
    this.stop();
    
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      console.log('[HitsoundManager] Resuming suspended AudioContext');
      ctx.resume();
    }
    
    this.synthesizedSource = ctx.createBufferSource();
    this.synthesizedSource.buffer = this.synthesizedBuffer;
    this.synthesizedSource.connect(this.getGainNode());
    
    // Cleanup after playback
    this.synthesizedSource.onended = () => {
      if (this.synthesizedSource) {
        try {
          this.synthesizedSource.disconnect();
        } catch (e) {}
        this.synthesizedSource = null;
      }
    };
    
    // Start at ctx.currentTime + delay
    const startTime = ctx.currentTime + delay;
    console.log('[HitsoundManager] Starting playback at', startTime, '(currentTime:', ctx.currentTime, ')');
    this.synthesizedSource.start(startTime);
  }

  /**
   * Start playing from a specific offset (for resume after pause)
   * @param offset Offset in seconds from the beginning of the track
   */
  startAtOffset(offset: number): void {
    if (!this.enabled || !this.synthesizedBuffer) return;
    
    this.stop();
    
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    
    this.synthesizedSource = ctx.createBufferSource();
    this.synthesizedSource.buffer = this.synthesizedBuffer;
    this.synthesizedSource.connect(this.getGainNode());
    
    // Cleanup after playback
    this.synthesizedSource.onended = () => {
      if (this.synthesizedSource) {
        try {
          this.synthesizedSource.disconnect();
        } catch (e) {}
        this.synthesizedSource = null;
      }
    };
    
    // start(when, offset, duration) - play from offset immediately
    const remainingDuration = this.synthesizedBuffer.duration - offset;
    if (remainingDuration > 0) {
      this.synthesizedSource.start(0, offset, remainingDuration);
    }
  }

  /**
   * Stop playing
   */
  stop(): void {
    if (this.synthesizedSource) {
      try {
        this.synthesizedSource.stop();
        this.synthesizedSource.disconnect();
      } catch (e) {}
      this.synthesizedSource = null;
    }
  }

  /**
   * Play single hit sound (for real-time fallback)
   */
  play(): void {
    if (!this.enabled || this.hitsoundType === 'None' || !this.currentBuffer) return;
    
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    
    const source = ctx.createBufferSource();
    source.buffer = this.currentBuffer;
    source.connect(this.getGainNode());
    
    source.onended = () => {
      try {
        source.disconnect();
      } catch (e) {}
    };
    
    source.start(0);
  }
  
  /**
   * Check if hitsounds are pre-synthesized
   */
  isSynthesized(): boolean {
    return this.synthesizedBuffer !== null;
  }
  
  /**
   * Dispose and clear
   */
  dispose(): void {
    this.stop();
    this.currentBuffer = null;
    this.synthesizedBuffer = null;
    this.scheduledTimestamps = [];
    this.gainNode = null;
  }
}