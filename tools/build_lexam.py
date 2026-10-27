"""TOPIK / 四六级模拟题：tools/lexam/*.json → lang/exam-*.json（网页按需加载）。格式见 tools/lexam/SPEC.md。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# topik1.json + topik1_2.json、topik1_3.json…… 合并成一个题库
banks = {}
for f in sorted((ROOT / 'tools' / 'lexam').glob('*.json')):
    banks.setdefault(f.stem.split('_')[0], []).extend(json.loads(f.read_text(encoding='utf-8')))
for name, d in banks.items():
    (ROOT / 'lang' / f'exam-{name}.json').write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(name, len(d))
