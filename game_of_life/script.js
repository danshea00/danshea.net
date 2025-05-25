'use strict';

const RESOLUTION_MULTIPLIER = 3; // e.g., 2 means texture is 2x canvas resolution in each dimension

const canvas = document.getElementById('gameCanvas');
const shapeHud = document.getElementById('shapeHud');
let gl;

const quadVertSource = `
// Vertex shader for drawing a simple quad
attribute vec2 a_position; // Vertex position (clip space coordinates)
varying vec2 v_texCoord;   // Texture coordinate to pass to fragment shader

void main() {
    // Pass clip space position directly
    gl_Position = vec4(a_position, 0.0, 1.0);

    // Convert clip space coordinates to texture coordinates
    // a_position is in [-1, 1], texCoord needs to be in [0, 1]
    v_texCoord = (a_position + 1.0) / 2.0;
}
`;

const displayVertSource = `
// Vertex shader for displaying the quad with zoom and pan
attribute vec2 a_position;    // Vertex position (clip space coordinates)
varying vec2 v_texCoord;      // Texture coordinate to pass to fragment shader

uniform float u_zoom;         // Zoom level (1.0 = no zoom, >1 = zoom in)
uniform vec2 u_viewCenter;   // Texture coordinate (0-1) at the center of the screen

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);

    // Convert clip space a_position to screen texture coordinates (0-1)
    // a_position is in [-1, 1], so (a_position + 1.0) / 2.0 maps to [0, 1]
    // Y is 0 at bottom, 1 at top for standard texture coords
    vec2 screenTexCoord = (a_position + 1.0) / 2.0;

    // Calculate the texture coordinate to sample from the game state texture
    // 1. Translate screenTexCoord so its center is (0,0) instead of (0.5,0.5)
    // 2. Scale by 1.0/u_zoom (e.g., if zoom is 2, we sample from a region half the size)
    // 3. Add u_viewCenter to position this scaled region around the desired center point in the texture
    v_texCoord = (screenTexCoord - 0.5) / u_zoom + u_viewCenter;
}
`;

const simFragSource = `
// Fragment shader for Game of Life simulation step (with aging)
precision mediump float;

uniform sampler2D u_prevState; // Previous game state texture (R stores age/255.0)
uniform vec2 u_resolution;     // Resolution of the texture/canvas

varying vec2 v_texCoord;       // Texture coordinate from vertex shader

// Game of Life rules
const float BORN_MIN = 3.0;
const float BORN_MAX = 3.0;
const float SURVIVE_MIN = 2.0;
const float SURVIVE_MAX = 3.0;
const float MAX_AGE_VALUE = 255.0; // Max actual age we can represent (fits in a byte)

// Returns actual age of a cell (e.g., 0, 1, 2, ... up to MAX_AGE_VALUE)
float getActualAge(vec2 offset) {
    vec2 texelSize = 1.0 / u_resolution;
    // Texture stores age normalized (age_byte_value / 255.0).
    // So, texture2D(...).r is in [0,1]. Multiply by MAX_AGE_VALUE to get actual age.
    return texture2D(u_prevState, v_texCoord + offset * texelSize).r * MAX_AGE_VALUE;
}

// Helper to check if a neighbor cell is alive (age > 0)
float isNeighborAlive(vec2 offset) {
    // A cell is alive if its actual age is > 0.5 (i.e., at least 1)
    return step(0.5, getActualAge(offset));
}

void main() {
    float aliveNeighbors = 0.0;
    // Check 8 neighbors
    aliveNeighbors += isNeighborAlive(vec2(-1.0, -1.0));
    aliveNeighbors += isNeighborAlive(vec2( 0.0, -1.0));
    aliveNeighbors += isNeighborAlive(vec2( 1.0, -1.0));
    aliveNeighbors += isNeighborAlive(vec2(-1.0,  0.0));
    aliveNeighbors += isNeighborAlive(vec2( 1.0,  0.0));
    aliveNeighbors += isNeighborAlive(vec2(-1.0,  1.0));
    aliveNeighbors += isNeighborAlive(vec2( 0.0,  1.0));
    aliveNeighbors += isNeighborAlive(vec2( 1.0,  1.0));

    float currentActualAge = getActualAge(vec2(0.0, 0.0));
    float newActualAge = 0.0; // Dead by default (age 0)

    if (currentActualAge > 0.5) { // If currently alive (actual age > 0)
        if (aliveNeighbors >= SURVIVE_MIN && aliveNeighbors <= SURVIVE_MAX) {
            // Survives: increment age, cap at MAX_AGE_VALUE
            newActualAge = min(currentActualAge + 1.0, MAX_AGE_VALUE);
        }
        // Else it dies, newActualAge remains 0.0
    } else { // If currently dead (actual age is 0 or very close)
        if (aliveNeighbors >= BORN_MIN && aliveNeighbors <= BORN_MAX) {
            newActualAge = 1.0; // Born: set age to 1
        }
    }

    // Output new actual age, scaled to [0,1] for storage in the R channel of the texture.
    // G and B channels are set to 0. Alpha is 1.0.
    gl_FragColor = vec4(newActualAge / MAX_AGE_VALUE, 0.0, 0.0, 1.0);
}
`;

