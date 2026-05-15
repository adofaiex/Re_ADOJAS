import * as THREE from 'three';

export class PlanetTrail {
  public mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshBasicMaterial;
  private maxPoints: number = 200;
  private planetRadius: number;
  private segmentsPerPoint: number = 4;

  constructor(color: THREE.Color, planetRadius: number) {
    this.planetRadius = planetRadius;
    this.geometry = new THREE.BufferGeometry();

    const maxVertices = this.maxPoints * this.segmentsPerPoint * 2;
    const positions = new Float32Array(maxVertices * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 100;
  }

  /**
   * Set trail points from a flat Float64Array of XY coordinates: [x0, y0, x1, y1, ...]
   * Builds a smooth Catmull-Rom ribbon mesh from these points.
   */
  setPoints(xy: Float64Array): void {
    const n = xy.length >> 1; // number of points
    if (n < 2) { this.mesh.visible = false; return; }

    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      pts.push(new THREE.Vector3(xy[i * 2], xy[i * 2 + 1], 0));
    }
    this.buildMesh(pts);
    this.mesh.visible = true;
  }

  setPlanetRadius(radius: number): void { this.planetRadius = radius; }

  private buildMesh(pts: THREE.Vector3[]): void {
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;

    const count = pts.length;
    const maxWidth = this.planetRadius * 2;
    const normal = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();

    let vertexIndex = 0;
    const indices: number[] = [];

    for (let i = 0; i < count - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1_curr = pts[i];
      const p2_next = pts[i + 1];
      const p3 = pts[Math.min(i + 2, count - 1)];

      const segments = this.segmentsPerPoint;
      for (let j = 0; j < segments; j++) {
        const t1 = j / segments;
        const t2 = (j + 1) / segments;

        const pos1 = this.catmullRom(p0, p1_curr, p2_next, p3, t1);
        const tangent1 = this.catmullRomTangent(p0, p1_curr, p2_next, p3, t1);

        const pos2 = this.catmullRom(p0, p1_curr, p2_next, p3, t2);
        const tangent2 = this.catmullRomTangent(p0, p1_curr, p2_next, p3, t2);

        const globalT1 = (i + t1) / (count - 1);
        const globalT2 = (i + t2) / (count - 1);
        const width1 = maxWidth * globalT1;
        const width2 = maxWidth * globalT2;

        normal.set(-tangent1.y, tangent1.x, 0).normalize();
        if (normal.lengthSq() === 0) normal.set(0, 1, 0);

        p1.copy(pos1).addScaledVector(normal, width1 / 2);
        p2.copy(pos1).addScaledVector(normal, -width1 / 2);

        const idx1 = vertexIndex++;
        const idx2 = vertexIndex++;

        positions[idx1 * 3] = p1.x;
        positions[idx1 * 3 + 1] = p1.y;
        positions[idx1 * 3 + 2] = p1.z;

        positions[idx2 * 3] = p2.x;
        positions[idx2 * 3 + 1] = p2.y;
        positions[idx2 * 3 + 2] = p2.z;

        normal.set(-tangent2.y, tangent2.x, 0).normalize();
        if (normal.lengthSq() === 0) normal.set(0, 1, 0);

        p1.copy(pos2).addScaledVector(normal, width2 / 2);
        p2.copy(pos2).addScaledVector(normal, -width2 / 2);

        const idx3 = vertexIndex++;
        const idx4 = vertexIndex++;

        positions[idx3 * 3] = p1.x;
        positions[idx3 * 3 + 1] = p1.y;
        positions[idx3 * 3 + 2] = p1.z;

        positions[idx4 * 3] = p2.x;
        positions[idx4 * 3 + 1] = p2.y;
        positions[idx4 * 3 + 2] = p2.z;

        indices.push(idx1, idx2, idx3);
        indices.push(idx2, idx4, idx3);
      }
    }

    this.geometry.setIndex(indices);
    posAttr.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  private catmullRom(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number): THREE.Vector3 {
    const t2 = t * t;
    const t3 = t2 * t;
    return new THREE.Vector3(
      (-0.5 * t3 + t2 - 0.5 * t) * p0.x + (1.5 * t3 - 2.5 * t2 + 1) * p1.x + (-1.5 * t3 + 2 * t2 + 0.5 * t) * p2.x + (0.5 * t3 - 0.5 * t2) * p3.x,
      (-0.5 * t3 + t2 - 0.5 * t) * p0.y + (1.5 * t3 - 2.5 * t2 + 1) * p1.y + (-1.5 * t3 + 2 * t2 + 0.5 * t) * p2.y + (0.5 * t3 - 0.5 * t2) * p3.y,
      (-0.5 * t3 + t2 - 0.5 * t) * p0.z + (1.5 * t3 - 2.5 * t2 + 1) * p1.z + (-1.5 * t3 + 2 * t2 + 0.5 * t) * p2.z + (0.5 * t3 - 0.5 * t2) * p3.z,
    );
  }

  private catmullRomTangent(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number): THREE.Vector3 {
    const t2 = t * t;
    return new THREE.Vector3(
      (-1.5 * t2 + 2 * t - 0.5) * p0.x + (4.5 * t2 - 5 * t) * p1.x + (-4.5 * t2 + 4 * t + 0.5) * p2.x + (1.5 * t2 - t) * p3.x,
      (-1.5 * t2 + 2 * t - 0.5) * p0.y + (4.5 * t2 - 5 * t) * p1.y + (-4.5 * t2 + 4 * t + 0.5) * p2.y + (1.5 * t2 - t) * p3.y,
      (-1.5 * t2 + 2 * t - 0.5) * p0.z + (4.5 * t2 - 5 * t) * p1.z + (-4.5 * t2 + 4 * t + 0.5) * p2.z + (1.5 * t2 - t) * p3.z,
    ).normalize();
  }

  dispose(): void { this.geometry.dispose(); this.material.dispose(); }

  clear(): void { this.mesh.visible = false; }
}
