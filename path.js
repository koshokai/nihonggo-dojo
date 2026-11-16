'use strict';
/* 学习路线（#path）和阶段测试。
   每门语言、每个级别拆成几个有先后顺序的阶段：（入门：五十音 / 拼音）→ 单元 1…n（单词 + 语法）→ 阅读与听力 → 毕业测试。
   - 进度用已有的学习数据算（单词卡、语法、阅读、听力、闯关……），不用从头来；页面上只显示百分比。
   - 每个阶段学完做一次阶段测试（10–15 题，只考这个阶段的内容），80% 过关；已经会的可以直接挑战，过了就算完成。
   - 每个级别最后是毕业测试（20 题，单词、语法、阅读、听力综合），通过后建议升到下一级。
   记录：S.path[语言][级别][阶段 id] = { b: 最好成绩（0–1）, at: 通过时间（没通过是 0）}
        S.pathLog[语言] = [{ lv, id, t: 阶段名, s: 答对, n: 题数, at }]（最近 50 次）
        S.ptOk[语法 id] = 1：阶段测试里答对过的语法（算进路线的语法进度）
   阶段测试答错的题照常进「我的弱项」（weak.js）。 */
const PT_PASS = 0.8;
const PT_UNITS = { N5: 4, N4: 4, N3: 6, N2: 6, N1: 8, A1: 4, A2: 4, B1: 6, B2: 6, C1: 4, HSK1: 2, HSK2: 2, HSK3: 3, HSK4: 4, HSK5: 6, HSK6: 8 };
const PT_LEVELS = { ja: () => LEVELS, en: () => EN_LV, zh: () => ZH_LEVELS.map(x => x[0]) };
const ptTr = () => (S.track === 'en' || S.track === 'zh') ? S.track : 'ja';
// 界面文字：日语板块按界面语言（中文 / 日语），英语板块按母语，中文板块只有日语
const ptT = (tr, zh, ja) => tr === 'zh' ? ja : tr === 'en' ? enNat(zh, ja) : tj(zh, ja);
const ptCurLv = tr => tr === 'ja' ? S.level : tr === 'en' ? enLevel() : zhLevel();
function ptSetLv(tr, lv) {
  if (tr === 'ja') S.level = lv; else if (tr === 'en') enSetLevel(lv); else S.zhLevel = lv;
  save();
}
// 通过了几次阶段测试（印章用；id 指定时只数这一种，例如 'grad'）
const ptPassN = id => Object.values(S.path || {}).flatMap(a => Object.values(a)).flatMap(o => Object.entries(o)).filter(([k, r]) => r && r.at && (!id || k === id)).length;
const ptRec = (tr, lv, id) => ((((S.path || {})[tr] || {})[lv] || {})[id]) || null;
const ptPassed = (tr, lv, id) => !!(ptRec(tr, lv, id) || {}).at;
const ptChunk = (arr, k, n) => arr.slice(Math.floor(arr.length * k / n), Math.floor(arr.length * (k + 1) / n));
const ptPct = x => Math.round(Math.max(0, Math.min(1, x)) * 100);
const ptRatio = (n, d) => d ? Math.min(1, n / d) : 0;
const ptMember = tr => typeof isMember === 'function' && isMember(tr);
const ptWordDone = x => ((S.srs || {})[x.id] || {}).r > 0;
const ptGramDone = (tr, g) => !!((S.ptOk || {})[g.id] || (tr === 'ja' ? ((S.srs || {})[g.id] || {}).r > 0 : tr === 'en' ? (S.enGram || {})[g.id] : (S.zhGr || {})[g.id]));

/* ---------- 每个级别的数据（英语、中文要先下载） ---------- */
function ptData(tr, lv) {
  if (tr === 'ja') return Promise.resolve({ words: LEARN[lv].filter(v => v.q), gram: GRAM[lv] });
  if (tr === 'en') return Promise.all([enFetch(`en-${lv}`), enFetch(`en-g-${lv}`).catch(() => []), enFetch(`en-r-${lv}`).catch(() => []), enFetch(`en-l-${lv}`).catch(() => [])])
    .then(([w, g, r, l]) => ({ words: enItems(lv, w).filter(x => x.zh && x.ja), gram: enFree(g).filter(x => x.quiz && x.quiz.length), reads: enFree(r).filter(a => a.p && a.q && a.q.length), listens: enFree(l) }));
  const n = +lv.slice(3);
  return Promise.all([zhHsk(n), zhGrammar().catch(() => []), zhRead().catch(() => []), zhListen().catch(() => [])])
    .then(([w, g, r, l]) => ({ words: w.filter(x => x.ja), gram: g.filter(x => x.lv === lv && x.q && x.q.length), reads: r.filter(a => a.lv === lv && a.p && a.q && a.q.length), listens: l.filter(x => x.lv === lv) }));
}

