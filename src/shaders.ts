export const VERTEX_SHADER = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`;

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
    
    // Masking
    uniform int u_useMask;
    uniform sampler2D u_maskTexture;
    uniform vec2 u_resolution;
    
    // Edge Detection
    uniform int u_enableEdge;
    uniform float u_edgeThreshold;
    uniform vec3 u_edgeColor;
    uniform int u_edgeMode; // 0: Static, 1: Pulse, 2: Audio
    uniform float u_edgeSpeed;
`;

const SHADER_HELPERS = `
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
    
    // Improved Border Detection using UV coordinates
    bool isBorder(vec2 uv) {
        if (u_enableBorder == 0) return false;
        if (uv.x < u_borderWidth || uv.x > 1.0 - u_borderWidth ||
            uv.y < u_borderWidth || uv.y > 1.0 - u_borderWidth) {
            return true;
        }
        return false;
    }
    
    vec3 getBorderColor(float time) {
        float pulse = sin(time * u_borderSpeed) * 0.5 + 0.5; // 0 to 1
        return u_borderColor * (0.5 + 0.5 * pulse);
    }

    // Sobel Edge Detection
    vec4 getEdgeColor(sampler2D tex, vec2 uv, vec2 resolution) {
        if (u_enableEdge == 0) return vec4(0.0);
        
        vec2 texel = 1.0 / resolution;
        
        float t00 = length(texture2D(tex, uv + texel * vec2(-1, -1)).rgb);
        float t10 = length(texture2D(tex, uv + texel * vec2( 0, -1)).rgb);
        float t20 = length(texture2D(tex, uv + texel * vec2( 1, -1)).rgb);
        float t01 = length(texture2D(tex, uv + texel * vec2(-1,  0)).rgb);
        float t21 = length(texture2D(tex, uv + texel * vec2( 1,  0)).rgb);
        float t02 = length(texture2D(tex, uv + texel * vec2(-1,  1)).rgb);
        float t12 = length(texture2D(tex, uv + texel * vec2( 0,  1)).rgb);
        float t22 = length(texture2D(tex, uv + texel * vec2( 1,  1)).rgb);
        
        float gx = t00 + 2.0 * t10 + t20 - (t02 + 2.0 * t12 + t22);
        float gy = t00 + 2.0 * t01 + t02 - (t20 + 2.0 * t21 + t22);
        
        float mag = length(vec2(gx, gy));
        
        if (mag > u_edgeThreshold) {
            // Calculate Edge Opacity/Color based on mode
            float alpha = 1.0;
            
            if (u_edgeMode == 1) { // Pulse
                 alpha = sin(u_time * u_edgeSpeed) * 0.5 + 0.5;
            } else if (u_edgeMode == 2) { // Audio
                 alpha = u_audioMid * u_audioMidScale * u_audioGain * 2.0;
            }
            
            return vec4(u_edgeColor, clamp(alpha, 0.0, 1.0));
        }
        
        return vec4(0.0);
    }

    vec4 applyMask(vec4 color, vec2 uv) {
        if (u_useMask == 1) {
            // Sample Mask Texture in Screen Space
            vec2 screenUV = gl_FragCoord.xy / u_resolution;
            float maskAlpha = texture2D(u_maskTexture, screenUV).a;
            
            // Logic: Mask Texture Alpha:
            // 0.0 (Black/Hole) -> Occluded (Invisible)
            // 1.0 (White/Ink) -> Visible
            
            return vec4(color.rgb, color.a * maskAlpha);
        }
        return color;
    }
`;

const EFFECT_LOGIC = `
    vec2 getEffectUV(vec2 uv) {
        // For patterns, we might want to distort UVs based on audio?
        // For now, just return standard UV.
        return uv;
    }

    vec3 applyPattern(vec3 color, vec2 uv, float time) {
        if (u_patternMode == 0) return color;
        
        float pattern = 0.0;
        float speed = u_patternSpeed * time;
        
        if (u_patternMode == 1) { // Scanlines
            pattern = sin((uv.y * u_patternScale + speed) * 6.28) * 0.5 + 0.5;
        } else if (u_patternMode == 2) { // Dots
            vec2 st = fract(uv * u_patternScale) - 0.5;
            if (length(st) < 0.3) pattern = 1.0;
        } else if (u_patternMode == 3) { // Grid
            vec2 st = fract(uv * u_patternScale);
            if (st.x < 0.1 || st.y < 0.1) pattern = 1.0;
        }
        
        // Apply Audio to pattern intensity?
        float audioMod = u_audioLevel * u_audioGain; 
        
        return mix(color, vec3(pattern), u_patternIntensity + audioMod * 0.2);
    }

    vec3 applyColorAdjustments(vec3 color) {
        // Brightness
        vec3 c = color + u_brightness;
        
        // Contrast
        c = (c - 0.5) * u_contrast + 0.5;
        
        // Saturation & Hue
        vec3 hsv = rgb2hsv(c);
        hsv.y *= u_saturation;
        hsv.x += u_hue;
        c = hsv2rgb(hsv);
        
        return c;
    }
`;

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
        
        // Edge Detection Overlay
        vec4 edge = getEdgeColor(u_texture, contentUV, u_resolution);
        if (edge.a > 0.0) {
            color = mix(color, edge.rgb, edge.a);
        }
        
        // For drawings (which use this shader), texColor.a is important.
        // For videos, it's usually 1.0.
        vec4 finalColor = vec4(color, texColor.a);
        gl_FragColor = applyMask(finalColor, uv);
    }
