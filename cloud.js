// 账号、云同步、意见反馈。后端是 Supabase（免费版，东京机房），配置在 config.js，建库步骤见 docs/SUPABASE_SETUP.md。
// 没配置时这些功能全部隐藏，网站照常离线使用。
const cloudOn = () => typeof CLOUD !== 'undefined' && CLOUD.url && CLOUD.anonKey;
let sb = null, sbUser = null, sbLoading = null, syncTimer = null, syncBusy = false, syncNote = '';

function cloudClient() {
  if (sb) return Promise.resolve(sb);
  if (!sbLoading) {
    sbLoading = new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = 'vendor/supabase.js';   // 放在本站：jsDelivr 在中国大陆经常连不上
      s.onload = () => { sb = window.supabase.createClient(CLOUD.url, CLOUD.anonKey, { auth: { persistSession: true, autoRefreshToken: true } }); ok(sb); };
      s.onerror = () => { sbLoading = null; fail(new Error(tj('无法连接服务器', 'サーバーに接続できません'))); };
      document.head.append(s);
    });
  }
  return sbLoading;
}

/* ---------- 同步 ---------- */
// 进度整份存成一行 JSON：progress(user_id, data, xp, updated_at)。
// 登录后：云端没有 → 上传本机；本机没学过 → 用云端；两边都有且不是同一份 → 让用户选。
const localKeep = () => ({ theme: S.theme, voice: S.voice, rate: S.rate, petals: S.petals, voiceSrc: S.voiceSrc });   // 这些是设备偏好，不跟着账号走
async function cloudPull(interactive) {
  const c = await cloudClient();
  const { data, error } = await c.from('progress').select('data, xp, updated_at').eq('user_id', sbUser.id).maybeSingle();
  if (error) throw error;
  if (!data) return cloudPush();
  const remoteAt = Date.parse(data.updated_at);
  const sameAccount = S.syncUser === sbUser.id;
  const localChanged = (S.modAt || 0) > (S.syncedAt || 0);
  const remoteChanged = remoteAt > (S.syncedAt || 0) + 1000;
  if (sameAccount && !remoteChanged) return localChanged ? cloudPush() : null;
  if (sameAccount && remoteChanged && !localChanged) return useRemote(data, remoteAt);
  if (!sameAccount && !(S.xp > 0)) return useRemote(data, remoteAt);
  if (!interactive) return null;
  // 两边都有进度：让用户决定
  return new Promise(resolve => {
    const d = h(`<div class="word-sheet" role="dialog" aria-label="${tj('选择进度', '学習記録の選択')}">
      <b>${tj('这个账号在云端已经有学习进度', 'このアカウントにはクラウド上の学習記録があります')}</b>
      <div class="small">${tj('云端', 'クラウド')}：${data.xp} ${tj('经验', 'XP')}，${new Date(remoteAt).toLocaleString(uiJa() ? 'ja-JP' : 'zh-CN')}<br>${tj('这台设备', 'この端末')}：${S.xp} ${tj('经验', 'XP')}</div>
      <div class="row"><button class="btn pri" type="button" data-r>${tj('用云端的进度', 'クラウドの記録を使う')}</button><button class="btn" type="button" data-l>${tj('用这台设备的进度', 'この端末の記録を使う')}</button></div>
      <div class="small muted">${tj('另一份会被覆盖。拿不准的话，选经验多的那份。', 'もう一方は上書きされます。迷ったら XP が多いほうを選んでください。')}</div>
    </div>`);
    document.body.append(d);
    d.querySelector('[data-r]').onclick = () => { d.remove(); resolve(useRemote(data, remoteAt)); };
    d.querySelector('[data-l]').onclick = () => { d.remove(); resolve(cloudPush()); };
  });
}
function useRemote(data, remoteAt) {
  const keep = localKeep(), member = S.memberUser === sbUser.id ? S.member : undefined, memberUser = member ? S.memberUser : undefined;
  // 会员身份不从同步数据里恢复（客户端能写自己那一行，不可信）；1.1 起由服务器的会员表提供
  S = Object.assign(blank(), data.data, keep, { syncUser: sbUser.id, syncedAt: remoteAt, modAt: remoteAt, member, memberUser });
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 忽略 */ }
  syncNote = tj('已从云端恢复进度', 'クラウドから学習記録を復元しました');
  applyTheme(); render(); updateTop();
}
async function cloudPush() {
  if (!sbUser || syncBusy) return;
  syncBusy = true;
  try {
    const c = await cloudClient();
    const now = new Date();
    const data = Object.assign({}, S); delete data.syncedAt; delete data.syncUser; delete data.member;   // 会员身份不上传
    const { error } = await c.from('progress').upsert({ user_id: sbUser.id, data, xp: S.xp, updated_at: now.toISOString() });
    if (error) throw error;
    S.syncUser = sbUser.id; S.syncedAt = now.getTime();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 忽略 */ }
    syncNote = tj('已同步 ', '同期しました ') + now.toLocaleTimeString(uiJa() ? 'ja-JP' : undefined);
    if (typeof lbSync === 'function') lbSync();   // 参加了排行榜的话顺便更新本周经验
    if (typeof buddySync === 'function') buddySync();   // 学习伙伴能看到的今日进度
  } catch (e) {
    syncNote = tj('同步失败，稍后会再试：', '同期に失敗しました。あとで再試行します：') + (e.message || e);
  } finally { syncBusy = false; }
  const el = document.querySelector('[data-sync-note]'); if (el) el.textContent = syncNote;
}
// save() 每次都会调用这里：停止操作 8 秒后再上传，避免频繁请求
function cloudQueue() {
  if (!sbUser) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(cloudPush, 8000);
}
addEventListener('pagehide', () => { if (sbUser && (S.modAt || 0) > (S.syncedAt || 0)) cloudPush(); });

