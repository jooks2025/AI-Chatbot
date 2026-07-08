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
  const cargoBreakdownEl = document.getElementById('cargoBreakdown');
  const creditsText = document.getElementById('creditsText');
  const messageEl = document.getElementById('message');
  const dockPanel = document.getElementById('dockPanel');
  const dockCreditsEl = document.getElementById('dockCredits');
  const sellBtn = document.getElementById('sellBtn');
  const saveBtn = document.getElementById('saveBtn');
  const closeDockBtn = document.getElementById('closeDockBtn');
  const upgradeListEl = document.getElementById('upgradeList');
  const resourcePricesEl = document.getElementById('resourcePrices');
  const mineProgressWrap = document.getElementById('mineProgressWrap');
  const mineProgressFill = document.getElementById('mineProgress');
  const bossBar = document.getElementById('bossBar');
  const bossNameEl = document.getElementById('bossName');
  const bossTagEl = document.getElementById('bossTag');
  const bossHpFill = document.getElementById('bossHpFill');
  const sectorLabelEl = document.getElementById('sectorLabel');
  const toastEl = document.getElementById('toast');
  const muteBtn = document.getElementById('muteBtn');
  const langBtn = document.getElementById('langBtn');
  const langModal = document.getElementById('langModal');
  const langKoBtn = document.getElementById('langKoBtn');
  const langEnBtn = document.getElementById('langEnBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const touchStick = document.getElementById('touchStick');
  const touchStickKnob = document.getElementById('touchStickKnob');
  const touchFireBtn = document.getElementById('touchFire');
  const touchActionBtn = document.getElementById('touchAction');

  const WORLD_W = 9600;
  const WORLD_H = 9600;
  const STATION = { x: WORLD_W / 2, y: WORLD_H / 2, radius: 90 };

  const SECTOR_DEFS = [
    { sector: 1, bandMin: 900, bandMax: 1700 },
    { sector: 2, bandMin: 1900, bandMax: 2500 },
    { sector: 3, bandMin: 2700, bandMax: 3200 },
    { sector: 4, bandMin: 3500, bandMax: 3850 },
  ];

  const BOSS_DEFS = [
    {
      id: 'sector1', sector: 1,
      color: '#5dffa0', core: '#0b1f13', glow: 'rgba(93,255,160,0.45)',
      eyeCount: 2, radius: 175, hitRadius: 115, hp: 170, contactDamage: 16,
      speed: 75, aggroRange: 540, canShoot: false,
      reward: 280, respawnTime: 60,
    },
    {
      id: 'sector2', sector: 2,
      color: '#caa0ff', core: '#170b28', glow: 'rgba(202,160,255,0.45)',
      eyeCount: 4, radius: 245, hitRadius: 160, hp: 400, contactDamage: 24,
      speed: 115, aggroRange: 640, canShoot: true,
      fireRate: 1.5, projectileSpeed: 230, projectileDamage: 16,
      reward: 650, respawnTime: 90,
    },
    {
      id: 'sector3', sector: 3,
      color: '#ff3355', core: '#1a0407', glow: 'rgba(255,51,85,0.5)',
      eyeCount: 6, radius: 340, hitRadius: 220, hp: 780, contactDamage: 38,
      speed: 155, aggroRange: 760, canShoot: true,
      fireRate: 0.9, projectileSpeed: 270, projectileDamage: 22,
      reward: 1600, respawnTime: 150,
    },
  ];

  const DIMENSIONAL_BOSS_DEF = {
    id: 'dimensional', sector: 4,
    color: '#c9b6ff', core: '#05030a', glow: 'rgba(201,182,255,0.5)',
    radius: 380, hitRadius: 240, hp: 1200, contactDamage: 42,
    speed: 130, aggroRange: 820, canShoot: true,
    fireRate: 0.8, projectileSpeed: 300, projectileDamage: 24,
    reward: 3000, respawnTime: 200,
  };

  const ALL_BOSS_DEFS = BOSS_DEFS.concat([DIMENSIONAL_BOSS_DEF]);

  const MOB_DEFS = [
    {
      id: 'mob1', sector: 1,
      color: '#5dffa0', core: '#0d2417', glow: 'rgba(93,255,160,0.4)',
      radius: 20, hitRadius: 16, hp: 18, contactDamage: 6,
      speed: 100, aggroRange: 260, reward: 12, respawnTime: 14, count: 4,
    },
    {
      id: 'mob2', sector: 2,
      color: '#caa0ff', core: '#1c1030', glow: 'rgba(202,160,255,0.4)',
      radius: 24, hitRadius: 19, hp: 32, contactDamage: 10,
      speed: 125, aggroRange: 300, reward: 22, respawnTime: 18, count: 4,
    },
    {
      id: 'mob3', sector: 3,
      color: '#ff3355', core: '#240509', glow: 'rgba(255,51,85,0.4)',
      radius: 28, hitRadius: 22, hp: 48, contactDamage: 15,
      speed: 150, aggroRange: 340, reward: 34, respawnTime: 22, count: 4,
    },
  ];

  const RESOURCE_TYPES = {
    iron:    { color: '#c7c7c7', price: 4,  mineMul: 1 },
    gold:    { color: '#ffd24a', price: 11, mineMul: 0.62 },
    crystal: { color: '#7ef7e0', price: 26, mineMul: 0.38 },
  };

  const UPGRADES = {
    cargo:  { base: 40,  growth: 1.5, max: 8, step: 20 },
    fuel:   { base: 40, growth: 1.5, max: 8, step: 25 },
    engine: { base: 55, growth: 1.6, max: 6, step: 0 },
    mining: { base: 50, growth: 1.6, max: 6, step: 0 },
    hull:   { base: 45, growth: 1.55, max: 6, step: 20 },
    weapon: { base: 60, growth: 1.55, max: 6, step: 0 },
  };

  // ---- localization ----
  const STRINGS = {
    ko: {
      pageTitle: '우주 채굴선',
      h1Main: '우주 채굴선',
      h1Sub: 'Star Miner',
      labelFuel: '연료',
      labelHull: '선체',
      labelCargo: '화물칸',
      labelCredits: '크레딧',
      muteTitle: '소리 켜기/끄기',
      langTitle: '언어 변경',
      fullscreenTitle: '전체화면',
      dockTitle: '우주 정거장',
      dockDesc: '채굴한 자원을 판매하고 선박을 개조하세요.',
      sellBtn: '화물 전량 판매',
      saveBtn: '게임 저장',
      closeDockBtn: '출항하기',
      tipHtml: '🛠️ <b>정거장(맵 중앙)</b>에서 화물을 팔고 연료·화물칸·엔진·무기 등 선박 성능을 업그레이드할 수 있어요!',
      controlsKeysHtml: '<b>↑ / W</b> 추진&nbsp;&nbsp;<b>← →  / A D</b> 회전&nbsp;&nbsp;<b>Space / E</b> 채굴 · 정거장 도킹&nbsp;&nbsp;<b>F</b> 레이저 발사',
      controlsMining: '행성에 가까이, 천천히 접근한 뒤 Space(또는 E)를 눌러 채굴하세요. 연료가 떨어지면 추진할 수 없고, 표류가 길어지면 어둠 속에서 무언가가 다가옵니다 — 정거장으로 서둘러 복귀하세요.',
      controlsSector: '정거장에서 멀어질수록 1 → 2 → 3섹터 순으로 위험한 거대 우주 괴물이 도사리고 있습니다. F로 레이저를 쏴 격퇴하면 큰 크레딧 보상을 받습니다. 세 보스를 모두 물리치면 미지의 차원이 열립니다.',
      backLink: '← 게임 목록으로',
      langModalTitle: '언어 선택 / Select Language',
      langKoBtn: '한국어',
      langEnBtn: 'English',
      continueTitle: '저장된 게임을 발견했습니다',
      continueDesc: '이어서 진행하시겠어요? 새로 시작해도 이전 저장은 다시 저장하기 전까지 남아있어요.',
      continueYes: '이어하기',
      continueNo: '새로 시작',
      loadedToast: (credits) => `저장된 게임을 불러왔습니다! 보유 크레딧 ${credits}`,
      savedToast: '💾 게임이 저장되었습니다!',
      soldToast: (breakdown, total) => `📦 판매 완료: ${breakdown} → 총 ${total} 크레딧`,
      firstVisitTip: '💡 정거장(맵 중앙)에서 화물을 팔고 연료·화물칸·엔진·무기 등 선박 성능을 업그레이드할 수 있어요!',
      restartToast: '정거장으로 귀환했습니다. 화물칸은 비었지만 선박 업그레이드는 그대로 남아있어요.',
      predatorWarn: '⚠️ 연료가 바닥나 표류하는 당신을 어둠 속의 무언가가 감지했습니다...',
      eatenMessage: '연료가 바닥난 채 표류하던 당신을, 어둠 속에서 나타난 거대한 무언가가 통째로 삼켜버렸습니다.',
      hullDestroyed: '선체가 파괴되었습니다.',
      finalCredits: (credits) => `최종 크레딧: ${credits}`,
      restartBtn: '다시 시작',
      dimensionalDefeat: (reward) => `무한궤도의 지배자를 물리쳤습니다! 균열 너머에도 평화가 찾아왔습니다. (+${reward} 크레딧)`,
      finalBossDefeat: (name, reward) => `최종 보스 '${name}'를 물리쳤습니다! 우주가 잠시 평화를 되찾았습니다. (+${reward} 크레딧)`,
      bossDefeat: (tag, name, reward) => `${tag} '${name}' 격파! +${reward} 크레딧`,
      chapter2Toast: '🌌 세 우주 괴물을 모두 물리쳤습니다! 균열이 열리며 은하 너머 미지의 차원으로 진입합니다...',
      sectorSafe: '구역: 안전지대',
      sectorLocked: '구역: 미지의 균열 (아직 열리지 않음)',
      sectorRift: (name) => `구역: 차원 균열 · ${name}의 영역`,
      sectorN: (n, name) => `구역: ${n}섹터 · ${name}의 영역`,
      stationLabel: '정거장',
      levelMax: (lvl) => `레벨 ${lvl} (최대)`,
      maxBtn: '최대',
      levelUp: (lvl, next, note) => `레벨 ${lvl} → ${next}${note}`,
      costCredits: (cost) => `${cost} 크레딧`,
      dockCredits: (credits) => `${credits} 크레딧`,
      weaponNoteSide: ' · 사이드 샷 해금',
      weaponNoteFireRate: ' · 연사 속도 증가',
      weaponNoteBeam: ' · 강화 빔',
      weaponNotePierce: ' · 관통 + 프리즘 샷',
      resource_iron: '철광석',
      resource_gold: '금',
      resource_crystal: '결정체',
      upgrade_cargo: '화물칸 확장',
      upgrade_fuel: '연료 탱크 확장',
      upgrade_engine: '엔진 출력 강화',
      upgrade_mining: '채굴 레이저 강화',
      upgrade_hull: '선체 장갑 강화',
      upgrade_weapon: '레이저 캐논 강화',
      boss_sector1_name: '유성체 대왕 크라겐',
      boss_sector1_tag: '가벼운 보스',
      boss_sector2_name: '심연 촉수왕 바슬로스',
      boss_sector2_tag: '중간 보스',
      boss_sector3_name: '차원포식자 오메가바이스',
      boss_sector3_tag: '최종 보스',
      boss_dimensional_name: '무한궤도의 지배자 인피니타스',
      boss_dimensional_tag: '차원 보스',
    },
    en: {
      pageTitle: 'Star Miner',
      h1Main: 'Star Miner',
      h1Sub: 'Deep Space Mining',
      labelFuel: 'Fuel',
      labelHull: 'Hull',
      labelCargo: 'Cargo',
      labelCredits: 'Credits',
      muteTitle: 'Toggle sound',
      langTitle: 'Change language',
      fullscreenTitle: 'Fullscreen',
      dockTitle: 'Space Station',
      dockDesc: 'Sell what you’ve mined and upgrade your ship.',
      sellBtn: 'Sell All Cargo',
      saveBtn: 'Save Game',
      closeDockBtn: 'Depart',
      tipHtml: '🛠️ Sell cargo and upgrade your fuel, cargo bay, engine, weapon and more at the <b>station (map center)</b>!',
      controlsKeysHtml: '<b>Up / W</b> Thrust&nbsp;&nbsp;<b>Left Right / A D</b> Turn&nbsp;&nbsp;<b>Space / E</b> Mine · Dock&nbsp;&nbsp;<b>F</b> Fire Laser',
      controlsMining: 'Approach a planet slowly and press Space (or E) to mine. Run out of fuel and you can’t thrust — drift too long and something will come for you out of the dark. Hurry back to the station.',
      controlsSector: 'The farther you travel from the station, the more dangerous the space monsters get across Sectors 1 → 2 → 3. Fire your laser with F to fight them off for a big credit reward. Defeat all three bosses to open an unknown dimension.',
      backLink: '← Back to game list',
      langModalTitle: '언어 선택 / Select Language',
      langKoBtn: '한국어',
      langEnBtn: 'English',
      continueTitle: 'Saved game found',
      continueDesc: 'Continue where you left off? Starting fresh keeps your old save until you save again.',
      continueYes: 'Continue',
      continueNo: 'Start Fresh',
      loadedToast: (credits) => `Loaded your saved game! Credits: ${credits}`,
      savedToast: '💾 Game saved!',
      soldToast: (breakdown, total) => `📦 Sold: ${breakdown} → Total ${total} credits`,
      firstVisitTip: '💡 Sell cargo and upgrade your fuel, cargo bay, engine, weapon and more at the station (map center)!',
      restartToast: 'You’ve returned to the station. Your cargo is empty, but your ship upgrades remain.',
      predatorWarn: '⚠️ Something in the dark has noticed you drifting, out of fuel...',
      eatenMessage: 'Adrift and out of fuel, something enormous emerged from the dark and swallowed your ship whole.',
      hullDestroyed: 'Your hull has been destroyed.',
      finalCredits: (credits) => `Final Credits: ${credits}`,
      restartBtn: 'Try Again',
      dimensionalDefeat: (reward) => `You defeated the Ruler of the Infinite Orbit! Peace has come even beyond the rift. (+${reward} credits)`,
      finalBossDefeat: (name, reward) => `You defeated the final boss '${name}'! The universe has found peace, for now. (+${reward} credits)`,
      bossDefeat: (tag, name, reward) => `${tag} '${name}' defeated! +${reward} credits`,
      chapter2Toast: '🌌 You have defeated all three space monsters! A rift tears open, leading beyond the galaxy into an unknown dimension...',
      sectorSafe: 'Zone: Safe Area',
      sectorLocked: 'Zone: Unknown Rift (not yet open)',
      sectorRift: (name) => `Zone: Dimensional Rift · Territory of ${name}`,
      sectorN: (n, name) => `Zone: Sector ${n} · Territory of ${name}`,
      stationLabel: 'Station',
      levelMax: (lvl) => `Level ${lvl} (Max)`,
      maxBtn: 'Max',
      levelUp: (lvl, next, note) => `Level ${lvl} → ${next}${note}`,
      costCredits: (cost) => `${cost} Credits`,
      dockCredits: (credits) => `${credits} Credits`,
      weaponNoteSide: ' · Side shots unlocked',
      weaponNoteFireRate: ' · Faster fire rate',
      weaponNoteBeam: ' · Charged beam',
      weaponNotePierce: ' · Piercing + prism shot',
      resource_iron: 'Iron Ore',
      resource_gold: 'Gold',
      resource_crystal: 'Crystal',
      upgrade_cargo: 'Cargo Bay Expansion',
      upgrade_fuel: 'Fuel Tank Expansion',
      upgrade_engine: 'Engine Boost',
      upgrade_mining: 'Mining Laser Upgrade',
      upgrade_hull: 'Hull Armor Upgrade',
      upgrade_weapon: 'Laser Cannon Upgrade',
      boss_sector1_name: 'Kragen, the Meteor King',
      boss_sector1_tag: 'Light Boss',
      boss_sector2_name: 'Vathros, Tentacle King of the Abyss',
      boss_sector2_tag: 'Mid Boss',
      boss_sector3_name: 'Omegavice, the Dimension Devourer',
      boss_sector3_tag: 'Final Boss',
      boss_dimensional_name: 'Infinitas, Ruler of the Infinite Orbit',
      boss_dimensional_tag: 'Dimensional Boss',
    },
  };

  function tr(key, ...args) {
    const entry = (STRINGS[state.lang] && STRINGS[state.lang][key]) ?? STRINGS.ko[key];
    return typeof entry === 'function' ? entry(...args) : entry;
  }

  function resourceName(type) { return tr(`resource_${type}`); }
  function upgradeLabel(key) { return tr(`upgrade_${key}`); }
  function bossName(idOrBoss) { return tr(`boss_${typeof idOrBoss === 'string' ? idOrBoss : idOrBoss.id}_name`); }
  function bossTag(idOrBoss) { return tr(`boss_${typeof idOrBoss === 'string' ? idOrBoss : idOrBoss.id}_tag`); }

  const FIRE_COOLDOWN = 0.25;
  const BULLET_SPEED = 520;
  const BULLET_LIFE = 1.1;
  const FUEL_BURN_RATE = 4.6;
  const SHIP_DRAG = 0.95;
  const PREDATOR_WARN_DELAY = 8;
  const PREDATOR_SPEED = 150;
  const PREDATOR_CATCH_RADIUS = 45;

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function makePlanets() {
    const planets = [];
    const count = 18;
    const nearCount = 5;
    const types = Object.keys(RESOURCE_TYPES);
    let attempts = 0;
    while (planets.length < count && attempts < 4000) {
      attempts++;
      let x, y;
      if (planets.length < nearCount) {
        // guarantee a handful of deposits close to the station so the first
        // few minutes of play don't require a long blind flight
        const angle = rand(0, Math.PI * 2);
        const d = rand(480, 950);
        x = clamp(STATION.x + Math.cos(angle) * d, 200, WORLD_W - 200);
        y = clamp(STATION.y + Math.sin(angle) * d, 200, WORLD_H - 200);
      } else {
        x = rand(200, WORLD_W - 200);
        y = rand(200, WORLD_H - 200);
      }
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

  function spawnDimensionalBoss() {
    const sectorDef = SECTOR_DEFS.find((s) => s.sector === 4);
    const angle = rand(0, Math.PI * 2);
    const d = rand(sectorDef.bandMin, sectorDef.bandMax);
    const x = clamp(STATION.x + Math.cos(angle) * d, 200, WORLD_W - 200);
    const y = clamp(STATION.y + Math.sin(angle) * d, 200, WORLD_H - 200);
    const shards = [];
    for (let i = 0; i < 7; i++) {
      shards.push({
        orbitR: rand(0.85, 1.6),
        speed: rand(0.6, 1.4) * (Math.random() < 0.5 ? 1 : -1),
        phase: rand(0, Math.PI * 2),
        size: rand(8, 16),
      });
    }
    return {
      ...DIMENSIONAL_BOSS_DEF,
      x, y,
      anchor: { x, y },
      hpMax: DIMENSIONAL_BOSS_DEF.hp,
      alive: true,
      respawnTimer: 0,
      defeatedOnce: false,
      wanderTarget: { x, y },
      wanderTimer: rand(2, 5),
      fireTimer: rand(0.5, DIMENSIONAL_BOSS_DEF.fireRate),
      facing: 0,
      aggroed: false,
      spawnFlash: 1.4,
      shards,
    };
  }

  let mobUidCounter = 0;

  function spawnMob(def) {
    const sectorDef = SECTOR_DEFS.find((s) => s.sector === def.sector);
    const angle = rand(0, Math.PI * 2);
    const d = rand(sectorDef.bandMin, sectorDef.bandMax);
    const x = clamp(STATION.x + Math.cos(angle) * d, 200, WORLD_W - 200);
    const y = clamp(STATION.y + Math.sin(angle) * d, 200, WORLD_H - 200);
    return {
      ...def,
      uid: `${def.id}_${mobUidCounter++}`,
      x, y,
      anchor: { x, y },
      hpMax: def.hp,
      alive: true,
      respawnTimer: 0,
      wanderTarget: { x, y },
      wanderTimer: rand(1.5, 3.5),
      facing: 0,
      aggroed: false,
      spawnFlash: 0.8,
      bodyPhase: rand(0, Math.PI * 2),
    };
  }

  function makeMobs() {
    const mobs = [];
    MOB_DEFS.forEach((def) => {
      for (let i = 0; i < def.count; i++) mobs.push(spawnMob(def));
    });
    return mobs;
  }

  function makePredator() {
    const ship = state.ship;
    const angle = rand(0, Math.PI * 2);
    const dSpawn = rand(450, 650);
    return {
      x: clamp(ship.x + Math.cos(angle) * dSpawn, 50, WORLD_W - 50),
      y: clamp(ship.y + Math.sin(angle) * dSpawn, 50, WORLD_H - 50),
      facing: 0,
      bodyVerts: makeMonsterBody(),
    };
  }

  const state = {
    ship: {
      x: STATION.x, y: STATION.y - 140,
      vx: 0, vy: 0, angle: -Math.PI / 2,
      thrusting: false,
      fireCooldown: 0,
      muzzleFlash: 0,
    },
    planets: makePlanets(),
    asteroids: makeAsteroids(),
    bosses: makeBosses(),
    mobs: makeMobs(),
    bullets: [],
    bossBullets: [],
    farStars: makeStars(380, WORLD_W, WORLD_H),
    nearStars: makeStars(240, WORLD_W, WORLD_H),
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
    lang: 'ko',
    touchStick: { active: false, angle: 0, magnitude: 0 },
    chapter: 1,
    predator: null,
    fuelEmptyTimer: 0,
    damagePopups: [],
    particles: [],
    riftTransition: null,
  };

  function addShake(amount) {
    state.shake = Math.min(36, state.shake + amount);
  }

  function spawnDamagePopup(x, y, amount, color, prefix = '') {
    state.damagePopups.push({ x, y, vy: -42, life: 0.75, maxLife: 0.75, text: `${prefix}${Math.round(amount)}`, color });
  }

  function spawnExplosion(x, y, color, count, power) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(power * 0.3, power);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rand(0.4, 0.9),
        maxLife: 0.9,
        color,
        size: rand(2, 5),
      });
    }
  }

  function updateDamagePopups(dt) {
    state.damagePopups = state.damagePopups.filter((p) => {
      p.y += p.vy * dt;
      p.life -= dt;
      return p.life > 0;
    });
  }

  function updateParticles(dt) {
    state.particles = state.particles.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      return p.life > 0;
    });
  }

  function maxFuel() { return 100 + state.levels.fuel * UPGRADES.fuel.step; }
  function maxHull() { return 100 + state.levels.hull * UPGRADES.hull.step; }
  function maxCargo() { return 50 + state.levels.cargo * UPGRADES.cargo.step; }
  function thrustPower() { return 220 + state.levels.engine * 55; }
  function turnSpeed() { return 3.4; }
  function miningRate() { return 8 + state.levels.mining * 5; }
  function weaponDamage() { return 14 + state.levels.weapon * 6; }
  function weaponVisualTier() {
    const lvl = state.levels.weapon;
    if (lvl >= 6) return 3;
    if (lvl >= 4) return 2;
    if (lvl >= 1) return 1;
    return 0;
  }
  function hasSideShots() { return state.levels.weapon >= 2; }
  function fireCooldownFor() { return state.levels.weapon >= 3 ? FIRE_COOLDOWN * 0.7 : FIRE_COOLDOWN; }
  function weaponPierce() { return state.levels.weapon >= 6 ? 1 : 0; }

  function weaponUpgradeNote(nextLevel) {
    if (nextLevel === 2) return tr('weaponNoteSide');
    if (nextLevel === 3) return tr('weaponNoteFireRate');
    if (nextLevel === 4) return tr('weaponNoteBeam');
    if (nextLevel === 6) return tr('weaponNotePierce');
    return '';
  }

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

  // ---- settings (localStorage; language + mute, applied automatically every visit) ----
  const SETTINGS_KEY = 'starMinerSettings_v1';

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        muted: state.muted,
        lang: state.lang,
      }));
    } catch (e) {
      // storage unavailable (private browsing, quota, etc.) -- fail silently
    }
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      state.muted = !!data.muted;
      state.lang = data.lang === 'en' ? 'en' : 'ko';
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---- game save (localStorage; credits/upgrades/chapter -- manual only, via the
  // station's "Save Game" button. Reopening the page always starts a fresh run;
  // players opt in to continuing a save through the prompt shown at startup.) ----
  const SAVE_KEY = 'starMinerSave_v1';

  function hasSavedProgress() {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch (e) {
      return false;
    }
  }

  function saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        credits: state.credits,
        levels: state.levels,
        chapter: state.chapter,
      }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadGameProgress() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      state.credits = typeof data.credits === 'number' ? data.credits : 0;
      state.levels = Object.assign(
        { cargo: 0, fuel: 0, engine: 0, mining: 0, hull: 0, weapon: 0 },
        data.levels || {}
      );
      state.chapter = data.chapter === 2 ? 2 : 1;
      return true;
    } catch (e) {
      return false;
    }
  }

  function promptContinue() {
    showMessage(`
      <div>${tr('continueTitle')}</div>
      <div style="margin-top:6px;color:#a9b7e0;font-size:0.85em;">${tr('continueDesc')}</div>
      <div style="margin-top:14px;display:flex;gap:10px;justify-content:center;">
        <button id="continueYesBtn">${tr('continueYes')}</button>
        <button id="continueNoBtn">${tr('continueNo')}</button>
      </div>
    `);
    document.getElementById('continueYesBtn').addEventListener('click', () => {
      loadGameProgress();
      refreshUpgradePanel();
      if (state.chapter === 2 && !state.bosses.some((b) => b.id === 'dimensional')) {
        state.bosses.forEach((b) => { b.defeatedOnce = true; });
        state.bosses.push(spawnDimensionalBoss());
      }
      hideMessage();
      showToast(tr('loadedToast', state.credits), 5000);
    });
    document.getElementById('continueNoBtn').addEventListener('click', () => {
      hideMessage();
      showToast(tr('firstVisitTip'), 7000);
    });
  }

  function manualSave() {
    if (saveGame()) {
      showToast(tr('savedToast'), 3000);
    }
  }

  // ---- sound (synthesized via Web Audio API, no asset files needed) ----
  let audioCtx = null;
  let engineOsc = null;
  let engineGain = null;
  let miningOsc = null;
  let miningGain = null;
  let ambientGain = null;
  let riftGain = null;
  let ambientBus = null;
  let twinkleTimer = rand(4, 8);

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

    // shared ambient bus with a long echo tail -- sells "vast, empty space"
    ambientBus = audioCtx.createGain();
    ambientBus.gain.value = 1;
    ambientBus.connect(audioCtx.destination);
    const delay = audioCtx.createDelay(1.2);
    delay.delayTime.value = 0.45;
    const feedback = audioCtx.createGain();
    feedback.gain.value = 0.32;
    delay.connect(feedback).connect(delay);
    ambientBus.connect(delay).connect(audioCtx.destination);

    // bed 1: the "normal space" drone (chapter 1)
    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0;
    const ambientFilter = audioCtx.createBiquadFilter();
    ambientFilter.type = 'lowpass';
    ambientFilter.frequency.value = 500;
    ambientFilter.Q.value = 0.6;
    ambientFilter.connect(ambientGain).connect(ambientBus);

    [55, 82.41, 110.5].forEach((freq) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const oscGain = audioCtx.createGain();
      oscGain.gain.value = 0.33;
      osc.connect(oscGain).connect(ambientFilter);
      osc.start();
    });

    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.06;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(ambientFilter.frequency);
    lfo.start();

    // bed 2: an unsettled, dissonant drone for the dimensional rift (chapter 2)
    riftGain = audioCtx.createGain();
    riftGain.gain.value = 0;
    const riftFilter = audioCtx.createBiquadFilter();
    riftFilter.type = 'lowpass';
    riftFilter.frequency.value = 620;
    riftFilter.Q.value = 1.4;
    riftFilter.connect(riftGain).connect(ambientBus);

    [59, 91, 149].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = i === 1 ? 'sawtooth' : 'sine';
      osc.frequency.value = freq;
      const oscGain = audioCtx.createGain();
      oscGain.gain.value = 0.3;
      osc.connect(oscGain).connect(riftFilter);
      osc.start();
    });

    const riftLfo = audioCtx.createOscillator();
    riftLfo.type = 'sine';
    riftLfo.frequency.value = 0.13;
    const riftLfoGain = audioCtx.createGain();
    riftLfoGain.gain.value = 340;
    riftLfo.connect(riftLfoGain).connect(riftFilter.frequency);
    riftLfo.start();
  }

  function unlockAudio() {
    setupAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function toggleMute() {
    state.muted = !state.muted;
    muteBtn.textContent = state.muted ? '🔇' : '🔊';
    unlockAudio();
    saveSettings();
  }

  function applyStaticTranslations() {
    document.title = tr('pageTitle');
    document.documentElement.lang = state.lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = tr(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = tr(el.dataset.i18nHtml);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = tr(el.dataset.i18nTitle);
    });
  }

  function openLangModal() {
    langModal.classList.remove('hidden');
  }

  function setLanguage(lang) {
    state.lang = lang === 'en' ? 'en' : 'ko';
    applyStaticTranslations();
    buildUpgradePanel();
    langModal.classList.add('hidden');
    saveSettings();
  }

  function playTone({ freq = 440, duration = 0.15, type = 'sine', startFreq, endFreq, volume = 0.18, attack = 0.005, destination }) {
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
    osc.connect(gain).connect(destination || audioCtx.destination);
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

  function sfxLaser(tier = 0) {
    if (tier >= 3) {
      playTone({ type: 'sawtooth', startFreq: 1300, endFreq: 220, duration: 0.13, volume: 0.13 });
      playTone({ type: 'sine', startFreq: 320, endFreq: 55, duration: 0.16, volume: 0.1 });
    } else if (tier === 2) {
      playTone({ type: 'sawtooth', startFreq: 1050, endFreq: 200, duration: 0.11, volume: 0.11 });
    } else if (tier === 1) {
      playTone({ type: 'sawtooth', startFreq: 940, endFreq: 190, duration: 0.1, volume: 0.1 });
    } else {
      playTone({ type: 'sawtooth', startFreq: 880, endFreq: 180, duration: 0.1, volume: 0.1 });
    }
  }
  function sfxLaserHit(tier = 0) {
    if (tier >= 3) {
      playTone({ type: 'square', freq: 1500, duration: 0.06, volume: 0.08 });
      playNoise({ duration: 0.09, volume: 0.12, filterFreq: 2200 });
    } else if (tier >= 1) {
      playTone({ type: 'square', freq: 1300, duration: 0.05, volume: 0.06 });
    } else {
      playTone({ type: 'square', freq: 1200, duration: 0.045, volume: 0.05 });
    }
  }
  function sfxHit() { playNoise({ duration: 0.18, volume: 0.22, filterFreq: 900 }); }
  function sfxDock() { playSequence([523.25, 659.25], { volume: 0.14 }); }
  function sfxUndock() { playSequence([659.25, 523.25], { volume: 0.12 }); }
  function sfxUpgrade() { playSequence([659.25, 880, 1046.5], { gap: 0.08, volume: 0.15 }); }
  function sfxBossAggro() { playTone({ type: 'sawtooth', startFreq: 160, endFreq: 45, duration: 0.5, volume: 0.14 }); }
  function sfxBossDefeat() { playSequence([440, 550, 660, 880], { gap: 0.1, duration: 0.22, volume: 0.17 }); }
  function sfxMobDefeat() { playSequence([880, 1174.7], { gap: 0.06, duration: 0.12, volume: 0.13 }); }
  function sfxGameOver() { playSequence([392, 349.23, 293.66, 220], { gap: 0.18, duration: 0.35, volume: 0.16, type: 'triangle' }); }
  function sfxPredatorWarn() { playTone({ type: 'sine', freq: 85, duration: 0.4, volume: 0.14 }); }
  function sfxEaten() {
    playNoise({ duration: 0.45, volume: 0.3, filterFreq: 280 });
    playTone({ type: 'sine', startFreq: 200, endFreq: 28, duration: 0.65, volume: 0.22 });
  }
  function sfxDimensionalRift() {
    playTone({ type: 'sawtooth', startFreq: 80, endFreq: 900, duration: 1.1, volume: 0.15 });
    playSequence([660, 880, 1320, 1760], { gap: 0.12, duration: 0.5, volume: 0.12, type: 'triangle' });
  }

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
    if (ambientGain) {
      const target = !state.muted ? (state.chapter === 2 ? 0.012 : 0.03) : 0;
      ambientGain.gain.setTargetAtTime(target, now, 1.4);
    }
    if (riftGain) {
      const target = !state.muted && state.chapter === 2 ? 0.032 : 0;
      riftGain.gain.setTargetAtTime(target, now, 1.6);
    }
  }

  function updateAmbientTwinkle(dt) {
    if (!audioCtx || state.muted) return;
    twinkleTimer -= dt;
    if (twinkleTimer > 0) return;
    const scale = state.chapter === 2
      ? [369.99, 415.3, 493.88, 554.37, 622.25]
      : [440, 523.25, 659.25, 783.99];
    const base = scale[Math.floor(rand(0, scale.length))];
    const freq = Math.random() < 0.5 ? base : base * 2;
    playTone({
      type: 'sine', freq, duration: 1.8, volume: 0.035, attack: 0.3,
      destination: ambientBus || undefined,
    });
    twinkleTimer = state.chapter === 2 ? rand(2.5, 5) : rand(5, 10);
  }

  function init() {
    const hasSettings = loadSettings();
    resetShip();
    bindInput();
    buildUpgradePanel();
    applyStaticTranslations();
    muteBtn.textContent = state.muted ? '🔇' : '🔊';

    if (!hasSettings) {
      openLangModal();
    }

    if (hasSavedProgress()) {
      promptContinue();
    } else {
      showToast(tr('firstVisitTip'), 7000);
    }

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
    saveBtn.addEventListener('click', manualSave);
    closeDockBtn.addEventListener('click', undock);
    muteBtn.addEventListener('click', toggleMute);
    langBtn.addEventListener('click', openLangModal);
    langKoBtn.addEventListener('click', () => setLanguage('ko'));
    langEnBtn.addEventListener('click', () => setLanguage('en'));
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    bindTouchControls();
  }

  function toggleFullscreen() {
    const el = document.querySelector('.game-wrap');
    const isFull = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFull) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el).catch(() => {});
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document).catch(() => {});
    }
  }

  function bindTouchControls() {
    const STICK_RADIUS = 42;

    function updateStickFromEvent(e) {
      const rect = touchStick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist_ = Math.hypot(dx, dy);
      const clampedDist = Math.min(dist_, STICK_RADIUS);
      const angle = Math.atan2(dy, dx);
      state.touchStick.active = true;
      state.touchStick.angle = angle;
      state.touchStick.magnitude = clampedDist / STICK_RADIUS;
      touchStickKnob.style.transform = `translate(${Math.cos(angle) * clampedDist}px, ${Math.sin(angle) * clampedDist}px)`;
      touchStick.classList.add('active');
    }

    function resetStick() {
      state.touchStick.active = false;
      state.touchStick.magnitude = 0;
      touchStickKnob.style.transform = 'translate(0, 0)';
      touchStick.classList.remove('active');
    }

    touchStick.addEventListener('pointerdown', (e) => {
      unlockAudio();
      touchStick.setPointerCapture(e.pointerId);
      updateStickFromEvent(e);
    });
    touchStick.addEventListener('pointermove', (e) => {
      if (state.touchStick.active) updateStickFromEvent(e);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) => {
      touchStick.addEventListener(evt, resetStick);
    });

    const bindHoldButton = (btn, code) => {
      btn.addEventListener('pointerdown', (e) => {
        unlockAudio();
        btn.setPointerCapture(e.pointerId);
        state.keys[code] = true;
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) => {
        btn.addEventListener(evt, () => { state.keys[code] = false; });
      });
    };
    bindHoldButton(touchFireBtn, 'KeyF');
    bindHoldButton(touchActionBtn, 'Space');
  }

  function buildUpgradePanel() {
    resourcePricesEl.innerHTML = Object.keys(RESOURCE_TYPES).map((k) => {
      const info = RESOURCE_TYPES[k];
      return `<span class="res"><span class="dot" style="background:${info.color}"></span>${resourceName(k)} ${info.price}</span>`;
    }).join('');
    upgradeListEl.innerHTML = '';
    Object.keys(UPGRADES).forEach((key) => {
      const row = document.createElement('div');
      row.className = 'upgrade-row';
      const info = document.createElement('div');
      info.className = 'info';
      info.innerHTML = `<b>${upgradeLabel(key)}</b><small id="lvl-${key}"></small>`;
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
        lvlEl.textContent = tr('levelMax', lvl);
        btn.textContent = tr('maxBtn');
        btn.disabled = true;
      } else {
        const cost = upgradeCost(key);
        const note = key === 'weapon' ? weaponUpgradeNote(lvl + 1) : '';
        lvlEl.textContent = tr('levelUp', lvl, lvl + 1, note);
        btn.textContent = tr('costCredits', cost);
        btn.disabled = state.credits < cost;
      }
    });
    dockCreditsEl.textContent = tr('dockCredits', state.credits);
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
    const parts = [];
    Object.keys(state.cargo).forEach((k) => {
      const count = Math.floor(state.cargo[k]);
      if (count <= 0) { state.cargo[k] = 0; return; }
      const subtotal = Math.round(count * RESOURCE_TYPES[k].price);
      total += subtotal;
      parts.push(`${resourceName(k)} ×${count} (${subtotal})`);
      state.cargo[k] = 0;
    });
    state.credits += total;
    refreshUpgradePanel();
    if (parts.length) {
      showToast(tr('soldToast', parts.join(' · '), total), 4500);
    }
  }

  function dock() {
    state.docked = true;
    state.ship.vx = 0;
    state.ship.vy = 0;
    state.fuel = maxFuel();
    state.hull = maxHull();
    state.predator = null;
    state.fuelEmptyTimer = 0;
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
    // Credits, upgrades, and chapter progress persist through death (see saveGame) --
    // dying costs you your current cargo and sends you back to the station, not your whole save.
    state.ship.x = STATION.x;
    state.ship.y = STATION.y - 140;
    state.ship.vx = 0;
    state.ship.vy = 0;
    state.ship.angle = -Math.PI / 2;
    state.cargo = { iron: 0, gold: 0, crystal: 0 };
    state.bullets = [];
    state.bossBullets = [];
    state.gameOver = false;
    state.mining = null;
    state.invuln = 2;
    state.toastTimer = 0;
    state.predator = null;
    state.fuelEmptyTimer = 0;
    state.riftTransition = null;
    resetShip();
    hideMessage();
    toastEl.classList.add('hidden');
    bossBar.classList.add('hidden');
    showToast(tr('restartToast'), 5000);
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
    if (state.riftTransition) {
      state.riftTransition.t += dt;
      addShake(3);
      if (state.riftTransition.t >= state.riftTransition.duration) state.riftTransition = null;
    }
    const ship = state.ship;
    const keys = state.keys;

    if (!state.docked) {
      const stick = state.touchStick;
      if (stick.active) {
        let diff = stick.angle - ship.angle;
        diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        const maxTurn = turnSpeed() * dt;
        ship.angle += clamp(diff, -maxTurn, maxTurn);
      } else {
        const turning = (keys['ArrowLeft'] || keys['KeyA'] ? -1 : 0) + (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0);
        ship.angle += turning * turnSpeed() * dt;
      }

      const wantsThrust = ((keys['ArrowUp'] || keys['KeyW']) || (stick.active && stick.magnitude > 0.25)) && state.fuel > 0;
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
      if (ship.muzzleFlash > 0) ship.muzzleFlash = Math.max(0, ship.muzzleFlash - dt);
      if (keys['KeyF'] && ship.fireCooldown <= 0) {
        fireBullet();
        ship.fireCooldown = fireCooldownFor();
      }

      updateMining(dt);
      updateAsteroids(dt);
      updateStranding(dt);
      updatePredator(dt);
    }

    updateBullets(dt);
    updateBosses(dt);
    updateMobs(dt);
    updatePlanetRegen(dt);
    updateDamagePopups(dt);
    updateParticles(dt);
    updateSectorHud(dt);
    updateBossHud();
    updateLoopSounds();
    updateAmbientTwinkle(dt);

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
    const rate = miningRate() * RESOURCE_TYPES[target.type].mineMul * dt;
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

  function updateStranding(dt) {
    if (state.docked || state.fuel > 0) {
      state.fuelEmptyTimer = 0;
      return;
    }
    state.fuelEmptyTimer += dt;
    if (state.fuelEmptyTimer > PREDATOR_WARN_DELAY && !state.predator) {
      state.predator = makePredator();
      sfxPredatorWarn();
      showToast(tr('predatorWarn'), 4500);
    }
  }

  function updatePredator(dt) {
    if (!state.predator) return;
    const p = state.predator;
    const ship = state.ship;
    const dx = ship.x - p.x;
    const dy = ship.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      p.x += (dx / d) * PREDATOR_SPEED * dt;
      p.y += (dy / d) * PREDATOR_SPEED * dt;
      p.facing = Math.atan2(dy, dx);
    }
    if (d < PREDATOR_CATCH_RADIUS) {
      triggerEatenEnding();
    }
  }

  function triggerEatenEnding() {
    if (state.gameOver) return;
    state.gameOver = true;
    addShake(34);
    sfxEaten();
    spawnExplosion(state.ship.x, state.ship.y, '#8a0018', 26, 50);
    showMessage(`
      <div>${tr('eatenMessage')}</div>
      <div style="margin-top:6px;color:#ffe08a;">${tr('finalCredits', state.credits)}</div>
      <button id="restartBtn">${tr('restartBtn')}</button>
    `);
    document.getElementById('restartBtn').addEventListener('click', restart);
  }

  function triggerGameOver() {
    if (state.gameOver) return;
    state.gameOver = true;
    sfxGameOver();
    spawnExplosion(state.ship.x, state.ship.y, '#ffb366', 30, 70);
    showMessage(`
      <div>${tr('hullDestroyed')}</div>
      <div style="margin-top:6px;color:#ffe08a;">${tr('finalCredits', state.credits)}</div>
      <button id="restartBtn">${tr('restartBtn')}</button>
    `);
    document.getElementById('restartBtn').addEventListener('click', restart);
  }

  function fireBullet() {
    const ship = state.ship;
    const nose = 18;
    const tier = weaponVisualTier();
    const dmg = weaponDamage();
    const pierce = weaponPierce();

    const spawnBolt = (angleOffset, dmgMul, sideOffset) => {
      const angle = ship.angle + angleOffset;
      const perpAngle = ship.angle + Math.PI / 2;
      const ox = Math.cos(perpAngle) * sideOffset;
      const oy = Math.sin(perpAngle) * sideOffset;
      state.bullets.push({
        x: ship.x + Math.cos(ship.angle) * nose + ox,
        y: ship.y + Math.sin(ship.angle) * nose + oy,
        vx: Math.cos(angle) * BULLET_SPEED,
        vy: Math.sin(angle) * BULLET_SPEED,
        life: BULLET_LIFE,
        damage: dmg * dmgMul,
        pierce,
        tier,
      });
    };

    spawnBolt(0, 1, 0);
    if (hasSideShots()) {
      spawnBolt(0.14, 0.65, 11);
      spawnBolt(-0.14, 0.65, -11);
    }

    ship.muzzleFlash = 0.08;
    sfxLaser(tier);
  }

  function updateBullets(dt) {
    state.bullets = state.bullets.filter((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) return false;
      for (const boss of state.bosses) {
        if (!boss.alive) continue;
        if (b.hitIds && b.hitIds.has(boss.id)) continue;
        if (dist(b.x, b.y, boss.x, boss.y) < boss.hitRadius) {
          boss.hp -= b.damage;
          spawnDamagePopup(b.x, b.y, b.damage, '#8be9ff');
          if (boss.hp <= 0) defeatBoss(boss);
          else sfxLaserHit(b.tier);
          if (b.pierce > 0) {
            b.pierce -= 1;
            if (!b.hitIds) b.hitIds = new Set();
            b.hitIds.add(boss.id);
            continue;
          }
          return false;
        }
      }
      for (const mob of state.mobs) {
        if (!mob.alive) continue;
        if (b.hitIds && b.hitIds.has(mob.uid)) continue;
        if (dist(b.x, b.y, mob.x, mob.y) < mob.hitRadius) {
          mob.hp -= b.damage;
          spawnDamagePopup(b.x, b.y, b.damage, '#8be9ff');
          if (mob.hp <= 0) defeatMob(mob);
          else sfxLaserHit(b.tier);
          if (b.pierce > 0) {
            b.pierce -= 1;
            if (!b.hitIds) b.hitIds = new Set();
            b.hitIds.add(mob.uid);
            continue;
          }
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
    spawnDamagePopup(state.ship.x, state.ship.y - 22, dmg, '#ff6b6b');
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
          if (boss.id === 'dimensional') {
            Object.assign(boss, spawnDimensionalBoss());
          } else {
            Object.assign(boss, spawnBoss(BOSS_DEFS.find((d) => d.id === boss.id)));
          }
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

  function updateMobs(dt) {
    const ship = state.ship;
    state.mobs.forEach((mob) => {
      if (!mob.alive) {
        mob.respawnTimer -= dt;
        if (mob.respawnTimer <= 0) {
          const def = MOB_DEFS.find((d) => d.id === mob.id);
          Object.assign(mob, spawnMob(def));
        }
        return;
      }

      if (mob.spawnFlash > 0) mob.spawnFlash = Math.max(0, mob.spawnFlash - dt);

      const distToShip = dist(ship.x, ship.y, mob.x, mob.y);
      const aggro = distToShip < mob.aggroRange && !state.docked;
      mob.aggroed = aggro;

      let targetX, targetY;
      if (aggro) {
        targetX = ship.x;
        targetY = ship.y;
      } else {
        mob.wanderTimer -= dt;
        if (mob.wanderTimer <= 0) {
          mob.wanderTarget = {
            x: mob.anchor.x + rand(-260, 260),
            y: mob.anchor.y + rand(-260, 260),
          };
          mob.wanderTimer = rand(2, 4.5);
        }
        targetX = mob.wanderTarget.x;
        targetY = mob.wanderTarget.y;
      }

      const dx = targetX - mob.x;
      const dy = targetY - mob.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        mob.x += (dx / d) * mob.speed * dt;
        mob.y += (dy / d) * mob.speed * dt;
        mob.facing = Math.atan2(dy, dx);
      }
      mob.x = clamp(mob.x, 150, WORLD_W - 150);
      mob.y = clamp(mob.y, 150, WORLD_H - 150);

      if (!state.docked && state.invuln <= 0 && distToShip < mob.hitRadius * 0.6 + 14) {
        applyShipDamage(mob.contactDamage);
        const angle = Math.atan2(ship.y - mob.y, ship.x - mob.x);
        ship.vx += Math.cos(angle) * 160;
        ship.vy += Math.sin(angle) * 160;
      }
    });
  }

  function defeatMob(mob) {
    mob.alive = false;
    mob.respawnTimer = mob.respawnTime;
    state.credits += mob.reward;
    addShake(4);
    sfxMobDefeat();
    spawnExplosion(mob.x, mob.y, mob.color, 14, mob.radius * 0.7);
    spawnDamagePopup(mob.x, mob.y - 12, mob.reward, '#ffd24a', '+');
  }

  function defeatBoss(boss) {
    boss.alive = false;
    boss.respawnTimer = boss.respawnTime;
    state.credits += boss.reward;
    addShake(10 + boss.sector * 6);
    sfxBossDefeat();
    spawnExplosion(boss.x, boss.y, boss.color, boss.id === 'dimensional' ? 70 : 40, boss.radius * 0.9);
    const firstKill = !boss.defeatedOnce;
    if (boss.id === 'dimensional' && firstKill) {
      showToast(tr('dimensionalDefeat', boss.reward), 6000);
    } else if (boss.sector === 3 && firstKill) {
      showToast(tr('finalBossDefeat', bossName(boss), boss.reward), 5000);
    } else {
      showToast(tr('bossDefeat', bossTag(boss), bossName(boss), boss.reward), 3500);
    }
    boss.defeatedOnce = true;
    refreshUpgradePanel();

    if (state.chapter === 1 && boss.sector !== 4) {
      const allDefeated = state.bosses.filter((b) => b.sector !== 4).every((b) => b.defeatedOnce);
      if (allDefeated) triggerChapterTwo();
    }
  }

  function triggerChapterTwo() {
    state.chapter = 2;
    addShake(30);
    sfxDimensionalRift();
    state.bosses.push(spawnDimensionalBoss());
    showToast(tr('chapter2Toast'), 7000);
    state.riftTransition = { t: 0, duration: 2.8 };
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
    if (d < 3350) return 3;
    return 4;
  }

  function updateSectorHud(dt) {
    const d = dist(state.ship.x, state.ship.y, STATION.x, STATION.y);
    const sector = sectorAt(d);
    if (sector === 0) {
      sectorLabelEl.textContent = tr('sectorSafe');
    } else if (sector === 4) {
      if (state.chapter < 2) {
        sectorLabelEl.textContent = tr('sectorLocked');
      } else {
        const def = ALL_BOSS_DEFS.find((b) => b.sector === 4);
        sectorLabelEl.textContent = tr('sectorRift', bossName(def));
      }
    } else {
      const def = ALL_BOSS_DEFS.find((b) => b.sector === sector);
      sectorLabelEl.textContent = tr('sectorN', sector, bossName(def));
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
    bossNameEl.textContent = bossName(nearest);
    bossTagEl.textContent = bossTag(nearest);
    bossHpFill.style.width = `${clamp((nearest.hp / nearest.hpMax) * 100, 0, 100)}%`;
  }

  function updateHud() {
    fuelBar.style.width = `${(state.fuel / maxFuel()) * 100}%`;
    fuelBar.classList.toggle('empty', state.fuel <= 0 && !state.docked);
    hullBar.style.width = `${(state.hull / maxHull()) * 100}%`;
    cargoBar.style.width = `${(cargoTotal() / maxCargo()) * 100}%`;
    cargoText.textContent = `${Math.floor(cargoTotal())} / ${maxCargo()}`;
    creditsText.textContent = state.credits;
    cargoBreakdownEl.innerHTML = Object.keys(RESOURCE_TYPES).map((k) => {
      const count = Math.floor(state.cargo[k]);
      return `<span class="res"><span class="dot" style="background:${RESOURCE_TYPES[k].color}"></span>${count}</span>`;
    }).join('');
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
    state.bosses.forEach((boss) => (boss.id === 'dimensional' ? drawDimensionalBoss(boss) : drawBoss(boss)));
    state.mobs.forEach(drawMob);
    state.bossBullets.forEach(drawBossBullet);
    drawPredator(state.predator);
    drawShip();
    state.bullets.forEach(drawPlayerBullet);
    drawParticles();
    drawDamagePopups();

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

    drawRiftTransition();
    drawMinimap();
  }

  function drawRiftTransition() {
    const rt = state.riftTransition;
    if (!rt) return;
    const p = clamp(rt.t / rt.duration, 0, 1);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const hue = (performance.now() / 4) % 360;
    const maxR = Math.max(canvas.width, canvas.height);

    ctx.save();

    // expanding vortex rings racing outward
    for (let i = 0; i < 6; i++) {
      const ringP = clamp(p * 1.5 - i * 0.09, 0, 1);
      if (ringP <= 0 || ringP >= 1) continue;
      const r = ringP * maxR * 0.8;
      ctx.strokeStyle = `hsla(${(hue + i * 30) % 360}, 85%, 65%, ${(1 - ringP) * 0.6})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // jagged cracks tearing outward from the center
    const crackLen = p * maxR * 0.75;
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = `hsla(${(hue + i * 15) % 360}, 90%, 75%, ${(1 - p) * 0.85})`;
      ctx.lineWidth = 2;
      let x = cx;
      let y = cy;
      let ang = (i / 14) * Math.PI * 2 + i * 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        ang += Math.sin(i * 3 + s * 1.7) * 0.5;
        const segLen = crackLen / 5;
        x += Math.cos(ang) * segLen;
        y += Math.sin(ang) * segLen;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // bright iridescent core flash, peaking early then fading
    const flashAlpha = p < 0.3 ? p / 0.3 : Math.max(0, 1 - (p - 0.3) / 0.45);
    const flashGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.65);
    flashGrad.addColorStop(0, `rgba(255,255,255,${flashAlpha * 0.9})`);
    flashGrad.addColorStop(0.4, `hsla(${hue}, 85%, 70%, ${flashAlpha * 0.5})`);
    flashGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = flashGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // vignette that eases off as the transition completes
    const vignetteAlpha = (1 - p) * 0.5;
    const vGrad = ctx.createRadialGradient(
      cx, cy, Math.min(canvas.width, canvas.height) * 0.3,
      cx, cy, maxR * 0.7
    );
    vGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vGrad.addColorStop(1, `rgba(0,0,0,${vignetteAlpha})`);
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.restore();
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
    ctx.fillText(tr('stationLabel'), 0, ringR + 24);
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
    ctx.fillText(resourceName(p.type), 0, p.radius + 26);
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

  function drawMob(mob) {
    if (!mob.alive) return;
    const t = performance.now() / 1000;
    ctx.save();
    ctx.translate(mob.x, mob.y);

    const glowR = mob.radius * (1.5 + 0.12 * Math.sin(t * 2 + mob.bodyPhase));
    const grad = ctx.createRadialGradient(0, 0, mob.radius * 0.2, 0, 0, glowR);
    grad.addColorStop(0, mob.glow);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();

    if (mob.spawnFlash > 0) {
      const p = 1 - mob.spawnFlash / 0.8;
      ctx.strokeStyle = mob.color;
      ctx.globalAlpha = 1 - p;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, mob.radius * (0.5 + p * 2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // small spiky body
    const spikes = 6;
    ctx.fillStyle = mob.core;
    ctx.strokeStyle = mob.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const r = mob.radius * (i % 2 === 0 ? 1 : 0.65) * (1 + 0.06 * Math.sin(t * 3 + i));
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // single eye facing travel direction, glows redder when aggroed
    const ex = Math.cos(mob.facing) * mob.radius * 0.32;
    const ey = Math.sin(mob.facing) * mob.radius * 0.32;
    ctx.fillStyle = mob.aggroed ? '#ff4b4b' : mob.color;
    ctx.beginPath();
    ctx.arc(ex, ey, mob.radius * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // tiny hp sliver above the mob when damaged
    if (mob.hp < mob.hpMax) {
      const w = mob.radius * 1.6;
      ctx.save();
      ctx.translate(mob.x - w / 2, mob.y - mob.radius - 12);
      ctx.fillStyle = 'rgba(10,12,26,0.8)';
      ctx.fillRect(0, 0, w, 4);
      ctx.fillStyle = mob.color;
      ctx.fillRect(0, 0, w * clamp(mob.hp / mob.hpMax, 0, 1), 4);
      ctx.restore();
    }
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

    drawBossLabelAndBar(boss, boss.color);

    ctx.restore();
  }

  function drawBossLabelAndBar(boss, labelColor) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(13, boss.radius * 0.1)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
    ctx.fillText(bossName(boss), 0, -boss.radius * 1.95);
    ctx.font = `${Math.max(10, boss.radius * 0.07)}px sans-serif`;
    ctx.fillStyle = labelColor;
    ctx.fillText(bossTag(boss), 0, -boss.radius * 1.95 + 16);
    ctx.shadowBlur = 0;

    const barW = boss.radius * 1.7;
    const barH = 7;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-barW / 2, -boss.radius * 1.65, barW, barH);
    ctx.fillStyle = labelColor;
    ctx.fillRect(-barW / 2, -boss.radius * 1.65, barW * clamp(boss.hp / boss.hpMax, 0, 1), barH);
  }

  function drawDimensionalBoss(boss) {
    if (!boss.alive) return;
    const t = performance.now() / 1000;
    const hue = (t * 40) % 360;
    const iridescent = `hsl(${hue}, 85%, 72%)`;
    const windup = boss.canShoot && boss.aggroed && boss.fireTimer < 0.35;
    const strobe = Math.sin(performance.now() / 45) > 0;

    ctx.save();
    ctx.translate(boss.x, boss.y);

    const dreadR = boss.radius * 2.8;
    const dreadGrad = ctx.createRadialGradient(0, 0, boss.radius * 0.5, 0, 0, dreadR);
    dreadGrad.addColorStop(0, `hsla(${hue}, 80%, 65%, 0.4)`);
    dreadGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = dreadGrad;
    ctx.beginPath();
    ctx.arc(0, 0, dreadR, 0, Math.PI * 2);
    ctx.fill();

    if (boss.spawnFlash > 0) {
      const p = 1 - boss.spawnFlash / 1.4;
      ctx.strokeStyle = iridescent;
      ctx.globalAlpha = 1 - p;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, boss.radius * (0.5 + p * 2.2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const baseR = boss.radius * 0.6;

    // debris shards caught in orbit around the singularity
    boss.shards.forEach((s) => {
      const a = t * s.speed + s.phase;
      const sx = Math.cos(a) * baseR * s.orbitR;
      const sy = Math.sin(a) * baseR * s.orbitR * 0.6;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a * 2);
      ctx.fillStyle = `hsl(${(hue + s.phase * 40) % 360}, 75%, 65%)`;
      ctx.beginPath();
      ctx.moveTo(0, -s.size);
      ctx.lineTo(s.size, s.size);
      ctx.lineTo(-s.size, s.size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // fractal, reality-tearing tendrils (jagged instead of smooth)
    const tendrilCount = 9;
    for (let i = 0; i < tendrilCount; i++) {
      const baseAngle = (i / tendrilCount) * Math.PI * 2 + t * 0.05;
      ctx.strokeStyle = `hsla(${(hue + i * 20) % 360}, 80%, 70%, 0.75)`;
      ctx.lineWidth = 2;
      let ang = baseAngle;
      let x = Math.cos(ang) * baseR;
      let y = Math.sin(ang) * baseR;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 1; s <= 4; s++) {
        ang += Math.sin(t * 3 + i * 2.3 + s) * 0.6;
        x += Math.cos(ang) * baseR * 0.32;
        y += Math.sin(ang) * baseR * 0.32;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // singularity core with a swirling event-horizon
    ctx.beginPath();
    ctx.arc(0, 0, baseR, 0, Math.PI * 2);
    ctx.fillStyle = boss.core;
    ctx.fill();
    for (let r = 0; r < 3; r++) {
      ctx.strokeStyle = `hsla(${(hue + r * 40) % 360}, 85%, 70%, ${0.5 - r * 0.12})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, baseR * (0.7 + r * 0.15), t * (1 + r * 0.3), t * (1 + r * 0.3) + Math.PI * 1.4);
      ctx.stroke();
    }

    // one giant iridescent eye, always watching the ship
    const fx = Math.cos(boss.facing);
    const fy = Math.sin(boss.facing);
    const eyeSize = baseR * 0.42;
    const eyeX = fx * baseR * 0.15;
    const eyeY = fy * baseR * 0.15;
    ctx.fillStyle = windup && strobe ? '#ffffff' : iridescent;
    ctx.shadowColor = iridescent;
    ctx.shadowBlur = windup ? 26 : 12;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(eyeX + fx * eyeSize * 0.35, eyeY + fy * eyeSize * 0.35, eyeSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(eyeX - eyeSize * 0.15, eyeY - eyeSize * 0.15, eyeSize * 0.12, 0, Math.PI * 2);
    ctx.fill();

    drawBossLabelAndBar(boss, iridescent);

    ctx.restore();
  }

  function drawPredator(p) {
    if (!p) return;
    const t = performance.now() / 1000;
    const r = 70;
    ctx.save();
    ctx.translate(p.x, p.y);

    const grad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.4);
    grad.addColorStop(0, 'rgba(90,0,20,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const wig = Math.sin(t * 2 + i) * 0.3;
      ctx.strokeStyle = 'rgba(20,4,8,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
      ctx.quadraticCurveTo(
        Math.cos(a + wig) * r * 1.3, Math.sin(a + wig) * r * 1.3,
        Math.cos(a + wig * 1.6) * r * 1.8, Math.sin(a + wig * 1.6) * r * 1.8
      );
      ctx.stroke();
    }

    const pts = p.bodyVerts.map((v) => {
      const rr = r * v.rMul * (1 + 0.05 * Math.sin(t + v.phase));
      return { x: Math.cos(v.angle) * rr, y: Math.sin(v.angle) * rr };
    });
    drawBlobPath(pts);
    ctx.fillStyle = '#0a0006';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,10,30,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const fx = Math.cos(p.facing);
    const fy = Math.sin(p.facing);
    const perpx = -fy;
    const perpy = fx;
    [-1, 1].forEach((side) => {
      const ex = fx * r * 0.4 + perpx * side * r * 0.25;
      const ey = fy * r * 0.4 + perpy * side * r * 0.25;
      ctx.fillStyle = 'rgba(255,40,50,0.9)';
      ctx.shadowColor = '#ff2832';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    state.particles.forEach((p) => {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawDamagePopups() {
    ctx.save();
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    state.damagePopups.forEach((p) => {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillText(String(p.text), p.x, p.y);
    });
    ctx.restore();
  }

  function drawPlayerBullet(b) {
    const tier = b.tier || 0;
    ctx.save();

    if (tier === 0) {
      ctx.fillStyle = '#8be9ff';
      ctx.shadowColor = '#8be9ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const angle = Math.atan2(b.vy, b.vx);
    const length = tier === 1 ? 14 : tier === 2 ? 20 : 27;
    const width = tier === 1 ? 3 : tier === 2 ? 4.2 : 5.5;
    const tailX = b.x - Math.cos(angle) * length;
    const tailY = b.y - Math.sin(angle) * length;

    const grad = ctx.createLinearGradient(b.x, b.y, tailX, tailY);
    if (tier >= 3) {
      const hue = (performance.now() / 6) % 360;
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, `hsl(${hue}, 90%, 68%)`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
    } else if (tier === 2) {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#5fd4ff');
      grad.addColorStop(1, 'rgba(95,212,255,0)');
    } else {
      grad.addColorStop(0, '#c8f4ff');
      grad.addColorStop(1, 'rgba(139,233,255,0)');
    }

    ctx.strokeStyle = grad;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.shadowColor = tier >= 3 ? `hsl(${(performance.now() / 6) % 360}, 90%, 65%)` : '#8be9ff';
    ctx.shadowBlur = 8 + tier * 3;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, width * 0.55, 0, Math.PI * 2);
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

    if (ship.muzzleFlash > 0) {
      const tier = weaponVisualTier();
      const flashR = 7 + tier * 3.5;
      const flashAlpha = ship.muzzleFlash / 0.08;
      const flashGrad = ctx.createRadialGradient(21, 0, 0, 21, 0, flashR);
      const flashColor = tier >= 3 ? `hsl(${(performance.now() / 6) % 360}, 90%, 70%)` : '#8be9ff';
      flashGrad.addColorStop(0, `rgba(255,255,255,${flashAlpha})`);
      flashGrad.addColorStop(0.5, flashColor);
      flashGrad.addColorStop(1, 'rgba(139,233,255,0)');
      ctx.fillStyle = flashGrad;
      ctx.beginPath();
      ctx.arc(21, 0, flashR, 0, Math.PI * 2);
      ctx.fill();
    }

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

    state.mobs.forEach((mob) => {
      if (!mob.alive) return;
      mapCtx.fillStyle = mob.color;
      mapCtx.globalAlpha = 0.75;
      mapCtx.beginPath();
      mapCtx.arc(mob.x * scale, mob.y * scale, 1.6, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.globalAlpha = 1;
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
