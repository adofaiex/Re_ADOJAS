import {
  BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial,
  PlaneGeometry, Scene, ShaderMaterial, Texture, Vector3,
} from 'three';

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
  /**
   * 多边形各顶点上的灰色占位星球（`markerPoints`）。
   * 每个顶点代表一颗行星；已有的实色行星不重复画，所以只补差额
   * （三角形 = 3 行星、已有 2 颗 → 只画 1 颗）。
   * 随多边形一起显隐/淡出。
   */
  private readonly markers: Mesh[] = [];
  private readonly markerMaterial: MeshBasicMaterial | null = null;
  /** 玩家到达该砖后的淡出起始时刻（null = 未开始淡出）。 */
  public fadeStart: number | null = null;

  constructor(
    points: { x: number; y: number }[],
    z: number = 0.45,
    width: number = 0.05,
    markerPoints: { x: number; y: number }[] = [],
    planetTexture?: Texture | null,
    markerRadius: number = 0.22,
  ) {
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

    // 顶点灰色占位球：与多边形同生命周期
    if (markerPoints.length > 0) {
      const geo = new PlaneGeometry(1, 1);
      this.markerMaterial = new MeshBasicMaterial({
        map: planetTexture ?? null,
        // 贴图本身已按灰色染色，color 必须留白 —— 再乘一次 0x808080 会二次压暗成近黑
        // （与 Planet 构造里 planetTex ? 0xffffff : color 同一套处理）。
        color: planetTexture ? 0xffffff : 0x808080,
        transparent: true,
        opacity: 1,
        side: DoubleSide,
        depthTest: false,
        depthWrite: false,
      });
      const s = markerRadius * 2;
      for (const p of markerPoints) {
        const m = new Mesh(geo, this.markerMaterial);
        m.scale.set(s, s, 1);
        m.position.set(p.x, p.y, z + 0.01);
        m.renderOrder = 107; // 与虚线同层，略靠上
        m.frustumCulled = false;
        this.markers.push(m);
      }
    }
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
    const o = Math.max(0, Math.min(1, v));
    this.material.uniforms.uOpacity.value = o * BASE_OPACITY;
    if (this.markerMaterial) this.markerMaterial.opacity = o;
  }

  public setVisible(v: boolean): void {
    this.mesh.visible = v;
    for (const m of this.markers) m.visible = v;
  }

  public render(scene: Scene): void {
    if (!scene.children.includes(this.mesh)) scene.add(this.mesh);
    for (const m of this.markers) if (!scene.children.includes(m)) scene.add(m);
  }

  public removeFromScene(scene: Scene): void {
    if (scene.children.includes(this.mesh)) scene.remove(this.mesh);
    for (const m of this.markers) if (scene.children.includes(m)) scene.remove(m);
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    // 占位球共用一份 geometry / material
    if (this.markers.length > 0) this.markers[0].geometry.dispose();
    this.markerMaterial?.dispose();
  }
}
