precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D _MainTex;
uniform vec4 _ScreenResolution;
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

struct appdata
            {
                vec4 vertex : POSITION;
                vec4 color ;
                vec2 texcoord ;
            };
            
            
            


            
            
            
            vec4 frag(v2f i) 
            {
                // 将UV坐标转换为以中心为原点的坐标系
                vec2 uv = i.texcoord - vec2(0.5, 0.5);
                
                // 计算极坐标
                // 计算半径 (0 到 ~0.7)
                float radius = length(uv);
                
                // 计算角度 (0 到 2π)
                float angle = atan2(uv.y, uv.x);
                
                // 将角度归一化到 0-1 范围
                float normalizedAngle = angle * 0.159155; // 1/(2*PI)
                
                // 处理负角度
                if (normalizedAngle < 0)
                    normalizedAngle = 1.0 + normalizedAngle;
                
                // 调整半径映射
                radius = radius + 0.4;
                
                // 确保坐标在 0-1 范围内
                radius = fract(radius);
                normalizedAngle = fract(normalizedAngle);
                
                // 应用颜色调整
                vec2 polarCoord = vec2(radius, normalizedAngle) * i.color.xy;
                
                // 采样纹理
                return texture(_MainTex, polarCoord);
            }

void main() {
    v2f IN;
    IN.texcoord = vUv;
    IN.vertex = gl_FragCoord;
    IN.color = vec4(1.0);
    fragColor = frag(IN);
}
