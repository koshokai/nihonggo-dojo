"""给日语句子标注假名（furigana）：返回「{漢字|かんじ}」形式的标记，网页渲染成 <ruby>。

    pip install fugashi unidic-lite
    由 build_examples.py、build_grammar.py、build_reading.py、build_anime.py 调用（例句第 4 项：假名位置「起点.长度读音,…」）

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
    '三日月': '{三日月|みかづき}', '洗濯物': '{洗濯物|せんたくもの}', '昨夜': '{昨夜|ゆうべ}', '白髪': '{白髪|しらが}',
    '摩って': '{摩|さす}って', '摩った': '{摩|さす}った',
    '包丁の柄': '{包丁|ほうちょう}の{柄|え}', '傘の柄': '{傘|かさ}の{柄|え}', '異を唱': '{異|い}を{唱|とな}', '五分五分': '{五分五分|ごぶごぶ}',
    '一つ': '{一|ひと}つ', '二つ': '{二|ふた}つ', '三つ': '{三|みっ}つ', '四つ': '{四|よっ}つ', '五つ': '{五|いつ}つ',
    '六つ': '{六|むっ}つ', '七つ': '{七|なな}つ', '八つ': '{八|やっ}つ', '九つ': '{九|ここの}つ',
    '九時': '{九時|くじ}', '七日': '{七日|なのか}', '七時': '{七時|しちじ}', '七月': '{七月|しちがつ}', '九月': '{九月|くがつ}', '年の割': '{年|とし}の{割|わり}',
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
    out = ''.join(out).replace('{日本|にっぽん}', '{日本|にほん}')
    return re.sub(r'(曜\|[^}]*\})\{日\|ひ\}', r'\1{日|び}', out)


def _ruby(sentence):
    out = []
    if not sentence:
        return ''
    for w in tagger(sentence):
        out.append(w.white_space)   # 形态分析会吃掉词前的空格，原样放回，位置才对得上
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


def furi(sentence, kana=None):
    """句子 → 紧凑的假名位置（没有汉字时返回空字符串）。
    给了人工写的读音 kana 时以它为准：形态分析的读法和它不一致，就按它重新对齐（汉字串对读音，假名原样对上）。"""
    if not KANJI.search(sentence):
        return ''
    m = ruby(sentence)
    if kana:
        norm = lambda s: re.sub(r'[\s。、，！？!?「」『』…・ー〜～]', '', hira(s))
        plain = re.sub(r'\{([^|}]*)\|([^}]*)\}', r'\2', m)
        if norm(plain) != norm(kana):
            fixed = realign(sentence, norm(kana))
            if fixed:
                m = fixed
    return compact(m)


def realign(sentence, kana):
    """按人工读音给句子标注：汉字串 → (.+?)，其余字符（去掉标点后）原样匹配"""
    parts = re.findall(r'[\u3400-\u9fff々〆ヶ]+|[^\u3400-\u9fff々〆ヶ]+', sentence)
    pat, keep = '', []
    for p in parts:
        if KANJI.match(p):
            pat += '(.+?)'
            keep.append(True)
        else:
            pat += '(' + re.escape(re.sub(r'[\s。、，！？!?「」『』…・ー〜～]', '', hira(p))) + ')'
            keep.append(False)
    m = re.fullmatch(pat, kana)
    if not m:
        return None
    return ''.join(f'{{{p}|{g}}}' if k else p for p, g, k in zip(parts, m.groups(), keep))


VOICED = str.maketrans('がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ', 'かきくけこさしすせそたちつてとはひふへほはひふへほ')
# 句子里按上下文读别的音才是对的（三つ→みっつ、来ました→き、六畳→じょう…），不按单词卡改
CARD_KEEP = {'三', '来る', '位', '畳', '乳', '毎月', '毎年', '摩する'}


def kanji_readings(k):
    """KANJI_DATA 里这个汉字的音读、训读（平假名）：({音读}, {训读})"""
    global _KREAD
    if _KREAD is None:
        src = (ROOT / 'kanji.js').read_text(encoding='utf-8')
        data = json.loads(src[src.index('{'):src.rindex(';')])
        _KREAD = {}
        for rows in data.values():
            for row in rows:
                on = {hira(x) for x in row[1].split('・') if x}
                kun = {re.sub(r'[\-]', '', x.split('.')[0]) for x in row[2].split('・') if x}
                _KREAD[row[0]] = (on, kun)
    return _KREAD.get(k)


_KREAD = None


def card_fix(word, reading, jp, kana, f):
    """单词例句里，这个单词本身的读音以单词卡为准：形态分析读错了（塵→ごみ、米→べい）就改成卡片上的读音，
    朗读用的 kana 里对应的读音也一起改。返回 (kana, f, 是否改动)。"""
    if word in CARD_KEEP or '～' in reading or '〜' in reading or not KANJI.search(word):
        return kana, f, False
    notes = [[int(m[1]), int(m[2]), m[3]] for m in (re.match(r'(\d+)\.(\d+)(.*)', x) for x in f.split(',') if x)]
    variants = []
    for r in reading.split('/'):
        r = r[:-2] if r.endswith('する') and not word.endswith('する') else r
        parts = align(word, r)
        if any(g for _, g in parts):
            variants.append(parts)
    if not variants:
        return kana, f, False
    parts = variants[0]
    # 在句子里找这个单词：从开头到第一个汉字串为止的写法（「お参り」→「お参」），后面的假名要和送假名对得上
    k = next(n for n, (p, g) in enumerate(parts) if g)
    anchor = ''.join(p for p, _ in parts[:k + 1])
    okuri = parts[k + 1][0] if k + 1 < len(parts) and not parts[k + 1][1] else ''
    verbish = len(okuri) == 1 and okuri in 'うくぐすつぬぶむる' or okuri == 'する'
    pos = -1
    for m in re.finditer(re.escape(anchor), jp):
        after = jp[m.end():]
        if not okuri or verbish or after.startswith(okuri if len(okuri) == 1 else okuri[:-1]):
            pos = m.start(); break
    if pos < 0:
        return kana, f, False
    changed = False
    i = pos
    for idx, (p, g) in enumerate(parts):
        if not g:
            i += len(p); continue
        n = next((n for n in notes if n[0] == i and n[1] == len(p)), None)
        i += len(p)
        if not n:
            continue
        ok = {v[idx][1] for v in variants if len(v) > idx and v[idx][0] == p}
        if n[2] in ok:
            continue
        # 卡片读音的末尾假名其实写在句子里（支払→しはらい，句子是「支払い」）：去掉再比
        if idx == len(parts) - 1:
            for cut in range(len(g) - 1, 0, -1):
                if jp[i:i + cut] == g[-cut:]:
                    g = g[:-cut]; break
            else:
                if i < len(jp) and 'ぁ' <= jp[i] <= 'ん' and jp[i] not in 'をがはにのでとへもや' and not okuri and g[-1:] in 'いうくすつぬむるた':
                    continue   # 形容词、动词变了形（堅い→堅く），对不齐就不改
        if n[2] == g:
            continue
        attached = n[0] > 0 and (KANJI.match(jp[n[0] - 1]) or ('ぁ' <= jp[n[0] - 1] <= 'ん' and jp[n[0] - 1] not in 'をがはにのでとへもや'))
        if attached and n[2].translate(VOICED) == g.translate(VOICED):
            continue   # 连浊（座り心地→ごこち）
        if len(word) == 1:
            kr = kanji_readings(word)
            if kr and (g in kr[0] or (n[2] in kr[1] and g in kr[1])):
                continue   # 单个汉字的词读音看上下文（柄 がら/え、他 ほか/た），不硬改
        old = n[2]
        n[2] = g
        if kana.count(old) == 1:
            kana = kana.replace(old, g)
        changed = True
    return kana, ','.join(f'{a}.{b}{c}' for a, b, c in notes), changed


PARTICLE = {'は': 'わ', 'へ': 'え', 'を': 'お'}


def tts(jp, f):
    """按最终的假名标注生成朗读用的读音：汉字换成标注的假名，助词は/へ/を读成わ/え/お，按词之间加空格"""
    notes = [(int(m[1]), int(m[2]), m[3]) for m in (re.match(r'(\d+)\.(\d+)(.*)', x) for x in f.split(',') if x)]
    done = 0   # 一个标注可能跨过好几个词（七時 → しちじ），已经读过的字不再重复
    def span(a, b):
        nonlocal done
        out, i = '', max(a, done)
        while i < b:
            n = next((n for n in notes if n[0] == i), None)
            if n:
                out += n[2]; i += n[1]
            else:
                out += jp[i]; i += 1
        done = max(done, i)
        return out
    words, pos = [], 0
    for w in tagger(jp):
        pos += len(w.white_space)
        a, b = pos, pos + len(w.surface)
        pos = b
        t = span(a, b)
        if w.feature.pos1 == '助詞' and w.surface in PARTICLE:
            t = PARTICLE[w.surface]
        if words and w.feature.pos1 in ('助詞', '助動詞', '接尾辞') or (words and w.feature.pos2 == '非自立可能' and w.feature.pos1 == '動詞'):
            words[-1] += t
        else:
            words.append(t)
    return ' '.join(words).replace(' 。', '。').replace(' 、', '、')   # 外来语保留片假名，朗读更自然


def plain_reading(jp, f):
    return hira(re.sub(r'[\s。、，！？!?「」『』…・〜～]', '', tts(jp, f))).translate(str.maketrans('わおえ', 'はをへ'))


def js_obj(path, name):
    s = path.read_text(encoding='utf-8')
    i = s.index(f'const {name} = ') + len(f'const {name} = ')
    head, body = s[:i], s[i:].rstrip().rstrip(';')
    return head, json.loads(body)


if __name__ == '__main__':
    for line in sys.argv[1:]:
        print(ruby(line))
