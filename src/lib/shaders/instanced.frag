uniform sampler2D uTileTexture;
uniform float uTexScale;
uniform sampler2D uIconAtlas;
uniform float uIconAtlasCols;
uniform float uIconSize;
uniform float uDisableTexture;

varying vec3 vColor;
varying vec3 vInstanceColor;
varying vec3 vInstanceBgColor;
varying float vOpacity;
varying vec3 vWorldPosition;
varying float vTexSeed;
varying float vFloorIconType;
varying vec2 vIconLocalPos;
varying float vFloorIconAngle;

void main() {
    vec3 finalColor = mix(vInstanceBgColor, vInstanceColor, vColor.r);

    if (vTexSeed > 0.0 && uDisableTexture < 0.5) {
        vec2 uv = vWorldPosition.xy * uTexScale;
        float angle = vTexSeed * 6.2832;
        float c = cos(angle);
        float s = sin(angle);
        uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
        uv += vec2(vTexSeed * 3.7, vTexSeed * 1.3);
        vec4 texColor = texture2D(uTileTexture, uv);
        // Discard fully transparent texture fragments (prevents depth occlusion)
        if (texColor.a < 0.05) discard;
        finalColor *= texColor.rgb;
    }

    // Floor icon overlay — rotate UV by ADOFAI path direction angle
    if (vFloorIconType > 0.5 && uIconSize > 0.0) {
        float iconAngle = -vFloorIconAngle;
        float c = cos(iconAngle);
        float s = sin(iconAngle);
        vec2 rotatedPos = vec2(
            vIconLocalPos.x * c - vIconLocalPos.y * s,
            vIconLocalPos.x * s + vIconLocalPos.y * c
        );
        vec2 iconUv = clamp(rotatedPos / uIconSize + 0.5, 0.0, 1.0);
        iconUv.x = iconUv.x / uIconAtlasCols + (vFloorIconType - 1.0) / uIconAtlasCols;
        vec4 iconColor = texture2D(uIconAtlas, iconUv);
        if (iconColor.a > 0.1) {
            finalColor = mix(finalColor, iconColor.rgb, iconColor.a);
        }
    }

    // Discard near-invisible fragments so they don't occlude tiles behind them
    if (vOpacity < 0.005) discard;

    gl_FragColor = vec4(finalColor, vOpacity);
}
