/**
 * Bloom Post-Processing Effect for Three.js
 * Based on Unity's VideoBloom shader
 * 
 * Bloom workflow:
 * 1. Threshold pass - extract bright areas (no color tinting here)
 * 2. Blur passes - gaussian blur
 * 3. Combine pass - blend bloom with original, apply color tint here
 */

import * as THREE from 'three';

// Shader for brightness extraction (threshold pass)
// Only extracts bright areas, no color modification
const BrightnessShader = {
    uniforms: {
        tDiffuse: { value: null },
        threshold: { value: 0.5 },
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float threshold;
        varying vec2 vUv;
        
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            // Use max of components for thresholding saturated colors better (like pure Red/Blue)
            float brightness = max(max(color.r, color.g), color.b);
            
            if (brightness < threshold) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            } else {
                gl_FragColor = color;
            }
        }
    `
};

// Shader for Gaussian blur
const BlurShader = {
    uniforms: {
        tDiffuse: { value: null },
        direction: { value: new THREE.Vector2(1, 0) },
        resolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 direction;
        uniform vec2 resolution;
        varying vec2 vUv;
        
        void main() {
            vec4 color = vec4(0.0);
            vec2 texelSize = direction / resolution;
            
            // Gaussian blur weights (9-tap)
            float weights[5];
            weights[0] = 0.227027;
            weights[1] = 0.1945946;
            weights[2] = 0.1216216;
            weights[3] = 0.054054;
            weights[4] = 0.016216;
            
            color += texture2D(tDiffuse, vUv) * weights[0];
            
            for (int i = 1; i < 5; i++) {
                vec2 offset = texelSize * float(i);
                color += texture2D(tDiffuse, vUv + offset) * weights[i];
                color += texture2D(tDiffuse, vUv - offset) * weights[i];
            }
            
            gl_FragColor = color;
        }
    `
};

