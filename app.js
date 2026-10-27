'use strict';
/* 日语道场 — 纯前端应用。数据见 data.js，进度保存在 localStorage。 */

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const DAY = 86400000;
const KEY = 'nihongo-dojo:v1';
const main = document.getElementById('main');

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (a, n) => shuffle(a).slice(0, n);
const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const SPEAK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const speakBtn = (text, label) => `<button class="speak" type="button" data-say="${esc(text)}" aria-label="${esc(label || '朗读')}">${SPEAK_SVG}</button>`;
// 例句：把单词（动词、形容词取词干）在句子里标出来
// 例句：优先用这个词的专属例句；没有的话，从全站例句库（单词例句 + 语法例句）里找含这个词的句子
const exList = w => {
  const own = (typeof EXAMPLES !== 'undefined' && EXAMPLES[w]) || [];
  if (own.length >= 3 || typeof sentencesWith !== 'function' || w.length < 2 && !/[\u4e00-\u9fff]/.test(w)) return own;
  const seen = new Set(own.map(x => x[0]));
  const more = sentencesWith(w.length > 1 && /[るうくすつぬむぶぐい]$/.test(w) ? w.slice(0, -1) : w, 5).filter(x => !seen.has(x.jp)).map(x => [x.jp, x.kana, x.zh]);
  return own.concat(more).slice(0, 5);
};
function markWord(jp, w) {
  const stem = w.length > 1 && /[るうくすつぬむぶぐい]$/.test(w) ? w.slice(0, -1) : w.replace(/する$/, '');
  const i = jp.indexOf(stem);
  return i < 0 ? esc(jp) : esc(jp.slice(0, i)) + '<mark>' + esc(stem) + '</mark>' + esc(jp.slice(i + stem.length));
}
const exHTML = (w, n = 5) => exList(w).slice(0, n).map(([jp, kana, zh]) => `<div class="ex"><div style="flex:1;min-width:0"><div class="jp" lang="ja">${markWord(jp, w)}</div><div class="small muted">${esc(zh)}</div></div>${speakBtn(kana, '朗读例句')}</div>`).join('');

/* ---------- 数据 ---------- */
const VOCAB = {}, KANJI = {}, GRAM = {}, ITEMS = {};
// 早期版本手写的汉字中文释义，作为补充显示
const KANJI_ZH = {};
LEVELS.forEach(L => KANJI_RAW[L].trim().split('\n').forEach(l => { const p = l.split('|'); KANJI_ZH[p[0]] = p[3]; }));
for (const L of LEVELS) {
  const used = new Set();
  VOCAB[L] = VOCAB_DATA[L].map(([w, r, m, en, alt]) => {
    const id = used.has(w) ? `v|${L}|${w}|${r}` : `v|${L}|${w}`;
    used.add(w);
    // 词缀（～円）和带括号的条目只在词表里显示，不拿来出题
    return { id, type: 'v', L, w, r, m, en: en || '', alt: alt || [], q: !/[～〜(（]/.test(w + r) };
  });
  KANJI[L] = KANJI_DATA[L].map(([k, on, kun, en, strokes]) => ({ id: `k|${L}|${k}`, type: 'k', L, k, on, kun, en, strokes, zh: KANJI_ZH[k] || '' }));
  // 每个句型 3–5 句例句：eg = [{s: 带 [填空] 的句子, kana, t: 译文, frag, full, blank}]
  GRAM[L] = GRAMMAR_DATA[L].map(g => ({
    id: `g|${L}|${g.p}`, type: 'g', L, p: g.p, m: g.m, how: g.how, ex: g.ex,
    eg: g.eg.map(([s, kana, t]) => ({ s, kana, t, frag: s.match(/\[(.+?)\]/)[1], full: s.replace(/[[\]]/g, ''), blank: s.replace(/\[.+?\]/, '＿＿＿') }))
  }));
  [...VOCAB[L], ...KANJI[L], ...GRAM[L]].forEach(it => { ITEMS[it.id] = it; });
}

// 学习顺序：原始词表按假名排序，直接按顺序出题会一关全是同一个音开头的词。
// 每个级别用固定种子打乱一次（每次打开都一样，进度不会乱），闯关和背新词都按这个顺序。
function seededShuffle(arr, seed) {
  const a = arr.slice();
  let t = seed >>> 0;
  const rnd = () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const LEARN = {};
LEVELS.forEach((L, i) => { LEARN[L] = seededShuffle(VOCAB[L], 20261023 + i * 7919); });

/* 假名 */
const KANA_BASIC = [
  [['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o']],
  [['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko']],
  [['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so']],
  [['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to']],
  [['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no']],
  [['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho']],
  [['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo']],
  [['や', 'ya'], null, ['ゆ', 'yu'], null, ['よ', 'yo']],
  [['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro']],
  [['わ', 'wa'], null, null, null, ['を', 'wo']],
  [['ん', 'n'], null, null, null, null]
];
const KANA_DAKU = [
  [['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go']],
  [['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo']],
  [['だ', 'da'], ['ぢ', 'ji'], ['づ', 'zu'], ['で', 'de'], ['ど', 'do']],
  [['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo']],
  [['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po']]
];
const KANA_YOON = [['き', 'ky'], ['し', 'sh'], ['ち', 'ch'], ['に', 'ny'], ['ひ', 'hy'], ['み', 'my'], ['り', 'ry'], ['ぎ', 'gy'], ['じ', 'j'], ['び', 'by'], ['ぴ', 'py']]
  .map(([c, r]) => [['ゃ', 'a'], ['ゅ', 'u'], ['ょ', 'o']].map(([s, v]) => [c + s, r + v]));
const toKata = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
const kanaList = set => (set === 'basic' ? KANA_BASIC : set === 'daku' ? KANA_DAKU : KANA_YOON).flat().filter(Boolean);

const RANKS = [
  [0, '入門者', '入门者'], [200, '初心者', '初学者'], [600, '見習い', '见习生'], [1500, '弟子', '弟子'],
  [3000, '中級者', '中级者'], [6000, '上級者', '高级者'], [10000, '達人', '达人'], [20000, '師範', '师范']
];

/* ---------- 进度存储 ---------- */
// 词表扩充后，旧版本的单词 id 可能换了级别或写法：按单词（及常见写法对应）找到新 id
const OLD_ALIAS = { 'ご飯': '御飯', '勉強する': '勉強', 'おいしい': '美味しい', 'きれい': '綺麗', 'せっかく': '折角', '曖昧': 'あいまい', '夥しい': 'おびただしい', 'もっぱら': '専ら', 'あらかじめ': '予め', 'おのずから': '自ずから', '落る': '落ちる', '楽む': '楽しむ', '下る': '下がる', '清む': '澄む', '所為': 'せい', '押える': '押さえる', '下す': '下ろす', '可愛そう': '可哀想', '代る': '代わる', '当り': '当たり', '付合う': '付き合う', '知合い': '知り合い', '釣': '釣り', '年寄': '年寄り', '塵': 'ごみ', '浮ぶ': '浮かぶ', '売行き': '売れ行き', '落着く': '落ち着く', '落し物': '落とし物', '書取': '書き取り', '卒直': '率直', 'タイア': 'タイヤ', '田ぼ': '田んぼ', '傾らか': 'なだらか', '剥す': '剥がす', '引受る': '引き受ける', '引算': '引き算', '陽射': '陽射し', '日日': '日にち', '湯飲': '湯飲み', 'レクリェーション': 'レクリエーション', 'こくせき': '国籍', 'つうか': '通貨', 'ひゃっかじてん': '百科事典', '仕上': '仕上げ', '仕掛': '仕掛け', '情無い': '情けない', '情深い': '情け深い', '馴々しい': '馴れ馴れしい', '落葉': '落ち葉', '賭': '賭け', '箇条書': '箇条書き', '交す': '交わす', '代る代る': '代わる代わる', '兆': '兆し', '切替': '切り替え', '口吟む': '口ずさむ', '仕組': '仕組み', 'イェス': 'イエス', '蒸溜': '蒸留', '損う': '損なう', '断える': '絶える', '月並': '月並み', '突っ突く': '突っつく', 'ティシュペーパー': 'ティッシュペーパー', '割込む': '割り込む', '見せ物': '見世物', '夜更し': '夜更かし' };
function migrateIds() {
  const byWord = {};
  LEVELS.forEach(L => VOCAB[L].forEach(v => { if (!byWord[v.w]) byWord[v.w] = v.id; }));
  for (const store of [S.srs, S.wrong]) {
    for (const id of Object.keys(store)) {
      if (id.startsWith('k|') && !ITEMS[id]) { const ch = id.split('|')[2]; const L2 = LEVELS.find(L => KANJI[L].some(k => k.k === ch)); if (L2 && !store[`k|${L2}|${ch}`]) store[`k|${L2}|${ch}`] = store[id]; delete store[id]; continue; }
      if (id.startsWith('g|') && !ITEMS[id]) { delete store[id]; continue; }
      if (!id.startsWith('v|') || ITEMS[id]) continue;
      const w = id.split('|')[2], nid = byWord[OLD_ALIAS[w] || w];
      if (nid && !store[nid]) store[nid] = store[id];
      delete store[id];
    }
  }
}
const blank = () => ({ xp: 0, days: {}, goal: 50, newPerDay: 10, level: 'N5', srs: {}, wrong: {}, badges: {}, exams: [], kanaRight: 0, goalDays: {}, newLog: {}, best: 0, fixed: 0, theme: '', onboarded: false, rate: .8, voice: '', petals: true, autoSpeak: true, lastBackup: 0, lastBackupXp: 0, stages: {}, games: {}, read: {}, biz: {}, voiceSrc: 'vv' });
function load() {
  try { const t = localStorage.getItem(KEY); if (t) return Object.assign(blank(), JSON.parse(t)); } catch (e) { /* 浏览器禁用存储时从空进度开始 */ }
  return blank();
}
let S = load();
if (S.xp > 0) S.onboarded = true;
migrateIds();
let storageOk = true;
function save() {
  S.modAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; } catch (e) { storageOk = false; }
  if (typeof cloudQueue === 'function') cloudQueue();   // 登录了账号就自动同步到云端
}

const dkey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
function streak() {
  const d = new Date(); let n = 0;
  if (!(S.days[dkey(d)] > 0)) d.setDate(d.getDate() - 1);
  while (S.days[dkey(d)] > 0) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const todayXP = () => S.days[dkey()] || 0;
const rankOf = xp => { let i = 0; RANKS.forEach((r, j) => { if (xp >= r[0]) i = j; }); return i; };

function addXP(n) {
  if (n <= 0) return;
  const k = dkey(), before = todayXP();
  S.xp += n; S.days[k] = before + n;
  S.best = Math.max(S.best, streak());
  const r0 = rankOf(S.xp - n), r1 = rankOf(S.xp);
  if (S.days[k] >= S.goal && !S.goalDays[k]) {
    S.goalDays[k] = 1; celebrate(); toast(`今日目标 ${S.goal} 经验达成！连续 ${streak()} 天`);
  } else if (r1 > r0) {
    celebrate(); toast(`升级：${RANKS[r1][1]}（${RANKS[r1][2]}）`);
  }
  checkBadges(); save(); updateTop();
}

/* ---------- 成就印章 ---------- */
const learned = v => { const c = S.srs[v.id]; return c && c.r > 0; };
const mastered = v => { const c = S.srs[v.id]; return c && c.i >= 21; };
const allVocab = () => LEVELS.flatMap(L => VOCAB[L]);
const BADGES = [
  { id: 'first', ch: '始', name: '第一步', desc: '获得第一份经验', test: () => S.xp > 0 },
  { id: 's3', ch: '三', name: '三日连续', desc: '连续学习 3 天', test: () => S.best >= 3 },
  { id: 's7', ch: '七', name: '一周不断', desc: '连续学习 7 天', test: () => S.best >= 7 },
  { id: 's30', ch: '卅', name: '月之坚持', desc: '连续学习 30 天', test: () => S.best >= 30 },
  { id: 'goal7', ch: '勤', name: '勤勉', desc: '累计 7 天达成每日目标', test: () => Object.keys(S.goalDays).length >= 7 },
  { id: 'kana', ch: '仮', name: '假名达人', desc: '假名测验累计答对 100 次', test: () => S.kanaRight >= 100 },
  { id: 'w50', ch: '語', name: '五十词', desc: '学过 50 个单词', test: () => allVocab().filter(learned).length >= 50 },
  { id: 'w200', ch: '辞', name: '二百词', desc: '学过 200 个单词', test: () => allVocab().filter(learned).length >= 200 },
  { id: 'm50', ch: '極', name: '牢记于心', desc: '掌握 50 个单词（复习间隔 ≥ 21 天）', test: () => allVocab().filter(mastered).length >= 50 },
  { id: 'fix', ch: '改', name: '知错能改', desc: '订正 20 道错题', test: () => S.fixed >= 20 },
  { id: 'pass', ch: '合', name: '合格', desc: '任意级别模拟考合格（≥ 60%）', test: () => S.exams.some(e => e.score / e.total >= .6) },
  { id: 'full', ch: '満', name: '满分', desc: '模拟考拿到满分', test: () => S.exams.some(e => e.score === e.total) },
  { id: 'r5', ch: '読', name: '小书虫', desc: '读完 5 篇阅读', test: () => Object.keys(S.read || {}).length >= 5 },
  { id: 'r30', ch: '書', name: '博览群书', desc: '读完 30 篇阅读', test: () => Object.keys(S.read || {}).length >= 30 },
  { id: 'biz5', ch: '商', name: '职场新人', desc: '完成 5 个商务场景', test: () => Object.keys((S.biz || {}).s || {}).length >= 5 },
  { id: 'n1', ch: '頂', name: '登顶', desc: 'N1 模拟考合格', test: () => S.exams.some(e => e.L === 'N1' && e.score / e.total >= .6) }
];
function checkBadges() {
  for (const b of BADGES) {
    if (!S.badges[b.id] && b.test()) { S.badges[b.id] = dkey(); toast(`获得印章「${b.ch}・${b.name}」`); celebrate(); }
  }
}

/* ---------- 发音 ---------- */
// 浏览器自带语音质量参差不齐：优先选「Natural / Online / Google」这类较自然的日语语音，
// 朗读一律用假名读音（见 data.js），避免把汉字读错。
const hasTTS = 'speechSynthesis' in window;
const jaVoices = () => hasTTS ? speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang)) : [];
const voiceScore = v => (/Natural|Neural/i.test(v.name) ? 40 : 0) + (/Online/i.test(v.name) ? 20 : 0) + (/Google/i.test(v.name) ? 15 : 0) + (/Nanami|Keita|Kyoko|O-ren|Hattori|Otoya/i.test(v.name) ? 10 : 0) + (v.localService ? 0 : 3);
function currentVoice() {
  const vs = jaVoices();
  return vs.find(v => v.name === S.voice) || vs.sort((a, b) => voiceScore(b) - voiceScore(a))[0] || null;
}
let warnedVoice = false;
// Chrome 的已知问题：cancel() 之后马上 speak() 偶尔会被吞掉；长时间不用后引擎会卡在暂停状态；
// utterance 被回收后会中途没声音。所以：保留引用、先 resume()、正在读时隔一小会儿再读，没开始就重试一次。
let curUtt = null, speakSeq = 0;
// VOICEVOX 预生成的音频（audio/index-*.json：朗读文本 → mp3）。有就优先播放，没有或加载失败退回浏览器朗读。
const AUDIO_IDX = {};
let curAudio = null;
['words', 'daily'].forEach(n => fetch(`audio/index-${n}.json`).then(r => r.ok ? r.json() : {}).then(d => Object.assign(AUDIO_IDX, d)).catch(() => {}));
function stopSpeech() {
  if (curAudio) { curAudio.onended = curAudio.onerror = null; curAudio.pause(); curAudio = null; }
  if (hasTTS) speechSynthesis.cancel();
}
function speak(text, opts = {}) {
  const file = S.voiceSrc !== 'tts' && AUDIO_IDX[text];
  if (file) {
    stopSpeech(); ++speakSeq;
    const a = new Audio('audio/' + file);
    // 语速设置是给浏览器朗读定的（默认 0.8）；真人音频本来就慢一些，整体上调 0.2
    a.playbackRate = Math.min(1.5, Math.max(0.5, (opts.rate || S.rate) + 0.2));
    let fell = false;
    const fallback = () => { if (fell) return; fell = true; curAudio = null; speakTTS(text, opts); };
    a.onended = () => { if (curAudio === a) curAudio = null; if (opts.onend) opts.onend(); };
    a.onerror = fallback;
    curAudio = a;
    a.play().catch(fallback);
    return;
  }
  if (curAudio) { curAudio.pause(); curAudio = null; }
  speakTTS(text, opts);
}
function speakTTS(text, opts = {}) {
  if (!hasTTS) { if (!warnedVoice) { warnedVoice = true; toast('这个浏览器不支持朗读'); } return; }
  const clean = text.replace(/[～~＿[\]]/g, '');
  const seq = ++speakSeq;
  const make = () => {
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'ja-JP';
    // 句子比单词再慢一点，方便跟读
    u.rate = (opts.rate || S.rate) * (clean.length > 8 ? .95 : 1);
    u.pitch = 1;
    const v = currentVoice(); if (v) u.voice = v;
    let started = false;
    u.onstart = () => { started = true; };
    u.onend = u.onerror = e => { if (curUtt === u) curUtt = null; if (opts.onend && !(e && e.error === 'interrupted' && seq !== speakSeq)) opts.onend(); };
    u.check = () => started;
    return u;
  };
  const go = (retry) => {
    if (seq !== speakSeq) return;
    const u = make(); curUtt = u;
    try { speechSynthesis.resume(); } catch (e) { /* 忽略 */ }
    speechSynthesis.speak(u);
    // 0.9 秒还没开始读，多半是被吞了：再试一次
    if (retry) setTimeout(() => { if (seq === speakSeq && curUtt === u && !u.check() && !speechSynthesis.speaking) { speechSynthesis.cancel(); setTimeout(() => go(false), 60); } }, 900);
  };
  const busy = speechSynthesis.speaking || speechSynthesis.pending;
  if (busy) { speechSynthesis.cancel(); setTimeout(() => go(true), 80); } else go(true);
  if (!currentVoice() && speechSynthesis.getVoices().length && !warnedVoice) { warnedVoice = true; toast('没有找到日语语音，可以在系统设置里添加日语语音包'); }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-say]');
  if (b) { e.stopPropagation(); speak(b.dataset.say); b.classList.remove('talk'); void b.offsetWidth; b.classList.add('talk'); }
}, true);