const fromEmailLink = () => /access_token=|type=recovery|error_description=|[?&]code=/.test(location.hash + location.search);
const mustLogin = () => cloudOn() && CLOUD.requireLogin && !(typeof guestFlag === 'function' && guestFlag()) && !/^#hi\//.test(location.hash);   // 别人分享的学习成果页（#hi/…）不用登录就能看   // 选了游客模式就不挡
async function cloudInit() {
  if (!cloudOn()) return;
  document.querySelectorAll('[data-feedback-link]').forEach(a => { a.hidden = false; });
  // 不用账号的人不多下载任何东西：只有以前登录过、要求必须登录、或者从邮件链接回来时才加载 SDK
  if (!mustLogin() && !fromEmailLink() && !Object.keys(localStorage).some(k => k.startsWith('sb-'))) return;
  if (mustLogin()) authGate('loading');
  try {
    const c = await cloudClient();
    connStep(88);
    c.auth.onAuthStateChange((event, session) => {
      const was = sbUser;
      sbUser = session ? session.user : null;
      if (sbUser && typeof setGuest === 'function') setGuest(false);
      if (event === 'SIGNED_OUT' && typeof memberSignedOut === 'function') memberSignedOut();   // 令牌失效、别的标签页退出也清会员
      else if (event === 'SIGNED_IN' && sbUser && (!was || was.id !== sbUser.id) && typeof memberLogin === 'function') memberLogin(sbUser);
      if (event === 'PASSWORD_RECOVERY') setTimeout(() => authScreen('newpw'), 0);
    });
    const { data } = await c.auth.getSession();
    sbUser = data.session ? data.session.user : null;
    connStep(sbUser ? 90 : 100);
    if (/type=recovery/.test(location.hash)) return authScreen('newpw');
    if (sbUser && typeof guestFlag === 'function' && guestFlag()) { setGuest(false); render(); }   // 登录状态下不再是游客
    // 连接时选了「先逛逛」：现在连上了，告诉用户（以前登录过就直接恢复登录；没登录过就问要不要现在登录）
    if (connGuest) {
      connGuest = false;
      if (sbUser) { setGuest(false); await memberLogin(sbUser); await cloudPull(true).catch(() => {}); render(); toast(tje('已经连上了，学习进度已同步', 'つながりました。学習記録を同期しました', 'Connected — your progress is synced')); return; }
      if (await askConfirm(tje('已经连上了！现在登录或注册吗？登录后学习进度会保存到云端，换手机也不丢。', 'つながりました！ 今ログイン・登録しますか？ ログインすると学習記録がクラウドに保存され、機種変更しても消えません。', 'Connected! Sign in or sign up now? Your progress will be saved to the cloud.'),
        tje('现在登录', 'ログインする', 'Sign in'), tje('稍后', 'あとで', 'Later'))) authScreen('login');
      return;
    }
    if (sbUser) { if (document.querySelector('.conn-card')) await connDone(); if (connGuest) { connGuest = false; setGuest(false); render(); } authGate(null); await memberLogin(sbUser); await cloudPull(true); if (fromEmailLink()) { history.replaceState(null, '', location.pathname + '#home'); render(); } }
    else if (mustLogin()) authScreen(/error_description=/.test(location.hash) ? 'linkerr' : 'login');
  } catch (e) {
    syncNote = tj('暂时连不上服务器，进度先保存在本机', 'サーバーに接続できないため、学習記録はこの端末に保存しています');
    if (mustLogin() && !sbUser) authGate('offline');
  }
}

/* ---------- 「我的」页面的账号面板 ---------- */
function accountPanel() {
  if (!cloudOn()) return null;
  const p = h(`<section class="panel" id="account"><h2>${tj('账号与同步', 'アカウントと同期')}</h2><div data-acc>${tj('加载中……', '読み込み中…')}</div></section>`);
  const box = p.querySelector('[data-acc]');
  const draw = () => {
    if (sbUser) {
      box.innerHTML = `<p>${tj('已登录：', 'ログイン中：')}<b>${esc(sbUser.email || '')}</b></p>
        <p class="small muted" data-sync-note>${esc(syncNote || (S.syncedAt ? tj('上次同步 ', '前回の同期 ') + new Date(S.syncedAt).toLocaleString(uiJa() ? 'ja-JP' : 'zh-CN') : tj('还没有同步', 'まだ同期していません')))}</p>
        <p class="small muted">${tj('学习进度会自动同步。换手机或换浏览器后，用同一个账号登录就能接着学。', '学習記録は自動で同期されます。スマートフォンやブラウザを変えても、同じアカウントでログインすれば続きから学べます。')}</p>
        <div class="row"><button class="btn pri" type="button" data-sync>${tj('立即同步', '今すぐ同期')}</button><button class="btn" type="button" data-out>${tj('退出登录', 'ログアウト')}</button><button class="btn ghost danger" type="button" data-del>${tj('删除账号', 'アカウントを削除')}</button></div>`;
      box.querySelector('[data-sync]').onclick = async () => { box.querySelector('[data-sync-note]').textContent = tj('同步中……', '同期中…'); await cloudPull(true).catch(() => {}); await cloudPush(); };
      box.querySelector('[data-out]').onclick = async () => { await cloudPush(); await sb.auth.signOut(); sbUser = null; syncNote = ''; memberSignedOut(); draw(); toast(tj('已退出登录，进度仍保存在这台设备上', 'ログアウトしました。学習記録はこの端末に残っています')); if (mustLogin()) authScreen('login'); };
      box.querySelector('[data-del]').onclick = async () => {
        // 两步确认（自己画的确认框：App 里浏览器自带的 confirm 不一定会显示）：先说明后果，再最后确认一次
        if (!await askConfirm(tje('删除账号会同时删除云端的学习进度，无法恢复。这台设备上的进度会保留。\n\n注意：删除账号不会自动取消 App Store 的会员订阅。如果不想继续扣费，请在 iPhone 的「设置」→ Apple 账户 →「订阅」里取消。\n\n确定删除吗？', 'アカウントを削除すると、クラウド上の学習記録も削除され、元に戻せません。この端末の記録は残ります。\n\nご注意：アカウントを削除しても、App Store のメンバーシップ（サブスクリプション）は自動では解約されません。課金を止めるには、iPhone の「設定」→ Apple アカウント →「サブスクリプション」から解約してください。\n\n削除してもよろしいですか？', 'Deleting your account also deletes your progress saved in the cloud. This cannot be undone. Progress on this device is kept.\n\nNote: deleting your account does not cancel your App Store membership subscription. To stop being charged, cancel it in iPhone Settings → Apple Account → Subscriptions.\n\nDelete your account?'), tje('继续', '続ける', 'Continue'), tje('取消', 'キャンセル', 'Cancel'))) return;
        const who = (sbUser && sbUser.email) || '';
        const last = await askSheet(tje(`最后确认：账号${who ? `（${who}）` : ''}将被永久删除，无法恢复。`, `最終確認：アカウント${who ? `（${who}）` : ''}を完全に削除します。元に戻せません。`, `Final check: your account${who ? ` (${who})` : ''} will be permanently deleted. This cannot be undone.`),
          [[false, tje('不删除', '削除しない', 'Keep my account'), 'pri'], [true, tje('永久删除', '完全に削除する', 'Delete permanently'), 'ghost danger']]);
        if (last !== true) return;
        const { error } = await sb.rpc('delete_my_account');
        if (error) return toast(tj('删除失败：', '削除に失敗しました：') + error.message);
        await sb.auth.signOut(); sbUser = null; memberSignedOut(); delete S.syncUser; delete S.syncedAt; save(); draw(); toast(tj('账号已删除', 'アカウントを削除しました')); if (mustLogin()) authScreen('login');
      };
      return;
    }
    box.innerHTML = `<p class="small muted">${mustLogin() ? '' : tj('注册是可选的：不注册也能用全部功能。', '登録は任意です。登録しなくてもすべての機能を使えます。')}${tj('登录后学习进度会保存到云端，换手机、换浏览器都不丢。', 'ログインすると学習記録がクラウドに保存され、スマートフォンやブラウザを変えても消えません。')}</p>
      <div class="row"><button class="btn pri" type="button" data-login>${tj('登录 / 注册', 'ログイン / 新規登録')}</button></div>`;
    box.querySelector('[data-login]').onclick = e => { e.stopPropagation(); authScreen('login'); };
  };
  if (sbUser || !Object.keys(localStorage).some(k => k.startsWith('sb-'))) draw();
  else cloudClient().then(c => c.auth.getSession()).then(({ data }) => { sbUser = data.session ? data.session.user : null; draw(); }).catch(() => { box.textContent = tj('暂时连不上服务器。', '現在サーバーに接続できません。'); });
  return p;
}

