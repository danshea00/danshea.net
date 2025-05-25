const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let CANVAS_WIDTH = window.innerWidth;
let CANVAS_HEIGHT = window.innerHeight; // Will be adjusted for h1
let GRID_SIZE = 40; // Initial sensible default, will be recalculated

// Canvas dimensions will be set in updateGameDimensions
// canvas.width = CANVAS_WIDTH;
// canvas.height = CANVAS_HEIGHT;

let FROG_START_X; // Will be set in updateGameDimensions
let FROG_START_Y; // Will be set in updateGameDimensions

class Frog {
    constructor(x, y, size, color = 'green') {
        this.x = x;
        this.y = y;
        this.width = size;
        this.height = size;
        this.color = color;
        this.initialX = x;
        this.initialY = y;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    move(dx, dy) {
        const newX = this.x + dx * GRID_SIZE;
        const newY = this.y + dy * GRID_SIZE;

        // Keep frog within canvas bounds
        if (newX >= 0 && newX + this.width <= CANVAS_WIDTH) {
            this.x = newX;
        }
        if (newY >= 0 && newY + this.height <= CANVAS_HEIGHT) {
            this.y = newY;
        }
    }

    reset() {
        this.x = this.initialX;
        this.y = this.initialY;
    }
}

const frog = new Frog(FROG_START_X, FROG_START_Y, GRID_SIZE);

// --- Car Class and Setup ---
class Car {
    constructor(x, y, width, height, speed, color = 'red', direction = 1) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.color = color;
        this.direction = direction; // 1 for right, -1 for left
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update() {
        this.x += this.speed * this.direction;

        // Wrap around screen
        if (this.direction === 1 && this.x > CANVAS_WIDTH) {
            this.x = -this.width;
        } else if (this.direction === -1 && this.x + this.width < 0) {
            this.x = CANVAS_WIDTH;
        }
    }
}

const cars = [];
// The carLanes global variable is removed as initCars now uses originalCarLanesConfig internally.

// The old initCars function is removed. The newer one (further down) will be used.
// --- End Car Class and Setup ---


// --- Log Class and Setup ---
class Log {
    constructor(x, y, width, height, speed, color = 'brown', direction = 1) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.color = color;
        this.direction = direction; // 1 for right, -1 for left
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update() {
        this.x += this.speed * this.direction;

        // Wrap around screen
        if (this.direction === 1 && this.x > CANVAS_WIDTH) {
            this.x = -this.width;
        } else if (this.direction === -1 && this.x + this.width < 0) {
            this.x = CANVAS_WIDTH;
        }
    }
}

const logs = [];
let logLanes = []; // Will be populated by updateGameDimensions

function updateLogLaneData() {
    logLanes = [
        { y: GRID_SIZE * 1.5, speed: 1 * (GRID_SIZE/40), direction: -1, color: '#A0522D', count: Math.max(2, Math.floor(CANVAS_WIDTH / (GRID_SIZE * 3.5))), spacing: GRID_SIZE * 3.5, logWidth: GRID_SIZE * 3 },
        { y: GRID_SIZE * 2.5, speed: 1.5 * (GRID_SIZE/40), direction: 1, color: '#8B4513', count: Math.max(2, Math.floor(CANVAS_WIDTH / (GRID_SIZE * 2.5))), spacing: GRID_SIZE * 2.5, logWidth: GRID_SIZE * 2 },
        { y: GRID_SIZE * 3.5, speed: 0.8 * (GRID_SIZE/40), direction: -1, color: '#D2691E', count: Math.max(2, Math.floor(CANVAS_WIDTH / (GRID_SIZE * 4.5))), spacing: GRID_SIZE * 4.5, logWidth: GRID_SIZE * 4 },
        { y: GRID_SIZE * 4.5, speed: 1.2 * (GRID_SIZE/40), direction: 1, color: '#A0522D', count: Math.max(2, Math.floor(CANVAS_WIDTH / (GRID_SIZE * 3.0))), spacing: GRID_SIZE * 3.0, logWidth: GRID_SIZE * 2.5 }
    ];
}


function initLogs() {
    logs.length = 0; // Clear existing logs
    updateLogLaneData(); // Ensure lane data is current
    logLanes.forEach(lane => {
        for (let i = 0; i < lane.count; i++) {
            // Ensure logs are distributed across the canvas width, even if count is low
            const initialOffset = lane.direction === 1 ? 0 : -lane.logWidth; // Start off-screen for left-moving logs if desired
            const logX = initialOffset + (i * (CANVAS_WIDTH + lane.logWidth * 1.5) / lane.count) % (CANVAS_WIDTH + lane.logWidth);

            logs.push(new Log(
                logX,
                lane.y, // Y position is now relative to GRID_SIZE
                lane.logWidth, // Width is now relative to GRID_SIZE
                GRID_SIZE * 0.8, // Log height
                lane.speed,
                lane.color,
                lane.direction
            ));
        }
    });
}
// --- End Log Class and Setup ---

let score = 0;
let scoreDisplay; // Will be created in initGameUI or similar

function createScoreDisplay() {
    if (scoreDisplay) document.body.removeChild(scoreDisplay); // Remove old one if exists
    scoreDisplay = document.createElement('div');
    scoreDisplay.style.position = 'absolute'; // Position relative to body
    const titleElement = document.querySelector('h1');
    const titleHeight = titleElement ? titleElement.offsetHeight : 0;
    scoreDisplay.style.top = `${titleHeight + 5}px`; // Position below the actual title
    scoreDisplay.style.left = '50%';
    scoreDisplay.style.transform = 'translateX(-50%)';
    scoreDisplay.style.fontSize = `${Math.max(12, GRID_SIZE * 0.5)}px`; // Slightly larger responsive font
    scoreDisplay.style.fontFamily = 'Arial, sans-serif';
    scoreDisplay.style.color = 'black';
    scoreDisplay.style.zIndex = '10'; // Ensure it's above the canvas
    document.body.appendChild(scoreDisplay);
}

function updateScore() {
    if (scoreDisplay) {
        scoreDisplay.textContent = `Score: ${score}`;
    }
}


function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw game elements
    drawBackground();

