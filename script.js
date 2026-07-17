function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDate(d) {
  return d || '날짜 미상';
}

function fmtPct(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ---------- News ----------
let allPosts = [];
const newsList = document.getElementById('newsList');
const newsEmpty = document.getElementById('newsEmpty');
const newsSearch = document.getElementById('newsSearch');
const newsFilter = document.getElementById('newsFilter');

newsSearch.addEventListener('input', renderNews);
newsFilter.addEventListener('change', renderNews);

function chipClass(cat) {
  if (cat === '지정학 리스크') return 'chip risk';
  if (cat === 'AI·기술') return 'chip ai';
  return 'chip';
}

function renderNews() {
  const query = newsSearch.value.trim().toLowerCase();
  const category = newsFilter.value;

  const filtered = allPosts
    .filter((n) => category === 'all' || n.category === category)
    .filter((n) => !query || n.title.toLowerCase().includes(query) || n.summary.toLowerCase().includes(query))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  newsEmpty.hidden = filtered.length > 0;
  newsList.innerHTML = filtered.map((n) => `
    <article class="news-card" data-cat="${escapeHtml(n.category)}">
      <span class="${chipClass(n.category)}">${escapeHtml(n.category)}</span>
      <h3>${escapeHtml(n.title)}</h3>
      <p class="meta">${escapeHtml(n.source || '출처 미상')} · ${formatDate(n.date)}</p>
      <p class="summary">${escapeHtml(n.summary)}</p>
      ${n.url ? `<a class="link-btn" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">원문 보기 →</a>` : ''}
    </article>
  `).join('');
}

// 카드 클릭으로 펼치기/접기 (원문 링크 클릭은 제외)
document.getElementById('newsList').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const card = e.target.closest('.news-card');
  if (card) card.classList.toggle('open');
});

// ---------- Sector news ----------
const POS_WORDS = ['수주', '호황', '최대', '급증', '흑자', '신기록', '돌파', '상승', '성장', '반등', '확대', '호조', '수혜', '역대', '순항', '체결', '증가'];
const NEG_WORDS = ['급락', '하락', '감소', '부진', '적자', '위기', '사망', '리스크', '둔화', '충격', '파산', '악화', '축소', '우려', '경고', '규제', '공백', '지연', '탈락', '중단'];

function importanceClass(title) {
  const t = String(title);
  if (NEG_WORDS.some((w) => t.includes(w))) return 'neg';
  if (POS_WORDS.some((w) => t.includes(w))) return 'pos';
  return '';
}

function renderSectorNews(data) {
  const grid = document.getElementById('sectorGrid');
  const updated = document.getElementById('sectorsUpdated');
  if (!data || !data.sectors) return;
  updated.textContent = data.updatedAt && data.updatedAt !== 'seed'
    ? `자동 업데이트 ${data.updatedAt} · 15분마다 갱신`
    : '15분마다 자동 갱신 (첫 수집 전이라 일부 섹터는 비어 있어요)';

  grid.innerHTML = Object.entries(data.sectors).map(([sector, items]) => {
    const body = (items && items.length)
      ? `<ul class="sector-news-list">${items.map((n) => `
          <li class="${importanceClass(n.title)}">
            <a href="${escapeHtml(n.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.title)}</a>
            <span class="sector-news-meta">${escapeHtml(n.source || '')}${n.date ? ` · ${escapeHtml(n.date)}` : ''}</span>
          </li>`).join('')}</ul>`
      : '<p class="sector-empty">자동 수집 대기 중 — 다음 갱신에서 채워집니다.</p>';
    return `<div class="sector-card"><h3>${escapeHtml(sector)}</h3>${body}</div>`;
  }).join('');
}

// ---------- Market board ----------
function fmtClose(v) {
  const n = Number(v);
  if (n >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 100) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function marketItemHtml(it, chartable) {
  const hasChange = it.change !== null && it.change !== undefined;
  const cls = Number(it.change) >= 0 ? 'pos' : 'neg';
  const chg = hasChange ? fmtPct(it.change) : '';
  const unit = it.unit ? `<span class="mi-unit"> ${escapeHtml(it.unit)}</span>` : '';
  const clickable = chartable ? ` clickable" data-chart="${escapeHtml(it.name)}` : '';
  const tip = it.note ? ` title="${escapeHtml(it.note)}"` : '';
  return `<div class="market-item${clickable}"${tip}>
    <div class="mi-name">${escapeHtml(it.name)}</div>
    <div class="mi-close">${fmtClose(it.close)}${unit}</div>
    <div class="mi-change ${cls}">${chg}</div>
  </div>`;
}

// ---------- 전날 증시 브리핑 ----------
function renderBrief(data) {
  const card = document.getElementById('briefCard');
  if (!card || !data || !Array.isArray(data.brief) || !data.brief.length) return;
  card.hidden = false;
  document.getElementById('briefLines').innerHTML =
    data.brief.map((l) => `<li>${escapeHtml(l)}</li>`).join('');
  const fng = document.getElementById('fngGauge');
  if (data.fng && data.fng.value != null) {
    const v = data.fng.value;
    const ko = v >= 75 ? '극단적 탐욕' : v >= 55 ? '탐욕' : v >= 45 ? '중립' : v >= 25 ? '공포' : '극단적 공포';
    fng.hidden = false;
    fng.textContent = `😱 공포·탐욕 ${v} · ${ko}`;
    fng.style.background = v >= 55 ? 'rgba(63,207,133,0.28)' : v <= 45 ? 'rgba(240,103,90,0.3)' : 'rgba(255,255,255,0.16)';
  }
}
document.getElementById('briefMore').addEventListener('click', () => {
  const target = document.getElementById('liveHead').hidden
    ? document.querySelector('.news-section-head')
    : document.getElementById('liveHead');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------- 용어사전 ----------
let glossaryTerms = [];
function renderGlossary(filter) {
  const list = document.getElementById('glossaryList');
  if (!list) return;
  const q = (filter || '').trim().toLowerCase();
  const items = glossaryTerms.filter((x) =>
    !q || x.t.toLowerCase().includes(q) || x.d.toLowerCase().includes(q));
  list.innerHTML = items.map((x) =>
    `<div class="glossary-item"><div class="gl-term">${escapeHtml(x.t)}</div><div class="gl-desc">${escapeHtml(x.d)}</div></div>`
  ).join('') || '<p class="empty-msg">검색 결과가 없어요.</p>';
}
document.getElementById('glossarySearch').addEventListener('input', (e) => renderGlossary(e.target.value));

// 용어 퀴즈: 설명을 보고 맞는 용어 고르기
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }
function renderQuiz() {
  const el = document.getElementById('quizCard');
  if (!el || glossaryTerms.length < 4) return;
  const pool = shuffle(glossaryTerms);
  const answer = pool[0];
  const choices = shuffle([answer, ...pool.slice(1, 4)]);
  el.innerHTML =
    `<div class="quiz-q">🧩 이 설명에 맞는 용어는?</div>` +
    `<div class="quiz-def">“${escapeHtml(answer.d)}”</div>` +
    `<div class="quiz-choices">${choices.map((c) =>
      `<button class="quiz-choice" data-correct="${c.t === answer.t}">${escapeHtml(c.t)}</button>`).join('')}</div>` +
    `<div class="quiz-feedback" id="quizFeedback"></div>`;
}
document.getElementById('quizCard').addEventListener('click', (e) => {
  const choice = e.target.closest('.quiz-choice');
  if (choice) {
    const correct = choice.dataset.correct === 'true';
    document.querySelectorAll('.quiz-choice').forEach((b) => {
      b.disabled = true;
      if (b.dataset.correct === 'true') b.classList.add('right');
    });
    if (!correct) choice.classList.add('wrong');
    document.getElementById('quizFeedback').innerHTML =
      (correct ? '✅ 정답!' : '❌ 아쉬워요, 정답은 초록색!') +
      ' <button class="quiz-next" id="quizNext" type="button">다음 문제 →</button>';
    return;
  }
  if (e.target.closest('#quizNext')) renderQuiz();
});

function renderMarket(data) {
  const strip = document.getElementById('marketStrip');
  const fxStrip = document.getElementById('marketFx');
  const updated = document.getElementById('marketUpdated');
  if (!data) return;
  if (data.updatedAt && data.updatedAt !== 'seed') {
    const pretty = String(data.updatedAt).replace('T', ' ').replace(/[+-]\d{2}:\d{2}$/, '').slice(0, 16);
    updated.textContent = `업데이트 ${pretty} KST · 15분마다 자동 (지수 클릭 시 차트)`;
  } else {
    updated.textContent = `기준 ${data.asOf || ''} · 15분마다 자동 (지수 클릭 시 차트)`;
  }
  const indices = data.indices || data.items || [];
  strip.innerHTML = indices.map((it) => marketItemHtml(it, true)).join('');
  if (fxStrip) fxStrip.innerHTML = (data.fx || []).map((it) => marketItemHtml(it, false)).join('');

  const extraStrip = document.getElementById('marketExtra');
  const extraLabel = document.getElementById('extraLabel');
  const extra = data.extra || [];
  if (extraStrip) {
    extraStrip.innerHTML = extra.map((it) => marketItemHtml(it, false)).join('');
    if (extraLabel) extraLabel.hidden = extra.length === 0;
  }
}

// ---------- 쉬운 경제 (자동 순환 로테이션) ----------
let eduTimer = null;
function renderEdu(data) {
  const band = document.getElementById('eduBand');
  if (!band || !data || !data.tips || !data.tips.length) return;
  const tips = [...data.tips].sort(() => Math.random() - 0.5); // 매번 순서 섞기
  band.innerHTML = `
    <span class="edu-lead">🧠 쉬운 경제</span>
    <div class="edu-rot" id="eduRot"></div>
    <button class="edu-nav" id="eduNext" type="button" aria-label="다음 상식">›</button>`;
  const rot = document.getElementById('eduRot');
  let i = 0;
  const show = () => {
    const t = tips[i % tips.length];
    rot.innerHTML = `<span class="edu-slide"><b>${escapeHtml(t.t)}</b> <span class="edu-desc">${escapeHtml(t.d)}</span></span>`;
  };
  const advance = () => { i += 1; show(); };
  show();
  const start = () => { clearInterval(eduTimer); eduTimer = setInterval(advance, 4500); };
  start();
  document.getElementById('eduNext').addEventListener('click', () => { advance(); start(); });
  // 마우스 올리면 잠깐 멈춤
  band.addEventListener('mouseenter', () => clearInterval(eduTimer));
  band.addEventListener('mouseleave', start);
}

// ---------- 실시간 경제 뉴스 (산업뉴스 자동 수집분을 홈에 요약) ----------
function renderLiveNews(sectorData) {
  const wrap = document.getElementById('liveNews');
  const head = document.getElementById('liveHead');
  if (!wrap || !sectorData || !sectorData.sectors) return;
  const all = [];
  Object.entries(sectorData.sectors).forEach(([sector, items]) => {
    (items || []).forEach((n) => all.push({ ...n, sector }));
  });
  all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const top = all.slice(0, 8);
  if (!top.length) return;
  head.hidden = false;
  wrap.innerHTML = top.map((n) => `
    <a class="live-item ${importanceClass(n.title)}" href="${escapeHtml(n.link)}" target="_blank" rel="noopener noreferrer">
      <span class="live-sector">${escapeHtml(n.sector)}</span>
      <span class="live-title">${escapeHtml(n.title)}</span>
      <span class="live-meta">${escapeHtml(n.source || '')} · ${escapeHtml(n.date || '')}</span>
    </a>`).join('');
}

// ---------- Economic events / rates band ----------
function renderEvents(data) {
  const ratesRow = document.getElementById('ratesRow');
  const calRow = document.getElementById('calendarRow');
  if (!data) return;
  ratesRow.innerHTML = (data.rates || []).map((r) => {
    const arrow = r.dir === 'up' ? '▲' : r.dir === 'down' ? '▼' : '';
    return `<span class="rate-pill" title="${escapeHtml(r.note || '')}">
      <span class="rp-name">${escapeHtml(r.name)}</span>
      <span class="rp-val">${escapeHtml(r.value)}</span>
      <span class="rp-dir ${r.dir || ''}">${arrow}</span>
    </span>`;
  }).join('');
  if ((data.calendar || []).length) {
    calRow.innerHTML = '<span class="events-sep"></span>' + data.calendar.map((c) =>
      `<span class="cal-item"><b>${escapeHtml((c.date || '').slice(5))}</b> ${escapeHtml(c.label)}</span>`
    ).join('');
  }
}

// ---------- Index price chart (modal) ----------
let chartSeries = {};
const chartModal = document.getElementById('chartModal');
const RANGE_LABELS = [['1d', '1일'], ['1mo', '1개월'], ['3mo', '3개월'], ['6mo', '6개월'], ['1y', '1년'], ['3y', '3년'], ['5y', '5년'], ['10y', '10년']];
let currentChartName = null;

function openChart(name, range) {
  currentChartName = name;
  const perName = chartSeries[name] || {};
  // 데이터가 있는 기간만 버튼으로 노출, 기본은 1개월(없으면 첫 사용가능 기간)
  const available = RANGE_LABELS.filter(([k]) => perName[k] && perName[k].closes && perName[k].closes.length >= 2);
  let rng = range || (available.some(([k]) => k === '1mo') ? '1mo' : (available[0] && available[0][0]));

  const rangeRow = document.getElementById('rangeRow');
  rangeRow.innerHTML = (available.length ? available : RANGE_LABELS).map(([k, label]) =>
    `<button class="range-btn${k === rng ? ' active' : ''}" data-range="${k}"${perName[k] ? '' : ' disabled'}>${label}</button>`
  ).join('');

  document.getElementById('chartTitle').textContent = name;
  const meta = document.getElementById('chartMeta');
  const canvas = document.getElementById('chartCanvas');
  const s = perName[rng];
  if (!s || !s.closes || s.closes.length < 2) {
    meta.textContent = '차트 데이터 준비 중이에요 (다음 자동 갱신에서 채워집니다).';
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  } else {
    drawLineChart(canvas, s);
    const cs = s.closes;
    const first = cs[0], last = cs[cs.length - 1];
    const pct = ((last - first) / first * 100);
    const cls = pct >= 0 ? 'pos' : 'neg';
    const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: n < 100 ? 2 : 0 });
    document.getElementById('chartStats').innerHTML =
      `<span class="cur">현재<b>${fmt(last)}</b></span>` +
      `<span>시작<b>${fmt(first)}</b></span>` +
      `<span>최고<b>${fmt(Math.max(...cs))}</b></span>` +
      `<span>최저<b>${fmt(Math.min(...cs))}</b></span>`;
    meta.innerHTML = `${escapeHtml(s.dates[0])} → ${escapeHtml(s.dates[s.dates.length - 1])} · <span class="${cls}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</span>`;
  }
  chartModal.hidden = false;
}

// 차트 위에서 마우스를 움직이면 해당 지점의 날짜·값을 툴팁으로 보여준다.
let chartPoints = [];
(function () {
  const canvas = document.getElementById('chartCanvas');
  const tip = document.getElementById('chartTip');
  if (!canvas || !tip) return;
  canvas.addEventListener('mousemove', (e) => {
    if (!chartPoints.length) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    let nearest = chartPoints[0];
    for (const p of chartPoints) if (Math.abs(p.x - mx) < Math.abs(nearest.x - mx)) nearest = p;
    const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: n < 100 ? 2 : 0 });
    tip.textContent = `${nearest.date} · ${fmt(nearest.value)}`;
    tip.style.left = (nearest.x / scaleX) + 'px';
    tip.style.top = (nearest.y / (canvas.height / rect.height)) + 'px';
    tip.style.opacity = '1';
  });
  canvas.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
})();

