(() => {
  'use strict';

  /* --------------------------------------------------------------- helpers */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad = (n) => String(n).padStart(2, '0');
  const fmtSize = (n) => !n ? '—' : n > 1024 ** 3 ? (n / 1024 ** 3).toFixed(2) + ' GB' : n > 1024 ** 2 ? (n / 1024 ** 2).toFixed(0) + ' MB' : (n / 1024).toFixed(0) + ' KB';
  const fmtNum = (n) => num(n).toLocaleString('en-US');
  const localDate = (ts) => ts ? new Date(ts * 1000) : null;
  const fmtTime = (ts) => { const d = localDate(ts); return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '--:--'; };
  const fmtDay = (ts) => { const d = localDate(ts); return d ? `${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : '--.--'; };
  const fmtFull = (ts) => { const d = localDate(ts); return d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '待定'; };
  const dayKey = (ts) => { const d = localDate(ts); return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : 'TBD'; };
  const dayLabel = (ts) => {
    const d = localDate(ts); if (!d) return '时间待定';
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((that - today) / 86400000);
    const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    if (diff === 0) return `今天 · ${week}`;
    if (diff === 1) return `明天 · ${week}`;
    if (diff === -1) return `昨天 · ${week}`;
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} · ${week}`;
  };
  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${Math.floor(diff / 86400000)} 天前`;
  };
  const fallbackSvg = (name) => {
    const s = String(name || '?').trim().slice(0, 2).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#0b1a26"/><polygon points="48,8 86,28 86,68 48,88 10,68 10,28" fill="none" stroke="#2c6a7c" stroke-width="1"/><text x="48" y="55" font-family="Arial" font-size="24" fill="#67e8ff" text-anchor="middle">${s}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  window.__logoFallback = (el, name) => { el.onerror = null; el.src = fallbackSvg(name); };
  const logoImg = (url, name, cls = '') => `<img class="${cls}" src="${esc(url || fallbackSvg(name))}" alt="${esc(name)}" loading="lazy" onerror="window.__logoFallback(this, ${esc(JSON.stringify(name))})" />`;
  const icon = (name, cls = '') => {
    const p = ICONS[name] || ICONS.dot;
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  };
  const statusPill = (s) => s === 'live' ? `<span class="live-badge"><i></i>LIVE</span>` : s === 'finished' ? `<span class="pill">已结束</span>` : `<span class="pill cyan">未开始</span>`;
  const changeHtml = (v) => {
    const s = String(v || '').trim();
    if (!s || s === '0' || s === '-') return `<span class="flat">—</span>`;
    if (s.startsWith('+')) return `<span class="up">▲ ${esc(s.slice(1))}</span>`;
    if (s.startsWith('-')) return `<span class="down">▼ ${esc(s.slice(1))}</span>`;
    return `<span class="flat">${esc(s)}</span>`;
  };
  const fallbackTeam = (id, name) => ({ id, name: name || '未知战队', logo: '', region: '', valveRank: 0, hltvRank: 0, valvePoint: 0, hltvPoint: 0 });

  /* --------------------------------------------------------------- icons */
  const ICONS = {
    home: '<path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="1"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M7.5 14h2M14.5 14h2M7.5 17.5h2"/>',
    ranking: '<path d="M5 20V10M12 20V4M19 20v-7"/><path d="M3 20h18"/>',
    teams: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c.4-4 2.4-6 5.5-6s5.1 2 5.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15 14.2c2.8-.4 4.8 1.5 5.2 5.1"/>',
    demo: '<circle cx="12" cy="12" r="8.5"/><path d="M10 8.5l6 3.5-6 3.5z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2.4 2.4-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6v.2h-3.4v-.2a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1L5.6 17l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.6-1H4v-3.4h.4a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9L5.6 7.6 8 5.2l.1.1a1.7 1.7 0 001.9.3 1.7 1.7 0 001-1.6V4h3.4v.2a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1 2.4 2.4-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.6 1h.2v3.4H20a1.7 1.7 0 00-1.6 1z"/>',
    search: '<circle cx="11" cy="11" r="6.2"/><path d="M16 16l4.2 4.2"/>',
    refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6"/>',
    star: '<path d="M12 3.6l2.5 5.1 5.6.8-4 4 .9 5.6L12 16.4 7 19.1l.9-5.6-4-4 5.6-.8z"/>',
    play: '<path d="M8 5.5l10 6.5-10 6.5z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
    folder: '<path d="M3.5 6.5h6l2 2h9v11h-17z"/>',
    close: '<path d="M5 5l14 14M19 5L5 19"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 9v5M12 17.2v.1"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.2 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.2-3.8-8.5S9.5 5.9 12 3.5z"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 11-8 0z"/><path d="M8 5H4.5v2a3.5 3.5 0 003.5 3.5M16 5h3.5v2a3.5 3.5 0 01-3.5 3.5M12 13v5M8.5 21h7M9.5 18h5"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3.8 20c.3-4 2.2-6 5.2-6s4.9 2 5.2 6"/><path d="M15.5 5.4a3 3 0 010 5.2M17 14.2c1.8.7 2.9 2.6 3.1 5.8"/>',
    activity: '<path d="M3 12h4l2.5-6 4 12 2.5-6h5"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="1"/><path d="M8 10V7a4 4 0 018 0v3"/>',
    disc: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/>',
    gamepad: '<path d="M7 8h10a5 5 0 015 5l-1 4a2 2 0 01-3.3 1.1L15 16H9l-2.7 2.1A2 2 0 013 17l-1-4a5 5 0 015-5z"/><path d="M7 11v4M5 13h4M16.5 12.2v.1M18.5 14.2v.1"/>',
    link: '<path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1.2-1.2"/>',
    filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="1"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    dot: '<circle cx="12" cy="12" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    terminal: '<path d="M4 4h16v16H4z"/><path d="M7 9l3 3-3 3M12 15h5"/>',
    database: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  };

  /* --------------------------------------------------------------- state */
  const S = {
    ready: false, booted: false,
    view: 'home',
    snapshot: null,
    matches: [], teams: [], valve: [], hltv: [], hltvOfficial: [],
    favorite: null, settings: {}, demos: [], cs2Path: '',
    teamMap: new Map(), formMap: new Map(),
    schStatus: 'all', schEvent: 'all', schQuery: '',
    rankKind: 'valve', rankRegion: '全部', rankQuery: '', rankLimit: 80,
    teamQuery: '', teamSort: 'valve', teamLimit: 60,
    demoJobs: {},
    major: null, majorPicks: {}, majorStage: 'stage1', majorSlot: null, majorLoading: false, majorError: '',
    modal: null,
    paletteOpen: false, paletteQuery: '', paletteSel: 0,
    lastSync: 0,
    auto: { enabled: true, intervalMs: 60000 },
  };

  const VIEWS = [
    { id: 'home', label: '作战总览', en: 'OVERVIEW', icon: 'home', eyebrow: 'COMMAND CENTER', title: '作战总览' },
    { id: 'schedule', label: '赛程矩阵', en: 'SCHEDULE', icon: 'calendar', eyebrow: 'MATCH MATRIX', title: '赛程矩阵' },
    { id: 'rankings', label: '世界排名', en: 'RANKINGS', icon: 'ranking', eyebrow: 'GLOBAL LADDER', title: '世界排名' },
    { id: 'teams', label: '战队档案', en: 'TEAMS', icon: 'teams', eyebrow: 'TEAM DOSSIER', title: '战队档案' },
    { id: 'major', label: 'Major 作业', en: 'PICKEM', icon: 'trophy', eyebrow: 'MAJOR PICKEM', title: 'Major 作业' },
    { id: 'demos', label: 'Demo 中枢', en: 'DEMO HUB', icon: 'demo', eyebrow: 'REPLAY VAULT', title: 'Demo 中枢' },
  ];
  const viewMeta = (id) => VIEWS.find(v => v.id === id) || VIEWS[0];

  /* --------------------------------------------------------------- boot */
  const bootLines = [
    '正在建立数据链路…',
    '校验 5E PLAY 赛事节点… OK',
    '载入 VALVE REGIONAL STANDINGS… OK',
    '载入 HLTV WORLD RANKING… OK',
    '重建战术数据矩阵… OK',
    'NEXUS 终端就绪',
  ];
  let bootStep = 0;
  const bootTimer = setInterval(() => {
    bootStep = Math.min(bootStep + 1, bootLines.length - 1);
    const el = $('#bootLog'); if (el) el.textContent = bootLines[bootStep];
    const bar = $('#bootBar'); if (bar) bar.style.width = `${18 + bootStep * 16}%`;
  }, 260);

  async function boot() {
    try {
      if (!window.nexus) throw new Error('NEXUS bridge 未加载');
      const snap = await window.nexus.bootstrap();
      hydrate(snap);
      clearInterval(bootTimer);
      $('#bootBar').style.width = '100%';
      $('#bootLog').textContent = 'NEXUS 终端就绪';
      setTimeout(() => {
        $('#boot').classList.add('out');
        $('#shell').classList.remove('hidden');
        setTimeout(() => $('#boot').remove(), 700);
        S.ready = true;
        render();
        toast('数据链路已建立', `${snap.matches.length} 场比赛 · ${snap.teams.length} 支战队 · ${snap.demos.length} 个本地 Demo`, 'ok');
      }, 260);
    } catch (e) {
      clearInterval(bootTimer);
      $('#bootLog').innerHTML = `<span style="color:#ff5470">链路建立失败：${esc(e.message)}</span><br><span style="color:#7f95a6">请检查 F 盘数据目录是否完整</span>`;
      $('#bootBar').style.background = '#ff5470';
    }
  }

  function hydrate(snap) {
    S.snapshot = snap;
    const now = Date.now() / 1000;
    S.matches = (snap.matches || []).map(m =>
      m.status === 'live' && m.planTs && now - m.planTs > 3 * 3600 ? { ...m, status: 'finished' } : m
    );
    S.teams = snap.teams || [];
    S.valve = snap.valve || [];
    S.hltv = snap.hltv || [];
    S.hltvOfficial = snap.hltvOfficial || [];
    S.favorite = snap.favorite;
    S.settings = snap.settings || {};
    if (snap.demos) S.demos = snap.demos;
    if (snap.cs2Path) S.cs2Path = snap.cs2Path;
    S.auto = snap.auto || S.auto;
    S.lastSync = snap.lastSync || 0;
    S.teamMap = new Map(S.teams.map(t => [t.id, t]));
    computeForms();
  }

  function computeForms() {
    S.formMap = new Map();
    const finished = S.matches.filter(m => m.status === 'finished' && m.winner).sort((a, b) => a.planTs - b.planTs);
    for (const m of finished) {
      const loser = m.winner === m.team1.id ? m.team2.id : m.team1.id;
      if (!S.formMap.has(m.winner)) S.formMap.set(m.winner, []);
      if (!S.formMap.has(loser)) S.formMap.set(loser, []);
      S.formMap.get(m.winner).push('W');
      S.formMap.get(loser).push('L');
    }
  }

  /* --------------------------------------------------------------- clock / chrome */
  function tick() {
    const d = new Date();
    const t = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const c = $('#syncClock'); if (c) c.textContent = t;
    const c2 = $('#sbClock'); if (c2) c2.textContent = t.slice(0, 5);
  }
  setInterval(tick, 1000); tick();

  function buildChrome() {
    $('#nav').innerHTML = VIEWS.map(v => `<button class="nav-item" data-view="${v.id}">${icon(v.icon)}<span>${v.label}</span><span class="nav-en">${v.en}</span></button>`).join('') +
      `<div class="nav-sep"></div><button class="nav-item" data-view="settings">${icon('settings')}<span>终端设置</span><span class="nav-en">SETUP</span></button>`;
    $('#btnMin').onclick = () => window.nexus.minimize();
    $('#btnMax').onclick = () => window.nexus.maximize();
    $('#btnClose').onclick = () => window.nexus.close();
    $('#btnSync').onclick = refreshData;
    $('#favChip').onclick = () => S.favorite && openTeam(S.favorite.id);
    $('#globalSearch').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); openPalette($('#globalSearch').value); }
      if (e.key === 'Escape') $('#globalSearch').blur();
    });
    $('#globalSearch').addEventListener('focus', () => { if ($('#globalSearch').value.trim()) openPalette($('#globalSearch').value); });
    const cleanup = window.nexus.onSync((d) => {
      const strip = $('#syncStrip'); if (!strip) return;
      strip.classList.remove('hidden');
      $('#syncText').textContent = d.message || '同步中…';
      $('#syncPct').textContent = `${Math.round(d.percent || 0)}%`;
      if (d.percent >= 100) setTimeout(() => strip.classList.add('hidden'), 900);
    });
    window.nexus.onAuto((info) => {
      const pill = $('#autoPill');
      if (!pill) return;
      pill.title = `上次自动同步 ${fmtTime(info.at / 1000)} · ${info.matches} 场比赛${info.changed ? ' · 有更新' : ''}`;
      pill.classList.add('flash');
      setTimeout(() => pill.classList.remove('flash'), 1000);
    });
    window.nexus.onDataUpdate((snap) => {
      const hadModal = !!S.modal;
      const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      hydrate(snap);
      renderFavChip();
      if (!hadModal && !typing) render(false);
      const pill = $('#autoPill');
      if (pill) { pill.classList.add('flash'); setTimeout(() => pill.classList.remove('flash'), 1200); }
      if (S.view === 'major' && !S.majorLoading && !S.majorSlot) loadMajor(true);
    });
    window.nexus.onWinState(({ maximized }) => document.body.classList.toggle('maximized', maximized));
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette($('#globalSearch').value); }
      if (e.key === 'Escape') { if (S.paletteOpen) closePalette(); else if (S.modal) closeModal(); }
    });
  }

  function renderFavChip() {
    const f = S.favorite;
    if (!f) { $('#favChip').innerHTML = `<span class="star">★</span><span>未设主队</span>`; return; }
    $('#favChip').innerHTML = `${logoImg(f.logo, f.name)}<span>${esc(f.name)}</span><span class="star">★</span>`;
  }

  /* --------------------------------------------------------------- nav / render */
  function navigate(view) {
    if (view === 'settings') {
      S.view = 'settings';
    } else {
      S.view = view;
    }
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === S.view));
    const meta = viewMeta(S.view);
    $('#pageEyebrow').textContent = S.view === 'settings' ? 'TERMINAL CONFIG' : meta.eyebrow;
    $('#pageTitle').textContent = S.view === 'settings' ? '终端设置' : meta.title;
    if (S.view === 'major' && !S.major && !S.majorLoading) loadMajor();
    render();
    $('#view').scrollTop = 0;
  }

  function render(resetScroll = true) {
    if (!S.ready) return;
    renderFavChip();
    const v = $('#view');
    if (S.view === 'home') v.innerHTML = renderHome();
    else if (S.view === 'schedule') v.innerHTML = renderSchedule();
    else if (S.view === 'rankings') v.innerHTML = renderRankings();
    else if (S.view === 'teams') v.innerHTML = renderTeams();
    else if (S.view === 'major') v.innerHTML = renderMajor();
    else if (S.view === 'demos') v.innerHTML = renderDemos();
    else if (S.view === 'settings') v.innerHTML = renderSettings();
    bindView();
    if (resetScroll) v.scrollTop = 0;
  }

  function rerenderKeepingFocus(selector) {
    const old = $(selector);
    const pos = old && typeof old.selectionStart === 'number' ? old.selectionStart : 0;
    render(false);
    requestAnimationFrame(() => {
      const el = $(selector);
      if (!el) return;
      el.focus();
      const p = Math.min(pos, el.value.length);
      el.setSelectionRange(p, p);
    });
  }

  function bindView() {
    const v = $('#view');
    v.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.view)));
    v.querySelectorAll('[data-team]').forEach(el => {
      el.addEventListener('click', (e) => { if (e.target.closest('[data-star]')) return; });
      el.addEventListener('dblclick', () => {
        if (el.dataset.team) openTeam(el.dataset.team);
        else if (el.dataset.hltvUrl) window.nexus.openExternal(el.dataset.hltvUrl);
      });
    });
    v.querySelectorAll('[data-star]').forEach(b => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      await setFavorite(b.dataset.star);
    }));
    v.querySelectorAll('[data-match]').forEach(el => el.addEventListener('click', () => openMatch(el.dataset.match)));
    v.querySelectorAll('[data-filter-status]').forEach(b => b.addEventListener('click', () => { S.schStatus = b.dataset.filterStatus; S.schQuery = ''; render(); }));
    v.querySelectorAll('[data-filter-event]').forEach(b => b.addEventListener('click', () => { S.schEvent = b.dataset.filterEvent; render(); }));
    v.querySelectorAll('[data-rank-kind]').forEach(b => b.addEventListener('click', () => { S.rankKind = b.dataset.rankKind; S.rankLimit = 80; render(); }));
    v.querySelectorAll('[data-rank-region]').forEach(b => b.addEventListener('click', () => { S.rankRegion = b.dataset.rankRegion; S.rankLimit = 80; render(); }));
    v.querySelectorAll('[data-team-sort]').forEach(b => b.addEventListener('click', () => { S.teamSort = b.dataset.teamSort; render(); }));
    v.querySelectorAll('[data-load-more]').forEach(b => b.addEventListener('click', () => {
      if (S.view === 'rankings') S.rankLimit += 80;
      if (S.view === 'teams') S.teamLimit += 60;
      render();
    }));
    v.querySelectorAll('[data-demo-play]').forEach(b => b.addEventListener('click', () => playDemo(b.dataset.demoPlay)));
    v.querySelectorAll('[data-demo-reveal]').forEach(b => b.addEventListener('click', () => window.nexus.revealDemo(b.dataset.demoReveal)));
    v.querySelectorAll('[data-demo-download]').forEach(b => b.addEventListener('click', () => downloadDemo(b.dataset.demoDownload)));
    v.querySelectorAll('[data-major-stage]').forEach(b => b.addEventListener('click', () => { S.majorStage = b.dataset.majorStage; S.majorSlot = null; render(); }));
    v.querySelectorAll('[data-major-reload]').forEach(b => b.addEventListener('click', () => loadMajor(true)));
    v.querySelectorAll('[data-major-slot]').forEach(b => b.addEventListener('click', () => {
      const [type, indexText] = String(b.dataset.majorSlot).split(':');
      const index = Number(indexText);
      const stage = majorStageById(S.majorStage);
      if (!stage) return;
      const pk = majorPickOf(stage.id);
      const id = (type === 'zero3' ? pk.zero3 : pk.advance)[index];
      if (id) majorRemovePick(type, index);
      else { S.majorSlot = { type, index }; render(); }
    }));
    v.querySelectorAll('[data-major-add]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const [type, ...rest] = String(b.dataset.majorAdd).split(':');
      majorAddPick(type, rest.join(':'));
    }));
    v.querySelectorAll('[data-major-lock]').forEach(b => b.addEventListener('click', lockMajorPick));
    v.querySelectorAll('[data-open-folder]').forEach(b => b.addEventListener('click', () => window.nexus.openFolder(b.dataset.openFolder)));
    v.querySelectorAll('[data-detect-cs2]').forEach(b => b.addEventListener('click', detectCs2));
    v.querySelectorAll('[data-setting]').forEach(b => b.addEventListener('click', async () => {
      const key = b.dataset.setting;
      if (key === 'autoRefresh') {
        const next = !S.settings.autoRefresh;
        S.settings = await window.nexus.setSettings({ autoRefresh: next });
        render();
      }
    }));
    v.querySelectorAll('[data-open-url]').forEach(b => b.addEventListener('click', () => window.nexus.openExternal(b.dataset.openUrl)));
    v.querySelectorAll('.sch-query').forEach(inp => inp.addEventListener('input', () => { S.schQuery = inp.value; rerenderKeepingFocus('.sch-query'); }));
    v.querySelectorAll('.sch-event-select').forEach(sel => sel.addEventListener('change', () => { S.schEvent = sel.value; render(); }));
    v.querySelectorAll('.rank-query').forEach(inp => inp.addEventListener('input', () => { S.rankQuery = inp.value; rerenderKeepingFocus('.rank-query'); }));
    v.querySelectorAll('.team-query').forEach(inp => inp.addEventListener('input', () => { S.teamQuery = inp.value; rerenderKeepingFocus('.team-query'); }));
  }

  async function setFavorite(id) {
    try {
      const fav = await window.nexus.setFavorite(id);
      S.favorite = fav;
      renderFavChip();
      if (S.view === 'home') render();
      toast('主队已锁定', `${fav.name} 已接入总览雷达`, 'ok');
    } catch (e) { toast('设置失败', e.message, 'err'); }
  }

  async function refreshData() {
    const btn = $('#btnSync');
    if (btn.disabled) return;
    btn.disabled = true; btn.classList.add('loading');
    try {
      const snap = await window.nexus.refresh();
      hydrate(snap);
      render();
      toast('同步完成', `已从 5E 数据节点更新 ${snap.matches.length} 场比赛与 ${snap.valve.length + snap.hltv.length} 条排名`, 'ok');
    } catch (e) {
      toast('同步失败', e.message, 'err');
    } finally {
      btn.disabled = false; btn.classList.remove('loading');
      $('#syncStrip').classList.add('hidden');
    }
  }

  /* --------------------------------------------------------------- prediction */
  function team(id) { return S.teamMap.get(id) || fallbackTeam(id); }
  function composite(t) {
    const arr = [t.valveRank, t.hltvRank].filter(x => x > 0);
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 250;
  }
  function formOf(id) {
    const f = S.formMap.get(id) || [];
    return f.slice(-8);
  }
  function formScore(id) {
    const f = formOf(id); if (!f.length) return 0.5;
    return (f.filter(x => x === 'W').length + 1) / (f.length + 2);
  }
  function h2hOf(a, b) {
    const ms = S.matches.filter(m => m.status === 'finished' && ((m.team1.id === a && m.team2.id === b) || (m.team1.id === b && m.team2.id === a)))
      .sort((x, y) => y.planTs - x.planTs).slice(0, 5);
    let wa = 0, wb = 0;
    for (const m of ms) { if (m.winner === a) wa++; else if (m.winner === b) wb++; }
    return { ms, wa, wb };
  }
  function predict(m) {
    const A = team(m.team1.id), B = team(m.team2.id);
    const ra = composite(A), rb = composite(B);
    const pRank = 1 / (1 + Math.pow(10, (rb - ra) / 18));
    const fa = formScore(A.id), fb = formScore(B.id);
    const pForm = fa / (fa + fb || 1);
    const h = h2hOf(A.id, B.id);
    const pH2h = h.ms.length ? (h.wa + 0.5) / (h.ms.length + 1) : 0.5;
    const hasOdds = m.odds1 > 0 && m.odds2 > 0 && (m.odds1 + m.odds2) > 90;
    const pOdds = hasOdds ? m.odds1 / (m.odds1 + m.odds2) : 0.5;
    let p;
    let weights;
    if (hasOdds) { weights = { odds: 0.46, rank: 0.24, form: 0.19, h2h: 0.11 }; p = pOdds * weights.odds + pRank * weights.rank + pForm * weights.form + pH2h * weights.h2h; }
    else { weights = { odds: 0, rank: 0.5, form: 0.3, h2h: 0.2 }; p = pRank * .5 + pForm * .3 + pH2h * .2; }
    p = clamp(p, 0.06, 0.94);
    const confidence = Math.round(clamp(54 + Math.abs(p - 0.5) * 86 + (hasOdds ? 4 : 0) + (h.ms.length ? 2 : 0), 55, 94));
    const factors = [
      { k: '市场赔率', v: hasOdds ? Math.round(pOdds * 100) : 0, w: weights.odds, hint: hasOdds ? `5E 赛前 ${m.odds1}% / ${m.odds2}%` : '暂无盘口，模型自主推算' },
      { k: '综合排名', v: Math.round(pRank * 100), w: weights.rank, hint: `V社 #${A.valveRank || '—'} / HLTV #${A.hltvRank || '—'} 对 V社 #${B.valveRank || '—'} / HLTV #${B.hltvRank || '—'}` },
      { k: '近期状态', v: Math.round(pForm * 100), w: weights.form, hint: `近 ${formOf(A.id).length || 0} 场 ${Math.round(fa * 100)}% 对 ${Math.round(fb * 100)}%` },
      { k: '交手记录', v: Math.round(pH2h * 100), w: weights.h2h, hint: h.ms.length ? `近 ${h.ms.length} 次 ${h.wa}-${h.wb}` : '无有效交手样本' },
    ];
    return { pA: p, pB: 1 - p, confidence, factors, hasOdds, h2h: h };
  }

  /* --------------------------------------------------------------- render: home */
  function renderHome() {
    const live = S.matches.filter(m => m.status === 'live');
    const upcoming = S.matches.filter(m => m.status === 'upcoming');
    const fav = S.favorite || null;
    const favMatches = fav ? S.matches.filter(m => (m.team1.id === fav.id || m.team2.id === fav.id) && m.status !== 'finished').sort((a, b) => a.planTs - b.planTs).slice(0, 3) : [];
    const liveFav = favMatches.find(m => m.status === 'live');
    const hero = liveFav || live[0] || favMatches[0] || upcoming[0] || S.matches.find(m => m.status === 'finished') || null;
    const next = [...live, ...upcoming].sort((a, b) => a.planTs - b.planTs).slice(0, 7);
    const demoReady = S.demos.filter(d => d.file).length;

    const stats = [
      { label: 'LIVE MATCHES', val: live.length, suffix: '场', hint: '实时数据链路', color: 'var(--red)' },
      { label: 'UPCOMING / 24H', val: upcoming.filter(m => m.planTs * 1000 < Date.now() + 86400000).length, suffix: '场', hint: '未来 24 小时', color: 'var(--cyan)' },
      { label: 'TRACKED TEAMS', val: S.teams.length, suffix: '支', hint: 'V社 / HLTV 双榜并集', color: 'var(--violet)' },
      { label: 'LOCAL DEMOS', val: demoReady, suffix: '个', hint: 'F 盘离线仓库', color: 'var(--lime)' },
    ];

    return `
      <div class="stats-strip">${stats.map(s => `<div class="stat-card" style="--accent:${s.color}"><div class="label">${s.label}</div><div class="val">${fmtNum(s.val)}<small>${s.suffix}</small></div><div class="hint">${s.hint}</div></div>`).join('')}</div>
      <div class="home-grid">
        ${hero ? renderHero(hero) : `<div class="panel hero"><div class="empty">${icon('activity')}<b>暂无赛事数据</b><span>点击右上角同步数据</span></div></div>`}
        <div class="side-stack">
          ${fav ? renderFavPanel(fav, favMatches) : `<div class="panel"><div class="empty">${icon('star')}<b>尚未设置主队</b><span>进入战队档案，双击战队并锁定主队</span></div></div>`}
          <div class="panel quick-panel">
            <div class="panel-head"><h3>快速指令</h3><span class="tag">QUICK OPS</span></div>
            <div class="panel-body">
              <button class="quick-btn" data-view="schedule">${icon('calendar')}<b>赛程矩阵</b><small>全部比赛时间线</small></button>
              <button class="quick-btn" data-view="rankings">${icon('ranking')}<b>世界排名</b><small>V社 / HLTV 双榜</small></button>
              <button class="quick-btn" data-view="teams">${icon('teams')}<b>战队档案</b><small>双击查看详情</small></button>
              <button class="quick-btn" data-view="demos">${icon('demo')}<b>Demo 中枢</b><small>下载 / 解压 / 观看</small></button>
            </div>
          </div>
        </div>
      </div>
      <div class="home-lower">
        <div class="panel">
          <div class="panel-head"><h3>赛程矩阵</h3><span class="tag">NEXT UP</span><div class="spacer"></div><button class="link-btn" data-view="schedule">全部赛程 ${icon('chevron')}</button></div>
          <div class="match-list">${next.map(renderMatchRow).join('') || `<div class="empty"><b>暂无待开赛程</b></div>`}</div>
        </div>
        <div class="side-stack" style="gap:14px">
          ${renderRankMini()}
          ${renderDemoMini()}
        </div>
      </div>`;
  }

  function renderHero(m) {
    const p = predict(m);
    const isLive = m.status === 'live';
    const isFinished = m.status === 'finished';
    const score1 = isLive || isFinished ? m.score1 : '—';
    const score2 = isLive || isFinished ? m.score2 : '—';
    const win1 = isFinished ? m.score1 > m.score2 : isLive ? m.score1 >= m.score2 : false;
    const win2 = isFinished ? m.score2 > m.score1 : isLive ? m.score2 > m.score1 : false;
    return `<div class="panel hero">
      <div class="hero-bg"></div><div class="hero-lines"></div>
      <div class="hero-top">
        ${isLive ? `<span class="live-badge"><i></i>LIVE</span>` : isFinished ? `<span class="pill">FINAL</span>` : `<span class="pill cyan">UPCOMING</span>`}
        <span class="event">${esc(m.event || '未知赛事')}</span>
        <span class="stage">${esc(m.stage || (m.bo ? `BO${m.bo}` : ''))}</span>
        <div class="spacer"></div>
        <span class="mono" style="font-size:8px;color:var(--dim)">${esc(fmtFull(m.planTs))}</span>
      </div>
      <div class="hero-main">
        <div class="hero-team">
          <div class="logo-ring">${logoImg(m.team1.logo, m.team1.name)}</div>
          <div class="name">${esc(m.team1.name)}</div>
          <div class="sub">V #${esc(S.teamMap.get(m.team1.id)?.valveRank || '—')} · H #${esc(S.teamMap.get(m.team1.id)?.hltvRank || '—')}</div>
        </div>
        <div class="hero-score">
          <div class="nums"><b class="${win1 ? 'win' : ''}">${score1}</b><span class="vs">:</span><b class="${win2 ? 'win' : ''}">${score2}</b></div>
          <div class="meta">${isLive ? `MAP ${m.maps.length || 0} · BO${m.bo || '?'}` : isFinished ? `BO${m.bo || '?'} · 已结束` : `BO${m.bo || '?'} · 即将开始`}</div>
        </div>
        <div class="hero-team">
          <div class="logo-ring">${logoImg(m.team2.logo, m.team2.name)}</div>
          <div class="name">${esc(m.team2.name)}</div>
          <div class="sub">V #${esc(S.teamMap.get(m.team2.id)?.valveRank || '—')} · H #${esc(S.teamMap.get(m.team2.id)?.hltvRank || '—')}</div>
        </div>
      </div>
      <div class="hero-bottom">
        <div class="prediction">
          <div class="pred-labels"><span>${esc(m.team1.name)} <b>${Math.round(p.pA * 100)}%</b></span><span>胜率预测 · ${p.confidence}% 置信</span><span><b>${Math.round(p.pB * 100)}%</b> ${esc(m.team2.name)}</span></div>
          <div class="pred-track"><i class="a" style="width:${p.pA * 100}%"></i><i class="b" style="width:${p.pB * 100}%"></i></div>
          <div class="pred-foot"><span>${p.hasOdds ? 'ODDS + RANK + FORM + H2H' : 'RANK + FORM + H2H'}</span><span>NEXUS PREDICTION ENGINE</span></div>
        </div>
        <div class="hero-cta">
          <button class="btn primary" data-match="${esc(m.id)}">${icon('crosshair')} 进入比赛终端</button>
          <button class="btn ghost" data-view="schedule">${icon('calendar')} 查看赛程</button>
        </div>
      </div>
    </div>`;
  }

  function renderFavPanel(fav, matches) {
    return `<div class="panel fav-panel">
      <div class="panel-head"><h3>主队雷达</h3><span class="tag">FAVORITE</span><div class="spacer"></div><span class="pill mag">★ LOCKED</span></div>
      <div class="fav-main" data-team="${esc(fav.id)}">
        <div class="logo-ring">${logoImg(fav.logo, fav.name)}</div>
        <div style="min-width:0">
          <div class="name">${esc(fav.name)}</div>
          <div class="meta">${esc(fav.region || '未知赛区')} · ${esc(fav.country || '国际纵队')}</div>
          <div class="fav-ranks"><span class="mini-rank">V <b>#${esc(fav.valveRank || '—')}</b></span><span class="mini-rank">H <b>#${esc(fav.hltvRank || '—')}</b></span></div>
        </div>
      </div>
      <div class="fav-next">${matches.length ? matches.map(m => {
        const isHome = m.team1.id === fav.id;
        const opp = isHome ? m.team2 : m.team1;
        return `<div class="fav-next-row" data-match="${esc(m.id)}"><div class="when"><b>${fmtDay(m.planTs)}</b>${fmtTime(m.planTs)}</div><div class="opp">${logoImg(opp.logo, opp.name)}<span>${esc(opp.name)}</span></div><div class="ev">${esc(m.event || '')}</div></div>`;
      }).join('') : `<div class="empty" style="padding:22px"><span>主队暂无待开赛程</span></div>`}</div>
    </div>`;
  }

  function renderMatchRow(m) {
    const p = predict(m);
    const live = m.status === 'live';
    const finished = m.status === 'finished';
    const t1win = finished && m.score1 > m.score2;
    const t2win = finished && m.score2 > m.score1;
    return `<div class="match-row" data-match="${esc(m.id)}">
      <div class="mr-time"><b>${live ? '<span class="live">● LIVE</span>' : fmtTime(m.planTs)}</b>${live ? `MAP ${m.maps.length}` : fmtDay(m.planTs)}</div>
      <div class="mr-teams">
        <div class="mr-team ${t1win ? 'win' : finished && !t1win ? 'lose' : ''}">${logoImg(m.team1.logo, m.team1.name)}<span>${esc(m.team1.name)}</span><b>${finished || live ? m.score1 : ''}</b></div>
        <div class="mr-team ${t2win ? 'win' : finished && !t2win ? 'lose' : ''}">${logoImg(m.team2.logo, m.team2.name)}<span>${esc(m.team2.name)}</span><b>${finished || live ? m.score2 : ''}</b></div>
      </div>
      <div class="mr-event"><b>${esc(m.event || '')}</b>${esc(m.stage || '')}</div>
      <div class="mr-pred">${statusPill(m.status)}<div style="margin-top:4px">${Math.round(p.pA * 100)}<span style="color:var(--dim)">%</span></div></div>
    </div>`;
  }

  function renderRankMini() {
    const list = S.valve.slice(0, 5);
    return `<div class="panel">
      <div class="panel-head"><h3>世界排名</h3><div class="spacer"></div><div class="mini-tabs"><button class="mini-tab active">V社</button><button class="mini-tab" data-view="rankings">HLTV</button></div></div>
      <div>${list.map((t, i) => `<div class="rank-mini-row" data-team="${esc(t.id)}"><span class="r">${String(i + 1).padStart(2, '0')}</span>${logoImg(t.logo, t.name)}<span class="n">${esc(t.name)}</span><span class="rg">${esc(t.region || '')}</span><span class="p">${fmtNum(t.points)}</span></div>`).join('')}</div>
    </div>`;
  }

  function renderDemoMini() {
    const list = S.demos.slice(0, 3);
    return `<div class="panel">
      <div class="panel-head"><h3>Demo 中枢</h3><div class="spacer"></div><button class="link-btn" data-view="demos">仓库 ${icon('chevron')}</button></div>
      <div class="demo-mini">${list.length ? list.map(d => `<div class="demo-mini-row"><div class="ic">${icon('demo')}</div><div class="t"><b>${esc((d.teams || []).join(' vs ') || d.matchId)}</b><span>${esc(d.event || '')} · ${esc(timeAgo(d.createdAt))}</span></div><div class="sz">${fmtSize(d.size)}</div></div>`).join('') : `<div class="empty" style="padding:22px">${icon('demo')}<span>暂无本地 Demo</span></div>`}</div>
    </div>`;
  }

  /* --------------------------------------------------------------- render: schedule */
  function renderSchedule() {
    const counts = { all: S.matches.length, live: S.matches.filter(m => m.status === 'live').length, upcoming: S.matches.filter(m => m.status === 'upcoming').length, finished: S.matches.filter(m => m.status === 'finished').length };
    const events = [...new Set(S.matches.map(m => m.event).filter(Boolean))].slice(0, 30);
    const q = S.schQuery.trim().toLowerCase();
    let list = S.matches.filter(m => (S.schStatus === 'all' || m.status === S.schStatus) &&
      (S.schEvent === 'all' || m.event === S.schEvent) &&
      (!q || `${m.team1.name} ${m.team2.name} ${m.event}`.toLowerCase().includes(q)));
    list.sort((a, b) => a.status === 'finished' ? b.planTs - a.planTs : a.planTs - b.planTs);
    const groups = new Map();
    for (const m of list) { const k = dayKey(m.planTs); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
    return `<div class="page-toolbar">
        <div class="seg">${[['all', '全部'], ['live', '进行中'], ['upcoming', '未开始'], ['finished', '已结束']].map(([k, l]) => `<button data-filter-status="${k}" class="${S.schStatus === k ? 'active' : ''}">${l} <span style="opacity:.55">${counts[k]}</span></button>`).join('')}</div>
        <div class="searchbox" style="width:230px;height:30px">${icon('search')}<input class="sch-query" value="${esc(S.schQuery)}" placeholder="过滤战队 / 赛事" /></div>
        <select class="sch-event-select" style="height:30px;background:#0a1520;border:1px solid var(--line);color:var(--muted);font-size:10px;padding:0 8px;max-width:210px">
          <option value="all">全部赛事</option>${events.map(e => `<option value="${esc(e)}" ${S.schEvent === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        <span class="mono" style="font-size:8px;color:var(--dim)">${list.length} MATCHES / ${groups.size} DAYS</span>
      </div>
      ${list.length ? [...groups.entries()].map(([k, ms]) => `<div class="date-group"><div class="date-label"><b>${esc(dayLabel(ms[0].planTs))}</b><span>${ms.length} 场</span></div><div class="schedule-list">${ms.map(renderScheduleRow).join('')}</div></div>`).join('') : `<div class="panel"><div class="empty">${icon('calendar')}<b>没有匹配的赛程</b><span>调整筛选条件或同步数据</span></div></div>`}`;
  }

  function renderScheduleRow(m) {
    const p = predict(m);
    const live = m.status === 'live', fin = m.status === 'finished';
    return `<div class="sch-row" data-match="${esc(m.id)}">
      <div class="sch-time">${live ? '<span style="color:var(--red)">● LIVE</span>' : fmtTime(m.planTs)}<span>${fmtDay(m.planTs)} · BO${m.bo || '?'}</span></div>
      <div class="sch-teams"><div class="sch-team">${logoImg(m.team1.logo, m.team1.name)}<span>${esc(m.team1.name)}</span></div><div class="sch-score">${fin || live ? `<b>${m.score1}</b><span class="vs">:</span><b>${m.score2}</b>` : `<span class="vs">VS</span>`}</div><div class="sch-team right">${logoImg(m.team2.logo, m.team2.name)}<span>${esc(m.team2.name)}</span></div></div>
      <div class="sch-event"><b>${esc(m.event || '')}</b>${esc(m.stage || '')}</div>
      <div class="sch-odds">${p.hasOdds ? `${m.odds1}% / ${m.odds2}%` : `预测 ${Math.round(p.pA * 100)}%`}<div class="odds-bar"><i style="width:${p.pA * 100}%"></i><i style="width:${p.pB * 100}%"></i></div></div>
      <div class="sch-action">${statusPill(m.status)}</div>
      <div class="sch-action"><button class="icon-btn" data-match="${esc(m.id)}" title="打开比赛">${icon('arrowRight')}</button></div>
    </div>`;
  }

  /* --------------------------------------------------------------- render: rankings */
  function hltvRows() {
    if (S.hltvOfficial.length) {
      const byNum = new Map(); const byName = new Map();
      for (const t of S.teams) { const m = (t.hltvUrl || '').match(/\/team\/(\d+)/); if (m) byNum.set(m[1], t); byName.set(t.name.toLowerCase(), t); }
      return S.hltvOfficial.map(o => {
        const n = (o.hltv_url || '').match(/\/team\/(\d+)/);
        const t = (n && byNum.get(n[1])) || byName.get(String(o.name).toLowerCase());
        return { id: t?.id || '', name: o.name, logo: o.logo || t?.logo, rank: o.rank, points: o.points, change: o.change, region: t?.region || '', roster: o.players || [], hltvUrl: o.hltv_url, source: 'official' };
      });
    }
    return S.hltv.map(t => ({ ...t, roster: [], source: '5e' }));
  }
  function rankRows() {
    let rows;
    if (S.rankKind === 'valve') rows = S.valve.map(t => {
      const tm = S.teamMap.get(t.id);
      return { ...t, roster: [], region: t.region || tm?.region || '', id: t.id };
    });
    else rows = hltvRows();
    const q = S.rankQuery.trim().toLowerCase();
    rows = rows.filter(r => (S.rankRegion === '全部' || (r.region || '').includes(S.rankRegion)) && (!q || r.name.toLowerCase().includes(q)));
    rows.sort((a, b) => a.rank - b.rank);
    return rows;
  }
  function renderRankings() {
    const isValve = S.rankKind === 'valve';
    const rows = rankRows();
    const regions = ['全部', ...new Set(rows.map(r => r.region).filter(Boolean))].slice(0, 9);
    const podium = rows.slice(0, 3);
    return `<div class="rank-tabs">
      <button class="rank-tab ${isValve ? 'active' : ''}" data-rank-kind="valve" style="--accent:var(--cyan)"><b>V社官方排名</b><span>VALVE REGIONAL STANDINGS · ${S.valve.length} TEAMS</span><span class="n">V</span></button>
      <button class="rank-tab ${!isValve ? 'active' : ''}" data-rank-kind="hltv" style="--accent:var(--magenta)"><b>HLTV 世界排名</b><span>HLTV.ORG WORLD RANKING · ${S.hltvOfficial.length || S.hltv.length} TEAMS</span><span class="n">H</span></button>
    </div>
    <div class="rank-hero">
      <div>
        <div class="podium">${[podium[1], podium[0], podium[2]].filter(Boolean).map((r, i) => {
          const pos = r === podium[0] ? 1 : r === podium[1] ? 2 : 3;
          return `<div class="podium-card ${pos === 1 ? 'first' : ''}" data-team="${esc(r.id)}" data-hltv-url="${esc(r.hltvUrl || '')}">
            ${pos === 1 ? `<div class="crown">◆ WORLD LEADER ◆</div>` : `<div class="crown">TOP ${pos}</div>`}
            <div class="rk">${String(r.rank).padStart(2, '0')}</div>
            <div class="logo-ring">${logoImg(r.logo, r.name)}</div>
            <div class="nm">${esc(r.name)}</div><div class="rg">${esc(r.region || '')}</div>
            <div class="pts">${fmtNum(r.points)} <span style="font-size:7px;color:var(--dim)">PTS</span></div>
            <div class="chg">${changeHtml(r.change)}</div>
          </div>`;
        }).join('')}</div>
        <div class="page-toolbar">
          <div class="searchbox" style="width:220px;height:30px">${icon('search')}<input class="rank-query" value="${esc(S.rankQuery)}" placeholder="搜索战队" /></div>
          <div class="seg">${regions.map(rg => `<button data-rank-region="${esc(rg)}" class="${S.rankRegion === rg ? 'active' : ''}">${esc(rg)}</button>`).join('')}</div>
          <div class="spacer"></div><span class="mono" style="font-size:8px;color:var(--dim)">${rows.length} ENTRIES</span>
        </div>
        <div class="rank-table">
          <div class="rank-table-head"><span>RANK</span><span>TEAM</span><span>REGION</span><span>POINTS</span><span>CHANGE</span><span class="h-ros">ROSTER</span></div>
          ${rows.slice(0, S.rankLimit).map((r, i) => `<div class="rank-row ${i < 3 ? 'top' : ''}" data-team="${esc(r.id)}" data-hltv-url="${esc(r.hltvUrl || '')}">
            <span class="rk">${String(r.rank).padStart(2, '0')}</span>
            <span class="team">${logoImg(r.logo, r.name)}<span style="min-width:0"><span class="nm">${esc(r.name)}</span><span class="sub">${r.source === 'official' ? 'HLTV OFFICIAL' : '5E DATA NODE'}</span></span></span>
            <span class="reg">${esc(r.region || '—')}</span>
            <span class="pts">${fmtNum(r.points)}</span>
            <span class="chg">${changeHtml(r.change)}</span>
            <span class="ros">${esc((r.roster || []).join(' · ') || '—')}</span>
          </div>`).join('')}
          ${rows.length > S.rankLimit ? `<div class="load-more"><button class="btn ghost small" data-load-more>${icon('plus')} 加载更多</button></div>` : ''}
        </div>
      </div>
      <div class="panel" style="align-self:start">
        <div class="panel-head"><h3>数据源</h3><span class="tag">SOURCE</span></div>
        <div class="panel-body">
          <div class="source-box" style="border:0;padding:0;background:transparent">
            <div class="label">PRIMARY FEED</div><div class="src">${isValve ? 'VALVE REGIONAL STANDINGS' : 'HLTV.ORG WORLD RANKING'}</div>
            <p>${isValve ? 'V社官方区域积分榜，按 Valve Ranking 积分排序。通过 5E 数据节点镜像同步，保留原始 rank / point / region / 涨跌字段。' : 'HLTV 官方世界排名，优先使用 hltv.org 官方榜单；若官方页面不可达，自动回落到 5E 镜像的 HLTV 排名。'}</p>
          </div>
          <div class="source-box" style="border:0;padding:10px 0 0;background:transparent;border-top:1px solid rgba(255,255,255,.06);margin-top:10px">
            <div class="label">LAST SYNC</div><div class="src" style="font-size:10px">${esc(timeAgo(new Date(S.lastSync).toISOString()))}</div>
            <p>排名每 30 分钟可手动同步一次；战队档案按需拉取，缓存于 F 盘。</p>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* --------------------------------------------------------------- render: teams */
  function renderTeams() {
    const q = S.teamQuery.trim().toLowerCase();
    let list = S.teams.filter(t => !q || t.name.toLowerCase().includes(q) || (t.region || '').toLowerCase().includes(q));
    list = [...list].sort((a, b) => {
      if (S.teamSort === 'name') return a.name.localeCompare(b.name);
      if (S.teamSort === 'hltv') return (a.hltvRank || 9999) - (b.hltvRank || 9999);
      return (a.valveRank || 9999) - (b.valveRank || 9999);
    });
    return `<div class="page-toolbar">
      <div class="searchbox" style="width:260px;height:30px">${icon('search')}<input class="team-query" value="${esc(S.teamQuery)}" placeholder="搜索战队 / 赛区" /></div>
      <div class="seg"><button data-team-sort="valve" class="${S.teamSort === 'valve' ? 'active' : ''}">V社排名</button><button data-team-sort="hltv" class="${S.teamSort === 'hltv' ? 'active' : ''}">HLTV 排名</button><button data-team-sort="name" class="${S.teamSort === 'name' ? 'active' : ''}">名称</button></div>
      <div class="spacer"></div><span class="mono" style="font-size:8px;color:var(--dim)">${list.length} TEAMS · 双击卡片打开档案</span>
    </div>
    <div class="teams-grid">${list.slice(0, S.teamLimit).map(renderTeamCard).join('')}</div>
    ${list.length > S.teamLimit ? `<div class="load-more"><button class="btn ghost small" data-load-more>${icon('plus')} 载入更多战队</button></div>` : ''}
    ${!list.length ? `<div class="panel"><div class="empty">${icon('teams')}<b>没有匹配的战队</b><span>尝试更换关键词</span></div></div>` : ''}`;
  }
  function renderTeamCard(t) {
    const isFav = S.favorite?.id === t.id;
    return `<div class="team-card" data-team="${esc(t.id)}" title="双击打开 ${esc(t.name)} 档案">
      <div class="tc-top"><div class="logo-ring">${logoImg(t.logo, t.name)}</div><div class="tc-info"><div class="tc-name">${esc(t.name)}</div><div class="tc-region">${esc(t.region || '未知赛区')} ${t.official ? '· HLTV OFFICIAL' : ''}</div></div><button class="tc-star ${isFav ? 'on' : ''}" data-star="${esc(t.id)}" title="设为主队">★</button></div>
      <div class="tc-ranks"><span class="mini-rank">V <b>#${esc(t.valveRank || '—')}</b></span><span class="mini-rank">H <b>#${esc(t.hltvRank || '—')}</b></span></div>
      <div class="tc-foot"><span>V ${fmtNum(t.valvePoint)} / H ${fmtNum(t.hltvPoint)}</span><span class="tc-players"><i></i><i></i><i></i><i></i><i></i></span></div>
      <span class="dbl">DOUBLE CLICK →</span>
    </div>`;
  }

  /* --------------------------------------------------------------- render: demos */
  function renderDemos() {
    return `<div class="demo-hero">
      <div class="panel"><div class="panel-body">
        <span class="pill cyan">REPLAY VAULT / F DRIVE</span>
        <h2>比赛 Demo 中枢</h2>
        <p>从 HLTV 比赛页解析 Demo 下载入口，下载至 F 盘后自动调用 WinRAR 解压 .dem，并可一键注入 CS2 控制台回放。本地 Python 指纹链路直接处理，不再要求人机验证。</p>
        <div class="path-box">${icon('folder')}<span>${esc(S.snapshot?.storage?.demos || 'F:\\工作区\\cs2-nexus\\data\\demos')}</span><button class="icon-btn" data-open-folder="demos">${icon('external')}</button></div>
        <div class="tag-line"><span class="pill lime">RAR / DEM</span><span class="pill">HLTV BRIDGE</span><span class="pill">WinRAR 解压</span><span class="pill">CS2 +playdemo</span></div>
      </div></div>
      <div class="panel"><div class="panel-body">
        <div class="source-box" style="border:0;padding:0;background:transparent"><div class="label">CS2 CLIENT</div><div class="src">${S.cs2Path ? '已检测到安装目录' : '未检测到 CS2'}</div><p>${S.cs2Path ? esc(S.cs2Path) : '可在设置中手动指定 …\\Counter-Strike Global Offensive\\game\\csgo'}</p></div>
        <div style="display:flex;gap:7px;margin-top:12px"><button class="btn small ghost" data-detect-cs2>${icon('gamepad')} 重新检测</button><button class="btn small" data-open-folder="demos">${icon('folder')} 打开 Demo 目录</button></div>
      </div></div>
    </div>
    <div class="section-head"><span class="idx">01</span><h2>本地 Demo 库</h2><span class="sub">LOCAL ARCHIVE</span><div class="spacer"></div><span class="mono" style="font-size:8px;color:var(--dim)">${S.demos.length} FILES</span></div>
    ${S.demos.length ? `<div class="demo-list">${S.demos.map(renderDemoCard).join('')}</div>` : `<div class="panel"><div class="empty">${icon('demo')}<b>暂无本地 Demo</b><span>进入已结束比赛的终端，点击「下载 Demo」</span><button class="btn small" data-view="schedule" style="margin-top:8px">${icon('calendar')} 去赛程选一场</button></div></div>`}
    ${(() => {
      const local = new Set(S.demos.map(d => d.matchId));
      const archive = S.matches.filter(m => m.status === 'finished' && !local.has(m.id)).slice(0, 6);
      if (!archive.length) return '';
      return `<div class="section-head" style="margin-top:18px"><span class="idx">02</span><h2>HLTV 可下载档案</h2><span class="sub">RECENT RESULTS</span><div class="spacer"></div><span class="mono" style="font-size:8px;color:var(--dim)">${archive.length} MATCHES</span></div>
      <div class="demo-list">${archive.map(m => {
        const job = S.demoJobs[m.id]?.active ? S.demoJobs[m.id] : null;
        return `<div class="demo-card">
        <div class="ic">${icon('crosshair')}</div>
        <div class="t"><b>${esc(m.team1.name)} vs ${esc(m.team2.name)}</b><span>${esc(m.event || '')} · ${esc(fmtFull(m.planTs))} · ${esc(m.id)}</span>${job ? `<div class="progress"><i style="width:${job.percent || 0}%"></i></div><div class="progress-label"><span>${esc(job.label || '下载中')}</span><span>${Math.round(job.percent || 0)}%</span></div>` : ''}</div>
        <div class="meta"><b>BO${m.bo || '?'}</b><br>${m.score1 ?? '—'} : ${m.score2 ?? '—'}</div>
        <div class="acts">${job ? `<button class="btn small" id="demoJob-${esc(m.id)}" disabled>${icon('download')} ${esc(job.label || '下载中')} ${Math.round(job.percent || 0)}%</button>` : `<button class="btn small primary" data-demo-download="${esc(m.id)}">${icon('download')} 获取 Demo</button>`}</div>
      </div>`; }).join('')}</div>`;
    })()}`;
  }
  function renderDemoCard(d) {
    const m = S.matches.find(x => x.id === d.matchId);
    const job = S.demoJobs[d.matchId]?.active ? S.demoJobs[d.matchId] : null;
    const ready = d.file && d.size;
    const title = (d.teams || []).join(' vs ') || (m ? `${m.team1?.name || ''} vs ${m.team2?.name || ''}` : d.matchId);
    return `<div class="demo-card">
      <div class="ic">${icon('demo')}</div>
      <div class="t"><b>${esc(title)}</b><span>${esc(d.event || m?.event || '')} · ${esc(m ? fmtFull(m.planTs) : '')} · ${esc(d.matchId)}</span>${job ? `<div class="progress"><i style="width:${job.percent || 0}%"></i></div><div class="progress-label"><span>${esc(job.label || '下载中')}</span><span>${Math.round(job.percent || 0)}%</span></div>` : ''}</div>
      <div class="meta"><b>${ready ? fmtSize(d.size) : '—'}</b><br>${ready ? 'READY' : 'INCOMPLETE'}</div>
      <div class="acts">${ready ? `<button class="btn small primary" data-demo-play="${esc(d.matchId)}">${icon('play')} 观看</button><button class="icon-btn" data-demo-reveal="${esc(d.matchId)}" title="打开所在文件夹">${icon('folder')}</button>` : `<button class="btn small" data-demo-download="${esc(d.matchId)}">${icon('download')} 下载</button>`}</div>
    </div>`;
  }

  /* --------------------------------------------------------------- render: major pick'em */
  const MAJOR_STAGE_LABEL = { stage1: '第一阶段', stage2: '第二阶段', stage3: '第三阶段', final: '最终阶段' };
  const MAJOR_STAGE_EN = { stage1: 'STAGE I', stage2: 'STAGE II', stage3: 'STAGE III', final: 'CHAMPIONS STAGE' };
  const MAJOR_RECORD_ORDER = ['0-0', '1-0', '0-1', '2-0', '0-2', '1-1', '1-2', '2-1', '3-0', '3-1', '3-2', '2-2', '2-3', '1-3', '0-3'];

  function majorStageById(id) { return (S.major?.stages || []).find(s => s.id === id) || null; }
  function majorStageIndex(id) { return Math.max(0, ['stage1', 'stage2', 'stage3', 'final'].indexOf(id)); }

  async function loadMajor(force = false) {
    if (S.majorLoading) return;
    S.majorLoading = true; S.majorError = '';
    if (S.view === 'major') render();
    try {
      const [data, picks] = await Promise.all([
        window.nexus.getMajor(force),
        window.nexus.getMajorPicks().catch(() => ({})),
      ]);
      S.major = data;
      S.majorPicks = picks && typeof picks === 'object' ? picks : {};
      const withTeams = (data.stages || []).find(s => s.teams?.length);
      const first = withTeams?.id || data.stages?.[0]?.id || 'stage1';
      if (!majorStageById(S.majorStage)) S.majorStage = first;
      if (!majorStageById(S.majorStage)) S.majorStage = 'stage1';
    } catch (e) {
      S.majorError = e.message || 'Major 数据载入失败';
    } finally {
      S.majorLoading = false;
      if (S.view === 'major') render();
    }
  }

  function majorPickOf(stageId) {
    const raw = S.majorPicks?.[stageId] || {};
    const advance = Array.from({ length: 7 }, (_, i) => raw.advance?.[i] || null);
    const zero3 = Array.from({ length: 2 }, (_, i) => raw.zero3?.[i] || null);
    return { advance, zero3, locked: !!raw.locked, lockedAt: raw.lockedAt || 0 };
  }

  function majorRecords(stage) {
    const records = new Map((stage?.teams || []).map(t => [t.id, { w: 0, l: 0 }]));
    for (const m of stage?.matches || []) {
      if (m.status !== 'finished') continue;
      const a = m.team1?.id, b = m.team2?.id;
      if (!a || !b || !records.has(a) || !records.has(b)) continue;
      const winner = m.winner || (m.score1 > m.score2 ? a : (m.score2 > m.score1 ? b : ''));
      if (!winner) continue;
      const loser = winner === a ? b : a;
      if (records.has(winner)) records.get(winner).w += 1;
      if (records.has(loser)) records.get(loser).l += 1;
    }
    return records;
  }

  function majorRecordText(rec) { return rec ? `${rec.w}-${rec.l}` : '—'; }
  function majorTeam(stage, id) { return stage?.teams?.find(t => t.id === id) || null; }

  function majorStageOpen(stage) {
    const now = Date.now() / 1000;
    if (!stage || now < (S.major?.event?.unlockAt || 0)) return false;
    if (stage.id === 'stage1') return true;
    const prev = majorStageById(['stage1', 'stage2', 'stage3', 'final'][majorStageIndex(stage.id) - 1]);
    return !!prev?.complete && !!stage.teams?.length;
  }

  function majorAnalysis(stage) {
    const pk = majorPickOf(stage.id);
    const recs = majorRecords(stage);
    const totalPicks = stage.id === 'final' ? 2 : 9;
    const picked = stage.id === 'final' ? pk.advance.slice(0, 2).filter(Boolean) : [...pk.advance, ...pk.zero3].filter(Boolean);
    const results = [];
    if (stage.id === 'final') {
      const grandFinal = (stage.matches || []).find(m => Number(m.bo) === 5)
        || (stage.matches || [])
          .filter(m => /决赛|grand final/i.test(m.stage || '') && !/半决赛|semi/i.test(m.stage || ''))
          .sort((a, b) => (b.startAt || 0) - (a.startAt || 0))[0];
      const finalists = new Set([grandFinal?.team1?.id, grandFinal?.team2?.id].filter(Boolean));
      const finalistsKnown = finalists.size === 2;
      for (const id of pk.advance.slice(0, 2)) {
        if (!id) continue;
        const t = majorTeam(stage, id);
        if (!t) { results.push({ id, name: id, kind: 'advance', state: 'pending' }); continue; }
        const state = finalistsKnown ? (finalists.has(id) ? 'right' : 'wrong') : 'pending';
        results.push({ id, name: t.name, kind: 'advance', state });
      }
    } else {
      for (const id of pk.advance) {
        if (!id) continue;
        const t = majorTeam(stage, id); if (!t) continue;
        const r = recs.get(id) || { w: 0, l: 0 };
        results.push({ id, name: t.name, kind: 'advance', state: r.l >= 3 ? 'wrong' : (r.w >= 3 ? 'right' : 'pending') });
      }
      for (const id of pk.zero3) {
        if (!id) continue;
        const t = majorTeam(stage, id); if (!t) continue;
        const r = recs.get(id) || { w: 0, l: 0 };
        results.push({ id, name: t.name, kind: 'zero3', state: r.w > 0 ? 'wrong' : (r.l >= 3 ? 'right' : 'pending') });
      }
    }
    const wrong = results.filter(r => r.state === 'wrong').length;
    const right = results.filter(r => r.state === 'right').length;
    const pending = results.filter(r => r.state === 'pending').length;
    let status = 'empty';
    if (picked.length) status = wrong ? 'busted' : (stage.complete && right === totalPicks && picked.length === totalPicks ? 'perfect' : 'alive');
    return { pk, recs, results, wrong, right, pending, status, totalPicks, picked: picked.length };
  }

  function renderMajor() {
    if (!S.major) {
      if (S.majorError) {
        return `<div class="major-loading panel"><div class="empty">${icon('alert')}<b>Major 数据载入失败</b><span>${esc(S.majorError)}</span><button class="btn small" data-major-reload>${icon('refresh')} 重试</button></div></div>`;
      }
      return `<div class="major-loading panel"><div class="major-loader"><span class="loader-ring"></span><b>正在接入 Major 作业节点</b><span>拉取四阶段赛程与战队战绩…</span></div></div>`;
    }
    const ev = S.major.event;
    const now = Date.now() / 1000;
    const lockedUntil = ev.unlockAt;
    if (now < lockedUntil) {
      return `<div class="major-gate panel">
        <div class="major-crest">${icon('trophy')}</div>
        <div class="eyebrow">MAJOR PICKEM / LOCKED</div>
        <h1>Major 作业尚未开启</h1>
        <p>赛事开始前 7 天开放作业。当前会在 <b>${esc(fmtFull(lockedUntil))}</b> 自动解锁。</p>
        <div class="major-countdown"><b>${Math.ceil((lockedUntil - now) / 86400)}</b><span>DAYS TO OPEN</span></div>
      </div>`;
    }
    const stage = majorStageById(S.majorStage) || S.major.stages[0];
    const analysis = majorAnalysis(stage);
    const recs = analysis.recs;
    const final = stage.id === 'final';
    const advanceCount = final ? 2 : 7;
    const zeroCount = final ? 0 : 2;
    const open = majorStageOpen(stage);
    const canEdit = open && !analysis.pk.locked && stage.teams.length > 0 && now >= ev.unlockAt;
    const locked = analysis.pk.locked;
    const stageStatus = locked ? 'LOCKED' : (open ? 'OPEN' : 'WAITING');
    const statusText = analysis.status === 'busted' ? '已炸' : analysis.status === 'perfect' ? '完美' : analysis.status === 'alive' ? '存活' : analysis.status === 'empty' ? '未提交' : '待定';
    const statusClass = analysis.status === 'busted' ? 'red' : analysis.status === 'perfect' ? 'lime' : analysis.status === 'alive' ? 'cyan' : 'amber';
    return `<div class="major-page">
      <section class="major-hero">
        <div class="major-hero-glow"></div>
        <div class="major-crest">${logoImg(ev.logo, 'PGL Major', 'major-crest-img')}</div>
        <div class="major-copy">
          <div class="eyebrow">PGL SINGAPORE 2026 / PICK'EM</div>
          <h1>Major 作业</h1>
          <p>四阶段晋级推演。选战队、锁作业、看结果；与游戏内 Pick'Em 同样的 7 晋级 / 2 支 0-3 结构。</p>
          <div class="major-tags"><span class="pill cyan">${esc(ev.city)}</span><span class="pill">${esc(ev.prize)}</span><span class="pill">${esc(fmtFull(ev.startAt))} — ${esc(fmtFull(ev.endAt))}</span></div>
        </div>
        <div class="major-hero-state">
          <span class="tag">作业状态</span>
          <b class="major-status ${statusClass}">${esc(statusText)}</b>
          <span class="major-state-sub">${analysis.picked}/${analysis.totalPicks} PICKS · ${locked ? '已锁定' : '可编辑'}</span>
        </div>
      </section>

      <div class="major-tabs">${(S.major.stages || []).map((s, i) => {
        const t = s.teams?.length ? `${s.teams.length} TEAMS` : 'WAITING';
        return `<button class="major-tab ${s.id === stage.id ? 'active' : ''}" data-major-stage="${s.id}">
          <span class="mt-idx">0${i + 1}</span><span class="mt-main"><b>${esc(MAJOR_STAGE_LABEL[s.id] || s.name)}</b><small>${esc(MAJOR_STAGE_EN[s.id] || s.en)} · ${t}</small></span><span class="mt-dot ${s.complete ? 'done' : ''}"></span>
        </button>`;
      }).join('')}</div>

      <section class="major-board panel">
        <div class="major-board-head">
          <div><div class="eyebrow">PICK'EM SHEET / ${esc(MAJOR_STAGE_EN[stage.id] || stage.en)}</div><h2>${esc(MAJOR_STAGE_LABEL[stage.id] || stage.name)} · ${final ? '选择决赛战队' : '选择晋级战队'}</h2></div>
          <div class="major-board-actions">
            <span class="pill ${locked ? 'lime' : 'amber'}">${locked ? 'LOCKED' : stageStatus}</span>
            <button class="btn tiny" data-major-reload title="刷新 Major 赛程与结果">${icon('refresh')} 刷新</button>
            ${locked ? `<span class="major-lock-note">${esc(fmtFull((analysis.pk.lockedAt || 0) / 1000))}</span>` : `<button class="btn small primary" data-major-lock ${canEdit && analysis.picked === analysis.totalPicks ? '' : 'disabled'}>${icon('lock')} 锁定作业</button>`}
          </div>
        </div>
        ${!stage.teams.length ? `<div class="major-wait"><div class="major-wait-ic">${icon('clock')}</div><b>战队将在上一阶段结束后确认</b><span>${stage.id === 'final' ? '最终阶段 8 强出炉后开放' : '上一阶段晋级战队锁定后开放'}</span></div>` : `
        <div class="pickem-grid ${final ? 'final-grid' : ''}">
          <div class="pickem-block">
            <div class="pickem-title"><span class="pickem-kicker">${final ? 'FINALIST' : 'ADVANCE'}</span><b>${final ? '决赛战队' : '晋级战队'}</b><span class="pickem-count">${analysis.pk.advance.slice(0, advanceCount).filter(Boolean).length} / ${advanceCount}</span><span class="pickem-hint">${final ? '选择 2 支将进入决赛的战队' : '选择 7 支将晋级下一阶段的战队'}</span></div>
            <div class="pickem-slots advance-slots">${analysis.pk.advance.slice(0, advanceCount).map((id, i) => renderMajorSlot(stage, 'advance', i, id, recs, canEdit, locked)).join('')}</div>
          </div>
          ${final ? '' : `<div class="pickem-block zero-block">
            <div class="pickem-title"><span class="pickem-kicker">0-3</span><b>全败出局</b><span class="pickem-count">${analysis.pk.zero3.filter(Boolean).length} / ${zeroCount}</span><span class="pickem-hint">选择 2 支将以 0-3 出局的战队</span></div>
            <div class="pickem-slots zero-slots">${analysis.pk.zero3.map((id, i) => renderMajorSlot(stage, 'zero3', i, id, recs, canEdit, locked)).join('')}</div>
          </div>`}
        </div>
        <div class="major-pool-head"><span>可选战队</span><span>${canEdit ? (final ? '直接点战队的「选择」' : '先点空框，或直接点战队的「晋级 / 0-3」') : locked ? '作业已锁定，仅可查看' : '当前阶段不可编辑'}</span></div>
        <div class="major-pool">${stage.teams.slice().sort((a, b) => {
          const ra = recs.get(a.id) || { w: 0, l: 0 }, rb = recs.get(b.id) || { w: 0, l: 0 };
          return rb.w - ra.w || ra.l - rb.l || a.name.localeCompare(b.name);
        }).map(t => renderMajorPoolTeam(stage, t, recs.get(t.id), analysis.pk, canEdit)).join('')}</div>
        `}
        <div class="major-board-foot"><span>${icon('shield')} 锁定后不可修改 · 结果按已结束比赛实时判定</span><span>${analysis.wrong ? `${analysis.wrong} 个预测已炸` : analysis.right ? `${analysis.right} 个预测命中` : '等待比赛结果'}</span></div>
      </section>

      <section class="major-result">
        <div class="major-result-head"><div><div class="eyebrow">PICK'EM HEALTH / LIVE</div><h2>作业体检</h2></div><span class="pill ${statusClass}">${esc(statusText)}</span></div>
        <div class="major-result-grid">
          <div class="major-kpi"><b>${analysis.right}</b><span>命中</span></div>
          <div class="major-kpi"><b>${analysis.wrong}</b><span>炸掉</span></div>
          <div class="major-kpi"><b>${analysis.pending}</b><span>待定</span></div>
          <div class="major-kpi"><b>${analysis.picked}/${analysis.totalPicks}</b><span>已选</span></div>
        </div>
        ${analysis.results.length ? `<div class="major-pick-results">${analysis.results.map(r => `<div class="major-pick-result ${r.state}"><span class="mpr-kind">${r.kind === 'zero3' ? '0-3' : '晋级'}</span><b>${esc(r.name)}</b><span class="mpr-state">${r.state === 'right' ? '命中' : r.state === 'wrong' ? '炸了' : '待定'}</span></div>`).join('')}</div>` : `<div class="major-empty-line">还没有选择战队。锁定前可随时调整。</div>`}
      </section>

      <section class="major-stats">
        <div class="major-result-head"><div><div class="eyebrow">SWISS RECORDS / ${esc(MAJOR_STAGE_EN[stage.id] || stage.en)}</div><h2>当前战绩分布</h2></div><span class="mono major-note">仅统计已结束比赛 · 直播中不计入</span></div>
        ${renderMajorRecordGroups(stage, recs)}
      </section>
    </div>`;
  }

  function renderMajorSlot(stage, type, index, id, recs, canEdit, locked) {
    const t = id ? majorTeam(stage, id) : null;
    const active = S.majorSlot?.type === type && S.majorSlot?.index === index;
    const final = stage.id === 'final';
    return `<button class="pick-slot ${t ? 'filled' : 'empty'} ${active ? 'active' : ''} ${type === 'zero3' ? 'zero' : ''}" data-major-slot="${type}:${index}" ${locked || !canEdit ? 'disabled' : ''}>
      ${t ? `${logoImg(t.logo, t.name, 'slot-logo')}<span class="slot-name">${esc(t.name)}</span><span class="slot-record">${majorRecordText(recs.get(t.id))}</span><span class="slot-x">${icon('close')}</span>` : `<span class="slot-plus">${icon('plus')}</span><span class="slot-label">${type === 'zero3' ? '0-3 PICK' : final ? 'FINALIST PICK' : 'ADVANCE PICK'} 0${index + 1}</span>`}
    </button>`;
  }

  function renderMajorPoolTeam(stage, t, rec, pk, canEdit) {
    const final = stage.id === 'final';
    const inAdvance = pk.advance.includes(t.id);
    const inZero = pk.zero3.includes(t.id);
    const selected = inAdvance || inZero;
    const r = rec || { w: 0, l: 0 };
    const state = r.w >= 3 ? 'adv' : r.l >= 3 ? 'out' : '';
    const advanceFull = pk.advance.filter(Boolean).length >= (final ? 2 : 7);
    return `<div class="major-pool-team ${selected ? 'selected' : ''} ${state}">
      <div class="mpt-main">${logoImg(t.logo, t.name, 'mpt-logo')}<span class="mpt-name">${esc(t.name)}</span><span class="mpt-record">${r.w}-${r.l}</span>${selected ? `<span class="mpt-check">${icon('check')} ${inAdvance ? (final ? '决赛' : '晋级') : '0-3'}</span>` : ''}</div>
      ${canEdit ? (final
        ? `<div class="mpt-actions"><button class="mpt-btn" data-major-add="advance:${esc(t.id)}" ${selected || (advanceFull && !inAdvance) ? 'disabled' : ''}>选择</button></div>`
        : `<div class="mpt-actions"><button class="mpt-btn" data-major-add="advance:${esc(t.id)}" ${selected ? 'disabled' : ''}>晋级</button><button class="mpt-btn zero" data-major-add="zero3:${esc(t.id)}" ${selected ? 'disabled' : ''}>0-3</button></div>`) : ''}
    </div>`;
  }

  function renderMajorRecordGroups(stage, recs) {
    if (!stage.teams.length) return `<div class="major-empty-line">战队确认后显示瑞士轮战绩分布。</div>`;
    const map = new Map();
    for (const t of stage.teams) {
      const r = recs.get(t.id) || { w: 0, l: 0 };
      const key = `${r.w}-${r.l}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    const keys = [...MAJOR_RECORD_ORDER, ...map.keys()].filter((k, i, a) => a.indexOf(k) === i && map.has(k));
    return `<div class="record-grid">${keys.map(k => {
      const teams = map.get(k).sort((a, b) => a.name.localeCompare(b.name));
      const [w, l] = k.split('-').map(Number);
      const cls = w === 3 ? 'qualified' : l === 3 ? 'eliminated' : '';
      return `<div class="record-card ${cls}"><div class="record-head"><b>${w} : ${l}</b><span>${teams.length} 支</span></div><div class="record-teams">${teams.map(t => `<button class="record-team" data-team="${esc(t.id)}" title="${esc(t.name)} · ${k}">${logoImg(t.logo, t.name, 'record-logo')}<span>${esc(t.name)}</span></button>`).join('')}</div></div>`;
    }).join('')}</div>`;
  }

  async function saveMajorPicks() {
    try { await window.nexus.saveMajorPicks(S.majorPicks); }
    catch (e) { toast('作业保存失败', e.message, 'err'); }
  }

  function majorAddPick(type, id) {
    const stage = majorStageById(S.majorStage);
    if (!stage || !majorStageOpen(stage) || majorPickOf(stage.id).locked) return;
    const pk = majorPickOf(stage.id);
    if (pk.advance.includes(id) || pk.zero3.includes(id)) return;
    const key = type === 'zero3' ? 'zero3' : 'advance';
    const arr = key === 'zero3' ? pk.zero3 : pk.advance;
    let index = (S.majorSlot?.type === key && !arr[S.majorSlot.index]) ? S.majorSlot.index : arr.findIndex(x => !x);
    if (index < 0) { toast('位置已满', key === 'zero3' ? '0-3 最多选择 2 支' : '晋级最多选择 7 支', 'err'); return; }
    if (S.majorSlot?.type === key && S.majorSlot.index !== index) index = S.majorSlot.index;
    arr[index] = id;
    // Remove the same team from the other group so a team can only be picked once.
    const other = key === 'zero3' ? pk.advance : pk.zero3;
    for (let i = 0; i < other.length; i++) if (other[i] === id) other[i] = null;
    S.majorPicks[stage.id] = { ...(S.majorPicks[stage.id] || {}), [key]: arr, [key === 'zero3' ? 'advance' : 'zero3']: other, locked: false };
    S.majorSlot = null;
    saveMajorPicks();
    render();
  }

  function majorRemovePick(type, index) {
    const stage = majorStageById(S.majorStage);
    if (!stage || !majorStageOpen(stage) || majorPickOf(stage.id).locked) return;
    const pk = majorPickOf(stage.id);
    const key = type === 'zero3' ? 'zero3' : 'advance';
    const arr = key === 'zero3' ? pk.zero3 : pk.advance;
    arr[index] = null;
    S.majorPicks[stage.id] = { ...(S.majorPicks[stage.id] || {}), [key]: arr, locked: false };
    S.majorSlot = null;
    saveMajorPicks();
    render();
  }

  async function lockMajorPick() {
    const stage = majorStageById(S.majorStage);
    if (!stage) return;
    const pk = majorPickOf(stage.id);
    const final = stage.id === 'final';
    const needAdvance = final ? 2 : 7;
    const needZero = final ? 0 : 2;
    if (pk.advance.filter(Boolean).length !== needAdvance || pk.zero3.filter(Boolean).length !== needZero) {
      toast('无法锁定', final ? '请先选满 2 支决赛战队' : '请先选满 7 支晋级战队与 2 支 0-3 战队', 'err'); return;
    }
    S.majorPicks[stage.id] = { ...(S.majorPicks[stage.id] || {}), ...pk, locked: true, lockedAt: Date.now() };
    await saveMajorPicks();
    toast('作业已锁定', `${MAJOR_STAGE_LABEL[stage.id]} · 结果将随比赛自动判定`, 'ok');
    render();
  }

  /* --------------------------------------------------------------- render: settings */
  function renderSettings() {
    const path = S.snapshot?.storage || {};
    return `<div class="settings-grid">
      <div class="panel"><div class="panel-head"><h3>终端配置</h3><span class="tag">SYSTEM</span></div><div class="panel-body">
        <div class="set-row"><div class="si"><b>主队锁定</b><span>主页雷达与赛程优先显示该战队</span></div><div class="sv">${esc(S.favorite?.name || '—')}</div><button class="btn small" data-view="teams">${icon('star')} 选择</button></div>
        <div class="set-row"><div class="si"><b>实时自动同步</b><span>每 60 秒拉取 5E 实时赛程；每 15 分钟刷新双榜与战队索引</span></div><button class="switch ${S.settings.autoRefresh !== false ? 'on' : ''}" data-setting="autoRefresh"></button></div>
        <div class="set-row"><div class="si"><b>CS2 安装目录</b><span>用于复制 .dem 并启动 +playdemo</span></div><div class="sv">${esc(S.cs2Path || '未检测')}</div><button class="btn small" data-detect-cs2>${icon('gamepad')} 检测</button></div>
        <div class="set-row"><div class="si"><b>数据存储根目录</b><span>所有缓存、Demo、日志均保存在 F 盘</span></div><div class="sv">${esc(path.root || 'F:\\工作区\\cs2-nexus')}</div><button class="icon-btn" data-open-folder="data">${icon('external')}</button></div>
      </div></div>
      <div class="panel"><div class="panel-head"><h3>数据链路</h3><span class="tag">LINKS</span></div><div class="panel-body">
        <div class="set-row"><div class="si"><b>5E PLAY 赛事节点</b><span>赛程 / 战队 / 赛前赔率 / 比赛详情</span></div><span class="pill lime">ONLINE</span></div>
        <div class="set-row"><div class="si"><b>VALVE REGIONAL STANDINGS</b><span>V社官方区域积分榜 · 395 支战队</span></div><span class="pill lime">SYNCED</span></div>
        <div class="set-row"><div class="si"><b>HLTV WORLD RANKING</b><span>官方榜 252 支 · 5E 镜像 336 支</span></div><span class="pill lime">SYNCED</span></div>
        <div class="set-row"><div class="si"><b>HLTV Demo Bridge</b><span>Cloudflare 验证窗口 + R2 下载 + WinRAR 解压</span></div><span class="pill amber">ON DEMAND</span></div>
      </div></div>
      <div class="panel"><div class="panel-head"><h3>存储与维护</h3><span class="tag">STORAGE</span></div><div class="panel-body">
        <div class="set-row"><div class="si"><b>数据目录</b><span>${esc(path.data || '')}</span></div><button class="btn small ghost" data-open-folder="data">${icon('folder')} 打开</button></div>
        <div class="set-row"><div class="si"><b>Demo 仓库</b><span>${esc(path.demos || '')}</span></div><button class="btn small ghost" data-open-folder="demos">${icon('folder')} 打开</button></div>
        <div class="set-row"><div class="si"><b>缓存目录</b><span>${esc(path.cache || '')}</span></div><span class="pill">F DRIVE ONLY</span></div>
      </div></div>
      <div class="panel"><div class="panel-head"><h3>关于 NEXUS</h3><span class="tag">BUILD 1.0.0</span></div><div class="panel-body">
        <div class="source-box" style="border:0;padding:0;background:transparent"><div class="label">CS2 NEXUS / TACTICAL TERMINAL</div><p>面向 CS2 赛事观察者的本地桌面终端。整合 V社与 HLTV 双排名、5E 赛程与战队档案、赛前胜率推演、HLTV Demo 下载与 CS2 回放链路。所有数据、缓存与 Demo 均保存在 F 盘，不写入 C 盘。</p></div>
        <div class="tag-line" style="margin-top:12px"><span class="pill">Electron 38</span><span class="pill">NODE 24</span><span class="pill">5E DATA</span><span class="pill">HLTV BRIDGE</span></div>
        <div style="margin-top:14px;display:flex;gap:7px"><button class="btn small" data-open-folder="data">${icon('database')} 数据目录</button><button class="btn small ghost" data-open-url="https://www.hltv.org/ranking/teams">${icon('external')} HLTV 排名</button></div>
      </div></div>
    </div>`;
  }

  /* --------------------------------------------------------------- modal */
  function modalShell(inner, cls = '') {
    const root = $('#overlayRoot');
    root.innerHTML = `<div class="modal-backdrop"><div class="dossier ${cls}">${inner}</div></div>`;
    root.querySelector('.modal-backdrop').addEventListener('mousedown', (e) => { if (e.target.classList.contains('modal-backdrop')) closeModal(); });
    root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  }
  function closeModal() {
    const back = S.modal?.fromTeam || '';
    S.modal = null;
    $('#overlayRoot').innerHTML = '';
    if (back) openTeam(back);
  }

  async function openTeam(id) {
    if (!id) { toast('无法打开档案', '该排名条目没有关联的 5E 战队 ID', 'err'); return; }
    S.modal = { type: 'team', id, tab: 'overview' };
    const brief = S.teamMap.get(id) || fallbackTeam(id);
    modalShell(`<div class="dossier-head"><div class="dh-top"><div class="logo-ring">${logoImg(brief.logo, brief.name)}</div><div class="dh-title"><div class="eyebrow">TEAM DOSSIER / LOADING</div><h2>${esc(brief.name)}</h2><div class="sub">正在接入战队数据节点…</div></div></div><button class="modal-close" data-close>${icon('close')}</button></div><div class="dossier-body"><div class="skeleton" style="height:120px;margin-bottom:12px"></div><div class="skeleton" style="height:220px"></div></div>`);
    try {
      const t = await window.nexus.getTeam(id);
      if (!S.modal || S.modal.id !== id) return;
      S.modal.data = t;
      renderTeamModal();
    } catch (e) {
      modalShell(`<div class="dossier-head"><div class="dh-top"><div class="logo-ring">${logoImg(brief.logo, brief.name)}</div><div class="dh-title"><div class="eyebrow">TEAM DOSSIER / ERROR</div><h2>${esc(brief.name)}</h2><div class="sub">${esc(e.message)}</div></div></div><button class="modal-close" data-close>${icon('close')}</button></div><div class="dossier-body"><div class="empty">${icon('alert')}<b>档案载入失败</b><span>${esc(e.message)}</span></div></div>`);
    }
  }

  function renderTeamModal() {
    const t = S.modal?.data; if (!t) return;
    const isFav = S.favorite?.id === t.id;
    const tabs = [['overview', '概览'], ['roster', '阵容'], ['schedule', '赛程'], ['honors', '荣誉']];
    const body = t.aborted ? '' : S.modal.tab === 'overview' ? teamOverview(t) : S.modal.tab === 'roster' ? teamRoster(t) : S.modal.tab === 'schedule' ? teamSchedule(t) : teamHonors(t);
    modalShell(`
      <div class="dossier-head"><div class="bgmark">${logoImg(t.logo, t.name)}</div>
        <div class="dh-top"><div class="logo-ring">${logoImg(t.logo, t.name)}</div>
          <div class="dh-title"><div class="eyebrow">TEAM DOSSIER / ${esc(t.region || 'GLOBAL')}</div><h2>${esc(t.name)}</h2><div class="sub">${esc(t.country || '国际纵队')} · ${t.players?.length || 0} 名选手 · 教练 ${esc(t.coach || '—')}</div></div>
          <div class="dh-rank"><div class="rank-block"><div class="k">VALVE</div><div class="v">#${esc(t.valveRank || '—')}</div><div class="p">${fmtNum(t.valvePoint)} PTS</div></div><div class="rank-block"><div class="k">HLTV</div><div class="v">#${esc(t.hltvRank || '—')}</div><div class="p">${fmtNum(t.hltvPoint)} PTS</div></div></div>
          <div class="dh-actions"><button class="btn small ${isFav ? 'primary' : ''}" data-team-fav="${esc(t.id)}">${icon('star')} ${isFav ? '主队' : '设为主队'}</button><button class="btn small ghost" data-team-hltv="${esc(t.hltvUrl || '')}">${icon('external')} HLTV</button></div>
        </div>
        <button class="modal-close" data-close>${icon('close')}</button>
        <div class="dossier-tabs" style="margin:14px -22px -14px;padding:0 22px">${tabs.map(([k, l]) => `<button class="dtab ${S.modal.tab === k ? 'active' : ''}" data-dtab="${k}">${l}</button>`).join('')}</div>
      </div>
      <div class="dossier-body">${body}</div>`);
    bindModal();
  }

  function teamOverview(t) {
    const wr = t.stats?.winRate || 0;
    return `<div class="ov-grid">
      <div>
        <div class="winrate-box"><div class="ring" style="--p:${wr}"><b>${wr.toFixed(1)}<small>%</small></b></div><div class="wr-info"><div class="k">WIN RATE / ALL TIME</div><div class="v">${t.stats.wins} 胜 · ${t.stats.losses} 负</div><div class="s">${t.stats.maps} 张地图 · KD ${t.stats.kd.toFixed(2)}</div><div class="form-strip">${(t.recentForm || []).map(r => `<span class="form-dot ${r}">${r}</span>`).join('') || '<span class="form-dot">—</span>'}</div></div></div>
        <div class="stat-grid" style="margin-top:10px">
          <div class="stat-box"><div class="k">TOTAL PRIZE</div><div class="v" style="font-size:15px">${esc(t.bonus || '—')}</div><div class="s">CAREER EARNINGS</div></div>
          <div class="stat-box"><div class="k">AVG AGE</div><div class="v">${t.avgAge || '—'}<small>岁</small></div><div class="s">ROSTER CORE</div></div>
          <div class="stat-box"><div class="k">COACH</div><div class="v" style="font-size:15px">${esc(t.coach || '—')}</div><div class="s">HEAD COACH</div></div>
        </div>
        <div class="panel" style="margin-top:12px"><div class="panel-head"><h3>近期战绩</h3><span class="tag">RECENT</span></div><div class="sessions-list">${(t.sessions || []).slice(0, 5).map(s => sessionRow(s)).join('') || `<div class="empty" style="padding:20px"><span>暂无赛程数据</span></div>`}</div></div>
      </div>
      <div>
        <div class="panel"><div class="panel-head"><h3>核心阵容</h3><div class="spacer"></div><button class="link-btn" data-dtab-jump="roster">全部 ${icon('chevron')}</button></div><div class="panel-body" style="padding:10px 12px">${(t.players || []).slice(0, 5).map(p => `<div data-player="${esc(p.id)}" style="display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer"><div style="width:30px;height:30px;border-radius:50%;overflow:hidden;border:1px solid rgba(103,232,255,.16)">${logoImg(p.photo, p.name)}</div><div style="flex:1;min-width:0"><div style="font-size:10.5px">${esc(p.name)} ${p.top20 ? `<span class="pill amber" style="font-size:6px;padding:0 3px">TOP ${p.top20}</span>` : ''}</div><div class="mono" style="font-size:7px;color:var(--dim)">${esc(p.country || '')} · ${esc((p.positions || []).join(' / ') || p.role || '')}</div></div><div class="mono" style="font-size:8px;color:var(--muted)">${esc(p.birthday ? p.birthday.slice(0, 4) : '')}</div></div>`).join('') || `<div class="empty" style="padding:14px"><span>暂无阵容</span></div>`}</div></div>
        <div class="panel" style="margin-top:12px"><div class="panel-head"><h3>主要荣誉</h3><span class="tag">HONORS</span></div><div class="panel-body" style="padding:10px 12px">${(t.honors || []).slice(0, 6).map(h => `<div class="honor-row"><span class="pos">${esc(h.rank)}</span><span class="nm">${esc(h.name)}</span></div>`).join('') || `<div class="empty" style="padding:14px"><span>暂无荣誉</span></div>`}</div></div>
      </div>
    </div>`;
  }
  function teamRoster(t) {
    return `<div class="tag-line" style="margin-bottom:10px"><span class="pill cyan">STARTING FIVE</span><span class="pill">教练 ${esc(t.coach || '—')}</span><span class="pill">平均年龄 ${t.avgAge || '—'}</span></div>
      <div class="players-grid">${(t.players || []).map(p => `<div class="player-card" data-player="${esc(p.id)}" title="打开选手档案">${p.top20 ? `<span class="top20">TOP ${p.top20}</span>` : ''}<div class="ph">${logoImg(p.photo, p.name)}</div><div class="pn">${esc(p.name)}</div><div class="pc">${esc(p.country || '')} · ${esc(p.birthday || '')}</div><div class="pr">${(p.positions || []).map(x => `<span class="pill">${esc(x)}</span>`).join('') || `<span class="pill">${esc(p.role || '选手')}</span>`}</div><div class="pd">奖金 <b>${esc(p.bonus || '—')}</b><br>ID <b>${esc(p.id || '—')}</b></div><div class="pc-open">查看选手档案 ${icon('chevron')}</div></div>`).join('') || `<div class="empty" style="grid-column:1/-1">${icon('users')}<b>暂无阵容数据</b><span>该战队未收录于 5E 数据库</span></div>`}</div>`;
  }
  function teamSchedule(t) {
    const up = (t.sessions || []).filter(s => s.status !== 'finished');
    const past = (t.sessions || []).filter(s => s.status === 'finished');
    return `<div class="section-head"><span class="idx">UP</span><h2>待开赛程</h2><span class="sub">UPCOMING · ${up.length} 场</span></div><div class="sessions-list">${up.map(s => sessionRow(s)).join('') || `<div class="empty" style="padding:18px"><span>暂无待开赛程</span></div>`}</div>
      <div class="section-head" style="margin-top:18px"><span class="idx">HIS</span><h2>历史赛果</h2><span class="sub">${past.length} 场</span></div><div class="sessions-list">${past.map(s => sessionRow(s)).join('') || `<div class="empty" style="padding:18px"><span>暂无历史赛果</span></div>`}</div>`;
  }
  function sessionRow(s) {
    const res = s.result || (s.status === 'finished' ? '' : '');
    return `<div class="session-row" data-match="${esc(s.id)}"><div class="d">${fmtDay(s.planTs)}<span>${fmtTime(s.planTs)}</span></div><div class="opp">${logoImg(s.opponent?.logo, s.opponent?.name || '')}<span>${esc(s.opponent?.name || 'TBD')}</span></div><div class="sc ${res || ''}">${s.status === 'finished' ? `${s.myScore} : ${s.oppScore}` : s.status === 'live' ? '<span style="color:var(--red)">LIVE</span>' : `<span style="color:var(--dim)">VS</span>`}</div><div class="ev">${esc(s.event || '')}</div></div>`;
  }
  function teamHonors(t) {
    return `<div class="section-head"><span class="idx">01</span><h2>赛事荣誉</h2><span class="sub">TOURNAMENT HONORS</span></div><div class="honor-list">${(t.honors || []).map(h => `<div class="honor-row"><span class="pos">${esc(h.rank)}</span><span class="nm">${esc(h.name)}</span><span class="yr">${esc(h.logo ? '' : '')}</span></div>`).join('') || `<div class="empty">${icon('trophy')}<b>暂无荣誉记录</b></div>`}</div>
      <div class="section-head" style="margin-top:18px"><span class="idx">02</span><h2>Major 战绩</h2><span class="sub">MAJOR HISTORY</span></div><div class="honor-list">${(t.majorHonors || []).map(h => `<div class="honor-row"><span class="pos">${esc(h.rank)}</span><span class="nm">${esc(h.name)}</span></div>`).join('') || `<div class="empty">${icon('trophy')}<b>暂未收录 Major 战绩</b></div>`}</div>`;
  }

  /* --------------------------------------------------------------- player modal */
  async function openPlayer(id, force = false, fromTeam = '') {
    if (!id) return;
    S.modal = { type: 'player', id, tab: 'overview', fromTeam: fromTeam || S.modal?.data?.id || '' };
    const t = S.teamMap.get(S.modal.fromTeam);
    modalShell(`<div class="dossier-head"><div class="dh-top"><div class="dh-title"><div class="eyebrow">PLAYER DOSSIER / LOADING</div><h2>选手档案</h2><div class="sub">正在接入 5E 选手数据节点…</div></div></div><button class="modal-close" data-close>${icon('close')}</button></div><div class="dossier-body"><div class="skeleton" style="height:110px;margin-bottom:12px"></div><div class="skeleton" style="height:220px"></div></div>`, 'player-modal');
    try {
      const p = await window.nexus.getPlayer(id, force);
      if (!S.modal || S.modal.type !== 'player' || S.modal.id !== id) return;
      S.modal.data = p;
      renderPlayerModal();
    } catch (e) {
      modalShell(`<div class="dossier-head"><div class="dh-top"><div class="dh-title"><div class="eyebrow">PLAYER DOSSIER / ERROR</div><h2>档案载入失败</h2><div class="sub">${esc(e.message)}</div></div></div><button class="modal-close" data-close>${icon('close')}</button></div><div class="dossier-body"><div class="empty">${icon('alert')}<b>5E 选手节点无响应</b><span>${esc(e.message)}</span></div></div>`, 'player-modal');
    }
  }

  function renderPlayerModal() {
    const p = S.modal?.data; if (!p) return;
    const tabs = [['overview', '概览'], ['matches', `比赛记录 ${p.matches?.length || 0}`], ['maps', '地图数据'], ['honors', '荣誉']];
    const body = S.modal.tab === 'overview' ? playerOverview(p) : S.modal.tab === 'matches' ? playerMatches(p) : S.modal.tab === 'maps' ? playerMaps(p) : playerHonors(p);
    modalShell(`
      <div class="dossier-head player-head"><div class="bgmark">${logoImg(p.photo, p.name)}</div>
        <div class="dh-top"><div class="logo-ring player-ring">${logoImg(p.photo, p.name)}</div>
          <div class="dh-title"><div class="eyebrow">PLAYER DOSSIER / ${esc(p.teamName || 'FREE AGENT')}</div><h2>${esc(p.name)} ${p.top20 ? `<span class="pill amber" style="font-size:8px;vertical-align:middle">TOP ${p.top20}</span>` : ''}</h2><div class="sub">${esc(p.country || '未知')} · ${p.age || '—'} 岁 · ${esc((p.positions || []).join(' / ') || '职业选手')} · ${esc(p.teamName || '')}</div></div>
          <div class="dh-rank"><div class="rank-block"><div class="k">RATING</div><div class="v">${p.career.rating ? p.career.rating.toFixed(2) : '—'}</div><div class="p">CAREER</div></div><div class="rank-block"><div class="k">MAPS</div><div class="v">${fmtNum(p.career.maps)}</div><div class="p">ALL TIME</div></div></div>
          <div class="dh-actions"><button class="btn small ghost" data-player-team="${esc(p.teamId)}">${icon('teams')} 战队</button><button class="btn small" data-player-refresh="${esc(p.id)}">${icon('refresh')} 刷新</button></div>
        </div>
        <button class="modal-close" data-close>${icon('close')}</button>
        <div class="dossier-tabs" style="margin:14px -22px -14px;padding:0 22px">${tabs.map(([k, l]) => `<button class="dtab ${S.modal.tab === k ? 'active' : ''}" data-ptab="${k}">${l}</button>`).join('')}</div>
      </div>
      <div class="dossier-body">${body}</div>`, 'player-modal');
    bindModal();
  }

  function playerPlatformGrid(p) {
    return `<div class="platform-grid">${(p.links || []).map(l => `<button class="platform-btn ${esc(l.id)}" data-open-url="${esc(l.url)}"><span class="pb-name">${esc(l.label)}</span><span class="pb-sub">${esc(l.sub)}</span><span class="pb-arrow">${icon('external')}</span></button>`).join('')}</div>`;
  }

  function playerOverview(p) {
    const c = p.career, r = p.recent;
    const stat = (k, v, unit, s) => `<div class="stat-box"><div class="k">${esc(k)}</div><div class="v">${esc(v)}${unit ? `<small>${esc(unit)}</small>` : ''}</div><div class="s">${esc(s)}</div></div>`;
    const recentDots = (p.matches || []).slice(0, 8).reverse().map(m => `<span class="form-dot ${m.win === true ? 'W' : m.win === false ? 'L' : ''}">${m.win === true ? 'W' : m.win === false ? 'L' : '—'}</span>`).join('');
    return `<div class="player-grid"><div>
      <div class="section-head"><span class="idx">01</span><h2>平台档案</h2><span class="sub">PLATFORM LINKS · 按昵称定位</span></div>
      ${playerPlatformGrid(p)}
      <div class="source-box" style="margin-top:8px"><div class="label">IDENTITY / 基础信息</div><div class="tag-line" style="margin-top:7px"><span class="pill">生日 ${esc(p.birthday || '—')}</span><span class="pill">${esc(p.country || '—')}</span><span class="pill">奖金 ${esc(p.bonus || '—')}</span><span class="pill">ID ${esc(p.id)}</span></div><p>5E 为精确个人主页；Steam / FACEIT / 完美世界 / HLTV 使用昵称站内搜索或选手页，点击后由系统浏览器打开。</p></div>
      <div class="section-head" style="margin-top:16px"><span class="idx">02</span><h2>生涯数据</h2><span class="sub">CAREER · ALL TIME</span></div>
      <div class="stat-grid player-stat-grid">
        ${stat('RATING', c.rating ? c.rating.toFixed(2) : '—', '', `KD ${c.kd.toFixed(2)}`)}
        ${stat('ADR', c.adr.toFixed(1), '', '每回合伤害')}
        ${stat('KAST', c.kast.toFixed(1), '%', '回合参与率')}
        ${stat('HS', c.hs.toFixed(1), '%', '爆头率')}
        ${stat('KILLS', fmtNum(c.kills), '', `${fmtNum(c.deaths)} DEATHS`)}
        ${stat('MAPS', fmtNum(c.maps), '', `${fmtNum(c.rounds)} ROUNDS`)}
      </div>
      <div class="section-head" style="margin-top:16px"><span class="idx">03</span><h2>近三个月</h2><span class="sub">RECENT FORM · ${r.total} 场 / 胜率 ${r.winRate.toFixed(1)}%</span></div>
      <div class="stat-grid player-stat-grid">
        ${stat('RATING', r.rating ? r.rating.toFixed(2) : '—', '', '近 92 天')}
        ${stat('ADR', r.adr.toFixed(1), '', '每回合伤害')}
        ${stat('KAST', r.kast.toFixed(1), '%', '回合参与率')}
        ${stat('K/D', r.kd.toFixed(2), '', `${r.wins}W · ${r.losses}L`)}
        ${stat('IMPACT', r.impact ? r.impact.toFixed(2) : '—', '', '影响力')}
        ${stat('MVP', fmtNum(r.mvp), '', `${r.maps} 张地图`)}
      </div>
      <div class="form-strip" style="margin-top:12px">${recentDots}</div>
    </div><div>
      <div class="panel"><div class="panel-head"><h3>最近比赛</h3><span class="tag">RECENT ${Math.min(6, (p.matches || []).length)}</span></div><div class="pm-list">${(p.matches || []).slice(0, 6).map(playerMatchRow).join('') || `<div class="empty" style="padding:18px"><span>暂无比赛记录</span></div>`}</div></div>
      <div class="panel" style="margin-top:12px"><div class="panel-head"><h3>主力地图</h3><span class="tag">MAP POOL</span></div><div class="map-bars">${(p.maps || []).slice(0, 6).map(m => `<div class="map-bar"><div class="mb-top"><span>${esc(m.name)}</span><b>${m.rating.toFixed(2)}</b></div><div class="mb-track"><i style="width:${clamp(m.rating / 1.35 * 100, 6, 100)}%"></i></div><div class="mb-sub">${fmtNum(m.useNum)} 张 · KD ${m.kd.toFixed(2)}</div></div>`).join('') || `<div class="empty" style="padding:18px"><span>暂无地图数据</span></div>`}</div></div>
      <div class="panel" style="margin-top:12px"><div class="panel-head"><h3>代表荣誉</h3><span class="tag">HONORS</span></div><div class="panel-body" style="padding:8px 12px">${(p.honors || []).slice(0, 5).map(h => `<div class="honor-row"><span class="pos">${esc(h.rank)}</span><span class="nm">${esc(h.name)}</span><span class="yr">${esc(h.date.slice(0, 4))}</span></div>`).join('') || `<div class="empty" style="padding:14px"><span>暂无荣誉</span></div>`}</div></div>
    </div></div>`;
  }

  function playerMatchRow(m) {
    const res = m.win === true ? 'W' : m.win === false ? 'L' : '—';
    return `<div class="pm-row ${res}"><div class="pm-date">${fmtDay(m.planTs)}<span>${fmtTime(m.planTs)}</span></div><div class="pm-opp">${logoImg(m.opponentLogo, m.opponent)}<span>${esc(m.opponent)}</span></div><div class="pm-score">${m.myScore} : ${m.oppScore}</div><div class="pm-ev">${esc(m.event || '')}<small>${esc(m.stage || '')}</small></div><div class="pm-res ${res}">${res}</div></div>`;
  }

  function playerMatches(p) {
    return `<div class="section-head"><span class="idx">01</span><h2>比赛记录</h2><span class="sub">MATCH LOG · ${(p.matches || []).length} 场近期记录</span></div>
      <div class="pm-table"><div class="pm-head"><span>时间</span><span>对手</span><span>比分</span><span>赛事 / 阶段</span><span>结果</span></div>${(p.matches || []).map(playerMatchRow).join('') || `<div class="empty">${icon('calendar')}<b>暂无比赛记录</b></div>`}</div>
      <div class="source-box" style="margin-top:12px"><div class="label">DATA SOURCE</div><p>比赛记录来自 5E 选手数据节点，展示最近一页记录；选手个人 Rating/ADR 的逐场拆分由赛事数据源提供，当前列表为队伍比分与胜负。</p></div>`;
  }

  function playerMaps(p) {
    return `<div class="section-head"><span class="idx">01</span><h2>地图数据</h2><span class="sub">CAREER MAP POOL · ${(p.maps || []).length} MAPS</span></div>
      <div class="map-table">${(p.maps || []).map(m => `<div class="map-row"><span class="mn">${esc(m.name)}</span><span class="mu">${fmtNum(m.useNum)} 张</span><span class="mr">${m.rating.toFixed(2)}</span><span class="mk">KD ${m.kd.toFixed(2)}</span><div class="mb-track"><i style="width:${clamp(m.rating / 1.35 * 100, 6, 100)}%"></i></div></div>`).join('') || `<div class="empty">${icon('globe')}<b>暂无地图数据</b></div>`}</div>`;
  }

  function playerHonors(p) {
    return `<div class="section-head"><span class="idx">01</span><h2>职业生涯荣誉</h2><span class="sub">CAREER HONORS · ${(p.honors || []).length} 项</span></div>
      <div class="honor-list">${(p.honors || []).map(h => `<div class="honor-row"><span class="pos">${esc(h.rank)}</span><span class="nm">${esc(h.name)}</span><span class="yr">${esc(h.date)}</span><span class="tm">${esc(h.team || '')}</span></div>`).join('') || `<div class="empty">${icon('trophy')}<b>暂无荣誉记录</b></div>`}</div>`;
  }

  function bindModal() {
    const root = $('#overlayRoot');
    root.querySelectorAll('[data-dtab]').forEach(b => b.addEventListener('click', () => { S.modal.tab = b.dataset.dtab; renderTeamModal(); }));
    root.querySelectorAll('[data-dtab-jump]').forEach(b => b.addEventListener('click', () => { S.modal.tab = b.dataset.dtabJump; renderTeamModal(); }));
    root.querySelectorAll('[data-team-fav]').forEach(b => b.addEventListener('click', async () => { await setFavorite(b.dataset.teamFav); renderTeamModal(); }));
    root.querySelectorAll('[data-team-hltv]').forEach(b => b.addEventListener('click', () => { if (b.dataset.teamHltv) window.nexus.openExternal(b.dataset.teamHltv); }));
    root.querySelectorAll('[data-player]').forEach(el => el.addEventListener('click', (e) => { e.stopPropagation(); openPlayer(el.dataset.player, false, S.modal?.type === 'team' ? S.modal.data?.id : S.modal?.fromTeam); }));
    root.querySelectorAll('[data-ptab]').forEach(b => b.addEventListener('click', () => { S.modal.tab = b.dataset.ptab; renderPlayerModal(); }));
    root.querySelectorAll('[data-player-refresh]').forEach(b => b.addEventListener('click', () => openPlayer(b.dataset.playerRefresh, true, S.modal?.fromTeam)));
    root.querySelectorAll('[data-player-team]').forEach(b => b.addEventListener('click', () => { if (b.dataset.playerTeam) openTeam(b.dataset.playerTeam); }));
    root.querySelectorAll('[data-match]').forEach(el => el.addEventListener('click', () => { closeModal(); openMatch(el.dataset.match); }));
    root.querySelectorAll('[data-match-dtab]').forEach(b => b.addEventListener('click', () => { S.modal.tab = b.dataset.matchDtab; renderMatchModal(); }));
    root.querySelectorAll('[data-stream-refresh]').forEach(b => b.addEventListener('click', () => loadStreams(b.dataset.streamRefresh, true)));
    root.querySelectorAll('[data-demo-download]').forEach(b => b.addEventListener('click', () => downloadDemo(b.dataset.demoDownload)));
    root.querySelectorAll('[data-demo-play]').forEach(b => b.addEventListener('click', () => playDemo(b.dataset.demoPlay)));
    root.querySelectorAll('[data-demo-reveal]').forEach(b => b.addEventListener('click', () => window.nexus.revealDemo(b.dataset.demoReveal)));
    root.querySelectorAll('[data-open-url]').forEach(b => b.addEventListener('click', () => window.nexus.openExternal(b.dataset.openUrl)));
  }

  /* --------------------------------------------------------------- match modal */
  async function openMatch(id) {
    if (!id) return;
    S.modal = { type: 'match', id, tab: 'overview', streams: null };
    const m = S.matches.find(x => x.id === id);
    if (!m) { toast('比赛不存在', id, 'err'); return; }
    modalShell(`<div class="dossier-head"><div class="dh-top"><div class="dh-title"><div class="eyebrow">MATCH TERMINAL / LOADING</div><h2>${esc(m.team1.name)} vs ${esc(m.team2.name)}</h2><div class="sub">${esc(m.event || '')} · ${esc(fmtFull(m.planTs))}</div></div></div><button class="modal-close" data-close>${icon('close')}</button></div><div class="dossier-body"><div class="skeleton" style="height:100px;margin-bottom:12px"></div><div class="skeleton" style="height:220px"></div></div>`, 'match-modal');
    try {
      const d = await window.nexus.getMatch(id);
      if (!S.modal || S.modal.id !== id) return;
      S.modal.data = d;
      if (d.match.status === 'live') loadStreams(id);
      renderMatchModal();
    } catch (e) {
      toast('比赛详情载入失败', e.message, 'err');
      closeModal();
    }
  }

  async function loadStreams(id, force = false) {
    if (!S.modal || S.modal.type !== 'match' || S.modal.id !== id) return;
    S.modal.streams = { loading: true, platforms: [] };
    if (S.modal.tab === 'streams') renderMatchModal();
    try {
      const data = await window.nexus.getStreams(id, force);
      if (!S.modal || S.modal.id !== id) return;
      S.modal.streams = data;
      if (S.modal.tab === 'streams') renderMatchModal();
    } catch (e) {
      if (!S.modal || S.modal.id !== id) return;
      S.modal.streams = { error: e.message, platforms: [] };
      if (S.modal.tab === 'streams') renderMatchModal();
    }
  }

  function renderMatchModal() {
    const d = S.modal?.data; if (!d) return;
    const m = { ...d.match };
    const p = predict(m);
    const tabs = [['overview', '概览'], ['maps', '地图'], ['players', '选手'], ['analysis', '分析']];
    if (m.status === 'live') tabs.push(['streams', '直播']);
    const body = S.modal.tab === 'overview' ? matchOverview(d, p) : S.modal.tab === 'maps' ? matchMaps(d) : S.modal.tab === 'players' ? matchPlayers(d) : S.modal.tab === 'streams' ? matchStreams(d) : matchAnalysis(d, p);
    modalShell(`
      <div class="dossier-head" style="padding-bottom:0">
        <div class="eyebrow">MATCH TERMINAL / ${esc(m.event || 'UNKNOWN EVENT')}</div>
        <div class="match-scoreboard">
          <div class="ms-team"><div class="logo-ring">${logoImg(m.team1.logo, m.team1.name)}</div><div><div class="nm">${esc(m.team1.name)}</div><div class="sub">V #${esc(S.teamMap.get(m.team1.id)?.valveRank || '—')} · H #${esc(S.teamMap.get(m.team1.id)?.hltvRank || '—')}</div></div></div>
          <div class="ms-score"><b style="${m.score1 > m.score2 ? 'color:var(--cyan)' : ''}">${m.status === 'upcoming' ? '—' : m.score1}</b><span class="sep">:</span><b style="${m.score2 > m.score1 ? 'color:var(--cyan)' : ''}">${m.status === 'upcoming' ? '—' : m.score2}</b></div>
          <div class="ms-team right"><div class="logo-ring">${logoImg(m.team2.logo, m.team2.name)}</div><div><div class="nm">${esc(m.team2.name)}</div><div class="sub">V #${esc(S.teamMap.get(m.team2.id)?.valveRank || '—')} · H #${esc(S.teamMap.get(m.team2.id)?.hltvRank || '—')}</div></div></div>
        </div>
        <div style="display:flex;justify-content:center;gap:8px;padding:0 0 12px">${statusPill(m.status)}<span class="pill">${esc(m.stage || '')}</span><span class="pill">BO${m.bo || '?'}</span><span class="pill">${esc(fmtFull(m.planTs))}</span></div>
        <button class="modal-close" data-close>${icon('close')}</button>
        <div class="dossier-tabs" style="margin:0 -22px;padding:0 22px">${tabs.map(([k, l]) => `<button class="dtab ${S.modal.tab === k ? 'active' : ''}" data-match-dtab="${k}">${l}</button>`).join('')}</div>
      </div>
      <div class="dossier-body">${body}</div>`, 'match-modal');
    bindModal();
  }

  function matchOverview(d, p) {
    const m = d.match;
    const hasDemo = S.demos.some(x => x.matchId === m.id);
    const job = S.demoJobs[m.id];
    const canDownload = m.status === 'finished';
    const demoAction = job?.active
      ? `<button class="btn small" disabled id="demoJob-${esc(m.id)}">${icon('download')} ${job.percent ? `下载 ${Math.round(job.percent)}%` : esc(job.label || '下载中…')}</button>`
      : hasDemo ? `<button class="btn small primary" data-demo-play="${esc(m.id)}">${icon('play')} 观看</button>`
      : canDownload ? `<button class="btn small" data-demo-download="${esc(m.id)}">${icon('download')} 下载 Demo</button>`
      : `<button class="btn small" disabled>${icon('clock')} 待开放</button>`;
    return `<div class="analysis-grid">
      <div>
        <div class="panel"><div class="panel-head"><h3>胜率推演</h3><span class="tag">PREDICTION</span></div><div class="panel-body"><div class="pred-big"><div class="p">${Math.round(p.pA * 100)}<small>%</small></div><div class="info"><b>${esc(m.team1.name)} 胜率</b><p>置信度 ${p.confidence}% · ${p.hasOdds ? '市场赔率已纳入模型' : '无盘口，按排名与状态推算'}</p></div></div><div class="pred-track"><i class="a" style="width:${p.pA * 100}%"></i><i class="b" style="width:${p.pB * 100}%"></i></div><div class="pred-labels" style="margin-top:5px"><span>${esc(m.team1.name)} ${Math.round(p.pA * 100)}%</span><span>${esc(m.team2.name)} ${Math.round(p.pB * 100)}%</span></div></div></div>
        <div class="panel" style="margin-top:12px"><div class="panel-head"><h3>地图 BP</h3><span class="tag">VETO</span></div><div class="panel-body"><div class="veto-strip">${(d.veto || []).map(v => `<span class="veto"><b>${esc(v.type)}</b> ${esc(v.map)}</span>`).join('') || `<span class="veto">暂无 BP 数据</span>`}</div></div></div>
      </div>
      <div>
        <div class="panel"><div class="panel-head"><h3>地图比分</h3><span class="tag">MAPS</span></div><div class="map-grid">${(d.maps || []).map(mp => `<div class="map-card">${logoImg(mp.icon, mp.name)}<div class="mc"><div class="mn">${esc(mp.name)}</div><div class="ms">${mp.s1} : ${mp.s2}</div><div class="mh">${esc(mp.half1)} / ${esc(mp.half2)}</div></div></div>`).join('') || `<div class="empty" style="grid-column:1/-1;padding:18px"><span>地图数据待同步</span></div>`}</div></div>
        <div class="demo-cta" style="margin-top:12px"><div class="ic">${icon('demo')}</div><div class="t"><b>HLTV Demo 回放</b><span>${hasDemo ? '本地已就绪，可直接注入 CS2' : canDownload ? '本地解析 HLTV 页面并直连 R2，无需人机验证' : '比赛结束后开放 Demo 下载'}</span></div>${demoAction}</div>
      </div>
    </div>`;
  }
  function matchMaps(d) {
    return `<div class="map-grid">${(d.maps || []).map(mp => `<div class="map-card" style="padding:14px">${logoImg(mp.icon, mp.name)}<div class="mc"><div class="mn" style="font-size:13px">${esc(mp.name)}</div><div class="ms" style="font-size:20px">${mp.s1} : ${mp.s2}</div><div class="mh">半场 ${esc(mp.half1)} / ${esc(mp.half2)} · ${mp.result ? (mp.result === 't1' ? 'T1 胜' : 'T2 胜') : '进行中'}</div></div></div>`).join('') || `<div class="empty" style="grid-column:1/-1">${icon('crosshair')}<b>暂无地图数据</b><span>比赛尚未开始或数据未同步</span></div>`}</div>`;
  }
  function matchPlayers(d) {
    const teamBlock = (t, ps) => `<div class="panel" style="margin-bottom:12px"><div class="panel-head"><div class="pt-team">${logoImg(t.logo, t.name)}<h3>${esc(t.name)}</h3></div><div class="spacer"></div><span class="tag">PLAYER STATS</span></div><table class="players-table"><thead><tr><th>选手</th><th>RATING</th><th>K-D</th><th>ADR</th><th>KAST</th><th>KPR</th></tr></thead><tbody>${ps.map(p => `<tr class="${p.mvp ? 'mvp' : ''}" ${p.id ? `data-player="${esc(p.id)}" title="打开 ${esc(p.name)} 选手档案"` : ''}><td>${esc(p.name)}</td><td>${p.rating ? p.rating.toFixed(2) : '—'}</td><td>${p.kills}-${p.deaths}</td><td>${p.adr ? p.adr.toFixed(1) : '—'}</td><td>${p.kast ? p.kast.toFixed(1) + '%' : '—'}</td><td>${p.kpr ? p.kpr.toFixed(2) : '—'}</td></tr>`).join('') || `<tr><td colspan="6" style="text-align:center;color:var(--dim);padding:18px">选手数据待同步</td></tr>`}</tbody></table></div>`;
    return teamBlock(d.match.team1, d.players.t1) + teamBlock(d.match.team2, d.players.t2);
  }
  function matchStreams(d) {
    const s = S.modal?.streams;
    const m = d.match;
    if (!s || s.loading) {
      return `<div class="stream-loading"><div class="skeleton" style="height:52px;margin-bottom:10px"></div><div class="skeleton" style="height:120px;margin-bottom:10px"></div><div class="skeleton" style="height:120px"></div></div>`;
    }
    const platforms = s.platforms || [];
    const badge = (id) => ({ douyu: '斗鱼', huya: '虎牙', douyin: '抖音' }[id] || id);
    return `
      <div class="stream-head">
        <div><div class="eyebrow">LIVE STREAM MATRIX / ${esc(m.event || '')}</div><h2>正在直播这场比赛</h2><div class="sub">按双方队名 / 中文别名 / 赛事名匹配平台公开直播列表，45 秒缓存</div></div>
        <button class="btn small" data-stream-refresh="${esc(m.id)}">${icon('refresh')} 刷新主播</button>
      </div>
      ${s.error ? `<div class="empty" style="padding:24px"><b>直播数据载入失败</b><span>${esc(s.error)}</span></div>` : ''}
      <div class="stream-platforms">
        ${platforms.map(pl => `
          <section class="stream-platform">
            <div class="stream-platform-head"><span class="platform-badge ${esc(pl.id)}"><i></i>${badge(pl.id)}</span><span class="sp-count">${pl.status === 'error' ? '接口异常' : `${pl.streamers.length} 位主播`}</span></div>
            ${pl.status === 'error' ? `<div class="stream-error">${esc(pl.error || '平台暂不可用')}</div>` : (pl.streamers || []).length ? `<div class="stream-list">${pl.streamers.map(x => `
              <div class="stream-card">
                <div class="stream-avatar ${esc(pl.id)}"><span>${esc(String(x.nick || badge(pl.id)).slice(0, 2))}</span></div>
                <div class="stream-info">
                  <div class="sn">${esc(x.nick || '匿名主播')}</div>
                  <div class="st">${esc(x.title || '')}</div>
                  <div class="sm"><span class="live-dot"></span><span>${esc(x.viewersLabel || '—')}</span>${x.via === 'room-page' ? '<span class="match-ok">赛事页确认</span>' : x.matched ? '<span class="match-ok">已匹配对阵</span>' : '<span class="match-soft">CS2 分区在播</span>'}</div>
                </div>
                <button class="btn tiny" data-open-url="${esc(x.url)}">进入</button>
              </div>`).join('')}</div>` : `<div class="stream-empty">暂未检索到正在播该场的主播</div>`}
          </section>`).join('')}
      </div>
      <div class="stream-note">直播数据来自斗鱼 / 虎牙 / 抖音公开页面；抖音标题不一定包含对阵，已标注“CS2 分区在播”的房间可能相关但未确认。点击进入会调用系统浏览器。</div>`;
  }

  function matchAnalysis(d, p) {
    return `<div class="analysis-grid">
      <div class="panel"><div class="panel-head"><h3>模型因子</h3><span class="tag">FACTORS</span></div><div class="panel-body">${p.factors.map(f => `<div class="factor"><div class="fl"><span>${esc(f.k)} <span style="color:var(--dim)">· 权重 ${Math.round(f.w * 100)}%</span></span><b>${f.v}%</b></div><div class="fb"><i style="width:${f.v}%"></i></div><div class="mono" style="font-size:7px;color:var(--dim)">${esc(f.hint)}</div></div>`).join('')}</div></div>
      <div>
        <div class="panel"><div class="panel-head"><h3>交手记录</h3><span class="tag">H2H</span></div><div class="panel-body">${p.h2h.ms.length ? p.h2h.ms.map(x => `<div class="h2h-row"><span>${esc(x.team1.name)} vs ${esc(x.team2.name)}</span><span class="sc">${x.score1} : ${x.score2}</span></div>`).join('') : `<div class="empty" style="padding:14px"><span>近 5 次无有效交手</span></div>`}</div></div>
        <div class="panel" style="margin-top:12px"><div class="panel-head"><h3>盘口 / 赔率</h3><span class="tag">MARKET</span></div><div class="panel-body"><div class="pred-big" style="padding:0"><div class="p" style="font-size:28px">${d.analysis?.odds1 || '—'}<small>%</small></div><div class="info"><b>5E 赛前市场</b><p>${d.analysis?.odds1 ? `${esc(d.match.team1.name)} ${d.analysis.odds1}% / ${esc(d.match.team2.name)} ${d.analysis.odds2}%` : '暂无盘口数据'}</p></div></div></div></div>
      </div>
    </div>`;
  }

  /* --------------------------------------------------------------- demo actions */
  async function downloadDemo(matchId) {
    if (S.demoJobs[matchId]?.active) return;
    S.demoJobs[matchId] = { active: true, percent: 0, label: '解析 HLTV 链路…' };
    if (S.modal?.type === 'match' && S.modal.data?.match.id === matchId) renderMatchModal();
    else render();
    toast('Demo 任务已启动', '本地解析 HLTV 页面与 R2 直链，无需人机验证', 'ok');
    try {
      const res = await window.nexus.downloadDemo(matchId);
      delete S.demoJobs[matchId];
      S.demos = await window.nexus.listDemos();
      if (S.modal?.type === 'match' && S.modal.data?.match.id === matchId) renderMatchModal();
      else render();
      toast('Demo 已就绪', `${matchId} · ${fmtSize(res.size)} · 可直接观看`, 'ok');
    } catch (e) {
      delete S.demoJobs[matchId];
      if (S.modal?.type === 'match' && S.modal.data?.match.id === matchId) renderMatchModal();
      else render();
      toast('Demo 下载失败', e.message, 'err');
    }
  }
  async function playDemo(matchId) {
    try {
      await window.nexus.playDemo(matchId);
      toast('已注入 CS2', '正在启动 +playdemo，请等待游戏载入', 'ok');
    } catch (e) {
      toast('无法启动 Demo', e.message, 'err');
    }
  }
  async function detectCs2() {
    try {
      const p = await window.nexus.detectCs2();
      if (p) { S.cs2Path = p; toast('已定位 CS2', p, 'ok'); render(); }
      else toast('未找到 CS2', '请确认 Steam 库中存在 Counter-Strike Global Offensive', 'err');
    } catch (e) { toast('检测失败', e.message, 'err'); }
  }

  /* --------------------------------------------------------------- palette */
  function paletteItems(query) {
    const q = query.trim().toLowerCase();
    const items = [];
    for (const t of S.teams) if (!q || t.name.toLowerCase().includes(q)) items.push({ type: 'team', id: t.id, name: t.name, sub: `V #${t.valveRank || '—'} · H #${t.hltvRank || '—'}`, icon: 'teams' });
    for (const m of S.matches) if (!q || `${m.team1.name} ${m.team2.name} ${m.event}`.toLowerCase().includes(q)) items.push({ type: 'match', id: m.id, name: `${m.team1.name} vs ${m.team2.name}`, sub: `${m.event || ''} · ${fmtDay(m.planTs)}`, icon: 'crosshair' });
    return items.slice(0, 24);
  }
  function openPalette(query = '') {
    S.paletteOpen = true; S.paletteQuery = query; S.paletteSel = 0;
    renderPalette();
    setTimeout(() => { const i = $('#paletteInput'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 30);
  }
  function closePalette() { S.paletteOpen = false; $('#paletteRoot').innerHTML = ''; }
  function renderPalette() {
    const items = paletteItems(S.paletteQuery);
    $('#paletteRoot').innerHTML = `<div class="palette-back"><div class="palette"><div class="palette-input">${icon('search')}<input id="paletteInput" value="${esc(S.paletteQuery)}" placeholder="搜索战队 / 比赛 / 赛事…" /><span class="mono" style="font-size:7px;color:var(--dim)">ESC 关闭</span></div><div class="palette-list" id="paletteList">${items.map((it, i) => `<div class="palette-item ${i === S.paletteSel ? 'sel' : ''}" data-palette-i="${i}"><span class="pi">${icon(it.icon)}</span><span class="pn">${esc(it.name)}</span><span class="pt">${esc(it.sub)}</span></div>`).join('') || `<div class="palette-empty">没有匹配结果</div>`}</div></div></div>`;
    const input = $('#paletteInput');
    input.addEventListener('input', () => { S.paletteQuery = input.value; S.paletteSel = 0; renderPalette(); setTimeout(() => { const i = $('#paletteInput'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 0); });
    input.addEventListener('keydown', (e) => {
      const list = paletteItems(S.paletteQuery);
      if (e.key === 'ArrowDown') { e.preventDefault(); S.paletteSel = Math.min(S.paletteSel + 1, list.length - 1); renderPalette(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); S.paletteSel = Math.max(S.paletteSel - 1, 0); renderPalette(); }
      else if (e.key === 'Enter') { e.preventDefault(); const it = list[S.paletteSel]; if (it) selectPalette(it); }
      else if (e.key === 'Escape') closePalette();
    });
    $$('#paletteRoot .palette-item').forEach(el => el.addEventListener('click', () => { const it = paletteItems(S.paletteQuery)[Number(el.dataset.paletteI)]; if (it) selectPalette(it); }));
    $('.palette-back')?.addEventListener('mousedown', (e) => { if (e.target.classList.contains('palette-back')) closePalette(); });
  }
  function selectPalette(it) {
    closePalette();
    if (it.type === 'team') openTeam(it.id);
    else if (it.type === 'match') openMatch(it.id);
  }

  /* --------------------------------------------------------------- toast */
  function toast(title, msg, type = '') {
    const root = $('#toastRoot');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="ti">${icon(type === 'err' ? 'alert' : type === 'ok' ? 'check' : 'bolt')}</span><div class="tt"><b>${esc(title)}</b>${msg ? `<span>${esc(msg)}</span>` : ''}</div>`;
    root.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 4200);
  }

  /* --------------------------------------------------------------- events */
  window.nexus?.onDemoProgress((d) => {
    if (!d?.id) return;
    const label = d.state === 'extracting' ? '解压 .dem…' : d.state === 'resolving' ? '解析 HLTV 链路…' : `下载 ${Math.round(d.percent || 0)}%`;
    S.demoJobs[d.id] = { active: d.state !== 'extracting' ? (d.percent || 0) < 100 : true, percent: d.percent || 0, label };
    const jobEl = document.getElementById(`demoJob-${d.id}`);
    if (jobEl) jobEl.textContent = label;
    if (S.view === 'demos') render();
  });

  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-view]');
    if (nav && !nav.closest('#paletteRoot')) { navigate(nav.dataset.view); return; }
    const teamFav = e.target.closest('[data-star]');
    if (teamFav) return;
  });

  /* --------------------------------------------------------------- init */
  buildChrome();
  boot();
})();
