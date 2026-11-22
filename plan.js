/* 我的学习方案（日语）：用户自己定目标、每天学多久、哪几天学 → 猫先生推荐每天的配比 → 用户自己加减，
   预计学完的时间跟着变；首页「今日任务」按方案生成；每周日回顾一次，按这一周实际完成的情况建议调轻 / 保持 / 加一点。
   数据存在 S.plan（会跟着账号同步）：
     { why, L, mins, days: [0–6 星期几], it: { new, rev, gram, read, listen, course, anime, biz, game }, motto, since, reviewed }
   完成情况用已有的记录算：新词 S.newLog、复习 dueList()、其余用 S.act（diagnose.js 的 actLog，按天按种类计数）。 */

// 三种语言各自一个方案：日语存在 S.plan（老数据不用搬），中文、英语存在 S.plans.zh / S.plans.en
const planTr = () => (S.track === 'zh' || S.track === 'en') ? S.track : 'ja';
const planOf = (tr = planTr()) => tr === 'ja' ? S.plan : (S.plans || {})[tr];
function planSet(tr, v) {
  if (tr === 'ja') { if (v) S.plan = v; else delete S.plan; return; }
  S.plans = S.plans || {};
  if (v) S.plans[tr] = v; else delete S.plans[tr];
}
const ZH_PLAN_LV = ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'];
// 每种语言：学的理由、有哪些练习、不同理由优先放什么、级别、到期复习数、点「开始」去哪里
const PLAN_CFG = {
  ja: {
    lang: ['日语', '日本語'],
    why: [['exam', '📝', '考 JLPT', 'JLPT 対策'], ['travel', '✈️', '去日本旅行', '日本旅行'], ['work', '💼', '工作要用', '仕事で使う'], ['anime', '🎬', '看动漫日剧', 'アニメ・ドラマ'], ['fun', '🌸', '兴趣爱好', '趣味として']],
    keys: ['new', 'rev', 'gram', 'read', 'listen', 'course', 'anime', 'biz', 'game'],
    prio: { exam: ['gram', 'listen', 'read', 'game'], travel: ['course', 'listen', 'gram', 'read'], work: ['biz', 'gram', 'read', 'listen'], anime: ['anime', 'listen', 'gram', 'read'], fun: ['read', 'game', 'course', 'anime'] },
    levels: () => LEVELS, lv: () => S.level, dates: () => typeof nextJLPT === 'function' ? nextJLPT().map(fmtD) : [],
    due: () => dueList(LEVELS).length, need: { gram: 6, listen: 3 },
    motto: ['比如：明年去京都，自己点菜、问路', '例：来年の京都旅行で、自分で注文したい'],
  },
  zh: {
    lang: ['中文', '中国語'],
    why: [['exam', '📝', '考 HSK', 'HSK 対策'], ['travel', '✈️', '去中国旅行', '中国旅行'], ['work', '💼', '工作要用', '仕事で使う'], ['drama', '🎬', '看中文剧、听歌', 'ドラマ・音楽'], ['fun', '🌸', '兴趣爱好', '趣味として']],
    keys: ['new', 'rev', 'tone', 'gram', 'read', 'listen', 'course', 'biz', 'game'],
    prio: { exam: ['gram', 'listen', 'read', 'game'], travel: ['course', 'tone', 'listen', 'gram'], work: ['biz', 'course', 'gram', 'read'], drama: ['listen', 'tone', 'read', 'course'], fun: ['read', 'game', 'course', 'tone'] },
    levels: () => ZH_PLAN_LV, lv: () => zhLevel(), dates: () => [],
    due: () => zhDueIds().length, need: { gram: 1, listen: 3 },
    motto: ['比如：明年去上海，自己点菜、问路', '例：来年の上海旅行で、自分で注文したい'],
  },
  en: {
    lang: ['英语', '英語'],
    why: [['exam', '📝', '准备英语考试', '英語の試験対策'], ['travel', '✈️', '出国旅行', '海外旅行'], ['work', '💼', '工作要用', '仕事で使う'], ['media', '🎬', '看美剧、听歌', '映画・ドラマ・音楽'], ['fun', '🌸', '兴趣爱好', '趣味として']],
    keys: ['new', 'rev', 'gram', 'read', 'listen', 'course', 'biz', 'game'],
    prio: { exam: ['gram', 'read', 'listen', 'game'], travel: ['course', 'listen', 'gram', 'read'], work: ['biz', 'read', 'gram', 'listen'], media: ['listen', 'read', 'course', 'gram'], fun: ['read', 'game', 'course', 'listen'] },
    levels: () => EN_LV, lv: () => enLevel(), dates: () => [],
    due: () => enDue().length, need: { gram: 1, listen: 3 },
    motto: ['比如：明年去伦敦，自己点菜、问路', '例：来年のロンドン旅行で、自分で注文したい'],
  },
};
// 每一项：图标、名字（{L} 换成语言名）、预计分钟（n 是数量）、完成的判断（这一天的记录够不够）
const PLAN_ITEMS = {
  new: { ic: '新', zh: '新单词', ja: '新しい単語', min: n => n * 0.6, num: true },
  rev: { ic: '復', zh: '复习到期的卡片', ja: '期限が来たカードの復習', min: (n, tr = planTr()) => Math.min(6, Math.max(2, PLAN_CFG[tr].due() * 0.15)) },
  tone: { ic: '声', zh: '声调练习 1 组', ja: '声調クイズ 1 セット', min: () => 3, act: 't' },
  gram: { ic: '文', zh: '语法练习 1 组', ja: '文法ドリル 1 セット', min: () => 4, act: 'g' },
  read: { ic: '読', zh: '阅读 1 篇', ja: '読み物 1 本', min: () => 6, act: 'r' },
  listen: { ic: '聴', zh: '听力 1 组', ja: 'リスニング 1 セット', min: () => 5, act: 'l' },
  course: { ic: '話', zh: '情景会话 1 课', ja: '場面会話 1 課', min: () => 8, act: 'c' },
  anime: { ic: '劇', zh: '动漫·日剧台词 1 段', ja: 'アニメ・ドラマのセリフ 1 本', min: () => 5, act: 'a' },
  biz: { ic: '商', zh: '商务{L} 1 段', ja: 'ビジネス{L} 1 本', min: () => 6, act: 'b' },
  game: { ic: '関', zh: '闯关 1 关', ja: 'ステージ 1 つ', min: () => 4, act: 's' },
};
const planNeed = (k, tr) => (PLAN_CFG[tr].need || {})[k] || 1;
const planLabel = (k, tr = planTr()) => { const I = PLAN_ITEMS[k], [lz, lj] = PLAN_CFG[tr].lang; return tj(I.zh.replace('{L}', lz), I.ja.replace('{L}', lj)); };
const PLAN_KEYS = PLAN_CFG.ja.keys;   // 兼容：日语的项目
const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六'], WEEK_JA = ['日', '月', '火', '水', '木', '金', '土'];
const planOn = (tr = planTr()) => { const p = planOf(tr); return !!(p && p.it); };
// 休息日：方案里没勾的星期几（方案定下来以后的日子才算，以前断掉的不补）
const planRest = d => { const p = planOf(); return !!(p && p.days && p.since && dkey(d) >= p.since && !p.days.includes(d.getDay())); };

