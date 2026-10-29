"""汉字笔顺：从 KanjiVG（CC BY-SA 3.0，https://github.com/KanjiVG/kanjivg）取出本站 2211 个汉字的笔画路径
→ lang/kv/<十六进制码点>.json：{"s": ["M…", …]}（按笔顺排列，坐标系 109×109）。网页点「笔顺」时才加载。
用法：git clone --depth 1 https://github.com/KanjiVG/kanjivg /tmp/kanjivg && python3 tools/build_strokes.py /tmp/kanjivg
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main(src):
    s = (ROOT / 'kanji.js').read_text(encoding='utf-8')
    data = json.loads(s[s.index('{'):s.rindex(';')])
    out = ROOT / 'lang' / 'kv'
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    for rows in data.values():
        for row in rows:
            k = row[0]
            f = Path(src) / 'kanji' / f'{ord(k):05x}.svg'
            if not f.exists():
                continue
            paths = re.findall(r'<path[^>]*\sd="([^"]+)"', f.read_text(encoding='utf-8'))
            (out / f'{ord(k):05x}.json').write_text(json.dumps({'s': paths}, separators=(',', ':')), encoding='utf-8')
            n += 1
    print(n, 'kanji')


if __name__ == '__main__':
    main(sys.argv[1])
