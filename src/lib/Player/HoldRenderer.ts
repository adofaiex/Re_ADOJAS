import {
  Mesh, BufferGeometry, BufferAttribute, ShaderMaterial, DoubleSide,
  Scene, Texture, Color,
} from 'three';

/**
 * Hold 长按带（v3：官方几何）。
 * 官方带子 = 长按期间球的真实轨迹：球以**恒定半径 r**（tileSize×radiusScale）绕一个
 * **平移的圆心**旋转——圆心从 Hold 砖位置线性漂移到 `下一砖位置 − r·exitDir`
 * （即 targetPosition = nextfloor.startPos − tileSize·radiusScale·ClockwiseAngleToVector(exitangle)），
 * 同时球的角度从 entry 扫完整个扫角（含 holdLength 整圈）。结果是一串等大的环
 * 沿路径平移（弹簧/次摆线），而不是固定圆心的渐大螺旋。
 *  - 每块 Hold 砖一次性建 mesh；进度只改 uniform uCompletion（不做官方式全量重画）。
 *  - UV.x 带宽方向（贴图中央白线 = 路径核心线），UV.y 沿路径（彩虹）。
 */

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
uniform sampler2D uMap;
uniform float uCompletion;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec4 tex = texture2D(uMap, vUv);
  float filled = vUv.y <= uCompletion ? 1.0 : 0.0;
  vec3 base = tex.rgb;
  // 未填充部分也保持鲜艳彩虹（不压暗太多）；完成部分更亮、轻微带球色。
  vec3 col = base * mix(0.55, 1.15, filled);
  col = mix(col, col * uColor, 0.35 * filled);
  // 中央白线高亮：沿带宽方向的高亮核（完成度越高越亮）
  float core = smoothstep(0.4, 0.0, abs(vUv.x - 0.5));
  col = mix(col, vec3(1.0), core * mix(0.25, 0.5, filled));
  float a = tex.a * uOpacity;
  if (a <= 0.003) discard;
  gl_FragColor = vec4(col, a);
}
`;

export class HoldRenderer {
  public mesh: Mesh;
  private geometry: BufferGeometry;
  private material: ShaderMaterial;
  private centerX: number;
  private centerY: number;
  private endCenterX: number;
  private endCenterY: number;
  private startRadius: number;
  private endRadius: number;
  private startAngle: number;
  private totalAngle: number;
  private width: number;

  constructor(
    centerX: number, centerY: number,
    endCenterX: number, endCenterY: number,
    startRadius: number, endRadius: number,
    startAngle: number, totalAngle: number,
    width: number, texture: Texture,
  ) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.endCenterX = endCenterX;
    this.endCenterY = endCenterY;
    this.startRadius = startRadius;
    this.endRadius = endRadius;
    this.startAngle = startAngle;
    this.totalAngle = totalAngle;
    this.width = width;

    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uMap: { value: texture },
        uCompletion: { value: 0 },
        uColor: { value: new Color(0xffffff) },
        uOpacity: { value: 1.0 },
      },
      transparent: true,
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    this.geometry = this.buildGeometry();
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 105; // 砖之上、行星(110)之下
  }

  /** 采样 t∈[0,1]：圆心线性平移，半径 startRadius→endRadius，角度线性扫过（含整圈）。 */
  private sample(t: number, out: { x: number; y: number }): void {
    const a = this.startAngle + this.totalAngle * t;
    const cx = this.centerX + (this.endCenterX - this.centerX) * t;
    const cy = this.centerY + (this.endCenterY - this.centerY) * t;
    const r = this.startRadius + (this.endRadius - this.startRadius) * t;
    out.x = cx + Math.cos(a) * r;
    out.y = cy + Math.sin(a) * r;
  }

  private buildGeometry(): BufferGeometry {
    const absTotal = Math.abs(this.totalAngle);
    const segs = Math.max(24, Math.min(512, Math.ceil(absTotal / 0.08)));
    const half = this.width / 2;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const p0 = { x: 0, y: 0 };
    const pA = { x: 0, y: 0 };
    const pB = { x: 0, y: 0 };

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      this.sample(t, p0);
      this.sample(Math.max(0, t - 1 / 512), pA);
      this.sample(Math.min(1, t + 1 / 512), pB);
      let tx = pB.x - pA.x;
      let ty = pB.y - pA.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const nx = -ty;
      const ny = tx;
      pos.push(p0.x - nx * half, p0.y - ny * half, 0.5);
      uv.push(0, t);
      pos.push(p0.x + nx * half, p0.y + ny * half, 0.5);
      uv.push(1, t);
      if (s > 0) {
        const b = (s - 1) * 2;
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

  /** 完成度 0..1（官方 holdCompletionEased 的等价物）。 */
  setCompletion(v: number): void {
    this.material.uniforms.uCompletion.value = Math.max(0, Math.min(1, v));
  }

  /** 完成部分的主色（通常取移动球的颜色）。 */
  setColor(color: Color): void {
    (this.material.uniforms.uColor.value as Color).copy(color);
  }

  setVisible(v: boolean): void {
    this.mesh.visible = v;
  }

  render(scene: Scene): void {
    if (!scene.children.includes(this.mesh)) scene.add(this.mesh);
  }

  removeFromScene(scene: Scene): void {
    if (scene.children.includes(this.mesh)) scene.remove(this.mesh);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
