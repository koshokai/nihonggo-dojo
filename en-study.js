'use strict';
/* 英语板块第二批：语法、阅读、听力（A1–C1，中文、日文两种讲解和翻译，跟着 S.enNative / S.enBoth 显示）。
   数据：lang/en-g-<级别>.json（语法）、en-r-<级别>.json（阅读）、en-l-<级别>.json（听力），tools/en/build2.py 生成。
   录音：Kokoro 合成（tools/gen_audio_kokoro.py）。例句、正文句子在 audio/index-en.json（原文 → mp3），
   听力每题一个 mp3（audio/index-en-listen.json：题目 id → mp3，男女声分开）。没有录音的用手机朗读。
   进度：S.enGram {语法 id: 1}（看过）、S.enRead {文章 id: 答对几题}、S.enListen {题目 id: 1 对 / 0 错}。 */

const enCatName = c => ({ life: 'Life', school: 'School', work: 'Work', travel: 'Travel', food: 'Food', nature: 'Nature', science: 'Science', culture: 'Culture', health: 'Health', story: 'Story' })[c] || '';
const EN_CAT = {
  life: ['🏠', '生活', '暮らし'], school: ['🏫', '学校', '学校'], work: ['💼', '工作', '仕事'], travel: ['🧳', '旅行', '旅行'], food: ['🍳', '饮食', '食べ物'],
  nature: ['🌿', '自然', '自然'], science: ['🔬', '科学', '科学'], culture: ['🎎', '文化', '文化'], health: ['🏃', '健康', '健康'], story: ['📖', '故事', 'ストーリー']
};
const EN_SPK = { M: 'Man', F: 'Woman', M2: 'Man 2', F2: 'Woman 2' };
const enNat = (zh, ja) => enJa() ? ja : zh;               // 母语那一种
const enOther = (zh, ja) => enJa() ? zh : ja;             // 另一种（「两种都显示」时用小字）
const enTr = (zh, ja, cls = 'small') => `<div class="${cls}">${esc(enNat(zh, ja))}</div>${S.enBoth ? `<div class="${cls} muted" lang="${enJa() ? 'zh-CN' : 'ja'}">${esc(enOther(zh, ja))}</div>` : ''}`;
const enLvSeg = (lv, base) => `<div class="seg read-lv" role="group" aria-label="${'Level'}">${EN_LV.map(k => `<a role="button" href="#en/${base}/${k}" class="${k === lv ? 'on' : ''}">${k}</a>`).join('')}</div>`;
// 会员部分：公开站上只有标题（tools/en/build2.py 的 lock 占位），用一张「还有更多」的卡片带到会员页
const enFree = all => all.filter(x => !x.lock), enLocked = all => all.filter(x => x.lock);
function enMore(locked, kind) {
  if (!locked.length) return '';
  const n = locked.length, names = locked.slice(0, 3).map(x => kind === 'r' ? `<span lang="en">“${esc(x.title)}”</span>` : kind === 'g' ? esc(enNat(x.title_zh, x.title_ja)) : '').filter(Boolean);
  const what = { g: 'More grammar points', r: 'More stories', l: 'More listening dialogues' }[kind];
  return `<a class="panel wk-more en-more" href="#vip"><div class="wk-more-t">✨ ${'There\'s lots more to enjoy'}</div>
    <div class="small">${what}${names.length ? ', like ' + names.join(', ') + ' and more' : ''}</div><div class="wk-more-go">${'Become a member to unlock ›'}</div></a>`;
}
const enLoadFail = () => `<p class="muted">${'Couldn\'t load. Please check your connection and try again.'}</p>`;
function enSetLevel(lv) { if (lv !== S.enLevel) { S.enLevel = lv; save(); const c = document.getElementById('chip-lv'); if (c) c.textContent = lv; } }

/* ---------- 连续播放：一句一句读（阅读全文、听力对话没有整段录音时） ---------- */
let enSeqTok = 0;
const enRate = () => Math.min(1.3, Math.max(.6, (S.rate || .8) + .2));
function enStop() { enSeqTok++; try { stopSpeech(); } catch (e) { /* 忽略 */ } const el = langPlayer(); el.onended = el.onerror = null; el.pause(); }
window.addEventListener('hashchange', () => enStop());
// 没有录音的句子：不用手机朗读，跳过（接着播下一句）
function enTTS(text, spk, end) { noVoice(end); }
// 播一个录音文件；失败时 fail()（只调用一次）
function enPlayFile(file, end, fail) {
  const el = langPlayer();
  let over = false; const once = f => () => { if (!over) { over = true; el.onended = el.onerror = null; f(); } };
  el.onended = once(end); el.onerror = once(fail);
  el.src = audUrl(file); el.defaultPlaybackRate = el.playbackRate = enRate();
  el.play().catch(once(fail));
}
// segs：[{t: 英文, spk: 'M'|'F'|'N'…, pause: 秒}]；onItem(i) 用来高亮正在读的句子
function enSeq(segs, { onItem, onEnd } = {}) {
  enStop();
  const tok = ++enSeqTok, idx = (typeof LANG_IDX_READY !== 'undefined' && LANG_IDX_READY.en) || {};
  let i = 0;
  const step = () => {
    if (tok !== enSeqTok) return;
    if (i >= segs.length) { if (onItem) onItem(-1); if (onEnd) onEnd(); return; }
    const it = segs[i]; if (onItem) onItem(i);
    const next = () => { if (tok !== enSeqTok) return; i++; setTimeout(step, (it.pause == null ? .45 : it.pause) * 1000); };
    const tts = () => { if (tok === enSeqTok) enTTS(it.t, it.spk, next); };
    const f = S.voiceSrc !== 'tts' && idx[it.t];
    if (f) enPlayFile(f, next, tts);
    // 会员内容的录音在私有存储里：取临时地址再放
    else if (S.voiceSrc !== 'tts' && typeof memberTextAudio === 'function' && isMember('en')) (langUnlock(), memberTextAudio('en', it.t)).then(u => { if (tok !== enSeqTok) return; if (u) enPlayFile(u, next, tts); else tts(); }, tts);
    else tts();
  };
  step();   // 第一句必须在点击当下开始（iPhone）
  return tok;
}

