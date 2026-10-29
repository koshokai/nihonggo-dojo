"""韩语、英语的语法 / 阅读 / 听力 / 今日一句 / 商务：tools/lang2/<lang>_*.json → lang/<lang>-*.json（网页按需加载）

阅读文章的 photo 搜索词由 tools/fetch_photos.py 用来下载照片（id：ko-r-01…），照片记录在 photos/index.json。
听力题的 id 由朗读内容算出，tools/gen_audio_melo.py listen 按 id 生成对话音频。格式见 tools/lang2/SPEC.md。
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'lang2'
OVER = json.loads((ROOT / 'tools' / 'photo_queries.json').read_text(encoding='utf-8'))   # 值为 "" 的照片人工判定为不贴切
PHOTOS = json.loads((ROOT / 'photos' / 'index.json').read_text(encoding='utf-8')) if (ROOT / 'photos' / 'index.json').exists() else {}


def load(lang, kind):
    """<lang>_<kind>.json 加上后续扩充的 <lang>_<kind>2.json、<kind>3.json……（按文件名顺序拼起来）"""
    fs = sorted(SRC.glob(f'{lang}_{kind}.json')) + sorted(SRC.glob(f'{lang}_{kind}[0-9].json'))
    if not fs:
        return None
    out = None
    for f in fs:
        d = json.loads(f.read_text(encoding='utf-8'))
        if out is None:
            out = d
        elif isinstance(d, list):
            out = out + d
        else:   # 字典（商务）：同名列表接在后面
            for k, v in d.items():
                out[k] = out.get(k, []) + v
    return out


def write(lang, kind, data):
    (ROOT / 'lang' / f'{lang}-{kind}.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def listen_id(lang, x):
    key = json.dumps([x.get('intro'), x['lines'], x.get('q'), x['c'], 1], ensure_ascii=False)
    return f'{lang}-' + hashlib.sha1(key.encode()).hexdigest()[:10]


def main():
    for lang in ('ko', 'en'):
        out = {}
        for kind in ('grammar', 'daily', 'biz'):
            d = load(lang, kind)
            if d is not None:
                if kind == 'biz':
                    # 商务场景会话：编号 <lang>-bs-01…，照片和阅读文章一样由 fetch_photos.py 下载
                    for i, sc in enumerate(d.get('scenes', []), 1):
                        sc['id'] = f'{lang}-bs-{i:02d}'
                        sc.pop('photo', None)
                        if sc['id'] in PHOTOS and OVER.get(sc['id']) != '':
                            ph = PHOTOS[sc['id']]
                            sc['ph'] = [ph['file'], ph['by'], ph['license'], ph['page']]
                write(lang, kind, d); out[kind] = len(d)
        d = load(lang, 'reading')
        if d is not None:
            for i, a in enumerate(d, 1):
                a['id'] = f'{lang}-r-{i:02d}'
                a.pop('photo', None)
                if a['id'] in PHOTOS:
                    ph = PHOTOS[a['id']]
                    a['ph'] = [ph['file'], ph['by'], ph['license'], ph['page']]
            write(lang, 'reading', d); out['reading'] = len(d)
        d = load(lang, 'listen')
        if d is not None:
            for x in d:
                x['id'] = listen_id(lang, x); x['lang'] = lang
            write(lang, 'listen', d); out['listen'] = len(d)
        print(lang, out)


def photo_queries():
    """给 fetch_photos.py：{id: [搜索词]}"""
    out = {}
    for lang in ('ko', 'en'):
        for i, a in enumerate(load(lang, 'reading') or [], 1):
            if a.get('photo'):
                out[f'{lang}-r-{i:02d}'] = [q.strip() for q in a['photo'].split(' / ') if q.strip()]
        for i, sc in enumerate((load(lang, 'biz') or {}).get('scenes', []), 1):
            if sc.get('photo'):
                out[f'{lang}-bs-{i:02d}'] = [q.strip() for q in sc['photo'].split(' / ') if q.strip()]
    return out


if __name__ == '__main__':
    main()
