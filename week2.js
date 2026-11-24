'use strict';
// 中文、英语的「每周精选」（日语的在 week.js）。和日语一样：每周一换新的一期，最近 4 期可以回看，还没到日期的不显示。
// 每期：主题、本周阅读、本周听力（从现有的阅读、听力里按主题挑）、本周单词 8 个（各级词表里的词）、本周会话 5 句（原创）、单词小测。
// 四项都完成盖「本期完成」章 +30 经验。数据：lang/zh-weekly.json、lang/en-weekly.json（tools/build_week2.py 生成）。
const W2 = {};
const w2Load = tr => W2[tr] || (W2[tr] = fetch(`lang/${tr}-weekly.json`).then(r => r.ok ? r.json() : []).then(d => (tr === 'zh' && typeof enApply === 'function' ? enApply('zh', 'zh-weekly.json', 'zhweekly', d) : d)).catch(() => { delete W2[tr]; return []; }));
const w2T = (tr, zh, ja, en) => tr === 'zh' ? ja : en || enNat(zh, ja);   // 英语：标题、按钮用英语
const w2State = (tr, wk) => { const a = ((S.wk2 = S.wk2 || {})[tr] = S.wk2[tr] || {}); return a[wk] || (a[wk] = { t: {}, q: 0 }); };
const w2Cur = list => { const shown = wkShown(); return list.filter(x => shown.includes(x.wk)).sort((a, b) => b.wk.localeCompare(a.wk)); };

// 首页的小卡片（和日语首页的「本周精选」一样）
function w2Card(tr) {
  const el = h('<div></div>');
  w2Load(tr).then(list => {
    const x = w2Cur(list)[0];
    if (!x || !el.isConnected) return el.remove();
    el.replaceWith(h(`<a class="week-card" href="#${tr}/week"><span class="wc-ic" aria-hidden="true">週</span><div><div class="row" style="gap:6px"><b>${w2T(tr, '本周精选', '今週のピックアップ', 'Weekly picks')}</b><span class="tag done">${w2T(tr, `第 ${x.no} 期`, `第 ${x.no} 号`)}</span></div>
      <div class="small muted"><span lang="${tr === 'zh' ? 'zh-CN' : 'en'}">${esc(x.t)}</span> · ${w2T(tr, '阅读、单词、听力、会话，每周一更新', '読み物・単語・リスニング・会話、毎週月曜更新')}</div></div><span class="wc-go" aria-hidden="true">›</span></a>`));
  });
  return el;
}

// 单词：中文从 HSK 词表、英语从 CEFR 词表找到完整信息（读音、意思、例句）
function w2Words(tr, w) {
  if (tr === 'zh') return Promise.all([...new Set(w.map(([L]) => +L.slice(3)))].map(n => zhHsk(n).catch(() => []))).then(all => {
    const m = new Map(all.flat().map(x => [x.L + '|' + x.w, x]));
    return w.map(([L, word]) => { const x = m.get(+L.slice(3) + '|' + word); return x && { id: x.id, w: x.w, r: x.py, m: x.ja, ex: x.ex, exr: x.expy, exm: x.exja, L }; }).filter(Boolean);
  });
  return Promise.all([...new Set(w.map(([L]) => L))].map(L => enFetch(`en-${L}`).then(rows => enItems(L, rows)).catch(() => []))).then(all => {
    const m = new Map(all.flat().map(x => [x.lv + '|' + x.w, x]));
    return w.map(([L, word]) => { const x = m.get(L + '|' + word); return x && { id: x.id, w: x.w, r: x.ipa, m: enNat(x.zh, x.ja), ex: x.ex, exm: enNat(x.exzh, x.exja), L }; }).filter(Boolean);
  });
}
// 阅读、听力：按 id 找到原文
function w2Items(tr, x) {
  if (tr === 'zh') return Promise.all([zhRead(), zhListen()]).then(([rs, ls]) => [x.r.map(id => rs.find(a => a.id === id)).filter(Boolean), x.l.map(id => ls.find(q => q.id === id)).filter(Boolean)]);
  const lvOf = id => id.split('-')[1];
  const get = (kind, ids) => Promise.all(ids.map(id => enFetch(`en-${kind}-${lvOf(id)}`).then(a => a.find(y => y.id === id)).catch(() => null))).then(a => a.filter(Boolean));
  return Promise.all([get('r', x.r), get('l', x.l)]);
}

