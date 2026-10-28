// Supabase Edge Function「notify」：发送学习提醒推送。部署步骤见 docs/SUPABASE_SETUP.md 第 9 节。
// 两种调用方式：
//   1. 后台 admin.html 发完站内消息后调用：Authorization: Bearer <管理员登录令牌>，body {ids: [消息 id]} → 把这些消息推送到用户手机
//   2. GitHub Actions 每小时调用：x-cron-secret: <CRON_SECRET> → 给到了提醒时间、今天还没学的用户自动生成提醒并推送
// 需要的 Secrets：VAPID_PUBLIC、VAPID_PRIVATE、VAPID_SUBJECT（mailto:你的邮箱）、CRON_SECRET。
// SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 是 Supabase 自动提供的，不用自己填。
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const env = (k: string) => Deno.env.get(k) || '';
webpush.setVapidDetails(env('VAPID_SUBJECT') || 'mailto:admin@example.com', env('VAPID_PUBLIC'), env('VAPID_PRIVATE'));
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Msg = { id: number; user_id: string; title: string; body: string; action: string | null };
type Sub = { endpoint: string; user_id: string; p256dh: string; auth: string; tz: string; hour: number };

// 把消息推送到对应用户的所有设备；失效的订阅（410/404）顺手删掉
async function pushMsgs(msgs: Msg[]) {
  if (!msgs.length) return { pushed: 0, devices: 0 };
  const uids = [...new Set(msgs.map(m => m.user_id))];
  const { data: subs } = await db.from('push_subs').select('*').in('user_id', uids);
  let devices = 0;
  const dead: string[] = [];
  const done: number[] = [];
  for (const m of msgs) {
    const mine = (subs || []).filter((s: Sub) => s.user_id === m.user_id);
    for (const s of mine) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: m.title, body: m.body, url: m.action && m.action.startsWith('#') ? m.action : '#home', tag: 'msg-' + m.id }), { TTL: 60 * 60 * 12 });
        devices++;
        if (!done.includes(m.id)) done.push(m.id);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
      }
    }
  }
  if (dead.length) await db.from('push_subs').delete().in('endpoint', dead);
  if (done.length) await db.from('messages').update({ pushed: true }).in('id', done);
  return { pushed: done.length, devices };
}

/* ---------- 自动提醒 ---------- */
const LANG: Record<string, string> = { ja: '日语', ko: '韩语', en: '英语' };
const dayKey = (d: Date, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const localHour = (d: Date, tz: string) => +new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(d);
const diffDays = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);

// 根据学习记录决定今天发什么；返回 null 表示今天不打扰
function compose(data: Record<string, any> | null, created: string, now: Date, tz: string) {
  const tr = (data && data.track) || 'ja', lang = LANG[tr] || '日语', home = tr === 'ja' ? '#home' : '#' + tr;
  const days: Record<string, number> = (data && data.days) || {};
  const today = dayKey(now, tz);
  if ((days[today] || 0) > 0) return null;                              // 今天学过了
  const studied = Object.keys(days).filter(k => days[k] > 0).sort();
  const srs: Record<string, { due?: number }> = (data && data.srs) || {};
  const due = Object.values(srs).filter(c => c && typeof c.due === 'number' && c.due <= now.getTime()).length;
  if (!studied.length) {                                                // 注册了但还没开始学：第 1、3 天各提醒一次
    const age = diffDays(today, dayKey(new Date(created), tz));
    if (age !== 1 && age !== 3) return null;
    return { title: `开始你的第一课吧`, body: `每天 10 分钟就够：先学 5 个${lang}单词，跟读一句。`, action: home, action_label: '开始', replies: [] };
  }
  const last = studied[studied.length - 1], gap = diffDays(today, last);
  let streak = 0;
  for (let d = new Date(Date.parse(last)); (days[d.toISOString().slice(0, 10)] || 0) > 0; d = new Date(d.getTime() - 864e5)) streak++;
  if (gap === 1 && streak >= 2) return { title: `连续 ${streak} 天了，别断在今天`, body: `今天的${lang}任务还没做${due ? `，${due} 张卡片在等你复习` : ''}。10 分钟就能完成。`, action: home, action_label: '去打卡', replies: [] };
  if (gap === 1) return { title: '今天的任务还没做哦', body: `${due ? `复习 ${due} 张卡片，` : ''}再学 5 个新词，10 分钟就够。`, action: home, action_label: '开始', replies: [] };
  if (gap === 3) return { title: `${lang}道场等你回来`, body: `已经 3 天没来了。${due ? `有 ${due} 张卡片快忘了，` : ''}先复习几张找找感觉。`, action: home, action_label: '回来学', replies: ['我回来了', '最近太忙', '内容太难了'] };
  if (gap === 7 || gap === 21) return { title: '好久不见', body: `${gap} 天没见啦。从今天的 5 个新词重新开始也很好，进度都还在。`, action: home, action_label: '看看', replies: ['我回来了', '最近太忙', '不想学了'] };
  return null;                                                          // 其他日子不打扰；21 天以后不再自动提醒
}

