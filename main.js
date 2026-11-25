'use strict';

const { app, BrowserWindow, ipcMain, shell, session, dialog, powerMonitor } = require('electron');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn, execFile } = require('child_process');

const APP_DIR = __dirname;
const ROOT = app.isPackaged ? path.dirname(process.execPath) : __dirname;
const DATA = path.join(ROOT, 'data');
const SEED = path.join(DATA, 'seed');
const CACHE = path.join(DATA, 'cache');
const DEMOS = path.join(DATA, 'demos');
const APP_DATA = path.join(DATA, 'app');
const STORE_FILE = path.join(APP_DATA, 'settings.json');
const DEMO_INDEX = path.join(DEMOS, 'index.json');
const DEMO_LINKS = path.join(APP_DATA, 'demo-links.json');
const MAJOR_CACHE = path.join(CACHE, 'major.json');
const MAJOR_PICKS = path.join(APP_DATA, 'major-picks.json');
const MAJOR_UNLOCK_AT = Date.parse('2026-11-17T00:00:00+08:00') / 1000;
const MAJOR_EVENT_START = Date.parse('2026-11-24T00:00:00+08:00') / 1000;
const MAJOR_EVENT_END = Date.parse('2026-12-13T23:59:59+08:00') / 1000;
const MAJOR_STAGE_ORDER = ['stage1', 'stage2', 'stage3', 'final'];
const EDGE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0';
const HLTV_SCRIPT = path.join(APP_DIR, 'scripts', 'hltv-demo.py');
const PYTHON_BIN = process.env.CS2_NEXUS_PYTHON || 'python';
const API = 'https://esports-data.5eplaycdn.com';
const APP_API = 'https://app.5eplay.com';
const REQ_HEADERS = {
  'User-Agent': EDGE_UA,
  'Origin': 'https://event.5eplay.com',
  'Referer': 'https://event.5eplay.com/',
  'Accept': 'application/json, text/plain, */*',
};

fs.mkdirSync(APP_DATA, { recursive: true });
app.setName('CS2 NEXUS');
app.setPath('userData', APP_DATA);
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

let mainWindow = null;
const state = {
  matches: [],
  teamsIndex: [],
  valve: [],
  hltv: [],
  hltvOfficial: [],
  settings: { favoriteTeamId: 'csgo_tm_5995', autoRefresh: true, cs2Path: '' },
  lastSync: 0,
};
let demoEventsBound = false;
let activeDownload = null;

