# Camera Controller 架构说明

## 总体架构

CameraController 负责 ADOFAI 风格摄像机运镜的**时间线预计算**与**运行时逐帧驱动**。整体分为三个层次：

```
┌─────────────────────────────────────────────────────┐
│                   Player.ts 更新循环                  │
│  (每帧: 取插值 → 处理事件 → 再插值 → 计算世界坐标    │
│   → 平滑 → 应用到 Three.js Camera)                   │
└──────────────┬────────────────────────────┬──────────┘
               │ 使用                        │ 使用
               ▼                             ▼
┌─────────────────────────┐ ┌────────────────────────────┐
│  CameraController       │ │  CameraController          │
│  (预计算阶段)            │ │  (运行时阶段)               │
│                         │ │                            │
│  buildCameraTimeline()  │ │  update()                  │
│                         │ │  processCameraEvent()      │
│                         │ │  getInterpolatedValues()   │
│                         │ │  calculateTargetPosition() │
└─────────────────────────┘ └────────────────────────────┘
```

---

## 一、预计算阶段 — 时间线构建

### `buildCameraTimeline(tileCameraEvents: Map<number, any[]>)`

**入口**：`Player.ts:259`，在谱面加载完成后调用。

**输入**：`tileCameraEvents` — 按砖块 floor 分组的 Camera 事件列表。

**步骤**：

1. **遍历每个 floor 的事件组**，对每个事件：
   - 计算事件基准时间：`startTime = tileStartTimes[floor]`（该砖块的绝对开始时间）
   - 计算拍长：`secPerBeat = 60 / bpm`
   - 由 `angleOffset` 计算时间偏移：`timeOffset = (angleOffset / 180) * secPerBeat`
     - ADOFAI 中 180° = 1 拍
   - 跳过被禁用的事件（`isEventActive(event)` 返回 false）

2. **同一 floor 多个 angleOffset=0 事件的特殊处理**：
   - 如果多个事件在同一 floor 上且 angleOffset 都为 0，按 id 顺序依次添加 0.1ms 微增量
   - 确保它们在时间线上有确定性的先后顺序，而非同时触发

3. **全局排序**：
   - 主键：`eventTime`（升序）
   - 副键：`event.id`（升序，用于时间差 < 0.1ms 的事件）

### 预计算的核心作用

将 ADOFAI 的"砖块 + angleOffset"时间表达方式，转换为**绝对时间线**（`CameraTimelineEntry[]`），运行时不再需要 BPM 换算。

```
存储结构:
┌────────────────────────────────────────────────────────┐
│ cameraTimeline: CameraTimelineEntry[]                  │
│  [0] { time: 1.234, event: {...} }                    │
│  [1] { time: 1.567, event: {...} }                    │
│  [2] { time: 1.567, event: {...} }  ← 同时间按id排序  │
│  ...                                                   │
│                                                        │
│ lastCameraTimelineIndex: number  ← 记录已处理到的位置  │
└────────────────────────────────────────────────────────┘
```

---

## 二、运行时处理 — 事件驱动

### 更新入口：`update(elapsedTime: number)`

**调用频率**：每帧一次，由 `Player.ts` 的更新循环驱动。

**逻辑**：

```
从 lastCameraTimelineIndex + 1 开始遍历 timeline
  └── 如果 entry.time <= elapsedTime（事件已到触发时间）
       └── 调用 processCameraEvent() 处理该事件
       └── lastCameraTimelineIndex = i
  └── 否则 break（未来的事件，等待后续帧）
```

这是典型的**游标推进**模式——每次更新只处理"已到达但尚未处理"的事件，时间复杂度 O(n) 但分摊为 O(1)。

### 核心处理：`processCameraEvent(event, floorIndex, elapsedTime, cameraSnapshot, currentPivotPosition)`

按以下顺序处理事件参数：

#### 1. 冲突检测与旧过渡终止

检查当前事件将修改哪些属性（position / rotation / zoom），如果有同属性的活跃过渡，立即**瞬移结束**旧过渡。这确保新事件抢占时不会出现位置冲突。

#### 2. 参考系更新（relativeTo）

| relativeTo | 行为 |
|---|---|
| `'Player'` | position 是相对于星球中心(planat)的偏移量。进入 Player 模式时将当前世界坐标转换为星球相对坐标 |
| `'Tile'` | position 是相对于锚点砖块的偏移量。记录 `lastEventRelativePosition` 为砖块位置 |
| `'Global'` | position 是绝对世界坐标。`lastEventRelativePosition` 置零 |
| `'LastPosition'` | position 在世界空间中累加。继承当前摄像机角度作为 rotationOffset |
| `'LastPositionNoRotation'` | 同 LastPosition，但不继承角度 |
| `undefined` | 沿用 `lastUsedMovementType`，不改变参考系 |

当 `relativeTo` 为数值类型时，映射表为：
```
0 → 'Player', 1 → 'Tile', 2 → 'Global',
3 → 'LastPosition', 4 → 'LastPositionNoRotation'
```

#### 3. 位置更新（position）

- **Player / Tile / Global 模式**：position 是**绝对赋值**（在各自参考系下）
- **LastPosition 系列**：position 是**累加**（`cameraMode.position += event.position`）
- 位置值乘以 `TILE_SIZE = 1.0`
- 特殊处理：`[null, null]` 视为 position 未指定，保持当前位置
- `position` 的两个分量可独立为 null，分别只更新非 null 分量

