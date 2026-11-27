// 有性格的动效：翻书一样的换页、立体翻转和层叠的单词卡、里程碑烟花 + 经验火焰 + 吉祥物说一句心里话。
// 系统打开「减少动态效果」时只显示提示卡，不放动画。依赖 app.js 的 S、h、esc、neko、tj、buzz（运行时才调用）。
const fxCalm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 换页：旧页面化成颗粒慢慢消失，新页面「哗」地弹出来；按返回时反方向 ---------- */
let fxBack = false, fxRoute = null;
// 是不是「返回」：自己记一份走过的地址（浏览器换 # 时也会发 popstate，不能用它判断）
const fxStack = [location.hash];
addEventListener('hashchange', () => {
  const h = location.hash, n = fxStack.length;
  fxBack = n > 1 && fxStack[n - 2] === h;
  if (fxBack) fxStack.pop(); else if (fxStack[n - 1] !== h) { fxStack.push(h); if (fxStack.length > 60) fxStack.shift(); }
});
const fxChanged = () => location.hash !== fxRoute;   // 同一页重画（数据更新、骨架换成内容）不放动画
// render() 清空页面之前调用：把当前画面拍成「快照」盖在上面，快照带着颗粒噪点、变模糊、慢慢消失
// 换页不放动画，直接切换（旧页面快照、弹出、滑入都会让画面闪一下，用户觉得不好看）
const FX_PAGE_ANIM = false;
function fxPageOut() {
  if (!FX_PAGE_ANIM) return;
  const m = document.getElementById('main');
  if (!m || fxCalm() || fxRoute === null || !fxChanged() || !m.firstElementChild) return;
  document.querySelectorAll('.pg-ghost').forEach(g => g.remove());
  if (m.getElementsByTagName('*').length > 2500) return;   // 很长的页面（单词表）不拍快照，只做弹出，免得手机卡
  const r = m.getBoundingClientRect(), g = m.cloneNode(true);
  g.removeAttribute('id'); g.removeAttribute('tabindex');
  g.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
  g.classList.remove('page-in', 'page-back', 'swipe-l', 'swipe-r');
  g.classList.add('pg-ghost');
  if (fxBack) g.classList.add('back');
  g.setAttribute('aria-hidden', 'true'); g.inert = true;
  Object.assign(g.style, { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: Math.min(r.height, innerHeight - Math.max(0, r.top)) + 'px' });
  document.body.append(g);
  setTimeout(() => g.remove(), 360);
}
function fxPageIn() {
  const m = document.getElementById('main');
  const first = fxRoute === null, changed = fxChanged(); fxRoute = location.hash;
  if (!FX_PAGE_ANIM && m) { m.classList.remove('page-in', 'page-back', 'swipe-l', 'swipe-r'); delete document.body.dataset.swipe; fxBack = false; return; }
  if (!m || fxCalm() || !changed || first) return;   // 第一次打开网站：直接显示，不放动画
  m.classList.remove('page-in', 'page-back', 'swipe-l', 'swipe-r');
  void m.offsetWidth;
  const sw = document.body.dataset.swipe;   // 左右滑动换页（swipe.js）：新页面从滑动的方向进来
  m.classList.add(sw ? 'swipe-' + sw : fxBack ? 'page-back' : 'page-in');
  delete document.body.dataset.swipe;
  fxBack = false;
}

/* ---------- 单词卡：不做翻转和飞出（半透明的残影会挡住下面的文字），只保留新卡轻轻浮上来（CSS 的 dealIn） ---------- */
function fxCardOut() {}
function fxFlip() {}

