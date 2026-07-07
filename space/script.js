(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const mapCanvas = document.getElementById('minimap');
  const mapCtx = mapCanvas.getContext('2d');

  const fuelBar = document.getElementById('fuelBar');
  const hullBar = document.getElementById('hullBar');
  const cargoBar = document.getElementById('cargoBar');
  const cargoText = document.getElementById('cargoText');
  const creditsText = document.getElementById('creditsText');
  const messageEl = document.getElementById('message');
  const dockPanel = document.getElementById('dockPanel');
  const dockCreditsEl = document.getElementById('dockCredits');
  const sellBtn = document.getElementById('sellBtn');
  const closeDockBtn = document.getElementById('closeDockBtn');
  const upgradeListEl = document.getElementById('upgradeList');
  const mineProgressWrap = document.getElementById('mineProgressWrap');
  const mineProgressFill = document.getElementById('mineProgress');
  const bossBar = document.getElementById('bossBar');
  const bossNameEl = document.getElementById('bossName');
  const bossTagEl = document.getElementById('bossTag');
  const bossHpFill = document.getElementById('bossHpFill');
  const sectorLabelEl = document.getElementById('sectorLabel');
  const toastEl = document.getElementById('toast');
  const muteBtn = document.getElementById('muteBtn');

  const WORLD_W = 8200;
  const WORLD_H = 8200;
  const STATION = { x: WORLD_W / 2, y: WORLD_H / 2, radius: 90 };

  const SECTOR_DEFS = [
    { sector: 1, bandMin: 900, bandMax: 1700 },
    { sector: 2, bandMin: 1900, bandMax: 2500 },
    { sector: 3, bandMin: 2700, bandMax: 3200 },
  ];

  const BOSS_DEFS = [
    {
      id: 'sector1', sector: 1, name: '유성체 대왕 크라겐', tag: '가벼운 보스',
      color: '#5dffa0', core: '#0b1f13', glow: 'rgba(93,255,160,0.45)',
      eyeCount: 2, radius: 175, hitRadius: 115, hp: 170, contactDamage: 16,
      speed: 75, aggroRange: 540, canShoot: false,
      reward: 280, respawnTime: 60,
    },
    {
      id: 'sector2', sector: 2, name: '심연 촉수왕 바슬로스', tag: '중간 보스',
      color: '#caa0ff', core: '#170b28', glow: 'rgba(202,160,255,0.45)',
      eyeCount: 4, radius: 245, hitRadius: 160, hp: 400, contactDamage: 24,
      speed: 115, aggroRange: 640, canShoot: true,
      fireRate: 1.5, projectileSpeed: 230, projectileDamage: 16,
      reward: 650, respawnTime: 90,
    },
    {
      id: 'sector3', sector: 3, name: '차원포식자 오메가바이스', tag: '최종 보스',
      color: '#ff3355', core: '#1a0407', glow: 'rgba(255,51,85,0.5)',
      eyeCount: 6, radius: 340, hitRadius: 220, hp: 780, contactDamage: 38,
      speed: 155, aggroRange: 760, canShoot: true,
      fireRate: 0.9, projectileSpeed: 270, projectileDamage: 22,
      reward: 1600, respawnTime: 150,
    },
  ];

  const RESOURCE_TYPES = {
    iron:    { name: '철광석',   color: '#c7c7c7', price: 4 },
    gold:    { name: '금',       color: '#ffd24a', price: 11 },
    crystal: { name: '결정체',   color: '#7ef7e0', price: 26 },
  };

  const UPGRADES = {
    cargo:  { label: '화물칸 확장',  base: 40,  growth: 1.5, max: 8, step: 20 },
    fuel:   { label: '연료 탱크 확장', base: 40, growth: 1.5, max: 8, step: 25 },
    engine: { label: '엔진 출력 강화', base: 55, growth: 1.6, max: 6, step: 0 },
    mining: { label: '채굴 레이저 강화', base: 50, growth: 1.6, max: 6, step: 0 },
    hull:   { label: '선체 장갑 강화', base: 45, growth: 1.55, max: 6, step: 20 },
    weapon: { label: '레이저 캐논 강화', base: 60, growth: 1.55, max: 6, step: 0 },
  };

  const FIRE_COOLDOWN = 0.25;
  const BULLET_SPEED = 520;
  const BULLET_LIFE = 1.1;
  const FUEL_BURN_RATE = 4.6;
  const SHIP_DRAG = 0.48;

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function makePlanets() {
    const planets = [];
    const count = 18;
    const types = Object.keys(RESOURCE_TYPES);
    let attempts = 0;
    while (planets.length < count && attempts < 2000) {
      attempts++;
      const x = rand(200, WORLD_W - 200);
      const y = rand(200, WORLD_H - 200);
      if (dist(x, y, STATION.x, STATION.y) < 420) continue;
      if (planets.some(p => dist(p.x, p.y, x, y) < 320)) continue;
      const type = types[Math.floor(rand(0, types.length))];
      const radius = rand(28, 46);
      const maxAmount = type === 'crystal' ? rand(60, 100) : type === 'gold' ? rand(90, 150) : rand(160, 240);
      planets.push({
        x, y, radius, type,
        maxAmount,
        amount: maxAmount,
        regenTimer: 0,
        detail: makeDepositDetail(type, radius),
      });
    }
    return planets;
  }

  function makeDepositDetail(type, radius) {
    if (type === 'iron') {
      const verts = [];
      const n = 9;
      for (let i = 0; i < n; i++) {
        verts.push({ angle: (i / n) * Math.PI * 2, r: radius * rand(0.78, 1.05) });
      }
      return { verts };
    }
    if (type === 'gold') {
      const blobs = [];
      const n = 3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
        const d = radius * rand(0.12, 0.32);
        blobs.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: radius * rand(0.55, 0.72) });
      }
      return { blobs };
    }
    const facetCount = 7;
    const sparkles = [];
    for (let i = 0; i < 4; i++) {
      sparkles.push({ angle: rand(0, Math.PI * 2), dist: rand(0.35, 1.2), phase: rand(0, Math.PI * 2) });
    }
    return { facetCount, sparkles, rotOffset: rand(0, Math.PI * 2) };
  }

  function makeAsteroids() {
    const asteroids = [];
    for (let i = 0; i < 24; i++) {
      let x, y;
      do {
        x = rand(100, WORLD_W - 100);
        y = rand(100, WORLD_H - 100);
      } while (dist(x, y, STATION.x, STATION.y) < 300);
      const radius = rand(14, 32);
      const angle = rand(0, Math.PI * 2);
      const speed = rand(10, 40);
      asteroids.push({
        x, y, radius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: rand(-1, 1),
        rot: rand(0, Math.PI * 2),
        verts: makeRockShape(radius),
      });
    }
    return asteroids;
  }

  function makeRockShape(radius) {
    const verts = [];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = radius * rand(0.75, 1.15);
      verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return verts;
  }

  function makeStars(count, w, h) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({ x: rand(0, w), y: rand(0, h), r: rand(0.4, 1.8), b: rand(0.3, 1) });
    }
    return stars;
  }

  function makeBosses() {
    return BOSS_DEFS.map((def) => spawnBoss(def));
  }

  function makeMonsterBody() {
    const n = 13;
    const verts = [];
    for (let i = 0; i < n; i++) {
      verts.push({
        angle: (i / n) * Math.PI * 2,
        rMul: rand(0.8, 1.28),
        phase: rand(0, Math.PI * 2),
      });
    }
    return verts;
  }

  function spawnBoss(def) {
    const sectorDef = SECTOR_DEFS.find((s) => s.sector === def.sector);
    const angle = rand(0, Math.PI * 2);
    const d = rand(sectorDef.bandMin, sectorDef.bandMax);
    const x = clamp(STATION.x + Math.cos(angle) * d, 200, WORLD_W - 200);
    const y = clamp(STATION.y + Math.sin(angle) * d, 200, WORLD_H - 200);
    return {
      ...def,
      x, y,
      anchor: { x, y },
      hpMax: def.hp,
      alive: true,
      respawnTimer: 0,
      defeatedOnce: false,
      wanderTarget: { x, y },
      wanderTimer: rand(2, 5),
      fireTimer: rand(0.5, def.fireRate || 1.5),
      facing: 0,
      aggroed: false,
      spawnFlash: 1.4,
      bodyVerts: makeMonsterBody(),
    };
  }

  const state = {
    ship: {
      x: STATION.x, y: STATION.y - 140,
      vx: 0, vy: 0, angle: -Math.PI / 2,
      thrusting: false,
      fireCooldown: 0,
    },
    planets: makePlanets(),
    asteroids: makeAsteroids(),
    bosses: makeBosses(),
    bullets: [],
    bossBullets: [],
    farStars: makeStars(320, WORLD_W, WORLD_H),
    nearStars: makeStars(200, WORLD_W, WORLD_H),
    credits: 0,
    cargo: { iron: 0, gold: 0, crystal: 0 },
    fuel: 0,
    hull: 0,
    levels: { cargo: 0, fuel: 0, engine: 0, mining: 0, hull: 0, weapon: 0 },
    mining: null,
    docked: false,
    gameOver: false,
    keys: {},
    camera: { x: 0, y: 0 },
    invuln: 2,
    toastTimer: 0,
    shake: 0,
    hitFlash: 0,
    muted: false,
  };

  function addShake(amount) {
    state.shake = Math.min(36, state.shake + amount);
  }

  function maxFuel() { return 100 + state.levels.fuel * UPGRADES.fuel.step; }
  function maxHull() { return 100 + state.levels.hull * UPGRADES.hull.step; }
  function maxCargo() { return 50 + state.levels.cargo * UPGRADES.cargo.step; }
  function thrustPower() { return 220 + state.levels.engine * 55; }
  function turnSpeed() { return 3.4; }
  function miningRate() { return 8 + state.levels.mining * 5; }
  function weaponDamage() { return 14 + state.levels.weapon * 6; }

  function cargoTotal() {
    return state.cargo.iron + state.cargo.gold + state.cargo.crystal;
  }

  function resetShip() {
    state.fuel = maxFuel();
    state.hull = maxHull();
  }

  function upgradeCost(key) {
    const u = UPGRADES[key];
    const lvl = state.levels[key];
    return Math.round(u.base * Math.pow(u.growth, lvl));
  }

  // ---- sound (synthesized via Web Audio API, no asset files needed) ----
  let audioCtx = null;
  let engineOsc = null;
  let engineGain = null;
  let miningOsc = null;
  let miningGain = null;

  function setupAudio() {
    if (audioCtx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    audioCtx = new Ctor();

    engineOsc = audioCtx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 65;
    const engineFilter = audioCtx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 240;
    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(audioCtx.destination);
    engineOsc.start();

    miningOsc = audioCtx.createOscillator();
    miningOsc.type = 'triangle';
    miningOsc.frequency.value = 210;
    miningGain = audioCtx.createGain();
    miningGain.gain.value = 0;
    miningOsc.connect(miningGain).connect(audioCtx.destination);
    miningOsc.start();
  }

  function unlockAudio() {
    setupAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function toggleMute() {
    state.muted = !state.muted;
    muteBtn.textContent = state.muted ? '🔇' : '🔊';
    unlockAudio();
  }

  function playTone({ freq = 440, duration = 0.15, type = 'sine', startFreq, endFreq, volume = 0.18, attack = 0.005 }) {
    if (state.muted || !audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    if (startFreq != null && endFreq != null) {
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
    } else {
      osc.frequency.setValueAtTime(freq, now);
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  function playNoise({ duration = 0.2, volume = 0.2, filterFreq = 1200 }) {
    if (state.muted || !audioCtx) return;
    const now = audioCtx.currentTime;
    const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(filter).connect(gain).connect(audioCtx.destination);
    noise.start(now);
    noise.stop(now + duration + 0.05);
  }

  function playSequence(notes, { gap = 0.09, duration = 0.14, volume = 0.15, type = 'sine' } = {}) {
    if (state.muted || !audioCtx) return;
    const now = audioCtx.currentTime;
    notes.forEach((freq, i) => {
      const startAt = now + i * gap;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startAt);
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(volume, startAt + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.05);
    });
  }

  function sfxLaser() { playTone({ type: 'sawtooth', startFreq: 880, endFreq: 180, duration: 0.1, volume: 0.1 }); }
  function sfxLaserHit() { playTone({ type: 'square', freq: 1200, duration: 0.045, volume: 0.05 }); }
  function sfxHit() { playNoise({ duration: 0.18, volume: 0.22, filterFreq: 900 }); }
  function sfxDock() { playSequence([523.25, 659.25], { volume: 0.14 }); }
  function sfxUndock() { playSequence([659.25, 523.25], { volume: 0.12 }); }
  function sfxUpgrade() { playSequence([659.25, 880, 1046.5], { gap: 0.08, volume: 0.15 }); }
  function sfxBossAggro() { playTone({ type: 'sawtooth', startFreq: 160, endFreq: 45, duration: 0.5, volume: 0.14 }); }
  function sfxBossDefeat() { playSequence([440, 550, 660, 880], { gap: 0.1, duration: 0.22, volume: 0.17 }); }
  function sfxGameOver() { playSequence([392, 349.23, 293.66, 220], { gap: 0.18, duration: 0.35, volume: 0.16, type: 'triangle' }); }

  function updateLoopSounds() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    if (engineGain) {
      const target = !state.muted && state.ship.thrusting && !state.docked ? 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, now, 0.06);
    }
    if (miningGain) {
      const target = !state.muted && state.mining ? 0.05 : 0;
      miningGain.gain.setTargetAtTime(target, now, 0.06);
    }
  }

  function init() {
    resetShip();
    bindInput();
    buildUpgradePanel();
    requestAnimationFrame(loop);
  }

  function bindInput() {
    window.addEventListener('keydown', (e) => {
      unlockAudio();
      state.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyF'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      state.keys[e.code] = false;
    });
    sellBtn.addEventListener('click', sellCargo);
    closeDockBtn.addEventListener('click', undock);
    muteBtn.addEventListener('click', toggleMute);
  }

  function buildUpgradePanel() {
    upgradeListEl.innerHTML = '';
    Object.keys(UPGRADES).forEach((key) => {
      const row = document.createElement('div');
      row.className = 'upgrade-row';
      const info = document.createElement('div');
      info.className = 'info';
      const u = UPGRADES[key];
      info.innerHTML = `<b>${u.label}</b><small id="lvl-${key}"></small>`;
      const btn = document.createElement('button');
      btn.id = `btn-${key}`;
      btn.addEventListener('click', () => buyUpgrade(key));
      row.appendChild(info);
      row.appendChild(btn);
      upgradeListEl.appendChild(row);
    });
    refreshUpgradePanel();
  }

  function refreshUpgradePanel() {
    Object.keys(UPGRADES).forEach((key) => {
      const u = UPGRADES[key];
      const lvl = state.levels[key];
      const lvlEl = document.getElementById(`lvl-${key}`);
      const btn = document.getElementById(`btn-${key}`);
      if (lvl >= u.max) {
        lvlEl.textContent = `레벨 ${lvl} (최대)`;
        btn.textContent = '최대';
        btn.disabled = true;
      } else {
        const cost = upgradeCost(key);
        lvlEl.textContent = `레벨 ${lvl} → ${lvl + 1}`;
        btn.textContent = `${cost} 크레딧`;
        btn.disabled = state.credits < cost;
      }
    });
    dockCreditsEl.textContent = `${state.credits} 크레딧`;
  }

  function buyUpgrade(key) {
    const u = UPGRADES[key];
    const lvl = state.levels[key];
    if (lvl >= u.max) return;
    const cost = upgradeCost(key);
    if (state.credits < cost) return;
    state.credits -= cost;
    state.levels[key]++;
    sfxUpgrade();
    refreshUpgradePanel();
  }

  function sellCargo() {
    let total = 0;
    Object.keys(state.cargo).forEach((k) => {
      total += state.cargo[k] * RESOURCE_TYPES[k].price;
      state.cargo[k] = 0;
    });
    state.credits += Math.round(total);
    refreshUpgradePanel();
  }

  function dock() {
    state.docked = true;
    state.ship.vx = 0;
    state.ship.vy = 0;
    state.fuel = maxFuel();
    state.hull = maxHull();
    dockPanel.classList.remove('hidden');
    refreshUpgradePanel();
    sfxDock();
  }

  function undock() {
    state.docked = false;
    dockPanel.classList.add('hidden');
    sfxUndock();
  }

  function showMessage(html) {
    messageEl.innerHTML = html;
    messageEl.classList.remove('hidden');
  }

  function hideMessage() {
    messageEl.classList.add('hidden');
  }

  function restart() {
    state.ship.x = STATION.x;
    state.ship.y = STATION.y - 140;
    state.ship.vx = 0;
    state.ship.vy = 0;
    state.ship.angle = -Math.PI / 2;
    state.credits = 0;
    state.cargo = { iron: 0, gold: 0, crystal: 0 };
    state.levels = { cargo: 0, fuel: 0, engine: 0, mining: 0, hull: 0, weapon: 0 };
    state.planets = makePlanets();
    state.asteroids = makeAsteroids();
    state.bosses = makeBosses();
    state.bullets = [];
    state.bossBullets = [];
    state.gameOver = false;
    state.mining = null;
    state.invuln = 2;
    state.toastTimer = 0;
    resetShip();
    hideMessage();
    toastEl.classList.add('hidden');
    bossBar.classList.add('hidden');
  }

  let lastTime = performance.now();

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (!state.gameOver) {
      update(dt);
    }
    render();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    if (state.invuln > 0) state.invuln -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 50);
    if (state.hitFlash > 0) state.hitFlash = Math.max(0, state.hitFlash - dt);
    const ship = state.ship;
    const keys = state.keys;

    if (!state.docked) {
      const turning = (keys['ArrowLeft'] || keys['KeyA'] ? -1 : 0) + (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0);
      ship.angle += turning * turnSpeed() * dt;

      const wantsThrust = (keys['ArrowUp'] || keys['KeyW']) && state.fuel > 0;
      ship.thrusting = wantsThrust;
      if (wantsThrust) {
        ship.vx += Math.cos(ship.angle) * thrustPower() * dt;
        ship.vy += Math.sin(ship.angle) * thrustPower() * dt;
        state.fuel = Math.max(0, state.fuel - FUEL_BURN_RATE * dt);
      }

      // slight drag so the game stays controllable
      ship.vx -= ship.vx * SHIP_DRAG * dt;
      ship.vy -= ship.vy * SHIP_DRAG * dt;

      const speed = Math.hypot(ship.vx, ship.vy);
      const maxSpeed = 340;
      if (speed > maxSpeed) {
        ship.vx = (ship.vx / speed) * maxSpeed;
        ship.vy = (ship.vy / speed) * maxSpeed;
      }

      ship.x = clamp(ship.x + ship.vx * dt, 0, WORLD_W);
      ship.y = clamp(ship.y + ship.vy * dt, 0, WORLD_H);

      if (ship.fireCooldown > 0) ship.fireCooldown -= dt;
      if (keys['KeyF'] && ship.fireCooldown <= 0) {
        fireBullet();
        ship.fireCooldown = FIRE_COOLDOWN;
      }

      updateMining(dt);
      updateAsteroids(dt);
    }

    updateBullets(dt);
    updateBosses(dt);
    updatePlanetRegen(dt);
    updateSectorHud(dt);
    updateBossHud();
    updateLoopSounds();

    if (keys['Space'] || keys['KeyE']) {
      if (!state.docked && dist(ship.x, ship.y, STATION.x, STATION.y) < STATION.radius + 40) {
        dock();
      }
    }

    state.camera.x = clamp(ship.x - canvas.width / 2, 0, WORLD_W - canvas.width);
    state.camera.y = clamp(ship.y - canvas.height / 2, 0, WORLD_H - canvas.height);

    updateHud();
  }

  function updatePlanetRegen(dt) {
    state.planets.forEach((p) => {
      if (p.amount < p.maxAmount) {
        p.regenTimer += dt;
        if (p.regenTimer > 0.4) {
          p.regenTimer = 0;
          p.amount = Math.min(p.maxAmount, p.amount + p.maxAmount * 0.01);
        }
      }
    });
  }

  function updateMining(dt) {
    const ship = state.ship;
    const keys = state.keys;
    const wantsMine = keys['Space'] || keys['KeyE'];

    if (!wantsMine) {
      state.mining = null;
      mineProgressWrap.classList.add('hidden');
      return;
    }

    const speed = Math.hypot(ship.vx, ship.vy);
    let target = null;
    for (const p of state.planets) {
      const d = dist(ship.x, ship.y, p.x, p.y);
      if (d < p.radius + 55) { target = p; break; }
    }

    if (!target || speed > 60 || target.amount <= 0) {
      state.mining = null;
      mineProgressWrap.classList.add('hidden');
      return;
    }

    if (cargoTotal() >= maxCargo()) {
      state.mining = null;
      mineProgressWrap.classList.add('hidden');
      showMiningFullHint();
      return;
    }

    state.mining = target;
    mineProgressWrap.classList.remove('hidden');
    const rate = miningRate() * dt;
    const room = maxCargo() - cargoTotal();
    const extracted = Math.min(rate, target.amount, room);
    target.amount -= extracted;
    state.cargo[target.type] += extracted;

    mineProgressFill.style.width = `${clamp((cargoTotal() / maxCargo()) * 100, 0, 100)}%`;
  }

  function showMiningFullHint() {
    mineProgressWrap.classList.add('hidden');
  }

  function updateAsteroids(dt) {
    state.asteroids.forEach((a) => {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.spin * dt;
      if (a.x < 0 || a.x > WORLD_W) a.vx *= -1;
      if (a.y < 0 || a.y > WORLD_H) a.vy *= -1;
      a.x = clamp(a.x, 0, WORLD_W);
      a.y = clamp(a.y, 0, WORLD_H);
    });

    if (state.invuln > 0) return;
    const ship = state.ship;
    for (const a of state.asteroids) {
      const d = dist(ship.x, ship.y, a.x, a.y);
      if (d < a.radius + 12) {
        applyShipDamage(18);
        const angle = Math.atan2(ship.y - a.y, ship.x - a.x);
        ship.vx += Math.cos(angle) * 180;
        ship.vy += Math.sin(angle) * 180;
        break;
      }
    }
  }

  function triggerGameOver() {
    state.gameOver = true;
    sfxGameOver();
    showMessage(`
      <div>선체가 파괴되었습니다.</div>
      <div style="margin-top:6px;color:#ffe08a;">최종 크레딧: ${state.credits}</div>
      <button id="restartBtn">다시 시작</button>
    `);
    document.getElementById('restartBtn').addEventListener('click', restart);
  }

  function fireBullet() {
    const ship = state.ship;
    const nose = 18;
    state.bullets.push({
      x: ship.x + Math.cos(ship.angle) * nose,
      y: ship.y + Math.sin(ship.angle) * nose,
      vx: Math.cos(ship.angle) * BULLET_SPEED,
      vy: Math.sin(ship.angle) * BULLET_SPEED,
      life: BULLET_LIFE,
      damage: weaponDamage(),
    });
    sfxLaser();
  }

  function updateBullets(dt) {
    state.bullets = state.bullets.filter((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) return false;
      for (const boss of state.bosses) {
        if (!boss.alive) continue;
        if (dist(b.x, b.y, boss.x, boss.y) < boss.hitRadius) {
          boss.hp -= b.damage;
          if (boss.hp <= 0) defeatBoss(boss);
          else sfxLaserHit();
          return false;
        }
      }
      return true;
    });

    const ship = state.ship;
    state.bossBullets = state.bossBullets.filter((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) return false;
      if (state.invuln <= 0 && dist(b.x, b.y, ship.x, ship.y) < 16) {
        applyShipDamage(b.damage);
        return false;
      }
      return true;
    });
  }

  function applyShipDamage(dmg) {
    state.hull = Math.max(0, state.hull - dmg);
    state.invuln = 1.2;
    addShake(dmg * 0.8);
    state.hitFlash = 0.35;
    sfxHit();
    if (state.hull <= 0) {
      triggerGameOver();
    }
  }

  function updateBosses(dt) {
    const ship = state.ship;
    state.bosses.forEach((boss) => {
      if (!boss.alive) {
        boss.respawnTimer -= dt;
        if (boss.respawnTimer <= 0) {
          Object.assign(boss, spawnBoss(BOSS_DEFS.find((d) => d.id === boss.id)));
        }
        return;
      }

      if (boss.spawnFlash > 0) boss.spawnFlash = Math.max(0, boss.spawnFlash - dt);

      const distToShip = dist(ship.x, ship.y, boss.x, boss.y);
      const aggro = distToShip < boss.aggroRange && !state.docked;
      if (aggro && !boss.aggroed) {
        addShake(6);
        sfxBossAggro();
      }
      boss.aggroed = aggro;

      let targetX, targetY;
      if (aggro) {
        targetX = ship.x;
        targetY = ship.y;
      } else {
        boss.wanderTimer -= dt;
        if (boss.wanderTimer <= 0) {
          boss.wanderTarget = {
            x: boss.anchor.x + rand(-300, 300),
            y: boss.anchor.y + rand(-300, 300),
          };
          boss.wanderTimer = rand(3, 6);
        }
        targetX = boss.wanderTarget.x;
        targetY = boss.wanderTarget.y;
      }

      const dx = targetX - boss.x;
      const dy = targetY - boss.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        boss.x += (dx / d) * boss.speed * dt;
        boss.y += (dy / d) * boss.speed * dt;
        boss.facing = Math.atan2(dy, dx);
      }
      boss.x = clamp(boss.x, 150, WORLD_W - 150);
      boss.y = clamp(boss.y, 150, WORLD_H - 150);

      if (aggro && boss.canShoot) {
        boss.fireTimer -= dt;
        if (boss.fireTimer <= 0) {
          const angle = Math.atan2(ship.y - boss.y, ship.x - boss.x);
          state.bossBullets.push({
            x: boss.x + Math.cos(angle) * boss.radius,
            y: boss.y + Math.sin(angle) * boss.radius,
            vx: Math.cos(angle) * boss.projectileSpeed,
            vy: Math.sin(angle) * boss.projectileSpeed,
            life: 3,
            damage: boss.projectileDamage,
          });
          boss.fireTimer = boss.fireRate;
        }
      }

      if (!state.docked && state.invuln <= 0 && distToShip < boss.hitRadius * 0.55 + 16) {
        applyShipDamage(boss.contactDamage);
        const angle = Math.atan2(ship.y - boss.y, ship.x - boss.x);
        ship.vx += Math.cos(angle) * 220;
        ship.vy += Math.sin(angle) * 220;
      }
    });
  }

  function defeatBoss(boss) {
    boss.alive = false;
    boss.respawnTimer = boss.respawnTime;
    state.credits += boss.reward;
    addShake(10 + boss.sector * 6);
    sfxBossDefeat();
    if (boss.sector === 3 && !boss.defeatedOnce) {
      showToast(`최종 보스 '${boss.name}'를 물리쳤습니다! 우주가 잠시 평화를 되찾았습니다. (+${boss.reward} 크레딧)`, 5000);
    } else {
      showToast(`${boss.tag} '${boss.name}' 격파! +${boss.reward} 크레딧`, 3500);
    }
    boss.defeatedOnce = true;
    refreshUpgradePanel();
  }

  function showToast(text, ms) {
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    toastEl.classList.remove('fade');
    state.toastTimer = ms / 1000;
  }

  function sectorAt(d) {
    if (d < 600) return 0;
    if (d < 1800) return 1;
    if (d < 2600) return 2;
    return 3;
  }

  function updateSectorHud(dt) {
    const d = dist(state.ship.x, state.ship.y, STATION.x, STATION.y);
    const sector = sectorAt(d);
    if (sector === 0) {
      sectorLabelEl.textContent = '구역: 안전지대';
    } else {
      const def = BOSS_DEFS.find((b) => b.sector === sector);
      sectorLabelEl.textContent = `구역: ${sector}섹터 · ${def.name}의 영역`;
    }

    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) {
        toastEl.classList.add('fade');
      }
    }
  }

  function updateBossHud() {
    const ship = state.ship;
    let nearest = null;
    let nearestDist = Infinity;
    state.bosses.forEach((boss) => {
      if (!boss.alive) return;
      const d = dist(ship.x, ship.y, boss.x, boss.y);
      if (d < boss.aggroRange && d < nearestDist) {
        nearest = boss;
        nearestDist = d;
      }
    });

    if (!nearest) {
      bossBar.classList.add('hidden');
      return;
    }
    bossBar.classList.remove('hidden');
    bossNameEl.textContent = nearest.name;
    bossTagEl.textContent = nearest.tag;
    bossHpFill.style.width = `${clamp((nearest.hp / nearest.hpMax) * 100, 0, 100)}%`;
  }

  function updateHud() {
    fuelBar.style.width = `${(state.fuel / maxFuel()) * 100}%`;
    hullBar.style.width = `${(state.hull / maxHull()) * 100}%`;
    cargoBar.style.width = `${(cargoTotal() / maxCargo()) * 100}%`;
    cargoText.textContent = `${Math.floor(cargoTotal())} / ${maxCargo()}`;
    creditsText.textContent = state.credits;
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cam = state.camera;
    const shakeX = state.shake > 0 ? rand(-state.shake, state.shake) : 0;
    const shakeY = state.shake > 0 ? rand(-state.shake, state.shake) : 0;

    drawStars(state.farStars, 0.4);
    drawStars(state.nearStars, 0.7);

    ctx.save();
    ctx.translate(-cam.x + shakeX, -cam.y + shakeY);

    drawStation();
    state.planets.forEach(drawPlanet);
    state.asteroids.forEach(drawAsteroid);
    state.bosses.forEach(drawBoss);
    state.bossBullets.forEach(drawBossBullet);
    drawShip();
    state.bullets.forEach(drawPlayerBullet);

    ctx.restore();

    if (state.hitFlash > 0) {
      ctx.save();
      const grad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.25,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.75
      );
      const a = clamp(state.hitFlash / 0.35, 0, 1) * 0.55;
      grad.addColorStop(0, 'rgba(255,30,50,0)');
      grad.addColorStop(1, `rgba(255,30,50,${a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    drawMinimap();
  }

  function drawStars(stars, parallax) {
    const cam = state.camera;
    ctx.save();
    stars.forEach((s) => {
      const sx = (s.x - cam.x * parallax) % canvas.width;
      const sy = (s.y - cam.y * parallax) % canvas.height;
      const x = sx < 0 ? sx + canvas.width : sx;
      const y = sy < 0 ? sy + canvas.height : sy;
      ctx.fillStyle = `rgba(255,255,255,${s.b})`;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawStation() {
    const t = performance.now() / 1000;
    const hubR = STATION.radius * 0.55;
    const ringR = STATION.radius + 46;
    const rotation = t * 0.15;

    ctx.save();
    ctx.translate(STATION.x, STATION.y);

    const grad = ctx.createRadialGradient(0, 0, hubR * 0.4, 0, 0, ringR + 44);
    grad.addColorStop(0, 'rgba(120,180,255,0.3)');
    grad.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, ringR + 44, 0, Math.PI * 2);
    ctx.fill();

    // solar panel arrays on two opposite struts
    const drawPanel = (angle, distance) => {
      ctx.save();
      ctx.rotate(angle);
      ctx.translate(distance, 0);
      ctx.fillStyle = '#122c58';
      ctx.fillRect(-4, -24, 8, 48);
      ctx.strokeStyle = '#4a75e0';
      ctx.lineWidth = 1;
      for (let k = -3; k <= 3; k++) {
        ctx.beginPath();
        ctx.moveTo(-4, k * 7);
        ctx.lineTo(4, k * 7);
        ctx.stroke();
      }
      ctx.strokeStyle = '#7fb2ff';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(-4, -24, 8, 48);
      ctx.restore();
    };
    drawPanel(Math.PI * 0.25, hubR * 1.55);
    drawPanel(Math.PI * 1.25, hubR * 1.55);

    // rigid struts connecting hub to the outer ring
    const strutCount = 4;
    ctx.strokeStyle = '#3b4d85';
    ctx.lineWidth = 6;
    for (let i = 0; i < strutCount; i++) {
      const a = (i / strutCount) * Math.PI * 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * hubR, Math.sin(a) * hubR);
      ctx.lineTo(Math.cos(a) * (ringR - 8), Math.sin(a) * (ringR - 8));
      ctx.stroke();
    }

    // rotating outer habitat ring with segment dividers and beacon lights
    ctx.strokeStyle = '#26325c';
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#7fb2ff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, ringR - 7.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, ringR + 7.5, 0, Math.PI * 2);
    ctx.stroke();

    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const a = rotation + (i / segments) * Math.PI * 2;
      ctx.strokeStyle = 'rgba(6,9,20,0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (ringR - 7.5), Math.sin(a) * (ringR - 7.5));
      ctx.lineTo(Math.cos(a) * (ringR + 7.5), Math.sin(a) * (ringR + 7.5));
      ctx.stroke();

      if (i % 4 === 0) {
        const blink = Math.sin(t * 2.4 + i) > 0.5;
        ctx.fillStyle = blink ? '#ffdd6a' : 'rgba(255,221,106,0.2)';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * ringR, Math.sin(a) * ringR, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // central hub with lit windows
    ctx.fillStyle = '#1c2a55';
    ctx.beginPath();
    ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9fd4ff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const wx = Math.cos(a) * hubR * 0.6;
      const wy = Math.sin(a) * hubR * 0.6;
      const glow = 0.45 + 0.4 * Math.abs(Math.sin(t * 1.1 + i * 1.7));
      ctx.fillStyle = `rgba(255,224,140,${glow})`;
      ctx.fillRect(wx - 2, wy - 2, 4, 4);
    }

    // pulsing docking-pad glow at the hub center
    const dockPulse = 0.5 + 0.5 * Math.sin(t * 2);
    ctx.fillStyle = `rgba(159,212,255,${0.1 + 0.08 * dockPulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, hubR * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(159,212,255,${0.45 + 0.3 * dockPulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, hubR * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#d7e6ff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('정거장', 0, ringR + 24);
    ctx.restore();
  }

  function drawPlanet(p) {
    const info = RESOURCE_TYPES[p.type];
    const depleted = p.amount <= 0.5;
    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.type === 'crystal' && !depleted) {
      const glowR = p.radius * 2.1;
      const glow = ctx.createRadialGradient(0, 0, p.radius * 0.3, 0, 0, glowR);
      glow.addColorStop(0, 'rgba(126,247,224,0.28)');
      glow.addColorStop(1, 'rgba(126,247,224,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.type === 'iron') drawIronDeposit(p, depleted);
    else if (p.type === 'gold') drawGoldDeposit(p, depleted);
    else drawCrystalDeposit(p, depleted);

    // resource gauge ring
    const pct = p.amount / p.maxAmount;
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 10, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#cfd8f5';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(info.name, 0, p.radius + 26);
    ctx.restore();
  }

  function drawIronDeposit(p, depleted) {
    ctx.beginPath();
    p.detail.verts.forEach((v, i) => {
      const x = Math.cos(v.angle) * v.r;
      const y = Math.sin(v.angle) * v.r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    const grad = ctx.createLinearGradient(-p.radius, -p.radius, p.radius, p.radius);
    if (depleted) {
      grad.addColorStop(0, '#3a3f4d');
      grad.addColorStop(1, '#20232b');
    } else {
      grad.addColorStop(0, '#eef2fa');
      grad.addColorStop(0.45, '#9aa4bd');
      grad.addColorStop(1, '#454c60');
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = depleted ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (!depleted) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-p.radius * 0.35, -p.radius * 0.55);
      ctx.lineTo(p.radius * 0.05, -p.radius * 0.05);
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(p.radius * 0.15, p.radius * 0.1);
      ctx.lineTo(p.radius * 0.4, p.radius * 0.35);
      ctx.stroke();
    }
  }

  function drawGoldDeposit(p, depleted) {
    p.detail.blobs.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r);
      if (depleted) {
        grad.addColorStop(0, '#4a4536');
        grad.addColorStop(1, '#28261e');
      } else {
        grad.addColorStop(0, '#fff8dc');
        grad.addColorStop(0.45, '#ffd24a');
        grad.addColorStop(1, '#9c690c');
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = depleted ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    if (!depleted) {
      const t = performance.now() / 1000;
      const glint = 0.35 + 0.55 * Math.abs(Math.sin(t * 2.3));
      ctx.fillStyle = `rgba(255,255,255,${glint})`;
      ctx.beginPath();
      ctx.arc(-p.radius * 0.18, -p.radius * 0.22, p.radius * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCrystalDeposit(p, depleted) {
    const n = p.detail.facetCount;
    const rot = p.detail.rotOffset;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      const r = p.radius * (i % 2 === 0 ? 1 : 0.62);
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 1.15 });
    }
    ctx.beginPath();
    pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.closePath();

    const info = RESOURCE_TYPES.crystal;
    const grad = ctx.createLinearGradient(0, -p.radius * 1.15, 0, p.radius * 1.15);
    if (depleted) {
      grad.addColorStop(0, '#2c3a38');
      grad.addColorStop(1, '#161e1c');
    } else {
      grad.addColorStop(0, '#eafffa');
      grad.addColorStop(0.45, info.color);
      grad.addColorStop(1, '#0d5c4c');
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = depleted ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    if (!depleted) {
      // internal facet lines for a cut-gem look
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      pts.forEach((pt, i) => {
        if (i % 2 === 0) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
        }
      });

      const t = performance.now() / 1000;
      p.detail.sparkles.forEach((s) => {
        const tw = Math.max(0, Math.sin(t * 1.8 + s.phase));
        if (tw < 0.6) return;
        const sx = Math.cos(s.angle) * p.radius * s.dist;
        const sy = Math.sin(s.angle) * p.radius * s.dist;
        const size = 3 + tw * 3;
        ctx.strokeStyle = `rgba(255,255,255,${tw})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sx - size, sy);
        ctx.lineTo(sx + size, sy);
        ctx.moveTo(sx, sy - size);
        ctx.lineTo(sx, sy + size);
        ctx.stroke();
      });
    }
  }

  function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.fillStyle = '#8a7f74';
    ctx.strokeStyle = '#54493f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    a.verts.forEach(([vx, vy], i) => {
      if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawBlobPath(points) {
    const n = points.length;
    const p0 = points[n - 1];
    const p1 = points[0];
    ctx.beginPath();
    ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
    ctx.closePath();
  }

  function drawBoss(boss) {
    if (!boss.alive) return;
    const t = performance.now() / 1000;
    const windup = boss.canShoot && boss.aggroed && boss.fireTimer < 0.35;
    const strobe = Math.sin(performance.now() / 45) > 0;
    ctx.save();
    ctx.translate(boss.x, boss.y);

    // far, low dread aura -- makes the creature loom even from a distance
    const dreadR = boss.radius * 2.6;
    const dreadGrad = ctx.createRadialGradient(0, 0, boss.radius * 0.6, 0, 0, dreadR);
    dreadGrad.addColorStop(0, boss.glow);
    dreadGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = dreadGrad;
    ctx.beginPath();
    ctx.arc(0, 0, dreadR, 0, Math.PI * 2);
    ctx.fill();

    if (boss.spawnFlash > 0) {
      const p = 1 - boss.spawnFlash / 1.4;
      ctx.strokeStyle = boss.color;
      ctx.globalAlpha = 1 - p;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, boss.radius * (0.5 + p * 2.2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const baseR = boss.radius * 0.72;
    const tentCount = 7 + boss.sector * 3;
    for (let i = 0; i < tentCount; i++) {
      const baseAngle = (i / tentCount) * Math.PI * 2;
      const wig = Math.sin(t * (1.3 + boss.sector * 0.2) + i * 1.7) * 0.45;
      const len = boss.radius * (1.0 + 0.35 * Math.sin(t * 0.9 + i * 1.3));
      const sx = Math.cos(baseAngle) * baseR * 0.9;
      const sy = Math.sin(baseAngle) * baseR * 0.9;
      const mx = Math.cos(baseAngle + wig) * (baseR + len * 0.6);
      const my = Math.sin(baseAngle + wig) * (baseR + len * 0.6);
      const ex = Math.cos(baseAngle + wig * 1.7) * (baseR + len);
      const ey = Math.sin(baseAngle + wig * 1.7) * (baseR + len);
      const tGrad = ctx.createLinearGradient(sx, sy, ex, ey);
      tGrad.addColorStop(0, boss.core);
      tGrad.addColorStop(1, boss.color);
      ctx.strokeStyle = tGrad;
      ctx.lineWidth = Math.max(3, boss.radius * 0.05) * (1 - (i % 3) * 0.15);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
    }

    // organic, breathing body silhouette
    const bodyPoints = boss.bodyVerts.map((v) => {
      const r = baseR * v.rMul * (1 + 0.045 * Math.sin(t * 0.8 + v.phase));
      return { x: Math.cos(v.angle) * r, y: Math.sin(v.angle) * r };
    });
    drawBlobPath(bodyPoints);
    ctx.fillStyle = boss.core;
    ctx.fill();
    ctx.strokeStyle = boss.color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // pulsing veins/cracks running through the body
    ctx.strokeStyle = boss.color;
    boss.bodyVerts.forEach((v, i) => {
      if (i % 2 !== 0) return;
      const glowPulse = 0.25 + 0.35 * Math.abs(Math.sin(t * 1.6 + v.phase));
      ctx.globalAlpha = glowPulse;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(v.angle) * baseR * 0.85, Math.sin(v.angle) * baseR * 0.85);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    const fx = Math.cos(boss.facing);
    const fy = Math.sin(boss.facing);
    const perpx = -fy;
    const perpy = fx;

    // gaping maw with jagged teeth, facing the direction of travel/attack
    const mouthDist = baseR * 0.8;
    const mouthOpen = 0.35 + (boss.aggroed ? 0.3 : 0) + 0.06 * Math.sin(t * 5);
    const mx0 = fx * mouthDist;
    const my0 = fy * mouthDist;
    ctx.fillStyle = '#0a0002';
    ctx.beginPath();
    ctx.arc(mx0, my0, baseR * 0.32, boss.facing - mouthOpen, boss.facing + mouthOpen);
    ctx.arc(mx0, my0, baseR * 0.08, boss.facing + mouthOpen, boss.facing - mouthOpen, true);
    ctx.closePath();
    ctx.fill();
    const teeth = 5;
    ctx.fillStyle = '#e9e2d4';
    for (let i = 0; i <= teeth; i++) {
      const ta = boss.facing - mouthOpen + (i / teeth) * mouthOpen * 2;
      const tipX = mx0 + Math.cos(ta) * baseR * 0.32;
      const tipY = my0 + Math.sin(ta) * baseR * 0.32;
      const baseX1 = mx0 + Math.cos(ta - 0.05) * baseR * 0.14;
      const baseY1 = my0 + Math.sin(ta - 0.05) * baseR * 0.14;
      const baseX2 = mx0 + Math.cos(ta + 0.05) * baseR * 0.14;
      const baseY2 = my0 + Math.sin(ta + 0.05) * baseR * 0.14;
      ctx.beginPath();
      ctx.moveTo(baseX1, baseY1);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(baseX2, baseY2);
      ctx.closePath();
      ctx.fill();
    }

    // multiple glowing eyes clustered toward the face -- more eyes on tougher bosses
    const eyeCount = boss.eyeCount || 2;
    const spread = Math.PI * 0.85;
    for (let i = 0; i < eyeCount; i++) {
      const tt = eyeCount > 1 ? i / (eyeCount - 1) : 0.5;
      const eyeAngle = boss.facing - spread / 2 + tt * spread;
      const eyeDist = baseR * (0.5 + (i % 2) * 0.12);
      const ex2 = Math.cos(eyeAngle) * eyeDist;
      const ey2 = Math.sin(eyeAngle) * eyeDist;
      const eyeSize = boss.radius * (0.07 + (i % 2) * 0.02);

      ctx.fillStyle = windup && strobe ? '#ffffff' : boss.color;
      ctx.shadowColor = boss.color;
      ctx.shadowBlur = windup ? 18 : 8;
      ctx.beginPath();
      ctx.arc(ex2, ey2, eyeSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(ex2 + fx * eyeSize * 0.3, ey2 + fy * eyeSize * 0.3, eyeSize * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(13, boss.radius * 0.1)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
    ctx.fillText(boss.name, 0, -boss.radius * 1.95);
    ctx.font = `${Math.max(10, boss.radius * 0.07)}px sans-serif`;
    ctx.fillStyle = boss.color;
    ctx.fillText(boss.tag, 0, -boss.radius * 1.95 + 16);
    ctx.shadowBlur = 0;

    const barW = boss.radius * 1.7;
    const barH = 7;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-barW / 2, -boss.radius * 1.65, barW, barH);
    ctx.fillStyle = boss.color;
    ctx.fillRect(-barW / 2, -boss.radius * 1.65, barW * clamp(boss.hp / boss.hpMax, 0, 1), barH);

    ctx.restore();
  }

  function drawPlayerBullet(b) {
    ctx.save();
    ctx.fillStyle = '#8be9ff';
    ctx.shadowColor = '#8be9ff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBossBullet(b) {
    ctx.save();
    ctx.fillStyle = '#ff8a5b';
    ctx.shadowColor = '#ff8a5b';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShip() {
    const ship = state.ship;
    const t = performance.now() / 1000;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    if (state.invuln > 0 && Math.floor(state.invuln * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // engine exhaust -- idle blue flicker at rest, hot flare under thrust
    const flareLen = ship.thrusting ? rand(16, 26) : 5 + Math.sin(t * 6) * 1.5;
    const flareGrad = ctx.createLinearGradient(-17, 0, -17 - flareLen, 0);
    flareGrad.addColorStop(0, ship.thrusting ? '#fff3c4' : '#bfe8ff');
    flareGrad.addColorStop(0.5, ship.thrusting ? '#ff9d3d' : '#4ab5ff');
    flareGrad.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = flareGrad;
    [-5.5, 5.5].forEach((oy) => {
      ctx.beginPath();
      ctx.moveTo(-16, oy - 2.2);
      ctx.lineTo(-16 - flareLen, oy + rand(-1, 1));
      ctx.lineTo(-16, oy + 2.2);
      ctx.closePath();
      ctx.fill();
    });

    // delta-wing fighter hull
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.quadraticCurveTo(14, -3, 6, -4.5);
    ctx.lineTo(-4, -15.5);
    ctx.lineTo(-13, -11.5);
    ctx.lineTo(-8, -4.5);
    ctx.lineTo(-17, -5.5);
    ctx.lineTo(-17, 5.5);
    ctx.lineTo(-8, 4.5);
    ctx.lineTo(-13, 11.5);
    ctx.lineTo(-4, 15.5);
    ctx.lineTo(6, 4.5);
    ctx.quadraticCurveTo(14, 3, 22, 0);
    ctx.closePath();

    const hullGrad = ctx.createLinearGradient(22, 0, -17, 0);
    hullGrad.addColorStop(0, '#eef4ff');
    hullGrad.addColorStop(0.45, '#a9c3ff');
    hullGrad.addColorStop(1, '#5673c9');
    ctx.fillStyle = hullGrad;
    ctx.fill();
    ctx.strokeStyle = '#2f4590';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // wing accent stripes
    ctx.strokeStyle = 'rgba(58,99,200,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(4, -5);
    ctx.lineTo(-9, -9.5);
    ctx.moveTo(4, 5);
    ctx.lineTo(-9, 9.5);
    ctx.stroke();

    // wingtip nav lights (blink slowly)
    const blink = Math.sin(t * 3) > 0.4;
    ctx.fillStyle = blink ? '#ff5b5b' : 'rgba(255,91,91,0.25)';
    ctx.beginPath();
    ctx.arc(-11.5, -11.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#5bff8f' : 'rgba(91,255,143,0.25)';
    ctx.beginPath();
    ctx.arc(-11.5, 11.5, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // cockpit canopy
    const canopyGrad = ctx.createRadialGradient(11, -1.5, 0.5, 10, 0, 6);
    canopyGrad.addColorStop(0, '#eafcff');
    canopyGrad.addColorStop(0.5, '#5fd4ff');
    canopyGrad.addColorStop(1, '#1c6fb0');
    ctx.fillStyle = canopyGrad;
    ctx.beginPath();
    ctx.ellipse(10, 0, 6, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c3d75';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  function drawMinimap() {
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    const scale = mapCanvas.width / WORLD_W;

    mapCtx.strokeStyle = 'rgba(159,212,255,0.25)';
    mapCtx.lineWidth = 1;
    SECTOR_DEFS.forEach((s) => {
      mapCtx.beginPath();
      mapCtx.arc(STATION.x * scale, STATION.y * scale, s.bandMax * scale, 0, Math.PI * 2);
      mapCtx.stroke();
    });

    mapCtx.fillStyle = 'rgba(127,178,255,0.9)';
    mapCtx.beginPath();
    mapCtx.arc(STATION.x * scale, STATION.y * scale, 4, 0, Math.PI * 2);
    mapCtx.fill();

    state.planets.forEach((p) => {
      mapCtx.fillStyle = p.amount > 0.5 ? RESOURCE_TYPES[p.type].color : '#444b63';
      mapCtx.beginPath();
      mapCtx.arc(p.x * scale, p.y * scale, 2.5, 0, Math.PI * 2);
      mapCtx.fill();
    });

    state.bosses.forEach((boss) => {
      if (!boss.alive) return;
      const pulse = 2.5 + Math.sin(performance.now() / 200) * 1;
      mapCtx.fillStyle = boss.color;
      mapCtx.beginPath();
      mapCtx.arc(boss.x * scale, boss.y * scale, pulse + 1.5, 0, Math.PI * 2);
      mapCtx.fill();
    });

    mapCtx.fillStyle = '#ff5b5b';
    mapCtx.beginPath();
    mapCtx.arc(state.ship.x * scale, state.ship.y * scale, 3, 0, Math.PI * 2);
    mapCtx.fill();

    mapCtx.strokeStyle = 'rgba(159,212,255,0.6)';
    mapCtx.strokeRect(
      state.camera.x * scale, state.camera.y * scale,
      canvas.width * scale, canvas.height * scale
    );
  }

  init();
})();
