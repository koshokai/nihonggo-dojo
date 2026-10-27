"""韩语分级词库第一步：国立国语院《한국어기초사전》XML（CC BY-SA 2.0 KR，
https://github.com/spellcheck-ko/korean-dict-nikl-krdict）→ tools/kozh/ko_graded.tsv

只取标了等级（초급/중급/고급）的词。每行：键 词 词性 汉字 英文 日文 等级 韩语释义
中文释义由本站编写（tools/kozh/zh_XX.tsv），再用 tools/build_ko_levels.py 生成 lang/ko-*.json。

    git clone --depth 1 https://github.com/spellcheck-ko/korean-dict-nikl-krdict /tmp/krdict
    python3 tools/extract_krdict.py /tmp/krdict
"""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LV = {'초급': 'A', '중급': 'B', '고급': 'C'}


def feats(el):
    return {f.get('att'): f.get('val') for f in el.findall('feat')}


def main(src):
    rows = []
    for f in sorted(Path(src).glob('*.xml'), key=lambda p: int(p.stem)):
        # 原始文件里夹着一些 XML 不允许的控制字符，先去掉
        xml = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', f.read_text(encoding='utf-8'))
        # 还有属性值里没转义的 < >
        xml = re.sub(r'val="([^"]*)"', lambda m: 'val="' + m.group(1).replace('<', '&lt;').replace('>', '&gt;') + '"', xml)
        for e in ET.fromstring(xml).iter('LexicalEntry'):
            m = feats(e)
            lv = LV.get(m.get('vocabularyLevel'))
            if not lv:
                continue
            word = feats(e.find('Lemma')).get('writtenForm', '')
            sense = e.find('Sense')
            if sense is None or not word:
                continue
            eq = {}
            for q in sense.findall('Equivalent'):
                qf = feats(q)
                eq[qf.get('language')] = qf.get('lemma') or ''
            d = feats(sense).get('definition', '')
            key = f"{word}|{m.get('homonym_number', '0')}|{e.get('val')}"
            clean = lambda s: (s or '').replace('\t', ' ').replace('\n', ' ').strip()
            rows.append('\t'.join(map(clean, [key, word, m.get('partOfSpeech'), m.get('origin'), eq.get('영어'), eq.get('일본어'), lv, d])))
    (ROOT / 'tools' / 'kozh' / 'ko_graded.tsv').write_text('\n'.join(rows) + '\n', encoding='utf-8')
    print(len(rows))


if __name__ == '__main__':
    main(sys.argv[1])