// Shader for combining bloom with original scene
// Color tint is applied here (like Unity's _Param1)
const CombineShader = {
    uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: null },
        intensity: { value: 1.0 },
        bloomColor: { value: new THREE.Color(1, 1, 1) },
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D tBloom;
        uniform float intensity;
        uniform vec3 bloomColor;
        varying vec2 vUv;
        
        void main() {
            vec4 original = texture2D(tDiffuse, vUv);
            vec4 bloom = texture2D(tBloom, vUv);
            
            // Apply bloom color tint (like Unity's _Param1)
            vec3 tintedBloom = bloom.rgb * bloomColor;
            
            // Additive blending with intensity
            vec3 result = original.rgb + tintedBloom * intensity;
            
            // Convert Linear to Output space (sRGB) for screen output
            #include <colorspace_fragment>
            
            // Note: colorspace_fragment usually sets gl_FragColor using outgoingLight
            // But we don't have outgoingLight here. Let's do it manually if chunk not suitable.
            // In Three.js r178, the chunk expects gl_FragColor to be Linear.
            gl_FragColor = vec4(result, 1.0);
            #include <colorspace_fragment>
        }
    `
};

/**
 * Bloom Effect class
 */
export class BloomEffect {
    private enabled: boolean = false;
    private threshold: number = 0.5;
    private intensity: number = 1.0;
    private bloomColor: THREE.Color = new THREE.Color(1, 1, 1);
    
    private resolution: THREE.Vector2;
    
    // Render targets
    private rtBrightness: THREE.WebGLRenderTarget;
    private rtBlurH: THREE.WebGLRenderTarget;
    private rtBlurV: THREE.WebGLRenderTarget;
    
    // Materials
    private brightnessMaterial: THREE.ShaderMaterial;
    private blurMaterial: THREE.ShaderMaterial;
    private combineMaterial: THREE.ShaderMaterial;
    
    // Full-screen quad
    private fsQuad: THREE.Mesh;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    
    constructor() {
        this.resolution = new THREE.Vector2(512, 512);
        
        const width = 256;
        const height = 256;
        
        this.rtBrightness = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
        });
        
        this.rtBlurH = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
        });
        
        this.rtBlurV = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
        });
        
        this.brightnessMaterial = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(BrightnessShader.uniforms),
            vertexShader: BrightnessShader.vertexShader,
            fragmentShader: BrightnessShader.fragmentShader,
        });
        
        this.blurMaterial = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(BlurShader.uniforms),
            vertexShader: BlurShader.vertexShader,
            fragmentShader: BlurShader.fragmentShader,
        });
        
        this.combineMaterial = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(CombineShader.uniforms),
            vertexShader: CombineShader.vertexShader,
            fragmentShader: CombineShader.fragmentShader,
        });
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.fsQuad = new THREE.Mesh(geometry, this.brightnessMaterial);
        this.scene.add(this.fsQuad);
    }
    
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }
    
    getEnabled(): boolean {
        return this.enabled;
    }
    
    setThreshold(threshold: number): void {
        this.threshold = Math.max(0, Math.min(1, threshold));
        this.brightnessMaterial.uniforms.threshold.value = this.threshold;
    }
    
    setIntensity(intensity: number): void {
        this.intensity = intensity;
        this.combineMaterial.uniforms.intensity.value = this.intensity;
    }
    
    setColor(colorHex: string): void {
        // Strip # prefix if present
        let hex = colorHex.startsWith('#') ? colorHex.slice(1) : colorHex;
        
        // Handle 8-character hex (RRGGBBAA) - strip alpha channel
        if (hex.length === 8) {
            hex = hex.slice(0, 6);
        }
        
        // Now create proper hex format for THREE.Color
        const normalizedHex = `#${hex}`;
        this.bloomColor.set(normalizedHex);
        // Apply color in combine shader (like Unity's _Param1)
        this.combineMaterial.uniforms.bloomColor.value.copy(this.bloomColor);
        
        // Debug log
        console.log('BloomEffect.setColor:', colorHex, '-> normalized:', normalizedHex, '-> r:', this.bloomColor.r, 'g:', this.bloomColor.g, 'b:', this.bloomColor.b);
    }
    
    getDebugColor(): { r: number; g: number; b: number } {
        return { r: this.bloomColor.r, g: this.bloomColor.g, b: this.bloomColor.b };
    }
    
    setSize(width: number, height: number): void {
        this.resolution.set(width, height);
        
        // Pass 1 (Brightness) should be high-res to capture thin lines
        this.rtBrightness.setSize(width, height);
        
        // Blur passes can be half-res for performance
        const w = Math.floor(width / 2);
        const h = Math.floor(height / 2);
        
        this.rtBlurH.setSize(w, h);
        this.rtBlurV.setSize(w, h);
        
        this.blurMaterial.uniforms.resolution.value.set(w, h);
    }
    
    render(renderer: THREE.WebGLRenderer, sourceTexture: THREE.Texture, targetRenderTarget: THREE.WebGLRenderTarget | null = null): void {
        if (!this.enabled) {
            return;
        }
        
        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        
        // Pass 1: Extract bright areas (threshold only, no color)
        this.fsQuad.material = this.brightnessMaterial;
        this.brightnessMaterial.uniforms.tDiffuse.value = sourceTexture;
        renderer.setRenderTarget(this.rtBrightness);
        renderer.render(this.scene, this.camera);
        
        // Pass 2: Horizontal blur
        this.fsQuad.material = this.blurMaterial;
        this.blurMaterial.uniforms.tDiffuse.value = this.rtBrightness.texture;
        this.blurMaterial.uniforms.direction.value.set(1, 0);
        renderer.setRenderTarget(this.rtBlurH);
        renderer.render(this.scene, this.camera);
        
        // Pass 3: Vertical blur
        this.blurMaterial.uniforms.tDiffuse.value = this.rtBlurH.texture;
        this.blurMaterial.uniforms.direction.value.set(0, 1);
        renderer.setRenderTarget(this.rtBlurV);
        renderer.render(this.scene, this.camera);
        
        // Pass 4: Combine - apply color tint here
        this.fsQuad.material = this.combineMaterial;
        this.combineMaterial.uniforms.tDiffuse.value = sourceTexture;
        this.combineMaterial.uniforms.tBloom.value = this.rtBlurV.texture;
        renderer.setRenderTarget(targetRenderTarget);
        renderer.render(this.scene, this.camera);
        
        renderer.autoClear = oldAutoClear;
    }
    
    getBloomTexture(): THREE.Texture {
        return this.rtBlurV.texture;
    }
    
    dispose(): void {
        this.rtBrightness.dispose();
        this.rtBlurH.dispose();
        this.rtBlurV.dispose();
        this.brightnessMaterial.dispose();
        this.blurMaterial.dispose();
        this.combineMaterial.dispose();
        this.fsQuad.geometry.dispose();
    }
}

export default BloomEffect;