/* ---------- 里程碑 ---------- */
const FX_XP = [50, 100, 300, 500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 50000];
const FX_STREAK = [3, 7, 14, 30, 50, 100, 200, 365];
// 吉祥物的心里话：有夸的，也有一点小调侃（中文、日语、英语界面各一套）
const FX_LINES = {
  goal: [['今天的目标搞定！明天也来哦～', '今日の目標クリア！明日も待ってるね〜', 'Today’s goal: done! See you tomorrow~'], ['可以，今天的你很棒。', 'やるじゃん、今日のあなたは最高。', 'Nice. You were great today.'], ['打卡成功！喝杯茶奖励一下自己吧。', '達成！お茶でも飲んで自分にごほうびを。', 'Done! Treat yourself to a cup of tea.']],
  xpLow: [['这才刚开始呢，别骄傲～', 'まだまだ序の口！調子に乗らないでね〜', 'This is only the beginning. Don’t get cocky~'], ['不错的开头，路还长着呢。', 'いいスタート。道のりはまだ長いよ。', 'A good start. There’s still a long way to go.'], ['热身结束，正式开始！', 'ウォーミングアップ終了、ここからが本番！', 'Warm-up over. Now it begins for real!']],
  xpMid: [['已经有点样子了！', 'だいぶサマになってきた！', 'You’re really getting the hang of it!'], ['坚持下来的人，真的不多。', 'ここまで続けられる人、実は少ないんだよ。', 'Not many people make it this far.'], ['你比昨天的自己更厉害了。', '昨日の自分より、確実に強くなってる。', 'You’re better than you were yesterday.']],
  xpHigh: [['你已经是高手了，要不要教教我？', 'もう達人の域だね。ちょっと教えてくれない？', 'You’re a pro now. Want to teach me?'], ['这个数字……太夸张了吧！', 'この数字……さすがにすごすぎない？', 'That number… is unbelievable!'], ['传说中的学霸就是你吧。', 'うわさの秀才って、あなたのことだよね。', 'So you must be the legendary star student.']],
  streak: [['连续打卡，习惯正在长成！', '連続記録更新！習慣が根づいてきたね。', 'Another day in a row. The habit is taking root!'], ['一天都没落下，佩服佩服。', '一日も欠かさないなんて、尊敬しちゃう。', 'Not a single day missed. I’m impressed.'], ['再坚持几天，就停不下来啦。', 'あと数日続けたら、もうやめられなくなるよ。', 'A few more days and you won’t be able to stop.']],
  rank: [['升级了！新的称号很适合你。', 'ランクアップ！新しい称号、似合ってるよ。', 'Rank up! The new title suits you.'], ['又往上爬了一层，风景更好了吧？', 'また一段上へ。景色、よく見えるでしょ？', 'Another step up. The view’s better from here, right?']]
};
const fxLine = k => { const l = FX_LINES[k][Math.floor(Math.random() * FX_LINES[k].length)]; return tj(l[0], l[1], l[2]); };

let fxQueue = [], fxBusy = false;
// 做题、背卡片时（专注模式）先存着，这一轮结束后再放
function fxMilestone(o) {
  fxQueue.push(o);
  fxNext();
}
function fxNext() {
  if (fxBusy || !fxQueue.length) return;
  if (document.body.classList.contains('focus')) {
    const ob = new MutationObserver(() => { if (!document.body.classList.contains('focus')) { ob.disconnect(); setTimeout(fxNext, 600); } });
    ob.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return;
  }
  fxBusy = true;
  const o = fxQueue.shift();
  const done = () => { fxBusy = false; setTimeout(fxNext, 300); };
  if (fxCalm()) return fxCard(o, done);
  fxFireworks(2600);
  fxSparksToXP(o.xp, () => fxCard(o, done));
  if (typeof buzz === 'function') buzz([20, 60, 30]);
}
// 经验火星：一簇火星从屏幕中间沿弧线冲向右上角的经验值，经验值跳一下并显示 +n
function fxSparksToXP(xp, next) {
  const chip = document.getElementById('chip-xp');
  const to = chip ? chip.getBoundingClientRect() : { left: innerWidth - 40, top: 20, width: 30, height: 20 };
  const tx = to.left + to.width / 2, ty = to.top + to.height / 2, sx = innerWidth / 2, sy = innerHeight * .55;
  const css = getComputedStyle(document.body), cols = [css.getPropertyValue('--gold'), css.getPropertyValue('--ai'), css.getPropertyValue('--brand-2'), '#FFD25A'].map(c => c.trim());
  const N = 14;
  for (let i = 0; i < N; i++) {
    const s = document.createElement('i'); s.className = 'fx-spark'; s.style.color = cols[i % cols.length];
    document.body.append(s);
    const bend = (Math.random() - .5) * 220, delay = i * 45, dur = 700 + Math.random() * 250;
    const cx = (sx + tx) / 2 + bend, cy = Math.min(sy, ty) - 60 - Math.random() * 80;
    const t0 = performance.now() + delay;
    const step = t => {
      const k = Math.min(1, Math.max(0, (t - t0) / dur)), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const x = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * cx + e * e * tx, y = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * cy + e * e * ty;
      s.style.transform = `translate(${x - 4.5}px, ${y - 4.5}px) scale(${1 - e * .5})`;
      s.style.opacity = k < .05 ? 0 : 1;
      if (k < 1) requestAnimationFrame(step); else s.remove();
    };
    requestAnimationFrame(step);
  }
  setTimeout(() => {
    if (chip) { chip.classList.remove('fx-hit'); void chip.offsetWidth; chip.classList.add('fx-hit'); }
    if (xp != null) {
      const p = document.createElement('b'); p.className = 'fx-plus'; p.textContent = '+' + xp;
      p.style.left = (tx - 14) + 'px'; p.style.top = (to.top + to.height + 4) + 'px';
      document.body.append(p); setTimeout(() => p.remove(), 1200);
    }
  }, 950);
  setTimeout(next, 1350);
}
// 提示卡：吉祥物 + 标题 + 一句心里话
function fxCard(o, done) {
  const m = h(`<div class="ask-mask fx-mask" role="dialog" aria-modal="true"><div class="ask-box fx-card">
    <div class="fx-badge">${o.badge || '★'}</div>
    ${neko(o.mood || 'cheer', 'big wave')}
    <h2>${esc(o.title)}</h2>${o.sub ? `<div class="small muted">${esc(o.sub)}</div>` : ''}
    <p class="fx-line">「${esc(o.line || '')}」</p>
    <button class="btn pri big" type="button" data-ok>${tj('好的！', 'よし！', 'OK!')}</button></div></div>`);
  const close = () => { m.remove(); if (typeof applyTheme === 'function') applyTheme(); done(); };
  m.querySelector('[data-ok]').onclick = close;
  m.onclick = e => { if (e.target === m) close(); };
  document.body.append(m);
  m.querySelector('[data-ok]').focus({ preventScroll: true });
}
// 烟花：几枚礼花从底部升起，在空中炸开
function fxFireworks(ms = 2500) {
  const cv = document.createElement('canvas'); cv.className = 'fx-canvas'; document.body.append(cv);
  const ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const css = getComputedStyle(document.body), tokc = n => css.getPropertyValue(n).trim();
  const cols = [tokc('--ai'), tokc('--brand'), tokc('--brand-2'), tokc('--gold'), '#FFFFFF', '#3CD6A4'].filter(Boolean);
  const rockets = [], sparks = [], t0 = performance.now();
  const launch = () => rockets.push({ x: innerWidth * (.2 + Math.random() * .6), y: innerHeight, vy: -(innerHeight / 70 + Math.random() * 3), target: innerHeight * (.18 + Math.random() * .3), c: cols[Math.floor(Math.random() * cols.length)] });
  for (let i = 0; i < 5; i++) setTimeout(launch, i * 320);
  const frame = t => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const r of rockets) {
      r.y += r.vy; r.vy *= .985;
      ctx.fillStyle = r.c; ctx.beginPath(); ctx.arc(r.x, r.y, 2.4, 0, 7); ctx.fill();
      if (r.y <= r.target && !r.boom) {
        r.boom = true;
        const n = 46;
        for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, sp = 2 + Math.random() * 3.2; sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 50 + Math.random() * 25, c: Math.random() < .25 ? '#FFFFFF' : r.c }); }
      }
    }
    for (let i = rockets.length - 1; i >= 0; i--) if (rockets[i].boom) rockets.splice(i, 1);
    for (const s of sparks) {
      s.life++; s.vy += .05; s.vx *= .985; s.vy *= .985; s.x += s.vx; s.y += s.vy;
      ctx.globalAlpha = Math.max(0, 1 - s.life / s.max); ctx.fillStyle = s.c;
      ctx.beginPath(); ctx.arc(s.x, s.y, 2.2, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life >= sparks[i].max) sparks.splice(i, 1);
    if (t - t0 < ms || sparks.length || rockets.length) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame);
}

