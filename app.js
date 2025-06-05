// Game Configuration
let config = {
    gridSize: 8,
    colors: ["red", "blue", "green", "yellow", "purple", "orange"],
    gearPercentage: 20,
    matchLength: 3,
    baseScore: 100,
    animationSpeed: "normal",
    cellSize: 80, // Will be calculated based on canvas size and grid size
    dragThreshold: 10,
    snapSpeed: 300,
    effects: {
        shake: true,
        particles: true,
        flash: true,
        showDragLine: true
    }
};

// Game State
let gameState = {
    grid: [],
    score: 0,
    moves: 0,
    multiplier: 1.0,
    dragging: false,
    dragStartPos: { x: 0, y: 0 },
    dragCurrentPos: { x: 0, y: 0 },
    dragType: null, // 'row' or 'column'
    dragIndex: -1,
    dragOffset: 0,
    dragGridX: -1,
    dragGridY: -1,
    animating: false,
    gearConnections: [], // Tracks which gears are connected
    spinning: [], // Tracks which gears are currently spinning
    baseMultiplier: 1.0,
    gearMultiplierBonus: 0.5
};

// DOM Elements
let canvas, ctx, dragOverlay;
let scoreDisplay, movesDisplay, multiplierDisplay, matchFeedback, particleContainer;
let settingsToggle, settingsPanel, settingsContent;

// Colors and Assets
const colorMap = {
    red: "#e74c3c",
    blue: "#3498db",
    green: "#2ecc71",
    yellow: "#f1c40f",
    purple: "#9b59b6",
    orange: "#e67e22"
};

const gearTeethPatterns = {
    clockwise: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    counterClockwise: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
};

// --- DEVICE & RESPONSIVE SCALING ---
let isMobileDevice = false;

function isMobile() {
    // Basic check for mobile devices
    return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|BlackBerry/i.test(navigator.userAgent) || (window.matchMedia && window.matchMedia("(max-width: 800px)").matches);
}

function getAvailableBoardSize() {
    // Get the available size for the board (square, minus some margin for UI)
    let w = window.innerWidth;
    let h = window.innerHeight;
    // If settings panel is visible and on desktop, subtract its width
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel && w > 700 && !isMobileDevice) {
        w -= settingsPanel.offsetWidth || 320;
    }
    // Leave some margin
    w -= 32;
    h -= 180; // header, stats, etc
    return Math.max(240, Math.min(w, h));
}

function resizeGameBoard() {
    isMobileDevice = isMobile();
    const boardPx = getAvailableBoardSize();
    // Set cell size based on grid size and available space
    config.cellSize = Math.floor(boardPx / config.gridSize);
    // Resize canvas
    canvas.width = config.gridSize * config.cellSize;
    canvas.height = config.gridSize * config.cellSize;
    // Resize overlay
    dragOverlay.style.width = canvas.width + 'px';
    dragOverlay.style.height = canvas.height + 'px';
    // Only draw if grid is initialized and non-empty
    if (gameState.grid && gameState.grid.length && gameState.grid[0] && gameState.grid[0].length) {
        drawBoard();
    }
}

window.addEventListener('resize', resizeGameBoard);
window.addEventListener('orientationchange', resizeGameBoard);

// Initialize the game
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Get DOM elements
    canvas = document.getElementById('gameBoard');
    ctx = canvas.getContext('2d');
    dragOverlay = document.getElementById('dragOverlay');
    scoreDisplay = document.getElementById('score');
    movesDisplay = document.getElementById('moves');
    multiplierDisplay = document.getElementById('multiplier');
    matchFeedback = document.getElementById('matchFeedback');
    particleContainer = document.getElementById('particleContainer');
    
    settingsToggle = document.getElementById('settingsToggle');
    settingsPanel = document.getElementById('settingsPanel');
    settingsContent = document.getElementById('settingsContent');
    
    // Add event listeners
    settingsToggle.addEventListener('click', toggleSettings);
    document.getElementById('resetGame').addEventListener('click', resetGame);
    
    // Set up settings change listeners
    document.getElementById('matchLength').addEventListener('change', updateSettings);
    document.getElementById('gearPercentage').addEventListener('change', updateSettings);
    document.getElementById('baseScore').addEventListener('change', updateSettings);
    document.getElementById('animationSpeed').addEventListener('change', updateSettings);
    document.getElementById('gridSize').addEventListener('change', updateSettings);
    
    // Set up drag and touch events
    setupDragEvents();
    
    // Apply initial config from application data
    applyInitialConfig();
    
    // Initialize the game board
    resetGame();
    
    // Start the game loop
    requestAnimationFrame(gameLoop);

    // On DOMContentLoaded, set isMobileDevice and resize
    isMobileDevice = isMobile();
    resizeGameBoard();
    // Listen for effect toggles
    ['effectShake','effectParticles','effectFlash','showDragLine'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', applyEffectsSettings);
    });
    applyEffectsSettings();
}

