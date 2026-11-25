'use strict';
/* 英语：情景课程（13 个主题，每课一段对话或独白）和商务英语（商务邮件、商务词汇）。讲解、翻译跟着 S.enNative（中文 / 日本語）。
   路由：#en/course（主题）  #en/course/<主题>（课程列表）  #en/course/<主题>/<课>
        #en/biz（商务邮件）  #en/biz/m/<邮件>  #en/biz/vocab[/<分类>]
   数据：lang/en-course.json（主题和全部课的标题）、lang/en-course-<主题>.json、lang/en-business.json（tools/en/build_course.py 生成）。
   网站上只有免费部分（每个主题第 1 课、第 1 封邮件、第 1 个分类的前 10 个词），其余只有标题（lock: 1）；
   会员用 memberJson() 取服务器上的完整版（同样的路径）。第 2 课以后、第 2 封以后、第 2 个分类以后都是会员内容，卡片右上角显示 VIP。
   录音：enSeq / sayBtn（网站录音 → 会员录音 memberTextAudio → 手机朗读）。
   进度：S.enCourse {课 id: 答对几题}、S.enBizM {邮件 id: 答对几题}。 */

// 读数据：存进 EN_DATA（会员身份变化时 member.js 会清空，重新按身份读取）
const enCoGet = path => {
  const k = 'co:' + path;
  if (EN_DATA[k]) return Promise.resolve(EN_DATA[k]);
  const p = typeof memberJson === 'function' ? memberJson('en', path) : fetch(path).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  return p.then(d => (EN_DATA[k] = d));
};
const enCoMem = () => typeof isMember === 'function' && isMember('en');
const enCoTitle = x => enNat(x.title_zh, x.title_ja);
const enCoType = t => t === 'mono' ? 'Monologue' : 'Dialogue';
// 选项「中文／日本語」两种都有的：只显示母语那一种
const enCoOpt = o => { const k = o.indexOf('／'); return k < 0 ? [o, 'en'] : [enJa() ? o.slice(k + 1) : o.slice(0, k), enJa() ? 'ja' : 'zh-CN']; };
const enCoSkel = () => h('<section class="panel"><div class="skel" role="status"><i></i><i></i><i></i></div></section>');
const enCoFail = (p, t) => { if (p.isConnected) p.innerHTML = `<h2>${t}</h2>${enLoadFail()}`; };
// 会员内容的锁：标题 + 去会员页
function enCoLock(back, backLabel, title, title2, what, free) {
  return h(`<section class="panel lock-panel"><a class="an-back" href="${back}">← ${esc(backLabel)}</a><div class="lock-ic" aria-hidden="true">✨</div>
    <h2 lang="en">${esc(title)}</h2>${title2 ? `<p class="muted">${esc(title2)}</p>` : ''}
    <p>${esc(what)}</p>
    <div class="row"><a class="btn pri" href="#vip">${'Become a member'}</a>${free ? `<a class="btn" href="${free}">${enNat('先学免费的一课', '無料のレッスンを見る')}</a>` : ''}</div></section>`);
}
// 不是会员时，列表下面的「还有更多」
const enCoMore = (n, what) => n && !enCoMem() ? `<a class="panel wk-more en-more" href="#vip"><div class="wk-more-t">✨ ${'There\'s lots more to enjoy'}</div><div class="small">${esc(what)}</div><div class="wk-more-go">${'Become a member to unlock ›'}</div></a>` : '';

