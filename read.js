// 阅读：按级别和题材排成图片卡片，点进去读全文（逐句朗读、假名、中文、生词、小测验）。
// 数据在 reading.js（tools/build_reading.py 生成），插图在 scenes.js。
const READ_CATS = { 日本生活: '🏪', 地方美食: '🍢', 职业日常: '👷', 节日季节: '🎆', 常识: '💡', 运动: '⚽', 笑话: '😂', 传统文化: '⛩️', 人文情感: '💗', 感人故事: '🌸', 美食: '🍜', 旅行: '🧳' };
// 带日期的「日本生活」文章每天上新一篇：日期没到的先不显示
const readList = () => READING.filter(a => !a.date || a.date <= dkey()).sort((x, y) => (y.date || '').localeCompare(x.date || ''));
const todayArticle = () => readList().find(a => a.date === dkey());
// 实拍照片（Wikimedia Commons，注明作者和授权）；没有照片的旧文章用插画
const artImg = (a, big) => a.ph ? `<img class="rc-photo" src="${esc(a.ph[0])}" alt="${esc(a.zh)}" loading="lazy" decoding="async">`
  : `<div class="rc-ph-none${BIZ_ICON[a.cat] ? ' biz' : ''}"><span>${READ_CATS[a.cat] || BIZ_ICON[a.cat] || '📖'}</span><b>${esc(a.cat || '')}</b></div>`;   // 没有贴切的照片时用分类封面，不用卡通插画
const BIZ_ICON = { 职场基础: '🏢', 电话: '📞', 拜访接待: '🤝', 会议: '📊', 报联商: '🗣️', 道歉拒绝: '🙇', 谈判销售: '💼', 求职面试: '👔', 应酬: '🍶', 出差: '🚄' };
const photoCredit = a => a.ph ? `<div class="ph-credit small muted">照片：${esc(a.ph[1])} · ${esc(a.ph[2])} · <a href="${esc(a.ph[3])}" target="_blank" rel="noopener">Wikimedia Commons</a></div>` : '';
let readFilter = { L: null, cat: '' };
let readReturn = null;   // 从文章点「查看详情」去词典时记下位置，回来接着读

