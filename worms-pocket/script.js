const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const angleInput = document.getElementById("angleInput");
const powerInput = document.getElementById("powerInput");
const angleValue = document.getElementById("angleValue");
const powerValue = document.getElementById("powerValue");
const fireButton = document.getElementById("fireButton");
const restartButton = document.getElementById("restartButton");
const messageEl = document.getElementById("message");
const turnLabel = document.getElementById("turnLabel");
const playerHealthEl = document.getElementById("playerHealth");
const enemyHealthEl = document.getElementById("enemyHealth");

const WORLD_WIDTH = canvas.width;
const WORLD_HEIGHT = canvas.height;
const GRAVITY = 0.18;
const BLAST_RADIUS = 42;
const MAX_DAMAGE = 45;

let terrain = [];
let clouds = [];
let projectile = null;
let explosion = null;
let winner = null;
let turn = "player";
let turnLock = false;
let aiTimer = null;

const worms = {
  player: { x: 150, y: 0, radius: 12, color: "#ff8c42", health: 100, facing: 1 },
  enemy: { x: WORLD_WIDTH - 150, y: 0, radius: 12, color: "#44a5ff", health: 100, facing: -1 },
};

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setMessage(text) {
  messageEl.textContent = text;
}

function updateControlLabels() {
  angleValue.textContent = `${angleInput.value}°`;
  powerValue.textContent = `${powerInput.value}%`;
}

function setControlsDisabled(disabled) {
  angleInput.disabled = disabled;
  powerInput.disabled = disabled;
  fireButton.disabled = disabled;
}

function groundHeightAt(x) {
  const ix = clamp(Math.round(x), 0, WORLD_WIDTH - 1);
  return terrain[ix];
}

function syncWormToGround(worm) {
  worm.y = groundHeightAt(worm.x) - worm.radius;
}

function createClouds() {
  clouds = Array.from({ length: 7 }, () => ({
    x: randomRange(40, WORLD_WIDTH - 40),
    y: randomRange(40, WORLD_HEIGHT * 0.22),
    r: randomRange(18, 34),
    alpha: randomRange(0.08, 0.15),
  }));
}

function createTerrain() {
  terrain = new Array(WORLD_WIDTH);
  const base = WORLD_HEIGHT * 0.68;
  let current = base + randomRange(-25, 25);

  for (let x = 0; x < WORLD_WIDTH; x += 1) {
    const waveA = Math.sin(x * 0.012) * 26;
    const waveB = Math.sin(x * 0.035 + 1.4) * 12;
    current += randomRange(-2.3, 2.3);
    current = clamp(current, WORLD_HEIGHT * 0.45, WORLD_HEIGHT * 0.86);
    terrain[x] = clamp(current + waveA + waveB, WORLD_HEIGHT * 0.42, WORLD_HEIGHT * 0.9);
  }
}

function placeWorms() {
  worms.player.x = randomRange(120, 220);
  worms.enemy.x = randomRange(WORLD_WIDTH - 220, WORLD_WIDTH - 120);
  worms.player.health = 100;
  worms.enemy.health = 100;
  winner = null;

  syncWormToGround(worms.player);
  syncWormToGround(worms.enemy);
}

function resetGame() {
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }

  createClouds();
  createTerrain();
  placeWorms();
  projectile = null;
  explosion = null;
  turn = "player";
  turnLock = false;
  updateHud();
  setControlsDisabled(false);
  setMessage("Seu turno: ajuste o tiro e toque em disparar.");
}

function updateHud() {
  turnLabel.textContent = winner ? "Fim" : turn === "player" ? "Jogador" : "Inimigo";
  playerHealthEl.textContent = Math.max(0, Math.round(worms.player.health));
  enemyHealthEl.textContent = Math.max(0, Math.round(worms.enemy.health));
}

