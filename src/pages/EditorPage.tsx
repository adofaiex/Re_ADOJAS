"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Home, Settings, Save, Upload, Download, Music } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"
import { useI18n } from "@/lib/i18n/context"
import * as THREE from "three"
import * as ADOFAI from "adofai"
import Hjson from "hjson"
import createTrackMesh from "@/lib/Geo/mesh_reserve"
import { Player } from "@/lib/Player/Player"
import { ILevelData } from "@/lib/Player/types"
import example from "@/lib/example/line.json"
import { useAppSettings } from "@/hooks/use-app-settings"
import type { JSX } from "react/jsx-runtime"

// 声明全局类型
declare global {
  interface Window {
    showNotification?: (type: string, message: string) => void
  }
  interface Navigator {
    gpu?: any
  }
}

// 通知系统组件
function NotificationSystem(): JSX.Element {
  const [notifications, setNotifications] = useState<Array<{ id: number; type: string; message: string }>>([])

  const addNotification = useCallback((type: string, message: string): void => {
    const id = Date.now()
    setNotifications((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, 3000)
  }, [])

  // 暴露给全局使用
  useEffect(() => {
    window.showNotification = addNotification
  }, [addNotification])

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`px-4 py-2 rounded-lg text-white font-medium shadow-lg transition-all duration-300 ${
            notification.type === "success"
              ? "bg-green-500"
              : notification.type === "warning"
                ? "bg-yellow-500"
                : notification.type === "error"
                  ? "bg-red-500"
                  : "bg-blue-500"
          }`}
        >
          {notification.message}
        </div>
      ))}
    </div>
  )
}

// @deprecated - Refactored to src/lib/Player/Player.ts
class Previewer {
  private container: HTMLElement
  private fpsCounter: HTMLElement
  private info: HTMLElement
  private animationId: number | null = null
  private isDisposed = false
  private frameCount = 0
  private lastTime: number = performance.now()
  private fpsUpdateTime: number = performance.now()
  private fps = 0
  private isDragging = false
  private previousMousePosition: { x: number; y: number } = { x: 0, y: 0 }
  private cameraPosition: { x: number; y: number } = { x: 0, y: 0 }
  private zoom = 1

  // 播放相关属性
  private playMode: "preview" | "play" | "pause" = "preview"
  private playAnimationId: number | null = null
  private curTile = 0
  private planetR: THREE.Mesh | null = null
  private planetB: THREE.Mesh | null = null
  private playStartTime: number = 0
  private playElapsedTime: number = 0
  private isPaused = false
  private lastPlayTime: number = 0
  private cameraTargetPosition: { x: number; y: number } = { x: 0, y: 0 }
  private planetRPosition: { x: number; y: number } = { x: 0, y: 0 }
  private planetBPosition: { x: number; y: number } = { x: 0, y: 0 }
  private minZoom = 0
  private maxZoom = 240
  private tiles: Map<string, THREE.Mesh> = new Map()
  private visibleTiles: Set<string> = new Set()
  private tileLimit = 0
  private adofaiFile: any
  private boundEventHandlers: Record<string, (event?: any) => void>
  private scene: THREE.Scene | null = null
  private camera: THREE.OrthographicCamera | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private tileGeometry: THREE.BoxGeometry | null = null
  private tileMaterials: THREE.MeshBasicMaterial[] | null = null
  private initialPinchDistance = 0
  private initialZoom = 0
  private t: (key: string) => string
  


  constructor(
    adofaiFile: any,
    container: HTMLElement,
    fpsCounter: HTMLElement,
    info: HTMLElement,
    t: (key: string) => string,
  ) {
    this.container = container
    this.fpsCounter = fpsCounter
    this.info = info
    this.adofaiFile = adofaiFile
    this.t = t

    // 绑定事件处理函数到实例
    this.boundEventHandlers = {
      mouseDown: this.onMouseDown.bind(this),
      mouseMove: this.onMouseMove.bind(this),
      mouseUp: this.onMouseUp.bind(this),
      wheel: this.onWheel.bind(this),
      touchStart: this.onTouchStart.bind(this),
      touchMove: this.onTouchMove.bind(this),
      touchEnd: this.onTouchEnd.bind(this),
      windowResize: this.onWindowResize.bind(this),
      contextMenu: (e: Event): void => e.preventDefault(),
    }

    this.init()
    this.setupEventListeners()
    this.animate()
  }

  // 颜色计算函数

  private getContainerSize(): { width: number; height: number } {
    const rect = this.container.getBoundingClientRect()
    return {
      width: rect.width,
      height: rect.height,
    }
  }

  public dispose(): void {
    console.log("Disposing Previewer...")
    this.isDisposed = true

    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    // 停止播放动画
    this.stopPlay()

    this.removeEventListeners()

    this.cleanupThreeJS()

    this.cleanupDOM()

    console.log("Previewer disposed successfully")
  }

  // 播放相关方法
  public startPlay(): void {
    if (this.isDisposed) return
    this.playMode = "play"
    this.curTile = 0
    this.playStartTime = performance.now()
    this.playElapsedTime = 0
    this.isPaused = false
    
    // 初始化目标位置
    this.cameraTargetPosition = { ...this.cameraPosition }
    
    // 创建红球和蓝球
    this.createPlanets()
    
    // 开始播放动画
    this.startPlayAnimation()
  }

