precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform float _DotSize;
uniform sampler2D _MainTex;
uniform vec4 _Time;
uniform vec4 _ScreenParams;

struct AdouacVaryings {
    vec4 pos;
    vec4 texcoord0;
    vec4 color0;
};
struct v2f {
    vec2 texcoord;
    vec4 vertex;
    vec4 color;
};

uint asuint(float x) { return floatBitsToUint(x); }
uvec2 asuint(vec2 x) { return floatBitsToUint(x); }
uvec3 asuint(vec3 x) { return floatBitsToUint(x); }
uvec4 asuint(vec4 x) { return floatBitsToUint(x); }
uint asuint(int x) { return uint(x); }
uvec2 asuint(ivec2 x) { return uvec2(x); }
uvec3 asuint(ivec3 x) { return uvec3(x); }
uvec4 asuint(ivec4 x) { return uvec4(x); }
float asfloat(uint x) { return uintBitsToFloat(x); }
vec2 asfloat(uvec2 x) { return uintBitsToFloat(x); }
vec3 asfloat(uvec3 x) { return uintBitsToFloat(x); }
vec4 asfloat(uvec4 x) { return uintBitsToFloat(x); }
float asfloat(int x) { return float(x); }
vec2 asfloat(ivec2 x) { return vec2(x); }
vec3 asfloat(ivec3 x) { return vec3(x); }
vec4 asfloat(ivec4 x) { return vec4(x); }
int asint(float x) { return floatBitsToInt(x); }
ivec2 asint(vec2 x) { return floatBitsToInt(x); }
ivec3 asint(vec3 x) { return floatBitsToInt(x); }
ivec4 asint(vec4 x) { return floatBitsToInt(x); }
int asint(uint x) { return int(x); }
ivec2 asint(uvec2 x) { return ivec2(x); }
ivec3 asint(uvec3 x) { return ivec3(x); }
ivec4 asint(uvec4 x) { return ivec4(x); }
float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }
vec4 saturate(vec4 x) { return clamp(x, 0.0, 1.0); }
vec4 AdouacOutputPs(uvec4 o) { return uintBitsToFloat(o); }
vec4 AdouacOutputPs(vec4 o) { return o; }

