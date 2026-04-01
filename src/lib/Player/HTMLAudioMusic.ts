import { IMusic } from './types';

/**
 * Audio context shared between music and hitsounds for synchronized playback
 */
let sharedAudioContext: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioContext;
}

export class HTMLAudioMusic implements IMusic {
  private _audio: HTMLAudioElement;
  private _isPlaying: boolean = false;
  private _isPaused: boolean = false;
  
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  
  // For AudioContext-synchronized timing
  private contextStartTime: number = 0;  // AudioContext.currentTime when playback started
  private audioStartOffset: number = 0;  // The offset within the audio when playback started
  
  // Scheduled playback
  private scheduledPlayTime: number = -1;

  constructor() {
    this._audio = new Audio();
    this._audio.preload = 'auto';
    this._audio.crossOrigin = 'anonymous';
  }

  // Expose audio as readonly for interface compatibility
  get audio(): HTMLAudioElement | undefined {
    return this._audio;
  }

  private initAudioContext(): void {
    // Use shared audio context for synchronization with hitsounds
    this.audioContext = getSharedAudioContext();
    
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    if (this.source) {
      return; // Already initialized
    }
    
    try {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      this.source = this.audioContext.createMediaElementSource(this._audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    } catch (e) {
      console.warn("AudioContext failed:", e);
    }
  }

  load(src: string): void {
    this._audio.src = src;
    this._audio.load();
  }

  play(): void {
    this.initAudioContext();
    this._audio.play().catch(e => console.error("Audio play failed", e));
    
    // Record sync time
    if (this.audioContext) {
      this.contextStartTime = this.audioContext.currentTime;
      this.audioStartOffset = this._audio.currentTime;
    }
    
    this._isPlaying = true;
    this._isPaused = false;
  }

  /**
   * Play at a specific AudioContext time for precise synchronization
   * @param when The AudioContext.currentTime to start playback
   * @param offset Optional offset in seconds within the audio
   */
  playScheduled(when: number, offset: number = 0): void {
    this.initAudioContext();
    
    if (!this.audioContext) {
      this.play();
      return;
    }
    
    const now = this.audioContext.currentTime;
    const delay = Math.max(0, when - now);
    
    // Set the start position
    if (offset > 0) {
      this._audio.currentTime = offset;
      this.audioStartOffset = offset;
    } else {
      this.audioStartOffset = 0;
    }
    
    this.contextStartTime = when;
    this.scheduledPlayTime = when;
    
    // Use setTimeout for approximate timing (HTMLAudioElement doesn't support precise scheduling)
    // We'll adjust the timing in getAudioTime()
    setTimeout(() => {
      if (this.scheduledPlayTime === when) {
        this._audio.play().catch(e => console.error("Audio play failed", e));
        this._isPlaying = true;
        this._isPaused = false;
      }
    }, delay * 1000);
  }

  pause(): void {
    // Store current position before pausing
    if (this.audioContext && this._isPlaying) {
      this.audioStartOffset = this.getAudioTime();
    }
    
    this._audio.pause();
    this._isPlaying = false;
    this._isPaused = true;
    this.scheduledPlayTime = -1;
  }

  stop(): void {
    this._audio.pause();
    this._audio.currentTime = 0;
    this._isPlaying = false;
    this._isPaused = false;
    this.contextStartTime = 0;
    this.audioStartOffset = 0;
    this.scheduledPlayTime = -1;
  }

  resume(): void {
    if (this._isPaused || (this._audio.paused && this._audio.currentTime > 0)) {
      this.play();
    }
  }

  seek(position: number): void {
    this._audio.currentTime = position;
    
    // Update sync offset
    if (this.audioContext && this._isPlaying) {
      this.audioStartOffset = position;
      this.contextStartTime = this.audioContext.currentTime;
    }
  }

  /**
   * Get current playback position from AudioContext's time reference
   * This ensures synchronization with hitsounds that use AudioContext
   */
  get position(): number {
    return this.getAudioTime();
  }

  /**
   * Get audio time synchronized with AudioContext
   */
  getAudioTime(): number {
    if (!this.audioContext || !this._isPlaying) {
      return this._audio.currentTime;
    }
    
    // Calculate position based on AudioContext time
    const elapsed = this.audioContext.currentTime - this.contextStartTime;
    const pitch = this._audio.playbackRate;
    const calculatedPosition = this.audioStartOffset + elapsed * pitch;
    
    // Clamp to valid range
    const duration = this._audio.duration || 0;
    if (duration > 0 && calculatedPosition > duration) {
      return duration;
    }
    
    return Math.max(0, calculatedPosition);
  }

  /**
   * Get AudioContext.currentTime for synchronization
   */
  get contextTime(): number {
    return this.audioContext?.currentTime ?? 0;
  }

  get duration(): number {
    return this._audio.duration;
  }

  get volume(): number {
    return this._audio.volume;
  }

  set volume(v: number) {
    this._audio.volume = v;
  }

  get pitch(): number {
    return this._audio.playbackRate;
  }

  set pitch(v: number) {
    this._audio.playbackRate = v;
  }

  get isPlaying(): boolean {
      return !this._audio.paused && !this._audio.ended;
  }

  get isPaused(): boolean {
      return this._audio.paused && !this._audio.ended && this._audio.currentTime > 0;
  }

  get hasAudio(): boolean {
      // Check if src is set and valid
      return !!this._audio.src && this._audio.src !== window.location.href;
  }

  get amplitude(): number {
    if (!this.analyser || !this.dataArray) return 0;
    // Cast to any to bypass strict type checking for Uint8Array buffer types
    this.analyser.getByteTimeDomainData(this.dataArray as any);
    
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const v = (this.dataArray[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / this.dataArray.length);
  }

  dispose(): void {
    this.stop();
    this._audio.src = '';
    this._audio.remove();
    // Don't close shared audio context - it's shared with hitsounds
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {}
      this.source = null;
    }
  }
}
