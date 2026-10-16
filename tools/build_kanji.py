"""生成 kanji.js：JLPT N5–N1 汉字（读音、笔画、英文释义）。

来源：tools/kanji/kanji-data.json 来自 davidluzgouveia/kanji-data（MIT），
其中汉字信息来自 KANJIDIC（EDRDG，CC BY-SA 4.0），JLPT 级别来自 Jonathan Waller 的资料。
只使用 KANJIDIC 字段，不使用其中的 WaniKani 内容。

    python3 tools/build_kanji.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
LV = {5: 'N5', 4: 'N4', 3: 'N3', 2: 'N2', 1: 'N1'}


def kata(s):
    return ''.join(chr(ord(c) + 0x60) if 'ぁ' <= c <= 'ゖ' else c for c in s)


def kun(s):
    s = s.strip('-')
    return s.replace('.', '(', 1) + ')' if '.' in s else s


def main():
    data = json.loads((ROOT / 'tools/kanji/kanji-data.json').read_text(encoding='utf-8'))
    out = {L: [] for L in LV.values()}
    for k, v in data.items():
        L = LV.get(v.get('jlpt_new'))
        if not L:
            continue
        on = list(dict.fromkeys(kata(x.strip('-')) for x in v.get('readings_on') or []))[:4]
        ku = list(dict.fromkeys(kun(x) for x in v.get('readings_kun') or []))[:5]
        en = ', '.join((v.get('meanings') or [])[:3])
        out[L].append([k, '・'.join(on) or '—', '・'.join(ku) or '—', en, v.get('strokes') or 0, v.get('freq') or 9999])
    for L in out:
        out[L].sort(key=lambda x: x[5])
        out[L] = [x[:5] for x in out[L]]
        print(L, len(out[L]))
    js = ('// 自动生成：python3 tools/build_kanji.py\n'
          '// 来源：kanji-data（MIT）/ KANJIDIC（EDRDG，CC BY-SA 4.0）/ Jonathan Waller JLPT 级别\n'
          '// 每项：[汉字, 音读, 训读, 英文释义, 笔画]，按使用频度排序\n'
          'const KANJI_DATA = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')).replace('],[', '],\n[') + ';\n')
    (ROOT / 'kanji.js').write_text(js, encoding='utf-8')
    print('bytes', len(js.encode()))


if __name__ == '__main__':
    main()
