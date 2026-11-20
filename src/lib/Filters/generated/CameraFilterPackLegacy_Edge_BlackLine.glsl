precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

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
    uvec4 x0[25];
     for (int adouacK0 = 0; adouacK0 < 25; adouacK0++) x0[adouacK0] = uvec4(0u);
    x0[0].x = 0xbf800000u;
    x0[1].x = 0xbf800000u;
    x0[2].x = 0xbf800000u;
    x0[3].x = 0xbf800000u;
    x0[4].x = 0xbf800000u;
    x0[5].x = 0xbf800000u;
    x0[6].x = 0xbf800000u;
    x0[7].x = 0xbf800000u;
    x0[8].x = 0xbf800000u;
    x0[9].x = 0xbf800000u;
    x0[10].x = 0xbf800000u;
    x0[11].x = 0xbf800000u;
    x0[13].x = 0xbf800000u;
    x0[14].x = 0xbf800000u;
    x0[15].x = 0xbf800000u;
    x0[16].x = 0xbf800000u;
    x0[17].x = 0xbf800000u;
    x0[18].x = 0xbf800000u;
    x0[19].x = 0xbf800000u;
    x0[20].x = 0xbf800000u;
    x0[21].x = 0xbf800000u;
    x0[22].x = 0xbf800000u;
    x0[23].x = 0xbf800000u;
    x0[24].x = 0xbf800000u;
    x0[12].x = 0x41c00000u;
    r0.x = 0x00000000u;
    r0.y = 0x00000000u;
    r0.z = 0x00000000u;
    r0.w = 0x00000000u;
    r1.x = 0x00000000u;
     while (true)
    {
        r1.y = ((asint(r1.x) >= 5) ? 0xffffffffu : 0u);
        if (r1.y != 0u) break;
        r1.y = asuint(asint(r1.x) + -2);
        r1.z = asuint(asint(r1.x) + 1);
        r2.x = asuint(float(asint(r1.y)));
        r3.x = r0.x;
        r3.y = r0.y;
        r3.z = r0.z;
        r3.w = r0.w;
        r1.y = 0x00000000u;
         while (true)
        {
            r2.z = ((asint(r1.y) >= 5) ? 0xffffffffu : 0u);
            if (r2.z != 0u) break;
            r2.z = asuint(asint(r1.x) * 5 + asint(r1.y));
            r2.z = x0[r2.z].x;
            {
                uvec4 adouacD0 = uvec4(0u);
                adouacD0.y = asuint(asint(r1.y) + 1);
                adouacD0.w = asuint(asint(r1.y) + -2);
                r1.y = adouacD0.y;
                r1.w = adouacD0.w;
            }
            r2.y = asuint(float(asint(r1.w)));
            {
                uvec4 adouacD0 = uvec4(0u);
                adouacD0.y = asuint(asfloat(r2.x) * 0.01 + asfloat(v0.x));
                adouacD0.w = asuint(asfloat(r2.y) * 0.01 + asfloat(v0.y));
                r2.y = adouacD0.y;
                r2.w = adouacD0.w;
            }
            { vec4 adouacTex = texture(_MainTex, vec2(asfloat(r2.y), asfloat(r2.w)));
                r4.x = asuint(adouacTex.x);
                r4.y = asuint(adouacTex.y);
                r4.z = asuint(adouacTex.z);
                r4.w = asuint(adouacTex.w);
            }
            r3.x = asuint(asfloat(r2.z) * asfloat(r4.x) + asfloat(r3.x));
            r3.y = asuint(asfloat(r2.z) * asfloat(r4.y) + asfloat(r3.y));
            r3.z = asuint(asfloat(r2.z) * asfloat(r4.z) + asfloat(r3.z));
            r3.w = asuint(asfloat(r2.z) * asfloat(r4.w) + asfloat(r3.w));
        }
        r0.x = r3.x;
        r0.y = r3.y;
        r0.z = r3.z;
        r0.w = r3.w;
        r1.x = r1.z;
    }
    r1.x = asuint(asfloat(r0.y) + asfloat(r0.x));
    r1.x = asuint(asfloat(r0.z) + asfloat(r1.x));
    r1.x = ((asfloat(r1.x) < 2.4) ? 0xffffffffu : 0u);
    o0.x = ((r1.x != 0u) ? 0x00000000u : r0.x);
    o0.y = ((r1.x != 0u) ? 0x00000000u : r0.y);
    o0.z = ((r1.x != 0u) ? 0x00000000u : r0.z);
    o0.w = ((r1.x != 0u) ? 0x00000000u : r0.w);
    return AdouacOutputPs(o0);
}

void main() {
    AdouacVaryings IN;
    IN.pos = gl_FragCoord;
    IN.texcoord0 = vec4(vUv, 0.0, 0.0);
    IN.color0 = vec4(1.0);
    fragColor = frag(IN);
}
