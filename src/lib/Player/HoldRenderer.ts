import {
  Mesh, BufferGeometry, BufferAttribute, ShaderMaterial, DoubleSide,
  Scene, Texture, Color,
} from 'three';

/**
 * Hold 长按带（v2：真实轨迹）。
 * 官方带子 = 长按期间球的轨迹：从 entry（指向上一砖，半径 startDist）扫完整段扫角
 * （含 holdLength 圈），半径沿途插值到 exit（指向被 holdDistance 推远的下一砖，半径 endDist），
 * 因此是"螺旋 ribbon"而不是固定圆。
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
  vec3 col = base * mix(0.30, 1.0, filled);
  col = mix(col, col * uColor, 0.55 * filled);
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
  private startDist: number;
  private endDist: number;
  private startAngle: number;
  private totalAngle: number;
  private width: number;

  constructor(
    centerX: number, centerY: number,
    startDist: number, endDist: number,
    startAngle: number, totalAngle: number,
    width: number, texture: Texture,
  ) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.startDist = startDist;
    this.endDist = endDist;
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
        uOpacity: { value: 0.95 },
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

  /** 采样 t∈[0,1] 处轨迹点：角度线性扫过，半径 startDist→endDist 线性插值。 */
  private sample(t: number, out: { x: number; y: number }): void {
    const a = this.startAngle + this.totalAngle * t;
    const r = this.startDist + (this.endDist - this.startDist) * t;
    out.x = this.centerX + Math.cos(a) * r;
    out.y = this.centerY + Math.sin(a) * r;
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
