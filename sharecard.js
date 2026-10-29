// 学习成果分享图：连续天数、经验、段位、已学单词、印章，画在 1080×1350 的图上（小红书、朋友圈的竖图比例）。
// 图上只写「日语道场」这样的名字，不放二维码、网址和邮箱——微信、小红书会拦截或限流带这些的图片。
function shareCardCanvas() {
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const tr = S.track || 'ja', brand = { ja: '日语道场', ko: '韩语道场', en: '英语道场' }[tr];
  const font = (w, px) => `${w} ${px}px "PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",sans-serif`;
  // 背景
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#FCE4EC'); g.addColorStop(1, '#F3D1E4');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,.75)';
  const r = 48, bx = 70, by = 150, bw = W - 140, bh = H - 300;
  x.beginPath(); x.moveTo(bx + r, by); x.arcTo(bx + bw, by, bx + bw, by + bh, r); x.arcTo(bx + bw, by + bh, bx, by + bh, r); x.arcTo(bx, by + bh, bx, by, r); x.arcTo(bx, by, bx + bw, by, r); x.fill();
  // 标题
  x.fillStyle = '#D9578A'; x.font = font(800, 64); x.textAlign = 'center';
  x.fillText(`🌸 ${brand}`, W / 2, 105);
  // 主数字：连续天数
  const s = streak(), ri = rankOf(S.xp), rk = RANKS[ri];
  x.fillStyle = '#2A2226'; x.font = font(600, 46); x.fillText('连续学习', W / 2, by + 120);
  x.fillStyle = '#D9578A'; x.font = font(900, 240); x.fillText(String(s), W / 2, by + 360);
  x.fillStyle = '#2A2226'; x.font = font(600, 56); x.fillText('天', W / 2, by + 440);
  // 三格统计
  const words = tr === 'ja' ? allVocab().filter(learned).length : Object.keys(S.srs).filter(id => id.startsWith(tr + '|') && S.srs[id].r > 0).length;
  const stats = [['累计经验', S.xp], ['已学单词', words], ['获得印章', Object.keys(S.badges || {}).length]];
  stats.forEach(([t, v], i) => {
    const cx = bx + bw / 6 * (i * 2 + 1);
    x.fillStyle = '#D9578A'; x.font = font(800, 72); x.fillText(String(v), cx, by + 610);
    x.fillStyle = '#7A6E80'; x.font = font(500, 36); x.fillText(t, cx, by + 665);
  });
  // 段位
  x.fillStyle = '#2A2226'; x.font = font(700, 44); x.fillText(`当前段位：${rk[1]}（${rk[2]}）`, W / 2, by + 790);
  // 最近 4 周热力
  const cell = 24, gap = 7, cols = 28, startX = W / 2 - (cols * (cell + gap) - gap) / 2, y0 = by + 850;
  const end = new Date(); end.setHours(0, 0, 0, 0);
  for (let i = 0; i < cols; i++) {
    const d = new Date(end); d.setDate(d.getDate() - (cols - 1 - i));
    const v = S.days[dkey(d)] || 0, lv = !v ? 0 : v < S.goal / 2 ? 1 : v < S.goal ? 2 : 3;
    x.fillStyle = ['#F1DDE5', '#F4B3CB', '#E886AC', '#D9578A'][lv];
    x.fillRect(startX + i * (cell + gap), y0, cell, cell);
  }
  x.fillStyle = '#7A6E80'; x.font = font(500, 30); x.fillText('最近 4 周 · 每一格是一天', W / 2, y0 + 70);
  // 底部：只写名字和日期
  x.fillStyle = '#7A6E80'; x.font = font(500, 34);
  x.fillText(`${dkey()} · 每天十分钟，和我一起学${{ ja: '日语', ko: '韩语', en: '英语' }[tr]}`, W / 2, H - 70);
  return c;
}

function sharePanel() {
  const p = h(`<section class="panel"><h2>分享学习成果</h2>
    <p class="small muted">生成一张打卡图，可以发朋友圈、小红书。图上只有「${{ ja: '日语道场', ko: '韩语道场', en: '英语道场' }[S.track || 'ja']}」和你的学习数据，没有二维码和网址，不会被平台拦截。</p>
    <div class="row"><button class="btn pri" type="button" data-card>生成打卡图</button></div><div data-out></div></section>`);
  p.querySelector('[data-card]').onclick = () => {
    const c = shareCardCanvas(), out = p.querySelector('[data-out]');
    c.toBlob(blob => {
      const url = URL.createObjectURL(blob), file = new File([blob], `打卡-${dkey()}.png`, { type: 'image/png' });
      out.innerHTML = `<img class="share-img" src="${url}" alt="打卡图">
        <div class="row">${navigator.canShare && navigator.canShare({ files: [file] }) ? '<button class="btn pri" type="button" data-sys>分享图片</button>' : ''}<a class="btn" href="${url}" download="${file.name}">保存图片</a></div>
        <p class="small muted">手机上也可以长按图片保存。</p>`;
      const sys = out.querySelector('[data-sys]');
      if (sys) sys.onclick = () => navigator.share({ files: [file] }).catch(() => {});
    }, 'image/png');
  };
  return p;
}