/* ------------------------------------------------------------------ utils */
const readJson = (p, fallback = null) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')); } catch { return fallback; }
};
const writeJson = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, p);
};
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const str = (v, d = '') => (typeof v === 'string' ? v : (v == null ? d : String(v)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cleanName = (s) => str(s).replace(/\s+/g, ' ').trim();
const fmtDate = (ts) => new Date(ts * 1000).toISOString();

function normalizeStatus(raw) {
  const st = raw.state || {};
  const mc = raw.mc_info || raw;
  const s = str(st.status || mc.status || mc.match_status).toLowerCase();
  if (s === '1' || s === 'live' || st.live_status === 1 || st.live_status === '1') return 'live';
  if (s === '2' || s === 'past' || s === 'finished' || s === 'result') return 'finished';
  if (s === '0' || s === 'upcoming' || s === 'not_started' || s === 'future') return 'upcoming';
  return 'upcoming';
}

function normalizeMatch(raw, teamId = null) {
  const mc = raw.mc_info || raw;
  const st = raw.state || {};
  const tt = raw.tt_info || mc.tt_info || {};
  const useHome = !!mc.home_info;
  const a = useHome ? (mc.home_info || {}) : (mc.t1_info || {});
  const b = useHome ? (mc.opponent_info || {}) : (mc.t2_info || {});
  const status = normalizeStatus(raw);
  const t1Score = num(st.t1_score ?? mc.home_score ?? mc.t1_score, 0);
  const t2Score = num(st.t2_score ?? mc.opponent_score ?? mc.t2_score, 0);
  const planTs = num(mc.plan_ts ?? mc.ts ?? st.plan_ts, 0);
  const odds1 = num(st.t1_odds_percent ?? mc.t1_odds_percent, 0);
  const odds2 = num(st.t2_odds_percent ?? mc.t2_odds_percent, 0);
  const maps = (st.bout_states || []).map((m) => ({
    n: num(m.bout_num, 0),
    name: cleanName(m.map_name),
    icon: str(m.map_icon || m.map_bgm),
    s1: num(m.t1_score, 0), s2: num(m.t2_score, 0),
    half1: str(m.t1_fh_rounds), half2: str(m.t2_fh_rounds),
    result: str(m.result), status: str(m.status),
  })).filter(m => m.name);
  const t1 = { id: str(a.id), name: cleanName(a.disp_name || a.name || 'TBD'), logo: str(a.logo), rank: num(a.v_rank, 0) };
  const t2 = { id: str(b.id), name: cleanName(b.disp_name || b.name || 'TBD'), logo: str(b.logo), rank: num(b.v_rank, 0) };
  let winner = null;
  if (status === 'finished') winner = t1Score > t2Score ? t1.id : (t2Score > t1Score ? t2.id : null);
  return {
    id: str(mc.id),
    team1: t1, team2: t2,
    score1: t1Score, score2: t2Score,
    status, winner,
    planTs, date: planTs ? fmtDate(planTs) : '',
    event: cleanName(tt.disp_name || tt.abbr_zh || ''),
    eventLogo: str(tt.logo),
    tier: cleanName(tt.grade_label || ''),
    stage: cleanName(mc.tt_stage_desc || mc.round_name || ''),
    format: str(mc.format || ''),
    bo: num(mc.format, 0),
    odds1, odds2,
    maps,
    raw: undefined,
  };
}

function normalizeTeam(match, teamId) {
  const isT1 = match.team1.id === teamId;
  const me = isT1 ? match.team1 : match.team2;
  const opp = isT1 ? match.team2 : match.team1;
  const myScore = isT1 ? match.score1 : match.score2;
  const oppScore = isT1 ? match.score2 : match.score1;
  const odds = isT1 ? match.odds1 : match.odds2;
  let result = null;
  if (match.status === 'finished') result = myScore > oppScore ? 'W' : (myScore < oppScore ? 'L' : 'D');
  return { ...match, me, opponent: opp, myScore, oppScore, odds, result };
}

/* ------------------------------------------------------------------ load data */
function loadState() {
  const seedMatches = readJson(path.join(SEED, 'matches.json'), []);
  const cachedMatches = readJson(path.join(CACHE, 'matches.json'), null);
  const matchesRaw = Array.isArray(cachedMatches) && cachedMatches.length ? cachedMatches : seedMatches;
  state.matches = matchesRaw.map(m => normalizeMatch(m)).filter(m => m.id && m.team1.id && m.team2.id);
  state.matches.sort((a, b) => {
    const rank = { live: 0, upcoming: 1, finished: 2 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return a.status === 'finished' ? b.planTs - a.planTs : a.planTs - b.planTs;
  });
  state.teamsIndex = readJson(path.join(SEED, 'teams-index.json'), []);
  state.valve = readJson(path.join(SEED, 'ranking-valve.json'), []);
  state.hltv = readJson(path.join(SEED, 'ranking-hltv.json'), []);
  state.hltvOfficial = readJson(path.join(SEED, 'hltv-official-ranking.json'), []);
  state.settings = { ...state.settings, ...readJson(STORE_FILE, {}) };
  state.lastSync = fs.existsSync(path.join(CACHE, 'matches.json')) ? fs.statSync(path.join(CACHE, 'matches.json')).mtimeMs : fs.statSync(path.join(SEED, 'matches.json')).mtimeMs;
}

function teamMap() {
  const map = new Map();
  for (const t of state.teamsIndex) map.set(t.team_id, t);
  return map;
}

function rankMap() {
  const map = new Map();
  for (const t of state.teamsIndex) {
    const v = t.valve || {};
    const h = t.hltv || {};
    const o = t.official || {};
    map.set(t.team_id, {
      valveRank: num(v.valve_rank, 0), valvePoint: num(v.valve_point, 0),
      hltvRank: num(o.rank, 0) || num(h.rank, 0), hltvPoint: num(o.points, 0) || num(h.point, 0),
      hltvChange: str(o.change || h.rank_change || ''),
      region: str(v.region_name || h.region_name || ''), change: str(v.rank_change || ''),
    });
  }
  return map;
}

function buildBrief(t) {
  const v = t.valve || {};
  const h = t.hltv || {};
  const o = t.official || {};
  return {
    id: t.team_id,
    name: cleanName(t.team_name),
    logo: str(t.team_logo),
    countryLogo: str(t.country_logo),
    region: str(v.region_name || h.region_name || ''),
    valveRank: num(v.valve_rank, 0), valvePoint: num(v.valve_point, 0),
    valveChange: str(v.rank_change || ''),
    hltvRank: num(o.rank, 0) || num(h.rank, 0),
    hltvPoint: num(o.points, 0) || num(h.point, 0),
    hltvChange: str(o.change || h.rank_change || ''),
    official: !!o.rank,
    hltvUrl: str(o.hltv_url || ''),
  };
}

function snapshot() {
  const teams = state.teamsIndex.map(buildBrief);
  return {
    matches: state.matches,
    teams,
    valve: state.valve.map(item => ({
      id: item.team_id, name: cleanName(item.team_name), logo: str(item.team_logo), countryLogo: str(item.country_logo),
      rank: num(item.field_values?.valve_rank, 0), points: num(item.field_values?.valve_point, 0),
      change: str(item.field_values?.rank_change || ''), region: str(item.field_values?.region_name || ''),
    })).filter(x => x.rank > 0).sort((a, b) => a.rank - b.rank),
    hltv: state.hltv.map(item => ({
      id: item.team_id, name: cleanName(item.team_name), logo: str(item.team_logo), countryLogo: str(item.country_logo),
      rank: num(item.field_values?.rank, 0), points: num(item.field_values?.point, 0),
      change: str(item.field_values?.rank_change || ''), region: str(item.field_values?.region_name || ''),
    })).filter(x => x.rank > 0).sort((a, b) => a.rank - b.rank),
    hltvOfficial: state.hltvOfficial,
    settings: state.settings,
    favorite: buildBrief(state.teamsIndex.find(t => t.team_id === state.settings.favoriteTeamId) || state.teamsIndex[0] || {}),
    lastSync: state.lastSync,
    generatedAt: new Date().toISOString(),
    storage: { root: ROOT, data: DATA, demos: DEMOS, cache: CACHE },
  };
}

/* ------------------------------------------------------------------ team detail */
async function fetchJson(url, opts = {}) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal, headers: { ...REQ_HEADERS, ...(opts.headers || {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(to); }
}

/* ------------------------------------------------------------------ major pick'em */
const MAJOR_STAGES = {
  stage1: { name: '第一阶段', en: 'STAGE I', short: 'STAGE 1' },
  stage2: { name: '第二阶段', en: 'STAGE II', short: 'STAGE 2' },
  stage3: { name: '第三阶段', en: 'STAGE III', short: 'STAGE 3' },
  final: { name: '最终阶段', en: 'CHAMPIONS STAGE', short: 'FINAL' },
};

function majorStageOf(raw) {
  const id = parseInt(str(raw?.mc_info?.id).replace(/\D/g, ''), 10) || 0;
  const name = cleanName(raw?.tt_info?.disp_name || '');
  if (/第一阶段/.test(name) || (id >= 2400494 && id <= 2400581)) return 'stage1';
  if (/第二阶段/.test(name) || (id >= 2400582 && id <= 2400614)) return 'stage2';
  if (id >= 2400756 && id <= 2400788) return 'stage3';
  if (id >= 2400789 && id <= 2400796) return 'final';
  return '';
}

function majorTeamOf(t) {
  const id = str(t?.id);
  const name = cleanName(t?.disp_name || t?.name || '');
  if (!id || !name || /^TBD$/i.test(name)) return null;
  return { id, name, logo: str(t?.logo), rank: num(t?.v_rank, 0) };
}

function buildMajorData(rows) {
  const stages = Object.fromEntries(MAJOR_STAGE_ORDER.map(id => [id, {
    id, ...MAJOR_STAGES[id], teams: [], matches: [], startAt: 0, endAt: 0, complete: false,
  }]));
  const eventRow = rows.find(r => /第一阶段/.test(str(r?.tt_info?.disp_name))) || rows[0] || {};
  for (const raw of rows) {
    const sid = majorStageOf(raw);
    if (!sid) continue;
    const m = normalizeMatch(raw);
    if (!m.id) continue;
    m.stageId = sid;
    m.round = m.stage;
    stages[sid].matches.push(m);
    if (m.planTs) {
      if (!stages[sid].startAt || m.planTs < stages[sid].startAt) stages[sid].startAt = m.planTs;
      if (!stages[sid].endAt || m.planTs > stages[sid].endAt) stages[sid].endAt = m.planTs;
    }
  }
  for (const stage of Object.values(stages)) {
    const map = new Map();
    for (const m of stage.matches) {
      for (const t of [m.team1, m.team2]) {
        const team = majorTeamOf({ id: t.id, disp_name: t.name, logo: t.logo, v_rank: t.rank });
        if (team && !map.has(team.id)) map.set(team.id, team);
      }
    }
    stage.teams = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    stage.matches.sort((a, b) => (a.planTs || 0) - (b.planTs || 0));
    if (stage.id !== 'final' && stage.teams.length) {
      const rec = new Map(stage.teams.map(t => [t.id, { w: 0, l: 0 }]));
      for (const m of stage.matches) {
        if (m.status !== 'finished' || !m.team1.id || !m.team2.id || !m.winner) continue;
        const loser = m.winner === m.team1.id ? m.team2.id : m.team1.id;
        if (rec.has(m.winner)) rec.get(m.winner).w += 1;
        if (rec.has(loser)) rec.get(loser).l += 1;
      }
      stage.complete = stage.teams.every(t => {
        const r = rec.get(t.id) || { w: 0, l: 0 };
        return r.w >= 3 || r.l >= 3;
      });
    } else {
      stage.complete = stage.teams.length > 0 && stage.matches.length > 0 && stage.matches.every(m => m.status === 'finished');
    }
  }
  const tt = eventRow.tt_info || {};
  return {
    event: {
      id: str(tt.id || 'csgo_tt_9303'),
      name: 'PGL 新加坡 Major 2026',
      logo: str(tt.logo || stages.stage1.matches[0]?.eventLogo || ''),
      startAt: MAJOR_EVENT_START,
      endAt: MAJOR_EVENT_END,
      unlockAt: MAJOR_UNLOCK_AT,
      city: cleanName(tt.city_name || '新加坡'),
      prize: cleanName(tt.bonus || '$1,250,000'),
    },
    stages: MAJOR_STAGE_ORDER.map(id => stages[id]),
    fetchedAt: new Date().toISOString(),
  };
}

async function getMajorData(force = false) {
  const cached = readJson(MAJOR_CACHE, null);
  const fresh = cached?.fetchedAt && Date.now() - new Date(cached.fetchedAt).getTime() < 5 * 60000;
  if (!force && fresh) return cached;
  try {
    const j = await fetchJson(`${API}/v1/api/csgo/matches?page=1&limit=500`);
    const rows = (j?.data?.matches || []).filter(raw => /PGL\s*新加坡\s*Major\s*2026/i.test(str(raw?.tt_info?.disp_name)));
    if (!rows.length) throw new Error('Major 赛程为空');
    const data = buildMajorData(rows);
    writeJson(MAJOR_CACHE, data);
    return data;
  } catch (e) {
    if (cached) return { ...cached, stale: true, error: e.message };
    throw e;
  }
}

function getMajorPicks() {
  const p = readJson(MAJOR_PICKS, {});
  return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
}

function saveMajorPicks(picks) {
  if (!picks || typeof picks !== 'object' || Array.isArray(picks)) throw new Error('无效的作业数据');
  writeJson(MAJOR_PICKS, picks);
  return picks;
}

async function fetchTeamRaw(id) {
  const base = `${API}/v1/api/csgo/teams/${encodeURIComponent(id)}`;
  const [ov, ho, se] = await Promise.all([
    fetchJson(`${base}/overview?time_type=1`),
    fetchJson(`${base}/honors`).catch(() => null),
    fetchJson(`${APP_API}/api/tournament/team_session_list?status=upcoming,live,past&page=1&game_type=1&tt_ids=&team_id=${encodeURIComponent(id)}&limit=20`).catch(() => null),
  ]);
  return {
    team_id: id,
    fetched_at: new Date().toISOString(),
    overview: ov?.data?.overview || null,
    team_info: ov?.data?.team_info || null,
    honors: ho?.data || null,
    sessions: se?.data?.items?.matches || se?.data?.matches || [],
  };
}

function normalizeTeamDetail(id, raw) {
  const idx = state.teamsIndex.find(t => t.team_id === id) || {};
  const brief = buildBrief(idx);
  const ov = raw?.overview || {};
  const info = raw?.team_info || {};
  const players = (ov.players || []).map(p => ({
    id: str(p.id), name: cleanName(p.name), photo: str(p.portrait || p.half_portrait),
    country: cleanName(p.country_en || p.country || ''), countryLogo: str(p.country_logo),
    birthday: str(p.birthday), bonus: str(p.bonus), top20: num(p.top20_num, 0),
    role: str(p.position), positions: Array.isArray(p.positions) ? p.positions.map(cleanName) : [],
  }));
  const sessions = (raw?.sessions || []).map(s => normalizeMatch(s, id))
    .filter(m => m.id && m.team1.id && m.team2.id)
    .map(m => normalizeTeam(m, id));
  sessions.sort((a, b) => a.status === 'finished' ? b.planTs - a.planTs : a.planTs - b.planTs);
  const honors = (raw?.honors?.history_honors || []).map(h => ({
    name: cleanName(h.tt_info?.disp_name || ''), rank: str(h.rank), logo: str(h.tt_info?.logo || ''),
  }));
  const majorHonors = (raw?.honors?.major_honors || []).map(h => ({
    name: cleanName(h.tt_info?.disp_name || h.name || ''), rank: str(h.rank), logo: str(h.tt_info?.logo || ''),
  }));
  const wins = num(ov.wins, 0), losses = num(ov.losses, 0);
  return {
    ...brief,
    name: cleanName(info.disp_name || brief.name),
    logo: str(info.logo || brief.logo),
    country: cleanName(info.country_name || ''),
    region: cleanName(info.region_name || brief.region),
    rank: num(info.rank, 0), points: num(info.points, 0),
    coach: cleanName(info.coach || ov.coach || ''),
    avgAge: num(info.average_player_age, 0),
    bonus: str(info.bonus || ''),
    stats: {
      winRate: num(str(ov.win_rate).replace('%', ''), 0),
      wins, losses, draws: num(ov.draws, 0), maps: num(ov.map_count, 0),
      kd: num(ov.kd_ratio, 0), kills: num(ov.kill, 0), deaths: num(ov.death, 0),
    },
    players, sessions, honors, majorHonors,
    recentForm: sessions.filter(s => s.status === 'finished').slice(0, 8).map(s => s.result).filter(Boolean),
    incomplete: !raw?.overview,
  };
}

async function getTeamDetail(id, force = false) {
  if (!id) throw new Error('缺少战队 ID');
  const cachePath = path.join(CACHE, 'teams', `${id}.json`);
  const seedPath = path.join(SEED, 'teams', `${id}.json`);
  let raw = force ? null : (readJson(cachePath) || readJson(seedPath));
  if (!raw || !raw.overview) {
    try {
      const fetched = await fetchTeamRaw(id);
      if (fetched.overview) { writeJson(cachePath, fetched); raw = fetched; }
    } catch (e) {
      if (!raw) raw = { team_id: id, overview: null, team_info: null, honors: null, sessions: [], error: e.message };
    }
  }
  return normalizeTeamDetail(id, raw);
}

/* ------------------------------------------------------------------ player detail */
function playerLinks(name, id) {
  const q = encodeURIComponent(name);
  return [
    { id: 'fivee', label: '5E PLAY', sub: '个人主页', exact: true, url: `https://event.5eplay.com/csgo/player/${encodeURIComponent(id)}` },
    { id: 'steam', label: 'STEAM', sub: '站内搜索', exact: false, url: `https://steamcommunity.com/search/users/?text=${q}` },
    { id: 'faceit', label: 'FACEIT', sub: '选手页', exact: false, url: `https://www.faceit.com/en/players/${q}` },
    { id: 'perfect', label: '完美世界', sub: '站内搜索', exact: false, url: `https://pvp.wanmei.com/csgo/player?keyword=${q}` },
    { id: 'hltv', label: 'HLTV', sub: '站内搜索', exact: false, url: `https://www.hltv.org/search?query=${q}` },
  ];
}

function ageFrom(birthday) {
  if (!birthday) return 0;
  const d = new Date(birthday); if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age > 0 ? age : 0;
}

async function fetchPlayerRaw(id) {
  const end = new Date();
  const start = new Date(end.getTime() - 92 * 86400000);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 00:00:00`;
  const body = {
    player_options: { time_value: `${fmt(start)}_${fmt(end)}`, player_id: id, time_type: 'recent' },
  };
  const [profile, stats, matches] = await Promise.all([
    fetchJson(`${API}/v1/api/csgo/players/${encodeURIComponent(id)}`),
    fetchJson(`${API}/v1/api/csgo/mfilter/player/stats`, { method: 'POST', headers: { 'Content-Type': 'application/json;charset=UTF-8' }, body: JSON.stringify(body) }),
    fetchJson(`${API}/v1/api/csgo/mfilter/player/match/list`, { method: 'POST', headers: { 'Content-Type': 'application/json;charset=UTF-8' }, body: JSON.stringify({ player_options: { player_id: id, page: 1 } }) }),
  ]);
  return {
    player_id: id,
    fetched_at: new Date().toISOString(),
    profile: profile?.data || null,
    stats: stats?.data || null,
    matches: matches?.data || null,
  };
}

function normalizePlayer(id, raw) {
  const profile = raw?.profile || {};
  const b = profile.basic_info || {};
  const pd = profile.player_data || {};
  const pf = profile.player_profile || {};
  const st = raw?.stats || {};
  const rp = st.player_performance || {};
  const rs = st.match_stats || {};
  const rpm = st.player_data || {};
  const teamId = str(b.team_id);
  const name = cleanName(b.name);
  const matchRaw = raw?.matches?.items?.matches || [];
  const matches = matchRaw.map((m) => {
    const mc = m.mc_info || {};
    const tt = m.tt_info || {};
    const home = mc.home_info || {};
    const away = mc.opponent_info || {};
    const isHome = !teamId || home.id === teamId;
    const me = isHome ? home : away;
    const opp = isHome ? away : home;
    const myScore = num(isHome ? mc.home_score : mc.opponent_score, 0);
    const oppScore = num(isHome ? mc.opponent_score : mc.home_score, 0);
    const result = str(mc.result || '');
    const win = result === 'home_win' ? !!isHome : result === 'opponent_win' ? !isHome : (myScore > oppScore ? true : myScore < oppScore ? false : null);
    return {
      id: str(mc.id), planTs: num(mc.ts, 0), event: cleanName(tt.disp_name || ''),
      eventLogo: str(tt.logo || ''), stage: cleanName(mc.tt_stage_desc || ''), format: num(mc.format, 0),
      status: str(mc.status || 'past'), me: cleanName(me.disp_name || ''), opponent: cleanName(opp.disp_name || 'TBD'),
      opponentId: str(opp.id || ''), opponentLogo: str(opp.logo || ''),
      myScore, oppScore, win, maps: Array.isArray(mc.bouts_result) ? mc.bouts_result : [],
    };
  }).sort((a, b) => b.planTs - a.planTs);
  const honors = (pf.history_honor || []).slice(0, 20).map((h) => ({
    name: cleanName(h.history_tt?.name || ''), rank: str(h.rank_desc || h.rank || ''),
    rankNo: str(h.rank || ''), date: str(h.history_tt?.start_time || '').slice(0, 10),
    team: cleanName(h.history_tt?.team_name || ''),
  }));
  const maps = (pd.maps || []).filter(x => num(x.use_num, 0) > 0).map(x => ({
    name: cleanName(x.name), useNum: num(x.use_num, 0), rating: num(x.rating, 0), kd: num(x.kd, 0),
  })).sort((a, b) => b.useNum - a.useNum);
  return {
    id: str(b.id || id), name, photo: str(b.portrait || b.half_portrait), halfPhoto: str(b.half_portrait),
    country: cleanName(b.country_zh || b.country_en || ''), countryEn: cleanName(b.country_en || ''),
    countryLogo: str(b.country_logo), birthday: str(b.birthday || ''), age: ageFrom(b.birthday),
    bonus: str(b.bonus || ''), top20: num(b.top20_num, 0), positions: Array.isArray(b.positions) ? b.positions.map(cleanName) : [],
    teamId, teamName: cleanName(b.team_name || ''), teamLogo: str(b.team_logo || ''),
    links: playerLinks(name, str(b.id || id)),
    career: {
      rating: num(pd.rating, 0), kd: num(pd.kd, 0), adr: num(pd.adr, 0), kast: num(pd.kast, 0),
      hs: num(pd.head_shot, 0), impact: num(pd.impact, 0), kpr: num(pd.kpr, 0), dpr: num(pd.dpr, 0),
      kills: num(pd.kill, 0), deaths: num(pd.death, 0), maps: num(pd.maps_played, 0), rounds: num(pd.rounds_played, 0),
    },
    recent: {
      rating: num(rp.rating?.value, 0), adr: num(rp.adr?.value, 0), kast: num(rp.kast?.value, 0),
      impact: num(rp.impact?.value, 0), kpr: num(rp.kpr?.value, 0), dpr: num(rp.dpr?.value, 0),
      kd: num(rpm.kd, 0), hsRate: num(rpm.hs_rate, 0), maps: num(rpm.map_count, 0),
      wins: num(rs.win, 0), losses: num(rs.loss, 0), total: num(rs.total, 0), winRate: num(str(rs.win_rate).replace('%', ''), 0),
      mvp: num(rs.mvp_count, 0),
    },
    maps, honors, matches, teammates: (pd.players || []).map(p => ({ id: str(p.id), name: cleanName(p.name), photo: str(p.portrait), country: cleanName(p.country_en || '') })),
    fetchedAt: str(raw?.fetched_at || ''),
  };
}

async function getPlayerDetail(id, force = false) {
  if (!id || !/^[a-z0-9_]+$/i.test(id)) throw new Error('无效的选手 ID');
  const cachePath = path.join(CACHE, 'players', `${id}.json`);
  let raw = force ? null : readJson(cachePath);
  const fresh = raw && raw.fetched_at && (Date.now() - new Date(raw.fetched_at).getTime() < 5 * 60000);
  if (!fresh) {
    try {
      const fetched = await fetchPlayerRaw(id);
      if (fetched.profile) { writeJson(cachePath, fetched); raw = fetched; }
    } catch (e) {
      if (!raw) throw e;
    }
  }
  if (!raw?.profile) throw new Error('该选手暂无 5E 档案');
  return normalizePlayer(id, raw);
}

/* ------------------------------------------------------------------ live streams */
const STREAM_HEADERS = {
  'User-Agent': EDGE_UA,
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};
const STREAM_ALIASES = {
  spirit: ['绿龙', '雪碧'], mouz: ['老鼠'], falcons: ['猎鹰'], vitality: ['小蜜蜂', '蜜蜂'],
  navi: ['navi', '黄黑'], furia: ['黑豹'], liquid: ['液体'], astralis: ['a队'], heroic: ['x队'],
  tyloo: ['天禄'], 'rare atom': ['ra'], 'the mongolz': ['蒙古'], aurora: ['极光'], g2: ['g2'],
  betboom: ['bb'], virtuspro: ['vp'], 'virtus.pro': ['vp'], faze: ['faze'],
};
const streamCache = new Map();
const huyaRoomCache = new Map();

async function fetchPublic(url, headers = {}, asText = false) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { ...STREAM_HEADERS, ...headers } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return asText ? await res.text() : await res.json();
  } finally { clearTimeout(to); }
}

function viewerNumber(v) {
  if (typeof v === 'number') return v;
  const s = String(v || '').replace(/,/g, '').trim();
  if (!s) return 0;
  if (/亿/.test(s)) return Math.round(parseFloat(s) * 1e8);
  if (/万/.test(s)) return Math.round(parseFloat(s) * 1e4);
  return num(s, 0);
}

function streamTokens(name) {
  const raw = cleanName(name);
  const base = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const set = new Set([raw.toLowerCase()]);
  if (STREAM_ALIASES[base]) for (const x of STREAM_ALIASES[base]) set.add(x.toLowerCase());
  for (const w of raw.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/)) if (w.length >= 2) set.add(w);
  return [...set].filter(Boolean);
}

function titleHitsMatch(title, match) {
  const t = String(title || '').toLowerCase();
  if (!t || /重播|回放|录播|复盘/.test(t)) return false;
  const tokens = [...streamTokens(match.team1?.name), ...streamTokens(match.team2?.name)];
  for (const token of tokens) {
    if (!token) continue;
    if (token.length <= 3 && /^[a-z0-9]+$/i.test(token)) {
      if (new RegExp(`(^|[^a-z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(t)) return true;
    } else if (t.includes(token)) return true;
  }
  return false;
}

function parseDouyinRooms(html) {
  const prefix = 'self.__pace_f.push([1,';
  let pos = 0, payload = null;
  while (pos < html.length) {
    const p = html.indexOf(prefix, pos);
    if (p < 0) break;
    const start = html.indexOf('"', p + prefix.length);
    let i = start + 1, esc = false;
    for (; i < html.length; i++) {
      const ch = html[i];
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') break;
    }
    try {
      const s = JSON.parse(html.slice(start, i + 1));
      if (s.includes('roomsData')) { payload = JSON.parse(s.replace(/^[0-9a-f]+:/, '')); break; }
    } catch {}
    pos = i + 1;
  }
  if (!payload) return [];
  const groups = [];
  const walk = (x) => {
    if (!x || typeof x !== 'object') return;
    if (x.roomsData && Array.isArray(x.roomsData.data)) groups.push(x.roomsData.data);
    for (const v of Object.values(x)) walk(v);
  };
  walk(payload);
  const rooms = [];
  for (const group of groups) for (const item of group) {
    const room = item.room || {};
    if (!room.id_str || !room.title) continue;
    rooms.push({
      id: str(room.id_str), webRid: str(item.web_rid), title: cleanName(room.title),
      game: cleanName(item.game_tag || ''), nick: cleanName(room.owner?.nickname || ''),
      avatar: str(item.avatar || room.owner?.avatar_thumb?.url_list?.[0]),
      cover: str(item.cover || room.cover?.url_list?.[0]),
      viewers: viewerNumber(room.room_view_stats?.display_short),
      viewersLabel: str(room.room_view_stats?.display_short || '—'),
    });
  }
  return rooms;
}

async function fetchDouyuStreams(match) {
  const data = await fetchPublic('https://www.douyu.com/gapi/rkc/directory/2_6/1', { Referer: 'https://www.douyu.com/' });
  const rows = (data?.data?.rl || []).map(x => ({
    id: str(x.rid), nick: cleanName(x.nn), title: cleanName(x.rn),
    avatar: /^https?:\/\//i.test(str(x.av)) ? str(x.av) : `https://img.douyucdn.cn/data/${str(x.av)}`,
    viewers: num(x.ol, 0), live: true,
  })).filter(x => x.id && x.nick && titleHitsMatch(x.title, match))
    .sort((a, b) => b.viewers - a.viewers).slice(0, 8);
  return rows.map(x => ({
    ...x, platform: 'douyu', platformName: '斗鱼', url: `https://www.douyu.com/${x.id}`,
    viewersLabel: x.viewers >= 10000 ? `${(x.viewers / 10000).toFixed(1)}万` : String(x.viewers), matched: true,
  }));
}

async function huyaRoomIsOnMatch(id, match) {
  const hit = huyaRoomCache.get(id);
  if (hit && Date.now() - hit.at < 60000) return hit.ok;
  try {
    const html = await fetchPublic(`https://www.huya.com/${id}`, { Referer: 'https://www.huya.com/csgo' }, true);
    const t = html.toLowerCase();
    const hasTeam = (name) => streamTokens(name).some(tok => tok.length >= 2 && t.includes(tok));
    const ok = /class="match-nav"/.test(t) && hasTeam(match.team1?.name) && hasTeam(match.team2?.name);
    if (ok) huyaRoomCache.set(id, { at: Date.now(), ok: true });
    return ok;
  } catch {
    return false;
  }
}

async function fetchHuyaStreams(match) {
  const data = await fetchPublic('https://www.huya.com/cache.php?m=LiveList&do=getLiveListByPage&gameId=862&page=1', { Referer: 'https://www.huya.com/csgo' });
  const all = (data?.data?.datas || []).map(x => ({
    id: str(x.profileRoom), nick: cleanName(x.nick), title: cleanName(x.introduction),
    avatar: str(x.avatar180 || x.screenshot), viewers: viewerNumber(x.totalCount), live: true,
  })).filter(x => x.id && x.nick);
  const exact = all.filter(x => titleHitsMatch(x.title, match));
  const exactIds = new Set(exact.map(x => x.id));
  const candidates = all.filter(x => !exactIds.has(x.id))
    .sort((a, b) => b.viewers - a.viewers).slice(0, 4);
  const enriched = [];
  const checks = await Promise.all(candidates.map(async (x) => ({ x, ok: await huyaRoomIsOnMatch(x.id, match) })));
  for (const { x, ok } of checks) if (ok) enriched.push({ ...x, matched: true, via: 'room-page' });
  const rows = [...exact.map(x => ({ ...x, matched: true })), ...enriched]
    .sort((a, b) => b.viewers - a.viewers).slice(0, 12);
  return rows.map(x => ({
    ...x, platform: 'huya', platformName: '虎牙', url: `https://www.huya.com/${x.id}`,
    viewersLabel: x.viewers >= 10000 ? `${(x.viewers / 10000).toFixed(1)}万` : String(x.viewers),
  }));
}

async function fetchDouyinStreams(match) {
  const html = await fetchPublic('https://live.douyin.com/categorynew/4_103', { Referer: 'https://live.douyin.com/' }, true);
  const rows = parseDouyinRooms(html).filter(x => /cs2|csgo|反恐精英/i.test(`${x.game} ${x.title}`))
    .map(x => ({ ...x, platform: 'douyin', platformName: '抖音', url: `https://live.douyin.com/${x.webRid || x.id}`, live: true }));
  const exact = rows.filter(x => titleHitsMatch(x.title, match));
  const use = exact.length ? exact : rows.slice(0, 3);
  return use.sort((a, b) => b.viewers - a.viewers).slice(0, 8).map(x => ({ ...x, matched: titleHitsMatch(x.title, match) }));
}

async function getLiveStreams(matchId, force = false) {
  const match = state.matches.find(m => m.id === matchId);
  if (!match) throw new Error('比赛不存在');
  const cached = streamCache.get(matchId);
  if (!force && cached && Date.now() - cached.at < 45000) return cached.data;
  const empty = (id, name) => ({ id, name, status: 'ok', error: '', streamers: [] });
  if (match.status !== 'live' && !force) {
    return { matchId, status: match.status, fetchedAt: new Date().toISOString(), platforms: [empty('douyu', '斗鱼'), empty('huya', '虎牙'), empty('douyin', '抖音')], note: '仅进行中的比赛展示直播主播' };
  }
  const jobs = [
    ['douyu', '斗鱼', fetchDouyuStreams(match)],
    ['huya', '虎牙', fetchHuyaStreams(match)],
    ['douyin', '抖音', fetchDouyinStreams(match)],
  ];
  const settled = await Promise.allSettled(jobs.map(j => j[2]));
  const platforms = settled.map((r, i) => {
    const [id, name] = jobs[i];
    if (r.status === 'fulfilled') return { id, name, status: 'ok', error: '', streamers: r.value };
    return { id, name, status: 'error', error: r.reason?.message || '平台暂不可用', streamers: [] };
  });
  const data = { matchId, status: match.status, fetchedAt: new Date().toISOString(), platforms };
  streamCache.set(matchId, { at: Date.now(), data });
  return data;
}

/* ------------------------------------------------------------------ match detail */
async function getMatchDetail(id, force = false) {
  const match = state.matches.find(m => m.id === id);
  if (!match) throw new Error('比赛不存在');
  const cachePath = path.join(CACHE, 'matches', `${id}.json`);
  const seedPath = path.join(SEED, 'match-details', `${id}.json`);
  let raw = force ? null : (readJson(cachePath) || readJson(seedPath));
  let detail = null, analysis = null;
  if (!raw) {
    try {
      const base = `${API}/v1/api/csgo/matches/${encodeURIComponent(id)}`;
      const [d, a] = await Promise.all([
        fetchJson(`${base}/data`),
        fetchJson(`${base}/analysis_v1`).catch(() => null),
      ]);
      detail = d?.data?.match || null;
      analysis = a?.data?.result || null;
      raw = { detail: d, analysis: a };
      writeJson(cachePath, raw);
    } catch (e) {
      raw = { error: e.message };
    }
  }
  if (!detail && raw?.detail) detail = raw.detail?.data?.match || null;
  if (!analysis && raw?.analysis) analysis = raw.analysis?.data?.result || null;

  const maps = (detail?.bouts_state || []).map(m => {
    let round = null;
    try { round = JSON.parse(m.event_log?.log?.log_info || '{}')?.round_end || null; } catch {}
    let s1 = num(m.t1_score ?? m.t1_quick_score, NaN);
    let s2 = num(m.t2_score ?? m.t2_quick_score, NaN);
    if (round && (!Number.isFinite(s1) || !Number.isFinite(s2) || (s1 === 0 && s2 === 0))) {
      const ct = num(round.ct_score, 0), t = num(round.t_score, 0);
      const winner = str(round.winner).toUpperCase();
      if (str(m.result) === 't1') { s1 = winner === 'CT' ? ct : t; s2 = winner === 'CT' ? t : ct; }
      else if (str(m.result) === 't2') { s2 = winner === 'CT' ? ct : t; s1 = winner === 'CT' ? t : ct; }
    }
    return {
      name: cleanName(m.map_name), icon: str(m.map_icon),
      s1: Number.isFinite(s1) ? s1 : 0, s2: Number.isFinite(s2) ? s2 : 0,
      half1: str(m.t1_fh_rounds) || '—', half2: str(m.t2_fh_rounds) || '—',
      result: str(m.result), status: str(m.status),
    };
  }).filter(m => m.name);
  const g = detail?.global_state || {};
  const players = (side) => (g[side] || []).map(p => ({
    id: str(p.id), name: cleanName(p.name), photo: str(p.portrait), logo: str(p.logo),
    country: cleanName(p.country_name || ''), countryLogo: str(p.country_logo),
    rating: num(p.Rating ?? p.rating, 0), adr: num(p.adr, 0), kast: num(str(p.kast).replace('%', ''), 0),
    kd: num(p.kd ?? p.kd_rate, 0), kpr: num(p.kpr, 0), impact: num(p.impact, 0),
    kills: num(p.kill, 0), deaths: num(p.death, 0), assists: num(p.assist, 0), mvp: false,
  }));
  const p1 = players('t1_player_stats'), p2 = players('t2_player_stats');
  const mvpId = str(g.mvp_player_stats?.id);
  [...p1, ...p2].forEach(p => { if (p.id && p.id === mvpId) p.mvp = true; });
  const veto = (g.bp_map_item || []).map(b => ({ type: str(b.bp_type), map: str(b.map_name), team: str(b.team_side), icon: str(b.map_icon) })).filter(b => b.map);
  const comparison = analysis?.comparison || null;
  const power = analysis?.power_comparison || null;
  return {
    match, maps, players: { t1: p1, t2: p2 }, veto, mvpId,
    analysis: {
      odds1: num(g.t1_odds_percent ?? match.odds1, 0), odds2: num(g.t2_odds_percent ?? match.odds2, 0),
      comparison, power,
      h2h: analysis?.rec_vs_matches || [], recent1: analysis?.t1_rec_matches || [], recent2: analysis?.t2_rec_matches || [],
    },
    detailAvailable: !!detail,
    error: raw?.error || '',
  };
}

/* ------------------------------------------------------------------ hltv / demo */
function runHltvPy(args, onEvent, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(PYTHON_BIN, [HLTV_SCRIPT, ...args], {
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
    } catch (e) {
      reject(e);
      return;
    }
    let settled = false;
    let stdout = '';
    let stderr = '';
    let result = null;
    let lastError = '';
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err); else resolve(result);
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      finish(new Error('HLTV Demo 链路超时'));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      let at;
      while ((at = stdout.indexOf('\n')) >= 0) {
        const line = stdout.slice(0, at).trim();
        stdout = stdout.slice(at + 1);
        if (!line.startsWith('{')) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.type === 'progress') onEvent?.(msg);
        else if (msg.type === 'result') result = msg;
        else if (msg.type === 'error') lastError = msg.message || '';
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 6000) stderr = stderr.slice(-6000);
    });
    child.on('error', (e) => {
      const hint = e.code === 'ENOENT'
        ? '未找到 Python 运行环境，请安装 Python 3.13 或把 python 加入 PATH'
        : e.message;
      finish(new Error(hint));
    });
    child.on('close', (code) => {
      if (code === 0 && result?.ok) return finish();
      const tail = stderr.trim().split('\n').filter(Boolean).pop() || '';
      finish(new Error(lastError || tail || `HLTV Demo 链路异常 (Python ${code})`));
    });
  });
}

