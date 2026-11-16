// 检查 Supabase Realtime：两个「设备」同时进在线人数频道，看彼此能不能看到；再测一次 Broadcast（戳一下用的）。
// 在 GitHub Actions 里运行（.github/workflows/supabase-check.yml），本机网络连不上 Supabase 时用。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const root = new URL('..', import.meta.url).pathname;
const cfg = readFileSync(root + 'config.js', 'utf8');
const url = cfg.match(/url: '([^']+)'/)[1], key = cfg.match(/anonKey: '([^']+)'/)[1];
const ctx = { globalThis: {}, window: {}, console, setTimeout, clearTimeout, setInterval, clearInterval, fetch, WebSocket, URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, Headers, Request, Response, crypto, queueMicrotask, structuredClone, Blob, atob, btoa, navigator: { userAgent: 'node' }, location: { href: 'https://example.com/' } };
ctx.self = ctx.window = ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(root + 'vendor/supabase.js', 'utf8') + ';globalThis.supabase = supabase;', ctx);
const mk = () => ctx.supabase.createClient(url, key, { auth: { persistSession: false } });
const wait = ms => new Promise(r => setTimeout(r, ms));
const a = mk(), b = mk();
const join = (c, k) => new Promise(res => {
  const ch = c.channel('online-learners', { config: { presence: { key: k } } });
  ch.on('presence', { event: 'sync' }, () => {});
  ch.subscribe(async st => { console.log(`  ${k} status:`, st); if (st === 'SUBSCRIBED') { const r = await ch.track({ at: Date.now() }); console.log(`  ${k} track:`, r); res(ch); } });
  setTimeout(() => res(ch), 15000);
});
console.log('== 在线人数（Presence）');
const ca = await join(a, 'ci-device-a'), cb = await join(b, 'ci-device-b');
await wait(4000);
console.log('  A 看到：', Object.keys(ca.presenceState()));
console.log('  B 看到：', Object.keys(cb.presenceState()));
console.log('== 戳一下（Broadcast）');
let got = null;
const rx = b.channel('u-ci-test'); rx.on('broadcast', { event: 'ping' }, m => { got = m.payload; });
await new Promise(r => rx.subscribe(st => { console.log('  接收方 status:', st); if (st === 'SUBSCRIBED') r(); }));
const tx = a.channel('u-ci-test');
await new Promise(r => tx.subscribe(async st => { console.log('  发送方 status:', st); if (st === 'SUBSCRIBED') { console.log('  send:', await tx.send({ type: 'broadcast', event: 'ping', payload: { t: 'poke' } })); r(); } }));
await wait(3000);
console.log('  接收方收到：', got);
process.exit(0);
