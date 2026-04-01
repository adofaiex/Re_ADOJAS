import * as THREE from 'three';

export type TargetFramerateType = "auto" | "30" | "60" | "120" | "144" | "165" | "240" | "unlimited";

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
  setUseWorker(use: boolean): void;
  setTargetFramerate(framerate: TargetFramerateType): void;
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
  dispose(): void;
}

export interface IPlanet {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  radius: number;
  color: THREE.Color;
  rotation: number;
  
  update(deltaTime: number): void;
  render(scene: THREE.Scene): void;
  moveTo(target: THREE.Vector3): void;
  dispose(): void;
}

/**
 * Decoration placement type
 */
export type DecPlacementType = 'Tile' | 'Camera' | 'CameraAspect' | 'LastPosition';

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
  depth?: number;
  color?: string;
  opacity?: number;
  visible?: boolean;
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
  depth?: number;
  visible?: boolean;
  relativeTo?: DecPlacementType;
  decorationImage?: string;
}

export interface ILevelData {
  settings: any;
  tiles: any[];
  actions?: any[];
  decorations?: IDecorationEvent[];
}
