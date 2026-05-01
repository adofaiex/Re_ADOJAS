import { useCallback } from "react"
import * as ADOFAI from "adofai"
import { Parsers, Structure } from "adofai"
import type { ILevelData } from "@/lib/Player/types"
import { Player } from "@/lib/Player/Player"
import { LargeFileParser } from "@/lib/LargeFileParser"
import JSZip from "jszip"

// 类型导入
type ParseProgressEvent = Structure.ParseProgressEvent;

// 使用 StringParser 作为解析器
const StringParser = Parsers.StringParser
const parser = new StringParser()

// 大文件阈值 - V8 字符串限制约为 512MB，我们设置安全阈值
const LARGE_FILE_THRESHOLD = 400 * 1024 * 1024 // 400MB

// 超大文件阈值 - 需要提前预合成 hitsound
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
  setAdofaiFile: (file: any) => void
  initializePlayer: (loadedLevel: any) => void
  settings: any
  t: (key: string) => string
  containerRef: React.RefObject<HTMLDivElement>
  fpsCounterRef: React.RefObject<HTMLDivElement>
  infoRef: React.RefObject<HTMLDivElement>
  previewerRef: React.MutableRefObject<Player | null>
}

export function useFileHandlers({
  setIsLoading,
  setLoadingProgress,
  setLoadingStatus,
  setAdofaiFile,
  initializePlayer,
  settings,
  t,
  containerRef,
  fpsCounterRef,
  infoRef,
  previewerRef
}: UseFileHandlersProps) {
  
  // 辅助函数：初始化玩家并合成打拍音
  const initializePlayerWithHitsounds = async (loadedLevel: any, isVeryLargeFile: boolean = false): Promise<void> => {
    initializePlayer(loadedLevel)
    
    // Synthesize hitsounds with progress display
    if (previewerRef.current) {
      if (isVeryLargeFile) {
        // 对于超大文件，显示详细的合成进度
        setLoadingProgress(85)
        setLoadingStatus(t("loading.synthesizingHitsounds"))
        
        await previewerRef.current.preSynthesizeHitsoundsWithProgress((percent) => {
          // Map 0-100 to 85-99
          const mappedPercent = 85 + (percent / 100) * 14
          setLoadingProgress(mappedPercent)
        })
      } else {
        setLoadingProgress(96)
        setLoadingStatus(t("loading.synthesizingHitsounds"))
        
        await previewerRef.current.preSynthesizeHitsoundsWithProgress((percent) => {
          // Map 0-100 to 96-100
          const mappedPercent = 96 + (percent / 100) * 4
          setLoadingProgress(mappedPercent)
        })
      }
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
      const level = new ADOFAI.Level(parsedData, undefined)

      // 监听进度事件
      level.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
        setLoadingProgress(80 + Math.round(progressEvent.percent * 0.05))
        setLoadingStatus(getStageText(progressEvent.stage, t))
      })

      level.on("load", async (loadedLevel: any): Promise<void> => {
        // 计算瓦片位置
        loadedLevel.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
          setLoadingProgress(80 + Math.round(progressEvent.percent * 0.05))
          setLoadingStatus(getStageText(progressEvent.stage, t))
        })
        // loadedLevel.calculateTilePosition() // Skip - using our own position calculation in PositionTrackManager

        setLoadingProgress(85)
        setLoadingStatus(t("loading.buildingScene"))

        // Initialize player and synthesize hitsounds
        await initializePlayerWithHitsounds(loadedLevel, isVeryLargeFile)

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
    const level = new ADOFAI.Level(content, parser)
    
    // 监听进度事件
    level.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
      setLoadingProgress(progressEvent.percent)
      setLoadingStatus(getStageText(progressEvent.stage, t))
    })
    
    level.on("load", async (loadedLevel: any): Promise<void> => {
      // 计算瓦片位置时也会触发进度事件
      loadedLevel.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
        setLoadingProgress(progressEvent.percent)
        setLoadingStatus(getStageText(progressEvent.stage, t))
      })
      // loadedLevel.calculateTilePosition() // Skip - using our own position calculation in PositionTrackManager
      
      setLoadingProgress(95)
      setLoadingStatus(t("loading.buildingScene"))
      
      // Initialize player and synthesize hitsounds
      await initializePlayerWithHitsounds(loadedLevel)
      
      setLoadingProgress(100)
      window.showNotification?.("success", t("editor.notifications.loadSuccess"))
      setIsLoading(false)
      setLoadingProgress(0)
      setLoadingStatus("")
    })
    
    level.load()
  }

  // Asynchronous loading (non-blocking)
  const loadAsync = async (content: string): Promise<void> => {
    const level = new ADOFAI.Level(content, parser)
    
    // 监听进度事件
    level.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
      setLoadingProgress(progressEvent.percent)
      setLoadingStatus(getStageText(progressEvent.stage, t))
    })
    
    level.on("load", async (loadedLevel: any): Promise<void> => {
      // 计算瓦片位置时也会触发进度事件
      loadedLevel.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
        setLoadingProgress(progressEvent.percent)
        setLoadingStatus(getStageText(progressEvent.stage, t))
      })
      // loadedLevel.calculateTilePosition() // Skip - using our own position calculation in PositionTrackManager
      
      setLoadingProgress(95)
      setLoadingStatus(t("loading.buildingScene"))
      
      // Initialize player and synthesize hitsounds
      await initializePlayerWithHitsounds(loadedLevel)
      
      setLoadingProgress(100)
      window.showNotification?.("success", t("editor.notifications.loadSuccess"))
      setIsLoading(false)
      setLoadingProgress(0)
      setLoadingStatus("")
    })
    
    await level.load()
  }

  // Worker loading (background thread)
  const loadWithWorker = async (content: string): Promise<void> => {
    // Check if running on file:// protocol - workers don't work there
    if (window.location.protocol === 'file:') {
      console.log('file:// protocol detected, falling back to async loading')
      window.showNotification?.("warning", "Worker mode not supported on file:// protocol, using async mode")
      await loadAsync(content)
      return
    }

    setLoadingProgress(0)
    setLoadingStatus(t("loading.stage.start"))
    
    try {
      // Create worker - correct path to src/lib/Player/levelLoaderWorker.ts
      const worker = new Worker(
        new URL('../../lib/Player/levelLoaderWorker', import.meta.url),
        { type: 'module' }
      )
      
      worker.onmessage = async (e) => {
        const { type, progress, status, stage, current, total, data, error } = e.data
        
        if (type === 'progress') {
          setLoadingProgress(progress)
          // Use translated stage text
          setLoadingStatus(getStageText(stage, t))
        } else if (type === 'result') {
          const { levelData } = data
          
          setLoadingProgress(95)
          setLoadingStatus(t("loading.buildingScene"))
          
          // Create player and synthesize hitsounds
          await initializePlayerWithHitsounds(levelData)
          
          setLoadingProgress(100)
          window.showNotification?.("success", t("editor.notifications.loadSuccess"))
          setIsLoading(false)
          setLoadingProgress(0)
          setLoadingStatus("")
          
          worker.terminate()
        } else if (type === 'error') {
          console.error('Worker error:', error)
          window.showNotification?.("error", `${t("editor.notifications.loadError")}: ${error}`)
          setIsLoading(false)
          setLoadingProgress(0)
          setLoadingStatus("")
          worker.terminate()
        }
      }
      
      worker.onerror = (error) => {
        console.error('Worker onerror:', error.message, error.filename, error.lineno)
        window.showNotification?.("error", `Worker failed: ${error.message}`)
        setIsLoading(false)
        setLoadingProgress(0)
        setLoadingStatus("")
        worker.terminate()
      }
      
      // Start loading
      worker.postMessage({ type: 'load', content })
      
    } catch (error) {
      console.error('Failed to create worker:', error)
      // Fallback to async loading
      await loadAsync(content)
    }
  }

  // ZIP file loading - extract and auto-load level, audio, and decorations
  const loadFromZip = async (arrayBuffer: ArrayBuffer): Promise<void> => {
    setLoadingStatus(t("loading.extractingZip"))
    setLoadingProgress(5)
    
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
      const level = new ADOFAI.Level(adofaiContent, parser)
      
      level.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
        setLoadingProgress(10 + Math.round(progressEvent.percent * 0.5))
        setLoadingStatus(getStageText(progressEvent.stage, t))
      })
      
      level.on("load", async (loadedLevel: any): Promise<void> => {
        loadedLevel.on("parse:progress", (progressEvent: ParseProgressEvent): void => {
          setLoadingProgress(10 + Math.round(progressEvent.percent * 0.5))
          setLoadingStatus(getStageText(progressEvent.stage, t))
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
        const tiles = loadedLevel.tiles || []
        tiles.forEach((tile: any) => {
          if (tile.addDecorations) {
            tile.addDecorations.forEach((dec: any) => {
              if (dec.decorationImage) {
                decorationImages.add(dec.decorationImage)
              }
            })
          }
        })
        
        console.log('[ZIP] Decoration images needed:', Array.from(decorationImages))
        
        // Load decoration images from ZIP
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']
        let loadedImages = 0
        
        for (const imageName of decorationImages) {
          // Find matching image file in ZIP
          for (const ext of imageExtensions) {
            const imageFile = files.find(f => {
              const name = f.toLowerCase()
              const targetName = imageName.toLowerCase()
              // Flexible matching
              return name === targetName ||
                     name === targetName + ext ||
                     name.endsWith('/' + targetName) ||
                     name.endsWith('/' + targetName + ext) ||
                     // Match just filename
                     name.endsWith('/' + imageName.split('/').pop()?.toLowerCase() + ext) ||
                     name.endsWith(imageName.split('/').pop()?.toLowerCase() + ext)
            })
            
            if (imageFile) {
              console.log('[ZIP] Found decoration image:', imageFile)
              const imageBlob = await zip.file(imageFile)?.async('blob')
              if (imageBlob && previewerRef.current?.registerDecorationImage) {
                const imageUrl = URL.createObjectURL(imageBlob)
                const filename = imageName.split('/').pop() || imageName
                previewerRef.current.registerDecorationImage(filename, imageUrl)
                loadedImages++
              }
              break
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
        
        // Check SetCustomBG events
        const actions = loadedLevel.actions || []
        actions.forEach((action: any) => {
          if (action.eventType === 'SetCustomBG' && action.image) {
            bgImages.add(action.image)
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
          
          // 判断是否为超大文件 (>90MB) 或大文件 (>400MB)
          const isVeryLargeFile = fileSize > VERY_LARGE_FILE_THRESHOLD
          const isLargeFile = fileSize > LARGE_FILE_THRESHOLD
          console.log('[DEBUG] Is very large file:', isVeryLargeFile, '(threshold:', VERY_LARGE_FILE_THRESHOLD, ')')
          console.log('[DEBUG] Is large file:', isLargeFile, '(threshold:', LARGE_FILE_THRESHOLD, ')')

          if (isLargeFile) {
            // 大文件：直接使用 ArrayBuffer 解析，不转换为字符串
            console.log('[DEBUG] Using large file parser')
            await loadLargeFile(arrayBuffer, isVeryLargeFile)
          } else if (isVeryLargeFile) {
            // 超大文件但不是极大文件：也使用 LargeFileParser
            console.log('[DEBUG] Using large file parser for very large file')
            await loadLargeFile(arrayBuffer, true)
          } else {
            // 小文件：转换为字符串后解析
            const decoder = new TextDecoder('utf-8')
            const content = decoder.decode(arrayBuffer)
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
    [t, settings, setIsLoading, setLoadingProgress, setLoadingStatus]
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
        const filename = file.name
        
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
