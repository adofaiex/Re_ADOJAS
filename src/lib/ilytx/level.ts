/**
 * Level ↔ ilybin 数据的双向桥。
 *
 * - extractIlybinData(level)：从**运行中的 Level**（含编辑覆盖层）提取核心数据。
 *   读取路径就是库自身 export() 的权威路径（flatten* 系列），保证与 .adofai
 *   文本导出同保真。
 * - levelFromIlybin(data)：**不走 Level.load()** —— 直接组装 public 字段
 *   （settings / angleData / actions / __decorations / tiles），跳过 JSON 解析、
 *   对象构建与位置计算。相对角由 ilybin 解码端从 direction+twirl 轻量重建
 *   （单循环 O(n)，见 ilybin.reconstructAngle；angle 段 v2 起不再落盘）。
 *   Level 的这些字段全部是 public，库（ADOFAI-JS）也是同作者，无需打 patch。
 */

import { Level, Structure } from 'adofai'
import type { Tile } from 'adofai/structure'
import { decodeIlybin, encodeIlybin, TILE_MODE_COMPACT, TILE_MODE_OBJECT } from './ilybin.ts'
import type { IlybinData } from './ilybin.ts'

type CompactStore = Structure.CompactTileStore

function isCompact(tiles: unknown): tiles is CompactStore {
  return tiles instanceof Structure.CompactTileStore
}

/** 紧凑 store 带编辑覆盖层时，物化出应用覆盖后的数组；无编辑直接复用 typed array。 */
function materializeCompact(store: CompactStore): {
  direction: ArrayLike<number>
  angle: ArrayLike<number>
  twirl: ArrayLike<number>
} {
  if (!store.hasEdits()) {
    return { direction: store.direction, angle: store.angle, twirl: store.twirl }
  }
  const n = store.length
  // flattenAngleData 已处理 direction 的覆盖层；angle/twirl 需要手动套 overlay
  const direction = store.flattenAngleData()
  const angle = new Float64Array(n)
  const twirl = new Float64Array(n)
  const overlay = (store as unknown as { overlay?: Map<number, Partial<Tile>> }).overlay
  for (let i = 0; i < n; i++) {
    const o = overlay?.get(i)
    angle[i] = (o?.angle as number | undefined) ?? store.angle[i]
    twirl[i] = (o?.twirl as number | undefined) ?? store.twirl[i]
  }
  // 只有被编辑过的角标被覆盖，其余保持 store 原值 —— overlay 通常极小
  if (overlay) {
    for (const [i, t] of overlay) {
      if (t.direction !== undefined) direction[i] = t.direction as number
    }
  }
  return { direction, angle, twirl }
}

/** 从运行中的 Level 提取 ilybin 载荷（导出路径）。 */
export function extractIlybinData(level: Level): IlybinData {
  const settings = level.settings ?? {}

  if (isCompact(level.tiles)) {
    const store = level.tiles
    const { direction, angle, twirl } = materializeCompact(store)

    const extraMap = (store as unknown as { extraPropsByFloor?: Map<number, Record<string, unknown>> })
      .extraPropsByFloor
    const extraProps =
      extraMap && extraMap.size > 0 ? Array.from(extraMap.entries()) : null

    return {
      tileMode: TILE_MODE_COMPACT,
      tileCount: store.length,
      settings,
      direction,
      angle,
      twirl,
      // flattenActions/Decorations 是库的权威导出路径：处理覆盖层 + Twirl 差分还原
      actions: store.flattenActions() as unknown as Array<Record<string, unknown>>,
      decorations: store.flattenDecorations() as unknown as Array<Record<string, unknown>>,
      extraProps,
    }
  }

  // 对象模式（默认 <20 万砖）：逐砖读取，镜像 flattenActionsWithFloor 的产物
  const tiles = (level.tiles ?? []) as Tile[]
  const n = tiles.length
  const direction = new Float64Array(n)
  const angle = new Float64Array(n)
  const twirl = new Float64Array(n)
  const actions: Array<Record<string, unknown>> = []
  const decorations: Array<Record<string, unknown>> = []
  const extraProps: Array<[number, Record<string, unknown>]> = []

  for (let i = 0; i < n; i++) {
    const t = tiles[i]
    direction[i] = t.direction ?? 0
    angle[i] = t.angle ?? 0
    twirl[i] = t.twirl ?? 0
    if (Array.isArray(t.actions)) {
      for (const a of t.actions) actions.push({ floor: i, ...a })
    }
    if (Array.isArray(t.addDecorations)) {
      for (const d of t.addDecorations) decorations.push({ floor: i, ...d })
    }
    if (t.extraProps && Object.keys(t.extraProps).length > 0) {
      extraProps.push([i, t.extraProps])
    }
  }

  return {
    tileMode: TILE_MODE_OBJECT,
    tileCount: n,
    settings,
    direction,
    angle,
    twirl,
    actions,
    decorations,
    extraProps: extraProps.length > 0 ? extraProps : null,
  }
}

