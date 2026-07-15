const STORAGE_KEYS = {
  news: 'econSite.news',
  macro: 'econSite.macro',
  company: 'econSite.company',
};

const state = {
  news: loadList(STORAGE_KEYS.news),
  macro: loadList(STORAGE_KEYS.macro),
  company: loadList(STORAGE_KEYS.company),
};

function loadList(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDate(d) {
  return d || '날짜 미상';
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
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
const newsForm = document.getElementById('newsForm');
const newsList = document.getElementById('newsList');
const newsEmpty = document.getElementById('newsEmpty');
const newsSearch = document.getElementById('newsSearch');
const newsFilter = document.getElementById('newsFilter');

newsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const entry = {
    id: uid(),
    title: document.getElementById('newsTitle').value.trim(),
    source: document.getElementById('newsSource').value.trim(),
    url: document.getElementById('newsUrl').value.trim(),
    category: document.getElementById('newsCategory').value,
    date: document.getElementById('newsDate').value,
    summary: document.getElementById('newsSummary').value.trim(),
    createdAt: Date.now(),
  };
  if (!entry.title || !entry.summary) return;
  state.news.unshift(entry);
  saveList(STORAGE_KEYS.news, state.news);
  newsForm.reset();
  document.getElementById('newsDate').value = todayStr();
  renderNews();
});

newsSearch.addEventListener('input', renderNews);
newsFilter.addEventListener('change', renderNews);

newsList.addEventListener('click', (e) => {
  const delBtn = e.target.closest('[data-delete-news]');
  if (!delBtn) return;
  const id = delBtn.dataset.deleteNews;
  state.news = state.news.filter((n) => n.id !== id);
  saveList(STORAGE_KEYS.news, state.news);
  renderNews();
});

function renderNews() {
  const query = newsSearch.value.trim().toLowerCase();
  const category = newsFilter.value;

  const filtered = state.news
    .filter((n) => category === 'all' || n.category === category)
    .filter((n) => !query || n.title.toLowerCase().includes(query) || n.summary.toLowerCase().includes(query))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);

  newsEmpty.hidden = filtered.length > 0;
  newsList.innerHTML = filtered.map((n) => `
    <article class="news-card">
      <div class="news-card-head">
        <div>
          <span class="chip">${escapeHtml(n.category)}</span>
          <h3>${escapeHtml(n.title)}</h3>
          <p class="meta">${escapeHtml(n.source || '출처 미상')} · ${formatDate(n.date)}</p>
        </div>
        <button class="icon-btn" data-delete-news="${n.id}" title="삭제" aria-label="삭제">✕</button>
      </div>
      <p class="summary">${escapeHtml(n.summary)}</p>
      ${n.url ? `<a class="link-btn" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">원문 보기 →</a>` : ''}
    </article>
  `).join('');
}

// ---------- Indicators (shared logic for macro / company) ----------
function setupIndicatorForm({ formId, fields, listKey, listEl, emptyEl, groupKey, labelFn }) {
  const form = document.getElementById(formId);
  const dateField = fields.find((f) => f.key === 'date');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const entry = { id: uid(), createdAt: Date.now() };
    for (const f of fields) {
      entry[f.key] = document.getElementById(f.inputId).value.trim();
    }
    if (!entry[fields[0].key] || entry.value === '' || entry.value === undefined) return;
    state[listKey].unshift(entry);
    saveList(STORAGE_KEYS[listKey], state[listKey]);
    form.reset();
    if (dateField) document.getElementById(dateField.inputId).value = todayStr();
    renderIndicators({ listKey, listEl, emptyEl, groupKey, labelFn });
  });

  listEl.addEventListener('click', (e) => {
    const delBtn = e.target.closest('[data-delete-id]');
    if (!delBtn) return;
    const id = delBtn.dataset.deleteId;
    state[listKey] = state[listKey].filter((item) => item.id !== id);
    saveList(STORAGE_KEYS[listKey], state[listKey]);
    renderIndicators({ listKey, listEl, emptyEl, groupKey, labelFn });
  });
}

function renderIndicators({ listKey, listEl, emptyEl, groupKey, labelFn }) {
  const items = [...state[listKey]].sort(
    (a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt
  );
  emptyEl.hidden = items.length > 0;

  const groups = new Map();
  for (const item of items) {
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
          <button class="icon-btn" data-delete-id="${entry.id}" title="삭제" aria-label="삭제">✕</button>
        </div>
      `;
    });
    html += `</div>`;
  }
  listEl.innerHTML = html;
}

