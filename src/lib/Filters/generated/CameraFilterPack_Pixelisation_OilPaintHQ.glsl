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
    uvec4 r0 = uvec4(0u), r1 = uvec4(0u), r2 = uvec4(0u), r3 = uvec4(0u), r4 = uvec4(0u), r5 = uvec4(0u), r6 = uvec4(0u), r7 = uvec4(0u), r8 = uvec4(0u), r9 = uvec4(0u), r10 = uvec4(0u), r11 = uvec4(0u), r12 = uvec4(0u), r13 = uvec4(0u), r14 = uvec4(0u), r15 = uvec4(0u), r16 = uvec4(0u), r17 = uvec4(0u), r18 = uvec4(0u), r19 = uvec4(0u), r20 = uvec4(0u), r21 = uvec4(0u), r22 = uvec4(0u), r23 = uvec4(0u), r24 = uvec4(0u);
    uvec4 o0 = uvec4(0u);
    r0.x = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r0.y = asuint(asfloat(v0.y) * 1.0 + 0.0);
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r0.x), asfloat(r0.y)));
        r1.x = asuint(adouacTex.x);
        r1.y = asuint(adouacTex.y);
        r1.z = asuint(adouacTex.z);
        r1.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r1.x) * asfloat(r1.x));
    r2.y = asuint(asfloat(r1.y) * asfloat(r1.y));
    r2.z = asuint(asfloat(r1.z) * asfloat(r1.z));
    r0.z = asuint(_Value / _ScreenResolution.x);
    r0.w = asuint(_Value / _ScreenResolution.y);
    r3.x = asuint(asfloat(r0.z) * 1.0 + asfloat(r0.x));
    r3.y = asuint(asfloat(r0.w) * 0.0 + asfloat(r0.y));
    r3.z = asuint(asfloat(r0.z) * (-2.0) + asfloat(r0.x));
    r3.w = asuint(asfloat(r0.w) * (-2.0) + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r3.x), asfloat(r3.y)));
        r4.x = asuint(adouacTex.x);
        r4.y = asuint(adouacTex.y);
        r4.z = asuint(adouacTex.z);
        r4.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r3.z), asfloat(r3.w)));
        r3.x = asuint(adouacTex.x);
        r3.y = asuint(adouacTex.y);
        r3.z = asuint(adouacTex.z);
        r3.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r4.x) * asfloat(r4.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r4.y) * asfloat(r4.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r4.z) * asfloat(r4.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r1.x) + asfloat(r4.x));
    r4.y = asuint(asfloat(r1.y) + asfloat(r4.y));
    r4.z = asuint(asfloat(r1.z) + asfloat(r4.z));
    r5.x = asuint(asfloat(r0.z) * 2.0 + asfloat(r0.x));
    r5.y = asuint(asfloat(r0.w) * 0.0 + asfloat(r0.y));
    r5.z = asuint(asfloat(r0.z) * (-1.0) + asfloat(r0.x));
    r5.w = asuint(asfloat(r0.w) * (-4.0) + asfloat(r0.y));
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
    r2.x = asuint(asfloat(r6.x) * asfloat(r6.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r6.y) * asfloat(r6.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r6.z) * asfloat(r6.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r6.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r6.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r6.z));
    r6.x = asuint(asfloat(r0.z) * 3.0 + asfloat(r0.x));
    r6.y = asuint(asfloat(r0.w) * 0.0 + asfloat(r0.y));
    r6.z = asuint(asfloat(r0.z) * 0.0 + asfloat(r0.x));
    r6.w = asuint(asfloat(r0.w) * (-4.0) + asfloat(r0.y));
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
    r2.x = asuint(asfloat(r7.x) * asfloat(r7.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r7.y) * asfloat(r7.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r7.z) * asfloat(r7.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r7.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r7.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r7.z));
    r7.x = asuint(asfloat(r0.z) * 4.0 + asfloat(r0.x));
    r7.y = asuint(asfloat(r0.w) * 0.0 + asfloat(r0.y));
    r7.z = asuint(asfloat(r0.z) * (-4.0) + asfloat(r0.x));
    r7.w = asuint(asfloat(r0.w) * (-3.0) + asfloat(r0.y));
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
    r2.x = asuint(asfloat(r8.x) * asfloat(r8.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r8.y) * asfloat(r8.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r8.z) * asfloat(r8.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r8.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r8.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r8.z));
    r8.x = asuint(asfloat(r0.z) * 0.0 + asfloat(r0.x));
    r8.y = asuint(asfloat(r0.w) * 1.0 + asfloat(r0.y));
    r8.z = asuint(asfloat(r0.z) * (-2.0) + asfloat(r0.x));
    r8.w = asuint(asfloat(r0.w) * (-3.0) + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r8.x), asfloat(r8.y)));
        r9.x = asuint(adouacTex.x);
        r9.y = asuint(adouacTex.y);
        r9.z = asuint(adouacTex.z);
        r9.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r8.z), asfloat(r8.w)));
        r8.x = asuint(adouacTex.x);
        r8.y = asuint(adouacTex.y);
        r8.z = asuint(adouacTex.z);
        r8.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r9.x) * asfloat(r9.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r9.y) * asfloat(r9.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r9.z) * asfloat(r9.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r9.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r9.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r9.z));
    r9.x = asuint(asfloat(r0.z) + asfloat(r0.x));
    r9.y = asuint(asfloat(r0.w) + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r9.x), asfloat(r9.y)));
        r9.x = asuint(adouacTex.x);
        r9.y = asuint(adouacTex.y);
        r9.z = asuint(adouacTex.z);
        r9.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r9.x) * asfloat(r9.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r9.y) * asfloat(r9.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r9.z) * asfloat(r9.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r9.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r9.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r9.z));
    r9.x = asuint(asfloat(r0.z) * 2.0 + asfloat(r0.x));
    r9.y = asuint(asfloat(r0.w) * 1.0 + asfloat(r0.y));
    r9.z = asuint(asfloat(r0.z) * (-1.0) + asfloat(r0.x));
    r9.w = asuint(asfloat(r0.w) * (-3.0) + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r9.x), asfloat(r9.y)));
        r10.x = asuint(adouacTex.x);
        r10.y = asuint(adouacTex.y);
        r10.z = asuint(adouacTex.z);
        r10.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r9.z), asfloat(r9.w)));
        r9.x = asuint(adouacTex.x);
        r9.y = asuint(adouacTex.y);
        r9.z = asuint(adouacTex.z);
        r9.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r10.x) * asfloat(r10.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r10.y) * asfloat(r10.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r10.z) * asfloat(r10.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r10.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r10.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r10.z));
    r10.x = asuint(asfloat(r0.z) * 3.0 + asfloat(r0.x));
    r10.y = asuint(asfloat(r0.w) * 1.0 + asfloat(r0.y));
    r10.z = asuint(asfloat(r0.z) * 0.0 + asfloat(r0.x));
    r10.w = asuint(asfloat(r0.w) * (-3.0) + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r10.x), asfloat(r10.y)));
        r11.x = asuint(adouacTex.x);
        r11.y = asuint(adouacTex.y);
        r11.z = asuint(adouacTex.z);
        r11.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r10.z), asfloat(r10.w)));
        r10.x = asuint(adouacTex.x);
        r10.y = asuint(adouacTex.y);
        r10.z = asuint(adouacTex.z);
        r10.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r11.x) * asfloat(r11.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r11.y) * asfloat(r11.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r11.z) * asfloat(r11.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r11.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r11.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r11.z));
    r11.x = asuint(asfloat(r0.z) * 4.0 + asfloat(r0.x));
    r11.y = asuint(asfloat(r0.w) * 1.0 + asfloat(r0.y));
    r11.z = asuint(asfloat(r0.z) * (-4.0) + asfloat(r0.x));
    r11.w = asuint(asfloat(r0.w) * (-2.0) + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r11.x), asfloat(r11.y)));
        r12.x = asuint(adouacTex.x);
        r12.y = asuint(adouacTex.y);
        r12.z = asuint(adouacTex.z);
        r12.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r11.z), asfloat(r11.w)));
        r11.x = asuint(adouacTex.x);
        r11.y = asuint(adouacTex.y);
        r11.z = asuint(adouacTex.z);
        r11.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r12.x) * asfloat(r12.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r12.y) * asfloat(r12.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r12.z) * asfloat(r12.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r12.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r12.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r12.z));
    r12.x = asuint(asfloat(r0.z) * 0.0 + asfloat(r0.x));
    r12.y = asuint(asfloat(r0.w) * 2.0 + asfloat(r0.y));
    r12.z = asuint(asfloat(r0.z) * (-3.0) + asfloat(r0.x));
    r12.w = asuint(asfloat(r0.w) * (-2.0) + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r12.x), asfloat(r12.y)));
        r13.x = asuint(adouacTex.x);
        r13.y = asuint(adouacTex.y);
        r13.z = asuint(adouacTex.z);
        r13.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r12.z), asfloat(r12.w)));
        r12.x = asuint(adouacTex.x);
        r12.y = asuint(adouacTex.y);
        r12.z = asuint(adouacTex.z);
        r12.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r13.x) * asfloat(r13.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r13.y) * asfloat(r13.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r13.z) * asfloat(r13.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r13.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r13.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r13.z));
    r13.x = asuint(asfloat(r0.z) * 1.0 + asfloat(r0.x));
    r13.y = asuint(asfloat(r0.w) * 2.0 + asfloat(r0.y));
    r13.z = asuint(asfloat(r0.z) * (-1.0) + asfloat(r0.x));
    r13.w = asuint(asfloat(r0.w) * (-2.0) + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r13.x), asfloat(r13.y)));
        r14.x = asuint(adouacTex.x);
        r14.y = asuint(adouacTex.y);
        r14.z = asuint(adouacTex.z);
        r14.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r13.z), asfloat(r13.w)));
        r13.x = asuint(adouacTex.x);
        r13.y = asuint(adouacTex.y);
        r13.z = asuint(adouacTex.z);
        r13.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r14.x) * asfloat(r14.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r14.y) * asfloat(r14.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r14.z) * asfloat(r14.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r14.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r14.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r14.z));
    r14.x = asuint(asfloat(r0.z) * 2.0 + asfloat(r0.x));
    r14.y = asuint(asfloat(r0.w) * 2.0 + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r14.x), asfloat(r14.y)));
        r14.x = asuint(adouacTex.x);
        r14.y = asuint(adouacTex.y);
        r14.z = asuint(adouacTex.z);
        r14.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r14.x) * asfloat(r14.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r14.y) * asfloat(r14.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r14.z) * asfloat(r14.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r14.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r14.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r14.z));
    r14.x = asuint(asfloat(r0.z) * 3.0 + asfloat(r0.x));
    r14.y = asuint(asfloat(r0.w) * 2.0 + asfloat(r0.y));
    r14.z = asuint(asfloat(r0.z) * 0.0 + asfloat(r0.x));
    r14.w = asuint(asfloat(r0.w) * (-2.0) + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r14.x), asfloat(r14.y)));
        r15.x = asuint(adouacTex.x);
        r15.y = asuint(adouacTex.y);
        r15.z = asuint(adouacTex.z);
        r15.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r14.z), asfloat(r14.w)));
        r14.x = asuint(adouacTex.x);
        r14.y = asuint(adouacTex.y);
        r14.z = asuint(adouacTex.z);
        r14.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r15.x) * asfloat(r15.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r15.y) * asfloat(r15.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r15.z) * asfloat(r15.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r15.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r15.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r15.z));
    r15.x = asuint(asfloat(r0.z) * 4.0 + asfloat(r0.x));
    r15.y = asuint(asfloat(r0.w) * 2.0 + asfloat(r0.y));
    r15.z = asuint(asfloat(r0.z) * (-4.0) + asfloat(r0.x));
    r15.w = asuint(asfloat(r0.w) * (-1.0) + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r15.x), asfloat(r15.y)));
        r16.x = asuint(adouacTex.x);
        r16.y = asuint(adouacTex.y);
        r16.z = asuint(adouacTex.z);
        r16.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r15.z), asfloat(r15.w)));
        r15.x = asuint(adouacTex.x);
        r15.y = asuint(adouacTex.y);
        r15.z = asuint(adouacTex.z);
        r15.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r16.x) * asfloat(r16.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r16.y) * asfloat(r16.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r16.z) * asfloat(r16.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r16.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r16.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r16.z));
    r16.x = asuint(asfloat(r0.z) * 0.0 + asfloat(r0.x));
    r16.y = asuint(asfloat(r0.w) * 3.0 + asfloat(r0.y));
    r16.z = asuint(asfloat(r0.z) * (-3.0) + asfloat(r0.x));
    r16.w = asuint(asfloat(r0.w) * (-1.0) + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r16.x), asfloat(r16.y)));
        r17.x = asuint(adouacTex.x);
        r17.y = asuint(adouacTex.y);
        r17.z = asuint(adouacTex.z);
        r17.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r16.z), asfloat(r16.w)));
        r16.x = asuint(adouacTex.x);
        r16.y = asuint(adouacTex.y);
        r16.z = asuint(adouacTex.z);
        r16.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r17.x) * asfloat(r17.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r17.y) * asfloat(r17.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r17.z) * asfloat(r17.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r17.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r17.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r17.z));
    r17.x = asuint(asfloat(r0.z) * 1.0 + asfloat(r0.x));
    r17.y = asuint(asfloat(r0.w) * 3.0 + asfloat(r0.y));
    r17.z = asuint(asfloat(r0.z) * (-2.0) + asfloat(r0.x));
    r17.w = asuint(asfloat(r0.w) * (-1.0) + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r17.x), asfloat(r17.y)));
        r18.x = asuint(adouacTex.x);
        r18.y = asuint(adouacTex.y);
        r18.z = asuint(adouacTex.z);
        r18.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r17.z), asfloat(r17.w)));
        r17.x = asuint(adouacTex.x);
        r17.y = asuint(adouacTex.y);
        r17.z = asuint(adouacTex.z);
        r17.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r18.x) * asfloat(r18.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r18.y) * asfloat(r18.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r18.z) * asfloat(r18.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r18.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r18.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r18.z));
    r18.x = asuint(asfloat(r0.z) * 2.0 + asfloat(r0.x));
    r18.y = asuint(asfloat(r0.w) * 3.0 + asfloat(r0.y));
    r18.z = asuint(asfloat(r0.z) * 3.0 + asfloat(r0.x));
    r18.w = asuint(asfloat(r0.w) * 3.0 + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r18.x), asfloat(r18.y)));
        r19.x = asuint(adouacTex.x);
        r19.y = asuint(adouacTex.y);
        r19.z = asuint(adouacTex.z);
        r19.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r18.z), asfloat(r18.w)));
        r18.x = asuint(adouacTex.x);
        r18.y = asuint(adouacTex.y);
        r18.z = asuint(adouacTex.z);
        r18.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r19.x) * asfloat(r19.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r19.y) * asfloat(r19.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r19.z) * asfloat(r19.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r19.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r19.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r19.z));
    r4.x = asuint(asfloat(r18.x) + asfloat(r4.x));
    r4.y = asuint(asfloat(r18.y) + asfloat(r4.y));
    r4.z = asuint(asfloat(r18.z) + asfloat(r4.z));
    r2.x = asuint(asfloat(r18.x) * asfloat(r18.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r18.y) * asfloat(r18.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r18.z) * asfloat(r18.z) + asfloat(r2.z));
    r18.x = asuint(asfloat(r0.z) * 0.0 + asfloat(r0.x));
    r18.y = asuint(asfloat(r0.w) * (-1.0) + asfloat(r0.y));
    r18.z = asuint(asfloat(r0.z) * 4.0 + asfloat(r0.x));
    r18.w = asuint(asfloat(r0.w) * 3.0 + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r18.z), asfloat(r18.w)));
        r19.x = asuint(adouacTex.x);
        r19.y = asuint(adouacTex.y);
        r19.z = asuint(adouacTex.z);
        r19.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r18.x), asfloat(r18.y)));
        r18.x = asuint(adouacTex.x);
        r18.y = asuint(adouacTex.y);
        r18.z = asuint(adouacTex.z);
        r18.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r19.x) * asfloat(r19.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r19.y) * asfloat(r19.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r19.z) * asfloat(r19.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r19.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r19.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r19.z));
    r19.x = asuint(asfloat(r0.z) * (-4.0) + asfloat(r0.x));
    r19.y = asuint(asfloat(r0.w) * 0.0 + asfloat(r0.y));
    r19.z = asuint(asfloat(r0.z) * 0.0 + asfloat(r0.x));
    r19.w = asuint(asfloat(r0.w) * 4.0 + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r19.z), asfloat(r19.w)));
        r20.x = asuint(adouacTex.x);
        r20.y = asuint(adouacTex.y);
        r20.z = asuint(adouacTex.z);
        r20.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r19.x), asfloat(r19.y)));
        r19.x = asuint(adouacTex.x);
        r19.y = asuint(adouacTex.y);
        r19.z = asuint(adouacTex.z);
        r19.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r20.x) * asfloat(r20.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r20.y) * asfloat(r20.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r20.z) * asfloat(r20.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r20.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r20.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r20.z));
    r20.x = asuint(asfloat(r0.z) * (-3.0) + asfloat(r0.x));
    r20.y = asuint(asfloat(r0.w) * 0.0 + asfloat(r0.y));
    r20.z = asuint(asfloat(r0.z) * 1.0 + asfloat(r0.x));
    r20.w = asuint(asfloat(r0.w) * 4.0 + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r20.z), asfloat(r20.w)));
        r21.x = asuint(adouacTex.x);
        r21.y = asuint(adouacTex.y);
        r21.z = asuint(adouacTex.z);
        r21.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r20.x), asfloat(r20.y)));
        r20.x = asuint(adouacTex.x);
        r20.y = asuint(adouacTex.y);
        r20.z = asuint(adouacTex.z);
        r20.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r21.x) * asfloat(r21.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r21.y) * asfloat(r21.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r21.z) * asfloat(r21.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r21.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r21.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r21.z));
    r21.x = asuint(asfloat(r0.z) * (-2.0) + asfloat(r0.x));
    r21.y = asuint(asfloat(r0.w) * 0.0 + asfloat(r0.y));
    r21.z = asuint(asfloat(r0.z) * 2.0 + asfloat(r0.x));
    r21.w = asuint(asfloat(r0.w) * 4.0 + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r21.z), asfloat(r21.w)));
        r22.x = asuint(adouacTex.x);
        r22.y = asuint(adouacTex.y);
        r22.z = asuint(adouacTex.z);
        r22.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r21.x), asfloat(r21.y)));
        r21.x = asuint(adouacTex.x);
        r21.y = asuint(adouacTex.y);
        r21.z = asuint(adouacTex.z);
        r21.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r22.x) * asfloat(r22.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r22.y) * asfloat(r22.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r22.z) * asfloat(r22.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r22.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r22.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r22.z));
    r22.x = asuint(asfloat(r0.z) * (-1.0) + asfloat(r0.x));
    r22.y = asuint(asfloat(r0.w) * 0.0 + asfloat(r0.y));
    r22.z = asuint(asfloat(r0.z) * 3.0 + asfloat(r0.x));
    r22.w = asuint(asfloat(r0.w) * 4.0 + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r22.z), asfloat(r22.w)));
        r23.x = asuint(adouacTex.x);
        r23.y = asuint(adouacTex.y);
        r23.z = asuint(adouacTex.z);
        r23.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r22.x), asfloat(r22.y)));
        r22.x = asuint(adouacTex.x);
        r22.y = asuint(adouacTex.y);
        r22.z = asuint(adouacTex.z);
        r22.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r23.x) * asfloat(r23.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r23.y) * asfloat(r23.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r23.z) * asfloat(r23.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r23.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r23.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r23.z));
    r23.x = asuint(asfloat(r0.z) * 4.0 + asfloat(r0.x));
    r23.y = asuint(asfloat(r0.w) * 4.0 + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r23.x), asfloat(r23.y)));
        r23.x = asuint(adouacTex.x);
        r23.y = asuint(adouacTex.y);
        r23.z = asuint(adouacTex.z);
        r23.w = asuint(adouacTex.w);
    }
    r2.x = asuint(asfloat(r23.x) * asfloat(r23.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r23.y) * asfloat(r23.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r23.z) * asfloat(r23.z) + asfloat(r2.z));
    r4.x = asuint(asfloat(r4.x) + asfloat(r23.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r23.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r23.z));
    r4.x = asuint(asfloat(r4.x) * 0.04);
    r4.y = asuint(asfloat(r4.y) * 0.04);
    r4.z = asuint(asfloat(r4.z) * 0.04);
    r23.x = asuint(asfloat(r4.x) * asfloat(r4.x));
    r23.y = asuint(asfloat(r4.y) * asfloat(r4.y));
    r23.z = asuint(asfloat(r4.z) * asfloat(r4.z));
    r2.x = asuint(asfloat(r2.x) * 0.04 + -asfloat(r23.x));
    r2.y = asuint(asfloat(r2.y) * 0.04 + -asfloat(r23.y));
    r2.z = asuint(asfloat(r2.z) * 0.04 + -asfloat(r23.z));
    r1.w = asuint(abs(asfloat(r2.y)) + abs(asfloat(r2.x)));
    r1.w = asuint(abs(asfloat(r2.z)) + asfloat(r1.w));
    r2.x = asuint(asfloat(r0.z) * (-4.0) + asfloat(r0.x));
    r2.y = asuint(asfloat(r0.w) * (-4.0) + asfloat(r0.y));
    r2.z = asuint(asfloat(r0.z) * (-3.0) + asfloat(r0.x));
    r2.w = asuint(asfloat(r0.w) * (-3.0) + asfloat(r0.y));
    r0.x = asuint(-asfloat(r0.z) + asfloat(r0.x));
    r0.y = asuint(-asfloat(r0.w) + asfloat(r0.y));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r0.x), asfloat(r0.y)));
        r0.x = asuint(adouacTex.x);
        r0.y = asuint(adouacTex.y);
        r0.z = asuint(adouacTex.z);
        r0.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r2.x), asfloat(r2.y)));
        r23.x = asuint(adouacTex.x);
        r23.y = asuint(adouacTex.y);
        r23.z = asuint(adouacTex.z);
        r23.w = asuint(adouacTex.w);
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r2.z), asfloat(r2.w)));
        r2.x = asuint(adouacTex.x);
        r2.y = asuint(adouacTex.y);
        r2.z = asuint(adouacTex.z);
        r2.w = asuint(adouacTex.w);
    }
    r24.x = asuint(asfloat(r2.x) * asfloat(r2.x));
    r24.y = asuint(asfloat(r2.y) * asfloat(r2.y));
    r24.z = asuint(asfloat(r2.z) * asfloat(r2.z));
    r24.x = asuint(asfloat(r23.x) * asfloat(r23.x) + asfloat(r24.x));
    r24.y = asuint(asfloat(r23.y) * asfloat(r23.y) + asfloat(r24.y));
    r24.z = asuint(asfloat(r23.z) * asfloat(r23.z) + asfloat(r24.z));
    r23.x = asuint(asfloat(r2.x) + asfloat(r23.x));
    r23.y = asuint(asfloat(r2.y) + asfloat(r23.y));
    r23.z = asuint(asfloat(r2.z) + asfloat(r23.z));
    r23.x = asuint(asfloat(r3.x) + asfloat(r23.x));
    r23.y = asuint(asfloat(r3.y) + asfloat(r23.y));
    r23.z = asuint(asfloat(r3.z) + asfloat(r23.z));
    r3.x = asuint(asfloat(r3.x) * asfloat(r3.x) + asfloat(r24.x));
    r3.y = asuint(asfloat(r3.y) * asfloat(r3.y) + asfloat(r24.y));
    r3.z = asuint(asfloat(r3.z) * asfloat(r3.z) + asfloat(r24.z));
    r3.x = asuint(asfloat(r5.x) * asfloat(r5.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r5.y) * asfloat(r5.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r5.z) * asfloat(r5.z) + asfloat(r3.z));
    r5.x = asuint(asfloat(r5.x) + asfloat(r23.x));
    r5.y = asuint(asfloat(r5.y) + asfloat(r23.y));
    r5.z = asuint(asfloat(r5.z) + asfloat(r23.z));
    r5.x = asuint(asfloat(r6.x) + asfloat(r5.x));
    r5.y = asuint(asfloat(r6.y) + asfloat(r5.y));
    r5.z = asuint(asfloat(r6.z) + asfloat(r5.z));
    r3.x = asuint(asfloat(r6.x) * asfloat(r6.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r6.y) * asfloat(r6.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r6.z) * asfloat(r6.z) + asfloat(r3.z));
    r3.x = asuint(asfloat(r7.x) * asfloat(r7.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r7.y) * asfloat(r7.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r7.z) * asfloat(r7.z) + asfloat(r3.z));
    r5.x = asuint(asfloat(r7.x) + asfloat(r5.x));
    r5.y = asuint(asfloat(r7.y) + asfloat(r5.y));
    r5.z = asuint(asfloat(r7.z) + asfloat(r5.z));
    r5.x = asuint(asfloat(r2.x) + asfloat(r5.x));
    r5.y = asuint(asfloat(r2.y) + asfloat(r5.y));
    r5.z = asuint(asfloat(r2.z) + asfloat(r5.z));
    r2.x = asuint(asfloat(r2.x) * asfloat(r2.x) + asfloat(r3.x));
    r2.y = asuint(asfloat(r2.y) * asfloat(r2.y) + asfloat(r3.y));
    r2.z = asuint(asfloat(r2.z) * asfloat(r2.z) + asfloat(r3.z));
    r2.x = asuint(asfloat(r8.x) * asfloat(r8.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r8.y) * asfloat(r8.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r8.z) * asfloat(r8.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r9.x) * asfloat(r9.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r9.y) * asfloat(r9.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r9.z) * asfloat(r9.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r10.x) * asfloat(r10.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r10.y) * asfloat(r10.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r10.z) * asfloat(r10.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r11.x) * asfloat(r11.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r11.y) * asfloat(r11.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r11.z) * asfloat(r11.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r12.x) * asfloat(r12.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r12.y) * asfloat(r12.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r12.z) * asfloat(r12.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r8.x) * asfloat(r8.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r8.y) * asfloat(r8.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r8.z) * asfloat(r8.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r13.x) * asfloat(r13.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r13.y) * asfloat(r13.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r13.z) * asfloat(r13.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r14.x) * asfloat(r14.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r14.y) * asfloat(r14.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r14.z) * asfloat(r14.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r15.x) * asfloat(r15.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r15.y) * asfloat(r15.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r15.z) * asfloat(r15.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r16.x) * asfloat(r16.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r16.y) * asfloat(r16.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r16.z) * asfloat(r16.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r17.x) * asfloat(r17.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r17.y) * asfloat(r17.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r17.z) * asfloat(r17.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r0.x) * asfloat(r0.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r0.y) * asfloat(r0.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r0.z) * asfloat(r0.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r18.x) * asfloat(r18.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r18.y) * asfloat(r18.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r18.z) * asfloat(r18.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r19.x) * asfloat(r19.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r19.y) * asfloat(r19.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r19.z) * asfloat(r19.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r20.x) * asfloat(r20.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r20.y) * asfloat(r20.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r20.z) * asfloat(r20.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r21.x) * asfloat(r21.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r21.y) * asfloat(r21.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r21.z) * asfloat(r21.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r22.x) * asfloat(r22.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r22.y) * asfloat(r22.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r22.z) * asfloat(r22.z) + asfloat(r2.z));
    r2.x = asuint(asfloat(r1.x) * asfloat(r1.x) + asfloat(r2.x));
    r2.y = asuint(asfloat(r1.y) * asfloat(r1.y) + asfloat(r2.y));
    r2.z = asuint(asfloat(r1.z) * asfloat(r1.z) + asfloat(r2.z));
    r3.x = asuint(asfloat(r8.x) + asfloat(r5.x));
    r3.y = asuint(asfloat(r8.y) + asfloat(r5.y));
    r3.z = asuint(asfloat(r8.z) + asfloat(r5.z));
    r3.x = asuint(asfloat(r9.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r9.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r9.z) + asfloat(r3.z));
    r3.x = asuint(asfloat(r10.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r10.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r10.z) + asfloat(r3.z));
    r3.x = asuint(asfloat(r11.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r11.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r11.z) + asfloat(r3.z));
    r3.x = asuint(asfloat(r12.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r12.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r12.z) + asfloat(r3.z));
    r3.x = asuint(asfloat(r8.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r8.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r8.z) + asfloat(r3.z));
    r3.x = asuint(asfloat(r13.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r13.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r13.z) + asfloat(r3.z));
    r3.x = asuint(asfloat(r14.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r14.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r14.z) + asfloat(r3.z));
    r3.x = asuint(asfloat(r15.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r15.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r15.z) + asfloat(r3.z));
    r3.x = asuint(asfloat(r16.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r16.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r16.z) + asfloat(r3.z));
    r3.x = asuint(asfloat(r17.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r17.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r17.z) + asfloat(r3.z));
    r0.x = asuint(asfloat(r0.x) + asfloat(r3.x));
    r0.y = asuint(asfloat(r0.y) + asfloat(r3.y));
    r0.z = asuint(asfloat(r0.z) + asfloat(r3.z));
    r0.x = asuint(asfloat(r18.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r18.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r18.z) + asfloat(r0.z));
    r0.x = asuint(asfloat(r19.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r19.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r19.z) + asfloat(r0.z));
    r0.x = asuint(asfloat(r20.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r20.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r20.z) + asfloat(r0.z));
    r0.x = asuint(asfloat(r21.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r21.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r21.z) + asfloat(r0.z));
    r0.x = asuint(asfloat(r22.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r22.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r22.z) + asfloat(r0.z));
    r0.x = asuint(asfloat(r1.x) + asfloat(r0.x));
    r0.y = asuint(asfloat(r1.y) + asfloat(r0.y));
    r0.z = asuint(asfloat(r1.z) + asfloat(r0.z));
    r0.x = asuint(asfloat(r0.x) * 0.04);
    r0.y = asuint(asfloat(r0.y) * 0.04);
    r0.z = asuint(asfloat(r0.z) * 0.04);
    r1.x = asuint(asfloat(r0.x) * asfloat(r0.x));
    r1.y = asuint(asfloat(r0.y) * asfloat(r0.y));
    r1.z = asuint(asfloat(r0.z) * asfloat(r0.z));
    r1.x = asuint(asfloat(r2.x) * 0.04 + -asfloat(r1.x));
    r1.y = asuint(asfloat(r2.y) * 0.04 + -asfloat(r1.y));
    r1.z = asuint(asfloat(r2.z) * 0.04 + -asfloat(r1.z));
    r1.x = asuint(abs(asfloat(r1.y)) + abs(asfloat(r1.x)));
    r1.x = asuint(abs(asfloat(r1.z)) + asfloat(r1.x));
    r1.y = asuint(min(asfloat(r1.x), 100.0));
    r1.x = ((asfloat(r1.x) < 100.0) ? 0xffffffffu : 0u);
    r1.y = ((asfloat(r1.w) < asfloat(r1.y)) ? 0xffffffffu : 0u);
    r0.w = 0x3f800000u;
    r0.x = (r0.x & r1.x);
    r0.y = (r0.y & r1.x);
    r0.z = (r0.z & r1.x);
    r0.w = (r0.w & r1.x);
    r4.w = 0x3f800000u;
    o0.x = ((r1.y != 0u) ? r4.x : r0.x);
    o0.y = ((r1.y != 0u) ? r4.y : r0.y);
    o0.z = ((r1.y != 0u) ? r4.z : r0.z);
    o0.w = ((r1.y != 0u) ? r4.w : r0.w);
    return AdouacOutputPs(o0);
}

void main() {
    AdouacVaryings IN;
    IN.pos = gl_FragCoord;
    IN.texcoord0 = vec4(vUv, 0.0, 0.0);
    IN.color0 = vec4(1.0);
    fragColor = frag(IN);
}
