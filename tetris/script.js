const COLS = 10;
const ROWS = 20;
const BLOCK = 24;

const board = document.getElementById('board');
const ctx = board.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const messageEl = document.getElementById('message');
const startBtn = document.getElementById('startBtn');

const COLORS = {
  I: '#4dd0e1',
  J: '#5c6bc0',
  L: '#ffa726',
  O: '#ffee58',
  S: '#66bb6a',
  T: '#ab47bc',
  Z: '#ef5350'
};

const SHAPES = {
  I: [[0,0],[1,0],[2,0],[3,0]],
  J: [[0,0],[0,1],[1,1],[2,1]],
  L: [[2,0],[0,1],[1,1],[2,1]],
  O: [[0,0],[1,0],[0,1],[1,1]],
  S: [[1,0],[2,0],[0,1],[1,1]],
  T: [[1,0],[0,1],[1,1],[2,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]]
};

const TYPES = Object.keys(SHAPES);

let grid, current, next, score, level, lines, dropInterval, dropCounter, lastTime;
let running = false;
let paused = false;
let animationId = null;

function createGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const type = TYPES[Math.floor(Math.random() * TYPES.length)];
  return {
    type,
    cells: SHAPES[type].map(([x, y]) => ({ x, y })),
    x: 3,
    y: 0,
    color: COLORS[type]
  };
}

function rotatePiece(piece) {
  if (piece.type === 'O') return piece.cells.map(c => ({ ...c }));
  const cx = piece.type === 'I' ? 1.5 : 1;
  const cy = piece.type === 'I' ? 0.5 : 1;
  return piece.cells.map(({ x, y }) => {
    const rx = Math.round(cx + (y - cy));
    const ry = Math.round(cy - (x - cx));
    return { x: rx, y: ry };
  });
}

function collides(cells, offsetX, offsetY) {
  return cells.some(({ x, y }) => {
    const nx = x + offsetX;
    const ny = y + offsetY;
    if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
    if (ny >= 0 && grid[ny][nx]) return true;
    return false;
  });
}

function mergePiece() {
  current.cells.forEach(({ x, y }) => {
    const gx = current.x + x;
    const gy = current.y + y;
    if (gy >= 0) grid[gy][gx] = current.color;
  });
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (grid[y].every(cell => cell)) {
      grid.splice(y, 1);
      grid.unshift(Array(COLS).fill(null));
      cleared++;
      y++;
    }
  }
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800][cleared] * level;
    score += points;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 80);
    updateStats();
  }
}

function updateStats() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

function spawnPiece() {
  current = next;
  next = randomPiece();
  current.x = 3;
  current.y = 0;
  if (collides(current.cells, current.x, current.y)) {
    gameOver();
  }
  drawNext();
}

function gameOver() {
  running = false;
  cancelAnimationFrame(animationId);
  messageEl.textContent = '게임 오버! 다시 시작하려면 버튼을 누르세요.';
  startBtn.textContent = '다시 시작';
}

function hardDrop() {
  while (!collides(current.cells, current.x, current.y + 1)) {
    current.y++;
  }
  lockPiece();
}

function lockPiece() {
  mergePiece();
  clearLines();
  spawnPiece();
}

function drawCell(context, x, y, color, size) {
  context.fillStyle = color;
  context.fillRect(x * size, y * size, size - 1, size - 1);
  context.strokeStyle = 'rgba(255,255,255,0.15)';
  context.strokeRect(x * size, y * size, size - 1, size - 1);
}

function draw() {
  ctx.fillStyle = '#0f0f1e';
  ctx.fillRect(0, 0, board.width, board.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x]) drawCell(ctx, x, y, grid[y][x], BLOCK);
    }
  }

  if (current) {
    current.cells.forEach(({ x, y }) => {
      const gx = current.x + x;
      const gy = current.y + y;
      if (gy >= 0) drawCell(ctx, gx, gy, current.color, BLOCK);
    });
  }
}

function drawNext() {
  nextCtx.fillStyle = '#0f0f1e';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const size = 20;
  next.cells.forEach(({ x, y }) => {
    drawCell(nextCtx, x, y, next.color, size);
  });
}

function update(time = 0) {
  if (!running || paused) return;
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > dropInterval) {
    if (!collides(current.cells, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
    dropCounter = 0;
  }
  draw();
  animationId = requestAnimationFrame(update);
}

function move(dir) {
  if (!collides(current.cells, current.x + dir, current.y)) {
    current.x += dir;
  }
}

function softDrop() {
  if (!collides(current.cells, current.x, current.y + 1)) {
    current.y++;
    dropCounter = 0;
  } else {
    lockPiece();
  }
}

function rotate() {
  const rotated = rotatePiece(current);
  const kicks = [0, -1, 1, -2, 2];
  for (const k of kicks) {
    if (!collides(rotated, current.x + k, current.y)) {
      current.cells = rotated;
      current.x += k;
      return;
    }
  }
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  if (paused) {
    messageEl.textContent = '일시정지';
  } else {
    messageEl.textContent = '';
    lastTime = performance.now();
    animationId = requestAnimationFrame(update);
  }
}

function startGame() {
  grid = createGrid();
  score = 0;
  level = 1;
  lines = 0;
  dropInterval = 1000;
  dropCounter = 0;
  lastTime = 0;
  paused = false;
  running = true;
  messageEl.textContent = '';
  startBtn.textContent = '재시작';
  next = randomPiece();
  spawnPiece();
  updateStats();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(update);
}

document.addEventListener('keydown', (e) => {
  if (!running) return;
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      if (!paused) move(-1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (!paused) move(1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      if (!paused) softDrop();
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (!paused) rotate();
      break;
    case ' ':
      e.preventDefault();
      if (!paused) hardDrop();
      break;
    case 'p':
    case 'P':
      togglePause();
      break;
  }
});

startBtn.addEventListener('click', startGame);

grid = createGrid();
draw();
