import { useCallback, useRef } from "react"
import * as ADOFAI from "adofai"
import { Parsers, Structure } from "adofai"
import type { ILevelData } from "@/lib/Player/types"
import { Player } from "@/lib/Player/Player"
import { LargeFileParser } from "@/lib/LargeFileParser"
import type { HitsoundSynthStatus } from "@/lib/Player/HitsoundManager"
import JSZip from "jszip"
import { isAdojas, autoLoadAssets as adojasAutoLoadAssets, getLastFileDir } from "@/lib/fs"

// 类型导入
type ParseProgressEvent = Structure.ParseProgressEvent;

// 使用 StringParser 作为解析器
const StringParser = Parsers.StringParser
const parser = new StringParser()

/**
 * 砖数超过该阈值时，上游库自动切换紧凑砖块存储（CompactTileStore）：
 * 百万砖谱面从"每砖一个对象"（数 GB）变为 typed array + 稀疏事件（数百 MB）。
 * 普通谱面仍走对象模式，行为不变。
 */
const COMPACT_TILES_THRESHOLD = 200_000

// 超大文件阈值 - 用于加载进度分段（>90MB 时装饰/打拍音预合成占用更多进度区间）
const VERY_LARGE_FILE_THRESHOLD = 90 * 1024 * 1024 // 90MB

// 获取加载阶段的显示文本
const getStageText = (stage: string, t: (key: string) => string): string => {
  switch (stage) {
    case 'start':
      return t("loading.stage.start")
    case 'pathData':
      return t("loading.stage.pathData")
    case 'angleData':
    case 'parsing_angleData':
      return t("loading.stage.angleData")
    case 'relativeAngle':
      return t("loading.stage.relativeAngle")
    case 'tilePosition':
      return t("loading.stage.tilePosition")
    case 'complete':
      return t("loading.stage.complete")
    case 'scanning':
      return t("loading.preparingLargeFile")
    case 'parsing_settings':
    case 'parsing_actions':
    case 'parsing_decorations':
      return t("loading.parsingLevel")
    default:
      return t("loading.parsingLevel")
  }
}

interface UseFileHandlersProps {
  setIsLoading: (loading: boolean) => void
  setLoadingProgress: (progress: number) => void
  setLoadingStatus: (status: string) => void
  setLoadingWorkers?: (status: HitsoundSynthStatus | null) => void
  setLoadingDetail?: (detail: string) => void
  setAdofaiFile: (file: any) => void
  initializePlayer: (loadedLevel: any) => Player | null
  settings: any
  t: (key: string) => string
  containerRef: React.RefObject<HTMLDivElement>
  previewerRef: React.MutableRefObject<Player | null>
}

