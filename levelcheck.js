'use strict';
/* 水平测试（#check）：学了一段时间后测测自己现在是什么水平。三种语言通用，按当前在学的语言出题。
   - 20 题、约 5 分钟：单词、语法、阅读、听力各 5 题，轮流出。每一项单独「爬楼梯」：答对下一题难一级，答错容易一级，从现在的学习级别开始。
   - 结果：大约是哪一级（免费）、和上次比（免费）、一键改学习级别；分项分析、进步曲线、建议是会员内容（免费用户看到锁住的预览）。
   - 结果记在 S.lvChecks[语言] = [{ t, lv, sk:[单词, 语法, 阅读, 听力] }]（级别是下标，-1 = 还没到第一级）。
   - 学了 14 天以上没测过、或者上次测是 30 天前：首页提示一次（可以关掉，关掉后 14 天内不再提示）。 */

const LC_LV = { ja: ['N5', 'N4', 'N3', 'N2', 'N1'], en: ['A1', 'A2', 'B1', 'B2', 'C1'], zh: ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'] };
const LC_ROUNDS = 5;
const lcTrack = () => (S.track === 'en' || S.track === 'zh') ? S.track : 'ja';
const lcSkillNames = () => [tje('单词', '単語', 'Words'), tje('语法', '文法', 'Grammar'), tje('阅读', '読解', 'Reading'), tje('听力', '聴解', 'Listening')];
const lcName = (tr, i) => i < 0 ? ({ ja: tje('N5 之前', 'N5 以前', 'Before N5'), en: 'Pre-A1', zh: tje('HSK1 之前', 'HSK1 以前', 'Before HSK1') }[tr]) : LC_LV[tr][i];
const lcCurIdx = tr => { const cur = tr === 'ja' ? S.level : tr === 'en' ? (typeof enLevel === 'function' ? enLevel() : 'A1') : (typeof zhLevel === 'function' ? zhLevel() : 'HSK1'); return Math.max(0, LC_LV[tr].indexOf(cur)); };
const lcHist = tr => ((S.lvChecks || {})[tr] || []);
function lcSetLevel(tr, i) {
  const L = LC_LV[tr][Math.max(0, i)];
  if (tr === 'ja') S.level = L; else if (tr === 'en') S.enLevel = L; else S.zhLevel = L;
  save();
}

/* ---------- 出题：每种语言 × 每一项，给一个级别出一道题 { prompt, options, answer, optLang, play } ---------- */
const lcUsed = new Set();
let LC_JA_EXTRA = null;
const lcPick = (arr, key) => { const ok = arr.filter(x => !lcUsed.has(key(x))); const x = sample(ok.length ? ok : arr, 1)[0]; if (x) lcUsed.add(key(x)); return x; };
const lcOpts = (correct, pool) => { const opts = shuffle([correct, ...sample([...new Set(pool.filter(x => x && x !== correct))], 3)]); return { options: opts, answer: opts.indexOf(correct) }; };
// 单词题的干扰项：挑和正确答案像的（共用汉字 / 拼写像），见 app.js 的 nearPick
const lcNear = (x, pool, sim, key, L) => { const right = key(x), opts = shuffle([right, ...nearPick(x, pool, sim, key, nearN(L)).map(key)]); return { options: opts, answer: opts.indexOf(right) }; };
const lcSent = (html, lang) => `<div class="q-sent" lang="${lang}">${html}</div>`;
const lcPlayBtn = () => `<button class="btn soft lc-play" type="button" data-play>🔊 ${tje('再听一遍', 'もう一度聞く', 'Play again')}</button>`;

async function lcQuestion(tr, sk, i) {
  const L = LC_LV[tr][i];
  if (tr === 'ja') {
    if (sk === 0) {
      const pool = VOCAB[L].filter(v => v.q);
      const v = lcPick(pool, x => x.id);
      // 中文母语者看汉字能猜意思：有汉字的词考读音，纯假名的词考意思
      const q = qVocab(v, v.w !== v.r && /[一-鿿]/.test(v.w) ? 'reading' : 'meaning');
      return { prompt: q.prompt, options: q.options, answer: q.answer, optLang: q.optLang };
    }
    if (sk === 1) { const q = qGrammar(lcPick(GRAM[L], x => x.id || x.p)); return { prompt: q.prompt, options: q.options, answer: q.answer, optLang: q.optLang }; }
    await needScripts(['reading.js']);
    if (typeof readMember === 'function') await readMember();   // 会员：N2、N1 换成完整文章
    let sents = READING.filter(a => a.L === L && !a.lock && a.p && (!a.date || a.date <= dkey())).flatMap(a => a.p.flat()).filter(s => s[0].length >= (i < 2 ? 8 : 14) && s[0].length <= 60);
    // N2、N1 的文章是会员内容：免费用户用专门准备的测试句子（lang/ja-check.json，公开）
    if (sents.length < 8) sents = ((await (LC_JA_EXTRA || (LC_JA_EXTRA = fetch('lang/ja-check.json').then(r => r.ok ? r.json() : {}).catch(() => ({})))))[L] || []);
    if (sents.length < 8) {   // N2、N1 的文章是会员内容：测试句子也加载不到时改问单词的意思
      const q = qVocab(lcPick(VOCAB[L].filter(v => v.q), x => x.id), 'meaning');
      return { prompt: q.prompt, options: q.options, answer: q.answer, optLang: q.optLang };
    }
    const s = lcPick(sents, x => x[0]);
    const o = lcOpts(s[2], sample(sents, 40).map(x => x[2]));
    if (sk === 2) return Object.assign(o, { prompt: `<div class="eyebrow">这句话是什么意思？</div>${lcSent(esc(s[0]), 'ja')}` });
    await audioIdx('reading');
    if (L === 'N2' || L === 'N1') await memberAudioKeys('ja', 'ja-read', [s[1]]).catch(() => {});   // 会员文章的录音在私有存储里
    return Object.assign(o, { prompt: `<div class="eyebrow">听录音，选出意思</div>${lcPlayBtn()}`, play: () => speak(s[1]) });
  }
  if (tr === 'en') {
    const nat = enJa() ? 'ja' : 'zh', mi = nat === 'ja' ? 4 : 3, ti = nat === 'ja' ? 7 : 6;
    if (sk === 1) {
      const g = (await enFetch(`en-g-${L}`)).filter(x => x.quiz && x.quiz.length);
      if (g.length) {
        const item = lcPick(g, x => x.id), q = sample(item.quiz, 1)[0];
        const opts = shuffle(q.slice(1, 5));
        return { prompt: `<div class="eyebrow">Choose the word that fits</div>${lcSent(esc(q[0]).replace('___', '<span class="blank">　?　</span>'), 'en')}`, options: opts, answer: opts.indexOf(q[1]), optLang: 'en' };
      }
    }
    const rows = await enFetch(`en-${L}`);
    if (sk === 0 || sk === 1) {
      const r = lcPick(rows, x => x[0]);
      return Object.assign(lcNear(r, rows, (a, y) => enSim(r[0], y[0]), y => y[mi], L), { prompt: `<div class="eyebrow">What does this word mean?</div><div class="q-big" lang="en">${esc(r[0])}</div>` });
    }
    const withEx = rows.filter(x => x[5] && x[ti]);
    if (withEx.length < 8) {   // B2、C1 的例句是会员内容：没有例句时改问单词的意思
      const v = lcPick(rows, x => x[0]);
      return Object.assign(lcNear(v, rows, (a, y) => enSim(v[0], y[0]), y => y[mi], L), { prompt: `<div class="eyebrow">What does this word mean?</div><div class="q-big" lang="en">${esc(v[0])}</div>` });
    }
    const r = lcPick(withEx, x => x[5]);
    const o = lcOpts(r[ti], sample(withEx, 40).map(x => x[ti]));
    if (sk === 2) return Object.assign(o, { prompt: `<div class="eyebrow">What does this sentence mean?</div>${lcSent(esc(r[5]), 'en')}` });
    langAudioIdx('en');
    return Object.assign(o, { prompt: `<div class="eyebrow">Listen and choose the meaning</div>${lcPlayBtn()}`, play: () => speakLang(r[5], 'en-US') });
  }
  // 中文（学的人说日语）
  const n = i + 1;
  if (sk === 1) {
    const g = (await zhGrammar()).filter(x => x.lv === L && x.q && x.q.length);
    if (g.length) {
      const item = lcPick(g, x => x.id), q = sample(item.q, 1)[0], correct = q.opts[q.a];
      const opts = shuffle(q.opts);
      return { prompt: `<div class="eyebrow">正しいものを選んでください</div>${lcSent(esc(q.q).replace('___', '<span class="blank">　？　</span>'), 'zh-CN')}`, options: opts, answer: opts.indexOf(correct) };
    }
  }
  const words = (await zhHsk(n)).filter(x => x.ja);
  if (sk === 0 || sk === 1) {
    const w = lcPick(words, x => x.w);
    return Object.assign(lcNear(w, words, (a, y) => hanSim(w.w, w.ja)(y, y.w, y.ja), y => y.ja, L), { prompt: `<div class="eyebrow">この単語の意味は？</div><div class="q-big" lang="zh-CN">${esc(w.w)}</div>` });
  }
  const withEx = words.filter(x => x.ex && x.exja);
  if (withEx.length < 8) {   // HSK4 以上的例句是会员内容：没有例句时改问单词的意思
    const v = lcPick(words, x => x.w);
    return Object.assign(lcNear(v, words, (a, y) => hanSim(v.w, v.ja)(y, y.w, y.ja), y => y.ja, L), { prompt: `<div class="eyebrow">この単語の意味は？</div><div class="q-big" lang="zh-CN">${esc(v.w)}</div>` });
  }
  const w = lcPick(withEx, x => x.ex);
  const o = lcOpts(w.exja, sample(withEx, 40).map(x => x.exja));
  if (sk === 2) return Object.assign(o, { prompt: `<div class="eyebrow">この文の意味は？</div>${lcSent(esc(w.ex), 'zh-CN')}` });
  langAudioIdx('zh');
  return Object.assign(o, { prompt: `<div class="eyebrow">音声を聞いて、意味を選んでください</div>${lcPlayBtn()}`, play: () => zhSay(w.ex) });
}

// 一项的结果：答对过的最高一级（比答错过的最低一级还低的那些里取），都没对就是答错的最低一级再往下一级
function lcEstimate(rs) {
  const wrongMin = Math.min(...rs.filter(r => !r.ok).map(r => r.i), Infinity);
  const ok = rs.filter(r => r.ok && r.i < wrongMin).map(r => r.i);
  return ok.length ? Math.max(...ok) : (wrongMin === Infinity ? 0 : wrongMin - 1);
}

/* ---------- 页面 ---------- */
function viewCheck() {
  const tr = lcTrack(), hist = lcHist(tr), last = hist[hist.length - 1];
  const p = h(`<section class="panel lc-intro">
    <div class="welcome-hi">${neko('wow', 'big')}<div class="bubble"><b>${tje('测测我现在的水平', '今のレベルをチェック', 'Check my level')}</b>
      <span>${tje('20 道题，约 5 分钟。单词、语法、阅读、听力都有；答对了题目会变难，答错了会变简单，最后告诉你现在大约是哪一级。', '20 問・約 5 分。単語・文法・読解・聴解から出題し、正解すると難しく、間違えるとやさしくなります。最後に今のレベルの目安をお知らせします。', '20 questions, about 5 minutes: words, grammar, reading and listening. Questions get harder when you\'re right and easier when you\'re wrong.')}</span></div></div>
    ${last ? `<p class="small muted">${tje(`上次（${lcAgo(last.t)}）的结果：${lcName(tr, last.lv)}`, `前回（${lcAgo(last.t)}）の結果：${lcName(tr, last.lv)}`, `Last time (${lcAgo(last.t)}): ${lcName(tr, last.lv)}`)}</p>` : ''}
    <p class="small muted">${tje('听力题会播放录音，请打开声音。不确定的题直接选最像的，不要查。', '聴解問題は音声が流れます。音を出せる場所で。わからない問題は調べずに、いちばん近いものを選んでください。', 'Turn your sound on for listening. If unsure, just pick the closest answer — no looking things up.')}</p>
    <div class="row"><button class="btn pri big" type="button" data-start>${tje('开始测试', 'はじめる', 'Start')}</button></div>
  </section>`);
  p.querySelector('[data-start]').onclick = () => lcRun(tr);
  main.append(p);
}
const lcAgo = t => { const d = Math.floor((Date.now() - t) / DAY); return d <= 0 ? tje('今天', '今日', 'today') : tje(`${d} 天前`, `${d} 日前`, `${d} day${d > 1 ? 's' : ''} ago`); };

async function lcRun(tr) {
  if (typeof audioPrime === 'function') audioPrime();   // 听力题要等出题完再自动播放：点击当下先解锁播放器（iPhone）
  lcUsed.clear();
  const max = LC_LV[tr].length - 1, start = lcCurIdx(tr);
  const pos = [start, start, start, start], res = [[], [], [], []];
  const total = LC_ROUNDS * 4;
  let n = 0, busyQ = false;
  main.innerHTML = '';
  const box = h(`<section class="panel quiz">
    <div class="row between"><h2>${tje('水平测试', 'レベルチェック', 'Level check')}</h2><button class="btn ghost" type="button" data-exit>${tje('退出', 'やめる', 'Quit')}</button></div>
    <div class="progress-top"><span class="small" data-count></span><div class="bar"><i data-bar style="width:0"></i></div><span class="small" data-sk></span></div>
    <div data-stage class="quiz"></div></section>`);
  main.append(box);
  focusMode(true);
  const stage = box.querySelector('[data-stage]');
  // 离开了这一页（退出、返回、点了别的地方）就停：不再出题、不放录音、不保存结果
  const dead = () => !box.isConnected;
  box.querySelector('[data-exit]').onclick = async () => {
    if (n && !await askConfirm(tje('确定退出吗？这次的测试不会保存。', 'やめますか？ 今回の結果は保存されません。', 'Quit? This test won\'t be saved.'))) return;
    keyHandler = null; focusMode(false); stopSpeech(); render();
  };
  const next = async () => {
    if (dead()) return;
    if (n >= total) return finish();
    const sk = n % 4;
    box.querySelector('[data-count]').textContent = `${n + 1} / ${total}`;
    box.querySelector('[data-bar]').style.width = (n / total * 100) + '%';
    box.querySelector('[data-sk]').textContent = lcSkillNames()[sk];
    stage.innerHTML = '<div class="skel" role="status"><i></i><i></i></div>';
    let q;
    try { q = await lcQuestion(tr, sk, pos[sk]); } catch (e) { q = null; }
    if (dead()) return;
    if (!q || !q.options || q.answer < 0) {
      stage.innerHTML = `<p class="muted">${tje('题目加载失败，请检查网络。', '問題を読み込めませんでした。通信状況を確認してください。', 'Could not load the question. Check your connection.')}</p><button class="btn pri" type="button" data-retry>${tje('重试', '再試行', 'Try again')}</button>`;
      stage.querySelector('[data-retry]').onclick = next;   // 已经答的题保留，接着这一题重新加载
      return;
    }
    busyQ = false; window.__lcAns = q.answer;   // 自动测试用
    stage.innerHTML = `<div class="q-prompt pop">${q.prompt}</div>
      <div class="opts">${q.options.map((o, j) => `<button class="opt" type="button" data-o="${j}"><span class="k">${j + 1}</span><span ${q.optLang ? `lang="${q.optLang}"` : ''}>${esc(o)}</span></button>`).join('')}</div>`;
    const pl = stage.querySelector('[data-play]');
    if (q.play) { if (pl) pl.onclick = q.play; setTimeout(() => { if (!dead()) q.play(); }, 250); }   // 播放器在开始测试、点选项时已经解锁（audioPrime）
    const pick = j => {
      if (typeof audioPrime === 'function') audioPrime();
      if (busyQ || dead()) return; busyQ = true;
      const ok = j === q.answer;
      res[sk].push({ i: pos[sk], ok });
      pos[sk] = Math.max(0, Math.min(max, pos[sk] + (ok ? 1 : -1)));
      stage.querySelectorAll('[data-o]').forEach((b, m) => { b.disabled = true; if (m === q.answer) b.classList.add('right'); else if (m === j) b.classList.add('wrong'); });
      buzz(ok ? 12 : [30, 50, 30]);
      n++; setTimeout(next, 650);
    };
    stage.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => pick(+b.dataset.o); });
    keyHandler = e => { if ('1234'.includes(e.key) && +e.key <= q.options.length) pick(+e.key - 1); };
  };
  const finish = () => {
    if (dead()) return;
    keyHandler = null; focusMode(false); stopSpeech();
    const sk = res.map(lcEstimate);
    const lv = Math.round(sk.reduce((a, b) => a + b, 0) / 4 - 0.01);   // 正好在两级中间时取低的一级
    S.lvChecks = S.lvChecks || {};
    const hist = (S.lvChecks[tr] = (S.lvChecks[tr] || []).concat({ t: Date.now(), lv, sk }).slice(-30));
    save();
    main.innerHTML = '';
    lcResult(tr, hist);
  };
  next();
}

