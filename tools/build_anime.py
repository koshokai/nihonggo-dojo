"""动漫·日剧名台词：合并 tools/anime/*.json，配上照片，生成 lang/ja-anime.json（网页 anime.js 读取）。
内容规范见 tools/anime/SPEC.md。照片由 tools/fetch_photos.py 按每部作品的 photo 搜索词下载，键名 anime-<id>。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'anime'
ORDER = ['jump.json', 'classic.json', 'modern.json', 'retro.json', 'drama.json']


def works():
    files = sorted(SRC.glob('*.json'), key=lambda f: (ORDER.index(f.name) if f.name in ORDER else 99, f.name))
    seen = set()
    for f in files:
        for w in json.loads(f.read_text(encoding='utf-8')):
            if w['id'] in seen:
                continue
            seen.add(w['id'])
            yield w


def photo_queries():
    """fetch_photos.py 用：{anime-<id>: [搜索词, ...]}"""
    return {f"anime-{w['id']}": [q.strip() for q in w.get('photo', '').split(' / ') if q.strip()] for w in works() if w.get('photo')}


def main():
    sys.path.insert(0, str(ROOT / 'tools'))
    from furigana import furi   # 汉字头上的假名（需要 fugashi + unidic-lite）
    pidx = ROOT / 'photos' / 'index.json'
    photos = json.loads(pidx.read_text(encoding='utf-8')) if pidx.exists() else {}
    over = json.loads((ROOT / 'tools' / 'photo_queries.json').read_text(encoding='utf-8'))
    out = []
    for w in works():
        lines = [{k: l[k] for k in ('jp', 'kana', 'zh', 'who', 'lv', 'scene', 'note', 'words', 'talk') if k in l} for l in w['lines'] if l.get('jp')]
        if not lines:
            continue
        for l in lines:
            l['furi'] = furi(l['jp'], l.get('kana'))
            l['talk'] = [t[:4] + [furi(t[1], t[2])] for t in l.get('talk', [])]
        item = {k: w.get(k, '') for k in ('id', 'kind', 'title', 'zh', 'year', 'place')}
        item['lines'] = lines
        key = f"anime-{w['id']}"
        if key in photos and over.get(key) != '':
            ph = photos[key]
            item['ph'] = [ph['file'], ph['by'], ph['license'], ph['page']]
        out.append(item)
    (ROOT / 'lang' / 'ja-anime.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(len(out), 'works,', sum(len(w['lines']) for w in out), 'lines,', sum('ph' in w for w in out), 'photos')


if __name__ == '__main__':
    main()
