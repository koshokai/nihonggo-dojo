'use strict';
/* 我的弱项（#me/weak）：三种语言、各种题型答错的都记下来，归纳反复错的单词和语法，一键「专练弱项」。
   - 记录：S.wk[语言][key] = { n: 答错次数, c: 之后连续答对次数, t: 最近一次答错, sk: v 单词 / g 语法 / r 阅读 / l 听力 / k 假名·发音,
       l: 显示的词或题目, m: 意思或解说, q: 题目快照（重新出题用；日语的单词、汉字、语法用 ITEMS 重新出题，不存快照）, href: 不能直接重出的题（阅读、听力原题）去哪里重做 }
   - 测验（runQuiz）每答一题都经过 weakLog；阅读文章、听力原题的作答用 weakNote 记。
   - 答错的进来；之后在任何地方连续答对 2 次就移出（算攻克，S.wkFixed[语言] +1）。每种语言最多留 120 条（先删最久没错过的）。
   - 原来的日语错题本（S.wrong）里有、这里没有的并进来（S.wrong 只增不减地跟着这里：在这里攻克的会从 S.wrong 删掉）。 */
const WK_MAX = 120, WK_CLEAR = 2;
const wkTr = () => (S.track === 'en' || S.track === 'zh') ? S.track : 'ja';
const wkT = (tr, zh, ja) => tr === 'zh' ? ja : tr === 'en' ? enNat(zh, ja) : tj(zh, ja);
const wkRoot = tr => ((S.wk = S.wk || {})[tr] = S.wk[tr] || {});
const wkStrip = s => String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const WK_KIND_SK = { reading: 'v', meaning: 'v', word: 'v', kanji: 'v', listen: 'l', grammar: 'g', 'en-gram': 'g', e2grammar: 'g', e2vocab: 'v', e2reading: 'r', readc: 'r', kana: 'k', tone: 'k', w2: 'v' };
const wkCount = (tr = wkTr()) => Object.keys((S.wk || {})[tr] || {}).length;
const weakHref = () => '#me/weak';

// 第一次：把原来的日语错题本并进来
function wkMigrate() {
  const ids = Object.keys(S.wrong || {});
  if (!ids.length) return;
  const root = wkRoot('ja');
  Object.entries(S.wrong || {}).forEach(([id, x]) => {
    const it = typeof ITEMS !== 'undefined' && ITEMS[id];
    if (!it || root[id]) return;
    root[id] = { n: x.n || 1, c: 0, t: x.t || Date.now(), sk: it.type === 'g' ? 'g' : 'v', l: it.w || it.k || it.p || '', m: it.m || it.meaning || it.en || '' };
  });
}

// 测验的每一题（app.js runQuiz 调用）
function weakLog(q, ok) {
  if (!q || q.noWeak) return;
  const tr = q.wkTr || wkTr();
  const key = q.wkKey || q.id || (q.kind + ':' + wkStrip(q.prompt).slice(-60) + '=' + (q.options || [])[q.answer]);
  if (!key) return;
  const root = wkRoot(tr), e = root[key];
  if (ok) {
    if (!e) return;
    e.c = (e.c || 0) + 1;
    if (e.c >= WK_CLEAR) { delete root[key]; (S.wkFixed = S.wkFixed || {})[tr] = ((S.wkFixed || {})[tr] || 0) + 1; if (tr === 'ja' && S.wrong && S.wrong[key]) { delete S.wrong[key]; S.fixed = (S.fixed || 0) + 1; } }
    return;
  }
  const it = tr === 'ja' && q.id && typeof ITEMS !== 'undefined' ? ITEMS[q.id] : null;
  const right = (q.options || [])[q.answer];
  const n = Object.assign({ n: 0 }, e, { n: ((e && e.n) || 0) + 1, c: 0, t: Date.now(), sk: q.sk || WK_KIND_SK[q.kind] || (it && it.type === 'g' ? 'g' : 'v') });
  if (it) { n.l = it.w || it.k || it.p || ''; n.m = it.m || it.meaning || it.en || ''; delete n.q; }
  else {
    n.l = (q.say && q.sk !== 'r' ? q.say : wkStrip(q.prompt).slice(-60)) || '';
    const ex = wkStrip(q.explain);
    n.m = (n.l && ex.startsWith(n.l) ? ex.slice(n.l.length).replace(/^[\s=：:]+/, '') : ex).slice(0, 80) || String(right || '');
    const p = q.prompt || '';
    if (p.length < 4000) n.q = { p, o: q.options, a: q.answer, e: q.explain || '', k: q.kind, say: q.say || '', sl: q.sayLang || '', ol: q.optLang || '', as: q.autoSay || '', al: q.autoLang || '' };
  }
  root[key] = n;
  wkTrim(root);
}
// 不是测验的作答（阅读文章后面的问题、听力原题）：只记下来，练的时候带回原来的地方
function weakNote(tr, key, ok, info) {
  const root = wkRoot(tr), e = root[key];
  if (ok) { if (e) { e.c = (e.c || 0) + 1; if (e.c >= WK_CLEAR) { delete root[key]; (S.wkFixed = S.wkFixed || {})[tr] = ((S.wkFixed || {})[tr] || 0) + 1; } } return; }
  root[key] = Object.assign({}, info, { n: ((e && e.n) || 0) + 1, c: 0, t: Date.now() });
  wkTrim(root);
}
function wkTrim(root) {
  const ks = Object.keys(root);
  if (ks.length <= WK_MAX) return;
  ks.sort((a, b) => root[a].t - root[b].t).slice(0, ks.length - WK_MAX).forEach(k => delete root[k]);
}

