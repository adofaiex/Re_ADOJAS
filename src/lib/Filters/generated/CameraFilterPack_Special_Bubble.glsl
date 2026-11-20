precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform float _TimeX;
uniform float _Value;
uniform float _Value2;
uniform float _Value3;
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
    r0.x = asuint(_TimeX * 9.0);
    r0.y = asuint(_TimeX * 3.0);
    r0.z = asuint(_TimeX * 5.7);
    r0.w = asuint(_TimeX * 1.9);
    r1.x = asuint(cos(asfloat(r0.y)));
    r1.y = asuint(cos(asfloat(r0.w)));
    r0.x = asuint(sin(asfloat(r0.x)));
    r0.y = asuint(sin(asfloat(r0.y)));
    r0.z = asuint(sin(asfloat(r0.z)));
    r0.w = asuint(sin(asfloat(r0.w)));
    r1.z = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r1.w = asuint(asfloat(v0.y) * 1.0 + 0.0);
    r2.x = asuint(asfloat(r1.z) * 2.0 + (-1.0));
    r2.y = asuint(asfloat(r1.w) * 2.0 + (-1.0));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r2.x) * 2.0 + -_Value);
        adouacD0.y = asuint(asfloat(r2.y) * 2.0 + -_Value2);
        r2.x = adouacD0.x;
        r2.y = adouacD0.y;
    }
    r1.x = asuint(asfloat(r1.x) * 0.8 + asfloat(r2.y));
    r1.y = asuint(asfloat(r1.y) * 0.8 + asfloat(r2.y));
    r1.x = asuint(asfloat(r1.x) * asfloat(r1.x));
    r1.y = asuint(asfloat(r1.y) * asfloat(r1.y));
    r0.x = asuint(asfloat(r0.x) * 0.15 + asfloat(r2.x));
    r0.z = asuint(asfloat(r0.z) * 0.2 + asfloat(r2.x));
    r0.x = asuint(asfloat(r0.x) * asfloat(r0.x) + asfloat(r1.x));
    r0.z = asuint(asfloat(r0.z) * asfloat(r0.z) + asfloat(r1.y));
    r0.x = asuint(sqrt(asfloat(r0.x)));
    r0.z = asuint(sqrt(asfloat(r0.z)));
    r0.x = asuint(1.0 / asfloat(r0.x));
    r0.z = asuint(1.0 / asfloat(r0.z));
    r0.x = asuint(asfloat(r0.y) * asfloat(r0.x));
    r0.y = asuint(asfloat(r0.w) * asfloat(r0.z));
    r0.x = asuint(asfloat(r0.y) + asfloat(r0.x));
    r3.x = asuint(_TimeX * 1.8);
    r3.y = asuint(_TimeX * 0.6);
    r3.z = asuint(_TimeX * 3.9);
    r3.w = asuint(_TimeX * 1.3);
    r0.y = asuint(cos(asfloat(r3.y)));
    r0.z = asuint(cos(asfloat(r3.w)));
    r3.x = asuint(sin(asfloat(r3.x)));
    r3.y = asuint(sin(asfloat(r3.y)));
    r3.z = asuint(sin(asfloat(r3.z)));
    r3.w = asuint(sin(asfloat(r3.w)));
    r0.y = asuint(asfloat(r0.y) * 0.4 + asfloat(r2.y));
    r0.z = asuint(asfloat(r0.z) * 0.6 + asfloat(r2.y));
    r0.y = asuint(asfloat(r0.y) * asfloat(r0.y));
    r0.z = asuint(asfloat(r0.z) * asfloat(r0.z));
    r1.x = asuint(asfloat(r3.x) * 0.17 + asfloat(r2.x));
    r1.y = asuint(asfloat(r3.z) * 0.14 + asfloat(r2.x));
    r0.y = asuint(asfloat(r1.x) * asfloat(r1.x) + asfloat(r0.y));
    r0.z = asuint(asfloat(r1.y) * asfloat(r1.y) + asfloat(r0.z));
    r0.y = asuint(sqrt(asfloat(r0.y)));
    r0.z = asuint(sqrt(asfloat(r0.z)));
    r0.y = asuint(1.0 / asfloat(r0.y));
    r0.z = asuint(1.0 / asfloat(r0.z));
    r0.x = asuint(asfloat(r0.y) * asfloat(r3.y) + asfloat(r0.x));
    r0.x = asuint(asfloat(r0.z) * asfloat(r3.w) + asfloat(r0.x));
    r0.y = asuint(_TimeX * 5.4);
    r0.z = asuint(_TimeX * 1.8);
    r0.w = asuint(cos(asfloat(r0.z)));
    r0.y = asuint(sin(asfloat(r0.y)));
    r0.z = asuint(sin(asfloat(r0.z)));
    r0.w = asuint(asfloat(r0.w) * 0.5 + asfloat(r2.y));
    r0.y = asuint(asfloat(r0.y) * 0.14 + asfloat(r2.x));
    r0.w = asuint(asfloat(r0.w) * asfloat(r0.w));
    r0.y = asuint(asfloat(r0.y) * asfloat(r0.y) + asfloat(r0.w));
    r0.y = asuint(sqrt(asfloat(r0.y)));
    r0.y = asuint(1.0 / asfloat(r0.y));
    r0.x = asuint(asfloat(r0.y) * asfloat(r0.z) + asfloat(r0.x));
    r0.x = asuint(asfloat(r0.x) * _Value3);
    r0.x = asuint(asfloat(r0.x) * 0.03125);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r1.z) * 0.8 + -asfloat(r0.x));
        adouacD0.y = asuint(asfloat(r1.w) * 0.8 + -asfloat(r0.x));
        r0.x = adouacD0.x;
        r0.y = adouacD0.y;
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r0.x), asfloat(r0.y)));
        r0.x = asuint(adouacTex.x);
        r0.y = asuint(adouacTex.y);
        r0.z = asuint(adouacTex.z);
        r0.w = asuint(adouacTex.w);
    }
    o0.x = r0.x;
    o0.y = r0.y;
    o0.z = r0.z;
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
