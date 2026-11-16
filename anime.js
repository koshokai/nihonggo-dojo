// 动漫·日剧名台词：每部作品几句广为流传的台词，配读音、中文、语法说明、生词和一段原创的生活小对话。
// 数据由 tools/build_anime.py 生成（内容规范见 tools/anime/SPEC.md），放在服务器上：
// 全部作品是日语会员内容（member_content 的 lang/ja-anime.json）；其他人看「本周精选」7 部（daily_content kind='anime-week'，每周一换）。
// 只用实拍的圣地巡礼、原型地照片，不用动画截图或角色图（有版权）。
let ANIME = null, ANIME_WEEK = null, animeKind = '';
function animeWeekLoad() {
  if (ANIME_WEEK) return ANIME_WEEK;
  if (typeof cloudClient !== 'function' || typeof cloudOn !== 'function' || !cloudOn()) return Promise.resolve(null);
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);   // 日本时间的今天
  ANIME_WEEK = cloudClient().then(c => c.from('daily_content').select('data').eq('kind', 'anime-week').eq('id', day).maybeSingle())
    .then(({ data, error }) => { if (error) throw error; return data ? data.data : null; })
    .catch(() => { ANIME_WEEK = null; return null; });
  return ANIME_WEEK;
}
// { list: 能看的作品（vip = 不在本周精选里）, full: 是不是会员的全部作品 }
// 非会员：本周精选 + 其他作品的目录（lang/ja-anime-index.json，只有标题和照片；lock = 只能看标题）
const animeLoad = () => ANIME ? Promise.resolve(ANIME) : Promise.all([animeWeekLoad(),
  typeof isMember === 'function' && isMember('ja') && typeof memberData === 'function' ? memberData('ja', 'lang/ja-anime.json').catch(() => null) : null,
  fetch('lang/ja-anime-index.json').then(r => r.ok ? r.json() : []).catch(() => [])])
  .then(([wk, all, idx]) => {
    const week = (wk && wk.works) || [], free = new Set(week.map(w => w.id));
    const list = all || (week.length ? week.concat(idx.filter(x => !free.has(x.id)).map(x => Object.assign({ lock: 1 }, x))) : []);
    list.forEach(w => { w.vip = !free.has(w.id); });
    const r = { list, full: !!all };
    if (list.length) ANIME = r;
    return r;
  });
const animeTitle = w => w.tfuri ? furiHTML(w.title, w.tfuri) : jr(w.title);
const ANIME_ICON = { anime: '🎬', drama: '📺' };

function viewAnime(arg) {
  const box = h('<div><div class="skel" aria-label="加载中" role="status"><i></i><i></i><i></i></div></div>');
  main.append(box);
  if (arg && arg.startsWith('d/')) { box.remove(); return animeDaily(arg.slice(2)); }   // 每日一课
  animeLoad().then(({ list, full }) => {
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<section class="panel"><p class="muted">暂时打不开，请检查网络后再试。</p></section>'; box.prepend(animeDailyBox()); return; }
    const w = arg && list.find(x => x.id === arg);
    if (w && w.lock) {   // 会员作品：只有标题
      box.append(h(`<section class="panel lock-panel has-vip">${vipTag()}<a class="an-back" href="#anime">← 全部作品</a>
        <h2 lang="ja" class="furi">${animeTitle(w)} <span class="small muted">${esc(w.zh)}</span></h2>
        <p>这部作品的台词、讲解和录音是日语会员内容。本周精选每周一更新，所有人都能看。</p>
        <div class="row"><a class="btn pri" href="#vip">了解会员</a><a class="btn" href="#anime">看本周精选</a></div></section>`));
      return;
    }
    box.append(w ? animeWork(w, list.filter(x => !x.lock)) : animeList(list, full));
    if (!w) box.prepend(animeDailyBox());
  }).catch(() => { box.innerHTML = '<section class="panel"><p class="muted">加载失败，请检查网络。</p></section>'; });
}

