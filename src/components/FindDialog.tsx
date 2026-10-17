import { useEffect, useMemo, useRef, useState } from "react"

/**
 * 高级查找对话框（Ctrl+F 打开）。
 *
 * 支持：
 *   1234              砖号
 *   1:23.456 / 1:23   分:秒
 *   83.5s / 83.5      秒（纯小数；整数留给砖号）
 *   83456ms           毫秒
 *   event:MoveTrack   含该类型事件的砖
 *   tag:xxx           事件的 eventTag / 自身 tag 匹配
 *   bpm:200           该砖 BPM 匹配（±0.5）
 *   style:Neon        该砖 trackStyle 匹配
 *
 * 交互：↑↓ 选择、Enter 跳转、Esc 关闭。
 * 跳转会选中砖并把播放头 seek 到该砖入场时间。
 */

interface FindDialogProps {
  isOpen: boolean
  onClose: () => void
  /** Player 实例（用其中的 levelData / getTileTimeMs / selectTile / seekTo）。 */
  player: any
  isDark: boolean
}

interface FindResult {
  floor: number
  /** 砖入场时间（秒） */
  time: number
  label: string
}

const MAX_RESULTS = 60

export function FindDialog({ isOpen, onClose, player, isDark }: FindDialogProps) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    // 打开时清空并聚焦
    setQuery("")
    setSelected(0)
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [isOpen])

  const total = useMemo(() => {
    if (!isOpen || !player) return 0
    return player.levelData?.tiles?.length ?? player.levelData?.angleData?.length ?? 0
  }, [isOpen, player])

  const results = useMemo<FindResult[]>(() => {
    if (!isOpen || !player || !query.trim()) return []
    return search(player, query.trim(), total)
  }, [isOpen, player, query, total])

  useEffect(() => {
    if (selected >= results.length) setSelected(0)
  }, [results.length, selected])

  if (!isOpen) return null

  const gotoTile = (floor: number): void => {
    try {
      player?.selectTile?.(floor, true)
      const ms = player?.getTileTimeMs?.(floor)
      if (typeof ms === "number" && Number.isFinite(ms)) {
        player?.seekTo?.(Math.max(0, ms))
      }
    } catch (e) {
      console.warn("[FindDialog] 跳转失败:", e)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (results.length) setSelected((s) => (s + 1) % results.length)
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (results.length) setSelected((s) => (s - 1 + results.length) % results.length)
      return
    }
    if (e.key === "Enter") {
      e.preventDefault()
      const r = results[selected]
      if (r) { gotoTile(r.floor); onClose() }
    }
  }

  const surface = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
  const inputCls = isDark
    ? "bg-slate-900/60 text-white placeholder-slate-500"
    : "bg-slate-50 text-slate-900 placeholder-slate-400"

  return (
    <div
      className="fixed inset-0 z-[100001] flex items-start justify-center pt-[12vh] bg-black/45"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`w-[560px] max-w-[92vw] rounded-xl border shadow-2xl overflow-hidden ${surface}`}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
          onKeyDown={onKeyDown}
          placeholder="砖号 / 1:23.456 / 83.5s / 83456ms / event:MoveTrack / tag:xx / bpm:200 / style:Neon"
          className={`w-full px-4 py-3.5 outline-none text-[15px] ${inputCls}`}
        />

        <div className={`max-h-[46vh] overflow-y-auto border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
          {results.length === 0 ? (
            <div className={`px-4 py-3.5 text-[13px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              {query.trim() ? "没有匹配结果" : "输入以查找（↑↓ 选择，Enter 跳转，Esc 关闭）"}
            </div>
          ) : (
            results.map((r, i) => (
              <div
                key={`${r.floor}-${i}`}
                onMouseEnter={() => setSelected(i)}
                onMouseDown={(e) => { e.preventDefault(); gotoTile(r.floor); onClose() }}
                className={`px-4 py-2 text-[13px] cursor-pointer ${
                  i === selected
                    ? "bg-purple-600 text-white"
                    : isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                {r.label}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ── 查询解析 ─────────────────────────────────────────────── */

function search(player: any, q: string, total: number): FindResult[] {
  if (total <= 0) return []
  const timeOf = (i: number): number => {
    const ms = player?.getTileTimeMs?.(i)
    return typeof ms === "number" && Number.isFinite(ms) ? ms / 1000 : 0
  }
  const bpm: ArrayLike<number> | undefined = player?.tileBPM ?? player?.levelData?.tileBPM
  const mk = (floor: number, label: string): FindResult => ({ floor, time: timeOf(floor), label })

  // event: / tag: / bpm: / style:
  const m = /^(event|tag|bpm|style):(.*)$/i.exec(q)
  if (m) {
    const key = m[1].toLowerCase()
    const val = m[2].trim()
    const out: FindResult[] = []

    if (key === "event" || key === "tag") {
      const actions: any[] = player?.levelData?.actions ?? []
      const seen = new Set<number>()
      for (const a of actions) {
        const f = a?.floor
        if (typeof f !== "number" || f < 0 || f >= total || seen.has(f)) continue
        const hit = key === "event"
          ? String(a.eventType ?? "").toLowerCase().includes(val.toLowerCase())
          : (String(a.eventTag ?? "").includes(val) || String(a.tag ?? "").includes(val))
        if (!hit) continue
        seen.add(f)
        out.push(mk(f, `#${f}  ${a.eventType}${a.eventTag ? " " + a.eventTag : ""}`))
        if (out.length >= MAX_RESULTS) break
      }
      return out
    }

    if (key === "bpm") {
      const target = Number(val)
      if (!Number.isFinite(target) || !bpm) return []
      for (let i = 0; i < total; i++) {
        if (Math.abs((bpm[i] ?? 0) - target) < 0.5) {
          out.push(mk(i, `#${i}  BPM ${(bpm[i] ?? 0).toFixed(2)}`))
          if (out.length >= MAX_RESULTS) break
        }
      }
      return out
    }

    // style：走 tileColorManager 的逐砖配置
    const tcm: any = player?.tileColorManager
    for (let i = 0; i < total; i++) {
      const st = String(tcm?.getTileRecolorConfig?.(i)?.trackStyle ?? "Standard")
      if (st.toLowerCase().includes(val.toLowerCase())) {
        out.push(mk(i, `#${i}  ${st}`))
        if (out.length >= MAX_RESULTS) break
      }
    }
    return out
  }

  // 时间戳
  const t = parseTimeQuery(q)
  if (t !== null) {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < total; i++) {
      const d = Math.abs(timeOf(i) - t)
      if (d < bestD) { bestD = d; best = i }
    }
    const exact = bestD < 0.001
    return [mk(best, `#${best}  ${formatTime(timeOf(best))}${exact ? "（精确）" : `（最近，差 ${bestD.toFixed(3)}s）`}`)]
  }

  // 纯数字（或 #123）→ 砖号
  const idText = q.replace(/^#/, "")
  if (/^\d+$/.test(idText)) {
    const f = parseInt(idText, 10)
    if (f < 0 || f >= total) return []
    const bpmText = bpm ? `  BPM ${(bpm[f] ?? 0).toFixed(2)}` : ""
    return [mk(f, `#${f}  ${formatTime(timeOf(f))}${bpmText}`)]
  }

  return []
}

/** mm:ss(.ms) / Nms / Ns / 纯小数（秒） */
function parseTimeQuery(q: string): number | null {
  const mmss = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(q)
  if (mmss) return parseInt(mmss[1], 10) * 60 + parseFloat(mmss[2])
  const ms = /^(\d+(?:\.\d+)?)ms$/i.exec(q)
  if (ms) return parseFloat(ms[1]) / 1000
  const s = /^(\d+(?:\.\d+)?)s$/i.exec(q)
  if (s) return parseFloat(s[1])
  if (/^\d+\.\d+$/.test(q)) return parseFloat(q)
  return null
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(3).padStart(6, "0")}`
}
