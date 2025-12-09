import { Polygon, Vertex } from './polygon';
import { SHADERS, VERTEX_SHADER, VIDEO_FRAGMENT_TEMPLATE } from './shaders';
import earcut from 'earcut';

export class Renderer {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  programCache: Map<string, WebGLProgram>;
  shaderCache: Map<string, any>;
  videoTextures: Map<number, WebGLTexture>;
  startTime: number;
  audioData: { low: number; mid: number; high: number; level: number };
  
  // Masking Support
  maskFramebuffer: WebGLFramebuffer | null;
  maskTexture: WebGLTexture | null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", { alpha: true })!;
    this.programCache = new Map();
    this.shaderCache = new Map();
    this.videoTextures = new Map();
    this.startTime = Date.now();
    this.audioData = { low: 0, mid: 0, high: 0, level: 0 };
    
    this.maskFramebuffer = null;
    this.maskTexture = null;

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }
  
  resize() {
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;

    if (
      this.canvas.width !== displayWidth ||
      this.canvas.height !== displayHeight
    ) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.initMaskBuffer();
    }
  }

  initMaskBuffer() {
      const gl = this.gl;
      const width = this.canvas.width;
      const height = this.canvas.height;

      if (this.maskTexture) gl.deleteTexture(this.maskTexture);
      if (this.maskFramebuffer) gl.deleteFramebuffer(this.maskFramebuffer);

      this.maskTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      this.maskFramebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.maskFramebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.maskTexture, 0);
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  updateAudioData(data: { low: number; mid: number; high: number; level: number }) {
      this.audioData = data;
  }

  createShader(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  createProgram(gl: WebGLRenderingContext, vertexSrc: string, fragmentSrc: string) {
    const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexSrc)!;
    const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc)!;
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  getProgramInfo(key: string, fragmentSrc: string) {
    if (this.shaderCache.has(key)) {
      return this.shaderCache.get(key);
    }

    const gl = this.gl;
    const program = this.createProgram(gl, VERTEX_SHADER, fragmentSrc);
    if (!program) return null;

    const info = {
      program: program,
      attribLocations: {
        position: gl.getAttribLocation(program, "a_position"),
        texCoord: gl.getAttribLocation(program, "a_texCoord"),
      },
      uniformLocations: {
        resolution: gl.getUniformLocation(program, "u_resolution"),
        time: gl.getUniformLocation(program, "u_time"),
        texture: gl.getUniformLocation(program, "u_texture"),
        
        // Effects
        brightness: gl.getUniformLocation(program, "u_brightness"),
        contrast: gl.getUniformLocation(program, "u_contrast"),
        saturation: gl.getUniformLocation(program, "u_saturation"),
        hue: gl.getUniformLocation(program, "u_hue"),
        
        patternMode: gl.getUniformLocation(program, "u_patternMode"),
        patternScale: gl.getUniformLocation(program, "u_patternScale"),
        patternIntensity: gl.getUniformLocation(program, "u_patternIntensity"),
        patternSpeed: gl.getUniformLocation(program, "u_patternSpeed"),
        
        enableBorder: gl.getUniformLocation(program, "u_enableBorder"),
        borderWidth: gl.getUniformLocation(program, "u_borderWidth"),
        borderColor: gl.getUniformLocation(program, "u_borderColor"),
        borderSpeed: gl.getUniformLocation(program, "u_borderSpeed"),

        // Audio
        audioLow: gl.getUniformLocation(program, "u_audioLow"),
        audioMid: gl.getUniformLocation(program, "u_audioMid"),
        audioHigh: gl.getUniformLocation(program, "u_audioHigh"),
        audioLevel: gl.getUniformLocation(program, "u_audioLevel"),
        
        // Per-Shape Audio Settings
        audioBassScale: gl.getUniformLocation(program, "u_audioBassScale"),
        audioMidScale: gl.getUniformLocation(program, "u_audioMidScale"),
        audioHighScale: gl.getUniformLocation(program, "u_audioHighScale"),
        audioGain: gl.getUniformLocation(program, "u_audioGain"),

        // Masking
        useMask: gl.getUniformLocation(program, "u_useMask"),
        maskTexture: gl.getUniformLocation(program, "u_maskTexture"),
      },
    };

    this.shaderCache.set(key, info);
    return info;
  }

  renderPolygon(polygon: Polygon, isMaskRender: boolean = false) {
    const gl = this.gl;

    let programInfo;
    // For Mask Geometry Cutout (Pass A of Mask Render)
    if (isMaskRender && polygon.useAsMask && !polygon.drawingCanvas) { 
        // Should not happen if we structured logic right, but fallback
        return;
    }

    if (polygon.contentType === "video" || polygon.contentType === "drawing") {
      programInfo = this.getProgramInfo("video", VIDEO_FRAGMENT_TEMPLATE);
    } else {
        // If we are rendering the Mask Shape Cutout, we use a simple color shader
        if (isMaskRender) {
             // Actually, reusing 'solid' shader or just basic video shader with no texture is fine
             // But we need to force color to Black/Alpha 1 for cutout? 
             // Wait, logic is: Cutout = Multiply Dest Alpha by 0.
             // So we just need to render *something* with the geometry.
             // The Video shader works fine, we just ignore texture if we want.
             programInfo = this.getProgramInfo("video", VIDEO_FRAGMENT_TEMPLATE);
        } else {
            const shaderDef = SHADERS[polygon.shaderType] || SHADERS["rainbow"];
            programInfo = this.getProgramInfo(polygon.shaderType, shaderDef.fragment);
        }
    }

    if (!programInfo) return;

    gl.useProgram(programInfo.program);

    // Prepare Geometry
    const positions: number[] = [];
    const texCoords: number[] = [];
    
    if (polygon.warpMode && polygon.gridVertices.length > 0) {
        const size = polygon.gridSize;
        for (let y = 0; y < size - 1; y++) {
            for (let x = 0; x < size - 1; x++) {
                const i1 = y * size + x;
                const i2 = y * size + x + 1;
                const i3 = (y + 1) * size + x;
                const i4 = (y + 1) * size + x + 1;
                this.addTriangleToBuffers(positions, texCoords, polygon.gridVertices, i1, i2, i3, size, x, y, 0);
                this.addTriangleToBuffers(positions, texCoords, polygon.gridVertices, i2, i4, i3, size, x, y, 1);
            }
        }
    } else {
        const verts = polygon.getDiscretizedVertices(20);
        const flatVerts: number[] = [];
        verts.forEach(v => flatVerts.push(v.x, v.y));
        
        const triangles = earcut(flatVerts);
        const bounds = polygon.getBoundingBox();
        const mapUV = (x: number, y: number) => {
            return [
                (x - bounds.minX) / bounds.width,
                (y - bounds.minY) / bounds.height
            ];
        };
        
        for (let i = 0; i < triangles.length; i += 3) {
            const i1 = triangles[i];
            const i2 = triangles[i + 1];
            const i3 = triangles[i + 2];
            
            const v1 = verts[i1];
            const v2 = verts[i2];
            const v3 = verts[i3];
            
            positions.push(v1.x * 2 - 1, -(v1.y * 2 - 1));
            positions.push(v2.x * 2 - 1, -(v2.y * 2 - 1));
            positions.push(v3.x * 2 - 1, -(v3.y * 2 - 1));
            
            texCoords.push(...mapUV(v1.x, v1.y));
            texCoords.push(...mapUV(v2.x, v2.y));
            texCoords.push(...mapUV(v3.x, v3.y));
        }
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(programInfo.attribLocations.position);
    gl.vertexAttribPointer(programInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(programInfo.attribLocations.texCoord);
    gl.vertexAttribPointer(programInfo.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);

    // --- Set Uniforms ---
    // ... (Standard Uniforms)
    // Aggregate Effect Params
    let brightness = 0.0, contrast = 1.0, saturation = 1.0, hue = 0.0;
    let patternMode = 0, patternScale = 10.0, patternIntensity = 0.0, patternSpeed = 1.0;
    let enableBorder = 0, borderWidth = 0.0, borderColor = {r:1, g:1, b:1}, borderSpeed = 0.0;
    
    if (!isMaskRender) { // Don't apply effects to the mask layer itself
        polygon.effects.forEach(effect => {
            const p = effect.params;
            if (effect.type === 'brightness') brightness += p.value;
            if (effect.type === 'contrast') contrast *= p.value;
            if (effect.type === 'saturation') saturation *= p.value;
            if (effect.type === 'hue') hue += p.value;
            
            if (['scanlines', 'dots', 'grid'].includes(effect.type)) {
                patternMode = effect.type === 'scanlines' ? 1 : effect.type === 'dots' ? 2 : 3;
                patternScale = p.scale;
                patternIntensity = p.intensity;
                patternSpeed = p.speed || 1.0;
            }
            
            if (effect.type === 'border') {
                enableBorder = 1;
                borderWidth = p.width;
                if (p.color) borderColor = p.color;
                borderSpeed = p.speed || 0.0;
            }
        });
    }

    gl.uniform1f(programInfo.uniformLocations.brightness, brightness);
    gl.uniform1f(programInfo.uniformLocations.contrast, contrast);
    gl.uniform1f(programInfo.uniformLocations.saturation, saturation);
    gl.uniform1f(programInfo.uniformLocations.hue, hue);
    
    gl.uniform1i(programInfo.uniformLocations.patternMode, patternMode);
    gl.uniform1f(programInfo.uniformLocations.patternScale, patternScale);
    gl.uniform1f(programInfo.uniformLocations.patternIntensity, patternIntensity);
    gl.uniform1f(programInfo.uniformLocations.patternSpeed, patternSpeed);
    
    gl.uniform1i(programInfo.uniformLocations.enableBorder, enableBorder);
    gl.uniform1f(programInfo.uniformLocations.borderWidth, borderWidth);
    gl.uniform1f(programInfo.uniformLocations.borderSpeed, borderSpeed);
    if (borderColor) {
      gl.uniform3f(programInfo.uniformLocations.borderColor, borderColor.r, borderColor.g, borderColor.b);
    }

    gl.uniform1f(programInfo.uniformLocations.audioLow, this.audioData.low);
    gl.uniform1f(programInfo.uniformLocations.audioMid, this.audioData.mid);
    gl.uniform1f(programInfo.uniformLocations.audioHigh, this.audioData.high);
    gl.uniform1f(programInfo.uniformLocations.audioLevel, this.audioData.level);

    const audioSettings = polygon.audioSettings || { bassScale: 1, midScale: 1, highScale: 1, gain: 1, enabled: true };
    const enabled = audioSettings.enabled ? 1.0 : 0.0;
    
    gl.uniform1f(programInfo.uniformLocations.audioBassScale, audioSettings.bassScale * enabled);
    gl.uniform1f(programInfo.uniformLocations.audioMidScale, audioSettings.midScale * enabled);
    gl.uniform1f(programInfo.uniformLocations.audioHighScale, audioSettings.highScale * enabled);
    gl.uniform1f(programInfo.uniformLocations.audioGain, audioSettings.gain * enabled);

    const time = (Date.now() - this.startTime) / 1000;
    gl.uniform1f(programInfo.uniformLocations.time, time);

    // Mask Uniforms
    if (isMaskRender) {
        // When rendering the mask generation passes, we don't use the mask texture
        gl.uniform1i(programInfo.uniformLocations.useMask, 0);
    } else {
        // When rendering scene, use the global mask
        gl.uniform1i(programInfo.uniformLocations.useMask, 1);
        gl.uniform1i(programInfo.uniformLocations.maskTexture, 1);
    }

    // Set Content Texture (Unit 0)
    if ((polygon.contentType === "video" && polygon.videoElement) || (polygon.contentType === "drawing" && polygon.drawingCanvas)) {
      let texture = this.videoTextures.get(polygon.id);
      if (!texture) {
        texture = gl.createTexture()!;
        this.videoTextures.set(polygon.id, texture);
      }

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      
      const source = polygon.contentType === "video" ? polygon.videoElement! : polygon.drawingCanvas!;
      
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      
      gl.uniform1i(programInfo.uniformLocations.texture, 0);
    } 
    
    // Always set resolution, as it's now needed for masking in all shaders (including video)
    gl.uniform2f(
        programInfo.uniformLocations.resolution,
        this.canvas.width,
        this.canvas.height
    );

    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);

    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(texCoordBuffer);
  }

  addTriangleToBuffers(
    positions: number[],
    texCoords: number[],
    vertices: Vertex[],
    i1: number,
    i2: number,
    i3: number,
    size: number,
    cellX: number,
    cellY: number,
    triType: number
  ) {
    const v1 = vertices[i1];
    const v2 = vertices[i2];
    const v3 = vertices[i3];

    positions.push(v1.x * 2 - 1, -(v1.y * 2 - 1));
    positions.push(v2.x * 2 - 1, -(v2.y * 2 - 1));
    positions.push(v3.x * 2 - 1, -(v3.y * 2 - 1));
    
    const steps = size - 1;
    const u1 = cellX / steps;
    const v_1 = cellY / steps;
    
    if (triType === 0) {
        texCoords.push(u1, v_1);                         // TL
        texCoords.push((cellX + 1) / steps, v_1);        // TR
        texCoords.push(u1, (cellY + 1) / steps);         // BL
    } else {
        texCoords.push((cellX + 1) / steps, v_1);        // TR
        texCoords.push((cellX + 1) / steps, (cellY + 1) / steps); // BR
        texCoords.push(u1, (cellY + 1) / steps);         // BL
    }
  }

  render(polygons: Polygon[], editMode: boolean) {
    // Check for resize every frame to handle fullscreen transitions robustly
    this.resize();

    const gl = this.gl;
    
    // --- PASS 1: Render Global Mask ---
    const maskPolygons = polygons.filter(p => p.type === 'drawing' && p.useAsMask);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.maskFramebuffer);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    
    // 1. Default state: Everything is Visible (White)
    gl.clearColor(1.0, 1.0, 1.0, 1.0); 
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (maskPolygons.length > 0) {
        // 2. For each Mask Polygon:
        maskPolygons.forEach(poly => {
            if (!poly.drawingCanvas) return;

            // Sub-Pass A: "Cutout" / Occlude
            // Render the Polygon Geometry as Opaque Black (0,0,0,1) to "Hide" everything behind it.
            // Destination = Source * 0 + Destination * (1 - SourceAlpha) => (Assume Geometry is solid alpha)
            // Simply: Where geometry is, set Dest to 0.
            gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
            gl.enable(gl.BLEND);
            
            // We want to render "Black" geometry.
            // We can use a simple shader trick: use Border shader or disable Texture?
            // Let's just rely on the fact that drawing canvas is transparent except where ink is.
            // Wait, Polygon Geometry is the square. We want to cut the WHOLE square out.
            // So we need to render the Polygon Base.
            // We'll trick renderPolygon to render a "Solid Black" version?
            // Or we can just enable border and set width to huge? No.
            
            // Let's temporarily modify effects to force black? Hacky.
            // Better: Set blend mode to erase.
            
            // Render the Geometry (Mesh). 
            // We need a way to render "Solid 1.0 Alpha" for the whole mesh.
            // The existing shaders render the texture.
            // If texture is the DrawingCanvas, it is transparent.
            // So renderPolygon uses the DrawingCanvas texture.
            
            // Issue: We need to render the *Shape* (the quad) as solid, THEN the ink.
            // Hack: Render the polygon with NO texture (force white/solid) -> Erase.
            // Then Render with texture -> Add.
            
            // Let's add a helper mode to renderPolygon? 
            // For now, let's assume the user wants the "Drawing" to be the mask.
            // "mask anything it is covering (but only the parts it covers)"
            // "ink makes that part of that mask see through"
            
            // Interpretation: The Mask Polygon defines an area of Darkness.
            // Inside that area, Ink defines Light.
            
            // Step A: Render the Polygon Mesh as SOLID BLACK (Alpha 0 in our mask buffer).
            // We can use a dummy 1x1 white texture for this pass to ensure full coverage?
            
            // Let's assume renderPolygon handles geometry correctly.
            // We need to override the shader to output constant Alpha 1.0 (to trigger the erase blend).
            // Actually, let's just use blendFunc(ZERO, ONE_MINUS_SRC_ALPHA).
            // And we need the Source Alpha to be 1.0 everywhere in the mesh.
            // But 'renderPolygon' uses the texture alpha.
            // We need a way to render the mesh "Filled".
            
            // Let's make a quick "Fill" pass.
            // We can reuse renderPolygon but pass a flag "forceFill"?
            
            // Since I can't easily modify renderPolygon deeper without breaking things, 
            // I'll skip the "Solid Cutout" pass if I can't do it easily.
            // But without it, "mask anything it is covering" won't work.
            
            // Solution: Use `disable(gl.TEXTURE_2D)`? No, shader uses it.
            // Solution: Use a "Solid Color" shader for the Cutout pass.
            // We have `SHADERS['solid']`.
            const originalType = poly.shaderType;
            const originalContent = poly.contentType;
            
            // -- CUTOUT PASS --
            poly.contentType = 'shader';
            poly.shaderType = 'solid'; // Renders solid color (based on Hue)
            // We want pure alpha 1.
            // 'solid' shader outputs alpha 1.0. Good.
            
            // Erase existing mask buffer where this polygon is.
            gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
            this.renderPolygon(poly, true);
            
            // Restore
            poly.contentType = originalContent;
            poly.shaderType = originalType;
            
            // -- INK REVEAL PASS --
            // Now render the Drawing Texture (Ink).
            // Ink Alpha should be ADDED to the mask buffer.
            // (Ink = 1 means Visible).
            // Dst (0) + Src (1) = 1.
            gl.blendFunc(gl.ONE, gl.ONE);
            this.renderPolygon(poly, true);
        });
    }
    
    // Reset Blend Mode
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // --- PASS 2: Render Scene ---
    
    // Clear Screen
    gl.clearColor(0.0, 0.0, 0.0, 0.0); // Transparent background for app
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Bind Global Mask Texture to Unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);

    polygons.forEach((polygon) => {
      // Do not render the mask polygons themselves in the scene
      if (polygon.useAsMask) return;
      
      this.renderPolygon(polygon, false);
    });
  }
}