// 按「为什么学」和「每天多久」推荐配比
function planRecommend(why, mins, p, tr = planTr()) {
  const C = PLAN_CFG[tr], it = Object.fromEntries(C.keys.map(k => [k, 0]));
  it.new = 5; it.rev = 1;
  let used = PLAN_ITEMS.rev.min(0, tr);
  for (const k of C.prio[why] || C.prio.fun) {
    if (used + PLAN_ITEMS[k].min() + 3 <= mins) { it[k] = 1; used += PLAN_ITEMS[k].min(); }
  }
  it.new = Math.max(5, Math.min(30, Math.floor((mins - used) / 0.6 / 5) * 5));
  if (why === 'exam' && p) {
    const f = planForecast(Object.assign({}, p, { it }), tr);
    if (f && f.exam && !f.exam.sprint && !f.exam.ok && f.exam.need <= 30) it.new = Math.max(it.new, Math.ceil(f.exam.need / 5) * 5);
  }
  return it;
}
const planMinutes = (it, tr = planTr()) => Math.round(PLAN_CFG[tr].keys.reduce((s, k) => s + (it[k] ? PLAN_ITEMS[k].min(it[k], tr) : 0), 0));

// 各级别还没学的单词数：日语直接算；中文、英语要先加载词表（方案页打开时 planLoadLeft）
const PLAN_LEFT = { zh: null, en: null };
async function planLoadLeft(tr) {
  if (tr === 'zh') {
    const lists = await Promise.all(ZH_PLAN_LV.map((L, i) => zhHsk(i + 1).catch(() => [])));
    PLAN_LEFT.zh = Object.fromEntries(ZH_PLAN_LV.map((L, i) => [L, lists[i].filter(x => !(S.srs[x.id] && S.srs[x.id].r > 0)).length]));
  } else if (tr === 'en') {
    const meta = await enFetch('en-levels').catch(() => []);
    PLAN_LEFT.en = Object.fromEntries(meta.map(([L, n]) => [L, Math.max(0, n - enLearned(L))]));
  }
}
function planLeft(L, tr) {
  const lvs = PLAN_CFG[tr].levels(), idx = Math.max(0, lvs.indexOf(L));
  if (tr === 'ja') return LEVELS.slice(0, idx + 1).flatMap(l => VOCAB[l]).filter(v => !learned(v)).length;
  const m = PLAN_LEFT[tr];
  return m ? lvs.slice(0, idx + 1).reduce((s, l) => s + (m[l] || 0), 0) : null;
}
// 预计什么时候学完目标级别的单词（按每周学的天数算）；中文、英语的词表还没加载时返回 null
function planForecast(p, tr = planTr()) {
  const left = planLeft(p.L, tr);
  if (left == null) return null;
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
function planItemDone(k, d = new Date(), it = planOf().it, tr = planTr()) {
  const key = dkey(d), I = PLAN_ITEMS[k];
  if (k === 'new') return (S.newLog[key] || 0) >= Math.min(it.new, tr === 'ja' ? Math.max(1, newList(S.level).length) : it.new);
  if (k === 'rev') return key === dkey() ? !PLAN_CFG[tr].due() : true;
  const a = ((S.act || {})[key] || {})[tr] || {};
  return (a[I.act] || 0) >= planNeed(k, tr);
}
const planItemProgress = (k, tr = planTr()) => {
  const I = PLAN_ITEMS[k], it = planOf(tr).it;
  if (k === 'new') return [Math.min(S.newLog[dkey()] || 0, it.new), it.new];
  if (k === 'rev') return null;
  const a = ((S.act || {})[dkey()] || {})[tr] || {}, need = planNeed(k, tr);
  return need > 1 ? [Math.min(a[I.act] || 0, need), need] : null;
};

/* ---------- 方案页（#plan） ---------- */
let planDraft = null, planDraftTr = '';
function viewPlan() {
  const tr = planTr(), C = PLAN_CFG[tr], cur = planOf(tr), [lz, lj] = C.lang;
  if (planDraftTr !== tr) { planDraft = null; planDraftTr = tr; }
  const p = planDraft = planDraft || (cur ? JSON.parse(JSON.stringify(cur)) : {
    why: '', L: C.lv(), mins: 15, days: [1, 2, 3, 4, 5, 6], it: null, motto: '',
    date: tr === 'ja' && S.exam && S.exam.date || '',
  });
  const box = h('<section class="panel plan"></section>');
  main.append(box);
  const paint = () => {
    const J = uiJa(), W = J ? WEEK_JA : WEEK_ZH;
    if (tr !== 'ja' && !PLAN_LEFT[tr] && !paint.loading) { paint.loading = true; planLoadLeft(tr).then(() => { if (box.isConnected) { if (p.why) p.it = planRecommend(p.why, p.mins, p, tr); paint(); } }).catch(() => {}); }
    if (!p.it && p.why) p.it = planRecommend(p.why, p.mins, p, tr);
    const f = p.it ? planForecast(p, tr) : null, tot = p.it ? planMinutes(p.it, tr) : 0;
    const dates = C.dates();
    box.innerHTML = `<h2>${tj('我的学习方案', 'わたしの学習プラン')}</h2>
      <p class="muted">${tj('自己定目标和节奏，猫先生帮你配好每天学什么。随时可以改。', '目標とペースを自分で決めると、毎日やることを猫先生が組み立てます。いつでも変えられます。')}</p>
      <div class="pl-q"><h3>① ${tj(`为什么学${lz}？`, `${lj}を学ぶ理由は？`)}</h3>
        <div class="pl-why">${C.why.map(([k, e, zh, ja]) => `<button type="button" class="pl-chip ${p.why === k ? 'on' : ''}" data-why="${k}"><span aria-hidden="true">${e}</span>${J ? ja : zh}</button>`).join('')}</div>
        ${p.why ? `<div class="row between pl-sub"><span>${p.why === 'exam' ? tj('要考的级别', '受ける級') : tj('想学到哪一级', '目標のレベル')}</span><div class="seg read-lv">${C.levels().map(L => `<button type="button" data-lv="${L}" class="${p.L === L ? 'on' : ''}">${L}</button>`).join('')}</div></div>` : ''}
        ${p.why === 'exam' && dates.length ? `<div class="row between pl-sub"><span>${tj('考试日期', '試験日')}</span><div class="seg">${dates.map(d => `<button type="button" data-date="${d}" class="${p.date === d ? 'on' : ''}">${d}</button>`).join('')}</div></div>` : ''}
      </div>
      <div class="pl-q"><h3>② ${tj('每天学多久？', '1 日どれくらい？')}</h3>
        <div class="seg pl-mins">${[5, 10, 15, 20, 30].map(m => `<button type="button" data-mins="${m}" class="${p.mins === m ? 'on' : ''}">${m} min</button>`).join('')}</div></div>
      <div class="pl-q"><h3>③ ${tj('哪几天学？', '何曜日に学ぶ？')}</h3>
        <div class="seg pl-mins pl-dayseg">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" class="${p.days.includes(d) ? 'on' : ''}" data-day="${d}" aria-pressed="${p.days.includes(d)}">${W[d]}</button>`).join('')}</div>
        <p class="small muted">${tj(`每周 ${p.days.length} 天。留一两天休息也没关系，休息日不会让连续打卡断掉。`, `週 ${p.days.length} 日。休みの日を作っても大丈夫。休みの日は連続記録が途切れません。`)}</p></div>
      ${p.it ? `<div class="pl-q"><div class="row between"><h3>④ ${tj('每天学什么', '毎日やること')}</h3><button type="button" class="btn ghost small" data-reco>${tj('按我的回答重新推荐', 'おすすめに戻す')}</button></div>
        <p class="small muted">${tj('猫先生按你的目标配好了。想多一点、少一点，或者不要哪一项，都可以自己调。', '目標に合わせて組みました。増やす・減らす・やめるのも自由です。')}</p>
        <div class="pl-items">${C.keys.map(k => { const I = PLAN_ITEMS[k], v = p.it[k] || 0; return `<div class="pl-item ${v ? 'on' : ''}">
          <span class="task-ic" lang="ja">${I.ic}</span><div class="pl-it-t"><b>${I.num ? `${v} ${tj('个', '語')}` : ''}${planLabel(k, tr)}</b><span class="small muted">${v ? tj(`约 ${Math.round(I.min(v, tr))} 分钟`, `約 ${Math.round(I.min(v, tr))} 分`) : tj('不学', 'なし')}</span></div>
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
        <input class="pl-motto" type="text" maxlength="40" value="${esc(p.motto || '')}" placeholder="${tj(C.motto[0], C.motto[1])}" data-motto>
        <p class="small muted">${tj('会显示在首页，学不动的时候看一眼。', 'ホームに表示されます。やる気が出ないときに。')}</p></div>
      <div class="row pl-act"><button type="button" class="btn pri" data-save>${cur ? tj('保存修改', '変更を保存') : tj('就按这个来', 'このプランで始める')}</button>
        ${cur ? `<button type="button" class="btn ghost" data-del>${tj('不用方案了', 'プランをやめる')}</button>` : ''}</div>` : `<p class="muted pl-hint">${tj(`先选一个学${lz}的理由，猫先生就能帮你配好每天的内容。`, 'まず学ぶ理由を選ぶと、毎日の内容を組み立てます。')}</p>`}`;
    const re = () => { p.it = planRecommend(p.why, p.mins, p, tr); paint(); };
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
      const fresh = !cur;
      planSet(tr, Object.assign({}, p, { since: (cur && cur.since) || dkey(), reviewed: (cur && cur.reviewed) || dkey() }));
      if (tr === 'ja') { S.newPerDay = Math.max(5, p.it.new || 5); if (p.why === 'exam' && p.date) S.exam = { L: p.L, date: p.date }; }   // 中文、英语的新词数在任务里直接用方案的数
      planDraft = null; save();
      toast(fresh ? tj('方案定好了！今天的任务已经按方案排好', 'プランができました！今日のタスクに反映しました') : tj('方案已更新', 'プランを更新しました'));
      go(tr === 'ja' ? 'home' : tr);
    };
    const dl = box.querySelector('[data-del]');
    if (dl) dl.onclick = () => { if (!confirm(tj('不用方案了吗？首页会回到默认的今日任务。', 'プランをやめますか？ホームはいつものタスクに戻ります。'))) return; planSet(tr, null); planDraft = null; save(); go(tr === 'ja' ? 'home' : tr); };
  };
  paint();
}

