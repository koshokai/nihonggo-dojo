'use strict';
/* 学习诊断（#diag）：看自己的学习数据，告诉你哪里好、哪里该补、今天先做什么、这周的目标、照现在的节奏多久能到下一步。
   - 免费：学习健康分（0–100，四项：规律、复习、正确率、均衡）+ 第一条诊断。
   - 会员：全部诊断、今天的学习处方（按顺序 3–4 步，带预计时间和直达按钮）、本周目标和完成度、前景预估（多久学完本级、考试节奏）。
   数据：S.days（每天经验）、S.srs（复习卡）、S.qstat（日语各题型正确率）、S.act（每天各项练了多少，下面的 actLog 记录）、
   S.lvChecks（水平测试）、S.exam（考试目标，日语）、S.read / S.enRead / S.zhRead、S.listenHist / S.enListen。 */

// 每天各项练了多少：S.act[日期][语言] = { v: 单词, g: 语法, r: 阅读, l: 听力 }，只留 60 天
function actLog(skill, tr = (S.track === 'en' || S.track === 'zh') ? S.track : 'ja', n = 1) {
  if (!'vgrl'.includes(skill)) return;
  const d = dkey(), a = (S.act = S.act || {}), day = (a[d] = a[d] || {}), t = (day[tr] = day[tr] || {});
  t[skill] = (t[skill] || 0) + n;
  const old = dkey(new Date(Date.now() - 60 * DAY));
  Object.keys(a).forEach(k => { if (k < old) delete a[k]; });
}
// 测验的题型 → 哪一项
const DG_KIND = { reading: 'v', meaning: 'v', word: 'v', kanji: 'v', kana: 'v', grammar: 'g', listen: 'l' };

const dgTrack = () => (S.track === 'en' || S.track === 'zh') ? S.track : 'ja';
const dgSkill = () => [tje('单词', '単語', 'Words'), tje('语法', '文法', 'Grammar'), tje('阅读', '読解', 'Reading'), tje('听力', '聴解', 'Listening')];
const DG_SK = ['v', 'g', 'r', 'l'];
const dgLinks = tr => ({ ja: ['#vocab', '#grammar', '#read', '#listen'], en: ['#en/words', '#en/grammar', '#en/read', '#en/listen'], zh: ['#zh/words', '#zh/grammar', '#zh/read', '#zh/listen'] }[tr]);
const dgOwn = (tr, id) => tr === 'ja' ? !/^(en|zh)\|/.test(id) : id.startsWith(tr + '|');

function dgData(tr) {
  const now = Date.now(), days = [];
  for (let i = 0; i < 14; i++) days.push(dkey(new Date(now - i * DAY)));
  const xp = days.map(d => (S.days || {})[d] || 0), active = xp.filter(x => x > 0).length;
  const activeDays = xp.filter(x => x > 0), avgXp = activeDays.length ? Math.round(activeDays.reduce((a, b) => a + b, 0) / activeDays.length) : 0;
  // 复习卡
  const cards = Object.entries(S.srs || {}).filter(([id]) => dgOwn(tr, id)).map(([, c]) => c);
  const learnedN = cards.filter(c => c.r > 0).length, due = cards.filter(c => c.due && c.due <= now).length;
  const overdue = cards.filter(c => c.due && c.due < now - 3 * DAY).length, masteredN = cards.filter(c => c.i >= 21).length;
  // 正确率（日语有各题型的统计；其他语言用最近一次水平测试的分项代替）
  const acc = [null, null, null, null];
  if (tr === 'ja' && typeof qstatSum === 'function') {
    const q = qstatSum(14), sum = { v: [0, 0], g: [0, 0], l: [0, 0] };
    Object.entries(q).forEach(([k, [n, ok]]) => { const s = DG_KIND[k]; if (s && sum[s]) { sum[s][0] += n; sum[s][1] += ok; } });
    DG_SK.forEach((s, i) => { if (sum[s] && sum[s][0] >= 8) acc[i] = Math.round(sum[s][1] / sum[s][0] * 100); });
  }
  // 最近两周各项练了多少
  const act = { v: 0, g: 0, r: 0, l: 0 };
  days.forEach(d => { const t = ((S.act || {})[d] || {})[tr] || {}; DG_SK.forEach(s => { act[s] += t[s] || 0; }); });
  // 旧数据补一点：日语的题型统计、读过的文章、听力记录
  if (tr === 'ja' && typeof qstatSum === 'function') { const q = qstatSum(14); Object.entries(q).forEach(([k, [n]]) => { const s = DG_KIND[k]; if (s) act[s] = Math.max(act[s], n); }); }
  (S.listenHist || []).filter(x => x.date >= days[13] && (x.lang || 'ja') === tr).forEach(x => { act.l = Math.max(act.l, x.total); });
  if (tr === 'zh') act.r = Math.max(act.r, Object.values(S.zhRead || {}).filter(t => t > now - 14 * DAY).length);
  const hist = typeof lcHist === 'function' ? lcHist(tr) : [], lc = hist[hist.length - 1];
  const exam = tr === 'ja' && typeof examPlan === 'function' ? examPlan() : null;
  return { tr, active, avgXp, goal: S.goal || 50, streak: typeof streak === 'function' ? streak() : 0, learnedN, due, overdue, masteredN, acc, act, lc, exam };
}

