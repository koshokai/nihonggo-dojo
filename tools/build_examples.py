"""把 tools/examples_*.txt 编译成 examples.js。

每行格式：单词 | 日语例句 | 中文翻译
朗读文本由形态分析（fugashi + unidic-lite）自动生成：全部转成平假名，
助词按实际读音写（は→わ、へ→え、を→お），按词组加空格，避免浏览器语音读错汉字。

    pip install fugashi unidic-lite
    python3 tools/build_examples.py
"""
import json
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
FIX = [('ようひ', 'ようび'), ('にっぽん', 'にほん'), ('にほんにん', 'にほんじん'), ('ちゅうごくにん', 'ちゅうごくじん'), ('がいこくにん', 'がいこくじん'), ('よんにん', 'よにん'), ('いちこくにちょう', 'いっせきにちょう')]


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
    out = {}
    for L in LEVELS:
        src = ROOT / 'tools' / f'examples_{L}.txt'
        if not src.exists():
            continue
        for n, line in enumerate(src.read_text(encoding='utf-8').splitlines(), 1):
            if not line.strip() or line.startswith('#'):
                continue
            parts = [p.strip() for p in line.split('|')]
            if len(parts) != 3:
                sys.exit(f'{src.name}:{n} 需要 3 列：{line}')
            word, jp, zh = parts
            out.setdefault(word, []).append([jp, reading(jp), zh])
    js = '// 自动生成：python3 tools/build_examples.py（请编辑 tools/examples_*.txt）\n'
    js += '// 每个单词：[日语例句, 朗读用假名, 中文翻译]\nconst EXAMPLES = ' + json.dumps(out, ensure_ascii=False, indent=0) + ';\n'
    (ROOT / 'examples.js').write_text(js, encoding='utf-8')
    print(f'{sum(len(v) for v in out.values())} 句，{len(out)} 个单词')


if __name__ == '__main__':
    main()
