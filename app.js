// Main application logic
class MobileMapperApp {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.overlayCanvas = document.getElementById('overlayCanvas');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        this.renderer = new Renderer(this.canvas);
        this.polygons = [];
        this.selectedPolygon = null;
        this.selectedVertex = -1;
        this.currentTool = 'select'; // 'select', 'triangle', 'square', 'draw'
        this.drawingVertices = [];
        this.isDrawing = false;
        this.dragStart = null;
        this.editMode = true;
        this.loadedVideos = new Map(); // Store loaded videos
        this.controlsDragStart = null;
        this.controlsPosition = { x: null, y: null }; // Will use CSS default initially

        this.setupEventListeners();
        this.resizeOverlay();
        window.addEventListener('resize', () => this.resizeOverlay());
        this.animate();

        // Load saved project if exists
        this.loadProject();
    }

    resizeOverlay() {
        const displayWidth = this.overlayCanvas.clientWidth;
        const displayHeight = this.overlayCanvas.clientHeight;

        if (this.overlayCanvas.width !== displayWidth || this.overlayCanvas.height !== displayHeight) {
            this.overlayCanvas.width = displayWidth;
            this.overlayCanvas.height = displayHeight;
        }
    }

    setupEventListeners() {
        // Tool buttons
        document.getElementById('addTriangleBtn').addEventListener('click', () => this.setTool('triangle'));
        document.getElementById('addSquareBtn').addEventListener('click', () => this.setTool('square'));
        document.getElementById('drawPolygonBtn').addEventListener('click', () => this.setTool('draw'));
        document.getElementById('selectBtn').addEventListener('click', () => this.setTool('select'));
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteSelected());
        document.getElementById('changeContentBtn').addEventListener('click', () => this.showContentModal());

        // Mode buttons
        document.getElementById('performanceBtn').addEventListener('click', () => this.togglePerformanceMode());
        document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveProject());
        document.getElementById('loadBtn').addEventListener('click', () => this.loadProjectDialog());

        // Canvas interactions
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // Vertex fine-tune controls
        document.querySelectorAll('.arrow-btn').forEach(btn => {
            btn.addEventListener('click', () => this.finetuneVertex(btn.dataset.dir));
        });

        // Content modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.hideAllModals());
        });

        document.querySelectorAll('.content-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                if (type === 'shader') this.showShaderModal();
                else if (type === 'video') this.showVideoModal();
            });
        });

        document.querySelectorAll('.shader-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setPolygonContent('shader', btn.dataset.shader);
            });
        });

        document.getElementById('videoFileInput').addEventListener('change', (e) => {
            this.handleVideoUpload(e);
        });

        // Performance mode - tap anywhere to exit
        const performanceOverlay = document.getElementById('performanceOverlay');
        performanceOverlay.addEventListener('click', () => {
            this.togglePerformanceMode();
        });
        performanceOverlay.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.togglePerformanceMode();
        }, { passive: false });

        // Draggable vertex controls
        const vertexControls = document.getElementById('vertexControls');
        const dragHandle = vertexControls.querySelector('.control-drag-handle');

        dragHandle.addEventListener('mousedown', (e) => this.startControlsDrag(e));
        dragHandle.addEventListener('touchstart', (e) => this.startControlsDrag(e), { passive: false });

        document.addEventListener('mousemove', (e) => this.moveControls(e));
        document.addEventListener('touchmove', (e) => this.moveControls(e), { passive: false });

        document.addEventListener('mouseup', () => this.stopControlsDrag());
        document.addEventListener('touchend', () => this.stopControlsDrag());
    }

    startControlsDrag(e) {
        e.preventDefault();
        e.stopPropagation();

        const vertexControls = document.getElementById('vertexControls');
        const rect = vertexControls.getBoundingClientRect();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        this.controlsDragStart = {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    moveControls(e) {
        if (!this.controlsDragStart) return;

        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const vertexControls = document.getElementById('vertexControls');

        const newX = clientX - this.controlsDragStart.x;
        const newY = clientY - this.controlsDragStart.y;

        // Keep within viewport bounds
        const maxX = window.innerWidth - vertexControls.offsetWidth;
        const maxY = window.innerHeight - vertexControls.offsetHeight;

        this.controlsPosition.x = Math.max(0, Math.min(newX, maxX));
        this.controlsPosition.y = Math.max(0, Math.min(newY, maxY));

        vertexControls.style.left = this.controlsPosition.x + 'px';
        vertexControls.style.top = this.controlsPosition.y + 'px';
        vertexControls.style.right = 'auto';
        vertexControls.style.bottom = 'auto';
    }

    stopControlsDrag() {
        this.controlsDragStart = null;
    }

    setTool(tool) {
        this.currentTool = tool;
        this.isDrawing = false;
        this.drawingVertices = [];

        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        if (tool === 'select') document.getElementById('selectBtn').classList.add('active');
        else if (tool === 'triangle') document.getElementById('addTriangleBtn').classList.add('active');
        else if (tool === 'square') document.getElementById('addSquareBtn').classList.add('active');
        else if (tool === 'draw') document.getElementById('drawPolygonBtn').classList.add('active');
    }

    getNormalizedCoords(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) / rect.width,
            y: (clientY - rect.top) / rect.height
        };
    }

    // Touch event handlers
    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.handlePointerDown(touch.clientX, touch.clientY);
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.handlePointerMove(touch.clientX, touch.clientY);
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        this.handlePointerUp();
    }

    // Mouse event handlers
    handleMouseDown(e) {
        this.handlePointerDown(e.clientX, e.clientY);
    }

    handleMouseMove(e) {
        this.handlePointerMove(e.clientX, e.clientY);
    }

    handleMouseUp(e) {
        this.handlePointerUp();
    }

    // Unified pointer handling
    handlePointerDown(clientX, clientY) {
        const coords = this.getNormalizedCoords(clientX, clientY);

        if (this.currentTool === 'triangle') {
            const poly = ShapeFactory.createTriangle(coords.x, coords.y);
            this.polygons.push(poly);
            this.selectPolygon(poly);
            this.setTool('select');
        } else if (this.currentTool === 'square') {
            const poly = ShapeFactory.createSquare(coords.x, coords.y);
            this.polygons.push(poly);
            this.selectPolygon(poly);
            this.setTool('select');
        } else if (this.currentTool === 'draw') {
            // Check if tapping near first vertex to close polygon
            if (this.drawingVertices.length >= 3) {
                const first = this.drawingVertices[0];
                const dx = coords.x - first.x;
                const dy = coords.y - first.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 0.05) { // Close enough to first vertex
                    this.finishDrawing();
                    return;
                }
            }

            // Add new vertex
            this.drawingVertices.push({ x: coords.x, y: coords.y });
            this.isDrawing = true;
        } else if (this.currentTool === 'select') {
            // Check if clicking on a vertex
            let foundVertex = false;
            for (let i = this.polygons.length - 1; i >= 0; i--) {
                const poly = this.polygons[i];
                const vertexIndex = poly.getVertexAtPoint(coords.x, coords.y);
                if (vertexIndex >= 0) {
                    this.selectPolygon(poly);
                    this.selectedVertex = vertexIndex;
                    this.updateVertexControls(true);
                    foundVertex = true;
                    break;
                }
            }

            if (!foundVertex) {
                // Check if clicking inside a polygon
                let foundPolygon = false;
                for (let i = this.polygons.length - 1; i >= 0; i--) {
                    const poly = this.polygons[i];
                    if (poly.containsPoint(coords.x, coords.y)) {
                        this.selectPolygon(poly);
                        this.selectedVertex = -1;
                        this.updateVertexControls(false);
                        this.dragStart = coords;
                        foundPolygon = true;
                        break;
                    }
                }

                if (!foundPolygon) {
                    // Clicked on blank area - deselect everything
                    this.selectPolygon(null);
                    this.selectedVertex = -1;
                    this.updateVertexControls(false);
                }
            }
        }
    }

    handlePointerMove(clientX, clientY) {
        const coords = this.getNormalizedCoords(clientX, clientY);

        if (this.selectedPolygon && this.selectedVertex >= 0) {
            // Moving a vertex
            this.selectedPolygon.moveVertex(this.selectedVertex, coords.x, coords.y);
        } else if (this.selectedPolygon && this.dragStart) {
            // Moving entire polygon
            const dx = coords.x - this.dragStart.x;
            const dy = coords.y - this.dragStart.y;
            this.selectedPolygon.translate(dx, dy);
            this.dragStart = coords;
        }
    }

    handlePointerUp() {
        // Only hide vertex controls if we were dragging, not if selecting
        if (this.dragStart) {
            this.dragStart = null;
        }
        // Keep vertex selected after dragging it
    }

    finishDrawing() {
        if (this.drawingVertices.length >= 3) {
            const poly = new Polygon(this.drawingVertices);
            this.polygons.push(poly);
            this.selectPolygon(poly);
        }
        this.drawingVertices = [];
        this.isDrawing = false;
        this.setTool('select');
    }

    selectPolygon(poly) {
        this.polygons.forEach(p => p.selected = false);
        this.selectedPolygon = poly;
        if (poly) poly.selected = true;
    }

    updateVertexControls(show) {
        const vertexControls = document.getElementById('vertexControls');
        if (show && this.selectedVertex >= 0) {
            vertexControls.classList.remove('hidden');
        } else {
            vertexControls.classList.add('hidden');
        }
    }

    finetuneVertex(direction) {
        if (!this.selectedPolygon || this.selectedVertex < 0) return;

        const vertex = this.selectedPolygon.vertices[this.selectedVertex];
        const delta = 1 / this.canvas.width; // 1 pixel

        switch (direction) {
            case 'up': vertex.y = Math.max(0, vertex.y - delta); break;
            case 'down': vertex.y = Math.min(1, vertex.y + delta); break;
            case 'left': vertex.x = Math.max(0, vertex.x - delta); break;
            case 'right': vertex.x = Math.min(1, vertex.x + delta); break;
        }
    }

    deleteSelected() {
        if (this.selectedPolygon) {
            const index = this.polygons.indexOf(this.selectedPolygon);
            if (index >= 0) {
                this.polygons.splice(index, 1);
                this.selectedPolygon = null;
            }
        }
    }

    // Content management
    showContentModal() {
        if (!this.selectedPolygon) {
            this.showStatus('Please select a polygon first');
            return;
        }
        document.getElementById('contentModal').classList.remove('hidden');
    }

    showShaderModal() {
        document.getElementById('contentModal').classList.add('hidden');
        document.getElementById('shaderModal').classList.remove('hidden');
    }

    showVideoModal() {
        document.getElementById('contentModal').classList.add('hidden');
        document.getElementById('videoModal').classList.remove('hidden');
        this.updateVideoList();
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
    }

    setPolygonContent(type, data) {
        if (this.selectedPolygon) {
            this.selectedPolygon.setContent(type, data);
            this.hideAllModals();
            this.showStatus(`Content updated: ${type}`);
        }
    }

    handleVideoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            this.loadedVideos.set(file.name, url);
            this.updateVideoList();
            e.target.value = ''; // Reset input
        }
    }

    updateVideoList() {
        const videoList = document.getElementById('videoList');
        videoList.innerHTML = '';

        this.loadedVideos.forEach((url, name) => {
            const btn = document.createElement('button');
            btn.className = 'content-type-btn';
            btn.textContent = name;
            btn.addEventListener('click', () => {
                this.setPolygonContent('video', url);
            });
            videoList.appendChild(btn);
        });
    }

    // Performance mode
    togglePerformanceMode() {
        this.editMode = !this.editMode;
        document.getElementById('editControls').style.display = this.editMode ? 'block' : 'none';
        document.getElementById('performanceOverlay').classList.toggle('hidden', this.editMode);
        this.overlayCanvas.style.display = this.editMode ? 'block' : 'none';
    }

    // Fullscreen
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                this.showStatus('Fullscreen not available');
            });
        } else {
            document.exitFullscreen();
        }
    }

    // Save/Load
    saveProject() {
        const data = {
            polygons: this.polygons.map(p => p.toJSON()),
            videos: Array.from(this.loadedVideos.entries())
        };
        localStorage.setItem('mobileMapperProject', JSON.stringify(data));
        this.showStatus('Project saved!');
    }

    loadProject() {
        const saved = localStorage.getItem('mobileMapperProject');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.polygons = data.polygons.map(p => Polygon.fromJSON(p));
                if (data.videos) {
                    this.loadedVideos = new Map(data.videos);
                }
            } catch (e) {
                console.error('Failed to load project:', e);
            }
        }
    }

    loadProjectDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    this.polygons = data.polygons.map(p => Polygon.fromJSON(p));
                    if (data.videos) {
                        this.loadedVideos = new Map(data.videos);
                    }
                    this.showStatus('Project loaded!');
                } catch (e) {
                    this.showStatus('Failed to load project file');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    showStatus(message) {
        const status = document.getElementById('statusMsg');
        status.textContent = message;
        status.classList.remove('hidden');
        setTimeout(() => status.classList.add('hidden'), 2000);
    }

    // Animation loop
    animate() {
        this.renderer.render(this.polygons, this.editMode);

        // Clear overlay
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        const w = this.overlayCanvas.width;
        const h = this.overlayCanvas.height;

        // Draw edit mode overlays (outlines and vertices for all polygons)
        if (this.editMode) {
            this.polygons.forEach(poly => {
                // Only show outline and vertices for selected polygon
                if (poly.selected) {
                    this.overlayCtx.strokeStyle = '#00ff00';
                    this.overlayCtx.lineWidth = 3;
                    this.overlayCtx.setLineDash([]);

                    // Draw outline
                    this.overlayCtx.beginPath();
                    poly.vertices.forEach((v, i) => {
                        const x = v.x * w;
                        const y = v.y * h;
                        if (i === 0) this.overlayCtx.moveTo(x, y);
                        else this.overlayCtx.lineTo(x, y);
                    });
                    this.overlayCtx.closePath();
                    this.overlayCtx.stroke();

                    // Draw vertices
                    poly.vertices.forEach((v, idx) => {
                        const x = v.x * w;
                        const y = v.y * h;

                        // Highlight selected vertex in cyan
                        const isSelected = idx === this.selectedVertex;

                        if (isSelected) {
                            // Draw larger glow for selected vertex
                            this.overlayCtx.fillStyle = 'rgba(0, 255, 255, 0.3)';
                            this.overlayCtx.beginPath();
                            this.overlayCtx.arc(x, y, 12, 0, Math.PI * 2);
                            this.overlayCtx.fill();
                        }

                        this.overlayCtx.fillStyle = isSelected ? '#00ffff' : '#00ff00';
                        this.overlayCtx.beginPath();
                        this.overlayCtx.arc(x, y, isSelected ? 8 : 6, 0, Math.PI * 2);
                        this.overlayCtx.fill();
                        this.overlayCtx.strokeStyle = '#000000';
                        this.overlayCtx.lineWidth = 2;
                        this.overlayCtx.stroke();
                    });
                }
            });
        }

        // Draw in-progress polygon
        if (this.isDrawing && this.drawingVertices.length > 0) {
            this.overlayCtx.strokeStyle = '#ffff00';
            this.overlayCtx.lineWidth = 2;
            this.overlayCtx.setLineDash([5, 5]);
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

                // First vertex is highlighted (where you close the polygon)
                if (i === 0 && this.drawingVertices.length >= 3) {
                    this.overlayCtx.fillStyle = '#00ff00';
                    this.overlayCtx.beginPath();
                    this.overlayCtx.arc(x, y, 10, 0, Math.PI * 2);
                    this.overlayCtx.fill();
                }

                this.overlayCtx.fillStyle = '#ffff00';
                this.overlayCtx.beginPath();
                this.overlayCtx.arc(x, y, 6, 0, Math.PI * 2);
                this.overlayCtx.fill();
                this.overlayCtx.strokeStyle = '#000000';
                this.overlayCtx.lineWidth = 1;
                this.overlayCtx.setLineDash([]);
                this.overlayCtx.stroke();
            });

            // Show instruction
            if (this.drawingVertices.length >= 3) {
                this.overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.overlayCtx.fillRect(10, 10, 250, 30);
                this.overlayCtx.fillStyle = '#00ff00';
                this.overlayCtx.font = '14px sans-serif';
                this.overlayCtx.fillText('Tap green vertex to finish', 20, 30);
            }
        }

        requestAnimationFrame(() => this.animate());
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new MobileMapperApp();
    });
} else {
    window.app = new MobileMapperApp();
}