// 小测验（课程、邮件共用）：选项打乱，全部答完记成绩；第一次做完加经验
function enCoQuiz(box, qs, done) {
  const picks = [];
  qs.forEach((q, qi) => {
    const order = shuffle(q.opts.map((o, j) => j));
    const el = h(`<div class="en-q"><p><b>${qi + 1}. ${esc(enNat(q.q_zh, q.q_ja))}</b></p><div class="opts">${order.map((j, m) => { const [t, lg] = enCoOpt(q.opts[j]); return `<button class="opt" type="button" data-o="${m}"><span class="k">${String.fromCharCode(65 + m)}</span><span lang="${lg}">${esc(t)}</span></button>`; }).join('')}</div></div>`);
    el.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => {
      if (picks[qi] != null) return;
      const m = +b.dataset.o, ok = order[m] === q.a; picks[qi] = ok;
      el.querySelectorAll('[data-o]').forEach((x, k) => { x.disabled = true; if (order[k] === q.a) x.classList.add('right'); else if (k === m) x.classList.add('wrong'); });
      buzz(ok ? 12 : [30, 50, 30]);
      if (picks.filter(x => x != null).length === qs.length) done(picks.filter(Boolean).length);
    }; });
    box.append(el);
  });
}
const enCoDone = (box, score, n, xp, links) => box.append(h(`<div class="feedback ${score === n ? 'ok' : 'no'}">${neko(score >= n - 1 ? 'happy' : 'think', 'mini')}<div class="fb-t"><b>${`${score} / ${n} correct`}${xp ? ` · +${xp} XP` : ''}</b>
  <div class="row" style="margin-top:8px">${links}</div></div></div>`));

