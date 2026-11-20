precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform float _Blue_B;
uniform float _Blue_C;
uniform float _Blue_G;
uniform float _Blue_R;
uniform float _Dist;
uniform float _FadeFX;
uniform float _Green_B;
uniform float _Green_C;
uniform float _Green_G;
uniform float _Green_R;
uniform float _Red_B;
uniform float _Red_C;
uniform float _Red_G;
uniform float _Red_R;
uniform float _Size;
uniform float _Smooth;
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
    uvec4 r0 = uvec4(0u), r1 = uvec4(0u), r2 = uvec4(0u), r3 = uvec4(0u), r4 = uvec4(0u);
    uvec4 o0 = uvec4(0u);
    r0.x = asuint(_TimeX * 0.25);
    r0.y = asuint(_TimeX * 0.23);
    r0.z = asuint(_TimeX * 10.0);
    r0.w = asuint(_TimeX * 110.0);
    r0.y = asuint(sin(asfloat(r0.y)));
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.y = asuint(asfloat(r0.y) + _TimeX);
    r0.w = asuint(asfloat(r0.w) * 0.01 + 0.79);
    r1.x = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r1.y = asuint(asfloat(v0.y) * 1.0 + 0.0);
    r0.x = asuint(asfloat(r1.y) * 2.0 + asfloat(r0.x));
    r0.z = asuint(asfloat(r1.y) * 250.0 + asfloat(r0.z));
    r0.y = asuint(sin(asfloat(r0.y)));
    r0.z = asuint(sin(asfloat(r0.z)));
    r0.z = asuint(asfloat(r0.z) * 0.1 + 0.9);
    r0.x = asuint(asfloat(r0.y) + asfloat(r0.x));
    r0.y = asuint(floor(asfloat(r0.x)));
    r0.x = asuint(-asfloat(r0.y) + asfloat(r0.x));
    r2.x = ((asfloat(r0.x) >= 0.4) ? 0xffffffffu : 0u);
    r2.y = ((asfloat(r0.x) >= 0.6) ? 0xffffffffu : 0u);
    r0.x = asuint(asfloat(r0.x) + (-0.4));
    r0.y = (r2.x & 0x3f800000u);
    r1.w = ((r2.y != 0u) ? 0xbf800000u : 0x80000000u);
    r0.y = asuint(asfloat(r0.y) + asfloat(r1.w));
    r0.x = asuint(asfloat(r0.y) * asfloat(r0.x));
    r0.x = asuint(-asfloat(r0.x) * 5.0 + 1.0);
    r0.x = asuint(asfloat(r0.y) * asfloat(r0.x));
    r0.y = asuint(cos(_TimeX));
    r2.y = asuint(asfloat(r0.y) * _TimeX);
    r2.x = asuint(_TimeX);
    r2.z = asuint(asfloat(r1.x) * 0.5 + 1.0);
    r2.w = asuint(asfloat(r1.y) * 1.0 + 3.0);
    r2.x = asuint(asfloat(r2.x) * 8.0 + asfloat(r2.z));
    r2.y = asuint(asfloat(r2.y) * 16.0 + asfloat(r2.w));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r2.x), asfloat(r2.y)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    r0.y = asuint(asfloat(r2.x) * asfloat(r2.x));
    r0.x = asuint(asfloat(r0.y) * asfloat(r0.x));
    r2.y = asuint(_Blue_G + -_Smooth);
    r2.x = asuint(_Blue_R);
    r2.z = asuint(_Blue_B);
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.x), asfloat(r1.y)));
        r3.x = asuint(adouacTex.x);
        r3.y = asuint(adouacTex.y);
        r3.z = asuint(adouacTex.z);
        r3.w = asuint(adouacTex.w);
    }
    { float adouacDot = asfloat(r3.x) * asfloat(r2.x) + asfloat(r3.y) * asfloat(r2.y) + asfloat(r3.z) * asfloat(r2.z);
        r0.y = asuint(adouacDot);
    }
    r2.z = asuint(asfloat(r0.y) + _Blue_C);
    r4.y = asuint(_Red_G + -_Smooth);
    r4.x = asuint(_Red_R);
    r4.z = asuint(_Red_B);
    { float adouacDot = asfloat(r3.x) * asfloat(r4.x) + asfloat(r3.y) * asfloat(r4.y) + asfloat(r3.z) * asfloat(r4.z);
        r0.y = asuint(adouacDot);
    }
    r2.x = asuint(asfloat(r0.y) + _Red_C);
    r4.y = asuint(_Green_G + -_Smooth);
    r4.x = asuint(_Green_R);
    r4.z = asuint(_Green_B);
    { float adouacDot = asfloat(r3.x) * asfloat(r4.x) + asfloat(r3.y) * asfloat(r4.y) + asfloat(r3.z) * asfloat(r4.z);
        r0.y = asuint(adouacDot);
    }
    r2.y = asuint(asfloat(r0.y) + _Green_C);
    r2.x = asuint(asfloat(r0.x) * 0.125 + asfloat(r2.x));
    r2.y = asuint(asfloat(r0.x) * 0.125 + asfloat(r2.y));
    r2.z = asuint(asfloat(r0.x) * 0.125 + asfloat(r2.z));
    r0.x = asuint(asfloat(r1.y) * 30.0 + _TimeX);
    r0.y = asuint(floor(asfloat(r0.x)));
    r0.x = asuint(-asfloat(r0.y) + asfloat(r0.x));
    r0.x = asuint(asfloat(r0.x) + 12.0);
    r0.x = asuint(asfloat(r0.x) * 0.076923);
    r2.x = asuint(asfloat(r0.x) * asfloat(r2.x));
    r2.y = asuint(asfloat(r0.x) * asfloat(r2.y));
    r2.z = asuint(asfloat(r0.x) * asfloat(r2.z));
    r0.x = asuint(asfloat(r1.x) * asfloat(r1.y));
    r0.x = asuint(asfloat(r0.x) * 6.0);
    r4.x = asuint(-asfloat(r1.x) + 1.5);
    r4.y = asuint(-asfloat(r1.y) + 1.5);
    r0.x = asuint(asfloat(r0.x) * asfloat(r4.x));
    r0.x = asuint(asfloat(r0.x) * asfloat(r4.y) + 0.5);
    r2.x = asuint(asfloat(r0.x) * asfloat(r2.x));
    r2.y = asuint(asfloat(r0.x) * asfloat(r2.y));
    r2.z = asuint(asfloat(r0.x) * asfloat(r2.z));
    r0.x = asuint(asfloat(r0.z) * asfloat(r2.x));
    r0.y = asuint(asfloat(r0.z) * asfloat(r2.y));
    r0.z = asuint(asfloat(r0.z) * asfloat(r2.z));
    r0.x = asuint(asfloat(r0.w) * asfloat(r0.x));
    r0.y = asuint(asfloat(r0.w) * asfloat(r0.y));
    r0.z = asuint(asfloat(r0.w) * asfloat(r0.z));
    r1.z = asuint(asfloat(r1.x) * 1.388889);
    r2.y = asuint(-asfloat(r1.z));
    r2.z = asuint(-asfloat(r1.y));
    r2.x = asuint(-asfloat(r1.x) * 1.388889 + -_Dist);
    r1.x = asuint(asfloat(r2.x) + 0.694);
    r1.y = asuint(asfloat(r2.z) + 0.5);
    { float adouacDot = asfloat(r1.x) * asfloat(r1.x) + asfloat(r1.y) * asfloat(r1.y);
        r0.w = asuint(adouacDot);
    }
    r0.w = asuint(sqrt(asfloat(r0.w)));
    r0.w = asuint(asfloat(r0.w) + -_Size);
    r1.x = asuint(1.0 / -_Smooth);
    r0.w = asuint(saturate(asfloat(r0.w) * asfloat(r1.x)));
    r1.y = asuint(asfloat(r0.w) * (-2.0) + 3.0);
    r0.w = asuint(asfloat(r0.w) * asfloat(r0.w));
    r0.w = asuint(-asfloat(r1.y) * asfloat(r0.w) + 1.0);
    r4.x = asuint(_Dist + 0.694);
    r4.y = 0x3f000000u;
    r1.y = asuint(asfloat(r2.y) + asfloat(r4.x));
    r1.z = asuint(asfloat(r2.z) + asfloat(r4.y));
    { float adouacDot = asfloat(r1.y) * asfloat(r1.y) + asfloat(r1.z) * asfloat(r1.z);
        r1.y = asuint(adouacDot);
    }
    r1.y = asuint(sqrt(asfloat(r1.y)));
    r1.y = asuint(asfloat(r1.y) + -_Size);
    r1.x = asuint(saturate(asfloat(r1.x) * asfloat(r1.y)));
    r1.y = asuint(asfloat(r1.x) * (-2.0) + 3.0);
    r1.x = asuint(asfloat(r1.x) * asfloat(r1.x));
    r1.x = asuint(-asfloat(r1.y) * asfloat(r1.x) + 1.0);
    r0.w = asuint(asfloat(r0.w) * asfloat(r1.x));
    r0.x = asuint(asfloat(r0.w) * -asfloat(r0.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r0.w) * -asfloat(r0.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r0.w) * -asfloat(r0.z) + asfloat(r0.z));
    r0.x = asuint(-asfloat(r3.x) + asfloat(r0.x));
    r0.y = asuint(-asfloat(r3.y) + asfloat(r0.y));
    r0.z = asuint(-asfloat(r3.z) + asfloat(r0.z));
    o0.x = asuint(_FadeFX * asfloat(r0.x) + asfloat(r3.x));
    o0.y = asuint(_FadeFX * asfloat(r0.y) + asfloat(r3.y));
    o0.z = asuint(_FadeFX * asfloat(r0.z) + asfloat(r3.z));
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
