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
    uvec4 r0 = uvec4(0u), r1 = uvec4(0u), r2 = uvec4(0u);
    uvec4 o0 = uvec4(0u);
    r0.x = asuint(_TimeX * 0.33 + 0.3);
    r0.x = asuint(asfloat(v0.y) * 31.0 + asfloat(r0.x));
    r0.y = asuint(asfloat(v0.y) * 21.0);
    r0.z = asuint(asfloat(v0.y) * 29.0);
    r0.w = asuint(asfloat(v0.x) * 16.0);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = asuint(_TimeX * 0.3 + asfloat(r0.y));
        adouacD0.z = asuint(_TimeX * 0.7 + asfloat(r0.z));
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r0.w = asuint(asfloat(r0.w) * asfloat(v0.y));
    r0.x = asuint(sin(asfloat(r0.x)));
    r0.y = asuint(sin(asfloat(r0.y)));
    r0.z = asuint(sin(asfloat(r0.z)));
    r0.y = asuint(asfloat(r0.z) * asfloat(r0.y));
    r0.x = asuint(asfloat(r0.x) * asfloat(r0.y));
    r0.y = asuint(asfloat(r0.x) * 0.0017 + 0.025);
    r0.x = asuint(asfloat(r0.x) * 0.0017 + asfloat(v0.x));
    r1.z = asuint(asfloat(r0.x) + 0.001);
    r0.x = asuint(asfloat(r0.y) * 0.75);
    r0.y = 0xbc75c28fu;
    r1.x = asuint(asfloat(v0.x) + 0.001);
    r1.y = asuint(asfloat(v0.y) + 0.001);
    r1.w = asuint(asfloat(v0.y) + 0.001);
    r0.x = asuint(asfloat(r0.x) + asfloat(r1.x));
    r0.y = asuint(asfloat(r0.y) + asfloat(r1.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.z), asfloat(r1.w)));
        r1.x = asuint(adouacTex.x);
        r1.y = asuint(adouacTex.y);
        r1.z = asuint(adouacTex.z);
        r1.w = asuint(adouacTex.w);
    }
    r1.x = asuint(asfloat(r1.x) + 0.05);
    r1.y = asuint(asfloat(r1.y) + 0.05);
    r1.z = asuint(asfloat(r1.z) + 0.05);
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r0.x), asfloat(r0.y)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    r0.x = asuint(asfloat(r2.x) * 0.08 + asfloat(r1.x));
    r0.y = asuint(asfloat(r2.y) * 0.05 + asfloat(r1.y));
    r0.z = asuint(asfloat(r2.z) * 0.08 + asfloat(r1.z));
    r1.x = asuint(asfloat(r0.x) * asfloat(r0.x));
    r1.y = asuint(asfloat(r0.y) * asfloat(r0.y));
    r1.z = asuint(asfloat(r0.z) * asfloat(r0.z));
    r1.x = asuint(asfloat(r1.x) * 0.4);
    r1.y = asuint(asfloat(r1.y) * 0.4);
    r1.z = asuint(asfloat(r1.z) * 0.4);
    r0.x = asuint(saturate(asfloat(r0.x) * 0.6 + asfloat(r1.x)));
    r0.y = asuint(saturate(asfloat(r0.y) * 0.6 + asfloat(r1.y)));
    r0.z = asuint(saturate(asfloat(r0.z) * 0.6 + asfloat(r1.z)));
    r1.x = asuint(-asfloat(v0.x) + 1.0);
    r1.y = asuint(-asfloat(v0.y) + 1.0);
    r0.w = asuint(asfloat(r0.w) * asfloat(r1.x));
    r0.w = asuint(asfloat(r1.y) * asfloat(r0.w));
    r0.w = asuint(log2(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 0.3);
    r0.w = asuint(exp2(asfloat(r0.w)));
    r0.x = asuint(asfloat(r0.w) * asfloat(r0.x));
    r0.y = asuint(asfloat(r0.w) * asfloat(r0.y));
    r0.z = asuint(asfloat(r0.w) * asfloat(r0.z));
    r0.w = asuint(_TimeX * 3.5);
    r1.x = asuint(asfloat(v0.y) * _ScreenResolution.y);
    r0.w = asuint(asfloat(r1.x) * 1.5 + asfloat(r0.w));
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
    r1.x = asuint(_TimeX * 2.6);
    r1.y = asuint(_TimeX * 110.0);
    r0.w = asuint(asfloat(v0.y) * 6.0 + asfloat(r1.x));
    r1.x = asuint(sin(asfloat(r1.y)));
    r1.x = asuint(asfloat(r1.x) * 0.01 + 1.0);
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) + 1.95);
    r0.w = asuint(floor(asfloat(r0.w)));
    r0.w = asuint(min(asfloat(r0.w), 1.1));
    r0.w = asuint(asfloat(r0.w) * 0.25 + asfloat(r1.x));
    r0.x = asuint(asfloat(r0.w) * asfloat(r0.x));
    r0.y = asuint(asfloat(r0.w) * asfloat(r0.y));
    r0.z = asuint(asfloat(r0.w) * asfloat(r0.z));
    r1.x = ((asfloat(v0.x) < 0.0) ? 0xffffffffu : 0u);
    r1.y = ((asfloat(v0.y) < 0.0) ? 0xffffffffu : 0u);
    r1.z = ((1.0 < asfloat(v0.x)) ? 0xffffffffu : 0u);
    r1.w = ((1.0 < asfloat(v0.y)) ? 0xffffffffu : 0u);
    r1.x = (r1.z | r1.x);
    r1.y = (r1.w | r1.y);
    r0.w = (r1.y | r1.x);
    o0.x = ((r0.w != 0u) ? 0x00000000u : r0.x);
    o0.y = ((r0.w != 0u) ? 0x00000000u : r0.y);
    o0.z = ((r0.w != 0u) ? 0x00000000u : r0.z);
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