/* ---------- 生词：画线、点词释义、长按/选中翻译 ---------- */
let WORD_IDX = null, JM_IDX = null;
function wordIndex() {
  if (!WORD_IDX) {
    WORD_IDX = new Map();
    for (const v of allVocab()) for (const w of [v.w, ...v.alt]) if (!WORD_IDX.has(w)) WORD_IDX.set(w, v);
  }
  return WORD_IDX;
}
function jmIndex() {
  if (!JM_IDX && JMDICT) {
    JM_IDX = new Map();
    for (const e of JMDICT) for (const w of [...e.k, ...e.r]) if (!JM_IDX.has(w)) JM_IDX.set(w, e);
  }
  return JM_IDX;
}
// 按 原形 → 另一种写法 → 表层 的顺序查：本站词表（中文）优先，其次 JMdict（英文）
function lookupWord(forms, keyset) {
  for (const f of forms) if (f && keyset && keyset.has(f)) { const [w, r, zh] = keyset.get(f); const v = wordIndex().get(w); return { w, r, zh, v, key: true }; }
  for (const f of forms) { const v = f && wordIndex().get(f); if (v) return { w: v.w, r: v.r, zh: v.m, v }; }
  const jm = jmIndex();
  if (jm) for (const f of forms) { const e = f && jm.get(f); if (e) return { w: e.k[0] || e.r[0], r: e.r[0], en: e.s.slice(0, 3).map(g => g.join('; ')), jm: e }; }
  return null;
}
function tokHTML(toks, keyset) {
  if (!toks) return '';
  return toks.map(t => {
    if (t.length === 1) return esc(t[0]);
    const forms = t.slice(1).concat(t[0]);
    const hit = lookupWord(forms, keyset);
    const cls = hit ? (hit.key ? 'wd key' : 'wd u') : 'wd';
    return `<span class="${cls}" data-f="${esc(forms.join('|'))}">${esc(t[0])}</span>`;
  }).join('');
}
function closeSheet() { const o = document.querySelector('.word-sheet'); if (o) o.remove(); document.querySelectorAll('.wd.on').forEach(x => x.classList.remove('on')); }
function showSheet(text, hit, a) {
  closeSheet();
  const say = hit ? hit.r : text;
  const meaning = !hit ? '' : hit.zh ? `<div class="ws-m">${esc(hit.zh)}</div>` : `<ol class="ws-en">${hit.en.map(x => `<li>${esc(x)}</li>`).join('')}</ol><div class="small muted">英文释义来自 JMdict · <a href="https://translate.google.com/?sl=ja&tl=zh-CN&text=${encodeURIComponent(hit.w)}&op=translate" target="_blank" rel="noopener">看中文翻译 ↗</a></div>`;
  const ex = hit && hit.v ? exList(hit.v.w)[0] : null;
  const inDeck = hit && hit.v && S.srs[hit.v.id];
  const sh = h(`<div class="word-sheet" role="dialog" aria-label="释义">
    <button class="ws-x" type="button" aria-label="关闭">×</button>
    <div class="row"><span class="ws-w" lang="ja">${esc(hit ? hit.w : text)}</span>${hit && hit.r !== hit.w ? `<span class="ws-r" lang="ja">${esc(hit.r)}</span>` : ''}${speakBtn(say)}${hit && hit.v ? `<span class="tag lv">${hit.v.L}</span>` : ''}</div>
    ${meaning || '<div class="ws-m ws-empty"></div>'}
    ${ex ? `<div class="small"><span lang="ja" class="furi">${furiHTML(ex[0], ex[3])}</span><br><span class="muted">${esc(ex[2])}</span></div>` : ''}
    <div class="row">
      ${hit && hit.v && hit.v.q ? `<button class="btn soft" type="button" data-add ${inDeck ? 'disabled' : ''}>${inDeck ? '已在单词卡' : '+ 单词卡'}</button>` : ''}
      <button class="btn" type="button" data-more>查看详情 →</button>
      ${cloudOn() ? '<button class="btn ghost" type="button" data-report>报错</button>' : ''}
    </div>
  </div>`);
  document.body.append(sh);
  sh.querySelector('.ws-x').onclick = closeSheet;
  const add = sh.querySelector('[data-add]');
  if (add) add.onclick = () => { S.srs[hit.v.id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; save(); add.textContent = '已加入'; add.disabled = true; toast(`「${hit.v.w}」已加入单词卡`); };
  const rep = sh.querySelector('[data-report]');
  if (rep) rep.onclick = () => feedbackSheet('content', `「${hit ? hit.w : text}」${hit && hit.zh ? '（' + hit.zh + '）' : ''}：`);
  sh.querySelector('[data-more]').onclick = () => {
    readReturn = a ? { hash: location.hash.slice(1), y: scrollY, title: a.title } : null;
    dictQuery = hit ? hit.w : text; dictDir = null;
    closeSheet(); location.hash = 'dict';
  };
}
// 从词典页返回时回到原来的位置
function restoreReadPos() {
  if (readReturn && readReturn.hash === location.hash.slice(1)) { const y = readReturn.y; readReturn = null; setTimeout(() => scrollTo({ top: y, behavior: 'instant' }), 30); }
}
function bindWords(p, a) {
  const keyset = new Map((a.w || []).map(x => [x[0], x]));
  const formsOf = el => el.dataset.f.split('|');
  p.querySelectorAll('.wd').forEach(el => {
    el.onclick = e => {
      if (el.closest('.hide-jp:not(.shown)')) return;   // 角色扮演时先揭开整句
      if (p.querySelector('[data-shadowmode]:checked')) return;   // 跟读模式下点哪里都是跟读整句
      e.stopPropagation();
      const hit = lookupWord(formsOf(el), keyset);
      showSheet(el.textContent, hit, a); el.classList.add('on');
    };
  });
  // JMdict 加载好以后，把词表里没有、JMdict 里有的词也画上线
  loadJmdict().then(() => {
    if (!document.body.contains(p)) return;
    p.querySelectorAll('.wd:not(.u):not(.key)').forEach(el => { if (lookupWord(formsOf(el), keyset)) el.classList.add('u', 'jm'); });
  }).catch(() => {});
  // 长按或拖选一段文字：查得到就给释义，查不到释义留空
  let t;
  const onSel = () => {
    if (!document.body.contains(p)) { document.removeEventListener('selectionchange', onSel); return; }
    clearTimeout(t);
    t = setTimeout(() => {
      const sel = getSelection();
      if (!sel || sel.isCollapsed || !sel.anchorNode || !p.querySelector('.ra-text').contains(sel.anchorNode)) return;
      const an = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      if (an && an.closest('.ra-zh')) return;
      const text = sel.toString().replace(/\s+/g, '').trim();
      if (!text || text.length > 40) return;
      let hit = lookupWord([text, toHira(text)], keyset);
      if (!hit) {
        // 选中的正好是一个词的变形（登りました → 登る）
        const el = [...p.querySelectorAll('.wd')].find(x => x.textContent === text || text.startsWith(x.textContent) && text.length - x.textContent.length <= 4);
        if (el) hit = lookupWord(formsOf(el), keyset);
      }
      showSheet(text, hit, a);
    }, 450);
  };
  document.addEventListener('selectionchange', onSel);
}
document.addEventListener('click', e => { if (!e.target.closest('.word-sheet') && !e.target.closest('.wd')) closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
addEventListener('hashchange', closeSheet);

function viewRead(id) {
  if (id) { const a = readList().find(x => x.id === id); if (a) return readArticle(a); }
  if (!readFilter.L) readFilter.L = S.level;
  const done = S.read || {};
  const all = readList(), today = todayArticle();
  const list = all.filter(a => (readFilter.L === 'all' || a.L === readFilter.L) && (!readFilter.cat || a.cat === readFilter.cat));
  const lvCount = L => { const lv = all.filter(a => a.L === L); return `${lv.filter(a => done[a.id]).length}/${lv.length}`; };
  const p = h(`<section class="panel">
    <div class="row between"><h2>阅读</h2><span class="small muted">已读 ${all.filter(a => done[a.id]).length} / ${all.length} 篇</span></div>
    ${today ? `<a class="today-art" href="#read/${today.id}"><div class="ta-img">${artImg(today)}</div><div><span class="tag done">今日上新</span> <span class="tag lv">${today.L}</span><div class="rc-title" lang="ja">${esc(today.title)}</div><div class="small muted">${esc(today.zh)} · ${READ_CATS[today.cat]} ${today.cat}</div></div></a>` : ''}
    <p class="small muted">「日本生活」每天上新一篇：便利店、地方美食、各行各业的一天、节日季节……配真实照片。点开卡片就能读。每句都能点读、看中文；读完做个小测验拿经验。</p>
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
      <div class="rc-img">${artImg(a)}<span class="tag lv">${a.L}</span>${a.date === dkey() ? '<span class="tag done rc-new">今日</span>' : ''}${done[a.id] ? `<span class="rc-done" title="已读">読了</span>` : ''}</div>
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
  const vocabOf = w => wordIndex().get(w);
  const keyset = new Map(a.w.map(x => [x[0], x]));
  const p = h(`<article class="panel read-art">
    <div class="ra-hero">${artImg(a, true)}</div>${photoCredit(a)}
    <div class="row between"><a class="small" href="#read">← 返回阅读</a><span class="row"><span class="tag lv">${a.L}</span><span class="tag">${READ_CATS[a.cat] || ''} ${a.cat}</span>${done ? '<span class="tag done">已读</span>' : ''}</span></div>
    <h2 class="ra-title" lang="ja">${esc(a.title)}</h2>
    <div class="muted">${esc(a.zh)}</div>
    <div class="ra-tools">
      <button class="btn pri" type="button" data-play>${SPEAK_SVG}<span>全文朗读</span></button>
      <label class="switch"><input type="checkbox" data-kana> 假名</label>
      <label class="switch"><input type="checkbox" data-zh> 全部中文</label>
      <label class="switch"><input type="checkbox" data-shadowmode> 🎙 跟读模式</label>
    </div>
    <p class="small muted">点一句话：朗读并显示中文。</p>
    <div class="ra-text">${a.p.map(para => `<p>${para.map(([jp, kana, zh, toks]) => `<span class="ra-s" data-i="${idx++}" tabindex="0" role="button"><span class="ra-jp" lang="ja">${tokHTML(toks, keyset)}</span><span class="ra-kana" lang="ja">${esc(kana)}</span><span class="ra-zh">${esc(zh)}</span></span>`).join('')}</p>`).join('')}</div>
    <div class="row between"><h3>生词</h3><button type="button" class="btn small" data-addall>全部加入单词卡</button></div>
    <div class="ra-words">${a.w.map(([w, r, zh]) => { const v = vocabOf(w); return `<div class="ra-word"><span lang="ja" class="rw-w">${esc(w)}</span><span lang="ja" class="rw-r">${esc(r)}</span>${speakBtn(r)}<span class="rw-m">${esc(zh)}</span>${v && v.q ? `<button type="button" class="chip-btn" data-add="${esc(v.id)}">${S.srs[v.id] ? '已在单词卡' : '+ 单词卡'}</button>` : ''}</div>`; }).join('')}</div>
    <p class="small muted">${reportBtn(`阅读《${a.title}》`, a.zh)} 发现读音、翻译或内容有误？点小旗子告诉我们。</p>
    <h3>读后小测验</h3>
    <div class="ra-quiz"></div>
  </article>`);
  main.append(p);
  bindWords(p, a);
  restoreReadPos();
  const nodes = [...p.querySelectorAll('.ra-s')];
  const textBox = p.querySelector('.ra-text');
  p.querySelector('[data-kana]').onchange = e => textBox.classList.toggle('show-kana', e.target.checked);
  p.querySelector('[data-zh]').onchange = e => textBox.classList.toggle('show-zh', e.target.checked);
  const mark = i => nodes.forEach((n, j) => n.classList.toggle('now', j === i));
  nodes.forEach((n, i) => {
    const go = e => { if (p.querySelector('[data-shadowmode]').checked) { e && e.stopPropagation(); stopPlay(); mark(i); return shadowSheet(sents[i][0], sents[i][1], sents[i][2]); } if (e && (e.target.closest('.wd') || String(getSelection()).trim())) return; stopPlay(); n.classList.add('open'); mark(i); speak(sents[i][1], { onend: () => mark(-1) }); };
    n.onclick = go; n.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
  // 全文朗读：一句一句接着读，当前句高亮
  let playing = false;
  const playBtn = p.querySelector('[data-play]');
  const stopPlay = () => { playing = false; playBtn.querySelector('span').textContent = '全文朗读'; stopSpeech(); mark(-1); };
  const playFrom = i => {
    if (!playing || i >= sents.length || !document.body.contains(p)) return stopPlay();
    mark(i); nodes[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    speak(sents[i][1], { onend: () => setTimeout(() => playFrom(i + 1), 250) });
  };
  playBtn.onclick = () => { if (playing) return stopPlay(); playing = true; playBtn.querySelector('span').textContent = '停止'; playFrom(0); };
  p.querySelector('[data-addall]').onclick = e => {
    let n = 0;
    p.querySelectorAll('[data-add]').forEach(b => { const id = b.dataset.add; if (!S.srs[id]) { S.srs[id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; n++; } b.textContent = '已在单词卡'; });
    save(); e.target.disabled = true; toast(n ? `${n} 个生词已加入单词卡，今天就会复习` : '这些词都已经在单词卡里了');
  };
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
    const next = readList().filter(x => x.L === a.L && !S.read[x.id] && x.id !== a.id)[0] || readList().find(x => !S.read[x.id] && x.id !== a.id);
    qbox.append(h(`<div class="ra-done"><b>${right === a.q.length ? '全对！' : `答对 ${right}/${a.q.length}`}</b> 获得 ${xp} 经验${first ? '（首次读完）' : ''}。
      <div class="row">${next ? `<a class="btn pri" href="#read/${next.id}">下一篇：<span lang="ja">${esc(next.title)}</span></a>` : ''}<a class="btn" href="#read">回到列表</a></div></div>`));
  };
}
