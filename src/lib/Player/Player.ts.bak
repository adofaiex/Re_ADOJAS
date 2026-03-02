import * as THREE from 'three';
import {WebGPURenderer} from 'three/webgpu';
import { IPlayer, ILevelData, IMusic, TargetFramerateType } from './types';
import { Planet } from './Planet';
import { HitsoundManager, HitsoundType } from './HitsoundManager';
import { BloomEffect } from './BloomEffect';
import createTrackMesh from '../Geo/mesh_reserve';
import { getWorkerManager, disposeWorkerManager } from '../Geo/tileWorkerManager';

// Easing Functions
const EasingFunctions: { [key: string]: (t: number) => number } = {
    Linear: (t) => t,
    InSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
    OutSine: (t) => Math.sin((t * Math.PI) / 2),
    InOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    InQuad: (t) => t * t,
    OutQuad: (t) => 1 - (1 - t) * (1 - t),
    InOutQuad: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    InCubic: (t) => t * t * t,
    OutCubic: (t) => 1 - Math.pow(1 - t, 3),
    InOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    InQuart: (t) => t * t * t * t,
    OutQuart: (t) => 1 - Math.pow(1 - t, 4),
    InOutQuart: (t) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
    InQuint: (t) => t * t * t * t * t,
    OutQuint: (t) => 1 - Math.pow(1 - t, 5),
    InOutQuint: (t) => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
    InExpo: (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
    OutExpo: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    InOutExpo: (t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    InCirc: (t) => 1 - Math.sqrt(1 - Math.pow(t, 2)),
    OutCirc: (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
    InOutCirc: (t) => t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
    InBack: (t) => { const c1 = 1.70158; const c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
    OutBack: (t) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    InOutBack: (t) => { const c1 = 1.70158; const c2 = c1 * 1.525; return t < 0.5 ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2 : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2; },
    InElastic: (t) => { const c4 = (2 * Math.PI) / 3; return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4); },
    OutElastic: (t) => { const c4 = (2 * Math.PI) / 3; return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1; },
    InOutElastic: (t) => { const c5 = (2 * Math.PI) / 4.5; return t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2 : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1; },
    InBounce: (t) => 1 - EasingFunctions.OutBounce(1 - t),
    OutBounce: (t) => { const n1 = 7.5625; const d1 = 2.75; if (t < 1 / d1) { return n1 * t * t; } else if (t < 2 / d1) { return n1 * (t -= 1.5 / d1) * t + 0.75; } else if (t < 2.5 / d1) { return n1 * (t -= 2.25 / d1) * t + 0.9375; } else { return n1 * (t -= 2.625 / d1) * t + 0.984375; } },
    InOutBounce: (t) => t < 0.5 ? (1 - EasingFunctions.OutBounce(1 - 2 * t)) / 2 : (1 + EasingFunctions.OutBounce(2 * t - 1)) / 2,
    Unset: (t) => t
};

// Helper function to check if an event is active (should be processed)
// active: undefined | true | "" | "Enabled" -> active (process event)
// active: false | "Disabled" -> inactive (skip event)
const isEventActive = (event: any): boolean => {
    if (event.active === undefined) return true;
    if (event.active === true) return true;
    if (event.active === "") return true;
    if (event.active === "Enabled") return true;
    if (event.active === false) return false;
    if (event.active === "Disabled") return false;
    // Default to active for unknown values
    return true;
};

class HTMLAudioMusic implements IMusic {
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

export class Player implements IPlayer {
  private container: HTMLElement | null = null;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer | WebGPURenderer;
  private rendererType: 'webgl' | 'webgpu' = 'webgpu';
  private renderMethod: 'sync' | 'async' = 'sync';
  private showTrail: boolean = false;
  private useWorker: boolean = true;
  private targetFramerate: TargetFramerateType = 'auto';
  private animationId: number | null = null;
  private lastFrameTime: number = 0;
  private frameInterval: number = 0; // milliseconds between frames
  
  private levelData: ILevelData;
  private planetRed: Planet | null = null;
  private planetBlue: Planet | null = null;
  private currentPivotPosition: { x: number; y: number } = { x: 0, y: 0 };

  // Tile Management
  private tiles: Map<string, THREE.Mesh> = new Map();
  private visibleTiles: Set<string> = new Set();
  private tileLimit: number = 0; // 0 means no limit? Or use a sensible default
  
  // Spatial indexing for fast visibility checks
  private spatialGrid: Map<number, number[]> = new Map();
  private spatialGridSize: number = 5; // Grid cell size in world units
  
  // Shared decoration geometries and materials (prevent creating new ones for each tile)
  private sharedDecoGeometry: THREE.CircleGeometry | null = null;
  private sharedTwirlMaterial: THREE.MeshBasicMaterial | null = null;
  private sharedSpeedUpMaterial: THREE.MeshBasicMaterial | null = null;
  private sharedSpeedDownMaterial: THREE.MeshBasicMaterial | null = null;
  
  // Hitsound
  private hitsoundManager: HitsoundManager;
  
  // Playback state
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private elapsedTime: number = 0;
  
  private currentTileIndex: number = 0;
  
  // Camera settings
  private zoom: number = 1;
  private zoomMultiplier: number = 1.0;
  private cameraPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  
  // Interaction state
  private isDragging: boolean = false;
  private previousMousePosition: { x: number; y: number } = { x: 0, y: 0 };
  private initialPinchDistance: number = 0;
  private initialZoom: number = 0;
  
  private boundHandlers: { [key: string]: EventListenerOrEventListenerObject } = {};

  // Stats callback
  private onStatsUpdate: ((stats: { fps: number; time: number; tileIndex: number }) => void) | null = null;
  private frameCount: number = 0;
  private lastTime: number = 0;

  // Precalculated rotations and timing
  private cumulativeRotations: number[] = [];
  private totalLevelRotation: number = 0;
  
  private tileStartTimes: number[] = [];
  private tileDurations: number[] = [];
  private tileExtraRotations: number[] = [];
  private tileIsCW: boolean[] = [];
  private tileBPM: number[] = [];
  private tileStartAngle: number[] = [];
  private tileTotalAngle: number[] = [];
  private tileStartDist: number[] = [];
  private tileEndDist: number[] = [];
  private tileEvents: Map<number, any[]> = new Map();
  private tileCameraEvents: Map<number, any[]> = new Map();
  private cameraTimeline: { time: number; event: any }[] = [];
  private lastCameraTimelineIndex: number = -1;
  private lastCameraEventTileIndex: number = -1;

  // Camera State
  private cameraMode = {
      relativeTo: 'Player',
      anchorTileIndex: 0, // Used for 'Tile' relativeTo
      position: { x: 0, y: 0 }, // Offset or Global Pos
      zoom: 100,
      rotation: 0,
      angleOffset: 0
  };
  
  private cameraTransition = {
      active: false,
      startTime: 0,
      duration: 0,
      startSnapshot: {
          position: { x: 0, y: 0 },
          zoom: 100,
          rotation: 0,
          logicalPosition: { x: 0, y: 0 },
          logicalZoom: 100,
          logicalRotation: 0
      },
      targetSnapshot: {
          position: { x: 0, y: 0 },
          zoom: 100,
          rotation: 0
      },
      ease: 'Linear'
  };

  private music: IMusic = new HTMLAudioMusic();
  
  // Bloom Effect
  private bloomEffect: BloomEffect | null = null;
  private bloomEnabled: boolean = false;
  private bloomThreshold: number = 50;
  private bloomIntensity: number = 100;
  private bloomColor: string = 'ffffff';
  private bloomTimeline: { time: number; event: any }[] = [];
  private lastBloomTimelineIndex: number = -1;
  
  // Track Color
  private tileColors: { color: string, secondaryColor: string }[] = [];
  private recolorTimeline: { time: number; event: any }[] = [];
  private lastRecolorTimelineIndex: number = -1;
  private tileRecolorConfigs: (any | null)[] = [];
  
  // Shared Renderer Resources
  private sharedTileMaterial: THREE.ShaderMaterial | null = null;
  private geometryCache: Map<string, THREE.BufferGeometry> = new Map();
  private maxCachedTiles: number = 2000; // Only keep this many meshes in memory

  // Video Background
  private videoElement: HTMLVideoElement | null = null;
  private videoTexture: THREE.VideoTexture | null = null;
  private videoMesh: THREE.Mesh | null = null;
  private videoOffset: number = 0; // ms

  // Render target for post-processing
  private renderTarget: THREE.WebGLRenderTarget | null = null;

  constructor(levelData: ILevelData, rendererType: 'webgl' | 'webgpu' = 'webgpu') {
    this.rendererType = rendererType;
    this.levelData = levelData;
    
    // Initialize camera from settings
    this.resetCameraState();
    
    // Parse actions if available
    if (this.levelData.actions) {
      this.levelData.actions.forEach(action => {
        const floor = action.floor;
        if (action.eventType === 'MoveCamera') {
            if (!this.tileCameraEvents.has(floor)) {
                this.tileCameraEvents.set(floor, []);
            }
            this.tileCameraEvents.get(floor)!.push(action);
        } else {
            if (!this.tileEvents.has(floor)) {
                this.tileEvents.set(floor, []);
            }
            this.tileEvents.get(floor)!.push(action);
        }
      });
    }

    // Initialize HitsoundManager
    const hitsoundType = (this.levelData.settings?.hitsound || 'Kick') as HitsoundType;
    const hitsoundVolume = this.levelData.settings?.hitsoundVolume ?? 100;
    this.hitsoundManager = new HitsoundManager(hitsoundType, hitsoundVolume);

    // Initialize Three.js components
    this.scene = new THREE.Scene();
    
    // Set background color from level settings
    const bgColor = this.levelData.settings?.backgroundColor || '000000';
    this.scene.background = new THREE.Color(this.formatHexColor(bgColor));
    
    // Initialize video settings
    this.videoOffset = this.levelData.settings?.vidOffset || 0;

    // Append extra tile at the end
    this.appendExtraTile();

    // Initialize tile colors from settings (now after appendExtraTile)
    this.initTileColors();

    // Calculate cumulative rotations
    this.calculateCumulativeRotations();
    
    // Build Camera Timeline
    this.buildCameraTimeline();
    
    // Build Bloom Timeline
    this.buildBloomTimeline();
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 10, 15);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
    
    // Default camera setup - will be updated on resize/init
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    this.camera.position.z = 10;
    this.scene.add(this.camera);
    
    this.initRenderer();
    
    // Initialize shared decoration resources
    this.initSharedDecorationResources();
    
    // Build spatial index for fast visibility checks
    this.buildSpatialIndex();

    // Pre-calculate hitsound schedule (Moved from startPlay to init for performance)
    this.recalculateHitsoundSchedule();
  }

  private recalculateHitsoundSchedule(): void {
    if (!this.tileStartTimes || this.tileStartTimes.length === 0) return;
    
    // We don't call scheduleAll here because AudioContext might be suspended 
    // and we don't have the real startTime yet. 
    // But we ensure tileStartTimes are ready.
  }
  
  /**
   * Build spatial index for fast visibility checks
   * Groups tiles into grid cells for O(1) lookup
   */
  private buildSpatialIndex(): void {
    this.spatialGrid.clear();
    const tiles = this.levelData.tiles;
    if (!tiles) return;
    
    const gridSize = this.spatialGridSize;
    for (let i = 0; i < tiles.length; i++) {
      const pos = tiles[i].position;
      const cellX = Math.floor(pos[0] / gridSize);
      const cellY = Math.floor(pos[1] / gridSize);
      const key = cellX * 100000 + cellY; 
      
      let list = this.spatialGrid.get(key);
      if (list === undefined) {
        list = [];
        this.spatialGrid.set(key, list);
      }
      list.push(i);
    }
  }
  
  private appendExtraTile(): void {
    const tiles = this.levelData.tiles;
    if (!tiles || tiles.length === 0) return;

    const lastTile = tiles[tiles.length - 1];
    
    // Determine length from last segment if possible
    let length = 1.0; 
    if (tiles.length > 1) {
       for (let i = tiles.length - 1; i > 0; i--) {
           const cur = tiles[i];
           const prev = tiles[i-1];
           const dx = cur.position[0] - prev.position[0];
           const dy = cur.position[1] - prev.position[1];
           const dist = Math.sqrt(dx*dx + dy*dy);
           if (dist > 0.01) {
               length = dist;
               break;
           }
       }
    }
    
    // Direction (absolute angle in degrees)
    const direction = lastTile.direction !== undefined ? lastTile.direction : 0;
    const rad = (direction * Math.PI) / 180;
    const newX = lastTile.position[0] + Math.cos(rad) * length;
    const newY = lastTile.position[1] + Math.sin(rad) * length;
    
    const newTile = {
        ...lastTile,
        position: [newX, newY],
        angle: 180,
        direction: direction,
        index: tiles.length
    };
    
    tiles.push(newTile);
  }

  private calculateCumulativeRotations(): void {
    const tiles = this.levelData.tiles;
    if (!tiles || tiles.length === 0) return;

    const n = tiles.length;
    this.cumulativeRotations = new Array(n);
    this.tileStartTimes = new Array(n);
    this.tileDurations = new Array(n - 1);
    this.tileExtraRotations = new Array(n);
    this.tileIsCW = new Array(n);
    this.tileBPM = new Array(n);
    this.tileStartAngle = new Array(n - 1);
    this.tileTotalAngle = new Array(n - 1);
    this.tileStartDist = new Array(n - 1);
    this.tileEndDist = new Array(n - 1);
    
    this.cumulativeRotations[0] = 0;
    this.tileStartTimes[0] = 0;
    
    let totalRotation = 0;
    let totalTime = 0;
    
    // Initial settings
    let currentBPM = this.levelData.settings.bpm || 100;
    let isCW = true;

    // We iterate through tiles to calculate the rotation/time to reach the NEXT tile.
    for (let i = 0; i < n - 1; i++) {
        // Process events for current tile
        let extraRotation = 0;
        const events = this.tileEvents.get(i);
        if (events) {
            for (let j = 0; j < events.length; j++) {
                const event = events[j];
                if (!isEventActive(event)) continue;
                
                if (event.eventType === 'Twirl') {
                    isCW = !isCW;
                } else if (event.eventType === 'SetSpeed') {
                    if (event.speedType === 'Multiplier') {
                        currentBPM *= event.bpmMultiplier;
                    } else {
                        currentBPM = event.beatsPerMinute;
                    }
                } else if (event.eventType === 'Pause') {
                    extraRotation += (event.duration || 0) / 2.0;
                }
            }
        }
        
        this.tileIsCW[i] = isCW;
        this.tileBPM[i] = currentBPM;
        
        const pivot = tiles[i];
        const next = tiles[i + 1];

        let startAngle = 0;
        if (i === 0) {
            startAngle = ((this.levelData.settings.rotation || 0) + 180) * Math.PI / 180;
        } else {
            const prev = tiles[i - 1];
            startAngle = Math.atan2(prev.position[1] - pivot.position[1], prev.position[0] - pivot.position[0]);
        }

        const relativeAngle = (pivot.angle !== undefined) ? pivot.angle : 180;
        let totalAngle = (relativeAngle * Math.PI) / 180;
        if (isCW) totalAngle = -totalAngle;

        if (isCW) totalAngle -= extraRotation * 2 * Math.PI;
        else totalAngle += extraRotation * 2 * Math.PI;

        const rotationAmount = Math.abs(totalAngle) / (2 * Math.PI);
        const duration = (rotationAmount * 2) * (60 / currentBPM);
        
        totalRotation += rotationAmount;
        totalTime += duration;
        
        this.tileStartAngle[i] = startAngle;
        this.tileTotalAngle[i] = totalAngle;
        
        let startDist = 1.0;
        if (i > 0) {
            const prev = tiles[i - 1];
            const pdx = prev.position[0] - pivot.position[0];
            const pdy = prev.position[1] - pivot.position[1];
            startDist = Math.sqrt(pdx*pdx + pdy*pdy);
        }
        this.tileStartDist[i] = startDist;
        
        const edx = next.position[0] - pivot.position[0];
        const edy = next.position[1] - pivot.position[1];
        this.tileEndDist[i] = Math.sqrt(edx*edx + edy*edy);

        this.cumulativeRotations[i+1] = totalRotation;
        this.tileDurations[i] = duration;
        this.tileExtraRotations[i] = extraRotation;
        this.tileStartTimes[i+1] = totalTime;
    }
    
    // Shift all tileStartTimes so that tileStartTimes[1] is 0
    if (n > 1) {
        const shift = this.tileStartTimes[1];
        for (let i = 0; i < n; i++) {
             this.tileStartTimes[i] -= shift;
        }
    }
    
    // Handle the last tile
    if (n > 0) {
        const lastIndex = n - 1;
        let extraRotation = 0;
        const events = this.tileEvents.get(lastIndex);
        if (events) {
            for (let j = 0; j < events.length; j++) {
                const event = events[j];
                if (!isEventActive(event)) continue;
                if (event.eventType === 'Twirl') isCW = !isCW;
                else if (event.eventType === 'SetSpeed') {
                    if (event.speedType === 'Multiplier') currentBPM *= event.bpmMultiplier;
                    else currentBPM = event.beatsPerMinute;
                } else if (event.eventType === 'Pause') {
                    extraRotation += (event.duration || 0) / 2.0;
                }
            }
        }
        this.tileIsCW[lastIndex] = isCW;
        this.tileBPM[lastIndex] = currentBPM;
        this.tileExtraRotations[lastIndex] = extraRotation;
    }
    
    this.totalLevelRotation = totalRotation;
  }

  private isRestoringContext: boolean = false;
  private webgpuSupported: boolean | null = null; // null = not checked, true = supported, false = not supported
  private rendererInitialized: boolean = false;

  private initRenderer(): void {
    // If already initialized and not switching, skip
    if (this.rendererInitialized && this.renderer) {
      return;
    }

    console.log('Initializing renderer (type:', this.rendererType, ')');

    // Clean up old renderer safely
    const oldRenderer = this.renderer;
    if (oldRenderer) {
      try {
        // Check if renderer is properly initialized before disposing
        const hasBackend = (oldRenderer as any).backend !== undefined && (oldRenderer as any).backend !== null;
        if (hasBackend || this.rendererType === 'webgl') {
          if (this.container && oldRenderer.domElement && oldRenderer.domElement.parentNode === this.container) {
            this.container.removeChild(oldRenderer.domElement);
          }
          oldRenderer.dispose();
        }
      } catch (e) {
        console.warn('Error disposing old renderer:', e);
      }
      this.renderer = null as any;
    }

    // Check WebGPU support only once
    if (this.webgpuSupported === null) {
      this.webgpuSupported = this.checkWebGPUSupport();
    }

    if (this.rendererType === 'webgpu' && this.webgpuSupported) {
      try {
        const gpuRenderer = new WebGPURenderer({ alpha: true, antialias: true });
        this.renderer = gpuRenderer;
        this.rendererInitialized = true;

        // Handle WebGPU device loss
        (gpuRenderer as any).init().then(() => {
          const device = (gpuRenderer as any).backend.device;
          if (device) {
            device.lost.then((info: any) => {
              console.warn('WebGPU device lost:', info.message);
              if (info.reason !== 'destroyed') {
                this.rendererInitialized = false;
                this.initRenderer();
              }
            });
          }
        }).catch((e: Error) => {
          console.warn('WebGPU initialization failed in init():', e);
        });
      } catch (e) {
        console.warn('WebGPU initialization failed, falling back to WebGL:', e);
        this.rendererType = 'webgl';
      }
    }
    
    // Create WebGL renderer if WebGPU not used
    if (!this.rendererInitialized) {
      if (this.rendererType === 'webgpu') {
        console.warn('WebGPU not supported, using WebGL');
        this.rendererType = 'webgl';
      }
      
      try {
        this.renderer = new THREE.WebGLRenderer({ 
          alpha: true, 
          antialias: true,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false,
        });
        this.rendererInitialized = true;
      } catch (e) {
        console.error('Failed to create WebGL renderer:', e);
        // Try with minimal settings
        try {
          this.renderer = new THREE.WebGLRenderer({ 
            alpha: false, 
            antialias: false,
          });
          this.rendererInitialized = true;
        } catch (e2) {
          console.error('Failed to create even basic WebGL renderer:', e2);
          return;
        }
      }
    }
    
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Initialize Bloom Effect (WebGL only)
    if (this.rendererType === 'webgl') {
      this.bloomEffect = new BloomEffect();
    }
    
    // Handle WebGL context loss (only add once)
    if (this.rendererType === 'webgl' && !this.isRestoringContext) {
      const canvas = this.renderer.domElement;
      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        console.warn('WebGL context lost, will attempt to restore...');
        this.isRestoringContext = true;
        this.rendererInitialized = false;
      }, false);
      
      canvas.addEventListener('webglcontextrestored', () => {
        console.log('WebGL context restored');
        this.isRestoringContext = false;
        // Next render frame will trigger re-initialization via initRenderer
        this.onWindowResize();
      }, false);
    }
    
    // If container exists (runtime switch), re-attach
    if (this.container) {
      this.container.appendChild(this.renderer.domElement);
      this.onWindowResize();
    }
  }

  /**
   * Check if WebGPU is supported
   */
  private checkWebGPUSupport(): boolean {
    // Check for WebGPU API
    if (!navigator.gpu) {
      return false;
    }
    
    // Try to get adapter
    try {
      // This is async in reality, but we'll do a basic check
      // The actual adapter request will happen when WebGPURenderer is created
      return true;
    } catch {
      return false;
    }
  }

  public setRenderer(type: 'webgl' | 'webgpu'): void {
    if (this.rendererType === type) return;
    this.rendererType = type;
    this.rendererInitialized = false;
    this.initRenderer();
  }

  public setRenderMethod(method: 'sync' | 'async'): void {
    this.renderMethod = method;
  }

  public setShowTrail(show: boolean): void {
    if (this.showTrail === show) return;
    this.showTrail = show;
    // Recreate planets with new trail setting if they exist
    if (this.planetRed || this.planetBlue) {
      this.removePlanets();
      this.createPlanets();
    }
  }

  public setHitsoundEnabled(enabled: boolean): void {
    this.hitsoundManager.setEnabled(enabled);
  }

  public setUseWorker(use: boolean): void {
    this.useWorker = use;
    const workerManager = getWorkerManager();
    workerManager.setEnabled(use);
  }

  public setTargetFramerate(framerate: TargetFramerateType): void {
    this.targetFramerate = framerate;
    this.updateFrameInterval();
  }

  private updateFrameInterval(): void {
    if (this.targetFramerate === 'auto') {
      // Use monitor refresh rate (no limiting)
      this.frameInterval = 0;
    } else if (this.targetFramerate === 'unlimited') {
      this.frameInterval = 0;
    } else {
      const fps = parseInt(this.targetFramerate, 10);
      this.frameInterval = 1000 / fps; // milliseconds per frame
    }
  }

  private getRefreshRate(): number {
    // Try to get the refresh rate from the display
    if (typeof window !== 'undefined') {
      // Most common refresh rates
      return 60; // Default fallback
    }
    return 60;
  }

  public createPlayer(container: HTMLElement): void {
    this.container = container;
    
    // Append current renderer element
    this.container.appendChild(this.renderer.domElement);
    
    this.onWindowResize();
    
    this.updateVisibleTiles(); // Initial render of tiles
    
    this.setupEventListeners();
    
    this.startRenderLoop();
  }
  
  private setupEventListeners(): void {
    if (!this.container) return;
    
    // Store bound handlers so we can remove them later
    this.boundHandlers = {
      resize: this.onWindowResize.bind(this) as EventListener,
      mousedown: this.onMouseDown.bind(this) as unknown as EventListener,
      mousemove: this.onMouseMove.bind(this) as unknown as EventListener,
      mouseup: this.onMouseUp.bind(this) as unknown as EventListener,
      mouseleave: this.onMouseUp.bind(this) as unknown as EventListener,
      wheel: this.onWheel.bind(this) as unknown as EventListener,
      touchstart: this.onTouchStart.bind(this) as unknown as EventListener,
      touchmove: this.onTouchMove.bind(this) as unknown as EventListener,
      touchend: this.onTouchEnd.bind(this) as unknown as EventListener,
      contextmenu: ((e: Event) => e.preventDefault()) as EventListener,
    };
    
    // Window resize
    window.addEventListener('resize', this.boundHandlers.resize as EventListener);

    // Mouse events
    this.container.addEventListener('mousedown', this.boundHandlers.mousedown as EventListener);
    this.container.addEventListener('mousemove', this.boundHandlers.mousemove as EventListener);
    this.container.addEventListener('mouseup', this.boundHandlers.mouseup as EventListener);
    this.container.addEventListener('mouseleave', this.boundHandlers.mouseleave as EventListener);
    this.container.addEventListener('wheel', this.boundHandlers.wheel as EventListener);
    
    // Touch events
    this.container.addEventListener('touchstart', this.boundHandlers.touchstart as EventListener, { passive: false });
    this.container.addEventListener('touchmove', this.boundHandlers.touchmove as EventListener, { passive: false });
    this.container.addEventListener('touchend', this.boundHandlers.touchend as EventListener);
    
    this.container.addEventListener('contextmenu', this.boundHandlers.contextmenu as EventListener);
  }
  
  private removeEventListeners(): void {
    if (!this.container) return;
    
    if (this.boundHandlers.resize) {
      window.removeEventListener('resize', this.boundHandlers.resize as EventListener);
    }
    
    if (this.boundHandlers.mousedown) {
      this.container.removeEventListener('mousedown', this.boundHandlers.mousedown as EventListener);
      this.container.removeEventListener('mousemove', this.boundHandlers.mousemove as EventListener);
      this.container.removeEventListener('mouseup', this.boundHandlers.mouseup as EventListener);
      this.container.removeEventListener('mouseleave', this.boundHandlers.mouseleave as EventListener);
      this.container.removeEventListener('wheel', this.boundHandlers.wheel as EventListener);
      
      this.container.removeEventListener('touchstart', this.boundHandlers.touchstart as EventListener); // options not needed for removal
      this.container.removeEventListener('touchmove', this.boundHandlers.touchmove as EventListener);
      this.container.removeEventListener('touchend', this.boundHandlers.touchend as EventListener);
      
      this.container.removeEventListener('contextmenu', this.boundHandlers.contextmenu as EventListener);
    }
    
    this.boundHandlers = {};
  }

  // --- Interaction Handlers ---

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 0) { // Left click
      this.isDragging = true;
      this.previousMousePosition = { x: event.clientX, y: event.clientY };
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;

    const deltaX = event.clientX - this.previousMousePosition.x;
    const deltaY = event.clientY - this.previousMousePosition.y;

    // Adjust camera position
    // Scale by zoom level? No, orthographic camera position is world units.
    // But pixel movement needs to be converted to world units.
    
    // Calculate world units per pixel
    const zoom = this.camera.zoom || 1.0;
    const frustumHeight = (this.camera.top - this.camera.bottom) / zoom;
    const unitsPerPixel = frustumHeight / this.container!.clientHeight;

    this.cameraPosition.x -= deltaX * unitsPerPixel;
    this.cameraPosition.y += deltaY * unitsPerPixel; // Y is inverted in screen space vs world space usually
    
    this.camera.position.x = this.cameraPosition.x;
    this.camera.position.y = this.cameraPosition.y;

    this.updateVisibleTiles();

    this.previousMousePosition = { x: event.clientX, y: event.clientY };
  }

  private onMouseUp(): void {
    this.isDragging = false;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    
    const zoomSpeed = 0.1;
    if (event.deltaY < 0) {
      this.zoomMultiplier *= (1 + zoomSpeed);
    } else {
      this.zoomMultiplier /= (1 + zoomSpeed);
    }
    
    // Clamp zoom multiplier
    this.zoomMultiplier = Math.max(0.1, Math.min(this.zoomMultiplier, 10));
    
    this.onWindowResize();
  }

  // Touch support (simplified)
  private onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.isDragging = true;
      this.previousMousePosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    } else if (event.touches.length === 2) {
      this.isDragging = false;
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      this.initialPinchDistance = Math.sqrt(dx*dx + dy*dy);
      this.initialZoom = this.zoomMultiplier;
    }
  }

  private onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (this.isDragging && event.touches.length === 1) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - this.previousMousePosition.x;
      const deltaY = touch.clientY - this.previousMousePosition.y;
      
      const zoom = this.camera.zoom || 1.0;
      const frustumHeight = (this.camera.top - this.camera.bottom) / zoom;
      const unitsPerPixel = frustumHeight / this.container!.clientHeight;
      
      this.cameraPosition.x -= deltaX * unitsPerPixel;
      this.cameraPosition.y += deltaY * unitsPerPixel;
      
      this.camera.position.x = this.cameraPosition.x;
      this.camera.position.y = this.cameraPosition.y;
      
      this.updateVisibleTiles();
      
      this.previousMousePosition = { x: touch.clientX, y: touch.clientY };
    } else if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      if (this.initialPinchDistance > 0) {
        const scale = distance / this.initialPinchDistance;
        this.zoomMultiplier = this.initialZoom * scale;
        this.zoomMultiplier = Math.max(0.1, Math.min(this.zoomMultiplier, 10));
        this.onWindowResize();
      }
    }
  }

  private onTouchEnd(): void {
    this.isDragging = false;
    this.initialPinchDistance = 0;
  }

  public setStatsCallback(callback: (stats: { fps: number; time: number; tileIndex: number }) => void): void {
    this.onStatsUpdate = callback;
  }

  private startRenderLoop(): void {
    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 0;
    let fpsTime = lastTime;

    const animate = (time: number) => {
      this.animationId = requestAnimationFrame(animate);
      
      // Frame rate limiting
      if (this.frameInterval > 0) {
        const elapsed = time - this.lastFrameTime;
        if (elapsed < this.frameInterval) {
          return; // Skip this frame
        }
        this.lastFrameTime = time - (elapsed % this.frameInterval);
      }
      
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      
      if (this.isPlaying && !this.isPaused) {
        this.updatePlayer(delta);
        this.syncVideo();
      }
      
      this.renderPlayer(delta);
      
      // FPS calculation
      frameCount++;
      if (time - fpsTime >= 500) {
        fps = Math.round((frameCount * 1000) / (time - fpsTime));
        frameCount = 0;
        fpsTime = time;
        
        if (this.onStatsUpdate) {
          this.onStatsUpdate({
            fps,
            time: this.elapsedTime,
            tileIndex: this.currentTileIndex
          });
        }
      }
    };
    
    this.animationId = requestAnimationFrame(animate);
  }

  public updatePlayer(delta: number): void {
    if (!this.planetRed || !this.planetBlue) return;

    // Calculate current time
    const settings = this.levelData.settings;
    const initialBPM = settings.bpm || 100;
    const initialSecPerBeat = 60 / initialBPM;
    const countdownTicks = settings.countdownTicks || 4;
    const countdownDuration = countdownTicks * initialSecPerBeat;

    // Use music sync only when music is actively playing (not ended, not paused)
    // music.isPlaying returns true only when audio is actually playing (not ended)
    const musicEnded = this.music.hasAudio && !this.music.isPlaying && !this.music.isPaused && this.elapsedTime > countdownDuration * 1000;
    
    if (this.music.isPlaying && this.music.hasAudio) {
        const musicTime = this.music.position * 1000;
        
        // Sync logic: Only sync if music has actually started (position > 0)
        // This prevents "twitching" (0 -> 50 -> 0) during audio buffering/startup
        if (musicTime > 0) {
            // Expected elapsedTime when music is at musicTime:
            // elapsedTime = musicTime + countdownDuration * 1000
            const expectedElapsedTime = musicTime + countdownDuration * 1000;
            const actualElapsedTime = performance.now() - this.startTime;

            // If drift is significant (> 50ms), hard sync
            if (Math.abs(expectedElapsedTime - actualElapsedTime) > 50) {
                 this.startTime = performance.now() - expectedElapsedTime;
                 this.elapsedTime = expectedElapsedTime;
            } else {
                 this.elapsedTime = actualElapsedTime;
            }
        } else {
            // Music is theoretically playing but position is 0 (loading/buffering)
            // Hold visual time at start of music playback
            const musicStartTime = countdownDuration * 1000;
            this.startTime = performance.now() - musicStartTime;
            this.elapsedTime = musicStartTime;
        }
    } else if (musicEnded) {
        // Music has ended - continue with timer but don't reset
        // Just let elapsedTime continue from where it was
        const now = performance.now();
        this.elapsedTime = now - this.startTime;
    } else {
        // If not playing music (or fallback), use standard timer
        if (this.isPlaying && !this.isPaused) {
             const now = performance.now();
             this.elapsedTime = now - this.startTime;

             // Auto-start music after countdown
             if (this.music.hasAudio && !this.music.isPaused && this.elapsedTime >= countdownDuration * 1000) {
                 this.music.play();
             }
        }
    }
    
    // Logic from original Previewer to update planets
    this.updatePlanetsPosition();
    
    // Update camera to follow
    this.updateCameraFollow(delta);

    // Update animated track colors
    this.updateAnimatedTiles();
  }

  private updateAnimatedTiles(): void {
    const time = this.elapsedTime / 1000;
    
    // Only update visible tiles that have dynamic color types
    this.visibleTiles.forEach(id => {
        const index = parseInt(id);
        const config = this.tileRecolorConfigs[index];
        
        if (config && ['Glow', 'Blink', 'Rainbow', 'Volume'].includes(config.trackColorType)) {
            const rendered = this.getTileRenderer(index, time, config);
            this.applyTileColor(index, rendered.color, rendered.bgcolor);
        }
    });
  }

  public renderPlayer(delta: number): void {
    // If renderer not initialized, try to initialize it
    if (!this.rendererInitialized && !this.isRestoringContext) {
      this.initRenderer();
      return;
    }

    // Skip rendering if context is being restored
    if (this.isRestoringContext) {
      return;
    }
    
    if (this.renderer && this.scene && this.camera) {
      try {
        // For WebGPU, check if backend is initialized
        const isWebGPU = this.rendererType === 'webgpu';
        const backendReady = !isWebGPU || (this.renderer as any).backend !== null;
        
        if (!backendReady) {
          // WebGPU backend not ready, skip this frame
          return;
        }
        
        // Check if WebGL context is lost
        const gl = (this.renderer as any).getContext?.();
        if (gl && gl.isContextLost?.()) {
          return;
        }
        
        // Apply bloom effect if enabled (WebGL only for now)
        if (this.bloomEnabled && !isWebGPU && this.bloomEffect && this.bloomEffect.getEnabled()) {
          // Render to texture first
          if (!this.renderTarget) {
            this.renderTarget = new THREE.WebGLRenderTarget(
              this.container?.clientWidth || window.innerWidth,
              this.container?.clientHeight || window.innerHeight
            );
          }
          
          this.renderer.setRenderTarget(this.renderTarget);
          this.renderer.render(this.scene, this.camera);
          this.renderer.setRenderTarget(null);
          
          // Apply bloom post-processing
          this.bloomEffect.render(this.renderer as THREE.WebGLRenderer, this.renderTarget.texture);
        } else {
          if (this.renderMethod === 'async' || isWebGPU) {
            (this.renderer as any).renderAsync(this.scene, this.camera).catch((e: Error) => {
              console.warn('Render error:', e.message);
            });
          } else {
            this.renderer.render(this.scene, this.camera);
          }
        }
      } catch (e) {
        console.warn('Render error:', e);
      }
    }
  }

  public startPlay(): void {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.isPaused = false;
    this.startTime = performance.now();
    this.elapsedTime = 0;
    this.currentTileIndex = 0;
    
    // Music is started automatically after countdown in updatePlayer
    
    this.createPlanets();
    
    // Reset camera state
    this.lastCameraTimelineIndex = -1;
    this.resetCameraState();
    this.cameraTransition.active = false;
    
    // Build Recolor timeline
    this.buildRecolorTimeline();
    this.lastRecolorTimelineIndex = -1;

    // Calculate delay for countdown and offset
    const settings = this.levelData.settings;
    const initialBPM = settings.bpm || 100;
    const initialSecPerBeat = 60 / initialBPM;
    const countdownTicks = settings.countdownTicks || 4;
    const countdownDuration = countdownTicks * initialSecPerBeat;
    const offset = this.music.hasAudio ? (settings.offset || 0) : 0;
    const totalDelay = countdownDuration + (offset / 1000);

    // Schedule all hitsounds for high performance
    // Fix: Filter midspins (angle: 0) and use precise timing
    const hitsToSchedule: number[] = [];
    for (let i = 1; i < this.tileStartTimes.length; i++) {
        const t = this.tileStartTimes[i];
        const tile = this.levelData.tiles[i];
        if (tile && tile.angle !== 0) {
            // Add totalDelay so it plays exactly when ball hits Tile 1 (t=0)
            hitsToSchedule.push(t + totalDelay);
        }
    }
    this.hitsoundManager.scheduleAll(hitsToSchedule, performance.now());
  }

  private buildCameraTimeline(): void {
      this.cameraTimeline = [];
      const entries: { time: number; event: any }[] = [];
      
      this.tileCameraEvents.forEach((events, floor) => {
          const startTime = this.tileStartTimes[floor] || 0; // seconds
          const bpm = this.tileBPM[floor] || 100;
          const secPerBeat = 60 / bpm;
          
          events.forEach(event => {
              // Skip disabled events
              if (!isEventActive(event)) return;
              
              // Ensure floor is attached to the event for relativeTo: Tile
              const eventWithFloor = { ...event, floor };
              
              // angleOffset is in degrees. 180 degrees = 1 beat.
              const angleOffset = event.angleOffset || 0;
              const timeOffset = (angleOffset / 180) * secPerBeat;
              const eventTime = startTime + timeOffset;
              
              entries.push({ time: eventTime, event: eventWithFloor });
          });
      });
      
      // Sort by time
      entries.sort((a, b) => a.time - b.time);
      this.cameraTimeline = entries;
  }
  
  private buildBloomTimeline(): void {
      this.bloomTimeline = [];
      const entries: { time: number; event: any }[] = [];
      
      this.tileEvents.forEach((events, floor) => {
          const startTime = this.tileStartTimes[floor] || 0;
          const bpm = this.tileBPM[floor] || 100;
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
  
  private processBloomEvent(event: any): void {
      const enabled = event.enabled;
      
      // Check if this is enabling or disabling bloom
      if (enabled === true || enabled === 'Enabled' || enabled === '') {
          this.bloomEnabled = true;
          if (event.threshold !== undefined) this.bloomThreshold = event.threshold;
          if (event.intensity !== undefined) this.bloomIntensity = event.intensity;
          if (event.color !== undefined) {
              // Handle different color formats
              if (Array.isArray(event.color)) {
                  // [r, g, b] format - convert to hex
                  const r = Math.round(event.color[0] * 255).toString(16).padStart(2, '0');
                  const g = Math.round(event.color[1] * 255).toString(16).padStart(2, '0');
                  const b = Math.round(event.color[2] * 255).toString(16).padStart(2, '0');
                  this.bloomColor = r + g + b;
              } else if (typeof event.color === 'string') {
                  // String format - may include # prefix or not
                  this.bloomColor = event.color.replace('#', '');
              } else {
                  this.bloomColor = 'ffffff';
              }
          }
      } else if (enabled === false || enabled === 'Disabled') {
          this.bloomEnabled = false;
      }
      
      // Debug log
      console.log('Bloom event:', { 
          enabled: this.bloomEnabled, 
          threshold: this.bloomThreshold, 
          intensity: this.bloomIntensity, 
          color: this.bloomColor 
      });
      
      // Update bloom effect
      if (this.bloomEffect) {
          this.bloomEffect.setEnabled(this.bloomEnabled);
          this.bloomEffect.setThreshold(this.bloomThreshold / 100); // Convert 0-100 to 0-1
          this.bloomEffect.setIntensity(this.bloomIntensity / 100);
          this.bloomEffect.setColor(this.bloomColor);
          
          // Debug: log the actual color uniform
          console.log('Bloom uniform color:', this.bloomEffect.getDebugColor());
      }
  }

  private resetCameraState(): void {
    const settings = this.levelData.settings;
    if (settings) {
        this.cameraMode.relativeTo = settings.relativeTo || 'Player';
        this.cameraMode.anchorTileIndex = 0;
        this.cameraMode.position = settings.position ? { x: settings.position[0], y: settings.position[1] } : { x: 0, y: 0 };
        this.cameraMode.rotation = settings.rotation !== undefined ? settings.rotation : 0;
        this.cameraMode.zoom = settings.zoom !== undefined ? settings.zoom : 100;
        // ADOFAI Zoom is inverse: 400 is zoomed out (smaller objects), 40 is zoomed in (larger objects).
        this.zoom = 100 / this.cameraMode.zoom;
        this.cameraMode.angleOffset = settings.angleOffset !== undefined ? settings.angleOffset : 0;
    } else {
        this.cameraMode = {
            relativeTo: 'Player',
            anchorTileIndex: 0,
            position: { x: 0, y: 0 },
            zoom: 100,
            rotation: 0,
            angleOffset: 0
        };
        this.zoom = 1;
    }
  }

  private processCameraEvent(event: any, floorIndex: number): void {
      // Skip disabled events
      if (!isEventActive(event)) return;
      
      // Capture current camera state as the new transition start point
      // If there's an active transition, we need to capture the interpolated position
      let currentLogicalPos = { ...this.cameraMode.position };
      let currentLogicalZoom = this.cameraMode.zoom;
      let currentLogicalRotation = this.cameraMode.rotation;

      if (this.cameraTransition.active) {
          // Calculate current interpolated position from the ongoing transition
          const transitionTime = (this.elapsedTime / 1000) - this.cameraTransition.startTime;
          let t = transitionTime / this.cameraTransition.duration;
          t = Math.max(0, Math.min(1, t));
          
          const easeFunc = EasingFunctions[this.cameraTransition.ease] || EasingFunctions.Linear;
          const progress = easeFunc(t);
          
          const start = this.cameraTransition.startSnapshot;
          
          // Interpolate logical values
          currentLogicalPos = {
              x: start.logicalPosition.x + (this.cameraMode.position.x - start.logicalPosition.x) * progress,
              y: start.logicalPosition.y + (this.cameraMode.position.y - start.logicalPosition.y) * progress
          };
          currentLogicalZoom = start.logicalZoom + (this.cameraMode.zoom - start.logicalZoom) * progress;
          currentLogicalRotation = start.logicalRotation + (this.cameraMode.rotation - start.logicalRotation) * progress;
          
          this.cameraTransition.active = false;
      }

      const duration = (event.duration !== undefined) ? event.duration : 0;
      const relativeTo = event.relativeTo; // Can be undefined - treat as offset from current position
      
      const startLogicalPos = currentLogicalPos;
      const startLogicalZoom = currentLogicalZoom;
      const startLogicalRotation = currentLogicalRotation;

      // Determine next relativeTo
      // If relativeTo is undefined, keep current relativeTo (position will be treated as offset)
      let nextRelativeTo = this.cameraMode.relativeTo;
      let relativeToSpecified = false;
      
      if (relativeTo !== undefined && relativeTo !== null) {
          relativeToSpecified = true;
          if (typeof relativeTo === 'string') {
              nextRelativeTo = relativeTo;
          } else if (typeof relativeTo === 'number') {
              nextRelativeTo = ['Player', 'Tile', 'Global', 'LastPosition', 'LastPositionNoRotation'][relativeTo] || 'Player';
          }
      }

      // 1. Update RelativeTo & Anchor (only if specified)
      if (relativeToSpecified) {
          if (nextRelativeTo === 'LastPosition' || nextRelativeTo === 'LastPositionNoRotation') {
              // Keep current relativeTo and anchorTileIndex
          } else {
              this.cameraMode.relativeTo = nextRelativeTo;
              if (nextRelativeTo === 'Tile') {
                  this.cameraMode.anchorTileIndex = floorIndex;
              } else if (nextRelativeTo === 'Global' || nextRelativeTo === 'Player') {
                  this.cameraMode.anchorTileIndex = 0; // Default or ignored
              }
          }
      }

      // 2. Update Position
      if (event.position !== undefined && event.position !== null) {
          const px = event.position[0];
          const py = event.position[1];
          
          // If relativeTo is undefined, position is an offset from current position
          // If relativeTo is LastPosition/LastPositionNoRotation, position is also an offset
          // Otherwise, position is absolute
          const isOffset = (relativeTo === undefined) || 
                          (nextRelativeTo === 'LastPosition' || nextRelativeTo === 'LastPositionNoRotation');
          
          if (isOffset) {
              if (px !== null && px !== undefined) this.cameraMode.position.x += px;
              if (py !== null && py !== undefined) this.cameraMode.position.y += py;
          } else {
              if (px !== null && px !== undefined) this.cameraMode.position.x = px;
              if (py !== null && py !== undefined) this.cameraMode.position.y = py;
          }
      }

      // 3. Update Rotation (always absolute, not affected by relativeTo undefined)
      if (event.rotation !== undefined && event.rotation !== null) {
          this.cameraMode.rotation = event.rotation;
      }

      // 4. Update Zoom (Always absolute)
      if (event.zoom !== undefined && event.zoom !== null) {
          this.cameraMode.zoom = event.zoom;
      }

      // 5. Angle Offset
      if (event.angleOffset !== undefined && event.angleOffset !== null) {
          this.cameraMode.angleOffset = event.angleOffset;
      }

      // Setup Transition
      const currentBPM = (this.tileBPM && this.tileBPM[this.currentTileIndex]) || 100;
      const durationSeconds = duration * (60 / currentBPM);

      if (durationSeconds <= 0) {
          this.cameraTransition.active = false;
      } else {
          this.cameraTransition.active = true;
          this.cameraTransition.startTime = this.elapsedTime / 1000;
          this.cameraTransition.duration = durationSeconds;
          this.cameraTransition.ease = event.ease || 'Linear';
          
          this.cameraTransition.startSnapshot = {
              position: { x: this.cameraPosition.x, y: this.cameraPosition.y },
              zoom: this.zoom,
              rotation: this.camera.rotation.z * (180 / Math.PI),
              logicalPosition: startLogicalPos,
              logicalZoom: startLogicalZoom,
              logicalRotation: startLogicalRotation
          };
      }
  }

  public stopPlay(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.removePlanets();
    
    // Stop Music
    if (this.music && (this.music as any).hasAudio ? this.music.hasAudio : false) {
      this.music.stop();
    }
    
    // Stop hitsounds
    this.hitsoundManager.stopAll();
    
    // Reset Video
    if (this.videoElement) {
        this.videoElement.pause();
        this.videoElement.currentTime = 0;
    }
    
    // Reset Bloom state
    this.bloomEnabled = false;
    this.bloomThreshold = 10; // Even lower threshold (0.1) to ensure thin neon lines bloom
    this.bloomIntensity = 150; 
    this.bloomColor = 'ffffff';
    this.lastBloomTimelineIndex = -1;
    if (this.bloomEffect) {
      this.bloomEffect.setEnabled(false);
      this.bloomEffect.setThreshold(0.5);
      this.bloomEffect.setIntensity(1);
      this.bloomEffect.setColor('ffffff');
    }
    
    // Reset camera to start or keep where it is? Usually reset for preview.
    // this.cameraPosition.set(0, 0, 0);
    // this.updateCamera();
    
    // Reset colors to static preview state
    this.initTileColors();
    this.lastRecolorTimelineIndex = -1;
    this.tiles.forEach((_, id) => {
        this.updateTileMeshColor(parseInt(id));
    });
  }

  public pausePlay(): void {
    if (!this.isPlaying || this.isPaused) return;
    this.isPaused = true;
    this.pauseTime = performance.now();
    if (this.music && (this.music as any).hasAudio ? this.music.hasAudio : false) {
      this.music.pause();
    }
    this.hitsoundManager.stopAll();
  }

  public resumePlay(): void {
    if (!this.isPlaying || !this.isPaused) return;
    this.isPaused = false;
    // Adjust start time to account for pause duration
    const pauseDuration = performance.now() - this.pauseTime;
    this.startTime += pauseDuration;
    if (this.music && (this.music as any).hasAudio ? this.music.hasAudio : false) {
      this.music.resume();
    }
    
    // Reschedule remaining hitsounds
    const currentTimeInSeconds = this.elapsedTime / 1000;
    const settings = this.levelData.settings;
    const countdownTicks = settings.countdownTicks || 4;
    const countdownBPM = (this.tileBPM && this.tileBPM[0]) || settings.bpm || 100;
    const initialSecPerBeat = 60 / countdownBPM;
    const countdownDuration = countdownTicks * initialSecPerBeat;
    const offset = this.music.hasAudio ? (this.levelData.settings.offset || 0) : 0;
    const timeInLevel = (this.elapsedTime / 1000) - countdownDuration - (offset / 1000);
    
    // Reschedule remaining hitsounds
    const hitsToSchedule: number[] = [];
    for (let i = 1; i < this.tileStartTimes.length; i++) {
        const t = this.tileStartTimes[i];
        const tile = this.levelData.tiles[i];
        if (t > timeInLevel && tile && tile.angle !== 0) {
            hitsToSchedule.push(t - timeInLevel);
        }
    }
    this.hitsoundManager.scheduleAll(hitsToSchedule, performance.now());
  }

  public resetPlayer(): void {
    this.stopPlay();
    this.startPlay();
  }

  // --- Track Color Logic ---

  private initTileColors(): void {
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

    const globalConfig = {
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
        this.levelData.actions.forEach(event => {
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
        this.levelData.actions.forEach(event => {
            if (event.eventType === 'ColorTrack' && event.justThisTile) {
                const floor = event.floor;
                if (floor >= 0 && floor < totalTiles) {
                    const colors = this.parseColorTrackType(
                        event.trackStyle || defaultStyle, 
                        event.trackColor || defaultColor, 
                        event.secondaryTrackColor || defaultSecondaryColor
                    );
                    
                    const config = {
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

  private PosRelativeTo(input: any, thisid: number): number {
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

  private parseColorTrackType(Type: string, inputColor: string, inputBgColor: string): { color: string, bgcolor: string } {
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
  private getTileRenderer(id: number, time: number, rct: any): { color: string, bgcolor: string } {
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
        const amp = this.music.amplitude;
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
  private genColor(c1: string, c2: string, t: number): string {
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

  private processHexColor(hex: string): [string, string] {
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

  private formatHexColor(hex: string): string {
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

  private buildRecolorTimeline(): void {
    this.recolorTimeline = [];
    const entries: { time: number; event: any }[] = [];
    
    this.tileEvents.forEach((events, floor) => {
        const startTime = this.tileStartTimes[floor] || 0;
        const bpm = this.tileBPM[floor] || 100;
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

  private processRecolorEvent(event: any): void {
    const startIdx = this.PosRelativeTo(event.startTile, event.floor);
    const endIdx = this.PosRelativeTo(event.endTile, event.floor);
    const gap = (event.gapLength !== undefined) ? event.gapLength : 0;
    
    const settings = this.levelData.settings;
    const defaultColor = settings.trackColor || 'debb7b';
    const defaultSecondaryColor = settings.secondaryTrackColor || 'ffffff';
    const defaultStyle = settings.trackStyle || 'Standard';
    const defaultColorType = settings.trackColorType || 'Single';

    const colors = this.parseColorTrackType(
        event.trackStyle || defaultStyle, 
        event.trackColor || defaultColor, 
        event.secondaryTrackColor || defaultSecondaryColor
    );

    const config = {
        trackStyle: event.trackStyle || defaultStyle,
        trackColorType: event.trackColorType || defaultColorType,
        trackColor: colors.color,
        secondaryTrackColor: colors.bgcolor,
        trackColorPulse: event.trackColorPulse || settings.trackColorPulse || 'None',
        trackColorAnimDuration: event.trackColorAnimDuration || settings.trackColorAnimDuration || 2,
        trackPulseLength: event.trackPulseLength || settings.trackPulseLength || 10
    };

    // Duration logic: for now, direct application as requested, 
    // but we respect the range and gap.
    const minIdx = Math.max(0, Math.min(startIdx, endIdx));
    const maxIdx = Math.min(this.tileColors.length - 1, Math.max(startIdx, endIdx));
    
    for (let i = minIdx; i <= maxIdx; i += (gap + 1)) {
        this.tileRecolorConfigs[i] = config;
        const rendered = this.getTileRenderer(i, this.elapsedTime / 1000, config);
        this.applyTileColor(i, rendered.color, rendered.bgcolor);
    }
  }

  private applyTileColor(index: number, color: string, bgcolor: string): void {
    if (index < 0 || index >= this.tileColors.length) return;
    
    this.tileColors[index] = { color, secondaryColor: bgcolor };
    this.updateTileMeshColor(index);
  }

  private updateTileMeshColor(index: number): void {
    const id = index.toString();
    const mesh = this.tiles.get(id);
    if (mesh && mesh.material instanceof THREE.ShaderMaterial) {
        const colors = this.tileColors[index];
        mesh.material.uniforms.uColor.value.set(colors.color);
        mesh.material.uniforms.uBgColor.value.set(colors.secondaryColor || colors.color);
    }
  }

  // --- Helper Methods ---

  public onWindowResize(): void {
    if (!this.container) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    const aspect = width / height;
    // Use a fixed base frustum size, zoom is handled by camera.zoom
    // 8 units vertically at zoom 1.0 (logical zoom 100)
    const baseFrustumSize = 8;
    
    this.camera.left = -baseFrustumSize * aspect / 2;
    this.camera.right = baseFrustumSize * aspect / 2;
    this.camera.top = baseFrustumSize / 2;
    this.camera.bottom = -baseFrustumSize / 2;
    
    // Update actual camera zoom
    this.camera.zoom = this.zoom * this.zoomMultiplier;
    
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    
    // Update render target size for bloom
    if (this.renderTarget) {
      this.renderTarget.setSize(width, height);
    }
    if (this.bloomEffect) {
      this.bloomEffect.setSize(width, height);
    }
    
    this.updateVideoSize();
    this.updateVisibleTiles();
  }

  private updateVideoSize(): void {
    if (!this.videoElement || !this.videoMesh || !this.container) return;
    
    const videoWidth = this.videoElement.videoWidth || 16;
    const videoHeight = this.videoElement.videoHeight || 9;
    const videoAspect = videoWidth / videoHeight;
    
    // Orthographic camera frustum dimensions
    const frustumHeight = (this.camera.top - this.camera.bottom) / this.camera.zoom;
    const frustumWidth = (this.camera.right - this.camera.left) / this.camera.zoom;
    const frustumAspect = frustumWidth / frustumHeight;
    
    // In ADOFAI, backgrounds typically cover the screen (fill)
    let scale = 1;
    if (frustumAspect > videoAspect) {
        // Frustum is wider than video, match width
        scale = frustumWidth / 1.0;
        this.videoMesh.scale.set(scale, scale / videoAspect, 1);
    } else {
        // Frustum is taller than video, match height
        scale = frustumHeight / 1.0;
        this.videoMesh.scale.set(scale * videoAspect, scale, 1);
    }
    
    // Since our PlaneGeometry is 1x1, scale directly maps to world units
  }

  private createPlanets(): void {
    this.planetRed = new Planet(0xff0000, undefined, this.showTrail);
    this.planetBlue = new Planet(0x0000ff, undefined, this.showTrail);
    
    this.planetRed.render(this.scene);
    this.planetBlue.render(this.scene);
    
    // Initial positioning logic (simplified)
    if (this.levelData.tiles && this.levelData.tiles.length > 1) {
      const t0 = this.levelData.tiles[0];
      const t1 = this.levelData.tiles[1];
      if (t0 && t1) {
        // Assume red is pivot at t0, blue at t1 (waiting state)
        // Adjust coordinates as per ADOFAI grid logic
        
        // Use standard t0, t1 positions
        this.planetRed.position.set(t0.position[0], t0.position[1], 0.1);
        this.planetBlue.position.set(t1.position[0], t1.position[1], 0.1);
      }
    }
  }

  private removePlanets(): void {
    if (this.planetRed) {
      this.planetRed.removeFromScene(this.scene);
      this.planetRed.dispose();
      this.planetRed = null;
    }
    if (this.planetBlue) {
      this.planetBlue.removeFromScene(this.scene);
      this.planetBlue.dispose();
      this.planetBlue = null;
    }
  }

  private getContainerSize(): { width: number; height: number } {
    if (!this.container) return { width: window.innerWidth, height: window.innerHeight };
    return {
      width: this.container.clientWidth,
      height: this.container.clientHeight,
    };
  }

  /**
   * Initialize shared decoration geometries and materials
   * This prevents creating new objects for each tile
   */
  private initSharedDecorationResources(): void {
    const decoSize = 0.275 * 0.8;
    
    // Shared circle geometry for decorations
    this.sharedDecoGeometry = new THREE.CircleGeometry(decoSize / 2, 16); // Reduced segments for performance
    
    // Shared materials
    this.sharedTwirlMaterial = new THREE.MeshBasicMaterial({ color: 0x800080 });
    this.sharedSpeedUpMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.sharedSpeedDownMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
  }

  private lastVisibleCheckPos = new THREE.Vector3(Infinity, Infinity, Infinity);
  private lastVisibleCheckZoom = -1;

  private updateVisibleTiles(): void {
    if (!this.scene || !this.levelData.tiles || !this.camera) return;

    const zoom = this.camera.zoom || 1.0;
    
    // Only update if camera moved significantly or zoomed
    const distSq = this.cameraPosition.distanceToSquared(this.lastVisibleCheckPos);
    if (distSq < 0.01 && Math.abs(zoom - this.lastVisibleCheckZoom) < 0.01) {
        return;
    }
    
    this.lastVisibleCheckPos.copy(this.cameraPosition);
    this.lastVisibleCheckZoom = zoom;

    // Use camera's actual frustum and zoom to determine visible area
    const left = this.cameraPosition.x + this.camera.left / zoom;
    const right = this.cameraPosition.x + this.camera.right / zoom;
    const bottom = this.cameraPosition.y + this.camera.bottom / zoom;
    const top = this.cameraPosition.y + this.camera.top / zoom;
    
    const margin = 2.0;
    const newVisibleTiles: number[] = [];

    // Use spatial indexing for fast lookup
    const minCellX = Math.floor((left - margin) / this.spatialGridSize);
    const maxCellX = Math.floor((right + margin) / this.spatialGridSize);
    const minCellY = Math.floor((bottom - margin) / this.spatialGridSize);
    const maxCellY = Math.floor((top + margin) / this.spatialGridSize);

    // Iterate over grid cells in visible area
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const tileIndices = this.spatialGrid.get(cx * 100000 + cy); // Use number key instead of string
        if (tileIndices) {
          for (let i = 0; i < tileIndices.length; i++) {
            newVisibleTiles.push(tileIndices[i]);
          }
        }
      }
    }

    // 1. Identify tiles that should be removed from scene
    const idsInScene = Array.from(this.visibleTiles);
    for (let i = 0; i < idsInScene.length; i++) {
        const id = idsInScene[i];
        const idx = parseInt(id);
        // Using a Set for newVisibleTiles would be faster for 60w tiles, but newVisibleTiles is only the visible subset (~100-200)
        if (!newVisibleTiles.includes(idx)) {
            const mesh = this.tiles.get(id);
            if (mesh) {
                this.scene.remove(mesh);
            }
            this.visibleTiles.delete(id);
        }
    }

    // 2. Add new tiles to scene
    for (let i = 0; i < newVisibleTiles.length; i++) {
      const idx = newVisibleTiles[i];
      const id = idx.toString();
      if (!this.visibleTiles.has(id)) {
        const tileMesh = this.getOrCreateTileMesh(idx);
        if (tileMesh) {
          this.scene.add(tileMesh);
          this.visibleTiles.add(id);
        }
      }
    }

    // 3. Performance: If we have too many tiles cached in memory, remove the furthest ones
    if (this.tiles.size > this.maxCachedTiles) {
        this.cleanupTileCache();
    }
  }

  /**
   * Remove and dispose meshes that are far from the camera to free GPU memory
   */
  private cleanupTileCache(): void {
    const tileEntries = Array.from(this.tiles.entries());
    
    // Sort by distance to camera (descending)
    tileEntries.sort((a, b) => {
        const distA = a[1].position.distanceToSquared(this.cameraPosition);
        const distB = b[1].position.distanceToSquared(this.cameraPosition);
        return distB - distA;
    });
    
    // Remove furthest tiles that are NOT currently visible
    const toRemoveCount = Math.floor(this.tiles.size * 0.3);
    let removed = 0;
    
    for (let i = 0; i < tileEntries.length && removed < toRemoveCount; i++) {
        const [id, mesh] = tileEntries[i];
        if (!this.visibleTiles.has(id)) {
            // Dispose unique material
            if (mesh.material instanceof THREE.Material) {
                mesh.material.dispose();
            }
            // Shared geometry (geometryCache) is NOT disposed here
            
            this.tiles.delete(id);
            removed++;
        }
    }
  }

  private getOrCreateTileMesh(index: number): THREE.Mesh | null {
    const id = index.toString();
    if (this.tiles.has(id)) return this.tiles.get(id)!;

    const tile = this.levelData.tiles[index];
    if (!tile) return null;
    
    const [x, y] = tile.position;
    const zLevel = 12 - index;
    
    let pred = -180; // Default if index == 0
    if (index > 0) {
       const prevTile = this.levelData.tiles[index - 1];
       pred = (prevTile.direction || 0) - 180;
       if (prevTile.direction === 999 && index > 1) {
         pred = (this.levelData.tiles[index - 2].direction || 0);
       }
    }
    
    const currentDirection = tile.direction || 0;
    const is999 = (tile.angle === 0);
    
    // Geometry caching by shape
    const shapeKey = `${pred}_${currentDirection}_${is999}`;
    let geometry = this.geometryCache.get(shapeKey);
    
    if (!geometry) {
      const meshData = createTrackMesh(pred, currentDirection, is999);
      if (!meshData || !meshData.faces) return null;
      
      geometry = new THREE.BufferGeometry();
      geometry.setIndex(meshData.faces);
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(meshData.colors, 3));
      geometry.computeVertexNormals();
      this.geometryCache.set(shapeKey, geometry);
    }

    // Material logic
    const colors = this.tileColors[index];
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(colors.color) },
            uBgColor: { value: new THREE.Color(colors.secondaryColor || colors.color) }
        },
        vertexShader: `
            varying vec3 vColor;
            void main() {
                vColor = color;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 uColor;
            uniform vec3 uBgColor;
            varying vec3 vColor;
            void main() {
                vec3 finalColor = mix(uBgColor, uColor, vColor.r);
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `,
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: false
    });

    const tileMesh = new THREE.Mesh(geometry, material);
    tileMesh.position.set(x, y, zLevel * 0.001);
    tileMesh.castShadow = true;
    tileMesh.receiveShadow = true;
    
    // Add decorations
    const decoZ = 0.002;
    let hasTwirl = false;
    let hasSetSpeed = false;
    
    if (this.tileEvents.has(index)) {
        const events = this.tileEvents.get(index)!;
        events.forEach(e => {
            if (e.eventType === 'Twirl') hasTwirl = true;
            if (e.eventType === 'SetSpeed') hasSetSpeed = true;
        });
    }
    
    if (hasTwirl && this.sharedDecoGeometry && this.sharedTwirlMaterial) {
        const twirlMesh = new THREE.Mesh(this.sharedDecoGeometry, this.sharedTwirlMaterial);
        twirlMesh.position.set(0, 0, decoZ);
        tileMesh.add(twirlMesh);
    }
    
    if (hasSetSpeed && this.sharedDecoGeometry) {
        const currentBPM = this.tileBPM[index];
        const prevBPM = index > 0 ? this.tileBPM[index - 1] : (this.levelData.settings.bpm || 100);
        const ratio = currentBPM / prevBPM;
        
        if (ratio > 1.05 && this.sharedSpeedUpMaterial) {
            const speedMesh = new THREE.Mesh(this.sharedDecoGeometry, this.sharedSpeedUpMaterial);
            speedMesh.position.set(0, 0, decoZ + (hasTwirl ? 0.001 : 0));
            tileMesh.add(speedMesh);
        } else if (ratio < 0.95 && this.sharedSpeedDownMaterial) {
            const speedMesh = new THREE.Mesh(this.sharedDecoGeometry, this.sharedSpeedDownMaterial);
            speedMesh.position.set(0, 0, decoZ + (hasTwirl ? 0.001 : 0));
            tileMesh.add(speedMesh);
        }
    }
    
    this.tiles.set(id, tileMesh);
    return tileMesh;
  }

  private updatePlanetsPosition(): void {
    if (!this.planetRed || !this.planetBlue) return;
    
    const currentTimeInSeconds = this.elapsedTime / 1000;
    const settings = this.levelData.settings;
    const countdownTicks = settings.countdownTicks || 4;
    
    // Time in seconds
    // Only use offset if audio is present
    const offset = this.music.hasAudio ? (this.levelData.settings.offset || 0) : 0;
    
    // Countdown duration
    const countdownBPM = (this.tileBPM && this.tileBPM[0]) || settings.bpm || 100;
    const initialSecPerBeat = 60 / countdownBPM;
    const countdownDuration = countdownTicks * initialSecPerBeat;

    // Logical time relative to start of first tile
    // If offset is correctly set, timeInSeconds=0 means we hit the first tile.
    // We subtract countdownDuration so that at elapsedTime=0, we are at -countdownDuration.
    // At elapsedTime = countdownDuration*1000 + offset, timeInLevel is 0.
    const timeInLevel = (this.elapsedTime / 1000) - countdownDuration - (offset / 1000);
    
    // Process Recolor timeline
    if (this.lastRecolorTimelineIndex >= 0) {
        const currentEntry = this.recolorTimeline[this.lastRecolorTimelineIndex];
        if (currentEntry && timeInLevel < currentEntry.time) {
            // Backward seek detected - reset to static preview colors
            this.initTileColors();
            this.lastRecolorTimelineIndex = -1;
            // Update all visible meshes
            this.tiles.forEach((_, id) => {
                this.updateTileMeshColor(parseInt(id));
            });
        }
    }

    while (this.lastRecolorTimelineIndex + 1 < this.recolorTimeline.length && 
           this.recolorTimeline[this.lastRecolorTimelineIndex + 1].time <= timeInLevel) {
        this.lastRecolorTimelineIndex++;
        const entry = this.recolorTimeline[this.lastRecolorTimelineIndex];
        this.processRecolorEvent(entry.event);
    }

    if (timeInLevel < 0) {
        // Countdown Phase (Approaching Tile 1)
        // We use the same logic as Playing Phase for Tile 0, but with negative time.
        // Tile 0 movement: from startAngle to targetAngle (at Tile 1)
        // Duration: tileDurations[0]
        // Start time: tileStartTimes[0] (which is negative)
        // End time: tileStartTimes[1] (which is 0)
        
        // Find if we are within the T0->T1 movement range
        // If timeInLevel < tileStartTimes[0], we are even before the first movement (e.g. waiting)
        // But let's assume we just render the T0->T1 movement extended backwards or clamped.
        
        // Actually, "Countdown" usually means spinning on Tile 0 or approaching it.
        // User request: "Ball pre-spin ends, ball hits 1st tile EXACTLY when music reaches offset."
        // This is exactly what we achieved by shifting tileStartTimes.
        // The movement T0->T1 ends at t=0.
        
        // So we can just use the standard update logic?
        // But binary search might fail for negative times if we don't handle it.
        // Let's check binary search:
        // low=0, high=len-1.
        // tileStartTimes[0] is negative (e.g. -0.5).
        // If timeInLevel = -0.2.
        // tileStartTimes[0] <= -0.2 is true.
        // tileStartTimes[1] (0) <= -0.2 is false.
        // So tileIndex will be 0.
        // So the standard logic SHOULD work for the approach phase too!
        
        // Only if timeInLevel is LESS than tileStartTimes[0] (start of approach), we might need extra logic.
        // But usually approach starts at... -infinity?
        // Or we just clamp to Tile 0.
        
        // Let's reuse the standard logic below instead of returning early.
        // But we need to handle "Pre-Countdown" if time is very early.
        // If timeInLevel < tileStartTimes[0], we can just simulate infinite rotation on Tile 0?
        // Or just let it run Tile 0 logic (which will calculate angle based on time).
        // Tile 0 logic uses linear interpolation?
        // No, it uses `angle = startAngle + ...`.
        // Let's see how `updatePlanetsPosition` calculates position for a tile.
    }
    
    // Playing Phase (and Countdown/Approach if timeInLevel >= tileStartTimes[0])
    // Find current tile index using incremental search
    if (this.tileStartTimes.length > 0) {
        // If time is before the current tile's start time, we might have seeked backwards
        if (timeInLevel < this.tileStartTimes[this.currentTileIndex]) {
            // Use binary search as fallback for large seeks
            let low = 0, high = this.tileStartTimes.length - 1;
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                if (this.tileStartTimes[mid] <= timeInLevel) {
                    this.currentTileIndex = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }
        } else {
            // Increment index as time progresses
            while (this.currentTileIndex + 1 < this.tileStartTimes.length && 
                   this.tileStartTimes[this.currentTileIndex + 1] <= timeInLevel) {
                this.currentTileIndex++;
                // Note: Real-time hitsound play is removed here because they are now pre-scheduled 
                // in startPlay() for much better performance at high BPM.
            }
        }
    }
    
    const tileIndex = this.currentTileIndex;
    
    // Check if we are past the last tile (Infinite Rotation)
    if (tileIndex >= this.levelData.tiles.length - 1) {
        const lastIndex = this.levelData.tiles.length - 1;
        const lastTile = this.levelData.tiles[lastIndex];
        
        if (lastTile) {
             const isRedPivot = (lastIndex % 2 === 0);
             const pivotPlanet = isRedPivot ? this.planetRed : this.planetBlue;
             const movingPlanet = isRedPivot ? this.planetBlue : this.planetRed;
             
             const pivotPos = lastTile.position;
             this.currentPivotPosition.x = pivotPos[0];
             this.currentPivotPosition.y = pivotPos[1];
             pivotPlanet.position.set(pivotPos[0], pivotPos[1], 0);
             
             let startAngle = 0;
             if (lastIndex > 0) {
                 const prevTile = this.levelData.tiles[lastIndex - 1];
                 const pdx = prevTile.position[0] - pivotPos[0];
                 const pdy = prevTile.position[1] - pivotPos[1];
                 startAngle = Math.atan2(pdy, pdx);
             }
             
             const extraTime = timeInLevel - this.tileStartTimes[lastIndex];
             const bpm = this.tileBPM[lastIndex] || 100;
             // 1 beat = 180 degrees = PI radians
             // bpm = beats per minute
             // beats per second = bpm / 60
             // radians per second = (bpm / 60) * PI
             const radiansPerSecond = (bpm / 60) * Math.PI;
             const isCW = this.tileIsCW[lastIndex];
             
             const totalAngle = extraTime * radiansPerSecond;
             
             // Initial angle should be consistent with arrival
             // startAngle is the angle FROM the previous tile TO the current tile (pivot)
             // The moving planet arrives at the pivot from the previous tile.
             // Wait, startAngle calculated above is atan2(prev->curr).
             // That is the direction the ball CAME FROM.
             // So the ball is AT angle `startAngle` relative to the pivot?
             // No, atan2(y, x) is angle of vector (x, y).
             // Vector is prev -> curr.
             // So the ball is at `prev` position relative to `curr`?
             // No, the ball is at `curr` (pivot) position. The other ball is rotating.
             // The other ball arrives at angle `startAngle + PI`?
             
             // Let's trace normal rotation end state.
             // In normal rotation:
             // startAngle = atan2(prev->curr)
             // endAngle = atan2(next->curr) + PI (roughly)
             
             // When arriving at last tile:
             // The "moving" planet becomes the "pivot" planet for the next step.
             // But here we just want the *other* planet to keep rotating.
             // So the planet that WAS moving in the last step (lastIndex-1) has landed on lastIndex.
             // Now that planet becomes the pivot.
             // The *other* planet (which was pivot at lastIndex-1) is now the moving planet.
             
             // Let's verify who is pivot.
             // lastIndex is the index of the tile we are ON.
             // isRedPivot = (lastIndex % 2 === 0). Correct.
             // The pivot planet is fixed at lastTile.position.
             
             // Where does the moving planet start?
             // It starts from where it was left off in the previous turn?
             // The previous turn was pivoting around lastIndex-1.
             // The moving planet (which is now pivot) moved from lastIndex-1 to lastIndex.
             // The *other* planet was at lastIndex-1.
             // So relative to pivot (lastIndex), the moving planet starts at lastIndex-1.
             
             // Vector from pivot (lastIndex) to moving (lastIndex-1):
             // dx = prev.x - curr.x
             // dy = prev.y - curr.y
             // angle = atan2(dy, dx)
             
             // My code above:
             // pdx = prev.x - curr.x
             // pdy = prev.y - curr.y
             // startAngle = atan2(pdy, pdx)
             // This seems correct! This is the angle of the moving planet relative to the pivot at t=0.
             
             const currentAngle = isCW ? (startAngle - totalAngle) : (startAngle + totalAngle);
             
             const dist = 1.0;
             movingPlanet.position.set(
                 pivotPos[0] + Math.cos(currentAngle) * dist,
                 pivotPos[1] + Math.sin(currentAngle) * dist,
                 0.1
             );
             
             // Ensure meshes are updated with currentTime
             pivotPlanet.position.z = 0.1;
             pivotPlanet.update(0, currentTimeInSeconds);
             movingPlanet.update(0, currentTimeInSeconds);
        }
        return;
    }

    // Normal Rotation Logic
    const pivot = this.levelData.tiles[tileIndex];
    
    if (pivot) {
        const isRedPivot = (tileIndex % 2 === 0);
        const pivotPlanet = isRedPivot ? this.planetRed : this.planetBlue;
        const movingPlanet = isRedPivot ? this.planetBlue : this.planetRed;
        
        const pivotPos = pivot.position;
        this.currentPivotPosition.x = pivotPos[0];
        this.currentPivotPosition.y = pivotPos[1];
        pivotPlanet.position.set(pivotPos[0], pivotPos[1], 0.1);

        const startTime = this.tileStartTimes[tileIndex];
        const duration = this.tileDurations[tileIndex];
        const progress = duration > 0.0001 ? (timeInLevel - startTime) / duration : 1;
        
        const startAngle = this.tileStartAngle[tileIndex];
        const totalAngle = this.tileTotalAngle[tileIndex];
        const currentAngle = startAngle + totalAngle * progress;
        
        // Interpolate radius
        const clampedProgress = Math.max(0, Math.min(1, progress));
        const startDist = this.tileStartDist[tileIndex];
        const endDist = this.tileEndDist[tileIndex];
        const currentDist = startDist + (endDist - startDist) * clampedProgress;
        
        movingPlanet.position.set(
            pivotPos[0] + Math.cos(currentAngle) * currentDist,
            pivotPos[1] + Math.sin(currentAngle) * currentDist,
            0.1
        );
    }
    
    // Sync meshes
    this.planetRed.update(0, currentTimeInSeconds);
    this.planetBlue.update(0, currentTimeInSeconds);
  }
  
  private updateCameraFollow(delta: number): void {
      if (!this.planetRed || !this.planetBlue) return;

      const settings = this.levelData.settings;
      const initialBPM = settings.bpm || 100;
      const initialSecPerBeat = 60 / initialBPM;
      const countdownTicks = settings.countdownTicks || 4;
      const countdownDuration = countdownTicks * initialSecPerBeat;
      const offset = this.music.hasAudio ? (this.levelData.settings.offset || 0) : 0;
      
      const currentTimeInSeconds = this.elapsedTime / 1000;
      const timeInLevel = currentTimeInSeconds - countdownDuration - (offset / 1000);

      // 1. Process new camera events (using high-performance Timeline)
      // We check against timeInLevel because cameraTimeline is built using tileStartTimes (logic time)
      if (this.lastCameraTimelineIndex >= 0) {
          const currentEntry = this.cameraTimeline[this.lastCameraTimelineIndex];
          if (currentEntry && timeInLevel < currentEntry.time) {
              // Backward seek detected
              this.resetCameraState();
              this.lastCameraTimelineIndex = -1;
          }
      }

      while (this.lastCameraTimelineIndex + 1 < this.cameraTimeline.length && 
             this.cameraTimeline[this.lastCameraTimelineIndex + 1].time <= timeInLevel) {
          this.lastCameraTimelineIndex++;
          const entry = this.cameraTimeline[this.lastCameraTimelineIndex];
          this.processCameraEvent(entry.event, entry.event.floor || 0);
      }
      
      // 1.5 Process Bloom events
      if (this.lastBloomTimelineIndex >= 0) {
          const currentEntry = this.bloomTimeline[this.lastBloomTimelineIndex];
          if (currentEntry && timeInLevel < currentEntry.time) {
              // Backward seek detected
              this.bloomEnabled = false;
              this.lastBloomTimelineIndex = -1;
          }
      }
      
      while (this.lastBloomTimelineIndex + 1 < this.bloomTimeline.length && 
             this.bloomTimeline[this.lastBloomTimelineIndex + 1].time <= timeInLevel) {
          this.lastBloomTimelineIndex++;
          const entry = this.bloomTimeline[this.lastBloomTimelineIndex];
          this.processBloomEvent(entry.event);
      }
      
      // 2. Interpolate Logical Camera State (if transition active)
      let logicalPos = { ...this.cameraMode.position };
      let logicalZoom = this.cameraMode.zoom;
      let logicalRotation = this.cameraMode.rotation;

      if (this.cameraTransition.active) {
          // Transitions are also relative to logic time?
          // The startTime stored in transition is based on currentTimeInSeconds.
          let t = (currentTimeInSeconds - this.cameraTransition.startTime) / this.cameraTransition.duration;
          if (t >= 1) {
              this.cameraTransition.active = false;
          } else {
              const easeFunc = EasingFunctions[this.cameraTransition.ease] || EasingFunctions.Linear;
              const progress = easeFunc(t);
              
              const start = this.cameraTransition.startSnapshot;
              
              logicalPos.x = start.logicalPosition.x + (this.cameraMode.position.x - start.logicalPosition.x) * progress;
              logicalPos.y = start.logicalPosition.y + (this.cameraMode.position.y - start.logicalPosition.y) * progress;
              logicalZoom = start.logicalZoom + (this.cameraMode.zoom - start.logicalZoom) * progress;
              logicalRotation = start.logicalRotation + (this.cameraMode.rotation - start.logicalRotation) * progress;
          }
      }

      // 3. Calculate World Target Position
      let targetX = 0;
      let targetY = 0;
      
      if (this.cameraMode.relativeTo === 'Player') {
          targetX = this.currentPivotPosition.x + logicalPos.x;
          targetY = this.currentPivotPosition.y + logicalPos.y;
      } else if (this.cameraMode.relativeTo === 'Global') {
          const tile0 = this.levelData.tiles[0];
          const originX = tile0 ? tile0.position[0] : 0;
          const originY = tile0 ? tile0.position[1] : 0;
          targetX = originX + logicalPos.x;
          targetY = originY + logicalPos.y;
      } else if (this.cameraMode.relativeTo === 'Tile') {
          const tile = this.levelData.tiles[this.cameraMode.anchorTileIndex];
          if (tile) {
              targetX = tile.position[0] + logicalPos.x;
              targetY = tile.position[1] + logicalPos.y;
          } else {
              targetX = this.currentPivotPosition.x + logicalPos.x;
              targetY = this.currentPivotPosition.y + logicalPos.y;
          }
      } else {
          targetX = this.currentPivotPosition.x + logicalPos.x;
          targetY = this.currentPivotPosition.y + logicalPos.y;
      }

      // 4. Apply Smoothing Index Formula (BPM dependent)
      const currentBPM = (this.tileBPM && this.tileBPM[this.currentTileIndex]) || 100;
      // Index gets smaller as BPM increases (faster follow)
      const smoothingIndex = 15 * Math.pow(100 / Math.max(1, currentBPM), 0.15);
      
      // Frame-rate independent step
      const step = 1.0 - Math.pow(1.0 - 1.0 / smoothingIndex, delta * 60);
      
      this.cameraPosition.x += (targetX - this.cameraPosition.x) * step;
      this.cameraPosition.y += (targetY - this.cameraPosition.y) * step;

      // 5. Update Actual Three.js Camera
      this.camera.position.x = this.cameraPosition.x;
      this.camera.position.y = this.cameraPosition.y;
      
      // ADOFAI Zoom is inverse: 400 is zoomed out (smaller objects), 40 is zoomed in (larger objects).
      this.zoom = 100 / logicalZoom;
      this.camera.zoom = this.zoom * this.zoomMultiplier;
      this.camera.updateProjectionMatrix();
      
      this.camera.rotation.z = logicalRotation * (Math.PI / 180);

      // 6. Sync Video Background Position/Rotation (Keep it aligned with screen)
      if (this.videoMesh) {
          this.videoMesh.position.x = this.camera.position.x;
          this.videoMesh.position.y = this.camera.position.y;
          this.videoMesh.rotation.z = this.camera.rotation.z;
          
          // Update size if camera zoom changed (detects both logical zoom and mouse wheel zoom)
          if (Math.abs(this.camera.zoom - this.lastVisibleCheckZoom) > 0.001) {
              this.updateVideoSize();
          }
      }

      this.updateVisibleTiles();
  }

  // API for external control (takes logical ADOFAI zoom, e.g. 100)
  public setZoom(logicalZoom: number): void {
    this.cameraMode.zoom = logicalZoom;
    this.zoom = 100 / logicalZoom;
    this.onWindowResize();
  }

  public loadMusic(src: string): void {
    this.music.load(src);
    
    // Apply settings if available
    if (this.levelData.settings) {
        if (this.levelData.settings.volume !== undefined) {
            this.music.volume = this.levelData.settings.volume / 100;
        }
        if (this.levelData.settings.pitch !== undefined) {
            this.music.pitch = this.levelData.settings.pitch / 100;
        }
    }
  }

  public loadVideo(src: string): void {
    // Cleanup old video if exists
    if (this.videoElement) {
        this.videoElement.pause();
        this.videoElement.src = "";
        this.videoElement.load();
        this.videoElement.remove();
        this.videoElement = null;
    }
    if (this.videoTexture) {
        this.videoTexture.dispose();
        this.videoTexture = null;
    }
    if (this.videoMesh) {
        this.scene.remove(this.videoMesh);
        if (this.videoMesh.geometry) this.videoMesh.geometry.dispose();
        if (this.videoMesh.material instanceof THREE.Material) {
            this.videoMesh.material.dispose();
        }
        this.videoMesh = null;
    }

    const video = document.createElement('video');
    video.src = src;
    video.crossOrigin = 'anonymous';
    video.loop = this.levelData.settings?.loopVideo || false;
    video.muted = true; // Video should be muted as we use separate audio
    video.playsInline = true;
    
    this.videoElement = video;
    this.videoTexture = new THREE.VideoTexture(video);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;

    // Create a background plane that fits the video aspect ratio
    // We use 1x1 geometry and scale it in updateVideoSize
    const geometry = new THREE.PlaneGeometry(1, 1); 
    const material = new THREE.MeshBasicMaterial({ 
        map: this.videoTexture,
        depthWrite: false,
        depthTest: true, // Enable depth test to respect Z-order correctly
        transparent: false // Must be false to stay in opaque queue (which renders first)
    });
    this.videoMesh = new THREE.Mesh(geometry, material);
    this.videoMesh.position.set(0, 0, -500); // Put it even further back
    this.videoMesh.renderOrder = -999; // Very low order to ensure it's the base layer
    this.scene.add(this.videoMesh); 

    video.onloadedmetadata = () => {
        this.updateVideoSize();
    };

    video.load();
    console.log("Video loaded, offset:", this.videoOffset);
  }

  private syncVideo(): void {
    if (!this.videoElement || !this.isPlaying || this.isPaused) return;

    const settings = this.levelData.settings;
    const initialBPM = settings.bpm || 100;
    const initialSecPerBeat = 60 / initialBPM;
    const countdownTicks = settings.countdownTicks || 4;
    const countdownDuration = countdownTicks * initialSecPerBeat;
    const audioOffset = this.music.hasAudio ? (settings.offset || 0) : 0;
    
    // Current time in level (seconds), where 0 is the start of first tile
    const timeInLevel = (this.elapsedTime / 1000) - countdownDuration - (audioOffset / 1000);
    
    // Video time should be timeInLevel + (videoOffset / 1000)
    const targetVideoTime = timeInLevel + (this.videoOffset / 1000);

    if (targetVideoTime < 0) {
        if (!this.videoElement.paused) {
            this.videoElement.pause();
            this.videoElement.currentTime = 0;
        }
    } else {
        if (this.videoElement.paused) {
            this.videoElement.play().catch(e => console.warn("Video play failed:", e));
        }
        
        // Sync if drift is significant (> 100ms)
        if (Math.abs(this.videoElement.currentTime - targetVideoTime) > 0.1) {
            this.videoElement.currentTime = targetVideoTime;
        }
    }
  }

  public destroyPlayer(): void {
    this.stopPlay();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.removeEventListeners();
    
    // Cleanup video
    if (this.videoElement) {
        this.videoElement.pause();
        this.videoElement.src = "";
        this.videoElement.load();
        this.videoElement.remove();
        this.videoElement = null;
    }
    if (this.videoTexture) {
        this.videoTexture.dispose();
        this.videoTexture = null;
    }
    if (this.videoMesh) {
        this.scene.remove(this.videoMesh);
        if (this.videoMesh.geometry) this.videoMesh.geometry.dispose();
        if (this.videoMesh.material instanceof THREE.Material) {
            this.videoMesh.material.dispose();
        }
        this.videoMesh = null;
    }
    
    // Cleanup Three.js resources
    this.tiles.forEach(mesh => {
        // Only dispose unique materials. Shared geometry is disposed separately.
        if (mesh.material instanceof THREE.Material) {
            mesh.material.dispose();
        }
        mesh.children.length = 0;
    });
    this.tiles.clear();
    this.visibleTiles.clear();
    
    // Dispose geometry cache
    this.geometryCache.forEach(geometry => {
        geometry.dispose();
    });
    this.geometryCache.clear();
    
    if (this.planetRed) this.planetRed.dispose();
    if (this.planetBlue) this.planetBlue.dispose();
    
    if (this.sharedDecoGeometry) {
      this.sharedDecoGeometry.dispose();
      this.sharedDecoGeometry = null;
    }
    if (this.sharedTwirlMaterial) {
      this.sharedTwirlMaterial.dispose();
      this.sharedTwirlMaterial = null;
    }
    if (this.sharedSpeedUpMaterial) {
      this.sharedSpeedUpMaterial.dispose();
      this.sharedSpeedUpMaterial = null;
    }
    if (this.sharedSpeedDownMaterial) {
      this.sharedSpeedDownMaterial.dispose();
      this.sharedSpeedDownMaterial = null;
    }
    
    this.spatialGrid.clear();

    if (this.hitsoundManager) {
      this.hitsoundManager.dispose();
    }
    
    if (this.renderTarget) {
      this.renderTarget.dispose();
      this.renderTarget = null;
    }
    if (this.bloomEffect) {
      this.bloomEffect.dispose();
      this.bloomEffect = null;
    }
    
    if (this.renderer) {
      if (this.container && this.renderer.domElement && this.renderer.domElement.parentNode === this.container) {
          this.container.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
      this.renderer = null as any;
    }
    
    if (this.music) {
      this.music.dispose();
    }
  }
}