async function resolveHltvMatch(match) {
  const cached = readJson(DEMO_LINKS, {}) || {};
  if (cached[match.id]?.demoPage) return cached[match.id];
  const info = await runHltvPy([
    'resolve',
    '--match-id', String(match.id || ''),
    '--team1', String(match.team1?.name || ''),
    '--team2', String(match.team2?.name || ''),
    '--plan-ts', String(match.planTs || 0),
  ], null, 120000);
  const out = {
    matchId: match.id,
    hltvId: info.hltvId || '',
    demoPage: info.demoPage,
    pageUrl: info.pageUrl || '',
    title: info.title || '',
    resolvedAt: new Date().toISOString(),
  };
  cached[match.id] = out;
  writeJson(DEMO_LINKS, cached);
  return out;
}

function unrarPath() {
  const p = 'C:\\Program Files\\WinRAR\\UnRAR.exe';
  return fs.existsSync(p) ? p : null;
}

async function extractDemo(archive, id) {
  const exe = unrarPath();
  if (!exe) throw new Error('未找到 WinRAR/UnRAR，无法解压 Demo');
  const out = path.join(DEMOS, `extract_${id}`);
  await fsp.rm(out, { recursive: true, force: true });
  await fsp.mkdir(out, { recursive: true });
  await new Promise((resolve, reject) => {
    const p = spawn(exe, ['x', '-o+', '-idq', archive, out + '\\'], { windowsHide: true });
    let err = '';
    p.stderr.on('data', d => err += d.toString());
    p.on('close', code => code === 0 ? resolve() : reject(new Error(err || `UnRAR ${code}`)));
  });
  const files = fs.readdirSync(out, { recursive: true }).map(f => path.join(out, f)).filter(f => f.toLowerCase().endsWith('.dem'));
  if (!files.length) throw new Error('压缩包内未找到 .dem 文件');
  files.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
  const dest = path.join(DEMOS, `${id}.dem`);
  await fsp.copyFile(files[0], dest);
  await fsp.rm(out, { recursive: true, force: true });
  await fsp.rm(archive, { force: true });
  return dest;
}