const displayFragSource = `
// Fragment shader for displaying the Game of Life state with age coloring
precision mediump float;

uniform sampler2D u_gameState; // Current game state texture (R channel has age/255.0)
varying vec2 v_texCoord;       // Texture coordinate from vertex shader

const float MAX_AGE_VALUE_DISPLAY = 255.0; // Should match MAX_AGE_VALUE in sim shader

// Define colors for different age groups
const vec3 COLOR_DEAD      = vec3(0.05, 0.05, 0.05); // Very dark gray for dead cells
const vec3 COLOR_AGE_1     = vec3(0.2, 1.0, 0.2);   // Bright Green (newborn)
const vec3 COLOR_AGE_2_5   = vec3(0.6, 1.0, 0.2);   // Lime Green (young)
const vec3 COLOR_AGE_6_10  = vec3(1.0, 1.0, 0.2);   // Yellow (adult)
const vec3 COLOR_AGE_11_15 = vec3(1.0, 0.7, 0.1);   // Orange (mature)
const vec3 COLOR_AGE_16_20 = vec3(1.0, 0.4, 0.1);   // Darker Orange (old)
const vec3 COLOR_AGE_21_PLUS= vec3(0.8, 0.1, 0.1);   // Dark Red (very old)

// Function to map actual age to a color
vec3 ageToColor(float actualAge) {
    if (actualAge < 0.5) return COLOR_DEAD;        // Age 0 (dead)
    if (actualAge < 1.5) return COLOR_AGE_1;       // Age 1
    if (actualAge < 5.5) return COLOR_AGE_2_5;     // Age 2-5
    if (actualAge < 10.5) return COLOR_AGE_6_10;   // Age 6-10
    if (actualAge < 15.5) return COLOR_AGE_11_15;  // Age 11-15
    if (actualAge < 20.5) return COLOR_AGE_16_20;  // Age 16-20
    return COLOR_AGE_21_PLUS;                      // Age 21+
}

void main() {
    // Read the normalized age from the R channel of the texture ([0,1])
    float normalizedAge = texture2D(u_gameState, v_texCoord).r;
    // Convert to actual age (e.g., 0 to 255)
    float actualAge = normalizedAge * MAX_AGE_VALUE_DISPLAY;

    vec3 finalColor = ageToColor(actualAge);
    gl_FragColor = vec4(finalColor, 1.0); // Output the calculated color
}
`;

// WebGL Programs
let simProgram;
let displayProgram;

// Buffers and Textures
let quadBuffer;
let textures = []; // For ping-ponging game state
let framebuffers = []; // For offscreen rendering

// Simulation state
let currentTextureIndex = 0;
let textureWidth, textureHeight; // Dimensions of our simulation grid
let gameRunning = false;
let lastFrameTime = 0;
const TARGET_FPS = 10; // Target FPS for simulation updates
const frameDelay = 1000 / TARGET_FPS;


// --- Interaction and UI State ---
let shapePlacementModeActive = true;
let selectedShapeIndex = 0;
let currentShapeRotation = 0; // 0, 90, 180, 270
let lastKnownMouseNDC = { x: 0.5, y: 0.5 }; // Normalized Device Coordinates for mouse, default center
// CELL_SIZE_FOR_PREVIEW is no longer used as texture size will match canvas pixel dimensions.

