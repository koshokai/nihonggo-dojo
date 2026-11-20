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
const speakBtn = (text, label) => `<button class="speak" type="button" data-say="${esc(text)}" aria-label="${esc(label || tj('朗读', '読み上げ'))}">${SPEAK_SVG}</button>`;
// 例句的朗读按钮：免费用户有每日额度（vip.js exAudioOK）
const exSpeakBtn = text => speakBtn(text, tj('朗读例句', '例文を読み上げ')).replace('<button ', '<button data-exq ');
// 例句：把单词（动词、形容词取词干）在句子里标出来
// 例句：优先用这个词的专属例句；没有的话，从全站例句库（单词例句 + 语法例句）里找含这个词的句子
const exList = w => {
  const own = (typeof EXAMPLES !== 'undefined' && EXAMPLES[w]) || [];
  if (own.length >= 3 || typeof sentencesWith !== 'function' || w.length < 2 && !/[\u4e00-\u9fff]/.test(w)) return own;
  const seen = new Set(own.map(x => x[0]));
  const more = sentencesWith(w.length > 1 && /[るうくすつぬむぶぐい]$/.test(w) ? w.slice(0, -1) : w, 5).filter(x => !seen.has(x.jp)).map(x => [x.jp, x.kana, x.zh, x.furi]);
  return own.concat(more).slice(0, 5);
};
function markWord(jp, w, furi, tap) {
  // 词条里的「～」和括号说明不算（「～円」找「円」，「パート (タイム)」找「パート」，「いくら～ても」找「いくら」）
  if (/[～〜(（]/.test(w)) w = w.replace(/\s*[(（][^)）]*[)）]\s*/g, '').split(/[～〜]/).map(x => x.trim()).filter(Boolean)[0] || w;
  const stem = w.length > 1 && /[るうくすつぬむぶぐい]$/.test(w) ? w.slice(0, -1) : w.replace(/する$/, '');
  const i = jp.indexOf(stem);
  if (tap) return jaTapHTML(jp, furi, i, i < 0 ? -1 : i + stem.length);   // 例句里的词可以点开看释义（read.js）
  if (furi) return furiHTML(jp, furi, i, i < 0 ? -1 : i + stem.length);
  return i < 0 ? esc(jp) : esc(jp.slice(0, i)) + '<mark>' + esc(stem) + '</mark>' + esc(jp.slice(i + stem.length));
}
// 汉字头上标假名：furi 是「起点.长度读音,…」（tools/furigana.py 生成）；[a, b) 范围内的字加 <mark>
function furiHTML(jp, furi, a = -1, b = -1) {
  const notes = (furi || '').split(',').map(x => x.match(/^(\d+)\.(\d+)(.*)$/)).filter(Boolean).map(m => ({ s: +m[1], e: +m[1] + +m[2], r: m[3] }));
  const units = [];
  for (let i = 0, k = 0; i < jp.length;) {
    const n = notes[k];
    if (n && n.s === i) { const seg = jp.slice(i, n.e); units.push({ s: i, e: n.e, html: typeof furiWanted !== 'function' || furiWanted(seg) ? `<ruby>${esc(seg)}<rt>${esc(n.r)}</rt></ruby>` : esc(seg) }); i = n.e; k++; }
    else { units.push({ s: i, e: i + 1, html: esc(jp[i]) }); i++; }
  }
  let out = '', open = false;
  for (const u of units) {
    const m = a >= 0 && u.s < b && u.e > a;
    if (m && !open) { out += '<mark>'; open = true; }
    if (!m && open) { out += '</mark>'; open = false; }
    out += u.html;
  }
  return out + (open ? '</mark>' : '');
}
// 学习内容里没有自带假名的日语（今日一句、单词词头、阅读标题、商务、说明里的「」引用……）也标假名。考试、测验题不用这些函数。
// jrWord(词, 读音)：按读音对齐（假名部分原样对上，汉字串分到读音），单词卡这种「词 + 读音」的数据用它，结果和读音完全一致
const KJ = /[㐀-鿿々〆ヶ]/, toHiraS = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
function jrWord(w, r) {
  if (!w || !r || !KJ.test(w)) return esc(w || '');
  const clean = s => toHiraS(s).replace(/[\s・～〜()（）]/g, '');
  const parts = w.match(/[㐀-鿿々〆ヶ]+|[^㐀-鿿々〆ヶ]+/g);
  let m = null;
  try { m = new RegExp('^' + parts.map(p => KJ.test(p) ? '(.+?)' : '(' + clean(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')').join('') + '$').exec(clean(r)); } catch (e) { m = null; }
  if (!m) return typeof furiWanted !== 'function' || furiWanted(w) ? `<ruby>${esc(w)}<rt>${esc(toHiraS(r))}</rt></ruby>` : esc(w);
  return parts.map((p, i) => KJ.test(p) && (typeof furiWanted !== 'function' || furiWanted(p)) ? `<ruby>${esc(p)}<rt>${esc(m[i + 1])}</rt></ruby>` : esc(p)).join('');
}
// jr(文字, 读音?)：句子查 furi-map.js（生成时用形态分析算好，和人工读音对齐过）；查不到但有读音就按读音对齐；都没有就原样
const jr = (t, r) => {
  if (!t) return '';
  const f = typeof FURI_MAP !== 'undefined' && FURI_MAP[t];
  if (f) return furiHTML(t, f);
  if (r) return jrWord(t, r);
  if (/\s[/／]\s/.test(t)) return t.split(/(\s[/／]\s)/).map((x, i) => i % 2 ? esc(x) : jr(x)).join('');   // 「弊社 / 当社」：每个写法分别查
  const br = t.match(/^([【「『（(〔])(.+?)([】」』）)〕])$/);   // 【御礼】：查括号里的词
  if (br) return esc(br[1]) + jr(br[2]) + esc(br[3]);
  return esc(t);
};
// jrTap(文字, 读音?)：和 jr 一样标假名，查得到假名表的句子还能点词看释义（jaTapHTML，外层要有 .jtap）
const jrTap = (t, r) => { const f = typeof FURI_MAP !== 'undefined' && FURI_MAP[t]; return f && typeof jaTapHTML === 'function' ? jaTapHTML(t, f) : jr(t, r); };
// jrNote(中文说明)：只给「」里引用的日语标假名，其余原样
const jrNote = s => esc(s || '').replace(/「([^「」]{1,40})」/g, (all, q) => { const raw = q.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); const f = typeof FURI_MAP !== 'undefined' && FURI_MAP[raw]; return f ? `「<span class="furi" lang="ja">${furiHTML(raw, f)}</span>」` : all; });
const gramEg = ([s, kana, t, furi]) => ({ s, kana, t, furi, at: s.indexOf('['), frag: s.match(/\[(.+?)\]/)[1], full: s.replace(/[[\]]/g, ''), blank: s.replace(/\[.+?\]/, '＿＿＿') });
// 会员：N3–N1 语法的全部例句（member.js 从服务器取）；不是会员时还原成网站上的 1 句
function gramMember() {
  const back = () => { for (const L of ['N3', 'N2', 'N1']) for (const g of GRAM[L] || []) g.eg = g.eg0.map(gramEg); };
  if (!(typeof isMember === 'function' && isMember('ja')) || typeof memberData !== 'function') return back();
  memberData('ja', 'grammar-member.json').then(d => {
    if (!d || !isMember('ja')) return;
    for (const L in d) { const by = new Map(d[L].map(x => [x.p, x])); for (const g of GRAM[L] || []) { const x = by.get(g.p); if (x && x.eg.length) g.eg = x.eg.map(gramEg); } }
    if ((location.hash || '').startsWith('#grammar') && !busy()) render();
  }).catch(() => {});
}
// 会员：N3–N1 的模拟考题库（member.js 从服务器取）；不是会员时清空（网站上只有 N5、N4）
const JLPT_MEMBER_LV = ['N3', 'N2', 'N1'];
let jlptP = null;
function jlptMember() {
  if (typeof JLPT === 'undefined') return Promise.resolve(false);
  if (!(typeof isMember === 'function' && isMember('ja')) || typeof memberData !== 'function') { for (const L of JLPT_MEMBER_LV) JLPT[L] = []; jlptP = null; return Promise.resolve(false); }
  if (JLPT_MEMBER_LV.every(L => (JLPT[L] || []).length)) return Promise.resolve(true);
  return jlptP || (jlptP = memberData('ja', 'jlpt-member.json').then(d => {
    jlptP = null;
    if (!d || !isMember('ja')) return false;
    for (const L of JLPT_MEMBER_LV) if (d[L]) JLPT[L] = d[L];
    return true;
  }).catch(() => { jlptP = null; return false; }));
}
const exHTML = (w, n = 5) => exList(w).slice(0, n).map(([jp, kana, zh, furi, src]) => `<div class="ex"><div style="flex:1;min-width:0"><div class="jp furi jtap" lang="ja">${markWord(jp, w, furi, 1)}</div><div class="small muted">${esc(zh)}${src === 'T' ? ' <a class="tatoeba" href="https://tatoeba.org" target="_blank" rel="noopener" title="人工翻译例句，CC BY 2.0 FR">Tatoeba</a>' : ''}</div></div>${exSpeakBtn(kana)}${reportBtn(jp, zh)}</div>`).join('');

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
  // 每个句型 3–5 句例句：eg = [{s: 带 [填空] 的句子, kana, t: 译文, frag, full, blank}]（N3–N1 网站上只有 1 句，会员从服务器取全部：gramMember）
  GRAM[L] = GRAMMAR_DATA[L].map(g => ({
    id: `g|${L}|${g.p}`, type: 'g', L, p: g.p, m: g.m, how: g.how, ex: g.ex, eg: g.eg.map(gramEg), eg0: g.eg
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
const blank = () => ({ xp: 0, days: {}, goal: 50, newPerDay: 10, level: 'N5', srs: {}, wrong: {}, badges: {}, exams: [], kanaRight: 0, goalDays: {}, newLog: {}, best: 0, fixed: 0, theme: '', onboarded: false, rate: .8, voice: '', petals: false, autoSpeak: true, lastBackup: 0, lastBackupXp: 0, stages: {}, games: {}, read: {}, biz: {}, voiceSrc: 'vv' });
function load() {
  try { const t = localStorage.getItem(KEY); if (t) return Object.assign(blank(), JSON.parse(t)); } catch (e) { /* 浏览器禁用存储时从空进度开始 */ }
  return blank();
}
let S = load();
if (S.xp > 0) S.onboarded = true;
if (S.voiceSrc === 'tts') S.voiceSrc = 'vv';   // 不再用手机自带的机器朗读（只用生成的人声）
// 新版界面：樱花飘落默认关闭（会分散注意力），想要的人在「我的」里打开
if (!S.uiV2) { S.uiV2 = 1; S.petals = false; }
if (!['ja', 'zh', 'en'].includes(S.track || 'ja')) S.track = 'ja';   // 已删除的语言（韩语）回到日语
// 打开 App 回到上次在学的语言（render：不带 # 打开时去那门语言的首页）。以前是一律回日语首页，三门语言以后改了
const homeHash = () => /^#?(home)?$/.test(location.hash);
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
  const goalHit = S.days[k] >= S.goal && !S.goalDays[k];
  if (goalHit) S.goalDays[k] = 1;
  // 里程碑（每日目标、累计经验、连续天数、升级）：烟花 + 经验火焰 + 吉祥物的一句话（fx.js）
  if (goalHit || r1 > r0 || typeof fxCheck === 'function') {
    if (typeof fxCheck === 'function') fxCheck(S.xp - n, S.xp, n, goalHit, r1 > r0 ? [r1, RANKS[r1][1], uiJa() ? '' : RANKS[r1][2]] : null);
    else if (goalHit || r1 > r0) celebrate();
  }
  if (typeof habitLog === 'function') habitLog();   // 智能提醒：记下平时几点学习（conv.js）
  checkBadges(); save(); updateTop();
}

/* ---------- 成就印章 ---------- */
const learned = v => { const c = S.srs[v.id]; return c && c.r > 0; };
const mastered = v => { const c = S.srs[v.id]; return c && c.i >= 21; };
const allVocab = () => LEVELS.flatMap(L => VOCAB[L]);
// 印章要把三种语言的学习都算进去（学中文、英语的人也能拿到）：单词卡的 id 中文是 zh|…，英语是 en|…
const l2Srs = f => Object.keys(S.srs).filter(id => /^(zh|en)\|/.test(id) && f(S.srs[id])).length;
const wordsLearned = () => allVocab().filter(learned).length + l2Srs(c => c.r > 0);
const wordsMastered = () => allVocab().filter(mastered).length + l2Srs(c => c.i >= 21);
const readsDone = () => Object.keys(S.read || {}).length + Object.keys(S.zhRead || {}).length + Object.keys(S.enRead || {}).length;
// 模拟考：日语 S.exams（L），中文、英语 S.exam2[语言]（lv）
const allExams = () => [...(S.exams || []).map(e => ({ L: e.L, score: e.score, total: e.total })), ...Object.values(S.exam2 || {}).flat().map(e => ({ L: e.lv, score: e.score, total: e.total }))];
const BADGES = [
  { id: 'first', ch: '始', name: '第一步', desc: '获得第一份经验', ja: ['はじめの一歩', '初めて経験値を獲得'], test: () => S.xp > 0 },
  { id: 's3', ch: '三', name: '三日连续', desc: '连续学习 3 天', ja: ['三日連続', '3 日連続で学習'], test: () => S.best >= 3 },
  { id: 's7', ch: '七', name: '一周不断', desc: '连续学习 7 天', ja: ['一週間皆勤', '7 日連続で学習'], test: () => S.best >= 7 },
  { id: 's30', ch: '卅', name: '月之坚持', desc: '连续学习 30 天', ja: ['ひと月の継続', '30 日連続で学習'], test: () => S.best >= 30 },
  { id: 'goal7', ch: '勤', name: '勤勉', desc: '累计 7 天达成每日目标', ja: ['勤勉', '1日の目標を通算 7 日達成'], test: () => Object.keys(S.goalDays).length >= 7 },
  { id: 'kana', ch: '仮', name: '假名达人', desc: '假名测验累计答对 100 次', ja: ['かなの達人', 'かなクイズで通算 100 問正解'], test: () => S.kanaRight >= 100 },
  { id: 'w50', ch: '語', name: '五十词', desc: '学过 50 个单词', ja: ['五十語', '50 語を学習'], test: () => wordsLearned() >= 50 },
  { id: 'w200', ch: '辞', name: '二百词', desc: '学过 200 个单词', ja: ['二百語', '200 語を学習'], test: () => wordsLearned() >= 200 },
  { id: 'm50', ch: '極', name: '牢记于心', desc: '掌握 50 个单词（复习间隔 ≥ 21 天）', ja: ['しっかり定着', '50 語をマスター（復習間隔 21 日以上）'], test: () => wordsMastered() >= 50 },
  { id: 'fix', ch: '改', name: '知错能改', desc: '订正 20 道错题', ja: ['過ちを改む', '間違えた問題を 20 問克服'], test: () => S.fixed >= 20 },
  { id: 'stage', ch: '段', name: '稳扎稳打', desc: '通过 5 次阶段测试', ja: ['一歩ずつ', 'ステージテストに 5 回合格'], test: () => typeof ptPassN === 'function' && ptPassN() >= 5 },
  { id: 'grad', ch: '業', name: '顺利毕业', desc: '通过一个级别的毕业测试', ja: ['卒業', 'レベルの卒業テストに合格'], test: () => typeof ptPassN === 'function' && ptPassN('grad') >= 1 },
  { id: 'pass', ch: '合', name: '合格', desc: '任意级别模拟考合格（≥ 60%）', ja: ['合格', 'いずれかの級の模擬試験に合格（60% 以上）'], test: () => allExams().some(e => e.total && e.score / e.total >= .6) },
  { id: 'full', ch: '満', name: '满分', desc: '模拟考拿到满分', ja: ['満点', '模擬試験で満点'], test: () => allExams().some(e => e.total && e.score === e.total) },
  { id: 'r5', ch: '読', name: '小书虫', desc: '读完 5 篇阅读', ja: ['本の虫', '読み物を 5 本読了'], test: () => readsDone() >= 5 },
  { id: 'r30', ch: '書', name: '博览群书', desc: '读完 30 篇阅读', ja: ['博覧強記', '読み物を 30 本読了'], test: () => readsDone() >= 30 },
  { id: 'biz5', ch: '商', name: '职场新人', desc: '完成 5 个商务场景', ja: ['新社会人', 'ビジネス場面を 5 つ完了'], test: () => Object.keys((S.biz || {}).s || {}).length >= 5 },
  { id: 'n1', ch: '頂', name: '登顶', desc: '最高级别模拟考合格（N1 / HSK6 / C1）', ja: ['頂点へ', '最上級の模擬試験に合格（N1・HSK6・C1）'], test: () => allExams().some(e => ['N1', 'HSK6', 'C1'].includes(e.L) && e.total && e.score / e.total >= .6) }
];
function checkBadges() {
  for (const b of BADGES) {
    if (!S.badges[b.id] && b.test()) { S.badges[b.id] = dkey(); toast(tje(`获得印章「${b.ch}・${b.name}」`, `スタンプ獲得「${b.ch}・${b.ja[0]}」`, `New stamp: ${b.ch} · ${uiJa() ? b.ja[0] : b.name}`)); celebrate(); }
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
let JA_IDX_OK = false;
// 目录用 lang.js 的 jsonOr 加载：网络不好时重试，存在本机，下次打开马上可用（以前失败一次，这次打开期间这些词都没声音）
const JA_MAIN = ['words', 'daily', 'examples'].map(n => `${AUD}index-${n}.json`);
const jaIdxLoad = () => Promise.all(JA_MAIN.map(u => jsonOr(u, d => Object.assign(AUDIO_IDX, d)).then(d => Object.assign(AUDIO_IDX, d)))).then(() => { JA_IDX_OK = true; });
let JA_IDX = jaIdxLoad();
// 词典里 JLPT 以外的词（JMdict）：录音在 nihonggo-dojo-audio2 的 ja-d/（index-dict-ja.json，约 1.3 MB），第一次用到时才下载
let DICT_JA = null, DICT_JA_P = null;
const dictJaIdx = () => DICT_JA_P || (DICT_JA_P = jsonOr(`${AUD2}index-dict-ja.json`, d => { DICT_JA = d; }).then(d => (DICT_JA = d)));
// 不用手机自带的机器朗读，只放生成的人声：没有录音时不出声，提示一次，然后接着往下走（连续播放不会卡住）
let noVoiceWarned = false, noVoiceTimer = 0;
let noNetWarnedAt = 0;
function noVoice(end, why) {
  if (why === 'net') {   // 网络不好、录音没加载出来（不是没有录音）
    if (Date.now() - noNetWarnedAt > 20000) { noNetWarnedAt = Date.now(); toast(tje('网络不太好，录音没加载出来，请稍后再点一次', '通信が不安定で音声を読み込めませんでした。少し待ってからもう一度タップしてください', 'Audio could not load (slow connection). Please tap again in a moment.')); }
  } else if (!noVoiceWarned) { noVoiceWarned = true; toast(tje('这一句的录音还在准备中', 'この文の音声は準備中です', 'Audio for this line is coming soon')); }
  clearTimeout(noVoiceTimer);
  if (end) noVoiceTimer = setTimeout(end, 500);   // 按了停止（stopSpeech）就取消，不会多跳一句
}
function stopSpeech() {
  clearTimeout(noVoiceTimer);
  if (typeof langSeq !== 'undefined') langSeq++;   // 还在等录音目录的那一次（lang.js）也取消
  if (curAudio) { curAudio.onended = curAudio.onerror = null; curAudio.pause(); curAudio = null; }
  if (hasTTS) speechSynthesis.cancel();
}
// 按需加载的录音索引（阅读文章、商务日语、N2/N1 的单词例句）：第一次用到时下载，合并进 AUDIO_IDX，不拖慢首屏
const AUDIO_MORE = {};
const addMore = d => { for (const k in d) if (!AUDIO_IDX[k]) AUDIO_IDX[k] = d[k]; };
const audioIdx = name => AUDIO_MORE[name] || (AUDIO_MORE[name] = jsonOr(`${AUD}index-${name}.json`, addMore).then(addMore));
// N2、N1 的例句录音很多（约 1.4 万句），只给在学 N2、N1 的人加载
const LAZY_JA = ['biz', 'reading', 'examples-N2', 'examples-N1'];   // 查不到的句子再到这些目录里找（speak）
const levelAudio = () => { if (S.level === 'N2' || S.level === 'N1') audioIdx('examples-' + S.level); };
// 五十音单独一套（音高、长短、音量统一），优先于单词库里的同名录音
let KANA_IDX = {};
jsonOr(`${AUD}index-kana.json`, d => { KANA_IDX = d; }).then(d => { KANA_IDX = d; });
// 真人录音（audio/index-ja-human.json，Wikimedia Commons / Lingua Libre 的母语者录音）：单个假名、单词优先用它，合成音读单字最不自然
let HUMAN_JA = {};
jsonOr(`${AUD}index-ja-human.json`, d => { HUMAN_JA = d; }).then(d => { HUMAN_JA = d; });
// 日语录音始终用同一个播放器：iPhone 只允许「点击当下」开始播放，同一个播放器被点击解锁过以后，
// 之后隔一段时间再自动播放（全文朗读、循环播放从头再来）也不会被拦；每次新建播放器的话，过了点击那一刻就放不出来
let jaAudioEl = null;
const jaPlayer = () => jaAudioEl || (jaAudioEl = new Audio());
// 点击当下「解锁」播放器（放一段静音）：接下来要先等网络、或隔一会儿才自动播放的地方（听力、听写、水平测试、阶段测试……）
// 在点击的那一刻调用，之后的播放就不会被 iPhone 拦下。正在播放的不动
function audioPrime() {
  if (typeof SILENT_WAV === 'undefined') return;
  const el = jaPlayer();
  if (el.paused && curAudio !== el) { el.onended = el.onerror = null; el.src = SILENT_WAV; el.play().catch(() => {}); }
  if (typeof langUnlock === 'function') langUnlock();
}
function speak(text, opts = {}, pre) {
  // 词典卡片传「写法|读音」：同音词（箸 / 橋）各有自己的录音（index-dict-ja.json）；别的录音目录按读音找
  const pair = text.includes('|') ? text : '';
  if (pair) text = pair.split('|')[1];
  const file = (pair && DICT_JA && DICT_JA[pair]) || HUMAN_JA[text] || KANA_IDX[text] || AUDIO_IDX[text] || (DICT_JA && DICT_JA[text]);
  // 录音目录还没加载好（刚打开时；词典的录音目录第一次用到时才下载）：先在点击当下用静音解锁一个播放器，等目录好了再放录音
  if (!file && !pre && (!JA_IDX_OK || !DICT_JA) && typeof SILENT_WAV !== 'undefined') {
    stopSpeech(); const seq = ++speakSeq;
    const a = jaPlayer(); a.onended = a.onerror = null; a.src = SILENT_WAV; a.play().catch(() => {});
    curAudio = a;
    let done = false;
    const go = () => { if (done || seq !== speakSeq || curAudio !== a) return; done = true; curAudio = null; speak(pair || text, opts, a); };
    Promise.all([JA_IDX, dictJaIdx()]).then(go); setTimeout(go, 10000);
    return;
  }
  // 查不到、而且有目录这次没取到（网络不好）：重新取一次再放
  if (!file && !opts.retried && typeof IDX_FAILED !== 'undefined' && [...JA_MAIN, `${AUD2}index-dict-ja.json`].some(u => IDX_FAILED.has(u)) && typeof SILENT_WAV !== 'undefined') {
    stopSpeech(); const seq = ++speakSeq;
    const a = pre || jaPlayer(); a.onended = a.onerror = null; a.src = SILENT_WAV; a.play().catch(() => {});
    curAudio = a;
    if (IDX_FAILED.has(`${AUD2}index-dict-ja.json`)) DICT_JA_P = null;
    JA_IDX = jaIdxLoad();
    Promise.all([JA_IDX, dictJaIdx()]).then(() => { if (seq === speakSeq && curAudio === a) { curAudio = null; speak(pair || text, Object.assign({}, opts, { retried: true }), a); } });
    return;
  }
  // 查不到：可能在按需加载的目录里（商务、阅读、N2/N1 例句——比如词典、翻译练习里出现别的级别的例句）。加载这些目录后再找一次
  if (!file && !opts.more && LAZY_JA.some(n => !AUDIO_MORE[n]) && typeof SILENT_WAV !== 'undefined') {
    stopSpeech(); const seq = ++speakSeq;
    const a = pre || jaPlayer(); a.onended = a.onerror = null; a.src = SILENT_WAV; a.play().catch(() => {});
    curAudio = a;
    let done = false;
    const go = () => { if (done || seq !== speakSeq || curAudio !== a) return; done = true; curAudio = null; speak(pair || text, Object.assign({}, opts, { more: true }), a); };
    Promise.all(LAZY_JA.map(n => audioIdx(n).catch(() => {}))).then(go); setTimeout(go, 10000);
    return;
  }
  if (file) {
    stopSpeech(); const seq = ++speakSeq;
    const a = pre || jaPlayer();
    a.src = audUrl(file);
    // 语速设置是给浏览器朗读定的（默认 0.8）；真人音频本来就慢一些，整体上调 0.2
    a.playbackRate = Math.min(1.5, Math.max(0.5, (opts.rate || S.rate) + 0.2));
    let fell = false;
    // 换了下一句（同一个播放器被打断）时不要再用手机朗读读这一句
    let tries = 0;
    const fallback = () => {
      if (fell || seq !== speakSeq) return;
      if (tries++ < 1) { setTimeout(() => { if (seq === speakSeq && curAudio === a) { a.src = audUrl(file); a.play().catch(fallback); } }, 800); return; }   // 网络抖一下：再试一次
      fell = true; curAudio = null; speakTTS(text, opts, 'net');
    };
    a.onended = () => { if (curAudio === a) curAudio = null; if (opts.onend) opts.onend(); };
    a.onerror = fallback;
    curAudio = a;
    a.play().catch(fallback);
    return;
  }
  if (curAudio) { curAudio.pause(); curAudio = null; }
  speakTTS(text, opts, JA_IDX_OK ? undefined : 'net');   // 目录还没加载出来（网络慢）时提示网络，不说「准备中」
}
// 以前没有录音时用手机朗读；现在只放生成的人声（noVoice：不出声，连续播放接着往下走）
function speakTTS(text, opts = {}, why) { noVoice(opts.onend, why); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-say]');
  if (b) {
    e.stopPropagation();
    if (b.hasAttribute('data-exq') && typeof exAudioOK === 'function') { exAudioOK('ja|' + b.dataset.say).then(ok => { if (ok) { speak(b.dataset.say); b.classList.remove('talk'); void b.offsetWidth; b.classList.add('talk'); } }); return; }
    speak(b.dataset.say); b.classList.remove('talk'); void b.offsetWidth; b.classList.add('talk');
    // 五十音图的假名：发音的同时弹出小卡片（可以「写一写」）
    if (b.classList.contains('kana') && typeof kanaSheet === 'function') setTimeout(() => kanaSheet(b.dataset.say, (b.querySelector('small') || {}).textContent || ''), 0);
  }
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
  const cols = [tok('--ai'), tok('--brand'), tok('--brand-2'), tok('--gold'), ...(S.track === 'ja' ? petalColors() : [])];   // 庆祝：当前语言的强调色 + 品牌色 + 金色
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
// 吉祥物（mascot.js）：学中文时是熊猫，其他时候是小猫
function neko(mood = 'happy', cls = '') { return mascotSVG(S.track === 'zh' ? 'panda' : 'cat', mood, cls); }
function bounceNeko() { document.querySelectorAll('.neko').forEach(n => { n.classList.remove('jump'); void n.getBoundingClientRect(); n.classList.add('jump'); }); }

// 顶部的小图标（连续天数、今日经验）：手机上没有鼠标悬停，点一下用提示条说明是什么
document.getElementById('chip-streak').addEventListener('click', () => toast(tje(`连续学习 ${streak()} 天。每天学一点，火苗就不会灭。`, `連続学習 ${streak()} 日。毎日少しでも学ぶと記録が続きます。`, `${streak()}-day streak. Study a little every day to keep it going.`)));
document.getElementById('chip-xp').addEventListener('click', () => toast(tje(`今天的经验 ${todayXP()} / 每日目标 ${S.goal}。目标可以在「我的 → 设置」里改。`, `今日の XP ${todayXP()} / 1 日の目標 ${S.goal}。目標は「マイページ → 設定」で変更できます。`, `Today's XP ${todayXP()} / daily goal ${S.goal}. Change the goal under Me → Settings.`)));
function updateTop() {
  if (typeof vipBadge === 'function') vipBadge();   // 左上角小猫图标：会员显示 VIP
  const s = streak();
  document.getElementById('streak-n').textContent = s;
  document.getElementById('chip-streak').classList.toggle('lit', todayXP() > 0);
  document.getElementById('xp-today').textContent = todayXP();
  document.getElementById('xp-goal').textContent = '/' + S.goal;
  document.getElementById('chip-xp').classList.toggle('lit', todayXP() >= S.goal);
  const tr = document.body.dataset.track || 'ja';
  document.getElementById('chip-lv').textContent = tr === 'ja' ? S.level : tr === 'en' && typeof enLevel === 'function' ? enLevel() : tr === 'zh' && typeof zhLevel === 'function' ? zhLevel() : typeof l2CurLevel === 'function' ? l2CurLevel(tr) : '';
}
function applyTheme() {
  if (typeof applyFontSize === 'function') applyFontSize();
  if (S.theme) document.documentElement.dataset.theme = S.theme; else delete document.documentElement.dataset.theme;
  // 手机状态栏颜色跟着浅色 / 深色走
  const dark = S.theme ? S.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
  document.head.append(Object.assign(document.createElement('meta'), { name: 'theme-color', content: dark ? '#1F1C2E' : '#FCFCFE' }));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (!S.theme) applyTheme(); });
const levelSeg = (cur, attr = 'data-level') => `<div class="seg lv-seg" role="group" aria-label="JLPT 级别">${LEVELS.map(L => `<button type="button" ${attr}="${L}" class="${L === cur ? 'on' : ''}" aria-pressed="${L === cur}">${L}</button>`).join('')}</div>`;

let keyHandler = null;
document.addEventListener('keydown', e => {
  if (!keyHandler || e.target.matches('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  keyHandler(e);
});
let examTimer = null;

/* ---------- SRS（间隔重复）：FSRS 算法 ----------
   和 Anki 新版同一套算法（FSRS-4.5，默认参数，目标记住率 90%）。每张卡记：
   s 稳定度（天，记忆能保持多久）、d 难度（1–10）、lr 上次复习时间；另外保留 i（间隔天数）、r（答对次数）、due（下次复习时间）。
   旧版（SM-2）的卡第一次复习时按原来的间隔和难度系数换算，不丢进度。 */
const FSRS_W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const FSRS_RETAIN = 0.9, FSRS_DECAY = -0.5, FSRS_FACTOR = 19 / 81;
const clampD = d => Math.min(10, Math.max(1, d));
const fsrsD0 = G => clampD(FSRS_W[4] - (G - 3) * FSRS_W[5]);
const fsrsIvl = s => Math.max(1, Math.round(s / FSRS_FACTOR * (Math.pow(FSRS_RETAIN, 1 / FSRS_DECAY) - 1)));
// 把旧卡（只有 i、e）换算成 FSRS 的状态
function fsrsState(c) {
  if (!c || !c.r) return null;
  if (c.s) return c;
  return Object.assign({}, c, { s: Math.max(.5, c.i || 1), d: clampD(5 + (2.5 - (c.e || 2.5)) * 3.3), lr: (c.due || Date.now()) - (c.i || 1) * DAY });
}
// g：0 重来、1 困难、2 记得、3 简单 → FSRS 评分 1–4。返回 {s, d, ivl}（ivl 为 0 表示马上再来一次）
function fsrsNext(c, g, now = Date.now()) {
  const G = g + 1, W = FSRS_W, st = fsrsState(c);
  if (!st) {
    const s = W[G - 1];
    return { s, d: fsrsD0(G), ivl: G === 1 ? 0 : fsrsIvl(s) };
  }
  const t = Math.max(0, (now - st.lr) / DAY), R = Math.pow(1 + FSRS_FACTOR * t / st.s, FSRS_DECAY);
  const d = clampD(W[7] * fsrsD0(3) + (1 - W[7]) * (st.d - W[6] * (G - 3)));
  if (G === 1) {
    const s = Math.min(st.s, W[11] * Math.pow(st.d, -W[12]) * (Math.pow(st.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R)));
    return { s, d, ivl: 0 };
  }
  const s = st.s * (Math.exp(W[8]) * (11 - st.d) * Math.pow(st.s, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * (G === 2 ? W[15] : 1) * (G === 4 ? W[16] : 1) + 1);
  return { s, d, ivl: fsrsIvl(s) };
}
function preview(c, g) { return fsrsNext(c, g).ivl; }
function grade(id, g) {
  if (typeof actLog === 'function') actLog(/^g\|/.test(id) ? 'g' : 'v', /^(en|zh)\|/.test(id) ? id.slice(0, 2) : 'ja');   // 学习诊断：复习也算练习
  const isNew = !S.srs[id];
  const c = Object.assign({ i: 0, e: 2.5, r: 0, due: 0 }, fsrsState(S.srs[id]) || S.srs[id]);
  const n = fsrsNext(S.srs[id] && S.srs[id].r ? c : null, g);
  c.s = n.s; c.d = n.d; c.lr = Date.now(); c.i = n.ivl;
  if (g === 0) c.due = Date.now();
  else { c.r += 1; c.due = startOfToday() + n.ivl * DAY; }
  S.srs[id] = c;
  if (isNew) S.newLog[dkey()] = (S.newLog[dkey()] || 0) + 1;
  // 复习记录：每天复习了多少张、记住多少张（周报用）
  const k = dkey(), lg = (S.revLog = S.revLog || {})[k] || [0, 0];
  lg[0]++; if (g > 0) lg[1]++;
  S.revLog[k] = lg;
}
const fmtDays = d => uiJa() ? (d === 0 ? 'すぐ' : d === 1 ? '明日' : d < 30 ? `${d} 日` : d < 365 ? `${Math.round(d / 30)} か月` : `${(d / 365).toFixed(1)} 年`)
  : d === 0 ? '马上' : d === 1 ? '明天' : d < 30 ? `${d} 天` : d < 365 ? `${Math.round(d / 30)} 个月` : `${(d / 365).toFixed(1)} 年`;
const dueList = levels => levels.flatMap(L => [...VOCAB[L], ...GRAM[L]]).filter(v => S.srs[v.id] && S.srs[v.id].due <= Date.now());   // 单词和加入复习的语法点
const newLeft = () => Math.max(0, S.newPerDay - (S.newLog[dkey()] || 0));
const newList = L => LEARN[L].filter(v => !S.srs[v.id]);

// 做题、背卡片时进入专注模式：手机上隐藏底部导航，题目和反馈不被挡住；切换页面时自动退出
// 专注模式 = 正在做题：隐藏底部导航；同时在浏览记录里垫一层，手机的返回手势先问一下再离开（见下面的 popstate）
// 有键盘、鼠标的设备才提示快捷键（手机上不显示「（Enter）」和选项编号）
const KBD = matchMedia('(hover: hover) and (pointer: fine)').matches;
if (!KBD) document.documentElement.classList.add('touch');
const focusMode = on => {
  const was = document.body.classList.contains('focus');
  document.body.classList.toggle('focus', !!on);
  if (on && !was) { staleGuard = false; if (!(history.state && history.state.guard)) { try { history.pushState({ guard: 1 }, ''); } catch (e) { /* 忽略 */ } } }
  if (!on && was && history.state && history.state.guard) staleGuard = true;   // 做完了：下次按返回时把垫的那一层一起跳过
};
let staleGuard = false;
// 轻震动（只有安卓等支持的浏览器才有效；iPhone 的网页不支持震动）
const buzz = p => { try { if (S.haptic !== false && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* 忽略 */ } };
// 自己画的确认框和选项菜单（比浏览器自带的 confirm 好看，也不会被某些 App 内置浏览器拦截）。
// 遮罩不盖住屏幕最上面一条：新版 iPhone Safari 会按页面顶部的颜色给状态栏染色，盖住了会被染灰，关掉后有时恢复不了。
function askSheet(text, opts) {
  return new Promise(res => {
    const m = h(`<div class="ask-mask" role="dialog" aria-modal="true"><div class="ask-box"><p>${esc(text)}</p>
      <div class="ask-opts ${opts.length > 2 ? 'col' : ''}">${opts.map(([v, t, cls], k) => `<button class="btn ${cls || ''}" type="button" data-k="${k}">${esc(t)}</button>`).join('')}</div></div></div>`);
    const close = v => {
      m.remove(); res(v);
      // 让 Safari 重新取一次顶部颜色
      applyTheme(); requestAnimationFrame(() => { scrollBy(0, 1); scrollBy(0, -1); });
    };
    m.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => close(opts[+b.dataset.k][0]); });
    m.onclick = e => { if (e.target === m) close(null); };
    document.body.append(m);
    m.querySelector('[data-k]').focus();
  });
}
const askConfirm = (text, ok = tj('确定', 'OK'), cancel = tj('取消', 'キャンセル')) => askSheet(text, [[false, cancel], [true, ok, 'pri']]).then(v => v === true);
function startCards(host, ids, title, onExit) {
  let queue = ids.slice(), done = 0, revealed = false;
  host.innerHTML = '';
  const box = h(`<section class="panel deck">
    <div class="row between"><h2>${esc(title)}</h2><button class="btn ghost" type="button" data-exit>${tj('结束', '終了')}</button></div>
    <div class="progress-top"><span class="small muted" data-left></span><div class="bar"><i data-bar style="width:0"></i></div></div>
    <div data-stage></div>
  </section>`);
  host.append(box);
  box.querySelector('[data-exit]').onclick = finish;
  const stage = box.querySelector('[data-stage]');
  focusMode(true);
  function finish() { keyHandler = null; focusMode(false); onExit(done); }
  function show() {
    const total = done + queue.length;
    box.querySelector('[data-left]').textContent = tj(`剩余 ${queue.length}`, `残り ${queue.length}`);
    box.querySelector('[data-bar]').style.width = (total ? done / total * 100 : 100) + '%';
    if (!queue.length) {
      stage.innerHTML = `<div class="card" style="cursor:default"><div class="word" lang="ja">お疲れ様！</div><p class="meaning">${tj(`这一组完成了，共 ${done} 张。`, `このセットは完了です（${done} 枚）。`)}</p><p class="hint">${tj('明天记得回来复习，间隔重复会安排好时间。', '明日も復習しに来てください。復習のタイミングは間隔反復で自動的に調整されます。')}</p></div>
        <div class="row" style="justify-content:center;margin-top:12px"><button class="btn pri" type="button" data-back>${tj('返回', '戻る')}</button></div>`;
      stage.querySelector('[data-back]').onclick = finish;
      keyHandler = e => { if (e.key === 'Enter') finish(); };
      return;
    }
    const v = ITEMS[queue[0]], c = S.srs[v.id];
    revealed = false;
    const e = v.type === 'g' ? v.eg[Math.floor(Math.random() * v.eg.length)] : null;
    if (e) {   // 语法卡：正面是挖空的例句和中文，背面是句型、意思和完整例句
      stage.innerHTML = `<div class="card" data-card tabindex="0" role="button" aria-label="${tj('显示答案', '答えを表示')}">
        <span class="corner tag ${c ? 'learn' : ''}">${c ? tj('复习', '復習') : tj('新', '新規')} · ${v.L} ${tj('语法', '文法')}</span>
        <div class="q-sent furi" lang="ja">${furiHTML(e.full, e.furi, e.at, e.at + e.frag.length).replace(/<mark>.*?<\/mark>/, '<span class="blank">　？　</span>')}</div>
        <div class="meaning">${esc(e.t)}</div>
        <div data-ans hidden><div class="word" lang="ja">${esc(v.p)}</div><div class="meaning">${esc(v.m)}</div>
          <div class="furi jtap" lang="ja">${jaTapHTML(e.full, e.furi, e.at, e.at + e.frag.length)} ${speakBtn(e.kana)}</div>${v.how ? `<p class="small muted">${jrNote(v.how)}</p>` : ''}</div>
        <div class="hint" data-hint>${tj('空白处应该填哪个句型？想好再点卡片看答案（空格键）', '空欄に入る文型は？ 考えてからカードをタップして答えを確認（スペースキー）')}</div>
      </div>
      <div data-exbox hidden></div>
      <div class="grades" data-grades hidden style="margin-top:12px">
        ${(uiJa() ? ['もう一度', '難しい', '正解', '簡単'] : ['重来', '困难', '记得', '简单']).map((t, g) => `<button class="btn g${g}" type="button" data-g="${g}">${t}<small>${fmtDays(preview(c, g))}</small></button>`).join('')}
      </div>`;
    } else
    stage.innerHTML = `<div class="card" data-card tabindex="0" role="button" aria-label="${tj('显示答案', '答えを表示')}">
        <span class="corner tag ${c ? 'learn' : ''}">${c ? tj('复习', '復習') : tj('新词', '新規')} · ${v.L}</span>
        <span class="corner-r">${speakBtn(v.r, tj('朗读单词', '単語を読み上げ'))}</span>
        <div class="word" lang="ja">${esc(v.w)}</div>
        <div data-ans hidden><div class="reading" lang="ja">${typeof pitchHTML === 'function' ? pitchHTML(v.w, v.r) : esc(v.r)}</div><div class="meaning">${esc(v.m)}</div></div>
        <div class="hint" data-hint>${tj('先想一想读音和意思，再点卡片看答案（空格键）', '読み方と意味を思い浮かべてから、カードをタップして答えを確認（スペースキー）')}</div>
      </div>
      <div class="ex-box" data-exbox hidden>${exList(v.w).length ? `<div class="eyebrow">${tj('例句', '例文')}</div>${exHTML(v.w)}` : ''}</div>
      <div class="grades" data-grades hidden style="margin-top:12px">
        ${(uiJa() ? ['もう一度', '難しい', '正解', '簡単'] : ['重来', '困难', '记得', '简单']).map((t, g) => `<button class="btn g${g}" type="button" data-g="${g}">${t}<small>${fmtDays(preview(c, g))}</small></button>`).join('')}
      </div>`;
    const card = stage.querySelector('[data-card]');
    const reveal = () => {
      if (revealed) return; revealed = true; fxFlip(card);
      stage.querySelector('[data-ans]').hidden = false; stage.querySelector('[data-hint]').hidden = true;
      stage.querySelector('[data-grades]').hidden = false; stage.querySelector('[data-exbox]').hidden = false; if (S.autoSpeak) { if (e && typeof exAudioOK === 'function') exAudioOK('ja|' + e.kana, true).then(ok => { if (ok) speak(e.kana); else if (v.r) speak(v.r); }); else speak(e ? e.kana : v.r); }
      const wEl = stage.querySelector('.card .word'); if (wEl && !e) { wEl.classList.add('furi'); wEl.innerHTML = jrWord(v.w, v.r); }   // 翻开以后词头标假名（翻开前是测验，不标）
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
    fxCardOut(stage, g === 0 ? -1 : 1);
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
// 有迷惑性的干扰项：从候选里挑和正确答案「像」的（sim 打分 > 0 的前几名里随机取 nNear 个），其余随机补到 n 个。
// key(x) 是选项上显示的文字（不能和正确答案或别的选项重复）。级别越高 nNear 越大，题目越难。
function nearPick(x, pool, sim, key, nNear, n = 3) {
  const right = key(x), seen = new Set([right]), out = [];
  const take = arr => { for (const y of arr) { const k = key(y); if (k && !seen.has(k)) { seen.add(k); out.push(y); return true; } } return false; };
  const scored = pool.filter(y => y !== x).map(y => [sim(x, y), y]).filter(z => z[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 8).map(z => z[1]);
  for (const y of shuffle(scored)) { if (out.length >= nNear) break; take([y]); }
  const rest = shuffle(pool.filter(y => y !== x));
  while (out.length < n && take(rest.splice(0, 1))) { /* 补随机的 */ }
  while (out.length < n && rest.length) take(rest.splice(0, 1));
  return out;
}
const hanOf = t => new Set((t || '').match(/[一-鿿]/g) || []);
const shareN = (a, b) => { let n = 0; for (const c of a) if (b.has(c)) n++; return n; };
// 日语 / 中文单词：共用汉字的词、意思里有相同字的词更容易混
const hanSim = (wa, ma) => { const A = hanOf(wa), M = hanOf(ma); return (y, wy, my) => shareN(A, hanOf(wy)) * 2 + (shareN(M, hanOf(my)) ? 1 : 0); };
// 英语单词：开头相同、长度接近或词尾相同的词更容易混（adapt / adopt、affect / effect）
const enSim = (a, b) => { a = a.toLowerCase(); b = b.toLowerCase(); return (a.slice(0, 3) === b.slice(0, 3) ? 2 : 0) + (a[0] === b[0] && Math.abs(a.length - b.length) <= 1 ? 1 : 0) + (a.length > 4 && a.slice(-3) === b.slice(-3) ? 1 : 0); };
// 每个级别放几个「像」的干扰项：入门 1 个，中级以上 2 个
const nearN = L => ['N5', 'N4', 'HSK1', 'HSK2', 'A1', 'A2', 1, 2].includes(L) ? 1 : 2;
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
    let opts = [...new Set([...sample(near(pool, x => x.r), 2), ...far])].filter(r => r !== v.r).slice(0, 3);
    // N3：1 个形近读音（促音、浊音、长音只差一点）
    if (v.L === 'N3' && typeof confuseReadings === 'function') { const cf = confuseReadings(v.r, 2); if (cf.length) opts = [...new Set([cf[0], ...opts])].filter(r => r !== v.r).slice(0, 3); }
    // N2、N1、魔鬼模式：2 个形近读音（促音、浊音、长音、拗音、拨音只差一点）+ 1 个同级读音
    if (typeof hardMode === 'function' && hardMode(v.L)) { const cf = confuseReadings(v.r, 3); if (cf.length >= 2) opts = [...new Set([...cf.slice(0, S.demon ? 3 : 2), ...opts])].filter(r => r !== v.r).slice(0, 3); }
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
    // N2、N1、魔鬼模式：同音词（機会／機械）和共用汉字的词做干扰
    const hard = typeof hardMode === 'function' && hardMode(v.L) ? hardWordDistractors(v, 3) : [];
    const wopts = hard.length >= 2 ? [...hard, ...distract(v.w, same.map(x => x.w))].filter((x, i, a) => x !== v.w && a.indexOf(x) === i).slice(0, 3) : nearPick(v, same, (a, y) => hanSim(v.w, v.m)(y, y.w, y.m), y => y.w, nearN(v.L)).map(y => y.w);
    return makeQ(v, 'word', wopts, v.w, {
      prompt: `<div class="eyebrow">哪个日语单词是这个意思？</div><div class="q-big" style="font-family:var(--f-ui);font-size:1.8rem">${esc(v.m)}</div>`, optLang: 'ja', say: v.r,
      explain: `<span lang="ja">${esc(v.w)}（${esc(v.r)}）</span>：${esc(v.m)}${exTip(v.w)}`
    });
  }
  const sim = hanSim(v.w, v.m);
  return makeQ(v, 'meaning', nearPick(v, same, (a, y) => sim(y, y.w, y.m), y => y.m, nearN(v.L)).map(y => y.m), v.m, {
    prompt: `<div class="eyebrow">这个单词是什么意思？</div><div class="q-big" lang="ja">${esc(v.w)}</div>`, say: v.r,
    explain: `<span lang="ja">${esc(v.w)}（${esc(v.r)}）</span>：${esc(v.m)}${exTip(v.w)}`
  });
}
function exTip(w) {
  const e = exList(w); if (!e.length) return '';
  const [jp, kana, zh, furi] = e[Math.floor(Math.random() * e.length)];
  // 选完答案后的例句也能听（单词闯关等）：免费用户按每日额度；和其他例句一样，画线的词点一下看释义
  return `<br><span class="small ex-tip"><span lang="ja" class="furi jtap">${markWord(jp, w, furi, 1)}</span>${kana ? exSpeakBtn(kana) : ''}<br><span class="muted">${esc(zh)}</span></span>`;
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
    // N2、N1、魔鬼模式：形近读音做干扰
    const hard = typeof hardMode === 'function' && hardMode(k.L) ? confuseReadings(v.r, 2) : [];
    const kopts = hard.length >= 2 ? [...hard, ...distract(v.r, sample(pool, 40))].filter((x, i, a) => x !== v.r && a.indexOf(x) === i).slice(0, 3) : distract(v.r, sample(pool, 40));
    return makeQ(k, 'kanji', kopts, v.r, {
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
  // 没有例句（N3–N1 的例句是会员内容）：问句型的意思
  if (!g.eg.length) return makeQ(g, 'grammar', distract(g.m, LEVELS.flatMap(L => GRAM[L]).filter(x => x !== g && x.m !== g.m).map(x => x.m)), g.m, {
    prompt: `<div class="eyebrow">${tj('这个句型是什么意思？', 'この文型の意味は？')}</div><div class="q-big" lang="ja">${esc(g.p)}</div>`,
    explain: `<b lang="ja">${esc(g.p)}</b>：${esc(g.m)}${g.how ? `<br><span class="muted">${jrNote(g.how)}</span>` : ''}`
  });
  if (!e || typeof e !== 'object') e = sample(g.eg, 1)[0];
  const own = new Set(g.eg.map(x => x.frag));
  const ok = x => !own.has(x) && !g.ex.includes(x);
  let pool = GRAM[g.L].filter(x => x !== g && x.eg.length).map(x => sample(x.eg, 1)[0].frag).filter(ok);
  if (pool.length < 3) pool = pool.concat(LEVELS.flatMap(L => GRAM[L]).filter(x => x !== g && x.eg.length).map(x => x.eg[0].frag).filter(ok));
  const sent = '<span class="furi">' + furiHTML(e.full, e.furi, e.at, e.at + e.frag.length).replace(/<mark>.*?<\/mark>/, '<span class="blank">　？　</span>') + '</span>';
  return makeQ(g, 'grammar', distract(e.frag, pool), e.frag, {
    prompt: `<div class="eyebrow">选择填入空白处的内容</div><div class="q-sent" lang="ja">${sent}</div>`, optLang: 'ja', say: e.kana,
    explain: `<b lang="ja">${esc(g.p)}</b>：${esc(g.m)}<br><span lang="ja" class="furi jtap">${jaTapHTML(e.full, e.furi)}</span><br><span class="muted">${esc(e.t)}</span>`
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
function runQuiz(host, qs, { title, exam = false, minutes = 0, fromWrong = false, noRecord = false, noWeak = false, xpEach = 10, hearts = 0, requeue = false, onDone }) {
  let i = 0, combo = 0, answered = false, life = hearts, failed = false;
  const requeued = new Set();
  const heartsHTML = () => hearts ? `<span class="hearts" aria-label="${tje(`剩余 ${life} 条命`, `残りライフ ${life}`, `${life} lives left`)}">${Array.from({ length: hearts }, (_, k) => `<svg viewBox="0 0 24 24" class="${k < life ? 'on' : ''}"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.6 4.5c2 0 3.6 1.1 4.4 2.6.8-1.5 2.4-2.6 4.4-2.6 3.6 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z"/></svg>`).join('')}</span>` : '';
  const res = [];
  host.innerHTML = '';
  const box = h(`<section class="panel quiz">
    <div class="row between"><h2>${esc(title)}</h2><button class="btn ghost" type="button" data-exit>${tje('退出', 'やめる', 'Quit')}</button></div>
    <div class="progress-top"><span class="small" data-count></span><div class="bar"><i data-bar style="width:0"></i></div><span class="small" data-extra></span></div>
    <div data-stage class="quiz"></div>
  </section>`);
  host.append(box);
  const stage = box.querySelector('[data-stage]'), extra = box.querySelector('[data-extra]');
  focusMode(true);
  box.querySelector('[data-exit]').onclick = async () => {
    // 答过题再退出要确认，免得手滑丢了这一轮
    if (res.length && res.length < qs.length && !await askConfirm(exam ? tje('确定退出考试吗？这次的作答不会保存。', '試験を中断しますか？ 今回の解答は保存されません。', 'Quit the test? Your answers won\'t be saved.') : tje('确定退出吗？这一轮的进度不会保存。', 'やめますか？ このラウンドの進み具合は保存されません。', 'Quit? Your progress in this round won\'t be saved.'), tje('退出', 'やめる', 'Quit'), tje('继续做题', '続ける', 'Keep going'))) return;
    clearInterval(examTimer); keyHandler = null; focusMode(false); onDone(null);
  };
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
    if (!exam) extra.innerHTML = (combo >= 3 ? `<span class="combo">${tje(`${combo} 连对`, `${combo} 問連続正解`, `${combo} in a row`)}</span> ` : '') + heartsHTML();
    stage.innerHTML = `<div class="q-prompt pop">${q.prompt}</div>
      <div class="opts">${q.options.map((o, j) => `<button class="opt" type="button" data-o="${j}"><span class="k">${j + 1}</span><span ${q.optLang ? `lang="${q.optLang}"` : ''}>${esc(o)}</span></button>`).join('')}</div>
      <div data-fb role="status" aria-live="polite"></div>`;
    stage.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => pick(+b.dataset.o); });
    if (q.autoSay) (q.autoLang ? speakLang(q.autoSay, q.autoLang) : speak(q.autoSay));
    keyHandler = e => {
      if (!answered && '1234'.includes(e.key) && +e.key <= q.options.length) pick(+e.key - 1);
      else if (answered && e.key === 'Enter') next();
    };
  }
  function pick(j) {
    if (answered) return; answered = true;
    const q = qs[i], ok = j === q.answer;
    res.push({ q, pick: j, ok });
    // 答错的单词：进单词卡并安排马上复习（已经在卡里的提前到今天）
    if (!ok && q.id && (q.id.startsWith('v|') || q.id.startsWith('g|'))) S.srs[q.id] = Object.assign({ i: 0, e: 2.5, r: 0 }, S.srs[q.id], { due: Date.now() });   // 答错的单词、语法进复习
    if (q.id && !noRecord) {
      if (!ok) S.wrong[q.id] = { n: ((S.wrong[q.id] || {}).n || 0) + 1, t: Date.now() };
      else if (fromWrong && S.wrong[q.id]) { delete S.wrong[q.id]; S.fixed++; }
    }
    if (q.kind === 'kana' && ok) S.kanaRight++;
    if (typeof qstatAdd === 'function') qstatAdd(q.kind, ok);   // 弱点分析用的统计
    if (!noWeak && typeof weakLog === 'function') weakLog(q, ok);   // 我的弱项（weak.js）：答错的记下，连续答对 2 次移出
    if (typeof actLog === 'function' && typeof DG_KIND !== 'undefined' && DG_KIND[q.kind]) actLog(DG_KIND[q.kind]);   // 学习诊断：各项练了多少
    if (!ok && hearts) {
      life--;
      if (life <= 0) failed = true;
      else if (requeue && q.item && !requeued.has(q.id)) { requeued.add(q.id); qs.push(Object.assign(qVocab(q.item, q.kind), { item: q.item })); }
    }
    if (exam) { save(); next(); return; }
    const btns = stage.querySelectorAll('[data-o]');
    btns.forEach((b, k) => { b.disabled = true; if (k === q.answer) b.classList.add('right'); else if (k === j) b.classList.add('wrong'); });
    if (ok) popFrom(btns[j]);
    buzz(ok ? 12 : [30, 50, 30]);
    combo = ok ? combo + 1 : 0;
    if (hearts) extra.innerHTML = (combo >= 3 ? `<span class="combo">${tje(`${combo} 连对`, `${combo} 問連続正解`, `${combo} in a row`)}</span> ` : '') + heartsHTML();
    if (ok) addXP(xpEach + (combo && combo % 5 === 0 ? 5 : 0)); else save();
    if (q.say && S.autoSpeak) (q.sayLang ? speakLang(q.say, q.sayLang) : speak(q.say));
    const cheer = S.track === 'en' ? (ok ? sample(['Nice!', 'Great!', 'Well done!', 'Yes!'], 1)[0] : sample(['So close!', 'No worries!', 'You\'ll get it next time!'], 1)[0])
      : ok ? sample(['やった！', 'すごい！', 'いいね！', '正解！'], 1)[0] : sample(['ドンマイ！', '大丈夫！', '次は行ける！'], 1)[0];   // 英语板块用英语
    stage.querySelector('[data-fb]').innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}">${neko(ok ? 'happy' : 'sad', 'mini')}<div class="fb-t"><div class="row"><b lang="${S.track === 'en' ? 'en' : 'ja'}" class="cheer">${cheer}</b>${q.say ? (q.sayLang ? sayBtn(q.say, q.sayLang) : speakBtn(q.say)) : ''}</div><b>${ok ? (combo >= 5 && combo % 5 === 0 ? tje(`答对了！${combo} 连对，额外 +5`, `正解！ ${combo} 問連続正解でボーナス +5`, `Correct! ${combo} in a row, +5 bonus`) : tje('答对了', '正解', 'Correct')) : (noRecord ? tje('答错了', '不正解', 'Not quite') : tje('答错了，已记入错题本', '不正解。間違えた問題に記録しました', 'Not quite. Saved to your mistakes.'))}</b><div>${q.explain || ''}</div></div></div>
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn pri" type="button" data-next>${failed ? tje('命用完了，看结果', 'ライフがなくなりました。結果を見る', 'Out of lives. See results') : i + 1 < qs.length ? tje('下一题', '次へ', 'Next') : tje('查看结果', '結果を見る', 'See results')}${KBD ? (S.track === 'en' ? ' (Enter)' : '（Enter）') : ''}</button></div>`;
    stage.querySelector('[data-next]').onclick = next;
    stage.querySelector('[data-next]').focus({ preventScroll: true });
    // 反馈和「下一题」按钮滚到看得见的位置（手机上常在屏幕下面）
    requestAnimationFrame(() => stage.querySelector('[data-next]').scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }));
  }
  function next() { i++; if (!failed && i < qs.length && res.length < qs.length) show(); else finish(); }
  function finish() {
    clearInterval(examTimer); keyHandler = null; focusMode(false);
    const score = res.filter(r => r.ok).length;
    onDone({ res, score, total: res.length, hearts: life, failed });
  }
  show();
}

function quizSummary(host, r, { title, again, extraHTML = '' }) {
  const pct = Math.round(r.score / r.total * 100);
  const wrong = r.res.filter(x => !x.ok);
  host.innerHTML = '';
  // 吉祥物按成绩说一句心里话：满分会调侃，考砸了会安慰
  const MOOD = [[100, 'cheer', [['完美！你是不是偷偷看了答案？', 'パーフェクト！ まさか答え見てないよね？', 'Perfect! Did you peek at the answers?'], ['满分！今天的你闪闪发光。', '満点！今日のあなたはキラキラしてる。', 'Full marks! You\'re shining today.']]],
    [80, 'happy', [['很强！只差一点点就满分了。', 'お見事！満点まであと一歩。', 'Great job! Just one step from perfect.'], ['稳！这个水平可以骄傲一下。', '安定感バツグン！ちょっと自慢していいよ。', 'Solid! You can be proud of that.']]],
    [60, 'happy', [['及格啦，不过还差得远呢～', '合格！でも、まだまだ伸びしろあり〜', 'You passed! Still plenty of room to grow.'], ['有进步！错的那几道再看一眼吧。', '成長してる！間違えたところだけ見直そう。', 'You\'re improving! Take another look at the misses.']]],
    [30, 'think', [['别气馁，错题就是最好的老师。', '落ち込まないで。間違いこそ最高の先生だよ。', 'Don\'t worry. Mistakes are the best teachers.'], ['今天状态一般？没关系，明天再战！', '今日は調子いまいち？大丈夫、また明日！', 'Off day? No problem. Try again tomorrow!']]],
    [0, 'sad', [['嗯……我们从头再来一遍？我陪你。', 'うーん……もう一回いっしょにやろうか？', 'Hmm… shall we try again together?'], ['没关系，谁都有这样的时候。', '大丈夫、誰にでもこういう日はあるよ。', 'It\'s okay. Everyone has days like this.']]]].find(([min]) => pct >= min);
  const moodLine = MOOD[2][Math.floor(Math.random() * MOOD[2].length)];
  if (pct === 100 && typeof fxFireworks === 'function' && !fxCalm()) fxFireworks(1800);
  const box = h(`<section class="panel">
    <div class="welcome-hi quiz-mood">${neko(MOOD[1], 'big')}<div class="bubble"><b>${tje(moodLine[0], moodLine[1], moodLine[2] || moodLine[0])}</b></div></div>
    <div class="result"><div class="seal pop ${pct >= 60 ? '' : 'fail'}">${S.track === 'en' ? (pct >= 90 ? 'A' : pct >= 60 ? 'B' : 'C') : pct >= 90 ? '優' : pct >= 60 ? '良' : '可'}</div>
    <div class="rank"><div class="eyebrow">${esc(title)}</div><div class="rank-name">${r.score} / ${r.total}</div><p class="muted">${pct >= 90 ? tje('すごい！几乎全对。', 'すごい！ ほぼ全問正解です。', 'Amazing! Almost all correct.') : pct >= 60 ? tje('いいね！继续保持。', 'いいね！ この調子で続けましょう。', 'Nice! Keep it up.') : tje('多练几次就会了，错题已经帮你记下来。', '何度か練習すれば大丈夫。間違えた問題は記録してあります。', 'A little more practice and you\'ll have it. Your mistakes are saved for review.')}</p></div></div>
    ${extraHTML}
    ${wrong.length ? `<h3>${tje('错题回顾', '間違えた問題', 'Review your mistakes')}</h3><div class="list-wrap"><table class="list"><thead><tr><th>${tje('题目', '問題', 'Question')}</th><th>${tje('你的答案', 'あなたの答え', 'Your answer')}</th><th>${tje('正确答案', '正解', 'Answer')}</th></tr></thead><tbody>
      ${wrong.map(x => `<tr><td>${x.q.explain ? x.q.explain.split('<br>')[0] : ''}</td><td class="muted" ${x.q.optLang ? `lang="${x.q.optLang}"` : ''}>${x.pick < 0 ? tje('未作答', '未回答', 'No answer') : esc(x.q.options[x.pick])}</td><td ${x.q.optLang ? `lang="${x.q.optLang}"` : ''}><b>${esc(x.q.options[x.q.answer])}</b></td></tr>`).join('')}
    </tbody></table></div>` : ''}
    <div class="row"><button class="btn pri" type="button" data-again>${tje('再来一组', 'もう一度', 'Another set')}</button><a class="btn" href="#${homeView()}">${tje('回到今天', '今日に戻る', 'Back to Today')}</a></div>
  </section>`);
  host.append(box);
  box.querySelector('[data-again]').onclick = again;
  keyHandler = e => { if (e.key === 'Enter') again(); };
}

/* ---------- 页面 ---------- */
const VIEWS = { home: viewHome, week: viewWeek, vip: viewVip, read: viewRead, biz: viewBiz, game: viewGame, dict: viewDict, kana: viewKana, vocab: viewVocab, kanji: viewKanji, grammar: viewGrammar, exam: viewExam, listen: viewListen, study: viewStudy, ri: viewRI, ko: () => { location.replace('#home'); },   // 韩语板块已删除，旧链接回首页
   zh: sub => viewZh(sub), commute: () => viewCommute(), calendar: () => viewCalendar(), reader: () => { location.replace('#home'); },   // 「贴一段就能读」已下线（注音、读音常对不上），旧链接回首页
   fav: () => viewFav(), offline: () => viewOffline(), en: viewEn, me: viewMe, welcome: viewWelcome, about: viewAbout, anime: viewAnime, trans: () => viewTrans('ja'), conj: viewConj, dictation: () => viewDictation('ja'), course: viewCourse, duel: viewDuel, buddy: viewBuddy, hi: sub => viewHi(sub), check: () => viewCheck(), diag: () => viewDiag(), path: arg => viewPath(arg) };
// 大的数据文件用到才加载（首页少加载约 1.3 MB）：阅读 800 KB、商务 314 KB、模拟考 172 KB
const VIEW_NEEDS = { read: ['reading.js', 'scenes.js'], trans: ['reading.js', 'scenes.js'], biz: ['business.js'], exam: ['jlpt.js'] };
const LAZY_JS = {};
const loadScript = src => LAZY_JS[src] || (LAZY_JS[src] = new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete LAZY_JS[src]; rej(new Error(src)); }; document.body.append(s);
}));
const needScripts = files => Promise.all(files.map(loadScript));
const scriptsReady = files => files.every(f => LAZY_JS[f] && LAZY_JS[f].done);
function render() {
  levelAudio();
  const [v, ...rest] = (location.hash || '#home').slice(1).split('/');
  const arg = rest.join('/');
  // 不带 # 打开（例如从主屏幕图标启动）时，回到上次在学的语言
  if (S.track === 'ko') { S.track = 'ja'; save(); }   // 韩语板块已删除：原来在学韩语的回到日语
  let view = !location.hash && S.track && S.track !== 'ja' ? S.track : VIEWS[v] ? v : 'home';
  if (view === 'ko') { view = 'home'; history.replaceState(null, '', '#home'); }
  if (!S.onboarded && view !== 'me' && view !== 'hi') view = 'welcome';   // 分享页（#hi/…）不用先注册、选语言
  if (S.onboarded && view === 'welcome') view = 'home';
  clearInterval(examTimer); keyHandler = null; focusMode(false);
  if (lsStop) lsStop();
  if (typeof fxPageOut === 'function') fxPageOut();   // 旧页面化成颗粒消失（fx.js）
  main.innerHTML = '';
  if (trackOf(view) === 'ja' && ['home', 'week', 'game', 'kana', 'vocab', 'kanji', 'grammar', 'read', 'biz', 'listen', 'exam', 'dict', 'study', 'ri', 'conj', 'anime', 'trans', 'dictation', 'course'].includes(view) && S.track !== 'ja') { S.track = 'ja'; save(); }
  applyTrack(view);
  document.body.classList.toggle('welcome-mode', view === 'welcome');   // 选语言页：先隐藏顶部状态、搜索和底部导航，专心选
  document.body.classList.toggle('hi-mode', view === 'hi');
  // 语言切换（日本語 / 中国語 / English）只在首页和「我的」显示：平时很少换，其他页面省出顶部的空间
  document.body.classList.toggle('at-home', view === 'home' || view === 'me' || ((view === 'zh' || view === 'en') && !arg));   // 别人打开的分享页：只留品牌，不显示我的状态、搜索、导航、页脚
  if (S.onboarded && view !== 'welcome') logUsage(document.body.dataset.track || 'ja');
  // 游客模式：没开放的内容显示注册提示（guest.js）
  const lk = typeof guestLock === 'function' && guestLock(view, arg ? decodeURIComponent(arg) : '');
  // 日语页面：注音表和今日一句如果还没加载（学中文、英语时先不加载，见 index.html），先等它们
  const needs = (VIEW_NEEDS[view] || []).concat(trackOf(view) === 'ja' && window.LAZY_JA ? window.LAZY_JA : []);
  if (!needs.length) needs.length = 0;
  if (!lk && needs.length && !scriptsReady(needs)) {   // 数据还没加载：先显示骨架，加载完再画（地址没变的话）
    const at = location.hash;
    main.append(h('<section class="panel"><div class="skel" aria-label="加载中" role="status"><i></i><i></i><i></i></div></section>'));
    needScripts(needs).then(() => { needs.forEach(f => { LAZY_JS[f].done = true; }); if (location.hash === at) render(); })
      .catch(() => { main.innerHTML = `<section class="panel"><p class="muted">${tj('加载失败，请检查网络后重试。', '読み込めませんでした。通信状況を確認してください。')}</p></section>`; });
  } else if (lk) main.append(lockPanel(lk)); else {
    VIEWS[view](arg ? decodeURIComponent(arg) : undefined);
    // 首页：学了一段时间没测过水平，提示一次（levelcheck.js）
    if (S.onboarded && !arg && view === homeView() && typeof lcBanner === 'function') { const b = lcBanner(); if (b) (main.firstElementChild ? main.firstElementChild.after(b) : main.append(b)); }
    if (S.onboarded && !arg && view === homeView() && typeof dgCard === 'function') { const c = dgCard(); if (c) (main.firstElementChild ? main.firstElementChild.after(c) : main.append(c)); }   // 学习诊断的小卡片（diagnose.js）
    if (S.onboarded && !arg && view === homeView() && typeof pathCard === 'function') { const c = pathCard(); if (c) (main.firstElementChild ? main.firstElementChild.after(c) : main.append(c)); }   // 学习路线的下一步（path.js）
  }
  // 第一次打开：先放一遍使用介绍（tour.js，可以跳过）
  if (view === 'welcome' && typeof introShow === 'function' && !introSeen()) introShow();
  updateTop();
  if (typeof liveBadges !== 'undefined') liveBadges.paint();   // 底部导航重画后补上小红点
  if (typeof fxPageIn === 'function') fxPageIn();   // 新页面「哗」地弹出来（fx.js）
}
// 正在做题（专注模式）时离开当前页面（返回手势、点顶部链接等）先确认，选「继续做题」就留在原地，进度不丢
let navHash = location.hash, navGo = false;
const busy = () => document.body.classList.contains('focus');
const leaveOk = () => busy() ? askConfirm(tje('正在做题，离开的话这一轮的进度不会保存。', '問題に取り組んでいる途中です。移動すると、このラウンドの進み具合は保存されません。', 'You\'re in the middle of a round. Leave and lose this round\'s progress?'), tje('离开', '移動する', 'Leave'), tje('继续做题', '続ける', 'Keep going')) : Promise.resolve(true);
// 换页时所有正在播放的声音立刻停（全文朗读、听力、课程、中文录音……各页面自己 new 的 Audio 也算）
const PLAYING = new Set();
{ const play0 = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { PLAYING.add(this); this.addEventListener('ended', () => PLAYING.delete(this), { once: true }); return play0.apply(this, arguments); }; }
function stopAllSound() {
  try { stopSpeech(); } catch (e) { /* 忽略 */ }
  PLAYING.forEach(a => { try { a.pause(); } catch (e) { /* 忽略 */ } }); PLAYING.clear();
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* 忽略 */ }
}
addEventListener('hashchange', async () => {
  if (!navGo && busy()) {
    const to = location.hash;
    history.replaceState(history.state, '', navHash || '#home');   // 地址先改回来（不触发刷新）
    if (!await leaveOk()) return;
    navGo = true; location.hash = to; return;
  }
  navGo = false; navHash = location.hash; staleGuard = false;
  stopAllSound();
  render(); scrollTo(0, 0);
});
// 返回手势 / 返回键：做题中先问；做完以后留下的那一层直接跳过
addEventListener('popstate', async e => {
  if (e.state && e.state.guard) { if (!busy()) { staleGuard = false; history.back(); } return; }
  // 只在「按返回、地址没变」（回到了垫的那一层下面）时再退一步；点链接去别的页面也会触发 popstate，那时地址变了，不能退
  if (!busy() && staleGuard && sameHash(navHash) && !(e.state && e.state.dictLayer)) { staleGuard = false; history.back(); return; }
  if (!busy() || (e.state && e.state.dictLayer) || document.querySelector('.dict-layer')) return;
  if (!await leaveOk()) { try { history.pushState({ guard: 1 }, ''); } catch (err) { /* 忽略 */ } return; }
  navGo = true; history.back();
});
// 做题中点页面上的链接（顶部的级别、连续天数等）也先问
document.addEventListener('click', async e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || !busy() || sameHash(a.getAttribute('href'))) return;
  e.preventDefault(); e.stopPropagation();
  if (await leaveOk()) { navGo = true; location.hash = a.getAttribute('href'); }
}, true);
// 网址比较：location.hash 里的中文、日文会被浏览器编码成 %E6…，先解码再比
const hashKey = s => { s = String(s || '').replace(/^#/, ''); try { return decodeURIComponent(s); } catch (e) { return s; } };
const sameHash = to => hashKey(location.hash) === hashKey(to);
// 当前语言的首页（日语 home、中文 zh、英语 en）
const homeView = () => ((typeof TRACKS !== 'undefined' && TRACKS[S.track || 'ja']) || { home: 'home' }).home;
// 程序里的跳转（做完一局点「返回」等）不用确认。已经在那个页面的话浏览器不会跳（例如在首页里直接做的订正错题，网址一直是 #home），
// 这时直接重新显示页面
const go = view => { view = String(view).replace(/^#/, ''); if (sameHash(view)) { stopAllSound(); render(); scrollTo(0, 0); } else { navGo = true; location.hash = view; } };
const navTo = go;   // 给局部变量也叫 go 的地方用（inbox.js）
// 点指向当前页面的站内链接（做完首页里的练习点「回到今天」、点底部当前栏目、点站名……）：同上，重新显示；做题中先确认
document.addEventListener('click', e => {
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href^="#"]');
  const href = a && a.getAttribute('href');
  if (!href || href === '#' || !sameHash(href)) return;
  e.preventDefault();
  leaveOk().then(ok => { if (ok) { render(); scrollTo(0, 0); } });
});

/* 欢迎 + 分级测试 */
const START_OPTS = [
  ['zero', 'あ', '零基础', '还不会假名，从五十音开始'],
  ['N5', 'N5', '入门', '会假名，认识一些简单单词'],
  ['N4', 'N4', '初级', '能看懂简单的句子和对话'],
  ['N3', 'N3', '中级', '日常会话基本没问题'],
  ['N2', 'N2', '中高级', '能读文章、看新闻'],
  ['N1', 'N1', '高级', '冲刺最高级别 N1']
];
// 新用户引导：先选要学的语言，再选水平和每天的量
let welcomeLang = null, welcomeUiOrig;
const LANG_START = {
  // 英语：CEFR 级别。[级别, 徽章, 中文标题, 中文说明, 日文标题, 日文说明]（学英语的人可能说中文，也可能说日语）
  en: [['A1', 'A1', '入门', '从最常用的词和简单句开始', '入門', '基本の単語と簡単な文から'], ['A2', 'A2', '初级', '能应付日常简单对话', '初級', '日常の簡単な会話ができる'],
    ['B1', 'B1', '中级', '能读懂日常文章，旅行没问题', '中級', '日常の文章が読める・旅行で困らない'], ['B2', 'B2', '中高级', '能看新闻、在工作中使用', '中上級', 'ニュースや仕事で使える'], ['C1', 'C1', '高级', '复杂的内容也能流利表达', '上級', '複雑な内容も流暢に']],
  // 中国語：学的人是日本用户，说明文字用日语
  zh: [['pinyin', 'pīn', 'はじめて', 'ピンインと声調から'], ['HSK1', 'HSK1', '入門', '基本の単語とあいさつから'], ['HSK3', 'HSK3', '初級', '日常会話ができる'], ['HSK5', 'HSK5', '中上級', 'ニュースや文章を読みたい']]
};
function viewWelcome() {
  let pick = null, goal = S.goal;
  const L = welcomeLang, J = L === 'zh' || (L === 'en' && uiJa());   // 界面用日语：选了「中国語」（用户是日本人），或说日语的人选了英语
  const JA = J || (!L && uiJa());   // 还没选：按手机语言（或注册页选的界面语言）显示
  const langCards = JA
    ? [['ja', '日本語', '日本語', '中国語話者向け：五十音・JLPT N5〜N1'], ['zh', '中文', '中国語', '日本語で学ぶ中国語：ピンイン・HSK 1〜6級・読み物'], ['en', 'English', '英語', '日本語の解説つき：単語・文法・読む・聴く（CEFR A1〜C1）']]
    : [['ja', '日本語', '日语', '五十音、JLPT N5–N1、阅读、听力、商务日语'], ['zh', '中文', '中国語', '日本語で学ぶ中国語：ピンイン・HSK 1〜6級・読み物'], ['en', 'English', '英语', '中文讲解：单词、语法、阅读、听力（CEFR A1–C1）']];
  const goals = J ? [[30, 'ゆったり · 約5分'], [50, '標準 · 約10分'], [100, 'しっかり · 約20分']] : [[30, '轻松 · 约 5 分钟'], [50, '标准 · 约 10 分钟'], [100, '认真 · 约 20 分钟']];
  const p = h(`<section class="panel welcome">
    <div class="welcome-hi">${mascotDuo('happy', 'big')}<div class="bubble"><b>ようこそ！ 欢迎！</b><span>${L ? (J ? '今のレベルを教えてください。今日の学習メニューを用意します。' : '再告诉我你的水平，我帮你安排今天学什么。') : JA ? '学びたい言語を選んでください。あとから上部でいつでも切り替えられます。' : '欢迎！先选一门你想学的语言，以后随时可以在顶部切换。'}</span></div></div>
    <h2>${JA ? '学びたい言語は？' : '想学哪种语言？'}</h2>
    ${L ? '' : JA ? '<p class="small muted" lang="zh-CN">想学日语的中文用户，请选「日语」。</p>' : '<p class="small muted" lang="ja">中国語を学びたい方は「中国語」を選んでください。</p>'}
    <div class="lvl-opts">${langCards.map(([k, n, zh, d]) => `<button type="button" class="lvl-opt ${L === k ? 'on' : ''}" data-lang-pick="${k}"><span class="lvl-badge" ${k === 'zh' ? 'lang="zh-CN"' : ''}>${n}</span><b ${k === 'zh' || J ? 'lang="ja"' : ''}>${zh}</b><span class="small muted" ${k === 'zh' || J ? 'lang="ja"' : ''}>${d}</span></button>`).join('')}</div>
    ${!L ? '' : L === 'ja' ? `<h2>你现在的日语水平？</h2>
    <div class="lvl-opts">${START_OPTS.map(o => `<button type="button" class="lvl-opt" data-pick="${o[0]}"><span class="lvl-badge" lang="ja">${o[1]}</span><b>${o[2]}</b><span class="small muted">${o[3]}</span></button>`).join('')}</div>
    <button type="button" class="btn soft" data-place>不确定？做个 2 分钟分级小测试</button>`
    : `<h2>${L === 'zh' ? '今の中国語レベルは？' : J ? '今の英語レベルは？' : '你现在的英语水平？'}</h2>
    <div class="lvl-opts">${LANG_START[L].map(o => `<button type="button" class="lvl-opt" data-pick="${o[0]}"><span class="lvl-badge">${o[1]}</span><b>${L === 'en' && J ? o[4] : o[2]}</b><span class="small muted">${L === 'en' && J ? o[5] : o[3]}</span></button>`).join('')}</div>${L === 'zh' ? '<button type="button" class="btn soft" data-zhplace>わからない場合は 2 分のレベル診断へ</button>' : L === 'en' ? `<button type="button" class="btn soft" data-enplace>${J ? 'わからない場合は 3 分のレベル診断へ' : '不确定？做个 3 分钟分级测试'}</button>` : ''}`}
    ${L ? `<h2>${J ? '1日にどれくらい学びますか？' : '每天想学多少？'}</h2>
    <div class="seg" data-goals>${goals.map(([v, t]) => `<button type="button" data-goal="${v}">${t}</button>`).join('')}</div>
    <div class="row"><button type="button" class="btn pri big" data-start disabled>${J ? '学習をはじめる' : '开始学习'}</button><a class="btn ghost" href="#me">${J ? 'アカウントやバックアップから進み具合を復元' : '我有账号或备份，去恢复进度'}</a></div>` : ''}
  </section>`);
  p.querySelectorAll('[data-lang-pick]').forEach(b => {
    b.onclick = () => {
      welcomeLang = b.dataset.langPick;
      // 学中文＝日本用户，界面日语；学日语＝中文界面；学英语：界面不变（按手机语言，说中文、说日语的人都有）
      try {
        if (welcomeUiOrig === undefined) welcomeUiOrig = localStorage.getItem('dojo-ui');   // 进欢迎页之前的界面语言（注册页选的，或没选）
        if (welcomeLang !== 'en') localStorage.setItem('dojo-ui', welcomeLang === 'zh' ? 'ja' : 'zh');
        else if (welcomeUiOrig == null) localStorage.removeItem('dojo-ui'); else localStorage.setItem('dojo-ui', welcomeUiOrig);   // 先点了别的再改选英语：回到原来的（按手机语言）
      } catch (e) { /* 忽略 */ }
      // 选了中国語就先把界面切成日语（「我的」恢复进度等页面也跟着变）；改选别的语言再切回来。只改内存，不保存
      if (welcomeLang === 'zh') S.track = 'zh'; else if (S.track === 'zh') S.track = 'ja';
      render();
    };
  });
  if (!L) return main.append(p);
  const sync = () => {
    p.querySelectorAll('[data-pick]').forEach(b => b.classList.toggle('on', b.dataset.pick === pick));
    p.querySelectorAll('[data-goal]').forEach(b => b.classList.toggle('on', +b.dataset.goal === goal));
    p.querySelector('[data-start]').disabled = !pick;
  };
  p.querySelectorAll('[data-pick]').forEach(b => { b.onclick = () => { pick = b.dataset.pick; sync(); }; });
  p.querySelectorAll('[data-goal]').forEach(b => { b.onclick = () => { goal = +b.dataset.goal; sync(); }; });
  const pl = p.querySelector('[data-place]'); if (pl) pl.onclick = placementTest;
  const zp = p.querySelector('[data-zhplace]'); if (zp) zp.onclick = () => { S.onboarded = true; S.track = 'zh'; S.goal = goal || S.goal; save(); go('zh/placement'); };
  const ep = p.querySelector('[data-enplace]'); if (ep) ep.onclick = () => { S.onboarded = true; S.enNative = J ? 'ja' : 'zh'; S.track = 'en'; S.goal = goal || S.goal; save(); go('en/placement'); };
  p.querySelector('[data-start]').onclick = () => { if (L === 'en') S.enNative = J ? 'ja' : 'zh'; return L === 'ja' ? finishOnboarding(pick, goal) : finishLangOnboarding(L, pick, goal); };
  sync();
  main.append(p);
  p.querySelector('h2:nth-of-type(2)').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function finishLangOnboarding(tr, pick, goal) {
  S.onboarded = true; S.goal = goal || S.goal; S.track = tr;
  if (tr === 'zh') {   // 中国語：pinyin（はじめて）从 HSK1 + 拼音页开始
    S.zhLevel = pick === 'pinyin' ? 'HSK1' : pick;
    save(); requestPersist(); celebrate();
    toast(pick === 'pinyin' ? 'まずはピンインと声調から。1日に少しずつで大丈夫です' : `目標を ${S.zhLevel} に設定しました。画面上部の級表示からいつでも変更できます`);
    go(pick === 'pinyin' ? 'path' : 'zh');   // はじめて：学習ロードマップ（最初のステップがピンイン）
    return;
  }
  if (tr === 'en') {   // 英语：记下母语（界面和讲解用中文还是日语）和起步级别
    S.enNative = S.enNative || 'zh'; S.enLevel = EN_LV.includes(pick) ? pick : 'A1';
    save(); requestPersist(); celebrate();
    toast(`Let's go! ${S.enLevel}`);
    go('en');
    return;
  }
  save(); requestPersist(); celebrate();
  toast('开始吧！可以随时在顶部切换语言');
  go(tr);
}
function finishOnboarding(pick, goal) {
  S.onboarded = true; S.goal = goal || S.goal; S.track = 'ja';
  S.level = pick === 'zero' ? 'N5' : pick;
  save(); requestPersist(); celebrate();
  if (pick === 'zero') { toast('先从五十音开始，一天认一行就很好'); go('path'); }   // 零基础：先看学习路线（第 1 步就是五十音）
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
    title: '分级小测试 · 20 题', exam: true, noRecord: true, noWeak: true, onDone: r => {
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
  markBackedUp(); toast(tj('备份已下载，换设备时在「我的」里导入', 'バックアップをダウンロードしました。機種変更のときは「マイページ」から読み込めます'));
}
const needBackup = () => S.xp >= 150 && (S.xp - S.lastBackupXp >= 300 || (S.lastBackup && Date.now() - S.lastBackup > 14 * DAY)) && !(S.snooze && Date.now() - S.snooze < 3 * DAY);

/* 今日一句：一年 366 句，按日期取（闰年的第几天）。只显示今天的（不能翻看前后几天：提前看到明天的就没意思了） */
const dailyOff = 0;
const LEAP_MONTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const dailySlot = d => LEAP_MONTHS.slice(0, d.getMonth()).reduce((a, b) => a + b, 0) + d.getDate() - 1;
function dailyCard() {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + dailyOff);
  if (typeof DAILY === 'undefined' || !DAILY.length) {
    const pv = PROVERBS[Math.floor(startOfToday() / DAY) % PROVERBS.length];
    return h(`<div class="proverb"><span class="eyebrow">今日一句</span><div class="row"><span class="jp-big furi" lang="ja">${jr(pv[0], pv[1])}</span>${speakBtn(pv[3] || pv[1])}</div>${S.furiMode === 'none' ? `<span class="small muted" lang="ja">${esc(pv[1])}</span>` : ''}<span>${pv[2]}</span></div>`);
  }
  const [jp, yomi, zh, note, ex, exk, exzh, kind, say] = DAILY[dailySlot(d) % DAILY.length];
  const label = dailyOff === 0 ? '今日一句' : dailyOff === -1 ? '昨日一句' : dailyOff === 1 ? '明日一句' : `${d.getMonth() + 1}月${d.getDate()}日`;
  const c = h(`<div class="proverb daily">
    <div class="row between"><span class="row"><span class="eyebrow">${label}</span><span class="tag">${esc(kind)}</span>${Math.abs(dailyOff) <= 1 ? `<span class="small muted">${d.getMonth() + 1}月${d.getDate()}日</span>` : ''}</span>
</div>
    <div class="row"><span class="jp-big furi jtap" lang="ja">${jrTap(jp, yomi)}</span>${speakBtn(say)}</div>
    ${S.furiMode === 'none' || !KJ.test(jp) ? `<span class="small muted" lang="ja">${esc(yomi)}</span>` : ''}
    <b>${esc(zh)}</b>
    ${dailyMore(`<span class="small muted">${jrNote(note)}</span>
      <div class="ex"><div style="flex:1;min-width:0"><div class="jp furi jtap" lang="ja">${jrTap(ex, exk)}</div><div class="small muted">${esc(exzh)}</div></div>${speakBtn(exk, '朗读例句')}</div>`)}
  </div>`);
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
  // 首页顺序：一行问候 → 今日上新 → 今日一句 → 「接下来」一行 → 今日任务 → 折叠的进度和印章 → 提示横幅（考试目标在「我的」里，不放首页；见 lang.js 的 homeHi）
  const hi = homeHi(mood[1], mood[2], tx, s, `${learnedN} 词 · 掌握 ${masteredN} · ${typeof wkCount === 'function' ? `弱项 ${wkCount('ja')}` : `错题 ${wrongN}`}`);
  const top = [];
  const after = [];
  const ta = typeof todayArticle === 'function' && todayArticle();
  if (ta && !(S.read || {})[ta.id]) top.push(h(`<a class="today-art" href="#read/${ta.id}"><div class="ta-img">${artImg(ta)}</div><div><span class="tag done">今日上新</span> <span class="tag lv">${ta.L}</span><div class="rc-title furi" lang="ja">${jr(ta.title)}</div><div class="small muted">${esc(ta.zh)} · 日本生活阅读，每天一篇</div></div></a>`));
  if (typeof buddyStrip === 'function') after.push(buddyStrip());   // 学习伙伴今天的情况
  top.push(dailyCard());
  const wc = typeof weekCard === 'function' && weekCard(); if (wc) after.unshift(wc);   // 本周精选放在今日任务下面（任务先出现在第一屏）   // 本周精选（每周一换新）
  const banners = homeBanners();
  const progress = homeProgress();

  const ns = nextStage(S.level);
  const tasks = [
    { ic: '関', t: `闯关 · ${S.level} 第 ${ns} 关${isBoss(ns) ? '（头目关）' : ''}`, d: `已获得 ${totalStars(S.level)} 颗星，每关一组新词`, go: () => stageIntro(S.level, ns) },
    { ic: '復', t: '复习到期卡片', d: due ? `${due} 张卡片到了复习时间` : '没有到期的卡片', done: !due, go: () => { if (due) { const host = h('<div></div>'); main.innerHTML = ''; main.append(host); startCards(host, shuffle(dueList(LEVELS)).map(v => v.id), '复习到期卡片', () => go('home')); } } },
    { ic: '新', t: `学习 ${S.level} 新单词`, d: nl ? `今天还可以学 ${nl} 个新词` : newList(S.level).length ? `今天的 ${S.newPerDay} 个新词已学完` : `${S.level} 的单词都学过了，去「我的」换个级别吧`, done: !nl, go: () => { if (nl) { const host = h('<div></div>'); main.innerHTML = ''; main.append(host); startCards(host, newList(S.level).slice(0, nl).map(v => v.id), `${S.level} 新单词`, () => go('home')); } } },
    { ic: '文', t: `${S.level} 语法练习`, d: '8 道填空题，每题 10 经验', go: () => grammarQuiz(S.level, () => go('home')) },
    typeof weakTask === 'function' ? weakTask('ja') : wrongN ? { ic: '誤', t: '订正错题', d: `错题本里有 ${wrongN} 道题，答对就会移出`, go: wrongReview } : null,   // 我的弱项（weak.js）
    typeof nightTask === 'function' ? nightTask() : null,   // 傍晚以后：睡前复习（conv.js）
    S.level === 'N5' ? { ic: 'あ', t: '假名热身', d: '10 道假名识读题', go: () => go('kana') } : null
  ].filter(Boolean);
  const tp = h(`<section class="panel"><div class="row between"><h2>今日任务</h2><span class="small muted">目标级别 ${S.level}</span></div><div class="tasks"></div></section>`);
  tasks.forEach(t => {
    const el = h(`<div class="task ${t.done ? 'done' : ''}"><span class="task-ic" lang="ja">${t.done ? '✓' : t.ic}</span><div class="task-t"><b>${esc(t.t)}</b><div class="small muted">${esc(t.d)}</div></div>${t.done ? '' : '<button class="btn pri" type="button">开始</button>'}</div>`);
    const b = el.querySelector('button'); if (b) b.onclick = t.go;
    tp.querySelector('.tasks').append(el);
  });
  main.append(homeHead(hi, ...top), tp, ...after);

  const lvRows = LEVELS.map(L => { const n = VOCAB[L].filter(learned).length, t = VOCAB[L].length; return `<div class="lv-row"><b>${L}</b><div class="bar"><i style="width:${n / t * 100}%"></i></div></div>`; }).join('');
  main.append(homeFold([progress, homeRecords(lvRows), homeStamps()]), ...banners);
}
// 首页提示横幅：安装到主屏幕、记得备份（三种语言的首页共用；文字跟着界面语言）
function homeBanners() {
  const banners = [];
  if (!isStandalone() && !window.DOJO_APP && S.xp >= 30 && !S.installHint) {
    const ib = h(`<section class="banner"><div><b>${tje('把猫先生装到手机上', '猫先生をホーム画面に追加', 'Add 猫先生 to your home screen')}</b><div class="small">${tje('像 App 一样从主屏幕打开，没有网络也能学。', 'アプリのようにホーム画面から開けて、オフラインでも学習できます。', 'Open it like an app, and keep studying offline.')}</div></div><div class="row"><button class="btn pri" type="button" data-i>${tje('安装', '追加する', 'Install')}</button><button class="btn ghost" type="button" data-x>${tje('不用了', '今はしない', 'Not now')}</button></div></section>`);
    ib.querySelector('[data-i]').onclick = e => { e.stopPropagation(); doInstall(); };
    ib.querySelector('[data-x]').onclick = () => { S.installHint = 1; save(); ib.remove(); };
    banners.push(ib);
  }
  if (needBackup()) {
    const bn = h(`<section class="banner"><div><b>${tje('记得备份一下', 'バックアップしておきましょう', 'Back up your progress')}</b><div class="small">${tje(`你已经攒了 ${S.xp} 经验。进度存在这个浏览器里，清理浏览器数据或换设备前先备份，就不怕丢。`, `これまでに ${S.xp} XP たまりました。進み具合はこのブラウザに保存されています。ブラウザのデータを消す前や機種変更の前にバックアップしておけば安心です。`, `You've earned ${S.xp} XP so far. Your progress is stored in this browser, so back it up before clearing browser data or switching devices.`)}</div></div><div class="row"><button class="btn pri" type="button" data-bk>${tje('下载备份', 'バックアップを保存', 'Download backup')}</button><button class="btn ghost" type="button" data-later>${tje('过几天再说', 'あとで', 'Later')}</button></div></section>`);
    bn.querySelector('[data-bk]').onclick = () => { downloadBackup(); bn.remove(); };
    bn.querySelector('[data-later]').onclick = () => { S.snooze = Date.now(); save(); bn.remove(); };
    banners.push(bn);
  }
  return banners;
}
// 首页下半部分（进度、学习记录、印章）收成一个可展开的区块，首页不用一直往下翻；展开状态记住
function homeFold(nodes) {
  const d = h(`<details class="panel home-fold"${S.foldOpen ? ' open' : ''}><summary><b>${tje('学习记录 · 进度 · 印章', '学習記録・進み具合・スタンプ', 'Progress · Records · Stamps')}</b><span class="small muted">${tje('点开查看', 'タップで表示', 'Tap to open')}</span></summary></details>`);
  nodes.forEach(n => { if (n) { n.classList.add('in-fold'); d.append(n); } });
  d.addEventListener('toggle', () => { S.foldOpen = d.open; save(); });
  return d;
}
// 首页的进度环、学习记录和成就印章（日语、韩语、英语首页共用）
function homeProgress() {
  const tx = todayXP(), pct = Math.min(1, tx / S.goal), C = 2 * Math.PI * 52;
  const ri = rankOf(S.xp), rk = RANKS[ri], nx = RANKS[ri + 1];
  return h(`<section class="panel">
    <div class="hero">
      <div class="ring ${pct >= 1 ? 'full' : ''}"><svg viewBox="0 0 120 120"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--sakura)"/><stop offset="1" style="stop-color:var(--ai)"/></linearGradient></defs><circle class="trk" cx="60" cy="60" r="52"/><circle class="val" cx="60" cy="60" r="52" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
        <div class="ring-c"><b>${tx}</b><span class="small muted">/ ${S.goal} ${tj('经验', 'XP')}</span></div></div>
      <div class="rank">
        <div class="eyebrow">${tje('当前段位', '現在のランク', 'Rank')}</div>
        <div class="rank-name"><span lang="ja">${rk[1]}</span> ${uiJa() ? '' : `<span class="small muted" style="font-family:var(--f-ui);font-weight:400">${rk[2]}</span>`}</div>
        <div class="bar"><i style="width:${nx ? (S.xp - rk[0]) / (nx[0] - rk[0]) * 100 : 100}%"></i></div>
        <p class="small muted">${nx ? tj(`累计 ${S.xp} 经验，距离「${nx[2]}」还差 ${nx[0] - S.xp}`, `累計 ${S.xp} XP・「${nx[1]}」まであと ${nx[0] - S.xp}`) : tj(`累计 ${S.xp} 经验，已是最高段位`, `累計 ${S.xp} XP・最高ランクに到達`)}</p>
      </div>
    </div>
  </section>`);
}
function homeRecords(lvRows, title = '单词进度') {
  // 学习热力图：最近 20 周
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - 7 * 19 - end.getDay());
  let cells = '';
  for (let d = new Date(start); d <= new Date(end.getTime() + (6 - end.getDay()) * DAY); d.setDate(d.getDate() + 1)) {
    const x = S.days[dkey(d)] || 0, fut = d > end;
    const lv = !x ? 0 : x < S.goal / 2 ? 1 : x < S.goal ? 2 : x < S.goal * 2 ? 3 : 4;
    cells += `<i class="h${lv} ${fut ? 'fut' : ''}" title="${dkey(d)}：${x} XP"></i>`;
  }
  return h(`<div class="grid2">
    <section class="panel"><div class="row between"><h2>${tje('学习记录', '学習記録', 'Activity')}</h2><span class="legend">${tj('少', '少')} <i style="background:var(--heat0)"></i><i style="background:var(--heat1)"></i><i style="background:var(--heat2)"></i><i style="background:var(--heat3)"></i><i style="background:var(--heat4)"></i> ${tj('多', '多')}</span></div>
      <div class="heat-wrap"><div class="heat">${cells}</div></div><p class="small muted">${tj('每一格是一天，颜色越深当天经验越多。', '1 マスが 1 日。色が濃いほど、その日にたくさん学習しています。')}</p></section>
    <section class="panel"><h2>${esc(title)}</h2><div class="lv-list">${lvRows}</div></section>
  </div>`);
}
function homeStamps() {
  // 印章：只显示已获得的和接下来 3 个，其余收起
  const ja = uiJa(), stamp = b => `<div class="stamp ${S.badges[b.id] ? 'got' : ''}" title="${esc(ja ? b.ja[1] : b.desc)}"><div class="stamp-in" lang="ja">${b.ch}</div><b>${esc(ja ? b.ja[0] : b.name)}</b><span>${esc(ja ? b.ja[1] : b.desc)}</span></div>`;
  const got = BADGES.filter(b => S.badges[b.id]), next = BADGES.filter(b => !S.badges[b.id]);
  return h(`<section class="panel"><div class="row between"><h2>${tje('成就印章', 'スタンプ', 'Stamps')}</h2></div>
    <div class="stamps">${[...got, ...next.slice(0, 3)].map(stamp).join('')}</div>
    ${next.length > 3 ? `<details class="more-stamps"><summary class="small">${tj('查看全部', 'すべて見る')}</summary><div class="stamps">${next.slice(3).map(stamp).join('')}</div></details>` : ''}</section>`);
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
    <p class="small muted">点任意假名听发音，还可以跟着笔顺「写一写」。平假名用于一般书写，片假名主要用于外来语。</p>
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
  const lines = ['#separator:tab', '#html:true', '#notetype:Basic', '#deck:猫先生', '#tags column:3'];
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
      <div class="stat"><span class="small muted">学过</span><b>${learnedN}</b></div>
      <div class="stat"><span class="small muted">已掌握</span><b>${masteredN}</b></div>
      <div class="stat"><span class="small muted">待复习</span><b>${due}</b></div>
    </div>
    <button class="btn pri big vk-main" type="button" data-study ${due + nl ? '' : 'disabled'}>背单词（复习 ${due} + 新词 ${nl}）</button>
    <div class="vk-two"><button class="btn" type="button" data-quiz>单词测验 10 题</button><button class="btn demon-btn" type="button" data-demon>😈 魔鬼挑战</button></div>
    <details class="vk-help"><summary>单词卡怎么用 · 导出到 Anki</summary><p class="small muted">单词卡和 Anki 一样用间隔重复：记得越牢，下次出现越晚。看完答案后按「重来 / 困难 / 记得 / 简单」评分，键盘可用 1–4。阅读时点生词，也能「+ 单词卡」。习惯用 Anki 的话，可以把学过和加入的单词导出，在 Anki 里「文件 → 导入」。</p><button class="btn ghost" type="button" data-anki>导出到 Anki</button></details>
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
  top.querySelector('[data-demon]').onclick = () => demonChallenge();

  const tbl = h(`<section class="panel">
    <div class="row"><input type="search" id="v-search" placeholder="搜索单词、读音、中文或英文" value="${esc(vocabSearch)}" aria-label="搜索单词">
      <select id="v-filter" aria-label="筛选"><option value="all">全部</option><option value="new">没学过</option><option value="learn">学习中</option><option value="done">已掌握</option></select></div>
    <p class="small muted">点一个单词展开例句，每句都能朗读。<span data-count></span></p>
    <div class="list-wrap"><table class="list vlist"><thead><tr><th>单词</th><th class="col-r">读音</th><th>意思</th><th class="col-st">状态</th><th></th></tr></thead><tbody></tbody></table></div>
    <button class="btn" type="button" data-more hidden>显示更多</button>
  </section>`);
  let shown = 50;
  tbl.querySelector('[data-more]').onclick = () => { shown += 100; fill(); };
  const fill = () => {
    const q = vocabSearch.trim(), ql = q.toLowerCase();
    const all = list.filter(v => !q || v.w.includes(q) || v.r.includes(q) || v.m.includes(q) || v.en.toLowerCase().includes(ql)).filter(v => {
      const st = mastered(v) ? 'done' : learned(v) ? 'learn' : 'new'; return vocabFilter === 'all' || vocabFilter === st;
    });
    const rows = all.slice(0, shown);
    tbl.querySelector('[data-count]').textContent = '';
    tbl.querySelector('[data-more]').hidden = all.length <= shown;
    tbl.querySelector('tbody').innerHTML = rows.map(v => {
      const st = mastered(v) ? '<span class="tag done">已掌握</span>' : learned(v) ? '<span class="tag learn">学习中</span>' : '<span class="tag">新</span>';
      return `<tr class="vrow" data-id="${esc(v.id)}" tabindex="0" aria-expanded="false"><td class="w furi" lang="ja">${jrWord(v.w, v.r)}</td><td class="r col-r" lang="ja">${esc(v.r)}</td><td class="m">${esc(v.m)}</td><td class="col-st">${st}</td><td>${speakBtn(v.r)}</td></tr>`;
    }).join('') || '<tr><td colspan="5" class="muted">没有符合条件的单词</td></tr>';
  };
  const toggle = tr => {
    const open = tr.nextElementSibling && tr.nextElementSibling.classList.contains('vex');
    tbl.querySelectorAll('tr.vex').forEach(x => { x.previousElementSibling.setAttribute('aria-expanded', 'false'); x.remove(); });
    if (open) return;
    tr.setAttribute('aria-expanded', 'true');
    const v = ITEMS[tr.dataset.id];
    const extra = `${v.alt.length ? `<div class="small muted">其他写法：<span lang="ja">${esc(v.alt.join('、'))}</span></div>` : ''}${v.en ? `<div class="small muted">英文：${esc(v.en)}</div>` : ''}`;
    tr.insertAdjacentHTML('afterend', `<tr class="vex"><td colspan="5"><div class="ex-box">${extra}${['N3', 'N2', 'N1'].includes(v.L) && !isMember('ja') ? '' : exHTML(v.w) || '<span class="muted small">这个词的例句还在补充中。</span>'}${['N3', 'N2', 'N1'].includes(v.L) && !isMember('ja') ? `<p class="muted small">${vipTag('inl')} ${tj('这个级别的例句和配音是会员内容。', 'このレベルの例文と音声はメンバー向けです。')} <a href="#vip">${tj('了解会员', 'メンバーについて')} ›</a></p>` : ''}</div></td></tr>`);
  };
  tbl.querySelector('tbody').addEventListener('click', e => { const tr = e.target.closest('tr.vrow'); if (tr) toggle(tr); });
  tbl.querySelector('tbody').addEventListener('keydown', e => { const tr = e.target.closest('tr.vrow'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(tr); } });
  tbl.querySelector('#v-filter').value = vocabFilter;
  tbl.querySelector('#v-search').oninput = e => { vocabSearch = e.target.value; shown = 50; fill(); };
  tbl.querySelector('#v-filter').onchange = e => { vocabFilter = e.target.value; shown = 50; fill(); };
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
    <div class="row"><button class="btn pri" type="button" data-quiz>汉字测验 10 题</button><span class="small muted">按常用程度排列。点击查看读音和相关单词（点单词可朗读）</span></div>
    <div class="kanji-grid">${list.map(k => `<button type="button" class="kj" data-k="${esc(k.id)}" lang="ja" aria-label="${esc(k.k)}">${esc(k.k)}</button>`).join('')}</div>
  </section>`);
  bindLevel(p);
  const detail = () => {
    const k = kanjiSel;
    const words = wordsWith(k.k).slice(0, 8);
    p.querySelector('[data-detail]').innerHTML = `<div class="kj-big" lang="ja" data-kv title="笔顺">${esc(k.k)}</div>
      <div style="display:grid;gap:8px;min-width:0"><dl class="kv"><dt>音读</dt><dd lang="ja">${esc(k.on)}</dd><dt>训读</dt><dd lang="ja">${esc(k.kun)}</dd>${k.zh ? `<dt>意思</dt><dd>${esc(k.zh)}</dd>` : ''}<dt>英文</dt><dd>${esc(k.en)}</dd><dt>笔画</dt><dd>${k.strokes}</dd></dl>
      ${words.length ? `<div class="kj-words">${words.map(v => `<button type="button" class="kw" data-say="${esc(v.r)}"><b lang="ja" class="furi">${jrWord(v.w, v.r)}</b><span lang="ja">${esc(v.r)}</span><small>${esc(v.m)} · ${v.L}</small></button>`).join('')}</div>` : '<span class="small muted">单词库里暂时没有含这个字的词</span>'}</div>`;
    p.querySelectorAll('.kj').forEach(b => b.classList.toggle('on', b.dataset.k === k.id));
    if (typeof strokeInto === 'function') strokeInto(p.querySelector('[data-kv]'), k.k);   // 笔顺动画（KanjiVG）
    if (typeof writePad === 'function') { const wb = h('<button class="btn soft kj-write" type="button">✍ 写一写</button>'); wb.onclick = () => writePad(k.k, { write: true }); p.querySelector('[data-kv]').after(wb); }
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
  const gIn = GRAM[L].filter(g => S.srs[g.id]).length, gDue = GRAM[L].filter(g => S.srs[g.id] && S.srs[g.id].due <= Date.now());
  const p = h(`<section class="panel">
    <div class="row between"><h2>语法 · ${L}</h2>${levelSeg(L)}</div>
    <div class="row"><button class="btn pri" type="button" data-quiz>${GRAM[L].some(g => g.eg.length) ? '语法填空 8 题' : '句型意思 8 题'}</button><button class="btn" type="button" data-gcards>${gIn ? `语法卡复习（到期 ${gDue.length}）` : '把本级语法加入复习卡'}</button></div>
    <p class="small muted">${GRAM[L].some(g => g.eg.length) ? '每个句型都有例句，点开看接续和例句。' : '点开看接续。'}加入复习的句型会按遗忘曲线安排复习，填空答错的也会自动加入。</p>
    <div style="display:grid;gap:8px">${GRAM[L].map(g => `<details class="gp"><summary><span class="pat" lang="ja">${esc(g.p)}</span><span class="muted">${esc(g.m)}</span>${typeof favBtn === 'function' ? favBtn('g', g.p, g.m, 'ja') : ''}</summary>
      <div class="gp-body"><div class="row between"><div><span class="small muted">接续</span>　${jrNote(g.how)}</div><button type="button" class="chip-btn" data-gadd="${esc(g.id)}">${S.srs[g.id] ? '已在复习' : '+ 加入复习'}</button></div>
      ${g.eg.map(e => `<div class="ex"><div style="flex:1;min-width:0"><div class="jp furi jtap" lang="ja">${jaTapHTML(e.full, e.furi, e.at, e.at + e.frag.length)}</div><div class="small muted">${esc(e.t)}</div></div>${exSpeakBtn(e.kana)}</div>`).join('')}${['N3', 'N2', 'N1'].includes(g.L) && !isMember('ja') ? `<p class="small muted">${vipTag('inl')} ${tj('这个句型的例句和配音是会员内容', 'この文型の例文と音声はメンバー向けです')} <a href="#vip">${tj('了解会员', 'メンバーについて')} ›</a></p>` : ''}</div></details>`).join('')}</div>
  </section>`);
  bindLevel(p);
  p.querySelector('[data-quiz]').onclick = () => grammarQuiz(L, render);
  p.querySelectorAll('[data-gadd]').forEach(b => { b.onclick = () => { const id = b.dataset.gadd; if (!S.srs[id]) { S.srs[id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; save(); } b.textContent = '已在复习'; toast('已加入复习，今天就会出现'); }; });
  p.querySelector('[data-gcards]').onclick = () => {
    if (!gIn) { GRAM[L].forEach(g => { S.srs[g.id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; }); save(); toast(`本级句型已加入复习`); }
    const ids = gIn ? gDue.map(g => g.id) : GRAM[L].map(g => g.id);
    if (!ids.length) return toast('现在没有到期的语法卡，明天再来');
    const host = h('<div></div>'); main.innerHTML = ''; main.append(host); startCards(host, shuffle(ids).slice(0, 30), `${L} 语法卡`, () => render());
  };
  // 句型一次显示 20 个，下面「显示更多」（整级一次列出来要翻好几屏）
  { const gs = [...p.querySelectorAll('details.gp')]; let lim = 20;
    if (gs.length > lim) {
      const more = h('<div class="row read-more"><button class="btn" type="button">显示更多句型</button></div>');
      const page = () => { gs.forEach((g, k) => { g.hidden = k >= lim; }); more.hidden = gs.length <= lim; };
      more.querySelector('button').onclick = () => { lim += 20; page(); };
      gs[gs.length - 1].parentElement.after(more); page();
    } }
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
  if (typeof lcCard === 'function') main.append(lcCard());   // 水平测试的入口（levelcheck.js）
  const L = S.level;
  const hist = S.exams.slice(-6).reverse();
  // N3–N1 的模拟考和题型练习是会员内容
  if (JLPT_MEMBER_LV.includes(L)) {
    const member = typeof isMember === 'function' && isMember('ja');
    if (!member || !((typeof JLPT !== 'undefined' && JLPT[L]) || []).length) {
      const p = h(`<section class="panel has-vip">${vipTag()}
        <div class="row between"><h2>模拟考 · ${L}</h2>${levelSeg(L)}</div>
        ${member ? `<div class="skel" aria-label="加载中" role="status"><i></i><i></i><i></i></div>`
          : `<p>${L} 的模拟考（按 JLPT 试卷的题型和顺序、限时、交卷后统一批改）和题型专项练习是会员内容。N5、N4 可以免费练。</p>
          <div class="row"><a class="btn pri" href="#vip">了解会员</a><button class="btn" type="button" data-level="N4">去练 N4</button></div>`}
        ${hist.length ? `<h3>最近成绩</h3><div class="list-wrap"><table class="list"><thead><tr><th>日期</th><th>级别</th><th>得分</th><th>结果</th></tr></thead><tbody>${hist.map(e => `<tr><td>${e.date}</td><td>${e.L}</td><td>${e.score}/${e.total}</td><td>${e.score / e.total >= .6 ? '<span class="tag done">合格</span>' : '<span class="tag">未合格</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
      </section>`);
      bindLevel(p);
      main.append(p);
      if (member) jlptMember().then(ok => { if (p.isConnected) { if (ok) render(); else p.querySelector('.skel').outerHTML = '<p class="muted">暂时打不开，请检查网络后再试。</p>'; } });
      return;
    }
  }
  const p = h(`<section class="panel">
    <div class="row between"><h2>模拟考 · ${L}</h2>${levelSeg(L)}</div>
    <p>按 JLPT 试卷的题型和顺序出题：文字・语汇（汉字读法、表记、文脉、近义替换、用法）→ 语法（语法形式、★排序题）→ 读解。约 30 题，限时 ${EXAM_MIN[L]} 分钟，考试中不显示对错，交卷后统一批改。正确率 60% 以上盖「合格」章。</p>
    <p class="small muted">题目为本站原创，按 JLPT 官方题型编写（真题有版权，不能直接收录），难度略高于考试，干扰项专门挑容易混淆的。</p>
    <p class="small">听力部分单独练：<a href="#listen">听力 →</a></p>
    <div class="row"><button class="btn pri" type="button" data-start>开始考试</button></div>
    ${(typeof JLPT !== 'undefined' && JLPT[L] && JLPT[L].length) ? `<h3>题型专项练习</h3><div class="pick-row">${pickSelect('题型', 'data-drill-t', Object.keys(JTYPE).filter(t => JLPT[L].some(x => x[0] === t)).map(t => [t, JTYPE[t][0]]), '')}<button class="btn" type="button" data-drill>开始练习</button></div>` : ''}
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
  const dr = p.querySelector('[data-drill]'); if (dr) dr.onclick = () => jlptDrill(L, p.querySelector('[data-drill-t]').value);
  main.append(p);
}

/* 我的 */
function viewMe(sec) {
  const opt = (arr, cur, attr) => arr.map(([v, t]) => `<button type="button" ${attr}="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('');
  const J = uiJa(), onOff = [[1, tj('开', 'オン')], [0, tj('关', 'オフ')]];
  const p = h(`<section class="panel"><h2>${tj('学习设置', '学習設定')}</h2>
    <div class="row between"><span>${tj('正在学', '学習中の言語')}</span><div class="seg">${Object.entries(TRACKS).map(([k, t]) => `<button type="button" data-trk-set="${k}" class="${(S.track || 'ja') === k ? 'on' : ''}">${t.name}</button>`).join('')}</div></div>
    ${(S.track || 'ja') === 'ja' ? `<div class="row between"><span>日语目标级别</span>${levelSeg(S.level)}</div>` : ''}
    ${S.track === 'zh' ? `<div class="row between"><span>目標の級</span><div class="seg read-lv">${opt(ZH_LEVELS.map(([L]) => [L, L]), zhLevel(), 'data-zlv')}</div></div>` : ''}
    ${S.track === 'en' ? `<div class="row between"><span>${tj('解释的语言', '解説の言語')}</span><div class="seg">${opt([['zh', '中文'], ['ja', '日本語']], S.enNative || 'zh', 'data-enat')}</div></div>` : ''}
    ${S.track === 'en' ? `<div class="row between"><span>${tj('英语目标级别', '英語の目標レベル')}</span><div class="seg read-lv">${opt(EN_LV.map(L => [L, L]), enLevel(), 'data-elv')}</div></div>` : ''}
    <div class="row between"><span>${tj('每日经验目标', '1日の目標 XP')}</span><div class="seg">${opt(J ? [[30, '30 ゆったり'], [50, '50 標準'], [100, '100 しっかり'], [200, '200 猛特訓']] : [[30, '30 轻松'], [50, '50 标准'], [100, '100 认真'], [200, '200 冲刺']], S.goal, 'data-goal')}</div></div>
    <div class="row between"><span>${tj('每天新单词', '1日の新しい単語')}</span><div class="seg">${opt([[5, '5'], [10, '10'], [20, '20'], [30, '30']], S.newPerDay, 'data-new')}</div></div>
    <div class="row between"><span>${tj('外观', 'テーマ')}</span><div class="seg">${opt([['', tj('跟随系统', '端末に合わせる')], ['light', tj('浅色', 'ライト')], ['dark', tj('深色', 'ダーク')]], S.theme, 'data-theme-set')}</div></div>
    <div class="row between"><span>${tj('字体大小', '文字の大きさ')}</span><div class="seg">${opt([['m', tj('标准', '標準')], ['l', tj('大', '大')], ['xl', tj('特大', '特大')]], S.fontSize || 'm', 'data-fs')}</div></div>
    ${S.track === 'zh' ? `<div class="row between"><span>ピンイン</span><div class="seg">${opt(onOff, (S.zhShow || {}).py === false ? 0 : 1, 'data-zpy')}</div></div>
    <div class="row between"><span>日本語訳</span><div class="seg">${opt(onOff, (S.zhShow || {}).ja === false ? 0 : 1, 'data-zja')}</div></div>` : ''}
    ${S.track === 'en' ? `<div class="row between"><span>${tj('显示翻译（阅读、课程）', '訳を表示（読み物・コース）')}</span><div class="seg">${opt(onOff, S.enRT === false ? 0 : 1, 'data-ert')}</div></div>` : ''}
    ${(S.track || 'ja') === 'ja' ? `<div class="row between"><span>假名注音<span class="small muted">（读音标在汉字上方）</span></span><div class="seg">${opt([['all', '全部'], ['smart', '只标没学过的字'], ['none', '不标']], S.furiMode || 'all', 'data-furi')}</div></div>` : ''}
    <div class="row between"><span>${tj('樱花飘落', '桜の花びら')}</span><div class="seg">${opt(onOff, S.petals ? 1 : 0, 'data-petals')}</div></div>
    <div class="row between"><span>${tj('答题震动', '解答時のバイブ')}<span class="small muted">${tj('（安卓手机）', '（Android）')}</span></span><div class="seg">${opt(onOff, S.haptic === false ? 0 : 1, 'data-haptic')}</div></div>
    <p class="small muted">${tj('经验怎么来：测验答对 10（假名 5），单词卡每张 5，模拟考每题 10，合格再加 50，每 5 连对额外 5。', '経験値（XP）のもらい方：クイズ正解で 10、単語カード 1 枚で 5、模擬試験は 1 問 10（合格でさらに 50）、5 問連続正解ごとにボーナス 5。')}</p>
  </section>`);
  bindLevel(p);
  p.querySelectorAll('[data-trk-set]').forEach(b => { b.onclick = () => { S.track = b.dataset.trkSet; save(); render(); }; });
  p.querySelectorAll('[data-goal]').forEach(b => { b.onclick = () => { S.goal = +b.dataset.goal; save(); render(); }; });
  // 中文・英語のレベルと表示設定（各ページのボタンと同じ値を変える）
  p.querySelectorAll('[data-zlv]').forEach(b => { b.onclick = () => { S.zhLevel = b.dataset.zlv; save(); render(); }; });
  p.querySelectorAll('[data-enat]').forEach(b => { b.onclick = () => { S.enNative = b.dataset.enat; save(); applyTrack('en'); render(); }; });
  p.querySelectorAll('[data-elv]').forEach(b => { b.onclick = () => { S.enLevel = b.dataset.elv; save(); render(); }; });
  p.querySelectorAll('[data-zpy]').forEach(b => { b.onclick = () => { S.zhShow = Object.assign({ py: true, ja: true }, S.zhShow, { py: b.dataset.zpy === '1' }); save(); render(); }; });
  p.querySelectorAll('[data-zja]').forEach(b => { b.onclick = () => { S.zhShow = Object.assign({ py: true, ja: true }, S.zhShow, { ja: b.dataset.zja === '1' }); save(); render(); }; });
  p.querySelectorAll('[data-ert]').forEach(b => { b.onclick = () => { S.enRT = b.dataset.ert === '1'; save(); render(); }; });
  p.querySelectorAll('[data-new]').forEach(b => { b.onclick = () => { S.newPerDay = +b.dataset.new; save(); render(); }; });
  p.querySelectorAll('[data-haptic]').forEach(b => { b.onclick = () => { S.haptic = b.dataset.haptic === '1'; save(); if (S.haptic) buzz(20); render(); }; });
  p.querySelectorAll('[data-petals]').forEach(b => { b.onclick = () => { S.petals = b.dataset.petals === '1'; save(); startPetals(); render(); }; });
  p.querySelectorAll('[data-fs]').forEach(b => { b.onclick = () => { S.fontSize = b.dataset.fs; save(); applyFontSize(); render(); }; });
  p.querySelectorAll('[data-furi]').forEach(b => { b.onclick = () => { S.furiMode = b.dataset.furi; save(); toast(S.furiMode === 'smart' ? '比目标级别简单的汉字和学过的汉字不再标读音' : '已更改'); render(); }; });
  const vs = jaVoices();
  const cur = currentVoice();
  const VTR = S.track === 'zh' || S.track === 'en' ? S.track : 'ja';   // 正在学的语言
  const voiceP = h(`<section class="panel"><h2>${tj('发音', '発音')}</h2>
    <div class="row between"><span>${tj('语速', '読み上げの速さ')}</span><div class="seg">${opt(J ? [[.6, 'とてもゆっくり'], [.8, 'ゆっくり'], [.95, 'ふつう']] : [[.6, '很慢'], [.8, '慢'], [.95, '正常']], S.rate, 'data-rate')}</div></div>
    <div class="row between"><span>${tj('翻卡和答题后自动朗读', 'カードをめくった時・解答後に自動で読み上げ')}</span><div class="seg">${opt(onOff, S.autoSpeak ? 1 : 0, 'data-auto')}</div></div>
    <div class="row"><button class="btn" type="button" data-try>${tje('试听', '試しに聞く', 'Listen')}</button></div>
    <p class="small muted">${tje('所有发音都是预先生成的人声录音（日语 VOICEVOX、中文 MeloTTS / Kokoro、英语 Kokoro），不使用手机自带的机器朗读。', '発音はすべて、あらかじめ用意した人の声の音声です（日本語 VOICEVOX・中国語 MeloTTS / Kokoro・英語 Kokoro）。端末の機械読み上げは使いません。', 'All audio is pre-generated natural voice recordings (Japanese: VOICEVOX, Chinese: MeloTTS / Kokoro, English: Kokoro). Your device\'s text-to-speech is never used.')}</p>
  </section>`);
  // 试听跟着正在学的语言（不是界面语言：学英语的日本用户界面是日语，但要听英语）
  const trySay = () => VTR === 'zh' ? speakLang('谢谢', 'zh-CN') : VTR === 'en' ? speakLang('hello', 'en-US') : speak('こんにちは');   // 有录音的词
  voiceP.querySelectorAll('[data-rate]').forEach(b => { b.onclick = () => { S.rate = +b.dataset.rate; save(); trySay(); render(); }; });
  voiceP.querySelectorAll('[data-auto]').forEach(b => { b.onclick = () => { S.autoSpeak = b.dataset.auto === '1'; save(); render(); }; });
  voiceP.querySelector('[data-try]').onclick = trySay;
  p.querySelectorAll('[data-theme-set]').forEach(b => { b.onclick = () => { S.theme = b.dataset.themeSet; applyTheme(); save(); startPetals(); render(); }; });

  const bk = h(`<section class="panel"><h2>${tj('备份与换设备', 'バックアップと機種変更')}</h2>
    <p class="small">${tj('刷新页面、关掉网页都不会丢进度。只有这几种情况会丢：清除浏览器数据、无痕模式、换设备。另外 iPhone 的 Safari 超过 7 天没打开这个网站会自动清理，把网站「添加到主屏幕」后从图标打开就不会被清理。', 'ページを再読み込みしたり閉じたりしても、進み具合は消えません。消えるのは、ブラウザのデータを削除したとき、プライベートモードのとき、機種変更したときだけです。また iPhone の Safari では、7 日以上サイトを開かないとデータが自動で削除されます。「ホーム画面に追加」してアイコンから開けば削除されません。')}</p>
    <p class="small" data-persist></p>
    ${storageOk ? '' : `<p class="small" style="color:var(--bad)"><b>${tj('当前浏览器无法保存进度（可能是无痕模式），关闭页面后进度会丢失。请先下载备份。', 'このブラウザでは進み具合を保存できません（プライベートモードの可能性があります）。ページを閉じると消えてしまうので、先にバックアップをダウンロードしてください。')}</b></p>`}
    <p class="small muted">${S.lastBackup ? tj(`上次备份：${dkey(new Date(S.lastBackup))}`, `前回のバックアップ：${dkey(new Date(S.lastBackup))}`) : tj('还没有备份过', 'まだバックアップしていません')}</p>
    <div class="row"><button class="btn" type="button" data-dl>${tj('下载备份文件', 'バックアップをダウンロード')}</button>
      <label class="btn" for="imp-file">${tj('导入备份文件', 'バックアップファイルを読み込む')}</label><input type="file" id="imp-file" accept="application/json,.json" hidden>
      <button class="btn" type="button" data-copy>${tj('复制备份文本', 'バックアップをテキストでコピー')}</button></div>
    <textarea id="imp-text" placeholder="${tj('也可以把备份文本粘贴到这里，然后点「导入文本」', 'バックアップのテキストをここに貼り付けて「テキストを読み込む」を押すこともできます')}" aria-label="${tj('备份文本', 'バックアップのテキスト')}"></textarea>
    <div class="row"><button class="btn" type="button" data-imp>${tj('导入文本', 'テキストを読み込む')}</button></div>
    <div data-reset-area class="row"><button class="btn danger" type="button" data-reset>${tj('清空全部进度', 'すべての進み具合を削除')}</button></div>
  </section>`);
  const dump = backupJSON;
  bk.querySelector('[data-dl]').onclick = downloadBackup;
  bk.querySelector('[data-copy]').onclick = () => {
    const ta = bk.querySelector('#imp-text'); ta.value = dump();
    markBackedUp();
    navigator.clipboard.writeText(ta.value).then(() => toast(tj('已复制备份文本', 'バックアップのテキストをコピーしました')), () => { ta.select(); toast(tj('请手动复制选中的文本', '選択されたテキストを手動でコピーしてください')); });
  };
  const importText = txt => {
    try {
      const o = JSON.parse(txt);
      if (!o || o.app !== 'nihongo-dojo' || typeof o.xp !== 'number') throw new Error();
      // 会员身份不能从备份导入（备份是可以随便改的文字）
      delete o.app; delete o.v; const member = S.member; S = Object.assign(blank(), o, { member });
      S.onboarded = true; save(); applyTheme(); startPetals(); toast(tj('导入成功，欢迎回来', '読み込みました。おかえりなさい！')); go(homeView());
    } catch (e) { toast(tj('导入失败：这不是猫先生的备份', '読み込めませんでした。このアプリのバックアップではないようです')); }
  };
  bk.querySelector('#imp-file').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(importText); };
  bk.querySelector('[data-imp]').onclick = () => importText(bk.querySelector('#imp-text').value);
  bk.querySelector('[data-reset]').onclick = () => {
    const area = bk.querySelector('[data-reset-area]');
    area.innerHTML = `<div class="confirm"><span>${tj('确定清空？经验、打卡、单词卡和成就都会删除，无法恢复。', '本当に削除しますか？ 経験値・連続記録・単語カード・スタンプがすべて消え、元に戻せません。')}</span><button class="btn danger" type="button" data-yes>${tj('确定清空', '削除する')}</button><button class="btn" type="button" data-no>${tj('取消', 'キャンセル')}</button></div>`;
    area.querySelector('[data-yes]').onclick = () => { const th = S.theme, ja = uiJa(); S = blank(); S.theme = th; save(); toast(ja ? '削除しました' : '已清空'); go('home'); };
    area.querySelector('[data-no]').onclick = render;
  };

  const ps = bk.querySelector('[data-persist]');
  requestPersist().then(ok => { ps.innerHTML = ok ? tj('<span class="tag done">已开启</span> 浏览器已同意持久保存，空间不足时也不会自动清理这里的数据。', '<span class="tag done">オン</span> ブラウザが永続保存を許可しています。空き容量が少なくなっても、ここのデータは自動で削除されません。') : tj('<span class="tag">未开启</span> 这个浏览器没有同意持久保存，建议添加到主屏幕并定期备份。', '<span class="tag">オフ</span> このブラウザは永続保存を許可していません。ホーム画面に追加して、定期的にバックアップすることをおすすめします。'); });
  // 「我的」是一个菜单：一行一个入口，点开才显示对应内容（#me/<入口>），有新消息的入口带小红点
  const SECTIONS = [
    { id: 'vip', ic: '会', t: tj('会员', 'メンバー'), d: tj('会员能学到的内容、方案和价格', 'メンバーで使える内容・プラン・料金'), href: '#vip' },
    { id: 'buddy', ic: '伴', t: tj('学习伙伴', '学習仲間'), d: tj('和朋友一起打卡、互相提醒', '友だちと一緒に記録して、声をかけ合う'), href: '#buddy', show: () => cloudOn() && buddyReady !== false, badge: 'buddy' },
    { id: 'inbox', ic: '信', t: tj('消息与学习提醒', 'お知らせと学習リマインダー'), d: tj('站内消息、每天的学习提醒', 'アプリ内のお知らせ、毎日の学習リマインダー'), show: () => cloudOn() || typeof appReminderPanel === 'function', badge: 'inbox',
      build: () => [typeof appReminderPanel === 'function' ? appReminderPanel() : null, typeof inboxPanel === 'function' ? inboxPanel() : null] },
    { id: 'features', ic: '✨', t: tj('功能地图', '機能マップ'), d: tj('容易被忽略的好用功能', '見落としがちな便利機能'), build: () => [featuresPanel()] },
    { id: 'calendar', ic: '暦', t: tj('学习日历', '学習カレンダー'), d: tj('每天学了多少、断签补签', '毎日の学習量・連続記録の補填'), href: '#calendar' },
    { id: 'fav', ic: '★', t: tj('收藏夹', 'お気に入り'), d: tj('收藏的单词、句子、语法', '保存した単語・文・文法'), href: '#fav' },
    { id: 'offline', ic: '⬇', t: tj('离线录音', 'オフライン音声'), d: tj('下载录音，没网也能听', '音声を保存して電波がなくても聞ける'), href: '#offline' },
    { id: 'exam', ic: '考', t: tj('考试目标', '試験の目標'), d: (S.track || 'ja') === 'ja' ? 'JLPT 倒计时、每天该学多少、冲刺模式' : tj('考试倒计时、每天该学多少', '試験までの日数・1 日に覚える量'), build: () => [(S.track || 'ja') === 'ja' ? examPanel() : p2ExamPanel(S.track)] },
    { id: 'weak', ic: '弱', t: tj('我的弱项', '弱点ノート'), d: tj('答错的题、各类题的正确率、专练弱项', '間違えた問題・種類別の正答率・弱点トレーニング'), build: () => [typeof weakLogPanel === 'function' ? weakLogPanel() : null, (S.track || 'ja') === 'ja' ? weakPanel() : p2WeakPanel(S.track)].filter(Boolean) },
    { id: 'weekly', ic: '週', t: tj('本周小结', '今週のまとめ'), d: tj('这周学了多少、和上周比', '今週の学習量と先週との比較'), build: () => [weeklyPanel()] },
    { id: 'rank', ic: tj('榜', '順'), t: tj('本周排行', '今週のランキング'), d: tj('自愿参加，只显示昵称和经验', '参加は任意。表示されるのはニックネームと XP だけ'), show: () => cloudOn(), build: () => [typeof leaderboardPanel === 'function' ? leaderboardPanel() : null] },
    { id: 'diag', ic: tj('诊', '診'), t: tje('学习诊断', '学習診断', 'Study check-up'), d: tje('哪里该补、今天先做什么、这周的目标', '弱点・今日やること・今週の目標', 'Weak spots, today\'s plan, weekly goals'), href: '#diag' },
    { id: 'invite', ic: tj('邀', '招'), t: tje('邀请好友', '友だちを招待', 'Invite friends'), d: tje('好友学满 3 天，你得一周会员；好友注册送 3 天', '友だちが 3 日学ぶとあなたに 1 週間、友だちに 3 日間', 'A free week for you when a friend studies 3 days'), build: () => [invitePanel()], show: () => cloudOn() && typeof invitePanel === 'function' },
    { id: 'path', ic: tj('路', '道'), t: tje('学习路线', '学習ロードマップ', 'Learning roadmap'), d: tje('从哪里开始、学到哪一步、阶段测试', 'どこから始めるか・いまどこか・ステージテスト', 'Where to start, where you are, stage tests'), href: '#path' },
    { id: 'check', ic: tj('测', '測'), t: tje('水平测试', 'レベルチェック', 'Level check'), d: tje('20 题测测现在是几级、进步了多少', '20 問で今のレベルと伸びをチェック', '20 questions: your level now and your progress'), href: '#check' },
    { id: 'share', ic: tj('图', '図'), t: tj('分享学习成果', '学習の成果をシェア'), d: tj('生成打卡图发朋友圈、小红书', '記録画像を作って SNS でシェア'), show: () => typeof sharePanel === 'function', build: () => [sharePanel()] },
    { id: 'settings', ic: tj('设', '設'), t: tj('学习设置', '学習設定'), d: tj('学习的语言、目标级别、每日目标、外观', '学ぶ言語・1日の目標・テーマ'), build: () => [p] },
    { id: 'voice', ic: '音', t: tj('发音', '発音'), d: tj('语速、自动朗读', '読み上げの速さ・自動読み上げ'), build: () => [voiceP] },
    { id: 'device', ic: tj('机', '機'), t: tj('设备与备份', '端末とバックアップ'), d: tj('装到手机桌面、备份和换设备', 'ホーム画面に追加・バックアップ・機種変更'), build: () => [installPanel(), bk] },
    { id: 'account', ic: '号', t: tj('账号与同步', 'アカウントと同期'), d: tj('登录、云端同步、删除账号', 'ログイン・クラウド同期・アカウント削除'), show: () => cloudOn(), build: () => [accountPanel()] },
  ].filter(x => !x.show || x.show());
  const open = sec && SECTIONS.find(x => x.id === sec && x.build);
  if (open) {
    main.append(h(`<a class="an-back me-back" href="#me">← ${tj('我的', 'マイページ')}</a>`), ...open.build().filter(Boolean));
    if (open.badge === 'inbox') setTimeout(() => liveBadges.clear('inbox'), 1500);   // 打开消息页就算看过了
    return;
  }
  // 英语板块的界面以英语为主：「我的」的标题和说明也用英语
  const EN_ME = { invite: ['Invite friends', 'A free week for you when a friend studies 3 days'], path: ['Learning roadmap', 'Where to start, where you are, stage tests'], vip: ['Membership', 'What members get, plans and prices'], buddy: ['Study buddies', 'Check in together and nudge each other'], inbox: ['Messages & reminders', 'In-app messages and daily study reminders'], features: ['Feature map', 'Handy features you might have missed'], calendar: ['Study calendar', 'What you studied each day, streak repair'], fav: ['Favorites', 'Saved words and sentences'], offline: ['Offline audio', 'Download audio to listen without a connection'], exam: ['Exam goal', 'Countdown and how many new words a day'], weak: ['Weak spots', 'Missed questions, accuracy by type, targeted practice'], weekly: ['This week', 'How much you studied, compared with last week'], rank: ['Weekly ranking', 'Optional; shows only your nickname and XP'], share: ['Share your progress', 'Make an image to share'], settings: ['Settings', 'Language, level, daily goal, display'], voice: ['Audio', 'Speed, voice source, auto-play'], device: ['Device & backup', 'Add to home screen, backup, switching phones'], account: ['Account & sync', 'Sign in, cloud sync, delete account'] };
  if (S.track === 'en') SECTIONS.forEach(x => { if (EN_ME[x.id]) [x.t, x.d] = EN_ME[x.id]; });
  // 分组显示：会员 → 学习 → 和朋友一起 → 设置与账号（一长串同样分量的行，常用的设置找不到）
  const GROUPS = [['top', '', ['vip']], ['study', tje('学习', '学習', 'Study'), ['path', 'calendar', 'fav', 'offline', 'exam', 'weak', 'weekly', 'diag', 'check']], ['social', tje('和朋友一起', '仲間と一緒に', 'With friends'), ['invite', 'buddy', 'inbox', 'rank', 'share']], ['settings', tje('设置与账号', '設定とアカウント', 'Settings & account'), ['settings', 'voice', 'device', 'account', 'features']]];
  const row = x => `<a class="me-row" href="${x.href || '#me/' + x.id}" data-sec="${x.id}">
      <span class="course-ic">${x.ic}</span><div><b>${esc(x.t)}</b><span class="small muted">${esc(x.d)}</span></div>
      ${x.badge ? `<span class="red-dot" data-badge="${x.badge}" hidden></span>` : ''}<span class="me-go" aria-hidden="true">›</span></a>`;
  const menu = h(`<section class="panel me-menu"><h2>${tje('我的', 'マイページ', 'Me')}</h2>${GROUPS.map(([, name, ids]) => { const xs = ids.map(id => SECTIONS.find(x => x.id === id)).filter(Boolean); return xs.length ? `${name ? `<h3 class="me-group">${esc(name)}</h3>` : ''}<div class="me-list">${xs.map(row).join('')}</div>` : ''; }).join('')}${SECTIONS.filter(x => !GROUPS.some(g => g[2].includes(x.id))).map(row).join('')}</section>`);
  main.append(menu);
  liveBadges.paint();
}

// 内容来源和授权（只从页脚的小链接进入；VOICEVOX 和 CC BY / CC BY-SA 的素材要求注明出处）
function viewAbout() {
  main.append(h(`<a class="an-back me-back" href="#me">← ${tj('我的', 'マイページ')}</a>`));
  // 学中文的日本用户看到的是日语版（出处和授权的名称保持原样）
  if (uiJa()) return main.append(h(`<section class="panel"><h2>コンテンツの出典</h2>
    <h3>中国語（日本語話者向け）</h3>
    <p class="small">HSK 1〜6 級（旧 HSK 2.0）の単語、読み物、場面別会話、ピンイン・声調トレーニング。日本語の語義・例文・学習メモ、読み物と会話はすべて当サイトのオリジナルです。ピンインは <a href="https://github.com/mozillazg/python-pinyin" target="_blank" rel="noopener">pypinyin</a>（MIT）で自動付与しているため、まれに読み分けの誤りがあります（お気づきの点はご意見・ご要望からお知らせください）。</p>
    <p class="small muted">データの出典：HSK 語彙表 <a href="https://github.com/drkameleon/complete-hsk-vocabulary" target="_blank" rel="noopener">complete-hsk-vocabulary</a>（MIT）、英語の語義 <a href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict" target="_blank" rel="noopener">CC-CEDICT</a>（<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>）。漢詩は唐・宋代のパブリックドメイン作品です。</p>
    <p class="small muted">書き順・手書き練習：<a href="https://github.com/chanind/hanzi-writer" target="_blank" rel="noopener">Hanzi Writer</a>（MIT）、字形データ <a href="https://github.com/skishore/makemeahanzi" target="_blank" rel="noopener">Make Me a Hanzi</a>（<a href="vendor/hanzi/ARPHICPL.TXT" target="_blank" rel="noopener">Arphic Public License</a>）。中国語の音声は <a href="https://github.com/myshell-ai/MeloTTS" target="_blank" rel="noopener">MeloTTS</a>（MIT）で生成しています。</p>
    <h3>日本語（中国語話者向け）</h3>
    <p class="small">単語・漢字・文法で JLPT N5〜N1 をカバー。ほかに読み物（「日本の暮らし」は毎日更新）、ビジネス日本語、リスニング、模擬試験があります。中国語訳・例文・文章・問題は当サイトで作成したもので、専門家による校閲は受けていません。試験対策には公式問題集や教材もあわせてご利用ください。</p>
    <p class="small muted">データの出典：単語リスト <a href="https://github.com/jamsinclair/open-anki-jlpt-decks" target="_blank" rel="noopener">open-anki-jlpt-decks</a>（MIT）、元データは <a href="http://www.tanos.co.uk/jlpt/" target="_blank" rel="noopener">Jonathan Waller の JLPT 資料</a>（CC BY）。漢字 <a href="https://github.com/davidluzgouveia/kanji-data" target="_blank" rel="noopener">kanji-data</a>（MIT）と KANJIDIC。辞書の英語訳 <a href="https://www.edrdg.org/jmdict/j_jmdict.html" target="_blank" rel="noopener">JMdict</a>（EDRDG、CC BY-SA 4.0）。</p>
    <p class="small muted">配音：<a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener">VOICEVOX</a>:冥鳴ひまり（<a href="https://meimeihimari.wixsite.com/himari/terms-of-use" target="_blank" rel="noopener">使用条款</a>）、VOICEVOX:剣崎雌雄。リスニングと場面別コースではほかに VOICEVOX:春日部つむぎ、VOICEVOX:九州そら、VOICEVOX:雀松朱司、VOICEVOX:玄野武宏、VOICEVOX:小夜/SAYO、VOICEVOX:WhiteCUL、VOICEVOX:四国めたん、VOICEVOX:白上虎太郎、VOICEVOX:麒ヶ島宗麟を使用しています。</p>
    <p class="small muted">「Tatoeba」と表示された日本語の例文は <a href="https://tatoeba.org" target="_blank" rel="noopener">Tatoeba</a>（CC BY 2.0 FR）のもので、ボランティアが翻訳した日中対訳です。</p>
    <p class="small muted">漢字の筆順アニメーションは <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a>（Ulrich Apel、CC BY-SA 3.0）を使用しています。単語のアクセントは <a href="https://github.com/mifunetoshiro/kanjium" target="_blank" rel="noopener">Kanjium</a>（CC BY-SA 4.0）より：The pitch accent notation was provided by Uros O. through his free database.</p>
    <p class="small muted">読み物の写真は <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a> の自由に利用できるライセンス（CC0 / パブリックドメイン / CC BY / CC BY-SA）のもので、各写真の下に作者とライセンスを記載しています。</p>
    <p class="small muted">招待用 QR コード：<a href="https://github.com/kazuhikoarase/qrcode-generator" target="_blank" rel="noopener">qrcode-generator</a>（MIT、QR コードは株式会社デンソーウェーブの登録商標です）。</p>
  </section>`));
  const about = h(`<section class="panel"><h2>内容来源</h2>
    <h3>日语</h3>
    <p class="small">单词、汉字、语法覆盖 JLPT N5–N1；另有阅读文章（「日本生活」每天上新）、商务日语、听力和模拟考。中文释义、例句、文章和题目由本站编写，未经专业审核，备考时请配合官方真题和教材。</p>
    <p class="small muted">数据来源：单词表 <a href="https://github.com/jamsinclair/open-anki-jlpt-decks" target="_blank" rel="noopener">open-anki-jlpt-decks</a>（MIT），基于 <a href="http://www.tanos.co.uk/jlpt/" target="_blank" rel="noopener">Jonathan Waller 的 JLPT 资料</a>（CC BY）；汉字 <a href="https://github.com/davidluzgouveia/kanji-data" target="_blank" rel="noopener">kanji-data</a>（MIT）与 KANJIDIC；词典英文释义 <a href="https://www.edrdg.org/jmdict/j_jmdict.html" target="_blank" rel="noopener">JMdict</a>（EDRDG，CC BY-SA 4.0）。</p>
    <p class="small muted">配音：<a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener">VOICEVOX</a>:冥鳴ひまり（<a href="https://meimeihimari.wixsite.com/himari/terms-of-use" target="_blank" rel="noopener">使用条款</a>）、VOICEVOX:剣崎雌雄；听力和情景课程另用 VOICEVOX:春日部つむぎ、VOICEVOX:九州そら、VOICEVOX:雀松朱司、VOICEVOX:玄野武宏、VOICEVOX:小夜/SAYO、VOICEVOX:WhiteCUL、VOICEVOX:四国めたん、VOICEVOX:白上虎太郎、VOICEVOX:麒ヶ島宗麟。</p>
    <p class="small muted">标着「Tatoeba」的日语例句来自 <a href="https://tatoeba.org" target="_blank" rel="noopener">Tatoeba</a>（CC BY 2.0 FR），是志愿者人工翻译的日中对照句。</p>
    <p class="small muted">汉字笔顺动画来自 <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a>（Ulrich Apel，CC BY-SA 3.0）。单词音调来自 <a href="https://github.com/mifunetoshiro/kanjium" target="_blank" rel="noopener">Kanjium</a>（CC BY-SA 4.0）：The pitch accent notation was provided by Uros O. through his free database.</p>
    <p class="small muted">阅读文章的照片来自 <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>，均为可自由使用的授权（CC0 / 公有领域 / CC BY / CC BY-SA），每张照片下方注明作者和授权。</p>
    <p class="small muted">邀请二维码：<a href="https://github.com/kazuhikoarase/qrcode-generator" target="_blank" rel="noopener">qrcode-generator</a>（MIT；QR Code 是 DENSO WAVE 的注册商标）。</p>
  </section>`);
  main.append(about);
}

/* ---------- 安装到手机（PWA）---------- */
const SITE_URL = 'https://koshokai.github.io/nihonggo-dojo/';
let installEvt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; document.querySelectorAll('[data-install]').forEach(b => { b.hidden = false; }); });
addEventListener('appinstalled', () => { installEvt = null; S.installed = 1; save(); toast(tj('安装好了！以后从主屏幕的图标打开就行', 'インストールしました！ 次からはホーム画面のアイコンから開けます')); });
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
  const ios = isIOS(), br = ios ? '' : androidBrowser(), J = uiJa();
  const inApp = /MicroMessenger| QQ\//i.test(navigator.userAgent);
  const menu = (J ? {
    huawei: ['Huawei / Honor ブラウザ', '画面下の <b>≡</b> メニューを開く', '<b>追加</b> → <b>ホーム画面</b> をタップ（「ショートカットを追加」の場合もあります）'],
    xiaomi: ['Xiaomi ブラウザ', '画面下の <b>≡</b> メニューを開く', '<b>ホーム画面に追加</b> をタップ（「ツール」の中にある場合もあります）'],
    oppo: ['OPPO / OnePlus ブラウザ', '画面下の <b>≡</b> メニューを開く', '<b>追加</b> → <b>ホーム画面</b> をタップ'],
    vivo: ['vivo ブラウザ', '画面下の <b>≡</b> メニューを開く', '<b>ホーム画面に追加</b> をタップ'],
    uc: ['UC / Quark ブラウザ', '画面下の <b>≡</b> メニューを開く', '<b>ホーム画面に追加</b> をタップ（Quark は「ツール」→「ホーム画面に追加」）'],
    qqbrowser: ['QQ ブラウザ', '画面下の <b>≡</b> メニューを開く', '<b>ホーム画面に追加</b> をタップ'],
    samsung: ['Samsung Internet', '画面下の <b>≡</b> メニューを開く', '<b>ページを追加</b> → <b>ホーム画面</b> をタップ'],
    firefox: ['Firefox', '右上の <b>⋮</b> メニューを開く', '<b>インストール</b>（または「ホーム画面に追加」）をタップ'],
    edge: ['Edge', '画面下の <b>≡</b> メニューを開く', '<b>スマートフォンに追加</b>（または「アプリのインストール」）をタップ'],
    chrome: ['Chrome', '右上の <b>⋮</b> メニューを開く', '<b>アプリをインストール</b>（または「ホーム画面に追加」）をタップ']
  } : {
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
  })[br];
  const sh = h(J ? `<div class="word-sheet" role="dialog" aria-label="ホーム画面に追加">
    <button class="ws-x" type="button" aria-label="閉じる">×</button>
    <b>猫先生をスマートフォンに追加</b>
    ${inApp ? `<ol class="inst-steps">
      <li>WeChat / QQ の中ではホーム画面に追加できません。右上の <b>…</b> から <b>ブラウザで開く</b> を選んでください</li>
      <li>または下のボタンでリンクをコピーし、端末のブラウザに貼り付けて開いてください</li>
      <li>ブラウザで開いたら、もう一度「ホーム画面に追加」を押すと、そのブラウザでの手順が表示されます</li></ol>
      <div class="row"><button class="btn pri" type="button" data-copy>リンクをコピー</button></div>`
    : ios ? `<ol class="inst-steps">
      <li><b>Safari</b> でこのサイトを開く</li>
      <li>画面下の <b>共有</b> ボタン <span class="inst-ic">⬆︎</span> をタップ</li>
      <li>下にスクロールして <b>ホーム画面に追加</b> をタップ</li>
      <li>右上の <b>追加</b> をタップすると、ホーム画面にアイコンが表示されます</li></ol>`
    : `<p class="small">お使いのブラウザは <b>${menu[0]}</b> です：</p>
      <ol class="inst-steps"><li>${menu[1]}</li><li>${menu[2]}</li><li>確認すると、ホーム画面にアイコンが表示されます</li></ol>
      <p class="small muted">押しても反応がない・アイコンが出ないときは、Android の <b>設定 → アプリ → このブラウザ → 権限</b> で「ホーム画面のショートカット」を許可してください。</p>
      ${['chrome', 'edge', 'samsung'].includes(br) ? '' : '<p class="small muted">いちばん簡単なのは <b>Chrome</b> か <b>Edge</b> を使う方法です。このサイトを開いて「ホーム画面に追加」を押せば、ワンタップで追加できます。</p>'}`}
    <div class="small muted">追加すると全画面で開けて、オフラインでも使えます。進み具合はウェブ版と共通です。</div>
  </div>` : `<div class="word-sheet" role="dialog" aria-label="安装到手机">
    <button class="ws-x" type="button" aria-label="关闭">×</button>
    <b>把猫先生装到手机上</b>
    ${inApp ? `<ol class="inst-steps">
      <li>微信 / QQ 里不能添加到桌面。点右上角 <b>…</b>，选 <b>在浏览器中打开</b></li>
      <li>或者点下面的按钮复制链接，粘贴到手机自带的浏览器里打开</li>
      <li>在浏览器里打开后，再点一次「安装到手机」，会告诉你那个浏览器怎么装</li></ol>
      <div class="row"><button class="btn pri" type="button" data-copy>复制链接</button></div>`
    : ios ? `<ol class="inst-steps">
      <li>用 <b>Safari</b> 打开本站</li>
      <li>点屏幕下方的 <b>分享</b> 按钮 <span class="inst-ic">⬆︎</span></li>
      <li>往下滑，点 <b>添加到主屏幕</b></li>
      <li>点右上角 <b>添加</b>，主屏幕上就出现猫先生的图标了</li></ol>`
    : `<p class="small">你现在用的是 <b>${menu[0]}</b>：</p>
      <ol class="inst-steps"><li>${menu[1]}</li><li>${menu[2]}</li><li>确认后，桌面上就出现猫先生的图标了</li></ol>
      <p class="small muted">点了没反应、桌面上没出现图标？安卓手机要允许浏览器「创建桌面快捷方式」：<b>设置 → 应用 → 这个浏览器 → 权限</b>，打开「桌面快捷方式」。</p>
      ${['chrome', 'edge', 'samsung'].includes(br) ? '' : '<p class="small muted">最省事的是装 <b>Chrome</b> 或 <b>Edge</b> 浏览器：打开本站后点「安装到手机」，一键就装好。</p>'}`}
    <div class="small muted">装好以后全屏打开、可以离线使用，进度和网页版是同一份。</div>
  </div>`);
  document.body.append(sh);
  sh.querySelector('.ws-x').onclick = closeSheet;
  const cp = sh.querySelector('[data-copy]');
  if (cp) cp.onclick = e => { e.stopPropagation(); navigator.clipboard.writeText(SITE_URL).then(() => toast(tj('链接已复制，去浏览器里粘贴打开', 'リンクをコピーしました。ブラウザに貼り付けて開いてください')), () => toast(SITE_URL)); };
}
function installPanel() {
  const J = uiJa();
  const p = h(`<section class="panel"><h2>${tj('安装到手机 · 分享', 'ホーム画面に追加 · シェア')}</h2>
    ${isStandalone() ? tj('<p class="small"><span class="tag done">已安装</span> 你正在使用安装版。</p>', '<p class="small"><span class="tag done">追加済み</span> ホーム画面版を使っています。</p>')
      : `<p class="small muted">${tj('装到主屏幕后，像 App 一样全屏打开，没有网络也能学。', 'ホーム画面に追加すると、アプリのように全画面で開けて、オフラインでも学習できます。')}</p>
         <div class="row"><button class="btn pri" type="button" data-install-btn>${tj('安装到手机', 'ホーム画面に追加')}</button></div>`}
    <div class="share-box"><div>
      <p class="small">${tj('把网址发给朋友，用浏览器打开就能学：', 'URL を友だちに送れば、ブラウザで開くだけで学べます：')}</p>
      <p class="small" lang="en"><a href="${SITE_URL}">${SITE_URL}</a></p>
      <div class="row"><button class="btn" type="button" data-share>${navigator.share ? tj('分享', 'シェア') : tj('复制链接', 'リンクをコピー')}</button></div>
      ${J ? '' : '<p class="small muted">提示：微信、小红书会拦截或限流带二维码、邮箱的图片和陌生网址。发朋友圈、小红书时可以只写「猫先生」，让朋友搜索或私信要网址。</p>'}
    </div></div>
  </section>`);
  const ib = p.querySelector('[data-install-btn]');
  if (ib) ib.onclick = e => { e.stopPropagation(); doInstall(); };
  p.querySelector('[data-share]').onclick = () => {
    const data = J ? { title: '猫先生', text: '中国語を、もっと楽しく：ピンインから HSK 6級まで、単語・文法・読み物', url: SITE_URL } : { title: '猫先生', text: '玩转日语：从五十音到 N1，单词、语法、阅读、商务日语、模拟考', url: SITE_URL };
    if (navigator.share) navigator.share(data).catch(() => {});
    else navigator.clipboard.writeText(SITE_URL).then(() => toast(tj('链接已复制', 'リンクをコピーしました')), () => toast(SITE_URL));
  };
  return p;
}

/* ---------- 启动 ---------- */
applyTheme();
checkBadges();
render();
initGlobalSearch();
initTrackSwitch();
// 按当前页面重画导航（以前传的是语言名「ja」，直接打开或刷新日语的「学习」「单词」等页面时，底部导航会亮成「今天」）
{ const v0 = (location.hash || '#home').slice(1).split('/')[0]; applyTrack(VIEWS[v0] && v0 !== 'zh' && v0 !== 'en' ? v0 : (document.body.dataset.track || 'ja')); }
// 学中文、英语时没马上加载的日语文件（index.html）：页面出来以后在后台加载
if (window.LAZY_JA) setTimeout(() => window.LAZY_JA.forEach(f => loadScript(f).then(() => { LAZY_JS[f].done = true; }).catch(() => {})), 2000);
cloudInit();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // 新版本的离线缓存接管页面时刷新一次，保证看到的是最新代码（第一次安装不刷新）
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  if (!window.DOJO_APP) navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
}
startPetals();
if (S.onboarded) requestPersist();
// 例句按级别拆成 lang/ja-ex-N5.json…：先加载当前级别，其余级别在后台依次加载，首屏不用等 4 MB 的全部例句
var EXAMPLES;
const EX_MEMBER_LV = ['N3', 'N2', 'N1'];   // 这几级的例句是会员内容
(() => {
  const order = [S.level || 'N5', ...LEVELS.filter(L => L !== (S.level || 'N5'))];
  let n = 0;
  const done = last => {
    if (typeof CORPUS !== 'undefined') CORPUS = null;
    if (typeof TR_POOL !== 'undefined') TR_POOL = null;   // 翻译练习的句子池要算上例句
    const v = (location.hash || '#home').slice(1).split('/')[0];
    // 只在第一份（当前级别）和最后一份加载完时刷新；正在做的练习、测验不打断
    if ((n === 1 || last) && !busy() && (['vocab', 'kanji'].includes(v) || (v === 'trans' && document.querySelector('[data-start]')))) render();
  };
  const next = () => {
    if (n >= order.length) return;
    const L = order[n++];
    exFetch(L).then(d => { EXAMPLES = Object.assign(EXAMPLES || {}, d); done(n === order.length); next(); });
  };
  next();
})();
// N3–N1 的例句是会员内容（member.js 从服务器取；网站上的文件是空的）
function exFetch(L) {
  const path = `lang/ja-ex-${L}.json`;
  return (EX_MEMBER_LV.includes(L) && typeof memberJson === 'function' ? memberJson('ja', path) : fetch(path).then(r => r.ok ? r.json() : {})).catch(() => ({}));
}
// 会员身份变了（member.js 调用）：N3–N1 的例句重新加载（成为会员时加上，到期时去掉）
function exMemberReload() {
  if (typeof EXAMPLES === 'undefined' || !EXAMPLES) return;
  const words = new Set(EX_MEMBER_LV.flatMap(L => (VOCAB[L] || []).map(v => v.w)));
  const low = new Set(['N5', 'N4'].flatMap(L => (VOCAB[L] || []).map(v => v.w)));
  for (const w of Object.keys(EXAMPLES)) if (words.has(w) && !low.has(w)) delete EXAMPLES[w];
  if (typeof CORPUS !== 'undefined') CORPUS = null;
  if (typeof TR_POOL !== 'undefined') TR_POOL = null;
  Promise.all(EX_MEMBER_LV.map(exFetch)).then(ds => { for (const d of ds) Object.assign(EXAMPLES, d); });
}
if (hasTTS) speechSynthesis.onvoiceschanged = () => { if ((location.hash || '').slice(1) === 'me') render(); };
