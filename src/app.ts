import { Renderer } from "./renderer";
import { Polygon, ShapeFactory, AudioSettings } from "./polygon";
import { AudioManager } from "./audio_manager";
import "./styles.css";

// Helper for safe local storage
const safeStorage = {
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("LocalStorage access denied", e);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("LocalStorage set failed", e);
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("LocalStorage remove failed", e);
    }
  }
};

// Safe element lookup
const getEl = (id: string): HTMLElement | null => document.getElementById(id);

// Color Helpers
const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => {
        return r + r + g + g + b + b;
    });
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 1, g: 1, b: 1 };
};

const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (c: number) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return "#" + toHex(r) + toHex(g) + toHex(b);
};

// Main application logic
class MobileMapperApp {
  canvas: HTMLCanvasElement;
  overlayCanvas: HTMLCanvasElement;
  overlayCtx: CanvasRenderingContext2D;
  renderer: Renderer;
  audioManager: AudioManager;
  polygons: Polygon[];
  selectedPolygon: Polygon | null;
  selectedVertex: { type: string; index: number } | null;
  currentTool: string;
  drawingVertices: any[];
  isDrawing: boolean;
  dragStart: { x: number; y: number } | null;
  editMode: boolean;
  loadedVideos: Map<string, string>;
  loadedImages: Map<string, string>;
  controlsDragStart: { x: number; y: number } | null;
  controlsPosition: { x: number | null; y: number | null };
  uiVisible: boolean;
  userHasToggledMode: boolean;
  lastBrushPos: { x: number; y: number } | null = null;
  isDraggingVertex: boolean = false;
  isPlacingPoint: boolean = false;
  
  // Dragging State for Layers
  draggingLayer: Polygon | null = null;
  dragGhost: HTMLElement | null = null;
  dragStartY: number = 0;
  dragTimeout: any = null;

  constructor() {
    this.canvas = document.getElementById("mainCanvas") as HTMLCanvasElement;
    this.overlayCanvas = document.getElementById(
      "overlayCanvas"
    ) as HTMLCanvasElement;
    this.overlayCtx = this.overlayCanvas.getContext("2d")!;
    this.renderer = new Renderer(this.canvas);
    this.audioManager = new AudioManager();
    this.polygons = [];
    this.selectedPolygon = null;
    this.selectedVertex = null;
    this.currentTool = "select";
    this.drawingVertices = [];
    this.isDrawing = false;
    this.dragStart = null;
    this.editMode = true;
    this.loadedVideos = new Map();
    this.loadedImages = new Map();
    this.controlsDragStart = null;
    this.controlsPosition = { x: null, y: null };
    this.uiVisible = true;
    this.userHasToggledMode = false;
    
    try {
      this.setupEventListeners();
      this.resizeOverlay();
      
      window.addEventListener("resize", () => {
        this.resizeOverlay();
      });
      
      this.showWelcomeModal();
      this.animate();
    } catch (e) {
      console.error("Critical Initialization Error:", e);
      this.showStatus("App failed to initialize. Check console.");
    }
  }

  resizeOverlay() {
    if (!this.overlayCanvas) return;
    const displayWidth = this.overlayCanvas.clientWidth;
    const displayHeight = this.overlayCanvas.clientHeight;

    if (
      this.overlayCanvas.width !== displayWidth ||
      this.overlayCanvas.height !== displayHeight
    ) {
      this.overlayCanvas.width = displayWidth;
      this.overlayCanvas.height = displayHeight;
    }
  }

