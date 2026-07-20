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

// 난이도 배지 (왕초보/기본/심화)
const LEVEL_META = {
  '왕초보': { cls: 'lv-easy', icon: '🟢' },
  '기본': { cls: 'lv-mid', icon: '🟡' },
  '심화': { cls: 'lv-hard', icon: '🔴' },
};
function levelBadge(level) {
  const m = LEVEL_META[level];
  if (!m) return '';
  return `<span class="level-badge ${m.cls}">${m.icon} ${escapeHtml(level)}</span>`;
}

// 읽는 시간 추정 (한글 대략 분당 500자)
function readTime(text) {
  const len = String(text || '').replace(/\s/g, '').length;
  return Math.max(1, Math.round(len / 500));
}

// 본문 속 경제 용어에 점선 밑줄 → 탭하면 뜻 팝업 (glossary.json 재활용)
function linkifyTerms(rawText) {
  const text = String(rawText || '');
  if (!glossaryTerms.length) return escapeHtml(text);
  const terms = [...glossaryTerms]
    .filter((x) => x.t && x.t.length >= 2)
    .sort((a, b) => b.t.length - a.t.length);
  const used = new Set();
  let out = '';
  let i = 0;
  while (i < text.length) {
    let hit = null;
    for (const term of terms) {
      if (used.has(term.t)) continue;
      if (text.startsWith(term.t, i)) { hit = term; break; }
    }
    if (hit) {
      out += `<button type="button" class="term" data-def="${escapeHtml(hit.d)}">${escapeHtml(hit.t)}</button>`;
      used.add(hit.t);
      i += hit.t.length;
    } else {
      out += escapeHtml(text[i]);
      i += 1;
    }
  }
  return out;
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
      <div class="card-tags">
        <span class="${chipClass(n.category)}">${escapeHtml(n.category)}</span>
        ${levelBadge(n.level)}
        <span class="read-time">⏱️ ${readTime(n.summary)}분</span>
      </div>
      <h3>${escapeHtml(n.title)}</h3>
      ${n.impact ? `<p class="impact-line"><span class="impact-tag">내 삶에 미치는 영향</span> ${escapeHtml(n.impact)}</p>` : ''}
      <p class="meta">${escapeHtml(n.source || '출처 미상')} · ${formatDate(n.date)}</p>
      <p class="summary">${linkifyTerms(n.summary)}</p>
      ${n.url ? `<a class="link-btn" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">원문 보기 →</a>` : ''}
    </article>
  `).join('');
}

// 카드 클릭으로 펼치기/접기 (원문 링크·용어 팝업 클릭은 제외)
document.getElementById('newsList').addEventListener('click', (e) => {
  if (e.target.closest('a') || e.target.closest('.term')) return;
  const card = e.target.closest('.news-card');
  if (card) card.classList.toggle('open');
});

// ---------- 용어 팝업 (본문 속 용어 탭 → 뜻 보기) ----------
const termPop = document.createElement('div');
termPop.className = 'term-pop';
termPop.hidden = true;
document.body.appendChild(termPop);

function showTermPop(btn) {
  const def = btn.dataset.def || '';
  termPop.innerHTML = `<b>${escapeHtml(btn.textContent)}</b><span>${escapeHtml(def)}</span>`;
  termPop.hidden = false;
  const r = btn.getBoundingClientRect();
  const pw = Math.min(280, window.innerWidth - 24);
  termPop.style.width = pw + 'px';
  let left = r.left + window.scrollX + r.width / 2 - pw / 2;
  left = Math.max(12 + window.scrollX, Math.min(left, window.scrollX + window.innerWidth - pw - 12));
  termPop.style.left = left + 'px';
  termPop.style.top = (r.bottom + window.scrollY + 6) + 'px';
}
function hideTermPop() { termPop.hidden = true; }

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.term');
  if (btn) {
    e.stopPropagation();
    if (!termPop.hidden && termPop.dataset.for === btn.dataset.def) { hideTermPop(); return; }
    termPop.dataset.for = btn.dataset.def;
    showTermPop(btn);
    return;
  }
  if (!e.target.closest('.term-pop')) hideTermPop();
});
window.addEventListener('scroll', hideTermPop, { passive: true });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTermPop(); });

// ---------- Sector news ----------
const POS_WORDS = ['수주', '호황', '최대', '급증', '흑자', '신기록', '돌파', '상승', '성장', '반등', '확대', '호조', '수혜', '역대', '순항', '체결', '증가'];
const NEG_WORDS = ['급락', '하락', '감소', '부진', '적자', '위기', '사망', '리스크', '둔화', '충격', '파산', '악화', '축소', '우려', '경고', '규제', '공백', '지연', '탈락', '중단'];

function importanceClass(title) {
  const t = String(title);
  if (NEG_WORDS.some((w) => t.includes(w))) return 'neg';
  if (POS_WORDS.some((w) => t.includes(w))) return 'pos';
  return '';
}

// 산업별 소개·관련 종목·핵심 용어 (초보가 기사를 읽기 전에 '이 산업이 뭔지' 잡게)
const SECTOR_META = {
  '조선': {
    intro: '배를 만들어 파는 산업이에요. LNG선·친환경 선박 수주가 실적을 좌우하고, 수주가 쌓이면 몇 년치 일감이 확보돼요.',
    stocks: ['HD현대중공업', '삼성중공업', '한화오션', 'HD한국조선해양'],
    terms: [
      { t: '수주잔고', d: '이미 계약해 앞으로 만들 물량. 많을수록 미래 매출이 보장돼요.' },
      { t: '슈퍼사이클', d: '수요가 오래·강하게 이어지는 초호황 국면.' },
      { t: 'LNG선', d: '액화천연가스를 실어나르는 고부가가치 선박.' },
    ],
  },
  '건설': {
    intro: '집·도로·플랜트를 짓는 산업이에요. 금리, 부동산 경기, 정부 SOC 예산에 민감해요.',
    stocks: ['삼성물산', '현대건설', 'GS건설', 'DL이앤씨'],
    terms: [
      { t: 'PF', d: '프로젝트 파이낸싱. 개발 사업의 미래 수익을 담보로 받는 대출로, 부실해지면 건설사에 위험이 커져요.' },
      { t: '분양', d: '완공 전 아파트를 미리 파는 것.' },
      { t: '수주', d: '공사 계약을 따내는 것.' },
    ],
  },
  '반도체': {
    intro: 'AI·스마트폰의 두뇌를 만드는 한국 경제의 핵심 산업이에요. 메모리 가격 사이클을 크게 타요.',
    stocks: ['삼성전자', 'SK하이닉스', 'TSMC', '엔비디아'],
    terms: [
      { t: 'HBM', d: 'AI에 쓰는 초고속 메모리. 요즘 가장 인기 있는 제품이에요.' },
      { t: '파운드리', d: '설계도대로 칩을 대신 만들어주는 사업(TSMC가 1위).' },
      { t: '사이클', d: '가격이 올랐다 내렸다 반복되는 흐름.' },
    ],
  },
  'AI': {
    intro: '인공지능 모델과 인프라 산업이에요. 빅테크의 막대한 설비투자(CAPEX)가 관련주를 끌어올려요.',
    stocks: ['엔비디아', '마이크로소프트', '알파벳', '팔란티어'],
    terms: [
      { t: 'CAPEX', d: '설비·인프라에 쓰는 대규모 투자금.' },
      { t: 'LLM', d: '대규모 언어모델. ChatGPT 같은 AI의 핵심 엔진.' },
      { t: '데이터센터', d: 'AI를 돌리는 대형 서버 시설.' },
    ],
  },
  '에너지': {
    intro: '원유·가스·전력 산업이에요. 유가와 지정학 리스크에 따라 물가와 기업 비용이 출렁여요.',
    stocks: ['S-Oil', 'SK이노베이션', '엑슨모빌', '셰브론'],
    terms: [
      { t: 'WTI', d: '미국 서부텍사스 원유. 국제 유가의 기준이에요.' },
      { t: 'OPEC+', d: '산유국 연합. 생산량 조절로 유가에 영향을 줘요.' },
      { t: '정제마진', d: '원유를 가공해 파는 정유사의 핵심 수익 지표.' },
    ],
  },
  '금융': {
    intro: '은행·보험·증권 산업이에요. 금리가 오르면 예대마진이 커져 은행 실적에 유리해요.',
    stocks: ['KB금융', '신한지주', '하나금융', '삼성생명'],
    terms: [
      { t: '예대마진', d: '예금금리와 대출금리의 차이. 은행의 핵심 수익원.' },
      { t: 'NIM', d: '순이자마진. 은행이 돈을 얼마나 남기는지 보여줘요.' },
      { t: '배당', d: '이익 일부를 주주에게 나눠주는 것(금융주는 배당 매력이 커요).' },
    ],
  },
  '헬스케어': {
    intro: '제약·바이오·의료기기 산업이에요. 신약 임상 결과 하나에 주가가 크게 움직여요.',
    stocks: ['삼성바이오로직스', '셀트리온', '유한양행', '일라이릴리'],
    terms: [
      { t: '임상', d: '신약이 안전하고 효과 있는지 사람에게 시험하는 단계.' },
      { t: 'CDMO', d: '다른 회사 약을 대신 개발·생산해주는 사업.' },
      { t: 'FDA', d: '미국 식품의약국. 신약 허가의 관문이에요.' },
    ],
  },
  '부동산': {
    intro: '주택·상업용 부동산 시장이에요. 대출규제(DSR·LTV)와 금리가 집값을 좌우해요.',
    stocks: ['롯데리츠', 'SK리츠', '맥쿼리인프라'],
    terms: [
      { t: 'DSR', d: '소득 대비 갚아야 할 원리금 비율. 대출 한도를 정해요.' },
      { t: 'LTV', d: '집값 대비 빌릴 수 있는 비율.' },
      { t: '리츠(REITs)', d: '부동산에 투자해 임대수익을 나눠주는 상품.' },
    ],
  },
  '코인·가상자산': {
    intro: '비트코인·이더리움 등 디지털 자산이에요. 변동성이 크고 금리·달러 흐름에 민감해요.',
    stocks: ['비트코인', '이더리움', '코인베이스'],
    terms: [
      { t: '반감기', d: '비트코인 신규 발행량이 절반으로 주는 이벤트(약 4년마다).' },
      { t: '스테이블코인', d: '달러 등에 가치를 고정해 변동성을 줄인 코인.' },
      { t: '변동성', d: '가격이 얼마나 심하게 출렁이는지를 나타내요.' },
    ],
  },
  '세계경제': {
    intro: '미국·중국·유럽 등 글로벌 경기 흐름이에요. 환율·수출·금리 정책이 서로 얽혀 움직여요.',
    stocks: ['미국 경기', '중국 경기', '달러인덱스'],
    terms: [
      { t: '연준(Fed)', d: '미국 중앙은행. 세계 금리의 기준을 만들어요.' },
      { t: '무역수지', d: '수출에서 수입을 뺀 값.' },
      { t: '리세션', d: '경기 침체를 뜻하는 말.' },
    ],
  },
  '채권·금리': {
    intro: '국채·회사채처럼 돈을 빌려주고 이자를 받는 시장이에요. 금리가 오르면 채권 가격은 내려요.',
    stocks: ['미 10년물 국채', '한국 국고채', '회사채'],
    terms: [
      { t: '국채', d: '정부가 발행하는 채권. 가장 안전한 자산으로 꼽혀요.' },
      { t: '장단기 금리차', d: '장기금리에서 단기금리를 뺀 값. 역전되면 침체 신호로 봐요.' },
      { t: '듀레이션', d: '금리 변화에 채권 가격이 얼마나 민감한지.' },
    ],
  },
  '고용·노동': {
    intro: '일자리·임금·실업률 지표예요. 경기의 체온계이자 중앙은행 금리 결정의 핵심 근거예요.',
    stocks: ['실업률', '비농업고용', '임금상승률'],
    terms: [
      { t: '비농업고용(NFP)', d: '미국의 대표 고용지표. 매달 시장을 흔들어요.' },
      { t: '실업률', d: '일할 의사가 있는데 일자리를 못 구한 사람의 비율.' },
      { t: '완전고용', d: '사실상 일자리가 넘치는 상태.' },
    ],
  },
  '재테크': {
    intro: '월급 외 자산을 불리는 실전 지식이에요. 예적금·ETF·연금·절세 전략을 다뤄요.',
    stocks: ['ISA', '연금저축', 'ETF'],
    terms: [
      { t: 'ISA', d: '이자·배당을 절세해주는 만능 계좌.' },
      { t: 'ETF', d: '여러 종목을 묶어 한 번에 사는 상품.' },
      { t: '복리', d: '이자에 이자가 붙어 눈덩이처럼 불어나는 효과.' },
    ],
  },
  '쉬운 경제': {
    intro: '어려운 경제 개념을 생활 언어로 풀어주는 코너예요. 뉴스가 안 읽히면 여기부터 보세요!',
    stocks: [],
    terms: [
      { t: '기준금리', d: '중앙은행이 정하는 돈의 기본 가격.' },
      { t: '인플레이션', d: '물가가 계속 오르는 것.' },
      { t: '환율', d: '다른 나라 돈과 바꾸는 비율.' },
    ],
  },
};

function sectorTemp(items) {
  let pos = 0; let neg = 0;
  (items || []).forEach((n) => {
    const c = importanceClass(n.title);
    if (c === 'pos') pos += 1; else if (c === 'neg') neg += 1;
  });
  if (!items || !items.length) return null;
  if (pos > neg) return { cls: 'pos', label: `🟢 호재 우세 (${pos}·${neg})` };
  if (neg > pos) return { cls: 'neg', label: `🔴 악재 우세 (${pos}·${neg})` };
  return { cls: 'neu', label: `⚪ 혼조 (${pos}·${neg})` };
}

function renderSectorNews(data) {
  const grid = document.getElementById('sectorGrid');
  const updated = document.getElementById('sectorsUpdated');
  if (!data || !data.sectors) return;
  if (data.updatedAt && data.updatedAt !== 'seed') {
    const pretty = String(data.updatedAt).replace('T', ' ').replace(/[+-]\d{2}:\d{2}$/, '').slice(0, 16);
    updated.textContent = `자동 업데이트 ${pretty} KST · 15분마다 갱신 · 산업 소개·관련 종목은 고정 안내예요`;
  } else {
    updated.textContent = '15분마다 자동 갱신 (첫 수집 전이라 일부 섹터는 비어 있어요)';
  }

  grid.innerHTML = Object.entries(data.sectors).map(([sector, items]) => {
    const meta = SECTOR_META[sector];
    const temp = sectorTemp(items);
    const head = `<div class="sector-head-row">
        <h3>${escapeHtml(sector)}</h3>
        ${temp ? `<span class="sector-temp ${temp.cls}">${temp.label}</span>` : ''}
      </div>`;
    const intro = meta && meta.intro ? `<p class="sector-intro">${escapeHtml(meta.intro)}</p>` : '';
    const stocks = meta && meta.stocks && meta.stocks.length
      ? `<div class="sector-meta-row"><span class="sm-label">관련</span>${meta.stocks.map((s) =>
          `<span class="stock-chip">${escapeHtml(s)}</span>`).join('')}</div>`
      : '';
    const terms = meta && meta.terms && meta.terms.length
      ? `<div class="sector-meta-row"><span class="sm-label">용어</span>${meta.terms.map((x) =>
          `<button type="button" class="term" data-def="${escapeHtml(x.d)}">${escapeHtml(x.t)}</button>`).join('')}</div>`
      : '';
    const body = (items && items.length)
      ? `<ul class="sector-news-list">${items.map((n) => `
          <li class="${importanceClass(n.title)}">
            <a href="${escapeHtml(n.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.title)}</a>
            <span class="sector-news-meta">${escapeHtml(n.source || '')}${n.date ? ` · ${escapeHtml(n.date)}` : ''}</span>
          </li>`).join('')}</ul>`
      : '<p class="sector-empty">자동 수집 대기 중 — 다음 갱신에서 채워집니다.</p>';
    return `<div class="sector-card">${head}${intro}${stocks}${terms}${body}</div>`;
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