function lcResult(tr, hist) {
  const r = hist[hist.length - 1], prev = hist[hist.length - 2], cur = lcCurIdx(tr), name = lcName(tr, r.lv);
  const member = typeof isMember === 'function' && isMember(tr);
  const diff = prev ? r.lv - prev.lv : 0;
  const cmp = !prev ? '' : diff > 0 ? tje(`比上次（${lcAgo(prev.t)}）的 ${lcName(tr, prev.lv)} 进步了！`, `前回（${lcAgo(prev.t)}）の ${lcName(tr, prev.lv)} からレベルアップ！`, `Up from ${lcName(tr, prev.lv)} last time (${lcAgo(prev.t)})!`)
    : diff < 0 ? tje(`上次是 ${lcName(tr, prev.lv)}。这次题目不一样，有起伏很正常，继续加油。`, `前回は ${lcName(tr, prev.lv)}。問題が毎回違うので、多少の上下はよくあることです。`, `Last time: ${lcName(tr, prev.lv)}. Results vary a little because the questions change.`)
    : tje(`和上次（${lcAgo(prev.t)}）一样是 ${name}，稳住了。`, `前回（${lcAgo(prev.t)}）と同じ ${name}。安定しています。`, `Same as last time (${lcAgo(prev.t)}): ${name}.`);
  const target = Math.max(0, r.lv);
  const suggest = target !== cur ? `<div class="row"><button class="btn pri" type="button" data-set>${tje(`把学习级别改成 ${LC_LV[tr][target]}`, `学習レベルを ${LC_LV[tr][target]} にする`, `Switch my level to ${LC_LV[tr][target]}`)}</button><span class="small muted">${tje(`现在是 ${LC_LV[tr][cur]}`, `今は ${LC_LV[tr][cur]}`, `Now: ${LC_LV[tr][cur]}`)}</span></div>` : '';
  const p = h(`<section class="panel lc-res">
    <div class="welcome-hi">${neko(diff > 0 || r.lv > cur ? 'cheer' : 'happy', 'big')}<div class="bubble">
      <span>${tje('你现在的水平大约是', '今のレベルの目安', 'Your level is about')}</span><b class="lc-big">${esc(name)}</b></div></div>
    ${cmp ? `<p>${cmp}</p>` : ''}
    ${suggest}
    <h3>${tje('详细报告', 'くわしいレポート', 'Detailed report')}</h3>
    <div class="lc-report ${member ? '' : 'locked'}" data-report></div>
    <div class="row"><button class="btn" type="button" data-share>${tje('分享我的学习页', '学習ページをシェア', 'Share my progress')}</button><button class="btn ghost" type="button" data-done>${tje('完成', '完了', 'Done')}</button></div>
    <p class="small muted">${tje('这是一个参考：题目每次随机，和正式考试的结果可能不一样。', 'あくまで目安です。問題は毎回ランダムで、本番の試験結果とは異なる場合があります。', 'This is a rough guide; questions are random and results may differ from official exams.')}</p>
  </section>`);
  const rep = p.querySelector('[data-report]');
  // 免费用户看到的是锁住的示意（不是本人的真实分项），会员才算真的
  const sk = member ? r.sk : [2, 1, 2, 0].map(x => Math.min(x, LC_LV[tr].length - 1));
  const names = lcSkillNames(), top = LC_LV[tr].length;
  rep.innerHTML = `<div class="breakdown" ${member ? '' : 'aria-hidden="true"'}>${sk.map((x, k) => `<div class="bd-row"><span>${names[k]}</span><div class="bar"><i style="width:${(x + 1) / top * 100}%"></i></div><span class="small">${esc(lcName(tr, x))}</span></div>`).join('')}</div>`
    + (member ? lcAdvice(tr, r) + lcChart(tr, hist) : `<div class="lc-lock"><b>🔒 ${tje('会员专享', 'メンバー限定', 'Members only')}</b><span class="small">${tje('单词、语法、阅读、听力分项水平，每次测试的进步曲线，和针对弱项的学习建议。加入会员即可查看。', '単語・文法・読解・聴解それぞれのレベル、テストごとの成長グラフ、苦手分野に合わせた学習アドバイス。メンバーになると見られます。', 'Level for each skill, your progress chart over time, and tips for your weak spots. Become a member to unlock.')}</span></div>`);
  const set = p.querySelector('[data-set]');
  // 学习路线：测出来单词、语法已经超过这一级时，这一级的单元直接算完成（path.js）
  const ptInfo = () => { const n = typeof ptApplyCheck === 'function' ? ptApplyCheck(tr, r) : 0; if (!n) return;
    p.querySelector('[data-report]').before(h(`<p class="lc-pt">📍 ${tje(`学习路线已经帮你跳过 ${LC_LV[tr][target]} 里已经会的单元，从「阅读与听力」开始。`, `ロードマップで ${LC_LV[tr][target]} のもう分かるユニットをスキップしました。「読解と聴解」から始めましょう。`, `Your roadmap skipped the ${LC_LV[tr][target]} units you already know. Start from Reading & Listening.`)} <a href="#path/${LC_LV[tr][target]}">${tje('查看路线 ›', 'ロードマップ ›', 'View roadmap ›')}</a></p>`)); };
  if (set) set.onclick = () => { lcSetLevel(tr, target); const n = typeof ptApplyCheck === 'function' ? ptApplyCheck(tr, r) : 0; toast(tje(`已改成 ${LC_LV[tr][target]}`, `${LC_LV[tr][target]} に変更しました`, `Switched to ${LC_LV[tr][target]}`) + (n ? tje('，学习路线已跳过已经会的单元', '。ロードマップでもう分かるユニットをスキップしました', '. Your roadmap skipped the units you already know.') : '')); set.parentElement.remove(); updateTop(); };
  p.querySelector('[data-share]').onclick = () => shareMyPage(tje(`我在${BRAND}测了一下，现在的${{ ja: '日语', en: '英语', zh: '中文' }[tr]}水平是 ${name}！`, `${BRAND}でレベルチェックしたら、今の${{ ja: '日本語', en: '英語', zh: '中国語' }[tr]}は ${name} でした！`, `I just checked my ${{ ja: 'Japanese', en: 'English', zh: 'Chinese' }[tr]} on ${BRAND}: ${name}!`));
  p.querySelector('[data-done]').onclick = () => go(homeView());
  main.append(p);
  if (target === cur) ptInfo();   // 测出来就是现在的级别：直接用到路线上
}

