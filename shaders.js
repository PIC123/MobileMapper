// Shader definitions for projection mapping content
const SHADERS = {
    rainbow: {
        name: 'Rainbow',
        fragment: `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            void main() {
                vec2 uv = v_texCoord;
                float hue = uv.x + u_time * 0.1;
                vec3 color = hsv2rgb(vec3(hue, 0.8, 1.0));
                gl_FragColor = vec4(color, 1.0);
            }
        `
    },

    plasma: {
        name: 'Plasma',
        fragment: `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            void main() {
                vec2 uv = v_texCoord * 4.0;
                float v1 = sin(uv.x + u_time);
                float v2 = sin(uv.y + u_time);
                float v3 = sin(uv.x + uv.y + u_time);
                float v4 = sin(sqrt(uv.x * uv.x + uv.y * uv.y) + u_time);
                float v = (v1 + v2 + v3 + v4) / 4.0;

                vec3 color = vec3(
                    sin(v * 3.14159),
                    sin(v * 3.14159 + 2.0),
                    sin(v * 3.14159 + 4.0)
                );
                gl_FragColor = vec4(color * 0.5 + 0.5, 1.0);
            }
        `
    },

    waves: {
        name: 'Waves',
        fragment: `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            void main() {
                vec2 uv = v_texCoord;
                float wave = sin(uv.x * 10.0 + u_time * 2.0) * 0.5 + 0.5;
                wave *= sin(uv.y * 10.0 + u_time * 2.0) * 0.5 + 0.5;

                vec3 color1 = vec3(0.2, 0.5, 1.0);
                vec3 color2 = vec3(1.0, 0.3, 0.7);
                vec3 color = mix(color1, color2, wave);

                gl_FragColor = vec4(color, 1.0);
            }
        `
    },

    checkerboard: {
        name: 'Checkerboard',
        fragment: `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            void main() {
                vec2 uv = v_texCoord * 8.0;
                float pattern = mod(floor(uv.x) + floor(uv.y), 2.0);

                vec3 color1 = vec3(1.0, 1.0, 1.0);
                vec3 color2 = vec3(0.0, 0.0, 0.0);
                vec3 color = mix(color1, color2, pattern);

                gl_FragColor = vec4(color, 1.0);
            }
        `
    },

    solid: {
        name: 'Solid Color',
        fragment: `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            void main() {
                vec3 color = vec3(1.0, 1.0, 1.0);
                gl_FragColor = vec4(color, 1.0);
            }
        `
    }
};

// Vertex shader (same for all)
const VERTEX_SHADER = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`;
