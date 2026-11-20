precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform float _Amount;
uniform float _Glow;
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

const uvec4 icb_ps[4] = uvec4[4](uvec4(0x3f800000u, 0x00000000u, 0x00000000u, 0x00000000u), uvec4(0x00000000u, 0x3f800000u, 0x00000000u, 0x00000000u), uvec4(0x00000000u, 0x00000000u, 0x3f800000u, 0x00000000u), uvec4(0x00000000u, 0x00000000u, 0x00000000u, 0x3f800000u));









vec4 frag(AdouacVaryings IN) 
{
    uvec4 v0 = asuint(vec4(IN.texcoord0.x, IN.texcoord0.y, 0.0, 0.0));
    uvec4 v1 = asuint(vec4(IN.pos.x, IN.pos.y, IN.pos.z, IN.pos.w));
    uvec4 v2 = asuint(vec4(IN.color0.x, IN.color0.y, IN.color0.z, IN.color0.w));
    uvec4 r0 = uvec4(0u), r1 = uvec4(0u), r2 = uvec4(0u), r3 = uvec4(0u), r4 = uvec4(0u), r5 = uvec4(0u), r6 = uvec4(0u), r7 = uvec4(0u);
    uvec4 o0 = uvec4(0u);
    r0.x = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r0.y = asuint(asfloat(v0.y) * 1.0 + 0.0);
    r0.z = asuint(1.0 / _ScreenResolution.x);
    r0.w = asuint(1.0 / _ScreenResolution.y);
    {
        uvec4 adouacD0 = uvec4(0u);
        adouacD0.z = asuint(asfloat(r0.z) * _Amount);
        adouacD0.w = asuint(asfloat(r0.w) * _Amount);
        r0.z = adouacD0.z;
        r0.w = adouacD0.w;
    }
    { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r0.x), asfloat(r0.y)));
        r1.x = asuint(adouacTex.x);
        r1.y = asuint(adouacTex.y);
        r1.z = asuint(adouacTex.z);
        r1.w = asuint(adouacTex.w);
    }
    r2.x = 0x00000000u;
    r2.y = 0x00000000u;
    r2.z = 0x00000000u;
    r2.w = 0x00000000u;
    r1.w = 0x00000000u;
     while (true)
    {
        r3.x = ((asint(r1.w) >= 3) ? 0xffffffffu : 0u);
        if (r3.x != 0u) break;
        r3.x = asuint(asint(r1.w) + -1);
        r3.y = asuint(asint(r1.w) + 1);
        r3.x = asuint(float(asint(r3.x)));
        r4.x = asuint(asfloat(r0.z) * asfloat(r3.x));
        { float adouacDot = 1.0 * asfloat(icb_ps[r1.w].x) + 2.0 * asfloat(icb_ps[r1.w].y) + 1.0 * asfloat(icb_ps[r1.w].z);
            r5.x = asuint(adouacDot);
        }
        { float adouacDot = 2.0 * asfloat(icb_ps[r1.w].x) + 4.0 * asfloat(icb_ps[r1.w].y) + 2.0 * asfloat(icb_ps[r1.w].z);
            r5.y = asuint(adouacDot);
        }
        { float adouacDot = 1.0 * asfloat(icb_ps[r1.w].x) + 2.0 * asfloat(icb_ps[r1.w].y) + 1.0 * asfloat(icb_ps[r1.w].z);
            r5.z = asuint(adouacDot);
        }
        r6.x = r2.x;
        r6.y = r2.y;
        r6.z = r2.z;
        r6.w = r2.w;
        r3.x = 0x00000000u;
         while (true)
        {
            r3.z = ((asint(r3.x) >= 3) ? 0xffffffffu : 0u);
            if (r3.z != 0u) break;
            r3.z = asuint(asint(r3.x) + -1);
            r3.w = asuint(asint(r3.x) + 1);
            r3.z = asuint(float(asint(r3.z)));
            r4.y = asuint(asfloat(r0.w) * asfloat(r3.z));
            {
                uvec4 adouacD0 = uvec4(0u);
                adouacD0.y = asuint(asfloat(r0.x) + asfloat(r4.x));
                adouacD0.z = asuint(asfloat(r0.y) + asfloat(r4.y));
                r4.y = adouacD0.y;
                r4.z = adouacD0.z;
            }
            { float adouacDot = asfloat(r5.x) * asfloat(icb_ps[r3.x].x) + asfloat(r5.y) * asfloat(icb_ps[r3.x].y) + asfloat(r5.z) * asfloat(icb_ps[r3.x].z);
                r3.z = asuint(adouacDot);
            }
            { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r4.y), asfloat(r4.z)));
                r7.x = asuint(adouacTex.x);
                r7.y = asuint(adouacTex.y);
                r7.z = asuint(adouacTex.z);
                r7.w = asuint(adouacTex.w);
            }
            r6.x = asuint(asfloat(r3.z) * asfloat(r7.x) + asfloat(r6.x));
            r6.y = asuint(asfloat(r3.z) * asfloat(r7.y) + asfloat(r6.y));
            r6.z = asuint(asfloat(r3.z) * asfloat(r7.z) + asfloat(r6.z));
            r6.w = asuint(asfloat(r3.z) * asfloat(r7.w) + asfloat(r6.w));
            r3.x = r3.w;
        }
        r2.x = r6.x;
        r2.y = r6.y;
        r2.z = r6.z;
        r2.w = r6.w;
        r1.w = r3.y;
    }
    r0.x = asuint(asfloat(r2.w) * 0.125);
    r0.y = asuint(asfloat(r2.x) * 0.125 + -asfloat(r1.x));
    r0.z = asuint(asfloat(r2.y) * 0.125 + -asfloat(r1.y));
    r0.w = asuint(asfloat(r2.z) * 0.125 + -asfloat(r1.z));
    o0.x = asuint(_Glow * asfloat(r0.y) + asfloat(r1.x));
    o0.y = asuint(_Glow * asfloat(r0.z) + asfloat(r1.y));
    o0.z = asuint(_Glow * asfloat(r0.w) + asfloat(r1.z));
    o0.w = r0.x;
    return AdouacOutputPs(o0);
}

void main() {
    AdouacVaryings IN;
    IN.pos = gl_FragCoord;
    IN.texcoord0 = vec4(vUv, 0.0, 0.0);
    IN.color0 = vec4(1.0);
    fragColor = frag(IN);
}
