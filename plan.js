/* 我的学习方案（日语）：用户自己定目标、每天学多久、哪几天学 → 猫先生推荐每天的配比 → 用户自己加减，
   预计学完的时间跟着变；首页「今日任务」按方案生成；每周日回顾一次，按这一周实际完成的情况建议调轻 / 保持 / 加一点。
   数据存在 S.plan（会跟着账号同步）：
     { why, L, mins, days: [0–6 星期几], it: { new, rev, gram, read, listen, course, anime, biz, game }, motto, since, reviewed }
   完成情况用已有的记录算：新词 S.newLog、复习 dueList()、其余用 S.act（diagnose.js 的 actLog，按天按种类计数）。 */

const PLAN_WHY = [
  ['exam', '📝', '考 JLPT', 'JLPT 対策'],
  ['travel', '✈️', '去日本旅行', '日本旅行'],
  ['work', '💼', '工作要用', '仕事で使う'],
  ['anime', '🎬', '看动漫日剧', 'アニメ・ドラマ'],
  ['fun', '🌸', '兴趣爱好', '趣味として'],
];
// 每一项：图标、名字、单位、预计分钟（n 是数量）、完成的判断（这一天的记录够不够）、点「开始」去哪里
const PLAN_ITEMS = {
  new: { ic: '新', zh: '新单词', ja: '新しい単語', min: n => n * 0.6, num: true },
  rev: { ic: '復', zh: '复习到期的卡片', ja: '期限が来たカードの復習', min: () => Math.min(6, Math.max(2, dueList(LEVELS).length * 0.15)) },
  gram: { ic: '文', zh: '语法练习 1 组', ja: '文法ドリル 1 セット', min: () => 4, act: 'g', need: 6 },
  read: { ic: '読', zh: '阅读 1 篇', ja: '読み物 1 本', min: () => 6, act: 'r', need: 1 },
  listen: { ic: '聴', zh: '听力 1 组', ja: 'リスニング 1 セット', min: () => 5, act: 'l', need: 3 },
  course: { ic: '話', zh: '情景会话 1 课', ja: '場面会話 1 課', min: () => 8, act: 'c', need: 1 },
  anime: { ic: '劇', zh: '动漫·日剧台词 1 段', ja: 'アニメ・ドラマのセリフ 1 本', min: () => 5, act: 'a', need: 1 },
  biz: { ic: '商', zh: '商务日语 1 段', ja: 'ビジネス日本語 1 本', min: () => 6, act: 'b', need: 1 },
  game: { ic: '関', zh: '闯关 1 关', ja: 'ステージ 1 つ', min: () => 4, act: 's', need: 1 },
};
const PLAN_KEYS = ['new', 'rev', 'gram', 'read', 'listen', 'course', 'anime', 'biz', 'game'];
// 不同目标优先放哪些内容（新词、复习每个方案都有）
const PLAN_PRIO = {
  exam: ['gram', 'listen', 'read', 'game'],
  travel: ['course', 'listen', 'gram', 'read'],
  work: ['biz', 'gram', 'read', 'listen'],
  anime: ['anime', 'listen', 'gram', 'read'],
  fun: ['read', 'game', 'course', 'anime'],
};
const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六'], WEEK_JA = ['日', '月', '火', '水', '木', '金', '土'];
const planOn = () => !!(S.plan && S.plan.it && (S.track || 'ja') === 'ja');
// 休息日：方案里没勾的星期几（方案定下来以后的日子才算，以前断掉的不补）
const planRest = d => !!(S.plan && S.plan.days && S.plan.since && dkey(d) >= S.plan.since && !S.plan.days.includes(d.getDay()));

// 按「为什么学」和「每天多久」推荐配比
function planRecommend(why, mins, p) {
  const it = { new: 5, rev: 1, gram: 0, read: 0, listen: 0, course: 0, anime: 0, biz: 0, game: 0 };
  let used = PLAN_ITEMS.rev.min();
  for (const k of PLAN_PRIO[why] || PLAN_PRIO.fun) {
    if (used + PLAN_ITEMS[k].min() + 3 <= mins) { it[k] = 1; used += PLAN_ITEMS[k].min(); }
  }
  it.new = Math.max(5, Math.min(30, Math.floor((mins - used) / 0.6 / 5) * 5));
  if (why === 'exam' && p) {
    const f = planForecast(Object.assign({}, p, { it }));
    if (f.exam && !f.exam.sprint && !f.exam.ok && f.exam.need <= 30) it.new = Math.max(it.new, Math.ceil(f.exam.need / 5) * 5);
  }
  return it;
}
const planMinutes = it => Math.round(PLAN_KEYS.reduce((s, k) => s + (it[k] ? PLAN_ITEMS[k].min(it[k]) : 0), 0));

