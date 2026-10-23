// 账号、云同步、意见反馈。后端是 Supabase（免费版，东京机房），配置在 config.js，建库步骤见 docs/SUPABASE_SETUP.md。
// 没配置时这些功能全部隐藏，网站照常离线使用。
const cloudOn = () => typeof CLOUD !== 'undefined' && CLOUD.url && CLOUD.anonKey;
let sb = null, sbUser = null, sbLoading = null, syncTimer = null, syncBusy = false, syncNote = '';

function cloudClient() {
  if (sb) return Promise.resolve(sb);
  if (!sbLoading) {
    sbLoading = new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
      s.onload = () => { sb = window.supabase.createClient(CLOUD.url, CLOUD.anonKey, { auth: { persistSession: true, autoRefreshToken: true } }); ok(sb); };
      s.onerror = () => { sbLoading = null; fail(new Error('无法连接服务器')); };
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
    const d = h(`<div class="word-sheet" role="dialog" aria-label="选择进度">
      <b>这个账号在云端已经有学习进度</b>
      <div class="small">云端：${data.xp} 经验，${new Date(remoteAt).toLocaleString()}<br>这台设备：${S.xp} 经验</div>
      <div class="row"><button class="btn pri" type="button" data-r>用云端的进度</button><button class="btn" type="button" data-l>用这台设备的进度</button></div>
      <div class="small muted">另一份会被覆盖。拿不准的话，选经验多的那份。</div>
    </div>`);
    document.body.append(d);
    d.querySelector('[data-r]').onclick = () => { d.remove(); resolve(useRemote(data, remoteAt)); };
    d.querySelector('[data-l]').onclick = () => { d.remove(); resolve(cloudPush()); };
  });
}
function useRemote(data, remoteAt) {
  const keep = localKeep();
  S = Object.assign(blank(), data.data, keep, { syncUser: sbUser.id, syncedAt: remoteAt, modAt: remoteAt });
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 忽略 */ }
  syncNote = '已从云端恢复进度';
  applyTheme(); render(); updateTop();
}
async function cloudPush() {
  if (!sbUser || syncBusy) return;
  syncBusy = true;
  try {
    const c = await cloudClient();
    const now = new Date();
    const data = Object.assign({}, S); delete data.syncedAt; delete data.syncUser;
    const { error } = await c.from('progress').upsert({ user_id: sbUser.id, data, xp: S.xp, updated_at: now.toISOString() });
    if (error) throw error;
    S.syncUser = sbUser.id; S.syncedAt = now.getTime();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 忽略 */ }
    syncNote = '已同步 ' + now.toLocaleTimeString();
  } catch (e) {
    syncNote = '同步失败，稍后会再试：' + (e.message || e);
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
const mustLogin = () => cloudOn() && CLOUD.requireLogin;
async function cloudInit() {
  if (!cloudOn()) return;
  document.querySelectorAll('[data-feedback-link]').forEach(a => { a.hidden = false; });
  // 不用账号的人不多下载任何东西：只有以前登录过、要求必须登录、或者从邮件链接回来时才加载 SDK
  if (!mustLogin() && !fromEmailLink() && !Object.keys(localStorage).some(k => k.startsWith('sb-'))) return;
  if (mustLogin()) authGate('loading');
  try {
    const c = await cloudClient();
    c.auth.onAuthStateChange((event, session) => {
      sbUser = session ? session.user : null;
      if (event === 'PASSWORD_RECOVERY') setTimeout(() => authScreen('newpw'), 0);
    });
    const { data } = await c.auth.getSession();
    sbUser = data.session ? data.session.user : null;
    if (/type=recovery/.test(location.hash)) return authScreen('newpw');
    if (sbUser) { authGate(null); await cloudPull(true); if (fromEmailLink()) { history.replaceState(null, '', location.pathname + '#home'); render(); } }
    else if (mustLogin()) authScreen(/error_description=/.test(location.hash) ? 'linkerr' : 'login');
  } catch (e) {
    syncNote = '暂时连不上服务器，进度先保存在本机';
    if (mustLogin() && !sbUser) authGate('offline');
  }
}

/* ---------- 「我的」页面的账号面板 ---------- */
function accountPanel() {
  if (!cloudOn()) return null;
  const p = h(`<section class="panel" id="account"><h2>账号与同步</h2><div data-acc>加载中……</div></section>`);
  const box = p.querySelector('[data-acc]');
  const draw = () => {
    if (sbUser) {
      box.innerHTML = `<p>已登录：<b>${esc(sbUser.email || '')}</b></p>
        <p class="small muted" data-sync-note>${esc(syncNote || (S.syncedAt ? '上次同步 ' + new Date(S.syncedAt).toLocaleString() : '还没有同步'))}</p>
        <p class="small muted">学习进度会自动同步。换手机或换浏览器后，用同一个账号登录就能接着学。</p>
        <div class="row"><button class="btn pri" type="button" data-sync>立即同步</button><button class="btn" type="button" data-out>退出登录</button><button class="btn ghost danger" type="button" data-del>删除账号</button></div>`;
      box.querySelector('[data-sync]').onclick = async () => { box.querySelector('[data-sync-note]').textContent = '同步中……'; await cloudPull(true).catch(() => {}); await cloudPush(); };
      box.querySelector('[data-out]').onclick = async () => { await cloudPush(); await sb.auth.signOut(); sbUser = null; syncNote = ''; draw(); toast('已退出登录，进度仍保存在这台设备上'); if (mustLogin()) authScreen('login'); };
      box.querySelector('[data-del]').onclick = async () => {
        if (!confirm('删除账号会同时删除云端的学习进度，无法恢复。这台设备上的进度会保留。确定删除吗？')) return;
        const { error } = await sb.rpc('delete_my_account');
        if (error) return toast('删除失败：' + error.message);
        await sb.auth.signOut(); sbUser = null; delete S.syncUser; delete S.syncedAt; save(); draw(); toast('账号已删除'); if (mustLogin()) authScreen('login');
      };
      return;
    }
    box.innerHTML = `<p class="small muted">${mustLogin() ? '' : '注册是可选的：不注册也能用全部功能。'}登录后学习进度会保存到云端，换手机、换浏览器都不丢。</p>
      <div class="row"><button class="btn pri" type="button" data-login>登录 / 注册</button></div>`;
    box.querySelector('[data-login]').onclick = e => { e.stopPropagation(); authScreen('login'); };
  };
  if (sbUser || !Object.keys(localStorage).some(k => k.startsWith('sb-'))) draw();
  else cloudClient().then(c => c.auth.getSession()).then(({ data }) => { sbUser = data.session ? data.session.user : null; draw(); }).catch(() => { box.textContent = '暂时连不上服务器。'; });
  return p;
}

/* ---------- 意见反馈：不用登录也能发 ---------- */
function feedbackSheet(kind = 'idea', context = '') {
  if (!cloudOn()) return;
  closeSheet();
  const sh = h(`<div class="word-sheet" role="dialog" aria-label="意见反馈">
    <button class="ws-x" type="button" aria-label="关闭">×</button>
    <b>意见反馈</b>
    <div class="seg" role="group">${[['bug', '出错了'], ['content', '内容有误'], ['idea', '建议'], ['other', '其他']].map(([k, t]) => `<button type="button" data-k="${k}" class="${k === kind ? 'on' : ''}">${t}</button>`).join('')}</div>
    <textarea rows="5" maxlength="4000" placeholder="遇到了什么问题，或者希望增加什么？内容有误的话，请写上是哪个词或哪句话。">${esc(context)}</textarea>
    <input type="text" maxlength="200" placeholder="联系方式（选填，邮箱或微信，方便我们回复你）">
    <div class="row"><button class="btn pri" type="button" data-send>发送</button><span class="small muted" data-st></span></div>
  </div>`);
  document.body.append(sh);
  let k = kind;
  sh.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { k = b.dataset.k; sh.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x === b)); }; });
  sh.querySelector('.ws-x').onclick = closeSheet;
  sh.querySelector('[data-send]').onclick = async () => {
    const message = sh.querySelector('textarea').value.trim(), st = sh.querySelector('[data-st]');
    if (!message) { st.textContent = '请先写点内容。'; return; }
    st.textContent = '发送中……';
    try {
      const c = await cloudClient();
      const { error } = await c.from('feedback').insert({ kind: k, message, contact: sh.querySelector('input').value.trim() || null, page: location.hash.slice(0, 200), app_version: 'web', user_id: sbUser ? sbUser.id : null });
      if (error) throw error;
      sh.innerHTML = '<b>谢谢你的反馈！</b><div class="small muted">我们会认真看每一条。</div>';
      setTimeout(closeSheet, 2200);
    } catch (e) { st.textContent = '发送失败：' + (e.message || e); }
  };
  setTimeout(() => sh.querySelector('textarea').focus(), 50);
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-feedback-link]');
  if (a) { e.preventDefault(); e.stopPropagation(); feedbackSheet(); }
}, true);