/* ---------- 小部件 ---------- */
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function drawPetal(ctx, r, color) {
  // 樱花花瓣：一头圆、一头带小缺口
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * .9, -r * .7, r * .8, r * .6, 0, r);
  ctx.bezierCurveTo(-r * .8, r * .6, -r * .9, -r * .7, 0, -r);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.moveTo(-r * .18, -r); ctx.lineTo(0, -r * .72); ctx.lineTo(r * .18, -r); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}
const petalColors = () => [tok('--sakura'), tok('--sakura-2'), tok('--sakura-3')];

// 一次性的花瓣喷发：庆祝（全屏）或答对（从某个元素冒出来）
let burst = [], burstRAF = 0;
function petalBurst(x, y, n, power) {
  if (reduceMotion()) return;
  const cv = document.getElementById('confetti'), ctx = cv.getContext('2d');
  const dpr = devicePixelRatio || 1;
  if (cv.width !== innerWidth * dpr) { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  const cols = petalColors();
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2, sp = (Math.random() * .7 + .3) * power;
    burst.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - power * .6, r: Math.random() * 5 + 5, a: Math.random() * 6, va: (Math.random() - .5) * .25, c: cols[i % cols.length], life: 0, max: 90 + Math.random() * 60 });
  }
  if (burstRAF) return;
  const frame = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    burst = burst.filter(p => p.life < p.max);
    for (const p of burst) {
      p.life++; p.vy += .12; p.vx *= .985; p.vy *= .985; p.x += p.vx + Math.sin(p.life / 9) * .6; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.globalAlpha = Math.min(1, (p.max - p.life) / 30); ctx.translate(p.x, p.y); ctx.rotate(p.a); drawPetal(ctx, p.r, p.c); ctx.restore();
    }
    burstRAF = burst.length ? requestAnimationFrame(frame) : (ctx.clearRect(0, 0, innerWidth, innerHeight), 0);
  };
  burstRAF = requestAnimationFrame(frame);
}
function celebrate() { petalBurst(innerWidth / 2, innerHeight * .4, 90, 11); bounceNeko(); }
function popFrom(el) { const r = el.getBoundingClientRect(); petalBurst(r.left + r.width / 2, r.top + r.height / 2, 16, 5); }

// 背景里缓缓飘落的樱花，可在「我的」关闭
let ambient = null;
function startPetals() {
  stopPetals();
  if (!S.petals || reduceMotion()) return;
  const cv = document.getElementById('petals'), ctx = cv.getContext('2d');
  let W, H; const dpr = devicePixelRatio || 1;
  const size = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; };
  size(); addEventListener('resize', size);
  const cols = petalColors();
  const n = Math.round(Math.min(22, Math.max(10, innerWidth / 60)));
  const ps = Array.from({ length: n }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 4 + 5, s: Math.random() * .4 + .35, ph: Math.random() * 6, a: Math.random() * 6, va: (Math.random() - .5) * .02, c: cols[i % cols.length] }));
  let last = performance.now(), raf;
  const frame = t => {
    const dt = Math.min(50, t - last) / 16; last = t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.ph += .012 * dt; p.y += p.s * dt; p.x += Math.sin(p.ph) * .5 * dt; p.a += p.va * dt;
      if (p.y > H + 12) { p.y = -12; p.x = Math.random() * W; }
      ctx.save(); ctx.globalAlpha = .55; ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1, .75 + Math.sin(p.ph * 2) * .25); drawPetal(ctx, p.r, p.c); ctx.restore();
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  ambient = { stop: () => { cancelAnimationFrame(raf); removeEventListener('resize', size); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); } };
}
function stopPetals() { if (ambient) { ambient.stop(); ambient = null; } }
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPetals(); else startPetals(); });

// 招财猫吉祥物
function neko(mood = 'happy', cls = '') {
  const eyes = mood === 'sad'
    ? '<path d="M44 52 q5 5 10 0M66 52 q5 5 10 0" />'
    : mood === 'wow' ? '<circle cx="49" cy="50" r="3.2" class="nk-ink"/><circle cx="71" cy="50" r="3.2" class="nk-ink"/>'
    : '<path d="M44 52 q5 -6 10 0M66 52 q5 -6 10 0" />';
  return `<svg class="neko ${cls}" viewBox="0 0 120 130" aria-hidden="true">
    <g class="nk-body">
      <ellipse cx="60" cy="100" rx="34" ry="27" class="nk-fur"/>
      <ellipse cx="60" cy="104" rx="17" ry="14" class="nk-belly"/>
      <path d="M29 42 L35 13 L53 30 Z" class="nk-fur"/><path d="M91 42 L85 13 L67 30 Z" class="nk-fur"/>
      <path d="M35 33 L38 21 L46 29Z" class="nk-pink"/><path d="M85 33 L82 21 L74 29Z" class="nk-pink"/>
      <ellipse cx="60" cy="50" rx="35" ry="28" class="nk-fur"/>
      <g class="nk-line">${eyes}<path d="M54 62 q3 3 6 0 q3 3 6 0"/></g>
      <path d="M57.5 58 h5 l-2.5 2.6z" class="nk-pink"/>
      <circle cx="41" cy="61" r="5" class="nk-blush"/><circle cx="79" cy="61" r="5" class="nk-blush"/>
      <path d="M31 74 q29 13 58 0" class="nk-collar"/>
      <circle cx="60" cy="82" r="5" class="nk-bell"/>
      <ellipse cx="45" cy="122" rx="10" ry="6" class="nk-fur"/><ellipse cx="75" cy="122" rx="10" ry="6" class="nk-fur"/>
    </g>
    <g class="nk-paw"><ellipse cx="97" cy="66" rx="11" ry="14" class="nk-fur"/><path d="M92 58 v5M97 57 v5M102 58 v5" class="nk-line"/></g>
  </svg>`;
}
function bounceNeko() { document.querySelectorAll('.neko').forEach(n => { n.classList.remove('jump'); void n.getBoundingClientRect(); n.classList.add('jump'); }); }

function updateTop() {
  const s = streak();
  document.getElementById('streak-n').textContent = s;
  document.getElementById('chip-streak').classList.toggle('lit', todayXP() > 0);
  document.getElementById('xp-today').textContent = todayXP();
  document.getElementById('xp-goal').textContent = '/' + S.goal;
  document.getElementById('chip-xp').classList.toggle('lit', todayXP() >= S.goal);
  document.getElementById('chip-lv').textContent = S.level;
}
function applyTheme() {
  if (S.theme) document.documentElement.dataset.theme = S.theme; else delete document.documentElement.dataset.theme;
}
const levelSeg = (cur, attr = 'data-level') => `<div class="seg" role="group" aria-label="JLPT 级别">${LEVELS.map(L => `<button type="button" ${attr}="${L}" class="${L === cur ? 'on' : ''}" aria-pressed="${L === cur}">${L}</button>`).join('')}</div>`;

