import { Mesh, Vector3, Color, Scene, Texture, BufferGeometry, Material, Euler, Sprite, SpriteMaterial, ShaderMaterial, InstancedMesh, Object3D, WebGLRenderer, WebGLRenderTarget, Group, MeshBasicMaterial } from 'three';
import type { AsyncInputEvent } from './AsyncInputManager';

export type TargetFramerateType = "auto" | "30" | "60" | "120" | "144" | "165" | "240" | "unlimited";

/** 渲染倍率：pixelRatio = native 时取 devicePixelRatio，否则取 min(DPR, 该值)。 */
export type RenderScaleType = "0.75" | "1" | "1.5" | "native";

/** 输入方式：sync = 主线程事件队列；worker = Worker 队列（主线程打戳、Worker 搬运）。 */
export type InputMethodType = "sync" | "worker";

/** 输入队列抽象：AsyncInputManager 与 WorkerInputManager 共用同一 API。 */
export interface InputQueue {
  attach(): void;
  detach(): void;
  drain(): AsyncInputEvent[];
  clear(): void;
  readonly pendingCount: number;
}

export interface IPlayer {
  createPlayer(container: HTMLElement): void;
  updatePlayer(delta: number): void;
  renderPlayer(delta: number): void;
  startPlay(): void;
  stopPlay(): void;
  pausePlay(): void;
  resumePlay(): void;
  resetPlayer(): void;
  destroyPlayer(): void;
  setRenderer(type: 'webgl' | 'webgpu'): void;
  setRenderMethod(method: 'sync' | 'async'): void;
  setShowTrail(show: boolean): void;
  setHitsoundEnabled(enabled: boolean): void;
  setTargetFramerate(framerate: TargetFramerateType): void;
  setRenderScale(scale: RenderScaleType): void;
  setInputMethod(method: InputMethodType): void;
  setOGGCompression(enabled: boolean): void;
  setZoom(zoom: number): void;
  loadMusic(src: string): void;
  registerDecorationImage?(filename: string, url: string): void;
  registerCustomBGImage?(filename: string, url: string): void;
  preloadDecorationTextures?(): Promise<number>;
}

export interface IMusic {
  load(src: string): void;
  play(): void;
  pause(): void;
  stop(): void;
  resume(): void;
  seek(position: number): void;
  readonly position: number;
  readonly duration: number;
  volume: number;
  pitch: number;
  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  readonly hasAudio: boolean;
  readonly amplitude: number;
  audio?: HTMLAudioElement;
  playScheduled?(time: number, offset: number): void;
  dispose(): void;
}

export interface IPlanet {
  mesh: Mesh;
  position: Vector3;
  radius: number;
  color: Color;
  rotation: number;
  
  update(deltaTime: number): void;
  render(scene: Scene): void;
  moveTo(target: Vector3): void;
  dispose(): void;
}

/**
 * Decoration placement type
 */
export type DecPlacementType = 'Tile' | 'Camera' | 'CameraAspect' | 'Global' | 'LastPosition' | 'RedPlanet' | 'BluePlanet' | 'GreenPlanet';

/**
 * Decoration event from ADOFAI level file
 */
export interface IDecorationEvent {
  eventType: 'AddDecoration' | 'AddText' | 'AddParticle' | 'AddObject';
  floor?: number;
  tag?: string;
  decorationImage?: string;
  decText?: string;
  position?: [number, number];
  positionOffset?: [number, number];
  relativeTo?: DecPlacementType;
  rotation?: number;
  rotationOffset?: number;
  scale?: [number, number];
  parallax?: [number, number];
  parallaxOffset?: [number, number];
  pivotOffset?: [number, number];
  depth?: number;
  color?: string | Record<string, unknown>;
  opacity?: number;
  visible?: boolean | string;
  lockScale?: boolean;
  lockRotation?: boolean;
  scaleMultiplier?: number;
  stickToFloor?: boolean;
  blendMode?: 'None' | 'Additive' | 'Screen' | 'Multiply' | 'Overlay' | 'Subtract' | 'Divide';
  maskingType?: 'None' | 'Mask' | 'VisibleInsideMask' | 'VisibleOutsideMask';
  maskingTarget?: string;
  imageSmoothing?: boolean;
  objectType?: 'Planet' | 'Floor' | 'PlayerBubble';
  [key: string]: unknown;
}

/**
 * MoveDecorations event from ADOFAI level file
 */
export interface IMoveDecorationsEvent {
  eventType: 'MoveDecorations';
  floor: number;
  tag: string;
  duration: number;
  ease?: string;
  angleOffset?: number;
  positionOffset?: [number, number];
  rotationOffset?: number;
  scale?: [number, number];
  color?: string;
  opacity?: number;
  parallax?: [number, number];
  parallaxOffset?: [number, number];
  pivotOffset?: [number, number];
  depth?: number;
  visible?: boolean | string;
  relativeTo?: DecPlacementType;
  decorationImage?: string;
  maskingType?: 'None' | 'Mask' | 'VisibleInsideMask' | 'VisibleOutsideMask';
  maskingTarget?: string;
  disabled?: Record<string, boolean>;
  [key: string]: unknown;
}

export interface ILevelData {
  settings: any;
  /**
   * 普通模式为对象数组；库开启紧凑模式时为 CompactTileStore（提供 length/getAngle/
   * getDirection/getTwirl/getActions 等访问器）。
   * TODO(compact): Player 内 50+ 处 `tiles[i].xxx` 读取正在逐步迁移到访问器；
   * 当前用宽类型保证编译，实际只在未开启紧凑模式时按对象数组使用。
   */
  tiles: any;
  actions?: any[];
  decorations?: IDecorationEvent[];
  angleData?: number[];
}

/**
 * Track animation type for floor appearance
 */
export enum TrackAnimationType {
  None = 0,
  Assemble = 1,
  Assemble_Far = 2,
  Extend = 3,
  Grow = 4,
  Grow_Spin = 5,
  Fade = 6,
  Drop = 7,
  Rise = 8
}

/**
 * Track animation type for floor disappearance
 */
export enum TrackAnimationType2 {
  None = 0,
  Scatter = 1,
  Scatter_Far = 2,
  Retract = 3,
  Shrink = 4,
  Shrink_Spin = 5,
  Fade = 6
}
