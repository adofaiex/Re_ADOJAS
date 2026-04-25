# Re_ADOJAS

一个轻量级的 ADOFAI（A Dance of Fire and Ice）谱面播放器，支持多平台运行。

## 技术栈

- **构建工具**: Vite
- **前端框架**: React 18
- **3D 渲染**: Three.js
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **UI 组件**: Radix UI
- **核心库**: [adofai](https://github.com/adofaiex/ADOFAI-JS)

## 功能特性

- 谱面播放：支持加载和播放 ADOFAI 谱面文件（.adofai、.json、.zip）
- 渲染后端：支持 WebGL 和 WebGPU（实验性）渲染
- 多线程渲染：使用 Web Worker 进行网格生成，提升性能
- 主题支持：支持浅色、深色和跟随系统主题
- 国际化：支持简体中文、英语、日语
- 媒体导入：
  - 支持加载音频文件
  - 支持导入视频背景
  - 支持导入装饰图片（支持多选）
  - 支持导入背景图片（支持多选）
- 性能优化：
  - 可调节目标帧率
  - 支持同步/异步渲染方法
  - 多种关卡加载方式（同步/异步/Worker）
- 视觉效果：
  - 星球拖尾效果
  - 打击音效
  - 谱面信息指示器（TBPM/CBPM/Map Time/Tiles 进度）
- 其他功能：
  - 全屏模式
  - FPS 显示
  - 性能监控面板

## 安装和运行

### 克隆项目

```bash
git clone https://github.com/adofaiex/Re_ADOJAS.git
cd Re_ADOJAS
```

### 安装依赖

```bash
# 使用 pnpm（推荐）
pnpm install

# 或使用 npm
npm install

# 或使用 yarn
yarn install
```

### 开发模式

```bash
pnpm dev
```

然后在浏览器中访问 `http://localhost:3144`

### 构建生产版本

```bash
pnpm build
```

### 预览生产构建

```bash
pnpm preview
```

## 项目结构

```
src/
├── components/      # React 组件
│   └── ui/         # UI 组件（基于 Radix UI）
├── control/        # 控制器
├── events/         # 事件处理
├── hooks/          # React Hooks
├── lib/            # 工具库
│   ├── Geo/       # 几何相关
│   ├── i18n/      # 国际化
│   └── Player/    # 播放器核心
├── pages/          # 页面组件
├── shaders/        # 着色器
└── sounds/         # 音效文件
```

## 支持平台

- Web（浏览器）
- 桌面（可通过 Electron 等打包）
- 移动端（响应式设计）

## 许可证

本项目遵循相应的开源许可证。