function applyInitialConfig() {
    // Apply config from data
    const initialConfig = {
        gridSize: 8,
        colors: ["red", "blue", "green", "yellow", "purple", "orange"],
        gearPercentage: 20,
        matchLength: 3,
        baseScore: 100,
        animationSpeed: "normal"
    };
    
    const initialScoring = {
        baseMultiplier: 1.0,
        gearMultiplierBonus: 0.5
    };
    
    const initialControls = {
        dragThreshold: 10,
        snapSpeed: 300
    };
    
    Object.assign(config, initialConfig);
    gameState.baseMultiplier = initialScoring.baseMultiplier;
    gameState.gearMultiplierBonus = initialScoring.gearMultiplierBonus;
    config.dragThreshold = initialControls.dragThreshold;
    config.snapSpeed = initialControls.snapSpeed;
    
    // Update UI to match initial settings
    document.getElementById('matchLength').value = config.matchLength.toString();
    document.getElementById('gearPercentage').value = config.gearPercentage.toString();
    document.getElementById('baseScore').value = config.baseScore.toString();
    document.getElementById('animationSpeed').value = config.animationSpeed;
    document.getElementById('gridSize').value = config.gridSize.toString();
    
    document.body.classList.add(`anim-speed-${config.animationSpeed}`);
}

function setupDragEvents() {
    // Mouse events
    canvas.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', endDrag);
    
    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    startDrag(mouseEvent);
}

function handleTouchMove(e) {
    if (!gameState.dragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    dragMove(mouseEvent);
}

function handleTouchEnd(e) {
    e.preventDefault();
    endDrag();
}

// Utility: Log errors for debugging
function logError(msg, err) {
    console.error('[CogMaster Error]', msg, err || '');
}

// Utility: Trigger juicy effects (placeholder, expand as needed)
function triggerJuicyEffect(type, opts = {}) {
    const board = document.querySelector('.game-board-container');
    switch(type) {
        case 'slide':
            if (config.effects.shake && board) {
                board.classList.remove('shake');
                // Force reflow to restart animation
                void board.offsetWidth;
                board.classList.add('shake');
                setTimeout(() => board.classList.remove('shake'), 400);
            }
            // TODO: Add slide sound if desired
            break;
        case 'match':
            if (config.effects.flash) {
                // Flash handled in animateMatches
            }
            if (config.effects.particles) {
                // Particles handled in createMatchParticles
            }
            // TODO: Add match sound if desired
            break;
        case 'invalid':
            if (config.effects.shake && board) {
                board.classList.remove('shake');
                void board.offsetWidth;
                board.classList.add('shake');
                setTimeout(() => board.classList.remove('shake'), 400);
            }
            // TODO: Add error sound if desired
            break;
    }
}

// --- GEAR SPIN CONSTANTS ---
const GEAR_SPIN_SPEED = 4; // rotations per second during match spin
const GEAR_SPIN_DURATION = 2000; // ms, how long gears spin after match

// --- PATCH: Only allow drag if board is idle (not animating, not spinning gears) ---
function isBoardIdle() {
    if (gameState.animating || gameState.dragging) return false;
    // Check if any gear is spinning
    for (let y = 0; y < config.gridSize; y++) {
        for (let x = 0; x < config.gridSize; x++) {
            const piece = gameState.grid[y][x];
            if (piece && piece.isGear && piece.spinning) return false;
        }
    }
    return true;
}

function startDrag(e) {
    if (!isBoardIdle()) return;
    if (!gameState.grid || !Array.isArray(gameState.grid) || gameState.grid.length === 0) return;
    try {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const gridX = Math.floor(x / config.cellSize);
        const gridY = Math.floor(y / config.cellSize);
        if (gridX >= 0 && gridX < config.gridSize && gridY >= 0 && gridY < config.gridSize) {
            gameState.dragging = true;
            gameState.dragStartPos = { x, y };
            gameState.dragCurrentPos = { x, y };
            gameState.dragType = null; // Not locked yet
            gameState.dragIndex = -1;
            gameState.dragOffset = 0;
            gameState.dragGridX = gridX;
            gameState.dragGridY = gridY;
            // Show both row and column highlight
            dragOverlay.innerHTML = '';
            const rowHighlight = document.createElement('div');
            rowHighlight.className = 'drag-indicator highlight-row';
            rowHighlight.style.top = `${gridY * config.cellSize}px`;
            rowHighlight.style.height = `${config.cellSize}px`;
            rowHighlight.style.width = '100%';
            dragOverlay.appendChild(rowHighlight);
            const colHighlight = document.createElement('div');
            colHighlight.className = 'drag-indicator highlight-col';
            colHighlight.style.left = `${gridX * config.cellSize}px`;
            colHighlight.style.width = `${config.cellSize}px`;
            colHighlight.style.height = '100%';
            dragOverlay.appendChild(colHighlight);
        }
    } catch (err) {
        logError('startDrag failed', err);
        gameState.dragging = false;
    }
}

function dragMove(e) {
    if (!gameState.dragging) return;
    try {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        gameState.dragCurrentPos = { x, y };
        const dx = x - gameState.dragStartPos.x;
        const dy = y - gameState.dragStartPos.y;
        // Lock direction after threshold
        if (!gameState.dragType) {
            if (Math.abs(dx) > config.dragThreshold || Math.abs(dy) > config.dragThreshold) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    gameState.dragType = 'row';
                    gameState.dragIndex = gameState.dragGridY;
                    // Only keep row highlight
                    dragOverlay.innerHTML = '';
                    const rowHighlight = document.createElement('div');
                    rowHighlight.className = 'drag-indicator highlight-row';
                    rowHighlight.style.top = `${gameState.dragGridY * config.cellSize}px`;
                    rowHighlight.style.height = `${config.cellSize}px`;
                    rowHighlight.style.width = '100%';
                    dragOverlay.appendChild(rowHighlight);
                } else {
                    gameState.dragType = 'column';
                    gameState.dragIndex = gameState.dragGridX;
                    // Only keep column highlight
                    dragOverlay.innerHTML = '';
                    const colHighlight = document.createElement('div');
                    colHighlight.className = 'drag-indicator highlight-col';
                    colHighlight.style.left = `${gameState.dragGridX * config.cellSize}px`;
                    colHighlight.style.width = `${config.cellSize}px`;
                    colHighlight.style.height = '100%';
                    dragOverlay.appendChild(colHighlight);
                }
            } else {
                // Not enough movement to lock direction
                return;
            }
        }
        // Always show the row/column sliding in real time
        if (gameState.dragType === 'row') {
            gameState.dragOffset = x - gameState.dragStartPos.x;
        } else if (gameState.dragType === 'column') {
            gameState.dragOffset = y - gameState.dragStartPos.y;
        }
        // Draw highlight and drag line only after direction lock
        dragOverlay.innerHTML = '';
        if (gameState.dragType === 'row') {
            const rowHighlight = document.createElement('div');
            rowHighlight.className = 'drag-indicator highlight-row';
            rowHighlight.style.top = `${gameState.dragGridY * config.cellSize}px`;
            rowHighlight.style.height = `${config.cellSize}px`;
            rowHighlight.style.width = '100%';
            dragOverlay.appendChild(rowHighlight);
            if (config.effects.showDragLine) {
                drawDragLine('row', gameState.dragGridY, gameState.dragStartPos.x, x);
            }
        } else if (gameState.dragType === 'column') {
            const colHighlight = document.createElement('div');
            colHighlight.className = 'drag-indicator highlight-col';
            colHighlight.style.left = `${gameState.dragGridX * config.cellSize}px`;
            colHighlight.style.width = `${config.cellSize}px`;
            colHighlight.style.height = '100%';
            dragOverlay.appendChild(colHighlight);
            if (config.effects.showDragLine) {
                drawDragLine('column', gameState.dragGridX, gameState.dragStartPos.y, y);
            }
        }
        // Visually move the row/col with pointer
        if (gameState.dragType) {
            drawBoard(gameState.dragType, gameState.dragIndex, gameState.dragOffset);
        }
    } catch (err) {
        logError('dragMove failed', err);
        gameState.dragging = false;
    }
}

