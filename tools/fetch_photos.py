"""给「日本生活」文章找实拍照片：按 tools/reading/life_*.txt 里的 photo: 搜索词，在 Wikimedia Commons 上找
可以自由使用的照片（CC0、公有领域、CC BY、CC BY-SA），下载 960px 宽的版本到 photos/，作者和授权记在 photos/index.json。
网页上每张照片都会注明作者、授权和原图链接（CC BY / BY-SA 的要求）。

在 GitHub Actions 里运行（.github/workflows/photos.yml）：python3 tools/fetch_photos.py
已经有照片的文章会跳过；想换某张照片，就从 photos/index.json 删掉那一条（并删除图片）再运行。
"""
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'photos'
API = 'https://commons.wikimedia.org/w/api.php'
UA = 'NihongoDojo/1.0 (https://koshokai.github.io/nihonggo-dojo/; photo credits shown on site)'
STOP = {'japan', 'japanese', 'tokyo', 'with', 'from', 'interior', 'exterior', 'street', 'food'}
OK_LICENSE = re.compile(r'^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)', re.I)


def get(url, params=None):
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:
            if i == 3:
                raise
            time.sleep(3 * (i + 1))


def plain(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


def search(q):
    d = json.loads(get(API, {
        'action': 'query', 'format': 'json', 'generator': 'search', 'gsrnamespace': 6,
        'gsrsearch': q + ' filetype:bitmap', 'gsrlimit': 40, 'prop': 'imageinfo',
        'iiprop': 'url|extmetadata|mime|size', 'iiurlwidth': 960}))
    pages = sorted((d.get('query') or {}).get('pages', {}).values(), key=lambda p: p.get('index', 99))
    # 全文搜索会匹配到说明文字里顺带提到的照片（搜「宇都宫饺子」出来汉堡），所以按文件名里含有几个搜索词重新排序，
    # 一个都不含的不要
    words = [w for w in re.findall(r'(?<![-a-z])[a-z]+', q.lower()) if len(w) > 3 and w not in STOP]   # 「-burger」是排除词，不算
    title = lambda p: re.sub(r'[^a-z]+', ' ', p.get('title', '').lower())
    score = lambda p: sum(w in title(p) for w in words)
    # 文件名要包含全部关键词（只含一个词的常常是不相干的照片）
    pages = sorted([p for p in pages if score(p) == len(words) > 0], key=lambda p: p.get('index', 99))
    out = []
    for p in pages:
        ii = (p.get('imageinfo') or [{}])[0]
        meta = ii.get('extmetadata', {})
        lic = plain(meta.get('LicenseShortName', {}).get('value'))
        if ii.get('mime') != 'image/jpeg' or ii.get('width', 0) < 800 or ii.get('width', 0) < ii.get('height', 1):
            continue                                  # 只要横向的 jpg 照片
        if not OK_LICENSE.match(lic) or 'NC' in lic or 'ND' in lic:
            continue
        by = plain(meta.get('Artist', {}).get('value')) or 'Unknown'
        out.append({'thumb': ii.get('thumburl') or ii['url'], 'by': by[:120], 'license': lic, 'page': ii.get('descriptionurl', '')})
    return out


def colorful(data):
    """黑白老照片、扫描的文字不要：平均饱和度太低就跳过。没装 Pillow 时不检查。"""
    try:
        from io import BytesIO
        from PIL import Image
        im = Image.open(BytesIO(data)).convert('HSV').resize((64, 40))
        s = [px[1] for px in im.getdata()]
        return sum(s) / len(s) > 40
    except ImportError:
        return True


def articles():
    # 旧阅读文章和商务日语：搜索词集中写在 tools/photo_queries.json
    q = ROOT / 'tools' / 'photo_queries.json'
    if q.exists():
        for aid, s in json.loads(q.read_text(encoding='utf-8')).items():
            yield aid, [x.strip() for x in s.split(' / ') if x.strip()]
    # 韩语、英语阅读文章（tools/lang2/*_reading.json 的 photo 字段）
    import sys
    sys.path.insert(0, str(ROOT / 'tools'))
    from build_lang2 import photo_queries
    yield from photo_queries().items()
    for f in sorted((ROOT / 'tools' / 'reading').glob('life_*.txt')):
        for block in re.split(r'\n(?=# id:)', f.read_text(encoding='utf-8').strip()):
            head = block.split('\n---\n', 1)[0]
            meta = {k.strip('# ').strip(): v.strip() for k, v in (l.split(':', 1) for l in head.splitlines())}
            if 'photo' in meta:
                yield meta['id'], [q.strip() for q in meta['photo'].split(' / ') if q.strip()]


def main():
    OUT.mkdir(exist_ok=True)
    idx_path = OUT / 'index.json'
    idx = json.loads(idx_path.read_text(encoding='utf-8')) if idx_path.exists() else {}
    used = {v['page'] for v in idx.values()}
    for aid, queries in articles():
        if aid in idx:
            continue
        hit = data = None
        for q in queries:
            try:
                cands = search(q)
            except Exception as e:
                print('  search failed', aid, q, e); cands = []
            for c in cands[:6]:
                if c['page'] in used:
                    continue
                d = get(c['thumb'])
                if colorful(d):
                    hit, data = c, d
                    break
            if hit:
                break
            time.sleep(1)
        if not hit:
            print('no photo', aid, queries)
            continue
        file = f'{aid}.jpg'
        (OUT / file).write_bytes(data)
        idx[aid] = {'file': f'photos/{file}', 'by': hit['by'], 'license': hit['license'], 'page': hit['page']}
        used.add(hit['page'])
        print(aid, hit['license'], hit['by'][:40], hit['page'])
        idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding='utf-8')
        time.sleep(1)
    print(len(idx), 'photos')


if __name__ == '__main__':
    main()
