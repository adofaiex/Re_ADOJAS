import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, Scene, ShaderMaterial } from 'three';

/**
 * 行星虚线环：选中（枢轴）星球周围的旋转虚线圆环。
 *
 * 几何：一圈细带；片段着色器按角度切 24 段虚线（每格 60% 线 / 40% 间隔），
 * 随半径整体缩放 → 虚线数量恒定、线宽同步缩放。
 * 表现：选中时 0.1s 线性放大到 1，失去选中缩回 0；30°/s 旋转，方向随当前砖的旋转方向。
 */

const VERT = `
attribute float angle;
varying float vAngle;
varying vec2 vPos;
void main() {
  vAngle = angle;
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uDashes;
uniform float uDashFraction;
uniform float uInner;
uniform float uOuter;
varying float vAngle;
varying vec2 vPos;
void main() {
  // 角度相位切虚线（uDashes 为整数 → 接缝处相位连续）
  float cell = (vAngle / 6.283185307179586) * uDashes;
  float t = fract(cell);
  float w = clamp(fwidth(cell) * 1.5, 1e-4, 0.5);
  float a = smoothstep(0.0, w, t) * (1.0 - smoothstep(uDashFraction - w, uDashFraction, t));
  // 圆环内/外缘抗锯齿
  float r = length(vPos);
  float dr = fwidth(r);
  a *= smoothstep(uInner - dr, uInner + dr, r) * (1.0 - smoothstep(uOuter - dr, uOuter + dr, r));
  if (a <= 0.01) discard;
  gl_FragColor = vec4(uColor, uOpacity * a);
}
`;

const SEGMENTS = 192;           // 圆环细分
const DASHES = 24;              // 虚线数量
const DASH_FRACTION = 0.6;      // 每格实线占比
const BAND_WIDTH = 0.03;        // 线宽 / 环半径（细线）
const OPACITY = 0.6;            // 整体不透明度
const SCALE_TWEEN = 0.1;        // 选中缩放过渡时长（秒）
const SPIN_DEG_PER_SEC = 30;    // 旋转速度（度/秒）
/** radiusScale = 1 时的环半径（世界单位）= 星球轨道半径。 */
const RING_RADIUS = 1.0;

export class PlanetRing {
  public readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  /** 选中缩放 0..1（0.1s 线性过渡）。 */
  private scalePercent = 0;

  constructor(color: number, z: number = 1.0) {
    const inner = 1 - BAND_WIDTH;
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uColor: { value: new Color(color) },
        uOpacity: { value: OPACITY },
        uDashes: { value: DASHES },
        uDashFraction: { value: DASH_FRACTION },
        uInner: { value: inner },
        uOuter: { value: 1 },
      },
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
    });
    this.mesh = new Mesh(PlanetRing.buildGeometry(inner), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 99; // 拖尾（100）之下、砖块之上
    this.mesh.position.z = z;
    this.mesh.visible = false;
  }

  /** 一圈细带（外径 1，inner 为内径比例）；angle 属性保证虚线相位在接缝处连续。 */
  private static buildGeometry(inner: number): BufferGeometry {
    const pos: number[] = [];
    const ang: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pos.push(c * inner, s * inner, 0, c, s, 0);
      ang.push(a, a);
      if (i > 0) {
        const b = (i - 1) * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('angle', new BufferAttribute(new Float32Array(ang), 1));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return geo;
  }

  /**
   * 每帧更新。
   * dt = 帧间隔（秒）；spinTime = 累计时间（秒）；chosen = 是否为当前枢轴星；
   * radiusScale = 所在砖的轨道半径比例；dirSign = ±1 旋转方向。
   */
  public update(dt: number, spinTime: number, chosen: boolean, radiusScale: number, dirSign: number): void {
    const target = chosen ? 1 : 0;
    if (this.scalePercent !== target) {
      const step = dt / SCALE_TWEEN;
      this.scalePercent = target > this.scalePercent
        ? Math.min(target, this.scalePercent + step)
        : Math.max(target, this.scalePercent - step);
    }
    const visible = this.scalePercent > 0.001;
    this.mesh.visible = visible;
    if (!visible) return;
    const radius = RING_RADIUS * radiusScale * this.scalePercent;
    this.mesh.scale.set(radius, radius, 1);
    this.mesh.rotation.z = dirSign * (SPIN_DEG_PER_SEC * Math.PI / 180) * spinTime;
  }

  public setColor(color: number): void {
    (this.material.uniforms.uColor.value as Color).set(color);
  }

  /** 立即隐藏并复位缩放（行星失活 / 关闭显示）。 */
  public setVisible(visible: boolean): void {
    if (!visible) {
      this.scalePercent = 0;
      this.mesh.visible = false;
    }
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
