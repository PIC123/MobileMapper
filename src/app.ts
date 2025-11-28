import { Renderer } from "./renderer";
import { Polygon, ShapeFactory, AudioSettings } from "./polygon";
import { AudioManager } from "./audio_manager";
import "./styles.css";

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
  controlsDragStart: { x: number; y: number } | null;
  controlsPosition: { x: number | null; y: number | null };
  uiVisible: boolean;
  userHasToggledMode: boolean;
  lastBrushPos: { x: number; y: number } | null = null;

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
    this.controlsDragStart = null;
    this.controlsPosition = { x: null, y: null };
    this.uiVisible = true;
    this.userHasToggledMode = false;

    this.setupEventListeners();
    this.resizeOverlay();
    window.addEventListener("resize", () => {
      this.resizeOverlay();
    });
    this.animate();

    this.showWelcomeModal();
  }

  resizeOverlay() {
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
    document
      .getElementById("toggleSidebarBtn")!
      .addEventListener("click", () => {
        const sidebar = document.getElementById("leftSidebar")!;
        sidebar.classList.toggle("hidden");
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

    document
      .getElementById("addTriangleBtn")!
      .addEventListener("click", () => this.setTool("triangle"));
    document
      .getElementById("addSquareBtn")!
      .addEventListener("click", () => this.setTool("square"));
    document
      .getElementById("addCircleBtn")!
      .addEventListener("click", () => this.setTool("circle"));
    document
      .getElementById("drawPolygonBtn")!
      .addEventListener("click", () => this.setTool("draw"));
    document.getElementById("addCanvasBtn")!.addEventListener("click", () => {
      const poly = ShapeFactory.createCanvas(0.5, 0.5); // Center
      this.polygons.push(poly);
      this.selectPolygon(poly);
      this.setTool("brush"); // Auto-switch to brush
    });

    document
      .getElementById("selectBtn")!
      .addEventListener("click", () => this.setTool("select"));
    document
      .getElementById("brushBtn")!
      .addEventListener("click", () => this.setTool("brush"));
    document
      .getElementById("deleteBtn")!
      .addEventListener("click", () => this.deleteSelected());

    // Brush Controls
    const updateBrushSettings = () => {
      const size = parseInt(
        (document.getElementById("brushSizeSlider") as HTMLInputElement).value
      );
      const opacity = parseFloat(
        (document.getElementById("brushOpacitySlider") as HTMLInputElement)
          .value
      );
      const color = (
        document.getElementById("brushColorPicker") as HTMLInputElement
      ).value;
      const eraser = (
        document.getElementById("eraserToggle") as HTMLInputElement
      ).checked;

      document.getElementById("brushSizeVal")!.textContent = size.toString();
      document.getElementById("brushOpacityVal")!.textContent =
        opacity.toFixed(1);

      return { size, opacity, color, eraser };
    };

    [
      "brushSizeSlider",
      "brushOpacitySlider",
      "brushColorPicker",
      "eraserToggle",
    ].forEach((id) => {
      document
        .getElementById(id)!
        .addEventListener("input", updateBrushSettings);
    });

    document.getElementById("clearCanvasBtn")!.addEventListener("click", () => {
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

    document
      .getElementById("useAsMaskToggle")!
      .addEventListener("change", (e) => {
        if (this.selectedPolygon && this.selectedPolygon.type === "drawing") {
          this.selectedPolygon.useAsMask = (
            e.target as HTMLInputElement
          ).checked;
        }
      });

    document
      .getElementById("changeContentBtn")!
      .addEventListener("click", () => this.showContentModal());
    document
      .getElementById("warpToggle")!
      .addEventListener("change", (e) =>
        this.toggleWarpMode((e.target as HTMLInputElement).checked)
      );

    // Audio Settings Controls
    document
      .getElementById("audioEnabledToggle")!
      .addEventListener("change", (e) => {
        if (this.selectedPolygon) {
          this.selectedPolygon.audioSettings.enabled = (
            e.target as HTMLInputElement
          ).checked;
        }
      });

    const bindAudioSlider = (id: string, param: keyof AudioSettings) => {
      const slider = document.getElementById(id) as HTMLInputElement;
      slider.addEventListener("input", (e) => {
        if (this.selectedPolygon) {
          (this.selectedPolygon.audioSettings as any)[param] = parseFloat(
            (e.target as HTMLInputElement).value
          );
        }
      });
    };

    bindAudioSlider("audioGainSlider", "gain");
    bindAudioSlider("audioBassSlider", "bassScale");
    bindAudioSlider("audioMidSlider", "midScale");
    bindAudioSlider("audioHighSlider", "highScale");

    document.getElementById("addEffectBtn")!.addEventListener("click", () => {
      const type = (
        document.getElementById("effectTypeSelect") as HTMLSelectElement
      ).value;
      this.addEffect(type);
    });

    document
      .getElementById("performanceBtn")!
      .addEventListener("click", () => this.togglePerformanceMode());
    document
      .getElementById("fullscreenBtn")!
      .addEventListener("click", () => this.toggleFullscreen());
    document
      .getElementById("saveBtn")!
      .addEventListener("click", () => this.saveProject());
    document
      .getElementById("loadBtn")!
      .addEventListener("click", () => this.loadProjectDialog());
    document
      .getElementById("audioToggleBtn")!
      .addEventListener("click", () => this.toggleAudio());

    this.canvas.addEventListener(
      "touchstart",
      (e) => this.handleTouchStart(e),
      { passive: false }
    );
    this.canvas.addEventListener("touchmove", (e) => this.handleTouchMove(e), {
      passive: false,
    });
    this.canvas.addEventListener("touchend", (e) => this.handleTouchEnd(e), {
      passive: false,
    });
    this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.handleMouseUp(e));

    document.querySelectorAll(".arrow-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        this.finetuneVertex((btn as HTMLElement).dataset.dir!)
      );
    });

    document
      .getElementById("toggleCurveBtn")
      ?.addEventListener("click", () => this.toggleVertexCurve());

    document.querySelectorAll(".close-modal").forEach((btn) => {
      btn.addEventListener("click", () => this.hideAllModals());
    });

    document.querySelectorAll(".content-type-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = (btn as HTMLElement).dataset.type;
        if (type === "shader") this.showShaderModal();
        else if (type === "video") this.showVideoModal();
      });
    });

    document.querySelectorAll(".shader-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.setPolygonContent("shader", (btn as HTMLElement).dataset.shader!);
      });
    });

    document
      .getElementById("videoFileInput")!
      .addEventListener("change", (e) => {
        this.handleVideoUpload(e as any);
      });

    const performanceOverlay = document.getElementById("performanceOverlay")!;
    performanceOverlay.addEventListener("click", () => {
      if (!this.editMode) this.togglePerformanceMode();
    });
    performanceOverlay.addEventListener(
      "touchstart",
      (e) => {
        if (!this.editMode) {
          e.preventDefault();
          this.togglePerformanceMode();
        }
      },
      { passive: false }
    );

    const vertexControls = document.getElementById("vertexControls")!;
    const dragHandle = vertexControls.querySelector(".control-drag-handle")!;

    dragHandle.addEventListener("mousedown", (e) =>
      this.startControlsDrag(e as MouseEvent)
    );
    dragHandle.addEventListener(
      "touchstart",
      (e) => this.startControlsDrag(e as unknown as MouseEvent),
      { passive: false }
    );
    document.addEventListener("mousemove", (e) => this.moveControls(e));
    document.addEventListener(
      "touchmove",
      (e) => this.moveControls(e as unknown as MouseEvent),
      { passive: false }
    );
    document.addEventListener("mouseup", () => this.stopControlsDrag());
    document.addEventListener("touchend", () => this.stopControlsDrag());

    document
      .getElementById("newProjectBtn")!
      .addEventListener("click", () => this.startNewProject());
    document
      .getElementById("loadProjectFileBtn")!
      .addEventListener("click", () => this.loadProjectFromFile());
    document
      .getElementById("continueProjectBtn")!
      .addEventListener("click", () => this.continueLastProject());
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

    const settings = {
      size: parseInt(
        (document.getElementById("brushSizeSlider") as HTMLInputElement).value
      ),
      opacity: parseFloat(
        (document.getElementById("brushOpacitySlider") as HTMLInputElement)
          .value
      ),
      color: (document.getElementById("brushColorPicker") as HTMLInputElement)
        .value,
      eraser: (document.getElementById("eraserToggle") as HTMLInputElement)
        .checked,
    };

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = settings.size;

    if (settings.eraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = `rgba(0,0,0,${settings.opacity})`;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = settings.color;
      ctx.globalAlpha = settings.opacity;
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
    if (this.editMode) {
    }

    if (this.currentTool === "brush") {
      if (this.selectedPolygon && this.selectedPolygon.type === "drawing") {
        this.isDrawing = true;
        this.handleBrushStroke(clientX, clientY, true);
      }
      return;
    }

    const coords = this.getNormalizedCoords(clientX, clientY);

    if (this.currentTool === "triangle") {
      const poly = ShapeFactory.createTriangle(coords.x, coords.y);
      this.polygons.push(poly);
      this.selectPolygon(poly);
      this.setTool("select");
    } else if (this.currentTool === "square") {
      const poly = ShapeFactory.createSquare(coords.x, coords.y);
      this.polygons.push(poly);
      this.selectPolygon(poly);
      this.setTool("select");
    } else if (this.currentTool === "circle") {
      const poly = ShapeFactory.createCircle(coords.x, coords.y);
      this.polygons.push(poly);
      this.selectPolygon(poly);
      this.setTool("select");
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
      this.isDrawing = true;
    } else if (this.currentTool === "select") {
      let foundSelection = false;

      for (let i = this.polygons.length - 1; i >= 0; i--) {
        const poly = this.polygons[i];
        const selection = poly.getVertexAtPoint(coords.x, coords.y);
        if (selection) {
          this.selectPolygon(poly);
          this.selectedVertex = selection;
          this.updateVertexControls(true);
          foundSelection = true;
          break;
        }
      }

      if (!foundSelection) {
        for (let i = this.polygons.length - 1; i >= 0; i--) {
          const poly = this.polygons[i];
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
    this.renderLayersList();
  }

  handlePointerMove(clientX: number, clientY: number) {
    if (this.currentTool === "brush" && this.isDrawing) {
      this.handleBrushStroke(clientX, clientY, false);
      return;
    }

    const coords = this.getNormalizedCoords(clientX, clientY);

    if (this.selectedPolygon && this.selectedVertex) {
      this.selectedPolygon.moveVertex(this.selectedVertex, coords.x, coords.y);
    } else if (this.selectedPolygon && this.dragStart) {
      const dx = coords.x - this.dragStart.x;
      const dy = coords.y - this.dragStart.y;
      this.selectedPolygon.translate(dx, dy);
      this.dragStart = coords;
    }
  }

  handlePointerUp() {
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
      this.polygons.push(poly);
      this.selectPolygon(poly);
    }
    this.drawingVertices = [];
    this.isDrawing = false;
    this.setTool("select");
    this.renderLayersList();

    if (window.innerWidth < 768) {
      document.getElementById("leftSidebar")!.classList.remove("hidden");
    }
  }

  selectPolygon(poly: Polygon | null) {
    this.polygons.forEach((p) => (p.selected = false));
    this.selectedPolygon = poly;

    const rightSidebar = document.getElementById("rightSidebar")!;

    if (poly) {
      poly.selected = true;
      rightSidebar.classList.remove("hidden");
      this.updatePropertiesPanel(poly);

      // Auto-switch tool logic
      if (poly.type !== "drawing" && this.currentTool === "brush") {
        this.setTool("select");
      }
    } else {
      rightSidebar.classList.add("hidden");
    }
    this.renderLayersList();
  }

  updatePropertiesPanel(poly: Polygon) {
    const infoDisplay = document.getElementById("currentContentInfo")!;
    if (poly.contentType === "video") {
      infoDisplay.textContent = "Video";
    } else {
      infoDisplay.textContent = `Shader: ${poly.shaderType}`;
    }

    (document.getElementById("warpToggle") as HTMLInputElement).checked =
      poly.warpMode;

    // Update Audio UI
    (
      document.getElementById("audioEnabledToggle") as HTMLInputElement
    ).checked = poly.audioSettings.enabled;
    (document.getElementById("audioGainSlider") as HTMLInputElement).value =
      poly.audioSettings.gain.toString();
    (document.getElementById("audioBassSlider") as HTMLInputElement).value =
      poly.audioSettings.bassScale.toString();
    (document.getElementById("audioMidSlider") as HTMLInputElement).value =
      poly.audioSettings.midScale.toString();
    (document.getElementById("audioHighSlider") as HTMLInputElement).value =
      poly.audioSettings.highScale.toString();

    // Toggle Visibility based on type
    const canvasMaskControl = document.getElementById("canvasMaskControl")!;
    const brushControls = document.getElementById("brushControls")!;

    if (poly.type === "drawing") {
      canvasMaskControl.classList.remove("hidden");
      (document.getElementById("useAsMaskToggle") as HTMLInputElement).checked =
        poly.useAsMask;

      if (this.currentTool === "brush") {
        brushControls.classList.remove("hidden");
      } else {
        brushControls.classList.add("hidden");
      }
    } else {
      canvasMaskControl.classList.add("hidden");
      brushControls.classList.add("hidden");
    }

    this.renderEffectsList(poly);
  }

  toggleWarpMode(enabled: boolean) {
    if (this.selectedPolygon) {
      if (enabled !== this.selectedPolygon.warpMode) {
        this.selectedPolygon.toggleWarpMode();
      }
      this.selectedVertex = null;
      this.updateVertexControls(false);
    }
  }

  updateVertexControls(show: boolean) {
    const vertexControls = document.getElementById("vertexControls")!;
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
      const index = this.polygons.indexOf(this.selectedPolygon);
      if (index >= 0) {
        this.polygons.splice(index, 1);
        this.selectPolygon(null);
      }
    }
    this.renderLayersList();
  }

  showContentModal() {
    if (!this.selectedPolygon) {
      this.showStatus("Please select a polygon first");
      return;
    }
    document.getElementById("contentModal")!.classList.remove("hidden");
  }

  showShaderModal() {
    document.getElementById("contentModal")!.classList.add("hidden");
    document.getElementById("shaderModal")!.classList.remove("hidden");
  }

  showVideoModal() {
    document.getElementById("contentModal")!.classList.add("hidden");
    document.getElementById("videoModal")!.classList.remove("hidden");
    this.updateVideoList();
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

  updateVideoList() {
    const videoList = document.getElementById("videoList")!;
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

  togglePerformanceMode() {
    this.editMode = !this.editMode;
    const uiContainer = document.getElementById("uiContainer")!;
    const sidebarToggle = document.getElementById("toggleSidebarBtn")!;

    if (this.editMode) {
      uiContainer.classList.remove("hidden");
      sidebarToggle.style.display = "flex";
    } else {
      uiContainer.classList.add("hidden");
      sidebarToggle.style.display = "none";
    }

    document
      .getElementById("performanceOverlay")!
      .classList.toggle("hidden", this.editMode);
    this.overlayCanvas.style.display = this.editMode ? "block" : "none";
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .catch(() => this.showStatus("Fullscreen not available"));
    } else {
      document.exitFullscreen();
    }
  }

  showWelcomeModal() {
    const welcomeModal = document.getElementById("welcomeModal")!;
    const continueBtn = document.getElementById(
      "continueProjectBtn"
    ) as HTMLButtonElement;
    const hasSavedProject =
      localStorage.getItem("mobileMapperProject") !== null;
    continueBtn.disabled = !hasSavedProject;
    welcomeModal.classList.remove("hidden");
  }

  startNewProject() {
    this.polygons = [];
    this.loadedVideos.clear();
    this.selectedPolygon = null;
    this.selectedVertex = null;
    localStorage.removeItem("mobileMapperProject");
    document.getElementById("welcomeModal")!.classList.add("hidden");
    this.showStatus("New project started");
    this.selectPolygon(null);
  }

  continueLastProject() {
    this.loadProjectFromLocalStorage();
    document.getElementById("welcomeModal")!.classList.add("hidden");
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
          document.getElementById("welcomeModal")!.classList.add("hidden");
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
    localStorage.setItem("mobileMapperProject", JSON.stringify(data));
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
    const saved = localStorage.getItem("mobileMapperProject");
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
    if (data.videos) {
      this.loadedVideos = new Map(data.videos);
      this.polygons.forEach((poly) => {
        if (poly.contentType === "video") {
          if (poly.videoSrc && this.loadedVideos.has(poly.videoSrc))
            poly.loadVideo();
          else {
            poly.contentType = "shader";
            poly.shaderType = "rainbow";
          }
        }
      });
    }
    this.renderLayersList();
  }

  animate() {
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
      this.polygons.forEach((poly) => {
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

  renderLayersList() {
    const container = document.getElementById("layersListContainer");
    if (!container) return;

    container.innerHTML = "";

    if (this.polygons.length === 0) {
      container.innerHTML = `<div style="padding:8px; opacity:0.5; font-size:12px;">No shapes added</div>`;
      return;
    }

    this.polygons.forEach((poly, index) => {
      const item = document.createElement("div");
      item.className = "layer-item";
      item.style.padding = "8px";
      item.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
      item.style.cursor = "pointer";
      item.style.backgroundColor = poly.selected
        ? "rgba(0,255,157,0.2)"
        : "transparent";
      item.style.display = "flex";
      item.style.justifyContent = "space-between";
      item.style.alignItems = "center";

      const label = document.createElement("span");
      label.textContent = `Shape ${index + 1} (${poly.type})`;
      label.style.fontSize = "12px";

      item.appendChild(label);

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectPolygon(poly);
        this.setTool("select");
      });

      container.appendChild(item);
    });
  }

  toggleAudio() {
    if (this.audioManager.isActive) {
      this.audioManager.stop();
      document.getElementById("audioToggleBtn")!.classList.remove("active");
    } else {
      this.audioManager.start();
      document.getElementById("audioToggleBtn")!.classList.add("active");
    }
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
    const list = document.getElementById("effectsListContainer");
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
        controls = `
                <div class="control-group">
                    <label>Width</label>
                    <input type="range" min="0.01" max="0.2" step="0.01" value="${
                      p.width
                    }"
                           data-effect-id="${effect.id}" data-param="width">
                </div>
                <div class="control-group">
                    <label>Pulse Speed</label>
                    <input type="range" min="0" max="10" step="0.1" value="${
                      p.speed !== undefined ? p.speed : 0.0
                    }"
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

      const inputs = item.querySelectorAll('input[type="range"]');
      inputs.forEach((input) => {
        input.addEventListener("input", (e) => {
          const target = e.target as HTMLInputElement;
          const param = target.dataset.param!;
          const val = parseFloat(target.value);
          const effectId = target.dataset.effectId!;

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
      const valLabel = document.getElementById(`val-${id}`);
      if (valLabel && params.value !== undefined) {
        valLabel.textContent = params.value.toFixed(2);
      }
    }
  }

  showStatus(msg: string) {
    const el = document.getElementById("statusMsg")!;
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

    const vertexControls = document.getElementById("vertexControls")!;
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

    const vertexControls = document.getElementById("vertexControls")!;

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
    if (tool === "select")
      document.getElementById("selectBtn")!.classList.add("active");
    else if (tool === "brush") {
      document.getElementById("brushBtn")!.classList.add("active");
      if (this.selectedPolygon && this.selectedPolygon.type === "drawing") {
        document.getElementById("brushControls")!.classList.remove("hidden");
      }
    } else {
      if (tool === "triangle")
        document.getElementById("addTriangleBtn")!.classList.add("active");
      else if (tool === "square")
        document.getElementById("addSquareBtn")!.classList.add("active");
      else if (tool === "circle")
        document.getElementById("addCircleBtn")!.classList.add("active");
      else if (tool === "draw")
        document.getElementById("drawPolygonBtn")!.classList.add("active");

      if (window.innerWidth < 768) {
        document.getElementById("leftSidebar")!.classList.add("hidden");
        document.getElementById("rightSidebar")!.classList.add("hidden");
      }
    }

    if (tool !== "brush") {
      document.getElementById("brushControls")!.classList.add("hidden");
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    (window as any).app = new MobileMapperApp();
  });
} else {
  (window as any).app = new MobileMapperApp();
}