`;

export const SHADERS: { [key: string]: { name: string; fragment: string } } = {
  rainbow: {
    name: "Rainbow",
    fragment: `
            precision mediump float;
            uniform float u_time;
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
                
                gl_FragColor = applyMask(vec4(color, 1.0), uv);
            }
        `,
  },
  plasma: {
    name: "Plasma",
    fragment: `
            precision mediump float;
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
                
                gl_FragColor = applyMask(vec4(baseColor, 1.0), uv);
            }
        `,
  },
  waves: {
    name: "Waves",
    fragment: `
            precision mediump float;
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
                vec2 p = contentUV * 6.0;
                float i = p.y + u_time + cos(p.x + u_time) + sin(p.x + u_time) * (u_audioHigh * u_audioHighScale * u_audioGain);
                float v = sin(i) * 0.5 + 0.5;

                vec3 color = vec3(0.0, v, v * 0.8);
                color = applyPattern(color, contentUV, u_time);
                color = applyColorAdjustments(color);
                
                gl_FragColor = applyMask(vec4(color, 1.0), uv);
            }
        `,
  },
  checkerboard: {
    name: "Checkerboard",
    fragment: `
            precision mediump float;
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
                float size = 10.0;
                vec2 check = fract(contentUV * size + (u_audioLow * u_audioBassScale * 0.1));
                
                float v = step(0.5, check.x) == step(0.5, check.y) ? 1.0 : 0.0;
                vec3 color = vec3(v);
                
                color = applyPattern(color, contentUV, u_time);
                color = applyColorAdjustments(color);
                
                gl_FragColor = applyMask(vec4(color, 1.0), uv);
            }
        `,
  },
  solid: {
    name: "Solid Color",
    fragment: `
            precision mediump float;
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
                // Hue driven solid color
                vec3 color = hsv2rgb(vec3(u_time * 0.1, 0.8, 1.0));
                
                // Audio Mod to brightness
                float audioBright = u_audioLevel * u_audioGain * 0.5;
                color += audioBright;

                color = applyPattern(color, contentUV, u_time);
                color = applyColorAdjustments(color);
                
                gl_FragColor = applyMask(vec4(color, 1.0), uv);
            }
        `,
  },
  kaleidoscope: {
    name: "Kaleidoscope",
    fragment: `
            precision mediump float;
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
                
                vec2 p = uv - 0.5;
                float r = length(p);
                float a = atan(p.y, p.x);
                float sides = 6.0 + floor(u_audioMid * u_audioMidScale * 4.0);
                float tau = 6.28318;
                a = mod(a, tau/sides);
                a = abs(a - tau/sides/2.0);
                p = r * vec2(cos(a), sin(a));
                
                vec3 color = 0.5 + 0.5*cos(u_time + p.xyx + vec3(0,2,4));
                color += u_audioHigh * 0.5;

                color = applyPattern(color, uv, u_time);
                color = applyColorAdjustments(color);
                
                gl_FragColor = applyMask(vec4(color, 1.0), uv);
            }
      `,
  },
  fractal: {
    name: "Fractal",
    fragment: `
            precision mediump float;
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
                
                vec2 p = (uv - 0.5) * 2.0;
                float zoom = 1.5 - (u_audioLow * u_audioBassScale * 0.2);
                p /= zoom;
                
                int i;
                vec2 z = p;
                float iters = 0.0;
                for(int i=0; i<10; i++) {
                    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + p;
                    if(length(z) > 2.0) break;
                    iters++;
                }
                
                float val = iters / 10.0;
                vec3 color = hsv2rgb(vec3(val + u_time * 0.1, 0.8, 1.0));

                color = applyPattern(color, uv, u_time);
                color = applyColorAdjustments(color);
                
                gl_FragColor = applyMask(vec4(color, 1.0), uv);
            }
      `,
  },
};