vec4 frag(AdouacVaryings IN) 
{
    uvec4 v0 = asuint(vec4(IN.texcoord0.x, IN.texcoord0.y, 0.0, 0.0));
    uvec4 v1 = asuint(vec4(IN.pos.x, IN.pos.y, IN.pos.z, IN.pos.w));
    uvec4 v2 = asuint(vec4(IN.color0.x, IN.color0.y, IN.color0.z, IN.color0.w));
    uvec4 r0 = uvec4(0u), r1 = uvec4(0u), r2 = uvec4(0u), r3 = uvec4(0u);
    uvec4 o0 = uvec4(0u);
    r0.x = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r0.y = asuint(asfloat(v0.y) * 1.0 + 0.0);
    r0.z = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r0.w = asuint(asfloat(v0.y) * 1.0 + 0.0);
    r1.x = asuint(asfloat(r0.x) + 0.0);
    r1.y = asuint(asfloat(r0.y) + 0.003906);
    r1.z = asuint(asfloat(r0.z) + 0.003906);
    r1.w = asuint(asfloat(r0.w) + 0.003906);
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.x), asfloat(r1.y)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.z), asfloat(r1.w)));
        r1.x = asuint(adouacTex.x);
        r1.y = asuint(adouacTex.y);
        r1.z = asuint(adouacTex.z);
        r1.w = asuint(adouacTex.w);
    }
    { float adouacDot = asfloat(r1.x) * 0.3 + asfloat(r1.y) * 0.59 + asfloat(r1.z) * 0.11 + asfloat(r1.w) * 0.25;
        r0.x = asuint(adouacDot);
    }
    { float adouacDot = asfloat(r2.x) * 0.3 + asfloat(r2.y) * 0.59 + asfloat(r2.z) * 0.11 + asfloat(r2.w) * 0.25;
        r0.y = asuint(adouacDot);
    }
    r1.x = asuint(asfloat(r0.z) + (-0.003906));
    r1.y = asuint(asfloat(r0.w) + 0.0);
    r1.z = asuint(asfloat(r0.z) + (-0.003906));
    r1.w = asuint(asfloat(r0.w) + 0.003906);
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.z), asfloat(r1.w)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.x), asfloat(r1.y)));
        r1.x = asuint(adouacTex.x);
        r1.y = asuint(adouacTex.y);
        r1.z = asuint(adouacTex.z);
        r1.w = asuint(adouacTex.w);
    }
    { float adouacDot = asfloat(r1.x) * 0.3 + asfloat(r1.y) * 0.59 + asfloat(r1.z) * 0.11 + asfloat(r1.w) * 0.25;
        r1.x = asuint(adouacDot);
    }
    { float adouacDot = asfloat(r2.x) * 0.3 + asfloat(r2.y) * 0.59 + asfloat(r2.z) * 0.11 + asfloat(r2.w) * 0.25;
        r1.y = asuint(adouacDot);
    }
    r0.y = asuint(asfloat(r0.y) * 2.0 + asfloat(r1.y));
    r0.y = asuint(asfloat(r0.x) + asfloat(r0.y));
    r2.x = asuint(asfloat(r0.z) + (-0.003906));
    r2.y = asuint(asfloat(r0.w) + (-0.003906));
    r2.z = asuint(asfloat(r0.z) + 0.003906);
    r2.w = asuint(asfloat(r0.w) + (-0.003906));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r2.x), asfloat(r2.y)));
        r3.x = asuint(adouacTex.x);
        r3.y = asuint(adouacTex.y);
        r3.z = asuint(adouacTex.z);
        r3.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r2.z), asfloat(r2.w)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    { float adouacDot = asfloat(r2.x) * 0.3 + asfloat(r2.y) * 0.59 + asfloat(r2.z) * 0.11 + asfloat(r2.w) * 0.25;
        r1.z = asuint(adouacDot);
    }
    { float adouacDot = asfloat(r3.x) * 0.3 + asfloat(r3.y) * 0.59 + asfloat(r3.z) * 0.11 + asfloat(r3.w) * 0.25;
        r1.w = asuint(adouacDot);
    }
    r0.y = asuint(asfloat(r0.y) + -asfloat(r1.w));
    r0.y = asuint(-asfloat(r1.w) * 2.0 + asfloat(r0.y));
    r0.x = asuint(asfloat(r0.x) + asfloat(r1.z));
    r0.x = asuint(asfloat(r1.x) * 2.0 + asfloat(r0.x));
    r0.x = asuint(-asfloat(r1.w) + asfloat(r0.x));
    r0.y = asuint(-asfloat(r1.z) + asfloat(r0.y));
    r0.x = asuint(-asfloat(r1.x) * 2.0 + asfloat(r0.x));
    r0.x = asuint(-asfloat(r1.y) + asfloat(r0.x));
    r0.y = asuint(asfloat(r0.y) * asfloat(r0.y));
    r0.x = asuint(asfloat(r0.x) * asfloat(r0.x) + asfloat(r0.y));
    r0.x = ((0.04 < asfloat(r0.x)) ? 0xffffffffu : 0u);
    r0.x = (r0.x & 0xbf800000u);
    r1.x = asuint(asfloat(r0.z) * 0.707106);
    r1.y = asuint(asfloat(r0.w) * 0.707106);
    r0.y = asuint(asfloat(r0.z) * 0.707106 + -asfloat(r1.y));
    r1.x = asuint(asfloat(r1.y) + asfloat(r1.x));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r0.z), asfloat(r0.w)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    r0.z = asuint(2136.2812 / _DotSize);
    r0.z = asuint(asfloat(r0.z) * 1.666667);
    r0.y = asuint(asfloat(r0.z) * asfloat(r0.y));
    r0.z = asuint(asfloat(r0.z) * asfloat(r1.x));
    r0.y = asuint(cos(asfloat(r0.y)));
    r0.z = asuint(cos(asfloat(r0.z)));
    r0.z = asuint(asfloat(r0.z) * 0.35 + 0.5);
    r0.y = asuint(asfloat(r0.y) * 0.25 + asfloat(r0.z));
    { float adouacDot = asfloat(r0.x) * asfloat(r0.y) + asfloat(r0.x) * asfloat(r0.y);
        r0.x = asuint(adouacDot);
    }
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = asuint(asfloat(r2.x) * 2.0 + -asfloat(r0.y));
        adouacD0.z = asuint(asfloat(r2.y) * 2.0 + -asfloat(r0.y));
        adouacD0.w = asuint(asfloat(r2.z) * 2.0 + -asfloat(r0.y));
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
        r0.w = adouacD0.w;
    }
    r1.x = asuint(_DotSize * 0.0625 + (-0.2));
    r1.y = asuint(_DotSize * 0.125 + 0.1);
    r1.y = asuint(-asfloat(r1.x) + asfloat(r1.y));
    r1.y = asuint(1.0 / asfloat(r1.y));
    r1.x = asuint(saturate(asfloat(r1.y) * -asfloat(r1.x)));
    r1.y = asuint(asfloat(r1.x) * (-2.0) + 3.0);
    r1.x = asuint(asfloat(r1.x) * asfloat(r1.x));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r1.y) * asfloat(r1.x) + asfloat(r2.x));
        adouacD0.y = asuint(asfloat(r1.y) * asfloat(r1.x) + asfloat(r2.y));
        adouacD0.z = asuint(asfloat(r1.y) * asfloat(r1.x) + asfloat(r2.z));
        r1.x = adouacD0.x;
        r1.y = adouacD0.y;
        r1.z = adouacD0.z;
    }
    r0.y = asuint(asfloat(r0.y) + asfloat(r1.x));
    r0.z = asuint(asfloat(r0.z) + asfloat(r1.y));
    r0.w = asuint(asfloat(r0.w) + asfloat(r1.z));
    r1.w = ((0.4 < asfloat(r1.x)) ? 0xffffffffu : 0u);
    r0.y = ((r1.w != 0u) ? r0.y : r1.x);
    r0.z = ((r1.w != 0u) ? r0.z : r1.y);
    r0.w = ((r1.w != 0u) ? r0.w : r1.z);
    o0.x = asuint(asfloat(r0.x) + asfloat(r0.y));
    o0.y = asuint(asfloat(r0.x) + asfloat(r0.z));
    o0.z = asuint(asfloat(r0.x) + asfloat(r0.w));
    o0.w = 0x3f800000u;
    return AdouacOutputPs(o0);
}

void main() {
    AdouacVaryings IN;
    IN.pos = gl_FragCoord;
    IN.texcoord0 = vec4(vUv, 0.0, 0.0);
    IN.color0 = vec4(1.0);
    fragColor = frag(IN);
}
