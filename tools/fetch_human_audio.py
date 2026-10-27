"""真人发音：从 Wikimedia Commons 下载母语者的单词录音（CC BY-SA / CC BY / CC0，可商用，需注明作者）。
- 英语：维基词典的美音录音 File:En-us-<word>.ogg
- 韩语：Lingua Libre 的录音（Category:Lingua Libre pronunciation-kor，文件名 LL-Q9176 (kor)-<录音者>-<词>.wav）
只下载本站词表里有的词。转成 MP3 存到 audio/<语言>-h/，索引 audio/index-<语言>-human.json（单词 → 文件），
作者和授权写进 credits.html。网页朗读时优先用真人录音。

在 GitHub Actions 里运行（.github/workflows/human-audio.yml）：python3 tools/fetch_human_audio.py en|ko
"""
import hashlib
import html
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'audio'
API = 'https://commons.wikimedia.org/w/api.php'
UA = 'NihongoDojo/1.0 (https://koshokai.github.io/nihonggo-dojo/; pronunciation credits on site)'
OK_LICENSE = re.compile(r'^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)', re.I)


def get(url, params=None, raw=False):
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for i in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                b = r.read()
            return b if raw else json.loads(b)
        except Exception:
            if i == 4:
                raise
            time.sleep(3 * (i + 1))


def plain(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()


def words(lang):
    d = json.loads((ROOT / 'tools' / 'lang' / f'{lang}.json').read_text(encoding='utf-8'))
    out = [w[0] for w in d['words']]
    for k, _, _ in json.loads((ROOT / 'lang' / f'{lang}-levels.json').read_text(encoding='utf-8')):
        if lang == 'en' and k in ('ky', 'ielts', 'toefl', 'gre'):
            continue                              # 英语只取中考到六级的常用词
        out += [r[0] for r in json.loads((ROOT / 'lang' / f'{lang}-{k}.json').read_text(encoding='utf-8'))]
    return list(dict.fromkeys(w for w in out if ' ' not in w.strip() or lang == 'ko'))


def info(titles):
    """[(title)] → {title: {url, by, license, page}}，每次最多 50 个"""
    out = {}
    for i in range(0, len(titles), 50):
        d = get(API, {'action': 'query', 'format': 'json', 'titles': '|'.join(titles[i:i + 50]), 'prop': 'imageinfo', 'iiprop': 'url|extmetadata'})
        for p in (d.get('query') or {}).get('pages', {}).values():
            ii = (p.get('imageinfo') or [None])[0]
            if not ii:
                continue
            m = ii.get('extmetadata', {})
            lic = plain(m.get('LicenseShortName', {}).get('value'))
            if not OK_LICENSE.match(lic) or 'NC' in lic or 'ND' in lic:
                continue
            out[p['title']] = {'url': ii['url'], 'by': plain(m.get('Artist', {}).get('value'))[:100] or 'Unknown', 'license': lic, 'page': ii.get('descriptionurl', '')}
        time.sleep(.5)
    return out


def candidates(lang, wanted):
    if lang == 'en':
        cand = {}
        for w in wanted:
            cand.setdefault(w, []).append(f'File:En-us-{w}.ogg')
            if w[:1].isupper() is False:
                cand[w].append(f'File:En-us-{w[0].upper() + w[1:]}.ogg')
        return cand
    # 韩语：列出 Lingua Libre 韩语分类里的全部文件，从文件名取出单词
    cand, cont = {}, {}
    want = set(wanted)
    while True:
        d = get(API, dict({'action': 'query', 'format': 'json', 'list': 'categorymembers', 'cmtitle': 'Category:Lingua Libre pronunciation-kor', 'cmtype': 'file', 'cmlimit': 500}, **cont))
        for m in d['query']['categorymembers']:
            mm = re.match(r'^File:LL-Q9176 \(kor\)-[^-]+-(.+)\.(wav|ogg|flac)$', m['title'])
            if mm and mm.group(1) in want:
                cand.setdefault(mm.group(1), []).append(m['title'])
        if 'continue' not in d:
            break
        cont = d['continue']
    return cand


def main(lang):
    wanted = words(lang)
    print(lang, len(wanted), 'words', flush=True)
    cand = candidates(lang, wanted)
    titles = sorted({t for ts in cand.values() for t in ts})
    meta = info(titles)
    idx_path = OUT / f'index-{lang}-human.json'
    idx = json.loads(idx_path.read_text(encoding='utf-8')) if idx_path.exists() else {}
    cred_path = OUT / 'human-credits.json'
    credits = json.loads(cred_path.read_text(encoding='utf-8')) if cred_path.exists() else {}
    def save():
        idx_path.write_text(json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        cred_path.write_text(json.dumps(credits, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        write_credits(credits)

    # 每次运行有时间预算，到点就保存退出；再运行一次会从上次停下的地方继续
    deadline = time.time() + 60 * float(os.environ.get('HUMAN_BUDGET_MIN', '100'))
    n = 0
    with tempfile.TemporaryDirectory() as tmp:
        for w, ts in cand.items():
            if w in idx:
                continue
            if time.time() > deadline:
                print('  time budget used up; run again to continue', flush=True)
                break
            t = next((t for t in ts if t in meta), None)
            if not t:
                continue
            src = Path(tmp) / ('x' + Path(t).suffix)
            file = f'{lang}-h/{hashlib.sha1(w.encode()).hexdigest()[:16]}.mp3'
            try:
                if (OUT / file).exists():  # 上次中断前已经转好的文件，直接收录
                    raise FileExistsError
                src.write_bytes(get(meta[t]['url'], raw=True))
                (OUT / file).parent.mkdir(parents=True, exist_ok=True)
                # 去掉开头结尾的静音，单声道 32k
                subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(src), '-af',
                                'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',
                                '-ac', '1', '-b:a', '32k', str(OUT / file)], check=True)
            except FileExistsError:
                pass
            except Exception as e:
                print('  failed', w, e, flush=True)
                continue
            idx[w] = file
            credits[file] = [w, meta[t]['by'], meta[t]['license'], meta[t]['page']]
            n += 1
            if n % 200 == 0:
                print(' ', n, flush=True)
                save()
    save()
    print(lang, 'human recordings', len(idx), 'new', n)


def write_credits(credits):
    rows = ''.join(f'<tr><td lang="{f[:2]}">{html.escape(w)}</td><td>{html.escape(by)}</td><td>{html.escape(lic)}</td><td><a href="{html.escape(page)}">Commons</a></td></tr>'
                   for f, (w, by, lic, page) in sorted(credits.items(), key=lambda x: (x[0][:2], x[1][0])))
    (ROOT / 'credits.html').write_text(f'''<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>发音录音来源</title><style>body{{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:16px;line-height:1.6}}table{{border-collapse:collapse;width:100%;font-size:.9rem}}td,th{{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}}</style></head>
<body><h1>真人发音录音来源</h1><p>以下单词的真人发音来自 <a href="https://commons.wikimedia.org">Wikimedia Commons</a>（维基词典、<a href="https://lingualibre.org">Lingua Libre</a>），
由志愿者录制，按各自的授权使用（CC BY-SA / CC BY / CC0）。本站对音频做了格式转换和首尾静音裁剪。共 {len(credits)} 条。</p>
<table><thead><tr><th>单词</th><th>录音者</th><th>授权</th><th>原文件</th></tr></thead><tbody>{rows}</tbody></table>
<p><a href="./">← 返回</a></p></body></html>''', encoding='utf-8')


if __name__ == '__main__':
    main(sys.argv[1])
