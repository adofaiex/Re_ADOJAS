"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { PointerEvent as ReactPointerEvent } from "react"
import { Box, Eye, EyeOff, GripHorizontal, Image as ImageIcon, Move3d, RefreshCw, RotateCcw, Scaling, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Player } from "@/lib/Player/Player"
import type { DecorationEditorInfo, DecorationEditorPatch } from "@/lib/Player/DecorationManager"

type TransformMode = "position" | "scale"

interface Draft {
  position: [number, number]
  scale: [number, number]
  depth: number
  rotation: number
  opacity: number
  pivotOffset: [number, number]
  visible: boolean
}

interface ScreenBox {
  left: number
  top: number
  right: number
  bottom: number
  centerX: number
  centerY: number
  width: number
  height: number
}

interface DragState {
  axis: "x" | "y" | "z"
  mode: TransformMode
  startClientX: number
  startClientY: number
  startInfo: DecorationEditorInfo
  startDraft: Draft
}

function toDraft(info: DecorationEditorInfo): Draft {
  return {
    position: [...info.position] as [number, number],
    scale: [...info.scale] as [number, number],
    depth: info.depth,
    rotation: info.rotation,
    opacity: info.opacity,
    pivotOffset: [...info.pivotOffset] as [number, number],
    visible: info.visible,
  }
}

function sameBox(a: ScreenBox | null, b: ScreenBox | null): boolean {
  if (!a || !b) return a === b
  return Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.top - b.top) < 0.5
    && Math.abs(a.right - b.right) < 0.5
    && Math.abs(a.bottom - b.bottom) < 0.5
}

