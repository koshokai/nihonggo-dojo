"""把 tools/examples_*.txt 编译成 examples.js。

每行格式：单词 | 日语例句 | 中文翻译
朗读文本由形态分析（fugashi + unidic-lite）自动生成：全部转成平假名，
助词按实际读音写（は→わ、へ→え、を→お），按词组加空格，避免浏览器语音读错汉字。

    pip install fugashi unidic-lite
    python3 tools/build_examples.py
"""
import json
import re
import pathlib
import sys

import fugashi

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

# 形态分析常给出书面/少见读法的词，这里改成日常读法
OVERRIDE = {
    '私': 'わたし', '明日': 'あした', '今日': 'きょう', '昨日': 'きのう', '今朝': 'けさ',
    '一人': 'ひとり', '二人': 'ふたり', '一日': 'いちにち', '大人': 'おとな', '上手': 'じょうず',
    '下手': 'へた', '今年': 'ことし', '去年': 'きょねん', '何': None,
    '深い': 'ふかい', '箱': 'はこ', '一石二鳥': 'いっせきにちょう',
}
CONTENT = {'名詞', '代名詞', '動詞', '形容詞', '形状詞', '副詞', '連体詞', '接続詞', '感動詞', '接頭辞'}
tagger = fugashi.Tagger()


def hira(s):
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)


KATA = set(chr(c) for c in range(0x30A1, 0x30FB)) | {'ー'}
# 合并后再修正的少数读法
FIX = [('ようひ', 'ようび'), ('にっぽん', 'にほん'), ('にほんにん', 'にほんじん'), ('ちゅうごくにん', 'ちゅうごくじん'), ('がいこくにん', 'がいこくじん'), ('よんにん', 'よにん'), ('いちこくにちょう', 'いっせきにちょう'), ('ねんの わりに', 'としの わりに'), ('こんばんは ', 'こんばん わ '), ('こんにちは ', 'こんにち わ '), ('きゅうがつ', 'くがつ'), ('きゅうじに', 'くじに'), ('きゅうじから', 'くじから'), ('きゅうじまで', 'くじまで'), ('きゅうじは', 'くじは'), ('たんじょうひ', 'たんじょうび'), ('けいにく', 'とりにく'), ('ふじやま', 'ふじさん')]


def reading(sentence):
    chunks, prev, prev_surf = [], None, ''
    for w in tagger(sentence):
        f = w.feature
        pos = f.pos1
        surf = w.surface
        if surf in OVERRIDE and OVERRIDE[surf]:
            r = OVERRIDE[surf]
        elif pos == '助詞' and surf in ('は', 'へ', 'を'):
            r = {'は': 'わ', 'へ': 'え', 'を': 'お'}[surf]
        elif pos in ('補助記号', '記号') or not getattr(f, 'kana', None) or f.kana == '*':
            r = surf
        elif all(c in KATA for c in surf):
            r = surf  # 外来语保留片假名
        else:
            r = hira(f.kana)
        attach = (
            not chunks
            or pos not in CONTENT
            or prev == '接頭辞'
            or (pos == '名詞' and prev == '名詞')  # 复合名词、数字+量词连读
            or (pos == '動詞' and f.pos2 == '非自立可能' and (prev_surf in ('て', 'で') or prev == '動詞'))
            or (pos == '形容詞' and f.pos2 == '非自立可能' and prev_surf in ('て', 'で'))
        )
        if chunks and chunks[-1].endswith(('、', '。')):
            attach = False
        if attach and chunks:
            chunks[-1] += r
        else:
            chunks.append(r)
        prev, prev_surf = pos, surf
    out = ' '.join(chunks)
    for a_, b_ in FIX:
        out = out.replace(a_, b_)
    return out


def main():
    from furigana import furi, card_fix, tts, plain_reading   # 头上标假名（furigana.py 也会读这里的 OVERRIDE，所以在函数里导入）
    # 单词卡上的读音（例句里这个词本身按卡片读）
    vocab_src = (ROOT / 'vocab.js').read_text(encoding='utf-8')
    vocab = json.loads(vocab_src[vocab_src.index('{'):vocab_src.rindex(';')])
    cards = {}
    for rows in vocab.values():
        for w, r, *_ in rows:
            cards[w] = cards[w] + '/' + r if w in cards else r
    fixed = resynced = 0
    alias = {}
    for line in (ROOT / 'tools/vocab/alias.txt').read_text(encoding='utf-8').splitlines():
        if line.strip() and not line.startswith('#'):
            a, b = line.split('|')
            alias[a] = b
    out = {}
    for src in sorted((ROOT / 'tools').glob('examples_*.txt')):
        for n, line in enumerate(src.read_text(encoding='utf-8').splitlines(), 1):
            if not line.strip() or line.startswith('#'):
                continue
            parts = [p.strip() for p in line.split('|')]
            if len(parts) != 3:
                sys.exit(f'{src.name}:{n} 需要 3 列：{line}')
            word, jp, zh = parts
            word = alias.get(word, word)
            kana, f = reading(jp), furi(jp)
            if f and word in cards:
                kana, f, ch = card_fix(word, cards[word], jp, kana, f)
                fixed += ch
            # 朗读用的读音和假名标注对不上时，按标注重新生成，保证听到的和看到的一致
            if f and not re.search(r'[0-9０-９〇A-Za-zＡ-Ｚａ-ｚ]', jp) and plain_reading(jp, f) != hira(re.sub(r'[\s。、，！？!?「」『』…・〜～]', '', kana)).translate(str.maketrans('わおえ', 'はをへ')):
                kana = tts(jp, f)
                resynced += 1
            out.setdefault(word, []).append([jp, kana, zh] + ([f] if f else []))
    js = '// 自动生成：python3 tools/build_examples.py（请编辑 tools/examples_*.txt）\n'
    js += '// 每个单词：[日语例句, 朗读用假名, 中文翻译]\nconst EXAMPLES = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')).replace('],"', '],\n"') + ';\n'
    (ROOT / 'examples.js').write_text(js, encoding='utf-8')
    print(f'{sum(len(v) for v in out.values())} 句，{len(out)} 个单词；按单词卡改正读音的例句 {fixed} 句，朗读读音按标注重新生成 {resynced} 句')


if __name__ == '__main__':
    main()
