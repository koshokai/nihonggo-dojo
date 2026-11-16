'use strict';
/* 听力：按 JLPT 听解题型出题（题目原创，数据在 listening.js）。
   音频是 VOICEVOX 预先合成的多人对话（audio/index-listen.json：题目 id → mp3）；还没有音频的题用浏览器朗读同样的脚本。 */

const LTYPE = {
  kadai: ['課題理解', '先听问题，再听对话，选出接下来要做的事。'],
  point: ['ポイント理解', '先听问题，再听对话，抓住原因、重点。'],
  gaiyou: ['概要理解', '听一段话，选出说话人想表达的主旨。选项只播放，不显示文字。'],
  hatsuwa: ['発話表現', '听情景说明，选出这时应该说的话。选项只播放，不显示文字。'],
  sokuji: ['即時応答', '听一句话，选出最合适的回应。选项只播放，不显示文字。'],
  tougou: ['統合理解', '听几个人比较几个方案，选出最后的决定。']
};
const LSPOKEN = { gaiyou: 1, hatsuwa: 1, sokuji: 1 };
// 韩语、英语听力（x.lang = 'ko' / 'en'）用同一个播放器，题型名称按考试习惯
const LTYPE_LANG = {
  ko: { sokuji: ['알맞은 대답', '听一句话，选出最合适的回应。选项只播放，不显示文字。'], kadai: ['이어서 할 행동', '听对话，选出接下来要做的事。'], point: ['세부 내용', '听对话或独白，抓住原因、细节。'], gaiyou: ['중심 생각', '听一段话，选出主旨。选项只播放，不显示文字。'] },
  en: { sokuji: ['Responses 回应', '听一句话，选出最合适的回应。选项只播放，不显示文字。'], kadai: ['Short Conversations 短对话', '听对话，选出接下来要做的事。'], point: ['Long Conversations 长对话', '听对话或独白，抓住原因、细节。'], gaiyou: ['Passages 短文', '听一段讲座、广播或新闻，选出主旨。选项只播放，不显示文字。'] }
};
const ltype = (t, lang) => (lang && LTYPE_LANG[lang] && LTYPE_LANG[lang][t]) || LTYPE[t];
const LNUM_LANG = { ko: ['일 번', '이 번', '삼 번', '사 번'], en: ['One.', 'Two.', 'Three.', 'Four.'] };
const LTTS = { ja: 'ja-JP', ko: 'ko-KR', en: 'en-US' };
// 听力测验每种题型出几题（按 JLPT 听解的顺序）
const LPLAN = {
  N5: { kadai: 4, point: 3, hatsuwa: 3, sokuji: 4 },
  N4: { kadai: 4, point: 3, hatsuwa: 3, sokuji: 5 },
  N3: { kadai: 3, point: 3, gaiyou: 2, hatsuwa: 2, sokuji: 5 },
  N2: { kadai: 3, point: 3, gaiyou: 2, sokuji: 6, tougou: 1 },
  N1: { kadai: 3, point: 3, gaiyou: 3, sokuji: 6, tougou: 1 }
};
const LNUM = ['いち', 'に', 'さん', 'よん'], LOTHER = { M: 'F', F: 'M', M2: 'F', F2: 'M' };
const LRATE = { N5: .9, N4: .95, N3: 1, N2: 1.05, N1: 1.1 };

// 免费用户每天可以做的题型练习题数（会员不限）；记在 S.lsFree = { d: 日期, n: 已用 }
const LS_FREE = 5;
let lsDrillT = '';
const lsFreeLeft = () => { const f = S.lsFree; return LS_FREE - (f && f.d === dkey() ? f.n : 0); };
const lsFreeUse = n => { const used = S.lsFree && S.lsFree.d === dkey() ? S.lsFree.n : 0; S.lsFree = { d: dkey(), n: used + n }; save(); };
const LISTEN_IDXS = {};
const listenIdx = (lang = 'ja') => LISTEN_IDXS[lang] || (LISTEN_IDXS[lang] = fetch(lang === 'ja' ? AUD + 'index-listen.json' : `${audIdxBase(lang)}index-${lang}-listen.json`).then(r => r.ok ? r.json() : {}).catch(() => ({})));

