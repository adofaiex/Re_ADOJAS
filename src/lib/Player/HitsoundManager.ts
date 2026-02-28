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
const hitsoundFileMap: Record<string, string> = {
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
const audioSourcePool: Map<string, AudioBufferSourceNode[]> = new Map();

// Get or create AudioContext
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// Load audio buffer
async function loadAudioBuffer(fileName: string): Promise<AudioBuffer | null> {
  if (audioBufferCache.has(fileName)) {
    return audioBufferCache.get(fileName)!;
  }
  
  try {
    const response = await fetch(`/src/sounds/${fileName}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await getAudioContext().decodeAudioData(arrayBuffer);
    audioBufferCache.set(fileName, audioBuffer);
    return audioBuffer;
  } catch (e) {
    console.warn(`Failed to load audio buffer: ${fileName}`, e);
    return null;
  }
}

// Play audio buffer
function playAudioBuffer(buffer: AudioBuffer, volume: number): void {
  const ctx = getAudioContext();
  
  // Resume context if suspended (needed for autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  
  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;
  
  source.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  source.start(0);
}

/**
 * Hitsound Manager class
 */
export class HitsoundManager {
  private hitsoundType: HitsoundType = 'Kick';
  private volume: number = 100; // 0-100
  private enabled: boolean = true;
  private currentBuffer: AudioBuffer | null = null;
  
  constructor(hitsoundType: HitsoundType = 'Kick', volume: number = 100) {
    this.hitsoundType = hitsoundType;
    this.volume = volume;
    this.preloadHitsound(hitsoundType);
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
    this.hitsoundType = type;
    this.preloadHitsound(type);
  }
  
  /**
   * Set volume (0-100)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
  }
  
  /**
   * Enable or disable hitsounds
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Play hit sound
   */
  play(): void {
    if (!this.enabled || this.hitsoundType === 'None') return;
    
    // Use cached buffer if available
    if (this.currentBuffer) {
      playAudioBuffer(this.currentBuffer, this.volume / 100);
      return;
    }
    
    // Fallback: try to load and play
    const fileName = hitsoundFileMap[this.hitsoundType];
    if (fileName) {
      loadAudioBuffer(fileName).then(buffer => {
        if (buffer) {
          this.currentBuffer = buffer;
          playAudioBuffer(buffer, this.volume / 100);
        }
      });
    }
  }
  
  /**
   * Play a specific hitsound type (one-shot)
   */
  async playType(type: HitsoundType, volume?: number): Promise<void> {
    if (type === 'None') return;
    
    const fileName = hitsoundFileMap[type];
    if (!fileName) return;
    
    const buffer = await loadAudioBuffer(fileName);
    if (buffer) {
      playAudioBuffer(buffer, (volume ?? this.volume) / 100);
    }
  }
  
  /**
   * Dispose and clear cache
   */
  dispose(): void {
    this.currentBuffer = null;
    // Don't clear the global cache - other instances might use it
  }
}

