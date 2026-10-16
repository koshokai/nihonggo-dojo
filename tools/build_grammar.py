"""把 tools/grammar/N*.txt 编译成 grammar.js（句型、说明、3–5 句例句、朗读用假名）。

    python3 tools/build_grammar.py
"""
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_examples import reading  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']


def main():
    out = {}
    for L in LEVELS:
        src = ROOT / 'tools' / 'grammar' / f'{L}.txt'
        if not src.exists():
            continue
        items, cur = [], None
        for n, line in enumerate(src.read_text(encoding='utf-8').splitlines(), 1):
            line = line.strip()
            if not line or (line.startswith('#') and not line.startswith('## ')):
                continue
            if line.startswith('## '):
                parts = [p.strip() for p in line[3:].split('|')]
                parts += [''] * (4 - len(parts))
                p, m, how, ex = parts[:4]
                cur = {'p': p, 'm': m, 'how': how, 'ex': [x.strip() for x in ex.split(',') if x.strip()], 'eg': []}
                items.append(cur)
                continue
            if cur is None or '|' not in line:
                sys.exit(f'{src.name}:{n} 格式不对：{line}')
            jp, zh = [x.strip() for x in line.split('|', 1)]
            if not re.search(r'\[.+?\]', jp):
                sys.exit(f'{src.name}:{n} 例句缺少 [填空]：{jp}')
            cur['eg'].append([jp, reading(jp.replace('[', '').replace(']', '')), zh])
        for it in items:
            if len(it['eg']) < 3:
                sys.exit(f'{L} {it["p"]}：例句少于 3 句')
        out[L] = items
        print(L, len(items), '个句型', sum(len(i['eg']) for i in items), '句')
    js = '// 自动生成：python3 tools/build_grammar.py（请编辑 tools/grammar/N*.txt）\nconst GRAMMAR_DATA = ' + json.dumps(out, ensure_ascii=False, indent=0) + ';\n'
    (ROOT / 'grammar.js').write_text(js, encoding='utf-8')


if __name__ == '__main__':
    main()
