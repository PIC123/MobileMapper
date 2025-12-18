import { Polygon, Vertex } from "./polygon";
import { SHADERS, VERTEX_SHADER, VIDEO_FRAGMENT_TEMPLATE } from "./shaders";
import earcut from "earcut";

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
    this.gl = canvas.getContext("webgl", { alpha: true, stencil: true })!;
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
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.maskFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.maskFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.maskTexture,
      0
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  updateAudioData(data: {
    low: number;
    mid: number;
    high: number;
    level: number;
  }) {
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

  createProgram(
    gl: WebGLRenderingContext,
    vertexSrc: string,
    fragmentSrc: string
  ) {
    const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexSrc)!;
    const fragmentShader = this.createShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentSrc
    )!;
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

        // Edge Detection
        enableEdge: gl.getUniformLocation(program, "u_enableEdge"),
        edgeThreshold: gl.getUniformLocation(program, "u_edgeThreshold"),
        edgeColor: gl.getUniformLocation(program, "u_edgeColor"),
        edgeMode: gl.getUniformLocation(program, "u_edgeMode"),
        edgeSpeed: gl.getUniformLocation(program, "u_edgeSpeed"),

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
    if (isMaskRender && polygon.useAsMask && !polygon.drawingCanvas) {
      return;
    }

    if (polygon.contentType === "video" || polygon.contentType === "drawing" || polygon.contentType === "image") {
      programInfo = this.getProgramInfo("video", VIDEO_FRAGMENT_TEMPLATE);
    } else {
      if (isMaskRender) {
        programInfo = this.getProgramInfo("video", VIDEO_FRAGMENT_TEMPLATE);
      } else {
        const shaderDef = SHADERS[polygon.shaderType] || SHADERS["rainbow"];
        programInfo = this.getProgramInfo(
          polygon.shaderType,
          shaderDef.fragment
        );
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
          this.addTriangleToBuffers(
            positions,
            texCoords,
            polygon.gridVertices,
            i1,
            i2,
            i3,
            size,
            x,
            y,
            0
          );
          this.addTriangleToBuffers(
            positions,
            texCoords,
            polygon.gridVertices,
            i2,
            i4,
            i3,
            size,
            x,
            y,
            1
          );
        }
      }
    } else {
      const verts = polygon.getDiscretizedVertices(20);
      const flatVerts: number[] = [];
      verts.forEach((v) => flatVerts.push(v.x, v.y));

      const triangles = earcut(flatVerts);
      const bounds = polygon.getBoundingBox();
      const mapUV = (x: number, y: number) => {
        return [
          (x - bounds.minX) / bounds.width,
          (y - bounds.minY) / bounds.height,
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
    gl.vertexAttribPointer(
      programInfo.attribLocations.position,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(programInfo.attribLocations.texCoord);
    gl.vertexAttribPointer(
      programInfo.attribLocations.texCoord,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );

    // --- Set Uniforms ---
    // ... (Standard Uniforms)
    // Aggregate Effect Params
    let brightness = 0.0,
      contrast = 1.0,
      saturation = 1.0,
      hue = 0.0;
    let patternMode = 0,
      patternScale = 10.0,
      patternIntensity = 0.0,
      patternSpeed = 1.0;
    let enableBorder = 0,
      borderWidth = 0.0,
      borderColor = { r: 1, g: 1, b: 1 },
      borderSpeed = 0.0;
    let enableEdge = 0,
      edgeThreshold = 0.1,
      edgeColor = { r: 1, g: 1, b: 1 },
      edgeMode = 0,
      edgeSpeed = 1.0;

    if (!isMaskRender) {
      // Don't apply effects to the mask layer itself
      polygon.effects.forEach((effect) => {
        const p = effect.params;
        if (effect.type === "brightness") brightness += p.value;
        if (effect.type === "contrast") contrast *= p.value;
        if (effect.type === "saturation") saturation *= p.value;
        if (effect.type === "hue") hue += p.value;

        if (["scanlines", "dots", "grid"].includes(effect.type)) {
          patternMode =
            effect.type === "scanlines" ? 1 : effect.type === "dots" ? 2 : 3;
          patternScale = p.scale;
          patternIntensity = p.intensity;
          patternSpeed = p.speed || 1.0;
        }

        if (effect.type === "border") {
          enableBorder = 1;
          borderWidth = p.width;
          if (p.color) borderColor = p.color;
          borderSpeed = p.speed || 0.0;
        }

        if (effect.type === "edge_detection") {
          enableEdge = 1;
          edgeThreshold = p.threshold;
          if (p.color) edgeColor = p.color;
          edgeMode = p.mode || 0;
          edgeSpeed = p.speed || 1.0;
        }
      });
    }

    gl.uniform1f(programInfo.uniformLocations.brightness, brightness);
    gl.uniform1f(programInfo.uniformLocations.contrast, contrast);
    gl.uniform1f(programInfo.uniformLocations.saturation, saturation);
    gl.uniform1f(programInfo.uniformLocations.hue, hue);

    gl.uniform1i(programInfo.uniformLocations.patternMode, patternMode);
    gl.uniform1f(programInfo.uniformLocations.patternScale, patternScale);
    gl.uniform1f(
      programInfo.uniformLocations.patternIntensity,
      patternIntensity
    );
    gl.uniform1f(programInfo.uniformLocations.patternSpeed, patternSpeed);

    gl.uniform1i(programInfo.uniformLocations.enableBorder, enableBorder);
    gl.uniform1f(programInfo.uniformLocations.borderWidth, borderWidth);
    gl.uniform1f(programInfo.uniformLocations.borderSpeed, borderSpeed);
    if (borderColor) {
      gl.uniform3f(
        programInfo.uniformLocations.borderColor,
        borderColor.r,
        borderColor.g,
        borderColor.b
      );
    }

    gl.uniform1i(programInfo.uniformLocations.enableEdge, enableEdge);
    gl.uniform1f(programInfo.uniformLocations.edgeThreshold, edgeThreshold);
    if (edgeColor) {
        gl.uniform3f(programInfo.uniformLocations.edgeColor, edgeColor.r, edgeColor.g, edgeColor.b);
    }
    gl.uniform1i(programInfo.uniformLocations.edgeMode, edgeMode);
    gl.uniform1f(programInfo.uniformLocations.edgeSpeed, edgeSpeed);

    gl.uniform1f(programInfo.uniformLocations.audioLow, this.audioData.low);
    gl.uniform1f(programInfo.uniformLocations.audioMid, this.audioData.mid);
    gl.uniform1f(programInfo.uniformLocations.audioHigh, this.audioData.high);
    gl.uniform1f(programInfo.uniformLocations.audioLevel, this.audioData.level);

    const audioSettings = polygon.audioSettings || {
      bassScale: 1,
      midScale: 1,
      highScale: 1,
      gain: 1,
      enabled: true,
    };
    const enabled = audioSettings.enabled ? 1.0 : 0.0;

    gl.uniform1f(
      programInfo.uniformLocations.audioBassScale,
      audioSettings.bassScale * enabled
    );
    gl.uniform1f(
      programInfo.uniformLocations.audioMidScale,
      audioSettings.midScale * enabled
    );
    gl.uniform1f(
      programInfo.uniformLocations.audioHighScale,
      audioSettings.highScale * enabled
    );
    gl.uniform1f(
      programInfo.uniformLocations.audioGain,
      audioSettings.gain * enabled
    );

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
    if (
      (polygon.contentType === "video" && polygon.videoElement) ||
      (polygon.contentType === "drawing" && polygon.drawingCanvas) ||
      (polygon.contentType === "image" && polygon.imageElement && polygon.imageElement.complete)
    ) {
      let texture = this.videoTextures.get(polygon.id);
      if (!texture) {
        texture = gl.createTexture()!;
        this.videoTextures.set(polygon.id, texture);
        
        // Initial upload for image to handle case where isDirty might have triggered before texture creation
        if (polygon.contentType === "image") {
             gl.bindTexture(gl.TEXTURE_2D, texture);
             gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, polygon.imageElement!);
             polygon.isDirty = false;
        }
      }

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);

      const source =
        polygon.contentType === "video"
          ? polygon.videoElement!
          : polygon.contentType === "image"
          ? polygon.imageElement!
          : polygon.drawingCanvas!;

      if (polygon.contentType === "video") {
        // Video textures need regular updates and special handling
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          source
        );
      } else {
        // Drawing canvas and Images only need update if dirty
        if (polygon.isDirty) {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            source
          );
          polygon.isDirty = false;
        }
      }

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
      texCoords.push(u1, v_1); // TL
      texCoords.push((cellX + 1) / steps, v_1); // TR
      texCoords.push(u1, (cellY + 1) / steps); // BL
    } else {
      texCoords.push((cellX + 1) / steps, v_1); // TR
      texCoords.push((cellX + 1) / steps, (cellY + 1) / steps); // BR
      texCoords.push(u1, (cellY + 1) / steps); // BL
    }
  }

  render(polygons: Polygon[], editMode: boolean) {
    // Check for resize every frame to handle fullscreen transitions robustly
    this.resize();

    const gl = this.gl;

    // --- PASS 1: Render Global Mask (Drawing Layer) ---
    const maskPolygons = polygons.filter(
      (p) => p.type === "drawing" && p.useAsMask && !p.parent
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.maskFramebuffer);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // 1. Default state: Everything is Visible (White)
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (maskPolygons.length > 0) {
      maskPolygons.forEach((poly) => {
        if (!poly.drawingCanvas) return;

        // Sub-Pass A: "Cutout" / Occlude geometry
        gl.blendFuncSeparate(
          gl.ZERO,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ZERO,
          gl.ONE_MINUS_SRC_ALPHA
        );
        gl.enable(gl.BLEND);

        const originalType = poly.shaderType;
        const originalContent = poly.contentType;

        poly.contentType = "shader";
        poly.shaderType = "solid";

        this.renderPolygon(poly, true);

        poly.contentType = originalContent;
        poly.shaderType = originalType;

        // Sub-Pass B: Ink Reveal
        gl.blendFunc(gl.ONE, gl.ONE);
        this.renderPolygon(poly, true);
      });
    }

    // Reset Blend Mode for Main Scene
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // --- PASS 2: Render Scene with Hierarchy & Clipping ---

    gl.clearColor(0.0, 0.0, 0.0, 0.0); // Transparent background for app
    // IMPORTANT: Clear Stencil too
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    // Bind Global Mask Texture to Unit 1 (for global transparency masking)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);

    // Render Polygons
    // Hierarchy: A Polygon can have 'children' that act as masks.

    // We iterate the root polygons.
    // If a polygon has no children, render normally.
    // If a polygon has children (masks), we use Stencil Buffer.

    polygons.forEach((polygon) => {
      // Skip child/mask layers in main loop (they are handled by parents)
      if (polygon.parent) return;

      // Skip masking layers (drawing) that are global masks
      if (polygon.useAsMask) return;

      if (polygon.children && polygon.children.length > 0) {
        // --- Hierarchical Masking Logic ---
        // 1. Enable Stencil
        gl.enable(gl.STENCIL_TEST);
        gl.clear(gl.STENCIL_BUFFER_BIT); // Clear stencil for this shape group

        // 2. Render Mask Shapes (Children) to Stencil Buffer
        // We want Stencil = 1 where Masks are.
        gl.stencilFunc(gl.ALWAYS, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        gl.colorMask(false, false, false, false); // Disable color write

        polygon.children.forEach((child) => {
          // Force solid render for stencil geometry
          const origType = child.shaderType;
          const origContent = child.contentType;
          child.contentType = "shader";
          child.shaderType = "solid";

          this.renderPolygon(child, false); // Render geometry to Stencil

          child.contentType = origContent;
          child.shaderType = origType;
        });

        // 3. Render Parent (clipped by Stencil)
        gl.colorMask(true, true, true, true); // Enable color write
        gl.stencilFunc(gl.EQUAL, 1, 0xff); // Draw only where Stencil == 1
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

        this.renderPolygon(polygon, false);

        // 4. Disable Stencil
        gl.disable(gl.STENCIL_TEST);
      } else {
        // Normal Rendering
        this.renderPolygon(polygon, false);
      }
    });
  }
}
