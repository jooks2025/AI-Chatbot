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

  const WORLD_W = 7600;
  const WORLD_H = 7600;
  const STATION = { x: WORLD_W / 2, y: WORLD_H / 2, radius: 90 };

  const SECTOR_DEFS = [
    { sector: 1, bandMin: 900, bandMax: 1700 },
    { sector: 2, bandMin: 1900, bandMax: 2500 },
    { sector: 3, bandMin: 2700, bandMax: 3200 },
  ];

  const BOSS_DEFS = [
    {
      id: 'sector1', sector: 1, name: '유성체 대왕 크라겐', tag: '가벼운 보스',
      color: '#6bff9e', glow: 'rgba(107,255,158,0.35)',
      radius: 130, hitRadius: 90, hp: 140, contactDamage: 12,
      speed: 70, aggroRange: 480, canShoot: false,
      reward: 250, respawnTime: 60,
    },
    {
      id: 'sector2', sector: 2, name: '심연 촉수왕 바슬로스', tag: '중간 보스',
      color: '#c26bff', glow: 'rgba(194,107,255,0.35)',
      radius: 190, hitRadius: 130, hp: 320, contactDamage: 20,
      speed: 110, aggroRange: 560, canShoot: true,
      fireRate: 1.6, projectileSpeed: 220, projectileDamage: 14,
      reward: 600, respawnTime: 90,
    },
    {
      id: 'sector3', sector: 3, name: '차원포식자 오메가바이스', tag: '최종 보스',
      color: '#ff4b6b', glow: 'rgba(255,75,107,0.4)',
      radius: 260, hitRadius: 180, hp: 620, contactDamage: 30,
      speed: 150, aggroRange: 650, canShoot: true,
      fireRate: 1.0, projectileSpeed: 260, projectileDamage: 20,
      reward: 1500, respawnTime: 150,
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
      });
    }
    return planets;
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
  };

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

  function init() {
    resetShip();
    bindInput();
    buildUpgradePanel();
    requestAnimationFrame(loop);
  }

  function bindInput() {
    window.addEventListener('keydown', (e) => {
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

      const distToShip = dist(ship.x, ship.y, boss.x, boss.y);
      const aggro = distToShip < boss.aggroRange && !state.docked;

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

    drawStars(state.farStars, 0.4);
    drawStars(state.nearStars, 0.7);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    drawStation();
    state.planets.forEach(drawPlanet);
    state.asteroids.forEach(drawAsteroid);
    state.bosses.forEach(drawBoss);
    state.bossBullets.forEach(drawBossBullet);
    drawShip();
    state.bullets.forEach(drawPlayerBullet);

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

  function drawBoss(boss) {
    if (!boss.alive) return;
    const t = performance.now() / 1000;
    ctx.save();
    ctx.translate(boss.x, boss.y);

    const auraR = boss.radius * 1.6;
    const grad = ctx.createRadialGradient(0, 0, boss.radius * 0.3, 0, 0, auraR);
    grad.addColorStop(0, boss.glow);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, auraR, 0, Math.PI * 2);
    ctx.fill();

    const tentCount = 6 + boss.sector * 2;
    ctx.strokeStyle = boss.color;
    ctx.lineWidth = Math.max(4, boss.radius * 0.06);
    for (let i = 0; i < tentCount; i++) {
      const baseAngle = (i / tentCount) * Math.PI * 2;
      const wig = Math.sin(t * 1.5 + i) * 0.4;
      const len = boss.radius * (1.1 + 0.3 * Math.sin(t + i * 1.3));
      const sx = Math.cos(baseAngle) * boss.radius * 0.7;
      const sy = Math.sin(baseAngle) * boss.radius * 0.7;
      const mx = Math.cos(baseAngle + wig) * (boss.radius + len * 0.6);
      const my = Math.sin(baseAngle + wig) * (boss.radius + len * 0.6);
      const ex = Math.cos(baseAngle + wig * 1.6) * (boss.radius + len);
      const ey = Math.sin(baseAngle + wig * 1.6) * (boss.radius + len);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = boss.color;
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 3;
    ctx.stroke();

    const fx = Math.cos(boss.facing);
    const fy = Math.sin(boss.facing);
    const perpx = -fy;
    const perpy = fx;
    const eyeOffset = boss.radius * 0.3;
    [-1, 1].forEach((side) => {
      const ex2 = fx * eyeOffset + perpx * side * eyeOffset * 0.6;
      const ey2 = fy * eyeOffset + perpy * side * eyeOffset * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex2, ey2, boss.radius * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(ex2 + fx * boss.radius * 0.03, ey2 + fy * boss.radius * 0.03, boss.radius * 0.045, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(12, boss.radius * 0.11)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(boss.name, 0, -boss.radius * 1.85);

    const barW = boss.radius * 1.6;
    const barH = 6;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
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
