'use strict';
/* 日语道场 — 词典。依赖 app.js 的全局函数，在 app.js 之前加载，只定义函数。
   数据：本站 JLPT 词表（中文释义）+ JMdict 常用词（dict.json，英文释义，CC BY-SA 4.0）+ 本站全部例句。 */

let JMDICT = null, jmLoading = null, dictQuery = '', dictDir = null;
function loadJmdict() {
  if (JMDICT) return Promise.resolve(JMDICT);
  if (!jmLoading) {
    jmLoading = fetch('dict.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => { JMDICT = d.map(([k, r, s, p]) => ({ k, r, rh: r.map(toHira), s, p })); return JMDICT; })
      .catch(e => { jmLoading = null; throw e; });
  }
  return jmLoading;
}

/* 罗马字 → 平假名（简易版，够查词用） */
const ROMA = { a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お', ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ', ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と', na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の', ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ', ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も', ya: 'や', yu: 'ゆ', yo: 'よ', ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ', wa: 'わ', wo: 'を', ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご', za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ', da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど', ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ', pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ', fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ', ja: 'じゃ', ju: 'じゅ', jo: 'じょ', je: 'じぇ', sha: 'しゃ', shu: 'しゅ', sho: 'しょ', cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', che: 'ちぇ', '-': 'ー' };
['k', 'g', 's', 'z', 't', 'd', 'n', 'h', 'b', 'p', 'm', 'r'].forEach(c => {
  const base = ROMA[c + 'i']; if (!base) return;
  ROMA[c + 'ya'] = base + 'ゃ'; ROMA[c + 'yu'] = base + 'ゅ'; ROMA[c + 'yo'] = base + 'ょ';
});
ROMA.jya = 'じゃ'; ROMA.jyu = 'じゅ'; ROMA.jyo = 'じょ'; ROMA.sya = 'しゃ'; ROMA.syu = 'しゅ'; ROMA.syo = 'しょ'; ROMA.tya = 'ちゃ'; ROMA.tyu = 'ちゅ'; ROMA.tyo = 'ちょ';
function romaToHira(s) {
  s = s.toLowerCase();
  let out = '', i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === 'n' && (s[i + 1] === 'n' || (s[i + 1] && !'aiueoy'.includes(s[i + 1])) || i === s.length - 1)) { out += 'ん'; i += s[i + 1] === 'n' ? 2 : 1; continue; }
    if (c === s[i + 1] && /[bcdfghjkmprstvwz]/.test(c)) { out += 'っ'; i++; continue; }
    let hit = false;
    for (const len of [3, 2, 1]) { const part = s.slice(i, i + len); if (ROMA[part]) { out += ROMA[part]; i += len; hit = true; break; } }
    if (!hit) { out += c; i++; }
  }
  return out;
}
const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const hasCJK = s => /[一-鿿]/.test(s);
const hasKana = s => /[぀-ヿ]/.test(s);
const isLatin = s => /^[a-z\s'\-]+$/i.test(s);

/* 全站例句库：单词例句 + 语法例句 */
let CORPUS = null;
function corpus() {
  if (!CORPUS) {
    CORPUS = [];
    if (typeof EXAMPLES !== 'undefined') for (const w in EXAMPLES) for (const [jp, kana, zh] of EXAMPLES[w]) CORPUS.push({ jp, kana, zh });
    for (const L of LEVELS) for (const g of GRAM[L]) for (const e of g.eg) CORPUS.push({ jp: e.full, kana: e.kana, zh: e.t });
  }
  return CORPUS;
}
function sentencesWith(q, n = 5) {
  return corpus().filter(x => x.jp.includes(q)).sort((a, b) => a.jp.length - b.jp.length).slice(0, n);
}
const sentenceHTML = (x, mark) => `<div class="ex"><div style="flex:1;min-width:0"><div class="jp" lang="ja">${mark ? esc(x.jp).split(esc(mark)).join(`<mark>${esc(mark)}</mark>`) : esc(x.jp)}</div><div class="small muted">${esc(x.zh)}</div></div>${speakBtn(x.kana, '朗读例句')}</div>`;

/* 搜索 */
function searchAll(raw) {
  const q = raw.trim();
  if (!q) return { vocab: [], jm: [], sentences: [] };
  const latin = isLatin(q);
  const hq = latin ? romaToHira(q.replace(/\s+/g, '')) : toHira(q);
  const ql = q.toLowerCase();
  const enRe = latin ? new RegExp(`(^|[^a-z])${ql.replace(/[^a-z\s'\-]/g, '')}`, 'i') : null;
  const score = (forms, reads) => {
    if (forms.includes(q) || reads.includes(hq)) return 0;
    if (forms.some(f => f.startsWith(q)) || reads.some(r => r.startsWith(hq))) return 1;
    if (q.length > 1 && (forms.some(f => f.includes(q)) || (hasKana(q) || latin) && reads.some(r => r.includes(hq)))) return 2;
    return 9;
  };
  // JLPT 词表（有中文）
  const vocab = [];
  for (const v of allVocab()) {
    let s = score([v.w, ...v.alt], [toHira(v.r)]);
    if (s === 9 && hasCJK(q) && !hasKana(q) && v.m.includes(q)) s = 3;          // 中文查日文
    if (s === 9 && latin && enRe.test(v.en)) s = 4;
    if (s < 9) vocab.push([s, v]);
  }
  vocab.sort((a, b) => a[0] - b[0] || a[1].w.length - b[1].w.length);
  // JMdict（英文）
  const jm = [];
  if (JMDICT) {
    const seen = new Set(vocab.map(([, v]) => v.w + '|' + toHira(v.r)));
    for (const e of JMDICT) {
      let s = score(e.k, e.rh);
      if (s === 9 && latin && e.s.some(g => g.some(x => enRe.test(x)))) s = 4;
      if (s < 9 && !seen.has((e.k[0] || e.r[0]) + '|' + e.rh[0])) jm.push([s, e]);
    }
    jm.sort((a, b) => a[0] - b[0] || (a[1].k[0] || a[1].r[0]).length - (b[1].k[0] || b[1].r[0]).length);
  }
  // 中文查例句：译文里含有这个中文的句子
  const sentences = hasCJK(q) && !hasKana(q) ? corpus().filter(x => x.zh.includes(q)).slice(0, 6) : [];
  return { vocab: vocab.slice(0, 20).map(x => x[1]), jm: jm.slice(0, 20).map(x => x[1]), sentences, hq };
}

/* 句子：按词典最长匹配切分，方便逐词查 */
function segment(text) {
  const forms = new Set();
  for (const v of allVocab()) { if (v.q) forms.add(v.w); }
  if (JMDICT) for (const e of JMDICT) { e.k.forEach(k => forms.add(k)); }
  const out = [];
  let i = 0;
  while (i < text.length) {
    let hit = '';
    for (let len = Math.min(8, text.length - i); len >= 2; len--) { const part = text.slice(i, i + len); if (forms.has(part)) { hit = part; break; } }
    if (hit && hasCJK(hit)) { out.push(hit); i += hit.length; } else i++;
  }
  return [...new Set(out)];
}

function viewDict() {
  const p = h(`<section class="panel">
    <h2>词典</h2>
    <form class="dict-form" data-form role="search">
      <input type="search" id="dict-q" placeholder="输入日语、假名、罗马字、中文或英文" value="${esc(dictQuery)}" aria-label="查词" autocomplete="off">
      <button class="btn pri" type="submit">查</button>
    </form>
    <div class="row small"><span class="muted">试试：</span>${['勉強', 'たべる', 'arigatou', '学习', '迷惑', 'study'].map(w => `<button type="button" class="chip-btn" data-try="${w}">${w}</button>`).join('')}</div>
    <p class="small muted" data-status></p>
  </section>`);
  const res = h('<div class="dict-res"></div>');
  if (typeof readReturn !== 'undefined' && readReturn) {
    const back = h(`<a class="btn pri back-read" href="#read/${esc(readReturn.id)}">← 返回继续阅读《<span lang="ja">${esc(readReturn.title)}</span>》</a>`);
    main.append(back);
  }
  main.append(p, res);
  const input = p.querySelector('#dict-q'), status = p.querySelector('[data-status]');
  const run = () => {
    dictQuery = input.value;
    const q = input.value.trim();
    res.innerHTML = '';
    if (!q) { status.textContent = '收录：JLPT 词表约 8,000 词（中文释义）+ JMdict 常用词约 22,000 条（英文释义）+ 本站全部例句。'; return; }
    const r = searchAll(q);
    const longText = q.length >= 6 && (hasKana(q) || hasCJK(q)) && !r.vocab.length && !r.jm.length;
    const total = r.vocab.length + r.jm.length;
    status.textContent = total ? `找到 ${total} 个结果${!JMDICT ? '（扩展词典加载中……）' : ''}` : (JMDICT ? '没有找到这个词。' : '扩展词典加载中……');
    // 翻译链接：自动判断方向，也可以手动切换
    const enc = encodeURIComponent(q);
    const isJa = hasKana(q) || r.vocab.some(v => v.w === q || v.alt.includes(q)) || r.jm.some(e => e.k.includes(q) || e.r.includes(q));
    const auto = isJa ? 'ja-zh' : isLatin(q) ? 'en-ja' : 'zh-ja';
    const dir = dictDir || auto;
    const DIRS = { 'ja-zh': ['日→中', 'ja', 'zh-CN', 'ja/zh'], 'zh-ja': ['中→日', 'zh-CN', 'ja', 'zh/ja'], 'en-ja': ['英→日', 'en', 'ja', 'en/ja'] };
    const [, sl, tl, dl] = DIRS[dir];
    const tr = h(`<section class="panel trans">
      <div class="row between"><b>翻译</b>${hasKana(q) ? speakBtn(toHira(q)) : r.vocab[0] ? speakBtn(r.vocab[0].r) : r.jm[0] ? speakBtn(r.jm[0].r[0]) : ''}</div>
      <div class="seg" role="group" aria-label="翻译方向">${Object.entries(DIRS).map(([k, [lab]]) => `<button type="button" data-dir="${k}" class="${k === dir ? 'on' : ''}" aria-pressed="${k === dir}">${lab}${k === auto ? '<span class="small muted">（自动）</span>' : ''}</button>`).join('')}</div>
      <div class="row">
        <a class="btn pri" href="https://translate.google.com/?sl=${sl}&tl=${tl}&text=${enc}&op=translate" target="_blank" rel="noopener">Google 翻译</a>
        <a class="btn" href="https://www.deepl.com/translator#${dl}/${enc}" target="_blank" rel="noopener">DeepL 翻译</a>
      </div>
      <p class="small muted">整句翻译会在新标签页打开 Google 或 DeepL。方向不对的话点上面切换。下面是本站词典里的结果。</p>
    </section>`);
    tr.querySelectorAll('[data-dir]').forEach(b => { b.onclick = () => { dictDir = b.dataset.dir === auto ? null : b.dataset.dir; run(); }; });
    res.append(tr);
    if (longText) {
      const segs = segment(q);
      if (segs.length) {
        res.append(h(`<section class="panel"><b>句子里的词</b><p class="small muted">点一个词查看意思和例句。</p><div class="row">${segs.map(w => `<button type="button" class="chip-btn big" data-try="${esc(w)}" lang="ja">${esc(w)}</button>`).join('')}</div></section>`));
      }
    }
    r.vocab.forEach(v => res.append(vocabCard(v)));
    r.jm.forEach(e => res.append(jmCard(e)));
    if (r.sentences.length) res.append(h(`<section class="panel"><b>译文中有「${esc(q)}」的例句</b><div class="ex-box">${r.sentences.map(x => sentenceHTML(x)).join('')}</div></section>`));
    res.querySelectorAll('[data-try]').forEach(b => { b.onclick = () => { input.value = b.dataset.try; run(); scrollTo(0, 0); }; });
  };
  p.querySelector('[data-form]').addEventListener('submit', e => { e.preventDefault(); run(); });
  let t;
  input.addEventListener('input', () => { dictDir = null; clearTimeout(t); t = setTimeout(run, 250); });
  p.querySelectorAll('[data-try]').forEach(b => { b.onclick = () => { input.value = b.dataset.try; run(); }; });
  run();
  loadJmdict().then(() => { if (location.hash === '#dict') run(); }).catch(() => { status.textContent = '扩展词典加载失败，只能查 JLPT 词表。请检查网络后刷新。'; });
  setTimeout(() => input.focus({ preventScroll: true }), 50);
}

function vocabCard(v) {
  const sents = exList(v.w).length ? exList(v.w).map(([jp, kana, zh]) => ({ jp, kana, zh })) : sentencesWith(v.w, 4);
  const inDeck = !!S.srs[v.id];
  const c = h(`<section class="panel dict-card">
    <div class="row between"><div class="row"><span class="dict-w" lang="ja">${esc(v.w)}</span><span class="dict-r" lang="ja">${esc(v.r)}</span>${speakBtn(v.r)}</div><span class="tag learn">${v.L}</span></div>
    <div class="dict-m">${esc(v.m)}</div>
    ${v.en ? `<div class="small muted">英文：${esc(v.en)}</div>` : ''}
    ${v.alt.length ? `<div class="small muted">其他写法：<span lang="ja">${esc(v.alt.join('、'))}</span></div>` : ''}
    ${sents.length ? `<div class="ex-box">${sents.slice(0, 5).map(x => sentenceHTML(x, markStem(v.w))).join('')}</div>` : ''}
    <div class="row"><button class="btn ${inDeck ? '' : 'soft'}" type="button" data-add ${inDeck || !v.q ? 'disabled' : ''}>${inDeck ? '已在单词卡里' : '加入单词卡'}</button></div>
  </section>`);
  const add = c.querySelector('[data-add]');
  add.onclick = () => { S.srs[v.id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; save(); add.textContent = '已加入，今天就会复习'; add.disabled = true; toast(`「${v.w}」已加入单词卡`); };
  return c;
}
const markStem = w => w.length > 1 && /[るうくすつぬむぶぐい]$/.test(w) ? w.slice(0, -1) : w;

function jmCard(e) {
  const w = e.k[0] || e.r[0];
  const sents = sentencesWith(w, 3);
  return h(`<section class="panel dict-card">
    <div class="row between"><div class="row"><span class="dict-w" lang="ja">${esc(w)}</span><span class="dict-r" lang="ja">${esc(e.r.join('・'))}</span>${speakBtn(e.r[0])}</div>${e.p ? `<span class="tag">${esc(e.p)}</span>` : ''}</div>
    <ol class="dict-senses">${e.s.map(g => `<li>${esc(g.join('; '))}</li>`).join('')}</ol>
    ${e.k.length > 1 ? `<div class="small muted">其他写法：<span lang="ja">${esc(e.k.slice(1).join('、'))}</span></div>` : ''}
    ${sents.length ? `<div class="ex-box">${sents.map(x => sentenceHTML(x, w)).join('')}</div>` : ''}
    <div class="row between small"><span class="muted">英文释义来自 JMdict</span><a href="https://translate.google.com/?sl=ja&tl=zh-CN&text=${encodeURIComponent(w)}&op=translate" target="_blank" rel="noopener">看中文翻译 ↗</a></div>
  </section>`);
}
