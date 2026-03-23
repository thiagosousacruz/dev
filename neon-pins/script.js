// Levels Configuration
const levels = [
    { targetPins: 5,  speed: 0.02,  direction: 1,  startPins: 0 },
    { targetPins: 8,  speed: 0.025, direction: -1, startPins: 0 },
    { targetPins: 10, speed: 0.03,  direction: 1,  startPins: 2 },
    { targetPins: 12, speed: 0.035, direction: -1, startPins: 2 },
    { targetPins: 15, speed: 0.04,  direction: 1,  startPins: 4 },
    { targetPins: 15, speed: 0.02,  direction: 1,  startPins: 6 }, // slower but crowded
    { targetPins: 18, speed: 0.045, direction: -1, startPins: 4 },
    { targetPins: 20, speed: 0.05,  direction: 1,  startPins: 5 },
    { targetPins: 12, speed: 0.06,  direction: -1, startPins: 2 }, // very fast
    { targetPins: 22, speed: 0.03,  direction: 1,  startPins: 8 },
    { targetPins: 25, speed: 0.035, direction: -1, startPins: 5 },
    { targetPins: 15, speed: 0.07,  direction: 1,  startPins: 3 },
    { targetPins: 20, speed: 0.04,  direction: -1, startPins: 10 },
    { targetPins: 25, speed: 0.05,  direction: 1,  startPins: 8 },
    { targetPins: 30, speed: 0.055, direction: -1, startPins: 6 } // final level
];

// Game Objects and State
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let cw, ch;
let state = 'MENU'; // MENU, PLAYING, GAME_OVER, LEVEL_COMPLETE, BEAT_GAME
let currentLevel = 1;
let totalStars = parseInt(localStorage.getItem('neonPinsStars')) || 0;

// Update UI on load
document.getElementById('menu-level-display').innerText = Math.min(currentLevel, levels.length);
document.querySelector('#total-stars span').innerText = totalStars;

// Game Maths & Variables
let centerCircle = { x: 0, y: 0, radius: 40 };
let orbitRadius = 120;
let rotationAngle = 0;
let pins = []; // { angle: number }
let flyingPin = null; // { x, y, speed }
let pinsLeft = 0;
let levelConfig = null;
let lastTime = 0;
let pinRadius = 8;
let animationId;
let gameSpeedMultiplier = 1;

// Colors
const colors = {
    bg: '#0d0d12',
    target: '#00f3ff',
    pin: '#ff00ea',
    line: '#fff',
    success: '#00ff66',
    error: '#ff3333'
};

// Handle window resizing to keep the canvas filling the screen and updating coordinates
function resize() {
    cw = window.innerWidth;
    ch = window.innerHeight;
    canvas.width = cw;
    canvas.height = ch;
    
    // Limit width strictly for mobile feel on desktop
    let gameWidth = Math.min(cw, 500);
    centerCircle.x = cw / 2;
    centerCircle.y = ch * 0.35; // Position the main circle a bit higher up
    
    // Scale radii based on screen size
    centerCircle.radius = Math.min(gameWidth * 0.1, 50);
    orbitRadius = Math.min(gameWidth * 0.35, 150);
    pinRadius = Math.min(gameWidth * 0.025, 12);
}

// Reset the game loop for a new level
function startLevel(lvl) {
    if (lvl > levels.length) {
        state = 'BEAT_GAME';
        showScreen('level-complete');
        document.querySelector('#level-complete h1').innerText = "VOCÊ ZEROU!";
        document.querySelector('#level-complete p').innerText = "Parabéns, você completou todos os níveis!";
        document.getElementById('next-level-btn').style.display = 'none';
        return;
    }

    currentLevel = lvl;
    levelConfig = levels[lvl - 1];
    pinsLeft = levelConfig.targetPins;
    rotationAngle = 0;
    pins = [];
    flyingPin = null;

    // Distribute starting pins evenly
    if (levelConfig.startPins > 0) {
        const angleStep = (Math.PI * 2) / levelConfig.startPins;
        for (let i = 0; i < levelConfig.startPins; i++) {
            pins.push({ angle: i * angleStep });
        }
    }

    state = 'PLAYING';
    updateHUD();
    hideAllScreens();
    
    if (animationId) cancelAnimationFrame(animationId);
    lastTime = performance.now();
    gameLoop(lastTime);
}

function updateHUD() {
    const hud = document.getElementById('hud');
    if (state === 'PLAYING') {
        hud.classList.remove('hidden');
        document.getElementById('level-hud').innerText = `Nível ${currentLevel}`;
        document.getElementById('pins-left-hud').innerText = `Pinos: ${pinsLeft}`;
    } else {
        hud.classList.add('hidden');
    }
}

// Draw a neon glowing circle
function drawNeonCircle(x, y, radius, color, glowAmount) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowBlur = glowAmount;
    ctx.shadowColor = color;
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0; // Reset
}

// Draw the connecting line from center to pin
function drawConnectingLine(x1, y1, x2, y2, color) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 5;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.closePath();
    ctx.shadowBlur = 0;
}

