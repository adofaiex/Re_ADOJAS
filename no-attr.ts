import type { Plugin } from 'vite';
import { parse } from 'node-html-parser';

/**
 * 需要添加 base 路径的属性列表
 */
const NEED_BASE_PATH_ATTRS = [
  'src',
  'data-src',
  'href',
  'data-href',
  'content', // 用于 meta 标签
  'background',
  'poster',
  'cite',
  'action',
  'formaction',
];

/**
 * 需要移除的属性列表（这些属性在静态部署中会导致问题）
 */
const REMOVE_ATTRS = [
  'nomodule',
  'crossorigin',
  'integrity',
];

/**
 * 需要移除的标签选择器
 */
const REMOVE_TAGS = [
  'link[rel="modulepreload"]',
  'link[rel="prefetch"]',
  'link[rel="preload"]',
];

/**
 * HTML 后处理插件配置选项
 */
export interface HtmlPostBuildOptions {
  /** 基础路径，默认为 './' */
  base?: string;
  /** 是否启用 base 路径处理，默认为 true */
  enableBasePath?: boolean;
  /** 需要添加 base 路径的自定义属性 */
  customBasePathAttrs?: string[];
  /** 需要移除的自定义属性 */
  customRemoveAttrs?: string[];
  /** 需要移除的自定义标签选择器 */
  customRemoveTags?: string[];
  /** 是否跳过外部链接（http://, https://, //），默认为 true */
  skipExternalLinks?: boolean;
}

/**
 * 检查是否为外部链接
 */
function isExternalLink(url: string): boolean {
  if (!url) return false;
  return url.startsWith('http://') || 
         url.startsWith('https://') || 
         url.startsWith('//') ||
         url.startsWith('data:') ||
         url.startsWith('blob:');
}

/**
 * 检查是否为需要添加 base 路径的资源
 */
function shouldAddBasePath(url: string, base: string, skipExternal: boolean): boolean {
  if (!url || !base) return false;
  if (skipExternal && isExternalLink(url)) return false;
  if (url.startsWith(base)) return false;
  if (url.startsWith('/')) return false;
  return true;
}

/**
 * 处理标签属性
 */
function processAttributes(
  element: any,
  options: HtmlPostBuildOptions
): void {
  const {
    base = './',
    enableBasePath = true,
    customBasePathAttrs = [],
    skipExternalLinks = true,
  } = options;

  const basePathAttrs = [...NEED_BASE_PATH_ATTRS, ...customBasePathAttrs];
  const removeAttrs = [...REMOVE_ATTRS];

  // 处理需要移除的属性
  removeAttrs.forEach(attrName => {
    if (element.hasAttribute(attrName)) {
      element.removeAttribute(attrName);
    }
  });

  // 特殊处理：将 type="module" 的 script 转换为普通脚本
  if (element.tagName === 'SCRIPT' && element.hasAttribute('type')) {
    const typeValue = element.getAttribute('type');
    if (typeValue === 'module') {
      // 移除 type 属性，使其成为普通脚本
      element.removeAttribute('type');
    }
  }

  // 处理需要添加 base 路径的属性
  if (enableBasePath && base && base !== '/') {
    basePathAttrs.forEach(attrName => {
      if (element.hasAttribute(attrName)) {
        const value = element.getAttribute(attrName);
        if (shouldAddBasePath(value, base, skipExternalLinks)) {
          // 确保 base 路径以 / 结尾
          const normalizedBase = base.endsWith('/') ? base : `${base}/`;
          const newValue = normalizedBase + value;
          element.setAttribute(attrName, newValue);
        }
      }
    });
  }
}

/**
 * 处理 HTML 内容
 */
function processHtml(html: string, options: HtmlPostBuildOptions): string {
  const root = parse(html);
  const {
    customRemoveTags = [],
  } = options;

  const removeTags = [...REMOVE_TAGS, ...customRemoveTags];

  // 移除不需要的标签
  removeTags.forEach(selector => {
    const elements = root.querySelectorAll(selector);
    elements.forEach((element: any) => {
      element.remove();
    });
  });

  // 处理 script 标签
  const scripts = root.querySelectorAll('script');
  scripts.forEach((script: any) => {
    processAttributes(script, options);
  });

  // 处理 link 标签
  const links = root.querySelectorAll('link');
  links.forEach((link: any) => {
    processAttributes(link, options);
  });

  // 处理 img 标签
  const images = root.querySelectorAll('img');
  images.forEach((img: any) => {
    processAttributes(img, options);
  });

  // 处理 meta 标签（某些 meta 标签可能需要 base 路径）
  const metas = root.querySelectorAll('meta');
  metas.forEach((meta: any) => {
    // 只处理 content 属性中的 URL
    const property = meta.getAttribute('property');
    const name = meta.getAttribute('name');
    if (property || name) {
      processAttributes(meta, options);
    }
  });

  // 处理 video 标签
  const videos = root.querySelectorAll('video');
  videos.forEach((video: any) => {
    processAttributes(video, options);
    // 处理 video 内部的 source 标签
    const sources = video.querySelectorAll('source');
    sources.forEach((source: any) => {
      processAttributes(source, options);
    });
  });

  // 处理 audio 标签
  const audios = root.querySelectorAll('audio');
  audios.forEach((audio: any) => {
    processAttributes(audio, options);
    // 处理 audio 内部的 source 标签
    const sources = audio.querySelectorAll('source');
    sources.forEach((source: any) => {
      processAttributes(source, options);
    });
  });

  // 处理 iframe 标签
  const iframes = root.querySelectorAll('iframe');
  iframes.forEach((iframe: any) => {
    processAttributes(iframe, options);
  });

  // 处理 embed 标签
  const embeds = root.querySelectorAll('embed');
  embeds.forEach((embed: any) => {
    processAttributes(embed, options);
  });

  // 处理 object 标签
  const objects = root.querySelectorAll('object');
  objects.forEach((object: any) => {
    processAttributes(object, options);
  });

  // 处理 a 标签的 href 属性（可选，通常不需要）
  const anchors = root.querySelectorAll('a');
  anchors.forEach((anchor: any) => {
    processAttributes(anchor, options);
  });

  return root.innerHTML;
}

/**
 * 创建 HTML 后处理插件
 */
export function htmlPostBuildPlugin(options: HtmlPostBuildOptions = {}): Plugin {
  return {
    name: 'html-post-build',
    enforce: 'post',
    apply: 'build',
    transformIndexHtml(html) {
      return processHtml(html, options);
    },
  };
}

/**
 * 默认导出，使用默认配置
 */
export default htmlPostBuildPlugin;