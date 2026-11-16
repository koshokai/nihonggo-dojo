// 日语板块的增强：考试目标计划（JLPT 倒计时、每天要学多少、冲刺模式）、弱点分析、注音逐步撤掉、字体大小。
// 依赖 app.js 的 S、VOCAB、GRAM、KANJI、LEVELS、ITEMS、h、esc、save、render、go、toast、tj（运行时才调用）。

/* ---------- 字体大小 ---------- */
const FONT_SCALE = { m: 1, l: 1.12, xl: 1.25 };
function applyFontSize() { document.documentElement.style.setProperty('--fs', FONT_SCALE[S.fontSize] || 1); }

/* ---------- 注音：全部 / 只标没学过的字 / 不标 ---------- */
// 「学过的字」：比当前目标级别简单的级别里的汉字 + 单词卡里学过的汉字
let KNOWN_KANJI = null, KNOWN_AT = 0;
function knownKanji() {
  if (KNOWN_KANJI && Date.now() - KNOWN_AT < 60000) return KNOWN_KANJI;
  const set = new Set(), cur = LEVELS.indexOf(S.level);
  LEVELS.forEach((L, i) => {
    (KANJI[L] || []).forEach(k => { const c = S.srs[k.id]; if (i < cur || (c && c.r > 0)) set.add(k.k || k.w); });
  });
  KNOWN_KANJI = set; KNOWN_AT = Date.now();
  return set;
}
// furiHTML 里调用：这一段要不要标注音
function furiWanted(text) {
  const m = S.furiMode || 'all';
  if (m === 'none') return false;
  if (m === 'all') return true;
  const ks = knownKanji();
  return [...text].some(c => /[一-鿿]/.test(c) && !ks.has(c));
}

/* ---------- 答题统计（弱点分析用）：每天每类题的 [做了几题, 对了几题] ---------- */
const QKIND = { reading: '读音', meaning: '词义', word: '选词', kanji: '汉字', grammar: '语法', kana: '假名', listen: '听力', readc: '阅读理解' };
// 中文、英语的统计分开存（S.qstatL[语言]），弱点分析按正在学的语言显示
const qstatRoot = (tr = S.track || 'ja') => tr === 'ja' ? (S.qstat = S.qstat || {}) : ((S.qstatL = S.qstatL || {})[tr] = (S.qstatL || {})[tr] || {});
function qstatAdd(kind, ok) {
  if (!kind) return;
  const d = dkey(), st = qstatRoot();
  const day = (st[d] = st[d] || {}), c = (day[kind] = day[kind] || [0, 0]);
  c[0]++; if (ok) c[1]++;
  Object.keys(st).filter(k => k < dkey(new Date(Date.now() - 60 * DAY))).forEach(k => delete st[k]);
}
function qstatSum(days, tr = 'ja') {
  const from = dkey(new Date(Date.now() - (days - 1) * DAY)), out = {};
  Object.entries(qstatRoot(tr)).filter(([d]) => d >= from).forEach(([, day]) => Object.entries(day).forEach(([k, [n, ok]]) => { const c = (out[k] = out[k] || [0, 0]); c[0] += n; c[1] += ok; }));
  return out;
}
function weakPanel() {
  const w7 = qstatSum(7), w30 = qstatSum(30);
  const rows = Object.keys(QKIND).filter(k => w30[k]).map(k => {
    const [n, ok] = w30[k], pct = Math.round(ok / n * 100), [n7, ok7] = w7[k] || [0, 0];
    return { k, n, pct, p7: n7 ? Math.round(ok7 / n7 * 100) : null };
  }).sort((a, b) => a.pct - b.pct);
  const weakest = rows[0];
  const p = h(`<section class="panel"><h2>各类题的正确率</h2>
    ${rows.length ? `<p class="muted">${weakest && weakest.pct < 70 ? `最近 30 天，「${QKIND[weakest.k]}」题的正确率最低（${weakest.pct}%），建议多练这一类。` : '最近 30 天各类题都不错，继续保持！'}</p>
      <div class="weak-bars">${rows.map(r => `<div class="weak-row"><span>${QKIND[r.k]}</span><div class="bar ${r.pct < 60 ? 'low' : r.pct < 80 ? 'mid' : ''}"><i style="width:${r.pct}%"></i></div><b>${r.pct}%</b><span class="small muted">${r.n} 题${r.p7 != null ? ` · 本周 ${r.p7}%` : ''}</span></div>`).join('')}</div>`
      : '<p class="muted">做几次测验、闯关以后，这里会显示各类题的正确率。</p>'}
    ${(S.trAgain || []).length ? `<p class="small muted">翻译练习里还有 ${(S.trAgain || []).length} 句没掌握，开始练习时会优先出现。<a href="#trans">去翻译练习 ›</a></p>` : ''}
  </section>`);
  return p;
}

