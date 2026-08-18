import {
  InstancedMesh, Object3D, PlaneGeometry, ShaderMaterial, DoubleSide,
  DynamicDrawUsage, InstancedBufferAttribute, Texture, Color, Blending,
  AdditiveBlending, MultiplyBlending, CustomBlending, Matrix4, Group,
} from 'three';

const decoVert = /* glsl */`
attribute vec3 iColor;
attribute float iOpacity;

varying vec2 vUv;
varying vec3 vColor;
varying float vOpacity;

void main() {
  vUv = uv;
  vColor = iColor;
  vOpacity = iOpacity;
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const decoFrag = /* glsl */`
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vColor;
varying float vOpacity;

void main() {
  vec4 tex = texture2D(uMap, vUv);
  float a = tex.a * vOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(tex.rgb * vColor, a);
}
`;

export interface DecoInstanceSlot {
  batchKey: string;
  index: number;
  baseW: number;
  baseH: number;
  pivotX: number;
  pivotY: number;
  /** renderOrder this slot was allocated with (from DecorationInstance.depthZ()) */
  renderOrder: number;
  tex: Texture;
  blending: Blending;
}

interface Batch {
  key: string;
  mesh: InstancedMesh;
  dummy: Object3D;
  max: number;
  count: number;
  free: number[];
  colorAttr: InstancedBufferAttribute;
  opacityAttr: InstancedBufferAttribute;
  dirtyMatrix: boolean;
  dirtyColor: boolean;
  renderOrder: number;
}

function blendKey(blending: Blending): string {
  if (blending === AdditiveBlending) return 'add';
  if (blending === MultiplyBlending) return 'mul';
  if (blending === CustomBlending) return 'custom';
  return 'normal';
}

/**
 * GPU-instanced renderer for Image/Text decorations.
 * Batch key = texture + blendMode + renderOrder
 * so layering matches per-sprite renderOrder from the original path.
 */
export class DecorationInstancedRenderer {
  private parent: Group;
  private batches: Map<string, Batch> = new Map();

  constructor(parent: Group) {
    this.parent = parent;
  }

  private makeKey(tex: Texture, blending: Blending, renderOrder: number): string {
    return `${tex.uuid}|${blendKey(blending)}|${renderOrder}`;
  }

  private createBatch(key: string, tex: Texture, blending: Blending, renderOrder: number, capacity: number): Batch {
    const mat = new ShaderMaterial({
      uniforms: { uMap: { value: tex } },
      vertexShader: decoVert,
      fragmentShader: decoFrag,
      transparent: true,
      depthWrite: true,
      depthTest: true,
      side: DoubleSide,
      blending,
    });

    const geo = new PlaneGeometry(1, 1);
    const mesh = new InstancedMesh(geo, mat, capacity);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    // Match DecorationInstance depthZ(): renderOrder for this depth.
    // depthWrite=true so decorations occlude each other via the depth buffer
    // (tiles also write depth at z=0; Bg is z<0 behind, Default is z>0 in front).
    mesh.renderOrder = renderOrder;

    const colorAttr = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    const opacityAttr = new InstancedBufferAttribute(new Float32Array(capacity), 1);
    colorAttr.setUsage(DynamicDrawUsage);
    opacityAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute('iColor', colorAttr);
    geo.setAttribute('iOpacity', opacityAttr);

    const dummy = new Object3D();
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    for (let i = 0; i < capacity; i++) {
      mesh.setMatrixAt(i, dummy.matrix);
      colorAttr.setXYZ(i, 1, 1, 1);
      opacityAttr.setX(i, 0);
    }
    mesh.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;
    opacityAttr.needsUpdate = true;

    this.parent.add(mesh);

    const batch: Batch = {
      key,
      mesh,
      dummy,
      max: capacity,
      count: 0,
      free: [],
      colorAttr,
      opacityAttr,
      dirtyMatrix: false,
      dirtyColor: false,
      renderOrder,
    };
    this.batches.set(key, batch);
    return batch;
  }

  private expand(batch: Batch): Batch {
    const newMax = batch.max * 2;
    const oldMesh = batch.mesh;
    const mat = oldMesh.material as ShaderMaterial;
    const tex = mat.uniforms.uMap.value as Texture;
    const blending = mat.blending;
    const ro = batch.renderOrder;
    const oldCount = batch.count;
    const oldMax = batch.max;
    const oldFree = batch.free.slice();

    const matrices: Matrix4[] = [];
    const colors = new Float32Array(oldMax * 3);
    const opacities = new Float32Array(oldMax);
    for (let i = 0; i < oldMax; i++) {
      const m = new Matrix4();
      oldMesh.getMatrixAt(i, m);
      matrices.push(m);
      colors[i * 3] = batch.colorAttr.getX(i);
      colors[i * 3 + 1] = batch.colorAttr.getY(i);
      colors[i * 3 + 2] = batch.colorAttr.getZ(i);
      opacities[i] = batch.opacityAttr.getX(i);
    }

    this.parent.remove(oldMesh);
    mat.dispose();
    oldMesh.geometry.dispose();
    this.batches.delete(batch.key);

    const nb = this.createBatch(batch.key, tex, blending, ro, newMax);
    nb.count = oldCount;
    nb.mesh.count = oldCount;
    nb.free = oldFree;

    for (let i = 0; i < oldMax; i++) {
      nb.mesh.setMatrixAt(i, matrices[i]);
      nb.colorAttr.setXYZ(i, colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
      nb.opacityAttr.setX(i, opacities[i]);
    }
    nb.mesh.instanceMatrix.needsUpdate = true;
    nb.colorAttr.needsUpdate = true;
    nb.opacityAttr.needsUpdate = true;
    return nb;
  }

  public alloc(
    tex: Texture,
    blending: Blending,
    renderOrder: number,
    baseW: number,
    baseH: number,
    pivotX: number,
    pivotY: number,
  ): DecoInstanceSlot {
    const key = this.makeKey(tex, blending, renderOrder);
    let batch = this.batches.get(key);
    if (!batch) batch = this.createBatch(key, tex, blending, renderOrder, 16);

    let index: number;
    if (batch.free.length > 0) {
      index = batch.free.pop()!;
    } else {
      if (batch.count >= batch.max) batch = this.expand(batch);
      index = batch.count++;
      batch.mesh.count = batch.count;
    }

    return {
      batchKey: key,
      index,
      baseW,
      baseH,
      pivotX,
      pivotY,
      renderOrder,
      tex,
      blending,
    };
  }

  public free(slot: DecoInstanceSlot): void {
    const batch = this.batches.get(slot.batchKey);
    if (!batch) return;
    const d = batch.dummy;
    d.position.set(0, 0, 0);
    d.rotation.set(0, 0, 0);
    d.scale.set(0, 0, 0);
    d.updateMatrix();
    batch.mesh.setMatrixAt(slot.index, d.matrix);
    batch.opacityAttr.setX(slot.index, 0);
    batch.dirtyMatrix = true;
    batch.dirtyColor = true;
    batch.free.push(slot.index);
  }

  /**
   * If depth/renderOrder changed, migrate slot to the correct batch.
   * Returns the (possibly new) slot.
   */
  public ensureLayer(slot: DecoInstanceSlot, renderOrder: number): DecoInstanceSlot {
    if (slot.renderOrder === renderOrder) return slot;
    const { tex, blending, baseW, baseH, pivotX, pivotY } = slot;
    this.free(slot);
    return this.alloc(tex, blending, renderOrder, baseW, baseH, pivotX, pivotY);
  }

  public write(
    slot: DecoInstanceSlot,
    x: number, y: number, z: number,
    rotRad: number,
    scaleX: number, scaleY: number,
    color: Color,
    opacity: number,
    visible: boolean,
  ): void {
    const batch = this.batches.get(slot.batchKey);
    if (!batch) return;

    const d = batch.dummy;
    if (!visible || opacity <= 0.001) {
      d.position.set(0, 0, 0);
      d.scale.set(0, 0, 0);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      batch.mesh.setMatrixAt(slot.index, d.matrix);
      batch.opacityAttr.setX(slot.index, 0);
      batch.dirtyMatrix = true;
      batch.dirtyColor = true;
      return;
    }

    const sx = slot.baseW * scaleX;
    const sy = slot.baseH * scaleY;
    const px = slot.pivotX * scaleX;
    const py = slot.pivotY * scaleY;
    const c = Math.cos(rotRad);
    const s = Math.sin(rotRad);
    const ox = c * px - s * py;
    const oy = s * px + c * py;

    d.position.set(x + ox, y + oy, z);
    d.rotation.set(0, 0, rotRad);
    d.scale.set(sx, sy, 1);
    d.updateMatrix();
    batch.mesh.setMatrixAt(slot.index, d.matrix);

    batch.colorAttr.setXYZ(slot.index, color.r, color.g, color.b);
    batch.opacityAttr.setX(slot.index, opacity);

    batch.dirtyMatrix = true;
    batch.dirtyColor = true;
  }

  public updatePivot(slot: DecoInstanceSlot, pivotX: number, pivotY: number): void {
    slot.pivotX = pivotX;
    slot.pivotY = pivotY;
  }

  public flush(): void {
    for (const batch of this.batches.values()) {
      if (batch.dirtyMatrix) {
        batch.mesh.instanceMatrix.needsUpdate = true;
        batch.dirtyMatrix = false;
      }
      if (batch.dirtyColor) {
        batch.colorAttr.needsUpdate = true;
        batch.opacityAttr.needsUpdate = true;
        batch.dirtyColor = false;
      }
    }
  }

  public clear(): void {
    for (const batch of this.batches.values()) {
      this.parent.remove(batch.mesh);
      (batch.mesh.material as ShaderMaterial).dispose();
      batch.mesh.geometry.dispose();
    }
    this.batches.clear();
  }

  public dispose(): void {
    this.clear();
  }
}
