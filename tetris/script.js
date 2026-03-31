const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const NEXT_BLOCK_SIZE = 24;
const EMPTY = 0;

const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const startGameButton = document.getElementById("startGameButton");
const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
const nextCanvas = document.getElementById("nextCanvas");
const nextContext = nextCanvas.getContext("2d");
const scoreElement = document.getElementById("score");
const linesElement = document.getElementById("lines");
const levelElement = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const controlButtons = document.querySelectorAll("[data-action]");
const highScoresListElement = document.getElementById("highScoresList");

const HIGH_SCORES_KEY = "tetris-pocket-high-scores";
const HIGH_SCORES_LIMIT = 5;

const palette = {
  I: "#2f4730",
  J: "#2f4730",
  L: "#2f4730",
  O: "#2f4730",
  S: "#2f4730",
  T: "#2f4730",
  Z: "#2f4730"
};

const tetrominoes = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ]
};

let board;
let currentPiece;
let nextPiece;
let dropCounter;
let lastTime;
let animationFrameId;
let score;
let lines;
let level;
let isRunning;
let isPaused;
let isGameOver;
let highScores = [];

function loadHighScores() {
  try {
    const storedScores = window.localStorage.getItem(HIGH_SCORES_KEY);
    if (!storedScores) {
      return [];
    }

    const parsedScores = JSON.parse(storedScores);
    if (!Array.isArray(parsedScores)) {
      return [];
    }

    return parsedScores
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .sort((first, second) => second - first)
      .slice(0, HIGH_SCORES_LIMIT);
  } catch (error) {
    return [];
  }
}

function persistHighScores() {
  try {
    window.localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(highScores));
  } catch (error) {
    // Ignora falhas de armazenamento local para nao interromper o jogo.
  }
}

function renderHighScores() {
  if (!highScoresListElement) {
    return;
  }

  highScoresListElement.innerHTML = "";

  for (let index = 0; index < HIGH_SCORES_LIMIT; index += 1) {
    const value = highScores[index];
    const item = document.createElement("li");
    item.className = value === undefined ? "high-scores-empty" : "";
    item.textContent = `${index + 1}. ${value ?? "---"}`;
    highScoresListElement.appendChild(item);
  }
}

function saveHighScore(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return false;
  }

  highScores = [...highScores, value]
    .sort((first, second) => second - first)
    .slice(0, HIGH_SCORES_LIMIT);

  persistHighScores();
  renderHighScores();
  return highScores.includes(value);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function createPiece(type = randomType()) {
  return {
    type,
    matrix: tetrominoes[type].map((row) => [...row]),
    color: palette[type],
    x: 0,
    y: 0
  };
}

function randomType() {
  const keys = Object.keys(tetrominoes);
  return keys[Math.floor(Math.random() * keys.length)];
}

function showGameScreen() {
  startScreen.classList.remove("is-active");
  gameScreen.classList.add("is-active");
}

function showStartScreen() {
  gameScreen.classList.remove("is-active");
  startScreen.classList.add("is-active");
}

function resetGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  dropCounter = 0;
  lastTime = 0;
  isRunning = false;
  isPaused = false;
  isGameOver = false;
  currentPiece = null;
  nextPiece = createPiece();

  updateHud();
  draw();
  drawNextPiece();
  showOverlay("Pronto", "Use os botoes abaixo para jogar.");
}

function enterGame() {
  showGameScreen();
  resetGame();
  startGame();
}

function startGame() {
  if (isGameOver) {
    resetGame();
  }

  if (!currentPiece) {
    spawnPiece();
  }

  isRunning = true;
  isPaused = false;
  hideOverlay();
  cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(update);
}

function pauseGame() {
  if (!isRunning || isGameOver) {
    return;
  }

  isPaused = !isPaused;

  if (isPaused) {
    showOverlay("Pause", "Toque em P para voltar.");
    cancelAnimationFrame(animationFrameId);
    return;
  }

  hideOverlay();
  lastTime = 0;
  animationFrameId = requestAnimationFrame(update);
}

