import { Scene, OrthographicCamera, WebGLRenderer, Mesh, Vector3, Texture, BufferGeometry, WebGLRenderTarget, Color, Vector2, DirectionalLight, Float32BufferAttribute, Euler, Material, MeshBasicMaterial, TextureLoader, SRGBColorSpace, NearestFilter, LinearFilter, PlaneGeometry, BufferAttribute, Sprite, SpriteMaterial, RepeatWrapping, LinearMipmapLinearFilter, VideoTexture, DoubleSide, Raycaster, Intersection } from 'three';
import {WebGPURenderer} from 'three/webgpu';
import { IPlayer, ILevelData, IMusic, TargetFramerateType } from './types';
import { Planet } from './Planet';
import { HitsoundManager, HitsoundType, TimestampGroup } from './HitsoundManager';
import { BloomEffect } from './BloomEffect';
import { FlashEffect } from './FlashEffect';
import createTrackMesh from '../Geo/mesh_reserve';
import { EasingFunctions } from './Easing';
import { HTMLAudioMusic, getSharedAudioContext } from './HTMLAudioMusic';
import tileTextureUrl from '@/assets/texture.json';
import { TileColorManager, TileColorConfig, parseHexAlpha } from './TileColorManager';
import { isEventActive } from './EventUtils';
import { CameraController, CameraTimelineEntry } from './CameraController';
import { DecorationManager } from './DecorationManager';
import { MoveTrackManager } from './MoveTrackManager';
import { PositionTrackManager } from './PositionTrackManager';
import { InstancedMeshManager } from './InstancedMeshManager';
import { TimelineManager } from './TimelineManager';
import { OverlayHUD } from './OverlayHUD';
import { ShakeScreen } from './effects/ShakeScreen';
import { getIconTypeIndex, getTwirlTexture, getSetSpeedTexture, IconType, buildIconAtlas, ICON_ATLAS_SIZE } from './IconLoader';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import type { Bloom, Flash, RecolorTrack } from 'adofai/event';
import { Level } from 'adofai';

export class Player implements IPlayer {
  private container: HTMLElement | null = null;
  private scene: Scene;
  private camera: OrthographicCamera;
  private renderer!: WebGLRenderer | WebGPURenderer;
  private rendererType: 'webgl' | 'webgpu' = 'webgpu';
  private renderMethod: 'sync' | 'async' = 'sync';
  private showTrail: boolean = false;
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
  private tiles: Map<string, Mesh> = new Map();
  private visibleTiles: Set<string> = new Set();
  private tileLimit: number = 0;

  // Dirty tile tracking: only tiles in this set get their instanced mesh synced.
  // Most tiles are static each frame — this avoids iterating all visible tiles.
  private dirtyTiles: Set<number> = new Set();

  // Spatial indexing for fast visibility checks
  private spatialGrid: Map<number, number[]> = new Map();
  private spatialGridSize: number = 5; // Grid cell size in world units
  // Hitsound
  private hitsoundManager: HitsoundManager;
  
  // Playback state
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private elapsedTime: number = 0;
  private musicStartDelay: number = 0; // Music start delay in seconds
  private hitsoundStartDelay: number = 0; // Hitsound start delay in seconds
  private audioDriftSynced: boolean = false; // whether one-shot audio sync has been applied
  
  private currentTileIndex: number = 0;
  
  // Camera settings
  private zoom: number = 1;
  private zoomMultiplier: number = 1.0;
  private adoZoom: number = 100;
  private cameraPosition: Vector3 = new Vector3(0, 0, 0);
  private _lastCamSmoothTile: number = -1;
  
  // Interaction state
  private isDragging: boolean = false;
  private previousMousePosition: { x: number; y: number } = { x: 0, y: 0 };
  private mouseDownPos: { x: number; y: number } = { x: 0, y: 0 };
  private raycaster: Raycaster = new Raycaster();
  public selectedTileIndex: number | null = null;
  private selectionTime: number = 0;
  private _targetCamPos: Vector3 | null = null;
  private initialPinchDistance: number = 0;
  private initialZoom: number = 0;
  
  private boundHandlers: { [key: string]: EventListenerOrEventListenerObject } = {};

  // Overlay HUD (2D canvas, replaces DOM stats)
  public overlayHUD: OverlayHUD | null = null;

  // Stats callback
  private onStatsUpdate: ((stats: { fps: number; time: number; tileIndex: number; tileBPM: number[]; tileStartTimes: number[]; totalTiles: number }) => void) | null = null;
  private frameCount: number = 0;
  private lastTime: number = 0;

  // Precalculated rotations and timing
  private cumulativeRotations: number[] = [];
  private totalLevelRotation: number = 0;

  private tileStartTimes: number[] = [];

  // Cached resolved absolute directions (angleData with 999s resolved via backtracking)
  private resolvedTileDirections: number[] | null = null;
  private tileDurations: number[] = [];
  private tileExtraRotations: number[] = [];
  private tileIsCW: boolean[] = [];
  private tileBPM: number[] = [];
  private tileStartAngle: number[] = [];
  private tileStickToFloors: boolean[] = []; // Whether planet follows each tile
  private tileTotalAngle: number[] = [];
  private tileStartDist: number[] = [];
  private tileEndDist: number[] = [];
  private tileEvents: Map<number, any[]> = new Map();
  private tileCameraEvents: Map<number, any[]> = new Map();
  private tileSetHitsoundEvents: Map<number, any[]> = new Map();
  private tilePlayHitsoundEvents: Map<number, any[]> = new Map();
  private timelineManager: TimelineManager;

  // Per-tile hitsound overrides (from SetHitsound events)
  // Each entry: {type, volume} to override the default hitsound for that tile
  private setHitsoundOverrides: Map<number, {type: HitsoundType, volume: number}> = new Map();

  // Tile position history cache for trail rendering (circular buffer)
  // Stores actual mesh positions per frame so trails can look up historical positions
  // without replaying MoveTrack events (which is slow and error-prone)
  private trailPositionCache: Float64Array[] = [];
  private trailTimeCache: number[] = [];
  private trailCacheWriteIdx: number = 0;
  private static readonly TRAIL_CACHE_SIZE = 30; // ~0.5s at 60fps
  private trailCacheReady: boolean = false;

  // Camera Controller
  private cameraController: CameraController;
  
  // Tile Color Manager
  private tileColorManager: TileColorManager;
  
  // Decoration Manager
  private decorationManager: DecorationManager | null = null;

  // MoveTrack Manager
  private moveTrackManager: MoveTrackManager | null = null;

  // PositionTrack Manager
  private positionTrackManager: PositionTrackManager | null = null;
  private instancedMeshManager: InstancedMeshManager | null = null;
  private isEditorMode: boolean = false; // Whether we're in editor preview mode

  // Bloom Effect
  private bloomEffect: BloomEffect | null = null;
  private bloomEnabled: boolean = false;
  private bloomThreshold: number = 50;
  private bloomIntensity: number = 100;
  private bloomColor: string = 'ffffff';
  
  // Flash Effect
  private flashEffect: FlashEffect | null = null;

  // Shake Screen Effect
  private shakeScreen: ShakeScreen | null = null;
  
  // Custom Background (SetCustomBG event)
  private customBGMesh: Mesh | null = null;
  private customBGTexture: Texture | null = null;
  private customBGImages: Map<string, string> = new Map(); // filename -> URL
  
  // Shared Renderer Resources
  private geometryCache: Map<string, BufferGeometry> = new Map();
  private maxCachedTiles: number = 2000; // Only keep this many meshes in memory

  // Video Background
  private videoElement: HTMLVideoElement | null = null;
  private videoTexture: Texture | null = null;
  private videoMesh: Mesh | null = null;
  private videoOffset: number = 0; // ms

  // Render target for post-processing
  private renderTarget: WebGLRenderTarget | null = null;

  // Renderer state
  private isRestoringContext: boolean = false;
  private webgpuSupported: boolean | null = null; // null = not checked, true = supported, false = not supported
  private rendererInitialized: boolean = false;

  private music: IMusic = new HTMLAudioMusic();

  constructor(levelData: Level, rendererType: 'webgl' | 'webgpu' = 'webgpu') {
    this.rendererType = rendererType;
    this.levelData = levelData;

    // Convert pathData to tiles if needed
    this.convertPathDataToTiles();

    // Initialize camera from settings
    this.cameraController = new CameraController(levelData, [], []);
    this.cameraController.resetCameraState();
    
    // Initialize tile color manager
    this.tileColorManager = new TileColorManager(levelData);

    // Calculate basic tile positions (without PositionTrack) first
    // This is needed because we skipped ADOFAI-JS's calculateTilePosition()
    this.calculateBasicTilePositions();

    // Initialize position track manager
    this.positionTrackManager = new PositionTrackManager(levelData);

    // Parse actions if available
    if (this.levelData.actions) {
      this.levelData.actions.forEach(action => {
        const floor = action.floor;
        if (action.eventType === 'MoveCamera') {
            if (!this.tileCameraEvents.has(floor)) {
                this.tileCameraEvents.set(floor, []);
            }
            this.tileCameraEvents.get(floor)!.push(action);
        } else if (action.eventType === 'MoveTrack') {
            // handled by TimelineManager during build
        } else if (action.eventType === 'SetHitsound') {
            if (!this.tileSetHitsoundEvents.has(floor)) {
                this.tileSetHitsoundEvents.set(floor, []);
            }
            this.tileSetHitsoundEvents.get(floor)!.push(action);
            // Store per-tile override immediately
            const hsType = (action.hitsound || 'ReverbClack') as HitsoundType;
            const hsVol = action.hitsoundVolume != null ? action.hitsoundVolume : 100;
            this.setHitsoundOverrides.set(floor, { type: hsType, volume: hsVol });
        } else if (action.eventType === 'PlayHitsound') {
            if (!this.tilePlayHitsoundEvents.has(floor)) {
                this.tilePlayHitsoundEvents.set(floor, []);
            }
            this.tilePlayHitsoundEvents.get(floor)!.push(action);
        } else {
            if (!this.tileEvents.has(floor)) {
                this.tileEvents.set(floor, []);
            }
            this.tileEvents.get(floor)!.push(action);
        }
      });
    }

    // Initialize HitsoundManager
    // Default type is used as fallback when no per-tile override exists
    const rawHitsound = this.levelData.settings?.hitsound;
    const defaultHitsoundType = (!rawHitsound || rawHitsound === 'None' ? 'Kick' : rawHitsound) as HitsoundType;
    console.log('[Player] Initializing HitsoundManager, default type:', defaultHitsoundType);
    this.hitsoundManager = new HitsoundManager(defaultHitsoundType, 100);

    // Initialize Three.js components
    this.scene = new Scene();

    // Initialize InstancedMeshManager
    this.instancedMeshManager = new InstancedMeshManager(
      this.scene,
      (shapeKey: string) => this.generateGeometryFromShapeKey(shapeKey),
      true // Enable instancing
    );

    // Load tile texture overlay (used for Standard track style)
    this.loadTileTexture();

    // Initialize icon atlas for UV-based floor icons
    buildIconAtlas().then(atlas => {
        if (this.instancedMeshManager) {
            this.instancedMeshManager.setIconAtlas(atlas, 8, 0.44);
        }
    }).catch(e => console.warn('[Player] Icon atlas build failed:', e));
    
    // Set background color from level settings
    const bgColor = this.levelData.settings?.backgroundColor || '000000';
    this.scene.background = new Color(this.formatHexColor(bgColor));
    
    // Initialize video settings
    this.videoOffset = this.levelData.settings?.vidOffset || 0;

    // Append extra tile at the end
    this.appendExtraTile();

    // Re-initialize position track manager with updated tiles (including extra tile)
    this.positionTrackManager = new PositionTrackManager(levelData);

    // Update levelData.tiles with final positions (including PositionTrack offsets)
    const allTransforms = this.positionTrackManager.calculateAllTileTransforms(this.isEditorMode);
    for (let i = 0; i < this.levelData.tiles.length; i++) {
      const transform = allTransforms.get(i);
      if (transform) {
        this.levelData.tiles[i].position = [transform.position.x, transform.position.y];
      }
    }

    // Initialize tile colors from settings (now after appendExtraTile)
    this.tileColorManager.initTileColors();

    // Calculate cumulative rotations
    this.calculateCumulativeRotations();

    // Precomputed tile positions/rotations as base for MoveTrack computation
    const basePositions: Vector2[] = this.levelData.tiles.map((t: any) =>
        new Vector2(t.position[0], t.position[1])
    );
    const baseRotations: number[] = this.levelData.tiles.map((_: any, i: number) => {
        const transform = this.positionTrackManager?.getTileTransform(i);
        return transform ? transform.rotation * Math.PI / 180 : 0;
    });
    const baseScales: Vector2[] = this.levelData.tiles.map((_: any, i: number) => {
        const transform = this.positionTrackManager?.getTileTransform(i);
        return transform ? new Vector2(transform.scale.x, transform.scale.y) : new Vector2(1, 1);
    });
    const baseOpacities: number[] = this.levelData.tiles.map((_: any, i: number) => {
        const transform = this.positionTrackManager?.getTileTransform(i);
        return transform ? transform.opacity : 1;
    });

    // Initialize Timeline Manager (unified timelines for all event types)
    this.timelineManager = new TimelineManager(
      this.levelData.actions || [],
      this.tileStartTimes,
      this.tileBPM,
      basePositions,
      baseRotations,
      baseScales,
      baseOpacities,
      this.levelData.tiles.length,
      this.levelData.settings,
    );

    // Update camera controller with calculated values
    this.cameraController = new CameraController(levelData, this.tileStartTimes, this.tileBPM);
    this.cameraController.resetCameraState();
    
    // Build Camera Timeline from repeat-expanded events
    const expandedCamera = this.timelineManager.cameraEvents.map(e => ({
        time: e.time,
        event: { ...e.event, floor: e.floor, angleOffset: e.angleOffset },
    }));
    this.cameraController.loadCameraTimeline(expandedCamera);

    // Initialize Decoration Manager
    this.decorationManager = new DecorationManager(
      this.scene,
      this.levelData,
      this.tileStartTimes,
      this.tileBPM
    );
    this.decorationManager.init();

    // Build decoration keyframes into TimelineManager for unified seeking
    this.decorationManager.buildTimelineKeyframes(this.timelineManager);
    (this.decorationManager as any)._timelineManager = this.timelineManager;

    // Initialize MoveTrack Manager with TimelineManager
    this.moveTrackManager = new MoveTrackManager(this.timelineManager);
    this.moveTrackManager.setTilesReference(this.tiles);
    this.moveTrackManager.setBasePositions(basePositions);
    this.moveTrackManager.setBaseRotations(baseRotations);

    // Sync MoveTrack animations to InstancedMeshManager (when instanced rendering is active,
    // individual tile meshes are hidden and only the InstancedMesh is visible)
    this.moveTrackManager.tileTransformChanged = (tileIndex, position, rotation, scale, opacity) => {
      if (this.instancedMeshManager) {
        this.instancedMeshManager.updateTileTransform(tileIndex, position, rotation, scale, opacity);
      }
      const mesh = this.tiles.get(tileIndex.toString());
      if (mesh) {
        if (this.instancedMeshManager) {
          this.instancedMeshManager.setTileVisibility(tileIndex, mesh.visible);
        }
        this.updateTileChildSpriteRotations(mesh, this.camera.rotation.z);
      }
    };

    // Add lights
    const directionalLight = new DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 10, 15);
    this.scene.add(directionalLight);
    
