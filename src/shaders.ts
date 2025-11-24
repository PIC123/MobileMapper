// Shader definitions for projection mapping content

const COMMON_UNIFORMS = `
    uniform float u_borderWidth;
    uniform vec3 u_borderColor;
    uniform int u_enableBorder;
    uniform float u_borderSpeed;

    uniform float u_brightness;
    uniform float u_contrast;
    uniform float u_saturation;
    uniform float u_hue;
    
    uniform int u_patternMode; // 0: None, 1: Scanlines, 2: Dots, 3: Grid
    uniform float u_patternScale;
    uniform float u_patternIntensity;
    uniform float u_patternSpeed;

    // Audio Reactivity
    uniform float u_audioLow;
    uniform float u_audioMid;
    uniform float u_audioHigh;
    uniform float u_audioLevel;
    
    // Per-Shape Audio Settings
    uniform float u_audioBassScale;
    uniform float u_audioMidScale;
    uniform float u_audioHighScale;
    uniform float u_audioGain;
`;

// Helpers for main function logic (UV modification and Border Detection)
const SHADER_HELPERS = `
    vec2 getEffectUV(vec2 uv) {
        // For "Outer Border" effect, we map the polygon texture 0-1 range
        // to a sub-region inside the border.
        // UVs: 0 -> border, 1 -> 1-border
        if (u_enableBorder == 1) {
            return (uv - u_borderWidth) / (1.0 - 2.0 * u_borderWidth);
        }
        return uv;
    }

    bool isBorder(vec2 uv) {
        if (u_enableBorder == 1) {
            return (uv.x < u_borderWidth || uv.x > 1.0 - u_borderWidth || uv.y < u_borderWidth || uv.y > 1.0 - u_borderWidth);
        }
        return false;
    }

    vec3 getBorderColor(float time) {
        vec3 col = u_borderColor;
        
        // React to bass for border pulse if audio is active
        // Apply per-shape scaling
        float audioPulse = u_audioLow * u_audioBassScale * u_audioGain * 0.5;
        
        if (u_borderSpeed > 0.0) {
            // Pulsing effect
            float pulse = sin(time * u_borderSpeed) * 0.5 + 0.5;
            col = mix(col * 0.5, col, pulse + audioPulse);
        } else if (u_audioLevel > 0.01) {
             col = mix(col, col * 1.5, audioPulse);
        }
        return col;
    }
`;

const EFFECT_LOGIC = `
    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    vec3 applyColorAdjustments(vec3 color) {
        vec3 finalColor = color;
        
        // Brightness - Audio Reactivity: Highs affect brightness
        finalColor += u_brightness + (u_audioHigh * u_audioHighScale * u_audioGain * 0.2);
        
        // Contrast
        finalColor = (finalColor - 0.5) * u_contrast + 0.5;
        
        // Saturation & Hue
        vec3 hsv = rgb2hsv(finalColor);
        hsv.y *= u_saturation;
        hsv.x += u_hue;
        finalColor = hsv2rgb(hsv);
        
        return finalColor;
    }

    vec3 applyPattern(vec3 color, vec2 uv, float time) {
        if (u_patternMode > 0) {
            float pattern = 0.0;
            vec2 puv = uv * u_patternScale;
            
            // Animate pattern
            // Audio reactivity: Speed up pattern with volume
            float t = time * u_patternSpeed + (u_audioLevel * u_audioGain * time * 2.0);

            if (u_patternMode == 1) { // Scanlines
                // Distort scanlines with mid frequencies
                float distortion = sin(puv.x * 5.0 + t) * u_audioMid * u_audioMidScale * u_audioGain * 0.1;
                pattern = sin((puv.y + distortion) * 3.14159 + t * 5.0) * 0.5 + 0.5;
            } else if (u_patternMode == 2) { // Dots
                vec2 g = fract(puv + vec2(t * 0.5, t * 0.5)) - 0.5;
                // Pulse dots with low freq
                float size = 0.25 + (u_audioLow * u_audioBassScale * u_audioGain * 0.1);
                pattern = 1.0 - step(length(g), size);
            } else if (u_patternMode == 3) { // Grid
                vec2 g = abs(fract(puv + vec2(t * 0.2)) - 0.5);
                float thickness = 0.45 - (u_audioHigh * u_audioHighScale * u_audioGain * 0.1);
                pattern = step(max(g.x, g.y), thickness); 
            }
            
            return mix(color, color * pattern, u_patternIntensity);
        }
        return color;
    }
`;

