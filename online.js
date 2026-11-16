// 右上角「N 人在学」：用 Supabase Realtime 的 Presence 实时统计正在打开网站的设备数（大家看到的是同一个数）。
// 不用建表；每台设备只发一个随机编号，不含账号、邮箱或学习内容。页面切到后台 1 分钟后不再算在线。
// 账号编号 → 12 位哈希（伙伴页面用同样的算法算出伙伴的哈希来比对）
async function onlineHash(id) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('dojo-online:' + id));
  return [...new Uint8Array(buf)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
}
window.ONLINE_HASHES = new Set();
(() => {
  if (typeof CLOUD === 'undefined' || !CLOUD.url || !CLOUD.anonKey) return;
  const KEY = 'nihongo-dojo:pid';
  let pid = '';
  try { pid = localStorage.getItem(KEY) || ''; if (!pid) { pid = crypto.randomUUID(); localStorage.setItem(KEY, pid); } } catch (e) { pid = crypto.randomUUID(); }
  let ch = null, tracked = false, idle = null;
  const chip = () => document.getElementById('chip-online');
  const draw = n => { const c = chip(); if (!c) return; c.hidden = false; document.getElementById('online-n').textContent = n; c.title = tj(`现在有 ${n} 人正在学习（包括你）`, `いま ${n} 人が学習中です（あなたを含む）`); };
  // 登录用户额外带一个由账号编号算出的短哈希（推不回原来的编号），伙伴页面用它判断「伙伴在线」
  let uhash = '';
  const meta = () => uhash ? { at: Date.now(), h: uhash } : { at: Date.now() };
  const track = () => { if (ch && !tracked) { tracked = true; ch.track(meta()).catch(() => { tracked = false; }); } };
  const untrack = () => { if (ch && tracked) { tracked = false; ch.untrack().catch(() => {}); } };
  const start = () => cloudClient().then(async c => {
    const u = typeof inboxUser === 'function' ? await inboxUser().catch(() => null) : null;
    if (u) uhash = await onlineHash(u.id);
    ch = c.channel('online-learners', { config: { presence: { key: pid } } });
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState();
      rt = { n: Object.keys(st).length, h: Object.values(st).flatMap(v => v.map(m => m.h)).filter(Boolean) };
      merge();
    });
    ch.subscribe(status => {
      if (status === 'SUBSCRIBED' && document.visibilityState === 'visible') track();
      // 连不上 WebSocket（比如中国大陆）也没关系，人数靠「报到」
    });
  }).catch(() => {});
  // 两条路：Realtime（WebSocket，实时）和每 30 秒一次的普通请求「报到」（数据库函数 online_beat，见 docs/SUPABASE_SETUP.md 第 14 节）。
  // 中国大陆的网络经常连不上 WebSocket，所以人数和伙伴在线以「报到」为准，Realtime 只是让变化更快显示出来。
  let rt = { n: 0, h: [] }, bt = { n: 0, h: [] };
  const merge = () => {
    const n = Math.max(1, rt.n, bt.n);
    window.ONLINE_N = n;
    window.ONLINE_HASHES = new Set([...rt.h, ...bt.h]);
    draw(n);
    dispatchEvent(new Event('online-change'));
  };
  const beat = async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const c = await cloudClient();
      const { data, error } = await c.rpc('online_beat', { p: pid, hh: uhash });
      if (!error && data) { bt = { n: data.n || 0, h: data.h || [] }; merge(); }
    } catch (e) { /* 下次再报到 */ }
  };
  setInterval(beat, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') beat(); });
  addEventListener('pagehide', () => { cloudClient().then(c => c.rpc('online_leave', { p: pid })).catch(() => {}); });
  // 页面打开后才登录的话，补上账号哈希重新报到
  window.onlineRetrack = async () => {
    const u = typeof inboxUser === 'function' ? await inboxUser().catch(() => null) : null;
    if (!u || !ch) return;
    uhash = await onlineHash(u.id);
    tracked = false; track(); beat();
  };
  document.addEventListener('visibilitychange', () => {
    clearTimeout(idle);
    if (document.visibilityState === 'visible') track();
    else idle = setTimeout(untrack, 60000);
  });
  // 先显示「1」（至少有你自己），连上后再更新成实际人数——标签一开始就占好位置，旁边的标签不会被挤动
  const early = () => draw(1);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', early); else early();
  // 页面出来以后再连，不拖慢首屏
  addEventListener('load', () => setTimeout(() => { start().then(beat); }, 1500));
})();