/* ---------- 考试目标计划 ---------- */
// JLPT：每年 7 月和 12 月的第一个周日
function nextJLPT(from = new Date()) {
  const first = (y, m) => { const d = new Date(y, m, 1); d.setDate(1 + (7 - d.getDay()) % 7); return d; };
  const y = from.getFullYear(), list = [first(y, 6), first(y, 11), first(y + 1, 6), first(y + 1, 11)];
  return list.filter(d => d >= new Date(from.getFullYear(), from.getMonth(), from.getDate())).slice(0, 2);
}
const fmtD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function examPlan() {
  const e = S.exam;
  if (!e || !e.date || !e.L) return null;
  const days = Math.ceil((new Date(e.date + 'T09:00:00') - Date.now()) / DAY);
  if (days < 0) return { e, days, over: true };
  const lv = LEVELS.slice(0, LEVELS.indexOf(e.L) + 1);
  const words = lv.flatMap(L => VOCAB[L]), wLeft = words.filter(v => !learned(v)).length;
  const grams = lv.flatMap(L => GRAM[L]), gLeft = grams.filter(g => !S.srs[g.id]).length;
  const studyDays = Math.max(1, days - 21);   // 最后 3 周留给复习和模拟考
  const perDay = Math.ceil(wLeft / studyDays), gPerWeek = Math.ceil(gLeft / Math.max(1, studyDays / 7));
  const pace = S.newPerDay >= perDay;
  return { e, days, wLeft, wAll: words.length, gLeft, gAll: grams.length, perDay, gPerWeek, pace, sprint: days <= 30 };
}
function examCard() {
  const x = examPlan();
  if (!x) return h(`<section class="panel exam-card empty"><div class="row between"><div><b>设定考试目标</b><div class="small muted">告诉我你要考的 JLPT 级别和日期，每天该学多少由我来算。</div></div><a class="btn" href="#me/exam">设定</a></div></section>`);
  if (x.over) return h(`<section class="panel exam-card"><div class="row between"><div><b>${esc(x.e.L)} 考完了，辛苦了！</b><div class="small muted">设定下一次的目标吧。</div></div><a class="btn" href="#me/exam">设定</a></div></section>`);
  const pctW = Math.round((1 - x.wLeft / x.wAll) * 100), pctG = Math.round((1 - x.gLeft / x.gAll) * 100);
  const el = h(`<section class="panel exam-card ${x.sprint ? 'sprint' : ''}">
    <div class="row between"><div><span class="eyebrow">${x.sprint ? '冲刺模式 · ' : ''}JLPT ${esc(x.e.L)} · ${esc(x.e.date)}</span><div class="exam-days"><b>${x.days}</b> 天</div></div><a class="small" href="#me/exam">更改</a></div>
    <div class="exam-bars"><div><span class="small">单词 ${pctW}%</span><div class="bar"><i style="width:${pctW}%"></i></div></div><div><span class="small">语法 ${pctG}%</span><div class="bar"><i style="width:${pctG}%"></i></div></div></div>
    <p class="small">${x.sprint ? `离考试不到一个月：每天做一套 <a href="#exam">模拟考</a>、把 <a href="#me/weak">错题</a> 订正完，新内容少学一点。`
      : !x.wLeft ? '单词都学过一遍了！接下来以复习和模拟考为主。'
      : x.perDay > 30 ? `还剩 ${x.wLeft} 个词、${x.gLeft} 个语法，时间比较紧。按每天 30 个新词，考前能再学约 ${Math.min(x.wLeft, 30 * Math.max(1, x.days - 21))} 个（${Math.round(Math.min(1, 30 * Math.max(1, x.days - 21) / x.wLeft) * 100)}%）。建议优先学「今日任务」里的高频词，语法每周 ${x.gPerWeek} 个，最后三周以模拟考和错题为主——别慌，能拿多少分就拿多少分。`
      : `还剩 ${x.wLeft} 个词、${x.gLeft} 个语法。要在考前三周学完，每天需要 <b>${x.perDay}</b> 个新词、每周 <b>${x.gPerWeek}</b> 个语法。${x.pace ? '按现在的速度来得及 👍' : `现在每天 ${S.newPerDay} 个，有点赶不上。`}`}</p>
    ${!x.sprint && !x.pace && x.wLeft && S.newPerDay < 30 ? `<button class="btn pri" type="button" data-pace>把每天新词调到 ${Math.min(30, x.perDay)} 个</button>` : ''}
  </section>`);
  const b = el.querySelector('[data-pace]');
  if (b) b.onclick = () => { S.newPerDay = Math.min(30, x.perDay); save(); toast(`每天新词改成 ${S.newPerDay} 个`); render(); };
  return el;
}
function examPanel() {
  const e = S.exam || {}, next = nextJLPT();
  const p = h(`<section class="panel"><h2>考试目标</h2>
    <p class="muted">设定要考的级别和日期，首页会显示倒计时、每天该学多少，考前一个月自动进入冲刺模式。</p>
    <div class="row between"><span>目标级别</span><div class="seg">${LEVELS.map(L => `<button type="button" data-el="${L}" class="${(e.L || S.level) === L ? 'on' : ''}">${L}</button>`).join('')}</div></div>
    <div class="row between"><span>考试日期</span><div class="seg">${next.map(d => `<button type="button" data-ed="${fmtD(d)}" class="${e.date === fmtD(d) ? 'on' : ''}">${d.getFullYear()} 年 ${d.getMonth() + 1} 月</button>`).join('')}</div></div>
    <div class="row between"><span class="small muted">其他日期（例如 J.TEST、NAT-TEST）</span><input type="date" class="lb-input" data-edate value="${esc(e.date || '')}" style="max-width:170px"></div>
    <div class="row"><button class="btn pri" type="button" data-esave>保存</button>${S.exam ? '<button class="btn ghost" type="button" data-eclear>取消目标</button>' : ''}</div>
    <p class="small muted">JLPT 一般在每年 7 月和 12 月的第一个周日举行，具体以官网公布为准。</p></section>`);
  let L = e.L || S.level, d = e.date || fmtD(next[0]);
  p.querySelectorAll('[data-el]').forEach(b => { b.onclick = () => { L = b.dataset.el; p.querySelectorAll('[data-el]').forEach(x => x.classList.toggle('on', x === b)); }; });
  p.querySelectorAll('[data-ed]').forEach(b => { b.onclick = () => { d = b.dataset.ed; p.querySelector('[data-edate]').value = d; p.querySelectorAll('[data-ed]').forEach(x => x.classList.toggle('on', x === b)); }; });
  p.querySelector('[data-edate]').onchange = ev => { d = ev.target.value; p.querySelectorAll('[data-ed]').forEach(x => x.classList.toggle('on', x.dataset.ed === d)); };
  p.querySelector('[data-esave]').onclick = () => { if (!d) return toast('请选择日期'); S.exam = { L, date: d }; if (LEVELS.indexOf(L) > LEVELS.indexOf(S.level)) S.level = L; save(); toast(`目标：${L}（${d}）`); go('home'); };
  const c = p.querySelector('[data-eclear]'); if (c) c.onclick = () => { delete S.exam; save(); toast('已取消考试目标'); render(); };
  return p;
}

