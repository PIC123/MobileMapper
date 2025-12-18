export interface Vertex {
  x: number;
  y: number;
  c1?: { x: number; y: number }; // Bezier control point 1
  c2?: { x: number; y: number }; // Bezier control point 2
  bezier?: boolean;
}

export interface AudioSettings {
  enabled: boolean;
  gain: number;
  bassScale: number;
  midScale: number;
  highScale: number;
}

export interface Effect {
  id: string;
  type: string;
  params: any;
}

export class Polygon {
  id: number;
  vertices: Vertex[];
  type: string;
  contentType: string;
  shaderType: string;
  videoSrc: string | null;
  videoElement: HTMLVideoElement | null;
  imageSrc: string | null;
  imageElement: HTMLImageElement | null;
  selected: boolean;
  effects: Effect[];
  warpMode: boolean;
  gridVertices: Vertex[];
  gridSize: number;
  audioSettings: AudioSettings;

  // Drawing Canvas Support
  drawingCanvas: HTMLCanvasElement | null;
  drawingCtx: CanvasRenderingContext2D | null;
  isDirty: boolean;
  useAsMask: boolean;

  // Hierarchy
  parent: Polygon | null;
  children: Polygon[];

  constructor(
    vertices: Vertex[],
    id: number | null = null,
    type: string = "polygon"
  ) {
    this.id = id || Date.now() + Math.random();
    this.vertices = vertices;
    this.type = type;

    // Content
    this.contentType = "shader";
    this.shaderType = "rainbow";
    this.videoSrc = null;
    this.videoElement = null;
    this.imageSrc = null;
    this.imageElement = null;

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

    // Drawing
    this.drawingCanvas = null;
    this.drawingCtx = null;
    this.isDirty = false;
    this.useAsMask = false;

    // Hierarchy
    this.parent = null;
    this.children = [];

    if (type === "drawing") {
      this.initDrawingCanvas();
    }
  }

  initDrawingCanvas() {
    this.drawingCanvas = document.createElement("canvas");
    this.drawingCanvas.width = 1024;
    this.drawingCanvas.height = 1024;
    this.drawingCtx = this.drawingCanvas.getContext("2d");
    this.contentType = "drawing";
    this.isDirty = true;
  }