/* ---------- 阶段 ---------- */
// 阶段：{ id, ic, t, d, prog, parts: [[名称, 0–1]], acts: [[按钮文字, 链接]], test: () => Promise<题目>, n: 题数, grad }
const ptPhases = (tr, lv) => ptData(tr, lv).then(D => ptBuild(tr, lv, D));
// 日语的数据都在本地，可以同步算（首页卡片用）
const ptPhasesJa = lv => ptBuild('ja', lv, { words: LEARN[lv].filter(v => v.q), gram: GRAM[lv] });
function ptBuild(tr, lv, D) {
  {
    const T = (zh, ja) => ptT(tr, zh, ja), ph = [];
    const P = tr === 'ja' ? '#' : `#${tr}/`;
    // 入门：日语五十音、中文拼音（只在第一级）
    if (tr === 'ja' && lv === 'N5') ph.push({ id: 'kana', ic: 'あ', t: T('五十音', '五十音'), d: T('平假名、片假名先认全，后面的单词才读得出来。', 'ひらがな・カタカナをまず全部読めるように。'),
      prog: ptRatio(S.kanaRight || 0, 80), parts: [], acts: [[T('假名表和测验', 'かな表とクイズ'), '#kana']], n: 15, test: () => ptKanaQs() });
    if (tr === 'zh' && lv === 'HSK1') {
      const tone = typeof qstatSum === 'function' ? ((qstatSum(60, 'zh').tone || [0])[0]) : 0;
      ph.push({ id: 'pinyin', ic: 'ā', t: 'ピンインと声調', d: '中国語の発音記号と 4 つの声調。ここを押さえると単語がぐっと覚えやすくなります。',
        prog: ptRatio(tone, 30), parts: [], acts: [['ピンイン表', '#zh/pinyin']], n: 12, test: () => ptPinyinQs(D) });
    }
    // 单元：单词 + 语法按学习顺序分成几份
    const U = PT_UNITS[lv] || 4;
    for (let k = 0; k < U; k++) {
      const ws = ptChunk(D.words, k, U), gs = ptChunk(D.gram, k, U);
      const wp = ptRatio(ws.filter(ptWordDone).length, ws.length), gp = ptRatio(gs.filter(g => ptGramDone(tr, g)).length, gs.length);
      const acts = tr === 'ja' ? [[T('背新词', '新しい単語'), `ptnew:${k}`], [T('闯关', 'ステージ'), '#game'], gs.length && [T('语法', '文法'), '#grammar']]
        : tr === 'en' ? [['Words', `#en/words/${lv}`], ['Path', `#en/path/${lv}`], gs.length && ['Grammar', `#en/grammar/${lv}`]]
        : [['単語', '#zh/words'], ['学習ルート', `#zh/path/${lv}`], gs.length && ['文法', `#zh/grammar/${lv}`]];
      ph.push({ id: `u${k + 1}`, ic: String(k + 1), t: T(`单元 ${k + 1}`, `ユニット ${k + 1}`), d: gs.length ? T('这一组单词和语法', 'この範囲の単語と文法') : T('这一组单词', 'この範囲の単語'),
        prog: gs.length ? wp * 0.7 + gp * 0.3 : wp, parts: [[T('单词', '単語'), wp], ...(gs.length ? [[T('语法', '文法'), gp]] : [])],
        acts: acts.filter(Boolean), words: ws, n: 12, test: () => ptUnitQs(tr, lv, D, ws, gs) });
    }
    // 实战：阅读和听力
    let rp, lp, acts;
    if (tr === 'ja') {
      const readable = ['N5', 'N4', 'N3'].includes(lv) || ptMember('ja');
      rp = readable ? ptRatio(Object.keys(S.read || {}).filter(id => id.startsWith(lv.toLowerCase() + '-')).length, 5) : null;
      lp = ptRatio((S.listenHist || []).filter(e => e.L === lv && (e.lang || 'ja') === 'ja').length, 2);
      acts = [[T('阅读', '読解'), '#read'], [T('听力', '聴解'), '#listen'], ['N5', 'N4', 'N3'].includes(lv) && [T('情景课程', 'シーン別レッスン'), '#course']].filter(Boolean);
    } else if (tr === 'en') {
      rp = D.reads.length ? ptRatio(D.reads.filter(a => (S.enRead || {})[a.id] != null).length, Math.min(5, D.reads.length)) : null;
      lp = D.listens.length ? ptRatio(D.listens.filter(x => (S.enListen || {})[x.id] != null).length, Math.min(8, D.listens.length)) : null;
      acts = [['Reading', `#en/read/${lv}`], ['Listening', `#en/listen/${lv}`], ['Courses', '#en/course']];
    } else {
      rp = D.reads.length ? ptRatio(D.reads.filter(a => (S.zhRead || {})[a.id]).length, Math.min(5, D.reads.length)) : null;
      lp = D.listens.length ? ptRatio(D.listens.filter(x => (S.zhLs || {})[x.id]).length, Math.min(5, D.listens.length)) : null;
      acts = [['読み物', '#zh/read'], ['リスニング', '#zh/listen'], ['シーン別会話', '#zh/course']];
    }
    const parts = [rp != null && [T('阅读', '読解'), rp], lp != null && [T('听力', '聴解'), lp]].filter(Boolean);
    ph.push({ id: 'use', ic: T('读', '読'), t: T('阅读与听力', '読解と聴解'), d: T('把学过的词和语法用起来：读几篇短文，做几次听力。', '覚えた単語と文法を実際に使う段階。短い文章とリスニングに挑戦。'),
      prog: parts.length ? parts.reduce((a, p) => a + p[1], 0) / parts.length : 0, parts, acts, n: 10, test: () => ptUseQs(tr, lv, D) });
    // 模拟考（这一级的模拟考能用时：免费级别或会员）
    const mock = ptMock(tr, lv); if (mock) ph.push(mock);
    // 毕业测试
    const before = ph.length;
    ph.push({ id: 'grad', ic: T('业', '卒'), t: T(`${lv} 毕业测试`, `${lv} 卒業テスト`), d: T('单词、语法、阅读、听力综合 20 题，80% 毕业，可以升到下一级。', '単語・文法・読解・聴解の総合 20 問。80% で卒業、次のレベルへ。'),
      prog: ptRatio(ph.filter(p => ptPassed(tr, lv, p.id)).length, before), parts: [], acts: [], grad: true, n: 20, test: () => ptGradQs(tr, lv, D) });
    return ph;
  }
}
// 现在该做哪一步：第一个还没通过测试的阶段
const ptCurIdx = (tr, lv, ph) => { const i = ph.findIndex(p => !ptPassed(tr, lv, p.id)); return i < 0 ? ph.length : i; };

/* ---------- 页面 ---------- */
function viewPath(arg) {
  const tr = ptTr(), T = (zh, ja) => ptT(tr, zh, ja), lvs = PT_LEVELS[tr]();
  const lv = lvs.includes(arg) ? arg : ptCurLv(tr);
  const p = h(`<section class="panel pt-page"><div class="row between"><h2>${T('学习路线', '学習ロードマップ')}</h2></div><div class="skel" role="status"><i></i><i></i><i></i></div></section>`);
  main.append(p);
  ptPhases(tr, lv).then(ph => {
    if (!p.isConnected) return;
    const cur = ptCurIdx(tr, lv, ph), done = cur >= ph.length;
    ptCache(tr, lv, ph);
    const lvChip = L => `<a role="button" href="#path/${L}" class="${L === lv ? 'on' : ''}">${L}${ptPassed(tr, L, 'grad') ? ' ✓' : ''}</a>`;
    p.innerHTML = `<div class="row between"><h2>${T('学习路线', '学習ロードマップ')}</h2><a class="small" href="#check">${T('测测现在的水平 ›', 'レベルチェック ›')}</a></div>
      <div class="seg read-lv" role="group" aria-label="${T('级别', 'レベル')}">${lvs.map(lvChip).join('')}</div>
      <p class="small muted">${T('按顺序一步一步来。零基础从第 1 步开始；已经会的部分可以直接做阶段测试，过了就算完成。', '上から順番に進めましょう。はじめての人は 1 から。もう分かる部分はステージテストに合格すればスキップできます。')}</p>
      ${done ? `<div class="pt-done">${neko('wow', 'mini')}<div><b>${T(`${lv} 已经毕业！`, `${lv} 卒業おめでとう！`)}</b>${ptNextLv(tr, lv) ? `<div class="small muted">${T(`可以开始 ${ptNextLv(tr, lv)} 了。`, `次は ${ptNextLv(tr, lv)} に進みましょう。`)}</div>` : ''}</div><div class="row">${typeof shareCertCanvas === 'function' ? `<button class="btn soft" type="button" data-cert>${T('分享毕业证书', '卒業証書をシェア')}</button>` : ''}${ptNextLv(tr, lv) ? `<button class="btn pri" type="button" data-up>${T(`升到 ${ptNextLv(tr, lv)}`, `${ptNextLv(tr, lv)} へ進む`)}</button>` : ''}</div></div><div data-certout></div>` : ''}
      ${ptNewbie(tr, lv, cur)}
      ${ptJourney(tr, lv, ph, cur)}
      <ol class="pt-list">${ph.map((x, i) => ptStepHTML(tr, lv, x, i, cur)).join('')}</ol>
      ${ptAdvHTML(tr, lv)}
      ${ptHistHTML(tr)}`;
    p.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => ptAct(tr, lv, ph, b.dataset.act); });
    p.querySelectorAll('[data-test]').forEach(b => { b.onclick = () => ptStart(tr, lv, ph[+b.dataset.test], false); });
    const up = p.querySelector('[data-up]'); if (up) up.onclick = () => { const nx = ptNextLv(tr, lv); ptSetLv(tr, nx); go(`path/${nx}`); };
    const cb = p.querySelector('[data-cert]'); if (cb) cb.onclick = () => ptShareCert(tr, lv, p.querySelector('[data-certout]'));
    const c = p.querySelector('.pt-step.cur'); if (c && cur > 1) requestAnimationFrame(() => c.scrollIntoView({ block: 'center', behavior: 'auto' }));
  }).catch(() => { if (p.isConnected) p.innerHTML = `<h2>${T('学习路线', '学習ロードマップ')}</h2><p class="muted">${T('暂时打不开，请检查网络后再试。', '読み込めませんでした。通信状況を確認してください。')}</p>`; });
}
const ptNextLv = (tr, lv) => { const a = PT_LEVELS[tr](); return a[a.indexOf(lv) + 1] || ''; };
function ptStepHTML(tr, lv, x, i, cur) {
  const T = (zh, ja) => ptT(tr, zh, ja), rec = ptRec(tr, lv, x.id), passed = !!(rec && rec.at), isCur = i === cur;
  const ready = x.grad ? x.prog >= 1 : x.prog >= PT_PASS;
  const state = passed ? 'done' : isCur ? 'cur' : i > cur ? 'later' : '';
  const best = rec && rec.b ? T(`最好 ${ptPct(rec.b)}%`, `最高 ${ptPct(rec.b)}%`) : '';
  return `<li class="pt-step ${state}">
    <span class="pt-n" lang="${tr === 'en' ? 'en' : 'ja'}">${passed ? '✓' : esc(x.ic)}</span>
    <div class="pt-body">
      <div class="row between"><b>${esc(x.t)}</b>${isCur ? `<span class="pt-here">${neko('happy', 'mini')}${T('你在这里', 'いまここ')}</span>` : passed ? `<span class="tag done">${rec.via === 'check' ? T('水平测试已跳过', 'レベルチェックでスキップ') : T('已通过', '合格')}${best ? ' · ' + best : ''}</span>` : best ? `<span class="small muted">${best}</span>` : ''}</div>
      <div class="small muted">${esc(x.d)}</div>
      ${x.grad ? '' : `<div class="pt-prog"><div class="bar"><i style="width:${ptPct(x.prog)}%"></i></div><span class="small">${ptPct(x.prog)}%</span></div>`}
      ${x.parts.length > 1 ? `<div class="small muted">${x.parts.map(([n, v]) => `${esc(n)} ${ptPct(v)}%`).join(' · ')}</div>` : ''}
      ${!passed && (isCur || x.prog > 0) ? ptEta(tr, x) : ''}
      ${!passed ? ptStuck(tr, lv, x) : ''}
      ${x.mock ? `<div class="row pt-acts">${x.acts.map(([t, a]) => `<button class="btn ${passed ? 'ghost' : isCur ? 'pri' : 'soft'}" type="button" data-act="${esc(a)}">${esc(passed ? T('再考一次', 'もう一度受ける') : t)}</button>`).join('')}</div>`
        : `<div class="row pt-acts">${(isCur || (x.prog > 0 && !passed) ? x.acts : []).map(([t, a]) => `<button class="btn soft" type="button" data-act="${esc(a)}">${esc(t)}</button>`).join('')}
        <button class="btn ${ready && !passed ? 'pri' : 'ghost'}" type="button" data-test="${i}">${passed ? T('再测一次', 'もう一度') : x.grad ? T('毕业测试', '卒業テスト') : ready ? T('阶段测试', 'ステージテスト') : T('直接挑战', 'いきなり挑戦')}</button></div>`}
      ${isCur ? ptTip(tr, x, true) : ''}
    </div></li>`;
}
function ptHistHTML(tr) {
  const T = (zh, ja) => ptT(tr, zh, ja), log = ((S.pathLog || {})[tr] || []).slice(-6).reverse();
  if (!log.length) return '';
  return `<h3>${T('测试记录', 'テストの記録')}</h3><div class="pt-hist">${log.map(e => { const pct = Math.round(e.s / e.n * 100); return `<div class="pt-h"><span class="small muted">${esc(dkey(new Date(e.at)).slice(5))}</span><span>${esc(e.lv)} · ${esc(e.t)}</span><b class="${pct >= PT_PASS * 100 ? 'ok' : 'no'}">${pct}%</b></div>`; }).join('')}</div>`;
}
// 学习按钮：先把级别切到这一级（闯关、语法等页面按当前级别显示），再去对应页面
function ptAct(tr, lv, ph, a) {
  if (ptCurLv(tr) !== lv) ptSetLv(tr, lv);
  const m = /^ptnew:(\d+)$/.exec(a);
  if (m) {
    const ws = (ph.find(x => x.id === `u${+m[1] + 1}`) || {}).words || [];
    const ids = ws.filter(v => !S.srs[v.id]).slice(0, 10).map(v => v.id);
    if (!ids.length) return toast(tj('这一单元的单词都学过了，可以做阶段测试了', 'このユニットの単語はすべて学習済み。ステージテストに挑戦しよう'));
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    return startCards(host, ids, tj(`${lv} 新单词`, `${lv} 新しい単語`), () => go(`path/${lv}`));
  }
  location.hash = a;
}

