var fe=Object.defineProperty;var ge=(n,e,i)=>e in n?fe(n,e,{enumerable:!0,configurable:!0,writable:!0,value:i}):n[e]=i;var g=(n,e,i)=>ge(n,typeof e!="symbol"?e+"":e,i);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))t(o);new MutationObserver(o=>{for(const s of o)if(s.type==="childList")for(const r of s.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&t(r)}).observe(document,{childList:!0,subtree:!0});function i(o){const s={};return o.integrity&&(s.integrity=o.integrity),o.referrerPolicy&&(s.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?s.credentials="include":o.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function t(o){if(o.ep)return;o.ep=!0;const s=i(o);fetch(o.href,s)}})();const ve=`
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`,A=`
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
`,V=`
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
`,D=`
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
`,oe=`
    precision mediump float;
    uniform sampler2D u_texture;
    uniform float u_time;
    varying vec2 v_texCoord;
    
    ${A}
    ${V}
    ${D}

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
`,se={rainbow:{name:"Rainbow",fragment:`
            precision mediump float;
            uniform float u_time;
            varying vec2 v_texCoord;
            
            ${A}
            ${V}
            
            vec3 custom_hsv2rgb(vec3 c) { 
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            ${D}

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
        `},plasma:{name:"Plasma",fragment:`
            precision mediump float;
            uniform float u_time;
            varying vec2 v_texCoord;

            ${A}
            ${V}
            ${D}

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
        `},waves:{name:"Waves",fragment:`
            precision mediump float;
            uniform float u_time;
            varying vec2 v_texCoord;

            ${A}
            ${V}
            ${D}

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
        `},checkerboard:{name:"Checkerboard",fragment:`
            precision mediump float;
            uniform float u_time;
            varying vec2 v_texCoord;

            ${A}
            ${V}
            ${D}

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
        `},solid:{name:"Solid Color",fragment:`
            precision mediump float;
            uniform float u_time;
            varying vec2 v_texCoord;

            ${A}
            ${V}
            ${D}

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
        `},kaleidoscope:{name:"Kaleidoscope",fragment:`
            precision mediump float;
            uniform float u_time;
            varying vec2 v_texCoord;

            ${A}
            ${V}
            ${D}

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
      `},fractal:{name:"Fractal",fragment:`
            precision mediump float;
            uniform float u_time;
            varying vec2 v_texCoord;

            ${A}
            ${V}
            ${D}

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
      `}};function me(n,e,i=2){const t=n.length;let o=pe(n,0,t,i,!0);const s=[];if(!o||o.next===o.prev)return s;let r,a,c;if(n.length>80*i){r=n[0],a=n[1];let d=r,v=a;for(let h=i;h<t;h+=i){const l=n[h],m=n[h+1];l<r&&(r=l),m<a&&(a=m),l>d&&(d=l),m>v&&(v=m)}c=Math.max(d-r,v-a),c=c!==0?32767/c:0}return N(o,s,i,r,a,c,0),s}function pe(n,e,i,t,o){let s;if(o===Pe(n,e,i,t)>0)for(let r=e;r<i;r+=t)s=re(r/t|0,n[r],n[r+1],s);else for(let r=i-t;r>=e;r-=t)s=re(r/t|0,n[r],n[r+1],s);return s&&J(s,s.next)&&($(s),s=s.next),s}function O(n,e){if(!n)return n;e||(e=n);let i=n,t;do if(t=!1,!i.steiner&&(J(i,i.next)||b(i.prev,i,i.next)===0)){if($(i),i=e=i.prev,i===i.next)break;t=!0}else i=i.next;while(t||i!==e);return e}function N(n,e,i,t,o,s,r){if(!n)return;!r&&s&&Ee(n,t,o,s);let a=n;for(;n.prev!==n.next;){const c=n.prev,d=n.next;if(s?xe(n,t,o,s):ye(n)){e.push(c.i,n.i,d.i),$(n),n=d.next,a=d.next;continue}if(n=d,n===a){r?r===1?(n=Se(O(n),e),N(n,e,i,t,o,s,2)):r===2&&Ce(n,e,i,t,o,s):N(O(n),e,i,t,o,s,1);break}}}function ye(n){const e=n.prev,i=n,t=n.next;if(b(e,i,t)>=0)return!1;const o=e.x,s=i.x,r=t.x,a=e.y,c=i.y,d=t.y,v=Math.min(o,s,r),h=Math.min(a,c,d),l=Math.max(o,s,r),m=Math.max(a,c,d);let f=t.next;for(;f!==e;){if(f.x>=v&&f.x<=l&&f.y>=h&&f.y<=m&&z(o,a,s,c,r,d,f.x,f.y)&&b(f.prev,f,f.next)>=0)return!1;f=f.next}return!0}function xe(n,e,i,t){const o=n.prev,s=n,r=n.next;if(b(o,s,r)>=0)return!1;const a=o.x,c=s.x,d=r.x,v=o.y,h=s.y,l=r.y,m=Math.min(a,c,d),f=Math.min(v,h,l),x=Math.max(a,c,d),E=Math.max(v,h,l),T=Q(m,f,e,i,t),_=Q(x,E,e,i,t);let p=n.prevZ,y=n.nextZ;for(;p&&p.z>=T&&y&&y.z<=_;){if(p.x>=m&&p.x<=x&&p.y>=f&&p.y<=E&&p!==o&&p!==r&&z(a,v,c,h,d,l,p.x,p.y)&&b(p.prev,p,p.next)>=0||(p=p.prevZ,y.x>=m&&y.x<=x&&y.y>=f&&y.y<=E&&y!==o&&y!==r&&z(a,v,c,h,d,l,y.x,y.y)&&b(y.prev,y,y.next)>=0))return!1;y=y.nextZ}for(;p&&p.z>=T;){if(p.x>=m&&p.x<=x&&p.y>=f&&p.y<=E&&p!==o&&p!==r&&z(a,v,c,h,d,l,p.x,p.y)&&b(p.prev,p,p.next)>=0)return!1;p=p.prevZ}for(;y&&y.z<=_;){if(y.x>=m&&y.x<=x&&y.y>=f&&y.y<=E&&y!==o&&y!==r&&z(a,v,c,h,d,l,y.x,y.y)&&b(y.prev,y,y.next)>=0)return!1;y=y.nextZ}return!0}function Se(n,e){let i=n;do{const t=i.prev,o=i.next.next;!J(t,o)&&ce(t,i,i.next,o)&&Y(t,o)&&Y(o,t)&&(e.push(t.i,i.i,o.i),$(i),$(i.next),i=n=o),i=i.next}while(i!==n);return O(i)}function Ce(n,e,i,t,o,s){let r=n;do{let a=r.next.next;for(;a!==r.prev;){if(r.i!==a.i&&Le(r,a)){let c=Me(r,a);r=O(r,r.next),c=O(c,c.next),N(r,e,i,t,o,s,0),N(c,e,i,t,o,s,0);return}a=a.next}r=r.next}while(r!==n)}function Ee(n,e,i,t){let o=n;do o.z===0&&(o.z=Q(o.x,o.y,e,i,t)),o.prevZ=o.prev,o.nextZ=o.next,o=o.next;while(o!==n);o.prevZ.nextZ=null,o.prevZ=null,be(o)}function be(n){let e,i=1;do{let t=n,o;n=null;let s=null;for(e=0;t;){e++;let r=t,a=0;for(let d=0;d<i&&(a++,r=r.nextZ,!!r);d++);let c=i;for(;a>0||c>0&&r;)a!==0&&(c===0||!r||t.z<=r.z)?(o=t,t=t.nextZ,a--):(o=r,r=r.nextZ,c--),s?s.nextZ=o:n=o,o.prevZ=s,s=o;t=r}s.nextZ=null,i*=2}while(e>1);return n}function Q(n,e,i,t,o){return n=(n-i)*o|0,e=(e-t)*o|0,n=(n|n<<8)&16711935,n=(n|n<<4)&252645135,n=(n|n<<2)&858993459,n=(n|n<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,n|e<<1}function we(n,e,i,t,o,s,r,a){return(o-r)*(e-a)>=(n-r)*(s-a)&&(n-r)*(t-a)>=(i-r)*(e-a)&&(i-r)*(s-a)>=(o-r)*(t-a)}function z(n,e,i,t,o,s,r,a){return!(n===r&&e===a)&&we(n,e,i,t,o,s,r,a)}function Le(n,e){return n.next.i!==e.i&&n.prev.i!==e.i&&!Te(n,e)&&(Y(n,e)&&Y(e,n)&&_e(n,e)&&(b(n.prev,n,e.prev)||b(n,e.prev,e))||J(n,e)&&b(n.prev,n,n.next)>0&&b(e.prev,e,e.next)>0)}function b(n,e,i){return(e.y-n.y)*(i.x-e.x)-(e.x-n.x)*(i.y-e.y)}function J(n,e){return n.x===e.x&&n.y===e.y}function ce(n,e,i,t){const o=X(b(n,e,i)),s=X(b(n,e,t)),r=X(b(i,t,n)),a=X(b(i,t,e));return!!(o!==s&&r!==a||o===0&&Z(n,i,e)||s===0&&Z(n,t,e)||r===0&&Z(i,n,t)||a===0&&Z(i,e,t))}function Z(n,e,i){return e.x<=Math.max(n.x,i.x)&&e.x>=Math.min(n.x,i.x)&&e.y<=Math.max(n.y,i.y)&&e.y>=Math.min(n.y,i.y)}function X(n){return n>0?1:n<0?-1:0}function Te(n,e){let i=n;do{if(i.i!==n.i&&i.next.i!==n.i&&i.i!==e.i&&i.next.i!==e.i&&ce(i,i.next,n,e))return!0;i=i.next}while(i!==n);return!1}function Y(n,e){return b(n.prev,n,n.next)<0?b(n,e,n.next)>=0&&b(n,n.prev,e)>=0:b(n,e,n.prev)<0||b(n,n.next,e)<0}function _e(n,e){let i=n,t=!1;const o=(n.x+e.x)/2,s=(n.y+e.y)/2;do i.y>s!=i.next.y>s&&i.next.y!==i.y&&o<(i.next.x-i.x)*(s-i.y)/(i.next.y-i.y)+i.x&&(t=!t),i=i.next;while(i!==n);return t}function Me(n,e){const i=ee(n.i,n.x,n.y),t=ee(e.i,e.x,e.y),o=n.next,s=e.prev;return n.next=e,e.prev=n,i.next=o,o.prev=i,t.next=i,i.prev=t,s.next=t,t.prev=s,t}function re(n,e,i,t){const o=ee(n,e,i);return t?(o.next=t.next,o.prev=t,t.next.prev=o,t.next=o):(o.prev=o,o.next=o),o}function $(n){n.next.prev=n.prev,n.prev.next=n.next,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ)}function ee(n,e,i){return{i:n,x:e,y:i,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function Pe(n,e,i,t){let o=0;for(let s=e,r=i-t;s<i;s+=t)o+=(n[r]-n[s])*(n[s+1]+n[r+1]),r=s;return o}class Ae{constructor(e){g(this,"canvas");g(this,"gl");g(this,"programCache");g(this,"shaderCache");g(this,"videoTextures");g(this,"startTime");g(this,"audioData");g(this,"maskFramebuffer");g(this,"maskTexture");this.canvas=e,this.gl=e.getContext("webgl",{alpha:!0,stencil:!0}),this.programCache=new Map,this.shaderCache=new Map,this.videoTextures=new Map,this.startTime=Date.now(),this.audioData={low:0,mid:0,high:0,level:0},this.maskFramebuffer=null,this.maskTexture=null,this.resize(),window.addEventListener("resize",()=>this.resize())}resize(){const e=this.canvas.clientWidth,i=this.canvas.clientHeight;(this.canvas.width!==e||this.canvas.height!==i)&&(this.canvas.width=e,this.canvas.height=i,this.gl.viewport(0,0,this.canvas.width,this.canvas.height),this.initMaskBuffer())}initMaskBuffer(){const e=this.gl,i=this.canvas.width,t=this.canvas.height;this.maskTexture&&e.deleteTexture(this.maskTexture),this.maskFramebuffer&&e.deleteFramebuffer(this.maskFramebuffer),this.maskTexture=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.maskTexture),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,i,t,0,e.RGBA,e.UNSIGNED_BYTE,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),this.maskFramebuffer=e.createFramebuffer(),e.bindFramebuffer(e.FRAMEBUFFER,this.maskFramebuffer),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.maskTexture,0),e.bindFramebuffer(e.FRAMEBUFFER,null)}updateAudioData(e){this.audioData=e}createShader(e,i,t){const o=e.createShader(i);return e.shaderSource(o,t),e.compileShader(o),e.getShaderParameter(o,e.COMPILE_STATUS)?o:(console.error("Shader compile error:",e.getShaderInfoLog(o)),e.deleteShader(o),null)}createProgram(e,i,t){const o=this.createShader(e,e.VERTEX_SHADER,i),s=this.createShader(e,e.FRAGMENT_SHADER,t),r=e.createProgram();return e.attachShader(r,o),e.attachShader(r,s),e.linkProgram(r),e.getProgramParameter(r,e.LINK_STATUS)?r:(console.error("Program link error:",e.getProgramInfoLog(r)),null)}getProgramInfo(e,i){if(this.shaderCache.has(e))return this.shaderCache.get(e);const t=this.gl,o=this.createProgram(t,ve,i);if(!o)return null;const s={program:o,attribLocations:{position:t.getAttribLocation(o,"a_position"),texCoord:t.getAttribLocation(o,"a_texCoord")},uniformLocations:{resolution:t.getUniformLocation(o,"u_resolution"),time:t.getUniformLocation(o,"u_time"),texture:t.getUniformLocation(o,"u_texture"),brightness:t.getUniformLocation(o,"u_brightness"),contrast:t.getUniformLocation(o,"u_contrast"),saturation:t.getUniformLocation(o,"u_saturation"),hue:t.getUniformLocation(o,"u_hue"),patternMode:t.getUniformLocation(o,"u_patternMode"),patternScale:t.getUniformLocation(o,"u_patternScale"),patternIntensity:t.getUniformLocation(o,"u_patternIntensity"),patternSpeed:t.getUniformLocation(o,"u_patternSpeed"),enableBorder:t.getUniformLocation(o,"u_enableBorder"),borderWidth:t.getUniformLocation(o,"u_borderWidth"),borderColor:t.getUniformLocation(o,"u_borderColor"),borderSpeed:t.getUniformLocation(o,"u_borderSpeed"),enableEdge:t.getUniformLocation(o,"u_enableEdge"),edgeThreshold:t.getUniformLocation(o,"u_edgeThreshold"),edgeColor:t.getUniformLocation(o,"u_edgeColor"),edgeMode:t.getUniformLocation(o,"u_edgeMode"),edgeSpeed:t.getUniformLocation(o,"u_edgeSpeed"),audioLow:t.getUniformLocation(o,"u_audioLow"),audioMid:t.getUniformLocation(o,"u_audioMid"),audioHigh:t.getUniformLocation(o,"u_audioHigh"),audioLevel:t.getUniformLocation(o,"u_audioLevel"),audioBassScale:t.getUniformLocation(o,"u_audioBassScale"),audioMidScale:t.getUniformLocation(o,"u_audioMidScale"),audioHighScale:t.getUniformLocation(o,"u_audioHighScale"),audioGain:t.getUniformLocation(o,"u_audioGain"),useMask:t.getUniformLocation(o,"u_useMask"),maskTexture:t.getUniformLocation(o,"u_maskTexture")}};return this.shaderCache.set(e,s),s}renderPolygon(e,i=!1){const t=this.gl;let o;if(i&&e.useAsMask&&!e.drawingCanvas)return;if(e.contentType==="video"||e.contentType==="drawing"||e.contentType==="image")o=this.getProgramInfo("video",oe);else if(i)o=this.getProgramInfo("video",oe);else{const S=se[e.shaderType]||se.rainbow;o=this.getProgramInfo(e.shaderType,S.fragment)}if(!o)return;t.useProgram(o.program);const s=[],r=[];if(e.warpMode&&e.gridVertices.length>0){const S=e.gridSize;for(let C=0;C<S-1;C++)for(let w=0;w<S-1;w++){const F=C*S+w,k=C*S+w+1,L=(C+1)*S+w,R=(C+1)*S+w+1;this.addTriangleToBuffers(s,r,e.gridVertices,F,k,L,S,w,C,0),this.addTriangleToBuffers(s,r,e.gridVertices,k,R,L,S,w,C,1)}}else{const S=e.getDiscretizedVertices(20),C=[];S.forEach(L=>C.push(L.x,L.y));const w=me(C),F=e.getBoundingBox(),k=(L,R)=>[(L-F.minX)/F.width,(R-F.minY)/F.height];for(let L=0;L<w.length;L+=3){const R=w[L],he=w[L+1],ue=w[L+2],H=S[R],W=S[he],q=S[ue];s.push(H.x*2-1,-(H.y*2-1)),s.push(W.x*2-1,-(W.y*2-1)),s.push(q.x*2-1,-(q.y*2-1)),r.push(...k(H.x,H.y)),r.push(...k(W.x,W.y)),r.push(...k(q.x,q.y))}}const a=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,a),t.bufferData(t.ARRAY_BUFFER,new Float32Array(s),t.STATIC_DRAW),t.enableVertexAttribArray(o.attribLocations.position),t.vertexAttribPointer(o.attribLocations.position,2,t.FLOAT,!1,0,0);const c=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,c),t.bufferData(t.ARRAY_BUFFER,new Float32Array(r),t.STATIC_DRAW),t.enableVertexAttribArray(o.attribLocations.texCoord),t.vertexAttribPointer(o.attribLocations.texCoord,2,t.FLOAT,!1,0,0);let d=0,v=1,h=1,l=0,m=0,f=10,x=0,E=1,T=0,_=0,p={r:1,g:1,b:1},y=0,P=0,G=.1,B={r:1,g:1,b:1},te=0,ie=1;i||e.effects.forEach(S=>{const C=S.params;S.type==="brightness"&&(d+=C.value),S.type==="contrast"&&(v*=C.value),S.type==="saturation"&&(h*=C.value),S.type==="hue"&&(l+=C.value),["scanlines","dots","grid"].includes(S.type)&&(m=S.type==="scanlines"?1:S.type==="dots"?2:3,f=C.scale,x=C.intensity,E=C.speed||1),S.type==="border"&&(T=1,_=C.width,C.color&&(p=C.color),y=C.speed||0),S.type==="edge_detection"&&(P=1,G=C.threshold,C.color&&(B=C.color),te=C.mode||0,ie=C.speed||1)}),t.uniform1f(o.uniformLocations.brightness,d),t.uniform1f(o.uniformLocations.contrast,v),t.uniform1f(o.uniformLocations.saturation,h),t.uniform1f(o.uniformLocations.hue,l),t.uniform1i(o.uniformLocations.patternMode,m),t.uniform1f(o.uniformLocations.patternScale,f),t.uniform1f(o.uniformLocations.patternIntensity,x),t.uniform1f(o.uniformLocations.patternSpeed,E),t.uniform1i(o.uniformLocations.enableBorder,T),t.uniform1f(o.uniformLocations.borderWidth,_),t.uniform1f(o.uniformLocations.borderSpeed,y),p&&t.uniform3f(o.uniformLocations.borderColor,p.r,p.g,p.b),t.uniform1i(o.uniformLocations.enableEdge,P),t.uniform1f(o.uniformLocations.edgeThreshold,G),B&&t.uniform3f(o.uniformLocations.edgeColor,B.r,B.g,B.b),t.uniform1i(o.uniformLocations.edgeMode,te),t.uniform1f(o.uniformLocations.edgeSpeed,ie),t.uniform1f(o.uniformLocations.audioLow,this.audioData.low),t.uniform1f(o.uniformLocations.audioMid,this.audioData.mid),t.uniform1f(o.uniformLocations.audioHigh,this.audioData.high),t.uniform1f(o.uniformLocations.audioLevel,this.audioData.level);const U=e.audioSettings||{bassScale:1,midScale:1,highScale:1,gain:1,enabled:!0},j=U.enabled?1:0;t.uniform1f(o.uniformLocations.audioBassScale,U.bassScale*j),t.uniform1f(o.uniformLocations.audioMidScale,U.midScale*j),t.uniform1f(o.uniformLocations.audioHighScale,U.highScale*j),t.uniform1f(o.uniformLocations.audioGain,U.gain*j);const de=(Date.now()-this.startTime)/1e3;if(t.uniform1f(o.uniformLocations.time,de),i?t.uniform1i(o.uniformLocations.useMask,0):(t.uniform1i(o.uniformLocations.useMask,1),t.uniform1i(o.uniformLocations.maskTexture,1)),e.contentType==="video"&&e.videoElement||e.contentType==="drawing"&&e.drawingCanvas||e.contentType==="image"&&e.imageElement&&e.imageElement.complete){let S=this.videoTextures.get(e.id);S||(S=t.createTexture(),this.videoTextures.set(e.id,S),e.contentType==="image"&&(t.bindTexture(t.TEXTURE_2D,S),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,e.imageElement),e.isDirty=!1)),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,S);const C=e.contentType==="video"?e.videoElement:e.contentType==="image"?e.imageElement:e.drawingCanvas;e.contentType==="video"?t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,C):e.isDirty&&(t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,C),e.isDirty=!1),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.uniform1i(o.uniformLocations.texture,0)}t.uniform2f(o.uniformLocations.resolution,this.canvas.width,this.canvas.height),t.drawArrays(t.TRIANGLES,0,s.length/2),t.deleteBuffer(a),t.deleteBuffer(c)}addTriangleToBuffers(e,i,t,o,s,r,a,c,d,v){const h=t[o],l=t[s],m=t[r];e.push(h.x*2-1,-(h.y*2-1)),e.push(l.x*2-1,-(l.y*2-1)),e.push(m.x*2-1,-(m.y*2-1));const f=a-1,x=c/f,E=d/f;v===0?(i.push(x,E),i.push((c+1)/f,E),i.push(x,(d+1)/f)):(i.push((c+1)/f,E),i.push((c+1)/f,(d+1)/f),i.push(x,(d+1)/f))}render(e,i){this.resize();const t=this.gl,o=e.filter(s=>s.type==="drawing"&&s.useAsMask&&!s.parent);t.bindFramebuffer(t.FRAMEBUFFER,this.maskFramebuffer),t.viewport(0,0,this.canvas.width,this.canvas.height),t.clearColor(1,1,1,1),t.clear(t.COLOR_BUFFER_BIT),o.length>0&&o.forEach(s=>{if(!s.drawingCanvas)return;t.blendFuncSeparate(t.ZERO,t.ONE_MINUS_SRC_ALPHA,t.ZERO,t.ONE_MINUS_SRC_ALPHA),t.enable(t.BLEND);const r=s.shaderType,a=s.contentType;s.contentType="shader",s.shaderType="solid",this.renderPolygon(s,!0),s.contentType=a,s.shaderType=r,t.blendFunc(t.ONE,t.ONE),this.renderPolygon(s,!0)}),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),t.bindFramebuffer(t.FRAMEBUFFER,null),t.viewport(0,0,this.canvas.width,this.canvas.height),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT|t.STENCIL_BUFFER_BIT),t.activeTexture(t.TEXTURE1),t.bindTexture(t.TEXTURE_2D,this.maskTexture),e.forEach(s=>{s.parent||s.useAsMask||(s.children&&s.children.length>0?(t.enable(t.STENCIL_TEST),t.clear(t.STENCIL_BUFFER_BIT),t.stencilFunc(t.ALWAYS,1,255),t.stencilOp(t.KEEP,t.KEEP,t.REPLACE),t.colorMask(!1,!1,!1,!1),s.children.forEach(r=>{const a=r.shaderType,c=r.contentType;r.contentType="shader",r.shaderType="solid",this.renderPolygon(r,!1),r.contentType=c,r.shaderType=a}),t.colorMask(!0,!0,!0,!0),t.stencilFunc(t.EQUAL,1,255),t.stencilOp(t.KEEP,t.KEEP,t.KEEP),this.renderPolygon(s,!1),t.disable(t.STENCIL_TEST)):this.renderPolygon(s,!1))})}}class M{constructor(e,i=null,t="polygon"){g(this,"id");g(this,"vertices");g(this,"type");g(this,"contentType");g(this,"shaderType");g(this,"videoSrc");g(this,"videoElement");g(this,"imageSrc");g(this,"imageElement");g(this,"selected");g(this,"effects");g(this,"warpMode");g(this,"gridVertices");g(this,"gridSize");g(this,"audioSettings");g(this,"drawingCanvas");g(this,"drawingCtx");g(this,"isDirty");g(this,"useAsMask");g(this,"parent");g(this,"children");this.id=i||Date.now()+Math.random(),this.vertices=e,this.type=t,this.contentType="shader",this.shaderType="rainbow",this.videoSrc=null,this.videoElement=null,this.imageSrc=null,this.imageElement=null,this.selected=!1,this.effects=[],this.warpMode=!1,this.gridVertices=[],this.gridSize=3,this.audioSettings={bassScale:1,midScale:1,highScale:1,gain:1,enabled:!0},this.drawingCanvas=null,this.drawingCtx=null,this.isDirty=!1,this.useAsMask=!1,this.parent=null,this.children=[],t==="drawing"&&this.initDrawingCanvas()}initDrawingCanvas(){this.drawingCanvas=document.createElement("canvas"),this.drawingCanvas.width=1024,this.drawingCanvas.height=1024,this.drawingCtx=this.drawingCanvas.getContext("2d"),this.contentType="drawing",this.isDirty=!0}createGrid(){const e=this.getBoundingBox();this.gridVertices=[];for(let i=0;i<this.gridSize;i++)for(let t=0;t<this.gridSize;t++)this.gridVertices.push({x:e.minX+t/(this.gridSize-1)*e.width,y:e.minY+i/(this.gridSize-1)*e.height})}setGridSize(e){this.gridSize!==e&&(this.gridSize=e,this.warpMode&&this.createGrid())}toggleWarpMode(){this.warpMode=!this.warpMode,this.warpMode&&this.gridVertices.length===0&&this.createGrid()}addEffect(e){const i=Date.now().toString();let t={};e==="brightness"?t={value:0}:e==="contrast"?t={value:1}:e==="saturation"?t={value:1}:e==="hue"?t={value:0}:["scanlines","dots","grid"].includes(e)?t={scale:10,intensity:.5,speed:1}:e==="border"?t={width:.02,color:{r:1,g:1,b:1},speed:2}:e==="edge_detection"&&(t={threshold:.1,color:{r:1,g:1,b:1},mode:0,speed:1}),this.effects.push({id:i,type:e,params:t})}removeEffect(e){this.effects=this.effects.filter(i=>i.id!==e)}updateEffect(e,i){const t=this.effects.find(o=>o.id===e);t&&(t.params={...t.params,...i})}setContent(e,i){this.contentType=e,e==="shader"?this.shaderType=i:e==="video"?(this.videoSrc=i,this.loadVideo()):e==="image"&&(this.imageSrc=i,this.loadImage())}loadVideo(){this.videoSrc&&(this.videoElement=document.createElement("video"),this.videoElement.src=this.videoSrc,this.videoElement.loop=!0,this.videoElement.muted=!0,this.videoElement.setAttribute("playsinline",""),this.videoElement.setAttribute("webkit-playsinline",""),this.videoElement.play().catch(e=>console.warn("Video play failed",e)))}loadImage(){this.imageSrc&&(this.imageElement=new Image,this.imageElement.crossOrigin="anonymous",this.imageElement.onload=()=>{this.isDirty=!0},this.imageElement.src=this.imageSrc)}getBoundingBox(){let e=1/0,i=-1/0,t=1/0,o=-1/0;return(this.warpMode&&this.gridVertices.length>0?this.gridVertices:this.vertices).forEach(r=>{r.x<e&&(e=r.x),r.x>i&&(i=r.x),r.y<t&&(t=r.y),r.y>o&&(o=r.y)}),e===1/0?{minX:0,minY:0,maxX:1,maxY:1,width:1,height:1}:{minX:e,minY:t,maxX:i,maxY:o,width:i-e,height:o-t}}getDiscretizedVertices(e=10){const i=[];for(let t=0;t<this.vertices.length;t++){const o=this.vertices[t],s=this.vertices[(t+1)%this.vertices.length];if(o.bezier&&o.c2&&s.c1)for(let r=0;r<1;r+=1/e){const a=Math.pow(1-r,3)*o.x+3*Math.pow(1-r,2)*r*o.c2.x+3*(1-r)*Math.pow(r,2)*s.c1.x+Math.pow(r,3)*s.x,c=Math.pow(1-r,3)*o.y+3*Math.pow(1-r,2)*r*o.c2.y+3*(1-r)*Math.pow(r,2)*s.c1.y+Math.pow(r,3)*s.y;i.push({x:a,y:c})}else i.push(o)}return i}getRenderVertices(){return this.warpMode?this.gridVertices:this.vertices}containsPoint(e,i){let t=!1;const o=this.getDiscretizedVertices(10);for(let s=0,r=o.length-1;s<o.length;r=s++){const a=o[s].x,c=o[s].y,d=o[r].x,v=o[r].y;c>i!=v>i&&e<(d-a)*(i-c)/(v-c)+a&&(t=!t)}return t}getVertexAtPoint(e,i,t=.02){if(this.warpMode){for(let o=0;o<this.gridVertices.length;o++){const s=this.gridVertices[o];if(Math.sqrt((s.x-e)**2+(s.y-i)**2)<t)return{type:"grid",index:o}}return null}for(let o=0;o<this.vertices.length;o++){const s=this.vertices[o];if(Math.sqrt((s.x-e)**2+(s.y-i)**2)<t)return{type:"vertex",index:o};if(s.bezier){if(s.c1&&Math.sqrt((s.c1.x-e)**2+(s.c1.y-i)**2)<t)return{type:"c1",index:o};if(s.c2&&Math.sqrt((s.c2.x-e)**2+(s.c2.y-i)**2)<t)return{type:"c2",index:o}}}return null}moveVertex(e,i,t){if(e.type==="grid")this.gridVertices[e.index].x=i,this.gridVertices[e.index].y=t;else if(e.type==="vertex"){const o=this.vertices[e.index],s=i-o.x,r=t-o.y;o.x=i,o.y=t,o.c1&&(o.c1.x+=s,o.c1.y+=r),o.c2&&(o.c2.x+=s,o.c2.y+=r)}else e.type==="c1"?this.vertices[e.index].c1={x:i,y:t}:e.type==="c2"&&(this.vertices[e.index].c2={x:i,y:t})}translate(e,i){this.vertices.forEach(t=>{t.x+=e,t.y+=i,t.c1&&(t.c1.x+=e,t.c1.y+=i),t.c2&&(t.c2.x+=e,t.c2.y+=i)}),this.warpMode&&this.gridVertices.forEach(t=>{t.x+=e,t.y+=i})}toJSON(){return{id:this.id,vertices:this.vertices,type:this.type,contentType:this.contentType,shaderType:this.shaderType,videoSrc:this.videoSrc,imageSrc:this.imageSrc,effects:this.effects,warpMode:this.warpMode,gridVertices:this.gridVertices,gridSize:this.gridSize,audioSettings:this.audioSettings,useAsMask:this.useAsMask,drawingData:this.drawingCanvas?this.drawingCanvas.toDataURL():null,children:this.children.map(e=>e.toJSON())}}static fromJSON(e){const i=new M(e.vertices,e.id,e.type);if(i.contentType=e.contentType,i.shaderType=e.shaderType,i.videoSrc=e.videoSrc,i.imageSrc=e.imageSrc,i.useAsMask=e.useAsMask||!1,i.effects=e.effects||[],i.warpMode=e.warpMode||!1,i.gridVertices=e.gridVertices||[],i.gridSize=e.gridSize||3,i.audioSettings=e.audioSettings||{bassScale:1,midScale:1,highScale:1,gain:1,enabled:!0},i.videoSrc&&i.loadVideo(),i.imageSrc&&i.loadImage(),e.type==="drawing"&&e.drawingData){i.initDrawingCanvas();const t=new Image;t.onload=()=>{i.drawingCtx.drawImage(t,0,0),i.isDirty=!0},t.src=e.drawingData}return e.children&&(i.children=e.children.map(t=>{const o=M.fromJSON(t);return o.parent=i,o})),i}}class I{static createTriangle(e,i,t=.15){const o=t*Math.sqrt(3)/2;return new M([{x:e,y:i-o*.66},{x:e-t/2,y:i+o*.33},{x:e+t/2,y:i+o*.33}],null,"triangle")}static createSquare(e,i,t=.15){const o=t/2;return new M([{x:e-o,y:i-o},{x:e+o,y:i-o},{x:e+o,y:i+o},{x:e-o,y:i+o}],null,"quad")}static createWarpRect(e,i,t=.15){const o=I.createSquare(e,i,t);return o.warpMode=!0,o.createGrid(),o}static createCanvas(e,i,t=.5){const o=t/2;return new M([{x:e-o,y:i-o},{x:e+o,y:i-o},{x:e+o,y:i+o},{x:e-o,y:i+o}],null,"drawing")}static createCircle(e,i,t=.15){const o=t/2,s=o*.55228,r={x:e,y:i-o,c1:{x:e-s,y:i-o},c2:{x:e+s,y:i-o},bezier:!0},a={x:e+o,y:i,c1:{x:e+o,y:i-s},c2:{x:e+o,y:i+s},bezier:!0},c={x:e,y:i+o,c1:{x:e+s,y:i+o},c2:{x:e-s,y:i+o},bezier:!0},d={x:e-o,y:i,c1:{x:e-o,y:i+s},c2:{x:e-o,y:i-s},bezier:!0};return new M([r,a,c,d],null,"circle")}}class Ve{constructor(){g(this,"audioContext");g(this,"analyser");g(this,"source");g(this,"dataArray");g(this,"isActive");g(this,"stream");this.audioContext=null,this.analyser=null,this.source=null,this.dataArray=null,this.isActive=!1,this.stream=null}async start(){if(!this.isActive)try{this.stream=await navigator.mediaDevices.getUserMedia({audio:!0}),this.audioContext=new(window.AudioContext||window.webkitAudioContext),this.analyser=this.audioContext.createAnalyser(),this.analyser.fftSize=256,this.source=this.audioContext.createMediaStreamSource(this.stream),this.source.connect(this.analyser),this.dataArray=new Uint8Array(this.analyser.frequencyBinCount),this.isActive=!0,console.log("Audio analysis started")}catch(e){console.error("Error accessing microphone:",e),alert("Could not access microphone. Please ensure you have granted permission.")}}stop(){this.isActive&&(this.stream&&this.stream.getTracks().forEach(e=>e.stop()),this.audioContext&&this.audioContext.close(),this.isActive=!1,this.audioContext=null,this.analyser=null,this.source=null)}getAudioData(){if(!this.isActive||!this.analyser||!this.dataArray)return{low:0,mid:0,high:0,level:0};this.analyser.getByteFrequencyData(this.dataArray);const e=this.analyser.frequencyBinCount,i=Math.floor(e*.1),t=Math.floor(e*.5);let o=0,s=0,r=0;for(let c=0;c<e;c++){const d=this.dataArray[c]/255;c<i?o+=d:c<t?s+=d:r+=d}o/=i,s/=t-i,r/=e-t;const a=(o+s+r)/3;return{low:o,mid:s,high:r,level:a}}}const K={getItem:n=>{try{return localStorage.getItem(n)}catch(e){return console.warn("LocalStorage access denied",e),null}},setItem:(n,e)=>{try{localStorage.setItem(n,e)}catch(i){console.warn("LocalStorage set failed",i)}},removeItem:n=>{try{localStorage.removeItem(n)}catch(e){console.warn("LocalStorage remove failed",e)}}},u=n=>document.getElementById(n),ne=n=>{const e=/^#?([a-f\d])([a-f\d])([a-f\d])$/i;n=n.replace(e,(t,o,s,r)=>o+o+s+s+r+r);const i=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(n);return i?{r:parseInt(i[1],16)/255,g:parseInt(i[2],16)/255,b:parseInt(i[3],16)/255}:{r:1,g:1,b:1}},ae=(n,e,i)=>{const t=o=>{const s=Math.round(o*255).toString(16);return s.length===1?"0"+s:s};return"#"+t(n)+t(e)+t(i)};class le{constructor(){g(this,"canvas");g(this,"overlayCanvas");g(this,"overlayCtx");g(this,"renderer");g(this,"audioManager");g(this,"polygons");g(this,"selectedPolygon");g(this,"selectedVertex");g(this,"currentTool");g(this,"drawingVertices");g(this,"isDrawing");g(this,"dragStart");g(this,"editMode");g(this,"loadedVideos");g(this,"loadedImages");g(this,"controlsDragStart");g(this,"controlsPosition");g(this,"uiVisible");g(this,"userHasToggledMode");g(this,"lastBrushPos",null);g(this,"isDraggingVertex",!1);g(this,"isPlacingPoint",!1);g(this,"draggingLayer",null);g(this,"dragGhost",null);g(this,"dragStartY",0);g(this,"dragTimeout",null);g(this,"history",[]);g(this,"historyIndex",-1);g(this,"MAX_HISTORY",20);this.canvas=document.getElementById("mainCanvas"),this.overlayCanvas=document.getElementById("overlayCanvas"),this.overlayCtx=this.overlayCanvas.getContext("2d"),this.renderer=new Ae(this.canvas),this.audioManager=new Ve,this.polygons=[],this.selectedPolygon=null,this.selectedVertex=null,this.currentTool="select",this.drawingVertices=[],this.isDrawing=!1,this.dragStart=null,this.editMode=!0,this.loadedVideos=new Map,this.loadedImages=new Map,this.controlsDragStart=null,this.controlsPosition={x:null,y:null},this.uiVisible=!0,this.userHasToggledMode=!1;try{this.setupEventListeners(),this.resizeOverlay(),window.addEventListener("resize",()=>{this.resizeOverlay()}),this.showWelcomeModal(),this.animate()}catch(e){console.error("Critical Initialization Error:",e),this.showStatus("App failed to initialize. Check console.")}}saveState(){this.historyIndex<this.history.length-1&&(this.history=this.history.slice(0,this.historyIndex+1));const e={polygons:this.polygons.map(i=>i.toJSON())};this.history.push(JSON.stringify(e)),this.history.length>this.MAX_HISTORY?this.history.shift():this.historyIndex++,this.history.length<=this.MAX_HISTORY&&(this.historyIndex=this.history.length-1)}undo(){if(this.historyIndex>0){this.historyIndex--;const e=JSON.parse(this.history[this.historyIndex]);this.restoreState(e),this.showStatus(`Undo (${this.historyIndex+1}/${this.history.length})`)}else this.showStatus("Nothing to undo")}redo(){if(this.historyIndex<this.history.length-1){this.historyIndex++;const e=JSON.parse(this.history[this.historyIndex]);this.restoreState(e),this.showStatus(`Redo (${this.historyIndex+1}/${this.history.length})`)}else this.showStatus("Nothing to redo")}restoreState(e){this.selectPolygon(null),this.polygons=e.polygons.map(i=>M.fromJSON(i)),this.polygons.forEach(i=>{i.children&&i.children.forEach(t=>t.parent=i)}),this.polygons.forEach(i=>{const t=o=>{o.contentType==="video"?(o.videoSrc&&this.loadedVideos.has(this.getVideoNameFromUrl(o.videoSrc))||o.videoSrc)&&o.loadVideo():o.contentType==="image"&&o.imageSrc&&o.loadImage(),o.children&&o.children.forEach(t)};t(i)}),this.renderLayersList()}getVideoNameFromUrl(e){return e}resizeOverlay(){if(!this.overlayCanvas)return;const e=this.overlayCanvas.clientWidth,i=this.overlayCanvas.clientHeight;(this.overlayCanvas.width!==e||this.overlayCanvas.height!==i)&&(this.overlayCanvas.width=e,this.overlayCanvas.height=i)}setupEventListeners(){const e=(l,m)=>{const f=u(l);f&&f.addEventListener("click",m)};e("toggleSidebarBtn",()=>{const l=u("leftSidebar");l&&l.classList.toggle("hidden")}),e("toggleRightSidebarBtn",()=>{const l=u("rightSidebar");l&&l.classList.toggle("hidden")}),document.querySelectorAll(".sidebar-section h3").forEach(l=>{l.style.cursor="pointer",l.addEventListener("click",m=>{const f=m.target.closest(".sidebar-section");f&&Array.from(f.children).forEach(x=>{if(x.tagName!=="H3"){const E=x;E.style.display=E.style.display==="none"?"":"none"}})})}),e("addTriangleBtn",()=>this.setTool("triangle")),e("addSquareBtn",()=>this.setTool("square")),e("addCircleBtn",()=>this.setTool("circle")),e("drawPolygonBtn",()=>this.setTool("draw")),e("addWarpRectBtn",()=>{const l=I.createWarpRect(.5,.5,.5);this.addPolygon(l)}),e("addCanvasBtn",()=>{const l=I.createCanvas(.5,.5);this.polygons.push(l),this.selectPolygon(l),this.setTool("brush")}),e("selectBtn",()=>this.setTool("select")),e("brushBtn",()=>this.setTool("brush")),e("deleteBtn",()=>this.deleteSelected());const i=()=>{const l=u("brushSizeSlider"),m=u("brushOpacitySlider"),f=u("brushColorPicker"),x=u("eraserToggle");if(!l||!m||!f||!x)return{size:5,opacity:1,color:"#fff",eraser:!1};const E=parseInt(l.value),T=parseFloat(m.value),_=f.value,p=x.checked,y=u("brushSizeVal"),P=u("brushOpacityVal");return y&&(y.textContent=E.toString()),P&&(P.textContent=T.toFixed(1)),{size:E,opacity:T,color:_,eraser:p}};["brushSizeSlider","brushOpacitySlider","brushColorPicker","eraserToggle"].forEach(l=>{const m=u(l);m&&m.addEventListener("input",i)}),e("clearCanvasBtn",()=>{this.selectedPolygon&&this.selectedPolygon.type==="drawing"&&this.selectedPolygon.drawingCtx&&(this.selectedPolygon.drawingCtx.clearRect(0,0,1024,1024),this.selectedPolygon.isDirty=!0)});const t=u("useAsMaskToggle");t&&t.addEventListener("change",l=>{this.selectedPolygon&&this.selectedPolygon.type==="drawing"&&(this.selectedPolygon.useAsMask=l.target.checked)}),e("changeContentBtn",()=>this.showContentModal());const o=u("warpToggle");o&&o.addEventListener("change",l=>{this.toggleWarpMode(l.target.checked)});const s=u("gridSizeSlider");s&&s.addEventListener("input",l=>{if(this.selectedPolygon){const m=parseInt(l.target.value),f=u("gridSizeVal"),x=u("gridSizeVal2");f&&(f.textContent=m.toString()),x&&(x.textContent=m.toString()),this.selectedPolygon.setGridSize(m)}});const r=u("audioEnabledToggle");r&&r.addEventListener("change",l=>{this.selectedPolygon&&(this.selectedPolygon.audioSettings.enabled=l.target.checked)});const a=(l,m)=>{const f=u(l);f&&f.addEventListener("input",x=>{this.selectedPolygon&&(this.selectedPolygon.audioSettings[m]=parseFloat(x.target.value))})};a("audioGainSlider","gain"),a("audioBassSlider","bassScale"),a("audioMidSlider","midScale"),a("audioHighSlider","highScale"),e("addEffectBtn",()=>{const l=u("effectTypeSelect");l&&this.addEffect(l.value)}),e("performanceBtn",()=>this.togglePerformanceMode()),e("fullscreenBtn",()=>this.toggleFullscreen()),e("saveBtn",()=>this.saveProject()),e("loadBtn",()=>this.loadProjectDialog()),e("audioToggleBtn",()=>this.toggleAudio()),e("undoBtn",()=>this.undo()),e("redoBtn",()=>this.redo()),this.canvas.addEventListener("touchstart",l=>this.handleTouchStart(l),{passive:!1}),this.canvas.addEventListener("touchmove",l=>this.handleTouchMove(l),{passive:!1}),this.canvas.addEventListener("touchend",l=>this.handleTouchEnd(l),{passive:!1}),this.canvas.addEventListener("mousedown",l=>this.handleMouseDown(l)),this.canvas.addEventListener("mousemove",l=>this.handleMouseMove(l)),document.addEventListener("mouseup",l=>this.handleMouseUp(l)),document.querySelectorAll(".arrow-btn").forEach(l=>{l.addEventListener("click",()=>{this.finetuneVertex(l.dataset.dir)})}),e("toggleCurveBtn",()=>this.toggleVertexCurve()),document.querySelectorAll(".close-modal").forEach(l=>{l.addEventListener("click",()=>this.hideAllModals())}),document.querySelectorAll(".content-type-btn").forEach(l=>{l.addEventListener("click",()=>{const m=l.dataset.type;m==="shader"?this.showShaderModal():m==="video"?this.showVideoModal():m==="image"&&this.showImageModal()})}),document.querySelectorAll(".shader-btn").forEach(l=>{l.addEventListener("click",()=>{this.setPolygonContent("shader",l.dataset.shader)})});const c=u("videoFileInput");c&&c.addEventListener("change",l=>this.handleVideoUpload(l));const d=u("imageFileInput");d&&d.addEventListener("change",l=>this.handleImageUpload(l));const v=u("performanceOverlay");v&&(v.addEventListener("click",()=>{this.editMode||this.togglePerformanceMode()}),v.addEventListener("touchstart",l=>{this.editMode||(l.preventDefault(),this.togglePerformanceMode())},{passive:!1}));const h=u("vertexControls");if(h){const l=h.querySelector(".control-drag-handle");l&&(l.addEventListener("mousedown",m=>this.startControlsDrag(m)),l.addEventListener("touchstart",m=>this.startControlsDrag(m),{passive:!1}))}document.addEventListener("mousemove",l=>this.moveControls(l)),document.addEventListener("touchmove",l=>this.moveControls(l),{passive:!1}),document.addEventListener("mouseup",()=>this.stopControlsDrag()),document.addEventListener("touchend",()=>this.stopControlsDrag()),e("newProjectBtn",()=>this.startNewProject()),e("loadProjectFileBtn",()=>this.loadProjectFromFile()),e("continueProjectBtn",()=>this.continueLastProject())}addPolygon(e){this.saveState(),this.polygons.push(e),this.selectPolygon(e),this.setTool("select"),this.renderLayersList()}handleBrushStroke(e,i,t){const o=this.selectedPolygon;if(!o||o.type!=="drawing"||!o.drawingCtx)return;const s=o.getBoundingBox(),r=this.canvas.getBoundingClientRect(),a=(e-r.left)/r.width,c=(i-r.top)/r.height,d=(a-s.minX)/s.width,v=(c-s.minY)/s.height;if(d<0||d>1||v<0||v>1){this.lastBrushPos=null;return}const h=o.drawingCtx,l=o.drawingCanvas.width,m=o.drawingCanvas.height,f=d*l,x=v*m,E=u("brushSizeSlider"),T=u("brushOpacitySlider"),_=u("brushColorPicker"),p=u("eraserToggle"),y=E?parseInt(E.value):5,P=T?parseFloat(T.value):1,G=_?_.value:"#fff",B=p?p.checked:!1;h.lineJoin="round",h.lineCap="round",h.lineWidth=y,B?(h.globalCompositeOperation="destination-out",h.strokeStyle=`rgba(0,0,0,${P})`):(h.globalCompositeOperation="source-over",h.strokeStyle=G,h.globalAlpha=P,h.lineWidth=y),t||!this.lastBrushPos?(h.beginPath(),h.moveTo(f,x),h.lineTo(f,x),h.stroke()):(h.beginPath(),h.moveTo(this.lastBrushPos.x,this.lastBrushPos.y),h.lineTo(f,x),h.stroke()),h.globalCompositeOperation="source-over",h.globalAlpha=1,this.lastBrushPos={x:f,y:x},o.isDirty=!0}handlePointerDown(e,i){const t=this.getNormalizedCoords(e,i);if(this.currentTool==="brush"){this.selectedPolygon&&this.selectedPolygon.type==="drawing"&&(this.isDrawing=!0,this.handleBrushStroke(e,i,!0));return}if(this.currentTool==="triangle"){const o=I.createTriangle(t.x,t.y);this.addPolygon(o)}else if(this.currentTool==="square"){const o=I.createSquare(t.x,t.y);this.addPolygon(o)}else if(this.currentTool==="circle"){const o=I.createCircle(t.x,t.y);this.addPolygon(o)}else if(this.currentTool==="draw"){if(this.drawingVertices.length>=3){const o=this.drawingVertices[0];if(Math.sqrt((t.x-o.x)**2+(t.y-o.y)**2)<.05){this.finishDrawing();return}}this.drawingVertices.push({x:t.x,y:t.y}),this.isPlacingPoint=!0,this.isDrawing=!0}else if(this.currentTool==="select"){let o=!1;const s=[];this.polygons.forEach(r=>{s.push(r),r.children&&s.push(...r.children)});for(let r=s.length-1;r>=0;r--){const a=s[r],c=a.getVertexAtPoint(t.x,t.y);if(c){this.selectPolygon(a),this.selectedVertex=c,this.isDraggingVertex=!0,this.updateVertexControls(!0),o=!0;break}}if(!o){for(let r=s.length-1;r>=0;r--){const a=s[r];if(a.containsPoint(t.x,t.y)){this.selectPolygon(a),this.selectedVertex=null,this.updateVertexControls(!1),this.dragStart=t,o=!0;break}}o||(this.selectPolygon(null),this.selectedVertex=null,this.updateVertexControls(!1))}}this.renderLayersList()}handlePointerMove(e,i){if(this.currentTool==="brush"&&this.isDrawing){this.handleBrushStroke(e,i,!1);return}const t=this.getNormalizedCoords(e,i);if(this.currentTool==="draw"&&this.isPlacingPoint&&this.drawingVertices.length>0){this.drawingVertices[this.drawingVertices.length-1]={x:t.x,y:t.y};return}if(this.isDraggingVertex&&this.selectedPolygon&&this.selectedVertex)this.selectedPolygon.moveVertex(this.selectedVertex,t.x,t.y);else if(this.selectedPolygon&&this.dragStart){const o=t.x-this.dragStart.x,s=t.y-this.dragStart.y;this.selectedPolygon.translate(o,s),this.dragStart=t}}handlePointerUp(){(this.isDraggingVertex||this.dragStart&&this.selectedPolygon)&&this.saveState(),this.isDraggingVertex=!1,this.currentTool==="draw"&&(this.isPlacingPoint=!1),this.currentTool==="brush"&&(this.isDrawing=!1,this.lastBrushPos=null),this.dragStart&&(this.dragStart=null)}finishDrawing(){if(this.drawingVertices.length>=3){const i=new M(this.drawingVertices);this.addPolygon(i)}this.drawingVertices=[],this.isDrawing=!1,this.setTool("select");const e=u("leftSidebar");e&&window.innerWidth<768&&e.classList.remove("hidden")}selectPolygon(e){this.polygons.forEach(t=>{t.selected=!1,t.children&&t.children.forEach(o=>o.selected=!1)}),this.selectedPolygon=e;const i=u("rightSidebar");e?(e.selected=!0,i&&i.classList.remove("hidden"),this.updatePropertiesPanel(e),e.type!=="drawing"&&this.currentTool==="brush"&&this.setTool("select")):i&&i.classList.add("hidden"),this.renderLayersList()}updatePropertiesPanel(e){const i=u("currentContentInfo");i&&(e.contentType==="video"?i.textContent="Video":e.contentType==="image"?i.textContent="Image":i.textContent=`Shader: ${e.shaderType}`);const t=u("warpToggle");t&&(t.checked=e.warpMode);const o=u("warpSettings");if(e.warpMode){o&&o.classList.remove("hidden");const l=u("gridSizeSlider");l&&(l.value=e.gridSize.toString());const m=u("gridSizeVal");m&&(m.textContent=e.gridSize.toString());const f=u("gridSizeVal2");f&&(f.textContent=e.gridSize.toString())}else o&&o.classList.add("hidden");const s=u("audioEnabledToggle");s&&(s.checked=e.audioSettings.enabled);const r=u("audioGainSlider");r&&(r.value=e.audioSettings.gain.toString());const a=u("audioBassSlider");a&&(a.value=e.audioSettings.bassScale.toString());const c=u("audioMidSlider");c&&(c.value=e.audioSettings.midScale.toString());const d=u("audioHighSlider");d&&(d.value=e.audioSettings.highScale.toString());const v=u("canvasMaskControl"),h=u("brushControls");if(e.type==="drawing"){v&&v.classList.remove("hidden");const l=u("useAsMaskToggle");l&&(l.checked=e.useAsMask),this.currentTool==="brush"?h&&h.classList.remove("hidden"):h&&h.classList.add("hidden")}else v&&v.classList.add("hidden"),h&&h.classList.add("hidden");this.renderEffectsList(e)}addEffect(e){if(!this.selectedPolygon)return;if(this.selectedPolygon.effects.find(t=>t.type===e)){this.showStatus(`${e} effect already added`);return}this.saveState(),this.selectedPolygon.addEffect(e),this.updatePropertiesPanel(this.selectedPolygon)}removeEffect(e){this.selectedPolygon&&(this.saveState(),this.selectedPolygon.removeEffect(e),this.updatePropertiesPanel(this.selectedPolygon))}renderEffectsList(e){const i=u("effectsListContainer");if(i){if(i.innerHTML="",!e.effects||e.effects.length===0){i.innerHTML="<div style='opacity:0.5; font-size:12px; padding:8px;'>No effects added</div>";return}e.effects.forEach(t=>{const o=document.createElement("div");o.className="effect-item";let s="";const r=t.params;if(["brightness","contrast","saturation","hue"].includes(t.type)){const d=t.type==="brightness"?-1:0,v=t.type==="brightness"?1:2,h=t.type==="hue"?.01:.1;s=`
                <div class="control-group">
                    <label>Value: <span id="val-${t.id}">${r.value.toFixed(2)}</span></label>
                    <input type="range" min="${d}" max="${v}" step="${h}" value="${r.value}" 
                           data-effect-id="${t.id}" data-param="value">
                </div>
            `}else if(["scanlines","dots","grid"].includes(t.type))s=`
                <div class="control-group">
                    <label>Scale</label>
                    <input type="range" min="1" max="100" value="${r.scale}"
                           data-effect-id="${t.id}" data-param="scale">
                </div>
                <div class="control-group">
                    <label>Intensity</label>
                    <input type="range" min="0" max="1" step="0.1" value="${r.intensity}"
                           data-effect-id="${t.id}" data-param="intensity">
                </div>
                <div class="control-group">
                    <label>Anim Speed</label>
                    <input type="range" min="0" max="5" step="0.1" value="${r.speed!==void 0?r.speed:1}"
                           data-effect-id="${t.id}" data-param="speed">
                </div>
            `;else if(t.type==="border"){const d=t.params.color?ae(t.params.color.r,t.params.color.g,t.params.color.b):"#ffffff";s=`
                <div class="control-group">
                    <label>Width</label>
                    <input type="range" min="0.01" max="0.2" step="0.01" value="${r.width}"
                           data-effect-id="${t.id}" data-param="width">
                </div>
                <div class="control-group">
                    <label>Color</label>
                    <input type="color" value="${d}"
                           data-effect-id="${t.id}" data-param="color">
                </div>
                <div class="control-group">
                    <label>Pulse Speed</label>
                    <input type="range" min="0" max="10" step="0.1" value="${r.speed!==void 0?r.speed:0}"
                           data-effect-id="${t.id}" data-param="speed">
                </div>
            `}else if(t.type==="edge_detection"){const d=t.params.color?ae(t.params.color.r,t.params.color.g,t.params.color.b):"#ffffff";s=`
            <div class="control-group">
                <label>Threshold</label>
                <input type="range" min="0.01" max="1.0" step="0.01" value="${r.threshold}"
                        data-effect-id="${t.id}" data-param="threshold">
            </div>
            <div class="control-group">
                <label>Edge Color</label>
                <input type="color" value="${d}"
                        data-effect-id="${t.id}" data-param="color">
            </div>
            <div class="control-group">
                <label>Animation</label>
                <select data-effect-id="${t.id}" data-param="mode" class="dropdown" style="width:100%; margin-top:4px; background: #333; color: white; border: 1px solid #555;">
                    <option value="0" ${r.mode==0?"selected":""}>Static</option>
                    <option value="1" ${r.mode==1?"selected":""}>Pulse (Time)</option>
                    <option value="2" ${r.mode==2?"selected":""}>Audio Reactive</option>
                </select>
            </div>
            <div class="control-group">
                <label>Speed</label>
                <input type="range" min="0" max="10" step="0.1" value="${r.speed!==void 0?r.speed:1}"
                        data-effect-id="${t.id}" data-param="speed">
            </div>
        `}o.innerHTML=`
            <div class="effect-header">
                <span>${t.type.toUpperCase()}</span>
                <button class="effect-remove" data-effect-id="${t.id}">✕</button>
            </div>
            ${s}
        `;const a=o.querySelector(".effect-remove");a&&a.addEventListener("click",d=>{const v=d.target;this.removeEffect(v.dataset.effectId)}),o.querySelectorAll("input, select").forEach(d=>{d.addEventListener("change",v=>{const h=v.target,l=h.dataset.param,m=h.dataset.effectId;let f;h.type==="checkbox"?f=h.checked:h.type==="color"?f=ne(h.value):h.tagName==="SELECT"?f=parseInt(h.value):f=parseFloat(h.value);const x={};x[l]=f,this.updateEffectParam(m,x,!0)}),d.addEventListener("input",v=>{const h=v.target,l=h.dataset.param,m=h.dataset.effectId;let f;h.type==="checkbox"?f=h.checked:h.type==="color"?f=ne(h.value):h.tagName==="SELECT"?f=parseInt(h.value):f=parseFloat(h.value);const x={};x[l]=f,this.updateEffectParam(m,x,!1)})}),i.appendChild(o)})}}updateEffectParam(e,i,t=!1){if(this.selectedPolygon){t&&this.saveState(),this.selectedPolygon.updateEffect(e,i);const o=u(`val-${e}`);o&&i.value!==void 0&&(o.textContent=i.value.toFixed(2))}}showStatus(e){const i=u("statusMsg");i&&(i.textContent=e,i.classList.remove("hidden"),setTimeout(()=>{i.classList.add("hidden")},2e3))}loadProjectDialog(){this.loadProjectFromFile()}startControlsDrag(e){e.preventDefault(),e.stopPropagation();const i=u("vertexControls");if(!i)return;const t=i.getBoundingClientRect(),o=e.touches?e.touches[0].clientX:e.clientX,s=e.touches?e.touches[0].clientY:e.clientY;this.controlsDragStart={x:o-t.left,y:s-t.top}}moveControls(e){if(!this.controlsDragStart)return;e.preventDefault();const i=e.touches?e.touches[0].clientX:e.clientX,t=e.touches?e.touches[0].clientY:e.clientY,o=u("vertexControls");if(!o)return;const s=i-this.controlsDragStart.x,r=t-this.controlsDragStart.y,a=window.innerWidth-o.offsetWidth,c=window.innerHeight-o.offsetHeight;this.controlsPosition.x=Math.max(0,Math.min(s,a)),this.controlsPosition.y=Math.max(0,Math.min(r,c)),o.style.left=this.controlsPosition.x+"px",o.style.top=this.controlsPosition.y+"px",o.style.right="auto",o.style.bottom="auto",o.style.transform="none"}stopControlsDrag(){this.controlsDragStart=null}setTool(e){this.currentTool=e,this.isDrawing=!1,this.drawingVertices=[],document.querySelectorAll(".tool-btn").forEach(t=>t.classList.remove("active"));const i=t=>{const o=u(t);o&&o.classList.add("active")};if(e==="select")i("selectBtn");else if(e==="brush"){if(i("brushBtn"),this.selectedPolygon&&this.selectedPolygon.type==="drawing"){const t=u("brushControls");t&&t.classList.remove("hidden")}}else if(e==="triangle"?i("addTriangleBtn"):e==="square"?i("addSquareBtn"):e==="circle"?i("addCircleBtn"):e==="draw"&&i("drawPolygonBtn"),window.innerWidth<768){const t=u("leftSidebar"),o=u("rightSidebar");t&&t.classList.add("hidden"),o&&o.classList.add("hidden")}if(e!=="brush"){const t=u("brushControls");t&&t.classList.add("hidden")}}getNormalizedCoords(e,i){const t=this.canvas.getBoundingClientRect();return{x:(e-t.left)/t.width,y:(i-t.top)/t.height}}handleTouchStart(e){if(e.preventDefault(),e.touches.length===1){const i=e.touches[0];this.handlePointerDown(i.clientX,i.clientY)}}handleTouchMove(e){if(e.preventDefault(),e.touches.length===1){const i=e.touches[0];this.handlePointerMove(i.clientX,i.clientY)}}handleTouchEnd(e){e.preventDefault(),this.handlePointerUp()}handleMouseDown(e){this.handlePointerDown(e.clientX,e.clientY)}handleMouseMove(e){this.handlePointerMove(e.clientX,e.clientY)}handleMouseUp(e){this.handlePointerUp()}toggleWarpMode(e){this.selectedPolygon&&(e!==this.selectedPolygon.warpMode&&(this.saveState(),this.selectedPolygon.toggleWarpMode()),this.selectedVertex=null,this.updateVertexControls(!1),this.updatePropertiesPanel(this.selectedPolygon))}updateVertexControls(e){const i=u("vertexControls");i&&(e&&this.selectedVertex?i.classList.remove("hidden"):i.classList.add("hidden"))}finetuneVertex(e){if(!this.selectedPolygon||!this.selectedVertex)return;const i=this.selectedPolygon,t=this.selectedVertex,o=1/this.canvas.width;let s=null;t.type==="grid"?s=i.gridVertices[t.index]:t.type==="vertex"?s=i.vertices[t.index]:t.type==="c1"?s=i.vertices[t.index].c1:t.type==="c2"&&(s=i.vertices[t.index].c2),s&&(e==="up"&&(s.y-=o),e==="down"&&(s.y+=o),e==="left"&&(s.x-=o),e==="right"&&(s.x+=o))}toggleVertexCurve(){if(!this.selectedPolygon||!this.selectedVertex||this.selectedVertex.type!=="vertex")return;const e=this.selectedPolygon,i=this.selectedVertex.index,t=e.vertices[i];if(t.bezier=!t.bezier,t.bezier&&(!t.c1||!t.c2)){const o=(i-1+e.vertices.length)%e.vertices.length,s=(i+1)%e.vertices.length,r=e.vertices[o],a=e.vertices[s],c=t.x-r.x,d=t.y-r.y;t.c1={x:t.x-c*.2,y:t.y-d*.2};const v=a.x-t.x,h=a.y-t.y;t.c2={x:t.x+v*.2,y:t.y+h*.2}}}deleteSelected(){if(this.selectedPolygon){this.saveState();const e=this.polygons.indexOf(this.selectedPolygon);if(e>=0)this.polygons.splice(e,1),this.selectPolygon(null);else for(const i of this.polygons){const t=i.children.indexOf(this.selectedPolygon);if(t>=0){i.children.splice(t,1),this.selectedPolygon.parent=null,this.selectPolygon(null);break}}}this.renderLayersList()}toggleAudio(){var e,i;this.audioManager.isActive?(this.audioManager.stop(),this.showStatus("Audio Input Disabled"),(e=u("audioToggleBtn"))==null||e.classList.remove("active")):(this.audioManager.start(),this.showStatus("Audio Input Enabled"),(i=u("audioToggleBtn"))==null||i.classList.add("active"))}showContentModal(){if(!this.selectedPolygon){this.showStatus("Please select a polygon first");return}const e=u("contentModal");e&&e.classList.remove("hidden")}showShaderModal(){const e=u("contentModal"),i=u("shaderModal");e&&e.classList.add("hidden"),i&&i.classList.remove("hidden")}showVideoModal(){const e=u("contentModal"),i=u("videoModal");e&&e.classList.add("hidden"),i&&(i.classList.remove("hidden"),this.updateVideoList())}showImageModal(){const e=u("contentModal"),i=u("imageModal");e&&e.classList.add("hidden"),i&&(i.classList.remove("hidden"),this.updateImageList())}hideAllModals(){document.querySelectorAll(".modal").forEach(e=>e.classList.add("hidden"))}setPolygonContent(e,i){this.selectedPolygon&&(this.saveState(),this.selectedPolygon.setContent(e,i),this.hideAllModals(),this.showStatus(`Content updated: ${e}`),this.updatePropertiesPanel(this.selectedPolygon))}handleVideoUpload(e){const i=e.target.files[0];if(i){const t=URL.createObjectURL(i);this.loadedVideos.set(i.name,t),this.updateVideoList(),e.target.value=""}}handleImageUpload(e){const i=e.target.files[0];if(i){const t=URL.createObjectURL(i);this.loadedImages.set(i.name,t),this.updateImageList(),e.target.value=""}}updateVideoList(){const e=u("videoList");e&&(e.innerHTML="",this.loadedVideos.forEach((i,t)=>{const o=document.createElement("button");o.className="content-type-btn",o.textContent=t,o.addEventListener("click",()=>{this.setPolygonContent("video",i)}),e.appendChild(o)}))}updateImageList(){const e=u("imageList");e&&(e.innerHTML="",this.loadedImages.forEach((i,t)=>{const o=document.createElement("button");o.className="content-type-btn",o.textContent=t,o.addEventListener("click",()=>{this.setPolygonContent("image",i)}),e.appendChild(o)}))}togglePerformanceMode(){this.editMode=!this.editMode;const e=u("uiContainer"),i=u("toggleSidebarBtn"),t=u("toggleRightSidebarBtn"),o=u("vertexControls"),s=u("statusMsg"),r=u("leftSidebar"),a=u("rightSidebar");this.editMode?(e&&e.classList.remove("hidden"),i&&(i.style.display="flex"),t&&t.classList.remove("hidden")):(e&&e.classList.add("hidden"),i&&(i.style.display="none"),t&&t.classList.add("hidden"),o&&o.classList.add("hidden"),s&&s.classList.add("hidden"),r&&r.classList.add("hidden"),a&&a.classList.add("hidden"));const c=u("performanceOverlay");c&&c.classList.toggle("hidden",this.editMode),this.overlayCanvas.style.display=this.editMode?"block":"none"}toggleFullscreen(){const e=document,i=document.documentElement,t=i.requestFullscreen||i.webkitRequestFullscreen||i.mozRequestFullScreen||i.msRequestFullscreen,o=e.exitFullscreen||e.webkitExitFullscreen||e.mozCancelFullScreen||e.msExitFullscreen;!e.fullscreenElement&&!e.webkitFullscreenElement&&!e.mozFullScreenElement&&!e.msFullscreenElement?t?t.call(i).catch(s=>{console.error("Fullscreen error:",s),this.showStatus("Fullscreen blocked or not supported")}):this.showStatus("Tap Share (box+arrow) > 'Add to Home Screen' for App Mode"):o&&o.call(e)}showWelcomeModal(){const e=u("welcomeModal");if(!e)return;const i=u("continueProjectBtn");if(i){const t=K.getItem("mobileMapperProject")!==null;i.disabled=!t}e.classList.remove("hidden")}startNewProject(){this.polygons=[],this.loadedVideos.clear(),this.selectedPolygon=null,this.selectedVertex=null,K.removeItem("mobileMapperProject");const e=u("welcomeModal");e&&e.classList.add("hidden"),this.showStatus("New project started"),this.selectPolygon(null)}continueLastProject(){this.loadProjectFromLocalStorage();const e=u("welcomeModal");e&&e.classList.add("hidden"),this.showStatus("Project loaded from last session")}loadProjectFromFile(){const e=document.createElement("input");e.type="file",e.accept=".json",e.onchange=i=>{const t=i.target.files[0];if(!t)return;const o=new FileReader;o.onload=s=>{try{const r=JSON.parse(s.target.result);this.loadProjectData(r);const a=u("welcomeModal");a&&a.classList.add("hidden"),this.showStatus("Project loaded from file!")}catch(r){this.showStatus("Failed to load project file"),console.error(r)}},o.readAsText(t)},e.click()}saveProject(){const e=`projection-mapping-${new Date().toISOString().split("T")[0]}`;let i=prompt("Enter project name:",e);if(i===null)return;i=i.trim()||e,i.endsWith(".json")||(i+=".json");const t={polygons:this.polygons.map(a=>a.toJSON()),videos:Array.from(this.loadedVideos.entries()),version:"1.0",name:i.replace(".json","")};K.setItem("mobileMapperProject",JSON.stringify(t));const o=new Blob([JSON.stringify(t,null,2)],{type:"application/json"}),s=URL.createObjectURL(o),r=document.createElement("a");r.href=s,r.download=i,r.click(),URL.revokeObjectURL(s),this.showStatus(`Project "${i}" saved!`)}loadProjectFromLocalStorage(){const e=K.getItem("mobileMapperProject");if(e)try{const i=JSON.parse(e);this.loadProjectData(i)}catch(i){console.error("Failed to load project:",i)}}loadProjectData(e){this.polygons=e.polygons.map(i=>M.fromJSON(i)),this.polygons.forEach(i=>{i.children&&i.children.forEach(t=>t.parent=i)}),e.videos&&(this.loadedVideos=new Map(e.videos),this.polygons.forEach(i=>{const t=o=>{o.contentType==="video"&&(o.videoSrc&&this.loadedVideos.has(o.videoSrc),o.loadVideo()),o.children&&o.children.forEach(t)};t(i)})),this.renderLayersList()}animate(){this.resizeOverlay(),this.audioManager.isActive?this.renderer.updateAudioData(this.audioManager.getAudioData()):this.renderer.updateAudioData({low:0,mid:0,high:0,level:0}),this.renderer.render(this.polygons,this.editMode),this.overlayCtx.clearRect(0,0,this.overlayCanvas.width,this.overlayCanvas.height);const e=this.overlayCanvas.width,i=this.overlayCanvas.height;if(this.editMode){const t=o=>{o.forEach(s=>{if(s.children&&t(s.children),s.selected,s.selected)if(s.getRenderVertices(),s.warpMode&&s.gridVertices.length>0){const r=s.gridSize;this.overlayCtx.strokeStyle="#ffff00",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath();for(let a=0;a<r;a++)for(let c=0;c<r-1;c++){const d=s.gridVertices[a*r+c],v=s.gridVertices[a*r+c+1];this.overlayCtx.moveTo(d.x*e,d.y*i),this.overlayCtx.lineTo(v.x*e,v.y*i)}for(let a=0;a<r;a++)for(let c=0;c<r-1;c++){const d=s.gridVertices[c*r+a],v=s.gridVertices[(c+1)*r+a];this.overlayCtx.moveTo(d.x*e,d.y*i),this.overlayCtx.lineTo(v.x*e,v.y*i)}this.overlayCtx.stroke(),s.gridVertices.forEach((a,c)=>{const d=a.x*e,v=a.y*i,h=this.selectedVertex&&this.selectedVertex.type==="grid"&&this.selectedVertex.index===c;this.overlayCtx.fillStyle=h?"#00ffff":"#ffff00",this.overlayCtx.beginPath(),this.overlayCtx.arc(d,v,h?8:4,0,Math.PI*2),this.overlayCtx.fill(),this.overlayCtx.stroke()})}else{const r=s.getDiscretizedVertices(30);this.overlayCtx.strokeStyle="#00ff00",this.overlayCtx.lineWidth=3,this.overlayCtx.beginPath(),r.forEach((a,c)=>{const d=a.x*e,v=a.y*i;c===0?this.overlayCtx.moveTo(d,v):this.overlayCtx.lineTo(d,v)}),this.overlayCtx.closePath(),this.overlayCtx.stroke(),s.vertices.forEach((a,c)=>{const d=a.x*e,v=a.y*i,h=this.selectedVertex&&this.selectedVertex.type==="vertex"&&this.selectedVertex.index===c;if(this.overlayCtx.fillStyle=h?"#00ffff":"#00ff00",this.overlayCtx.beginPath(),this.overlayCtx.arc(d,v,h?8:6,0,Math.PI*2),this.overlayCtx.fill(),this.overlayCtx.stroke(),a.bezier){if(a.c1){const l=a.c1.x*e,m=a.c1.y*i;this.overlayCtx.strokeStyle="rgba(255,255,255,0.5)",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath(),this.overlayCtx.moveTo(d,v),this.overlayCtx.lineTo(l,m),this.overlayCtx.stroke();const f=this.selectedVertex&&this.selectedVertex.type==="c1"&&this.selectedVertex.index===c;this.overlayCtx.fillStyle=f?"#ff00ff":"#ffffff",this.overlayCtx.beginPath(),this.overlayCtx.arc(l,m,4,0,Math.PI*2),this.overlayCtx.fill()}if(a.c2){const l=a.c2.x*e,m=a.c2.y*i;this.overlayCtx.strokeStyle="rgba(255,255,255,0.5)",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath(),this.overlayCtx.moveTo(d,v),this.overlayCtx.lineTo(l,m),this.overlayCtx.stroke();const f=this.selectedVertex&&this.selectedVertex.type==="c2"&&this.selectedVertex.index===c;this.overlayCtx.fillStyle=f?"#ff00ff":"#ffffff",this.overlayCtx.beginPath(),this.overlayCtx.arc(l,m,4,0,Math.PI*2),this.overlayCtx.fill()}}})}else{const r=s.getDiscretizedVertices(20);this.overlayCtx.strokeStyle="rgba(0, 255, 0, 0.3)",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath(),r.forEach((a,c)=>{const d=a.x*e,v=a.y*i;c===0?this.overlayCtx.moveTo(d,v):this.overlayCtx.lineTo(d,v)}),this.overlayCtx.closePath(),this.overlayCtx.stroke()}})};t(this.polygons)}this.isDrawing&&this.drawingVertices.length>0&&(this.overlayCtx.strokeStyle="#ffff00",this.overlayCtx.lineWidth=2,this.overlayCtx.beginPath(),this.drawingVertices.forEach((t,o)=>{const s=t.x*e,r=t.y*i;o===0?this.overlayCtx.moveTo(s,r):this.overlayCtx.lineTo(s,r)}),this.overlayCtx.stroke(),this.drawingVertices.forEach((t,o)=>{const s=t.x*e,r=t.y*i;o===0?(this.overlayCtx.fillStyle="#ff0000",this.overlayCtx.beginPath(),this.overlayCtx.arc(s,r,8,0,Math.PI*2),this.overlayCtx.fill(),this.overlayCtx.strokeStyle="#ffffff",this.overlayCtx.lineWidth=2,this.overlayCtx.stroke()):(this.overlayCtx.fillStyle="#ffff00",this.overlayCtx.beginPath(),this.overlayCtx.arc(s,r,4,0,Math.PI*2),this.overlayCtx.fill())})),requestAnimationFrame(()=>this.animate())}handleDragStart(e,i){this.dragTimeout=setTimeout(()=>{this.draggingLayer=i,this.dragStartY=e.clientY,this.dragGhost=document.createElement("div"),this.dragGhost.className="layer-drag-ghost";const t=i.id?i.id.toString():"0000";this.dragGhost.textContent=`Moving: ${i.type} ${t.slice(-4)}`,document.body.appendChild(this.dragGhost),this.updateDragGhost(e.clientY),this.showStatus("Dragging Layer...")},300)}handleDragMove(e){if(this.dragTimeout&&!this.draggingLayer&&Math.abs(e.clientY-this.dragStartY)>10&&(clearTimeout(this.dragTimeout),this.dragTimeout=null),this.draggingLayer&&this.dragGhost){e.preventDefault(),this.updateDragGhost(e.clientY),document.querySelectorAll(".layer-item").forEach(s=>s.classList.remove("drag-over","drag-over-top","drag-over-bottom"));let t=null;if(t=document.elementsFromPoint(e.clientX,e.clientY).find(s=>s.classList.contains("layer-item"))||null,t){const s=t.getBoundingClientRect(),r=e.clientY-s.top;r<s.height*.25?t.classList.add("drag-over-top"):r>s.height*.75?t.classList.add("drag-over-bottom"):t.classList.add("drag-over")}}}handleDragEnd(e){if(this.dragTimeout&&clearTimeout(this.dragTimeout),this.draggingLayer){const t=document.elementsFromPoint(e.clientX,e.clientY).find(o=>o.classList.contains("layer-item"));if(t){const o=parseFloat(t.getAttribute("data-id")||"-1");this.performLayerDrop(o,e.clientY,t.getBoundingClientRect())}this.draggingLayer=null,this.dragGhost&&(this.dragGhost.remove(),this.dragGhost=null),document.querySelectorAll(".layer-item").forEach(o=>o.classList.remove("drag-over","drag-over-top","drag-over-bottom"))}}updateDragGhost(e){this.dragGhost&&(this.dragGhost.style.top=`${e}px`,this.dragGhost.style.left="60px")}performLayerDrop(e,i,t){if(e===-1||!this.draggingLayer||e===this.draggingLayer.id)return;this.saveState();const o=this.findPolygonById(e);if(!o)return;this.removePolygonFromTree(this.draggingLayer);const s=i-t.top,r=t.height;if(s>r*.25&&s<r*.75)o.children.push(this.draggingLayer),this.draggingLayer.parent=o;else{this.draggingLayer.parent=null;let a=this.polygons;o.parent&&(a=o.parent.children,this.draggingLayer.parent=o.parent);const c=a.indexOf(o);s<=r*.25?a.splice(c+1,0,this.draggingLayer):a.splice(c,0,this.draggingLayer)}this.renderLayersList()}findPolygonById(e){const i=[...this.polygons];for(;i.length>0;){const t=i.shift();if(t.id===e)return t;t.children&&i.push(...t.children)}return null}removePolygonFromTree(e){if(e.parent){const i=e.parent.children.indexOf(e);i>=0&&e.parent.children.splice(i,1)}else{const i=this.polygons.indexOf(e);i>=0&&this.polygons.splice(i,1)}}renderLayersList(){const e=u("layersListContainer");if(!e)return;if(e.innerHTML="",this.polygons.length===0){e.innerHTML='<div style="padding:8px; opacity:0.5; font-size:12px;">No shapes added</div>';return}const i=(t,o,s)=>{const r=document.createElement("div");r.className="layer-item",r.setAttribute("data-id",t.id.toString()),r.style.padding="8px",r.style.paddingLeft=`${8+s*20}px`,r.style.borderBottom="1px solid rgba(255,255,255,0.1)",r.style.cursor="pointer",r.style.backgroundColor=t.selected?"rgba(0,255,157,0.2)":"transparent",r.style.display="flex",r.style.justifyContent="space-between",r.style.alignItems="center",r.style.userSelect="none",r.style.touchAction="none";const c=s>0?"🎭 ":"",d=document.createElement("span"),v=t.id?t.id.toString():"0000",h=v.length>4?v.slice(-4):v;d.textContent=`${c}Shape ${h} (${t.type})`,d.style.fontSize="12px",r.appendChild(d),r.addEventListener("click",l=>{l.stopPropagation(),this.selectPolygon(t),this.setTool("select")}),r.addEventListener("pointerdown",l=>{l.isPrimary&&(r.setPointerCapture(l.pointerId),this.dragStartY=l.clientY,this.handleDragStart(l,t))}),r.addEventListener("pointermove",l=>{this.draggingLayer&&this.handleDragMove(l)}),r.addEventListener("pointerup",l=>{r.releasePointerCapture(l.pointerId),this.handleDragEnd(l)}),e.appendChild(r),t.children&&t.children.length>0&&[...t.children].reverse().forEach((l,m)=>i(l,m,s+1))};[...this.polygons].reverse().forEach((t,o)=>{i(t,o,0)})}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{window.app=new le}):window.app=new le;
