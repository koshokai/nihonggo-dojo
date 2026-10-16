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

/* ---------- 数据 ---------- */
const VOCAB = {}, KANJI = {}, GRAM = {}, ITEMS = {};
for (const L of LEVELS) {
  VOCAB[L] = VOCAB_RAW[L].trim().split('\n').map(l => { const [w, r, m] = l.split('|'); return { id: `v|${L}|${w}`, type: 'v', L, w, r, m }; });
  KANJI[L] = KANJI_RAW[L].trim().split('\n').map(l => { const [k, on, kun, m] = l.split('|'); return { id: `k|${L}|${k}`, type: 'k', L, k, on, kun, m }; });
  GRAM[L] = GRAMMAR[L].map((g, i) => ({
    id: `g|${L}|${i}`, type: 'g', L, p: g[0], m: g[1], how: g[2], s: g[3], t: g[4], ex: g[5] || [],
    frag: g[3].match(/\[(.+?)\]/)[1], full: g[3].replace(/[[\]]/g, ''), blank: g[3].replace(/\[.+?\]/, '＿＿＿')
  }));
  [...VOCAB[L], ...KANJI[L], ...GRAM[L]].forEach(it => { ITEMS[it.id] = it; });
}

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
const blank = () => ({ xp: 0, days: {}, goal: 50, newPerDay: 10, level: 'N5', srs: {}, wrong: {}, badges: {}, exams: [], kanaRight: 0, goalDays: {}, newLog: {}, best: 0, fixed: 0, theme: '' });
function load() {
  try { const t = localStorage.getItem(KEY); if (t) return Object.assign(blank(), JSON.parse(t)); } catch (e) { /* 浏览器禁用存储时从空进度开始 */ }
  return blank();
}
let S = load();
let storageOk = true;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; } catch (e) { storageOk = false; }
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
  { id: 'n1', ch: '頂', name: '登顶', desc: 'N1 模拟考合格', test: () => S.exams.some(e => e.L === 'N1' && e.score / e.total >= .6) }
];
function checkBadges() {
  for (const b of BADGES) {
    if (!S.badges[b.id] && b.test()) { S.badges[b.id] = dkey(); toast(`获得印章「${b.ch}・${b.name}」`); celebrate(); }
  }
}

/* ---------- 发音 ---------- */
let jaVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices();
  jaVoice = vs.find(v => /^ja/i.test(v.lang) && /Google|Kyoko|Otoya|Nanami|Haruka/i.test(v.name)) || vs.find(v => /^ja/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text) {
  if (!('speechSynthesis' in window)) { toast('这个浏览器不支持朗读'); return; }
  const u = new SpeechSynthesisUtterance(text.replace(/[～~＿[\]]/g, ''));
  u.lang = 'ja-JP'; u.rate = .9; if (jaVoice) u.voice = jaVoice;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
  if (!jaVoice && speechSynthesis.getVoices().length) toast('没有找到日语语音，可在系统设置里添加日语语音包');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-say]');
  if (b) { e.stopPropagation(); speak(b.dataset.say); }
}, true);

