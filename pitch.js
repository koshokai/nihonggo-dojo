// 跟读的音高曲线对比：把自己的录音和标准录音的音高（声音高低的走势）画在同一张图上。
// 音高用自相关法逐帧估计（70–400 Hz），换算成相对于各自中位数的半音，所以男声女声也能直接比较。
let PITCH_CTX = null;
const pitchCtx = () => PITCH_CTX || (PITCH_CTX = new (window.AudioContext || window.webkitAudioContext)());
function pitchTrack(buf) {
  const x = buf.getChannelData(0), sr = buf.sampleRate, N = 2048, hop = 512;
  const minLag = Math.floor(sr / 400), maxLag = Math.floor(sr / 70), out = [];
  for (let s = 0; s + N < x.length; s += hop) {
    let rms = 0; for (let i = 0; i < N; i++) rms += x[s + i] * x[s + i];
    rms = Math.sqrt(rms / N);
    if (rms < .012) { out.push(null); continue; }
    let best = 0, lag = 0;
    for (let L = minLag; L <= maxLag; L++) {
      let c = 0, e1 = 0, e2 = 0;
      for (let i = 0; i < N - L; i += 2) { c += x[s + i] * x[s + i + L]; e1 += x[s + i] * x[s + i]; e2 += x[s + i + L] * x[s + i + L]; }
      const r = c / Math.sqrt(e1 * e2 + 1e-12);
      if (r > best) { best = r; lag = L; }
    }
    out.push(best > .55 ? sr / lag : null);
  }
  // 去掉前后的静音，中位数归一化成半音
  while (out.length && out[0] == null) out.shift();
  while (out.length && out[out.length - 1] == null) out.pop();
  const v = out.filter(Boolean).sort((a, b) => a - b), med = v[Math.floor(v.length / 2)] || 1;
  return out.map(f => f ? 12 * Math.log2(f / med) : null);
}
// 拉伸到 n 个点（线性插值，空白处保留为空）
function stretch(t, n = 120) { return Array.from({ length: n }, (_, i) => t[Math.round(i / (n - 1) * (t.length - 1))] ?? null); }
// 相似度：两条曲线在都有声音的地方的相关系数（看走势是否一致，不看绝对高低）
function pitchScore(a, b) {
  const pa = stretch(a), pb = stretch(b), xs = [], ys = [];
  for (let i = 0; i < pa.length; i++) if (pa[i] != null && pb[i] != null) { xs.push(pa[i]); ys.push(pb[i]); }
  if (xs.length < 15) return null;
  const m = v => v.reduce((s, x) => s + x, 0) / v.length, mx = m(xs), my = m(ys);
  let c = 0, ex = 0, ey = 0;
  for (let i = 0; i < xs.length; i++) { c += (xs[i] - mx) * (ys[i] - my); ex += (xs[i] - mx) ** 2; ey += (ys[i] - my) ** 2; }
  const r = c / Math.sqrt(ex * ey + 1e-9);
  return Math.max(0, Math.round(r * 100));
}
function drawPitch(cv, ref, mine) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, css = getComputedStyle(document.body);
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = css.getPropertyValue('--line').trim() || '#ddd'; ctx.lineWidth = 1;
  for (const y of [.25, .5, .75]) { ctx.beginPath(); ctx.moveTo(0, H * y); ctx.lineTo(W, H * y); ctx.stroke(); }
  const line = (t, color, width) => {
    const p = stretch(t); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath();
    let on = false;
    p.forEach((v, i) => { if (v == null) { on = false; return; } const X = i / (p.length - 1) * (W - 20) + 10, Y = H / 2 - Math.max(-12, Math.min(12, v)) / 12 * (H / 2 - 10); if (!on) { ctx.moveTo(X, Y); on = true; } else ctx.lineTo(X, Y); });
    ctx.stroke();
  };
  if (ref) line(ref, 'rgba(120,115,140,.55)', 7);
  if (mine) line(mine, css.getPropertyValue('--ai').trim() || '#E84A7F', 3.5);
}
const decodeAudio = b => new Promise((res, rej) => { const p = pitchCtx().decodeAudioData(b, res, rej); if (p && p.catch) p.catch(() => {}); });   // 新浏览器还会返回 Promise，接住免得报未处理的错误
const decodeBlob = blob => blob.arrayBuffer().then(decodeAudio);
const decodeUrl = url => fetch(url).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(decodeAudio);
// shadow.js 录完以后调用：box 里画图，refUrl 没有时只画自己的曲线
async function pitchCompare(box, blob, refUrl) {
  if (!box || !(window.AudioContext || window.webkitAudioContext)) return;
  box.hidden = false;
  const info = box.querySelector('[data-pinfo]'), cv = box.querySelector('canvas');
  info.textContent = tj('分析中……', '分析中…');
  try {
    const [mine, ref] = await Promise.all([decodeBlob(blob).then(pitchTrack), refUrl ? decodeUrl(refUrl).then(pitchTrack).catch(() => null) : Promise.resolve(null)]);
    drawPitch(cv, ref, mine);
    const sc = ref ? pitchScore(ref, mine) : null;
    info.innerHTML = ref
      ? `${tj('灰色＝标准录音，彩色＝你', 'グレー＝お手本、カラー＝あなた')}${sc != null ? ` · ${tj('音高走势相似度', '高低の一致度')} <b>${sc}%</b>${sc >= 75 ? tj('，很像！', '　そっくり！') : sc >= 50 ? tj('，再注意一下高低起伏', '　高低をもう少し意識して') : tj('，多听几遍标准录音的起伏', '　お手本の上がり下がりをよく聞いて')}` : ''}`
      : tj('这句没有标准录音，只显示你的音高曲线。', 'このお手本には録音がないので、あなたの声の高さだけ表示しています。');
  } catch (e) { info.textContent = tj('这个浏览器不能分析录音', 'このブラウザでは分析できません'); }
}
