# Player 模块架构

本目录包含 ADOFAI 谱面播放器的核心模块。

## 当前结构

### 核心文件
- **Player.ts** (~2750 行) - 主播放器类，协调所有功能
- **types.ts** - TypeScript 接口和类型定义

### 管理器类（已集成）
- **CameraController.ts** - 镜头移动与过渡动画
- **TileColorManager.ts** - 砖块颜色配置与事件处理
- **DecorationManager.ts** - 装饰物渲染
- **MoveTrackManager.ts** - MoveTrack 事件处理
- **PositionTrackManager.ts** - PositionTrack 坐标变换
- **HitsoundManager.ts** - 打击音效合成与播放

### 管理器类（新增 - 可用于未来重构）
- **TileRenderer.ts** (~450 行) - 砖块网格创建、可见性判断、缓存管理
- **VideoBackground.ts** (~230 行) - 视频背景播放
- **InputHandler.ts** (~210 行) - 鼠标/触摸输入处理
- **EffectsManager.ts** (~440 行) - 视觉特效管理（Bloom、Flash、Recolor、CustomBG）

### 特效类
- **BloomEffect.ts** - Bloom（光晕）后处理特效
- **FlashEffect.ts** - Flash（闪光）覆盖层特效

### 其他
- **Planet.ts** - 玩家行星网格
- **PlanetTrail.ts** - 行星轨迹特效
- **Easing.ts** - 缓动函数
- **HTMLAudioMusic.ts** - 基于 AudioContext 同步的音频播放

## 未来重构指南

Player.ts 文件因功能累积已变得较大。重构方案如下：

1. **砖块渲染** - 迁移至 TileRenderer.ts：
   - updateVisibleTiles()
   - getOrCreateTileMesh()
   - cleanupTileCache()
   - buildSpatialIndex()
   - 相关变量：tiles, visibleTiles, spatialGrid, geometryCache

2. **视频背景** - 迁移至 VideoBackground.ts：
   - loadVideo()
   - updateVideoSize()
   - syncVideo()
   - 相关变量：videoElement, videoTexture, videoMesh

3. **输入处理** - 迁移至 InputHandler.ts：
   - onMouseDown/Move/Up()
   - onWheel()
   - onTouchStart/Move/End()
   - 相关变量：isDragging, previousMousePosition 等

4. **视觉特效** - 迁移至 EffectsManager.ts：
   - buildBloomTimeline(), processBloomEvent()
   - buildFlashTimeline(), processFlashEvent()
   - buildRecolorTimeline(), processRecolorEvent()
   - 相关变量：bloomTimeline, flashTimeline 等

## 集成模式

集成时使用委托模式：

```typescript
class Player {
  private tileRenderer: TileRenderer;
  
  constructor() {
    this.tileRenderer = new TileRenderer(
      this.scene,
      this.camera,
      this.levelData,
      this.tileColorManager,
      this.positionTrackManager,
      this.tileEvents
    );
  }
  
  private updateVisibleTiles(): void {
    this.tileRenderer.setCameraPosition(this.cameraPosition);
    this.tileRenderer.updateVisibleTiles();
  }
}
```

## 为何尚未重构？

当前 Player.ts 运行稳定且功能正常。大规模重构存在以下风险：
- 可能引入新 bug
- 需要大量测试
- 可能破坏现有功能

新增的管理器类作为**基础框架**，可在以下时机进行重构：
- 时间充裕、可充分测试时
- 代码库需要架构优化时
- 需要性能优化时

## 代码行数统计

| 文件 | 行数 | 用途 |
|------|------|------|
| Player.ts | ~2750 | 主协调器 |
| TileRenderer.ts | ~450 | 砖块渲染（新增） |
| EffectsManager.ts | ~440 | 视觉特效（新增） |
| VideoBackground.ts | ~230 | 视频播放（新增） |
| InputHandler.ts | ~210 | 输入处理（新增） |

新增模块化代码总计：~1330 行

若完全集成，Player.ts 可从 ~2750 行缩减至 ~1500 行。
