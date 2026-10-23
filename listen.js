'use strict';
/* 听力：按 JLPT 听解题型出题（题目原创，数据在 listening.js）。
   音频是 VOICEVOX 预先合成的多人对话（audio/index-listen.json：题目 id → mp3）；还没有音频的题用浏览器朗读同样的脚本。 */

const LTYPE = {
  kadai: ['課題理解', '先听问题，再听对话，选出接下来要做的事。'],
  point: ['ポイント理解', '先听问题，再听对话，抓住原因、重点。'],
  gaiyou: ['概要理解', '听一段话，选出说话人想表达的主旨。选项只读不显示。'],
  hatsuwa: ['発話表現', '听情景说明，选出这时应该说的话。选项只读不显示。'],
  sokuji: ['即時応答', '听一句话，选出最合适的回应。选项只读不显示。'],
  tougou: ['統合理解', '听几个人比较几个方案，选出最后的决定。']
};
const LSPOKEN = { gaiyou: 1, hatsuwa: 1, sokuji: 1 };
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

let LISTEN_IDX = null;
const listenIdx = () => LISTEN_IDX || (LISTEN_IDX = fetch('audio/index-listen.json').then(r => r.ok ? r.json() : {}).catch(() => ({})));

// 与 tools/build_listen.py 的 segs() 相同：[说话人, 文本, 之后停顿秒数]
function lsSegs(x) {
  const s = [];
  if (x.intro) s.push(['N', x.intro, 1.2]);
  x.lines.forEach(([spk, ja]) => s.push([spk, ja, .5]));
  if (x.lines.length) s[s.length - 1][2] = 1.2;
  if (x.q && x.t !== 'hatsuwa' && x.t !== 'sokuji') s.push(['N', x.q, 1]);
  if (LSPOKEN[x.t]) {
    const v = x.t === 'sokuji' ? LOTHER[x.lines[0][0]] : x.t === 'hatsuwa' ? 'F' : 'N';
    x.c.forEach((c, i) => { s.push(['N', LNUM[i], .3]); s.push([v, c, .9]); });
  }
  return s;
}

// 播放一题。返回 stop()。onend 在完整播完时调用。
let lsStop = null;
function lsPlay(x, L, { slow = false, onend } = {}) {
  if (lsStop) lsStop();
  stopSpeech();
  let dead = false, timer = 0, audio = null;
  const stop = () => { dead = true; clearTimeout(timer); if (audio) { audio.onended = audio.onerror = null; audio.pause(); } if (hasTTS) speechSynthesis.cancel(); };
  lsStop = stop;
  const done = () => { if (!dead) { dead = true; if (lsStop === stop) lsStop = null; if (onend) onend(); } };
  const viaTTS = () => {
    if (!hasTTS) { toast('这个浏览器不支持朗读'); return done(); }
    const vs = jaVoices(), male = vs.find(v => /ichiro|otoya|keita|hattori|male|男/i.test(v.name));
    const segs = lsSegs(x);
    const next = k => {
      if (dead) return;
      if (k >= segs.length) return done();
      const [spk, text, pause] = segs[k];
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      u.rate = (spk === 'N' ? 1 : LRATE[L]) * (slow ? .8 : 1);
      const isM = spk[0] === 'M';
      u.voice = (isM && male) || currentVoice() || null;
      u.pitch = spk === 'N' ? 1 : isM ? (male ? 1 : .55) : spk === 'F2' ? 1.45 : 1.2;
      u.onend = u.onerror = () => { if (!dead) timer = setTimeout(() => next(k + 1), pause * 1000); };
      speechSynthesis.speak(u);
    };
    speechSynthesis.cancel(); setTimeout(() => next(0), 80);
  };
  listenIdx().then(idx => {
    if (dead) return;
    const file = S.voiceSrc !== 'tts' && idx[x.id];
    if (!file) return viaTTS();
    audio = new Audio('audio/' + file);
    audio.playbackRate = slow ? .8 : 1;
    audio.onended = done;
    audio.onerror = () => { audio = null; viaTTS(); };
    audio.play().catch(() => { if (!dead) { audio = null; viaTTS(); } });
  });
  return stop;
}