function gameOver() {
  isRunning = false;
  isGameOver = true;
  cancelAnimationFrame(animationFrameId);
  const enteredTopFive = saveHighScore(score);
  const gameOverMessage = enteredTopFive
    ? "Nova pontuacao no top 5. Toque em R para reiniciar."
    : "Toque em R para reiniciar.";
  showOverlay("Fim", gameOverMessage);
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.add("visible");
}

function hideOverlay() {
  overlay.classList.remove("visible");
}

function update(time = 0) {
  if (!isRunning || isPaused || isGameOver) {
    return;
  }

  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;

  if (dropCounter > getDropInterval()) {
    moveDown();
  }

  draw();
  animationFrameId = requestAnimationFrame(update);
}

function getDropInterval() {
  return Math.max(920 - (level - 1) * 70, 140);
}

function spawnPiece() {
  currentPiece = nextPiece || createPiece();
  nextPiece = createPiece();
  currentPiece.x = Math.floor(COLS / 2) - Math.ceil(currentPiece.matrix[0].length / 2);
  currentPiece.y = 0;
  drawNextPiece();

  if (collides(board, currentPiece)) {
    gameOver();
  }
}

function collides(targetBoard, piece) {
  return piece.matrix.some((row, y) =>
    row.some((value, x) => {
      if (!value) {
        return false;
      }

      const boardX = piece.x + x;
      const boardY = piece.y + y;

      return (
        boardX < 0 ||
        boardX >= COLS ||
        boardY >= ROWS ||
        (boardY >= 0 && targetBoard[boardY][boardX] !== EMPTY)
      );
    })
  );
}

function merge(boardToMerge, piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value && piece.y + y >= 0) {
        boardToMerge[piece.y + y][piece.x + x] = piece.color;
      }
    });
  });
}

function rotate(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function rotatePiece() {
  if (!isRunning || isPaused || isGameOver) {
    return;
  }

  const rotated = rotate(currentPiece.matrix);
  const previousX = currentPiece.x;
  const offsets = [0, -1, 1, -2, 2];

  currentPiece.matrix = rotated;

  for (const offset of offsets) {
    currentPiece.x = previousX + offset;
    if (!collides(board, currentPiece)) {
      draw();
      return;
    }
  }

  currentPiece.matrix = rotate(rotate(rotate(rotated)));
  currentPiece.x = previousX;
}

function move(offset) {
  if (!isRunning || isPaused || isGameOver) {
    return;
  }

  currentPiece.x += offset;
  if (collides(board, currentPiece)) {
    currentPiece.x -= offset;
    return;
  }

  draw();
}

function moveDown() {
  if (!currentPiece || !isRunning || isPaused || isGameOver) {
    return;
  }

  currentPiece.y += 1;
  dropCounter = 0;

  if (collides(board, currentPiece)) {
    currentPiece.y -= 1;
    merge(board, currentPiece);
    clearLines();
    spawnPiece();
  }

  draw();
}

function hardDrop() {
  if (!isRunning || isPaused || isGameOver) {
    return;
  }

  while (!collides(board, currentPiece)) {
    currentPiece.y += 1;
  }

  currentPiece.y -= 1;
  merge(board, currentPiece);
  clearLines();
  spawnPiece();
  draw();
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every((cell) => cell !== EMPTY)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(EMPTY));
      cleared += 1;
      y += 1;
    }
  }

  if (!cleared) {
    return;
  }

  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  const lineScores = { 1: 100, 2: 300, 3: 500, 4: 800 };
  score += (lineScores[cleared] || 0) * level;
  updateHud();
}

function updateHud() {
  scoreElement.textContent = score;
  linesElement.textContent = lines;
  levelElement.textContent = level;
}

function drawCell(ctx, x, y, color, size) {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);

  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.fillRect(x * size, y * size, size, 3);

  ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
}