function animeList(list, full) {
  const p = h(`<section class="panel"><h2>动漫 · 日剧名台词</h2>
    <p class="small muted">那些被日本人挂在嘴边的台词：原句、读音、语法，再看看生活里怎么拿来玩梗。标「原创」的是本站写的动漫风、日剧风故事。</p>
    <p class="small">${full ? '会员可以看全部作品；没有 VIP 标记的是本周精选（每周一更新）。' : `本周精选 · 每周一更新。全部作品是会员内容 <a href="#vip">了解会员 ›</a>`}</p>
    <div class="seg" role="group">${[['', '全部'], ['anime', '动漫'], ['drama', '日剧']].map(([k, t]) => `<button type="button" data-k="${k}" class="${animeKind === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="an-grid"></div></section>`);
  const grid = p.querySelector('.an-grid');
  const draw = () => {
    grid.innerHTML = list.filter(w => !animeKind || w.kind === animeKind).map(w => `<a class="an-card has-vip ${w.kind}" href="#anime/${esc(w.id)}" data-t="${esc(w.title)}">${w.vip ? vipTag() : ''}
      <div class="an-img">${w.ph ? `<img src="${esc(w.ph[0])}" alt="" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'an-cover',textContent:this.closest('.an-card').dataset.t}))">` : `<span class="an-cover" lang="ja">${esc(w.title)}</span>`}</div>
      <div class="an-meta"><b lang="ja" class="furi">${animeTitle(w)}</b><span class="small muted">${w.orig ? '<span class="tag">原创</span> ' : ''}${esc(w.zh)}</span>
      ${w.lock ? '<span class="small muted an-first">🔒 会员</span>' : `<span class="small an-first furi" lang="ja">「${furiHTML(w.lines[0].jp, w.lines[0].furi)}」</span>`}</div></a>`).join('');
  };
  p.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { animeKind = b.dataset.k; p.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); draw(); }; });
  draw();
  return p;
}

function animeWork(w, list) {
  const vocabOf = x => wordIndex().get(x);
  if (w.aud) for (const k in w.aud) AUDIO_IDX[k] = AUDIO_IDX[k] || w.aud[k];   // 这部作品的录音（地址不在公开的索引里）
  const p = h(`<article class="panel an-work">
    <a class="an-back" href="#anime">← 全部作品</a>
    ${w.ph ? `<div class="an-hero"><img src="${esc(w.ph[0])}" alt="${esc(w.place)}" decoding="async" onerror="this.parentElement.remove()"></div>${photoCredit(w)}` : ''}
    <h2 lang="ja" class="furi">${animeTitle(w)} <span class="small muted">${w.orig ? '<span class="tag">原创</span> ' : ''}${esc(w.zh)}${w.year ? ' · ' + esc(w.year) : ''}</span></h2>
    ${w.place ? `<p class="small muted">${w.ph ? '📍 ' : ''}${esc(w.place)}</p>` : ''}
    <label class="small"><input type="checkbox" data-kana checked> 显示读音</label>
    <div class="an-lines">${w.lines.map((l, i) => `<section class="an-line">
      <div class="an-q"><span class="an-quote furi jtap" lang="ja">「${jaTapHTML(l.jp, l.furi)}」</span>${speakBtn(l.jp)}${shadowBtn(l.jp, l.kana, l.zh)}${reportBtn(l.jp, l.zh)}</div>
      ${l.furi ? '' : `<div class="an-kana" lang="ja">${esc(l.kana)}</div>`}
      <div class="an-zh">${esc(l.zh)}</div>
      <div class="small muted">—— <span lang="ja">${esc(l.who || '')}</span>${l.lv ? ` <span class="tag lv">${esc(l.lv)}</span>` : ''}${l.scene ? ` · ${jrNote(l.scene)}` : ''}</div>
      ${l.note ? `<p class="an-note small">${jrNote(l.note)}</p>` : ''}
      ${(l.words || []).length ? `<div class="an-words">${l.words.map(([x, r, zh]) => { const v = vocabOf(x); return `<span class="an-w"><b lang="ja" class="furi">${jrWord(x, r)}</b> <span lang="ja" class="muted">${esc(r)}</span> ${esc(zh)}${v && v.q ? ` <button type="button" class="chip-btn" data-add="${esc(v.id)}">${S.srs[v.id] ? '已在单词卡' : '+ 单词卡'}</button>` : ''}</span>`; }).join('')}</div>` : ''}
      ${(l.talk || []).length ? `<details class="an-talk"><summary class="small">生活里这样用</summary>${l.talk.map(([who, jp, kana, zh, furi]) => `<div class="an-t"><span class="an-who">${esc(who)}</span><div><span lang="ja" class="furi jtap">${jaTapHTML(jp, furi)}</span>${speakBtn(jp)}${furi ? '' : `<div class="an-kana small" lang="ja">${esc(kana)}</div>`}<div class="small muted">${esc(zh)}</div></div></div>`).join('')}</details>` : ''}
    </section>`).join('')}</div>
    <h3>小测验：这句台词是什么意思？</h3><div class="an-quiz"></div>
  </article>`);
  p.querySelector('[data-kana]').onchange = e => p.classList.toggle('hide-kana', !e.target.checked);
  p.querySelectorAll('[data-add]').forEach(b => {
    b.onclick = () => { const id = b.dataset.add; if (S.srs[id]) return; S.srs[id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; save(); b.textContent = '已加入'; toast('已加入单词卡，今天就会复习'); };
  });
  animeQuiz(p.querySelector('.an-quiz'), w, list);
  return p;
}

// 看日文台词选中文意思：干扰项来自其他作品的台词
function animeQuiz(box, w, list) {
  const others = list.flatMap(x => x.id === w.id ? [] : x.lines.map(l => l.zh));
  const qs = sample(w.lines, Math.min(4, w.lines.length));
  let i = 0, right = 0;
  const next = () => {
    if (i >= qs.length) {
      box.innerHTML = `<p>答对 ${right} / ${qs.length}。</p><button class="btn" type="button">再来一次</button>`;
      box.querySelector('button').onclick = () => animeQuiz(box, w, list);
      if (right) addXP(right * 5);
      return;
    }
    const q = qs[i], opts = sample([q.zh, ...sample(others.filter(z => z !== q.zh), 3)], 4);
    box.innerHTML = `<p><b lang="ja" class="furi">「${furiHTML(q.jp, q.furi)}」</b> ${speakBtn(q.jp)}</p><div class="an-opts">${opts.map(o => `<button class="btn" type="button">${esc(o)}</button>`).join('')}</div>`;
    box.querySelectorAll('.an-opts button').forEach(b => {
      b.onclick = () => {
        const ok = b.textContent === q.zh;
        if (ok) right++;
        box.querySelectorAll('.an-opts button').forEach(x => { x.disabled = true; if (x.textContent === q.zh) x.classList.add('pri'); });
        if (!ok) b.classList.add('danger');
        i++; setTimeout(next, ok ? 700 : 1500);
      };
    });
  };
  next();
}

/* ---------- 动漫风台词 · 每日一课：每天一个模块 10 句（原创）。当天的所有人可看，往期给会员（服务器 daily_content 表，docs/SUPABASE_SETUP.md 18.5） ---------- */
let ANIME_DAILY = null;
function animeDailyLoad() {
  if (ANIME_DAILY) return ANIME_DAILY;
  if (typeof cloudClient !== 'function' || typeof cloudOn !== 'function' || !cloudOn()) return Promise.resolve([]);
  ANIME_DAILY = cloudClient().then(c => c.from('daily_content').select('id,d,data').eq('kind', 'anime').order('d', { ascending: false }).limit(400))
    .then(({ data, error }) => { if (error) throw error; return data || []; })
    .catch(() => { ANIME_DAILY = null; return []; });
  return ANIME_DAILY;
}
// 动漫页最上面：今天的一课 + 会员的往期
function animeDailyBox() {
  const box = h('<div class="an-daily"></div>');
  animeDailyLoad().then(rows => {
    if (!rows.length || !box.isConnected) return;
    const [today, ...past] = rows, member = typeof isMember === 'function' && isMember('ja');
    const card = (r, i) => `<a class="an-dcard has-vip" href="#anime/d/${esc(r.id)}"><span class="tag lv">${esc(r.data.lv)}</span> <span class="small muted">${esc(r.data.theme)}</span><b>${esc(r.data.title)}</b><span class="small furi" lang="ja">${jr(r.data.title_ja)}</span>${i ? vipTag() : ''}</a>`;
    box.append(h(`<section class="panel"><div class="eyebrow">今日一课 · 动漫风台词</div>${card(today, 0)}
      ${member && past.length ? `<details class="an-past"><summary class="small">往期（会员）</summary><div class="an-dlist">${past.map(r => card(r, 1)).join('')}</div></details>`
        : `<p class="small muted">每天一课，学动漫里常听到的说法，配讲解和真人风格配音。往期内容是会员专享 <a href="#vip">了解会员 ›</a></p>`}</section>`));
  });
  return box;
}
function animeDaily(id) {
  const box = h('<div><div class="skel" aria-label="加载中" role="status"><i></i><i></i><i></i></div></div>');
  main.append(box);
  animeDailyLoad().then(rows => {
    const r = rows.find(x => x.id === id);
    box.innerHTML = '';
    if (!r) { box.append(h(`<section class="panel"><a class="an-back" href="#anime">← 动漫</a><p>这一课是会员内容，或者还没到开放的日子。</p><a class="btn pri" href="#vip">了解会员</a></section>`)); return; }
    const m = r.data;
    const p = h(`<article class="panel an-work an-daily-mod">
      <a class="an-back" href="#anime">← 动漫</a>
      <div class="eyebrow">${esc(r.d)} · ${esc(m.theme)} <span class="tag lv">${esc(m.lv)}</span></div>
      <h2>${esc(m.title)} <span class="small muted furi" lang="ja">${jr(m.title_ja)}</span></h2>
      <p class="muted">${esc(m.intro)}</p>
      <div class="an-lines">${m.lines.map((l, i) => `<section class="an-line">
        <div class="an-q"><span class="an-quote furi jtap" lang="ja">「${jaTapHTML(l.jp, l.furi)}」</span>${l.a ? `<button class="speak" type="button" data-ap="${i}" aria-label="朗读">${SPEAK_SVG}</button>` : speakBtn(l.kana || l.jp)}</div>
        <div class="an-zh">${esc(l.zh)}</div>
        <div class="small muted">—— ${esc(l.who || '')}</div>
        ${l.note ? `<p class="an-note small">${jrNote(l.note)}</p>` : ''}
        ${l.real ? `<p class="small an-real">💬 ${jrNote(l.real)}</p>` : ''}
      </section>`).join('')}</div>
      ${(m.words || []).length ? `<h3>关键词</h3><div class="an-words">${m.words.map(([w, r2, zh]) => `<span class="an-w"><b lang="ja" class="furi">${jrWord(w, r2)}</b> ${speakBtn(r2)} <span class="small">${esc(zh)}</span></span>`).join('')}</div>` : ''}
      ${(m.quiz || []).length ? `<h3>小测验</h3><div class="an-dquiz">${m.quiz.map((q, qi) => `<div class="an-dq" data-q="${qi}"><p>${jrNote(q.q)}</p><div class="opts">${q.opts.map((o, oi) => `<button type="button" class="opt" data-o="${oi}"><span lang="ja">${esc(o)}</span></button>`).join('')}</div></div>`).join('')}</div>` : ''}
    </article>`);
    p.querySelectorAll('[data-ap]').forEach(b => { b.onclick = e => { e.stopPropagation(); stopSpeech(); const a = new Audio(m.lines[+b.dataset.ap].a); a.playbackRate = Math.min(1.5, Math.max(.5, S.rate + .2)); a.play().catch(() => speak(m.lines[+b.dataset.ap].kana || m.lines[+b.dataset.ap].jp)); }; });
    p.querySelectorAll('.an-dq').forEach(d => {
      const q = m.quiz[+d.dataset.q];
      d.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => {
        if (d.dataset.done) return; d.dataset.done = 1;
        const ok = +b.dataset.o === q.a;
        b.classList.add(ok ? 'right' : 'wrong'); d.querySelector(`[data-o="${q.a}"]`).classList.add('right');
        if (ok && typeof addXP === 'function') addXP(2);
      }; });
    });
    box.append(p);
  });
}
