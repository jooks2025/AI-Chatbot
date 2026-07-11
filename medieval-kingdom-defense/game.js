// ===== 설정 =====
const COLS = 7;
const ROWS = 3;
const CASTLE_W = 60;
const CELL_W = 90;
const CELL_H = 100;
const PLAYFIELD_LEFT = CASTLE_W;
const CANVAS_W = CASTLE_W + COLS * CELL_W;
const CANVAS_H = ROWS * CELL_H;

const TOWER_TYPES = {
  archer: { name: '궁수탑', cost: 50, range: 320, damage: 8, fireRate: 0.6, splash: 0, color: '#8d6e63', icon: '🏹' },
  mage: { name: '마법사탑', cost: 120, range: 240, damage: 14, fireRate: 1.1, splash: 55, color: '#5e35b1', icon: '🔮' },
  catapult: { name: '투석기', cost: 200, range: 460, damage: 35, fireRate: 2.0, splash: 85, color: '#6d4c41', icon: '🪨' },
};

const ENEMY_TYPES = {
  goblin: { name: '고블린', hp: 20, speed: 68, gold: 5, dmg: 5, color: '#7cb342', icon: '👺', r: 16 },
  orc: { name: '오크 전사', hp: 55, speed: 44, gold: 10, dmg: 12, color: '#558b2f', icon: '👹', r: 18 },
  troll: { name: '공성 트롤', hp: 420, speed: 24, gold: 100, dmg: 40, color: '#4e342e', icon: '🧌', r: 26, boss: true },
};

const MINE_BASE_COST = 80;
const MINE_COST_SCALE = 1.55;
const MINE_INCOME_PER_SEC = 2;

// ===== 상태 =====
const state = {
  gold: 120,
  wave: 1,
  castleHp: 100,
  castleMaxHp: 100,
  mines: 0,
  goldPerSec: 0,
  selectedTower: null,
  towerGrid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
  towers: [],
  enemies: [],
  effects: [],
  spawnQueue: [],
  spawnTimer: 0,
  waveActive: false,
  waveClearedCount: 0,
  hasRevived: false,
  running: false,
  lastTime: 0,
};

// ===== DOM =====
const canvas = document.getElementById('battlefield');
const ctx = canvas.getContext('2d');
const goldValueEl = document.getElementById('goldValue');
const waveValueEl = document.getElementById('waveValue');
const hpFillEl = document.getElementById('hpFill');
const hpValueEl = document.getElementById('hpValue');
const mineCountEl = document.getElementById('mineCount');
const mineCostEl = document.getElementById('mineCost');
const mineIncomeEl = document.getElementById('mineIncome');
const mineBtn = document.getElementById('mineBtn');
const towerShop = document.getElementById('towerShop');
const hintEl = document.getElementById('hint');

const startOverlay = document.getElementById('startOverlay');
const startBtn = document.getElementById('startBtn');
const waveClearOverlay = document.getElementById('waveClearOverlay');
const clearedWaveEl = document.getElementById('clearedWave');
const baseRewardEl = document.getElementById('baseReward');
const doubleAdBtn = document.getElementById('doubleAdBtn');
const nextWaveBtn = document.getElementById('nextWaveBtn');
const nextWaveCountdownEl = document.getElementById('nextWaveCountdown');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalWaveEl = document.getElementById('finalWave');
const finalGoldEl = document.getElementById('finalGold');
const reviveAdBtn = document.getElementById('reviveAdBtn');
const restartBtn = document.getElementById('restartBtn');

let totalGoldEarned = 0;
let pendingWaveReward = 0;
let nextWaveTimer = null;

// ===== 유틸 =====
function cellCenter(row, col) {
  return {
    x: PLAYFIELD_LEFT + col * CELL_W + CELL_W / 2,
    y: row * CELL_H + CELL_H / 2,
  };
}

function clampHp() {
  state.castleHp = Math.max(0, Math.min(state.castleMaxHp, state.castleHp));
}

