"""韩语、英语入门数据：tools/lang/{ko,en}.json → lang-ko.js、lang-en.js。格式见 tools/lang/SPEC.md。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for code, var in [('ko', 'LANG_KO'), ('en', 'LANG_EN')]:
    src = ROOT / 'tools' / 'lang' / f'{code}.json'
    if not src.exists():
        print(code, 'missing'); continue
    d = json.loads(src.read_text(encoding='utf-8'))
    for k in ('words', 'phrases'):
        seen = set()
        for row in d[k]:
            assert len(row) == 4 and all(isinstance(x, str) for x in row), row
            assert row[0] not in seen, ('duplicate', row[0]); seen.add(row[0])
    (ROOT / f'lang-{code}.js').write_text(
        f'// 由 tools/build_lang.py 从 tools/lang/{code}.json 生成。每项：[原文, 发音提示, 中文, 分类]\n'
        f'const {var} = ' + json.dumps({'words': d['words'], 'phrases': d['phrases']}, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8')
    print(code, len(d['words']), len(d['phrases']))