#### 4. 旋转更新（rotation）

- 始终绝对赋值
- LastPosition 模式增加 `rotationOffset`（继承当前摄像机角度）
- 单位：度

#### 5. 缩放更新（zoom）

- 始终绝对赋值
- 单位：百分比（100 = 原始大小）

#### 6. 角度偏移更新（angleOffset）

- 直接记录，用于后续事件的 timing

#### 7. 过渡动画设置

```
durationSeconds = event.duration * (60 / eventBPM)
```

- 高 BPM 检测：如果 `eventBPM > 20000` 且模式为 Player，强制 `duration = 0`（瞬移）
- `durationSeconds ≤ 0` → 无过渡，立即跳转
- `durationSeconds > 0` → 记录 startSnapshot（过渡起点）、targetSnapshot（终点）、ease 函数名

**关键设计**：startSnapshot 在参考系变更时，会使用 cameraSnapshot 将起点从旧参考系转换到新参考系，确保过渡从当前实际摄像机位置开始。

---

## 三、插值与坐标计算

### `getInterpolatedValues(elapsedTime)`

在过渡动画期间返回插值后的逻辑坐标：

```
t = (elapsedTime - transition.startTime) / transition.duration
progress = EasingFunctions[ease](t)

logicalPos.x = start.logicalPosition.x + (target.position.x - start.logicalPosition.x) * progress
```

需要提供 30+ 种缓动函数（Linear, Sine, Quad, Cubic, Quart, Quint, Expo, Circ, Back, Elastic, Bounce, Flash 的 In/Out/InOut 变体）。

当过渡完成（`t ≥ 1`）时，自动标记 `transition.active = false`。

### `calculateTargetPosition(currentPivotPosition, interpolatedLogicalPos?)`

将逻辑坐标转换为世界坐标：

| 参考系 | 世界坐标公式 |
|---|---|
| Player | `planetPos + logicalPos` |
| Tile | `tile.position + logicalPos` |
| Global | `logicalPos`（直接使用） |
| LastPosition | `logicalPos`（已累加为世界坐标） |

---

## 四、特殊处理细节

### LastPosition 参考系回溯

`findRealRelativeTo()` 方法：当事件使用 LastPosition 系列参考系时，沿时间线**向前回溯**，找到第一个非 LastPosition 的真实参考系。回溯过程中累加所有经过的 LastPosition 事件的 position。

### 参考系切换时的坐标转换

从 Tile/Global 切换到 Player 模式时，需要将当前位置从世界坐标转换为星球相对坐标：

```
cameraMode.position = worldTarget - planetPos
```

这个转换在 `processCameraEvent` 中通过 `calculateTargetPosition()` + 当前参考系的逆向计算完成。

### Player.ts 中的集成逻辑

在 `Player.ts` 的更新循环中（约第 2620-2710 行），摄像机处理顺序为：

```
1. 倒带检测：如果时间线回退（timeInLevel < 当前entry.time），重置状态
2. 预事件插值：获取当前帧的插值摄像机位置（用于过渡中截取快照）
3. 事件处理：按时间线推进，处理所有已到达的事件
4. 后事件插值：再次获取插值后的摄像机值
5. 计算世界坐标：用 calculateTargetPosition 将逻辑坐标转为世界坐标
6. 平滑：对摄像机应用阻尼平滑（smoothingIndex 基于 BPM 动态计算）
7. 应用：将平滑后的 position/zoom/rotation 设置到 Three.js Camera
```

**关键设计**：第 2 步和第 4 步分离——先用当前插值状态生成 cameraSnapshot，确保新事件在过渡中途触发时，起始点是过渡中间位置而非过渡前位置，避免视觉跳变。

---

## 五、核心数据结构

```
CameraMode             当前摄像机模式
├── relativeTo         参考系 (Player/Tile/Global/LastPosition/LastPositionNoRotation)
├── anchorTileIndex    锚点砖块索引 (Tile 模式)
├── position           逻辑位置（参考系含义不同）
├── zoom               缩放百分比
├── rotation           旋转角度
├── angleOffset        角度偏移
└── lastEventRelativePosition  上一个事件的参考位置

CameraTransition       过渡动画状态
├── active             是否活跃
├── startTime          开始时间
├── duration           持续时间
├── startSnapshot      起点快照 (position/zoom/rotation + logical 版本)
├── targetSnapshot     终点快照
└── ease               缓动函数名

CameraTimelineEntry    时间线条目
├── time               绝对时间（秒）
└── event              原始事件数据（附带了 floor 信息）
```

---

## 六、与 ADOFAI Unity 实现的对应关系

| CameraController.ts | ADOFAI ffcCameraPlus.cs | 说明 |
|---|---|---|
| `cameraMode.relativeTo` | `cam.movementType` | 参考系类型 |
| `cameraMode.position` | `camParent.position` | 逻辑位置（参考系相对/绝对含义随模式变化） |
| `cameraMode.lastEventRelativePosition` | `cam.lastEventRelativePosition` | 上一事件参考位置 |
| `effectiveWorldTarget` | `camParent.position`（世界空间） | 追踪世界空间目标位置 |
| `lastUsedMovementType` | `cam.lastUsedMovementType` | 上次使用的移动类型 |
| `findRealRelativeTo()` | 回溯查找逻辑 | LastPosition 系列参考系解析 |
| `calculateTargetPosition()` | `getTargetPosition()` | 逻辑→世界坐标转换 |
