// 离线缓存：打开过一次以后没有网络也能用，「添加到主屏幕」后就像一个 App。
// 页面和脚本：先用缓存马上打开，同时在后台更新，下次打开就是新版本（stale-while-revalidate）。
// 发音 MP3：文件名是内容哈希，不会变，缓存了就一直用（cache-first）。
// 账号、同步等跨域请求（Supabase、jsDelivr）不经过缓存。
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`, AUDIO = 'audio-v1';
const CORE = ['./', 'index.html', 'style.css', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon.svg',
  'vocab.js', 'kanji.js', 'grammar.js', 'data.js', 'daily.js', 'jlpt.js', 'game.js', 'dict.js', 'reading.js',
  'scenes.js', 'read.js', 'business.js', 'biz.js', 'shadow.js', 'config.js', 'cloud.js', 'app.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== AUDIO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('.mp3')) {
    e.respondWith(caches.open(AUDIO).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  // 页面跳转：离线时回到首页
  const key = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(caches.open(SHELL).then(async c => {
    const hit = await c.match(key, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) c.put(key, res.clone()); return res; }).catch(() => hit || Response.error());
    if (hit) { e.waitUntil(net); return hit; }
    return net;
  }));
});
