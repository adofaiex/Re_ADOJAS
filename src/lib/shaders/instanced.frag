uniform sampler2D uTileTexture;
uniform float uTexScale;
uniform sampler2D uIconAtlas;
uniform float uIconAtlasCols;
uniform float uIconSize;
uniform float uDisableTexture;
uniform sampler2D uTrackEdge;
uniform float uEdgeGradient;
uniform float uEdgeTune;
uniform float uEdgeBaseBorder;

varying vec3 vColor;
varying vec3 vInstanceColor;
varying vec3 vInstanceBgColor;
varying float vOpacity;
varying vec3 vWorldPosition;
varying float vTexSeed;
varying float vFloorIconType;
varying vec2 vIconLocalPos;
varying vec2 vTileUv;
varying float vFloorIconAngle;
varying float vIconScale;

void main() {
    // 样式条带：表面色 = 取色基 × 条带(uv.y)，uv.y = 0 砖外缘 → 1 砖内部 ——
    // Neon 白/轨道色描边环 + 黑本体、NeonLight 环 + 半灰本体、Basic 黑环 + 轨道色本体、
    // Minimal 纯轨道色；取色基（fill/border）与参数按样式在 JS 侧配置。
    vec3 finalColor;
    if (uEdgeGradient > 0.5) {
        vec3 base = mix(vInstanceColor, vInstanceBgColor, uEdgeBaseBorder);
        vec3 edge = texture2D(uTrackEdge, vec2(0.5, clamp(vTileUv.y, 0.0, 1.0))).rgb;
        finalColor = base * min(edge * uEdgeTune, vec3(1.0));
    } else {
        finalColor = mix(vInstanceBgColor, vInstanceColor, vColor.r);
    }

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
        vec2 iconUv = clamp(rotatedPos / (uIconSize * max(vIconScale, 0.0001)) + 0.5, 0.0, 1.0);
        iconUv.x = iconUv.x / uIconAtlasCols + (vFloorIconType - 1.0) / uIconAtlasCols;
        vec4 iconColor = texture2D(uIconAtlas, iconUv);
        if (iconColor.a > 0.1) {
            finalColor = mix(finalColor, iconColor.rgb, iconColor.a);
        }
    }

    // Discard near-invisible fragments so they don't occlude tiles behind them
    if (vOpacity < 0.005) discard;

    gl_FragColor = vec4(finalColor, vOpacity);
    // 直绘 canvas（bloom 关闭）时做 linear→sRGB；渲染进 bloom 的线性 RT 时该 chunk 为恒等
    #include <colorspace_fragment>
}
