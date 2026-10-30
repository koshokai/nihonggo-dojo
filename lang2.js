'use strict';
/* 韩语、英语：语法、阅读、听力、商务、闯关、词典、今日一句（和日语板块对应）。
   数据：lang/<语言>-grammar|reading|listen|daily|biz.json（tools/build_lang2.py 生成），第一次打开时加载。依赖 lang.js。 */

const LV_NAMES = { ko: ['初级', '中级', '高级'], en: ['基础', '四级', '六级'] };
const L2 = {};   // 'ko-grammar' → 数据
const l2Fetch = (tr, kind) => L2[`${tr}-${kind}`] ? Promise.resolve(L2[`${tr}-${kind}`])
  : fetch(`lang/${tr}-${kind}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => (L2[`${tr}-${kind}`] = d));
// 先放一个「加载中」面板，数据到了再画；失败时提示还在准备中
function l2Page(tr, kinds, title, draw) {
  const p = h(`<section class="panel"><h2>${title}</h2><p class="muted">加载中……</p></section>`);
  main.append(p);
  Promise.all(kinds.map(k => l2Fetch(tr, k))).then(ds => { if (p.isConnected) { const n = draw(...ds); p.replaceWith(...[].concat(n)); } })
    .catch(() => { if (p.isConnected) p.innerHTML = `<h2>${title}</h2><p>加载失败：这部分内容可能还在准备中，或者网络有问题，请稍后再试。</p>`; });
}
const l2Sel = {};
const lvChips = (tr, cur, attr = 'data-l2lv') => `<div class="seg" role="group">${LV_NAMES[tr].map(l => `<button type="button" ${attr}="${l}" class="${l === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const lvBind = (el, tr, key) => el.querySelectorAll('[data-l2lv]').forEach(b => { b.onclick = () => { l2Sel[tr + key] = b.dataset.l2lv; render(); }; });
const curLv = (tr, key) => l2Sel[tr + key] || LV_NAMES[tr][0];

/* ---------- 今日一句 ---------- */
function l2Daily(tr, list) {
  const now = new Date(), start = new Date(now.getFullYear(), 0, 0);
  let day = Math.floor((now - start) / DAY) - 1;
  const box = h(`<section class="panel daily-l2"></section>`);
  const draw = () => {
    const [s, pr, zh, note] = list[((day % list.length) + list.length) % list.length];
    box.innerHTML = `<div class="row between"><div class="eyebrow">今日一句</div><div class="row"><button class="btn ghost small" type="button" data-d="-1" aria-label="前一天">‹</button><button class="btn ghost small" type="button" data-d="1" aria-label="后一天">›</button></div></div>
      <div class="row"><b class="daily-s" lang="${tr}">${esc(s)}</b>${sayBtn(s, TRACKS[tr].tts)}${shadowBtn(s, pr, zh, tr)}</div>
      ${pr ? `<div class="small muted">${esc(pr)}</div>` : ''}<div>${esc(zh)}</div><p class="small muted">${esc(note)}</p>`;
    box.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => { day += +b.dataset.d; draw(); }; });
  };
  draw();
  return box;
}

/* ---------- 语法 ---------- */
function l2Grammar(tr) {
  l2Page(tr, ['grammar'], `${TRACKS[tr].title}语法`, all => {
    const L = curLv(tr, 'g'), list = all.filter(g => g.lv === L);
    const p = h(`<section class="panel">
      <div class="row between"><h2>${TRACKS[tr].title}语法 · ${L}</h2>${lvChips(tr, L)}</div>
      <p class="small muted">${tr === 'ko' ? '初级≈TOPIK 1–2 级，中级≈3–4 级，高级≈5–6 级。' : '基础＝初高中语法，四级、六级按大学英语考试要求。'}每个语法点有用法说明和例句，点 🔊 听发音、🎙 跟读。</p>
      <div class="row"><button class="btn pri" type="button" data-gq>语法练习 10 题</button></div>
      ${list.map(g => `<details class="gram-item"><summary><b lang="${tr}">${esc(g.p)}</b>　<span class="muted">${esc(g.m)}</span></summary>
        <p class="small">${esc(g.use)}</p>
        ${g.eg.map(([s, zh]) => `<div class="ex"><div style="flex:1;min-width:0"><div lang="${tr}">${esc(s)}</div><div class="small muted">${esc(zh)}</div></div>${sayBtn(s, TRACKS[tr].tts)}${shadowBtn(s, '', zh, tr)}</div>`).join('')}
      </details>`).join('')}
    </section>`);
    lvBind(p, tr, 'g');
    p.querySelector('[data-gq]').onclick = () => {
      const qs = sample(list, Math.min(10, list.length)).map(g => {
        const [stem, opts] = g.q;
        return makeQ(null, 'grammar', opts.slice(1), opts[0], { optLang: tr,
          prompt: `<div class="eyebrow">选出正确的一项</div><div class="q-sent" lang="${tr}">${esc(stem).replace(/（\s*）/g, '<span class="blank">　　　</span>')}</div>`,
          explain: `<b lang="${tr}">${esc(g.p)}</b>　${esc(g.m)}。${esc(g.use)}` });
      });
      langQuiz(qs, `${TRACKS[tr].title}语法练习 · ${L}`, TRACKS[tr].tts, () => { render(); });
    };
    return p;
  });
}

/* ---------- 阅读 ---------- */
const L2_CAT_ICON = { 韩国生活: '🏙️', 韩国美食: '🍲', 英美生活: '🏙️', 英美美食: '🍔', 职业日常: '👷', 节日季节: '🎆', 科技社会: '💡' };
const l2Img = a => a.ph ? `<img class="rc-photo" src="${esc(a.ph[0])}" alt="${esc(a.zh)}" loading="lazy" decoding="async">` : `<div class="rc-ph-none"><span>${L2_CAT_ICON[a.cat] || '📖'}</span><b>${esc(a.cat || '')}</b></div>`;
function l2Reading(tr, id) {
  l2Page(tr, ['reading'], `${TRACKS[tr].title}阅读`, all => {
    const done = (S.l2read = S.l2read || {});
    if (id) { const a = all.find(x => x.id === id); if (a) return l2Article(tr, a); }
    const L = l2Sel[tr + 'r'] || 'all', cat = l2Sel[tr + 'rc'] || '';
    const list = all.filter(a => (L === 'all' || a.lv === L) && (!cat || a.cat === cat));
    const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / DAY) - 1, today = all[doy % all.length];
    const lvCount = l => { const lv = all.filter(a => a.lv === l); return `${lv.filter(a => done[a.id]).length}/${lv.length}`; };
    const cats = [...new Set(all.map(a => a.cat))];
    // 和日语阅读一样：今日阅读 → 级别（带已读数）→ 题材 → 文章卡片
    const p = h(`<section class="panel">
      <div class="row between"><h2>${TRACKS[tr].title}阅读</h2><span class="small muted">已读 ${all.filter(a => done[a.id]).length} / ${all.length} 篇</span></div>
      ${today ? `<a class="today-art" href="#${tr}/read/${today.id}"><div class="ta-img">${l2Img(today)}</div><div><span class="tag done">今日阅读</span> <span class="tag lv">${esc(today.lv)}</span><div class="rc-title" lang="${tr}">${esc(today.title)}</div><div class="small muted">${esc(today.zh)} · ${esc(today.cat)}</div></div></a>` : ''}
      <p class="small muted">贴近生活的短文，配真实照片。每句都能点读、看中文、跟读；读完做个小测验拿经验。</p>
      <div class="seg read-lv" role="group" aria-label="级别">${LV_NAMES[tr].map(l => `<button type="button" data-rl="${l}" class="${l === L ? 'on' : ''}">${l}<span class="lv-n">${lvCount(l)}</span></button>`).join('')}<button type="button" data-rl="all" class="${L === 'all' ? 'on' : ''}">全部</button></div>
      <div class="row cat-row"><button type="button" class="chip-btn ${!cat ? 'on' : ''}" data-rc="">全部题材</button>${cats.map(c => `<button type="button" class="chip-btn ${cat === c ? 'on' : ''}" data-rc="${esc(c)}">${L2_CAT_ICON[c] || ''} ${esc(c)}</button>`).join('')}</div>
    </section>`);
    p.querySelectorAll('[data-rl]').forEach(b => { b.onclick = () => { l2Sel[tr + 'r'] = b.dataset.rl; render(); }; });
    p.querySelectorAll('[data-rc]').forEach(b => { b.onclick = () => { l2Sel[tr + 'rc'] = b.dataset.rc; render(); }; });
    const grid = h('<div class="read-grid"></div>');
    if (!list.length) grid.append(h('<p class="muted">这个分类还没有文章，换一个看看吧。</p>'));
    list.forEach(a => grid.append(h(`<a class="read-card" href="#${tr}/read/${a.id}">
      <div class="rc-img">${l2Img(a)}<span class="tag lv">${a.lv}</span>${done[a.id] ? '<span class="rc-done">已读</span>' : ''}</div>
      <div class="rc-body"><div class="rc-cat">${L2_CAT_ICON[a.cat] || ''} ${esc(a.cat)}</div><div class="rc-title" lang="${tr}">${esc(a.title)}</div><div class="rc-zh">${esc(a.zh)}</div>
      <div class="rc-first" lang="${tr}">${esc(a.p[0][0][0])}</div></div></a>`)));
    return [p, grid];
  });
}
function l2Article(tr, a) {
  const T = TRACKS[tr], sents = a.p.flat();
  let idx = 0;
  const p = h(`<article class="panel read-art">
    <div class="ra-hero">${l2Img(a)}</div>${a.ph ? `<div class="ph-credit small muted">照片：${esc(a.ph[1])} · ${esc(a.ph[2])} · <a href="${esc(a.ph[3])}" target="_blank" rel="noopener">Wikimedia Commons</a></div>` : ''}
    <div class="row between"><a class="small" href="#${tr}/read">← 返回阅读</a><span class="row"><span class="tag lv">${a.lv}</span><span class="tag">${esc(a.cat)}</span></span></div>
    <h2 class="ra-title" lang="${tr}">${esc(a.title)}</h2><div class="muted">${esc(a.zh)}</div>
    <div class="ra-tools"><button class="btn pri" type="button" data-play>${SPEAK_SVG}<span>全文朗读</span></button><label class="switch"><input type="checkbox" data-zh> 全部中文</label></div>
    <p class="small muted">点一句话：朗读并显示中文；🎙 跟读打分。</p>
    <div class="ra-text">${a.p.map(para => `<p>${para.map(([s, zh]) => `<span class="ra-s" data-i="${idx++}" tabindex="0" role="button"><span class="ra-jp" lang="${tr}">${esc(s)}</span> ${shadowBtn(s, '', zh, tr)}<span class="ra-zh">${esc(zh)}</span></span>`).join(' ')}</p>`).join('')}</div>
    <div class="row between"><h3>生词</h3><button type="button" class="btn small" data-addall>全部加入闪卡</button></div><div class="list-wrap"><table class="list"><tbody>${a.w.map(([w, pr, zh]) => `<tr><td style="width:40px">${sayBtn(w, T.tts)}</td><td><b lang="${tr}">${esc(w)}</b><div class="small muted">${esc(pr)}</div></td><td>${esc(zh)}</td></tr>`).join('')}</tbody></table></div>
    <p class="small muted">${reportBtn(`阅读《${a.title}》`, a.zh)} 发现翻译或内容有误？点小旗子告诉我们。</p>
    <div class="row"><button class="btn pri" type="button" data-quiz>读后小测验（${a.q.length} 题）</button></div>
  </article>`);
  const text = p.querySelector('.ra-text');
  const sayS = i => { text.querySelectorAll('.ra-s').forEach(x => x.classList.toggle('on', +x.dataset.i === i)); speakLang(sents[i][0], T.tts); };
  text.addEventListener('click', e => { const s = e.target.closest('.ra-s'); if (s && !e.target.closest('[data-shadow]')) { s.classList.toggle('open'); sayS(+s.dataset.i); } });
  p.querySelector('[data-addall]').onclick = e => {
    a.w.forEach(([w, pr, zh]) => l2AddCard(tr, { id: `${tr}|r|${w}`, t: w, pr, zh }));
    save(); e.target.disabled = true; e.target.textContent = '已加入'; toast(`${a.w.length} 个生词已加入闪卡，今天就会复习`);
  };
  p.querySelector('[data-zh]').onchange = e => text.classList.toggle('show-zh', e.target.checked);
  p.querySelector('[data-play]').onclick = () => {
    // 逐句朗读：一句读完再读下一句（有音频用音频，没有用设备语音）
    let i = 0;
    const next = () => { if (i >= sents.length || !p.isConnected) return; sayS(i++); setTimeout(next, Math.max(1800, sents[i - 1][0].length * (tr === 'ko' ? 230 : 75))); };
    next();
  };
  p.querySelector('[data-quiz]').onclick = () => {
    const qs = a.q.map(([q, ...opts]) => makeQ(null, 'meaning', opts.slice(1), opts[0], { optLang: tr, prompt: `<div class="eyebrow">读后小测验</div><div class="q-sent" lang="${tr}">${esc(q)}</div>`, explain: '' }));
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    runQuiz(host, qs, { title: a.title, noRecord: true, onDone: r => {
      if (!r) return render();
      S.l2read = S.l2read || {}; S.l2read[a.id] = r.score; save();
      quizSummary(host, r, { title: a.title, again: () => { location.hash = `${tr}/read`; } });
    } });
  };
  return p;
}

/* ---------- 听力（用日语听力的播放器 listen.js） ---------- */
function l2Listen(tr) {
  l2Page(tr, ['listen'], `${TRACKS[tr].title}听力`, all => {
    const L = curLv(tr, 'l'), list = all.filter(x => x.lv === L);
    const types = Object.keys(LTYPE_LANG[tr]).filter(t => list.some(x => x.t === t));
    S.listenHist = S.listenHist || [];
    const hist = S.listenHist.filter(e => e.lang === tr).slice(-6).reverse();
    const p = h(`<section class="panel">
      <div class="row between"><h2>${TRACKS[tr].title}听力 · ${L}</h2>${lvChips(tr, L)}</div>
      <p>按${tr === 'ko' ? ' TOPIK ' : '四六级'}听力的题型出题，男女声对话。<b>听力测验</b>和考试一样每题只能听一遍；<b>题型练习</b>可以反复听、放慢。交卷后看原文、翻译和解说。</p>
      <p class="small muted">题目为本站原创。对话音频由 MeloTTS 生成，还没有音频的题用设备自带的语音。</p>
      ${list.length ? `<div class="row"><button class="btn pri" type="button" data-start>开始听力测验（${Math.min(10, list.length)} 题）</button></div>
      <h3>题型练习</h3><div class="row">${types.map(t => `<button class="chip-btn" type="button" data-drill="${t}">${ltype(t, tr)[0]} <span class="small">${list.filter(x => x.t === t).length}</span></button>`).join('')}</div>` : '<p>这个级别的听力题还在准备中。</p>'}
      ${hist.length ? `<h3>最近成绩</h3><div class="list-wrap"><table class="list"><thead><tr><th>日期</th><th>级别</th><th>得分</th></tr></thead><tbody>${hist.map(e => `<tr><td>${e.date}</td><td>${e.L}</td><td>${e.score}/${e.total}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </section>`);
    lvBind(p, tr, 'l');
    const start = () => {
      const order = ['sokuji', 'kadai', 'point', 'gaiyou'];
      const qs = sample(list, Math.min(10, list.length)).sort((a, b) => order.indexOf(a.t) - order.indexOf(b.t));
      runListen(qs, L, { exam: true, title: `${TRACKS[tr].title}听力测验 · ${L}`, again: start });
    };
    const s = p.querySelector('[data-start]'); if (s) s.onclick = start;
    p.querySelectorAll('[data-drill]').forEach(b => {
      const t = b.dataset.drill, go = () => runListen(sample(list.filter(x => x.t === t), 8), L, { title: `${ltype(t, tr)[0]}练习`, again: go });
      b.onclick = go;
    });
    return p;
  });
}

/* ---------- 商务 ---------- */
// 商务：场景会话（照片 + 对话 + 关键表达 + 小测验）/ 场景表达 / 邮件模板 / 商务词汇，和日语「商务」同样的结构
const L2_BIZ_IC = { 职场基础: '🏢', 电话: '📞', 拜访接待: '🤝', 会议: '📊', 汇报沟通: '🗣️', 道歉拒绝: '🙇', 谈判销售: '💼', 求职面试: '👔', 应酬: '🍻', 出差: '✈️' };
function l2Biz(tr, sid) {
  l2Page(tr, ['biz'], `商务${TRACKS[tr].title}`, d => {
    const scenes = d.scenes || [], vocab = d.vocab || [];
    if (sid) { const sc = scenes.find(x => x.id === sid); if (sc) return l2BizScene(tr, sc, scenes); }
    const tabs = [['scenes', '💬 场景会话', scenes.length], ['phrases', '🗂 场景表达', d.phrases.length], ['emails', '✉️ 邮件模板', d.emails.length], ['vocab', '📒 商务词汇', vocab.reduce((n, c) => n + c.words.length, 0)]].filter(t => t[2]);
    const tab = tabs.some(t => t[0] === l2Sel[tr + 'b']) ? l2Sel[tr + 'b'] : tabs[0][0];
    const done = (S.l2biz = S.l2biz || {})[tr] || {};
    const p = h(`<section class="panel">
      <h2>商务${TRACKS[tr].title}</h2>
      <p class="small muted">${tr === 'ko' ? '在韩企工作、和韩国客户打交道用得上的韩语：注意합쇼体 / 해요体的分寸。' : '外企和海外客户打交道用得上的英语，说明里写了语气轻重和中式英语的常见错误。'}点 🔊 听，🎙 跟读。</p>
      <div class="seg" role="group">${tabs.map(([k, t, n]) => `<button type="button" data-bt="${k}" class="${tab === k ? 'on' : ''}">${t} <span class="small muted">${n}</span></button>`).join('')}</div>
      ${tab === 'scenes' ? `<div class="read-grid">${scenes.map(sc => `<a class="read-card" href="#${tr}/biz/${esc(sc.id)}">
          <div class="rc-img">${sc.ph ? `<img class="rc-photo" src="${esc(sc.ph[0])}" alt="" loading="lazy" decoding="async">` : `<div class="rc-ph-none biz"><span>${L2_BIZ_IC[sc.cat] || '💼'}</span><b>${esc(sc.cat)}</b></div>`}<span class="tag lv">${esc(sc.lv)}</span>${done[sc.id] != null ? '<span class="rc-done">✓</span>' : ''}</div>
          <div class="rc-body"><div class="rc-title" lang="${tr}">${esc(sc.title)}</div><div class="small muted">${esc(sc.zh)}</div></div></a>`).join('')}</div>`
      : tab === 'phrases' ? d.phrases.map(s => `<details class="gram-item"><summary><b>${esc(s.scene)}</b> <span class="small muted">${s.items.length} 句</span></summary>
        ${s.items.map(([x, zh, note]) => `<div class="ex"><div style="flex:1;min-width:0"><div lang="${tr}">${esc(x)}</div><div class="small">${esc(zh)}</div><div class="small muted">${esc(note)}</div></div>${sayBtn(x, TRACKS[tr].tts)}${shadowBtn(x, '', zh, tr)}</div>`).join('')}</details>`).join('')
      : tab === 'emails' ? d.emails.map(e => `<details class="gram-item"><summary><b>${esc(e.title)}</b> <span class="small muted">${esc(e.zh)}</span></summary>
        <div class="mail-body">${e.body.map((l, i) => `<div class="ex"><div style="flex:1;min-width:0"><div lang="${tr}">${esc(l)}</div><div class="small muted">${esc(e.bodyZh[i] || '')}</div></div></div>`).join('')}</div>
        <div class="row"><button class="btn small" type="button" data-copy="${esc(e.body.join('\n'))}">复制邮件原文</button></div></details>`).join('')
      : vocab.map((c, ci) => `<details class="gram-item"><summary><b>${esc(c.cat)}</b> <span class="small muted">${c.words.length} 词</span></summary>
        <div class="row"><button class="btn small" type="button" data-addcat="${ci}">全部加入单词卡</button></div>
        ${c.words.map(([w, zh, ex, exZh]) => `<div class="ex"><div style="flex:1;min-width:0"><div><b lang="${tr}">${esc(w)}</b> <span class="small">${esc(zh)}</span></div>${ex ? `<div class="small" lang="${tr}">${esc(ex)}</div><div class="small muted">${esc(exZh || '')}</div>` : ''}</div>${sayBtn(w, TRACKS[tr].tts)}</div>`).join('')}</details>`).join('')}
    </section>`);
    p.querySelectorAll('[data-bt]').forEach(b => { b.onclick = () => { l2Sel[tr + 'b'] = b.dataset.bt; render(); }; });
    p.querySelectorAll('[data-copy]').forEach(b => { b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => toast('已复制'), () => toast('复制失败')); });
    p.querySelectorAll('[data-addcat]').forEach(b => { b.onclick = () => {
      vocab[+b.dataset.addcat].words.forEach(([w, zh, ex, exZh]) => l2AddCard(tr, { id: `${tr}|b|${w}`, t: w, zh, ex: ex ? [[ex, exZh || '']] : null }));
      save(); b.textContent = '已加入'; b.disabled = true; toast('已加入单词卡，今天就会复习');
    }; });
    return p;
  });
}
function l2BizScene(tr, sc, scenes) {
  const tts = TRACKS[tr].tts, i = scenes.indexOf(sc), next = scenes[i + 1];
  const p = h(`<article class="panel an-work">
    <a class="an-back" href="#${tr}/biz">← 返回商务${TRACKS[tr].title}</a>
    ${sc.ph ? `<div class="an-hero"><img src="${esc(sc.ph[0])}" alt="" decoding="async" onerror="this.parentElement.remove()"></div>${photoCredit(sc)}` : ''}
    <div class="row"><span class="tag lv">${esc(sc.lv)}</span><span class="tag">${L2_BIZ_IC[sc.cat] || ''} ${esc(sc.cat)}</span></div>
    <h2 lang="${tr}">${esc(sc.title)}</h2><p class="muted">${esc(sc.zh)}</p>
    <div class="biz-lines">${sc.lines.map(([who, x, zh]) => `<div class="an-t"><span class="an-who small">${esc(who)}</span><div><span lang="${tr}">${esc(x)}</span>${sayBtn(x, tts)}${shadowBtn(x, '', zh, tr)}<div class="small muted">${esc(zh)}</div></div></div>`).join('')}</div>
    ${sc.note ? `<p class="an-note small">${esc(sc.note)}</p>` : ''}
    ${(sc.phr || []).length ? `<h3>关键表达</h3><div class="ra-words">${sc.phr.map(([x, zh]) => `<div class="ra-word"><span lang="${tr}" class="rw-w">${esc(x)}</span>${sayBtn(x, tts)}<span class="rw-m">${esc(zh)}</span></div>`).join('')}</div>` : ''}
    ${(sc.q || []).length ? '<h3>小测验</h3><div class="an-quiz"></div>' : ''}
    ${next ? `<div class="row"><a class="btn" href="#${tr}/biz/${esc(next.id)}">下一个场景：${esc(next.zh)} →</a></div>` : ''}
  </article>`);
  const box = p.querySelector('.an-quiz');
  if (box) {
    let k = 0, right = 0;
    const ask = () => {
      if (k >= sc.q.length) {
        box.innerHTML = `<p>答对 ${right} / ${sc.q.length}。</p>`;
        ((S.l2biz = S.l2biz || {})[tr] = S.l2biz[tr] || {})[sc.id] = right; save(); if (right) addXP(right * 5);
        return;
      }
      const [q, ok, ...bad] = sc.q[k], opts = shuffle([ok, ...bad]);
      box.innerHTML = `<p><b>${esc(q)}</b></p><div class="an-opts">${opts.map(o => `<button class="btn" type="button" lang="${tr}">${esc(o)}</button>`).join('')}</div>`;
      box.querySelectorAll('button').forEach(b => { b.onclick = () => {
        const good = b.textContent === ok; if (good) right++;
        box.querySelectorAll('button').forEach(x => { x.disabled = true; if (x.textContent === ok) x.classList.add('pri'); });
        if (!good) b.classList.add('danger');
        k++; setTimeout(ask, good ? 700 : 1500);
      }; });
    };
    ask();
  }
  return p;
}

/* ---------- 闯关：入门单词每 10 个一关，3 条命，按正确率得星 ---------- */
function l2Game(tr) {
  if (!langReady(tr)) return;
  const words = langItems(tr, 'words'), size = 10, n = Math.ceil(words.length / size);
  const st = ((S.l2game = S.l2game || {})[tr] = S.l2game[tr] || {});
  const unlocked = i => i === 0 || st[i - 1] > 0;
  // 和日语闯关同样的地图：每 10 关一章（章名取这一章的主题），蜿蜒的关卡路线，当前关有小猫
  const cur = Array.from({ length: n }, (_, i) => i).find(i => !st[i]) ?? n - 1;
  const chapters = Math.ceil(n / 10), stars = Object.values(st).reduce((x, y) => x + y, 0);
  let ch = (l2Sel[tr + 'ch'] ?? Math.floor(cur / 10));
  ch = Math.min(Math.max(0, ch), chapters - 1);
  const from = ch * 10, to = Math.min(n, from + 10);
  const p = h(`<section class="panel game-map">
    <div class="row between"><h2>${TRACKS[tr].title}闯关</h2></div>
    <div class="row between small"><span>已过 ${Object.keys(st).length} / ${n} 关 · <b class="star-t">★ ${stars}</b></span><span class="muted">每关 10 个词，3 条命，答错会扣命</span></div>
    <div class="chap-nav">
      <button class="btn ghost" type="button" data-ch="-1" ${ch <= 0 ? 'disabled' : ''} aria-label="上一章">‹</button>
      <div class="chap-title"><span class="eyebrow">第 ${ch + 1} 章 / 共 ${chapters} 章</span><b>${esc(words[from * size].cat)}</b></div>
      <button class="btn ghost" type="button" data-ch="1" ${ch >= chapters - 1 ? 'disabled' : ''} aria-label="下一章">›</button>
    </div>
    <div class="path">${Array.from({ length: to - from }, (_, k) => {
      const i = from + k, x = Math.round(Math.sin(k * 0.9) * 26), boss = (i + 1) % 10 === 0;
      return `<div class="node-wrap ${x > 0 ? 'r' : 'l'}" style="--x:${x}%">
        <button type="button" class="node ${boss ? 'boss' : ''} ${st[i] ? 'done' : ''} ${i === cur ? 'cur' : ''}" data-stage="${i}" ${unlocked(i) ? '' : 'disabled'} aria-label="第 ${i + 1} 关：${esc(words[i * size].cat)}"><span>${boss ? '★' : i + 1}</span></button>
        <span class="stars">${[1, 2, 3].map(j => `<i class="${j <= (st[i] || 0) ? 'on' : ''}">★</i>`).join('')}</span>
        ${i === cur ? `<span class="here">${neko('happy', 'mini wave')}</span>` : ''}
      </div>`;
    }).join('')}</div>
    <p class="small muted">入门 ${words.length} 个单词按主题排列。答错的词会再出现一次；全对 3 星，通过一关解锁下一关。</p>
  </section>`);
  p.querySelectorAll('[data-ch]').forEach(b => { b.onclick = () => { l2Sel[tr + 'ch'] = ch + +b.dataset.ch; render(); }; });
  p.querySelectorAll('[data-stage]').forEach(b => { b.onclick = () => {
    if (typeof guestStage === 'function' && guestStage(tr, +b.dataset.stage + 1)) return;   // 游客只开放前 3 关
    const i = +b.dataset.stage, ws = words.slice(i * size, (i + 1) * size);
    const mk = x => {
      const toZh = Math.random() < .55, opts = sample(words.filter(y => y.zh !== x.zh && y.t !== x.t), 3);
      const options = shuffle([x, ...opts].map(y => toZh ? y.zh : y.t));
      return { kind: 'meaning', options, optLang: toZh ? '' : tr, answer: options.indexOf(toZh ? x.zh : x.t), say: x.t, sayLang: TRACKS[tr].tts,
        prompt: toZh ? `<div class="eyebrow">选出中文意思</div><div class="q-big" lang="${tr}">${esc(x.t)}</div>` : `<div class="eyebrow">用${TRACKS[tr].title}怎么说？</div><div class="q-big">${esc(x.zh)}</div>`,
        explain: `<b lang="${tr}">${esc(x.t)}</b> ${x.pr ? `<span class="muted">${esc(x.pr)}</span> ` : ''}= ${esc(x.zh)}` };
    };
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    const qs = shuffle(ws).map(mk);
    runQuiz(host, qs, { title: `第 ${i + 1} 关 · ${ws[0].cat}`, noRecord: true, hearts: 3, onDone: r => {
      if (!r) return render();
      const stars = r.failed ? 0 : r.score === r.total ? 3 : r.score >= r.total * .8 ? 2 : 1;
      if (stars > (st[i] || 0)) st[i] = stars;
      ws.forEach(x => { if (!S.srs[x.id]) S.srs[x.id] = { i: 0, e: 2.5, r: 0, due: Date.now() + DAY }; });   // 闯过的词进入闪卡复习
      save();
      quizSummary(host, r, { title: `第 ${i + 1} 关 ${stars ? '★'.repeat(stars) : '失败'}`, again: () => render() });
      if (stars === 3) celebrate();
    } });
  }; });
  main.append(p);
}

/* ---------- 词典：入门词、常用句、分级词库一起查 ---------- */
let l2DictQ = {};
function l2Dict(tr) {
  const T = TRACKS[tr];
  const tries = tr === 'ko' ? ['사랑', '학교', '감사합니다', '学习', '回家', '먹다'] : ['study', 'schedule', 'take off', '学习', '会议', 'apply'];
  // 和日语词典同样的排版：大输入框 + 查 按钮 + 「试试」+ 收录说明
  const p = h(`<section class="panel"><h2>${T.title}词典</h2>
    <form class="dict-form" role="search"><input type="search" id="dict-q" placeholder="输入${T.title}或中文" value="${esc(l2DictQ[tr] || '')}" aria-label="查词" autocomplete="off"><button class="btn pri" type="submit">查</button></form>
    <div class="row small"><span class="muted">试试：</span>${tries.map(w => `<button type="button" class="chip-btn" data-try="${esc(w)}">${esc(w)}</button>`).join('')}</div>
    <div data-res class="small muted">加载词库……</div></section>`);
  main.append(p);
  const input = p.querySelector('#dict-q'), res = p.querySelector('[data-res]');
  p.querySelector('form').onsubmit = e => { e.preventDefault(); input.dispatchEvent(new Event('input')); };
  p.querySelectorAll('[data-try]').forEach(b => { b.onclick = () => { input.value = b.dataset.try; input.dispatchEvent(new Event('input')); }; });
  if (!langReady(tr)) return;
  lvFetch(`${tr}-levels`).then(meta => Promise.all(meta.map(([k, n]) => lvFetch(`${tr}-${k}`).then(rows => rows.map(([t, pr, zh]) => ({ t, pr, zh, lv: n }))))))
    .then(groups => {
      const all = [...langItems(tr, 'words').map(x => Object.assign({ lv: '入门' }, x)), ...langItems(tr, 'phrases').map(x => Object.assign({ lv: '常用句' }, x)), ...groups.flat()];
      const show = () => {
        const q = input.value.trim(), ql = q.toLowerCase(); l2DictQ[tr] = q;
        if (!q) { res.innerHTML = `收录：${tr === 'ko' ? '国立国语院《한국어기초사전》' : 'ECDICT'}分级词库 + 入门单词和常用句，共 ${all.length.toLocaleString()} 条。`; return; }
        const hits = all.filter(x => x.t.toLowerCase().includes(ql) || x.zh.includes(q) || (x.pr && x.pr.toLowerCase().includes(ql)))
          .sort((a, b) => (a.t.toLowerCase() === ql ? -1 : 0) - (b.t.toLowerCase() === ql ? -1 : 0) || a.t.length - b.t.length).slice(0, 60);
        res.innerHTML = hits.length ? `<div class="list-wrap"><table class="list"><tbody>${hits.map(x => `<tr><td style="width:40px">${sayBtn(x.t, T.tts)}</td><td><b lang="${tr}">${esc(x.t)}</b>${x.pr ? `<div class="small muted">${esc(x.pr)}</div>` : ''}</td><td>${esc(x.zh)}</td><td><span class="tag">${esc(x.lv)}</span></td></tr>`).join('')}</tbody></table></div>`
          : `没有找到。可以试试 <a href="https://translate.google.com/?sl=${tr}&tl=zh-CN&text=${encodeURIComponent(q)}" target="_blank" rel="noopener">谷歌翻译 ↗</a>`;
      };
      let tm; input.oninput = () => { clearTimeout(tm); tm = setTimeout(show, 200); };
      show(); input.focus();
    }).catch(() => { res.textContent = '词库加载失败，请检查网络。'; });
}

/* ---------- 分级测试：韩语、英语各级抽词，按正确率推荐起点级别 ---------- */
const L2_PLACE_SRC = { ko: [['A', '初级'], ['B', '中级'], ['C', '高级']], en: [['zk', '基础'], ['cet4', '四级'], ['cet6', '六级']] };
function l2Placement(tr) {
  const T = TRACKS[tr];
  const box = h(`<section class="panel"><h2>${T.title}分级测试</h2><p class="muted">准备题目……</p></section>`);
  main.append(box);
  Promise.all(L2_PLACE_SRC[tr].map(([k]) => lvFetch(`${tr}-${k}`))).then(lists => {
    if (!box.isConnected) return;
    const p = h(`<section class="panel"><h2>${T.title}分级测试</h2>
      <p>15 道题，大约 3 分钟：每个级别 5 个单词，选出中文意思。不会的直接猜，不扣分。</p>
      <p class="small muted">做完会推荐一个起点级别，单词、语法、阅读、听力都会切到这个级别。之后随时可以自己改。</p>
      <button class="btn pri big" type="button" data-place-go>开始测试</button></section>`);
    p.querySelector('[data-place-go]').onclick = () => {
      // 每级从常用的前 1500 个词里抽，太偏的词测不出真实水平
      const qs = L2_PLACE_SRC[tr].flatMap(([k, name], i) => sample(lists[i].slice(0, 1500), 5).map(([t, pr, zh]) => {
        const pool = lists[i].filter(x => x[2] !== zh).map(x => x[2]);
        return makeQ(null, 'meaning', distract(zh, pool), zh, { lv: name, say: t, sayLang: T.tts,
          prompt: `<div class="eyebrow">选出中文意思 · ${esc(name)}</div><div class="q-big" lang="${tr}">${esc(t)}</div>${pr ? `<div class="muted">${esc(pr)}</div>` : ''}`,
          explain: `<b lang="${tr}">${esc(t)}</b> = ${esc(zh)}` });
      }));
      main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
      runQuiz(host, qs, { title: `${T.title}分级测试`, noRecord: true, xpEach: 2, onDone: r => {
        if (!r) return render();
        const per = L2_PLACE_SRC[tr].map(([, name]) => r.res.filter(x => x.q.lv === name && x.ok).length);
        // 某一级答对 4 题以上算过关；推荐第一个没过关的级别
        let k = per.findIndex(n => n < 4); if (k < 0) k = per.length - 1;
        const name = L2_PLACE_SRC[tr][k][1];
        l2SetLevel(tr, name); updateTop();
        host.innerHTML = '';
        host.append(h(`<section class="panel"><h2>推荐从「${esc(name)}」开始</h2>
          <div class="stats">${L2_PLACE_SRC[tr].map(([, n], i) => `<div class="stat"><span class="small muted">${esc(n)}</span><b>${per[i]} / 5</b></div>`).join('')}</div>
          <p class="small muted">单词、语法、阅读和听力都已切到「${esc(name)}」。觉得太难或太简单，在各页面上方随时可以换级别。</p>
          <div class="row"><a class="btn pri" href="#${tr}">回到首页开始学</a><a class="btn" href="#${tr}/levels">去分级词库</a></div></section>`));
      } });
    };
    box.replaceWith(p);
  }).catch(() => { box.innerHTML = `<h2>${T.title}分级测试</h2><p>题目加载失败，请检查网络。</p>`; });
}
