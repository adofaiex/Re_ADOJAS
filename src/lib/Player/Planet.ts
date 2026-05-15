import * as THREE from 'three';
import { IPlanet } from './types';
import { PlanetTrail } from './PlanetTrail';

export class Planet implements IPlanet {
  public mesh: THREE.Mesh;
  public position: THREE.Vector3 = new THREE.Vector3();
  public radius: number = 0.25; // Doubled radius as requested (0.25 fit enough)
  public color: THREE.Color;
  public rotation: number = 0;
  
  public trail: PlanetTrail | null = null;
  private showTrail: boolean = false;
  
  constructor(color: number | string | THREE.Color, initialPosition?: THREE.Vector3, showTrail: boolean = false) {
    this.color = new THREE.Color(color);
    this.showTrail = showTrail;
    
    const geometry = new THREE.SphereGeometry(this.radius, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: this.color });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.renderOrder = 110; // Set higher than tiles (0) and trail (100)
    
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
  }

  /** Feed computed trail positions (Float64Array of XY pairs) to the trail renderer */
  setTrailPoints(xy: Float64Array): void {
    if (this.trail) this.trail.setPoints(xy);
  }

  render(scene: THREE.Scene): void {
    if (!scene.children.includes(this.mesh)) {
      scene.add(this.mesh);
    }
    if (this.trail && !scene.children.includes(this.trail.mesh)) {
      scene.add(this.trail.mesh);
    }
  }

  removeFromScene(scene: THREE.Scene): void {
    if (scene.children.includes(this.mesh)) {
      scene.remove(this.mesh);
    }
    if (this.trail && scene.children.includes(this.trail.mesh)) {
      scene.remove(this.trail.mesh);
    }
  }

  setRadius(r: number): void {
    this.radius = r;
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.SphereGeometry(r, 32, 32);
    if (this.trail) {
      this.trail.setPlanetRadius(r);
    }
  }

  public clearTrail(): void {
    if (this.trail) {
      this.trail.clear();
    }
  }

  moveTo(target: THREE.Vector3): void {
    this.position.copy(target);
    this.mesh.position.copy(target);
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(m => m.dispose());
      } else {
        (this.mesh.material as THREE.Material).dispose();
      }
    }
    if (this.trail) {
      this.trail.dispose();
    }
  }
}