document.getElementById('rangeRow').addEventListener('click', (e) => {
  const btn = e.target.closest('.range-btn');
  if (btn && !btn.disabled && currentChartName) openChart(currentChartName, btn.dataset.range);
});

function drawLineChart(canvas, s) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, pad = 34;
  ctx.clearRect(0, 0, W, H);
  const cs = s.closes;
  const min = Math.min(...cs), max = Math.max(...cs);
  const rng = (max - min) || 1;
  const x = (i) => pad + (W - pad * 2) * (i / (cs.length - 1));
  const y = (v) => pad + (H - pad * 2) * (1 - (v - min) / rng);
  chartPoints = cs.map((v, i) => ({ x: x(i), y: y(v), value: v, date: (s.dates && s.dates[i]) || '' }));
  const up = cs[cs.length - 1] >= cs[0];
  const line = up ? '#12905a' : '#d1493c';
  // grid
  const css = getComputedStyle(document.body);
  ctx.strokeStyle = 'rgba(120,130,150,0.2)'; ctx.lineWidth = 1;
  for (let g = 0; g <= 3; g++) {
    const gy = pad + (H - pad * 2) * g / 3;
    ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(W - pad, gy); ctx.stroke();
  }
  // area
  const grad = ctx.createLinearGradient(0, pad, 0, H - pad);
  grad.addColorStop(0, up ? 'rgba(18,144,90,0.22)' : 'rgba(209,73,60,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.moveTo(x(0), y(cs[0]));
  cs.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.lineTo(x(cs.length - 1), H - pad); ctx.lineTo(x(0), H - pad); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  // line
  ctx.beginPath(); ctx.moveTo(x(0), y(cs[0]));
  cs.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();
  // endpoint dot
  ctx.beginPath(); ctx.arc(x(cs.length - 1), y(cs[cs.length - 1]), 3.5, 0, Math.PI * 2);
  ctx.fillStyle = line; ctx.fill();
  // labels
  ctx.fillStyle = css.getPropertyValue('--text-muted') || '#888';
  ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(max.toLocaleString(), 2, y(max) + 4);
  ctx.fillText(min.toLocaleString(), 2, y(min) + 4);
}

