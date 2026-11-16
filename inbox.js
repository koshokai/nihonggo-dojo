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
// 数据库函数自动发的伙伴、挑战消息是中文模板；学中文的日本用户看到的是日语
function msgJa(m) {
  if (!uiJa() || !m) return m;
  const nick = n => n === '伙伴' ? '仲間' : n + ' さん';
  const T = [
    [/^(.+) 戳了你一下$/, x => `${nick(x[1])}がつついています`],
    [/^(.+) 给你点了个赞$/, x => `${nick(x[1])}から「いいね」が届きました`],
    [/^(.+) 向你发起了挑战$/, x => `${nick(x[1])}から挑戦状が届きました`],
    [/^(.+) 完成了你的挑战$/, x => `${nick(x[1])}があなたの挑戦に答えました`],
    [/^今天的任务还没做哦$/, () => '今日のタスクがまだです'], [/^好久不见$/, () => 'お久しぶりです'], [/^开始你的第一课吧$/, () => '最初のレッスンを始めましょう'], [/^连续 (\d+) 天了，别断在今天$/, x => `${x[1]}日連続！今日も続けよう`]
  ];
  const B = [
    [/^今天一起学吧！完成今天的目标，你们的「一起打卡」天数就能 \+1。$/, () => '今日も一緒に学ぼう！ふたりとも今日の目標を達成すると「一緒に達成」が +1 されます。'],
    [/^今天的目标完成得真棒！明天也一起加油。$/, () => '今日の目標達成、すばらしい！明日も一緒にがんばろう。'],
    [/^同一组 10 道题（(.+?)），对方得了 (\d+) 分。有空的时候来比一比吧！$/, x => `同じ 10 問（${x[1]}）で相手は ${x[2]} 点。時間があるときに勝負しよう！`],
    [/^你 (\d+) 分，对方 (\d+) 分，(.+)。$/, x => `あなた ${x[1]} 点、相手 ${x[2]} 点で、${{ 对方赢了: '相手の勝ち', 打成平手: '引き分け', 你赢了: 'あなたの勝ち' }[x[3]] || x[3]}です。`]
  ];
  const L = { 去学习: '学習する', 看看伙伴: '仲間を見る', 接受挑战: '挑戦する', 开始: 'スタート', 去打卡: '学習する', 回来学: '再開する', 看看: '見てみる' };
  const tr = (str, list) => { for (const [re, f] of list) { const x = String(str || '').match(re); if (x) return f(x); } return str; };
  return Object.assign({}, m, { title: tr(m.title, T), body: tr(m.body, B), action_label: L[m.action_label] || m.action_label });
}
function msgCard(m, onDone) {
  m = msgJa(m);
  const reps = Array.isArray(m.replies) ? m.replies : [];
  // 标题、日期一行；正文；按钮一行（小号按钮，放不下就换行，「知道了」靠右），文字再长也不会把卡片撑变形
  const el = h(`<section class="msg-card ${m.read_at ? 'read' : ''}">
    <div class="msg-head"><b>${esc(m.title)}</b><span class="small muted">${new Date(m.created_at).toLocaleDateString(uiJa() ? 'ja-JP' : 'zh-CN')}</span></div>
    <div class="small msg-body">${esc(m.body)}</div>
    ${m.reply ? `<div class="small muted">${tj('你的回复：', 'あなたの返信：')}${esc(m.reply)}</div>` : ''}
    <div class="msg-acts">${m.action ? `<button class="btn pri" type="button" data-act>${esc(m.action_label || tj('去看看', '見てみる'))}</button>` : ''}
      ${m.reply ? '' : reps.map((r, i) => `<button class="chip-btn" type="button" data-rep="${i}">${esc(r)}</button>`).join('')}
      ${m.read_at ? '' : `<button class="msg-x" type="button" data-x>${tj('知道了', '確認しました')}</button>`}</div></section>`);
  const done = () => { if (onDone) onDone(el); };
  const go = el.querySelector('[data-act]');
  if (go) go.onclick = async e => { e.stopPropagation(); await inboxMark(m); done(); if (/^#/.test(m.action)) navTo(m.action); else window.open(m.action, '_blank', 'noopener'); };
  el.querySelectorAll('[data-rep]').forEach(b => { b.onclick = async e => { e.stopPropagation(); await inboxMark(m, reps[+b.dataset.rep]); toast(tj('收到，谢谢你的回复', '返信ありがとうございます')); done(); }; });
  const x = el.querySelector('[data-x]');
  if (x) x.onclick = async e => { e.stopPropagation(); await inboxMark(m); done(); };
  return el;
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
  if (await Notification.requestPermission() !== 'granted') throw new Error(tj('浏览器没有允许通知。可以在浏览器的网站设置里把「通知」改成允许。', '通知が許可されていません。ブラウザのサイト設定で「通知」を許可してください。'));
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
  const p = h(`<section class="panel" id="inbox"><h2>${tj('消息与学习提醒', 'お知らせと学習リマインダー')}</h2><div data-push></div><div data-msgs class="msg-list"></div></section>`);
  const pushBox = p.querySelector('[data-push]'), msgBox = p.querySelector('[data-msgs]');
  const hours = [[8, tj('早上 8 点', '朝 8 時')], [12, tj('中午 12 点', '昼 12 時')], [19, tj('晚上 7 点', '夜 7 時')], [21, tj('晚上 9 点', '夜 9 時')]];
  const drawPush = async () => {
    if (!pushOk()) { pushBox.innerHTML = ''; return; }
    if (isIOS() && !isStandalone()) { pushBox.innerHTML = `<p class="small muted">${tj('iPhone 要先把网站「添加到主屏幕」，从主屏幕图标打开后才能开启学习提醒（需要 iOS 16.4 以上）。', 'iPhone では、サイトを「ホーム画面に追加」し、ホーム画面のアイコンから開くと学習リマインダーをオンにできます（iOS 16.4 以上が必要です）。')}</p>`; return; }
    const sub = await pushSub().catch(() => null), on = !!sub && Notification.permission === 'granted';
    const hr = S.remindSmart ? 'smart' : S.remindHour || 21;
    const smartH = typeof habitHour === 'function' ? habitHour() : null;
    pushBox.innerHTML = `<div class="row between"><span>${tj('学习提醒', '学習リマインダー')}</span><div class="seg"><button type="button" data-on class="${on ? 'on' : ''}">${tj('开', 'オン')}</button><button type="button" data-off class="${on ? '' : 'on'}">${tj('关', 'オフ')}</button></div></div>
      <div class="row between"><span>${tj('提醒时间', '通知の時刻')}</span><div class="seg">${hours.map(([v, t]) => `<button type="button" data-hr="${v}" class="${hr === v ? 'on' : ''}">${t}</button>`).join('')}<button type="button" data-hr="smart" class="${hr === 'smart' ? 'on' : ''}">${tj('智能', 'おまかせ')}</button></div></div>
      ${hr === 'smart' ? `<p class="small">${smartH != null ? tj(`按你的习惯，每天 ${smartH} 点左右提醒（会随着习惯自动调整）。`, `あなたの習慣に合わせて毎日 ${smartH} 時ごろお知らせします（自動で調整）。`) : tj('再学几天，摸清你的习惯后自动设定时间（先按晚上 9 点）。', '数日分の学習時間から自動で決めます（それまでは夜 9 時）。')}</p>` : ''}
      <p class="small muted">${tj('每天最多一条：到了这个时间、当天还没学才提醒。很多天没来会越提醒越少，最后不再打扰。', '通知は 1 日 1 回まで。この時刻になってもまだ学習していない日だけお知らせします。しばらくお休みが続くと通知は少しずつ減り、最後は届かなくなります。')}<span data-pst></span></p>`;
    const st = pushBox.querySelector('[data-pst]');
    const turnOn = async h0 => { st.textContent = tj(' 设置中……', ' 設定中…'); try { await pushEnable(h0); S.remindHour = h0; save(); drawPush(); toast(tj('学习提醒已开启', '学習リマインダーをオンにしました')); } catch (e) { st.textContent = ' ' + (e.message || e); } };
    pushBox.querySelector('[data-on]').onclick = () => turnOn(hr);
    pushBox.querySelector('[data-off]').onclick = async () => { await pushDisable().catch(() => {}); drawPush(); toast(tj('学习提醒已关闭', '学習リマインダーをオフにしました')); };
    pushBox.querySelectorAll('[data-hr]').forEach(b => { b.onclick = () => { const smart = b.dataset.hr === 'smart'; S.remindSmart = smart; const v = smart ? (habitHour() ?? 21) : +b.dataset.hr; if (on) turnOn(v); else { S.remindHour = v; save(); drawPush(); } }; });
  };
  drawPush();
  inboxLoad(true).then(list => {
    if (!list.length) { msgBox.innerHTML = `<p class="small muted">${tj('还没有消息。', 'お知らせはまだありません。')}</p>`; return; }
    list.slice(0, 10).forEach(m => msgBox.append(msgCard(m, el => el.replaceWith(msgCard(m)))));
  }).catch(() => {});
  return p;
}

/* ---------- 新消息提醒：小红点 + 不用刷新就能收到 ---------- */
// 1. 伙伴「戳一下」、接受申请时，对方的页面会通过 Realtime 立刻收到一个信号（只是一个类型代码，不带文字，别人伪造也只能触发一次刷新）
// 2. 页面开着时每 30 秒检查一次未读消息和伙伴申请（保底）
// 有未读时底部「我的」和「我的」菜单里对应的一行显示小红点
// 跟着界面语言：每次收到信号时现算（学中文的日本用户看日语）
const LIVE_TEXT = () => ({ poke: tj('伙伴戳了你一下，今天一起学吧！', '仲間につつかれました。今日も一緒に学習しましょう！'), cheer: tj('伙伴给你点了个赞！', '仲間から「いいね」が届きました！'), accept: tj('伙伴接受了你的申请', '仲間リクエストが承認されました'), request: tj('有人想和你成为学习伙伴', '学習仲間のリクエストが届きました'), challenge: tj('伙伴向你发起了挑战！', '仲間から挑戦状が届きました！'), chaldone: tj('伙伴完成了你的挑战，去看看结果', '仲間があなたの挑戦状に回答しました。結果を見てみましょう') });
const liveBadges = {
  n: { inbox: 0, buddy: 0 },
  set(k, v) { const was = this.n[k]; this.n[k] = v; this.paint(); return v > was; },
  paint() {
    const total = this.n.inbox + this.n.buddy;
    document.querySelectorAll('.tabs a[href="#me"]').forEach(a => { a.classList.toggle('has-dot', total > 0); a.setAttribute('aria-label', total ? tj(`我的（${total} 条新提醒）`, `マイページ（新しいお知らせ ${total} 件）`) : tj('我的', 'マイページ')); });
    document.querySelectorAll('[data-badge]').forEach(el => { const v = this.n[el.dataset.badge] || 0; el.hidden = !v; el.textContent = v > 9 ? '9+' : v || ''; });
  },
  // 打开消息页就算都看过了
  async clear(k) {
    if (k !== 'inbox') return;
    const list = await inboxLoad().catch(() => []);
    await Promise.all(list.filter(m => !m.read_at).slice(0, 20).map(m => inboxMark(m)));
    this.set('inbox', 0);
  }
};
let liveCh = null, liveTimer = null;
async function liveRefresh(fromPing) {
  if (!cloudOn() || document.visibilityState !== 'visible') return;
  const u = await inboxUser().catch(() => null);
  if (!u) return;
  const [msgs, bud, chal] = await Promise.all([
    inboxLoad(true).catch(() => []),
    typeof buddyLoad === 'function' && buddyReady !== false ? buddyLoad(true).catch(() => null) : null,
    typeof chalLoad === 'function' && buddyReady !== false ? chalLoad(true).catch(() => null) : null
  ]);
  // 伙伴那一行的红点 = 伙伴申请 + 还没接受的挑战
  const more = liveBadges.set('inbox', (msgs || []).filter(m => !m.read_at).length) | liveBadges.set('buddy', (bud || []).filter(b => b.status === 'incoming').length + (typeof chalPending === 'function' ? chalPending(chal).length : 0));
  // 正在看相关页面的话直接刷新；首页有新消息时也刷新（显示消息横条）
  const v = (location.hash || '#home').slice(1);
  if ((fromPing || more) && (v === 'buddy' || v === 'me/inbox' || (v === 'home' && more)) && !document.body.classList.contains('focus')) render();
}
async function liveStart() {
  if (liveTimer || !cloudOn()) return;
  const u = await inboxUser().catch(() => null);
  if (!u) return;
  liveTimer = setInterval(() => liveRefresh(), 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') liveRefresh(); });
  liveRefresh();
  try {
    const c = await cloudClient();
    liveCh = c.channel('u-' + u.id);
    liveCh.on('broadcast', { event: 'ping' }, msg => {
      const t = msg && msg.payload && msg.payload.t;
      const lt = LIVE_TEXT(); if (lt[t]) toast(lt[t]);
      buzz(15);
      liveRefresh(true);
    }).subscribe(() => {});
  } catch (e) { /* 没有 Realtime 时只靠每 30 秒检查 */ }
}
// 给另一个用户发一个提醒信号（对方在线时立刻刷新；不在线也没关系，消息已经存在数据库里）
async function livePing(uid, t) {
  try {
    const c = await cloudClient();
    const ch = c.channel('u-' + uid);
    ch.subscribe(st => { if (st === 'SUBSCRIBED') ch.send({ type: 'broadcast', event: 'ping', payload: { t } }).finally(() => setTimeout(() => c.removeChannel(ch), 1000)); });
  } catch (e) { /* 忽略 */ }
}
addEventListener('load', () => setTimeout(liveStart, 2000));