function demoIndex() {
  const idx = readJson(DEMO_INDEX, []);
  if (!Array.isArray(idx)) return [];
  return idx.map(d => {
    if (!d || !d.matchId) return null;
    const raw = d.file ? String(d.file) : '';
    const candidate = raw ? (path.isAbsolute(raw) ? raw : path.join(DEMOS, raw)) : '';
    const fallback = path.join(DEMOS, `${d.matchId}.dem`);
    const file = candidate && fs.existsSync(candidate) ? candidate : (fs.existsSync(fallback) ? fallback : '');
    return { ...d, file };
  }).filter(d => d && d.file);
}
function saveDemoIndex(idx) { writeJson(DEMO_INDEX, idx); }

async function resolveDemo(id) {
  const match = state.matches.find(m => m.id === id);
  if (!match) throw new Error('比赛不存在');
  const stored = demoIndex().find(d => d.matchId === id);
  if (stored?.status === 'ready' && stored.file && fs.existsSync(stored.file)) return stored;
  const cached = readJson(DEMO_LINKS, {}) || {};
  if (cached[id]?.demoPage) return { matchId: id, demoPage: cached[id].demoPage, hltvId: cached[id].hltvId, status: 'link' };
  const info = await resolveHltvMatch(match);
  return { ...info, status: 'link' };
}

