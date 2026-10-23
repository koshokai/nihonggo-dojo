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

async function cloudInit() {
  if (!cloudOn()) return;
  document.querySelectorAll('[data-feedback-link]').forEach(a => { a.hidden = false; });
  // 只有以前登录过才在启动时加载 SDK，没用账号的人不多下载任何东西
  if (!Object.keys(localStorage).some(k => k.startsWith('sb-'))) return;
  try {
    const c = await cloudClient();
    const { data } = await c.auth.getSession();
    sbUser = data.session ? data.session.user : null;
    c.auth.onAuthStateChange((_e, session) => { sbUser = session ? session.user : null; });
    if (sbUser) await cloudPull(true);
  } catch (e) { syncNote = '暂时连不上服务器，进度先保存在本机'; }
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
      box.querySelector('[data-out]').onclick = async () => { await cloudPush(); await sb.auth.signOut(); sbUser = null; syncNote = ''; draw(); toast('已退出登录，进度仍保存在这台设备上'); };
      box.querySelector('[data-del]').onclick = async () => {
        if (!confirm('删除账号会同时删除云端的学习进度，无法恢复。这台设备上的进度会保留。确定删除吗？')) return;
        const { error } = await sb.rpc('delete_my_account');
        if (error) return toast('删除失败：' + error.message);
        await sb.auth.signOut(); sbUser = null; delete S.syncUser; delete S.syncedAt; save(); draw(); toast('账号已删除');
      };
      return;
    }
    box.innerHTML = `<p class="small muted">注册是可选的：不注册也能用全部功能。注册后进度会保存到云端，换设备不丢。</p>
      <form class="acc-form" data-form>
        <input type="email" name="email" placeholder="邮箱" autocomplete="email" required>
        <input type="password" name="pw" placeholder="密码（至少 8 位）" autocomplete="current-password" minlength="8" required>
        <div class="row"><button class="btn pri" type="submit" data-act="in">登录</button><button class="btn" type="submit" data-act="up">注册</button><button class="btn ghost" type="button" data-reset>忘记密码</button></div>
      </form>
      <p class="small" data-msg></p>`;
    const form = box.querySelector('[data-form]'), msg = box.querySelector('[data-msg]');
    let act = 'in';
    form.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => { act = b.dataset.act; }; });
    form.onsubmit = async e => {
      e.preventDefault();
      const email = form.email.value.trim(), password = form.pw.value;
      msg.textContent = '请稍候……';
      try {
        const c = await cloudClient();
        const r = act === 'up'
          ? await c.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname + '#me' } })
          : await c.auth.signInWithPassword({ email, password });
        if (r.error) throw r.error;
        if (act === 'up' && !r.data.session) { msg.textContent = '注册成功！请打开邮箱里的确认邮件，点链接后回来登录。'; return; }
        sbUser = r.data.user;
        msg.textContent = '';
        await cloudPull(true);
        draw();
      } catch (err) {
        const m = String(err.message || err);
        msg.textContent = /Invalid login/i.test(m) ? '邮箱或密码不对。' : /registered/i.test(m) ? '这个邮箱已经注册过了，请直接登录。' : /confirm/i.test(m) ? '请先点确认邮件里的链接。' : '出错了：' + m;
      }
    };
    box.querySelector('[data-reset]').onclick = async () => {
      const email = form.email.value.trim();
      if (!email) { msg.textContent = '先在上面填好邮箱。'; return; }
      const c = await cloudClient();
      const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#me' });
      msg.textContent = error ? '发送失败：' + error.message : '已发送重置密码的邮件，请查收。';
    };
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
