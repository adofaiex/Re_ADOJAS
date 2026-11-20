precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

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
    r0.x = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r0.y = asuint(asfloat(v0.y) * 1.0 + 0.0);
    r0.z = asuint(_TimeX * 1.3);
    r1.x = asuint(asfloat(r0.z) * _Value2);
    r1.y = asuint(asfloat(r0.z) * _Value3);
    r0.w = 0x00000000u;
    r1.z = 0x00000000u;
     while (true)
    {
        r1.w = ((asint(r1.z) >= 8) ? 0xffffffffu : 0u);
        if (r1.w != 0u) break;
        r1.w = asuint(float(asint(r1.z)));
        r1.w = asuint(asfloat(r1.w) * 0.897598);
        r2.x = asuint(sin(asfloat(r1.w)));
        r3.x = asuint(cos(asfloat(r1.w)));
        r1.w = asuint(asfloat(r0.z) * asfloat(r3.x));
        r1.w = asuint(asfloat(r1.w) * _Value + asfloat(r1.x));
        r1.w = asuint(asfloat(r0.x) + asfloat(r1.w));
        r2.y = asuint(asfloat(r0.z) * asfloat(r2.x));
        r2.y = asuint(asfloat(r2.y) * _Value + -asfloat(r1.y));
        r2.y = asuint(asfloat(r0.y) + -asfloat(r2.y));
        r2.x = asuint(asfloat(r2.x) * asfloat(r2.y));
        r1.w = asuint(asfloat(r1.w) * asfloat(r3.x) + -asfloat(r2.x));
        r1.w = asuint(asfloat(r1.w) * 6.0);
        r1.w = asuint(cos(asfloat(r1.w)));
        r0.w = asuint(asfloat(r1.w) * _Value4 + asfloat(r0.w));
        r1.z = asuint(asint(r1.z) + 1);
    }
    r0.w = asuint(cos(asfloat(r0.w)));
    r1.z = asuint(asfloat(r0.x) + 8.53);
    r1.w = asuint(asfloat(r0.y) + 8.53);
    r2.x = 0x00000000u;
    r2.y = 0x00000000u;
     while (true)
    {
        r2.z = ((asint(r2.y) >= 8) ? 0xffffffffu : 0u);
        if (r2.z != 0u) break;
        r2.z = asuint(float(asint(r2.y)));
        r2.z = asuint(asfloat(r2.z) * 0.897598);
        r3.x = asuint(sin(asfloat(r2.z)));
        r4.x = asuint(cos(asfloat(r2.z)));
        r2.z = asuint(asfloat(r0.z) * asfloat(r4.x));
        r2.z = asuint(asfloat(r2.z) * _Value + asfloat(r1.x));
        r2.z = asuint(asfloat(r1.z) + asfloat(r2.z));
        r2.w = asuint(asfloat(r0.z) * asfloat(r3.x));
        r2.w = asuint(asfloat(r2.w) * _Value + -asfloat(r1.y));
        r2.w = asuint(asfloat(r0.y) + -asfloat(r2.w));
        r2.w = asuint(asfloat(r3.x) * asfloat(r2.w));
        r2.z = asuint(asfloat(r2.z) * asfloat(r4.x) + -asfloat(r2.w));
        r2.z = asuint(asfloat(r2.z) * 6.0);
        r2.z = asuint(cos(asfloat(r2.z)));
        r2.x = asuint(asfloat(r2.z) * _Value4 + asfloat(r2.x));
        r2.y = asuint(asint(r2.y) + 1);
    }
    r1.z = asuint(cos(asfloat(r2.x)));
    r1.z = asuint(asfloat(r0.w) + -asfloat(r1.z));
    r2.x = 0x00000000u;
    r2.y = 0x00000000u;
     while (true)
    {
        r2.z = ((asint(r2.y) >= 8) ? 0xffffffffu : 0u);
        if (r2.z != 0u) break;
        r2.z = asuint(float(asint(r2.y)));
        r2.z = asuint(asfloat(r2.z) * 0.897598);
        r3.x = asuint(sin(asfloat(r2.z)));
        r4.x = asuint(cos(asfloat(r2.z)));
        r2.z = asuint(asfloat(r0.z) * asfloat(r4.x));
        r2.z = asuint(asfloat(r2.z) * _Value + asfloat(r1.x));
        r2.z = asuint(asfloat(r0.x) + asfloat(r2.z));
        r2.w = asuint(asfloat(r0.z) * asfloat(r3.x));
        r2.w = asuint(asfloat(r2.w) * _Value + -asfloat(r1.y));
        r2.w = asuint(asfloat(r1.w) + -asfloat(r2.w));
        r2.w = asuint(asfloat(r3.x) * asfloat(r2.w));
        r2.z = asuint(asfloat(r2.z) * asfloat(r4.x) + -asfloat(r2.w));
        r2.z = asuint(asfloat(r2.z) * 6.0);
        r2.z = asuint(cos(asfloat(r2.z)));
        r2.x = asuint(asfloat(r2.z) * _Value4 + asfloat(r2.x));
        r2.y = asuint(asint(r2.y) + 1);
    }
    r0.z = asuint(cos(asfloat(r2.x)));
    r0.z = asuint(-asfloat(r0.z) + asfloat(r0.w));
    r0.w = asuint(asfloat(r1.z) * 0.008333);
    r1.x = asuint(asfloat(r1.z) * 0.016667 + asfloat(r0.x));
    r0.x = asuint(asfloat(r0.z) * 0.008333);
    r1.y = asuint(asfloat(r0.z) * 0.016667 + asfloat(r0.y));
    r0.x = asuint(asfloat(r0.x) * asfloat(r0.w));
    r0.x = asuint(asfloat(r0.x) * 700.0 + 1.0);
    r0.y = asuint(asfloat(r1.z) * 0.008333 + (-0.012));
    r0.z = asuint(asfloat(r0.z) * 0.008333 + (-0.012));
    r0.w = ((0.0 < asfloat(r0.y)) ? 0xffffffffu : 0u);
    r1.z = ((0.0 < asfloat(r0.z)) ? 0xffffffffu : 0u);
    r0.w = (r0.w & r1.z);
    r0.y = asuint(asfloat(r0.z) * asfloat(r0.y));
    r0.y = asuint(asfloat(r0.y) * 200000.0);
    r0.z = asuint(log2(asfloat(r0.x)));
    r0.y = asuint(asfloat(r0.z) * asfloat(r0.y));
    r0.y = asuint(exp2(asfloat(r0.y)));
    r0.x = ((r0.w != 0u) ? r0.y : r0.x);
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.x), asfloat(r1.y)));
        r1.x = asuint(adouacTex.x);
        r1.y = asuint(adouacTex.y);
        r1.z = asuint(adouacTex.z);
        r1.w = asuint(adouacTex.w);
    }
    o0.x = asuint(asfloat(r0.x) * asfloat(r1.x));
    o0.y = asuint(asfloat(r0.x) * asfloat(r1.y));
    o0.z = asuint(asfloat(r0.x) * asfloat(r1.z));
    o0.w = asuint(asfloat(r0.x) * asfloat(r1.w));
    return AdouacOutputPs(o0);
}

void main() {
    AdouacVaryings IN;
    IN.pos = gl_FragCoord;
    IN.texcoord0 = vec4(vUv, 0.0, 0.0);
    IN.color0 = vec4(1.0);
    fragColor = frag(IN);
}
