// 离线缓存：打开过一次以后没有网络也能用，「添加到主屏幕」后就像一个 App。
// 页面和脚本：有网时先取最新版（最多等 3 秒），拿到就更新缓存；没网或太慢才用缓存。所以更新后打开就是新版本。
// 发音 MP3：文件名是内容哈希，不会变，缓存了就一直用（cache-first）。
// 账号、同步等跨域请求（Supabase、jsDelivr）不经过缓存。
const VERSION = 'v265';
const SHELL = `shell-${VERSION}`, AUDIO = 'audio-v2';
const CORE = ['./', 'index.html', 'style.css', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'icon.svg',
  'i18n.js', 'mascot.js', 'fx.js', 'japlus.js', 'furi-map.js', 'kanapad.js', 'swipe.js', 'conv.js', 'pitch.js', 'tour.js', 'zh.js', 'zh-biz.js', 'practice2.js', 'week2.js', 'vocab.js', 'kanji.js', 'grammar.js', 'data.js', 'daily.js', 'jlpt.js', 'game.js', 'dict.js', 'reading.js',
  'scenes.js', 'read.js', 'week.js', 'weekly.js', 'vip.js', 'en.js', 'en-study.js', 'en-course.js', 'en-path.js', 'exam2.js', 'anime.js', 'course.js', 'duel.js', 'buddy.js', 'trans.js', 'conj.js', 'dictation.js', 'strokes.js', 'sharecard.js', 'share.js', 'invite.js', 'levelcheck.js', 'diagnose.js', 'path.js', 'weak.js', 'hub.js', 'leaderboard.js', 'business.js', 'biz.js', 'shadow.js', 'listen.js', 'listening.js', 'furi-listen.js', 'lang.js', 'lang2.js', 'stats.js', 'config.js', 'member.js', 'cloud.js', 'inbox.js', 'online.js', 'guest.js', 'app.js', 'privacy.html', 'terms.html', 'share-qr.png', 'vendor/supabase.js', 'vendor/qrcode.js'];

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
  // 录音：本站的，以及两个音频仓库（日语、英语录音；词典录音）的，都放进录音缓存（离线听）
  const audioRepo = /^https:\/\/koshokai\.github\.io\/nihonggo-dojo-audio2?\//.test(url.href);
  if (url.origin !== location.origin && !audioRepo) return;
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
    const fromNet = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) c.put(key, res.clone()); return res; });
    const timeout = new Promise(r => setTimeout(r, 3000));
    try {
      const res = await Promise.race([fromNet, timeout]);
      if (res) return res;
    } catch (err) { /* 没网 */ }
    const hit = await c.match(key, { ignoreSearch: true });
    if (hit) { e.waitUntil(fromNet.catch(() => {})); return hit; }
    return fromNet.catch(() => Response.error());
  }));
});

// 学习提醒推送（Edge Function notify 发送），点开后打开对应页面
self.addEventListener('push', e => {
  let m = {};
  try { m = e.data.json(); } catch (err) { m = { title: '猫先生', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || '猫先生', {
    body: m.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: m.tag || 'dojo', data: { url: m.url || '#home' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || '#home', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => c.url.startsWith(self.registration.scope));
    if (w) { w.navigate(url).catch(() => {}); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
