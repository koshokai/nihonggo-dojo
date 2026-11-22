'use strict';
/* 每日宣传素材（promo.html）：把当天的「今日一句」画成 1080×1350 的图（小红书 / Instagram 的竖图比例）+ 写好配文。
   四张：今日日语（给中国人，发小红书）、今日の中国語 / 今日の英語（给日本人，发 Instagram / LINE VOOM）、今日英语（给中国人）。
   数据：daily.js（日语）、lang/zh-daily.json、lang/en-daily.json，按「闰年里的第几天」取，和 App 里同一天的一句一样。 */
const PM_SITE = 'koshokai.github.io/nihonggo-dojo';
const PM_LINE = 'https://lin.ee/qc9ktGX';   // LINE 官方账号（日本用户）
const PM_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const pmSlot = d => PM_LEAP.slice(0, d.getMonth()).reduce((a, b) => a + b, 0) + d.getDate() - 1;
const pmKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const PM_JP = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans CJK JP","Yu Gothic","Meiryo",sans-serif';
const PM_CN = '"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
const PM_THEME = {
  ja: { bg: ['#FFE3EE', '#F1DCF7'], main: '#D9578A', deep: '#9E2F5E', soft: '#FBE1EC' },
  en: { bg: ['#DDEEFF', '#E3F7F1'], main: '#3F7FE0', deep: '#1F4FA3', soft: '#E2EDFC' },
  zh: { bg: ['#FFE6DE', '#FFF1D9'], main: '#D9483B', deep: '#962A21', soft: '#FCE3DF' }
};
let pmZh = null, pmEn = null;