    // Update and draw cars
    cars.forEach(car => {
        car.update();
        car.draw();
    });

    // Update and draw logs
    logs.forEach(log => {
        log.update();
        log.draw();
    });

    frog.draw();

    // Check for collisions and frog riding logs
    checkCollisions();

    updateScore();
    requestAnimationFrame(gameLoop);
}

function drawBackground() {
    // Goal zone (top) - 1 row (row 0)
    ctx.fillStyle = '#c0c0c0'; // Light gray
    ctx.fillRect(0, 0, CANVAS_WIDTH, GRID_SIZE);

    // River area - 5 rows (rows 1-5)
    ctx.fillStyle = '#70a1ff'; // Blue from CSS
    ctx.fillRect(0, GRID_SIZE * 1, CANVAS_WIDTH, GRID_SIZE * 5);

    // Median strip (safe) - 1 row (row 6)
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(0, GRID_SIZE * 6, CANVAS_WIDTH, GRID_SIZE);

    // Road area - 5 rows (rows 7-11)
    ctx.fillStyle = '#333'; // Dark gray
    ctx.fillRect(0, GRID_SIZE * 7, CANVAS_WIDTH, GRID_SIZE * 5);

    // Bottom Safe zone - 2 rows (rows 12-13)
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(0, GRID_SIZE * 12, CANVAS_WIDTH, GRID_SIZE * 2);
    // Total 14 rows drawn. Frog starts on row 13.
}


