// 界面语言：学中文（zh 板块）的是日本用户，整个界面（导航、我的、登录、提示框……）都用日语显示。
// 用法：tj('中文文字', '日本語の文字') —— 学中文时返回日语，其余返回中文。
// 不属于某门语言的页面（我的、登录等）跟着当前正在学的语言走（S.track）。
// 还没选学什么语言（新装、刚打开、注册登录页）：按手机的系统语言显示中文或日语，注册页上可以手动切换（localStorage 的 dojo-ui）。
// 英语母语的用户（2026-11 起，分步开放）：学日语、学中文时 S.native = 'en'，界面和讲解用英语。
//   uiEn()：现在要不要用英语界面。tj(zh, ja, en)：第三个参数是英语（没给时退回中文 / 日语，翻译还没做完的地方会这样）。
//   tz(zh, en)：只在日语板块出现的中文文字；tja(ja, en)：只在中文板块出现的日文文字。
//   EN_UI_OPEN：欢迎页和设置里显示「English」入口的开关。翻译做完之前保持 false；开发时在浏览器里 localStorage.setItem('dojo-en-dev', '1') 可以先看。
const EN_UI_OPEN = true;
const enUiOpen = () => { if (EN_UI_OPEN) return true; try { return localStorage.getItem('dojo-en-dev') === '1'; } catch (e) { return false; } };
const uiPref = () => { try { return localStorage.getItem('dojo-ui'); } catch (e) { return null; } };
const uiState = () => { try { return (typeof S !== 'undefined' && S) || JSON.parse(localStorage.getItem('nihongo-dojo:v1') || '{}'); } catch (e) { return {}; } };
const uiEn = () => {
  const st = uiState();
  if (st.track === 'en') return false;   // 学英语的人母语是中文或日语
  if (st.onboarded || st.native === 'en') return st.native === 'en';
  return enUiOpen() && preEn();   // 还没开始学（欢迎页、注册页）：选了 English，或手机不是中文 / 日语
};
// 内容的英文版（英语母语的用户）：en/<文件>.json = { 中文原文: 英文 }，按规则把数据里的中文整句换掉。
// 规则和 tools/ennat/overlay.py 一样（哪些键、哪些数组位置是中文）；会员内容的英文版也是会员内容（memberJson 取会员版，非会员取公开的免费部分）。
const EN_HAN = /[\u3400-\u9fff]/, EN_KANA = /[\u3040-\u30ff]/, EN_QUOTED = /「[^」]*」|『[^』]*』|（[^）]*）|\([^)]*\)|“[^”]*”/g;
const EN_RULES = {
  jlpt: { keys: new Set(), tuples: { N5: [3], N4: [3], N3: [3], N2: [3], N1: [3] }, opts: new Set() },
  animeweek: { keys: new Set(['zh', 'place', 'who', 'scene', 'note']), tuples: { words: [2], talk: [3] }, opts: new Set() },
  animeday: { keys: new Set(['theme', 'title', 'intro', 'zh', 'who', 'note', 'real', 'q']), tuples: { words: [2] }, opts: new Set(['opts']) },
  business: { keys: new Set(['zh', 'note', 'situation']), tuples: { lines: [4], phr: [1], verbs: [3], rewrite: [2, 3], set: [1, 2], words: [2, 5], p: [3], q: [0, 1, 2, 3, 4] }, opts: new Set() },
  weekly: { keys: new Set(['tz']), tuples: { w: [3, 6], k: [2, 3], a: [2, 4] }, opts: new Set() },
  listen: { keys: new Set(['ex']), tuples: { lines: [2] }, opts: new Set(), lists: new Set(['cz']) },
  reading: { keys: new Set(['zh']), tuples: { p: [2], w: [2] }, opts: new Set(), pre: { zh: 't:' }, tpre: { w: 'w:' } },
  course: { keys: new Set(['title', 'intro', 'type', 'scene', 'role', 'relation', 'zh', 'note', 'm', 'how', 'why', 'ok', 'ng', 'feel', 'culture', 'q', 'p']), tuples: { words: [2, 3], eg: [2] }, opts: new Set(['opts']) },
};
// 中文板块（英语母语的用户学中文）：数据里的日文讲解、译文换成英文。规则和 tools/ennat/zh_overlay.py 的 ZRULES 一样。
// root：最外层就是一条条的数组（单词表、每日一句）；tpre 'w:'：单词意思按「w:词|日文」取；dictvals：{ 词: [拼音, 日文意思] } 的词表
(() => {
  const R = o => Object.assign({ keys: new Set(), tuples: {}, opts: new Set() }, o, o.keys ? { keys: new Set(o.keys) } : {}, o.lists ? { lists: new Set(o.lists) } : {});
  Object.assign(EN_RULES, {
    zhword: R({ root: '_', tuples: { _: [2, 5, 6] }, tpre: { _: 'w:' } }),
    zhdict: R({ root: '_', tuples: { _: [2] }, tpre: { _: 'w:' } }),
    zhdaily: R({ root: '_', tuples: { _: [2, 3, 4, 7] } }),
    zhgrammar: R({ keys: ['title', 'ja', 'tip', 'q', 'why'], tuples: { eg: [2] }, lists: ['opts'] }),
    zhread: R({ keys: ['title_ja', 'intro_ja', 'note_ja', 'q'], tuples: { p: [1], w: [2] }, tpre: { w: 'w:' }, lists: ['opts'], dictvals: { gloss: 1 } }),
    zhreadidx: R({ keys: ['title_ja', 'intro_ja'] }),
    zhlisten: R({ keys: ['t', 'q', 'why'], tuples: { lines: [2], words: [2] }, tpre: { words: 'w:' }, lists: ['opts'] }),
    zhweekly: R({ keys: ['tj'], tuples: { k: [2, 3] } }),
    zhcourse: R({ keys: ['title', 'intro', 'type', 'scene', 'role', 'relation', 'ja', 'note', 'm', 'how', 'ok', 'ng', 'feel', 'culture', 'q', 'why'], tuples: { words: [2, 3], eg: [2] }, tpre: { words: 'w:' }, dictvals: { gloss: 1 }, lists: ['opts'] }),
    zhbiz: R({ keys: ['title_ja', 'situation_ja', 'tips_ja', 'q', 'why'], tuples: { body: [2], phrases: [2], words: [2, 4] }, tpre: { words: 'w:' } }),
    zhexam: R({ keys: ['e'] }),
  });
})();
// 同一句中文在不同位置可能要不同的英文（标题「新年」和单词意思「新年」、分类「运动」和单词「運動」）：先查带前缀的键（t:标题、cat:分类、w:单词|意思），没有再查原文
function enSwap(o, rule, map, parent) {
  const pick = (pre, v) => (pre && map[pre + v]) || map[v];
  if (Array.isArray(o)) {
    const idx = rule.tuples[parent], tp = rule.tpre && rule.tpre[parent];
    for (const x of o) {
      if (idx && Array.isArray(x) && typeof x[0] === 'string') { for (const i of idx) { const t = typeof x[i] === 'string' && pick(tp ? tp + x[0] + '|' : '', x[i]); if (t) x[i] = t; } }   // [日语, 假名, 中文, …] 这样的一条
      else if (x && typeof x === 'object') enSwap(x, rule, map, parent);
    }
  } else if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string') { const t = rule.keys.has(k) && pick(rule.pre && rule.pre[k], v); if (t) o[k] = t; }
      else if (Array.isArray(v) && rule.opts.has(k)) v.forEach((s, i) => { if (typeof s === 'string' && map[s]) v[i] = map[s]; });   // 选项里哪些是中文由 overlay.py 决定（英文版里只有中文选项）
      else if (Array.isArray(v) && rule.lists && rule.lists.has(k)) v.forEach((s, i) => { if (typeof s === 'string' && map[s]) v[i] = map[s]; });   // 整个数组都是中文
      else if (v && typeof v === 'object' && !Array.isArray(v) && rule.dictvals && k in rule.dictvals) {   // { 词: [拼音, 意思] }
        const i = rule.dictvals[k];
        for (const w of Object.keys(v)) { const a = v[w]; const t = Array.isArray(a) && typeof a[i] === 'string' && pick('w:' + w + '|', a[i]); if (t) a[i] = t; }
      }
      else enSwap(v, rule, map, k);
    }
  }
  return o;
}
// 分类名（阅读的题材、商务的场景和词汇分类）：数据里保留中文（代码用它当编号、配图标），只在显示时换成英文
const CAT_EN = {"节日季节": "Festivals & seasons", "日本生活": "Life in Japan", "常识": "General knowledge", "传统文化": "Traditional culture", "人文情感": "People & feelings", "职业日常": "Working life", "科技": "Science & technology", "地方美食": "Local food", "运动": "Sports", "美食": "Food", "旅行": "Travel", "感人故事": "Touching stories", "笑话": "Jokes", "动漫": "Anime & manga", "日剧": "Japanese dramas", "日常业务": "Daily tasks", "道歉拒绝": "Apologies & refusals", "贸易物流": "Trade & logistics", "求职就职": "Job hunting & employment", "应酬": "Business entertaining", "会议": "Meetings", "公司组织": "Company organization", "报联商": "Report, inform, consult", "出差": "Business trips", "谈判销售": "Negotiation & sales", "销售营业": "Sales", "职场基础": "Workplace basics", "人事劳务": "HR & labor", "电话": "Phone calls", "求职面试": "Job interviews", "财务会计": "Finance & accounting", "IT办公": "IT & office work", "拜访接待": "Visits & reception", "职位称呼": "Job titles & forms of address"};
const catName = c => (uiEn() && CAT_EN[c]) || c;
// 每日内容（daily_content）：英文版放在这一天的 data.en 里（tools/ennat/overlay.py build animeday 等），权限和这一天一样
const enDaily = (data, kind) => (data && data.en && uiEn() ? enSwap(data, EN_RULES[kind], data.en) : data);
function enApply(track, file, kind, data) {
  if (!data || !uiEn()) return Promise.resolve(data);
  const get = typeof memberJson === 'function' ? memberJson(track, 'en/' + file) : fetch('en/' + file).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  return get.catch(() => null).then(map => (map ? enSwap(data, EN_RULES[kind], map, EN_RULES[kind].root) : data));
}
// 用户的母语（欢迎页第一步选的）：英语母语 → en；学中文、或学英语时讲解用日语 → ja；其余 → zh。顶部和设置里只显示能学的两门语言
const nativeLang = () => {
  if (uiEn()) return 'en';
  const st = uiState();
  if (st.track === 'zh') return 'ja';
  if (st.track === 'en') return st.enNative === 'ja' ? 'ja' : 'zh';
  return 'zh';
};
const uiJa = () => {
  try {
    const st = (typeof S !== 'undefined' && S) || JSON.parse(localStorage.getItem('nihongo-dojo:v1') || '{}');
    if (st.native === 'en' && st.track !== 'en') return false;
    if (st.track === 'zh') return true;
    if (st.track === 'en') return st.enNative === 'ja';   // 英语板块：界面跟着用户的母语（en.js）
    if (st.onboarded) return false;
    const pref = uiPref();
    if (pref) return pref === 'ja';
    return /^ja\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || '');
  } catch (e) { return false; }
};
const tj = (zh, ja, en) => {
  if (uiEn()) { if (en !== undefined) return en; const v = enLookup(zh) ?? enLookup(ja); if (v != null) return v; }
  return uiJa() ? ja : zh;
};
const tz = (zh, en) => uiEn() ? (en !== undefined ? en : enLookup(zh) ?? zh) : zh;
const tja = (ja, en) => uiEn() ? (en !== undefined ? en : enLookup(ja) ?? ja) : ja;
// 英语板块的界面以英语为主（讲解、翻译才用中文 / 日文）：各页面共用的部件（测验、今日任务、首页顶部、底部导航）在英语板块里显示 en
// 还没选语言的新用户（登录页、正在连接）：选了 English，或手机不是中文 / 日语时，用英语
const preEn = () => {
  try {
    const st = (typeof S !== 'undefined' && S) || JSON.parse(localStorage.getItem('nihongo-dojo:v1') || '{}');
    if (st.onboarded || st.track === 'zh') return false;
    const pref = uiPref();
    if (pref) return pref === 'en';
    return !/^(zh|ja)\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || '');
  } catch (e) { return false; }
};
const tje = (zh, ja, en) => { try { if (typeof S !== 'undefined' && S && S.track === 'en') return en; } catch (e) { /* 忽略 */ } return preEn() || uiEn() ? en : tj(zh, ja); };

