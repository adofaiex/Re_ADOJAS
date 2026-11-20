precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform float _Distortion;
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
    uvec4 r0 = uvec4(0u), r1 = uvec4(0u), r2 = uvec4(0u), r3 = uvec4(0u), r4 = uvec4(0u), r5 = uvec4(0u), r6 = uvec4(0u);
    uvec4 o0 = uvec4(0u);
    r0.z = 0x447a0000u;
    r1.x = asuint(asfloat(v0.y) * 1.0 + 0.0);
    r1.y = asuint(asfloat(v0.x) * 1.0 + 0.0);
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.y), asfloat(r1.x)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r2.x) + _Distortion);
        adouacD0.y = asuint(asfloat(r2.y) + _Distortion);
        adouacD0.z = asuint(asfloat(r2.z) + _Distortion);
        r2.x = adouacD0.x;
        r2.y = adouacD0.y;
        r2.z = adouacD0.z;
    }
    r3.x = asuint(asfloat(r2.x) * asfloat(r2.x));
    r3.y = asuint(asfloat(r2.y) * asfloat(r2.y));
    r3.z = asuint(asfloat(r2.z) * asfloat(r2.z));
    r4.x = asuint(asfloat(r2.x) * asfloat(r3.x));
    r4.y = asuint(asfloat(r2.y) * asfloat(r3.y));
    r4.z = asuint(asfloat(r2.z) * asfloat(r3.z));
    { float adouacDot = asfloat(r4.x) * asfloat(r4.x) + asfloat(r4.y) * asfloat(r4.y) + asfloat(r4.z) * asfloat(r4.z);
        r0.w = asuint(adouacDot);
    }
    r0.y = asuint(min(asfloat(r0.w), 1000.0));
    r4.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.248747));
    r4.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.027211));
    r4.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-0.017927));
    { float adouacDot = asfloat(r4.x) * asfloat(r4.x) + asfloat(r4.y) * asfloat(r4.y) + asfloat(r4.z) * asfloat(r4.z);
        r0.x = asuint(adouacDot);
    }
    r0.w = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r0.w != 0u) ? r0.x : r0.y);
        adouacD0.z = ((r0.w != 0u) ? r0.y : r0.z);
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r4.x = (r0.w & 0x3f210000u);
    r4.y = (r0.w & 0x3e9a0000u);
    r4.z = (r0.w & 0x3e860000u);
    r5.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.07099));
    r5.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.428501));
    r5.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-0.476837));
    { float adouacDot = asfloat(r5.x) * asfloat(r5.x) + asfloat(r5.y) * asfloat(r5.y) + asfloat(r5.z) * asfloat(r5.z);
        r0.x = asuint(adouacDot);
    }
    r0.w = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r0.w != 0u) ? r0.x : r0.y);
        adouacD0.z = ((r0.w != 0u) ? r0.y : r0.z);
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r5.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.253411));
    r5.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.03925));
    r5.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-0.267752));
    { float adouacDot = asfloat(r5.x) * asfloat(r5.x) + asfloat(r5.y) * asfloat(r5.y) + asfloat(r5.z) * asfloat(r5.z);
        r0.x = asuint(adouacDot);
    }
    r1.z = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r1.z != 0u) ? r0.x : r0.y);
        adouacD0.z = ((r1.z != 0u) ? r0.y : r0.z);
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r5.x = (r4.x & r0.w);
    r5.y = (r4.y & r0.w);
    r5.z = (r4.z & r0.w);
    r4.x = ((r0.w != 0u) ? 0x3ed40011u : r4.x);
    r4.y = ((r0.w != 0u) ? 0x3f40fffcu : r4.y);
    r4.z = ((r0.w != 0u) ? 0x3f480000u : r4.z);
    r5.x = ((r1.z != 0u) ? r4.x : r5.x);
    r5.y = ((r1.z != 0u) ? r4.y : r5.y);
    r5.z = ((r1.z != 0u) ? r4.z : r5.z);
    r4.x = ((r1.z != 0u) ? 0x3f220008u : r4.x);
    r4.y = ((r1.z != 0u) ? 0x3eae0008u : r4.y);
    r4.z = ((r1.z != 0u) ? 0x3f24fffcu : r4.z);
    r6.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.046413));
    r6.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.308616));
    r6.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-0.051104));
    { float adouacDot = asfloat(r6.x) * asfloat(r6.x) + asfloat(r6.y) * asfloat(r6.y) + asfloat(r6.z) * asfloat(r6.z);
        r0.x = asuint(adouacDot);
    }
    r0.w = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r0.w != 0u) ? r0.x : r0.y);
        adouacD0.z = ((r0.w != 0u) ? r0.y : r0.z);
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r5.x = ((r0.w != 0u) ? r4.x : r5.x);
    r5.y = ((r0.w != 0u) ? r4.y : r5.y);
    r5.z = ((r0.w != 0u) ? r4.z : r5.z);
    r4.x = ((r0.w != 0u) ? 0x3eb80000u : r4.x);
    r4.y = ((r0.w != 0u) ? 0x3f2cfffcu : r4.y);
    r4.z = ((r0.w != 0u) ? 0x3ebe0008u : r4.z);
    r6.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.029387));
    r6.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.018742));
    r6.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-0.226284));
    { float adouacDot = asfloat(r6.x) * asfloat(r6.x) + asfloat(r6.y) * asfloat(r6.y) + asfloat(r6.z) * asfloat(r6.z);
        r0.x = asuint(adouacDot);
    }
    r0.w = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r0.w != 0u) ? r0.x : r0.y);
        adouacD0.z = ((r0.w != 0u) ? r0.y : r0.z);
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r5.x = ((r0.w != 0u) ? r4.x : r5.x);
    r5.y = ((r0.w != 0u) ? r4.y : r5.y);
    r5.z = ((r0.w != 0u) ? r4.z : r5.z);
    r4.x = ((r0.w != 0u) ? 0x3e9e0008u : r4.x);
    r4.y = ((r0.w != 0u) ? 0x3e880000u : r4.y);
    r4.z = ((r0.w != 0u) ? 0x3f1c0000u : r4.z);
    r6.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.498618));
    r6.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.584146));
    r6.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-0.153265));
    { float adouacDot = asfloat(r6.x) * asfloat(r6.x) + asfloat(r6.y) * asfloat(r6.y) + asfloat(r6.z) * asfloat(r6.z);
        r0.x = asuint(adouacDot);
    }
    r0.w = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r0.w != 0u) ? r0.x : r0.y);
        adouacD0.z = ((r0.w != 0u) ? r0.y : r0.z);
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r5.x = ((r0.w != 0u) ? r4.x : r5.x);
    r5.y = ((r0.w != 0u) ? r4.y : r5.y);
    r5.z = ((r0.w != 0u) ? r4.z : r5.z);
    r4.x = ((r0.w != 0u) ? 0x3f4b0004u : r4.x);
    r4.y = ((r0.w != 0u) ? 0x3f560008u : r4.y);
    r4.z = ((r0.w != 0u) ? 0x3f08fffcu : r4.z);
    r6.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.258133));
    r6.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.067047));
    r6.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-0.01163));
    { float adouacDot = asfloat(r6.x) * asfloat(r6.x) + asfloat(r6.y) * asfloat(r6.y) + asfloat(r6.z) * asfloat(r6.z);
        r0.x = asuint(adouacDot);
    }
    r0.w = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r0.w != 0u) ? r0.x : r0.y);
        adouacD0.z = ((r0.w != 0u) ? r0.y : r0.z);
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r5.x = ((r0.w != 0u) ? r4.x : r5.x);
    r5.y = ((r0.w != 0u) ? r4.y : r5.y);
    r5.z = ((r0.w != 0u) ? r4.z : r5.z);
    r4.x = ((r0.w != 0u) ? 0x3f230004u : r4.x);
    r4.y = ((r0.w != 0u) ? 0x3ed00000u : r4.y);
    r4.z = ((r0.w != 0u) ? 0x3e680022u : r4.z);
    r6.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.079334));
    r6.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.034081));
    r6.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-7.9e-05));
    { float adouacDot = asfloat(r6.x) * asfloat(r6.x) + asfloat(r6.y) * asfloat(r6.y) + asfloat(r6.z) * asfloat(r6.z);
        r0.x = asuint(adouacDot);
    }
    r0.w = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r0.w != 0u) ? r0.x : r0.y);
        adouacD0.z = ((r0.w != 0u) ? r0.y : r0.z);
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r5.x = ((r0.w != 0u) ? r4.x : r5.x);
    r5.y = ((r0.w != 0u) ? r4.y : r5.y);
    r5.z = ((r0.w != 0u) ? r4.z : r5.z);
    r4.x = ((r0.w != 0u) ? 0x3edc0011u : r4.x);
    r4.y = ((r0.w != 0u) ? 0x3ea60008u : r4.y);
    r4.z = ((r0.w != 0u) ? 0x3d300043u : r4.z);
    r6.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.506023));
    r6.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.122093));
    r6.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-0.097932));
    { float adouacDot = asfloat(r6.x) * asfloat(r6.x) + asfloat(r6.y) * asfloat(r6.y) + asfloat(r6.z) * asfloat(r6.z);
        r0.x = asuint(adouacDot);
    }
    r0.w = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r0.w != 0u) ? r0.x : r0.y);
        adouacD0.z = ((r0.w != 0u) ? r0.y : r0.z);
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r5.x = ((r0.w != 0u) ? r4.x : r5.x);
    r5.y = ((r0.w != 0u) ? r4.y : r5.y);
    r5.z = ((r0.w != 0u) ? r4.z : r5.z);
    r4.x = ((r0.w != 0u) ? 0x3f4c0000u : r4.x);
    r4.y = ((r0.w != 0u) ? 0x3efe0008u : r4.y);
    r4.z = ((r0.w != 0u) ? 0x3eec0011u : r4.z);
    r6.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.057834));
    r6.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.057834));
    r6.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-0.057834));
    { float adouacDot = asfloat(r6.x) * asfloat(r6.x) + asfloat(r6.y) * asfloat(r6.y) + asfloat(r6.z) * asfloat(r6.z);
        r0.x = asuint(adouacDot);
    }
    r0.w = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r0.w != 0u) ? r0.x : r0.y);
        adouacD0.z = ((r0.w != 0u) ? r0.y : r0.z);
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r5.x = ((r0.w != 0u) ? r4.x : r5.x);
    r5.y = ((r0.w != 0u) ? r4.y : r5.y);
    r5.z = ((r0.w != 0u) ? r4.z : r5.z);
    r4.x = ((r0.w != 0u) ? 0x3ec60008u : r4.x);
    r4.y = ((r0.w != 0u) ? 0x3ec60008u : r4.y);
    r4.z = ((r0.w != 0u) ? 0x3ec60008u : r4.z);
    r6.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.160075));
    r6.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.160075));
    r6.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-0.160075));
    { float adouacDot = asfloat(r6.x) * asfloat(r6.x) + asfloat(r6.y) * asfloat(r6.y) + asfloat(r6.z) * asfloat(r6.z);
        r0.x = asuint(adouacDot);
    }
    r0.w = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r0.w != 0u) ? r0.x : r0.y);
        adouacD0.z = ((r0.w != 0u) ? r0.y : r0.z);
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r5.x = ((r0.w != 0u) ? r4.x : r5.x);
    r5.y = ((r0.w != 0u) ? r4.y : r5.y);
    r5.z = ((r0.w != 0u) ? r4.z : r5.z);
    r4.x = ((r0.w != 0u) ? 0x3f0b0004u : r4.x);
    r4.y = ((r0.w != 0u) ? 0x3f0b0004u : r4.y);
    r4.z = ((r0.w != 0u) ? 0x3f0b0004u : r4.z);
    r6.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.22196));
    r6.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.6972));
    r6.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-0.230664));
    { float adouacDot = asfloat(r6.x) * asfloat(r6.x) + asfloat(r6.y) * asfloat(r6.y) + asfloat(r6.z) * asfloat(r6.z);
        r0.x = asuint(adouacDot);
    }
    r0.w = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r0.w != 0u) ? r0.x : r0.y);
        adouacD0.z = ((r0.w != 0u) ? r0.y : r0.z);
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r5.x = ((r0.w != 0u) ? r4.x : r5.x);
    r5.y = ((r0.w != 0u) ? r4.y : r5.y);
    r5.z = ((r0.w != 0u) ? r4.z : r5.z);
    r4.x = ((r0.w != 0u) ? 0x3f1b0004u : r4.x);
    r4.y = ((r0.w != 0u) ? 0x3f630004u : r4.y);
    r4.z = ((r0.w != 0u) ? 0x3f1cfffcu : r4.z);
    r6.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.156645));
    r6.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.122093));
    r6.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-0.513501));
    { float adouacDot = asfloat(r6.x) * asfloat(r6.x) + asfloat(r6.y) * asfloat(r6.y) + asfloat(r6.z) * asfloat(r6.z);
        r0.x = asuint(adouacDot);
    }
    r0.w = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r0.w != 0u) ? r0.x : r0.y);
        adouacD0.z = ((r0.w != 0u) ? r0.y : r0.z);
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r5.x = ((r0.w != 0u) ? r4.x : r5.x);
    r5.y = ((r0.w != 0u) ? r4.y : r5.y);
    r5.z = ((r0.w != 0u) ? r4.z : r5.z);
    r4.x = ((r0.w != 0u) ? 0x3f0a0008u : r4.x);
    r4.y = ((r0.w != 0u) ? 0x3efe0008u : r4.y);
    r4.z = ((r0.w != 0u) ? 0x3f4cfffcu : r4.z);
    r6.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-0.319444));
    r6.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-0.319444));
    r6.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-0.319444));
    r2.x = asuint(asfloat(r2.x) * asfloat(r3.x) + (-1.0));
    r2.y = asuint(asfloat(r2.y) * asfloat(r3.y) + (-1.0));
    r2.z = asuint(asfloat(r2.z) * asfloat(r3.z) + (-1.0));
    { float adouacDot = asfloat(r2.x) * asfloat(r2.x) + asfloat(r2.y) * asfloat(r2.y) + asfloat(r2.z) * asfloat(r2.z);
        r2.x = asuint(adouacDot);
    }
    { float adouacDot = asfloat(r6.x) * asfloat(r6.x) + asfloat(r6.y) * asfloat(r6.y) + asfloat(r6.z) * asfloat(r6.z);
        r0.x = asuint(adouacDot);
    }
    r0.w = ((asfloat(r0.x) < asfloat(r0.y)) ? 0xffffffffu : 0u);
    r2.y = ((r0.w != 0u) ? r0.x : r0.y);
    r2.z = ((r0.w != 0u) ? r0.y : r0.z);
    r0.x = ((r0.w != 0u) ? r4.x : r5.x);
    r0.y = ((r0.w != 0u) ? r4.y : r5.y);
    r0.z = ((r0.w != 0u) ? r4.z : r5.z);
    r3.x = ((r0.w != 0u) ? 0x3f2f0004u : r4.x);
    r3.y = ((r0.w != 0u) ? 0x3f2f0004u : r4.y);
    r3.z = ((r0.w != 0u) ? 0x3f2f0004u : r4.z);
    r0.w = ((asfloat(r2.x) < asfloat(r2.y)) ? 0xffffffffu : 0u);
    r1.z = ((r0.w != 0u) ? r2.x : r2.y);
    r1.w = ((r0.w != 0u) ? r2.y : r2.z);
    r0.x = ((r0.w != 0u) ? r3.x : r0.x);
    r0.y = ((r0.w != 0u) ? r3.y : r0.y);
    r0.z = ((r0.w != 0u) ? r3.z : r0.z);
    r2.x = ((r0.w != 0u) ? 0x3f800000u : r3.x);
    r2.y = ((r0.w != 0u) ? 0x3f800000u : r3.y);
    r2.z = ((r0.w != 0u) ? 0x3f800000u : r3.z);
    { float adouacDot = asfloat(r1.y) * 8.5 + asfloat(r1.x) * 0.05;
        r0.w = asuint(adouacDot);
    }
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 10000.0);
    { float adouacDot = asfloat(r1.x) * 6.5 + asfloat(r1.y) * 0.5;
        r2.w = asuint(adouacDot);
    }
    r1.x = asuint(asfloat(r1.x) + asfloat(r1.y));
    r1.y = asuint(sin(asfloat(r2.w)));
    r1.y = asuint(abs(asfloat(r1.y)) + 0.1);
    r0.w = asuint(asfloat(r0.w) * asfloat(r1.y));
    r0.w = asuint(fract(asfloat(r0.w)));
    r1.y = asuint(asfloat(r1.w) + asfloat(r1.z));
    r1.y = asuint(asfloat(r1.w) / asfloat(r1.y));
    r0.w = asuint(asfloat(r0.w) * 0.75 + asfloat(r1.y));
    r1.y = asuint(asfloat(r1.x) * 0.5);
    r1.y = asuint(floor(asfloat(r1.y)));
    r1.x = asuint(-asfloat(r1.y) * 2.0 + asfloat(r1.x));
    r0.w = ((asfloat(r0.w) < asfloat(r1.x)) ? 0xffffffffu : 0u);
    o0.x = ((r0.w != 0u) ? r0.x : r2.x);
    o0.y = ((r0.w != 0u) ? r0.y : r2.y);
    o0.z = ((r0.w != 0u) ? r0.z : r2.z);
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