/* ---------- 首页卡片：路线的下一步 ---------- */
// 上次算出来的「现在在哪一步」存起来，首页不用再下载数据：S.ptCur[语言] = { lv, i, n, t, p }
function ptCache(tr, lv, ph) { (S.ptCur = S.ptCur || {})[tr] = ptCurOf(tr, lv, ph); save(); }
const ptCurOf = (tr, lv, ph) => { const cur = ptCurIdx(tr, lv, ph), x = ph[Math.min(cur, ph.length - 1)]; return { lv, i: cur, n: ph.length, t: x.t, p: cur >= ph.length ? 1 : x.prog }; };
function pathCard() {
  const tr = ptTr(), T = (zh, ja) => ptT(tr, zh, ja), lv = ptCurLv(tr);
  let c = (S.ptCur || {})[tr];
  if (tr === 'ja') c = (S.ptCur = S.ptCur || {}).ja = ptCurOf('ja', lv, ptPhasesJa(lv));   // 记下来：云端同步后学习提醒会写「还差多少」（supabase/functions/notify）
  else if (!c || c.lv !== lv) { c = null; ptPhases(tr, lv).then(ph => { (S.ptCur = S.ptCur || {})[tr] = ptCurOf(tr, lv, ph); }).catch(() => {}); }
  const sub = c ? (c.i >= c.n ? T(`${lv} 已毕业，可以升到下一级了`, `${lv} 卒業！ 次のレベルへ`) : T(`${lv} · 第 ${c.i + 1} 步：${c.t}（${ptPct(c.p)}%）`, `${lv}・ステップ ${c.i + 1}：${c.t}（${ptPct(c.p)}%）`))
    : T('从哪里开始、学到哪一步、什么时候升级，一目了然', 'どこから始めて、いまどこまで来たか、いつ次のレベルに進むか');
  const el = h(`<a class="panel pt-card" href="#path/${lv}"><span class="pt-card-ic" lang="ja">${T('路', '道')}</span><div><b>${T('学习路线', '学習ロードマップ')}</b><div class="small muted">${esc(sub)}</div>${c && c.i < c.n ? `<div class="bar"><i style="width:${ptPct((c.i + c.p) / c.n)}%"></i></div>` : ''}</div><span class="pt-card-go">${T('继续', '続ける')} ›</span></a>`);
  return el;
}

