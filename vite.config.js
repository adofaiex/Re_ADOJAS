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
                        adofai: ['adofai', 'hjson'],
                    },
                },
            },
        },
        build: {
            outDir: "dist",
            assetsDir: "assets",
            sourcemap: false,
            rollupOptions: {
                output: {
                    manualChunks: {
                        vendor: ["react", "react-dom"],
                        three: ["three"],
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
