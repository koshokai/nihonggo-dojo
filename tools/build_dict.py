"""生成 dict.json：JMdict 常用词（约两万条，英文释义），给「词典」页按需加载。

数据：JMdict（EDRDG，CC BY-SA 4.0，https://www.edrdg.org/jmdict/j_jmdict.html），
通过 PyPI 包 jamdict-data 1.5 获取（SQLite）。dict.json 按 CC BY-SA 4.0 发布。

    pip download jamdict-data==1.5 --no-deps
    tar -xzf jamdict_data-1.5.tar.gz && xz -d jamdict_data-1.5/jamdict_data/jamdict.db.xz
    python3 tools/build_dict.py path/to/jamdict.db
"""
import json
import pathlib
import sqlite3
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
COMMON = {'news1', 'ichi1', 'spec1', 'spec2', 'gai1'}


def main(db):
    c = sqlite3.connect(db)
    kpri, rpri = defaultdict(set), defaultdict(set)
    for kid, t in c.execute('select kid, text from KJP'):
        kpri[kid].add(t)
    for kid, t in c.execute('select kid, text from KNP'):
        rpri[kid].add(t)
    kanji, kana = defaultdict(list), defaultdict(list)
    common = set()
    for kid, idseq, t in c.execute('select ID, idseq, text from Kanji order by ID'):
        com = bool(kpri[kid] & COMMON)
        kanji[idseq].append((not com, t))
        if com:
            common.add(idseq)
    for kid, idseq, t in c.execute('select ID, idseq, text from Kana order by ID'):
        com = bool(rpri[kid] & COMMON)
        kana[idseq].append((not com, t))
        if com:
            common.add(idseq)
    senses = defaultdict(list)
    sid2seq = {}
    for sid, idseq in c.execute('select ID, idseq from Sense order by ID'):
        if idseq in common:
            sid2seq[sid] = idseq
            senses[idseq].append(sid)
    gloss = defaultdict(list)
    for sid, lang, t in c.execute('select sid, lang, text from SenseGloss'):
        if sid in sid2seq and (lang in (None, '', 'eng')):
            gloss[sid].append(t)
    pos = {}
    for sid, t in c.execute('select sid, text from pos'):
        if sid in sid2seq and sid not in pos:
            pos[sid] = t
    out = []
    for idseq in sorted(common):
        ks = [t for _, t in sorted(kanji[idseq], key=lambda x: x[0])][:3]
        rs = [t for _, t in sorted(kana[idseq], key=lambda x: x[0])][:3]
        ss = [gloss[s][:4] for s in senses[idseq][:3] if gloss[s]]
        if not ss:
            continue
        p = pos.get(senses[idseq][0], '')
        out.append([ks, rs, ss, short_pos(p)])
    js = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    (ROOT / 'dict.json').write_text(js, encoding='utf-8')
    print(len(out), 'entries', len(js.encode()) // 1024, 'KB')


def short_pos(p):
    p = p or ''
    for key, zh in [('Godan verb', '五段动词'), ('Ichidan verb', '一段动词'), ('suru verb', 'サ变动词'), ('Kuru verb', 'カ变动词'),
                    ('adjective (keiyoushi)', 'い形容词'), ('adjectival nouns', 'な形容词'), ('adverb', '副词'),
                    ('noun', '名词'), ('pronoun', '代词'), ('conjunction', '接续词'), ('interjection', '感叹词'),
                    ('counter', '量词'), ('particle', '助词'), ('prefix', '前缀'), ('suffix', '后缀'), ('expressions', '惯用语')]:
        if key in p:
            return zh
    return ''


if __name__ == '__main__':
    main(sys.argv[1])
