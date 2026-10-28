// 动漫·日剧名台词：每部作品几句广为流传的台词，配读音、中文、语法说明、生词和一段原创的生活小对话。
// 数据在 lang/ja-anime.json（tools/build_anime.py 生成，内容规范见 tools/anime/SPEC.md）。
// 只用实拍的圣地巡礼、原型地照片，不用动画截图或角色图（有版权）。
let ANIME = null, animeKind = '';
const animeLoad = () => ANIME ? Promise.resolve(ANIME) : fetch('lang/ja-anime.json').then(r => r.ok ? r.json() : []).then(d => (ANIME = d));
const ANIME_ICON = { anime: '🎬', drama: '📺' };

function viewAnime(arg) {
  const box = h('<div><p class="muted">加载中……</p></div>');
  main.append(box);
  animeLoad().then(list => {
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<section class="panel"><p class="muted">内容准备中，过几天再来看看。</p></section>'; return; }
    const w = arg && list.find(x => x.id === arg);
    box.append(w ? animeWork(w, list) : animeList(list));
  }).catch(() => { box.innerHTML = '<section class="panel"><p class="muted">加载失败，请检查网络。</p></section>'; });
}

function animeList(list) {
  const p = h(`<section class="panel"><h2>动漫 · 日剧名台词</h2>
    <p class="small muted">那些被日本人挂在嘴边的台词：原句、读音、语法，再看看生活里怎么拿来玩梗。</p>
    <div class="seg" role="group">${[['', '全部'], ['anime', '动漫'], ['drama', '日剧']].map(([k, t]) => `<button type="button" data-k="${k}" class="${animeKind === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="an-grid"></div></section>`);
  const grid = p.querySelector('.an-grid');
  const draw = () => {
    grid.innerHTML = list.filter(w => !animeKind || w.kind === animeKind).map(w => `<a class="an-card" href="#anime/${esc(w.id)}">
      <div class="an-img">${w.ph ? `<img src="${esc(w.ph[0])}" alt="" loading="lazy" decoding="async">` : `<span>${ANIME_ICON[w.kind] || '🎬'}</span>`}</div>
      <div class="an-meta"><b lang="ja">${esc(w.title)}</b><span class="small muted">${esc(w.zh)} · ${w.lines.length} 句</span>
      <span class="small an-first" lang="ja">「${esc(w.lines[0].jp)}」</span></div></a>`).join('');
  };
  p.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { animeKind = b.dataset.k; p.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); draw(); }; });
  draw();
  return p;
}

function animeWork(w, list) {
  const vocabOf = x => wordIndex().get(x);
  const p = h(`<article class="panel an-work">
    <a class="small" href="#anime">← 全部作品</a>
    ${w.ph ? `<div class="ra-hero"><img class="rc-photo" src="${esc(w.ph[0])}" alt="${esc(w.place)}" decoding="async"></div>${photoCredit(w)}` : ''}
    <h2 lang="ja">${esc(w.title)} <span class="small muted">${esc(w.zh)}${w.year ? ' · ' + esc(w.year) : ''}</span></h2>
    ${w.place ? `<p class="small muted">${w.ph ? '📍 ' : ''}${esc(w.place)}</p>` : ''}
    <label class="small"><input type="checkbox" data-kana checked> 显示读音</label>
    <div class="an-lines">${w.lines.map((l, i) => `<section class="an-line">
      <div class="an-q"><span class="an-quote" lang="ja">「${esc(l.jp)}」</span>${speakBtn(l.jp)}${shadowBtn(l.jp, l.kana, l.zh)}</div>
      <div class="an-kana" lang="ja">${esc(l.kana)}</div>
      <div class="an-zh">${esc(l.zh)}</div>
      <div class="small muted">—— <span lang="ja">${esc(l.who || '')}</span>${l.lv ? ` <span class="tag lv">${esc(l.lv)}</span>` : ''}${l.scene ? ` · ${esc(l.scene)}` : ''}</div>
      ${l.note ? `<p class="an-note small">${esc(l.note)}</p>` : ''}
      ${(l.words || []).length ? `<div class="an-words">${l.words.map(([x, r, zh]) => { const v = vocabOf(x); return `<span class="an-w"><b lang="ja">${esc(x)}</b> <span lang="ja" class="muted">${esc(r)}</span> ${esc(zh)}${v && v.q ? ` <button type="button" class="chip-btn" data-add="${esc(v.id)}">${S.srs[v.id] ? '已在单词卡' : '+ 单词卡'}</button>` : ''}</span>`; }).join('')}</div>` : ''}
      ${(l.talk || []).length ? `<details class="an-talk"><summary class="small">生活里这样用</summary>${l.talk.map(([who, jp, kana, zh]) => `<div class="an-t"><span class="an-who">${esc(who)}</span><div><span lang="ja">${esc(jp)}</span>${speakBtn(jp)}<div class="an-kana small" lang="ja">${esc(kana)}</div><div class="small muted">${esc(zh)}</div></div></div>`).join('')}</details>` : ''}
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
    box.innerHTML = `<p><b lang="ja">「${esc(q.jp)}」</b> ${speakBtn(q.jp)}</p><div class="an-opts">${opts.map(o => `<button class="btn" type="button">${esc(o)}</button>`).join('')}</div>`;
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
