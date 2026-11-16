'use strict';
/* 邀请好友：
   - 每个人有一个 6 位邀请码（服务器 my_ref_code）。分享图、分享链接、「我的 → 邀请好友」里都带着它（二维码 = 网址?r=邀请码）。
   - 别人扫码打开：先把邀请码记在这台设备上（还没注册也行）；注册 / 登录以后自动提交（claim_ref）→ 送他 3 天会员。
     从 App Store 下载 App 的人：在「邀请好友」页手动填邀请码（注册 7 天内有效）。
   - 被邀请的人学满 3 天：提交 ref_check → 服务器给邀请人一周会员（最多 12 周；正在付费订阅的人先存着，订阅停了再接上）。
   - 规则和数据表见 docs/SUPABASE_SETUP.md 第 21 节。 */
const REF_KEY = 'dojo-ref';
const refT = (zh, ja, en) => typeof tje === 'function' ? tje(zh, ja, en || zh) : zh;
const refLink = code => SHARE_SITE + (code ? `?r=${code}` : '');

const APP_STORE = 'https://apps.apple.com/app/id6830187313';
const refIOSWeb = () => !window.DOJO_APP && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
// 这台设备上有登录过的账号（Supabase 存在 localStorage 的 sb-…-auth-token）
const refSession = () => { try { return Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k)); } catch (e) { return false; } };
async function refCopy(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; } }
// 扫码落地页（苹果设备的浏览器）：下载 App / 继续用网页
function refLanding(code) {
  const T = refT;
  const m = h(`<div class="ask-mask inv-land" role="dialog" aria-modal="true"><div class="ask-box">
    <div class="inv-land-top">${typeof mascotSVG === 'function' ? mascotSVG('cat', 'happy', '') : '🐱'}<div><b>${esc(BRAND)}</b><span class="small muted">${T('日语 · 英语 · 中文', '日本語・英語・中国語', 'Japanese · English · Chinese')}</span></div></div>
    <h2>${T('好友送你 3 天会员', '友だちから 3 日間メンバーのプレゼント', 'A friend sent you 3 free days')}</h2>
    <div class="inv-code"><div><div class="eyebrow">${T('邀请码', '招待コード', 'Invite code')}</div><b class="inv-big">${esc(code)}</b></div></div>
    <a class="btn pri" href="${APP_STORE}" data-store>${T('下载 App（邀请码自动复制）', 'App をダウンロード（コードを自動コピー）', 'Get the app (code copied automatically)')}</a>
    <p class="small muted">${T('打开 App 登录后，在弹出的窗口里粘贴邀请码就能领取。已经装了 App 的话，直接打开它即可。', 'App にログインすると招待コードの入力画面が出るので、貼り付けて受け取ってください。インストール済みの場合はそのまま App を開いてください。', 'Open the app, sign in, and paste the code when asked. Already installed? Just open the app.')}</p>
    <button class="btn ghost" type="button" data-web>${T('先在网页上用', 'このままウェブで使う', 'Use the website instead')}</button>
  </div></div>`);
  m.querySelector('[data-store]').onclick = async e => { e.preventDefault(); await refCopy(code); location.href = APP_STORE; };
  m.querySelector('[data-web]').onclick = () => { m.remove(); if (typeof toast === 'function') toast(refT('已记下邀请码：注册后送你 3 天会员', '招待コードを記録しました。登録すると 3 日間メンバーになれます', 'Invite code saved: sign up to get 3 free days')); };
  document.body.append(m);
}

