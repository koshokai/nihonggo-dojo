import json, sys
from collections import Counter
from pathlib import Path
D = Path(__file__).parent
TYPES = {'topik1': {'어휘', '유의', '주제', '일치', '순서', '독해'}, 'topik2': {'어휘', '유의', '주제', '일치', '순서', '제목', '독해'},
         'cet4': {'词汇', '语法', '翻译', '匹配', '阅读'}, 'cet6': {'词汇', '语法', '翻译', '匹配', '阅读'}}
bad = 0
for f in sorted(D.glob('*.json')):
    name = f.stem.split('_')[0]; types = TYPES[name]
    d = json.loads(f.read_text(encoding='utf-8'))
    for i, x in enumerate(d):
        ok = len(x) == 4 and x[0] in types and isinstance(x[2], list) and len(x[2]) == 4 and len(set(x[2])) == 4 and x[1] and x[3]
        if ok and x[0] in ('주제', '일치', '독해', '阅读', '匹配') and '◆' not in x[1]: ok = False
        if not ok:
            bad += 1; print(name, i, str(x)[:120])
    print(f.name, len(d), dict(Counter(x[0] for x in d)))
sys.exit(1 if bad else 0)