/* ---------- 专练弱项 ---------- */
// 能直接出题的：日语 ITEMS 里的、存了快照的；按错的次数多、最近错的排
function wkQuizable(tr) {
  const root = wkRoot(tr);
  return Object.entries(root).filter(([k, e]) => e.q || (tr === 'ja' && typeof ITEMS !== 'undefined' && ITEMS[k]))
    .sort((a, b) => (b[1].n - a[1].n) || (b[1].t - a[1].t));
}
function wkQ(tr, key, e) {
  let q;
  if (e.q) {
    const s = e.q, right = s.o[s.a], options = shuffle(s.o.slice());
    q = { kind: s.k, options, answer: options.indexOf(right), prompt: s.p, explain: s.e, say: s.say, sayLang: s.sl, optLang: s.ol, autoSay: s.as, autoLang: s.al };
  } else q = itemQ(ITEMS[key]);
  return Object.assign(q, { wkKey: key, wkTr: tr, sk: e.sk });
}
function weakPractice(tr = wkTr()) {
  wkMigrate();
  const list = wkQuizable(tr).slice(0, 12);
  if (!list.length) return toast(wkT(tr, '现在没有要练的弱项，继续保持！', 'いま練習する弱点はありません。この調子で！'));
  // 错得多的多出一次（最多 15 题）
  const qs = list.map(([k, e]) => wkQ(tr, k, e));
  list.filter(([, e]) => e.n >= 3).slice(0, 3).forEach(([k, e]) => qs.push(wkQ(tr, k, e)));
  main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
  const title = wkT(tr, '专练弱项', '弱点トレーニング');
  runQuiz(host, shuffle(qs), { title, noRecord: true, xpEach: 6, onDone: r => {
    if (!r) return go('me/weak');
    checkBadges(); save();
    const left = wkCount(tr);
    quizSummary(host, r, { title, again: () => weakPractice(tr), extraHTML: `<p class="small muted">${wkT(tr, `同一道题连续答对 ${WK_CLEAR} 次就会移出弱项。${left ? '' : '弱项全部清空了！'}`, `同じ問題に ${WK_CLEAR} 回続けて正解すると弱点から外れます。${left ? '' : '弱点はすべてクリア！'}`)}</p><a class="btn" href="#me/weak">${wkT(tr, '看我的弱项', '弱点ノートを見る')}</a>` });
  } });
}