/* ---------- 阅读 · 听力 · 语法 入口 ---------- */
function enRI() {
  const lv = enLevel();
  const p = h(`<section class="panel"><div class="row between"><h2>Learn</h2><span class="tag">${lv}</span></div>
    <p class="small muted">${'Organized by CEFR level, with explanations and translations in 中文 and 日本語. Change your level at the top right.'}</p>
    <div class="en-hub" data-hub><div class="skel" role="status"><i></i><i></i></div></div></section>`);
  main.append(p);
  p.prepend(enLangBar());
  Promise.all([enFetch(`en-g-${lv}`), enFetch(`en-r-${lv}`), enFetch(`en-l-${lv}`)].map(x => x.catch(() => []))).then(([g0, r0, l0]) => {
    if (!p.isConnected) return;
    const g = enFree(g0), r = enFree(r0), l = enFree(l0), more = [g0, r0, l0].map(a => enLocked(a).length);
    const gd = g.filter(x => S.enGram && S.enGram[x.id]).length, rd = r.filter(x => S.enRead && x.id in S.enRead).length, ld = l.filter(x => S.enListen && x.id in S.enListen).length;
    p.querySelector('[data-hub]').innerHTML = (typeof enPathPage === 'function' ? `<a class="en-hub-card" href="#en/path/${lv}"><span class="ic">関</span><span><b>Learning path</b><span class="small muted">${enNat('一关一关学单词，3 条命闯关', 'ステージをクリアしながら単語を覚える')}</span></span></a>` : '') + [
      ['grammar', '文', 'Grammar', 'Explanations, examples, quizzes', gd, g.length],
      ['read', '読', 'Reading', 'Audio, translations, key words, questions', rd, r.length],
      ['listen', '聴', 'Listening', 'Listen, answer, then read the script', ld, l.length]
    ].map(([k, ic, t, d, n, all], j) => `<a class="en-hub-card" href="#en/${k}/${lv}"><span class="ic">${ic}</span><span><b>${t}</b><span class="small muted">${d}${more[j] ? ` <span class="en-plus">More for members</span>` : ''}</span></span></a>`).join('')
      // 情景课程、商务英语（en-course.js；不分级别）
      + (typeof enCoursePage === 'function' ? [
        ['course', '話', 'Scenario course', enNat('在美国生活、工作的真实场景：对话、讲解、生词、文化', 'アメリカの暮らしと仕事の場面：会話・解説・単語・文化メモ')],
        ['biz', '商', 'Business English', enNat('商务邮件范文和商务词汇', 'ビジネスメールの文例とビジネス単語')]
      ].map(([k, ic, t, d]) => `<a class="en-hub-card" href="#en/${k}"><span class="ic">${ic}</span><span><b>${t}</b><span class="small muted">${esc(d)}${typeof isMember === 'function' && isMember('en') ? '' : ` <span class="en-plus">More for members</span>`}</span></span></a>`).join('') : '')
      // 听写、翻译练习、字母音标（practice2.js）
      + [['dictation', '写', 'Dictation', enNat('听一句，写一句，自动比对', '1 文聞いて書き取る・自動で答え合わせ')],
        ['trans', '訳', 'Translation', enNat('中英互译，看答案自己打分', '日本語⇄英語を訳して自己採点')],
        ['dict', '辞', 'Dictionary', enNat('查单词：英语、中文都能搜', '英単語を検索（日本語の意味でも OK）')],
        ['abc', 'Aa', 'Letters & sounds', enNat('字母和音标，点一下听发音', 'アルファベットと発音記号・タップで発音')]
      ].map(([k, ic, t, d]) => `<a class="en-hub-card" href="#en/${k}"><span class="ic">${ic}</span><span><b>${t}</b><span class="small muted">${esc(d)}</span></span></a>`).join('')
      // 三种语言共用的页面（和日语「学习」、中文「学ぶ」一样放入口）
      + [['#check', '测', 'Level check', enNat('20 题测出现在的水平和进步', '20 問で今の実力と伸びをチェック')],
        ['#duel', '战', 'Duel', enNat('和正在学英语的人比单词速答', '英語を学ぶ人と単語スピード対戦')],
        ['#commute', '通', 'Commute listening', enNat('不用看屏幕，边走边听', '画面を見ずに聞き流し')],
        ['#fav', '★', 'Favorites', enNat('收藏的单词和句子', '保存した単語・文')],
        ['#buddy', '伴', 'Study buddy', enNat('和伙伴一起坚持、互相提醒', '仲間と一緒に続ける・つつく')]
      ].map(([href, ic, t, d]) => `<a class="en-hub-card" href="${href}"><span class="ic">${ic}</span><span><b>${t}</b><span class="small muted">${esc(d)}</span></span></a>`).join('');
  });
}

