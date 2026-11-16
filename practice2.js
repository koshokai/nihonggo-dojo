'use strict';
// 中文、英语的听写和翻译练习（日语的在 dictation.js / trans.js）。和日语一样：听写只出有录音的句子，写完自动比对；
// 翻译先自己译、再看参考答案、自己打分，「不会」的句子下次优先再出。
// 界面文字：中文板块是日语界面；英语板块按母语（enNat：中文 / 日语）。句子来自各级别单词的例句。
const P2 = {
  zh: {
    lang: 'zh-CN', code: 'zh', name: '中国語', lvs: ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'], lv: () => zhLevel(), back: '#zh/ri',
    T: (zh, ja) => ja,
    pool: lv => zhHsk(+lv.slice(3)).then(xs => xs.filter(x => x.ex).map(x => ({ t: x.ex, py: x.expy, n: x.exja, L: lv }))),
    tap: s => zhTap(s)
  },
  en: {
    lang: 'en-US', code: 'en', name: 'English', lvs: EN_LV, lv: () => enLevel(), back: '#en/ri',
    T: (zh, ja, en) => en || enNat(zh, ja),   // 标题、按钮用英语，说明用母语
    pool: lv => enFetch(`en-${lv}`).then(rows => enItems(lv, rows).filter(x => x.ex).map(x => ({ t: x.ex, n: enNat(x.exzh, x.exja), L: lv }))),
    tap: s => enTap(s)
  }
};
const p2Opt = tr => ((S.p2opt = S.p2opt || {})[tr] = Object.assign({ lv: P2[tr].lv(), dir: 'n2t' }, (S.p2opt || {})[tr]));
// 拼音比对：去掉声调符号和空格（「ni hao」「nǐhǎo」都算对）；ü 写成 v、u、ü 都算对
const p2Py = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/v/g, 'u').replace(/[^a-z]/g, '');
// 一个级别的句子（同一句只留一次）；听写只要有录音的（会员的录音在私有存储里，会员都算有）
function p2Pool(tr, lv, needAudio) {
  const X = P2[tr];
  return Promise.all([X.pool(lv), needAudio ? langAudioIdx(X.code) : null]).then(([xs, idx]) => {
    const seen = new Set(), mem = typeof isMember === 'function' && isMember(X.code);
    return xs.filter(x => !seen.has(x.t) && seen.add(x.t) && (!needAudio || idx[x.t] || mem));
  });
}