export const SHADERS: {[key: string]: {name: string, fragment: string}} = {
  rainbow: {
    name: "Rainbow",
    fragment: `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;
            
            ${COMMON_UNIFORMS}
            ${SHADER_HELPERS}
            
            vec3 custom_hsv2rgb(vec3 c) { 
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            ${EFFECT_LOGIC}

            void main() {
                vec2 uv = v_texCoord; // Original 0-1 of polygon
                
                if (isBorder(uv)) {
                    gl_FragColor = vec4(getBorderColor(u_time), 1.0);
                    return;
                }

                // Content UV
                vec2 contentUV = getEffectUV(uv);
                
                // Shift hue with audio
                float hue = contentUV.x + u_time * 0.1 + (u_audioMid * u_audioMidScale * u_audioGain * 0.2);
                vec3 color = custom_hsv2rgb(vec3(hue, 0.8, 1.0));
                
                color = applyPattern(color, contentUV, u_time);
                color = applyColorAdjustments(color);
                
                gl_FragColor = vec4(color, 1.0);
            }
        `,
  },

  plasma: {
    name: "Plasma",
    fragment: `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${COMMON_UNIFORMS}
            ${SHADER_HELPERS}
            ${EFFECT_LOGIC}

            void main() {
                vec2 uv = v_texCoord;
                
                if (isBorder(uv)) {
                    gl_FragColor = vec4(getBorderColor(u_time), 1.0);
                    return;
                }

                vec2 contentUV = getEffectUV(uv);
                vec2 puv = contentUV * 4.0;

                float v1 = sin(puv.x + u_time);
                float v2 = sin(puv.y + u_time);
                float v3 = sin(puv.x + puv.y + u_time);
                float v4 = sin(sqrt(puv.x * puv.x + puv.y * puv.y) + u_time);
                float v = (v1 + v2 + v3 + v4) / 4.0;

                vec3 color = vec3(
                    sin(v * 3.14159 + u_audioLow * u_audioBassScale * u_audioGain),
                    sin(v * 3.14159 + 2.0 + u_audioMid * u_audioMidScale * u_audioGain),
                    sin(v * 3.14159 + 4.0)
                );
                
                vec3 baseColor = color * 0.5 + 0.5;
                baseColor = applyPattern(baseColor, contentUV, u_time);
                baseColor = applyColorAdjustments(baseColor);
                
                gl_FragColor = vec4(baseColor, 1.0);
            }
        `,
  },

  waves: {
    name: "Waves",
    fragment: `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${COMMON_UNIFORMS}
            ${SHADER_HELPERS}
            ${EFFECT_LOGIC}

            void main() {
                vec2 uv = v_texCoord;
                
                if (isBorder(uv)) {
                    gl_FragColor = vec4(getBorderColor(u_time), 1.0);
                    return;
                }

                vec2 contentUV = getEffectUV(uv);
                
                float wave = sin(contentUV.x * 10.0 + u_time * 2.0) * 0.5 + 0.5;
                wave *= sin(contentUV.y * 10.0 + u_time * 2.0 + u_audioLow * u_audioBassScale * u_audioGain * 5.0) * 0.5 + 0.5;

                vec3 color1 = vec3(0.2, 0.5, 1.0);
                vec3 color2 = vec3(1.0, 0.3, 0.7);
                vec3 color = mix(color1, color2, wave);

                color = applyPattern(color, contentUV, u_time);
                color = applyColorAdjustments(color);

                gl_FragColor = vec4(color, 1.0);
            }
        `,
  },

  checkerboard: {
    name: "Checkerboard",
    fragment: `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${COMMON_UNIFORMS}
            ${SHADER_HELPERS}
            ${EFFECT_LOGIC}

            void main() {
                vec2 uv = v_texCoord;
                
                if (isBorder(uv)) {
                    gl_FragColor = vec4(getBorderColor(u_time), 1.0);
                    return;
                }

                vec2 contentUV = getEffectUV(uv);
                vec2 puv = contentUV * 8.0;
                
                // Distort checkerboard with audio
                puv.x += sin(puv.y * 0.5 + u_time) * u_audioLow * u_audioBassScale * u_audioGain;
                
                float pattern = mod(floor(puv.x) + floor(puv.y), 2.0);

                vec3 color1 = vec3(1.0, 1.0, 1.0);
                vec3 color2 = vec3(0.0, 0.0, 0.0);
                vec3 color = mix(color1, color2, pattern);

                color = applyPattern(color, contentUV, u_time);
                color = applyColorAdjustments(color);

                gl_FragColor = vec4(color, 1.0);
            }
        `,
  },

  solid: {
    name: "Solid Color",
    fragment: `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${COMMON_UNIFORMS}
            ${SHADER_HELPERS}
            ${EFFECT_LOGIC}

            void main() {
                vec2 uv = v_texCoord;
                
                if (isBorder(uv)) {
                    gl_FragColor = vec4(getBorderColor(u_time), 1.0);
                    return;
                }
                
                vec2 contentUV = getEffectUV(uv);
                vec3 color = vec3(1.0, 1.0, 1.0);
                
                // Pulse intensity with audio
                color *= (0.8 + u_audioLevel * u_audioGain * 0.4);
                
                color = applyPattern(color, contentUV, u_time);
                color = applyColorAdjustments(color);
                
                gl_FragColor = vec4(color, 1.0);
            }
        `,
  },

  grid: {
    name: "Grid",
    fragment: `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${COMMON_UNIFORMS}
            ${SHADER_HELPERS}
            ${EFFECT_LOGIC}

            void main() {
                vec2 uv = v_texCoord;
                
                if (isBorder(uv)) {
                    gl_FragColor = vec4(getBorderColor(u_time), 1.0);
                    return;
                }

                vec2 contentUV = getEffectUV(uv);
                vec2 puv = contentUV * 10.0;
                
                // Grid lines
                float thickness = 0.05 + u_audioHigh * u_audioHighScale * u_audioGain * 0.05;
                float gx = step(1.0 - thickness, fract(puv.x));
                float gy = step(1.0 - thickness, fract(puv.y));
                float grid = max(gx, gy);
                
                vec3 color = vec3(grid);
                
                color = applyPattern(color, contentUV, u_time);
                color = applyColorAdjustments(color);
                
                gl_FragColor = vec4(color, 1.0);
            }
        `,
  },

  kaleidoscope: {
      name: "Kaleidoscope",
      fragment: `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${COMMON_UNIFORMS}
            ${SHADER_HELPERS}
            ${EFFECT_LOGIC}

            void main() {
                vec2 uv = v_texCoord;
                
                if (isBorder(uv)) {
                    gl_FragColor = vec4(getBorderColor(u_time), 1.0);
                    return;
                }
                
                vec2 contentUV = getEffectUV(uv);
                
                // Centered UV
                vec2 p = contentUV - 0.5;
                float r = length(p);
                float a = atan(p.y, p.x);
                
                // Audio reactivity
                float sides = 6.0 + floor(u_audioMid * u_audioMidScale * u_audioGain * 10.0);
                float tau = 6.28318;
                
                a = mod(a, tau/sides);
                a = abs(a - tau/sides/2.0);
                
                vec2 newUV = r * vec2(cos(a), sin(a));
                
                // Color pattern
                float c = cos(newUV.x * 20.0 + u_time) * sin(newUV.y * 20.0 + u_time);
                vec3 color = vec3(
                    c + u_audioLow * u_audioBassScale * u_audioGain, 
                    c * 0.5 + u_audioMid * u_audioMidScale * u_audioGain, 
                    c * 0.2 + u_audioHigh * u_audioHighScale * u_audioGain
                );
                
                color = applyPattern(color, contentUV, u_time);
                color = applyColorAdjustments(color);
                
                gl_FragColor = vec4(color, 1.0);
            }
      `
  },

  fractal: {
      name: "Fractal",
      fragment: `
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${COMMON_UNIFORMS}
            ${SHADER_HELPERS}
            ${EFFECT_LOGIC}

            void main() {
                vec2 uv = v_texCoord;
                
                if (isBorder(uv)) {
                    gl_FragColor = vec4(getBorderColor(u_time), 1.0);
                    return;
                }
                
                vec2 contentUV = getEffectUV(uv);
                vec2 p = (contentUV - 0.5) * 2.0;
                
                // Mandelbrot-ish Iteration
                vec2 c = vec2(sin(u_time * 0.2), cos(u_time * 0.3));
                // Audio disturbs the constant
                c += vec2(u_audioLow * u_audioBassScale * u_audioGain * 0.1, u_audioMid * u_audioMidScale * u_audioGain * 0.1);
                
                vec2 z = p;
                float iter = 0.0;
                for(int i=0; i<10; i++) {
                    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
                    if(length(z) > 4.0) break;
                    iter += 1.0;
                }
                
                float val = iter / 10.0;
                vec3 color = vec3(val, val * 0.5, 1.0 - val);
                
                color = applyPattern(color, contentUV, u_time);
                color = applyColorAdjustments(color);
                
                gl_FragColor = vec4(color, 1.0);
            }
      `
  }
};

// Vertex shader (same for all)
export const VERTEX_SHADER = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`;

// Video Fragment Shader Template
export const VIDEO_FRAGMENT_TEMPLATE = `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform float u_time;
    varying vec2 v_texCoord;
    
    ${COMMON_UNIFORMS}
    ${SHADER_HELPERS}
    
    ${EFFECT_LOGIC}

    void main() {
        vec2 uv = v_texCoord;
        
        if (isBorder(uv)) {
            gl_FragColor = vec4(getBorderColor(u_time), 1.0);
            return;
        }

        vec2 contentUV = getEffectUV(uv);
        vec4 texColor = texture2D(u_texture, contentUV);
        
        vec3 color = applyPattern(texColor.rgb, contentUV, u_time);
        color = applyColorAdjustments(color);
        
        gl_FragColor = vec4(color, 1.0);
    }
`;
