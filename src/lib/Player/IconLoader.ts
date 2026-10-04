import { TextureLoader, Texture, SRGBColorSpace, RepeatWrapping, CanvasTexture, LinearFilter, SpriteMaterial, Sprite } from 'three';

import endUrl from '@/assets/events/End.json';
import speedPlusUrl from '@/assets/events/Speed+.json';
import speedMinusUrl from '@/assets/events/Speed-.json';
import doubleSnailUrl from '@/assets/events/DoubleSnail.json';
import twirlB1Url from '@/assets/events/TwirlB1.json';
import twirlR1Url from '@/assets/events/TwirlR1.json';
import planetRedUrl from '@/assets/planets/planet_red.json';
import planetBlueUrl from '@/assets/planets/planet_blue.json';

export type IconType = 'End' | 'Speed+' | 'Speed-' | 'DoubleSnail' | 'TwirlB1' | 'TwirlB-1' | 'TwirlR1' | 'TwirlR-1';

export const ICON_TYPES: IconType[] = [
    'End', 'Speed+', 'Speed-', 'DoubleSnail',
    'TwirlB1', 'TwirlB-1', 'TwirlR1', 'TwirlR-1',
];

export const ICON_ATLAS_SIZE = 128;
const ATLAS_COLS = 8;

let _atlasTexture: Texture | null = null;

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

function drawFlipped(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(1, -1);
    ctx.rotate(Math.PI);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
}

export async function buildIconAtlas(): Promise<Texture> {
    if (_atlasTexture) return _atlasTexture;

    const urls: [IconType, string, boolean][] = [
        ['End', endUrl, false],
        ['Speed+', speedPlusUrl, false],
        ['Speed-', speedMinusUrl, false],
        ['DoubleSnail', doubleSnailUrl, false],
        ['TwirlB1', twirlB1Url, false],
        ['TwirlB-1', twirlB1Url, true],
        ['TwirlR1', twirlR1Url, false],
        ['TwirlR-1', twirlR1Url, true],
    ];

    const images = await Promise.all(urls.map(([, url]) => loadImage(url)));

    const S = ICON_ATLAS_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = S * ATLAS_COLS;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;

    for (let i = 0; i < urls.length; i++) {
        const [, , flipped] = urls[i];
        const img = images[i];
        const scale = Math.min(S / img.width, S / img.height) * 0.9;
        const w = img.width * scale;
        const h = img.height * scale;
        const x = i * S + (S - w) / 2;
        const y = (S - h) / 2;
        if (flipped) {
            drawFlipped(ctx, img, x, y, w, h);
        } else {
            ctx.drawImage(img, x, y, w, h);
        }
    }

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearFilter;
    _atlasTexture = tex;
    return tex;
}

export function getIconAtlas(): Texture | null {
    return _atlasTexture;
}

export function getIconTypeIndex(type: IconType): number {
    return ICON_TYPES.indexOf(type) + 1;
}

export function getTwirlTexture(angle: number, dir: number): IconType {
    const red = angle < 180;
    const d = dir >= 0 ? '1' : '-1';
    return red ? (`TwirlR${d}` as IconType) : (`TwirlB${d}` as IconType);
}

export function getSetSpeedTexture(ratio: number): IconType {
    if (ratio > 1.05) return 'Speed+';
    if (ratio <= 0.5) return 'DoubleSnail';
    return 'Speed-';
}

export function getIconTextureForCustomFloor(trackIcon: string): IconType | null {
    switch (trackIcon) {
        case 'Swirl': return 'TwirlB1';
        case 'Rabbit':
        case 'DoubleRabbit': return 'Speed+';
        case 'Snail': return 'Speed-';
        case 'DoubleSnail': return 'DoubleSnail';
        default: return null;
    }
}

// Legacy sprite-based icon loader (kept for decorations)
const _legacyLoader = new TextureLoader();

function loadLegacy(key: string, url: string): Texture {
    const tex = _legacyLoader.load(url);
    tex.colorSpace = SRGBColorSpace;
    return tex;
}

function loadFlippedLegacy(url: string): Texture {
    const tex = _legacyLoader.load(url);
    tex.colorSpace = SRGBColorSpace;
    tex.wrapT = RepeatWrapping;
    tex.repeat.y = -1;
    tex.offset.y = 1;
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI / 2;
    return tex;
}

const _e = () => loadLegacy('End', endUrl);
const _sp = () => loadLegacy('Speed+', speedPlusUrl);
const _sm = () => loadLegacy('Speed-', speedMinusUrl);
const _ds = () => loadLegacy('DoubleSnail', doubleSnailUrl);
const _tb1 = () => loadLegacy('TwirlB1', twirlB1Url);
const _tb1n = () => loadFlippedLegacy(twirlB1Url);
const _tr1 = () => loadLegacy('TwirlR1', twirlR1Url);
const _tr1n = () => loadFlippedLegacy(twirlR1Url);

export function getIconTexture(type: IconType): Texture {
    switch (type) {
        case 'End': return _e();
        case 'Speed+': return _sp();
        case 'Speed-': return _sm();
        case 'DoubleSnail': return _ds();
        case 'TwirlB1': return _tb1();
        case 'TwirlB-1': return _tb1n();
        case 'TwirlR1': return _tr1();
        case 'TwirlR-1': return _tr1n();
    }
}

