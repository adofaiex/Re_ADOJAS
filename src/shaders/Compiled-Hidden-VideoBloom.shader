// Compiled shader for custom platforms

//////////////////////////////////////////////////////////////////////////
// 
// NOTE: This is *not* a valid shader file, the contents are provided just
// for information and for debugging purposes only.
// 
//////////////////////////////////////////////////////////////////////////
// Skipping shader variants that would not be included into build of current scene.

Shader "Hidden/VideoBloom"
{
    Properties
    {
        _MainTex ("_MainTex (RGB)", 2D) = "black" { }
        _MediumBloom ("-", 2D) = "" { }
        _LargeBloom ("-", 2D) = "black" { }
    }
    SubShader
    {
        Pass
        {
            ZTest Always
            ZWrite Off
            Cull Off
            //////////////////////////////////
            //                              //
            //      Compiled programs       //
            //                              //
            //////////////////////////////////
            //////////////////////////////////////////////////////
            Keywords: <none>
            -- Hardware tier variant: Tier 1
            -- Vertex shader for "glcore":
            Set 2D Texture "_MainTex" to slot 0

            Constant Buffer "$Globals" (160 bytes) on slot 0 {
            Matrix4x4 unity_ObjectToWorld at 0
            Matrix4x4 unity_MatrixVP at 64
            Vector4 _MainTex_TexelSize at 128
            Vector4 _Param0 at 144
            }

            Shader Disassembly:
            #ifdef VERTEX
            #version 150
            #extension GL_ARB_explicit_attrib_location : require
            #ifdef GL_ARB_shader_bit_encoding
            #extension GL_ARB_shader_bit_encoding : enable
            #endif

            #define HLSLCC_ENABLE_UNIFORM_BUFFERS 1
            #if HLSLCC_ENABLE_UNIFORM_BUFFERS
            #define UNITY_UNIFORM
            #else
            #define UNITY_UNIFORM uniform
            #endif
            #define UNITY_SUPPORTS_UNIFORM_LOCATION 1
            #if UNITY_SUPPORTS_UNIFORM_LOCATION
            #define UNITY_LOCATION(x) layout(location = x)
            #define UNITY_BINDING(x) layout(binding = x, std140)
            #else
            #define UNITY_LOCATION(x)
            #define UNITY_BINDING(x) layout(std140)
            #endif
            uniform vec4 hlslcc_mtx4x4unity_ObjectToWorld[4];
            uniform vec4 hlslcc_mtx4x4unity_MatrixVP[4];
            uniform vec4 _MainTex_TexelSize;
            uniform vec4 _Param0;
            in vec4 in_POSITION0;
            in vec2 in_TEXCOORD0;
            out vec2 vs_TEXCOORD0;
            out vec2 vs_TEXCOORD1;
            out vec2 vs_TEXCOORD2;
            out vec2 vs_TEXCOORD3;
            out vec2 vs_TEXCOORD4;
            vec4 u_xlat0;
            vec4 u_xlat1;
            void main()
            {
            u_xlat0 = in_POSITION0.yyyy * hlslcc_mtx4x4unity_ObjectToWorld[1];
            u_xlat0 = hlslcc_mtx4x4unity_ObjectToWorld[0] * in_POSITION0.xxxx + u_xlat0;
            u_xlat0 = hlslcc_mtx4x4unity_ObjectToWorld[2] * in_POSITION0.zzzz + u_xlat0;
            u_xlat0 = u_xlat0 + hlslcc_mtx4x4unity_ObjectToWorld[3];
            u_xlat1 = u_xlat0.yyyy * hlslcc_mtx4x4unity_MatrixVP[1];
            u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[0] * u_xlat0.xxxx + u_xlat1;
            u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[2] * u_xlat0.zzzz + u_xlat1;
            gl_Position = hlslcc_mtx4x4unity_MatrixVP[3] * u_xlat0.wwww + u_xlat1;
            vs_TEXCOORD1.xy = _MainTex_TexelSize.xy * _Param0.xy + in_TEXCOORD0.xy;
            vs_TEXCOORD0.xy = in_TEXCOORD0.xy;
            vs_TEXCOORD2.xy = (-_MainTex_TexelSize.xy) * _Param0.xy + in_TEXCOORD0.xy;
            vs_TEXCOORD3.xy = _MainTex_TexelSize.xy * _Param0.zw + in_TEXCOORD0.xy;
            vs_TEXCOORD4.xy = (-_MainTex_TexelSize.xy) * _Param0.zw + in_TEXCOORD0.xy;
            return;
            }

            #endif
            #ifdef FRAGMENT
            #version 150
            #extension GL_ARB_explicit_attrib_location : require
            #ifdef GL_ARB_shader_bit_encoding
            #extension GL_ARB_shader_bit_encoding : enable
            #endif

            #define UNITY_SUPPORTS_UNIFORM_LOCATION 1
            #if UNITY_SUPPORTS_UNIFORM_LOCATION
            #define UNITY_LOCATION(x) layout(location = x)
            #define UNITY_BINDING(x) layout(binding = x, std140)
            #else
            #define UNITY_LOCATION(x)
            #define UNITY_BINDING(x) layout(std140)
            #endif
            UNITY_LOCATION(0) uniform sampler2D _MainTex;
            in vec2 vs_TEXCOORD0;
            in vec2 vs_TEXCOORD1;
            in vec2 vs_TEXCOORD2;
            in vec2 vs_TEXCOORD3;
            in vec2 vs_TEXCOORD4;
            layout(location = 0) out vec4 SV_Target0;
            vec4 u_xlat0;
            vec4 u_xlat1;
            void main()
            {
            u_xlat0 = texture(_MainTex, vs_TEXCOORD1.xy);
            u_xlat1 = texture(_MainTex, vs_TEXCOORD2.xy);
            u_xlat0 = u_xlat0 + u_xlat1;
            u_xlat1 = texture(_MainTex, vs_TEXCOORD3.xy);
            u_xlat0 = u_xlat0 + u_xlat1;
            u_xlat1 = texture(_MainTex, vs_TEXCOORD4.xy);
            u_xlat0 = u_xlat0 + u_xlat1;
            u_xlat0 = u_xlat0 * vec4(0.204500005, 0.204500005, 0.204500005, 0.204500005);
            u_xlat1 = texture(_MainTex, vs_TEXCOORD0.xy);
            SV_Target0 = u_xlat1 * vec4(0.181999996, 0.181999996, 0.181999996, 0.181999996) + u_xlat0;
            return;
            }

            #endif


        }
        Pass
        {
            ZTest Always
            ZWrite Off
            Cull Off
            //////////////////////////////////
            //                              //
            //      Compiled programs       //
            //                              //
            //////////////////////////////////
            //////////////////////////////////////////////////////
            Keywords: <none>
            -- Hardware tier variant: Tier 1
            -- Vertex shader for "glcore":
            Set 2D Texture "_MainTex" to slot 0

            Constant Buffer "$Globals" (4 bytes) on slot 0 {
            Matrix4x4 unity_MatrixVP at 64
            Float _Param2 at 0
            Vector4 _MainTex_TexelSize at 128
            Vector4 _Param0 at 144
            }

            Shader Disassembly:
            #ifdef VERTEX
            #version 150
            #extension GL_ARB_explicit_attrib_location : require
            #ifdef GL_ARB_shader_bit_encoding
            #extension GL_ARB_shader_bit_encoding : enable
            #endif

            #define HLSLCC_ENABLE_UNIFORM_BUFFERS 1
            #if HLSLCC_ENABLE_UNIFORM_BUFFERS
            #define UNITY_UNIFORM
            #else
            #define UNITY_UNIFORM uniform
            #endif
            #define UNITY_SUPPORTS_UNIFORM_LOCATION 1
            #if UNITY_SUPPORTS_UNIFORM_LOCATION
            #define UNITY_LOCATION(x) layout(location = x)
            #define UNITY_BINDING(x) layout(binding = x, std140)
            #else
            #define UNITY_LOCATION(x)
            #define UNITY_BINDING(x) layout(std140)
            #endif
            uniform vec4 hlslcc_mtx4x4unity_ObjectToWorld[4];
            uniform vec4 hlslcc_mtx4x4unity_MatrixVP[4];
            uniform vec4 _MainTex_TexelSize;
            uniform vec4 _Param0;
            in vec4 in_POSITION0;
            in vec2 in_TEXCOORD0;
            out vec2 vs_TEXCOORD0;
            out vec2 vs_TEXCOORD1;
            out vec2 vs_TEXCOORD2;
            out vec2 vs_TEXCOORD3;
            out vec2 vs_TEXCOORD4;
            vec4 u_xlat0;
            vec4 u_xlat1;
            void main()
            {
            u_xlat0 = in_POSITION0.yyyy * hlslcc_mtx4x4unity_ObjectToWorld[1];
            u_xlat0 = hlslcc_mtx4x4unity_ObjectToWorld[0] * in_POSITION0.xxxx + u_xlat0;
            u_xlat0 = hlslcc_mtx4x4unity_ObjectToWorld[2] * in_POSITION0.zzzz + u_xlat0;
            u_xlat0 = u_xlat0 + hlslcc_mtx4x4unity_ObjectToWorld[3];
            u_xlat1 = u_xlat0.yyyy * hlslcc_mtx4x4unity_MatrixVP[1];
            u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[0] * u_xlat0.xxxx + u_xlat1;
            u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[2] * u_xlat0.zzzz + u_xlat1;
            gl_Position = hlslcc_mtx4x4unity_MatrixVP[3] * u_xlat0.wwww + u_xlat1;
            vs_TEXCOORD1.xy = _MainTex_TexelSize.xy * _Param0.xy + in_TEXCOORD0.xy;
            vs_TEXCOORD0.xy = in_TEXCOORD0.xy;
            vs_TEXCOORD2.xy = (-_MainTex_TexelSize.xy) * _Param0.xy + in_TEXCOORD0.xy;
            vs_TEXCOORD3.xy = _MainTex_TexelSize.xy * _Param0.zw + in_TEXCOORD0.xy;
            vs_TEXCOORD4.xy = (-_MainTex_TexelSize.xy) * _Param0.zw + in_TEXCOORD0.xy;
            return;
            }

            #endif
            #ifdef FRAGMENT
            #version 150
            #extension GL_ARB_explicit_attrib_location : require
            #ifdef GL_ARB_shader_bit_encoding
            #extension GL_ARB_shader_bit_encoding : enable
            #endif

            #define HLSLCC_ENABLE_UNIFORM_BUFFERS 1
            #if HLSLCC_ENABLE_UNIFORM_BUFFERS
            #define UNITY_UNIFORM
            #else
            #define UNITY_UNIFORM uniform
            #endif
            #define UNITY_SUPPORTS_UNIFORM_LOCATION 1
            #if UNITY_SUPPORTS_UNIFORM_LOCATION
            #define UNITY_LOCATION(x) layout(location = x)
            #define UNITY_BINDING(x) layout(binding = x, std140)
            #else
            #define UNITY_LOCATION(x)
            #define UNITY_BINDING(x) layout(std140)
            #endif
            uniform float _Param2;
            UNITY_LOCATION(0) uniform sampler2D _MainTex;
            in vec2 vs_TEXCOORD0;
            in vec2 vs_TEXCOORD1;
            in vec2 vs_TEXCOORD2;
            in vec2 vs_TEXCOORD3;
            in vec2 vs_TEXCOORD4;
            layout(location = 0) out vec4 SV_Target0;
            vec4 u_xlat0;
            vec4 u_xlat1;
            void main()
            {
            u_xlat0 = texture(_MainTex, vs_TEXCOORD1.xy);
            u_xlat1 = texture(_MainTex, vs_TEXCOORD2.xy);
            u_xlat0 = u_xlat0 + u_xlat1;
            u_xlat1 = texture(_MainTex, vs_TEXCOORD3.xy);
            u_xlat0 = u_xlat0 + u_xlat1;
            u_xlat1 = texture(_MainTex, vs_TEXCOORD4.xy);
            u_xlat0 = u_xlat0 + u_xlat1;
            u_xlat0 = u_xlat0 * vec4(0.204500005, 0.204500005, 0.204500005, 0.204500005);
            u_xlat1 = texture(_MainTex, vs_TEXCOORD0.xy);
            u_xlat0 = u_xlat1 * vec4(0.181999996, 0.181999996, 0.181999996, 0.181999996) + u_xlat0;
            u_xlat0 = (-u_xlat1) + u_xlat0;
            SV_Target0 = vec4(_Param2) * u_xlat0 + u_xlat1;
            return;
            }

            #endif


        }
        Pass
        {
            ZTest Always
            ZWrite Off
            Cull Off
            //////////////////////////////////
            //                              //
            //      Compiled programs       //
            //                              //
            //////////////////////////////////
            //////////////////////////////////////////////////////
            Keywords: <none>
            -- Hardware tier variant: Tier 1
            -- Vertex shader for "glcore":
            Set 2D Texture "_MainTex" to slot 0

            Constant Buffer "$Globals" (4 bytes) on slot 0 {
            Matrix4x4 unity_MatrixVP at 64
            Float _Param2 at 0
            }

            Shader Disassembly:
            #ifdef VERTEX
            #version 150
            #extension GL_ARB_explicit_attrib_location : require
            #ifdef GL_ARB_shader_bit_encoding
            #extension GL_ARB_shader_bit_encoding : enable
            #endif

            #define HLSLCC_ENABLE_UNIFORM_BUFFERS 1
            #if HLSLCC_ENABLE_UNIFORM_BUFFERS
            #define UNITY_UNIFORM
            #else
            #define UNITY_UNIFORM uniform
            #endif
            #define UNITY_SUPPORTS_UNIFORM_LOCATION 1
            #if UNITY_SUPPORTS_UNIFORM_LOCATION
            #define UNITY_LOCATION(x) layout(location = x)
            #define UNITY_BINDING(x) layout(binding = x, std140)
            #else
            #define UNITY_LOCATION(x)
            #define UNITY_BINDING(x) layout(std140)
            #endif
            uniform vec4 hlslcc_mtx4x4unity_ObjectToWorld[4];
            uniform vec4 hlslcc_mtx4x4unity_MatrixVP[4];
            in vec4 in_POSITION0;
            in vec2 in_TEXCOORD0;
            out vec2 vs_TEXCOORD0;
            vec4 u_xlat0;
            vec4 u_xlat1;
            void main()
            {
            u_xlat0 = in_POSITION0.yyyy * hlslcc_mtx4x4unity_ObjectToWorld[1];
            u_xlat0 = hlslcc_mtx4x4unity_ObjectToWorld[0] * in_POSITION0.xxxx + u_xlat0;
            u_xlat0 = hlslcc_mtx4x4unity_ObjectToWorld[2] * in_POSITION0.zzzz + u_xlat0;
            u_xlat0 = u_xlat0 + hlslcc_mtx4x4unity_ObjectToWorld[3];
            u_xlat1 = u_xlat0.yyyy * hlslcc_mtx4x4unity_MatrixVP[1];
            u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[0] * u_xlat0.xxxx + u_xlat1;
            u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[2] * u_xlat0.zzzz + u_xlat1;
            gl_Position = hlslcc_mtx4x4unity_MatrixVP[3] * u_xlat0.wwww + u_xlat1;
            vs_TEXCOORD0.xy = in_TEXCOORD0.xy;
            return;
            }

            #endif
            #ifdef FRAGMENT
            #version 150
            #extension GL_ARB_explicit_attrib_location : require
            #ifdef GL_ARB_shader_bit_encoding
            #extension GL_ARB_shader_bit_encoding : enable
            #endif

            #define HLSLCC_ENABLE_UNIFORM_BUFFERS 1
            #if HLSLCC_ENABLE_UNIFORM_BUFFERS
            #define UNITY_UNIFORM
            #else
            #define UNITY_UNIFORM uniform
            #endif
            #define UNITY_SUPPORTS_UNIFORM_LOCATION 1
            #if UNITY_SUPPORTS_UNIFORM_LOCATION
            #define UNITY_LOCATION(x) layout(location = x)
            #define UNITY_BINDING(x) layout(binding = x, std140)
            #else
            #define UNITY_LOCATION(x)
            #define UNITY_BINDING(x) layout(std140)
            #endif
            uniform float _Param2;
            UNITY_LOCATION(0) uniform sampler2D _MainTex;
            in vec2 vs_TEXCOORD0;
            layout(location = 0) out vec4 SV_Target0;
            vec4 u_xlat0;
            float u_xlat1;
            bool u_xlatb1;
            void main()
            {
            u_xlat0 = texture(_MainTex, vs_TEXCOORD0.xy);
            u_xlat1 = dot(u_xlat0.xyz, vec3(0.300000012, 0.589999974, 0.109999999));
            u_xlatb1 = u_xlat1<_Param2;
            SV_Target0 = (bool(u_xlatb1)) ? vec4(0.0, 0.0, 0.0, 0.0) : u_xlat0;
            return;
            }

            #endif


        }
        Pass
        {
            ZTest Always
            ZWrite Off
            Cull Off
            //////////////////////////////////
            //                              //
            //      Compiled programs       //
            //                              //
            //////////////////////////////////
            //////////////////////////////////////////////////////
            Keywords: <none>
            -- Hardware tier variant: Tier 1
            -- Vertex shader for "glcore":
            Set 2D Texture "_MainTex" to slot 0
            Set 2D Texture "_MediumBloom" to slot 1
            Set 2D Texture "_LargeBloom" to slot 2

            Constant Buffer "$Globals" (32 bytes) on slot 0 {
            Matrix4x4 unity_MatrixVP at 64
            Vector4 _Param0 at 0
            Vector4 _Param1 at 16
            }

            Shader Disassembly:
            #ifdef VERTEX
            #version 150
            #extension GL_ARB_explicit_attrib_location : require
            #ifdef GL_ARB_shader_bit_encoding
            #extension GL_ARB_shader_bit_encoding : enable
            #endif

            #define HLSLCC_ENABLE_UNIFORM_BUFFERS 1
            #if HLSLCC_ENABLE_UNIFORM_BUFFERS
            #define UNITY_UNIFORM
            #else
            #define UNITY_UNIFORM uniform
            #endif
            #define UNITY_SUPPORTS_UNIFORM_LOCATION 1
            #if UNITY_SUPPORTS_UNIFORM_LOCATION
            #define UNITY_LOCATION(x) layout(location = x)
            #define UNITY_BINDING(x) layout(binding = x, std140)
            #else
            #define UNITY_LOCATION(x)
            #define UNITY_BINDING(x) layout(std140)
            #endif
            uniform vec4 hlslcc_mtx4x4unity_ObjectToWorld[4];
            uniform vec4 hlslcc_mtx4x4unity_MatrixVP[4];
            in vec4 in_POSITION0;
            in vec2 in_TEXCOORD0;
            out vec2 vs_TEXCOORD0;
            vec4 u_xlat0;
            vec4 u_xlat1;
            void main()
            {
            u_xlat0 = in_POSITION0.yyyy * hlslcc_mtx4x4unity_ObjectToWorld[1];
            u_xlat0 = hlslcc_mtx4x4unity_ObjectToWorld[0] * in_POSITION0.xxxx + u_xlat0;
            u_xlat0 = hlslcc_mtx4x4unity_ObjectToWorld[2] * in_POSITION0.zzzz + u_xlat0;
            u_xlat0 = u_xlat0 + hlslcc_mtx4x4unity_ObjectToWorld[3];
            u_xlat1 = u_xlat0.yyyy * hlslcc_mtx4x4unity_MatrixVP[1];
            u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[0] * u_xlat0.xxxx + u_xlat1;
            u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[2] * u_xlat0.zzzz + u_xlat1;
            gl_Position = hlslcc_mtx4x4unity_MatrixVP[3] * u_xlat0.wwww + u_xlat1;
            vs_TEXCOORD0.xy = in_TEXCOORD0.xy;
            return;
            }

            #endif
            #ifdef FRAGMENT
            #version 150
            #extension GL_ARB_explicit_attrib_location : require
            #ifdef GL_ARB_shader_bit_encoding
            #extension GL_ARB_shader_bit_encoding : enable
            #endif

            #define HLSLCC_ENABLE_UNIFORM_BUFFERS 1
            #if HLSLCC_ENABLE_UNIFORM_BUFFERS
            #define UNITY_UNIFORM
            #else
            #define UNITY_UNIFORM uniform
            #endif
            #define UNITY_SUPPORTS_UNIFORM_LOCATION 1
            #if UNITY_SUPPORTS_UNIFORM_LOCATION
            #define UNITY_LOCATION(x) layout(location = x)
            #define UNITY_BINDING(x) layout(binding = x, std140)
            #else
            #define UNITY_LOCATION(x)
            #define UNITY_BINDING(x) layout(std140)
            #endif
            uniform vec4 _Param0;
            uniform vec4 _Param1;
            UNITY_LOCATION(0) uniform sampler2D _MainTex;
            UNITY_LOCATION(1) uniform sampler2D _MediumBloom;
            UNITY_LOCATION(2) uniform sampler2D _LargeBloom;
            in vec2 vs_TEXCOORD0;
            layout(location = 0) out vec4 SV_Target0;
            vec4 u_xlat0;
            vec4 u_xlat1;
            void main()
            {
            u_xlat0 = texture(_LargeBloom, vs_TEXCOORD0.xy);
            u_xlat0 = u_xlat0 * _Param1;
            u_xlat0 = u_xlat0 * _Param0.yyyy;
            u_xlat1 = texture(_MediumBloom, vs_TEXCOORD0.xy);
            u_xlat1 = u_xlat1 * _Param1;
            u_xlat0 = u_xlat1 * _Param0.xxxx + u_xlat0;
            u_xlat1 = texture(_MainTex, vs_TEXCOORD0.xy);
            SV_Target0 = u_xlat0 + u_xlat1;
            return;
            }

            #endif


        }
        Pass
        {
            ZTest Always
            ZWrite Off
            Cull Off
            //////////////////////////////////
            //                              //
            //      Compiled programs       //
            //                              //
            //////////////////////////////////
            //////////////////////////////////////////////////////
            Keywords: <none>
            -- Hardware tier variant: Tier 1
            -- Vertex shader for "glcore":
            Set 2D Texture "_MainTex" to slot 0
            Set 2D Texture "_MediumBloom" to slot 1
            Set 2D Texture "_LargeBloom" to slot 2

            Constant Buffer "$Globals" (32 bytes) on slot 0 {
            Matrix4x4 unity_MatrixVP at 64
            Vector4 _Param0 at 0
            Vector4 _Param1 at 16
            }

            Shader Disassembly:
            #ifdef VERTEX
            #version 150
            #extension GL_ARB_explicit_attrib_location : require
            #ifdef GL_ARB_shader_bit_encoding
            #extension GL_ARB_shader_bit_encoding : enable
            #endif

            #define HLSLCC_ENABLE_UNIFORM_BUFFERS 1
            #if HLSLCC_ENABLE_UNIFORM_BUFFERS
            #define UNITY_UNIFORM
            #else
            #define UNITY_UNIFORM uniform
            #endif
            #define UNITY_SUPPORTS_UNIFORM_LOCATION 1
            #if UNITY_SUPPORTS_UNIFORM_LOCATION
            #define UNITY_LOCATION(x) layout(location = x)
            #define UNITY_BINDING(x) layout(binding = x, std140)
            #else
            #define UNITY_LOCATION(x)
            #define UNITY_BINDING(x) layout(std140)
            #endif
            uniform vec4 hlslcc_mtx4x4unity_ObjectToWorld[4];
            uniform vec4 hlslcc_mtx4x4unity_MatrixVP[4];
            in vec4 in_POSITION0;
            in vec2 in_TEXCOORD0;
            out vec2 vs_TEXCOORD0;
            vec4 u_xlat0;
            vec4 u_xlat1;
            void main()
            {
            u_xlat0 = in_POSITION0.yyyy * hlslcc_mtx4x4unity_ObjectToWorld[1];
            u_xlat0 = hlslcc_mtx4x4unity_ObjectToWorld[0] * in_POSITION0.xxxx + u_xlat0;
            u_xlat0 = hlslcc_mtx4x4unity_ObjectToWorld[2] * in_POSITION0.zzzz + u_xlat0;
            u_xlat0 = u_xlat0 + hlslcc_mtx4x4unity_ObjectToWorld[3];
            u_xlat1 = u_xlat0.yyyy * hlslcc_mtx4x4unity_MatrixVP[1];
            u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[0] * u_xlat0.xxxx + u_xlat1;
            u_xlat1 = hlslcc_mtx4x4unity_MatrixVP[2] * u_xlat0.zzzz + u_xlat1;
            gl_Position = hlslcc_mtx4x4unity_MatrixVP[3] * u_xlat0.wwww + u_xlat1;
            vs_TEXCOORD0.xy = in_TEXCOORD0.xy;
            return;
            }

            #endif
            #ifdef FRAGMENT
            #version 150
            #extension GL_ARB_explicit_attrib_location : require
            #ifdef GL_ARB_shader_bit_encoding
            #extension GL_ARB_shader_bit_encoding : enable
            #endif

            #define HLSLCC_ENABLE_UNIFORM_BUFFERS 1
            #if HLSLCC_ENABLE_UNIFORM_BUFFERS
            #define UNITY_UNIFORM
            #else
            #define UNITY_UNIFORM uniform
            #endif
            #define UNITY_SUPPORTS_UNIFORM_LOCATION 1
            #if UNITY_SUPPORTS_UNIFORM_LOCATION
            #define UNITY_LOCATION(x) layout(location = x)
            #define UNITY_BINDING(x) layout(binding = x, std140)
            #else
            #define UNITY_LOCATION(x)
            #define UNITY_BINDING(x) layout(std140)
            #endif
            uniform vec4 _Param0;
            uniform vec4 _Param1;
            UNITY_LOCATION(0) uniform sampler2D _MainTex;
            UNITY_LOCATION(1) uniform sampler2D _MediumBloom;
            UNITY_LOCATION(2) uniform sampler2D _LargeBloom;
            in vec2 vs_TEXCOORD0;
            layout(location = 0) out vec4 SV_Target0;
            vec4 u_xlat0;
            vec4 u_xlat1;
            vec4 u_xlat2;
            void main()
            {
            u_xlat0 = texture(_LargeBloom, vs_TEXCOORD0.xy);
            u_xlat0 = u_xlat0 * _Param1;
            u_xlat0 = u_xlat0 * _Param0.yyyy;
            u_xlat1 = texture(_MediumBloom, vs_TEXCOORD0.xy);
            u_xlat1 = u_xlat1 * _Param1;
            u_xlat0 = u_xlat1 * _Param0.xxxx + u_xlat0;
            u_xlat1 = texture(_MainTex, vs_TEXCOORD0.xy);
            u_xlat2 = u_xlat0 + u_xlat1;
            u_xlat0 = (-u_xlat1) * u_xlat0 + u_xlat2;
            SV_Target0 = max(u_xlat0, u_xlat1);
            return;
            }

            #endif


        }
    }
    Fallback Off
}