let keyHandler = null;
document.addEventListener('keydown', e => {
  if (!keyHandler || e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  keyHandler(e);
});
let examTimer = null;

/* ---------- SRS（间隔重复） ---------- */
function preview(c, g) {
  c = c || { i: 0, e: 2.5 };
  if (g === 0) return 0;
  if (g === 1) return c.i ? Math.max(1, Math.round(c.i * 1.2)) : 1;
  if (g === 2) return c.i === 0 ? 1 : c.i === 1 ? 3 : Math.round(c.i * c.e);
  return c.i === 0 ? 3 : Math.round(c.i * c.e * 1.3);
}
function grade(id, g) {
  const isNew = !S.srs[id];
  const c = Object.assign({ i: 0, e: 2.5, r: 0, due: 0 }, S.srs[id]);
  const next = preview(c, g);
  if (g === 0) { c.e = Math.max(1.3, c.e - .2); c.i = 0; c.due = Date.now(); }
  else {
    if (g === 1) c.e = Math.max(1.3, c.e - .15);
    if (g === 3) c.e += .15;
    c.i = next; c.r += 1; c.due = startOfToday() + next * DAY;
  }
  S.srs[id] = c;
  if (isNew) S.newLog[dkey()] = (S.newLog[dkey()] || 0) + 1;
}
const fmtDays = d => d === 0 ? '马上' : d === 1 ? '明天' : d < 30 ? `${d} 天` : d < 365 ? `${Math.round(d / 30)} 个月` : `${(d / 365).toFixed(1)} 年`;
const dueList = levels => levels.flatMap(L => VOCAB[L]).filter(v => S.srs[v.id] && S.srs[v.id].due <= Date.now());
const newLeft = () => Math.max(0, S.newPerDay - (S.newLog[dkey()] || 0));
const newList = L => LEARN[L].filter(v => !S.srs[v.id]);

function startCards(host, ids, title, onExit) {
  let queue = ids.slice(), done = 0, revealed = false;
  host.innerHTML = '';
  const box = h(`<section class="panel deck">
    <div class="row between"><h2>${esc(title)}</h2><button class="btn ghost" type="button" data-exit>结束</button></div>
    <div class="progress-top"><span class="small muted" data-left></span><div class="bar"><i data-bar style="width:0"></i></div></div>
    <div data-stage></div>
  </section>`);
  host.append(box);
  box.querySelector('[data-exit]').onclick = finish;
  const stage = box.querySelector('[data-stage]');
  function finish() { keyHandler = null; onExit(done); }
  function show() {
    const total = done + queue.length;
    box.querySelector('[data-left]').textContent = `剩余 ${queue.length}`;
    box.querySelector('[data-bar]').style.width = (total ? done / total * 100 : 100) + '%';
    if (!queue.length) {
      stage.innerHTML = `<div class="card" style="cursor:default"><div class="word" lang="ja">お疲れ様！</div><p class="meaning">这一组完成了，共 ${done} 张。</p><p class="hint">明天记得回来复习，间隔重复会安排好时间。</p></div>
        <div class="row" style="justify-content:center;margin-top:12px"><button class="btn pri" type="button" data-back>返回</button></div>`;
      stage.querySelector('[data-back]').onclick = finish;
      keyHandler = e => { if (e.key === 'Enter') finish(); };
      return;
    }
    const v = ITEMS[queue[0]], c = S.srs[v.id];
    revealed = false;
    stage.innerHTML = `<div class="card" data-card tabindex="0" role="button" aria-label="显示答案">
        <span class="corner tag ${c ? 'learn' : ''}">${c ? '复习' : '新词'} · ${v.L}</span>
        <span class="corner-r">${speakBtn(v.r, '朗读单词')}</span>
        <div class="word" lang="ja">${esc(v.w)}</div>
        <div data-ans hidden><div class="reading" lang="ja">${esc(v.r)}</div><div class="meaning">${esc(v.m)}</div></div>
        <div class="hint" data-hint>先想一想读音和意思，再点卡片看答案（空格键）</div>
      </div>
      <div class="ex-box" data-exbox hidden>${exList(v.w).length ? `<div class="eyebrow">例句</div>${exHTML(v.w)}` : ''}</div>
      <div class="grades" data-grades hidden style="margin-top:12px">
        ${['重来', '困难', '记得', '简单'].map((t, g) => `<button class="btn g${g}" type="button" data-g="${g}">${t}<small>${fmtDays(preview(c, g))}</small></button>`).join('')}
      </div>`;
    const card = stage.querySelector('[data-card]');
    const reveal = () => {
      if (revealed) return; revealed = true;
      stage.querySelector('[data-ans]').hidden = false; stage.querySelector('[data-hint]').hidden = true;
      stage.querySelector('[data-grades]').hidden = false; stage.querySelector('[data-exbox]').hidden = false; if (S.autoSpeak) speak(v.r);
    };
    card.onclick = reveal;
    stage.querySelectorAll('[data-g]').forEach(b => { b.onclick = () => rate(+b.dataset.g); });
    keyHandler = e => {
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
      else if (revealed && '1234'.includes(e.key)) rate(+e.key - 1);
    };
  }
  function rate(g) {
    const id = queue.shift();
    grade(id, g);
    if (g === 0) queue.splice(Math.min(queue.length, 3), 0, id); else done++;
    addXP(g === 0 ? 2 : 5);
    show();
  }
  show();
}

/* ---------- 题目生成 ---------- */
function distract(correct, pool, n = 3) {
  const out = [], seen = new Set([correct]);
  for (const x of shuffle(pool)) { if (!seen.has(x)) { seen.add(x); out.push(x); if (out.length === n) break; } }
  return out;
}
function makeQ(item, kind, opts, correct, extra) {
  const options = shuffle([correct, ...opts]);
  return Object.assign({ id: item ? item.id : null, kind, options, answer: options.indexOf(correct) }, extra);
}
const KIND_NAMES = { reading: '读音', meaning: '词义', word: '选词', kanji: '汉字', grammar: '语法', kana: '假名', listen: '听力' };
function qVocab(v, kind) {
  const same = VOCAB[v.L].filter(x => x.q), all = allVocab().filter(x => x.q);
  const near = (arr, fn) => arr.length >= 4 ? arr : all.map(fn);
  if (kind === 'reading' && v.w !== v.r) {
    // 干扰项：1 个长度相近的同级读音（有迷惑性）+ 2 个从全部级别随机抽的读音（避免四个选项长得都一样）
    const pool = same.filter(x => x.w !== x.r && x.r !== v.r).sort((a, b) => Math.abs(a.r.length - v.r.length) - Math.abs(b.r.length - v.r.length)).slice(0, 10).map(x => x.r);
    const far = sample(all.filter(x => x.w !== x.r && x.r !== v.r && x.r[0] !== v.r[0]), 12).map(x => x.r);
    const opts = [...new Set([...sample(near(pool, x => x.r), 1), ...far])].filter(r => r !== v.r).slice(0, 3);
    return makeQ(v, 'reading', opts, v.r, {
      prompt: `<div class="eyebrow">选择正确的读音</div><div class="q-big" lang="ja">${esc(v.w)}</div>`, optLang: 'ja', say: v.r,
      explain: `<span lang="ja">${esc(v.w)}（${esc(v.r)}）</span>：${esc(v.m)}${exTip(v.w)}`
    });
  }
  if (kind === 'listen') {
    return makeQ(v, 'listen', distract(v.w, same.filter(x => x.r !== v.r).map(x => x.w)), v.w, {
      prompt: `<div class="eyebrow">听发音，选出对应的单词</div><button class="listen" type="button" data-say="${esc(v.r)}" aria-label="再听一次">${SPEAK_SVG}<span>再听一次</span></button>`, optLang: 'ja', autoSay: v.r, say: v.r,
      explain: `<span lang="ja">${esc(v.w)}（${esc(v.r)}）</span>：${esc(v.m)}${exTip(v.w)}`
    });
  }
  if (kind === 'word') {
    return makeQ(v, 'word', distract(v.w, same.map(x => x.w)), v.w, {
      prompt: `<div class="eyebrow">哪个日语单词是这个意思？</div><div class="q-big" style="font-family:var(--f-ui);font-size:1.8rem">${esc(v.m)}</div>`, optLang: 'ja', say: v.r,
      explain: `<span lang="ja">${esc(v.w)}（${esc(v.r)}）</span>：${esc(v.m)}${exTip(v.w)}`
    });
  }
  return makeQ(v, 'meaning', distract(v.m, same.map(x => x.m)), v.m, {
    prompt: `<div class="eyebrow">这个单词是什么意思？</div><div class="q-big" lang="ja">${esc(v.w)}</div>`, say: v.r,
    explain: `<span lang="ja">${esc(v.w)}（${esc(v.r)}）</span>：${esc(v.m)}${exTip(v.w)}`
  });
}
function exTip(w) {
  const e = exList(w); if (!e.length) return '';
  const [jp, , zh] = e[Math.floor(Math.random() * e.length)];
  return `<br><span class="small"><span lang="ja">${esc(jp)}</span>　<span class="muted">${esc(zh)}</span></span>`;
}
// 含某个汉字的单词（只取能出题的词，按级别从易到难）
let kanjiWordIdx = null;
function wordsWith(ch) {
  if (!kanjiWordIdx) {
    kanjiWordIdx = {};
    for (const v of allVocab()) {
      if (!v.q || v.w === v.r) continue;
      for (const c of new Set(v.w)) if (c >= '一' && c <= '鿿') (kanjiWordIdx[c] = kanjiWordIdx[c] || []).push(v);
    }
  }
  return kanjiWordIdx[ch] || [];
}
// 中文母语者看字形就能猜到意思，所以汉字题只考读音
function qKanji(k) {
  const same = KANJI[k.L];
  const words = wordsWith(k.k);
  const kinds = [];
  if (k.on !== '—') kinds.push('on');
  if (k.kun !== '—') kinds.push('kun');
  if (words.length) kinds.push('word', 'word');
  const kind = sample(kinds.length ? kinds : ['on'], 1)[0];
  const exp = `<span lang="ja">${esc(k.k)}</span>　音读 <span lang="ja">${esc(k.on)}</span>　训读 <span lang="ja">${esc(k.kun)}</span>${k.zh ? '　' + esc(k.zh) : ''}`;
  if (kind === 'word') {
    const v = sample(words, 1)[0];
    const pool = allVocab().filter(x => x.q && x.w !== x.r && x.r !== v.r && Math.abs(x.r.length - v.r.length) <= 1).map(x => x.r);
    const marked = esc(v.w).replace(esc(k.k), `<span style="color:var(--ai)">${esc(k.k)}</span>`);
    return makeQ(k, 'kanji', distract(v.r, sample(pool, 40)), v.r, {
      prompt: `<div class="eyebrow">这个词怎么读？</div><div class="q-big" lang="ja">${marked}</div>`, optLang: 'ja', say: v.r,
      explain: `<span lang="ja">${esc(v.w)}（${esc(v.r)}）</span>：${esc(v.m)}<br>${exp}`
    });
  }
  const f = kind === 'on' ? 'on' : 'kun';
  return makeQ(k, 'kanji', distract(k[f], same.filter(x => x[f] !== '—').map(x => x[f])), k[f], {
    prompt: `<div class="eyebrow">这个汉字的${kind === 'on' ? '音读' : '训读'}是？</div><div class="q-big" lang="ja">${esc(k.k)}</div>`, optLang: 'ja', explain: exp
  });
}
function qGrammar(g, e) {
  if (!e || typeof e !== 'object') e = sample(g.eg, 1)[0];
  const own = new Set(g.eg.map(x => x.frag));
  const ok = x => !own.has(x) && !g.ex.includes(x);
  let pool = GRAM[g.L].filter(x => x !== g).map(x => sample(x.eg, 1)[0].frag).filter(ok);
  if (pool.length < 3) pool = pool.concat(LEVELS.flatMap(L => GRAM[L]).filter(x => x !== g).map(x => x.eg[0].frag).filter(ok));
  const sent = esc(e.blank).replace('＿＿＿', '<span class="blank">　？　</span>');
  return makeQ(g, 'grammar', distract(e.frag, pool), e.frag, {
    prompt: `<div class="eyebrow">选择填入空白处的内容</div><div class="q-sent" lang="ja">${sent}</div>`, optLang: 'ja', say: e.kana,
    explain: `<b lang="ja">${esc(g.p)}</b>：${esc(g.m)}<br><span lang="ja">${esc(e.full)}</span><br><span class="muted">${esc(e.t)}</span>`
  });
}
function qKana([kana, ro], reverse, pool) {
  if (reverse) {
    const opts = distract(kana, pool.filter(p => p[1] !== ro).map(p => p[0]));
    return makeQ(null, 'kana', opts, kana, { kanaRo: ro, prompt: `<div class="eyebrow">哪个假名读作</div><div class="q-big" style="font-family:var(--f-ui)">${esc(ro)}</div>`, optLang: 'ja', say: kana, explain: `<span lang="ja">${esc(kana)}</span> = ${esc(ro)}` });
  }
  return makeQ(null, 'kana', distract(ro, pool.map(p => p[1])), ro, { prompt: `<div class="eyebrow">这个假名怎么读？</div><div class="q-big" lang="ja">${esc(kana)}</div>`, say: kana, explain: `<span lang="ja">${esc(kana)}</span> = ${esc(ro)}` });
}
const itemQ = it => it.type === 'v' ? qVocab(it, sample(['reading', 'meaning', 'word'], 1)[0]) : it.type === 'k' ? qKanji(it) : qGrammar(it);

/* ---------- 测验引擎 ---------- */
function runQuiz(host, qs, { title, exam = false, minutes = 0, fromWrong = false, noRecord = false, xpEach = 10, hearts = 0, requeue = false, onDone }) {
  let i = 0, combo = 0, answered = false, life = hearts, failed = false;
  const requeued = new Set();
  const heartsHTML = () => hearts ? `<span class="hearts" aria-label="剩余 ${life} 条命">${Array.from({ length: hearts }, (_, k) => `<svg viewBox="0 0 24 24" class="${k < life ? 'on' : ''}"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.6 4.5c2 0 3.6 1.1 4.4 2.6.8-1.5 2.4-2.6 4.4-2.6 3.6 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z"/></svg>`).join('')}</span>` : '';
  const res = [];
  host.innerHTML = '';
  const box = h(`<section class="panel quiz">
    <div class="row between"><h2>${esc(title)}</h2><button class="btn ghost" type="button" data-exit>退出</button></div>
    <div class="progress-top"><span class="small" data-count></span><div class="bar"><i data-bar style="width:0"></i></div><span class="small" data-extra></span></div>
    <div data-stage class="quiz"></div>
  </section>`);
  host.append(box);
  const stage = box.querySelector('[data-stage]'), extra = box.querySelector('[data-extra]');
  box.querySelector('[data-exit]').onclick = () => { clearInterval(examTimer); keyHandler = null; onDone(null); };
  if (exam && minutes) {
    const end = Date.now() + minutes * 60000;
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      extra.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
      if (!left) { clearInterval(examTimer); while (res.length < qs.length) res.push({ q: qs[res.length], pick: -1, ok: false }); finish(); }
    };
    clearInterval(examTimer); examTimer = setInterval(tick, 500); tick();
  }
  function show() {
    const q = qs[i]; answered = false;
    box.querySelector('[data-count]').textContent = `${i + 1} / ${qs.length}`;
    box.querySelector('[data-bar]').style.width = (i / qs.length * 100) + '%';
    if (!exam) extra.innerHTML = (combo >= 3 ? `<span class="combo">${combo} 连对</span> ` : '') + heartsHTML();
    stage.innerHTML = `<div class="q-prompt pop">${q.prompt}</div>
      <div class="opts">${q.options.map((o, j) => `<button class="opt" type="button" data-o="${j}"><span class="k">${j + 1}</span><span ${q.optLang ? `lang="${q.optLang}"` : ''}>${esc(o)}</span></button>`).join('')}</div>
      <div data-fb></div>`;
    stage.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => pick(+b.dataset.o); });
    if (q.autoSay) speak(q.autoSay);
    keyHandler = e => {
      if (!answered && '1234'.includes(e.key) && +e.key <= q.options.length) pick(+e.key - 1);
      else if (answered && e.key === 'Enter') next();
    };
  }
  function pick(j) {
    if (answered) return; answered = true;
    const q = qs[i], ok = j === q.answer;
    res.push({ q, pick: j, ok });
    if (q.id && !noRecord) {
      if (!ok) S.wrong[q.id] = { n: ((S.wrong[q.id] || {}).n || 0) + 1, t: Date.now() };
      else if (fromWrong && S.wrong[q.id]) { delete S.wrong[q.id]; S.fixed++; }
    }
    if (q.kind === 'kana' && ok) S.kanaRight++;
    if (!ok && hearts) {
      life--;
      if (life <= 0) failed = true;
      else if (requeue && q.item && !requeued.has(q.id)) { requeued.add(q.id); qs.push(Object.assign(qVocab(q.item, q.kind), { item: q.item })); }
    }
    if (exam) { save(); next(); return; }
    const btns = stage.querySelectorAll('[data-o]');
    btns.forEach((b, k) => { b.disabled = true; if (k === q.answer) b.classList.add('right'); else if (k === j) b.classList.add('wrong'); });
    if (ok) popFrom(btns[j]);
    combo = ok ? combo + 1 : 0;
    if (hearts) extra.innerHTML = (combo >= 3 ? `<span class="combo">${combo} 连对</span> ` : '') + heartsHTML();
    if (ok) addXP(xpEach + (combo && combo % 5 === 0 ? 5 : 0)); else save();
    if (q.say && S.autoSpeak) (q.sayLang ? speakLang(q.say, q.sayLang) : speak(q.say));
    const cheer = ok ? sample(['やった！', 'すごい！', 'いいね！', '正解！'], 1)[0] : sample(['ドンマイ！', '大丈夫！', '次は行ける！'], 1)[0];
    stage.querySelector('[data-fb]').innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}">${neko(ok ? 'happy' : 'sad', 'mini')}<div class="fb-t"><div class="row"><b lang="ja" class="cheer">${cheer}</b>${q.say ? (q.sayLang ? sayBtn(q.say, q.sayLang) : speakBtn(q.say)) : ''}</div><b>${ok ? (combo >= 5 && combo % 5 === 0 ? `答对了！${combo} 连对，额外 +5` : '答对了') : (noRecord ? '答错了' : '答错了，已记入错题本')}</b><div>${q.explain || ''}</div></div></div>
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn pri" type="button" data-next>${failed ? '生命值用完了，看结果' : i + 1 < qs.length ? '下一题' : '查看结果'}（Enter）</button></div>`;
    stage.querySelector('[data-next]').onclick = next;
    stage.querySelector('[data-next]').focus({ preventScroll: true });
  }
  function next() { i++; if (!failed && i < qs.length && res.length < qs.length) show(); else finish(); }
  function finish() {
    clearInterval(examTimer); keyHandler = null;
    const score = res.filter(r => r.ok).length;
    onDone({ res, score, total: res.length, hearts: life, failed });
  }
  show();
}