// 四项分数（各 0–1）和总分
function dgScore(x) {
  const habit = Math.min(1, x.active / 10) * (x.avgXp >= x.goal * .8 ? 1 : .8 + .2 * Math.min(1, x.avgXp / Math.max(1, x.goal)));
  const review = x.learnedN ? Math.max(0, 1 - x.overdue / Math.max(15, x.learnedN * .25)) : .6;
  const accs = x.acc.filter(a => a != null), accuracy = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length / 100 : .7;
  const balance = DG_SK.filter(s => x.act[s] > 0).length / 4;
  const parts = { habit, review, accuracy, balance };
  return { parts, total: Math.round(habit * 30 + review * 25 + accuracy * 25 + balance * 20) };
}

// 诊断：每条 { lv: good/warn/bad, t: 标题, b: 说明和建议, href, go }
function dgFindings(x) {
  const out = [], names = dgSkill(), links = dgLinks(x.tr);
  if (x.active < 5) out.push({ lv: 'bad', t: tje('学习不够规律', '学習のペースが不規則です', 'Your study schedule is irregular'),
    b: tje(`最近两周只学了 ${x.active} 天。记忆最怕中断：每天哪怕 5 分钟，也比一周集中学一次效果好得多。先把目标定成「每天打开一次」。`, `直近 2 週間で学習したのは ${x.active} 日。記憶は途切れると定着しにくいので、1 日 5 分でも毎日続ける方が効果的です。まずは「毎日 1 回開く」を目標に。`, `You studied on ${x.active} of the last 14 days. A little every day beats one long session a week — aim to open the app daily.`) });
  else if (x.streak >= 7) out.push({ lv: 'good', t: tje(`已经连续 ${x.streak} 天，节奏很好`, `${x.streak} 日連続、いいペースです`, `${x.streak}-day streak — great rhythm`), b: tje('保持这个节奏就是最大的进步。', 'このペースを続けることがいちばんの近道です。', 'Keeping this rhythm is the biggest win.') });
  if (x.overdue >= 15 || x.due >= 40) out.push({ lv: 'bad', t: tje('复习欠账了', '復習がたまっています', 'Reviews are piling up'),
    b: tje('到期的卡片拖得越久越容易忘，学了新的也会很快忘掉。今天先把复习清掉，新词少学一点。', '期限切れのカードは放っておくほど忘れやすくなります。今日は新しい単語を減らして、まず復習を片付けましょう。', 'Overdue cards fade fast. Clear reviews first today and learn fewer new words.'), href: links[0], go: tje('去复习', '復習する', 'Review') });
  const accs = x.acc.map((a, i) => [a, i]).filter(([a]) => a != null).sort((a, b) => a[0] - b[0]);
  if (accs.length && accs[0][0] < 70) out.push({ lv: 'warn', t: tje(`「${names[accs[0][1]]}」正确率偏低（${accs[0][0]}%）`, `「${names[accs[0][1]]}」の正答率が低め（${accs[0][0]}%）`, `${names[accs[0][1]]} accuracy is low (${accs[0][0]}%)`),
    b: tje('先别急着学新的，把这一项的错题订正一遍，再做一组同类练习。正确率到 80% 以上再往前走。', '新しい内容に進む前に、この分野の間違いを見直して、同じタイプの練習をもう 1 セット。正答率 80% を目安に。', 'Before moving on, review your mistakes here and do another set. Aim for 80%.'), href: links[accs[0][1]], go: tje('去练习', '練習する', 'Practice') });
  const idle = DG_SK.map((s, i) => [s, i]).filter(([s]) => !x.act[s]).map(([, i]) => i);
  if (idle.length && idle.length < 4) out.push({ lv: 'warn', t: tje(`最近两周没练「${idle.map(i => names[i]).join('」「')}」`, `直近 2 週間「${idle.map(i => names[i]).join('」「')}」をやっていません`, `No ${idle.map(i => names[i]).join(' / ')} practice in 2 weeks`),
    b: tje('四项要一起练才能真正用得上：单词和语法打基础，阅读和听力把它们串起来。每周至少各练两次。', '4 分野は一緒に伸ばすことで使える力になります。単語・文法で土台を作り、読解・聴解でつなげましょう。週 2 回ずつが目安です。', 'All four skills work together. Try each at least twice a week.'), href: links[idle[0]], go: tje('去练', '練習する', 'Go') });
  if (!x.lc) out.push({ lv: 'warn', t: tje('还没做过水平测试', 'レベルチェックをまだ受けていません', 'No level check yet'), b: tje('5 分钟测一下现在的水平，之后每个月对比一次，进步看得见。', '5 分で今のレベルを測って、毎月比べると伸びが見えます。', 'Take a 5-minute level check, then compare monthly.'), href: '#check', go: tje('去测试', 'チェックする', 'Check') });
  else if (Date.now() - x.lc.t > 30 * DAY) out.push({ lv: 'warn', t: tje('一个多月没测水平了', '1 か月以上レベルチェックしていません', 'Over a month since your last level check'), b: tje('测一次看看这一个月进步了多少。', 'この 1 か月でどれくらい伸びたか確かめましょう。', 'See how much you improved this month.'), href: '#check', go: tje('去测试', 'チェックする', 'Check') });
  if (x.exam && !x.exam.over && x.exam.wLeft && !x.exam.pace) out.push({ lv: 'bad', t: `JLPT ${x.exam.e.L}：按现在的速度可能来不及`, b: `离考试还有 ${x.exam.days} 天。要在考前三周学完，每天需要 ${x.exam.perDay} 个新词（现在每天 ${S.newPerDay} 个）。可以在「我的 → 考试目标」里调整。`, href: '#me/exam', go: '调整计划' });
  if (!out.length) out.push({ lv: 'good', t: tje('各方面都很均衡', 'バランスよく学べています', 'Nicely balanced'), b: tje('保持现在的节奏，可以考虑挑战高一级的内容。', '今のペースを続けて、ひとつ上のレベルにも挑戦してみましょう。', 'Keep going and try content one level up.') });
  const rank = { bad: 0, warn: 1, good: 2 };
  return out.sort((a, b) => rank[a.lv] - rank[b.lv]);
}

