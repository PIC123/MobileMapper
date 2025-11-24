// Polygon class to represent each shape

export interface Vertex {
  x: number;
  y: number;
  c1?: { x: number; y: number };
  c2?: { x: number; y: number };
  bezier?: boolean;
}

export interface Effect {
  id: string;
  type: string;
  params: any;
}

export interface AudioSettings {
  bassScale: number;
  midScale: number;
  highScale: number;
  gain: number;
  enabled: boolean;
}

export class Polygon {
  id: number;
  vertices: Vertex[];
  type: string;
  contentType: string;
  shaderType: string;
  videoSrc: string | null;
  videoElement: HTMLVideoElement | null;
  selected: boolean;
  effects: Effect[];
  warpMode: boolean;
  gridVertices: Vertex[];
  gridSize: number;
  audioSettings: AudioSettings;

  constructor(vertices: Vertex[], id: number | null = null, type: string = "polygon") {
    this.id = id || Date.now() + Math.random();
    this.vertices = vertices;
    this.type = type; 

    // Content
    this.contentType = "shader";
    this.shaderType = "rainbow";
    this.videoSrc = null;
    this.videoElement = null;

    // State
    this.selected = false;

    // Modular Effects Array
    this.effects = [];

    // Warp Mode
    this.warpMode = false;
    this.gridVertices = [];
    this.gridSize = 3;

    // Audio Settings
    this.audioSettings = {
      bassScale: 1.0,
      midScale: 1.0,
      highScale: 1.0,
      gain: 1.0,
      enabled: true,
    };
  }

  // Add an effect to the stack
  addEffect(type: string) {
    const id = Date.now() + Math.random().toString();
    let params: any = {};

    switch (type) {
      case "brightness":
        params = { value: 0.2 };
        break;
      case "contrast":
        params = { value: 1.2 };
        break;
      case "saturation":
        params = { value: 1.5 };
        break;
      case "hue":
        params = { value: 0.1, speed: 0.0 };
        break;
      case "scanlines":
        params = { scale: 50.0, intensity: 0.3, speed: 1.0 };
        break;
      case "dots":
        params = { scale: 30.0, intensity: 0.5, speed: 0.5 };
        break;
      case "grid":
        params = { scale: 10.0, intensity: 0.5, speed: 0.2 };
        break;
      case "border":
        params = { width: 0.05, color: { r: 1, g: 1, b: 1 }, speed: 2.0 };
        break;
    }

    this.effects.push({ id, type, params });
    return id;
  }

  removeEffect(id: string) {
    this.effects = this.effects.filter((e) => e.id !== id);
  }

  updateEffect(id: string, newParams: any) {
    const effect = this.effects.find((e) => e.id === id);
    if (effect) {
      Object.assign(effect.params, newParams);
    }
  }

  // Helper to get discretized vertices for rendering/collision
  getDiscretizedVertices(resolution: number = 20) {
    const result: Vertex[] = [];
    const verts = this.warpMode ? this.getBoundaryFromGrid() : this.vertices;

    for (let i = 0; i < verts.length; i++) {
      const current = verts[i];
      const next = verts[(i + 1) % verts.length];

      if (current.bezier && current.c2 && next.c1) {
        // Cubic Bezier: current -> c2 -> next.c1 -> next
        for (let j = 0; j < resolution; j++) {
          const t = j / resolution;
          const mt = 1 - t;
          const mt2 = mt * mt;
          const t2 = t * t;
          
          // Standard Cubic Bezier Formula
          // B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
          const x =
            mt * mt2 * current.x +
            3 * mt2 * t * (current.c2.x || current.x) +
            3 * mt * t2 * (next.c1.x || next.x) +
            t * t2 * next.x;
          const y =
            mt * mt2 * current.y +
            3 * mt2 * t * (current.c2.y || current.y) +
            3 * mt * t2 * (next.c1.y || next.y) +
            t * t2 * next.y;

          result.push({ x, y });
        }
      } else {
        result.push({ x: current.x, y: current.y });
      }
    }
    return result;
  }