  public pausePlay(): void {
    if (this.isDisposed) return
    this.playMode = "pause"
    this.isPaused = true
    this.lastPlayTime = performance.now()
  }

  public resumePlay(): void {
    if (this.isDisposed) return
    this.playMode = "play"
    this.isPaused = false
    this.playStartTime = performance.now() - this.playElapsedTime
  }

  public stopPlay(): void {
    if (this.isDisposed) return
    this.playMode = "preview"
    this.isPaused = false
    
    if (this.playAnimationId) {
      cancelAnimationFrame(this.playAnimationId)
      this.playAnimationId = null
    }
    
    // 移除红球和蓝球
    this.removePlanets()
    
    // 重置相机位置
    this.cameraPosition = { x: 0, y: 0 }
    this.zoom = 1
    this.updateCamera()
  }



  private createPlanets(): void {
    if (!this.scene) return
    
    // 创建红球
    const planetRGeometry = new THREE.SphereGeometry(0.15, 32, 32)
    const planetRMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    this.planetR = new THREE.Mesh(planetRGeometry, planetRMaterial)
    
    // 创建蓝球
    const planetBGeometry = new THREE.SphereGeometry(0.15, 32, 32)
    const planetBMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff })
    this.planetB = new THREE.Mesh(planetBGeometry, planetBMaterial)
    
    // 根据 curTile 设置初始位置
    if (this.curTile === 0) {
      // 倒计时阶段：红球在轨道0，蓝球在轨道1
      const tile0 = this.adofaiFile.tiles[0]
      const tile1 = this.adofaiFile.tiles[1]
      
      if (tile0 && tile1) {
        const [x0, y0] = tile0.position
        const [x1, y1] = tile1.position
        this.planetR.position.set(x0 + 1, y0, 1)
        this.planetB.position.set(x1 + 1, y1, 1)
        this.planetRPosition = { x: x0 + 1, y: y0 }
        this.planetBPosition = { x: x1 + 1, y: y1 }
      }
    } else {
      // 正常播放阶段：根据 curTile 确定球的位置
      const currentTile = this.adofaiFile.tiles[this.curTile]
      const prevTile = this.adofaiFile.tiles[this.curTile - 1]
      
      if (currentTile && prevTile) {
        const [cx, cy] = currentTile.position
        const [px, py] = prevTile.position
        
        if (this.curTile % 2 === 1) {
          // curTile 为奇数：红球在当前轨道，蓝球在前一个轨道
          this.planetR.position.set(cx + 1, cy, 1)
          this.planetB.position.set(px + 1, py, 1)
          this.planetRPosition = { x: cx + 1, y: cy }
          this.planetBPosition = { x: px + 1, y: py }
        } else {
          // curTile 为偶数：蓝球在当前轨道，红球在前一个轨道
          this.planetB.position.set(cx + 1, cy, 1)
          this.planetR.position.set(px + 1, py, 1)
          this.planetBPosition = { x: cx + 1, y: cy }
          this.planetRPosition = { x: px + 1, y: py }
        }
      }
    }
    
    this.scene.add(this.planetR)
    this.scene.add(this.planetB)
  }

  private removePlanets(): void {
    if (!this.scene) return
    
    if (this.planetR) {
      this.scene.remove(this.planetR)
      this.planetR.geometry.dispose()
      if (Array.isArray(this.planetR.material)) {
        this.planetR.material.forEach((mat: any) => mat.dispose())
      } else {
        this.planetR.material.dispose()
      }
      this.planetR = null
    }
    
    if (this.planetB) {
      this.scene.remove(this.planetB)
      this.planetB.geometry.dispose()
      if (Array.isArray(this.planetB.material)) {
        this.planetB.material.forEach((mat: any) => mat.dispose())
      } else {
        this.planetB.material.dispose()
      }
      this.planetB = null
    }
  }

  private startPlayAnimation(): void {
    if (this.isDisposed) return
    
    const animate = (): void => {
      if (this.isDisposed || this.playMode === "preview") {
        this.playAnimationId = null
        return
      }
      
      if (this.playMode === "play") {
        this.updatePlanets()
      }
      
      this.playAnimationId = requestAnimationFrame(animate)
    }
    
    this.playAnimationId = requestAnimationFrame(animate)
  }

  private updatePlanets(): void {
    if (!this.planetR || !this.planetB) return
    
    const currentTime = performance.now()
    const totalElapsed = currentTime - this.playStartTime
    
    const bpm = this.adofaiFile.settings.bpm || 100
    const rotationSpeed = (bpm / 120) * 360 // 度/秒
    const countdownTicks = this.adofaiFile.settings.countdownTicks || 4
    const offset = this.adofaiFile.settings.offset || 0
    
    // 计算倒计时圈数（根据 offset 调整，必须是整数）
    const additionalRotations = Math.floor(offset / 1000 * bpm / 60)
    const totalRotations = countdownTicks + additionalRotations
    
    const tile0 = this.adofaiFile.tiles[0]
    const tile1 = this.adofaiFile.tiles[1]
    
    if (this.curTile === 0) {
      // 倒计时阶段：蓝球围绕红球旋转
      if (tile0 && tile1) {
        const [x0, y0] = tile0.position
        const [x1, y1] = tile1.position
        const radius = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2))
        const startAngle = Math.atan2(y1 - y0, x1 - x0)
        
        // 红球固定在第0个砖块
        this.planetRPosition = { x: x0 + 1, y: y0 }
        this.planetR.position.set(x0 + 1, y0, 1)
        
        // 计算倒计时总圈数：countdownTicks + offset调整 + tile0的angle/180
        const tile0Angle = Math.abs(tile0.angle || 0)
        const additionalRotationsFromAngle = tile0Angle / 180
        const totalRotations = countdownTicks + additionalRotations + additionalRotationsFromAngle
        
        const countdownAngle = totalRotations * 360
        const currentAngle = (totalElapsed / 1000) * rotationSpeed
        
        if (currentAngle < countdownAngle) {
          // 仍在倒计时旋转中（顺时针旋转）
          const angle = startAngle - (currentAngle * Math.PI / 180)
          this.planetBPosition = {
            x: x0 + 1 + radius * Math.cos(angle),
            y: y0 + radius * Math.sin(angle)
          }
          this.planetB.position.set(this.planetBPosition.x, this.planetBPosition.y, 1)
        } else {
          // 倒计时结束，蓝球落回第1个砖块
          this.curTile = 1
          this.planetBPosition = { x: x1 + 1, y: y1 }
          this.planetB.position.set(x1 + 1, y1, 1)
          // 重置时间用于后续动画
          this.playStartTime = currentTime
          // 设置相机目标位置
          this.cameraTargetPosition = { x: x1 + 1, y: y1 }
        }
      }
    } else if (this.curTile >= Object.keys(this.adofaiFile.tiles).length) {
      // 抵达最后一个砖块，停留在最后一个砖块
      const lastTileIndex = Object.keys(this.adofaiFile.tiles).length - 1
      const lastTile = this.adofaiFile.tiles[lastTileIndex]
      
      if (lastTile) {
        const [lx, ly] = lastTile.position
        this.cameraTargetPosition = { x: lx + 1, y: ly }
      }
    } else {
      // 正常播放阶段：球交替旋转中心
      const currentTile = this.adofaiFile.tiles[this.curTile]
      const nextTile = this.adofaiFile.tiles[this.curTile + 1]
      
      if (currentTile && nextTile) {
        const [cx, cy] = currentTile.position
        const [nx, ny] = nextTile.position
        
        // 目标角度（使用 tile.angle）
        const targetAngle = Math.abs(currentTile.angle || 0)
        const currentAngle = ((currentTime - this.playStartTime) / 1000) * rotationSpeed
        
        if (currentAngle >= targetAngle) {
          // 到达目标轨道
          this.curTile++
          
          // 设置相机目标位置
          this.cameraTargetPosition = { x: nx + 1, y: ny }
          
          // 重置时间用于下一段动画
          this.playStartTime = currentTime
        } else {
          // 旋转动画
          const prevTile = this.adofaiFile.tiles[this.curTile - 1]
          
          if (prevTile) {
            const [px, py] = prevTile.position
            
            // 计算旋转半径
            const radius = Math.sqrt(Math.pow(nx - cx, 2) + Math.pow(ny - cy, 2))
            
            // 计算从上一轨道到当前轨道的方向角（起始方向）
            const directionFromPrev = Math.atan2(cy - py, cx - px)
            
            // 计算旋转的插值比例
            const progress = currentAngle / targetAngle
            
            // 顺时针旋转：从起始方向开始，旋转 progress * π 弧度
            // 顺时针在标准坐标系中是角度递减
            const currentAngleRad = directionFromPrev - (progress * Math.PI)
            
            // 奇数curTile（1,3,5...）：红球围绕蓝球旋转，蓝球位置不变（在currentTile）
            // 偶数curTile（2,4,6...）：蓝球围绕红球旋转，红球位置不变（在currentTile）
            if (this.curTile % 2 === 1) {
              // curTile为奇数：红球围绕蓝球旋转
              this.planetBPosition = { x: cx + 1, y: cy } // 蓝球位置不变
              this.planetB.position.set(cx + 1, cy, 1)
              
              // 红球旋转
              this.planetRPosition = {
                x: cx + 1 + radius * Math.cos(currentAngleRad),
                y: cy + radius * Math.sin(currentAngleRad)
              }
              this.planetR.position.set(this.planetRPosition.x, this.planetRPosition.y, 1)
            } else {
              // curTile为偶数：蓝球围绕红球旋转
              this.planetRPosition = { x: cx + 1, y: cy } // 红球位置不变
              this.planetR.position.set(cx + 1, cy, 1)
              
              // 蓝球旋转
              this.planetBPosition = {
                x: cx + 1 + radius * Math.cos(currentAngleRad),
                y: cy + radius * Math.sin(currentAngleRad)
              }
              this.planetB.position.set(this.planetBPosition.x, this.planetBPosition.y, 1)
            }
          }
        }
      }
    }
    
    // 平滑移动相机
    const lerpFactor = 0.15
    this.cameraPosition.x += (this.cameraTargetPosition.x - this.cameraPosition.x) * lerpFactor
    this.cameraPosition.y += (this.cameraTargetPosition.y - this.cameraPosition.y) * lerpFactor
    this.updateCamera()
  }

  private removeEventListeners(): void {
    if (this.renderer && this.renderer.domElement) {
      const canvas = this.renderer.domElement
      canvas.removeEventListener("mousedown", this.boundEventHandlers.mouseDown)
      canvas.removeEventListener("mousemove", this.boundEventHandlers.mouseMove)
      canvas.removeEventListener("mouseup", this.boundEventHandlers.mouseUp)
      canvas.removeEventListener("wheel", this.boundEventHandlers.wheel)
      canvas.removeEventListener("touchstart", this.boundEventHandlers.touchStart)
      canvas.removeEventListener("touchmove", this.boundEventHandlers.touchMove)
      canvas.removeEventListener("touchend", this.boundEventHandlers.touchEnd)
      canvas.removeEventListener("contextmenu", this.boundEventHandlers.contextMenu)
    }

    window.removeEventListener("resize", this.boundEventHandlers.windowResize)
  }



  private cleanupThreeJS(): void {
    // 清理所有tile meshes
    this.tiles.forEach((mesh) => {
      if (mesh.geometry) mesh.geometry.dispose()
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat: any) => mat.dispose())
        } else {
          mesh.material.dispose()
        }
      }
      if (this.scene) {
        this.scene.remove(mesh)
      }
    })
    this.tiles.clear()
    this.visibleTiles.clear()

    // 清理材质
    if (this.tileMaterials) {
      this.tileMaterials.forEach((material: any) => {
        if (material.dispose) material.dispose()
      })
      this.tileMaterials = null
    }

    // 清理几何体
    if (this.tileGeometry) {
      this.tileGeometry.dispose()
      this.tileGeometry = null
    }

    // 清理场景中的所有对象
    if (this.scene) {
      while (this.scene.children.length > 0) {
        const child = this.scene.children[0]
        // 类型断言为 Mesh 来访问 geometry 和 material 属性
        const mesh = child as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat: any) => mat.dispose())
          } else {
            mesh.material.dispose()
          }
        }
        this.scene.remove(child)
      }
      this.scene = null
    }

    // 清理渲染器
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer = null
    }

    // 清理相机
    this.camera = null
  }

  private cleanupDOM(): void {
    // 移除canvas元素
    if (this.container) {
      const canvas = this.container.querySelector("canvas")
      if (canvas) {
        this.container.removeChild(canvas)
      }
    }
  }

  private generateMockData(): any {
    return this.adofaiFile.tiles
  }

  private init(): void {
    // 获取容器尺寸
    const containerSize = this.getContainerSize()

    // 创建场景
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xf0f0f0) // 改为浅灰色背景

    // 创建摄像机 - 调整近远平面
    const aspect = containerSize.width / containerSize.height
    const frustumSize = 20
    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1, // 近平面
      100, // 远平面
    )
    this.camera.position.z = 10

    // 创建渲染器
    const RendererClass = THREE.WebGLRenderer
    this.renderer = new RendererClass({ antialias: true })
    this.renderer.setSize(containerSize.width, containerSize.height)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.container.appendChild(this.renderer.domElement)

    // 添加更强的光源
    const ambientLight = new THREE.AmbientLight(0x404040, 1.0) // 增强环境光
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0) // 增强方向光
    directionalLight.position.set(10, 10, 15)
    directionalLight.castShadow = true
    this.scene.add(directionalLight)

    // 创建砖块几何体和材质
    this.tileGeometry = new THREE.BoxGeometry(1, 0.65, 0.2)
    this.tileMaterials = this.createTileMaterials()

    this.updateVisibleTiles()
  }

  private createTileMaterials(): THREE.MeshBasicMaterial[] {
    const materials: THREE.MeshBasicMaterial[] = []
    const colors = [
      0xdebb7b,
      0xffd700, // 金色
      0xff69b4, // 热粉色
      0x90ee90, // 浅绿色
      0x87ceeb, // 天蓝色
      0xffa500, // 橙色
      0xda70d6, // 紫罗兰色
      0xffffff,
      0xff00ff,
    ]

    colors.forEach((color) => {
      const m = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      })
      m.color = new THREE.Color(color)
      m.opacity = 0.5
      materials.push(m)
    })

    return materials
  }

  private createTransparentTileWithMergedGeometry(meshData: any, opacity: number, color?: number): THREE.Mesh {
    const geometry = new THREE.BufferGeometry()
    geometry.setIndex(meshData.faces)
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(meshData.vertices, 3))
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(meshData.colors, 3))
    geometry.computeVertexNormals()

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: opacity,
      side: THREE.DoubleSide,
      depthWrite: false, // 禁用深度写入以避免排序问题
    })

    // 如果需要整体颜色调制
    if (color) {
      material.color = new THREE.Color(color)
    }

    return new THREE.Mesh(geometry, material)
  }

  private setupEventListeners(): void {
    // 使用绑定的事件处理函数
    this.renderer!.domElement.addEventListener("mousedown", this.boundEventHandlers.mouseDown)
    this.renderer!.domElement.addEventListener("mousemove", this.boundEventHandlers.mouseMove)
    this.renderer!.domElement.addEventListener("mouseup", this.boundEventHandlers.mouseUp)
    this.renderer!.domElement.addEventListener("wheel", this.boundEventHandlers.wheel)

    // 触摸事件（双指缩放）
    this.renderer!.domElement.addEventListener("touchstart", this.boundEventHandlers.touchStart)
    this.renderer!.domElement.addEventListener("touchmove", this.boundEventHandlers.touchMove)
    this.renderer!.domElement.addEventListener("touchend", this.boundEventHandlers.touchEnd)

    // 窗口大小调整
    window.addEventListener("resize", this.boundEventHandlers.windowResize)

    // 防止右键菜单
    this.renderer!.domElement.addEventListener("contextmenu", this.boundEventHandlers.contextMenu)
  }

  private onMouseDown(event: MouseEvent): void {
    if (this.isDisposed) return
    this.isDragging = true
    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY,
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (this.isDisposed || !this.isDragging) return

    const deltaX = event.clientX - this.previousMousePosition.x
    const deltaY = event.clientY - this.previousMousePosition.y

    // 根据缩放调整移动速度
    const moveSpeed = 0.02 / this.zoom
    this.cameraPosition.x -= deltaX * moveSpeed
    this.cameraPosition.y += deltaY * moveSpeed

    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY,
    }

    this.updateCamera()
  }

  private onMouseUp(): void {
    if (this.isDisposed) return
    this.isDragging = false
  }

  private onWheel(event: WheelEvent): void {
    if (this.isDisposed) return
    event.preventDefault()

    const zoomSpeed = 0.1
    const zoomFactor = event.deltaY > 0 ? 1 - zoomSpeed : 1 + zoomSpeed

    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor))
    this.updateCamera()
  }

  // 触摸事件处理
  private onTouchStart(event: TouchEvent): void {
    if (this.isDisposed) return
    if (event.touches.length === 1) {
      this.isDragging = true
      this.previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      }
    } else if (event.touches.length === 2) {
      this.initialPinchDistance = this.getPinchDistance(event.touches)
      this.initialZoom = this.zoom
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (this.isDisposed) return
    event.preventDefault()

    if (event.touches.length === 1 && this.isDragging) {
      const deltaX = event.touches[0].clientX - this.previousMousePosition.x
      const deltaY = event.touches[0].clientY - this.previousMousePosition.y

      const moveSpeed = 0.02 / this.zoom
      this.cameraPosition.x -= deltaX * moveSpeed
      this.cameraPosition.y += deltaY * moveSpeed

      this.previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      }

      this.updateCamera()
    } else if (event.touches.length === 2) {
      const currentPinchDistance = this.getPinchDistance(event.touches)
      const zoomFactor = currentPinchDistance / this.initialPinchDistance

      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.initialZoom * zoomFactor))
      this.updateCamera()
    }
  }

  private onTouchEnd(): void {
    if (this.isDisposed) return
    this.isDragging = false
  }

  private getPinchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  private updateCamera(): void {
    if (this.isDisposed || !this.camera) return
    this.camera.position.x = this.cameraPosition.x
    this.camera.position.y = this.cameraPosition.y

    // 更新正交摄像机的视锥体 - 使用容器尺寸
    const containerSize = this.getContainerSize()
    const aspect = containerSize.width / containerSize.height
    const frustumSize = 20 / this.zoom

    this.camera.left = (frustumSize * aspect) / -2
    this.camera.right = (frustumSize * aspect) / 2
    this.camera.top = frustumSize / 2
    this.camera.bottom = frustumSize / -2
    this.camera.updateProjectionMatrix()

    this.updateVisibleTiles()
  }

  private updateVisibleTiles(): void {
    if (this.isDisposed || !this.scene) return
    // 计算摄像机能看到的范围 - 使用容器尺寸
    const containerSize = this.getContainerSize()
    const aspect = containerSize.width / containerSize.height
    const frustumSize = 20 / this.zoom

    const left = this.cameraPosition.x - (frustumSize * aspect) / 2
    const right = this.cameraPosition.x + (frustumSize * aspect) / 2
    const bottom = this.cameraPosition.y - frustumSize / 2
    const top = this.cameraPosition.y + frustumSize / 2

    // 清除当前可见的砖块
    this.visibleTiles.forEach((tileId) => {
      if (this.tiles.has(tileId)) {
        this.scene!.remove(this.tiles.get(tileId)!)
      }
    })
    this.visibleTiles.clear()

    // 找到在视野范围内的砖块
    let visibleTileIds: string[] = []
    visibleTileIds = Object.keys(this.adofaiFile.tiles).filter((id) => {
      const tile = this.adofaiFile.tiles[id]
      const [x, y] = tile.position
      return x >= left - 1 && x <= right + 1 && y >= bottom - 1 && y <= top + 1
    })

    // 应用limit限制
    let tilesToRender = visibleTileIds
    if (this.tileLimit > 0 && visibleTileIds.length > this.tileLimit) {
      // 按距离摄像机的距离排序，优先渲染近的
      tilesToRender = visibleTileIds
        .map((id) => {
          const tile = this.adofaiFile.tiles[Number.parseInt(id) - 1]
          const [x, y] = tile?.position || [0, 0]
          const distance = Math.sqrt(Math.pow(x - this.cameraPosition.x, 2) + Math.pow(y - this.cameraPosition.y, 2))
          return { id, distance }
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, this.tileLimit)
        .map((item) => item.id)
    }

    // 创建或重用砖块mesh
    tilesToRender.forEach((id, index) => {
      const tile = this.adofaiFile.tiles[Number.parseInt(id) - 1]
      const [x, y] = tile?.position || [0, 0]

      let tileMesh
      if (this.tiles.has(id)) {
        tileMesh = this.tiles.get(id)!
      } else {
        // 计算层级（第一个砖块层级12，后续递减）
        const zLevel = 12 - Number.parseInt(id)
        // 修正纹理索引：使用0-based索引 (id - 1)
        const materialIndex = (Number.parseInt(id) - 1) % this.tileMaterials!.length

        let pred = (this.adofaiFile.tiles[Number.parseInt(id) - 1]?.direction || 0) - 180
        if (this.adofaiFile.tiles[Number.parseInt(id) - 1]?.direction == 999) {
          pred = this.adofaiFile.tiles[Number.parseInt(id) - 2]?.direction || 0
          //pred -= 180;
        }
        const pred2 = this.adofaiFile.tiles[Number.parseInt(id)]?.direction || 0

        const meshdata = createTrackMesh(pred, pred2, this.adofaiFile.tiles[Number.parseInt(id)]?.direction == 999);
        if (!meshdata || !meshdata.faces) {
          console.error("Meshdata or meshdata.faces is undefined for tile id:", id, meshdata);
          return;
        }
        const mesh = new THREE.BufferGeometry();
        mesh.setIndex(meshdata.faces);
        mesh.setAttribute("position", new THREE.Float32BufferAttribute(meshdata.vertices, 3));
        mesh.setAttribute("color", new THREE.Float32BufferAttribute(meshdata.colors, 3));
        mesh.computeVertexNormals();

        tileMesh = new THREE.Mesh(mesh, this.tileMaterials![materialIndex])
        tileMesh.position.set(x, y, zLevel * 0.01) // 移除 +1 偏移，使用正确的位置
        tileMesh.castShadow = true
        tileMesh.receiveShadow = true

        this.tiles.set(id, tileMesh)
      }

      this.scene!.add(tileMesh)
      this.visibleTiles.add(id)
    })
  }

  private updateFPS(): void {
    if (this.isDisposed) return
    this.frameCount++
    const currentTime = performance.now()

    // 每0.5秒更新一次FPS显示
    if (currentTime - this.fpsUpdateTime >= 500) {
      this.fps = (this.frameCount * 1000) / (currentTime - this.fpsUpdateTime)
      if (this.fpsCounter) {
        this.fpsCounter.textContent = `FPS  ${this.fps.toFixed(2)}`
      }

      // 更新信息显示（在任何状态下都更新）
      if (this.info) {
        this.info.innerHTML = `
                    <div>${this.t("editor.info.cameraPosition")} (${this.cameraPosition.x.toFixed(2)}, ${this.cameraPosition.y.toFixed(2)})</div>
                    <div>${this.t("editor.info.zoom")} ${this.zoom.toFixed(2)}</div>
                    <div>${this.t("editor.info.horizon")} ${this.visibleTiles.size}</div>
                    <div>${this.t("editor.info.total")} ${Object.keys(this.adofaiFile.tiles).length}</div>
                `
      }

      this.frameCount = 0
      this.fpsUpdateTime = currentTime
    }
  }

  public onWindowResize(): void {
    if (this.isDisposed || !this.camera || !this.renderer) return
    // 使用容器尺寸而不是窗口尺寸
    const containerSize = this.getContainerSize()
    const aspect = containerSize.width / containerSize.height
    const frustumSize = 20 / this.zoom

    this.camera.left = (frustumSize * aspect) / -2
    this.camera.right = (frustumSize * aspect) / 2
    this.camera.top = frustumSize / 2
    this.camera.bottom = frustumSize / -2
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(containerSize.width, containerSize.height)

    this.updateVisibleTiles()
  }

  // 替换 animate 方法：
  private animate(): void {
    if (this.isDisposed) return

    this.animationId = requestAnimationFrame(this.animate.bind(this))

    const currentTime = performance.now()
    const deltaTime = currentTime - this.lastTime

    this.updateFPS()

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera)
    }

    // 更新lastTime用于下一帧的deltaTime计算
    this.lastTime = currentTime
  }
}