function endDrag() {
    if (!gameState.dragging) return;
    try {
        dragOverlay.innerHTML = '';
        if (!gameState.dragType || gameState.dragIndex < 0) {
            // Not enough movement to trigger a move
            gameState.dragging = false;
            gameState.dragOffset = 0;
            gameState.dragType = null;
            gameState.dragIndex = -1;
            drawBoard();
            return;
        }
        // Snap to nearest cell (move by integer number of cells, wrap as needed)
        let cellsToMove = Math.round((gameState.dragType === 'row' ? (gameState.dragCurrentPos.x - gameState.dragStartPos.x) : (gameState.dragCurrentPos.y - gameState.dragStartPos.y)) / config.cellSize);
        // Clamp to grid size
        if (cellsToMove > config.gridSize) cellsToMove = cellsToMove % config.gridSize;
        if (cellsToMove < -config.gridSize) cellsToMove = cellsToMove % config.gridSize;
        if (gameState.dragType && gameState.dragIndex >= 0 && cellsToMove !== 0) {
            moveRowOrColumn(gameState.dragType, gameState.dragIndex, cellsToMove);
            gameState.moves++;
            movesDisplay.textContent = gameState.moves;
            setTimeout(() => {
                checkForMatches();
            }, config.snapSpeed);
        } else {
            // Not enough drag: snap back
            drawBoard();
        }
    } catch (err) {
        logError('endDrag failed', err);
    } finally {
        gameState.dragging = false;
        gameState.dragOffset = 0;
        gameState.dragType = null;
        gameState.dragIndex = -1;
    }
}

function moveRowOrColumn(type, index, amount) {
    try {
        gameState.animating = true;
        if (type === 'row' && index >= 0 && index < config.gridSize) {
            const newRow = [];
            for (let x = 0; x < config.gridSize; x++) {
                const newX = (x + amount + config.gridSize) % config.gridSize;
                newRow[newX] = gameState.grid[index][x];
            }
            gameState.grid[index] = newRow;
        } else if (type === 'column' && index >= 0 && index < config.gridSize) {
            const newCol = [];
            for (let y = 0; y < config.gridSize; y++) {
                const newY = (y + amount + config.gridSize) % config.gridSize;
                newCol[newY] = gameState.grid[y][index];
            }
            for (let y = 0; y < config.gridSize; y++) {
                gameState.grid[y][index] = newCol[y];
            }
        } else {
            logError('Invalid moveRowOrColumn params', {type, index, amount});
            gameState.animating = false;
            return;
        }
        animateMove(type, index, amount);
    } catch (err) {
        logError('moveRowOrColumn failed', err);
        gameState.animating = false;
    }
}