function initCars() {
    cars.length = 0;
    const carHeight = GRID_SIZE * 0.8;
    const carWidth = GRID_SIZE * 1.5;

    // Original carLanes config is used as the source of truth for relative positions and speeds
    // Road occupies grid rows 7, 8, 9, 10, 11 (0-indexed from top of canvas)
    // We'll define 4 car lanes within these 5 road rows.
    // Example: one lane per road row, skipping one, or using fewer than 5.
    const carLaneConfigs = [
        // gridRowFromTop: 0 means top-most road lane (overall grid row 7)
        { baseSpeed: 1.5, direction: 1, color: 'blue', roadLaneIndex: 4 }, // Bottom-most car lane (overall grid row 11)
        { baseSpeed: 2.0, direction: -1, color: 'yellow', roadLaneIndex: 3 },// (overall grid row 10)
        { baseSpeed: 1.0, direction: 1, color: 'purple', roadLaneIndex: 1 },// (overall grid row 8)
        { baseSpeed: 2.5, direction: -1, color: 'orange', roadLaneIndex: 0 } // Top-most car lane (overall grid row 7)
    ];

    carLaneConfigs.forEach((laneConfig) => {
        // Road starts at overall grid row 7.
        const carGridRowY = (7 + laneConfig.roadLaneIndex) * GRID_SIZE;
        const carActualY = carGridRowY + (GRID_SIZE - carHeight) / 2; // Center car in its grid row

        const dynamicSpeed = laneConfig.baseSpeed * (GRID_SIZE / 40);
        const count = Math.max(2, Math.floor(CANVAS_WIDTH / (carWidth * 3.0))); // Adjusted spacing factor

        for (let i = 0; i < count; i++) {
            let carX;
            const effectiveTrackWidth = CANVAS_WIDTH + carWidth * 1.5;

            if (laneConfig.direction === 1) { // Moving right
                carX = -carWidth + (i * effectiveTrackWidth / count);
            } else { // Moving left
                carX = CANVAS_WIDTH + carWidth * 0.5 - (i * effectiveTrackWidth / count);
            }
            // Modulo for continuous spawning if desired, but update() handles wrapping.
            // This ensures a spread out initial placement.
            carX = carX % (CANVAS_WIDTH + carWidth);
            if (laneConfig.direction === -1 && carX < -carWidth) carX += (CANVAS_WIDTH + carWidth);


            cars.push(new Car(
                carX,
                carActualY,
                carWidth,
                carHeight,
                dynamicSpeed,
                laneConfig.color,
                laneConfig.direction
            ));
        }
    });
}


function checkCollisions() {
    // Car collisions
    for (const car of cars) {
        if (
            frog.x < car.x + car.width &&
            frog.x + frog.width > car.x &&
            frog.y < car.y + car.height &&
            frog.y + frog.height > car.y
        ) {
            console.log('Collision with car!');
            frog.reset(); // Reset frog position
            // Potentially decrease lives, show game over, etc.
            return; // Exit after one collision
        }
    }

    // River collision and log riding
    // River is visually from y = GRID_SIZE (row 1 top) to y = GRID_SIZE * 6 (row 5 bottom)
    const riverActualTopY = GRID_SIZE;
    const riverActualBottomY = GRID_SIZE * 6;

    let onLog = false;
    // Check if any part of the frog is vertically within the river's drawn area
    if (frog.y + frog.height > riverActualTopY && frog.y < riverActualBottomY) {
        for (const log of logs) {
            // Precise collision check between frog and log
            if (
                frog.x < log.x + log.width &&
                frog.x + frog.width > log.x &&
                frog.y < log.y + log.height &&
                frog.y + frog.height > log.y
            ) {
                onLog = true;
                frog.y = log.y; // Snap frog's Y to the log's Y for proper alignment
                frog.x += log.speed * log.direction; // Move frog with the log

                // Check if frog is swept off screen by the log
                if (frog.x + frog.width < 0 || frog.x > CANVAS_WIDTH) {
                    console.log('Swept away by log!');
                    frog.reset();
                    return; // Collision handled
                }
                // Keep frog on canvas if pushed by log near edges (redundant if above check is strict)
                // frog.x = Math.max(0, Math.min(frog.x, CANVAS_WIDTH - frog.width));
                break; // Frog is on a log
            }
        }

        if (!onLog) {
            console.log('Fell in the river!');
            frog.reset();
            return; // Collision handled
        }
    }

    // Check for reaching the goal (top safe zone)
    if (frog.y < GRID_SIZE) { // Frog's top edge is in the goal zone
        console.log('Reached the goal!');
        score += 10;
        frog.reset(); // Reset frog to start for another round
        // No return here, as frog reset handles the state.
    }
}