/* ---------- 阶段测试 ---------- */
async function ptStart(tr, lv, x, confirmed) {
  const T = (zh, ja) => ptT(tr, zh, ja);
  audioPrime();   // 题目要先下载，听力题等一会儿才自动播放：点击当下先解锁播放器（iPhone）
  const ready = x.grad ? x.prog >= 1 : x.prog >= PT_PASS;
  if (!confirmed && !ready && !ptPassed(tr, lv, x.id)) {
    const ok = await askConfirm(x.grad ? T('前面的阶段还没全部通过。已经有把握的话可以直接考毕业测试。', 'まだ合格していないステージがあります。自信があれば、このまま卒業テストを受けられます。')
      : T('这一阶段还没学完。已经会了的话可以直接挑战，80% 就算通过。', 'このステージはまだ学習途中です。もう分かっているなら、このまま挑戦できます（80% で合格）。'), T('开始测试', 'テストを始める'), T('先去学', '先に学習する'));
    if (!ok) return;
  }
  main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
  host.append(h('<section class="panel"><div class="skel" role="status"><i></i><i></i><i></i></div></section>'));
  let qs;
  try { qs = (await x.test()).filter(Boolean); } catch (e) { qs = []; }
  if (!host.isConnected) return;
  if (qs.length < 5) { host.innerHTML = `<section class="panel"><p class="muted">${T('题目还没准备好（需要联网下载），请稍后再试。', '問題を準備できませんでした（通信が必要です）。しばらくしてからもう一度お試しください。')}</p><a class="btn" href="#path/${lv}">${T('回到路线', 'ロードマップへ')}</a></section>`; return; }
  const title = `${x.grad ? '' : T('阶段测试 · ', 'ステージテスト・')}${x.t}`;
  runQuiz(host, qs, { title, exam: true, xpEach: 0, onDone: r => { if (!r) return go(`path/${lv}`); ptResult(host, tr, lv, x, r, title); } });
}
const PT_SK = { v: ['单词', '単語'], g: ['语法', '文法'], r: ['阅读', '読解'], l: ['听力', '聴解'], k: ['假名 / 发音', 'かな・発音'] };
function ptResult(host, tr, lv, x, r, title) {
  const T = (zh, ja) => ptT(tr, zh, ja), pct = r.score / r.total, pass = pct >= PT_PASS;
  // 记录
  const st = (((S.path = S.path || {})[tr] = S.path[tr] || {})[lv] = S.path[tr][lv] || {});
  const old = st[x.id] || { b: 0, at: 0 }, first = pass && !old.at;
  st[x.id] = { b: Math.max(old.b || 0, pct), at: old.at || (pass ? Date.now() : 0) };
  const log = ((S.pathLog = S.pathLog || {})[tr] = S.pathLog[tr] || []);
  log.push({ lv, id: x.id, t: x.t, s: r.score, n: r.total, at: Date.now() });
  if (log.length > 50) log.splice(0, log.length - 50);
  r.res.forEach(y => { if (y.ok && y.q.gid) (S.ptOk = S.ptOk || {})[y.q.gid] = 1; });
  addXP(r.score * 3 + (first ? (x.grad ? 100 : 30) : 0));
  if (first) { if (typeof fxFireworks === 'function' && !fxCalm()) fxFireworks(1500); else celebrate(); }
  checkBadges(); save();
  // 各项正确率
  const sk = {};
  r.res.forEach(y => { const k = y.q.sk || 'v'; (sk[k] = sk[k] || [0, 0])[0]++; if (y.ok) sk[k][1]++; });
  const rows = Object.entries(sk).map(([k, [n, ok]]) => ({ k, pct: ok / n }));
  const weak = rows.filter(z => z.pct < PT_PASS).sort((a, b) => a.pct - b.pct)[0];
  const nm = k => k === 'k' && tr === 'zh' ? 'ピンイン・声調' : T(...PT_SK[k]);
  const nextLv = x.grad ? ptNextLv(tr, lv) : '';
  const extra = `<div class="pt-res ${pass ? 'ok' : 'no'}">
    <b>${pass ? (x.grad ? T(`恭喜，${lv} 毕业了！`, `${lv} 卒業おめでとう！`) : T('过关！这一阶段完成了。', '合格！ このステージはクリアです。')) : T(`还差一点，${Math.round(PT_PASS * 100)}% 过关。`, `あと少し。${Math.round(PT_PASS * 100)}% で合格です。`)}</b>
    <div class="weak-bars">${rows.map(z => `<div class="weak-row"><span>${esc(nm(z.k))}</span><div class="bar ${z.pct < 0.6 ? 'low' : z.pct < PT_PASS ? 'mid' : ''}"><i style="width:${ptPct(z.pct)}%"></i></div><b>${ptPct(z.pct)}%</b></div>`).join('')}</div>
    ${!pass && weak ? `<p class="small">${T(`最弱的是「${nm(weak.k)}」，建议先补这一块再来。错的题已经记进「我的弱项」。`, `いちばん弱いのは「${nm(weak.k)}」。ここを復習してから再挑戦しましょう。間違えた問題は「弱点ノート」に記録しました。`)}</p>` : ''}
    ${pass && x.grad ? `<div class="pt-cert"><span class="pt-cert-ic">🎓</span><div><div class="eyebrow">${T('毕业证书', '卒業証書')}</div><b>${esc(lv)} · ${ptPct(pct)}%</b><div class="small muted">${esc(dkey())}${typeof myName === 'function' && myName() ? ' · ' + esc(myName()) : ''}</div></div>${typeof shareCertCanvas === 'function' ? `<button class="btn soft" type="button" data-cert>${T('分享证书', '証書をシェア')}</button>` : ''}</div><div data-certout></div>` : ''}
    ${pass && x.grad && nextLv ? `<p class="small">${T(`建议升到 ${nextLv}，继续往上走。`, `${nextLv} に進みましょう。`)}</p>` : ''}
    <div class="row">${pass && x.grad && nextLv ? `<button class="btn pri" type="button" data-ptup>${T(`升到 ${nextLv}`, `${nextLv} へ進む`)}</button>` : ''}<a class="btn ${pass && !(x.grad && nextLv) ? 'pri' : ''}" href="#path/${lv}">${pass && !x.grad ? T('继续下一步', '次のステップへ') : T('回到路线', 'ロードマップへ')}</a>${!pass && typeof weakHref === 'function' ? `<a class="btn" href="${weakHref()}">${T('专练弱项', '弱点を練習')}</a>` : ''}</div>
  </div>`;
  quizSummary(host, r, { title, again: () => ptStart(tr, lv, x, true), extraHTML: extra });
  const up = host.querySelector('[data-ptup]'); if (up) up.onclick = () => { ptSetLv(tr, nextLv); go(`path/${nextLv}`); };
  const cb = host.querySelector('[data-cert]'); if (cb) cb.onclick = () => ptShareCert(tr, lv, host.querySelector('[data-certout]'));
}
// 毕业证书做成图片（sharecard.js），可以分享、保存
async function ptShareCert(tr, lv, out) {
  const r = ptRec(tr, lv, 'grad');
  if (!r || !r.at || !out || typeof shareCertCanvas !== 'function') return;
  out.innerHTML = '<div class="skel" role="status"><i></i><i></i></div>';
  shareCanvasOut(out, await shareCertCanvas(tr, lv, r.b, r.at, typeof scQR === 'function' ? await scQR() : ''), ptT(tr, `${lv} 毕业证书`, `${lv} 卒業証書`), tr);
}

