const fs = require('fs');
const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0',
  'Origin': 'https://event.5eplay.com', 'Referer': 'https://event.5eplay.com/', 'Accept': 'application/json',
};
(async () => {
  const id = 'csgo_mc_2400203';
  const base = 'https://esports-data.5eplaycdn.com/v1/api/csgo';
  const [d, a] = await Promise.all([
    fetch(`${base}/matches/${id}/data`, { headers: H }).then(r => r.json()),
    fetch(`${base}/matches/${id}/analysis_v1`, { headers: H }).then(r => r.json()),
  ]);
  fs.mkdirSync('F:/工作区/cs2-nexus/data/seed/match-details', { recursive: true });
  fs.writeFileSync(`F:/工作区/cs2-nexus/data/seed/match-details/${id}.json`, JSON.stringify({ detail: d, analysis: a }, null, 2));
  const m = d.data.match;
  console.log('mc keys', Object.keys(m.mc_info));
  console.log('t1', JSON.stringify(m.mc_info.t1_info, null, 2));
  console.log('global keys', Object.keys(m.global_state));
  console.log('players1', JSON.stringify(m.global_state.t1_player_stats?.[0], null, 2));
  console.log('bouts0 keys', Object.keys(m.bouts_state[0]));
  const b = m.bouts_state[0];
  for (const k of Object.keys(b)) {
    const v = b[k];
    if (Array.isArray(v)) console.log('bout', k, 'array', v.length, v[0] && typeof v[0] === 'object' ? Object.keys(v[0]).slice(0,10) : '');
    else if (v && typeof v === 'object') console.log('bout', k, 'obj', Object.keys(v).slice(0,10));
  }
  console.log('analysis power', JSON.stringify(a.data.result.power_comparison, null, 2).slice(0, 1200));
  console.log('analysis comp keys', Object.keys(a.data.result.comparison));
})();