chartModal.addEventListener('click', (e) => {
  if (e.target.hasAttribute('data-close')) chartModal.hidden = true;
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') chartModal.hidden = true; });
document.addEventListener('click', (e) => {
  const item = e.target.closest('.market-item.clickable');
  if (item) openChart(item.dataset.chart);
});

// ---------- Heatmap ----------
function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function heatColor(change) {
  const cap = 4; // 일일 등락 기준: ±4%에서 색이 가장 진해짐
  const t = Math.max(-1, Math.min(1, Number(change) / cap));
  const neutral = [58, 74, 102];   // slate that ties into navy
  const green = [18, 122, 74];
  const red = [178, 52, 44];
  const rgb = t >= 0 ? mix(neutral, green, t) : mix(neutral, red, -t);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function renderHeatmap(data) {
  document.getElementById('heatmapBasis').textContent = data.basis
    ? `기준: ${data.asOf || ''} · ${data.basis}`
    : '';
  const container = document.getElementById('heatmapGroups');
  container.innerHTML = (data.groups || []).map((g) => {
    const tiles = g.items.map((it) => {
      const pct = fmtPct(it.change) ?? '—';
      const big = Number(it.weight) >= 2 ? ' big' : '';
      return `
        <div class="heat-tile${big}" style="background:${heatColor(it.change)}" title="${escapeHtml(it.ticker)} ${pct}">
          <div class="heat-ticker">${escapeHtml(it.ticker)}</div>
          <div class="heat-name">${escapeHtml(it.name || '')}</div>
          <div class="heat-change">${pct}</div>
        </div>`;
    }).join('');
    return `<div class="heat-group">
      <p class="heat-group-title">${escapeHtml(g.name)}</p>
      <div class="heat-grid">${tiles}</div>
    </div>`;
  }).join('');
}

// ---------- Company fundamentals table ----------
let companyData = [];
let sortState = { key: null, dir: -1 };

function capValue(s) {
  if (!s) return -Infinity;
  const m = String(s).match(/([\d.]+)\s*([TBM])/i);
  if (!m) return -Infinity;
  const mult = { t: 1e12, b: 1e9, m: 1e6 }[m[2].toLowerCase()] || 1;
  return parseFloat(m[1]) * mult;
}

function sortedCompanies() {
  if (!sortState.key) return companyData;
  const k = sortState.key;
  return [...companyData].sort((a, b) => {
    const va = k === 'mktcap' ? capValue(a[k]) : (a[k] == null ? -Infinity : Number(a[k]));
    const vb = k === 'mktcap' ? capValue(b[k]) : (b[k] == null ? -Infinity : Number(b[k]));
    return (va - vb) * sortState.dir;
  });
}

function renderCompanies(companies, asOf) {
  if (companies) companyData = companies;
  const body = document.getElementById('companyBody');
  body.innerHTML = sortedCompanies().map((c) => {
    const per = c.per !== null && c.per !== undefined
      ? `${c.per}<span class="per-tag">${c.perType ? escapeHtml(c.perType) : ''}</span>`
      : '<span class="muted">—</span>';
    const pbr = c.pbr !== null && c.pbr !== undefined
      ? `${c.pbr}` : '<span class="muted">—</span>';
    const op = c.opMargin !== null && c.opMargin !== undefined
      ? `${c.opMargin}%` : '<span class="muted">—</span>';
    const cap = c.mktcap ? escapeHtml(c.mktcap) : '<span class="muted">—</span>';
    let ytd = '<span class="muted">—</span>';
    if (c.ytd !== null && c.ytd !== undefined) {
      const cls = Number(c.ytd) >= 0 ? 'pos' : 'neg';
      ytd = `<span class="${cls}">${fmtPct(c.ytd)}</span>`;
    }
    return `<tr>
      <td><span class="tk">${escapeHtml(c.ticker)}</span><span class="tk-name">${escapeHtml(c.name || '')}</span></td>
      <td><span class="grp-tag">${escapeHtml(c.group || '')}</span></td>
      <td class="num">${per}</td>
      <td class="num">${pbr}</td>
      <td class="num">${op}</td>
      <td class="num">${cap}</td>
      <td class="num">${ytd}</td>
      <td class="note-cell">${escapeHtml(c.note || '')}</td>
    </tr>`;
  }).join('');
}

// 펀더멘탈 표 헤더 클릭 정렬
document.querySelectorAll('#companyTable th.sortable').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    sortState.dir = sortState.key === key ? -sortState.dir : -1;
    sortState.key = key;
    document.querySelectorAll('#companyTable th.sortable').forEach((t) => t.removeAttribute('data-arrow'));
    th.setAttribute('data-arrow', sortState.dir < 0 ? '▼' : '▲');
    renderCompanies();
  });
});

