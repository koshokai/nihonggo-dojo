// 假名（和汉字）的写字画板：看笔顺动画，或者跟着一笔一笔写；每一笔比对位置、方向和形状，写对了变彩色。
// 笔画数据：KanjiVG（CC BY-SA 3.0），lang/kv/<码点>.json，坐标系 109×109（strokes.js 的 kvLoad）。
// 只在点「写一写」时才弹出，关掉就没了，平时不占屏幕。
const PAD = 260, KVS = 109;

// 沿着一条 SVG 路径均匀取 n 个点
function pathPoints(d, n = 24) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d); svg.append(p); svg.style.position = 'absolute'; svg.style.width = svg.style.height = '0'; document.body.append(svg);
  const L = p.getTotalLength(), out = [];
  for (let i = 0; i < n; i++) { const q = p.getPointAtLength(L * i / (n - 1)); out.push([q.x, q.y]); }
  svg.remove();
  return out;
}
// 手写的折线按长度重新均匀取 n 个点
function resample(pts, n = 24) {
  if (pts.length < 2) return null;
  const seg = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = seg[seg.length - 1]; if (L < 3) return null;
  const out = [];
  for (let i = 0, j = 0; i < n; i++) {
    const t = L * i / (n - 1);
    while (j < seg.length - 2 && seg[j + 1] < t) j++;
    const k = (t - seg[j]) / Math.max(1e-6, seg[j + 1] - seg[j]);
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * k, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * k]);
  }
  return out;
}
// 一笔写得对不对：平均偏差、起点、终点都在范围内（坐标 109 制；短的笔画放宽一点）
function strokeMatch(drawn, d) {
  const a = resample(drawn), b = pathPoints(d);
  if (!a) return false;
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const len = b.slice(1).reduce((s, q, i) => s + dist(q, b[i]), 0), tol = len < 25 ? 1.35 : 1;
  const avg = a.reduce((s, p, i) => s + dist(p, b[i]), 0) / a.length;
  return avg < 13 * tol && dist(a[0], b[0]) < 20 * tol && dist(a[a.length - 1], b[b.length - 1]) < 24 * tol;
}