async function downloadDemo(id) {
  const match = state.matches.find(m => m.id === id);
  if (!match) throw new Error('比赛不存在');
  if (activeDownload) throw new Error('已有 Demo 正在下载');
  const target = path.join(DEMOS, `${id}.rar`);
  activeDownload = { id, phase: 'resolving', target };
  try {
    const info = await resolveDemo(id);
    if (info.status === 'ready') return info;
    let total = 0;
    let received = 0;
    const send = (patch) => mainWindow?.webContents.send('demo:progress', { id, total, ...patch });
    send({ received: 0, total: 0, percent: 0, state: 'resolving' });
    const py = await runHltvPy([
      'download',
      '--download-page', info.demoPage,
      '--match-page', info.pageUrl || '',
      '--output', target,
    ], (ev) => {
      total = Number(ev.total) || total;
      received = Number(ev.received) || received;
      send({ received, total, percent: Number(ev.percent) || (total ? received / total * 100 : 0), state: 'progressing' });
    }, 45 * 60 * 1000);
    received = Number(py.bytes) || received;
    total = Number(py.total) || total;
    send({ received, total, percent: 100, state: 'extracting' });
    const dem = await extractDemo(target, id);
    const idx = demoIndex().filter(d => d.matchId !== id);
    idx.unshift({ matchId: id, file: dem, size: fs.statSync(dem).size, teams: [match.team1.name, match.team2.name], event: match.event, date: match.date, createdAt: new Date().toISOString() });
    saveDemoIndex(idx);
    return { status: 'ready', file: dem, size: fs.statSync(dem).size };
  } catch (e) {
    for (const f of [target, target + '.part']) {
      try { fs.rmSync(f, { force: true }); } catch {}
    }
    throw e;
  } finally {
    activeDownload = null;
  }
}

