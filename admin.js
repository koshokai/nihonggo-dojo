// 道场后台：看谁今天没学、谁很久没来，用模板一键发站内消息（开了提醒的用户同时收到手机推送）。
// 只有 admins 表里的账号能用，数据库函数里会检查，见 docs/SUPABASE_SETUP.md 第 9 节。
const sb = window.supabase.createClient(CLOUD.url, CLOUD.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
const app = document.getElementById('app');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LANG = { ja: '日语', ko: '韩语', en: '英语' };
const DAY = 864e5;
const dkey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 消息模板：{lang} 在学的语言 · {due} 待复习卡片 · {streak} 连续天数 · {gap} 几天没来
const TEMPLATES = [
  { k: 'today', name: '今日任务没做', title: '今天的任务还没做哦', body: '{lang}今日任务：复习 {due} 张卡片，再学 5 个新词，10 分钟就够。', action: 'home', label: '开始', replies: ['马上去', '今天太忙了'] },
  { k: 'streak', name: '保住连续打卡', title: '连续 {streak} 天了，别断在今天', body: '今天还没打卡，做完今日任务就能续上。', action: 'home', label: '去打卡', replies: ['马上去'] },
  { k: 'review', name: '复习提醒', title: '{due} 张卡片到复习时间了', body: '现在复习记得最牢，拖久了就要重新背。', action: 'home', label: '去复习', replies: ['马上去', '晚点再说'] },
  { k: 'back', name: '好久不见', title: '{gap} 天没见啦', body: '进度都还在。从今天的 5 个新词重新开始就好，不用一次补完。', action: 'home', label: '回来学', replies: ['我回来了', '最近太忙', '内容太难了', '不想学了'] },
  { k: 'first', name: '还没开始学', title: '开始你的第一课吧', body: '每天 10 分钟：先学 5 个{lang}单词，再跟读一句。', action: 'home', label: '开始', replies: ['好的', '不知道从哪学起'] },
  { k: 'praise', name: '表扬鼓励', title: '这几天学得很棒', body: '已经连续 {streak} 天了，保持这个节奏，考试前会轻松很多。', action: '', label: '', replies: ['谢谢！', '想要更多练习'] },
  { k: 'ask', name: '征求建议', title: '想听听你的意见', body: '日语道场哪里不好用？点一下下面的选项告诉我。想多说几句的话，在「我的 → 意见反馈」里写。', action: '', label: '', replies: ['内容太难', '内容太简单', '发音不好', '没时间学', '挺好的'] },
  { k: 'new', name: '上新通知', title: '上新了', body: '', action: 'home', label: '去看看', replies: [] },
  { k: 'custom', name: '自定义', title: '', body: '', action: '', label: '', replies: [] },
];
const ACTIONS = [['', '不跳转'], ['home', '首页 / 今日任务'], ['#study', '学习'], ['#ri', '阅读听力'], ['#exam', '模拟考'], ['#read', '日语阅读'], ['#listen', '日语听力'], ['#me', '我的']];
// home 按用户在学的语言跳到对应首页
const actionFor = (a, u) => a === 'home' ? (u.track === 'ja' ? '#home' : '#' + u.track) : a;

let users = [], filter = 'all', selected = new Set(), tpl = TEMPLATES[0], draft = { ...TEMPLATES[0] };

function summarize(u) {
  const days = u.days || {}, today = dkey(), yest = dkey(new Date(Date.now() - DAY));
  const studied = Object.keys(days).filter(k => days[k] > 0).sort();
  const last = studied[studied.length - 1] || null;
  const gap = last ? Math.round((Date.parse(today) - Date.parse(last)) / DAY) : null;
  let streak = 0;
  if (last === today || last === yest) for (let d = new Date(Date.parse(last)); (days[d.toISOString().slice(0, 10)] || 0) > 0; d = new Date(d.getTime() - DAY)) streak++;
  return Object.assign(u, { last, gap, streak, todayXP: days[today] || 0, lang: LANG[u.track] || '日语' });
}
const FILTERS = [
  ['all', '全部', () => true],
  ['today', '今天还没学', u => u.last && u.gap >= 1 && u.gap <= 1],
  ['away', '2–6 天没来', u => u.gap >= 2 && u.gap <= 6],
  ['gone', '7 天以上没来', u => u.gap >= 7],
  ['never', '从没学过', u => !u.last],
  ['done', '今天学了', u => u.gap === 0],
  ['push', '开了提醒', u => u.subs > 0],
];
const fill = (s, u) => String(s || '').replace(/\{lang\}/g, u.lang).replace(/\{due\}/g, u.due).replace(/\{streak\}/g, u.streak).replace(/\{gap\}/g, u.gap == null ? '很多' : u.gap);

async function start() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return loginView();
  const { data: list, error } = await sb.rpc('admin_users');
  if (error) {
    app.innerHTML = `<div class="panel"><h1>道场后台</h1><p>${/not admin/.test(error.message) ? '这个账号还不是管理员。' : '读取失败：' + esc(error.message)}</p>
      <p class="small muted">在 Supabase 的 SQL Editor 运行 <code>insert into public.admins select id from auth.users where email = '你的邮箱';</code>，然后刷新。还没建表的话先运行 docs/SUPABASE_SETUP.md 第 9 节的 SQL。</p>
      <p class="small">当前账号：${esc(data.session.user.email)} · <a href="#" id="out">换个账号</a></p></div>`;
    document.getElementById('out').onclick = async e => { e.preventDefault(); await sb.auth.signOut(); loginView(); };
    return;
  }
  users = list.map(summarize);
  draw();
  loadReplies();
}

