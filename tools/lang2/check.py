import json, sys
from pathlib import Path
D = Path(__file__).parent
LV = {'ko': {'初级', '中级', '高级'}, 'en': {'基础', '四级', '六级'}}
bad = 0
def err(*a):
    global bad; bad += 1; print(*a)
for lang in ('ko', 'en'):
    f = D / f'{lang}_grammar.json'
    if f.exists():
        d = json.loads(f.read_text(encoding='utf-8'))
        for i, g in enumerate(d):
            if g.get('lv') not in LV[lang] or not g.get('p') or len(g.get('eg', [])) < 2 or len(g['q'][1]) != 4 or len(set(g['q'][1])) != 4: err(f.name, i)
        print(f.name, len(d))
    f = D / f'{lang}_reading.json'
    if f.exists():
        d = json.loads(f.read_text(encoding='utf-8'))
        for i, a in enumerate(d):
            if a.get('lv') not in LV[lang] or not a.get('p') or any(len(s) != 2 for p in a['p'] for s in p) or any(len(w) != 3 for w in a['w']) or any(len(q) != 5 for q in a['q']): err(f.name, i)
        print(f.name, len(d))
    f = D / f'{lang}_listen.json'
    if f.exists():
        d = json.loads(f.read_text(encoding='utf-8'))
        NC = {'sokuji': 3, 'kadai': 4, 'point': 4, 'gaiyou': 4}
        for i, x in enumerate(d):
            if x.get('t') not in NC or len(x['c']) != NC[x['t']] or len(x['cz']) != len(x['c']) or not 0 <= x['a'] < len(x['c']) or x.get('lv') not in LV[lang]: err(f.name, i)
            if x.get('t') == 'sokuji' and len(x['lines']) != 1: err(f.name, i, 'sokuji lines')
        print(f.name, len(d))
    f = D / f'{lang}_daily.json'
    if f.exists():
        d = json.loads(f.read_text(encoding='utf-8'))
        if len({x[0] for x in d}) != len(d): err(f.name, 'duplicates')
        for i, x in enumerate(d):
            if len(x) != 4 or not x[0] or not x[2]: err(f.name, i)
        print(f.name, len(d))
    f = D / f'{lang}_biz.json'
    if f.exists():
        d = json.loads(f.read_text(encoding='utf-8'))
        n = sum(len(s['items']) for s in d['phrases'])
        for e in d['emails']:
            if len(e['body']) != len(e['bodyZh']): err(f.name, e['title'])
        print(f.name, n, 'phrases', len(d['emails']), 'emails')
sys.exit(1 if bad else 0)