/* ---------- 首页：按方案生成今日任务 ---------- */
// ctx：中文首页传 { list }（当前 HSK 级别的词表），英语首页传 { items }（当前级别的单词）
function planTasks(tr = planTr(), ctx = {}) {
  const P = planOf(tr), it = P.it, C = PLAN_CFG[tr], out = [];
  const home = () => go(tr === 'ja' ? 'home' : tr);
  const cards = (ids, title) => { const host = h('<div></div>'); main.innerHTML = ''; main.append(host); startCards(host, ids, title, () => go('home')); };
  const nl = tr === 'ja' ? Math.min(newLeft(), newList(S.level).length) : 0;
  const GO = {
    ja: {
      new: () => { if (nl) cards(newList(S.level).slice(0, nl).map(v => v.id), `${S.level} ${tj('新单词', '新しい単語')}`); },
      rev: () => { const due = dueList(LEVELS); if (due.length) cards(shuffle(due).map(v => v.id), tj('复习到期卡片', '復習')); },
      gram: () => grammarQuiz(S.level, () => go('home')),
      read: () => go('read'), listen: () => go('listen'), course: () => go('course'), anime: () => go('anime'), biz: () => go('biz'),
      game: () => stageIntro(S.level, nextStage(S.level)),
    },
    zh: {
      new: () => { const fresh = (ctx.list || []).filter(x => !S.srs[x.id]).slice(0, it.new); if (fresh.length) langCards(fresh.map(zhCard), `新しい単語 · ${zhLevel()}`, 'zh'); else go('zh/words'); },
      rev: () => zhReview(), tone: () => zhToneQuiz(),
      gram: () => go('zh/grammar'), read: () => go('zh/read'), listen: () => go('zh/listen'), course: () => go('zh/course'), biz: () => go('zh/biz'), game: () => go('zh/path'),
    },
    en: {
      new: () => { const fresh = (ctx.items || []).filter(x => !S.srs[x.id]).slice(0, it.new); if (fresh.length) enCards(fresh, `New ${enLevel()} words`); else go(`en/words/${enLevel()}`); },
      rev: () => Promise.all(EN_LV.map(l => enFetch(`en-${l}`).then(r => enItems(l, r)).catch(() => []))).then(all => { const ids = new Set(enDue()), d = all.flat().filter(x => ids.has(x.id)).slice(0, 50); if (d.length) enCards(d, 'Review'); }),
      gram: () => go('en/grammar'), read: () => go('en/read'), listen: () => go(`en/listen/${enLevel()}`), course: () => go('en/course'), biz: () => go('en/biz'), game: () => go(`en/path/${enLevel()}`),
    },
  }[tr];
  for (const k of C.keys) {
    if (!it[k]) continue;
    const I = PLAN_ITEMS[k], done = planItemDone(k, new Date(), it, tr), pr = planItemProgress(k, tr);
    const t = (I.num ? `${it[k]} ${tj('个', '語の')}` : '') + planLabel(k, tr);
    const due = k === 'rev' ? C.due() : 0;
    const d = pr ? tj(`今天 ${pr[0]} / ${pr[1]}`, `今日 ${pr[0]} / ${pr[1]}`) : done ? tj('今天完成了', '今日は完了') : k === 'rev' ? tj(`${due} 张到了复习时间`, `${due} 枚が復習の時期です`) : tj('今天还没做', 'まだです');
    out.push({ ic: I.ic, t, d, done, go: GO[k] || home });
  }
  return out;
}
// 中文、英语首页的今日任务面板：有方案就按方案出任务（标题行加「调整方案」），没有就显示原来的任务 + 定制方案的入口
function planTaskPanel(tr, title, tasks, note = '', ctx = {}) {
  const on = planOn(tr);
  const tp = taskPanel(on ? tj('今日任务 · 我的方案', '今日のタスク・マイプラン') : title, on ? planTasks(tr, ctx) : tasks, on ? '' : note);
  tp.querySelector('.tasks').insertAdjacentHTML('beforebegin', `<div class="pl-head">${planHead()}</div>`);
  if (on) tp.querySelector('.row.between').insertAdjacentHTML('beforeend', `<a class="small" href="#plan">${tj('调整方案', 'プランを調整')}</a>`);
  return tp;
}
// 今日任务的标题行：方案 / 休息日 / 去定制方案
function planHead() {
  if (!planOn()) return `<a class="pl-cta" href="#plan"><span class="task-ic" lang="ja">案</span><span><b>${tj('定制我的学习方案', '自分の学習プランを作る')}</b><span class="small muted">${tj('回答 3 个问题（1 分钟），每天学什么由你决定', '3 つの質問に答えるだけ（1 分）。毎日の内容を自分で決められます')}</span></span><span aria-hidden="true">›</span></a>`;
  const P = planOf(), rest = !P.days.includes(new Date().getDay());
  return `${P.motto ? `<div class="pl-motto-show">🎯 ${esc(P.motto)}</div>` : ''}${rest ? `<div class="pl-rest">🌿 ${tj('今天是休息日，不学也不会断连续打卡。想学的话下面随便挑。', '今日はお休みの日。学ばなくても連続記録は途切れません。やりたいものだけどうぞ。')}</div>` : ''}`;
}