function p2Setup(tr, kind) {
  const X = P2[tr], T = X.T, o = p2Opt(tr), dict = kind === 'dict';
  const title = dict ? T('听写', 'ディクテーション', 'Dictation') : T('翻译练习', '翻訳トレーニング', 'Translation');
  const box = h(`<section class="panel"><h2>${title}</h2><div class="skel" role="status"><i></i><i></i><i></i></div></section>`);
  main.append(box);
  if (tr === 'en') box.before(enLangBar());
  p2Pool(tr, o.lv, dict).then(pool => {
    if (!box.isConnected) return;
    const again = ((S.p2again || {})[tr] || []).length;
    const desc = dict
      ? (tr === 'zh' ? '音声を 1 文聞いて、聞こえた中国語を書きましょう。漢字でも、ピンイン（声調なし）でも OK。書き終わると自動で答え合わせします。'
        : T('听一句英语，把听到的写下来，写完自动比对。大小写和标点不算错，没听清可以再放一遍或放慢。', '英語を 1 文聞いて、聞こえたとおりに書きましょう。大文字・小文字や句読点は気にしなくて OK。聞き取れなければ、もう一度再生したり、ゆっくり再生したりできます。'))
      : (tr === 'zh' ? 'まず自分で訳してみて（書いても、頭の中で言ってもOK）、答えを開いて自己採点。「まだ」の文は次回また出てきます。'
        : T('先自己翻译（写下来或在心里说都行），再翻开参考答案，按感觉打分。「不会」的句子下次会再出现。', 'まず自分で訳してみて（書いても、頭の中で言っても OK）、答えを開いて自己採点。「まだ」の文は次回また出てきます。'));
    const seg = (k, items) => `<div class="seg read-lv" role="group">${items.map(([v, t]) => `<button type="button" data-${k}="${v}" class="${o[k] === v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const nat = tr === 'zh' ? '日本語' : T('中文', '日本語');
    const p = h(`<section class="panel"><h2>${title}</h2>
      <p class="small muted">${desc}</p>
      ${seg('lv', X.lvs.map(l => [l, l]))}
      ${dict ? '' : `<div class="row between"><span>${T('方向', '方向')}</span>${seg('dir', [['n2t', `${nat} → ${X.name}`], ['t2n', `${X.name} → ${nat}`]])}</div>`}
      <div class="row between">${again && !dict ? `<span class="small muted">${T('待重练', 'もう一度練習する文')} ${again}</span>` : '<span></span>'}<button class="btn pri" type="button" data-go ${pool.length ? '' : 'disabled'}>${T('开始 10 句', '10 文スタート', 'Start 10')}</button></div>
      ${pool.length ? '' : `<p class="small muted">${dict ? T('这个级别的录音还在准备中，先换一个级别试试。', 'このレベルの音声は準備中です。ほかのレベルを試してみてください。') : T('这个级别的句子还在准备中，先换一个级别试试。', 'このレベルの文は準備中です。ほかのレベルを試してみてください。')}</p>`}
    </section>`);
    p.querySelectorAll('[data-lv],[data-dir]').forEach(b => { b.onclick = () => { if (b.dataset.lv) o.lv = b.dataset.lv; if (b.dataset.dir) o.dir = b.dataset.dir; save(); render(); }; });
    const go = p.querySelector('[data-go]');
    if (go) go.onclick = () => {
      const ag = new Set((S.p2again || {})[tr] || []);
      const first = shuffle(pool.filter(x => ag.has(x.t))).slice(0, 4);
      const list = [...first, ...sample(pool.filter(x => !ag.has(x.t)), 10 - first.length)];
      (dict ? p2Dict : p2Trans)(tr, list);
    };
    box.replaceWith(p);
  }).catch(() => { if (box.isConnected) box.innerHTML = `<h2>${title}</h2><p class="muted">${T('读取失败，请检查网络后再试。', '読み込めませんでした。通信状況を確認して、もう一度お試しください。')}</p>`; });
}

function p2Dict(tr, items) {
  const X = P2[tr], T = X.T;
  main.innerHTML = '';
  const box = h('<section class="panel tr-card"></section>');
  main.append(box);
  let i = 0, right = 0;
  const play = (x, slow) => speakLang(x.t, X.lang, slow ? .5 : undefined);
  const show = () => {
    if (i >= items.length) {
      addXP(right * 4 + (items.length - right));
      box.innerHTML = `<h2>${T('听写完成', 'ディクテーション完了')}</h2><p>${T(`${items.length} 句里写对了 ${right} 句。`, `${items.length} 文中 ${right} 文正解でした。`)}</p>
        <div class="row"><button class="btn pri" type="button" data-more>${T('再来 10 句', 'もう 10 文', '10 more')}</button><a class="btn" href="${X.back}">${T('返回', '戻る', 'Back')}</a></div>`;
      box.querySelector('[data-more]').onclick = () => { main.innerHTML = ''; p2Setup(tr, 'dict'); };
      return;
    }
    const x = items[i];
    box.innerHTML = `<div class="row between small muted"><span>${i + 1} / ${items.length}</span><span class="tag lv">${x.L}</span></div>
      <div class="row dict-play"><button class="btn pri big" type="button" data-play>${SPEAK_SVG}<span>${T('播放', '再生', 'Play')}</span></button><button class="btn" type="button" data-slow>${T('慢速', 'ゆっくり', 'Slow')}</button></div>
      <textarea class="tr-input" rows="2" lang="${X.lang}" placeholder="${T('把听到的写下来', '聞こえたとおりに書いてみよう')}"></textarea>
      <div class="row"><button class="btn pri" type="button" data-check>${T('对答案', '答え合わせ', 'Check')}</button><button class="btn ghost" type="button" data-skip>${T('听不出来，看答案', '聞き取れない・答えを見る')}</button></div>
      <div class="tr-ans" hidden></div>`;
    const ta = box.querySelector('textarea');
    box.querySelector('[data-play]').onclick = () => play(x);
    box.querySelector('[data-slow]').onclick = () => play(x, true);
    audioPrime(); setTimeout(() => play(x), 300);   // 点击当下先解锁播放器（iPhone）
    const check = give => {
      const mine = ta.value.trim();
      let score = 0;
      if (!give && mine) {
        score = trSimilar(dictNorm(mine, tr), dictNorm(x.t, tr));
        if (x.py && /[a-z]/i.test(mine)) score = Math.max(score, trSimilar(p2Py(mine), p2Py(x.py)));
      }
      const ok = score >= 90;
      if (ok) right++;
      const ans = box.querySelector('.tr-ans');
      ans.hidden = false;
      ans.innerHTML = `<div class="${ok ? 'tag done' : 'tag'}">${give ? T('没关系，看看原文', '大丈夫、原文を確認しよう') : ok ? T(`写对了（${score}%）`, `正解（${score}%）`) : T(`相似度 ${score}%`, `一致度 ${score}%`)}</div>
        <div class="tr-ref" lang="${X.lang}">${X.tap(x.t)} ${sayBtn(x.t, X.lang)}</div>${x.py ? `<div class="zh-py">${esc(x.py)}</div>` : ''}
        <div class="small muted">${esc(x.n || '')}</div>
        <div class="row"><button class="btn pri" type="button" data-next>${T('下一句', '次へ', 'Next')}</button></div>`;
      box.querySelector('[data-check]').parentElement.remove();
      ans.querySelector('[data-next]').onclick = () => { i++; show(); };
    };
    box.querySelector('[data-check]').onclick = () => check(false);
    box.querySelector('[data-skip]').onclick = () => check(true);
    setTimeout(() => ta.focus(), 50);
  };
  show();
}

