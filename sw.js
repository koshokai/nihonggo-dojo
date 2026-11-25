// 离线缓存：打开过一次以后没有网络也能用，「添加到主屏幕」后就像一个 App。
// 页面和脚本：有网时先取最新版（最多等 3 秒），拿到就更新缓存；没网或太慢才用缓存。所以更新后打开就是新版本。
// 发音 MP3：先用缓存（离线也能听），同时在后台向网络确认一次，录音重录过（同名文件内容变了）就更新缓存，下次播放就是新录音。
// AUDIO 换名字（audio-v3）：清掉以前缓存的全部录音（有些录音重录时没换文件名，听过的人一直是旧录音）。
// 账号、同步等跨域请求（Supabase、jsDelivr）不经过缓存。
const VERSION = 'v321';
const SHELL = `shell-${VERSION}`, AUDIO = 'audio-v3';
const CORE = ['./', 'index.html', 'style.css', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'icon.svg',
  'boot.js', 'lazyja.js', 'i18n.js', 'mascot.js', 'fx.js', 'japlus.js', 'furi-map.js', 'kanapad.js', 'swipe.js', 'conv.js', 'pitch.js', 'tour.js', 'zh.js', 'zh-biz.js', 'practice2.js', 'week2.js', 'vocab.js', 'kanji.js', 'grammar.js', 'data.js', 'daily.js', 'jlpt.js', 'game.js', 'dict.js', 'reading.js',
  'scenes.js', 'read.js', 'week.js', 'weekly.js', 'vip.js', 'en.js', 'en-study.js', 'en-course.js', 'en-path.js', 'exam2.js', 'anime.js', 'course.js', 'duel.js', 'buddy.js', 'trans.js', 'conj.js', 'dictation.js', 'strokes.js', 'sharecard.js', 'share.js', 'invite.js', 'levelcheck.js', 'diagnose.js', 'path.js', 'plan.js', 'remind.js', 'weak.js', 'hub.js', 'leaderboard.js', 'business.js', 'biz.js', 'shadow.js', 'listen.js', 'listening.js', 'furi-listen.js', 'lang.js', 'lang2.js', 'stats.js', 'config.js', 'member.js', 'cloud.js', 'inbox.js', 'online.js', 'guest.js', 'app.js', 'privacy.html', 'terms.html', 'share-qr.png', 'vendor/supabase.js', 'vendor/qrcode.js'];

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
      const fresh = fetch(req, { cache: 'no-cache' }).then(res => {
        if (res.status === 200) c.put(req, res.clone()).catch(() => {});
        return res;
      });
      if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
      return fresh;
    }));
    return;
  }
  // 页面跳转：离线时回到首页
  // 只有首页本身存成 index.html（打开 admin.html、promo.html 时不能把它们存成首页）
  const nav = req.mode === 'navigate', key = nav ? 'index.html' : req, isIndex = /\/(index\.html)?$/.test(url.pathname);
  e.respondWith(caches.open(SHELL).then(async c => {
    const fromNet = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok && (!nav || isIndex)) c.put(key, res.clone()); return res; });
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