function NumberInput({
  value,
  step = 1,
  onCommit,
  className = "",
  testLabel,
}: {
  value: number
  step?: number
  onCommit: (value: number) => void
  className?: string
  testLabel?: string
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(Number.isFinite(value) ? value : 0)), [value])
  const commit = (): void => {
    const n = Number(text)
    if (Number.isFinite(n)) onCommit(n)
    else setText(String(value))
  }
  return (
    <input
      aria-label={testLabel}
      type="number"
      step={step}
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        if (e.key === "Escape") setText(String(value))
      }}
      className={`w-full rounded-md border px-2 py-1 text-xs tabular-nums outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
    />
  )
}

export function DecorationEditorPanel({
  player,
  isDark,
  open,
  onClose,
}: {
  player: Player | null
  isDark: boolean
  open: boolean
  onClose: () => void
}) {
  const [list, setList] = useState<DecorationEditorInfo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [mode, setMode] = useState<TransformMode>("position")
  const [box, setBox] = useState<ScreenBox | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [filter, setFilter] = useState("")
  const [panelDragging, setPanelDragging] = useState(false)
  const [panelPos, setPanelPos] = useState({ x: 16, y: 80 })
  const panelRef = useRef<HTMLDivElement | null>(null)
  const gizmoRef = useRef<HTMLDivElement | null>(null)

  const selectedInfo = useMemo(
    () => list.find(item => item.id === selectedId) ?? null,
    [list, selectedId],
  )

  const refreshList = useCallback((syncDraft: boolean): void => {
    if (!player) return
    const next = player.getDecorationEditorList()
    setList(next)
    const id = player.selectedDecorationId
    setSelectedId(id)
    if (syncDraft) {
      const info = next.find(item => item.id === id)
      setDraft(info ? toDraft(info) : null)
    }
  }, [player])

  // 打开面板时接管画布选择；关闭时恢复普通砖块选择。
  useEffect(() => {
    if (!player) return
    if (!open) {
      player.setDecorationSelectionEnabled(false)
      player.onDecorationSelected = null
      return
    }

    const onSelected = (id: string | null): void => {
      setSelectedId(id)
      const next = player.getDecorationEditorList()
      setList(next)
      const info = next.find(item => item.id === id)
      setDraft(info ? toDraft(info) : null)
    }
    player.onDecorationSelected = onSelected
    player.setDecorationSelectionEnabled(true)
    refreshList(true)

    return () => {
      if (player.onDecorationSelected === onSelected) player.onDecorationSelected = null
      player.setEditorInteractionActive(false)
      player.setDecorationSelectionEnabled(false)
    }
  }, [player, open, refreshList])

  // 装饰数量/拖拽后可能有增删；低频刷新列表，但不覆盖正在输入的 draft。
  useEffect(() => {
    if (!open || !player) return
    const timer = setInterval(() => refreshList(false), 700)
    return () => clearInterval(timer)
  }, [open, player, refreshList])

  // 拖动轴/标题栏时鼠标是在 window 上移动，最终可能在 Canvas 上松开；
  // 在 window capture 阶段截断 mousemove/mouseup，避免 Player 把这次拖拽
  // 当成相机拖动或“点击选中装饰/砖块”。
  useEffect(() => {
    if (!drag && !panelDragging) return
    const stop = (e: Event): void => e.stopPropagation()
    window.addEventListener("mousemove", stop, true)
    window.addEventListener("mouseup", stop, true)
    return () => {
      window.removeEventListener("mousemove", stop, true)
      window.removeEventListener("mouseup", stop, true)
    }
  }, [drag, panelDragging])

  // 可见性/点击隔离由 body portal + window capture 完成；不要再在面板/gizmo
  // 根节点上 stopPropagation，否则 React 的合成 onPointerDown 也收不到，
  // 会出现“拖轴没有反应”。Player container 不再是它们的祖先，天然不会误触相机。

  // 跟踪选中装饰的屏幕包围盒（相机移动/缩放时 gizmo 跟随）。
  useEffect(() => {
    if (!open || !player || !selectedId) {
      setBox(null)
      return
    }
    let raf = 0
    const tick = (): void => {
      const next = player.getDecorationScreenBox(selectedId)
      setBox(prev => sameBox(prev, next) ? prev : next)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [open, player, selectedId])

  useEffect(() => {
    if (!drag || !player || !selectedId) return
    const onMove = (ev: PointerEvent): void => {
      const dx = ev.clientX - drag.startClientX
      const dy = ev.clientY - drag.startClientY
      const d = drag.startDraft
      if (drag.mode === "position") {
        let position: [number, number] = [...d.position]
        let depth = d.depth
        if (drag.axis === "z") {
          depth = Math.round((d.depth - dy / 8) * 10) / 10
        } else {
          const world = player.screenDeltaToWorld(dx, dy)
          const unit = Math.abs(drag.startInfo.positionUnit) > 0.0001 ? drag.startInfo.positionUnit : 1
          if (drag.axis === "x") position = [d.position[0] + world.x / unit, d.position[1]]
          else position = [d.position[0], d.position[1] + world.y / unit]
        }
        const next: Draft = { ...d, position, depth }
        setDraft(next)
        player.updateDecorationTransform(selectedId, { position, depth })
      } else {
        let scale: [number, number] = [...d.scale]
        if (drag.axis === "x") scale = [d.scale[0] + dx * 0.5, d.scale[1]]
        else if (drag.axis === "y") scale = [d.scale[0], d.scale[1] - dy * 0.5]
        else {
          const v = (dx - dy) * 0.25
          scale = [d.scale[0] + v, d.scale[1] + v]
        }
        const next: Draft = { ...d, scale }
        setDraft(next)
        player.updateDecorationTransform(selectedId, { scale })
      }
    }
    const onUp = (): void => {
      player.setEditorInteractionActive(false)
      setDrag(null)
      refreshList(true)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [drag, player, selectedId, refreshList])

  const applyPatch = useCallback((patch: DecorationEditorPatch, nextDraft?: Draft): void => {
    if (!player || !selectedId) return
    player.updateDecorationTransform(selectedId, patch)
    const next = player.getDecorationEditorList()
    setList(next)
    if (nextDraft) setDraft(nextDraft)
    else {
      const info = next.find(item => item.id === selectedId)
      setDraft(info ? toDraft(info) : null)
    }
  }, [player, selectedId])

  const reset = (): void => {
    if (!player || !selectedId) return
    player.resetDecorationTransform(selectedId)
    refreshList(true)
  }

  const startPanelDrag = (ev: ReactPointerEvent): void => {
    if ((ev.target as HTMLElement).closest("button,input")) return
    ev.preventDefault()
    ev.stopPropagation()
    const sx = ev.clientX
    const sy = ev.clientY
    const ox = panelPos.x
    const oy = panelPos.y
    const move = (e: PointerEvent): void => {
      const maxX = Math.max(8, window.innerWidth - 356)
      const maxY = Math.max(8, window.innerHeight - 220)
      setPanelPos({
        x: Math.max(8, Math.min(maxX, ox + e.clientX - sx)),
        y: Math.max(8, Math.min(maxY, oy + e.clientY - sy)),
      })
    }
    const up = (): void => {
      player?.setEditorInteractionActive(false)
      setPanelDragging(false)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
    }
    player?.setEditorInteractionActive(true)
    setPanelDragging(true)
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
  }

  const startDrag = (axis: "x" | "y" | "z", ev: ReactPointerEvent): void => {
    if (!selectedId) return
    const info = selectedInfo
      ?? player?.getDecorationEditorList().find(item => item.id === selectedId)
      ?? null
    const baseDraft = draft ?? (info ? toDraft(info) : null)
    if (!info || !baseDraft) return
    ev.preventDefault()
    ev.stopPropagation()
    player?.setEditorInteractionActive(true)
    setDrag({
      axis,
      mode,
      startClientX: ev.clientX,
      startClientY: ev.clientY,
      startInfo: info,
      startDraft: { ...baseDraft, position: [...baseDraft.position], scale: [...baseDraft.scale], pivotOffset: [...baseDraft.pivotOffset] },
    })
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return list
    return list.filter(item => `${item.tag} ${item.image} ${item.eventType} ${item.floor ?? ""}`.toLowerCase().includes(q))
  }, [list, filter])

  if (!open) return null

  const panelBg = isDark ? "bg-slate-900/95 border-slate-700 text-slate-200" : "bg-white/95 border-slate-200 text-slate-800"
  const muted = isDark ? "text-slate-400" : "text-slate-500"
  const fieldBg = isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-300"
  const sectionBorder = isDark ? "border-slate-700" : "border-slate-200"
  const selectedRow = isDark ? "bg-blue-500/20 border-blue-400/40" : "bg-blue-50 border-blue-300"
  const rowHover = isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"

  const gizmo = box ? (
    <div ref={gizmoRef} className="fixed inset-0 z-[44] pointer-events-none" data-decoration-editor-ui="true">
      <div
        className="absolute border border-dashed pointer-events-none"
        style={{
          left: box.left, top: box.top, width: box.width, height: box.height,
          borderColor: isDark ? "rgba(147,197,253,.8)" : "rgba(37,99,235,.75)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{ left: box.centerX, top: box.centerY, width: 72, height: 2, background: mode === "position" ? "#ef4444" : "#f97316", transform: "translateY(-1px)" }}
      />
      <div
        className="absolute pointer-events-none"
        style={{ left: box.centerX, top: box.centerY - 72, width: 2, height: 72, background: mode === "position" ? "#22c55e" : "#f97316", transform: "translateX(-1px)" }}
      />
      <div
        className="absolute pointer-events-none"
        style={{ left: box.centerX - 52, top: box.centerY, width: 54, height: 2, background: "#3b82f6", transform: "translateY(-1px) rotate(-45deg)", transformOrigin: "right center" }}
      />
      {/* 轴线的透明命中区：只抓端点圆点太小，拖动整条轴线也应生效。 */}
      <div
        className="absolute pointer-events-auto cursor-ew-resize"
        style={{ left: box.centerX, top: box.centerY - 8, width: 72, height: 16 }}
        onPointerDown={e => startDrag("x", e)}
        title="拖动 X 轴"
      />
      <div
        className="absolute pointer-events-auto cursor-ns-resize"
        style={{ left: box.centerX - 8, top: box.centerY - 72, width: 16, height: 72 }}
        onPointerDown={e => startDrag("y", e)}
        title="拖动 Y 轴"
      />
      <div
        className="absolute pointer-events-auto cursor-grab"
        style={{
          left: box.centerX - 52, top: box.centerY - 8, width: 54, height: 16,
          transform: "rotate(-45deg)", transformOrigin: "right center",
        }}
        onPointerDown={e => startDrag("z", e)}
        title="拖动 Z / 深度轴"
      />
      <div
        className="absolute w-4 h-4 rounded-full border-2 border-white shadow pointer-events-auto cursor-ew-resize"
        style={{ left: box.centerX + 72 - 8, top: box.centerY - 8, background: mode === "position" ? "#ef4444" : "#f97316" }}
        onPointerDown={e => startDrag("x", e)}
        title="X"
      />
      <div
        className="absolute w-4 h-4 rounded-full border-2 border-white shadow pointer-events-auto cursor-ns-resize"
        style={{ left: box.centerX - 8, top: box.centerY - 72 - 8, background: mode === "position" ? "#22c55e" : "#f97316" }}
        onPointerDown={e => startDrag("y", e)}
        title="Y"
      />
      <div
        className="absolute w-4 h-4 rounded-full border-2 border-white shadow pointer-events-auto cursor-grab"
        style={{ left: box.centerX - 52 - 8, top: box.centerY + 52 - 8, background: "#3b82f6" }}
        onPointerDown={e => startDrag("z", e)}
        title="Z / depth"
      />
      <div className="absolute text-[10px] font-bold text-red-500 pointer-events-none" style={{ left: box.centerX + 80, top: box.centerY - 7 }}>X</div>
      <div className="absolute text-[10px] font-bold text-green-500 pointer-events-none" style={{ left: box.centerX + 4, top: box.centerY - 90 }}>Y</div>
      <div className="absolute text-[10px] font-bold text-blue-500 pointer-events-none" style={{ left: box.centerX - 64, top: box.centerY + 58 }}>Z</div>
    </div>
  ) : null

  const content = (
    <>
      {gizmo}
      <div
        ref={panelRef}
        data-decoration-editor-ui="true"
        className={`fixed z-[45] w-[340px] rounded-xl border shadow-2xl backdrop-blur-md flex flex-col overflow-hidden pointer-events-auto ${panelBg}`}
        style={{
          left: panelPos.x,
          top: panelPos.y,
          height: `max(220px, calc(100vh - ${panelPos.y + 24}px))`,
        }}
        onMouseDown={e => e.stopPropagation()}
        onMouseMove={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
        onWheel={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between px-3 py-2 border-b cursor-move select-none ${sectionBorder}`}
          style={{ touchAction: "none" }}
          onPointerDown={e => {
            if (!(e.target as HTMLElement).closest("button,input")) {
              try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ }
            }
            startPanelDrag(e)
          }}
          title="按住标题栏拖动窗口"
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 opacity-45" />
            <Box className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold">装饰编辑器</span>
            <span className={`text-[11px] ${muted}`}>{list.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button className={`p-1 rounded ${rowHover}`} title="刷新列表" onClick={() => refreshList(true)}>
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button className={`p-1 rounded ${rowHover}`} title="关闭" onClick={onClose}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className={`px-3 py-2 border-b ${sectionBorder}`}>
          <div className="flex gap-1">
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs border ${mode === "position" ? "border-blue-500 text-blue-500 bg-blue-500/10" : `border-transparent ${rowHover}`}`}
              onClick={() => setMode("position")}
            >
              <Move3d className="w-3.5 h-3.5" /> 移动
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs border ${mode === "scale" ? "border-orange-500 text-orange-500 bg-orange-500/10" : `border-transparent ${rowHover}`}`}
              onClick={() => setMode("scale")}
            >
              <Scaling className="w-3.5 h-3.5" /> 缩放
            </button>
          </div>
          <div className={`mt-2 text-[10px] leading-4 ${muted}`}>
            画布点击选中装饰；拖 X/Y/Z 轴调整。Z 轴是排序深度。
          </div>
        </div>

        <div className={`px-3 py-2 border-b ${sectionBorder}`}>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="筛选 tag / 图片 / 类型…"
            className={`w-full rounded-md border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 ${fieldBg}`}
          />
        </div>

        <div className={`overflow-y-auto border-b ${sectionBorder}`} style={{ maxHeight: 190 }}>
          {filtered.length === 0 ? (
            <div className={`px-3 py-4 text-xs ${muted}`}>没有匹配的装饰</div>
          ) : filtered.map(item => {
            const active = item.id === selectedId
            return (
              <button
                key={item.id}
                className={`w-full text-left px-3 py-2 border-b last:border-b-0 ${sectionBorder} ${active ? selectedRow : rowHover}`}
                onClick={() => {
                  player?.selectDecoration(item.id)
                  setSelectedId(item.id)
                  const next = player?.getDecorationEditorList() ?? []
                  setList(next)
                  const info = next.find(x => x.id === item.id)
                  setDraft(info ? toDraft(info) : null)
                }}
              >
                <div className="flex items-center gap-2">
                  {item.visible ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0 opacity-50" />}
                  <span className="truncate text-xs font-medium">{item.tag || "(no tag)"}</span>
                  <span className={`ml-auto text-[10px] ${muted}`}>{item.eventType}</span>
                </div>
                <div className={`mt-0.5 flex items-center gap-1 text-[10px] ${muted}`}>
                  <ImageIcon className="w-3 h-3 shrink-0" />
                  <span className="truncate">{item.image || item.objectType || "(no image)"}</span>
                  {item.floor !== undefined && <span className="ml-auto shrink-0">floor {item.floor}</span>}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {!draft || !selectedInfo ? (
            <div className={`text-xs ${muted}`}>
              未选中装饰。打开面板后在画布上点击装饰，或从上方列表选择。
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{selectedInfo.tag || "(no tag)"}</div>
                  <div className={`truncate text-[10px] ${muted}`}>
                    {selectedInfo.eventType}{selectedInfo.floor !== undefined ? ` · floor ${selectedInfo.floor}` : ""} · {selectedInfo.relativeTo}
                  </div>
                  <div className={`truncate text-[10px] ${muted}`}>{selectedInfo.image || selectedInfo.objectType || "(no image)"}</div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={reset} title="恢复载入时的默认值">
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> 重置
                </Button>
              </div>

              <div className={`rounded-lg border p-2 ${sectionBorder}`}>
                <div className="mb-1 text-[10px] font-semibold opacity-70">位置 / Position</div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[10px]">
                    <span className="text-red-500">X</span>
                    <NumberInput
                      value={draft.position[0]}
                      step={0.1}
                      className={fieldBg}
                      onCommit={v => applyPatch({ position: [v, draft.position[1]] }, { ...draft, position: [v, draft.position[1]] })}
                    />
                  </label>
                  <label className="text-[10px]">
                    <span className="text-green-500">Y</span>
                    <NumberInput
                      value={draft.position[1]}
                      step={0.1}
                      className={fieldBg}
                      onCommit={v => applyPatch({ position: [draft.position[0], v] }, { ...draft, position: [draft.position[0], v] })}
                    />
                  </label>
                  <label className="text-[10px]">
                    <span className="text-blue-500">Z</span>
                    <NumberInput
                      value={draft.depth}
                      step={0.1}
                      className={fieldBg}
                      onCommit={v => applyPatch({ depth: v }, { ...draft, depth: v })}
                    />
                  </label>
                </div>
              </div>

              <div className={`rounded-lg border p-2 ${sectionBorder}`}>
                <div className="mb-1 text-[10px] font-semibold opacity-70">缩放 / Scale (%)</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px]">
                    <span className="text-red-500">X</span>
                    <NumberInput
                      value={draft.scale[0]}
                      step={1}
                      className={fieldBg}
                      onCommit={v => applyPatch({ scale: [v, draft.scale[1]] }, { ...draft, scale: [v, draft.scale[1]] })}
                    />
                  </label>
                  <label className="text-[10px]">
                    <span className="text-green-500">Y</span>
                    <NumberInput
                      value={draft.scale[1]}
                      step={1}
                      className={fieldBg}
                      onCommit={v => applyPatch({ scale: [draft.scale[0], v] }, { ...draft, scale: [draft.scale[0], v] })}
                    />
                  </label>
                </div>
                <div className={`mt-1 text-[10px] ${muted}`}>
                  默认 {selectedInfo.defaultScale[0].toFixed(1)} × {selectedInfo.defaultScale[1].toFixed(1)}
                </div>
              </div>

              <div className={`rounded-lg border p-2 ${sectionBorder}`}>
                <div className="mb-1 text-[10px] font-semibold opacity-70">其他 / Extra</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px]">
                    旋转
                    <NumberInput value={draft.rotation} step={1} className={fieldBg} onCommit={v => applyPatch({ rotation: v }, { ...draft, rotation: v })} />
                  </label>
                  <label className="text-[10px]">
                    不透明度
                    <NumberInput value={draft.opacity} step={1} className={fieldBg} onCommit={v => applyPatch({ opacity: Math.max(0, Math.min(100, v)) }, { ...draft, opacity: Math.max(0, Math.min(100, v)) })} />
                  </label>
                  <label className="text-[10px]">
                    支点 X
                    <NumberInput value={draft.pivotOffset[0]} step={0.01} className={fieldBg} onCommit={v => applyPatch({ pivotOffset: [v, draft.pivotOffset[1]] }, { ...draft, pivotOffset: [v, draft.pivotOffset[1]] })} />
                  </label>
                  <label className="text-[10px]">
                    支点 Y
                    <NumberInput value={draft.pivotOffset[1]} step={0.01} className={fieldBg} onCommit={v => applyPatch({ pivotOffset: [draft.pivotOffset[0], v] }, { ...draft, pivotOffset: [draft.pivotOffset[0], v] })} />
                  </label>
                </div>
                <label className="mt-2 flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={draft.visible}
                    onChange={e => applyPatch({ visible: e.target.checked }, { ...draft, visible: e.target.checked })}
                  />
                  显示
                </label>
              </div>

              <div className={`rounded-lg border p-2 text-[10px] leading-5 ${sectionBorder} ${muted}`}>
                <div>绘制尺寸 {selectedInfo.baseWidth.toFixed(3)} × {selectedInfo.baseHeight.toFixed(3)}</div>
                <div className="flex flex-wrap items-center gap-1">
                  <span>默认位置 [{selectedInfo.defaultPosition[0].toFixed(2)}, {selectedInfo.defaultPosition[1].toFixed(2)}] · 默认 Z {selectedInfo.defaultDepth.toFixed(2)}</span>
                  <button
                    className="rounded border px-1.5 py-0.5 text-[9px] hover:bg-blue-500/10"
                    onClick={() => applyPatch(
                      { position: [...selectedInfo.defaultPosition] as [number, number] },
                      { ...draft, position: [...selectedInfo.defaultPosition] as [number, number] },
                    )}
                  >还原位置</button>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span>默认尺寸 {selectedInfo.defaultScale[0].toFixed(1)} × {selectedInfo.defaultScale[1].toFixed(1)}</span>
                  <button
                    className="rounded border px-1.5 py-0.5 text-[9px] hover:bg-blue-500/10"
                    onClick={() => applyPatch(
                      { scale: [...selectedInfo.defaultScale] as [number, number] },
                      { ...draft, scale: [...selectedInfo.defaultScale] as [number, number] },
                    )}
                  >还原尺寸</button>
                </div>
                <div>技巧：移动模式拖 X/Y/Z；缩放模式拖 X/Y 分别缩放两轴，拖 Z 等比缩放。</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
  // Portal 到 body：Player 的 mousedown/wheel/touch 原生监听挂在 container 上，
  // 面板如果仍在 container 内，拖轴/滚动会先触发相机拖动。Portal 后事件不再
  // 经过 container，拖动轴和窗口滚动天然与 Canvas 隔离。
  return typeof document !== "undefined" ? createPortal(content, document.body) : null
}
