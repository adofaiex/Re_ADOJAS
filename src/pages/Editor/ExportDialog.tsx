/**
 * 导出弹窗：格式（.ilytx / .adofai）+ 内置音频/装饰图勾选 + xz 压缩等级。
 *
 * .ilytx 是推荐格式：二进制(ilybin) + tar + xz，677 万砖仅数 MB、导入秒开。
 */
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Music, Image, FileArchive, FileText } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import type { IlytxExportOptions } from "@/lib/ilytx/types"

export interface ExportDialogProps {
  isOpen: boolean
  isDark: boolean
  /** 已加载音频（决定"内置音频"可勾与否） */
  hasAudio: boolean
  /** 已加载的装饰/背景图数量 */
  assetCount: number
  onConfirm: (opts: IlytxExportOptions) => void
  onCancel: () => void
}

export function ExportDialog({ isOpen, isDark, hasAudio, assetCount, onConfirm, onCancel }: ExportDialogProps) {
  const { t } = useI18n()
  const [format, setFormat] = useState<'ilytx' | 'adofai'>('ilytx')
  const [embedAudio, setEmbedAudio] = useState(true)
  const [embedDecor, setEmbedDecor] = useState(true)
  const [xzLevel, setXzLevel] = useState<1 | 3 | 6>(6)

  if (!isOpen) return null

  const cardBg = isDark ? "bg-slate-800" : "bg-white"
  const headBorder = isDark ? "border-slate-700" : "border-slate-200"
  const titleColor = isDark ? "text-white" : "text-slate-900"
  const bodyColor = isDark ? "text-slate-300" : "text-slate-600"
  const rowBg = isDark ? "bg-slate-700/40 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"
  const activeRing = "ring-2 ring-blue-500"
  const inactiveRing = "ring-1 ring-transparent"

  const confirm = (): void => {
    onConfirm({ format, embedAudio: format === 'ilytx' && embedAudio && hasAudio, embedDecor: format === 'ilytx' && embedDecor, xzLevel })
  }

  const formatButton = (value: 'ilytx' | 'adofai', icon: React.ReactNode, label: string, desc: string): React.ReactNode => (
    <button
      type="button"
      onClick={() => setFormat(value)}
      className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${rowBg} ${format === value ? activeRing : inactiveRing}`}
    >
      {icon}
      <span className="flex flex-col">
        <span className={`text-sm font-medium ${titleColor}`}>{label}</span>
        <span className={`text-xs ${bodyColor}`}>{desc}</span>
      </span>
    </button>
  )

  const checkboxRow = (checked: boolean, disabled: boolean, onChange: (v: boolean) => void, icon: React.ReactNode, label: string): React.ReactNode => (
    <label className={`flex items-center gap-2 text-sm select-none ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked && !disabled}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-blue-500"
      />
      {icon}
      <span>{label}</span>
    </label>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className={`relative w-full max-w-md mx-4 rounded-xl shadow-2xl overflow-hidden ${cardBg}`}>
        <div className={`px-6 py-4 border-b ${headBorder}`}>
          <h3 className={`text-lg font-semibold ${titleColor}`}>{t("editor.exportDialog.title")}</h3>
        </div>

        <div className={`px-6 py-4 flex flex-col gap-3 ${bodyColor}`}>
          {/* 格式 */}
          <div className="text-sm font-medium">{t("editor.exportDialog.format")}</div>
          <div className="flex flex-col gap-2">
            {formatButton(
              'ilytx',
              <FileArchive className="w-5 h-5 mt-0.5 shrink-0 text-blue-400" />,
              t("editor.exportDialog.ilytx"),
              t("editor.exportDialog.ilytxDesc")
            )}
            {formatButton(
              'adofai',
              <FileText className="w-5 h-5 mt-0.5 shrink-0 text-emerald-400" />,
              t("editor.exportDialog.adofai"),
              t("editor.exportDialog.adofaiDesc")
            )}
          </div>

          {format === 'ilytx' && (
            <>
              {/* 内置选项 */}
              <div className="flex flex-col gap-2 mt-1">
                {checkboxRow(
                  embedAudio, !hasAudio, setEmbedAudio,
                  <Music className="w-4 h-4 shrink-0" />,
                  hasAudio ? t("editor.exportDialog.embedAudio") : t("editor.exportDialog.embedAudioUnavailable")
                )}
                {assetCount > 0 &&
                  checkboxRow(embedDecor, false, setEmbedDecor,
                    <Image className="w-4 h-4 shrink-0" />,
                    t("editor.exportDialog.embedDecor").replace("{count}", String(assetCount))
                  )}
              </div>

              {/* 压缩等级 */}
              <div className="text-sm font-medium mt-1">{t("editor.exportDialog.compression")}</div>
              <div className="flex gap-2">
                {([1, 3, 6] as const).map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setXzLevel(lv)}
                    className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${rowBg} ${xzLevel === lv ? activeRing : inactiveRing}`}
                  >
                    {lv === 1 ? t("editor.exportDialog.levelFast") : lv === 3 ? t("editor.exportDialog.levelBalanced") : t("editor.exportDialog.levelSmallest")}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className={`px-6 py-4 flex justify-end gap-3 border-t ${headBorder}`}>
          <Button
            variant="ghost"
            onClick={onCancel}
            className={isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={confirm} className="bg-blue-600 hover:bg-blue-500 text-white">
            <Download className="w-4 h-4 mr-2" />
            {t("editor.exportDialog.confirm")}
          </Button>
        </div>
      </div>
    </div>
  )
}
