// 中国語 · ビジネス中国語：メール・WeChat の文例とビジネス単語（日本語 UI）。
// 数据：lang/zh-biz.json（tools/build_zh_biz.py 生成）。网站上是样本版（第 1 篇范文、第 1 类的前 10 个词），会员用 memberJson 读完整版。
// 路由（zh.js viewZh 转过来）：#zh/biz 文例一覧 · #zh/biz/vocab 単語 · #zh/biz/m/<id> 文例
const ZHB = { p: null, k: null };
let zhBizCat = 0;
const zhBizMem = () => typeof isMember === 'function' && isMember('zh');
// 会员身份变了就重新读（member.js 的 memberChanged 不知道这个缓存）
function zhBizData() {
  const k = zhBizMem();
  if (!ZHB.p || ZHB.k !== k) { ZHB.k = k; ZHB.p = memberJson('zh', 'lang/zh-biz.json').catch(e => { ZHB.p = null; throw e; }); }
  return ZHB.p;
}
const zhBizSt = () => { S.zhBiz = S.zhBiz || {}; S.zhBiz.m = S.zhBiz.m || {}; return S.zhBiz; };
const ZHB_KIND = { mail: ['✉', 'メール'], wechat: ['💬', 'WeChat'] };
// 会员内容的标记：没解锁的（lock）一律显示；会员看到的是自己买到的部分（第 2 篇以后、第 2 类以后、第 11 个词以后）
const zhBizVip = (x, i) => !!(x && x.lock) || (zhBizMem() && i > 0);
const zhBizLockPanel = (title, sub, msg, back) => h(`<section class="panel lock-panel"><a class="small" href="${back}">← ビジネス中国語</a><div class="lock-ic" aria-hidden="true">✨</div>
  <h2>${esc(title)}</h2>${sub ? `<p class="muted" ${ZHL}>${esc(sub)}</p>` : ''}<p>${esc(msg)}</p>
  <div class="row"><a class="btn pri" href="#vip">メンバーについて</a><a class="btn" href="${back}">一覧へ</a></div></section>`);

function zhBizPage(b = '', c = '') {
  const box = zhLoading(); main.append(box);
  zhBizData().then(d => {
    if (!box.isConnected) return;
    if (b === 'm') {
      const i = d.mails.findIndex(x => x.id === c);
      if (i < 0) { box.innerHTML = '<p class="muted">この文例は見つかりませんでした。</p><a class="btn" href="#zh/biz">一覧へ</a>'; return; }
      return box.replaceWith(zhBizMail(d, i));
    }
    const sub = b === 'vocab' ? 'vocab' : 'mail';
    const frag = document.createDocumentFragment();
    frag.append(h(`<section class="panel zbz-head"><h2>ビジネス中国語</h2>
      <p class="muted">中国の取引先・同僚とのやりとりで使えるメールと WeChat の文例、ビジネスでよく使う単語。全文にピンインと日本語訳つき、音声で確認できます。</p>
      <div class="seg" role="tablist">${[['mail', '✉ メール・WeChat', ''], ['vocab', '📒 ビジネス単語', '/vocab']].map(([k, t, path]) => `<a role="tab" href="#zh/biz${path}" class="${sub === k ? 'on' : ''}" aria-selected="${sub === k}">${t}</a>`).join('')}</div></section>`));
    frag.append(sub === 'vocab' ? zhBizVocab(d) : zhBizMails(d));
    box.replaceWith(frag);
  }).catch(() => zhFail(box));
}

/* ---------- 文例一覧 ---------- */
function zhBizMails(d) {
  const done = zhBizSt().m;
  return h(`<section class="panel"><div class="zh-arts">${d.mails.map((m, i) => {
    const [ic, kind] = ZHB_KIND[m.kind] || ZHB_KIND.mail;
    return `<a class="zh-art has-vip ${done[m.id] != null ? 'done' : ''}" href="#zh/biz/m/${esc(m.id)}">${zhBizVip(m, i) ? vipTag() : ''}<span class="course-ic">${ic}</span>
      <div><b>${esc(m.title_ja)}</b><span class="small" ${ZHL}>${esc(m.title_zh)}</span><span class="small muted">${esc(kind)}${m.situation_ja ? ' · ' + esc(m.situation_ja.split('。')[0]) + '。' : ''}</span></div>
      <span class="tag lv">${esc(m.lv || '')}</span>${done[m.id] != null ? '<span class="tag done">学習済み</span>' : ''}</a>`;
  }).join('')}</div>
  ${zhBizMem() ? '' : '<p class="small muted">最初の文例は無料で全文読めます。ほかの文例はメンバー向けです。<a href="#vip">メンバーについて ›</a></p>'}</section>`);
}

