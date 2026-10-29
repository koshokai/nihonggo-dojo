"""动词、形容词变形练习的词表：vocab.js 里的动词和い形容词 → lang/ja-conj.json
用 fugashi + unidic-lite 判断活用类型：五段（g）、一段（i）、サ变（s）、カ变（k）、い形容词（a）。
变形本身在网页里算（conj.js）。用法：python3 tools/build_conj.py
"""
import json
import re
from pathlib import Path

import fugashi

ROOT = Path(__file__).resolve().parent.parent
tagger = fugashi.Tagger()


def kind(w, r):
    if w.endswith('する') or r.endswith('する'):
        return 's' if r.endswith('する') else None
    toks = list(tagger(w))
    if len(toks) != 1:
        return None
    f = toks[0].feature
    if f.pos1 == '動詞':
        if f.cType.startswith('五段'):
            return 'g'
        if '一段' in f.cType:
            return 'i'
        if f.cType == 'カ行変格':
            return 'k'
        if f.cType == 'サ行変格':
            return 's'
    if f.pos1 == '形容詞' and r.endswith('い'):
        return 'a'
    return None


def main():
    src = (ROOT / 'vocab.js').read_text(encoding='utf-8')
    vocab = json.loads(src[src.index('{'):src.rindex(';')])
    out, seen = {}, set()
    for L, rows in vocab.items():
        for w, r, zh, *_ in rows:
            if (w, r) in seen or re.search(r'[～〜(（・]', w + r) or ' ' in r:
                continue
            k = kind(w, r)
            if k == 's' and not w.endswith('する'):
                w += 'する'   # 词表里的「運動 / うんどうする」写成「運動する」
            if not k or not r or (k == 'g' and r[-1] not in 'うくぐすつぬぶむる') or (k == 'i' and r[-1] != 'る') \
                    or (k == 'a' and r[-1] != 'い') or (k != 'k' and w[-1] != r[-1]):
                continue   # 送假名和读音对不上的（下さい 之类）不出题
            seen.add((w, r))
            out.setdefault(L, []).append([w, r, k, zh])
    (ROOT / 'lang' / 'ja-conj.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print({L: len(v) for L, v in out.items()})


if __name__ == '__main__':
    main()