/* ---------- 出题 ---------- */
const ptTag = (q, sk, gid) => { if (q) { q.sk = sk; if (gid) q.gid = gid; } return q; };
// 优先考学过的词（不够就用这一组里的其他词）
function ptPickWords(ws, n) {
  const known = ws.filter(ptWordDone);
  return sample(known.length >= n ? known : ws, Math.min(n, ws.length));
}
function ptWordQs(tr, lv, D, ws, n, listenN = 0) {
  const pick = ptPickWords(ws, n);
  const kinds = tr === 'ja' ? ['reading', 'meaning', 'word'] : ['meaning', 'word'];
  return pick.map((v, i) => i < listenN ? ptWordQ(tr, D, v, 'listen') : ptWordQ(tr, D, v, kinds[i % kinds.length]));
}
function ptWordQ(tr, D, v, kind) {
  if (tr === 'ja') return ptTag(qVocab(v, kind), kind === 'listen' ? 'l' : 'v');
  const pool = D.words.filter(y => y !== v);
  if (tr === 'en') {
    const gl = enGloss, near = pool.filter(y => y.pos === v.pos && gl(y) !== gl(v));
    if (kind === 'word') {
      const opts = pt3(sample((near.length >= 3 ? near : pool).filter(y => y.w !== v.w), 6).map(y => y.w), pool.map(y => y.w), v.w);
      return ptTag(makeQ(v, 'word', opts, v.w, { prompt: `<div class="eyebrow">Which word means…</div><div class="q-big">${esc(gl(v))}</div>`, optLang: 'en', say: v.w, sayLang: 'en-US', explain: `<b lang="en">${esc(v.w)}</b> = ${esc(gl(v))}` }), 'v');
    }
    const opts = pt3(sample(near.length >= 3 ? near : pool, 6).map(gl), pool.map(gl), gl(v));
    const listen = kind === 'listen';
    return ptTag(makeQ(v, listen ? 'listen' : 'meaning', opts, gl(v), {
      prompt: listen ? `<div class="eyebrow">Listen and choose the meaning</div>${sayBtn(v.w, 'en-US')}` : `<div class="eyebrow">Choose the meaning</div><div class="q-big" lang="en">${esc(v.w)}</div>`,
      autoSay: listen ? v.w : '', autoLang: 'en-US', say: v.w, sayLang: 'en-US', explain: `<b lang="en">${esc(v.w)}</b> = ${esc(gl(v))}` }), listen ? 'l' : 'v');
  }
  const short = y => y.ja.split('；')[0];
  if (kind === 'word') {
    const opts = sample(pool.filter(y => y.w !== v.w && y.w.length === v.w.length).concat(sample(pool, 6)).filter(y => y.w !== v.w), 8).map(y => y.w);
    return ptTag(makeQ(v, 'word', pt3(opts, pool.map(y => y.w), v.w), v.w, { prompt: `<div class="eyebrow">「${esc(short(v))}」は中国語で？</div>`, optLang: 'zh-CN', say: v.w, sayLang: 'zh-CN', explain: `<span lang="zh-CN">${esc(v.w)}</span> ${esc(v.py)}：${esc(v.ja)}` }), 'v');
  }
  const opts = pt3(sample(pool, 8).map(short), pool.map(short), short(v));
  const listen = kind === 'listen';
  return ptTag(makeQ(v, listen ? 'listen' : 'meaning', opts, short(v), {
    prompt: listen ? `<div class="eyebrow">音声を聞いて、意味を選んでください</div>${sayBtn(v.w, 'zh-CN')}` : `<div class="eyebrow">この単語の意味は？</div><div class="q-big" lang="zh-CN">${esc(v.w)}</div><div class="small muted">${esc(v.py)}</div>`,
    autoSay: listen ? v.w : '', autoLang: 'zh-CN', say: v.w, sayLang: 'zh-CN', explain: `<span lang="zh-CN">${esc(v.w)}</span> ${esc(v.py)}：${esc(v.ja)}` }), listen ? 'l' : 'v');
}
function ptGramQs(tr, gs, n) {
  return sample(gs, Math.min(n, gs.length)).map(g => {
    if (tr === 'ja') return ptTag(qGrammar(g), 'g', g.id);
    if (tr === 'en') {
      const q = sample(g.quiz, 1)[0], options = shuffle(q.slice(1, 5)), full = q[0].replace(/_{3,}/, q[1]);
      return ptTag({ id: g.id, kind: 'en-gram', options, optLang: 'en', answer: options.indexOf(q[1]), say: full, sayLang: 'en-US',
        prompt: `<div class="eyebrow">Fill in the blank</div><div class="q-sent" lang="en">${esc(q[0]).replace(/_{3,}/, '<span class="blank">　　　</span>')}</div>`,
        explain: `<div lang="en"><b>${esc(full)}</b></div><div class="small">${esc(enNat(q[5] || '', q[6] || ''))}</div>` }, 'g', g.id);
    }
    const q = sample(g.q, 1)[0];
    return ptTag({ id: g.id, kind: 'grammar', options: q.opts, answer: q.a, optLang: 'zh-CN', explain: `<b>${esc(g.title)}</b>：${esc(q.why || '')}`,
      prompt: `<div class="eyebrow">${esc(g.title)}</div><div class="q-sent" lang="zh-CN">${esc(q.q)}</div>` }, 'g', g.id);
  });
}
// 阅读理解：读一篇短文，回答下面的问题（同一篇最多 2 题）
async function ptReadQs(tr, lv, D, n) {
  let arts = [];
  if (tr === 'ja') {
    await loadScript('reading.js').catch(() => {});
    if (typeof READING === 'undefined') return [];
    if (typeof readMember === 'function') await readMember().catch(() => {});
    arts = READING.filter(a => a.L === lv && a.p && a.p.length && a.q && a.q.length);
  } else arts = D.reads || [];
  const out = [];
  for (const a of shuffle(arts)) {
    if (out.length >= n) break;
    const text = tr === 'ja' ? a.p.map(pa => pa.map(s => s[0]).join('')).join('\n') : tr === 'en' ? a.p.map(pa => pa.map(s => s[0]).join(' ')).join('\n') : a.p.map(pa => pa.map(s => s[0]).join('')).join('\n');
    const L = tr === 'en' ? 'en' : tr === 'zh' ? 'zh-CN' : 'ja';
    const head = tr === 'en' ? 'Read and answer' : tr === 'zh' ? '文章を読んで答えてください' : tj('读短文，回答问题', '文章を読んで答えてください');
    const passage = `<div class="eyebrow">${head}</div><div class="pt-passage" lang="${L}">${esc(text).replace(/\n/g, '<br>')}</div>`;
    for (const q of a.q.slice(0, Math.min(2, n - out.length))) {
      if (tr === 'zh') out.push(ptTag({ id: null, kind: 'readc', options: q.opts, answer: q.a, optLang: 'zh-CN', prompt: `${passage}<div class="q-sent" lang="zh-CN">${esc(q.q)}</div>`, explain: `<span lang="zh-CN">${esc(q.q)}</span> → <b lang="zh-CN">${esc(q.opts[q.a])}</b>`, ref: a.id }, 'r'));
      else { const [qq, ok, ...bad] = q; out.push(ptTag(makeQ(null, 'readc', bad.slice(0, 3), ok, { prompt: `${passage}<div class="q-sent" lang="${L}">${esc(qq)}</div>`, optLang: L, explain: `<span lang="${L}">${esc(qq)}</span> → <b lang="${L}">${esc(ok)}</b>`, ref: a.id }), 'r')); }
    }
  }
  return out;
}
function ptKanaQs() {
  const pool = [...kanaList('basic'), ...kanaList('daku'), ...kanaList('yoon')];
  const kata = p => [toKata(p[0]), p[1]];
  const pick = [...sample(kanaList('basic'), 7), ...sample(kanaList('daku'), 2), ...sample(kanaList('yoon'), 2)];
  const kpick = sample(kanaList('basic'), 4).map(kata), kpool = pool.map(kata);
  return shuffle([...pick.map((p, i) => ptTag(qKana(p, i % 3 === 2, pool), 'k')), ...kpick.map((p, i) => ptTag(qKana(p, i % 2 === 1, kpool), 'k'))]);
}
// 选项不够 3 个时从全部里补
const pt3 = (opts, all, right) => { const a = [...new Set(opts)].filter(o => o !== right); for (const o of shuffle(all)) { if (a.length >= 3) break; if (o !== right && !a.includes(o)) a.push(o); } return a.slice(0, 3); };
function ptPinyinQs(D) {
  const ws = sample(D.words.filter(x => x.py), 12);
  return ws.map((v, i) => {
    const others = D.words.filter(y => y.w !== v.w && y.py);
    if (i % 2) return ptTag(makeQ(v, 'tone', pt3(sample(others.filter(y => y.w.length === v.w.length), 6).map(y => y.py), others.map(y => y.py), v.py), v.py, { prompt: `<div class="eyebrow">ピンインはどれ？</div><div class="q-big" lang="zh-CN">${esc(v.w)}</div>`, say: v.w, sayLang: 'zh-CN', explain: `<span lang="zh-CN">${esc(v.w)}</span> ${esc(v.py)}：${esc(v.ja)}` }), 'k');
    return ptTag(makeQ(v, 'tone', pt3(sample(others.filter(y => y.w.length === v.w.length), 6).map(y => y.w), others.map(y => y.w), v.w), v.w, { prompt: `<div class="eyebrow">音声を聞いて、合う単語を選んでください</div>${sayBtn(v.w, 'zh-CN')}`, autoSay: v.w, autoLang: 'zh-CN', optLang: 'zh-CN', say: v.w, sayLang: 'zh-CN', explain: `<span lang="zh-CN">${esc(v.w)}</span> ${esc(v.py)}：${esc(v.ja)}` }), 'k');
  });
}
function ptUnitQs(tr, lv, D, ws, gs) {
  const g = ptGramQs(tr, gs, gs.length ? 4 : 0);
  return [...ptWordQs(tr, lv, D, ws, 12 - g.length, 2), ...g];
}
async function ptUseQs(tr, lv, D) {
  const r = await ptReadQs(tr, lv, D, 4);
  const listen = ptPickWords(D.words, 3).map(v => ptWordQ(tr, D, v, 'listen'));
  const rest = 10 - r.length - listen.length;
  return [...r, ...listen, ...ptWordQs(tr, lv, D, D.words, Math.max(0, rest - 2)), ...ptGramQs(tr, D.gram, Math.min(2, rest))];
}
async function ptGradQs(tr, lv, D) {
  const r = await ptReadQs(tr, lv, D, 4);
  const g = ptGramQs(tr, D.gram, D.gram.length ? 6 : 0);
  const k = tr === 'ja' && KANJI[lv] && KANJI[lv].length ? sample(KANJI[lv], 2).map(x => ptTag(qKanji(x), 'v')) : [];
  const w = ptWordQs(tr, lv, D, D.words, 20 - r.length - g.length - k.length, 3);
  return [...w, ...k, ...g, ...r];
}

