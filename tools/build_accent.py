"""日语单词的音调（アクセント）：从 Kanjium（CC BY-SA 4.0，https://github.com/mifunetoshiro/kanjium）的 accents.txt
取出本站词表里的单词 → lang/ja-accent.json：{"单词|读音": 音调核位置}（0 = 平板，1 = 头高，n = 第 n 拍后下降）。
署名要求：内容来源页写明 "The pitch accent notation … were provided by Uros O. through his free database."
用法：git clone --depth 1 https://github.com/mifunetoshiro/kanjium /tmp/kanjium && python3 tools/build_accent.py /tmp/kanjium
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main(src):
    acc = {}
    for line in (Path(src) / 'data' / 'source_files' / 'raw' / 'accents.txt').read_text(encoding='utf-8').splitlines():
        parts = line.split('\t')
        if len(parts) == 3:
            w, r, a = parts
            acc.setdefault((w, r or w), a.split(',')[0])
    s = (ROOT / 'vocab.js').read_text(encoding='utf-8')
    vocab = json.loads(s[s.index('{'):s.rindex(';')])
    out = {}
    for rows in vocab.values():
        for w, r, *_ in rows:
            a = acc.get((w, r)) or acc.get((r, r))
            if a is not None and a.isdigit():
                out[f'{w}|{r}'] = int(a)
    (ROOT / 'lang' / 'ja-accent.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(len(out), 'of', sum(len(v) for v in vocab.values()), 'words')


if __name__ == '__main__':
    main(sys.argv[1])