/* ---------- 小部件 ---------- */
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}
function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.getElementById('confetti'), ctx = cv.getContext('2d');
  const W = cv.width = innerWidth, H = cv.height = innerHeight;
  const css = getComputedStyle(document.documentElement);
  const cols = ['--shu', '--ai', '--ok', '--heat2'].map(v => css.getPropertyValue(v).trim());
  const ps = Array.from({ length: 140 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - .5) * .3, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) { p.vy += .4; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); }
    if (t - t0 < 2200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  })(t0);
}
function updateTop() {
  const s = streak();
  document.getElementById('streak-n').textContent = s;
  document.getElementById('chip-streak').classList.toggle('lit', todayXP() > 0);
  document.getElementById('xp-today').textContent = todayXP();
  document.getElementById('xp-goal').textContent = '/' + S.goal;
  document.getElementById('chip-xp').classList.toggle('lit', todayXP() >= S.goal);
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
const newList = L => VOCAB[L].filter(v => !S.srs[v.id]);

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
        <span class="corner-r">${speakBtn(v.w, '朗读单词')}</span>
        <div class="word" lang="ja">${esc(v.w)}</div>
        <div data-ans hidden><div class="reading" lang="ja">${esc(v.r)}</div><div class="meaning">${esc(v.m)}</div></div>
        <div class="hint" data-hint>先想一想读音和意思，再点卡片看答案（空格键）</div>
      </div>
      <div class="grades" data-grades hidden style="margin-top:12px">
        ${['重来', '困难', '记得', '简单'].map((t, g) => `<button class="btn g${g}" type="button" data-g="${g}">${t}<small>${fmtDays(preview(c, g))}</small></button>`).join('')}
      </div>`;
    const card = stage.querySelector('[data-card]');
    const reveal = () => {
      if (revealed) return; revealed = true;
      stage.querySelector('[data-ans]').hidden = false; stage.querySelector('[data-hint]').hidden = true;
      stage.querySelector('[data-grades]').hidden = false; speak(v.w);
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
const KIND_NAMES = { reading: '读音', meaning: '词义', word: '选词', kanji: '汉字', grammar: '语法', kana: '假名' };
function qVocab(v, kind) {
  const same = VOCAB[v.L], all = allVocab();
  const near = (arr, fn) => arr.length >= 4 ? arr : all.map(fn);
  if (kind === 'reading' && v.w !== v.r) {
    const pool = same.filter(x => x.w !== x.r && x.r !== v.r).sort((a, b) => Math.abs(a.r.length - v.r.length) - Math.abs(b.r.length - v.r.length)).slice(0, 10).map(x => x.r);
    return makeQ(v, 'reading', distract(v.r, near(pool, x => x.r)), v.r, {
      prompt: `<div class="eyebrow">选择正确的读音</div><div class="q-big" lang="ja">${esc(v.w)}</div>`, optLang: 'ja', say: v.w,
      explain: `<span lang="ja">${esc(v.w)}（${esc(v.r)}）</span>：${esc(v.m)}`
    });
  }
  if (kind === 'word') {
    return makeQ(v, 'word', distract(v.w, same.map(x => x.w)), v.w, {
      prompt: `<div class="eyebrow">哪个日语单词是这个意思？</div><div class="q-big" style="font-family:var(--f-ui);font-size:1.8rem">${esc(v.m)}</div>`, optLang: 'ja', say: v.w,
      explain: `<span lang="ja">${esc(v.w)}（${esc(v.r)}）</span>：${esc(v.m)}`
    });
  }
  return makeQ(v, 'meaning', distract(v.m, same.map(x => x.m)), v.m, {
    prompt: `<div class="eyebrow">这个单词是什么意思？</div><div class="q-big" lang="ja">${esc(v.w)}</div>`, say: v.w,
    explain: `<span lang="ja">${esc(v.w)}（${esc(v.r)}）</span>：${esc(v.m)}`
  });
}
function qKanji(k, kind = Math.random() < .5 ? 'meaning' : 'reading') {
  const same = KANJI[k.L];
  const exp = `<span lang="ja">${esc(k.k)}</span>　音读 <span lang="ja">${esc(k.on)}</span>　训读 <span lang="ja">${esc(k.kun)}</span>　${esc(k.m)}`;
  if (kind === 'reading') {
    return makeQ(k, 'kanji', distract(k.on, same.map(x => x.on)), k.on, { prompt: `<div class="eyebrow">这个汉字的音读是？</div><div class="q-big" lang="ja">${esc(k.k)}</div>`, optLang: 'ja', explain: exp });
  }
  return makeQ(k, 'kanji', distract(k.m, same.map(x => x.m)), k.m, { prompt: `<div class="eyebrow">这个汉字是什么意思？</div><div class="q-big" lang="ja">${esc(k.k)}</div>`, explain: exp });
}
function qGrammar(g) {
  let pool = GRAM[g.L].filter(x => x.frag !== g.frag && !g.ex.includes(x.frag)).map(x => x.frag);
  if (pool.length < 3) pool = pool.concat(LEVELS.flatMap(L => GRAM[L]).filter(x => x.frag !== g.frag && !g.ex.includes(x.frag)).map(x => x.frag));
  const sent = esc(g.blank).replace('＿＿＿', '<span class="blank">　？　</span>');
  return makeQ(g, 'grammar', distract(g.frag, pool), g.frag, {
    prompt: `<div class="eyebrow">选择填入空白处的内容</div><div class="q-sent" lang="ja">${sent}</div>`, optLang: 'ja', say: g.full,
    explain: `<b lang="ja">${esc(g.p)}</b>：${esc(g.m)}<br><span lang="ja">${esc(g.full)}</span><br><span class="muted">${esc(g.t)}</span>`
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
function runQuiz(host, qs, { title, exam = false, minutes = 0, fromWrong = false, xpEach = 10, onDone }) {
  let i = 0, combo = 0, answered = false;
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
    if (!exam) extra.innerHTML = combo >= 3 ? `<span class="combo">${combo} 连对</span>` : '';
    stage.innerHTML = `<div class="q-prompt pop">${q.prompt}${q.say && !exam ? speakBtn(q.say) : ''}</div>
      <div class="opts">${q.options.map((o, j) => `<button class="opt" type="button" data-o="${j}"><span class="k">${j + 1}</span><span ${q.optLang ? `lang="${q.optLang}"` : ''}>${esc(o)}</span></button>`).join('')}</div>
      <div data-fb></div>`;
    stage.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => pick(+b.dataset.o); });
    keyHandler = e => {
      if (!answered && '1234'.includes(e.key) && +e.key <= q.options.length) pick(+e.key - 1);
      else if (answered && e.key === 'Enter') next();
    };
  }
  function pick(j) {
    if (answered) return; answered = true;
    const q = qs[i], ok = j === q.answer;
    res.push({ q, pick: j, ok });
    if (q.id) {
      if (!ok) S.wrong[q.id] = { n: ((S.wrong[q.id] || {}).n || 0) + 1, t: Date.now() };
      else if (fromWrong && S.wrong[q.id]) { delete S.wrong[q.id]; S.fixed++; }
    }
    if (q.kind === 'kana' && ok) S.kanaRight++;
    if (exam) { save(); next(); return; }
    const btns = stage.querySelectorAll('[data-o]');
    btns.forEach((b, k) => { b.disabled = true; if (k === q.answer) b.classList.add('right'); else if (k === j) b.classList.add('wrong'); });
    combo = ok ? combo + 1 : 0;
    if (ok) addXP(xpEach + (combo && combo % 5 === 0 ? 5 : 0)); else save();
    if (q.say) speak(q.say);
    stage.querySelector('[data-fb]').innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}"><b>${ok ? (combo >= 5 && combo % 5 === 0 ? `答对了！${combo} 连对，额外 +5` : '答对了') : '答错了，已记入错题本'}</b><div>${q.explain || ''}</div></div>
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn pri" type="button" data-next>${i + 1 < qs.length ? '下一题' : '查看结果'}（Enter）</button></div>`;
    stage.querySelector('[data-next]').onclick = next;
    stage.querySelector('[data-next]').focus({ preventScroll: true });
  }
  function next() { i++; if (i < qs.length && res.length < qs.length) show(); else finish(); }
  function finish() {
    clearInterval(examTimer); keyHandler = null;
    const score = res.filter(r => r.ok).length;
    onDone({ res, score, total: qs.length });
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
const VIEWS = { home: viewHome, kana: viewKana, vocab: viewVocab, kanji: viewKanji, grammar: viewGrammar, exam: viewExam, me: viewMe };
function render() {
  const v = (location.hash || '#home').slice(1);
  const view = VIEWS[v] ? v : 'home';
  clearInterval(examTimer); keyHandler = null;
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.go === view));
  const on = document.querySelector('.tabs a.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  main.innerHTML = '';
  VIEWS[view]();
  updateTop();
}
addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
const go = view => { if (location.hash === '#' + view) render(); else location.hash = view; };