function animateMove(type, index, amount) {
    const startTime = performance.now();
    const duration = config.snapSpeed;
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easeOutBack for a slight bounce effect
        const easedProgress = easeOutBack(progress);
        
        // Calculate current offset
        const pixelAmount = amount * config.cellSize;
        const currentOffset = pixelAmount * (1 - easedProgress);
        
        // Clear canvas and redraw with offset
        drawBoard(type, index, currentOffset);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Animation complete
            drawBoard();
            gameState.animating = false;
            updateGearConnections();
        }
    }
    
    requestAnimationFrame(animate);
}

function easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function checkForMatches() {
    const matchedCells = findMatches();
    
    if (matchedCells.length > 0) {
        // Clear matches and calculate score
        processMatches(matchedCells);
        
        // Wait for animations, then refill board and check for cascading matches
        setTimeout(() => {
            refillBoard();
            setTimeout(() => {
                checkForMatches();
            }, 500);
        }, 500);
    } else {
        // No more matches, end turn
        gameState.animating = false;
    }
}

function findMatches() {
    const matches = [];
    const visited = Array(config.gridSize).fill(0).map(() => Array(config.gridSize).fill(false));
    
    // Check horizontal matches
    for (let y = 0; y < config.gridSize; y++) {
        for (let x = 0; x < config.gridSize - (config.matchLength - 1); x++) {
            const color = gameState.grid[y][x].color;
            let matchLength = 1;
            
            for (let i = 1; i < config.gridSize - x; i++) {
                if (gameState.grid[y][x + i].color === color) {
                    matchLength++;
                } else {
                    break;
                }
            }
            
            if (matchLength >= config.matchLength) {
                const match = [];
                for (let i = 0; i < matchLength; i++) {
                    if (!visited[y][x + i]) {
                        match.push({ x: x + i, y, piece: gameState.grid[y][x + i] });
                        visited[y][x + i] = true;
                    }
                }
                matches.push(match);
            }
        }
    }
    
    // Check vertical matches
    for (let x = 0; x < config.gridSize; x++) {
        for (let y = 0; y < config.gridSize - (config.matchLength - 1); y++) {
            const color = gameState.grid[y][x].color;
            let matchLength = 1;
            
            for (let i = 1; i < config.gridSize - y; i++) {
                if (gameState.grid[y + i][x].color === color) {
                    matchLength++;
                } else {
                    break;
                }
            }
            
            if (matchLength >= config.matchLength) {
                const match = [];
                for (let i = 0; i < matchLength; i++) {
                    if (!visited[y + i][x]) {
                        match.push({ x, y: y + i, piece: gameState.grid[y + i][x] });
                        visited[y + i][x] = true;
                    }
                }
                matches.push(match);
            }
        }
    }
    
    // Flatten matches into a single array
    return matches.flat();
}

function processMatches(matches) {
    // Count gears in matches for multiplier
    let gearCount = 0;
    matches.forEach(match => {
        if (match.piece.isGear) {
            gearCount++;
            // Trigger gear spinning effect
            triggerGearSpin(match.x, match.y);
        }
    });
    // Only trigger screen shake for large combos
    if (matches.length >= 3) {
        triggerJuicyEffect('slide');
    }
    // Calculate multiplier
    gameState.multiplier = gameState.baseMultiplier + (gearCount * gameState.gearMultiplierBonus);
    multiplierDisplay.textContent = gameState.multiplier.toFixed(1) + 'x';
    multiplierDisplay.classList.add('score-pop');
    setTimeout(() => multiplierDisplay.classList.remove('score-pop'), 500);
    // Calculate score
    const matchScore = Math.round(config.baseScore * matches.length * gameState.multiplier);
    gameState.score += matchScore;
    scoreDisplay.textContent = gameState.score;
    scoreDisplay.classList.add('score-pop');
    setTimeout(() => scoreDisplay.classList.remove('score-pop'), 500);
    // Show match feedback
    showMatchFeedback(matches.length, matchScore, gearCount);
    // Create particles for matches
    createMatchParticles(matches);
    // Mark matched cells as empty
    matches.forEach(match => {
        gameState.grid[match.y][match.x] = null;
    });
    // Show match animation
    animateMatches(matches);
}