  // Check if a point is inside the polygon (using discretized boundary)
  containsPoint(x: number, y: number) {
    const verts = this.getDiscretizedVertices();
    
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
      const xi = verts[i].x,
        yi = verts[i].y;
      const xj = verts[j].x,
        yj = verts[j].y;

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Get the index of the vertex (or control point) at the given point
  getVertexAtPoint(x: number, y: number, tolerance: number = 0.03) {
    // If warp mode, check grid vertices
    if (this.warpMode) {
      for (let i = 0; i < this.gridVertices.length; i++) {
        const v = this.gridVertices[i];
        const dx = v.x - x;
        const dy = v.y - y;
        if (Math.sqrt(dx * dx + dy * dy) < tolerance)
          return { type: "grid", index: i };
      }
      return null;
    }

    // Check main vertices and handles
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];
      
      // Main Vertex
      if (Math.sqrt((v.x - x) ** 2 + (v.y - y) ** 2) < tolerance) {
        return { type: "vertex", index: i };
      }

      // Control Point 1 (Incoming) - Logic: linked to Previous Segment?
      // Actually, usually CP1 is outgoing relative to Previous, CP2 incoming to Current?
      // Let's stick to: Vertex has c1 (incoming handle) and c2 (outgoing handle)
      
      if (v.bezier) {
        if (
          v.c1 &&
          Math.sqrt((v.c1.x - x) ** 2 + (v.c1.y - y) ** 2) < tolerance
        ) {
          return { type: "c1", index: i };
        }
        if (
          v.c2 &&
          Math.sqrt((v.c2.x - x) ** 2 + (v.c2.y - y) ** 2) < tolerance
        ) {
          return { type: "c2", index: i };
        }
      }
    }
    return null;
  }

  // Move a specific vertex or control point
  moveVertex(selection: { type: string; index: number }, x: number, y: number) {
    if (!selection) return;

    if (selection.type === "grid") {
      this.gridVertices[selection.index].x = Math.max(0, Math.min(1, x));
      this.gridVertices[selection.index].y = Math.max(0, Math.min(1, y));
      return;
    }

    const idx = selection.index;
    const v = this.vertices[idx];

    // Constrain to 0-1
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    if (selection.type === "vertex") {
      const dx = x - v.x;
      const dy = y - v.y;
      v.x = x;
      v.y = y;
      // Move handles with vertex
      if (v.c1) {
        v.c1.x += dx;
        v.c1.y += dy;
      }
      if (v.c2) {
        v.c2.x += dx;
        v.c2.y += dy;
      }
    } else if (selection.type === "c1") {
      v.c1 = { x, y };
    } else if (selection.type === "c2") {
      v.c2 = { x, y };
    }
  }

  // Move the entire polygon
  translate(dx: number, dy: number) {
    const verts = this.warpMode ? this.gridVertices : this.vertices;

    verts.forEach((v) => {
      v.x = Math.max(0, Math.min(1, v.x + dx));
      v.y = Math.max(0, Math.min(1, v.y + dy));
      if (v.c1) {
        v.c1.x += dx;
        v.c1.y += dy;
      }
      if (v.c2) {
        v.c2.x += dx;
        v.c2.y += dy;
      }
    });
  }

  // Get bounding box
  getBoundingBox() {
    // Using discretized vertices for better bounds on curves
    const verts = this.getDiscretizedVertices(10);
    const xs = verts.map((v) => v.x);
    const ys = verts.map((v) => v.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }

  // Set content type
  setContent(type: string, data: string) {
    this.contentType = type;
    if (type === "shader") {
      this.shaderType = data;
    } else if (type === "video") {
      this.videoSrc = data;
      this.loadVideo();
    }
  }

  // Load video element
  loadVideo() {
    if (this.videoSrc) {
      this.videoElement = document.createElement("video");
      this.videoElement.src = this.videoSrc;
      this.videoElement.loop = true;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
      this.videoElement.crossOrigin = "anonymous";
      this.videoElement
        .play()
        .catch((e) => console.log("Video play failed:", e));
    }
  }

  // Mesh Warp Methods
  toggleWarpMode() {
    if (this.warpMode) {
      this.warpMode = false;
    } else {
      // Enable Warp for ANY shape by initializing grid over bounding box
      this.warpMode = true;
      if (this.gridVertices.length === 0) {
        this.initGrid();
      }
    }
    return this.warpMode;
  }

  initGrid() {
    // Initialize a 3x3 grid based on Bounding Box
    const bounds = this.getBoundingBox();
    this.gridVertices = [];
    const steps = this.gridSize - 1;

    for (let y = 0; y <= steps; y++) {
      for (let x = 0; x <= steps; x++) {
        const u = x / steps;
        const v = y / steps;
        
        this.gridVertices.push({
          x: bounds.minX + u * bounds.width,
          y: bounds.minY + v * bounds.height,
        });
      }
    }
  }

  getBoundaryFromGrid() {
    if (this.gridVertices.length === 0) return this.vertices;

    const size = this.gridSize;
    const boundary: Vertex[] = [];
    
    // Top edge
    for (let i = 0; i < size; i++) boundary.push(this.gridVertices[i]);
    // Right edge
    for (let i = 1; i < size; i++)
      boundary.push(this.gridVertices[(i + 1) * size - 1]);
    // Bottom edge (reversed)
    for (let i = size - 2; i >= 0; i--)
      boundary.push(this.gridVertices[size * (size - 1) + i]);
    // Left edge (reversed)
    for (let i = size - 2; i > 0; i--)
      boundary.push(this.gridVertices[i * size]);

    return boundary;
  }

  getRenderVertices() {
    if (this.warpMode && this.gridVertices.length > 0) {
      return this.gridVertices;
    }
    // Return discretized vertices for rendering non-warped curves
    return this.getDiscretizedVertices(30);
  }

  // Serialize for saving
  toJSON() {
    return {
      id: this.id,
      vertices: this.vertices,
      type: this.type,
      contentType: this.contentType,
      shaderType: this.shaderType,
      videoSrc: this.videoSrc,
      effects: this.effects,
      warpMode: this.warpMode,
      gridVertices: this.gridVertices,
      audioSettings: this.audioSettings
    };
  }

  // Deserialize from saved data
  static fromJSON(data: any) {
    const poly = new Polygon(data.vertices, data.id, data.type);
    poly.contentType = data.contentType;
    poly.shaderType = data.shaderType;
    poly.videoSrc = data.videoSrc;
    
    // Convert old object effects to new array format if needed for migration
    if (data.effects && !Array.isArray(data.effects)) {
      // Migration logic
      poly.effects = [];
      if (data.effects.brightness)
        poly.effects.push({
          id: "mig1",
          type: "brightness",
          params: { value: data.effects.brightness },
        });
      if (data.effects.contrast && data.effects.contrast !== 1)
        poly.effects.push({
          id: "mig2",
          type: "contrast",
          params: { value: data.effects.contrast },
        });
      if (data.effects.patternMode) {
        const modes = ["none", "scanlines", "dots", "grid"];
        if (data.effects.patternMode > 0) {
          poly.effects.push({
            id: "mig3",
            type: modes[data.effects.patternMode],
            params: {
              scale: data.effects.patternScale,
              intensity: data.effects.patternIntensity,
              speed: 1.0
            },
          });
        }
      }
      if (data.effects.border)
        poly.effects.push({
          id: "mig4",
          type: "border",
          params: {
            width: data.effects.borderWidth,
            color: data.effects.borderColor,
            speed: 2.0
          },
        });
    } else {
      poly.effects = data.effects || [];
    }
    
    poly.warpMode = data.warpMode || false;
    poly.gridVertices = data.gridVertices || [];
    poly.audioSettings = data.audioSettings || {
      bassScale: 1.0,
      midScale: 1.0,
      highScale: 1.0,
      gain: 1.0,
      enabled: true,
    };

    if (poly.videoSrc) {
      poly.loadVideo();
    }
    return poly;
  }
}

