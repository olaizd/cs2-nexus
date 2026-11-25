import sys, json, re, time, os
sys.path.insert(0, r'F:\工作区\cs2-nexus\vendor\py')
from bs4 import BeautifulSoup
from curl_cffi import requests

ROOT = r'F:\工作区\cs2-nexus'
matches = json.load(open(os.path.join(ROOT, 'data/seed/matches.json'), encoding='utf-8'))
cookies = json.load(open(r'F:\工作区\cs2-research\hltv-cookies.json', encoding='utf-8'))
ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0'
s = requests.Session(impersonate='edge101')
for c in cookies:
    if c['domain'].endswith('hltv.org'):
        s.cookies.set(c['name'], c['value'], domain=c['domain'], path=c.get('path','/'))
H = {'User-Agent': ua, 'Referer': 'https://www.hltv.org/results', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9'}

def state_of(m):
    st = (m.get('state') or {}).get('status')
    if st is None: st = (m.get('mc_info') or {}).get('status')
    return str(st)

past = [m for m in matches if state_of(m) == '2']
past.sort(key=lambda m: int((m.get('mc_info') or {}).get('plan_ts') or 0), reverse=True)
links = {}
for i, m in enumerate(past[:36]):
    mid = (m.get('mc_info') or {}).get('id') or ''
    num = re.sub(r'\D', '', mid)
    if not num:
        continue
    url = f'https://www.hltv.org/matches/{num}'
    try:
        r = s.get(url, headers=H, timeout=45, allow_redirects=True)
        if r.status_code != 200:
            print(mid, 'HTTP', r.status_code, flush=True); time.sleep(1.2); continue
        soup = BeautifulSoup(r.text, 'lxml')
        btn = soup.select_one('[data-demo-link]')
        title = soup.title.get_text(strip=True) if soup.title else ''
        teams = [x.get_text(strip=True) for x in soup.select('.teamName')][:2]
        ev = soup.select_one('.event a')
        d = {
            'match_id': mid,
            'hltv_id': num,
            'hltv_url': r.url,
            'title': title,
            'teams': teams,
            'event': ev.get_text(strip=True) if ev else '',
            'demo_page': '',
            'direct_url': '',
            'fetched_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
        }
        if btn:
            d['demo_page'] = 'https://www.hltv.org' + btn.get('data-demo-link')
            rr = s.get(d['demo_page'], headers={'User-Agent': ua, 'Referer': r.url}, allow_redirects=False, timeout=45)
            if rr.status_code in (301,302,303,307,308):
                d['direct_url'] = rr.headers.get('location','')
        links[mid] = d
        print(i+1, mid, 'demo' if d['demo_page'] else 'no-demo', d['teams'], flush=True)
        time.sleep(1.1)
    except Exception as e:
        print(mid, 'ERR', repr(e), flush=True)
        time.sleep(2)

json.dump(links, open(os.path.join(ROOT, 'data/seed/demo-links.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('saved', len(links), 'with demo', sum(1 for v in links.values() if v['demo_page']))