export function useFileHandlers({
  setIsLoading,
  setLoadingProgress,
  setLoadingStatus,
  setLoadingWorkers,
  setLoadingDetail,
  setAdofaiFile,
  initializePlayer,
  settings,
  t,
  containerRef,
  previewerRef
}: UseFileHandlersProps) {

  // 加载进度明细（如 "6635/131072"）：节流到 ~12 次/秒、且只在文本变化时 setState，
  // 避免高频 React 重渲染反而拖慢加载。
  const progressDetailRef = useRef<{ last: number; text: string }>({ last: 0, text: '' })
  const updateProgressDetail = (current?: number, total?: number): void => {
    if (typeof current !== 'number' || typeof total !== 'number' || total <= 0) return
    const text = `${current}/${total}`
    if (text === progressDetailRef.current.text) return
    const now = performance.now()
    const done = current >= total
    if (!done && now - progressDetailRef.current.last < 80) return
    progressDetailRef.current.last = now
    progressDetailRef.current.text = text
    setLoadingDetail?.(text)
  }
  const resetProgressDetail = (): void => {
    progressDetailRef.current.text = ''
    progressDetailRef.current.last = 0
    setLoadingDetail?.('')
  }

  // 辅助函数：初始化玩家、分帧创建装饰物并合成打拍音
  const initializePlayerWithHitsounds = async (loadedLevel: any, isVeryLargeFile: boolean = false): Promise<void> => {
    const player = initializePlayer(loadedLevel)

    // 装饰物：按"谱面载入方式"设置分帧/异步创建（sync 同步，async/worker 逐帧），并展示进度
    if (player) {
      const decoFrom = isVeryLargeFile ? 85 : 95
      const decoTo = isVeryLargeFile ? 93 : 97
      setLoadingStatus(t("loading.buildingDecorations"))
      let lastPct = -1
      await player.buildDecorationsAsync(settings.loadMethod, (fraction) => {
        // 只在整数百分比变化时刷新 React 状态，避免每帧 setState 触发整页重渲染
        const pct = Math.round(decoFrom + (decoTo - decoFrom) * fraction)
        if (pct !== lastPct) {
          lastPct = pct
          setLoadingProgress(pct)
        }
      })
    }

    // Synthesize hitsounds with progress display
    if (previewerRef.current) {
      const hsFrom = isVeryLargeFile ? 93 : 97
      const hsSpan = isVeryLargeFile ? 6 : 3
      setLoadingProgress(hsFrom)
      setLoadingStatus(t("loading.synthesizingHitsounds"))

      await previewerRef.current.preSynthesizeHitsoundsWithProgress(
        (percent) => {
          setLoadingProgress(hsFrom + (percent / 100) * hsSpan)
        },
        (status) => {
          setLoadingWorkers?.(status)
        }
      )
      setLoadingWorkers?.(null)
    }
  }

  // 大文件加载 - 使用 LargeFileParser 直接从 ArrayBuffer 解析
  const loadLargeFile = async (arrayBuffer: ArrayBuffer, isVeryLargeFile: boolean = false): Promise<void> => {
    console.log('[DEBUG] Using LargeFileParser for large file')
    setLoadingStatus("正在预处理大文件...")
    setLoadingProgress(0)

    try {
      // 创建大文件解析器
      const largeFileParser = new LargeFileParser((stage, percent) => {
        setLoadingStatus(getStageText(stage, t))
        // 对于超大文件，解析进度 0-80%，对于普通大文件也是 0-80%
        setLoadingProgress(Math.round(percent * 0.8))
      })

      // 解析文件
      const parsedData = largeFileParser.parse(arrayBuffer)
      console.log('[DEBUG] LargeFileParser result:', {
        hasAngleData: !!parsedData.angleData,
        angleDataLength: parsedData.angleData?.length,
        hasSettings: !!parsedData.settings,
        hasActions: !!parsedData.actions,
        actionsLength: parsedData.actions?.length
      })

      // 使用解析后的数据创建 Level
      const level = new ADOFAI.Level(parsedData, undefined, { compactTiles: COMPACT_TILES_THRESHOLD })

      // 监听进度事件
      level.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
        setLoadingProgress(80 + Math.round(progressEvent.percent * 0.05))
        setLoadingStatus(getStageText(progressEvent.stage, t))
      updateProgressDetail(progressEvent.current, progressEvent.total)
      })

      level.on("load", async (loadedLevel: any): Promise<void> => {
        // 计算瓦片位置
        loadedLevel.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
          setLoadingProgress(80 + Math.round(progressEvent.percent * 0.05))
          setLoadingStatus(getStageText(progressEvent.stage, t))
      updateProgressDetail(progressEvent.current, progressEvent.total)
        })
        // loadedLevel.calculateTilePosition() // Skip - using our own position calculation in PositionTrackManager

        setLoadingProgress(85)
        setLoadingStatus(t("loading.buildingScene"))

        // Initialize player and synthesize hitsounds
        await initializePlayerWithHitsounds(loadedLevel, isVeryLargeFile)
        await adojasAutoLoad(loadedLevel)

        setLoadingProgress(100)
        window.showNotification?.("success", t("editor.notifications.loadSuccess"))
        setIsLoading(false)
        setLoadingProgress(0)
        setLoadingStatus("")
      })

      await level.load()

    } catch (error) {
      console.error('[DEBUG] LargeFileParser error:', error)
      throw error
    }
  }

  // Synchronous loading (blocks UI) - for small files
  const loadSync = (content: string): void => {
    const level = new ADOFAI.Level(content, parser, { compactTiles: COMPACT_TILES_THRESHOLD })

    // 监听进度事件
    level.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
      setLoadingProgress(progressEvent.percent)
      setLoadingStatus(getStageText(progressEvent.stage, t))
      updateProgressDetail(progressEvent.current, progressEvent.total)
    })

    level.on("load", async (loadedLevel: any): Promise<void> => {
      // 计算瓦片位置时也会触发进度事件
      loadedLevel.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
        setLoadingProgress(progressEvent.percent)
        setLoadingStatus(getStageText(progressEvent.stage, t))
      updateProgressDetail(progressEvent.current, progressEvent.total)
      })
      // loadedLevel.calculateTilePosition() // Skip - using our own position calculation in PositionTrackManager

      setLoadingProgress(95)
      setLoadingStatus(t("loading.buildingScene"))

      // Initialize player and synthesize hitsounds
      await initializePlayerWithHitsounds(loadedLevel)
      await adojasAutoLoad(loadedLevel)

      setLoadingProgress(100)
      window.showNotification?.("success", t("editor.notifications.loadSuccess"))
      setIsLoading(false)
      setLoadingProgress(0)
      setLoadingStatus("")
    })

    level.load()
  }

  /**
   * ADOJAS 原生模式：关卡加载完成后，自动从文件系统读取引用的音频/视频/装饰。
   */
  const adojasAutoLoad = async (loadedLevel: any): Promise<void> => {
    if (!isAdojas()) return
    const levelDir = getLastFileDir()
    if (!levelDir || !previewerRef.current) return

    console.log('[ADOJAS] Auto-loading assets from:', levelDir)

    await adojasAutoLoadAssets(loadedLevel, levelDir, {
      loadMusic: (url) => {
        try { previewerRef.current?.loadMusic(url) } catch {}
      },
      loadVideo: (url) => {
        try { previewerRef.current?.loadVideo(url) } catch {}
      },
      registerDecorationImage: (name, url) => {
        try { previewerRef.current?.registerDecorationImage?.(name, url) } catch {}
      },
      registerCustomBGImage: (name, url) => {
        try { previewerRef.current?.registerCustomBGImage?.(name, url) } catch {}
      },
    })
  }

  // Asynchronous loading (non-blocking)
  const loadAsync = async (content: string): Promise<void> => {
    const level = new ADOFAI.Level(content, parser, { compactTiles: COMPACT_TILES_THRESHOLD })

    // 监听进度事件
    level.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
      setLoadingProgress(progressEvent.percent)
      setLoadingStatus(getStageText(progressEvent.stage, t))
      updateProgressDetail(progressEvent.current, progressEvent.total)
    })

    level.on("load", async (loadedLevel: any): Promise<void> => {
      // 计算瓦片位置时也会触发进度事件
      loadedLevel.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
        setLoadingProgress(progressEvent.percent)
        setLoadingStatus(getStageText(progressEvent.stage, t))
      updateProgressDetail(progressEvent.current, progressEvent.total)
      })
      // loadedLevel.calculateTilePosition() // Skip - using our own position calculation in PositionTrackManager

      setLoadingProgress(95)
      setLoadingStatus(t("loading.buildingScene"))

      // Initialize player and synthesize hitsounds
      await initializePlayerWithHitsounds(loadedLevel)
      await adojasAutoLoad(loadedLevel)

      setLoadingProgress(100)
      window.showNotification?.("success", t("editor.notifications.loadSuccess"))
      setIsLoading(false)
      setLoadingProgress(0)
      setLoadingStatus("")
    })

    await level.load()
  }

  // "Worker" 加载方式。
  //
  // 历史上这里把整个已解析 level structured-clone 给 levelLoaderWorker 做
  // precomputeLevelData，再连 levelData 一起 clone 回来 —— 而主线程从未使用该结果
  // （Player 在 initializePlayerWithHitsounds 里全部自算）。对 100 万砖谱面，仅两次
  // 克隆就是几百 MB，UI 还长时间停在 "loading.precomputing"（该 i18n key 甚至不存在）。
  // 现在直接走异步解析路径。
  const loadWithWorker = async (content: string): Promise<void> => {
    console.log('[DEBUG] loadMethod=worker → 直接异步加载（预计算 worker 已移除）')
    return loadAsync(content)
  }

  // ZIP file loading - extract and auto-load level, audio, and decorations
  const loadFromZip = async (arrayBuffer: ArrayBuffer): Promise<void> => {
    setLoadingStatus(t("loading.extractingZip"))
    setLoadingProgress(5)
    resetProgressDetail()

    try {
      const zip = await JSZip.loadAsync(arrayBuffer)
      const files = Object.keys(zip.files)
      console.log('[ZIP] Found files:', files)

      // Find adofai file with priority
      const adofaiPriority = [
        // Custom names first (any non-standard name)
        (f: string) => f.endsWith('.adofai') && !['level.adofai', 'main.adofai', 'backup.adofai'].includes(f.toLowerCase()),
        // Standard names in order
        (f: string) => f.toLowerCase() === 'level.adofai',
        (f: string) => f.toLowerCase() === 'main.adofai',
        (f: string) => f.toLowerCase() === 'backup.adofai',
        // sub*.adofai pattern
        (f: string) => /^sub\d*\.adofai$/i.test(f.split('/').pop() || ''),
      ]

      let adofaiFile: string | null = null
      for (const matcher of adofaiPriority) {
        const found = files.find(f => matcher(f))
        if (found) {
          adofaiFile = found
          break
        }
      }

      if (!adofaiFile) {
        throw new Error('No .adofai file found in ZIP')
      }

      console.log('[ZIP] Using adofai file:', adofaiFile)
      setLoadingProgress(10)
      setLoadingStatus(t("loading.parsingLevel"))

      // Extract and parse the adofai file
      const adofaiContent = await zip.file(adofaiFile)?.async('string')
      if (!adofaiContent) {
        throw new Error('Failed to extract adofai file')
      }

      // Parse the level
      const level = new ADOFAI.Level(adofaiContent, parser, { compactTiles: COMPACT_TILES_THRESHOLD })

      level.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
        setLoadingProgress(10 + Math.round(progressEvent.percent * 0.5))
        setLoadingStatus(getStageText(progressEvent.stage, t))
      updateProgressDetail(progressEvent.current, progressEvent.total)
      })

      level.on("load", async (loadedLevel: any): Promise<void> => {
        loadedLevel.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
          setLoadingProgress(10 + Math.round(progressEvent.percent * 0.5))
          setLoadingStatus(getStageText(progressEvent.stage, t))
      updateProgressDetail(progressEvent.current, progressEvent.total)
        })
        // loadedLevel.calculateTilePosition() // Skip - using our own position calculation in PositionTrackManager

        setLoadingProgress(60)
        setLoadingStatus(t("loading.buildingScene"))

        // Initialize player and synthesize hitsounds
        await initializePlayerWithHitsounds(loadedLevel)

        setLoadingProgress(70)

        // Auto-load audio if specified in settings
        const settings = loadedLevel.settings || {}
        const songFilename = settings.songFilename
        if (songFilename) {
          // Try to find the audio file in ZIP
          const audioExtensions = ['.mp3', '.ogg', '.wav', '.m4a', '.flac']
          for (const ext of audioExtensions) {
            const audioFile = files.find(f => {
              const name = f.toLowerCase()
              const songName = songFilename.toLowerCase()
              // Match exact filename or with extension
              return name === songName ||
                name === songName + ext ||
                name.endsWith('/' + songName) ||
                name.endsWith('/' + songName + ext) ||
                // Match just the filename part if songFilename has path
                name.endsWith(songName.split('/').pop()?.toLowerCase() + ext)
            })

            if (audioFile) {
              console.log('[ZIP] Found audio file:', audioFile)
              const audioBlob = await zip.file(audioFile)?.async('blob')
              if (audioBlob && previewerRef.current) {
                const audioUrl = URL.createObjectURL(audioBlob)
                previewerRef.current.loadMusic(audioUrl)
                window.showNotification?.("info", t("editor.notifications.audioAutoLoaded"))
                break
              }
            }
          }
        }

        setLoadingProgress(80)

        // Auto-load decoration images
        // Collect all decoration image filenames from the level
        const decorationImages = new Set<string>()

        // Check root decorations
        const rootDecorations = loadedLevel.decorations || loadedLevel.__decorations || []
        rootDecorations.forEach((dec: any) => {
          if (dec.decorationImage) {
            decorationImages.add(dec.decorationImage)
          }
        })

        // Check tile decorations
        const tiles = loadedLevel.tiles
        if (tiles) {
          if (tiles.decorationsByFloor && typeof tiles.decorationsByFloor.forEach === 'function') {
            // 紧凑存储：装饰稀疏 Map
            for (const [, decos] of tiles.decorationsByFloor) {
              for (const dec of decos) {
                if (dec.decorationImage) decorationImages.add(dec.decorationImage)
              }
            }
          } else {
            tiles.forEach((tile: any) => {
              if (tile.addDecorations) {
                tile.addDecorations.forEach((dec: any) => {
                  if (dec.decorationImage) {
                    decorationImages.add(dec.decorationImage)
                  }
                })
              }
            })
          }
        }

        // MoveDecorations 能在播放中换图（decorationImage）—— 这类图不会出现在
        // decorations 数组里（例：Rainbowanderer 的 1-text-2..5.png）。
        // 漏掉它们 → 换图时找不到图 → 透明兜底 → 表现为"换图后装饰消失"。
        ;(loadedLevel.actions || []).forEach((ev: any) => {
          const img = ev?.decorationImage
          if (typeof img === 'string' && img) decorationImages.add(img)
        })

        console.log('[ZIP] Decoration images needed:', Array.from(decorationImages))

        // Load decoration images from ZIP
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']
        let loadedImages = 0

        // 确定性挑选：精确路径 > basename 匹配；同级候选里路径更浅、字典序更小者优先。
        // 否则 a/0.png 与 a/[Dynamic Decoration 1]/0.png 之类同名文件会随机命中。
        const pickZipImage = (imageName: string): string | null => {
          const targetName = imageName.toLowerCase().replace(/\\/g, '/')
          const base = targetName.split('/').pop() || targetName
          let best: string | null = null
          let bestKind = 3
          for (const f of files) {
            if (!imageExtensions.some(ext => f.toLowerCase().endsWith(ext))) continue
            const n = f.toLowerCase()
            const kind =
              (n === targetName || n === targetName + extOf(n) ||
                n.endsWith('/' + targetName) || n.endsWith('/' + targetName + extOf(n))) ? 0 :
              (n === base || n === base + extOf(n) ||
                n.endsWith('/' + base) || n.endsWith('/' + base + extOf(n))) ? 1 : 3
            if (kind > bestKind) continue
            const depth = n.split('/').length
            const curDepth = best ? best.toLowerCase().split('/').length : Infinity
            if (kind < bestKind || depth < curDepth || (depth === curDepth && n < best!.toLowerCase())) {
              best = f
              bestKind = kind
            }
          }
          // extOf: 候选文件自身的扩展名（保持原逻辑"引用可缺扩展名"的宽松性）
          function extOf(cand: string): string {
            const m = cand.match(/\.[a-z0-9]+$/)
            return m ? m[0] : ''
          }
          return best
        }

        for (const imageName of decorationImages) {
          const imageFile = pickZipImage(imageName)
          if (imageFile) {
            console.log('[ZIP] Found decoration image:', imageFile)
            const imageBlob = await zip.file(imageFile)?.async('blob')
            if (imageBlob && previewerRef.current?.registerDecorationImage) {
              const imageUrl = URL.createObjectURL(imageBlob)
              // 同时注册：ZIP 内完整路径（嵌套文件夹精确命中）+ JSON 引用名（basename 兜底）
              previewerRef.current.registerDecorationImage(imageFile, imageUrl)
              if (imageName !== imageFile) {
                previewerRef.current.registerDecorationImage(imageName, imageUrl)
              }
              loadedImages++
            }
          }
        }

        // Preload decoration textures
        if (loadedImages > 0 && previewerRef.current?.preloadDecorationTextures) {
          setLoadingStatus(t("loading.preloadingTextures"))
          await previewerRef.current.preloadDecorationTextures()
          window.showNotification?.("info", `${t("editor.notifications.decorationsAutoLoaded").replace("{count}", String(loadedImages))}`)
        }

        // Auto-load custom background images from settings and SetCustomBG events
        const bgImages = new Set<string>()

        // Check level settings for bgImage
        const bgImage = settings.bgImage
        if (bgImage) {
          bgImages.add(bgImage)
        }

        // 自定义背景：事件是 CustomBackground（字段 bgImage）；兼容旧的 SetCustomBG/image
        const actions = loadedLevel.actions || []
        actions.forEach((action: any) => {
          if (action.eventType === 'CustomBackground' || action.eventType === 'SetCustomBG') {
            const img = action.bgImage || action.image
            if (img) bgImages.add(img)
          }
        })

        console.log('[ZIP] Custom BG images needed:', Array.from(bgImages))

        // Load custom background images from ZIP
        for (const bgImageName of bgImages) {
          for (const ext of imageExtensions) {
            const imageFile = files.find(f => {
              const name = f.toLowerCase()
              const targetName = bgImageName.toLowerCase()
              return name === targetName ||
                name === targetName + ext ||
                name.endsWith('/' + targetName) ||
                name.endsWith('/' + targetName + ext) ||
                name.endsWith('/' + bgImageName.split('/').pop()?.toLowerCase() + ext) ||
                name.endsWith(bgImageName.split('/').pop()?.toLowerCase() + ext)
            })

            if (imageFile) {
              console.log('[ZIP] Found custom BG image:', imageFile)
              const imageBlob = await zip.file(imageFile)?.async('blob')
              if (imageBlob && previewerRef.current?.registerCustomBGImage) {
                const imageUrl = URL.createObjectURL(imageBlob)
                const filename = bgImageName.split('/').pop() || bgImageName
                previewerRef.current.registerCustomBGImage(filename, imageUrl)
              }
              break
            }
          }
        }

        setLoadingProgress(100)
        window.showNotification?.("success", t("editor.notifications.zipLoadSuccess"))
        setIsLoading(false)
        setLoadingProgress(0)
        setLoadingStatus("")
      })

      await level.load()

    } catch (error) {
      console.error('[ZIP] Loading error:', error)
      window.showNotification?.("error", `${t("editor.notifications.zipLoadError")}: ${error}`)
      setIsLoading(false)
      setLoadingProgress(0)
      setLoadingStatus("")
    }
  }

  // 文件加载处理
  const handleFileLoad = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0]
      if (!file) return

      setIsLoading(true)
      setLoadingProgress(0)
      setLoadingStatus(t("loading.parsingLevel"))
      resetProgressDetail()

      const reader = new FileReader()

      reader.onload = async (e): Promise<void> => {
        try {
          console.log('[DEBUG] File loaded, starting parse...')

          // Get ArrayBuffer directly
          const arrayBuffer = e.target?.result as ArrayBuffer
          const fileSize = arrayBuffer?.byteLength || 0
          console.log('[DEBUG] ArrayBuffer size:', fileSize)

          // Check if file is a ZIP archive
          const fileName = file.name.toLowerCase()
          const isZip = fileName.endsWith('.zip') ||
            file.type === 'application/zip' ||
            file.type === 'application/x-zip-compressed' ||
            file.type === 'application/x-zip'

          if (isZip) {
            console.log('[DEBUG] Detected ZIP file')
            await loadFromZip(arrayBuffer)
            return
          }

          // 判断是否为超大文件 (>90MB)：仅用于进度分段
          const isVeryLargeFile = fileSize > VERY_LARGE_FILE_THRESHOLD
          console.log('[DEBUG] Is very large file:', isVeryLargeFile, '(threshold:', VERY_LARGE_FILE_THRESHOLD, ')')

          // 大谱面统一走 StringParser：LargeFileParser 会丢科学计数法角度
          // （ADOFAI 极小角度写成 1.17e-38 这类形式），导致砖数缩短、后方 Twirl 越界丢失。
          // 仅当字符串解码失败（超出 V8 字符串上限/内存不足）时才回退 LargeFileParser。
          let content: string
          try {
            content = new TextDecoder('utf-8').decode(arrayBuffer)
          } catch (error) {
            console.warn('[DEBUG] String decode failed, falling back to LargeFileParser:', error)
            await loadLargeFile(arrayBuffer, isVeryLargeFile)
            return
          }
          console.log('[DEBUG] Content length:', content?.length)

          // Choose loading method based on settings
          if (settings.loadMethod === 'worker') {
            console.log('[DEBUG] Using worker loading')
            await loadWithWorker(content)
          } else if (settings.loadMethod === 'async') {
            console.log('[DEBUG] Using async loading')
            await loadAsync(content)
          } else {
            console.log('[DEBUG] Using sync loading')
            loadSync(content)
          }
        } catch (error) {
          console.error('[DEBUG] Loading error:', error)
          window.showNotification?.("error", t("editor.notifications.loadError"))
          console.error(error)
          setIsLoading(false)
          setLoadingProgress(0)
          setLoadingStatus("")
        }
      }

      reader.onerror = (): void => {
        window.showNotification?.("error", t("editor.notifications.fileReadError"))
        setIsLoading(false)
        setLoadingProgress(0)
        setLoadingStatus("")
      }

      // Always use readAsArrayBuffer
      reader.readAsArrayBuffer(file)
    },
    [t, settings, initializePlayer, setIsLoading, setLoadingProgress, setLoadingStatus]
  )

  // 音频加载处理
  const handleAudioLoad = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0]
      if (!file) return

      const url = URL.createObjectURL(file)

      if (previewerRef.current) {
        previewerRef.current.loadMusic(url)
        window.showNotification?.("success", "Audio loaded successfully")
      } else {
        window.showNotification?.("warning", "Please load a level first")
      }
    },
    [previewerRef]
  )

  // 视频加载处理
  const handleVideoLoad = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0]
      if (!file) return

      const url = URL.createObjectURL(file)

      if (previewerRef.current) {
        previewerRef.current.loadVideo(url)
        window.showNotification?.("success", "Video loaded successfully")
      } else {
        window.showNotification?.("warning", "Please load a level first")
      }
    },
    [previewerRef]
  )

  // 装饰图片加载处理（支持多选）
  const handleDecorationLoad = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const files = event.target.files
      if (!files || files.length === 0) return

      if (!previewerRef.current) {
        window.showNotification?.("warning", "Please load a level first")
        return
      }

      // Register each decoration image
      const loadedFiles: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const url = URL.createObjectURL(file)
        // 文件夹上传时用相对路径作 key，避免不同子目录的同名文件互相覆盖
        const relPath = (file as any).webkitRelativePath as string | undefined
        const filename = (relPath && relPath.length > 0) ? relPath : file.name

        // Register with decoration manager
        if (previewerRef.current.registerDecorationImage) {
          previewerRef.current.registerDecorationImage(filename, url)
          loadedFiles.push(filename)
        }
      }

      if (loadedFiles.length > 0) {
        // Preload textures asynchronously
        if (previewerRef.current.preloadDecorationTextures) {
          previewerRef.current.preloadDecorationTextures().then((count) => {
            window.showNotification?.("success", `Loaded ${loadedFiles.length} decoration image(s), ${count} textures preloaded`)
          })
        } else {
          window.showNotification?.("success", `Loaded ${loadedFiles.length} decoration image(s)`)
        }
      }
    },
    [previewerRef]
  )

  // 背景图片加载处理
  const handleBGImageLoad = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const files = event.target.files
      if (!files || files.length === 0) return

      if (!previewerRef.current) {
        window.showNotification?.("warning", "Please load a level first")
        return
      }

      // Register each background image
      const loadedFiles: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const url = URL.createObjectURL(file)
        const filename = file.name

        // Register with player for SetCustomBG events
        if (previewerRef.current.registerCustomBGImage) {
          previewerRef.current.registerCustomBGImage(filename, url)
          loadedFiles.push(filename)
        }
      }

      if (loadedFiles.length > 0) {
        window.showNotification?.("success", `Loaded ${loadedFiles.length} background image(s): ${loadedFiles.join(', ')}`)
      }
    },
    [previewerRef]
  )

  // 导出文件功能
  const handleExport = useCallback((): void => {
    if (!previewerRef.current) {
      window.showNotification?.("error", t("editor.notifications.noFileToExport"))
      return
    }

    try {
      const adofaiFile = (previewerRef.current as any).levelData
      const exportData = JSON.stringify(adofaiFile, null, 2)
      const blob = new Blob([exportData], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "level.adofai"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      window.showNotification?.("success", t("editor.notifications.exportSuccess"))
    } catch (error) {
      console.error("Export error:", error)
      window.showNotification?.("error", t("editor.notifications.exportError"))
    }
  }, [t, previewerRef])

  return {
    handleFileLoad,
    handleAudioLoad,
    handleVideoLoad,
    handleDecorationLoad,
    handleBGImageLoad,
    handleExport
  }
}
