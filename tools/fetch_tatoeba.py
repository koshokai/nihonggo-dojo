"""英语例句：Tatoeba（https://tatoeba.org ，例句文本 CC BY 2.0 FR，可商用，需注明来源）里的英中对照句，
给英语分级词库和入门单词每个词配最多 2 个简短例句。中文统一转成简体（OpenCC）。

在 GitHub Actions 里运行（.github/workflows/examples.yml）：python3 tools/fetch_tatoeba.py
输出 lang/en-ex-<级别>.json（basic 为入门单词）：{单词: [[英文, 中文, Tatoeba 句子编号], …]}
"""
import bz2
import csv
import json
import re
import sys
import tarfile
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP = Path('/tmp/tatoeba')
BASE = 'https://downloads.tatoeba.org/exports/'
csv.field_size_limit(10 ** 8)


def download(name, url):
    TMP.mkdir(exist_ok=True)
    p = TMP / name
    if not p.exists():
        print('download', url, flush=True)
        urllib.request.urlretrieve(url, p)
    return p


def sentences(lang):
    p = download(f'{lang}.tsv.bz2', f'{BASE}per_language/{lang}/{lang}_sentences.tsv.bz2')
    out = {}
    with bz2.open(p, 'rt', encoding='utf-8') as f:
        for line in f:
            sid, _, text = line.rstrip('\n').split('\t', 2)
            out[int(sid)] = text
    return out


def main():
    from opencc import OpenCC
    t2s = OpenCC('t2s')
    eng, cmn = sentences('eng'), sentences('cmn')
    print('eng', len(eng), 'cmn', len(cmn), flush=True)
    pairs = defaultdict(list)
    with tarfile.open(download('links.tar.bz2', BASE + 'links.tar.bz2')) as tf:
        f = tf.extractfile([m for m in tf.getmembers() if m.name.endswith('.csv')][0])
        for line in f:
            a, b = line.decode().split()
            a, b = int(a), int(b)
            if a in eng and b in cmn:
                pairs[a].append(b)
    print('pairs', len(pairs), flush=True)
    # 只要短句（便于记忆），按单词建索引
    index = defaultdict(list)
    for sid in pairs:
        s = eng[sid]
        if len(s) > 90 or len(s.split()) > 14:
            continue
        for tok in set(re.findall(r"[a-z]+(?:'[a-z]+)?", s.lower())):
            index[tok].append(sid)

    def forms(w):
        w = w.lower()
        fs = {w, w + 's', w + 'es', w + 'ed', w + 'd', w + 'ing', w + "'s"}
        if w.endswith('e'):
            fs |= {w[:-1] + 'ing'}
        if w.endswith('y'):
            fs |= {w[:-1] + 'ies', w[:-1] + 'ied'}
        return fs

    def examples(w):
        if ' ' in w.strip():
            ids = [sid for sid in index.get(w.split()[0].lower(), []) if w.lower() in eng[sid].lower()]
        else:
            ids = sorted({sid for f in forms(w) for sid in index.get(f, [])})
        # 4–12 个词的句子最适合当例句；太短的（「Hello!」「The farm!」）放到最后
        ids.sort(key=lambda i: (not 4 <= len(eng[i].split()) <= 12, len(eng[i]), i))
        out, seen = [], set()
        for sid in ids:
            zh = t2s.convert(cmn[pairs[sid][0]])
            if eng[sid] in seen:
                continue
            seen.add(eng[sid])
            out.append([eng[sid], zh, sid])
            if len(out) == 2:
                break
        return out

    levels = [('basic', [w[0] for w in json.loads((ROOT / 'tools' / 'lang' / 'en.json').read_text(encoding='utf-8'))['words']])]
    for k, _, _ in json.loads((ROOT / 'lang' / 'en-levels.json').read_text(encoding='utf-8')):
        levels.append((k, [r[0] for r in json.loads((ROOT / 'lang' / f'en-{k}.json').read_text(encoding='utf-8'))]))
    for k, ws in levels:
        ex = {w: e for w in ws if (e := examples(w))}
        (ROOT / 'lang' / f'en-ex-{k}.json').write_text(json.dumps(ex, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        print(k, f'{len(ex)}/{len(ws)} words with examples', flush=True)


if __name__ == '__main__':
    main()