/* ---------- 语法 ---------- */
function enGrammarPage(lvArg) {
  const lv = EN_LV.includes(lvArg) ? lvArg : enLevel();
  enSetLevel(lv);
  const p = h('<section class="panel"><div class="skel" role="status"><i></i><i></i><i></i></div></section>');
  main.append(p);
  enFetch(`en-g-${lv}`).then(all => {
    if (!p.isConnected) return;
    const list = enFree(all), locked = enLocked(all);
    S.enGram = S.enGram || {};
    const seen = list.filter(x => S.enGram[x.id]).length;
    p.innerHTML = `<div class="row between"><h2>${'Grammar'} · ${lv}</h2><a class="small" href="#en/ri">${'Back'}</a></div>
      ${enLvSeg(lv, 'grammar')}
      <div class="row"><button class="btn pri" type="button" data-gq>${'Grammar quiz (10)'}</button></div>
      <div class="en-list">${list.map((x, i) => `<details class="en-row en-g" data-i="${i}"><summary><span class="en-gn">${i + 1}</span><span class="en-m"><b>${esc(enNat(x.title_zh, x.title_ja))}${x.vip ? vipTag('inl') : ''}</b>${S.enBoth ? `<span class="en-gl2">${esc(enOther(x.title_zh, x.title_ja))}</span>` : ''}</span>${S.enGram[x.id] ? `<span class="tag done">${'Studied'}</span>` : ''}</summary>
        <div class="en-body">
          <div class="en-form"><span class="small muted">${'Form'}</span> ${esc(enNat(x.form, x.form_ja))}</div>
          ${enTr(x.explain_zh, x.explain_ja, 'en-exp')}
          <div class="en-tip"><b>${'Watch out'}</b>${enTr(x.tip_zh, x.tip_ja, 'en-tip-t')}</div>
          ${x.ex.map(([e, z, j]) => `<div class="en-ex"><div class="en-ex-en" lang="en">${enTap(e)} ${exSayBtn(e, 'en-US')}${enExBtns(e, enNat(z, j))}</div>${enTr(z, j)}</div>`).join('')}
          <div class="row"><button class="btn" type="button" data-q1="${i}">${'Try 2 questions'}</button></div>
        </div></details>`).join('')}</div>${enMore(locked, 'g')}`;
    p.prepend(enLangBar());
    p.querySelectorAll('details.en-g').forEach(d => { d.ontoggle = () => { if (d.open) { const x = list[+d.dataset.i]; if (!enDay().g) enDayMark('g'); if (typeof actLog === 'function') actLog('g', 'en'); if (!S.enGram[x.id]) { S.enGram[x.id] = 1; save(); } } }; });
    if (enOpenG) { const k = list.findIndex(x => x.id === enOpenG), d = k >= 0 && p.querySelector(`details.en-g[data-i="${k}"]`); enOpenG = null; if (d) { d.open = true; setTimeout(() => d.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' }), 50); } }
    p.querySelector('[data-gq]').onclick = () => enGramQuiz(list, sample(list.flatMap(x => x.quiz.map(q => [x, q])), 10), `${lv} ${'Grammar quiz'}`);
    p.querySelectorAll('[data-q1]').forEach(b => { b.onclick = () => { const x = list[+b.dataset.q1]; enGramQuiz(list, x.quiz.map(q => [x, q]), enNat(x.title_zh, x.title_ja)); }; });
  }).catch(() => { if (p.isConnected) p.innerHTML = `<h2>${'Grammar'}</h2>${enLoadFail()}`; });
}
function enGramQuiz(list, pairs, title) {
  const qs = pairs.map(([x, q]) => {
    const options = shuffle(q.slice(1, 5)), full = q[0].replace(/_{3,}/, q[1]);
    return { kind: 'en-gram', options, optLang: 'en', answer: options.indexOf(q[1]), say: full, sayLang: 'en-US',
      prompt: `<div class="eyebrow">${'Fill in the blank'}</div><div class="q-sent" lang="en">${esc(q[0]).replace(/_{3,}/, '<span class="blank">　　　</span>')}</div><div class="small muted">${esc(enNat(x.title_zh, x.title_ja))}</div>`,
      explain: `<div lang="en"><b>${esc(full)}</b></div>${enTr(q[5], q[6])}` };
  });
  main.innerHTML = '';
  const host = h('<div></div>'); main.append(host);
  runQuiz(host, qs, { title, noRecord: true, xpEach: 5, act: ['g', 'en'], onDone: r => { if (!r) { render(); return; } quizSummary(host, r, { title, again: () => enGramQuiz(list, pairs.length === 2 ? pairs : sample(list.flatMap(x => x.quiz.map(q => [x, q])), 10), title) }); } });
}

/* ---------- 阅读 ---------- */
const enArtImg = a => a.ph ? `<img class="rc-photo" src="${esc(a.ph[0])}" alt="${esc(a.title)}" loading="lazy" decoding="async">`
  : `<div class="rc-ph-none"><span>${(EN_CAT[a.cat] || ['📖'])[0]}</span><b>${esc(enCatName(a.cat))}</b></div>`;
function enReadPage(arg) {
  if (/^r-/.test(arg || '')) return enArticle(arg);
  const lv = EN_LV.includes(arg) ? arg : enLevel();
  enSetLevel(lv);
  const p = h('<section class="panel"><div class="skel" role="status"><i></i><i></i><i></i></div></section>');
  main.append(p);
  enFetch(`en-r-${lv}`).then(all => {
    if (!p.isConnected) return;
    const list = enFree(all), locked = enLocked(all);
    S.enRead = S.enRead || {};
    p.innerHTML = `<div class="row between"><h2>${'Reading'} · ${lv}</h2><a class="small" href="#en/ri">${'Back'}</a></div>
      ${enLvSeg(lv, 'read')}
      <p class="small muted">Read, then answer 3 questions.</p>
      <div class="read-grid">${list.map(a => `<a class="read-card has-vip" href="#en/read/${a.id}">${a.vip ? vipTag() : ''}<div class="rc-img">${enArtImg(a)}</div><div class="rc-body"><b lang="en">${esc(a.title)}</b><span class="small muted">${esc(enNat(a.title_zh, a.title_ja))}</span><span class="small">${(EN_CAT[a.cat] || ['📖'])[0]} ${esc(enCatName(a.cat))}${a.id in S.enRead ? ` · <span class="tag done">${S.enRead[a.id]}/3</span>` : ''}</span></div></a>`).join('')}</div>${enMore(locked, 'r')}`;
    p.prepend(enLangBar());
  }).catch(() => { if (p.isConnected) p.innerHTML = `<h2>${'Reading'}</h2>${enLoadFail()}`; });
}
function enArticle(id) {
  const lv = (id.match(/^r-(\w\d)-/) || [])[1];
  if (!EN_LV.includes(lv)) { location.replace('#en/read'); return; }
  const p = h('<section class="panel"><div class="skel" role="status"><i></i><i></i><i></i></div></section>');
  main.append(p);
  enFetch(`en-r-${lv}`).then(list => {
    if (!p.isConnected) return;
    const a = list.find(x => x.id === id);
    if (!a) { location.replace(`#en/read/${lv}`); return; }
    if (a.lock) { location.replace('#vip'); return; }   // 会员文章：公开站上没有正文
    S.enRead = S.enRead || {};
    const sents = a.p.flat(), showTr = S.enRT !== false;
    let k = 0;
    p.innerHTML = `<div class="row between"><a class="small" href="#en/read/${lv}">← ${'All stories'}</a><span class="tag">${lv} · ${(EN_CAT[a.cat] || ['📖'])[0]} ${esc(enCatName(a.cat))}</span></div>
      ${a.ph ? `<figure class="en-fig">${enArtImg(a)}<figcaption class="ph-credit small muted">Photo: ${esc(a.ph[1])} · ${esc(a.ph[2])} · <a href="${esc(a.ph[3])}" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>` : ''}
      <h2 lang="en" class="en-title">${esc(a.title)}</h2>${enTr(a.title_zh, a.title_ja, 'muted')}
      <div class="row"><button class="btn pri" type="button" data-all>▶ ${'Listen to all'}</button><button class="btn" type="button" data-tr>${showTr ? 'Hide translation' : 'Show translation'}</button><label class="switch"><input type="checkbox" data-loop${S.readLoop ? ' checked' : ''}> 🔁 ${'Loop'}</label></div>
      <p class="small muted">${'Tap a sentence to hear it and see its translation.'} ${enNat('打开「Loop」后，全文读完会从头再读；点一句话会反复读这一句，再点一次停止。', '「Loop」をオンにすると、全文を最後まで読んだら最初から繰り返します。1文をタップするとその文を繰り返し、もう一度タップで止まります。')}</p>
      <div class="en-art ${showTr ? '' : 'no-tr'}">${a.p.map(par => `<div class="en-par">${par.map(([e, z, j]) => `<div class="en-s" data-s="${k++}"><span lang="en">${enTap(e)}</span><div class="en-s-tr">${enTr(z, j)}</div></div>`).join('')}</div>`).join('')}</div>
      <h3>${'Key words'}</h3>
      <div class="en-words">${a.w.map(([w, z, j]) => `<div class="en-wd"><span lang="en"><b>${esc(w)}</b></span> ${sayBtn(w, 'en-US')}<span class="small">${esc(enNat(z, j))}${S.enBoth ? ` <span class="muted">${esc(enOther(z, j))}</span>` : ''}</span></div>`).join('')}</div>
      <h3>${'Questions'}</h3>
      <div data-qs></div>`;
    p.prepend(enLangBar());
    const art = p.querySelector('.en-art'), sEls = [...p.querySelectorAll('.en-s')];
    const mark = i => sEls.forEach((el, j) => el.classList.toggle('on', j === i));
    const allBtn = p.querySelector('[data-all]'), loopEl = p.querySelector('[data-loop]');
    let playing = false, repI = -1, run = 0;
    loopEl.onchange = () => { S.readLoop = loopEl.checked; save(); if (!loopEl.checked) repI = -1; };
    const stopAll = () => { run++; enStop(); mark(-1); repI = -1; playing = false; allBtn.textContent = `▶ ${'Listen to all'}`; };
    // 循环播放打开时：点一句反复读这一句，再点一次停止
    sEls.forEach((el, i) => { el.onclick = e => {
      if (e.target.closest('a,button')) return;
      const again = repI === i; stopAll(); el.classList.toggle('show');
      if (loopEl.checked && again) return;
      const r = ++run; repI = loopEl.checked ? i : -1;
      const one = () => enSeq([{ t: sents[i][0] }], { onItem: x => mark(x < 0 ? -1 : i), onEnd: () => { if (r === run && loopEl.checked && repI === i && el.isConnected) setTimeout(() => { if (r === run && repI === i) one(); }, 700); } });
      one();
    }; });
    const playAll = r => enSeq(sents.map(s => ({ t: s[0], pause: .5 })), { onItem: i => { mark(i); if (i >= 0 && sEls[i]) sEls[i].scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); },
      onEnd: () => { if (r !== run) return; if (loopEl.checked && allBtn.isConnected) return setTimeout(() => { if (r === run && playing) playAll(r); }, 1200); playing = false; if (allBtn.isConnected) allBtn.textContent = `▶ ${'Listen to all'}`; } });
    allBtn.onclick = () => {
      if (playing) return stopAll();
      stopAll(); playing = true; allBtn.textContent = `■ ${'Stop'}`;
      playAll(run);
    };
    p.querySelector('[data-tr]').onclick = e => { S.enRT = !(S.enRT !== false); save(); art.classList.toggle('no-tr', !S.enRT); e.target.textContent = S.enRT ? 'Hide translation' : 'Show translation'; };
    // 理解题：选项打乱；3 题都答完记成绩，第一次读完加经验
    const box = p.querySelector('[data-qs]'), picks = [];
    a.q.forEach((q, qi) => {
      const opts = shuffle(q.slice(1));
      const el = h(`<div class="en-q"><p lang="en"><b>${qi + 1}. ${esc(q[0])}</b></p><div class="opts">${opts.map((o, j) => `<button class="opt" type="button" data-o="${j}"><span class="k">${String.fromCharCode(65 + j)}</span><span lang="en">${esc(o)}</span></button>`).join('')}</div></div>`);
      el.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => {
        if (picks[qi] != null) return;
        const j = +b.dataset.o, ok = opts[j] === q[1]; picks[qi] = ok;
        if (typeof weakNote === 'function') weakNote('en', `r:${a.id}:${qi}`, ok, { sk: 'r', l: q[0], m: `${a.title} → ${q[1]}`, href: `#en/read/${a.id}` });   // 我的弱项
        el.querySelectorAll('[data-o]').forEach((x, m) => { x.disabled = true; if (opts[m] === q[1]) x.classList.add('right'); else if (m === j) x.classList.add('wrong'); });
        buzz(ok ? 12 : [30, 50, 30]);
        if (picks.filter(x => x != null).length === a.q.length) {
          const score = picks.filter(Boolean).length, first = !(a.id in S.enRead);
          S.enRead[a.id] = Math.max(score, S.enRead[a.id] || 0); if (typeof actLog === 'function') actLog('r', 'en');
          if (!enDay().r) S.enDay.r = 1;
          if (first) addXP(10 + score * 5); else save();
          const nx = list.slice(list.indexOf(a) + 1).find(x => !x.lock);
          box.append(h(`<div class="feedback ${score === 3 ? 'ok' : 'no'}">${neko(score >= 2 ? 'happy' : 'think', 'mini')}<div class="fb-t"><b>${`${score} / 3 correct`}${first ? ` · +${10 + score * 5} XP` : ''}</b>
            <div class="row" style="margin-top:8px">${nx ? `<a class="btn pri" href="#en/read/${nx.id}">${'Next story'}</a>` : ''}<a class="btn" href="#en/read/${lv}">${'All stories'}</a></div></div></div>`));
        }
      }; });
      box.append(el);
    });
  }).catch(() => { if (p.isConnected) p.innerHTML = `<h2>${'Reading'}</h2>${enLoadFail()}`; });
}