function quizSummary(host, r, { title, again, extraHTML = '' }) {
  const pct = Math.round(r.score / r.total * 100);
  const wrong = r.res.filter(x => !x.ok);
  host.innerHTML = '';
  const box = h(`<section class="panel">
    <div class="result"><div class="seal pop ${pct >= 60 ? '' : 'fail'}">${pct >= 90 ? '優' : pct >= 60 ? '良' : '可'}</div>
    <div class="rank"><div class="eyebrow">${esc(title)}</div><div class="rank-name">${r.score} / ${r.total}</div><p class="muted">${pct >= 90 ? 'すごい！几乎全对。' : pct >= 60 ? 'いいね！继续保持。' : '多练几次就会了，错题已经帮你记下来。'}</p></div></div>
    ${extraHTML}
    ${wrong.length ? `<h3>错题回顾</h3><div class="list-wrap"><table class="list"><thead><tr><th>题目</th><th>你的答案</th><th>正确答案</th></tr></thead><tbody>
      ${wrong.map(x => `<tr><td>${x.q.explain ? x.q.explain.split('<br>')[0] : ''}</td><td class="muted" ${x.q.optLang ? `lang="${x.q.optLang}"` : ''}>${x.pick < 0 ? '未作答' : esc(x.q.options[x.pick])}</td><td ${x.q.optLang ? `lang="${x.q.optLang}"` : ''}><b>${esc(x.q.options[x.q.answer])}</b></td></tr>`).join('')}
    </tbody></table></div>` : ''}
    <div class="row"><button class="btn pri" type="button" data-again>再来一组</button><a class="btn" href="#home">回到今天</a></div>
  </section>`);
  host.append(box);
  box.querySelector('[data-again]').onclick = again;
  keyHandler = e => { if (e.key === 'Enter') again(); };
}

/* ---------- 页面 ---------- */
const VIEWS = { home: viewHome, read: viewRead, biz: viewBiz, game: viewGame, dict: viewDict, kana: viewKana, vocab: viewVocab, kanji: viewKanji, grammar: viewGrammar, exam: viewExam, listen: viewListen, ko: viewKo, en: viewEn, me: viewMe, welcome: viewWelcome };
function render() {
  const [v, ...rest] = (location.hash || '#home').slice(1).split('/');
  const arg = rest.join('/');
  let view = VIEWS[v] ? v : (!location.hash && S.track && S.track !== 'ja' ? S.track : 'home');
  if (!S.onboarded && view !== 'me') view = 'welcome';
  if (S.onboarded && view === 'welcome') view = 'home';
  clearInterval(examTimer); keyHandler = null;
  if (lsStop) lsStop();
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.go === view));
  const on = document.querySelector('.tabs a.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  main.innerHTML = '';
  if (trackOf(view) === 'ja' && ['home', 'game', 'kana', 'vocab', 'kanji', 'grammar', 'read', 'biz', 'listen', 'exam', 'dict'].includes(view) && S.track !== 'ja') { S.track = 'ja'; save(); }
  applyTrack(view);
  VIEWS[view](arg ? decodeURIComponent(arg) : undefined);
  updateTop();
}
addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
const go = view => { if (location.hash === '#' + view) render(); else location.hash = view; };

/* 欢迎 + 分级测试 */
const START_OPTS = [
  ['zero', 'あ', '零基础', '还不会假名，从五十音开始'],
  ['N5', 'N5', '入门', '会假名，认识一些简单单词'],
  ['N4', 'N4', '初级', '能看懂简单的句子和对话'],
  ['N3', 'N3', '中级', '日常会话基本没问题'],
  ['N2', 'N2', '中高级', '能读文章、看新闻'],
  ['N1', 'N1', '高级', '冲刺最高级别 N1']
];
function viewWelcome() {
  let pick = S.level, goal = S.goal;
  const p = h(`<section class="panel welcome">
    <div class="welcome-hi">${neko('happy', 'big wave')}<div class="bubble"><b lang="ja">ようこそ！</b><span>欢迎来到日语道场。先告诉我你的水平，我帮你安排今天学什么。</span></div></div>
    <h2>你现在的日语水平？</h2>
    <div class="lvl-opts">${START_OPTS.map(o => `<button type="button" class="lvl-opt" data-pick="${o[0]}"><span class="lvl-badge" lang="ja">${o[1]}</span><b>${o[2]}</b><span class="small muted">${o[3]}</span></button>`).join('')}</div>
    <button type="button" class="btn soft" data-place>不确定？做个 2 分钟分级小测试</button>
    <h2>每天想学多少？</h2>
    <div class="seg" data-goals>${[[30, '轻松 · 约 5 分钟'], [50, '标准 · 约 10 分钟'], [100, '认真 · 约 20 分钟']].map(([v, t]) => `<button type="button" data-goal="${v}">${t}</button>`).join('')}</div>
    <div class="row"><button type="button" class="btn pri big" data-start disabled>开始学习</button><a class="btn ghost" href="#me">我有备份，去恢复进度</a></div>
  </section>`);
  const sync = () => {
    p.querySelectorAll('[data-pick]').forEach(b => b.classList.toggle('on', b.dataset.pick === pick));
    p.querySelectorAll('[data-goal]').forEach(b => b.classList.toggle('on', +b.dataset.goal === goal));
    p.querySelector('[data-start]').disabled = !pick;
  };
  pick = null;
  p.querySelectorAll('[data-pick]').forEach(b => { b.onclick = () => { pick = b.dataset.pick; sync(); }; });
  p.querySelectorAll('[data-goal]').forEach(b => { b.onclick = () => { goal = +b.dataset.goal; sync(); }; });
  p.querySelector('[data-place]').onclick = placementTest;
  p.querySelector('[data-start]').onclick = () => finishOnboarding(pick, goal);
  sync();
  main.append(p);
}
function finishOnboarding(pick, goal) {
  S.onboarded = true; S.goal = goal || S.goal;
  S.level = pick === 'zero' ? 'N5' : pick;
  save(); requestPersist(); celebrate();
  if (pick === 'zero') { toast('先从五十音开始，一天认一行就很好'); go('kana'); }
  else { toast(`已设为 ${S.level}，随时可以在「我的」里更改`); go('home'); }
}
// 分级测试：每级 4 题（读音 2、纯假名词 1、语法 1），都不能靠汉字字形猜出答案
function placementTest() {
  const qs = LEVELS.flatMap(L => {
    const pool = VOCAB[L].filter(v => v.q);
    const kanjiWords = pool.filter(v => v.w !== v.r && /[一-鿿]/.test(v.w));
    const kanaWords = pool.filter(v => /^[ぁ-ん]{2,}$/.test(v.w));
    const out = sample(kanjiWords, 2).map(v => qVocab(v, 'reading'));
    out.push(kanaWords.length ? qVocab(sample(kanaWords, 1)[0], 'meaning') : qVocab(sample(kanjiWords, 1)[0], 'reading'));
    out.push(qGrammar(sample(GRAM[L], 1)[0]));
    return out.map(q => Object.assign(q, { lv: L }));
  });
  main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
  runQuiz(host, qs, {
    title: '分级小测试 · 20 题', exam: true, noRecord: true, onDone: r => {
      if (!r) return render();
      const by = {}; LEVELS.forEach(L => { by[L] = 0; });
      r.res.forEach(x => { if (x.ok) by[x.q.lv]++; });
      let rec = by.N5 >= 3 ? 'N5' : 'zero';
      if (rec !== 'zero') for (const L of LEVELS.slice(1)) { if (by[L] >= 3) rec = L; else break; }
      // 通过某一级就从下一级开始学；全部通过就停在 N1
      const next = rec === 'zero' ? 'zero' : rec === 'N1' ? 'N1' : LEVELS[LEVELS.indexOf(rec) + 1];
      const name = next === 'zero' ? '五十音（零基础）' : next;
      host.innerHTML = '';
      const box = h(`<section class="panel">
        <div class="welcome-hi">${neko('wow', 'big')}<div class="bubble"><b>推荐你从 ${name} 开始</b><span>${rec === 'zero' ? 'N5 还没过关，先打好假名和基础单词。' : `你已经能通过 ${rec}，接下来挑战 ${name}。`}每级 4 题，答对 3 题算过关。</span></div></div>
        <div class="breakdown">${LEVELS.map(L => `<div class="bd-row"><span>${L}</span><div class="bar"><i style="width:${by[L] / 4 * 100}%"></i></div><span class="small">${by[L]}/4</span></div>`).join('')}</div>
        <div class="row"><button class="btn pri big" type="button" data-ok>就从 ${name} 开始</button><button class="btn" type="button" data-back>我自己选</button></div>
      </section>`);
      box.querySelector('[data-ok]').onclick = () => finishOnboarding(next, S.goal);
      box.querySelector('[data-back]').onclick = render;
      host.append(box);
    }
  });
}

/* 存储保护：请求持久保存 + 备份 */
let persisted = null;
function requestPersist() {
  if (!navigator.storage || !navigator.storage.persist) { persisted = false; return Promise.resolve(false); }
  return navigator.storage.persisted().then(p => p || navigator.storage.persist()).then(p => { persisted = p; return p; }).catch(() => { persisted = false; return false; });
}
const backupJSON = () => JSON.stringify(Object.assign({ app: 'nihongo-dojo', v: 1 }, S));
function markBackedUp() { S.lastBackup = Date.now(); S.lastBackupXp = S.xp; save(); }
function downloadBackup() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([backupJSON()], { type: 'application/json' }));
  a.download = `nihongo-dojo-${dkey()}.json`; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  markBackedUp(); toast('备份已下载，换设备时在「我的」里导入');
}
const needBackup = () => S.xp >= 150 && (S.xp - S.lastBackupXp >= 300 || (S.lastBackup && Date.now() - S.lastBackup > 14 * DAY)) && !(S.snooze && Date.now() - S.snooze < 3 * DAY);

