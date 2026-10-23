"""检查听力题数据：python3 tools/listen/check.py"""
import json, re, sys
from collections import Counter
from pathlib import Path
D = Path(__file__).parent
NC = {'kadai': 4, 'point': 4, 'gaiyou': 4, 'tougou': 4, 'hatsuwa': 3, 'sokuji': 3}
bad = 0
for L in ['N5', 'N4', 'N3', 'N2', 'N1']:
    f = D / f'{L}.json'
    if not f.exists():
        print(L, 'missing'); continue
    d = json.loads(f.read_text(encoding='utf-8'))
    for i, x in enumerate(d):
        err = []
        t = x.get('t')
        if t not in NC: err.append('type')
        if len(x.get('c', [])) != NC.get(t, 0) or len(x.get('cz', [])) != len(x.get('c', [])): err.append('choices')
        if not (0 <= x.get('a', -1) < len(x.get('c', []))): err.append('answer')
        if len(set(x.get('c', []))) != len(x.get('c', [])): err.append('dup choice')
        for ln in x.get('lines', []):
            if len(ln) != 3 or ln[0] not in ('M', 'F', 'M2', 'F2') or not ln[1].strip(): err.append('line'); break
        txt = x.get('intro', '') + x.get('q', '') + ''.join(l[1] for l in x.get('lines', [])) + ''.join(x.get('c', []))
        if re.search(r'[0-9０-９%％→〜～（(]', txt): err.append('chars:' + ''.join(sorted(set(re.findall(r'[0-9０-９%％→〜～（(]', txt)))))
        if t == 'sokuji' and len(x.get('lines', [])) != 1: err.append('sokuji lines')
        if t == 'hatsuwa' and x.get('lines'): err.append('hatsuwa lines')
        if t in ('kadai', 'point', 'tougou') and not x.get('q'): err.append('q')
        if not x.get('ex'): err.append('ex')
        if err:
            bad += 1; print(L, i, t, err)
    print(L, len(d), dict(Counter(x['t'] for x in d)), 'answers', dict(sorted(Counter(x['a'] for x in d).items())))
sys.exit(1 if bad else 0)