/* ------------------------------------------------------------------ CS2 */
function detectCs2() {
  return new Promise((resolve) => {
    const finish = (p) => resolve(p || '');
    try {
      execFile('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { windowsHide: true }, (err, stdout) => {
        if (err) return finish('');
        const m = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/i);
        if (!m) return finish('');
        const steam = m[1].trim().replace(/\//g, '\\');
        const vdf = path.join(steam, 'steamapps', 'libraryfolders.vdf');
        let libs = [steam];
        try {
          const txt = fs.readFileSync(vdf, 'utf8');
          const re = /"path"\s+"([^"]+)"/g; let mm;
          while ((mm = re.exec(txt))) libs.push(mm[1].replace(/\\\\/g, '\\'));
        } catch {}
        for (const lib of [...new Set(libs)]) {
          const p = path.join(lib, 'steamapps', 'common', 'Counter-Strike Global Offensive', 'game', 'csgo');
          if (fs.existsSync(p)) return finish(p);
        }
        finish('');
      });
    } catch { finish(''); }
  });
}

function detectSteamRoot() {
  return new Promise((resolve) => {
    try {
      execFile('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { windowsHide: true }, (err, stdout) => {
        if (err) return resolve('');
        const m = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/i);
        resolve(m ? m[1].trim().replace(/\//g, '\\') : '');
      });
    } catch { resolve(''); }
  });
}