// 与 tools/build_listen.py 的 segs() 相同：[说话人, 文本, 之后停顿秒数]
function lsSegs(x) {
  const s = [];
  if (x.intro) s.push(['N', x.intro, 1.2]);
  x.lines.forEach(([spk, ja]) => s.push([spk, ja, .5]));
  if (x.lines.length) s[s.length - 1][2] = 1.2;
  if (x.q && x.t !== 'hatsuwa' && x.t !== 'sokuji') s.push(['N', x.q, 1]);
  if (LSPOKEN[x.t]) {
    const v = x.t === 'sokuji' ? LOTHER[x.lines[0][0]] : x.t === 'hatsuwa' ? 'F' : 'N';
    x.c.forEach((c, i) => { s.push(['N', (LNUM_LANG[x.lang] || LNUM)[i], .3]); s.push([v, c, .9]); });
  }
  return s;
}

// 播放一题。返回 stop()。onend 在完整播完时调用。
let lsStop = null, lsAudioEl = null;
// 听力用同一个播放器，点击当下先用静音解锁：后面要等录音目录、会员录音的临时地址，等完再放也不会被 iPhone 拦下
const lsPlayer = () => lsAudioEl || (lsAudioEl = new Audio());
function lsPlay(x, L, { slow = false, onend, onTTS } = {}) {
  if (lsStop) lsStop();
  stopSpeech();
  { const el = lsPlayer(); el.onended = el.onerror = null; if (typeof SILENT_WAV !== 'undefined') { el.src = SILENT_WAV; el.play().catch(() => {}); } }
  let dead = false, timer = 0, audio = null;
  const stop = () => { dead = true; clearTimeout(timer); if (audio) { audio.onended = audio.onerror = null; audio.pause(); } if (hasTTS) speechSynthesis.cancel(); };
  lsStop = stop;
  const done = () => { if (!dead) { dead = true; if (lsStop === stop) lsStop = null; if (onend) onend(); } };
  const viaTTS = () => noVoice(done);   // 没有录音：不用手机朗读
  listenIdx(x.lang).then(async idx => {
    if (dead) return;
    let file = S.voiceSrc !== 'tts' && idx[x.id];
    // 会员题的录音在服务器的私有存储里：取临时播放地址（member.js）
    if (!file && x.m && S.voiceSrc !== 'tts' && typeof memberData === 'function') {
      const m = await memberData('ja', 'audio/ja-listen.json').catch(() => null);
      if (m && m[x.id]) file = (await memberSign([m[x.id]]).catch(() => ({})))[m[x.id]];
      if (dead) return;
    }
    if (!file) return viaTTS();
    audio = lsPlayer(); audio.src = audUrl(file);
    audio.playbackRate = slow ? .8 : 1;
    audio.onended = done;
    audio.onerror = () => { audio = null; viaTTS(); };
    audio.play().catch(() => { if (!dead) { audio = null; viaTTS(); } });
  });
  return stop;
}

function lsTranscript(x) {
  return `<div class="ls-script">${x.intro ? `<p class="small muted furi" lang="${x.lang || 'ja'}">${jr(x.intro)}</p>` : ''}
    ${x.lines.map(([spk, ja, zh]) => `<p><span class="ls-spk ${spk[0]}">${{ M: '男', F: '女', M2: '男2', F2: '女2' }[spk]}</span><span lang="${x.lang || 'ja'}" class="furi ${(x.lang || 'ja') === 'ja' ? 'jtap' : ''}">${(x.lang || 'ja') === 'ja' ? jrTap(ja) : jr(ja)}</span><span class="small muted ls-zh">${esc(zh)}</span></p>`).join('')}
    ${x.q && x.t !== 'hatsuwa' ? `<p class="small muted furi" lang="${x.lang || 'ja'}">${jr(x.q)}</p>` : ''}</div>`;
}