// ===== UI 업데이트 =====
function updateHud() {
  goldValueEl.textContent = Math.floor(state.gold);
  waveValueEl.textContent = state.wave;
  hpValueEl.textContent = Math.ceil(state.castleHp);
  hpFillEl.style.width = `${(state.castleHp / state.castleMaxHp) * 100}%`;
  mineCountEl.textContent = state.mines;
  mineIncomeEl.textContent = state.goldPerSec.toFixed(1);
  mineCostEl.textContent = `${mineCost()} 🪙`;

  document.querySelectorAll('.tower-btn').forEach((btn) => {
    const key = btn.dataset.tower;
    const cost = TOWER_TYPES[key].cost;
    btn.classList.toggle('disabled', state.gold < cost);
    btn.classList.toggle('selected', state.selectedTower === key);
  });
  mineBtn.classList.toggle('disabled', state.gold < mineCost());
}

function mineCost() {
  return Math.floor(MINE_BASE_COST * Math.pow(MINE_COST_SCALE, state.mines));
}

// ===== 타워 배치 =====
towerShop.addEventListener('click', (e) => {
  const btn = e.target.closest('.tower-btn');
  if (!btn) return;
  const key = btn.dataset.tower;
  state.selectedTower = state.selectedTower === key ? null : key;
  updateHud();
  hintEl.textContent = state.selectedTower
    ? `${TOWER_TYPES[key].name}을(를) 배치할 칸을 클릭하세요.`
    : '병력을 선택한 뒤 전장을 클릭해 배치하세요.';
});

canvas.addEventListener('pointerdown', (e) => {
  if (!state.selectedTower) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  if (x < PLAYFIELD_LEFT) return;

  const col = Math.floor((x - PLAYFIELD_LEFT) / CELL_W);
  const row = Math.floor(y / CELL_H);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  if (state.towerGrid[row][col]) {
    hintEl.textContent = '이미 병력이 배치된 칸입니다.';
    return;
  }

  const def = TOWER_TYPES[state.selectedTower];
  if (state.gold < def.cost) {
    hintEl.textContent = '골드가 부족합니다.';
    return;
  }

  state.gold -= def.cost;
  const center = cellCenter(row, col);
  const tower = {
    type: state.selectedTower,
    row,
    col,
    x: center.x,
    y: center.y,
    cooldown: 0,
    ...def,
  };
  state.towerGrid[row][col] = tower;
  state.towers.push(tower);
  updateHud();
});

// ===== 금광 =====
mineBtn.addEventListener('click', () => {
  const cost = mineCost();
  if (state.gold < cost) return;
  state.gold -= cost;
  state.mines += 1;
  state.goldPerSec = state.mines * MINE_INCOME_PER_SEC;
  updateHud();
});

// ===== 웨이브 생성 =====
function generateWave(waveNum) {
  const isBossWave = waveNum % 5 === 0;
  const count = 4 + Math.floor(waveNum * 1.4);
  const list = [];
  for (let i = 0; i < count; i++) {
    let type = 'goblin';
    if (waveNum >= 3 && Math.random() < Math.min(0.55, waveNum * 0.05)) type = 'orc';
    list.push(type);
  }
  if (isBossWave) list.push('troll');
  return list;
}

function startWave() {
  const list = generateWave(state.wave);
  const scale = 1 + (state.wave - 1) * 0.12;
  state.spawnQueue = list.map((type) => ({ type, scale }));
  state.spawnTimer = 0;
  state.waveActive = true;
  AdSDK.gameplayStart();
  hintEl.textContent = `웨이브 ${state.wave} 시작! 적이 몰려옵니다.`;
}

function spawnEnemy(type, scale) {
  const def = ENEMY_TYPES[type];
  const row = Math.floor(Math.random() * ROWS);
  const center = cellCenter(row, COLS - 1);
  state.enemies.push({
    type,
    row,
    x: CANVAS_W + 20,
    y: center.y,
    hp: def.hp * scale,
    maxHp: def.hp * scale,
    speed: def.speed,
    ...def,
  });
}

