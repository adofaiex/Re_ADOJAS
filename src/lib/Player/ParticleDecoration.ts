import {
  AdditiveBlending,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Texture,
} from 'three'

export interface ParticleGradientKey { time: number; alpha: number }
export interface ParticleColorKey { time: number; color: string }
export interface ParticleGradient { mode: string; alphaKeys: ParticleGradientKey[]; colorKeys: ParticleColorKey[] }
export interface ParticleColorConfig { color1?: string; gradient1?: ParticleGradient; mode?: string }
export interface ParticleConfig {
  decorationImage: string
  scale: [number, number]
  shapeType: string
  shapeRadius: number
  arc: number
  arcMode: string
  emissionRate: [number, number]
  particleLifetime: [number, number]
  particleSize: [number, number]
  velocity: [[number, number], [number, number]]
  velocityLimitOverLifetime: [number, number]
  sizeOverLifetime: [number, number]
  colorOverLifetime: ParticleColorConfig
  startRotation: [number, number]
  rotationOverTime: [number, number]
  randomTextureTiling: [number, number]
  maxParticles: number
  loop: boolean
  playDuration: number
  simulationSpeed: number
  randomSeed: number
  autoPlay: boolean
  simulationSpace: string
  tileSize: number
  camScaleMultiplier: number
}

interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; size: number; endSize: number
  drag: number; rot: number; rotSpeed: number; frame: number
  worldSpace: boolean
}

