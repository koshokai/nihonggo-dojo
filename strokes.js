// 汉字笔顺动画（KanjiVG，CC BY-SA 3.0）和单词音调（Kanjium，CC BY-SA 4.0）。
// 笔画数据 lang/kv/<码点>.json 用到才加载；音调表 lang/ja-accent.json 启动后在后台加载（约 170 KB）。
const KV = {};
const kvLoad = k => KV[k] ? Promise.resolve(KV[k]) : fetch(`lang/kv/${k.codePointAt(0).toString(16).padStart(5, '0')}.json`).then(r => r.ok ? r.json() : null).then(d => (KV[k] = d));
// 一笔一笔画出来：pathLength=1 + 虚线偏移动画，按顺序延迟
function strokeSVG(paths, speed = 0.5) {
  return `<svg class="kv-svg" viewBox="0 0 109 109" role="img" aria-label="笔顺动画"><g class="kv-bg">${paths.map(d => `<path d="${d}"/>`).join('')}</g>
    <g class="kv-fg">${paths.map((d, i) => `<path d="${d}" pathLength="1" style="animation-delay:${(i * speed).toFixed(2)}s;animation-duration:${(speed * .9).toFixed(2)}s"/>`).join('')}</g></svg>`;
}
// 把汉字大字换成笔顺动画，点一下重播
function strokeInto(el, k) {
  kvLoad(k).then(d => {
    if (!d || !d.s.length || !el.isConnected) return;
    el.innerHTML = strokeSVG(d.s);
    el.title = `${d.s.length} 画 · 点击重播笔顺`;
    el.classList.add('kv-on');
    el.onclick = () => { const svg = el.querySelector('svg'); if (svg) svg.replaceWith(h(strokeSVG(d.s))); };
  }).catch(() => {});
}

let ACCENT = null;
setTimeout(() => fetch('lang/ja-accent.json').then(r => r.ok ? r.json() : {}).then(d => { ACCENT = d; }).catch(() => {}), 1500);
const SMALL_KANA = /[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ]/;
const morae = r => { const out = []; for (const c of r) { if (SMALL_KANA.test(c) && out.length) out[out.length - 1] += c; else out.push(c); } return out; };
// 读音上画音调线：高的拍上面有横线，下降的地方有一个折角（0 平板、1 头高、n 第 n 拍后下降）
function pitchHTML(w, r) {
  const n = ACCENT && ACCENT[`${w}|${r}`];
  if (n == null || /[^ぁ-んァ-ンー]/.test(r)) return esc(r);
  const m = morae(r);
  const hi = i => n === 0 ? i > 0 : n === 1 ? i === 0 : i > 0 && i < n;
  const type = n === 0 ? '平板' : n === 1 ? '头高' : n === m.length ? '尾高' : '中高';
  return `<span class="pitch" title="音调：${type}型（${n}）">${m.map((x, i) => `<span class="${hi(i) ? 'hi' : 'lo'}${n > 0 && i === n - 1 ? ' dn' : ''}${i > 0 && hi(i) && !hi(i - 1) ? ' up' : ''}">${esc(x)}</span>`).join('')}<sup class="pitch-n">${n}</sup></span>`;
}