/* ---------- 听力 ---------- */
let EN_LISTEN_IDX = null;
const enListenIdx = () => EN_LISTEN_IDX || (EN_LISTEN_IDX = jsonOr(`${AUD_EN}index-en-listen.json`));
// 和 tools/gen_audio_kokoro.py 的 en_segs() 一样：说明 → 对话 → 问题
const enLSegs = x => [{ t: x.intro, spk: 'N', pause: 1 }, ...x.lines.map(([spk, e], i) => ({ t: e, spk, pause: i === x.lines.length - 1 ? 1 : .45 })), { t: x.q, spk: 'N', pause: 0 }];
function enListenPage(lvArg) {
  const lv = EN_LV.includes(lvArg) ? lvArg : enLevel();
  enSetLevel(lv);
  enListenIdx();
  const p = h('<section class="panel"><div class="skel" role="status"><i></i><i></i><i></i></div></section>');
  main.append(p);
  enFetch(`en-l-${lv}`).then(all => {
    if (!p.isConnected) return;
    const list = enFree(all), locked = enLocked(all);
    S.enListen = S.enListen || {};
    const done = list.filter(x => x.id in S.enListen), right = done.filter(x => S.enListen[x.id]).length;
    p.innerHTML = `<div class="row between"><h2>${'Listening'} · ${lv}</h2><a class="small" href="#en/ri">${'Back'}</a></div>
      ${enLvSeg(lv, 'listen')}
      <div class="row"><button class="btn pri" type="button" data-go>${'Practice (5)'}</button>${done.length > right ? `<button class="btn" type="button" data-wrong>Retry mistakes (${done.length - right})</button>` : ''}</div>
      <p class="small muted">${'Read the question, listen to the dialogue, choose an answer, then check the script and explanation.'}</p>
      <div class="en-list">${list.map((x, i) => `<button type="button" class="en-lrow" data-one="${i}"><span class="en-gn">${i + 1}</span><span lang="en" class="small">${esc(x.intro)}${x.vip ? vipTag('inl') : ''}</span>${x.id in S.enListen ? `<span class="tag ${S.enListen[x.id] ? 'done' : ''}">${S.enListen[x.id] ? '○' : '×'}</span>` : ''}</button>`).join('')}</div>${enMore(locked, 'l')}`;
    p.prepend(enLangBar());
    const title = `${lv} ${'Listening'}`;
    const fresh = () => { const nd = list.filter(x => !(x.id in S.enListen)); return (nd.length >= 5 ? sample(nd, 5) : [...nd, ...sample(list.filter(x => !nd.includes(x)), 5 - nd.length)]); };
    p.querySelector('[data-go]').onclick = () => enRunListen(fresh(), title, fresh);
    const w = p.querySelector('[data-wrong]'); if (w) w.onclick = () => { const wr = () => list.filter(x => S.enListen[x.id] === 0).slice(0, 10); enRunListen(wr(), title, wr); };
    p.querySelectorAll('[data-one]').forEach(b => { b.onclick = () => enRunListen([list[+b.dataset.one]], title, () => [list[(+b.dataset.one + 1) % list.length]]); });
  }).catch(() => { if (p.isConnected) p.innerHTML = `<h2>${'Listening'}</h2>${enLoadFail()}`; });
}
function enRunListen(qs, title, more) {
  if (!qs.length) return toast('No questions');
  let i = 0, score = 0;
  main.innerHTML = '';
  const box = h(`<section class="panel quiz"><div class="row between"><h2>${esc(title)}</h2><button class="btn ghost" type="button" data-exit>${'Quit'}</button></div>
    <div class="progress-top"><span class="small" data-count></span><div class="bar"><i data-bar style="width:0"></i></div></div><div data-stage></div></section>`);
  main.append(box);
  focusMode(true);
  const stage = box.querySelector('[data-stage]');
  const finish = () => { enStop(); keyHandler = null; focusMode(false); render(); };
  box.querySelector('[data-exit]').onclick = finish;
  function show() {
    const x = qs[i];
    let answered = false, playing = false;
    box.querySelector('[data-count]').textContent = `${i + 1} / ${qs.length}`;
    box.querySelector('[data-bar]').style.width = (i / qs.length * 100) + '%';
    stage.innerHTML = `<div class="q-prompt pop"><div class="eyebrow">${'Read the question, then listen'}</div><p lang="en" class="small muted">${esc(x.intro)}</p><div class="q-sent" lang="en">${esc(x.q)}</div>
      <div class="row" style="justify-content:center"><button class="btn pri" type="button" data-play>▶ ${'Play'}</button></div></div>
      <div class="opts">${x.c.map((c, j) => `<button class="opt" type="button" data-o="${j}"><span class="k">${j + 1}</span><span lang="en">${esc(c)}</span></button>`).join('')}</div><div data-fb role="status" aria-live="polite"></div>`;
    const pb = stage.querySelector('[data-play]');
    const setBtn = () => { pb.textContent = playing ? `■ ${'Stop'}` : `▶ ${answered ? 'Listen again' : 'Play'}`; };
    const play = () => {
      if (playing) { enStop(); playing = false; setBtn(); return; }
      playing = true; setBtn();
      const end = () => { playing = false; if (pb.isConnected) setBtn(); };
      const file = EN_LISTEN_IDX && EN_LISTEN_IDX.ready && S.voiceSrc !== 'tts' && EN_LISTEN_IDX.ready[x.id];
      if (!file && x.lock !== 1 && S.voiceSrc !== 'tts' && typeof isMember === 'function' && isMember('en') && typeof memberData === 'function') {
        // 会员题：录音在私有存储里（member.js）
        enStop(); const tok = ++enSeqTok;
        memberData('en', 'audio/en-listen.json').then(m => m && m[x.id] ? memberSign([m[x.id]]).then(u => u[m[x.id]]) : null).catch(() => null).then(u => {
          if (tok !== enSeqTok) return;
          if (u) enPlayFile(u, () => { if (tok === enSeqTok) end(); }, () => { if (tok === enSeqTok) enSeq(enLSegs(x), { onEnd: end }); });
          else enSeq(enLSegs(x), { onEnd: end });
        });
        return;
      }
      if (file) { enStop(); const tok = ++enSeqTok; enPlayFile(file, () => { if (tok === enSeqTok) end(); }, () => { if (tok === enSeqTok) enSeq(enLSegs(x), { onEnd: end }); }); }
      else { enSeq(enLSegs(x), { onEnd: end }); }
    };
    pb.onclick = play;
    stage.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => pick(+b.dataset.o); });
    keyHandler = e => { if (!answered && '1234'.includes(e.key)) pick(+e.key - 1); else if (answered && e.key === 'Enter') next(); else if (e.key === ' ') { e.preventDefault(); play(); } };
    function pick(j) {
      if (answered) return; answered = true;
      const ok = j === x.a; if (ok) score++;
      if (typeof weakNote === 'function') weakNote('en', `l:${x.id}`, ok, { sk: 'l', l: x.q || x.intro || '', m: (x.c || [])[x.a] || '', href: `#en/listen/${String(x.id).split('-')[1] || ''}` });   // 我的弱项
      S.enListen = S.enListen || {}; S.enListen[x.id] = ok ? 1 : 0; enDay().l++; if (typeof actLog === 'function') actLog('l', 'en');
      if (ok) addXP(10); else save();
      buzz(ok ? 12 : [30, 50, 30]);
      setBtn();
      stage.querySelectorAll('[data-o]').forEach((b, k) => { b.disabled = true; if (k === x.a) b.classList.add('right'); else if (k === j) b.classList.add('wrong'); b.querySelector('[lang]').insertAdjacentHTML('beforeend', ` <span class="small muted">${esc(enNat(x.cz[k], x.cj[k]))}</span>`); });
      stage.querySelector('[data-fb]').innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}">${neko(ok ? 'happy' : 'sad', 'mini')}<div class="fb-t"><b>${ok ? 'Correct!' : 'Not quite'}</b>${enTr(x.ex_zh, x.ex_ja, '')}</div></div>
        <details class="ls-details" open><summary>${'Script and translation'}</summary><div class="ls-script">${x.lines.map(([spk, e, z, jj]) => `<p><span class="ls-spk ${spk[0]}">${EN_SPK[spk]}</span><span><span lang="en">${enTap(e)}</span> ${sayBtn(e, 'en-US')}${enTr(z, jj, 'small muted')}</span></p>`).join('')}</div></details>
        <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn pri" type="button" data-next>${i + 1 < qs.length ? 'Next' : 'See results'} (Enter)</button></div>`;
      stage.querySelector('[data-next]').onclick = next;
      requestAnimationFrame(() => stage.querySelector('[data-fb]').scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }));
    }
  }
  function next() {
    enStop();
    if (++i < qs.length) { show(); return; }
    keyHandler = null;
    stage.innerHTML = `<div class="result"><div class="seal pop ${score / qs.length >= .6 ? '' : 'fail'}">${score / qs.length >= .9 ? 'A' : score / qs.length >= .6 ? 'B' : 'C'}</div><div class="rank"><div class="rank-name">${score} / ${qs.length}</div></div></div>
      <div class="row"><button class="btn pri" type="button" data-again>${'Another set'}</button><button class="btn" type="button" data-back>${'Back to listening'}</button></div>`;
    box.querySelector('[data-bar]').style.width = '100%';
    stage.querySelector('[data-again]').onclick = () => { const n = more(); if (n.length) enRunListen(n, title, more); else finish(); };
    stage.querySelector('[data-back]').onclick = finish;
  }
  // 听力录音目录：先加载好（同步可用），点播放时才能在点击当下开始播放
  enListenIdx().then(d => { EN_LISTEN_IDX.ready = d; });
  show();
}