// 一句：中文（点词看意思）+ 朗读 + 跟读 + 收藏 / 拼音 / 日语
const zhBizLine = ([zh, py, ja]) => `<div class="zh-sent"><div class="zh-line" ${ZHL}>${zhTap(zh)}${zhSayBtn(zh)}${shadowBtn(zh, py, ja, 'zh')}${favBtn('s', zh, ja, 'zh')}</div>
  <div class="zh-py zbz-py small">${esc(py)}</div><div class="zh-tr small muted">${esc(ja)}</div></div>`;

/* ---------- 文例 ---------- */
function zhBizMail(d, i) {
  const m = d.mails[i];
  if (m.lock) return zhBizLockPanel(m.title_ja, m.title_zh, 'この文例の全文・ピンイン・日本語訳・使えるフレーズ・確認クイズはメンバー向けです。最初の文例は無料で読めます。', '#zh/biz');
  const st = zhBizSt(), [ic, kind] = ZHB_KIND[m.kind] || ZHB_KIND.mail;
  // 空行で段落を分ける
  const paras = [[]];
  for (const l of m.body) { if (l[0]) paras[paras.length - 1].push(l); else if (paras[paras.length - 1].length) paras.push([]); }
  const lines = m.body.filter(l => l[0]);
  const next = d.mails.slice(i + 1).find(x => !x.lock);
  const p = h(`<article class="panel zh-article zbz-mail has-vip">${zhBizVip(m, i) ? vipTag() : ''}
    <a class="small" href="#zh/biz">← ビジネス中国語</a>
    <div class="row"><span class="tag lv">${esc(m.lv || '')}</span><span class="tag">${ic} ${esc(kind)}</span>${st.m[m.id] != null ? '<span class="tag done">学習済み</span>' : ''}</div>
    <h2>${esc(m.title_ja)}</h2><div class="muted" ${ZHL}>${esc(m.title_zh)}</div>
    ${m.situation_ja ? `<p class="zh-memo">${esc(m.situation_ja)}</p>` : ''}
    <div class="ra-tools"><button class="btn pri" type="button" data-play>${SPEAK_SVG}<span>全文を聞く</span></button><button class="btn" type="button" data-copy>中国語をコピー</button></div>
    <div data-tg></div>
    <div class="mail-box zbz-box">
      ${m.subject ? `<div class="mail-subj"><span class="small muted">${m.kind === 'wechat' ? 'トーク' : '件名'}</span> <b ${ZHL}>${esc(m.subject)}</b>${zhSayBtn(m.subject)}</div>` : ''}
      <div class="zh-text">${paras.filter(x => x.length).map(para => `<div class="zh-para">${para.map(zhBizLine).join('')}</div>`).join('')}</div>
    </div>
    ${(m.phrases || []).length ? `<h3>使えるフレーズ</h3><div class="zh-wlist">${m.phrases.map(([zh, py, ja]) => `<div class="zh-wl"><div class="row"><b ${ZHL}>${esc(zh)}</b>${zhSayBtn(zh)}</div><div class="zh-py small">${esc(py)}</div><div class="small">${esc(ja)}</div></div>`).join('')}</div>` : ''}
    ${m.tips_ja ? `<h3>ポイント</h3><p class="zh-memo">${esc(m.tips_ja)}</p>` : ''}
    <div class="row">${(m.quiz || []).length ? `<button class="btn pri" type="button" data-q>確認クイズ（${m.quiz.length}問）</button>` : ''}${next ? `<a class="btn" href="#zh/biz/m/${esc(next.id)}">次の文例</a>` : ''}<a class="btn" href="#zh/biz">一覧へ</a></div>
  </article>`);
  p.querySelector('[data-tg]').append(zhToggles(p));
  let stopPlay = null;
  const playBtn = p.querySelector('[data-play]');
  const stop = () => { if (stopPlay) stopPlay(); stopPlay = null; playBtn.querySelector('span').textContent = '全文を聞く'; };
  playBtn.onclick = () => {
    if (stopPlay) return stop();
    playBtn.querySelector('span').textContent = '停止';
    stopPlay = zhPlayLines(lines.map(l => ['F', l[0]]), stop);
  };
  addEventListener('hashchange', stop, { once: true });
  p.querySelector('[data-copy]').onclick = () => {
    const text = (m.subject ? m.subject + '\n\n' : '') + m.body.map(l => l[0]).join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('コピーしました'), () => toast('コピーできませんでした'));
  };
  const qb = p.querySelector('[data-q]');
  if (qb) qb.onclick = () => {
    stop();
    const qs = m.quiz.map(q => ({ kind: 'meaning', options: q.opts, answer: q.a, optLang: q.opts.some(o => /[一-鿿]/.test(o)) ? 'zh-CN' : '', explain: q.why ? esc(q.why) : '', prompt: `<div class="eyebrow">${esc(m.title_ja)}</div><div class="duel-m">${esc(q.q)}</div>` }));
    zhRunQuiz(qs, m.title_ja, 10, () => go(`zh/biz/m/${m.id}`));
    // 解き終わったら学習済みに（初回だけ経験値）
    const ob = new MutationObserver(() => { if (main.querySelector('[data-again]')) { ob.disconnect(); if (st.m[m.id] == null) { st.m[m.id] = Date.now(); addXP(10); save(); } } if (!document.body.contains(qb) && !main.querySelector('.quiz, [data-again]')) ob.disconnect(); });
    ob.observe(main, { childList: true, subtree: true });
  };
  if (typeof actLog === 'function') actLog('b', 'zh');
  return p;
}

