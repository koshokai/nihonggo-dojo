"""TOPIK / 四六级模拟题：tools/lexam/*.json → lang/exam-*.json（网页按需加载）。格式见 tools/lexam/SPEC.md。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for f in sorted((ROOT / 'tools' / 'lexam').glob('*.json')):
    d = json.loads(f.read_text(encoding='utf-8'))
    (ROOT / 'lang' / f'exam-{f.stem}.json').write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f.stem, len(d))