// Handle keyboard input
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'ArrowUp':
        case 'w':
            frog.move(0, -1);
            break;
        case 'ArrowDown':
        case 's':
            frog.move(0, 1);
            break;
        case 'ArrowLeft':
        case 'a':
            frog.move(-1, 0);
            break;
        case 'ArrowRight':
        case 'd':
            frog.move(1, 0);
            break;
    }
});

// Initialize and Start the game loop

function updateGameDimensions() {
    const titleElement = document.querySelector('h1');
    const titleHeight = titleElement ? titleElement.offsetHeight : 0;

    CANVAS_WIDTH = window.innerWidth;
    CANVAS_HEIGHT = window.innerHeight - titleHeight; // Canvas takes space below title

    // Ensure minimum dimensions for usability
    CANVAS_WIDTH = Math.max(CANVAS_WIDTH, 320); // Min width e.g. small mobile
    CANVAS_HEIGHT = Math.max(CANVAS_HEIGHT, 480); // Min height

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Recalculate GRID_SIZE based on new dimensions
    // Aim for roughly 10-12 columns and 15-18 rows for game elements.
    const cols = 12;
    const rows = 15; // Total conceptual rows for game area fitting
    
    GRID_SIZE = Math.floor(Math.min(CANVAS_WIDTH / cols, CANVAS_HEIGHT / rows));
    GRID_SIZE = Math.max(GRID_SIZE, 20); // Minimum grid size

    // Optional: Adjust canvas to be multiple of GRID_SIZE for pixel-perfect grid
    // CANVAS_WIDTH = Math.floor(CANVAS_WIDTH / GRID_SIZE) * GRID_SIZE;
    // CANVAS_HEIGHT = Math.floor(CANVAS_HEIGHT / GRID_SIZE) * GRID_SIZE;
    // canvas.width = CANVAS_WIDTH;
    // canvas.height = CANVAS_HEIGHT;

    FROG_START_X = Math.floor(CANVAS_WIDTH / 2 - GRID_SIZE / 2);
    // Frog starts on the 13th row from the top (0-indexed), which is the upper of the two bottom safe rows.
    // Bottom safe zone is rows 12 and 13. Frog on row 13.
    // Total drawn rows = 14 (0-13).
    FROG_START_Y = (15 - 2) * GRID_SIZE; // Equivalent to 13 * GRID_SIZE if CANVAS_HEIGHT is 15*GRID_SIZE
                                         // More robust: place in the middle of the drawn bottom safe zone
    FROG_START_Y = (GRID_SIZE * 12) + (GRID_SIZE * 2 - frog.height) / 2; // Centered in the 2-row bottom safe zone
                                                                      // Or simply: GRID_SIZE * 13 if frog height is GRID_SIZE
    FROG_START_Y = GRID_SIZE * 13; // Frog starts on the 14th row (index 13)

    // Update dynamic lane data for cars and logs
    // updateCarLaneData(); // This call is removed as the function is removed.
    updateLogLaneData(); // This function updates the logLanes array for initLogs.

    // Re-initialize game objects that depend on dimensions
    frog.initialX = FROG_START_X;
    frog.initialY = FROG_START_Y;
    frog.width = GRID_SIZE;
    frog.height = GRID_SIZE;
    frog.reset(); // Reset frog to new start position and size

    initCars(); // Re-create cars with new positions/sizes
    initLogs(); // Re-create logs with new positions/sizes
    createScoreDisplay(); // Recreate score display for new font size
    updateScore(); // Update score text
}


function initGame() {
    updateGameDimensions(); // Set initial dimensions and create elements
    gameLoop();
}

window.addEventListener('resize', updateGameDimensions);

initGame();