function pmRound(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }
function pmMascot(who) {
  return new Promise(res => {
    if (typeof mascotSVG !== 'function') return res(null);
    const svg = mascotSVG(who, 'happy', '').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="260" ');
    const img = new Image();
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
// 换行：英文按单词，中日文按字；句读符号不放行首
function pmWrap(x, text, maxW) {
  const toks = String(text || '').match(/[A-Za-z0-9'’.,!?;:\-–()"“”%$&/]+\s*|\s+|./gu) || [];
  const lines = []; let cur = '';
  for (const t of toks) {
    if (cur && x.measureText(cur + t).width > maxW && !/^[，。、！？：；」』）》,.!?)\]]/.test(t)) { lines.push(cur.trimEnd()); cur = t.trimStart(); }
    else cur += t;
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  return lines;
}
// 写一段字，返回下一行的 y；maxLines 超出就截断加「…」
function pmText(x, text, X, Y, maxW, lh, maxLines = 99) {
  let lines = pmWrap(x, text, maxW);
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/u, '…'); }
  lines.forEach((l, i) => x.fillText(l, X, Y + i * lh));
  return Y + lines.length * lh;
}

// c：{ tr（配色）, who（吉祥物）, font, head（左上角标签）, phrase, read, mean, note, ex, exRead, exMean, foot }
async function pmCanvas(c) {
  const W = 1080, H = 1350, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d'), th = PM_THEME[c.tr], F = (w, px) => `${w} ${px}px ${c.font}`;
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  [[150, 160, 260, .35], [W - 120, 420, 220, .28], [180, H - 220, 300, .22], [W - 200, H - 120, 200, .3]].forEach(([cx, cy, r, a]) => {
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, `rgba(255,255,255,${a + .25})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  });
  x.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 70; i++) { x.beginPath(); x.arc((i * 157) % W, (i * 331) % H, 2 + (i % 3), 0, Math.PI * 2); x.fill(); }
  // 顶部：吉祥物 + 名字 + 标签（今日日语 · 11月23日）
  const img = await pmMascot(c.who);
  if (img) x.drawImage(img, 64, 40, 150, 162);
  x.textAlign = 'left'; x.fillStyle = th.deep; x.font = F(900, 66); x.fillText('猫先生', 236, 118);
  x.font = F(700, 34); const tw = x.measureText(c.head).width + 48;
  x.fillStyle = 'rgba(255,255,255,.85)'; pmRound(x, 236, 140, tw, 56, 28); x.fill();
  x.fillStyle = th.main; x.fillText(c.head, 260, 180);
  // 白卡片
  const CX = 64, CY = 236, CW = W - 128, CH = H - 236 - 150, PX = CX + 64, PW = CW - 128;
  x.save(); x.shadowColor = 'rgba(80,40,70,.16)'; x.shadowBlur = 40; x.shadowOffsetY = 14;
  x.fillStyle = 'rgba(255,255,255,.95)'; pmRound(x, CX, CY, CW, CH, 48); x.fill(); x.restore();
  // 内容排版：先按字号比例 k 量出总高度，放不下就缩小、空太多就放大，最后在卡片里上下居中
  const IW = PW - 48;
  const layout = k => {
    const ops = []; let y = 0;
    const put = (text, w, size, color, lh, max, X = PX, MW = PW) => {
      x.font = F(w, size); let ls = pmWrap(x, text, MW);
      if (ls.length > max) { ls = ls.slice(0, max); ls[max - 1] = ls[max - 1].replace(/.$/u, '…'); }
      ls.forEach((l, i) => ops.push({ t: l, f: F(w, size), c: color, X, y: y + size + i * lh }));
      y += size + (ls.length - 1) * lh + (lh - size);
    };
    let pz = Math.round(Math.min(120, 96 * k)), pl;
    do { x.font = F(900, pz); pl = pmWrap(x, c.phrase, PW); if (pl.length <= 2 || pz <= 56) break; pz -= 4; } while (true);
    put(c.phrase, 900, pz, '#2A2226', Math.round(pz * 1.18), 3);
    if (c.read) { y += 14 * k; put(c.read, 500, Math.round(36 * k), th.main, Math.round(46 * k), 2); }
    y += 22 * k; put('＝ ' + c.mean, 800, Math.round(46 * k), th.deep, Math.round(58 * k), 2);
    y += 36 * k; ops.push({ line: true, y }); y += 6 + 34 * k;
    if (c.note) put(c.note, 400, Math.round(34 * k), '#4A4044', Math.round(52 * k), 6);
    if (c.ex) {
      y += 44 * k; const top = y; y += 28 * k;
      put(c.exLabel || '例句', 800, Math.round(28 * k), th.main, Math.round(40 * k), 1, PX + 24, IW);
      y += 8 * k; put(c.ex, 700, Math.round(36 * k), '#2A2226', Math.round(48 * k), 3, PX + 24, IW);
      if (c.exRead) { y += 6 * k; put(c.exRead, 400, Math.round(28 * k), th.main, Math.round(38 * k), 2, PX + 24, IW); }
      y += 10 * k; put(c.exMean, 400, Math.round(30 * k), '#6A5F64', Math.round(42 * k), 2, PX + 24, IW);
      y += 30 * k; ops.unshift({ box: true, y: top, h: y - top });
    }
    return { ops, h: y };
  };
  const room = CH - 120;
  let k = 1.3, L = layout(k);
  while (L.h > room && k > .7) { k -= .05; L = layout(k); }
  const top = CY + Math.max(60, (CH - L.h) / 2);
  for (const o of L.ops) {
    if (o.box) { x.fillStyle = th.soft; pmRound(x, PX, top + o.y, PW, o.h, 28); x.fill(); }
    else if (o.line) { x.fillStyle = th.soft; pmRound(x, PX, top + o.y, PW, 6, 3); x.fill(); }
    else { x.font = o.f; x.fillStyle = o.c; x.fillText(o.t, o.X, top + o.y); }
  }
  // 底部
  x.textAlign = 'center'; x.fillStyle = th.deep; x.font = F(800, 38); x.fillText(c.foot, W / 2, H - 82);
  x.font = F(500, 28); x.fillStyle = th.main; x.fillText(PM_SITE, W / 2, H - 38);
  return cv;
}

function pmCards(d) {
  const i = pmSlot(d), m = d.getMonth() + 1, dd = d.getDate(), out = [];
  const ja = typeof DAILY !== 'undefined' && DAILY.length ? DAILY[i % DAILY.length] : null;   // [日语, 读音, 中文, 解说, 例句, 例句假名, 例句中文, …]
  const zh = pmZh && pmZh[i % pmZh.length], en = pmEn && pmEn[i % pmEn.length];
  if (ja) out.push({ id: 'ja-cn', name: '今日日语（小红书）', tr: 'ja', who: 'cat', font: PM_JP, head: `今日日语 · ${m}月${dd}日`, phrase: ja[0], read: ja[1] !== ja[0] ? ja[1] : '', mean: ja[2], note: ja[3], ex: ja[4], exRead: ja[5], exMean: ja[6], exLabel: '例句', foot: '每天 10 分钟，日语・英语・中文',
    cap: `今日日语｜${ja[0]} = ${ja[2]}\n\n📌 ${ja[0]}${ja[1] !== ja[0] ? `（${ja[1]}）` : ''}\n= ${ja[2]}\n\n${ja[3]}\n\n例句：${ja[4]}\n${ja[6]}\n\n每天一句，评论区打卡「${ja[0]}」💪\n猫先生：每天 10 分钟学日语（App Store 搜「猫先生」）\n\n#日语 #日语学习 #每日日语 #日语入门 #学日语 #日语口语 #自学日语` });
  if (zh) out.push({ id: 'zh-jp', name: '今日の中国語（Instagram / LINE VOOM）', tr: 'zh', who: 'panda', font: PM_CN, head: `今日の中国語 · ${m}月${dd}日`, phrase: zh[0], read: zh[1], mean: zh[2], note: zh[3], ex: zh[5], exRead: zh[6], exMean: zh[7], exLabel: '例文', foot: '1日10分、中国語・英語・日本語',
    cap: `今日の中国語｜${zh[0]}（${zh[1]}）＝${zh[2]}\n\n${zh[3]}\n\n例：${zh[5]}\n${zh[6]}\n（${zh[7]}）\n\n保存して、声に出して読んでみてね🐼\n猫先生：1日10分の中国語（App Store で「猫先生」）\nLINEで毎日ひとこと：${PM_LINE}\n\n#中国語 #中国語学習 #中国語勉強中 #中国語初心者 #今日のひとこと #語学学習` });
  if (en) out.push({ id: 'en-jp', name: '今日の英語（Instagram / LINE VOOM）', tr: 'en', who: 'cat', font: PM_JP, head: `今日の英語 · ${m}月${dd}日`, phrase: en[0], read: '', mean: en[2], note: en[4], ex: en[7], exRead: '', exMean: en[9], exLabel: '例文', foot: '1日10分、英語・中国語・日本語',
    cap: `今日の英語｜${en[0]}＝${en[2]}\n\n${en[4]}\n\n例：${en[7]}\n（${en[9]}）\n\n保存して、声に出して読んでみてね🐱\n猫先生：1日10分の英語（App Store で「猫先生」）\nLINEで毎日ひとこと：${PM_LINE}\n\n#英語 #英語学習 #英語勉強中 #英会話 #今日のひとこと #語学学習` });
  if (en) out.push({ id: 'en-cn', name: '今日英语（小红书）', tr: 'en', who: 'cat', font: PM_CN, head: `今日英语 · ${m}月${dd}日`, phrase: en[0], read: '', mean: en[1], note: en[3], ex: en[7], exRead: '', exMean: en[8], exLabel: '例句', foot: '每天 10 分钟，英语・日语・中文',
    cap: `今日英语｜${en[0]} = ${en[1]}\n\n${en[3]}\n\n例句：${en[7]}\n${en[8]}\n\n每天一句，评论区打卡💪\n猫先生：每天 10 分钟学英语（App Store 搜「猫先生」）\n\n#英语 #英语学习 #每日英语 #英语口语 #学英语 #地道英语` });
  return out;
}

const pmFile = (id, d) => `nekosensei-${id}-${pmKey(d)}.png`;
async function pmSave(cv, name) {
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

let pmDay = new Date(); pmDay.setHours(12, 0, 0, 0);
let pmRun = 0;
async function pmRender() {
  const run = ++pmRun, root = document.getElementById('promo'), grid = root.querySelector('[data-grid]');
  root.querySelector('[data-date]').value = pmKey(pmDay);
  if (!pmZh) pmZh = await fetch('lang/zh-daily.json').then(r => r.json()).catch(() => null);
  if (!pmEn) pmEn = await fetch('lang/en-daily.json').then(r => r.json()).catch(() => null);
  const d = new Date(pmDay), cards = pmCards(d);
  const els = await Promise.all(cards.map(async c => {
    const cv = await pmCanvas(c), box = document.createElement('div');
    box.className = 'card';
    box.innerHTML = '<h2></h2><div class="bar"><button class="btn pri" type="button" data-save>保存图片</button><button class="btn" type="button" data-copy>复制文案</button></div><textarea readonly></textarea>';
    box.querySelector('h2').textContent = c.name;
    box.insertBefore(cv, box.querySelector('.bar'));
    const ta = box.querySelector('textarea'); ta.value = c.cap;
    box.querySelector('[data-save]').onclick = () => pmSave(cv, pmFile(c.id, d));
    box.querySelector('[data-copy]').onclick = async e => {
      try { await navigator.clipboard.writeText(c.cap); } catch (err) { ta.select(); document.execCommand('copy'); }
      e.target.textContent = '已复制'; setTimeout(() => { e.target.textContent = '复制文案'; }, 1500);
    };
    return box;
  }));
  if (run !== pmRun) return;
  grid.replaceChildren(...els);
  if (!els.length) grid.innerHTML = '<p class="muted">没有读到今日一句的数据。</p>';
}
(() => {
  const root = document.getElementById('promo');
  const shift = n => { pmDay.setDate(pmDay.getDate() + n); pmRender(); };
  root.querySelector('[data-prev]').onclick = () => shift(-1);
  root.querySelector('[data-next]').onclick = () => shift(1);
  root.querySelector('[data-today]').onclick = () => { pmDay = new Date(); pmDay.setHours(12, 0, 0, 0); pmRender(); };
  root.querySelector('[data-date]').onchange = e => { const v = e.target.value; if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { pmDay = new Date(v + 'T12:00:00'); pmRender(); } };
  pmRender();
})();