function writePad(text, opts = {}) {
  const chars = [...text].filter(c => /[ぁ-ヿ一-鿿]/.test(c));
  if (!chars.length) return;
  let k = 0, data = null, mode = 'view', step = 0, misses = 0, guide = S.padGuide !== false, drawing = null;
  const J = typeof uiJa === 'function' && uiJa();
  const m = h(`<div class="ask-mask pad-mask" role="dialog" aria-modal="true" aria-label="${J ? '書き方' : '写法'}"><div class="ask-box pad-box">
    <div class="row between"><b>${J ? '書き方' : '写一写'}</b><button class="ws-x" type="button" aria-label="${J ? '閉じる' : '关闭'}" data-x>×</button></div>
    ${chars.length > 1 ? `<div class="row pad-tabs">${chars.map((c, i) => `<button type="button" class="chip-btn" data-k="${i}" lang="ja">${esc(c)}</button>`).join('')}</div>` : ''}
    <div class="pad-area" data-area><svg class="pad-svg" viewBox="0 0 ${KVS} ${KVS}" data-svg></svg><canvas class="pad-cv" width="${PAD * 2}" height="${PAD * 2}" data-cv></canvas></div>
    <div class="small muted center" data-info></div>
    <div class="row pad-btns"><button class="btn" type="button" data-anim>▶ ${J ? '書き順' : '看笔顺'}</button><button class="btn pri" type="button" data-write>✍ ${J ? 'なぞって書く' : '跟着写'}</button>
      <button class="btn ghost" type="button" data-guide>${guide ? (J ? 'お手本 オン' : '描红 开') : (J ? 'お手本 オフ' : '描红 关')}</button></div>
  </div></div>`);
  document.body.append(m);
  const svg = m.querySelector('[data-svg]'), cv = m.querySelector('[data-cv]'), ctx = cv.getContext('2d'), info = m.querySelector('[data-info]');
  const css = getComputedStyle(document.body), ACC = css.getPropertyValue('--ai').trim() || '#E84A7F', INK = css.getPropertyValue('--ink').trim() || '#1E1B36';
  const close = () => { m.remove(); if (typeof applyTheme === 'function') applyTheme(); };
  m.querySelector('[data-x]').onclick = close;
  m.onclick = e => { if (e.target === m) close(); };
  const getSvg = () => m.querySelector('[data-svg]');
  const show = i => {
    k = i; step = 0; misses = 0; mode = 'view';
    m.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', +b.dataset.k === k));
    ctx.clearRect(0, 0, cv.width, cv.height);
    info.textContent = J ? '読み込み中……' : '加载中……';
    kvLoad(chars[k]).then(d => {
      if (!d || !d.s.length) { info.textContent = J ? 'この字の書き順データはありません' : '这个字还没有笔顺数据'; return; }
      data = d;
      const s = getSvg(); s.outerHTML = strokeSVG(d.s, .55).replace('class="kv-svg"', 'class="pad-svg kv-svg" data-svg');
      info.textContent = `${chars[k]}　${J ? `全 ${d.s.length} 画` : `共 ${d.s.length} 画`}`;
    }).catch(() => { info.textContent = J ? '読み込めませんでした' : '加载失败'; });
  };
  const restoreSvg = () => { const s = getSvg(); if (!s.classList.contains('pad-plain')) s.outerHTML = `<svg class="pad-svg pad-plain" viewBox="0 0 ${KVS} ${KVS}" data-svg></svg>`; };
  const paintW = (hint = -1) => {   // 写字模式的画面
    restoreSvg();
    const s = getSvg(), st = data.s;
    s.innerHTML = `<g class="pad-ghost" ${guide ? '' : 'style="display:none"'}>${st.map(d => `<path d="${d}"/>`).join('')}</g>
      <g class="pad-done">${st.slice(0, step).map(d => `<path d="${d}" stroke="${ACC}"/>`).join('')}</g>
      ${hint >= 0 ? `<path class="pad-hint" d="${st[hint]}" pathLength="1"/>` : ''}
      ${step < st.length ? (() => { const p0 = pathPoints(st[step], 2)[0]; return `<circle cx="${p0[0]}" cy="${p0[1]}" r="3.4" class="pad-start"/><text x="${p0[0] + 4.5}" y="${p0[1] - 3}" class="pad-num">${step + 1}</text>`; })() : ''}`;
  };
  m.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => show(+b.dataset.k); });
  m.querySelector('[data-anim]').onclick = () => { if (data) { mode = 'view'; ctx.clearRect(0, 0, cv.width, cv.height); const s = getSvg(); s.outerHTML = strokeSVG(data.s, .55).replace('class="kv-svg"', 'class="pad-svg kv-svg" data-svg'); info.textContent = `${chars[k]}　${J ? `全 ${data.s.length} 画` : `共 ${data.s.length} 画`}`; } };
  m.querySelector('[data-write]').onclick = () => {
    if (!data) return;
    mode = 'write'; step = 0; misses = 0; ctx.clearRect(0, 0, cv.width, cv.height);
    paintW();
    info.textContent = J ? '番号の位置から、1 画ずつ書いてください' : '从标着数字的地方开始，一笔一笔写';
  };
  m.querySelector('[data-guide]').onclick = e => {
    guide = !guide; S.padGuide = guide; save();
    e.target.textContent = guide ? (J ? 'お手本 オン' : '描红 开') : (J ? 'お手本 オフ' : '描红 关');
    if (mode === 'write') paintW();
  };
  // 手写：在画布上画线，抬笔时判断
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * KVS, (e.clientY - r.top) / r.height * KVS]; };
  cv.addEventListener('pointerdown', e => {
    if (mode !== 'write' || !data || step >= data.s.length) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    drawing = [pos(e)];
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.lineWidth = 9; ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
  });
  cv.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = pos(e), q = drawing[drawing.length - 1]; drawing.push(p);
    const sc = cv.width / KVS;
    ctx.beginPath(); ctx.moveTo(q[0] * sc, q[1] * sc); ctx.lineTo(p[0] * sc, p[1] * sc); ctx.stroke();
  });
  const up = () => {
    if (!drawing) return;
    const pts = drawing; drawing = null;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (pts.length < 3) return;
    if (strokeMatch(pts, data.s[step])) {
      step++; buzz(10);
      if (step >= data.s.length) {
        paintW();
        const good = misses === 0, msg = good ? (J ? '完璧！' : '完美！一笔都没错。') : (J ? `書けました！（ミス ${misses} 回）` : `写好了！（错了 ${misses} 次）`);
        info.textContent = msg; if (typeof addXP === 'function') addXP(good ? 5 : 3);
        if (typeof popFrom === 'function') popFrom(m.querySelector('[data-area]'));
        if (k < chars.length - 1) setTimeout(() => show(k + 1), 900);
        return;
      }
      paintW();
      info.textContent = J ? `いいね！次は ${step + 1} 画目` : `对了！接下来第 ${step + 1} 画`;
    } else {
      misses++; buzz([20, 40, 20]);
      paintW(step);   // 闪一下正确的这一笔
      info.textContent = J ? `${step + 1} 画目の書き始めと向きを確認して、もう一度` : `看一下第 ${step + 1} 画从哪里起笔、往哪边写，再试一次`;
      setTimeout(() => { if (mode === 'write' && m.isConnected) paintW(); }, 1100);
    }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  show(0);
  if (opts.write) setTimeout(() => m.querySelector('[data-write]').click(), 400);
}

// 五十音图：点假名时（照常发音）从底部弹出小卡片：大字、读音、「写一写」
function kanaSheet(kana, roma) {
  closeSheet();
  const other = /[ァ-ヿ]/.test(kana) ? kana.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)) : kana.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const sh = h(`<div class="word-sheet kana-sheet" role="dialog" aria-label="假名">
    <button class="ws-x" type="button" aria-label="关闭">×</button>
    <div class="row"><span class="kana-big" lang="ja">${esc(kana)}</span><div><b>${esc(roma)}</b><div class="small muted">${/[ァ-ヿ]/.test(kana) ? '平假名' : '片假名'}：<span lang="ja">${esc(other)}</span></div></div>${speakBtn(kana)}</div>
    <div class="row"><button class="btn pri" type="button" data-pad>✍ 写一写</button><button class="btn" type="button" data-anim>▶ 看笔顺</button></div>
  </div>`);
  document.body.append(sh);
  sh.querySelector('.ws-x').onclick = closeSheet;
  sh.querySelector('[data-pad]').onclick = () => { closeSheet(); writePad(kana, { write: true }); };
  sh.querySelector('[data-anim]').onclick = () => { closeSheet(); writePad(kana); };
}