async function playDemo(id) {
  const entry = demoIndex().find(d => d.matchId === id);
  if (!entry?.file || !fs.existsSync(entry.file)) throw new Error('Demo 文件不存在');
  const cs2 = state.settings.cs2Path || await detectCs2();
  if (!cs2 || !fs.existsSync(cs2)) throw new Error('未找到 CS2 安装目录，请在设置中手动指定');
  const name = `nexus_${String(id).replace(/[^\w]/g, '_')}.dem`;
  const dest = path.join(cs2, name);
  await fsp.copyFile(entry.file, dest);
  const steamRoot = await detectSteamRoot();
  const steam = steamRoot ? path.join(steamRoot, 'steam.exe') : '';
  if (steam && fs.existsSync(steam)) {
    spawn(steam, ['-applaunch', '730', '+playdemo', name], { detached: true, stdio: 'ignore' }).unref();
  } else {
    shell.openExternal(`steam://run/730//+playdemo%20${encodeURIComponent(name)}`);
  }
  return { ok: true, copied: dest };
}

/* ------------------------------------------------------------------ refresh */
async function refreshAll(win) {
  const progress = (message, percent) => win?.webContents.send('sync:progress', { message, percent });
  progress('连接 5E 赛事数据节点…', 4);
  const valve = [], hltv = [];
  const rankPayload = (type, page) => ({
    sort_value: 'desc', sort_key: type, region: '全部赛区', rank_type: type,
    team_options: { tt_ids: [], time_value: '', grade: [], team_id: '', time_type: '', tt_series: [], maps: [], page },
  });
  for (let p = 1; p <= 20; p++) {
    try {
      const j = await fetchJson(`${API}/v1/api/csgo/new/rank/team_list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rankPayload('valve_rank', p)) });
      valve.push(...(j?.data?.items || []));
    } catch (e) { console.warn('valve page', p, e.message); }
    if (p % 4 === 0) progress(`同步 V社排名 ${p}/20`, 4 + p * 1.2);
  }
  for (let p = 1; p <= 17; p++) {
    try {
      const j = await fetchJson(`${API}/v1/api/csgo/new/rank/team_list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rankPayload('rank', p)) });
      hltv.push(...(j?.data?.items || []));
    } catch (e) { console.warn('hltv page', p, e.message); }
    if (p % 4 === 0) progress(`同步 HLTV 排名 ${p}/17`, 28 + p * 1);
  }
  const matches = [];
  for (let p = 1; p <= 4; p++) {
    try {
      const j = await fetchJson(`${APP_API}/api/tournament/session_list?game_status=1&game_type=1&grades=&page=${p}&limit=20`);
      matches.push(...(j?.data?.matches || []));
    } catch (e) { console.warn('session', p, e.message); }
    progress(`拉取实时/待开赛程 ${p}/4`, 46 + p * 2);
  }
  for (let p = 1; p <= 8; p++) {
    try {
      const j = await fetchJson(`${APP_API}/api/tournament/session_list?game_status=2&game_type=1&grades=&page=${p}&limit=20`);
      matches.push(...(j?.data?.matches || []));
    } catch (e) { console.warn('past', p, e.message); }
    progress(`拉取历史赛果 ${p}/8`, 56 + p * 2);
  }
  if (valve.length) { state.valve = valve; writeJson(path.join(CACHE, 'ranking-valve.json'), valve); }
  if (hltv.length) { state.hltv = hltv; writeJson(path.join(CACHE, 'ranking-hltv.json'), hltv); }
  if (matches.length) {
    const seen = new Map();
    for (const m of matches) seen.set(str((m.mc_info || {}).id), m);
    const raw = [...seen.values()];
    writeJson(path.join(CACHE, 'matches.json'), raw);
    state.matches = raw.map(m => normalizeMatch(m)).filter(m => m.id && m.team1.id && m.team2.id);
    state.matches.sort((a, b) => {
      const rank = { live: 0, upcoming: 1, finished: 2 };
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return a.status === 'finished' ? b.planTs - a.planTs : a.planTs - b.planTs;
    });
  }
  state.lastSync = Date.now();
  progress('数据矩阵已重构', 100);
  const cs2 = state.settings.cs2Path || await detectCs2();
  return { ...snapshot(), demos: demoIndex(), cs2Path: cs2, cs2Detected: !!cs2 };
}

/* ------------------------------------------------------------------ live sync */
let autoTimer = null;
let fullTimer = null;
let autoBusy = false;
const AUTO_MS = 60000;

function snapshotWithExtras() {
  const cs2 = state.settings.cs2Path || '';
  return { ...snapshot(), demos: demoIndex(), cs2Path: cs2, cs2Detected: !!cs2, auto: { enabled: true, intervalMs: AUTO_MS, lastAt: state.lastSync } };
}

function matchSignature(matches) {
  return matches.map(m => `${m.id}:${m.status}:${m.score1}:${m.score2}:${m.planTs}`).join('|');
}

