/**
 * TextureCompress — 装饰/背景纹理的受控加载。
 *
 * ADOFAI 地图常含 4k-8k² 美术图：一张 8192² RGBA 纹理 = 256MB 显存，
 * 解码时全尺寸位图还会瞬时占用同等 CPU 内存，多张并发即 canvas 崩溃
 * （WebGL context lost）或页面 OOM。这里统一：
 *   1. 从文件头嗅探原始尺寸（PNG/JPEG/GIF/WebP/BMP）
 *   2. 超限时由浏览器在解码阶段直接缩放（createImageBitmap resize），
 *      全尺寸位图从不进入 JS 堆；个别浏览器忽略 resize 参数时用 canvas 兜底
 *   3. 未超限则位图直传，零拷贝
 *   4. 默认不生成 mipmap（+33% 显存），由调用方按需开启（须在首次上传前）
 */
import { LinearFilter, SRGBColorSpace, Texture } from 'three';

export const MAX_TEX_DIMENSION = 2048;

/** 从文件头嗅探图片像素尺寸（PNG/JPEG/GIF/WebP/BMP），失败返回 null。 */
export function sniffImageDimensions(head: Uint8Array): { w: number; h: number } | null {
    const u8 = head;
    const u32be = (o: number) => ((u8[o] << 24) | (u8[o + 1] << 16) | (u8[o + 2] << 8) | u8[o + 3]) >>> 0;
    const u16le = (o: number) => u8[o] | (u8[o + 1] << 8);
    try {
        // PNG
        if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) {
            return { w: u32be(16), h: u32be(20) };
        }
        // JPEG: 扫描 SOF 段
        if (u8[0] === 0xFF && u8[1] === 0xD8) {
            let o = 2;
            while (o + 9 < u8.length) {
                if (u8[o] !== 0xFF) { o++; continue; }
                const marker = u8[o + 1];
                if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                    return { w: (u8[o + 7] << 8) | u8[o + 8], h: (u8[o + 5] << 8) | u8[o + 6] };
                }
                const len = (u8[o + 2] << 8) | u8[o + 3];
                o += 2 + len;
            }
            return null;
        }
        // GIF
        if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x38) {
            return { w: u16le(6), h: u16le(8) };
        }
        // WebP (RIFF)
        if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 && u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) {
            const fourcc = String.fromCharCode(u8[12], u8[13], u8[14], u8[15]);
            if (fourcc === 'VP8 ') return { w: u16le(26) & 0x3FFF, h: u16le(28) & 0x3FFF };
            if (fourcc === 'VP8L') {
                const b = (u8[21] << 16) | (u8[20] << 8) | u8[19];
                return { w: (b & 0x3FFF) + 1, h: ((b >> 14) & 0x3FFF) + 1 };
            }
            if (fourcc === 'VP8X') {
                const w24 = (u8[24] | (u8[25] << 8) | (u8[26] << 16)) + 1;
                const h24 = (u8[27] | (u8[28] << 8) | (u8[29] << 16)) + 1;
                return { w: w24, h: h24 };
            }
            return null;
        }
        // BMP
        if (u8[0] === 0x42 && u8[1] === 0x4D && u8.length >= 26) {
            const s32 = (o: number) => (u8[o] | (u8[o + 1] << 8) | (u8[o + 2] << 16) | (u8[o + 3] << 24));
            return { w: Math.abs(s32(18)), h: Math.abs(s32(22)) };
        }
    } catch { /* fallthrough */ }
    return null;
}

/** canvas 双线性缩放兜底（浏览器不支持 createImageBitmap resize 时）。 */
async function downscaleBitmap(src: ImageBitmap, maxDim: number): Promise<ImageBitmap> {
    const scale = maxDim / Math.max(src.width, src.height);
    const cw = Math.max(1, Math.round(src.width * scale));
    const ch = Math.max(1, Math.round(src.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(src, 0, 0, cw, ch);
    src.close();
    return createImageBitmap(canvas);
}

/**
 * 受控纹理加载：fetch → 头部探尺寸 → 超限解码即缩放 → 位图直传。
 * 返回的纹理已配置 sRGB、Linear 过滤、无 mipmap（调用方可在首次渲染前改）。
 * 失败返回 null。
 */
export async function loadCompressedTexture(url: string, maxDim: number = MAX_TEX_DIMENSION): Promise<Texture | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();

        let bitmap: ImageBitmap;
        try {
            // 先探测尺寸：超限才带 resize 解码，避免无谓的重采样开销
            const head = new Uint8Array(await blob.slice(0, 64 * 1024).arrayBuffer());
            const dims = sniffImageDimensions(head);
            if (dims && Math.max(dims.w, dims.h) > maxDim) {
                const scale = maxDim / Math.max(dims.w, dims.h);
                bitmap = await createImageBitmap(blob, {
                    resizeWidth: Math.max(1, Math.round(dims.w * scale)),
                    resizeHeight: Math.max(1, Math.round(dims.h * scale)),
                    resizeQuality: 'medium',
                    premultiplyAlpha: 'none',
                });
                // 个别浏览器忽略 resize 参数 → 兜底 canvas 缩放
                if (Math.max(bitmap.width, bitmap.height) > maxDim + 1) {
                    bitmap = await downscaleBitmap(bitmap, maxDim);
                }
            } else if (dims) {
                bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none' });
            } else {
                // 头部无法识别的格式：解码后按需 canvas 缩放
                bitmap = await createImageBitmap(blob);
                if (Math.max(bitmap.width, bitmap.height) > maxDim) {
                    bitmap = await downscaleBitmap(bitmap, maxDim);
                }
            }
        } catch {
            // createImageBitmap 不可用（老浏览器）：退回 <img> 全尺寸路径
            return await new Promise<Texture | null>((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const tex = new Texture(img);
                    tex.colorSpace = SRGBColorSpace;
                    tex.generateMipmaps = false;
                    tex.minFilter = LinearFilter;
                    tex.magFilter = LinearFilter;
                    resolve(tex);
                };
                img.onerror = () => resolve(null);
                img.src = url;
            });
        }

        const tex = new Texture(bitmap as unknown as HTMLImageElement);
        tex.colorSpace = SRGBColorSpace;
        tex.generateMipmaps = false;
        tex.minFilter = LinearFilter;
        tex.magFilter = LinearFilter;
        tex.needsUpdate = true;
        return tex;
    } catch (err) {
        console.warn('[TextureCompress] load failed:', url, err);
        return null;
    }
}