function p2Trans(tr, items) {
  const X = P2[tr], T = X.T, o = p2Opt(tr), toT = o.dir === 'n2t';
  main.innerHTML = '';
  const box = h('<section class="panel tr-card"></section>');
  main.append(box);
  const ag = new Set((S.p2again = S.p2again || {})[tr] || []);
  let i = 0, ok = 0;
  const show = () => {
    if (i >= items.length) {
      S.p2again[tr] = [...ag].slice(-200); addXP(ok * 4 + (items.length - ok)); save();
      box.innerHTML = `<h2>${T('练习完成', 'おつかれさまでした')}</h2><p>${T(`${items.length} 句里会了 ${ok} 句。`, `${items.length} 文中 ${ok} 文できました。`)}${ag.size ? T(` 不会的 ${ag.size} 句下次会优先出现。`, ` 「まだ」の ${ag.size} 文は次回優先して出てきます。`) : ''}</p>
        <div class="row"><button class="btn pri" type="button" data-more>${T('再来 10 句', 'もう 10 文', '10 more')}</button><a class="btn" href="${X.back}">${T('返回', '戻る', 'Back')}</a></div>`;
      box.querySelector('[data-more]').onclick = () => { main.innerHTML = ''; p2Setup(tr, 'trans'); };
      return;
    }
    const x = items[i];
    const q = toT ? `<div class="tr-q">${esc(x.n)}</div>` : `<div class="tr-q" lang="${X.lang}">${X.tap(x.t)} ${sayBtn(x.t, X.lang)}</div>`;
    const a = toT ? `<div class="tr-ref" lang="${X.lang}">${X.tap(x.t)} ${sayBtn(x.t, X.lang)}</div>${x.py ? `<div class="zh-py">${esc(x.py)}</div>` : ''}` : `<div class="tr-ref">${esc(x.n)}</div>`;
    box.innerHTML = `<div class="row between small muted"><span>${i + 1} / ${items.length}</span><span class="tag lv">${x.L}</span></div>
      <div class="eyebrow">${toT ? T(`翻译成${X.name === 'English' ? '英语' : X.name}`, `${X.name === 'English' ? '英語' : '中国語'}に訳してみよう`) : T('翻译成中文', '日本語に訳してみよう')}</div>${q}
      <textarea class="tr-input" rows="2" lang="${toT ? X.lang : ''}" placeholder="${T('写下你的译文（可以不写）', '訳を書いてみよう（書かなくても OK）')}"></textarea>
      <div class="row"><button class="btn pri" type="button" data-show>${T('看参考答案', '答えを見る', 'Show answer')}</button></div>
      <div class="tr-ans" hidden><div class="small muted">${T('参考答案', '答えの例')}</div>${a}
        <div class="row tr-grade"><button class="btn" type="button" data-g="0">${T('不会', 'まだ')}</button><button class="btn" type="button" data-g="1">${T('差一点', 'おしい')}</button><button class="btn pri" type="button" data-g="2">${T('会了', 'できた')}</button></div></div>`;
    box.querySelector('[data-show]').onclick = e => { e.target.parentElement.remove(); box.querySelector('.tr-ans').hidden = false; if (toT) speakLang(x.t, X.lang); };
    box.querySelectorAll('[data-g]').forEach(b => { b.onclick = () => {
      const g = +b.dataset.g;
      if (g === 2) { ok++; ag.delete(x.t); } else ag.add(x.t);
      i++; show();
    }; });
  };
  show();
}

