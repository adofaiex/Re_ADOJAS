import * as THREE from 'three';

export class PlanetTrail {
  public mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshBasicMaterial;
  private points: { pos: THREE.Vector3; time: number }[] = [];
  private maxPoints: number = 200; // Sensible max for a 0.4s trail
  private trailDuration: number = 0.4; // seconds
  private planetRadius: number;
  private segmentsPerPoint: number = 4; // Subdivisions for smooth curves

  constructor(color: THREE.Color, planetRadius: number) {
    this.planetRadius = planetRadius;
    this.geometry = new THREE.BufferGeometry();
    
    // Initial attributes for position - increased for smooth curves
    const maxVertices = this.maxPoints * this.segmentsPerPoint * 2;
    const positions = new Float32Array(maxVertices * 3);
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

  /**
   * Catmull-Rom spline interpolation for smooth curves
   */
  private catmullRom(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number): THREE.Vector3 {
    const t2 = t * t;
    const t3 = t2 * t;
    
    // Catmull-Rom coefficients
    const c0 = -0.5 * t3 + t2 - 0.5 * t;
    const c1 = 1.5 * t3 - 2.5 * t2 + 1;
    const c2 = -1.5 * t3 + 2 * t2 + 0.5 * t;
    const c3 = 0.5 * t3 - 0.5 * t2;
    
    return new THREE.Vector3(
      c0 * p0.x + c1 * p1.x + c2 * p2.x + c3 * p3.x,
      c0 * p0.y + c1 * p1.y + c2 * p2.y + c3 * p3.y,
      c0 * p0.z + c1 * p1.z + c2 * p2.z + c3 * p3.z
    );
  }

  /**
   * Calculate tangent at a point using Catmull-Rom derivative
   */
  private catmullRomTangent(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number): THREE.Vector3 {
    const t2 = t * t;
    
    // Derivative of Catmull-Rom spline
    const c0 = -1.5 * t2 + 2 * t - 0.5;
    const c1 = 4.5 * t2 - 5 * t;
    const c2 = -4.5 * t2 + 4 * t + 0.5;
    const c3 = 1.5 * t2 - t;
    
    return new THREE.Vector3(
      c0 * p0.x + c1 * p1.x + c2 * p2.x + c3 * p3.x,
      c0 * p0.y + c1 * p1.y + c2 * p2.y + c3 * p3.y,
      c0 * p0.z + c1 * p1.z + c2 * p2.z + c3 * p3.z
    ).normalize();
  }

  private updateGeometry(): void {
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    
    const count = this.points.length;
    const maxWidth = this.planetRadius * 2;
    
    const normal = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    
    let vertexIndex = 0;
    const indices: number[] = [];

    // Generate smooth curve points using Catmull-Rom spline
    for (let i = 0; i < count - 1; i++) {
      // Get control points for Catmull-Rom spline
      const p0 = this.points[Math.max(i - 1, 0)].pos;
      const p1_curr = this.points[i].pos;
      const p2_next = this.points[i + 1].pos;
      const p3 = this.points[Math.min(i + 2, count - 1)].pos;
      
      // Subdivide segment for smooth curve
      const segments = this.segmentsPerPoint;
      for (let j = 0; j < segments; j++) {
        const t1 = j / segments;
        const t2 = (j + 1) / segments;
        
        // Interpolate position and tangent
        const pos1 = this.catmullRom(p0, p1_curr, p2_next, p3, t1);
        const tangent1 = this.catmullRomTangent(p0, p1_curr, p2_next, p3, t1);
        
        const pos2 = this.catmullRom(p0, p1_curr, p2_next, p3, t2);
        const tangent2 = this.catmullRomTangent(p0, p1_curr, p2_next, p3, t2);
        
        // Calculate age factor for width (interpolated along segment)
        const globalT1 = (i + t1) / (count - 1);
        const globalT2 = (i + t2) / (count - 1);
        const width1 = maxWidth * globalT1;
        const width2 = maxWidth * globalT2;
        
        // Calculate normal (perpendicular to tangent in 2D XY plane)
        normal.set(-tangent1.y, tangent1.x, 0).normalize();
        if (normal.lengthSq() === 0) normal.set(0, 1, 0);
        
        // First point of segment
        p1.copy(pos1).addScaledVector(normal, width1 / 2);
        p2.copy(pos1).addScaledVector(normal, -width1 / 2);
        
        const idx1 = vertexIndex++;
        const idx2 = vertexIndex++;
        
        positions[idx1 * 3 + 0] = p1.x;
        positions[idx1 * 3 + 1] = p1.y;
        positions[idx1 * 3 + 2] = p1.z;
        
        positions[idx2 * 3 + 0] = p2.x;
        positions[idx2 * 3 + 1] = p2.y;
        positions[idx2 * 3 + 2] = p2.z;
        
        // Second point of segment
        normal.set(-tangent2.y, tangent2.x, 0).normalize();
        if (normal.lengthSq() === 0) normal.set(0, 1, 0);
        
        p1.copy(pos2).addScaledVector(normal, width2 / 2);
        p2.copy(pos2).addScaledVector(normal, -width2 / 2);
        
        const idx3 = vertexIndex++;
        const idx4 = vertexIndex++;
        
        positions[idx3 * 3 + 0] = p1.x;
        positions[idx3 * 3 + 1] = p1.y;
        positions[idx3 * 3 + 2] = p1.z;
        
        positions[idx4 * 3 + 0] = p2.x;
        positions[idx4 * 3 + 1] = p2.y;
        positions[idx4 * 3 + 2] = p2.z;
        
        // Create triangles for this quad
        indices.push(idx1, idx2, idx3);
        indices.push(idx2, idx4, idx3);
      }
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