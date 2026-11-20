precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform vec4 _ScreenResolution;
uniform float _TimeX;
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
    r0.x = asuint(asfloat(v0.x) + (-0.5));
    r0.y = asuint(asfloat(v0.y) + (-0.5));
    r0.x = asuint(asfloat(r0.x) * 2.2);
    r0.y = asuint(asfloat(r0.y) * 2.2);
    r0.z = asuint(abs(asfloat(r0.y)) * 0.2);
    r0.z = asuint(asfloat(r0.z) * asfloat(r0.z) + 1.0);
    r1.y = asuint(asfloat(r0.z) * asfloat(r0.x));
    r0.x = asuint(abs(asfloat(r1.y)) * 0.25);
    r0.x = asuint(asfloat(r0.x) * asfloat(r0.x) + 1.0);
    r1.z = asuint(asfloat(r0.x) * asfloat(r0.y));
    r1.w = asuint(asfloat(r0.x) * asfloat(r0.y));
    r0.x = asuint(asfloat(r1.y) * 0.5 + 0.5);
    r0.y = asuint(asfloat(r1.z) * 0.5 + 0.5);
    r0.z = asuint(asfloat(r1.w) * 0.5 + 0.5);
    r0.w = asuint(asfloat(r0.x) * 0.92);
    r1.y = asuint(asfloat(r0.z) * 0.92 + 0.041);
    r1.z = asuint(asfloat(r0.x) * 0.92 + 0.04);
    r1.w = asuint(asfloat(r0.y) * 0.92 + 0.04);
    r0.x = asuint(_TimeX * 0.33 + 0.3);
    r0.x = asuint(asfloat(r1.w) * 31.0 + asfloat(r0.x));
    r2.x = asuint(asfloat(r1.w) * 21.0);
    r2.y = asuint(asfloat(r1.w) * 29.0);
    r2.z = asuint(asfloat(r1.z) * 250.0);
    r0.y = asuint(_TimeX * 0.3 + asfloat(r2.x));
    r0.z = asuint(_TimeX * 0.7 + asfloat(r2.y));
    r2.x = asuint(floor(asfloat(r2.z)));
    r0.x = asuint(sin(asfloat(r0.x)));
    r0.y = asuint(sin(asfloat(r0.y)));
    r0.z = asuint(sin(asfloat(r0.z)));
    r0.y = asuint(asfloat(r0.z) * asfloat(r0.y));
    r0.x = asuint(asfloat(r0.x) * asfloat(r0.y));
    r0.y = asuint(asfloat(r0.x) * 0.0017 + 0.025);
    r0.x = asuint(asfloat(r0.x) * 0.0017 + asfloat(r1.z));
    r1.x = asuint(asfloat(r0.x) + 0.001);
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.x), asfloat(r1.y)));
        r3.x = asuint(adouacTex.x);
        r3.y = asuint(adouacTex.y);
        r3.z = asuint(adouacTex.z);
        r3.w = asuint(adouacTex.w);
    }
    r3.x = asuint(asfloat(r3.x) + 0.05);
    r3.y = asuint(asfloat(r3.y) + 0.05);
    r3.z = asuint(asfloat(r3.z) + 0.05);
    r1.x = asuint(asfloat(r0.y) * 0.75 + asfloat(r0.w));
    r0.x = asuint(asfloat(r1.x) + 0.041);
    r0.y = asuint(asfloat(r1.y) + (-0.015));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r0.x), asfloat(r0.y)));
        r0.x = asuint(adouacTex.x);
        r0.y = asuint(adouacTex.y);
        r0.z = asuint(adouacTex.z);
        r0.w = asuint(adouacTex.w);
    }
    r0.x = asuint(asfloat(r0.x) * 0.08 + asfloat(r3.x));
    r0.y = asuint(asfloat(r0.y) * 0.05 + asfloat(r3.y));
    r0.z = asuint(asfloat(r0.z) * 0.08 + asfloat(r3.z));
    r3.x = asuint(asfloat(r0.x) * asfloat(r0.x));
    r3.y = asuint(asfloat(r0.y) * asfloat(r0.y));
    r3.z = asuint(asfloat(r0.z) * asfloat(r0.z));
    r3.x = asuint(asfloat(r3.x) * 0.4);
    r3.y = asuint(asfloat(r3.y) * 0.4);
    r3.z = asuint(asfloat(r3.z) * 0.4);
    r0.x = asuint(saturate(asfloat(r0.x) * 0.6 + asfloat(r3.x)));
    r0.y = asuint(saturate(asfloat(r0.y) * 0.6 + asfloat(r3.y)));
    r0.z = asuint(saturate(asfloat(r0.z) * 0.6 + asfloat(r3.z)));
    r0.w = asuint(asfloat(r1.z) * asfloat(r1.w));
    r0.w = asuint(asfloat(r0.w) * 16.0);
    r1.x = asuint(-asfloat(r1.z) + 1.0);
    r1.y = asuint(-asfloat(r1.w) + 1.0);
    r0.w = asuint(asfloat(r0.w) * asfloat(r1.x));
    r0.w = asuint(asfloat(r1.y) * asfloat(r0.w));
    r0.w = asuint(log2(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 0.3);
    r0.w = asuint(exp2(asfloat(r0.w)));
    r0.x = asuint(asfloat(r0.w) * asfloat(r0.x));
    r0.y = asuint(asfloat(r0.w) * asfloat(r0.y));
    r0.z = asuint(asfloat(r0.w) * asfloat(r0.z));
    r0.w = asuint(asfloat(r1.w) * _ScreenResolution.y);
    r1.x = asuint(_TimeX * 3.5);
    r0.w = asuint(asfloat(r0.w) * 1.5 + asfloat(r1.x));
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 0.35 + 0.35);
    r0.w = asuint(log2(asfloat(r0.w)));
    r0.x = asuint(asfloat(r0.x) * 3.66);
    r0.y = asuint(asfloat(r0.y) * 2.94);
    r0.z = asuint(asfloat(r0.z) * 2.66);
    r0.w = asuint(asfloat(r0.w) * 1.7);
    r0.w = asuint(exp2(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 0.7 + 0.4);
    r0.x = asuint(asfloat(r0.w) * asfloat(r0.x));
    r0.y = asuint(asfloat(r0.w) * asfloat(r0.y));
    r0.z = asuint(asfloat(r0.w) * asfloat(r0.z));
    { float adouacDot = asfloat(r0.x) * 0.222 + asfloat(r0.y) * 0.707 + asfloat(r0.z) * 0.071;
        r0.x = asuint(adouacDot);
    }
    r0.y = asuint(asfloat(r1.w) * 250.0);
    r2.y = asuint(floor(asfloat(r0.y)));
    r0.y = asuint(asfloat(r2.x) * _TimeX);
    r0.z = asuint(asfloat(r2.y) * _TimeX);
    r0.y = asuint(asfloat(r0.y) * 0.001);
    r0.z = asuint(asfloat(r0.z) * 0.001);
    { float adouacDot = asfloat(r0.y) * 12.9898 + asfloat(r0.z) * 78.233;
        r0.y = asuint(adouacDot);
    }
    r0.y = asuint(sin(asfloat(r0.y)));
    r0.y = asuint(asfloat(r0.y) * 43758.547);
    r0.y = asuint(fract(asfloat(r0.y)));
    r0.y = asuint(asfloat(r0.y) + 0.25);
    r0.z = asuint(_TimeX * 2.6);
    r0.w = asuint(_TimeX * 110.0);
    r0.z = asuint(asfloat(r1.w) * 6.0 + asfloat(r0.z));
    r0.z = asuint(sin(asfloat(r0.z)));
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 0.01 + 1.0);
    r0.z = asuint(asfloat(r0.z) + 1.95);
    r0.z = asuint(floor(asfloat(r0.z)));
    r0.y = asuint(min(asfloat(r0.y), 1.0));
    r0.z = asuint(min(asfloat(r0.z), 1.1));
    r0.y = asuint(asfloat(r0.y) * asfloat(r0.z) + asfloat(r0.w));
    r0.x = asuint(asfloat(r0.y) * asfloat(r0.x));
    r0.y = ((asfloat(r1.z) < 0.0) ? 0xffffffffu : 0u);
    r0.z = ((asfloat(r1.w) < 0.0) ? 0xffffffffu : 0u);
    r1.x = ((1.0 < asfloat(r1.z)) ? 0xffffffffu : 0u);
    r1.y = ((1.0 < asfloat(r1.w)) ? 0xffffffffu : 0u);
    r0.y = (r0.y | r1.x);
    r0.z = (r0.z | r1.y);
    r0.y = (r0.z | r0.y);
    o0.x = ((r0.y != 0u) ? 0x00000000u : r0.x);
    o0.y = ((r0.y != 0u) ? 0x00000000u : r0.x);
    o0.z = ((r0.y != 0u) ? 0x00000000u : r0.x);
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