/* 今日一句：一年 366 句，按日期取（闰年的第几天），可以翻看前后几天 */
let dailyOff = 0;
const LEAP_MONTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const dailySlot = d => LEAP_MONTHS.slice(0, d.getMonth()).reduce((a, b) => a + b, 0) + d.getDate() - 1;
function dailyCard() {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + dailyOff);
  if (typeof DAILY === 'undefined' || !DAILY.length) {
    const pv = PROVERBS[Math.floor(startOfToday() / DAY) % PROVERBS.length];
    return h(`<div class="proverb"><span class="eyebrow">今日一句</span><div class="row"><span class="jp-big" lang="ja">${pv[0]}</span>${speakBtn(pv[3] || pv[1])}</div><span class="small muted" lang="ja">${pv[1]}</span><span>${pv[2]}</span></div>`);
  }
  const [jp, yomi, zh, note, ex, exk, exzh, kind, say] = DAILY[dailySlot(d) % DAILY.length];
  const label = dailyOff === 0 ? '今日一句' : dailyOff === -1 ? '昨日一句' : dailyOff === 1 ? '明日一句' : `${d.getMonth() + 1}月${d.getDate()}日`;
  const c = h(`<div class="proverb daily">
    <div class="row between"><span class="row"><span class="eyebrow">${label}</span><span class="tag">${esc(kind)}</span>${Math.abs(dailyOff) <= 1 ? `<span class="small muted">${d.getMonth() + 1}月${d.getDate()}日</span>` : ''}</span>
      <span class="row daily-nav"><button type="button" class="chip-btn" data-d="-1" aria-label="前一天">‹</button>${dailyOff ? '<button type="button" class="chip-btn" data-d="0">今天</button>' : ''}<button type="button" class="chip-btn" data-d="1" aria-label="后一天">›</button></span></div>
    <div class="row"><span class="jp-big" lang="ja">${esc(jp)}</span>${speakBtn(say)}</div>
    <span class="small muted" lang="ja">${esc(yomi)}</span>
    <b>${esc(zh)}</b>
    <span class="small muted">${esc(note)}</span>
    <div class="ex"><div style="flex:1;min-width:0"><div class="jp" lang="ja">${esc(ex)}</div><div class="small muted">${esc(exzh)}</div></div>${speakBtn(exk, '朗读例句')}</div>
  </div>`);
  c.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => { dailyOff = +b.dataset.d === 0 ? 0 : dailyOff + +b.dataset.d; c.replaceWith(dailyCard()); }; });
  return c;
}

/* 今天 */
function viewHome() {
  const tx = todayXP(), pct = Math.min(1, tx / S.goal), C = 2 * Math.PI * 52;
  const ri = rankOf(S.xp), rk = RANKS[ri], nx = RANKS[ri + 1];
  const due = dueList(LEVELS).length, nl = Math.min(newLeft(), newList(S.level).length), wrongN = Object.keys(S.wrong).length;
  const learnedN = allVocab().filter(learned).length, masteredN = allVocab().filter(mastered).length;
  const s = streak();
  const greet = (() => { const hr = new Date().getHours(); return hr < 11 ? 'おはようございます' : hr < 18 ? 'こんにちは' : 'こんばんは'; })();

  const mood = pct >= 1 ? ['wow', 'すごい！今日の目標達成！', '今天的目标完成啦，给你盖个小红花。'] : tx > 0 ? ['happy', 'いい調子！', `再拿 ${S.goal - tx} 经验就完成今天的目标。`] : s > 0 ? ['happy', `${s}日連続！`, '今天也来学一点，别让连续打卡断掉哦。'] : ['happy', greet, '每天十分钟，从今天开始吧。'];
  main.append(h(`<div class="welcome-hi">${neko(mood[0], 'wave')}<div class="bubble"><b lang="ja">${mood[1]}</b><span>${mood[2]}</span></div></div>`));
  const ta = typeof todayArticle === 'function' && todayArticle();
  if (ta && !(S.read || {})[ta.id]) main.append(h(`<a class="today-art" href="#read/${ta.id}"><div class="ta-img">${artImg(ta)}</div><div><span class="tag done">今日上新</span> <span class="tag lv">${ta.L}</span><div class="rc-title" lang="ja">${esc(ta.title)}</div><div class="small muted">${esc(ta.zh)} · 日本生活阅读，每天一篇</div></div></a>`));
  if (!isStandalone() && S.xp >= 30 && !S.installHint) {
    const ib = h(`<section class="banner"><div><b>把日语道场装到手机上</b><div class="small">像 App 一样从主屏幕打开，没有网络也能学。</div></div><div class="row"><button class="btn pri" type="button" data-i>安装</button><button class="btn ghost" type="button" data-x>不用了</button></div></section>`);
    ib.querySelector('[data-i]').onclick = e => { e.stopPropagation(); doInstall(); };
    ib.querySelector('[data-x]').onclick = () => { S.installHint = 1; save(); ib.remove(); };
    main.append(ib);
  }
  if (needBackup()) {
    const bn = h(`<section class="banner"><div><b>记得备份一下</b><div class="small">你已经攒了 ${S.xp} 经验、学过 ${learnedN} 个单词。进度存在这个浏览器里，清理浏览器数据或换设备前先备份，就不怕丢。</div></div><div class="row"><button class="btn pri" type="button" data-bk>下载备份</button><button class="btn ghost" type="button" data-later>过几天再说</button></div></section>`);
    bn.querySelector('[data-bk]').onclick = () => { downloadBackup(); bn.remove(); };
    bn.querySelector('[data-later]').onclick = () => { S.snooze = Date.now(); save(); bn.remove(); };
    main.append(bn);
  }
  main.append(h(`<section class="panel">
    <div class="hero">
      <div class="ring ${pct >= 1 ? 'full' : ''}"><svg viewBox="0 0 120 120"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--sakura)"/><stop offset="1" style="stop-color:var(--ai)"/></linearGradient></defs><circle class="trk" cx="60" cy="60" r="52"/><circle class="val" cx="60" cy="60" r="52" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
        <div class="ring-c"><b>${tx}</b><span class="small muted">/ ${S.goal} 经验</span></div></div>
      <div class="rank">
        <div class="eyebrow">当前段位</div>
        <div class="rank-name"><span lang="ja">${rk[1]}</span> <span class="small muted" style="font-family:var(--f-ui);font-weight:400">${rk[2]}</span></div>
        <div class="bar"><i style="width:${nx ? (S.xp - rk[0]) / (nx[0] - rk[0]) * 100 : 100}%"></i></div>
        <p class="small muted">${nx ? `累计 ${S.xp} 经验，距离「${nx[2]}」还差 ${nx[0] - S.xp}` : `累计 ${S.xp} 经验，已是最高段位`}</p>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><span class="small muted">连续天数</span><b>${s}</b></div>
      <div class="stat"><span class="small muted">最长连续</span><b>${S.best}</b></div>
      <div class="stat"><span class="small muted">学过的单词</span><b>${learnedN}</b></div>
      <div class="stat"><span class="small muted">已掌握</span><b>${masteredN}</b></div>
      <div class="stat"><span class="small muted">错题本</span><b>${wrongN}</b></div>
    </div>
  </section>`));

  const ns = nextStage(S.level);
  const tasks = [
    { ic: '関', t: `闯关 · ${S.level} 第 ${ns} 关${isBoss(ns) ? '（头目关）' : ''}`, d: `已获得 ${totalStars(S.level)} 颗星，每关 10 个新词`, go: () => stageIntro(S.level, ns) },
    { ic: '復', t: '复习到期单词卡', d: due ? `${due} 张卡片到了复习时间` : '没有到期的卡片', done: !due, go: () => { if (due) { const host = h('<div></div>'); main.innerHTML = ''; main.append(host); startCards(host, shuffle(dueList(LEVELS)).map(v => v.id), '复习到期卡片', () => go('home')); } } },
    { ic: '新', t: `学习 ${S.level} 新单词`, d: nl ? `今天还可以学 ${nl} 个新词` : newList(S.level).length ? `今天的 ${S.newPerDay} 个新词已学完` : `${S.level} 的单词都学过了，去「我的」换个级别吧`, done: !nl, go: () => { if (nl) { const host = h('<div></div>'); main.innerHTML = ''; main.append(host); startCards(host, newList(S.level).slice(0, nl).map(v => v.id), `${S.level} 新单词`, () => go('home')); } } },
    { ic: '文', t: `${S.level} 语法练习`, d: '8 道填空题，每题 10 经验', go: () => grammarQuiz(S.level, () => go('home')) },
    wrongN ? { ic: '誤', t: '订正错题', d: `错题本里有 ${wrongN} 道题，答对就会移出`, go: wrongReview } : null,
    S.level === 'N5' ? { ic: 'あ', t: '假名热身', d: '10 道假名识读题', go: () => { location.hash = 'kana'; } } : null
  ].filter(Boolean);
  const tp = h(`<section class="panel"><div class="row between"><h2>今日任务</h2><span class="small muted">目标级别 ${S.level}</span></div><div class="tasks"></div></section>`);
  tasks.forEach(t => {
    const el = h(`<div class="task ${t.done ? 'done' : ''}"><span class="task-ic" lang="ja">${t.done ? '✓' : t.ic}</span><div class="task-t"><b>${esc(t.t)}</b><div class="small muted">${esc(t.d)}</div></div>${t.done ? '' : '<button class="btn pri" type="button">开始</button>'}</div>`);
    const b = el.querySelector('button'); if (b) b.onclick = t.go;
    tp.querySelector('.tasks').append(el);
  });
  main.append(tp);

  main.append(dailyCard());

  // 学习热力图：最近 20 周
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - 7 * 19 - end.getDay());
  let cells = '';
  for (let d = new Date(start); d <= new Date(end.getTime() + (6 - end.getDay()) * DAY); d.setDate(d.getDate() + 1)) {
    const x = S.days[dkey(d)] || 0, fut = d > end;
    const lv = !x ? 0 : x < S.goal / 2 ? 1 : x < S.goal ? 2 : x < S.goal * 2 ? 3 : 4;
    cells += `<i class="h${lv} ${fut ? 'fut' : ''}" title="${dkey(d)}：${x} 经验"></i>`;
  }
  const lvRows = LEVELS.map(L => { const n = VOCAB[L].filter(learned).length, t = VOCAB[L].length; return `<div class="lv-row"><b>${L}</b><div class="bar"><i style="width:${n / t * 100}%"></i></div><span class="small muted">${n}/${t}</span></div>`; }).join('');
  main.append(h(`<div class="grid2">
    <section class="panel"><div class="row between"><h2>学习记录</h2><span class="legend">少 <i style="background:var(--heat0)"></i><i style="background:var(--heat1)"></i><i style="background:var(--heat2)"></i><i style="background:var(--heat3)"></i><i style="background:var(--heat4)"></i> 多</span></div>
      <div class="heat-wrap"><div class="heat">${cells}</div></div><p class="small muted">每一格是一天，颜色越深当天经验越多。</p></section>
    <section class="panel"><h2>单词进度</h2><div class="lv-list">${lvRows}</div></section>
  </div>`));

  main.append(h(`<section class="panel"><div class="row between"><h2>成就印章</h2><span class="small muted">${Object.keys(S.badges).length} / ${BADGES.length}</span></div>
    <div class="stamps">${BADGES.map(b => `<div class="stamp ${S.badges[b.id] ? 'got' : ''}" title="${esc(b.desc)}"><div class="stamp-in" lang="ja">${b.ch}</div><b>${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`).join('')}</div></section>`));
}

function wrongReview() {
  const ids = Object.keys(S.wrong).filter(id => ITEMS[id]).sort((a, b) => S.wrong[b].n - S.wrong[a].n).slice(0, 12);
  if (!ids.length) { toast('错题本是空的'); return; }
  main.innerHTML = '';
  const host = h('<div></div>'); main.append(host);
  runQuiz(host, shuffle(ids).map(id => itemQ(ITEMS[id])), {
    title: '订正错题', fromWrong: true,
    onDone: r => { checkBadges(); save(); if (!r) return go('home'); quizSummary(host, r, { title: '订正错题', again: wrongReview }); }
  });
}

/* 假名 */
let kanaScript = 'h';
function viewKana() {
  const conv = s => kanaScript === 'k' ? toKata(s) : s;
  const cell = c => c ? `<button class="kana" type="button" data-say="${conv(c[0])}"><b lang="ja">${conv(c[0])}</b><small>${c[1]}</small></button>` : '<span class="kana empty"></span>';
  const p = h(`<section class="panel">
    <div class="row between"><h2>五十音图</h2><div class="seg" role="group" aria-label="假名种类"><button type="button" data-s="h" class="${kanaScript === 'h' ? 'on' : ''}">平假名</button><button type="button" data-s="k" class="${kanaScript === 'k' ? 'on' : ''}">片假名</button></div></div>
    <p class="small muted">点任意假名听发音。平假名用于一般书写，片假名主要用于外来语。</p>
    <h3>清音</h3><div class="kana-grid">${KANA_BASIC.flat().map(cell).join('')}</div>
    <h3>浊音・半浊音</h3><div class="kana-grid">${KANA_DAKU.flat().map(cell).join('')}</div>
    <h3>拗音</h3><div class="kana-grid yoon">${KANA_YOON.flat().map(cell).join('')}</div>
  </section>`);
  p.querySelectorAll('[data-s]').forEach(b => { b.onclick = () => { kanaScript = b.dataset.s; render(); }; });

  const qz = h(`<section class="panel"><h2>假名测验</h2>
    <div class="row"><span class="small muted">范围</span>
      <label><input type="checkbox" id="kq-basic" checked> 清音</label>
      <label><input type="checkbox" id="kq-daku"> 浊音</label>
      <label><input type="checkbox" id="kq-yoon"> 拗音</label></div>
    <div class="row"><span class="small muted">文字</span>
      <select id="kq-script"><option value="h">平假名</option><option value="k">片假名</option><option value="b">两种混合</option></select>
      <select id="kq-mode"><option value="0">看假名选读音</option><option value="1">看读音选假名</option></select></div>
    <div class="row"><button class="btn pri" type="button" id="kq-go">开始 10 题</button><span class="small muted">累计答对 ${S.kanaRight} 次</span></div>
  </section>`);
  main.append(qz, p);
  qz.querySelector('#kq-script').value = kanaScript;
  qz.querySelector('#kq-go').onclick = () => {
    const sets = ['basic', 'daku', 'yoon'].filter(s => qz.querySelector('#kq-' + s).checked);
    if (!sets.length) { toast('至少选一种范围'); return; }
    const sc = qz.querySelector('#kq-script').value, rev = qz.querySelector('#kq-mode').value === '1';
    let pool = sets.flatMap(kanaList);
    if (sc === 'k') pool = pool.map(([k, r]) => [toKata(k), r]);
    if (sc === 'b') pool = pool.concat(pool.map(([k, r]) => [toKata(k), r]));
    const startKanaQuiz = () => {
      const qs = sample(pool, 10).map(c => qKana(c, rev, sc === 'b' ? pool.filter(p2 => (toKata(p2[0]) === p2[0]) === (toKata(c[0]) === c[0])) : pool));
      main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
      runQuiz(host, qs, { title: '假名测验', xpEach: 5, onDone: r => { checkBadges(); save(); if (!r) return render(); quizSummary(host, r, { title: '假名测验', again: startKanaQuiz }); } });
    };
    startKanaQuiz();
  };
}