/* ---------- 意见反馈：不用登录也能发 ---------- */
function feedbackSheet(kind = 'idea', context = '') {
  if (!cloudOn()) return;
  closeSheet();
  const sh = h(`<div class="word-sheet" role="dialog" aria-label="${tj('意见反馈', 'ご意見・ご要望')}">
    <button class="ws-x" type="button" aria-label="${tj('关闭', '閉じる')}">×</button>
    <b>${tj('意见反馈', 'ご意見・ご要望')}</b>
    <div class="seg" role="group">${[['bug', tj('出错了', '不具合')], ['content', tj('内容有误', '内容の誤り')], ['idea', tj('建议', '提案')], ['other', tj('其他', 'その他')]].map(([k, t]) => `<button type="button" data-k="${k}" class="${k === kind ? 'on' : ''}">${t}</button>`).join('')}</div>
    <textarea rows="5" maxlength="4000" placeholder="${tj('遇到了什么问题，或者希望增加什么？内容有误的话，请写上是哪个词或哪句话。', '困ったことや、追加してほしい機能を教えてください。内容の誤りの場合は、どの単語・文かも書いてください。')}">${esc(context)}</textarea>
    <input type="text" maxlength="200" placeholder="${tj('联系方式（选填，邮箱或微信，方便我们回复你）', '連絡先（任意。返信用のメールアドレスなど）')}">
    <div class="row"><button class="btn pri" type="button" data-send>${tj('发送', '送信')}</button><span class="small muted" data-st></span></div>
  </div>`);
  document.body.append(sh);
  let k = kind;
  sh.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { k = b.dataset.k; sh.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); }; });
  sh.querySelector('.ws-x').onclick = closeSheet;
  sh.querySelector('[data-send]').onclick = async () => {
    const message = sh.querySelector('textarea').value.trim(), st = sh.querySelector('[data-st]');
    if (!message) { st.textContent = tj('请先写点内容。', '内容を入力してください。'); return; }
    st.textContent = tj('发送中……', '送信中…');
    try {
      const c = await cloudClient();
      const { error } = await c.from('feedback').insert({ kind: k, message, contact: sh.querySelector('input').value.trim() || null, page: location.hash.slice(0, 200), app_version: 'web', user_id: sbUser ? sbUser.id : null });
      if (error) throw error;
      sh.innerHTML = `<b>${tj('谢谢你的反馈！', 'ご意見ありがとうございます！')}</b><div class="small muted">${tj('我们会认真看每一条。', 'いただいた内容はすべて確認しています。')}</div>`;
      setTimeout(closeSheet, 2200);
    } catch (e) { st.textContent = tj('发送失败：', '送信に失敗しました：') + (e.message || e); }
  };
  setTimeout(() => sh.querySelector('textarea').focus(), 50);
}
// 句子旁的小旗子：一键报告内容错误（读音、翻译、例句不自然……），带上原句，进后台「用户的回复和反馈」
const reportBtn = (text, zh) => cloudOn() ? `<button class="report-btn" type="button" data-report="${esc(text)}" data-report-zh="${esc(zh || '')}" aria-label="${tj('报告这句有错误', 'この文の誤りを報告')}" title="${tj('这句有错误？告诉我们', 'この文に誤りがありますか？お知らせください')}">⚑</button>` : '';
document.addEventListener('click', e => {
  const r = e.target.closest('[data-report]');
  if (r) { e.preventDefault(); e.stopPropagation(); feedbackSheet('content', `${tj('这句有问题：', 'この文に問題があります：')}${r.dataset.report}${r.dataset.reportZh ? tj('（', '（') + r.dataset.reportZh + tj('）', '）') : ''}\n${tj('哪里不对：', 'どこが違うか：')}`); }
}, true);
document.addEventListener('click', e => {
  const a = e.target.closest('[data-feedback-link]');
  if (a) { e.preventDefault(); e.stopPropagation(); feedbackSheet(); }
}, true);