/* ---------- 登录 / 注册界面 ---------- */
// mode：login 密码登录 | signup 注册 | otp 邮箱验证码登录 | forgot 忘记密码 | newpw 设置新密码 | linkerr 邮件链接失效
// 强制登录（CLOUD.requireLogin）时这个界面挡住整个网站，登录成功才消失；否则是可以关掉的弹层。
const REDIRECT = () => location.origin + location.pathname;
function authGate(state) {
  let g = document.getElementById('auth-gate');
  if (!state) { if (g) g.remove(); document.body.classList.remove('gated'); return; }
  if (!g) { g = h('<div id="auth-gate" class="auth-gate" role="dialog" aria-modal="true"></div>'); document.body.append(g); }
  document.body.classList.add('gated');
  if (state === 'loading') g.innerHTML = '<div class="auth-card"><div class="auth-brand">日语道场</div><p class="muted">正在连接……</p></div>';
  if (state === 'offline') g.innerHTML = '<div class="auth-card"><div class="auth-brand">日语道场</div><p>需要联网登录一次。</p><p class="small muted">请检查网络后重新打开。登录过的设备之后没有网络也能使用。</p><button class="btn pri" type="button" onclick="location.reload()">重试</button></div>';
  return g;
}
function authMsg(m) {
  m = String(m && m.message || m);
  if (/Invalid login/i.test(m)) return '邮箱或密码不对。';
  if (/already.*registered|already been registered/i.test(m)) return '这个邮箱已经注册过了，请直接登录。';
  if (/Email not confirmed/i.test(m)) return '还没有确认邮箱：请打开注册时收到的确认邮件，点里面的链接。';
  if (/rate limit|too many/i.test(m)) return '操作太频繁了，请过几分钟再试。';
  if (/Token has expired|invalid.*otp|otp.*invalid/i.test(m)) return '验证码不对或已过期，请重新获取。';
  if (/should be at least|Password should/i.test(m)) return '密码至少 8 位。';
  if (/same.*password|different from the old/i.test(m)) return '新密码不能和旧密码一样。';
  if (/fetch|network/i.test(m)) return '连不上服务器，请检查网络。';
  return '出错了：' + m;
}
async function afterLogin(user) {
  sbUser = user;
  authGate(null); closeSheet();
  await cloudPull(true);
  toast('登录成功' + (user.email ? '：' + user.email : ''));
  render();
}
function authScreen(mode = 'login') {
  if (!cloudOn()) return;
  const gate = mustLogin() || mode === 'newpw';
  const host = gate ? authGate('form') : (closeSheet(), h('<div class="word-sheet auth-sheet" role="dialog"></div>'));
  if (!gate) document.body.append(host);
  const tabs = ['login', 'signup', 'otp'].includes(mode) ? `<div class="seg auth-tabs" role="tablist">${[['login', '登录'], ['signup', '注册'], ['otp', '验证码登录']].map(([k, t]) => `<button type="button" role="tab" data-mode="${k}" class="${k === mode ? 'on' : ''}">${t}</button>`).join('')}</div>` : '';
  const pw = (name, ph, ac) => `<div class="pw-wrap"><input type="password" name="${name}" placeholder="${ph}" autocomplete="${ac}" minlength="8" required><button type="button" class="pw-eye" data-eye aria-label="显示密码">显示</button></div>`;
  const forms = {
    login: `<input type="email" name="email" placeholder="邮箱" autocomplete="email" required>${pw('pw', '密码', 'current-password')}
      <button class="btn pri big" type="submit">登录</button><button class="btn ghost small" type="button" data-mode="forgot">忘记密码？</button>`,
    signup: `<input type="email" name="email" placeholder="邮箱" autocomplete="email" required>${pw('pw', '密码（至少 8 位）', 'new-password')}${pw('pw2', '再输一次密码', 'new-password')}
      <label class="small agree"><input type="checkbox" name="agree" required> 我已阅读并同意 <a href="privacy.html" target="_blank">隐私政策</a></label>
      <button class="btn pri big" type="submit">注册</button>`,
    otp: `<p class="small muted">不用密码：输入邮箱，我们发一个 6 位验证码给你。</p><input type="email" name="email" placeholder="邮箱" autocomplete="email" required>
      <div class="otp-row" hidden><input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 位验证码"></div>
      <button class="btn pri big" type="submit" data-otp-btn>发送验证码</button>`,
    forgot: `<p>输入注册时用的邮箱，我们会发一封重置密码的邮件。点邮件里的链接回到这里，就可以设置新密码。</p>
      <input type="email" name="email" placeholder="邮箱" autocomplete="email" required>
      <button class="btn pri big" type="submit">发送重置邮件</button><button class="btn ghost small" type="button" data-mode="login">← 返回登录</button>`,
    newpw: `<p>设置一个新密码。</p>${pw('pw', '新密码（至少 8 位）', 'new-password')}${pw('pw2', '再输一次', 'new-password')}
      <button class="btn pri big" type="submit">保存新密码</button>`,
    linkerr: `<p>这个邮件链接已经失效或用过了。</p><p class="small muted">重新登录；忘记密码的话，再发一次重置邮件。</p>
      <button class="btn pri big" type="button" data-mode="login">去登录</button><button class="btn ghost small" type="button" data-mode="forgot">忘记密码</button>`
  };
  const title = { login: '欢迎回来', signup: '创建账号', otp: '验证码登录', forgot: '找回密码', newpw: '设置新密码', linkerr: '链接已失效' }[mode];
  host.innerHTML = `<div class="auth-card">
    ${gate ? '' : '<button class="ws-x" type="button" data-close aria-label="关闭">×</button>'}
    <div class="auth-brand">${typeof neko === 'function' ? neko('happy', 'mini') : ''}<span>日语道场</span></div>
    <h2>${title}</h2>
    ${tabs}
    <form class="acc-form" data-af novalidate>${forms[mode]}</form>
    <p class="small auth-msg" data-msg role="status"></p>
    ${['login', 'signup', 'otp'].includes(mode) && CLOUD.google ? '<div class="auth-or"><span>或者</span></div><button class="btn big google-btn" type="button" data-google><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>用 Google 登录</button>' : ''}
    ${['login', 'signup', 'otp'].includes(mode) ? '<p class="small muted auth-foot">登录后学习进度会自动同步到云端。<a href="privacy.html" target="_blank">隐私政策</a></p>' : ''}
  </div>`;
  const form = host.querySelector('[data-af]'), msg = host.querySelector('[data-msg]');
  const say = (t, ok) => { msg.textContent = t; msg.classList.toggle('ok', !!ok); };
  host.querySelectorAll('[data-mode]').forEach(b => { b.onclick = e => { e.stopPropagation(); authScreen(b.dataset.mode); }; });
  host.querySelectorAll('[data-eye]').forEach(b => { b.onclick = () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? '显示' : '隐藏'; }; });
  const x = host.querySelector('[data-close]'); if (x) x.onclick = () => host.remove();
  const g = host.querySelector('[data-google]');
  if (g) g.onclick = async () => { const c = await cloudClient(); const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: REDIRECT() } }); if (error) say(authMsg(error)); };
  let otpSent = false;
  form.onsubmit = async e => {
    e.preventDefault();
    const email = form.email ? form.email.value.trim() : '', pwd = form.pw ? form.pw.value : '';
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say('请填写正确的邮箱。');
    if (form.pw && pwd.length < 8) return say('密码至少 8 位。');
    if (form.pw2 && form.pw2.value !== pwd) return say('两次输入的密码不一样。');
    if (form.agree && !form.agree.checked) return say('请先勾选同意隐私政策。');
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true; say('请稍候……');
    try {
      const c = await cloudClient();
      if (mode === 'login') {
        const r = await c.auth.signInWithPassword({ email, password: pwd });
        if (r.error) throw r.error;
        return afterLogin(r.data.user);
      }
      if (mode === 'signup') {
        const r = await c.auth.signUp({ email, password: pwd, options: { emailRedirectTo: REDIRECT() } });
        if (r.error) throw r.error;
        if (r.data.user && r.data.user.identities && !r.data.user.identities.length) throw new Error('already registered');
        if (r.data.session) return afterLogin(r.data.user);
        form.innerHTML = `<p>差一步！我们给 <b>${esc(email)}</b> 发了一封确认邮件，点里面的链接就完成注册了。</p><p class="small muted">没收到的话看看垃圾邮件文件夹。</p><button class="btn ghost small" type="button" data-mode="login">← 返回登录</button>`;
        form.querySelector('[data-mode]').onclick = () => authScreen('login');
        return say('');
      }
      if (mode === 'otp') {
        if (!otpSent) {
          const r = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: REDIRECT() } });
          if (r.error) throw r.error;
          otpSent = true;
          form.querySelector('.otp-row').hidden = false; form.email.readOnly = true;
          btn.textContent = '登录'; form.code.focus();
          return say('验证码已发送，请查看邮箱（也可以直接点邮件里的链接）。', true);
        }
        const code = form.code.value.replace(/\D/g, '');
        if (code.length !== 6) return say('请输入 6 位验证码。');
        const r = await c.auth.verifyOtp({ email, token: code, type: 'email' });
        if (r.error) throw r.error;
        return afterLogin(r.data.user);
      }
      if (mode === 'forgot') {
        const r = await c.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT() });
        if (r.error) throw r.error;
        return say('已发送！请打开邮件里的链接设置新密码（没收到看看垃圾邮件）。', true);
      }
      if (mode === 'newpw') {
        const r = await c.auth.updateUser({ password: pwd });
        if (r.error) throw r.error;
        history.replaceState(null, '', location.pathname + '#home');
        toast('新密码已保存');
        return afterLogin(r.data.user);
      }
    } catch (err) { say(authMsg(err)); }
    finally { btn.disabled = false; }
  };
  const first = form.querySelector('input'); if (first && !gate) setTimeout(() => first.focus(), 50);
}
