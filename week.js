/* 每周精选：每周一（本地时间）换新的一期，最近 4 期可以在「往期」里看，更早的自动下架，还没到日期的不显示。
   单词和会话在 weekly.js（tools/build_weekly.py 生成），阅读和听力在 reading.js / listening.js 里带 wk（那一期的周一）。
   内容是提前写好的 52 期（tools/weekly/CALENDAR.md），不需要服务器。 */
const WK_KEEP = 4, WK_START = '2026-11-02', WK_TOTAL = 52;
const wkMonday = (d = new Date()) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
const wkAdd = (wk, days) => { const [y, m, d] = wk.split('-').map(Number); return dkey(new Date(y, m - 1, d + days)); };
const wkShown = () => { const m = dkey(wkMonday()); return Array.from({ length: WK_KEEP }, (_, i) => wkAdd(m, -7 * i)); };
const wkVisible = wk => wkShown().includes(wk);
// 本周是第几期（还没开始或已经写完的话是 0）
const wkNo = () => { const [y, m, d] = WK_START.split('-').map(Number); const n = Math.round((wkMonday() - new Date(y, m - 1, d)) / 6048e5) + 1; return n >= 1 && n <= WK_TOTAL ? n : 0; };
const wkRange = wk => { const [, m, d] = wk.split('-').map(Number), e = wkAdd(wk, 6).split('-').map(Number); return `${m}/${d}–${e[1]}/${e[2]}`; };

// 每期的打卡：读完 3 篇、做完 3 段听力、单词小测 8 分以上、5 句会话都听过 → 盖「本期完成」的章，+30 经验（每期一次）
const wkState = wk => { S.wk = S.wk || {}; return S.wk[wk] || (S.wk[wk] = { l: {}, t: {}, q: 0 }); };
function wkSteps(x) {
  const st = wkState(x.wk), arts = (typeof READING === 'undefined' ? [] : READING).filter(a => a.wk === x.wk);
  const lsN = Object.values(typeof LISTEN === 'undefined' ? {} : LISTEN).flat().filter(q => q.wk === x.wk).length;
  return [
    ['阅读', arts.filter(a => (S.read || {})[a.id]).length, arts.length],
    ['听力', Object.keys(st.l).length, lsN],
    ['单词小测', st.q >= wkPass(x) ? 1 : 0, 1, st.q ? `最好 ${st.q}/${x.w.length}` : ''],
    ['会话', Object.keys(st.t).length, x.k.length],
  ];
}
const wkPass = x => Math.ceil(x.w.length * .8);   // 单词小测过关线（免费 3 个词就是全对）
// 会员内容（不在公开数据里）：整页最后一张轻松的预告卡，不在每个板块里逐条标「会员专享」
function wkMore(x) {
  const l = x.lock;
  if (!l) return null;
  const bits = [l.a.length && `更多阅读${l.a.map(a => `《<span lang="ja">${esc(a[1])}</span>》`).join('')}`,
    l.w && '更多单词', l.l && '更多听力', l.k && '更多会话'].filter(Boolean);
  if (!bits.length) return null;
  const c = h(`<section class="panel wk-more" role="button" tabindex="0"><div class="wk-more-t">✨ 本期还有更多好玩有趣的内容</div>
    <div class="small">${bits.join('、')}</div><div class="wk-more-go">加入会员即可获取 ›</div></section>`);
  c.onclick = () => { location.hash = '#vip'; };   // 会员页（vip.js）
  return c;
}
function wkCheckDone(x) {
  const st = wkState(x.wk);
  if (st.done || !wkSteps(x).every(([, a, b]) => b && a >= b)) return false;
  st.done = 1; addXP(30); save();
  if (typeof celebrate === 'function') celebrate();
  toast(`第 ${x.no} 期全部完成！+30 经验，盖个章🐾`);
  return true;
}

