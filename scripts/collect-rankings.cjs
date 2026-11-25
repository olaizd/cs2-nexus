const fs = require('fs');
const path = require('path');
const OUT = 'F:/工作区/cs2-nexus/data/seed';
fs.mkdirSync(OUT, { recursive: true });

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0',
  'Origin': 'https://event.5eplay.com',
  'Referer': 'https://event.5eplay.com/',
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
};

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function get(url, headers = {}) {
  const r = await fetch(url, { headers: { ...HEADERS, ...headers } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

const rankBody = (type, page) => ({
  sort_value: 'desc', sort_key: type, region: '全部赛区', rank_type: type,
  team_options: { tt_ids: [], time_value: '', grade: [], team_id: '', time_type: '', tt_series: [], maps: [], page },
});

(async () => {
  const valve = [], hltv = [];
  for (let p = 1; p <= 20; p++) {
    const j = await post('https://esports-data.5eplaycdn.com/v1/api/csgo/new/rank/team_list', rankBody('valve_rank', p));
    valve.push(...(j.data?.items || []));
    process.stdout.write(`valve ${p} ${valve.length}\n`);
    if (!j.data?.items?.length || p >= Number(j.data.total_page || 0)) break;
  }
  fs.writeFileSync(path.join(OUT, 'ranking-valve.json'), JSON.stringify(valve, null, 2));
  for (let p = 1; p <= 20; p++) {
    const j = await post('https://esports-data.5eplaycdn.com/v1/api/csgo/new/rank/team_list', rankBody('rank', p));
    hltv.push(...(j.data?.items || []));
    process.stdout.write(`hltv ${p} ${hltv.length}\n`);
    if (!j.data?.items?.length || p >= Number(j.data.total_page || 0)) break;
  }
  fs.writeFileSync(path.join(OUT, 'ranking-hltv.json'), JSON.stringify(hltv, null, 2));
  console.log('DONE', valve.length, hltv.length);
})().catch(e => { console.error(e); process.exit(1); });
