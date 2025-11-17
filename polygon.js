// Polygon class to represent each shape
class Polygon {
    constructor(vertices, id = null) {
        this.id = id || Date.now() + Math.random();
        this.vertices = vertices; // Array of {x, y} points (normalized 0-1)
        this.contentType = 'shader'; // 'shader' or 'video'
        this.shaderType = 'rainbow';
        this.videoSrc = null;
        this.videoElement = null;
        this.selected = false;
    }

    // Check if a point is inside the polygon
    containsPoint(x, y) {
        let inside = false;
        for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
            const xi = this.vertices[i].x, yi = this.vertices[i].y;
            const xj = this.vertices[j].x, yj = this.vertices[j].y;

            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // Get the index of the vertex at the given point (with tolerance)
    getVertexAtPoint(x, y, tolerance = 0.02) {
        for (let i = 0; i < this.vertices.length; i++) {
            const v = this.vertices[i];
            const dx = v.x - x;
            const dy = v.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < tolerance) {
                return i;
            }
        }
        return -1;
    }

    // Move a specific vertex
    moveVertex(index, x, y) {
        if (index >= 0 && index < this.vertices.length) {
            this.vertices[index].x = Math.max(0, Math.min(1, x));
            this.vertices[index].y = Math.max(0, Math.min(1, y));
        }
    }

    // Move the entire polygon
    translate(dx, dy) {
        this.vertices.forEach(v => {
            v.x = Math.max(0, Math.min(1, v.x + dx));
            v.y = Math.max(0, Math.min(1, v.y + dy));
        });
    }

    // Get bounding box of polygon
    getBoundingBox() {
        const xs = this.vertices.map(v => v.x);
        const ys = this.vertices.map(v => v.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        return {
            minX,
            maxX,
            minY,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    // Set content type
    setContent(type, data) {
        this.contentType = type;
        if (type === 'shader') {
            this.shaderType = data;
        } else if (type === 'video') {
            this.videoSrc = data;
            this.loadVideo();
        }
    }

    // Load video element
    loadVideo() {
        if (this.videoSrc) {
            this.videoElement = document.createElement('video');
            this.videoElement.src = this.videoSrc;
            this.videoElement.loop = true;
            this.videoElement.muted = true;
            this.videoElement.playsInline = true;
            this.videoElement.play().catch(e => console.log('Video play failed:', e));
        }
    }

    // Serialize for saving
    toJSON() {
        return {
            id: this.id,
            vertices: this.vertices,
            contentType: this.contentType,
            shaderType: this.shaderType,
            videoSrc: this.videoSrc
        };
    }

    // Deserialize from saved data
    static fromJSON(data) {
        const poly = new Polygon(data.vertices, data.id);
        poly.contentType = data.contentType;
        poly.shaderType = data.shaderType;
        poly.videoSrc = data.videoSrc;
        if (poly.videoSrc) {
            poly.loadVideo();
        }
        return poly;
    }
}

// Helper function to create preset shapes
class ShapeFactory {
    static createTriangle(centerX, centerY, size = 0.15) {
        const height = size * Math.sqrt(3) / 2;
        return new Polygon([
            { x: centerX, y: centerY - height * 0.66 },
            { x: centerX - size / 2, y: centerY + height * 0.33 },
            { x: centerX + size / 2, y: centerY + height * 0.33 }
        ]);
    }

    static createSquare(centerX, centerY, size = 0.15) {
        const half = size / 2;
        return new Polygon([
            { x: centerX - half, y: centerY - half },
            { x: centerX + half, y: centerY - half },
            { x: centerX + half, y: centerY + half },
            { x: centerX - half, y: centerY + half }
        ]);
    }
}
