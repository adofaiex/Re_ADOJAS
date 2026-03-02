import { IMusic } from './types';

export class HTMLAudioMusic implements IMusic {
  private audio: HTMLAudioElement;
  private _isPlaying: boolean = false;
  private _isPaused: boolean = false;
  
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
  }

  private initAudioContext(): void {
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      return;
    }
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      this.source = this.audioContext.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    } catch (e) {
      console.warn("AudioContext failed:", e);
    }
  }

  load(src: string): void {
    this.audio.src = src;
    this.audio.load();
  }

  play(): void {
    this.initAudioContext();
    this.audio.play().catch(e => console.error("Audio play failed", e));
    this._isPlaying = true;
    this._isPaused = false;
  }

  pause(): void {
    this.audio.pause();
    this._isPlaying = false;
    this._isPaused = true;
  }

  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this._isPlaying = false;
    this._isPaused = false;
  }

  resume(): void {
    if (this._isPaused || (this.audio.paused && this.audio.currentTime > 0)) {
      this.play();
    }
  }

  seek(position: number): void {
    this.audio.currentTime = position;
  }

  get position(): number {
    return this.audio.currentTime;
  }

  get duration(): number {
    return this.audio.duration;
  }

  get volume(): number {
    return this.audio.volume;
  }

  set volume(v: number) {
    this.audio.volume = v;
  }

  get pitch(): number {
    return this.audio.playbackRate;
  }

  set pitch(v: number) {
    this.audio.playbackRate = v;
  }

  get isPlaying(): boolean {
      return !this.audio.paused && !this.audio.ended;
  }

  get isPaused(): boolean {
      return this.audio.paused && !this.audio.ended && this.audio.currentTime > 0;
  }

  get hasAudio(): boolean {
      // Check if src is set and valid
      return !!this.audio.src && this.audio.src !== window.location.href;
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
    this.audio.src = '';
    this.audio.remove();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
