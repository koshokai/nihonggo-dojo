// 阅读：按级别和题材排成图片卡片，点进去读全文（逐句朗读、假名、中文、生词、小测验）。
// 数据在 reading.js（tools/build_reading.py 生成），插图在 scenes.js。
const READ_CATS = { 日本生活: '🏪', 地方美食: '🍢', 职业日常: '👷', 节日季节: '🎆', 常识: '💡', 运动: '⚽', 笑话: '😂', 传统文化: '⛩️', 人文情感: '💗', 感人故事: '🌸', 美食: '🍜', 旅行: '🧳', 动漫: '🎌', 日剧: '📺', 科技: '💻' };
// 带日期的「日本生活」文章每天上新一篇：日期没到的先不显示
const readList = () => (typeof READING === 'undefined' ? [] : READING).filter(a => (!a.date || a.date <= dkey()) && (!a.wk || wkVisible(a.wk))).sort((x, y) => (y.date || y.wk || '').localeCompare(x.date || x.wk || ''));   // 每周精选的文章只在最近 4 期里显示
const todayArticle = () => readList().find(a => a.date === dkey());
// 实拍照片（Wikimedia Commons，注明作者和授权）；没有照片的旧文章用插画
const artImg = (a, big) => a.ph ? `<img class="rc-photo" src="${esc(a.ph[0])}" alt="${esc(a.zh)}" loading="lazy" decoding="async">`
  : `<div class="rc-ph-none${BIZ_ICON[a.cat] ? ' biz' : ''}"><span>${READ_CATS[a.cat] || BIZ_ICON[a.cat] || '📖'}</span><b>${esc(catName(a.cat || ''))}</b></div>`;   // 没有贴切的照片时用分类封面，不用卡通插画
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
// furi：整句的假名位置（build_reading.py / build_business.py 生成），按分词切开，汉字头上标假名
function tokHTML(toks, keyset, furi) {
  if (!toks) return '';
  const notes = (furi || '').split(',').map(s => s.match(/^(\d+)\.(\d+)(.*)$/)).filter(Boolean).map(m => [+m[1], +m[2], m[3]]);
  let pos = 0;
  return toks.map(t => {
    const s = pos, e = pos + t[0].length; pos = e;
    const f = notes.filter(([a, n]) => a >= s && a + n <= e).map(([a, n, r]) => `${a - s}.${n}${r}`).join(',');
    const inner = f ? furiHTML(t[0], f) : esc(t[0]);
    if (t.length === 1) return inner;
    const forms = t.slice(1).concat(t[0]);
    const hit = lookupWord(forms, keyset);
    const cls = hit ? (hit.key ? 'wd key' : 'wd u') : 'wd';
    return `<span class="${cls}" data-f="${esc(forms.join('|'))}">${inner}</span>`;
  }).join('');
}
function closeSheet() { const o = document.querySelector('.word-sheet'); if (o) o.remove(); document.querySelectorAll('.wd.on').forEach(x => x.classList.remove('on')); }
// 点到的词：去掉注音（<rt>）的原文 + 读音（有注音时把汉字换成假名）。词典里查不到的词按读音找录音
function wdText(el) {
  const c = el.cloneNode(true); c.querySelectorAll('rt, rp').forEach(x => x.remove());
  const r = el.cloneNode(true); r.querySelectorAll('rp').forEach(x => x.remove());
  r.querySelectorAll('ruby').forEach(rb => { const rt = rb.querySelector('rt'); rb.replaceWith(rt ? rt.textContent : rb.textContent); });
  return [c.textContent.trim(), r.textContent.trim()];
}
function showSheet(text, hit, a, reading) {
  closeSheet();
  const say = hit ? hit.r : (reading || text);
  const meaning = !hit ? '' : hit.zh ? `<div class="ws-m">${esc(hit.zh)}</div>` : `<ol class="ws-en">${hit.en.map(x => `<li>${esc(x)}</li>`).join('')}</ol><div class="small muted">英文释义来自 JMdict · <a href="https://translate.google.com/?sl=ja&tl=zh-CN&text=${encodeURIComponent(hit.w)}&op=translate" target="_blank" rel="noopener">看中文翻译 ↗</a></div>`;
  const ex = hit && hit.v ? exList(hit.v.w)[0] : null;
  const inDeck = hit && hit.v && S.srs[hit.v.id];
  const sh = h(`<div class="word-sheet" role="dialog" aria-label="释义">
    <button class="ws-x" type="button" aria-label="关闭">×</button>
    <div class="row"><span class="ws-w furi" lang="ja">${hit ? jrWord(hit.w, hit.r) : esc(text)}</span>${hit && hit.r !== hit.w ? `<span class="ws-r" lang="ja">${esc(hit.r)}</span>` : !hit && reading && reading !== text ? `<span class="ws-r" lang="ja">${esc(reading)}</span>` : ''}${speakBtn(say)}${hit && hit.v ? `<span class="tag lv">${hit.v.L}</span>` : ''}</div>
    ${meaning || '<div class="ws-m ws-empty"></div>'}
    ${ex ? `<div class="small"><span lang="ja" class="furi">${furiHTML(ex[0], ex[3])}</span><br><span class="muted">${esc(ex[2])}</span></div>` : ''}
    <div class="row">
      ${hit && hit.v && hit.v.q ? `<button class="btn soft" type="button" data-add ${inDeck ? 'disabled' : ''}>${inDeck ? '已在单词卡' : '+ 单词卡'}</button>` : ''}
      <button class="btn" type="button" data-more>查看详情 →</button>
      ${typeof favBtn === 'function' ? favBtn('w', hit ? hit.w : text, hit ? `${hit.r || ''} ${hit.zh || (hit.en || [])[0] || ''}`.trim() : '', 'ja') : ''}
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
    closeSheet(); openDict(hit ? hit.w : text);
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
      if (typeof glossOK === 'function' && !glossOK()) return;
      const hit = lookupWord(formsOf(el), keyset);
      const [s, r] = wdText(el);
      showSheet(s, hit, a, r); el.classList.add('on');
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
      if (typeof glossOK === 'function' && !glossOK()) return;
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

// 会员：N2、N1 的文章换成服务器上的完整版（member.js）；不是会员时换回只有标题的版本（lock: 1）
let READ_PUBLIC = null, READ_FULL = false;
function readMember() {
  if (typeof READING === 'undefined') return Promise.resolve(false);
  if (!READ_PUBLIC) READ_PUBLIC = READING.slice();
  const want = typeof isMember === 'function' && isMember('ja');
  if (!want) { if (READ_FULL) { READING.splice(0, READING.length, ...READ_PUBLIC); READ_FULL = false; } return Promise.resolve(false); }
  if (READ_FULL) return Promise.resolve(false);
  return memberData('ja', 'reading-member.json').then(d => enApply('ja', 'reading-member.json', 'reading', d)).then(d => {   // 英语母语的用户换上英文版（会员内容）
    if (!d || !isMember('ja')) return false;
    const by = new Map(d.map(a => [a.id, a]));
    READING.splice(0, READING.length, ...READ_PUBLIC.map(a => (a.lock && by.get(a.id)) || a));
    READ_FULL = true; return true;
  }).catch(() => false);
}
function viewRead(id) {
  const want = typeof isMember === 'function' && isMember('ja');
  if (want !== READ_FULL) readMember().then(ok => { if (ok && (location.hash || '').startsWith('#read')) render(); });
  audioIdx('reading');
  if (id) {
    const a = readList().find(x => x.id === id);
    if (a && a.lock) return main.append(h(`<section class="panel lock-panel"><a class="small" href="#read">← ${tz('返回阅读', 'Back to reading')}</a><div class="lock-ic" aria-hidden="true">✨</div>
      <h2 class="furi" lang="ja">${jr(a.title)}</h2><p class="muted">${esc(a.zh)}</p><p>${tz('N2、N1 的文章是会员内容：更深入的话题、更长的文章，每句都能点读，读完有小测验。', 'N2 and N1 articles are for members: deeper topics and longer articles, audio for every sentence, and a short quiz at the end.')}</p>
      <a class="btn pri" href="#vip">${tz('了解会员', 'About membership')}</a></section>`));
    if (a) return readArticle(a);
  }
  if (!readFilter.L) readFilter.L = S.level;
  const done = S.read || {};
  const all = readList(), today = todayArticle();
  // 没读过的排前面（读过的放到后面，打着「読了」）
  const list = all.filter(a => (readFilter.L === 'all' || a.L === readFilter.L) && (!readFilter.cat || a.cat === readFilter.cat)).sort((x, y) => (done[x.id] ? 1 : 0) - (done[y.id] ? 1 : 0));
  const p = h(`<section class="panel">
    <h2>阅读</h2>
    ${today ? `<a class="today-art" href="#read/${today.id}"><div class="ta-img">${artImg(today)}</div><div><span class="tag done">今日上新</span> <span class="tag lv">${today.L}</span><div class="rc-title furi" lang="ja">${jr(today.title)}</div><div class="small muted">${esc(today.zh)} · ${READ_CATS[today.cat] || ''} ${esc(catName(today.cat))}</div></div></a>` : ''}
    <p class="small muted">「日本生活」每天上新一篇：便利店、地方美食、各行各业的一天、节日季节……配真实照片。点开卡片就能读。每句都能点读、看中文；读完做个小测验拿经验。</p>
    <div class="seg read-lv" role="group" aria-label="级别">
      ${LEVELS.map(L => `<button type="button" data-lv="${L}" class="${readFilter.L === L ? 'on' : ''}">${L}</button>`).join('')}
      <button type="button" data-lv="all" class="${readFilter.L === 'all' ? 'on' : ''}">全部</button>
    </div>
    ${pickSelect('题材', 'data-cat', [['', tz('全部题材', 'All topics')], ...Object.entries(READ_CATS).map(([c, e]) => [c, `${e} ${catName(c)}`])], readFilter.cat || '')}
  </section>`);
  const grid = h(`<div class="read-grid"></div>`);
  if (!list.length) grid.append(h(`<p class="muted">这个分类还没有文章，换一个看看吧。</p>`));
  // 一次显示 20 篇，下面「再显示 20 篇」（一次全部列出来，手机上要翻几十屏）
  const card = a => {
    const first = a.lock ? '' : a.p[0][0][0];
    grid.append(h(`<a class="read-card has-vip" href="#read/${a.id}">${a.lock || (READ_PUBLIC && (READ_PUBLIC.find(x => x.id === a.id) || { lock: 1 }).lock) ? vipTag() : ''}
      <div class="rc-img">${artImg(a)}<span class="tag lv">${a.L}</span>${a.date === dkey() ? '<span class="tag done rc-new">今日</span>' : ''}${done[a.id] ? `<span class="rc-done" title="已读">読了</span>` : ''}</div>
      <div class="rc-body">
        <div class="rc-cat">${READ_CATS[a.cat] || ''} ${esc(catName(a.cat))}</div>
        <div class="rc-title furi" lang="ja">${jr(a.title)}</div>
        <div class="rc-zh">${esc(a.zh)}</div>
        ${a.lock ? '<div class="rc-first small muted">🔒 会员</div>' : `<div class="rc-first furi" lang="ja">${furiHTML(first, a.p[0][0][4] || '')}</div>`}
      </div>
    </a>`));
  };
  let shown = 0;
  const more = h('<div class="row read-more"><button class="btn" type="button">再显示 20 篇</button></div>');
  const page = () => { list.slice(shown, shown + 20).forEach(card); shown += 20; more.hidden = shown >= list.length; };
  more.querySelector('button').onclick = page;
  page();
  main.append(p, grid, more);
  p.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => { readFilter.L = b.dataset.lv; render(); }; });
  p.querySelector('[data-cat]').onchange = e => { readFilter.cat = e.target.value; render(); };
}

function readArticle(a) {
  // 会员文章的录音在私有存储里：先给每一句和生词取好临时地址
  if (READ_FULL && READ_PUBLIC && (READ_PUBLIC.find(x => x.id === a.id) || {}).lock !== undefined && typeof memberAudioKeys === 'function') memberAudioKeys('ja', 'ja-read', a.p.flat().map(s => s[1]).concat((a.w || []).map(w => w[1])));
  const done = (S.read || {})[a.id];
  const sents = a.p.flat();
  let idx = 0;
  const vocabOf = w => wordIndex().get(w);
  const keyset = new Map(a.w.map(x => [x[0], x]));
  const p = h(`<article class="panel read-art">
    <div class="ra-hero">${artImg(a, true)}</div>${photoCredit(a)}
    <div class="row between"><a class="an-back" href="#read">← 返回阅读</a><span class="row"><span class="tag lv">${a.L}</span><span class="tag">${READ_CATS[a.cat] || ''} ${esc(catName(a.cat))}</span>${done ? '<span class="tag done">已读</span>' : ''}</span></div>
    <h2 class="ra-title furi" lang="ja">${jr(a.title)}</h2>
    <div class="muted">${esc(a.zh)}</div>
    <div class="ra-tools">
      <button class="btn pri" type="button" data-play>${SPEAK_SVG}<span>全文朗读</span></button>
      <label class="switch"><input type="checkbox" data-kana> 假名</label>
      <label class="switch"><input type="checkbox" data-zh> 全部中文</label>
      <label class="switch"><input type="checkbox" data-loop${S.readLoop ? ' checked' : ''}> 🔁 循环播放</label>
      <label class="switch"><input type="checkbox" data-shadowmode> 🎙 跟读模式</label>
    </div>
    <p class="small muted">点一句话：朗读并显示中文。打开「循环播放」后，全文读完会从头再读；点一句话会反复读这一句，再点一次停止。</p>
    <div class="ra-text">${a.p.map(para => `<p>${para.map(([jp, kana, zh, toks, f]) => `<span class="ra-s" data-i="${idx++}" tabindex="0" role="button"><span class="ra-jp furi" lang="ja">${tokHTML(toks, keyset, f)}</span><span class="ra-kana" lang="ja">${esc(kana)}</span><span class="ra-zh">${esc(zh)}</span></span>`).join('')}</p>`).join('')}</div>
    <div class="row between"><h3>生词</h3><button type="button" class="btn small" data-addall>全部加入单词卡</button></div>
    <div class="ra-words">${a.w.map(([w, r, zh]) => { const v = vocabOf(w); return `<div class="ra-word"><span lang="ja" class="rw-w furi">${jrWord(w, r)}</span><span lang="ja" class="rw-r">${esc(r)}</span>${speakBtn(r)}<span class="rw-m">${esc(zh)}</span>${v && v.q ? `<button type="button" class="chip-btn" data-add="${esc(v.id)}">${S.srs[v.id] ? '已在单词卡' : '+ 单词卡'}</button>` : ''}</div>`; }).join('')}</div>
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
    const go = e => {
      if (p.querySelector('[data-shadowmode]').checked) { e && e.stopPropagation(); stopPlay(); mark(i); return shadowSheet(sents[i][0], sents[i][1], sents[i][2]); }
      if (e && (e.target.closest('.wd') || String(getSelection()).trim())) return;
      const again = repI === i; stopPlay(); n.classList.add('open'); mark(i);
      if (loopOn() && again) return;   // 循环中再点同一句：停止
      // 循环播放打开时：这一句反复读，直到点别的句子、再点这一句或关掉循环
      const tok = ++repTok; repI = loopOn() ? i : -1;
      const one = () => speak(sents[i][1], { onend: () => { if (tok !== repTok || !document.body.contains(p)) return; if (loopOn() && repI === i) setTimeout(() => { if (tok === repTok && repI === i) one(); }, 700); else { repI = -1; mark(-1); } } });
      one();
    };
    n.onclick = go; n.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
  // 全文朗读：一句一句接着读，当前句高亮；打开循环播放时读完从头再来
  let playing = false, repTok = 0, repI = -1;
  const loopOn = () => p.querySelector('[data-loop]').checked;
  p.querySelector('[data-loop]').onchange = e => { S.readLoop = e.target.checked; save(); if (!e.target.checked) { repI = -1; } };
  const playBtn = p.querySelector('[data-play]');
  const stopPlay = () => { playing = false; repTok++; repI = -1; playBtn.querySelector('span').textContent = '全文朗读'; stopSpeech(); mark(-1); };
  const playFrom = i => {
    if (playing && i >= sents.length && loopOn() && document.body.contains(p)) { const t = repTok; return setTimeout(() => playing && t === repTok && playFrom(0), 1200); }
    if (!playing || i >= sents.length || !document.body.contains(p)) return stopPlay();
    mark(i); nodes[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    speak(sents[i][1], { onend: () => setTimeout(() => playFrom(i + 1), 250) });
  };
  playBtn.onclick = () => { if (playing) return stopPlay(); stopPlay(); playing = true; playBtn.querySelector('span').textContent = '停止'; playFrom(0); };
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
        if (typeof weakNote === 'function') weakNote('ja', `r:${a.id}:${qi}`, good, { sk: 'r', l: q, m: `${a.title} → ${ok}`, href: `#read/${a.id}` });   // 我的弱项
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
    if (typeof actLog === 'function') actLog('r', 'ja');
    const xp = first ? 15 + right * 5 : right * 2;
    addXP(xp); save();
    if (right === a.q.length) celebrate();
    const next = readList().filter(x => x.L === a.L && !x.lock && !S.read[x.id] && x.id !== a.id)[0] || readList().find(x => !x.lock && !S.read[x.id] && x.id !== a.id);
    qbox.append(h(`<div class="ra-done"><b>${right === a.q.length ? '全对！' : `答对 ${right}/${a.q.length}`}</b> 获得 ${xp} 经验${first ? '（首次读完）' : ''}。
      <div class="row">${next ? `<a class="btn pri" href="#read/${next.id}">下一篇：<span lang="ja">${esc(next.title)}</span></a>` : ''}<a class="btn" href="#read">回到列表</a></div></div>`));
  };
}

/* ---------- 单词、语法例句：点词看释义（和阅读一样） ---------- */
// 例句没有预先分词，这里在网页上按词表 + JMdict 做最长匹配，动词、形容词的常见变形还原成原形再查
const JA_STOP = new Set(['です', 'でした', 'ます', 'ました', 'から', 'まで', 'など', 'けど', 'ので', 'のに', 'だけ', 'より', 'ほど', 'でも', 'には', 'では', 'とは', 'へは', 'ても', 'ては', 'たら', 'なら', 'って', 'だろう', 'でしょう', 'という', 'ている', 'ています', 'ない', 'たい', 'いる', 'ある', 'する', 'なる', 'くる', 'こと', 'もの', 'ため', 'よう', 'そう']);
const JA_U = { き: 'く', ぎ: 'ぐ', し: 'す', ち: 'つ', に: 'ぬ', び: 'ぶ', み: 'む', り: 'る', い: 'う' };
const JA_A = { か: 'く', が: 'ぐ', さ: 'す', た: 'つ', な: 'ぬ', ば: 'ぶ', ま: 'む', ら: 'る', わ: 'う' };
const JA_E = { け: 'く', げ: 'ぐ', せ: 'す', て: 'つ', ね: 'ぬ', べ: 'ぶ', め: 'む', れ: 'る', え: 'う' };
// 连用形（食べ / 書き）→ 原形候补
const jaFromStem = (st, map) => {
  if (!st) return [];
  const out = [st + 'る'], last = st.slice(-1), m = map[last];
  if (m) out.push(st.slice(0, -1) + m);
  if (st === 'し') out.push('する'); if (st === 'き' || st === 'こ') out.push('来る', 'くる');
  if (/し$/.test(st) && st.length > 1) out.push(st.slice(0, -1) + 'する', st.slice(0, -1));   // 勉強し → 勉強する、勉強
  return out;
};
const JA_RULES = [
  [/(?:ていました|ています|ていた|ている|てる|てた|ておく|ておいた|てしまう|てしまった|ちゃう|ちゃった|てください|てくれる|てもらう|てあげる|てみる|てみた)$/, s => [s + 'て']],
  [/(?:でいました|でいます|でいた|でいる|でる|でしまう|じゃう|じゃった|でください|でみる)$/, s => [s + 'で']],
  [/(?:ませんでした|ません|ました|ましょう|ます|たい|たくない|たかった|たくて|ながら|なさい|そう)$/, s => jaFromStem(s, JA_U)],
  [/(?:なかった|なくて|なければ|ないで|ない|ず|ずに)$/, s => [s + 'る', ...(JA_A[s.slice(-1)] ? [s.slice(0, -1) + JA_A[s.slice(-1)]] : []), ...(s.endsWith('し') ? [s.slice(0, -1) + 'する'] : []), ...(s === 'こ' ? ['来る'] : [])]],
  [/(?:った|って)$/, s => [s + 'う', s + 'つ', s + 'る', ...(s.endsWith('い') ? [s.slice(0, -1) + 'く'] : [])]],
  [/(?:んだ|んで)$/, s => [s + 'む', s + 'ぶ', s + 'ぬ']],
  [/(?:いた|いて)$/, s => [s + 'く', s + 'いる']],
  [/(?:いだ|いで)$/, s => [s + 'ぐ']],
  [/(?:した|して)$/, s => [s + 'す', s + 'する', s]],
  [/(?:た|て)$/, s => [s + 'る', ...(s === 'き' ? ['来る'] : [])]],
  [/(?:れば)$/, s => [s + 'る']],
  [/(?:ば)$/, s => JA_E[s.slice(-1)] ? [s.slice(0, -1) + JA_E[s.slice(-1)]] : []],
  [/(?:かったです|かった|くない|くなかった|くて|ければ|く|さ|くなる)$/, s => [s + 'い']],
  [/(?:られる|られた|れる|れた|させる|させた|せる|せた)$/, s => [s + 'る', ...(JA_A[s.slice(-1)] ? [s.slice(0, -1) + JA_A[s.slice(-1)]] : [])]],
];
function jaDeinflect(w) {
  const out = new Set([w]);
  let layer = [w];
  for (let d = 0; d < 2; d++) {
    const nx = [];
    for (const x of layer) for (const [re, f] of JA_RULES) { const m = x.match(re); if (m) for (const y of f(x.slice(0, m.index))) if (y && !out.has(y)) { out.add(y); nx.push(y); } }
    layer = nx;
  }
  return [...out];
}
const JA_HASKJ = /[㐀-鿿々ァ-ヶー]/;
function jaLook(cand) {
  if (cand.length < 2 && !/[㐀-鿿々]/.test(cand)) return null;   // 单个假名（は、が、の…）不查
  if (/[、。「」『』！？!?（）()…\s０-９0-9]/.test(cand) || JA_STOP.has(cand) || /^を/.test(cand)) return null;
  const forms = jaDeinflect(cand);
  const kanaOnly = !JA_HASKJ.test(cand);
  for (const f of forms) {
    const v = wordIndex().get(f);
    if (v && (!kanaOnly || !JA_HASKJ.test(v.w) || f === v.r)) return forms;
  }
  const jm = jmIndex();
  if (jm && !kanaOnly) for (const f of forms) if (jm.get(f)) return forms;   // 纯假名只查本站词表（JMdict 的假名词条太多，会把助词连起来）
  return null;
}
// 分词：[[起点, 终点, 查词形式|null], …]
function jaSeg(jp) {
  const out = [];
  for (let i = 0; i < jp.length;) {
    let hit = null;
    // 紧跟在词后面、以助词开头的假名串（そちら|はいかが）不当成词
    const afterWord = out.length && out[out.length - 1][2] && /[はがをにでともへのやか]/.test(jp[i]);
    for (let j = Math.min(jp.length, i + 10); j > i; j--) { const c = jp.slice(i, j); if (afterWord && !JA_HASKJ.test(c[0])) break; const f = jaLook(c); if (f) { hit = [i, j, f]; break; } }
    if (hit) { out.push(hit); i = hit[1]; }
    else { if (out.length && !out[out.length - 1][2]) out[out.length - 1][1]++; else out.push([i, i + 1, null]); i++; }
  }
  return out;
}
// 例句 HTML：假名照常标；查得到的词画线、可以点；[a, b) 范围（这个单词 / 这条语法）照常高亮
function jaTapHTML(jp, furi, a = -1, b = -1) {
  if (!jp) return '';
  let segs = jaSeg(jp);
  const notes = (furi || '').split(',').map(x => x.match(/^(\d+)\.(\d+)(.*)$/)).filter(Boolean).map(m => [+m[1], +m[2], m[3]]);
  // 假名标注跨过分词边界时（汉字词被切开）把两块并起来
  const merged = [];
  for (const s of segs) {
    const p = merged[merged.length - 1];
    if (p && notes.some(([x, n]) => x < s[0] && x + n > s[0])) { p[1] = s[1]; p[2] = p[2] || s[2]; } else merged.push(s.slice());
  }
  segs = merged;
  return segs.map(([s, e, f]) => {
    const sub = jp.slice(s, e);
    const fu = notes.filter(([x, n]) => x >= s && x + n <= e).map(([x, n, r]) => `${x - s}.${n}${r}`).join(',');
    const inner = furiHTML(sub, fu, a >= 0 ? Math.max(0, a - s) : -1, a >= 0 && b > s && a < e ? Math.min(e, b) - s : -1);
    return f ? `<span class="wd u" data-f="${esc(f.join('|'))}" data-s="${esc(sub)}">${inner}</span>` : inner;
  }).join('');
}
document.addEventListener('click', e => {
  const el = e.target.closest('.jtap .wd');
  if (!el || el.closest('.hide-jp:not(.shown)')) return;
  e.stopPropagation();
  if (!glossOK()) return;
  document.querySelectorAll('.wd.on').forEach(x => x.classList.remove('on'));
  const [s, r] = wdText(el);
  showSheet(el.dataset.s || s, lookupWord(el.dataset.f.split('|'), null), null, r); el.classList.add('on');
}, true);