/* 今天 */
function viewHome() {
  const tx = todayXP(), pct = Math.min(1, tx / S.goal), C = 2 * Math.PI * 52;
  const ri = rankOf(S.xp), rk = RANKS[ri], nx = RANKS[ri + 1];
  const due = dueList(LEVELS).length, nl = Math.min(newLeft(), newList(S.level).length), wrongN = Object.keys(S.wrong).length;
  const pv = PROVERBS[Math.floor(startOfToday() / DAY) % PROVERBS.length];
  const learnedN = allVocab().filter(learned).length, masteredN = allVocab().filter(mastered).length;
  const s = streak();
  const greet = (() => { const hr = new Date().getHours(); return hr < 11 ? 'おはようございます' : hr < 18 ? 'こんにちは' : 'こんばんは'; })();

  main.append(h(`<section class="panel">
    <div class="hero">
      <div class="ring ${pct >= 1 ? 'full' : ''}"><svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="52"/><circle class="val" cx="60" cy="60" r="52" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
        <div class="ring-c"><b>${tx}</b><span class="small muted">/ ${S.goal} 经验</span></div></div>
      <div class="rank">
        <div class="eyebrow" lang="ja">${greet}</div>
        <div class="rank-name"><span lang="ja">${rk[1]}</span> <span class="small muted" style="font-family:var(--f-ui);font-weight:400">${rk[2]}</span></div>
        <div class="bar"><i style="width:${nx ? (S.xp - rk[0]) / (nx[0] - rk[0]) * 100 : 100}%"></i></div>
        <p class="small muted">${nx ? `累计 ${S.xp} 经验，距离「${nx[2]}」还差 ${nx[0] - S.xp}` : `累计 ${S.xp} 经验，已是最高段位`}</p>
        <p>${pct >= 1 ? `今天的目标完成了。${s >= 2 ? `已经连续 ${s} 天，` : ''}明天继续！` : tx > 0 ? `再拿 ${S.goal - tx} 经验就完成今天的目标。` : s > 0 ? `已经连续 ${s} 天，今天也来学一点，别断了。` : '每天十分钟，从今天开始。'}</p>
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

  const tasks = [
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

  main.append(h(`<div class="proverb"><span class="eyebrow">今日一句</span><div class="row"><span class="jp-big" lang="ja">${pv[0]}</span>${speakBtn(pv[0])}</div><span class="small muted" lang="ja">${pv[1]}</span><span>${pv[2]}</span></div>`));

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
    </div>
    <p class="small muted">单词卡用间隔重复：记得越牢，下次出现越晚。看完答案后按「重来 / 困难 / 记得 / 简单」评分，键盘可用 1–4。</p>
  </section>`);
  bindLevel(top);
  top.querySelector('[data-study]').onclick = () => {
    const ids = [...shuffle(dueList([L])), ...newList(L).slice(0, nl)].map(v => v.id);
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    startCards(host, ids, `背单词 · ${L}`, () => render());
  };
  const vq = () => {
    const qs = sample(list, 10).map(v => qVocab(v, sample(['reading', 'meaning', 'word'], 1)[0]));
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    runQuiz(host, qs, { title: `单词测验 · ${L}`, onDone: r => { if (!r) return render(); quizSummary(host, r, { title: `单词测验 · ${L}`, again: vq }); } });
  };
  top.querySelector('[data-quiz]').onclick = vq;

  const tbl = h(`<section class="panel">
    <div class="row"><input type="search" id="v-search" placeholder="搜索单词、读音或中文" value="${esc(vocabSearch)}" aria-label="搜索单词">
      <select id="v-filter" aria-label="筛选"><option value="all">全部</option><option value="new">没学过</option><option value="learn">学习中</option><option value="done">已掌握</option></select></div>
    <div class="list-wrap"><table class="list"><thead><tr><th>单词</th><th>读音</th><th>意思</th><th>状态</th><th></th></tr></thead><tbody></tbody></table></div>
  </section>`);
  const fill = () => {
    const q = vocabSearch.trim();
    const rows = list.filter(v => !q || v.w.includes(q) || v.r.includes(q) || v.m.includes(q)).filter(v => {
      const st = mastered(v) ? 'done' : learned(v) ? 'learn' : 'new'; return vocabFilter === 'all' || vocabFilter === st;
    });
    tbl.querySelector('tbody').innerHTML = rows.map(v => {
      const st = mastered(v) ? '<span class="tag done">已掌握</span>' : learned(v) ? '<span class="tag learn">学习中</span>' : '<span class="tag">新</span>';
      return `<tr><td class="w" lang="ja">${esc(v.w)}</td><td class="r" lang="ja">${esc(v.r)}</td><td>${esc(v.m)}</td><td>${st}</td><td>${speakBtn(v.w)}</td></tr>`;
    }).join('') || '<tr><td colspan="5" class="muted">没有符合条件的单词</td></tr>';
  };
  tbl.querySelector('#v-filter').value = vocabFilter;
  tbl.querySelector('#v-search').oninput = e => { vocabSearch = e.target.value; fill(); };
  tbl.querySelector('#v-filter').onchange = e => { vocabFilter = e.target.value; fill(); };
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
    <div class="row"><button class="btn pri" type="button" data-quiz>汉字测验 10 题</button><span class="small muted">本级 ${list.length} 个汉字，点击查看读音和相关单词</span></div>
    <div class="kanji-grid">${list.map(k => `<button type="button" class="kj" data-k="${esc(k.id)}" lang="ja" aria-label="${esc(k.k)}">${esc(k.k)}</button>`).join('')}</div>
  </section>`);
  bindLevel(p);
  const detail = () => {
    const k = kanjiSel;
    const words = allVocab().filter(v => v.w.includes(k.k)).slice(0, 6);
    p.querySelector('[data-detail]').innerHTML = `<div class="kj-big" lang="ja">${esc(k.k)}</div>
      <div style="display:grid;gap:8px;min-width:0"><dl class="kv"><dt>意思</dt><dd>${esc(k.m)}</dd><dt>音读</dt><dd lang="ja">${esc(k.on)}</dd><dt>训读</dt><dd lang="ja">${esc(k.kun)}</dd></dl>
      ${words.length ? `<div class="row small">${words.map(v => `<span class="tag learn" lang="ja">${esc(v.w)}（${esc(v.r)}）</span>`).join('')}</div>` : '<span class="small muted">单词库里暂时没有含这个字的词</span>'}</div>`;
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
  runQuiz(host, sample(GRAM[L], Math.min(8, GRAM[L].length)).map(qGrammar), {
    title: `语法练习 · ${L}`, onDone: r => { if (!r) return back(); quizSummary(host, r, { title: `语法练习 · ${L}`, again: () => grammarQuiz(L, back) }); }
  });
}
function viewGrammar() {
  const L = S.level;
  const p = h(`<section class="panel">
    <div class="row between"><h2>语法 · ${L}</h2>${levelSeg(L)}</div>
    <div class="row"><button class="btn pri" type="button" data-quiz>语法填空 8 题</button><span class="small muted">本级 ${GRAM[L].length} 个句型，点开看接续和例句</span></div>
    <div style="display:grid;gap:8px">${GRAM[L].map(g => `<details class="gp"><summary><span class="pat" lang="ja">${esc(g.p)}</span><span class="muted">${esc(g.m)}</span></summary>
      <div class="gp-body"><div><span class="small muted">接续</span>　${esc(g.how)}</div>
      <div class="ex"><div style="flex:1;min-width:0"><div class="jp" lang="ja">${esc(g.s).replace(/\[(.+?)\]/, '<mark>$1</mark>')}</div><div class="small muted">${esc(g.t)}</div></div>${speakBtn(g.full)}</div></div></details>`).join('')}</div>
  </section>`);
  bindLevel(p);
  p.querySelector('[data-quiz]').onclick = () => grammarQuiz(L, render);
  main.append(p);
}

/* 模拟考 */
function buildExam(L) {
  const vs = VOCAB[L];
  const readable = shuffle(vs.filter(v => v.w !== v.r));
  const rest = shuffle(vs.filter(v => !readable.slice(0, 5).includes(v)));
  return [
    ...readable.slice(0, 5).map(v => qVocab(v, 'reading')),
    ...rest.slice(0, 5).map(v => qVocab(v, 'meaning')),
    ...rest.slice(5, 8).map(v => qVocab(v, 'word')),
    ...sample(KANJI[L], 3).map(k => qKanji(k)),
    ...sample(GRAM[L], 4).map(qGrammar)
  ];
}
function viewExam() {
  const L = S.level;
  const hist = S.exams.slice(-6).reverse();
  const p = h(`<section class="panel">
    <div class="row between"><h2>模拟考 · ${L}</h2>${levelSeg(L)}</div>
    <p>20 道题，限时 15 分钟：读音 5、词义 5、选词 3、汉字 3、语法 4。考试中不显示对错，交卷后统一批改。正确率 60% 以上盖「合格」章。</p>
    <div class="row"><button class="btn pri" type="button" data-start>开始考试</button></div>
    ${hist.length ? `<h3>最近成绩</h3><div class="list-wrap"><table class="list"><thead><tr><th>日期</th><th>级别</th><th>得分</th><th>结果</th></tr></thead><tbody>${hist.map(e => `<tr><td>${e.date}</td><td>${e.L}</td><td>${e.score}/${e.total}</td><td>${e.score / e.total >= .6 ? '<span class="tag done">合格</span>' : '<span class="tag">未合格</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
  </section>`);
  bindLevel(p);
  const start = () => {
    const qs = buildExam(L);
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    runQuiz(host, qs, {
      title: `${L} 模拟考`, exam: true, minutes: 15, onDone: r => {
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
    <p class="small muted">经验怎么来：测验答对 10（假名 5），单词卡每张 5，模拟考每题 10，合格再加 50，每 5 连对额外 5。</p>
  </section>`);
  bindLevel(p);
  p.querySelectorAll('[data-goal]').forEach(b => { b.onclick = () => { S.goal = +b.dataset.goal; save(); render(); }; });
  p.querySelectorAll('[data-new]').forEach(b => { b.onclick = () => { S.newPerDay = +b.dataset.new; save(); render(); }; });
  p.querySelectorAll('[data-theme-set]').forEach(b => { b.onclick = () => { S.theme = b.dataset.themeSet; applyTheme(); save(); render(); }; });

  const bk = h(`<section class="panel"><h2>备份与换设备</h2>
    <p class="small muted">进度只存在这个浏览器里。换手机或电脑前，先下载备份文件，到新设备上导入即可。${storageOk ? '' : '<b>当前浏览器无法保存进度（可能是无痕模式），关闭页面后进度会丢失。</b>'}</p>
    <div class="row"><button class="btn" type="button" data-dl>下载备份文件</button>
      <label class="btn" for="imp-file">导入备份文件</label><input type="file" id="imp-file" accept="application/json,.json" hidden>
      <button class="btn" type="button" data-copy>复制备份文本</button></div>
    <textarea id="imp-text" placeholder="也可以把备份文本粘贴到这里，然后点「导入文本」" aria-label="备份文本"></textarea>
    <div class="row"><button class="btn" type="button" data-imp>导入文本</button></div>
    <div data-reset-area class="row"><button class="btn danger" type="button" data-reset>清空全部进度</button></div>
  </section>`);
  const dump = () => JSON.stringify(Object.assign({ app: 'nihongo-dojo', v: 1 }, S));
  bk.querySelector('[data-dl]').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([dump()], { type: 'application/json' }));
    a.download = `nihongo-dojo-${dkey()}.json`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  bk.querySelector('[data-copy]').onclick = () => {
    const ta = bk.querySelector('#imp-text'); ta.value = dump();
    navigator.clipboard.writeText(ta.value).then(() => toast('已复制备份文本'), () => { ta.select(); toast('请手动复制选中的文本'); });
  };
  const importText = txt => {
    try {
      const o = JSON.parse(txt);
      if (!o || o.app !== 'nihongo-dojo' || typeof o.xp !== 'number') throw new Error();
      delete o.app; delete o.v; S = Object.assign(blank(), o); save(); applyTheme(); toast('导入成功'); render();
    } catch (e) { toast('导入失败：这不是日语道场的备份'); }
  };
  bk.querySelector('#imp-file').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(importText); };
  bk.querySelector('[data-imp]').onclick = () => importText(bk.querySelector('#imp-text').value);
  bk.querySelector('[data-reset]').onclick = () => {
    const area = bk.querySelector('[data-reset-area]');
    area.innerHTML = '<div class="confirm"><span>确定清空？经验、打卡、单词卡和成就都会删除，无法恢复。</span><button class="btn danger" type="button" data-yes>确定清空</button><button class="btn" type="button" data-no>取消</button></div>';
    area.querySelector('[data-yes]').onclick = () => { const th = S.theme; S = blank(); S.theme = th; save(); toast('已清空'); render(); };
    area.querySelector('[data-no]').onclick = render;
  };

  const counts = LEVELS.map(L => `<tr><td>${L}</td><td>${VOCAB[L].length}</td><td>${KANJI[L].length}</td><td>${GRAM[L].length}</td></tr>`).join('');
  const about = h(`<section class="panel"><h2>关于内容</h2>
    <p class="small">每个级别收录的是该级别的核心精选，不是完整考纲。适合作为每天的练习和查漏补缺，备考时请配合官方真题和教材。发音使用浏览器自带的日语语音。</p>
    <div class="list-wrap"><table class="list"><thead><tr><th>级别</th><th>单词</th><th>汉字</th><th>语法</th></tr></thead><tbody>${counts}</tbody></table></div>
  </section>`);
  main.append(p, bk, about);
}

/* ---------- 启动 ---------- */
applyTheme();
checkBadges();
render();
