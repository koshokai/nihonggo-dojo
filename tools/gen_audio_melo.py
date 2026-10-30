"""用 MeloTTS（https://github.com/myshell-ai/MeloTTS ，MIT 许可）生成韩语、英语发音（MP3），网页优先播放，没有时用浏览器朗读。

在 GitHub Actions 里运行（.github/workflows/melotts.yml）：
    python3 tools/gen_audio_melo.py ko basic        入门单词 + 常用句（tools/lang/ko.json）
    python3 tools/gen_audio_melo.py en levels       分级词库（lang/en-*.json）
    python3 tools/gen_audio_melo.py ko listen       听力对话（lang/ko-listen.json → audio/index-ko-listen.json）
    python3 tools/gen_audio_melo.py ko daily        今日一句、语法例句、阅读、商务表达（朗读文本 → audio/index-ko.json）

输出 audio/<语言>/<哈希>.mp3 和 audio/index-<语言>.json（朗读文本 → 文件）。生成过的跳过，可以断点续跑。
"""
import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'audio'
VOICE = {'ko': ('KR', 'KR'), 'en': ('EN', 'EN-US')}


def items(lang, which):
    if which == 'daily':
        L = lambda k: json.loads((ROOT / 'lang' / f'{lang}-{k}.json').read_text(encoding='utf-8')) if (ROOT / 'lang' / f'{lang}-{k}.json').exists() else []
        out = [d[0] for d in L('daily')]
        out += [s for g in L('grammar') for s, _ in g['eg']]
        out += [s for a in L('reading') for para in a['p'] for s, _ in para] + [w[0] for a in L('reading') for w in a['w']]
        biz = L('biz')
        out += [x[0] for sc in (biz['phrases'] if biz else []) for x in sc['items']]
        # 商务场景会话的对话、关键表达和商务词汇
        out += [l[1] for sc in (biz.get('scenes', []) if biz else []) for l in sc['lines']] + [x[0] for sc in (biz.get('scenes', []) if biz else []) for x in sc.get('phr', [])]
        out += [w[0] for c in (biz.get('vocab', []) if biz else []) for w in c['words']]
        # 影视名台词和生活小对话
        out += [l['t'] for w in L('quotes') for l in w['lines']] + [x[1] for w in L('quotes') for l in w['lines'] for x in l.get('talk', [])]
        return out
    if which == 'basic':
        d = json.loads((ROOT / 'tools' / 'lang' / f'{lang}.json').read_text(encoding='utf-8'))
        return [r[0] for r in d['words'] + d['phrases']]
    out = []
    for k, _, _ in json.loads((ROOT / 'lang' / f'{lang}-levels.json').read_text(encoding='utf-8')):
        out += [r[0] for r in json.loads((ROOT / 'lang' / f'{lang}-{k}.json').read_text(encoding='utf-8'))]
    return out