function drawGrid(ctx, width, height, size) {
  ctx.strokeStyle = "rgba(23, 26, 23, 0.08)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * size + 0.5, 0);
    ctx.lineTo(x * size + 0.5, height * size);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * size + 0.5);
    ctx.lineTo(width * size, y * size + 0.5);
    ctx.stroke();
  }
}

function drawBoard() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(context, COLS, ROWS, BLOCK_SIZE);

  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== EMPTY) {
        drawCell(context, x, y, value, BLOCK_SIZE);
      }
    });
  });
}

function drawPiece(piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(context, piece.x + x, piece.y + y, piece.color, BLOCK_SIZE);
      }
    });
  });
}

function drawGhostPiece() {
  if (!currentPiece) {
    return;
  }

  const ghost = {
    ...currentPiece,
    matrix: currentPiece.matrix.map((row) => [...row]),
    y: currentPiece.y
  };

  while (!collides(board, ghost)) {
    ghost.y += 1;
  }

  ghost.y -= 1;

  ghost.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }

      context.fillStyle = "rgba(47, 71, 48, 0.18)";
      context.fillRect((ghost.x + x) * BLOCK_SIZE, (ghost.y + y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      context.strokeStyle = "rgba(47, 71, 48, 0.28)";
      context.strokeRect((ghost.x + x) * BLOCK_SIZE + 1, (ghost.y + y) * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
    });
  });
}

function drawNextPiece() {
  nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextPiece) {
    return;
  }

  const matrix = nextPiece.matrix;
  const offsetX = (nextCanvas.width - matrix[0].length * NEXT_BLOCK_SIZE) / 2;
  const offsetY = (nextCanvas.height - matrix.length * NEXT_BLOCK_SIZE) / 2;

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }
      nextContext.fillStyle = nextPiece.color;
      nextContext.fillRect(offsetX + x * NEXT_BLOCK_SIZE, offsetY + y * NEXT_BLOCK_SIZE, NEXT_BLOCK_SIZE, NEXT_BLOCK_SIZE);
      nextContext.strokeStyle = "rgba(0, 0, 0, 0.18)";
      nextContext.strokeRect(offsetX + x * NEXT_BLOCK_SIZE + 1, offsetY + y * NEXT_BLOCK_SIZE + 1, NEXT_BLOCK_SIZE - 2, NEXT_BLOCK_SIZE - 2);
    });
  });
}

function draw() {
  drawBoard();
  if (currentPiece) {
    drawGhostPiece();
    drawPiece(currentPiece);
  }
}

function handleGameAction(action) {
  switch (action) {
    case "left":
      move(-1);
      break;
    case "right":
      move(1);
      break;
    case "down":
      moveDown();
      break;
    case "up":
      hardDrop();
      break;
    case "rotate":
      rotatePiece();
      break;
    default:
      break;
  }
}

document.addEventListener("keydown", (event) => {
  if (event.code === "KeyP") {
    pauseGame();
    return;
  }

  switch (event.code) {
    case "ArrowLeft":
      event.preventDefault();
      handleGameAction("left");
      break;
    case "ArrowRight":
      event.preventDefault();
      handleGameAction("right");
      break;
    case "ArrowDown":
      event.preventDefault();
      handleGameAction("down");
      break;
    case "ArrowUp":
      event.preventDefault();
      handleGameAction("up");
      break;
    case "Space":
      event.preventDefault();
      handleGameAction("rotate");
      break;
    default:
      break;
  }
});

controlButtons.forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handleGameAction(button.dataset.action);
  });
});

startGameButton.addEventListener("click", enterGame);
pauseButton.addEventListener("click", pauseGame);
restartButton.addEventListener("click", () => {
  cancelAnimationFrame(animationFrameId);
  resetGame();
  startGame();
});

highScores = loadHighScores();
renderHighScores();
resetGame();
showStartScreen();
