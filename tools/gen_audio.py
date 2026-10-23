"""用 VOICEVOX 引擎批量生成真人感的日语发音（MP3），供网页优先播放，没有音频时再退回浏览器朗读。

在 GitHub Actions 里运行（.github/workflows/voicevox.yml），本地也可以：先启动 VOICEVOX（桌面版或
docker run -p 50021:50021 voicevox/voicevox_engine:cpu-latest），然后
    python3 tools/gen_audio.py probe                       列出声音角色及使用规定，生成试听样本
    python3 tools/gen_audio.py words --speaker 14 --level N5
    python3 tools/gen_audio.py daily --speaker 14

输出 audio/<集合>/<哈希>.mp3，以及 audio/index-<集合>.json（朗读文本 → 文件）。已经生成过的会跳过，可以断点续跑。
VOICEVOX 的每个声音角色有自己的使用规定（多数要求注明「VOICEVOX:角色名」），见 probe 输出和网站「我的」页的致谢。
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'audio'


def api(engine, path, params=None, body=None, raw=False):
    url = engine.rstrip('/') + path + ('?' + urllib.parse.urlencode(params) if params else '')
    data = json.dumps(body).encode() if body is not None else (b'' if path in ('/audio_query', '/synthesis') else None)
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'},
                                 method='POST' if data is not None else 'GET')
    with urllib.request.urlopen(req, timeout=120) as r:
        b = r.read()
    return b if raw else json.loads(b)


def wait_engine(engine, timeout=300):
    t = time.time()
    while time.time() - t < timeout:
        try:
            return api(engine, '/version')
        except Exception:
            time.sleep(3)
    sys.exit('VOICEVOX engine not reachable at ' + engine)


def hira(s):
    return re.sub(r'[ァ-ヶ]', lambda c: chr(ord(c.group()) - 0x60), s)


def norm(s):
    return hira(re.sub(r'[\s、。！？!?「」・〜～ー]', '', s))


def mora_text(q):
    return ''.join(m['text'] for ap in q['accent_phrases'] for m in ap['moras'])


def synth(engine, speaker, surface, kana, speed=1.0):
    """先用汉字原文（重音更自然），读音和我们的假名对不上时改用假名，避免读错。"""
    q = api(engine, '/audio_query', {'text': surface, 'speaker': speaker})
    used = 'surface'
    if kana and norm(mora_text(q)) != norm(kana):
        q = api(engine, '/audio_query', {'text': kana, 'speaker': speaker})
        used = 'kana'
    q['speedScale'] = speed
    q['outputSamplingRate'] = 24000
    wav = api(engine, '/synthesis', {'speaker': speaker}, body=q, raw=True)
    return wav, used


def to_mp3(wav, path, kbps=40):
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', '-', '-ac', '1', '-b:a', f'{kbps}k', str(path)],
                   input=wav, check=True)


def js_json(name, start):
    t = (ROOT / name).read_text(encoding='utf-8')
    i = t.index(start) + len(start) - 1
    return json.loads(t[i:t.rindex(';')])


def items_words(level):
    vocab = js_json('vocab.js', 'VOCAB_DATA = {')
    out = []
    for L in ([level] if level else vocab):
        for w, r, *_ in vocab[L]:
            if re.search(r'[～〜(（]', w + r):
                continue
            out.append((r, w, r))                  # key = 网页朗读时传的文本（单词是假名读音）
    return out


def items_daily():
    return [(d[8], d[0], d[1]) for d in js_json('daily.js', 'DAILY = [')]


def generate(engine, speaker, name, items, speed, commit_every=0):
    idx_path = OUT / f'index-{name}.json'
    idx = json.loads(idx_path.read_text(encoding='utf-8')) if idx_path.exists() else {}
    # 同一个假名对应好几个词（箸 / 橋）时，用汉字会把某一个的重音套给所有人，所以只用假名
    surfaces = {}
    for key, surface, kana in items:
        surfaces.setdefault(key, set()).add(surface)
    todo = [(k, s, kn) for k, s, kn in items if k not in idx]
    seen = set()
    t0, n, by_kana = time.time(), 0, 0
    for key, surface, kana in todo:
        if key in seen:
            continue
        seen.add(key)
        file = f'{name}/{hashlib.sha1(key.encode()).hexdigest()[:16]}.mp3'
        src = surface if len(surfaces[key]) == 1 else kana
        try:
            wav, used = synth(engine, speaker, src, kana, speed)
        except Exception as e:
            print('  failed', key, e)
            continue
        to_mp3(wav, OUT / file)
        idx[key] = file
        n += 1
        by_kana += used == 'kana' or src == kana
        if n % 200 == 0:
            print(f'  {n}/{len(todo)}  {n / (time.time() - t0):.1f}/s', flush=True)
            idx_path.write_text(json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        if commit_every and n % commit_every == 0:
            commit(f'audio: {name} +{commit_every}')
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{name}: {n} new files, {by_kana} synthesised from kana, index {len(idx)}')


def commit(msg):
    """在 Actions 里分批提交，任务中途被停掉也不会白跑。"""
    subprocess.run(['git', 'add', 'audio'], cwd=ROOT, check=True)
    if subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=ROOT).returncode == 0:
        return
    subprocess.run(['git', 'commit', '-qm', msg], cwd=ROOT, check=True)
    for _ in range(3):
        if subprocess.run(['git', 'pull', '-q', '--rebase', 'origin', 'main'], cwd=ROOT).returncode == 0 and \
           subprocess.run(['git', 'push', '-q', 'origin', 'HEAD:main'], cwd=ROOT).returncode == 0:
            return
        time.sleep(5)
    sys.exit('push failed')


def probe(engine):
    """列出每个声音角色的使用规定，并用同一句话给每个角色的「ノーマル」风格生成试听样本。"""
    speakers = api(engine, '/speakers')
    report, sample = [], '今日はいい天気ですね。駅まで一緒に歩きましょう。'
    for sp in speakers:
        info = api(engine, '/speaker_info', {'speaker_uuid': sp['speaker_uuid']})
        policy = re.sub(r'\s+', ' ', info.get('policy', ''))
        styles = {s['name']: s['id'] for s in sp['styles']}
        sid = styles.get('ノーマル', next(iter(styles.values())))
        wav, _ = synth(engine, sid, sample, '')
        f = f'samples/{sid:03d}-{sp["name"]}.mp3'
        to_mp3(wav, OUT / f, kbps=48)
        report.append({'name': sp['name'], 'styles': styles, 'sample': f, 'policy': policy[:1500]})
        print(f'{sp["name"]:12s} {styles}')
    (OUT / 'samples' / 'speakers.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['probe', 'words', 'daily'])
    ap.add_argument('--engine', default='http://127.0.0.1:50021')
    ap.add_argument('--speaker', type=int, default=None)
    ap.add_argument('--level', default='')
    ap.add_argument('--speed', type=float, default=1.0)
    ap.add_argument('--commit_every', type=int, default=0)
    a = ap.parse_args()
    print('engine', wait_engine(a.engine))
    if a.mode == 'probe':
        return probe(a.engine)
    if a.speaker is None:
        sys.exit('--speaker is required')
    items = items_words(a.level) if a.mode == 'words' else items_daily()
    generate(a.engine, a.speaker, 'words' if a.mode == 'words' else 'daily', items, a.speed, a.commit_every)
    (OUT / 'voice.json').write_text(json.dumps({'speaker': a.speaker}), encoding='utf-8')


if __name__ == '__main__':
    main()