// 扫码 / 点链接打开：记下邀请码，地址栏里去掉 ?r=
(function refCapture() {
  try {
    const m = /[?&]r=([0-9A-Za-z]{4,8})(?:&|$)/.exec(location.search);
    if (!m) return;
    localStorage.setItem(REF_KEY, m[1].toUpperCase());
    history.replaceState(history.state, '', location.pathname + location.hash);
    // 苹果手机 / iPad 的浏览器里：先请他下载 App（邀请码自动复制，App 里登录后粘贴）；其他设备直接在网页上用
    if (refSession()) return;   // 已经登录：登录后自动提交（refAfterLogin），不用再提示
    if (refIOSWeb()) addEventListener('load', () => refLanding(m[1].toUpperCase()));
    else addEventListener('load', () => setTimeout(() => { if (typeof toast === 'function') toast(refT('已记下好友的邀请码：注册后送你 3 天会员', '友だちの招待コードを記録しました。登録すると 3 日間メンバーになれます', 'Invite code saved: sign up to get 3 free days of membership')); }, 1500));
  } catch (e) { /* 忽略 */ }
})();

const refLogged = () => typeof sbUser !== 'undefined' && !!sbUser && typeof cloudClient === 'function';
async function refRpc(name, args) {
  const c = await cloudClient();
  const { data, error } = await c.rpc(name, args || {});
  if (error) throw error;
  return data;
}
// 我的邀请码（第一次会在服务器上生成），记在 S.refCode
async function refMyCode() {
  if (!refLogged()) return '';
  if (S.refCode && S.refUser === sbUser.id) return S.refCode;
  const code = await refRpc('my_ref_code').catch(() => '');
  if (code) { S.refCode = code; S.refUser = sbUser.id; save(); }
  return code || '';
}
// 提交邀请码。auto = 登录后自动提交（不成功也不打扰）
const REF_MSG = {
  bad_code: ['邀请码不对，请再确认一下', '招待コードが見つかりません。もう一度確認してください', 'That invite code was not found'],
  self: ['不能填自己的邀请码', '自分の招待コードは使えません', 'You can\'t use your own code'],
  used: ['这个账号已经用过邀请码了', 'このアカウントは招待コードを使用済みです', 'This account has already used an invite code'],
  old: ['邀请码要在注册后 7 天内填写', '招待コードは登録から 7 日以内に入力してください', 'Invite codes must be entered within 7 days of signing up']
};
async function refClaim(code, auto) {
  code = String(code || '').trim().toUpperCase();
  if (!code || !refLogged()) return '';
  let r;
  try { r = await refRpc('claim_ref', { c: code }); } catch (e) { if (!auto) toast(refT('暂时连不上服务器，请稍后再试', 'サーバーにつながりません。しばらくしてからお試しください', 'Could not reach the server. Please try again later')); return 'error'; }
  S.ref = S.ref || {};
  if (r === 'ok') {
    S.ref.claimed = Date.now(); save();
    try { localStorage.removeItem(REF_KEY); } catch (e) { /* 忽略 */ }
    toast(refT('邀请码有效：送你 3 天会员，三种语言都能用', '招待コードを確認しました。3 日間メンバーになりました（3 言語すべて）', 'Invite code accepted: 3 free days of membership'));
    if (typeof memberRefresh === 'function') memberRefresh();
  } else if (REF_MSG[r]) {
    if (r === 'used') { S.ref.claimed = S.ref.claimed || 1; save(); }
    try { localStorage.removeItem(REF_KEY); } catch (e) { /* 忽略 */ }
    if (!auto) toast(refT(...REF_MSG[r]));
  }
  return r;
}
// 被邀请的人学满 3 天：通知服务器（服务器按同步上去的学习记录再算一遍），一天最多问几次
async function refCheck() {
  if (!refLogged() || !S.ref || !S.ref.claimed || S.ref.done) return;
  if (Object.values(S.days || {}).filter(v => v > 0).length < 3) return;
  if (S.ref.chk && Date.now() - S.ref.chk < 3 * 3600e3) return;
  S.ref.chk = Date.now(); save();
  setTimeout(async () => {   // 先让学习记录同步到服务器（cloud.js 有几秒的延迟）
    const r = await refRpc('ref_check').catch(() => '');
    if (['rewarded', 'done', 'cap', 'none'].includes(r)) { S.ref.done = 1; save(); }
  }, 10000);
}
// 登录以后（member.js memberLogin 调用）：有记下的邀请码就提交，再看看能不能给邀请人发奖励
async function refAfterLogin() {
  let code = '';
  try { code = localStorage.getItem(REF_KEY) || ''; } catch (e) { /* 忽略 */ }
  if (code && !(S.ref && S.ref.claimed)) await refClaim(code, true);
  else refAskApp();
  refCheck();
  refMyCode().catch(() => {});   // 先拿到邀请码：分享链接、分享图马上就能带上
}
// App 里新注册的账号（7 天内）登录后问一次：有没有好友的邀请码（扫码落地页已经帮他复制好了，点「粘贴」就行）
function refAskApp() {
  if (!window.DOJO_APP || !refLogged() || (S.ref && S.ref.claimed) || S.refAsked === sbUser.id) return;
  const born = Date.parse(sbUser.created_at || '');
  if (!born || Date.now() - born > 7 * 864e5) return;
  S.refAsked = sbUser.id; save();   // 每个账号只问一次
  const T = refT;
  const m = h(`<div class="ask-mask inv-land" role="dialog" aria-modal="true"><div class="ask-box">
    <h2>${T('有好友的邀请码吗？', '友だちの招待コードはありますか？', 'Have a friend\'s invite code?')}</h2>
    <p class="small muted">${T('填上就送你 3 天会员（三种语言都能用）。扫过好友二维码的话，邀请码已经复制好了，点「粘贴」即可。', '入力すると 3 日間メンバーになれます（3 言語すべて）。友だちの QR コードを読み取った場合はコピー済みなので「貼り付け」を押してください。', 'Enter it to get 3 free days. If you scanned a friend\'s QR code, it is already copied — tap Paste.')}</p>
    <div class="row"><input type="text" maxlength="8" placeholder="${T('6 位邀请码', '6 桁のコード', '6-character code')}" data-code autocapitalize="characters"><button class="btn" type="button" data-paste>${T('粘贴', '貼り付け', 'Paste')}</button></div>
    <div class="ask-opts"><button class="btn ghost" type="button" data-no>${T('没有', 'ない', 'No')}</button><button class="btn pri" type="button" data-ok>${T('领取 3 天会员', '3 日間を受け取る', 'Get 3 days')}</button></div>
  </div></div>`);
  const inp = m.querySelector('[data-code]');
  m.querySelector('[data-paste]').onclick = async () => {
    try { const t = await navigator.clipboard.readText(); const c = /[?&]r=([0-9A-Za-z]{6})/.exec(t || '') || /(?:^|[^0-9A-Za-z])([0-9A-F]{6})(?![0-9A-Za-z])/i.exec(t || ''); if (c) inp.value = c[1].toUpperCase(); else toast(T('剪贴板里没有邀请码，请手动输入', 'クリップボードにコードがありません。入力してください', 'No code on the clipboard — please type it')); }
    catch (e) { toast(T('不能读取剪贴板，请手动输入', 'クリップボードを読み取れません。入力してください', 'Could not read the clipboard — please type it')); }
  };
  m.querySelector('[data-no]').onclick = () => m.remove();
  m.querySelector('[data-ok]').onclick = async () => { const r = await refClaim(inp.value, false); if (r === 'ok' || r === 'used' || r === 'old') m.remove(); };
  document.body.append(m);
}

