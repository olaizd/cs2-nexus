const fs = require('fs');
const path = require('path');
const OUT = 'F:/工作区/cs2-nexus/data/seed';
const TEAM_DIR = path.join(OUT, 'teams');
fs.mkdirSync(TEAM_DIR, { recursive: true });
const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0',
  'Origin': 'https://event.5eplay.com', 'Referer': 'https://event.5eplay.com/',
  'Accept': 'application/json, text/plain, */*',
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: H });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(600 * (i + 1));
    }
  }
}
async function mapLimit(items, limit, fn) {
  let idx = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (idx < items.length) {
      const i = idx++;
      try { await fn(items[i], i); } catch (e) { console.log('ERR', items[i].team_id, e.message); }
      await sleep(80);
    }
  });
  await Promise.all(workers);
}

(async () => {
  const valve = JSON.parse(fs.readFileSync(path.join(OUT, 'ranking-valve.json'), 'utf8'));
  const hltv = JSON.parse(fs.readFileSync(path.join(OUT, 'ranking-hltv.json'), 'utf8'));
  const official = JSON.parse(fs.readFileSync(path.join(OUT, 'hltv-official-ranking.json'), 'utf8'));
  const byId = new Map();
  for (const r of valve) {
    byId.set(r.team_id, { team_id: r.team_id, team_name: r.team_name, team_logo: r.team_logo, country_logo: r.country_logo, valve: r.field_values, hltv: null, official: null });
  }
  for (const r of hltv) {
    if (!byId.has(r.team_id)) byId.set(r.team_id, { team_id: r.team_id, team_name: r.team_name, team_logo: r.team_logo, country_logo: r.country_logo, valve: null, hltv: r.field_values, official: null });
    else byId.get(r.team_id).hltv = r.field_values;
  }
  for (const o of official) {
    const num = (o.hltv_url.match(/team\/(\d+)/) || [])[1];
    let hit = byId.get('csgo_tm_' + num) || byId.get('hltv_team_' + num);
    if (!hit) hit = [...byId.values()].find(x => x.team_name.toLowerCase() === o.name.toLowerCase());
    if (hit) hit.official = o;
  }
  const teams = [...byId.values()];
  const bestRank = t => Math.min(Number(t.valve?.valve_rank) || 999, Number(t.official?.rank) || Number(t.hltv?.rank) || 999);
  teams.sort((a, b) => bestRank(a) - bestRank(b));
  fs.writeFileSync(path.join(OUT, 'teams-index.json'), JSON.stringify(teams, null, 2));
  console.log('teams', teams.length);

  const top = teams.filter(t => bestRank(t) < 999).slice(0, 64);
  await mapLimit(top, 4, async (t, i) => {
    const id = t.team_id;
    const base = `https://esports-data.5eplaycdn.com/v1/api/csgo/teams/${id}`;
    const [ov, honors, sessions] = await Promise.all([
      get(`${base}/overview?time_type=1`),
      get(`${base}/honors`),
      get(`https://app.5eplay.com/api/tournament/team_session_list?status=upcoming,live,past&page=1&game_type=1&tt_ids=&team_id=${id}&limit=20`),
    ]);
    const payload = {
      team_id: id,
      fetched_at: new Date().toISOString(),
      overview: ov.data?.overview || null,
      team_info: ov.data?.team_info || null,
      honors: honors.data || null,
      sessions: sessions.data?.items?.matches || [],
    };
    fs.writeFileSync(path.join(TEAM_DIR, id + '.json'), JSON.stringify(payload, null, 2));
    console.log(`team ${i + 1}/${top.length}`, id, t.team_name, payload.overview?.players?.length || 0);
  });

  const matches = [];
  const seen = new Set();
  for (const status of [1, 2]) {
    const maxPage = status === 1 ? 4 : 8;
    for (let p = 1; p <= maxPage; p++) {
      const j = await get(`https://app.5eplay.com/api/tournament/session_list?game_status=${status}&game_type=1&grades=&page=${p}&limit=20`);
      const ms = j.data?.matches || [];
      for (const m of ms) if (!seen.has(m.mc_info?.id)) { seen.add(m.mc_info?.id); matches.push(m); }
      console.log('matches', status, p, ms.length, matches.length);
      if (!ms.length) break;
    }
  }
  fs.writeFileSync(path.join(OUT, 'matches.json'), JSON.stringify(matches, null, 2));
  console.log('DONE matches', matches.length);
})().catch(e => { console.error(e); process.exit(1); });
