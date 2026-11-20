precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform float _TimeX;
uniform float _Value;
uniform float _Value2;
uniform float _Value3;
uniform float _Value4;
uniform float _Value5;
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
    r0.x = asuint(_Value * 0.5);
    r0.x = asuint(24.0 / asfloat(r0.x));
    r0.y = asuint(asfloat(r0.x) * asfloat(v0.x));
    r0.z = asuint(asfloat(r0.x) * asfloat(v0.y));
    r0.w = asuint(asfloat(r0.x) * asfloat(v0.x));
    r1.x = asuint(ceil(asfloat(r0.w)));
    r1.y = asuint(ceil(asfloat(r0.w)));
    r0.y = asuint(fract(asfloat(r0.y)));
    r0.z = asuint(fract(asfloat(r0.z)));
    r0.w = asuint(fract(asfloat(r0.w)));
    r0.y = asuint(asfloat(r0.y) * 6.0 + (-0.5));
    r0.z = asuint(asfloat(r0.z) * 6.0 + (-0.5));
    r0.w = asuint(asfloat(r0.w) * 6.0 + (-2.0));
    { float adouacDot = asfloat(r1.x) * 12.0 + asfloat(r1.x) * 7.0;
        r1.x = asuint(adouacDot);
    }
    r1.x = asuint(sin(asfloat(r1.x)));
    r1.x = asuint(asfloat(r1.x) * 4000.0);
    r1.w = ((asfloat(r1.x) >= -asfloat(r1.x)) ? 0xffffffffu : 0u);
    r1.x = asuint(fract(abs(asfloat(r1.x))));
    r1.x = ((r1.w != 0u) ? r1.x : asuint(-asfloat(r1.x)));
    { float adouacDot = _TimeX * _Value5 + _TimeX * _Value5;
        r1.w = asuint(adouacDot);
    }
    r1.x = asuint(asfloat(r1.w) * asfloat(r1.x));
    r1.x = asuint(asfloat(r1.x) * 5.0);
    r1.x = asuint(ceil(asfloat(r1.x)));
    r0.x = asuint(asfloat(v0.y) * asfloat(r0.x) + asfloat(r1.x));
    r1.z = asuint(ceil(asfloat(r0.x)));
    { float adouacDot = asfloat(r1.y) * 12.0 + asfloat(r1.z) * 7.0;
        r0.x = asuint(adouacDot);
    }
    r0.x = asuint(sin(asfloat(r0.x)));
    r0.x = asuint(asfloat(r0.x) * 4000.0);
    r1.x = ((asfloat(r0.x) >= -asfloat(r0.x)) ? 0xffffffffu : 0u);
    r0.x = asuint(fract(abs(asfloat(r0.x))));
    r0.x = ((r1.x != 0u) ? r0.x : asuint(-asfloat(r0.x)));
    r0.x = asuint(asfloat(r0.x) * 10.0);
    r0.x = asuint(floor(asfloat(r0.x)));
    r0.y = asuint(ceil(asfloat(r0.y)));
    r0.y = asuint(-asfloat(r0.y) + 30.0);
    r0.x = asuint(-asfloat(r0.x) * 3.0 + asfloat(r0.y));
    r0.x = asuint(exp2(asfloat(r0.x)));
    r0.x = asuint(int(asfloat(r0.x)));
    r0.y = asuint(int(asfloat(r0.z)));
    r0.z = ((1.1 < abs(asfloat(r0.w))) ? 0xffffffffu : 0u);
    r0.w = ((asint(r0.y) == 1) ? 0xffffffffu : 0u);
    r2.x = ((asint(r0.y) == 5) ? 0xffffffffu : 0u);
    r2.y = ((asint(r0.y) == 4) ? 0xffffffffu : 0u);
    r2.z = ((asint(r0.y) == 3) ? 0xffffffffu : 0u);
    r2.w = ((asint(r0.y) == 2) ? 0xffffffffu : 0u);
    r0.y = (r0.w & 0x39fcfe7fu);
    r0.y = ((r2.w != 0u) ? 0x00000000u : r0.y);
    r0.y = ((r2.z != 0u) ? 0x00000000u : r0.y);
    r0.y = ((r2.y != 0u) ? 0x00000000u : r0.y);
    r0.y = ((r2.x != 0u) ? 0x39fe4799u : r0.y);
    r0.y = ((r0.z != 0u) ? 0x00000000u : r0.y);
    r0.z = (r0.x ^ r0.y);
    r0.x = asuint(max(asint(r0.x), (-asint(r0.x))));
    r0.x = (r0.y / r0.x);
    r0.y = (r0.z & 0x80000000u);
    r0.z = asuint(-asint(r0.x));
    r0.x = ((r0.y != 0u) ? r0.z : r0.x);
    r0.y = (r0.x ^ 0x00000002u);
    r0.y = (r0.y & 0x80000000u);
    r0.z = asuint(max(asint(r0.x), (-asint(r0.x))));
    r0.z = (r0.z >> (0x00000001u & 31u));
    r0.w = asuint(-asint(r0.z));
    r0.y = ((r0.y != 0u) ? r0.w : r0.z);
    r0.y = (r0.y << (0x00000001u & 31u));
    r0.x = ((asint(r0.y) < asint(r0.x)) ? 0xffffffffu : 0u);
    r0.y = asuint(24.0 / _Value);
    r1.x = asuint(asfloat(r0.y) * asfloat(v0.x));
    r1.y = asuint(asfloat(r0.y) * asfloat(v0.y));
    r2.x = asuint(ceil(asfloat(r1.x)));
    r2.y = asuint(ceil(asfloat(r1.x)));
    { float adouacDot = asfloat(r2.x) * 12.0 + asfloat(r2.x) * 7.0;
        r0.z = asuint(adouacDot);
    }
    r0.z = asuint(sin(asfloat(r0.z)));
    r0.z = asuint(asfloat(r0.z) * 4000.0);
    r0.w = ((asfloat(r0.z) >= -asfloat(r0.z)) ? 0xffffffffu : 0u);
    r0.z = asuint(fract(abs(asfloat(r0.z))));
    r0.z = ((r0.w != 0u) ? r0.z : asuint(-asfloat(r0.z)));
    r0.z = asuint(asfloat(r1.w) * asfloat(r0.z));
    r0.z = asuint(asfloat(r0.z) * 10.0);
    r0.z = asuint(ceil(asfloat(r0.z)));
    r1.z = asuint(asfloat(v0.y) * asfloat(r0.y) + asfloat(r0.z));
    r2.z = asuint(ceil(asfloat(r1.z)));
    r0.y = asuint(asfloat(r1.x) + 1.0);
    r0.z = asuint(asfloat(r1.z) + 1.0);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(fract(asfloat(r1.x)));
        adouacD0.y = asuint(fract(asfloat(r1.y)));
        adouacD0.z = asuint(fract(asfloat(r1.x)));
        r1.x = adouacD0.x;
        r1.y = adouacD0.y;
        r1.z = adouacD0.z;
    }
    r1.x = asuint(asfloat(r1.x) * 6.0 + (-0.5));
    r1.y = asuint(asfloat(r1.y) * 6.0 + (-0.5));
    r1.z = asuint(asfloat(r1.z) * 6.0 + (-2.0));
    r0.y = asuint(ceil(asfloat(r0.y)));
    r0.z = asuint(ceil(asfloat(r0.z)));
    { float adouacDot = asfloat(r0.y) * 12.0 + asfloat(r0.z) * 7.0;
        r0.y = asuint(adouacDot);
    }
    r0.y = asuint(sin(asfloat(r0.y)));
    { float adouacDot = asfloat(r2.y) * 12.0 + asfloat(r2.z) * 7.0;
        r0.z = asuint(adouacDot);
    }
    r0.z = asuint(sin(asfloat(r0.z)));
    r0.y = asuint(asfloat(r0.y) * 4000.0);
    r0.z = asuint(asfloat(r0.z) * 4000.0);
    r0.w = ((asfloat(r0.z) >= -asfloat(r0.z)) ? 0xffffffffu : 0u);
    r0.z = asuint(fract(abs(asfloat(r0.z))));
    r0.z = ((r0.w != 0u) ? r0.z : asuint(-asfloat(r0.z)));
    r0.z = asuint(asfloat(r0.z) * 10.0);
    r0.z = asuint(floor(asfloat(r0.z)));
    r0.w = asuint(ceil(asfloat(r1.x)));
    r0.w = asuint(-asfloat(r0.w) + 30.0);
    r0.z = asuint(-asfloat(r0.z) * 3.0 + asfloat(r0.w));
    r0.z = asuint(exp2(asfloat(r0.z)));
    r0.z = asuint(int(asfloat(r0.z)));
    r0.w = asuint(int(asfloat(r1.y)));
    r1.x = ((1.1 < abs(asfloat(r1.z))) ? 0xffffffffu : 0u);
    r1.y = ((asint(r0.w) == 1) ? 0xffffffffu : 0u);
    r2.x = ((asint(r0.w) == 5) ? 0xffffffffu : 0u);
    r2.y = ((asint(r0.w) == 4) ? 0xffffffffu : 0u);
    r2.z = ((asint(r0.w) == 3) ? 0xffffffffu : 0u);
    r2.w = ((asint(r0.w) == 2) ? 0xffffffffu : 0u);
    r0.w = (r1.y & 0x39fcfe7fu);
    r0.w = ((r2.w != 0u) ? 0x00000000u : r0.w);
    r0.w = ((r2.z != 0u) ? 0x00000000u : r0.w);
    r0.w = ((r2.y != 0u) ? 0x00000000u : r0.w);
    r0.w = ((r2.x != 0u) ? 0x39fe4799u : r0.w);
    r0.w = ((r1.x != 0u) ? 0x00000000u : r0.w);
    r1.x = (r0.z ^ r0.w);
    r0.z = asuint(max(asint(r0.z), (-asint(r0.z))));
    r0.z = (r0.w / r0.z);
    r0.w = (r1.x & 0x80000000u);
    r1.x = asuint(-asint(r0.z));
    r0.z = ((r0.w != 0u) ? r1.x : r0.z);
    r0.w = (r0.z ^ 0x00000002u);
    r0.w = (r0.w & 0x80000000u);
    r1.x = asuint(max(asint(r0.z), (-asint(r0.z))));
    r1.x = (r1.x >> (0x00000001u & 31u));
    r1.y = asuint(-asint(r1.x));
    r0.w = ((r0.w != 0u) ? r1.y : r1.x);
    r0.w = (r0.w << (0x00000001u & 31u));
    r0.z = ((asint(r0.w) < asint(r0.z)) ? 0xffffffffu : 0u);
    r0.w = ((asfloat(r0.y) >= -asfloat(r0.y)) ? 0xffffffffu : 0u);
    r0.y = asuint(fract(abs(asfloat(r0.y))));
    r0.y = ((r0.w != 0u) ? r0.y : asuint(-asfloat(r0.y)));
    r0.y = ((asfloat(r0.y) < 0.99) ? 0xffffffffu : 0u);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = ((r0.y != 0u) ? 0x40000000u : 0x3f800000u);
        adouacD0.w = ((r0.y != 0u) ? 0x3f800000u : 0x00000000u);
        r0.y = adouacD0.y;
        r0.w = adouacD0.w;
    }
    r0.y = (r0.y & r0.z);
    r0.z = (r0.w & r0.z);
    r1.x = asuint(asfloat(r0.y) + 1.0);
    r1.y = asuint(asfloat(r0.z) + 0.0);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = ((r0.x != 0u) ? r1.x : r0.y);
        adouacD0.y = ((r0.x != 0u) ? r1.y : r0.z);
        r0.x = adouacD0.x;
        r0.y = adouacD0.y;
    }
    r1.x = asuint(asfloat(r0.x) * _Value2);
    r1.y = asuint(asfloat(r0.y) * _Value3);
    r1.z = asuint(asfloat(r0.y) * _Value4);
    r1.w = r0.x;
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(v0.x), asfloat(v0.y)));
        r0.x = asuint(adouacTex.x);
        r0.y = asuint(adouacTex.y);
        r0.z = asuint(adouacTex.z);
        r0.w = asuint(adouacTex.w);
    }
    o0.x = asuint(asfloat(r1.x) + asfloat(r0.x));
    o0.y = asuint(asfloat(r1.y) + asfloat(r0.y));
    o0.z = asuint(asfloat(r1.z) + asfloat(r0.z));
    o0.w = asuint(asfloat(r1.w) + asfloat(r0.w));
    return AdouacOutputPs(o0);
}

void main() {
    AdouacVaryings IN;
    IN.pos = gl_FragCoord;
    IN.texcoord0 = vec4(vUv, 0.0, 0.0);
    IN.color0 = vec4(1.0);
    fragColor = frag(IN);
}
