"""日语人工翻译例句：Tatoeba（https://tatoeba.org ，CC BY 2.0 FR，可商用，需注明来源）的日中对照句，
给 JLPT 词表每个词配 1 句短例句（按原形匹配，动词变了形也算），写成 tools/examples_tatoeba.txt（单词 | 日语 | 中文），
再由 build_examples.py 和其他例句一起加上读音、假名标注，网页上标注「Tatoeba」。
在 GitHub Actions 里运行（.github/workflows/examples.yml，lang=ja）。
"""
import json
import sys
import tarfile
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_tatoeba import BASE, ROOT, download, sentences   # noqa: E402


def main():
    import fugashi
    from opencc import OpenCC
    t2s, tagger = OpenCC('t2s'), fugashi.Tagger()
    jpn, cmn = sentences('jpn'), sentences('cmn')
    print('jpn', len(jpn), 'cmn', len(cmn), flush=True)
    pairs = defaultdict(list)
    with tarfile.open(download('links.tar.bz2', BASE + 'links.tar.bz2')) as tf:
        f = tf.extractfile([m for m in tf.getmembers() if m.name.endswith('.csv')][0])
        for line in f:
            a, b = (int(x) for x in line.decode().split())
            if a in jpn and b in cmn:
                pairs[a].append(b)
    print('pairs', len(pairs), flush=True)
    s = (ROOT / 'vocab.js').read_text(encoding='utf-8')
    vocab = json.loads(s[s.index('{'):s.rindex(';')])
    words = {w for rows in vocab.values() for w, *_ in rows}
    # 句子按词的原形（lemma 的写法）和表层形式建索引；只要 6–24 个字的短句
    index = defaultdict(list)
    for sid in pairs:
        t = jpn[sid]
        if not 6 <= len(t) <= 24:
            continue
        for tok in tagger(t):
            for k in {tok.surface, getattr(tok.feature, 'orthBase', None) or '', getattr(tok.feature, 'lemma', None) or ''}:
                if k in words:
                    index[k].append(sid)
    out = []
    for w in sorted(words):
        cands = sorted(set(index.get(w, [])), key=lambda i: (abs(len(jpn[i]) - 12), i))
        if cands:
            sid = cands[0]
            zh = t2s.convert(cmn[pairs[sid][0]]).replace('|', '｜')
            out.append(f'{w} | {jpn[sid].replace("|", "｜")} | {zh}')
    (ROOT / 'tools' / 'examples_tatoeba.txt').write_text('# Tatoeba（CC BY 2.0 FR）的人工翻译日中对照句，由 tools/fetch_tatoeba_ja.py 生成，不要手改\n' + '\n'.join(out) + '\n', encoding='utf-8')
    print(len(out), 'words with a Tatoeba sentence')


if __name__ == '__main__':
    main()