/* ---------- 情景课程 ---------- */
function enCoursePage([tid, lid] = []) {
  if (tid && lid) return enCoLesson(tid, lid);
  if (tid) return enCoTheme(tid);
  const p = enCoSkel(); main.append(p);
  enCoGet('lang/en-course.json').then(list => {
    if (!p.isConnected) return;
    S.enCourse = S.enCourse || {};
    p.innerHTML = `<div class="row between"><h2>${'Scenario course'}</h2><a class="small" href="#en/ri">${'Back'}</a></div>
      <p class="muted">${enNat('跟着在美国生活、工作的主人公，学点餐、购物、看病、交友、上课、上班时真正会说的英语。每课一段对话，配讲解、生词、句型、文化说明和小测验。', 'アメリカで暮らし、働く主人公と一緒に、食事・買い物・病院・友達づくり・授業・仕事で本当に使う英語を学びます。各レッスンに会話、解説、単語、文型、文化メモ、確認クイズつき。')}</p>
      ${enCoMem() ? '' : `<p class="small muted">${enNat('每个主题的第 1 课免费，其余课程是会员内容。', '各テーマの第 1 課は無料。続きのレッスンはメンバー向けです。')}</p>`}
      <div class="course-grid">${list.map(t => {
        const n = t.lessons.filter(l => l.id in S.enCourse).length;
        return `<a class="course-card" href="#en/course/${esc(t.id)}"><span class="course-ic">${esc(t.icon)}</span><div><b>${esc(enCoTitle(t))}</b><div class="small muted">${esc(enNat(t.intro_zh, t.intro_ja))}</div>
          ${n ? `<div class="small muted"><span class="tag done">${'Started'}</span></div>` : ''}</div></a>`;
      }).join('')}</div>`;
    p.prepend(enLangBar());
  }).catch(() => enCoFail(p, 'Scenario course'));
}
function enCoTheme(tid) {
  const p = enCoSkel(); main.append(p);
  enCoGet(`lang/en-course-${tid}.json`).then(t => {
    if (!p.isConnected) return;
    S.enCourse = S.enCourse || {};
    const locked = t.lessons.filter(l => l.lock);
    p.innerHTML = `<a class="an-back" href="#en/course">← ${'All topics'}</a>
      <div class="row"><span class="course-ic">${esc(t.icon)}</span><h2>${esc(enCoTitle(t))}</h2></div>
      <p class="muted">${esc(enNat(t.intro_zh, t.intro_ja))}</p>
      <div class="course-list">${t.lessons.map((l, i) => {
        const d = l.id in S.enCourse;
        return `<a class="course-row has-vip ${d ? 'done' : ''}" href="#en/course/${esc(t.id)}/${esc(l.id)}">${i ? vipTag() : ''}<span class="course-no">${i + 1}</span>
          <div class="course-t"><b lang="en">${esc(l.title_en)}</b><span class="small muted">${esc(enCoTitle(l))} · ${esc(l.lv)} · ${enCoType(l.type)}</span></div>
          ${d ? `<span class="tag done">${S.enCourse[l.id]}/${(l.quiz || []).length || 3}</span>` : !i && !enCoMem() ? `<span class="tag">${'Free'}</span>` : ''}</a>`;
      }).join('')}</div>
      ${enCoMore(locked.length, enNat('这个主题后面还有更多课：主人公的故事继续展开，难度一步步提高。', 'このテーマにはまだ続きがあります。主人公の物語が続き、少しずつレベルアップします。'))}`;
    p.prepend(enLangBar());
  }).catch(() => { if (p.isConnected) { p.remove(); location.replace('#en/course'); } });
}
function enCoLesson(tid, lid) {
  const p = enCoSkel(); main.append(p);
  enCoGet(`lang/en-course-${tid}.json`).then(t => {
    if (!p.isConnected) return;
    const i = t.lessons.findIndex(x => x.id === lid), l = t.lessons[i];
    if (!l) { location.replace(`#en/course/${tid}`); return; }
    if (l.lock) { p.replaceWith(enCoLock(`#en/course/${tid}`, enCoTitle(t), l.title_en, enCoTitle(l), enNat('这一课是会员内容：完整对话、讲解、生词、句型、文化说明和小测验，加入会员即可学习。', 'このレッスンはメンバー向けです。会話、解説、単語、文型、文化メモ、確認クイズのすべてが学べます。'), `#en/course/${tid}/${t.lessons[0].id}`)); return; }
    S.enCourse = S.enCourse || {};
    const who = Object.fromEntries((l.who || []).map(w => [w.k, w])), next = t.lessons[i + 1], showTr = S.enRT !== false;
    const spk = x => (who[x.k] || {}).v || 'F';
    const ctx = enNat(l.context_zh, l.context_ja), cul = enNat(l.culture_zh, l.culture_ja);
    p.className = `panel course-lesson ${showTr ? '' : 'hide-zh'}`;
    p.innerHTML = `<a class="an-back" href="#en/course/${esc(tid)}">← ${esc(enCoTitle(t))}</a>
      <div class="row"><span class="tag lv">${esc(l.lv)}</span><span class="tag">${enCoType(l.type)}</span><span class="small muted">Lesson ${i + 1}</span>${i ? vipTag('inl') : ''}</div>
      <h2 lang="en" class="en-title">${esc(l.title_en)}</h2>${enTr(l.title_zh, l.title_ja, 'muted')}
      <section class="cl-box"><h3>${'Scene'}</h3><p>${esc(enNat(l.scene_zh, l.scene_ja))}</p>
        <div class="cl-who">${(l.who || []).map(w => `<div class="cl-person"><span class="cl-av v-${esc(w.v)}">${esc(w.k)}</span><div><b lang="en">${esc(w.name)}</b><div class="small muted">${esc(enNat(w.role_zh, w.role_ja))}</div></div></div>`).join('')}</div>
        ${l.relation_zh ? `<p class="small cl-rel"><b>${enNat('人物关系：', '二人の関係：')}</b>${esc(enNat(l.relation_zh, l.relation_ja))}</p>` : ''}</section>
      <h3>${l.type === 'mono' ? 'Talk' : 'Dialogue'}</h3>
      <div class="cl-ctrl"><button class="btn pri" type="button" data-all>▶ ${'Listen to all'}</button><button class="btn" type="button" data-tr>${showTr ? 'Hide translation' : 'Show translation'}</button></div>
      <p class="small muted">${'Tap a sentence to hear it. Tap an underlined word to look it up.'}</p>
      <div class="cl-lines">${l.lines.map((x, k) => { const w = who[x.k] || {}; return `<div class="cl-line" data-i="${k}"><span class="cl-av v-${esc(w.v || 'F')}" title="${esc(w.name || '')}">${esc(x.k)}</span>
        <div class="cl-b"><div class="cl-name small muted" lang="en">${esc(w.name || x.k)}</div>
          <div class="cl-jp" lang="en">${enTap(x.en)}</div>
          <div class="cl-zh small">${esc(enNat(x.zh, x.ja))}</div>${S.enBoth ? `<div class="cl-zh small muted">${esc(enOther(x.zh, x.ja))}</div>` : ''}
          ${x.note_zh ? `<details class="cl-note"><summary class="small">${enNat('讲解', '解説')}</summary><p class="small">${esc(enNat(x.note_zh, x.note_ja))}</p></details>` : ''}
          <div class="cl-acts"><button class="speak" type="button" data-cl-say="${k}" aria-label="Play">${SPEAK_SVG}</button></div></div></div>`; }).join('')}</div>
      ${(l.words || []).length ? `<h3>${'Key words'}</h3><div class="cl-words">${l.words.map(([w, z, j]) => `<div class="cl-word"><div class="row"><b lang="en">${esc(w)}</b>${sayBtn(w, 'en-US')}</div><div class="small">${esc(enNat(z, j))}</div></div>`).join('')}</div>` : ''}
      ${(l.patterns || []).length ? `<h3>${'Patterns'}</h3>${l.patterns.map(pt => `<section class="cl-pat"><div class="row"><b lang="en">${esc(pt.p)}</b></div><p class="small">${esc(enNat(pt.zh, pt.ja))}</p>
        ${(pt.ex || []).map(([e, z, j]) => `<div class="en-ex"><div class="en-ex-en" lang="en">${enTap(e)} ${sayBtn(e, 'en-US')}</div>${enTr(z, j)}</div>`).join('')}</section>`).join('')}` : ''}
      ${ctx ? `<h3>${'When to use it'}</h3><p class="zh-memo">${esc(ctx)}</p>` : ''}
      ${cul ? `<h3>${'Culture'}</h3><div class="cl-culture">${esc(cul)}</div>` : ''}
      ${(l.quiz || []).length ? `<h3>${'Quiz'}</h3><div data-qs></div>` : ''}
      <div class="row cl-next">${next ? `<a class="btn pri" href="#en/course/${esc(tid)}/${esc(next.id)}">${'Next'}: <span lang="en">${esc(next.title_en)}</span> →</a>` : `<a class="btn pri" href="#en/course">${'More topics'} →</a>`}</div>`;
    p.prepend(enLangBar());
    // 对话：点一句听一句（每个人物用不同的声音），连续播放时跟着高亮
    const lEls = [...p.querySelectorAll('.cl-line')];
    const mark = k => lEls.forEach((el, j) => el.classList.toggle('on', j === k));
    const one = k => enSeq([{ t: l.lines[k].en, spk: spk(l.lines[k]) }], { onItem: x => mark(x < 0 ? -1 : k) });   // 只放这一句：回报的序号是 0，要换成这一句在全文里的位置
    p.querySelectorAll('[data-cl-say]').forEach(b => { b.onclick = e => { e.stopPropagation(); one(+b.dataset.clSay); }; });
    p.querySelectorAll('.cl-line .cl-jp').forEach(el => { el.onclick = e => { if (e.target.closest('.zw')) return; one(+el.closest('.cl-line').dataset.i); }; });
    const allBtn = p.querySelector('[data-all]');
    let playing = false;
    const allOff = () => { playing = false; if (allBtn.isConnected) allBtn.textContent = `▶ ${'Listen to all'}`; };
    allBtn.onclick = () => {
      if (playing) { enStop(); mark(-1); allOff(); return; }
      playing = true; allBtn.textContent = `■ ${'Stop'}`;
      enSeq(l.lines.map(x => ({ t: x.en, spk: spk(x), pause: .5 })), { onItem: k => { mark(k); if (k >= 0 && lEls[k]) lEls[k].scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); }, onEnd: allOff });
    };
    p.querySelector('[data-tr]').onclick = e => { S.enRT = !(S.enRT !== false); save(); p.classList.toggle('hide-zh', !S.enRT); e.target.textContent = S.enRT ? 'Hide translation' : 'Show translation'; };
    const box = p.querySelector('[data-qs]');
    if (box) enCoQuiz(box, l.quiz, score => {
      const first = !(l.id in S.enCourse), xp = first ? 10 + score * 5 : 0;
      S.enCourse[l.id] = Math.max(score, S.enCourse[l.id] || 0);
      if (typeof actLog === 'function') actLog('c', 'en');
      if (xp) addXP(xp); else save();
      enCoDone(box, score, l.quiz.length, xp, `${next ? `<a class="btn pri" href="#en/course/${esc(tid)}/${esc(next.id)}">${'Next lesson'}</a>` : ''}<a class="btn" href="#en/course/${esc(tid)}">${'All lessons'}</a>`);
    });
  }).catch(() => enCoFail(p, 'Scenario course'));
}

