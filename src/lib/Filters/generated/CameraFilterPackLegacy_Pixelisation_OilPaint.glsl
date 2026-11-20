precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform vec4 _ScreenResolution;
uniform float _Value;
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
    uvec4 r0 = uvec4(0u), r1 = uvec4(0u), r2 = uvec4(0u), r3 = uvec4(0u), r4 = uvec4(0u), r5 = uvec4(0u), r6 = uvec4(0u), r7 = uvec4(0u), r8 = uvec4(0u);
    uvec4 o0 = uvec4(0u);
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(v0.x), asfloat(v0.y)));
        r0.x = asuint(adouacTex.x);
        r0.y = asuint(adouacTex.y);
        r0.z = asuint(adouacTex.z);
        r0.w = asuint(adouacTex.w);
    }
    r1.x = asuint(_Value / _ScreenResolution.x);
    r1.y = asuint(_Value / _ScreenResolution.y);
    r2.x = asuint(asfloat(r1.x) * 1.0 + asfloat(v0.x));
    r2.y = asuint(asfloat(r1.y) * 0.0 + asfloat(v0.y));
    r2.z = asuint(asfloat(r1.x) * (-2.0) + asfloat(v0.x));
    r2.w = asuint(asfloat(r1.y) * (-2.0) + asfloat(v0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r2.x), asfloat(r2.y)));
        r3.x = asuint(adouacTex.x);
        r3.y = asuint(adouacTex.y);
        r3.z = asuint(adouacTex.z);
        r3.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r2.z), asfloat(r2.w)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    r4.x = asuint(asfloat(r3.x) * asfloat(r3.x));
    r4.y = asuint(asfloat(r3.y) * asfloat(r3.y));
    r4.z = asuint(asfloat(r3.z) * asfloat(r3.z));
    r3.x = asuint(asfloat(r0.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r0.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r0.z) + asfloat(r3.z));
    r0.x = asuint(asfloat(r0.x) * asfloat(r0.x) + asfloat(r4.x));
    r0.y = asuint(asfloat(r0.y) * asfloat(r0.y) + asfloat(r4.y));
    r0.z = asuint(asfloat(r0.z) * asfloat(r0.z) + asfloat(r4.z));
    r4.x = asuint(asfloat(r1.x) * 2.0 + asfloat(v0.x));
    r4.y = asuint(asfloat(r1.y) * 0.0 + asfloat(v0.y));
    r4.z = asuint(asfloat(r1.x) * (-4.0) + asfloat(v0.x));
    r4.w = asuint(asfloat(r1.y) * (-3.0) + asfloat(v0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r4.x), asfloat(r4.y)));
        r5.x = asuint(adouacTex.x);
        r5.y = asuint(adouacTex.y);
        r5.z = asuint(adouacTex.z);
        r5.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r4.z), asfloat(r4.w)));
        r4.x = asuint(adouacTex.x);
        r4.y = asuint(adouacTex.y);
        r4.z = asuint(adouacTex.z);
        r4.w = asuint(adouacTex.w);
    }
    r0.x = asuint(asfloat(r5.x) * asfloat(r5.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r5.y) * asfloat(r5.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r5.z) * asfloat(r5.z) + asfloat(r0.z));
    r3.x = asuint(asfloat(r3.x) + asfloat(r5.x));
    r3.y = asuint(asfloat(r3.y) + asfloat(r5.y));
    r3.z = asuint(asfloat(r3.z) + asfloat(r5.z));
    r5.x = asuint(asfloat(r1.x) * 0.0 + asfloat(v0.x));
    r5.y = asuint(asfloat(r1.y) * 1.0 + asfloat(v0.y));
    r5.z = asuint(asfloat(r1.x) * (-2.0) + asfloat(v0.x));
    r5.w = asuint(asfloat(r1.y) * (-3.0) + asfloat(v0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r5.x), asfloat(r5.y)));
        r6.x = asuint(adouacTex.x);
        r6.y = asuint(adouacTex.y);
        r6.z = asuint(adouacTex.z);
        r6.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r5.z), asfloat(r5.w)));
        r5.x = asuint(adouacTex.x);
        r5.y = asuint(adouacTex.y);
        r5.z = asuint(adouacTex.z);
        r5.w = asuint(adouacTex.w);
    }
    r0.x = asuint(asfloat(r6.x) * asfloat(r6.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r6.y) * asfloat(r6.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r6.z) * asfloat(r6.z) + asfloat(r0.z));
    r3.x = asuint(asfloat(r3.x) + asfloat(r6.x));
    r3.y = asuint(asfloat(r3.y) + asfloat(r6.y));
    r3.z = asuint(asfloat(r3.z) + asfloat(r6.z));
    r1.z = asuint(asfloat(r1.x) + asfloat(v0.x));
    r1.w = asuint(asfloat(r1.y) + asfloat(v0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.z), asfloat(r1.w)));
        r6.x = asuint(adouacTex.x);
        r6.y = asuint(adouacTex.y);
        r6.z = asuint(adouacTex.z);
        r6.w = asuint(adouacTex.w);
    }
    r0.x = asuint(asfloat(r6.x) * asfloat(r6.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r6.y) * asfloat(r6.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r6.z) * asfloat(r6.z) + asfloat(r0.z));
    r3.x = asuint(asfloat(r3.x) + asfloat(r6.x));
    r3.y = asuint(asfloat(r3.y) + asfloat(r6.y));
    r3.z = asuint(asfloat(r3.z) + asfloat(r6.z));
    r6.x = asuint(asfloat(r1.x) * 2.0 + asfloat(v0.x));
    r6.y = asuint(asfloat(r1.y) * 1.0 + asfloat(v0.y));
    r6.z = asuint(asfloat(r1.x) * (-4.0) + asfloat(v0.x));
    r6.w = asuint(asfloat(r1.y) * (-2.0) + asfloat(v0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r6.x), asfloat(r6.y)));
        r7.x = asuint(adouacTex.x);
        r7.y = asuint(adouacTex.y);
        r7.z = asuint(adouacTex.z);
        r7.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r6.z), asfloat(r6.w)));
        r6.x = asuint(adouacTex.x);
        r6.y = asuint(adouacTex.y);
        r6.z = asuint(adouacTex.z);
        r6.w = asuint(adouacTex.w);
    }
    r0.x = asuint(asfloat(r7.x) * asfloat(r7.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r7.y) * asfloat(r7.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r7.z) * asfloat(r7.z) + asfloat(r0.z));
    r3.x = asuint(asfloat(r3.x) + asfloat(r7.x));
    r3.y = asuint(asfloat(r3.y) + asfloat(r7.y));
    r3.z = asuint(asfloat(r3.z) + asfloat(r7.z));
    r7.x = asuint(asfloat(r1.x) * 0.0 + asfloat(v0.x));
    r7.y = asuint(asfloat(r1.y) * 2.0 + asfloat(v0.y));
    r7.z = asuint(asfloat(r1.x) * (-3.0) + asfloat(v0.x));
    r7.w = asuint(asfloat(r1.y) * (-2.0) + asfloat(v0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r7.x), asfloat(r7.y)));
        r8.x = asuint(adouacTex.x);
        r8.y = asuint(adouacTex.y);
        r8.z = asuint(adouacTex.z);
        r8.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r7.z), asfloat(r7.w)));
        r7.x = asuint(adouacTex.x);
        r7.y = asuint(adouacTex.y);
        r7.z = asuint(adouacTex.z);
        r7.w = asuint(adouacTex.w);
    }
    r0.x = asuint(asfloat(r8.x) * asfloat(r8.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r8.y) * asfloat(r8.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r8.z) * asfloat(r8.z) + asfloat(r0.z));
    r3.x = asuint(asfloat(r3.x) + asfloat(r8.x));
    r3.y = asuint(asfloat(r3.y) + asfloat(r8.y));
    r3.z = asuint(asfloat(r3.z) + asfloat(r8.z));
    r1.z = asuint(asfloat(r1.x) * 1.0 + asfloat(v0.x));
    r1.w = asuint(asfloat(r1.y) * 2.0 + asfloat(v0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.z), asfloat(r1.w)));
        r8.x = asuint(adouacTex.x);
        r8.y = asuint(adouacTex.y);
        r8.z = asuint(adouacTex.z);
        r8.w = asuint(adouacTex.w);
    }
    r0.x = asuint(asfloat(r8.x) * asfloat(r8.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r8.y) * asfloat(r8.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r8.z) * asfloat(r8.z) + asfloat(r0.z));
    r3.x = asuint(asfloat(r3.x) + asfloat(r8.x));
    r3.y = asuint(asfloat(r3.y) + asfloat(r8.y));
    r3.z = asuint(asfloat(r3.z) + asfloat(r8.z));
    r1.z = asuint(asfloat(r1.x) * 2.0 + asfloat(v0.x));
    r1.w = asuint(asfloat(r1.y) * 2.0 + asfloat(v0.y));
    r8.x = asuint(asfloat(r1.x) * (-4.0) + asfloat(v0.x));
    r8.y = asuint(asfloat(r1.y) * (-4.0) + asfloat(v0.y));
    r8.z = asuint(asfloat(r1.x) * (-3.0) + asfloat(v0.x));
    r8.w = asuint(asfloat(r1.y) * (-3.0) + asfloat(v0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.z), asfloat(r1.w)));
        r1.x = asuint(adouacTex.x);
        r1.y = asuint(adouacTex.y);
        r1.z = asuint(adouacTex.z);
        r1.w = asuint(adouacTex.w);
    }
    r0.x = asuint(asfloat(r1.x) * asfloat(r1.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r1.y) * asfloat(r1.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r1.z) * asfloat(r1.z) + asfloat(r0.z));
    r1.x = asuint(asfloat(r1.x) + asfloat(r3.x));
    r1.y = asuint(asfloat(r1.y) + asfloat(r3.y));
    r1.z = asuint(asfloat(r1.z) + asfloat(r3.z));
    r1.x = asuint(asfloat(r1.x) * 0.111111);
    r1.y = asuint(asfloat(r1.y) * 0.111111);
    r1.z = asuint(asfloat(r1.z) * 0.111111);
    r3.x = asuint(asfloat(r1.x) * asfloat(r1.x));
    r3.y = asuint(asfloat(r1.y) * asfloat(r1.y));
    r3.z = asuint(asfloat(r1.z) * asfloat(r1.z));
    r0.x = asuint(asfloat(r0.x) * 0.111111 + -asfloat(r3.x));
    r0.y = asuint(asfloat(r0.y) * 0.111111 + -asfloat(r3.y));
    r0.z = asuint(asfloat(r0.z) * 0.111111 + -asfloat(r3.z));
    r0.x = asuint(abs(asfloat(r0.y)) + abs(asfloat(r0.x)));
    r0.x = asuint(abs(asfloat(r0.z)) + asfloat(r0.x));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r8.x), asfloat(r8.y)));
        r3.x = asuint(adouacTex.x);
        r3.y = asuint(adouacTex.y);
        r3.z = asuint(adouacTex.z);
        r3.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r8.z), asfloat(r8.w)));
        r8.x = asuint(adouacTex.x);
        r8.y = asuint(adouacTex.y);
        r8.z = asuint(adouacTex.z);
        r8.w = asuint(adouacTex.w);
    }
    r0.y = asuint(asfloat(r8.x) * asfloat(r8.x));
    r0.z = asuint(asfloat(r8.y) * asfloat(r8.y));
    r0.w = asuint(asfloat(r8.z) * asfloat(r8.z));
    r0.y = asuint(asfloat(r3.x) * asfloat(r3.x) + asfloat(r0.y));
    r0.z = asuint(asfloat(r3.y) * asfloat(r3.y) + asfloat(r0.z));
    r0.w = asuint(asfloat(r3.z) * asfloat(r3.z) + asfloat(r0.w));
    r3.x = asuint(asfloat(r3.x) + asfloat(r8.x));
    r3.y = asuint(asfloat(r3.y) + asfloat(r8.y));
    r3.z = asuint(asfloat(r3.z) + asfloat(r8.z));
    r3.x = asuint(asfloat(r2.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r2.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r2.z) + asfloat(r3.z));
    r0.y = asuint(asfloat(r2.x) * asfloat(r2.x) + asfloat(r0.y));
    r0.z = asuint(asfloat(r2.y) * asfloat(r2.y) + asfloat(r0.z));
    r0.w = asuint(asfloat(r2.z) * asfloat(r2.z) + asfloat(r0.w));
    r0.y = asuint(asfloat(r4.x) * asfloat(r4.x) + asfloat(r0.y));
    r0.z = asuint(asfloat(r4.y) * asfloat(r4.y) + asfloat(r0.z));
    r0.w = asuint(asfloat(r4.z) * asfloat(r4.z) + asfloat(r0.w));
    r2.x = asuint(asfloat(r4.x) + asfloat(r3.x));
    r2.y = asuint(asfloat(r4.y) + asfloat(r3.y));
    r2.z = asuint(asfloat(r4.z) + asfloat(r3.z));
    r2.x = asuint(asfloat(r8.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r8.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r8.z) + asfloat(r2.z));
    r0.y = asuint(asfloat(r8.x) * asfloat(r8.x) + asfloat(r0.y));
    r0.z = asuint(asfloat(r8.y) * asfloat(r8.y) + asfloat(r0.z));
    r0.w = asuint(asfloat(r8.z) * asfloat(r8.z) + asfloat(r0.w));
    r0.y = asuint(asfloat(r5.x) * asfloat(r5.x) + asfloat(r0.y));
    r0.z = asuint(asfloat(r5.y) * asfloat(r5.y) + asfloat(r0.z));
    r0.w = asuint(asfloat(r5.z) * asfloat(r5.z) + asfloat(r0.w));
    r0.y = asuint(asfloat(r6.x) * asfloat(r6.x) + asfloat(r0.y));
    r0.z = asuint(asfloat(r6.y) * asfloat(r6.y) + asfloat(r0.z));
    r0.w = asuint(asfloat(r6.z) * asfloat(r6.z) + asfloat(r0.w));
    r0.y = asuint(asfloat(r7.x) * asfloat(r7.x) + asfloat(r0.y));
    r0.z = asuint(asfloat(r7.y) * asfloat(r7.y) + asfloat(r0.z));
    r0.w = asuint(asfloat(r7.z) * asfloat(r7.z) + asfloat(r0.w));
    r0.y = asuint(asfloat(r5.x) * asfloat(r5.x) + asfloat(r0.y));
    r0.z = asuint(asfloat(r5.y) * asfloat(r5.y) + asfloat(r0.z));
    r0.w = asuint(asfloat(r5.z) * asfloat(r5.z) + asfloat(r0.w));
    r2.x = asuint(asfloat(r5.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r5.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r5.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r6.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r6.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r6.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r7.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r7.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r7.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r5.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r5.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r5.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r2.x) * 0.111111);
    r2.y = asuint(asfloat(r2.y) * 0.111111);
    r2.z = asuint(asfloat(r2.z) * 0.111111);
    r3.x = asuint(asfloat(r2.x) * asfloat(r2.x));
    r3.y = asuint(asfloat(r2.y) * asfloat(r2.y));
    r3.z = asuint(asfloat(r2.z) * asfloat(r2.z));
    r0.y = asuint(asfloat(r0.y) * 0.111111 + -asfloat(r3.x));
    r0.z = asuint(asfloat(r0.z) * 0.111111 + -asfloat(r3.y));
    r0.w = asuint(asfloat(r0.w) * 0.111111 + -asfloat(r3.z));
    r0.y = asuint(abs(asfloat(r0.z)) + abs(asfloat(r0.y)));
    r0.y = asuint(abs(asfloat(r0.w)) + asfloat(r0.y));
    r0.z = asuint(min(asfloat(r0.y), 100.0));
    r0.y = ((asfloat(r0.y) < 100.0) ? 0xffffffffu : 0u);
    r0.x = ((asfloat(r0.x) < asfloat(r0.z)) ? 0xffffffffu : 0u);
    r2.w = 0x3f800000u;
    r2.x = (r0.y & r2.x);
    r2.y = (r0.y & r2.y);
    r2.z = (r0.y & r2.z);
    r2.w = (r0.y & r2.w);
    r1.w = 0x3f800000u;
    o0.x = ((r0.x != 0u) ? r1.x : r2.x);
    o0.y = ((r0.x != 0u) ? r1.y : r2.y);
    o0.z = ((r0.x != 0u) ? r1.z : r2.z);
    o0.w = ((r0.x != 0u) ? r1.w : r2.w);
    return AdouacOutputPs(o0);
}

void main() {
    AdouacVaryings IN;
    IN.pos = gl_FragCoord;
    IN.texcoord0 = vec4(vUv, 0.0, 0.0);
    IN.color0 = vec4(1.0);
    fragColor = frag(IN);
}
