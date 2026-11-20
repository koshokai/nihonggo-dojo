// 商务日语：场景会话、敬语、商务邮件、商务词汇。数据在 business.js（tools/build_business.py 生成）。
// 路由：#biz（场景列表）  #biz/s/<id>  #biz/keigo  #biz/mail  #biz/m/<id>  #biz/vocab
const BIZ_CAT_IC = { 职场基础: '🏢', 电话: '📞', 拜访接待: '🤝', 会议: '📊', 报联商: '📝', 道歉拒绝: '🙇', 谈判销售: '💼', 求职面试: '🎓', 应酬: '🍶', 出差: '🚄' };
let bizCat = '', bizVocabCat = 0;
// 这一项是不是会员内容：看网站上的样本版里它是不是锁着（会员拿到的完整版里没有锁的标记；样本版里没有的也是会员内容）
const bizVip = (pub, x) => pub ? !!(pub.find(y => (y.id || y.cat) === (x.id || x.cat)) || { lock: 1 }).lock : !!x.lock;
const bizState = () => { S.biz = S.biz || {}; S.biz.s = S.biz.s || {}; S.biz.m = S.biz.m || {}; return S.biz; };

// 会员：把 BIZ 换成服务器上的完整版（member.js）；不是会员时换回网站上的样本版
let BIZ_PUBLIC = null, BIZ_FULL = false;
function bizMember() {
  if (!BIZ_PUBLIC) BIZ_PUBLIC = JSON.parse(JSON.stringify(BIZ));
  const want = typeof isMember === 'function' && isMember('ja');
  if (!want) { if (BIZ_FULL) { for (const k in BIZ) delete BIZ[k]; Object.assign(BIZ, JSON.parse(JSON.stringify(BIZ_PUBLIC))); BIZ_FULL = false; } return Promise.resolve(false); }
  if (BIZ_FULL) return Promise.resolve(false);
  return memberData('ja', 'business.json').then(d => { if (!d) return false; Object.assign(BIZ, d); BIZ_FULL = true; return true; }).catch(() => false);
}
function viewBiz(arg = '') {
  // 会员第一次打开：先取完整版，取到后重新画
  if (typeof isMember === 'function' && isMember('ja') && !BIZ_FULL) { bizMember().then(ok => { if (ok && location.hash.startsWith('#biz')) render(); }); }
  else if (BIZ_FULL && !(typeof isMember === 'function' && isMember('ja'))) bizMember();
  audioIdx('biz');
  // 会员：商务录音在私有存储里，页面画好后给朗读按钮取好临时地址（展开的分类也一样）
  setTimeout(() => { if (typeof memberAudioScan === 'function') memberAudioScan(main, 'ja', 'ja-biz'); }, 300);
  const [kind, id] = arg.split('/');
  // 场景会话搬进了「情景课程 · 商务日语」（每个角色不同声音，加了生词、句型、文化说明）：旧链接直接跳到对应的课
  if (kind === 's') { const m = /^s-([ab])(\d+)$/.exec(id || ''); if (m) { location.replace(`#course/biz/biz-${String((m[1] === 'b' ? 8 : 0) + +m[2]).padStart(2, '0')}`); return; } }
  if (kind === 'm') { const m = BIZ.mails.find(x => x.id === id); if (m) return bizMail(m); }
  const sub = ['keigo', 'mail', 'vocab'].includes(kind) ? kind : 'scenes';
  const st = bizState();
  const head = h(`<section class="panel biz-head">
    <div class="row between"><h2>商务日语</h2></div>
    <p class="small muted">在日企工作、和日本客户打交道用得上的日语：电话、拜访、会议、道歉、邮件，以及最容易出错的敬语。</p>
    <div class="seg biz-tabs" role="tablist">
      ${[['scenes', '💬 场景会话', ''], ['keigo', '🎎 敬语', 'keigo'], ['mail', '✉️ 商务邮件', 'mail'], ['vocab', '📒 商务词汇', 'vocab']].map(([k, label, path]) => `<a role="tab" href="#biz${path ? '/' + path : ''}" class="${sub === k ? 'on' : ''}" aria-selected="${sub === k}">${label}</a>`).join('')}
    </div>
  </section>`);
  main.append(head);
  ({ scenes: bizToCourse, keigo: bizKeigo, mail: bizMails, vocab: bizVocab })[sub]();
}