/* ---------- 模拟考这一步 ---------- */
function ptMock(tr, lv) {
  const T = (zh, ja) => ptT(tr, zh, ja);
  const free = tr === 'ja' ? ['N5', 'N4'] : (typeof EXAM2 !== 'undefined' && EXAM2[tr] ? EXAM2[tr].free : []);
  if (!free.includes(lv) && !ptMember(tr)) return null;   // 会员内容：非会员这一步不出现（「进阶专项」里有说明）
  const recs = tr === 'ja' ? (S.exams || []).filter(e => e.L === lv) : ((S.exam2 || {})[tr] || []).filter(e => e.lv === lv);
  const best = recs.reduce((m, e) => Math.max(m, e.total ? e.score / e.total : 0), 0);
  // 模拟考过了 60% 就算这一步完成（记进路线）
  if (best >= 0.6 && !ptPassed(tr, lv, 'mock')) { const st = (((S.path = S.path || {})[tr] = S.path[tr] || {})[lv] = S.path[tr][lv] || {}); st.mock = { b: best, at: Date.now() }; }
  else if (best && ptRec(tr, lv, 'mock')) S.path[tr][lv].mock.b = Math.max(S.path[tr][lv].mock.b || 0, best);
  const href = tr === 'ja' ? '#exam' : `#${tr}/exam/${lv}`;
  return { id: 'mock', ic: T('考', '試'), t: T('模拟考', '模擬試験'), d: T('按真实考试的题型和时间做一套，60% 合格。', '本番と同じ形式・制限時間で 1 回分。60% で合格。'),
    prog: Math.min(1, best / 0.6), parts: [], acts: [[T('开始模拟考', '模擬試験を受ける'), href]], mock: true, n: 0, test: null };
}