// 预计什么时候学完目标级别的单词（按每周学的天数算）
function planForecast(p) {
  const idx = Math.max(0, LEVELS.indexOf(p.L));
  const left = LEVELS.slice(0, idx + 1).flatMap(L => VOCAB[L]).filter(v => !learned(v)).length;
  const perWeek = (p.it.new || 0) * (p.days || []).length;
  if (!left) return { left, done: true };
  if (!perWeek) return { left, never: true };
  const weeks = left / perWeek, end = new Date(Date.now() + Math.ceil(weeks * 7) * DAY);
  let exam = null;
  if (p.why === 'exam' && p.date) {
    const until = Math.ceil((new Date(p.date + 'T09:00:00').getTime() - Date.now()) / DAY);
    if (until < 35) return { left, weeks, end, exam: { sprint: true, days: Math.max(0, until) } };   // 不到 5 周：冲刺，不再按学完单词来算
    const dl = new Date(p.date + 'T09:00:00').getTime() - 21 * DAY;   // 考前三周留给复习和模拟考
    const studyWeeks = Math.max(0.1, (dl - Date.now()) / (7 * DAY));
    exam = { ok: end.getTime() <= dl, need: Math.min(99, Math.ceil(left / studyWeeks / Math.max(1, p.days.length))) };
  }
  return { left, weeks, end, exam };
}
const ymd = d => tj(`${d.getFullYear()} 年 ${d.getMonth() + 1} 月`, `${d.getFullYear()}年${d.getMonth() + 1}月`);

// 某一天某一项完成了没有（复习只看今天：以前的日子不知道当时有没有到期的卡片）
function planItemDone(k, d = new Date(), it = S.plan.it) {
  const key = dkey(d), I = PLAN_ITEMS[k];
  if (k === 'new') return (S.newLog[key] || 0) >= Math.min(it.new, Math.max(1, newList(S.level).length));
  if (k === 'rev') return key === dkey() ? !dueList(LEVELS).length : true;
  const a = ((S.act || {})[key] || {}).ja || {};
  return (a[I.act] || 0) >= I.need;
}
const planItemProgress = k => {
  const I = PLAN_ITEMS[k];
  if (k === 'new') return [Math.min(S.newLog[dkey()] || 0, S.plan.it.new), S.plan.it.new];
  if (k === 'rev') return null;
  const a = ((S.act || {})[dkey()] || {}).ja || {};
  return I.need > 1 ? [Math.min(a[I.act] || 0, I.need), I.need] : null;
};

