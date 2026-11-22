'use strict';
/* 学习提醒的内容计划（App 的本地通知用，见 app/native.js）：
   remindPlan(hour, now) → 未来几天每天一条 [{ at: Date, title, body, url }]
   - 今天学过了就从明天开始；今天没学、还没到提醒时间，今天也排一条
   - 按「离上次学习隔了几天」决定说什么：第 1 天连续天数 / 第 2 天今日一句 / 第 3 天召回 / 第 4–6 天今日一句 / 第 7、14、21 天好久不见，之后不再打扰
   - 内容：连续天数、那天会到期的复习卡片数、学习路线还差多少、那天的「今日一句」（三种语言都是按日期取的，所以能提前排）
   - 学习方案里的休息日不提醒（plan.js 的 planRest）
   - 提醒用的语言跟着用户：学日语 → 中文；学中文（日本用户）→ 日语；学英语 → 按母语
   每次打开 App、学完、回到 App 时重新排，所以只要用户还在用，提醒总是按最新情况来。 */
const RMD_DAYS = 7, RMD_BACK = [7, 14, 21];
const rmdJa = () => (S.track || 'ja') === 'zh' || ((S.track || 'ja') === 'en' && S.enNative === 'ja');
const rmdT = (zh, ja) => rmdJa() ? ja : zh;
let rmdDailyCache = {};
// 今日一句：返回 { t: 原文, sub: 读音 / 拼音 / 意思 } 或 null
async function rmdDailyList(tr) {
  if (tr === 'ja') return typeof DAILY !== 'undefined' && DAILY.length ? DAILY : null;
  if (rmdDailyCache[tr]) return rmdDailyCache[tr];
  try { const r = await fetch(`lang/${tr}-daily.json`); if (r.ok) rmdDailyCache[tr] = await r.json(); } catch (e) { /* 没网：不带今日一句 */ }
  return rmdDailyCache[tr] || null;
}
function rmdDaily(list, tr, d) {
  if (!list || !list.length) return null;
  const day = new Date(d); day.setHours(12, 0, 0, 0);
  const r = list[(list.length >= 366 ? dailySlot(day) : Math.floor(day.getTime() / 864e5)) % list.length];
  if (!r) return null;
  if (tr === 'ja') return { t: r[0], sub: r[1] };   // [日语, 读音, 中文, …]
  if (tr === 'zh') return { t: r[0], sub: r[1] };   // [中文, 拼音, 日语, …]
  return { t: r[0], sub: '' };                       // [英语, 中文, 日语, …]
}
const rmdPrefix = tr => tr === 'zh' ? ['zh|'] : tr === 'en' ? ['en|'] : ['v|', 'g|'];
function rmdDue(tr, at) {
  const pre = rmdPrefix(tr), t = at.getTime();
  return Object.keys(S.srs || {}).filter(id => pre.some(p => id.startsWith(p)) && S.srs[id] && typeof S.srs[id].due === 'number' && S.srs[id].due <= t).length;
}
const rmdDayDiff = (a, b) => Math.round((new Date(a).setHours(12, 0, 0, 0) - new Date(b).setHours(12, 0, 0, 0)) / 864e5);

async function remindPlan(hour, now = new Date(), withTip = true) {
  const tr = S.track || 'ja', lang = { ja: rmdT('日语', '日本語'), zh: rmdT('中文', '中国語'), en: rmdT('英语', '英語') }[tr];
  const studiedKeys = Object.keys(S.days || {}).filter(k => S.days[k] > 0).sort();
  const lastKey = studiedKeys[studiedKeys.length - 1];
  const last = lastKey ? new Date(lastKey + 'T12:00:00') : null;
  const st = typeof streak === 'function' ? streak() : 0;
  const pc = S.ptCur && S.ptCur[tr], left = pc && pc.i < pc.n ? Math.max(1, Math.round((1 - (pc.p || 0)) * 100)) : 0;
  const list = withTip ? await rmdDailyList(tr) : null;
  const out = [];
  for (let k = 0; k <= 21; k++) {
    const at = new Date(now); at.setDate(at.getDate() + k); at.setHours(hour, 0, 0, 0);
    if (at <= now) continue;
    if (k === 0 && S.days[dkey(now)] > 0) continue;                     // 今天学过了
    if (typeof planRest === 'function' && planRest(at)) continue;        // 学习方案的休息日
    const gap = last ? rmdDayDiff(at, last) : null;
    const dy = rmdDaily(list, tr, at), due = rmdDue(tr, at);
    const tip = dy ? rmdT(`今日一句：${dy.t}`, `今日のひとこと：${dy.t}`) : '';
    const dueTxt = due ? rmdT(`${due} 张卡片等你复习`, `復習カード ${due} 枚`) : '';
    const route = left ? rmdT(`学习路线还差 ${left}%`, `ロードマップあと ${left}%`) : '';
    const join = (...a) => a.filter(Boolean).join(rmdT('　', '　'));
    let m = null;
    if (gap == null) {   // 还没开始学：第 1、3 天各一次
      if (k === 1 || k === 3) m = { title: rmdT('开始你的第一课吧', '最初のレッスンを始めよう'), body: join(rmdT(`每天 10 分钟，先学 5 个${lang}单词`, `1日10分。まずは${lang}の単語5つから`), tip) };
    } else if (gap === 1) {
      m = st >= 2 && rmdDayDiff(now, last) <= 1
        ? { title: rmdT(`连续 ${st} 天了，今天也来 10 分钟`, `${st}日連続！今日も10分だけ`), body: join(dueTxt, route, tip) || rmdT('今天的任务还没做哦', '今日のタスクがまだです') }
        : { title: rmdT('今天的 10 分钟还没学哦', '今日の10分、まだですよ'), body: join(dueTxt, route, tip) || rmdT(`学 5 个${lang}单词就好`, `${lang}の単語5つだけでOK`) };
    } else if (gap === 2 || (gap >= 4 && gap <= 6)) {
      if (dy) m = { title: tip, body: join(dy.sub, rmdT('是什么意思？点开看看', 'どういう意味？チェックしてみよう')) };
      else if (gap === 2) m = { title: rmdT('今天来学一点吧', '今日も少しだけ'), body: join(dueTxt, route) || rmdT('10 分钟就够', '10分でOK') };
    } else if (gap === 3) {
      m = { title: rmdT(`${lang}在等你回来`, `${lang}が待っています`), body: join(rmdT('已经 3 天没来了', '3日ぶりですね'), due ? rmdT(`有 ${due} 张卡片快忘了`, `忘れかけのカードが ${due} 枚`) : '', tip) };
    } else if (RMD_BACK.includes(gap)) {
      m = { title: rmdT('好久不见', 'お久しぶりです'), body: rmdT(`${gap} 天没见啦，进度都还在。今天从 5 个新词重新开始吧。`, `${gap}日ぶりです。記録はそのまま。今日は単語5つから再開しよう。`) };
    }
    if (m) out.push({ at, url: tr === 'ja' ? '#home' : '#' + tr, ...m });
    if (out.length >= RMD_DAYS + 2) break;
  }
  return out;
}