function onWaveComplete() {
  state.waveActive = false;
  AdSDK.gameplayStop();
  state.waveClearedCount += 1;
  pendingWaveReward = 20 + state.wave * 5;
  state.gold += pendingWaveReward;
  totalGoldEarned += pendingWaveReward;

  clearedWaveEl.textContent = state.wave;
  baseRewardEl.textContent = pendingWaveReward;
  waveClearOverlay.classList.remove('hidden');
  updateHud();

  // 3웨이브마다 자연스러운 전환 지점에서 인터스티셜(미드게임) 광고 요청
  if (state.waveClearedCount % 3 === 0) {
    AdSDK.showMidgameAd(() => {});
  }

  let countdown = 5;
  nextWaveCountdownEl.textContent = countdown;
  nextWaveTimer = setInterval(() => {
    countdown -= 1;
    nextWaveCountdownEl.textContent = countdown;
    if (countdown <= 0) {
      advanceToNextWave();
    }
  }, 1000);
}

function advanceToNextWave() {
  clearInterval(nextWaveTimer);
  waveClearOverlay.classList.add('hidden');
  state.wave += 1;
  startWave();
}

doubleAdBtn.addEventListener('click', () => {
  doubleAdBtn.disabled = true;
  AdSDK.showRewardedAd(
    () => {
      state.gold += pendingWaveReward;
      totalGoldEarned += pendingWaveReward;
      updateHud();
      doubleAdBtn.textContent = '보상 지급 완료!';
    },
    () => {
      doubleAdBtn.disabled = false;
    }
  );
});

nextWaveBtn.addEventListener('click', () => {
  advanceToNextWave();
});

// ===== 게임오버 / 부활 =====
function triggerGameOver() {
  state.waveActive = false;
  state.running = false;
  AdSDK.gameplayStop();
  finalWaveEl.textContent = state.wave;
  finalGoldEl.textContent = totalGoldEarned;
  gameOverOverlay.classList.remove('hidden');
  reviveAdBtn.style.display = state.hasRevived ? 'none' : 'block';
}

reviveAdBtn.addEventListener('click', () => {
  reviveAdBtn.disabled = true;
  AdSDK.showRewardedAd(
    () => {
      state.hasRevived = true;
      state.castleHp = state.castleMaxHp * 0.5;
      state.enemies = [];
      state.running = true;
      gameOverOverlay.classList.add('hidden');
      updateHud();
      state.lastTime = performance.now();
      requestAnimationFrame(loop);
      startWave();
    },
    () => {
      reviveAdBtn.disabled = false;
    }
  );
});

restartBtn.addEventListener('click', () => {
  resetGame();
  gameOverOverlay.classList.add('hidden');
  startGame();
});

// ===== 전투 로직 =====
function updateTowers(dt) {
  state.towers.forEach((tower) => {
    tower.cooldown -= dt;
    if (tower.cooldown > 0) return;

    const candidates = state.enemies
      .filter((e) => e.row === tower.row && e.x >= tower.x && e.x - tower.x <= tower.range)
      .sort((a, b) => a.x - b.x);
    if (candidates.length === 0) return;

    const target = candidates[0];
    dealDamage(target, tower.damage);
    state.effects.push({ x1: tower.x, y1: tower.y, x2: target.x, y2: target.y, life: 0.12, color: tower.color });

    if (tower.splash > 0) {
      state.enemies
        .filter((e) => e !== target && e.row === tower.row && Math.abs(e.x - target.x) <= tower.splash)
        .forEach((e) => dealDamage(e, tower.damage * 0.6));
    }

    tower.cooldown = 1 / tower.fireRate;
  });
}

function dealDamage(enemy, amount) {
  enemy.hp -= amount;
}

function updateEnemies(dt) {
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.hp <= 0) {
      state.gold += e.gold;
      totalGoldEarned += e.gold;
      state.enemies.splice(i, 1);
      continue;
    }
    e.x -= e.speed * dt;
    if (e.x <= PLAYFIELD_LEFT + 4) {
      state.castleHp -= e.dmg;
      clampHp();
      state.enemies.splice(i, 1);
      if (state.castleHp <= 0) {
        triggerGameOver();
        return;
      }
    }
  }
}

