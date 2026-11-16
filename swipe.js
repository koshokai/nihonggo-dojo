// 左右滑动切换底部导航的几个主页面；在第一个页面（今天）再往右滑，从左边拉出「秘密抽屉」：今日运势、吉祥物跳舞、放烟花、快捷开关、小档案。
// 只在主页面生效；做题时、在横向滚动的区域 / 输入框 / 画板上滑、从屏幕最边缘起手（留给 iPhone 的返回手势）都不触发。
(() => {
  let sx = 0, sy = 0, st = 0, track = null, moved = false;
  const tabs = () => [...document.querySelectorAll('.tabs a')];
  const curTab = () => { const t = tabs(); const i = t.findIndex(a => a.classList.contains('on')); return { t, i }; };
  // 当前是不是某个底部栏目的首页（子页面不滑，免得误触）
  const onTabRoot = () => { const { t, i } = curTab(); if (i < 0) return false; const href = t[i].getAttribute('href'), h0 = location.hash || '#home'; return h0 === href || (href === '#home' && (h0 === '' || h0 === '#')); };
  const blocked = el => el.closest('input, textarea, select, canvas, .pad-area, .list-wrap, .seg, .tr-bank, .tr-slot, .zh-syls, .kana-grid, .kanji-grid, .word-sheet, .ask-mask, .dict-layer, .secret, [data-noswipe]');
  addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || document.body.classList.contains('focus')) return;
    const t = e.touches[0];
    if (t.clientX < 22 || t.clientX > innerWidth - 22 || blocked(e.target) || !onTabRoot()) { track = null; return; }
    sx = t.clientX; sy = t.clientY; st = Date.now(); track = document.getElementById('main'); moved = false; last = []; dxNow = 0;
  }, { passive: true });
  // 拖动时页面 1:1 跟手（没有下一页的方向加阻力）；松手后够远或够快就顺着方向滑出去、新页面从另一边接着滑进来，不够就平滑弹回。
  // 横向一旦确定就锁住竖向滚动，避免边滑边上下抖。
  let last = [], raf = 0, dxNow = 0;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paint = () => { raf = 0; if (!track) return; const w = innerWidth; track.style.transform = `translate3d(${dxNow}px,0,0)`; track.style.opacity = String(1 - Math.min(.4, Math.abs(dxNow) / (w * 1.6))); };
  addEventListener('touchmove', e => {
    if (!track) return;
    const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    // 手指移动超过 10px 以后再判断方向（刚碰到屏幕时竖向的抖动常常比横向大，太早判断会把横滑当成滚动）
    if (!moved) {
      if (Math.hypot(dx, dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx) * .8) { track = null; return; }   // 竖着滑是滚动页面
      moved = true; track.style.transition = 'none'; track.style.willChange = 'transform, opacity';
    }
    if (e.cancelable) e.preventDefault();   // 已经确定是横滑：不让页面同时上下滚动
    const { t: list, i } = curTab();
    const edge = dx < 0 && i >= list.length - 1;   // 最后一个栏目再往左：没有下一页，加阻力（第一个栏目往右是秘密抽屉，照常跟手）
    dxNow = edge ? dx * .25 : dx;
    last.push([Date.now(), t.clientX]); if (last.length > 6) last.shift();
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: false });
  addEventListener('touchend', e => {
    if (!track) return;
    const el = track; track = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, w = innerWidth;
    const p0 = last[0] || [st, sx]; last = [];
    const v = (t.clientX - p0[1]) / Math.max(16, Date.now() - p0[0]);   // 最后一小段的速度（px/ms）
    const reset = () => { el.style.transition = 'transform .24s cubic-bezier(.2,.8,.3,1), opacity .24s'; el.style.transform = ''; el.style.opacity = ''; setTimeout(() => { el.style.transition = ''; el.style.willChange = ''; }, 260); };
    if (!moved) return;
    const { t: list, i } = curTab();
    const go = (Math.abs(dx) > w * .28 || (Math.abs(v) > .45 && Math.abs(dx) > 36)) && Math.abs(dx) > Math.abs(dy) && Math.sign(v || dx) === Math.sign(dx);
    const target = !go ? null : dx < 0 ? (i < list.length - 1 ? ['l', list[i + 1]] : null) : (i > 0 ? ['r', list[i - 1]] : 'secret');
    if (!target) return reset();
    if (target === 'secret') { reset(); return openSecret(); }
    const [dir, a] = target;
    if (reduce()) { el.style.transform = ''; el.style.opacity = ''; el.style.willChange = ''; return swipeGo(a.getAttribute('href'), dir); }
    // 顺着手指的方向滑出去，滑完再换页（新页面从另一边滑进来，见 style.css 的 swipeL / swipeR）
    const ms = Math.max(120, Math.min(220, (w - Math.abs(dx)) / Math.max(.9, Math.abs(v))));
    el.style.transition = `transform ${ms}ms cubic-bezier(.3,.6,.4,1), opacity ${ms}ms`;
    el.style.transform = `translate3d(${dx < 0 ? -w : w}px,0,0)`; el.style.opacity = '.3';
    setTimeout(() => { el.style.transition = 'none'; el.style.transform = ''; el.style.opacity = ''; el.style.willChange = ''; swipeGo(a.getAttribute('href'), dir); requestAnimationFrame(() => { el.style.transition = ''; }); }, ms);
  });
  addEventListener('touchcancel', () => { if (!track) return; const el = track; track = null; last = []; el.style.transition = 'transform .24s'; el.style.transform = ''; el.style.opacity = ''; setTimeout(() => { el.style.transition = ''; el.style.willChange = ''; }, 260); });
  function swipeGo(href, dir) {
    if (typeof buzz === 'function') buzz(8);
    document.body.dataset.swipe = dir;   // fx.js 换页时按方向滑进来
    location.hash = href.slice(1);
  }

  /* ---------- 秘密抽屉 ---------- */
  const OMIKUJI = [['大吉', '今天学什么都记得住！', '今日は何を学んでもすぐ覚えられる！'], ['中吉', '适合复习，旧卡片会对你微笑。', '復習日和。昔のカードがほほえんでくれる。'], ['小吉', '慢慢来，十分钟就很好。', 'ゆっくりでOK。10分で十分。'],
    ['吉', '今天适合大声跟读。', '今日は声に出して読むのが吉。'], ['末吉', '错题里藏着宝藏。', '間違えた問題に宝物が隠れている。'], ['大吉', '可能会遇到一个想用的新词。', '使ってみたい新しい言葉に出会えそう。']];
  window.openSecret = function () {
    if (document.querySelector('.secret')) return;
    const J = typeof uiJa === 'function' && uiJa(), T = (a, b) => J ? b : a;
    const daysAll = Object.keys(S.days || {}).filter(k => S.days[k] > 0).sort();
    const since = daysAll[0] ? Math.max(1, Math.round((Date.now() - Date.parse(daysAll[0])) / DAY) + 1) : 1;
    const d = new Date(), seed = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
    const omi = OMIKUJI[seed % OMIKUJI.length];
    // 幸运单词：今天固定一个（中文板块用 HSK，其他用 JLPT）
    let lucky = null;
    try {
      if (S.track === 'zh' && typeof zhDuelPool === 'function') { const pool = zhDuelPool(zhLevel()); if (pool.length) { const x = pool[seed % pool.length]; lucky = { w: x.w, r: x.r, m: x.m, lang: 'zh-CN' }; } }
      else if (typeof VOCAB !== 'undefined') { const pool = VOCAB[S.level || 'N5']; const v = pool[seed % pool.length]; lucky = { w: v.w, r: v.r, m: v.m.split(/[；;]/)[0], lang: 'ja' }; }
    } catch (e) { /* 忽略 */ }
    const sw = h(`<div class="secret-mask"><aside class="secret" role="dialog" aria-label="${T('秘密抽屉', 'ひみつの引き出し')}">
      <div class="secret-head"><b>🤫 ${T('秘密抽屉', 'ひみつの引き出し')}</b><button class="ws-x" type="button" data-close aria-label="close">×</button></div>
      <p class="small muted">${T('被你发现了！这里没什么正经东西，玩玩就好。', '見つかっちゃった！ここは遊び心だけのスペースです。')}</p>
      <section class="secret-card omikuji" data-omi><div class="eyebrow">${T('今日运势', '今日のおみくじ')}</div><div class="omi-face"><b>？</b><span class="small muted">${T('点一下抽签', 'タップして引く')}</span></div></section>
      ${lucky ? `<section class="secret-card"><div class="eyebrow">${T('今天的幸运词', '今日のラッキーワード')}</div><div class="row"><b class="lucky-w" lang="${lucky.lang}">${esc(lucky.w)}</b>${lucky.lang === 'ja' ? speakBtn(lucky.r) : sayBtn(lucky.w, 'zh-CN')}</div><div class="small muted">${esc(lucky.r)} · ${esc(lucky.m)}</div></section>` : ''}
      <section class="secret-card dance" data-dance><div class="eyebrow">${T('戳一戳吉祥物', 'マスコットをつついてみて')}</div><div class="dance-stage">${typeof mascotDuo === 'function' ? mascotDuo('happy', '') : neko('happy')}</div></section>
      <section class="secret-card"><div class="eyebrow">${T('快捷开关', 'クイック設定')}</div>
        <div class="secret-toggles">
          <button type="button" data-tg="dark">${document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'} ${T('深色', 'ダーク')}</button>
          <button type="button" data-tg="petals">🌸 ${T('樱花', '花びら')} ${S.petals ? 'ON' : 'OFF'}</button>
          <button type="button" data-tg="font">🔠 ${T('字号', '文字サイズ')}</button>
          <button type="button" data-tg="boom">🎆 ${T('放烟花', '花火')}</button>
        </div></section>
      <section class="secret-card"><div class="eyebrow">${T('我们的小档案', 'ふたりの記録')}</div>
        <div class="secret-stats"><div><b>${since}</b><span>${T('认识的天数', '出会って何日')}</span></div><div><b>${S.xp || 0}</b><span>${T('累计经验', '累計 XP')}</span></div><div><b>${S.best || 0}</b><span>${T('最长连续', '最長連続')}</span></div><div><b>${daysAll.length}</b><span>${T('学习天数', '学習した日')}</span></div></div></section>
      <p class="small muted center">${T('往左滑或点外面关掉', '左にスワイプか外側をタップで閉じます')}</p>
    </aside></div>`);
    document.body.append(sw);
    requestAnimationFrame(() => sw.classList.add('open'));
    const close = () => { sw.classList.remove('open'); setTimeout(() => { sw.remove(); if (typeof applyTheme === 'function') applyTheme(); }, 280); };
    sw.onclick = e => { if (e.target === sw) close(); };
    sw.querySelector('[data-close]').onclick = close;
    // 抽屉里往左滑关掉
    let x0 = 0;
    sw.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    sw.addEventListener('touchend', e => { if (e.changedTouches[0].clientX - x0 < -60) close(); });
    // 抽签：翻转一下出结果，每天的签是固定的
    const om = sw.querySelector('[data-omi]');
    om.onclick = () => {
      if (om.classList.contains('drawn')) return;
      om.classList.add('drawn');
      om.querySelector('.omi-face').innerHTML = `<b class="omi-kichi">${omi[0]}</b><span>${T(omi[1], omi[2])}</span>`;
      if (typeof buzz === 'function') buzz([10, 40, 10]);
      if (omi[0] === '大吉' && typeof fxFireworks === 'function') fxFireworks(1500);
    };
    // 吉祥物：每戳一下换一个表情，跳一下
    const moods = ['happy', 'wow', 'cheer', 'think', 'sad', 'happy'];
    let mi = 0;
    sw.querySelector('[data-dance]').onclick = () => {
      mi = (mi + 1) % moods.length;
      const stg = sw.querySelector('.dance-stage');
      stg.innerHTML = typeof mascotDuo === 'function' ? mascotDuo(moods[mi], 'jump') : neko(moods[mi], 'jump');
      if (typeof buzz === 'function') buzz(12);
      if (mi === 4) toast(T('别戳啦，会痛的……', 'もう、つつきすぎ……'));
    };
    sw.querySelectorAll('[data-tg]').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.tg;
        if (k === 'dark') { S.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); b.textContent = `${S.theme === 'dark' ? '☀️' : '🌙'} ${T('深色', 'ダーク')}`; }
        if (k === 'petals') { S.petals = !S.petals; save(); if (typeof startPetals === 'function') startPetals(); b.textContent = `🌸 ${T('樱花', '花びら')} ${S.petals ? 'ON' : 'OFF'}`; }
        if (k === 'font') { S.fontSize = { m: 'l', l: 'xl', xl: 'm' }[S.fontSize || 'm']; save(); if (typeof applyFontSize === 'function') applyFontSize(); toast({ m: T('标准字号', '標準'), l: T('大字号', '大'), xl: T('特大字号', '特大') }[S.fontSize]); }
        if (k === 'boom' && typeof fxFireworks === 'function') fxFireworks(2200);
      };
    });
  };
})();