/* 英语：字母和音标（数据 IPA 在 lang.js）。中日双语说明 */
const IPA_JA = { '拉长的「衣」': '長い「イー」', '短促的「衣」，嘴放松': '短い「イ」。口の力を抜く', '「哎」的前半': '「エ」に近い', '嘴张大的「哎」': '口を大きく開けた「エ」と「ア」の中間', '拉长的「啊」': '長い「アー」', '短促的「啊」': '短く弱い「ア」', '拉长的「哦」': '長い「オー」', '短「哦」（英式）': '短い「オ」（イギリス英語）', '短促的「乌」': '短い「ウ」', '拉长的「乌」': '唇を丸めた長い「ウー」', '卷舌的「饿」': '舌を巻いた「アー」', '轻读的「呃」': 'あいまいな弱い「ア」', '轻读并卷舌': '弱く、舌を巻く',
  '「诶」': '「エイ」', '「爱」': '「アイ」', '「奥一」': '「オイ」', '「凹」': '「アウ」', '「欧」': '「オウ」', '「衣」+卷舌': '「イ」＋舌を巻く', '「诶」+卷舌': '「エ」＋舌を巻く', '「乌」+卷舌': '「ウ」＋舌を巻く',
  '上齿轻咬下唇，声带振动': '上の歯を下唇に軽く当て、声を出す', '舌尖放在上下齿之间吹气': '舌先を上下の歯の間に置いて息を出す', '同 θ，声带振动': 'θ と同じ形で声を出す', '像「诗」': '「シュ」に近い', '像「吃」': '「チ」に近い', '像「知」': '「ヂ」に近い', '后鼻音 ng': '鼻に抜ける「ン」（ng）', '舌头卷起不碰上颚': '舌を巻き、上あごに付けない', '像「耶」的开头': '「イェ」の出だし' };
function enAbcPage() {
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const tip = t => t ? `<span class="small muted">${esc(enJa() ? IPA_JA[t] || t : t)}</span>` : '';
  const cell = ([sym, word, t]) => `<button type="button" class="hg-cell" data-lsay="${word}" data-lang="en-US"><b>${sym}</b><span class="small">${word}</span>${tip(t)}</button>`;
  const p = h(`<section class="panel"><div class="row between"><h2>${enNat('字母和音标', 'アルファベットと発音記号')}</h2><a class="small" href="#en/ri">${enNat('返回', '戻る')}</a></div>
    <p class="small muted">${enNat('点一下就能听发音。音标是美式发音（IPA），单词卡和词典里看到的就是这些符号。', 'タップすると発音が聞けます。発音記号はアメリカ英語（IPA）で、単語カードや辞書に出てくる記号です。')}</p>
    <h3>${enNat('字母', 'アルファベット')}</h3><div class="hg-grid">${ABC.map(c => `<button type="button" class="hg-cell" data-lsay="${c}" data-lang="en-US"><b>${c}${c.toLowerCase()}</b></button>`).join('')}</div>
    <h3>${enNat('元音', '母音')}</h3><div class="hg-grid">${IPA.vowels.map(cell).join('')}</div>
    <h3>${enNat('双元音', '二重母音')}</h3><div class="hg-grid">${IPA.diph.map(cell).join('')}</div>
    <h3>${enNat('辅音', '子音')}</h3><div class="hg-grid">${IPA.cons.map(cell).join('')}</div></section>`);
  main.append(enLangBar(), p);
}

