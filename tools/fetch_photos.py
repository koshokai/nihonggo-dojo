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
        'gsrsearch': q + ' filetype:bitmap', 'gsrlimit': 15, 'prop': 'imageinfo',
        'iiprop': 'url|extmetadata|mime|size', 'iiurlwidth': 960}))
    pages = sorted((d.get('query') or {}).get('pages', {}).values(), key=lambda p: p.get('index', 99))
    for p in pages:
        ii = (p.get('imageinfo') or [{}])[0]
        meta = ii.get('extmetadata', {})
        lic = plain(meta.get('LicenseShortName', {}).get('value'))
        if ii.get('mime') != 'image/jpeg' or ii.get('width', 0) < 800 or ii.get('width', 0) < ii.get('height', 1):
            continue                                  # 只要横向的 jpg 照片
        if not OK_LICENSE.match(lic) or 'NC' in lic or 'ND' in lic:
            continue
        by = plain(meta.get('Artist', {}).get('value')) or 'Unknown'
        return {'thumb': ii.get('thumburl') or ii['url'], 'by': by[:120], 'license': lic, 'page': ii.get('descriptionurl', '')}
    return None


def articles():
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
        hit = None
        for q in queries:
            try:
                hit = search(q)
            except Exception as e:
                print('  search failed', aid, q, e)
            if hit and hit['page'] not in used:
                break
            hit = None
            time.sleep(1)
        if not hit:
            print('no photo', aid, queries)
            continue
        file = f'{aid}.jpg'
        (OUT / file).write_bytes(get(hit['thumb']))
        idx[aid] = {'file': f'photos/{file}', 'by': hit['by'], 'license': hit['license'], 'page': hit['page']}
        used.add(hit['page'])
        print(aid, hit['license'], hit['by'][:40], hit['page'])
        idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding='utf-8')
        time.sleep(1)
    print(len(idx), 'photos')


if __name__ == '__main__':
    main()
