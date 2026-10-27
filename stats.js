'use strict';
/* 每周小结（只用本机数据计算）和匿名使用统计。
   匿名统计：每台设备每天最多发一条「今天打开过、在学哪种语言」，用一个只存在本机、和账号无关的随机编号，
   不发送任何学习内容、邮箱或账号。用来计算「每天有多少人在学」「7 天后还有多少人在用」。可以在「我的」里关闭。
   后台表的建法见 docs/SUPABASE_SETUP.md 第 8 节。 */

const ANON_KEY = 'nihongo-dojo:anon';
function anonId() {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)); localStorage.setItem(ANON_KEY, id); }
    return id;
  } catch (e) { return null; }
}
const statsSent = {};
function logUsage(track) {
  if (S.noStats || typeof CLOUD === 'undefined' || !CLOUD.url || !CLOUD.anonKey || !navigator.onLine) return;
  const day = dkey(), k = day + track, id = anonId();
  if (!id || statsSent[k]) return;
  try { if (localStorage.getItem('nihongo-dojo:stat') === k) return; } catch (e) { /* 忽略 */ }
  statsSent[k] = 1;
  fetch(`${CLOUD.url}/rest/v1/daily_usage`, {
    method: 'POST',
    headers: { apikey: CLOUD.anonKey, Authorization: `Bearer ${CLOUD.anonKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ anon_id: id, day, track })
  }).then(r => { if (r.ok) try { localStorage.setItem('nihongo-dojo:stat', k); } catch (e) { /* 忽略 */ } }).catch(() => {});
}

/* ---------- 每周小结 ---------- */
function weekStats(offset = 0) {
  // 本周一到今天（offset = 1 为上一周整周）
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7 * offset);
  const days = []; for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); if (d <= today) days.push(dkey(d)); }
  const sum = f => days.reduce((a, k) => a + f(k), 0);
  const rev = sum(k => ((S.revLog || {})[k] || [0, 0])[0]), ok = sum(k => ((S.revLog || {})[k] || [0, 0])[1]);
  return { days, active: days.filter(k => (S.days[k] || 0) > 0).length, xp: sum(k => S.days[k] || 0), rev, ok, newW: sum(k => S.newLog[k] || 0) };
}
function weeklyPanel() {
  const w = weekStats(0), lw = weekStats(1);
  const diff = (a, b) => b ? (a >= b ? `<span class="up">↑${a - b}</span>` : `<span class="down">↓${b - a}</span>`) : '';
  const rate = w.rev ? Math.round(w.ok / w.rev * 100) : null;
  const tomorrow = Object.values(S.srs).filter(c => c.due && c.due < Date.now() + DAY * 1.5 && c.due > Date.now()).length;
  const wrongBy = { 单词: 0, 汉字: 0, 语法: 0 };
  Object.keys(S.wrong).forEach(id => { const k = id[0] === 'k' ? '汉字' : id[0] === 'g' ? '语法' : '单词'; wrongBy[k]++; });
  const weak = Object.entries(wrongBy).sort((a, b) => b[1] - a[1])[0];
  const tips = [];
  if (w.active < 4) tips.push('每天打开一次、哪怕只做 5 分钟复习，比周末突击记得牢得多。');
  if (rate != null && rate < 80) tips.push(`这周复习时记住了 ${rate}%，偏低：每天的新词可以少一点，先把旧词巩固住。`);
  if (rate != null && rate >= 92 && w.newW < 20) tips.push('复习几乎全对，可以把每天新词数调高一点。');
  if (weak && weak[1] >= 5) tips.push(`错题里「${weak[0]}」最多（${weak[1]} 道），可以去错题本集中订正。`);
  if (!tips.length) tips.push('节奏很好，继续保持！');
  return h(`<section class="panel weekly">
    <div class="row between"><h2>本周小结</h2><span class="small muted">${w.days[0].slice(5)} 起</span></div>
    <div class="wk-grid">
      <div><b>${w.active}</b><span class="small muted">学习天数 ${diff(w.active, lw.active)}</span></div>
      <div><b>${w.xp}</b><span class="small muted">经验 ${diff(w.xp, lw.xp)}</span></div>
      <div><b>${w.rev}</b><span class="small muted">复习卡片 ${diff(w.rev, lw.rev)}</span></div>
      <div><b>${rate == null ? '—' : rate + '%'}</b><span class="small muted">复习记住率</span></div>
      <div><b>${w.newW}</b><span class="small muted">新学</span></div>
      <div><b>${tomorrow}</b><span class="small muted">明天要复习</span></div>
    </div>
    <ul class="wk-tips small">${tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="small muted">箭头和上周比较。只用这台设备上的记录计算，不会上传。</p>
  </section>`);
}
