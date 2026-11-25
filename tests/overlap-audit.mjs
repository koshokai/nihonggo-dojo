// 标题被盖住的检查：每个页面里的标题（h1–h3、卡片标题等），在标题的几个点上看最上面的元素是不是标题自己（或标题里面的东西）；
// 被别的元素（标签、按钮、图片、浮层）盖住就报出来。三种界面（中文、日文、英文）× 手机宽度。
// 用法：node tests/overlap-audit.mjs [输出文件]
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = new URL('..', import.meta.url).pathname;
const OUT = process.argv[2] || '/tmp/overlap-audit.json';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const file = path === '/' ? 'index.html' : path;
  try { const body = await readFile(join(ROOT, file)); res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;
const MOCK = await readFile(join(ROOT, 'tests/mock-supabase.js'), 'utf8');
const smoke = await readFile(join(ROOT, 'tests/smoke.mjs'), 'utf8');
const ALL = eval(smoke.slice(smoke.indexOf('const PAGES = ') + 14, smoke.indexOf('];', smoke.indexOf('const PAGES = ')) + 1));
const SETUPS = [
  ['zh-ui·ja', { track: 'ja' }, p => !/^(en|zh)\b/.test(p)],
  ['ja-ui·zh', { track: 'zh', zhLevel: 'HSK1' }, p => /^zh\b/.test(p) || /^(me|plan|path|vip|fav|calendar)/.test(p)],
  ['zh-ui·en', { track: 'en', enNative: 'zh', enLevel: 'A1' }, p => /^en\b/.test(p)],
  ['en-ui·ja', { track: 'ja', native: 'en' }, p => !/^(en|zh)\b/.test(p)],
  ['en-ui·zh', { track: 'zh', native: 'en', zhLevel: 'HSK1' }, p => /^zh\b/.test(p) || /^(me|plan|path|vip)/.test(p)],
];
const browser = await chromium.launch();
const report = {}; let total = 0;
for (const [tag, st, filt] of SETUPS) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 375, height: 812 }, locale: st.native === 'en' ? 'en-US' : 'zh-CN' });
  await ctx.route('**/vendor/supabase.js', r => r.fulfill({ contentType: 'text/javascript', body: MOCK }));
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await ctx.addInitScript(s => { localStorage.setItem('dojo-en-dev', '1'); if (!localStorage.getItem('nihongo-dojo:v1')) localStorage.setItem('nihongo-dojo:v1', JSON.stringify(Object.assign({ onboarded: true, xp: 40, petals: false, uiV2: 1, installHint: 1, level: 'N5' }, s))); localStorage.setItem('sb-test-auth-token', '1'); }, st);
  const page = await ctx.newPage();
  for (const p of ALL.filter(filt).sort((x, y) => /placement/.test(x) - /placement/.test(y))) {
    await page.goto(BASE + '#' + p); await page.waitForTimeout(700);
    const found = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.ask-mask, .word-sheet, .fx-ms, .toast').forEach(e => e.remove());   // 弹窗本来就在最上面
      const sel = 'main h1, main h2, main h3, main .title, main .rc-title, main .card-title, main .ti, main .lesson-title, main .tile b, main .hub-tile b, main .rank-name';
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom < 60 || r.top > innerHeight - 4) continue;   // 屏幕外的不看
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
        const pts = [[r.left + 3, r.top + r.height / 2], [r.right - 3, r.top + r.height / 2], [r.left + r.width / 2, r.top + 3], [r.left + r.width / 2, r.bottom - 3]];
        for (const [x, y] of pts) {
          if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue;
          const top = document.elementFromPoint(x, y);
          if (!top || el.contains(top) || top.contains(el)) continue;
          if (top.closest('nav.tabs, header, .top, .tabs')) continue;   // 底部导航栏、顶部栏是固定的，滚动时内容本来就会经过它们后面
          // 文字没有碰到这一点（标题框比文字宽）时不算：看这一点上有没有标题的文字
          const rg = document.createRange(); rg.selectNodeContents(el);
          const hit = [...rg.getClientRects()].some(q => x >= q.left && x <= q.right && y >= q.top && y <= q.bottom);
          if (!hit) continue;
          const cover = top.closest('[class]') || top;
          out.push(`${(el.textContent || '').trim().slice(0, 40)}  ← 被 <${cover.tagName.toLowerCase()} class="${cover.className}"> 盖住`);
          break;
        }
      }
      return [...new Set(out)];
    });
    if (found.length) { report[`${tag}:${p}`] = found; total += found.length; console.log(`${tag} #${p}`.padEnd(36), found.length, found[0]); }
  }
  await ctx.close();
}
await writeFile(OUT, JSON.stringify(report, null, 1));
console.log('== 被盖住的标题：', total);
await browser.close(); server.close();
