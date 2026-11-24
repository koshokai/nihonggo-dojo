// 中文 HSK 模拟考、英语模拟考（日语的模拟考在 app.js viewExam）。题库是本站原创，tools/build_exam2.py 生成：
// 网站上只有低级别（中文 HSK1–2、英语 A1–A2，lang/zh-exam-*.json、lang/en-exam-*.json），高级别是会员内容（member.js 从服务器取）。
// 每题：{t: vocab|grammar|reading, p: 短文（阅读题）, q: 题干, py: 拼音（中文初级）, o: [正确, 干扰×3], e: 日语解说（中文题） / zh、ja: 解说（英语题）}
const EXAM2 = {
  zh: { lvs: ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'], free: ['HSK1', 'HSK2'], file: lv => `lang/zh-exam-${lv}.json`, lang: 'zh-CN', min: { HSK1: 15, HSK2: 20, HSK3: 25, HSK4: 30, HSK5: 35, HSK6: 40 } },
  en: { lvs: ['A1', 'A2', 'B1', 'B2', 'C1'], free: ['A1', 'A2'], file: lv => `lang/en-exam-${lv}.json`, lang: 'en', min: { A1: 15, A2: 20, B1: 25, B2: 30, C1: 35 } }
};
const EXAM2_DATA = {};
const exam2Load = (tr, lv) => EXAM2_DATA[tr + lv] || (EXAM2_DATA[tr + lv] = (typeof memberJson === 'function' ? memberJson(tr, EXAM2[tr].file(lv)) : fetch(EXAM2[tr].file(lv)).then(r => r.json()))
  .then(d => (tr === 'zh' && typeof enApply === 'function' ? enApply('zh', `zh-exam-${lv}.json`, 'zhexam', d) : d))   // 英语母语的用户：解说换成英文
  .catch(e => { delete EXAM2_DATA[tr + lv]; throw e; }));
// 界面文字：中文板块是日语界面；英语板块按母语（中文 / 日语）
// 英语板块：标题和按钮用英语（和底部导航一样），说明文字用母语
const e2t = (tr, zh, ja, en) => tr === 'zh' ? ja : en || (typeof enNat === 'function' ? enNat(zh, ja) : zh);
const E2_TYPE = { vocab: ['词汇', '語彙', 'Vocabulary'], grammar: ['语法', '文法', 'Grammar'], reading: ['阅读', '読解', 'Reading'] };

function exam2Page(tr, lvArg) {
  const X = EXAM2[tr], lv = X.lvs.includes(lvArg) ? lvArg : X.lvs.includes(tr === 'zh' ? zhLevel() : enLevel()) ? (tr === 'zh' ? zhLevel() : enLevel()) : X.lvs[0];   // 默认打开自己的级别
  const member = typeof isMember === 'function' && isMember(tr), locked = !X.free.includes(lv) && !member;
  const hist = ((S.exam2 || {})[tr] || []).slice(-6).reverse();
  const T = (zh, ja, en) => e2t(tr, zh, ja, en);
  const p = h(`<section class="panel ${locked ? 'has-vip' : ''}">${locked ? vipTag() : ''}
    <h2>${T('模拟考', '模擬試験', 'Practice test')} · ${lv}</h2>
    <div class="seg read-lv" role="group">${X.lvs.map(k => `<a role="button" href="#${tr}/exam/${k}" class="${k === lv ? 'on' : ''}">${k}${!X.free.includes(k) ? '' : ''}</a>`).join('')}</div>
    <p>${T('按考试的题型出题：词汇 → 语法 → 阅读，限时作答，考试中不显示对错，交卷后统一批改，每题都有解说。正确率 60% 以上盖「合格」章。', '試験の形式どおり、語彙 → 文法 → 読解の順に出題。時間内に解き、試験中は正誤を表示せず、最後にまとめて採点。すべての問題に解説つき。正答率 60% 以上で「合格」です。')}</p>
    <p class="small muted">${T('题目为本站原创，按考试题型编写，不是真题。', '問題は当サイトのオリジナルで、試験の形式に合わせて作成しています（過去問ではありません）。')}</p>
    ${locked ? `<p>${T(`${lv} 的模拟考是会员内容。${X.free.join('、')} 可以免费练。`, `${lv} の模擬試験はメンバー向けです。${X.free.join('・')} は無料で挑戦できます。`)}</p>
      <div class="row"><a class="btn pri" href="#vip">${T('了解会员', 'メンバーについて', 'About membership')}</a><a class="btn" href="#${tr}/exam/${X.free[X.free.length - 1]}">${T(`去练 ${X.free[X.free.length - 1]}`, `${X.free[X.free.length - 1]} を解く`)}</a></div>`
      : `<div class="row"><button class="btn pri" type="button" data-start>${T('开始考试', '試験を始める', 'Start the test')}</button></div>
      <div class="pick-row">${pickSelect(T('题型', '問題形式', 'Type'), 'data-drill-t', Object.entries(E2_TYPE).map(([k, v]) => [k, T(...v)]), '')}<button class="btn" type="button" data-drill>${T('题型练习', '形式別練習', 'Practice by type')}</button></div>`}
    ${hist.length ? `<h3>${T('最近成绩', '最近の成績', 'Recent scores')}</h3><div class="list-wrap"><table class="list"><tbody>${hist.map(e => `<tr><td>${e.date}</td><td>${e.lv}</td><td>${e.score}/${e.total}</td><td>${e.score / e.total >= .6 ? `<span class="tag done">${T('合格', '合格', 'Pass')}</span>` : `<span class="tag">${T('未合格', '不合格', 'Not yet')}</span>`}</td></tr>`).join('')}</tbody></table></div>` : ''}
  </section>`);
  if (typeof lcCard === 'function') main.append(lcCard());
  main.append(p);
  if (locked) return;
  const go2 = (drill) => exam2Load(tr, lv).then(all => {
    if (!all || !all.length) return toast(T('题目暂时读不到，请检查网络后再试', '問題を読み込めませんでした。通信状況を確認してください'));
    const by = t => shuffle(all.filter(x => x.t === t));
    const pickN = drill ? by(drill).slice(0, 10) : ['vocab', 'grammar', 'reading'].flatMap(t => by(t).slice(0, 10));
    // 阅读题：同一篇短文的题放在一起
    if (!drill) { const rd = pickN.filter(x => x.t === 'reading').sort((a, b) => (a.p || '').localeCompare(b.p || '')); pickN.splice(pickN.length - rd.length, rd.length, ...rd); }
    const qs = pickN.map(x => {
      const ex = tr === 'zh' ? x.e : T(x.zh, x.ja);
      return makeQ(null, 'e2' + x.t, x.o.slice(1), x.o[0], {
        optLang: tr === 'zh' ? 'zh-CN' : 'en',
        prompt: `<div class="eyebrow">${T(...E2_TYPE[x.t])}</div>${x.p ? `<div class="e2-p" lang="${X.lang}">${esc(x.p)}</div>` : ''}<div class="q-sent" lang="${/[a-zA-Z]/.test(x.q) || tr === 'zh' ? X.lang : 'ja'}">${esc(x.q)}</div>${x.py ? `<div class="small muted zh-py">${esc(x.py)}</div>` : ''}`,
        explain: `<b lang="${X.lang}">${esc(x.o[0])}</b><br>${esc(ex || '')}`
      });
    });
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    const title = drill ? `${lv} ${T(...E2_TYPE[drill])}` : `${lv} ${T('模拟考', '模擬試験', 'Practice test')}`;
    runQuiz(host, qs, drill ? { title, noRecord: true, xpEach: 8, onDone: r => { if (!r) return render(); quizSummary(host, r, { title, again: () => go2(drill) }); } }
      : { title, exam: true, minutes: X.min[lv], noRecord: true, onDone: r => {
        if (!r) return render();
        const rec = ((S.exam2 = S.exam2 || {})[tr] = S.exam2[tr] || []);
        rec.push({ lv, score: r.score, total: r.total, date: dkey() });
        const pass = r.score / r.total >= .6;
        addXP(r.score * 10 + (pass ? 50 : 0)); save();
        const by2 = {};
        r.res.forEach(x => { const k = x.q.kind.slice(2); by2[k] = by2[k] || [0, 0]; by2[k][1]++; if (x.ok) by2[k][0]++; });
        const bd = `<div class="breakdown">${Object.entries(by2).map(([k, [a, t]]) => `<div class="bd-row"><span>${T(...E2_TYPE[k])}</span><div class="bar"><i style="width:${a / t * 100}%"></i></div><span class="small">${a}/${t}</span></div>`).join('')}</div>`;
        quizSummary(host, r, { title, again: () => go2(), extraHTML: bd });
        const seal = host.querySelector('.seal');
        if (seal) { seal.textContent = pass ? '合格' : T('再挑战', '再挑戦'); seal.style.fontSize = pass ? '2.2rem' : '1.4rem'; }
        if (pass && typeof celebrate === 'function') celebrate();
      } });
  }).catch(() => toast(T('题目暂时读不到，请检查网络后再试', '問題を読み込めませんでした。通信状況を確認してください')));
  p.querySelector('[data-start]').onclick = () => go2();
  p.querySelector('[data-drill]').onclick = () => go2(p.querySelector('[data-drill-t]').value || 'vocab');
}