function loginView() {
  app.innerHTML = `<div class="panel" style="max-width:420px;margin:40px auto"><h1>道场后台</h1><p class="small muted">用管理员账号登录（和网站同一个账号）。在网站上已经登录的话会自动进来。</p><p class="small">忘记密码、或者平时用 Google / 邮箱验证码登录？<a href="./#me">先去网站登录</a>，再回到这个页面就行。</p>
    <label class="f">邮箱</label><input type="email" id="em" autocomplete="username"><label class="f">密码</label><input type="password" id="pw" autocomplete="current-password">
    <div class="row" style="margin-top:10px"><button class="btn pri" id="go">登录</button><span class="small muted" id="st"></span></div></div>`;
  document.getElementById('go').onclick = async () => {
    const st = document.getElementById('st'); st.textContent = '登录中……';
    const { error } = await sb.auth.signInWithPassword({ email: document.getElementById('em').value.trim(), password: document.getElementById('pw').value });
    if (error) { st.textContent = error.message; return; }
    start();
  };
}

function draw() {
  const cnt = k => users.filter(FILTERS.find(f => f[0] === k)[2]).length;
  const shown = users.filter(FILTERS.find(f => f[0] === filter)[2]);
  app.innerHTML = `<div class="row between"><div><h1>道场后台</h1><div class="small muted">共 ${users.length} 个账号 · 数据来自云同步，用户离线学习的部分要等下次联网才会出现</div></div><div class="row"><a class="btn" href="./">回到网站</a><button class="btn" id="reload">刷新</button></div></div>
  <div class="panel stats">
    <div class="stat"><span class="small muted">今天学了</span><b>${cnt('done')}</b></div>
    <div class="stat"><span class="small muted">今天还没学</span><b>${cnt('today')}</b></div>
    <div class="stat"><span class="small muted">2–6 天没来</span><b>${cnt('away')}</b></div>
    <div class="stat"><span class="small muted">7 天以上</span><b>${cnt('gone')}</b></div>
    <div class="stat"><span class="small muted">从没学过</span><b>${cnt('never')}</b></div>
    <div class="stat"><span class="small muted">开了提醒</span><b>${cnt('push')}</b></div>
  </div>
  <div class="panel"><div class="row between"><div class="row">${FILTERS.map(([k, t]) => `<button class="chip ${k === filter ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
    <div class="row small"><button class="btn" id="all">全选这一组</button><button class="btn" id="none">清空</button><span>已选 <b>${selected.size}</b> 人</span></div></div>
  <div class="tbl-wrap"><table><thead><tr><th></th><th>邮箱</th><th>在学</th><th>最后学习</th><th>连续</th><th>今日经验</th><th>待复习</th><th>总经验</th><th>提醒</th><th>未读</th><th>注册</th></tr></thead><tbody>
  ${shown.map(u => `<tr class="${selected.has(u.user_id) ? 'sel' : ''}" data-u="${u.user_id}"><td><input type="checkbox" ${selected.has(u.user_id) ? 'checked' : ''}></td>
    <td>${esc(u.email)}</td><td>${u.lang}</td>
    <td>${u.last ? `${u.last} ${u.gap === 0 ? '<span class="tag t-ok">今天</span>' : u.gap === 1 ? '<span class="tag t-warn">昨天</span>' : `<span class="tag ${u.gap >= 7 ? 't-bad' : 't-warn'}">${u.gap} 天前</span>`}` : '<span class="tag t-bad">没学过</span>'}</td>
    <td>${u.streak}</td><td>${u.todayXP}</td><td>${u.due}</td><td>${u.xp}</td><td>${u.subs ? '🔔' : ''}</td><td>${u.unread || ''}</td><td class="muted">${String(u.created_at).slice(0, 10)}</td></tr>`).join('') || '<tr><td colspan="11" class="muted">这一组没有人</td></tr>'}
  </tbody></table></div></div>
  <div class="panel"><h2>发消息</h2>
    <div class="row">${TEMPLATES.map(t => `<button class="chip ${t === tpl ? 'on' : ''}" data-t="${t.k}">${t.name}</button>`).join('')}</div>
    <div class="grid2"><div>
      <label class="f">标题（建议 15 字以内；可用 {lang} {due} {streak} {gap}）</label><input type="text" id="ti" maxlength="80" value="${esc(draft.title)}">
      <label class="f">内容（建议 50 字以内，手机通知栏只显示前一两行）</label><textarea id="bo" maxlength="600">${esc(draft.body)}</textarea>
      <div class="grid2"><div><label class="f">按钮跳到</label><select id="ac">${ACTIONS.map(([v, t]) => `<option value="${v}" ${draft.action === v ? 'selected' : ''}>${t}</option>`).join('')}<option value="__url" ${draft.action && !ACTIONS.some(a => a[0] === draft.action) ? 'selected' : ''}>网址……</option></select></div>
        <div><label class="f">按钮文字</label><input type="text" id="la" maxlength="20" value="${esc(draft.label)}"></div></div>
      <input type="text" id="url" placeholder="https://…" style="margin-top:6px" value="${esc(draft.action && !ACTIONS.some(a => a[0] === draft.action) ? draft.action : '')}" ${draft.action && !ACTIONS.some(a => a[0] === draft.action) ? '' : 'hidden'}>
      <label class="f">快捷回复（用户点一下就能回你，用「/」分隔，可留空）</label><input type="text" id="re" value="${esc(draft.replies.join(' / '))}">
    </div><div>
      <label class="f">预览（${selected.size ? '第一个选中的用户' : '先在上面勾选用户'}）</label><div class="preview" id="pv"></div>
      <p class="small muted">消息会出现在对方网站首页最上面和「我的 → 消息」。对方开了学习提醒的话，手机也会收到推送${CLOUD.vapid ? '' : '（还没配置推送，见 docs/SUPABASE_SETUP.md 第 9 节）'}。</p>
      <div class="row"><button class="btn pri" id="send" ${selected.size ? '' : 'disabled'}>发送给选中的 ${selected.size} 人</button><span class="small" id="sst"></span></div>
    </div></div></div>
  <div class="panel"><h2>用户的回复和反馈</h2><div class="list" id="replies"><p class="small muted">加载中……</p></div></div>`;
  bind();
  preview();
}

function readDraft() {
  const ac = app.querySelector('#ac').value;
  draft = { ...draft, title: app.querySelector('#ti').value, body: app.querySelector('#bo').value, action: ac === '__url' ? app.querySelector('#url').value.trim() : ac,
    label: app.querySelector('#la').value, replies: app.querySelector('#re').value.split('/').map(s => s.trim()).filter(Boolean).slice(0, 5) };
}
function preview() {
  const pv = app.querySelector('#pv'), u = users.find(x => selected.has(x.user_id));
  if (!u) { pv.innerHTML = '<span class="small muted">（无）</span>'; return; }
  pv.innerHTML = `<b>${esc(fill(draft.title, u))}</b><div class="small">${esc(fill(draft.body, u))}</div>
    <div class="pv-reps">${draft.action ? `<span style="background:var(--ai);color:#fff;border-color:var(--ai)">${esc(draft.label || '去看看')}</span>` : ''}${draft.replies.map(r => `<span>${esc(r)}</span>`).join('')}</div>
    <div class="small muted">发给：${esc(u.email)}${selected.size > 1 ? ` 等 ${selected.size} 人（每人的数字按各自的进度填）` : ''}</div>`;
}

function bind() {
  app.querySelector('#reload').onclick = () => start();
  app.querySelectorAll('[data-f]').forEach(b => { b.onclick = () => { filter = b.dataset.f; draw(); }; });
  app.querySelector('#all').onclick = () => { users.filter(FILTERS.find(f => f[0] === filter)[2]).forEach(u => selected.add(u.user_id)); readDraft(); draw(); };
  app.querySelector('#none').onclick = () => { selected.clear(); readDraft(); draw(); };
  app.querySelectorAll('tr[data-u]').forEach(tr => { tr.onclick = () => { const id = tr.dataset.u; selected.has(id) ? selected.delete(id) : selected.add(id); readDraft(); draw(); }; });
  app.querySelectorAll('[data-t]').forEach(b => { b.onclick = () => { tpl = TEMPLATES.find(t => t.k === b.dataset.t); draft = { ...tpl, replies: [...tpl.replies] }; draw(); }; });
  ['#ti', '#bo', '#la', '#re', '#url'].forEach(s => { app.querySelector(s).oninput = () => { readDraft(); preview(); }; });
  app.querySelector('#ac').onchange = e => { app.querySelector('#url').hidden = e.target.value !== '__url'; readDraft(); preview(); };
  app.querySelector('#send').onclick = send;
}

async function send() {
  readDraft();
  const st = app.querySelector('#sst'), btn = app.querySelector('#send');
  if (!draft.title.trim() || !draft.body.trim()) { st.textContent = '标题和内容都要写。'; return; }
  const targets = users.filter(u => selected.has(u.user_id));
  if (!confirm(`发送给 ${targets.length} 人？`)) return;
  btn.disabled = true; st.textContent = '发送中……';
  const msgs = targets.map(u => ({ user_id: u.user_id, title: fill(draft.title, u).slice(0, 80), body: fill(draft.body, u).slice(0, 600),
    action: actionFor(draft.action, u) || null, action_label: draft.action ? (draft.label || '去看看').slice(0, 20) : null, replies: draft.replies }));
  const { data: ids, error } = await sb.rpc('admin_send', { msgs });
  if (error) { st.textContent = '发送失败：' + error.message; btn.disabled = false; return; }
  let note = `站内消息已发送 ${ids.length} 条`;
  if (CLOUD.vapid) {
    try {
      const { data: s } = await sb.auth.getSession();
      const r = await fetch(`${CLOUD.url}/functions/v1/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.session.access_token, apikey: CLOUD.anonKey }, body: JSON.stringify({ ids: ids.map(x => typeof x === 'object' ? x.admin_send || x.id : x) }) });
      const j = await r.json();
      note += r.ok ? `，推送到 ${j.devices} 台设备` : `，推送失败：${j.error || r.status}`;
    } catch (e) { note += '，推送失败：' + e.message; }
  }
  st.textContent = note;
  selected.clear();
  setTimeout(start, 1500);
}

