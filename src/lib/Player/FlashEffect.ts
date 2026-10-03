import { Color, Mesh, MeshBasicMaterial, Scene, OrthographicCamera, PlaneGeometry, WebGLRenderer } from 'three';
import { EasingFunctions } from './Easing';

interface FlashTransition {
    active: boolean;
    /** 保持态：材质停在 endColor/endOpacity，不随时间变化（duration=0 的瞬时闪屏、
     *  StayBlack 都属此类），直到下一次 Flash 覆盖或 Kill。 */
    hold: boolean;
    startTime: number;
    duration: number;
    startColor: Color;
    endColor: Color;
    startOpacity: number;
    endOpacity: number;
    ease: string;
    flashStyle: string; // 'Flash' | 'Reverse' | 'StayBlack' | 'Kill' | 'FlashEx'
}

function easeOutQuad(t: number): number {
    return t * (2 - t);
}

/**
 * Flash 事件（全屏 plane）。
 *
 * plane 决定渲染层级（与实况一致）：
 *   - Background：只压暗【背景】（背景图/视频/清屏色），砖块、球、装饰都不受影响。
 *     它属于主场景：renderOrder 压到所有场景物体之下（只在背景图之后），
 *     世界 z 放到极远处并开启深度测试 —— 于是任何在它前面的物体
 *     （砖块/装饰/球，无论是靠 renderOrder 还是靠深度）都会盖住它。
 *   - Foreground：屏幕空间叠层，画在最上层（主场景渲染完之后）。
 */
export class FlashEffect {
    /** 背景闪光平面的世界 z：比所有场景内容都远（但在背景视频 -500 之前）。 */
    private static readonly BG_QUAD_Z = -400;

    private enabled: boolean = true;

    private fgTransition: FlashTransition;
    private bgTransition: FlashTransition;

    /** 前景闪光叠层（屏幕空间 -1..1，最上层） */
    private fgQuad: Mesh;
    private fgMaterial: MeshBasicMaterial;
    private overlayScene: Scene;
    private overlayCamera: OrthographicCamera;

    /** 背景闪光（主场景，砖块下面一层） */
    private bgQuad: Mesh;
    private bgMaterial: MeshBasicMaterial;