async function refreshLive() {
  if (autoBusy) return null;
  autoBusy = true;
  try {
    if (!state.matches?.length) loadState();
    const raw = [];
    for (let p = 1; p <= 2; p++) {
      try {
        const j = await fetchJson(`${APP_API}/api/tournament/session_list?game_status=1&game_type=1&grades=&page=${p}&limit=20`);
        raw.push(...(j?.data?.matches || []));
      } catch (e) { console.warn('live page', p, e.message); }
    }
    try {
      const j = await fetchJson(`${APP_API}/api/tournament/session_list?game_status=2&game_type=1&grades=&page=1&limit=20`);
      raw.push(...(j?.data?.matches || []));
    } catch (e) { console.warn('recent results', e.message); }
    if (!raw.length) return null;
    const before = matchSignature(state.matches);
    const merged = new Map(state.matches.map(m => [m.id, m]));
    const seen = new Set();
    for (const item of raw) {
      const m = normalizeMatch(item);
      if (m.id && m.team1.id && m.team2.id) { merged.set(m.id, m); seen.add(m.id); }
    }
    // If a match dropped out of the live/results window and is far past its
    // scheduled start, do not leave it pinned to the home hero as LIVE forever.
    const now = Date.now() / 1000;
    for (const [id, m] of merged) {
      if (m.status === 'live' && !seen.has(id) && m.planTs && now - m.planTs > 3 * 3600) {
        merged.set(id, { ...m, status: 'finished' });
      }
    }
    state.matches = [...merged.values()].sort((a, b) => {
      const rank = { live: 0, upcoming: 1, finished: 2 };
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return a.status === 'finished' ? b.planTs - a.planTs : a.planTs - b.planTs;
    });
    const changed = matchSignature(state.matches) !== before;
    mainWindow?.webContents.send('data:auto', { at: Date.now(), matches: state.matches.length, changed });
    if (!changed) return null;
    state.lastSync = Date.now();
    const snap = snapshotWithExtras();
    mainWindow?.webContents.send('data:update', snap);
    return snap;
  } finally {
    autoBusy = false;
  }
}

function stopAutoSync() {
  if (autoTimer) clearInterval(autoTimer);
  if (fullTimer) clearInterval(fullTimer);
  autoTimer = null;
  fullTimer = null;
}

function startAutoSync() {
  if (!state.matches?.length) loadState();
  if (state.settings.autoRefresh === false) return;
  stopAutoSync();
  autoTimer = setInterval(() => { refreshLive().catch(e => console.warn('auto live', e.message)); }, AUTO_MS);
  fullTimer = setInterval(async () => {
    if (autoBusy) return;
    autoBusy = true;
    try {
      const snap = await refreshAll(mainWindow);
      mainWindow?.webContents.send('data:update', snap);
    } catch (e) { console.warn('auto full', e.message); }
    finally { autoBusy = false; }
  }, 15 * 60000);
  setTimeout(() => { refreshLive().catch(e => console.warn('[AUTO] init', e.message)); }, 8000);
}

/* ------------------------------------------------------------------ settings */
function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  writeJson(STORE_FILE, state.settings);
  return state.settings;
}

/* ------------------------------------------------------------------ app */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1680, height: 1000, minWidth: 1280, minHeight: 780,
    frame: false, backgroundColor: '#05080e', show: false,
    title: 'CS2 NEXUS', icon: path.join(APP_DIR, 'assets', 'icon.ico'),
    webPreferences: { preload: path.join(APP_DIR, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(APP_DIR, 'app', 'index.html'));
  mainWindow.once('ready-to-show', () => { mainWindow.show(); mainWindow.focus(); });
  mainWindow.on('maximize', () => mainWindow.webContents.send('win:state', { maximized: true }));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('win:state', { maximized: false }));
  mainWindow.on('focus', async () => {
    if (state.settings.autoRefresh === false) return;
    if (Date.now() - (state.lastSync || 0) > AUTO_MS) {
      await refreshLive().catch(e => console.warn('focus sync', e.message));
    }
    // Repaint from authoritative main-process state even when the API result
    // did not change, so a renderer that missed an update while asleep recovers.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('data:update', snapshotWithExtras());
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

function registerIpc() {
  ipcMain.handle('bootstrap', async () => {
    if (!state.matches?.length) loadState();
    const cs2 = state.settings.cs2Path || await detectCs2();
    return { ...snapshot(), demos: demoIndex(), cs2Path: cs2, cs2Detected: !!cs2 };
  });
  ipcMain.handle('refresh', async () => refreshAll(mainWindow));
  ipcMain.handle('team:get', async (_e, id, force) => getTeamDetail(id, !!force));
  ipcMain.handle('player:get', async (_e, id, force) => getPlayerDetail(id, !!force));
  ipcMain.handle('match:get', async (_e, id, force) => getMatchDetail(id, !!force));
  ipcMain.handle('streams:get', async (_e, id, force) => getLiveStreams(id, !!force));
  ipcMain.handle('major:get', async (_e, force) => getMajorData(!!force));
  ipcMain.handle('major:picks:get', async () => getMajorPicks());
  ipcMain.handle('major:picks:set', async (_e, picks) => saveMajorPicks(picks));
  ipcMain.handle('favorite:set', async (_e, id) => { saveSettings({ favoriteTeamId: id }); return snapshot().favorite; });
  ipcMain.handle('settings:set', async (_e, patch) => {
    const next = saveSettings(patch);
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'autoRefresh')) {
      if (patch.autoRefresh) startAutoSync(); else stopAutoSync();
    }
    return next;
  });
  ipcMain.handle('settings:get', async () => state.settings);
  ipcMain.handle('demo:resolve', async (_e, id) => resolveDemo(id));
  ipcMain.handle('demo:download', async (_e, id) => downloadDemo(id));
  ipcMain.handle('demo:list', async () => demoIndex());
  ipcMain.handle('demo:play', async (_e, id) => playDemo(id));
  ipcMain.handle('demo:reveal', async (_e, id) => {
    const d = demoIndex().find(x => x.matchId === id);
    if (d?.file) shell.showItemInFolder(d.file);
    else shell.openPath(DEMOS);
    return true;
  });
  ipcMain.handle('open-folder', async (_e, which) => { const p = which === 'demos' ? DEMOS : which === 'data' ? DATA : ROOT; shell.openPath(p); return p; });
  ipcMain.handle('detect-cs2', async () => { const p = await detectCs2(); if (p) saveSettings({ cs2Path: p }); return p; });
  ipcMain.handle('shell:open', async (_e, url) => { if (/^https?:/i.test(url)) await shell.openExternal(url); return true; });
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => { if (!mainWindow) return; mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:state', () => ({ maximized: !!mainWindow?.isMaximized() }));
}

function configureStreamImages() {
  const filter = { urls: ['https://img.douyucdn.cn/*', 'https://huyaimg.msstatic.com/*'] };
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const headers = details.requestHeaders;
    headers['User-Agent'] = EDGE_UA;
    headers['Referer'] = details.url.includes('douyucdn') ? 'https://www.douyu.com/' : 'https://www.huya.com/';
    callback({ requestHeaders: headers });
  });
}

app.whenReady().then(() => {
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(DEMOS, { recursive: true });
  fs.mkdirSync(APP_DATA, { recursive: true });
  configureStreamImages();
  registerIpc();
  createWindow();
  startAutoSync();
  powerMonitor.on('resume', async () => {
    if (state.settings.autoRefresh === false) return;
    await refreshLive().catch(e => console.warn('resume sync', e.message));
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('data:update', snapshotWithExtras());
    }
  });
});
app.on('before-quit', () => { if (autoTimer) clearInterval(autoTimer); if (fullTimer) clearInterval(fullTimer); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