async function loadReplies() {
  const box = document.getElementById('replies');
  const [{ data: reps }, { data: fb }] = await Promise.all([
    sb.from('messages').select('user_id, title, reply, read_at, created_at').not('reply', 'is', null).order('read_at', { ascending: false }).limit(30),
    sb.from('feedback').select('created_at, kind, message, contact, user_id').order('created_at', { ascending: false }).limit(30),
  ]);
  const email = id => (users.find(u => u.user_id === id) || {}).email || '匿名';
  const rows = [
    ...(reps || []).map(r => ({ at: r.read_at || r.created_at, html: `<b>${esc(r.reply)}</b> <span class="small muted">— ${esc(email(r.user_id))} 回复「${esc(r.title)}」</span>` })),
    ...(fb || []).map(f => ({ at: f.created_at, html: `<span class="tag t-warn">反馈·${esc(f.kind)}</span> ${esc(f.message)} <span class="small muted">— ${esc(f.user_id ? email(f.user_id) : '未登录')}${f.contact ? ' · ' + esc(f.contact) : ''}</span>` })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  box.innerHTML = rows.length ? rows.map(r => `<div><span class="small muted">${String(r.at).slice(0, 16).replace('T', ' ')}</span> ${r.html}</div>`).join('') : '<p class="small muted">还没有回复。</p>';
}

start();
