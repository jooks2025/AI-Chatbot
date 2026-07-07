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

  const WORLD_W = 4200;
  const WORLD_H = 4200;
  const STATION = { x: WORLD_W / 2, y: WORLD_H / 2, radius: 90 };

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
  };

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function makePlanets() {
    const planets = [];
    const count = 12;
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
      });
    }
    return planets;
  }

  function makeAsteroids() {
    const asteroids = [];
    for (let i = 0; i < 16; i++) {
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

  const state = {
    ship: {
      x: STATION.x, y: STATION.y - 140,
      vx: 0, vy: 0, angle: -Math.PI / 2,
      thrusting: false,
    },
    planets: makePlanets(),
    asteroids: makeAsteroids(),
    farStars: makeStars(220, WORLD_W, WORLD_H),
    nearStars: makeStars(140, WORLD_W, WORLD_H),
    credits: 0,
    cargo: { iron: 0, gold: 0, crystal: 0 },
    fuel: 0,
    hull: 0,
    levels: { cargo: 0, fuel: 0, engine: 0, mining: 0, hull: 0 },
    mining: null,
    docked: false,
    gameOver: false,
    keys: {},
    camera: { x: 0, y: 0 },
    invuln: 2,
  };

  function maxFuel() { return 100 + state.levels.fuel * UPGRADES.fuel.step; }
  function maxHull() { return 100 + state.levels.hull * UPGRADES.hull.step; }
  function maxCargo() { return 50 + state.levels.cargo * UPGRADES.cargo.step; }
  function thrustPower() { return 220 + state.levels.engine * 55; }
  function turnSpeed() { return 3.4; }
  function miningRate() { return 8 + state.levels.mining * 5; }

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

  function init() {
    resetShip();
    bindInput();
    buildUpgradePanel();
    requestAnimationFrame(loop);
  }

  function bindInput() {
    window.addEventListener('keydown', (e) => {
      state.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      state.keys[e.code] = false;
    });
    sellBtn.addEventListener('click', sellCargo);
    closeDockBtn.addEventListener('click', undock);
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
  }

  function undock() {
    state.docked = false;
    dockPanel.classList.add('hidden');
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
    state.levels = { cargo: 0, fuel: 0, engine: 0, mining: 0, hull: 0 };
    state.planets = makePlanets();
    state.asteroids = makeAsteroids();
    state.gameOver = false;
    state.mining = null;
    state.invuln = 2;
    resetShip();
    hideMessage();
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
        state.fuel = Math.max(0, state.fuel - 14 * dt);
      }

      // slight drag so the game stays controllable
      const drag = 0.35;
      ship.vx -= ship.vx * drag * dt;
      ship.vy -= ship.vy * drag * dt;

      const speed = Math.hypot(ship.vx, ship.vy);
      const maxSpeed = 340;
      if (speed > maxSpeed) {
        ship.vx = (ship.vx / speed) * maxSpeed;
        ship.vy = (ship.vy / speed) * maxSpeed;
      }

      ship.x = clamp(ship.x + ship.vx * dt, 0, WORLD_W);
      ship.y = clamp(ship.y + ship.vy * dt, 0, WORLD_H);

      updateMining(dt);
      updateAsteroids(dt);
    }

    updatePlanetRegen(dt);

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
        const dmg = 18;
        state.hull = Math.max(0, state.hull - dmg);
        state.invuln = 1.2;
        const angle = Math.atan2(ship.y - a.y, ship.x - a.x);
        ship.vx += Math.cos(angle) * 180;
        ship.vy += Math.sin(angle) * 180;
        if (state.hull <= 0) {
          triggerGameOver();
        }
        break;
      }
    }
  }

  function triggerGameOver() {
    state.gameOver = true;
    showMessage(`
      <div>선체가 파괴되었습니다.</div>
      <div style="margin-top:6px;color:#ffe08a;">최종 크레딧: ${state.credits}</div>
      <button id="restartBtn">다시 시작</button>
    `);
    document.getElementById('restartBtn').addEventListener('click', restart);
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

    drawStars(state.farStars, 0.4);
    drawStars(state.nearStars, 0.7);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    drawStation();
    state.planets.forEach(drawPlanet);
    state.asteroids.forEach(drawAsteroid);
    drawShip();

    ctx.restore();
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
    ctx.save();
    ctx.translate(STATION.x, STATION.y);
    const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, STATION.radius + 30);
    grad.addColorStop(0, 'rgba(120,180,255,0.35)');
    grad.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, STATION.radius + 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#7fb2ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, STATION.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#1c2a55';
    ctx.beginPath();
    ctx.arc(0, 0, STATION.radius - 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#9fd4ff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + performance.now() / 4000;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (STATION.radius - 10), Math.sin(a) * (STATION.radius - 10));
      ctx.lineTo(Math.cos(a) * (STATION.radius + 22), Math.sin(a) * (STATION.radius + 22));
      ctx.stroke();
    }

    ctx.fillStyle = '#d7e6ff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('정거장', 0, STATION.radius + 46);
    ctx.restore();
  }

  function drawPlanet(p) {
    const info = RESOURCE_TYPES[p.type];
    const depleted = p.amount <= 0.5;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = depleted ? '#31384f' : info.color;
    ctx.globalAlpha = depleted ? 0.4 : 1;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // resource gauge ring
    const pct = p.amount / p.maxAmount;
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 8, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#cfd8f5';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(info.name, 0, p.radius + 24);
    ctx.restore();
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

  function drawShip() {
    const ship = state.ship;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    if (state.invuln > 0 && Math.floor(state.invuln * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    if (ship.thrusting) {
      ctx.fillStyle = '#ff9d3d';
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-14 - rand(8, 18), rand(-4, 4));
      ctx.lineTo(-14, 6);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#cfe0ff';
    ctx.strokeStyle = '#4a75e0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawMinimap() {
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    const scale = mapCanvas.width / WORLD_W;
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
