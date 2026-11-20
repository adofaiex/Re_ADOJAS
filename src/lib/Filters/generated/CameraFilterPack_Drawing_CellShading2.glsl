precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform float _ColorLevel;
uniform float _Distortion;
uniform float _EdgeSize;
uniform vec4 _ScreenResolution;
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
    uvec4 r0 = uvec4(0u), r1 = uvec4(0u), r2 = uvec4(0u), r3 = uvec4(0u), r4 = uvec4(0u), r5 = uvec4(0u), r6 = uvec4(0u), r7 = uvec4(0u), r8 = uvec4(0u), r9 = uvec4(0u), r10 = uvec4(0u), r11 = uvec4(0u), r12 = uvec4(0u), r13 = uvec4(0u), r14 = uvec4(0u), r15 = uvec4(0u);
    uvec4 o0 = uvec4(0u);
    uvec4 x0[6];
     for (int adouacK0 = 0; adouacK0 < 6; adouacK0++) x0[adouacK0] = uvec4(0u);
    r0.x = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r0.y = asuint(asfloat(v0.y) * 1.0 + 0.0);
    r0.z = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r0.w = asuint(asfloat(v0.y) * 1.0 + 0.0);
    x0[5].x = 0x00000000u;
    x0[2].x = 0x3ecccccdu;
    x0[1].x = 0x3ecccccdu;
    x0[3].x = 0x3ecccccdu;
    x0[0].x = 0x3ecccccdu;
    x0[4].x = 0x3ecccccdu;
    r1.x = asuint(asfloat(r0.z) * _ScreenResolution.x);
    r1.y = asuint(asfloat(r0.w) * _ScreenResolution.y);
    r2.x = 0x00000000u;
    r2.y = 0x00000000u;
    r2.z = 0x00000000u;
    r1.z = 0xfffffffeu;
     while (true)
    {
        r1.w = ((2 < asint(r1.z)) ? 0xffffffffu : 0u);
        if (r1.w != 0u) break;
        r3.x = asuint(asint(r1.z) + 2);
        r3.y = asuint(asint(r1.z) + 1);
        r1.w = x0[r3.x].x;
        r2.w = asuint(float(asint(r1.z)));
        { float adouacDot = asfloat(r2.w) * _Distortion + asfloat(r2.w) * _Distortion;
            r4.x = asuint(adouacDot);
        }
        r3.x = r2.x;
        r3.z = r2.y;
        r3.w = r2.z;
        r2.w = 0xfffffffeu;
         while (true)
        {
            r4.z = ((2 < asint(r2.w)) ? 0xffffffffu : 0u);
            if (r4.z != 0u) break;
            r4.z = asuint(asint(r2.w) + 2);
            r4.w = asuint(asint(r2.w) + 1);
            r4.z = x0[r4.z].x;
            r4.z = asuint(asfloat(r1.w) * asfloat(r4.z));
            r5.x = asuint(float(asint(r2.w)));
            { float adouacDot = asfloat(r5.x) * _Distortion + asfloat(r5.x) * _Distortion;
                r4.y = asuint(adouacDot);
            }
            r5.x = asuint(asfloat(r0.z) * _ScreenResolution.x + asfloat(r4.x));
            r5.y = asuint(asfloat(r0.w) * _ScreenResolution.y + asfloat(r4.y));
            {
                uvec4 adouacD0 = uvec4(0u);
                adouacD0.x = asuint(asfloat(r5.x) / _ScreenResolution.x);
                adouacD0.y = asuint(asfloat(r5.y) / _ScreenResolution.y);
                r5.x = adouacD0.x;
                r5.y = adouacD0.y;
            }
            { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r5.x), asfloat(r5.y)));
                r5.x = asuint(adouacTex.x);
                r5.y = asuint(adouacTex.y);
                r5.z = asuint(adouacTex.z);
                r5.w = asuint(adouacTex.w);
            }
            r3.x = asuint(asfloat(r4.z) * asfloat(r5.x) + asfloat(r3.x));
            r3.z = asuint(asfloat(r4.z) * asfloat(r5.y) + asfloat(r3.z));
            r3.w = asuint(asfloat(r4.z) * asfloat(r5.z) + asfloat(r3.w));
            r2.w = r4.w;
        }
        r2.x = r3.x;
        r2.y = r3.z;
        r2.z = r3.w;
        r1.z = r3.y;
    }
    r3.x = asuint(asfloat(r0.z) * _ScreenResolution.x + 1.0);
    r3.y = asuint(asfloat(r0.w) * _ScreenResolution.y + 1.0);
    r3.z = asuint(asfloat(r0.z) * _ScreenResolution.x + 1.0);
    r3.w = asuint(asfloat(r0.w) * _ScreenResolution.y + 0.0);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r3.x) / _ScreenResolution.x);
        adouacD0.y = asuint(asfloat(r3.y) / _ScreenResolution.y);
        adouacD0.z = asuint(asfloat(r3.z) / _ScreenResolution.x);
        adouacD0.w = asuint(asfloat(r3.w) / _ScreenResolution.y);
        r3.x = adouacD0.x;
        r3.y = adouacD0.y;
        r3.z = adouacD0.z;
        r3.w = adouacD0.w;
    }
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
    r5.x = asuint(asfloat(r3.x) + asfloat(r4.x));
    r5.y = asuint(asfloat(r3.y) + asfloat(r4.y));
    r5.z = asuint(asfloat(r3.z) + asfloat(r4.z));
    r5.w = asuint(asfloat(r3.w) + asfloat(r4.w));
    r6.x = asuint(asfloat(r0.z) * _ScreenResolution.x + 1.0);
    r6.y = asuint(asfloat(r0.w) * _ScreenResolution.y + (-1.0));
    r6.z = asuint(asfloat(r0.z) * _ScreenResolution.x + 0.0);
    r6.w = asuint(asfloat(r0.w) * _ScreenResolution.y + 1.0);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r6.x) / _ScreenResolution.x);
        adouacD0.y = asuint(asfloat(r6.y) / _ScreenResolution.y);
        adouacD0.z = asuint(asfloat(r6.z) / _ScreenResolution.x);
        adouacD0.w = asuint(asfloat(r6.w) / _ScreenResolution.y);
        r6.x = adouacD0.x;
        r6.y = adouacD0.y;
        r6.z = adouacD0.z;
        r6.w = adouacD0.w;
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r6.x), asfloat(r6.y)));
        r7.x = asuint(adouacTex.x);
        r7.y = asuint(adouacTex.y);
        r7.z = asuint(adouacTex.z);
        r7.w = asuint(adouacTex.w);
    }
    r5.x = asuint(asfloat(r5.x) + asfloat(r7.x));
    r5.y = asuint(asfloat(r5.y) + asfloat(r7.y));
    r5.z = asuint(asfloat(r5.z) + asfloat(r7.z));
    r5.w = asuint(asfloat(r5.w) + asfloat(r7.w));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r6.z), asfloat(r6.w)));
        r6.x = asuint(adouacTex.x);
        r6.y = asuint(adouacTex.y);
        r6.z = asuint(adouacTex.z);
        r6.w = asuint(adouacTex.w);
    }
    r5.x = asuint(asfloat(r5.x) + asfloat(r6.x));
    r5.y = asuint(asfloat(r5.y) + asfloat(r6.y));
    r5.z = asuint(asfloat(r5.z) + asfloat(r6.z));
    r5.w = asuint(asfloat(r5.w) + asfloat(r6.w));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r1.x) / _ScreenResolution.x);
        adouacD0.y = asuint(asfloat(r1.y) / _ScreenResolution.y);
        r1.x = adouacD0.x;
        r1.y = adouacD0.y;
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r1.x), asfloat(r1.y)));
        r1.x = asuint(adouacTex.x);
        r1.y = asuint(adouacTex.y);
        r1.z = asuint(adouacTex.z);
        r1.w = asuint(adouacTex.w);
    }
    r5.x = asuint(asfloat(r1.x) + asfloat(r5.x));
    r5.y = asuint(asfloat(r1.y) + asfloat(r5.y));
    r5.z = asuint(asfloat(r1.z) + asfloat(r5.z));
    r5.w = asuint(asfloat(r1.w) + asfloat(r5.w));
    r8.x = asuint(asfloat(r0.z) * _ScreenResolution.x + 0.0);
    r8.y = asuint(asfloat(r0.w) * _ScreenResolution.y + (-1.0));
    r8.z = asuint(asfloat(r0.z) * _ScreenResolution.x + (-1.0));
    r8.w = asuint(asfloat(r0.w) * _ScreenResolution.y + 1.0);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r8.x) / _ScreenResolution.x);
        adouacD0.y = asuint(asfloat(r8.y) / _ScreenResolution.y);
        adouacD0.z = asuint(asfloat(r8.z) / _ScreenResolution.x);
        adouacD0.w = asuint(asfloat(r8.w) / _ScreenResolution.y);
        r8.x = adouacD0.x;
        r8.y = adouacD0.y;
        r8.z = adouacD0.z;
        r8.w = adouacD0.w;
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r8.x), asfloat(r8.y)));
        r9.x = asuint(adouacTex.x);
        r9.y = asuint(adouacTex.y);
        r9.z = asuint(adouacTex.z);
        r9.w = asuint(adouacTex.w);
    }
    r5.x = asuint(asfloat(r5.x) + asfloat(r9.x));
    r5.y = asuint(asfloat(r5.y) + asfloat(r9.y));
    r5.z = asuint(asfloat(r5.z) + asfloat(r9.z));
    r5.w = asuint(asfloat(r5.w) + asfloat(r9.w));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r8.z), asfloat(r8.w)));
        r8.x = asuint(adouacTex.x);
        r8.y = asuint(adouacTex.y);
        r8.z = asuint(adouacTex.z);
        r8.w = asuint(adouacTex.w);
    }
    r5.x = asuint(asfloat(r5.x) + asfloat(r8.x));
    r5.y = asuint(asfloat(r5.y) + asfloat(r8.y));
    r5.z = asuint(asfloat(r5.z) + asfloat(r8.z));
    r5.w = asuint(asfloat(r5.w) + asfloat(r8.w));
    r10.x = asuint(asfloat(r0.z) * _ScreenResolution.x + (-1.0));
    r10.y = asuint(asfloat(r0.w) * _ScreenResolution.y + 0.0);
    r10.z = asuint(asfloat(r0.z) * _ScreenResolution.x + (-1.0));
    r10.w = asuint(asfloat(r0.w) * _ScreenResolution.y + (-1.0));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r10.x) / _ScreenResolution.x);
        adouacD0.y = asuint(asfloat(r10.y) / _ScreenResolution.y);
        adouacD0.z = asuint(asfloat(r10.z) / _ScreenResolution.x);
        adouacD0.w = asuint(asfloat(r10.w) / _ScreenResolution.y);
        r10.x = adouacD0.x;
        r10.y = adouacD0.y;
        r10.z = adouacD0.z;
        r10.w = adouacD0.w;
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r10.x), asfloat(r10.y)));
        r11.x = asuint(adouacTex.x);
        r11.y = asuint(adouacTex.y);
        r11.z = asuint(adouacTex.z);
        r11.w = asuint(adouacTex.w);
    }
    r5.x = asuint(asfloat(r5.x) + asfloat(r11.x));
    r5.y = asuint(asfloat(r5.y) + asfloat(r11.y));
    r5.z = asuint(asfloat(r5.z) + asfloat(r11.z));
    r5.w = asuint(asfloat(r5.w) + asfloat(r11.w));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r10.z), asfloat(r10.w)));
        r10.x = asuint(adouacTex.x);
        r10.y = asuint(adouacTex.y);
        r10.z = asuint(adouacTex.z);
        r10.w = asuint(adouacTex.w);
    }
    r5.x = asuint(asfloat(r5.x) + asfloat(r10.x));
    r5.y = asuint(asfloat(r5.y) + asfloat(r10.y));
    r5.z = asuint(asfloat(r5.z) + asfloat(r10.z));
    r5.w = asuint(asfloat(r5.w) + asfloat(r10.w));
    r5.x = asuint(asfloat(r5.x) * 0.777778);
    r5.y = asuint(asfloat(r5.y) * 0.777778);
    r5.z = asuint(asfloat(r5.z) * 0.777778);
    r5.w = asuint(asfloat(r5.w) * 0.777778);
    r5.x = asuint(floor(asfloat(r5.x)));
    r5.y = asuint(floor(asfloat(r5.y)));
    r5.z = asuint(floor(asfloat(r5.z)));
    r5.w = asuint(floor(asfloat(r5.w)));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r5.x) / _ColorLevel);
        adouacD0.y = asuint(asfloat(r5.y) / _ColorLevel);
        adouacD0.z = asuint(asfloat(r5.z) / _ColorLevel);
        adouacD0.w = asuint(asfloat(r5.w) / _ColorLevel);
        r5.x = adouacD0.x;
        r5.y = adouacD0.y;
        r5.z = adouacD0.z;
        r5.w = adouacD0.w;
    }
    r12.x = asuint(asfloat(r0.z) * _ScreenResolution.x + 1.0);
    r12.y = asuint(asfloat(r0.w) * _ScreenResolution.y + 2.0);
    r12.z = asuint(asfloat(r0.z) * _ScreenResolution.x + 0.0);
    r12.w = asuint(asfloat(r0.w) * _ScreenResolution.y + 2.0);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r12.x) / _ScreenResolution.x);
        adouacD0.y = asuint(asfloat(r12.y) / _ScreenResolution.y);
        adouacD0.z = asuint(asfloat(r12.z) / _ScreenResolution.x);
        adouacD0.w = asuint(asfloat(r12.w) / _ScreenResolution.y);
        r12.x = adouacD0.x;
        r12.y = adouacD0.y;
        r12.z = adouacD0.z;
        r12.w = adouacD0.w;
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r12.x), asfloat(r12.y)));
        r13.x = asuint(adouacTex.x);
        r13.y = asuint(adouacTex.y);
        r13.z = asuint(adouacTex.z);
        r13.w = asuint(adouacTex.w);
    }
    r13.x = asuint(asfloat(r4.x) + asfloat(r13.x));
    r13.y = asuint(asfloat(r4.y) + asfloat(r13.y));
    r13.z = asuint(asfloat(r4.z) + asfloat(r13.z));
    r13.w = asuint(asfloat(r4.w) + asfloat(r13.w));
    r13.x = asuint(asfloat(r3.x) + asfloat(r13.x));
    r13.y = asuint(asfloat(r3.y) + asfloat(r13.y));
    r13.z = asuint(asfloat(r3.z) + asfloat(r13.z));
    r13.w = asuint(asfloat(r3.w) + asfloat(r13.w));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r12.z), asfloat(r12.w)));
        r12.x = asuint(adouacTex.x);
        r12.y = asuint(adouacTex.y);
        r12.z = asuint(adouacTex.z);
        r12.w = asuint(adouacTex.w);
    }
    r12.x = asuint(asfloat(r12.x) + asfloat(r13.x));
    r12.y = asuint(asfloat(r12.y) + asfloat(r13.y));
    r12.z = asuint(asfloat(r12.z) + asfloat(r13.z));
    r12.w = asuint(asfloat(r12.w) + asfloat(r13.w));
    r12.x = asuint(asfloat(r6.x) + asfloat(r12.x));
    r12.y = asuint(asfloat(r6.y) + asfloat(r12.y));
    r12.z = asuint(asfloat(r6.z) + asfloat(r12.z));
    r12.w = asuint(asfloat(r6.w) + asfloat(r12.w));
    r12.x = asuint(asfloat(r1.x) + asfloat(r12.x));
    r12.y = asuint(asfloat(r1.y) + asfloat(r12.y));
    r12.z = asuint(asfloat(r1.z) + asfloat(r12.z));
    r12.w = asuint(asfloat(r1.w) + asfloat(r12.w));
    r13.x = asuint(asfloat(r0.z) * _ScreenResolution.x + (-1.0));
    r13.y = asuint(asfloat(r0.w) * _ScreenResolution.y + 2.0);
    r13.z = asuint(asfloat(r0.z) * _ScreenResolution.x + 1.0);
    r13.w = asuint(asfloat(r0.w) * _ScreenResolution.y + (-2.0));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r13.x) / _ScreenResolution.x);
        adouacD0.y = asuint(asfloat(r13.y) / _ScreenResolution.y);
        adouacD0.z = asuint(asfloat(r13.z) / _ScreenResolution.x);
        adouacD0.w = asuint(asfloat(r13.w) / _ScreenResolution.y);
        r13.x = adouacD0.x;
        r13.y = adouacD0.y;
        r13.z = adouacD0.z;
        r13.w = adouacD0.w;
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r13.x), asfloat(r13.y)));
        r14.x = asuint(adouacTex.x);
        r14.y = asuint(adouacTex.y);
        r14.z = asuint(adouacTex.z);
        r14.w = asuint(adouacTex.w);
    }
    r12.x = asuint(asfloat(r12.x) + asfloat(r14.x));
    r12.y = asuint(asfloat(r12.y) + asfloat(r14.y));
    r12.z = asuint(asfloat(r12.z) + asfloat(r14.z));
    r12.w = asuint(asfloat(r12.w) + asfloat(r14.w));
    r12.x = asuint(asfloat(r8.x) + asfloat(r12.x));
    r12.y = asuint(asfloat(r8.y) + asfloat(r12.y));
    r12.z = asuint(asfloat(r8.z) + asfloat(r12.z));
    r12.w = asuint(asfloat(r8.w) + asfloat(r12.w));
    r12.x = asuint(asfloat(r11.x) + asfloat(r12.x));
    r12.y = asuint(asfloat(r11.y) + asfloat(r12.y));
    r12.z = asuint(asfloat(r11.z) + asfloat(r12.z));
    r12.w = asuint(asfloat(r11.w) + asfloat(r12.w));
    r14.x = asuint(asfloat(r3.x) + asfloat(r7.x));
    r14.y = asuint(asfloat(r3.y) + asfloat(r7.y));
    r14.z = asuint(asfloat(r3.z) + asfloat(r7.z));
    r14.w = asuint(asfloat(r3.w) + asfloat(r7.w));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r13.z), asfloat(r13.w)));
        r13.x = asuint(adouacTex.x);
        r13.y = asuint(adouacTex.y);
        r13.z = asuint(adouacTex.z);
        r13.w = asuint(adouacTex.w);
    }
    r13.x = asuint(asfloat(r13.x) + asfloat(r14.x));
    r13.y = asuint(asfloat(r13.y) + asfloat(r14.y));
    r13.z = asuint(asfloat(r13.z) + asfloat(r14.z));
    r13.w = asuint(asfloat(r13.w) + asfloat(r14.w));
    r13.x = asuint(asfloat(r1.x) + asfloat(r13.x));
    r13.y = asuint(asfloat(r1.y) + asfloat(r13.y));
    r13.z = asuint(asfloat(r1.z) + asfloat(r13.z));
    r13.w = asuint(asfloat(r1.w) + asfloat(r13.w));
    r13.x = asuint(asfloat(r9.x) + asfloat(r13.x));
    r13.y = asuint(asfloat(r9.y) + asfloat(r13.y));
    r13.z = asuint(asfloat(r9.z) + asfloat(r13.z));
    r13.w = asuint(asfloat(r9.w) + asfloat(r13.w));
    r14.x = asuint(asfloat(r0.z) * _ScreenResolution.x + 0.0);
    r14.y = asuint(asfloat(r0.w) * _ScreenResolution.y + (-2.0));
    r14.z = asuint(asfloat(r0.z) * _ScreenResolution.x + (-1.0));
    r14.w = asuint(asfloat(r0.w) * _ScreenResolution.y + (-2.0));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r14.x) / _ScreenResolution.x);
        adouacD0.y = asuint(asfloat(r14.y) / _ScreenResolution.y);
        adouacD0.z = asuint(asfloat(r14.z) / _ScreenResolution.x);
        adouacD0.w = asuint(asfloat(r14.w) / _ScreenResolution.y);
        r14.x = adouacD0.x;
        r14.y = adouacD0.y;
        r14.z = adouacD0.z;
        r14.w = adouacD0.w;
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r14.x), asfloat(r14.y)));
        r15.x = asuint(adouacTex.x);
        r15.y = asuint(adouacTex.y);
        r15.z = asuint(adouacTex.z);
        r15.w = asuint(adouacTex.w);
    }
    r13.x = asuint(asfloat(r13.x) + asfloat(r15.x));
    r13.y = asuint(asfloat(r13.y) + asfloat(r15.y));
    r13.z = asuint(asfloat(r13.z) + asfloat(r15.z));
    r13.w = asuint(asfloat(r13.w) + asfloat(r15.w));
    r13.x = asuint(asfloat(r11.x) + asfloat(r13.x));
    r13.y = asuint(asfloat(r11.y) + asfloat(r13.y));
    r13.z = asuint(asfloat(r11.z) + asfloat(r13.z));
    r13.w = asuint(asfloat(r11.w) + asfloat(r13.w));
    r13.x = asuint(asfloat(r10.x) + asfloat(r13.x));
    r13.y = asuint(asfloat(r10.y) + asfloat(r13.y));
    r13.z = asuint(asfloat(r10.z) + asfloat(r13.z));
    r13.w = asuint(asfloat(r10.w) + asfloat(r13.w));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r14.z), asfloat(r14.w)));
        r14.x = asuint(adouacTex.x);
        r14.y = asuint(adouacTex.y);
        r14.z = asuint(adouacTex.z);
        r14.w = asuint(adouacTex.w);
    }
    r13.x = asuint(asfloat(r13.x) + asfloat(r14.x));
    r13.y = asuint(asfloat(r13.y) + asfloat(r14.y));
    r13.z = asuint(asfloat(r13.z) + asfloat(r14.z));
    r13.w = asuint(asfloat(r13.w) + asfloat(r14.w));
    r13.x = asuint(asfloat(r13.x) * 0.111111);
    r13.y = asuint(asfloat(r13.y) * 0.111111);
    r13.z = asuint(asfloat(r13.z) * 0.111111);
    r13.w = asuint(asfloat(r13.w) * 0.111111);
    r12.x = asuint(asfloat(r12.x) * 0.111111 + -asfloat(r13.x));
    r12.y = asuint(asfloat(r12.y) * 0.111111 + -asfloat(r13.y));
    r12.z = asuint(asfloat(r12.z) * 0.111111 + -asfloat(r13.z));
    r12.w = asuint(asfloat(r12.w) * 0.111111 + -asfloat(r13.w));
    r13.x = asuint(asfloat(r0.z) * _ScreenResolution.x + 2.0);
    r13.y = asuint(asfloat(r0.w) * _ScreenResolution.y + 1.0);
    r13.z = asuint(asfloat(r0.z) * _ScreenResolution.x + 2.0);
    r13.w = asuint(asfloat(r0.w) * _ScreenResolution.y + 0.0);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r13.x) / _ScreenResolution.x);
        adouacD0.y = asuint(asfloat(r13.y) / _ScreenResolution.y);
        adouacD0.z = asuint(asfloat(r13.z) / _ScreenResolution.x);
        adouacD0.w = asuint(asfloat(r13.w) / _ScreenResolution.y);
        r13.x = adouacD0.x;
        r13.y = adouacD0.y;
        r13.z = adouacD0.z;
        r13.w = adouacD0.w;
    }
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
    r13.x = asuint(asfloat(r13.x) + asfloat(r14.x));
    r13.y = asuint(asfloat(r13.y) + asfloat(r14.y));
    r13.z = asuint(asfloat(r13.z) + asfloat(r14.z));
    r13.w = asuint(asfloat(r13.w) + asfloat(r14.w));
    r14.x = asuint(asfloat(r0.z) * _ScreenResolution.x + 2.0);
    r14.y = asuint(asfloat(r0.w) * _ScreenResolution.y + (-1.0));
    r14.z = asuint(asfloat(r0.z) * _ScreenResolution.x + (-2.0));
    r14.w = asuint(asfloat(r0.w) * _ScreenResolution.y + 1.0);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r14.x) / _ScreenResolution.x);
        adouacD0.y = asuint(asfloat(r14.y) / _ScreenResolution.y);
        adouacD0.z = asuint(asfloat(r14.z) / _ScreenResolution.x);
        adouacD0.w = asuint(asfloat(r14.w) / _ScreenResolution.y);
        r14.x = adouacD0.x;
        r14.y = adouacD0.y;
        r14.z = adouacD0.z;
        r14.w = adouacD0.w;
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r14.x), asfloat(r14.y)));
        r15.x = asuint(adouacTex.x);
        r15.y = asuint(adouacTex.y);
        r15.z = asuint(adouacTex.z);
        r15.w = asuint(adouacTex.w);
    }
    r13.x = asuint(asfloat(r13.x) + asfloat(r15.x));
    r13.y = asuint(asfloat(r13.y) + asfloat(r15.y));
    r13.z = asuint(asfloat(r13.z) + asfloat(r15.z));
    r13.w = asuint(asfloat(r13.w) + asfloat(r15.w));
    r4.x = asuint(asfloat(r4.x) + asfloat(r13.x));
    r4.y = asuint(asfloat(r4.y) + asfloat(r13.y));
    r4.z = asuint(asfloat(r4.z) + asfloat(r13.z));
    r4.w = asuint(asfloat(r4.w) + asfloat(r13.w));
    r3.x = asuint(asfloat(r3.x) + asfloat(r4.x));
    r3.y = asuint(asfloat(r3.y) + asfloat(r4.y));
    r3.z = asuint(asfloat(r3.z) + asfloat(r4.z));
    r3.w = asuint(asfloat(r3.w) + asfloat(r4.w));
    r3.x = asuint(asfloat(r7.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r7.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r7.z) + asfloat(r3.z));
    r3.w = asuint(asfloat(r7.w) + asfloat(r3.w));
    r3.x = asuint(asfloat(r6.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r6.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r6.z) + asfloat(r3.z));
    r3.w = asuint(asfloat(r6.w) + asfloat(r3.w));
    r3.x = asuint(asfloat(r1.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r1.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r1.z) + asfloat(r3.z));
    r3.w = asuint(asfloat(r1.w) + asfloat(r3.w));
    r3.x = asuint(asfloat(r9.x) + asfloat(r3.x));
    r3.y = asuint(asfloat(r9.y) + asfloat(r3.y));
    r3.z = asuint(asfloat(r9.z) + asfloat(r3.z));
    r3.w = asuint(asfloat(r9.w) + asfloat(r3.w));
    r1.x = asuint(asfloat(r1.x) + asfloat(r6.x));
    r1.y = asuint(asfloat(r1.y) + asfloat(r6.y));
    r1.z = asuint(asfloat(r1.z) + asfloat(r6.z));
    r1.w = asuint(asfloat(r1.w) + asfloat(r6.w));
    r1.x = asuint(asfloat(r9.x) + asfloat(r1.x));
    r1.y = asuint(asfloat(r9.y) + asfloat(r1.y));
    r1.z = asuint(asfloat(r9.z) + asfloat(r1.z));
    r1.w = asuint(asfloat(r9.w) + asfloat(r1.w));
    r1.x = asuint(asfloat(r8.x) + asfloat(r1.x));
    r1.y = asuint(asfloat(r8.y) + asfloat(r1.y));
    r1.z = asuint(asfloat(r8.z) + asfloat(r1.z));
    r1.w = asuint(asfloat(r8.w) + asfloat(r1.w));
    r1.x = asuint(asfloat(r11.x) + asfloat(r1.x));
    r1.y = asuint(asfloat(r11.y) + asfloat(r1.y));
    r1.z = asuint(asfloat(r11.z) + asfloat(r1.z));
    r1.w = asuint(asfloat(r11.w) + asfloat(r1.w));
    r1.x = asuint(asfloat(r10.x) + asfloat(r1.x));
    r1.y = asuint(asfloat(r10.y) + asfloat(r1.y));
    r1.z = asuint(asfloat(r10.z) + asfloat(r1.z));
    r1.w = asuint(asfloat(r10.w) + asfloat(r1.w));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r14.z), asfloat(r14.w)));
        r4.x = asuint(adouacTex.x);
        r4.y = asuint(adouacTex.y);
        r4.z = asuint(adouacTex.z);
        r4.w = asuint(adouacTex.w);
    }
    r1.x = asuint(asfloat(r1.x) + asfloat(r4.x));
    r1.y = asuint(asfloat(r1.y) + asfloat(r4.y));
    r1.z = asuint(asfloat(r1.z) + asfloat(r4.z));
    r1.w = asuint(asfloat(r1.w) + asfloat(r4.w));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r0.x) * _ScreenResolution.x + (-2.0));
        adouacD0.y = asuint(asfloat(r0.y) * _ScreenResolution.y + 0.0);
        adouacD0.z = asuint(asfloat(r0.z) * _ScreenResolution.x + (-2.0));
        adouacD0.w = asuint(asfloat(r0.w) * _ScreenResolution.y + (-1.0));
        r0.x = adouacD0.x;
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
        r0.w = adouacD0.w;
    }
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(asfloat(r0.x) / _ScreenResolution.x);
        adouacD0.y = asuint(asfloat(r0.y) / _ScreenResolution.y);
        adouacD0.z = asuint(asfloat(r0.z) / _ScreenResolution.x);
        adouacD0.w = asuint(asfloat(r0.w) / _ScreenResolution.y);
        r0.x = adouacD0.x;
        r0.y = adouacD0.y;
        r0.z = adouacD0.z;
        r0.w = adouacD0.w;
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r0.x), asfloat(r0.y)));
        r4.x = asuint(adouacTex.x);
        r4.y = asuint(adouacTex.y);
        r4.z = asuint(adouacTex.z);
        r4.w = asuint(adouacTex.w);
    }
    r1.x = asuint(asfloat(r1.x) + asfloat(r4.x));
    r1.y = asuint(asfloat(r1.y) + asfloat(r4.y));
    r1.z = asuint(asfloat(r1.z) + asfloat(r4.z));
    r1.w = asuint(asfloat(r1.w) + asfloat(r4.w));
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r0.z), asfloat(r0.w)));
        r0.x = asuint(adouacTex.x);
        r0.y = asuint(adouacTex.y);
        r0.z = asuint(adouacTex.z);
        r0.w = asuint(adouacTex.w);
    }
    r0.x = asuint(asfloat(r0.x) + asfloat(r1.x));
    r0.y = asuint(asfloat(r0.y) + asfloat(r1.y));
    r0.z = asuint(asfloat(r0.z) + asfloat(r1.z));
    r0.w = asuint(asfloat(r0.w) + asfloat(r1.w));
    r0.x = asuint(asfloat(r0.x) * 0.111111);
    r0.y = asuint(asfloat(r0.y) * 0.111111);
    r0.z = asuint(asfloat(r0.z) * 0.111111);
    r0.w = asuint(asfloat(r0.w) * 0.111111);
    r0.x = asuint(asfloat(r3.x) * 0.111111 + -asfloat(r0.x));
    r0.y = asuint(asfloat(r3.y) * 0.111111 + -asfloat(r0.y));
    r0.z = asuint(asfloat(r3.z) * 0.111111 + -asfloat(r0.z));
    r0.w = asuint(asfloat(r3.w) * 0.111111 + -asfloat(r0.w));
    r0.x = asuint(abs(asfloat(r0.x)) + abs(asfloat(r12.x)));
    r0.y = asuint(abs(asfloat(r0.y)) + abs(asfloat(r12.y)));
    r0.z = asuint(abs(asfloat(r0.z)) + abs(asfloat(r12.z)));
    r0.w = asuint(abs(asfloat(r0.w)) + abs(asfloat(r12.w)));
    r0.x = asuint(asfloat(r0.x) * 0.5);
    r0.y = asuint(asfloat(r0.y) * 0.5);
    r0.z = asuint(asfloat(r0.z) * 0.5);
    r0.w = asuint(asfloat(r0.w) * 0.5);
    r1.x = asuint(asfloat(r2.x) * 0.5);
    r1.y = asuint(asfloat(r2.y) * 0.5);
    r1.z = asuint(asfloat(r2.z) * 0.5);
    r1.w = 0x40000000u;
    r1.x = asuint(-asfloat(r5.x) + asfloat(r1.x));
    r1.y = asuint(-asfloat(r5.y) + asfloat(r1.y));
    r1.z = asuint(-asfloat(r5.z) + asfloat(r1.z));
    r1.w = asuint(-asfloat(r5.w) + asfloat(r1.w));
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.x = asuint(_Distortion * asfloat(r1.x) + asfloat(r5.x));
        adouacD0.y = asuint(_Distortion * asfloat(r1.y) + asfloat(r5.y));
        adouacD0.z = asuint(_Distortion * asfloat(r1.z) + asfloat(r5.z));
        adouacD0.w = asuint(_Distortion * asfloat(r1.w) + asfloat(r5.w));
        r1.x = adouacD0.x;
        r1.y = adouacD0.y;
        r1.z = adouacD0.z;
        r1.w = adouacD0.w;
    }
    r2.x = asuint(_EdgeSize + 0.05);
    { float adouacDot = asfloat(r0.x) * asfloat(r0.x) + asfloat(r0.y) * asfloat(r0.y) + asfloat(r0.z) * asfloat(r0.z) + asfloat(r0.w) * asfloat(r0.w);
        r0.x = asuint(adouacDot);
    }
    r0.x = asuint(sqrt(asfloat(r0.x)));
    r0.x = ((asfloat(r2.x) < asfloat(r0.x)) ? 0xffffffffu : 0u);
    o0.x = ((r0.x != 0u) ? 0x00000000u : r1.x);
    o0.y = ((r0.x != 0u) ? 0x00000000u : r1.y);
    o0.z = ((r0.x != 0u) ? 0x00000000u : r1.z);
    o0.w = r1.w;
    return AdouacOutputPs(o0);
}

void main() {
    AdouacVaryings IN;
    IN.pos = gl_FragCoord;
    IN.texcoord0 = vec4(vUv, 0.0, 0.0);
    IN.color0 = vec4(1.0);
    fragColor = frag(IN);
}
