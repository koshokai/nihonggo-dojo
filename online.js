// 右上角「N 人在学」：用 Supabase Realtime 的 Presence 实时统计正在打开网站的设备数（大家看到的是同一个数）。
// 不用建表；每台设备只发一个随机编号，不含账号、邮箱或学习内容。页面切到后台 1 分钟后不再算在线。
(() => {
  if (typeof CLOUD === 'undefined' || !CLOUD.url || !CLOUD.anonKey) return;
  const KEY = 'nihongo-dojo:pid';
  let pid = '';
  try { pid = localStorage.getItem(KEY) || ''; if (!pid) { pid = crypto.randomUUID(); localStorage.setItem(KEY, pid); } } catch (e) { pid = crypto.randomUUID(); }
  let ch = null, tracked = false, idle = null;
  const chip = () => document.getElementById('chip-online');
  const draw = n => { const c = chip(); if (!c) return; c.hidden = false; document.getElementById('online-n').textContent = n; c.title = `现在有 ${n} 人正在学习（包括你）`; };
  const track = () => { if (ch && !tracked) { tracked = true; ch.track({ at: Date.now() }).catch(() => { tracked = false; }); } };
  const untrack = () => { if (ch && tracked) { tracked = false; ch.untrack().catch(() => {}); } };
  const start = () => cloudClient().then(c => {
    ch = c.channel('online-learners', { config: { presence: { key: pid } } });
    ch.on('presence', { event: 'sync' }, () => draw(Object.keys(ch.presenceState()).length));
    ch.subscribe(status => {
      if (status === 'SUBSCRIBED' && document.visibilityState === 'visible') track();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { const c = chip(); if (c) c.hidden = true; }
    });
  }).catch(() => {});
  document.addEventListener('visibilitychange', () => {
    clearTimeout(idle);
    if (document.visibilityState === 'visible') track();
    else idle = setTimeout(untrack, 60000);
  });
  // 先显示「1」（至少有你自己），连上后再更新成实际人数——标签一开始就占好位置，旁边的标签不会被挤动
  const early = () => draw(1);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', early); else early();
  // 页面出来以后再连，不拖慢首屏
  addEventListener('load', () => setTimeout(start, 1500));
})();
