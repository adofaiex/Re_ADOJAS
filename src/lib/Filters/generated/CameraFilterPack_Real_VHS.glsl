precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform float Brightness;
uniform float CONTRAST;
uniform float GLITCH;
uniform float JITTER;
uniform float NOISE;
uniform float TRACKING;
uniform sampler2D _MainTex;
uniform sampler2D VHS;
uniform sampler2D VHS2;
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
    uvec4 r0 = uvec4(0u), r1 = uvec4(0u), r2 = uvec4(0u), r3 = uvec4(0u), r4 = uvec4(0u), r5 = uvec4(0u), r6 = uvec4(0u);
    uvec4 o0 = uvec4(0u);
    r0.x = asuint(_Time.x * 12.0);
    r0.y = asuint(_Time.x * 64.0);
    r0.z = asuint(_Time.x * 48.0);
    r0.w = asuint(_Time.x * 20.0);
    { float adouacDot = asfloat(r0.w) * 12.9898 + asfloat(r0.w) * 78.233;
        r0.w = asuint(adouacDot);
    }
    r0.w = asuint(asfloat(r0.w) * 0.318471);
    r1.x = ((asfloat(r0.w) >= -asfloat(r0.w)) ? 0xffffffffu : 0u);
    r0.w = asuint(fract(abs(asfloat(r0.w))));
    r0.w = ((r1.x != 0u) ? r0.w : asuint(-asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 3.14);
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 43758.547);
    r0.w = asuint(fract(asfloat(r0.w)));
    r1.x = asuint(asfloat(r0.w) * 15.0 + 0.06);
    r1.y = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r1.z = asuint(asfloat(v0.y) * 1.0 + 0.0);
    r1.x = asuint(-asfloat(r1.x) + asfloat(r1.z));
    r1.x = asuint(saturate(asfloat(r1.x) * 33.33333));
    r1.w = asuint(asfloat(r1.x) * (-2.0) + 3.0);
    r1.x = asuint(asfloat(r1.x) * asfloat(r1.x));
    r1.x = asuint(asfloat(r1.x) * asfloat(r1.w));
    r0.w = asuint(-asfloat(r0.w) * 15.0 + asfloat(r1.z));
    r0.w = asuint(saturate(asfloat(r0.w) * 33.333336));
    r1.w = asuint(asfloat(r0.w) * (-2.0) + 3.0);
    r0.w = asuint(asfloat(r0.w) * asfloat(r0.w));
    r0.w = asuint(asfloat(r1.w) * asfloat(r0.w) + -asfloat(r1.x));
    r2.x = asuint(asfloat(r1.z) * 512.0 + asfloat(r0.x));
    r2.y = asuint(asfloat(r1.z) * 512.0 + asfloat(r0.y));
    r2.z = asuint(asfloat(r1.z) * 150.0 + asfloat(r0.z));
    r2.x = asuint(sin(asfloat(r2.x)));
    r2.y = asuint(sin(asfloat(r2.y)));
    r2.z = asuint(sin(asfloat(r2.z)));
    r0.x = asuint(asfloat(r1.z) + (-0.05));
    r0.z = asuint(asfloat(r0.x) * asfloat(r2.x) + asfloat(r1.y));
    r1.x = ((asfloat(r1.z) < 0.025) ? 0xffffffffu : 0u);
    r1.w = ((asfloat(r1.z) < 0.015) ? 0xffffffffu : 0u);
    r0.z = ((r1.x != 0u) ? r0.z : r1.y);
    r0.x = asuint(asfloat(r0.x) * asfloat(r2.y) + asfloat(r0.z));
    r0.x = ((r1.w != 0u) ? r0.x : r0.z);
    r0.z = asuint(asfloat(r2.z) * 0.015625);
    r0.x = asuint(asfloat(r0.w) * asfloat(r0.z) + asfloat(r0.x));
    r0.z = asuint(-asfloat(r0.x) + 1.0);
    r2.z = asuint(_Time.x * 0.013);
    r2.w = asuint(_Time.x * 0.4);
    r0.w = asuint(asfloat(r1.z) * 288.0);
    r0.w = asuint(floor(asfloat(r0.w)));
    r2.x = asuint(asfloat(r0.w) * 0.003472);
    r2.y = asuint(asfloat(r0.w) * 0.001458);
    { float adouacDot = asfloat(r2.w) * 12.9898 + asfloat(r2.x) * 78.233;
        r0.w = asuint(adouacDot);
    }
    { float adouacDot = asfloat(r2.z) * 12.9898 + asfloat(r2.y) * 78.233;
        r1.x = asuint(adouacDot);
    }
    r1.x = asuint(asfloat(r1.x) * 0.318471);
    r0.w = asuint(asfloat(r0.w) * 0.318471);
    r1.w = ((asfloat(r0.w) >= -asfloat(r0.w)) ? 0xffffffffu : 0u);
    r0.w = asuint(fract(abs(asfloat(r0.w))));
    r0.w = ((r1.w != 0u) ? r0.w : asuint(-asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 3.14);
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 43758.547);
    r0.w = asuint(fract(asfloat(r0.w)));
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 0.005);
    r1.w = ((asfloat(r1.x) >= -asfloat(r1.x)) ? 0xffffffffu : 0u);
    r1.x = asuint(fract(abs(asfloat(r1.x))));
    r1.x = ((r1.w != 0u) ? r1.x : asuint(-asfloat(r1.x)));
    r1.x = asuint(asfloat(r1.x) * 3.14);
    r1.x = asuint(sin(asfloat(r1.x)));
    r1.x = asuint(asfloat(r1.x) * 43758.547);
    r1.x = asuint(fract(asfloat(r1.x)));
    r0.w = asuint(asfloat(r1.x) * 0.004 + asfloat(r0.w));
    r0.x = asuint(asfloat(r0.w) * asfloat(r0.z) + asfloat(r0.x));
    r2.x = asuint(-asfloat(r1.y));
    r2.y = asuint(-asfloat(r1.z));
    r3.x = asuint(asfloat(r0.x) + asfloat(r2.x));
    r3.y = 0x00000000u;
    r3.z = 0x00000000u;
    r3.w = 0x00000000u;
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(JITTER * asfloat(r3.x) + asfloat(r1.y));
        adouacD0.y = asuint(JITTER * asfloat(r3.y) + asfloat(r1.z));
        adouacD0.z = asuint(JITTER * asfloat(r3.z) + asfloat(r1.z));
        adouacD0.w = asuint(JITTER * asfloat(r3.w) + asfloat(r1.z));
        r3.x = adouacD0.x;
        r3.y = adouacD0.y;
        r3.z = adouacD0.z;
        r3.w = adouacD0.w;
    }
    r4.x = asuint(asfloat(r3.x) * 52.0);
    r4.y = asuint(asfloat(r3.y) * 288.0);
    r4.z = asuint(asfloat(r3.z) * 288.0);
    r4.w = asuint(asfloat(r3.w) * 288.0);
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r3.x), asfloat(r3.w)));
        r3.x = asuint(adouacTex.x);
        r3.y = asuint(adouacTex.y);
        r3.z = asuint(adouacTex.z);
        r3.w = asuint(adouacTex.w);
    }
    r0.x = asuint(max(asfloat(r3.x), 0.08));
    r0.z = asuint(max(asfloat(r3.y), 0.08));
    r0.w = asuint(max(asfloat(r3.z), 0.08));
    r0.x = asuint(min(asfloat(r0.x), 0.95));
    r0.z = asuint(min(asfloat(r0.z), 0.95));
    r0.w = asuint(min(asfloat(r0.w), 0.95));
    { float adouacDot = asfloat(r0.x) * 0.299 + asfloat(r0.z) * 0.587 + asfloat(r0.w) * 0.114;
        r0.x = asuint(adouacDot);
    }
    r3.x = asuint(floor(asfloat(r4.x)));
    r3.y = asuint(floor(asfloat(r4.y)));
    r3.z = asuint(floor(asfloat(r4.z)));
    r3.w = asuint(floor(asfloat(r4.w)));
    r0.y = asuint(asfloat(r3.z) * 0.083333 + asfloat(r0.y));
    r0.y = asuint(sin(asfloat(r0.y)));
    r4.x = asuint(_Time.x * 128.0);
    r4.y = asuint(_Time.x * 16.0);
    r4.z = asuint(_Time.x * 30.0);
    r4.w = asuint(_Time.x * 3.75);
    r0.z = asuint(asfloat(r3.w) * 0.048611 + asfloat(r4.y));
    r1.x = asuint(asfloat(r3.x) * 0.019231);
    r1.w = asuint(asfloat(r3.y) * 0.003472);
    r0.z = asuint(sin(asfloat(r0.z)));
    r0.y = asuint(max(asfloat(r0.y), 0.0));
    r0.z = asuint(max(asfloat(r0.z), 0.0));
    r0.y = asuint(asfloat(r0.z) + asfloat(r0.y));
    r0.y = asuint(asfloat(r0.y) * 0.5 + 0.5);
    r3.y = 0x3c000219u;
    {
        uvec4 adouacD0 = uvec4(0u);
        uvec4 adouacD1 = uvec4(0u);
        adouacD0.x = asuint(sin(asfloat(r4.x)));
        adouacD1.x = asuint(cos(asfloat(r4.x)));
        r4.x = adouacD0.x;
        r5.x = adouacD1.x;
    }
    r3.x = asuint(asfloat(r4.x) * 0.007813);
    r5.y = asuint(asfloat(r3.x) * asfloat(r5.x));
    r5.x = asuint(asfloat(r4.x) * 0.007813 + (-0.01));
    r0.z = asuint(asfloat(r5.x) * asfloat(r3.x) + asfloat(r1.x));
    r0.w = asuint(asfloat(r5.y) * asfloat(r3.y) + asfloat(r1.w));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r0.z), asfloat(r0.w)));
        r3.x = asuint(adouacTex.x);
        r3.y = asuint(adouacTex.y);
        r3.z = asuint(adouacTex.z);
        r3.w = asuint(adouacTex.w);
    }
    r0.z = asuint(asfloat(r3.y) * 0.289);
    r0.z = asuint(asfloat(r3.x) * (-0.147) + -asfloat(r0.z));
    r5.y = asuint(asfloat(r3.z) * 0.436 + asfloat(r0.z));
    r5.w = asuint(asfloat(r3.z) * 0.436 + asfloat(r0.z));
    r0.z = asuint(asfloat(r3.y) * 0.515);
    r0.z = asuint(asfloat(r3.x) * 0.615 + -asfloat(r0.z));
    r5.x = asuint(-asfloat(r3.z) * 0.1 + asfloat(r0.z));
    r5.z = asuint(-asfloat(r3.z) * 0.1 + asfloat(r0.z));
    r0.z = asuint(CONTRAST + 1.0);
    r3.x = asuint(asfloat(r5.x) / asfloat(r0.z));
    r3.y = asuint(asfloat(r5.y) / asfloat(r0.z));
    r3.z = asuint(asfloat(r5.z) / asfloat(r0.z));
    r3.w = asuint(asfloat(r5.w) / asfloat(r0.z));
    r3.x = asuint(asfloat(r0.y) * asfloat(r3.x));
    r3.y = asuint(asfloat(r0.y) * asfloat(r3.y));
    r3.z = asuint(asfloat(r0.y) * asfloat(r3.z));
    r3.w = asuint(asfloat(r0.y) * asfloat(r3.w));
    r0.y = asuint(-asfloat(r3.y) * 0.395 + asfloat(r0.x));
    r5.x = asuint(asfloat(r3.x) * 1.14 + asfloat(r0.x));
    r5.z = asuint(asfloat(r3.w) * 2.032 + asfloat(r0.x));
    r5.y = asuint(-asfloat(r3.z) * 0.581 + asfloat(r0.y));
    r0.x = asuint(max(asfloat(r5.x), 0.08));
    r0.y = asuint(max(asfloat(r5.y), 0.08));
    r0.z = asuint(max(asfloat(r5.z), 0.08));
    r0.x = asuint(min(asfloat(r0.x), 0.95));
    r0.y = asuint(min(asfloat(r0.y), 0.95));
    r0.z = asuint(min(asfloat(r0.z), 0.95));
    r3.x = asuint(-asfloat(r0.x) * 1.05 + 1.0);
    r3.y = asuint(-asfloat(r0.y) * 1.05 + 1.0);
    r3.z = asuint(-asfloat(r0.z) * 1.05 + 1.0);
    r3.x = asuint(asfloat(r3.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r3.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r3.z) + asfloat(r3.z));
    r1.x = ((asfloat(r4.z) >= -asfloat(r4.z)) ? 0xffffffffu : 0u);
    r1.w = ((asfloat(r4.w) >= -asfloat(r4.w)) ? 0xffffffffu : 0u);
    r4.x = asuint(fract(abs(asfloat(r4.z))));
    r4.y = asuint(fract(abs(asfloat(r4.w))));
    r1.x = ((r1.x != 0u) ? r4.x : asuint(-asfloat(r4.x)));
    r1.w = ((r1.w != 0u) ? r4.y : asuint(-asfloat(r4.y)));
    r1.x = asuint(asfloat(r1.x) * 8.0);
    r1.w = asuint(asfloat(r1.w) * 8.0);
    r1.x = asuint(floor(asfloat(r1.x)));
    r1.w = asuint(floor(asfloat(r1.w)));
    r0.w = asuint(asfloat(r1.x) * 0.125);
    r1.x = asuint(-asfloat(r1.w) * 0.125 + 1.0);
    r4.x = asuint(asfloat(r1.y) * 0.125 + asfloat(r0.w));
    r4.y = asuint(asfloat(r1.z) * 0.125 + asfloat(r1.x));
    r4.z = asuint(asfloat(r1.z) * (-1.125) + asfloat(r1.x));
    { vec4 adouacTex = texture(VHS, vec2(asfloat(r4.x), asfloat(r4.y)));
        r5.x = asuint(adouacTex.x);
        r5.y = asuint(adouacTex.y);
        r5.z = asuint(adouacTex.z);
        r5.w = asuint(adouacTex.w);
    }
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r5.x) + Brightness);
        adouacD0.y = asuint(asfloat(r5.y) + Brightness);
        adouacD0.z = asuint(asfloat(r5.z) + Brightness);
        r5.x = adouacD0.x;
        r5.y = adouacD0.y;
        r5.z = adouacD0.z;
    }
    r5.x = asuint(asfloat(r5.x) + (-0.5));
    r5.y = asuint(asfloat(r5.y) + (-0.5));
    r5.z = asuint(asfloat(r5.z) + (-0.5));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(NOISE * asfloat(r5.x) + 0.5);
        adouacD0.y = asuint(NOISE * asfloat(r5.y) + 0.5);
        adouacD0.z = asuint(NOISE * asfloat(r5.z) + 0.5);
        r5.x = adouacD0.x;
        r5.y = adouacD0.y;
        r5.z = adouacD0.z;
    }
    r6.x = asuint(-asfloat(r5.x) + 1.0);
    r6.y = asuint(-asfloat(r5.y) + 1.0);
    r6.z = asuint(-asfloat(r5.z) + 1.0);
    r5.x = asuint(asfloat(r0.x) * asfloat(r5.x));
    r5.y = asuint(asfloat(r0.y) * asfloat(r5.y));
    r5.z = asuint(asfloat(r0.z) * asfloat(r5.z));
    r0.x = ((asfloat(r0.x) < 0.476191) ? 0xffffffffu : 0u);
    r0.y = ((asfloat(r0.y) < 0.476191) ? 0xffffffffu : 0u);
    r0.z = ((asfloat(r0.z) < 0.476191) ? 0xffffffffu : 0u);
    r5.x = asuint(asfloat(r5.x) * 2.1);
    r5.y = asuint(asfloat(r5.y) * 2.1);
    r5.z = asuint(asfloat(r5.z) * 2.1);
    r3.x = asuint(-asfloat(r3.x) * asfloat(r6.x) + 1.0);
    r3.y = asuint(-asfloat(r3.y) * asfloat(r6.y) + 1.0);
    r3.z = asuint(-asfloat(r3.z) * asfloat(r6.z) + 1.0);
    r0.x = ((r0.x != 0u) ? r5.x : r3.x);
    r0.y = ((r0.y != 0u) ? r5.y : r3.y);
    r0.z = ((r0.z != 0u) ? r5.z : r3.z);
    r2.z = 0x3f800000u;
    r1.x = asuint(asfloat(r2.x) + asfloat(r4.x));
    r1.w = asuint(asfloat(r2.z) + asfloat(r4.z));
    r0.w = asuint(asfloat(r2.y) + 1.0);
    r0.w = asuint(asfloat(r0.w) * TRACKING);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(GLITCH * asfloat(r1.x) + asfloat(r1.y));
        adouacD0.y = asuint(GLITCH * asfloat(r1.w) + asfloat(r1.z));
        r1.x = adouacD0.x;
        r1.y = adouacD0.y;
    }
    { vec4 adouacTex = texture(VHS2, vec2(asfloat(r1.x), asfloat(r1.y)));
        r1.x = asuint(adouacTex.x);
        r1.y = asuint(adouacTex.y);
        r1.z = asuint(adouacTex.z);
        r1.w = asuint(adouacTex.w);
    }
    o0.x = asuint(asfloat(r0.w) * asfloat(r1.x) + asfloat(r0.x));
    o0.y = asuint(asfloat(r0.w) * asfloat(r1.y) + asfloat(r0.y));
    o0.z = asuint(asfloat(r0.w) * asfloat(r1.z) + asfloat(r0.z));
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