export function createIconSprite(tex: Texture, opacity = 1, size = 0.22): Sprite {
    const mat = new SpriteMaterial({
        map: tex,
        transparent: true,
        opacity,
        depthTest: true,
        depthWrite: false,
    });
    const sprite = new Sprite(mat);
    sprite.scale.set(size, size, 1);
    sprite.center.set(0.5, 0.5);
    return sprite;
}

// ── Object(Planet) 装饰/行星本体贴图（planetColorType 预设） ──
// DefaultRed/DefaultBlue 用对应贴图且不染色；其余类型（含 Custom）
// 用红色贴图 × planetColor 染色。见 createPlanetVisual / planetTexturePathForObject。
const _planetRed = () => loadLegacy('planet_red', planetRedUrl);
const _planetBlue = () => loadLegacy('planet_blue', planetBlueUrl);

/** 取行星本体贴图：DefaultBlue → blue.png，其它（含 Custom/undefined）→ red.png。 */
export function getPlanetTexture(planetColorType: string | undefined): Texture {
    return planetColorType === 'DefaultBlue' ? _planetBlue() : _planetRed();
}

/** 行星贴图是横向 sprite sheet：`frameCount = 11` / `fps = 12`。 */
export const PLANET_FRAME_COUNT = 11;
export const PLANET_FPS = 12;

const _tintedPlanetCache = new Map<string, Texture>();
const _tintedPlanetPending = new Map<string, Promise<Texture>>();

/** 把红贴图（亮度遮罩 = RGB 通道最大值）重映射成目标颜色的同款 11 帧 sprite sheet。 */
function buildTintedPlanetTexture(img: HTMLImageElement, colorHex: number): Texture {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const r = (colorHex >> 16) & 0xff;
    const g = (colorHex >> 8) & 0xff;
    const b = colorHex & 0xff;
    for (let p = 0; p < data.length; p += 4) {
        const lum = Math.max(data[p], data[p + 1], data[p + 2]) / 255;
        data[p] = Math.round(r * lum);
        data[p + 1] = Math.round(g * lum);
        data[p + 2] = Math.round(b * lum);
    }
    ctx.putImageData(imageData, 0, 0);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    configurePlanetTexture(tex);
    _tintedPlanetCache.set(colorHex.toString(16), tex);
    return tex;
}

/**
 * MultiPlanet 追加行星的贴图（同步版）：官方 `PlanetRenderer.SetColor` 用白色 sprite × planetColor；
 * 这里把红色预设按亮度重映射成目标色。若底图尚未解码完成，先返回红色底图（不缓存），
 * 调用方用 `ensureTintedPlanetTexture` 在解码完成后替换材质即可。
 */
export function getTintedPlanetTexture(colorHex: number): Texture {
    const cached = _tintedPlanetCache.get(colorHex.toString(16));
    if (cached) return cached;
    const img = _planetRed().image as HTMLImageElement | undefined;
    if (!img || !(img.naturalWidth > 0)) return _planetRed();
    return buildTintedPlanetTexture(img, colorHex);
}

/** 异步确保彩色贴图可用（直接用 data URI 解码，不依赖 THREE 贴图对象的加载时机）。 */
export function ensureTintedPlanetTexture(colorHex: number): Promise<Texture> {
    const key = colorHex.toString(16);
    const cached = _tintedPlanetCache.get(key);
    if (cached) return Promise.resolve(cached);
    let pending = _tintedPlanetPending.get(key);
    if (!pending) {
        pending = loadImage(planetRedUrl)
            .then(img => buildTintedPlanetTexture(img, colorHex))
            .catch(() => _planetRed());
        _tintedPlanetPending.set(key, pending);
    }
    return pending;
}

/** 把行星贴图配成"单帧采样"（贴图是 11 帧横排，必须 repeat 1/11 + offset 选帧，
 *  否则整条 11 个球会被压成一个方块）。 */
export function configurePlanetTexture(tex: Texture): Texture {
    tex.repeat.set(1 / PLANET_FRAME_COUNT, 1);
    tex.offset.set(0, 0);
    tex.needsUpdate = true;
    return tex;
}

/** 当前帧索引：`_Frame = unscaledTime * 12 % 11`（取整帧）。 */
export function planetFrameIndex(timeSec: number): number {
    const f = Math.floor(timeSec * PLANET_FPS) % PLANET_FRAME_COUNT;
    return f < 0 ? f + PLANET_FRAME_COUNT : f;
}

/** 按帧索引设置行星贴图的 UV offset。 */
export function applyPlanetFrame(tex: Texture, timeSec: number): void {
    tex.offset.x = planetFrameIndex(timeSec) / PLANET_FRAME_COUNT;
}

/**
 * planetColorType 预设颜色（SetPlanetColorType 用到的预设表）。
 * Custom / 未设置返回 null，表示"用事件自身的 planetColor"。
 * 数值：DefaultRed 0xff0000 / DefaultBlue 0x0000ff /
 * Gold 0xffdb5a / Overseer 0x002633。
 */
export function planetPresetColor(planetColorType: string | undefined): string | null {
    switch (planetColorType) {
        case 'DefaultRed': return '#ff0000';
        case 'DefaultBlue': return '#0000ff';
        case 'Gold': return '#ffdb5a';
        case 'Overseer': return '#002633';
        default: return null; // Custom / undefined
    }
}