/* ---------- 场景会话 → 情景课程 ---------- */
function bizToCourse() {
  main.append(h(`<section class="panel biz-course">
    <h2>💬 场景会话在「情景课程」里</h2>
    <p>商务场景（自我介绍、接电话、拜访、会议、汇报、投诉、谈判、面试……）整理成了情景课程：每个角色不同的声音，逐句假名和中文，生词、句型、什么时候该这样说，以及日本职场的文化说明。现在可以先学第 1 课样课。</p>
    <a class="btn pri big" href="#course/biz">去学商务日语课程 →</a>
  </section>`));
}

/* ---------- 场景会话 ---------- */
function bizScenes() {
  const st = bizState();
  const cats = [...new Set(BIZ.scenes.map(x => x.cat))];
  const bar = h(`<div class="row cat-row">${['', ...cats].map(c => `<button type="button" class="chip-btn ${bizCat === c ? 'on' : ''}" data-cat="${c}">${c ? (BIZ_CAT_IC[c] || '') + ' ' + c : '全部场景'}</button>`).join('')}</div>`);
  const grid = h('<div class="read-grid"></div>');
  for (const sc of BIZ.scenes.filter(x => !bizCat || x.cat === bizCat)) {
    grid.append(h(`<a class="read-card" href="#biz/s/${sc.id}">
      <div class="rc-img">${artImg(sc)}<span class="tag lv">${sc.L}</span>${st.s[sc.id] != null ? '<span class="rc-done">済</span>' : ''}</div>
      <div class="rc-body"><div class="rc-cat">${BIZ_CAT_IC[sc.cat] || ''} ${sc.cat}</div><div class="rc-title" lang="ja">${esc(sc.title)}</div><div class="rc-zh">${esc(sc.zh)}</div>
      ${sc.lock ? `<div class="rc-first small muted">🔒 会员</div>` : `<div class="rc-first" lang="ja">${esc(sc.lines[0][1])}</div>`}</div>
    </a>`));
  }
  main.append(bar, grid);
  bar.querySelectorAll('[data-cat]').forEach(b => { b.onclick = () => { bizCat = b.dataset.cat; render(); }; });
}