/* ---------- 每周回顾（周日，或者上次回顾满 7 天） ---------- */
function planWeekStats() {
  const tr = planTr(), P = planOf(tr), it = P.it, keys = PLAN_CFG[tr].keys.filter(k => it[k] && k !== 'rev');
  const per = Object.fromEntries(keys.map(k => [k, 0]));
  let plannedDays = 0, fullDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - i * DAY);
    if (dkey(d) < P.since || !P.days.includes(d.getDay())) continue;
    plannedDays++;
    let all = true;
    keys.forEach(k => { if (planItemDone(k, d, it, tr)) per[k]++; else all = false; });
    if (all) fullDays++;
  }
  return { plannedDays, fullDays, per, keys };
}
function planReviewCard() {
  if (!planOn()) return null;
  const P = planOf(), today = dkey(), last = P.reviewed || P.since;
  const age = (Date.now() - new Date(P.since + 'T00:00:00').getTime()) / DAY;
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
    <div class="pl-rv-bars">${st.keys.map(k => `<div><span class="small">${planLabel(k)}</span><div class="bar"><i style="width:${st.per[k] / st.plannedDays * 100}%"></i></div><span class="small muted">${st.per[k]}/${st.plannedDays}</span></div>`).join('')}</div>
    <p class="small">${sugg === 'less' ? tj(`完成得有点吃力。减一点量，能坚持下来比学得多更重要。${worst && st.per[worst] / st.plannedDays < 0.4 ? `「${planLabel(worst)}」这周做得最少，可以先拿掉。` : ''}`, `少しきつかったようです。続けることのほうが大事なので、量を減らしましょう。${worst && st.per[worst] / st.plannedDays < 0.4 ? `「${PLAN_ITEMS[worst].ja}」が一番少なかったので、いったん外してもいいかも。` : ''}`)
      : sugg === 'more' ? tj('这周几乎每天都完成了，很棒！可以再加一点。', 'ほぼ毎日やり切りました！少し増やしてもよさそうです。')
      : tj('节奏不错，保持就好。', 'いいペースです。このまま続けましょう。')}</p>
    <div class="row"><button type="button" class="btn ${sugg === 'less' ? 'pri' : ''}" data-rv="less">${tj('轻一点', '減らす')}</button><button type="button" class="btn ${sugg === 'keep' ? 'pri' : ''}" data-rv="keep">${tj('保持', 'このまま')}</button><button type="button" class="btn ${sugg === 'more' ? 'pri' : ''}" data-rv="more">${tj('再加一点', '増やす')}</button><a class="small" href="#plan">${tj('自己调', '自分で調整')}</a></div>
  </section>`);
  el.querySelectorAll('[data-rv]').forEach(b => { b.onclick = () => {
    const it = P.it, v = b.dataset.rv;
    if (v === 'less') { it.new = Math.max(5, it.new - 5); if (worst && st.per[worst] / st.plannedDays < 0.4 && st.keys.length > 1) it[worst] = 0; }
    if (v === 'more') it.new = Math.min(30, it.new + 5);
    if (planTr() === 'ja') S.newPerDay = Math.max(5, it.new);
    P.reviewed = today; save();
    toast(v === 'keep' ? tj('好，保持这个节奏', 'このペースでいきましょう') : tj(`已调整：每天 ${it.new} 个新词`, `調整しました：1 日 ${it.new} 語`));
    render();
  }; });
  return el;
}