// index.html 里写死的文字（页脚、顶栏小标签的提示、导航的无障碍名称……）：学中文时换成日语。
// 要换的元素在 HTML 里带 data-ja（文字）或 data-ja-<属性名>（title、aria-label、content 等属性）。
// 第一次换之前把原来的中文存进 data-zh / data-zh-<属性名>，切回其他语言时还原。lang.js 的 applyTrack 每次渲染都会调用。
function i18nStatic() {
  const ja = uiJa();
  document.querySelectorAll('[data-ja]').forEach(el => {
    if (!('zh' in el.dataset)) el.dataset.zh = el.textContent;
    const en = 'en' in el.dataset && ((typeof S !== 'undefined' && S && S.track === 'en') || uiEn());   // 英语板块、英语母语的用户：有 data-en 的用英语
    const t = en ? el.dataset.en : ja ? el.dataset.ja : el.dataset.zh;
    if (el.textContent !== t) el.textContent = t;
  });
  // 属性：data-ja-<属性名>（日语）、data-en-<属性名>（英语母语的用户）
  const en = uiEn();
  document.querySelectorAll('[data-ja-title],[data-ja-aria-label],[data-ja-placeholder],[data-ja-content],[data-en-title],[data-en-aria-label],[data-en-placeholder],[data-en-content]').forEach(el => {
    const attrs = new Set([...el.attributes].filter(a => /^data-(ja|en)-/.test(a.name)).map(a => a.name.slice(8)));
    for (const attr of attrs) {
      const keep = 'data-zh-' + attr;
      if (!el.hasAttribute(keep)) el.setAttribute(keep, el.getAttribute(attr) || '');
      const v = en && el.hasAttribute('data-en-' + attr) ? el.getAttribute('data-en-' + attr) : ja && el.hasAttribute('data-ja-' + attr) ? el.getAttribute('data-ja-' + attr) : el.getAttribute(keep);
      el.setAttribute(attr, v);
    }
  });
}
// 产品名：所有显示品牌的地方都用这个（改名只改这里和 index.html / manifest.json / app/capacitor.config.json）
const BRAND = '猫先生';

