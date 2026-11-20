precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform float _Distortion;
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
    uvec4 r0 = uvec4(0u), r1 = uvec4(0u), r2 = uvec4(0u), r3 = uvec4(0u), r4 = uvec4(0u);
    uvec4 o0 = uvec4(0u);
    uvec4 x0[6];
     for (int adouacK0 = 0; adouacK0 < 6; adouacK0++) x0[adouacK0] = uvec4(0u);
    r0.x = asuint(asfloat(v0.x) * 1.0 + 0.0);
    r0.y = asuint(asfloat(v0.y) * 1.0 + 0.0);
    x0[5].x = 0x00000000u;
    x0[2].x = 0x3ecccccdu;
    x0[1].x = 0x3ecccccdu;
    x0[3].x = 0x3ecccccdu;
    x0[0].x = 0x3ecccccdu;
    x0[4].x = 0x3ecccccdu;
    r1.x = 0x00000000u;
    r1.y = 0x00000000u;
    r1.z = 0x00000000u;
    r0.z = 0xfffffffeu;
     while (true)
    {
        r0.w = ((2 < asint(r0.z)) ? 0xffffffffu : 0u);
        if (r0.w != 0u) break;
        r2.x = asuint(asint(r0.z) + 2);
        r2.y = asuint(asint(r0.z) + 1);
        r0.w = x0[r2.x].x;
        r1.w = asuint(float(asint(r0.z)));
        r3.x = asuint(asfloat(r1.w) * _Distortion);
        r2.x = r1.x;
        r2.z = r1.y;
        r2.w = r1.z;
        r1.w = 0xfffffffeu;
         while (true)
        {
            r3.z = ((2 < asint(r1.w)) ? 0xffffffffu : 0u);
            if (r3.z != 0u) break;
            r3.z = asuint(asint(r1.w) + 2);
            r3.w = asuint(asint(r1.w) + 1);
            r3.z = x0[r3.z].x;
            r3.z = asuint(asfloat(r0.w) * asfloat(r3.z));
            r4.x = asuint(float(asint(r1.w)));
            r3.y = asuint(asfloat(r4.x) * _Distortion);
            r4.x = asuint(asfloat(r0.x) * _ScreenResolution.x + asfloat(r3.x));
            r4.y = asuint(asfloat(r0.y) * _ScreenResolution.y + asfloat(r3.y));
            {
                uvec4 adouacD0 = uvec4(0u);
                adouacD0.x = asuint(asfloat(r4.x) / _ScreenResolution.x);
                adouacD0.y = asuint(asfloat(r4.y) / _ScreenResolution.y);
                r4.x = adouacD0.x;
                r4.y = adouacD0.y;
            }
            { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r4.x), asfloat(r4.y)));
                r4.x = asuint(adouacTex.x);
                r4.y = asuint(adouacTex.y);
                r4.z = asuint(adouacTex.z);
                r4.w = asuint(adouacTex.w);
            }
            r2.x = asuint(asfloat(r3.z) * asfloat(r4.x) + asfloat(r2.x));
            r2.z = asuint(asfloat(r3.z) * asfloat(r4.y) + asfloat(r2.z));
            r2.w = asuint(asfloat(r3.z) * asfloat(r4.z) + asfloat(r2.w));
            r1.w = r3.w;
        }
        r1.x = r2.x;
        r1.y = r2.z;
        r1.z = r2.w;
        r0.z = r2.y;
    }
    o0.x = asuint(asfloat(r1.x) * 0.25);
    o0.y = asuint(asfloat(r1.y) * 0.25);
    o0.z = asuint(asfloat(r1.z) * 0.25);
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