/* ---------- 商务英语 ---------- */
function enBizPage([kind, id] = []) {
  if (kind === 'm' && id) return enBizMail(id);
  const sub = kind === 'vocab' ? 'vocab' : 'mail';
  const head = h(`<section class="panel biz-head">
    <div class="row between"><h2>${'Business English'}</h2><a class="small" href="#en/ri">${'Back'}</a></div>
    <p class="small muted">${enNat('外企工作、和海外客户打交道用得上的英语：常用商务邮件范文和商务词汇，每封邮件、每个例句都有翻译。', '外資系企業や海外の取引先とのやりとりで使える英語。ビジネスメールの文例とビジネス単語。メールも例文もすべて訳つきです。')}</p>
    <div class="seg" role="tablist">${[['mail', '✉️ Email', '#en/biz'], ['vocab', '📒 Words', '#en/biz/vocab'], ['talk', '💬 Talk', '#en/course/biz']].map(([k, t, href]) => `<a role="tab" href="${href}" class="${sub === k ? 'on' : ''}" aria-selected="${sub === k}">${t}</a>`).join('')}</div>
  </section>`);
  main.append(head);
  head.prepend(enLangBar());
  const p = enCoSkel(); main.append(p);
  enCoGet('lang/en-business.json').then(d => {
    if (!p.isConnected) return;
    if (sub === 'vocab') return enBizVocab(p, d.vocab, id);
    S.enBizM = S.enBizM || {};
    const locked = d.mails.filter(m => m.lock);
    p.innerHTML = `<h2>${'Business emails'}</h2>
      <p class="small muted">${enNat('每封邮件：什么时候用、全文和翻译、常用句、写法要点和小测验。', '各メール：使う場面、全文と訳、よく使うフレーズ、書き方のポイント、確認クイズつき。')}</p>
      <div class="course-list">${d.mails.map((m, i) => {
        const dn = m.id in S.enBizM;
        return `<a class="course-row has-vip ${dn ? 'done' : ''}" href="#en/biz/m/${esc(m.id)}">${i ? vipTag() : ''}<span class="course-no">${i + 1}</span>
          <div class="course-t"><b lang="en">${esc(m.title_en)}</b><span class="small muted">${esc(enCoTitle(m))} · ${esc(m.lv)}</span></div>
          ${dn ? `<span class="tag done">${S.enBizM[m.id]}/${(m.quiz || []).length || 3}</span>` : !i && !enCoMem() ? `<span class="tag">${'Free'}</span>` : ''}</a>`;
      }).join('')}</div>
      ${enCoMore(locked.length, enNat('还有更多范文：约时间、催款、道歉、谈判、辞职……', 'ほかにも文例がたくさん：日程調整、催促、お詫び、交渉、退職のあいさつ……'))}`;
  }).catch(() => enCoFail(p, 'Business English'));
}
function enBizMail(id) {
  const p = enCoSkel(); main.append(p);
  enCoGet('lang/en-business.json').then(d => {
    if (!p.isConnected) return;
    const i = d.mails.findIndex(x => x.id === id), m = d.mails[i];
    if (!m) { location.replace('#en/biz'); return; }
    if (m.lock) { p.replaceWith(enCoLock('#en/biz', 'Business emails', m.title_en, enCoTitle(m), enNat('这封邮件的完整范文、常用句、写法要点和小测验是会员内容，加入会员即可学习。', 'このメールの全文、フレーズ、書き方のポイント、確認クイズはメンバー向けです。'), `#en/biz/m/${d.mails[0].id}`)); return; }
    S.enBizM = S.enBizM || {};
    const next = d.mails[i + 1], showTr = S.enRT !== false;
    // 正文：空行分段
    const paras = [[]];
    for (const s of m.body) { if (!s[0]) { if (paras[paras.length - 1].length) paras.push([]); } else paras[paras.length - 1].push(s); }
    if (!paras[paras.length - 1].length) paras.pop();
    const sents = paras.flat();
    let k = 0;
    p.className = 'panel read-art';
    p.innerHTML = `<div class="row between"><a class="small" href="#en/biz">← ${'Business emails'}</a><span class="row"><span class="tag lv">${esc(m.lv)}</span>${i ? vipTag('inl') : ''}</span></div>
      <h2 lang="en" class="en-title">${esc(m.title_en)}</h2>${enTr(m.title_zh, m.title_ja, 'muted')}
      ${m.situation_zh ? `<div class="biz-note"><b>${enNat('什么时候用', '使う場面')}</b><div>${esc(enNat(m.situation_zh, m.situation_ja))}</div></div>` : ''}
      <div class="cl-ctrl"><button class="btn pri" type="button" data-all>▶ ${'Listen to all'}</button><button class="btn" type="button" data-tr>${showTr ? 'Hide translation' : 'Show translation'}</button><button class="btn" type="button" data-copy>${'Copy email'}</button></div>
      <p class="small muted">${'Tap a sentence to hear it and see its translation.'}</p>
      <div class="mail-box"><div class="mail-subj"><span class="muted small">Subject</span> <b lang="en">${esc(m.subject)}</b></div>
        <div class="mail-body en-art ${showTr ? '' : 'no-tr'}">${paras.map(par => `<div class="en-par">${par.map(([e, z, j]) => `<div class="en-s" data-s="${k++}"><span lang="en">${esc(e)}</span><div class="en-s-tr">${enTr(z, j)}</div></div>`).join('')}</div>`).join('')}</div></div>
      ${(m.phrases || []).length ? `<h3>${'Useful phrases'}</h3><div class="en-words">${m.phrases.map(([e, z, j]) => `<div class="en-wd"><span lang="en"><b>${esc(e)}</b></span> ${sayBtn(e, 'en-US')}<span class="small">${esc(enNat(z, j))}</span></div>`).join('')}</div>` : ''}
      ${m.tips_zh ? `<h3>${'Writing tips'}</h3><p class="zh-memo">${esc(enNat(m.tips_zh, m.tips_ja))}</p>` : ''}
      ${(m.quiz || []).length ? `<h3>${'Quiz'}</h3><div data-qs></div>` : ''}`;
    p.prepend(enLangBar());
    const art = p.querySelector('.en-art'), sEls = [...p.querySelectorAll('.en-s')];
    const mark = j => sEls.forEach((el, n) => el.classList.toggle('on', n === j));
    sEls.forEach((el, j) => { el.onclick = e => { if (e.target.closest('a,button')) return; el.classList.toggle('show'); enSeq([{ t: sents[j][0] }], { onItem: x => mark(x < 0 ? -1 : j) }); }; });
    const allBtn = p.querySelector('[data-all]');
    let playing = false;
    const allOff = () => { playing = false; if (allBtn.isConnected) allBtn.textContent = `▶ ${'Listen to all'}`; };
    allBtn.onclick = () => {
      if (playing) { enStop(); mark(-1); allOff(); return; }
      playing = true; allBtn.textContent = `■ ${'Stop'}`;
      enSeq(sents.map(s => ({ t: s[0], pause: .5 })), { onItem: j => { mark(j); if (j >= 0 && sEls[j]) sEls[j].scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); }, onEnd: allOff });
    };
    p.querySelector('[data-tr]').onclick = e => { S.enRT = !(S.enRT !== false); save(); art.classList.toggle('no-tr', !S.enRT); e.target.textContent = S.enRT ? 'Hide translation' : 'Show translation'; };
    p.querySelector('[data-copy]').onclick = () => {
      const text = `Subject: ${m.subject}\n\n` + paras.map(par => par.map(s => s[0]).join('\n')).join('\n\n');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(enNat('已复制，可以粘贴到邮件里修改', 'コピーしました。メールに貼り付けて編集できます')), () => toast(enNat('复制失败，请手动选择文字', 'コピーできませんでした。手動で選択してください')));
    };
    const box = p.querySelector('[data-qs]');
    if (box) enCoQuiz(box, m.quiz, score => {
      const first = !(m.id in S.enBizM), xp = first ? 15 + score * 5 : 0;
      S.enBizM[m.id] = Math.max(score, S.enBizM[m.id] || 0);
      if (typeof actLog === 'function') actLog('b', 'en');
      if (xp) addXP(xp); else save();
      enCoDone(box, score, m.quiz.length, xp, `${next ? `<a class="btn pri" href="#en/biz/m/${esc(next.id)}">${'Next email'}</a>` : ''}<a class="btn" href="#en/biz">${'All emails'}</a>`);
    });
  }).catch(() => enCoFail(p, 'Business English'));
}
// 商务词汇：[词, 音标, 中文, 日文, 例句, 例句中文, 例句日文]
function enBizVocab(p, cats, cid) {
  const ci = Math.max(0, cats.findIndex(c => c.id === cid)), c = cats[ci];
  const words = c.words || [], more = (c.n || words.length) - words.length;
  p.innerHTML = `<h2>${'Business vocabulary'}</h2>
    <div class="row cat-row">${cats.map((x, i) => `<button type="button" class="chip-btn ${i === ci ? 'on' : ''}" data-vc="${esc(x.id)}">${esc(enCoTitle(x))}${i ? vipTag('inl') : ''}</button>`).join('')}</div>
    ${c.lock ? '' : `<div class="row between"><b lang="en">${esc(c.title_en)}</b><button class="btn pri" type="button" data-quiz>${'Quiz (10)'}</button></div>`}
    <div data-body></div>`;
  p.querySelectorAll('[data-vc]').forEach(x => { x.onclick = () => { location.hash = `#en/biz/vocab/${x.dataset.vc}`; }; });
  const body = p.querySelector('[data-body]');
  if (c.lock) { const lk = enCoLock('#en/biz/vocab', 'Business vocabulary', c.title_en, enCoTitle(c), enNat('这个分类的单词和例句是会员内容，加入会员即可学习。', 'このカテゴリーの単語と例文はメンバー向けです。'), `#en/biz/vocab/${cats[0].id}`); lk.classList.remove('panel'); body.append(lk); return; }
  body.innerHTML = `<div class="en-list">${words.map(([w, ipa, z, j, ex, exz, exj], i) => `<details class="en-row"><summary><span class="en-w" lang="en">${esc(w)}</span><span class="en-ipa">${esc(ipa || '')}</span><span class="en-m"><span class="en-gl">${esc(enNat(z, j))}</span>${S.enBoth ? `<span class="en-gl2">${esc(enOther(z, j))}</span>` : ''}</span>${!ci && i >= 10 ? vipTag('inl') : ''}</summary>
    <div class="en-body"><div class="row">${sayBtn(w, 'en-US')}</div>${ex ? `<div class="en-ex"><div class="en-ex-en" lang="en">${enTap(ex)} ${sayBtn(ex, 'en-US')}</div>${enTr(exz, exj)}</div>` : ''}</div></details>`).join('')}</div>
    ${more > 0 ? enCoMore(more, enNat('这个分类的其余单词，以及会议、销售、财务、人事、贸易、IT 等其他分类，都在会员内容里。', 'このカテゴリーの残りの単語と、会議・営業・経理・人事・貿易・IT などほかのカテゴリーもメンバー向けです。')) : ''}`;
  p.querySelector('[data-quiz]').onclick = () => enBizVocabQuiz(c, cats);
}
function enBizVocabQuiz(c, cats) {
  const all = cats.flatMap(x => x.words || []), gl = x => enNat(x[2], x[3]);
  const qs = sample(c.words, Math.min(10, c.words.length)).map(x => {
    const right = gl(x), opts = shuffle([right, ...sample([...new Set(all.map(gl).filter(g => g !== right))], 3)]);
    return { kind: 'en-biz', options: opts, answer: opts.indexOf(right), say: x[0], sayLang: 'en-US',
      prompt: `<div class="eyebrow">${'Choose the meaning'}</div><div class="q-big" lang="en">${esc(x[0])}</div>`,
      explain: `<b lang="en">${esc(x[0])}</b> = ${esc(right)}${x[4] ? `<div class="small"><span lang="en">${esc(x[4])}</span><br><span class="muted">${esc(enNat(x[5], x[6]))}</span></div>` : ''}` };
  });
  main.innerHTML = '';
  const host = h('<div></div>'); main.append(host);
  const title = `Business vocabulary · ${c.title_en}`;
  runQuiz(host, qs, { title, noRecord: true, xpEach: 5, act: ['b', 'en'], onDone: r => { if (!r) { render(); return; } quizSummary(host, r, { title, again: () => enBizVocabQuiz(c, cats) }); } });
}
