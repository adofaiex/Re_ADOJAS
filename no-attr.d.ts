import type { Plugin } from 'vite';
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
 * 创建 HTML 后处理插件
 */
export declare function htmlPostBuildPlugin(options?: HtmlPostBuildOptions): Plugin;
/**
 * 默认导出，使用默认配置
 */
export default htmlPostBuildPlugin;
