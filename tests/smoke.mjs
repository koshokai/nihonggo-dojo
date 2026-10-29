// 冒烟测试：在无头浏览器里把三种语言的主要页面都打开一遍，再走几个关键流程。
// 任何页面报 JS 错误、页面空白或流程走不通都算失败。服务器（Supabase）用 tests/mock-supabase.js 代替。
// 本地运行：npx playwright@1.48.2 install chromium && node tests/smoke.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');   // 也能用全局安装的 playwright（NODE_PATH）
const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const file = path === '/' ? 'index.html' : path;
  try { const body = await readFile(join(ROOT, file)); res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;
const MOCK = await readFile(join(ROOT, 'tests/mock-supabase.js'), 'utf8');

const PAGES = ['home', 'study', 'ri', 'game', 'kana', 'vocab', 'kanji', 'grammar', 'read', 'listen', 'exam', 'biz', 'anime', 'trans', 'conj', 'dictation', 'dict', 'me', 'about',
  ...['ko', 'en'].flatMap(t => [t, `${t}/study`, `${t}/ri`, `${t}/game`, `${t}/abc`, `${t}/words`, `${t}/phrases`, `${t}/grammar`, `${t}/levels`, `${t}/read`, `${t}/listen`, `${t}/exam`, `${t}/biz`, `${t}/trans`, `${t}/dictation`, `${t}/placement`, `${t}/dict`])];

const fails = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
await ctx.route('**/vendor/supabase.js', r => r.fulfill({ contentType: 'text/javascript', body: MOCK }));
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());   // 不访问外网
const page = await ctx.newPage();
let cur = '';
page.on('pageerror', e => fails.push(`${cur}: JS 错误 ${e.message}`));
await page.addInitScript(() => {
  if (!localStorage.getItem('nihongo-dojo:v1')) localStorage.setItem('nihongo-dojo:v1', JSON.stringify({ onboarded: true, xp: 40, track: 'ja', petals: false, uiV2: 1, installHint: 1, level: 'N5' }));
  localStorage.setItem('sb-test-auth-token', '1');
});

for (const p of PAGES) {
  cur = '#' + p;
  await page.goto(BASE + '#' + p);
  await page.waitForTimeout(900);
  const text = await page.evaluate(() => (document.querySelector('main') || document.body).innerText.trim());
  if (text.length < 20) fails.push(`${cur}: 页面几乎是空的`);
  if (/加载失败/.test(text)) fails.push(`${cur}: 显示“加载失败”`);
}

// 关键流程
const flow = async (name, fn) => { cur = name; try { await fn(); } catch (e) { fails.push(`${name}: ${e.message.split('\n')[0]}`); } };
await flow('日语闯关第 1 关', async () => {
  await page.goto(BASE + '#study'); await page.goto(BASE + '#game');
  await page.$eval('.node:not([disabled])', b => b.click());
  await page.click('[data-play]', { timeout: 5000 });
  await page.click('.opt', { timeout: 5000 });
  await page.waitForSelector('.feedback', { timeout: 5000 });
});
await flow('日语翻译练习', async () => {
  await page.goto(BASE + '#home'); await page.goto(BASE + '#trans');
  await page.click('[data-start]', { timeout: 8000 });
  await page.click('[data-show]', { timeout: 5000 });
  await page.click('[data-g="2"]', { timeout: 5000 });
});
await flow('韩语翻译练习', async () => {
  await page.goto(BASE + '#ko'); await page.goto(BASE + '#ko/trans');
  await page.click('[data-start]', { timeout: 8000 });
  await page.click('[data-show]', { timeout: 5000 });
});
await flow('日语变形练习', async () => {
  await page.goto(BASE + '#home'); await page.goto(BASE + '#conj');
  await page.click('[data-conj-go]', { timeout: 8000 });
  await page.click('.opt', { timeout: 5000 });
  await page.waitForSelector('.feedback', { timeout: 5000 });
});
await flow('英语阅读文章', async () => {
  await page.goto(BASE + '#en/read'); await page.click('a.read-card', { timeout: 5000 });
  await page.waitForSelector('.ra-text', { timeout: 5000 });
});
await flow('后台页面', async () => {
  await page.goto(BASE + 'admin.html'); await page.waitForSelector('table', { timeout: 8000 });
});

await browser.close();
server.close();
if (fails.length) { console.error(`失败 ${fails.length} 项：\n` + fails.map(f => ' - ' + f).join('\n')); process.exit(1); }
console.log(`全部通过：${PAGES.length} 个页面 + 6 个流程`);