// 今天的学习处方：按顺序做，合计十几分钟
function dgPlan(x) {
  const links = dgLinks(x.tr), names = dgSkill(), steps = [];
  if (x.due) steps.push({ t: tje('先清复习', 'まず復習', 'Clear reviews first'), d: tje('到期的卡片全部过一遍（越拖越忘）', '期限が来たカードをすべて', 'All due cards — they fade if you wait'), m: Math.min(10, Math.max(3, Math.ceil(x.due / 6))), href: links[0] });
  const accs = x.acc.map((a, i) => [a, i]).filter(([a]) => a != null).sort((a, b) => a[0] - b[0]);
  const weak = accs.length && accs[0][0] < 80 ? accs[0][1] : DG_SK.map((s, i) => [x.act[s], i]).sort((a, b) => a[0] - b[0])[0][1];
  steps.push({ t: tje(`补「${names[weak]}」`, `「${names[weak]}」を強化`, `Strengthen ${names[weak]}`), d: tje('练一组，错的马上看解说', '1 セット練習して、間違いはすぐ解説を確認', 'One set; read the explanation for any mistake'), m: 5, href: links[weak] });
  const other = [2, 3].find(i => i !== weak && !x.act[DG_SK[i]]) ?? [2, 3].find(i => i !== weak);
  steps.push({ t: tje(`${names[other]}一篇`, `${names[other]}を 1 つ`, `One ${names[other].toLowerCase()} piece`), d: tje('用学过的东西读懂、听懂一段真实的内容', '学んだことで実際の文章・会話を理解する', 'Use what you learned on real content'), m: 5, href: links[other] });
  if (!x.overdue && x.due < 20) steps.push({ t: tje('学几个新词', '新しい単語を少し', 'A few new words'), d: tje('复习清完了再学新的', '復習が終わってから新しいものを', 'Only after reviews are done'), m: 4, href: x.tr === 'ja' ? '#game' : links[0] });
  return steps;
}
// 本周目标（周一开始）
function dgWeek(x) {
  const now = new Date(), wd = (now.getDay() + 6) % 7, ds = [];
  for (let i = 0; i <= wd; i++) ds.push(dkey(new Date(now - i * DAY)));
  const act = { v: 0, g: 0, r: 0, l: 0 }; let studied = 0;
  ds.forEach(d => { if (((S.days || {})[d] || 0) > 0) studied++; const t = ((S.act || {})[d] || {})[x.tr] || {}; DG_SK.forEach(s => { act[s] += t[s] || 0; }); });
  return [
    [tje('学习 5 天', '5 日学習する', 'Study 5 days'), Math.min(5, studied), 5],
    [tje('复习清零', '復習をゼロに', 'Clear all reviews'), x.due ? 0 : 1, 1],
    [tje('阅读 2 次', '読解 2 回', 'Reading ×2'), Math.min(2, act.r), 2],
    [tje('听力 2 次', '聴解 2 回', 'Listening ×2'), Math.min(2, act.l ? Math.max(1, Math.round(act.l / 5)) : 0), 2],
  ];
}
// 前景：照现在的节奏多久学完本级的单词（只说时间，不报内容总数）
function dgOutlook(x) {
  const out = [];
  if (x.tr === 'ja' && typeof VOCAB !== 'undefined' && VOCAB[S.level]) {
    const left = VOCAB[S.level].filter(v => !learned(v)).length, perWeek = (S.newPerDay || 10) * Math.max(1, x.active / 2);
    out.push(left ? `照现在的节奏，大约 ${Math.max(1, Math.ceil(left / perWeek))} 周能把 ${S.level} 的单词学一遍。` : `${S.level} 的单词都学过一遍了，可以挑战下一级。`);
  }
  if (x.exam && !x.exam.over) out.push(x.exam.pace ? `离 JLPT ${x.exam.e.L} 还有 ${x.exam.days} 天，按现在的速度来得及 👍` : `离 JLPT ${x.exam.e.L} 还有 ${x.exam.days} 天，需要加快一点（见上面的诊断）。`);
  if (x.lc) out.push(tje(`最近一次水平测试：${lcName(x.tr, x.lc.lv)}（${lcAgo(x.lc.t)}）`, `前回のレベルチェック：${lcName(x.tr, x.lc.lv)}（${lcAgo(x.lc.t)}）`, `Last level check: ${lcName(x.tr, x.lc.lv)} (${lcAgo(x.lc.t)})`));
  return out.filter(Boolean);
}