/* ---------- 页面（「我的」→ 我的弱项） ---------- */
const WK_SK = { v: ['单词', '単語'], g: ['语法', '文法'], r: ['阅读', '読解'], l: ['听力', '聴解'], k: ['假名 / 发音', 'かな・発音'] };
function weakLogPanel() {
  wkMigrate();
  const tr = wkTr(), T = (zh, ja) => wkT(tr, zh, ja), root = wkRoot(tr);
  const all = Object.entries(root), wk = Date.now() - 7 * DAY;
  const skn = k => k === 'k' && tr === 'zh' ? 'ピンイン・声調' : k === 'k' && tr === 'en' ? T('发音', '発音') : T(...(WK_SK[k] || WK_SK.v));
  const by = {}; all.forEach(([, e]) => { by[e.sk || 'v'] = (by[e.sk || 'v'] || 0) + 1; });
  const top = all.slice().sort((a, b) => (b[1].n - a[1].n) || (b[1].t - a[1].t)).slice(0, 15);
  const quizN = wkQuizable(tr).length, newW = all.filter(([, e]) => e.t >= wk).length, fixed = (S.wkFixed || {})[tr] || 0;
  const L = tr === 'en' ? 'en' : tr === 'zh' ? 'zh-CN' : 'ja';
  const p = h(`<section class="panel"><h2>${T('我的弱项', '弱点ノート')}</h2>
    ${all.length ? `<p class="muted">${T(`现在有 ${all.length} 个待巩固，本周新增 ${newW} 个，已经攻克 ${fixed} 个。同一道题连续答对 ${WK_CLEAR} 次就会移出。`, `いま復習が必要なのは ${all.length} 個（今週 +${newW}）。これまでに ${fixed} 個を克服。同じ問題に ${WK_CLEAR} 回続けて正解すると外れます。`)}</p>
      <div class="wk-sk">${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="tag">${esc(skn(k))} ${n}</span>`).join('')}</div>
      ${quizN ? `<div class="row"><button class="btn pri" type="button" data-wkgo>${T('专练弱项', '弱点トレーニング')}</button></div>` : ''}
      <h3>${T('反复出错', 'よく間違えるもの')}</h3>
      <div class="wk-list">${top.map(([k, e]) => `<div class="wk-item"><div class="wk-top"><b lang="${L}">${esc(String(e.l || '').slice(0, 60))}</b><span class="tag">${esc(skn(e.sk || 'v'))} · ${T(`错 ${e.n} 次`, `${e.n} 回ミス`)}</span></div>${e.m ? `<div class="small muted">${esc(String(e.m).slice(0, 80))}</div>` : ''}${e.href && !e.q ? `<a class="small" href="${esc(/^#[\w/%.-]*$/.test(String(e.href || '')) ? e.href : '#me/weak')}">${T('去重做 ›', 'もう一度 ›')}</a>` : ''}</div>`).join('')}</div>`
      : `<p class="muted">${T('还没有记录。做测验、闯关、阅读、听力答错的题会自动记在这里，方便集中复习。', 'まだ記録はありません。クイズ・ステージ・読解・聴解で間違えた問題がここに自動で記録され、まとめて復習できます。')}</p>`}
    ${ptLogHTML(tr)}
  </section>`);
  const b = p.querySelector('[data-wkgo]'); if (b) b.onclick = () => weakPractice(tr);
  return p;
}
// 最近的阶段测试成绩（path.js 记的）
function ptLogHTML(tr) {
  const T = (zh, ja) => wkT(tr, zh, ja), log = ((S.pathLog || {})[tr] || []).slice(-5).reverse();
  if (!log.length) return `<p class="small muted">${T('学完一个阶段可以做阶段测试，看看哪里还没掌握。', 'ステージが終わったらステージテストで定着度をチェックできます。')} <a href="#path">${T('学习路线 ›', 'ロードマップ ›')}</a></p>`;
  return `<h3>${T('最近的阶段测试', '最近のステージテスト')}</h3><div class="pt-hist">${log.map(e => { const pct = Math.round(e.s / e.n * 100); return `<div class="pt-h"><span class="small muted">${esc(dkey(new Date(e.at)).slice(5))}</span><span>${esc(e.lv)} · ${esc(e.t)}</span><b class="${pct >= 80 ? 'ok' : 'no'}">${pct}%</b></div>`; }).join('')}</div><a class="small" href="#path">${T('学习路线 ›', 'ロードマップ ›')}</a>`;
}
// 首页任务：有能练的弱项就出现
function weakTask(tr = wkTr()) {
  wkMigrate();
  const n = wkQuizable(tr).length;
  if (!n) return null;
  return { ic: wkT(tr, '弱', '弱'), t: wkT(tr, '专练弱项', '弱点トレーニング'), d: wkT(tr, `有 ${n} 道答错过的题，连续答对 ${WK_CLEAR} 次就移出`, `間違えた問題が ${n} 問。${WK_CLEAR} 回続けて正解でクリア`), go: () => weakPractice(tr) };
}