function w2Page(tr, arg) {
  const T = (zh, ja, en) => w2T(tr, zh, ja, en), lang = tr === 'zh' ? 'zh-CN' : 'en', tts = tr === 'zh' ? 'zh-CN' : 'en-US';
  const box = h(`<section class="panel"><h2>${T('本周精选', '今週のピックアップ', 'Weekly picks')}</h2><div class="skel" role="status"><i></i><i></i><i></i></div></section>`);
  main.append(box);
  if (tr === 'en') box.before(enLangBar());
  w2Load(tr).then(all => {
    if (!box.isConnected) return;
    const list = w2Cur(all);
    if (!list.length) { box.innerHTML = `<h2>${T('本周精选', '今週のピックアップ', 'Weekly picks')}</h2><p class="muted">${T('本周精选还没开始，敬请期待。', 'まもなくスタートします。お楽しみに。')}</p>`; return; }
    const x = list.find(w => String(w.no) === arg) || list[0], cur = x === list[0];
    return Promise.all([w2Words(tr, x.w), w2Items(tr, x)]).then(([words, [arts, ls]]) => {
      // 读物按离自己级别的远近排：最合适的排在前面，并标出来
      const LVS = tr === 'zh' ? ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'] : ['A1', 'A2', 'B1', 'B2', 'C1'];
      const artLv = a => LVS.indexOf(tr === 'zh' ? a.lv : a.id.split('-')[1]), myLv = Math.max(0, LVS.indexOf(tr === 'zh' ? zhLevel() : enLevel()));
      arts = arts.slice().sort((a, b) => Math.abs(artLv(a) - myLv) - Math.abs(artLv(b) - myLv));
      const fit = arts.length > 1 && Math.abs(artLv(arts[0]) - myLv) < Math.abs(artLv(arts[1]) - myLv) ? arts[0] : null;
      const fitTag = a => a === fit ? ` <span class="tag done">${T('适合你的级别', 'あなたのレベル向け', 'Your level')}</span>` : '';
      if (!box.isConnected) return;
      const st = w2State(tr, x.wk);
      const readDone = a => tr === 'zh' ? !!(S.zhRead || {})[a.id] : !!(S.enRead && a.id in S.enRead);
      const lsDone = q => tr === 'zh' ? !!(S.zhLs || {})[q.id] : !!(S.enListen && q.id in S.enListen);
      const pass = Math.ceil(words.length * .8);
      const steps = () => [[T('阅读', '読み物', 'Reading'), arts.filter(readDone).length, arts.length], [T('听力', 'リスニング', 'Listening'), ls.filter(lsDone).length, ls.length],
        [T('单词小测', '単語テスト', 'Word quiz'), st.q >= pass ? 1 : 0, 1, 'q'], [T('会话', '会話', 'Phrases'), Object.keys(st.t).length, x.k.length]];
      const check = () => { if (!st.done && steps().every(([, a, b]) => !b || a >= b)) { st.done = 1; addXP(30); save(); if (typeof celebrate === 'function') celebrate(); toast(T(`第 ${x.no} 期全部完成！+30 经验`, `第 ${x.no} 号コンプリート！+30 XP`)); } };
      check();
      const p = h('<div class="week"></div>');
      p.append(h(`<section class="panel wk-head">
        <div class="row between"><h2>${cur ? T('本周精选', '今週のピックアップ', 'Weekly picks') : T('往期精选', 'バックナンバー', 'Past issue')}</h2><span class="small muted">${T(`第 ${x.no} 期`, `第 ${x.no} 号`)} · ${wkRange(x.wk)}</span></div>
        <div class="wk-theme" lang="${lang}">${esc(x.t)}</div><div class="muted">${esc(tr === 'zh' ? x.tj : enNat(x.tz, x.tj))}</div>
        ${list.length > 1 ? `<div class="wk-past"><span class="small muted">${cur ? T('往期', 'バックナンバー') : T('其他几期', 'ほかの号')}</span>${list.filter(w => w !== x).map(w => `<a class="chip-btn" href="#${tr}/week/${w.no}">${w === list[0] ? T('本周', '今週') : T(`第 ${w.no} 期`, `第 ${w.no} 号`)} · <span lang="${lang}">${esc(w.t)}</span></a>`).join('')}</div>` : ''}
        <p class="small muted">${T('每周一更新一期，可以回看最近几期。', '毎週月曜日に新しい号が届きます。最近の号はさかのぼって読めます。')}</p></section>`));
      const prog = h('<section class="panel wk-prog"></section>');
      const paint = () => { prog.innerHTML = `<div class="row between"><h3>${T('本期打卡', '今号のチェック', 'This week\'s checklist')}</h3>${st.done ? `<span class="wk-stamp">${T('完成', '完了')}<small>${T(`第 ${x.no} 期`, `第 ${x.no} 号`)}</small></span>` : `<span class="small muted">${T('四项都完成就盖章 +30 经验', '4 つすべて終えるとスタンプ +30 XP')}</span>`}</div>
        <div class="wk-steps">${steps().map(([n, a, b, q]) => `<div class="wk-step ${!b || a >= b ? 'ok' : ''}"><b>${!b || a >= b ? '✓' : q ? '–' : `${Math.min(a, b)}/${b}`}</b><span>${n}</span></div>`).join('')}</div>`; };
      const tick = () => { check(); paint(); };
      paint(); p.append(prog);
      // 阅读
      if (arts.length) p.append(h(`<section class="panel"><h3>${T('本周阅读', '今週の読み物', 'Reading')}</h3><div class="wk-arts">${arts.map(a => tr === 'zh'
        ? `<a class="today-art ${a.ph ? '' : 'no-img'}" href="#zh/read/${esc(a.id)}">${a.ph ? `<div class="ta-img">${zhArtImg(a)}</div>` : ''}<div><span class="tag lv">${esc(a.lv)}</span>${fitTag(a)}${readDone(a) ? ` <span class="tag done">読了</span>` : ''}<div class="rc-title" lang="zh-CN">${esc(a.title)}</div><div class="small muted">${esc(a.title_ja || '')}</div></div></a>`
        : `<a class="today-art" href="#en/read/${esc(a.id)}"><div class="ta-img">${enArtImg(a)}</div><div><span class="tag lv">${esc(a.id.split('-')[1])}</span>${fitTag(a)}${readDone(a) ? ` <span class="tag done">${T('已读', '読了')}</span>` : ''}<div class="rc-title" lang="en">${esc(a.title)}</div><div class="small muted">${esc(enNat(a.title_zh, a.title_ja))}</div></div></a>`).join('')}</div></section>`));
      // 这一期的读物都不是自己的级别：按自己的级别再推荐一篇（每期换一篇）
      if (!arts.some(a => artLv(a) === myLv)) {
        (tr === 'zh' ? zhRead() : enFetch(`en-r-${LVS[myLv]}`)).then(all => {
          const pool = all.filter(a => a.p && !a.lock && artLv(a) === myLv && !arts.includes(a)), fresh = pool.filter(a => !readDone(a)), from = fresh.length ? fresh : pool, a = from[x.no % Math.max(1, from.length)];
          if (!a || !p.isConnected) return;
          const el = h(`<section class="panel"><h3>${T('适合你的级别', 'あなたのレベル向け', 'For your level')}（${LVS[myLv]}）</h3><div class="wk-arts">${tr === 'zh'
            ? `<a class="today-art ${a.ph ? '' : 'no-img'}" href="#zh/read/${esc(a.id)}">${a.ph ? `<div class="ta-img">${zhArtImg(a)}</div>` : ''}<div><span class="tag lv">${esc(a.lv)}</span><div class="rc-title" lang="zh-CN">${esc(a.title)}</div><div class="small muted">${esc(a.title_ja || '')}</div></div></a>`
            : `<a class="today-art" href="#en/read/${esc(a.id)}"><div class="ta-img">${enArtImg(a)}</div><div><span class="tag lv">${esc(LVS[myLv])}</span><div class="rc-title" lang="en">${esc(a.title)}</div><div class="small muted">${esc(enNat(a.title_zh, a.title_ja))}</div></div></a>`}</div></section>`);
          const after = [...p.querySelectorAll('.wk-arts')].pop(); (after ? after.closest('section') : prog).after(el);
        }).catch(() => {});
      }
      // 单词
      const wsec = h(`<section class="panel"><div class="row between"><h3>${T('本周单词', '今週の単語', 'Words')}</h3><button type="button" class="btn small" data-addall>${T('全部加入单词卡', 'まとめて単語カードに追加', 'Add all to cards')}</button></div>
        <div class="wk-words">${words.map(v => `<div class="wk-word">
          <div class="wk-wt"><span lang="${lang}" class="rw-w">${esc(v.w)}</span><span class="rw-r">${esc(v.r || '')}</span>${sayBtn(v.w, tts)}<span class="tag lv">${esc(v.L)}</span><span class="sp"></span>
          <button type="button" class="chip-btn" data-add="${esc(v.id)}">${S.srs[v.id] ? T('已在单词卡', 'カードに追加済み') : T('+ 单词卡', '+ 単語カード')}</button></div>
          <div class="rw-m">${esc(v.m || '')}</div>
          ${v.ex ? `<div class="wk-ex"><span lang="${lang}">${tr === 'zh' ? zhTap(v.ex) : enTap(v.ex)}</span>${exSayBtn(v.ex, tts)}${v.exr ? `<div class="zh-py small">${esc(v.exr)}</div>` : ''}<div class="small muted">${esc(v.exm || '')}</div></div>` : ''}</div>`).join('')}</div></section>`);
      const add = b => { const id = b.dataset.add; if (S.srs[id]) return 0; S.srs[id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; b.textContent = T('已在单词卡', 'カードに追加済み'); return 1; };
      wsec.querySelectorAll('[data-add]').forEach(b => { b.onclick = () => { if (add(b)) { save(); toast(T('已加入单词卡，今天就会出现', '単語カードに追加しました。今日の復習に出てきます')); } }; });
      wsec.querySelector('[data-addall]').onclick = () => { let n = 0; wsec.querySelectorAll('[data-add]').forEach(b => { n += add(b); }); save(); toast(n ? T('已全部加入单词卡', 'まとめて追加しました') : T('这些词都已经在单词卡里了', 'すべて追加済みです')); };
      p.append(wsec);
      // 听力
      if (ls.length) {
        const lsec = h(`<section class="panel"><h3>${T('本周听力', '今週のリスニング', 'Listening')}</h3><p class="small muted">${T('先听再答，答完看原文、翻译和解说。', '聞いて答えたあと、原文・訳・解説を確認できます。')}</p>
          <div class="wk-ls">${ls.map((q, i) => `<button type="button" class="wk-l" data-l="${i}"><span class="tag lv">${esc(q.lv || q.id.split('-')[1])}</span><span class="wk-lt"><b>${esc(tr === 'zh' ? q.t || 'リスニング' : 'Listening')}</b><span class="small muted" lang="${tr === 'zh' ? 'ja' : 'en'}">${esc(tr === 'zh' ? q.q : q.intro)}</span></span>${lsDone(q) ? `<span class="tag done">✓</span>` : '<span class="wc-go" aria-hidden="true">▶</span>'}</button>`).join('')}</div></section>`);
        lsec.querySelectorAll('[data-l]').forEach(b => { b.onclick = () => { const q = ls[+b.dataset.l]; if (tr === 'zh') zhListenRun([q], `zh/week/${x.no}`); else enRunListen([q], T('本周听力', '今週のリスニング', 'Listening'), () => [q]); }; });
        p.append(lsec);
      }
      // 单词小测：看单词选意思（干扰项来自各期的单词）
      if (words.length >= 4) {
        const qz = h(`<section class="panel wk-quiz"><div class="row between"><h3>${T('单词小测', '単語テスト', 'Word quiz')}</h3><button type="button" class="btn pri small" data-qs>${T('开始', 'スタート', 'Start')}</button></div>
          <p class="small muted">${T(`看单词选意思，答对 ${pass} 题以上算过关。`, `単語を見て意味を選びます。${pass} 問以上正解で合格。`)}${st.q ? T(` 最好成绩 ${st.q}/${words.length}`, ` ベスト ${st.q}/${words.length}`) : ''}</p></section>`);
        qz.querySelector('[data-qs]').onclick = () => {
          const ms = [...new Set(words.map(v => v.m))];
          const qs = shuffle(words.slice()).map(v => makeQ(null, 'w2', sample(ms.filter(m => m !== v.m), 3), v.m, { prompt: `<div class="eyebrow">${T('选出意思', '意味を選ぼう')}</div><div class="q-big" lang="${lang}">${esc(v.w)}</div><div class="small muted">${esc(v.r || '')}</div>`, say: v.w, sayLang: tts }));
          main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
          runQuiz(host, qs, { title: T('单词小测', '単語テスト', 'Word quiz'), noRecord: true, xpEach: 2, onDone: r => { if (r) { st.q = Math.max(st.q, r.score); save(); } location.hash = `#${tr}/week/${x.no}`; render(); } });
        };
        p.append(qz);
      }
      // 会话
      const talk = h(`<section class="panel"><h3>${T('本周会话', '今週の会話', 'Phrases')}</h3><div class="wk-talk">${x.k.map((k, i) => {
        const [s, r, m, note] = tr === 'zh' ? [k[0], k[1], k[2], k[3]] : [k[0], '', enNat(k[1], k[2]), enNat(k[3], k[4])];
        return `<div class="wk-t"><div class="ex"><div style="flex:1;min-width:0"><div lang="${lang}">${tr === 'zh' ? zhTap(s) : enTap(s)}</div>${r ? `<div class="zh-py small">${esc(r)}</div>` : ''}<div class="small muted">${esc(m)}</div></div>
          <button class="speak" type="button" data-wks="${i}" aria-label="${T('朗读', '読み上げ')}">${SPEAK_SVG}</button>${typeof shadowBtn === 'function' ? shadowBtn(s, r || s, m, tr) : ''}</div>
          <div class="small wk-note">${esc(note || '')}</div></div>`; }).join('')}</div></section>`);
      talk.querySelectorAll('[data-wks]').forEach(b => { b.onclick = () => { const i = +b.dataset.wks; speakLang(x.k[i][0], tts); st.t[i] = 1; save(); tick(); }; });
      p.append(talk);
      box.replaceWith(p);
    });
  }).catch(() => { if (box.isConnected) box.innerHTML = `<h2>${T('本周精选', '今週のピックアップ', 'Weekly picks')}</h2><p class="muted">${T('读取失败，请检查网络后再试。', '読み込めませんでした。通信状況を確認してください。')}</p>`; });
}