// Zoom and Pan state
let currentZoom = 1.0; // Start at no zoom (full view of the large texture)
const MIN_ZOOM = 1.0; // Prevent zooming out beyond the initial full view
const MAX_ZOOM = 20.0; // Allow zooming in up to 20x
let viewCenter = { u: 0.5, v: 0.5 }; // Center of the view in texture coordinates (0-1)

const SHAPES = [
    {
        name: "Pulsar",
        centerOffset: { r: 6, c: 6 },
        pattern: [ /* Pulsar pattern... */
            [0, 2], [0, 3], [0, 4], [0, 8], [0, 9], [0, 10], [2, 0], [3, 0], [4, 0], [2, 5], [3, 5], [4, 5], [2, 7], [3, 7], [4, 7], [2, 12], [3, 12], [4, 12], [5, 2], [5, 3], [5, 4], [5, 8], [5, 9], [5, 10], [7, 2], [7, 3], [7, 4], [7, 8], [7, 9], [7, 10], [8, 0], [9, 0], [10, 0], [8, 5], [9, 5], [10, 5], [8, 7], [9, 7], [10, 7], [8, 12], [9, 12], [10, 12], [12, 2], [12, 3], [12, 4], [12, 8], [12, 9], [12, 10]
        ]
    },
    { name: "Glider", centerOffset: { r: 1, c: 1 }, pattern: [ [0, 1], [1, 2], [2, 0], [2, 1], [2, 2] ] },
    { name: "Gosper Glider Gun", centerOffset: { r: 4, c: 17 }, pattern: [ [4,0],[4,1],[5,0],[5,1], [2,12],[2,13],[3,11],[3,15],[4,10],[4,16],[5,10],[5,14],[5,16],[5,17],[6,10],[6,16],[7,11],[7,15],[8,12],[8,13], [0,24],[1,22],[1,24],[2,20],[2,21],[3,20],[3,21],[4,20],[4,21],[5,22],[5,24],[6,24], [2,34],[2,35],[3,34],[3,35] ] },
    { name: "Eater", centerOffset: { r: 1, c: 1 }, pattern: [ [0,0],[0,1], [1,0], [2,1],[2,2], [3,2] ] },
    { name: "Block", centerOffset: { r: 0, c: 0 }, pattern: [ [0,0], [0,1], [1,0], [1,1] ] },
    { name: "Blinker", centerOffset: { r: 1, c: 0 }, pattern: [ [1,0], [1,1], [1,2] ] }
];


// Removed fetchShaders function

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error linking program:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

function createTexture(gl, width, height, data = null) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    // Use NEAREST filtering for pixel-perfect rendering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}

function createFramebuffer(gl, texture) {
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return fb;
}

function setupWebGL() {
    gl = canvas.getContext('webgl');
    if (!gl) {
        console.error("WebGL not supported!");
        return false;
    }

    const quadVertexShader = createShader(gl, gl.VERTEX_SHADER, quadVertSource); // Used for simulation
    const displayVertexShader = createShader(gl, gl.VERTEX_SHADER, displayVertSource); // Used for display, handles zoom/pan
    const simFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, simFragSource);
    const displayFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, displayFragSource);

    if (!quadVertexShader || !displayVertexShader || !simFragmentShader || !displayFragmentShader) return false;

    simProgram = createProgram(gl, quadVertexShader, simFragmentShader);
    displayProgram = createProgram(gl, displayVertexShader, displayFragmentShader);

    if (!simProgram || !displayProgram) return false;

    // Buffer for a full-screen quad
    quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    const positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    resizeCanvas(); // Initial canvas and texture setup
    initializeGridData(); // Initialize with a clear grid

    return true;
}

