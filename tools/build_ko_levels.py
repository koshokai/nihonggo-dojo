"""韩语分级词库第二步：tools/kozh/ko_graded.tsv + 中文释义 zh_XX.tsv → lang/ko-levels.json、lang/ko-A.json（初级）、ko-B.json（中级）、ko-C.json（高级）

每项：[词, 汉字, 中文]。数据来自国立国语院《한국어기초사전》（CC BY-SA 2.0 KR），中文释义为本站编写，同样以 CC BY-SA 2.0 KR 发布。
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / 'tools' / 'kozh'
NAMES = {'A': '初级', 'B': '中级', 'C': '高级'}

zh = {}
for f in sorted(D.glob('zh_*.tsv')):
    for line in f.read_text(encoding='utf-8').splitlines():
        k, v = line.split('\t')
        zh[k] = v
out = {k: [] for k in NAMES}
missing = 0
for line in (D / 'ko_graded.tsv').read_text(encoding='utf-8').splitlines():
    key, word, pos, hanja, en, ja, lv, _ = line.split('\t')
    if key not in zh:
        missing += 1
        continue
    out[lv].append([word, hanja, zh[key]])
for k, rows in out.items():
    (ROOT / 'lang' / f'ko-{k}.json').write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
(ROOT / 'lang' / 'ko-levels.json').write_text(json.dumps([[k, n, len(out[k])] for k, n in NAMES.items()], ensure_ascii=False), encoding='utf-8')
print({k: len(v) for k, v in out.items()}, 'missing', missing)

# 例句：《한국어기초사전》的韩语例句（tools/kozh/ko_ex.tsv）+ 本站中文翻译（ex_zh_*.tsv）→ lang/ko-ex-<等级>.json：{词: [[韩语, 中文]]}
ko_ex = dict(l.split('\t', 1) for l in (D / 'ko_ex.tsv').read_text(encoding='utf-8').splitlines() if l)
ex_zh = {}
for f in sorted(D.glob('ex_zh_*.tsv')):
    for line in f.read_text(encoding='utf-8').splitlines():
        k, v = line.split('\t', 1)
        ex_zh[k] = v
ex = {k: {} for k in NAMES}
for line in (D / 'ko_graded.tsv').read_text(encoding='utf-8').splitlines():
    key, word, _, _, _, _, lv, _ = line.split('\t')
    if key in ko_ex and key in ex_zh and word not in ex[lv]:
        ex[lv][word] = [[ko_ex[key], ex_zh[key]]]
for k, d in ex.items():
    (ROOT / 'lang' / f'ko-ex-{k}.json').write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('examples', {k: len(d) for k, d in ex.items()})