async function auto() {
  const now = new Date();
  const { data: subs } = await db.from('push_subs').select('*');
  // 每个用户取一台设备的时区和提醒时间；只处理现在正好到了提醒时间的用户
  const byUser = new Map<string, Sub>();
  for (const s of (subs || []) as Sub[]) if (!byUser.has(s.user_id)) byUser.set(s.user_id, s);
  const due = [...byUser.values()].filter(s => { try { return localHour(now, s.tz) === s.hour; } catch { return localHour(now, 'Asia/Tokyo') === s.hour; } });
  if (!due.length) return { checked: 0, sent: 0 };
  const uids = due.map(s => s.user_id);
  // 20 小时内已经发过自动提醒的跳过（防止重复运行时连发）
  const { data: recent } = await db.from('messages').select('user_id').eq('kind', 'auto').in('user_id', uids).gt('created_at', new Date(now.getTime() - 20 * 3600e3).toISOString());
  const skip = new Set((recent || []).map((r: { user_id: string }) => r.user_id));
  const { data: prog } = await db.from('progress').select('user_id, data').in('user_id', uids);
  const pmap = new Map((prog || []).map((p: { user_id: string; data: Record<string, unknown> }) => [p.user_id, p.data]));
  const rows = [];
  for (const s of due) {
    if (skip.has(s.user_id)) continue;
    const { data: u } = await db.auth.admin.getUserById(s.user_id);
    if (!u || !u.user) continue;
    let tz = s.tz;
    try { dayKey(now, tz); } catch { tz = 'Asia/Tokyo'; }
    const m = compose(pmap.get(s.user_id) as Record<string, any> | null, u.user.created_at, now, tz);
    if (m) rows.push({ user_id: s.user_id, kind: 'auto', ...m });
  }
  if (!rows.length) return { checked: due.length, sent: 0 };
  const { data: ins, error } = await db.from('messages').insert(rows).select('id, user_id, title, body, action');
  if (error) return { error: error.message };
  return { checked: due.length, sent: rows.length, ...(await pushMsgs(ins as Msg[])) };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const cron = req.headers.get('x-cron-secret');
  if (cron !== null) {
    if (!env('CRON_SECRET') || cron !== env('CRON_SECRET')) return json({ error: 'bad secret' }, 401);
    return json(await auto());
  }
  // 后台调用：确认是管理员
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: au } = await db.auth.getUser(token);
  if (!au || !au.user) return json({ error: 'not logged in' }, 401);
  const { data: adm } = await db.from('admins').select('user_id').eq('user_id', au.user.id).maybeSingle();
  if (!adm) return json({ error: 'not admin' }, 403);
  const body = await req.json().catch(() => ({}));
  const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 2000);
  const { data: msgs } = await db.from('messages').select('id, user_id, title, body, action').in('id', ids);
  return json(await pushMsgs((msgs || []) as Msg[]));
});