// 主编辑器页面
export default function EditorPage(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const fpsCounterRef = useRef<HTMLDivElement>(null)
  const infoRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const previewerRef = useRef<Player | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [adofaiFile, setAdofaiFile] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [themeReady, setThemeReady] = useState(false)
  const [playMode, setPlayMode] = useState<"preview" | "play" | "pause">("preview")
  const [playModeActive, setPlayModeActive] = useState(false)
  const { theme, resolvedTheme } = useTheme()
  const { t, mounted: i18nMounted } = useI18n()
  const { settings } = useAppSettings()

  // 播放功能
  const handlePlay = useCallback((): void => {
    if (!adofaiFile) {
      window.showNotification?.("error", t("editor.notifications.noFileToPlay"))
      return
    }

    if (playMode === "preview") {
      setPlayMode("play")
      setPlayModeActive(true)
      previewerRef.current?.startPlay()
    } else if (playMode === "play") {
      setPlayMode("pause")
      previewerRef.current?.pausePlay()
    } else if (playMode === "pause") {
      setPlayMode("play")
      previewerRef.current?.resumePlay()
    }
  }, [adofaiFile, playMode, t])

  // 退出播放模式
  const handleExitPlayMode = useCallback((): void => {
    setPlayMode("preview")
    setPlayModeActive(false)
    previewerRef.current?.stopPlay()
  }, [])

  // 主题处理

  // 确保组件和主题都已挂载
  useEffect(() => {
    setMounted(true)
    // 延迟一点时间确保主题完全加载
    const timer = setTimeout(() => {
      setThemeReady(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // 监听主题变化，确保主题正确应用
  useEffect(() => {
    if (mounted && resolvedTheme) {
      // 强制重新渲染以确保主题正确应用
      setThemeReady(false)
      const timer = setTimeout(() => {
        setThemeReady(true)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [mounted, resolvedTheme])

  // 导出文件功能
  const handleExport = useCallback((): void => {
    if (!adofaiFile) {
      window.showNotification?.("error", t("editor.notifications.noFileToExport"))
      return
    }

    try {
      const exportData = adofaiFile.export("string")
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
  }, [adofaiFile, t])



  // 文件加载处理
  const handleFileLoad = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0]
      if (!file) return

      setIsLoading(true)
      const reader = new FileReader()

      reader.onload = async (e): Promise<void> => {
        try {
          const content = e.target?.result as string

          // 使用ADOFAI.js解析文件
          const level = new ADOFAI.Level(content, Hjson)

          level.on("load", (loadedLevel: any): void => {
            loadedLevel.calculateTilePosition()
            setAdofaiFile(loadedLevel)

            // Clean up old Player
            if (previewerRef.current) {
              console.log("Disposing old Player...")
              previewerRef.current.destroyPlayer()
              previewerRef.current = null
            }

            // Create new Player
            if (containerRef.current && fpsCounterRef.current && infoRef.current) {
              const player = new Player(loadedLevel as ILevelData)
              player.createPlayer(containerRef.current)
              player.setRenderer(settings.renderer)
              
              player.setStatsCallback((stats) => {
                if (fpsCounterRef.current) {
                  fpsCounterRef.current.textContent = `FPS  ${stats.fps.toFixed(2)}`
                }
                if (infoRef.current) {
                  const bpm = loadedLevel.settings?.bpm || 0
                  infoRef.current.innerHTML = `
                    <div class="space-y-1">
                      <div>Time: ${(stats.time / 1000).toFixed(2)}s</div>
                      <div>Tile: ${stats.tileIndex} / ${loadedLevel.tiles?.length || 0}</div>
                      <div>BPM: ${bpm}</div>
                    </div>
                  `
                }
              })
              
              previewerRef.current = player
            }
            window.showNotification?.("success", t("editor.notifications.loadSuccess"))
          })

          await level.load()
        } catch (error) {
          window.showNotification?.("error", t("editor.notifications.loadError"))
          console.error(error)
        } finally {
          setIsLoading(false)
        }
      }

      reader.onerror = (): void => {
        window.showNotification?.("error", t("editor.notifications.fileReadError"))
        setIsLoading(false)
      }

      reader.readAsText(file)
    },
    [t],
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
    []
  )

  // 监听渲染器设置变化
  useEffect(() => {
    if (previewerRef.current && settings.renderer) {
      previewerRef.current.setRenderer(settings.renderer)
    }
  }, [settings.renderer])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key.toLowerCase() === "o") {
        e.preventDefault()
        fileInputRef.current?.click()
      } else if (e.code === "Space" && playModeActive) {
        e.preventDefault()
        handlePlay()
      } else if (e.code === "Escape" && playModeActive) {
        e.preventDefault()
        handleExitPlayMode()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [playModeActive, handlePlay, handleExitPlayMode])

  // 初始化示例数据
  useEffect(() => {
    if (!mounted || !i18nMounted || !themeReady) return

    const initializeExample = async (): Promise<void> => {
      try {
        const level = new ADOFAI.Level(example, Hjson)
        level.on("load", (loadedLevel: any): void => {
          loadedLevel.calculateTilePosition()
          setAdofaiFile(loadedLevel)

          if (previewerRef.current) {
            console.log("Disposing old Player...")
            previewerRef.current.destroyPlayer()
            previewerRef.current = null
          }

          if (containerRef.current && fpsCounterRef.current && infoRef.current) {
            const player = new Player(loadedLevel as ILevelData)
            player.createPlayer(containerRef.current)
            player.setRenderer(settings.renderer)
            
            player.setStatsCallback((stats) => {
              if (fpsCounterRef.current) {
                fpsCounterRef.current.textContent = `FPS  ${stats.fps.toFixed(2)}`
              }
              if (infoRef.current) {
                const bpm = loadedLevel.settings?.bpm || 0
                infoRef.current.innerHTML = `
                  <div class="space-y-1">
                    <div>Time: ${(stats.time / 1000).toFixed(2)}s</div>
                    <div>Tile: ${stats.tileIndex} / ${loadedLevel.tiles?.length || 0}</div>
                    <div>BPM: ${bpm}</div>
                  </div>
                `
              }
            })
            
            previewerRef.current = player
          }
          window.showNotification?.("success", t("editor.notifications.loadSuccess"))
        })

        await level.load()
      } catch (error) {
        window.showNotification?.("error", t("editor.notifications.loadError"))
        console.error(error)
      }
    }

    initializeExample()
  }, [mounted, i18nMounted, themeReady, t])

  // 监听窗口大小变化，触发Previewer的resize
  useEffect(() => {
    const handleResize = (): void => {
      if (previewerRef.current) {
        // 延迟执行以确保容器尺寸已更新
        setTimeout(() => {
          previewerRef.current?.onWindowResize()
        }, 100)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // 页面卸载时清理资源
  useEffect(() => {
    const handleBeforeUnload = (): void => {
      if (previewerRef.current) {
        previewerRef.current.destroyPlayer()
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      if (previewerRef.current) {
        previewerRef.current.destroyPlayer()
      }
    }
  }, [])

  // 如果还没有完全挂载，显示加载状态
  if (!mounted || !i18nMounted || !themeReady) {
    return (
      <div className="h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">{t("common.loading")}</div>
      </div>
    )
  }

  // 使用 resolvedTheme 来确保获取到正确的主题值
  const currentTheme = resolvedTheme || theme
  const isDark = currentTheme === "dark"

  return (
    <div className={`h-screen ${isDark ? "bg-slate-900" : "bg-slate-50"} flex flex-col overflow-hidden`}>
      <NotificationSystem />

      {/* Header */}
      <header
        className={`${
          isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
        } border-b px-4 py-3 flex justify-between items-center flex-shrink-0`}
      >
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button
                variant="ghost"
                size="sm"
                className={`${
                  isDark
                    ? "text-slate-300 hover:text-white hover:bg-slate-700"
                    : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Home className="w-4 h-4 mr-2" />
                {t("common.home")}
              </Button>
            </Link>
            <h1 className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>{t("editor.title")}</h1>
          </div>

          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".adofai,.json" onChange={handleFileLoad} className="hidden" />
            <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioLoad} className="hidden" />
            <Button
              variant="ghost"
              size="icon"
              className={`${
                isDark
                  ? "text-slate-300 hover:text-white hover:bg-slate-700"
                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              }`}
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              id="butload"
              title={isLoading ? t("common.loading") : t("editor.loadFile")}
            >
              <Upload className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`${
                isDark
                  ? "text-slate-300 hover:text-white hover:bg-slate-700"
                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              }`}
              onClick={() => audioInputRef.current?.click()}
              disabled={!adofaiFile}
              title="Load Music"
            >
              <Music className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`${
                isDark
                  ? "text-slate-300 hover:text-white hover:bg-slate-700"
                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              }`}
              onClick={handleExport}
              disabled={!adofaiFile}
              title={t("editor.export")}
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`${
                isDark
                  ? "text-slate-300 hover:text-white hover:bg-slate-700"
                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title={t("editor.save")}
            >
              <Save className="w-4 h-4" />
            </Button>
            <Link to="/settings">
              <Button
                variant="ghost"
                size="icon"
                className={`${
                  isDark
                    ? "text-slate-300 hover:text-white hover:bg-slate-700"
                    : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                }`}
                title={t("common.settings")}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </header>

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`w-64 ${
            isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
          } border-r p-4 flex-shrink-0 overflow-y-auto`}
        >
            <div className="space-y-4">
              <div>
                <h3 className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"} mb-2`}>
                  {t("editor.levelInfo")}
                </h3>
                <div className={`space-y-1 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  <div>
                    {t("editor.tiles")}:{" "}
                    {adofaiFile?.tiles ? Object.keys(adofaiFile.tiles).length : t("common.loading")}
                  </div>
                  <div>
                    {t("editor.bpm")}: {adofaiFile?.settings?.bpm || "unknown"}
                  </div>
                  <div>
                    {t("editor.offset")}: {adofaiFile?.settings?.offset || 0}ms
                  </div>
                </div>
              </div>

              <div>
                <h3 className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"} mb-2`}>
                  {t("editor.tools")}
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className={`${
                      isDark
                        ? "border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    } bg-transparent`}
                    title={t("editor.select")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className={`${
                      isDark
                        ? "border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    } bg-transparent`}
                    title={t("editor.move")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M19 9l3 3-3 3M15 19l-3 3-3-3M2 12h20M12 2v20"/></svg>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className={`${
                      isDark
                        ? "border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    } bg-transparent`}
                    title={t("editor.addTile")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5v14"/></svg>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className={`${
                      isDark
                        ? "border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    } bg-transparent`}
                    title={t("editor.removeTile")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                  </Button>
                </div>
              </div>
            </div>
          </aside>

        {/* Main Canvas Area */}
        <div ref={containerRef} className="flex-1 relative">
          <div
            ref={fpsCounterRef}
            className="absolute top-4 left-4 text-sm font-medium text-white bg-black bg-opacity-50 px-2 py-1 rounded"
          >
            FPS 0.00
          </div>
          <div
            ref={infoRef}
            className="absolute top-4 right-4 text-sm font-medium text-white bg-black bg-opacity-50 px-2 py-1 rounded"
          >
            {/* Info will be updated dynamically */}
          </div>
          {playModeActive && (
            <Button
              variant="outline"
              size="icon"
              className={`absolute top-4 right-20 ${
                isDark
                  ? "border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              } bg-transparent`}
              title={t("editor.exitPlayMode")}
              onClick={handleExitPlayMode}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className={`absolute bottom-4 left-4 ${
              isDark
                ? "border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                : "border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            } bg-transparent`}
            title={playMode === "play" ? t("editor.pause"): t("editor.play")}
            id="play-button"
            onClick={handlePlay}
          >
            {playMode === "play" ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            )}
          </Button>


        </div>
      </div>
    </div>
  )
}