// 加经验之后调用（app.js 的 addXP）：判断有没有跨过里程碑
function fxCheck(before, after, n, goalHit, rankUp) {
  const cross = FX_XP.find(v => before < v && after >= v);
  const st = typeof streak === 'function' ? streak() : 0;
  const stHit = goalHit && FX_STREAK.includes(st);
  if (rankUp) fxMilestone({ title: tj(`升级：${rankUp[1]}`, `ランクアップ：${rankUp[1]}`, `Rank up: ${(typeof enLookup === 'function' && rankUp[2] && enLookup(rankUp[2])) || rankUp[1]}`), sub: (typeof uiEn === 'function' && uiEn()) ? '' : rankUp[2] || '', xp: n, line: fxLine('rank'), badge: '⬆', mood: 'cheer' });
  if (cross) fxMilestone({ title: tj(`累计 ${cross} 经验！`, `累計 ${cross} XP 達成！`, `${cross} XP reached!`), sub: tj(`总经验 ${after}`, `これまでの合計 ${after} XP`, `Total: ${after} XP`), xp: n, line: fxLine(cross < 500 ? 'xpLow' : cross < 5000 ? 'xpMid' : 'xpHigh'), badge: '🔥', mood: cross < 500 ? 'wow' : 'cheer' });
  if (stHit) fxMilestone({ title: tj(`连续 ${st} 天！`, `${st} 日連続！`, `${st}-day streak!`), sub: tj('每天都来，真了不起', '毎日続けているあなたはすごい', 'Showing up every day is amazing.'), xp: n, line: fxLine('streak'), badge: '📅', mood: 'cheer' });
  else if (goalHit) fxMilestone({ title: tj('今日目标达成！', '今日の目標達成！', 'Daily goal reached!'), sub: tj(`连续 ${st} 天`, `${st} 日連続`, `${st}-day streak`), xp: n, line: fxLine('goal'), badge: '✓', mood: 'happy' });
}
