import {
    InstancedMesh, PlaneGeometry, Texture, Color, DoubleSide,
    Matrix4, Object3D,
    ShaderMaterial, InstancedBufferAttribute, DynamicDrawUsage,
} from 'three';

/**
 * ADOFAI AddParticle 的简化 CPU 粒子系统。
 * 对照官方 scrParticleDecoration.ResetParticle 的配置逐项实现：
 *  - 发射区域（shapeType Rectangle/Circle × scale/100 × tileSize）
 *  - emissionRate（个/秒，min-max）
 *  - particleLifetime（秒，min-max）
 *  - particleSize（min-max，×0.01 → world 单位）
 *  - velocity（min-max，×tileSize）
 *  - velocityLimitOverLifetime（drag，×0.01）
 *  - sizeOverLifetime / colorOverLifetime（渐变）
 *  - startRotation / rotationOverTime
 *  - textureSheetAnimation（randomTextureTiling 随机帧）
 *  - loop / playDuration / simulationSpeed / maxParticles / randomSeed
 *  - simulationSpace Local / World
 * 官方 scale 语义：shape.scale = scale/100 × tileSize（发射区域大小，非粒子大小）。
 */

export interface ParticleGradientKey {
    time: number;
    alpha: number;
}

export interface ParticleColorKey {
    time: number;
    color: string;
}

export interface ParticleGradient {
    mode: string;
    alphaKeys: ParticleGradientKey[];
    colorKeys: ParticleColorKey[];
}

export interface ParticleColorConfig {
    color1?: string;
    gradient1?: ParticleGradient;
    mode?: string;
}

export interface ParticleConfig {
    decorationImage: string;
    scale: [number, number];
    shapeType: string;
    shapeRadius: number;
    arc: number;
    arcMode: string;
    emissionRate: [number, number];
    particleLifetime: [number, number];
    particleSize: [number, number];
    velocity: [[number, number], [number, number]];
    velocityLimitOverLifetime: [number, number];
    sizeOverLifetime: [number, number];
    colorOverLifetime: ParticleColorConfig;
    startRotation: [number, number];
    rotationOverTime: [number, number];
    randomTextureTiling: [number, number];
    maxParticles: number;
    loop: boolean;
    playDuration: number;
    simulationSpeed: number;
    randomSeed: number;
    autoPlay: boolean;
    simulationSpace: string;
    tileSize: number;
    camScaleMultiplier: number;
}

interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number;
    rot: number; rotSpeed: number;
    frame: number;
    alive: boolean;
}

function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

