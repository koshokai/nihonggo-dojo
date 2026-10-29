"""阅读文章：tools/reading/N*.txt → reading.js

每篇文章的格式见 tools/reading/N5.txt。朗读用的假名由 build_examples.reading() 生成。
用法：python3 tools/build_reading.py
"""
import datetime
import json
from itertools import zip_longest
import re
import sys

from build_examples import ROOT, reading, tagger

CONTENT = {'名詞', '動詞', '形容詞', '形状詞', '副詞', '連体詞', '接続詞', '感動詞', '代名詞', '接頭辞'}


def headwords():
    vt = (ROOT / 'vocab.js').read_text(encoding='utf-8')
    vocab = json.loads(vt[vt.index('= {') + 2:vt.rindex('}') + 1])
    ws = set()
    for items in vocab.values():
        for it in items:
            ws.add(it[0])
            if len(it) > 4:
                ws.update(it[4])
    for e in json.loads((ROOT / 'dict.json').read_text(encoding='utf-8')):
        ws.update(e[0])
    return ws


WORDS = headwords()


def tokens(sentence, extra):
    """分词：[表层] 是助词等虚词；[表层, 原形, 另一种写法?] 是可以点开查的实词。相邻几块拼起来是词典里的词就合并。"""
    toks = [(w.surface, w.feature) for w in tagger(sentence)]
    out, i = [], 0
    while i < len(toks):
        for j in range(min(len(toks), i + 4), i + 1, -1):
            cat = ''.join(t[0] for t in toks[i:j])
            if (cat in WORDS or cat in extra) and not re.search(r'[、。「」！？]', cat):
                out.append([cat, cat])
                i = j
                break
        else:
            surf, f = toks[i]
            pos = getattr(f, 'pos1', '')
            if pos in CONTENT and not re.fullmatch(r'[\W\d０-９]+', surf):
                base = getattr(f, 'orthBase', None) or surf
                lemma = (getattr(f, 'lemma', None) or '').split('-')[0]
                t = [surf, base if base != '*' else surf]
                if lemma and lemma not in (t[1], '*'):
                    t.append(lemma)
                out.append(t)
            else:
                out.append([surf])
            i += 1
    # 连续的虚词合成一块，减小体积
    merged = []
    for t in out:
        if len(t) == 1 and merged and len(merged[-1]) == 1:
            merged[-1][0] += t[0]
        else:
            merged.append(t)
    return merged

SRC = ROOT / 'tools/reading'
LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
CATS = ['常识', '运动', '笑话', '传统文化', '人文情感', '感人故事', '美食', '旅行', '日本生活', '地方美食', '职业日常', '节日季节']
# 「日本生活」文章（tools/reading/life_*.txt）每天上新一篇：从 LIFE_START 起，按 a、b、c 三个文件轮流排日期。
# 网页只显示日期不晚于今天的文章。照片由 tools/fetch_photos.py（GitHub Actions）从 Wikimedia Commons 下载，见 photos/index.json。
LIFE_START = '2026-10-21'
PHOTOS = json.loads((ROOT / 'photos' / 'index.json').read_text(encoding='utf-8')) if (ROOT / 'photos' / 'index.json').exists() else {}
IMGS = set(re.findall(r'^  (\w+): u =>', (ROOT / 'scenes.js').read_text(encoding='utf-8'), re.M))


def parse(path):
    out = []
    for block in re.split(r'\n(?=# id:)', path.read_text(encoding='utf-8').strip()):
        head, rest = block.split('\n---\n', 1)
        meta = dict(l.split(':', 1) for l in head.splitlines())
        meta = {k.strip('# ').strip(): v.strip() for k, v in meta.items()}
        body, rest = rest.split('\n---words\n', 1)
        words, quiz = rest.split('\n---quiz\n', 1)
        keys = {l.split('|')[0].strip() for l in words.strip().splitlines() if l.strip()}
        paras = []
        for para in re.split(r'\n\s*\n', body.strip()):
            sents = []
            for line in para.splitlines():
                jp, zh = [x.strip() for x in line.split(' | ')]
                from furigana import furi, tts, plain_reading, hira as _h   # 汉字头上的假名（翻译练习、生词卡片里显示）
                kana, f = reading(jp), furi(jp)
                # 朗读读音和假名标注对不上时按标注重新生成，听到的和看到的一致
                if f and not re.search(r'[0-9０-９〇A-Za-zＡ-Ｚａ-ｚ]', jp) and plain_reading(jp, f) != _h(re.sub(r'[\s。、，！？!?「」『』…・〜～]', '', kana)).translate(str.maketrans('わおえ', 'はをへ')):
                    kana = tts(jp, f)
                sents.append([jp, kana, zh, tokens(jp, keys)] + ([f] if f else []))
            paras.append(sents)
        a = {
            'id': meta['id'], 'L': meta['level'], 'cat': meta['cat'], 'img': meta.get('img', ''),
            'title': meta['title'], 'zh': meta['zh'], 'p': paras,
            'w': [[x.strip() for x in l.split('|')] for l in words.strip().splitlines() if l.strip()],
            'q': [[x.strip() for x in l.split('|')] for l in quiz.strip().splitlines() if l.strip()],
        }
        errs = []
        if a['cat'] not in CATS: errs.append('cat ' + a['cat'])
        if 'photo' in meta:
            a['pq'] = [q.strip() for q in meta['photo'].split(' / ') if q.strip()]
            if a['id'] in PHOTOS:
                ph = PHOTOS[a['id']]
                a['ph'] = [ph['file'], ph['by'], ph['license'], ph['page']]
        elif a['img'] not in IMGS: errs.append('img ' + a['img'])
        elif a['id'] in PHOTOS:                       # 旧文章：有实拍照片就用照片（搜索词在 tools/photo_queries.json）
            ph = PHOTOS[a['id']]
            a['ph'] = [ph['file'], ph['by'], ph['license'], ph['page']]
        if any(len(w) != 3 for w in a['w']): errs.append('words')
        if any(len(q) != 5 for q in a['q']): errs.append('quiz')
        if errs:
            sys.exit(f'{path.name} {a["id"]}: ' + ', '.join(errs))
        out.append(a)
    return out


def main():
    arts = []
    for L in LEVELS:
        f = SRC / f'{L}.txt'
        if f.exists():
            arts += parse(f)
    life = [parse(f) for f in sorted(SRC.glob('life_*.txt'))]
    start = datetime.date.fromisoformat(LIFE_START)
    order = [a for group in zip_longest(*life) for a in group if a]
    for i, a in enumerate(order):
        a['date'] = (start + datetime.timedelta(days=i)).isoformat()
        a.pop('pq', None)
    arts += order
    js = ('// 自动生成：python3 tools/build_reading.py（请编辑 tools/reading/N*.txt）\n'
          '// 每篇：{id, L, cat, img, title, zh, p:[[ [日语, 朗读假名, 中文, 分词], … ] 段落…], w:[[词, 读音, 中文]], q:[[问题, 正确, 错1, 错2, 错3]]}\n'
          'const READING = ' + json.dumps(arts, ensure_ascii=False, separators=(',', ':')).replace('},{', '},\n{') + ';\n')
    (ROOT / 'reading.js').write_text(js, encoding='utf-8')
    print(len(arts), '篇', sum(len(s) for a in arts for s in a['p']), '段')


if __name__ == '__main__':
    main()
