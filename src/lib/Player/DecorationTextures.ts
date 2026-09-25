/**
 * DecorationTextures — 装饰纹理仓。
 *
 * 目标是消灭"装饰因为贴图问题而随机消失/串图/永久不可见"这一整类 bug：
 *
 *   1. **兜底纹理**：图缺失/加载失败 → 用一张显眼的 NotFound 贴图（紫黑格）顶上，
 *      而不是让装饰永久不可见（看不见就没法排查，还会整批消失）。
 *   2. **代次 generation**：clear()/reset 之后，旧的一次异步加载回调会被丢弃，
 *      不会把上一关的纹理糊到新一关的装饰上。
 *   3. **等待者列表**：同一张图多个装饰共用一次加载，加载完成后各自回调
 *      （调用方再用自己的请求号判断是否过期）。
 *   4. **限并发**：装饰艺术图常达 4k~8k²，必须限制同时解码数量，否则 OOM。
 */
import { CanvasTexture, LinearFilter, LinearMipMapLinearFilter, SRGBColorSpace, Texture } from 'three';
import { loadCompressedTexture } from './TextureCompress';

type Waiter = (tex: Texture) => void;

export class DecorationTextureStore {
    private cache: Map<string, Texture> = new Map();
    private waiters: Map<string, Waiter[]> = new Map();
    private loading: Set<string> = new Set();
    private failed: Set<string> = new Set();
    private queue: { name: string; url: string }[] = [];
    private active = 0;
    private generation = 0;
    private notFoundTex: Texture | null = null;
    private transparentTex: Texture | null = null;
    private placeholderTex: Texture | null = null;

    private static readonly MAX_CONCURRENT = 4;
    /** 装饰纹理最大边长（见 TextureCompress：超限图必须缩到该值再上传）。 */
    public static readonly MAX_DIMENSION = 2048;

    /** 已缓存（含兜底）的纹理；未加载完返回 undefined。 */
    public get(name: string): Texture | undefined {
        return this.cache.get(name);
    }

    public has(name: string): boolean { return this.cache.has(name); }
    /** 已真正加载成功（不是兜底）的纹理数量。 */
    public get loadedCount(): number {
        let n = 0;
        for (const k of this.cache.keys()) if (!this.failed.has(k)) n++;
        return n;
    }
    public get pendingCount(): number { return this.queue.length + this.active; }

    /** 各装饰通用的"无贴图"占位（全透明，用于未导入美术的装饰）。 */
    public get transparent(): Texture {
        if (!this.transparentTex) {
            const canvas = document.createElement('canvas');
            canvas.width = 2; canvas.height = 2;
            this.transparentTex = new CanvasTexture(canvas);
            this.transparentTex.colorSpace = SRGBColorSpace;
        }
        return this.transparentTex;
    }

    /** 纯色装饰（无贴图但走 backdrop 之类）用的 1x1 白纹理。 */
    public get placeholder(): Texture {
        if (!this.placeholderTex) {
            const canvas = document.createElement('canvas');
            canvas.width = 1; canvas.height = 1;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1, 1); }
            this.placeholderTex = new CanvasTexture(canvas);
            this.placeholderTex.colorSpace = SRGBColorSpace;
        }
        return this.placeholderTex;
    }

    /** 加载失败时的兜底贴图：明显不正常，方便一眼看出是哪张图没加载成功。 */
    public get notFound(): Texture {
        if (!this.notFoundTex) {
            const S = 32;
            const canvas = document.createElement('canvas');
            canvas.width = S; canvas.height = S;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ff00ff';
                ctx.fillRect(0, 0, S, S);
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, S / 2, S / 2);
                ctx.fillRect(S / 2, S / 2, S / 2, S / 2);
            }
            this.notFoundTex = new CanvasTexture(canvas);
            this.notFoundTex.colorSpace = SRGBColorSpace;
        }
        return this.notFoundTex;
    }

    /**
     * 请求一张装饰纹理。
     * - 已缓存 → 立刻回调（同步）。
     * - 缺少 url 或之前失败过 → 回调 NotFound 兜底（装饰仍然可见）。
     * - 否则入队（限并发），加载完成后回调；失败回调 NotFound。
     * `onLoad` 可能在本次调用中同步触发，调用方自行处理即可。
     */
    public request(name: string, url: string | undefined, onLoad: Waiter): void {
        const cached = this.cache.get(name);
        if (cached) { onLoad(cached); return; }
        if (!url || this.failed.has(name)) { onLoad(this.notFound); return; }

        let list = this.waiters.get(name);
        if (!list) { list = []; this.waiters.set(name, list); }
        list.push(onLoad);

        if (!this.loading.has(name)) {
            this.queue.push({ name, url });
            this.pump();
        }
    }

    /** 直接放入一张已就绪的纹理（如文本 canvas 纹理）。 */
    public set(name: string, tex: Texture): void {
        this.cache.set(name, tex);
    }

    /** 让某张图失效（重新导入/覆盖同名图时用），下次 request 会重新加载。 */
    public invalidate(name: string): void {
        const old = this.cache.get(name);
        if (old) {
            // 兜底纹理是共享的，不能 dispose
            if (old !== this.notFoundTex && old !== this.transparentTex && old !== this.placeholderTex) old.dispose();
            this.cache.delete(name);
        }
        this.failed.delete(name);
    }

    /** 新一关/重置：丢弃进行中的回调，清掉全部缓存。 */
    public clear(): void {
        this.generation++;
        this.queue.length = 0;
        this.waiters.clear();
        this.loading.clear();
        this.failed.clear();
        for (const tex of this.cache.values()) {
            if (tex !== this.notFoundTex && tex !== this.transparentTex && tex !== this.placeholderTex) tex.dispose();
        }
        this.cache.clear();
    }

    public dispose(): void {
        this.clear();
        this.notFoundTex?.dispose(); this.notFoundTex = null;
        this.transparentTex?.dispose(); this.transparentTex = null;
        this.placeholderTex?.dispose(); this.placeholderTex = null;
    }

    private pump(): void {
        while (this.active < DecorationTextureStore.MAX_CONCURRENT && this.queue.length > 0) {
            const job = this.queue.shift()!;
            if (this.cache.has(job.name) || this.loading.has(job.name)) continue;
            this.loading.add(job.name);
            this.active++;
            const gen = this.generation;
            loadCompressedTexture(job.url, DecorationTextureStore.MAX_DIMENSION)
                .then(tex => this.finish(job.name, tex, gen))
                .catch(err => {
                    console.warn('[Decoration] texture load failed:', job.name, err);
                    this.finish(job.name, null, gen);
                });
        }
    }

    private finish(name: string, tex: Texture | null, gen: number): void {
        this.loading.delete(name);
        this.active--;
        // 已经 clear()/重置过 → 丢弃这次结果（不能把上一关的纹理带进来）
        if (gen !== this.generation) { this.pump(); return; }

        const out = tex ?? this.notFound;
        if (!tex) this.failed.add(name);
        this.cache.set(name, out);

        const list = this.waiters.get(name);
        this.waiters.delete(name);
        if (list) for (const w of list) w(out);
        this.pump();
    }
}
