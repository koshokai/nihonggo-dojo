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
const l2Img = a => a.ph ? `<img class="rc-photo" src="${esc(a.ph[0])}" alt="${esc(a.zh)}" loading="lazy" decoding="async">` : `<div class="rc-ph-none">${L2_CAT_ICON[a.cat] || '📖'}</div>`;
function l2Reading(tr, id) {
  l2Page(tr, ['reading'], `${TRACKS[tr].title}阅读`, all => {
    const done = (S.l2read = S.l2read || {});
    if (id) { const a = all.find(x => x.id === id); if (a) return l2Article(tr, a); }
    const L = l2Sel[tr + 'r'] || 'all';
    const list = all.filter(a => L === 'all' || a.lv === L);
    const p = h(`<section class="panel">
      <div class="row between"><h2>${TRACKS[tr].title}阅读</h2><span class="small muted">已读 ${all.filter(a => done[a.id]).length} / ${all.length} 篇</span></div>
      <p class="small muted">贴近生活的短文，配真实照片。点一句话朗读并显示中文，读完做个小测验。</p>
      <div class="seg" role="group">${[...LV_NAMES[tr], 'all'].map(l => `<button type="button" data-rl="${l}" class="${l === L ? 'on' : ''}">${l === 'all' ? '全部' : l}</button>`).join('')}</div>
    </section>`);
    p.querySelectorAll('[data-rl]').forEach(b => { b.onclick = () => { l2Sel[tr + 'r'] = b.dataset.rl; render(); }; });
    const grid = h('<div class="read-grid"></div>');
    list.forEach(a => grid.append(h(`<a class="read-card" href="#${tr}/read/${a.id}">
      <div class="rc-img">${l2Img(a)}<span class="tag lv">${a.lv}</span>${done[a.id] ? '<span class="rc-done">読了</span>' : ''}</div>
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
    <h3>生词</h3><div class="list-wrap"><table class="list"><tbody>${a.w.map(([w, pr, zh]) => `<tr><td style="width:40px">${sayBtn(w, T.tts)}</td><td><b lang="${tr}">${esc(w)}</b><div class="small muted">${esc(pr)}</div></td><td>${esc(zh)}</td></tr>`).join('')}</tbody></table></div>
    <div class="row"><button class="btn pri" type="button" data-quiz>读后小测验（${a.q.length} 题）</button></div>
  </article>`);
  const text = p.querySelector('.ra-text');
  const sayS = i => { text.querySelectorAll('.ra-s').forEach(x => x.classList.toggle('on', +x.dataset.i === i)); speakLang(sents[i][0], T.tts); };
  text.addEventListener('click', e => { const s = e.target.closest('.ra-s'); if (s && !e.target.closest('[data-shadow]')) { s.classList.toggle('open'); sayS(+s.dataset.i); } });
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
function l2Biz(tr) {
  l2Page(tr, ['biz'], `商务${TRACKS[tr].title}`, d => {
    const tab = l2Sel[tr + 'b'] || 'phrases';
    const p = h(`<section class="panel">
      <h2>商务${TRACKS[tr].title}</h2>
      <p class="small muted">${tr === 'ko' ? '职场常用表达（注意合쇼体 / 해요体的分寸）和商务邮件模板。' : '职场常用表达和商务邮件模板，说明里写了语气轻重和常见错误。'}点 🔊 听，🎙 跟读。</p>
      <div class="seg" role="group"><button type="button" data-bt="phrases" class="${tab === 'phrases' ? 'on' : ''}">场景表达</button><button type="button" data-bt="emails" class="${tab === 'emails' ? 'on' : ''}">邮件模板</button></div>
      ${tab === 'phrases' ? d.phrases.map(s => `<details class="gram-item"><summary><b>${esc(s.scene)}</b> <span class="small muted">${s.items.length} 句</span></summary>
        ${s.items.map(([x, zh, note]) => `<div class="ex"><div style="flex:1;min-width:0"><div lang="${tr}">${esc(x)}</div><div class="small">${esc(zh)}</div><div class="small muted">${esc(note)}</div></div>${sayBtn(x, TRACKS[tr].tts)}${shadowBtn(x, '', zh, tr)}</div>`).join('')}</details>`).join('')
      : d.emails.map(e => `<details class="gram-item"><summary><b>${esc(e.title)}</b> <span class="small muted">${esc(e.zh)}</span></summary>
        <div class="mail-body">${e.body.map((l, i) => `<div class="ex"><div style="flex:1;min-width:0"><div lang="${tr}">${esc(l)}</div><div class="small muted">${esc(e.bodyZh[i] || '')}</div></div></div>`).join('')}</div>
        <div class="row"><button class="btn small" type="button" data-copy="${esc(e.body.join('\n'))}">复制邮件原文</button></div></details>`).join('')}
    </section>`);
    p.querySelectorAll('[data-bt]').forEach(b => { b.onclick = () => { l2Sel[tr + 'b'] = b.dataset.bt; render(); }; });
    p.querySelectorAll('[data-copy]').forEach(b => { b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => toast('已复制'), () => toast('复制失败')); });
    return p;
  });
}

/* ---------- 闯关：入门单词每 10 个一关，3 条命，按正确率得星 ---------- */
function l2Game(tr) {
  if (!langReady(tr)) return;
  const words = langItems(tr, 'words'), size = 10, n = Math.ceil(words.length / size);
  const st = ((S.l2game = S.l2game || {})[tr] = S.l2game[tr] || {});
  const unlocked = i => i === 0 || st[i - 1] > 0;
  const p = h(`<section class="panel">
    <h2>${TRACKS[tr].title}闯关</h2>
    <p class="small muted">入门 ${words.length} 个单词，每 10 个一关，按主题排列。每关 3 条命，答错的词会再出现一次；全对 3 星。通过一关解锁下一关。</p>
    <div class="stage-map">${Array.from({ length: n }, (_, i) => `<button type="button" class="stage ${st[i] ? 'done' : ''}" data-stage="${i}" ${unlocked(i) ? '' : 'disabled'}><b>${i + 1}</b><span class="small">${esc(words[i * size].cat)}</span><span class="stars">${'★'.repeat(st[i] || 0)}${'☆'.repeat(3 - (st[i] || 0))}</span></button>`).join('')}</div>
  </section>`);
  p.querySelectorAll('[data-stage]').forEach(b => { b.onclick = () => {
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
  const p = h(`<section class="panel"><h2>${T.title}词典</h2>
    <input type="search" class="lv-q" placeholder="输入${T.title}或中文" value="${esc(l2DictQ[tr] || '')}"><div data-res class="small muted">加载词库……</div></section>`);
  main.append(p);
  const input = p.querySelector('input'), res = p.querySelector('[data-res]');
  if (!langReady(tr)) return;
  lvFetch(`${tr}-levels`).then(meta => Promise.all(meta.map(([k, n]) => lvFetch(`${tr}-${k}`).then(rows => rows.map(([t, pr, zh]) => ({ t, pr, zh, lv: n }))))))
    .then(groups => {
      const all = [...langItems(tr, 'words').map(x => Object.assign({ lv: '入门' }, x)), ...langItems(tr, 'phrases').map(x => Object.assign({ lv: '常用句' }, x)), ...groups.flat()];
      const show = () => {
        const q = input.value.trim(), ql = q.toLowerCase(); l2DictQ[tr] = q;
        if (!q) { res.innerHTML = `共 ${all.length.toLocaleString()} 条：入门单词、常用句和分级词库。`; return; }
        const hits = all.filter(x => x.t.toLowerCase().includes(ql) || x.zh.includes(q) || (x.pr && x.pr.toLowerCase().includes(ql)))
          .sort((a, b) => (a.t.toLowerCase() === ql ? -1 : 0) - (b.t.toLowerCase() === ql ? -1 : 0) || a.t.length - b.t.length).slice(0, 60);
        res.innerHTML = hits.length ? `<div class="list-wrap"><table class="list"><tbody>${hits.map(x => `<tr><td style="width:40px">${sayBtn(x.t, T.tts)}</td><td><b lang="${tr}">${esc(x.t)}</b>${x.pr ? `<div class="small muted">${esc(x.pr)}</div>` : ''}</td><td>${esc(x.zh)}</td><td><span class="tag">${esc(x.lv)}</span></td></tr>`).join('')}</tbody></table></div>`
          : `没有找到。可以试试 <a href="https://translate.google.com/?sl=${tr}&tl=zh-CN&text=${encodeURIComponent(q)}" target="_blank" rel="noopener">谷歌翻译 ↗</a>`;
      };
      let tm; input.oninput = () => { clearTimeout(tm); tm = setTimeout(show, 200); };
      show(); input.focus();
    }).catch(() => { res.textContent = '词库加载失败，请检查网络。'; });
}
