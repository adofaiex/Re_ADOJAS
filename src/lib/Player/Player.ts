import * as THREE from 'three';
import {WebGPURenderer} from 'three/webgpu';
import { IPlayer, ILevelData, IMusic, TargetFramerateType } from './types';
import { Planet } from './Planet';
import { HitsoundManager, HitsoundType } from './HitsoundManager';
import { BloomEffect } from './BloomEffect';
import createTrackMesh from '../Geo/mesh_reserve';
import { getWorkerManager, disposeWorkerManager } from '../Geo/tileWorkerManager';
import { EasingFunctions } from './Easing';
import { HTMLAudioMusic } from './HTMLAudioMusic';
import { TileColorManager, isEventActive, TileColorConfig } from './TileColorManager';
import { CameraController, CameraTimelineEntry } from './CameraController';
import Stats from 'stats.js';

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
  private stats: Stats | null = null;
  
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

  // Camera Controller
  private cameraController: CameraController;
  
  // Tile Color Manager
  private tileColorManager: TileColorManager;

  // Bloom Effect
  private bloomEffect: BloomEffect | null = null;
  private bloomEnabled: boolean = false;
  private bloomThreshold: number = 50;
  private bloomIntensity: number = 100;
  private bloomColor: string = 'ffffff';
  private bloomTimeline: { time: number; event: any }[] = [];
  private lastBloomTimelineIndex: number = -1;
  
  // Recolor Track
  private recolorTimeline: { time: number; event: any }[] = [];
  private lastRecolorTimelineIndex: number = -1;
  
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

  // Renderer state
  private isRestoringContext: boolean = false;
  private webgpuSupported: boolean | null = null; // null = not checked, true = supported, false = not supported
  private rendererInitialized: boolean = false;

  private music: IMusic = new HTMLAudioMusic();

  constructor(levelData: ILevelData, rendererType: 'webgl' | 'webgpu' = 'webgpu') {
    this.rendererType = rendererType;
    this.levelData = levelData;
    
    // Initialize camera from settings
    this.cameraController = new CameraController(levelData, [], []);
    this.cameraController.resetCameraState();
    
    // Initialize tile color manager
    this.tileColorManager = new TileColorManager(levelData);
    
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
    // If hitsound is "None" or empty, default to "Kick"
    const rawHitsound = this.levelData.settings?.hitsound;
    const hitsoundType = (!rawHitsound || rawHitsound === 'None' ? 'Kick' : rawHitsound) as HitsoundType;
    const hitsoundVolume = this.levelData.settings?.hitsoundVolume ?? 100;
    console.log('[Player] Initializing HitsoundManager with type:', hitsoundType, 'volume:', hitsoundVolume, '(raw:', rawHitsound, ')');
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
    this.tileColorManager.initTileColors();

    // Calculate cumulative rotations
    this.calculateCumulativeRotations();
    
    // Update camera controller with calculated values
    this.cameraController = new CameraController(levelData, this.tileStartTimes, this.tileBPM);
    this.cameraController.resetCameraState();
    
    // Build Camera Timeline
    this.cameraController.buildCameraTimeline(this.tileCameraEvents);
    
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
    
    // Hitsounds will be synthesized during loading process with progress display
  }

  private formatHexColor(hex: string): string {
    return this.tileColorManager.formatHexColor(hex);
  }
  
  /**
   * Pre-synthesize hitsounds at level load time (called during initialization)
   */
  private async preSynthesizeHitsounds(): Promise<void> {
    console.log('[Player] preSynthesizeHitsounds called');
    if (!this.tileStartTimes || this.tileStartTimes.length === 0) {
      console.log('[Player] No tileStartTimes, skipping hitsound synthesis');
      return;
    }
    
    // Calculate total duration (last tile time + some buffer)
    const lastTileTime = this.tileStartTimes[this.tileStartTimes.length - 1] || 0;
    const totalDuration = lastTileTime + 10; // Add 10 seconds buffer
    
    // Collect all hitsound timestamps
    const hitsoundTimestamps: number[] = [];
    for (let i = 1; i < this.tileStartTimes.length; i++) {
        const t = this.tileStartTimes[i];
        const tile = this.levelData.tiles[i];
        if (tile && tile.angle !== 0) {
            hitsoundTimestamps.push(t);
        }
    }
    
    console.log('[Player] Hitsound timestamps count:', hitsoundTimestamps.length, 'total duration:', totalDuration);
    
    // Pre-synthesize (no progress callback for private method)
    await this.hitsoundManager.preSynthesize(hitsoundTimestamps, totalDuration);
  }
  
  /**
   * Pre-synthesize hitsounds with progress callback (public method for UI)
   * @param onProgress Progress callback (0-100)
   */
  public async preSynthesizeHitsoundsWithProgress(onProgress?: (percent: number) => void): Promise<void> {
    console.log('[Player] preSynthesizeHitsoundsWithProgress called');
    
    // Check if hitsounds are disabled or set to None
    if (!this.hitsoundManager.isEnabled() || this.hitsoundManager.getHitsoundType() === 'None') {
      console.log('[Player] Hitsounds disabled or set to None, skipping synthesis');
      if (onProgress) onProgress(100);
      return;
    }
    
    if (!this.tileStartTimes || this.tileStartTimes.length === 0) {
      console.log('[Player] No tileStartTimes, skipping hitsound synthesis');
      return;
    }
    
    // Calculate total duration (last tile time + some buffer)
    const lastTileTime = this.tileStartTimes[this.tileStartTimes.length - 1] || 0;
    const totalDuration = lastTileTime + 10; // Add 10 seconds buffer
    
    // Collect all hitsound timestamps
    const hitsoundTimestamps: number[] = [];
    for (let i = 1; i < this.tileStartTimes.length; i++) {
        const t = this.tileStartTimes[i];
        const tile = this.levelData.tiles[i];
        if (tile && tile.angle !== 0) {
            hitsoundTimestamps.push(t);
        }
    }
    
    console.log('[Player] Hitsound timestamps count:', hitsoundTimestamps.length, 'total duration:', totalDuration);
    
    // Pre-synthesize with progress callback
    await this.hitsoundManager.preSynthesize(hitsoundTimestamps, totalDuration, onProgress);
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
      
      this.container.removeEventListener('touchstart', this.boundHandlers.touchstart as EventListener);
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
    
    // Calculate world units per pixel
    const zoom = this.camera.zoom || 1.0;
    const frustumHeight = (this.camera.top - this.camera.bottom) / zoom;
    const unitsPerPixel = frustumHeight / this.container!.clientHeight;

    this.cameraPosition.x -= deltaX * unitsPerPixel;
    this.cameraPosition.y += deltaY * unitsPerPixel;
    
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

  public setStatsPanel(enabled: boolean): void {
    try {
      if (enabled && !this.stats) {
        // Create stats.js panel
        this.stats = new Stats();
        this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        this.stats.dom.style.position = 'absolute';
        this.stats.dom.style.top = '64px';
        this.stats.dom.style.left = '16px';
        if (this.container) {
          this.container.appendChild(this.stats.dom);
        }
      } else if (!enabled && this.stats) {
        // Remove stats.js panel
        if (this.stats.dom.parentNode) {
          this.stats.dom.parentNode.removeChild(this.stats.dom);
        }
        this.stats = null;
      }
    } catch (e) {
      console.warn('Failed to initialize stats.js:', e);
      this.stats = null;
    }
  }

  private startRenderLoop(): void {
    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 0;
    let fpsTime = lastTime;

    const animate = (time: number) => {
      try {
        this.stats?.begin();
      } catch (e) {
        // ignore stats errors
      }
      
      this.animationId = requestAnimationFrame(animate);
      
      // Frame rate limiting
      if (this.frameInterval > 0) {
        const elapsed = time - this.lastFrameTime;
        if (elapsed < this.frameInterval) {
          try {
            this.stats?.end();
          } catch (e) {
            // ignore stats errors
          }
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
      
      try {
        this.stats?.end();
      } catch (e) {
        // ignore stats errors
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

    // Use music sync only when music is actively playing
    const musicEnded = this.music.hasAudio && !this.music.isPlaying && !this.music.isPaused && this.elapsedTime > countdownDuration * 1000;
    
    if (this.music.isPlaying && this.music.hasAudio) {
        const musicTime = this.music.position * 1000;
        
        if (musicTime > 0) {
            const expectedElapsedTime = musicTime + countdownDuration * 1000;
            const actualElapsedTime = performance.now() - this.startTime;

            if (Math.abs(expectedElapsedTime - actualElapsedTime) > 50) {
                 this.startTime = performance.now() - expectedElapsedTime;
                 this.elapsedTime = expectedElapsedTime;
            } else {
                 this.elapsedTime = actualElapsedTime;
            }
        } else {
            const musicStartTime = countdownDuration * 1000;
            this.startTime = performance.now() - musicStartTime;
            this.elapsedTime = musicStartTime;
        }
    } else if (musicEnded) {
        const now = performance.now();
        this.elapsedTime = now - this.startTime;
    } else {
        if (this.isPlaying && !this.isPaused) {
             const now = performance.now();
             this.elapsedTime = now - this.startTime;

             // Calculate music start time based on first tile angle
             // tileStartTimes[0] is negative when first tile has duration
             const firstTileOffset = this.tileStartTimes.length > 0 ? this.tileStartTimes[0] * 1000 : 0;
             const musicStartTime = countdownDuration * 1000 + firstTileOffset;
             
             if (this.music.hasAudio && !this.music.isPaused && this.elapsedTime >= musicStartTime) {
                 this.music.play();
             }
        }
    }
    
    this.updatePlanetsPosition();
    
    this.updateCameraFollow(delta);

    this.updateAnimatedTiles();
  }

  private updateAnimatedTiles(): void {
    const time = this.elapsedTime / 1000;
    
    this.visibleTiles.forEach(id => {
        const index = parseInt(id);
        const config = this.tileColorManager.getTileRecolorConfig(index);
        
        if (config && ['Glow', 'Blink', 'Rainbow', 'Volume'].includes(config.trackColorType)) {
            const rendered = this.tileColorManager.getTileRenderer(index, time, config, this.music.amplitude);
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
        const isWebGPU = this.rendererType === 'webgpu';
        const backendReady = !isWebGPU || (this.renderer as any).backend !== null;
        
        if (!backendReady) {
          return;
        }
        
        const gl = (this.renderer as any).getContext?.();
        if (gl && gl.isContextLost?.()) {
          return;
        }
        
        if (this.bloomEnabled && !isWebGPU && this.bloomEffect && this.bloomEffect.getEnabled()) {
          if (!this.renderTarget) {
            this.renderTarget = new THREE.WebGLRenderTarget(
              this.container?.clientWidth || window.innerWidth,
              this.container?.clientHeight || window.innerHeight
            );
          }
          
          this.renderer.setRenderTarget(this.renderTarget);
          this.renderer.render(this.scene, this.camera);
          this.renderer.setRenderTarget(null);
          
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
    
    this.createPlanets();
    
    // Reset camera state
    this.cameraController.setLastCameraTimelineIndex(-1);
    this.cameraController.resetCameraState();
    
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
    // Account for first tile angle - tileStartTimes[0] is negative when first tile has duration
    const firstTileOffset = this.tileStartTimes.length > 0 ? this.tileStartTimes[0] : 0;
    const totalDelay = countdownDuration + (offset / 1000) + firstTileOffset;

    // Start pre-synthesized hitsound track
    const synthesized = this.hitsoundManager.isSynthesized();
    console.log('[Player] startPlay - hitsound synthesized:', synthesized, 'totalDelay:', totalDelay);
    if (synthesized) {
        this.hitsoundManager.start(totalDelay);
    }
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
      
      if (enabled === true || enabled === 'Enabled' || enabled === '') {
          this.bloomEnabled = true;
          if (event.threshold !== undefined) this.bloomThreshold = event.threshold;
          if (event.intensity !== undefined) this.bloomIntensity = event.intensity;
          if (event.color !== undefined) {
              if (Array.isArray(event.color)) {
                  const r = Math.round(event.color[0] * 255).toString(16).padStart(2, '0');
                  const g = Math.round(event.color[1] * 255).toString(16).padStart(2, '0');
                  const b = Math.round(event.color[2] * 255).toString(16).padStart(2, '0');
                  this.bloomColor = r + g + b;
              } else if (typeof event.color === 'string') {
                  this.bloomColor = event.color.replace('#', '');
              } else {
                  this.bloomColor = 'ffffff';
              }
          }
      } else if (enabled === false || enabled === 'Disabled') {
          this.bloomEnabled = false;
      }
      
      if (this.bloomEffect) {
          this.bloomEffect.setEnabled(this.bloomEnabled);
          this.bloomEffect.setThreshold(this.bloomThreshold / 100);
          this.bloomEffect.setIntensity(this.bloomIntensity / 100);
          this.bloomEffect.setColor(this.bloomColor);
      }
  }

  public stopPlay(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.removePlanets();
    
    if (this.music && (this.music as any).hasAudio ? this.music.hasAudio : false) {
      this.music.stop();
    }
    
    // Stop pre-synthesized hitsound track
    this.hitsoundManager.stop();
    
    if (this.videoElement) {
        this.videoElement.pause();
        this.videoElement.currentTime = 0;
    }
    
    this.bloomEnabled = false;
    this.bloomThreshold = 10;
    this.bloomIntensity = 150; 
    this.bloomColor = 'ffffff';
    this.lastBloomTimelineIndex = -1;
    if (this.bloomEffect) {
      this.bloomEffect.setEnabled(false);
      this.bloomEffect.setThreshold(0.5);
      this.bloomEffect.setIntensity(1);
      this.bloomEffect.setColor('ffffff');
    }
    
    this.tileColorManager.initTileColors();
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
    // Stop pre-synthesized hitsound track
    this.hitsoundManager.stop();
  }

  public resumePlay(): void {
    if (!this.isPlaying || !this.isPaused) return;
    this.isPaused = false;
    const pauseDuration = performance.now() - this.pauseTime;
    this.startTime += pauseDuration;
    if (this.music && (this.music as any).hasAudio ? this.music.hasAudio : false) {
      this.music.resume();
    }
    
    const currentTimeInSeconds = this.elapsedTime / 1000;
    const settings = this.levelData.settings;
    const countdownTicks = settings.countdownTicks || 4;
    const countdownBPM = (this.tileBPM && this.tileBPM[0]) || settings.bpm || 100;
    const initialSecPerBeat = 60 / countdownBPM;
    const countdownDuration = countdownTicks * initialSecPerBeat;
    const offset = this.music.hasAudio ? (this.levelData.settings.offset || 0) : 0;
    // Account for first tile angle - tileStartTimes[0] is negative when first tile has duration
    const firstTileOffset = this.tileStartTimes.length > 0 ? this.tileStartTimes[0] : 0;
    const totalDelay = countdownDuration + (offset / 1000) + firstTileOffset;
    const timeInLevel = currentTimeInSeconds - totalDelay;
    
    // Resume pre-synthesized hitsound track from current position
    if (this.hitsoundManager.isSynthesized() && timeInLevel > 0) {
        this.hitsoundManager.startAtOffset(timeInLevel);
    }
  }

  public resetPlayer(): void {
    this.stopPlay();
    this.startPlay();
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
    const startIdx = this.tileColorManager.PosRelativeTo(event.startTile, event.floor);
    const endIdx = this.tileColorManager.PosRelativeTo(event.endTile, event.floor);
    const gap = (event.gapLength !== undefined) ? event.gapLength : 0;
    
    const settings = this.levelData.settings;
    const defaultColor = settings.trackColor || 'debb7b';
    const defaultSecondaryColor = settings.secondaryTrackColor || 'ffffff';
    const defaultStyle = settings.trackStyle || 'Standard';
    const defaultColorType = settings.trackColorType || 'Single';

    const colors = this.tileColorManager.parseColorTrackType(
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

    const minIdx = Math.max(0, Math.min(startIdx, endIdx));
    const maxIdx = Math.min(this.tileColorManager.getTotalTiles() - 1, Math.max(startIdx, endIdx));
    
    for (let i = minIdx; i <= maxIdx; i += (gap + 1)) {
        this.tileColorManager.setTileRecolorConfig(i, config);
        const rendered = this.tileColorManager.getTileRenderer(i, this.elapsedTime / 1000, config, this.music.amplitude);
        this.applyTileColor(i, rendered.color, rendered.bgcolor);
    }
  }

  private applyTileColor(index: number, color: string, bgcolor: string): void {
    this.tileColorManager.setTileColor(index, color, bgcolor);
    this.updateTileMeshColor(index);
  }

  private updateTileMeshColor(index: number): void {
    const id = index.toString();
    const mesh = this.tiles.get(id);
    if (mesh && mesh.material instanceof THREE.ShaderMaterial) {
        const colors = this.tileColorManager.getTileColor(index);
        if (colors) {
            mesh.material.uniforms.uColor.value.set(colors.color);
            mesh.material.uniforms.uBgColor.value.set(colors.secondaryColor || colors.color);
        }
    }
  }

  // --- Helper Methods ---

  public onWindowResize(): void {
    if (!this.container) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    const aspect = width / height;
    const baseFrustumSize = 8;
    
    this.camera.left = -baseFrustumSize * aspect / 2;
    this.camera.right = baseFrustumSize * aspect / 2;
    this.camera.top = baseFrustumSize / 2;
    this.camera.bottom = -baseFrustumSize / 2;
    
    this.camera.zoom = this.zoom * this.zoomMultiplier;
    
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    
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
    
    const frustumHeight = (this.camera.top - this.camera.bottom) / this.camera.zoom;
    const frustumWidth = (this.camera.right - this.camera.left) / this.camera.zoom;
    const frustumAspect = frustumWidth / frustumHeight;
    
    let scale = 1;
    if (frustumAspect > videoAspect) {
        scale = frustumWidth / 1.0;
        this.videoMesh.scale.set(scale, scale / videoAspect, 1);
    } else {
        scale = frustumHeight / 1.0;
        this.videoMesh.scale.set(scale * videoAspect, scale, 1);
    }
  }

  private createPlanets(): void {
    this.planetRed = new Planet(0xff0000, undefined, this.showTrail);
    this.planetBlue = new Planet(0x0000ff, undefined, this.showTrail);
    
    this.planetRed.render(this.scene);
    this.planetBlue.render(this.scene);
    
    if (this.levelData.tiles && this.levelData.tiles.length > 1) {
      const t0 = this.levelData.tiles[0];
      const t1 = this.levelData.tiles[1];
      if (t0 && t1) {
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
   */
  private initSharedDecorationResources(): void {
    const decoSize = 0.275 * 0.8;
    
    this.sharedDecoGeometry = new THREE.CircleGeometry(decoSize / 2, 16);
    
    this.sharedTwirlMaterial = new THREE.MeshBasicMaterial({ color: 0x800080 });
    this.sharedSpeedUpMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.sharedSpeedDownMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
  }

  private lastVisibleCheckPos = new THREE.Vector3(Infinity, Infinity, Infinity);
  private lastVisibleCheckZoom = -1;

  private updateVisibleTiles(): void {
    if (!this.scene || !this.levelData.tiles || !this.camera) return;

    const zoom = this.camera.zoom || 1.0;
    
    const distSq = this.cameraPosition.distanceToSquared(this.lastVisibleCheckPos);
    if (distSq < 0.01 && Math.abs(zoom - this.lastVisibleCheckZoom) < 0.01) {
        return;
    }
    
    this.lastVisibleCheckPos.copy(this.cameraPosition);
    this.lastVisibleCheckZoom = zoom;

    const left = this.cameraPosition.x + this.camera.left / zoom;
    const right = this.cameraPosition.x + this.camera.right / zoom;
    const bottom = this.cameraPosition.y + this.camera.bottom / zoom;
    const top = this.cameraPosition.y + this.camera.top / zoom;
    
    const margin = 2.0;
    const newVisibleTiles: number[] = [];

    const minCellX = Math.floor((left - margin) / this.spatialGridSize);
    const maxCellX = Math.floor((right + margin) / this.spatialGridSize);
    const minCellY = Math.floor((bottom - margin) / this.spatialGridSize);
    const maxCellY = Math.floor((top + margin) / this.spatialGridSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const tileIndices = this.spatialGrid.get(cx * 100000 + cy);
        if (tileIndices) {
          for (let i = 0; i < tileIndices.length; i++) {
            newVisibleTiles.push(tileIndices[i]);
          }
        }
      }
    }

    const idsInScene = Array.from(this.visibleTiles);
    for (let i = 0; i < idsInScene.length; i++) {
        const id = idsInScene[i];
        const idx = parseInt(id);
        if (!newVisibleTiles.includes(idx)) {
            const mesh = this.tiles.get(id);
            if (mesh) {
                this.scene.remove(mesh);
            }
            this.visibleTiles.delete(id);
        }
    }

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

    if (this.tiles.size > this.maxCachedTiles) {
        this.cleanupTileCache();
    }
  }

  private cleanupTileCache(): void {
    const tileEntries = Array.from(this.tiles.entries());
    
    tileEntries.sort((a, b) => {
        const distA = a[1].position.distanceToSquared(this.cameraPosition);
        const distB = b[1].position.distanceToSquared(this.cameraPosition);
        return distB - distA;
    });
    
    const toRemoveCount = Math.floor(this.tiles.size * 0.3);
    let removed = 0;
    
    for (let i = 0; i < tileEntries.length && removed < toRemoveCount; i++) {
        const [id, mesh] = tileEntries[i];
        if (!this.visibleTiles.has(id)) {
            if (mesh.material instanceof THREE.Material) {
                mesh.material.dispose();
            }
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
    
    let pred = -180;
    if (index > 0) {
       const prevTile = this.levelData.tiles[index - 1];
       pred = (prevTile.direction || 0) - 180;
       if (prevTile.direction === 999 && index > 1) {
         pred = (this.levelData.tiles[index - 2].direction || 0);
       }
    }
    
    const currentDirection = tile.direction || 0;
    const is999 = (tile.angle === 0);
    
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

    const colors = this.tileColorManager.getTileColor(index);
    const color = colors?.color || '#ffffff';
    const bgcolor = colors?.secondaryColor || color;
    
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(color) },
            uBgColor: { value: new THREE.Color(bgcolor) }
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
    
    const offset = this.music.hasAudio ? (this.levelData.settings.offset || 0) : 0;
    
    const countdownBPM = (this.tileBPM && this.tileBPM[0]) || settings.bpm || 100;
    const initialSecPerBeat = 60 / countdownBPM;
    const countdownDuration = countdownTicks * initialSecPerBeat;
    // Account for first tile angle - tileStartTimes[0] is negative when first tile has duration
    const firstTileOffset = this.tileStartTimes.length > 0 ? this.tileStartTimes[0] : 0;
    const timeInLevel = (this.elapsedTime / 1000) - countdownDuration - (offset / 1000) - firstTileOffset;
    
    // Process Recolor timeline
    if (this.lastRecolorTimelineIndex >= 0) {
        const currentEntry = this.recolorTimeline[this.lastRecolorTimelineIndex];
        if (currentEntry && timeInLevel < currentEntry.time) {
            this.tileColorManager.initTileColors();
            this.lastRecolorTimelineIndex = -1;
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
        // Countdown phase - handled by standard logic
    }
    
    // Playing Phase
    if (this.tileStartTimes.length > 0) {
        if (timeInLevel < this.tileStartTimes[this.currentTileIndex]) {
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
            while (this.currentTileIndex + 1 < this.tileStartTimes.length && 
                   this.tileStartTimes[this.currentTileIndex + 1] <= timeInLevel) {
                this.currentTileIndex++;
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
             const radiansPerSecond = (bpm / 60) * Math.PI;
             const isCW = this.tileIsCW[lastIndex];
             
             const totalAngle = extraTime * radiansPerSecond;
             
             const currentAngle = isCW ? (startAngle - totalAngle) : (startAngle + totalAngle);
             
             const dist = 1.0;
             movingPlanet.position.set(
                 pivotPos[0] + Math.cos(currentAngle) * dist,
                 pivotPos[1] + Math.sin(currentAngle) * dist,
                 0.1
             );
             
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
      // Account for first tile angle - tileStartTimes[0] is negative when first tile has duration
      const firstTileOffset = this.tileStartTimes.length > 0 ? this.tileStartTimes[0] : 0;
      
      const currentTimeInSeconds = this.elapsedTime / 1000;
      const timeInLevel = currentTimeInSeconds - countdownDuration - (offset / 1000) - firstTileOffset;

      // Process camera events
      const lastIdx = this.cameraController.getLastCameraTimelineIndex();
      const cameraTimeline = this.cameraController.getCameraTimeline();
      
      if (lastIdx >= 0) {
          const currentEntry = cameraTimeline[lastIdx];
          if (currentEntry && timeInLevel < currentEntry.time) {
              this.cameraController.resetCameraState();
              this.cameraController.setLastCameraTimelineIndex(-1);
          }
      }

      let newIdx = lastIdx;
      while (newIdx + 1 < cameraTimeline.length && 
             cameraTimeline[newIdx + 1].time <= timeInLevel) {
          newIdx++;
          const entry = cameraTimeline[newIdx];
          // Pass current camera state and tile index for proper transition handling
          const cameraSnapshot = {
              position: { x: this.cameraPosition.x, y: this.cameraPosition.y },
              zoom: this.zoom,
              rotation: this.camera.rotation.z * (180 / Math.PI)
          };
          this.cameraController.processCameraEvent(
              entry.event, 
              entry.event.floor || 0, 
              this.elapsedTime,
              cameraSnapshot
          );
      }
      this.cameraController.setLastCameraTimelineIndex(newIdx);
      
      // Process Bloom events
      if (this.lastBloomTimelineIndex >= 0) {
          const currentEntry = this.bloomTimeline[this.lastBloomTimelineIndex];
          if (currentEntry && timeInLevel < currentEntry.time) {
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
      
      // Get interpolated camera values
      const interpolated = this.cameraController.getInterpolatedValues(this.elapsedTime);
      
      // Calculate target position
      const target = this.cameraController.calculateTargetPosition(this.currentPivotPosition);

      // Apply smoothing
      const currentBPM = (this.tileBPM && this.tileBPM[this.currentTileIndex]) || 100;
      const smoothingIndex = 15 * Math.pow(100 / Math.max(1, currentBPM), 0.15);
      
      const step = 1.0 - Math.pow(1.0 - 1.0 / smoothingIndex, delta * 60);
      
      this.cameraPosition.x += (target.x - this.cameraPosition.x) * step;
      this.cameraPosition.y += (target.y - this.cameraPosition.y) * step;

      // Update camera
      this.camera.position.x = this.cameraPosition.x;
      this.camera.position.y = this.cameraPosition.y;
      
      this.zoom = 100 / interpolated.zoom;
      this.camera.zoom = this.zoom * this.zoomMultiplier;
      this.camera.updateProjectionMatrix();
      
      this.camera.rotation.z = interpolated.rotation * (Math.PI / 180);

      // Sync Video Background
      if (this.videoMesh) {
          this.videoMesh.position.x = this.camera.position.x;
          this.videoMesh.position.y = this.camera.position.y;
          this.videoMesh.rotation.z = this.camera.rotation.z;
          
          if (Math.abs(this.camera.zoom - this.lastVisibleCheckZoom) > 0.001) {
              this.updateVideoSize();
          }
      }

      this.updateVisibleTiles();
  }

  public setZoom(logicalZoom: number): void {
    const cameraMode = this.cameraController.getCameraMode();
    cameraMode.zoom = logicalZoom;
    this.zoom = 100 / logicalZoom;
    this.onWindowResize();
  }

  public loadMusic(src: string): void {
    this.music.load(src);
    
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
    video.muted = true;
    video.playsInline = true;
    
    this.videoElement = video;
    this.videoTexture = new THREE.VideoTexture(video);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.PlaneGeometry(1, 1); 
    const material = new THREE.MeshBasicMaterial({ 
        map: this.videoTexture,
        depthWrite: false,
        depthTest: true,
        transparent: false
    });
    this.videoMesh = new THREE.Mesh(geometry, material);
    this.videoMesh.position.set(0, 0, -500);
    this.videoMesh.renderOrder = -999;
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
    // Account for first tile angle - tileStartTimes[0] is negative when first tile has duration
    const firstTileOffset = this.tileStartTimes.length > 0 ? this.tileStartTimes[0] : 0;
    
    const timeInLevel = (this.elapsedTime / 1000) - countdownDuration - (audioOffset / 1000) - firstTileOffset;
    
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