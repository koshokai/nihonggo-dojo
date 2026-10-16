'use strict';
/* 日语道场 — 闯关与小游戏。依赖 app.js 里的全局函数，在 app.js 之前加载，只定义函数。 */

const STAGE_SIZE = 10;      // 每关 10 个词
const CHAPTER = 10;         // 每 10 关一章，第 10 关是头目关
let gameChapter = {};       // 每个级别当前查看的章节

const stageWords = (L, n) => VOCAB[L].filter(v => v.q).slice((n - 1) * STAGE_SIZE, n * STAGE_SIZE);
const stageCount = L => Math.ceil(VOCAB[L].filter(v => v.q).length / STAGE_SIZE);
const stageStars = (L, n) => ((S.stages || {})[L] || {})[n] || 0;
const stageOpen = (L, n) => n === 1 || stageStars(L, n - 1) > 0;
const isBoss = n => n % CHAPTER === 0;
function nextStage(L) {
  const total = stageCount(L);
  for (let n = 1; n <= total; n++) if (!stageStars(L, n)) return n;
  return total;
}
const totalStars = L => Object.values((S.stages || {})[L] || {}).reduce((a, b) => a + b, 0);

/* 闯关地图 */
function viewGame() {
  if (!S.stages) S.stages = {};
  if (!S.games) S.games = {};
  const L = S.level, total = stageCount(L), cur = nextStage(L);
  const chapters = Math.ceil(total / CHAPTER);
  let ch = gameChapter[L] || Math.ceil(cur / CHAPTER);
  ch = Math.min(Math.max(1, ch), chapters);
  gameChapter[L] = ch;
  const from = (ch - 1) * CHAPTER + 1, to = Math.min(ch * CHAPTER, total);
  const done = Object.keys(S.stages[L] || {}).length;

  const p = h(`<section class="panel game-map">
    <div class="row between"><h2>闯关 · ${L}</h2>${levelSeg(L)}</div>
    <div class="row between small"><span>已过 ${done} / ${total} 关 · <b class="star-t">★ ${totalStars(L)}</b></span><span class="muted">每关 10 个词，3 颗心，答错会扣心</span></div>
    <div class="chap-nav">
      <button class="btn ghost" type="button" data-ch="-1" ${ch <= 1 ? 'disabled' : ''} aria-label="上一章">‹</button>
      <div class="chap-title"><span class="eyebrow">第 ${ch} 章 / 共 ${chapters} 章</span><b lang="ja">${CHAPTER_NAMES[(ch - 1) % CHAPTER_NAMES.length]}</b></div>
      <button class="btn ghost" type="button" data-ch="1" ${ch >= chapters ? 'disabled' : ''} aria-label="下一章">›</button>
    </div>
    <div class="path">${Array.from({ length: to - from + 1 }, (_, k) => {
      const n = from + k, st = stageStars(L, n), open = stageOpen(L, n), boss = isBoss(n);
      const x = Math.round(Math.sin(k * 0.9) * 26);
      return `<div class="node-wrap ${x > 0 ? 'r' : 'l'}" style="--x:${x}%">
        <button type="button" class="node ${boss ? 'boss' : ''} ${st ? 'done' : ''} ${n === cur ? 'cur' : ''}" data-stage="${n}" ${open ? '' : 'disabled'} aria-label="第 ${n} 关${boss ? '（头目关）' : ''}${st ? `，${st} 星` : open ? '' : '，未解锁'}">
          <span lang="ja">${boss ? '鬼' : n}</span>
        </button>
        <span class="stars">${[1, 2, 3].map(i => `<i class="${i <= st ? 'on' : ''}">★</i>`).join('')}</span>
        ${n === cur ? `<span class="here">${neko('happy', 'mini wave')}</span>` : ''}
      </div>`;
    }).join('')}</div>
  </section>`);
  bindLevel(p);
  p.querySelectorAll('[data-ch]').forEach(b => { b.onclick = () => { gameChapter[L] = ch + +b.dataset.ch; render(); }; });
  p.querySelectorAll('[data-stage]').forEach(b => { b.onclick = () => stageIntro(L, +b.dataset.stage); });

  const best = k => ((S.games[k] || {})[L]);
  const mini = h(`<section class="panel">
    <h2>小游戏</h2>
    <div class="grid2">
      <button type="button" class="mini-card" data-g="sprint"><span class="mini-ic" lang="ja">速</span><b>60 秒冲刺</b><span class="small muted">一分钟内答对越多越好，答错扣 3 秒</span><span class="small">最好成绩：${best('sprint') != null ? best('sprint') + ' 题' : '还没玩过'}</span></button>
      <button type="button" class="mini-card" data-g="match"><span class="mini-ic" lang="ja">対</span><b>配对消除</b><span class="small muted">把单词和意思连起来，3 轮共 18 对</span><span class="small">最快用时：${best('match') != null ? fmtSec(best('match')) : '还没玩过'}</span></button>
    </div>
  </section>`);
  mini.querySelector('[data-g="sprint"]').onclick = () => sprintGame(L);
  mini.querySelector('[data-g="match"]').onclick = () => matchGame(L);
  main.append(p, mini);
  const curNode = p.querySelector('.node.cur');
  if (curNode) requestAnimationFrame(() => curNode.scrollIntoView({ block: 'nearest' }));
}
const CHAPTER_NAMES = ['はじまりの道', '桜の小径', '竹林', '茶屋', '鳥居の坂', '月見台', '雪の峠', '城下町', '天守閣', '富士の頂'];
const fmtSec = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/* 关卡：先看词，再挑战 */
function stageIntro(L, n) {
  const words = stageWords(L, n);
  let i = 0;
  main.innerHTML = '';
  const box = h(`<section class="panel deck">
    <div class="row between"><h2>第 ${n} 关${isBoss(n) ? ' · 头目关' : ''}</h2><button class="btn ghost" type="button" data-exit>返回地图</button></div>
    <p class="small muted">${isBoss(n) ? '头目关会考这一章的全部单词。先看看这一关的 10 个新词。' : '先认识这一关的 10 个词，准备好了就开始挑战。'}</p>
    <div data-card></div>
    <div class="row between"><button class="btn" type="button" data-prev>上一个</button><span class="small muted" data-pos></span><button class="btn" type="button" data-next>下一个</button></div>
    <button class="btn pri big" type="button" data-play>开始挑战</button>
  </section>`);
  main.append(box);
  const show = () => {
    const v = words[i];
    box.querySelector('[data-card]').innerHTML = `<div class="card" style="cursor:default">
      <span class="corner tag learn">${i + 1} / ${words.length}</span><span class="corner-r">${speakBtn(v.r)}</span>
      <div class="word" lang="ja">${esc(v.w)}</div><div class="reading" lang="ja">${esc(v.r)}</div><div class="meaning">${esc(v.m)}</div>
      ${exList(v.w).length ? `<div class="ex-box">${exHTML(v.w, 1)}</div>` : ''}</div>`;
    box.querySelector('[data-pos]').textContent = `${i + 1} / ${words.length}`;
    box.querySelector('[data-prev]').disabled = i === 0;
    box.querySelector('[data-next]').disabled = i === words.length - 1;
    if (S.autoSpeak) speak(v.r);
  };
  box.querySelector('[data-prev]').onclick = () => { i--; show(); };
  box.querySelector('[data-next]').onclick = () => { i++; show(); };
  box.querySelector('[data-exit]').onclick = () => go('game');
  box.querySelector("[data-play]").onclick = () => playStage(L, n);
  keyHandler = e => {
    if (e.key === 'ArrowRight' && i < words.length - 1) { i++; show(); }
    else if (e.key === 'ArrowLeft' && i > 0) { i--; show(); }
    else if (e.key === 'Enter') playStage(L, n);
  };
  show();
}

