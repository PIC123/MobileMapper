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

        // Triangulate polygon (simple fan triangulation)
        const positions = [];
        const texCoords = [];

        for (let i = 1; i < clipVertices.length - 1; i++) {
            positions.push(clipVertices[0].x, clipVertices[0].y);
            positions.push(clipVertices[i].x, clipVertices[i].y);
            positions.push(clipVertices[i + 1].x, clipVertices[i + 1].y);

            // Map texture coordinates to polygon's bounding box
            texCoords.push(
                (polygon.vertices[0].x - bounds.minX) / bounds.width,
                (polygon.vertices[0].y - bounds.minY) / bounds.height
            );
            texCoords.push(
                (polygon.vertices[i].x - bounds.minX) / bounds.width,
                (polygon.vertices[i].y - bounds.minY) / bounds.height
            );
            texCoords.push(
                (polygon.vertices[i + 1].x - bounds.minX) / bounds.width,
                (polygon.vertices[i + 1].y - bounds.minY) / bounds.height
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
            // Video texture
            const texture = gl.createTexture();
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
