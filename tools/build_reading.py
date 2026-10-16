"""阅读文章：tools/reading/N*.txt → reading.js

每篇文章的格式见 tools/reading/N5.txt。朗读用的假名由 build_examples.reading() 生成。
用法：python3 tools/build_reading.py
"""
import json
import re
import sys

from build_examples import ROOT, reading

SRC = ROOT / 'tools/reading'
LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
CATS = ['常识', '运动', '笑话', '传统文化', '人文情感', '感人故事', '美食', '旅行']
IMGS = set(re.findall(r'^  (\w+): u =>', (ROOT / 'scenes.js').read_text(encoding='utf-8'), re.M))


def parse(path):
    out = []
    for block in re.split(r'\n(?=# id:)', path.read_text(encoding='utf-8').strip()):
        head, rest = block.split('\n---\n', 1)
        meta = dict(l.split(':', 1) for l in head.splitlines())
        meta = {k.strip('# ').strip(): v.strip() for k, v in meta.items()}
        body, rest = rest.split('\n---words\n', 1)
        words, quiz = rest.split('\n---quiz\n', 1)
        paras = []
        for para in re.split(r'\n\s*\n', body.strip()):
            sents = []
            for line in para.splitlines():
                jp, zh = [x.strip() for x in line.split(' | ')]
                sents.append([jp, reading(jp), zh])
            paras.append(sents)
        a = {
            'id': meta['id'], 'L': meta['level'], 'cat': meta['cat'], 'img': meta['img'],
            'title': meta['title'], 'zh': meta['zh'], 'p': paras,
            'w': [[x.strip() for x in l.split('|')] for l in words.strip().splitlines() if l.strip()],
            'q': [[x.strip() for x in l.split('|')] for l in quiz.strip().splitlines() if l.strip()],
        }
        errs = []
        if a['cat'] not in CATS: errs.append('cat ' + a['cat'])
        if a['img'] not in IMGS: errs.append('img ' + a['img'])
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
    js = ('// 自动生成：python3 tools/build_reading.py（请编辑 tools/reading/N*.txt）\n'
          '// 每篇：{id, L, cat, img, title, zh, p:[[ [日语, 朗读假名, 中文], … ] 段落…], w:[[词, 读音, 中文]], q:[[问题, 正确, 错1, 错2, 错3]]}\n'
          'const READING = ' + json.dumps(arts, ensure_ascii=False, separators=(',', ':')).replace('},{', '},\n{') + ';\n')
    (ROOT / 'reading.js').write_text(js, encoding='utf-8')
    print(len(arts), '篇', sum(len(s) for a in arts for s in a['p']), '段')


if __name__ == '__main__':
    main()
