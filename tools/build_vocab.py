"""生成 vocab.js：JLPT N5–N1 词表（中文释义 + 英文释义）。

来源：tools/vocab/src/n*.csv 来自 jamsinclair/open-anki-jlpt-decks（MIT，基于 Jonathan Waller 的 JLPT 词表）。
中文释义：tools/vocab/zh_n*.txt，每行「单词|中文」，与 csv 逐行对应。

    python3 tools/build_vocab.py
"""
import csv
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
# 来源数据里的个别错误：(写法, 读音) → 正确写法
FIX_WORD = {('副', 'とりわけ'): 'とりわけ', ('落る', 'おちる'): '落ちる', ('楽む', 'たのしむ'): '楽しむ', ('下る', 'さがる'): '下がる', ('清む', 'すむ'): '澄む', ('為る', 'する'): 'する', ('為る', 'なる'): 'なる', ('所為', 'せい'): 'せい', ('押える', 'おさえる'): '押さえる', ('下す', 'おろす'): '下ろす', ('可愛そう', 'かわいそう'): '可哀想', ('代る', 'かわる'): '代わる', ('当り', 'あたり'): '当たり', ('付合う', 'つきあう'): '付き合う', ('知合い', 'しりあい'): '知り合い', ('釣', 'つり'): '釣り', ('年寄', 'としより'): '年寄り', ('塵', 'ごみ'): 'ごみ', ('唯', 'たった'): 'たった'}


def first(s):
    return s.split(';')[0].strip()


def clean_reading(r):
    r = re.sub(r'\(.*?\)', '', r)          # けっこん (する) → けっこん
    return first(r).strip()


def main():
    out, seen = {}, set()
    total = 0
    for L in LEVELS:
        rows = list(csv.DictReader(open(ROOT / f'tools/vocab/src/{L.lower()}.csv', encoding='utf-8')))
        zh = [l.split('|', 1) for l in (ROOT / f'tools/vocab/zh_{L.lower()}.txt').read_text(encoding='utf-8').splitlines() if l.strip()]
        if len(rows) != len(zh):
            sys.exit(f'{L}: csv {len(rows)} 行，中文 {len(zh)} 行，数量不一致')
        items = []
        for r, (zw, zm) in zip(rows, zh):
            if r['expression'] != zw:
                sys.exit(f'{L}: 顺序不一致 {r["expression"]} / {zw}')
            expr = r['expression'].strip()
            w = re.sub(r'^\(.*?\)\s*', '', first(expr)).strip()
            rd = clean_reading(r['reading']) or w
            rd = re.sub(r'^〜|^～', '～', rd)
            w = FIX_WORD.get((w, rd), w)
            key = (w, rd)
            if key in seen:
                continue
            seen.add(key)
            alt = [a.strip() for a in expr.split(';')[1:] if a.strip()]
            en = r['meaning'].strip()
            items.append([w, rd, zm.strip(), en] + ([alt] if alt else []))
        for line in (ROOT / 'tools/vocab/extra.txt').read_text(encoding='utf-8').splitlines():
            if line.startswith('#') or not line.strip():
                continue
            el, w, rd, zm = line.split('|')
            if el == L and (w, rd) not in seen:
                seen.add((w, rd))
                items.append([w, rd, zm, ''])
        out[L] = items
        total += len(items)
        print(L, len(items))
    js = ('// 自动生成：python3 tools/build_vocab.py\n'
          '// 词表来源：open-anki-jlpt-decks（MIT），基于 Jonathan Waller 的 JLPT 词表（CC BY）；中文释义为本项目编写。\n'
          '// 每项：[单词, 读音, 中文, 英文, 其他写法?]\n'
          'const VOCAB_DATA = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')).replace('],[', '],\n[') + ';\n')
    (ROOT / 'vocab.js').write_text(js, encoding='utf-8')
    print('total', total, 'bytes', len(js.encode()))


if __name__ == '__main__':
    main()
