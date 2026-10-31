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
  const add = (jp, zh, L, src, furi, ref) => { if (!jp || !zh || seen.has(jp)) return; seen.add(jp); out.push({ jp, zh, L, src, furi, ref, n: trSize('ja', jp) }); };
  for (const L of LEVELS) {
    for (const g of GRAM[L]) for (const e of g.eg) add(e.full, e.t, L, `语法「${g.p}」`, e.furi, { g });
    if (typeof EXAMPLES !== 'undefined') for (const v of VOCAB[L]) for (const [jp, , zh, furi] of EXAMPLES[v.w] || []) add(jp, zh, L, `单词「${v.w}」的例句`, furi, { v });
  }
  if (typeof readList === 'function') for (const a of readList()) for (const para of a.p) for (const [jp, , zh, , furi] of para) add(jp, zh, a.L, `阅读「${a.title}」`, furi, { a });
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
  const opts = tr === 'ja' ? (S.trOpt = Object.assign({ dir: 'zj', lv: S.level || 'N5', len: '' }, S.trOpt))
    : ((S.trOpt2 = S.trOpt2 || {})[tr] = Object.assign({ dir: 'zj', lv: LV_NAMES[tr][0], len: '' }, S.trOpt2[tr]));
  const o = opts, lvs = tr === 'ja' ? LEVELS : LV_NAMES[tr], LEN = trLen(tr), name = TR_LANG[tr];
  const box = h(`<section class="panel"><h2>翻译练习</h2><div class="skel" aria-label="加载中" role="status"><i></i><i></i><i></i></div></section>`);
  main.append(box);
  (tr === 'ja' ? Promise.resolve(trPool()) : trPoolL2(tr)).then(all => {
    if (!box.isConnected) return;
    const pool = () => all.filter(x => (!o.lv || x.L === o.lv) && LEN[o.len][1](x.n));
    const seg = (k, items) => `<div class="seg" role="group">${items.map(([v, t]) => `<button type="button" data-${k}="${v}" class="${o[k] === v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const st = (S.trStats || {})[tr] || (tr === 'ja' ? S.trStat : null) || { n: 0, ok: 0 };
    const again = S[trKey(tr)] || [];
    const p = h(`<section class="panel"><h2>翻译练习</h2>
      <p class="small muted">先自己翻译（可以写下来，也可以在心里说），再翻开参考答案，按自己的感觉打分。「不会」的句子下次会再出现。</p>
      <div class="row between"><span>方向</span>${seg('dir', [['zj', `中文 → ${name}`], ['jz', `${name} → 中文`]])}</div>
      <div class="row between"><span>级别</span>${seg('lv', [...lvs.map(L => [L, L]), ['', '全部']])}</div>
      <div class="row between"><span>长短</span>${seg('len', Object.entries(LEN).map(([k, [t]]) => [k, t]))}</div>
      <div class="row between"><span class="small muted">可练的句子 <b>${pool().length}</b> 句 · 累计练习 ${st.n} 句，会了 ${st.ok} 句${again.length ? ` · 待重练 ${again.length} 句` : ''}</span>
        <button class="btn pri" type="button" data-start>开始 10 句</button></div>
    </section>`);
    ['dir', 'lv', 'len'].forEach(k => p.querySelectorAll(`[data-${k}]`).forEach(b => { b.onclick = () => { o[k] = b.dataset[k]; save(); render(); }; }));
    p.querySelector('[data-start]').onclick = () => {
      const list = pool();
      if (!list.length) return toast('这个组合没有句子，换个级别或长短试试');
      const ag = new Set(S[trKey(tr)] || []);
      const retry = shuffle(list.filter(x => ag.has(x.jp))).slice(0, 4);
      const fresh = sample(list.filter(x => !ag.has(x.jp)), 10 - retry.length);
      trSession(shuffle([...retry, ...fresh]), o.dir, tr);
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
      <div class="tr-prompt ${!zj && ja ? 'furi' : ''}" ${zj ? '' : `lang="${tr}"`}>${zj ? esc(x.zh) : (ja ? furiHTML(x.jp, x.furi) : esc(x.jp))}${zj ? '' : say(x.jp)}</div>
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
        <div class="tr-ref ${zj && ja ? 'furi' : ''}" ${zj ? `lang="${tr}"` : ''}>${zj && ja ? furiHTML(x.jp, x.furi) : esc(ref)}${zj ? say(x.jp) + shadowBtn(x.jp, '', x.zh, ja ? undefined : tr) : ''}</div>
        ${mine ? `<div class="small">和参考答案的相似度约 <b>${trSimilar(mine, ref)}%</b>（意思对就行，说法不同也可以算会）</div>` : ''}
        <div class="small muted">${reportBtn(x.jp, x.zh)} 出处：${x.ref ? `<button type="button" class="link-btn" data-ref>${esc(x.src)} ›</button>` : esc(x.src)}</div>
        <div class="row tr-grade"><button class="btn" type="button" data-g="0">不会</button><button class="btn" type="button" data-g="1">差不多</button><button class="btn pri" type="button" data-g="2">会了</button></div>`;
      box.querySelector('[data-show]').parentElement.remove();
      const rb = ans.querySelector('[data-ref]');
      if (rb) rb.onclick = e => { e.stopPropagation(); trRefSheet(x, tr); };
      if (zj) { if (ja) speak(x.jp); else speakLang(x.jp, TRACKS[tr].tts); }
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
      <div class="ex-box">${r.g.eg.map(e => `<div class="ex"><div style="flex:1;min-width:0"><div class="jp furi" lang="ja">${furiHTML(e.full, e.furi, e.at, e.at + e.frag.length)}</div><div class="small muted">${esc(e.t)}</div></div>${speakBtn(e.kana)}</div>`).join('')}</div>`;
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
