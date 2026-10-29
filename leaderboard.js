// 本周排行榜（自愿参加）：用自己起的昵称上榜，按本周经验排名，每周一重新开始。
// 只公开昵称和本周经验；不参加的人什么都不上传。表和函数见 docs/SUPABASE_SETUP.md 第 11 节，没建表时这一块不显示。
const lbWeek = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; };
function lbWeekXP() {
  const d = lbWeek(); let n = 0;
  for (let i = 0; i < 7; i++) { n += S.days[dkey(d)] || 0; d.setDate(d.getDate() + 1); }
  return n;
}
let lbLast = 0;
// 学习时（cloudPush 之后）顺便更新本周经验，最多一分钟一次
async function lbSync(force) {
  if (!S.lb || !S.lb.on || !sbUser || (!force && Date.now() - lbLast < 60000)) return;
  lbLast = Date.now();
  try {
    const c = await cloudClient();
    await c.from('leaderboard').upsert({ user_id: sbUser.id, nickname: S.lb.nick, week: dkey(lbWeek()), xp: Math.min(lbWeekXP(), 50000), updated_at: new Date().toISOString() });
  } catch (e) { /* 下次再同步 */ }
}

function leaderboardPanel() {
  if (!cloudOn()) return null;
  const p = h('<section class="panel" hidden><h2>本周排行</h2><div data-lb></div></section>');
  const box = p.querySelector('[data-lb]');
  const draw = async () => {
    const u = typeof inboxUser === 'function' ? await inboxUser() : sbUser;   // 页面刚打开时登录状态可能还没读出来
    if (!u) { p.hidden = true; return; }
    let rows;
    try {
      const c = await cloudClient();
      const { data, error } = await c.rpc('leaderboard_top', { wk: dkey(lbWeek()) });
      if (error || !Array.isArray(data)) throw error || new Error('no data');
      rows = data;
    } catch (e) { p.hidden = true; return; }   // 还没建表：不显示
    p.hidden = false;
    const on = S.lb && S.lb.on;
    box.innerHTML = `${rows.length ? `<ol class="lb-list">${rows.map((r, i) => `<li class="${r.me ? 'me' : ''}"><span class="lb-rank">${i + 1}</span><span class="lb-nick">${esc(r.nickname)}${r.me ? '（我）' : ''}</span><b>${r.xp}</b></li>`).join('')}</ol>` : '<p class="small muted">本周还没有人上榜，来当第一个吧。</p>'}
      ${on ? `<div class="row between small"><span class="muted">你以「${esc(S.lb.nick)}」参加中，本周 ${lbWeekXP()} 经验</span><button class="btn ghost small" type="button" data-lb-off>退出排行榜</button></div>`
        : `<p class="small muted">参加后，用你起的昵称显示本周经验，只公开昵称和经验。随时可以退出。</p>
           <div class="row"><input type="text" class="lb-input" maxlength="16" placeholder="起个昵称（最多 16 字）" value="学习者${Math.floor(Math.random() * 9000 + 1000)}"><button class="btn pri" type="button" data-lb-on>参加</button></div>`}`;
    const onBtn = box.querySelector('[data-lb-on]');
    if (onBtn) onBtn.onclick = async () => {
      const nick = box.querySelector('.lb-input').value.trim().slice(0, 16);
      if (!nick) return toast('先起个昵称');
      if (/@|https?:|www\.|\d{7,}/i.test(nick)) return toast('昵称里不要放邮箱、网址或电话号码');
      S.lb = { on: true, nick }; save(); if (!sbUser) sbUser = await inboxUser(); await lbSync(true); draw();
    };
    const off = box.querySelector('[data-lb-off]');
    if (off) off.onclick = async () => {
      S.lb = { on: false, nick: S.lb.nick }; save();
      try { const c = await cloudClient(); await c.from('leaderboard').delete().eq('user_id', sbUser.id); } catch (e) { /* 忽略 */ }
      draw();
    };
  };
  draw();
  return p;
}
