precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

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
    r0.x = asuint(asfloat(v0.y) * 1.0 + 0.0);
    r0.y = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r0.z = asuint(_TimeX * 15.0);
    r1.x = asuint(trunc(asfloat(r0.z)));
    r1.y = 0x3f800000u;
    { float adouacDot = asfloat(r1.x) * 12.9898 + asfloat(r1.y) * 78.233;
        r0.z = asuint(adouacDot);
    }
    r0.z = asuint(sin(asfloat(r0.z)));
    r0.z = asuint(asfloat(r0.z) * 43758.547);
    r2.x = asuint(fract(asfloat(r0.z)));
    r1.z = asuint(asfloat(r1.x) + 23.0);
    r1.w = asuint(asfloat(r1.x) + 8.0);
    { float adouacDot = asfloat(r1.z) * 12.9898 + asfloat(r1.y) * 78.233;
        r0.z = asuint(adouacDot);
    }
    r0.z = asuint(sin(asfloat(r0.z)));
    r0.z = asuint(asfloat(r0.z) * 43758.547);
    r2.y = asuint(fract(asfloat(r0.z)));
    r0.z = asuint(asfloat(r2.x) * 0.002 + asfloat(r0.y));
    r0.w = asuint(asfloat(r2.y) * 0.002 + asfloat(r0.x));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r0.z), asfloat(r0.w)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    { float adouacDot = 0.2126 * asfloat(r2.x) + 0.7152 * asfloat(r2.y) + 0.0722 * asfloat(r2.z);
        r0.z = asuint(adouacDot);
    }
    { float adouacDot = asfloat(r1.w) * 12.9898 + asfloat(r1.y) * 78.233;
        r0.w = asuint(adouacDot);
    }
    r0.w = asuint(sin(asfloat(r0.w)));
    r0.z = asuint(asfloat(r0.z) * 0.7);
    r0.w = asuint(asfloat(r0.w) * 43758.547);
    r0.w = asuint(fract(asfloat(r0.w)));
    r1.z = asuint(-asfloat(r0.y) + 1.0);
    r1.w = asuint(-asfloat(r0.x) + 1.0);
    r1.z = asuint(asfloat(r0.y) * asfloat(r1.z));
    r1.z = asuint(asfloat(r0.x) * asfloat(r1.z));
    r1.z = asuint(asfloat(r1.w) * asfloat(r1.z));
    r1.z = asuint(asfloat(r1.z) * 16.0);
    r1.w = asuint(asfloat(r0.w) + 0.5);
    r1.w = asuint(asfloat(r1.w) * 0.3 + 0.7);
    r2.x = asuint(asfloat(r0.w) * 0.4);
    r2.y = asuint(asfloat(r0.w) * 8.0);
    r1.w = asuint(asfloat(r1.z) * asfloat(r1.w) + asfloat(r2.x));
    r1.w = asuint(asfloat(r1.w) + 1.0);
    r1.z = asuint(log2(asfloat(r1.z)));
    r1.z = asuint(asfloat(r1.z) * 0.4);
    r1.z = asuint(exp2(asfloat(r1.z)));
    r1.z = asuint(asfloat(r1.z) * asfloat(r1.w));
    r1.w = asuint(int(asfloat(r2.y)));
    r2.x = ((0 < asint(r1.w)) ? 0xffffffffu : 0u);
    r2.y = ((1 < asint(r1.w)) ? 0xffffffffu : 0u);
    r3.x = asuint(asfloat(r1.x) + 7.0);
    r3.y = asuint(asfloat(r1.y) + 0.0);
    r3.z = asuint(asfloat(r1.x) + 24.0);
    r3.w = asuint(asfloat(r1.y) + 0.0);
    { float adouacDot = asfloat(r3.x) * 12.9898 + asfloat(r3.y) * 78.233;
        r1.w = asuint(adouacDot);
    }
    r1.w = asuint(sin(asfloat(r1.w)));
    r1.w = asuint(asfloat(r1.w) * 43758.547);
    r3.y = asuint(fract(asfloat(r1.w)));
    r1.w = asuint(asfloat(r3.y) + (-0.5));
    r2.z = ((0.2 < asfloat(r3.y)) ? 0xffffffffu : 0u);
    r4.x = asuint(asfloat(r0.x) * asfloat(r3.y));
    r4.y = asuint(asfloat(r0.y) * asfloat(r3.y));
    r2.w = asuint(asfloat(r4.x) * 0.01 + asfloat(r4.y));
    r1.w = asuint(asfloat(r1.w) + asfloat(r2.w));
    r1.w = asuint(log2(abs(asfloat(r1.w))));
    r1.w = asuint(asfloat(r1.w) * 0.125);
    r1.w = asuint(exp2(asfloat(r1.w)));
    r2.w = asuint(-asfloat(r1.w) + 2.0);
    r1.w = ((r2.z != 0u) ? r1.w : r2.w);
    r1.w = asuint(asfloat(r1.w) * 0.5 + 0.5);
    r1.w = asuint(asfloat(r1.w) * asfloat(r1.z));
    r1.z = ((r2.x != 0u) ? r1.w : r1.z);
    { float adouacDot = asfloat(r3.z) * 12.9898 + asfloat(r3.w) * 78.233;
        r1.w = asuint(adouacDot);
    }
    r1.w = asuint(sin(asfloat(r1.w)));
    r1.w = asuint(asfloat(r1.w) * 43758.547);
    r1.w = asuint(fract(asfloat(r1.w)));
    r2.x = asuint(asfloat(r1.w) + (-0.5));
    r2.z = ((0.2 < asfloat(r1.w)) ? 0xffffffffu : 0u);
    r3.z = asuint(asfloat(r0.x) * asfloat(r1.w));
    r3.w = asuint(asfloat(r0.y) * asfloat(r1.w));
    r1.w = asuint(asfloat(r3.z) * 0.01 + asfloat(r3.w));
    r1.w = asuint(asfloat(r2.x) + asfloat(r1.w));
    r1.w = asuint(log2(abs(asfloat(r1.w))));
    r1.w = asuint(asfloat(r1.w) * 0.125);
    r1.w = asuint(exp2(asfloat(r1.w)));
    r2.x = asuint(-asfloat(r1.w) + 2.0);
    r1.w = ((r2.z != 0u) ? r1.w : r2.x);
    r1.w = asuint(asfloat(r1.w) * 0.5 + 0.5);
    r1.w = asuint(asfloat(r1.w) * asfloat(r1.z));
    r1.z = ((r2.y != 0u) ? r1.w : r1.z);
    r2.x = asuint(asfloat(r1.x) + 18.0);
    r2.y = asuint(asfloat(r1.y) + 0.0);
    { float adouacDot = asfloat(r2.x) * 12.9898 + asfloat(r2.y) * 78.233;
        r1.w = asuint(adouacDot);
    }
    r1.w = asuint(sin(asfloat(r1.w)));
    r1.w = asuint(asfloat(r1.w) * 43758.547);
    r1.w = asuint(fract(asfloat(r1.w)));
    r1.w = asuint(asfloat(r1.w) * 8.0 + (-2.0));
    r1.w = asuint(max(asfloat(r1.w), 0.0));
    r1.w = asuint(int(asfloat(r1.w)));
    r2.x = ((0 < asint(r1.w)) ? 0xffffffffu : 0u);
    r2.y = ((1 < asint(r1.w)) ? 0xffffffffu : 0u);
    if (r2.x != 0u)
    {
        r2.x = asuint(asfloat(r1.x) + 6.0);
        r2.z = asuint(asfloat(r1.y) + 0.0);
        { float adouacDot = asfloat(r2.x) * 12.9898 + asfloat(r2.z) * 78.233;
            r1.w = asuint(adouacDot);
        }
        r1.w = asuint(sin(asfloat(r1.w)));
        r1.w = asuint(asfloat(r1.w) * 43758.547);
        r3.x = asuint(fract(asfloat(r1.w)));
        r1.w = asuint(asfloat(r0.w) * 0.01);
        r2.x = asuint(-asfloat(r0.y) + asfloat(r3.x));
        r2.z = asuint(-asfloat(r0.x) + asfloat(r3.y));
        r2.w = asuint(asfloat(r2.z) / asfloat(r2.x));
        r3.y = asuint(min(abs(asfloat(r2.w)), 1.0));
        r3.z = asuint(max(abs(asfloat(r2.w)), 1.0));
        r3.z = asuint(1.0 / asfloat(r3.z));
        r3.y = asuint(asfloat(r3.z) * asfloat(r3.y));
        r3.z = asuint(asfloat(r3.y) * asfloat(r3.y));
        r3.w = asuint(asfloat(r3.z) * 0.020835 + (-0.085133));
        r3.w = asuint(asfloat(r3.z) * asfloat(r3.w) + 0.180141);
        r3.w = asuint(asfloat(r3.z) * asfloat(r3.w) + (-0.330299));
        r3.z = asuint(asfloat(r3.z) * asfloat(r3.w) + 0.999866);
        r3.w = asuint(asfloat(r3.z) * asfloat(r3.y));
        r4.x = ((1.0 < abs(asfloat(r2.w))) ? 0xffffffffu : 0u);
        r3.w = asuint(asfloat(r3.w) * (-2.0) + 1.570796);
        r3.w = (r4.x & r3.w);
        r3.y = asuint(asfloat(r3.y) * asfloat(r3.z) + asfloat(r3.w));
        r2.w = asuint(min(asfloat(r2.w), 1.0));
        r2.w = ((asfloat(r2.w) < -asfloat(r2.w)) ? 0xffffffffu : 0u);
        r2.w = ((r2.w != 0u) ? asuint(-asfloat(r3.y)) : r3.y);
        r1.w = asuint(asfloat(r1.w) * asfloat(r1.w));
        r2.w = asuint(asfloat(r2.w) * asfloat(r3.x));
        r2.w = asuint(asfloat(r2.w) * 6.2831);
        r2.w = asuint(sin(asfloat(r2.w)));
        r2.w = asuint(asfloat(r2.w) * 0.1 + 1.0);
        r3.x = asuint(asfloat(r1.w) * asfloat(r2.w));
        { float adouacDot = asfloat(r2.x) * asfloat(r2.x) + asfloat(r2.z) * asfloat(r2.z);
            r2.x = asuint(adouacDot);
        }
        r2.z = ((asfloat(r2.x) < asfloat(r3.x)) ? 0xffffffffu : 0u);
        r1.w = asuint(-asfloat(r1.w) * asfloat(r2.w) + asfloat(r2.x));
        r1.w = asuint(log2(asfloat(r1.w)));
        r1.w = asuint(asfloat(r1.w) * 0.0625);
        r1.w = asuint(exp2(asfloat(r1.w)));
        r1.w = ((r2.z != 0u) ? 0x3e4ccccdu : r1.w);
        r0.w = asuint(-asfloat(r0.w) * 0.5 + 1.0);
        r0.w = asuint(asfloat(r0.w) * 0.2 + 0.3);
        r2.x = asuint(-asfloat(r0.w) + 1.0);
        r0.w = asuint(asfloat(r1.w) * asfloat(r2.x) + asfloat(r0.w));
        r1.z = asuint(asfloat(r0.w) * asfloat(r1.z));
    }
    if (r2.y != 0u)
    {
        r2.x = asuint(asfloat(r1.x) + 25.0);
        r2.y = asuint(asfloat(r1.y) + 0.0);
        r2.z = asuint(asfloat(r1.x) + 26.0);
        r2.w = asuint(asfloat(r1.y) + 0.0);
        { float adouacDot = asfloat(r2.x) * 12.9898 + asfloat(r2.y) * 78.233;
            r0.w = asuint(adouacDot);
        }
        r0.w = asuint(sin(asfloat(r0.w)));
        r0.w = asuint(asfloat(r0.w) * 43758.547);
        r2.x = asuint(fract(asfloat(r0.w)));
        { float adouacDot = asfloat(r2.z) * 12.9898 + asfloat(r2.w) * 78.233;
            r0.w = asuint(adouacDot);
        }
        r0.w = asuint(sin(asfloat(r0.w)));
        r0.w = asuint(asfloat(r0.w) * 43758.547);
        r2.y = asuint(fract(asfloat(r0.w)));
        r1.x = asuint(asfloat(r1.x) + 27.0);
        r1.y = asuint(asfloat(r1.y) + 0.0);
        { float adouacDot = asfloat(r1.x) * 12.9898 + asfloat(r1.y) * 78.233;
            r0.w = asuint(adouacDot);
        }
        r0.w = asuint(sin(asfloat(r0.w)));
        r0.w = asuint(asfloat(r0.w) * 43758.547);
        r0.w = asuint(fract(asfloat(r0.w)));
        r1.x = asuint(asfloat(r0.w) * 0.01);
        {
            uvec4 adouacD0 = uvec4(0u);
            adouacD0.x = asuint(-asfloat(r0.y) + asfloat(r2.x));
            adouacD0.y = asuint(-asfloat(r0.x) + asfloat(r2.y));
            r0.x = adouacD0.x;
            r0.y = adouacD0.y;
        }
        r1.y = asuint(asfloat(r0.y) / asfloat(r0.x));
        r1.w = asuint(min(abs(asfloat(r1.y)), 1.0));
        r2.y = asuint(max(abs(asfloat(r1.y)), 1.0));
        r2.y = asuint(1.0 / asfloat(r2.y));
        r1.w = asuint(asfloat(r1.w) * asfloat(r2.y));
        r2.y = asuint(asfloat(r1.w) * asfloat(r1.w));
        r2.z = asuint(asfloat(r2.y) * 0.020835 + (-0.085133));
        r2.z = asuint(asfloat(r2.y) * asfloat(r2.z) + 0.180141);
        r2.z = asuint(asfloat(r2.y) * asfloat(r2.z) + (-0.330299));
        r2.y = asuint(asfloat(r2.y) * asfloat(r2.z) + 0.999866);
        r2.z = asuint(asfloat(r1.w) * asfloat(r2.y));
        r2.w = ((1.0 < abs(asfloat(r1.y))) ? 0xffffffffu : 0u);
        r2.z = asuint(asfloat(r2.z) * (-2.0) + 1.570796);
        r2.z = (r2.w & r2.z);
        r1.w = asuint(asfloat(r1.w) * asfloat(r2.y) + asfloat(r2.z));
        r1.y = asuint(min(asfloat(r1.y), 1.0));
        r1.y = ((asfloat(r1.y) < -asfloat(r1.y)) ? 0xffffffffu : 0u);
        r1.y = ((r1.y != 0u) ? asuint(-asfloat(r1.w)) : r1.w);
        r1.x = asuint(asfloat(r1.x) * asfloat(r1.x));
        r1.y = asuint(asfloat(r1.y) * asfloat(r2.x));
        r1.y = asuint(asfloat(r1.y) * 6.2831);
        r1.y = asuint(sin(asfloat(r1.y)));
        r1.y = asuint(asfloat(r1.y) * 0.1 + 1.0);
        r1.w = asuint(asfloat(r1.y) * asfloat(r1.x));
        { float adouacDot = asfloat(r0.x) * asfloat(r0.x) + asfloat(r0.y) * asfloat(r0.y);
            r0.x = asuint(adouacDot);
        }
        r0.y = ((asfloat(r0.x) < asfloat(r1.w)) ? 0xffffffffu : 0u);
        r0.x = asuint(-asfloat(r1.x) * asfloat(r1.y) + asfloat(r0.x));
        r0.x = asuint(log2(asfloat(r0.x)));
        r0.x = asuint(asfloat(r0.x) * 0.0625);
        r0.x = asuint(exp2(asfloat(r0.x)));
        r0.x = ((r0.y != 0u) ? 0x3e4ccccdu : r0.x);
        r0.y = asuint(-asfloat(r0.w) * 0.5 + 1.0);
        r0.y = asuint(asfloat(r0.y) * 0.2 + 0.3);
        r0.w = asuint(-asfloat(r0.y) + 1.0);
        r0.x = asuint(asfloat(r0.x) * asfloat(r0.w) + asfloat(r0.y));
        r1.z = asuint(asfloat(r0.x) * asfloat(r1.z));
    }
    o0.x = asuint(asfloat(r0.z) * asfloat(r1.z));
    o0.y = asuint(asfloat(r0.z) * asfloat(r1.z));
    o0.z = asuint(asfloat(r0.z) * asfloat(r1.z));
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