function lsTranscript(x) {
  return `<div class="ls-script">${x.intro ? `<p class="small muted" lang="ja">${esc(x.intro)}</p>` : ''}
    ${x.lines.map(([spk, ja, zh]) => `<p><span class="ls-spk ${spk[0]}">${{ M: '男', F: '女', M2: '男2', F2: '女2' }[spk]}</span><span lang="ja">${esc(ja)}</span><span class="small muted ls-zh">${esc(zh)}</span></p>`).join('')}
    ${x.q && x.t !== 'hatsuwa' ? `<p class="small muted" lang="ja">${esc(x.q)}</p>` : ''}</div>`;
}

let listenLoading = false;
function viewListen() {
  // 听力题有几百 KB，第一次打开听力页时才加载
  if (typeof LISTEN === 'undefined') {
    main.append(h('<section class="panel"><h2>听力</h2><p class="muted">正在加载听力题…</p></section>'));
    if (!listenLoading) {
      listenLoading = true;
      const s = document.createElement('script');
      s.src = 'listening.js';
      s.onload = () => { if ((location.hash || '').startsWith('#listen')) render(); };
      s.onerror = () => { listenLoading = false; toast('听力题加载失败，请检查网络'); };
      document.body.append(s);
    }
    return;
  }
  const L = S.level, all = LISTEN[L] || [];
  S.listenHist = S.listenHist || [];
  const hist = S.listenHist.slice(-6).reverse();
  const types = Object.keys(LTYPE).filter(t => all.some(x => x.t === t));
  const p = h(`<section class="panel">
    <div class="row between"><h2>听力 · ${L}</h2>${levelSeg(L)}</div>
    <p>按 JLPT 听解的题型和顺序出题，男女声多人对话。<b>听力测验</b>和考试一样每题只能听一遍，交卷后看原文、翻译和解说；<b>题型练习</b>可以反复听、放慢。</p>
    <p class="small muted">题目为本站原创（真题有版权，不能收录），语速按级别逐级加快。戴上耳机效果更好。</p>
    ${all.length ? `<div class="row"><button class="btn pri" type="button" data-start>开始听力测验（${Object.values(LPLAN[L]).reduce((a, b) => a + b, 0)} 题）</button></div>
    <h3>题型练习</h3><div class="row">${types.map(t => `<button class="chip-btn" type="button" data-drill="${t}">${LTYPE[t][0]} <span class="small">${all.filter(x => x.t === t).length}</span></button>`).join('')}</div>` : '<p>这个级别的听力题还在准备中。</p>'}
    ${hist.length ? `<h3>最近成绩</h3><div class="list-wrap"><table class="list"><thead><tr><th>日期</th><th>级别</th><th>得分</th><th>结果</th></tr></thead><tbody>${hist.map(e => `<tr><td>${e.date}</td><td>${e.L}</td><td>${e.score}/${e.total}</td><td>${e.score / e.total >= .6 ? '<span class="tag done">合格</span>' : '<span class="tag">未合格</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
  </section>`);
  bindLevel(p);
  const start = () => {
    const qs = [];
    Object.entries(LPLAN[L]).forEach(([t, n]) => qs.push(...sample(all.filter(x => x.t === t), n)));
    runListen(qs, L, { exam: true, title: `${L} 听力测验`, again: start });
  };
  if (all.length) {
    p.querySelector('[data-start]').onclick = start;
    p.querySelectorAll('[data-drill]').forEach(b => {
      const t = b.dataset.drill;
      const go = () => runListen(sample(all.filter(x => x.t === t), 8), L, { title: `${L} ${LTYPE[t][0]}练习`, again: go });
      b.onclick = go;
    });
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
  const quit = () => { if (lsStop) lsStop(); keyHandler = null; };
  box.querySelector('[data-exit]').onclick = () => { quit(); render(); };
  function show() {
    const x = qs[i];
    let played = false, playing = false, answered = false, slow = false;
    box.querySelector('[data-count]').textContent = `${i + 1} / ${qs.length}`;
    box.querySelector('[data-bar]').style.width = (i / qs.length * 100) + '%';
    const spoken = LSPOKEN[x.t];
    stage.innerHTML = `<div class="q-prompt pop"><div class="eyebrow">${LTYPE[x.t][0]}</div><div class="small muted">${LTYPE[x.t][1]}</div>
      <div class="ls-player"><button class="btn pri ls-play" type="button" data-play>▶ 播放</button>
      ${exam ? '<span class="small muted">考试模式：只能听一遍</span>' : '<label class="small"><input type="checkbox" data-slow> 慢速</label>'}</div></div>
      <div class="opts">${x.c.map((c, j) => `<button class="opt" type="button" data-o="${j}"><span class="k">${j + 1}</span><span lang="ja">${spoken ? '' : esc(c)}</span></button>`).join('')}</div>
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
      lsPlay(x, L, { slow, onend: () => { playing = false; setBtn(); } });
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
        <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn pri" type="button" data-next>${i + 1 < qs.length ? '下一题' : '查看结果'}（Enter）</button></div>`;
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
      S.listenHist.push({ L, score, total, date: dkey() });
      addXP(score * 10 + (pct >= 60 ? 30 : 0));
      if (pct >= 60) celebrate();
    }
    save();
    main.innerHTML = '';
    const by = {};
    res.forEach(r => { by[r.x.t] = by[r.x.t] || [0, 0]; by[r.x.t][1]++; if (r.ok) by[r.x.t][0]++; });
    const p = h(`<section class="panel">
      <div class="result"><div class="seal pop ${pct >= 60 ? '' : 'fail'}">${exam ? (pct >= 60 ? '合格' : '再挑戦') : pct >= 90 ? '優' : pct >= 60 ? '良' : '可'}</div>
      <div class="rank"><div class="eyebrow">${esc(title)}</div><div class="rank-name">${score} / ${total}</div>
      <p class="muted">${pct >= 60 ? 'いいね！耳朵越来越灵了。' : '听力靠多听：点开下面的原文，跟着音频再听几遍。'}</p></div></div>
      <div class="breakdown">${Object.entries(by).map(([t, [a, n]]) => `<div class="bd-row"><span>${LTYPE[t][0]}</span><div class="bar"><i style="width:${a / n * 100}%"></i></div><span class="small">${a}/${n}</span></div>`).join('')}</div>
      <h3>逐题回顾</h3>
      ${res.map((r, k) => `<details class="ls-details"><summary>${r.ok ? '<span class="tag done">对</span>' : '<span class="tag">错</span>'} ${k + 1}. ${LTYPE[r.x.t][0]}　<span lang="ja">${esc(r.x.c[r.x.a])}</span></summary>
        <div class="row"><button class="btn" type="button" data-replay="${k}">▶ 再听一次</button></div>
        <p class="small">正确答案：<b lang="ja">${r.x.a + 1}. ${esc(r.x.c[r.x.a])}</b>（${esc(r.x.cz[r.x.a])}）${r.ok ? '' : `　你的答案：<span lang="ja">${r.pick < 0 ? '未作答' : `${r.pick + 1}. ${esc(r.x.c[r.pick])}`}</span>`}</p>
        <ol class="small">${r.x.c.map((c, j) => `<li lang="ja">${esc(c)} <span class="muted">${esc(r.x.cz[j])}</span></li>`).join('')}</ol>
        <p class="small">${esc(r.x.ex)}</p>${lsTranscript(r.x)}</details>`).join('')}
      <div class="row"><button class="btn pri" type="button" data-again>再来一组</button><a class="btn" href="#listen">返回听力</a></div>
    </section>`);
    main.append(p);
    p.querySelectorAll('[data-replay]').forEach(b => { b.onclick = () => lsPlay(res[+b.dataset.replay].x, L); });
    p.querySelector('[data-again]').onclick = again;
  }
  show();
}
