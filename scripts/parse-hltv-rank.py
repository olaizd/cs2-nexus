import sys, json, re
sys.path.insert(0, r'F:\工作区\cs2-nexus\vendor\py')
from bs4 import BeautifulSoup
html=open(r'F:\工作区\cs2-research\hltv-rank.html',encoding='utf-8').read()
soup=BeautifulSoup(html,'lxml')
rows=[]
for box in soup.select('div.ranked-team'):
    pos=box.select_one('.position')
    name=box.select_one('.teamLine .name')
    pts=box.select_one('.points')
    change=box.select_one('.change')
    img=box.select_one('.team-logo img')
    link=box.select_one('a[href^="/team/"]')
    players=[p.get_text(strip=True) for p in box.select('.rankingNicknames span')]
    if not name: continue
    rows.append({
        'rank': int(re.sub(r'\D','',pos.get_text()) or 0),
        'name': name.get_text(strip=True),
        'points': int(re.sub(r'\D','',pts.get_text()) or 0) if pts else 0,
        'change': change.get_text(strip=True) if change else '',
        'logo': img.get('src') if img else '',
        'hltv_url': 'https://www.hltv.org'+link.get('href') if link else '',
        'players': players,
    })
print(len(rows))
for r in rows[:5]: print(r)
json.dump(rows, open(r'F:\工作区\cs2-nexus\data\seed\hltv-official-ranking.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)