/* ---------- 难题：形近读音（N2、N1 和魔鬼模式的读音题用） ---------- */
// 对正确读音做「一处」最容易混的改动：促音有无、清浊音、长短音、拗音大小、拨音有无
const DAKU = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const UNDAKU = Object.fromEntries(Object.entries(DAKU).map(([a, b]) => [b, a]));
const HANDAKU = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ', ば: 'ぱ', び: 'ぴ', ぶ: 'ぷ', べ: 'ぺ', ぼ: 'ぽ', ぱ: 'は', ぴ: 'ひ', ぷ: 'ふ', ぺ: 'へ', ぽ: 'ほ' };
const ROW_O = 'おこごそぞとどのほぼぽもよろょ', ROW_E = 'えけげせぜてでねへべぺめれ', ROW_U = 'うくぐすずつづぬふぶぷむゆるゅ';
const SOKU_NEXT = 'かきくけこさしすせそたちつてとぱぴぷぺぽ';
const SMALL = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ' }, BIG = { や: 'ゃ', ゆ: 'ゅ', よ: 'ょ' };
function confuseReadings(r, n = 3) {
  const out = new Map();   // 读音 → 改动类型（尽量不同类型各出一个）
  const add = (x, type) => { if (x && x !== r && /^[ぁ-ゟー]+$/.test(x) && !out.has(x)) out.set(x, type); };
  const s = [...r];
  s.forEach((c, i) => {
    const rep = (ch, type) => add([...s.slice(0, i), ch, ...s.slice(i + 1)].join(''), type);
    if (DAKU[c]) rep(DAKU[c], '浊'); if (UNDAKU[c]) rep(UNDAKU[c], '浊'); if (HANDAKU[c]) rep(HANDAKU[c], '浊');
    if (c === 'っ') add([...s.slice(0, i), ...s.slice(i + 1)].join(''), '促');
    // 促音只插在第 1、2 拍后面（発足 ほっそく 这种音读词的位置），前面是长音、拨音、小字时不插
    if ((i === 1 || i === 2) && SOKU_NEXT.includes(c) && !'っんうーいゃゅょ'.includes(s[i - 1])) add([...s.slice(0, i), 'っ', ...s.slice(i)].join(''), '促');
    if (SMALL[c]) rep(SMALL[c], '拗'); if (BIG[c] && i > 0 && /[きしちにひみりぎじびぴ]/.test(s[i - 1])) rep(BIG[c], '拗');
    // 长音：おう/えい/うう ↔ 短音
    if ((c === 'う' && i > 0 && (ROW_O + ROW_U).includes(s[i - 1])) || (c === 'い' && i > 0 && ROW_E.includes(s[i - 1]))) add([...s.slice(0, i), ...s.slice(i + 1)].join(''), '长');
    if ((i === 0 || i === 1) && s.length <= 5 && ROW_O.includes(c) && s[i + 1] && s[i + 1] !== 'う' && !'っんゃゅょ'.includes(s[i + 1])) add([...s.slice(0, i + 1), 'う', ...s.slice(i + 1)].join(''), '长');
    if (c === 'ん' && i > 0) add([...s.slice(0, i), ...s.slice(i + 1)].join(''), '拨');
  });
  // 每种类型先各取一个，再随机补足
  const byType = {};
  for (const [x, t] of out) (byType[t] = byType[t] || []).push(x);
  const pick = shuffle(Object.values(byType).map(l => sample(l, 1)[0]));
  const rest = shuffle([...out.keys()].filter(x => !pick.includes(x)));
  return [...pick, ...rest].slice(0, n);
}
// 同音词、共用汉字的词：选词题的难干扰项
let HOMO = null;
function hardWordDistractors(v, n = 3) {
  if (!HOMO) { HOMO = new Map(); for (const L of LEVELS) for (const x of VOCAB[L]) { if (!HOMO.has(x.r)) HOMO.set(x.r, []); HOMO.get(x.r).push(x); } }
  const homo = (HOMO.get(v.r) || []).filter(x => x.w !== v.w && x.w !== v.r).map(x => x.w);
  const kan = [...v.w].filter(c => /[一-鿿]/.test(c));
  const share = kan.length ? sample(allVocab().filter(x => x.w !== v.w && x.w.length === v.w.length && kan.some(c => x.w.includes(c))), 6).map(x => x.w) : [];
  return [...new Set([...homo, ...share])].slice(0, n);
}
const hardMode = L => S.demon || L === 'N1' || L === 'N2';

