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

/** 虚线基础不透明度（官方线色 alpha = 0.5）：淡出在此之上再乘 0..1 的系数。 */
const BASE_OPACITY = 0.5;

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
        uOpacity: { value: BASE_OPACITY },
        uDashSize: { value: 0.13 },
        uGapSize: { value: 0.1 },
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

  /** 沿折线生成等宽带条（miter 拐角，线宽一致）；UV.y = 累计弧长（虚线相位）。 */
  private buildGeometry(points: { x: number; y: number }[], z: number, width: number): BufferGeometry {
    // points 为闭合环（末点 = 首点）：取不重复点集，按环取邻居
    const n = points.length > 1 ? points.length - 1 : points.length;
    const half = width / 2;
    const miterLimit = 2.5; // 尖角上限（半宽倍数），防止极端长刺
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let dist = 0;
    for (let i = 0; i <= n; i++) {
      const p = points[i % n];
      const prev = points[(i - 1 + n) % n];
      const next = points[(i + 1) % n];
      // 进入/离开方向 → 左右法线 → miter 方向
      let ix = p.x - prev.x, iy = p.y - prev.y;
      let ox = next.x - p.x, oy = next.y - p.y;
      const il = Math.hypot(ix, iy) || 1; ix /= il; iy /= il;
      const ol = Math.hypot(ox, oy) || 1; ox /= ol; oy /= ol;
      const nix = -iy, niy = ix;
      const nox = -oy, noy = ox;
      let mx = nix + nox, my = niy + noy;
      const ml = Math.hypot(mx, my);
      let miter = 1;
      if (ml < 1e-6) {
        mx = nix; my = niy; // 180° 反向：退化，直接用进入法线
      } else {
        mx /= ml; my /= ml;
        const cosHalf = mx * nix + my * niy;
        miter = Math.min(1 / Math.max(cosHalf, 1e-4), miterLimit);
      }
      if (i > 0) dist += Math.hypot(p.x - prev.x, p.y - prev.y);
      const wx = mx * half * miter;
      const wy = my * half * miter;
      pos.push(p.x - wx, p.y - wy, z);
      uv.push(0, dist);
      pos.push(p.x + wx, p.y + wy, z);
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
  public update(timeSeconds: number, dashSpeed: number = 0.45): void {
    this.material.uniforms.uDashOffset.value = (timeSeconds * dashSpeed) % 1024;
  }

  public setOpacity(v: number): void {
    this.material.uniforms.uOpacity.value = Math.max(0, Math.min(1, v)) * BASE_OPACITY;
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