/* 单词 */
let vocabFilter = 'all', vocabSearch = '';
// 导出到 Anki：制表符分隔的文本，Anki「文件 → 导入」直接认（正面：单词；背面：读音、中文、例句；标签：级别）
function exportAnki() {
  const cards = allVocab().filter(v => S.srs[v.id]);
  if (!cards.length) return toast('还没有学过或加入的单词');
  const clean = s => String(s).replace(/[\t\n\r]+/g, ' ');
  const lines = ['#separator:tab', '#html:true', '#notetype:Basic', '#deck:日语道场', '#tags column:3'];
  for (const v of cards) {
    const ex = exList(v.w)[0];
    const back = `${clean(v.r)}<br>${clean(v.m)}${ex ? `<br><br>${clean(ex[0])}<br>${clean(ex[2])}` : ''}`;
    lines.push([clean(v.w), back, `JLPT_${v.L}`].join('\t'));
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' }));
  a.download = `nihongo-dojo-anki-${dkey()}.txt`;
  document.body.append(a); a.click(); a.remove();
  toast(`已导出 ${cards.length} 张卡片`);
}
function viewVocab() {
  const L = S.level, list = VOCAB[L];
  const due = dueList([L]).length, nl = Math.min(newLeft(), newList(L).length);
  const learnedN = list.filter(learned).length, masteredN = list.filter(mastered).length;
  const top = h(`<section class="panel">
    <div class="row between"><h2>单词 · ${L}</h2>${levelSeg(L)}</div>
    <div class="stats">
      <div class="stat"><span class="small muted">本级单词</span><b>${list.length}</b></div>
      <div class="stat"><span class="small muted">学过</span><b>${learnedN}</b></div>
      <div class="stat"><span class="small muted">已掌握</span><b>${masteredN}</b></div>
      <div class="stat"><span class="small muted">待复习</span><b>${due}</b></div>
    </div>
    <div class="row">
      <button class="btn pri" type="button" data-study ${due + nl ? '' : 'disabled'}>背单词（复习 ${due} + 新词 ${nl}）</button>
      <button class="btn" type="button" data-quiz>单词测验 10 题</button>
      <button class="btn ghost" type="button" data-anki>导出到 Anki</button>
    </div>
    <p class="small muted">单词卡和 Anki 一样用间隔重复：记得越牢，下次出现越晚。看完答案后按「重来 / 困难 / 记得 / 简单」评分，键盘可用 1–4。阅读时点生词，也能「+ 单词卡」。习惯用 Anki 的话，可以把学过和加入的单词导出，在 Anki 里「文件 → 导入」。</p>
  </section>`);
  bindLevel(top);
  top.querySelector('[data-anki]').onclick = exportAnki;
  top.querySelector('[data-study]').onclick = () => {
    const ids = [...shuffle(dueList([L])), ...newList(L).slice(0, nl)].map(v => v.id);
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    startCards(host, ids, `背单词 · ${L}`, () => render());
  };
  const vq = () => {
    const qs = sample(list.filter(x => x.q), 10).map(v => qVocab(v, sample(['reading', 'meaning', 'word'], 1)[0]));
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    runQuiz(host, qs, { title: `单词测验 · ${L}`, onDone: r => { if (!r) return render(); quizSummary(host, r, { title: `单词测验 · ${L}`, again: vq }); } });
  };
  top.querySelector('[data-quiz]').onclick = vq;

  const tbl = h(`<section class="panel">
    <div class="row"><input type="search" id="v-search" placeholder="搜索单词、读音、中文或英文" value="${esc(vocabSearch)}" aria-label="搜索单词">
      <select id="v-filter" aria-label="筛选"><option value="all">全部</option><option value="new">没学过</option><option value="learn">学习中</option><option value="done">已掌握</option></select></div>
    <p class="small muted">点一个单词展开例句，每句都能朗读。<span data-count></span></p>
    <div class="list-wrap"><table class="list"><thead><tr><th>单词</th><th>读音</th><th>意思</th><th class="col-st">状态</th><th></th></tr></thead><tbody></tbody></table></div>
    <button class="btn" type="button" data-more hidden>显示更多</button>
  </section>`);
  let shown = 100;
  tbl.querySelector('[data-more]').onclick = () => { shown += 200; fill(); };
  const fill = () => {
    const q = vocabSearch.trim(), ql = q.toLowerCase();
    const all = list.filter(v => !q || v.w.includes(q) || v.r.includes(q) || v.m.includes(q) || v.en.toLowerCase().includes(ql)).filter(v => {
      const st = mastered(v) ? 'done' : learned(v) ? 'learn' : 'new'; return vocabFilter === 'all' || vocabFilter === st;
    });
    const rows = all.slice(0, shown);
    tbl.querySelector('[data-count]').textContent = `共 ${all.length} 个`;
    tbl.querySelector('[data-more]').hidden = all.length <= shown;
    tbl.querySelector('tbody').innerHTML = rows.map(v => {
      const st = mastered(v) ? '<span class="tag done">已掌握</span>' : learned(v) ? '<span class="tag learn">学习中</span>' : '<span class="tag">新</span>';
      return `<tr class="vrow" data-id="${esc(v.id)}" tabindex="0" aria-expanded="false"><td class="w" lang="ja">${esc(v.w)}</td><td class="r" lang="ja">${esc(v.r)}</td><td>${esc(v.m)}</td><td class="col-st">${st}</td><td>${speakBtn(v.r)}</td></tr>`;
    }).join('') || '<tr><td colspan="5" class="muted">没有符合条件的单词</td></tr>';
  };
  const toggle = tr => {
    const open = tr.nextElementSibling && tr.nextElementSibling.classList.contains('vex');
    tbl.querySelectorAll('tr.vex').forEach(x => { x.previousElementSibling.setAttribute('aria-expanded', 'false'); x.remove(); });
    if (open) return;
    tr.setAttribute('aria-expanded', 'true');
    const v = ITEMS[tr.dataset.id];
    const extra = `${v.alt.length ? `<div class="small muted">其他写法：<span lang="ja">${esc(v.alt.join('、'))}</span></div>` : ''}${v.en ? `<div class="small muted">英文：${esc(v.en)}</div>` : ''}`;
    tr.insertAdjacentHTML('afterend', `<tr class="vex"><td colspan="5"><div class="ex-box">${extra}${exHTML(v.w) || '<span class="muted small">这个词的例句还在补充中。</span>'}</div></td></tr>`);
  };
  tbl.querySelector('tbody').addEventListener('click', e => { const tr = e.target.closest('tr.vrow'); if (tr) toggle(tr); });
  tbl.querySelector('tbody').addEventListener('keydown', e => { const tr = e.target.closest('tr.vrow'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(tr); } });
  tbl.querySelector('#v-filter').value = vocabFilter;
  tbl.querySelector('#v-search').oninput = e => { vocabSearch = e.target.value; shown = 100; fill(); };
  tbl.querySelector('#v-filter').onchange = e => { vocabFilter = e.target.value; shown = 100; fill(); };
  fill();
  main.append(top, tbl);
}
function bindLevel(el) {
  el.querySelectorAll('[data-level]').forEach(b => { b.onclick = () => { S.level = b.dataset.level; save(); render(); }; });
}

/* 汉字 */
let kanjiSel = null;
function viewKanji() {
  const L = S.level, list = KANJI[L];
  if (!kanjiSel || kanjiSel.L !== L) kanjiSel = list[0];
  const p = h(`<section class="panel">
    <div class="row between"><h2>汉字 · ${L}</h2>${levelSeg(L)}</div>
    <div class="kj-detail" data-detail></div>
    <div class="row"><button class="btn pri" type="button" data-quiz>汉字测验 10 题</button><span class="small muted">本级 ${list.length} 个汉字，按常用程度排列。点击查看读音和相关单词（点单词可朗读）</span></div>
    <div class="kanji-grid">${list.map(k => `<button type="button" class="kj" data-k="${esc(k.id)}" lang="ja" aria-label="${esc(k.k)}">${esc(k.k)}</button>`).join('')}</div>
  </section>`);
  bindLevel(p);
  const detail = () => {
    const k = kanjiSel;
    const words = wordsWith(k.k).slice(0, 8);
    p.querySelector('[data-detail]').innerHTML = `<div class="kj-big" lang="ja">${esc(k.k)}</div>
      <div style="display:grid;gap:8px;min-width:0"><dl class="kv"><dt>音读</dt><dd lang="ja">${esc(k.on)}</dd><dt>训读</dt><dd lang="ja">${esc(k.kun)}</dd>${k.zh ? `<dt>意思</dt><dd>${esc(k.zh)}</dd>` : ''}<dt>英文</dt><dd>${esc(k.en)}</dd><dt>笔画</dt><dd>${k.strokes}</dd></dl>
      ${words.length ? `<div class="kj-words">${words.map(v => `<button type="button" class="kw" data-say="${esc(v.r)}"><b lang="ja">${esc(v.w)}</b><span lang="ja">${esc(v.r)}</span><small>${esc(v.m)} · ${v.L}</small></button>`).join('')}</div>` : '<span class="small muted">单词库里暂时没有含这个字的词</span>'}</div>`;
    p.querySelectorAll('.kj').forEach(b => b.classList.toggle('on', b.dataset.k === k.id));
  };
  p.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { kanjiSel = ITEMS[b.dataset.k]; detail(); }; });
  const kq = () => {
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    runQuiz(host, sample(list, Math.min(10, list.length)).map(k => qKanji(k)), { title: `汉字测验 · ${L}`, onDone: r => { if (!r) return render(); quizSummary(host, r, { title: `汉字测验 · ${L}`, again: kq }); } });
  };
  p.querySelector('[data-quiz]').onclick = kq;
  detail();
  main.append(p);
}

/* 语法 */
function grammarQuiz(L, back) {
  main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
  runQuiz(host, sample(GRAM[L], Math.min(8, GRAM[L].length)).map(g => qGrammar(g)), {
    title: `语法练习 · ${L}`, onDone: r => { if (!r) return back(); quizSummary(host, r, { title: `语法练习 · ${L}`, again: () => grammarQuiz(L, back) }); }
  });
}
function viewGrammar() {
  const L = S.level;
  const p = h(`<section class="panel">
    <div class="row between"><h2>语法 · ${L}</h2>${levelSeg(L)}</div>
    <div class="row"><button class="btn pri" type="button" data-quiz>语法填空 8 题</button><span class="small muted">本级 ${GRAM[L].length} 个句型，每个 4 句例句，点开看接续和例句</span></div>
    <div style="display:grid;gap:8px">${GRAM[L].map(g => `<details class="gp"><summary><span class="pat" lang="ja">${esc(g.p)}</span><span class="muted">${esc(g.m)}</span></summary>
      <div class="gp-body"><div><span class="small muted">接续</span>　${esc(g.how)}</div>
      ${g.eg.map(e => `<div class="ex"><div style="flex:1;min-width:0"><div class="jp" lang="ja">${esc(e.s).replace(/\[(.+?)\]/, '<mark>$1</mark>')}</div><div class="small muted">${esc(e.t)}</div></div>${speakBtn(e.kana)}</div>`).join('')}</div></details>`).join('')}</div>
  </section>`);
  bindLevel(p);
  p.querySelector('[data-quiz]').onclick = () => grammarQuiz(L, render);
  main.append(p);
}

