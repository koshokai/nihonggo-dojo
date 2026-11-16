// 翻译练习：给中文写外语，或者给外语说出中文意思，翻开看参考答案，再自己打分（像 Anki）。日语、韩语、英语共用。
// 句子全部来自站内已有内容：日语用单词例句（lang/ja-ex-N*.json）、语法例句、阅读文章；韩语、英语用分级词库例句、语法例句、阅读文章。
// 「不会」的句子记在 S.trAgain（韩语、英语分别是 S.trAgainKo / S.trAgainEn），下次练习时优先出现。
let TR_POOL = null;
const TR_POOLS = {};
const TR_LANG = { ja: '日语', ko: '韩语', en: '英语' };
// 长短：日语、韩语按字数，英语按单词数
const trLen = tr => tr === 'en'
  ? { s: ['短句', n => n <= 6], m: ['中等', n => n > 6 && n <= 14], l: ['长句', n => n > 14], '': ['不限', () => true] }
  : { s: ['短句', n => n <= 12], m: ['中等', n => n > 12 && n <= 25], l: ['长句', n => n > 25], '': ['不限', () => true] };
const trSize = (tr, s) => tr === 'en' ? s.split(/\s+/).filter(Boolean).length : s.replace(/[。、！？「」.,!?\s]/g, '').length;
// 分级词库的级别 → 练习用的三个级别
const TR_SRC_LV = { ko: { A: '初级', B: '中级', C: '高级' }, en: { zk: '基础', gk: '基础', cet4: '四级', cet6: '六级', ky: '六级', ielts: '六级', toefl: '六级', gre: '六级' } };
const trKey = tr => tr === 'ja' ? 'trAgain' : tr === 'ko' ? 'trAgainKo' : 'trAgainEn';

function trPool() {
  if (TR_POOL) return TR_POOL;
  const out = [], seen = new Set();
  // kana：朗读用假名（录音是按假名存的；浏览器朗读时也不会把汉字读错）
  const add = (jp, zh, L, src, furi, ref, kana) => { if (!jp || !zh || seen.has(jp)) return; seen.add(jp); out.push({ jp, zh, L, src, furi, ref, kana, n: trSize('ja', jp) }); };
  for (const L of LEVELS) {
    for (const g of GRAM[L]) for (const e of g.eg) add(e.full, e.t, L, `语法「${g.p}」`, e.furi, { g }, e.kana);
    if (typeof EXAMPLES !== 'undefined') for (const v of VOCAB[L]) for (const [jp, kana, zh, furi] of EXAMPLES[v.w] || []) add(jp, zh, L, `单词「${v.w}」的例句`, furi, { v }, kana);
  }
  if (typeof readList === 'function') for (const a of readList()) for (const para of a.p || []) for (const [jp, kana, zh, , furi] of para) add(jp, zh, a.L, `阅读「${a.title}」`, furi, { a }, kana);
  return (TR_POOL = out);
}
// 韩语、英语：异步加载语法、阅读和分级例句
function trPoolL2(tr) {
  if (TR_POOLS[tr]) return Promise.resolve(TR_POOLS[tr]);
  const out = [], seen = new Set();
  const add = (s, zh, L, src, ref) => { if (!s || !zh || seen.has(s)) return; seen.add(s); out.push({ jp: s, zh, L, src, ref, n: trSize(tr, s) }); };
  return Promise.all([l2Fetch(tr, 'grammar').catch(() => []), l2Fetch(tr, 'reading').catch(() => []),
    ...Object.keys(TR_SRC_LV[tr]).map(k => lvFetch(`${tr}-ex-${k}`).then(d => [k, d]).catch(() => [k, {}]))]).then(([gram, reads, ...exs]) => {
    gram.forEach(g => g.eg.forEach(([s, zh]) => add(s, zh, g.lv, `语法「${g.p}」`, { g2: g })));
    reads.forEach(a => a.p.forEach(para => para.forEach(([s, zh]) => add(s, zh, a.lv, `阅读「${a.title}」`, { a2: a }))));
    exs.forEach(([k, d]) => Object.entries(d).forEach(([w, list]) => list.forEach(([s, zh]) => add(s, zh, TR_SRC_LV[tr][k], `单词「${w}」的例句`, { w2: w, ex: list }))));
    return (TR_POOLS[tr] = out);
  });
}

