function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDate(d) {
  return d || '날짜 미상';
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

document.querySelectorAll('.subtab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.subtab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.subtab-panel').forEach((p) => p.classList.remove('active'));
    document.getElementById(btn.dataset.subtab).classList.add('active');
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

function renderNews() {
  const query = newsSearch.value.trim().toLowerCase();
  const category = newsFilter.value;

  const filtered = allPosts
    .filter((n) => category === 'all' || n.category === category)
    .filter((n) => !query || n.title.toLowerCase().includes(query) || n.summary.toLowerCase().includes(query))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  newsEmpty.hidden = filtered.length > 0;
  newsList.innerHTML = filtered.map((n) => `
    <article class="news-card">
      <div class="news-card-head">
        <div>
          <span class="chip">${escapeHtml(n.category)}</span>
          <h3>${escapeHtml(n.title)}</h3>
          <p class="meta">${escapeHtml(n.source || '출처 미상')} · ${formatDate(n.date)}</p>
        </div>
      </div>
      <p class="summary">${escapeHtml(n.summary)}</p>
      ${n.url ? `<a class="link-btn" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">원문 보기 →</a>` : ''}
    </article>
  `).join('');
}

// ---------- Indicators (shared render logic for macro / company) ----------
function renderIndicators(items, { listEl, emptyEl, groupKey, labelFn }) {
  const sorted = [...items].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  emptyEl.hidden = sorted.length > 0;

  const groups = new Map();
  for (const item of sorted) {
    const key = groupKey(item);
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
      html += `
        <div class="indicator-row">
          <div class="indicator-value ${trendClass}">${arrow} ${escapeHtml(entry.value)}${entry.unit ? ` ${escapeHtml(entry.unit)}` : ''}</div>
          <div class="indicator-info">
            <div class="name">${labelFn(entry)}</div>
            <div class="meta">${formatDate(entry.date)}${entry.note ? ` · ${escapeHtml(entry.note)}` : ''}</div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }
  listEl.innerHTML = html;
}

async function init() {
  const [postsRes, indicatorsRes] = await Promise.all([
    fetch('data/posts.json'),
    fetch('data/indicators.json'),
  ]);
  allPosts = await postsRes.json();
  const indicators = await indicatorsRes.json();

  renderNews();

  renderIndicators(indicators.macro || [], {
    listEl: document.getElementById('macroList'),
    emptyEl: document.getElementById('macroEmpty'),
    groupKey: (item) => item.region ? `${item.name} · ${item.region}` : item.name,
    labelFn: (item) => escapeHtml(item.region ? `${item.name} (${item.region})` : item.name),
  });

  renderIndicators(indicators.company || [], {
    listEl: document.getElementById('companyList'),
    emptyEl: document.getElementById('companyEmpty'),
    groupKey: (item) => `${item.company} · ${item.metric}`,
    labelFn: (item) => escapeHtml(`${item.company} - ${item.metric}`),
  });
}

init();
