// 阅读：按级别和题材排成图片卡片，点进去读全文（逐句朗读、假名、中文、生词、小测验）。
// 数据在 reading.js（tools/build_reading.py 生成），插图在 scenes.js。
const READ_CATS = { 常识: '💡', 运动: '⚽', 笑话: '😂', 传统文化: '⛩️', 人文情感: '💗', 感人故事: '🌸', 美食: '🍜', 旅行: '🧳' };
let readFilter = { L: null, cat: '' };

function viewRead(id) {
  if (id) { const a = READING.find(x => x.id === id); if (a) return readArticle(a); }
  if (!readFilter.L) readFilter.L = S.level;
  const done = S.read || {};
  const list = READING.filter(a => (readFilter.L === 'all' || a.L === readFilter.L) && (!readFilter.cat || a.cat === readFilter.cat));
  const lvCount = L => { const all = READING.filter(a => a.L === L); return `${all.filter(a => done[a.id]).length}/${all.length}`; };
  const p = h(`<section class="panel">
    <div class="row between"><h2>阅读</h2><span class="small muted">已读 ${Object.keys(done).length} / ${READING.length} 篇</span></div>
    <p class="small muted">常识、运动、笑话、传统文化、感人故事……点开卡片就能读。每句都能点读、看中文；读完做个小测验拿经验。</p>
    <div class="seg read-lv" role="group" aria-label="级别">
      ${LEVELS.map(L => `<button type="button" data-lv="${L}" class="${readFilter.L === L ? 'on' : ''}">${L}<span class="lv-n">${lvCount(L)}</span></button>`).join('')}
      <button type="button" data-lv="all" class="${readFilter.L === 'all' ? 'on' : ''}">全部</button>
    </div>
    <div class="row cat-row">
      <button type="button" class="chip-btn ${!readFilter.cat ? 'on' : ''}" data-cat="">全部题材</button>
      ${Object.entries(READ_CATS).map(([c, e]) => `<button type="button" class="chip-btn ${readFilter.cat === c ? 'on' : ''}" data-cat="${c}">${e} ${c}</button>`).join('')}
    </div>
  </section>`);
  const grid = h(`<div class="read-grid"></div>`);
  if (!list.length) grid.append(h(`<p class="muted">这个分类还没有文章，换一个看看吧。</p>`));
  for (const a of list) {
    const first = a.p[0][0][0];
    grid.append(h(`<a class="read-card" href="#read/${a.id}">
      <div class="rc-img">${scene(a.img)}<span class="tag lv">${a.L}</span>${done[a.id] ? `<span class="rc-done" title="已读">読了</span>` : ''}</div>
      <div class="rc-body">
        <div class="rc-cat">${READ_CATS[a.cat] || ''} ${a.cat}</div>
        <div class="rc-title" lang="ja">${esc(a.title)}</div>
        <div class="rc-zh">${esc(a.zh)}</div>
        <div class="rc-first" lang="ja">${esc(first)}</div>
      </div>
    </a>`));
  }
  main.append(p, grid);
  p.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => { readFilter.L = b.dataset.lv; render(); }; });
  p.querySelectorAll('[data-cat]').forEach(b => { b.onclick = () => { readFilter.cat = b.dataset.cat; render(); }; });
}

