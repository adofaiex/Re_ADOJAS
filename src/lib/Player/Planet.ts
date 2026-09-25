import { Mesh, Vector3, Color, PlaneGeometry, MeshBasicMaterial, DoubleSide, Texture, Scene, Material } from 'three';
import { IPlanet } from './types';
import { PlanetTrail } from './PlanetTrail';
import { configurePlanetTexture, applyPlanetFrame } from './IconLoader';

export class Planet implements IPlanet {
  public mesh: Mesh;
  public position: Vector3 = new Vector3();
  /** 半径（拖尾宽度 = 直径）。取值 0.22。 */
  public radius: number = 0.22;
  public color: Color;
  public rotation: number = 0;

  public trail: PlanetTrail | null = null;
  private showTrail: boolean = false;
  /** 行星 sprite sheet（11 帧横排）；update 里按 fps 切帧。 */
  private texture: Texture | null = null;

  /**
   * 行星本体 = 带行星贴图的四边形（贴图四边形 + `_PlanetTex`
   * sprite sheet + `_Frame = unscaledTime * 12 % 11`）；本体用贴图四边形、白色不染色，贴图缺失时退回纯色（= 传入的 color）。
   */
  constructor(color: number | string | Color, initialPosition?: Vector3, showTrail: boolean = false, texture?: Texture) {
    this.color = new Color(color);
    this.showTrail = showTrail;

    const geometry = new PlaneGeometry(1, 1);
    const planetTex = texture ? configurePlanetTexture(texture) : null;
    this.texture = planetTex;
    if (planetTex) applyPlanetFrame(planetTex, 0);
    const material = new MeshBasicMaterial({
      map: planetTex,
      color: planetTex ? 0xffffff : this.color,
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
    });
    this.mesh = new Mesh(geometry, material);
    this.mesh.scale.set(this.radius * 2, this.radius * 2, 1);
    // 本体 renderOrder 必须高于拖尾（拖尾 depthTest:false，否则会盖住球）。
    this.mesh.renderOrder = 110;

    if (initialPosition) {
      this.position.copy(initialPosition);
      this.mesh.position.copy(initialPosition);
    }

    if (this.showTrail) {
      this.trail = new PlanetTrail(this.color, this.radius);
    }
  }

  update(deltaTime: number, currentTime: number = 0): void {
    this.mesh.position.copy(this.position);
    // 用 unscaledTime（暂停时也继续转）
    if (this.texture) applyPlanetFrame(this.texture, performance.now() * 0.001);
  }

  /** Feed computed trail positions (Float64Array of XY pairs) to the trail renderer */
  setTrailPoints(xy: Float64Array): void {
    if (this.trail) this.trail.setPoints(xy);
  }

  render(scene: Scene): void {
    if (!scene.children.includes(this.mesh)) {
      scene.add(this.mesh);
    }
    if (this.trail && !scene.children.includes(this.trail.mesh)) {
      scene.add(this.trail.mesh);
    }
  }

  removeFromScene(scene: Scene): void {
    if (scene.children.includes(this.mesh)) {
      scene.remove(this.mesh);
    }
    if (this.trail && scene.children.includes(this.trail.mesh)) {
      scene.remove(this.trail.mesh);
    }
  }

  setRadius(r: number): void {
    this.radius = r;
    this.mesh.scale.set(r * 2, r * 2, 1);
    if (this.trail) {
      this.trail.setPlanetRadius(r);
    }
  }

  public clearTrail(): void {
    if (this.trail) {
      this.trail.clear();
    }
  }

  moveTo(target: Vector3): void {
    this.position.copy(target);
    this.mesh.position.copy(target);
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(m => m.dispose());
      } else {
        (this.mesh.material as Material).dispose();
      }
    }
    if (this.trail) {
      this.trail.dispose();
    }
  }
}