/* 模拟考 */
/* JLPT 题型（原创题库 jlpt.js）：题干里【】是画线词，（　）是空格，＿＿/★ 是排序题的空位 */
const JTYPE = {
  読み: ['漢字読み', '＿＿＿の　ことばの　読み方として　最も　よい　ものを　えらんで　ください。'],
  表記: ['表記', '＿＿＿の　ことばを　漢字で　書くとき、最も　よい　ものを　えらんで　ください。'],
  語形成: ['語形成', '（　）に　入れるのに　最も　よい　ものを　えらんで　ください。'],
  文脈: ['文脈規定', '（　）に　入れるのに　最も　よい　ものを　えらんで　ください。'],
  言換: ['言い換え類義', '＿＿＿に　意味が　最も　近い　ものを　えらんで　ください。'],
  用法: ['用法', 'つぎの　ことばの　使い方として　最も　よい　ものを　えらんで　ください。'],
  文法: ['文法形式の判断', '（　）に　入れるのに　最も　よい　ものを　えらんで　ください。'],
  組立: ['文の組み立て', '★　に　入る　最も　よい　ものを　えらんで　ください。'],
  読解: ['読解', 'つぎの　文章を　読んで、質問に　答えて　ください。']
};
for (const [k, [name]] of Object.entries(JTYPE)) KIND_NAMES['j' + k] = name;
function jlptStem(t, q) {
  let s = esc(q).replace(/【(.+?)】/g, '<u class="jl-u">$1</u>').replace(/（\s*）/g, '<span class="blank">　　　</span>');
  if (t === '組立') s = s.replace(/＿＿|★/g, m => `<span class="jl-slot${m === '★' ? ' star' : ''}">${m === '★' ? '★' : ''}</span>`);
  return s;
}
function qJlpt(L, [t, q, opts, note]) {
  const [name, inst] = JTYPE[t];
  let stem;
  if (t === '読解') {
    const [passage, ques] = q.split('◆').map(x => x.trim());
    stem = `<div class="jl-passage" lang="ja">${esc(passage)}</div><div class="q-sent" lang="ja">${esc(ques)}</div>`;
  } else if (t === '用法') stem = `<div class="q-big" lang="ja">${esc(q)}</div>`;
  else stem = `<div class="q-sent" lang="ja">${jlptStem(t, q)}</div>`;
  return makeQ(null, 'j' + t, shuffle(opts.slice(1)).slice(0, 3), opts[0], {
    prompt: `<div class="eyebrow">${name}　<span lang="ja" class="jl-inst">${inst}</span></div>${stem}`,
    optLang: 'ja', explain: `<b lang="ja">${esc(opts[0])}</b>　${esc(note)}`
  });
}
// 模拟考按 JLPT 试卷的顺序出题：文字・语汇 → 语法 → 读解；题库里没有的题型用自动生成的题补上
const EXAM_PLAN = [['読み', 4], ['表記', 3], ['語形成', 2], ['文脈', 4], ['言換', 3], ['用法', 2], ['文法', 6], ['組立', 3], ['読解', 3]];
const EXAM_MIN = { N5: 25, N4: 30, N3: 35, N2: 40, N1: 45 };
function buildExam(L) {
  const bank = (typeof JLPT !== 'undefined' && JLPT[L]) || [];
  const qs = [];
  let short = 0;
  for (const [t, n] of EXAM_PLAN) {
    const pool = bank.filter(x => x[0] === t);
    if (!pool.length) { if (['表記', '語形成', '用法'].includes(t)) continue; short += n; continue; }
    sample(pool, Math.min(n, pool.length)).forEach(x => qs.push(qJlpt(L, x)));
    short += Math.max(0, n - pool.length);
  }
  if (qs.length < 10) {   // 题库还没有这个级别：用原来的自动出题
    const vs = VOCAB[L].filter(x => x.q), readable = shuffle(vs.filter(v => v.w !== v.r)), rest = shuffle(vs.filter(v => !readable.slice(0, 5).includes(v)));
    return [...readable.slice(0, 5).map(v => qVocab(v, 'reading')), ...rest.slice(0, 5).map(v => qVocab(v, 'meaning')), ...rest.slice(5, 8).map(v => qVocab(v, 'word')),
      ...sample(KANJI[L], 3).map(k => qKanji(k)), ...sample(GRAM[L], 4).map(g => qGrammar(g))];
  }
  // 题型少的级别（N1 没有表记、语形成）用语法、读解、文脉补到 30 题左右，和真实试卷的比重一致
  for (const t of ['文法', '読解', '文脈', '文法', '読解']) {
    if (qs.length >= 30) break;
    const used = new Set(qs.map(q => q.prompt));
    const extra = shuffle(bank.filter(x => x[0] === t)).map(x => qJlpt(L, x)).find(q => !used.has(q.prompt));
    if (extra) {
      const at = qs.map(q => q.kind).lastIndexOf('j' + t);
      qs.splice(at + 1, 0, extra);
    }
  }
  if (short) {
    const vs = shuffle(VOCAB[L].filter(x => x.q && x.w !== x.r)).slice(0, short);
    qs.unshift(...vs.map(v => qVocab(v, 'reading')));
  }
  return qs;
}
// 按题型专项练习：不限时，每题都有解说
function jlptDrill(L, t) {
  const pool = ((typeof JLPT !== 'undefined' && JLPT[L]) || []).filter(x => !t || x[0] === t);
  const qs = sample(pool, Math.min(10, pool.length)).map(x => qJlpt(L, x));
  main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
  const title = `${L} ${t ? JTYPE[t][0] : '综合'}练习`;
  runQuiz(host, qs, { title, noRecord: true, xpEach: 8, onDone: r => { if (!r) return render(); quizSummary(host, r, { title, again: () => jlptDrill(L, t) }); } });
}
function viewExam() {
  const L = S.level;
  const hist = S.exams.slice(-6).reverse();
  const p = h(`<section class="panel">
    <div class="row between"><h2>模拟考 · ${L}</h2>${levelSeg(L)}</div>
    <p>按 JLPT 试卷的题型和顺序出题：文字・语汇（汉字读法、表记、文脉、近义替换、用法）→ 语法（语法形式、★排序题）→ 读解。约 30 题，限时 ${EXAM_MIN[L]} 分钟，考试中不显示对错，交卷后统一批改。正确率 60% 以上盖「合格」章。</p>
    <p class="small muted">题目为本站原创，按 JLPT 官方题型编写（真题有版权，不能直接收录），难度略高于考试，干扰项专门挑容易混淆的。</p>
    <p class="small">听力部分单独练：<a href="#listen">听力测验 →</a></p>
    <div class="row"><button class="btn pri" type="button" data-start>开始考试</button></div>
    ${(typeof JLPT !== 'undefined' && JLPT[L] && JLPT[L].length) ? `<h3>题型专项练习</h3><div class="row">${Object.keys(JTYPE).filter(t => JLPT[L].some(x => x[0] === t)).map(t => `<button class="chip-btn" type="button" data-drill="${t}">${JTYPE[t][0]} <span class="small">${JLPT[L].filter(x => x[0] === t).length}</span></button>`).join('')}</div>` : ''}
    ${hist.length ? `<h3>最近成绩</h3><div class="list-wrap"><table class="list"><thead><tr><th>日期</th><th>级别</th><th>得分</th><th>结果</th></tr></thead><tbody>${hist.map(e => `<tr><td>${e.date}</td><td>${e.L}</td><td>${e.score}/${e.total}</td><td>${e.score / e.total >= .6 ? '<span class="tag done">合格</span>' : '<span class="tag">未合格</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
  </section>`);
  bindLevel(p);
  const start = () => {
    const qs = buildExam(L);
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    runQuiz(host, qs, {
      title: `${L} 模拟考`, exam: true, minutes: EXAM_MIN[L], onDone: r => {
        if (!r) return render();
        S.exams.push({ L, score: r.score, total: r.total, date: dkey() });
        const pass = r.score / r.total >= .6;
        addXP(r.score * 10 + (pass ? 50 : 0));
        checkBadges(); save();
        const by = {};
        r.res.forEach(x => { const k = x.q.kind; by[k] = by[k] || [0, 0]; by[k][1]++; if (x.ok) by[k][0]++; });
        const bd = `<div class="breakdown">${Object.entries(by).map(([k, [a, t]]) => `<div class="bd-row"><span>${KIND_NAMES[k]}</span><div class="bar"><i style="width:${a / t * 100}%"></i></div><span class="small">${a}/${t}</span></div>`).join('')}</div>
          <p class="small muted">获得 ${r.score * 10 + (pass ? 50 : 0)} 经验${pass ? '（含合格奖励 50）' : ''}。</p>`;
        quizSummary(host, r, { title: `${L} 模拟考`, again: start, extraHTML: bd });
        const seal = host.querySelector('.seal');
        seal.textContent = pass ? '合格' : '再挑戦'; seal.style.fontSize = pass ? '2.2rem' : '1.4rem';
        if (pass) celebrate();
      }
    });
  };
  p.querySelector("[data-start]").onclick = start;
  p.querySelectorAll('[data-drill]').forEach(b => { b.onclick = () => jlptDrill(L, b.dataset.drill); });
  main.append(p);
}

/* 我的 */
function viewMe() {
  const opt = (arr, cur, attr) => arr.map(([v, t]) => `<button type="button" ${attr}="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('');
  const p = h(`<section class="panel"><h2>学习设置</h2>
    <div class="row between"><span>目标级别</span>${levelSeg(S.level)}</div>
    <div class="row between"><span>每日经验目标</span><div class="seg">${opt([[30, '30 轻松'], [50, '50 标准'], [100, '100 认真'], [200, '200 冲刺']], S.goal, 'data-goal')}</div></div>
    <div class="row between"><span>每天新单词</span><div class="seg">${opt([[5, '5'], [10, '10'], [20, '20'], [30, '30']], S.newPerDay, 'data-new')}</div></div>
    <div class="row between"><span>外观</span><div class="seg">${opt([['', '跟随系统'], ['light', '浅色'], ['dark', '深色']], S.theme, 'data-theme-set')}</div></div>
    <div class="row between"><span>樱花飘落</span><div class="seg">${opt([[1, '开'], [0, '关']], S.petals ? 1 : 0, 'data-petals')}</div></div>
    <p class="small muted">经验怎么来：测验答对 10（假名 5），单词卡每张 5，模拟考每题 10，合格再加 50，每 5 连对额外 5。</p>
  </section>`);
  bindLevel(p);
  p.querySelectorAll('[data-goal]').forEach(b => { b.onclick = () => { S.goal = +b.dataset.goal; save(); render(); }; });
  p.querySelectorAll('[data-new]').forEach(b => { b.onclick = () => { S.newPerDay = +b.dataset.new; save(); render(); }; });
  p.querySelectorAll('[data-petals]').forEach(b => { b.onclick = () => { S.petals = b.dataset.petals === '1'; save(); startPetals(); render(); }; });
  const vs = jaVoices();
  const cur = currentVoice();
  const voiceP = h(`<section class="panel"><h2>发音</h2>
    <div class="row between"><span>语速</span><div class="seg">${opt([[.6, '很慢'], [.8, '慢'], [.95, '正常']], S.rate, 'data-rate')}</div></div>
    <div class="row between"><span>发音来源</span><div class="seg">${opt([['vv', '真人感（VOICEVOX）'], ['tts', '设备自带']], S.voiceSrc || 'vv', 'data-vsrc')}</div></div>
    <div class="row between"><span>翻卡和答题后自动朗读</span><div class="seg">${opt([[1, '开'], [0, '关']], S.autoSpeak ? 1 : 0, 'data-auto')}</div></div>
    <div class="row between"><label for="voice-sel">语音</label><div class="row"><select id="voice-sel" ${vs.length ? '' : 'disabled'}>${vs.length ? vs.map(v => `<option value="${esc(v.name)}" ${cur && cur.name === v.name ? 'selected' : ''}>${esc(v.name)}</option>`).join('') : '<option>没有找到日语语音</option>'}</select><button class="btn" type="button" data-try>试听</button></div></div>
    <p class="small muted">单词和今日一句优先使用 VOICEVOX 预先生成的真人感发音；其余句子和没有音频的内容使用设备自带的语音，不同设备差别很大。名字里带 Natural、Online 或 Google 的通常更自然（例如 Edge 浏览器的 Nanami Online）。手机上没有日语语音时，可以在系统设置的「文字转语音」里下载日语语音。</p>
  </section>`);
  voiceP.querySelectorAll('[data-rate]').forEach(b => { b.onclick = () => { S.rate = +b.dataset.rate; save(); speak('きょうも がんばりましょう。'); render(); }; });
  voiceP.querySelectorAll('[data-vsrc]').forEach(b => { b.onclick = () => { S.voiceSrc = b.dataset.vsrc; save(); render(); }; });
  voiceP.querySelectorAll('[data-auto]').forEach(b => { b.onclick = () => { S.autoSpeak = b.dataset.auto === '1'; save(); render(); }; });
  voiceP.querySelector('#voice-sel').onchange = e => { S.voice = e.target.value; save(); speak('こんにちは。いっしょに にほんごを べんきょうしましょう。'); };
  voiceP.querySelector('[data-try]').onclick = () => speak('こんにちは。いっしょに にほんごを べんきょうしましょう。');
  p.querySelectorAll('[data-theme-set]').forEach(b => { b.onclick = () => { S.theme = b.dataset.themeSet; applyTheme(); save(); startPetals(); render(); }; });

  const bk = h(`<section class="panel"><h2>备份与换设备</h2>
    <p class="small">刷新页面、关掉网页都不会丢进度。只有这几种情况会丢：清除浏览器数据、无痕模式、换设备。另外 iPhone 的 Safari 超过 7 天没打开这个网站会自动清理，把网站「添加到主屏幕」后从图标打开就不会被清理。</p>
    <p class="small" data-persist></p>
    ${storageOk ? '' : '<p class="small" style="color:var(--bad)"><b>当前浏览器无法保存进度（可能是无痕模式），关闭页面后进度会丢失。请先下载备份。</b></p>'}
    <p class="small muted">${S.lastBackup ? `上次备份：${dkey(new Date(S.lastBackup))}` : '还没有备份过'}</p>
    <div class="row"><button class="btn" type="button" data-dl>下载备份文件</button>
      <label class="btn" for="imp-file">导入备份文件</label><input type="file" id="imp-file" accept="application/json,.json" hidden>
      <button class="btn" type="button" data-copy>复制备份文本</button></div>
    <textarea id="imp-text" placeholder="也可以把备份文本粘贴到这里，然后点「导入文本」" aria-label="备份文本"></textarea>
    <div class="row"><button class="btn" type="button" data-imp>导入文本</button></div>
    <div data-reset-area class="row"><button class="btn danger" type="button" data-reset>清空全部进度</button></div>
  </section>`);
  const dump = backupJSON;
  bk.querySelector('[data-dl]').onclick = downloadBackup;
  bk.querySelector('[data-copy]').onclick = () => {
    const ta = bk.querySelector('#imp-text'); ta.value = dump();
    markBackedUp();
    navigator.clipboard.writeText(ta.value).then(() => toast('已复制备份文本'), () => { ta.select(); toast('请手动复制选中的文本'); });
  };
  const importText = txt => {
    try {
      const o = JSON.parse(txt);
      if (!o || o.app !== 'nihongo-dojo' || typeof o.xp !== 'number') throw new Error();
      delete o.app; delete o.v; S = Object.assign(blank(), o); S.onboarded = true; save(); applyTheme(); startPetals(); toast('导入成功，欢迎回来'); go('home');
    } catch (e) { toast('导入失败：这不是日语道场的备份'); }
  };
  bk.querySelector('#imp-file').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(importText); };
  bk.querySelector('[data-imp]').onclick = () => importText(bk.querySelector('#imp-text').value);
  bk.querySelector('[data-reset]').onclick = () => {
    const area = bk.querySelector('[data-reset-area]');
    area.innerHTML = '<div class="confirm"><span>确定清空？经验、打卡、单词卡和成就都会删除，无法恢复。</span><button class="btn danger" type="button" data-yes>确定清空</button><button class="btn" type="button" data-no>取消</button></div>';
    area.querySelector('[data-yes]').onclick = () => { const th = S.theme; S = blank(); S.theme = th; save(); toast('已清空'); go('home'); };
    area.querySelector('[data-no]').onclick = render;
  };

  const counts = LEVELS.map(L => `<tr><td>${L}</td><td>${VOCAB[L].length}</td><td>${KANJI[L].length}</td><td>${GRAM[L].length}</td></tr>`).join('');
  const about = h(`<section class="panel"><h2>关于内容</h2>
    <h3>日语</h3>
    <p class="small">单词约 8,000 个、汉字 2,211 个、语法 176 个句型，覆盖 JLPT N5–N1；另有阅读文章（「日本生活」每天上新一篇）、商务日语、150 道听力题和模拟考。中文释义、例句、文章和题目由本站编写，未经专业审核，备考时请配合官方真题和教材。</p>
    <p class="small muted">数据来源：单词表 <a href="https://github.com/jamsinclair/open-anki-jlpt-decks" target="_blank" rel="noopener">open-anki-jlpt-decks</a>（MIT），基于 <a href="http://www.tanos.co.uk/jlpt/" target="_blank" rel="noopener">Jonathan Waller 的 JLPT 资料</a>（CC BY）；汉字 <a href="https://github.com/davidluzgouveia/kanji-data" target="_blank" rel="noopener">kanji-data</a>（MIT）与 KANJIDIC；词典英文释义 <a href="https://www.edrdg.org/jmdict/j_jmdict.html" target="_blank" rel="noopener">JMdict</a>（EDRDG，CC BY-SA 4.0）。</p>
    <p class="small muted">音声：<a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener">VOICEVOX</a>:冥鳴ひまり（<a href="https://meimeihimari.wixsite.com/himari/terms-of-use" target="_blank" rel="noopener">利用規約</a>）、VOICEVOX:玄野武宏、VOICEVOX:九州そら、VOICEVOX:春日部つむぎ、VOICEVOX:雀松朱司（听力）。</p>
    <div class="list-wrap"><table class="list"><thead><tr><th>级别</th><th>单词</th><th>汉字</th><th>语法</th></tr></thead><tbody>${counts}</tbody></table></div>
    <p class="small muted">阅读文章的照片来自 <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>，均为可自由使用的授权（CC0 / 公有领域 / CC BY / CC BY-SA），每张照片下方注明作者和授权。</p>
    <h3>韩语</h3>
    <p class="small">韩文字母 40 个和拼读表；入门单词 500 个、常用句 150 句（本站编写）；分级词库约 1.1 万词（初级 / 中级 / 高级，对应 TOPIK 1–6 级）。</p>
    <p class="small muted">分级词库的词表、汉字和等级来自国立国语院《<a href="https://krdict.korean.go.kr" target="_blank" rel="noopener">한국어기초사전</a>》（<a href="https://creativecommons.org/licenses/by-sa/2.0/kr/" target="_blank" rel="noopener">CC BY-SA 2.0 KR</a>），中文释义为本站编写，同样以 CC BY-SA 2.0 KR 发布。</p>
    <h3>英语</h3>
    <p class="small">26 个字母和美式音标；入门单词 500 个、常用句 150 句（本站编写）；分级词库约 1.5 万词（中考、高考、四级、六级、考研、雅思、托福、GRE）。</p>
    <p class="small muted">分级词库的词表、音标和中文释义来自 <a href="https://github.com/skywind3000/ECDICT" target="_blank" rel="noopener">ECDICT</a>（MIT 许可）。韩语和英语目前使用手机或浏览器自带的语音朗读。</p>
  </section>`);
  const ps = bk.querySelector('[data-persist]');
  requestPersist().then(ok => { ps.innerHTML = ok ? '<span class="tag done">已开启</span> 浏览器已同意持久保存，空间不足时也不会自动清理这里的数据。' : '<span class="tag">未开启</span> 这个浏览器没有同意持久保存，建议添加到主屏幕并定期备份。'; });
  const acc = accountPanel();
  main.append(...[p, installPanel(), acc, voiceP, bk, about].filter(Boolean));
}

/* ---------- 安装到手机（PWA）---------- */
const SITE_URL = 'https://koshokai.github.io/nihonggo-dojo/';
let installEvt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; document.querySelectorAll('[data-install]').forEach(b => { b.hidden = false; }); });
addEventListener('appinstalled', () => { installEvt = null; S.installed = 1; save(); toast('安装好了！以后从主屏幕的图标打开就行'); });
async function doInstall() {
  if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice; if (r.outcome === 'accepted') installEvt = null; return; }
  installGuide();
}
// 安卓上 Chrome、Edge、三星浏览器能一键安装（beforeinstallprompt）；国产浏览器和微信不支持，只能按它们自己的菜单添加到桌面
function androidBrowser() {
  const ua = navigator.userAgent;
  if (/MicroMessenger/i.test(ua)) return 'wechat';
  if (/HuaweiBrowser|HonorBrowser/i.test(ua)) return 'huawei';
  if (/MiuiBrowser|XiaoMi/i.test(ua)) return 'xiaomi';
  if (/HeyTapBrowser|OppoBrowser/i.test(ua)) return 'oppo';
  if (/VivoBrowser/i.test(ua)) return 'vivo';
  if (/UCBrowser|Quark/i.test(ua)) return 'uc';
  if (/MQQBrowser/i.test(ua)) return 'qqbrowser';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Firefox/i.test(ua)) return 'firefox';
  if (/EdgA/i.test(ua)) return 'edge';
  return 'chrome';
}
function installGuide() {
  closeSheet();
  const ios = isIOS(), br = ios ? '' : androidBrowser();
  const inApp = /MicroMessenger| QQ\//i.test(navigator.userAgent);
  const menu = {
    huawei: ['华为 / 荣耀浏览器', '点屏幕下方的 <b>≡</b> 菜单', '点 <b>添加至</b> → <b>桌面</b>（有的版本叫「添加快捷方式到桌面」）'],
    xiaomi: ['小米浏览器', '点屏幕下方的 <b>≡</b> 菜单', '点 <b>添加到桌面</b>（有的版本在「工具箱」里）'],
    oppo: ['OPPO / 一加浏览器', '点屏幕下方的 <b>≡</b> 菜单', '点 <b>添加到</b> → <b>桌面</b>'],
    vivo: ['vivo 浏览器', '点屏幕下方的 <b>≡</b> 菜单', '点 <b>添加到桌面</b>'],
    uc: ['UC / 夸克浏览器', '点屏幕下方的 <b>≡</b> 菜单', '点 <b>添加到桌面</b>（夸克在「工具」→「添加到桌面」）'],
    qqbrowser: ['QQ 浏览器', '点屏幕下方的 <b>≡</b> 菜单', '点 <b>添加到桌面</b>'],
    samsung: ['三星浏览器', '点屏幕下方的 <b>≡</b> 菜单', '点 <b>添加页面到</b> → <b>主屏幕</b>'],
    firefox: ['Firefox', '点右上角 <b>⋮</b> 菜单', '点 <b>安装</b>（或「添加到主屏幕」）'],
    edge: ['Edge', '点屏幕下方的 <b>≡</b> 菜单', '点 <b>添加到手机</b>（或「安装应用」）'],
    chrome: ['Chrome', '点右上角 <b>⋮</b> 菜单', '点 <b>安装应用</b>（或「添加到主屏幕」）']
  }[br];
  const sh = h(`<div class="word-sheet" role="dialog" aria-label="安装到手机">
    <button class="ws-x" type="button" aria-label="关闭">×</button>
    <b>把日语道场装到手机上</b>
    ${inApp ? `<ol class="inst-steps">
      <li>微信 / QQ 里不能添加到桌面。点右上角 <b>…</b>，选 <b>在浏览器中打开</b></li>
      <li>或者点下面的按钮复制链接，粘贴到手机自带的浏览器里打开</li>
      <li>在浏览器里打开后，再点一次「安装到手机」，会告诉你那个浏览器怎么装</li></ol>
      <div class="row"><button class="btn pri" type="button" data-copy>复制链接</button></div>`
    : ios ? `<ol class="inst-steps">
      <li>用 <b>Safari</b> 打开本站</li>
      <li>点屏幕下方的 <b>分享</b> 按钮 <span class="inst-ic">⬆︎</span></li>
      <li>往下滑，点 <b>添加到主屏幕</b></li>
      <li>点右上角 <b>添加</b>，主屏幕上就出现日语道场的图标了</li></ol>`
    : `<p class="small">你现在用的是 <b>${menu[0]}</b>：</p>
      <ol class="inst-steps"><li>${menu[1]}</li><li>${menu[2]}</li><li>确认后，桌面上就出现日语道场的图标了</li></ol>
      <p class="small muted">点了没反应、桌面上没出现图标？安卓手机要允许浏览器「创建桌面快捷方式」：<b>设置 → 应用 → 这个浏览器 → 权限</b>，打开「桌面快捷方式」。</p>
      ${['chrome', 'edge', 'samsung'].includes(br) ? '' : '<p class="small muted">最省事的是装 <b>Chrome</b> 或 <b>Edge</b> 浏览器：打开本站后点「安装到手机」，一键就装好。</p>'}`}
    <div class="small muted">装好以后全屏打开、可以离线使用，进度和网页版是同一份。</div>
  </div>`);
  document.body.append(sh);
  sh.querySelector('.ws-x').onclick = closeSheet;
  const cp = sh.querySelector('[data-copy]');
  if (cp) cp.onclick = e => { e.stopPropagation(); navigator.clipboard.writeText(SITE_URL).then(() => toast('链接已复制，去浏览器里粘贴打开'), () => toast(SITE_URL)); };
}
function installPanel() {
  const p = h(`<section class="panel"><h2>安装到手机 · 分享</h2>
    ${isStandalone() ? '<p class="small"><span class="tag done">已安装</span> 你正在使用安装版。</p>'
      : `<p class="small muted">装到主屏幕后，像 App 一样全屏打开，没有网络也能学。</p>
         <div class="row"><button class="btn pri" type="button" data-install-btn>安装到手机</button></div>`}
    <div class="share-box"><img src="share-qr.png" width="140" height="140" alt="日语道场的二维码"><div>
      <p class="small">把这个二维码或链接发给朋友，扫码就能用：</p>
      <p class="small" lang="en"><a href="${SITE_URL}">${SITE_URL}</a></p>
      <div class="row"><button class="btn" type="button" data-share>${navigator.share ? '分享' : '复制链接'}</button></div>
    </div></div>
  </section>`);
  const ib = p.querySelector('[data-install-btn]');
  if (ib) ib.onclick = e => { e.stopPropagation(); doInstall(); };
  p.querySelector('[data-share]').onclick = () => {
    const data = { title: '日语道场', text: '免费学日语：从五十音到 N1，单词、语法、阅读、商务日语、模拟考', url: SITE_URL };
    if (navigator.share) navigator.share(data).catch(() => {});
    else navigator.clipboard.writeText(SITE_URL).then(() => toast('链接已复制'), () => toast(SITE_URL));
  };
  return p;
}

/* ---------- 启动 ---------- */
applyTheme();
checkBadges();
render();
initGlobalSearch();
initTrackSwitch();
applyTrack((location.hash || '#home').slice(1).split('/')[0]);
cloudInit();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // 新版本的离线缓存接管页面时刷新一次，保证看到的是最新代码（第一次安装不刷新）
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
}
startPetals();
if (S.onboarded) requestPersist();
// 例句库有 3 MB 多，等页面出来以后再在后台加载；加载完后单词页、词典页刷新一下就能看到
(() => {
  const s = document.createElement('script');
  s.src = 'examples.js'; s.async = true;
  s.onload = () => {
    if (typeof CORPUS !== 'undefined') CORPUS = null;
    const v = (location.hash || '#home').slice(1).split('/')[0];
    if (['vocab', 'kanji'].includes(v)) render();
  };
  document.body.append(s);
})();
if (hasTTS) speechSynthesis.onvoiceschanged = () => { if ((location.hash || '').slice(1) === 'me') render(); };
