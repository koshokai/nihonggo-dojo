// 分享图（1080×1350，小红书、朋友圈的竖图比例）：
//   shareCardCanvas()：学习成果（连续天数、经验、单词、印章、学习路线进度、最近 4 周的打卡）
//   shareCertCanvas()：毕业证书（学习路线里通过毕业测试以后）
// 图上只写「猫先生」这样的名字，不放二维码、网址和邮箱——微信、小红书会拦截或限流带这些的图片。
// 配色跟着在学的语言：日语樱花粉、英语天空蓝、中文朱红；吉祥物是猫（学中文是熊猫）。
const SC_THEME = {
  ja: { bg: ['#FFE3EE', '#F1DCF7'], main: '#D9578A', deep: '#9E2F5E', soft: '#FBE1EC', heat: ['#F3E2EA', '#F6B8CF', '#EA8BB0', '#D9578A'] },
  en: { bg: ['#DDEEFF', '#E3F7F1'], main: '#3F7FE0', deep: '#1F4FA3', soft: '#E2EDFC', heat: ['#E3EAF5', '#AFCBF4', '#7AA7EC', '#3F7FE0'] },
  zh: { bg: ['#FFE6DE', '#FFF1D9'], main: '#D9483B', deep: '#962A21', soft: '#FCE3DF', heat: ['#F4E4E1', '#F6B9AE', '#EC8577', '#D9483B'] }
};
const scTr = () => (S.track === 'en' || S.track === 'zh') ? S.track : 'ja';
// 图上的文字：中文板块的用户说日语，英语板块按母语，日语板块按界面语言
const scT = (tr, zh, ja) => tr === 'zh' ? ja : tr === 'en' ? (typeof enNat === 'function' ? enNat(zh, ja) : zh) : tj(zh, ja);
const scJa = tr => tr === 'zh' || (tr === 'en' ? typeof enJa === 'function' && enJa() : typeof uiJa === 'function' && uiJa());
const scFont = (tr, w, px) => `${w} ${px}px ${scJa(tr) ? '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans CJK JP","Yu Gothic","Meiryo"' : '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei"'},sans-serif`;
const scLevel = tr => tr === 'ja' ? S.level : tr === 'en' ? (typeof enLevel === 'function' ? enLevel() : 'A1') : (typeof zhLevel === 'function' ? zhLevel() : 'HSK1');
function scRound(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
// 吉祥物（mascot.js 的 SVG）画到图上
function scMascot(tr, mood = 'happy') {
  return new Promise(res => {
    if (typeof mascotSVG !== 'function') return res(null);
    const svg = mascotSVG(tr === 'zh' ? 'panda' : 'cat', mood, '').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="260" ');
    const img = new Image();
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
// 背景：渐变 + 几个柔和的光斑 + 细小的点
function scBackground(x, W, H, th) {
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  [[150, 160, 260, .35], [W - 120, 420, 220, .28], [180, H - 220, 300, .22], [W - 200, H - 120, 200, .3]].forEach(([cx, cy, r, a]) => {
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, `rgba(255,255,255,${a + .25})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  });
  x.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 70; i++) { const px = (i * 157) % W, py = (i * 331) % H, s = 2 + (i % 3); x.beginPath(); x.arc(px, py, s, 0, Math.PI * 2); x.fill(); }
}
function scCard(x, X, Y, W, H, r = 44) {
  x.save(); x.shadowColor = 'rgba(80,40,70,.16)'; x.shadowBlur = 40; x.shadowOffsetY = 14;
  x.fillStyle = 'rgba(255,255,255,.94)'; scRound(x, X, Y, W, H, r); x.fill(); x.restore();
}

// qr：二维码里的网址（带邀请码，invite.js）；不传就不画二维码
async function shareCardCanvas(qr) {
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d'), tr = scTr(), th = SC_THEME[tr], T = (zh, ja) => scT(tr, zh, ja), F = (w, px) => scFont(tr, w, px);
  const lv = scLevel(tr), lang = { ja: T('日语', '日本語'), en: T('英语', '英語'), zh: T('中文', '中国語') }[tr];
  scBackground(x, W, H, th);
  const img = await scMascot(tr, 'happy');
  // 顶部：吉祥物 + 名字 + 在学的语言和级别
  if (img) x.drawImage(img, 70, 42, 150, 162);
  x.textAlign = 'left'; x.fillStyle = th.deep; x.font = F(900, 68); x.fillText(BRAND, 240, 122);
  x.font = F(600, 34); x.fillStyle = th.main;
  const tag = `${lang} · ${lv}`, tw = x.measureText(tag).width + 44;
  x.fillStyle = 'rgba(255,255,255,.8)'; scRound(x, 240, 142, tw, 54, 27); x.fill();
  x.fillStyle = th.main; x.fillText(tag, 262, 181);
  // 白卡片
  const bx = 60, by = 230, bw = W - 120, bh = H - (qr ? 400 : 340);   // 带二维码时卡片短一点，底部放二维码
  scCard(x, bx, by, bw, bh);
  // 主数字：连续天数（渐变字）
  const s = streak();
  x.textAlign = 'center'; x.fillStyle = '#5E5260'; x.font = F(600, 42); x.fillText(T('🔥 连续学习', '🔥 連続学習'), W / 2, by + 95);
  const ng = x.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  ng.addColorStop(0, th.main); ng.addColorStop(1, th.deep);
  x.fillStyle = ng; x.font = F(900, 230); x.fillText(String(s), W / 2 - (s >= 100 ? 0 : 20), by + 310);
  const nw = x.measureText(String(s)).width;
  x.fillStyle = th.deep; x.font = F(800, 64); x.textAlign = 'left'; x.fillText(T('天', '日'), W / 2 - (s >= 100 ? 0 : 20) + nw / 2 + 14, by + 300);
  x.textAlign = 'center';
  // 三格统计
  const words = tr === 'ja' ? allVocab().filter(learned).length : Object.keys(S.srs).filter(id => id.startsWith(tr + '|') && S.srs[id].r > 0).length;
  const stats = [[T('累计经验', '累計 XP'), S.xp], [T('已学单词', '覚えた単語'), words], [T('获得印章', 'スタンプ'), Object.keys(S.badges || {}).length]];
  const tw3 = (bw - 120) / 3;
  stats.forEach(([t, v], i) => {
    const X = bx + 40 + i * (tw3 + 20), Y = by + 360;
    x.fillStyle = th.soft; scRound(x, X, Y, tw3, 150, 28); x.fill();
    x.fillStyle = th.deep; x.font = F(900, 64); x.fillText(String(v), X + tw3 / 2, Y + 82);
    x.fillStyle = '#7A6E80'; x.font = F(500, 30); x.fillText(t, X + tw3 / 2, Y + 124);
  });
  // 学习路线进度（path.js 记的「现在在哪一步」）
  const pc = (S.ptCur || {})[tr];
  let y = by + 580;
  if (pc && pc.lv === lv) {
    const done = pc.i >= pc.n, pct = done ? 1 : (pc.i + pc.p) / pc.n;
    x.textAlign = 'left'; x.fillStyle = '#3A2F38'; x.font = F(700, 38);
    x.fillText(done ? T(`🎓 ${lv} 已毕业`, `🎓 ${lv} 卒業`) : T(`📍 学习路线 · ${lv} 第 ${pc.i + 1} 步`, `📍 ロードマップ・${lv} ステップ ${pc.i + 1}`), bx + 60, y);
    x.textAlign = 'right'; x.fillStyle = th.main; x.font = F(800, 38); x.fillText(`${Math.round(pct * 100)}%`, bx + bw - 60, y);
    x.fillStyle = th.soft; scRound(x, bx + 60, y + 24, bw - 120, 26, 13); x.fill();
    const pg = x.createLinearGradient(bx + 60, 0, bx + bw - 60, 0); pg.addColorStop(0, th.main); pg.addColorStop(1, th.deep);
    x.fillStyle = pg; scRound(x, bx + 60, y + 24, Math.max(26, (bw - 120) * pct), 26, 13); x.fill();
    y += 110;
  } else y += 20;
  // 最近 4 周（像日历一样 7 列 × 4 行）和印章（最近得到的 6 枚，画成朱印）：有印章时左右并排，没有时打卡格居中
  const got = typeof BADGES !== 'undefined' ? BADGES.filter(b => S.badges && S.badges[b.id]).slice(-6) : [];
  const cell = 46, gap = 10, gridW = 7 * cell + 6 * gap, gridH = 4 * cell + 3 * gap;
  const gx = got.length ? bx + 70 : W / 2 - gridW / 2, gy = y + 26;
  x.textAlign = 'center'; x.fillStyle = '#7A6E80'; x.font = F(500, 30); x.fillText(T('最近 4 周', '直近 4 週間'), gx + gridW / 2, y);
  const end = new Date(); end.setHours(0, 0, 0, 0);
  for (let k = 0; k < 28; k++) {
    const d = new Date(end); d.setDate(d.getDate() - (27 - k));
    const v = S.days[dkey(d)] || 0, lvv = !v ? 0 : v < S.goal / 2 ? 1 : v < S.goal ? 2 : 3;
    const cx = gx + (k % 7) * (cell + gap), cy = gy + Math.floor(k / 7) * (cell + gap);
    x.fillStyle = th.heat[lvv]; scRound(x, cx, cy, cell, cell, 12); x.fill();
    if (k === 27) { x.strokeStyle = th.deep; x.lineWidth = 4; scRound(x, cx - 2, cy - 2, cell + 4, cell + 4, 14); x.stroke(); }
  }
  if (got.length) {
    const r = 40, sp = 16, cols = 3, sw = cols * r * 2 + (cols - 1) * sp, sx0 = bx + bw - 70 - sw;
    x.fillStyle = '#7A6E80'; x.font = F(500, 30); x.fillText(T('我的印章', 'スタンプ'), sx0 + sw / 2, y);
    const rows = Math.ceil(got.length / cols), sy0 = gy + (gridH - (rows * r * 2 + (rows - 1) * sp)) / 2;
    got.forEach((b, i) => {
      const cx = sx0 + r + (i % cols) * (r * 2 + sp), cy = sy0 + r + Math.floor(i / cols) * (r * 2 + sp);
      x.fillStyle = '#FFF6F2'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#C8372D'; x.lineWidth = 5; x.beginPath(); x.arc(cx, cy, r - 4, 0, Math.PI * 2); x.stroke();
      x.fillStyle = '#C8372D'; x.font = `900 40px "Hiragino Mincho ProN","Noto Serif CJK JP","Yu Mincho",serif`; x.textAlign = 'center'; x.fillText(b.ch, cx, cy + 14);
    });
  }
  // 底部：一句话和日期；带二维码时左边文字、右边二维码（扫码注册送 3 天会员）
  if (qr && typeof qrcode === 'function') {
    const qs = 140, qx = W - 60 - qs, qy = H - qs - 18;
    x.save(); x.shadowColor = 'rgba(80,40,70,.18)'; x.shadowBlur = 16; x.fillStyle = '#fff'; scRound(x, qx - 8, qy - 8, qs + 16, qs + 16, 16); x.fill(); x.restore();
    refDrawQR(x, qr, qx, qy, qs, '#2A2226');
    x.textAlign = 'left'; x.fillStyle = th.deep; x.font = F(700, 34);
    x.fillText(T(`每天十分钟，和我一起学${lang}`, `1 日 10 分、一緒に${lang}を学ぼう`), 70, H - 110);
    x.fillStyle = '#5E5260'; x.font = F(500, 28);
    x.fillText(T('扫码注册，送你 3 天会员 →', 'QR から登録で 3 日間メンバー →', 'Scan to sign up: 3 free days →'), 70, H - 66);
    x.fillStyle = '#7A6E80'; x.font = F(500, 24); x.fillText(dkey(), 70, H - 30);
    return c;
  }
  x.textAlign = 'center'; x.fillStyle = th.deep; x.font = F(600, 34);
  x.fillText(T(`每天十分钟，和我一起学${lang}`, `1 日 10 分、一緒に${lang}を学ぼう`), W / 2, H - 62);
  x.fillStyle = '#7A6E80'; x.font = F(500, 28); x.fillText(dkey(), W / 2, H - 22);
  return c;
}

// 毕业证书：tr 语言、lv 级别、pct 成绩（0–1）、at 通过时间
async function shareCertCanvas(tr, lv, pct, at, qr) {
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d'), th = SC_THEME[tr], T = (zh, ja) => scT(tr, zh, ja), F = (w, px) => scFont(tr, w, px);
  const serif = px => `900 ${px}px "Hiragino Mincho ProN","Noto Serif CJK JP","Noto Serif CJK SC","Yu Mincho","Songti SC",serif`;
  const lang = { ja: T('日语', '日本語'), en: T('英语', '英語'), zh: T('中文', '中国語') }[tr];
  // 纸张
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#FFFBF2'); g.addColorStop(1, '#F8EFDC');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // 金色双边框 + 四角花纹
  x.strokeStyle = '#C9A24A'; x.lineWidth = 10; scRound(x, 40, 40, W - 80, H - 80, 28); x.stroke();
  x.lineWidth = 3; scRound(x, 66, 66, W - 132, H - 132, 20); x.stroke();
  [[66, 66], [W - 66, 66], [66, H - 66], [W - 66, H - 66]].forEach(([cx, cy]) => { x.fillStyle = '#C9A24A'; x.beginPath(); x.arc(cx, cy, 14, 0, Math.PI * 2); x.fill(); x.fillStyle = '#FFFBF2'; x.beginPath(); x.arc(cx, cy, 6, 0, Math.PI * 2); x.fill(); });
  // 标题
  x.textAlign = 'center'; x.fillStyle = '#8A6A1F'; x.font = F(600, 36); x.fillText(BRAND, W / 2, 170);
  x.fillStyle = '#3A2F28'; x.font = serif(104); x.fillText(T('毕业证书', '卒業証書'), W / 2, 300);
  x.strokeStyle = '#C9A24A'; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2 - 220, 345); x.lineTo(W / 2 + 220, 345); x.stroke();
  // 级别（大）
  const ng = x.createLinearGradient(W / 2 - 250, 0, W / 2 + 250, 0); ng.addColorStop(0, th.main); ng.addColorStop(1, th.deep);
  x.fillStyle = '#6E6258'; x.font = F(600, 40); x.fillText(`${lang}`, W / 2, 440);
  x.fillStyle = ng; x.font = `900 ${lv.length > 3 ? 200 : 240}px "Avenir Next","Helvetica Neue",Arial,sans-serif`; x.fillText(lv, W / 2, 660);
  // 正文
  x.fillStyle = '#3A2F28'; x.font = F(500, 40);
  x.fillText(T('完成了这一级的全部学习阶段，', 'このレベルのすべてのステップを修了し、'), W / 2, 770);
  x.fillText(T(`并以 ${Math.round(pct * 100)}% 的成绩通过毕业测试。`, `卒業テストに ${Math.round(pct * 100)}% で合格しました。`), W / 2, 830);
  // 吉祥物 + 朱印
  const img = await scMascot(tr, 'wow');
  if (img) x.drawImage(img, W / 2 - 300, 900, 200, 216);
  const sx = W / 2 + 200, sy = 1010;
  x.save(); x.translate(sx, sy); x.rotate(-0.12);
  x.strokeStyle = '#C8372D'; x.lineWidth = 8; scRound(x, -95, -95, 190, 190, 22); x.stroke();
  x.fillStyle = '#C8372D'; x.font = serif(86); x.fillText(T('合格', '合格'), 0, 32);
  x.restore();
  x.fillStyle = '#6E6258'; x.font = F(500, 34); x.fillText(dkey(new Date(at || Date.now())), W / 2, 1200);
  if (qr && typeof qrcode === 'function') { refDrawQR(x, qr, 104, 1126, 120, '#3A2F28'); x.fillStyle = '#8A6A1F'; x.font = F(500, 20); x.textAlign = 'center'; x.fillText(T('扫码一起学', 'QR で一緒に', 'Scan to join'), 164, 1268); }
  x.textAlign = 'center';
  x.fillStyle = '#8A6A1F'; x.font = F(600, 32); x.fillText(T(`下一站：${typeof ptNextLv === 'function' && ptNextLv(tr, lv) ? ptNextLv(tr, lv) : '继续进阶'}`, `次の目標：${typeof ptNextLv === 'function' && ptNextLv(tr, lv) ? ptNextLv(tr, lv) : 'さらに上へ'}`), W / 2, 1250);
  return c;
}

// 分享图上的二维码：带我的邀请码的网址（没登录就只放网站地址）；用户关掉了就不放
async function scQR() {
  if (S.shareNoQR || typeof refQRLib !== 'function') return '';
  try { await refQRLib(); } catch (e) { return ''; }
  const code = typeof refMyCode === 'function' ? await refMyCode().catch(() => '') : '';
  return refLink(code);
}
// 把画好的图显示出来：系统分享 / 保存
function shareCanvasOut(out, c, name, tr = scTr()) {
  const T = (zh, ja) => scT(tr, zh, ja);
  c.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob), file = new File([blob], `${name}-${dkey()}.png`, { type: 'image/png' });
    out.innerHTML = `<img class="share-img" src="${url}" alt="${esc(name)}">
      <div class="row">${navigator.canShare && navigator.canShare({ files: [file] }) ? `<button class="btn pri" type="button" data-sys>${T('分享图片', '画像をシェア')}</button>` : ''}<a class="btn" href="${url}" download="${file.name}">${T('保存图片', '画像を保存')}</a></div>
      <p class="small muted">${T('手机上也可以长按图片保存。', 'スマートフォンでは画像を長押しして保存することもできます。')}</p>`;
    const sys = out.querySelector('[data-sys]');
    if (sys) sys.onclick = () => navigator.share({ files: [file] }).catch(() => {});
  }, 'image/png');
}

function sharePanel() {
  const brand = BRAND;
  const p = h(`<section class="panel"><h2>${tj('分享学习成果', '学習の記録をシェア')}</h2>
    <p class="small muted">${tj(`生成一张打卡图，可以发朋友圈、小红书。图上只有「${brand}」和你的学习数据，没有二维码和网址，不会被平台拦截。`, `学習記録の画像を作って、SNS でシェアできます。画像には「${brand}」とあなたの学習データだけが入り、QR コードや URL は入りません。`)}</p>
    <div class="row"><button class="btn pri" type="button" data-link>${tj('分享我的学习页', '学習ページをシェア')}</button><button class="btn" type="button" data-card>${tj('生成打卡图', '画像を作成')}</button></div>
    <label class="small sc-qr"><input type="checkbox" data-qr ${S.shareNoQR ? '' : 'checked'}> ${tj('图上带二维码（带你的邀请码：朋友扫码注册送 3 天，学满 3 天你得一周会员）', '画像に QR コードを入れる（招待コードつき：友だちは 3 日間、友だちが 3 日学ぶとあなたに 1 週間）')}</label>
    <p class="small muted">${tj('微信、小红书有时会限流带二维码的图片，发不出去时取消勾选再生成一次。', 'SNS によっては QR コード入りの画像が表示されにくいことがあります。うまく投稿できないときはチェックを外してください。')}</p>
    <p class="small muted">${tj('「学习页」是一个链接：朋友打开就能看到你学了多少（连续天数、级别、最近 4 周的记录），不用注册。', '「学習ページ」はリンクです。友だちが開くと、あなたの学習記録（連続日数・レベル・直近 4 週間）が見られます（登録不要）。')}</p>
    <div data-out></div></section>`);
  p.querySelector('[data-link]').onclick = () => shareMyPage();
  p.querySelector('[data-qr]').onchange = e => { S.shareNoQR = !e.target.checked; save(); };
  p.querySelector('[data-card]').onclick = async () => {
    const out = p.querySelector('[data-out]');
    out.innerHTML = '<div class="skel" role="status"><i></i><i></i></div>';
    shareCanvasOut(out, await shareCardCanvas(await scQR()), tj('打卡', 'study'));
  };
  return p;
}

// 分享「我的学习页」链接：手机上用系统分享，电脑上复制。text 不传就用默认的一句（水平测试的结果页也用这个）
async function shareMyPage(text) {
  const brand = BRAND, url = shareLink();
  text = text || tje(`我在${brand}已经坚持学了 ${streak()} 天，一起来学吧！`, `${brand}で ${streak()} 日続けて勉強中。一緒にやってみない？`, `I've studied on ${brand} for ${streak()} days in a row. Join me!`);
  if (navigator.share) { try { await navigator.share({ title: brand, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast(tje('链接已复制，可以粘贴发给朋友', 'リンクをコピーしました。友だちに送ってください', 'Link copied — paste it to a friend')); } catch (e) { prompt(tje('复制这个链接发给朋友', 'このリンクをコピーして送ってください', 'Copy this link'), url); }
}