function fireShot(owner, angleDeg, powerPercent) {
  const worm = worms[owner];
  const angleRad = (angleDeg * Math.PI) / 180;
  const facingAngle = owner === "player" ? angleRad : Math.PI - angleRad;
  const speed = 4.4 + (powerPercent / 100) * 6.8;

  projectile = {
    owner,
    x: worm.x + Math.cos(facingAngle) * 16,
    y: worm.y - 8 + Math.sin(facingAngle) * -4,
    vx: Math.cos(facingAngle) * speed,
    vy: -Math.sin(facingAngle) * speed,
    radius: 5,
  };

  turnLock = true;
  setControlsDisabled(true);
  setMessage(owner === "player" ? "Projétil no ar..." : "O inimigo atirou. Segura aí.");
}

function damageWorms(x, y) {
  for (const worm of Object.values(worms)) {
    const dx = worm.x - x;
    const dy = worm.y - y;
    const distance = Math.hypot(dx, dy);

    if (distance < BLAST_RADIUS + worm.radius) {
      const ratio = 1 - clamp(distance / (BLAST_RADIUS + worm.radius), 0, 1);
      worm.health = clamp(worm.health - ratio * MAX_DAMAGE, 0, 100);
    }
  }
}

function carveTerrain(x, y, radius) {
  const start = clamp(Math.floor(x - radius), 0, WORLD_WIDTH - 1);
  const end = clamp(Math.ceil(x + radius), 0, WORLD_WIDTH - 1);

  for (let px = start; px <= end; px += 1) {
    const dx = px - x;
    const inside = radius * radius - dx * dx;
    if (inside <= 0) {
      continue;
    }

    const depth = Math.sqrt(inside);
    terrain[px] = clamp(Math.max(terrain[px], y + depth), 60, WORLD_HEIGHT - 8);
  }
}

function applyPostExplosionPhysics() {
  syncWormToGround(worms.player);
  syncWormToGround(worms.enemy);

  if (!winner) {
    if (worms.player.health <= 0 && worms.enemy.health <= 0) {
      winner = "draw";
    } else if (worms.player.health <= 0) {
      winner = "enemy";
    } else if (worms.enemy.health <= 0) {
      winner = "player";
    }
  }

  updateHud();

  if (winner) {
    setControlsDisabled(true);
    if (winner === "draw") {
      setMessage("Empate explosivo. Toque em novo terreno para outra rodada.");
    } else if (winner === "player") {
      setMessage("Vitória. O inimigo voou pelos ares.");
    } else {
      setMessage("Derrota. O inimigo acertou em cheio.");
    }
    return;
  }

  turn = turn === "player" ? "enemy" : "player";
  turnLock = false;
  updateHud();

  if (turn === "player") {
    setControlsDisabled(false);
    setMessage("Seu turno novamente. Ajuste e dispare.");
  } else {
    scheduleEnemyTurn();
  }
}

function explodeAt(x, y) {
  projectile = null;
  explosion = { x, y, radius: BLAST_RADIUS, age: 0 };
  carveTerrain(x, y, BLAST_RADIUS);
  damageWorms(x, y);
}

function scheduleEnemyTurn() {
  aiTimer = setTimeout(() => {
    const dx = worms.enemy.x - worms.player.x;
    const distance = Math.abs(dx);
    const angle = clamp(28 + distance / 18 + randomRange(-10, 10), 22, 78);
    const power = clamp(40 + distance / 9 + randomRange(-10, 10), 35, 100);
    fireShot("enemy", angle, power);
  }, 1100);
  setMessage("Turno do inimigo. Ele está calculando o disparo.");
}

function updateProjectile() {
  if (!projectile) {
    return;
  }

  projectile.x += projectile.vx;
  projectile.y += projectile.vy;
  projectile.vy += GRAVITY;

  if (projectile.x < 0 || projectile.x >= WORLD_WIDTH || projectile.y > WORLD_HEIGHT) {
    explodeAt(clamp(projectile.x, 0, WORLD_WIDTH - 1), clamp(projectile.y, 0, WORLD_HEIGHT - 1));
    return;
  }

  const terrainY = groundHeightAt(projectile.x);
  if (projectile.y + projectile.radius >= terrainY) {
    explodeAt(projectile.x, terrainY - 2);
    return;
  }

  const target = projectile.owner === "player" ? worms.enemy : worms.player;
  if (Math.hypot(projectile.x - target.x, projectile.y - target.y) < target.radius + projectile.radius) {
    explodeAt(projectile.x, projectile.y);
  }
}

