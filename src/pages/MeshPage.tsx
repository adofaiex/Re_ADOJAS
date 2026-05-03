"use client"
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import createTrackMesh from '@/lib/Geo/mesh_reserve'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

const Z_OFFSET = 0.001

function hexToRgb(hex: string) {
  const c = new THREE.Color(hex)
  return { r: c.r, g: c.g, b: c.b }
}

function recolorVertices(colors: number[], userColor: { r: number; g: number; b: number }, outlineDim = 0.20) {
  const out: number[] = []
  for (let i = 0; i < colors.length; i += 3) {
    const lum = 0.2126 * colors[i] + 0.7152 * colors[i + 1] + 0.0722 * colors[i + 2]
    if (lum < 0.5) {
      out.push(userColor.r * outlineDim, userColor.g * outlineDim, userColor.b * outlineDim)
    } else {
      out.push(userColor.r, userColor.g, userColor.b)
    }
  }
  return out
}

function applyOutlineZ(vertices: number[], colors: number[], offset: number) {
  const out = [...vertices]
  for (let i = 0; i < colors.length; i += 3) {
    const lum = 0.2126 * colors[i] + 0.7152 * colors[i + 1] + 0.0722 * colors[i + 2]
    if (lum < 0.5) {
      out[(i / 3) * 3 + 2] += offset
    }
  }
  return out
}

export default function MeshPage() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    controls: OrbitControls
    mesh: THREE.Mesh | null
  } | null>(null)
  const animRef = useRef(0)

  const [color, setColor] = useState('#4a7dff')
  const [opacity, setOpacity] = useState(0.85)
  const [length, setLength] = useState(0.5)
  const [width, setWidth] = useState(0.275)
  const [startAngle, setStartAngle] = useState(0)
  const [endAngle, setEndAngle] = useState(60)
  const [style, setStyle] = useState('Standard')
  const [midspin, setMidspin] = useState(false)

  // Initialize scene once
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const w = container.clientWidth
    const h = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f0f13)

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.01, 10)
    camera.position.set(1.2, 0.9, 1.8)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.sortObjects = true
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 0.3
    controls.maxDistance = 4.5
    controls.target.set(0, 0, 0)
    controls.update()

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(2, 3, 4)
    scene.add(dirLight)
    const backLight = new THREE.DirectionalLight(0x8888ff, 0.4)
    backLight.position.set(-2, -1, -3)
    scene.add(backLight)

    const gridHelper = new THREE.GridHelper(2.0, 16, 0x7a7aff55, 0x7a7aff22)
    gridHelper.position.z = -0.01
    scene.add(gridHelper)

    const state = { scene, camera, renderer, controls, mesh: null as THREE.Mesh | null }
    sceneRef.current = state

    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)

    const onResize = () => {
      const s = sceneRef.current
      if (!s || !container) return
      const cw = container.clientWidth
      const ch = container.clientHeight
      s.camera.aspect = cw / ch
      s.camera.updateProjectionMatrix()
      s.renderer.setSize(cw, ch)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(container)

    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Update mesh when parameters change
  useEffect(() => {
    const state = sceneRef.current
    if (!state) return

    const data = createTrackMesh(startAngle, endAngle, midspin, length, width, 0.025, style)

    const userColor = hexToRgb(color)
    const newColors = recolorVertices(data.colors, userColor, 0.20)
    const zVertices = applyOutlineZ(data.vertices, newColors, Z_OFFSET)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(zVertices), 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(newColors), 3))
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(data.faces), 1))
    geometry.computeVertexNormals()

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity,
      roughness: 0.35,
      metalness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: true,
    })

    const mesh = new THREE.Mesh(geometry, material)

    if (state.mesh) {
      state.scene.remove(state.mesh)
      state.mesh.geometry.dispose()
      if (Array.isArray(state.mesh.material)) {
        state.mesh.material.forEach(m => m.dispose())
      } else {
        state.mesh.material.dispose()
      }
    }
    state.scene.add(mesh)
    state.mesh = mesh

    return () => {
      if (state.mesh) {
        state.scene.remove(state.mesh)
        state.mesh.geometry.dispose()
        if (Array.isArray(state.mesh.material)) {
          state.mesh.material.forEach(m => m.dispose())
        } else {
          state.mesh.material.dispose()
        }
        state.mesh = null
      }
    }
  }, [startAngle, endAngle, midspin, length, width, style, color, opacity])

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-purple-50 to-slate-50 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Mesh 测试</h1>
        </div>

        <div
          ref={containerRef}
          className="w-full aspect-[16/9] min-h-[320px] rounded-xl overflow-hidden bg-[#0f0f13] border border-slate-700/50 mb-4"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4 rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">颜色</label>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-full h-8 rounded cursor-pointer bg-transparent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between">
              不透明度 <span className="text-slate-700 dark:text-slate-300 tabular-nums">{opacity.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0.05} max={1} step={0.01}
              value={opacity}
              onChange={e => setOpacity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between">
              长度 <span className="text-slate-700 dark:text-slate-300 tabular-nums">{length.toFixed(3)}</span>
            </label>
            <input
              type="range"
              min={0.08} max={0.9} step={0.005}
              value={length}
              onChange={e => setLength(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between">
              宽度 <span className="text-slate-700 dark:text-slate-300 tabular-nums">{width.toFixed(3)}</span>
            </label>
            <input
              type="range"
              min={0.08} max={0.5} step={0.005}
              value={width}
              onChange={e => setWidth(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between">
              起始角度 <span className="text-slate-700 dark:text-slate-300">{startAngle}°</span>
            </label>
            <input
              type="range"
              min={0} max={360} step={1}
              value={startAngle}
              onChange={e => setStartAngle(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex justify-between">
              结束角度 <span className="text-slate-700 dark:text-slate-300">{endAngle}°</span>
            </label>
            <input
              type="range"
              min={0} max={360} step={1}
              value={endAngle}
              onChange={e => setEndAngle(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">风格</label>
            <select
              value={style}
              onChange={e => setStyle(e.target.value)}
              className="w-full p-1.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm border border-slate-300 dark:border-slate-600"
            >
              <option value="Standard">Standard</option>
              <option value="Minimal">Minimal</option>
              <option value="Gems">Gems</option>
            </select>
          </div>

          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={midspin}
                onChange={e => setMidspin(e.target.checked)}
                className="w-4 h-4 accent-indigo-500"
              />
              Midspin
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
