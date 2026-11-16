/* 英语板块（给中文母语者和日语母语者）：级别 A1–C1（CEFR），每个词都有中文和日文释义，例句有中日两种翻译。
   界面语言跟着用户走：S.enNative = 'zh' | 'ja'（第一次进来时按之前在学的语言和手机语言决定，可以在页面上切换）；
   释义默认只显示母语那一种，S.enBoth 打开后两种都显示。
   数据：lang/en-levels.json [[级别, 词数]]、lang/en-<级别>.json [[词, 音标, 词性, 中文, 日文, 例句, 例句中文, 例句日文]]（tools/en/build_words.py 生成）
   词表：A1–B2 来自 CEFR-J Wordlist（東京外国語大学 投野研究室），C1 来自 ECDICT（MIT），音标来自 CMU Pronouncing Dictionary。 */
const EN_LV = ['A1', 'A2', 'B1', 'B2', 'C1'];
// 每一级对应的、用户熟悉的考试（大致对应）
const EN_EXAM = {
  zh: { A1: '入门', A2: '中考', B1: '高考 · 四级', B2: '六级', C1: '考研 · 雅思 7' },
  ja: { A1: '英検 3 級', A2: '英検準 2 級', B1: '英検 2 級', B2: '英検準 1 級', C1: '英検 1 級' }
};
const EN_POS = {
  en: { n: 'n.', v: 'v.', adj: 'adj.', adv: 'adv.', prep: 'prep.', pron: 'pron.', det: 'det.', conj: 'conj.', int: 'interj.', num: 'num.', aux: 'aux.', part: 'part.' },
  zh: { n: '名', v: '动', adj: '形', adv: '副', prep: '介', pron: '代', det: '限定', conj: '连', int: '叹', num: '数', aux: '助动', part: '小品' },
  ja: { n: '名', v: '動', adj: '形', adv: '副', prep: '前', pron: '代', det: '限定', conj: '接', int: '間投', num: '数', aux: '助動', part: '不定詞' }
};
const EN_DATA = {};
// 语法、阅读、听力（en-g / en-r / en-l）：会员读服务器上的完整版（member.js），其他人读网站上的（会员部分只有「锁」占位）
const enPub = name => fetch(`lang/${name}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
// 会员的完整版：和网站上的版本对照，网站上锁着（或没有）的标上 vip，列表里显示 VIP 小字
const enMember = name => memberData('en', `lang/${name}.json`).catch(() => null).then(m => !m ? enPub(name) : enPub(name).catch(() => null).then(pub => {
  const lk = pub && new Map(pub.map(x => [x.id, x.lock]));
  if (lk) for (const x of m) if (lk.get(x.id) || !lk.has(x.id)) x.vip = 1;
  return m;
}));
const enFetch = name => EN_DATA[name] ? Promise.resolve(EN_DATA[name])
  : (/^en-[grl]-/.test(name) && typeof memberData === 'function' ? enMember(name)
    : /^en-(B2|C1)$/.test(name) && typeof memberJson === 'function' ? memberJson('en', `lang/${name}.json`)   // B2、C1 的单词例句是会员内容
    : enPub(name)).then(d => (EN_DATA[name] = d));
const enLevel = () => EN_LV.includes(S.enLevel) ? S.enLevel : 'A1';
const enJa = () => S.enNative === 'ja';
const enT = (zh, ja) => enJa() ? ja : zh;
// 第一次进英语板块：之前在学中文的是日本用户，手机是日语的也是；其余当作中文用户
function enInitNative() {
  if (S.enNative === 'zh' || S.enNative === 'ja') return;
  const devJa = /^ja\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || '');
  S.enNative = S.track === 'zh' || (S.track !== 'ja' && devJa) ? 'ja' : 'zh';
  save();
}
const enItems = (lv, rows) => rows.map(([w, ipa, pos, zh, ja, ex, exzh, exja]) => ({ id: `en|${lv}|${w}|${pos}`, lv, w, ipa, pos, zh, ja, ex, exzh, exja }));
const enGloss = x => enJa() ? x.ja : x.zh;
const enGloss2 = x => enJa() ? x.zh : x.ja;
const enPos = p => (EN_POS.en[p] || p || '');   // 词性用英语缩写（界面以英语为主）
// 释义：母语一种，打开「两种都显示」时另一种用小字
const enGlossHTML = x => `<span class="en-gl">${esc(enGloss(x))}</span>${S.enBoth ? `<span class="en-gl2" lang="${enJa() ? 'zh-CN' : 'ja'}">${esc(enGloss2(x))}</span>` : ''}`;
// 例句后面：跟读（打分）和收藏，和日语、中文的例句一样
const enExBtns = (t, m) => (typeof shadowBtn === 'function' ? shadowBtn(t, t, m, 'en') : '') + (typeof favBtn === 'function' ? favBtn('s', t, m, 'en') : '');
const enExHTML = x => !x.ex ? (['B2', 'C1'].includes(x.lv) && !(typeof isMember === 'function' && isMember('en')) ? `<p class="small muted">${vipTag('inl')} ${enNat('B2、C1 的例句和录音是会员内容', 'B2・C1 の例文と音声はメンバー向けです')} <a href="#vip">›</a></p>` : '') : `<div class="en-ex"><div class="en-ex-en" lang="en">${enTap(x.ex)} ${exSayBtn(x.ex, 'en-US')}${enExBtns(x.ex, enJa() ? x.exja : x.exzh)}</div><div class="small">${esc(enJa() ? x.exja : x.exzh)}</div>${S.enBoth ? `<div class="small muted" lang="${enJa() ? 'zh-CN' : 'ja'}">${esc(enJa() ? x.exzh : x.exja)}</div>` : ''}</div>`;
const enDue = () => Object.keys(S.srs).filter(id => id.startsWith('en|') && S.srs[id].due <= Date.now());
const enLearned = lv => Object.keys(S.srs).filter(id => id.startsWith(`en|${lv}|`) && S.srs[id].r > 0).length;

// 界面语言和释义的切换（中文 / 日本語 / 两种）
function enLangBar() {
  // 只在英语首页显示（其他页面每页都放会占地方；也可以在「我的 → 学习设置」里换）
  if (!/^#en\/?$/.test(location.hash || '')) return document.createComment('lang');
  // 「中文＋日本語」（两种翻译一起显示）先不放出来：功能代码还在（S.enBoth），以后要用把 ['both', '中文＋日本語'] 加回下面的列表
  if (S.enBoth) { S.enBoth = false; save(); }
  const cur = S.enNative;
  // 一看就懂：英文翻成哪种语言（释义、翻译、讲解都跟着这个）
  const p = h(`<div class="seg en-lang" role="group" aria-label="${'Translate English into'}">${[['zh', '中文'], ['ja', '日本語']].map(([k, t]) => `<button type="button" data-el="${k}" class="${k === cur ? 'on' : ''}"><span class="en-from">EN</span><span class="en-arrow" aria-hidden="true">→</span>${t}</button>`).join('')}</div>`);
  p.querySelectorAll('[data-el]').forEach(b => { b.onclick = () => {
    const k = b.dataset.el;
    if (k === 'both') S.enBoth = true; else { S.enBoth = false; S.enNative = k; }
    save(); render();
  }; });
  return p;
}

function viewEnglish(sub) {
  enInitNative();
  enStop(); langAudioIdx('en');   // 例句、正文的录音目录先加载
  if (S.track !== 'en') { S.track = 'en'; save(); applyTrack('en'); }
  const [s0, s1] = (sub || '').split('/');
  if (s0 === 'words') return enWordsPage(s1);
  if (s0 === 'ri' || s0 === 'study') { if (typeof studyHubLang !== 'function') return enRI(); main.append(enLangBar(), studyHubLang('en')); return; }   // 新排版：hub.js
  if (s0 === 'grammar') return enGrammarPage(s1);
  if (s0 === 'read') return enReadPage(s1);
  if (s0 === 'listen') return enListenPage(s1);
  if (s0 === 'placement') return enPlacement();
  if (s0 === 'path' && typeof enPathPage === 'function') return enPathPage(s1);   // 学习路线（en-path.js）
  // 情景课程、商务英语（en-course.js）
  if (s0 === 'course' && typeof enCoursePage === 'function') return enCoursePage(sub.split('/').slice(1));
  if (s0 === 'biz' && typeof enBizPage === 'function') return enBizPage(sub.split('/').slice(1));
  // 字母音标、听写、翻译练习（practice2.js）
  if (s0 === 'week') return w2Page('en', s1);   // 每周精选（week2.js）
  if (s0 === 'dict') return enDictPage();
  if (s0 === 'abc') return enAbcPage();
  if (s0 === 'dictation') return p2Setup('en', 'dict');
  if (s0 === 'trans') return p2Setup('en', 'trans');
  if (s0 === 'exam') return typeof exam2Page === 'function' ? exam2Page('en', s1) : enSoon(s0);   // 模拟考（exam2.js）
  return enHome();
}

// 今日一句（lang/en-daily.json，按日期取，和日语一样一年 366 句）：[英语, 中文, 日语, 中文说明, 日语说明, 分类中, 分类日, 例句, 例句中文, 例句日语]
function enDailyCard(list) {
  const day = new Date(); day.setHours(12, 0, 0, 0);
  const r = list[dailySlot(day) % list.length]; if (!r) return null;
  const x = r.length >= 10 ? { en: r[0], m: enNat(r[1], r[2]), note: enNat(r[3], r[4]), kind: enNat(r[5], r[6]), ex: r[7], exm: enNat(r[8], r[9]) }
    : { en: r[0], m: r[2], note: enJa() ? '' : r[3] };   // 旧格式（只有中文）
  return h(`<div class="proverb daily en-daily">
    <div class="row between"><span class="row"><span class="eyebrow">${enNat('今日一句', '今日のひとこと')}</span>${x.kind ? `<span class="tag">${esc(x.kind)}</span>` : ''}<span class="small muted">${day.getMonth() + 1}月${day.getDate()}日</span></span></div>
    <div class="row"><span class="en-big" lang="en">${enTap(x.en)}</span><span class="row daily-btns">${sayBtn(x.en, 'en-US')}${typeof shadowBtn === 'function' ? shadowBtn(x.en, x.en, x.m, 'en') : ''}</span></div>
    <b>${esc(x.m)}</b>
    ${dailyMore(`${x.note ? `<span class="small muted">${esc(x.note)}</span>` : ''}${x.ex ? `<div class="ex"><div style="flex:1;min-width:0"><div lang="en">${enTap(x.ex)}</div><div class="small muted">${esc(x.exm)}</div></div>${exSayBtn(x.ex, 'en-US')}</div>` : ''}`, enNat('用法和例句', '解説と例文'))}
  </div>`);
}

function enSoon(which) {
  main.append(h(`<section class="panel"><h2>${which === 'ri' ? 'Reading & Listening' : which === 'exam' ? 'Tests' : 'Study'}</h2>
    <p class="muted">${'Practice tests are coming soon. Start with words, grammar, reading and listening!'}</p>
    <a class="btn pri" href="#en/words">${'Study words'}</a></section>`));
}

function enHome() {
  const lv = enLevel(), due = enDue();
  const hr = new Date().getHours();
  const hello = hr < 11 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const head = homeHead(homeHi(hello, 'Ten minutes a day. Finish today\'s tasks and you\'re done.', todayXP(), streak(),
    `${'Learned'} ${Object.keys(S.srs).filter(id => id.startsWith('en|') && S.srs[id].r > 0).length} · ${'To review'} ${due.length}`));
  main.append(head);
  head.append(enLangBar());
  // 和日语首页同样的顺序：问候 → 今日阅读（配照片）→ 今日一句 → 今日任务 → 进度、学习记录、印章（折叠）
  const top = h('<div class="home-top"></div>'); head.append(top);
  Promise.all([enFetch(`en-r-${lv}`).catch(() => []), enFetch('en-daily').catch(() => [])]).then(([rs, daily]) => {
    if (!top.isConnected) return;
    const fr = enFree(rs), a = fr.length && fr[dailySlot(new Date()) % fr.length];
    if (a && !(S.enRead && a.id in S.enRead)) top.append(h(`<a class="today-art" href="#en/read/${a.id}"><div class="ta-img">${enArtImg(a)}</div><div><span class="tag done">${enNat('今日阅读', '今日の読み物')}</span> <span class="tag lv">${lv}</span><div class="rc-title" lang="en">${esc(a.title)}</div><div class="small muted">${esc(enNat(a.title_zh, a.title_ja))}</div></div></a>`));
    const dc = daily.length && enDailyCard(daily); if (dc) top.append(dc);
  });
  const box = h('<div><section class="panel"><div class="skel" role="status"><i></i><i></i></div></section></div>');
  main.append(box);
  Promise.all([enFetch('en-levels'), enFetch(`en-${lv}`)]).then(([meta, rows]) => {
    if (!box.isConnected) return;
    const items = enItems(lv, rows), fresh = items.filter(x => !S.srs[x.id]).slice(0, S.newPerDay || 10);   // 设置里的「每天新单词」
    const dueItems = () => Promise.all(EN_LV.map(l => enFetch(`en-${l}`).then(r => enItems(l, r)).catch(() => []))).then(all => { const ids = new Set(enDue()); return all.flat().filter(x => ids.has(x.id)).slice(0, 50); });
    const tasks = [
      { ic: '復', t: 'Review due words', d: due.length ? `${due.length} word${due.length === 1 ? '' : 's'} ready for review` : 'Nothing to review right now', done: !due.length, go: () => dueItems().then(d => enCards(d, 'Review')) },
      { ic: '新', t: `Learn ${fresh.length || S.newPerDay || 10} new ${lv} words`, d: fresh.length ? fresh.slice(0, 5).map(x => x.w).join(', ') + '…' : 'You finished this level. Try the next one!', done: !fresh.length, go: () => enCards(fresh, `New ${lv} words`) },
      { ic: '測', t: 'Word quiz (10)', d: 'See the word, pick the meaning. Missed words go to review.', go: () => enQuiz(items, `${lv} ${'Quiz'}`) },
      typeof weakTask === 'function' ? weakTask('en') : null   // 专练弱项（weak.js）
    ].filter(Boolean);
    box.innerHTML = '';
    // 第一次来：先推荐做定级测试（做过或者自己换过级别就不再提示）
    const tp = taskPanel('Today\'s tasks', tasks);
    box.append(tp);
    if (typeof w2Card === 'function') box.append(w2Card('en'));   // 每周精选放在今日任务下面
    // 第一次来：在任务下面推荐定级测试
    if (!S.enPlaced && !S.enLevel) box.append(h(`<a class="panel wk-more en-more" href="#en/placement"><div class="wk-more-t">🎯 ${'Not sure where to start?'}</div><div class="small">${'Take a 3-minute placement test and we\'ll pick your level.'}</div><div class="wk-more-go">${'Start the placement test ›'}</div></a>`));
    enStudyTasks(lv).then(more => { if (tp.isConnected && more.length) tp.replaceWith(taskPanel('Today\'s tasks', [...tasks, ...more])); });
    if (typeof buddyStrip === 'function') box.append(buddyStrip());
    // 级别进度放进折叠区（和日语、中文首页一样）
    const ex = EN_EXAM[enJa() ? 'ja' : 'zh'];
    const lvRows = `<p class="small muted">${enNat('级别按 CEFR（A1–C1）划分，后面是大致对应的考试。', 'レベルは CEFR（A1〜C1）。併記の試験は目安です。')}</p><div class="en-lvs">${meta.map(([k, n]) => { const done = enLearned(k); return `<a class="en-lv ${k === lv ? 'on' : ''}" href="#en/words/${k}"><b>${k}</b><span class="small muted">${esc(ex[k] || '')}</span><div class="bar"><i style="width:${n ? done / n * 100 : 0}%"></i></div></a>`; }).join('')}</div>`;
    box.append(...homeBanners());
    box.append(homeFold([homeProgress(), homeRecords(lvRows, enNat('单词进度', '単語の進み具合')), homeStamps()]));
  }).catch(() => { if (box.isConnected) box.innerHTML = `<section class="panel"><p class="muted">${'Couldn\'t load. Please check your connection and try again.'}</p></section>`; });
}

let enQuery = '', enShown = 60;
function enWordsPage(lvArg) {
  const lv = EN_LV.includes(lvArg) ? lvArg : enLevel();
  if (lv !== S.enLevel) { S.enLevel = lv; save(); const c = document.getElementById('chip-lv'); if (c) c.textContent = lv; }
  const p = h('<section class="panel"><div class="skel" role="status"><i></i><i></i><i></i></div></section>');
  main.append(p);
  Promise.all([enFetch('en-levels'), enFetch(`en-${lv}`)]).then(([meta, rows]) => {
    if (!p.isConnected) return;
    const items = enItems(lv, rows), ex = EN_EXAM[enJa() ? 'ja' : 'zh'];
    const q = enQuery.trim().toLowerCase();
    const list = q ? items.filter(x => x.w.toLowerCase().includes(q) || x.zh.includes(q) || x.ja.includes(q)) : items;
    const known = items.filter(x => S.srs[x.id] && S.srs[x.id].r > 0).length, due = items.filter(x => S.srs[x.id] && S.srs[x.id].due <= Date.now());
    p.innerHTML = `<div class="row between"><h2>${'Words'} · ${lv}</h2><span class="small muted">${ex[lv] ? esc(enNat(`约等于 ${ex[lv]}`, `目安：${ex[lv]}`)) : ''}</span></div>
      <div class="seg read-lv" role="group" aria-label="${'Level'}">${meta.map(([k, n]) => `<a role="button" href="#en/words/${k}" class="${k === lv ? 'on' : ''}">${k}</a>`).join('')}</div>
      <div class="stats">
        
        <div class="stat"><span class="small muted">${'Learned'}</span><b>${known}</b></div>
        <div class="stat"><span class="small muted">${'To review'}</span><b>${due.length}</b></div>
      </div>
      <div class="row"><button class="btn pri" type="button" data-cards>Flashcards (review ${Math.min(due.length, 50)} + new 10)</button><button class="btn" type="button" data-quiz>${'Quiz (10)'}</button></div>
      <input type="search" class="lv-q" placeholder="${'Search this level: English / 中文 / 日本語'}" value="${esc(enQuery)}">
      <div class="en-list">${list.slice(0, enShown).map((x, i) => `<details class="en-row"><summary><span class="en-w" lang="en">${esc(x.w)}</span><span class="en-ipa">${esc(x.ipa ? `/${x.ipa}/` : '')}</span><span class="tag">${esc(enPos(x.pos))}</span><span class="en-m">${enGlossHTML(x)}</span>${S.srs[x.id] ? `<span class="tag done">${'Learned'}</span>` : ''}</summary>
        <div class="en-body"><div class="row">${sayBtn(x.w, 'en-US')}${typeof favBtn === 'function' ? favBtn('w', x.w, enGloss(x), 'en') : ''}<button type="button" class="chip-btn" data-add="${i}">${S.srs[x.id] ? 'In your cards' : '+ Add to cards'}</button></div>${enExHTML(x)}</div></details>`).join('')}</div>
      ${list.length > enShown ? `<div class="row" style="justify-content:center"><button class="btn" type="button" data-more>${'Show more'}</button></div>` : ''}
      <p class="small muted">${'Word lists: A1–B2 from the CEFR-J Wordlist (Tono Lab, Tokyo University of Foreign Studies), C1 and the extra dictionary words from ECDICT (MIT). American IPA from the CMU Pronouncing Dictionary. Meanings and example sentences are original.'}</p>`;
    p.prepend(enLangBar());
    const shown = list.slice(0, enShown);
    p.querySelectorAll('[data-add]').forEach(b => { b.onclick = () => { const x = shown[+b.dataset.add]; if (!S.srs[x.id]) { S.srs[x.id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; save(); toast('Added to your cards. You\'ll see it today.'); } b.textContent = 'In your cards'; }; });
    const qi = p.querySelector('.lv-q');
    let tm; qi.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { enQuery = qi.value; enShown = 60; render(); setTimeout(() => { const n = document.querySelector('.lv-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 0); }, 300); };
    const more = p.querySelector('[data-more]'); if (more) more.onclick = () => { enShown += 60; render(); };
    p.querySelector('[data-cards]').onclick = () => {
      const deck = [...due.slice(0, 50), ...items.filter(x => !S.srs[x.id]).slice(0, 10)];
      if (!deck.length) return toast('You\'ve learned every word in this level!');
      enCards(deck, `${lv} ${'Flashcards'}`);
    };
    p.querySelector('[data-quiz]').onclick = () => enQuiz(items, `${lv} ${'Quiz'}`);
  }).catch(() => { if (p.isConnected) p.innerHTML = `<h2>${'Words'}</h2><p class="muted">${'Couldn\'t load. Please check your connection and try again.'}</p>`; });
}

// 单词卡：正面英文 + 音标（自动朗读），翻过来看释义和例句；按记忆程度安排下次复习（和日语单词卡同一套算法）
function enCards(items, title) {
  let queue = items.slice(), done = 0, revealed = false;
  if (!queue.length) return toast('No words to study');
  main.innerHTML = '';
  const box = h(`<section class="panel deck">
    <div class="row between"><h2>${esc(title)}</h2><button class="btn ghost" type="button" data-exit>${'Done'}</button></div>
    <div class="progress-top"><span class="small muted" data-left></span><div class="bar"><i data-bar style="width:0"></i></div></div>
    <div data-stage></div></section>`);
  main.append(box);
  const stage = box.querySelector('[data-stage]');
  focusMode(true);
  const finish = () => { keyHandler = null; focusMode(false); render(); };
  box.querySelector('[data-exit]').onclick = finish;
  function show() {
    const total = done + queue.length;
    box.querySelector('[data-left]').textContent = `${queue.length} left`;
    box.querySelector('[data-bar]').style.width = (total ? done / total * 100 : 100) + '%';
    if (!queue.length) {
      stage.innerHTML = `<div class="card" style="cursor:default"><div class="word">${'All done!'}</div><p class="meaning">${`${done} word${done === 1 ? '' : 's'} in this set. We\'ll remind you when they\'re due for review.`}</p>
        <div class="row" style="justify-content:center;margin-top:12px"><button class="btn pri" type="button" data-back>${'Back'}</button></div></div>`;
      stage.querySelector('[data-back]').onclick = finish;
      return;
    }
    const x = queue[0], c = S.srs[x.id];
    revealed = false;
    stage.innerHTML = `<div class="card" data-card tabindex="0" role="button">
        <span class="corner tag ${c ? 'learn' : ''}">${c ? 'Review' : 'New'}</span>
        <span class="corner-r">${sayBtn(x.w, 'en-US')}</span>
        <div class="word" lang="en">${esc(x.w)}</div>
        <div class="reading en-ipa">${esc(x.ipa ? `/${x.ipa}/` : '')}</div>
        <div data-ans hidden><div class="meaning"><span class="tag">${esc(enPos(x.pos))}</span> ${enGlossHTML(x)}</div>${enExHTML(x)}</div>
        <div class="hint" data-hint>${'Think of the meaning, then tap the card (Space) to check.'}</div></div>
      <div class="grades" data-grades hidden style="margin-top:12px">
        ${['Again', 'Hard', 'Good', 'Easy'].map((t, g) => `<button class="btn g${g}" type="button" data-g="${g}">${t}<small>${fmtDays(preview(c, g))}</small></button>`).join('')}</div>`;
    if (S.autoSpeak) speakLang(x.w, 'en-US');
    const reveal = () => {
      if (revealed) return; revealed = true; fxFlip(stage.querySelector('[data-card]'));
      stage.querySelector('[data-ans]').hidden = false; stage.querySelector('[data-hint]').hidden = true; stage.querySelector('[data-grades]').hidden = false;
    };
    stage.querySelector('[data-card]').onclick = e => { if (!e.target.closest('.speak')) reveal(); };
    stage.querySelectorAll('[data-g]').forEach(b => { b.onclick = () => rate(+b.dataset.g); });
    keyHandler = e => {
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
      else if (revealed && '1234'.includes(e.key)) rate(+e.key - 1);
    };
  }
  function rate(g) {
    const x = queue.shift();
    fxCardOut(stage, g === 0 ? -1 : 1);
    grade(x.id, g);
    if (g === 0) queue.splice(Math.min(queue.length, 3), 0, x); else done++;
    addXP(g === 0 ? 2 : 5);
    save();
    show();
  }
  show();
}

// 测验：看英文选意思（母语）。选项来自同一级的其他词；答错的词加入复习
function enQuiz(items, title) {
  const studied = items.filter(x => S.srs[x.id]);
  const src = studied.length >= 10 ? studied : items.slice(0, Math.max(40, studied.length));
  const qs = sample(src, 10).map(x => {
    const right = enGloss(x);
    // 干扰项：同词性，其中拼写像的词更容易混（B1 以上放 2 个，入门放 1 个）
    const opts = [right, ...nearPick(x, items.filter(y => y.pos === x.pos), (a, y) => enSim(x.w, y.w), enGloss, nearN(x.lv)).map(enGloss)];
    while (opts.length < 4) { const y = sample(items, 1)[0]; if (!opts.includes(enGloss(y))) opts.push(enGloss(y)); }
    const options = shuffle(opts);
    return { kind: 'meaning', options, answer: options.indexOf(right), say: x.w, sayLang: 'en-US', item: x,
      prompt: `<div class="eyebrow">${'Choose the meaning'}</div><div class="q-big" lang="en">${esc(x.w)}</div><div class="small muted">${esc(x.ipa ? `/${x.ipa}/` : '')} · ${esc(enPos(x.pos))}</div>`,
      explain: `<b lang="en">${esc(x.w)}</b> = ${esc(right)}${x.ex ? `<div class="small muted" lang="en">${enTap(x.ex)} ${exSayBtn(x.ex, 'en-US')}</div>` : ''}` };
  });
  main.innerHTML = '';
  const host = h('<div></div>'); main.append(host);
  runQuiz(host, qs, { title, noRecord: true, xpEach: 5, onDone: r => {
    if (!r) { render(); return; }
    r.res.forEach(y => { if (!y.ok && y.q.item) { const id = y.q.item.id; S.srs[id] = Object.assign({ i: 0, e: 2.5, r: 0 }, S.srs[id], { due: Date.now() }); } });
    save();
    quizSummary(host, r, { title, again: () => enQuiz(items, title) });
  } });
}

// 顶部的级别按钮：点开换级别（和其他语言一样的下拉菜单）
function enLevelMenu(anchor) {
  document.querySelectorAll('.lv-menu').forEach(m => m.remove());
  const lv = enLevel(), r = anchor.getBoundingClientRect(), ex = EN_EXAM[enJa() ? 'ja' : 'zh'];
  const m = h(`<div class="lv-menu" role="menu" style="top:${r.bottom + 6}px;right:${Math.max(8, innerWidth - r.right)}px">
    <div class="small muted">${'Your English level'}</div>
    ${EN_LV.map(k => `<button type="button" role="menuitem" data-lvm="${k}" class="${k === lv ? 'on' : ''}">${k} <span class="small muted">${esc(ex[k])}</span></button>`).join('')}
    <a href="#en/placement" class="small">${'Not sure? Take the placement test'}</a></div>`);
  m.querySelectorAll('[data-lvm]').forEach(b => { b.onclick = () => { S.enLevel = b.dataset.lvm; save(); m.remove(); anchor.textContent = S.enLevel; toast(`Switched to ${S.enLevel}`); if (/^#en\/words/.test(location.hash)) location.hash = `#en/words/${S.enLevel}`; else render(); }; });   // 单词页的地址里带级别，要跟着换
  document.body.append(m);
  m.querySelector('a').onclick = () => m.remove();
  setTimeout(() => document.addEventListener('click', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', off); } }), 0);
}

// 顶部查词框（英语模式）：在 A1–C1 全部单词里查英文、中文、日文
// 单词检索：完全一致 → 开头一致 → 包含（英语、中文、日语意思都能搜）。要先加载好各级词表
// CEFR 以外的常用词（词典用，lang/en-dict.json：[单词, 音标, 中文, 日语]）
let EN_EXT = null;
const enDictExt = () => EN_EXT ? Promise.resolve(EN_EXT) : enPub('en-dict').then(rows => (EN_EXT = rows.map(([w, ipa, zh, ja]) => ({ id: `en|X|${w}|`, lv: '', ext: 1, w, ipa, pos: '', zh, ja })))).catch(() => (EN_EXT = []));
function enHits(q) {
  const ql = q.trim().toLowerCase(), base = EN_LV.flatMap(k => EN_DATA[`en-${k}`] ? enItems(k, EN_DATA[`en-${k}`]) : []), seen = new Set(base.map(x => x.w));
  const all = base.concat((EN_EXT || []).filter(x => !seen.has(x.w)));
  if (!ql) return [];
  // 空格和连字符不区分：take off = takeoff = take-off
  const nz = s => s.toLowerCase().replace(/[\s\-]+/g, ''), nq = nz(ql), W = x => nz(x.w);
  const exact = all.filter(x => W(x) === nq), starts = all.filter(x => W(x) !== nq && W(x).startsWith(nq));
  const rest = all.filter(x => !W(x).startsWith(nq) && (W(x).includes(nq) || (x.zh || '').includes(q.trim()) || (x.ja || '').includes(q.trim())));
  return [...exact, ...starts, ...rest];
}
// 词典页（和日语、中文的词典页一样）：输入就出结果，点一个词打开单词卡（意思、例句、发音、加入复习）
let enDictQ = '';
function enDictPage() {
  const p = h(`<section class="panel zh-dict"><h2>Dictionary</h2>
    <form class="dict-form" data-form role="search"><input type="search" placeholder="${enNat('英语单词，或中文意思', '英単語、または日本語の意味')}" value="${esc(enDictQ)}" aria-label="Search" autocomplete="off" data-in><button class="btn pri" type="submit">${enNat('查', '検索')}</button></form>
    <div class="row small"><span class="muted">${enNat('例：', '例：')}</span>${['apple', 'take off', enNat('机会', '機会'), 'though'].map(w => `<button type="button" class="chip-btn" data-try="${esc(w)}">${esc(w)}</button>`).join('')}</div>
    <p class="small muted" data-st>${enNat('收录 A1–C1 各级单词和更多常用词，点一个词看释义和发音。', 'A1〜C1 の単語とよく使う語を収録。単語をタップすると意味と発音が見られます。')}</p>
    <div class="en-list" data-res></div></section>`);
  main.append(enLangBar(), p);
  const inp = p.querySelector('[data-in]'), res = p.querySelector('[data-res]'), st = p.querySelector('[data-st]');
  const run = () => {
    enDictQ = inp.value;
    if (!inp.value.trim()) { res.innerHTML = ''; return; }
    const hits = enHits(inp.value).slice(0, 30);
    res.innerHTML = hits.length ? hits.map((x, i) => `<button type="button" class="en-lrow" data-i="${i}"><b lang="en">${esc(x.w)}</b><span class="small muted">${x.ext ? enNat('词典', '辞書') : `${esc(x.lv)} · ${esc(enPos(x.pos))}`}</span><span class="small">${esc(enGloss(x))}</span></button>`).join('')
      : `<p class="small muted">${enNat('没有找到。换个拼写或意思试试。', '見つかりませんでした。つづりや意味を変えて試してください。')}</p>`;
    res.querySelectorAll('[data-i]').forEach(b => { b.onclick = e => { e.stopPropagation(); const x = hits[+b.dataset.i]; enSheet(enHits(x.w).filter(y => y.w === x.w)); }; });
  };
  st.insertAdjacentHTML('afterend', '<div class="skel" role="status" data-sk><i></i><i></i></div>');
  Promise.all([...EN_LV.map(k => enFetch(`en-${k}`).catch(() => [])), enDictExt()]).then(() => { const sk = p.querySelector('[data-sk]'); if (sk) sk.remove(); run(); });
  inp.oninput = run;
  p.querySelector('[data-form]').onsubmit = e => { e.preventDefault(); run(); };
  p.querySelectorAll('[data-try]').forEach(b => { b.onclick = () => { inp.value = b.dataset.try; run(); }; });
}
function enSearch(q, drop) {
  const ql = q.trim().toLowerCase();
  if (!ql) { drop.hidden = true; return true; }
  const loaded = EN_LV.every(k => EN_DATA[`en-${k}`]) && EN_EXT;
  if (!loaded) {
    drop.innerHTML = `<div class="small muted" style="padding:10px">${'Loading words…'}</div>`; drop.hidden = false;
    Promise.all([...EN_LV.map(k => enFetch(`en-${k}`).catch(() => [])), enDictExt()]).then(() => { const inp = document.getElementById('gs-q'); if (inp && inp.value.trim().toLowerCase() === ql) enSearch(inp.value, drop); });
    return true;
  }
  const hits = enHits(q).slice(0, 10);
  drop.innerHTML = hits.length ? hits.map(x => `<a class="gs-item" href="#en/words/${x.lv}"><span class="gs-w" lang="en">${esc(x.w)}</span><span class="gs-r">${x.ext ? '' : `${esc(x.lv)} · ${esc(enPos(x.pos))}`}</span><span class="gs-m">${esc(enGloss(x))}</span>${sayBtn(x.w, 'en-US')}</a>`).join('')
    : `<div class="small muted" style="padding:10px">${'No results'}</div>`;
  drop.hidden = false;
  return true;
}

/* ---------- 单词、语法例句：点词看释义 ---------- */
// 全部级别的词表按需加载；查词时把常见词形（复数、过去式、-ing、比较级）还原
let EN_BY = null, enByP = null;
const enIndex = () => enByP || (enByP = Promise.all(EN_LV.map(lv => enFetch(`en-${lv}`).then(rows => enItems(lv, rows)).catch(() => []))).then(all => {
  EN_BY = {}; for (const x of all.flat()) { const k = x.w.toLowerCase(); (EN_BY[k] = EN_BY[k] || []).push(x); } return EN_BY;   // 一个词可能有几个词性（watch n./v.），都列出来
}).catch(e => { enByP = null; throw e; }));
const EN_STOP = new Set('a an the and or but of to in on at by for with from is am are was were be been being it its i you he she we they me him her us them my your his our their this that these those do does did not no so as if than then there here what who which when where how'.split(' '));
function enLemma(w) {
  const x = w.toLowerCase().replace(/[’']s$/, '');
  const c = [x];
  if (x.endsWith('ies')) c.push(x.slice(0, -3) + 'y');
  if (x.endsWith('es')) c.push(x.slice(0, -2));
  if (x.endsWith('s')) c.push(x.slice(0, -1));
  if (x.endsWith('ied')) c.push(x.slice(0, -3) + 'y');
  if (x.endsWith('ed')) c.push(x.slice(0, -2), x.slice(0, -1), x.slice(0, -3));
  if (x.endsWith('ing')) c.push(x.slice(0, -3), x.slice(0, -3) + 'e', x.slice(0, -4));
  if (x.endsWith('er')) c.push(x.slice(0, -2), x.slice(0, -1), x.slice(0, -3));
  if (x.endsWith('est')) c.push(x.slice(0, -3), x.slice(0, -2), x.slice(0, -4));
  if (x.endsWith('ier')) c.push(x.slice(0, -3) + 'y');
  if (x.endsWith('ly')) c.push(x.slice(0, -2));
  return c.find(k => EN_BY[k]) || null;
}
const enSegHTML = s => s.split(/([A-Za-z][A-Za-z'’-]*)/).map((t, i) => {
  if (!(i % 2)) return esc(t);
  const k = !EN_STOP.has(t.toLowerCase()) && enLemma(t);
  return k ? `<span class="zw" data-ew="${esc(k)}">${esc(t)}</span>` : esc(t);
}).join('');
let enTapPending = false;
function enTap(s) {
  if (!s) return '';
  if (EN_BY) return `<span class="etap on">${enSegHTML(s)}</span>`;
  if (!enTapPending) { enTapPending = true; enIndex().then(() => { enTapPending = false; document.querySelectorAll('.etap:not(.on)').forEach(el => { el.innerHTML = enSegHTML(el.textContent); el.classList.add('on'); }); }).catch(() => { enTapPending = false; }); }
  return `<span class="etap">${esc(s)}</span>`;
}
function enSheet(xs) {
  closeSheet();
  const x = xs[0], inDeck = xs.some(y => S.srs[y.id]);
  const sh = h(`<div class="word-sheet" role="dialog" aria-label="Word">
    <button class="ws-x" type="button" aria-label="Close">×</button>
    <div class="row"><span class="ws-w" lang="en">${esc(x.w)}</span>${sayBtn(x.w, 'en-US')}${typeof favBtn === 'function' ? favBtn('w', x.w, enGloss(x), 'en') : ''}${x.lv ? `<span class="tag lv">${x.lv}</span>` : ''}</div>
    <div class="small muted">${esc(x.ipa || '')}</div>
    ${xs.map(y => `<div class="ws-m"><span class="small muted">${esc(enPos(y.pos))}</span> ${enGlossHTML(y)}</div>`).join('')}
    ${x.ex ? `<div class="small"><span lang="en">${enTap(x.ex)}</span> ${exSayBtn(x.ex, 'en-US')}${enExBtns(x.ex, enJa() ? x.exja : x.exzh)}<br><span class="muted">${esc(enJa() ? x.exja : x.exzh)}</span></div>` : ''}
    <div class="row"><button class="btn soft" type="button" data-add ${inDeck ? 'disabled' : ''}>${inDeck ? enT('已在单词卡', '単語カードに追加済み') : enT('+ 单词卡', '+ 単語カード')}</button></div>
  </div>`);
  document.body.append(sh);
  sh.querySelector('.ws-x').onclick = closeSheet;
  const add = sh.querySelector('[data-add]');
  add.onclick = () => { for (const y of xs) if (!S.srs[y.id]) S.srs[y.id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; save(); add.textContent = enT('已加入', '追加しました'); add.disabled = true; };
}
document.addEventListener('click', e => {
  const el = e.target.closest('.etap .zw');
  if (!el || !EN_BY || !EN_BY[el.dataset.ew]) return;
  e.stopPropagation();
  if (!glossOK()) return;
  enSheet(EN_BY[el.dataset.ew]);
}, true);
