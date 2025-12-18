var ne=Object.defineProperty;var ae=(n,e,i)=>e in n?ne(n,e,{enumerable:!0,configurable:!0,writable:!0,value:i}):n[e]=i;var g=(n,e,i)=>ae(n,typeof e!="symbol"?e+"":e,i);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))t(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&t(r)}).observe(document,{childList:!0,subtree:!0});function i(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function t(s){if(s.ep)return;s.ep=!0;const o=i(s);fetch(s.href,o)}})();const le=`
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`,V=`
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
`,A=`
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
        // Use audio for pulse if connected? Maybe later.
        return u_borderColor * (0.5 + 0.5 * pulse);
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
`,B=`
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
`,Q=`
    precision mediump float;
    uniform sampler2D u_texture;
    uniform float u_time;
    varying vec2 v_texCoord;
    
    ${V}
    ${A}
    ${B}

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
        
        // For drawings (which use this shader), texColor.a is important.
        // For videos, it's usually 1.0.
        vec4 finalColor = vec4(color, texColor.a);
        gl_FragColor = applyMask(finalColor, uv);
    }
`,ee={rainbow:{name:"Rainbow",fragment:`
            precision mediump float;
            uniform float u_time;
            varying vec2 v_texCoord;
            
            ${V}
            ${A}
            
            vec3 custom_hsv2rgb(vec3 c) { 
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            ${B}

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

            ${V}
            ${A}
            ${B}

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

            ${V}
            ${A}
            ${B}

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

            ${V}
            ${A}
            ${B}

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

            ${V}
            ${A}
            ${B}

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

            ${V}
            ${A}
            ${B}

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

            ${V}
            ${A}
            ${B}

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
      `}};function ce(n,e,i=2){const t=n.length;let s=de(n,0,t,i,!0);const o=[];if(!s||s.next===s.prev)return o;let r,l,c;if(n.length>80*i){r=n[0],l=n[1];let d=r,f=l;for(let a=i;a<t;a+=i){const h=n[a],p=n[a+1];h<r&&(r=h),p<l&&(l=p),h>d&&(d=h),p>f&&(f=p)}c=Math.max(d-r,f-l),c=c!==0?32767/c:0}return O(s,o,i,r,l,c,0),o}function de(n,e,i,t,s){let o;if(s===we(n,e,i,t)>0)for(let r=e;r<i;r+=t)o=te(r/t|0,n[r],n[r+1],o);else for(let r=i-t;r>=e;r-=t)o=te(r/t|0,n[r],n[r+1],o);return o&&K(o,o.next)&&(N(o),o=o.next),o}function z(n,e){if(!n)return n;e||(e=n);let i=n,t;do if(t=!1,!i.steiner&&(K(i,i.next)||w(i.prev,i,i.next)===0)){if(N(i),i=e=i.prev,i===i.next)break;t=!0}else i=i.next;while(t||i!==e);return e}function O(n,e,i,t,s,o,r){if(!n)return;!r&&o&&ve(n,t,s,o);let l=n;for(;n.prev!==n.next;){const c=n.prev,d=n.next;if(o?ue(n,t,s,o):he(n)){e.push(c.i,n.i,d.i),N(n),n=d.next,l=d.next;continue}if(n=d,n===l){r?r===1?(n=fe(z(n),e),O(n,e,i,t,s,o,2)):r===2&&ge(n,e,i,t,s,o):O(z(n),e,i,t,s,o,1);break}}}function he(n){const e=n.prev,i=n,t=n.next;if(w(e,i,t)>=0)return!1;const s=e.x,o=i.x,r=t.x,l=e.y,c=i.y,d=t.y,f=Math.min(s,o,r),a=Math.min(l,c,d),h=Math.max(s,o,r),p=Math.max(l,c,d);let v=t.next;for(;v!==e;){if(v.x>=f&&v.x<=h&&v.y>=a&&v.y<=p&&I(s,l,o,c,r,d,v.x,v.y)&&w(v.prev,v,v.next)>=0)return!1;v=v.next}return!0}function ue(n,e,i,t){const s=n.prev,o=n,r=n.next;if(w(s,o,r)>=0)return!1;const l=s.x,c=o.x,d=r.x,f=s.y,a=o.y,h=r.y,p=Math.min(l,c,d),v=Math.min(f,a,h),S=Math.max(l,c,d),E=Math.max(f,a,h),T=Y(p,v,e,i,t),P=Y(S,E,e,i,t);let y=n.prevZ,m=n.nextZ;for(;y&&y.z>=T&&m&&m.z<=P;){if(y.x>=p&&y.x<=S&&y.y>=v&&y.y<=E&&y!==s&&y!==r&&I(l,f,c,a,d,h,y.x,y.y)&&w(y.prev,y,y.next)>=0||(y=y.prevZ,m.x>=p&&m.x<=S&&m.y>=v&&m.y<=E&&m!==s&&m!==r&&I(l,f,c,a,d,h,m.x,m.y)&&w(m.prev,m,m.next)>=0))return!1;m=m.nextZ}for(;y&&y.z>=T;){if(y.x>=p&&y.x<=S&&y.y>=v&&y.y<=E&&y!==s&&y!==r&&I(l,f,c,a,d,h,y.x,y.y)&&w(y.prev,y,y.next)>=0)return!1;y=y.prevZ}for(;m&&m.z<=P;){if(m.x>=p&&m.x<=S&&m.y>=v&&m.y<=E&&m!==s&&m!==r&&I(l,f,c,a,d,h,m.x,m.y)&&w(m.prev,m,m.next)>=0)return!1;m=m.nextZ}return!0}function fe(n,e){let i=n;do{const t=i.prev,s=i.next.next;!K(t,s)&&se(t,i,i.next,s)&&Z(t,s)&&Z(s,t)&&(e.push(t.i,i.i,s.i),N(i),N(i.next),i=n=s),i=i.next}while(i!==n);return z(i)}function ge(n,e,i,t,s,o){let r=n;do{let l=r.next.next;for(;l!==r.prev;){if(r.i!==l.i&&me(r,l)){let c=Ce(r,l);r=z(r,r.next),c=z(c,c.next),O(r,e,i,t,s,o,0),O(c,e,i,t,s,o,0);return}l=l.next}r=r.next}while(r!==n)}function ve(n,e,i,t){let s=n;do s.z===0&&(s.z=Y(s.x,s.y,e,i,t)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==n);s.prevZ.nextZ=null,s.prevZ=null,pe(s)}function pe(n){let e,i=1;do{let t=n,s;n=null;let o=null;for(e=0;t;){e++;let r=t,l=0;for(let d=0;d<i&&(l++,r=r.nextZ,!!r);d++);let c=i;for(;l>0||c>0&&r;)l!==0&&(c===0||!r||t.z<=r.z)?(s=t,t=t.nextZ,l--):(s=r,r=r.nextZ,c--),o?o.nextZ=s:n=s,s.prevZ=o,o=s;t=r}o.nextZ=null,i*=2}while(e>1);return n}function Y(n,e,i,t,s){return n=(n-i)*s|0,e=(e-t)*s|0,n=(n|n<<8)&16711935,n=(n|n<<4)&252645135,n=(n|n<<2)&858993459,n=(n|n<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,n|e<<1}function ye(n,e,i,t,s,o,r,l){return(s-r)*(e-l)>=(n-r)*(o-l)&&(n-r)*(t-l)>=(i-r)*(e-l)&&(i-r)*(o-l)>=(s-r)*(t-l)}function I(n,e,i,t,s,o,r,l){return!(n===r&&e===l)&&ye(n,e,i,t,s,o,r,l)}function me(n,e){return n.next.i!==e.i&&n.prev.i!==e.i&&!xe(n,e)&&(Z(n,e)&&Z(e,n)&&Se(n,e)&&(w(n.prev,n,e.prev)||w(n,e.prev,e))||K(n,e)&&w(n.prev,n,n.next)>0&&w(e.prev,e,e.next)>0)}function w(n,e,i){return(e.y-n.y)*(i.x-e.x)-(e.x-n.x)*(i.y-e.y)}function K(n,e){return n.x===e.x&&n.y===e.y}function se(n,e,i,t){const s=W(w(n,e,i)),o=W(w(n,e,t)),r=W(w(i,t,n)),l=W(w(i,t,e));return!!(s!==o&&r!==l||s===0&&H(n,i,e)||o===0&&H(n,t,e)||r===0&&H(i,n,t)||l===0&&H(i,e,t))}function H(n,e,i){return e.x<=Math.max(n.x,i.x)&&e.x>=Math.min(n.x,i.x)&&e.y<=Math.max(n.y,i.y)&&e.y>=Math.min(n.y,i.y)}function W(n){return n>0?1:n<0?-1:0}function xe(n,e){let i=n;do{if(i.i!==n.i&&i.next.i!==n.i&&i.i!==e.i&&i.next.i!==e.i&&se(i,i.next,n,e))return!0;i=i.next}while(i!==n);return!1}function Z(n,e){return w(n.prev,n,n.next)<0?w(n,e,n.next)>=0&&w(n,n.prev,e)>=0:w(n,e,n.prev)<0||w(n,n.next,e)<0}function Se(n,e){let i=n,t=!1;const s=(n.x+e.x)/2,o=(n.y+e.y)/2;do i.y>o!=i.next.y>o&&i.next.y!==i.y&&s<(i.next.x-i.x)*(o-i.y)/(i.next.y-i.y)+i.x&&(t=!t),i=i.next;while(i!==n);return t}function Ce(n,e){const i=J(n.i,n.x,n.y),t=J(e.i,e.x,e.y),s=n.next,o=e.prev;return n.next=e,e.prev=n,i.next=s,s.prev=i,t.next=i,i.prev=t,o.next=t,t.prev=o,t}function te(n,e,i,t){const s=J(n,e,i);return t?(s.next=t.next,s.prev=t,t.next.prev=s,t.next=s):(s.prev=s,s.next=s),s}function N(n){n.next.prev=n.prev,n.prev.next=n.next,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ)}function J(n,e,i){return{i:n,x:e,y:i,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function we(n,e,i,t){let s=0;for(let o=e,r=i-t;o<i;o+=t)s+=(n[r]-n[o])*(n[o+1]+n[r+1]),r=o;return s}class Ee{constructor(e){g(this,"canvas");g(this,"gl");g(this,"programCache");g(this,"shaderCache");g(this,"videoTextures");g(this,"startTime");g(this,"audioData");g(this,"maskFramebuffer");g(this,"maskTexture");this.canvas=e,this.gl=e.getContext("webgl",{alpha:!0,stencil:!0}),this.programCache=new Map,this.shaderCache=new Map,this.videoTextures=new Map,this.startTime=Date.now(),this.audioData={low:0,mid:0,high:0,level:0},this.maskFramebuffer=null,this.maskTexture=null,this.resize(),window.addEventListener("resize",()=>this.resize())}resize(){const e=this.canvas.clientWidth,i=this.canvas.clientHeight;(this.canvas.width!==e||this.canvas.height!==i)&&(this.canvas.width=e,this.canvas.height=i,this.gl.viewport(0,0,this.canvas.width,this.canvas.height),this.initMaskBuffer())}initMaskBuffer(){const e=this.gl,i=this.canvas.width,t=this.canvas.height;this.maskTexture&&e.deleteTexture(this.maskTexture),this.maskFramebuffer&&e.deleteFramebuffer(this.maskFramebuffer),this.maskTexture=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.maskTexture),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,i,t,0,e.RGBA,e.UNSIGNED_BYTE,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),this.maskFramebuffer=e.createFramebuffer(),e.bindFramebuffer(e.FRAMEBUFFER,this.maskFramebuffer),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.maskTexture,0),e.bindFramebuffer(e.FRAMEBUFFER,null)}updateAudioData(e){this.audioData=e}createShader(e,i,t){const s=e.createShader(i);return e.shaderSource(s,t),e.compileShader(s),e.getShaderParameter(s,e.COMPILE_STATUS)?s:(console.error("Shader compile error:",e.getShaderInfoLog(s)),e.deleteShader(s),null)}createProgram(e,i,t){const s=this.createShader(e,e.VERTEX_SHADER,i),o=this.createShader(e,e.FRAGMENT_SHADER,t),r=e.createProgram();return e.attachShader(r,s),e.attachShader(r,o),e.linkProgram(r),e.getProgramParameter(r,e.LINK_STATUS)?r:(console.error("Program link error:",e.getProgramInfoLog(r)),null)}getProgramInfo(e,i){if(this.shaderCache.has(e))return this.shaderCache.get(e);const t=this.gl,s=this.createProgram(t,le,i);if(!s)return null;const o={program:s,attribLocations:{position:t.getAttribLocation(s,"a_position"),texCoord:t.getAttribLocation(s,"a_texCoord")},uniformLocations:{resolution:t.getUniformLocation(s,"u_resolution"),time:t.getUniformLocation(s,"u_time"),texture:t.getUniformLocation(s,"u_texture"),brightness:t.getUniformLocation(s,"u_brightness"),contrast:t.getUniformLocation(s,"u_contrast"),saturation:t.getUniformLocation(s,"u_saturation"),hue:t.getUniformLocation(s,"u_hue"),patternMode:t.getUniformLocation(s,"u_patternMode"),patternScale:t.getUniformLocation(s,"u_patternScale"),patternIntensity:t.getUniformLocation(s,"u_patternIntensity"),patternSpeed:t.getUniformLocation(s,"u_patternSpeed"),enableBorder:t.getUniformLocation(s,"u_enableBorder"),borderWidth:t.getUniformLocation(s,"u_borderWidth"),borderColor:t.getUniformLocation(s,"u_borderColor"),borderSpeed:t.getUniformLocation(s,"u_borderSpeed"),audioLow:t.getUniformLocation(s,"u_audioLow"),audioMid:t.getUniformLocation(s,"u_audioMid"),audioHigh:t.getUniformLocation(s,"u_audioHigh"),audioLevel:t.getUniformLocation(s,"u_audioLevel"),audioBassScale:t.getUniformLocation(s,"u_audioBassScale"),audioMidScale:t.getUniformLocation(s,"u_audioMidScale"),audioHighScale:t.getUniformLocation(s,"u_audioHighScale"),audioGain:t.getUniformLocation(s,"u_audioGain"),useMask:t.getUniformLocation(s,"u_useMask"),maskTexture:t.getUniformLocation(s,"u_maskTexture")}};return this.shaderCache.set(e,o),o}renderPolygon(e,i=!1){const t=this.gl;let s;if(i&&e.useAsMask&&!e.drawingCanvas)return;if(e.contentType==="video"||e.contentType==="drawing")s=this.getProgramInfo("video",Q);else if(i)s=this.getProgramInfo("video",Q);else{const x=ee[e.shaderType]||ee.rainbow;s=this.getProgramInfo(e.shaderType,x.fragment)}if(!s)return;t.useProgram(s.program);const o=[],r=[];if(e.warpMode&&e.gridVertices.length>0){const x=e.gridSize;for(let C=0;C<x-1;C++)for(let b=0;b<x-1;b++){const k=C*x+b,U=C*x+b+1,L=(C+1)*x+b,R=(C+1)*x+b+1;this.addTriangleToBuffers(o,r,e.gridVertices,k,U,L,x,b,C,0),this.addTriangleToBuffers(o,r,e.gridVertices,U,R,L,x,b,C,1)}}else{const x=e.getDiscretizedVertices(20),C=[];x.forEach(L=>C.push(L.x,L.y));const b=ce(C),k=e.getBoundingBox(),U=(L,R)=>[(L-k.minX)/k.width,(R-k.minY)/k.height];for(let L=0;L<b.length;L+=3){const R=b[L],oe=b[L+1],re=b[L+2],$=x[R],j=x[oe],G=x[re];o.push($.x*2-1,-($.y*2-1)),o.push(j.x*2-1,-(j.y*2-1)),o.push(G.x*2-1,-(G.y*2-1)),r.push(...U($.x,$.y)),r.push(...U(j.x,j.y)),r.push(...U(G.x,G.y))}}const l=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,l),t.bufferData(t.ARRAY_BUFFER,new Float32Array(o),t.STATIC_DRAW),t.enableVertexAttribArray(s.attribLocations.position),t.vertexAttribPointer(s.attribLocations.position,2,t.FLOAT,!1,0,0);const c=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,c),t.bufferData(t.ARRAY_BUFFER,new Float32Array(r),t.STATIC_DRAW),t.enableVertexAttribArray(s.attribLocations.texCoord),t.vertexAttribPointer(s.attribLocations.texCoord,2,t.FLOAT,!1,0,0);let d=0,f=1,a=1,h=0,p=0,v=10,S=0,E=1,T=0,P=0,y={r:1,g:1,b:1},m=0;i||e.effects.forEach(x=>{const C=x.params;x.type==="brightness"&&(d+=C.value),x.type==="contrast"&&(f*=C.value),x.type==="saturation"&&(a*=C.value),x.type==="hue"&&(h+=C.value),["scanlines","dots","grid"].includes(x.type)&&(p=x.type==="scanlines"?1:x.type==="dots"?2:3,v=C.scale,S=C.intensity,E=C.speed||1),x.type==="border"&&(T=1,P=C.width,C.color&&(y=C.color),m=C.speed||0)}),t.uniform1f(s.uniformLocations.brightness,d),t.uniform1f(s.uniformLocations.contrast,f),t.uniform1f(s.uniformLocations.saturation,a),t.uniform1f(s.uniformLocations.hue,h),t.uniform1i(s.uniformLocations.patternMode,p),t.uniform1f(s.uniformLocations.patternScale,v),t.uniform1f(s.uniformLocations.patternIntensity,S),t.uniform1f(s.uniformLocations.patternSpeed,E),t.uniform1i(s.uniformLocations.enableBorder,T),t.uniform1f(s.uniformLocations.borderWidth,P),t.uniform1f(s.uniformLocations.borderSpeed,m),y&&t.uniform3f(s.uniformLocations.borderColor,y.r,y.g,y.b),t.uniform1f(s.uniformLocations.audioLow,this.audioData.low),t.uniform1f(s.uniformLocations.audioMid,this.audioData.mid),t.uniform1f(s.uniformLocations.audioHigh,this.audioData.high),t.uniform1f(s.uniformLocations.audioLevel,this.audioData.level);const M=e.audioSettings||{bassScale:1,midScale:1,highScale:1,gain:1,enabled:!0},D=M.enabled?1:0;t.uniform1f(s.uniformLocations.audioBassScale,M.bassScale*D),t.uniform1f(s.uniformLocations.audioMidScale,M.midScale*D),t.uniform1f(s.uniformLocations.audioHighScale,M.highScale*D),t.uniform1f(s.uniformLocations.audioGain,M.gain*D);const X=(Date.now()-this.startTime)/1e3;if(t.uniform1f(s.uniformLocations.time,X),i?t.uniform1i(s.uniformLocations.useMask,0):(t.uniform1i(s.uniformLocations.useMask,1),t.uniform1i(s.uniformLocations.maskTexture,1)),e.contentType==="video"&&e.videoElement||e.contentType==="drawing"&&e.drawingCanvas){let x=this.videoTextures.get(e.id);x||(x=t.createTexture(),this.videoTextures.set(e.id,x)),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,x);const C=e.contentType==="video"?e.videoElement:e.drawingCanvas;e.contentType==="video"?t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,C):e.isDirty&&(t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,C),e.isDirty=!1),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.uniform1i(s.uniformLocations.texture,0)}t.uniform2f(s.uniformLocations.resolution,this.canvas.width,this.canvas.height),t.drawArrays(t.TRIANGLES,0,o.length/2),t.deleteBuffer(l),t.deleteBuffer(c)}addTriangleToBuffers(e,i,t,s,o,r,l,c,d,f){const a=t[s],h=t[o],p=t[r];e.push(a.x*2-1,-(a.y*2-1)),e.push(h.x*2-1,-(h.y*2-1)),e.push(p.x*2-1,-(p.y*2-1));const v=l-1,S=c/v,E=d/v;f===0?(i.push(S,E),i.push((c+1)/v,E),i.push(S,(d+1)/v)):(i.push((c+1)/v,E),i.push((c+1)/v,(d+1)/v),i.push(S,(d+1)/v))}render(e,i){this.resize();const t=this.gl,s=e.filter(o=>o.type==="drawing"&&o.useAsMask&&!o.parent);t.bindFramebuffer(t.FRAMEBUFFER,this.maskFramebuffer),t.viewport(0,0,this.canvas.width,this.canvas.height),t.clearColor(1,1,1,1),t.clear(t.COLOR_BUFFER_BIT),s.length>0&&s.forEach(o=>{if(!o.drawingCanvas)return;t.blendFuncSeparate(t.ZERO,t.ONE_MINUS_SRC_ALPHA,t.ZERO,t.ONE_MINUS_SRC_ALPHA),t.enable(t.BLEND);const r=o.shaderType,l=o.contentType;o.contentType="shader",o.shaderType="solid",this.renderPolygon(o,!0),o.contentType=l,o.shaderType=r,t.blendFunc(t.ONE,t.ONE),this.renderPolygon(o,!0)}),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),t.bindFramebuffer(t.FRAMEBUFFER,null),t.viewport(0,0,this.canvas.width,this.canvas.height),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT|t.STENCIL_BUFFER_BIT),t.activeTexture(t.TEXTURE1),t.bindTexture(t.TEXTURE_2D,this.maskTexture),e.forEach(o=>{o.parent||o.useAsMask||(o.children&&o.children.length>0?(t.enable(t.STENCIL_TEST),t.clear(t.STENCIL_BUFFER_BIT),t.stencilFunc(t.ALWAYS,1,255),t.stencilOp(t.KEEP,t.KEEP,t.REPLACE),t.colorMask(!1,!1,!1,!1),o.children.forEach(r=>{const l=r.shaderType,c=r.contentType;r.contentType="shader",r.shaderType="solid",this.renderPolygon(r,!1),r.contentType=c,r.shaderType=l}),t.colorMask(!0,!0,!0,!0),t.stencilFunc(t.EQUAL,1,255),t.stencilOp(t.KEEP,t.KEEP,t.KEEP),this.renderPolygon(o,!1),t.disable(t.STENCIL_TEST)):this.renderPolygon(o,!1))})}}class _{constructor(e,i=null,t="polygon"){g(this,"id");g(this,"vertices");g(this,"type");g(this,"contentType");g(this,"shaderType");g(this,"videoSrc");g(this,"videoElement");g(this,"selected");g(this,"effects");g(this,"warpMode");g(this,"gridVertices");g(this,"gridSize");g(this,"audioSettings");g(this,"drawingCanvas");g(this,"drawingCtx");g(this,"isDirty");g(this,"useAsMask");g(this,"parent");g(this,"children");this.id=i||Date.now()+Math.random(),this.vertices=e,this.type=t,this.contentType="shader",this.shaderType="rainbow",this.videoSrc=null,this.videoElement=null,this.selected=!1,this.effects=[],this.warpMode=!1,this.gridVertices=[],this.gridSize=3,this.audioSettings={bassScale:1,midScale:1,highScale:1,gain:1,enabled:!0},this.drawingCanvas=null,this.drawingCtx=null,this.isDirty=!1,this.useAsMask=!1,this.parent=null,this.children=[],t==="drawing"&&this.initDrawingCanvas()}initDrawingCanvas(){this.drawingCanvas=document.createElement("canvas"),this.drawingCanvas.width=1024,this.drawingCanvas.height=1024,this.drawingCtx=this.drawingCanvas.getContext("2d"),this.contentType="drawing",this.isDirty=!0}createGrid(){const e=this.getBoundingBox();this.gridVertices=[];for(let i=0;i<this.gridSize;i++)for(let t=0;t<this.gridSize;t++)this.gridVertices.push({x:e.minX+t/(this.gridSize-1)*e.width,y:e.minY+i/(this.gridSize-1)*e.height})}setGridSize(e){this.gridSize!==e&&(this.gridSize=e,this.warpMode&&this.createGrid())}toggleWarpMode(){this.warpMode=!this.warpMode,this.warpMode&&this.gridVertices.length===0&&this.createGrid()}addEffect(e){const i=Date.now().toString();let t={};e==="brightness"?t={value:0}:e==="contrast"?t={value:1}:e==="saturation"?t={value:1}:e==="hue"?t={value:0}:["scanlines","dots","grid"].includes(e)?t={scale:10,intensity:.5,speed:1}:e==="border"&&(t={width:.02,color:{r:1,g:1,b:1},speed:2}),this.effects.push({id:i,type:e,params:t})}removeEffect(e){this.effects=this.effects.filter(i=>i.id!==e)}updateEffect(e,i){const t=this.effects.find(s=>s.id===e);t&&(t.params={...t.params,...i})}setContent(e,i){this.contentType=e,e==="shader"?this.shaderType=i:e==="video"&&(this.videoSrc=i,this.loadVideo())}loadVideo(){this.videoSrc&&(this.videoElement=document.createElement("video"),this.videoElement.src=this.videoSrc,this.videoElement.loop=!0,this.videoElement.muted=!0,this.videoElement.setAttribute("playsinline",""),this.videoElement.setAttribute("webkit-playsinline",""),this.videoElement.play().catch(e=>console.warn("Video play failed",e)))}getBoundingBox(){let e=1/0,i=-1/0,t=1/0,s=-1/0;return(this.warpMode&&this.gridVertices.length>0?this.gridVertices:this.vertices).forEach(r=>{r.x<e&&(e=r.x),r.x>i&&(i=r.x),r.y<t&&(t=r.y),r.y>s&&(s=r.y)}),e===1/0?{minX:0,minY:0,maxX:1,maxY:1,width:1,height:1}:{minX:e,minY:t,maxX:i,maxY:s,width:i-e,height:s-t}}getDiscretizedVertices(e=10){const i=[];for(let t=0;t<this.vertices.length;t++){const s=this.vertices[t],o=this.vertices[(t+1)%this.vertices.length];if(s.bezier&&s.c2&&o.c1)for(let r=0;r<1;r+=1/e){const l=Math.pow(1-r,3)*s.x+3*Math.pow(1-r,2)*r*s.c2.x+3*(1-r)*Math.pow(r,2)*o.c1.x+Math.pow(r,3)*o.x,c=Math.pow(1-r,3)*s.y+3*Math.pow(1-r,2)*r*s.c2.y+3*(1-r)*Math.pow(r,2)*o.c1.y+Math.pow(r,3)*o.y;i.push({x:l,y:c})}else i.push(s)}return i}getRenderVertices(){return this.warpMode?this.gridVertices:this.vertices}containsPoint(e,i){let t=!1;const s=this.getDiscretizedVertices(10);for(let o=0,r=s.length-1;o<s.length;r=o++){const l=s[o].x,c=s[o].y,d=s[r].x,f=s[r].y;c>i!=f>i&&e<(d-l)*(i-c)/(f-c)+l&&(t=!t)}return t}getVertexAtPoint(e,i,t=.02){if(this.warpMode){for(let s=0;s<this.gridVertices.length;s++){const o=this.gridVertices[s];if(Math.sqrt((o.x-e)**2+(o.y-i)**2)<t)return{type:"grid",index:s}}return null}for(let s=0;s<this.vertices.length;s++){const o=this.vertices[s];if(Math.sqrt((o.x-e)**2+(o.y-i)**2)<t)return{type:"vertex",index:s};if(o.bezier){if(o.c1&&Math.sqrt((o.c1.x-e)**2+(o.c1.y-i)**2)<t)return{type:"c1",index:s};if(o.c2&&Math.sqrt((o.c2.x-e)**2+(o.c2.y-i)**2)<t)return{type:"c2",index:s}}}return null}moveVertex(e,i,t){if(e.type==="grid")this.gridVertices[e.index].x=i,this.gridVertices[e.index].y=t;else if(e.type==="vertex"){const s=this.vertices[e.index],o=i-s.x,r=t-s.y;s.x=i,s.y=t,s.c1&&(s.c1.x+=o,s.c1.y+=r),s.c2&&(s.c2.x+=o,s.c2.y+=r)}else e.type==="c1"?this.vertices[e.index].c1={x:i,y:t}:e.type==="c2"&&(this.vertices[e.index].c2={x:i,y:t})}translate(e,i){this.vertices.forEach(t=>{t.x+=e,t.y+=i,t.c1&&(t.c1.x+=e,t.c1.y+=i),t.c2&&(t.c2.x+=e,t.c2.y+=i)}),this.warpMode&&this.gridVertices.forEach(t=>{t.x+=e,t.y+=i})}toJSON(){return{id:this.id,vertices:this.vertices,type:this.type,contentType:this.contentType,shaderType:this.shaderType,videoSrc:this.videoSrc,effects:this.effects,warpMode:this.warpMode,gridVertices:this.gridVertices,gridSize:this.gridSize,audioSettings:this.audioSettings,useAsMask:this.useAsMask,drawingData:this.drawingCanvas?this.drawingCanvas.toDataURL():null,children:this.children.map(e=>e.toJSON())}}static fromJSON(e){const i=new _(e.vertices,e.id,e.type);if(i.contentType=e.contentType,i.shaderType=e.shaderType,i.videoSrc=e.videoSrc,i.useAsMask=e.useAsMask||!1,i.effects=e.effects||[],i.warpMode=e.warpMode||!1,i.gridVertices=e.gridVertices||[],i.gridSize=e.gridSize||3,i.audioSettings=e.audioSettings||{bassScale:1,midScale:1,highScale:1,gain:1,enabled:!0},i.videoSrc&&i.loadVideo(),e.type==="drawing"&&e.drawingData){i.initDrawingCanvas();const t=new Image;t.onload=()=>{i.drawingCtx.drawImage(t,0,0),i.isDirty=!0},t.src=e.drawingData}return e.children&&(i.children=e.children.map(t=>{const s=_.fromJSON(t);return s.parent=i,s})),i}}class F{static createTriangle(e,i,t=.15){const s=t*Math.sqrt(3)/2;return new _([{x:e,y:i-s*.66},{x:e-t/2,y:i+s*.33},{x:e+t/2,y:i+s*.33}],null,"triangle")}static createSquare(e,i,t=.15){const s=t/2;return new _([{x:e-s,y:i-s},{x:e+s,y:i-s},{x:e+s,y:i+s},{x:e-s,y:i+s}],null,"quad")}static createWarpRect(e,i,t=.15){const s=F.createSquare(e,i,t);return s.warpMode=!0,s.createGrid(),s}static createCanvas(e,i,t=.5){const s=t/2;return new _([{x:e-s,y:i-s},{x:e+s,y:i-s},{x:e+s,y:i+s},{x:e-s,y:i+s}],null,"drawing")}static createCircle(e,i,t=.15){const s=t/2,o=s*.55228,r={x:e,y:i-s,c1:{x:e-o,y:i-s},c2:{x:e+o,y:i-s},bezier:!0},l={x:e+s,y:i,c1:{x:e+s,y:i-o},c2:{x:e+s,y:i+o},bezier:!0},c={x:e,y:i+s,c1:{x:e+o,y:i+s},c2:{x:e-o,y:i+s},bezier:!0},d={x:e-s,y:i,c1:{x:e-s,y:i+o},c2:{x:e-s,y:i-o},bezier:!0};return new _([r,l,c,d],null,"circle")}}class be{constructor(){g(this,"audioContext");g(this,"analyser");g(this,"source");g(this,"dataArray");g(this,"isActive");g(this,"stream");this.audioContext=null,this.analyser=null,this.source=null,this.dataArray=null,this.isActive=!1,this.stream=null}async start(){if(!this.isActive)try{this.stream=await navigator.mediaDevices.getUserMedia({audio:!0}),this.audioContext=new(window.AudioContext||window.webkitAudioContext),this.analyser=this.audioContext.createAnalyser(),this.analyser.fftSize=256,this.source=this.audioContext.createMediaStreamSource(this.stream),this.source.connect(this.analyser),this.dataArray=new Uint8Array(this.analyser.frequencyBinCount),this.isActive=!0,console.log("Audio analysis started")}catch(e){console.error("Error accessing microphone:",e),alert("Could not access microphone. Please ensure you have granted permission.")}}stop(){this.isActive&&(this.stream&&this.stream.getTracks().forEach(e=>e.stop()),this.audioContext&&this.audioContext.close(),this.isActive=!1,this.audioContext=null,this.analyser=null,this.source=null)}getAudioData(){if(!this.isActive||!this.analyser||!this.dataArray)return{low:0,mid:0,high:0,level:0};this.analyser.getByteFrequencyData(this.dataArray);const e=this.analyser.frequencyBinCount,i=Math.floor(e*.1),t=Math.floor(e*.5);let s=0,o=0,r=0;for(let c=0;c<e;c++){const d=this.dataArray[c]/255;c<i?s+=d:c<t?o+=d:r+=d}s/=i,o/=t-i,r/=e-t;const l=(s+o+r)/3;return{low:s,mid:o,high:r,level:l}}}const q={getItem:n=>{try{return localStorage.getItem(n)}catch(e){return console.warn("LocalStorage access denied",e),null}},setItem:(n,e)=>{try{localStorage.setItem(n,e)}catch(i){console.warn("LocalStorage set failed",i)}},removeItem:n=>{try{localStorage.removeItem(n)}catch(e){console.warn("LocalStorage remove failed",e)}}},u=n=>document.getElementById(n);class ie{constructor(){g(this,"canvas");g(this,"overlayCanvas");g(this,"overlayCtx");g(this,"renderer");g(this,"audioManager");g(this,"polygons");g(this,"selectedPolygon");g(this,"selectedVertex");g(this,"currentTool");g(this,"drawingVertices");g(this,"isDrawing");g(this,"dragStart");g(this,"editMode");g(this,"loadedVideos");g(this,"controlsDragStart");g(this,"controlsPosition");g(this,"uiVisible");g(this,"userHasToggledMode");g(this,"lastBrushPos",null);g(this,"isDraggingVertex",!1);g(this,"isPlacingPoint",!1);g(this,"draggingLayer",null);g(this,"dragGhost",null);g(this,"dragStartY",0);g(this,"dragTimeout",null);this.canvas=document.getElementById("mainCanvas"),this.overlayCanvas=document.getElementById("overlayCanvas"),this.overlayCtx=this.overlayCanvas.getContext("2d"),this.renderer=new Ee(this.canvas),this.audioManager=new be,this.polygons=[],this.selectedPolygon=null,this.selectedVertex=null,this.currentTool="select",this.drawingVertices=[],this.isDrawing=!1,this.dragStart=null,this.editMode=!0,this.loadedVideos=new Map,this.controlsDragStart=null,this.controlsPosition={x:null,y:null},this.uiVisible=!0,this.userHasToggledMode=!1;try{this.setupEventListeners(),this.resizeOverlay(),window.addEventListener("resize",()=>{this.resizeOverlay()}),this.showWelcomeModal(),this.animate()}catch(e){console.error("Critical Initialization Error:",e),this.showStatus("App failed to initialize. Check console.")}}resizeOverlay(){if(!this.overlayCanvas)return;const e=this.overlayCanvas.clientWidth,i=this.overlayCanvas.clientHeight;(this.overlayCanvas.width!==e||this.overlayCanvas.height!==i)&&(this.overlayCanvas.width=e,this.overlayCanvas.height=i)}setupEventListeners(){const e=(a,h)=>{const p=u(a);p&&p.addEventListener("click",h)};e("toggleSidebarBtn",()=>{const a=u("leftSidebar");a&&a.classList.toggle("hidden")}),e("toggleRightSidebarBtn",()=>{const a=u("rightSidebar");a&&a.classList.toggle("hidden")}),document.querySelectorAll(".sidebar-section h3").forEach(a=>{a.style.cursor="pointer",a.addEventListener("click",h=>{const p=h.target.closest(".sidebar-section");p&&Array.from(p.children).forEach(v=>{if(v.tagName!=="H3"){const S=v;S.style.display=S.style.display==="none"?"":"none"}})})}),e("addTriangleBtn",()=>this.setTool("triangle")),e("addSquareBtn",()=>this.setTool("square")),e("addCircleBtn",()=>this.setTool("circle")),e("drawPolygonBtn",()=>this.setTool("draw")),e("addWarpRectBtn",()=>{const a=F.createWarpRect(.5,.5,.5);this.addPolygon(a)}),e("addCanvasBtn",()=>{const a=F.createCanvas(.5,.5);this.polygons.push(a),this.selectPolygon(a),this.setTool("brush")}),e("selectBtn",()=>this.setTool("select")),e("brushBtn",()=>this.setTool("brush")),e("deleteBtn",()=>this.deleteSelected());const i=()=>{const a=u("brushSizeSlider"),h=u("brushOpacitySlider"),p=u("brushColorPicker"),v=u("eraserToggle");if(!a||!h||!p||!v)return{size:5,opacity:1,color:"#fff",eraser:!1};const S=parseInt(a.value),E=parseFloat(h.value),T=p.value,P=v.checked,y=u("brushSizeVal"),m=u("brushOpacityVal");return y&&(y.textContent=S.toString()),m&&(m.textContent=E.toFixed(1)),{size:S,opacity:E,color:T,eraser:P}};["brushSizeSlider","brushOpacitySlider","brushColorPicker","eraserToggle"].forEach(a=>{const h=u(a);h&&h.addEventListener("input",i)}),e("clearCanvasBtn",()=>{this.selectedPolygon&&this.selectedPolygon.type==="drawing"&&this.selectedPolygon.drawingCtx&&(this.selectedPolygon.drawingCtx.clearRect(0,0,1024,1024),this.selectedPolygon.isDirty=!0)});const t=u("useAsMaskToggle");t&&t.addEventListener("change",a=>{this.selectedPolygon&&this.selectedPolygon.type==="drawing"&&(this.selectedPolygon.useAsMask=a.target.checked)}),e("changeContentBtn",()=>this.showContentModal());const s=u("warpToggle");s&&s.addEventListener("change",a=>{this.toggleWarpMode(a.target.checked)});const o=u("gridSizeSlider");o&&o.addEventListener("input",a=>{if(this.selectedPolygon){const h=parseInt(a.target.value),p=u("gridSizeVal"),v=u("gridSizeVal2");p&&(p.textContent=h.toString()),v&&(v.textContent=h.toString()),this.selectedPolygon.setGridSize(h)}});const r=u("audioEnabledToggle");r&&r.addEventListener("change",a=>{this.selectedPolygon&&(this.selectedPolygon.audioSettings.enabled=a.target.checked)});const l=(a,h)=>{const p=u(a);p&&p.addEventListener("input",v=>{this.selectedPolygon&&(this.selectedPolygon.audioSettings[h]=parseFloat(v.target.value))})};l("audioGainSlider","gain"),l("audioBassSlider","bassScale"),l("audioMidSlider","midScale"),l("audioHighSlider","highScale"),e("addEffectBtn",()=>{const a=u("effectTypeSelect");a&&this.addEffect(a.value)}),e("performanceBtn",()=>this.togglePerformanceMode()),e("fullscreenBtn",()=>this.toggleFullscreen()),e("saveBtn",()=>this.saveProject()),e("loadBtn",()=>this.loadProjectDialog()),e("audioToggleBtn",()=>this.toggleAudio()),this.canvas.addEventListener("touchstart",a=>this.handleTouchStart(a),{passive:!1}),this.canvas.addEventListener("touchmove",a=>this.handleTouchMove(a),{passive:!1}),this.canvas.addEventListener("touchend",a=>this.handleTouchEnd(a),{passive:!1}),this.canvas.addEventListener("mousedown",a=>this.handleMouseDown(a)),this.canvas.addEventListener("mousemove",a=>this.handleMouseMove(a)),document.addEventListener("mouseup",a=>this.handleMouseUp(a)),document.querySelectorAll(".arrow-btn").forEach(a=>{a.addEventListener("click",()=>{this.finetuneVertex(a.dataset.dir)})}),e("toggleCurveBtn",()=>this.toggleVertexCurve()),document.querySelectorAll(".close-modal").forEach(a=>{a.addEventListener("click",()=>this.hideAllModals())}),document.querySelectorAll(".content-type-btn").forEach(a=>{a.addEventListener("click",()=>{const h=a.dataset.type;h==="shader"?this.showShaderModal():h==="video"&&this.showVideoModal()})}),document.querySelectorAll(".shader-btn").forEach(a=>{a.addEventListener("click",()=>{this.setPolygonContent("shader",a.dataset.shader)})});const c=u("videoFileInput");c&&c.addEventListener("change",a=>this.handleVideoUpload(a));const d=u("performanceOverlay");d&&(d.addEventListener("click",()=>{this.editMode||this.togglePerformanceMode()}),d.addEventListener("touchstart",a=>{this.editMode||(a.preventDefault(),this.togglePerformanceMode())},{passive:!1}));const f=u("vertexControls");if(f){const a=f.querySelector(".control-drag-handle");a&&(a.addEventListener("mousedown",h=>this.startControlsDrag(h)),a.addEventListener("touchstart",h=>this.startControlsDrag(h),{passive:!1}))}document.addEventListener("mousemove",a=>this.moveControls(a)),document.addEventListener("touchmove",a=>this.moveControls(a),{passive:!1}),document.addEventListener("mouseup",()=>this.stopControlsDrag()),document.addEventListener("touchend",()=>this.stopControlsDrag()),e("newProjectBtn",()=>this.startNewProject()),e("loadProjectFileBtn",()=>this.loadProjectFromFile()),e("continueProjectBtn",()=>this.continueLastProject())}addPolygon(e){this.polygons.push(e),this.selectPolygon(e),this.setTool("select"),this.renderLayersList()}handleBrushStroke(e,i,t){const s=this.selectedPolygon;if(!s||s.type!=="drawing"||!s.drawingCtx)return;const o=s.getBoundingBox(),r=this.canvas.getBoundingClientRect(),l=(e-r.left)/r.width,c=(i-r.top)/r.height,d=(l-o.minX)/o.width,f=(c-o.minY)/o.height;if(d<0||d>1||f<0||f>1){this.lastBrushPos=null;return}const a=s.drawingCtx,h=s.drawingCanvas.width,p=s.drawingCanvas.height,v=d*h,S=f*p,E=u("brushSizeSlider"),T=u("brushOpacitySlider"),P=u("brushColorPicker"),y=u("eraserToggle"),m=E?parseInt(E.value):5,M=T?parseFloat(T.value):1,D=P?P.value:"#fff",X=y?y.checked:!1;a.lineJoin="round",a.lineCap="round",a.lineWidth=m,X?(a.globalCompositeOperation="destination-out",a.strokeStyle=`rgba(0,0,0,${M})`):(a.globalCompositeOperation="source-over",a.strokeStyle=D,a.globalAlpha=M,a.lineWidth=m),t||!this.lastBrushPos?(a.beginPath(),a.moveTo(v,S),a.lineTo(v,S),a.stroke()):(a.beginPath(),a.moveTo(this.lastBrushPos.x,this.lastBrushPos.y),a.lineTo(v,S),a.stroke()),a.globalCompositeOperation="source-over",a.globalAlpha=1,this.lastBrushPos={x:v,y:S},s.isDirty=!0}handlePointerDown(e,i){const t=this.getNormalizedCoords(e,i);if(this.currentTool==="brush"){this.selectedPolygon&&this.selectedPolygon.type==="drawing"&&(this.isDrawing=!0,this.handleBrushStroke(e,i,!0));return}if(this.currentTool==="triangle"){const s=F.createTriangle(t.x,t.y);this.addPolygon(s)}else if(this.currentTool==="square"){const s=F.createSquare(t.x,t.y);this.addPolygon(s)}else if(this.currentTool==="circle"){const s=F.createCircle(t.x,t.y);this.addPolygon(s)}else if(this.currentTool==="draw"){if(this.drawingVertices.length>=3){const s=this.drawingVertices[0];if(Math.sqrt((t.x-s.x)**2+(t.y-s.y)**2)<.05){this.finishDrawing();return}}this.drawingVertices.push({x:t.x,y:t.y}),this.isPlacingPoint=!0,this.isDrawing=!0}else if(this.currentTool==="select"){let s=!1;const o=[];this.polygons.forEach(r=>{o.push(r),r.children&&o.push(...r.children)});for(let r=o.length-1;r>=0;r--){const l=o[r],c=l.getVertexAtPoint(t.x,t.y);if(c){this.selectPolygon(l),this.selectedVertex=c,this.isDraggingVertex=!0,this.updateVertexControls(!0),s=!0;break}}if(!s){for(let r=o.length-1;r>=0;r--){const l=o[r];if(l.containsPoint(t.x,t.y)){this.selectPolygon(l),this.selectedVertex=null,this.updateVertexControls(!1),this.dragStart=t,s=!0;break}}s||(this.selectPolygon(null),this.selectedVertex=null,this.updateVertexControls(!1))}}this.renderLayersList()}handlePointerMove(e,i){if(this.currentTool==="brush"&&this.isDrawing){this.handleBrushStroke(e,i,!1);return}const t=this.getNormalizedCoords(e,i);if(this.currentTool==="draw"&&this.isPlacingPoint&&this.drawingVertices.length>0){this.drawingVertices[this.drawingVertices.length-1]={x:t.x,y:t.y};return}if(this.isDraggingVertex&&this.selectedPolygon&&this.selectedVertex)this.selectedPolygon.moveVertex(this.selectedVertex,t.x,t.y);else if(this.selectedPolygon&&this.dragStart){const s=t.x-this.dragStart.x,o=t.y-this.dragStart.y;this.selectedPolygon.translate(s,o),this.dragStart=t}}handlePointerUp(){this.isDraggingVertex=!1,this.currentTool==="draw"&&(this.isPlacingPoint=!1),this.currentTool==="brush"&&(this.isDrawing=!1,this.lastBrushPos=null),this.dragStart&&(this.dragStart=null)}finishDrawing(){if(this.drawingVertices.length>=3){const i=new _(this.drawingVertices);this.addPolygon(i)}this.drawingVertices=[],this.isDrawing=!1,this.setTool("select");const e=u("leftSidebar");e&&window.innerWidth<768&&e.classList.remove("hidden")}selectPolygon(e){this.polygons.forEach(t=>{t.selected=!1,t.children&&t.children.forEach(s=>s.selected=!1)}),this.selectedPolygon=e;const i=u("rightSidebar");e?(e.selected=!0,i&&i.classList.remove("hidden"),this.updatePropertiesPanel(e),e.type!=="drawing"&&this.currentTool==="brush"&&this.setTool("select")):i&&i.classList.add("hidden"),this.renderLayersList()}updatePropertiesPanel(e){const i=u("currentContentInfo");i&&(e.contentType==="video"?i.textContent="Video":i.textContent=`Shader: ${e.shaderType}`);const t=u("warpToggle");t&&(t.checked=e.warpMode);const s=u("warpSettings");if(e.warpMode){s&&s.classList.remove("hidden");const h=u("gridSizeSlider");h&&(h.value=e.gridSize.toString());const p=u("gridSizeVal");p&&(p.textContent=e.gridSize.toString());const v=u("gridSizeVal2");v&&(v.textContent=e.gridSize.toString())}else s&&s.classList.add("hidden");const o=u("audioEnabledToggle");o&&(o.checked=e.audioSettings.enabled);const r=u("audioGainSlider");r&&(r.value=e.audioSettings.gain.toString());const l=u("audioBassSlider");l&&(l.value=e.audioSettings.bassScale.toString());const c=u("audioMidSlider");c&&(c.value=e.audioSettings.midScale.toString());const d=u("audioHighSlider");d&&(d.value=e.audioSettings.highScale.toString());const f=u("canvasMaskControl"),a=u("brushControls");if(e.type==="drawing"){f&&f.classList.remove("hidden");const h=u("useAsMaskToggle");h&&(h.checked=e.useAsMask),this.currentTool==="brush"?a&&a.classList.remove("hidden"):a&&a.classList.add("hidden")}else f&&f.classList.add("hidden"),a&&a.classList.add("hidden");this.renderEffectsList(e)}addEffect(e){if(!this.selectedPolygon)return;if(this.selectedPolygon.effects.find(t=>t.type===e)){this.showStatus(`${e} effect already added`);return}this.selectedPolygon.addEffect(e),this.updatePropertiesPanel(this.selectedPolygon)}removeEffect(e){this.selectedPolygon&&(this.selectedPolygon.removeEffect(e),this.updatePropertiesPanel(this.selectedPolygon))}renderEffectsList(e){const i=u("effectsListContainer");if(i){if(i.innerHTML="",!e.effects||e.effects.length===0){i.innerHTML="<div style='opacity:0.5; font-size:12px; padding:8px;'>No effects added</div>";return}e.effects.forEach(t=>{const s=document.createElement("div");s.className="effect-item";let o="";const r=t.params;if(["brightness","contrast","saturation","hue"].includes(t.type)){const d=t.type==="brightness"?-1:0,f=t.type==="brightness"?1:2,a=t.type==="hue"?.01:.1;o=`
                <div class="control-group">
                    <label>Value: <span id="val-${t.id}">${r.value.toFixed(2)}</span></label>
                    <input type="range" min="${d}" max="${f}" step="${a}" value="${r.value}" 
                           data-effect-id="${t.id}" data-param="value">
                </div>
            `}else["scanlines","dots","grid"].includes(t.type)?o=`
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
            `:t.type==="border"&&(o=`
                <div class="control-group">
                    <label>Width</label>
                    <input type="range" min="0.01" max="0.2" step="0.01" value="${r.width}"
                           data-effect-id="${t.id}" data-param="width">
                </div>
                <div class="control-group">
                    <label>Pulse Speed</label>
                    <input type="range" min="0" max="10" step="0.1" value="${r.speed!==void 0?r.speed:0}"
                           data-effect-id="${t.id}" data-param="speed">
                </div>
            `);s.innerHTML=`
            <div class="effect-header">
                <span>${t.type.toUpperCase()}</span>
                <button class="effect-remove" data-effect-id="${t.id}">✕</button>
            </div>
            ${o}
        `;const l=s.querySelector(".effect-remove");l&&l.addEventListener("click",d=>{const f=d.target;this.removeEffect(f.dataset.effectId)}),s.querySelectorAll('input[type="range"]').forEach(d=>{d.addEventListener("input",f=>{const a=f.target,h=a.dataset.param,p=parseFloat(a.value),v=a.dataset.effectId,S={};S[h]=p,this.updateEffectParam(v,S)})}),i.appendChild(s)})}}updateEffectParam(e,i){if(this.selectedPolygon){this.selectedPolygon.updateEffect(e,i);const t=u(`val-${e}`);t&&i.value!==void 0&&(t.textContent=i.value.toFixed(2))}}showStatus(e){const i=u("statusMsg");i&&(i.textContent=e,i.classList.remove("hidden"),setTimeout(()=>{i.classList.add("hidden")},2e3))}loadProjectDialog(){this.loadProjectFromFile()}startControlsDrag(e){e.preventDefault(),e.stopPropagation();const i=u("vertexControls");if(!i)return;const t=i.getBoundingClientRect(),s=e.touches?e.touches[0].clientX:e.clientX,o=e.touches?e.touches[0].clientY:e.clientY;this.controlsDragStart={x:s-t.left,y:o-t.top}}moveControls(e){if(!this.controlsDragStart)return;e.preventDefault();const i=e.touches?e.touches[0].clientX:e.clientX,t=e.touches?e.touches[0].clientY:e.clientY,s=u("vertexControls");if(!s)return;const o=i-this.controlsDragStart.x,r=t-this.controlsDragStart.y,l=window.innerWidth-s.offsetWidth,c=window.innerHeight-s.offsetHeight;this.controlsPosition.x=Math.max(0,Math.min(o,l)),this.controlsPosition.y=Math.max(0,Math.min(r,c)),s.style.left=this.controlsPosition.x+"px",s.style.top=this.controlsPosition.y+"px",s.style.right="auto",s.style.bottom="auto",s.style.transform="none"}stopControlsDrag(){this.controlsDragStart=null}setTool(e){this.currentTool=e,this.isDrawing=!1,this.drawingVertices=[],document.querySelectorAll(".tool-btn").forEach(t=>t.classList.remove("active"));const i=t=>{const s=u(t);s&&s.classList.add("active")};if(e==="select")i("selectBtn");else if(e==="brush"){if(i("brushBtn"),this.selectedPolygon&&this.selectedPolygon.type==="drawing"){const t=u("brushControls");t&&t.classList.remove("hidden")}}else if(e==="triangle"?i("addTriangleBtn"):e==="square"?i("addSquareBtn"):e==="circle"?i("addCircleBtn"):e==="draw"&&i("drawPolygonBtn"),window.innerWidth<768){const t=u("leftSidebar"),s=u("rightSidebar");t&&t.classList.add("hidden"),s&&s.classList.add("hidden")}if(e!=="brush"){const t=u("brushControls");t&&t.classList.add("hidden")}}getNormalizedCoords(e,i){const t=this.canvas.getBoundingClientRect();return{x:(e-t.left)/t.width,y:(i-t.top)/t.height}}handleTouchStart(e){if(e.preventDefault(),e.touches.length===1){const i=e.touches[0];this.handlePointerDown(i.clientX,i.clientY)}}handleTouchMove(e){if(e.preventDefault(),e.touches.length===1){const i=e.touches[0];this.handlePointerMove(i.clientX,i.clientY)}}handleTouchEnd(e){e.preventDefault(),this.handlePointerUp()}handleMouseDown(e){this.handlePointerDown(e.clientX,e.clientY)}handleMouseMove(e){this.handlePointerMove(e.clientX,e.clientY)}handleMouseUp(e){this.handlePointerUp()}toggleWarpMode(e){this.selectedPolygon&&(e!==this.selectedPolygon.warpMode&&this.selectedPolygon.toggleWarpMode(),this.selectedVertex=null,this.updateVertexControls(!1),this.updatePropertiesPanel(this.selectedPolygon))}updateVertexControls(e){const i=u("vertexControls");i&&(e&&this.selectedVertex?i.classList.remove("hidden"):i.classList.add("hidden"))}finetuneVertex(e){if(!this.selectedPolygon||!this.selectedVertex)return;const i=this.selectedPolygon,t=this.selectedVertex,s=1/this.canvas.width;let o=null;t.type==="grid"?o=i.gridVertices[t.index]:t.type==="vertex"?o=i.vertices[t.index]:t.type==="c1"?o=i.vertices[t.index].c1:t.type==="c2"&&(o=i.vertices[t.index].c2),o&&(e==="up"&&(o.y-=s),e==="down"&&(o.y+=s),e==="left"&&(o.x-=s),e==="right"&&(o.x+=s))}toggleVertexCurve(){if(!this.selectedPolygon||!this.selectedVertex||this.selectedVertex.type!=="vertex")return;const e=this.selectedPolygon,i=this.selectedVertex.index,t=e.vertices[i];if(t.bezier=!t.bezier,t.bezier&&(!t.c1||!t.c2)){const s=(i-1+e.vertices.length)%e.vertices.length,o=(i+1)%e.vertices.length,r=e.vertices[s],l=e.vertices[o],c=t.x-r.x,d=t.y-r.y;t.c1={x:t.x-c*.2,y:t.y-d*.2};const f=l.x-t.x,a=l.y-t.y;t.c2={x:t.x+f*.2,y:t.y+a*.2}}}deleteSelected(){if(this.selectedPolygon){const e=this.polygons.indexOf(this.selectedPolygon);if(e>=0)this.polygons.splice(e,1),this.selectPolygon(null);else for(const i of this.polygons){const t=i.children.indexOf(this.selectedPolygon);if(t>=0){i.children.splice(t,1),this.selectedPolygon.parent=null,this.selectPolygon(null);break}}}this.renderLayersList()}showContentModal(){if(!this.selectedPolygon){this.showStatus("Please select a polygon first");return}const e=u("contentModal");e&&e.classList.remove("hidden")}showShaderModal(){const e=u("contentModal"),i=u("shaderModal");e&&e.classList.add("hidden"),i&&i.classList.remove("hidden")}showVideoModal(){const e=u("contentModal"),i=u("videoModal");e&&e.classList.add("hidden"),i&&(i.classList.remove("hidden"),this.updateVideoList())}hideAllModals(){document.querySelectorAll(".modal").forEach(e=>e.classList.add("hidden"))}setPolygonContent(e,i){this.selectedPolygon&&(this.selectedPolygon.setContent(e,i),this.hideAllModals(),this.showStatus(`Content updated: ${e}`),this.updatePropertiesPanel(this.selectedPolygon))}handleVideoUpload(e){const i=e.target.files[0];if(i){const t=URL.createObjectURL(i);this.loadedVideos.set(i.name,t),this.updateVideoList(),e.target.value=""}}updateVideoList(){const e=u("videoList");e&&(e.innerHTML="",this.loadedVideos.forEach((i,t)=>{const s=document.createElement("button");s.className="content-type-btn",s.textContent=t,s.addEventListener("click",()=>{this.setPolygonContent("video",i)}),e.appendChild(s)}))}togglePerformanceMode(){this.editMode=!this.editMode;const e=u("uiContainer"),i=u("toggleSidebarBtn"),t=u("toggleRightSidebarBtn"),s=u("vertexControls"),o=u("statusMsg"),r=u("leftSidebar"),l=u("rightSidebar");this.editMode?(e&&e.classList.remove("hidden"),i&&(i.style.display="flex"),t&&t.classList.remove("hidden")):(e&&e.classList.add("hidden"),i&&(i.style.display="none"),t&&t.classList.add("hidden"),s&&s.classList.add("hidden"),o&&o.classList.add("hidden"),r&&r.classList.add("hidden"),l&&l.classList.add("hidden"));const c=u("performanceOverlay");c&&c.classList.toggle("hidden",this.editMode),this.overlayCanvas.style.display=this.editMode?"block":"none"}toggleFullscreen(){const e=document,i=document.documentElement,t=i.requestFullscreen||i.webkitRequestFullscreen||i.mozRequestFullScreen||i.msRequestFullscreen,s=e.exitFullscreen||e.webkitExitFullscreen||e.mozCancelFullScreen||e.msExitFullscreen;!e.fullscreenElement&&!e.webkitFullscreenElement&&!e.mozFullScreenElement&&!e.msFullscreenElement?t?t.call(i).catch(o=>{console.error("Fullscreen error:",o),this.showStatus("Fullscreen blocked or not supported")}):this.showStatus("Tap Share (box+arrow) > 'Add to Home Screen' for App Mode"):s&&s.call(e)}showWelcomeModal(){const e=u("welcomeModal");if(!e)return;const i=u("continueProjectBtn");if(i){const t=q.getItem("mobileMapperProject")!==null;i.disabled=!t}e.classList.remove("hidden")}startNewProject(){this.polygons=[],this.loadedVideos.clear(),this.selectedPolygon=null,this.selectedVertex=null,q.removeItem("mobileMapperProject");const e=u("welcomeModal");e&&e.classList.add("hidden"),this.showStatus("New project started"),this.selectPolygon(null)}continueLastProject(){this.loadProjectFromLocalStorage();const e=u("welcomeModal");e&&e.classList.add("hidden"),this.showStatus("Project loaded from last session")}loadProjectFromFile(){const e=document.createElement("input");e.type="file",e.accept=".json",e.onchange=i=>{const t=i.target.files[0];if(!t)return;const s=new FileReader;s.onload=o=>{try{const r=JSON.parse(o.target.result);this.loadProjectData(r);const l=u("welcomeModal");l&&l.classList.add("hidden"),this.showStatus("Project loaded from file!")}catch(r){this.showStatus("Failed to load project file"),console.error(r)}},s.readAsText(t)},e.click()}saveProject(){const e=`projection-mapping-${new Date().toISOString().split("T")[0]}`;let i=prompt("Enter project name:",e);if(i===null)return;i=i.trim()||e,i.endsWith(".json")||(i+=".json");const t={polygons:this.polygons.map(l=>l.toJSON()),videos:Array.from(this.loadedVideos.entries()),version:"1.0",name:i.replace(".json","")};q.setItem("mobileMapperProject",JSON.stringify(t));const s=new Blob([JSON.stringify(t,null,2)],{type:"application/json"}),o=URL.createObjectURL(s),r=document.createElement("a");r.href=o,r.download=i,r.click(),URL.revokeObjectURL(o),this.showStatus(`Project "${i}" saved!`)}loadProjectFromLocalStorage(){const e=q.getItem("mobileMapperProject");if(e)try{const i=JSON.parse(e);this.loadProjectData(i)}catch(i){console.error("Failed to load project:",i)}}loadProjectData(e){this.polygons=e.polygons.map(i=>_.fromJSON(i)),this.polygons.forEach(i=>{i.children&&i.children.forEach(t=>t.parent=i)}),e.videos&&(this.loadedVideos=new Map(e.videos),this.polygons.forEach(i=>{const t=s=>{s.contentType==="video"&&(s.videoSrc&&this.loadedVideos.has(s.videoSrc),s.loadVideo()),s.children&&s.children.forEach(t)};t(i)})),this.renderLayersList()}animate(){this.resizeOverlay(),this.audioManager.isActive?this.renderer.updateAudioData(this.audioManager.getAudioData()):this.renderer.updateAudioData({low:0,mid:0,high:0,level:0}),this.renderer.render(this.polygons,this.editMode),this.overlayCtx.clearRect(0,0,this.overlayCanvas.width,this.overlayCanvas.height);const e=this.overlayCanvas.width,i=this.overlayCanvas.height;if(this.editMode){const t=s=>{s.forEach(o=>{if(o.children&&t(o.children),o.selected,o.selected)if(o.getRenderVertices(),o.warpMode&&o.gridVertices.length>0){const r=o.gridSize;this.overlayCtx.strokeStyle="#ffff00",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath();for(let l=0;l<r;l++)for(let c=0;c<r-1;c++){const d=o.gridVertices[l*r+c],f=o.gridVertices[l*r+c+1];this.overlayCtx.moveTo(d.x*e,d.y*i),this.overlayCtx.lineTo(f.x*e,f.y*i)}for(let l=0;l<r;l++)for(let c=0;c<r-1;c++){const d=o.gridVertices[c*r+l],f=o.gridVertices[(c+1)*r+l];this.overlayCtx.moveTo(d.x*e,d.y*i),this.overlayCtx.lineTo(f.x*e,f.y*i)}this.overlayCtx.stroke(),o.gridVertices.forEach((l,c)=>{const d=l.x*e,f=l.y*i,a=this.selectedVertex&&this.selectedVertex.type==="grid"&&this.selectedVertex.index===c;this.overlayCtx.fillStyle=a?"#00ffff":"#ffff00",this.overlayCtx.beginPath(),this.overlayCtx.arc(d,f,a?8:4,0,Math.PI*2),this.overlayCtx.fill(),this.overlayCtx.stroke()})}else{const r=o.getDiscretizedVertices(30);this.overlayCtx.strokeStyle="#00ff00",this.overlayCtx.lineWidth=3,this.overlayCtx.beginPath(),r.forEach((l,c)=>{const d=l.x*e,f=l.y*i;c===0?this.overlayCtx.moveTo(d,f):this.overlayCtx.lineTo(d,f)}),this.overlayCtx.closePath(),this.overlayCtx.stroke(),o.vertices.forEach((l,c)=>{const d=l.x*e,f=l.y*i,a=this.selectedVertex&&this.selectedVertex.type==="vertex"&&this.selectedVertex.index===c;if(this.overlayCtx.fillStyle=a?"#00ffff":"#00ff00",this.overlayCtx.beginPath(),this.overlayCtx.arc(d,f,a?8:6,0,Math.PI*2),this.overlayCtx.fill(),this.overlayCtx.stroke(),l.bezier){if(l.c1){const h=l.c1.x*e,p=l.c1.y*i;this.overlayCtx.strokeStyle="rgba(255,255,255,0.5)",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath(),this.overlayCtx.moveTo(d,f),this.overlayCtx.lineTo(h,p),this.overlayCtx.stroke();const v=this.selectedVertex&&this.selectedVertex.type==="c1"&&this.selectedVertex.index===c;this.overlayCtx.fillStyle=v?"#ff00ff":"#ffffff",this.overlayCtx.beginPath(),this.overlayCtx.arc(h,p,4,0,Math.PI*2),this.overlayCtx.fill()}if(l.c2){const h=l.c2.x*e,p=l.c2.y*i;this.overlayCtx.strokeStyle="rgba(255,255,255,0.5)",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath(),this.overlayCtx.moveTo(d,f),this.overlayCtx.lineTo(h,p),this.overlayCtx.stroke();const v=this.selectedVertex&&this.selectedVertex.type==="c2"&&this.selectedVertex.index===c;this.overlayCtx.fillStyle=v?"#ff00ff":"#ffffff",this.overlayCtx.beginPath(),this.overlayCtx.arc(h,p,4,0,Math.PI*2),this.overlayCtx.fill()}}})}else{const r=o.getDiscretizedVertices(20);this.overlayCtx.strokeStyle="rgba(0, 255, 0, 0.3)",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath(),r.forEach((l,c)=>{const d=l.x*e,f=l.y*i;c===0?this.overlayCtx.moveTo(d,f):this.overlayCtx.lineTo(d,f)}),this.overlayCtx.closePath(),this.overlayCtx.stroke()}})};t(this.polygons)}this.isDrawing&&this.drawingVertices.length>0&&(this.overlayCtx.strokeStyle="#ffff00",this.overlayCtx.lineWidth=2,this.overlayCtx.beginPath(),this.drawingVertices.forEach((t,s)=>{const o=t.x*e,r=t.y*i;s===0?this.overlayCtx.moveTo(o,r):this.overlayCtx.lineTo(o,r)}),this.overlayCtx.stroke(),this.drawingVertices.forEach((t,s)=>{const o=t.x*e,r=t.y*i;s===0?(this.overlayCtx.fillStyle="#ff0000",this.overlayCtx.beginPath(),this.overlayCtx.arc(o,r,8,0,Math.PI*2),this.overlayCtx.fill(),this.overlayCtx.strokeStyle="#ffffff",this.overlayCtx.lineWidth=2,this.overlayCtx.stroke()):(this.overlayCtx.fillStyle="#ffff00",this.overlayCtx.beginPath(),this.overlayCtx.arc(o,r,4,0,Math.PI*2),this.overlayCtx.fill())})),requestAnimationFrame(()=>this.animate())}handleDragStart(e,i){this.dragTimeout=setTimeout(()=>{this.draggingLayer=i,this.dragStartY=e.clientY,this.dragGhost=document.createElement("div"),this.dragGhost.className="layer-drag-ghost";const t=i.id?i.id.toString():"0000";this.dragGhost.textContent=`Moving: ${i.type} ${t.slice(-4)}`,document.body.appendChild(this.dragGhost),this.updateDragGhost(e.clientY),this.showStatus("Dragging Layer...")},300)}handleDragMove(e){if(this.dragTimeout&&!this.draggingLayer&&Math.abs(e.clientY-this.dragStartY)>10&&(clearTimeout(this.dragTimeout),this.dragTimeout=null),this.draggingLayer&&this.dragGhost){e.preventDefault(),this.updateDragGhost(e.clientY),document.querySelectorAll(".layer-item").forEach(o=>o.classList.remove("drag-over","drag-over-top","drag-over-bottom"));let t=null;if(t=document.elementsFromPoint(e.clientX,e.clientY).find(o=>o.classList.contains("layer-item"))||null,t){const o=t.getBoundingClientRect(),r=e.clientY-o.top;r<o.height*.25?t.classList.add("drag-over-top"):r>o.height*.75?t.classList.add("drag-over-bottom"):t.classList.add("drag-over")}}}handleDragEnd(e){if(this.dragTimeout&&clearTimeout(this.dragTimeout),this.draggingLayer){const t=document.elementsFromPoint(e.clientX,e.clientY).find(s=>s.classList.contains("layer-item"));if(t){const s=parseFloat(t.getAttribute("data-id")||"-1");this.performLayerDrop(s,e.clientY,t.getBoundingClientRect())}this.draggingLayer=null,this.dragGhost&&(this.dragGhost.remove(),this.dragGhost=null),document.querySelectorAll(".layer-item").forEach(s=>s.classList.remove("drag-over","drag-over-top","drag-over-bottom"))}}updateDragGhost(e){this.dragGhost&&(this.dragGhost.style.top=`${e}px`,this.dragGhost.style.left="60px")}performLayerDrop(e,i,t){if(e===-1||!this.draggingLayer||e===this.draggingLayer.id)return;const s=this.findPolygonById(e);if(!s)return;this.removePolygonFromTree(this.draggingLayer);const o=i-t.top,r=t.height;if(o>r*.25&&o<r*.75)s.children.push(this.draggingLayer),this.draggingLayer.parent=s;else{this.draggingLayer.parent=null;let l=this.polygons;s.parent&&(l=s.parent.children,this.draggingLayer.parent=s.parent);const c=l.indexOf(s);o<=r*.25?l.splice(c+1,0,this.draggingLayer):l.splice(c,0,this.draggingLayer)}this.renderLayersList()}findPolygonById(e){const i=[...this.polygons];for(;i.length>0;){const t=i.shift();if(t.id===e)return t;t.children&&i.push(...t.children)}return null}removePolygonFromTree(e){if(e.parent){const i=e.parent.children.indexOf(e);i>=0&&e.parent.children.splice(i,1)}else{const i=this.polygons.indexOf(e);i>=0&&this.polygons.splice(i,1)}}renderLayersList(){const e=u("layersListContainer");if(!e)return;if(e.innerHTML="",this.polygons.length===0){e.innerHTML='<div style="padding:8px; opacity:0.5; font-size:12px;">No shapes added</div>';return}const i=(t,s,o)=>{const r=document.createElement("div");r.className="layer-item",r.setAttribute("data-id",t.id.toString()),r.style.padding="8px",r.style.paddingLeft=`${8+o*20}px`,r.style.borderBottom="1px solid rgba(255,255,255,0.1)",r.style.cursor="pointer",r.style.backgroundColor=t.selected?"rgba(0,255,157,0.2)":"transparent",r.style.display="flex",r.style.justifyContent="space-between",r.style.alignItems="center",r.style.userSelect="none",r.style.touchAction="none";const c=o>0?"🎭 ":"",d=document.createElement("span"),f=t.id?t.id.toString():"0000",a=f.length>4?f.slice(-4):f;d.textContent=`${c}Shape ${a} (${t.type})`,d.style.fontSize="12px",r.appendChild(d),r.addEventListener("click",h=>{h.stopPropagation(),this.selectPolygon(t),this.setTool("select")}),r.addEventListener("pointerdown",h=>{h.isPrimary&&(r.setPointerCapture(h.pointerId),this.dragStartY=h.clientY,this.handleDragStart(h,t))}),r.addEventListener("pointermove",h=>{this.draggingLayer&&this.handleDragMove(h)}),r.addEventListener("pointerup",h=>{r.releasePointerCapture(h.pointerId),this.handleDragEnd(h)}),e.appendChild(r),t.children&&t.children.length>0&&[...t.children].reverse().forEach((h,p)=>i(h,p,o+1))};[...this.polygons].reverse().forEach((t,s)=>{i(t,s,0)})}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{window.app=new ie}):window.app=new ie;
