import * as THREE from 'three';

// Vertex shader for icons
const iconVertexShader = `
// Vertex shader for icons
varying vec2 vUv;
varying float vAlpha;

uniform float uOpacity;
uniform vec2 uRotation; // cos(angle), sin(angle)

void main() {
    vUv = uv;

    // Apply rotation
    vec2 rotatedPos = vec2(
        position.x * uRotation.x - position.y * uRotation.y,
        position.x * uRotation.y + position.y * uRotation.x
    );

    vAlpha = uOpacity;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(rotatedPos, 0.0, 1.0);
}
`;

// Fragment shader for icons
const iconFragmentShader = `
// Fragment shader for icons
varying vec2 vUv;
varying float vAlpha;

uniform sampler2D uTexture;
uniform vec3 uColor;
uniform float uOutline;
uniform float uOutlineWidth;

void main() {
    vec4 texColor = texture2D(uTexture, vUv);

    // Skip transparent pixels
    if (texColor.a < 0.01) discard;

    vec3 finalColor = texColor.rgb;

    // Apply color tint if needed
    if (uColor.r != 0.0 || uColor.g != 0.0 || uColor.b != 0.0) {
        finalColor *= uColor;
    }

    gl_FragColor = vec4(finalColor, texColor.a * vAlpha);
}
`;

// Import all icon JSON files
import swirlBlueJson from '../../icons/data/swirl_blue.json';
import swirlRedJson from '../../icons/data/swirl_red.json';
import swirlOutlineJson from '../../icons/data/swirl_outline.json';

import rabbitDoubleJson from '../../icons/data/tile_rabbit_double_light_new0.json';
import rabbitDoubleOutlineJson from '../../icons/data/tile_rabbit_double_light_new0_outline.json';

import snailDoubleJson from '../../icons/data/tile_snail_double_light_new0.json';
import snailDoubleOutlineJson from '../../icons/data/tile_snail_double_light_new0_outline.json';

import rabbitJson from '../../icons/data/tile_rabbit_light_new0.json';
import rabbitOutlineJson from '../../icons/data/tile_rabbit_light_new0_outline.json';

import snailJson from '../../icons/data/tile_snail_light_new0.json';
import snailOutlineJson from '../../icons/data/tile_snail_light_new0_outline.json';

import portalJson from '../../icons/data/tiles_portal_circle_lit.json';

type IconType = 'rabbit' | 'snail' | 'rabbit_double' | 'snail_double' | 'twirl_red' | 'twirl_blue' | 'portal';

interface IconData {
  main: string; // dataUrl
  outline?: string; // dataUrl
}

class EventIconLoader {
  private iconCache: Map<IconType, IconData> = new Map();
  private textureCache: Map<string, THREE.Texture> = new Map();

  constructor() {
    // Pre-load all icons into cache
    this.iconCache.set('rabbit', {
      main: rabbitJson.dataUrl,
      outline: rabbitOutlineJson.dataUrl
    });
    this.iconCache.set('snail', {
      main: snailJson.dataUrl,
      outline: snailOutlineJson.dataUrl
    });
    this.iconCache.set('rabbit_double', {
      main: rabbitDoubleJson.dataUrl,
      outline: rabbitDoubleOutlineJson.dataUrl
    });
    this.iconCache.set('snail_double', {
      main: snailDoubleJson.dataUrl,
      outline: snailDoubleOutlineJson.dataUrl
    });
    this.iconCache.set('twirl_red', {
      main: swirlRedJson.dataUrl,
      outline: swirlOutlineJson.dataUrl
    });
    this.iconCache.set('twirl_blue', {
      main: swirlBlueJson.dataUrl,
      outline: swirlOutlineJson.dataUrl
    });
    this.iconCache.set('portal', {
      main: portalJson.dataUrl
    });
  }

  /**
   * Get icon data for SetSpeed event
   * @param speedRatio Current speed ratio compared to previous
   * @returns Icon data object
   */
  public getSetSpeedIcon(speedRatio: number): IconType {
    if (speedRatio >= 4) {
      return 'rabbit_double';
    } else if (speedRatio <= 0.25) {
      return 'snail_double';
    } else if (speedRatio > 1) {
      return 'rabbit';
    } else {
      return 'snail';
    }
  }

  /**
   * Get icon data for Twirl event
   * @param angle The tile angle in degrees
   * @returns Icon data object
   */
  public getTwirlIcon(angle: number): IconType {
    return angle < 180 ? 'twirl_red' : 'twirl_blue';
  }

  /**
   * Get texture from data URL (cached)
   */
  private getTextureFromDataUrl(dataUrl: string): THREE.Texture {
    if (this.textureCache.has(dataUrl)) {
      console.log('[EventIconLoader] Using cached texture for:', dataUrl.substring(0, 50));
      return this.textureCache.get(dataUrl)!;
    }

    console.log('[EventIconLoader] Loading new texture for:', dataUrl.substring(0, 50));
    const loader = new THREE.TextureLoader();
    const texture = loader.load(
      dataUrl,
      (loadedTexture) => {
        // On load
        console.log('[EventIconLoader] Texture loaded successfully, size:', loadedTexture.image?.width, 'x', loadedTexture.image?.height);
      },
      undefined,
      (error) => {
        // On error
        console.error('[EventIconLoader] Error loading texture:', error);
      }
    );
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    this.textureCache.set(dataUrl, texture);
    return texture;
  }

  /**
   * Get textures for an icon type
   * @param iconType The type of icon
   * @returns Object with main and outline textures
   */
  public getIconTextures(iconType: IconType): { main?: THREE.Texture; outline?: THREE.Texture } {
    const iconData = this.iconCache.get(iconType);
    if (!iconData) {
      return {};
    }

    const result: { main?: THREE.Texture; outline?: THREE.Texture } = {};

    if (iconData.main) {
      result.main = this.getTextureFromDataUrl(iconData.main);
    }

    if (iconData.outline) {
      result.outline = this.getTextureFromDataUrl(iconData.outline);
    }

    return result;
  }

  /**
   * Create icon mesh using shader
   */
  public createIconMesh(
    texture: THREE.Texture,
    rotation: number = 0,
    transparent: boolean = true,
    opacity: number = 1.0,
    color: THREE.Color = new THREE.Color(1, 1, 1)
  ): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uOpacity: { value: opacity },
        uRotation: { value: new THREE.Vector2(Math.cos(rotation), Math.sin(rotation)) },
        uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
        uOutline: { value: 0.0 },
        uOutlineWidth: { value: 0.0 }
      },
      vertexShader: iconVertexShader,
      fragmentShader: iconFragmentShader,
      transparent: transparent,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    return new THREE.Mesh(geometry, material);
  }

  /**
   * Dispose all cached textures
   */
  public dispose(): void {
    this.textureCache.forEach(texture => {
      texture.dispose();
    });
    this.textureCache.clear();
  }
}

export { EventIconLoader, IconType, IconData };