let listenLoading = false;
// 会员题：从服务器取（member.js），并进 LISTEN；不是会员时拿掉（题目带 m: 1）
let LS_MEMBER = false, lsMemLoading = false;
// 会员身份变了（member.js 调用）：先拿掉会员题，需要时再取
function lsMemberReset() {
  if (typeof LISTEN !== 'undefined' && LS_MEMBER) for (const L in LISTEN) LISTEN[L] = LISTEN[L].filter(x => !x.m);
  LS_MEMBER = false;
}
function lsMember() {
  const want = typeof isMember === 'function' && isMember('ja');
  if (!want && LS_MEMBER) { for (const L in LISTEN) LISTEN[L] = LISTEN[L].filter(x => !x.m); LS_MEMBER = false; }
  if (!want || LS_MEMBER || lsMemLoading) return;
  lsMemLoading = true;
  memberData('ja', 'listening-member.json').then(d => {
    lsMemLoading = false;
    if (!d) return;
    for (const L in d) { const have = new Set((LISTEN[L] || []).map(x => x.id)); LISTEN[L] = (LISTEN[L] || []).concat(d[L].filter(x => !have.has(x.id))); }
    LS_MEMBER = true;
    if ((location.hash || '').startsWith('#listen') && !busy()) render();
  }).catch(() => { lsMemLoading = false; });
}
function viewListen() {
  // 听力题有几百 KB，第一次打开听力页时才加载
  if (typeof LISTEN === 'undefined') {
    main.append(h('<section class="panel"><h2>听力</h2><p class="muted">正在加载听力题…</p></section>'));
    if (!listenLoading) {
      listenLoading = true;
      const s = document.createElement('script');
      s.src = 'listening.js';
      s.onload = () => {
        const f = document.createElement('script'); f.src = 'furi-listen.js';   // 听力原文的假名
        f.onload = f.onerror = () => { if ((location.hash || '').startsWith('#listen') && !busy()) render(); };
        document.body.append(f);
      };
      s.onerror = () => { listenLoading = false; toast('听力题加载失败，请检查网络'); };
      document.body.append(s);
    }
    return;
  }
  lsMember();
  const L = S.level, all = (LISTEN[L] || []).filter(x => !x.wk || wkVisible(x.wk));   // 每周精选的听力只在最近 4 期里出现
  S.listenHist = S.listenHist || [];
  const hist = S.listenHist.filter(e => LEVELS.includes(e.L)).slice(-6).reverse();
  const types = Object.keys(LTYPE).filter(t => all.some(x => x.t === t));
  // 听力测验是会员功能；题型练习免费用户每天 LS_FREE 题（会员不限）
  const member = typeof isMember === 'function' && isMember('ja'), left = lsFreeLeft();
  const p = h(`<section class="panel">
    <div class="row between"><h2>听力 · ${L}</h2>${levelSeg(L)}</div>
    <p>按 JLPT 听解的题型出题，男女声多人对话。可以反复听、放慢，做完看原文、翻译和解说。</p>
    <p class="small muted">题目为本站原创（真题有版权，不能收录），语速按级别逐级加快。戴上耳机效果更好。</p>
    ${all.length ? `<h3>题型练习</h3>
    <div class="pick-row">${pickSelect('题型', 'data-drill-t', [['', '各种题型混合'], ...types.map(t => [t, LTYPE[t][0]])], lsDrillT && types.includes(lsDrillT) ? lsDrillT : '')}<button class="btn pri" type="button" data-drill>开始练习</button></div>
    ${member ? '' : `<p class="small muted" data-drill-left>${left ? `今天还能免费练 ${left} 题` : '今天的免费练习做完了，明天再来吧'}</p>`}
    <h3>听力测验</h3>
    ${member ? `<p class="small muted">按 JLPT 的题型顺序一口气做完，和考试一样每题只听一遍，交卷后看成绩、原文和解说。</p><div class="row"><button class="btn" type="button" data-start>开始听力测验</button></div>`
      : `<a class="panel wk-more ls-more" href="#vip"><div class="wk-more-t">✨ 像真正考试一样练一次</div><div class="small">按 JLPT 题型顺序一口气做完，每题只听一遍，交卷看成绩和解说；题型练习也不限次数。</div><div class="wk-more-go">加入会员即可使用 ›</div></a>`}` : '<p>这个级别的听力题还在准备中。</p>'}
    ${hist.length ? `<h3>最近成绩</h3><div class="list-wrap"><table class="list"><thead><tr><th>日期</th><th>级别</th><th>得分</th><th>结果</th></tr></thead><tbody>${hist.map(e => `<tr><td>${e.date}</td><td>${e.L}</td><td>${e.score}/${e.total}</td><td>${e.score / e.total >= .6 ? '<span class="tag done">合格</span>' : '<span class="tag">未合格</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
  </section>`);
  bindLevel(p);
  const start = () => {
    const qs = [];
    Object.entries(LPLAN[L]).forEach(([t, n]) => qs.push(...sample(all.filter(x => x.t === t), n)));
    runListen(qs, L, { exam: true, title: `${L} 听力测验`, again: start });
  };
  if (all.length) {
    const st = p.querySelector('[data-start]'); if (st) st.onclick = start;
    const sel = p.querySelector('[data-drill-t]');
    sel.onchange = () => { lsDrillT = sel.value; };
    const go = () => {
      const t = lsDrillT && types.includes(lsDrillT) ? lsDrillT : '', pool = t ? all.filter(x => x.t === t) : all;
      const n = member ? 8 : Math.min(LS_FREE, lsFreeLeft());
      if (!n) { toast('今天的免费练习做完了，明天再来吧'); location.hash = '#vip'; return; }
      if (!member) lsFreeUse(n);
      runListen(sample(pool, n), L, { title: `${L} ${t ? LTYPE[t][0] : '听力'}练习`, again: go });
    };
    p.querySelector('[data-drill]').onclick = go;
  }
  main.append(p);
}

function runListen(qs, L, { exam = false, title, again }) {
  let i = 0;
  const res = [];
  main.innerHTML = '';
  const box = h(`<section class="panel quiz">
    <div class="row between"><h2>${esc(title)}</h2><button class="btn ghost" type="button" data-exit>退出</button></div>
    <div class="progress-top"><span class="small" data-count></span><div class="bar"><i data-bar style="width:0"></i></div><span class="small"></span></div>
    <div data-stage></div></section>`);
  main.append(box);
  const stage = box.querySelector('[data-stage]');
  focusMode(true);
  const quit = () => { if (lsStop) lsStop(); keyHandler = null; focusMode(false); };
  box.querySelector('[data-exit]').onclick = () => { quit(); render(); };
  function show() {
    const x = qs[i];
    let played = false, playing = false, answered = false, slow = false;
    box.querySelector('[data-count]').textContent = `${i + 1} / ${qs.length}`;
    box.querySelector('[data-bar]').style.width = (i / qs.length * 100) + '%';
    const spoken = LSPOKEN[x.t];
    stage.innerHTML = `<div class="q-prompt pop"><div class="eyebrow">${ltype(x.t, x.lang)[0]}</div><div class="small muted">${ltype(x.t, x.lang)[1]}</div>
      <div class="ls-player"><button class="btn pri ls-play" type="button" data-play>▶ 播放</button>
      ${exam ? '<span class="small muted">考试模式：只能听一遍</span>' : '<label class="small"><input type="checkbox" data-slow> 慢速</label>'}</div></div>
      <div class="opts">${x.c.map((c, j) => `<button class="opt" type="button" data-o="${j}"><span class="k">${j + 1}</span><span lang="${x.lang || 'ja'}">${spoken ? '' : esc(c)}</span></button>`).join('')}</div>
      <div data-fb></div>`;
    const btn = stage.querySelector('[data-play]');
    const setBtn = () => {
      btn.textContent = playing ? '■ 停止' : played ? (exam ? '已播放' : '↻ 再听一次') : '▶ 播放';
      btn.disabled = exam && played && !playing;
    };
    btn.onclick = () => {
      if (playing) { if (lsStop) lsStop(); playing = false; played = true; return setBtn(); }
      if (exam && played) return;
      playing = true; played = true; setBtn();
      lsPlay(x, L, { slow, onend: () => { playing = false; setBtn(); }, onTTS: () => { const n = stage.querySelector('[data-ttsnote]'); if (n && S.voiceSrc !== 'tts') n.hidden = false; } });
    };
    const sl = stage.querySelector('[data-slow]');
    if (sl) sl.onchange = () => { slow = sl.checked; };
    stage.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => pick(+b.dataset.o); });
    keyHandler = e => {
      if (!answered && '1234'.includes(e.key) && +e.key <= x.c.length) pick(+e.key - 1);
      else if (e.key === ' ' && !answered) { e.preventDefault(); btn.click(); }
      else if (answered && e.key === 'Enter') next();
    };
    function pick(j) {
      if (answered) return; answered = true;
      const ok = j === x.a;
      res.push({ x, pick: j, ok });
      if (typeof weakNote === 'function' && (x.lang || 'ja') === 'ja') weakNote('ja', `l:${x.id}`, ok, { sk: 'l', l: x.q || x.intro || '', m: (x.c || [])[x.a] || '', href: '#listen' });   // 我的弱项
      if (exam) { if (lsStop) lsStop(); return next(); }
      if (ok) addXP(10); else save();
      const btns = stage.querySelectorAll('[data-o]');
      btns.forEach((b, k) => {
        b.disabled = true;
        if (k === x.a) b.classList.add('right'); else if (k === j) b.classList.add('wrong');
        b.querySelector('[lang]').innerHTML = `${esc(x.c[k])} <span class="small muted">${esc(x.cz[k])}</span>`;
      });
      if (ok) popFrom(btns[j]);
      stage.querySelector('[data-fb]').innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}">${neko(ok ? 'happy' : 'sad', 'mini')}<div class="fb-t"><b>${ok ? '答对了' : '答错了'}</b><div>${esc(x.ex)}</div></div></div>
        <details class="ls-details" open><summary>听力原文和翻译</summary>${lsTranscript(x)}</details>
        <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn pri" type="button" data-next>${i + 1 < qs.length ? '下一题' : '查看结果'}${KBD ? '（Enter）' : ''}</button></div>`;
      stage.querySelector('[data-next]').onclick = next;
    }
  }
  function next() {
    if (lsStop) lsStop();
    i++;
    if (i < qs.length) return show();
    quit();
    finish();
  }
  function finish() {
    const score = res.filter(r => r.ok).length, total = res.length, pct = Math.round(score / total * 100);
    if (exam) {
      S.listenHist = S.listenHist || [];
      S.listenHist.push({ L, score, total, date: dkey(), lang: qs[0].lang || 'ja' });
      addXP(score * 10 + (pct >= 60 ? 30 : 0));
      if (pct >= 60) celebrate();
    }
    save();
    main.innerHTML = '';
    const by = {};
    res.forEach(r => { by[r.x.t] = by[r.x.t] || [0, 0]; by[r.x.t][1]++; if (r.ok) by[r.x.t][0]++; });
    const p = h(`<section class="panel">
      <div class="result"><div class="seal pop ${pct >= 60 ? '' : 'fail'}">${exam ? (pct >= 60 ? '合格' : ({ ko: '재도전', en: 'Retry' }[qs[0].lang] || '再挑戦')) : pct >= 90 ? '優' : pct >= 60 ? '良' : '可'}</div>
      <div class="rank"><div class="eyebrow">${esc(title)}</div><div class="rank-name">${score} / ${total}</div>
      <p class="muted">${pct >= 60 ? 'いいね！耳朵越来越灵了。' : '听力靠多听：点开下面的原文，跟着音频再听几遍。'}</p></div></div>
      <div class="breakdown">${Object.entries(by).map(([t, [a, n]]) => `<div class="bd-row"><span>${ltype(t, res[0].x.lang)[0]}</span><div class="bar"><i style="width:${a / n * 100}%"></i></div><span class="small">${a}/${n}</span></div>`).join('')}</div>
      <h3>逐题回顾</h3>
      ${res.map((r, k) => `<details class="ls-details"><summary>${r.ok ? '<span class="tag done">对</span>' : '<span class="tag">错</span>'} ${k + 1}. ${ltype(r.x.t, r.x.lang)[0]}　<span lang="${r.x.lang || 'ja'}">${esc(r.x.c[r.x.a])}</span></summary>
        <div class="row"><button class="btn" type="button" data-replay="${k}">▶ 再听一次</button></div>
        <p class="small">正确答案：<b lang="${r.x.lang || 'ja'}">${r.x.a + 1}. ${esc(r.x.c[r.x.a])}</b>（${esc(r.x.cz[r.x.a])}）${r.ok ? '' : `　你的答案：<span lang="${r.x.lang || 'ja'}">${r.pick < 0 ? '未作答' : `${r.pick + 1}. ${esc(r.x.c[r.pick])}`}</span>`}</p>
        <ol class="small">${r.x.c.map((c, j) => `<li lang="${r.x.lang || 'ja'}">${esc(c)} <span class="muted">${esc(r.x.cz[j])}</span></li>`).join('')}</ol>
        <p class="small">${esc(r.x.ex)}</p>${lsTranscript(r.x)}</details>`).join('')}
      <div class="row"><button class="btn pri" type="button" data-again>再来一组</button><a class="btn" href="#${qs[0].lang ? qs[0].lang + '/listen' : 'listen'}">返回听力</a></div>
    </section>`);
    main.append(p);
    p.querySelectorAll('[data-replay]').forEach(b => { b.onclick = () => lsPlay(res[+b.dataset.replay].x, L); });
    p.querySelector('[data-again]').onclick = again;
  }
  show();
}
