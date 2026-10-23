"""听力题：tools/listen/N?.json → listening.js。也给 gen_audio.py 提供每题的朗读片段（segs）。

    python3 tools/listen/check.py      先检查数据
    python3 tools/build_listen.py      生成 listening.js

题目 id 由朗读内容算出来：改了台词，id 就变，gen_audio.py listen 会重新生成那一题的音频。
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'listen'
LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
SPEED = {'N5': 0.9, 'N4': 0.95, 'N3': 1.0, 'N2': 1.05, 'N1': 1.1}   # 对话语速；旁白一直是 1.0
SPOKEN = {'gaiyou', 'hatsuwa', 'sokuji'}                           # 选项只朗读、不显示
NUM = ['いち', 'に', 'さん', 'よん']
OTHER = {'M': 'F', 'F': 'M', 'M2': 'F', 'F2': 'M'}


def segs(x):
    """[(说话人, 文本, 之后停顿秒数)]。说话人 N 是旁白。网页没有音频时用浏览器朗读同样的顺序（listen.js 的 lsSegs）。"""
    s = []
    if x.get('intro'):
        s.append(['N', x['intro'], 1.2])
    for spk, ja, _ in x['lines']:
        s.append([spk, ja, 0.5])
    if x['lines']:
        s[-1][2] = 1.2
    if x.get('q') and x['t'] not in ('hatsuwa', 'sokuji'):
        s.append(['N', x['q'], 1.0])
    if x['t'] in SPOKEN:
        voice = OTHER[x['lines'][0][0]] if x['t'] == 'sokuji' else ('F' if x['t'] == 'hatsuwa' else 'N')
        for i, c in enumerate(x['c']):
            s.append(['N', NUM[i], 0.3])
            s.append([voice, c, 0.9])
    return s


def items():
    out = {}
    for L in LEVELS:
        f = SRC / f'{L}.json'
        if not f.exists():
            continue
        lst = []
        for x in json.loads(f.read_text(encoding='utf-8')):
            key = json.dumps([segs(x), SPEED[L]], ensure_ascii=False)
            x = dict(x, id=f'{L}-' + hashlib.sha1(key.encode()).hexdigest()[:10])
            lst.append(x)
        out[L] = lst
    return out


def main():
    data = items()
    keep = ['id', 't', 'intro', 'lines', 'q', 'c', 'cz', 'a', 'ex']
    js = {L: [{k: x[k] for k in keep if k in x} for x in v] for L, v in data.items()}
    (ROOT / 'listening.js').write_text(
        '// 听力题（原创，按 JLPT 听解题型编写）。由 tools/build_listen.py 从 tools/listen/*.json 生成，不要手改。\n'
        'const LISTEN = ' + json.dumps(js, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print({L: len(v) for L, v in data.items()})


if __name__ == '__main__':
    main()