function viewTrans(tr = 'ja') {
  if (tr === 'ja') audioIdx('reading');
  const opts = tr === 'ja' ? (S.trOpt = Object.assign({ dir: 'zj', lv: S.level || 'N5', len: '', mode: 'order' }, S.trOpt))
    : ((S.trOpt2 = S.trOpt2 || {})[tr] = Object.assign({ dir: 'zj', lv: LV_NAMES[tr][0], len: '' }, S.trOpt2[tr]));
  const o = opts, lvs = tr === 'ja' ? LEVELS : LV_NAMES[tr], LEN = trLen(tr), name = TR_LANG[tr], ja = tr === 'ja';
  const box = h(`<section class="panel"><h2>翻译练习</h2><div class="skel" aria-label="加载中" role="status"><i></i><i></i><i></i></div></section>`);
  main.append(box);
  (tr === 'ja' ? Promise.resolve(trPool()) : trPoolL2(tr)).then(all => {
    if (!box.isConnected) return;
    const pool = () => all.filter(x => (!o.lv || x.L === o.lv) && LEN[o.len][1](x.n));
    const seg = (k, items) => `<div class="seg" role="group">${items.map(([v, t]) => `<button type="button" data-${k}="${v}" class="${o[k] === v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const st = (S.trStats || {})[tr] || (tr === 'ja' ? S.trStat : null) || { n: 0, ok: 0 };
    const again = S[trKey(tr)] || [];
    const p = h(`<section class="panel"><h2>翻译练习</h2>
      <p class="small muted">${ja && o.mode === 'order' ? '把打乱的词块按正确顺序排好（里面混着 2 块多余的），对完答案有解说。排错的句子下次会再出现。' : '先自己翻译（可以写下来，也可以在心里说），再翻开参考答案，按自己的感觉打分。「不会」的句子下次会再出现。'}</p>
      ${ja && trSegOK ? `<div class="row between"><span>作答方式</span>${seg('mode', [['order', '排序'], ['write', '直接作答']])}</div>` : ''}
      <div class="row between"><span>方向</span>${seg('dir', [['zj', `中文 → ${name}`], ['jz', `${name} → 中文`]])}</div>
      <div class="row between"><span>级别</span>${seg('lv', [...lvs.map(L => [L, L]), ['', '全部']])}</div>
      <div class="row between"><span>长短</span>${seg('len', Object.entries(LEN).map(([k, [t]]) => [k, t]))}</div>
      <div class="row between"><span class="small muted">累计练习 ${st.n} 句，会了 ${st.ok} 句${again.length ? ` · 待重练 ${again.length} 句` : ''}</span>
        <button class="btn pri" type="button" data-start>开始 10 句</button></div>
    </section>`);
    ['dir', 'lv', 'len', 'mode'].forEach(k => p.querySelectorAll(`[data-${k}]`).forEach(b => { b.onclick = () => { o[k] = b.dataset[k]; save(); render(); }; }));
    p.querySelector('[data-start]').onclick = () => {
      const order = ja && trSegOK && o.mode === 'order';
      // 排序模式：只出能切成 3–9 块的句子
      const list = pool().filter(x => !order || trCanOrder(x, o.dir));
      if (!list.length) return toast('这个组合没有句子，换个级别或长短试试');
      const ag = new Set(S[trKey(tr)] || []);
      const retry = shuffle(list.filter(x => ag.has(x.jp))).slice(0, 4);
      const fresh = sample(list.filter(x => !ag.has(x.jp)), 10 - retry.length);
      const items = shuffle([...retry, ...fresh]);
      if (order) trOrderSession(items, o.dir, list); else trSession(items, o.dir, tr);
    };
    box.replaceWith(p);
  });
}

