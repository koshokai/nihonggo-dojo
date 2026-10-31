"""搜索引擎用的静态页：每个日语单词一页（w/），每个语法点一页（g/，日语、韩语、英语），加上 sitemap.xml 和 robots.txt。
网站本身是单页应用，搜索引擎看不到里面的内容；这些页面是普通 HTML，能被收录，页面里有「去日语道场练习」的入口。
用法：python3 tools/build_seo.py（改了词表、例句、语法后重新运行）
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = 'https://koshokai.github.io/nihonggo-dojo/'
E = html.escape
CSS = """body{font-family:system-ui,-apple-system,"PingFang SC","Hiragino Sans",sans-serif;max-width:720px;margin:0 auto;padding:16px;line-height:1.8;color:#2A2226;background:#FBF6F8}
h1{font-size:1.6rem;margin:.4em 0}a{color:#D9578A}.ex{background:#fff;border:1px solid #F1DDE5;border-radius:12px;padding:10px 14px;margin:10px 0}
.zh{color:#7A6E80;font-size:.92rem}.cta{display:inline-block;background:#D9578A;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;margin:14px 0}
rt{font-size:.6em;color:#7A6E80}.muted{color:#7A6E80;font-size:.9rem}nav{font-size:.9rem;margin-bottom:8px}"""


def page(path, title, desc, body, lang='ja'):
    out = ROOT / path
    out.parent.mkdir(parents=True, exist_ok=True)
    depth = '../' * (path.count('/'))
    out.write_text(f'''<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)}</title><meta name="description" content="{E(desc)}"><link rel="canonical" href="{SITE}{E(path)}">
<style>{CSS}</style></head><body><nav><a href="{depth}{'#' + path[2:4] if path.startswith(('g/ko-', 'g/en-')) else ''}">{'韩语道场' if path.startswith('g/ko-') else '英语道场' if path.startswith('g/en-') else '日语道场'}</a> · <a href="{depth}{path.split('/')[0]}/">{'单词' if path.startswith('w/') else '语法'}索引</a></nav>
{body}
<p class="muted">日语道场：免费学日语、韩语、英语。单词卡、闯关、阅读、听力、模拟考，每天十分钟。</p></body></html>''', encoding='utf-8')


def ruby(jp, furi):
    if not furi:
        return E(jp)
    out, i = '', 0
    for m in re.finditer(r'(\d+)\.(\d+)([^,]*)', furi):
        s, l, r = int(m[1]), int(m[2]), m[3]
        out += E(jp[i:s]) + f'<ruby>{E(jp[s:s + l])}<rt>{E(r)}</rt></ruby>'
        i = s + l
    return out + E(jp[i:])


def js_obj(name, key):
    s = (ROOT / name).read_text(encoding='utf-8')
    return json.loads(s[s.index('{', s.index(key)):s.rindex(';')])


def main():
    urls = []
    vocab = js_obj('vocab.js', 'VOCAB_DATA')
    ex = {}
    for f in sorted((ROOT / 'lang').glob('ja-ex-N*.json')):
        ex.update(json.loads(f.read_text(encoding='utf-8')))
    # 单词
    index, seen = {}, set()
    for L, rows in vocab.items():
        for w, r, zh, *_ in rows:
            if w in seen or re.search(r'[/\\?#%～〜(（]', w):
                continue
            seen.add(w)
            name = f'w/{w}.html'
            exs = ''.join(f'<div class="ex"><div lang="ja">{ruby(e[0], e[3] if len(e) > 3 else "")}</div><div class="zh">{E(e[2])}</div></div>' for e in ex.get(w, [])[:3])
            body = f'''<h1 lang="ja">{E(w)}<span class="muted">（{E(r)}）</span></h1><p><b>{E(zh)}</b> · JLPT {L}</p>
<h2>例句</h2>{exs or '<p class="muted">暂无例句</p>'}
<a class="cta" href="../#vocab">在日语道场背这个词 →</a>'''
            page(name, f'{w}（{r}）的意思和例句 · JLPT {L} 日语单词 | 日语道场', f'日语单词「{w}」读作「{r}」，意思是{zh}。JLPT {L}，附带例句和中文翻译。', body)
            index.setdefault(L, []).append((w, r, zh, name))
            urls.append(name)
    page('w/index.html', '日语单词表（JLPT N5–N1）| 日语道场', 'JLPT N5 到 N1 的日语单词，每个词都有读音、中文意思和例句。',
         '<h1>日语单词表（JLPT N5–N1）</h1>' + ''.join(f'<h2>{L}</h2><p>' + ' · '.join(f'<a href="{E(n[2:])}" lang="ja">{E(w)}</a>' for w, r, zh, n in v) + '</p>' for L, v in index.items()))
    urls.append('w/index.html')
    # 日语语法
    gram = js_obj('grammar.js', 'GRAMMAR_DATA')
    gidx = []
    for L, rows in gram.items():
        for i, g in enumerate(rows, 1):
            name = f'g/ja-{L}-{i:02d}.html'
            exs = ''.join(f'<div class="ex"><div lang="ja">{ruby(e[0].replace("[", "").replace("]", ""), e[3] if len(e) > 3 else "")}</div><div class="zh">{E(e[2])}</div></div>' for e in g['eg'])
            page(name, f'日语语法「{g["p"]}」的意思、接续和例句 · JLPT {L} | 日语道场', f'日语语法{g["p"]}：{g["m"]}。{g.get("how", "")}',
                 f'<h1 lang="ja">{E(g["p"])}</h1><p><b>{E(g["m"])}</b> · JLPT {L}</p><p>接续：{E(g.get("how", ""))}</p><h2>例句</h2>{exs}<a class="cta" href="../#grammar">在日语道场做这个语法的练习 →</a>')
            gidx.append(('日语', L, g['p'], g['m'], name)); urls.append(name)
    # 韩语、英语语法
    for tr, tname in (('ko', '韩语'), ('en', '英语')):
        for i, g in enumerate(json.loads((ROOT / 'lang' / f'{tr}-grammar.json').read_text(encoding='utf-8')), 1):
            name = f'g/{tr}-{i:03d}.html'
            exs = ''.join(f'<div class="ex"><div lang="{tr}">{E(s)}</div><div class="zh">{E(zh)}</div></div>' for s, zh in g['eg'])
            page(name, f'{tname}语法「{g["p"]}」的意思和例句 · {g["lv"]} | {tname}道场', f'{tname}语法{g["p"]}：{g["m"]}。{g.get("use", "")}',
                 f'<h1 lang="{tr}">{E(g["p"])}</h1><p><b>{E(g["m"])}</b> · {E(g["lv"])}</p><p>{E(g.get("use", ""))}</p><h2>例句</h2>{exs}<a class="cta" href="../#{tr}/grammar">去{tname}道场练习 →</a>', tr)
            gidx.append((tname, g['lv'], g['p'], g['m'], name)); urls.append(name)
    page('g/index.html', '日语、韩语、英语语法索引 | 日语道场', '日语 JLPT N5–N1、韩语 TOPIK、英语四六级的语法点，每个都有意思、接续和例句。',
         '<h1>语法索引</h1>' + ''.join(f'<p><a href="{E(n[2:])}">{E(t)} · {E(L)} · {E(p)}</a> <span class="muted">{E(m)}</span></p>' for t, L, p, m, n in gidx))
    urls.append('g/index.html')
    # sitemap + robots
    from urllib.parse import quote
    (ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + f'<url><loc>{SITE}</loc></url>\n' + ''.join(f'<url><loc>{SITE}{quote(u)}</loc></url>\n' for u in urls) + '</urlset>\n', encoding='utf-8')
    (ROOT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {SITE}sitemap.xml\n', encoding='utf-8')
    print(len(urls), 'pages')


if __name__ == '__main__':
    main()