def commit(msg):
    subprocess.run(['git', 'add', 'audio'], cwd=ROOT, check=True)
    if subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=ROOT).returncode == 0:
        return
    subprocess.run(['git', 'commit', '-qm', msg], cwd=ROOT, check=True)
    for _ in range(3):
        if subprocess.run(['git', 'pull', '-q', '--rebase', '-X', 'theirs', 'origin', 'main'], cwd=ROOT).returncode == 0 and \
           subprocess.run(['git', 'push', '-q', 'origin', 'HEAD:main'], cwd=ROOT).returncode == 0:
            return
        time.sleep(5)
    sys.exit('push failed')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('lang', choices=['ko', 'en'])
    ap.add_argument('which', choices=['basic', 'levels', 'daily', 'listen'])
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--commit_every', type=int, default=0)
    a = ap.parse_args()
    from melo.api import TTS
    language, speaker = VOICE[a.lang]
    model = TTS(language=language, device='cpu')
    spk = model.hps.data.spk2id[speaker]
    if a.which == 'listen':
        return listen(a, model)
    idx_path = OUT / f'index-{a.lang}.json'
    idx = json.loads(idx_path.read_text(encoding='utf-8')) if idx_path.exists() else {}
    todo = [t for t in dict.fromkeys(items(a.lang, a.which)) if t not in idx]
    if a.limit:
        todo = todo[:a.limit]
    print(len(todo), 'to generate', flush=True)
    t0 = time.time()
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'x.wav'
        for n, text in enumerate(todo, 1):
            file = f'{a.lang}/{hashlib.sha1(text.encode()).hexdigest()[:16]}.mp3'
            try:
                # 单词读得稍慢一点，句子正常语速
                model.tts_to_file(text, spk, str(wav), speed=0.85 if len(text) < 12 else 0.95, quiet=True)
                (OUT / file).parent.mkdir(parents=True, exist_ok=True)
                subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav), '-ac', '1', '-b:a', '40k', str(OUT / file)], check=True)
            except Exception as e:
                print('  failed', repr(text), e, flush=True)
                continue
            idx[text] = file
            if n % 100 == 0:
                print(f'  {n}/{len(todo)}  {n / (time.time() - t0):.1f}/s', flush=True)
                idx_path.write_text(json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            if a.commit_every and n % a.commit_every == 0:
                commit(f'audio: {a.lang} {a.which} +{a.commit_every} (MeloTTS)')
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(a.lang, a.which, 'index', len(idx))


# 听力对话：和网页 listen.js 的 lsSegs 顺序相同。MeloTTS 每种口音只有一个声音，男声用降调区分；英语旁白用英式口音
NUM = {'ko': ['일 번', '이 번', '삼 번', '사 번'], 'en': ['One.', 'Two.', 'Three.', 'Four.']}
OTHER = {'M': 'F', 'F': 'M', 'M2': 'F', 'F2': 'M'}
SPOKEN = {'gaiyou', 'hatsuwa', 'sokuji'}


def segs(x, lang):
    s = []
    if x.get('intro'):
        s.append(['N', x['intro'], 1.2])
    for spk, line, _ in x['lines']:
        s.append([spk, line, 0.5])
    if x['lines']:
        s[-1][2] = 1.2
    if x.get('q') and x['t'] not in ('hatsuwa', 'sokuji'):
        s.append(['N', x['q'], 1.0])
    if x['t'] in SPOKEN:
        v = OTHER[x['lines'][0][0]] if x['t'] == 'sokuji' else 'N'
        for i, c in enumerate(x['c']):
            s.append(['N', NUM[lang][i], 0.3])
            s.append([v, c, 0.9])
    return s


def listen(a, model):
    import wave
    spk2id = model.hps.data.spk2id
    voice = {'ko': {'N': 'KR', 'F': 'KR', 'M': 'KR', 'F2': 'KR', 'M2': 'KR'},
             'en': {'N': 'EN-BR', 'F': 'EN-US', 'M': 'EN-AU', 'F2': 'EN-Default', 'M2': 'EN_INDIA'}}[a.lang]
    pitch = {'M': 0.82, 'M2': 0.88, 'F2': 1.06}       # 降调 = 男声
    idx_path = OUT / f'index-{a.lang}-listen.json'
    idx = json.loads(idx_path.read_text(encoding='utf-8')) if idx_path.exists() else {}
    data = json.loads((ROOT / 'lang' / f'{a.lang}-listen.json').read_text(encoding='utf-8'))
    with tempfile.TemporaryDirectory() as tmp:
        for n, x in enumerate([x for x in data if x['id'] not in idx], 1):
            pcm, rate = b'', 44100
            try:
                for k, (spk, text, pause) in enumerate(segs(x, a.lang)):
                    w1, w2 = Path(tmp) / f'{k}.wav', Path(tmp) / f'{k}p.wav'
                    model.tts_to_file(text, spk2id[voice.get(spk, voice['F'])], str(w1), speed=1.0, quiet=True)
                    f = pitch.get(spk)
                    if f:
                        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(w1), '-af', f'asetrate=44100*{f},aresample=44100,atempo={1 / f:.4f}', '-ac', '1', '-ar', '44100', str(w2)], check=True)
                    else:
                        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(w1), '-ac', '1', '-ar', '44100', str(w2)], check=True)
                    with wave.open(str(w2)) as w:
                        rate = w.getframerate(); pcm += w.readframes(w.getnframes())
                    pcm += b'\0\0' * int(rate * pause)
            except Exception as e:
                print('  failed', x['id'], e, flush=True)
                continue
            out = Path(tmp) / 'all.wav'
            with wave.open(str(out), 'wb') as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
            file = f"{a.lang}-listen/{x['id']}.mp3"
            (OUT / file).parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(out), '-ac', '1', '-b:a', '48k', str(OUT / file)], check=True)
            idx[x['id']] = file
            idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=0), encoding='utf-8')
            print(n, x['id'], flush=True)
    print(a.lang, 'listen index', len(idx))


if __name__ == '__main__':
    main()
