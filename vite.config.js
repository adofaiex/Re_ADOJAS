import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import legacy from '@vitejs/plugin-legacy';
import htmlPostBuildPlugin from './no-attr';
var base = './';
export default defineConfig(function (_a) {
    var mode = _a.mode, command = _a.command;
    var isBuild = command == 'build';
    var plugins = [
        react(),
    ];
    plugins.push(legacy({
        targets: ['defaults', 'not IE 11'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    }));
    plugins.push(htmlPostBuildPlugin({ base: base }));
    return {
        plugins: plugins,
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        base: base,
        worker: {
            format: 'es',
            rollupOptions: {
                output: {
                    manualChunks: {
                        'worker-adofai': ['adofai'],
                    },
                },
            },
        },
        build: {
            outDir: "dist",
            assetsDir: "assets",
            sourcemap: false,
            chunkSizeWarningLimit: 1000,
            rollupOptions: {
                output: {
                    manualChunks: function (id) {
                        // React ecosystem
                        if (id.includes('node_modules/react/') ||
                            id.includes('node_modules/react-dom/') ||
                            id.includes('node_modules/scheduler/')) {
                            return 'vendor-react';
                        }
                        // React Router
                        if (id.includes('node_modules/react-router/') ||
                            id.includes('node_modules/react-router-dom/')) {
                            return 'vendor-router';
                        }
                        // Three.js core
                        if (id.includes('node_modules/three/') && !id.includes('examples')) {
                            return 'vendor-three';
                        }
                        // Three.js examples (loaders, controls, etc)
                        if (id.includes('node_modules/three/examples/')) {
                            return 'vendor-three-extras';
                        }
                        // ADOFAI library
                        if (id.includes('node_modules/adofai/')) {
                            return 'vendor-adofai';
                        }
                        // UI libraries (lucide, etc)
                        if (id.includes('node_modules/lucide-react/') ||
                            id.includes('node_modules/@radix-ui/')) {
                            return 'vendor-ui';
                        }
                        // Utility libraries
                        if (id.includes('node_modules/clsx/') ||
                            id.includes('node_modules/tailwind-merge/') ||
                            id.includes('node_modules/class-variance-authority/')) {
                            return 'vendor-utils';
                        }
                    },
                },
            },
        },
        server: {
            port: 5173,
            open: true,
        },
        preview: {
            port: 4173,
        },
    };
});