/* ---------- ビジネス単語 ---------- */
function zhBizVocab(d) {
  const cats = d.vocab;
  zhBizCat = Math.min(zhBizCat, cats.length - 1);
  const c = cats[zhBizCat], mem = zhBizMem();
  const p = h(`<section class="panel">
    <div class="row cat-row">${cats.map((x, i) => `<button type="button" class="chip-btn ${i === zhBizCat ? 'on' : ''}" data-vc="${i}">${esc(x.title_ja)}${zhBizVip(x, i) ? vipTag('inl') : ''}</button>`).join('')}</div>
    <div data-body></div></section>`);
  const body = p.querySelector('[data-body]');
  if (c.lock) {
    body.append(zhBizLockPanel(c.title_ja, c.title_zh, `「${c.title_ja}」の単語（ピンイン・例文・音声つき）はメンバー向けです。`, '#zh/biz/vocab'));
  } else {
    body.append(h(`<div><div class="row between"><div><b>${esc(c.title_ja)}</b> <span class="small" ${ZHL}>${esc(c.title_zh)}</span></div>
      ${c.words.length >= 4 ? '<button class="btn pri" type="button" data-quiz>単語テスト 10 問</button>' : ''}</div>
      <div class="zh-list">${c.words.map(([w, py, ja, ex, exja], i) => `<details class="zbz-w"><summary class="zh-row-w"><b ${ZHL}>${esc(w)}${mem && (zhBizCat > 0 || i >= 10) ? vipTag('inl') : ''}</b><span class="zh-py">${esc(py)}</span><span class="zh-ja">${esc(ja)}</span>${zhSayBtn(w)}</summary>
        ${ex ? `<div class="zbz-ex"><div class="row"><span ${ZHL}>${zhTap(ex)}</span>${zhSayBtn(ex)}</div><div class="small muted">${esc(exja || '')}</div></div>` : ''}</details>`).join('')}</div>
      ${c.part && c.n > c.words.length ? `<p class="small muted">${vipTag('inl')} この分野の残りの単語とほかの分野の単語はメンバー向けです。<a href="#vip">メンバーについて ›</a></p>` : ''}</div>`));
    const qb = body.querySelector('[data-quiz]');
    if (qb) qb.onclick = () => zhBizVocabQuiz(c);
  }
  p.querySelectorAll('[data-vc]').forEach(b => { b.onclick = () => { zhBizCat = +b.dataset.vc; render(); }; });
  return p;
}
function zhBizVocabQuiz(c) {
  const short = s => String(s).split('；')[0];
  const all = c.words.filter(x => x[2]);
  const qs = sample(all, Math.min(10, all.length)).map(([w, py, ja]) => {
    const others = sample(all.filter(y => y[0] !== w && short(y[2]) !== short(ja)), 3);
    const explain = `<span ${ZHL}>${esc(w)}</span> ${esc(py)}：${esc(ja)}`;
    return Math.random() < .6
      ? makeQ(null, 'meaning', others.map(y => short(y[2])), short(ja), { prompt: `<div class="eyebrow">この単語の意味は？</div><div class="q-big" ${ZHL}>${esc(w)}</div><div class="small muted">${esc(py)}</div>`, say: w, sayLang: 'zh-CN', explain })
      : makeQ(null, 'word', others.map(y => y[0]), w, { prompt: `<div class="eyebrow">「${esc(short(ja))}」は中国語で？</div>`, optLang: 'zh-CN', say: w, sayLang: 'zh-CN', explain });
  });
  zhRunQuiz(qs, `ビジネス単語 · ${c.title_ja}`, 5, () => go('zh/biz/vocab'));
}
