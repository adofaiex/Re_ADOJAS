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
    
    if (initialPosition) {
      this.position.copy(initialPosition);
      this.mesh.position.copy(initialPosition);
    }

    if (this.showTrail) {
      this.trail = new PlanetTrail(this.color, this.radius);
    }
  }

  update(deltaTime: number, currentTime: number = 0): void {
    // Sync mesh position with logical position
    this.mesh.position.copy(this.position);
    
    if (this.trail) {
      this.trail.update(this.position, currentTime);
    }
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