/* ---------- 😈 魔鬼挑战：难读词 + N1 形近读音 + 同音词，3 条命 ---------- */
let DEMON = null;
const demonList = () => DEMON ? Promise.resolve(DEMON) : fetch('lang/ja-demon.json').then(r => r.ok ? r.json() : []).catch(() => []).then(d => (DEMON = d));
function demonChallenge() {
  demonList().then(list => {
    S.demon = true;
    const qs = [];
    // 难读词：手写的 3 个最像的错误读音
    sample(list, 9).forEach(d => qs.push(makeQ(null, 'reading', d.bad, d.r, {
      prompt: `<div class="eyebrow">😈 选择正确的读音${d.t ? ` · ${esc(d.t)}` : ''}</div><div class="q-big" lang="ja">${esc(d.w)}</div>`, optLang: 'ja', say: d.r,
      explain: `<span lang="ja">${esc(d.w)}（${esc(d.r)}）</span>：${esc(d.zh)}${d.ex ? `<br><span lang="ja">${esc(d.ex[0])}</span><br><span class="muted">${esc(d.ex[1])}</span>` : ''}`
    })));
    // N1 单词：形近读音 / 同音词
    const n1 = VOCAB.N1.filter(v => v.q && v.w !== v.r);
    sample(n1, 6).forEach((v, i) => qs.push(qVocab(v, i % 3 === 2 ? 'word' : 'reading')));
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    const done = () => { S.demon = false; save(); };
    runQuiz(host, shuffle(qs), { title: '😈 魔鬼挑战', hearts: 3, noRecord: true, xpEach: 15, onDone: r => {
      done();
      if (!r) return render();
      const best = S.demonBest || 0, sc = r.score;
      if (sc > best) { S.demonBest = sc; save(); }
      quizSummary(host, r, { title: '😈 魔鬼挑战', again: demonChallenge, extraHTML: `<p class="small muted">最高纪录：${Math.max(best, sc)} / ${qs.length}${sc > best && best ? '（刷新纪录！）' : ''}。这里的读音专挑促音、浊音、长音、惯用读法这些最容易看走眼的地方。</p>` });
    } });
  });
}