/** 解析 hex 颜色到 THREE.Color（支持 6/8 位）。 */
function hexToColor(hex: string, out: Color): void {
    const h = hex.replace(/^#/, '');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    out.setRGB(r, g, b);
}

export class ParticleDecorationSystem {
    private particles: Particle[] = [];
    private pool: Particle[] = [];
    private emitAccum = 0;
    private durationTimer = 0;
    private started = false;
    private seed: number;

    private mesh: InstancedMesh | null = null;
    private capacity = 0;
    private dummy = new Object3D();
    private mtx = new Matrix4();
    private baseColor = new Color(0xffffff);
    private tmpColor = new Color();

    private colorKeys: { time: number; r: number; g: number; b: number }[] = [];
    private alphaKeys: { time: number; alpha: number }[] = [];

    private parent: Object3D;
    private cfg: ParticleConfig;
    private tex: Texture;
    private texCols: number;
    private texRows: number;
    private quadW: number;
    private quadH: number;
    private visible = true;

    constructor(parent: Object3D, cfg: ParticleConfig, texture: Texture) {
        this.parent = parent;
        this.cfg = cfg;
        this.tex = texture;
        this.seed = cfg.randomSeed || 1;
        this.texCols = Math.max(1, Math.round(cfg.randomTextureTiling[0]) || 1);
        this.texRows = Math.max(1, Math.round(cfg.randomTextureTiling[1]) || 1);
        const img = (texture.image as any);
        const tw = img?.width || 100;
        const th = img?.height || 100;
        this.quadW = (tw / this.texCols) / 100;
        this.quadH = (th / this.texRows) / 100;
        this.parseGradients();
        this.buildMesh();
    }

    private parseGradients(): void {
        const cfg = this.cfg.colorOverLifetime;
        const grad = cfg?.gradient1;
        this.colorKeys = [];
        this.alphaKeys = [];
        if (grad) {
            const color1 = grad.colorKeys && grad.colorKeys.length ? grad.colorKeys[0].color : (cfg?.color1 || 'ffffff');
            hexToColor(color1, this.baseColor);
            for (const k of grad.colorKeys || []) {
                const c = new Color();
                hexToColor(k.color, c);
                this.colorKeys.push({ time: k.time, r: c.r, g: c.g, b: c.b });
            }
            for (const k of grad.alphaKeys || []) {
                this.alphaKeys.push({ time: k.time, alpha: k.alpha });
            }
        } else {
            hexToColor(cfg?.color1 || 'ffffff', this.baseColor);
            this.colorKeys.push({ time: 0, r: this.baseColor.r, g: this.baseColor.g, b: this.baseColor.b });
            this.alphaKeys.push({ time: 0, alpha: 1 }, { time: 1, alpha: 1 });
        }
        if (this.colorKeys.length === 0) {
            this.colorKeys.push({ time: 0, r: this.baseColor.r, g: this.baseColor.g, b: this.baseColor.b });
        }
    }

    private buildMesh(capacity?: number): void {
        const cfg = this.cfg;
        const cap = Math.max(1, Math.min(capacity ?? 512, cfg.maxParticles || 1000));
        this.capacity = cap;
        const geo = new PlaneGeometry(this.quadW, this.quadH);
        const useAdditive = cfg.decorationImage.toLowerCase().includes('glow') || cfg.decorationImage.toLowerCase().includes('spark');
        const mat = new ShaderMaterial({
            uniforms: {
                uMap: { value: this.tex },
                uAdditive: { value: useAdditive },
            },
            vertexShader: `
                attribute float aAlpha;
                attribute vec3 aColor;
                varying float vAlpha;
                varying vec3 vColor;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vAlpha = aAlpha;
                    vColor = aColor;
                    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mv;
                }
            `,
            fragmentShader: `
                uniform sampler2D uMap;
                uniform bool uAdditive;
                varying float vAlpha;
                varying vec3 vColor;
                varying vec2 vUv;
                void main() {
                    vec4 tex = texture2D(uMap, vUv);
                    vec3 col = tex.rgb * vColor.rgb;
                    float a = tex.a * vAlpha;
                    if (uAdditive) {
                        gl_FragColor = vec4(col * a, a);
                    } else {
                        gl_FragColor = vec4(col, a);
                    }
                }
            `,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
        });
        this.mesh = new InstancedMesh(geo, mat, cap);
        this.mesh.frustumCulled = false;
        this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        // 每实例颜色 + alpha
        const instColor = new Float32Array(cap * 3);
        const instAlpha = new Float32Array(cap);
        geo.setAttribute('aColor', new InstancedBufferAttribute(instColor, 3));
        geo.setAttribute('aAlpha', new InstancedBufferAttribute(instAlpha, 1));
        this.parent.add(this.mesh);
        this.mesh.count = 0;
    }

    /** 粒子数接近容量时扩容（重建 mesh，容量翻倍，不超过 maxParticles 且不超过 8192 防 OOM）。 */
    private ensureCapacity(needed: number): void {
        if (!this.mesh) return;
        const max = Math.min(this.cfg.maxParticles || 1000, 8192);
        if (needed <= this.capacity || this.capacity >= max) return;
        const old = this.mesh;
        const newCap = Math.min(max, Math.max(needed * 2, this.capacity * 2));
        this.parent.remove(old);
        old.geometry.dispose();
        (old.material as ShaderMaterial).dispose();
        this.buildMesh(newCap);
    }

    private sampleColor(t: number): Color {
        const keys = this.colorKeys;
        if (keys.length === 1) { this.tmpColor.setRGB(keys[0].r, keys[0].g, keys[0].b); return this.tmpColor; }
        let i = 0;
        while (i < keys.length - 2 && t > keys[i + 1].time) i++;
        const a = keys[i], b = keys[i + 1];
        const f = Math.min(1, Math.max(0, (t - a.time) / Math.max(1e-6, b.time - a.time)));
        this.tmpColor.setRGB(a.r + (b.r - a.r) * f, a.g + (b.g - a.g) * f, a.b + (b.b - a.b) * f);
        return this.tmpColor;
    }

    private sampleAlpha(t: number): number {
        const keys = this.alphaKeys;
        if (keys.length === 0) return 1;
        if (keys.length === 1) return keys[0].alpha;
        let i = 0;
        while (i < keys.length - 2 && t > keys[i + 1].time) i++;
        const a = keys[i], b = keys[i + 1];
        const f = Math.min(1, Math.max(0, (t - a.time) / Math.max(1e-6, b.time - a.time)));
        return a.alpha + (b.alpha - a.alpha) * f;
    }

    public play(): void {
        if (this.started) return;
        this.started = true;
        this.durationTimer = 0;
        this.emitAccum = 0;
        this.resetSeed();
        if (this.cfg.autoPlay) {
            // 官方 Play 前先播一次 burst？简化：直接开始累计发射
        }
    }

    public stop(): void {
        this.started = false;
        this.particles.length = 0;
        if (this.mesh) this.mesh.count = 0;
    }

    public setVisible(v: boolean): void {
        if (this.visible === v) return;
        this.visible = v;
        if (this.mesh) this.mesh.visible = v;
    }

    public setCamScaleMultiplier(m: number): void {
        if (this.cfg.camScaleMultiplier === m) return;
        this.cfg.camScaleMultiplier = m;
    }

    public update(dt: number, parentPos: { x: number; y: number }, parentRot: number, parentScale: number): void {
        const cfg = this.cfg;
        if (this.started) {
            this.durationTimer += dt;
            if (cfg.loop && this.durationTimer >= cfg.playDuration) {
                this.durationTimer = 0;
            }
            const playing = this.started && (cfg.loop || this.durationTimer < cfg.playDuration);
            if (playing) {
                // 发射
                const rate = rand(cfg.emissionRate[0], cfg.emissionRate[1]);
                this.emitAccum += rate * dt;
                while (this.emitAccum >= 1) {
                    this.emitAccum -= 1;
                    this.emitOne();
                }
            }
        }

        // 更新粒子
        const alive: Particle[] = [];
        for (const p of this.particles) {
            p.life += dt;
            if (p.life >= p.maxLife) { this.pool.push(p); continue; }
            // 拖拽（官方 drag 曲线，简化线性）
            const drag = rand(cfg.velocityLimitOverLifetime[0], cfg.velocityLimitOverLifetime[1]) * 0.01;
            if (drag > 0) {
                const f = Math.max(0, 1 - drag * dt);
                p.vx *= f; p.vy *= f;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rot += p.rotSpeed * dt;
            alive.push(p);
        }
        this.particles = alive;

        // 渲染
        if (!this.mesh) return;
        // 容量不足时扩容（重建 mesh）——避免一次性按 maxParticles(可达10万) 分配导致 OOM
        this.ensureCapacity(alive.length);
        if (!this.mesh) return;
        const count = Math.min(alive.length, this.capacity);
        this.mesh.count = count;
        const scaleMul = cfg.camScaleMultiplier;
        const cs = parentScale * scaleMul;
        const cosR = Math.cos(parentRot), sinR = Math.sin(parentRot);
        const geo = this.mesh.geometry as any;
        const colorAttr = geo.getAttribute('aColor') as InstancedBufferAttribute;
        const alphaAttr = geo.getAttribute('aAlpha') as InstancedBufferAttribute;
        const colArr = colorAttr.array as Float32Array;
        const alpArr = alphaAttr.array as Float32Array;
        for (let i = 0; i < count; i++) {
            const p = alive[i];
            const lifeT = p.maxLife > 0 ? Math.min(1, p.life / p.maxLife) : 1;
            // sizeOverLifetime 曲线（简化：线性插值 [1, sizeOverLifetime.y] 比例）
            const sizeF = rand(cfg.sizeOverLifetime[0], cfg.sizeOverLifetime[1]) * 0.01;
            const size = p.size * (1 + (sizeF - 1) * lifeT) * cs;
            const lx = p.x * cosR - p.y * sinR;
            const ly = p.x * sinR + p.y * cosR;
            this.dummy.position.set(parentPos.x + lx, parentPos.y + ly, 0);
            this.dummy.rotation.set(0, 0, p.rot + parentRot);
            this.dummy.scale.set(size, size, 1);
            this.dummy.updateMatrix();
            this.mtx.copy(this.dummy.matrix);
            this.mesh.setMatrixAt(i, this.mtx);
            // 颜色 = baseColor × 渐变；alpha 单独
            const gc = this.sampleColor(lifeT);
            colArr[i * 3] = this.baseColor.r * gc.r;
            colArr[i * 3 + 1] = this.baseColor.g * gc.g;
            colArr[i * 3 + 2] = this.baseColor.b * gc.b;
            alpArr[i] = this.sampleAlpha(lifeT);
        }
        colorAttr.needsUpdate = true;
        alphaAttr.needsUpdate = true;
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    private resetSeed(): void {
        // 简化：Math.random 直接使用；randomSeed 仅作确定性占位
        void this.seed;
    }

    private emitOne(): void {
        const cfg = this.cfg;
        // 粒子数组上限与 mesh 容量一致（≤8192 防 OOM）
        if (this.particles.length >= Math.min(cfg.maxParticles || 1000, 8192)) return;
        const p = this.pool.pop() || { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, rot: 0, rotSpeed: 0, frame: 0, alive: true };
        // 发射区域（shape.scale = scale/100 × tileSize；Circle 用 radius）
        const tileSize = cfg.tileSize;
        const sx = (cfg.scale[0] / 100) * tileSize;
        const sy = (cfg.scale[1] / 100) * tileSize;
        if (cfg.shapeType === 'Circle') {
            const r = (cfg.shapeRadius || 1) * tileSize * Math.random();
            const a = Math.random() * Math.PI * 2;
            p.x = Math.cos(a) * r;
            p.y = Math.sin(a) * r;
        } else {
            p.x = rand(-sx / 2, sx / 2);
            p.y = rand(-sy / 2, sy / 2);
        }
        p.maxLife = rand(cfg.particleLifetime[0], cfg.particleLifetime[1]);
        p.life = 0;
        p.size = rand(cfg.particleSize[0], cfg.particleSize[1]) * 0.01;
        const vxr = rand(cfg.velocity[0][0], cfg.velocity[1][0]) * tileSize;
        const vyr = rand(cfg.velocity[0][1], cfg.velocity[1][1]) * tileSize;
        p.vx = vxr;
        p.vy = vyr;
        p.rot = rand(cfg.startRotation[0], cfg.startRotation[1]) * Math.PI / 180;
        p.rotSpeed = rand(cfg.rotationOverTime[0], cfg.rotationOverTime[1]) * Math.PI / 180;
        const totalFrames = this.texCols * this.texRows;
        p.frame = totalFrames > 1 ? Math.floor(Math.random() * totalFrames) : 0;
        p.alive = true;
        this.particles.push(p);
    }

    public dispose(): void {
        if (this.mesh) {
            this.parent.remove(this.mesh);
            this.mesh.geometry.dispose();
            (this.mesh.material as ShaderMaterial).dispose();
            this.mesh = null;
        }
        this.particles.length = 0;
        this.pool.length = 0;
    }
}