// Helper function to create preset shapes
export class ShapeFactory {
  static createTriangle(centerX: number, centerY: number, size: number = 0.15) {
    const height = (size * Math.sqrt(3)) / 2;
    return new Polygon(
      [
        { x: centerX, y: centerY - height * 0.66 },
        { x: centerX - size / 2, y: centerY + height * 0.33 },
        { x: centerX + size / 2, y: centerY + height * 0.33 },
      ],
      null,
      "triangle"
    );
  }

  static createSquare(centerX: number, centerY: number, size: number = 0.15) {
    const half = size / 2;
    return new Polygon(
      [
        { x: centerX - half, y: centerY - half }, // TL
        { x: centerX + half, y: centerY - half }, // TR
        { x: centerX + half, y: centerY + half }, // BR
        { x: centerX - half, y: centerY + half }, // BL
      ],
      null,
      "quad"
    );
  }

  static createCircle(centerX: number, centerY: number, size: number = 0.15) {
    // Circle approximated by 4 Cubic Bezier Curves
    const r = size / 2;
    const k = r * 0.55228;
    
    const top: Vertex = {
      x: centerX,
      y: centerY - r,
      c1: { x: centerX - k, y: centerY - r }, // Incoming (from Left)
      c2: { x: centerX + k, y: centerY - r }, // Outgoing (to Right)
      bezier: true,
    };
    
    const right: Vertex = {
      x: centerX + r,
      y: centerY,
      c1: { x: centerX + r, y: centerY - k },
      c2: { x: centerX + r, y: centerY + k },
      bezier: true,
    };
    
    const bottom: Vertex = {
      x: centerX,
      y: centerY + r,
      c1: { x: centerX + k, y: centerY + r },
      c2: { x: centerX - k, y: centerY + r },
      bezier: true,
    };
    
    const left: Vertex = {
      x: centerX - r,
      y: centerY,
      c1: { x: centerX - r, y: centerY + k },
      c2: { x: centerX - r, y: centerY - k },
      bezier: true,
    };

    return new Polygon([top, right, bottom, left], null, "circle");
  }
}
