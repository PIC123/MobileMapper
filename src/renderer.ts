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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", { alpha: true })!;
    this.programCache = new Map();
    this.shaderCache = new Map();
    this.videoTextures = new Map();
    this.startTime = Date.now();
    this.audioData = { low: 0, mid: 0, high: 0, level: 0 };

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }
  
  // ... existing methods ...
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
    }
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
      },
    };

    this.shaderCache.set(key, info);
    return info;
  }

  // Helper to check if a point is inside a triangle
  isPointInTriangle(p: Vertex, a: Vertex, b: Vertex, c: Vertex) {
    const v0 = { x: c.x - a.x, y: c.y - a.y };
    const v1 = { x: b.x - a.x, y: b.y - a.y };
    const v2 = { x: p.x - a.x, y: p.y - a.y };

    const dot00 = v0.x * v0.x + v0.y * v0.y;
    const dot01 = v0.x * v1.x + v0.y * v1.y;
    const dot02 = v0.x * v2.x + v0.y * v2.y;
    const dot11 = v1.x * v1.x + v1.y * v1.y;
    const dot12 = v1.x * v2.x + v1.y * v2.y;

    const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    return u >= 0 && v >= 0 && u + v < 1;
  }

  renderPolygon(polygon: Polygon) {
    const gl = this.gl;

    let programInfo;
    if (polygon.contentType === "video") {
      programInfo = this.getProgramInfo("video", VIDEO_FRAGMENT_TEMPLATE);
    } else {
      const shaderDef = SHADERS[polygon.shaderType] || SHADERS["rainbow"];
      programInfo = this.getProgramInfo(polygon.shaderType, shaderDef.fragment);
    }

    if (!programInfo) return;

    gl.useProgram(programInfo.program);

    // Prepare Geometry
    const positions: number[] = [];
    const texCoords: number[] = [];
    
    // --- Grid Warp Rendering ---
    if (polygon.warpMode && polygon.gridVertices.length > 0) {
        const size = polygon.gridSize;
        // Render each cell as 2 triangles
        for (let y = 0; y < size - 1; y++) {
            for (let x = 0; x < size - 1; x++) {
                // Grid indices
                const i1 = y * size + x;         // TL
                const i2 = y * size + x + 1;     // TR
                const i3 = (y + 1) * size + x;   // BL
                const i4 = (y + 1) * size + x + 1; // BR
                
                // Vertices
                const v1 = polygon.gridVertices[i1];
                const v2 = polygon.gridVertices[i2];
                const v3 = polygon.gridVertices[i3];
                const v4 = polygon.gridVertices[i4];
                
                // Add first triangle (TL, TR, BL)
                this.addTriangleToBuffers(positions, texCoords, polygon.gridVertices, i1, i2, i3, size, x, y, 0);
                // Add second triangle (TR, BR, BL) - Note: standard quad split
                this.addTriangleToBuffers(positions, texCoords, polygon.gridVertices, i2, i4, i3, size, x, y, 1);
            }
        }
    } else {
        // --- Standard Polygon Rendering ---
        // Triangulate using Earcut for correct handling of concave polygons
        
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
            
            // Positions
            positions.push(v1.x * 2 - 1, -(v1.y * 2 - 1));
            positions.push(v2.x * 2 - 1, -(v2.y * 2 - 1));
            positions.push(v3.x * 2 - 1, -(v3.y * 2 - 1));
            
            // UVs
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
    
    // Aggregate Effect Params
    let brightness = 0.0, contrast = 1.0, saturation = 1.0, hue = 0.0;
    let patternMode = 0, patternScale = 10.0, patternIntensity = 0.0, patternSpeed = 1.0;
    let enableBorder = 0, borderWidth = 0.0, borderColor = {r:1, g:1, b:1}, borderSpeed = 0.0;
    
    polygon.effects.forEach(effect => {
        const p = effect.params;
        if (effect.type === 'brightness') brightness += p.value;
        if (effect.type === 'contrast') contrast *= p.value;
        if (effect.type === 'saturation') saturation *= p.value;
        if (effect.type === 'hue') hue += p.value;
        
        if (['scanlines', 'dots', 'grid'].includes(effect.type)) {
            // Last pattern overrides (simple stack)
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
      gl.uniform3f(
        programInfo.uniformLocations.borderColor,
        borderColor.r,
        borderColor.g,
        borderColor.b
      );
    }

    // Pass Audio Data
    gl.uniform1f(programInfo.uniformLocations.audioLow, this.audioData.low);
    gl.uniform1f(programInfo.uniformLocations.audioMid, this.audioData.mid);
    gl.uniform1f(programInfo.uniformLocations.audioHigh, this.audioData.high);
    gl.uniform1f(programInfo.uniformLocations.audioLevel, this.audioData.level);

    // Pass Per-Shape Audio Settings
    const audioSettings = polygon.audioSettings || { bassScale: 1, midScale: 1, highScale: 1, gain: 1, enabled: true };
    const enabled = audioSettings.enabled ? 1.0 : 0.0;
    
    gl.uniform1f(programInfo.uniformLocations.audioBassScale, audioSettings.bassScale * enabled);
    gl.uniform1f(programInfo.uniformLocations.audioMidScale, audioSettings.midScale * enabled);
    gl.uniform1f(programInfo.uniformLocations.audioHighScale, audioSettings.highScale * enabled);
    gl.uniform1f(programInfo.uniformLocations.audioGain, audioSettings.gain * enabled);

    const time = (Date.now() - this.startTime) / 1000;
    gl.uniform1f(programInfo.uniformLocations.time, time);

    // Set base uniforms
    if (polygon.contentType === "video" && polygon.videoElement) {
      let texture = this.videoTextures.get(polygon.id);
      if (!texture) {
        texture = gl.createTexture()!;
        this.videoTextures.set(polygon.id, texture);
      }

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        polygon.videoElement
      );
      gl.uniform1i(programInfo.uniformLocations.texture, 0);
    } else {
      gl.uniform2f(
        programInfo.uniformLocations.resolution,
        this.canvas.width,
        this.canvas.height
      );
    }

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
    // Map vertices to screen space
    const v1 = vertices[i1];
    const v2 = vertices[i2];
    const v3 = vertices[i3];

    positions.push(v1.x * 2 - 1, -(v1.y * 2 - 1));
    positions.push(v2.x * 2 - 1, -(v2.y * 2 - 1));
    positions.push(v3.x * 2 - 1, -(v3.y * 2 - 1));
    
    // UV Mapping for Grid Cell
    // We assume the grid maps linearly to 0-1 UV space
    // cellX/Y are integers from 0 to gridSize-1
    const steps = size - 1;
    const u1 = cellX / steps;
    const v_1 = cellY / steps;
    
    // Calculate UVs for the specific triangle points
    // i1 = x, y
    // i2 = x+1, y
    // i3 = x, y+1 (for tri 0) OR i3 = x+1, y (for tri 1?? No, wait)
    
    // For triType 0 (TL, TR, BL):
    // TL (x,y), TR (x+1, y), BL (x, y+1)
    if (triType === 0) {
        texCoords.push(u1, v_1);                         // TL
        texCoords.push((cellX + 1) / steps, v_1);        // TR
        texCoords.push(u1, (cellY + 1) / steps);         // BL
    } else {
        // For triType 1 (TR, BR, BL):
        // TR (x+1, y), BR (x+1, y+1), BL (x, y+1)
        texCoords.push((cellX + 1) / steps, v_1);        // TR
        texCoords.push((cellX + 1) / steps, (cellY + 1) / steps); // BR
        texCoords.push(u1, (cellY + 1) / steps);         // BL
    }
  }

  render(polygons: Polygon[], editMode: boolean) {
    const gl = this.gl;
    
    // Clear
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // If edit mode is OFF, we might want a black background or transparent?
    // Usually transparent for mapping on top of things, but black for projector.
    // Let's keep it transparent so CSS background shows if any, or black.
    // Actually, mapping needs black background usually.
    if (!editMode) {
        // gl.clearColor(0,0,0,1);
        // gl.clear(gl.COLOR_BUFFER_BIT);
    }

    polygons.forEach((polygon) => {
      this.renderPolygon(polygon);
    });
  }
}