function initializeGridData(clear = true) {
    const initialData = new Uint8Array(textureWidth * textureHeight * 4);
    if (clear) { // Start with a clear grid
        for (let i = 0; i < initialData.length; i += 4) {
            initialData[i] = 0;   // R (state: 0 for dead)
            initialData[i+1] = 0; // G
            initialData[i+2] = 0; // B
            initialData[i+3] = 255; // A
        }
    }
    // For a random start, you could fill initialData randomly here.

    gl.bindTexture(gl.TEXTURE_2D, textures[0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureWidth, textureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, initialData);
    gl.bindTexture(gl.TEXTURE_2D, textures[1]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureWidth, textureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); // Second texture initially empty
}


function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    // For WebGL, texture dimensions are more critical than canvas pixel dimensions for simulation
    // Let's fix texture size for now, or make it configurable.
    // For simplicity, we'll use a fixed texture size. Zoom will be visual only.
    // Set texture dimensions to be a multiple of canvas pixel dimensions.
    // This means at zoom 1.0, the view shows the entire (larger) texture.
    textureWidth = canvas.width * RESOLUTION_MULTIPLIER;
    textureHeight = canvas.height * RESOLUTION_MULTIPLIER;

    // Recreate textures and framebuffers for the new size
    if (textures[0]) gl.deleteTexture(textures[0]);
    if (textures[1]) gl.deleteTexture(textures[1]);
    if (framebuffers[0]) gl.deleteFramebuffer(framebuffers[0]);
    if (framebuffers[1]) gl.deleteFramebuffer(framebuffers[1]);

    textures[0] = createTexture(gl, textureWidth, textureHeight);
    textures[1] = createTexture(gl, textureWidth, textureHeight);
    framebuffers[0] = createFramebuffer(gl, textures[0]);
    framebuffers[1] = createFramebuffer(gl, textures[1]);

    initializeGridData(true); // Clear grid on resize
    currentTextureIndex = 0; // Reset to draw from the first texture
}


function runSimulationStep() {
    gl.useProgram(simProgram);

    // Set uniforms for simulation shader
    const resolutionLocation = gl.getUniformLocation(simProgram, "u_resolution");
    gl.uniform2f(resolutionLocation, textureWidth, textureHeight);

    const prevStateLocation = gl.getUniformLocation(simProgram, "u_prevState");
    gl.uniform1i(prevStateLocation, 0); // Texture unit 0

    // Bind the texture to read from
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[currentTextureIndex]);

    // Bind the framebuffer to write to (the other texture)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[1 - currentTextureIndex]);
    gl.viewport(0, 0, textureWidth, textureHeight); // Ensure viewport matches texture

    // Draw the quad (this executes the simulation shader for each pixel)
    const positionLocation = gl.getAttribLocation(simProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Swap textures for next frame
    currentTextureIndex = 1 - currentTextureIndex;
}

function displayState() {
    gl.useProgram(displayProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Render to canvas
    gl.viewport(0, 0, canvas.width, canvas.height); // Set viewport to canvas size

    const gameStateLocation = gl.getUniformLocation(displayProgram, "u_gameState");
    gl.uniform1i(gameStateLocation, 0); // Texture unit 0

    const zoomLocation = gl.getUniformLocation(displayProgram, "u_zoom");
    gl.uniform1f(zoomLocation, currentZoom);

    const viewCenterLocation = gl.getUniformLocation(displayProgram, "u_viewCenter");
    gl.uniform2f(viewCenterLocation, viewCenter.u, viewCenter.v);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[currentTextureIndex]); // Display the latest state

    const positionLocation = gl.getAttribLocation(displayProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Draw shape preview (using 2D context on top for simplicity for now)
    drawPreviewOverlay();
}

function drawPreviewOverlay() {
    // The preview is now intended to be part of the WebGL rendering if shapePlacementModeActive.
    // This function will only update the HUD.
    // If a 2D canvas overlay for preview was desired, it would be drawn here.
    // For now, the main displayState handles rendering, and this just updates text.
    updateHudDisplay();
}


function gameLoop(timestamp) {
    if (gameRunning) {
        if (timestamp - lastFrameTime >= frameDelay) {
            runSimulationStep();
            lastFrameTime = timestamp;
        }
    }
    displayState();
    requestAnimationFrame(gameLoop);
}

function startGameSimulation() {
    if (!gameRunning) {
        gameRunning = true;
        lastFrameTime = performance.now(); // Reset timer
        // The loop is already started by requestAnimationFrame, just set the flag
    }
}

function stopGameSimulation() {
    gameRunning = false;
}

// --- Interaction Logic (Adapted for WebGL where possible) ---

function updateHudDisplay() {
    if (shapeHud) {
        shapeHud.textContent = `Shape: ${SHAPES[selectedShapeIndex].name} (Rot: ${currentShapeRotation}°)`;
    }
}

// Helper to convert mouse canvas coords to texture coords (0-1)
function getMouseTextureCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return {
        u: x / canvas.width,
        v: 1.0 - (y / canvas.height) // Flip Y for texture coords
    };
}
// Helper to convert mouse canvas coords to grid cell coords (for stamping)
function getMouseGridCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX_canvas = e.clientX - rect.left;
    const mouseY_canvas = e.clientY - rect.top;

    // Convert mouse canvas coordinates to screen texture coordinates (0-1 range)
    // screenTexU: 0 left, 1 right
    // screenTexV_shader: 0 bottom, 1 top (matches how v_texCoord is derived in displayVertSource)
    const screenTexU = mouseX_canvas / canvas.width;
    const screenTexV_shader = 1.0 - (mouseY_canvas / canvas.height);

    // Convert screen texture coordinates to world texture coordinates (coordinates on the game state texture)
    // These are in [0,1] range for the game texture, where (0,0) is bottom-left.
    const worldTexU = (screenTexU - 0.5) / currentZoom + viewCenter.u;
    const worldTexV = (screenTexV_shader - 0.5) / currentZoom + viewCenter.v;

    // Convert world texture coordinates to grid cell coordinates
    // c: column index, 0 at left, textureWidth-1 at right
    // r: row index, 0 at top, textureHeight-1 at bottom (this is the convention for 'r' in this script)
    const c = Math.floor(worldTexU * textureWidth);
    
    // worldTexV is 0 for bottom of texture, 1 for top.
    // r_from_bottom is 0 for bottom row, textureHeight-1 for top row.
    const r_from_bottom = Math.floor(worldTexV * textureHeight);
    // Convert r_from_bottom to r (where 0 is top row)
    const r = textureHeight - 1 - r_from_bottom;

    return { c: c, r: r };
}