/* ---------- 初学者：怎么学、还要几天、卡住了怎么办 ---------- */
function ptTip(tr, x, open) {
  const T = (zh, ja) => ptT(tr, zh, ja), k = x.mock ? 'mock' : x.grad ? 'grad' : /^u\d/.test(x.id) ? 'unit' : x.id;
  const per = S.newPerDay || 10;
  const TIPS = {
    kana: T('先平假名，再片假名。每天认一两行（あいうえお、かきくけこ…），点假名听发音、跟着念出声；用测验检查，累计答对 80 次左右基本就熟了。浊音（が、ざ…）和拗音（きゃ、しゅ…）放在最后。',
      'ひらがな → カタカナの順に。1 日 1〜2 行（あいうえお、かきくけこ…）ずつ、音を聞いて声に出して。クイズで確認し、通算 80 問ほど正解できれば十分です。濁音・拗音は最後に。'),
    pinyin: 'まず 4 つの声調を耳で聞き分けられるように。次に声母・韻母をピンイン表で聞いて真似しましょう。声調トレーニングを毎日 10 問続けるのがいちばんの近道です。',
    unit: tr === 'ja' ? tj(`每天用「背新词」学 ${per} 个（数量在设置里改），第二天起先把到期的复习卡做完——复习比学新词更重要。「闯关」把这组词再过一遍；语法每条看例句、点「加入复习」。单词和语法合计到 80% 就可以做阶段测试。`, `「新しい単語」で 1 日 ${per} 個（数は設定で変更可）。翌日からはまず復習カードを片付けましょう。復習は新しい単語より大切です。「ステージ」で同じ単語をもう一度。文法は例文を読んで「復習に追加」。80% まで来たらステージテストへ。`)
      : tr === 'en' ? enNat(`每天学 ${per} 个新词（设置里可以改），第二天起先复习到期的卡片。「Path」闯关把这组词再练一遍；语法点开看讲解和例句。单词和语法合计到 80% 就可以做阶段测试。`, `1 日 ${per} 個の新しい単語（設定で変更可）。翌日からはまず復習カードを。「Path」で同じ単語をもう一度練習し、文法は解説と例文を開いて読みましょう。80% まで来たらステージテストへ。`)
      : `1 日 ${per} 個ずつ新しい単語を覚え、翌日からはまず復習カードを片付けましょう。「学習ルート」のステージで同じ単語をもう一度。文法は解説と例文を開いて読むと進み具合に入ります。80% まで来たらステージテストへ。`,
    use: tr === 'zh' ? '読み物はまず通して読み、分からない単語はタップで確認。最後のクイズまで解きましょう。リスニングは文字を見ずに 2 回聞いてから本文を確認。'
      : T(`阅读：先整篇读一遍，不会的词点一下就能查，读完做后面的小题。听力：先不看文字听两遍，再对照原文听一遍。${tr === 'ja' ? '初级推荐情景课程，学真实场景里的说法。' : ''}`, `読解：まず通して読み、分からない単語はタップで確認。最後の問題まで解きましょう。聴解：文字を見ずに 2 回聞いてから本文と照らし合わせて。${tr === 'ja' ? '初級はシーン別レッスンもおすすめ。' : ''}`),
    mock: T('找一段完整的时间，按限时一口气做完，再看每题的解析。不到 60% 也没关系，错题会记进「我的弱项」，练完再考一次。', 'まとまった時間をとって、制限時間どおりに通して解き、解説を確認しましょう。60% に届かなくても大丈夫。間違えた問題は弱点ノートに入ります。'),
    grad: T('考前先把「我的弱项」练一遍。毕业测试考整个级别，没过也会告诉你哪一块最弱，补完再考。', '受ける前に弱点ノートを一度練習しておきましょう。レベル全体から出題され、不合格でもどこが弱いかが分かります。')
  };
  const tip = TIPS[k];
  return tip ? `<details class="pt-tip" ${open ? 'open' : ''}><summary>${T('怎么学', '進め方のコツ')}</summary><p class="small">${esc(tip)}</p></details>` : '';
}
// 按每天的新词数算，这个单元大约还要几天
function ptEta(tr, x) {
  if (!x.words) return '';
  const left = x.words.filter(v => !ptWordDone(v)).length;
  if (!left) return '';
  const per = Math.max(1, S.newPerDay || 10), d = Math.ceil(left / per), T = (zh, ja) => ptT(tr, zh, ja);
  return `<div class="small muted">${T(`按每天 ${per} 个新词，大约还要 ${d} 天`, `1 日 ${per} 個のペースで、あと約 ${d} 日`)}</div>`;
}
// 同一阶段测试两次以上没过：给台阶下
function ptStuck(tr, lv, x) {
  const fails = ((S.pathLog || {})[tr] || []).filter(e => e.lv === lv && e.id === x.id && e.s / e.n < PT_PASS).length;
  if (fails < 2) return '';
  const T = (zh, ja) => ptT(tr, zh, ja);
  return `<div class="pt-stuck small"><b>${T('卡住了也没关系', 'つまずいても大丈夫')}</b>
    ${T('已经试了几次还没过？先专练答错的题，或者把每天的新词改少一点、多复习几天再来。', '何度か挑戦しても届かないときは、間違えた問題を先に練習するか、1 日の新しい単語を減らして復習の日を作りましょう。')}
    <div class="row"><a class="btn soft" href="${typeof weakHref === 'function' ? weakHref() : '#me/weak'}">${T('专练弱项', '弱点トレーニング')}</a><a class="btn soft" href="#me/settings">${T('调整每天的量', '1 日の量を調整')}</a></div></div>`;
}
// 第一次来（经验很少、还在第一级的第一步）：怎么开始最轻松
function ptNewbie(tr, lv, cur) {
  if ((S.xp || 0) >= 150 || cur > 0 || PT_LEVELS[tr]()[0] !== lv) return '';
  const T = (zh, ja) => ptT(tr, zh, ja);
  const pts = tr === 'zh' ? ['1 日 10〜15 分で十分。長く 1 回より、毎日少しずつのほうが身につきます。', '下の 1 から順番に。ステップが終わったら小テストで確認。', '分からない単語はタップで辞書。間違えた問題は弱点ノートに自動で記録されます。', 'スピーカーのボタンでいつでも音声が聞けます。真似して声に出しましょう。']
    : [T('每天 10–15 分钟就够。每天一点，比一次学很久更记得住。', '1 日 10〜15 分で十分。毎日少しずつのほうが身につきます。'), T('跟着下面的第 1 步走，学完一步做个小测验。', '下の 1 から順番に。ステップが終わったら小テストで確認。'),
      T('不会的词随时点一下查词典；答错的题会自动记进「我的弱项」。', '分からない単語はタップで辞書。間違えた問題は弱点ノートに自動で記録されます。'), T('看到喇叭就点，听发音、跟着念出声。', 'スピーカーのボタンで音声を聞いて、真似して声に出しましょう。')];
  return `<div class="pt-newbie">${neko('happy', 'mini')}<div><b>${T('第一次学？这样开始最轻松', 'はじめての人へ：こう進めるとラクです')}</b><ul class="small">${pts.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
}

/* ---------- 全程路线：每一级能做到什么、大概要多久、毕业记录 ---------- */
const PT_CANDO = {
  ja: { N5: ['读写假名，用简单的句子自我介绍、买东西、问路', 'かなが読み書きでき、簡単な文で自己紹介・買い物・道案内ができる', '2–3 个月', '2〜3 か月'],
    N4: ['看懂日常对话和简单短文，能说自己的经历和打算', '日常会話や簡単な文章が分かり、自分の経験や予定を話せる', '3–4 个月', '3〜4 か月'],
    N3: ['日常会话基本没问题，能读懂说明、通知和报纸标题', '日常会話はほぼ問題なく、案内・お知らせ・新聞の見出しが読める', '5–6 个月', '5〜6 か月'],
    N2: ['能读新闻和评论，在工作和留学中使用日语', 'ニュースや評論が読め、仕事や留学で日本語を使える', '6–8 个月', '6〜8 か月'],
    N1: ['能读论述文章，听懂各种场合的自然语速', '論説文が読め、さまざまな場面の自然な速さの会話が分かる', '8–12 个月', '8〜12 か月'] },
  en: { A1: ['用简单的词句自我介绍、问路、买东西', '簡単な単語と文で自己紹介・道を聞く・買い物ができる', '2–3 个月', '2〜3 か月'],
    A2: ['应付日常的简单交流，读懂短通知和信息', '日常の簡単なやりとりができ、短いお知らせやメッセージが読める', '3–4 个月', '3〜4 か月'],
    B1: ['读懂日常文章，旅行和工作中基本能沟通', '身近な文章が読め、旅行や仕事で基本的なやりとりができる', '约 6 个月', '約 6 か月'],
    B2: ['看新闻、在工作中讨论和表达观点', 'ニュースを理解し、仕事で議論や意見の説明ができる', '约 8 个月', '約 8 か月'],
    C1: ['流利地谈复杂话题，读专业和长篇文章', '複雑な話題を流暢に話し、専門的な長文が読める', '约 12 个月', '約 12 か月'] },
  zh: { HSK1: ['', '簡単なあいさつ・自己紹介・数字や時間が言える', '', '1〜2 か月'], HSK2: ['', '身近な話題で短いやりとりができる', '', '約 2 か月'],
    HSK3: ['', '日常生活・旅行で基本的なコミュニケーションができる', '', '3〜4 か月'], HSK4: ['', '幅広い話題について中国語で話し合える', '', '5〜6 か月'],
    HSK5: ['', '新聞・雑誌が読め、ドラマや映画が楽しめる', '', '約 8 か月'], HSK6: ['', '中国語の情報を自在に理解し、口頭・書面で表現できる', '', '約 12 か月'] }
};
function ptJourney(tr, lv, ph, cur) {
  const T = (zh, ja) => ptT(tr, zh, ja), lvs = PT_LEVELS[tr](), at = lvs.indexOf(lv), C = PT_CANDO[tr] || {};
  const row = (L, i) => {
    const c = C[L] || [], g = ptRec(tr, L, 'grad');
    const st = g && g.at ? `<span class="tag done">🎓 ${esc(dkey(new Date(g.at)))} · ${ptPct(g.b)}%</span>`
      : L === lv ? `<span class="tag">${T('学习中', '学習中')} · ${T(`第 ${Math.min(cur + 1, ph.length)} / ${ph.length} 步`, `${Math.min(cur + 1, ph.length)} / ${ph.length}`)}</span>`
      : i < at ? `<span class="small muted">${T('已跳过', 'スキップ')}</span>` : '';
    return `<li class="${L === lv ? 'on' : ''}"><a href="#path/${L}"><b>${L}</b></a><div><div class="small">${esc(T(c[0] || c[1] || '', c[1] || ''))}</div><div class="small muted">${T(`参考：每天 30 分钟约 ${c[2] || c[3] || ''}`, `目安：1 日 30 分で ${c[3] || ''}`)}</div></div>${st}</li>`;
  };
  return `<details class="pt-journey"><summary>${T('全程路线：每一级能做到什么', '全体の道のり：各レベルでできること')}</summary><ol>${lvs.map(row).join('')}</ol>
    <p class="small muted">${T('时间只是参考，每个人的节奏不同。坚持每天学比一次学很久更重要。', '期間はあくまで目安です。毎日続けることがいちばん大切です。')}</p></details>`;
}

/* ---------- 进阶专项：不同阶段的重点和推荐练习 ---------- */
const PT_BAND = { N5: 0, N4: 0, N3: 1, N2: 2, N1: 2, A1: 0, A2: 0, B1: 1, B2: 2, C1: 2, HSK1: 0, HSK2: 0, HSK3: 1, HSK4: 1, HSK5: 2, HSK6: 2 };
function ptAdv(tr, lv) {
  const b = PT_BAND[lv] || 0;
  if (tr === 'ja') return [
    [['打基础', '基礎づくり'], ['入门阶段重在打基础：单词的读音、最常用的句型和动词变形。', '入門期は基礎づくり：単語の読み、よく使う文型、動詞の活用。'],
      [['活', '动词变形', '動詞の活用', '#conj', 'ます形、て形、た形……初级最容易卡的地方', 'ます形・て形・た形…初級でつまずきやすいところ'], ['課', '情景课程', 'シーン別レッスン', '#course', '在真实场景里学会话和礼貌说法', '実際の場面で会話と丁寧な言い方を'],
        ['漢', '汉字', '漢字', '#kanji', '每天认几个常用汉字，读写都会轻松', '毎日いくつか常用漢字を覚えて読み書きをラクに'], ['週', '每周精选', '今週の特集', '#week', '每周一组主题词和小对话', '毎週テーマ別の単語とミニ会話']]],
    [['加大输入、开始输出', 'インプットを増やし、アウトプットへ'], ['中级要把阅读和听力的量加上去，并开始练输出：翻译、听写。', '中級は読む・聞く量を増やし、翻訳や書き取りでアウトプットも始めましょう。'],
      [['読', '每天一篇阅读', '毎日 1 本の読解', '#read', '培养读长句的耐力', '長い文を読む力をつける'], ['訳', '翻译练习', '翻訳練習', '#trans', '中日互译，检验会不会用', '日本語で言えるかを確かめる'],
        ['書', '听写', 'ディクテーション', '#dictation', '听一句写一句，耳朵和书写一起练', '聞いて書く。耳と書く力を同時に'], ['試', '模拟考', '模擬試験', '#exam', '按 JLPT 题型限时练习', 'JLPT の形式で時間を計って']]],
    [['实战冲刺', '実戦と仕上げ'], ['高级重在实战：按考试题型练、接触自然语速和真实场景的材料。', '上級は実戦：試験形式の練習と、自然な速さ・本物の場面の素材に触れましょう。'],
      [['試', '模拟考与题型专项', '模擬試験と形式別練習', '#exam', '找出失分最多的题型重点突破', 'いちばん失点する形式を重点的に'], ['商', '商务日语', 'ビジネス日本語', '#biz', '邮件、敬语、会议，职场马上用得上', 'メール・敬語・会議。仕事ですぐ使える'],
        ['劇', '动漫·日剧台词', 'アニメ・ドラマのセリフ', '#anime', '自然语速和口语表达', '自然な速さと話し言葉'], ['書', '听写', 'ディクテーション', '#dictation', '高级听力的细节靠听写打磨', '上級リスニングの細部は書き取りで磨く']]]
  ][b];
  if (tr === 'en') return [
    [['打基础', '基礎づくり'], ['入门阶段重在打基础：字母发音、最常用的词和简单句。', '入門期は基礎づくり：文字と発音、よく使う単語と簡単な文。'],
      [['Aa', 'Letters & sounds', '', '#en/abc', '字母、音标和发音规则', 'アルファベット・発音記号・発音のルール'], ['課', 'Courses', '', '#en/course', '在真实场景里学会话', '実際の場面で会話を'],
        ['週', 'Weekly picks', '', '#en/week', '每周一组主题词和小对话', '毎週テーマ別の単語とミニ会話'], ['関', 'Word path', '', `#en/path/${lv}`, '每关一组词，3 条命闯关', '1 ステージ 1 セット、ライフ 3 つ']]],
    [['加大输入、开始输出', 'インプットを増やし、アウトプットへ'], ['中级要多读多听，并开始练输出：翻译、听写。', '中級は読む・聞く量を増やし、翻訳や書き取りでアウトプットも。'],
      [['読', 'Reading', '', `#en/read/${lv}`, '每天一篇，读完做题', '毎日 1 本、読んだら問題も'], ['訳', 'Translation', '', '#en/trans', '把母语句子说成英语', '母語の文を英語で言ってみる'],
        ['書', 'Dictation', '', '#en/dictation', '听一句写一句', '聞いて書く'], ['試', 'Mock exam', '', `#en/exam/${lv}`, '按考试题型限时练习', '試験形式で時間を計って']]],
    [['实战冲刺', '実戦と仕上げ'], ['高级重在实战：考试题型、职场英语和自然语速。', '上級は実戦：試験形式、仕事の英語、自然な速さ。'],
      [['試', 'Mock exam', '', `#en/exam/${lv}`, '找出失分最多的题型', 'いちばん失点する形式を見つける'], ['商', 'Business English', '', '#en/biz', '邮件、会议、谈判的说法', 'メール・会議・交渉の表現'],
        ['書', 'Dictation', '', '#en/dictation', '用听写打磨听力细节', '書き取りでリスニングの細部を磨く'], ['訳', 'Translation', '', '#en/trans', '练习更地道的表达', 'より自然な表現の練習']]]
  ][b];
  return [
    [['', '基礎づくり'], ['', '入門期はピンインと声調、よく使う単語とあいさつから。'],
      [['音', '', 'ピンインと声調', '#zh/pinyin', '', '4 つの声調を聞き分けて真似する'], ['課', '', 'シーン別会話', '#zh/course', '', '実際の場面で使う会話'],
        ['週', '', '今週の特集', '#zh/week', '', '毎週テーマ別の単語とミニ会話'], ['関', '', '学習ルート', `#zh/path/${lv}`, '', '1 ステージ 1 セット、ライフ 3 つ']]],
    [['', 'インプットを増やし、アウトプットへ'], ['', '中級は読む・聞く量を増やし、翻訳や書き取りでアウトプットも始めましょう。'],
      [['読', '', '読み物', '#zh/read', '', '毎日 1 本、読んだら問題も'], ['訳', '', '翻訳練習', '#zh/trans', '', '日本語の文を中国語で言ってみる'],
        ['書', '', '書き取り', '#zh/dictation', '', '聞いて書く。ピンインと漢字を一緒に'], ['試', '', '模擬試験', `#zh/exam/${lv}`, '', 'HSK の形式で時間を計って']]],
    [['', '実戦と仕上げ'], ['', '上級は実戦：HSK の形式、ビジネス中国語、自然な速さ。'],
      [['試', '', '模擬試験', `#zh/exam/${lv}`, '', 'いちばん失点する形式を重点的に'], ['商', '', 'ビジネス中国語', '#zh/biz', '', 'メール・会議・商談の表現'],
        ['書', '', '書き取り', '#zh/dictation', '', '書き取りで聞き取りの細部を磨く'], ['訳', '', '翻訳練習', '#zh/trans', '', 'より自然な表現の練習']]]
  ][b];
}
function ptAdvHTML(tr, lv) {
  const T = (zh, ja) => ptT(tr, zh, ja), [name, why, items] = ptAdv(tr, lv);
  const band = [T('入门', '入門'), T('中级', '中級'), T('高级', '上級')][PT_BAND[lv] || 0];
  return `<h3>${T('进阶专项', 'ステップアップ')} · ${band}：${esc(T(name[0] || name[1], name[1]))}</h3>
    <p class="small muted">${esc(T(why[0] || why[1], why[1]))}</p>
    <div class="pt-adv">${items.map(([ic, zh, ja, href, dzh, dja]) => `<a class="pt-adv-card" href="${href}"><span class="pt-adv-ic" lang="ja">${esc(ic)}</span><div><b>${esc(tr === 'en' ? zh : T(zh || ja, ja))}</b><div class="small muted">${esc(T(dzh || dja, dja))}</div></div></a>`).join('')}</div>`;
}

/* ---------- 水平测试的结果用到路线上 ---------- */
// r = { lv, sk:[单词, 语法, 阅读, 听力] }（级别下标）。测出来的级别里，单词和语法都已经超过这一级：这一级的「单元」直接算完成，
// 从「阅读与听力」开始；第一级的五十音 / 拼音也跳过。返回跳过了几步（0 = 没变）
function ptApplyCheck(tr, r) {
  const lvs = PT_LEVELS[tr](), target = Math.max(0, r.lv), L = lvs[target];
  if (!L || !r.sk || Math.min(r.sk[0], r.sk[1]) <= target) return 0;
  const st = (((S.path = S.path || {})[tr] = S.path[tr] || {})[L] = S.path[tr][L] || {});
  const ids = Array.from({ length: PT_UNITS[L] || 4 }, (_, k) => `u${k + 1}`).concat(target === 0 ? [tr === 'ja' ? 'kana' : tr === 'zh' ? 'pinyin' : ''] : []).filter(Boolean);
  let n = 0;
  ids.forEach(id => { if (!(st[id] && st[id].at)) { st[id] = { b: (st[id] && st[id].b) || 0, at: Date.now(), via: 'check' }; n++; } });
  if (n) save();
  return n;
}
