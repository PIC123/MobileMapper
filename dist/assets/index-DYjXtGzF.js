var se=Object.defineProperty;var ne=(r,e,o)=>e in r?se(r,e,{enumerable:!0,configurable:!0,writable:!0,value:o}):r[e]=o;var u=(r,e,o)=>ne(r,typeof e!="symbol"?e+"":e,o);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))t(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const n of s.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&t(n)}).observe(document,{childList:!0,subtree:!0});function o(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function t(i){if(i.ep)return;i.ep=!0;const s=o(i);fetch(i.href,s)}})();const re=`
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`,L=`
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
`,_=`
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
`,T=`
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
`,X=`
    precision mediump float;
    uniform sampler2D u_texture;
    uniform float u_time;
    varying vec2 v_texCoord;
    
    ${L}
    ${_}
    ${T}

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
`,J={rainbow:{name:"Rainbow",fragment:`
            precision mediump float;
            uniform float u_time;
            varying vec2 v_texCoord;
            
            ${L}
            ${_}
            
            vec3 custom_hsv2rgb(vec3 c) { 
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            ${T}

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

            ${L}
            ${_}
            ${T}

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

            ${L}
            ${_}
            ${T}

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

            ${L}
            ${_}
            ${T}

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

            ${L}
            ${_}
            ${T}

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

            ${L}
            ${_}
            ${T}

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

            ${L}
            ${_}
            ${T}

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
      `}};function ae(r,e,o=2){const t=r.length;let i=le(r,0,t,o,!0);const s=[];if(!i||i.next===i.prev)return s;let n,a,l;if(r.length>80*o){n=r[0],a=r[1];let c=n,h=a;for(let d=o;d<t;d+=o){const y=r[d],x=r[d+1];y<n&&(n=y),x<a&&(a=x),y>c&&(c=y),x>h&&(h=x)}l=Math.max(c-n,h-a),l=l!==0?32767/l:0}return U(i,s,o,n,a,l,0),s}function le(r,e,o,t,i){let s;if(i===Ee(r,e,o,t)>0)for(let n=e;n<o;n+=t)s=Q(n/t|0,r[n],r[n+1],s);else for(let n=o-t;n>=e;n-=t)s=Q(n/t|0,r[n],r[n+1],s);return s&&G(s,s.next)&&(R(s),s=s.next),s}function D(r,e){if(!r)return r;e||(e=r);let o=r,t;do if(t=!1,!o.steiner&&(G(o,o.next)||E(o.prev,o,o.next)===0)){if(R(o),o=e=o.prev,o===o.next)break;t=!0}else o=o.next;while(t||o!==e);return e}function U(r,e,o,t,i,s,n){if(!r)return;!n&&s&&fe(r,t,i,s);let a=r;for(;r.prev!==r.next;){const l=r.prev,c=r.next;if(s?de(r,t,i,s):ce(r)){e.push(l.i,r.i,c.i),R(r),r=c.next,a=c.next;continue}if(r=c,r===a){n?n===1?(r=ue(D(r),e),U(r,e,o,t,i,s,2)):n===2&&he(r,e,o,t,i,s):U(D(r),e,o,t,i,s,1);break}}}function ce(r){const e=r.prev,o=r,t=r.next;if(E(e,o,t)>=0)return!1;const i=e.x,s=o.x,n=t.x,a=e.y,l=o.y,c=t.y,h=Math.min(i,s,n),d=Math.min(a,l,c),y=Math.max(i,s,n),x=Math.max(a,l,c);let f=t.next;for(;f!==e;){if(f.x>=h&&f.x<=y&&f.y>=d&&f.y<=x&&F(i,a,s,l,n,c,f.x,f.y)&&E(f.prev,f,f.next)>=0)return!1;f=f.next}return!0}function de(r,e,o,t){const i=r.prev,s=r,n=r.next;if(E(i,s,n)>=0)return!1;const a=i.x,l=s.x,c=n.x,h=i.y,d=s.y,y=n.y,x=Math.min(a,l,c),f=Math.min(h,d,y),C=Math.max(a,l,c),S=Math.max(h,d,y),I=q(x,f,e,o,t),A=q(C,S,e,o,t);let g=r.prevZ,v=r.nextZ;for(;g&&g.z>=I&&v&&v.z<=A;){if(g.x>=x&&g.x<=C&&g.y>=f&&g.y<=S&&g!==i&&g!==n&&F(a,h,l,d,c,y,g.x,g.y)&&E(g.prev,g,g.next)>=0||(g=g.prevZ,v.x>=x&&v.x<=C&&v.y>=f&&v.y<=S&&v!==i&&v!==n&&F(a,h,l,d,c,y,v.x,v.y)&&E(v.prev,v,v.next)>=0))return!1;v=v.nextZ}for(;g&&g.z>=I;){if(g.x>=x&&g.x<=C&&g.y>=f&&g.y<=S&&g!==i&&g!==n&&F(a,h,l,d,c,y,g.x,g.y)&&E(g.prev,g,g.next)>=0)return!1;g=g.prevZ}for(;v&&v.z<=A;){if(v.x>=x&&v.x<=C&&v.y>=f&&v.y<=S&&v!==i&&v!==n&&F(a,h,l,d,c,y,v.x,v.y)&&E(v.prev,v,v.next)>=0)return!1;v=v.nextZ}return!0}function ue(r,e){let o=r;do{const t=o.prev,i=o.next.next;!G(t,i)&&ee(t,o,o.next,i)&&Z(t,i)&&Z(i,t)&&(e.push(t.i,o.i,i.i),R(o),R(o.next),o=r=i),o=o.next}while(o!==r);return D(o)}function he(r,e,o,t,i,s){let n=r;do{let a=n.next.next;for(;a!==n.prev;){if(n.i!==a.i&&me(n,a)){let l=xe(n,a);n=D(n,n.next),l=D(l,l.next),U(n,e,o,t,i,s,0),U(l,e,o,t,i,s,0);return}a=a.next}n=n.next}while(n!==r)}function fe(r,e,o,t){let i=r;do i.z===0&&(i.z=q(i.x,i.y,e,o,t)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next;while(i!==r);i.prevZ.nextZ=null,i.prevZ=null,ge(i)}function ge(r){let e,o=1;do{let t=r,i;r=null;let s=null;for(e=0;t;){e++;let n=t,a=0;for(let c=0;c<o&&(a++,n=n.nextZ,!!n);c++);let l=o;for(;a>0||l>0&&n;)a!==0&&(l===0||!n||t.z<=n.z)?(i=t,t=t.nextZ,a--):(i=n,n=n.nextZ,l--),s?s.nextZ=i:r=i,i.prevZ=s,s=i;t=n}s.nextZ=null,o*=2}while(e>1);return r}function q(r,e,o,t,i){return r=(r-o)*i|0,e=(e-t)*i|0,r=(r|r<<8)&16711935,r=(r|r<<4)&252645135,r=(r|r<<2)&858993459,r=(r|r<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,r|e<<1}function ve(r,e,o,t,i,s,n,a){return(i-n)*(e-a)>=(r-n)*(s-a)&&(r-n)*(t-a)>=(o-n)*(e-a)&&(o-n)*(s-a)>=(i-n)*(t-a)}function F(r,e,o,t,i,s,n,a){return!(r===n&&e===a)&&ve(r,e,o,t,i,s,n,a)}function me(r,e){return r.next.i!==e.i&&r.prev.i!==e.i&&!ye(r,e)&&(Z(r,e)&&Z(e,r)&&pe(r,e)&&(E(r.prev,r,e.prev)||E(r,e.prev,e))||G(r,e)&&E(r.prev,r,r.next)>0&&E(e.prev,e,e.next)>0)}function E(r,e,o){return(e.y-r.y)*(o.x-e.x)-(e.x-r.x)*(o.y-e.y)}function G(r,e){return r.x===e.x&&r.y===e.y}function ee(r,e,o,t){const i=H(E(r,e,o)),s=H(E(r,e,t)),n=H(E(o,t,r)),a=H(E(o,t,e));return!!(i!==s&&n!==a||i===0&&$(r,o,e)||s===0&&$(r,t,e)||n===0&&$(o,r,t)||a===0&&$(o,e,t))}function $(r,e,o){return e.x<=Math.max(r.x,o.x)&&e.x>=Math.min(r.x,o.x)&&e.y<=Math.max(r.y,o.y)&&e.y>=Math.min(r.y,o.y)}function H(r){return r>0?1:r<0?-1:0}function ye(r,e){let o=r;do{if(o.i!==r.i&&o.next.i!==r.i&&o.i!==e.i&&o.next.i!==e.i&&ee(o,o.next,r,e))return!0;o=o.next}while(o!==r);return!1}function Z(r,e){return E(r.prev,r,r.next)<0?E(r,e,r.next)>=0&&E(r,r.prev,e)>=0:E(r,e,r.prev)<0||E(r,r.next,e)<0}function pe(r,e){let o=r,t=!1;const i=(r.x+e.x)/2,s=(r.y+e.y)/2;do o.y>s!=o.next.y>s&&o.next.y!==o.y&&i<(o.next.x-o.x)*(s-o.y)/(o.next.y-o.y)+o.x&&(t=!t),o=o.next;while(o!==r);return t}function xe(r,e){const o=K(r.i,r.x,r.y),t=K(e.i,e.x,e.y),i=r.next,s=e.prev;return r.next=e,e.prev=r,o.next=i,i.prev=o,t.next=o,o.prev=t,s.next=t,t.prev=s,t}function Q(r,e,o,t){const i=K(r,e,o);return t?(i.next=t.next,i.prev=t,t.next.prev=i,t.next=i):(i.prev=i,i.next=i),i}function R(r){r.next.prev=r.prev,r.prev.next=r.next,r.prevZ&&(r.prevZ.nextZ=r.nextZ),r.nextZ&&(r.nextZ.prevZ=r.prevZ)}function K(r,e,o){return{i:r,x:e,y:o,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function Ee(r,e,o,t){let i=0;for(let s=e,n=o-t;s<o;s+=t)i+=(r[n]-r[s])*(r[s+1]+r[n+1]),n=s;return i}class Ce{constructor(e){u(this,"canvas");u(this,"gl");u(this,"programCache");u(this,"shaderCache");u(this,"videoTextures");u(this,"startTime");u(this,"audioData");u(this,"maskFramebuffer");u(this,"maskTexture");this.canvas=e,this.gl=e.getContext("webgl",{alpha:!0}),this.programCache=new Map,this.shaderCache=new Map,this.videoTextures=new Map,this.startTime=Date.now(),this.audioData={low:0,mid:0,high:0,level:0},this.maskFramebuffer=null,this.maskTexture=null,this.resize(),window.addEventListener("resize",()=>this.resize())}resize(){const e=this.canvas.clientWidth,o=this.canvas.clientHeight;(this.canvas.width!==e||this.canvas.height!==o)&&(this.canvas.width=e,this.canvas.height=o,this.gl.viewport(0,0,this.canvas.width,this.canvas.height),this.initMaskBuffer())}initMaskBuffer(){const e=this.gl,o=this.canvas.width,t=this.canvas.height;this.maskTexture&&e.deleteTexture(this.maskTexture),this.maskFramebuffer&&e.deleteFramebuffer(this.maskFramebuffer),this.maskTexture=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.maskTexture),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,o,t,0,e.RGBA,e.UNSIGNED_BYTE,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),this.maskFramebuffer=e.createFramebuffer(),e.bindFramebuffer(e.FRAMEBUFFER,this.maskFramebuffer),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.maskTexture,0),e.bindFramebuffer(e.FRAMEBUFFER,null)}updateAudioData(e){this.audioData=e}createShader(e,o,t){const i=e.createShader(o);return e.shaderSource(i,t),e.compileShader(i),e.getShaderParameter(i,e.COMPILE_STATUS)?i:(console.error("Shader compile error:",e.getShaderInfoLog(i)),e.deleteShader(i),null)}createProgram(e,o,t){const i=this.createShader(e,e.VERTEX_SHADER,o),s=this.createShader(e,e.FRAGMENT_SHADER,t),n=e.createProgram();return e.attachShader(n,i),e.attachShader(n,s),e.linkProgram(n),e.getProgramParameter(n,e.LINK_STATUS)?n:(console.error("Program link error:",e.getProgramInfoLog(n)),null)}getProgramInfo(e,o){if(this.shaderCache.has(e))return this.shaderCache.get(e);const t=this.gl,i=this.createProgram(t,re,o);if(!i)return null;const s={program:i,attribLocations:{position:t.getAttribLocation(i,"a_position"),texCoord:t.getAttribLocation(i,"a_texCoord")},uniformLocations:{resolution:t.getUniformLocation(i,"u_resolution"),time:t.getUniformLocation(i,"u_time"),texture:t.getUniformLocation(i,"u_texture"),brightness:t.getUniformLocation(i,"u_brightness"),contrast:t.getUniformLocation(i,"u_contrast"),saturation:t.getUniformLocation(i,"u_saturation"),hue:t.getUniformLocation(i,"u_hue"),patternMode:t.getUniformLocation(i,"u_patternMode"),patternScale:t.getUniformLocation(i,"u_patternScale"),patternIntensity:t.getUniformLocation(i,"u_patternIntensity"),patternSpeed:t.getUniformLocation(i,"u_patternSpeed"),enableBorder:t.getUniformLocation(i,"u_enableBorder"),borderWidth:t.getUniformLocation(i,"u_borderWidth"),borderColor:t.getUniformLocation(i,"u_borderColor"),borderSpeed:t.getUniformLocation(i,"u_borderSpeed"),audioLow:t.getUniformLocation(i,"u_audioLow"),audioMid:t.getUniformLocation(i,"u_audioMid"),audioHigh:t.getUniformLocation(i,"u_audioHigh"),audioLevel:t.getUniformLocation(i,"u_audioLevel"),audioBassScale:t.getUniformLocation(i,"u_audioBassScale"),audioMidScale:t.getUniformLocation(i,"u_audioMidScale"),audioHighScale:t.getUniformLocation(i,"u_audioHighScale"),audioGain:t.getUniformLocation(i,"u_audioGain"),useMask:t.getUniformLocation(i,"u_useMask"),maskTexture:t.getUniformLocation(i,"u_maskTexture")}};return this.shaderCache.set(e,s),s}renderPolygon(e,o=!1){const t=this.gl;let i;if(o&&e.useAsMask&&!e.drawingCanvas)return;if(e.contentType==="video"||e.contentType==="drawing")i=this.getProgramInfo("video",X);else if(o)i=this.getProgramInfo("video",X);else{const m=J[e.shaderType]||J.rainbow;i=this.getProgramInfo(e.shaderType,m.fragment)}if(!i)return;t.useProgram(i.program);const s=[],n=[];if(e.warpMode&&e.gridVertices.length>0){const m=e.gridSize;for(let p=0;p<m-1;p++)for(let w=0;w<m-1;w++){const P=p*m+w,B=p*m+w+1,b=(p+1)*m+w,k=(p+1)*m+w+1;this.addTriangleToBuffers(s,n,e.gridVertices,P,B,b,m,w,p,0),this.addTriangleToBuffers(s,n,e.gridVertices,B,k,b,m,w,p,1)}}else{const m=e.getDiscretizedVertices(20),p=[];m.forEach(b=>p.push(b.x,b.y));const w=ae(p),P=e.getBoundingBox(),B=(b,k)=>[(b-P.minX)/P.width,(k-P.minY)/P.height];for(let b=0;b<w.length;b+=3){const k=w[b],ie=w[b+1],oe=w[b+2],O=m[k],j=m[ie],N=m[oe];s.push(O.x*2-1,-(O.y*2-1)),s.push(j.x*2-1,-(j.y*2-1)),s.push(N.x*2-1,-(N.y*2-1)),n.push(...B(O.x,O.y)),n.push(...B(j.x,j.y)),n.push(...B(N.x,N.y))}}const a=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,a),t.bufferData(t.ARRAY_BUFFER,new Float32Array(s),t.STATIC_DRAW),t.enableVertexAttribArray(i.attribLocations.position),t.vertexAttribPointer(i.attribLocations.position,2,t.FLOAT,!1,0,0);const l=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,l),t.bufferData(t.ARRAY_BUFFER,new Float32Array(n),t.STATIC_DRAW),t.enableVertexAttribArray(i.attribLocations.texCoord),t.vertexAttribPointer(i.attribLocations.texCoord,2,t.FLOAT,!1,0,0);let c=0,h=1,d=1,y=0,x=0,f=10,C=0,S=1,I=0,A=0,g={r:1,g:1,b:1},v=0;o||e.effects.forEach(m=>{const p=m.params;m.type==="brightness"&&(c+=p.value),m.type==="contrast"&&(h*=p.value),m.type==="saturation"&&(d*=p.value),m.type==="hue"&&(y+=p.value),["scanlines","dots","grid"].includes(m.type)&&(x=m.type==="scanlines"?1:m.type==="dots"?2:3,f=p.scale,C=p.intensity,S=p.speed||1),m.type==="border"&&(I=1,A=p.width,p.color&&(g=p.color),v=p.speed||0)}),t.uniform1f(i.uniformLocations.brightness,c),t.uniform1f(i.uniformLocations.contrast,h),t.uniform1f(i.uniformLocations.saturation,d),t.uniform1f(i.uniformLocations.hue,y),t.uniform1i(i.uniformLocations.patternMode,x),t.uniform1f(i.uniformLocations.patternScale,f),t.uniform1f(i.uniformLocations.patternIntensity,C),t.uniform1f(i.uniformLocations.patternSpeed,S),t.uniform1i(i.uniformLocations.enableBorder,I),t.uniform1f(i.uniformLocations.borderWidth,A),t.uniform1f(i.uniformLocations.borderSpeed,v),g&&t.uniform3f(i.uniformLocations.borderColor,g.r,g.g,g.b),t.uniform1f(i.uniformLocations.audioLow,this.audioData.low),t.uniform1f(i.uniformLocations.audioMid,this.audioData.mid),t.uniform1f(i.uniformLocations.audioHigh,this.audioData.high),t.uniform1f(i.uniformLocations.audioLevel,this.audioData.level);const V=e.audioSettings||{bassScale:1,midScale:1,highScale:1,gain:1,enabled:!0},z=V.enabled?1:0;t.uniform1f(i.uniformLocations.audioBassScale,V.bassScale*z),t.uniform1f(i.uniformLocations.audioMidScale,V.midScale*z),t.uniform1f(i.uniformLocations.audioHighScale,V.highScale*z),t.uniform1f(i.uniformLocations.audioGain,V.gain*z);const te=(Date.now()-this.startTime)/1e3;if(t.uniform1f(i.uniformLocations.time,te),o?t.uniform1i(i.uniformLocations.useMask,0):(t.uniform1i(i.uniformLocations.useMask,1),t.uniform1i(i.uniformLocations.maskTexture,1)),e.contentType==="video"&&e.videoElement||e.contentType==="drawing"&&e.drawingCanvas){let m=this.videoTextures.get(e.id);m||(m=t.createTexture(),this.videoTextures.set(e.id,m)),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,m);const p=e.contentType==="video"?e.videoElement:e.drawingCanvas;t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,p),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.uniform1i(i.uniformLocations.texture,0)}t.uniform2f(i.uniformLocations.resolution,this.canvas.width,this.canvas.height),t.drawArrays(t.TRIANGLES,0,s.length/2),t.deleteBuffer(a),t.deleteBuffer(l)}addTriangleToBuffers(e,o,t,i,s,n,a,l,c,h){const d=t[i],y=t[s],x=t[n];e.push(d.x*2-1,-(d.y*2-1)),e.push(y.x*2-1,-(y.y*2-1)),e.push(x.x*2-1,-(x.y*2-1));const f=a-1,C=l/f,S=c/f;h===0?(o.push(C,S),o.push((l+1)/f,S),o.push(C,(c+1)/f)):(o.push((l+1)/f,S),o.push((l+1)/f,(c+1)/f),o.push(C,(c+1)/f))}render(e,o){const t=this.gl,i=e.filter(s=>s.type==="drawing"&&s.useAsMask);t.bindFramebuffer(t.FRAMEBUFFER,this.maskFramebuffer),t.viewport(0,0,this.canvas.width,this.canvas.height),t.clearColor(1,1,1,1),t.clear(t.COLOR_BUFFER_BIT),i.length>0&&i.forEach(s=>{if(!s.drawingCanvas)return;t.blendFuncSeparate(t.ZERO,t.ONE_MINUS_SRC_ALPHA,t.ZERO,t.ONE_MINUS_SRC_ALPHA),t.enable(t.BLEND);const n=s.shaderType,a=s.contentType;s.contentType="shader",s.shaderType="solid",t.blendFunc(t.ZERO,t.ONE_MINUS_SRC_ALPHA),this.renderPolygon(s,!0),s.contentType=a,s.shaderType=n,t.blendFunc(t.ONE,t.ONE),this.renderPolygon(s,!0)}),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),t.bindFramebuffer(t.FRAMEBUFFER,null),t.viewport(0,0,this.canvas.width,this.canvas.height),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),t.activeTexture(t.TEXTURE1),t.bindTexture(t.TEXTURE_2D,this.maskTexture),e.forEach(s=>{s.useAsMask||this.renderPolygon(s,!1)})}}class M{constructor(e,o=null,t="polygon"){u(this,"id");u(this,"vertices");u(this,"type");u(this,"contentType");u(this,"shaderType");u(this,"videoSrc");u(this,"videoElement");u(this,"selected");u(this,"effects");u(this,"warpMode");u(this,"gridVertices");u(this,"gridSize");u(this,"audioSettings");u(this,"drawingCanvas");u(this,"drawingCtx");u(this,"isDirty");u(this,"useAsMask");this.id=o||Date.now()+Math.random(),this.vertices=e,this.type=t,this.contentType="shader",this.shaderType="rainbow",this.videoSrc=null,this.videoElement=null,this.selected=!1,this.effects=[],this.warpMode=!1,this.gridVertices=[],this.gridSize=3,this.audioSettings={bassScale:1,midScale:1,highScale:1,gain:1,enabled:!0},this.drawingCanvas=null,this.drawingCtx=null,this.isDirty=!1,this.useAsMask=!1,t==="drawing"&&this.initDrawingCanvas()}initDrawingCanvas(){this.drawingCanvas=document.createElement("canvas"),this.drawingCanvas.width=1024,this.drawingCanvas.height=1024,this.drawingCtx=this.drawingCanvas.getContext("2d"),this.contentType="drawing",this.isDirty=!0}createGrid(){const e=this.getBoundingBox();this.gridVertices=[];for(let o=0;o<this.gridSize;o++)for(let t=0;t<this.gridSize;t++)this.gridVertices.push({x:e.minX+t/(this.gridSize-1)*e.width,y:e.minY+o/(this.gridSize-1)*e.height})}toggleWarpMode(){this.warpMode=!this.warpMode,this.warpMode&&this.gridVertices.length===0&&this.createGrid()}addEffect(e){const o=Date.now().toString();let t={};e==="brightness"?t={value:0}:e==="contrast"?t={value:1}:e==="saturation"?t={value:1}:e==="hue"?t={value:0}:["scanlines","dots","grid"].includes(e)?t={scale:10,intensity:.5,speed:1}:e==="border"&&(t={width:.02,color:{r:1,g:1,b:1},speed:2}),this.effects.push({id:o,type:e,params:t})}removeEffect(e){this.effects=this.effects.filter(o=>o.id!==e)}updateEffect(e,o){const t=this.effects.find(i=>i.id===e);t&&(t.params={...t.params,...o})}setContent(e,o){this.contentType=e,e==="shader"?this.shaderType=o:e==="video"&&(this.videoSrc=o,this.loadVideo())}loadVideo(){this.videoSrc&&(this.videoElement=document.createElement("video"),this.videoElement.src=this.videoSrc,this.videoElement.loop=!0,this.videoElement.muted=!0,this.videoElement.play().catch(e=>console.warn("Video play failed",e)))}getBoundingBox(){let e=1/0,o=-1/0,t=1/0,i=-1/0;return(this.warpMode&&this.gridVertices.length>0?this.gridVertices:this.vertices).forEach(n=>{n.x<e&&(e=n.x),n.x>o&&(o=n.x),n.y<t&&(t=n.y),n.y>i&&(i=n.y)}),e===1/0?{minX:0,minY:0,maxX:1,maxY:1,width:1,height:1}:{minX:e,minY:t,maxX:o,maxY:i,width:o-e,height:i-t}}getDiscretizedVertices(e=10){const o=[];for(let t=0;t<this.vertices.length;t++){const i=this.vertices[t],s=this.vertices[(t+1)%this.vertices.length];if(i.bezier&&i.c2&&s.c1)for(let n=0;n<1;n+=1/e){const a=Math.pow(1-n,3)*i.x+3*Math.pow(1-n,2)*n*i.c2.x+3*(1-n)*Math.pow(n,2)*s.c1.x+Math.pow(n,3)*s.x,l=Math.pow(1-n,3)*i.y+3*Math.pow(1-n,2)*n*i.c2.y+3*(1-n)*Math.pow(n,2)*s.c1.y+Math.pow(n,3)*s.y;o.push({x:a,y:l})}else o.push(i)}return o}getRenderVertices(){return this.warpMode?this.gridVertices:this.vertices}containsPoint(e,o){let t=!1;const i=this.getDiscretizedVertices(10);for(let s=0,n=i.length-1;s<i.length;n=s++){const a=i[s].x,l=i[s].y,c=i[n].x,h=i[n].y;l>o!=h>o&&e<(c-a)*(o-l)/(h-l)+a&&(t=!t)}return t}getVertexAtPoint(e,o,t=.02){if(this.warpMode){for(let i=0;i<this.gridVertices.length;i++){const s=this.gridVertices[i];if(Math.sqrt((s.x-e)**2+(s.y-o)**2)<t)return{type:"grid",index:i}}return null}for(let i=0;i<this.vertices.length;i++){const s=this.vertices[i];if(Math.sqrt((s.x-e)**2+(s.y-o)**2)<t)return{type:"vertex",index:i};if(s.bezier){if(s.c1&&Math.sqrt((s.c1.x-e)**2+(s.c1.y-o)**2)<t)return{type:"c1",index:i};if(s.c2&&Math.sqrt((s.c2.x-e)**2+(s.c2.y-o)**2)<t)return{type:"c2",index:i}}}return null}moveVertex(e,o,t){if(e.type==="grid")this.gridVertices[e.index].x=o,this.gridVertices[e.index].y=t;else if(e.type==="vertex"){const i=this.vertices[e.index],s=o-i.x,n=t-i.y;i.x=o,i.y=t,i.c1&&(i.c1.x+=s,i.c1.y+=n),i.c2&&(i.c2.x+=s,i.c2.y+=n)}else e.type==="c1"?this.vertices[e.index].c1={x:o,y:t}:e.type==="c2"&&(this.vertices[e.index].c2={x:o,y:t})}translate(e,o){this.vertices.forEach(t=>{t.x+=e,t.y+=o,t.c1&&(t.c1.x+=e,t.c1.y+=o),t.c2&&(t.c2.x+=e,t.c2.y+=o)}),this.warpMode&&this.gridVertices.forEach(t=>{t.x+=e,t.y+=o})}toJSON(){return{id:this.id,vertices:this.vertices,type:this.type,contentType:this.contentType,shaderType:this.shaderType,videoSrc:this.videoSrc,effects:this.effects,warpMode:this.warpMode,gridVertices:this.gridVertices,audioSettings:this.audioSettings,useAsMask:this.useAsMask,drawingData:this.drawingCanvas?this.drawingCanvas.toDataURL():null}}static fromJSON(e){const o=new M(e.vertices,e.id,e.type);if(o.contentType=e.contentType,o.shaderType=e.shaderType,o.videoSrc=e.videoSrc,o.useAsMask=e.useAsMask||!1,o.effects=e.effects||[],o.warpMode=e.warpMode||!1,o.gridVertices=e.gridVertices||[],o.audioSettings=e.audioSettings||{bassScale:1,midScale:1,highScale:1,gain:1,enabled:!0},o.videoSrc&&o.loadVideo(),e.type==="drawing"&&e.drawingData){o.initDrawingCanvas();const t=new Image;t.onload=()=>{o.drawingCtx.drawImage(t,0,0),o.isDirty=!0},t.src=e.drawingData}return o}}class W{static createTriangle(e,o,t=.15){const i=t*Math.sqrt(3)/2;return new M([{x:e,y:o-i*.66},{x:e-t/2,y:o+i*.33},{x:e+t/2,y:o+i*.33}],null,"triangle")}static createSquare(e,o,t=.15){const i=t/2;return new M([{x:e-i,y:o-i},{x:e+i,y:o-i},{x:e+i,y:o+i},{x:e-i,y:o+i}],null,"quad")}static createCanvas(e,o,t=.5){const i=t/2;return new M([{x:e-i,y:o-i},{x:e+i,y:o-i},{x:e+i,y:o+i},{x:e-i,y:o+i}],null,"drawing")}static createCircle(e,o,t=.15){const i=t/2,s=i*.55228,n={x:e,y:o-i,c1:{x:e-s,y:o-i},c2:{x:e+s,y:o-i},bezier:!0},a={x:e+i,y:o,c1:{x:e+i,y:o-s},c2:{x:e+i,y:o+s},bezier:!0},l={x:e,y:o+i,c1:{x:e+s,y:o+i},c2:{x:e-s,y:o+i},bezier:!0},c={x:e-i,y:o,c1:{x:e-i,y:o+s},c2:{x:e-i,y:o-s},bezier:!0};return new M([n,a,l,c],null,"circle")}}class Se{constructor(){u(this,"audioContext");u(this,"analyser");u(this,"source");u(this,"dataArray");u(this,"isActive");u(this,"stream");this.audioContext=null,this.analyser=null,this.source=null,this.dataArray=null,this.isActive=!1,this.stream=null}async start(){if(!this.isActive)try{this.stream=await navigator.mediaDevices.getUserMedia({audio:!0}),this.audioContext=new(window.AudioContext||window.webkitAudioContext),this.analyser=this.audioContext.createAnalyser(),this.analyser.fftSize=256,this.source=this.audioContext.createMediaStreamSource(this.stream),this.source.connect(this.analyser),this.dataArray=new Uint8Array(this.analyser.frequencyBinCount),this.isActive=!0,console.log("Audio analysis started")}catch(e){console.error("Error accessing microphone:",e),alert("Could not access microphone. Please ensure you have granted permission.")}}stop(){this.isActive&&(this.stream&&this.stream.getTracks().forEach(e=>e.stop()),this.audioContext&&this.audioContext.close(),this.isActive=!1,this.audioContext=null,this.analyser=null,this.source=null)}getAudioData(){if(!this.isActive||!this.analyser||!this.dataArray)return{low:0,mid:0,high:0,level:0};this.analyser.getByteFrequencyData(this.dataArray);const e=this.analyser.frequencyBinCount,o=Math.floor(e*.1),t=Math.floor(e*.5);let i=0,s=0,n=0;for(let l=0;l<e;l++){const c=this.dataArray[l]/255;l<o?i+=c:l<t?s+=c:n+=c}i/=o,s/=t-o,n/=e-t;const a=(i+s+n)/3;return{low:i,mid:s,high:n,level:a}}}class Y{constructor(){u(this,"canvas");u(this,"overlayCanvas");u(this,"overlayCtx");u(this,"renderer");u(this,"audioManager");u(this,"polygons");u(this,"selectedPolygon");u(this,"selectedVertex");u(this,"currentTool");u(this,"drawingVertices");u(this,"isDrawing");u(this,"dragStart");u(this,"editMode");u(this,"loadedVideos");u(this,"controlsDragStart");u(this,"controlsPosition");u(this,"uiVisible");u(this,"userHasToggledMode");u(this,"lastBrushPos",null);this.canvas=document.getElementById("mainCanvas"),this.overlayCanvas=document.getElementById("overlayCanvas"),this.overlayCtx=this.overlayCanvas.getContext("2d"),this.renderer=new Ce(this.canvas),this.audioManager=new Se,this.polygons=[],this.selectedPolygon=null,this.selectedVertex=null,this.currentTool="select",this.drawingVertices=[],this.isDrawing=!1,this.dragStart=null,this.editMode=!0,this.loadedVideos=new Map,this.controlsDragStart=null,this.controlsPosition={x:null,y:null},this.uiVisible=!0,this.userHasToggledMode=!1,this.setupEventListeners(),this.resizeOverlay(),window.addEventListener("resize",()=>{this.resizeOverlay()}),this.animate(),this.showWelcomeModal()}resizeOverlay(){const e=this.overlayCanvas.clientWidth,o=this.overlayCanvas.clientHeight;(this.overlayCanvas.width!==e||this.overlayCanvas.height!==o)&&(this.overlayCanvas.width=e,this.overlayCanvas.height=o)}setupEventListeners(){var n;document.getElementById("toggleSidebarBtn").addEventListener("click",()=>{document.getElementById("leftSidebar").classList.toggle("hidden")}),document.querySelectorAll(".sidebar-section h3").forEach(a=>{a.style.cursor="pointer",a.addEventListener("click",l=>{const c=l.target.closest(".sidebar-section");c&&Array.from(c.children).forEach(h=>{if(h.tagName!=="H3"){const d=h;d.style.display=d.style.display==="none"?"":"none"}})})}),document.getElementById("addTriangleBtn").addEventListener("click",()=>this.setTool("triangle")),document.getElementById("addSquareBtn").addEventListener("click",()=>this.setTool("square")),document.getElementById("addCircleBtn").addEventListener("click",()=>this.setTool("circle")),document.getElementById("drawPolygonBtn").addEventListener("click",()=>this.setTool("draw")),document.getElementById("addCanvasBtn").addEventListener("click",()=>{const a=W.createCanvas(.5,.5);this.polygons.push(a),this.selectPolygon(a),this.setTool("brush")}),document.getElementById("selectBtn").addEventListener("click",()=>this.setTool("select")),document.getElementById("brushBtn").addEventListener("click",()=>this.setTool("brush")),document.getElementById("deleteBtn").addEventListener("click",()=>this.deleteSelected());const e=()=>{const a=parseInt(document.getElementById("brushSizeSlider").value),l=parseFloat(document.getElementById("brushOpacitySlider").value),c=document.getElementById("brushColorPicker").value,h=document.getElementById("eraserToggle").checked;return document.getElementById("brushSizeVal").textContent=a.toString(),document.getElementById("brushOpacityVal").textContent=l.toFixed(1),{size:a,opacity:l,color:c,eraser:h}};["brushSizeSlider","brushOpacitySlider","brushColorPicker","eraserToggle"].forEach(a=>{document.getElementById(a).addEventListener("input",e)}),document.getElementById("clearCanvasBtn").addEventListener("click",()=>{this.selectedPolygon&&this.selectedPolygon.type==="drawing"&&this.selectedPolygon.drawingCtx&&(this.selectedPolygon.drawingCtx.clearRect(0,0,1024,1024),this.selectedPolygon.isDirty=!0)}),document.getElementById("useAsMaskToggle").addEventListener("change",a=>{this.selectedPolygon&&this.selectedPolygon.type==="drawing"&&(this.selectedPolygon.useAsMask=a.target.checked)}),document.getElementById("changeContentBtn").addEventListener("click",()=>this.showContentModal()),document.getElementById("warpToggle").addEventListener("change",a=>this.toggleWarpMode(a.target.checked)),document.getElementById("audioEnabledToggle").addEventListener("change",a=>{this.selectedPolygon&&(this.selectedPolygon.audioSettings.enabled=a.target.checked)});const o=(a,l)=>{document.getElementById(a).addEventListener("input",h=>{this.selectedPolygon&&(this.selectedPolygon.audioSettings[l]=parseFloat(h.target.value))})};o("audioGainSlider","gain"),o("audioBassSlider","bassScale"),o("audioMidSlider","midScale"),o("audioHighSlider","highScale"),document.getElementById("addEffectBtn").addEventListener("click",()=>{const a=document.getElementById("effectTypeSelect").value;this.addEffect(a)}),document.getElementById("performanceBtn").addEventListener("click",()=>this.togglePerformanceMode()),document.getElementById("fullscreenBtn").addEventListener("click",()=>this.toggleFullscreen()),document.getElementById("saveBtn").addEventListener("click",()=>this.saveProject()),document.getElementById("loadBtn").addEventListener("click",()=>this.loadProjectDialog()),document.getElementById("audioToggleBtn").addEventListener("click",()=>this.toggleAudio()),this.canvas.addEventListener("touchstart",a=>this.handleTouchStart(a),{passive:!1}),this.canvas.addEventListener("touchmove",a=>this.handleTouchMove(a),{passive:!1}),this.canvas.addEventListener("touchend",a=>this.handleTouchEnd(a),{passive:!1}),this.canvas.addEventListener("mousedown",a=>this.handleMouseDown(a)),this.canvas.addEventListener("mousemove",a=>this.handleMouseMove(a)),this.canvas.addEventListener("mouseup",a=>this.handleMouseUp(a)),document.querySelectorAll(".arrow-btn").forEach(a=>{a.addEventListener("click",()=>this.finetuneVertex(a.dataset.dir))}),(n=document.getElementById("toggleCurveBtn"))==null||n.addEventListener("click",()=>this.toggleVertexCurve()),document.querySelectorAll(".close-modal").forEach(a=>{a.addEventListener("click",()=>this.hideAllModals())}),document.querySelectorAll(".content-type-btn").forEach(a=>{a.addEventListener("click",()=>{const l=a.dataset.type;l==="shader"?this.showShaderModal():l==="video"&&this.showVideoModal()})}),document.querySelectorAll(".shader-btn").forEach(a=>{a.addEventListener("click",()=>{this.setPolygonContent("shader",a.dataset.shader)})}),document.getElementById("videoFileInput").addEventListener("change",a=>{this.handleVideoUpload(a)});const t=document.getElementById("performanceOverlay");t.addEventListener("click",()=>{this.editMode||this.togglePerformanceMode()}),t.addEventListener("touchstart",a=>{this.editMode||(a.preventDefault(),this.togglePerformanceMode())},{passive:!1});const s=document.getElementById("vertexControls").querySelector(".control-drag-handle");s.addEventListener("mousedown",a=>this.startControlsDrag(a)),s.addEventListener("touchstart",a=>this.startControlsDrag(a),{passive:!1}),document.addEventListener("mousemove",a=>this.moveControls(a)),document.addEventListener("touchmove",a=>this.moveControls(a),{passive:!1}),document.addEventListener("mouseup",()=>this.stopControlsDrag()),document.addEventListener("touchend",()=>this.stopControlsDrag()),document.getElementById("newProjectBtn").addEventListener("click",()=>this.startNewProject()),document.getElementById("loadProjectFileBtn").addEventListener("click",()=>this.loadProjectFromFile()),document.getElementById("continueProjectBtn").addEventListener("click",()=>this.continueLastProject())}handleBrushStroke(e,o,t){const i=this.selectedPolygon;if(!i||i.type!=="drawing"||!i.drawingCtx)return;const s=i.getBoundingBox(),n=this.canvas.getBoundingClientRect(),a=(e-n.left)/n.width,l=(o-n.top)/n.height,c=(a-s.minX)/s.width,h=(l-s.minY)/s.height;if(c<0||c>1||h<0||h>1){this.lastBrushPos=null;return}const d=i.drawingCtx,y=i.drawingCanvas.width,x=i.drawingCanvas.height,f=c*y,C=h*x,S={size:parseInt(document.getElementById("brushSizeSlider").value),opacity:parseFloat(document.getElementById("brushOpacitySlider").value),color:document.getElementById("brushColorPicker").value,eraser:document.getElementById("eraserToggle").checked};d.lineJoin="round",d.lineCap="round",d.lineWidth=S.size,S.eraser?(d.globalCompositeOperation="destination-out",d.strokeStyle=`rgba(0,0,0,${S.opacity})`):(d.globalCompositeOperation="source-over",d.strokeStyle=S.color,d.globalAlpha=S.opacity),t||!this.lastBrushPos?(d.beginPath(),d.moveTo(f,C),d.lineTo(f,C),d.stroke()):(d.beginPath(),d.moveTo(this.lastBrushPos.x,this.lastBrushPos.y),d.lineTo(f,C),d.stroke()),d.globalCompositeOperation="source-over",d.globalAlpha=1,this.lastBrushPos={x:f,y:C},i.isDirty=!0}handlePointerDown(e,o){if(this.editMode,this.currentTool==="brush"){this.selectedPolygon&&this.selectedPolygon.type==="drawing"&&(this.isDrawing=!0,this.handleBrushStroke(e,o,!0));return}const t=this.getNormalizedCoords(e,o);if(this.currentTool==="triangle"){const i=W.createTriangle(t.x,t.y);this.polygons.push(i),this.selectPolygon(i),this.setTool("select")}else if(this.currentTool==="square"){const i=W.createSquare(t.x,t.y);this.polygons.push(i),this.selectPolygon(i),this.setTool("select")}else if(this.currentTool==="circle"){const i=W.createCircle(t.x,t.y);this.polygons.push(i),this.selectPolygon(i),this.setTool("select")}else if(this.currentTool==="draw"){if(this.drawingVertices.length>=3){const i=this.drawingVertices[0];if(Math.sqrt((t.x-i.x)**2+(t.y-i.y)**2)<.05){this.finishDrawing();return}}this.drawingVertices.push({x:t.x,y:t.y}),this.isDrawing=!0}else if(this.currentTool==="select"){let i=!1;for(let s=this.polygons.length-1;s>=0;s--){const n=this.polygons[s],a=n.getVertexAtPoint(t.x,t.y);if(a){this.selectPolygon(n),this.selectedVertex=a,this.updateVertexControls(!0),i=!0;break}}if(!i){for(let s=this.polygons.length-1;s>=0;s--){const n=this.polygons[s];if(n.containsPoint(t.x,t.y)){this.selectPolygon(n),this.selectedVertex=null,this.updateVertexControls(!1),this.dragStart=t,i=!0;break}}i||(this.selectPolygon(null),this.selectedVertex=null,this.updateVertexControls(!1))}}this.renderLayersList()}handlePointerMove(e,o){if(this.currentTool==="brush"&&this.isDrawing){this.handleBrushStroke(e,o,!1);return}const t=this.getNormalizedCoords(e,o);if(this.selectedPolygon&&this.selectedVertex)this.selectedPolygon.moveVertex(this.selectedVertex,t.x,t.y);else if(this.selectedPolygon&&this.dragStart){const i=t.x-this.dragStart.x,s=t.y-this.dragStart.y;this.selectedPolygon.translate(i,s),this.dragStart=t}}handlePointerUp(){this.currentTool==="brush"&&(this.isDrawing=!1,this.lastBrushPos=null),this.dragStart&&(this.dragStart=null)}finishDrawing(){if(this.drawingVertices.length>=3){const e=new M(this.drawingVertices);this.polygons.push(e),this.selectPolygon(e)}this.drawingVertices=[],this.isDrawing=!1,this.setTool("select"),this.renderLayersList(),window.innerWidth<768&&document.getElementById("leftSidebar").classList.remove("hidden")}selectPolygon(e){this.polygons.forEach(t=>t.selected=!1),this.selectedPolygon=e;const o=document.getElementById("rightSidebar");e?(e.selected=!0,o.classList.remove("hidden"),this.updatePropertiesPanel(e),e.type!=="drawing"&&this.currentTool==="brush"&&this.setTool("select")):o.classList.add("hidden"),this.renderLayersList()}updatePropertiesPanel(e){const o=document.getElementById("currentContentInfo");e.contentType==="video"?o.textContent="Video":o.textContent=`Shader: ${e.shaderType}`,document.getElementById("warpToggle").checked=e.warpMode,document.getElementById("audioEnabledToggle").checked=e.audioSettings.enabled,document.getElementById("audioGainSlider").value=e.audioSettings.gain.toString(),document.getElementById("audioBassSlider").value=e.audioSettings.bassScale.toString(),document.getElementById("audioMidSlider").value=e.audioSettings.midScale.toString(),document.getElementById("audioHighSlider").value=e.audioSettings.highScale.toString();const t=document.getElementById("canvasMaskControl"),i=document.getElementById("brushControls");e.type==="drawing"?(t.classList.remove("hidden"),document.getElementById("useAsMaskToggle").checked=e.useAsMask,this.currentTool==="brush"?i.classList.remove("hidden"):i.classList.add("hidden")):(t.classList.add("hidden"),i.classList.add("hidden")),this.renderEffectsList(e)}toggleWarpMode(e){this.selectedPolygon&&(e!==this.selectedPolygon.warpMode&&this.selectedPolygon.toggleWarpMode(),this.selectedVertex=null,this.updateVertexControls(!1))}updateVertexControls(e){const o=document.getElementById("vertexControls");e&&this.selectedVertex?o.classList.remove("hidden"):o.classList.add("hidden")}finetuneVertex(e){if(!this.selectedPolygon||!this.selectedVertex)return;const o=this.selectedPolygon,t=this.selectedVertex,i=1/this.canvas.width;let s=null;t.type==="grid"?s=o.gridVertices[t.index]:t.type==="vertex"?s=o.vertices[t.index]:t.type==="c1"?s=o.vertices[t.index].c1:t.type==="c2"&&(s=o.vertices[t.index].c2),s&&(e==="up"&&(s.y-=i),e==="down"&&(s.y+=i),e==="left"&&(s.x-=i),e==="right"&&(s.x+=i))}toggleVertexCurve(){if(!this.selectedPolygon||!this.selectedVertex||this.selectedVertex.type!=="vertex")return;const e=this.selectedPolygon,o=this.selectedVertex.index,t=e.vertices[o];if(t.bezier=!t.bezier,t.bezier&&(!t.c1||!t.c2)){const i=(o-1+e.vertices.length)%e.vertices.length,s=(o+1)%e.vertices.length,n=e.vertices[i],a=e.vertices[s],l=t.x-n.x,c=t.y-n.y;t.c1={x:t.x-l*.2,y:t.y-c*.2};const h=a.x-t.x,d=a.y-t.y;t.c2={x:t.x+h*.2,y:t.y+d*.2}}}deleteSelected(){if(this.selectedPolygon){const e=this.polygons.indexOf(this.selectedPolygon);e>=0&&(this.polygons.splice(e,1),this.selectPolygon(null))}this.renderLayersList()}showContentModal(){if(!this.selectedPolygon){this.showStatus("Please select a polygon first");return}document.getElementById("contentModal").classList.remove("hidden")}showShaderModal(){document.getElementById("contentModal").classList.add("hidden"),document.getElementById("shaderModal").classList.remove("hidden")}showVideoModal(){document.getElementById("contentModal").classList.add("hidden"),document.getElementById("videoModal").classList.remove("hidden"),this.updateVideoList()}hideAllModals(){document.querySelectorAll(".modal").forEach(e=>e.classList.add("hidden"))}setPolygonContent(e,o){this.selectedPolygon&&(this.selectedPolygon.setContent(e,o),this.hideAllModals(),this.showStatus(`Content updated: ${e}`),this.updatePropertiesPanel(this.selectedPolygon))}handleVideoUpload(e){const o=e.target.files[0];if(o){const t=URL.createObjectURL(o);this.loadedVideos.set(o.name,t),this.updateVideoList(),e.target.value=""}}updateVideoList(){const e=document.getElementById("videoList");e.innerHTML="",this.loadedVideos.forEach((o,t)=>{const i=document.createElement("button");i.className="content-type-btn",i.textContent=t,i.addEventListener("click",()=>{this.setPolygonContent("video",o)}),e.appendChild(i)})}togglePerformanceMode(){this.editMode=!this.editMode;const e=document.getElementById("uiContainer"),o=document.getElementById("toggleSidebarBtn");this.editMode?(e.classList.remove("hidden"),o.style.display="flex"):(e.classList.add("hidden"),o.style.display="none"),document.getElementById("performanceOverlay").classList.toggle("hidden",this.editMode),this.overlayCanvas.style.display=this.editMode?"block":"none"}toggleFullscreen(){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>this.showStatus("Fullscreen not available"))}showWelcomeModal(){const e=document.getElementById("welcomeModal"),o=document.getElementById("continueProjectBtn"),t=localStorage.getItem("mobileMapperProject")!==null;o.disabled=!t,e.classList.remove("hidden")}startNewProject(){this.polygons=[],this.loadedVideos.clear(),this.selectedPolygon=null,this.selectedVertex=null,localStorage.removeItem("mobileMapperProject"),document.getElementById("welcomeModal").classList.add("hidden"),this.showStatus("New project started"),this.selectPolygon(null)}continueLastProject(){this.loadProjectFromLocalStorage(),document.getElementById("welcomeModal").classList.add("hidden"),this.showStatus("Project loaded from last session")}loadProjectFromFile(){const e=document.createElement("input");e.type="file",e.accept=".json",e.onchange=o=>{const t=o.target.files[0];if(!t)return;const i=new FileReader;i.onload=s=>{try{const n=JSON.parse(s.target.result);this.loadProjectData(n),document.getElementById("welcomeModal").classList.add("hidden"),this.showStatus("Project loaded from file!")}catch(n){this.showStatus("Failed to load project file"),console.error(n)}},i.readAsText(t)},e.click()}saveProject(){const e=`projection-mapping-${new Date().toISOString().split("T")[0]}`;let o=prompt("Enter project name:",e);if(o===null)return;o=o.trim()||e,o.endsWith(".json")||(o+=".json");const t={polygons:this.polygons.map(a=>a.toJSON()),videos:Array.from(this.loadedVideos.entries()),version:"1.0",name:o.replace(".json","")};localStorage.setItem("mobileMapperProject",JSON.stringify(t));const i=new Blob([JSON.stringify(t,null,2)],{type:"application/json"}),s=URL.createObjectURL(i),n=document.createElement("a");n.href=s,n.download=o,n.click(),URL.revokeObjectURL(s),this.showStatus(`Project "${o}" saved!`)}loadProjectFromLocalStorage(){const e=localStorage.getItem("mobileMapperProject");if(e)try{const o=JSON.parse(e);this.loadProjectData(o)}catch(o){console.error("Failed to load project:",o)}}loadProjectData(e){this.polygons=e.polygons.map(o=>M.fromJSON(o)),e.videos&&(this.loadedVideos=new Map(e.videos),this.polygons.forEach(o=>{o.contentType==="video"&&(o.videoSrc&&this.loadedVideos.has(o.videoSrc)?o.loadVideo():(o.contentType="shader",o.shaderType="rainbow"))})),this.renderLayersList()}animate(){this.audioManager.isActive?this.renderer.updateAudioData(this.audioManager.getAudioData()):this.renderer.updateAudioData({low:0,mid:0,high:0,level:0}),this.renderer.render(this.polygons,this.editMode),this.overlayCtx.clearRect(0,0,this.overlayCanvas.width,this.overlayCanvas.height);const e=this.overlayCanvas.width,o=this.overlayCanvas.height;this.editMode&&this.polygons.forEach(t=>{if(t.selected,t.selected)if(t.getRenderVertices(),t.warpMode&&t.gridVertices.length>0){const i=t.gridSize;this.overlayCtx.strokeStyle="#ffff00",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath();for(let s=0;s<i;s++)for(let n=0;n<i-1;n++){const a=t.gridVertices[s*i+n],l=t.gridVertices[s*i+n+1];this.overlayCtx.moveTo(a.x*e,a.y*o),this.overlayCtx.lineTo(l.x*e,l.y*o)}for(let s=0;s<i;s++)for(let n=0;n<i-1;n++){const a=t.gridVertices[n*i+s],l=t.gridVertices[(n+1)*i+s];this.overlayCtx.moveTo(a.x*e,a.y*o),this.overlayCtx.lineTo(l.x*e,l.y*o)}this.overlayCtx.stroke(),t.gridVertices.forEach((s,n)=>{const a=s.x*e,l=s.y*o,c=this.selectedVertex&&this.selectedVertex.type==="grid"&&this.selectedVertex.index===n;this.overlayCtx.fillStyle=c?"#00ffff":"#ffff00",this.overlayCtx.beginPath(),this.overlayCtx.arc(a,l,c?8:4,0,Math.PI*2),this.overlayCtx.fill(),this.overlayCtx.stroke()})}else{const i=t.getDiscretizedVertices(30);this.overlayCtx.strokeStyle="#00ff00",this.overlayCtx.lineWidth=3,this.overlayCtx.beginPath(),i.forEach((s,n)=>{const a=s.x*e,l=s.y*o;n===0?this.overlayCtx.moveTo(a,l):this.overlayCtx.lineTo(a,l)}),this.overlayCtx.closePath(),this.overlayCtx.stroke(),t.vertices.forEach((s,n)=>{const a=s.x*e,l=s.y*o,c=this.selectedVertex&&this.selectedVertex.type==="vertex"&&this.selectedVertex.index===n;if(this.overlayCtx.fillStyle=c?"#00ffff":"#00ff00",this.overlayCtx.beginPath(),this.overlayCtx.arc(a,l,c?8:6,0,Math.PI*2),this.overlayCtx.fill(),this.overlayCtx.stroke(),s.bezier){if(s.c1){const h=s.c1.x*e,d=s.c1.y*o;this.overlayCtx.strokeStyle="rgba(255,255,255,0.5)",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath(),this.overlayCtx.moveTo(a,l),this.overlayCtx.lineTo(h,d),this.overlayCtx.stroke();const y=this.selectedVertex&&this.selectedVertex.type==="c1"&&this.selectedVertex.index===n;this.overlayCtx.fillStyle=y?"#ff00ff":"#ffffff",this.overlayCtx.beginPath(),this.overlayCtx.arc(h,d,4,0,Math.PI*2),this.overlayCtx.fill()}if(s.c2){const h=s.c2.x*e,d=s.c2.y*o;this.overlayCtx.strokeStyle="rgba(255,255,255,0.5)",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath(),this.overlayCtx.moveTo(a,l),this.overlayCtx.lineTo(h,d),this.overlayCtx.stroke();const y=this.selectedVertex&&this.selectedVertex.type==="c2"&&this.selectedVertex.index===n;this.overlayCtx.fillStyle=y?"#ff00ff":"#ffffff",this.overlayCtx.beginPath(),this.overlayCtx.arc(h,d,4,0,Math.PI*2),this.overlayCtx.fill()}}})}else{const i=t.getDiscretizedVertices(20);this.overlayCtx.strokeStyle="rgba(0, 255, 0, 0.3)",this.overlayCtx.lineWidth=1,this.overlayCtx.beginPath(),i.forEach((s,n)=>{const a=s.x*e,l=s.y*o;n===0?this.overlayCtx.moveTo(a,l):this.overlayCtx.lineTo(a,l)}),this.overlayCtx.closePath(),this.overlayCtx.stroke()}}),this.isDrawing&&this.drawingVertices.length>0&&(this.overlayCtx.strokeStyle="#ffff00",this.overlayCtx.lineWidth=2,this.overlayCtx.beginPath(),this.drawingVertices.forEach((t,i)=>{const s=t.x*e,n=t.y*o;i===0?this.overlayCtx.moveTo(s,n):this.overlayCtx.lineTo(s,n)}),this.overlayCtx.stroke(),this.drawingVertices.forEach((t,i)=>{const s=t.x*e,n=t.y*o;i===0?(this.overlayCtx.fillStyle="#ff0000",this.overlayCtx.beginPath(),this.overlayCtx.arc(s,n,8,0,Math.PI*2),this.overlayCtx.fill(),this.overlayCtx.strokeStyle="#ffffff",this.overlayCtx.lineWidth=2,this.overlayCtx.stroke()):(this.overlayCtx.fillStyle="#ffff00",this.overlayCtx.beginPath(),this.overlayCtx.arc(s,n,4,0,Math.PI*2),this.overlayCtx.fill())})),requestAnimationFrame(()=>this.animate())}renderLayersList(){const e=document.getElementById("layersListContainer");if(e){if(e.innerHTML="",this.polygons.length===0){e.innerHTML='<div style="padding:8px; opacity:0.5; font-size:12px;">No shapes added</div>';return}this.polygons.forEach((o,t)=>{const i=document.createElement("div");i.className="layer-item",i.style.padding="8px",i.style.borderBottom="1px solid rgba(255,255,255,0.1)",i.style.cursor="pointer",i.style.backgroundColor=o.selected?"rgba(0,255,157,0.2)":"transparent",i.style.display="flex",i.style.justifyContent="space-between",i.style.alignItems="center";const s=document.createElement("span");s.textContent=`Shape ${t+1} (${o.type})`,s.style.fontSize="12px",i.appendChild(s),i.addEventListener("click",n=>{n.stopPropagation(),this.selectPolygon(o),this.setTool("select")}),e.appendChild(i)})}}toggleAudio(){this.audioManager.isActive?(this.audioManager.stop(),document.getElementById("audioToggleBtn").classList.remove("active")):(this.audioManager.start(),document.getElementById("audioToggleBtn").classList.add("active"))}addEffect(e){if(!this.selectedPolygon)return;if(this.selectedPolygon.effects.find(t=>t.type===e)){this.showStatus(`${e} effect already added`);return}this.selectedPolygon.addEffect(e),this.updatePropertiesPanel(this.selectedPolygon)}removeEffect(e){this.selectedPolygon&&(this.selectedPolygon.removeEffect(e),this.updatePropertiesPanel(this.selectedPolygon))}renderEffectsList(e){const o=document.getElementById("effectsListContainer");if(o){if(o.innerHTML="",!e.effects||e.effects.length===0){o.innerHTML="<div style='opacity:0.5; font-size:12px; padding:8px;'>No effects added</div>";return}e.effects.forEach(t=>{const i=document.createElement("div");i.className="effect-item";let s="";const n=t.params;if(["brightness","contrast","saturation","hue"].includes(t.type)){const c=t.type==="brightness"?-1:0,h=t.type==="brightness"?1:2,d=t.type==="hue"?.01:.1;s=`
                <div class="control-group">
                    <label>Value: <span id="val-${t.id}">${n.value.toFixed(2)}</span></label>
                    <input type="range" min="${c}" max="${h}" step="${d}" value="${n.value}" 
                           data-effect-id="${t.id}" data-param="value">
                </div>
            `}else["scanlines","dots","grid"].includes(t.type)?s=`
                <div class="control-group">
                    <label>Scale</label>
                    <input type="range" min="1" max="100" value="${n.scale}"
                           data-effect-id="${t.id}" data-param="scale">
                </div>
                <div class="control-group">
                    <label>Intensity</label>
                    <input type="range" min="0" max="1" step="0.1" value="${n.intensity}"
                           data-effect-id="${t.id}" data-param="intensity">
                </div>
                <div class="control-group">
                    <label>Anim Speed</label>
                    <input type="range" min="0" max="5" step="0.1" value="${n.speed!==void 0?n.speed:1}"
                           data-effect-id="${t.id}" data-param="speed">
                </div>
            `:t.type==="border"&&(s=`
                <div class="control-group">
                    <label>Width</label>
                    <input type="range" min="0.01" max="0.2" step="0.01" value="${n.width}"
                           data-effect-id="${t.id}" data-param="width">
                </div>
                <div class="control-group">
                    <label>Pulse Speed</label>
                    <input type="range" min="0" max="10" step="0.1" value="${n.speed!==void 0?n.speed:0}"
                           data-effect-id="${t.id}" data-param="speed">
                </div>
            `);i.innerHTML=`
            <div class="effect-header">
                <span>${t.type.toUpperCase()}</span>
                <button class="effect-remove" data-effect-id="${t.id}">✕</button>
            </div>
            ${s}
        `;const a=i.querySelector(".effect-remove");a&&a.addEventListener("click",c=>{const h=c.target;this.removeEffect(h.dataset.effectId)}),i.querySelectorAll('input[type="range"]').forEach(c=>{c.addEventListener("input",h=>{const d=h.target,y=d.dataset.param,x=parseFloat(d.value),f=d.dataset.effectId,C={};C[y]=x,this.updateEffectParam(f,C)})}),o.appendChild(i)})}}updateEffectParam(e,o){if(this.selectedPolygon){this.selectedPolygon.updateEffect(e,o);const t=document.getElementById(`val-${e}`);t&&o.value!==void 0&&(t.textContent=o.value.toFixed(2))}}showStatus(e){const o=document.getElementById("statusMsg");o.textContent=e,o.classList.remove("hidden"),setTimeout(()=>{o.classList.add("hidden")},2e3)}loadProjectDialog(){this.loadProjectFromFile()}startControlsDrag(e){e.preventDefault(),e.stopPropagation();const t=document.getElementById("vertexControls").getBoundingClientRect(),i=e.touches?e.touches[0].clientX:e.clientX,s=e.touches?e.touches[0].clientY:e.clientY;this.controlsDragStart={x:i-t.left,y:s-t.top}}moveControls(e){if(!this.controlsDragStart)return;e.preventDefault();const o=e.touches?e.touches[0].clientX:e.clientX,t=e.touches?e.touches[0].clientY:e.clientY,i=document.getElementById("vertexControls"),s=o-this.controlsDragStart.x,n=t-this.controlsDragStart.y,a=window.innerWidth-i.offsetWidth,l=window.innerHeight-i.offsetHeight;this.controlsPosition.x=Math.max(0,Math.min(s,a)),this.controlsPosition.y=Math.max(0,Math.min(n,l)),i.style.left=this.controlsPosition.x+"px",i.style.top=this.controlsPosition.y+"px",i.style.right="auto",i.style.bottom="auto",i.style.transform="none"}stopControlsDrag(){this.controlsDragStart=null}setTool(e){this.currentTool=e,this.isDrawing=!1,this.drawingVertices=[],document.querySelectorAll(".tool-btn").forEach(o=>o.classList.remove("active")),e==="select"?document.getElementById("selectBtn").classList.add("active"):e==="brush"?(document.getElementById("brushBtn").classList.add("active"),this.selectedPolygon&&this.selectedPolygon.type==="drawing"&&document.getElementById("brushControls").classList.remove("hidden")):(e==="triangle"?document.getElementById("addTriangleBtn").classList.add("active"):e==="square"?document.getElementById("addSquareBtn").classList.add("active"):e==="circle"?document.getElementById("addCircleBtn").classList.add("active"):e==="draw"&&document.getElementById("drawPolygonBtn").classList.add("active"),window.innerWidth<768&&(document.getElementById("leftSidebar").classList.add("hidden"),document.getElementById("rightSidebar").classList.add("hidden"))),e!=="brush"&&document.getElementById("brushControls").classList.add("hidden")}getNormalizedCoords(e,o){const t=this.canvas.getBoundingClientRect();return{x:(e-t.left)/t.width,y:(o-t.top)/t.height}}handleTouchStart(e){if(e.preventDefault(),e.touches.length===1){const o=e.touches[0];this.handlePointerDown(o.clientX,o.clientY)}}handleTouchMove(e){if(e.preventDefault(),e.touches.length===1){const o=e.touches[0];this.handlePointerMove(o.clientX,o.clientY)}}handleTouchEnd(e){e.preventDefault(),this.handlePointerUp()}handleMouseDown(e){this.handlePointerDown(e.clientX,e.clientY)}handleMouseMove(e){this.handlePointerMove(e.clientX,e.clientY)}handleMouseUp(e){this.handlePointerUp()}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{window.app=new Y}):window.app=new Y;
