import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
import legacy from '@vitejs/plugin-legacy'
import glsl from 'vite-plugin-glsl'
import htmlPostBuildPlugin from './no-attr'
import { wasmInlinePlugin } from './vite-plugin-wasm-inline'
import { logWsPlugin } from './vite-plugin-log-ws'

const base = './'


export default defineConfig(({ mode, command }) => {
  const isBuild = command == 'build'
  const plugins = [
    wasmInlinePlugin(),
    glsl(),
    react(),
    logWsPlugin(),
  ]
  if (isBuild) {
    plugins.push(legacy({
      targets: ['defaults', 'not IE 11'],
      modernTargets: 'chrome 100, firefox 100, safari 15',
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    }))
    plugins.push(htmlPostBuildPlugin({ base }) as any)
  }
  return {
    plugins: plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    base: base,
    // Dev 模式下 oxc 默认 esnext（不降级语法），旧浏览器会解析失败白屏。
    // 统一降级到 es2015，依赖预打包同样处理。
    oxc: {
      target: 'es2015',
    },
    optimizeDeps: {
      rolldownOptions: {
        transform: {
          target: 'es2015',
        },
      },
    },
    worker: {
      format: 'es',
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      minify: 'oxc',
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // React ecosystem
            if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
              return 'vendor-react'
            }
            // React Router
            if (id.includes('node_modules/react-router/') ||
              id.includes('node_modules/react-router-dom/')) {
              return 'vendor-router'
            }
            // Three.js core
            if (id.includes('node_modules/three/') && !id.includes('examples')) {
              return 'vendor-three'
            }
            // Three.js examples (loaders, controls, etc)
            if (id.includes('node_modules/three/examples/')) {
              return 'vendor-three-extras'
            }
            // ADOFAI library
            if (id.includes('node_modules/adofai/')) {
              return 'vendor-adofai'
            }
            // UI libraries (lucide, etc)
            if (id.includes('node_modules/lucide-react/') ||
              id.includes('node_modules/@radix-ui/')) {
              return 'vendor-ui'
            }
            // Utility libraries
            if (id.includes('node_modules/clsx/') ||
              id.includes('node_modules/tailwind-merge/') ||
              id.includes('node_modules/class-variance-authority/')) {
              return 'vendor-utils'
            }
            // Other dependencies not matched above (jszip, stats.js, notyf, etc.)
            if (id.includes('node_modules/')) {
              return 'vendor-other'
            }
            // App: Player rendering engine
            if (id.includes('/src/lib/Player/')) {
              return 'app-player'
            }
            // App: geometry/mesh
            if (id.includes('/src/lib/Geo/')) {
              return 'app-geo'
            }
            // App: shaders
            if (id.includes('/src/lib/shaders/')) {
              return 'app-shaders'
            }
            // App: control
            if (id.includes('/src/control/')) {
              return 'app-control'
            }
            // App: Editor page
            if (id.includes('/src/pages/Editor/')) {
              return 'app-editor'
            }
            // App: other pages
            if (id.includes('/src/pages/')) {
              return 'app-pages'
            }
          },
        },
      },
    },
    server: {
      port: 3144,
      host: '0.0.0.0',
    },
    preview: {
      port: 3144,
      host: '0.0.0.0',
    },
  }
})