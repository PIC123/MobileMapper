// WebGL Renderer for projection mapping
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl', {
            preserveDrawingBuffer: true,
            antialias: true
        });

        if (!this.gl) {
            alert('WebGL not supported on this device');
            return;
        }

        this.programs = {};
        this.startTime = Date.now();
        this.videoTextures = new Map(); // Cache video textures
        this.setupShaders();

        // Resize canvas to match display size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(0, 0, displayWidth, displayHeight);
        }
    }

    // Compile and link shaders
    setupShaders() {
        const gl = this.gl;

        for (let shaderName in SHADERS) {
            const shader = SHADERS[shaderName];
            const program = this.createProgram(VERTEX_SHADER, shader.fragment);

            if (program) {
                this.programs[shaderName] = {
                    program: program,
                    attribLocations: {
                        position: gl.getAttribLocation(program, 'a_position'),
                        texCoord: gl.getAttribLocation(program, 'a_texCoord')
                    },
                    uniformLocations: {
                        time: gl.getUniformLocation(program, 'u_time'),
                        resolution: gl.getUniformLocation(program, 'u_resolution')
                    }
                };
            }
        }

        // Create video program
        const videoFragmentShader = `
            precision mediump float;
            uniform sampler2D u_texture;
            varying vec2 v_texCoord;

            void main() {
                gl_FragColor = texture2D(u_texture, v_texCoord);
            }
        `;

        const videoProgram = this.createProgram(VERTEX_SHADER, videoFragmentShader);
        if (videoProgram) {
            this.programs.video = {
                program: videoProgram,
                attribLocations: {
                    position: gl.getAttribLocation(videoProgram, 'a_position'),
                    texCoord: gl.getAttribLocation(videoProgram, 'a_texCoord')
                },
                uniformLocations: {
                    texture: gl.getUniformLocation(videoProgram, 'u_texture')
                }
            };
        }
    }

    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

        if (!vertexShader || !fragmentShader) return null;

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    // Convert normalized coordinates to clip space
    normalizedToClipSpace(x, y) {
        return {
            x: x * 2 - 1,
            y: -(y * 2 - 1) // Flip Y axis
        };
    }

    // Detect polygon winding order (true = counter-clockwise, false = clockwise)
    isCounterClockwise(vertices) {
        let area = 0;
        for (let i = 0; i < vertices.length; i++) {
            const j = (i + 1) % vertices.length;
            area += vertices[i].x * vertices[j].y;
            area -= vertices[j].x * vertices[i].y;
        }
        return area > 0;
    }

    // Ear clipping triangulation for concave polygons
    triangulatePolygon(vertices) {
        // Returns array of triangle indices
        if (vertices.length < 3) return [];
        if (vertices.length === 3) return [0, 1, 2];

        // Ensure vertices are in counter-clockwise order
        const isCCW = this.isCounterClockwise(vertices);
        const workingVertices = isCCW ? vertices : vertices.slice().reverse();

        const indices = [];
        const availableIndices = workingVertices.map((_, i) => i);

        while (availableIndices.length > 3) {
            let earFound = false;

            for (let i = 0; i < availableIndices.length; i++) {
                const prevIdx = availableIndices[(i - 1 + availableIndices.length) % availableIndices.length];
                const currIdx = availableIndices[i];
                const nextIdx = availableIndices[(i + 1) % availableIndices.length];

                const prev = workingVertices[prevIdx];
                const curr = workingVertices[currIdx];
                const next = workingVertices[nextIdx];

                // Check if this is an ear
                if (this.isEar(prev, curr, next, workingVertices, availableIndices)) {
                    // Add triangle
                    indices.push(prevIdx, currIdx, nextIdx);
                    // Remove current vertex
                    availableIndices.splice(i, 1);
                    earFound = true;
                    break;
                }
            }

            // Fallback if no ear found (shouldn't happen with valid polygons)
            if (!earFound) {
                console.warn('No ear found, using fallback triangulation');
                break;
            }
        }

        // Add final triangle
        if (availableIndices.length === 3) {
            indices.push(availableIndices[0], availableIndices[1], availableIndices[2]);
        }

        // Map indices back to original vertex order if we reversed them
        if (!isCCW) {
            const n = vertices.length;
            return indices.map(idx => n - 1 - idx);
        }

        return indices;
    }

    isEar(prev, curr, next, allVertices, availableIndices) {
        // Check if angle at curr is convex (assuming CCW winding)
        const cross = (next.x - curr.x) * (prev.y - curr.y) - (next.y - curr.y) * (prev.x - curr.x);
        if (cross <= 0) return false; // Concave or collinear

        // Check if any other vertex is inside this triangle
        for (let idx of availableIndices) {
            const v = allVertices[idx];
            if (v === prev || v === curr || v === next) continue;

            if (this.isPointInTriangle(v, prev, curr, next)) {
                return false;
            }
        }

        return true;
    }

    isPointInTriangle(p, a, b, c) {
        const sign = (p1, p2, p3) => {
            return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
        };

        const d1 = sign(p, a, b);
        const d2 = sign(p, b, c);
        const d3 = sign(p, c, a);

        const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

        return !(hasNeg && hasPos);
    }

    // Render a single polygon
    renderPolygon(polygon) {
        const gl = this.gl;

        let programInfo;
        if (polygon.contentType === 'video' && polygon.videoElement) {
            programInfo = this.programs.video;
        } else {
            programInfo = this.programs[polygon.shaderType] || this.programs.rainbow;
        }

        if (!programInfo) return;

        gl.useProgram(programInfo.program);

        // Convert polygon vertices to clip space
        const clipVertices = polygon.vertices.map(v =>
            this.normalizedToClipSpace(v.x, v.y)
        );

        // Calculate bounding box for UV mapping
        const bounds = polygon.getBoundingBox();

        // Triangulate polygon using ear clipping (handles concave polygons)
        const triangleIndices = this.triangulatePolygon(polygon.vertices);
        const positions = [];
        const texCoords = [];

        // Build position and texture coordinate arrays from triangle indices
        for (let i = 0; i < triangleIndices.length; i++) {
            const idx = triangleIndices[i];
            const vertex = polygon.vertices[idx];
            const clipVertex = clipVertices[idx];

            // Add position in clip space
            positions.push(clipVertex.x, clipVertex.y);

            // Map texture coordinates to polygon's bounding box
            texCoords.push(
                (vertex.x - bounds.minX) / bounds.width,
                (vertex.y - bounds.minY) / bounds.height
            );
        }

        // Position buffer
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(programInfo.attribLocations.position);
        gl.vertexAttribPointer(programInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);

        // TexCoord buffer
        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(programInfo.attribLocations.texCoord);
        gl.vertexAttribPointer(programInfo.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);

        // Set uniforms
        if (polygon.contentType === 'video' && polygon.videoElement) {
            // Get or create texture for this polygon
            let texture = this.videoTextures.get(polygon.id);
            if (!texture) {
                texture = gl.createTexture();
                this.videoTextures.set(polygon.id, texture);
            }

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, polygon.videoElement);
            gl.uniform1i(programInfo.uniformLocations.texture, 0);
        } else {
            // Shader uniforms
            const time = (Date.now() - this.startTime) / 1000;
            gl.uniform1f(programInfo.uniformLocations.time, time);
            gl.uniform2f(programInfo.uniformLocations.resolution, this.canvas.width, this.canvas.height);
        }

        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);

        // Cleanup
        gl.deleteBuffer(positionBuffer);
        gl.deleteBuffer(texCoordBuffer);
    }

    // Render all polygons
    render(polygons, editMode = false) {
        const gl = this.gl;

        // Clear
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Render each polygon
        polygons.forEach(poly => this.renderPolygon(poly));
    }
}