  // Helper to create a grid for warping
  createGrid() {
    const bounds = this.getBoundingBox();
    this.gridVertices = [];
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        this.gridVertices.push({
          x: bounds.minX + (x / (this.gridSize - 1)) * bounds.width,
          y: bounds.minY + (y / (this.gridSize - 1)) * bounds.height,
        });
      }
    }
  }

  setGridSize(size: number) {
    if (this.gridSize !== size) {
      // If we resize, we unfortunately lose current warp points for now unless we interpolate
      // For simplicity, just reset grid based on bounding box
      this.gridSize = size;
      if (this.warpMode) {
        this.createGrid();
      }
    }
  }

  toggleWarpMode() {
    this.warpMode = !this.warpMode;
    if (this.warpMode && this.gridVertices.length === 0) {
      this.createGrid();
    }
  }

  addEffect(type: string) {
    const id = Date.now().toString();
    let params: any = {};
    if (type === "brightness") params = { value: 0.0 };
    else if (type === "contrast") params = { value: 1.0 };
    else if (type === "saturation") params = { value: 1.0 };
    else if (type === "hue") params = { value: 0.0 };
    else if (["scanlines", "dots", "grid"].includes(type))
      params = { scale: 10.0, intensity: 0.5, speed: 1.0 };
    else if (type === "border")
      params = { width: 0.02, color: { r: 1, g: 1, b: 1 }, speed: 2.0 };
    else if (type === "edge_detection")
      params = { threshold: 0.1, color: { r: 1, g: 1, b: 1 }, mode: 0, speed: 1.0 }; // mode: 0=Static, 1=Pulse, 2=Audio

    this.effects.push({ id, type, params });
  }

  removeEffect(id: string) {
    this.effects = this.effects.filter((e) => e.id !== id);
  }

  updateEffect(id: string, params: any) {
    const effect = this.effects.find((e) => e.id === id);
    if (effect) {
      effect.params = { ...effect.params, ...params };
    }
  }

  setContent(type: string, data: string) {
    this.contentType = type;
    if (type === "shader") {
      this.shaderType = data;
    } else if (type === "video") {
      this.videoSrc = data;
      this.loadVideo();
    } else if (type === "image") {
      this.imageSrc = data;
      this.loadImage();
    }
  }

  loadVideo() {
    if (!this.videoSrc) return;
    this.videoElement = document.createElement("video");
    this.videoElement.src = this.videoSrc;
    this.videoElement.loop = true;
    this.videoElement.muted = true;
    this.videoElement.setAttribute("playsinline", "");
    this.videoElement.setAttribute("webkit-playsinline", "");
    this.videoElement.play().catch((e) => console.warn("Video play failed", e));
  }

  loadImage() {
    if (!this.imageSrc) return;
    this.imageElement = new Image();
    this.imageElement.crossOrigin = "anonymous";
    this.imageElement.onload = () => {
        this.isDirty = true;
    };
    this.imageElement.src = this.imageSrc;
  }

  // Geometry Helpers
  getBoundingBox() {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    const verts =
      this.warpMode && this.gridVertices.length > 0
        ? this.gridVertices
        : this.vertices;

    verts.forEach((v) => {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    });

    // Handle edge case where grid might be weird or empty
    if (minX === Infinity)
      return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };

    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  getDiscretizedVertices(steps: number = 10): Vertex[] {
    const result: Vertex[] = [];
    for (let i = 0; i < this.vertices.length; i++) {
      const current = this.vertices[i];
      const next = this.vertices[(i + 1) % this.vertices.length];

      if (current.bezier && current.c2 && next.c1) {
        for (let t = 0; t < 1; t += 1 / steps) {
          const x =
            Math.pow(1 - t, 3) * current.x +
            3 * Math.pow(1 - t, 2) * t * current.c2.x +
            3 * (1 - t) * Math.pow(t, 2) * next.c1.x +
            Math.pow(t, 3) * next.x;
          const y =
            Math.pow(1 - t, 3) * current.y +
            3 * Math.pow(1 - t, 2) * t * current.c2.y +
            3 * (1 - t) * Math.pow(t, 2) * next.c1.y +
            Math.pow(t, 3) * next.y;
          result.push({ x, y });
        }
      } else {
        result.push(current);
      }
    }
    return result;
  }

  getRenderVertices() {
    return this.warpMode ? this.gridVertices : this.vertices;
  }

  // Hit Testing
  containsPoint(x: number, y: number) {
    // Ray casting algorithm
    let inside = false;
    const verts = this.getDiscretizedVertices(10);
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

  getVertexAtPoint(x: number, y: number, threshold: number = 0.02) {
    // Check Grid first if warp mode
    if (this.warpMode) {
      for (let i = 0; i < this.gridVertices.length; i++) {
        const v = this.gridVertices[i];
        if (Math.sqrt((v.x - x) ** 2 + (v.y - y) ** 2) < threshold) {
          return { type: "grid", index: i };
        }
      }
      return null;
    }

    // Check Standard Vertices and Handles
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];

      if (Math.sqrt((v.x - x) ** 2 + (v.y - y) ** 2) < threshold) {
        return { type: "vertex", index: i };
      }

      if (v.bezier) {
        if (
          v.c1 &&
          Math.sqrt((v.c1.x - x) ** 2 + (v.c1.y - y) ** 2) < threshold
        )
          return { type: "c1", index: i };
        if (
          v.c2 &&
          Math.sqrt((v.c2.x - x) ** 2 + (v.c2.y - y) ** 2) < threshold
        )
          return { type: "c2", index: i };
      }
    }
    return null;
  }

  moveVertex(selection: { type: string; index: number }, x: number, y: number) {
    if (selection.type === "grid") {
      this.gridVertices[selection.index].x = x;
      this.gridVertices[selection.index].y = y;
    } else if (selection.type === "vertex") {
      const v = this.vertices[selection.index];
      const dx = x - v.x;
      const dy = y - v.y;
      v.x = x;
      v.y = y;

      // Move handles too
      if (v.c1) {
        v.c1.x += dx;
        v.c1.y += dy;
      }
      if (v.c2) {
        v.c2.x += dx;
        v.c2.y += dy;
      }
    } else if (selection.type === "c1") {
      this.vertices[selection.index].c1 = { x, y };
    } else if (selection.type === "c2") {
      this.vertices[selection.index].c2 = { x, y };
    }
  }

  translate(dx: number, dy: number) {
    this.vertices.forEach((v) => {
      v.x += dx;
      v.y += dy;
      if (v.c1) {
        v.c1.x += dx;
        v.c1.y += dy;
      }
      if (v.c2) {
        v.c2.x += dx;
        v.c2.y += dy;
      }
    });
    if (this.warpMode) {
      this.gridVertices.forEach((v) => {
        v.x += dx;
        v.y += dy;
      });
    }
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
      imageSrc: this.imageSrc,
      effects: this.effects,
      warpMode: this.warpMode,
      gridVertices: this.gridVertices,
      gridSize: this.gridSize,
      audioSettings: this.audioSettings,
      useAsMask: this.useAsMask,
      drawingData: this.drawingCanvas ? this.drawingCanvas.toDataURL() : null,
      children: this.children.map((c) => c.toJSON()),
    };
  }

  // Deserialize from saved data
  static fromJSON(data: any) {
    const poly = new Polygon(data.vertices, data.id, data.type);
    poly.contentType = data.contentType;
    poly.shaderType = data.shaderType;
    poly.videoSrc = data.videoSrc;
    poly.imageSrc = data.imageSrc;
    poly.useAsMask = data.useAsMask || false;
    poly.effects = data.effects || [];
    poly.warpMode = data.warpMode || false;
    poly.gridVertices = data.gridVertices || [];
    poly.gridSize = data.gridSize || 3;
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
    
    if (poly.imageSrc) {
      poly.loadImage();
    }

    if (data.type === "drawing" && data.drawingData) {
      poly.initDrawingCanvas();
      const img = new Image();
      img.onload = () => {
        poly.drawingCtx!.drawImage(img, 0, 0);
        poly.isDirty = true;
      };
      img.src = data.drawingData;
    }

    if (data.children) {
      poly.children = data.children.map((c: any) => {
        const child = Polygon.fromJSON(c);
        child.parent = poly;
        return child;
      });
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

  static createWarpRect(centerX: number, centerY: number, size: number = 0.15) {
    const p = ShapeFactory.createSquare(centerX, centerY, size);
    p.warpMode = true;
    p.createGrid();
    return p;
  }

  static createCanvas(centerX: number, centerY: number, size: number = 0.5) {
    const half = size / 2;
    return new Polygon(
      [
        { x: centerX - half, y: centerY - half }, // TL
        { x: centerX + half, y: centerY - half }, // TR
        { x: centerX + half, y: centerY + half }, // BR
        { x: centerX - half, y: centerY + half }, // BL
      ],
      null,
      "drawing"
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
