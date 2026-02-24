import * as THREE from 'three';

export class PlanetTrail {
  public mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshBasicMaterial;
  private points: { pos: THREE.Vector3; time: number }[] = [];
  private maxPoints: number = 200; // Sensible max for a 0.4s trail
  private trailDuration: number = 0.4; // seconds
  private planetRadius: number;

  constructor(color: THREE.Color, planetRadius: number) {
    this.planetRadius = planetRadius;
    this.geometry = new THREE.BufferGeometry();
    
    // Initial attributes for position
    const positions = new Float32Array(this.maxPoints * 3 * 2); // 2 points per segment (strip)
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    this.material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false; // Always visible
    this.mesh.renderOrder = 100; // High render order to be above tiles
  }

  public update(currentPos: THREE.Vector3, currentTime: number): void {
    // Add new point
    this.points.push({ pos: currentPos.clone(), time: currentTime });

    // Remove old points
    while (this.points.length > 0 && currentTime - this.points[0].time > this.trailDuration) {
      this.points.shift();
    }

    if (this.points.length < 2) {
      this.mesh.visible = false;
      return;
    }

    this.mesh.visible = true;
    this.updateGeometry();
  }

  private updateGeometry(): void {
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    
    const count = this.points.length;
    const maxWidth = this.planetRadius * 2;
    
    const tangent = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const p = this.points[i];
      const next = this.points[Math.min(i + 1, count - 1)];
      const prev = this.points[Math.max(i - 1, 0)];
      
      // Calculate tangent
      tangent.copy(next.pos).sub(prev.pos).normalize();
      if (tangent.lengthSq() === 0) tangent.set(1, 0, 0); // Fallback
      
      // Normal (perpendicular to tangent in 2D XY plane)
      normal.set(-tangent.y, tangent.x, 0).normalize();
      
      // Calculate width based on age (0 to 1)
      // i=count-1 is the head (at the planet), width = maxWidth
      const ageFactor = i / (count - 1);
      const width = maxWidth * ageFactor;
      
      // Extrude
      p1.copy(p.pos).addScaledVector(normal, width / 2);
      p2.copy(p.pos).addScaledVector(normal, -width / 2);
      
      positions[i * 6 + 0] = p1.x;
      positions[i * 6 + 1] = p1.y;
      positions[i * 6 + 2] = p1.z;
      
      positions[i * 6 + 3] = p2.x;
      positions[i * 6 + 4] = p2.y;
      positions[i * 6 + 5] = p2.z;
    }
    
    // Update indices for triangle strip
    const indices = [];
    for (let i = 0; i < count - 1; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
    
    this.geometry.setIndex(indices);
    posAttr.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  public clear(): void {
    this.points = [];
    if (this.mesh) {
      this.mesh.visible = false;
    }
  }
}