// Macro indicators
setupIndicatorForm({
  formId: 'macroForm',
  fields: [
    { key: 'name', inputId: 'macroName' },
    { key: 'value', inputId: 'macroValue' },
    { key: 'unit', inputId: 'macroUnit' },
    { key: 'region', inputId: 'macroRegion' },
    { key: 'date', inputId: 'macroDate' },
    { key: 'note', inputId: 'macroNote' },
  ],
  listKey: 'macro',
  listEl: document.getElementById('macroList'),
  emptyEl: document.getElementById('macroEmpty'),
  groupKey: (item) => item.region ? `${item.name} · ${item.region}` : item.name,
  labelFn: (item) => escapeHtml(item.region ? `${item.name} (${item.region})` : item.name),
});

// Company indicators
setupIndicatorForm({
  formId: 'companyForm',
  fields: [
    { key: 'company', inputId: 'companyName' },
    { key: 'metric', inputId: 'companyMetric' },
    { key: 'value', inputId: 'companyValue' },
    { key: 'unit', inputId: 'companyUnit' },
    { key: 'date', inputId: 'companyDate' },
    { key: 'note', inputId: 'companyNote' },
  ],
  listKey: 'company',
  listEl: document.getElementById('companyList'),
  emptyEl: document.getElementById('companyEmpty'),
  groupKey: (item) => `${item.company} · ${item.metric}`,
  labelFn: (item) => escapeHtml(`${item.company} - ${item.metric}`),
});

// ---------- Export / Import / Clear ----------
document.getElementById('exportBtn').addEventListener('click', () => {
  const payload = {
    news: state.news,
    macro: state.macro,
    company: state.company,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `econ-briefing-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data.news)) state.news = data.news;
      if (Array.isArray(data.macro)) state.macro = data.macro;
      if (Array.isArray(data.company)) state.company = data.company;
      saveList(STORAGE_KEYS.news, state.news);
      saveList(STORAGE_KEYS.macro, state.macro);
      saveList(STORAGE_KEYS.company, state.company);
      renderAll();
    } catch {
      alert('올바른 JSON 파일이 아니에요.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (!confirm('저장된 모든 데이터를 삭제할까요? 이 작업은 되돌릴 수 없어요.')) return;
  state.news = [];
  state.macro = [];
  state.company = [];
  saveList(STORAGE_KEYS.news, state.news);
  saveList(STORAGE_KEYS.macro, state.macro);
  saveList(STORAGE_KEYS.company, state.company);
  renderAll();
});

function renderAll() {
  renderNews();
  renderIndicators({
    listKey: 'macro',
    listEl: document.getElementById('macroList'),
    emptyEl: document.getElementById('macroEmpty'),
    groupKey: (item) => item.region ? `${item.name} · ${item.region}` : item.name,
    labelFn: (item) => escapeHtml(item.region ? `${item.name} (${item.region})` : item.name),
  });
  renderIndicators({
    listKey: 'company',
    listEl: document.getElementById('companyList'),
    emptyEl: document.getElementById('companyEmpty'),
    groupKey: (item) => `${item.company} · ${item.metric}`,
    labelFn: (item) => escapeHtml(`${item.company} - ${item.metric}`),
  });
}

// default date field to today
['newsDate', 'macroDate', 'companyDate'].forEach((id) => {
  document.getElementById(id).value = todayStr();
});

renderAll();