// 两段文字有多像：按相邻两个字（bigram）的重合程度粗略打分，只作参考
function trSimilar(a, b) {
  const norm = s => s.toLowerCase().replace(/[。、，．,.!！?？「」『』'"\s]/g, '');
  const bg = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 100;
  const A = bg(x), B = bg(y);
  let hit = 0; A.forEach((n, k) => { hit += Math.min(n, B.get(k) || 0); });
  return Math.round(200 * hit / Math.max(1, x.length - 1 + y.length - 1));
}

function trSession(items, dir, tr = 'ja') {
  main.innerHTML = '';
  let i = 0, ok = 0;
  const name = TR_LANG[tr], ja = tr === 'ja';
  const say = s => ja ? speakBtn(s) : sayBtn(s, TRACKS[tr].tts);
  const box = h('<section class="panel tr-card"></section>');
  main.append(box);
  const done = () => {
    box.innerHTML = `<h2>练完了</h2><p>${items.length} 句里会了 ${ok} 句。</p><div class="row"><button class="btn pri" type="button" data-more>再来 10 句</button><a class="btn" href="#${ja ? 'study' : tr + '/study'}">回到学习</a></div>`;
    box.querySelector('[data-more]').onclick = () => { main.innerHTML = ''; viewTrans(tr); const t = setInterval(() => { const b = main.querySelector('[data-start]'); if (b) { clearInterval(t); b.click(); } }, 50); };
    addXP(ok * 3 + (items.length - ok));
  };
  const show = () => {
    if (i >= items.length) return done();
    const x = items[i], zj = dir === 'zj';
    box.innerHTML = `<div class="row between small muted"><span>${i + 1} / ${items.length}</span><span><span class="tag lv">${esc(x.L)}</span> ${zj ? `中文 → ${name}` : `${name} → 中文`}</span></div>
      <div class="tr-prompt ${!zj && ja ? 'furi' : ''}" ${zj ? '' : `lang="${tr}"`}>${zj ? esc(x.zh) : (ja ? furiHTML(x.jp, x.furi) : esc(x.jp))}${zj ? '' : say(ja ? x.kana || x.jp : x.jp)}</div>
      <textarea class="tr-input" rows="2" ${zj ? `lang="${tr}"` : ''} placeholder="${zj ? `写下你的${name}（可以不写）` : '写下中文意思（可以不写）'}"></textarea>
      <div class="row"><button class="btn pri" type="button" data-show>看参考答案</button></div>
      <div class="tr-ans" hidden></div>`;
    const ta = box.querySelector('textarea');
    setTimeout(() => ta.focus(), 50);
    box.querySelector('[data-show]').onclick = () => {
      const ref = zj ? x.jp : x.zh, mine = ta.value.trim();
      const ans = box.querySelector('.tr-ans');
      ans.hidden = false;
      ans.innerHTML = `<div class="small muted">参考答案</div>
        <div class="tr-ref ${zj && ja ? 'furi jtap' : ''}" ${zj ? `lang="${tr}"` : ''}>${zj && ja ? jaTapHTML(x.jp, x.furi) : esc(ref)}${zj ? say(ja ? x.kana || x.jp : x.jp) + shadowBtn(x.jp, ja ? x.kana || '' : '', x.zh, ja ? undefined : tr) : ''}</div>
        ${mine ? `<div class="small">和参考答案的相似度约 <b>${trSimilar(mine, ref)}%</b>（意思对就行，说法不同也可以算会）</div>` : ''}
        <div class="small muted">${reportBtn(x.jp, x.zh)} 出处：${x.ref ? `<button type="button" class="link-btn" data-ref>${esc(x.src)} ›</button>` : esc(x.src)}</div>
        <div class="row tr-grade"><button class="btn" type="button" data-g="0">不会</button><button class="btn" type="button" data-g="1">差一点</button><button class="btn pri" type="button" data-g="2">会了</button></div>`;
      box.querySelector('[data-show]').parentElement.remove();
      const rb = ans.querySelector('[data-ref]');
      if (rb) rb.onclick = e => { e.stopPropagation(); trRefSheet(x, tr); };
      if (zj) { if (ja) speak(x.kana || x.jp); else speakLang(x.jp, TRACKS[tr].tts); }
      ans.querySelectorAll('[data-g]').forEach(b => {
        b.onclick = () => {
          const g = +b.dataset.g, again = new Set(S[trKey(tr)] || []);
          if (g === 0) again.add(x.jp); else if (g === 2) again.delete(x.jp);
          S[trKey(tr)] = [...again].slice(-300);
          const stats = (S.trStats = S.trStats || {});
          const st = stats[tr] = stats[tr] || (ja && S.trStat ? Object.assign({}, S.trStat) : { n: 0, ok: 0 });
          st.n++; if (g === 2) { st.ok++; ok++; }
          save(); i++; show();
        };
      });
    };
  };
  show();
}

// 出处卡片：在练习上面弹出语法点 / 单词 / 文章的说明，关掉就回到原来那一题，不离开练习
function trRefSheet(x, tr) {
  closeSheet();
  const r = x.ref, ja = tr === 'ja', say = t => ja ? speakBtn(t) : sayBtn(t, TRACKS[tr].tts);
  let body = '';
  if (r.g) {   // 日语语法
    body = `<div class="eyebrow">${esc(r.g.L)} 语法</div><b class="ws-word" lang="ja">${esc(r.g.p)}</b><div>${esc(r.g.m)}</div>
      ${r.g.how ? `<p class="small">${esc(r.g.how)}</p>` : ''}
      <div class="ex-box">${r.g.eg.map(e => `<div class="ex"><div style="flex:1;min-width:0"><div class="jp furi jtap" lang="ja">${jaTapHTML(e.full, e.furi, e.at, e.at + e.frag.length)}</div><div class="small muted">${esc(e.t)}</div></div>${speakBtn(e.kana)}</div>`).join('')}</div>`;
  } else if (r.g2) {   // 韩语、英语语法
    body = `<div class="eyebrow">${esc(r.g2.lv)} 语法</div><b class="ws-word" lang="${tr}">${esc(r.g2.p)}</b><div>${esc(r.g2.m)}</div>
      ${r.g2.use ? `<p class="small">${esc(r.g2.use)}</p>` : ''}
      <div class="ex-box">${r.g2.eg.map(([t, zh]) => `<div class="ex"><div style="flex:1;min-width:0"><div lang="${tr}">${esc(t)}</div><div class="small muted">${esc(zh)}</div></div>${say(t)}</div>`).join('')}</div>`;
  } else if (r.v) {   // 日语单词
    body = `<div class="eyebrow">${esc(r.v.L)} 单词</div><div class="row"><b class="ws-word" lang="ja">${esc(r.v.w)}</b>${speakBtn(r.v.r)}</div><div lang="ja" class="muted">${esc(r.v.r)}</div><div>${esc(r.v.m)}</div>
      <div class="ex-box">${exHTML(r.v.w, 3)}</div>`;
  } else if (r.w2) {   // 韩语、英语单词
    body = `<div class="eyebrow">单词</div><div class="row"><b class="ws-word" lang="${tr}">${esc(r.w2)}</b>${say(r.w2)}</div>
      <div class="ex-box">${r.ex.slice(0, 3).map(([t, zh]) => `<div class="ex"><div style="flex:1;min-width:0"><div lang="${tr}">${esc(t)}</div><div class="small muted">${esc(zh)}</div></div>${say(t)}</div>`).join('')}</div>`;
  } else if (r.a || r.a2) {   // 阅读文章
    const a = r.a || r.a2, href = ja ? `#read/${a.id}` : `#${tr}/read/${a.id}`;
    body = `<div class="eyebrow">阅读文章</div><b class="ws-word" lang="${tr}">${esc(a.title)}</b><div class="muted">${esc(a.zh)}</div>
      <p class="small">这句话出自这篇文章。想读全文的话，练完这一组再去阅读里打开它。</p><a class="btn small" href="${href}">现在去读全文（会离开练习）</a>`;
  }
  const sh = h(`<div class="word-sheet tr-ref-sheet" role="dialog" aria-label="出处"><button class="ws-x" type="button" aria-label="关闭">×</button>${body}
    <div class="row"><button class="btn pri" type="button" data-back>看完了，回到练习</button></div></div>`);
  document.body.append(sh);
  sh.querySelector('.ws-x').onclick = closeSheet;
  sh.querySelector('[data-back]').onclick = closeSheet;
}


/* ---------- 排序作答：把正确译文切成词块打乱（混进 2 块干扰），点词块排好顺序，对答案后看解说 ---------- */
// 切块用浏览器自带的分词（Intl.Segmenter）。日语把助词、词尾等平假名片段并到前一个词上，组成「私は」「飲みます」这样的文节。
const trSegOK = typeof Intl !== 'undefined' && !!Intl.Segmenter;
const TR_JA_START = new Set(['この', 'その', 'あの', 'どの', 'ここ', 'そこ', 'あそこ', 'どこ', 'これ', 'それ', 'あれ', 'どれ', 'とても', 'もう', 'まだ', 'よく', 'ちょっと', 'いつも', 'すごく', 'もっと', 'ずっと', 'たくさん', 'すこし', 'あまり', 'ぜんぜん', 'きっと', 'たぶん', 'いつ', 'だれ', 'なに', 'なぜ', 'どう', 'どうして', 'わたし', 'あなた', 'みんな', 'いっしょに', 'ゆっくり', 'しっかり', 'やっぱり', 'ほんとうに', 'でも', 'だから', 'しかし', 'そして', 'それから', 'ところで', 'ただ', 'まず', 'また', 'まあ', 'ええ', 'はい', 'いいえ', 'ありがとう', 'すみません', 'おはよう', 'こんにちは']);
const TR_ZH_TAIL = new Set(['的', '了', '着', '过', '吗', '呢', '吧', '啊', '呀', '得', '地', '们']);
const isHira = t => /^[ぁ-ゟー]+$/.test(t);
const isPunct = t => /^[\s、。，．,.!！?？「」『』（）()：:；;…・\-—~～]+$/.test(t);
const TR_TILES = new Map();
function trTiles(text, lang) {
  const key = lang + text;
  if (TR_TILES.has(key)) return TR_TILES.get(key);
  const segs = [...new Intl.Segmenter(lang === 'ja' ? 'ja' : 'zh', { granularity: 'word' }).segment(text)].map(x => x.segment).filter(t => t.trim());
  const out = [];
  for (const t of segs) {
    const last = out.length - 1;
    const glue = last >= 0 && (isPunct(t) || (lang === 'ja' ? isHira(t) && !TR_JA_START.has(t) && !/[、。]$/.test(out[last]) : TR_ZH_TAIL.has(t)));
    if (glue) out[last] += t; else out.push(t);
  }
  // 太碎的话把最短的相邻两块并起来，最多 9 块
  while (out.length > 9) {
    let k = 0, best = Infinity;
    for (let i = 0; i < out.length - 1; i++) { const n = out[i].length + out[i + 1].length; if (n < best) { best = n; k = i; } }
    out.splice(k, 2, out[k] + out[k + 1]);
  }
  TR_TILES.set(key, out);
  return out;
}
const trTarget = (x, dir) => dir === 'zj' ? [x.jp, 'ja'] : [x.zh, 'zh'];
function trCanOrder(x, dir) {
  if (!trSegOK) return false;
  const [t, lang] = trTarget(x, dir), n = trTiles(t, lang).length;
  return n >= 3 && n <= 9 && new Set(trTiles(t, lang)).size === n;   // 有重复的块（同一个词出现两次）答案会不唯一，不出
}
// 单词表：词块里能查到的词（从长到短找前缀）
let TR_WORDS = null;
function trWordIn(chunk) {
  if (!TR_WORDS) { TR_WORDS = new Map(); for (const L of LEVELS) for (const v of VOCAB[L]) { if (!TR_WORDS.has(v.w)) TR_WORDS.set(v.w, v); } }
  const c = chunk.replace(/[、。！？「」]/g, '');
  for (let n = Math.min(6, c.length); n >= 1; n--) {
    const head = c.slice(0, n), v = TR_WORDS.get(head);
    if (v && (n > 1 || /[一-鿿]/.test(head))) return v;
  }
  // 动词活用：漢字 + 送り仮名的一部分（飲み → 飲む）
  const m = c.match(/^([一-鿿]+)([ぁ-ゟ]?)/);
  if (m) for (const end of ['る', 'む', 'く', 'す', 'う', 'つ', 'ぶ', 'ぐ', 'ぬ', 'い']) { const v = TR_WORDS.get(m[1] + end); if (v) return v; }
  return null;
}
// 日语句子的结构解说：动词（谓语）在句末、助词标出成分
function trJaPoints(tiles) {
  const pts = [];
  const pick = (re, txt) => { const t = tiles.find(x => re.test(x.replace(/[、。]$/, ''))); if (t) pts.push(txt(t)); };
  pick(/は$/, t => `「${t}」：は 标出话题（这句话在说什么），一般放在句子前面。`);
  pick(/が$/, t => `「${t}」：が 标出主语，或者「有、喜欢、会」这类说法的对象。`);
  pick(/を$/, t => `「${t}」：を 标出动作的对象（宾语），放在动词前面。`);
  pick(/(に|へ)$/, t => `「${t}」：に／へ 表示时间、地点、方向或对象。`);
  pick(/で$/, t => `「${t}」：で 表示动作发生的地点或手段。`);
  pick(/(から|まで)$/, t => `「${t}」：から／まで 表示起点和终点。`);
  const last = tiles[tiles.length - 1];
  pts.push(`「${last}」：日语的谓语（动词、形容词、です）放在句末，这一点和中文最不一样。`);
  return pts;
}
function trOrderSession(items, dir, all) {
  main.innerHTML = '';
  focusMode(true);
  let i = 0, ok = 0;
  const box = h('<section class="panel tr-card tr-order"></section>');
  main.append(box);
  const zj = dir === 'zj';
  const finish = () => {
    focusMode(false);
    box.innerHTML = `<div class="welcome-hi">${neko(ok >= items.length * .8 ? 'cheer' : ok >= items.length / 2 ? 'happy' : 'think', 'big')}<div class="bubble"><b>${items.length} 句排对了 ${ok} 句</b><span>${ok === items.length ? '全对！语序已经很有感觉了。' : ok >= items.length / 2 ? '不错！排错的句子下次会再出现。' : '日语的语序和中文不一样，多排几次就习惯了，别气馁。'}</span></div></div>
      <div class="row"><button class="btn pri" type="button" data-more>再来 10 句</button><a class="btn" href="#study">回到学习</a></div>`;
    box.querySelector('[data-more]').onclick = () => { main.innerHTML = ''; viewTrans('ja'); const t = setInterval(() => { const b = main.querySelector('[data-start]'); if (b) { clearInterval(t); b.click(); } }, 50); };
    addXP(ok * 4 + (items.length - ok));
  };
  const show = () => {
    if (i >= items.length) return finish();
    const x = items[i], [target, lang] = trTarget(x, dir), right = trTiles(target, lang);
    // 干扰块：同级别别的句子里的块
    const others = sample(all.filter(y => y !== x), 6).flatMap(y => trTiles(trTarget(y, dir)[0], lang)).filter(t => !right.includes(t) && t.length <= 8);
    const bank = shuffle([...right.map((t, k) => ({ t, k })), ...sample(others, 2).map(t => ({ t, k: -1 }))]);
    let picked = [];
    const L = lang === 'ja' ? 'ja' : 'zh-CN';
    box.innerHTML = `<div class="row between small muted"><span>${i + 1} / ${items.length}</span><span><span class="tag lv">${esc(x.L)}</span> ${zj ? '中文 → 日语' : '日语 → 中文'} · 排序</span>
        <button class="btn ghost" type="button" data-exit>结束</button></div>
      <div class="tr-prompt ${zj ? '' : 'furi'}" ${zj ? '' : 'lang="ja"'}>${zj ? esc(x.zh) : furiHTML(x.jp, x.furi)}${zj ? '' : speakBtn(x.kana || x.jp)}</div>
      <div class="tr-slot" data-slot aria-label="你的答案"><span class="small muted tr-slot-hint">点下面的词块，按顺序排好</span></div>
      <div class="tr-bank" data-bank>${bank.map((b, n) => `<button type="button" class="tr-tile" data-n="${n}" lang="${L}">${esc(b.t)}</button>`).join('')}</div>
      <div class="row"><button class="btn pri" type="button" data-check disabled>对答案</button><button class="btn ghost" type="button" data-skip>不会，看答案</button></div>
      <div data-res></div>`;
    const slot = box.querySelector('[data-slot]'), bankEl = box.querySelector('[data-bank]'), check = box.querySelector('[data-check]');
    box.querySelector('[data-exit]').onclick = async () => { if (i && !await askConfirm('结束这一组吗？已经排对的句子会算经验。', '结束', '继续')) return; finish(); };
    const paint = () => {
      slot.innerHTML = picked.length ? picked.map((n, j) => `<button type="button" class="tr-tile in" data-j="${j}" lang="${L}">${esc(bank[n].t)}</button>`).join('') : '<span class="small muted tr-slot-hint">点下面的词块，按顺序排好</span>';
      bankEl.querySelectorAll('[data-n]').forEach(b => { b.classList.toggle('used', picked.includes(+b.dataset.n)); b.disabled = picked.includes(+b.dataset.n); });
      slot.querySelectorAll('[data-j]').forEach(b => { b.onclick = () => { picked.splice(+b.dataset.j, 1); paint(); }; });
      check.disabled = !picked.length;
    };
    bankEl.querySelectorAll('[data-n]').forEach(b => { b.onclick = () => { picked.push(+b.dataset.n); buzz(8); paint(); }; });
    const judge = skipped => {
      const mine = picked.map(n => bank[n].t).join(''), good = !skipped && mine === right.join('');
      const again = new Set(S.trAgain || []);
      if (good) { again.delete(x.jp); ok++; } else again.add(x.jp);
      S.trAgain = [...again].slice(-300);
      const st = ((S.trStats = S.trStats || {}).ja = S.trStats.ja || (S.trStat ? Object.assign({}, S.trStat) : { n: 0, ok: 0 }));
      st.n++; if (good) st.ok++;
      save(); buzz(good ? 12 : [30, 50, 30]);
      // 排错的位置标红
      slot.querySelectorAll('[data-j]').forEach((b, j) => { b.disabled = true; b.classList.add(bank[picked[j]].t === right[j] ? 'right' : 'wrong'); });
      bankEl.querySelectorAll('[data-n]').forEach(b => { b.disabled = true; });
      box.querySelector('[data-check]').parentElement.remove();
      const ref = x.ref || {};
      const point = ref.g ? `<div class="tr-point"><b>语法「<span lang="ja">${esc(ref.g.p)}</span>」</b>：${esc(ref.g.m)}${ref.g.how ? `<div class="small muted">接续：${esc(ref.g.how)}</div>` : ''}</div>`
        : ref.v ? `<div class="tr-point"><b>单词「<span lang="ja">${esc(ref.v.w)}</span>」</b>（<span lang="ja">${esc(ref.v.r)}</span>）：${esc(ref.v.m)}</div>` : '';
      const jaTiles = trTiles(x.jp, 'ja');
      const gloss = jaTiles.map(t => { const v = trWordIn(t); return v ? `<li><b lang="ja">${esc(t)}</b> <span class="muted" lang="ja">${esc(v.w)}（${esc(v.r)}）</span> ${esc(v.m.split(/[；;]/)[0])}</li>` : ''; }).join('');
      box.querySelector('[data-res]').innerHTML = `<div class="feedback ${good ? 'ok' : 'no'}">${neko(good ? 'happy' : 'sad', 'mini')}<div class="fb-t"><b>${good ? '排对了！' : skipped ? '没关系，看看正确的顺序' : '顺序不太对'}</b></div></div>
        <div class="small muted">正确顺序</div>
        <div class="tr-right">${right.map(t => `<span class="tr-tile ok" lang="${L}">${esc(t)}</span>`).join('')}</div>
        <div class="tr-ref furi jtap" lang="ja">${jaTapHTML(x.jp, x.furi)}${speakBtn(x.kana || x.jp)}${shadowBtn(x.jp, x.kana || '', x.zh)}</div><div class="small muted">${esc(x.zh)}</div>
        <details class="tr-explain" open><summary>解说</summary>
          ${point}
          <ul class="tr-pts small">${trJaPoints(jaTiles).map(p => `<li lang="zh-CN">${esc(p)}</li>`).join('')}</ul>
          ${gloss ? `<div class="small muted">句子里的词</div><ul class="tr-gloss small">${gloss}</ul>` : ''}
          <div class="small muted">出处：${x.ref ? `<button type="button" class="link-btn" data-ref>${esc(x.src)} ›</button>` : esc(x.src)} ${reportBtn(x.jp, x.zh)}</div>
        </details>
        <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-next>${i + 1 < items.length ? '下一句' : '看结果'}</button></div>`;
      const rb = box.querySelector('[data-ref]'); if (rb) rb.onclick = e => { e.stopPropagation(); trRefSheet(x, 'ja'); };
      speak(x.kana || x.jp);
      box.querySelector('[data-next]').onclick = () => { i++; show(); };
      box.querySelector('[data-next]').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    check.onclick = () => judge(false);
    box.querySelector('[data-skip]').onclick = () => judge(true);
  };
  show();
}
