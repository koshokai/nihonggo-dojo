// 把网站文件复制到 app/www，给 Capacitor 打包进 iPhone App。
// 录音（audio/，约 600 MB）和搜索引擎用的静态页（w/、g/）不打包：录音从网站在线加载（index.html 里的 AUD），
// 其余网页、脚本、单词和课程数据、照片都放进 App，打开就能用。
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = new URL('www/', import.meta.url).pathname;
const SITE = 'https://koshokai.github.io/nihonggo-dojo/';
const SKIP = new Set(['audio', 'w', 'g', 'e', 'ej', 'z', 'd', 'seo.css', 'tools', 'docs', 'tests', 'app', 'node_modules', 'supabase', 'admin.html', 'admin.js', 'promo.html', 'promo.js', 'sw.js',
  'sitemap.xml', 'robots.txt', 'README.md', 'share-qr.png']);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(ROOT)) {
  if (name.startsWith('.') || SKIP.has(name) || /^google.*\.html$/.test(name)) continue;
  const p = join(ROOT, name);
  if (statSync(p).isDirectory() || /\.(html|js|css|json|png|svg|jpg|webmanifest)$/.test(name)) cpSync(p, join(OUT, name), { recursive: true });
}
cpSync(new URL('native.js', import.meta.url).pathname, join(OUT, 'native.js'));
cpSync(new URL('native-sr.js', import.meta.url).pathname, join(OUT, 'native-sr.js'));
// App 模式标记放在最前面（录音地址、关掉 Service Worker、隐藏 App 里不能用的登录方式），原生功能脚本放在最后
let html = readFileSync(join(OUT, 'index.html'), 'utf8');
html = html.replace('<script src="boot.js"></script>', `<script>window.DOJO_APP = { remote: '${SITE}' };</script>\n<script src="native-sr.js"></script>\n<script src="boot.js"></script>`);
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n/, '');   // App 里不用网页的 CSP（上面插入了内嵌脚本，而且运行在 capacitor:// 下）   // 原生语音识别要在跟读脚本之前装上
html = html.replace('</body>', '<script src="native.js"></script>\n</body>');
// App 里：页面不能被双指放大、也不在边缘回弹，像原生 App 一样固定（网站保留放大，方便看小字）
html = html.replace('content="width=device-width, initial-scale=1, viewport-fit=cover"', 'content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"');
if (!html.includes('user-scalable=no')) throw new Error('viewport meta not found');
html = html.replace('</head>', '<style>html, body { overscroll-behavior: none; }</style>\n</head>');
writeFileSync(join(OUT, 'index.html'), html);
const size = dir => readdirSync(dir).reduce((n, f) => { const p = join(dir, f); const s = statSync(p); return n + (s.isDirectory() ? size(p) : s.size); }, 0);
console.log(`app/www ready: ${(size(OUT) / 1e6).toFixed(1)} MB`);
