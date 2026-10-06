import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, Scene, ShaderMaterial, Vector3 } from 'three';

/**
 * MultiPlanet 变多时砖上的多边形虚线指示器。
 *
 * 位置：以该砖的 formation 为准 —— 外接圆半径 r = tileSize/(2·sin(π/n))，
 * 圆心在 entry 角方向偏移 r，n 个顶点均布在圆上（其中一个顶点即砖心）。
 * 表现：闭合折线 + 周期性虚线（世界宽度条带），虚线沿折线方向持续流动；
 * 玩家到达该砖后淡出。
 */

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uDashSize;
uniform float uGapSize;
uniform float uDashOffset;
varying vec2 vUv;
void main() {
  float period = uDashSize + uGapSize;
  float d = mod(vUv.y - uDashOffset, period);
  float a = d < uDashSize ? 1.0 : 0.0;
  // 条带两侧柔化
  float edge = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));
  a *= edge;
  if (a <= 0.01) discard;
  gl_FragColor = vec4(uColor, uOpacity * a);
}
`;

export class MultiPlanetIndicator {
  public readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  /** 玩家到达该砖后的淡出起始时刻（null = 未开始淡出）。 */
  public fadeStart: number | null = null;

  constructor(points: { x: number; y: number }[], z: number = 0.45, width: number = 0.05) {
    const geometry = this.buildGeometry(points, z, width);
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uColor: { value: new Vector3(1, 1, 1) },
        uOpacity: { value: 1 },
        uDashSize: { value: 0.26 },
        uGapSize: { value: 0.2 },
        uDashOffset: { value: 0 },
      },
      transparent: true,
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 106; // 砖/长按带之上、行星之下
  }

  /** 沿折线生成等宽带条；UV.y = 累计弧长（虚线相位）。 */
  private buildGeometry(points: { x: number; y: number }[], z: number, width: number): BufferGeometry {
    const half = width / 2;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let dist = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i > 0) dist += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      let tx = next.x - prev.x;
      let ty = next.y - prev.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const nx = -ty;
      const ny = tx;
      pos.push(p.x - nx * half, p.y - ny * half, z);
      uv.push(0, dist);
      pos.push(p.x + nx * half, p.y + ny * half, z);
      uv.push(1, dist);
      if (i > 0) {
        const b = (i - 1) * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return geo;
  }

  /** 虚线沿折线方向流动。dashSpeed 单位：世界单位/秒。 */
  public update(timeSeconds: number, dashSpeed: number = 0.9): void {
    this.material.uniforms.uDashOffset.value = (timeSeconds * dashSpeed) % 1024;
  }

  public setOpacity(v: number): void {
    this.material.uniforms.uOpacity.value = Math.max(0, Math.min(1, v));
  }

  public setVisible(v: boolean): void {
    this.mesh.visible = v;
  }

  public render(scene: Scene): void {
    if (!scene.children.includes(this.mesh)) scene.add(this.mesh);
  }

  public removeFromScene(scene: Scene): void {
    if (scene.children.includes(this.mesh)) scene.remove(this.mesh);
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
