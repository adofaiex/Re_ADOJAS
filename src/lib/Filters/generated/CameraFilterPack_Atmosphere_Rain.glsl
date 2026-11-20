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
uniform float _Value5;
uniform float _Value6;
uniform float _Value7;
uniform sampler2D Texture2;
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
    uvec4 r0 = uvec4(0u), r1 = uvec4(0u), r2 = uvec4(0u), r3 = uvec4(0u), r4 = uvec4(0u), r5 = uvec4(0u);
    uvec4 o0 = uvec4(0u);
    r0.x = ((_MainTex_TexelSize.y < 0.0) ? 0xffffffffu : 0u);
    r1.x = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r1.y = asuint(asfloat(v0.y) * 1.0 + 0.0);
    r0.y = asuint(-asfloat(r1.y) + 1.0);
    r1.z = ((r0.x != 0u) ? r0.y : r1.y);
    r0.x = asuint(asfloat(r1.x) * _Value5);
    r0.y = asuint(asfloat(r1.z) * _Value5);
    r0.x = asuint(_Value3 * asfloat(r0.y) + asfloat(r0.x));
    r2.x = asuint(asfloat(r0.x) * 3.0 + 0.1);
    r3.x = asuint(asfloat(r2.x) * 0.65 + 0.1);
    r0.x = asuint(_TimeX * _Value4);
    r4.x = asuint(asfloat(r0.x) * 0.8);
    r4.y = asuint(asfloat(r0.x) * 1.2);
    r4.z = asuint(asfloat(r0.x) * 0.4);
    r2.y = asuint(asfloat(r0.y) * 3.0 + asfloat(r4.x));
    r3.y = asuint(asfloat(r2.y) * 0.65 + asfloat(r0.x));
    { vec4 adouacTex = texture(Texture2, vec2(asfloat(r2.x), asfloat(r2.y)));
        r0.x = asuint(adouacTex.x);
        r0.y = asuint(adouacTex.y);
        r0.z = asuint(adouacTex.z);
        r0.w = asuint(adouacTex.w);
    }
    r0.x = asuint(asfloat(r0.x) * _Value2);
    { vec4 adouacTex = texture(Texture2, vec2(asfloat(r3.x), asfloat(r3.y)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    r5.x = asuint(asfloat(r3.x) * 0.65 + 0.1);
    r5.y = asuint(asfloat(r3.y) * 0.65 + asfloat(r4.y));
    r0.y = asuint(asfloat(r2.x) * _Value2);
    r0.y = asuint(asfloat(r0.y) * 0.5);
    r0.x = asuint(asfloat(r0.x) * 0.3 + asfloat(r0.y));
    { vec4 adouacTex = texture(Texture2, vec2(asfloat(r5.x), asfloat(r5.y)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    r3.x = asuint(asfloat(r5.x) * 0.5 + 0.1);
    r3.y = asuint(asfloat(r5.y) * 0.5 + asfloat(r4.y));
    r0.y = asuint(asfloat(r2.x) * _Value2);
    r0.x = asuint(asfloat(r0.y) * 0.7 + asfloat(r0.x));
    { vec4 adouacTex = texture(Texture2, vec2(asfloat(r3.x), asfloat(r3.y)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    r5.x = asuint(asfloat(r3.x) * 0.4 + 0.1);
    r5.y = asuint(asfloat(r3.y) * 0.4 + asfloat(r4.y));
    r3.x = asuint(asfloat(r1.x) * 0.001 + asfloat(r4.z));
    { vec4 adouacTex = texture(Texture2, vec2(asfloat(r5.x), asfloat(r5.y)));
        r4.x = asuint(adouacTex.x);
        r4.y = asuint(adouacTex.y);
        r4.z = asuint(adouacTex.z);
        r4.w = asuint(adouacTex.w);
    }
    r0.y = asuint(asfloat(r4.x) * _Value2);
    r0.z = asuint(asfloat(r2.x) * _Value2);
    r0.x = asuint(asfloat(r0.z) * 0.9 + asfloat(r0.x));
    r0.x = asuint(asfloat(r0.y) * 0.9 + asfloat(r0.x));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.y = asuint(asfloat(r0.x) * _Value6 + asfloat(r1.x));
        adouacD0.z = asuint(asfloat(r0.x) * _Value6 + asfloat(r1.y));
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.x), asfloat(r1.y)));
        r1.x = asuint(adouacTex.x);
        r1.y = asuint(adouacTex.y);
        r1.z = asuint(adouacTex.z);
        r1.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r0.y), asfloat(r0.z)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r0.x) + asfloat(r2.x));
        adouacD0.y = asuint(asfloat(r0.x) + asfloat(r2.y));
        adouacD0.z = asuint(asfloat(r0.x) + asfloat(r2.z));
        adouacD0.w = asuint(asfloat(r0.x) + asfloat(r2.w));
        r0.x = adouacD0.x;
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
        r0.w = adouacD0.w;
    }
    r0.x = asuint(-asfloat(r1.x) + asfloat(r0.x));
    r0.y = asuint(-asfloat(r1.y) + asfloat(r0.y));
    r0.z = asuint(-asfloat(r1.z) + asfloat(r0.z));
    r0.w = asuint(-asfloat(r1.w) + asfloat(r0.w));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(_Value * asfloat(r0.x) + asfloat(r1.x));
        adouacD0.y = asuint(_Value * asfloat(r0.y) + asfloat(r1.y));
        adouacD0.z = asuint(_Value * asfloat(r0.z) + asfloat(r1.z));
        adouacD0.w = asuint(_Value * asfloat(r0.w) + asfloat(r1.w));
        r0.x = adouacD0.x;
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
        r0.w = adouacD0.w;
    }
    r3.y = 0x00000000u;
    { vec4 adouacTex = texture(Texture2, vec2(asfloat(r3.x), asfloat(r3.y)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r2.y) * _Value2);
    r2.x = asuint(asfloat(r2.x) * _Value7);
    r0.x = asuint(asfloat(r2.x) * 0.9 + asfloat(r0.x));
    r0.y = asuint(asfloat(r2.x) * 0.9 + asfloat(r0.y));
    r0.z = asuint(asfloat(r2.x) * 0.9 + asfloat(r0.z));
    r0.w = asuint(asfloat(r2.x) * 0.9 + asfloat(r0.w));
    r0.x = asuint(-asfloat(r1.x) + asfloat(r0.x));
    r0.y = asuint(-asfloat(r1.y) + asfloat(r0.y));
    r0.z = asuint(-asfloat(r1.z) + asfloat(r0.z));
    r0.w = asuint(-asfloat(r1.w) + asfloat(r0.w));
    o0.x = asuint(_Value * asfloat(r0.x) + asfloat(r1.x));
    o0.y = asuint(_Value * asfloat(r0.y) + asfloat(r1.y));
    o0.z = asuint(_Value * asfloat(r0.z) + asfloat(r1.z));
    o0.w = asuint(_Value * asfloat(r0.w) + asfloat(r1.w));
    return AdouacOutputPs(o0);
}

void main() {
    AdouacVaryings IN;
    IN.pos = gl_FragCoord;
    IN.texcoord0 = vec4(vUv, 0.0, 0.0);
    IN.color0 = vec4(1.0);
    fragColor = frag(IN);
}
