// 测试用的假 Supabase：不连服务器，返回固定的登录状态、消息和用户列表（tests/smoke.mjs 用）
window.__log = [];
window.supabase = { createClient() {
  const user = { id: 'u-admin', email: 'me@example.com' };
  const now = Date.now(), dk = n => { const d = new Date(now - n * 864e5); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const msgs = [{ id: 1, created_at: new Date().toISOString(), title: '今天的任务还没做哦', body: '复习 12 张卡片，再学 5 个新词。', action: '#home', action_label: '开始', replies: ['马上去', '今天太忙了'], read_at: null, reply: null },
                { id: 2, created_at: new Date().toISOString(), title: '想听听你的意见', body: '哪里不好用？', action: null, action_label: null, replies: ['内容太难', '挺好的'], read_at: null, reply: null }];
  const users = [
    { user_id: 'u1', email: 'a@x.com', created_at: '2026-10-01T00:00:00Z', xp: 300, track: 'ja', days: { [dk(1)]: 30, [dk(2)]: 20, [dk(3)]: 10 }, due: 12, subs: 1, unread: 0 },
    { user_id: 'u2', email: 'b@x.com', created_at: '2026-10-02T00:00:00Z', xp: 50, track: 'ko', days: { [dk(9)]: 30 }, due: 40, subs: 0, unread: 1 },
    { user_id: 'u3', email: 'c@x.com', created_at: '2026-10-20T00:00:00Z', xp: 0, track: 'en', days: {}, due: 0, subs: 0, unread: 0 },
    { user_id: 'u4', email: 'd@x.com', created_at: '2026-10-03T00:00:00Z', xp: 900, track: 'ja', days: { [dk(0)]: 60, [dk(1)]: 30 }, due: 3, subs: 2, unread: 0 },
  ];
  const q = (table) => { const o = { ops: [] }; ['select','eq','order','limit','not','in','delete','upsert','insert','update','maybeSingle','gt'].forEach(m => o[m] = (...a) => { o.ops.push([m, a]); return o; });
    o.then = (res) => { __log.push(['from', table, o.ops.map(x=>x[0])]);
      let data = null;
      if (table === 'messages') data = o.ops.some(x => x[0]==='not') ? [{ user_id: 'u1', title: '想听听你的意见', reply: '内容太难', read_at: new Date().toISOString(), created_at: new Date().toISOString() }] : msgs;
      if (table === 'feedback') data = [{ created_at: new Date().toISOString(), kind: 'idea', message: '希望加 N1 模考', contact: null, user_id: 'u2' }];
      return Promise.resolve({ data, error: null }).then(res); };
    return o; };
  return {
    auth: { getSession: async () => ({ data: { session: { user, access_token: 't' } } }), onAuthStateChange() {}, signOut: async () => ({}) },
    from: q, channel: (name, opts) => { const ch = { cbs: [], on(t, f, cb) { this.cbs.push(cb); return this; }, subscribe(cb) { setTimeout(() => { cb("SUBSCRIBED"); setTimeout(() => this.cbs.forEach(f => f()), 50); }, 50); return this; }, presenceState() { return { a: [1], b: [1], [opts.config.presence.key]: [1] }; }, track() { window.__tracked = 1; return Promise.resolve(); }, untrack() { return Promise.resolve(); } }; return ch; },
    rpc: async (fn, args) => { __log.push(['rpc', fn, args]); if (fn === 'admin_users') return { data: users, error: null }; if (fn === 'admin_send') return { data: args.msgs.map((_, i) => 100 + i), error: null }; return { data: null, error: null }; },
  };
} };