function updateSpawning(dt) {
  if (!state.waveActive) return;
  if (state.spawnQueue.length === 0) {
    if (state.enemies.length === 0) onWaveComplete();
    return;
  }
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    const next = state.spawnQueue.shift();
    spawnEnemy(next.type, next.scale);
    state.spawnTimer = Math.max(0.35, 1.1 - state.wave * 0.03);
  }
}

function updateEffects(dt) {
  for (let i = state.effects.length - 1; i >= 0; i--) {
    state.effects[i].life -= dt;
    if (state.effects[i].life <= 0) state.effects.splice(i, 1);
  }
}

function updateIdleIncome(dt) {
  if (state.goldPerSec > 0) {
    state.gold += state.goldPerSec * dt;
    totalGoldEarned += state.goldPerSec * dt;
  }
}

// ===== 렌더링 =====
function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // 성벽
  ctx.fillStyle = '#3a2c1a';
  ctx.fillRect(0, 0, CASTLE_W, CANVAS_H);
  ctx.font = '30px serif';
  ctx.fillText('🏰', 8, CANVAS_H / 2 + 12);

  // 격자
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(PLAYFIELD_LEFT, r * CELL_H);
    ctx.lineTo(CANVAS_W, r * CELL_H);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(PLAYFIELD_LEFT + c * CELL_W, 0);
    ctx.lineTo(PLAYFIELD_LEFT + c * CELL_W, CANVAS_H);
    ctx.stroke();
  }

  // 타워
  state.towers.forEach((tower) => {
    ctx.font = '32px serif';
    ctx.fillText(tower.icon, tower.x - 16, tower.y + 12);
  });

  // 이펙트
  state.effects.forEach((fx) => {
    ctx.strokeStyle = fx.color;
    ctx.globalAlpha = Math.max(0, fx.life / 0.12);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fx.x1, fx.y1);
    ctx.lineTo(fx.x2, fx.y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // 적
  state.enemies.forEach((e) => {
    ctx.font = `${e.r * 2}px serif`;
    ctx.fillText(e.icon, e.x - e.r, e.y + e.r * 0.6);
    // 체력바
    const barW = e.r * 2;
    ctx.fillStyle = '#2a1a12';
    ctx.fillRect(e.x - barW / 2, e.y - e.r - 10, barW, 5);
    ctx.fillStyle = e.boss ? '#ef5350' : '#c0ca33';
    ctx.fillRect(e.x - barW / 2, e.y - e.r - 10, barW * (e.hp / e.maxHp), 5);
  });
}

// ===== 메인 루프 =====
function loop(time) {
  if (!state.running) return;
  const dt = Math.min(0.05, (time - state.lastTime) / 1000);
  state.lastTime = time;

  updateSpawning(dt);
  updateTowers(dt);
  updateEnemies(dt);
  updateEffects(dt);
  updateIdleIncome(dt);
  draw();
  updateHud();

  if (state.running) requestAnimationFrame(loop);
}

// ===== 게임 시작/리셋 =====
function startGame() {
  state.running = true;
  state.lastTime = performance.now();
  requestAnimationFrame(loop);
  startWave();
}

function resetGame() {
  clearInterval(nextWaveTimer);
  state.gold = 120;
  state.wave = 1;
  state.castleHp = 100;
  state.castleMaxHp = 100;
  state.mines = 0;
  state.goldPerSec = 0;
  state.selectedTower = null;
  state.towerGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  state.towers = [];
  state.enemies = [];
  state.effects = [];
  state.spawnQueue = [];
  state.waveActive = false;
  state.waveClearedCount = 0;
  state.hasRevived = false;
  state.running = false;
  totalGoldEarned = 0;
  updateHud();
  draw();
}

startBtn.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  startGame();
});

// ===== 초기화 =====
AdSDK.init().then(() => {
  AdSDK.loadingStart();
  resetGame();
  draw();
  AdSDK.loadingStop();
});
