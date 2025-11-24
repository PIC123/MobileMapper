var ie=Object.defineProperty;var oe=(r,e,t)=>e in r?ie(r,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):r[e]=t;var u=(r,e,t)=>oe(r,typeof e!="symbol"?e+"":e,t);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))i(o);new MutationObserver(o=>{for(const s of o)if(s.type==="childList")for(const n of s.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&i(n)}).observe(document,{childList:!0,subtree:!0});function t(o){const s={};return o.integrity&&(s.integrity=o.integrity),o.referrerPolicy&&(s.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?s.credentials="include":o.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(o){if(o.ep)return;o.ep=!0;const s=t(o);fetch(o.href,s)}})();const L=`
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
`,w=`
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
`,M=`
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
`,K={rainbow:{name:"Rainbow",fragment:`
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;
            
            ${L}
            ${w}
            
            vec3 custom_hsv2rgb(vec3 c) { 
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            ${M}

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
        `},plasma:{name:"Plasma",fragment:`
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${L}
            ${w}
            ${M}

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
        `},waves:{name:"Waves",fragment:`
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${L}
            ${w}
            ${M}

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
        `},checkerboard:{name:"Checkerboard",fragment:`
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${L}
            ${w}
            ${M}

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
        `},solid:{name:"Solid Color",fragment:`
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${L}
            ${w}
            ${M}

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
        `},grid:{name:"Grid",fragment:`
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${L}
            ${w}
            ${M}

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
        `},kaleidoscope:{name:"Kaleidoscope",fragment:`
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${L}
            ${w}
            ${M}

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
      `},fractal:{name:"Fractal",fragment:`
            precision mediump float;
            uniform float u_time;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;

            ${L}
            ${w}
            ${M}

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
      `}},se=`
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`,ne=`
    precision mediump float;
    uniform sampler2D u_texture;
    uniform float u_time;
    varying vec2 v_texCoord;
    
    ${L}
    ${w}
    
    ${M}

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
`;function re(r,e,t=2){const i=r.length;let o=ae(r,0,i,t,!0);const s=[];if(!o||o.next===o.prev)return s;let n,a,l;if(r.length>80*t){n=r[0],a=r[1];let c=n,d=a;for(let h=t;h<i;h+=t){const m=r[h],p=r[h+1];m<n&&(n=m),p<a&&(a=p),m>c&&(c=m),p>d&&(d=p)}l=Math.max(c-n,d-a),l=l!==0?32767/l:0}return F(o,s,t,n,a,l,0),s}function ae(r,e,t,i,o){let s;if(o===xe(r,e,t,i)>0)for(let n=e;n<t;n+=i)s=J(n/i|0,r[n],r[n+1],s);else for(let n=t-i;n>=e;n-=i)s=J(n/i|0,r[n],r[n+1],s);return s&&N(s,s.next)&&(k(s),s=s.next),s}function D(r,e){if(!r)return r;e||(e=r);let t=r,i;do if(i=!1,!t.steiner&&(N(t,t.next)||C(t.prev,t,t.next)===0)){if(k(t),t=e=t.prev,t===t.next)break;i=!0}else t=t.next;while(i||t!==e);return e}function F(r,e,t,i,o,s,n){if(!r)return;!n&&s&&he(r,i,o,s);let a=r;for(;r.prev!==r.next;){const l=r.prev,c=r.next;if(s?ce(r,i,o,s):le(r)){e.push(l.i,r.i,c.i),k(r),r=c.next,a=c.next;continue}if(r=c,r===a){n?n===1?(r=de(D(r),e),F(r,e,t,i,o,s,2)):n===2&&ue(r,e,t,i,o,s):F(D(r),e,t,i,o,s,1);break}}}function le(r){const e=r.prev,t=r,i=r.next;if(C(e,t,i)>=0)return!1;const o=e.x,s=t.x,n=i.x,a=e.y,l=t.y,c=i.y,d=Math.min(o,s,n),h=Math.min(a,l,c),m=Math.max(o,s,n),p=Math.max(a,l,c);let v=i.next;for(;v!==e;){if(v.x>=d&&v.x<=m&&v.y>=h&&v.y<=p&&U(o,a,s,l,n,c,v.x,v.y)&&C(v.prev,v,v.next)>=0)return!1;v=v.next}return!0}function ce(r,e,t,i){const o=r.prev,s=r,n=r.next;if(C(o,s,n)>=0)return!1;const a=o.x,l=s.x,c=n.x,d=o.y,h=s.y,m=n.y,p=Math.min(a,l,c),v=Math.min(d,h,m),E=Math.max(a,l,c),b=Math.max(d,h,m),A=q(p,v,e,t,i),P=q(E,b,e,t,i);let g=r.prevZ,f=r.nextZ;for(;g&&g.z>=A&&f&&f.z<=P;){if(g.x>=p&&g.x<=E&&g.y>=v&&g.y<=b&&g!==o&&g!==n&&U(a,d,l,h,c,m,g.x,g.y)&&C(g.prev,g,g.next)>=0||(g=g.prevZ,f.x>=p&&f.x<=E&&f.y>=v&&f.y<=b&&f!==o&&f!==n&&U(a,d,l,h,c,m,f.x,f.y)&&C(f.prev,f,f.next)>=0))return!1;f=f.nextZ}for(;g&&g.z>=A;){if(g.x>=p&&g.x<=E&&g.y>=v&&g.y<=b&&g!==o&&g!==n&&U(a,d,l,h,c,m,g.x,g.y)&&C(g.prev,g,g.next)>=0)return!1;g=g.prevZ}for(;f&&f.z<=P;){if(f.x>=p&&f.x<=E&&f.y>=v&&f.y<=b&&f!==o&&f!==n&&U(a,d,l,h,c,m,f.x,f.y)&&C(f.prev,f,f.next)>=0)return!1;f=f.nextZ}return!0}function de(r,e){let t=r;do{const i=t.prev,o=t.next.next;!N(i,o)&&Q(i,t,t.next,o)&&O(i,o)&&O(o,i)&&(e.push(i.i,t.i,o.i),k(t),k(t.next),t=r=o),t=t.next}while(t!==r);return D(t)}function ue(r,e,t,i,o,s){let n=r;do{let a=n.next.next;for(;a!==n.prev;){if(n.i!==a.i&&ge(n,a)){let l=pe(n,a);n=D(n,n.next),l=D(l,l.next),F(n,e,t,i,o,s,0),F(l,e,t,i,o,s,0);return}a=a.next}n=n.next}while(n!==r)}function he(r,e,t,i){let o=r;do o.z===0&&(o.z=q(o.x,o.y,e,t,i)),o.prevZ=o.prev,o.nextZ=o.next,o=o.next;while(o!==r);o.prevZ.nextZ=null,o.prevZ=null,fe(o)}function fe(r){let e,t=1;do{let i=r,o;r=null;let s=null;for(e=0;i;){e++;let n=i,a=0;for(let c=0;c<t&&(a++,n=n.nextZ,!!n);c++);let l=t;for(;a>0||l>0&&n;)a!==0&&(l===0||!n||i.z<=n.z)?(o=i,i=i.nextZ,a--):(o=n,n=n.nextZ,l--),s?s.nextZ=o:r=o,o.prevZ=s,s=o;i=n}s.nextZ=null,t*=2}while(e>1);return r}function q(r,e,t,i,o){return r=(r-t)*o|0,e=(e-i)*o|0,r=(r|r<<8)&16711935,r=(r|r<<4)&252645135,r=(r|r<<2)&858993459,r=(r|r<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,r|e<<1}function ve(r,e,t,i,o,s,n,a){return(o-n)*(e-a)>=(r-n)*(s-a)&&(r-n)*(i-a)>=(t-n)*(e-a)&&(t-n)*(s-a)>=(o-n)*(i-a)}function U(r,e,t,i,o,s,n,a){return!(r===n&&e===a)&&ve(r,e,t,i,o,s,n,a)}function ge(r,e){return r.next.i!==e.i&&r.prev.i!==e.i&&!me(r,e)&&(O(r,e)&&O(e,r)&&ye(r,e)&&(C(r.prev,r,e.prev)||C(r,e.prev,e))||N(r,e)&&C(r.prev,r,r.next)>0&&C(e.prev,e,e.next)>0)}function C(r,e,t){return(e.y-r.y)*(t.x-e.x)-(e.x-r.x)*(t.y-e.y)}function N(r,e){return r.x===e.x&&r.y===e.y}function Q(r,e,t,i){const o=G(C(r,e,t)),s=G(C(r,e,i)),n=G(C(t,i,r)),a=G(C(t,i,e));return!!(o!==s&&n!==a||o===0&&H(r,t,e)||s===0&&H(r,i,e)||n===0&&H(t,r,i)||a===0&&H(t,e,i))}function H(r,e,t){return e.x<=Math.max(r.x,t.x)&&e.x>=Math.min(r.x,t.x)&&e.y<=Math.max(r.y,t.y)&&e.y>=Math.min(r.y,t.y)}function G(r){return r>0?1:r<0?-1:0}function me(r,e){let t=r;do{if(t.i!==r.i&&t.next.i!==r.i&&t.i!==e.i&&t.next.i!==e.i&&Q(t,t.next,r,e))return!0;t=t.next}while(t!==r);return!1}function O(r,e){return C(r.prev,r,r.next)<0?C(r,e,r.next)>=0&&C(r,r.prev,e)>=0:C(r,e,r.prev)<0||C(r,r.next,e)<0}function ye(r,e){let t=r,i=!1;const o=(r.x+e.x)/2,s=(r.y+e.y)/2;do t.y>s!=t.next.y>s&&t.next.y!==t.y&&o<(t.next.x-t.x)*(s-t.y)/(t.next.y-t.y)+t.x&&(i=!i),t=t.next;while(t!==r);return i}function pe(r,e){const t=Z(r.i,r.x,r.y),i=Z(e.i,e.x,e.y),o=r.next,s=e.prev;return r.next=e,e.prev=r,t.next=o,o.prev=t,i.next=t,t.prev=i,s.next=i,i.prev=s,i}function J(r,e,t,i){const o=Z(r,e,t);return i?(o.next=i.next,o.prev=i,i.next.prev=o,i.next=o):(o.prev=o,o.next=o),o}function k(r){r.next.prev=r.prev,r.prev.next=r.next,r.prevZ&&(r.prevZ.nextZ=r.nextZ),r.nextZ&&(r.nextZ.prevZ=r.prevZ)}function Z(r,e,t){return{i:r,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function xe(r,e,t,i){let o=0;for(let s=e,n=t-i;s<t;s+=i)o+=(r[n]-r[s])*(r[s+1]+r[n+1]),n=s;return o}class Ce{constructor(e){u(this,"canvas");u(this,"gl");u(this,"programCache");u(this,"shaderCache");u(this,"videoTextures");u(this,"startTime");u(this,"audioData");this.canvas=e,this.gl=e.getContext("webgl",{alpha:!0}),this.programCache=new Map,this.shaderCache=new Map,this.videoTextures=new Map,this.startTime=Date.now(),this.audioData={low:0,mid:0,high:0,level:0},this.resize(),window.addEventListener("resize",()=>this.resize())}resize(){const e=this.canvas.clientWidth,t=this.canvas.clientHeight;(this.canvas.width!==e||this.canvas.height!==t)&&(this.canvas.width=e,this.canvas.height=t,this.gl.viewport(0,0,this.canvas.width,this.canvas.height))}updateAudioData(e){this.audioData=e}createShader(e,t,i){const o=e.createShader(t);return e.shaderSource(o,i),e.compileShader(o),e.getShaderParameter(o,e.COMPILE_STATUS)?o:(console.error("Shader compile error:",e.getShaderInfoLog(o)),e.deleteShader(o),null)}createProgram(e,t,i){const o=this.createShader(e,e.VERTEX_SHADER,t),s=this.createShader(e,e.FRAGMENT_SHADER,i),n=e.createProgram();return e.attachShader(n,o),e.attachShader(n,s),e.linkProgram(n),e.getProgramParameter(n,e.LINK_STATUS)?n:(console.error("Program link error:",e.getProgramInfoLog(n)),null)}getProgramInfo(e,t){if(this.shaderCache.has(e))return this.shaderCache.get(e);const i=this.gl,o=this.createProgram(i,se,t);if(!o)return null;const s={program:o,attribLocations:{position:i.getAttribLocation(o,"a_position"),texCoord:i.getAttribLocation(o,"a_texCoord")},uniformLocations:{resolution:i.getUniformLocation(o,"u_resolution"),time:i.getUniformLocation(o,"u_time"),texture:i.getUniformLocation(o,"u_texture"),brightness:i.getUniformLocation(o,"u_brightness"),contrast:i.getUniformLocation(o,"u_contrast"),saturation:i.getUniformLocation(o,"u_saturation"),hue:i.getUniformLocation(o,"u_hue"),patternMode:i.getUniformLocation(o,"u_patternMode"),patternScale:i.getUniformLocation(o,"u_patternScale"),patternIntensity:i.getUniformLocation(o,"u_patternIntensity"),patternSpeed:i.getUniformLocation(o,"u_patternSpeed"),enableBorder:i.getUniformLocation(o,"u_enableBorder"),borderWidth:i.getUniformLocation(o,"u_borderWidth"),borderColor:i.getUniformLocation(o,"u_borderColor"),borderSpeed:i.getUniformLocation(o,"u_borderSpeed"),audioLow:i.getUniformLocation(o,"u_audioLow"),audioMid:i.getUniformLocation(o,"u_audioMid"),audioHigh:i.getUniformLocation(o,"u_audioHigh"),audioLevel:i.getUniformLocation(o,"u_audioLevel"),audioBassScale:i.getUniformLocation(o,"u_audioBassScale"),audioMidScale:i.getUniformLocation(o,"u_audioMidScale"),audioHighScale:i.getUniformLocation(o,"u_audioHighScale"),audioGain:i.getUniformLocation(o,"u_audioGain")}};return this.shaderCache.set(e,s),s}isPointInTriangle(e,t,i,o){const s={x:o.x-t.x,y:o.y-t.y},n={x:i.x-t.x,y:i.y-t.y},a={x:e.x-t.x,y:e.y-t.y},l=s.x*s.x+s.y*s.y,c=s.x*n.x+s.y*n.y,d=s.x*a.x+s.y*a.y,h=n.x*n.x+n.y*n.y,m=n.x*a.x+n.y*a.y,p=1/(l*h-c*c),v=(h*d-c*m)*p,E=(l*m-c*d)*p;return v>=0&&E>=0&&v+E<1}renderPolygon(e){const t=this.gl;let i;if(e.contentType==="video")i=this.getProgramInfo("video",ne);else{const y=K[e.shaderType]||K.rainbow;i=this.getProgramInfo(e.shaderType,y.fragment)}if(!i)return;t.useProgram(i.program);const o=[],s=[];if(e.warpMode&&e.gridVertices.length>0){const y=e.gridSize;for(let x=0;x<y-1;x++)for(let S=0;S<y-1;S++){const B=x*y+S,V=x*y+S+1,_=(x+1)*y+S,I=(x+1)*y+S+1;e.gridVertices[B],e.gridVertices[V],e.gridVertices[_],e.gridVertices[I],this.addTriangleToBuffers(o,s,e.gridVertices,B,V,_,y,S,x,0),this.addTriangleToBuffers(o,s,e.gridVertices,V,I,_,y,S,x,1)}}else{const y=e.getDiscretizedVertices(20),x=[];y.forEach(_=>x.push(_.x,_.y));const S=re(x),B=e.getBoundingBox(),V=(_,I)=>[(_-B.minX)/B.width,(I-B.minY)/B.height];for(let _=0;_<S.length;_+=3){const I=S[_],ee=S[_+1],te=S[_+2],z=y[I],j=y[ee],$=y[te];o.push(z.x*2-1,-(z.y*2-1)),o.push(j.x*2-1,-(j.y*2-1)),o.push($.x*2-1,-($.y*2-1)),s.push(...V(z.x,z.y)),s.push(...V(j.x,j.y)),s.push(...V($.x,$.y))}}const n=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,n),t.bufferData(t.ARRAY_BUFFER,new Float32Array(o),t.STATIC_DRAW),t.enableVertexAttribArray(i.attribLocations.position),t.vertexAttribPointer(i.attribLocations.position,2,t.FLOAT,!1,0,0);const a=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,a),t.bufferData(t.ARRAY_BUFFER,new Float32Array(s),t.STATIC_DRAW),t.enableVertexAttribArray(i.attribLocations.texCoord),t.vertexAttribPointer(i.attribLocations.texCoord,2,t.FLOAT,!1,0,0);let l=0,c=1,d=1,h=0,m=0,p=10,v=0,E=1,b=0,A=0,P={r:1,g:1,b:1},g=0;e.effects.forEach(y=>{const x=y.params;y.type==="brightness"&&(l+=x.value),y.type==="contrast"&&(c*=x.value),y.type==="saturation"&&(d*=x.value),y.type==="hue"&&(h+=x.value),["scanlines","dots","grid"].includes(y.type)&&(m=y.type==="scanlines"?1:y.type==="dots"?2:3,p=x.scale,v=x.intensity,E=x.speed||1),y.type==="border"&&(b=1,A=x.width,x.color&&(P=x.color),g=x.speed||0)}),t.uniform1f(i.uniformLocations.brightness,l),t.uniform1f(i.uniformLocations.contrast,c),t.uniform1f(i.uniformLocations.saturation,d),t.uniform1f(i.uniformLocations.hue,h),t.uniform1i(i.uniformLocations.patternMode,m),t.uniform1f(i.uniformLocations.patternScale,p),t.uniform1f(i.uniformLocations.patternIntensity,v),t.uniform1f(i.uniformLocations.patternSpeed,E),t.uniform1i(i.uniformLocations.enableBorder,b),t.uniform1f(i.uniformLocations.borderWidth,A),t.uniform1f(i.uniformLocations.borderSpeed,g),P&&t.uniform3f(i.uniformLocations.borderColor,P.r,P.g,P.b),t.uniform1f(i.uniformLocations.audioLow,this.audioData.low),t.uniform1f(i.uniformLocations.audioMid,this.audioData.mid),t.uniform1f(i.uniformLocations.audioHigh,this.audioData.high),t.uniform1f(i.uniformLocations.audioLevel,this.audioData.level);const f=e.audioSettings||{bassScale:1,midScale:1,highScale:1,gain:1,enabled:!0},R=f.enabled?1:0;t.uniform1f(i.uniformLocations.audioBassScale,f.bassScale*R),t.uniform1f(i.uniformLocations.audioMidScale,f.midScale*R),t.uniform1f(i.uniformLocations.audioHighScale,f.highScale*R),t.uniform1f(i.uniformLocations.audioGain,f.gain*R);const Y=(Date.now()-this.startTime)/1e3;if(t.uniform1f(i.uniformLocations.time,Y),e.contentType==="video"&&e.videoElement){let y=this.videoTextures.get(e.id);y||(y=t.createTexture(),this.videoTextures.set(e.id,y)),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,y),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,e.videoElement),t.uniform1i(i.uniformLocations.texture,0)}else t.uniform2f(i.uniformLocations.resolution,this.canvas.width,this.canvas.height);t.drawArrays(t.TRIANGLES,0,o.length/2),t.deleteBuffer(n),t.deleteBuffer(a)}addTriangleToBuffers(e,t,i,o,s,n,a,l,c,d){const h=i[o],m=i[s],p=i[n];e.push(h.x*2-1,-(h.y*2-1)),e.push(m.x*2-1,-(m.y*2-1)),e.push(p.x*2-1,-(p.y*2-1));const v=a-1,E=l/v,b=c/v;d===0?(t.push(E,b),t.push((l+1)/v,b),t.push(E,(c+1)/v)):(t.push((l+1)/v,b),t.push((l+1)/v,(c+1)/v),t.push(E,(c+1)/v))}render(e,t){const i=this.gl;i.clearColor(0,0,0,0),i.clear(i.COLOR_BUFFER_BIT),e.forEach(o=>{this.renderPolygon(o)})}}class T{constructor(e,t=null,i="polygon"){u(this,"id");u(this,"vertices");u(this,"type");u(this,"contentType");u(this,"shaderType");u(this,"videoSrc");u(this,"videoElement");u(this,"selected");u(this,"effects");u(this,"warpMode");u(this,"gridVertices");u(this,"gridSize");u(this,"audioSettings");this.id=t||Date.now()+Math.random(),this.vertices=e,this.type=i,this.contentType="shader",this.shaderType="rainbow",this.videoSrc=null,this.videoElement=null,this.selected=!1,this.effects=[],this.warpMode=!1,this.gridVertices=[],this.gridSize=3,this.audioSettings={bassScale:1,midScale:1,highScale:1,gain:1,enabled:!0}}addEffect(e){const t=Date.now()+Math.random().toString();let i={};switch(e){case"brightness":i={value:.2};break;case"contrast":i={value:1.2};break;case"saturation":i={value:1.5};break;case"hue":i={value:.1,speed:0};break;case"scanlines":i={scale:50,intensity:.3,speed:1};break;case"dots":i={scale:30,intensity:.5,speed:.5};break;case"grid":i={scale:10,intensity:.5,speed:.2};break;case"border":i={width:.05,color:{r:1,g:1,b:1},speed:2};break}return this.effects.push({id:t,type:e,params:i}),t}removeEffect(e){this.effects=this.effects.filter(t=>t.id!==e)}updateEffect(e,t){const i=this.effects.find(o=>o.id===e);i&&Object.assign(i.params,t)}getDiscretizedVertices(e=20){const t=[],i=this.warpMode?this.getBoundaryFromGrid():this.vertices;for(let o=0;o<i.length;o++){const s=i[o],n=i[(o+1)%i.length];if(s.bezier&&s.c2&&n.c1)for(let a=0;a<e;a++){const l=a/e,c=1-l,d=c*c,h=l*l,m=c*d*s.x+3*d*l*(s.c2.x||s.x)+3*c*h*(n.c1.x||n.x)+l*h*n.x,p=c*d*s.y+3*d*l*(s.c2.y||s.y)+3*c*h*(n.c1.y||n.y)+l*h*n.y;t.push({x:m,y:p})}else t.push({x:s.x,y:s.y})}return t}containsPoint(e,t){const i=this.getDiscretizedVertices();let o=!1;for(let s=0,n=i.length-1;s<i.length;n=s++){const a=i[s].x,l=i[s].y,c=i[n].x,d=i[n].y;l>t!=d>t&&e<(c-a)*(t-l)/(d-l)+a&&(o=!o)}return o}getVertexAtPoint(e,t,i=.03){if(this.warpMode){for(let o=0;o<this.gridVertices.length;o++){const s=this.gridVertices[o],n=s.x-e,a=s.y-t;if(Math.sqrt(n*n+a*a)<i)return{type:"grid",index:o}}return null}for(let o=0;o<this.vertices.length;o++){const s=this.vertices[o];if(Math.sqrt((s.x-e)**2+(s.y-t)**2)<i)return{type:"vertex",index:o};if(s.bezier){if(s.c1&&Math.sqrt((s.c1.x-e)**2+(s.c1.y-t)**2)<i)return{type:"c1",index:o};if(s.c2&&Math.sqrt((s.c2.x-e)**2+(s.c2.y-t)**2)<i)return{type:"c2",index:o}}}return null}moveVertex(e,t,i){if(!e)return;if(e.type==="grid"){this.gridVertices[e.index].x=Math.max(0,Math.min(1,t)),this.gridVertices[e.index].y=Math.max(0,Math.min(1,i));return}const o=e.index,s=this.vertices[o];if(t=Math.max(0,Math.min(1,t)),i=Math.max(0,Math.min(1,i)),e.type==="vertex"){const n=t-s.x,a=i-s.y;s.x=t,s.y=i,s.c1&&(s.c1.x+=n,s.c1.y+=a),s.c2&&(s.c2.x+=n,s.c2.y+=a)}else e.type==="c1"?s.c1={x:t,y:i}:e.type==="c2"&&(s.c2={x:t,y:i})}translate(e,t){(this.warpMode?this.gridVertices:this.vertices).forEach(o=>{o.x=Math.max(0,Math.min(1,o.x+e)),o.y=Math.max(0,Math.min(1,o.y+t)),o.c1&&(o.c1.x+=e,o.c1.y+=t),o.c2&&(o.c2.x+=e,o.c2.y+=t)})}getBoundingBox(){const e=this.getDiscretizedVertices(10),t=e.map(o=>o.x),i=e.map(o=>o.y);return{minX:Math.min(...t),maxX:Math.max(...t),minY:Math.min(...i),maxY:Math.max(...i),width:Math.max(...t)-Math.min(...t),height:Math.max(...i)-Math.min(...i)}}setContent(e,t){this.contentType=e,e==="shader"?this.shaderType=t:e==="video"&&(this.videoSrc=t,this.loadVideo())}loadVideo(){this.videoSrc&&(this.videoElement=document.createElement("video"),this.videoElement.src=this.videoSrc,this.videoElement.loop=!0,this.videoElement.muted=!0,this.videoElement.playsInline=!0,this.videoElement.crossOrigin="anonymous",this.videoElement.play().catch(e=>console.log("Video play failed:",e)))}toggleWarpMode(){return this.warpMode?this.warpMode=!1:(this.warpMode=!0,this.gridVertices.length===0&&this.initGrid()),this.warpMode}initGrid(){const e=this.getBoundingBox();this.gridVertices=[];const t=this.gridSize-1;for(let i=0;i<=t;i++)for(let o=0;o<=t;o++){const s=o/t,n=i/t;this.gridVertices.push({x:e.minX+s*e.width,y:e.minY+n*e.height})}}getBoundaryFromGrid(){if(this.gridVertices.length===0)return this.vertices;const e=this.gridSize,t=[];for(let i=0;i<e;i++)t.push(this.gridVertices[i]);for(let i=1;i<e;i++)t.push(this.gridVertices[(i+1)*e-1]);for(let i=e-2;i>=0;i--)t.push(this.gridVertices[e*(e-1)+i]);for(let i=e-2;i>0;i--)t.push(this.gridVertices[i*e]);return t}getRenderVertices(){return this.warpMode&&this.gridVertices.length>0?this.gridVertices:this.getDiscretizedVertices(30)}toJSON(){return{id:this.id,vertices:this.vertices,type:this.type,contentType:this.contentType,shaderType:this.shaderType,videoSrc:this.videoSrc,effects:this.effects,warpMode:this.warpMode,gridVertices:this.gridVertices,audioSettings:this.audioSettings}}static fromJSON(e){const t=new T(e.vertices,e.id,e.type);if(t.contentType=e.contentType,t.shaderType=e.shaderType,t.videoSrc=e.videoSrc,e.effects&&!Array.isArray(e.effects)){if(t.effects=[],e.effects.brightness&&t.effects.push({id:"mig1",type:"brightness",params:{value:e.effects.brightness}}),e.effects.contrast&&e.effects.contrast!==1&&t.effects.push({id:"mig2",type:"contrast",params:{value:e.effects.contrast}}),e.effects.patternMode){const i=["none","scanlines","dots","grid"];e.effects.patternMode>0&&t.effects.push({id:"mig3",type:i[e.effects.patternMode],params:{scale:e.effects.patternScale,intensity:e.effects.patternIntensity,speed:1}})}e.effects.border&&t.effects.push({id:"mig4",type:"border",params:{width:e.effects.borderWidth,color:e.effects.borderColor,speed:2}})}else t.effects=e.effects||[];return t.warpMode=e.warpMode||!1,t.gridVertices=e.gridVertices||[],t.audioSettings=e.audioSettings||{bassScale:1,midScale:1,highScale:1,gain:1,enabled:!0},t.videoSrc&&t.loadVideo(),t}}class W{static createTriangle(e,t,i=.15){const o=i*Math.sqrt(3)/2;return new T([{x:e,y:t-o*.66},{x:e-i/2,y:t+o*.33},{x:e+i/2,y:t+o*.33}],null,"triangle")}static createSquare(e,t,i=.15){const o=i/2;return new T([{x:e-o,y:t-o},{x:e+o,y:t-o},{x:e+o,y:t+o},{x:e-o,y:t+o}],null,"quad")}static createCircle(e,t,i=.15){const o=i/2,s=o*.55228,n={x:e,y:t-o,c1:{x:e-s,y:t-o},c2:{x:e+s,y:t-o},bezier:!0},a={x:e+o,y:t,c1:{x:e+o,y:t-s},c2:{x:e+o,y:t+s},bezier:!0},l={x:e,y:t+o,c1:{x:e+s,y:t+o},c2:{x:e-s,y:t+o},bezier:!0},c={x:e-o,y:t,c1:{x:e-o,y:t+s},c2:{x:e-o,y:t-s},bezier:!0};return new T([n,a,l,c],null,"circle")}}class Ee{constructor(){u(this,"audioContext");u(this,"analyser");u(this,"source");u(this,"dataArray");u(this,"isActive");u(this,"stream");this.audioContext=null,this.analyser=null,this.source=null,this.dataArray=null,this.isActive=!1,this.stream=null}async start(){if(!this.isActive)try{this.stream=await navigator.mediaDevices.getUserMedia({audio:!0}),this.audioContext=new(window.AudioContext||window.webkitAudioContext),this.analyser=this.audioContext.createAnalyser(),this.analyser.fftSize=256,this.source=this.audioContext.createMediaStreamSource(this.stream),this.source.connect(this.analyser),this.dataArray=new Uint8Array(this.analyser.frequencyBinCount),this.isActive=!0,console.log("Audio analysis started")}catch(e){console.error("Error accessing microphone:",e),alert("Could not access microphone. Please ensure you have granted permission.")}}stop(){this.isActive&&(this.stream&&this.stream.getTracks().forEach(e=>e.stop()),this.audioContext&&this.audioContext.close(),this.isActive=!1,this.audioContext=null,this.analyser=null,this.source=null)}getAudioData(){if(!this.isActive||!this.analyser||!this.dataArray)return{low:0,mid:0,high:0,level:0};this.analyser.getByteFrequencyData(this.dataArray);const e=this.analyser.frequencyBinCount,t=Math.floor(e*.1),i=Math.floor(e*.5);let o=0,s=0,n=0;for(let l=0;l<e;l++){const c=this.dataArray[l]/255;l<t?o+=c:l<i?s+=c:n+=c}o/=t,s/=i-t,n/=e-i;const a=(o+s+n)/3;return{low:o,mid:s,high:n,level:a}}}class X{constructor(){u(this,"canvas");u(this,"overlayCanvas");u(this,"overlayCtx");u(this,"renderer");u(this,"audioManager");u(this,"polygons");u(this,"selectedPolygon");u(this,"selectedVertex");u(this,"currentTool");u(this,"drawingVertices");u(this,"isDrawing");u(this,"dragStart");u(this,"editMode");u(this,"loadedVideos");u(this,"controlsDragStart");u(this,"controlsPosition");u(this,"uiVisible");u(this,"userHasToggledMode");this.canvas=document.getElementById("mainCanvas"),this.overlayCanvas=document.getElementById("overlayCanvas"),this.overlayCtx=this.overlayCanvas.getContext("2d"),this.renderer=new Ce(this.canvas),this.audioManager=new Ee,this.polygons=[],this.selectedPolygon=null,this.selectedVertex=null,this.currentTool="select",this.drawingVertices=[],this.isDrawing=!1,this.dragStart=null,this.editMode=!0,this.loadedVideos=new Map,this.controlsDragStart=null,this.controlsPosition={x:null,y:null},this.uiVisible=!0,this.userHasToggledMode=!1,this.setupEventListeners(),this.resizeOverlay(),window.addEventListener("resize",()=>{this.resizeOverlay()}),this.animate(),this.showWelcomeModal()}resizeOverlay(){const e=this.overlayCanvas.clientWidth,t=this.overlayCanvas.clientHeight;(this.overlayCanvas.width!==e||this.overlayCanvas.height!==t)&&(this.overlayCanvas.width=e,this.overlayCanvas.height=t)}setupEventListeners(){var s;document.getElementById("toggleSidebarBtn").addEventListener("click",()=>{document.getElementById("leftSidebar").classList.toggle("hidden")}),document.querySelectorAll(".sidebar-section h3").forEach(n=>{n.style.cursor="pointer",n.addEventListener("click",a=>{const l=a.target.closest(".sidebar-section");l&&Array.from(l.children).forEach(c=>{if(c.tagName!=="H3"){const d=c;d.style.display=d.style.display==="none"?"":"none"}})})}),document.getElementById("addTriangleBtn").addEventListener("click",()=>this.setTool("triangle")),document.getElementById("addSquareBtn").addEventListener("click",()=>this.setTool("square")),document.getElementById("addCircleBtn").addEventListener("click",()=>this.setTool("circle")),document.getElementById("drawPolygonBtn").addEventListener("click",()=>this.setTool("draw")),document.getElementById("selectBtn").addEventListener("click",()=>this.setTool("select")),document.getElementById("deleteBtn").addEventListener("click",()=>this.deleteSelected()),document.getElementById("changeContentBtn").addEventListener("click",()=>this.showContentModal()),document.getElementById("warpToggle").addEventListener("change",n=>this.toggleWarpMode(n.target.checked)),document.getElementById("audioEnabledToggle").addEventListener("change",n=>{this.selectedPolygon&&(this.selectedPolygon.audioSettings.enabled=n.target.checked)});const e=(n,a)=>{document.getElementById(n).addEventListener("input",c=>{this.selectedPolygon&&(this.selectedPolygon.audioSettings[a]=parseFloat(c.target.value))})};e("audioGainSlider","gain"),e("audioBassSlider","bassScale"),e("audioMidSlider","midScale"),e("audioHighSlider","highScale"),document.getElementById("addEffectBtn").addEventListener("click",()=>{const n=document.getElementById("effectTypeSelect").value;this.addEffect(n)}),document.getElementById("performanceBtn").addEventListener("click",()=>this.togglePerformanceMode()),document.getElementById("fullscreenBtn").addEventListener("click",()=>this.toggleFullscreen()),document.getElementById("saveBtn").addEventListener("click",()=>this.saveProject()),document.getElementById("loadBtn").addEventListener("click",()=>this.loadProjectDialog()),document.getElementById("audioToggleBtn").addEventListener("click",()=>this.toggleAudio()),this.canvas.addEventListener("touchstart",n=>this.handleTouchStart(n),{passive:!1}),this.canvas.addEventListener("touchmove",n=>this.handleTouchMove(n),{passive:!1}),this.canvas.addEventListener("touchend",n=>this.handleTouchEnd(n),{passive:!1}),this.canvas.addEventListener("mousedown",n=>this.handleMouseDown(n)),this.canvas.addEventListener("mousemove",n=>this.handleMouseMove(n)),this.canvas.addEventListener("mouseup",n=>this.handleMouseUp(n)),document.querySelectorAll(".arrow-btn").forEach(n=>{n.addEventListener("click",()=>this.finetuneVertex(n.dataset.dir))}),(s=document.getElementById("toggleCurveBtn"))==null||s.addEventListener("click",()=>this.toggleVertexCurve()),document.querySelectorAll(".close-modal").forEach(n=>{n.addEventListener("click",()=>this.hideAllModals())}),document.querySelectorAll(".content-type-btn").forEach(n=>{n.addEventListener("click",()=>{const a=n.dataset.type;a==="shader"?this.showShaderModal():a==="video"&&this.showVideoModal()})}),document.querySelectorAll(".shader-btn").forEach(n=>{n.addEventListener("click",()=>{this.setPolygonContent("shader",n.dataset.shader)})}),document.getElementById("videoFileInput").addEventListener("change",n=>{this.handleVideoUpload(n)});const t=document.getElementById("performanceOverlay");t.addEventListener("click",()=>{this.editMode||this.togglePerformanceMode()}),t.addEventListener("touchstart",n=>{this.editMode||(n.preventDefault(),this.togglePerformanceMode())},{passive:!1});const o=document.getElementById("vertexControls").querySelector(".control-drag-handle");o.addEventListener("mousedown",n=>this.startControlsDrag(n)),o.addEventListener("touchstart",n=>this.startControlsDrag(n),{passive:!1}),document.addEventListener("mousemove",n=>this.moveControls(n)),document.addEventListener("touchmove",n=>this.moveControls(n),{passive:!1}),document.addEventListener("mouseup",()=>this.stopControlsDrag()),document.addEventListener("touchend",()=>this.stopControlsDrag()),document.getElementById("newProjectBtn").addEventListener("click",()=>this.startNewProject()),document.getElementById("loadProjectFileBtn").addEventListener("click",()=>this.loadProjectFromFile()),document.getElementById("continueProjectBtn").addEventListener("click",()=>this.continueLastProject())}renderLayersList(){const e=document.getElementById("layersListContainer");if(e){if(e.innerHTML="",this.polygons.length===0){e.innerHTML='<div style="padding:8px; opacity:0.5; font-size:12px;">No shapes added</div>';return}this.polygons.forEach((t,i)=>{const o=document.createElement("div");o.className="layer-item",o.style.padding="8px",o.style.borderBottom="1px solid rgba(255,255,255,0.1)",o.style.cursor="pointer",o.style.backgroundColor=t.selected?"rgba(0,255,157,0.2)":"transparent",o.style.display="flex",o.style.justifyContent="space-between",o.style.alignItems="center";const s=document.createElement("span");s.textContent=`Shape ${i+1} (${t.type})`,s.style.fontSize="12px",o.appendChild(s),o.addEventListener("click",n=>{n.stopPropagation(),this.selectPolygon(t),this.setTool("select")}),e.appendChild(o)})}}toggleAudio(){this.audioManager.isActive?(this.audioManager.stop(),document.getElementById("audioToggleBtn").classList.remove("active")):(this.audioManager.start(),document.getElementById("audioToggleBtn").classList.add("active"))}addEffect(e){if(!this.selectedPolygon)return;if(this.selectedPolygon.effects.find(i=>i.type===e)){this.showStatus(`${e} effect already added`);return}this.selectedPolygon.addEffect(e),this.updatePropertiesPanel(this.selectedPolygon)}removeEffect(e){this.selectedPolygon&&(this.selectedPolygon.removeEffect(e),this.updatePropertiesPanel(this.selectedPolygon))}renderEffectsList(e){const t=document.getElementById("effectsListContainer");if(t){if(t.innerHTML="",!e.effects||e.effects.length===0){t.innerHTML="<div style='opacity:0.5; font-size:12px; padding:8px;'>No effects added</div>";return}e.effects.forEach(i=>{const o=document.createElement("div");o.className="effect-item";let s="";const n=i.params;if(["brightness","contrast","saturation","hue"].includes(i.type)){const c=i.type==="brightness"?-1:0,d=i.type==="brightness"?1:2,h=i.type==="hue"?.01:.1;s=`
                <div class="control-group">
                    <label>Value: <span id="val-${i.id}">${n.value.toFixed(2)}</span></label>
                    <input type="range" min="${c}" max="${d}" step="${h}" value="${n.value}" 
                           data-effect-id="${i.id}" data-param="value">
                </div>
            `}else["scanlines","dots","grid"].includes(i.type)?s=`
                <div class="control-group">
                    <label>Scale</label>
                    <input type="range" min="1" max="100" value="${n.scale}"
                           data-effect-id="${i.id}" data-param="scale">
                </div>
                <div class="control-group">
                    <label>Intensity</label>
                    <input type="range" min="0" max="1" step="0.1" value="${n.intensity}"
                           data-effect-id="${i.id}" data-param="intensity">
                </div>
                <div class="control-group">
                    <label>Anim Speed</label>
                    <input type="range" min="0" max="5" step="0.1" value="${n.speed!==void 0?n.speed:1}"
                           data-effect-id="${i.id}" data-param="speed">
                </div>
            `:i.type==="border"&&(s=`
                <div class="control-group">
                    <label>Width</label>
                    <input type="range" min="0.01" max="0.2" step="0.01" value="${n.width}"
                           data-effect-id="${i.id}" data-param="width">
                </div>
                <div class="control-group">
                    <label>Pulse Speed</label>
                    <input type="range" min="0" max="10" step="0.1" value="${n.speed!==void 0?n.speed:0}"
                           data-effect-id="${i.id}" data-param="speed">
                </div>
            `);o.innerHTML=`
            <div class="effect-header">
                <span>${i.type.toUpperCase()}</span>
                <button class="effect-remove" data-effect-id="${i.id}">✕</button>
            </div>
            ${s}
        `;const a=o.querySelector(".effect-remove");a&&a.addEventListener("click",c=>{const d=c.target;this.removeEffect(d.dataset.effectId)}),o.querySelectorAll('input[type="range"]').forEach(c=>{c.addEventListener("input",d=>{const h=d.target,m=h.dataset.param,p=parseFloat(h.value),v=h.dataset.effectId,E={};E[m]=p,this.updateEffectParam(v,E)})}),t.appendChild(o)})}}updateEffectParam(e,t){if(this.selectedPolygon){this.selectedPolygon.updateEffect(e,t);const i=document.getElementById(`val-${e}`);i&&t.value!==void 0&&(i.textContent=t.value.toFixed(2))}}startControlsDrag(e){e.preventDefault(),e.stopPropagation();const i=document.getElementById("vertexControls").getBoundingClientRect(),o=e.touches?e.touches[0].clientX:e.clientX,s=e.touches?e.touches[0].clientY:e.clientY;this.controlsDragStart={x:o-i.left,y:s-i.top}}moveControls(e){if(!this.controlsDragStart)return;e.preventDefault();const t=e.touches?e.touches[0].clientX:e.clientX,i=e.touches?e.touches[0].clientY:e.clientY,o=document.getElementById("vertexControls"),s=t-this.controlsDragStart.x,n=i-this.controlsDragStart.y,a=window.innerWidth-o.offsetWidth,l=window.innerHeight-o.offsetHeight;this.controlsPosition.x=Math.max(0,Math.min(s,a)),this.controlsPosition.y=Math.max(0,Math.min(n,l)),o.style.left=this.controlsPosition.x+"px",o.style.top=this.controlsPosition.y+"px",o.style.right="auto",o.style.bottom="auto",o.style.transform="none"}stopControlsDrag(){this.controlsDragStart=null}setTool(e){this.currentTool=e,this.isDrawing=!1,this.drawingVertices=[],document.querySelectorAll(".tool-btn").forEach(t=>t.classList.remove("active")),e==="select"?document.getElementById("selectBtn").classList.add("active"):(e==="triangle"?document.getElementById("addTriangleBtn").classList.add("active"):e==="square"?document.getElementById("addSquareBtn").classList.add("active"):e==="circle"?document.getElementById("addCircleBtn").classList.add("active"):e==="draw"&&document.getElementById("drawPolygonBtn").classList.add("active"),window.innerWidth<768&&(document.getElementById("leftSidebar").classList.add("hidden"),document.getElementById("rightSidebar").classList.add("hidden")))}getNormalizedCoords(e,t){const i=this.canvas.getBoundingClientRect();return{x:(e-i.left)/i.width,y:(t-i.top)/i.height}}handleTouchStart(e){if(e.preventDefault(),e.touches.length===1){const t=e.touches[0];this.handlePointerDown(t.clientX,t.clientY)}}handleTouchMove(e){if(e.preventDefault(),e.touches.length===1){const t=e.touches[0];this.handlePointerMove(t.clientX,t.clientY)}}handleTouchEnd(e){e.preventDefault(),this.handlePointerUp()}handleMouseDown(e){this.handlePointerDown(e.clientX,e.clientY)}handleMouseMove(e){this.handlePointerMove(e.clientX,e.clientY)}handleMouseUp(e){this.handlePointerUp()}handlePointerDown(e,t){this.editMode;const i=this.getNormalizedCoords(e,t);if(this.currentTool==="triangle"){const o=W.createTriangle(i.x,i.y);this.polygons.push(o),this.selectPolygon(o),this.setTool("select")}else if(this.currentTool==="square"){const o=W.createSquare(i.x,i.y);this.polygons.push(o),this.selectPolygon(o),this.setTool("select")}else if(this.currentTool==="circle"){const o=W.createCircle(i.x,i.y);this.polygons.push(o),this.selectPolygon(o),this.setTool("select")}else if(this.currentTool==="draw"){if(this.drawingVertices.length>=3){const o=this.drawingVertices[0];if(Math.sqrt((i.x-o.x)**2+(i.y-o.y)**2)<.05){this.finishDrawing();return}}this.drawingVertices.push({x:i.x,y:i.y}),this.isDrawing=!0}else if(this.currentTool==="select"){let o=!1;for(let s=this.polygons.length-1;s>=0;s--){const n=this.polygons[s],a=n.getVertexAtPoint(i.x,i.y);if(a){this.selectPolygon(n),this.selectedVertex=a,this.updateVertexControls(!0),o=!0;break}}if(!o){for(let s=this.polygons.length-1;s>=0;s--){const n=this.polygons[s];if(n.containsPoint(i.x,i.y)){this.selectPolygon(n),this.selectedVertex=null,this.updateVertexControls(!1),this.dragStart=i,o=!0;break}}o||(this.selectPolygon(null),this.selectedVertex=null,this.updateVertexControls(!1))}}this.renderLayersList()}handlePointerMove(e,t){const i=this.getNormalizedCoords(e,t);if(this.selectedPolygon&&this.selectedVertex)this.selectedPolygon.moveVertex(this.selectedVertex,i.x,i.y);else if(this.selectedPolygon&&this.dragStart){const o=i.x-this.dragStart.x,s=i.y-this.dragStart.y;this.selectedPolygon.translate(o,s),this.dragStart=i}}handlePointerUp(){this.dragStart&&(this.dragStart=null)}finishDrawing(){if(this.drawingVertices.length>=3){const e=new T(this.drawingVertices);this.polygons.push(e),this.selectPolygon(e)}this.drawingVertices=[],this.isDrawing=!1,this.setTool("select"),this.renderLayersList(),window.innerWidth<768&&document.getElementById("leftSidebar").classList.remove("hidden")}selectPolygon(e){this.polygons.forEach(i=>i.selected=!1),this.selectedPolygon=e;const t=document.getElementById("rightSidebar");e?(e.selected=!0,t.classList.remove("hidden"),this.updatePropertiesPanel(e)):t.classList.add("hidden"),this.renderLayersList()}updatePropertiesPanel(e){const t=document.getElementById("currentContentInfo");e.contentType==="video"?t.textContent="Video":t.textContent=`Shader: ${e.shaderType}`,document.getElementById("warpToggle").checked=e.warpMode,document.getElementById("audioEnabledToggle").checked=e.audioSettings.enabled,document.getElementById("audioGainSlider").value=e.audioSettings.gain.toString(),document.getElementById("audioBassSlider").value=e.audioSettings.bassScale.toString(),document.getElementById("audioMidSlider").value=e.audioSettings.midScale.toString(),document.getElementById("audioHighSlider").value=e.audioSettings.highScale.toString(),this.renderEffectsList(e)}toggleWarpMode(e){this.selectedPolygon&&(e!==this.selectedPolygon.warpMode&&this.selectedPolygon.toggleWarpMode(),this.selectedVertex=null,this.updateVertexControls(!1))}updateVertexControls(e){const t=document.getElementById("vertexControls");e&&this.selectedVertex?t.classList.remove("hidden"):t.classList.add("hidden")}finetuneVertex(e){if(!this.selectedPolygon||!this.selectedVertex)return;const t=this.selectedPolygon,i=this.selectedVertex,o=1/this.canvas.width;let s=null;i.type==="grid"?s=t.gridVertices[i.index]:i.type==="vertex"?s=t.vertices[i.index]:i.type==="c1"?s=t.vertices[i.index].c1:i.type==="c2"&&(s=t.vertices[i.index].c2),s&&(e==="up"&&(s.y-=o),e==="down"&&(s.y+=o),e==="left"&&(s.x-=o),e==="right"&&(s.x+=o))}toggleVertexCurve(){if(!this.selectedPolygon||!this.selectedVertex||this.selectedVertex.type!=="vertex")return;const e=this.selectedPolygon,t=this.selectedVertex.index,i=e.vertices[t];if(i.bezier=!i.bezier,i.bezier&&(!i.c1||!i.c2)){const o=(t-1+e.vertices.length)%e.vertices.length,s=(t+1)%e.vertices.length,n=e.vertices[o],a=e.vertices[s],l=i.x-n.x,c=i.y-n.y;i.c1={x:i.x-l*.2,y:i.y-c*.2};const d=a.x-i.x,h=a.y-i.y;i.c2={x:i.x+d*.2,y:i.y+h*.2}}}deleteSelected(){if(this.selectedPolygon){const e=this.polygons.indexOf(this.selectedPolygon);e>=0&&(this.polygons.splice(e,1),this.selectPolygon(null))}this.renderLayersList()}showContentModal(){if(!this.selectedPolygon){this.showStatus("Please select a polygon first");return}document.getElementById("contentModal").classList.remove("hidden")}showShaderModal(){document.getElementById("contentModal").classList.add("hidden"),document.getElementById("shaderModal").classList.remove("hidden")}showVideoModal(){document.getElementById("contentModal").classList.add("hidden"),document.getElementById("videoModal").classList.remove("hidden"),this.updateVideoList()}hideAllModals(){document.querySelectorAll(".modal").forEach(e=>e.classList.add("hidden"))}setPolygonContent(e,t){this.selectedPolygon&&(this.selectedPolygon.setContent(e,t),this.hideAllModals(),this.showStatus(`Content updated: ${e}`),this.updatePropertiesPanel(this.selectedPolygon))}handleVideoUpload(e){const t=e.target.files[0];if(t){const i=URL.createObjectURL(t);this.loadedVideos.set(t.name,i),this.updateVideoList(),e.target.value=""}}updateVideoList(){const e=document.getElementById("videoList");e.innerHTML="",this.loadedVideos.forEach((t,i)=>{const o=document.createElement("button");o.className="content-type-btn",o.textContent=i,o.addEventListener("click",()=>{this.setPolygonContent("video",t)}),e.appendChild(o)})}togglePerformanceMode(){this.editMode=!this.editMode;const e=document.getElementById("uiContainer"),t=document.getElementById("toggleSidebarBtn");this.editMode?(e.classList.remove("hidden"),t.style.display="flex"):(e.classList.add("hidden"),t.style.display="none"),document.getElementById("performanceOverlay").classList.toggle("hidden",this.editMode),this.overlayCanvas.style.display=this.editMode?"block":"none"}toggleFullscreen(){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>this.showStatus("Fullscreen not available"))}showWelcomeModal(){const e=document.getElementById("welcomeModal"),t=document.getElementById("continueProjectBtn"),i=localStorage.getItem("mobileMapperProject")!==null;t.disabled=!i,e.classList.remove("hidden")}startNewProject(){this.polygons=[],this.loadedVideos.clear(),this.selectedPolygon=null,this.selectedVertex=null,localStorage.removeItem("mobileMapperProject"),document.getElementById("welcomeModal").classList.add("hidden"),this.showStatus("New project started"),this.selectPolygon(null)}continueLastProject(){this.loadProjectFromLocalStorage(),document.getElementById("welcomeModal").classList.add("hidden"),this.showStatus("Project loaded from last session")}loadProjectFromFile(){const e=document.createElement("input");e.type="file",e.accept=".json",e.onchange=t=>{const i=t.target.files[0];if(!i)return;const o=new FileReader;o.onload=s=>{try{const n=JSON.parse(s.target.result);this.loadProjectData(n),document.getElementById("welcomeModal").classList.add("hidden"),this.showStatus("Project loaded from file!")}catch(n){this.showStatus("Failed to load project file"),console.error(n)}},o.readAsText(i)},e.click()}saveProject(){const e=`projection-mapping-${new Date().toISOString().split("T")[0]}`;let t=prompt("Enter project name:",e);if(t===null)return;t=t.trim()||e,t.endsWith(".json")||(t+=".json");const i={polygons:this.polygons.map(a=>a.toJSON()),videos:Array.from(this.loadedVideos.entries()),version:"1.0",name:t.replace(".json","")};localStorage.setItem("mobileMapperProject",JSON.stringify(i));const o=new Blob([JSON.stringify(i,null,2)],{type:"application/json"}),s=URL.createObjectURL(o),n=document.createElement("a");n.href=s,n.download=t,n.click(),URL.revokeObjectURL(s),this.showStatus(`Project "${t}" saved!`)}loadProjectFromLocalStorage(){const e=localStorage.getItem("mobileMapperProject");if(e)try{const t=JSON.parse(e);this.loadProjectData(t)}catch(t){console.error("Failed to load project:",t)}}loadProjectData(e){this.polygons=e.polygons.map(t=>T.fromJSON(t)),e.videos&&(this.loadedVideos=new Map(e.videos),this.polygons.forEach(t=>{t.contentType==="video"&&(t.videoSrc&&this.loadedVideos.has(t.videoSrc)?t.loadVideo():(t.contentType="shader",t.shaderType="rainbow"))})),this.renderLayersList()}animate(){this.audioManager.isActive?this.renderer.updateAudioData(this.audioManager.getAudioData()):this.renderer.updateAudioData({low:0,mid:0,high:0,level:0}),this.renderer.render(this.polygons,this.editMode),this.overlayCtx.clearRect(0,0,this.overlayCanvas.width,this.overlayCanvas.height);const e=this.overlayCanvas.width,t=this.overlayCanvas.height;this.editMode&&this.polygons.forEach(i=>{if(i.selected,i.selected)if(i.getRenderVertices(),i.warpMode&&i.gridVertices.length>0){const o=i.gridSize;this.overlayCtx.strokeStyle="#ffff00",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath();for(let s=0;s<o;s++)for(let n=0;n<o-1;n++){const a=i.gridVertices[s*o+n],l=i.gridVertices[s*o+n+1];this.overlayCtx.moveTo(a.x*e,a.y*t),this.overlayCtx.lineTo(l.x*e,l.y*t)}for(let s=0;s<o;s++)for(let n=0;n<o-1;n++){const a=i.gridVertices[n*o+s],l=i.gridVertices[(n+1)*o+s];this.overlayCtx.moveTo(a.x*e,a.y*t),this.overlayCtx.lineTo(l.x*e,l.y*t)}this.overlayCtx.stroke(),i.gridVertices.forEach((s,n)=>{const a=s.x*e,l=s.y*t,c=this.selectedVertex&&this.selectedVertex.type==="grid"&&this.selectedVertex.index===n;this.overlayCtx.fillStyle=c?"#00ffff":"#ffff00",this.overlayCtx.beginPath(),this.overlayCtx.arc(a,l,c?8:4,0,Math.PI*2),this.overlayCtx.fill(),this.overlayCtx.stroke()})}else{const o=i.getDiscretizedVertices(30);this.overlayCtx.strokeStyle="#00ff00",this.overlayCtx.lineWidth=3,this.overlayCtx.beginPath(),o.forEach((s,n)=>{const a=s.x*e,l=s.y*t;n===0?this.overlayCtx.moveTo(a,l):this.overlayCtx.lineTo(a,l)}),this.overlayCtx.closePath(),this.overlayCtx.stroke(),i.vertices.forEach((s,n)=>{const a=s.x*e,l=s.y*t,c=this.selectedVertex&&this.selectedVertex.type==="vertex"&&this.selectedVertex.index===n;if(this.overlayCtx.fillStyle=c?"#00ffff":"#00ff00",this.overlayCtx.beginPath(),this.overlayCtx.arc(a,l,c?8:6,0,Math.PI*2),this.overlayCtx.fill(),this.overlayCtx.stroke(),s.bezier){if(s.c1){const d=s.c1.x*e,h=s.c1.y*t;this.overlayCtx.strokeStyle="rgba(255,255,255,0.5)",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath(),this.overlayCtx.moveTo(a,l),this.overlayCtx.lineTo(d,h),this.overlayCtx.stroke();const m=this.selectedVertex&&this.selectedVertex.type==="c1"&&this.selectedVertex.index===n;this.overlayCtx.fillStyle=m?"#ff00ff":"#ffffff",this.overlayCtx.beginPath(),this.overlayCtx.arc(d,h,4,0,Math.PI*2),this.overlayCtx.fill()}if(s.c2){const d=s.c2.x*e,h=s.c2.y*t;this.overlayCtx.strokeStyle="rgba(255,255,255,0.5)",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath(),this.overlayCtx.moveTo(a,l),this.overlayCtx.lineTo(d,h),this.overlayCtx.stroke();const m=this.selectedVertex&&this.selectedVertex.type==="c2"&&this.selectedVertex.index===n;this.overlayCtx.fillStyle=m?"#ff00ff":"#ffffff",this.overlayCtx.beginPath(),this.overlayCtx.arc(d,h,4,0,Math.PI*2),this.overlayCtx.fill()}}})}else{const o=i.getDiscretizedVertices(20);this.overlayCtx.strokeStyle="rgba(0, 255, 0, 0.3)",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath(),o.forEach((s,n)=>{const a=s.x*e,l=s.y*t;n===0?this.overlayCtx.moveTo(a,l):this.overlayCtx.lineTo(a,l)}),this.overlayCtx.closePath(),this.overlayCtx.stroke()}}),this.isDrawing&&this.drawingVertices.length>0&&(this.overlayCtx.strokeStyle="#ffff00",this.overlayCtx.lineWidth=2,this.overlayCtx.beginPath(),this.drawingVertices.forEach((i,o)=>{const s=i.x*e,n=i.y*t;o===0?this.overlayCtx.moveTo(s,n):this.overlayCtx.lineTo(s,n)}),this.overlayCtx.stroke(),this.drawingVertices.forEach((i,o)=>{const s=i.x*e,n=i.y*t;o===0?(this.overlayCtx.fillStyle="#ff0000",this.overlayCtx.beginPath(),this.overlayCtx.arc(s,n,8,0,Math.PI*2),this.overlayCtx.fill(),this.overlayCtx.strokeStyle="#ffffff",this.overlayCtx.lineWidth=2,this.overlayCtx.stroke()):(this.overlayCtx.fillStyle="#ffff00",this.overlayCtx.beginPath(),this.overlayCtx.arc(s,n,4,0,Math.PI*2),this.overlayCtx.fill())})),requestAnimationFrame(()=>this.animate())}showStatus(e){const t=document.getElementById("statusMsg");t.textContent=e,t.classList.remove("hidden"),setTimeout(()=>{t.classList.add("hidden")},2e3)}loadProjectDialog(){this.loadProjectFromFile()}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{window.app=new X}):window.app=new X;
