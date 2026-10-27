"""英语分级词库：ECDICT（https://github.com/skywind3000/ECDICT ，MIT 许可）→ lang/en-<级别>.json

ECDICT 每个词带考试标签（中考、高考、四级、六级、考研、雅思、托福、GRE）。每个词只放进它出现的最低一级，
同一级内按词频排序（常用的在前）。

    curl -L -o /tmp/ecdict.csv https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv
    python3 tools/build_en_levels.py /tmp/ecdict.csv
"""
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEVELS = [('zk', '中考'), ('gk', '高考'), ('cet4', '四级'), ('cet6', '六级'), ('ky', '考研'), ('ielts', '雅思'), ('toefl', '托福'), ('gre', 'GRE')]


def gloss(tr):
    lines = []
    for l in tr.replace('\\n', '\n').replace('\r', '').split('\n'):
        l = re.sub(r'\[[^\]]{1,4}\][^；;]*', '', l).strip(' ；;,，')   # 去掉 [计] [医] 这类专业义项
        if l and not l.startswith('[网络]'):
            lines.append(l)
    return '；'.join(lines[:2])[:60]


def main(path):
    csv.field_size_limit(10 ** 8)
    order = [k for k, _ in LEVELS]
    out = {k: [] for k in order}
    with open(path, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            tags = (r['tag'] or '').split()
            lv = next((t for t in order if t in tags), None)
            g = gloss(r['translation'] or '')
            if not lv or not g or not re.fullmatch(r"[A-Za-z][A-Za-z' -]*", r['word']):
                continue
            ipa = (r['phonetic'] or '').replace('ә', 'ə').replace(':', 'ː')
            frq = int(r['frq'] or 0) or 10 ** 6
            out[lv].append((frq, r['word'], ipa, g))
    meta = []
    for k, name in LEVELS:
        rows = [[w, ipa, g] for _, w, ipa, g in sorted(out[k])]
        (ROOT / 'lang' / f'en-{k}.json').write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        meta.append([k, name, len(rows)])
        print(k, name, len(rows))
    (ROOT / 'lang' / 'en-levels.json').write_text(json.dumps(meta, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    main(sys.argv[1])