// ---------- Indicator list (macro / fx) ----------
function renderIndicatorList(items, listEl, emptyEl) {
  const sorted = [...items].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  emptyEl.hidden = sorted.length > 0;

  const groups = new Map();
  for (const item of sorted) {
    const key = item.region ? `${item.name} · ${item.region}` : item.name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  let html = '';
  for (const [key, entries] of groups) {
    html += `<div class="indicator-group"><p class="indicator-group-title">${escapeHtml(key)}</p>`;
    entries.forEach((entry, idx) => {
      const prev = entries[idx + 1];
      const val = parseFloat(entry.value);
      let trendClass = '';
      let arrow = '';
      if (prev !== undefined) {
        const prevVal = parseFloat(prev.value);
        if (!isNaN(val) && !isNaN(prevVal)) {
          if (val > prevVal) { trendClass = 'up'; arrow = '▲'; }
          else if (val < prevVal) { trendClass = 'down'; arrow = '▼'; }
        }
      }
      const label = escapeHtml(entry.region ? `${entry.name} (${entry.region})` : entry.name);
      html += `
        <div class="indicator-row">
          <div class="indicator-value ${trendClass}">${arrow} ${escapeHtml(entry.value)}${entry.unit ? ` ${escapeHtml(entry.unit)}` : ''}</div>
          <div class="indicator-info">
            <div class="name">${label}</div>
            <div class="meta">${formatDate(entry.date)}${entry.note ? ` · ${escapeHtml(entry.note)}` : ''}</div>
          </div>
        </div>`;
    });
    html += `</div>`;
  }
  listEl.innerHTML = html;
}

// ---------- Init ----------
// 캐시된 옛 데이터가 보이지 않도록 항상 새로 받아온다.
function fetchData(path) {
  return fetch(path, { cache: 'no-store' });
}

async function init() {
  const [postsRes, heatmapRes] = await Promise.all([
    fetchData('data/posts.json'),
    fetchData('data/heatmap.json'),
  ]);
  allPosts = await postsRes.json();
  const heatmap = await heatmapRes.json();

  renderNews();
  renderHeatmap(heatmap);

  // 오늘의 시장 + 전날 브리핑 (없어도 나머지는 정상 동작)
  try {
    const marketRes = await fetchData('data/market.json');
    if (marketRes.ok) {
      const marketData = await marketRes.json();
      renderMarket(marketData);
      renderBrief(marketData);
    }
  } catch (e) {
    console.warn('market.json 로드 실패:', e);
  }

  // 용어사전
  try {
    const gRes = await fetchData('data/glossary.json');
    if (gRes.ok) { glossaryTerms = (await gRes.json()).terms || []; renderGlossary(''); renderQuiz(); }
  } catch (e) {
    console.warn('glossary.json 로드 실패:', e);
  }

  // 산업별 뉴스 + 홈 실시간 뉴스 (없어도 나머지는 정상 동작)
  try {
    const sectorRes = await fetchData('data/sector_news.json');
    if (sectorRes.ok) {
      const sectorData = await sectorRes.json();
      renderSectorNews(sectorData);
      renderLiveNews(sectorData);
    }
  } catch (e) {
    console.warn('sector_news.json 로드 실패:', e);
  }

  // 주요 금리·일정 (없어도 정상 동작)
  try {
    const evRes = await fetchData('data/events.json');
    if (evRes.ok) renderEvents(await evRes.json());
  } catch (e) {
    console.warn('events.json 로드 실패:', e);
  }

  // 쉬운 경제 (매크로 주석)
  try {
    const mRes = await fetchData('data/macro.json');
    if (mRes.ok) renderEdu(await mRes.json());
  } catch (e) {
    console.warn('macro.json 로드 실패:', e);
  }

  // 지수 차트 데이터 (클릭 시 사용)
  try {
    const chRes = await fetchData('data/charts.json');
    if (chRes.ok) chartSeries = (await chRes.json()).series || {};
  } catch (e) {
    console.warn('charts.json 로드 실패:', e);
  }
}

init();
