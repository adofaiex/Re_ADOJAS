import {
  Mesh, BufferGeometry, BufferAttribute, ShaderMaterial, DoubleSide,
  Scene, Texture, Color,
} from 'three';

/**
 * Hold 长按带（v1）：
 *  - 每块 Hold 砖只建 **一个** ribbon mesh（沿枢轴圆周的条带，半径 = tileSize×radiusScale，
 *    角度从 entry 扫到 entry+总扫角），UV.x = 带宽方向（贴图中央白线 = 路径核心线），
 *    UV.y = 沿路径（彩虹贴图沿长度）。
 *  - 未完成/已完成通过 uniform `uCompletion` 分离，逐帧只改 uniform，不重建几何
 *    （官方 drawHold 重开全谱重画的做法这里刻意避开）。
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
  // 未完成部分压暗；完成部分用球色轻微染色（白线保持白）
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
  private radius: number;
  private startAngle: number;
  private totalAngle: number;
  private width: number;

  constructor(
    centerX: number, centerY: number,
    radius: number, startAngle: number, totalAngle: number,
    width: number, texture: Texture,
  ) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.radius = radius;
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

  private buildGeometry(): BufferGeometry {
    const absTotal = Math.abs(this.totalAngle);
    const segs = Math.max(8, Math.min(256, Math.ceil(absTotal / 0.12)));
    const dir = this.totalAngle >= 0 ? 1 : -1;
    const half = this.width / 2;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const cx = this.centerX;
    const cy = this.centerY;
    const r = this.radius;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const a = this.startAngle + this.totalAngle * t;
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      const px = cx + nx * r;
      const py = cy + ny * r;
      // 内外两条边（带宽方向 = 半径方向）
      pos.push(px - nx * half, py - ny * half, 0.5);
      uv.push(0, t);
      pos.push(px + nx * half, py + ny * half, 0.5);
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
    void dir;
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