function placeSelectedShapeOnTexture(texCoordR, texCoordC) {
    const shape = SHAPES[selectedShapeIndex];
    const alivePixel = new Uint8Array([1, 0, 0, 255]); // R=1 (age 1), G=0, B=0, A=255

    shape.pattern.forEach(([origDr, origDc]) => {
        let dr = origDr - shape.centerOffset.r;
        let dc = origDc - shape.centerOffset.c;
        let rDr = dr, rDc = dc;

        if (currentShapeRotation === 90) { rDr = -dc; rDc = dr; }
        else if (currentShapeRotation === 180) { rDr = -dr; rDc = -dc; }
        else if (currentShapeRotation === 270) { rDr = dc; rDc = -dr; }

        const r = texCoordR + rDr;
        const c = texCoordC + rDc;

        if (r >= 0 && r < textureHeight && c >= 0 && c < textureWidth) {
            // Update current texture
            gl.bindTexture(gl.TEXTURE_2D, textures[currentTextureIndex]);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, c, textureHeight - 1 - r, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, alivePixel);

            // If paused, also update the other texture to make the change "stick"
            if (!gameRunning) {
                gl.bindTexture(gl.TEXTURE_2D, textures[1 - currentTextureIndex]);
                gl.texSubImage2D(gl.TEXTURE_2D, 0, c, textureHeight - 1 - r, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, alivePixel);
            }
        }
    });

    if (!gameRunning) {
        displayState(); // Force a redraw if paused to show the placed shape
    }
}

function drawCellOnTexture(texCoordR, texCoordC) {
     if (texCoordR < 0 || texCoordR >= textureHeight || texCoordC < 0 || texCoordC >= textureWidth) return;

    const pixels = new Uint8Array(1 * 1 * 4);
    pixels[0] = 1; pixels[1] = 0; pixels[2] = 0; pixels[3] = 255; // R=1 (age 1), G=0, B=0

    gl.bindTexture(gl.TEXTURE_2D, textures[currentTextureIndex]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, texCoordC, textureHeight - 1 - texCoordR, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    if (!gameRunning) {
        // If paused, also update the *other* texture
        gl.bindTexture(gl.TEXTURE_2D, textures[1 - currentTextureIndex]);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, texCoordC, textureHeight - 1 - texCoordR, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        displayState(); // Force a redraw if paused
    }
}


// --- Event Listeners ---
let isDrawing = false; // For drawing individual cells

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
        isDrawing = true; // Set flag that mouse is down
        const gridCoords = getMouseGridCoords(e);
        if (shapePlacementModeActive) {
            placeSelectedShapeOnTexture(gridCoords.r, gridCoords.c);
        } else {
            drawCellOnTexture(gridCoords.r, gridCoords.c);
        }
    }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
});