// --- PATCH: Robust gear connection/spin logic ---
function updateGearConnections() {
    try {
        // Clear existing connections
        gameState.gearConnections = [];
        gameState.spinning = [];
        const visited = Array(config.gridSize).fill(0).map(() => Array(config.gridSize).fill(false));
        // For each unvisited gear, find its group
        for (let y = 0; y < config.gridSize; y++) {
            for (let x = 0; x < config.gridSize; x++) {
                if (visited[y][x]) continue;
                const piece = gameState.grid[y][x];
                if (piece && piece.isGear) {
                    // Always assign checkerboard direction by position
                    piece.direction = (x + y) % 2 === 0 ? 'clockwise' : 'counterclockwise';
                    // BFS to find all connected gears in this group
                    const group = [];
                    const queue = [{x, y}];
                    while (queue.length > 0) {
                        const {x: cx, y: cy} = queue.shift();
                        if (visited[cy][cx]) continue;
                        visited[cy][cx] = true;
                        const cp = gameState.grid[cy][cx];
                        if (!cp || !cp.isGear) continue;
                        // Always assign checkerboard direction by position
                        cp.direction = (cx + cy) % 2 === 0 ? 'clockwise' : 'counterclockwise';
                        group.push({x: cx, y: cy});
                        // Check orthogonal neighbors
                        const dirs = [
                            {dx: 1, dy: 0},
                            {dx: -1, dy: 0},
                            {dx: 0, dy: 1},
                            {dx: 0, dy: -1}
                        ];
                        for (const dir of dirs) {
                            const nx = cx + dir.dx;
                            const ny = cy + dir.dy;
                            if (nx >= 0 && nx < config.gridSize && ny >= 0 && ny < config.gridSize) {
                                const np = gameState.grid[ny][nx];
                                if (np && np.isGear && !visited[ny][nx]) {
                                    queue.push({x: nx, y: ny});
                                }
                            }
                        }
                    }
                    // If group size > 1, mark all as rotating and add all visual connections
                    if (group.length > 1) {
                        // Mark all as rotating and add to spinning
                        for (const g of group) {
                            const gp = gameState.grid[g.y][g.x];
                            gp.rotating = true;
                            gameState.spinning.push({x: g.x, y: g.y});
                        }
                        // Add all visual connections for this group
                        const groupSet = new Set(group.map(g => `${g.x},${g.y}`));
                        for (const g of group) {
                            const {x: gx, y: gy} = g;
                            const dirs = [
                                {dx: 1, dy: 0, dir: 'horizontal'},
                                {dx: 0, dy: 1, dir: 'vertical'}
                            ];
                            for (const d of dirs) {
                                const nx = gx + d.dx;
                                const ny = gy + d.dy;
                                if (nx >= 0 && nx < config.gridSize && ny >= 0 && ny < config.gridSize) {
                                    if (groupSet.has(`${nx},${ny}`)) {
                                        // Avoid duplicate lines (only add if gx,gy < nx,ny)
                                        if ((d.dir === 'horizontal' && gx < nx) || (d.dir === 'vertical' && gy < ny)) {
                                            gameState.gearConnections.push({
                                                x1: gx, y1: gy, x2: nx, y2: ny, direction: d.dir
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        piece.rotating = false;
                    }
                }
            }
        }
        // Fallback: log if any gears in a group are not marked as rotating
        for (const conn of gameState.gearConnections) {
            const p1 = gameState.grid[conn.y1][conn.x1];
            const p2 = gameState.grid[conn.y2][conn.x2];
            if (p1 && p1.isGear && !p1.rotating) logError('updateGearConnections: Gear not marked rotating', {x: conn.x1, y: conn.y1});
            if (p2 && p2.isGear && !p2.rotating) logError('updateGearConnections: Gear not marked rotating', {x: conn.x2, y: conn.y2});
        }
        // Draw the connections
        drawBoard();
    } catch (err) {
        logError('updateGearConnections failed', err);
    }
}

// Find all gears in the same connected group as (startX, startY) using gearConnections
function findConnectedGearsByLines(startX, startY) {
    const visited = new Set();
    const queue = [`${startX},${startY}`];
    const result = [];
    while (queue.length > 0) {
        const key = queue.shift();
        if (visited.has(key)) continue;
        visited.add(key);
        const [x, y] = key.split(',').map(Number);
        const piece = gameState.grid[y] && gameState.grid[y][x];
        if (!piece || !piece.isGear) continue;
        result.push({ x, y });
        // Find all directly connected gears from gearConnections
        for (const conn of gameState.gearConnections) {
            let nx = null, ny = null;
            if (conn.x1 === x && conn.y1 === y) {
                nx = conn.x2; ny = conn.y2;
            } else if (conn.x2 === x && conn.y2 === y) {
                nx = conn.x1; ny = conn.y1;
            }
            if (nx !== null && ny !== null) {
                const nkey = `${nx},${ny}`;
                if (!visited.has(nkey)) queue.push(nkey);
            }
        }
    }
    return result;
}

function triggerGearSpin(x, y) {
    try {
        const connectedGears = findConnectedGearsByLines(x, y);
        connectedGears.forEach(gearPos => {
            const piece = gameState.grid[gearPos.y][gearPos.x];
            if (piece && piece.isGear) {
                piece.spinning = true;
                piece.spinStartTime = performance.now();
                piece.spinDuration = GEAR_SPIN_DURATION;
            } else {
                logError('triggerGearSpin: Gear not found or not a gear', gearPos);
            }
        });
        // Fallback: check if any visually connected gears are not spinning
        connectedGears.forEach(gearPos => {
            const piece = gameState.grid[gearPos.y][gearPos.x];
            if (piece && piece.isGear && !piece.spinning) {
                logError('triggerGearSpin: Gear did not spin, retrying', gearPos);
                piece.spinning = true;
                piece.spinStartTime = performance.now();
                piece.spinDuration = GEAR_SPIN_DURATION;
            }
        });
    } catch (err) {
        logError('triggerGearSpin failed', err);
    }
}

function showMatchFeedback(matchCount, score, gearCount) {
    matchFeedback.textContent = `+${score} (${matchCount} match${matchCount > 1 ? 'es' : ''}${gearCount ? ', gears!' : ''})`;
    matchFeedback.classList.add('active');
    triggerJuicyEffect('match', {matchCount, score, gearCount});
    setTimeout(() => {
        matchFeedback.classList.remove('active');
    }, 1200);
}

function createMatchParticles(matches) {
    matches.forEach(match => {
        if (match.piece.isGear) {
            // Create more particles for gears
            for (let i = 0; i < 10; i++) {
                createParticle(match.x, match.y, match.piece.color);
            }
        } else {
            // Fewer particles for regular pieces
            for (let i = 0; i < 5; i++) {
                createParticle(match.x, match.y, match.piece.color);
            }
        }
    });
}

function createParticle(gridX, gridY, color) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    
    // Get position in screen coordinates
    const x = gridX * config.cellSize + config.cellSize / 2;
    const y = gridY * config.cellSize + config.cellSize / 2;
    
    // Get canvas position
    const rect = canvas.getBoundingClientRect();
    const screenX = rect.left + x;
    const screenY = rect.top + y;
    
    // Random size between 3 and 8 pixels
    const size = Math.random() * 5 + 3;
    
    // Set particle properties
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.backgroundColor = colorMap[color];
    particle.style.left = `${screenX}px`;
    particle.style.top = `${screenY}px`;
    
    // Add to container
    particleContainer.appendChild(particle);
    
    // Animate particle
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 100 + 50;
    const startTime = performance.now();
    const duration = Math.random() * 1000 + 500;
    
    function updateParticle() {
        const elapsed = performance.now() - startTime;
        const progress = elapsed / duration;
        
        if (progress >= 1) {
            particle.remove();
            return;
        }
        
        const distance = speed * progress;
        const newX = screenX + Math.cos(angle) * distance;
        const newY = screenY + Math.sin(angle) * distance - (progress * progress * 200); // Add gravity
        
        particle.style.left = `${newX}px`;
        particle.style.top = `${newY}px`;
        particle.style.opacity = 1 - progress;
        
        requestAnimationFrame(updateParticle);
    }
    
    requestAnimationFrame(updateParticle);
}

function animateMatches(matches) {
    matches.forEach(match => {
        const x = match.x * config.cellSize;
        const y = match.y * config.cellSize;
        
        // Flash effect
        ctx.fillStyle = 'white';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x, y, config.cellSize, config.cellSize);
        ctx.globalAlpha = 1.0;
    });
}

function refillBoard() {
    // Move pieces down to fill empty spaces
    let hasMoved = false;
    
    for (let x = 0; x < config.gridSize; x++) {
        // Start from the bottom, move up
        for (let y = config.gridSize - 1; y > 0; y--) {
            if (gameState.grid[y][x] === null) {
                // Find the first non-null piece above
                for (let above = y - 1; above >= 0; above--) {
                    if (gameState.grid[above][x] !== null) {
                        // Move piece down
                        gameState.grid[y][x] = gameState.grid[above][x];
                        gameState.grid[above][x] = null;
                        hasMoved = true;
                        break;
                    }
                }
            }
        }
        
        // Fill empty spaces at the top with new pieces
        for (let y = 0; y < config.gridSize; y++) {
            if (gameState.grid[y][x] === null) {
                gameState.grid[y][x] = createPiece();
                hasMoved = true;
            }
        }
    }
    
    if (hasMoved) {
        // Update gear connections after refilling
        updateGearConnections();
    }
}

function createPiece() {
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    const isGear = Math.random() * 100 < config.gearPercentage;
    
    return {
        color,
        isGear,
        rotating: false,
        spinning: false,
        direction: null,
        spinStartTime: 0,
        spinDuration: 0
    };
}

function drawBoard(offsetType, offsetIndex, offset) {
    // Guard: only draw if grid is initialized and non-empty
    if (!gameState.grid || !gameState.grid.length || !gameState.grid[0] || !gameState.grid[0].length) return;
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw background pattern
    drawBackgroundPattern();
    // Draw pieces
    for (let y = 0; y < config.gridSize; y++) {
        for (let x = 0; x < config.gridSize; x++) {
            const piece = gameState.grid[y][x];
            if (!piece) continue;
            let drawX = x * config.cellSize;
            let drawY = y * config.cellSize;
            // --- CORRECT SLIDING DIRECTION PATCH ---
            if (offsetType === 'row' && y === offsetIndex && typeof offset === 'number') {
                // For the dragged row, wrap each piece smoothly in the direction of the drag
                let rel = x;
                let floatOffset = offset / config.cellSize;
                let wrapped = ((rel - floatOffset) % config.gridSize + config.gridSize) % config.gridSize;
                drawX = wrapped * config.cellSize;
            } else if (offsetType === 'column' && x === offsetIndex && typeof offset === 'number') {
                // For the dragged column, wrap each piece smoothly in the direction of the drag
                let rel = y;
                let floatOffset = offset / config.cellSize;
                let wrapped = ((rel - floatOffset) % config.gridSize + config.gridSize) % config.gridSize;
                drawY = wrapped * config.cellSize;
            }
            drawPiece(piece, drawX, drawY);
        }
    }
    // Draw gear connections
    drawGearConnections();
}

function drawBackgroundPattern() {
    // Draw checkerboard pattern for gear rotation direction indicators
    ctx.globalAlpha = 0.05;
    for (let y = 0; y < config.gridSize; y++) {
        for (let x = 0; x < config.gridSize; x++) {
            if ((x + y) % 2 === 0) {
                ctx.fillStyle = '#3498db'; // Clockwise cells
            } else {
                ctx.fillStyle = '#e74c3c'; // Counter-clockwise cells
            }
            ctx.fillRect(x * config.cellSize, y * config.cellSize, config.cellSize, config.cellSize);
        }
    }
    ctx.globalAlpha = 1.0;
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= config.gridSize; i++) {
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(i * config.cellSize, 0);
        ctx.lineTo(i * config.cellSize, config.gridSize * config.cellSize);
        ctx.stroke();
        
        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(0, i * config.cellSize);
        ctx.lineTo(config.gridSize * config.cellSize, i * config.cellSize);
        ctx.stroke();
    }
}

function drawPiece(piece, x, y) {
    const radius = config.cellSize * 0.4;
    const centerX = x + config.cellSize / 2;
    const centerY = y + config.cellSize / 2;
    ctx.fillStyle = colorMap[piece.color];
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    if (piece.isGear) {
        const teethRadius = radius * 1.2;
        const teethCount = 12;
        const teethWidth = Math.PI / 12;
        ctx.fillStyle = colorMap[piece.color];
        let rotationOffset = 0;
        // Only animate gears if board is idle
        if (!gameState.animating && !gameState.dragging) {
            // Check if gear is spinning from match
            if (piece.spinning && piece.spinStartTime) {
                const elapsed = performance.now() - piece.spinStartTime;
                if (elapsed < piece.spinDuration) {
                    const spinProgress = elapsed / piece.spinDuration;
                    rotationOffset = spinProgress * GEAR_SPIN_SPEED * Math.PI * 2;
                    if (piece.direction === 'counterclockwise') {
                        rotationOffset = -rotationOffset;
                    }
                } else {
                    piece.spinning = false;
                }
            } else if (piece.rotating) {
                const time = performance.now() / 1000;
                const rotationSpeed = config.animationSpeed === 'slow' ? 0.3 : 
                                     config.animationSpeed === 'fast' ? 1.5 : 0.8;
                rotationOffset = (piece.direction === 'clockwise' ? 1 : -1) * time * rotationSpeed;
            }
        }
        // --- Mesh gears visually: offset every other gear by 15 degrees ---
        if ((x / config.cellSize + y / config.cellSize) % 2 === 1 || (x + y) % 2 === 1) {
            rotationOffset += Math.PI / 12; // 15 degrees
        }
        for (let i = 0; i < teethCount; i++) {
            const angle = (i / teethCount) * Math.PI * 2;
            const innerRadius = radius * 0.9;
            const adjustedAngle = angle + rotationOffset;
            ctx.beginPath();
            ctx.moveTo(
                centerX + innerRadius * Math.cos(adjustedAngle - teethWidth/2),
                centerY + innerRadius * Math.sin(adjustedAngle - teethWidth/2)
            );
            ctx.lineTo(
                centerX + teethRadius * Math.cos(adjustedAngle - teethWidth/3),
                centerY + teethRadius * Math.sin(adjustedAngle - teethWidth/3)
            );
            ctx.lineTo(
                centerX + teethRadius * Math.cos(adjustedAngle + teethWidth/3),
                centerY + teethRadius * Math.sin(adjustedAngle + teethWidth/3)
            );
            ctx.lineTo(
                centerX + innerRadius * Math.cos(adjustedAngle + teethWidth/2),
                centerY + innerRadius * Math.sin(adjustedAngle + teethWidth/2)
            );
            ctx.closePath();
            ctx.fill();
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2);
        ctx.stroke();
    } else {
        // Draw regular piece (non-gear)
        const gradient = ctx.createRadialGradient(
            centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.1,
            centerX, centerY, radius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'overlay';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }
}

function drawGearConnections() {
    // Draw lines between connected gears
    const time = performance.now() / 1000;
    for (const connection of gameState.gearConnections) {
        const x1 = connection.x1 * config.cellSize + config.cellSize / 2;
        const y1 = connection.y1 * config.cellSize + config.cellSize / 2;
        const x2 = connection.x2 * config.cellSize + config.cellSize / 2;
        const y2 = connection.y2 * config.cellSize + config.cellSize / 2;
        // Sparkly animated gradient
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        const sparkle = 0.5 + 0.5 * Math.sin(time * 4 + x1 + y1 + x2 + y2);
        grad.addColorStop(0, `rgba(255,255,255,${0.7 + 0.3 * sparkle})`);
        grad.addColorStop(0.5, `rgba(33,128,141,${0.5 + 0.5 * sparkle})`);
        grad.addColorStop(1, `rgba(255,255,255,${0.7 + 0.3 * (1-sparkle)})`);
        ctx.save();
        ctx.strokeStyle = grad;
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 8 + 8 * sparkle;
        ctx.lineWidth = 4 + 2 * sparkle;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }
    // Animate sparkles
    if (gameState.animating || gameState.dragging) {
        requestAnimationFrame(() => drawBoard());
    }
}

function gameLoop(timestamp) {
    // Update and render game elements
    if (!gameState.animating && !gameState.dragging) {
        drawBoard();
    }
    
    requestAnimationFrame(gameLoop);
}

function resetGame() {
    // Reset game state
    gameState.grid = [];
    gameState.score = 0;
    gameState.moves = 0;
    gameState.multiplier = 1.0;
    gameState.dragging = false;
    gameState.animating = false;
    gameState.gearConnections = [];
    gameState.spinning = [];
    
    // Update display
    scoreDisplay.textContent = '0';
    movesDisplay.textContent = '0';
    multiplierDisplay.textContent = '1.0x';
    
    // Responsive: recalculate cell size and canvas
    resizeGameBoard();
    
    // Initialize grid with random pieces
    for (let y = 0; y < config.gridSize; y++) {
        gameState.grid[y] = [];
        for (let x = 0; x < config.gridSize; x++) {
            gameState.grid[y][x] = createPiece();
        }
    }
    
    // Make sure we don't start with matches
    let attempts = 0;
    while (findMatches().length > 0 && attempts < 100) {
        // Re-randomize the board
        for (let y = 0; y < config.gridSize; y++) {
            for (let x = 0; x < config.gridSize; x++) {
                gameState.grid[y][x] = createPiece();
            }
        }
        attempts++;
    }
    
    // Initialize gear connections
    updateGearConnections();
    // Draw the board now that everything is ready
    drawBoard();
}

function toggleSettings() {
    settingsPanel.classList.toggle('settings-collapsed');
    
    // Also update the gear icon rotation
    if (settingsPanel.classList.contains('settings-collapsed')) {
        settingsToggle.style.transform = 'rotate(180deg)';
    } else {
        settingsToggle.style.transform = 'rotate(0deg)';
    }
}

function updateSettings(e) {
    const settingId = e.target.id;
    const value = e.target.value;
    
    switch (settingId) {
        case 'matchLength':
            config.matchLength = parseInt(value);
            break;
        case 'gearPercentage':
            config.gearPercentage = parseInt(value);
            // Regenerate some pieces to match new percentage
            regenerateGears();
            break;
        case 'baseScore':
            config.baseScore = parseInt(value);
            break;
        case 'animationSpeed':
            config.animationSpeed = value;
            document.body.classList.remove('anim-speed-slow', 'anim-speed-normal', 'anim-speed-fast');
            document.body.classList.add(`anim-speed-${value}`);
            break;
        case 'gridSize':
            config.gridSize = parseInt(value);
            resetGame();
            break;
    }
    
    console.log(`Updated ${settingId} to ${value}`);
}

function regenerateGears() {
    // Update existing pieces to match new gear percentage
    let gearCount = 0;
    const totalPieces = config.gridSize * config.gridSize;
    const targetGears = Math.floor(totalPieces * config.gearPercentage / 100);
    
    // First, count existing gears
    for (let y = 0; y < config.gridSize; y++) {
        for (let x = 0; x < config.gridSize; x++) {
            if (gameState.grid[y][x].isGear) {
                gearCount++;
            }
        }
    }
    
    // If we need more gears
    while (gearCount < targetGears) {
        const x = Math.floor(Math.random() * config.gridSize);
        const y = Math.floor(Math.random() * config.gridSize);
        
        if (!gameState.grid[y][x].isGear) {
            gameState.grid[y][x].isGear = true;
            gearCount++;
        }
    }
    
    // If we have too many gears
    while (gearCount > targetGears) {
        const x = Math.floor(Math.random() * config.gridSize);
        const y = Math.floor(Math.random() * config.gridSize);
        
        if (gameState.grid[y][x].isGear) {
            gameState.grid[y][x].isGear = false;
            gameState.grid[y][x].rotating = false;
            gameState.grid[y][x].spinning = false;
            gearCount--;
        }
    }
    
    // Update gear connections
    updateGearConnections();
}

function applyEffectsSettings() {
    config.effects.shake = document.getElementById('effectShake').checked;
    config.effects.particles = document.getElementById('effectParticles').checked;
    config.effects.flash = document.getElementById('effectFlash').checked;
    config.effects.showDragLine = document.getElementById('showDragLine').checked;
}

function drawDragLine(type, fixedIndex, start, current) {
    try {
        const line = document.createElement('div');
        line.className = 'drag-line';
        let x, y, width, height, angle;
        if (type === 'row') {
            // Horizontal line at the row's y, from start cell to cursor x
            y = fixedIndex * config.cellSize + config.cellSize / 2 - 2;
            x = Math.min(start, current);
            width = Math.abs(current - start);
            height = 4;
            angle = 0;
        } else if (type === 'column') {
            // Vertical line at the column's x, from start cell to cursor y
            x = fixedIndex * config.cellSize + config.cellSize / 2 - 2;
            y = Math.min(start, current);
            width = 4;
            height = Math.abs(current - start);
            angle = 0;
        }
        line.style.position = 'absolute';
        line.style.left = `${x}px`;
        line.style.top = `${y}px`;
        line.style.width = `${width || 4}px`;
        line.style.height = `${height || 4}px`;
        line.style.background = 'repeating-linear-gradient(90deg, #21a0b1, #21a0b1 8px, #fff 8px, #fff 16px)';
        line.style.borderRadius = '2px';
        line.style.pointerEvents = 'none';
        line.style.zIndex = 30;
        line.style.opacity = '0.85';
        line.style.transition = 'opacity 0.2s';
        if (type === 'column') {
            line.style.background = 'repeating-linear-gradient(180deg, #e74c3c, #e74c3c 8px, #fff 8px, #fff 16px)';
        }
        dragOverlay.appendChild(line);
    } catch (err) {
        logError('drawDragLine failed', err);
    }
}