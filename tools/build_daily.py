"""今日一句：tools/daily/*.txt → daily.js（366 条，一天一句，全年不重样）

kisetsu.txt    季节和节日的说法，带日期 MM-DD，排在对应那一天
hagemashi.txt  鼓励、暖心的日常说法（日期写 --）
kotowaza.txt   谚语
yoji_kanyo.txt 四字熟语和惯用句
其余日子把几类轮流排开，相邻几天不会是同一类；顺序用固定种子打乱，每次生成结果一样。
用法：python3 tools/build_daily.py
"""
import json
import random
import re
import sys

from build_examples import ROOT, reading

SRC = ROOT / 'tools/daily'
MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]   # 按闰年排，2 月 29 日只在闰年出现
TOTAL = sum(MONTH_DAYS)


def slot(mmdd):
    m, d = map(int, mmdd.split('-'))
    return sum(MONTH_DAYS[:m - 1]) + d - 1


def hira(s):
    return re.sub(r'[ァ-ヶ]', lambda c: chr(ord(c.group()) - 0x60), s)


def tts(jp, yomi):
    """朗读用假名：分词结果和作者给的读音一致（只差助词は/を/へ的读法）就用分词结果，否则相信作者的读音。"""
    auto = reading(jp)
    norm = lambda s: re.sub(r'[\s、。！？「」]', '', hira(s))
    a, y = norm(auto), norm(yomi)
    if len(a) == len(y) and all(p == q or (p, q) in (('わ', 'は'), ('お', 'を'), ('え', 'へ')) for p, q in zip(a, y)):
        return auto
    return yomi


def load(name, dated, kind):
    f = SRC / name
    if not f.exists():
        return []
    out = []
    for n, line in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
        if not line.strip():
            continue
        c = [x.strip() for x in line.split('|')]
        if len(c) != (7 if dated else 6):
            sys.exit(f'{name}:{n} 字段数不对：{line}')
        date = c.pop(0) if dated else '--'
        jp, yomi, zh, note, ex, exzh = c
        k = kind(jp) if callable(kind) else kind
        out.append({'date': date, 'jp': jp, 'yomi': yomi, 'zh': zh, 'note': note, 'ex': ex, 'exzh': exzh, 'type': k})
    return out


def main():
    yoji = lambda jp: '四字熟语' if re.fullmatch(r'[一-鿿々]{4}', jp) else '惯用句'
    pool = (load('kisetsu.txt', True, '季节') + load('hagemashi.txt', True, '暖心话') +
            load('kotowaza.txt', False, '谚语') + load('yoji_kanyo.txt', False, yoji))
    seen, dup = {}, []
    for e in pool:
        if e['jp'] in seen:
            dup.append(e['jp'])
        seen.setdefault(e['jp'], e)
    if dup:
        print('重复（只保留第一条）：', '、'.join(dup))
    items = list(seen.values())
    days = [None] * TOTAL
    for e in items:
        if e['date'] != '--':
            i = slot(e['date'])
            while days[i] is not None:       # 同一天撞了就往后挪一天
                i = (i + 1) % TOTAL
            days[i] = e
    rest = [e for e in items if e['date'] == '--']
    rng = random.Random(20261017)
    groups = {}
    for e in rest:
        groups.setdefault(e['type'], []).append(e)
    for g in groups.values():
        rng.shuffle(g)
    # 几类轮流取，尽量不让同一类连着出现
    order = []
    while any(groups.values()):
        for k in sorted(groups, key=lambda k: -len(groups[k])):
            if groups[k]:
                order.append(groups[k].pop())
    free = [i for i, d in enumerate(days) if d is None]
    if len(order) < len(free):
        sys.exit(f'不够：还差 {len(free) - len(order)} 条')
    for i, e in zip(free, order):
        days[i] = e
    spare = len(order) - len(free)
    out = [[e['jp'], e['yomi'], e['zh'], e['note'], e['ex'], reading(e['ex']), e['exzh'], e['type'], tts(e['jp'], e['yomi'])] for e in days]
    js = ('// 自动生成：python3 tools/build_daily.py（请编辑 tools/daily/*.txt）\n'
          '// 366 天，下标 = 闰年里的第几天（0 = 1 月 1 日，59 = 2 月 29 日）\n'
          '// 每条：[日语, 读音, 中文, 解说, 例句, 例句假名, 例句中文, 类别, 朗读假名]\n'
          'const DAILY = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')).replace('],[', '],\n[') + ';\n')
    (ROOT / 'daily.js').write_text(js, encoding='utf-8')
    kinds = {}
    for e in days:
        kinds[e['type']] = kinds.get(e['type'], 0) + 1
    print(TOTAL, '天', kinds, f'（多出 {spare} 条没用上）', 'bytes', len(js.encode()))


if __name__ == '__main__':
    main()