function playStage(L, n) {
  const own = stageWords(L, n);
  let pool = own;
  if (isBoss(n)) {
    const chapterWords = [];
    for (let k = n - CHAPTER + 1; k <= n; k++) chapterWords.push(...stageWords(L, k));
    pool = [...sample(own, 5), ...sample(chapterWords.filter(v => !own.includes(v)), 10)];
  }
  const kinds = ['meaning', 'reading', 'word', 'listen'];
  const qs = shuffle(pool).map((v, k) => {
    const kind = v.w === v.r && (kinds[k % 4] === 'reading') ? 'meaning' : kinds[k % 4];
    return Object.assign(qVocab(v, kind), { item: v });
  });
  main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
  runQuiz(host, qs, {
    title: `第 ${n} 关${isBoss(n) ? ' · 头目关' : ''}`, hearts: 3, requeue: true, xpEach: 5,
    onDone: r => {
      if (!r) return go('game');
      const stars = r.failed ? 0 : r.hearts;
      if (!S.stages[L]) S.stages[L] = {};
      const before = S.stages[L][n] || 0;
      if (stars > before) S.stages[L][n] = stars;
      // 过关时答对的新词进入背单词的复习计划
      let added = 0;
      if (!r.failed) {
        for (const x of r.res) {
          const v = x.q.item;
          if (x.ok && v && !S.srs[v.id]) { S.srs[v.id] = { i: 1, e: 2.5, r: 1, due: startOfToday() + DAY }; added++; }
        }
        addXP((isBoss(n) ? 40 : 15) + stars * 5);
      }
      checkBadges(); save();
      stageResult(host, L, n, r, stars, before, added);
    }
  });
}