function weekCard() {
  const n = wkNo();
  if (!n) return null;
  const x = typeof WEEKLY !== 'undefined' && WEEKLY.find(w => w.no === n);
  return h(`<a class="week-card" href="#week"><span class="wc-ic" aria-hidden="true">週</span><div><div class="row" style="gap:6px"><b>本周精选</b><span class="tag done">第 ${n} 期</span></div>
    <div class="small muted">${x ? `<span lang="ja">${esc(x.t)}</span> · ` : ''}阅读、单词、听力、会话，每周一更新</div></div><span class="wc-go" aria-hidden="true">›</span></a>`);
}

function viewWeek(arg) {
  const box = h('<section class="panel"><h2>本周精选</h2><div class="skel" aria-label="加载中" role="status"><i></i><i></i><i></i></div></section>');
  main.append(box);
  const at = location.hash;
  // listening.js 可能已经被听力页用自己的方式加载过，再加载会重复定义，所以先看 LISTEN 在不在
  const files = ['weekly.js', 'reading.js', 'scenes.js'].concat(typeof LISTEN === 'undefined' ? ['listening.js', 'furi-listen.js'] : []);
  needScripts(files).then(() => { audioIdx('reading'); if (location.hash === at) box.replaceWith(weekPage(arg)); })
    .catch(() => { box.innerHTML = '<h2>本周精选</h2><p class="muted">加载失败，请检查网络后重试。</p>'; });
}