/* ---------- 二维码 ---------- */
const refQRLib = () => typeof qrcode === 'function' ? Promise.resolve() : loadScript('vendor/qrcode.js');
// 在 canvas 上画二维码（白底、四周留白），x, y 左上角，size 边长
function refDrawQR(x, text, X, Y, size, color = '#2A2226') {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), pad = Math.round(size * 0.06), cell = (size - pad * 2) / n;
  x.fillStyle = '#fff'; x.fillRect(X, Y, size, size);
  x.fillStyle = color;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(Math.floor(X + pad + c * cell), Math.floor(Y + pad + r * cell), Math.ceil(cell), Math.ceil(cell));
}

/* ---------- 「我的 → 邀请好友」 ---------- */
let refWaited = 0;   // 已经等过一次登录恢复了
function invitePanel() {
  const T = refT;
  const p = h(`<section class="panel invite"><h2>${T('邀请好友', '友だちを招待', 'Invite friends')}</h2>
    <div class="inv-rules">
      <div><b>🎁 ${T('你得一周会员', 'あなたに 1 週間', 'You get a week')}</b><span class="small muted">${T('好友用你的邀请码注册、学满 3 天', '友だちが招待コードで登録して 3 日学習', 'When a friend signs up with your code and studies 3 days')}</span></div>
      <div><b>🎉 ${T('好友得 3 天会员', '友だちに 3 日間', 'Your friend gets 3 days')}</b><span class="small muted">${T('用邀请码注册就送', '招待コードで登録するとすぐ', 'Right after signing up with your code')}</span></div>
    </div>
    <p class="small muted">${T('会员三种语言都能用。每人通过邀请最多累计 12 周；正在付费订阅的话，奖励先存起来，订阅停了自动接上。', 'メンバーは 3 言語すべて使えます。招待で受け取れるのは合計 12 週まで。サブスク中の場合は貯めておき、サブスクが終わったら自動で使われます。', 'Membership covers all three languages. Up to 12 weeks in total. If you have an active subscription, the weeks are saved and start when it ends.')}</p>
    <div data-body><div class="skel" role="status"><i></i><i></i></div></div></section>`);
  const body = p.querySelector('[data-body]');
  // 直接打开这个页面时登录状态可能还没恢复：有登录记录就等一会儿（最多 8 秒）再画
  if (!refLogged() && refSession() && !refWaited) {
    const t0 = Date.now(), iv = setInterval(() => {
      if (!p.isConnected) return clearInterval(iv);
      if (refLogged() || Date.now() - t0 > 8000) { clearInterval(iv); refWaited = 1; p.replaceWith(invitePanel()); }
    }, 250);
    return p;
  }
  if (!refLogged()) {
    body.innerHTML = `<p>${T('登录以后就有自己的邀请码。', 'ログインすると自分の招待コードが表示されます。', 'Sign in to get your invite code.')}</p><a class="btn pri" href="#me/account">${T('登录 / 注册', 'ログイン・登録', 'Sign in')}</a>`;
    return p;
  }
  Promise.all([refMyCode(), refRpc('my_ref_stats').catch(() => null), refQRLib().catch(() => null)]).then(([code, st]) => {
    if (!p.isConnected && !body.isConnected) return;
    if (!code) { body.innerHTML = `<p class="muted">${T('暂时拿不到邀请码（服务器还没开通这个功能，或者网络不通），请稍后再试。', '招待コードを取得できませんでした。しばらくしてからお試しください。', 'Could not get your invite code. Please try again later.')}</p>`; return; }
    const url = refLink(code);
    body.innerHTML = `<div class="inv-code"><div><div class="eyebrow">${T('我的邀请码', '招待コード', 'Your code')}</div><b class="inv-big">${esc(code)}</b></div><canvas class="inv-qr" width="300" height="300" aria-label="QR"></canvas></div>
      <div class="row"><button class="btn pri" type="button" data-share>${T('分享邀请图', '招待画像をシェア', 'Share invite image')}</button><button class="btn" type="button" data-save>${T('保存图片', '画像を保存', 'Save image')}</button><button class="btn ghost" type="button" data-copy>${T('复制邀请码', 'コードをコピー', 'Copy code')}</button><button class="btn ghost" type="button" data-link>${T('复制链接', 'リンクをコピー', 'Copy link')}</button></div>
      <div data-out></div>
      ${st ? `<div class="inv-stats"><div><b>${st.invited}</b><span class="small muted">${T('已邀请', '招待した人', 'Invited')}</span></div><div><b>${st.rewarded}</b><span class="small muted">${T('学满 3 天', '3 日学習', 'Studied 3 days')}</span></div><div><b>${st.weeks} / 12</b><span class="small muted">${T('拿到的周数', 'もらった週', 'Weeks earned')}</span></div></div>
        ${st.bank ? `<p class="small">${T(`有 ${st.bank} 天奖励存着，订阅停了以后自动接上。`, `${st.bank} 日分を貯めています。サブスクが終わると自動で使われます。`, `${st.bank} days saved; they start when your subscription ends.`)}</p>` : ''}` : ''}
      ${!st || !st.claimed ? `<details class="inv-have"><summary>${T('我有好友的邀请码', '友だちの招待コードを持っている', 'I have a friend\'s code')}</summary><div class="row"><input type="text" maxlength="8" placeholder="${T('输入 6 位邀请码', '6 桁のコード', '6-character code')}" data-code autocapitalize="characters"><button class="btn" type="button" data-claim>${T('领取 3 天会员', '3 日間を受け取る', 'Get 3 days')}</button></div><p class="small muted">${T('注册后 7 天内有效。', '登録から 7 日以内に入力できます。', 'Valid within 7 days of signing up.')}</p></details>` : ''}`;
    const cv = body.querySelector('.inv-qr');
    if (typeof qrcode === 'function') refDrawQR(cv.getContext('2d'), url, 0, 0, 300); else cv.remove();
    // 邀请图先画好：苹果手机要求点按钮后马上调用系统分享，点了再画图会被拦掉
    const out = body.querySelector('[data-out]'), name = `nekosensei-invite-${code}.png`;   // 英文文件名
    let file = null, png = '';
    if (typeof shareInviteCanvas === 'function' && typeof qrcode === 'function') shareInviteCanvas(code, url).then(c => { const d = c.toDataURL('image/png'); c.toBlob(b => { if (b) { file = new File([b], name, { type: 'image/png' }); png = d; } }, 'image/png'); }).catch(() => {});
    // 不能直接分享图片的时候（电脑浏览器等）：把图显示出来，可以保存或长按
    const showImg = () => {
      if (!png) return;
      out.innerHTML = `<img class="share-img" src="${png}" alt="${T('邀请图', '招待画像', 'Invite image')}"><p class="small muted">${T('手机上可以长按图片，选「存储图像」保存到相册，再发给朋友。', 'スマートフォンでは画像を長押しして「写真に保存」できます。', 'On a phone, long-press the image and choose Save to Photos.')}</p>`;
    };
    body.querySelector('[data-share]').onclick = () => {
      if (!file) { toast(T('图片还在生成，请稍等一下再点', '画像を作成中です。少し待ってからもう一度どうぞ', 'Still preparing the image — tap again in a moment')); return; }
      if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file] }).catch(e => { if (!e || e.name !== 'AbortError') showImg(); });
      else showImg();
    };
    body.querySelector('[data-save]').onclick = () => {
      if (!png) { toast(T('图片还在生成，请稍等一下再点', '画像を作成中です。少し待ってからもう一度どうぞ', 'Still preparing the image — tap again in a moment')); return; }
      if (typeof scSave === 'function') scSave(file, png, (zh, ja) => T(zh, ja)); else { const a = document.createElement('a'); a.href = png; a.download = name; a.click(); }
      showImg();
    };
    body.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(code); toast(T('邀请码已复制', 'コードをコピーしました', 'Code copied')); } catch (e) { prompt('', code); } };
    body.querySelector('[data-link]').onclick = async () => {
      const text = T(`我在用${BRAND}学语言，用我的邀请码 ${code} 注册送 3 天会员：`, `${BRAND}で語学を勉強中。招待コード ${code} で登録すると 3 日間メンバーになれます：`, `I'm learning languages with ${BRAND}. Sign up with my code ${code} for 3 free days:`);
      try { await navigator.clipboard.writeText(`${text} ${url}`); toast(T('邀请链接已复制', '招待リンクをコピーしました', 'Invite link copied')); } catch (e) { prompt(T('复制这个链接发给朋友', 'このリンクをコピーして送ってください', 'Copy this link'), url); }
    };
    const cl = body.querySelector('[data-claim]');
    if (cl) cl.onclick = async () => { const r = await refClaim(body.querySelector('[data-code]').value, false); if (r === 'ok') render(); };
  });
  return p;
}