/* 英语界面（英语母语的用户）：界面上的中文、日文提示文字按 en-ui.js 的对照表换成英语。
   - EN_UI：{ 原文: 英文 }，原文是中文（日语板块的界面）或日文（中文板块的界面），按去掉首尾空格后的整段文字对照
   - EN_UI_PAT：[[带 {名字} 的原文, 英文]]，用于夹着数字、名字的句子，例如 ['连续 {n} 天', '{n}-day streak']
   - 学习内容不翻译：学日语时 lang="ja" 里的文字、学中文时 lang="zh-CN" 里的文字、data-noen 里的文字原样保留
   - 页面渲染后、以及之后新加进页面的文字（测验、提示框……）都会自动换。只在 uiEn() 时工作，中文、日文用户完全不受影响
   - 句子被 <b> 等标签切成几段、对照表对不上的地方，在代码里用 tj(zh, ja, en) / tz(zh, en) 直接写英文 */
const EN_CJK = /[぀-ヿ㐀-鿿]/;
let EN_PATS = null;
const enPats = () => EN_PATS || (EN_PATS = (typeof EN_UI_PAT !== 'undefined' ? EN_UI_PAT : []).map(([src, en]) => {
  const names = [];
  const body = src.split(/(\{\w+\})/).map(part => {
    const m = part.match(/^\{(\w+)\}$/);
    if (m) { names.push(m[1]); return '(.+?)'; }
    return part.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
  }).join('');
  // 填进去的部分如果是中文、日文（例如「第 1 步：五十音」里的「五十音」），也按对照表翻成英语
  const val = (m, n) => { const v = m[names.indexOf(n) + 1] ?? ''; return EN_CJK.test(v) ? (enLookup(v) ?? v) : v; };
  // 英文也可以是函数（例如月份数字换成月份名、单复数）：收到 { 名字: 值 }
  return [new RegExp('^' + body + '$'), typeof en === 'function' ? m => en(Object.fromEntries(names.map(n => [n, val(m, n)]))) : m => en.replace(/\{(\w+)\}/g, (_, n) => val(m, n))];
}));
function enLookup(text) {
  if (typeof EN_UI === 'undefined') return null;
  const k = String(text).replace(/\s+/g, ' ').trim();
  if (!k || !EN_CJK.test(k)) return null;
  if (Object.prototype.hasOwnProperty.call(EN_UI, k)) return EN_UI[k];
  for (const [re, f] of enPats()) { const m = k.match(re); if (m) { const r = f(m); if (r !== k) return r; } }   // 结果没变（例如通用的「{w} · {lv}」两边都查不到）就继续试后面更具体的规则
  return null;
}
const EN_ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
function enSkip(el) {
  if (!el || el.closest('script,style,textarea,[data-noen]')) return true;
  const lg = el.closest('[lang]');
  const tr = (document.body && document.body.dataset.track) || 'ja';
  return !!(lg && (tr === 'zh' ? /^zh/i : /^ja/i).test(lg.lang));
}
const enUiHits = new WeakMap();   // 每个文字节点最多改 3 次：万一两条规则互相改来改去，也不会卡死页面
function enTextNode(n) {
  const t = n.nodeValue;
  if (!t || !EN_CJK.test(t)) return;
  const k = t.trim();
  // 日语内容里夹着的中文说明（例如语法标题「～に（时间）」）：EN_UI_FORCE 整段对上才换，其余日语内容不动
  if (enSkip(n.parentElement)) {
    const f = typeof EN_UI_FORCE !== 'undefined' && Object.prototype.hasOwnProperty.call(EN_UI_FORCE, k) ? EN_UI_FORCE[k] : null;
    if (f != null && !(typeof document !== 'undefined' && n.parentElement && n.parentElement.closest('[data-noen]'))) n.nodeValue = t.replace(k, f);
    return;
  }
  const en = enLookup(t);
  if (en == null || en === k) return;
  const c = enUiHits.get(n) || 0; if (c >= 3) return; enUiHits.set(n, c + 1);
  n.nodeValue = t.replace(k, en);   // 结果和原文一样时不改（改了会再触发 MutationObserver，循环）
}
function enTranslate(root) {
  if (!root || typeof uiEn !== 'function' || !uiEn()) return;
  if (root.nodeType === 3) return enTextNode(root);
  if (root.nodeType !== 1) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
  for (let n; (n = tw.nextNode());) list.push(n);
  list.forEach(enTextNode);
  [root, ...root.querySelectorAll(EN_ATTRS.map(a => `[${a}]`).join(','))].forEach(el => {
    if (!el.getAttribute || enSkip(el)) return;
    for (const a of EN_ATTRS) { const v = el.getAttribute(a); if (v && EN_CJK.test(v)) { const en = enLookup(v); if (en != null && en !== v) el.setAttribute(a, en); } }
  });
}
let enObs = null;
function enUiStart() {
  if (typeof uiEn !== 'function' || !uiEn() || typeof MutationObserver === 'undefined' || !document.body) { if (enObs && !(typeof uiEn === 'function' && uiEn())) { enObs.disconnect(); enObs = null; } return; }
  enTranslate(document.body);
  const tt = enLookup(document.title); if (tt != null) document.title = tt;
  if (enObs) return;
  enObs = new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') enTextNode(m.target);
      else if (m.type === 'attributes') { const el = m.target, v = el.getAttribute(m.attributeName); if (v && EN_CJK.test(v) && !enSkip(el)) { const en = enLookup(v); if (en != null && en !== v) el.setAttribute(m.attributeName, en); } }
      else m.addedNodes.forEach(enTranslate);
    }
  });
  enObs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: EN_ATTRS });
}