/* ---------- 今日任务：语法、阅读、听力（首页 enHome 用） ---------- */
// S.enDay = { d: 日期, g: 看了语法, r: 读完一篇, l: 今天答了几道听力 }
const enDay = () => { if (!S.enDay || S.enDay.d !== dkey()) S.enDay = { d: dkey(), g: 0, r: 0, l: 0 }; return S.enDay; };
function enDayMark(k) { const d = enDay(); d[k] = (d[k] || 0) + 1; save(); }
let enOpenG = null;   // 从今日任务点进来时，语法页直接展开这一条
function enStudyTasks(lv) {
  return Promise.all([enFetch(`en-g-${lv}`), enFetch(`en-r-${lv}`), enFetch(`en-l-${lv}`)].map(x => x.catch(() => []))).then(([g0, r0, l0]) => {
    const d = enDay(), g = enFree(g0), r = enFree(r0), l = enFree(l0);
    S.enGram = S.enGram || {}; S.enRead = S.enRead || {}; S.enListen = S.enListen || {};
    const ng = g.find(x => !S.enGram[x.id]) || g[0], nr = r.find(x => !(x.id in S.enRead)) || r[0];
    const nl = () => { const nd = l.filter(x => !(x.id in S.enListen)); return nd.length >= 3 ? sample(nd, 3) : [...nd, ...sample(l.filter(x => !nd.includes(x)), 3 - nd.length)]; };
    return [
      ng && { ic: '文', t: 'Study a grammar point', d: enNat(ng.title_zh, ng.title_ja), done: !!d.g, go: () => { enOpenG = ng.id; location.hash = `#en/grammar/${lv}`; } },
      nr && { ic: '読', t: 'Read a story', d: nr.title, dl: 'en', done: !!d.r, go: () => { location.hash = `#en/read/${nr.id}`; } },
      l.length && { ic: '聴', t: 'Listening (3)', d: 'Read the question, then listen', done: d.l >= 3, go: () => enRunListen(nl(), `${lv} ${'Listening'}`, nl) }
    ].filter(Boolean);
  });
}