function stageResult(host, L, n, r, stars, before, added) {
  host.innerHTML = '';
  const pass = !r.failed;
  const box = h(`<section class="panel">
    <div class="welcome-hi">${neko(pass ? 'wow' : 'sad', 'big')}<div class="bubble"><b lang="ja">${pass ? (stars === 3 ? '完璧！' : 'クリア！') : 'ドンマイ！'}</b><span>${pass ? `第 ${n} 关通过，答对 ${r.score} / ${r.total}。${added ? `${added} 个新词已加入背单词。` : ''}` : '生命值用完了。再看一遍单词，马上就能过。'}</span></div></div>
    <div class="big-stars">${[1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : ''}" style="--d:${i * 0.18}s">★</i>`).join('')}</div>
    ${pass && stars > before && before ? `<p class="small" style="text-align:center">刷新纪录：${before} 星 → ${stars} 星</p>` : ''}
    <div class="row" style="justify-content:center">
      ${pass && n < stageCount(L) ? `<button class="btn pri big" type="button" data-next>下一关</button>` : ''}
      <button class="btn ${pass ? '' : 'pri big'}" type="button" data-retry>${pass ? '再玩一次' : '重新挑战'}</button>
      <button class="btn ghost" type="button" data-map>返回地图</button>
    </div>
  </section>`);
  host.append(box);
  if (pass) celebrate();
  const nx = box.querySelector('[data-next]');
  if (nx) nx.onclick = () => { gameChapter[L] = Math.ceil((n + 1) / CHAPTER); stageIntro(L, n + 1); };
  box.querySelector('[data-retry]').onclick = () => stageIntro(L, n);
  box.querySelector('[data-map]').onclick = () => go('game');
  keyHandler = e => { if (e.key === 'Enter') (nx || box.querySelector('[data-retry]')).click(); };
}

/* 小游戏：60 秒冲刺 */
function sprintGame(L) {
  const pool = VOCAB[L].filter(v => v.q);
  let score = 0, combo = 0, end = Date.now() + 60000, q = null, over = false;
  main.innerHTML = '';
  const box = h(`<section class="panel quiz">
    <div class="row between"><h2>60 秒冲刺 · ${L}</h2><button class="btn ghost" type="button" data-exit>退出</button></div>
    <div class="progress-top"><b class="timer" data-time>60</b><div class="bar"><i data-bar style="width:100%"></i></div><span>得分 <b data-score>0</b></span></div>
    <div data-stage></div>
  </section>`);
  main.append(box);
  const stage = box.querySelector('[data-stage]');
  const nextQ = () => {
    const v = sample(pool, 1)[0];
    q = qVocab(v, Math.random() < .5 ? 'meaning' : (v.w === v.r ? 'meaning' : 'reading'));
    stage.innerHTML = `<div class="q-prompt">${q.prompt}</div><div class="opts">${q.options.map((o, j) => `<button class="opt" type="button" data-o="${j}"><span class="k">${j + 1}</span><span ${q.optLang ? 'lang="ja"' : ''}>${esc(o)}</span></button>`).join('')}</div>`;
    stage.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => pick(+b.dataset.o, b); });
  };
  const pick = (j, b) => {
    if (over) return;
    if (j === q.answer) { score++; combo++; popFrom(b); box.querySelector('[data-score]').textContent = score; if (combo % 5 === 0) end += 3000; nextQ(); }
    else { combo = 0; end -= 3000; b.classList.add('wrong'); stage.querySelectorAll('[data-o]')[q.answer].classList.add('right'); setTimeout(nextQ, 500); }
  };
  keyHandler = e => { if ('1234'.includes(e.key) && q) { const b = stage.querySelectorAll('[data-o]')[+e.key - 1]; if (b) pick(+e.key - 1, b); } };
  clearInterval(examTimer);
  examTimer = setInterval(() => {
    const left = Math.max(0, end - Date.now());
    box.querySelector('[data-time]').textContent = Math.ceil(left / 1000);
    box.querySelector('[data-bar]').style.width = Math.min(100, left / 600) + '%';
    if (!left) finish();
  }, 100);
  box.querySelector('[data-exit]').onclick = () => { clearInterval(examTimer); keyHandler = null; go('game'); };
  const finish = () => {
    over = true; clearInterval(examTimer); keyHandler = null;
    if (!S.games.sprint) S.games.sprint = {};
    const prev = S.games.sprint[L];
    const record = prev == null || score > prev;
    if (record) S.games.sprint[L] = score;
    addXP(score * 2); save();
    stage.innerHTML = `<div class="welcome-hi">${neko(record ? 'wow' : 'happy', 'big')}<div class="bubble"><b>${score} 题！</b><span>${record ? '新纪录！' : `最好成绩是 ${prev} 题。`}获得 ${score * 2} 经验。每连对 5 题会加 3 秒。</span></div></div>
      <div class="row" style="justify-content:center"><button class="btn pri big" type="button" data-again>再来一局</button><button class="btn ghost" type="button" data-map>返回</button></div>`;
    if (record && score) celebrate();
    stage.querySelector('[data-again]').onclick = () => sprintGame(L);
    stage.querySelector('[data-map]').onclick = () => go('game');
  };
  nextQ();
}

/* 小游戏：配对消除 */
function matchGame(L) {
  const pool = VOCAB[L].filter(v => v.q);
  let round = 0, t0 = Date.now(), sel = null, left = 0, misses = 0;
  main.innerHTML = '';
  const box = h(`<section class="panel">
    <div class="row between"><h2>配对消除 · ${L}</h2><button class="btn ghost" type="button" data-exit>退出</button></div>
    <div class="progress-top"><span>第 <b data-round>1</b> / 3 轮</span><div class="bar"><i data-bar style="width:0"></i></div><b class="timer" data-time>0:00</b></div>
    <div class="match" data-board></div>
  </section>`);
  main.append(box);
  const board = box.querySelector('[data-board]');
  clearInterval(examTimer);
  examTimer = setInterval(() => { box.querySelector('[data-time]').textContent = fmtSec(Math.floor((Date.now() - t0) / 1000)); }, 500);
  box.querySelector('[data-exit]').onclick = () => { clearInterval(examTimer); go('game'); };
  const deal = () => {
    // 同一轮里的意思不能重复，否则无法分辨
    const words = [], seen = new Set();
    for (const v of shuffle(pool)) { if (!seen.has(v.m) && !seen.has(v.w)) { seen.add(v.m); seen.add(v.w); words.push(v); } if (words.length === 6) break; }
    left = words.length;
    const a = shuffle(words.map(v => ({ id: v.id, text: v.w, ja: true, say: v.r })));
    const b = shuffle(words.map(v => ({ id: v.id, text: v.m })));
    board.innerHTML = `<div class="match-col">${a.map(x => `<button type="button" class="tile" data-id="${esc(x.id)}" data-side="a" lang="ja">${esc(x.text)}</button>`).join('')}</div>
      <div class="match-col">${b.map(x => `<button type="button" class="tile" data-id="${esc(x.id)}" data-side="b">${esc(x.text)}</button>`).join('')}</div>`;
    board.querySelectorAll('.tile').forEach(t => { t.onclick = () => tap(t); });
    box.querySelector('[data-round]').textContent = round + 1;
  };
  const tap = t => {
    if (t.classList.contains('gone')) return;
    if (!sel || sel.dataset.side === t.dataset.side) {
      if (sel) sel.classList.remove('sel');
      sel = t; t.classList.add('sel');
      if (t.dataset.side === 'a') speak(ITEMS[t.dataset.id].r);
      return;
    }
    if (sel.dataset.id === t.dataset.id) {
      [sel, t].forEach(x => { x.classList.remove('sel'); x.classList.add('gone'); x.disabled = true; });
      popFrom(t); left--;
      box.querySelector('[data-bar]').style.width = ((round * 6 + 6 - left) / 18 * 100) + '%';
      if (!left) { round++; if (round < 3) setTimeout(deal, 400); else finish(); }
    } else {
      misses++;
      [sel, t].forEach(x => { x.classList.add('miss'); setTimeout(() => x.classList.remove('miss', 'sel'), 400); });
    }
    sel = null;
  };
  const finish = () => {
    clearInterval(examTimer);
    const sec = Math.floor((Date.now() - t0) / 1000) + misses * 2;
    if (!S.games.match) S.games.match = {};
    const prev = S.games.match[L], record = prev == null || sec < prev;
    if (record) S.games.match[L] = sec;
    addXP(30); save();
    board.innerHTML = `<div class="welcome-hi" style="grid-column:1/-1">${neko(record ? 'wow' : 'happy', 'big')}<div class="bubble"><b>${fmtSec(sec)}</b><span>${misses ? `含配错 ${misses} 次的罚时（每次 2 秒）。` : '一次都没配错！'}${record ? '新纪录！' : `最快是 ${fmtSec(prev)}。`}获得 30 经验。</span></div></div>
      <div class="row" style="grid-column:1/-1;justify-content:center"><button class="btn pri big" type="button" data-again>再来一局</button><button class="btn ghost" type="button" data-map>返回</button></div>`;
    if (record) celebrate();
    board.querySelector('[data-again]').onclick = () => matchGame(L);
    board.querySelector('[data-map]').onclick = () => go('game');
  };
  deal();
}