/* ---------- 中文、英语的「考试目标」和「弱点分析」（日语的在 japlus.js） ---------- */
const P2_EXAM = { zh: { name: 'HSK', lvs: ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'] }, en: { name: 'CEFR', lvs: EN_LV } };
// 目标级别以下（含）的全部单词：还没学过的有多少，每天要学几个
function p2Plan(tr) {
  const g = (S.examL || {})[tr];
  if (!g || !g.L || !g.date) return Promise.resolve(null);
  const days = Math.ceil((new Date(g.date + 'T09:00:00') - Date.now()) / DAY);
  if (days < 0) return Promise.resolve({ g, days, over: true });
  const lvs = P2_EXAM[tr].lvs.slice(0, P2_EXAM[tr].lvs.indexOf(g.L) + 1);
  const load = tr === 'zh' ? Promise.all(lvs.map(L => zhHsk(+L.slice(3)).catch(() => []))) : Promise.all(lvs.map(L => enFetch(`en-${L}`).then(r => enItems(L, r)).catch(() => [])));
  return load.then(all => {
    const words = all.flat(), left = words.filter(x => !(S.srs[x.id] && S.srs[x.id].r > 0)).length;
    const studyDays = Math.max(1, days - 21), perDay = Math.ceil(left / studyDays);
    return { g, days, left, all: words.length, perDay, pace: (S.newPerDay || 10) >= perDay, sprint: days <= 30 };
  });
}
function p2ExamPanel(tr) {
  const T = (zh, ja) => tr === 'zh' ? ja : tj(zh, ja), X = P2_EXAM[tr], g = (S.examL || {})[tr] || {};
  let L = g.L || (tr === 'zh' ? zhLevel() : enLevel()), d = g.date || '';
  const p = h(`<section class="panel"><h2>${T('考试目标', '試験の目標')}</h2>
    <p class="muted">${T(`设定要考的级别和日期，这里会算出离考试还有几天、每天要学多少个新词（考前三周留给复习和模拟考）。`, `目標のレベルと日付を決めると、試験までの日数と 1 日に覚える新しい単語の数を計算します（最後の 3 週間は復習と模擬試験にあてる前提）。`)}</p>
    <div class="row between"><span>${T('目标级别', '目標レベル')}</span><div class="seg read-lv">${X.lvs.map(x => `<button type="button" data-el="${x}" class="${L === x ? 'on' : ''}">${x}</button>`).join('')}</div></div>
    <div class="row between"><span>${T('考试日期', '試験日')}</span><input type="date" class="lb-input" data-edate value="${esc(d)}" style="max-width:170px"></div>
    <div class="row"><button class="btn pri" type="button" data-esave>${T('保存', '保存')}</button>${g.L ? `<button class="btn ghost" type="button" data-eclear>${T('取消目标', '目標を取り消す')}</button>` : ''}</div>
    <div data-plan></div>
    <p class="small muted">${tr === 'zh' ? 'HSK の試験日は実施機関の発表を確認してください。' : T('CEFR 是能力等级，可以按目标考试（雅思、托福、英检等）的日期来设定。', 'CEFR は能力レベルです。目標の試験（英検・TOEIC・IELTS など）の日付で設定してください。')}</p></section>`);
  p.querySelectorAll('[data-el]').forEach(b => { b.onclick = () => { L = b.dataset.el; p.querySelectorAll('[data-el]').forEach(x => x.classList.toggle('on', x === b)); }; });
  p.querySelector('[data-edate]').onchange = e => { d = e.target.value; };
  p.querySelector('[data-esave]').onclick = () => { if (!d) return toast(T('请选择日期', '日付を選んでください')); (S.examL = S.examL || {})[tr] = { L, date: d }; save(); toast(T('已保存考试目标', '試験の目標を保存しました')); render(); };
  const c = p.querySelector('[data-eclear]'); if (c) c.onclick = () => { delete S.examL[tr]; save(); render(); };
  p2Plan(tr).then(x => {
    const box = p.querySelector('[data-plan]'); if (!x || !box) return;
    box.innerHTML = x.over ? `<p>${T('考完了，辛苦了！设定下一次的目标吧。', 'おつかれさまでした！次の目標を決めましょう。')}</p>`
      : `<div class="exam-card ${x.sprint ? 'sprint' : ''}"><span class="eyebrow">${esc(x.g.L)} · ${esc(x.g.date)}</span><div class="exam-days"><b>${x.days}</b> ${T('天', '日')}</div>
        <div class="bar"><i style="width:${Math.round((1 - x.left / Math.max(1, x.all)) * 100)}%"></i></div>
        <p class="small">${x.sprint ? T('离考试不到一个月：每天做模拟考、复习错题，新内容少学一点。', '試験まで 1 か月を切りました。毎日模擬試験と復習を中心に、新しい内容は少なめに。')
          : !x.left ? T('这些级别的单词都学过一遍了！接下来以复习和模拟考为主。', 'このレベルまでの単語はひととおり覚えました！これからは復習と模擬試験を中心に。')
          : T(`要在考前三周学完，每天需要 <b>${x.perDay}</b> 个新词。${x.pace ? '按现在的速度来得及 👍' : `现在每天 ${S.newPerDay || 10} 个，有点慢。`}`, `試験の 3 週間前までに覚えきるには、1 日 <b>${x.perDay}</b> 語のペースが必要です。${x.pace ? '今のペースで間に合います 👍' : `今は 1 日 ${S.newPerDay || 10} 語なので、少しペースを上げましょう。`}`)}</p>
        ${!x.sprint && !x.pace && x.left ? `<button class="btn soft" type="button" data-pace>${T(`把每天新词调到 ${Math.min(30, x.perDay)} 个`, `1 日の新しい単語を ${Math.min(30, x.perDay)} 語にする`)}</button>` : ''}</div>`;
    const b = box.querySelector('[data-pace]'); if (b) b.onclick = () => { S.newPerDay = Math.min(30, x.perDay); save(); render(); };
  });
  return p;
}
// 弱点分析：最近 30 天各类题的正确率（japlus.js 的 qstatSum，按语言分开统计）
const P2_KIND = { readc: ['阅读理解', '読解'], 'en-gram': ['语法', '文法'], meaning: ['词义', '意味'], word: ['选词', '単語選び'], grammar: ['语法', '文法'], listen: ['听力', 'リスニング'], e2vocab: ['模拟考 · 词汇', '模擬試験・語彙'], e2grammar: ['模拟考 · 语法', '模擬試験・文法'], e2reading: ['模拟考 · 阅读', '模擬試験・読解'], w2: ['每周精选小测', '今週の単語テスト'], tone: ['声调', '声調'] };
function p2WeakPanel(tr) {
  const T = (zh, ja) => tr === 'zh' ? ja : tj(zh, ja);
  const w7 = qstatSum(7, tr), w30 = qstatSum(30, tr);
  const rows = Object.keys(w30).map(k => { const [n, ok] = w30[k], [n7, ok7] = w7[k] || [0, 0]; return { k, n, pct: Math.round(ok / n * 100), p7: n7 ? Math.round(ok7 / n7 * 100) : null }; }).sort((a, b) => a.pct - b.pct);
  const name = k => P2_KIND[k] ? T(...P2_KIND[k]) : k;
  const due = Object.keys(S.srs).filter(id => id.startsWith(tr + '|') && S.srs[id].due <= Date.now()).length;
  return h(`<section class="panel"><h2>${T('各类题的正确率', '種類別の正答率')}</h2>
    ${rows.length ? `<p class="muted">${rows[0].pct < 70 ? T(`最近 30 天，「${name(rows[0].k)}」的正确率最低（${rows[0].pct}%），建议多练这一类。`, `直近 30 日では「${name(rows[0].k)}」の正答率がいちばん低め（${rows[0].pct}%）。この種類を重点的に練習しましょう。`) : T('最近 30 天各类题都不错，继续保持！', '直近 30 日はどの種類も好調です。この調子で！')}</p>
      <div class="weak-bars">${rows.map(r => `<div class="weak-row"><span>${esc(name(r.k))}</span><div class="bar ${r.pct < 60 ? 'low' : r.pct < 80 ? 'mid' : ''}"><i style="width:${r.pct}%"></i></div><b>${r.pct}%</b><span class="small muted">${r.p7 != null ? T(`近 7 天 ${r.p7}%`, `7 日 ${r.p7}%`) : ''}</span></div>`).join('')}</div>`
      : `<p class="muted">${T('做几次测验、闯关以后，这里会显示各类题的正确率。', 'クイズやステージをいくつか解くと、種類ごとの正答率がここに表示されます。')}</p>`}
    <p class="small muted">${T('答错的单词会自动加入复习卡。', '間違えた単語は自動で復習カードに入ります。')}${due ? T(` 现在有 ${due} 张卡片到了复习时间，<a href="#${tr}">去今天的任务 ›</a>`, ` いま復習するカードが ${due} 枚あります。<a href="#${tr}">今日のタスクへ ›</a>`) : ''}</p></section>`);
}