/** 编码（便捷入口）。 */
export function levelToIlybin(level: Level): Uint8Array {
  return encodeIlybin(extractIlybinData(level))
}

/**
 * 解码并**直接组装 Level**（不调用 load()）。
 *
 * 重建规则严格镜像 createTiles 的两种模式：
 *   - 紧凑：typed array 填 CompactTileStore，Twirl 从 actions 过滤掉
 *     （store.twirl 已是累计计数），root actions 按 floor 保留；
 *   - 对象：逐砖建 Tile，actions 按 floor 剥离 floor 字段，Twirl 事件保留
 *     （对象模式的 tile.actions 本来就含 Twirl），_lastdir 按
 *     `angleData[i-1] || 0` 派生（与库一致，故不落盘）。
 */
export function levelFromIlybin(data: IlybinData): Level {
  const n = data.tileCount
  const compact = data.tileMode === TILE_MODE_COMPACT

  // 构造后不 load()，只借 constructor 初始化内部 Map
  const level = new Level({
    settings: data.settings,
    angleData: [],
    actions: [],
    decorations: [],
  })

  level.settings = data.settings as Record<string, never>
  // angleData 在 app 内仅作只读数据源（无数组方法调用），typed array 安全
  level.angleData = data.direction as unknown as number[]

  if (compact) {
    const store = new Structure.CompactTileStore(n)
    store.direction.set(data.direction as ArrayLike<number>)
    store.angle.set(data.angle as ArrayLike<number>)
    store.twirl.set(data.twirl as ArrayLike<number>)

    const actions: Array<Record<string, unknown>> = []
    for (const a of data.actions) {
      const floor = a.floor as number
      if (a.eventType === 'Twirl') continue // 镜像库的紧凑剥离：Twirl 语义在 store.twirl 里
      if (floor == null || floor < 0 || floor >= n) continue
      const { floor: _f, ...rest } = a
      let list = store.actionsByFloor.get(floor)
      if (!list) store.actionsByFloor.set(floor, (list = []))
      list.push(rest as never)
      actions.push(a)
    }
    for (const d of data.decorations) {
      const floor = d.floor as number
      if (floor == null || floor < 0 || floor >= n) continue
      const { floor: _f, ...rest } = d
      let list = store.decorationsByFloor.get(floor)
      if (!list) store.decorationsByFloor.set(floor, (list = []))
      list.push(rest as never)
    }
    if (data.extraProps) {
      const map = new Map<number, Record<string, unknown>>()
      for (const [floor, props] of data.extraProps) {
        if (floor >= 0 && floor < n) map.set(floor, props)
      }
      ;(store as unknown as { extraPropsByFloor?: Map<number, Record<string, unknown>> }).extraPropsByFloor = map
    }

    level.tiles = store
    level.actions = actions as never
  } else {
    const byFloorActions = new Map<number, Array<Record<string, unknown>>>()
    const byFloorDecos = new Map<number, Array<Record<string, unknown>>>()
    for (const a of data.actions) {
      const floor = a.floor as number
      if (floor == null || floor < 0 || floor >= n) continue
      let list = byFloorActions.get(floor)
      if (!byFloorActions.has(floor)) byFloorActions.set(floor, (list = []))
      const { floor: _f, ...rest } = a
      list!.push(rest)
    }
    for (const d of data.decorations) {
      const floor = d.floor as number
      if (floor == null || floor < 0 || floor >= n) continue
      let list = byFloorDecos.get(floor)
      if (!byFloorDecos.has(floor)) byFloorDecos.set(floor, (list = []))
      const { floor: _f, ...rest } = d
      list!.push(rest)
    }
    const extraByFloor = new Map<number, Record<string, unknown>>(data.extraProps ?? [])

    const dir = data.direction
    const tiles: Tile[] = new Array(n)
    for (let i = 0; i < n; i++) {
      const prev = i > 0 ? dir[i - 1] : 0
      tiles[i] = {
        direction: dir[i],
        _lastdir: (Number.isFinite(prev) ? prev : 0) || 0,
        actions: (byFloorActions.get(i) ?? []) as never,
        angle: data.angle[i],
        addDecorations: (byFloorDecos.get(i) ?? []) as never,
        twirl: data.twirl[i],
        extraProps: extraByFloor.get(i) ?? {},
      }
    }
    level.tiles = tiles
    // 对象模式 root actions 保留（含 Twirl），与库 load() 行为一致
    level.actions = data.actions as never
  }

  level.__decorations = data.decorations as never
  return level
}

/** 便捷：字节 → Level（解码 + 组装）。 */
export function levelFromIlybinBytes(bytes: Uint8Array): Level {
  return levelFromIlybin(decodeIlybin(bytes))
}
