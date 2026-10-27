"""用 MeloTTS（https://github.com/myshell-ai/MeloTTS ，MIT 许可）生成韩语、英语发音（MP3），网页优先播放，没有时用浏览器朗读。

在 GitHub Actions 里运行（.github/workflows/melotts.yml）：
    python3 tools/gen_audio_melo.py ko basic        入门单词 + 常用句（tools/lang/ko.json）
    python3 tools/gen_audio_melo.py en levels       分级词库（lang/en-*.json）

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
    ap.add_argument('which', choices=['basic', 'levels'])
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--commit_every', type=int, default=0)
    a = ap.parse_args()
    from melo.api import TTS
    language, speaker = VOICE[a.lang]
    model = TTS(language=language, device='cpu')
    spk = model.hps.data.spk2id[speaker]
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


if __name__ == '__main__':
    main()
