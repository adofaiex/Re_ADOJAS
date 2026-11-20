precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 _MainTex_TexelSize;
uniform float _TimeX;
uniform float _Value;
uniform float _Value2;
uniform float _Value3;
uniform float _Value4;
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
    uvec4 r0 = uvec4(0u), r1 = uvec4(0u), r2 = uvec4(0u), r3 = uvec4(0u), r4 = uvec4(0u);
    uvec4 o0 = uvec4(0u);
    r0.x = asuint(_TimeX * 0.02);
    r0.y = asuint(_TimeX * 0.501);
    r0.z = asuint(_TimeX * 0.05);
    r0.w = asuint(_TimeX * 0.5);
    r1.y = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r1.z = asuint(asfloat(v0.y) * 1.0 + 0.0);
    r2.x = ((_MainTex_TexelSize.y < 0.0) ? 0xffffffffu : 0u);
    r2.y = asuint(-asfloat(r1.z) + 1.0);
    r1.w = ((r2.x != 0u) ? r2.y : r1.z);
    r2.x = asuint(asfloat(r1.y) + asfloat(r1.y));
    r2.y = asuint(asfloat(r1.w) + asfloat(r1.w));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.y), asfloat(r1.z)));
        r3.x = asuint(adouacTex.x);
        r3.y = asuint(adouacTex.y);
        r3.z = asuint(adouacTex.z);
        r3.w = asuint(adouacTex.w);
    }
    r1.y = asuint(asfloat(r2.y) * _Value3);
    r1.x = asuint(asfloat(r1.y) * 1.6 + asfloat(r2.x));
    r2.x = asuint(asfloat(r1.x) * 1.01 + asfloat(r0.x));
    r2.y = asuint(asfloat(r1.w) * 2.02 + asfloat(r0.y));
    r2.z = asuint(asfloat(r1.x) * 1.07 + asfloat(r0.x));
    r2.w = asuint(asfloat(r1.w) * 2.14 + asfloat(r0.y));
    r0.x = asuint(asfloat(r1.x) * 1.0 + asfloat(r0.z));
    r0.y = asuint(asfloat(r1.w) * 2.0 + asfloat(r0.w));
    r4.x = asuint(floor(asfloat(r2.x)));
    r4.y = asuint(floor(asfloat(r2.y)));
    r4.z = asuint(floor(asfloat(r2.z)));
    r4.w = asuint(floor(asfloat(r2.w)));
    r2.x = asuint(asfloat(r2.x) + -asfloat(r4.x));
    r2.y = asuint(asfloat(r2.y) + -asfloat(r4.y));
    r2.z = asuint(asfloat(r2.z) + -asfloat(r4.z));
    r2.w = asuint(asfloat(r2.w) + -asfloat(r4.w));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r2.x) * _Value2);
        adouacD0.y = asuint(asfloat(r2.y) * _Value2);
        adouacD0.z = asuint(asfloat(r2.z) * _Value2);
        adouacD0.w = asuint(asfloat(r2.w) * _Value2);
        r2.x = adouacD0.x;
        r2.y = adouacD0.y;
        r2.z = adouacD0.z;
        r2.w = adouacD0.w;
    }
    r2.x = asuint(floor(asfloat(r2.x)));
    r2.y = asuint(floor(asfloat(r2.y)));
    r2.z = asuint(floor(asfloat(r2.z)));
    r2.w = asuint(floor(asfloat(r2.w)));
    { float adouacDot = asfloat(r2.x) * 12.9898 + asfloat(r2.y) * 78.233;
        r0.z = asuint(adouacDot);
    }
    { float adouacDot = asfloat(r2.z) * 12.9898 + asfloat(r2.w) * 78.233;
        r0.w = asuint(adouacDot);
    }
    r0.z = asuint(sin(asfloat(r0.z)));
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.z = asuint(asfloat(r0.z) * 13758.545);
    r0.w = asuint(asfloat(r0.w) * 13758.545);
    r0.z = asuint(fract(asfloat(r0.z)));
    r0.w = asuint(fract(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * _Value + (-0.9));
    r0.z = asuint(asfloat(r0.z) * _Value + (-0.9));
    r0.z = asuint(saturate(asfloat(r0.z) * 9.999998));
    r0.w = asuint(saturate(asfloat(r0.w) * 9.999998));
    r1.y = asuint(asfloat(r0.z) * (-2.0) + 3.0);
    r0.z = asuint(asfloat(r0.z) * asfloat(r0.z));
    r0.z = asuint(asfloat(r0.z) * asfloat(r1.y));
    r2.x = asuint(-asfloat(r3.x) + 1.0);
    r2.y = asuint(-asfloat(r3.y) + 1.0);
    r2.z = asuint(-asfloat(r3.z) + 1.0);
    r2.x = asuint(asfloat(r0.z) * asfloat(r2.x) + asfloat(r3.x));
    r2.y = asuint(asfloat(r0.z) * asfloat(r2.y) + asfloat(r3.y));
    r2.z = asuint(asfloat(r0.z) * asfloat(r2.z) + asfloat(r3.z));
    r4.x = asuint(-asfloat(r2.x) + 0.1);
    r4.y = asuint(-asfloat(r2.y) + 1.0);
    r4.z = asuint(-asfloat(r2.z) + 1.0);
    r0.z = asuint(asfloat(r0.w) * (-2.0) + 3.0);
    r0.w = asuint(asfloat(r0.w) * asfloat(r0.w));
    r0.z = asuint(asfloat(r0.w) * asfloat(r0.z));
    r2.x = asuint(asfloat(r0.z) * asfloat(r4.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r0.z) * asfloat(r4.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r0.z) * asfloat(r4.z) + asfloat(r2.z));
    r4.x = asuint(-asfloat(r2.x) + 1.0);
    r4.y = asuint(-asfloat(r2.y) + 1.0);
    r4.z = asuint(-asfloat(r2.z) + 1.0);
    r0.z = asuint(floor(asfloat(r0.x)));
    r0.w = asuint(floor(asfloat(r0.y)));
    r0.x = asuint(-asfloat(r0.z) + asfloat(r0.x));
    r0.y = asuint(-asfloat(r0.w) + asfloat(r0.y));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r0.x) * _Value2);
        adouacD0.y = asuint(asfloat(r0.y) * _Value2);
        r0.x = adouacD0.x;
        r0.y = adouacD0.y;
    }
    r0.x = asuint(floor(asfloat(r0.x)));
    r0.y = asuint(floor(asfloat(r0.y)));
    { float adouacDot = asfloat(r0.x) * 12.9898 + asfloat(r0.y) * 78.233;
        r0.x = asuint(adouacDot);
    }
    r0.x = asuint(sin(asfloat(r0.x)));
    r0.x = asuint(asfloat(r0.x) * 13758.545);
    r0.x = asuint(fract(asfloat(r0.x)));
    r0.x = asuint(asfloat(r0.x) * _Value + (-0.9));
    r0.x = asuint(saturate(asfloat(r0.x) * 9.999998));
    r0.y = asuint(asfloat(r0.x) * (-2.0) + 3.0);
    r0.x = asuint(asfloat(r0.x) * asfloat(r0.x));
    r0.x = asuint(asfloat(r0.x) * asfloat(r0.y));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r0.x) * asfloat(r4.x) + asfloat(r2.x));
        adouacD0.y = asuint(asfloat(r0.x) * asfloat(r4.y) + asfloat(r2.y));
        adouacD0.z = asuint(asfloat(r0.x) * asfloat(r4.z) + asfloat(r2.z));
        r0.x = adouacD0.x;
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    r2.x = asuint(-asfloat(r0.x) + 1.0);
    r2.y = asuint(-asfloat(r0.y) + 1.0);
    r2.z = asuint(-asfloat(r0.z) + 1.0);
    r4.x = asuint(_TimeX * 0.02);
    r4.y = asuint(_TimeX * 0.51);
    r4.z = asuint(_TimeX * 0.07);
    r4.w = asuint(_TimeX * 0.493);
    r1.y = asuint(asfloat(r1.x) * 0.9 + asfloat(r4.x));
    r1.z = asuint(asfloat(r1.w) * 1.8 + asfloat(r4.y));
    r4.x = asuint(asfloat(r1.x) * 0.75 + asfloat(r4.z));
    r4.y = asuint(asfloat(r1.w) * 1.5 + asfloat(r4.w));
    r4.z = asuint(floor(asfloat(r1.y)));
    r4.w = asuint(floor(asfloat(r1.z)));
    r1.y = asuint(asfloat(r1.y) + -asfloat(r4.z));
    r1.z = asuint(asfloat(r1.z) + -asfloat(r4.w));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = asuint(asfloat(r1.y) * _Value2);
        adouacD0.z = asuint(asfloat(r1.z) * _Value2);
        r1.y = adouacD0.y;
        r1.z = adouacD0.z;
    }
    r1.y = asuint(floor(asfloat(r1.y)));
    r1.z = asuint(floor(asfloat(r1.z)));
    { float adouacDot = asfloat(r1.y) * 12.9898 + asfloat(r1.z) * 78.233;
        r0.w = asuint(adouacDot);
    }
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 13758.545);
    r0.w = asuint(fract(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * _Value + (-0.9));
    r0.w = asuint(saturate(asfloat(r0.w) * 9.999998));
    r1.y = asuint(asfloat(r0.w) * (-2.0) + 3.0);
    r0.w = asuint(asfloat(r0.w) * asfloat(r0.w));
    r0.w = asuint(asfloat(r0.w) * asfloat(r1.y));
    r0.x = asuint(asfloat(r0.w) * asfloat(r2.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r0.w) * asfloat(r2.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r0.w) * asfloat(r2.z) + asfloat(r0.z));
    r2.x = asuint(-asfloat(r0.x) + 1.0);
    r2.y = asuint(-asfloat(r0.y) + 1.0);
    r2.z = asuint(-asfloat(r0.z) + 1.0);
    r1.y = asuint(floor(asfloat(r4.x)));
    r1.z = asuint(floor(asfloat(r4.y)));
    r1.y = asuint(-asfloat(r1.y) + asfloat(r4.x));
    r1.z = asuint(-asfloat(r1.z) + asfloat(r4.y));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = asuint(asfloat(r1.y) * _Value2);
        adouacD0.z = asuint(asfloat(r1.z) * _Value2);
        r1.y = adouacD0.y;
        r1.z = adouacD0.z;
    }
    r1.y = asuint(floor(asfloat(r1.y)));
    r1.z = asuint(floor(asfloat(r1.z)));
    { float adouacDot = asfloat(r1.y) * 12.9898 + asfloat(r1.z) * 78.233;
        r0.w = asuint(adouacDot);
    }
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 13758.545);
    r0.w = asuint(fract(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * _Value + (-0.9));
    r0.w = asuint(saturate(asfloat(r0.w) * 9.999998));
    r1.y = asuint(asfloat(r0.w) * (-2.0) + 3.0);
    r0.w = asuint(asfloat(r0.w) * asfloat(r0.w));
    r0.w = asuint(asfloat(r0.w) * asfloat(r1.y));
    r0.x = asuint(asfloat(r0.w) * asfloat(r2.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r0.w) * asfloat(r2.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r0.w) * asfloat(r2.z) + asfloat(r0.z));
    r2.x = asuint(-asfloat(r0.x) + 1.0);
    r2.y = asuint(-asfloat(r0.y) + 1.0);
    r2.z = asuint(-asfloat(r0.z) + 1.0);
    r4.x = asuint(_TimeX * 0.03);
    r4.y = asuint(_TimeX * 0.504);
    r4.z = asuint(_TimeX * 0.02);
    r4.w = asuint(_TimeX * 0.497);
    r1.y = asuint(asfloat(r1.x) * 0.5 + asfloat(r4.x));
    r1.z = asuint(asfloat(r1.w) * 1.0 + asfloat(r4.y));
    r4.x = asuint(asfloat(r1.x) * 0.3 + asfloat(r4.z));
    r4.y = asuint(asfloat(r1.w) * 0.6 + asfloat(r4.w));
    r4.z = asuint(floor(asfloat(r1.y)));
    r4.w = asuint(floor(asfloat(r1.z)));
    r1.y = asuint(asfloat(r1.y) + -asfloat(r4.z));
    r1.z = asuint(asfloat(r1.z) + -asfloat(r4.w));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = asuint(asfloat(r1.y) * _Value2);
        adouacD0.z = asuint(asfloat(r1.z) * _Value2);
        r1.y = adouacD0.y;
        r1.z = adouacD0.z;
    }
    r1.y = asuint(floor(asfloat(r1.y)));
    r1.z = asuint(floor(asfloat(r1.z)));
    { float adouacDot = asfloat(r1.y) * 12.9898 + asfloat(r1.z) * 78.233;
        r0.w = asuint(adouacDot);
    }
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 13758.545);
    r0.w = asuint(fract(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * _Value + (-0.94));
    r0.w = asuint(saturate(asfloat(r0.w) * 16.666666));
    r1.y = asuint(asfloat(r0.w) * (-2.0) + 3.0);
    r0.w = asuint(asfloat(r0.w) * asfloat(r0.w));
    r0.w = asuint(asfloat(r0.w) * asfloat(r1.y));
    r0.x = asuint(asfloat(r0.w) * asfloat(r2.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r0.w) * asfloat(r2.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r0.w) * asfloat(r2.z) + asfloat(r0.z));
    r2.x = asuint(-asfloat(r0.x) + 1.0);
    r2.y = asuint(-asfloat(r0.y) + 1.0);
    r2.z = asuint(-asfloat(r0.z) + 1.0);
    r1.y = asuint(floor(asfloat(r4.x)));
    r1.z = asuint(floor(asfloat(r4.y)));
    r1.y = asuint(-asfloat(r1.y) + asfloat(r4.x));
    r1.z = asuint(-asfloat(r1.z) + asfloat(r4.y));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = asuint(asfloat(r1.y) * _Value2);
        adouacD0.z = asuint(asfloat(r1.z) * _Value2);
        r1.y = adouacD0.y;
        r1.z = adouacD0.z;
    }
    r1.y = asuint(floor(asfloat(r1.y)));
    r1.z = asuint(floor(asfloat(r1.z)));
    { float adouacDot = asfloat(r1.y) * 12.9898 + asfloat(r1.z) * 78.233;
        r0.w = asuint(adouacDot);
    }
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 13758.545);
    r0.w = asuint(fract(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * _Value + (-0.95));
    r0.w = asuint(saturate(asfloat(r0.w) * 19.999996));
    r1.y = asuint(asfloat(r0.w) * (-2.0) + 3.0);
    r0.w = asuint(asfloat(r0.w) * asfloat(r0.w));
    r0.w = asuint(asfloat(r0.w) * asfloat(r1.y));
    r0.x = asuint(asfloat(r0.w) * asfloat(r2.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r0.w) * asfloat(r2.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r0.w) * asfloat(r2.z) + asfloat(r0.z));
    r2.x = asuint(-asfloat(r0.x) + 1.0);
    r2.y = asuint(-asfloat(r0.y) + 1.0);
    r2.z = asuint(-asfloat(r0.z) + 1.0);
    r4.x = asuint(_TimeX * 0.0);
    r4.y = asuint(_TimeX * 0.51);
    r4.z = asuint(_TimeX * 0.0);
    r4.w = asuint(_TimeX * 0.523);
    r1.y = asuint(asfloat(r1.x) * 0.1 + asfloat(r4.x));
    r1.z = asuint(asfloat(r1.w) * 0.2 + asfloat(r4.y));
    r1.x = asuint(asfloat(r1.x) * 0.03 + asfloat(r4.z));
    r1.w = asuint(asfloat(r1.w) * 0.06 + asfloat(r4.w));
    r4.x = asuint(floor(asfloat(r1.y)));
    r4.y = asuint(floor(asfloat(r1.z)));
    r1.y = asuint(asfloat(r1.y) + -asfloat(r4.x));
    r1.z = asuint(asfloat(r1.z) + -asfloat(r4.y));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = asuint(asfloat(r1.y) * _Value2);
        adouacD0.z = asuint(asfloat(r1.z) * _Value2);
        r1.y = adouacD0.y;
        r1.z = adouacD0.z;
    }
    r1.y = asuint(floor(asfloat(r1.y)));
    r1.z = asuint(floor(asfloat(r1.z)));
    { float adouacDot = asfloat(r1.y) * 12.9898 + asfloat(r1.z) * 78.233;
        r0.w = asuint(adouacDot);
    }
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 13758.545);
    r0.w = asuint(fract(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * _Value + (-0.96));
    r0.w = asuint(saturate(asfloat(r0.w) * 24.999987));
    r1.y = asuint(asfloat(r0.w) * (-2.0) + 3.0);
    r0.w = asuint(asfloat(r0.w) * asfloat(r0.w));
    r0.w = asuint(asfloat(r0.w) * asfloat(r1.y));
    r0.x = asuint(asfloat(r0.w) * asfloat(r2.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r0.w) * asfloat(r2.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r0.w) * asfloat(r2.z) + asfloat(r0.z));
    r2.x = asuint(-asfloat(r0.x) + 1.0);
    r2.y = asuint(-asfloat(r0.y) + 1.0);
    r2.z = asuint(-asfloat(r0.z) + 1.0);
    r1.y = asuint(floor(asfloat(r1.x)));
    r1.z = asuint(floor(asfloat(r1.w)));
    r1.x = asuint(-asfloat(r1.y) + asfloat(r1.x));
    r1.y = asuint(-asfloat(r1.z) + asfloat(r1.w));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r1.x) * _Value2);
        adouacD0.y = asuint(asfloat(r1.y) * _Value2);
        r1.x = adouacD0.x;
        r1.y = adouacD0.y;
    }
    r1.x = asuint(floor(asfloat(r1.x)));
    r1.y = asuint(floor(asfloat(r1.y)));
    { float adouacDot = asfloat(r1.x) * 12.9898 + asfloat(r1.y) * 78.233;
        r0.w = asuint(adouacDot);
    }
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * 13758.545);
    r0.w = asuint(fract(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) * _Value + (-0.99));
    r0.w = asuint(saturate(asfloat(r0.w) * 100.0001));
    r1.x = asuint(asfloat(r0.w) * (-2.0) + 3.0);
    r0.w = asuint(asfloat(r0.w) * asfloat(r0.w));
    r0.w = asuint(asfloat(r0.w) * asfloat(r1.x));
    r0.x = asuint(asfloat(r0.w) * asfloat(r2.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r0.w) * asfloat(r2.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r0.w) * asfloat(r2.z) + asfloat(r0.z));
    r0.x = asuint(-asfloat(r3.x) + asfloat(r0.x));
    r0.y = asuint(-asfloat(r3.y) + asfloat(r0.y));
    r0.z = asuint(-asfloat(r3.z) + asfloat(r0.z));
    o0.x = asuint(_Value4 * asfloat(r0.x) + asfloat(r3.x));
    o0.y = asuint(_Value4 * asfloat(r0.y) + asfloat(r3.y));
    o0.z = asuint(_Value4 * asfloat(r0.z) + asfloat(r3.z));
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
