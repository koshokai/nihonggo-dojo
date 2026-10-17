"""商务日语：tools/business/*.txt → business.js

scenes_*.txt  场景会话    keigo.txt  敬语表    mail.txt  商务邮件    vocab.txt  商务词汇
格式见 tools/business/ 下各文件开头。朗读假名和分词沿用阅读模块（build_reading.py）的做法。
用法：python3 tools/build_business.py
"""
import json
import re
import sys

from build_reading import ROOT, IMGS, reading, tokens

SRC = ROOT / 'tools/business'
SCENE_CATS = ['职场基础', '电话', '拜访接待', '会议', '报联商', '道歉拒绝', '谈判销售', '求职面试', '应酬', '出差']


def cells(line, n=None):
    c = [x.strip() for x in line.split('|')]
    if n and len(c) != n:
        sys.exit(f'字段数不是 {n}：{line}')
    return c


def blocks(path):
    return re.split(r'\n(?=# id:)', path.read_text(encoding='utf-8').strip())


def head_meta(head):
    meta = {}
    for l in head.splitlines():
        k, v = l.split(':', 1)
        meta[k.strip('# ').strip()] = v.strip()
    return meta


def sections(rest):
    """把 '---phrases' '---quiz' 之类的段落拆开。"""
    body, *parts = re.split(r'\n---(\w+)\n', '\n' + rest.strip() + '\n')
    out = {'body': body.strip()}
    for name, text in zip(parts[::2], parts[1::2]):
        out[name] = [l for l in text.strip().splitlines() if l.strip()]
    return out


def sent(jp, keys=()):
    return [jp, reading(jp), tokens(jp, set(keys))]


def scenes():
    out = []
    for f in sorted(SRC.glob('scenes_*.txt')):
        for b in blocks(f):
            head, rest = b.split('\n---\n', 1)
            m, sec = head_meta(head), sections(rest)
            ph = [cells(l, 2) for l in sec.get('phrases', [])]
            keys = [p[0] for p in ph]
            lines = []
            for l in sec['body'].splitlines():
                if not l.strip():
                    continue
                spk, jp, zh = cells(l, 3)
                lines.append([spk] + sent(jp, keys) + [zh])
            if m['cat'] not in SCENE_CATS or m['img'] not in IMGS:
                sys.exit(f'{m["id"]}: cat/img 不对 {m["cat"]} {m["img"]}')
            out.append({'id': m['id'], 'cat': m['cat'], 'L': m['level'], 'img': m['img'], 'title': m['title'], 'zh': m['zh'],
                        'note': m.get('note', ''), 'lines': lines, 'ph': ph, 'q': [cells(l, 5) for l in sec.get('quiz', [])]})
    return out


def mails():
    out = []
    f = SRC / 'mail.txt'
    if not f.exists():
        return out
    for b in blocks(f):
        head, rest = b.split('\n---\n', 1)
        m, sec = head_meta(head), sections(rest)
        ph = [cells(l, 2) for l in sec.get('phrases', [])]
        keys = [p[0] for p in ph]
        paras = []
        for para in re.split(r'\n\s*\n', sec['body']):
            paras.append([sent(jp, keys) + [zh] for jp, zh in (cells(l, 2) for l in para.splitlines() if l.strip())])
        if m['img'] not in IMGS:
            sys.exit(f'{m["id"]}: img 不对')
        out.append({'id': m['id'], 'title': m['title'], 'zh': m['zh'], 'L': m['level'], 'img': m['img'], 'situation': m.get('situation', ''),
                    'subject': m.get('subject', ''), 'p': paras, 'ph': ph, 'q': [cells(l, 5) for l in sec.get('quiz', [])]})
    return out


def keigo():
    out = {'verbs': [], 'rewrite': [], 'set': []}
    f = SRC / 'keigo.txt'
    if not f.exists():
        return out
    cur = None
    for l in f.read_text(encoding='utf-8').splitlines():
        if l.startswith('## '):
            cur = l[3:].strip()
            continue
        if not l.strip() or cur not in out or l.startswith('辞書形') or l.startswith('普通说法') or l.startswith('固定表达'):
            continue
        c = cells(l, {'verbs': 4, 'rewrite': 4, 'set': 3}[cur])
        if cur == 'verbs':
            # 朗读用：每个敬语形式取第一个写法的假名
            c.append([reading(x.split('/')[0].strip()) if x.strip() not in ('—', '-', '') else '' for x in c[:3]])
        elif cur == 'rewrite':
            c.append([reading(c[0].split('/')[0].strip()), reading(c[1].split('/')[0].strip())])
        else:
            c.append(reading(c[0].split('/')[0].strip()))
        out[cur].append(c)
    return out


def vocab():
    out, cur = [], None
    f = SRC / 'vocab.txt'
    if not f.exists():
        return out
    seen = set()
    for l in f.read_text(encoding='utf-8').splitlines():
        if l.startswith('## '):
            cur = {'cat': l[3:].strip(), 'words': []}
            out.append(cur)
            continue
        if not l.strip() or cur is None:
            continue
        w, r, zh, ex, exzh = cells(l, 5)
        if w in seen:
            continue
        seen.add(w)
        cur['words'].append([w, r, zh, ex, reading(ex), exzh])
    return out


def main():
    data = {'scenes': scenes(), 'keigo': keigo(), 'mails': mails(), 'vocab': vocab()}
    js = ('// 自动生成：python3 tools/build_business.py（请编辑 tools/business/*.txt）\n'
          'const BIZ = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('},{', '},\n{') + ';\n')
    (ROOT / 'business.js').write_text(js, encoding='utf-8')
    k = data['keigo']
    print('场景', len(data['scenes']), '邮件', len(data['mails']), '敬语', len(k['verbs']), len(k['rewrite']), len(k['set']),
          '词汇', sum(len(c['words']) for c in data['vocab']), 'bytes', len(js.encode()))


if __name__ == '__main__':
    main()