canvas.addEventListener('mouseleave', () => { // Stop drawing if mouse leaves canvas
    isDrawing = false;
});

canvas.addEventListener('mousemove', (e) => {
    const gridCoords = getMouseGridCoords(e);
    lastKnownMouseNDC = getMouseTextureCoords(e); // For potential preview shader later

    if (isDrawing) { // If mouse button is held down
        if (shapePlacementModeActive) {
            placeSelectedShapeOnTexture(gridCoords.r, gridCoords.c);
        } else {
            drawCellOnTexture(gridCoords.r, gridCoords.c);
        }
    }
    // Preview drawing is now part of displayState if done via shader,
    // or would be a separate 2D canvas overlay draw call here.
    // For now, the preview is visualised by directly stamping on the texture.
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse position to texture coordinates (0-1 range, Y flipped)
    const mouseTexU = mouseX / canvas.width;
    const mouseTexV = 1.0 - (mouseY / canvas.height);

    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1; // Zoom in or out
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom * zoomFactor));

    // Adjust viewCenter to keep the point under the mouse stationary
    // The new viewCenter is calculated such that the mouseTexCoord remains at the same
    // relative position on the screen after zooming.
    // Let P_screen = (mouseTexU, mouseTexV) be the mouse position in screen texture space.
    // Let P_world_old = (P_screen - 0.5) / currentZoom + viewCenter be the world coord under mouse before zoom.
    // We want P_world_new = (P_screen - 0.5) / newZoom + newViewCenter to be the same as P_world_old.
    // So, newViewCenter = P_world_old - (P_screen - 0.5) / newZoom
    // newViewCenter = ((mouseTexU - 0.5) / currentZoom + viewCenter.u) - (mouseTexU - 0.5) / newZoom
    // newViewCenter.u = viewCenter.u + (mouseTexU - 0.5) * (1/currentZoom - 1/newZoom)
    // newViewCenter.v = viewCenter.v + (mouseTexV - 0.5) * (1/currentZoom - 1/newZoom)

    viewCenter.u = viewCenter.u + (mouseTexU - 0.5) * (1.0 / currentZoom - 1.0 / newZoom);
    viewCenter.v = viewCenter.v + (mouseTexV - 0.5) * (1.0 / currentZoom - 1.0 / newZoom);

    currentZoom = newZoom;

    // Clamp viewCenter to prevent scrolling too far off the texture
    // The visible portion of the texture is 1/currentZoom wide/high.
    // The viewCenter can range from (0.5/currentZoom) to (1 - 0.5/currentZoom)
    const minVC = 0.5 / currentZoom;
    const maxVC = 1.0 - 0.5 / currentZoom;

    viewCenter.u = Math.max(minVC, Math.min(maxVC, viewCenter.u));
    viewCenter.v = Math.max(minVC, Math.min(maxVC, viewCenter.v));

    if (!gameRunning) {
        displayState(); // Update display if paused
    }
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') {
        shapePlacementModeActive = !shapePlacementModeActive;
        currentShapeRotation = 0;
        updateHudDisplay();
    } else if (e.key === 's' || e.key === 'S') {
        if (gameRunning) stopGameSimulation();
        else startGameSimulation();
    } else if (e.key === 'r' || e.key === 'R') {
        if (shapePlacementModeActive) {
            currentShapeRotation = (currentShapeRotation + 90) % 360;
            updateHudDisplay();
        }
    } else if (shapePlacementModeActive) {
        if (e.key === 'ArrowRight') {
            selectedShapeIndex = (selectedShapeIndex + 1) % SHAPES.length;
            currentShapeRotation = 0;
            updateHudDisplay();
        } else if (e.key === 'ArrowLeft') {
            selectedShapeIndex = (selectedShapeIndex - 1 + SHAPES.length) % SHAPES.length;
            currentShapeRotation = 0;
            updateHudDisplay();
        }
    }
});


// --- Main ---
function main() {
    // Shaders are now embedded, no need to fetch
    if (!setupWebGL()) {
        return;
    }
    updateHudDisplay();
    requestAnimationFrame(gameLoop);
    startGameSimulation();
}

main();