    constructor() {
        const defaultTransition = (): FlashTransition => ({
            active: false,
            hold: false,
            startTime: 0,
            duration: 0,
            startColor: new Color(1, 1, 1),
            endColor: new Color(0, 0, 0),
            startOpacity: 0,
            endOpacity: 0,
            ease: 'Linear',
            flashStyle: 'Flash',
        });
        this.fgTransition = defaultTransition();
        this.bgTransition = defaultTransition();

        this.fgMaterial = new MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false,
        });
        // 背景闪光：透明混合，但**开启深度测试**——放在砖块后面的 z 上，
        // 这样砖块（不透明，先写深度）会把它挡住，只盖住背景。
        this.bgMaterial = new MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            depthTest: true,
            depthWrite: false,
        });

        this.overlayScene = new Scene();
        this.overlayCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.fgQuad = new Mesh(new PlaneGeometry(2, 2), this.fgMaterial);
        this.fgQuad.position.z = -0.5;
        this.fgQuad.renderOrder = 1001;
        this.overlayScene.add(this.fgQuad);

        // 1x1 平面，按主相机视口缩放。renderOrder 压到背景图（-1000000）之后、
        // 其余所有场景物体之前；再配合极远的 z + 深度测试兜底。
        this.bgQuad = new Mesh(new PlaneGeometry(1, 1), this.bgMaterial);
        this.bgQuad.renderOrder = -100000;
        this.bgQuad.frustumCulled = false;
        this.bgQuad.visible = false;
    }

    /** 把背景闪光平面挂到主场景（砖块下面那一层）。 */
    attachToScene(scene: Scene): void {
        if (this.bgQuad.parent) this.bgQuad.parent.remove(this.bgQuad);
        scene.add(this.bgQuad);
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) this.bgQuad.visible = false;
    }

    getEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Handle all Flash event modes.
     *
     * Supports both old format (color, colorTo, opacity, easing, flashStyle, duration)
     * and new format (startColor, endColor, startOpacity, endOpacity, ease, plane, duration).
     *
     * 所有样式统一：把 plane 立刻设成【初始值】(startColor 的 rgb+alpha / startOpacity)，
     * 再按 ease 过渡到【末值】(endColor 的 rgb+alpha / endOpacity)。与实况 ffxFlashPlus 一致 ——
     * ffxFlashPlus 不区分 flashStyle，永远是 startColor → endColor 的补间。
     * flashStyle 只保留两个瞬时特例：
     *   "Kill"       – 立即停止所有闪光
     *   "StayBlack"  – 立即变黑并保持
     */
    startFlash(
        currentTime: number,
        event: any,
        plane: 'FG' | 'BG',
    ): void {
        const flashStyle = event.flashStyle || 'Flash';

        const transition = plane === 'FG' ? this.fgTransition : this.bgTransition;
        const material = plane === 'FG' ? this.fgMaterial : this.bgMaterial;

        // Kill 是"立即清空"，不是"补完"：原版 scrFlash.FlashKill 把 colorStart/
        // colorEnd 都设成 clear → 直接变透明。
        if (flashStyle === 'Kill') {
            this.stop();
            return;
        }

        // 原版 ffxFlashPlus.DoFlash 的第一步：DOTween.Kill(material, complete: true)。
        // 新的 Flash 到来时，先把本 plane 上仍在进行的旧补间【瞬间补完】——材质落到
        // 它的 endColor/endOpacity —— 再终止旧过渡，然后才由新闪屏接管。
        this.completeTransition(transition, material);

        if (flashStyle === 'StayBlack') {
            transition.active = true;
            transition.hold = false;
            transition.startTime = currentTime;
            transition.duration = 0;
            transition.startColor.set(0, 0, 0);
            transition.endColor.set(0, 0, 0);
            transition.startOpacity = 1;
            transition.endOpacity = 1;
            transition.ease = 'Linear';
            transition.flashStyle = 'StayBlack';

            material.color.set(0, 0, 0);
            material.opacity = 1;
            return;
        }

        // 颜色是 #RRGGBBAA（也可能只有 #RGB / #RRGGBB）：alpha 要单独取出，
        // 因为 THREE.Color 只吃 RGB，透明度只能走 material.opacity。
        // 初始值 = startColor（含 alpha），末值 = endColor（含 alpha）；
        // 未给末色时，末值 = 起始色但全透明（经典的闪一下）。
        // 显式 startOpacity/endOpacity（0..100）优先于颜色里带的 alpha。
        const start = this.parseColor(event.startColor ?? event.color ?? 'ffffff');
        const endProvided = event.endColor !== undefined || event.colorTo !== undefined;
        const end = endProvided
            ? this.parseColor(event.endColor ?? event.colorTo)
            : { hex: start.hex, alpha: 0 };

        const startOpacity = event.startOpacity !== undefined
            ? event.startOpacity / 100
            : (event.opacity !== undefined ? event.opacity / 100 : start.alpha);
        const endOpacity = event.endOpacity !== undefined ? event.endOpacity / 100 : end.alpha;
        const ease = event.ease || event.easing || 'Linear';
        const duration = event.duration ?? 1;

        transition.active = true;
        transition.hold = false;
        transition.startTime = currentTime;
        transition.duration = duration;
        transition.startColor.set(start.hex);
        transition.endColor.set(end.hex);
        transition.startOpacity = startOpacity;
        transition.endOpacity = endOpacity;
        transition.ease = ease;
        transition.flashStyle = flashStyle;

        material.color.copy(transition.startColor);
        material.opacity = transition.startOpacity;
    }

    /**
     * 原版 ffxFlashPlus.DoFlash 的第一步：DOTween.Kill(material, complete: true)。
     * 新闪屏到来时，把该 plane 上仍在进行的旧补间【瞬间补完】——材质落到它的
     * endColor/endOpacity —— 然后终止旧过渡，再接管新的。
     */
    private completeTransition(transition: FlashTransition, material: MeshBasicMaterial): void {
        if (!transition.active) return;
        material.color.copy(transition.endColor);
        material.opacity = transition.endOpacity;
        transition.active = false;
        transition.hold = false;
    }

    /**
     * 解析颜色 → { hex: '#RRGGBB', alpha: 0..1 }。
     * 支持 #RGB / #RRGGBB / #RRGGBBAA（关卡文件也可能写数字 / [r,g,b(,a)] / {r,g,b(,a)}）。
     * alpha 单独返回给 material.opacity，绝不丢弃。
     */
    private parseColor(value: any): { hex: string; alpha: number } {
        const clamp01 = (v: any) => Math.min(1, Math.max(0, Number(v)));
        const toHex = (v: any) =>
            Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');

        if (typeof value === 'number') {
            const n = value >>> 0;
            if (n > 0xffffff) {
                return {
                    hex: '#' + ((n >>> 16) & 0xff).toString(16).padStart(2, '0')
                        + ((n >>> 8) & 0xff).toString(16).padStart(2, '0')
                        + (n & 0xff).toString(16).padStart(2, '0'),
                    alpha: ((n >>> 24) & 0xff) / 255,
                };
            }
            return { hex: '#' + n.toString(16).padStart(6, '0').slice(-6), alpha: 1 };
        }
        if (Array.isArray(value)) {
            return {
                hex: '#' + toHex(value[0]) + toHex(value[1]) + toHex(value[2]),
                alpha: typeof value[3] === 'number' ? clamp01(value[3]) : 1,
            };
        }
        if (value && typeof value === 'object' && typeof value.r === 'number') {
            return {
                hex: '#' + toHex(value.r) + toHex(value.g) + toHex(value.b),
                alpha: typeof value.a === 'number' ? clamp01(value.a) : 1,
            };
        }
        if (typeof value !== 'string' || value.length === 0) return { hex: '#ffffff', alpha: 1 };

        let raw = value.startsWith('#') ? value.slice(1) : value;
        if (raw.length === 3) raw = raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2];
        if (raw.length === 4) raw = raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];
        if (raw.length >= 8) {
            return { hex: '#' + raw.slice(0, 6), alpha: parseInt(raw.slice(6, 8), 16) / 255 };
        }
        return { hex: '#' + raw.slice(0, 6).padEnd(6, '0'), alpha: 1 };
    }

    private updateTransition(
        transition: FlashTransition,
        material: MeshBasicMaterial,
        currentTime: number,
    ): boolean {
        if (!transition.active) return false;

        // 保持态（duration=0 的瞬时闪屏 / StayBlack）：材质停在终值并持续可见，
        // 直到下一次 Flash 或 Kill 覆盖。duration=0 的零时长 tween 立即结束，
        // 材质就停在 endColor —— 静帧闪白/闪黑全靠这个"停住"。
        if (transition.hold || transition.duration <= 0) {
            material.color.copy(transition.endColor);
            material.opacity = transition.endOpacity;
            transition.hold = true;
            return true;
        }

        const elapsed = currentTime - transition.startTime;
        let t = elapsed / transition.duration;

        let finished = false;
        if (t >= 1) {
            t = 1;
            finished = true;
        } else if (t < 0) {
            t = 0;
        }

        const easeFunc = EasingFunctions[transition.ease] || EasingFunctions.Linear || easeOutQuad;
        const progress = easeFunc(t);

        material.color.lerpColors(transition.startColor, transition.endColor, progress);
        material.opacity = transition.startOpacity + (transition.endOpacity - transition.startOpacity) * progress;

        if (finished) {
            // 结束后材质停在 endColor/endOpacity（不会复位）——这正是"静帧闪屏"的来源：
            // endOpacity>0 时画面会一直保持（例如淡入到 25% 就一直 25%），
            // endOpacity=0 时只是不再绘制。下一次 Flash 或 Kill 才会覆盖它。
            transition.hold = true;
        }

        return true;
    }

    isActive(): boolean {
        return this.fgTransition.active || this.bgTransition.active;
    }

    isFGActive(): boolean {
        return this.fgTransition.active;
    }

    isBGActive(): boolean {
        return this.bgTransition.active;
    }

    /**
     * 主场景渲染【之前】调用：更新背景闪光（plane=Background）的颜色与世界变换。
     * 平面铺满视口并跟随主相机（位置/旋转/缩放），从而只覆盖背景。
     */
    updateBG(camera: OrthographicCamera, currentTime: number): void {
        const active = this.enabled && this.updateTransition(this.bgTransition, this.bgMaterial, currentTime);
        if (!active || this.bgMaterial.opacity <= 0.001) {
            this.bgQuad.visible = false;
            return;
        }

        // 与自定义背景同一套换算：铺满视口（含相机 zoom），跟随相机位置/旋转
        const zoom = camera.zoom || 1;
        this.bgQuad.scale.set(
            (camera.right - camera.left) / zoom,
            (camera.top - camera.bottom) / zoom,
            1,
        );
        // 极远的 z：任何在它前面的物体都会通过深度测试盖住它，只留下背景被压暗。
        this.bgQuad.position.set(camera.position.x, camera.position.y, FlashEffect.BG_QUAD_Z);
        this.bgQuad.rotation.z = camera.rotation.z;
        this.bgQuad.visible = true;
    }

    /** 主场景渲染【之后】调用：渲染前景闪光叠层（plane=Foreground），画在最上层。 */
    renderFG(renderer: WebGLRenderer, currentTime: number): void {
        if (!this.enabled) return;
        const active = this.updateTransition(this.fgTransition, this.fgMaterial, currentTime);
        if (!active || this.fgMaterial.opacity <= 0.001) return;

        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(this.overlayScene, this.overlayCamera);
        renderer.autoClear = oldAutoClear;
    }

    getFGOpacity(): number {
        return this.fgMaterial.opacity;
    }

    getBGOpacity(): number {
        return this.bgMaterial.opacity;
    }

    stop(): void {
        this.fgTransition.active = false;
        this.bgTransition.active = false;
        this.fgTransition.hold = false;
        this.bgTransition.hold = false;
        this.fgMaterial.opacity = 0;
        this.bgMaterial.opacity = 0;
        this.bgQuad.visible = false;
    }

    reset(): void {
        this.stop();
        this.fgTransition.startColor.set(1, 1, 1);
        this.fgTransition.endColor.set(0, 0, 0);
        this.fgTransition.startOpacity = 0;
        this.fgTransition.endOpacity = 0;
        this.fgTransition.flashStyle = 'Flash';
        this.bgTransition.startColor.set(1, 1, 1);
        this.bgTransition.endColor.set(0, 0, 0);
        this.bgTransition.startOpacity = 0;
        this.bgTransition.endOpacity = 0;
        this.bgTransition.flashStyle = 'Flash';
        this.fgMaterial.color.set(1, 1, 1);
        this.bgMaterial.color.set(1, 1, 1);
    }

    setSize(width: number, height: number): void {
    }

    dispose(): void {
        this.fgMaterial.dispose();
        this.bgMaterial.dispose();
        this.fgQuad.geometry.dispose();
        this.bgQuad.geometry.dispose();
        if (this.bgQuad.parent) this.bgQuad.parent.remove(this.bgQuad);
    }
}

export default FlashEffect;
