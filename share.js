'use strict';
/* 分享链接：#hi/<数据>。别人打开不用登录，就能看到「我」学了多少（连续天数、单词、阅读、最近 4 周），
   再用 3 道和「我」同一级别的小题挑战一下，最后一个「免费开始学」按钮。
   数据全在链接里（base64，只有学习统计和昵称，没有账号、邮箱），不需要服务器。 */

const SHARE_SITE = 'https://koshokai.github.io/nihonggo-dojo/';
const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

// 我的学习数据 → 分享用的小对象
function shareData() {
  const tr = S.track || 'ja';
  const words = tr === 'ja' ? allVocab().filter(learned).length : Object.keys(S.srs).filter(id => id.startsWith(tr + '|') && S.srs[id].r > 0).length;
  const reads = tr === 'ja' ? Object.keys(S.read || {}).length : tr === 'en' ? Object.keys(S.enRead || {}).length : Object.keys(S.zhRead || {}).length;
  const end = new Date(); end.setHours(0, 0, 0, 0);
  let bits = '';
  for (let i = 27; i >= 0; i--) { const d = new Date(end); d.setDate(d.getDate() - i); bits += (S.days[dkey(d)] || 0) > 0 ? '1' : '0'; }
  const lv = tr === 'ja' ? S.level : tr === 'en' ? (typeof enLevel === 'function' ? enLevel() : 'A1') : (typeof zhLevel === 'function' ? zhLevel() : 'HSK1');
  return { v: 1, t: tr, ui: tr === 'zh' ? 'ja' : tr === 'en' ? (S.enNative || 'zh') : 'zh', n: (S.lb && S.lb.nick) || '', lv, s: streak(), x: S.xp, w: words, r: reads, b: Object.keys(S.badges || {}).length, d: bits, dt: dkey() };
}
// 带上我的邀请码（invite.js 拿到以后记在 S.refCode）：朋友从这个链接注册，双方都有奖励
const shareLink = () => SHARE_SITE + (S.refCode ? `?r=${S.refCode}` : '') + '#hi/' + b64url(JSON.stringify(shareData()));

/* ---------- 打开分享链接看到的页面 ----------
   界面语言跟着「看的人」的手机走（中文 / 日本語 / English），不是分享人的设定：
   在国外的中国人、日本人、外国人都会收到。页面只炫耀分享人学了多少，一屏放得下（方便截图），最后邀请看的人一起学。 */
const hiViewer = () => { const l = (navigator.language || 'en').toLowerCase(); return l.startsWith('zh') ? 'zh' : l.startsWith('ja') ? 'ja' : 'en'; };
function viewHi(code) {
  let d;
  try { d = JSON.parse(unb64url(code || '')); } catch (e) { d = null; }
  if (!d || typeof d !== 'object' || d.v !== 1) { location.replace('#home'); return; }
  // 链接是谁都能伪造的：数字只收非负整数，语言只收三种，打卡记录只收 0/1，文字一律 esc（防止往页面里塞脚本）
  const num = x => { const n = Math.floor(Number(x)); return Number.isFinite(n) && n >= 0 ? Math.min(n, 9999999) : 0; };
  d = { v: 1, t: ['ja', 'zh', 'en'].includes(d.t) ? d.t : 'ja', n: String(d.n || '').slice(0, 24), lv: String(d.lv || '').slice(0, 8),
    s: num(d.s), w: num(d.w), r: num(d.r), x: num(d.x), d: /^[01]{1,56}$/.test(d.d || '') ? d.d : '' };
  const V = hiViewer(), T = (zh, ja, en) => V === 'ja' ? ja : V === 'en' ? en : zh;
  const lang = { ja: T('日语', '日本語', 'Japanese'), zh: T('中文', '中国語', 'Chinese'), en: T('英语', '英語', 'English') }[d.t] || T('日语', '日本語', 'Japanese');
  const who = d.n ? esc(d.n) : T('我', 'わたし', 'I');
  // 是 0 的数字不展示（刚开始学的人也好看），最多 4 个
  const stats = [[d.s, T('连续天数', '連続日数', 'Day streak')], [d.w, T('学会的单词', '覚えた単語', 'Words learned')], [d.r, T('读完的文章', '読んだ文章', 'Articles read')], [d.x, 'XP'], [esc(d.lv), T('现在的级别', '今のレベル', 'Level')]]
    .filter(([v]) => v && v !== '0').filter((x, k, a) => a.length < 5 || x[1] !== 'XP').map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  const cells = (d.d || '').split('').map(c => `<i class="${c === '1' ? 'on' : ''}"></i>`).join('');
  const p = h(`<section class="panel hi-page" lang="${V}">
    <div class="hi-hero">${neko('cheer', 'big')}<div>
      <div class="hi-brand">${esc(BRAND)}</div>
      <h2>${T(`${who}在${BRAND}学${lang}`, `${who}は${BRAND}で${lang}を勉強中`, `${who === 'I' ? "I'm" : who + ' is'} learning ${lang} on ${BRAND}`)}</h2>
      <p class="muted">${d.s ? T(`每天十分钟，已经坚持了 ${d.s} 天`, `1 日 10 分、${d.s} 日続いています`, `10 minutes a day · ${d.s} days in a row`) : T('每天十分钟，一点点进步', '1 日 10 分、少しずつ前へ', '10 minutes a day, a little at a time')}</p></div></div>
    <div class="hi-stats">${stats}</div>
    <div class="hi-heat" aria-label="${T('最近 4 周的学习记录', '直近 4 週間の記録', 'Last 4 weeks')}">${cells}</div>
    <p class="small muted hi-heat-l">${T('最近 4 周 · 有颜色的格子是学习过的日子', '直近 4 週間 · 色のついたマスが学習した日', 'Last 4 weeks · colored squares are study days')}</p>
    <div class="hi-cta">
      <a class="hi-about" href="#welcome"><img src="icon-192.png" alt="" width="40" height="40"><span><b>${esc(BRAND)}</b><span class="small muted">${T('日语 · 中文 · 英语，每天 10 分钟', '日本語 · 中国語 · 英語、1 日 10 分', 'Japanese · Chinese · English, 10 minutes a day')}</span></span></a>
      <button class="btn pri big" type="button" data-go>${T(`和${who}一起学`, `${who}と一緒にやってみる`, who === 'I' ? 'Learn with me' : `Learn with ${who}`)}</button>
    </div>
  </section>`);
  main.append(p);
  p.querySelectorAll('.hi-about, [data-go]').forEach(x => { x.onclick = e => { e.preventDefault(); location.hash = S.onboarded ? '#home' : '#welcome'; }; });
}
