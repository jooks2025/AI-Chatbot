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

// ---------- Sector news ----------
function renderSectorNews(data) {
  const grid = document.getElementById('sectorGrid');
  const updated = document.getElementById('sectorsUpdated');
  if (!data || !data.sectors) return;
  updated.textContent = data.updatedAt && data.updatedAt !== 'seed'
    ? `자동 업데이트 ${data.updatedAt} · 매일 07:00 KST 갱신`
    : '매일 07:00 KST 자동 갱신 (첫 수집 전이라 일부 섹터는 비어 있어요)';

  grid.innerHTML = Object.entries(data.sectors).map(([sector, items]) => {
    const body = (items && items.length)
      ? `<ul class="sector-news-list">${items.map((n) => `
          <li>
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
  return n >= 10000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 })
                    : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function marketItemHtml(it) {
  const hasChange = it.change !== null && it.change !== undefined;
  const cls = Number(it.change) >= 0 ? 'pos' : 'neg';
  const chg = hasChange ? fmtPct(it.change) : '';
  const unit = it.unit ? `<span class="mi-unit"> ${escapeHtml(it.unit)}</span>` : '';
  return `<div class="market-item">
    <div class="mi-name">${escapeHtml(it.name)}</div>
    <div class="mi-close">${fmtClose(it.close)}${unit}</div>
    <div class="mi-change ${cls}">${chg}</div>
  </div>`;
}

function renderMarket(data) {
  const strip = document.getElementById('marketStrip');
  const fxStrip = document.getElementById('marketFx');
  const updated = document.getElementById('marketUpdated');
  if (!data) return;
  updated.textContent = data.updatedAt && data.updatedAt !== 'seed'
    ? `업데이트 ${data.updatedAt}`
    : `기준 ${data.asOf || ''}`;
  const indices = data.indices || data.items || [];
  strip.innerHTML = indices.map(marketItemHtml).join('');
  if (fxStrip) fxStrip.innerHTML = (data.fx || []).map(marketItemHtml).join('');
}

// ---------- Heatmap ----------
function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function heatColor(change) {
  const cap = 15; // % scale for full saturation
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
function renderCompanies(companies, asOf) {
  const body = document.getElementById('companyBody');
  body.innerHTML = companies.map((c) => {
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
async function init() {
  const [postsRes, indicatorsRes, heatmapRes] = await Promise.all([
    fetch('data/posts.json'),
    fetch('data/indicators.json'),
    fetch('data/heatmap.json'),
  ]);
  allPosts = await postsRes.json();
  const indicators = await indicatorsRes.json();
  const heatmap = await heatmapRes.json();

  renderNews();
  renderHeatmap(heatmap);
  renderCompanies(indicators.companies || [], indicators.asOf);
  renderIndicatorList(indicators.macro || [], document.getElementById('macroList'), document.getElementById('macroEmpty'));
  renderIndicatorList(indicators.fx || [], document.getElementById('fxList'), document.getElementById('fxEmpty'));

  // 오늘의 시장 (없어도 나머지는 정상 동작)
  try {
    const marketRes = await fetch('data/market.json');
    if (marketRes.ok) renderMarket(await marketRes.json());
  } catch (e) {
    console.warn('market.json 로드 실패:', e);
  }

  // 산업별 뉴스 (없어도 나머지는 정상 동작)
  try {
    const sectorRes = await fetch('data/sector_news.json');
    if (sectorRes.ok) renderSectorNews(await sectorRes.json());
  } catch (e) {
    console.warn('sector_news.json 로드 실패:', e);
  }
}

init();
