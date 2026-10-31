// 站内消息和学习提醒推送。消息由后台（admin.html）手动发送，或由 Edge Function notify 每小时自动生成。
// 表结构和部署步骤见 docs/SUPABASE_SETUP.md 第 9 节。没建表时这里什么都不显示。
let inboxCache = null;   // { at, list }：首页经常重绘，一分钟内不重复请求

async function inboxUser() {
  if (!cloudOn()) return null;
  if (sbUser) return sbUser;
  if (!Object.keys(localStorage).some(k => k.startsWith('sb-'))) return null;
  try { const c = await cloudClient(); const { data } = await c.auth.getSession(); return data.session ? data.session.user : null; } catch (e) { return null; }
}
async function inboxLoad(force) {
  if (!force && inboxCache && Date.now() - inboxCache.at < 60000) return inboxCache.list;
  const u = await inboxUser();
  if (!u) return [];
  const c = await cloudClient();
  const { data, error } = await c.from('messages').select('id, created_at, title, body, action, action_label, replies, read_at, reply').eq('user_id', u.id).order('created_at', { ascending: false }).limit(30);
  const list = error ? [] : data;
  inboxCache = { at: Date.now(), list };
  return list;
}
async function inboxMark(m, reply) {
  m.read_at = m.read_at || new Date().toISOString();
  if (reply) m.reply = reply;
  try { const c = await cloudClient(); await c.rpc('mark_message', { mid: m.id, rep: reply || null }); } catch (e) { /* 下次再标记 */ }
}
// 一条消息的卡片：标题、正文、跳转按钮、快捷回复
function msgCard(m, onDone) {
  const reps = Array.isArray(m.replies) ? m.replies : [];
  // 标题、日期一行；正文；按钮一行（小号按钮，放不下就换行，「知道了」靠右），文字再长也不会把卡片撑变形
  const el = h(`<section class="msg-card ${m.read_at ? 'read' : ''}">
    <div class="msg-head"><b>${esc(m.title)}</b><span class="small muted">${new Date(m.created_at).toLocaleDateString('zh-CN')}</span></div>
    <div class="small msg-body">${esc(m.body)}</div>
    ${m.reply ? `<div class="small muted">你的回复：${esc(m.reply)}</div>` : ''}
    <div class="msg-acts">${m.action ? `<button class="btn pri" type="button" data-act>${esc(m.action_label || '去看看')}</button>` : ''}
      ${m.reply ? '' : reps.map((r, i) => `<button class="chip-btn" type="button" data-rep="${i}">${esc(r)}</button>`).join('')}
      ${m.read_at ? '' : '<button class="msg-x" type="button" data-x>知道了</button>'}</div></section>`);
  const done = () => { if (onDone) onDone(el); };
  const go = el.querySelector('[data-act]');
  if (go) go.onclick = async e => { e.stopPropagation(); await inboxMark(m); done(); if (/^#/.test(m.action)) location.hash = m.action; else window.open(m.action, '_blank', 'noopener'); };
  el.querySelectorAll('[data-rep]').forEach(b => { b.onclick = async e => { e.stopPropagation(); await inboxMark(m, reps[+b.dataset.rep]); toast('收到，谢谢你的回复'); done(); }; });
  const x = el.querySelector('[data-x]');
  if (x) x.onclick = async e => { e.stopPropagation(); await inboxMark(m); done(); };
  return el;
}
// 首页问候下面插入未读消息：收成一行小横条（不把今日任务挤下去），点开才显示正文和按钮
function inboxFill(anchor) {
  inboxLoad().then(list => {
    if (!anchor.isConnected) return;
    const un = list.filter(m => !m.read_at);
    if (!un.length) return;
    const bar = h(`<details class="msg-mini"><summary aria-label="${esc(`${un.length} 条未读消息：${un[0].title}，点开查看`)}"><span class="msg-dot" aria-hidden="true">🔔</span><span class="msg-mini-t"><b>${esc(un[0].title)}</b>${un.length > 1 ? `<span class="small muted"> 等 ${un.length} 条消息</span>` : `<span class="small muted"> · ${esc(un[0].body)}</span>`}</span><span class="msg-more small">查看</span></summary><div class="msg-mini-body"></div></details>`);
    const body = bar.querySelector('.msg-mini-body');
    un.slice(0, 3).forEach(m => body.append(msgCard(m, el => { el.remove(); if (!body.children.length) bar.remove(); })));
    anchor.after(bar);
  }).catch(() => {});
}

/* ---------- 推送订阅 ---------- */
const pushOk = () => cloudOn() && CLOUD.vapid && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function b64uBytes(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}
async function pushSub() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}
async function pushEnable(hour) {
  if (await Notification.requestPermission() !== 'granted') throw new Error('浏览器没有允许通知。可以在浏览器的网站设置里把「通知」改成允许。');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(CLOUD.vapid) });
  const j = sub.toJSON();
  const c = await cloudClient();
  const { error } = await c.rpc('save_push_sub', { ep: j.endpoint, p256dh: j.keys.p256dh, auth_key: j.keys.auth, tzname: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo', hr: hour });
  if (error) throw error;
}
async function pushDisable() {
  const sub = await pushSub();
  if (!sub) return;
  try { const c = await cloudClient(); await c.from('push_subs').delete().eq('endpoint', sub.endpoint); } catch (e) { /* 服务器那边发送失败时也会自动清理 */ }
  await sub.unsubscribe();
}

// 「我的」页面：学习提醒开关 + 最近的消息
function inboxPanel() {
  if (!cloudOn()) return null;
  const p = h(`<section class="panel" id="inbox"><h2>消息与学习提醒</h2><div data-push></div><div data-msgs class="msg-list"></div></section>`);
  const pushBox = p.querySelector('[data-push]'), msgBox = p.querySelector('[data-msgs]');
  const hours = [[8, '早上 8 点'], [12, '中午 12 点'], [19, '晚上 7 点'], [21, '晚上 9 点']];
  const drawPush = async () => {
    if (!pushOk()) { pushBox.innerHTML = ''; return; }
    if (isIOS() && !isStandalone()) { pushBox.innerHTML = '<p class="small muted">iPhone 要先把网站「添加到主屏幕」，从主屏幕图标打开后才能开启学习提醒（需要 iOS 16.4 以上）。</p>'; return; }
    const sub = await pushSub().catch(() => null), on = !!sub && Notification.permission === 'granted';
    const hr = S.remindHour || 21;
    pushBox.innerHTML = `<div class="row between"><span>学习提醒</span><div class="seg"><button type="button" data-on class="${on ? 'on' : ''}">开</button><button type="button" data-off class="${on ? '' : 'on'}">关</button></div></div>
      <div class="row between"><span>提醒时间</span><div class="seg">${hours.map(([v, t]) => `<button type="button" data-hr="${v}" class="${hr === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      <p class="small muted">每天最多一条：到了这个时间、当天还没学才提醒。很多天没来会越提醒越少，最后不再打扰。<span data-pst></span></p>`;
    const st = pushBox.querySelector('[data-pst]');
    const turnOn = async h0 => { st.textContent = ' 设置中……'; try { await pushEnable(h0); S.remindHour = h0; save(); drawPush(); toast('学习提醒已开启'); } catch (e) { st.textContent = ' ' + (e.message || e); } };
    pushBox.querySelector('[data-on]').onclick = () => turnOn(hr);
    pushBox.querySelector('[data-off]').onclick = async () => { await pushDisable().catch(() => {}); drawPush(); toast('学习提醒已关闭'); };
    pushBox.querySelectorAll('[data-hr]').forEach(b => { b.onclick = () => { const v = +b.dataset.hr; if (on) turnOn(v); else { S.remindHour = v; save(); drawPush(); } }; });
  };
  drawPush();
  inboxLoad(true).then(list => {
    if (!list.length) { msgBox.innerHTML = '<p class="small muted">还没有消息。</p>'; return; }
    list.slice(0, 10).forEach(m => msgBox.append(msgCard(m, el => el.replaceWith(msgCard(m)))));
  }).catch(() => {});
  return p;
}