/* ---------- 定级测试（约 3 分钟）：每级 2 道单词 + 1 道语法，从 A1 往上，连续两级没过就停 ---------- */
// 做完以后一直显示结果，直到离开这一页（做完后页面会因为得到印章、退出做题模式等重画，不能又从头开始测）
let enPlaceLast = null;
addEventListener('hashchange', () => { if (enPlaceLast && !/^#en\/placement/.test(location.hash)) enPlaceLast.show = false; });
function enPlacement() {
  if (enPlaceLast && enPlaceLast.show) return enPlaceResult();
  const lvs = EN_LV.slice();
  main.append(h(`<section class="panel"><div class="skel" role="status"><i></i><i></i></div></section>`));
  Promise.all(lvs.flatMap(l => [enFetch(`en-${l}`), enFetch(`en-g-${l}`)])).then(data => {
    const qs = [];
    lvs.forEach((l, k) => {
      const items = enItems(l, data[k * 2]), gram = enFree(data[k * 2 + 1]);
      sample(items.filter(x => x.pos === 'n' || x.pos === 'v' || x.pos === 'adj'), 2).forEach(x => {
        const right = enGloss(x);
        const opts = shuffle([right, ...sample(items.filter(y => y.pos === x.pos && enGloss(y) !== right), 3).map(enGloss)]);
        qs.push({ kind: 'en-place', lv: l, options: opts, answer: opts.indexOf(right),
          prompt: `<div class="eyebrow">${'Choose the meaning'}</div><div class="q-big" lang="en">${esc(x.w)}</div>`, explain: `<b lang="en">${esc(x.w)}</b> = ${esc(right)}` });
      });
      const gx = sample(gram, 1)[0], q = gx && sample(gx.quiz, 1)[0];
      if (q) {
        const opts = shuffle(q.slice(1, 5));
        qs.push({ kind: 'en-place', lv: l, options: opts, optLang: 'en', answer: opts.indexOf(q[1]),
          prompt: `<div class="eyebrow">${'Fill in the blank'}</div><div class="q-sent" lang="en">${esc(q[0]).replace(/_{3,}/, '<span class="blank">　　　</span>')}</div>`,
          explain: `<div lang="en"><b>${esc(q[0].replace(/_{3,}/, q[1]))}</b></div>${enTr(q[5], q[6])}` });
      }
    });
    main.innerHTML = '';
    const host = h('<div></div>'); main.append(host);
    const title = 'Placement test';
    runQuiz(host, qs, { title, noRecord: true, noWeak: true, xpEach: 2, onDone: r => {
      if (!r) { render(); return; }
      // 每级答对 60% 以上算过；从 A1 往上数，第一个没过的级别就是该学的级别（全过就是 C1）
      const pass = lvs.map(l => { const mine = r.res.filter(x => x.q.lv === l); return mine.length && mine.filter(x => x.ok).length / mine.length >= .6; });
      let k = pass.findIndex(p => !p); if (k < 0) k = lvs.length - 1;
      enPlaceLast = { r, rec: lvs[k], show: true };
      S.enPlaced = Date.now(); enSetLevel(lvs[k]);
      render();
    } });
  }).catch(() => { main.innerHTML = `<section class="panel">${enLoadFail()}</section>`; });
}
function enPlaceResult() {
  const { r, rec } = enPlaceLast, lvs = EN_LV, ex = EN_EXAM[enJa() ? 'ja' : 'zh'], title = 'Placement test';
  const p = h(`<section class="panel"><div class="result"><div class="seal pop">${rec}</div><div class="rank"><div class="eyebrow">${title}</div>
    <div class="rank-name">${`We suggest starting at ${rec}`}</div><p class="muted">${esc(ex[rec] || '')} · ${`${r.score} / ${r.total} correct`}</p></div></div>
    <div class="breakdown">${lvs.map(l => { const mine = r.res.filter(x => x.q.lv === l), ok = mine.filter(x => x.ok).length; return `<div class="bd-row"><span>${l}</span><div class="bar"><i style="width:${mine.length ? ok / mine.length * 100 : 0}%"></i></div><span class="small">${ok}/${mine.length}</span></div>`; }).join('')}</div>
    <p class="small muted">${'Your level is set. You can change it anytime at the top right.'}</p>
    <div class="row"><a class="btn pri" href="#en">${'Start learning'}</a><button class="btn" type="button" data-again>${'Try again'}</button></div></section>`);
  p.querySelector('[data-again]').onclick = () => { enPlaceLast.show = false; render(); };
  main.append(p);
}