function updateExplosion() {
  if (!explosion) {
    return;
  }

  explosion.age += 1;
  if (explosion.age > 18) {
    explosion = null;
    applyPostExplosionPhysics();
  }
}

function drawSky() {
  for (const cloud of clouds) {
    ctx.fillStyle = `rgba(255,255,255,${cloud.alpha})`;
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.r * 0.9, cloud.y + 3, cloud.r * 0.75, 0, Math.PI * 2);
    ctx.arc(cloud.x - cloud.r * 0.8, cloud.y + 5, cloud.r * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTerrain() {
  const gradient = ctx.createLinearGradient(0, WORLD_HEIGHT * 0.38, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, "#8fc95a");
  gradient.addColorStop(0.4, "#598d39");
  gradient.addColorStop(1, "#5e412b");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, WORLD_HEIGHT);
  ctx.lineTo(0, terrain[0]);
  for (let x = 1; x < WORLD_WIDTH; x += 1) {
    ctx.lineTo(x, terrain[x]);
  }
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.24)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, terrain[0] - 2);
  for (let x = 1; x < WORLD_WIDTH; x += 6) {
    ctx.lineTo(x, terrain[x] - 2);
  }
  ctx.stroke();
}

function drawWorm(worm) {
  ctx.save();
  ctx.translate(worm.x, worm.y);

  ctx.fillStyle = worm.color;
  ctx.beginPath();
  ctx.arc(0, 0, worm.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#20150f";
  ctx.beginPath();
  ctx.arc(4 * worm.facing, -3, 2.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(32,21,15,0.65)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -worm.radius + 1);
  ctx.lineTo(12 * worm.facing, -worm.radius - 14);
  ctx.stroke();

  ctx.restore();
}

function drawAimGuide() {
  if (turn !== "player" || turnLock || winner) {
    return;
  }

  const worm = worms.player;
  const angleRad = (Number(angleInput.value) * Math.PI) / 180;
  const power = Number(powerInput.value) / 100;
  const guideLength = 40 + power * 80;

  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(worm.x, worm.y - 2);
  ctx.lineTo(
    worm.x + Math.cos(angleRad) * guideLength,
    worm.y - Math.sin(angleRad) * guideLength
  );
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawProjectile() {
  if (!projectile) {
    return;
  }

  ctx.fillStyle = "#2d241c";
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawExplosion() {
  if (!explosion) {
    return;
  }

  const pulse = explosion.radius * (0.55 + explosion.age * 0.04);
  const alpha = clamp(0.45 - explosion.age * 0.02, 0, 1);
  ctx.fillStyle = `rgba(255, 145, 45, ${alpha})`;
  ctx.beginPath();
  ctx.arc(explosion.x, explosion.y, pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(255, 238, 178, ${alpha})`;
  ctx.beginPath();
  ctx.arc(explosion.x, explosion.y, pulse * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function render() {
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawSky();
  drawTerrain();
  drawAimGuide();
  drawWorm(worms.player);
  drawWorm(worms.enemy);
  drawProjectile();
  drawExplosion();
}

function gameLoop() {
  updateProjectile();
  updateExplosion();
  render();
  requestAnimationFrame(gameLoop);
}

angleInput.addEventListener("input", updateControlLabels);
powerInput.addEventListener("input", updateControlLabels);

fireButton.addEventListener("click", () => {
  if (turn !== "player" || turnLock || winner) {
    return;
  }

  fireShot("player", Number(angleInput.value), Number(powerInput.value));
});

restartButton.addEventListener("click", resetGame);

updateControlLabels();
resetGame();
gameLoop();