/* ---------- 登录 / 注册界面 ---------- */
// mode：login 密码登录 | signup 注册 | otp 邮箱验证码登录 | forgot 忘记密码 | newpw 设置新密码 | linkerr 邮件链接失效
// 强制登录（CLOUD.requireLogin）时这个界面挡住整个网站，登录成功才消失；否则是可以关掉的弹层。
const REDIRECT = () => location.origin + location.pathname;
// 从邮件链接或 Google 登录跳回来时带着错误：显示具体原因
function linkErrText() {
  const q = new URLSearchParams((location.hash.replace(/^#/, '') + '&' + location.search.replace(/^\?/, '')));
  const d = q.get('error_description') || q.get('error') || '';
  if (/expired|invalid/i.test(d) && /email|link|otp|token/i.test(d)) return `<p>${tje('这个邮件链接已经失效或用过了。', 'このメールのリンクは有効期限切れか、すでに使用済みです。', 'This email link has expired or was already used.')}</p>`;
  return d ? `<p>${tje('登录没有完成：', 'ログインが完了しませんでした：', 'Sign-in did not finish: ')}${esc(authMsg(d).replace(/^(出错了：|エラーが発生しました：)/, ''))}</p>` : `<p>${tje('这个链接已经失效或用过了。', 'このリンクは有効期限切れか、すでに使用済みです。', 'This link has expired or was already used.')}</p>`;
}
/* ---------- 正在连接（登录前）：世界各地的小伙伴因为语言聚到一起 + 百分比进度 ----------
   进度按真实步骤推进：加载登录组件 → 读取登录状态 → 同步进度；每一步没完成时慢慢往前挪（不会停住不动，也不会提前到 100）。
   超过 10 秒还没连上（国内网络慢的时候），提示一句，并可以先以游客身份逛逛。 */
// 三种语言三个颜色的小圆精灵（日语粉、中文红、英语蓝）：慢慢靠近、交汇，重叠的地方混出新的颜色，中间亮起一颗心
const CONN_LANGS = [['あ', '#FF9EC4', 0], ['中', '#FFC27A', 120], ['A', '#8EC5FF', 240]];
function connectScene() {
  const msg = tje('日语、中文、英语，正在相遇……', '日本語・中国語・英語が、つながろうとしています…', 'Japanese, Chinese and English are coming together…');
  const blob = ([ch, col, deg], i) => {
    const r = 46, cx = 150 + 40 * Math.sin(deg * Math.PI / 180), cy = 112 - 40 * Math.cos(deg * Math.PI / 180);
    return `<g class="cn-orb" style="--dx:${(150 - cx) * .32}px;--dy:${(112 - cy) * .32}px;animation-delay:${i * .25}s">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" opacity=".9" style="mix-blend-mode:multiply"/>
      <g transform="translate(${cx + (cx - 150) * .38} ${cy + (cy - 112) * .38})">
        <text y="-4" text-anchor="middle" font-size="22" font-weight="900" fill="#fff">${ch}</text>
        <circle cx="-7" cy="8" r="2.4" fill="#fff"/><circle cx="7" cy="8" r="2.4" fill="#fff"/>
        <path d="M-4 13 q4 4 8 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
        <ellipse cx="-13" cy="12" rx="3.5" ry="2" fill="#fff" opacity=".45"/><ellipse cx="13" cy="12" rx="3.5" ry="2" fill="#fff" opacity=".45"/>
      </g></g>`;
  };
  return `<div class="auth-card conn-card">
    <div class="auth-brand">${typeof neko === 'function' ? neko('happy', 'mini') : ''}<span>${authBrand()}</span></div>
    <svg class="conn-scene" viewBox="0 0 300 224" role="img" aria-label="${esc(msg)}">
      <g>${CONN_LANGS.map(blob).join('')}</g>
      <path class="cn-heart" d="M150 120 c-6 -12 -24 -6 -18 8 l18 16 l18 -16 c6 -14 -12 -20 -18 -8z" fill="#fff"/>
      <g class="cn-dots">${CONN_LANGS.map(([, col], i) => `<circle cx="${120 + i * 30}" cy="214" r="4" fill="${col}" style="animation-delay:${i * .3}s"/>`).join('')}</g>
    </svg>
    <p class="conn-msg">${esc(msg)}</p>
    <p class="conn-slow small muted" hidden>${tje('网络有点慢，还在努力连接。也可以先以游客身份逛逛。', '通信に少し時間がかかっています。ゲストとして先に見てみることもできます。', 'The connection is slow. You can look around as a guest first.')}
      <button class="btn ghost small" type="button" data-conn-guest>${tje('先逛逛 →', 'ゲストで見る →', 'Browse as guest →')}</button></p>
    <div class="conn-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div class="conn-bar"><i></i></div>
      <b class="conn-pct">0%</b>
    </div>
  </div>`;
}
// 进度：每一步有一个「上限」（这一步没完成前最多走到哪儿）。等待时越靠近上限走得越慢，所以不会停住也不会提前满；
// 一步完成（connStep）就快速追到上一步的上限，再继续慢慢往新的上限走。
let connTarget = 0, connFloor = 0, connShown = 0, connTimer = null, connBorn = 0, connGuest = false;
function connStart(g) {
  connTarget = 60; connFloor = 0; connShown = 0; connBorn = Date.now(); connGuest = false; clearInterval(connTimer);
  const gb = g.querySelector('[data-conn-guest]');
  // 连接太慢时先以游客身份逛：连接仍在后台继续，连上以后再提示（见 cloudInit）
  if (gb) gb.onclick = () => { connGuest = true; setGuest(true); clearInterval(connTimer); authGate(null); render(); };
  connTimer = setInterval(() => {
    const box = document.querySelector('.conn-card');
    if (!box) { clearInterval(connTimer); return; }
    const cap = connTarget >= 100 ? 100 : connTarget - 1;
    if (connShown < connFloor) connShown = Math.min(connFloor, connShown + Math.max(1.5, (connFloor - connShown) * .25));   // 刚完成一步：快速追上
    else if (connShown < cap) connShown = Math.min(cap, connShown + Math.max(connTarget >= 100 ? 2 : .02, (cap - connShown) * (connTarget >= 100 ? .25 : .012)));
    const n = Math.floor(connShown);
    box.querySelector('.conn-bar i').style.width = n + '%';
    box.querySelector('.conn-pct').textContent = n + '%';
    box.querySelector('.conn-prog').setAttribute('aria-valuenow', n);
    if (Date.now() - connBorn > 10000) box.querySelector('.conn-slow').hidden = false;
  }, 60);
}
const connStep = t => { if (t > connTarget) { connFloor = connTarget; connTarget = t; } };
const connDone = () => new Promise(res => { connStep(100); const t0 = Date.now(); const w = () => (connShown >= 99.5 || Date.now() - t0 > 900) ? res() : setTimeout(w, 50); w(); });

// 登录界面上的网站名：学中文的日本用户看到的是「中国語道場」
const authBrand = () => BRAND;
function authGate(state) {
  let g = document.getElementById('auth-gate');
  if (!state) { if (g) g.remove(); document.body.classList.remove('gated'); return; }
  if (!g) { g = h('<div id="auth-gate" class="auth-gate" role="dialog" aria-modal="true"></div>'); document.body.append(g); }
  document.body.classList.add('gated');
  if (state === 'loading') { g.innerHTML = connectScene(); connStart(g); }
  if (state === 'offline') g.innerHTML = `<div class="auth-card"><div class="auth-brand">${authBrand()}</div><p>${tje('需要联网登录一次。', '最初の 1 回はインターネットに接続してログインする必要があります。', 'Please connect to the internet and sign in once.')}</p><p class="small muted">${tje('请检查网络后重新打开。登录过的设备之后没有网络也能使用。', 'ネットワークを確認して、もう一度開いてください。一度ログインした端末は、その後オフラインでも使えます。', 'Check your connection and reopen. Once signed in, this device works offline too.')}</p><button class="btn pri" type="button" onclick="location.reload()">${tje('重试', '再試行', 'Retry')}</button></div>`;
  return g;
}
function authMsg(m) {
  m = String(m && m.message || m);
  if (/Invalid login/i.test(m)) return tje('邮箱或密码不对。', 'メールアドレスまたはパスワードが正しくありません。', 'Wrong email or password.');
  if (/already.*registered|already been registered/i.test(m)) return tje('这个邮箱已经注册过了，请直接登录。', 'このメールアドレスはすでに登録されています。ログインしてください。', 'This email is already registered. Please sign in.');
  if (/Email not confirmed/i.test(m)) return tje('还没有确认邮箱：请打开注册时收到的确认邮件，点里面的链接。', 'メールアドレスの確認が済んでいません。登録時に届いた確認メールのリンクを開いてください。', 'Your email is not confirmed yet. Open the confirmation email and tap the link.');
  if (/rate limit|too many/i.test(m)) return tje('操作太频繁了，请过几分钟再试。', '操作が多すぎます。数分後にもう一度お試しください。', 'Too many attempts. Please try again in a few minutes.');
  if (/Token has expired|invalid.*otp|otp.*invalid/i.test(m)) return tje('验证码不对或已过期，请重新获取。', '確認コードが正しくないか、有効期限が切れています。もう一度取得してください。', 'The code is wrong or expired. Please request a new one.');
  if (/should be at least|Password should/i.test(m)) return tje('密码至少 8 位。', 'パスワードは 8 文字以上にしてください。', 'Password must be at least 8 characters.');
  if (/same.*password|different from the old/i.test(m)) return tje('新密码不能和旧密码一样。', '新しいパスワードは以前と異なるものにしてください。', 'The new password must be different from the old one.');
  if (/provider is not enabled|Unsupported provider/i.test(m)) return tje('这种登录方式还没有开通好，请先用邮箱登录。', 'このログイン方法はまだ利用できません。メールアドレスでログインしてください。', 'This sign-in method is not available yet. Please use email.');
  if (/access_denied|access denied/i.test(m)) return tje('你取消了 Google 登录，或者这个 Google 账号暂时不能使用（应用还在测试中）。', 'Google ログインがキャンセルされたか、この Google アカウントは現在使用できません（アプリはテスト中です）。', 'Google sign-in was cancelled, or this Google account cannot be used yet.');
  // Safari / iPhone 连不上时的报错是「Load failed」；中国大陆有些网络连海外服务器不稳定
  if (/fetch|network|load failed|timed? ?out|aborted/i.test(m)) return tje('暂时连不上服务器。在中国大陆，有些网络连接海外服务器不稳定：可以过一会儿再试，或者换一个网络（比如 Wi-Fi 和手机流量切换一下）。', 'サーバーに接続できません。しばらくしてからもう一度お試しいただくか、別のネットワーク（Wi-Fi とモバイル通信の切り替えなど）でお試しください。', 'Cannot reach the server right now. Please try again in a moment, or switch networks (e.g. Wi-Fi ↔ mobile data).');
  return tje('出错了：', 'エラーが発生しました：', 'Something went wrong: ') + m;
}
// 记住上次登录的邮箱（只存在这台设备上），下次登录自动填好，只要输密码
const LAST_EMAIL = 'dojo-last-email';
const lastEmail = () => { try { return localStorage.getItem(LAST_EMAIL) || ''; } catch (e) { return ''; } };
// 记住密码：勾选时只存在这台设备上（App 里是 App 自己的存储；网页是这个网站的本地存储），下次登录自动填好；取消勾选再登录就删掉
const SAVED_PW = 'dojo-saved-pw', SAVED_PW_OFF = 'dojo-saved-pw-off';
const savedPw = () => { try { const v = JSON.parse(localStorage.getItem(SAVED_PW) || 'null'); return v && v.e && v.p ? v : null; } catch (e) { return null; } };
function rememberPw(form, email, pwd) {
  try {
    if (form.remember && form.remember.checked) { localStorage.setItem(SAVED_PW, JSON.stringify({ e: email, p: btoa(unescape(encodeURIComponent(pwd))) })); localStorage.removeItem(SAVED_PW_OFF); }
    else { localStorage.removeItem(SAVED_PW); localStorage.setItem(SAVED_PW_OFF, '1'); }
  } catch (e) { /* 无痕模式 */ }
  // 浏览器自带的密码管理（Chrome 等）：顺便请它保存
  try { if (window.PasswordCredential && navigator.credentials) navigator.credentials.store(new PasswordCredential({ id: email, password: pwd })).catch(() => {}); } catch (e) { /* 不支持 */ }
}
async function afterLogin(user) {
  try { if (user && user.email) localStorage.setItem(LAST_EMAIL, user.email); } catch (e) { /* 忽略 */ }
  if (typeof liveStart === 'function') setTimeout(liveStart, 1000);   // 登录后开始接收新消息提醒
  if (window.onlineRetrack) setTimeout(window.onlineRetrack, 1000);   // 让伙伴看到你在线
  sbUser = user;
  if (typeof setGuest === 'function') setGuest(false);   // 登录后不再是游客，游客期间的进度由 cloudPull 合并
  authGate(null); closeSheet();
  if (typeof memberLogin === 'function') await memberLogin(user);   // 换了账号先清掉上一个人的会员
  await cloudPull(true);
  toast(tje('登录成功', 'ログインしました', 'Signed in') + (user.email ? '：' + user.email : ''));
  render();
}
function authScreen(mode = 'login') {
  if (!cloudOn()) return;
  const gate = mustLogin() || mode === 'newpw';
  const host = gate ? authGate('form') : (closeSheet(), h('<div class="word-sheet auth-sheet" role="dialog"></div>'));
  if (!gate) document.body.append(host);
  const tabs = ['login', 'signup', 'otp'].includes(mode) ? `<div class="seg auth-tabs" role="tablist">${[['login', tje('登录', 'ログイン', 'Sign in')], ['signup', tje('注册', '新規登録', 'Sign up')], ['otp', tje('验证码登录', 'コードでログイン', 'Email code')]].map(([k, t]) => `<button type="button" role="tab" data-mode="${k}" class="${k === mode ? 'on' : ''}">${t}</button>`).join('')}</div>` : '';
  const pw = (name, ph, ac) => `<div class="pw-wrap"><input type="password" name="${name}" placeholder="${ph}" autocomplete="${ac}" minlength="8" required><button type="button" class="pw-eye" data-eye aria-label="${tje('显示密码', 'パスワードを表示', 'Show password')}">${tje('显示', '表示', 'Show')}</button></div>`;
  const EM = tje('邮箱', 'メールアドレス', 'Email'), CODE = tje('邮件里的验证码', 'メールに記載の確認コード', 'Code from the email'), BACK = tje('← 返回登录', '← ログインに戻る', '← Back to sign in');
  const forms = {
    login: `<input type="email" name="email" placeholder="${EM}" autocomplete="username" required>${pw('pw', tje('密码', 'パスワード', 'Password'), 'current-password')}
      <label class="remember-pw small"><input type="checkbox" name="remember" ${savedPw() || !localStorage.getItem(SAVED_PW_OFF) ? 'checked' : ''}> ${tje('记住密码（只保存在这台设备上）', 'パスワードを保存（この端末だけ）', 'Remember password (this device only)')}</label>
      <button class="btn pri big" type="submit">${tje('登录', 'ログイン', 'Sign in')}</button><button class="btn ghost small" type="button" data-mode="forgot">${tje('忘记密码？', 'パスワードを忘れた方', 'Forgot password?')}</button>`,
    signup: `<input type="email" name="email" placeholder="${EM}" autocomplete="email" required>${pw('pw', tje('密码（至少 8 位）', 'パスワード（8 文字以上）', 'Password (8+ characters)'), 'new-password')}${pw('pw2', tje('再输一次密码', 'パスワード（確認）', 'Repeat password'), 'new-password')}
      <label class="small agree"><input type="checkbox" name="agree" required> ${tje('我已阅读并同意 <a href="privacy.html" target="_blank">隐私政策</a>', '<a href="privacy.html" target="_blank">プライバシーポリシー</a>を読み、同意します', 'I have read and agree to the <a href="privacy.html" target="_blank">Privacy Policy</a>')}</label>
      <button class="btn pri big" type="submit">${tje('注册', '登録する', 'Sign up')}</button>`,
    otp: `<p class="small muted">${tje('不用密码：输入邮箱，我们发一个验证码给你。', 'パスワードは不要です。メールアドレスを入力すると、確認コードをお送りします。', 'No password needed: enter your email and we will send you a code.')}</p><input type="email" name="email" placeholder="${EM}" autocomplete="email" required>
      <div class="otp-row" hidden><input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="${CODE}"></div>
      <button class="btn pri big" type="submit" data-otp-btn>${tje('发送验证码', '確認コードを送信', 'Send code')}</button>`,
    forgot: `<p>${tje('输入注册时用的邮箱，我们会发一封重置密码的邮件。点邮件里的链接回到这里，就可以设置新密码。', '登録したメールアドレスを入力してください。パスワード再設定用のメールをお送りします。メール内のリンクからこの画面に戻ると、新しいパスワードを設定できます。', 'Enter your account email and we will send a reset link. Open it to come back here and set a new password.')}</p>
      <input type="email" name="email" placeholder="${EM}" autocomplete="email" required>
      <button class="btn pri big" type="submit">${tje('发送重置邮件', '再設定メールを送信', 'Send reset email')}</button><button class="btn ghost small" type="button" data-mode="login">${BACK}</button>`,
    newpw: `<p>${tje('设置一个新密码。', '新しいパスワードを設定してください。', 'Set a new password.')}</p>${pw('pw', tje('新密码（至少 8 位）', '新しいパスワード（8 文字以上）', 'New password (8+ characters)'), 'new-password')}${pw('pw2', tje('再输一次', 'もう一度入力', 'Repeat'), 'new-password')}
      <button class="btn pri big" type="submit">${tje('保存新密码', '新しいパスワードを保存', 'Save new password')}</button>`,
    linkerr: `${linkErrText()}<p class="small muted">${tje('重新登录；忘记密码的话，再发一次重置邮件。', 'もう一度ログインしてください。パスワードを忘れた場合は、再設定メールをもう一度送信してください。', 'Sign in again, or send another reset email if you forgot your password.')}</p>
      <button class="btn pri big" type="button" data-mode="login">${tje('去登录', 'ログインへ', 'Go to sign in')}</button><button class="btn ghost small" type="button" data-mode="forgot">${tje('忘记密码', 'パスワードを忘れた方', 'Forgot password')}</button>`
  };
  const title = { login: tje('欢迎回来', 'おかえりなさい', 'Welcome back'), signup: tje('创建账号', 'アカウント作成', 'Create account'), otp: tje('验证码登录', 'コードでログイン', 'Email code'), forgot: tje('找回密码', 'パスワードの再設定', 'Reset password'), newpw: tje('设置新密码', '新しいパスワードの設定', 'New password'), linkerr: tje('没有登录成功', 'ログインできませんでした', 'Sign-in failed') }[mode];
  host.innerHTML = `<div class="auth-card">
    ${gate ? '' : `<button class="ws-x" type="button" data-close aria-label="${tje('关闭', '閉じる', 'Close')}">×</button>`}
    <div class="auth-brand">${typeof neko === 'function' ? neko('happy', 'mini') : ''}<span>${authBrand()}</span>${S.onboarded ? '' : `<div class="seg auth-lang" role="group" aria-label="language"><button type="button" data-ui="zh" lang="zh-CN" class="${!preEn() && !uiJa() ? 'on' : ''}">中文</button><button type="button" data-ui="ja" lang="ja" class="${!preEn() && uiJa() ? 'on' : ''}">日本語</button><button type="button" data-ui="en" lang="en" class="${preEn() ? 'on' : ''}">English</button></div>`}</div>
    <h2>${title}</h2>
    ${tabs}
    <form class="acc-form" data-af novalidate>${forms[mode]}</form>
    <p class="small auth-msg" data-msg role="status"></p>
    ${['login', 'signup', 'otp'].includes(mode) && ((CLOUD.google && !window.DOJO_APP) || (CLOUD.apple && !window.DOJO_APP)) ? `<div class="auth-or"><span>${tje('或者', 'または', 'or')}</span></div>` : ''}
    ${['login', 'signup', 'otp'].includes(mode) && (CLOUD.apple && !window.DOJO_APP) ? `<button class="btn big apple-btn" type="button" data-apple><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1-3.2-1 .1-2.2.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>${tje('通过 Apple 登录', 'Apple でサインイン', 'Sign in with Apple')}</button>` : ''}
    ${['login', 'signup', 'otp'].includes(mode) && (CLOUD.google && !window.DOJO_APP) ? `<button class="btn big google-btn" type="button" data-google><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>${tje('用 Google 登录', 'Google でログイン', 'Sign in with Google')}</button>${uiJa() ? '' : '<p class="small muted auth-note">中国大陆网络无法使用 Google 登录，请用邮箱注册。</p>'}` : ''}
    ${['login', 'signup', 'otp'].includes(mode) ? `<p class="small muted auth-note">${tje('继续即表示你同意<a href="terms.html" target="_blank" rel="noopener">《用户协议》</a>和<a href="privacy.html" target="_blank" rel="noopener">《隐私政策》</a>。', '続行すると、<a href="terms.html" target="_blank" rel="noopener">利用規約</a>と<a href="privacy.html" target="_blank" rel="noopener">プライバシーポリシー</a>に同意したものとみなされます。', 'By continuing you agree to the <a href="terms.html" target="_blank" rel="noopener">Terms</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.')}</p>` : ''}
    ${['login', 'signup', 'otp'].includes(mode) ? `<p class="small muted auth-foot">${tje('登录后学习进度会自动同步到云端。<a href="privacy.html" target="_blank">隐私政策</a>', 'ログインすると学習記録がクラウドに自動で同期されます。<a href="privacy.html" target="_blank">プライバシーポリシー</a>', 'Your progress syncs to the cloud after you sign in. <a href="privacy.html" target="_blank">Privacy Policy</a>')}</p>` : ''}
    ${gate && ['login', 'signup', 'otp'].includes(mode) ? `<button class="btn ghost guest-btn" type="button" data-guest>${tje('先不注册，以游客身份体验 →', '登録せずにゲストとして試す →', 'Try it first as a guest →')}</button>` : ''}
  </div>`;
  const form = host.querySelector('[data-af]'), msg = host.querySelector('[data-msg]');
  const say = (t, ok) => { msg.textContent = t; msg.classList.toggle('ok', !!ok); };
  const remembered = lastEmail(), sp = savedPw();
  if (mode === 'login' && sp && form.pw) { form.email.value = sp.e; try { form.pw.value = decodeURIComponent(escape(atob(sp.p))); } catch (e) { /* 忽略 */ } }
  if (remembered && mode !== 'signup' && form.email && !form.email.value) {
    form.email.value = remembered;
    if (mode === 'login' && form.pw) setTimeout(() => { try { form.pw.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } }, 300);
  }
  host.querySelectorAll('[data-ui]').forEach(b => { b.onclick = e => { e.stopPropagation(); try { localStorage.setItem('dojo-ui', b.dataset.ui); } catch (err) { /* 忽略 */ } if (typeof i18nStatic === 'function') i18nStatic(); authScreen(mode); }; });
  host.querySelectorAll('[data-mode]').forEach(b => { b.onclick = e => { e.stopPropagation(); authScreen(b.dataset.mode); }; });
  host.querySelectorAll('[data-eye]').forEach(b => { b.onclick = () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? tje('显示', '表示', 'Show') : tje('隐藏', '隠す', 'Hide'); }; });
  const x = host.querySelector('[data-close]'); if (x) x.onclick = () => host.remove();
  const gb = host.querySelector('[data-guest]');
  if (gb) gb.onclick = () => { setGuest(true); authGate(null); render(); toast(tje('游客模式：可以先体验入门内容，注册后解锁全部', 'ゲストモード：入門コンテンツをお試しいただけます。登録するとすべて使えます', 'Guest mode: try the basics now; sign up to unlock everything')); };
  const ap = host.querySelector('[data-apple]');
  if (ap) ap.onclick = async () => { const c = await cloudClient(); const { error } = await c.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: REDIRECT() } }); if (error) say(authMsg(error)); };
  const g = host.querySelector('[data-google]');
  if (g) g.onclick = async () => { const c = await cloudClient(); const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: REDIRECT() } }); if (error) say(authMsg(error)); };
  let otpSent = false, signupEmail = '';
  form.onsubmit = async e => {
    e.preventDefault();
    const email = form.email ? form.email.value.trim() : '', pwd = form.pw ? form.pw.value : '';
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say(tje('请填写正确的邮箱。', '正しいメールアドレスを入力してください。', 'Please enter a valid email.'));
    if (form.pw && pwd.length < 8) return say(tje('密码至少 8 位。', 'パスワードは 8 文字以上にしてください。', 'Password must be at least 8 characters.'));
    if (form.pw2 && form.pw2.value !== pwd) return say(tje('两次输入的密码不一样。', '2 回入力したパスワードが一致しません。', 'The passwords do not match.'));
    if (form.agree && !form.agree.checked) return say(tje('请先勾选同意隐私政策。', 'プライバシーポリシーへの同意にチェックしてください。', 'Please agree to the Privacy Policy first.'));
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true; say(tje('请稍候……', 'お待ちください…', 'Please wait…'));
    try {
      const c = await cloudClient();
      if (mode === 'login') {
        const r = await c.auth.signInWithPassword({ email, password: pwd });
        if (r.error) throw r.error;
        rememberPw(form, email, pwd);
        return afterLogin(r.data.user);
      }
      if (mode === 'signup') {
        const r = await c.auth.signUp({ email, password: pwd, options: { emailRedirectTo: REDIRECT() } });
        if (r.error) throw r.error;
        if (r.data.user && r.data.user.identities && !r.data.user.identities.length) throw new Error('already registered');
        if (r.data.session) return afterLogin(r.data.user);
        // 邮件里有链接，也有验证码（Supabase 的 Confirm signup 模板里要加 {{ .Token }}，见 docs/SUPABASE_SETUP.md 7.2）。
        // 装到桌面的版本点链接会跳到浏览器里登录，所以优先让用户在这里填验证码。
        form.innerHTML = uiJa() ? `<p>あと少しです！<b>${esc(email)}</b> に確認メールを送りました。</p>
          <p class="small">メールに記載の<b>確認コード</b>を下に入力してください。メールにリンクしかない場合は、リンクを開くだけで登録が完了します。</p>
          <input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="${CODE}">
          <button class="btn pri big" type="submit">登録を完了する</button>
          <div class="row between"><button class="btn ghost small" type="button" data-resend>メールを再送信</button><button class="btn ghost small" type="button" data-mode="login">${BACK}</button></div>
          <p class="small tip-spam">⚠️ 受信トレイにない場合は、<b>迷惑メール</b>フォルダをご確認ください（送信者名は「猫先生」です）。「迷惑メールではない」に設定すると、次回から届きやすくなります。</p>`
          : `<p>差一步！我们给 <b>${esc(email)}</b> 发了一封确认邮件。</p>
          <p class="small">把邮件里的<b>验证码</b>填在下面；邮件里只有链接的话，直接点链接也能完成注册。</p>
          <input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="邮件里的验证码">
          <button class="btn pri big" type="submit">完成注册</button>
          <div class="row between"><button class="btn ghost small" type="button" data-resend>重新发送邮件</button><button class="btn ghost small" type="button" data-mode="login">← 返回登录</button></div>
          <p class="small tip-spam">⚠️ 收件箱里没有的话，请到<b>垃圾邮件 / 迷惑邮件 / 广告邮件</b>文件夹找找，发件人是「猫先生」。找到后标记为「不是垃圾邮件」，以后就不会再被拦了。</p>`;
        form.querySelector('[data-mode]').onclick = () => authScreen('login');
        form.querySelector('[data-resend]').onclick = async e => {
          e.stopPropagation();
          const r2 = await c.auth.resend({ type: 'signup', email, options: { emailRedirectTo: REDIRECT() } });
          say(r2.error ? authMsg(r2.error) : tje('已重新发送，请查看邮箱。', '再送信しました。メールをご確認ください。', 'Sent again. Please check your inbox.'), !r2.error);
        };
        form.code.focus();
        mode = 'signupcode'; signupEmail = email;
        return say('');
      }
      if (mode === 'signupcode') {
        const code = form.code.value.replace(/\D/g, '');
        if (code.length < 6) return say(tje('请输入邮件里的验证码。', 'メールに記載の確認コードを入力してください。', 'Please enter the code from the email.'));
        const r = await c.auth.verifyOtp({ email: signupEmail, token: code, type: 'signup' });
        if (r.error) throw r.error;
        return afterLogin(r.data.user);
      }
      if (mode === 'otp') {
        if (!otpSent) {
          const r = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: REDIRECT() } });
          if (r.error) throw r.error;
          otpSent = true;
          form.querySelector('.otp-row').hidden = false; form.email.readOnly = true;
          btn.textContent = tje('登录', 'ログイン', 'Sign in'); form.code.focus();
          return say(tje('验证码已发送，请查看邮箱（也可以直接点邮件里的链接）。收件箱没有的话，看看垃圾邮件 / 迷惑邮件文件夹。', '確認コードを送信しました。メールをご確認ください（メール内のリンクを開いてもログインできます）。受信トレイにない場合は迷惑メールフォルダをご確認ください。', 'Code sent. Check your inbox (or tap the link in the email). If you cannot find it, check the spam folder.'), true);
        }
        const code = form.code.value.replace(/\D/g, '');
        if (code.length < 6) return say(tje('请输入邮件里的验证码。', 'メールに記載の確認コードを入力してください。', 'Please enter the code from the email.'));
        const r = await c.auth.verifyOtp({ email, token: code, type: 'email' });
        if (r.error) throw r.error;
        return afterLogin(r.data.user);
      }
      if (mode === 'forgot') {
        const r = await c.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT() });
        if (r.error) throw r.error;
        return say(tje('已发送！请打开邮件里的链接设置新密码（没收到看看垃圾邮件 / 迷惑邮件文件夹）。', '送信しました！メール内のリンクから新しいパスワードを設定してください（届かない場合は迷惑メールフォルダをご確認ください）。', 'Sent! Open the link in the email to set a new password (check spam if you cannot find it).'), true);
      }
      if (mode === 'newpw') {
        const r = await c.auth.updateUser({ password: pwd });
        if (r.error) throw r.error;
        history.replaceState(null, '', location.pathname + '#home');
        toast(tje('新密码已保存', '新しいパスワードを保存しました', 'New password saved'));
        return afterLogin(r.data.user);
      }
    } catch (err) { say(authMsg(err)); }
    finally { btn.disabled = false; }
  };
  const first = form.querySelector('input'); if (first && !gate) setTimeout(() => first.focus(), 50);
}
