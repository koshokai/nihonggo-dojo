"""给日语句子标注假名（furigana）：返回「{漢字|かんじ}」形式的标记，网页渲染成 <ruby>。

    pip install fugashi unidic-lite
    python3 tools/furigana.py examples     # 给 examples.js 每条例句加第 4 项：假名位置「起点.长度读音,…」

只给含汉字的词标注；送假名（高い → {高|たか}い）和词中的假名（取り扱い → {取|と}り{扱|あつか}い）会拆开对齐。
"""
import json
import pathlib
import re
import sys

import fugashi

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from build_examples import OVERRIDE   # 常见的读法修正（明日 → あした 等）

KANJI = re.compile(r'[㐀-鿿々〆ヶ]')
tagger = fugashi.Tagger()


def hira(s):
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)


def align(surf, read):
    """把一个词的写法和读音对齐成 [(写法, 读音或空)]"""
    if not KANJI.search(surf):
        return [(surf, '')]
    # 按「汉字串 / 假名串」切开写法，假名部分原样匹配读音
    parts = re.findall(r'[㐀-鿿々〆ヶ]+|[^㐀-鿿々〆ヶ]+', surf)
    pat = ''.join('(.+?)' if KANJI.match(p) else '(' + re.escape(hira(p)) + ')' for p in parts)
    m = re.fullmatch(pat, read)
    if not m:
        return [(surf, read)]
    return [(p, g if KANJI.match(p) else '') for p, g in zip(parts, m.groups())]


# 形态分析会拆开、读错的几个词：整体替换成固定标注
PHRASE = {
    '一石二鳥': '{一石二鳥|いっせきにちょう}', '富士山': '{富士山|ふじさん}', '誕生日': '{誕生日|たんじょうび}',
    '日本人': '{日本人|にほんじん}', '中国人': '{中国人|ちゅうごくじん}', '外国人': '{外国人|がいこくじん}', '韓国人': '{韓国人|かんこくじん}',
    '九時': '{九時|くじ}', '九月': '{九月|くがつ}', '年の割': '{年|とし}の{割|わり}', '日本': '{日本|にほん}',
    'お母さん': 'お{母|かあ}さん', 'お父さん': 'お{父|とう}さん', 'お兄さん': 'お{兄|にい}さん', 'お姉さん': 'お{姉|ねえ}さん',
}
PHRASE_RE = re.compile('|'.join(sorted(map(re.escape, PHRASE), key=len, reverse=True)))


def ruby(sentence):
    # 先把固定词组切出来，其余部分再做形态分析
    out, last = [], 0
    for m in PHRASE_RE.finditer(sentence):
        out.append(_ruby(sentence[last:m.start()]))
        out.append(PHRASE[m.group()])
        last = m.end()
    out.append(_ruby(sentence[last:]))
    # 曜日：「日」读「び」
    return re.sub(r'(曜\|[^}]*\})\{日\|ひ\}', r'\1{日|び}', ''.join(out))


def _ruby(sentence):
    out = []
    if not sentence:
        return ''
    for w in tagger(sentence):
        surf = w.surface
        kana = getattr(w.feature, 'kana', None) or ''
        read = OVERRIDE.get(surf) or hira(kana)
        if not read or not KANJI.search(surf):
            out.append(surf)
            continue
        out.append(''.join(f'{{{p}|{r}}}' if r else p for p, r in align(surf, read)))
    return ''.join(out)


def compact(markup):
    """{漢字|かんじ} 标记 → 「起点.长度读音」用逗号连起来（不重复存句子，文件小一半）：「景気の悪化」→「0.2けいき,3.2あっか」"""
    out, pos = [], 0
    for m in re.finditer(r'\{([^|}]*)\|([^}]*)\}|([^{]+)', markup):
        if m.group(3):
            pos += len(m.group(3))
        else:
            out.append(f'{pos}.{len(m.group(1))}{m.group(2)}')
            pos += len(m.group(1))
    return ','.join(out)


def furi(sentence):
    """build_examples.py / build_grammar.py 用：句子 → 紧凑的假名位置（没有汉字时返回空字符串）"""
    return compact(ruby(sentence)) if KANJI.search(sentence) else ''


def js_obj(path, name):
    s = path.read_text(encoding='utf-8')
    i = s.index(f'const {name} = ') + len(f'const {name} = ')
    head, body = s[:i], s[i:].rstrip().rstrip(';')
    return head, json.loads(body)


def examples():
    p = ROOT / 'examples.js'
    head, data = js_obj(p, 'EXAMPLES')
    n = 0
    for w, rows in data.items():
        for r in rows:
            r[3:] = [compact(ruby(r[0]))] if KANJI.search(r[0]) else []
            n += len(r) > 3
    p.write_text(head + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print('examples with furigana:', n)


if __name__ == '__main__':
    {'examples': examples}[sys.argv[1]]()