    // Default camera setup - will be updated on resize/init
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    this.camera.position.z = 10;
    this.scene.add(this.camera);
    
    this.initRenderer();
    
    // Build spatial index for fast visibility checks
    this.buildSpatialIndex();
    
    // Apply base state to any tiles already created (appear keyframes set initial state
    // at time 0, but preview should show full tiles)
    this.applyBaseStateToAllTiles();
    
    // Hitsounds will be synthesized during loading process with progress display
  }

  private formatHexColor(hex: string): string {
    return this.tileColorManager.formatHexColor(hex);
  }
  
  /**
   * Resolve a tile's absolute direction using the same convention as
   * calculateBasicTilePositions() — simple +180 for each 999.
   * Cache is built lazily on first call.
   */
  private getResolvedTileDirection(index: number): number {
    if (!this.resolvedTileDirections) {
      const angleData = this.levelData.angleData || [];
      const count = angleData.length;
      const resolved = new Array(count);
      for (let i = 0; i < count; i++) {
        resolved[i] = angleData[i] === 999 ? (resolved[i - 1] || 0) + 180 : angleData[i];
      }
      this.resolvedTileDirections = resolved;
    }
    return this.resolvedTileDirections[index] ?? 0;
  }

  /**
   * Compute floor icon rotation angle for shader.
   * Twirl icons follow path direction with CW/CCW adjustment:
   *   CCW track: direction + π (180° CCW)
   *   CW track:  direction - π/3 (60° CW)
   * Speed/End icons: 0 (fixed to tile itself)
   */
  private getFloorIconAngle(index: number, hasTwirl: boolean): number {
    if (!hasTwirl) return 0;
    const dirRad = (this.getResolvedTileDirection(index) * Math.PI) / 180;
    const isCW = this.tileIsCW[index];
    return isCW ? dirRad - Math.PI / 3 : dirRad + Math.PI + Math.PI / 6;
  }

  /**
   * Helper for InstancedMeshManager to generate geometry
   */
  private generateGeometryFromShapeKey(shapeKey: string): BufferGeometry | null {
    const parts = shapeKey.split('_');
    if (parts.length < 4) return null;

    const pred = parseFloat(parts[0]);
    const currentDirection = parseFloat(parts[1]);
    const is999 = parts[2] === 'true';
    const trackStyle = parts[3];

    const meshData = createTrackMesh(pred, currentDirection, is999, undefined, undefined, undefined, trackStyle);
    if (!meshData || !meshData.faces) return null;

    const geometry = new BufferGeometry();
    geometry.setIndex(meshData.faces);
    geometry.setAttribute('position', new Float32BufferAttribute(meshData.vertices, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(meshData.colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }
  
  /**
   * Pre-synthesize hitsounds at level load time.
   * Groups timestamps by hitsound type to support per-tile overrides (SetHitsound)
   * and on-demand events (PlayHitsound).
   */
  private async preSynthesizeHitsounds(): Promise<void> {
    if (!this.tileStartTimes || this.tileStartTimes.length === 0) {
      console.log('[Player] No tileStartTimes, skipping hitsound synthesis');
      return;
    }

    const lastTileTime = this.tileStartTimes[this.tileStartTimes.length - 1] || 0;
    const totalDuration = lastTileTime + 10;

    // Get default hitsound type from level settings
    const rawHitsound = this.levelData.settings?.hitsound;
    const defaultType = (!rawHitsound || rawHitsound === 'None' ? 'Kick' : rawHitsound) as HitsoundType;
    const defaultVolume = this.levelData.settings?.hitsoundVolume ?? 100;

    // Build per-type timestamp groups
    // Group 0: default type for all tiles without SetHitsound override
    const defaultTimestamps: number[] = [];
    // Additional groups: one per override type
    const overrideGroups: Map<string, { type: HitsoundType; volume: number; timestamps: number[] }> = new Map();

    // Process each tile
    for (let i = 1; i < this.tileStartTimes.length; i++) {
      const t = this.tileStartTimes[i];
      const tile = this.levelData.tiles[i];
      if (tile && tile.angle !== 0) {
        const override = this.setHitsoundOverrides.get(i);
        if (override) {
          const key = `${override.type}_${override.volume}`;
          let group = overrideGroups.get(key);
          if (!group) {
            group = { type: override.type, volume: override.volume, timestamps: [] };
            overrideGroups.set(key, group);
          }
          group.timestamps.push(t);
        } else {
          defaultTimestamps.push(t);
        }
      }
    }

    // Process PlayHitsound events
    for (const [floor, events] of this.tilePlayHitsoundEvents) {
      const startTime = this.tileStartTimes[floor] || 0;
      for (const evt of events) {
        const hsType = (evt.hitsound || defaultType) as HitsoundType;
        const hsVol = evt.hitsoundVolume != null ? evt.hitsoundVolume : defaultVolume;
        const key = `${hsType}_${hsVol}`;
        // Use the floors tile start time as the hitsound trigger time
        const t = startTime;
        if (hsType === defaultType && hsVol === defaultVolume) {
          defaultTimestamps.push(t);
        } else {
          let group = overrideGroups.get(key);
          if (!group) {
            group = { type: hsType, volume: hsVol, timestamps: [] };
            overrideGroups.set(key, group);
          }
          group.timestamps.push(t);
        }
      }
    }

    // Build the groups array
    const groups: TimestampGroup[] = [];
    if (defaultTimestamps.length > 0) {
      groups.push({ type: defaultType, volume: defaultVolume, timestamps: defaultTimestamps });
    }
    for (const group of overrideGroups.values()) {
      groups.push(group);
    }

    console.log(`[Player] preSynthesizeHitsounds: ${groups.length} groups, ${defaultTimestamps.length} default hits, ${overrideGroups.size} override groups, duration=${totalDuration.toFixed(2)}s`);
    await this.hitsoundManager.preSynthesize(groups, totalDuration);
  }
  
  /**
   * Pre-synthesize hitsounds with progress callback (public method for UI)
   * @param onProgress Progress callback (0-100)
   */
  public async preSynthesizeHitsoundsWithProgress(onProgress?: (percent: number) => void): Promise<void> {
    console.log('[Player] preSynthesizeHitsoundsWithProgress called');

    if (!this.hitsoundManager.isEnabled()) {
      if (onProgress) onProgress(100);
      return;
    }

    if (!this.tileStartTimes || this.tileStartTimes.length === 0) {
      if (onProgress) onProgress(100);
      return;
    }

    const lastTileTime = this.tileStartTimes[this.tileStartTimes.length - 1] || 0;
    const totalDuration = lastTileTime + 10;

    const rawHitsound = this.levelData.settings?.hitsound;
    const defaultType = (!rawHitsound || rawHitsound === 'None' ? 'Kick' : rawHitsound) as HitsoundType;
    const defaultVolume = this.levelData.settings?.hitsoundVolume ?? 100;

    const defaultTimestamps: number[] = [];
    const overrideGroups: Map<string, { type: HitsoundType; volume: number; timestamps: number[] }> = new Map();

    for (let i = 1; i < this.tileStartTimes.length; i++) {
      const t = this.tileStartTimes[i];
      const tile = this.levelData.tiles[i];
      if (tile && tile.angle !== 0) {
        const override = this.setHitsoundOverrides.get(i);
        if (override) {
          const key = `${override.type}_${override.volume}`;
          let group = overrideGroups.get(key);
          if (!group) {
            group = { type: override.type, volume: override.volume, timestamps: [] };
            overrideGroups.set(key, group);
          }
          group.timestamps.push(t);
        } else {
          defaultTimestamps.push(t);
        }
      }
    }

    for (const [floor, events] of this.tilePlayHitsoundEvents) {
      const startTime = this.tileStartTimes[floor] || 0;
      for (const evt of events) {
        const hsType = (evt.hitsound || defaultType) as HitsoundType;
        const hsVol = evt.hitsoundVolume != null ? evt.hitsoundVolume : defaultVolume;
        const key = `${hsType}_${hsVol}`;
        if (hsType === defaultType && hsVol === defaultVolume) {
          defaultTimestamps.push(startTime);
        } else {
          let group = overrideGroups.get(key);
          if (!group) {
            group = { type: hsType, volume: hsVol, timestamps: [] };
            overrideGroups.set(key, group);
          }
          group.timestamps.push(startTime);
        }
      }
    }

    const groups: TimestampGroup[] = [];
    if (defaultTimestamps.length > 0) {
      groups.push({ type: defaultType, volume: defaultVolume, timestamps: defaultTimestamps });
    }
    for (const group of overrideGroups.values()) {
      groups.push(group);
    }

    console.log(`[Player] preSynthesizeHitsoundsWithProgress: ${groups.length} groups, ${defaultTimestamps.length} default hits, ${overrideGroups.size} override groups`);
    await this.hitsoundManager.preSynthesize(groups, totalDuration, onProgress);
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
    this.tileStickToFloors = new Array(n);
    
    // Initialize tileStickToFloors from PositionTrackManager
    if (this.positionTrackManager) {
      const allTransforms = this.positionTrackManager.calculateAllTileTransforms(this.isEditorMode);
      for (let i = 0; i < n; i++) {
        const transform = allTransforms.get(i);
        this.tileStickToFloors[i] = transform?.stickToFloors ?? (this.levelData.settings?.stickToFloors !== false);
      }
    } else {
      // Default to true if no PositionTrackManager
      for (let i = 0; i < n; i++) {
        this.tileStickToFloors[i] = this.levelData.settings?.stickToFloors !== false;
      }
    }
    
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
        this.renderer = new WebGLRenderer({ 
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
          this.renderer = new WebGLRenderer({ 
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
    
    // Initialize ShakeScreen
    this.shakeScreen = new ShakeScreen();

    // Initialize Bloom Effect (WebGL only)
    if (this.rendererType === 'webgl') {
      this.bloomEffect = new BloomEffect();
      this.flashEffect = new FlashEffect();
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

  private disableTrackTexture: boolean = false;
  private _textureAutoDisabled: boolean = false;

  public setDisableTrackTexture(disabled: boolean): void {
    if (this.disableTrackTexture === disabled) return;
    this.disableTrackTexture = disabled;
    this._textureAutoDisabled = false; // reset so zoom logic re-evaluates
    if (this.instancedMeshManager) {
      this.instancedMeshManager.setTileTextureEnabled(!disabled, true);
    }
  }

  public setHitsoundEnabled(enabled: boolean): void {
    this.hitsoundManager.setEnabled(enabled);
  }

  public setTargetFramerate(framerate: TargetFramerateType): void {
    this.targetFramerate = framerate;
    this.updateFrameInterval();
  }

  public setOGGCompression(enabled: boolean): void {
    this.hitsoundManager.setOGGCompression(enabled);
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
    
    // Create overlay HUD (2D canvas on top of WebGL)
    this.overlayHUD = new OverlayHUD(container);
    
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
      this.mouseDownPos = { x: event.clientX, y: event.clientY };
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

  private onMouseUp(event: MouseEvent): void {
    const dx = event.clientX - this.mouseDownPos.x;
    const dy = event.clientY - this.mouseDownPos.y;
    const wasClick = Math.sqrt(dx * dx + dy * dy) < 5;
    this.isDragging = false;

    if (wasClick && event.button === 0) {
      this.handleTileClick(event);
    }
  }

  private handleTileClick(event: MouseEvent): void {
    if (this.isPlaying) return;
    if (!this.container) return;
    // Ignore clicks on UI overlays (buttons, etc.) — only handle canvas area
    if (event.target !== this.container && !(event.target as HTMLElement)?.closest?.('canvas')) return;
    const rect = this.container.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new Vector2(x, y), this.camera);

    const meshes: Mesh[] = [];
    for (const [, mesh] of this.tiles) {
      if (mesh.geometry) meshes.push(mesh);
    }
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const hitMesh = hits[0].object as Mesh;
      let tileIdx: number | null = null;
      for (const [id, mesh] of this.tiles) {
        if (mesh === hitMesh) { tileIdx = parseInt(id, 10); break; }
      }
      if (tileIdx !== null && !isNaN(tileIdx)) {
        this.selectTile(tileIdx);
        return;
      }
    }
    this.deselectTile();
  }

  public selectTile(index: number, moveCamera: boolean = true): void {
    if (index < 0 || index >= this.levelData.tiles.length) return;
    console.log('[selectTile]', index, 'moveCamera:', moveCamera);
    // Restore old selection color before switching
    if (this.selectedTileIndex !== null && this.selectedTileIndex !== index) {
      this.restoreTileColor(this.selectedTileIndex);
    }
    this.selectedTileIndex = index;
    this.selectionTime = 0;
    if (moveCamera && !this.isPlaying) this.moveCameraToTile(index);
  }

  public deselectTile(): void {
    if (this.selectedTileIndex !== null) {
      this.restoreTileColor(this.selectedTileIndex);
    }
    this.selectedTileIndex = null;
    this._targetCamPos = null;
  }

  public resetCameraZoomRotation(): void {
    this.zoomMultiplier = 1.0;
    this.camera.rotation.z = 0;
    if (this.cameraController) {
      const cam = this.cameraController.getCameraMode();
      cam.rotation = 0;
      cam.zoom = 100;
    }
  }

  private restoreTileColor(index: number): void {
    if (this.tileColorManager) {
      const base = this.tileColorManager.getTileColor(index);
      if (base) {
        const colorHex = this.formatHexColor(base.color);
        const bgHex = this.formatHexColor(base.secondaryColor);
        if (this.instancedMeshManager) {
          this.instancedMeshManager.updateTileColor(index, colorHex, bgHex);
        }
        const mesh = this.tiles.get(index.toString());
        if (mesh && mesh.material) {
          (mesh.material as MeshBasicMaterial).color.setHex(parseInt(base.color, 16));
        }
      }
    }
  }

  public getTileTimeMs(index: number): number {
    if (index < 0 || index >= this.tileStartTimes.length) return 0;
    const s = this.levelData.settings;
    const bpm0 = s.bpm || 100;
    const spb0 = 60 / bpm0;
    const ct0 = s.countdownTicks || 4;
    const cd0 = ct0 * spb0;
    return (this.tileStartTimes[index] + cd0) * 1000;
  }

  public getTileIndexAtTime(timeMs: number): number {
    const s = this.levelData.settings;
    const bpm0 = s.bpm || 100;
    const spb0 = 60 / bpm0;
    const ct0 = s.countdownTicks || 4;
    const cd0 = ct0 * spb0;
    const timeInLevel = timeMs / 1000 - cd0;
    const times = this.tileStartTimes;
    let lo = 0, hi = times.length - 1;
    let idx = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (times[mid] <= timeInLevel) {
        idx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return idx;
  }

  private moveCameraToTile(index: number): void {
    const tile = this.levelData.tiles?.[index];
    if (!tile?.position) return;
    this._targetCamPos = new Vector3(tile.position[0], tile.position[1], 0);
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

  public setStatsCallback(callback: (stats: { fps: number; time: number; tileIndex: number; tileBPM: number[]; tileStartTimes: number[]; totalTiles: number }) => void): void {
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
      
      // FPS calculation (update every 500ms)
      frameCount++;
      if (time - fpsTime >= 500) {
        fps = Math.round((frameCount * 1000) / (time - fpsTime));
        frameCount = 0;
        fpsTime = time;
      }
      
      // Game state callback (every frame for real-time responsiveness)
      if (this.onStatsUpdate) {
        this.onStatsUpdate({
          fps,
          time: this.elapsedTime,
          tileIndex: this.currentTileIndex,
          tileBPM: this.tileBPM,
          tileStartTimes: this.tileStartTimes,
          totalTiles: this.levelData.tiles.length
        });
      }
      
      // Overlay HUD update (2D canvas, no DOM layout)
      if (this.overlayHUD) {
        this.overlayHUD.update({
          fps,
          time: this.elapsedTime,
          tileIndex: this.currentTileIndex,
          tileBPM: this.tileBPM,
          tileStartTimes: this.tileStartTimes,
          totalTiles: this.levelData.tiles.length
        });
        this.overlayHUD.render();
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

    // Calculate current time using AudioContext for synchronization
    const settings = this.levelData.settings;
    const initialBPM = settings.bpm || 100;
    const initialSecPerBeat = 60 / initialBPM;
    const countdownTicks = settings.countdownTicks || 4;
    const countdownDuration = countdownTicks * initialSecPerBeat;
    const offset = this.music.hasAudio ? (settings.offset || 0) : 0;
    const firstTileOffset = this.tileStartTimes.length > 0 ? this.tileStartTimes[0] * 1000 : 0;

    // Debug: Log current state occasionally
    if (this.elapsedTime >= 0 && Math.floor(this.elapsedTime) === 0) {
      console.log('[Player] updatePlayer - elapsedTime:', this.elapsedTime.toFixed(2), 'countdownDuration:', countdownDuration.toFixed(2), 'offset:', offset);
    }

    // When music is loaded and playing, use AudioContext time for perfect sync
    if (this.music.hasAudio && this.music.isPlaying) {
      try {
        const audioContext = getSharedAudioContext();
        if (audioContext && this.useAudioContextTime) {
          // Calculate elapsed time from AudioContext
          // audioContextStartOffset is the AudioContext time when game time was 0
          // elapsedTime = (currentAudioContextTime - startTime) * 1000
          const contextElapsed = (audioContext.currentTime - this.audioContextStartOffset) * 1000;
          this.elapsedTime = contextElapsed;
        } else {
          // Fallback to performance.now() if AudioContext not available
          this.elapsedTime = performance.now() - this.startTime;
        }
      } catch (e) {
        this.elapsedTime = performance.now() - this.startTime;
      }
    } else if (this.music.hasAudio && !this.music.isPlaying && !this.music.isPaused && this.elapsedTime > this.musicStartDelay * 1000) {
      // Music ended but game continues
      const now = performance.now();
      this.elapsedTime = now - this.startTime;
    } else {
      // No music or countdown phase
      if (this.isPlaying && !this.isPaused) {
        if (this.useAudioContextTime) {
          const ctx = getSharedAudioContext();
          if (ctx) {
            this.elapsedTime = (ctx.currentTime - this.audioContextStartOffset) * 1000;
          } else {
            this.elapsedTime = performance.now() - this.startTime;
          }
        } else {
          this.elapsedTime = performance.now() - this.startTime;
        }
        
        // Debug: Log elapsedTime occasionally
        if (Math.floor(this.elapsedTime) % 1000 === 0 && this.elapsedTime < 10000) {
          console.log('[Player] elapsedTime:', this.elapsedTime.toFixed(2), 'ms');
        }

        // Start music at elapsedTime = musicStartDelay (when game starts + music delay)
        if (this.music && this.music.hasAudio && !this.music.isPaused && this.elapsedTime >= this.musicStartDelay * 1000 && !this.music.isPlaying) {
          // Initialize AudioContext sync
          const music = this.music;
          try {
            const audioContext = getSharedAudioContext();
            if (audioContext) {
              // Music should start at elapsedTime = musicStartDelay
              // AudioContext.currentTime should = audioContextStartOffset + musicStartDelay
              const scheduledPlayTime = this.audioContextStartOffset + this.musicStartDelay;
              const offset = this.levelData.settings.offset || 0;
              const offsetInSeconds = offset / 1000;
              
              console.log('[Player] Scheduling music to play at AudioContext time:', scheduledPlayTime, 'with offset:', offsetInSeconds, 'musicStartDelay:', this.musicStartDelay);
              if (music.playScheduled) {
                music.playScheduled(scheduledPlayTime, offsetInSeconds);
              }
            } else {
              // Fallback to simple play if no AudioContext
              if (music.audio) {
                music.audio.currentTime = offset / 1000;
                music.play();
              }
            }
          } catch (e) {
            console.warn('[Player] Failed to schedule music:', e);
            music.play();
          }
        }
      }
    }
    
    // --- One-time audio sync ---
    // After music starts, verify the actual audio position matches expected.
    // Uses timeInLevel (elapsed game time after countdown) as the common reference,
    // which works correctly for both first-play and seek paths.
    if (this.music.hasAudio && this.music.isPlaying && this.music.audio &&
        !this.audioDriftSynced &&
        typeof this.music.audio.currentTime === 'number' && !isNaN(this.music.audio.currentTime) &&
        this.elapsedTime > 100) {
      const settings = this.levelData.settings;
      const bpm0 = settings.bpm || 100;
      const spb0 = 60 / bpm0;
      const ct0 = settings.countdownTicks || 4;
      const cd0 = ct0 * spb0;
      const offsetSec = (settings.offset || 0) / 1000;
      const timeInLevel = this.elapsedTime / 1000 - cd0;
      const expectedMusicPos = offsetSec + Math.max(0, timeInLevel);
      const actualMusicPos = this.music.audio.currentTime;
      const drift = expectedMusicPos - actualMusicPos;
      if (Math.abs(drift) > 0.01) {
        console.log('[Player] One-shot audio sync:', (drift * 1000).toFixed(1), 'ms');
        if (this.useAudioContextTime) {
          const audioCtx = getSharedAudioContext();
          if (audioCtx) {
            this.audioContextStartOffset -= drift;
            this.elapsedTime = (audioCtx.currentTime - this.audioContextStartOffset) * 1000;
          }
        } else {
          this.startTime += drift * 1000;
          this.elapsedTime = performance.now() - this.startTime;
        }
      }
      this.audioDriftSynced = true;
      this.useAudioContextTime = true;
    }

    // Unified trigger event dispatch from TimelineManager
    const s = this.levelData.settings;
    const bpm0 = s.bpm || 100;
    const spb0 = 60 / bpm0;
    const ct0 = s.countdownTicks || 4;
    const cd0 = ct0 * spb0;
    const t0 = this.elapsedTime / 1000 - cd0;

    // Handle rewind side effects
    if (this.timelineManager.isRewound(t0)) {
      this.bloomEnabled = false;
      this.tileColorManager?.initTileColors();
      this.tiles?.forEach((_, id) => this.updateTileMeshColor(parseInt(id)));
    }

    const triggeredEvents = this.timelineManager.getTriggered(t0);
    for (const ev of triggeredEvents) {
      switch (ev.eventType) {
        case 'Bloom': this.processBloomEvent(ev); break;
        case 'Flash': this.processFlashEvent(ev); break;
        case 'ShakeScreen': this.processShakeScreenEvent(ev); break;
        case 'SetCustomBG': this.processCustomBGEvent(ev); break;
        case 'RecolorTrack': this.processRecolorEvent(ev); break;
      }
    }

    this.updatePlanetsPosition();

    this.updateCameraFollow(delta);

    this.updateAnimatedTiles();

    // Update decorations
    this.updateDecorations();

    // Update MoveTrack animations
    this.updateMoveTrack();

    // Sync instanced meshes for visible tiles
    this.syncInstancedTiles();
  }

  private syncInstancedTiles(): void {
    if (!this.instancedMeshManager) return;
    if (this.dirtyTiles.size === 0) return;

    this.dirtyTiles.forEach(index => {
        const id = index.toString();
        const mesh = this.tiles.get(id);
        if (!mesh) return;
        const moveTrackOpacity = mesh.userData.opacity !== undefined ? mesh.userData.opacity : 1.0;
        const colorOpacity = mesh.userData.trackColorOpacity ?? 1;
        const effectiveOpacity = moveTrackOpacity * colorOpacity;
        this.instancedMeshManager!.updateTileTransform(
            index,
            mesh.position,
            mesh.rotation as Euler,
            mesh.scale,
            effectiveOpacity
        );
        this.instancedMeshManager!.setTileVisibility(index, effectiveOpacity > 0.001);
        // Always sync floor icon type and direction angle
        this.instancedMeshManager!.setFloorIconType(index, mesh.userData.floorIconType ?? 0);
        this.instancedMeshManager!.setFloorIconAngle(index, mesh.userData.floorIconAngle ?? 0);
    });
    this.dirtyTiles.clear();
  }
  
  private updateDecorations(): void {
    if (!this.decorationManager) return;

    const settings = this.levelData.settings;
    const initialBPM = settings.bpm || 100;
    const initialSecPerBeat = 60 / initialBPM;
    const countdownTicks = settings.countdownTicks || 4;
    const countdownDuration = countdownTicks * initialSecPerBeat;
    const timeInLevelMs = this.elapsedTime - countdownDuration * 1000;

    this.decorationManager.update(
      Math.max(0, timeInLevelMs),
      this.camera.position,
      this.camera.rotation.z,
      this.camera.zoom,
      this.timelineManager,
      this.adoZoom
    );
  }

  private updateMoveTrack(): void {
    if (!this.moveTrackManager) return;

    // Calculate timeInLevel matching CameraController's logic
    const countdownTicks = this.levelData.settings.countdownTicks || 0;
    const initialBPM = this.levelData.settings.bpm || 100;
    const initialSecPerBeat = 60 / initialBPM;
    const countdownDuration = countdownTicks * initialSecPerBeat;

    const currentTimeInSeconds = this.elapsedTime / 1000;
    const timeInLevel = currentTimeInSeconds - countdownDuration;

    // Pass timeInLevel in milliseconds
    this.moveTrackManager.update(timeInLevel * 1000);

    // Mark tiles animated by MoveTrack as dirty for instanced mesh sync
    for (const idx of this.moveTrackManager.getAnimatedTileIndices()) {
      this.dirtyTiles.add(idx);
    }

    // Record tile positions into trail cache (circular buffer)
    this.recordTrailCache(timeInLevel);
  }

  private initTrailCache(): void {
    const n = this.levelData.tiles.length;
    this.trailPositionCache = [];
    this.trailTimeCache = [];
    for (let i = 0; i < Player.TRAIL_CACHE_SIZE; i++) {
      this.trailPositionCache.push(new Float64Array(n * 2));
      this.trailTimeCache.push(-999);
    }
    this.trailCacheWriteIdx = 0;
    this.trailCacheReady = false;
  }

  private recordTrailCache(timeInLevel: number): void {
    if (this.trailPositionCache.length === 0) this.initTrailCache();

    const entry = this.trailPositionCache[this.trailCacheWriteIdx];
    const tiles = this.levelData.tiles;
    const n = tiles.length;

    for (let i = 0; i < n; i++) {
      if (this.tileStickToFloors[i] !== false) {
        const mesh = this.tiles.get(i.toString());
        if (mesh) {
          entry[i * 2] = mesh.position.x;
          entry[i * 2 + 1] = mesh.position.y;
        } else {
          entry[i * 2] = tiles[i].position[0];
          entry[i * 2 + 1] = tiles[i].position[1];
        }
      } else {
        entry[i * 2] = tiles[i].position[0];
        entry[i * 2 + 1] = tiles[i].position[1];
      }
    }

    this.trailTimeCache[this.trailCacheWriteIdx] = timeInLevel;
    this.trailCacheWriteIdx = (this.trailCacheWriteIdx + 1) % Player.TRAIL_CACHE_SIZE;
    if (!this.trailCacheReady && this.trailCacheWriteIdx === 0) {
      this.trailCacheReady = true;
    }
  }

  /**
   * Look up a tile's cached position at the given timeInLevel using linear interpolation.
   * Returns null if time is outside cached range.
   */
  private getCachedTilePos(tileIndex: number, queryTime: number): { x: number; y: number } | null {
    if (!this.trailCacheReady || this.trailTimeCache.length === 0) return null;

    // Find the two nearest cached frames (one before, one after queryTime)
    let prevIdx = -1;
    let nextIdx = -1;
    let prevTime = -Infinity;
    let nextTime = Infinity;

    for (let i = 0; i < Player.TRAIL_CACHE_SIZE; i++) {
      const t = this.trailTimeCache[i];
      if (t < -900) continue; // unwritten slot
      if (t <= queryTime && t > prevTime) {
        prevTime = t;
        prevIdx = i;
      }
      if (t >= queryTime && t < nextTime) {
        nextTime = t;
        nextIdx = i;
      }
    }

    // If no valid entries found
    if (prevIdx < 0 && nextIdx < 0) return null;

    // If only one side is available (query near buffer edges), use nearest within 20ms
    if (prevIdx < 0) {
      if (nextTime - queryTime > 0.02) return null;
      const entry = this.trailPositionCache[nextIdx];
      return { x: entry[tileIndex * 2], y: entry[tileIndex * 2 + 1] };
    }
    if (nextIdx < 0) {
      if (queryTime - prevTime > 0.02) return null;
      const entry = this.trailPositionCache[prevIdx];
      return { x: entry[tileIndex * 2], y: entry[tileIndex * 2 + 1] };
    }

    // Both sides available: linearly interpolate
    const range = nextTime - prevTime;
    if (range < 0.000001) {
      // Same time, just use either
      const entry = this.trailPositionCache[prevIdx];
      return { x: entry[tileIndex * 2], y: entry[tileIndex * 2 + 1] };
    }

    const t = (queryTime - prevTime) / range;
    // Clamp query to [prevTime, nextTime] — both within 20ms, so this is bounded
    const frac = Math.max(0, Math.min(1, t));

    const prevEntry = this.trailPositionCache[prevIdx];
    const nextEntry = this.trailPositionCache[nextIdx];
    return {
      x: prevEntry[tileIndex * 2] + (nextEntry[tileIndex * 2] - prevEntry[tileIndex * 2]) * frac,
      y: prevEntry[tileIndex * 2 + 1] + (nextEntry[tileIndex * 2 + 1] - prevEntry[tileIndex * 2 + 1]) * frac,
    };
  }

  private updateAnimatedTiles(): void {
    const time = this.elapsedTime / 1000;
    const cameraRotation = this.camera.rotation.z;

    this.visibleTiles.forEach(id => {
        const index = parseInt(id);
        const mesh = this.tiles.get(id);
        
        // Update sprite rotations to follow camera
        if (mesh) {
            this.updateTileChildSpriteRotations(mesh, cameraRotation);
        }

        const config = this.tileColorManager.getTileRecolorConfig(index);

        if (config && ['Glow', 'Blink', 'Rainbow', 'Volume'].includes(config.trackColorType)) {
            const rendered = this.tileColorManager.getTileRenderer(index, time, config, this.music.amplitude);
            // Skip if color hasn't changed (avoids unnecessary GPU uploads, especially for slow animations)
            const current = this.tileColorManager.getTileColor(index);
            if (current && current.color === rendered.color && current.secondaryColor === rendered.bgcolor) return;
            this.applyTileColor(index, rendered.color, rendered.bgcolor, rendered.opacity);
        }
    });
  }

  public renderPlayer(delta: number): void {
    // Sync camera/visibleTiles/instanced from CameraController (non-play + paused)
    if ((!this.isPlaying || this.isPaused) && this.cameraController) {
      const interp = this.cameraController.getInterpolatedValues(this.elapsedTime);
      this.adoZoom = interp.zoom;
      this.zoom = 100 / interp.zoom;
      this.camera.zoom = this.zoom * this.zoomMultiplier;
      this.camera.updateProjectionMatrix();
      this.camera.rotation.z = interp.rotation * (Math.PI / 180);
      this.updateVisibleTiles();
      this.syncInstancedTiles();
    }
    // Selection green flash animation (disabled during playback)
    if (this.selectedTileIndex !== null && !this.isPlaying) {
      this.selectionTime += delta;
      const intensity = (Math.sin(this.selectionTime * Math.PI * 2) + 1) / 2;
      const idx = this.selectedTileIndex;
      if (this.tileColorManager) {
        const base = this.tileColorManager.getTileColor(idx);
        if (base) {
          const c = new Color(this.formatHexColor(base.color));
          c.lerp(new Color(0, 1, 0), intensity * 0.5);
          const hex = c.getHexString();
          if (this.instancedMeshManager) {
            this.instancedMeshManager.updateTileColor(idx, '#' + hex, this.formatHexColor(base.secondaryColor));
          }
          const mesh = this.tiles.get(idx.toString());
          if (mesh && mesh.material) {
            (mesh.material as MeshBasicMaterial).color.setHex(parseInt(hex, 16));
          }
        }
      }
    }
    // Smooth camera follow for selected tile (disabled during playback)
    if (this._targetCamPos && !this.isPlaying) {
      this.cameraPosition.lerp(this._targetCamPos, Math.min(1, delta * 8));
      this.camera.position.x = this.cameraPosition.x;
      this.camera.position.y = this.cameraPosition.y;
      this.updateVisibleTiles();
      if (this.cameraPosition.distanceTo(this._targetCamPos) < 0.001) {
        this.cameraPosition.copy(this._targetCamPos);
        this._targetCamPos = null;
      }
    }
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
      // Apply shake offset to camera for rendering
      let unshakenX = this.camera.position.x;
      let unshakenY = this.camera.position.y;
      if (this.shakeScreen) {
        const shake = this.shakeScreen.update(this.elapsedTime / 1000);
        this.camera.position.x += shake.x;
        this.camera.position.y += shake.y;
      }
      
      try {
        const isWebGPU = this.rendererType === 'webgpu';
        const backendReady = !isWebGPU || (this.renderer as any).backend !== null;
        
        if (!backendReady) {
          this.camera.position.x = unshakenX;
          this.camera.position.y = unshakenY;
          return;
        }
        
        const gl = (this.renderer as any).getContext?.();
        if (gl && gl.isContextLost?.()) {
          this.camera.position.x = unshakenX;
          this.camera.position.y = unshakenY;
          return;
        }
        
        if (this.bloomEnabled && !isWebGPU && this.bloomEffect && this.bloomEffect.getEnabled()) {
          if (!this.renderTarget) {
            this.renderTarget = new WebGLRenderTarget(
              this.container?.clientWidth || window.innerWidth,
              this.container?.clientHeight || window.innerHeight
            );
          }
          
          this.renderer.setRenderTarget(this.renderTarget);
          this.renderer.render(this.scene, this.camera);
          this.renderer.setRenderTarget(null);
          
          this.bloomEffect.render(this.renderer as WebGLRenderer, this.renderTarget.texture);
        } else {
          if (this.renderMethod === 'async' || isWebGPU) {
            (this.renderer as any).renderAsync(this.scene, this.camera).catch((e: Error) => {
              console.warn('Render error:', e.message);
            });
          } else {
            this.renderer.render(this.scene, this.camera);
          }
        }
        
        // Render Flash effect (overlay on top of scene)
        if (this.flashEffect && this.flashEffect.isActive()) {
          this.flashEffect.renderFlash(this.renderer as WebGLRenderer, this.elapsedTime / 1000);
        }
      } catch (e) {
        console.warn('Render error:', e);
      } finally {
        // Restore unshaken camera position
        this.camera.position.x = unshakenX;
        this.camera.position.y = unshakenY;
      }
    }
  }

  // AudioContext synchronization
  private audioContextStartOffset: number = 0;  // AudioContext.currentTime when game elapsedTime = 0
  private useAudioContextTime: boolean = false;

  public startPlay(startAtMs: number = 0): void {
    console.log('[Player] startPlay called with startAtMs:', startAtMs);
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.isPaused = false;
    this.startTime = performance.now(); // elapsedTime = 0 when startPlay is called
    this.elapsedTime = 0;
    this.currentTileIndex = 0;
    this.deselectTile();
    this.useAudioContextTime = false;
    this.audioDriftSynced = false;
    
    this.createPlanets();
    
    // Reset unified timelines
    this.timelineManager.reset();
    
    // Reset MoveTrack animations
    if (this.moveTrackManager) {
        this.moveTrackManager.reset();
    }
    
    // Reset camera state
    this.cameraController.setLastCameraTimelineIndex(-1);
    this.cameraController.resetCameraState();
    
    // Reset decorations
    if (this.decorationManager) {
      this.decorationManager.reset();
    }

    // Seek to start time after all resets
    if (startAtMs > 0) {
      const s = this.levelData.settings;
      const bpm0 = s.bpm || 100;
      const spb0 = 60 / bpm0;
      const ct0 = s.countdownTicks || 4;
      const cd0 = ct0 * spb0;
      const timeInLevel = startAtMs / 1000 - cd0;
      this.elapsedTime = startAtMs;
      this.startTime = performance.now() - startAtMs;
      if (this.cameraController) {
        this.cameraController.seek(timeInLevel, this.currentPivotPosition);
      }
      if (this.moveTrackManager) {
        this.moveTrackManager.fastForwardTo(timeInLevel);
      }
      // Seek music/hitsound to the target time
      if (this.music && this.music.hasAudio) {
        const offset = (s.offset || 0) / 1000;
        this.music.seek(Math.max(0, timeInLevel + offset));
        // Start music immediately so updatePlayer doesn't call playScheduled
        if (!this.music.isPlaying) {
          this.music.play();
        }
      }
      if (this.hitsoundManager && this.hitsoundManager.isSynthesized()) {
        if (timeInLevel >= 0) {
          this.hitsoundManager.startAtOffset(timeInLevel);
        } else {
          this.hitsoundManager.start(-timeInLevel);
        }
      }
      if (this.videoElement) {
        this.videoElement.currentTime = Math.max(0, startAtMs / 1000 - this.musicStartDelay);
      }
        // Use performance.now() timekeeping (AudioContext not yet synced)
        this.useAudioContextTime = false;
    }

    // Calculate delay for countdown
    const settings = this.levelData.settings;
    const initialBPM = settings.bpm || 100;
    const initialSecPerBeat = 60 / initialBPM;
    const countdownTicks = settings.countdownTicks || 4;
    const countdownDuration = countdownTicks * initialSecPerBeat;
    const offset = this.music.hasAudio ? (settings.offset || 0) : 0;
    // tileStartTimes[1] = 0 (after shift)
    // tileStartTimes[0] is negative (before tile 1)
    // offset means: when game starts (elapsedTime = countdownDuration), music should play to offset position
    // So when elapsedTime = countdownDuration, music.currentTime = offset
    
    // Music and hitsounds start after countdown
    // Music plays from offset position, hitsounds start at tileStartTimes[i] (relative to tile 1)
    // Note: elapsedTime = 0 when startPlay is called (countdown starts), elapsedTime = countdownDuration when game starts
    
    // Calculate music delay based on tile[0].angle
    // Music needs to play (angle - 180) degrees early, which is (angle - 180) / 180 beats early
    // If musicDelaySeconds is positive, music plays early; if negative, music plays late
    const firstTileAngle = this.levelData.tiles[0]?.angle || 180;
    const musicDelayBeats = (firstTileAngle - 180) / 180;
    const musicDelaySeconds = musicDelayBeats * initialSecPerBeat;
    
    console.log('[Player] startPlay - firstTileAngle:', firstTileAngle, 'musicDelayBeats:', musicDelayBeats, 'musicDelaySeconds:', musicDelaySeconds);
    
    // musicStartDelay can be negative (play early) or positive (play late)
    const musicStartDelay = countdownDuration - musicDelaySeconds; // Music starts after countdown minus music delay
    const hitsoundStartDelay = countdownDuration; // Hitsounds start after countdown (no delay)

    // Store delays for use in updatePlayer
    this.musicStartDelay = musicStartDelay;
    this.hitsoundStartDelay = hitsoundStartDelay;

    // Debug: Print tileStartTimes
    console.log('[Player] startPlay - offset:', offset, 'countdownDuration:', countdownDuration);
    console.log('[Player] startPlay - tileStartTimes (first 10):', this.tileStartTimes.slice(0, 10));

    // Initialize AudioContext for synchronization
    try {
      const audioContext = getSharedAudioContext();
      if (audioContext) {
        // audioContextStartOffset is the AudioContext time when game time = 0
        this.audioContextStartOffset = audioContext.currentTime - this.elapsedTime / 1000;
        // AudioContext.currentTime advances even in background tabs and without audio.
        // Use it as the game clock when no music is available.
        if (!this.music.hasAudio) {
          this.useAudioContextTime = true;
        }
      }
    } catch (e) {
      console.warn('[Player] Failed to initialize AudioContext:', e);
    }

    // Start pre-synthesized hitsound track
    const synthesized = this.hitsoundManager.isSynthesized();
    console.log('[Player] startPlay - hitsound synthesized:', synthesized, 'hitsoundStartDelay:', hitsoundStartDelay);
    if (synthesized && startAtMs <= 0) {
        this.hitsoundManager.start(hitsoundStartDelay);
    }
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
  
  private processCustomBGEvent(event: any): void {
      // SetCustomBG event properties:
      // - color: background color (hex string)
      // - image: image filename
      // - imageColor: tint color for image
      // - parallax: [x, y] parallax factor
      // - tiled: boolean
      // - looping: boolean
      // - fitScreen: boolean
      // - lockRot: boolean
      // - scalingRatio: number
      // - imageSmoothing: boolean
      
      // Update background color
      if (event.color !== undefined) {
          const bgColor = this.formatHexColor(event.color);
          this.scene.background = new Color(bgColor);
      }
      
      // Update custom background image
      const imagePath = event.image;
      
      if (!imagePath || imagePath === '') {
          // Remove custom background
          if (this.customBGMesh) {
              this.scene.remove(this.customBGMesh);
              if (this.customBGMesh.geometry) this.customBGMesh.geometry.dispose();
              if (this.customBGMesh.material instanceof Material) {
                  this.customBGMesh.material.dispose();
              }
              this.customBGMesh = null;
          }
          if (this.customBGTexture) {
              this.customBGTexture.dispose();
              this.customBGTexture = null;
          }
          return;
      }
      
      // Check if we have the image registered
      const imageUrl = this.customBGImages.get(imagePath);
      if (!imageUrl) {
          console.warn('[Player] CustomBG image not registered:', imagePath);
          return;
      }
      
      // Dispose old texture and mesh
      if (this.customBGTexture) {
          this.customBGTexture.dispose();
      }
      if (this.customBGMesh) {
          this.scene.remove(this.customBGMesh);
          if (this.customBGMesh.geometry) this.customBGMesh.geometry.dispose();
          if (this.customBGMesh.material instanceof Material) {
              this.customBGMesh.material.dispose();
          }
      }
      
      // Load new texture
      const loader = new TextureLoader();
      loader.load(imageUrl, (texture) => {
          texture.colorSpace = SRGBColorSpace;
          
          // Apply smoothing setting
          texture.minFilter = event.imageSmoothing === false ? NearestFilter : LinearFilter;
          texture.magFilter = event.imageSmoothing === false ? NearestFilter : LinearFilter;
          
          this.customBGTexture = texture;
          
          // Calculate mesh size based on fitScreen and scalingRatio
          const fitScreen = event.fitScreen !== false;
          const scalingRatio = event.scalingRatio || 100;
          const scale = scalingRatio / 100;
          
          // Get camera view size for fitScreen
          const viewHeight = this.camera.top - this.camera.bottom;
          const viewWidth = this.camera.right - this.camera.left;
          
          let meshWidth: number, meshHeight: number;
          
          if (fitScreen) {
              meshWidth = viewWidth * 2;
              meshHeight = viewHeight * 2;
          } else {
              // Use texture size with scaling
              const img = texture.image;
              meshWidth = (img?.width || 100) * scale / 100;
              meshHeight = (img?.height || 100) * scale / 100;
          }
          
          // Create mesh
          const geometry = new PlaneGeometry(meshWidth, meshHeight);
          
          // Apply image color tint
          const imageColor = event.imageColor ? this.formatHexColor(event.imageColor) : '#ffffff';
          const color = new Color(imageColor);
          
          const material = new MeshBasicMaterial({
              map: texture,
              color: color,
              transparent: true,
              depthWrite: false,
              depthTest: false
          });
          
          this.customBGMesh = new Mesh(geometry, material);
          this.customBGMesh.renderOrder = -1000; // Render before everything
          this.scene.add(this.customBGMesh);
          
          // Store parallax for update
          (this.customBGMesh as any).parallaxData = {
              parallax: event.parallax || [100, 100],
              lockRot: event.lockRot || false
          };
      });
  }
  
  private updateCustomBGParallax(): void {
      if (!this.customBGMesh) return;
      
      const data = (this.customBGMesh as any).parallaxData;
      if (!data) return;
      
      const parallax = data.parallax || [100, 100];
      const px = parallax[0] / 100;
      const py = parallax[1] / 100;
      
      // Apply inverse parallax (move opposite to camera)
      this.customBGMesh.position.x = -this.camera.position.x * (1 - px);
      this.customBGMesh.position.y = -this.camera.position.y * (1 - py);
      
      // Apply rotation lock
      if (data.lockRot) {
          this.customBGMesh.rotation.z = -this.camera.rotation.z;
      }
  }

  public stopPlay(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.deselectTile();
    this.elapsedTime = 0;
    this.audioDriftSynced = false;
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
    if (this.bloomEffect) {
      this.bloomEffect.setEnabled(false);
      this.bloomEffect.setThreshold(0.5);
      this.bloomEffect.setIntensity(1);
      this.bloomEffect.setColor('ffffff');
    }
    
    // Reset Flash effect
    if (this.flashEffect) {
      this.flashEffect.stop();
      this.flashEffect.reset();
    }
    
    // Reset ShakeScreen
    if (this.shakeScreen) {
      this.shakeScreen.stop();
    }
    
        // Reset decorations
        if (this.decorationManager) {
          this.decorationManager.reset();
        }
    
        // Reset MoveTrack (restore tiles to initial positions)
        if (this.moveTrackManager) {
          this.moveTrackManager.reset();
          this.moveTrackManager.fastForwardTo(0);
          for (const idx of this.timelineManager.getAllTileIndices()) {
            this.dirtyTiles.add(idx);
          }
          this.syncInstancedTiles();
        }
    
        // Override appear animation initial state at time 0: show base state for preview
        this.applyBaseStateToAllTiles();
    
        // Re-apply PositionTrack transforms (PositionTrack is global and applies at all times)
        this.reapplyPositionTrackTransforms();

        this.tileColorManager.initTileColors();
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
    const timeInLevel = currentTimeInSeconds - countdownDuration;
    
    // Resume pre-synthesized hitsound track from current position
    if (this.hitsoundManager.isSynthesized() && timeInLevel > 0) {
        this.hitsoundManager.startAtOffset(timeInLevel);
    }
  }

  public resetPlayer(): void {
    this.stopPlay();
    this.startPlay();
  }

  get currentTimeMs(): number { return this.elapsedTime; }

  get totalDurationMs(): number {
    const lastTileTime = this.tileStartTimes[this.tileStartTimes.length - 1] || 0;
    return (lastTileTime + 10) * 1000;
  }

  get tileCount(): number { return this.levelData.tiles.length; }
  get isPlayerPlaying(): boolean { return this.isPlaying; }

  public seekTo(timeMs: number, visualOnly?: boolean): void {
    console.log('[seekTo]', { timeMs, visualOnly, isPlaying: this.isPlaying, isPaused: this.isPaused });
    const s = this.levelData.settings;
    const bpm0 = s.bpm || 100;
    const spb0 = 60 / bpm0;
    const ct0 = s.countdownTicks || 4;
    const cd0 = ct0 * spb0;
    const timeInLevel = timeMs / 1000 - cd0;

    this.elapsedTime = timeMs;
    this.startTime = performance.now() - timeMs;
    // Allow drift correction to re-sync after seek
    this.audioDriftSynced = false;
    // When paused, sync pauseTime so resumePlay doesn't double-add pause duration
    if (this.isPaused) this.pauseTime = performance.now();

    const ctx = getSharedAudioContext();
    if (ctx) {
      this.audioContextStartOffset = ctx.currentTime - timeMs / 1000;
      this.useAudioContextTime = false;
    }

    if (!visualOnly) {
      // Music seek allowed during pause (sets currentTime without playing)
      if (this.music && this.music.hasAudio) {
        const offset = (s.offset || 0) / 1000;
        this.music.seek(Math.max(0, timeMs / 1000 - this.musicStartDelay + offset));
      }
      // Hitsounds and video only during active playback
      if (this.isPlaying && !this.isPaused) {
        if (this.hitsoundManager && this.hitsoundManager.isSynthesized() && timeInLevel > 0) {
          this.hitsoundManager.startAtOffset(timeInLevel);
        }

        if (this.videoElement) {
          this.videoElement.currentTime = Math.max(0, timeMs / 1000 - this.musicStartDelay);
        }
      }
    }

    // Stop real-time effects during seek
    if (this.shakeScreen) {
      this.shakeScreen.stop();
    }
    if (this.flashEffect) {
      this.flashEffect.stop();
    }

    // In preview mode at time 0, show base state (not appear animation initial state)
    if (!this.isPlaying && timeMs < 10) {
      this.applyBaseStateToAllTiles();
    }

    if (this.cameraController) {
      // During paused seek, update pivot (planet position) before camera seek
      if (this.isPaused) {
        const seekIdx = this.getTileIndexAtTime(this.elapsedTime);
        const seekTile = this.levelData.tiles?.[seekIdx];
        console.log('[seekTo] pause planet', { seekIdx, pos: seekTile?.position, elapsed: this.elapsedTime });
        if (seekTile?.position) {
          this.currentTileIndex = seekIdx;
          this.currentPivotPosition.x = seekTile.position[0];
          this.currentPivotPosition.y = seekTile.position[1];
          if (this.planetRed) {
            this.planetRed.position.set(seekTile.position[0], seekTile.position[1], 1.0);
            console.log('[seekTo] planetRed moved to', seekTile.position);
          }
          if (this.planetBlue) {
            this.planetBlue.position.set(seekTile.position[0], seekTile.position[1], 1.0);
          }
          // Reset trail cache to prevent stale trail positions
          this.trailCacheWriteIdx = 0;
          this.trailCacheReady = false;
          this.recordTrailCache(timeInLevel);
        }
      }
      this.cameraController.seek(timeInLevel, this.currentPivotPosition);
      // Update absolute camera position for display (always, to avoid 1-frame lag)
      const interp = this.cameraController.getInterpolatedValues(this.elapsedTime);
      const pivot = this.isPaused
        ? this.currentPivotPosition
        : (() => {
            const seekIdx = this.getTileIndexAtTime(this.elapsedTime);
            const seekTile = this.levelData.tiles?.[seekIdx];
            return seekTile?.position
              ? { x: seekTile.position[0], y: seekTile.position[1] }
              : this.currentPivotPosition;
          })();
      const target = this.cameraController.calculateTargetPosition(pivot, interp);
      this.cameraPosition.x = target.x;
      this.cameraPosition.y = target.y;
      this.camera.position.x = target.x;
      this.camera.position.y = target.y;
    }

    if (this.moveTrackManager) {
      this.moveTrackManager.fastForwardTo(timeInLevel);
    }
  }

  public setEditorMode(isEditorMode: boolean): void {
    this.isEditorMode = isEditorMode;
    // Re-calculate all tile positions with new editor mode
    if (this.positionTrackManager) {
      const allTransforms = this.positionTrackManager.calculateAllTileTransforms(this.isEditorMode);
      this.tiles.forEach((mesh, id) => {
        const index = parseInt(id);
        const transform = allTransforms.get(index);
        if (transform) {
          mesh.position.copy(transform.position);
          mesh.rotation.z = transform.rotation * (Math.PI / 180);
          mesh.scale.copy(transform.scale);
          
          if ((mesh.material as any).opacity !== undefined) {
            const opacity = transform.opacity < 1 ? transform.opacity : 1;
            mesh.userData.opacity = opacity;
            const trackColorOpacity = mesh.userData.trackColorOpacity ?? 1;
            const effectiveOpacity = opacity * trackColorOpacity;
            (mesh.material as any).opacity = effectiveOpacity;
            (mesh.material as any).transparent = effectiveOpacity < 0.999;
          }
        }
      });
      
      // Update tile sprite rotations
      this.tiles.forEach((mesh) => {
        this.updateTileChildSpriteRotations(mesh, this.camera.rotation.z);
      });

      // Update tileStickToFloors array
      for (let i = 0; i < this.levelData.tiles.length; i++) {
        const transform = allTransforms.get(i);
        this.tileStickToFloors[i] = transform?.stickToFloors ?? (this.levelData.settings?.stickToFloors !== false);
      }

      // Sync instanced meshes after re-applying PositionTrack in editor mode
      this.syncInstancedTiles();
    }
  }

  /**
   * Re-apply PositionTrack transforms to all tiles
   * PositionTrack is global and applies at all times (not just during playback)
   */
  private applyBaseStateToAllTiles(): void {
    for (const [tileId, mesh] of this.tiles) {
      const idx = parseInt(tileId, 10);
      const tile = this.levelData.tiles[idx];
      if (!tile) continue;
      const pos = tile.position;
      mesh.position.x = pos[0];
      mesh.position.y = pos[1];
      mesh.rotation.z = 0;
      mesh.scale.set(1, 1, 1);
      mesh.userData.opacity = 1;
      mesh.visible = true;
      if (mesh.material) {
        (mesh.material as any).opacity = 1;
        (mesh.material as any).transparent = false;
      }
      if (this.instancedMeshManager) {
        this.instancedMeshManager.updateTileTransform(idx, mesh.position, mesh.rotation as Euler, mesh.scale, 1);
      }
    }
  }

  private reapplyPositionTrackTransforms(): void {
    if (!this.positionTrackManager) return;
    
    // Calculate all transforms at once for efficiency and correctness
    const allTransforms = this.positionTrackManager.calculateAllTileTransforms(this.isEditorMode);
    
    this.tiles.forEach((mesh, id) => {
      const index = parseInt(id);
      const transform = allTransforms.get(index);
      
      if (transform) {
        mesh.position.copy(transform.position);
        mesh.rotation.z = transform.rotation * (Math.PI / 180);
        mesh.scale.copy(transform.scale);
        
        const opacity = transform.opacity < 1 ? transform.opacity : 1;
        mesh.userData.opacity = opacity;
        // Composite with track color alpha
        const trackColorOpacity = mesh.userData.trackColorOpacity ?? 1;
        const effectiveOpacity = opacity * trackColorOpacity;
        mesh.visible = effectiveOpacity > 0.001;

        (mesh.material as any).opacity = effectiveOpacity;
        (mesh.material as any).transparent = effectiveOpacity < 0.999;

        // Update children (decorations/icons) opacity
        mesh.traverse((child) => {
          if (child !== mesh && (child as any).material) {
            const childMat = (child as any).material;
            childMat.opacity = effectiveOpacity;
          }
        });
      }
    });

    // Update tile sprite rotations to follow tile transforms
    this.tiles.forEach((mesh) => {
      this.updateTileChildSpriteRotations(mesh, this.camera.rotation.z);
    });

    // Update tileStickToFloors array
    for (let i = 0; i < this.levelData.tiles.length; i++) {
      const transform = allTransforms.get(i);
      this.tileStickToFloors[i] = transform?.stickToFloors ?? (this.levelData.settings?.stickToFloors !== false);
    }

    // Sync instanced meshes after re-applying PositionTrack
    this.syncInstancedTiles();
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

    // Store RAW colors — let getTileRenderer handle all trackStyle-specific processing.
    // Do NOT pre-process with parseColorTrackType: it would corrupt secondaryTrackColor
    // for non-Single color types (Stripes/Blink/Switch/Glow).
    const config: TileColorConfig = {
        trackStyle: event.trackStyle || defaultStyle,
        trackColorType: event.trackColorType || defaultColorType,
        trackColor: event.trackColor || defaultColor,
        secondaryTrackColor: event.secondaryTrackColor || defaultSecondaryColor,
        trackColorPulse: event.trackColorPulse || settings.trackColorPulse || 'None',
        trackColorAnimDuration: event.trackColorAnimDuration || settings.trackColorAnimDuration || 2,
        trackPulseLength: event.trackPulseLength || settings.trackPulseLength || 10,
        trackOpacity: parseHexAlpha(event.trackColor || defaultColor),
        startFloor: event.floor,
        recolorTriggerTime: event.recolorTriggerTime
    };

    const minIdx = Math.max(0, Math.min(startIdx, endIdx));
    const maxIdx = Math.min(this.tileColorManager.getTotalTiles() - 1, Math.max(startIdx, endIdx));
    
    for (let i = minIdx; i <= maxIdx; i += (gap + 1)) {
        this.tileColorManager.setTileRecolorConfig(i, config);
        const rendered = this.tileColorManager.getTileRenderer(i, this.elapsedTime / 1000, config, this.music.amplitude);
        this.applyTileColor(i, rendered.color, rendered.bgcolor, rendered.opacity);

        // Update instanced mesh with new trackStyle (shapeKey + texSeed)
        if (this.instancedMeshManager) {
            const newTrackStyle = config.trackStyle;
            const texSeed = newTrackStyle === 'Standard' && !this.disableTrackTexture ? Math.random() * 10 + 1 : 0;
            const tileMesh = this.tiles.get(i.toString());
            if (tileMesh) {
                const resolved = this.getResolvedTileDirection(i);
                const prevResolved = i > 0 ? this.getResolvedTileDirection(i - 1) : 0;
                const pred = i > 0 ? (prevResolved || 0) - 180 : -180;
                const currentDirection = resolved || 0;
                const is999 = this.levelData.tiles[i]?.angle === 0;
                const newShapeKey = `${pred}_${currentDirection}_${is999}_${newTrackStyle}`;

                this.instancedMeshManager.updateTile(
                    i, newShapeKey,
                    tileMesh.position, tileMesh.rotation as Euler, tileMesh.scale,
                    rendered.color, rendered.bgcolor, rendered.opacity, true, texSeed,
                    tileMesh.userData.floorIconType ?? 0,
                    tileMesh.userData.floorIconAngle ?? 0
                );
            }
        }
    }
  }

  private applyTileColor(index: number, color: string, bgcolor: string, colorOpacity: number = 1): void {
    this.tileColorManager.setTileColor(index, color, bgcolor);
    const id = index.toString();
    const mesh = this.tiles.get(id);
    if (mesh) {
      mesh.userData.trackColorOpacity = colorOpacity;
      const moveTrackOpacity = mesh.userData.opacity !== undefined ? mesh.userData.opacity : 1;
      const effectiveOpacity = moveTrackOpacity * colorOpacity;
      (mesh.material as any).opacity = effectiveOpacity;
      (mesh.material as any).transparent = effectiveOpacity < 0.999;
    }
    this.updateTileMeshColor(index);
    this.dirtyTiles.add(index);
  }

  private updateTileMeshColor(index: number): void {
    const id = index.toString();
    const mesh = this.tiles.get(id);
    const colors = this.tileColorManager.getTileColor(index);
    
    if (colors) {
        if (mesh && mesh.material instanceof MeshBasicMaterial && mesh.geometry.userData?.colorMask) {
            const colorAttr = mesh.geometry.getAttribute('color') as BufferAttribute;
            const maskAttr = mesh.geometry.userData.colorMask as BufferAttribute;
            const cFill = new Color(colors.color);
            const cBorder = new Color(colors.secondaryColor || colors.color);
            const arr = colorAttr.array;
            const mask = maskAttr.array;
            for (let i = 0; i < arr.length; i += 3) {
                if (mask[i] < 0.5) {
                    arr[i] = cBorder.r;
                    arr[i + 1] = cBorder.g;
                    arr[i + 2] = cBorder.b;
                } else {
                    arr[i] = cFill.r;
                    arr[i + 1] = cFill.g;
                    arr[i + 2] = cFill.b;
                }
            }
            colorAttr.needsUpdate = true;
        }
        
        if (this.instancedMeshManager) {
            this.instancedMeshManager.updateTileColor(
                index,
                colors.color,
                colors.secondaryColor || colors.color
            );
            // Also update instance opacity to reflect color alpha × MoveTrack opacity
            const mesh = this.tiles.get(index.toString());
            if (mesh) {
                const colorOpacity = mesh.userData.trackColorOpacity ?? 1;
                const moveTrackOpacity = mesh.userData.opacity ?? 1;
                const effectiveOpacity = moveTrackOpacity * colorOpacity;
                // Use current transform values — dirty check prevents unnecessary updates
                this.instancedMeshManager.updateTileTransform(
                    index,
                    mesh.position,
                    mesh.rotation as Euler,
                    mesh.scale,
                    effectiveOpacity
                );
            }
        }
    }
  }

  private updateTileChildSpriteRotations(mesh: Mesh, cameraRotation: number = 0): void {
    const tileZ = mesh.rotation.z;
    mesh.children.forEach(child => {
        if (child instanceof Sprite && child.userData.baseRotation !== undefined) {
            (child.material as SpriteMaterial).rotation = child.userData.baseRotation + tileZ - cameraRotation;
        }
    });
  }

  private processFlashEvent(event: any): void {
    if (!this.flashEffect) return;
    
    const bpm = this.tileBPM[event.floor] || 100;
    const secPerBeat = 60 / bpm;
    
    // Apply duration in beats → seconds (same as C#: duration *= crotchet)
    if (event.duration !== undefined) {
        event = { ...event, duration: event.duration * secPerBeat };
    }
    
    // Parse plane (0 = FG, 1 = BG, default FG)
    const plane = event.plane === 1 ? 'BG' : 'FG';
    
    this.flashEffect.startFlash(
        this.elapsedTime / 1000,
        event,
        plane,
    );
  }

  private processShakeScreenEvent(event: any): void {
    if (!this.shakeScreen) return;
    
    const bpm = this.tileBPM[event.floor] || 100;
    const secPerBeat = 60 / bpm;
    
    const strength = (event.strength ?? 100) / 100;
    const intensity = (event.intensity ?? 100) / 100;
    const duration = (event.duration ?? 1) * secPerBeat;
    const ease = event.ease || 'Linear';
    const fadeOut = event.fadeOut === true;
    const plane = event.plane === 1 ? 'BG' : 'FG';
    
    this.shakeScreen.startShake(
        this.elapsedTime / 1000,
        strength,
        intensity,
        duration,
        ease,
        fadeOut,
        plane,
    );
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
    
    if (this.overlayHUD) this.overlayHUD.resize();
    
    if (this.renderTarget) {
      this.renderTarget.setSize(width, height);
    }
    if (this.bloomEffect) {
      this.bloomEffect.setSize(width, height);
      if (this.flashEffect) {
        this.flashEffect.setSize(width, height);
      }
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
        this.planetRed.position.set(t0.position[0], t0.position[1], 1.0);
        this.planetBlue.position.set(t1.position[0], t1.position[1], 1.0);
      }
    }
  }

  /**
   * Compute planet positions for BOTH planets at a given timeInLevel.
   * Used by the trail system to generate trail points on-the-fly.
   * Writes [x, y] pairs into redOut/blueOut starting at the given offset.
   * Returns the number of positions written.
   */
  private computePositionsAtTime(timeInLevel: number, idx: number,
    redOut: Float64Array, blueOut: Float64Array, offset: number): void {
    const tiles = this.levelData.tiles;
    const n = tiles.length;

    let tileIndex = idx;
    // Clamp tileIndex to valid range
    if (tileIndex < 0) tileIndex = 0;
    if (tileIndex >= n) tileIndex = n - 1;

    let px: number, py: number, mx: number, my: number;

    // Helper: get stick-aware position at a specific time (for trail history)
    // Uses frame cache (accurate, from real mesh positions), falls back to
    // MoveTrack event replay for times outside cache range.
    const getStickPos = (ti: number, t: number): { x: number; y: number } | null => {
      if (this.tileStickToFloors[ti] === false) return null;
      // Try cache first (fast + accurate)
      const cached = this.getCachedTilePos(ti, t);
      if (cached) return cached;
      // Fallback: event replay (for times before cache was ready)
      if (this.moveTrackManager) {
        return this.moveTrackManager.getTilePositionAtTime(ti, t);
      }
      return null;
    };

    if (tileIndex >= n - 1) {
      // Last tile: pivot planet stays at tile center, moving planet orbits freely
      const lastP = tiles[n - 1];
      const stickPos = getStickPos(tileIndex, timeInLevel);

      if (stickPos) {
        px = stickPos.x; py = stickPos.y;
      } else {
        px = lastP.position[0]; py = lastP.position[1];
      }

      if (n - 1 > 0) {
        const prevStickPos = getStickPos(n - 2, timeInLevel);
        let prevPx: number, prevPy: number;
        if (prevStickPos) {
          prevPx = prevStickPos.x; prevPy = prevStickPos.y;
        } else {
          const prev = tiles[n - 2];
          prevPx = prev.position[0]; prevPy = prev.position[1];
        }

        const startAngle = Math.atan2(prevPy - py, prevPx - px);
        const extraTime = timeInLevel - (this.tileStartTimes[n - 1] || 0);
        const bpm = this.tileBPM[n - 1] || 100;
        const totalAngle = extraTime * (bpm / 60) * Math.PI;
        const isCW = this.tileIsCW[n - 1];
        const ca = isCW ? startAngle - totalAngle : startAngle + totalAngle;
        mx = px + Math.cos(ca); my = py + Math.sin(ca);
      } else {
        mx = px + 1; my = py;
      }
    } else {
      const stickPos = getStickPos(tileIndex, timeInLevel);
      const useStick = !!stickPos;
      if (stickPos) {
        px = stickPos.x; py = stickPos.y;
      } else {
        const tp = tiles[tileIndex];
        px = tp.position[0]; py = tp.position[1];
      }

      const st = this.tileStartTimes[tileIndex];
      const dur = this.tileDurations[tileIndex];
      const rawProgress = dur > 0.0001 ? (timeInLevel - st) / dur : 1;
      const clampedProgress = Math.max(0, Math.min(1, rawProgress));

      // When stickToFloors is on, use cached neighbor positions so the trail
      // matches the main planet's live-trajectory behavior.
      let ca: number;
      let sd: number;
      let cd: number;

      if (useStick) {
        const prevStick = tileIndex > 0 ? getStickPos(tileIndex - 1, timeInLevel) : null;
        const nextStick = tileIndex + 1 < n ? getStickPos(tileIndex + 1, timeInLevel) : null;

        if (prevStick && tileIndex > 0) {
          const pdx = prevStick.x - px;
          const pdy = prevStick.y - py;
          ca = Math.atan2(pdy, pdx);
          sd = Math.sqrt(pdx * pdx + pdy * pdy);
        } else {
          ca = this.tileStartAngle[tileIndex];
          sd = this.tileStartDist[tileIndex];
        }

        if (nextStick) {
          const ndx = nextStick.x - px;
          const ndy = nextStick.y - py;
          cd = sd + (Math.sqrt(ndx * ndx + ndy * ndy) - sd) * clampedProgress;
        } else {
          cd = sd + (this.tileEndDist[tileIndex] - sd) * clampedProgress;
        }
        ca += this.tileTotalAngle[tileIndex] * rawProgress;
      } else {
        ca = this.tileStartAngle[tileIndex] + this.tileTotalAngle[tileIndex] * rawProgress;
        sd = this.tileStartDist[tileIndex];
        cd = sd + (this.tileEndDist[tileIndex] - sd) * clampedProgress;
      }

      mx = px + Math.cos(ca) * cd;
      my = py + Math.sin(ca) * cd;
    }

    // Even tiles: red = pivot, blue = moving
    if (tileIndex % 2 === 0) {
      redOut[offset * 2] = px;     redOut[offset * 2 + 1] = py;
      blueOut[offset * 2] = mx;    blueOut[offset * 2 + 1] = my;
    } else {
      redOut[offset * 2] = mx;     redOut[offset * 2 + 1] = my;
      blueOut[offset * 2] = px;    blueOut[offset * 2 + 1] = py;
    }
  }

  /**
   * Compute trail positions for both planets for the time window [timeInLevel - 0.4, timeInLevel].
   * Feeds results to planet trails.
   */
  private computePlanetTrails(timeInLevel: number): void {
    if (!this.showTrail || !this.planetRed?.trail || !this.planetBlue?.trail) return;
    if (this.tileStartTimes.length < 2) return;

    const TRAIL_DURATION = 0.4;
    const INV_INTERVAL = 200; // 5ms = 200 samples/sec
    const startTime = timeInLevel - TRAIL_DURATION;
    const numSteps = Math.ceil(TRAIL_DURATION * INV_INTERVAL); // ~80

    // Find starting tile index
    let tileIndex = 0;
    for (let i = this.tileStartTimes.length - 1; i >= 0; i--) {
      if (startTime >= this.tileStartTimes[i]) { tileIndex = i; break; }
    }

    const redArr = new Float64Array(numSteps * 2);
    const blueArr = new Float64Array(numSteps * 2);
    let written = 0;

    for (let s = 0; s < numSteps; s++) {
      const t = startTime + s / INV_INTERVAL;
      if (t > timeInLevel) break;

      // Advance tileIndex if needed
      while (tileIndex + 1 < this.tileStartTimes.length && t >= this.tileStartTimes[tileIndex + 1]) {
        tileIndex++;
      }

      this.computePositionsAtTime(t, tileIndex, redArr, blueArr, written);
      written++;
    }

    if (written > 1) {
      const trimRed = new Float64Array(redArr.buffer, 0, written * 2);
      const trimBlue = new Float64Array(blueArr.buffer, 0, written * 2);
      this.planetRed.setTrailPoints(trimRed);
      this.planetBlue.setTrailPoints(trimBlue);
      // Compute reference position at exactly timeInLevel (avoids 5ms sample alignment jitter)
      let refTileIdx = 0;
      for (let i = this.tileStartTimes.length - 1; i >= 0; i--) {
        if (timeInLevel >= this.tileStartTimes[i]) { refTileIdx = i; break; }
      }
      const refRed = new Float64Array(2);
      const refBlue = new Float64Array(2);
      this.computePositionsAtTime(timeInLevel, refTileIdx, refRed, refBlue, 0);

      const redOffX = this.planetRed.position.x - refRed[0];
      const redOffY = this.planetRed.position.y - refRed[1];
      const blueOffX = this.planetBlue.position.x - refBlue[0];
      const blueOffY = this.planetBlue.position.y - refBlue[1];

      this.planetRed.trail.mesh.position.x = redOffX;
      this.planetRed.trail.mesh.position.y = redOffY;
      this.planetBlue.trail.mesh.position.x = blueOffX;
      this.planetBlue.trail.mesh.position.y = blueOffY;
    } else {
      this.planetRed.trail.clear();
      this.planetBlue.trail.clear();
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

  private lastVisibleCheckPos = new Vector3(Infinity, Infinity, Infinity);
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
    const newVisibleSet = new Set<number>();

    const minCellX = Math.floor((left - margin) / this.spatialGridSize);
    const maxCellX = Math.floor((right + margin) / this.spatialGridSize);
    const minCellY = Math.floor((bottom - margin) / this.spatialGridSize);
    const maxCellY = Math.floor((top + margin) / this.spatialGridSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const tileIndices = this.spatialGrid.get(cx * 100000 + cy);
        if (tileIndices) {
          for (let i = 0; i < tileIndices.length; i++) {
            newVisibleSet.add(tileIndices[i]);
          }
        }
      }
    }

    // Remove tiles no longer visible — iterate visibleTiles directly instead of Array.from()
    for (const id of this.visibleTiles) {
        const idx = parseInt(id);
        if (!newVisibleSet.has(idx)) {
            const mesh = this.tiles.get(id);
            if (mesh) {
                this.scene.remove(mesh);
            }
            if (this.instancedMeshManager) {
                this.instancedMeshManager.setTileVisibility(idx, false);
            }
            this.dirtyTiles.add(idx);
            this.visibleTiles.delete(id);
        }
    }

    // Add newly visible tiles
    for (const idx of newVisibleSet) {
      const id = idx.toString();
      if (!this.visibleTiles.has(id)) {
        const tileMesh = this.getOrCreateTileMesh(idx);
        if (tileMesh) {
          if (!this.instancedMeshManager) {
            this.scene.add(tileMesh);
          } else {
            this.scene.add(tileMesh);
            this.instancedMeshManager.setTileVisibility(idx, true);
            this.instancedMeshManager.setFloorIconType(idx, tileMesh.userData.floorIconType ?? 0);
            this.instancedMeshManager.setFloorIconAngle(idx, tileMesh.userData.floorIconAngle ?? 0);
          }
          this.visibleTiles.add(id);
          this.dirtyTiles.add(idx);
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
            if (this.instancedMeshManager) {
                this.instancedMeshManager.removeTile(parseInt(id));
            }
            if (mesh.material instanceof Material) {
                mesh.material.dispose();
            }
            this.tiles.delete(id);
            removed++;
        }
    }
  }

  private getOrCreateTileMesh(index: number): Mesh | null {
    const id = index.toString();
    if (this.tiles.has(id)) return this.tiles.get(id)!;

    const tile = this.levelData.tiles[index];
    if (!tile) return null;
    
    const [x, y] = tile.position;
    const zLevel = 12 - index;
    
    // Resolve absolute directions for mesh geometry.
    // tile.direction contains raw angleData values (0, 999, etc.)
    // We need to resolve 999 by backtracking to the last non-999 value,
    // matching the ADOFAI library's calculateTilePosition() convention.
    const resolved = this.getResolvedTileDirection(index);
    const prevResolved = index > 0 ? this.getResolvedTileDirection(index - 1) : 0;

    // pred = incoming segment direction (prev tile's resolved direction - 180)
    const pred = index > 0 ? (prevResolved || 0) - 180 : -180;
    const currentDirection = resolved || 0;
    const is999 = (tile.angle === 0);
    
    // Get track style from tile color config
    const tileConfig = this.tileColorManager.getTileRecolorConfig(index);
    const trackStyle = tileConfig?.trackStyle || 'Standard';

    const shapeKey = `${pred}_${currentDirection}_${is999}_${trackStyle}`;
    let geometry = this.geometryCache.get(shapeKey);

    if (!geometry) {
      const meshData = createTrackMesh(pred, currentDirection, is999, undefined, undefined, undefined, trackStyle);
      if (!meshData || !meshData.faces) return null;

      geometry = new BufferGeometry();
      geometry.setIndex(meshData.faces);
      geometry.setAttribute('position', new Float32BufferAttribute(meshData.vertices, 3));
      geometry.setAttribute('color', new Float32BufferAttribute(meshData.colors, 3));
      geometry.computeVertexNormals();
      this.geometryCache.set(shapeKey, geometry);
    }

    const colors = this.tileColorManager.getTileColor(index);
    const color = colors?.color || '#ffffff';
    const bgcolor = colors?.secondaryColor || color;

    // Clone geometry and bake actual vertex colors from the mask
    const tileGeo = geometry.clone();
    const sharedColorAttr = geometry.getAttribute('color') as BufferAttribute;
    const colorAttr = tileGeo.getAttribute('color') as BufferAttribute;
    const cFill = new Color(color);
    const cBorder = new Color(bgcolor);
    const colorArray = colorAttr.array;
    const maskArray = sharedColorAttr.array;

    for (let i = 0; i < colorArray.length; i += 3) {
        if (maskArray[i] < 0.5) {
            colorArray[i] = cBorder.r;
            colorArray[i + 1] = cBorder.g;
            colorArray[i + 2] = cBorder.b;
        } else {
            colorArray[i] = cFill.r;
            colorArray[i + 1] = cFill.g;
            colorArray[i + 2] = cFill.b;
        }
    }
    colorAttr.needsUpdate = true;

    // Store mask reference for future color updates
    tileGeo.userData.colorMask = sharedColorAttr;

    const material = new MeshBasicMaterial({
        vertexColors: true,
        side: DoubleSide,
        transparent: true,
        depthWrite: false
    });

    const tileMesh = new Mesh(tileGeo, material);

    // Calculate transform from PositionTrack
    let finalPos = new Vector3(x, y, 0);
    let finalRot = new Euler(0, 0, 0);
    let finalScale = new Vector3(1, 1, 1);
    let finalOpacity = 1;

    if (this.positionTrackManager) {
      const transform = this.positionTrackManager.getTileTransform(index);
      if (transform) {
        tileMesh.position.copy(transform.position);
        tileMesh.rotation.z = transform.rotation * (Math.PI / 180); // Convert degrees to radians
        tileMesh.scale.copy(transform.scale);
        
        finalPos.copy(transform.position);
        finalRot.z = transform.rotation * (Math.PI / 180);
        finalScale.copy(transform.scale);

        // Composite MoveTrack opacity with color hex alpha
        const colorOpacity = tileConfig?.trackOpacity ?? 1;
        tileMesh.userData.trackColorOpacity = colorOpacity;
        finalOpacity = transform.opacity * colorOpacity;
        tileMesh.userData.opacity = transform.opacity;

        // Apply combined opacity
        material.opacity = finalOpacity;
        material.transparent = finalOpacity < 0.999;
      }
    } else {
      // Fallback to original position calculation - use stable Z for depth ordering
      const stableZ = (12 - index) * 0.01;
      tileMesh.position.set(x, y, stableZ);
      finalPos.set(x, y, stableZ);
      const colorOpacity = tileConfig?.trackOpacity ?? 1;
      tileMesh.userData.opacity = 1;
      tileMesh.userData.trackColorOpacity = colorOpacity;
      finalOpacity = colorOpacity;
    }

    tileMesh.castShadow = true;
    tileMesh.receiveShadow = true;
    tileMesh.renderOrder = -index;

    // If using instancing, update the manager
    if (this.instancedMeshManager) {
        // Hide individual mesh's own geometry but allow its children (decorations) to be visible
        tileMesh.material.visible = false;
    }
    
    // Add event icons (Twirl, SetSpeed, End) using PNG sprites
    const decoZ = 0.002;
    const initialOpacity = (tileMesh.userData.opacity ?? 1) * (tileMesh.userData.trackColorOpacity ?? 1);
    let hasTwirl = false;
    let hasSetSpeed = false;

    if (this.tileEvents.has(index)) {
        const events = this.tileEvents.get(index)!;
        events.forEach(e => {
            if (e.eventType === 'Twirl') hasTwirl = true;
            if (e.eventType === 'SetSpeed') hasSetSpeed = true;
        });
    }

    // Determine floor icon type (for UV-based rendering)
    let iconTypeIdx = 0;
    const tileCount = this.levelData.tiles?.length ?? 0;
    if (index === tileCount - 1) {
        iconTypeIdx = getIconTypeIndex('End');
    } else if (hasTwirl) {
        const tileAngle = this.levelData.tiles?.[index]?.angle ?? 180;
        const dir = this.tileIsCW[index] ? 1 : -1;
        iconTypeIdx = getIconTypeIndex(getTwirlTexture(tileAngle, dir));
    } else if (hasSetSpeed) {
        const currentBPM = this.tileBPM[index];
        const prevBPM = index > 0 ? this.tileBPM[index - 1] : (this.levelData.settings.bpm || 100);
        const ratio = currentBPM / prevBPM;
        if (ratio > 1.05 || ratio < 0.95) {
            iconTypeIdx = getIconTypeIndex(getSetSpeedTexture(ratio));
        }
    }
    tileMesh.userData.floorIconType = iconTypeIdx;

    // Compute floor icon angle for shader
    const floorIconAngle = this.getFloorIconAngle(index, hasTwirl);
    tileMesh.userData.floorIconAngle = floorIconAngle;

    // Update instanced mesh with icon type and direction angle
    if (this.instancedMeshManager) {
        const texSeed = trackStyle === 'Standard' && !this.disableTrackTexture ? Math.random() * 10 + 1 : 0;
        this.instancedMeshManager.updateTile(
            index,
            shapeKey,
            finalPos,
            finalRot,
            finalScale,
            color,
            bgcolor,
            finalOpacity,
            true, // visible
            texSeed,
            iconTypeIdx,
            floorIconAngle
        );
    }

    this.tiles.set(id, tileMesh);

    // Register tile initial state with MoveTrack manager
    if (this.moveTrackManager) {
      this.moveTrackManager.registerTileInitial(index, tileMesh);
    }

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
    const timeInLevel = (this.elapsedTime / 1000) - countdownDuration;
    
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
             pivotPlanet.position.set(pivotPos[0], pivotPos[1], 1.0);
             
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
                 1.0
             );
             
     	    pivotPlanet.position.z = 1.0;
             pivotPlanet.update(0, timeInLevel);
             movingPlanet.update(0, timeInLevel);
             this.computePlanetTrails(timeInLevel);
        }
        return;
    }

    // Normal Rotation Logic
    const pivot = this.levelData.tiles[tileIndex];

    if (pivot) {
        const isRedPivot = (tileIndex % 2 === 0);
        const pivotPlanet = isRedPivot ? this.planetRed : this.planetBlue;
        const movingPlanet = isRedPivot ? this.planetBlue : this.planetRed;

        // Get tile position based on stickToFloors
        // If stickToFloors is false, use original position (planet doesn't follow tile movement)
        // If stickToFloors is true, use actual mesh position (planet follows tile movement)
        const tileId = tileIndex.toString();
        const tileMesh = this.tiles.get(tileId);
        const tileData = this.levelData.tiles[tileIndex];
        const useStickToFloor = this.tileStickToFloors[tileIndex] !== false;
        
        let pivotPos: Vector3;
        if (useStickToFloor && tileMesh) {
            // Use actual tile mesh position (may have been moved by PositionTrack/MoveTrack)
            pivotPos = tileMesh.position.clone();
        } else {
            // Use original tile position (planet doesn't follow tile movement)
            pivotPos = new Vector3(tileData.position[0], tileData.position[1], tileMesh ? tileMesh.position.z : 0);
        }

        this.currentPivotPosition.x = pivotPos.x;
        this.currentPivotPosition.y = pivotPos.y;

        // Pivot planet uses the selected position
        pivotPlanet.position.set(pivotPos.x, pivotPos.y, 1.0);

        // When stickToFloors is enabled, use live mesh positions for the full trajectory
        // so the ball correctly arrives at each tile's actual (possibly moved) position.
        // The pivot follows the current tile, and startDist/endDist adapt to neighbors.
        const startTime = this.tileStartTimes[tileIndex];
        const duration = this.tileDurations[tileIndex];
        const progress = duration > 0.0001 ? (timeInLevel - startTime) / duration : 1;

        let startAngle: number;
        let startDist: number;
        let endDist: number;

        if (useStickToFloor) {
            const prevMesh = tileIndex > 0 ? this.tiles.get((tileIndex - 1).toString()) : null;
            const nextMesh = tileIndex + 1 < this.levelData.tiles.length
                ? this.tiles.get((tileIndex + 1).toString()) : null;

            if (prevMesh && tileIndex > 0) {
                const pdx = prevMesh.position.x - pivotPos.x;
                const pdy = prevMesh.position.y - pivotPos.y;
                startAngle = Math.atan2(pdy, pdx);
                startDist = Math.sqrt(pdx * pdx + pdy * pdy);
            } else {
                startAngle = this.tileStartAngle[tileIndex];
                startDist = this.tileStartDist[tileIndex];
            }

            if (nextMesh) {
                const ndx = nextMesh.position.x - pivotPos.x;
                const ndy = nextMesh.position.y - pivotPos.y;
                endDist = Math.sqrt(ndx * ndx + ndy * ndy);
            } else {
                endDist = this.tileEndDist[tileIndex];
            }
        } else {
            startAngle = this.tileStartAngle[tileIndex];
            startDist = this.tileStartDist[tileIndex];
            endDist = this.tileEndDist[tileIndex];
        }

        const totalAngle = this.tileTotalAngle[tileIndex];
        const currentAngle = startAngle + totalAngle * progress;

        const clampedProgress = Math.max(0, Math.min(1, progress));
        const currentDist = startDist + (endDist - startDist) * clampedProgress;

        // Calculate planet position relative to selected pivot position
        const planetX = pivotPos.x + Math.cos(currentAngle) * currentDist;
        const planetY = pivotPos.y + Math.sin(currentAngle) * currentDist;

        movingPlanet.position.set(planetX, planetY, 1.0);
    }
    
    this.planetRed.update(0, timeInLevel);
    this.planetBlue.update(0, timeInLevel);
    this.computePlanetTrails(timeInLevel);
  }
  
  private updateCameraFollow(delta: number): void {
      if (!this.planetRed || !this.planetBlue) return;

      const settings = this.levelData.settings;
      const initialBPM = settings.bpm || 100;
      const initialSecPerBeat = 60 / initialBPM;
      const countdownTicks = settings.countdownTicks || 4;
      const countdownDuration = countdownTicks * initialSecPerBeat;
      
      const currentTimeInSeconds = this.elapsedTime / 1000;
      const timeInLevel = currentTimeInSeconds - countdownDuration;

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
              zoom: this.zoom * 100,  // Convert back to ADOFAI format
              rotation: this.camera.rotation.z * (180 / Math.PI)
          };
          this.cameraController.processCameraEvent(
              entry.event,
              entry.event.floor || 0,
              this.elapsedTime,
              cameraSnapshot,
              this.currentPivotPosition
          );
      }
      this.cameraController.setLastCameraTimelineIndex(newIdx);
      
      // Update custom background parallax
      this.updateCustomBGParallax();
      
      // Reset follow smooth when tile advances (matching scrCamera.UpdateFollowCam)
      if (this.currentTileIndex !== this._lastCamSmoothTile) {
        this._lastCamSmoothTile = this.currentTileIndex;
        this.cameraController.resetSmooth({
          x: this.cameraPosition.x,
          y: this.cameraPosition.y,
        });
      }

      const currentBPM = (this.tileBPM && this.tileBPM[this.currentTileIndex]) || 100;

      // Official ADOFAI lerp-based smooth follow (matching scrCamera.UpdateFollowCam)
      const smoothPos = this.cameraController.getSmoothPosition(
        this.currentPivotPosition,
        currentBPM,
        delta,
        this.elapsedTime,
      );
      this.cameraPosition.x = smoothPos.x;
      this.cameraPosition.y = smoothPos.y;
      this.camera.position.x = this.cameraPosition.x;
      this.camera.position.y = this.cameraPosition.y;

      // Get interpolated values for zoom and rotation
      const interpolated = this.cameraController.getInterpolatedValues(this.elapsedTime);

      // Zoom: ADOFAI zoom 100 = normal view, 200 = 2x zoomed out
      this.adoZoom = interpolated.zoom;
      this.zoom = 100 / interpolated.zoom;
      this.camera.zoom = this.zoom * this.zoomMultiplier;
      this.camera.updateProjectionMatrix();

      // Auto-disable tile texture when zoomed out past threshold
      // (texture is imperceptible on tiny tiles, but still costs GPU bandwidth).
      // Only interferes when the user has NOT explicitly toggled textures off.
      if (!this.disableTrackTexture && this.instancedMeshManager) {
          const zoomThreshold = 300; // ADOFAI zoom > 300 → tiles are very small
          if (interpolated.zoom > zoomThreshold) {
              if (!this._textureAutoDisabled) {
                  this._textureAutoDisabled = true;
                  this.instancedMeshManager.setTileTextureEnabled(false);
              }
          } else if (this._textureAutoDisabled) {
              this._textureAutoDisabled = false;
              this.instancedMeshManager.setTileTextureEnabled(true);
          }
      }
      
      // Rotation (in degrees, convert to radians)
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

  private loadTileTexture(): void {
    const loader = new TextureLoader();
    const texture = loader.load(tileTextureUrl);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.colorSpace = SRGBColorSpace;
    if (this.instancedMeshManager) {
      this.instancedMeshManager.setTileTexture(texture, 0.6);
    }
  }

  public loadVideo(src: string, quality: 'low' | 'medium' | 'high' = 'medium'): void {
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
        if (this.videoMesh.material instanceof Material) {
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
    video.preload = 'auto';

    this.videoElement = video;

    // Use VideoTexture directly bound to the <video> element.
    // This eliminates the intermediate canvas + ctx.drawImage() CPU overhead,
    // letting the GPU sample directly from decoded video frames (hardware-accelerated).
    // The old canvas-downsampling approach caused stuttering because drawImage()
    // with downscaling is a synchronous CPU-bound operation that blocks the main thread.
    const videoTex = new VideoTexture(video);
    videoTex.colorSpace = SRGBColorSpace;
    videoTex.minFilter = LinearFilter;
    videoTex.magFilter = LinearFilter;
    videoTex.generateMipmaps = false;
    this.videoTexture = videoTex;

    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial({
        map: this.videoTexture,
        depthWrite: false,
        depthTest: true,
        transparent: false
    });
    this.videoMesh = new Mesh(geometry, material);
    this.videoMesh.position.set(0, 0, -500);
    this.videoMesh.renderOrder = -999;
    this.scene.add(this.videoMesh);

    video.onloadedmetadata = () => {
        this.updateVideoSize();
    };

    video.load();
    console.log("Video loaded, offset:", this.videoOffset);
  }

  /**
   * Register a custom decoration image
   * @param filename The filename to reference this image
   * @param url The URL or base64 data URL of the image
   */
  public registerDecorationImage(filename: string, url: string): void {
    if (this.decorationManager) {
      this.decorationManager.registerCustomImage(filename, url);
    }
  }
  
  /**
   * Register a custom background image for SetCustomBG events
   * @param filename The filename of the image (as referenced in level data)
   * @param url The URL or base64 data URL of the image
   */
  public registerCustomBGImage(filename: string, url: string): void {
    this.customBGImages.set(filename, url);
  }
  
  /**
   * Preload all decoration textures asynchronously
   * Call this after registering all decoration images and before startPlay
   * @returns Promise resolving to number of textures loaded
   */
  public async preloadDecorationTextures(): Promise<number> {
    if (this.decorationManager) {
      return this.decorationManager.preloadTextures();
    }
    return 0;
  }

  private lastVideoSeekTime: number = 0;
  private syncVideo(): void {
    if (!this.videoElement || !this.isPlaying || this.isPaused) return;

    const settings = this.levelData.settings;
    const initialBPM = settings.bpm || 100;
    const initialSecPerBeat = 60 / initialBPM;
    const countdownTicks = settings.countdownTicks || 4;
    const countdownDuration = countdownTicks * initialSecPerBeat;

    const timeInLevel = (this.elapsedTime / 1000) - countdownDuration;

    const targetVideoTime = timeInLevel + (this.videoOffset / 1000);

    if (targetVideoTime < 0) {
        if (!this.videoElement.paused) {
            this.videoElement.pause();
            this.videoElement.currentTime = 0;
        }
    } else {
        if (this.videoElement.paused && this.videoElement.readyState >= 2) {
            this.videoElement.play().catch(e => console.warn("Video play failed:", e));
        }

        const drift = Math.abs(this.videoElement.currentTime - targetVideoTime);
        // Throttle seeking: only seek when drift exceeds threshold, max once per 250ms
        const now = performance.now();
        if (drift > 0.3 && now - this.lastVideoSeekTime > 250) {
            this.videoElement.currentTime = targetVideoTime;
            this.lastVideoSeekTime = now;
        }
    }
  }

  /**
   * Convert pathData string to tiles and angleData arrays.
   * pathData is a string where each character encodes a tile's direction angle.
   * Maps characters to degrees using ADOFAI's convention (R=0°, U=90°, L=180°, D=270°, etc.).
   */
  private convertPathDataToTiles(): void {
    const pathData: string | undefined = (this.levelData as any).pathData;
    if (!pathData || typeof pathData !== 'string' || !pathData.length) return;
    if ((this.levelData.tiles?.length ?? 0) > 0) return;

    const angleMap: Record<string, number> = {
      'R': 0,   'E': 45,  'U': 90,  'Q': 135, 'L': 180,
      'Z': 225, 'D': 270, 'C': 315,
      'T': 60,  'G': 120, 'F': 240, 'B': 300,
      'J': 30,  'H': 150, 'N': 210, 'M': 330,
      'p': 15,  'o': 75,  'q': 105, 'W': 165,
      'x': 195, 'V': 255, 'Y': 285, 'A': 345,
    };
    const relativeMap: Record<string, number> = {
      't': 60,   'y': 300,
      'h': 120,  'j': -120,
      '5': 72,   '6': -72,
      '7': 52,   '8': -52,
      '9': -30,
    };

    const angleData: number[] = [];
    for (const ch of pathData) {
      const abs = angleMap[ch];
      if (abs !== undefined) {
        angleData.push(abs);
      } else if (ch === '!') {
        angleData.push(999);
      } else {
        const prev = angleData.length > 0 ? angleData[angleData.length - 1] : 0;
        const rel = relativeMap[ch];
        angleData.push(rel !== undefined ? prev + rel : prev);
      }
    }

    const tiles: any[] = [];
    for (let i = 0; i < angleData.length; i++) {
      tiles.push({
        angle: 180,
        direction: angleData[i],
      });
    }

    (this.levelData as any).tiles = tiles;
    (this.levelData as any).angleData = angleData;
  }

  /**
   * Calculate basic tile positions without PositionTrack
   * This is needed because we skipped ADOFAI-JS's calculateTilePosition()
   */
  private calculateBasicTilePositions(): void {
    const tiles = this.levelData.tiles;
    const angleData = this.levelData.angleData || [];
    
    // Start from (0, 0)
    let currentPos = new Vector2(0, 0);
    
    // Pre-calculate all angles
    const floats = new Array(tiles.length);
    for (let i = 0; i < tiles.length; i++) {
      floats[i] = angleData[i] === 999 ? (floats[i - 1] || 0) + 180 : angleData[i];
    }
    
    // Calculate positions
    for (let i = 0; i < tiles.length; i++) {
      const angle = floats[i];
      
      // Save current position for this tile
      tiles[i].position = [currentPos.x, currentPos.y];
      
      // Calculate next position based on angle
      const rad = angle * Math.PI / 180;
      currentPos.x += Math.cos(rad);
      currentPos.y += Math.sin(rad);
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
        if (this.videoMesh.material instanceof Material) {
            this.videoMesh.material.dispose();
        }
        this.videoMesh = null;
    }

    // Cleanup MoveTrack manager first to reset tiles
    if (this.moveTrackManager) {
      this.moveTrackManager.dispose();
      this.moveTrackManager = null;
    }

    // Cleanup InstancedMeshManager
    if (this.instancedMeshManager) {
      this.instancedMeshManager.dispose();
      this.instancedMeshManager = null;
    }

    // Cleanup Three.js resources
    this.tiles.forEach(mesh => {
        if (mesh.material instanceof Material) {
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

    this.spatialGrid.clear();

    // Cleanup decoration manager
    if (this.decorationManager) {
      this.decorationManager.dispose();
      this.decorationManager = null;
    }

    if (this.hitsoundManager) {
      this.hitsoundManager.dispose();
    }
    
    if (this.renderTarget) {
      this.renderTarget.dispose();
      this.renderTarget = null;
    }
    if (this.bloomEffect) {
      this.bloomEffect.dispose();
          if (this.flashEffect) {
            this.flashEffect.dispose();
            this.flashEffect = null;
          }
      this.bloomEffect = null;
    }
    
    if (this.renderer) {
      if (this.container && this.renderer.domElement && this.renderer.domElement.parentNode === this.container) {
          this.container.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
      this.renderer = null as any;
    }
    
    if (this.overlayHUD) {
      this.overlayHUD.dispose();
      this.overlayHUD = null;
    }

    if (this.music) {
      this.music.dispose();
    }
  }
}