// 会员：针对最弱一项的建议
function lcAdvice(tr, r) {
  const k = r.sk.indexOf(Math.min(...r.sk)), names = lcSkillNames();
  const where = { ja: ['#vocab', '#grammar', '#read', '#listen'], en: ['#en/words/' + LC_LV.en[Math.max(0, r.sk[0])], '#en/grammar/' + LC_LV.en[Math.max(0, r.sk[1])], '#en/read/' + LC_LV.en[Math.max(0, r.sk[2])], '#en/listen/' + LC_LV.en[Math.max(0, r.sk[3])]], zh: ['#zh/words', '#zh/grammar', '#zh/read', '#zh/listen'] }[tr][k];
  if (Math.max(...r.sk) === Math.min(...r.sk)) return `<p class="small">${tje('四项很均衡。下次试着挑战高一级的内容。', '4 分野ともバランスが取れています。次はひとつ上のレベルに挑戦してみましょう。', 'Nicely balanced. Try content one level up next.')}</p>`;
  return `<p class="small">${tje(`最需要加强的是<b>${names[k]}</b>。`, `いちばん伸ばしたいのは<b>${names[k]}</b>です。`, `Your weakest area is <b>${names[k]}</b>.`)} <a href="${where}">${tje('去练习 →', '練習する →', 'Practice →')}</a></p>`;
}
// 会员：最近 10 次的进步曲线
function lcChart(tr, hist) {
  const pts = hist.slice(-10); if (pts.length < 2) return '';
  const W = 300, H = 90, top = LC_LV[tr].length - 1;
  const xy = pts.map((p, k) => [10 + k * (W - 20) / (pts.length - 1), H - 12 - (Math.max(-1, p.lv) + 1) / (top + 1) * (H - 24)]);
  return `<svg class="lc-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tje('进步曲线', '成長グラフ', 'Progress chart')}">
    <polyline fill="none" stroke="var(--ai)" stroke-width="3" points="${xy.map(p => p.join(',')).join(' ')}"/>
    ${xy.map((p, k) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--ai)"/><text x="${p[0]}" y="${p[1] - 8}" text-anchor="middle" font-size="10" fill="currentColor">${esc(lcName(tr, pts[k].lv))}</text>`).join('')}</svg>`;
}

// 首页提示：学了 14 天以上还没测过，或者上次测是 30 天前
function lcBanner() {
  const tr = lcTrack(), hist = lcHist(tr), last = hist[hist.length - 1];
  const snooze = (S.lcSnooze || {})[tr];
  if (snooze && Date.now() - snooze < 14 * DAY) return null;
  const studied = Object.values(S.days || {}).filter(x => x > 0).length;
  if (last ? Date.now() - last.t < 30 * DAY : studied < 14) return null;
  const b = h(`<a class="panel wk-more lc-banner" href="#check"><div class="wk-more-t">📈 ${last ? tje('一个月了，测测进步了多少？', 'あれから 1 か月。どれくらい伸びたかチェック', 'A month later — check your progress?') : tje('学了一段时间了，测测现在的水平？', 'そろそろ今のレベルをチェックしてみませんか？', 'Been studying a while? Check your level')}</div>
    <div class="small muted">${tje('20 题，约 5 分钟', '20 問・約 5 分', '20 questions · about 5 min')}</div><button class="btn ghost small lc-x" type="button" aria-label="${tje('关闭', '閉じる', 'Close')}">×</button></a>`);
  b.querySelector('.lc-x').onclick = e => { e.preventDefault(); e.stopPropagation(); S.lcSnooze = Object.assign({}, S.lcSnooze, { [tr]: Date.now() }); save(); b.remove(); };
  return b;
}

// 入口卡片（考试页、英语 Tests 页用）
function lcCard() {
  const tr = lcTrack(), last = lcHist(tr).slice(-1)[0];
  return h(`<a class="panel wk-more lc-card" href="#check"><div class="wk-more-t">📈 ${tje('水平测试：我现在是几级？', 'レベルチェック：今の実力は？', 'Level check: where am I now?')}</div>
    <div class="small muted">${tje('20 题 · 约 5 分钟 · 单词、语法、阅读、听力', '20 問・約 5 分・単語・文法・読解・聴解', '20 questions · about 5 min · words, grammar, reading, listening')}${last ? ' · ' + tje(`上次 ${lcName(tr, last.lv)}`, `前回 ${lcName(tr, last.lv)}`, `last: ${lcName(tr, last.lv)}`) : ''}</div></a>`);
}