/* ---------- 方案页（#plan） ---------- */
let planDraft = null;
function viewPlan() {
  const p = planDraft = planDraft || (S.plan ? JSON.parse(JSON.stringify(S.plan)) : {
    why: '', L: S.level, mins: 15, days: [1, 2, 3, 4, 5, 6], it: null, motto: '',
    date: S.exam && S.exam.date || '',
  });
  const box = h('<section class="panel plan"></section>');
  main.append(box);
  const paint = () => {
    const J = uiJa(), W = J ? WEEK_JA : WEEK_ZH;
    if (!p.it && p.why) p.it = planRecommend(p.why, p.mins, p);
    const f = p.it ? planForecast(p) : null, tot = p.it ? planMinutes(p.it) : 0;
    const dates = typeof nextJLPT === 'function' ? nextJLPT().map(fmtD) : [];
    box.innerHTML = `<h2>${tj('我的学习方案', 'わたしの学習プラン')}</h2>
      <p class="muted">${tj('自己定目标和节奏，猫先生帮你配好每天学什么。随时可以改。', '目標とペースを自分で決めると、毎日やることを猫先生が組み立てます。いつでも変えられます。')}</p>
      <div class="pl-q"><h3>① ${tj('为什么学日语？', '日本語を学ぶ理由は？')}</h3>
        <div class="pl-why">${PLAN_WHY.map(([k, e, zh, ja]) => `<button type="button" class="pl-chip ${p.why === k ? 'on' : ''}" data-why="${k}"><span aria-hidden="true">${e}</span>${J ? ja : zh}</button>`).join('')}</div>
        ${p.why ? `<div class="row between pl-sub"><span>${p.why === 'exam' ? tj('要考的级别', '受ける級') : tj('想学到哪一级', '目標のレベル')}</span><div class="seg read-lv">${LEVELS.map(L => `<button type="button" data-lv="${L}" class="${p.L === L ? 'on' : ''}">${L}</button>`).join('')}</div></div>` : ''}
        ${p.why === 'exam' ? `<div class="row between pl-sub"><span>${tj('考试日期', '試験日')}</span><div class="seg">${dates.map(d => `<button type="button" data-date="${d}" class="${p.date === d ? 'on' : ''}">${d}</button>`).join('')}</div></div>` : ''}
      </div>
      <div class="pl-q"><h3>② ${tj('每天学多久？', '1 日どれくらい？')}</h3>
        <div class="seg pl-mins">${[5, 10, 15, 20, 30].map(m => `<button type="button" data-mins="${m}" class="${p.mins === m ? 'on' : ''}">${m} min</button>`).join('')}</div></div>
      <div class="pl-q"><h3>③ ${tj('哪几天学？', '何曜日に学ぶ？')}</h3>
        <div class="seg pl-mins pl-dayseg">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" class="${p.days.includes(d) ? 'on' : ''}" data-day="${d}" aria-pressed="${p.days.includes(d)}">${W[d]}</button>`).join('')}</div>
        <p class="small muted">${tj(`每周 ${p.days.length} 天。留一两天休息也没关系，休息日不会让连续打卡断掉。`, `週 ${p.days.length} 日。休みの日を作っても大丈夫。休みの日は連続記録が途切れません。`)}</p></div>
      ${p.it ? `<div class="pl-q"><div class="row between"><h3>④ ${tj('每天学什么', '毎日やること')}</h3><button type="button" class="btn ghost small" data-reco>${tj('按我的回答重新推荐', 'おすすめに戻す')}</button></div>
        <p class="small muted">${tj('猫先生按你的目标配好了。想多一点、少一点，或者不要哪一项，都可以自己调。', '目標に合わせて組みました。増やす・減らす・やめるのも自由です。')}</p>
        <div class="pl-items">${PLAN_KEYS.map(k => { const I = PLAN_ITEMS[k], v = p.it[k]; return `<div class="pl-item ${v ? 'on' : ''}">
          <span class="task-ic" lang="ja">${I.ic}</span><div class="pl-it-t"><b>${I.num ? `${v} ${tj('个', '語')}` : ''}${J ? I.ja : I.zh}</b><span class="small muted">${v ? tj(`约 ${Math.round(I.min(v))} 分钟`, `約 ${Math.round(I.min(v))} 分`) : tj('不学', 'なし')}</span></div>
          ${I.num ? `<div class="pl-step"><button type="button" data-dec="${k}" aria-label="${tj('少一点', '減らす')}" ${v <= 0 ? 'disabled' : ''}>−</button><button type="button" data-inc="${k}" aria-label="${tj('多一点', '増やす')}" ${v >= 30 ? 'disabled' : ''}>＋</button></div>`
            : `<label class="pl-tog"><input type="checkbox" data-tog="${k}" ${v ? 'checked' : ''}><span></span></label>`}</div>`; }).join('')}</div>
        <div class="pl-sum ${tot > p.mins * 1.25 ? 'over' : ''}"><b>${tj(`合计约 ${tot} 分钟`, `合計 約 ${tot} 分`)}</b><span class="small">${tot > p.mins * 1.25 ? tj(`比你定的 ${p.mins} 分钟多不少，坚持不下来的话可以减一点`, `決めた ${p.mins} 分より多めです。続かないときは減らしましょう`) : tj(`你定的是每天 ${p.mins} 分钟`, `目標は 1 日 ${p.mins} 分`)}</span></div>
        ${f ? `<div class="pl-fc">${f.done ? tj(`${p.L} 以内的单词都学过了 🎉 接下来以复习、阅读和听力为主。`, `${p.L} までの単語はすべて学習済み 🎉 これからは復習・読解・聴解が中心です。`)
          : f.never ? tj('每天新单词设成 0 了：只复习、不学新词。', '新しい単語が 0 なので、復習だけになります。')
          : `${tj(`按这个节奏：${p.L} 以内还有 <b>${f.left}</b> 个单词没学，大约 <b>${Math.ceil(f.weeks)}</b> 周学完（${ymd(f.end)}）。`, `このペースだと：${p.L} までの未習単語 <b>${f.left}</b> 語を、約 <b>${Math.ceil(f.weeks)}</b> 週間で学び終えます（${ymd(f.end)}）。`)}
            ${f.exam && f.exam.sprint ? `<div class="pl-warn">${tj(`离考试只有 ${f.exam.days} 天：这段时间以复习、模拟考和订正错题为主，新词少学一点。也可以把目标放到下一次考试。`, `試験まであと ${f.exam.days} 日。復習・模試・間違い直しを中心にして、新しい単語は控えめに。次の試験を目標にしても OK。`)}</div>`
              : f.exam ? (f.exam.ok ? `<div class="pl-ok">✓ ${tj('考前三周能学完，留出时间复习和做模拟考。', '試験の 3 週間前までに終わり、復習と模試の時間が取れます。')}</div>`
              : `<div class="pl-warn">${tj(`考前来不及：要在考前三周学完，每个学习日需要约 ${f.exam.need} 个新词。`, `試験に間に合いません。3 週間前までに終えるには、学習日ごとに約 ${f.exam.need} 語必要です。`)}${f.exam.need <= 30 ? ` <button type="button" class="btn small" data-need="${f.exam.need}">${tj(`调到 ${Math.ceil(f.exam.need / 5) * 5} 个`, `${Math.ceil(f.exam.need / 5) * 5} 語にする`)}</button>` : ''}</div>`) : ''}`}</div>` : ''}
      </div>
      <div class="pl-q"><h3>⑤ ${tj('写一句给自己的话（可选）', '自分へのひとこと（任意）')}</h3>
        <input class="pl-motto" type="text" maxlength="40" value="${esc(p.motto || '')}" placeholder="${tj('比如：明年去京都，自己点菜、问路', '例：来年の京都旅行で、自分で注文したい')}" data-motto>
        <p class="small muted">${tj('会显示在首页，学不动的时候看一眼。', 'ホームに表示されます。やる気が出ないときに。')}</p></div>
      <div class="row pl-act"><button type="button" class="btn pri" data-save>${S.plan ? tj('保存修改', '変更を保存') : tj('就按这个来', 'このプランで始める')}</button>
        ${S.plan ? `<button type="button" class="btn ghost" data-del>${tj('不用方案了', 'プランをやめる')}</button>` : ''}</div>` : `<p class="muted pl-hint">${tj('先选一个学日语的理由，猫先生就能帮你配好每天的内容。', 'まず学ぶ理由を選ぶと、毎日の内容を組み立てます。')}</p>`}`;
    const re = () => { p.it = planRecommend(p.why, p.mins, p); paint(); };
    box.querySelectorAll('[data-why]').forEach(b => { b.onclick = () => {
      p.why = b.dataset.why;
      if (p.why === 'exam' && !p.date && dates.length) p.date = dates.find(d => new Date(d + 'T09:00:00').getTime() - Date.now() >= 42 * DAY) || dates[dates.length - 1];   // 太近的那次来不及准备
      re();
    }; });
    box.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => { p.L = b.dataset.lv; if (p.why === 'exam') re(); else paint(); }; });
    box.querySelectorAll('[data-date]').forEach(b => { b.onclick = () => { p.date = b.dataset.date; re(); }; });
    box.querySelectorAll('[data-mins]').forEach(b => { b.onclick = () => { p.mins = +b.dataset.mins; if (p.why) re(); else paint(); }; });
    box.querySelectorAll('[data-day]').forEach(b => { b.onclick = () => { const d = +b.dataset.day; if (p.days.includes(d)) { if (p.days.length > 1) p.days = p.days.filter(x => x !== d); else return toast(tj('每周至少学一天', '週に 1 日は学びましょう')); } else p.days.push(d); paint(); }; });
    box.querySelectorAll('[data-dec]').forEach(b => { b.onclick = () => { const k = b.dataset.dec; p.it[k] = Math.max(0, p.it[k] - 5); paint(); }; });
    box.querySelectorAll('[data-inc]').forEach(b => { b.onclick = () => { const k = b.dataset.inc; p.it[k] = Math.min(30, p.it[k] + 5); paint(); }; });
    box.querySelectorAll('[data-tog]').forEach(c => { c.onchange = () => { p.it[c.dataset.tog] = c.checked ? 1 : 0; paint(); }; });
    const need = box.querySelector('[data-need]'); if (need) need.onclick = () => { p.it.new = Math.min(30, Math.ceil(+need.dataset.need / 5) * 5); paint(); };
    const rc = box.querySelector('[data-reco]'); if (rc) rc.onclick = re;
    const mo = box.querySelector('[data-motto]'); if (mo) mo.oninput = () => { p.motto = mo.value.trim(); };
    const sv = box.querySelector('[data-save]');
    if (sv) sv.onclick = () => {
      const fresh = !S.plan;
      S.plan = Object.assign({}, p, { since: (S.plan && S.plan.since) || dkey(), reviewed: (S.plan && S.plan.reviewed) || dkey() });
      S.newPerDay = Math.max(5, p.it.new || 5);
      if (p.why === 'exam' && p.date) S.exam = { L: p.L, date: p.date };
      planDraft = null; save();
      toast(fresh ? tj('方案定好了！今天的任务已经按方案排好', 'プランができました！今日のタスクに反映しました') : tj('方案已更新', 'プランを更新しました'));
      go('home');
    };
    const dl = box.querySelector('[data-del]');
    if (dl) dl.onclick = () => { if (!confirm(tj('不用方案了吗？首页会回到默认的今日任务。', 'プランをやめますか？ホームはいつものタスクに戻ります。'))) return; delete S.plan; planDraft = null; save(); go('home'); };
  };
  paint();
}

/* ---------- 首页：按方案生成今日任务 ---------- */
function planTasks() {
  const it = S.plan.it, out = [];
  const nl = Math.min(newLeft(), newList(S.level).length);
  const cards = (ids, title) => { const host = h('<div></div>'); main.innerHTML = ''; main.append(host); startCards(host, ids, title, () => go('home')); };
  for (const k of PLAN_KEYS) {
    if (!it[k]) continue;
    const I = PLAN_ITEMS[k], done = planItemDone(k), pr = planItemProgress(k);
    const t = (I.num ? `${it[k]} ${tj('个', '語の')}` : '') + tj(I.zh, I.ja);
    const d = pr ? tj(`今天 ${pr[0]} / ${pr[1]}`, `今日 ${pr[0]} / ${pr[1]}`) : done ? tj('今天完成了', '今日は完了') : k === 'rev' ? tj(`${dueList(LEVELS).length} 张到了复习时间`, `${dueList(LEVELS).length} 枚が復習の時期です`) : tj(`约 ${Math.round(I.min(it[k]))} 分钟`, `約 ${Math.round(I.min(it[k]))} 分`);
    const goTo = {
      new: () => { if (nl) cards(newList(S.level).slice(0, nl).map(v => v.id), `${S.level} ${tj('新单词', '新しい単語')}`); },
      rev: () => { const due = dueList(LEVELS); if (due.length) cards(shuffle(due).map(v => v.id), tj('复习到期卡片', '復習')); },
      gram: () => grammarQuiz(S.level, () => go('home')),
      read: () => go('read'), listen: () => go('listen'), course: () => go('course'), anime: () => go('anime'), biz: () => go('biz'),
      game: () => stageIntro(S.level, nextStage(S.level)),
    }[k];
    out.push({ ic: I.ic, t, d, done, go: goTo });
  }
  return out;
}
// 今日任务的标题行：方案 / 休息日 / 去定制方案
function planHead() {
  if (!planOn()) return `<a class="pl-cta" href="#plan"><span class="task-ic" lang="ja">案</span><span><b>${tj('定制我的学习方案', '自分の学習プランを作る')}</b><span class="small muted">${tj('回答 3 个问题（1 分钟），每天学什么由你决定', '3 つの質問に答えるだけ（1 分）。毎日の内容を自分で決められます')}</span></span><span aria-hidden="true">›</span></a>`;
  const rest = !S.plan.days.includes(new Date().getDay());
  return `${S.plan.motto ? `<div class="pl-motto-show">🎯 ${esc(S.plan.motto)}</div>` : ''}${rest ? `<div class="pl-rest">🌿 ${tj('今天是休息日，不学也不会断连续打卡。想学的话下面随便挑。', '今日はお休みの日。学ばなくても連続記録は途切れません。やりたいものだけどうぞ。')}</div>` : ''}`;
}

/* ---------- 每周回顾（周日，或者上次回顾满 7 天） ---------- */
function planWeekStats() {
  const it = S.plan.it, keys = PLAN_KEYS.filter(k => it[k] && k !== 'rev');
  const per = Object.fromEntries(keys.map(k => [k, 0]));
  let plannedDays = 0, fullDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - i * DAY);
    if (dkey(d) < S.plan.since || !S.plan.days.includes(d.getDay())) continue;
    plannedDays++;
    let all = true;
    keys.forEach(k => { if (planItemDone(k, d, it)) per[k]++; else all = false; });
    if (all) fullDays++;
  }
  return { plannedDays, fullDays, per, keys };
}
function planReviewCard() {
  if (!planOn()) return null;
  const today = dkey(), last = S.plan.reviewed || S.plan.since;
  const age = (Date.now() - new Date(S.plan.since + 'T00:00:00').getTime()) / DAY;
  const due = (new Date().getDay() === 0 && last !== today) || (Date.now() - new Date(last + 'T00:00:00').getTime()) / DAY >= 7;
  if (!due || age < 4) return null;
  const st = planWeekStats();
  if (!st.plannedDays) return null;
  const rate = st.fullDays / st.plannedDays;
  const sugg = rate < 0.5 ? 'less' : rate >= 0.9 ? 'more' : 'keep';
  const worst = st.keys.slice().sort((a, b) => st.per[a] - st.per[b])[0];
  const el = h(`<section class="panel pl-review">
    <div class="eyebrow">${tj('本周回顾', '今週のふりかえり')}</div>
    <h3>${tj(`这周计划学 ${st.plannedDays} 天，全部完成 ${st.fullDays} 天`, `今週は ${st.plannedDays} 日の予定で、すべて終えたのは ${st.fullDays} 日`)}</h3>
    <div class="pl-rv-bars">${st.keys.map(k => `<div><span class="small">${tj(PLAN_ITEMS[k].zh, PLAN_ITEMS[k].ja)}</span><div class="bar"><i style="width:${st.per[k] / st.plannedDays * 100}%"></i></div><span class="small muted">${st.per[k]}/${st.plannedDays}</span></div>`).join('')}</div>
    <p class="small">${sugg === 'less' ? tj(`完成得有点吃力。减一点量，能坚持下来比学得多更重要。${worst && st.per[worst] / st.plannedDays < 0.4 ? `「${PLAN_ITEMS[worst].zh}」这周做得最少，可以先拿掉。` : ''}`, `少しきつかったようです。続けることのほうが大事なので、量を減らしましょう。${worst && st.per[worst] / st.plannedDays < 0.4 ? `「${PLAN_ITEMS[worst].ja}」が一番少なかったので、いったん外してもいいかも。` : ''}`)
      : sugg === 'more' ? tj('这周几乎每天都完成了，很棒！可以再加一点。', 'ほぼ毎日やり切りました！少し増やしてもよさそうです。')
      : tj('节奏不错，保持就好。', 'いいペースです。このまま続けましょう。')}</p>
    <div class="row"><button type="button" class="btn ${sugg === 'less' ? 'pri' : ''}" data-rv="less">${tj('轻一点', '減らす')}</button><button type="button" class="btn ${sugg === 'keep' ? 'pri' : ''}" data-rv="keep">${tj('保持', 'このまま')}</button><button type="button" class="btn ${sugg === 'more' ? 'pri' : ''}" data-rv="more">${tj('再加一点', '増やす')}</button><a class="small" href="#plan">${tj('自己调', '自分で調整')}</a></div>
  </section>`);
  el.querySelectorAll('[data-rv]').forEach(b => { b.onclick = () => {
    const it = S.plan.it, v = b.dataset.rv;
    if (v === 'less') { it.new = Math.max(5, it.new - 5); if (worst && st.per[worst] / st.plannedDays < 0.4 && st.keys.length > 1) it[worst] = 0; }
    if (v === 'more') it.new = Math.min(30, it.new + 5);
    S.newPerDay = Math.max(5, it.new); S.plan.reviewed = today; save();
    toast(v === 'keep' ? tj('好，保持这个节奏', 'このペースでいきましょう') : tj(`已调整：每天 ${it.new} 个新词`, `調整しました：1 日 ${it.new} 語`));
    render();
  }; });
  return el;
}
