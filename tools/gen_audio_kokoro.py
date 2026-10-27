"""英语发音：Kokoro（https://huggingface.co/hexgrad/Kokoro-82M ，Apache 2.0，可商用）。比 MeloTTS 自然，有多个美音/英音男女声。

在 GitHub Actions 里运行（.github/workflows/kokoro.yml），可以分片并行：
    python3 tools/gen_audio_kokoro.py text --shard 0 --shards 4     单词、常用句、今日一句、例句、阅读、商务（→ audio/en-k/，index-en.json）
    python3 tools/gen_audio_kokoro.py listen                         听力对话，多个声音（→ audio/en-listen/，index-en-listen.json）

分片各自写 audio/index-en.<分片>.json，最后 merge 合并成 index-en.json，并删除 MeloTTS 生成的旧英语音频。
"""
import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'audio'
sys.path.insert(0, str(ROOT / 'tools'))
VOICE = {'N': 'bf_emma', 'F': 'af_heart', 'M': 'am_michael', 'F2': 'af_bella', 'M2': 'bm_george'}
WORD_VOICE = 'af_heart'


def texts():
    from gen_audio_melo import items
    out = items('en', 'basic') + items('en', 'daily') + items('en', 'levels')
    return list(dict.fromkeys(t for t in out if t and t.strip()))


def to_mp3(wav_path, mp3_path, kbps=40):
    mp3_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav_path), '-ac', '1', '-b:a', f'{kbps}k', str(mp3_path)], check=True)


def synth(pipe, text, voice, speed=1.0):
    import numpy as np
    audio = [a for _, _, a in pipe(text, voice=voice, speed=speed)]
    return np.concatenate([a.numpy() if hasattr(a, 'numpy') else a for a in audio]) if audio else None


def write_wav(path, samples, rate=24000):
    import numpy as np
    pcm = (np.clip(samples, -1, 1) * 32767).astype('<i2').tobytes()
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)


def run_text(shard, shards):
    from kokoro import KPipeline
    pipe = KPipeline(lang_code='a')
    todo = [t for i, t in enumerate(texts()) if i % shards == shard]
    idx = {}
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'x.wav'
        for n, text in enumerate(todo, 1):
            try:
                a = synth(pipe, text, WORD_VOICE, speed=0.9 if len(text) < 14 else 1.0)
                if a is None:
                    continue
                write_wav(wav, a)
                file = f'en-k/{hashlib.sha1(text.encode()).hexdigest()[:16]}.mp3'
                to_mp3(wav, OUT / file)
                idx[text] = file
            except Exception as e:
                print('  failed', repr(text), e, flush=True)
            if n % 500 == 0:
                print(f'  shard {shard}: {n}/{len(todo)}', flush=True)
    (OUT / f'index-en.{shard}.json').write_text(json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('shard', shard, len(idx))


def run_listen():
    import numpy as np
    from kokoro import KPipeline
    from gen_audio_melo import segs
    pipes = {'a': KPipeline(lang_code='a'), 'b': KPipeline(lang_code='b')}
    data = json.loads((ROOT / 'lang' / 'en-listen.json').read_text(encoding='utf-8'))
    idx = {}
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'x.wav'
        for x in data:
            parts = []
            try:
                for spk, text, pause in segs(x, 'en'):
                    v = VOICE.get(spk, VOICE['F'])
                    a = synth(pipes[v[0]], text, v)
                    if a is not None:
                        parts += [a, np.zeros(int(24000 * pause), dtype=np.float32)]
                write_wav(wav, np.concatenate(parts))
                file = f"en-listen/{x['id']}.mp3"
                to_mp3(wav, OUT / file, kbps=48)
                idx[x['id']] = file
                print(x['id'], flush=True)
            except Exception as e:
                print('  failed', x['id'], e, flush=True)
    (OUT / 'index-en-listen.json').write_text(json.dumps(idx, ensure_ascii=False, indent=0), encoding='utf-8')


def merge():
    idx = {}
    for f in sorted(OUT.glob('index-en.*.json')):
        idx.update(json.loads(f.read_text(encoding='utf-8')))
        f.unlink()
    (OUT / 'index-en.json').write_text(json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    # MeloTTS 的旧英语音频不再引用
    old = OUT / 'en'
    if old.exists():
        for f in old.glob('*.mp3'):
            f.unlink()
    print('index-en', len(idx))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['text', 'listen', 'merge'])
    ap.add_argument('--shard', type=int, default=0)
    ap.add_argument('--shards', type=int, default=1)
    a = ap.parse_args()
    if a.mode == 'text':
        run_text(a.shard, a.shards)
    elif a.mode == 'listen':
        run_listen()
    else:
        merge()
