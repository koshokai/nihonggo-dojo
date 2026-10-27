import sys
from pathlib import Path
D = Path(__file__).parent
bad = 0
for f in sorted(D.glob('in_*.tsv')):
    o = D / f.name.replace('in_', 'zh_')
    if not o.exists():
        print(o.name, 'missing'); continue
    a = f.read_text(encoding='utf-8').splitlines(); b = o.read_text(encoding='utf-8').splitlines()
    if len(a) != len(b):
        print(o.name, 'lines', len(a), len(b)); bad += 1; continue
    for i, (x, y) in enumerate(zip(a, b)):
        p = y.split('\t')
        if len(p) != 2 or p[0] != x.split('\t')[0] or not p[1].strip():
            print(o.name, 'line', i + 1, repr(y[:80])); bad += 1; break
    else:
        print(o.name, 'ok', len(b))
sys.exit(1 if bad else 0)
