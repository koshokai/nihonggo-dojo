// 翻译练习：给中文写日语，或者给日语说出中文意思，翻开看参考答案，再自己打分（像 Anki）。
// 句子全部来自站内已有内容：单词例句（examples.js）、语法例句、阅读文章，按 JLPT 级别和长短筛选。
// 「不会」的句子记在 S.trAgain，下次练习时优先出现。
let TR_POOL = null;
const TR_LEN = { s: ['短句', n => n <= 12], m: ['中等', n => n > 12 && n <= 25], l: ['长句', n => n > 25], '': ['不限', () => true] };

function trPool() {
  if (TR_POOL) return TR_POOL;
  const out = [], seen = new Set();
  const add = (jp, zh, L, src) => { if (!jp || !zh || seen.has(jp)) return; seen.add(jp); out.push({ jp, zh, L, src, n: jp.replace(/[。、！？「」\s]/g, '').length }); };
  for (const L of LEVELS) {
    for (const g of GRAM[L]) for (const e of g.eg) add(e.full, e.t, L, `语法「${g.p}」`);
    if (typeof EXAMPLES !== 'undefined') for (const v of VOCAB[L]) for (const [jp, , zh] of EXAMPLES[v.w] || []) add(jp, zh, L, `单词「${v.w}」的例句`);
  }
  if (typeof readList === 'function') for (const a of readList()) for (const para of a.p) for (const [jp, , zh] of para) add(jp, zh, a.L, `阅读「${a.title}」`);
  return (TR_POOL = out);
}

function viewTrans() {
  const o = S.trOpt = Object.assign({ dir: 'zj', lv: S.level || 'N5', len: '' }, S.trOpt);
  const pool = () => trPool().filter(x => (!o.lv || x.L === o.lv) && TR_LEN[o.len][1](x.n));
  const seg = (k, items) => `<div class="seg" role="group">${items.map(([v, t]) => `<button type="button" data-${k}="${v}" class="${o[k] === v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const st = S.trStat || { n: 0, ok: 0 };
  const p = h(`<section class="panel"><h2>翻译练习</h2>
    <p class="small muted">先自己翻译（可以写下来，也可以在心里说），再翻开参考答案，按自己的感觉打分。「不会」的句子下次会再出现。</p>
    <div class="row between"><span>方向</span>${seg('dir', [['zj', '中文 → 日语'], ['jz', '日语 → 中文']])}</div>
    <div class="row between"><span>级别</span>${seg('lv', [...LEVELS.map(L => [L, L]), ['', '全部']])}</div>
    <div class="row between"><span>长短</span>${seg('len', Object.entries(TR_LEN).map(([k, [t]]) => [k, t]))}</div>
    <div class="row between"><span class="small muted">可练的句子 <b>${pool().length}</b> 句 · 累计练习 ${st.n} 句，会了 ${st.ok} 句${(S.trAgain || []).length ? ` · 待重练 ${S.trAgain.length} 句` : ''}</span>
      <button class="btn pri" type="button" data-start>开始 10 句</button></div>
  </section>`);
  ['dir', 'lv', 'len'].forEach(k => p.querySelectorAll(`[data-${k}]`).forEach(b => { b.onclick = () => { o[k] = b.dataset[k]; save(); render(); }; }));
  p.querySelector('[data-start]').onclick = () => {
    const all = pool();
    if (!all.length) return toast('这个组合没有句子，换个级别或长短试试');
    const again = new Set(S.trAgain || []);
    const retry = shuffle(all.filter(x => again.has(x.jp))).slice(0, 4);
    const fresh = sample(all.filter(x => !again.has(x.jp)), 10 - retry.length);
    trSession(shuffle([...retry, ...fresh]), o.dir);
  };
  main.append(p);
}

// 两段文字有多像：按相邻两个字（bigram）的重合程度粗略打分，只作参考
function trSimilar(a, b) {
  const norm = s => s.replace(/[。、，．,.!！?？「」『』\s]/g, '');
  const bg = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 100;
  const A = bg(x), B = bg(y);
  let hit = 0; A.forEach((n, k) => { hit += Math.min(n, B.get(k) || 0); });
  return Math.round(200 * hit / Math.max(1, x.length - 1 + y.length - 1));
}

function trSession(items, dir) {
  main.innerHTML = '';
  let i = 0, ok = 0;
  const box = h('<section class="panel tr-card"></section>');
  main.append(box);
  const done = () => {
    box.innerHTML = `<h2>练完了</h2><p>${items.length} 句里会了 ${ok} 句。</p><div class="row"><button class="btn pri" type="button" data-more>再来 10 句</button><a class="btn" href="#study">回到学习</a></div>`;
    box.querySelector('[data-more]').onclick = () => { main.innerHTML = ''; viewTrans(); main.querySelector('[data-start]').click(); };
    addXP(ok * 3 + (items.length - ok));
  };
  const show = () => {
    if (i >= items.length) return done();
    const x = items[i], zj = dir === 'zj';
    box.innerHTML = `<div class="row between small muted"><span>${i + 1} / ${items.length}</span><span><span class="tag lv">${esc(x.L)}</span> ${zj ? '中文 → 日语' : '日语 → 中文'}</span></div>
      <div class="tr-prompt" ${zj ? '' : 'lang="ja"'}>${esc(zj ? x.zh : x.jp)}${zj ? '' : speakBtn(x.jp)}</div>
      <textarea class="tr-input" rows="2" ${zj ? 'lang="ja"' : ''} placeholder="${zj ? '写下你的日语（可以不写）' : '写下中文意思（可以不写）'}"></textarea>
      <div class="row"><button class="btn pri" type="button" data-show>看参考答案</button></div>
      <div class="tr-ans" hidden></div>`;
    const ta = box.querySelector('textarea');
    setTimeout(() => ta.focus(), 50);
    box.querySelector('[data-show]').onclick = () => {
      const ref = zj ? x.jp : x.zh, mine = ta.value.trim();
      const ans = box.querySelector('.tr-ans');
      ans.hidden = false;
      ans.innerHTML = `<div class="small muted">参考答案</div>
        <div class="tr-ref" ${zj ? 'lang="ja"' : ''}>${esc(ref)}${zj ? speakBtn(x.jp) + shadowBtn(x.jp, '', x.zh) : ''}</div>
        ${mine ? `<div class="small">和参考答案的相似度约 <b>${trSimilar(mine, ref)}%</b>（意思对就行，说法不同也可以算会）</div>` : ''}
        <div class="small muted">出处：${esc(x.src)}</div>
        <div class="row tr-grade"><button class="btn" type="button" data-g="0">不会</button><button class="btn" type="button" data-g="1">差不多</button><button class="btn pri" type="button" data-g="2">会了</button></div>`;
      box.querySelector('[data-show]').parentElement.remove();
      if (zj) speak(x.jp);
      ans.querySelectorAll('[data-g]').forEach(b => {
        b.onclick = () => {
          const g = +b.dataset.g, again = new Set(S.trAgain || []);
          if (g === 0) again.add(x.jp); else if (g === 2) again.delete(x.jp);
          S.trAgain = [...again].slice(-300);
          S.trStat = S.trStat || { n: 0, ok: 0 }; S.trStat.n++; if (g === 2) { S.trStat.ok++; ok++; }
          save(); i++; show();
        };
      });
    };
  };
  show();
}