// The core rendering function
function draw() {
    ctx.clearRect(0, 0, cw, ch);
    
    // Draw attached pins
    pins.forEach(pin => {
        let currentPinAngle = (pin.angle + rotationAngle) % (Math.PI * 2);
        // Calculate pin position along the orbit
        let px = centerCircle.x + Math.cos(currentPinAngle) * orbitRadius;
        let py = centerCircle.y + Math.sin(currentPinAngle) * orbitRadius;
        
        drawConnectingLine(centerCircle.x, centerCircle.y, px, py, colors.line);
        drawNeonCircle(px, py, pinRadius, colors.pin, 15);
    });

    // Draw central target target
    let targetColor = colors.target;
    if (state === 'GAME_OVER') targetColor = colors.error;
    if (state === 'LEVEL_COMPLETE') targetColor = colors.success;
    drawNeonCircle(centerCircle.x, centerCircle.y, centerCircle.radius, targetColor, 30);
    
    // Draw text inside center circle
    ctx.fillStyle = '#111';
    ctx.font = `bold ${centerCircle.radius}px 'Orbitron'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pinsLeft, centerCircle.x, centerCircle.y + 2);

    // Draw flying pin
    if (flyingPin) {
        drawNeonCircle(flyingPin.x, flyingPin.y, pinRadius, colors.pin, 20);
        // Draw tail
        drawConnectingLine(flyingPin.x, flyingPin.y, flyingPin.x, flyingPin.y + 20, colors.pin);
    }
    
    // Draw pin at bottom ready to shoot
    if (!flyingPin && pinsLeft > 0 && state === 'PLAYING') {
        drawNeonCircle(cw / 2, ch * 0.85, pinRadius, colors.pin, 15);
    }
}

// Check for collision with existing pins
function checkCollision(hitAngle) {
    // We consider it a hit if the difference in angle is less than a threshold
    // threshold depends on the arc length of (pinRadius * 2) over orbitRadius
    const collisionThreshold = (pinRadius * 2.5) / orbitRadius; 
    
    for (let pin of pins) {
        let diff = Math.abs(pin.angle - hitAngle);
        // Normalize diff
        diff = diff % (Math.PI * 2);
        if (diff > Math.PI) diff = (Math.PI * 2) - diff;
        
        if (diff < collisionThreshold) {
            return true;
        }
    }
    return false;
}

// The core update loop
function update(dt) {
    if (state !== 'PLAYING') return;

    // Rotate center
    // Ensure direction is applied properly
    rotationAngle += levelConfig.speed * levelConfig.direction * (dt / 16);
    // Keep angle normalized
    rotationAngle = rotationAngle % (Math.PI * 2);

    // Move flying pin
    if (flyingPin) {
        flyingPin.y -= flyingPin.speed * (dt / 16);
        
        // It reached the orbit radius
        if (flyingPin.y <= centerCircle.y + orbitRadius) {
            // Collision point is directly below the center circle
            // The angle straight down in radians is Math.PI/2
            // However, the entire circle is rotated by rotationAngle
            // So the angle on the circle at the bottom point is (Math.PI/2 - rotationAngle)
            let relativeAngle = (Math.PI / 2) - rotationAngle;
            
            // Normalize relative angle to 0 - 2PI
            relativeAngle = relativeAngle % (Math.PI * 2);
            if (relativeAngle < 0) relativeAngle += Math.PI * 2;
            
            if (checkCollision(relativeAngle)) {
                // Game Over
                state = 'GAME_OVER';
                setTimeout(() => showScreen('game-over'), 500); // Wait a bit for dramatic effect
            } else {
                // Stuck!
                pins.push({ angle: relativeAngle });
                pinsLeft--;
                flyingPin = null;
                updateHUD();
                
                if (pinsLeft === 0) {
                    // Level Complete
                    state = 'LEVEL_COMPLETE';
                    totalStars += 3;
                    localStorage.setItem('neonPinsStars', totalStars);
                    document.querySelector('#total-stars span').innerText = totalStars;
                    setTimeout(() => showScreen('level-complete'), 500);
                }
            }
        }
    }
}

function gameLoop(time) {
    const dt = time - lastTime;
    lastTime = time;
    
    update(dt);
    draw();
    
    animationId = requestAnimationFrame(gameLoop);
}

// Input Handling
function shoot() {
    if (state !== 'PLAYING' || flyingPin) return;
    
    // Initial position of flying pin (at bottom)
    flyingPin = {
        x: cw / 2,
        y: ch * 0.85,
        speed: ch * 0.05 // Responsive speed based on height
    };
}

// UI handling
function showScreen(id) {
    document.getElementById(id).classList.remove('hidden');
    updateHUD();
}

function hideAllScreens() {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.add('hidden'));
}

// Event Listeners
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);

// Fire on click/tap
canvas.addEventListener('mousedown', shoot);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    shoot();
}, { passive: false });

document.getElementById('start-btn').addEventListener('click', () => {
    startLevel(currentLevel);
});

document.getElementById('restart-btn').addEventListener('click', () => {
    startLevel(currentLevel); // Restart same level
});

document.getElementById('next-level-btn').addEventListener('click', () => {
    currentLevel++;
    startLevel(currentLevel);
});

// Viral Share Component
document.getElementById('share-btn').addEventListener('click', () => {
    const text = `🎯 Eu cheguei ao Nível ${currentLevel} no Neon Pins! Consegue me superar? Jogue agora!`;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('share-btn');
        btn.innerText = "COPIADO!";
        setTimeout(() => {
            btn.innerText = "COMPARTILHAR";
        }, 2000);
    }).catch(err => {
        alert("Não foi possível copiar: " + err);
    });
});

// Init
resize();
draw(); // Draw initial menu background
