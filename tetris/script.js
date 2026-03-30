const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const NEXT_BLOCK_SIZE = 24;
const EMPTY = 0;
const SWIPE_THRESHOLD = 24;

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
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const touchButtons = document.querySelectorAll("[data-action]");

const palette = {
  I: "#3dd9ff",
  J: "#4c6fff",
  L: "#ff9f43",
  O: "#ffd84d",
  S: "#52e27d",
  T: "#b86cff",
  Z: "#ff5c7a"
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
let touchStartX = 0;
let touchStartY = 0;
let swipeLocked = false;

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
  showOverlay("Pronto?", "Toque em iniciar para jogar.");
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
    showOverlay("Pausado", "Toque em pausar ou pressione P para continuar.");
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
  showOverlay("Fim de jogo", "Toque em reiniciar e tente bater sua pontuacao.");
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
  return Math.max(1000 - (level - 1) * 85, 150);
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
  if (!currentPiece) {
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

  const lineScores = {
    1: 100,
    2: 300,
    3: 500,
    4: 800
  };

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

  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.fillRect(x * size, y * size, size, 4);

  ctx.strokeStyle = "rgba(5, 9, 20, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
}

function drawGrid(ctx, width, height, size) {
  ctx.strokeStyle = "rgba(170, 199, 255, 0.08)";
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

      context.fillStyle = "rgba(255, 255, 255, 0.12)";
      context.fillRect((ghost.x + x) * BLOCK_SIZE, (ghost.y + y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      context.strokeStyle = "rgba(255, 255, 255, 0.2)";
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

      nextContext.fillStyle = "rgba(255, 255, 255, 0.22)";
      nextContext.fillRect(offsetX + x * NEXT_BLOCK_SIZE, offsetY + y * NEXT_BLOCK_SIZE, NEXT_BLOCK_SIZE, 4);

      nextContext.strokeStyle = "rgba(5, 9, 20, 0.35)";
      nextContext.lineWidth = 2;
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
    case "rotate":
      rotatePiece();
      break;
    case "drop":
      hardDrop();
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

  if (!isRunning || isPaused || isGameOver) {
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
      handleGameAction("rotate");
      break;
    case "Space":
      event.preventDefault();
      handleGameAction("drop");
      break;
    default:
      break;
  }
});

touchButtons.forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handleGameAction(button.dataset.action);
  });
});

canvas.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  swipeLocked = false;
}, { passive: true });

canvas.addEventListener("touchmove", (event) => {
  if (!isRunning || isPaused || isGameOver || swipeLocked) {
    return;
  }

  const touch = event.touches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;

  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
    handleGameAction(deltaX > 0 ? "right" : "left");
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    swipeLocked = true;
  } else if (deltaY > SWIPE_THRESHOLD) {
    handleGameAction("down");
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    swipeLocked = true;
  } else if (deltaY < -SWIPE_THRESHOLD) {
    handleGameAction("drop");
    swipeLocked = true;
  }
}, { passive: true });

canvas.addEventListener("touchend", (event) => {
  if (!isRunning || isPaused || isGameOver) {
    return;
  }

  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;

  if (!swipeLocked && Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) {
    handleGameAction("rotate");
  }

  swipeLocked = false;
}, { passive: true });

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", pauseGame);
restartButton.addEventListener("click", () => {
  cancelAnimationFrame(animationFrameId);
  resetGame();
  startGame();
});

resetGame();