function readArticle(a) {
  const done = (S.read || {})[a.id];
  const sents = a.p.flat();
  let idx = 0;
  const vocabOf = w => allVocab().find(v => v.w === w || v.alt.includes(w));
  const p = h(`<article class="panel read-art">
    <div class="ra-hero">${scene(a.img)}</div>
    <div class="row between"><a class="small" href="#read">← 返回阅读</a><span class="row"><span class="tag lv">${a.L}</span><span class="tag">${READ_CATS[a.cat] || ''} ${a.cat}</span>${done ? '<span class="tag done">已读</span>' : ''}</span></div>
    <h2 class="ra-title" lang="ja">${esc(a.title)}</h2>
    <div class="muted">${esc(a.zh)}</div>
    <div class="ra-tools">
      <button class="btn pri" type="button" data-play>${SPEAK_SVG}<span>全文朗读</span></button>
      <label class="switch"><input type="checkbox" data-kana> 假名</label>
      <label class="switch"><input type="checkbox" data-zh> 全部中文</label>
    </div>
    <p class="small muted">点一句话：朗读并显示中文。</p>
    <div class="ra-text">${a.p.map(para => `<p>${para.map(([jp, kana, zh]) => `<span class="ra-s" data-i="${idx++}" tabindex="0" role="button"><span class="ra-jp" lang="ja">${esc(jp)}</span><span class="ra-kana" lang="ja">${esc(kana)}</span><span class="ra-zh">${esc(zh)}</span></span>`).join('')}</p>`).join('')}</div>
    <h3>生词</h3>
    <div class="ra-words">${a.w.map(([w, r, zh]) => { const v = vocabOf(w); return `<div class="ra-word"><span lang="ja" class="rw-w">${esc(w)}</span><span lang="ja" class="rw-r">${esc(r)}</span>${speakBtn(r)}<span class="rw-m">${esc(zh)}</span>${v && v.q ? `<button type="button" class="chip-btn" data-add="${esc(v.id)}">${S.srs[v.id] ? '已在单词卡' : '+ 单词卡'}</button>` : ''}</div>`; }).join('')}</div>
    <h3>读后小测验</h3>
    <div class="ra-quiz"></div>
  </article>`);
  main.append(p);
  const nodes = [...p.querySelectorAll('.ra-s')];
  const textBox = p.querySelector('.ra-text');
  p.querySelector('[data-kana]').onchange = e => textBox.classList.toggle('show-kana', e.target.checked);
  p.querySelector('[data-zh]').onchange = e => textBox.classList.toggle('show-zh', e.target.checked);
  const mark = i => nodes.forEach((n, j) => n.classList.toggle('now', j === i));
  nodes.forEach((n, i) => {
    const go = () => { stopPlay(); n.classList.add('open'); mark(i); speak(sents[i][1], { onend: () => mark(-1) }); };
    n.onclick = go; n.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
  // 全文朗读：一句一句接着读，当前句高亮
  let playing = false;
  const playBtn = p.querySelector('[data-play]');
  const stopPlay = () => { playing = false; playBtn.querySelector('span').textContent = '全文朗读'; if (hasTTS) speechSynthesis.cancel(); mark(-1); };
  const playFrom = i => {
    if (!playing || i >= sents.length || !document.body.contains(p)) return stopPlay();
    mark(i); nodes[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    speak(sents[i][1], { onend: () => setTimeout(() => playFrom(i + 1), 250) });
  };
  playBtn.onclick = () => { if (playing) return stopPlay(); playing = true; playBtn.querySelector('span').textContent = '停止'; playFrom(0); };
  p.querySelectorAll('[data-add]').forEach(b => {
    b.onclick = () => { const id = b.dataset.add; if (S.srs[id]) return; S.srs[id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; save(); b.textContent = '已加入'; toast('已加入单词卡，今天就会复习'); };
  });
  // 小测验：答完全部题目算读完
  const qbox = p.querySelector('.ra-quiz');
  let right = 0, answered = 0;
  a.q.forEach(([q, ok, ...bad], qi) => {
    const opts = shuffle([ok, ...bad]);
    const card = h(`<div class="ra-q"><div class="ra-qq" lang="ja"><b>${qi + 1}.</b> ${esc(q)}</div><div class="opts">${opts.map(o => `<button type="button" class="opt" lang="ja">${esc(o)}</button>`).join('')}</div></div>`);
    card.querySelectorAll('.opt').forEach(b => {
      b.onclick = () => {
        if (card.dataset.done) return;
        card.dataset.done = 1; answered++;
        const good = b.textContent === ok;
        if (good) right++;
        card.querySelectorAll('.opt').forEach(x => { if (x.textContent === ok) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); x.disabled = true; });
        if (answered === a.q.length) finish();
      };
    });
    qbox.append(card);
  });
  const finish = () => {
    const first = !(S.read || {})[a.id];
    S.read = S.read || {};
    S.read[a.id] = Math.max(S.read[a.id] || 0, right) || right || 0.1;
    const xp = first ? 15 + right * 5 : right * 2;
    addXP(xp); save();
    if (right === a.q.length) celebrate();
    const next = READING.filter(x => x.L === a.L && !S.read[x.id] && x.id !== a.id)[0] || READING.find(x => !S.read[x.id] && x.id !== a.id);
    qbox.append(h(`<div class="ra-done"><b>${right === a.q.length ? '全对！' : `答对 ${right}/${a.q.length}`}</b> 获得 ${xp} 经验${first ? '（首次读完）' : ''}。
      <div class="row">${next ? `<a class="btn pri" href="#read/${next.id}">下一篇：<span lang="ja">${esc(next.title)}</span></a>` : ''}<a class="btn" href="#read">回到列表</a></div></div>`));
  };
}