function weekPage(arg) {
  const shown = wkShown(), list = WEEKLY.filter(x => shown.includes(x.wk)).sort((a, b) => b.wk.localeCompare(a.wk));
  const p = h('<div class="week"></div>');
  if (!list.length) { p.append(h('<section class="panel"><h2>本周精选</h2><p class="muted">本周精选还没开始，敬请期待。</p></section>')); return p; }
  const x = list.find(w => String(w.no) === arg) || list[0], cur = x === list[0];
  const arts = READING.filter(a => a.wk === x.wk).sort((a, b) => a.id.localeCompare(b.id));
  const ls = Object.values(typeof LISTEN === 'undefined' ? {} : LISTEN).flat().filter(q => q.wk === x.wk)
    .map(q => ({ ...q, L: Object.keys(LISTEN).find(L => LISTEN[L].includes(q)) })).sort((a, b) => b.L.localeCompare(a.L));
  const vocabOf = w => wordIndex().get(w);
  p.append(h(`<section class="panel wk-head">
    <div class="row between"><h2>${cur ? '本周精选' : '往期精选'}</h2><span class="small muted">第 ${x.no} 期 · ${wkRange(x.wk)}</span></div>
    <div class="wk-theme furi" lang="ja">${jr(x.t)}</div><div class="muted">${esc(x.tz)}</div>
    ${list.length > 1 ? `<div class="wk-past"><span class="small muted">${cur ? '往期' : '其他几期'}</span>${list.filter(w => w !== x).map(w => `<a class="chip-btn" href="#week/${w.no}">${w === list[0] ? '本周' : `第 ${w.no} 期`} · <span lang="ja">${esc(w.t)}</span></a>`).join('')}</div>` : ''}
    <p class="small muted">每周一更新一期，保留最近 ${WK_KEEP} 期。</p>
  </section>`));
  const prog = h('<section class="panel wk-prog"></section>');
  const paintProg = () => {
    const st = wkState(x.wk), steps = wkSteps(x);
    prog.innerHTML = `<div class="row between"><h3>本期打卡</h3>${st.done ? '<span class="wk-stamp" title="本期完成">完成<small>第 ' + x.no + ' 期</small></span>' : '<span class="small muted">四项都完成就盖章 +30 经验</span>'}</div>
      <div class="wk-steps">${steps.map(([n, a, b, sub]) => `<div class="wk-step ${b && a >= b ? 'ok' : ''}"><b>${b && a >= b ? '✓' : n === '单词小测' ? '–' : `${Math.min(a, b)}/${b}`}</b><span>${n}</span>${sub ? `<small>${sub}</small>` : ''}</div>`).join('')}</div>`;
  };
  wkCheckDone(x); paintProg(); p.append(prog);
  const tick = () => { wkCheckDone(x); paintProg(); };
  if (arts.length) p.append(h(`<section class="panel"><h3>本周阅读</h3><div class="wk-arts">${arts.map(a => `<a class="today-art" href="#read/${esc(a.id)}"><div class="ta-img">${artImg(a)}</div><div><span class="tag lv">${a.L}</span> <span class="tag">${esc(a.cat)}</span>${(S.read || {})[a.id] ? ' <span class="tag done">已读</span>' : ''}<div class="rc-title furi" lang="ja">${jr(a.title)}</div><div class="small muted">${esc(a.zh)}</div></div></a>`).join('')}</div></section>`));
  // 本周的读物和自己的级别不一样：再按自己的级别推荐一篇（每周换一篇，没读过的优先）
  if (!arts.some(a => a.L === S.level)) {
    const pool = READING.filter(a => a.L === S.level && !a.lock && a.p && !a.wk && (!a.date || a.date <= dkey()));
    const fresh = pool.filter(a => !(S.read || {})[a.id]), a = (fresh.length ? fresh : pool)[x.no % Math.max(1, (fresh.length ? fresh : pool).length)];
    if (a) p.append(h(`<section class="panel"><h3>适合你的级别（${S.level}）</h3><div class="wk-arts"><a class="today-art" href="#read/${esc(a.id)}"><div class="ta-img">${artImg(a)}</div><div><span class="tag lv">${a.L}</span> <span class="tag">${esc(a.cat)}</span>${(S.read || {})[a.id] ? ' <span class="tag done">已读</span>' : ''}<div class="rc-title furi" lang="ja">${jr(a.title)}</div><div class="small muted">${esc(a.zh)}</div></div></a></div></section>`));
  }
  const wsec = h(`<section class="panel"><div class="row between"><h3>本周单词</h3><button type="button" class="btn small" data-addall>能加的都加入单词卡</button></div>
    <div class="wk-words">${x.w.map(([w, r, lv, zh, ex, exk, exzh, exf]) => { const v = vocabOf(w); return `<div class="wk-word">
      <div class="wk-wt"><span lang="ja" class="rw-w furi">${jrWord(w, r)}</span>${r !== w ? `<span lang="ja" class="rw-r">${esc(r)}</span>` : ''}${speakBtn(r)}<span class="tag lv">${esc(lv)}</span><span class="sp"></span>
      ${v && v.q ? `<button type="button" class="chip-btn" data-add="${esc(v.id)}">${S.srs[v.id] ? '已在单词卡' : '+ 单词卡'}</button>` : favBtn('w', w, `${r} ${zh}`, 'ja')}</div>
      <div class="rw-m">${esc(zh)}</div>
      <div class="wk-ex"><span class="furi jtap" lang="ja">${jaTapHTML(ex, exf)}</span>${speakBtn(exk, '朗读例句')}<div class="small muted">${esc(exzh)}</div></div></div>`; }).join('')}</div></section>`);
  const add = b => { const id = b.dataset.add; if (S.srs[id]) return 0; S.srs[id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; b.textContent = '已在单词卡'; return 1; };
  wsec.querySelectorAll('[data-add]').forEach(b => { b.onclick = () => { if (add(b)) { save(); toast('已加入单词卡，今天就会出现'); } }; });
  wsec.querySelector('[data-addall]').onclick = () => { let n = 0; wsec.querySelectorAll('[data-add]').forEach(b => { n += add(b); }); save(); toast(n ? `${n} 个词加入了单词卡` : '能加的词都已经在单词卡里了（不在词库里的词可以点 ☆ 收藏）'); };
  p.append(wsec);
  if (ls.length) {
    const lsec = h(`<section class="panel"><h3>本周听力</h3><p class="small muted">和考试一样先听再答，答完看原文、翻译和解说。</p>
      <div class="wk-ls">${ls.map((q, i) => `<button type="button" class="wk-l" data-l="${i}"><span class="tag lv">${q.L}</span><span class="wk-lt"><b>${esc(LTYPE[q.t] ? LTYPE[q.t][0] : '听力')}</b><span class="small muted furi" lang="ja">${jr(q.intro || q.q || '')}</span></span><span class="wc-go" aria-hidden="true">▶</span></button>`).join('')}</div></section>`);
    lsec.querySelectorAll('[data-l]').forEach(b => { const q = ls[+b.dataset.l]; const go = () => { wkState(x.wk).l[q.id] = 1; save(); runListen([q], q.L, { title: `本周听力 · ${q.L}`, again: go }); }; b.onclick = go; });
    p.append(lsec);
  }
  const qz = h(`<section class="panel wk-quiz"><div class="row between"><h3>单词小测</h3><button type="button" class="btn pri small" data-qs>开始 ${x.w.length} 题</button></div><p class="small muted">看日语选中文意思，${wkPass(x) >= x.w.length ? '全部答对' : `${wkPass(x)} 题以上答对`}算过关。</p><div data-qb></div></section>`);
  qz.querySelector('[data-qs]').onclick = () => wkQuiz(x, qz.querySelector('[data-qb]'), score => { const st = wkState(x.wk); st.q = Math.max(st.q, score); save(); tick(); });
  p.append(qz);
  p.append(h(`<section class="panel"><h3>本周会话</h3><div class="wk-talk">${x.k.map(([jp, kana, zh, note, f]) => `<div class="wk-t">
    <div class="ex"><div style="flex:1;min-width:0"><div class="jp furi jtap" lang="ja">${jaTapHTML(jp, f)}</div><div class="small muted">${esc(zh)}</div></div><button class="speak" type="button" data-wks="${esc(kana)}" aria-label="朗读">${SPEAK_SVG}</button>${typeof shadowBtn === 'function' ? shadowBtn(jp, kana, zh) : ''}${favBtn('s', jp, zh, 'ja', f)}</div>
    <div class="small wk-note">${jrNote(note)}</div></div>`).join('')}</div></section>`));
  const talk = p.lastElementChild;
  talk.querySelectorAll('.wk-t').forEach((el, i) => { const b = el.querySelector('[data-wks]'); b.onclick = () => { speak(b.dataset.wks); wkState(x.wk).t[i] = 1; save(); tick(); }; });
  const more = wkMore(x); if (more) p.append(more);
  return p;
}

// 单词小测：本期的单词，看日语选中文（干扰项来自各期的单词）
function wkQuiz(x, box, done) {
  const qs = sample(x.w, x.w.length);
  let i = 0, right = 0;
  const show = () => {
    if (i >= qs.length) {
      box.innerHTML = `<div class="wk-qend"><b>${right} / ${qs.length}</b> ${right >= wkPass(x) ? '过关！' : '再来一次吧'}</div>`;
      if (right) addXP(right);
      return done(right);
    }
    const [w, r, , zh] = qs[i];
    const pool = [...new Set(WEEKLY.flatMap(y => y.w.map(o => o[3])))].filter(m => m !== zh);   // 干扰项：所有期的免费单词
    const opts = sample([zh, ...sample(pool, 3)], 4);
    box.innerHTML = `<div class="wk-q"><div class="small muted">${i + 1} / ${qs.length}</div><div class="wk-qw furi" lang="ja">${jrWord(w, r)}</div>${speakBtn(r)}
      <div class="wk-qo">${opts.map(o => `<button type="button" class="btn" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>`;
    box.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => {
      const ok = b.dataset.o === zh;
      if (ok) right++;
      box.querySelectorAll('[data-o]').forEach(o => { o.disabled = true; if (o.dataset.o === zh) o.classList.add('pri'); });
      if (!ok) b.classList.add('wrong');
      if (typeof buzz === 'function') buzz(ok ? 10 : [30, 40, 30]);
      setTimeout(() => { i++; show(); }, ok ? 600 : 1300);
    }; });
  };
  show();
}