/* ---------- 页面 ---------- */
function viewDiag() {
  const tr = dgTrack(), x = dgData(tr), sc = dgScore(x), f = dgFindings(x);
  const member = typeof isMember === 'function' && isMember(tr);
  const names = [tje('规律', '継続', 'Habit'), tje('复习', '復習', 'Review'), tje('正确率', '正答率', 'Accuracy'), tje('均衡', 'バランス', 'Balance')];
  const parts = ['habit', 'review', 'accuracy', 'balance'];
  const grade = sc.total >= 80 ? tje('状态很好', '絶好調', 'Great shape') : sc.total >= 60 ? tje('不错，还有提升空间', 'いい調子、まだ伸びしろあり', 'Good, room to grow') : tje('需要调整一下', '少し立て直しが必要', 'Needs a tune-up');
  const ic = { good: '🌸', warn: '💡', bad: '⚠️' };
  const finding = it => `<div class="dg-f ${it.lv}"><div class="dg-ft">${ic[it.lv]} <b>${esc(it.t)}</b></div><p class="small">${esc(it.b)}</p>${it.href ? `<a class="btn small" href="${it.href}">${esc(it.go)} →</a>` : ''}</div>`;
  const lock = what => `<div class="dg-lock"><b>🔒 ${tje('会员专享', 'メンバー限定', 'Members only')}</b><span class="small">${what}${tje('加入会员即可查看。', 'メンバーになると見られます。', ' Become a member to unlock.')}</span></div>`;
  const plan = dgPlan(x), wk = dgWeek(x), ol = dgOutlook(x);
  const p = h(`<div class="dg">
    <section class="panel dg-head">
      <div class="dg-score"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" fill="none" stroke="var(--ai-soft)" stroke-width="12"/>
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--ai)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(sc.total / 100 * 314).toFixed(1)} 314" transform="rotate(-90 60 60)"/></svg>
        <div><b>${sc.total}</b><span class="small muted">${tje('学习健康分', '学習スコア', 'Study score')}</span></div></div>
      <div><h2>${tje('学习诊断', '学習診断', 'Study check-up')}</h2><p class="muted">${esc(grade)}</p>
        <div class="dg-parts">${parts.map((k, i) => `<div><span class="small">${names[i]}</span><div class="bar"><i style="width:${Math.round(sc.parts[k] * 100)}%"></i></div></div>`).join('')}</div></div>
    </section>
    <section class="panel"><h3>${tje('诊断', '診断', 'Findings')}</h3>
      ${finding(f[0])}
      ${f.length > 1 ? (member ? f.slice(1).map(finding).join('') : `<div class="dg-blur" aria-hidden="true">${finding({ lv: 'warn', t: '··········', b: '·································' })}</div>${lock(tje('其余诊断、每天的学习处方、本周目标和前景预估。', '残りの診断、毎日の学習プラン、今週の目標と見通し。', 'Other findings, your daily plan, weekly goals and outlook.'))}`) : ''}
    </section>
    ${member ? `<section class="panel"><h3>${tje('今天的学习处方', '今日の学習プラン', "Today's plan")}</h3><p class="small muted">${tje('按顺序做，大约', '順番に、約', 'In order, about')} ${plan.reduce((a, s) => a + s.m, 0)} ${tje('分钟', '分', 'min')}</p>
      <ol class="dg-plan">${plan.map(s => `<li><a href="${s.href}"><b>${esc(s.t)}</b><span class="small muted">${esc(s.d)} · ${s.m} ${tje('分钟', '分', 'min')}</span><span class="dg-go">›</span></a></li>`).join('')}</ol></section>
    <section class="panel"><h3>${tje('本周目标', '今週の目標', 'This week')}</h3>
      <div class="dg-week">${wk.map(([t, n, of]) => `<div class="${n >= of ? 'done' : ''}"><span>${n >= of ? '✅' : '⬜'} ${esc(t)}</span><span class="small muted">${n}/${of}</span></div>`).join('')}</div></section>
    ${ol.length ? `<section class="panel"><h3>${tje('前景', '見通し', 'Outlook')}</h3>${ol.map(t => `<p>${esc(t)}</p>`).join('')}</section>` : ''}` : ''}
    <p class="small muted dg-note">${tje('诊断根据你最近两周的学习记录自动生成，学得越多越准。', '診断は直近 2 週間の学習記録から自動で作成されます。学習が増えるほど正確になります。', 'Based on your last two weeks of activity; it gets more accurate as you study.')}</p>
  </div>`);
  main.append(p);
}

// 首页的小卡片：健康分 + 最要紧的一条
function dgCard() {
  const tr = dgTrack(), x = dgData(tr);
  if (Object.keys(S.days || {}).length < 3) return null;   // 刚开始学的人先不显示
  const sc = dgScore(x), f = dgFindings(x)[0];
  return h(`<a class="panel wk-more dg-card" href="#diag"><div class="wk-more-t">📋 ${tje('学习诊断', '学習診断', 'Study check-up')} · <b>${sc.total}</b></div><div class="small muted">${esc(f.t)}</div></a>`);
}