  setupEventListeners() {
    const bindClick = (id: string, fn: () => void) => {
      const el = getEl(id);
      if (el) el.addEventListener("click", fn);
    };

    bindClick("toggleSidebarBtn", () => {
        const sidebar = getEl("leftSidebar");
        if (sidebar) sidebar.classList.toggle("hidden");
    });

    bindClick("toggleRightSidebarBtn", () => {
        const sidebar = getEl("rightSidebar");
        if (sidebar) sidebar.classList.toggle("hidden");
    });

    document.querySelectorAll(".sidebar-section h3").forEach((header) => {
      (header as HTMLElement).style.cursor = "pointer";
      header.addEventListener("click", (e) => {
        const section = (e.target as HTMLElement).closest(".sidebar-section");
        if (!section) return;
        Array.from(section.children).forEach((child) => {
          if (child.tagName !== "H3") {
            const el = child as HTMLElement;
            el.style.display = el.style.display === "none" ? "" : "none";
          }
        });
      });
    });

    bindClick("addTriangleBtn", () => this.setTool("triangle"));
    bindClick("addSquareBtn", () => this.setTool("square"));
    bindClick("addCircleBtn", () => this.setTool("circle"));
    bindClick("drawPolygonBtn", () => this.setTool("draw"));
    
    bindClick("addWarpRectBtn", () => {
        const poly = ShapeFactory.createWarpRect(0.5, 0.5, 0.5);
        this.addPolygon(poly);
    });

    bindClick("addCanvasBtn", () => {
      const poly = ShapeFactory.createCanvas(0.5, 0.5); // Center
      this.polygons.push(poly);
      this.selectPolygon(poly);
      this.setTool("brush");
    });

    bindClick("selectBtn", () => this.setTool("select"));
    bindClick("brushBtn", () => this.setTool("brush"));
    bindClick("deleteBtn", () => this.deleteSelected());

    // Brush Controls
    const updateBrushSettings = () => {
      const sizeEl = getEl("brushSizeSlider") as HTMLInputElement;
      const opacityEl = getEl("brushOpacitySlider") as HTMLInputElement;
      const colorEl = getEl("brushColorPicker") as HTMLInputElement;
      const eraserEl = getEl("eraserToggle") as HTMLInputElement;

      if (!sizeEl || !opacityEl || !colorEl || !eraserEl) return { size: 5, opacity: 1, color: "#fff", eraser: false };

      const size = parseInt(sizeEl.value);
      const opacity = parseFloat(opacityEl.value);
      const color = colorEl.value;
      const eraser = eraserEl.checked;

      const sizeVal = getEl("brushSizeVal");
      const opacityVal = getEl("brushOpacityVal");
      if (sizeVal) sizeVal.textContent = size.toString();
      if (opacityVal) opacityVal.textContent = opacity.toFixed(1);

      return { size, opacity, color, eraser };
    };

    ["brushSizeSlider", "brushOpacitySlider", "brushColorPicker", "eraserToggle"].forEach((id) => {
      const el = getEl(id);
      if (el) el.addEventListener("input", updateBrushSettings);
    });

    bindClick("clearCanvasBtn", () => {
      if (
        this.selectedPolygon &&
        this.selectedPolygon.type === "drawing" &&
        this.selectedPolygon.drawingCtx
      ) {
        const ctx = this.selectedPolygon.drawingCtx;
        ctx.clearRect(0, 0, 1024, 1024);
        this.selectedPolygon.isDirty = true;
      }
    });

    const useMaskToggle = getEl("useAsMaskToggle");
    if (useMaskToggle) {
        useMaskToggle.addEventListener("change", (e) => {
            if (this.selectedPolygon && this.selectedPolygon.type === "drawing") {
              this.selectedPolygon.useAsMask = (e.target as HTMLInputElement).checked;
            }
        });
    }

    bindClick("changeContentBtn", () => this.showContentModal());
    
    const warpToggle = getEl("warpToggle");
    if (warpToggle) {
        warpToggle.addEventListener("change", (e) => {
            this.toggleWarpMode((e.target as HTMLInputElement).checked);
        });
    }

    const gridSizeSlider = getEl("gridSizeSlider");
    if (gridSizeSlider) {
        gridSizeSlider.addEventListener("input", (e) => {
            if (this.selectedPolygon) {
                const val = parseInt((e.target as HTMLInputElement).value);
                const v1 = getEl("gridSizeVal");
                const v2 = getEl("gridSizeVal2");
                if (v1) v1.textContent = val.toString();
                if (v2) v2.textContent = val.toString();
                this.selectedPolygon.setGridSize(val);
            }
        });
    }

    // Audio Settings Controls
    const audioEnabled = getEl("audioEnabledToggle");
    if (audioEnabled) {
        audioEnabled.addEventListener("change", (e) => {
            if (this.selectedPolygon) {
              this.selectedPolygon.audioSettings.enabled = (e.target as HTMLInputElement).checked;
            }
        });
    }

    const bindAudioSlider = (id: string, param: keyof AudioSettings) => {
      const slider = getEl(id) as HTMLInputElement;
      if (slider) {
          slider.addEventListener("input", (e) => {
            if (this.selectedPolygon) {
              (this.selectedPolygon.audioSettings as any)[param] = parseFloat(
                (e.target as HTMLInputElement).value
              );
            }
          });
      }
    };

    bindAudioSlider("audioGainSlider", "gain");
    bindAudioSlider("audioBassSlider", "bassScale");
    bindAudioSlider("audioMidSlider", "midScale");
    bindAudioSlider("audioHighSlider", "highScale");

    bindClick("addEffectBtn", () => {
      const select = getEl("effectTypeSelect") as HTMLSelectElement;
      if (select) this.addEffect(select.value);
    });

    bindClick("performanceBtn", () => this.togglePerformanceMode());
    bindClick("fullscreenBtn", () => this.toggleFullscreen());
    bindClick("saveBtn", () => this.saveProject());
    bindClick("loadBtn", () => this.loadProjectDialog());
    bindClick("audioToggleBtn", () => this.toggleAudio());
      
    this.canvas.addEventListener("touchstart", (e) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener("touchmove", (e) => this.handleTouchMove(e), { passive: false });
    this.canvas.addEventListener("touchend", (e) => this.handleTouchEnd(e), { passive: false });
    this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    document.addEventListener("mouseup", (e) => this.handleMouseUp(e));

    document.querySelectorAll(".arrow-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.finetuneVertex((btn as HTMLElement).dataset.dir!);
      });
    });

    bindClick("toggleCurveBtn", () => this.toggleVertexCurve());

    document.querySelectorAll(".close-modal").forEach((btn) => {
      btn.addEventListener("click", () => this.hideAllModals());
    });

    document.querySelectorAll(".content-type-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = (btn as HTMLElement).dataset.type;
        if (type === "shader") this.showShaderModal();
        else if (type === "video") this.showVideoModal();
        else if (type === "image") this.showImageModal();
      });
    });

    document.querySelectorAll(".shader-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.setPolygonContent("shader", (btn as HTMLElement).dataset.shader!);
      });
    });

    const videoInput = getEl("videoFileInput");
    if (videoInput) {
        videoInput.addEventListener("change", (e) => this.handleVideoUpload(e as any));
    }

    const imageInput = getEl("imageFileInput");
    if (imageInput) {
        imageInput.addEventListener("change", (e) => this.handleImageUpload(e as any));
    }

    const performanceOverlay = getEl("performanceOverlay");
    if (performanceOverlay) {
        performanceOverlay.addEventListener("click", () => {
          if (!this.editMode) this.togglePerformanceMode();
        });
        performanceOverlay.addEventListener("touchstart", (e) => {
            if (!this.editMode) {
              e.preventDefault();
              this.togglePerformanceMode();
            }
          }, { passive: false }
        );
    }

    const vertexControls = getEl("vertexControls");
    if (vertexControls) {
        const dragHandle = vertexControls.querySelector(".control-drag-handle");
        if (dragHandle) {
            dragHandle.addEventListener("mousedown", (e) => this.startControlsDrag(e as MouseEvent));
            dragHandle.addEventListener("touchstart", (e) => this.startControlsDrag(e as unknown as MouseEvent), { passive: false });
        }
    }
    
    document.addEventListener("mousemove", (e) => this.moveControls(e));
    document.addEventListener("touchmove", (e) => this.moveControls(e as unknown as MouseEvent), { passive: false });
    document.addEventListener("mouseup", () => this.stopControlsDrag());
    document.addEventListener("touchend", () => this.stopControlsDrag());

    // Project Buttons
    bindClick("newProjectBtn", () => this.startNewProject());
    bindClick("loadProjectFileBtn", () => this.loadProjectFromFile());
    bindClick("continueProjectBtn", () => this.continueLastProject());
  }
  
  addPolygon(poly: Polygon) {
      this.polygons.push(poly);
      this.selectPolygon(poly);
      this.setTool("select");
      this.renderLayersList(); // Ensure UI updates
  }

  handleBrushStroke(clientX: number, clientY: number, isStart: boolean) {
    const poly = this.selectedPolygon;
    if (!poly || poly.type !== "drawing" || !poly.drawingCtx) return;

    const bounds = poly.getBoundingBox();
    const rect = this.canvas.getBoundingClientRect();
    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;

    const u = (normX - bounds.minX) / bounds.width;
    const v = (normY - bounds.minY) / bounds.height;

    if (u < 0 || u > 1 || v < 0 || v > 1) {
      this.lastBrushPos = null;
      return;
    }

    const ctx = poly.drawingCtx;
    const canvasW = poly.drawingCanvas!.width;
    const canvasH = poly.drawingCanvas!.height;

    const x = u * canvasW;
    const y = v * canvasH;

    const sizeEl = getEl("brushSizeSlider") as HTMLInputElement;
    const opacityEl = getEl("brushOpacitySlider") as HTMLInputElement;
    const colorEl = getEl("brushColorPicker") as HTMLInputElement;
    const eraserEl = getEl("eraserToggle") as HTMLInputElement;

    const size = sizeEl ? parseInt(sizeEl.value) : 5;
    const opacity = opacityEl ? parseFloat(opacityEl.value) : 1.0;
    const color = colorEl ? colorEl.value : "#fff";
    const eraser = eraserEl ? eraserEl.checked : false;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = size;

    if (eraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = `rgba(0,0,0,${opacity})`;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = size;
    }

    if (isStart || !this.lastBrushPos) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(this.lastBrushPos.x, this.lastBrushPos.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1.0;

    this.lastBrushPos = { x, y };
    poly.isDirty = true;
  }

  handlePointerDown(clientX: number, clientY: number) {
    const coords = this.getNormalizedCoords(clientX, clientY);

    if (this.currentTool === "brush") {
      if (this.selectedPolygon && this.selectedPolygon.type === "drawing") {
        this.isDrawing = true;
        this.handleBrushStroke(clientX, clientY, true);
      }
      return;
    }

    if (this.currentTool === "triangle") {
      const poly = ShapeFactory.createTriangle(coords.x, coords.y);
      this.addPolygon(poly);
    } else if (this.currentTool === "square") {
      const poly = ShapeFactory.createSquare(coords.x, coords.y);
      this.addPolygon(poly);
    } else if (this.currentTool === "circle") {
      const poly = ShapeFactory.createCircle(coords.x, coords.y);
      this.addPolygon(poly);
    } else if (this.currentTool === "draw") {
      if (this.drawingVertices.length >= 3) {
        const first = this.drawingVertices[0];
        const dist = Math.sqrt(
          (coords.x - first.x) ** 2 + (coords.y - first.y) ** 2
        );
        if (dist < 0.05) {
          this.finishDrawing();
          return;
        }
      }
      this.drawingVertices.push({ x: coords.x, y: coords.y });
      this.isPlacingPoint = true;
      this.isDrawing = true;
    } else if (this.currentTool === "select") {
      let foundSelection = false;

      // Check all polygons including children for selection
      const allPolys: Polygon[] = [];
      this.polygons.forEach(p => {
          allPolys.push(p);
          if (p.children) allPolys.push(...p.children);
      });

      for (let i = allPolys.length - 1; i >= 0; i--) {
        const poly = allPolys[i];
        const selection = poly.getVertexAtPoint(coords.x, coords.y);
        if (selection) {
          this.selectPolygon(poly);
          this.selectedVertex = selection;
          this.isDraggingVertex = true;
          this.updateVertexControls(true);
          foundSelection = true;
          break;
        }
      }

      if (!foundSelection) {
        for (let i = allPolys.length - 1; i >= 0; i--) {
          const poly = allPolys[i];
          if (poly.containsPoint(coords.x, coords.y)) {
            this.selectPolygon(poly);
            this.selectedVertex = null;
            this.updateVertexControls(false);
            this.dragStart = coords;
            foundSelection = true;
            break;
          }
        }

        if (!foundSelection) {
          this.selectPolygon(null);
          this.selectedVertex = null;
          this.updateVertexControls(false);
        }
      }
    }
    // Update list to reflect any changes
    this.renderLayersList();
  }

  handlePointerMove(clientX: number, clientY: number) {
    if (this.currentTool === "brush" && this.isDrawing) {
      this.handleBrushStroke(clientX, clientY, false);
      return;
    }

    const coords = this.getNormalizedCoords(clientX, clientY);

    if (this.currentTool === "draw" && this.isPlacingPoint && this.drawingVertices.length > 0) {
      // Update the last added point
      this.drawingVertices[this.drawingVertices.length - 1] = { x: coords.x, y: coords.y };
      return;
    }

    if (this.isDraggingVertex && this.selectedPolygon && this.selectedVertex) {
      this.selectedPolygon.moveVertex(this.selectedVertex, coords.x, coords.y);
    } else if (this.selectedPolygon && this.dragStart) {
      const dx = coords.x - this.dragStart.x;
      const dy = coords.y - this.dragStart.y;
      this.selectedPolygon.translate(dx, dy);
      this.dragStart = coords;
    }
  }

  handlePointerUp() {
    this.isDraggingVertex = false;
    
    if (this.currentTool === "draw") {
      this.isPlacingPoint = false;
    }

    if (this.currentTool === "brush") {
      this.isDrawing = false;
      this.lastBrushPos = null;
    }

    if (this.dragStart) {
      this.dragStart = null;
    }
  }

  // ... rest of the file ...
  finishDrawing() {
    if (this.drawingVertices.length >= 3) {
      const poly = new Polygon(this.drawingVertices);
      this.addPolygon(poly);
    }
    this.drawingVertices = [];
    this.isDrawing = false;
    this.setTool("select");
    
    const leftSidebar = getEl("leftSidebar");
    if (leftSidebar && window.innerWidth < 768) {
      leftSidebar.classList.remove("hidden");
    }
  }

  selectPolygon(poly: Polygon | null) {
    // Deselect all
    this.polygons.forEach((p) => {
        p.selected = false;
        if (p.children) p.children.forEach(c => c.selected = false);
    });
    
    this.selectedPolygon = poly;

    const rightSidebar = getEl("rightSidebar");

    if (poly) {
      poly.selected = true;
      if (rightSidebar) rightSidebar.classList.remove("hidden");
      this.updatePropertiesPanel(poly);

      // Auto-switch tool logic
      if (poly.type !== "drawing" && this.currentTool === "brush") {
        this.setTool("select");
      }
    } else {
      if (rightSidebar) rightSidebar.classList.add("hidden");
    }
    this.renderLayersList();
  }

  updatePropertiesPanel(poly: Polygon) {
    const infoDisplay = getEl("currentContentInfo");
    if (infoDisplay) {
        if (poly.contentType === "video") {
          infoDisplay.textContent = "Video";
        } else if (poly.contentType === "image") {
          infoDisplay.textContent = "Image";
        } else {
          infoDisplay.textContent = `Shader: ${poly.shaderType}`;
        }
    }

    const warpToggle = getEl("warpToggle") as HTMLInputElement;
    if (warpToggle) warpToggle.checked = poly.warpMode;
      
    // Grid Size Control Visibility
    const warpSettings = getEl("warpSettings");
    if (poly.warpMode) {
        if (warpSettings) warpSettings.classList.remove("hidden");
        const slider = getEl("gridSizeSlider") as HTMLInputElement;
        if (slider) slider.value = poly.gridSize.toString();
        const v1 = getEl("gridSizeVal");
        if (v1) v1.textContent = poly.gridSize.toString();
        const v2 = getEl("gridSizeVal2");
        if (v2) v2.textContent = poly.gridSize.toString();
    } else {
        if (warpSettings) warpSettings.classList.add("hidden");
    }

    // Update Audio UI
    const audioEnabled = getEl("audioEnabledToggle") as HTMLInputElement;
    if (audioEnabled) audioEnabled.checked = poly.audioSettings.enabled;
    
    const audioGain = getEl("audioGainSlider") as HTMLInputElement;
    if (audioGain) audioGain.value = poly.audioSettings.gain.toString();
    
    const audioBass = getEl("audioBassSlider") as HTMLInputElement;
    if (audioBass) audioBass.value = poly.audioSettings.bassScale.toString();
    
    const audioMid = getEl("audioMidSlider") as HTMLInputElement;
    if (audioMid) audioMid.value = poly.audioSettings.midScale.toString();
    
    const audioHigh = getEl("audioHighSlider") as HTMLInputElement;
    if (audioHigh) audioHigh.value = poly.audioSettings.highScale.toString();

    // Toggle Visibility based on type
    const canvasMaskControl = getEl("canvasMaskControl");
    const brushControls = getEl("brushControls");

    if (poly.type === "drawing") {
      if (canvasMaskControl) canvasMaskControl.classList.remove("hidden");
      const maskToggle = getEl("useAsMaskToggle") as HTMLInputElement;
      if (maskToggle) maskToggle.checked = poly.useAsMask;

      if (this.currentTool === "brush") {
        if (brushControls) brushControls.classList.remove("hidden");
      } else {
        if (brushControls) brushControls.classList.add("hidden");
      }
    } else {
      if (canvasMaskControl) canvasMaskControl.classList.add("hidden");
      if (brushControls) brushControls.classList.add("hidden");
    }

    this.renderEffectsList(poly);
  }
  
  addEffect(type: string) {
    if (!this.selectedPolygon) return;
    const existing = this.selectedPolygon.effects.find((e) => e.type === type);
    if (existing) {
      this.showStatus(`${type} effect already added`);
      return;
    }

    this.selectedPolygon.addEffect(type);
    this.updatePropertiesPanel(this.selectedPolygon);
  }

  removeEffect(id: string) {
    if (!this.selectedPolygon) return;
    this.selectedPolygon.removeEffect(id);
    this.updatePropertiesPanel(this.selectedPolygon);
  }

  renderEffectsList(poly: Polygon) {
    const list = getEl("effectsListContainer");
    if (!list) return;
    list.innerHTML = "";

    if (!poly.effects || poly.effects.length === 0) {
      list.innerHTML =
        "<div style='opacity:0.5; font-size:12px; padding:8px;'>No effects added</div>";
      return;
    }

    poly.effects.forEach((effect) => {
      const item = document.createElement("div");
      item.className = "effect-item";

      let controls = "";
      const p = effect.params;

      if (
        ["brightness", "contrast", "saturation", "hue"].includes(effect.type)
      ) {
        const min = effect.type === "brightness" ? -1 : 0;
        const max = effect.type === "brightness" ? 1 : 2;
        const step = effect.type === "hue" ? 0.01 : 0.1;
        controls = `
                <div class="control-group">
                    <label>Value: <span id="val-${effect.id}">${p.value.toFixed(
          2
        )}</span></label>
                    <input type="range" min="${min}" max="${max}" step="${step}" value="${
          p.value
        }" 
                           data-effect-id="${effect.id}" data-param="value">
                </div>
            `;
      } else if (["scanlines", "dots", "grid"].includes(effect.type)) {
        controls = `
                <div class="control-group">
                    <label>Scale</label>
                    <input type="range" min="1" max="100" value="${p.scale}"
                           data-effect-id="${effect.id}" data-param="scale">
                </div>
                <div class="control-group">
                    <label>Intensity</label>
                    <input type="range" min="0" max="1" step="0.1" value="${
                      p.intensity
                    }"
                           data-effect-id="${effect.id}" data-param="intensity">
                </div>
                <div class="control-group">
                    <label>Anim Speed</label>
                    <input type="range" min="0" max="5" step="0.1" value="${
                      p.speed !== undefined ? p.speed : 1.0
                    }"
                           data-effect-id="${effect.id}" data-param="speed">
                </div>
            `;
      } else if (effect.type === "border") {
        const hexColor = effect.params.color ? rgbToHex(effect.params.color.r, effect.params.color.g, effect.params.color.b) : "#ffffff";
        controls = `
                <div class="control-group">
                    <label>Width</label>
                    <input type="range" min="0.01" max="0.2" step="0.01" value="${
                      p.width
                    }"
                           data-effect-id="${effect.id}" data-param="width">
                </div>
                <div class="control-group">
                    <label>Color</label>
                    <input type="color" value="${hexColor}"
                           data-effect-id="${effect.id}" data-param="color">
                </div>
                <div class="control-group">
                    <label>Pulse Speed</label>
                    <input type="range" min="0" max="10" step="0.1" value="${
                      p.speed !== undefined ? p.speed : 0.0
                    }"
                           data-effect-id="${effect.id}" data-param="speed">
                </div>
            `;
      } else if (effect.type === "edge_detection") {
        const hexColor = effect.params.color ? rgbToHex(effect.params.color.r, effect.params.color.g, effect.params.color.b) : "#ffffff";
        controls = `
            <div class="control-group">
                <label>Threshold</label>
                <input type="range" min="0.01" max="1.0" step="0.01" value="${p.threshold}"
                        data-effect-id="${effect.id}" data-param="threshold">
            </div>
            <div class="control-group">
                <label>Edge Color</label>
                <input type="color" value="${hexColor}"
                        data-effect-id="${effect.id}" data-param="color">
            </div>
            <div class="control-group">
                <label>Animation</label>
                <select data-effect-id="${effect.id}" data-param="mode" class="dropdown" style="width:100%; margin-top:4px; background: #333; color: white; border: 1px solid #555;">
                    <option value="0" ${p.mode == 0 ? 'selected' : ''}>Static</option>
                    <option value="1" ${p.mode == 1 ? 'selected' : ''}>Pulse (Time)</option>
                    <option value="2" ${p.mode == 2 ? 'selected' : ''}>Audio Reactive</option>
                </select>
            </div>
            <div class="control-group">
                <label>Speed</label>
                <input type="range" min="0" max="10" step="0.1" value="${p.speed !== undefined ? p.speed : 1.0}"
                        data-effect-id="${effect.id}" data-param="speed">
            </div>
        `;
      }

      item.innerHTML = `
            <div class="effect-header">
                <span>${effect.type.toUpperCase()}</span>
                <button class="effect-remove" data-effect-id="${
                  effect.id
                }">✕</button>
            </div>
            ${controls}
        `;

      const removeBtn = item.querySelector(".effect-remove");
      if (removeBtn) {
        removeBtn.addEventListener("click", (e) => {
          const target = e.target as HTMLElement;
          this.removeEffect(target.dataset.effectId!);
        });
      }

      const inputs = item.querySelectorAll('input, select');
      inputs.forEach((input) => {
        input.addEventListener("input", (e) => {
          const target = e.target as HTMLInputElement;
          const param = target.dataset.param!;
          const effectId = target.dataset.effectId!;

          let val: any;
          if (target.type === "checkbox") val = target.checked;
          else if (target.type === "color") val = hexToRgb(target.value);
          else if (target.tagName === "SELECT") val = parseInt(target.value);
          else val = parseFloat(target.value);

          const update: any = {};
          update[param] = val;
          this.updateEffectParam(effectId, update);
        });
      });

      list.appendChild(item);
    });
  }

  updateEffectParam(id: string, params: any) {
    if (this.selectedPolygon) {
      this.selectedPolygon.updateEffect(id, params);
      const valLabel = getEl(`val-${id}`);
      if (valLabel && params.value !== undefined) {
        valLabel.textContent = params.value.toFixed(2);
      }
    }
  }

  showStatus(msg: string) {
    const el = getEl("statusMsg");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => {
      el.classList.add("hidden");
    }, 2000);
  }

  loadProjectDialog() {
    this.loadProjectFromFile();
  }

  startControlsDrag(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const vertexControls = getEl("vertexControls");
    if (!vertexControls) return;
    const rect = vertexControls.getBoundingClientRect();

    const clientX = (e as any).touches
      ? (e as any).touches[0].clientX
      : e.clientX;
    const clientY = (e as any).touches
      ? (e as any).touches[0].clientY
      : e.clientY;

    this.controlsDragStart = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  moveControls(e: MouseEvent) {
    if (!this.controlsDragStart) return;

    e.preventDefault();
    const clientX = (e as any).touches
      ? (e as any).touches[0].clientX
      : e.clientX;
    const clientY = (e as any).touches
      ? (e as any).touches[0].clientY
      : e.clientY;

    const vertexControls = getEl("vertexControls");
    if (!vertexControls) return;

    const newX = clientX - this.controlsDragStart.x;
    const newY = clientY - this.controlsDragStart.y;

    const maxX = window.innerWidth - vertexControls.offsetWidth;
    const maxY = window.innerHeight - vertexControls.offsetHeight;

    this.controlsPosition.x = Math.max(0, Math.min(newX, maxX));
    this.controlsPosition.y = Math.max(0, Math.min(newY, maxY));

    vertexControls.style.left = this.controlsPosition.x + "px";
    vertexControls.style.top = this.controlsPosition.y + "px";
    vertexControls.style.right = "auto";
    vertexControls.style.bottom = "auto";
    vertexControls.style.transform = "none";
  }

  stopControlsDrag() {
    this.controlsDragStart = null;
  }

  setTool(tool: string) {
    this.currentTool = tool;
    this.isDrawing = false;
    this.drawingVertices = [];

    document
      .querySelectorAll(".tool-btn")
      .forEach((btn) => btn.classList.remove("active"));
    
    const activate = (id: string) => { const el = getEl(id); if (el) el.classList.add("active"); };

    if (tool === "select") activate("selectBtn");
    else if (tool === "brush") {
      activate("brushBtn");
      if (this.selectedPolygon && this.selectedPolygon.type === "drawing") {
        const brushControls = getEl("brushControls");
        if (brushControls) brushControls.classList.remove("hidden");
      }
    } else {
      if (tool === "triangle") activate("addTriangleBtn");
      else if (tool === "square") activate("addSquareBtn");
      else if (tool === "circle") activate("addCircleBtn");
      else if (tool === "draw") activate("drawPolygonBtn");

      if (window.innerWidth < 768) {
        const left = getEl("leftSidebar");
        const right = getEl("rightSidebar");
        if (left) left.classList.add("hidden");
        if (right) right.classList.add("hidden");
      }
    }

    if (tool !== "brush") {
      const brushControls = getEl("brushControls");
      if (brushControls) brushControls.classList.add("hidden");
    }
  }

  getNormalizedCoords(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }

  handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.handlePointerDown(touch.clientX, touch.clientY);
    }
  }

  handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.handlePointerMove(touch.clientX, touch.clientY);
    }
  }

  handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    this.handlePointerUp();
  }

  handleMouseDown(e: MouseEvent) {
    this.handlePointerDown(e.clientX, e.clientY);
  }

  handleMouseMove(e: MouseEvent) {
    this.handlePointerMove(e.clientX, e.clientY);
  }

  handleMouseUp(e: MouseEvent) {
    this.handlePointerUp();
  }

  toggleWarpMode(enabled: boolean) {
    if (this.selectedPolygon) {
      if (enabled !== this.selectedPolygon.warpMode) {
        this.selectedPolygon.toggleWarpMode();
      }
      this.selectedVertex = null;
      this.updateVertexControls(false);
      this.updatePropertiesPanel(this.selectedPolygon); // Update grid slider visibility
    }
  }

  updateVertexControls(show: boolean) {
    const vertexControls = getEl("vertexControls");
    if (!vertexControls) return;
    if (show && this.selectedVertex) {
      vertexControls.classList.remove("hidden");
    } else {
      vertexControls.classList.add("hidden");
    }
  }

  finetuneVertex(direction: string) {
    if (!this.selectedPolygon || !this.selectedVertex) return;

    const poly = this.selectedPolygon;
    const sel = this.selectedVertex;
    const delta = 1 / this.canvas.width;

    let pt: any = null;
    if (sel.type === "grid") pt = poly.gridVertices[sel.index];
    else if (sel.type === "vertex") pt = poly.vertices[sel.index];
    else if (sel.type === "c1") pt = poly.vertices[sel.index].c1;
    else if (sel.type === "c2") pt = poly.vertices[sel.index].c2;

    if (pt) {
      if (direction === "up") pt.y -= delta;
      if (direction === "down") pt.y += delta;
      if (direction === "left") pt.x -= delta;
      if (direction === "right") pt.x += delta;
    }
  }

  toggleVertexCurve() {
    if (
      !this.selectedPolygon ||
      !this.selectedVertex ||
      this.selectedVertex.type !== "vertex"
    )
      return;

    const poly = this.selectedPolygon;
    const idx = this.selectedVertex.index;
    const v = poly.vertices[idx];

    v.bezier = !v.bezier;

    if (v.bezier && (!v.c1 || !v.c2)) {
      const prevIdx = (idx - 1 + poly.vertices.length) % poly.vertices.length;
      const nextIdx = (idx + 1) % poly.vertices.length;
      const prev = poly.vertices[prevIdx];
      const next = poly.vertices[nextIdx];

      const dx1 = v.x - prev.x;
      const dy1 = v.y - prev.y;
      v.c1 = { x: v.x - dx1 * 0.2, y: v.y - dy1 * 0.2 };

      const dx2 = next.x - v.x;
      const dy2 = next.y - v.y;
      v.c2 = { x: v.x + dx2 * 0.2, y: v.y + dy2 * 0.2 };
    }
  }

  deleteSelected() {
    if (this.selectedPolygon) {
        // Try deleting from main list
      const index = this.polygons.indexOf(this.selectedPolygon);
      if (index >= 0) {
        this.polygons.splice(index, 1);
        this.selectPolygon(null);
      } else {
          // Check if it's a child
          let found = false;
          for(const p of this.polygons) {
              const cIndex = p.children.indexOf(this.selectedPolygon);
              if (cIndex >= 0) {
                  p.children.splice(cIndex, 1);
                  this.selectedPolygon.parent = null;
                  this.selectPolygon(null);
                  found = true;
                  break;
              }
          }
      }
    }
    this.renderLayersList();
  }

  toggleAudio() {
    if (this.audioManager.isActive) {
      this.audioManager.stop();
      this.showStatus("Audio Input Disabled");
      getEl("audioToggleBtn")?.classList.remove("active");
    } else {
      this.audioManager.start();
      this.showStatus("Audio Input Enabled");
      getEl("audioToggleBtn")?.classList.add("active");
    }
  }

  showContentModal() {
    if (!this.selectedPolygon) {
      this.showStatus("Please select a polygon first");
      return;
    }
    const modal = getEl("contentModal");
    if (modal) modal.classList.remove("hidden");
  }

  showShaderModal() {
    const contentModal = getEl("contentModal");
    const shaderModal = getEl("shaderModal");
    if (contentModal) contentModal.classList.add("hidden");
    if (shaderModal) shaderModal.classList.remove("hidden");
  }

  showVideoModal() {
    const contentModal = getEl("contentModal");
    const videoModal = getEl("videoModal");
    if (contentModal) contentModal.classList.add("hidden");
    if (videoModal) {
        videoModal.classList.remove("hidden");
        this.updateVideoList();
    }
  }

  showImageModal() {
    const contentModal = getEl("contentModal");
    const imageModal = getEl("imageModal");
    if (contentModal) contentModal.classList.add("hidden");
    if (imageModal) {
        imageModal.classList.remove("hidden");
        this.updateImageList();
    }
  }

  hideAllModals() {
    document
      .querySelectorAll(".modal")
      .forEach((modal) => modal.classList.add("hidden"));
  }

  setPolygonContent(type: string, data: string) {
    if (this.selectedPolygon) {
      this.selectedPolygon.setContent(type, data);
      this.hideAllModals();
      this.showStatus(`Content updated: ${type}`);
      this.updatePropertiesPanel(this.selectedPolygon);
    }
  }

  handleVideoUpload(e: any) {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      this.loadedVideos.set(file.name, url);
      this.updateVideoList();
      e.target.value = "";
    }
  }

  handleImageUpload(e: any) {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      this.loadedImages.set(file.name, url);
      this.updateImageList();
      e.target.value = "";
    }
  }

  updateVideoList() {
    const videoList = getEl("videoList");
    if (!videoList) return;
    videoList.innerHTML = "";
    this.loadedVideos.forEach((url, name) => {
      const btn = document.createElement("button");
      btn.className = "content-type-btn";
      btn.textContent = name;
      btn.addEventListener("click", () => {
        this.setPolygonContent("video", url);
      });
      videoList.appendChild(btn);
    });
  }

  updateImageList() {
    const list = getEl("imageList");
    if (!list) return;
    list.innerHTML = "";
    this.loadedImages.forEach((url, name) => {
      const btn = document.createElement("button");
      btn.className = "content-type-btn";
      btn.textContent = name;
      btn.addEventListener("click", () => {
        this.setPolygonContent("image", url);
      });
      list.appendChild(btn);
    });
  }

  togglePerformanceMode() {
    this.editMode = !this.editMode;
    const uiContainer = getEl("uiContainer");
    const leftSidebarToggle = getEl("toggleSidebarBtn");
    const rightSidebarToggle = getEl("toggleRightSidebarBtn");
    const vertexControls = getEl("vertexControls");
    const statusMsg = getEl("statusMsg");
    const leftSidebar = getEl("leftSidebar");
    const rightSidebar = getEl("rightSidebar");

    if (this.editMode) {
      if (uiContainer) uiContainer.classList.remove("hidden");
      if (leftSidebarToggle) leftSidebarToggle.style.display = "flex";
      if (rightSidebarToggle) rightSidebarToggle.classList.remove("hidden");
      // Note: Sidebar visibility is managed by user toggle, so we don't force show, 
      // but we ensure the toggle buttons are back.
    } else {
      if (uiContainer) uiContainer.classList.add("hidden");
      if (leftSidebarToggle) leftSidebarToggle.style.display = "none";
      if (rightSidebarToggle) rightSidebarToggle.classList.add("hidden");
      if (vertexControls) vertexControls.classList.add("hidden");
      if (statusMsg) statusMsg.classList.add("hidden");
      
      // Force hide sidebars in performance mode
      if (leftSidebar) leftSidebar.classList.add("hidden");
      if (rightSidebar) rightSidebar.classList.add("hidden");
    }

    const perfOverlay = getEl("performanceOverlay");
    if (perfOverlay) perfOverlay.classList.toggle("hidden", this.editMode);
    this.overlayCanvas.style.display = this.editMode ? "block" : "none";
  }

  toggleFullscreen() {
    const doc = document as any;
    const docEl = document.documentElement as any;

    const requestFullScreen =
      docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.msRequestFullscreen;

    const exitFullScreen =
      doc.exitFullscreen ||
      doc.webkitExitFullscreen ||
      doc.mozCancelFullScreen ||
      doc.msExitFullscreen;

    if (
      !doc.fullscreenElement &&
      !doc.webkitFullscreenElement &&
      !doc.mozFullScreenElement &&
      !doc.msFullscreenElement
    ) {
      if (requestFullScreen) {
        requestFullScreen.call(docEl).catch((err: any) => {
          console.error("Fullscreen error:", err);
          this.showStatus("Fullscreen blocked or not supported");
        });
      } else {
        // Fallback for iOS Safari which often doesn't support the API on elements
        this.showStatus("Tap Share (box+arrow) > 'Add to Home Screen' for App Mode");
      }
    } else {
      if (exitFullScreen) {
        exitFullScreen.call(doc);
      }
    }
  }

  showWelcomeModal() {
    const welcomeModal = getEl("welcomeModal");
    if (!welcomeModal) return;
    
    const continueBtn = getEl("continueProjectBtn") as HTMLButtonElement;
    if (continueBtn) {
        const hasSavedProject = safeStorage.getItem("mobileMapperProject") !== null;
        continueBtn.disabled = !hasSavedProject;
    }
    welcomeModal.classList.remove("hidden");
  }

  startNewProject() {
    this.polygons = [];
    this.loadedVideos.clear();
    this.selectedPolygon = null;
    this.selectedVertex = null;
    safeStorage.removeItem("mobileMapperProject");
    const welcomeModal = getEl("welcomeModal");
    if (welcomeModal) welcomeModal.classList.add("hidden");
    this.showStatus("New project started");
    this.selectPolygon(null);
  }

  continueLastProject() {
    this.loadProjectFromLocalStorage();
    const welcomeModal = getEl("welcomeModal");
    if (welcomeModal) welcomeModal.classList.add("hidden");
    this.showStatus("Project loaded from last session");
  }

  loadProjectFromFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target!.result as string);
          this.loadProjectData(data);
          const welcomeModal = getEl("welcomeModal");
          if (welcomeModal) welcomeModal.classList.add("hidden");
          this.showStatus("Project loaded from file!");
        } catch (e) {
          this.showStatus("Failed to load project file");
          console.error(e);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  saveProject() {
    const defaultName = `projection-mapping-${
      new Date().toISOString().split("T")[0]
    }`;
    let filename = prompt("Enter project name:", defaultName);
    if (filename === null) return;
    filename = filename.trim() || defaultName;
    if (!filename.endsWith(".json")) filename += ".json";

    const data = {
      polygons: this.polygons.map((p) => p.toJSON()),
      videos: Array.from(this.loadedVideos.entries()),
      version: "1.0",
      name: filename.replace(".json", ""),
    };
    safeStorage.setItem("mobileMapperProject", JSON.stringify(data));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.showStatus(`Project "${filename}" saved!`);
  }

  loadProjectFromLocalStorage() {
    const saved = safeStorage.getItem("mobileMapperProject");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.loadProjectData(data);
      } catch (e) {
        console.error("Failed to load project:", e);
      }
    }
  }

  loadProjectData(data: any) {
    this.polygons = data.polygons.map((p: any) => Polygon.fromJSON(p));
    
    // Rebuild parent links after JSON parse
    this.polygons.forEach(p => {
        if (p.children) {
            p.children.forEach(c => c.parent = p);
        }
    });
    
    if (data.videos) {
      this.loadedVideos = new Map(data.videos);
      
      this.polygons.forEach((poly) => {
        const load = (p: Polygon) => {
            if (p.contentType === "video") {
              if (p.videoSrc && this.loadedVideos.has(p.videoSrc))
                p.loadVideo();
              else {
                p.loadVideo(); // Try anyway
              }
            }
            if (p.children) p.children.forEach(load);
        };
        load(poly);
      });
    }
    this.renderLayersList();
  }

  animate() {
    // Check for resize every frame
    this.resizeOverlay();

    if (this.audioManager.isActive) {
      this.renderer.updateAudioData(this.audioManager.getAudioData());
    } else {
      this.renderer.updateAudioData({ low: 0, mid: 0, high: 0, level: 0 });
    }

    this.renderer.render(this.polygons, this.editMode);
    this.overlayCtx.clearRect(
      0,
      0,
      this.overlayCanvas.width,
      this.overlayCanvas.height
    );
    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;

    if (this.editMode) {
      const renderAllPolys = (polys: Polygon[]) => {
          polys.forEach((poly) => {
            // Recurse children
            if (poly.children) renderAllPolys(poly.children);
            
            if (poly.selected || true) {
              if (poly.selected) {
                const renderVerts = poly.getRenderVertices();
    
                if (poly.warpMode && poly.gridVertices.length > 0) {
                  const size = poly.gridSize;
                  this.overlayCtx.strokeStyle = "#ffff00";
                  this.overlayCtx.lineWidth = 1;
                  this.overlayCtx.beginPath();
                  for (let y = 0; y < size; y++) {
                    for (let x = 0; x < size - 1; x++) {
                      const v1 = poly.gridVertices[y * size + x];
                      const v2 = poly.gridVertices[y * size + x + 1];
                      this.overlayCtx.moveTo(v1.x * w, v1.y * h);
                      this.overlayCtx.lineTo(v2.x * w, v2.y * h);
                    }
                  }
                  for (let x = 0; x < size; x++) {
                    for (let y = 0; y < size - 1; y++) {
                      const v1 = poly.gridVertices[y * size + x];
                      const v2 = poly.gridVertices[(y + 1) * size + x];
                      this.overlayCtx.moveTo(v1.x * w, v1.y * h);
                      this.overlayCtx.lineTo(v2.x * w, v2.y * h);
                    }
                  }
                  this.overlayCtx.stroke();
    
                  poly.gridVertices.forEach((v, idx) => {
                    const x = v.x * w;
                    const y = v.y * h;
                    const isSelected =
                      this.selectedVertex &&
                      this.selectedVertex.type === "grid" &&
                      this.selectedVertex.index === idx;
    
                    this.overlayCtx.fillStyle = isSelected ? "#00ffff" : "#ffff00";
                    this.overlayCtx.beginPath();
                    this.overlayCtx.arc(x, y, isSelected ? 8 : 4, 0, Math.PI * 2);
                    this.overlayCtx.fill();
                    this.overlayCtx.stroke();
                  });
                } else {
                  const outline = poly.getDiscretizedVertices(30);
    
                  this.overlayCtx.strokeStyle = "#00ff00";
                  this.overlayCtx.lineWidth = 3;
                  this.overlayCtx.beginPath();
                  outline.forEach((v, i) => {
                    const x = v.x * w;
                    const y = v.y * h;
                    if (i === 0) this.overlayCtx.moveTo(x, y);
                    else this.overlayCtx.lineTo(x, y);
                  });
                  this.overlayCtx.closePath();
                  this.overlayCtx.stroke();
    
                  poly.vertices.forEach((v, idx) => {
                    const x = v.x * w;
                    const y = v.y * h;
                    const isSelected =
                      this.selectedVertex &&
                      this.selectedVertex.type === "vertex" &&
                      this.selectedVertex.index === idx;
    
                    this.overlayCtx.fillStyle = isSelected ? "#00ffff" : "#00ff00";
                    this.overlayCtx.beginPath();
                    this.overlayCtx.arc(x, y, isSelected ? 8 : 6, 0, Math.PI * 2);
                    this.overlayCtx.fill();
                    this.overlayCtx.stroke();
    
                    if (v.bezier) {
                      if (v.c1) {
                        const hx = v.c1.x * w;
                        const hy = v.c1.y * h;
                        this.overlayCtx.strokeStyle = "rgba(255,255,255,0.5)";
                        this.overlayCtx.lineWidth = 1;
                        this.overlayCtx.beginPath();
                        this.overlayCtx.moveTo(x, y);
                        this.overlayCtx.lineTo(hx, hy);
                        this.overlayCtx.stroke();
    
                        const isHandleSelected =
                          this.selectedVertex &&
                          this.selectedVertex.type === "c1" &&
                          this.selectedVertex.index === idx;
                        this.overlayCtx.fillStyle = isHandleSelected
                          ? "#ff00ff"
                          : "#ffffff";
                        this.overlayCtx.beginPath();
                        this.overlayCtx.arc(hx, hy, 4, 0, Math.PI * 2);
                        this.overlayCtx.fill();
                      }
                      if (v.c2) {
                        const hx = v.c2.x * w;
                        const hy = v.c2.y * h;
                        this.overlayCtx.strokeStyle = "rgba(255,255,255,0.5)";
                        this.overlayCtx.lineWidth = 1;
                        this.overlayCtx.beginPath();
                        this.overlayCtx.moveTo(x, y);
                        this.overlayCtx.lineTo(hx, hy);
                        this.overlayCtx.stroke();
    
                        const isHandleSelected =
                          this.selectedVertex &&
                          this.selectedVertex.type === "c2" &&
                          this.selectedVertex.index === idx;
                        this.overlayCtx.fillStyle = isHandleSelected
                          ? "#ff00ff"
                          : "#ffffff";
                        this.overlayCtx.beginPath();
                        this.overlayCtx.arc(hx, hy, 4, 0, Math.PI * 2);
                        this.overlayCtx.fill();
                      }
                    }
                  });
                }
              } else {
                const outline = poly.getDiscretizedVertices(20);
                this.overlayCtx.strokeStyle = "rgba(0, 255, 0, 0.3)";
                this.overlayCtx.lineWidth = 1;
                this.overlayCtx.beginPath();
                outline.forEach((v, i) => {
                  const x = v.x * w;
                  const y = v.y * h;
                  if (i === 0) this.overlayCtx.moveTo(x, y);
                  else this.overlayCtx.lineTo(x, y);
                });
                this.overlayCtx.closePath();
                this.overlayCtx.stroke();
              }
            }
          });
      }
      renderAllPolys(this.polygons);
    }

    if (this.isDrawing && this.drawingVertices.length > 0) {
      this.overlayCtx.strokeStyle = "#ffff00";
      this.overlayCtx.lineWidth = 2;
      this.overlayCtx.beginPath();
      this.drawingVertices.forEach((v, i) => {
        const x = v.x * w;
        const y = v.y * h;
        if (i === 0) this.overlayCtx.moveTo(x, y);
        else this.overlayCtx.lineTo(x, y);
      });
      this.overlayCtx.stroke();

      // Draw vertices
      this.drawingVertices.forEach((v, i) => {
        const x = v.x * w;
        const y = v.y * h;

        // First point (closing point) logic
        if (i === 0) {
          this.overlayCtx.fillStyle = "#ff0000"; // Red for start/close point
          this.overlayCtx.beginPath();
          this.overlayCtx.arc(x, y, 8, 0, Math.PI * 2);
          this.overlayCtx.fill();
          this.overlayCtx.strokeStyle = "#ffffff";
          this.overlayCtx.lineWidth = 2;
          this.overlayCtx.stroke();
        } else {
          this.overlayCtx.fillStyle = "#ffff00";
          this.overlayCtx.beginPath();
          this.overlayCtx.arc(x, y, 4, 0, Math.PI * 2);
          this.overlayCtx.fill();
        }
      });
    }

    requestAnimationFrame(() => this.animate());
  }

  // --- Layer Management Logic ---
  
  handleDragStart(e: PointerEvent, poly: Polygon) {
      // Long press logic
      this.dragTimeout = setTimeout(() => {
          this.draggingLayer = poly;
          this.dragStartY = e.clientY;
          
          // Create ghost
          this.dragGhost = document.createElement("div");
          this.dragGhost.className = "layer-drag-ghost";
          const idStr = poly.id ? poly.id.toString() : "0000";
          this.dragGhost.textContent = `Moving: ${poly.type} ${idStr.slice(-4)}`;
          document.body.appendChild(this.dragGhost);
          this.updateDragGhost(e.clientY);
          
          this.showStatus("Dragging Layer...");
      }, 300); // 300ms long press
  }
  
  handleDragMove(e: PointerEvent) {
      if (this.dragTimeout && !this.draggingLayer) {
          // If moved too much before timeout, cancel drag
          if (Math.abs(e.clientY - this.dragStartY) > 10) {
              clearTimeout(this.dragTimeout);
              this.dragTimeout = null;
          }
      }
      
      if (this.draggingLayer && this.dragGhost) {
          e.preventDefault(); // Prevent scrolling
          this.updateDragGhost(e.clientY);
          
          // Highlight potential drop target
          const layerItems = document.querySelectorAll('.layer-item');
          layerItems.forEach(el => el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom'));
          
          let targetItem: Element | null = null;
          // Find element under point (manual hit test since pointer capture might interfere)
          const hits = document.elementsFromPoint(e.clientX, e.clientY);
          targetItem = hits.find(el => el.classList.contains('layer-item')) || null;
          
          if (targetItem) {
              const rect = targetItem.getBoundingClientRect();
              const relY = e.clientY - rect.top;
              if (relY < rect.height * 0.25) targetItem.classList.add('drag-over-top');
              else if (relY > rect.height * 0.75) targetItem.classList.add('drag-over-bottom');
              else targetItem.classList.add('drag-over');
          }
      }
  }
  
  handleDragEnd(e: PointerEvent) {
      if (this.dragTimeout) clearTimeout(this.dragTimeout);
      
      if (this.draggingLayer) {
          const hits = document.elementsFromPoint(e.clientX, e.clientY);
          const layerItem = hits.find(el => el.classList.contains('layer-item'));
          
          if (layerItem) {
              const targetId = parseFloat(layerItem.getAttribute('data-id') || "-1");
              this.performLayerDrop(targetId, e.clientY, layerItem.getBoundingClientRect());
          }
          
          this.draggingLayer = null;
          if (this.dragGhost) {
              this.dragGhost.remove();
              this.dragGhost = null;
          }
          document.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom'));
      }
  }
  
  updateDragGhost(y: number) {
      if (this.dragGhost) {
          this.dragGhost.style.top = `${y}px`;
          this.dragGhost.style.left = `60px`; // Offset from finger
      }
  }
  
  performLayerDrop(targetId: number, clientY: number, targetRect: DOMRect) {
      if (targetId === -1 || !this.draggingLayer) return;
      if (targetId === this.draggingLayer.id) return;
      
      const targetPoly = this.findPolygonById(targetId);
      if (!targetPoly) return;
      
      // Remove source
      this.removePolygonFromTree(this.draggingLayer);
      
      const relY = clientY - targetRect.top;
      const h = targetRect.height;
      
      if (relY > h * 0.25 && relY < h * 0.75) {
          // Nest
          targetPoly.children.push(this.draggingLayer);
          this.draggingLayer.parent = targetPoly;
      } else {
          // Insert
          this.draggingLayer.parent = null;
          let list = this.polygons;
          if (targetPoly.parent) {
              list = targetPoly.parent.children;
              this.draggingLayer.parent = targetPoly.parent;
          }
          
          const targetIndex = list.indexOf(targetPoly);
          
          // UI Reversed: Above (Top) = Higher Index
          if (relY <= h * 0.25) {
              // Above
              list.splice(targetIndex + 1, 0, this.draggingLayer);
          } else {
              // Below
              list.splice(targetIndex, 0, this.draggingLayer);
          }
      }
      
      this.renderLayersList();
  }
  
  findPolygonById(id: number): Polygon | null {
      // BFS
      const q = [...this.polygons];
      while(q.length > 0) {
          const p = q.shift()!;
          if (p.id === id) return p;
          if (p.children) q.push(...p.children);
      }
      return null;
  }
  
  removePolygonFromTree(poly: Polygon) {
      if (poly.parent) {
          const idx = poly.parent.children.indexOf(poly);
          if (idx >= 0) poly.parent.children.splice(idx, 1);
      } else {
          const idx = this.polygons.indexOf(poly);
          if (idx >= 0) this.polygons.splice(idx, 1);
      }
  }

  renderLayersList() {
    const container = getEl("layersListContainer");
    if (!container) return;

    container.innerHTML = "";
    
    if (this.polygons.length === 0) {
      container.innerHTML = `<div style="padding:8px; opacity:0.5; font-size:12px;">No shapes added</div>`;
      return;
    }

    const createItem = (poly: Polygon, index: number, depth: number) => {
        const item = document.createElement("div");
        item.className = "layer-item";
        item.setAttribute('data-id', poly.id.toString());
        item.style.padding = "8px";
        item.style.paddingLeft = `${8 + depth * 20}px`; // Indent
        item.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
        item.style.cursor = "pointer";
        item.style.backgroundColor = poly.selected
            ? "rgba(0,255,157,0.2)"
            : "transparent";
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.style.userSelect = "none"; // Important for touch
        item.style.touchAction = "none"; // Prevent scrolling while dragging
        
        // Visual indicator for mask
        const isMask = depth > 0;
        const icon = isMask ? "🎭 " : "";

        const label = document.createElement("span");
        // Safe string conversion
        const idStr = poly.id ? poly.id.toString() : "0000";
        const shortId = idStr.length > 4 ? idStr.slice(-4) : idStr;
        
        label.textContent = `${icon}Shape ${shortId} (${poly.type})`;
        label.style.fontSize = "12px";

        item.appendChild(label);

        item.addEventListener("click", (e) => {
            e.stopPropagation();
            this.selectPolygon(poly);
            this.setTool("select");
        });
        
        // Custom Pointer Events for Drag
        item.addEventListener("pointerdown", (e) => {
            if (e.isPrimary) {
               item.setPointerCapture(e.pointerId);
               this.dragStartY = e.clientY;
               this.handleDragStart(e, poly);
            }
        });
        
        item.addEventListener("pointermove", (e) => {
            if (this.draggingLayer) this.handleDragMove(e);
        });
        
        item.addEventListener("pointerup", (e) => {
            item.releasePointerCapture(e.pointerId);
            this.handleDragEnd(e);
        });
        
        container.appendChild(item);
        
        // Render Children (Reverse order for UI)
        if (poly.children && poly.children.length > 0) {
            [...poly.children].reverse().forEach((child, idx) => createItem(child, idx, depth + 1));
        }
    };
    
    // Render Root Polygons (Reverse order for UI)
    [...this.polygons].reverse().forEach((poly, index) => {
        createItem(poly, index, 0);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    (window as any).app = new MobileMapperApp();
  });
} else {
  (window as any).app = new MobileMapperApp();
}
