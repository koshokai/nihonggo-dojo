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

// 扫码 / 点链接打开：记下邀请码，地址栏里去掉 ?r=
(function refCapture() {
  try {
    const m = /[?&]r=([0-9A-Za-z]{4,8})(?:&|$)/.exec(location.search);
    if (!m) return;
    localStorage.setItem(REF_KEY, m[1].toUpperCase());
    history.replaceState(history.state, '', location.pathname + location.hash);
    addEventListener('load', () => setTimeout(() => { if (typeof toast === 'function') toast(refT('已记下好友的邀请码：注册后送你 3 天会员', '友だちの招待コードを記録しました。登録すると 3 日間メンバーになれます', 'Invite code saved: sign up to get 3 free days of membership')); }, 1500));
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
  refCheck();
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
  if (!refLogged()) {
    body.innerHTML = `<p>${T('登录以后就有自己的邀请码。', 'ログインすると自分の招待コードが表示されます。', 'Sign in to get your invite code.')}</p><a class="btn pri" href="#me/account">${T('登录 / 注册', 'ログイン・登録', 'Sign in')}</a>`;
    return p;
  }
  Promise.all([refMyCode(), refRpc('my_ref_stats').catch(() => null), refQRLib().catch(() => null)]).then(([code, st]) => {
    if (!p.isConnected && !body.isConnected) return;
    if (!code) { body.innerHTML = `<p class="muted">${T('暂时拿不到邀请码（服务器还没开通这个功能，或者网络不通），请稍后再试。', '招待コードを取得できませんでした。しばらくしてからお試しください。', 'Could not get your invite code. Please try again later.')}</p>`; return; }
    const url = refLink(code);
    body.innerHTML = `<div class="inv-code"><div><div class="eyebrow">${T('我的邀请码', '招待コード', 'Your code')}</div><b class="inv-big">${esc(code)}</b></div><canvas class="inv-qr" width="300" height="300" aria-label="QR"></canvas></div>
      <div class="row"><button class="btn pri" type="button" data-share>${T('分享邀请链接', '招待リンクを送る', 'Share invite link')}</button><button class="btn" type="button" data-copy>${T('复制邀请码', 'コードをコピー', 'Copy code')}</button><button class="btn ghost" type="button" data-save>${T('保存二维码', 'QR を保存', 'Save QR')}</button></div>
      ${st ? `<div class="inv-stats"><div><b>${st.invited}</b><span class="small muted">${T('已邀请', '招待した人', 'Invited')}</span></div><div><b>${st.rewarded}</b><span class="small muted">${T('学满 3 天', '3 日学習', 'Studied 3 days')}</span></div><div><b>${st.weeks} / 12</b><span class="small muted">${T('拿到的周数', 'もらった週', 'Weeks earned')}</span></div></div>
        ${st.bank ? `<p class="small">${T(`有 ${st.bank} 天奖励存着，订阅停了以后自动接上。`, `${st.bank} 日分を貯めています。サブスクが終わると自動で使われます。`, `${st.bank} days saved; they start when your subscription ends.`)}</p>` : ''}` : ''}
      ${st && !st.claimed ? `<details class="inv-have"><summary>${T('我有好友的邀请码', '友だちの招待コードを持っている', 'I have a friend\'s code')}</summary><div class="row"><input type="text" maxlength="8" placeholder="${T('输入 6 位邀请码', '6 桁のコード', '6-character code')}" data-code autocapitalize="characters"><button class="btn" type="button" data-claim>${T('领取 3 天会员', '3 日間を受け取る', 'Get 3 days')}</button></div><p class="small muted">${T('注册后 7 天内有效。', '登録から 7 日以内に入力できます。', 'Valid within 7 days of signing up.')}</p></details>` : ''}`;
    const cv = body.querySelector('.inv-qr');
    if (typeof qrcode === 'function') refDrawQR(cv.getContext('2d'), url, 0, 0, 300); else cv.remove();
    body.querySelector('[data-share]').onclick = async () => {
      const text = T(`我在用${BRAND}学语言，用我的邀请码 ${code} 注册送 3 天会员：`, `${BRAND}で語学を勉強中。招待コード ${code} で登録すると 3 日間メンバーになれます：`, `I'm learning languages with ${BRAND}. Sign up with my code ${code} for 3 free days:`);
      if (navigator.share) { try { await navigator.share({ title: BRAND, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(`${text} ${url}`); toast(T('邀请链接已复制', '招待リンクをコピーしました', 'Invite link copied')); } catch (e) { prompt(T('复制这个链接发给朋友', 'このリンクをコピーして送ってください', 'Copy this link'), url); }
    };
    body.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(code); toast(T('邀请码已复制', 'コードをコピーしました', 'Code copied')); } catch (e) { prompt('', code); } };
    body.querySelector('[data-save]').onclick = () => { if (!cv.isConnected) return; const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = `${BRAND}-${code}.png`; a.click(); };
    const cl = body.querySelector('[data-claim]');
    if (cl) cl.onclick = async () => { const r = await refClaim(body.querySelector('[data-code]').value, false); if (r === 'ok') render(); };
  });
  return p;
}