// 对话、邮件共用：一句 = 日语（可点词）+ 假名 + 中文；点句子朗读并显示中文
function bizLine(jp, kana, zh, toks, i, f) {
  return `<span class="ra-s" data-i="${i}" tabindex="0" role="button"><span class="ra-jp furi" lang="ja">${toks ? tokHTML(toks, new Map(), f) : jr(jp, kana)}</span><span class="ra-kana" lang="ja">${esc(kana)}</span><span class="ra-zh">${esc(zh)}</span></span>`;
}
function bindLines(p, list) {
  const nodes = [...p.querySelectorAll('.ra-s')];
  const mark = i => nodes.forEach((n, j) => n.classList.toggle('now', j === i));
  let playing = false;
  const playBtn = p.querySelector('[data-play]');
  const stop = () => { playing = false; if (playBtn) playBtn.querySelector('span').textContent = '全文朗读'; stopSpeech(); mark(-1); };
  nodes.forEach((n, i) => {
    const go = e => { const hidden = n.closest('.hide-jp:not(.shown)'); const sm = p.querySelector('[data-shadowmode]'); if (!(sm && sm.checked) && !hidden && e && (e.target.closest('.wd') || String(getSelection()).trim())) return; if (sm && sm.checked) { e && e.stopPropagation(); stop(); n.closest('.bubble-line')?.classList.add('shown'); mark(i); return shadowSheet(n.querySelector('.ra-jp').textContent, list[i], n.querySelector('.ra-zh').textContent); } stop(); n.classList.add('open'); n.closest('.bubble-line')?.classList.add('shown'); mark(i); speak(list[i], { onend: () => mark(-1) }); };
    n.onclick = go; n.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
  const playFrom = i => {
    if (!playing || i >= list.length || !document.body.contains(p)) return stop();
    mark(i); nodes[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    speak(list[i], { onend: () => setTimeout(() => playFrom(i + 1), 300) });
  };
  if (playBtn) playBtn.onclick = () => { if (playing) return stop(); playing = true; playBtn.querySelector('span').textContent = '停止'; playFrom(0); };
  const box = p.querySelector('.ra-text');
  p.querySelector('[data-kana]').onchange = e => box.classList.toggle('show-kana', e.target.checked);
  p.querySelector('[data-zh]').onchange = e => box.classList.toggle('show-zh', e.target.checked);
}
// 读完后的小测验（场景、邮件共用）
function bizQuiz(box, qs, onFinish) {
  let right = 0, answered = 0;
  qs.forEach(([q, ok, ...bad], qi) => {
    const opts = shuffle([ok, ...bad]);
    const card = h(`<div class="ra-q"><div class="ra-qq" lang="ja"><b>${qi + 1}.</b> ${esc(q)}</div><div class="opts">${opts.map(o => `<button type="button" class="opt" lang="ja">${esc(o)}</button>`).join('')}</div></div>`);
    card.querySelectorAll('.opt').forEach(b => {
      b.onclick = () => {
        if (card.dataset.done) return;
        card.dataset.done = 1; answered++;
        if (b.textContent === ok) right++;
        card.querySelectorAll('.opt').forEach(x => { if (x.textContent === ok) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); x.disabled = true; });
        if (answered === qs.length) onFinish(right);
      };
    });
    box.append(card);
  });
}
const phrasesHTML = ph => ph.length ? `<h3>关键表达</h3><div class="ra-words">${ph.map(([e, zh]) => `<div class="ra-word"><span lang="ja" class="rw-w furi jtap">${jrTap(e)}</span>${speakBtn(e)}<span class="rw-m">${esc(zh)}</span></div>`).join('')}</div>` : '';

function bizScene(sc) {
  const st = bizState();
  // 会员场景：公开站只有标题（全文在私有仓库，1.1 会员开放后由服务器提供）
  if (sc.lock) return main.append(h(`<section class="panel"><a class="small" href="#biz">← 返回商务日语</a><h2 lang="ja">${esc(sc.title)}</h2><p class="muted">${esc(sc.zh)}</p>
    <p>🔒 这个场景有更多实用的商务会话，加入会员即可学习。</p><a class="btn pri" href="#biz/s/${BIZ.scenes[0].id}">先学免费场景</a></section>`));
  const speakers = [...new Set(sc.lines.map(l => l[0]))];
  const side = spk => speakers.indexOf(spk) % 2 ? 'r' : 'l';
  let i = 0;
  const p = h(`<article class="panel read-art">
    <div class="ra-hero">${artImg(sc)}</div>${photoCredit(sc)}
    <div class="row between"><a class="small" href="#biz">← 返回商务日语</a><span class="row"><span class="tag lv">${sc.L}</span><span class="tag">${BIZ_CAT_IC[sc.cat] || ''} ${sc.cat}</span>${st.s[sc.id] != null ? '<span class="tag done">已学</span>' : ''}</span></div>
    <h2 class="ra-title" lang="ja">${esc(sc.title)}</h2>
    <div class="muted">${esc(sc.zh)}</div>
    ${sc.note ? `<div class="biz-note"><b>礼仪要点</b><div>${esc(sc.note)}</div></div>` : ''}
    <div class="ra-tools">
      <button class="btn pri" type="button" data-play>${SPEAK_SVG}<span>全文朗读</span></button>
      <label class="switch"><input type="checkbox" data-kana> 假名</label>
      <label class="switch"><input type="checkbox" data-zh> 全部中文</label>
      <label class="switch"><input type="checkbox" data-shadowmode> 🎙 跟读模式</label>
    </div>
    <div class="row small"><span class="muted">角色扮演：</span><div class="seg" role="group">${['', ...speakers].map(s => `<button type="button" data-role="${esc(s)}" class="${s ? '' : 'on'}">${s ? esc(s) : '不扮演'}</button>`).join('')}</div></div>
    <p class="small muted">点一句话朗读并显示中文；画线的词可以点开看释义。选择角色扮演后，那个角色的台词会先隐藏，试着自己说出来再点开对照。</p>
    <div class="ra-text dialog">${sc.lines.map(([spk, jp, kana, toks, zh]) => `<div class="bubble-line ${side(spk)}" data-spk="${esc(spk)}"><div class="spk">${esc(spk)}</div><div class="bubble">${bizLine(jp, kana, zh, toks, i++)}<div class="hint-zh">${esc(zh)}</div></div></div>`).join('')}</div>
    ${phrasesHTML(sc.phr || [])}
    <h3>小测验</h3><div class="ra-quiz"></div>
  </article>`);
  main.append(p);
  bindLines(p, sc.lines.map(l => l[2]));
  bindWords(p, { id: sc.id, title: sc.title, w: [] });
  restoreReadPos();
  p.querySelectorAll('[data-role]').forEach(b => {
    b.onclick = () => {
      p.querySelectorAll('[data-role]').forEach(x => x.classList.toggle('on', x === b));
      p.querySelectorAll('.bubble-line').forEach(l => { l.classList.toggle('hide-jp', !!b.dataset.role && l.dataset.spk === b.dataset.role); l.classList.remove('shown'); });
    };
  });
  const qbox = p.querySelector('.ra-quiz');
  bizQuiz(qbox, sc.q, right => {
    const first = st.s[sc.id] == null;
    st.s[sc.id] = Math.max(st.s[sc.id] || 0, right);
    const xp = first ? 20 + right * 5 : right * 2;
    if (typeof actLog === 'function') actLog('b', 'ja');   // 学习方案：今天学了一段商务日语
    addXP(xp); save();
    if (right === sc.q.length) celebrate();
    const next = BIZ.scenes.find(x => st.s[x.id] == null);
    qbox.append(h(`<div class="ra-done"><b>${right === sc.q.length ? '全对！' : `答对 ${right}/${sc.q.length}`}</b> 获得 ${xp} 经验。
      <div class="row">${next ? `<a class="btn pri" href="#biz/s/${next.id}">下一个场景：<span lang="ja">${esc(next.title)}</span></a>` : ''}<a class="btn" href="#biz">回到列表</a></div></div>`));
  });
}

/* ---------- 敬语 ---------- */
function bizKeigo() {
  const K = BIZ.keigo;
  const say = (txt, kana) => txt && txt !== '—' ? `<span lang="ja" class="furi">${jr(txt)}</span>${kana ? speakBtn(kana) : ''}` : '<span class="muted">—</span>';
  const p = h(`<div class="biz-keigo">
    <section class="panel">
      <div class="row between"><h3>练一练</h3></div>
      <p class="small muted">尊敬语抬高对方（客户、上司的动作），谦让语放低自己（自己和自己公司的动作），丁宁语（です・ます）对谁都礼貌。</p>
      <div class="row"><button class="btn pri" type="button" data-q="verbs">敬语转换练习</button><button class="btn" type="button" data-q="rewrite">商务说法练习</button></div>
    </section>
    <section class="panel">
      <h3>常用动词的尊敬语・谦让语</h3>
      <div class="kg-table">
        <div class="kg-row kg-h"><span>普通</span><span>尊敬语（对方）</span><span>谦让语（自己）</span></div>
        ${K.verbs.map(([plain, son, ken, zh, kana]) => `<div class="kg-row"><span><b lang="ja" class="furi">${jr(plain)}</b><span class="small muted"> ${esc(zh)}</span></span><span>${say(son, kana[1])}</span><span>${say(ken, kana[2])}</span></div>`).join('')}
      </div>
    </section>
    <section class="panel">
      <h3>换成商务说法</h3>
      <div class="kg-list">${K.rewrite.map(([plain, biz, zh, note, kana]) => `<div class="kg-item"><div class="kg-pair"><span class="kg-bad furi" lang="ja">${jr(plain)}</span><span class="kg-arrow">→</span><span class="kg-good furi" lang="ja">${jr(biz)}</span>${speakBtn(kana[1])}</div><div class="small muted">${esc(zh)}${note ? '　·　' + jrNote(note) : ''}</div></div>`).join('')}</div>
    </section>
    <section class="panel">
      <h3>固定表达</h3>
      <div class="kg-list">${K.set.map(([e, zh, use, kana]) => `<div class="kg-item"><div class="kg-pair"><span class="kg-good furi" lang="ja">${jr(e, kana)}</span>${speakBtn(kana)}</div><div class="small"><b>${esc(zh)}</b>　<span class="muted">${jrNote(use)}</span></div></div>`).join('')}</div>
    </section>
    ${K.lock ? '<section class="panel"><p class="small muted biz-more">🔒 这里是免费体验的一部分，完整的敬语表是会员内容。<a href="#vip">了解会员 ›</a></p></section>' : ''}
  </div>`);
  main.append(p);
  p.querySelectorAll('[data-q]').forEach(b => { b.onclick = () => keigoQuiz(b.dataset.q); });
}
function keigoQuiz(kind) {
  const K = BIZ.keigo, qs = [];
  const first = s => s.split('/')[0].trim();
  if (kind === 'verbs') {
    const rows = K.verbs.filter(r => r[1] !== '—' || r[2] !== '—');
    for (const r of sample(rows, Math.min(10, rows.length))) {
      const which = r[1] === '—' ? 2 : r[2] === '—' ? 1 : sample([1, 2], 1)[0];
      const correct = first(r[which]);
      // 干扰项：同一行的另一种敬语（方向弄反是最常见的错误）+ 别的动词的同类敬语
      const pool = [r[3 - which] !== '—' ? first(r[3 - which]) : null, ...K.verbs.filter(x => x !== r && x[which] !== '—').map(x => first(x[which]))].filter(Boolean);
      // 免费版的表很短：干扰项不够时用常见的敬语补上（课本上都有的说法）
      const common = ['いらっしゃる', 'おっしゃる', 'ご覧になる', '召し上がる', 'なさる', '参る', '申す', '拝見する', 'いただく', 'いたす', '伺う', 'お目にかかる'].filter(x => x !== correct);
      qs.push(makeQ(null, 'grammar', distract(correct, (u => u.length >= 3 ? u : u.concat(sample(common, 6)))([...new Set(pool)].filter(x => x !== correct))), correct, {
        prompt: `<div class="eyebrow">「${esc(r[0])}」（${esc(r[3])}）的${which === 1 ? '<b>尊敬语</b>（对方的动作）' : '<b>谦让语</b>（自己的动作）'}是？</div>`,
        optLang: 'ja', say: r[4][which], explain: `<span lang="ja">${esc(r[0])}</span>：尊敬语 <span lang="ja">${esc(r[1])}</span>　谦让语 <span lang="ja">${esc(r[2])}</span>`
      }));
    }
  } else {
    for (const r of sample(K.rewrite, Math.min(10, K.rewrite.length))) {
      const correct = first(r[1]);
      let pool = K.rewrite.filter(x => x !== r).map(x => first(x[1]));
      if (new Set(pool.filter(x => x !== correct)).size < 3) pool = pool.concat(sample(['少々お待ちください', 'かしこまりました', '申し訳ございません', 'ご確認ください', '承知いたしました', 'お世話になっております'].filter(x => x !== correct), 4));
      qs.push(makeQ(null, 'grammar', distract(correct, pool), correct, {
        prompt: `<div class="eyebrow">在商务场合，「<span lang="ja">${esc(r[0])}</span>」应该怎么说？</div><div class="small muted">${esc(r[2])}${r[3] ? '　·　' + esc(r[3]) : ''}</div>`,
        optLang: 'ja', say: r[4][1], explain: `<span lang="ja">${esc(r[0])} → ${esc(r[1])}</span>`
      }));
    }
  }
  main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
  const title = kind === 'verbs' ? '敬语转换' : '商务说法';
  runQuiz(host, qs, { title, noRecord: true, xpEach: 5, onDone: r => { if (!r) return render(); quizSummary(host, r, { title, again: () => keigoQuiz(kind) }); } });
}

/* ---------- 商务邮件 ---------- */
function bizMails() {
  const st = bizState();
  const grid = h('<div class="read-grid"></div>');
  for (const m of BIZ.mails) {
    grid.append(h(`<a class="read-card has-vip" href="#biz/m/${m.id}">${bizVip(BIZ_PUBLIC && BIZ_PUBLIC.mails, m) ? vipTag() : ''}
      <div class="rc-img">${artImg(m)}<span class="tag lv">${m.L}</span>${st.m[m.id] != null ? '<span class="rc-done">済</span>' : ''}</div>
      <div class="rc-body"><div class="rc-cat">✉️ 商务邮件${m.lock ? ' · 🔒 会员' : ''}</div><div class="rc-title furi" lang="ja">${jr(m.title)}</div><div class="rc-zh">${esc(m.zh)}</div><div class="rc-first">${jrNote(m.situation)}</div></div>
    </a>`));
  }
  main.append(grid);
}
function bizMail(m) {
  const st = bizState();
  // 会员邮件：公开站只有标题（全文在私有仓库，1.1 会员开放后由服务器提供）
  if (m.lock) return main.append(h(`<section class="panel"><a class="small" href="#biz/mail">← 返回商务邮件</a><h2 lang="ja" class="furi">${jr(m.title)}</h2><p class="muted">${esc(m.zh)}</p>
    <p>🔒 这封邮件的完整范文、常用句和练习是会员内容，加入会员即可学习。</p><a class="btn pri" href="#biz/m/${BIZ.mails[0].id}">先看免费范文</a></section>`));
  let i = 0;
  const sents = m.p.flat();
  const p = h(`<article class="panel read-art">
    <div class="row between"><a class="small" href="#biz/mail">← 返回商务邮件</a><span class="row"><span class="tag lv">${m.L}</span>${st.m[m.id] != null ? '<span class="tag done">已学</span>' : ''}</span></div>
    <h2 class="ra-title furi" lang="ja">${jr(m.title)}</h2>
    <div class="muted">${esc(m.zh)}</div>
    ${m.situation ? `<div class="biz-note"><b>什么时候用</b><div>${jrNote(m.situation)}</div></div>` : ''}
    <div class="ra-tools">
      <button class="btn pri" type="button" data-play>${SPEAK_SVG}<span>全文朗读</span></button>
      <label class="switch"><input type="checkbox" data-kana> 假名</label>
      <label class="switch"><input type="checkbox" data-zh> 全部中文</label>
      <label class="switch"><input type="checkbox" data-shadowmode> 🎙 跟读模式</label>
      <button class="btn" type="button" data-copy>复制邮件</button>
    </div>
    <div class="mail-box">
      <div class="mail-subj"><span class="muted small">件名</span> <b lang="ja" class="furi">${jr(m.subject)}</b></div>
      <div class="ra-text mail-body">${m.p.map(para => `<p>${para.map(([jp, kana, toks, zh, f]) => bizLine(jp, kana, zh, toks, i++, f)).join('<br>')}</p>`).join('')}</div>
    </div>
    ${phrasesHTML(m.phr || [])}
    <h3>小测验</h3><div class="ra-quiz"></div>
  </article>`);
  main.append(p);
  bindLines(p, sents.map(s => s[1]));
  bindWords(p, { id: m.id, title: m.title, w: [] });
  restoreReadPos();
  p.querySelector('[data-copy]').onclick = () => {
    const text = `件名：${m.subject}\n\n` + m.p.map(para => para.map(s => s[0]).join('\n')).join('\n\n');
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('已复制，可以粘贴到邮件里修改'), () => toast('复制失败，请手动选择文字'));
  };
  const qbox = p.querySelector('.ra-quiz');
  bizQuiz(qbox, m.q, right => {
    const first = st.m[m.id] == null;
    st.m[m.id] = Math.max(st.m[m.id] || 0, right);
    const xp = first ? 15 + right * 5 : right * 2;
    if (typeof actLog === 'function') actLog('b', 'ja');   // 学习方案：今天学了一段商务日语
    addXP(xp); save();
    const next = BIZ.mails.find(x => st.m[x.id] == null);
    qbox.append(h(`<div class="ra-done"><b>${right === m.q.length ? '全对！' : `答对 ${right}/${m.q.length}`}</b> 获得 ${xp} 经验。
      <div class="row">${next ? `<a class="btn pri" href="#biz/m/${next.id}">下一封：<span lang="ja">${esc(next.title)}</span></a>` : ''}<a class="btn" href="#biz/mail">回到列表</a></div></div>`));
  });
}

/* ---------- 商务词汇 ---------- */
function bizVocab() {
  const cats = BIZ.vocab;
  if (!cats.length) return;
  bizVocabCat = Math.min(bizVocabCat, cats.length - 1);
  const c = cats[bizVocabCat];
  const p = h(`<section class="panel">
    <div class="row cat-row">${cats.map((x, i) => `<button type="button" class="chip-btn ${i === bizVocabCat ? 'on' : ''}" data-vc="${i}">${esc(x.cat)}${bizVip(BIZ_PUBLIC && BIZ_PUBLIC.vocab, x) ? vipTag('inl') : ''}</button>`).join('')}</div>
    <div class="row"><button class="btn pri" type="button" data-quiz>「${esc(c.cat)}」测验 10 题</button></div>
    <div class="ra-words">${c.words.map(([w, r, zh, ex, exk, exzh], i) => `<details class="ra-word biz-w"><summary><span lang="ja" class="rw-w furi">${jrWord(w, r)}</span><span lang="ja" class="rw-r">${esc(r)}</span>${speakBtn(r)}<span class="rw-m">${esc(zh)}</span></summary>
      <div class="ex"><div style="flex:1;min-width:0"><div class="jp furi jtap" lang="ja">${jrTap(ex, exk)}</div><div class="small muted">${esc(exzh)}</div></div>${speakBtn(exk, '朗读例句')}</div></details>`).join('')}</div>
    ${c.lock ? '<p class="small muted biz-more">🔒 这里是免费体验的一部分，这个分类的词汇是会员内容。<a href="#vip">了解会员 ›</a></p>' : ''}
  </section>`);
  main.append(p);
  p.querySelectorAll('[data-vc]').forEach(b => { b.onclick = () => { bizVocabCat = +b.dataset.vc; render(); }; });
  p.querySelector('[data-quiz]').onclick = () => bizVocabQuiz(bizVocabCat);
}
function bizVocabQuiz(ci) {
  const c = BIZ.vocab[ci], all = BIZ.vocab.flatMap(x => x.words);
  const qs = sample(c.words, Math.min(10, c.words.length)).map(([w, r, zh, ex, exk, exzh]) => {
    const kind = w !== r && Math.random() < .35 ? 'reading' : Math.random() < .5 ? 'meaning' : 'word';
    const explain = `<span lang="ja">${esc(w)}（${esc(r)}）</span>：${esc(zh)}<br><span class="small"><span lang="ja">${esc(ex)}</span>　<span class="muted">${esc(exzh)}</span></span>`;
    if (kind === 'reading') return makeQ(null, 'reading', distract(r, all.filter(x => x[1] !== r && x[0] !== x[1]).map(x => x[1])), r, { prompt: `<div class="eyebrow">选择正确的读音</div><div class="q-big" lang="ja">${esc(w)}</div>`, optLang: 'ja', say: r, explain });
    if (kind === 'word') return makeQ(null, 'word', distract(w, c.words.map(x => x[0])), w, { prompt: `<div class="eyebrow">哪个词是这个意思？</div><div class="q-big" style="font-family:var(--f-ui);font-size:1.6rem">${esc(zh)}</div>`, optLang: 'ja', say: r, explain });
    return makeQ(null, 'meaning', distract(zh, c.words.map(x => x[2])), zh, { prompt: `<div class="eyebrow">这个词是什么意思？</div><div class="q-big" lang="ja">${esc(w)}</div>`, say: r, explain });
  });
  main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
  const title = `商务词汇 · ${c.cat}`;
  runQuiz(host, qs, { title, noRecord: true, xpEach: 5, onDone: r => { if (!r) return render(); quizSummary(host, r, { title, again: () => bizVocabQuiz(ci) }); } });
}

// 商务页里展开的分类、切换的内容：再给新出现的朗读按钮取一次会员录音地址
document.addEventListener('toggle', e => { if ((location.hash || '').startsWith('#biz') && typeof memberAudioScan === 'function') memberAudioScan(e.target, 'ja', 'ja-biz'); }, true);
