"""JLPT 题型题库：tools/jlpt/N*.txt → jlpt.js

每行：题型 | 题干 | 正确答案 | 干扰1 | 干扰2 | 干扰3 | 解说
题型：読み 表記 語形成 文脈 言換 用法 文法 組立 読解（写法见 tools/jlpt/N5.txt）。题目都是本站原创，按 JLPT 题型编写，不是真题。
用法：python3 tools/build_jlpt.py
"""
import json
import re
import sys

from build_examples import ROOT

LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
TYPES = ['読み', '表記', '語形成', '文脈', '言換', '用法', '文法', '組立', '読解']


def main():
    out, stats = {}, {}
    for L in LEVELS:
        f = ROOT / f'tools/jlpt/{L}.txt'
        out[L] = []
        if not f.exists():
            continue
        seen = set()
        for n, line in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
            if not line.strip():
                continue
            c = [x.strip() for x in line.split('|')]
            err = None
            if len(c) != 7:
                err = '字段数不是 7'
            else:
                t, q, *opts, note = c
                if t not in TYPES:
                    err = '题型不对 ' + t
                elif len(set(opts)) != 4 or not all(opts):
                    err = '选项重复或为空'
                elif t == '組立' and (q.count('★') != 1 or len(re.findall(r'＿＿|★', q)) != 4):
                    err = '組立 要有 3 个 ＿＿ 和 1 个 ★'
                elif t == '読解' and '◆' not in q:
                    err = '読解 缺少 ◆'
                elif t in ('読み', '表記', '言換') and '【' not in q:
                    err = '缺少【】'
                elif t in ('文脈', '文法', '語形成') and '（' not in q:
                    err = '缺少（　）'
                elif q in seen:
                    err = '重复'
            if err:
                print(f'跳过 {L}:{n} {err}：{line[:60]}', file=sys.stderr)
                continue
            seen.add(q)
            out[L].append([t, q, opts, note])
            stats.setdefault(L, {}).setdefault(t, 0)
            stats[L][t] += 1
    js = ('// 自动生成：python3 tools/build_jlpt.py（请编辑 tools/jlpt/N*.txt）\n'
          '// 原创题目，按 JLPT 题型编写。每题：[题型, 题干, [正确, 干扰1, 干扰2, 干扰3], 解说]\n'
          'const JLPT = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')).replace('],[', '],\n[') + ';\n')
    (ROOT / 'jlpt.js').write_text(js, encoding='utf-8')
    for L in LEVELS:
        print(L, sum(stats.get(L, {}).values()), stats.get(L, {}))


if __name__ == '__main__':
    main()
