precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform float _Glitch;
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
    r0.x = asuint(_TimeX * 4.0);
    r0.y = asuint(_TimeX * 8.0);
    r0.x = asuint(floor(asfloat(r0.x)));
    r0.y = asuint(floor(asfloat(r0.y)));
    r0.x = asuint(asfloat(r0.x) * 37.5);
    r0.y = asuint(asfloat(r0.y) * 0.125);
    r0.z = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r0.w = asuint(asfloat(v0.y) * 1.0 + 0.0);
    r1.x = asuint(asfloat(r0.w) * 16.0);
    r1.x = asuint(floor(asfloat(r1.x)));
    r0.x = asuint(asfloat(r1.x) * 0.0625 + asfloat(r0.x));
    { float adouacDot = asfloat(r0.y) * 12.9898 + asfloat(r0.y) * 78.233;
        r0.y = asuint(adouacDot);
    }
    r0.y = asuint(sin(asfloat(r0.y)));
    r0.y = asuint(asfloat(r0.y) * 43758.547);
    r0.y = asuint(fract(asfloat(r0.y)));
    r0.y = ((0.99 < asfloat(r0.y)) ? 0xffffffffu : 0u);
    { float adouacDot = asfloat(r0.x) * 12.9898 + asfloat(r0.x) * 78.233;
        r0.x = asuint(adouacDot);
    }
    r0.x = asuint(sin(asfloat(r0.x)));
    r0.x = asuint(asfloat(r0.x) * 43758.547);
    r0.x = asuint(fract(asfloat(r0.x)));
    r0.x = asuint(asfloat(r0.x) * 16.0);
    r1.x = asuint(asfloat(r0.x) * _TimeX);
    r1.x = asuint(floor(asfloat(r1.x)));
    r0.x = asuint(asfloat(r1.x) / asfloat(r0.x));
    r0.x = asuint(asfloat(r0.x) * 5.0 + asfloat(r0.w));
    r1.x = asuint(asfloat(r0.x) * 11.0);
    r1.y = asuint(asfloat(r0.x) * 7.0);
    r1.x = asuint(floor(asfloat(r1.x)));
    r1.y = asuint(floor(asfloat(r1.y)));
    r1.x = asuint(asfloat(r1.x) * 0.090909);
    r1.y = asuint(asfloat(r1.y) * 0.142857);
    { float adouacDot = asfloat(r1.y) * 12.9898 + asfloat(r1.y) * 78.233;
        r0.x = asuint(adouacDot);
    }
    { float adouacDot = asfloat(r1.x) * 12.9898 + asfloat(r1.x) * 78.233;
        r1.x = asuint(adouacDot);
    }
    r1.x = asuint(sin(asfloat(r1.x)));
    r1.x = asuint(asfloat(r1.x) * 43758.547);
    r1.x = asuint(fract(asfloat(r1.x)));
    r0.x = asuint(sin(asfloat(r0.x)));
    r0.x = asuint(asfloat(r0.x) * 43758.547);
    r0.x = asuint(fract(asfloat(r0.x)));
    r0.x = asuint(asfloat(r0.x) * 0.5);
    r0.x = asuint(asfloat(r1.x) * 0.5 + asfloat(r0.x));
    r0.x = asuint(asfloat(r0.x) * 2.0 + (-1.0));
    r1.x = ((0.0 < asfloat(r0.x)) ? 0xffffffffu : 0u);
    r1.y = ((asfloat(r0.x) < 0.0) ? 0xffffffffu : 0u);
    r0.x = asuint(abs(asfloat(r0.x)) + (-0.6));
    r0.x = asuint(asfloat(r0.x) * 2.5);
    r0.x = asuint(max(asfloat(r0.x), 0.0));
    r1.x = asuint((-asint(r1.x)) + asint(r1.y));
    r1.x = asuint(float(asint(r1.x)));
    r0.x = asuint(asfloat(r0.x) * asfloat(r1.x));
    r1.x = asuint(saturate(-_Glitch * asfloat(r0.x) + 0.5));
    r1.y = asuint(asfloat(r0.x) * _Glitch);
    r0.x = asuint(saturate(_Glitch * asfloat(r0.x) + (-0.5)));
    r1.z = asuint(abs(asfloat(r1.y)) * 3.0);
    r2.x = asuint(asfloat(r1.y) * 0.1);
    r2.y = asuint(asfloat(r1.y) * 0.125);
    r1.x = asuint(-asfloat(r1.z) * asfloat(r1.x) + 1.0);
    r2.z = 0x00000000u;
    r3.x = asuint(saturate(asfloat(r0.z) + asfloat(r2.x)));
    r3.y = asuint(saturate(asfloat(r0.w) + asfloat(r2.z)));
    r0.z = asuint(-asfloat(r3.y) + 1.0);
    r3.z = ((r0.y != 0u) ? r0.z : r3.y);
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r3.x), asfloat(r3.z)));
        r3.x = asuint(adouacTex.x);
        r3.y = asuint(adouacTex.y);
        r3.z = asuint(adouacTex.z);
        r3.w = asuint(adouacTex.w);
    }
    { float adouacDot = asfloat(r3.x) * (-0.14713) + asfloat(r3.y) * (-0.28886) + asfloat(r3.z) * 0.436;
        r0.y = asuint(adouacDot);
    }
    r1.x = asuint(asfloat(r0.y) / asfloat(r1.x));
    { float adouacDot = asfloat(r3.x) * 0.615 + asfloat(r3.y) * (-0.51499) + asfloat(r3.z) * (-0.10001);
        r0.y = asuint(adouacDot);
    }
    r1.y = asuint(asfloat(r2.y) * asfloat(r0.x) + asfloat(r0.y));
    { float adouacDot = (-0.39465) * asfloat(r1.x) + (-0.5806) * asfloat(r1.y);
        r0.x = asuint(adouacDot);
    }
    { float adouacDot = asfloat(r3.x) * 0.299 + asfloat(r3.y) * 0.587 + asfloat(r3.z) * 0.114;
        r0.y = asuint(adouacDot);
    }
    o0.w = r3.w;
    o0.y = asuint(asfloat(r0.x) + asfloat(r0.y));
    o0.x = asuint(asfloat(r1.y) * 1.13983 + asfloat(r0.y));
    o0.z = asuint(asfloat(r1.x) * 2.03211 + asfloat(r0.y));
    return AdouacOutputPs(o0);
}

void main() {
    AdouacVaryings IN;
    IN.pos = gl_FragCoord;
    IN.texcoord0 = vec4(vUv, 0.0, 0.0);
    IN.color0 = vec4(1.0);
    fragColor = frag(IN);
}