class SeededRandom {
  private state: number
  constructor(seed: number) { this.state = (seed >>> 0) || 0x6d2b79f5 }
  reset(seed: number): void { this.state = (seed >>> 0) || 0x6d2b79f5 }
  next(): number {
    let t = this.state += 0x6d2b79f5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  range(a: number, b: number): number { return a + this.next() * (b - a) }
}

function setHexColor(value: string | undefined, out: Color): void {
  const raw = String(value || 'ffffff').replace(/^#/, '').slice(0, 6).padEnd(6, 'f')
  out.setRGB(parseInt(raw.slice(0, 2), 16) / 255, parseInt(raw.slice(2, 4), 16) / 255, parseInt(raw.slice(4, 6), 16) / 255)
}

export class ParticleDecorationSystem {
  private particles: Particle[] = []
  private pool: Particle[] = []
  private emitAccum = 0
  private durationTimer = 0
  private started = false
  private simulationTime = 0
  private rng: SeededRandom
  private mesh: InstancedMesh | null = null
  private capacity = 0
  private dummy = new Object3D()
  private matrix = new Matrix4()
  private baseColor = new Color(0xffffff)
  private sampledColor = new Color()
  private colorKeys: { time: number; color: Color }[] = []
  private alphaKeys: { time: number; alpha: number }[] = []
  private readonly parent: Object3D
  private readonly cfg: ParticleConfig
  private readonly texture: Texture
  private readonly cols: number
  private readonly rows: number
  private readonly quadW: number
  private readonly quadH: number
  private visible = true

  constructor(parent: Object3D, cfg: ParticleConfig, texture: Texture) {
    this.parent = parent
    this.cfg = cfg
    this.texture = texture
    this.rng = new SeededRandom(cfg.randomSeed)
    this.cols = Math.max(1, Math.round(cfg.randomTextureTiling[0]) || 1)
    this.rows = Math.max(1, Math.round(cfg.randomTextureTiling[1]) || 1)
    const image = texture.image as { width?: number; height?: number } | undefined
    this.quadW = ((image?.width || 100) / this.cols) / 100
    this.quadH = ((image?.height || 100) / this.rows) / 100
    this.parseGradient()
    this.buildMesh(Math.min(256, Math.max(1, cfg.maxParticles)))
  }

  private parseGradient(): void {
    const source = this.cfg.colorOverLifetime || {}
    const gradient = source.gradient1
    setHexColor(source.color1, this.baseColor)
    this.colorKeys = (gradient?.colorKeys || []).map((key) => {
      const color = new Color(); setHexColor(key.color, color)
      return { time: key.time, color }
    }).sort((a, b) => a.time - b.time)
    this.alphaKeys = [...(gradient?.alphaKeys || [])].sort((a, b) => a.time - b.time)
    if (!this.colorKeys.length) this.colorKeys.push({ time: 0, color: this.baseColor.clone() })
    if (!this.alphaKeys.length) this.alphaKeys.push({ time: 0, alpha: 1 }, { time: 1, alpha: 1 })
  }

  private buildMesh(capacity: number): void {
    this.capacity = Math.max(1, Math.min(capacity, Math.min(this.cfg.maxParticles || 1000, 8192)))
    const geometry = new PlaneGeometry(this.quadW, this.quadH)
    geometry.setAttribute('aColor', new InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3))
    geometry.setAttribute('aAlpha', new InstancedBufferAttribute(new Float32Array(this.capacity), 1))
    geometry.setAttribute('aFrame', new InstancedBufferAttribute(new Float32Array(this.capacity), 1))
    const material = new ShaderMaterial({
      uniforms: { uMap: { value: this.texture }, uGrid: { value: [this.cols, this.rows] } },
      vertexShader: `
        attribute vec3 aColor; attribute float aAlpha; attribute float aFrame;
        uniform vec2 uGrid; varying vec2 vUv; varying vec3 vColor; varying float vAlpha;
        void main(){
          float col=mod(aFrame,uGrid.x); float row=floor(aFrame/uGrid.x);
          vUv=(uv+vec2(col,uGrid.y-1.0-row))/uGrid; vColor=aColor; vAlpha=aAlpha;
          gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uMap; varying vec2 vUv; varying vec3 vColor; varying float vAlpha;
        void main(){ vec4 t=texture2D(uMap,vUv); float a=t.a*vAlpha; if(a<0.004) discard; gl_FragColor=vec4(t.rgb*vColor,a); }`,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: this.cfg.decorationImage.toLowerCase().match(/glow|spark/) ? AdditiveBlending : undefined,
    })
    this.mesh = new InstancedMesh(geometry, material, this.capacity)
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
    this.parent.add(this.mesh)
  }

  private ensureCapacity(needed: number): void {
    if (!this.mesh || needed <= this.capacity) return
    const max = Math.min(this.cfg.maxParticles || 1000, 8192)
    if (this.capacity >= max) return
    const old = this.mesh
    this.parent.remove(old); old.geometry.dispose(); (old.material as ShaderMaterial).dispose()
    this.mesh = null
    this.buildMesh(Math.min(max, Math.max(needed, this.capacity * 2)))
  }

  private sampleColor(t: number): Color {
    if (this.colorKeys.length === 1) return this.sampledColor.copy(this.colorKeys[0].color)
    let i = 0
    while (i < this.colorKeys.length - 2 && t > this.colorKeys[i + 1].time) i++
    const a = this.colorKeys[i], b = this.colorKeys[i + 1]
    const f = Math.max(0, Math.min(1, (t - a.time) / Math.max(1e-6, b.time - a.time)))
    return this.sampledColor.copy(a.color).lerp(b.color, f)
  }

  private sampleAlpha(t: number): number {
    if (this.alphaKeys.length === 1) return this.alphaKeys[0].alpha
    let i = 0
    while (i < this.alphaKeys.length - 2 && t > this.alphaKeys[i + 1].time) i++
    const a = this.alphaKeys[i], b = this.alphaKeys[i + 1]
    const f = Math.max(0, Math.min(1, (t - a.time) / Math.max(1e-6, b.time - a.time)))
    return a.alpha + (b.alpha - a.alpha) * f
  }

  public play(restart = false): void {
    if (restart) this.clearParticles()
    if (this.started && !restart) return
    this.started = true; this.durationTimer = 0; this.emitAccum = 0
  }
  public restart(): void { this.rng.reset(this.cfg.randomSeed); this.simulationTime = 0; this.play(true) }
  public stop(clear = true): void { this.started = false; if (clear) this.clearParticles() }
  private clearParticles(): void { this.pool.push(...this.particles); this.particles.length = 0; if (this.mesh) this.mesh.count = 0 }
  public setVisible(value: boolean): void { this.visible = value; if (this.mesh) this.mesh.visible = value }
  public setCamScaleMultiplier(value: number): void { this.cfg.camScaleMultiplier = value }

  public update(dt: number, parentPos: { x: number; y: number }, parentRot: number, parentScale: number): void {
    const step = Math.max(0, dt) * Math.max(0, this.cfg.simulationSpeed) / 100
    this.simulationTime += step
    if (this.started) {
      this.durationTimer += step
      if (!this.cfg.loop && this.durationTimer >= this.cfg.playDuration) this.started = false
      else if (this.cfg.loop && this.cfg.playDuration > 0) this.durationTimer %= this.cfg.playDuration
      if (this.started) {
        this.emitAccum += this.rng.range(this.cfg.emissionRate[0], this.cfg.emissionRate[1]) * step
        while (this.emitAccum >= 1) { this.emitAccum -= 1; this.emitOne(parentPos, parentRot) }
      }
    }

    const alive: Particle[] = []
    for (const particle of this.particles) {
      particle.life += step
      if (particle.life >= particle.maxLife) { this.pool.push(particle); continue }
      const damping = Math.exp(-particle.drag * step)
      particle.vx *= damping; particle.vy *= damping
      particle.x += particle.vx * step; particle.y += particle.vy * step; particle.rot += particle.rotSpeed * step
      alive.push(particle)
    }
    this.particles = alive
    this.render(parentPos, parentRot, parentScale)
  }

  private render(parentPos: { x: number; y: number }, parentRot: number, parentScale: number): void {
    this.ensureCapacity(this.particles.length)
    if (!this.mesh) return
    const count = Math.min(this.capacity, this.particles.length)
    this.mesh.count = count; this.mesh.visible = this.visible
    const geometry = this.mesh.geometry
    const colors = geometry.getAttribute('aColor') as InstancedBufferAttribute
    const alphas = geometry.getAttribute('aAlpha') as InstancedBufferAttribute
    const frames = geometry.getAttribute('aFrame') as InstancedBufferAttribute
    const cos = Math.cos(parentRot), sin = Math.sin(parentRot)
    for (let i = 0; i < count; i++) {
      const particle = this.particles[i]
      const t = Math.min(1, particle.life / particle.maxLife)
      const size = particle.size + (particle.endSize - particle.size) * t
      let x = particle.x, y = particle.y, rotation = particle.rot
      if (!particle.worldSpace) {
        const rx = x * cos - y * sin, ry = x * sin + y * cos
        x = parentPos.x + rx; y = parentPos.y + ry; rotation += parentRot
      }
      const scale = size * parentScale * this.cfg.camScaleMultiplier
      this.dummy.position.set(x, y, 0); this.dummy.rotation.set(0, 0, rotation); this.dummy.scale.set(scale, scale, 1); this.dummy.updateMatrix()
      this.matrix.copy(this.dummy.matrix); this.mesh.setMatrixAt(i, this.matrix)
      const color = this.sampleColor(t); colors.setXYZ(i, color.r, color.g, color.b)
      alphas.setX(i, this.sampleAlpha(t)); frames.setX(i, particle.frame)
    }
    this.mesh.instanceMatrix.needsUpdate = true; colors.needsUpdate = true; alphas.needsUpdate = true; frames.needsUpdate = true
  }

  private emitOne(parentPos: { x: number; y: number }, parentRot: number): void {
    if (this.particles.length >= Math.min(this.cfg.maxParticles || 1000, 8192)) return
    const p = this.pool.pop() || {} as Particle
    const sx = this.cfg.scale[0] / 100 * this.cfg.tileSize
    const sy = this.cfg.scale[1] / 100 * this.cfg.tileSize
    if (this.cfg.shapeType.toLowerCase() === 'circle') {
      const arc = Math.max(0, Math.min(360, this.cfg.arc || 360)) * Math.PI / 180
      let angle = this.rng.range(0, arc)
      if (this.cfg.arcMode.toLowerCase() === 'loop' && arc > 0) angle = this.simulationTime % arc
      const radius = Math.sqrt(this.rng.next()) * this.cfg.shapeRadius * this.cfg.tileSize
      p.x = Math.cos(angle) * radius; p.y = Math.sin(angle) * radius
    } else {
      p.x = this.rng.range(-sx / 2, sx / 2); p.y = this.rng.range(-sy / 2, sy / 2)
    }
    p.worldSpace = this.cfg.simulationSpace.toLowerCase() === 'world'
    if (p.worldSpace) {
      const cos = Math.cos(parentRot), sin = Math.sin(parentRot)
      const x = p.x * cos - p.y * sin, y = p.x * sin + p.y * cos
      p.x = parentPos.x + x; p.y = parentPos.y + y
    }
    p.maxLife = Math.max(0.001, this.rng.range(this.cfg.particleLifetime[0], this.cfg.particleLifetime[1])); p.life = 0
    p.size = this.rng.range(this.cfg.particleSize[0], this.cfg.particleSize[1]) * 0.01
    p.endSize = p.size * this.rng.range(this.cfg.sizeOverLifetime[0], this.cfg.sizeOverLifetime[1]) * 0.01
    p.drag = this.rng.range(this.cfg.velocityLimitOverLifetime[0], this.cfg.velocityLimitOverLifetime[1]) * 0.01
    p.vx = this.rng.range(this.cfg.velocity[0][0], this.cfg.velocity[1][0]) * this.cfg.tileSize
    p.vy = this.rng.range(this.cfg.velocity[0][1], this.cfg.velocity[1][1]) * this.cfg.tileSize
    if (p.worldSpace) {
      const cos = Math.cos(parentRot), sin = Math.sin(parentRot), vx = p.vx * cos - p.vy * sin
      p.vy = p.vx * sin + p.vy * cos; p.vx = vx
    }
    p.rot = this.rng.range(this.cfg.startRotation[0], this.cfg.startRotation[1]) * Math.PI / 180
    p.rotSpeed = this.rng.range(this.cfg.rotationOverTime[0], this.cfg.rotationOverTime[1]) * Math.PI / 180
    p.frame = Math.floor(this.rng.next() * this.cols * this.rows)
    this.particles.push(p)
  }

  public dispose(): void {
    if (this.mesh) { this.parent.remove(this.mesh); this.mesh.geometry.dispose(); (this.mesh.material as ShaderMaterial).dispose(); this.mesh = null }
    this.particles.length = 0; this.pool.length = 0
  }
}
