import * as THREE from 'three';

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
  setRenderer(type: 'webgl' | 'webgpu'): Promise<void>;
  setZoom(zoom: number): void;
  loadMusic(src: string): void;
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

export interface ILevelData {
  settings: any;
  tiles: any[];
  actions?: any[];
}
