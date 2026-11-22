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

const PAGES = ['week', 'en', 'en/words/A1', 'en/words/C1', 'en/ri', 'en/grammar/A2', 'en/read/B1', 'en/read/r-B1-03', 'en/listen/A1', 'en/exam', 'en/exam/B2', 'zh/exam', 'zh/exam/HSK4', 'en/path/A1', 'en/course', 'en/course/food/food-01', 'en/biz', 'en/biz/vocab', 'en/placement', 'en/abc', 'en/dict', 'en/dictation', 'en/trans', 'zh/dictation', 'zh/trans', 'zh/week', 'en/week', 'me/features', 'calendar', 'commute', 'fav', 'offline', 'me/exam', 'me/weak', 'path', 'path/N4', 'zh', 'zh/grammar', 'zh/grammar/zg-041', 'zh/placement', 'zh/path', 'zh/ri', 'zh/listen', 'zh/pinyin', 'zh/words', 'zh/words/HSK4', 'zh/read', 'zh/read/zh-r01', 'zh/course', 'zh/biz', 'zh/biz/vocab', 'zh/dict', 'zh/study', 'home', 'duel', 'buddy', 'me/settings', 'me/inbox', 'me/device', 'me/account', 'conj', 'course', 'course/campus', 'course/campus/campus-01', 'course/biz', 'course/biz/biz-09', 'biz/s/s-b3', 'read/tp-c06', 'study', 'ri', 'game', 'kana', 'vocab', 'kanji', 'grammar', 'read', 'listen', 'exam', 'biz', 'anime', 'trans', 'conj', 'dictation', 'dict', 'me', 'plan', 'about',
  'ko'];   // 韩语板块已删除：旧链接回首页

const fails = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
await ctx.route('**/vendor/supabase.js', r => r.fulfill({ contentType: 'text/javascript', body: MOCK }));
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());   // 不访问外网
const page = await ctx.newPage();
let cur = '';
page.on('pageerror', e => fails.push(`${cur}: JS 错误 ${e.message}`));
page.on('console', m => { if (/Content Security Policy|Refused to (load|execute|connect|apply)/.test(m.text())) fails.push(`${cur}: 被安全策略（CSP）拦下 ${m.text().slice(0, 160)}`); });
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
let nFlow = 0;
const flow = async (name, fn) => { cur = name; nFlow++; try { await page.goto(BASE + 'blank'); await fn();   /* 每个流程从新页面开始（上一个流程可能还停在做题中） */ } catch (e) { fails.push(`${name}: ${e.message.split('\n')[0]}`); } };
await flow('日语闯关第 1 关', async () => {
  await page.goto(BASE + '#study'); await page.goto(BASE + '#game');
  await page.$eval('.node:not([disabled])', b => b.click());
  await page.click('[data-play]', { timeout: 5000 });
  await page.click('.opt', { timeout: 5000 });
  await page.waitForSelector('.feedback', { timeout: 5000 });
});
await flow('日语翻译练习', async () => {
  await page.goto(BASE + '#home'); await page.goto(BASE + '#trans');
  // 排序作答
  await page.click('[data-mode="order"]', { timeout: 8000 }); await page.click('[data-start]', { timeout: 8000 });
  await page.click('[data-bank] [data-n] >> nth=0', { timeout: 5000 }); await page.click('[data-check]', { timeout: 5000 });
  await page.waitForSelector('.tr-explain', { timeout: 5000 });
  // 直接作答
  await page.goto(BASE + 'blank'); await page.goto(BASE + '#trans');
  await page.click('[data-mode="write"]', { timeout: 8000 }); await page.click('[data-start]', { timeout: 8000 });
  await page.click('[data-show]', { timeout: 5000 });
  await page.click('[data-g="2"]', { timeout: 5000 });
});
await flow('翻译练习', async () => {
  await page.goto(BASE + '#home'); await page.goto(BASE + '#trans');
  await page.click('[data-start]', { timeout: 8000 });
  await page.click('[data-show]', { timeout: 5000 });
});
// 在首页里直接做的练习（网址一直是 #home、#zh），做完点结果页的「回到今天」要能回到首页
const finishQuiz = async () => {
  for (let i = 0; i < 25; i++) {
    if (await page.$('[data-again]')) return;
    const opt = await page.$('.opt:not([disabled])'); if (opt) { await opt.click(); await page.waitForTimeout(120); }
    const nx = await page.$('[data-next]'); if (nx) { await nx.click(); await page.waitForTimeout(200); }
  }
  throw new Error('练习没有结束');
};
await flow('首页专练弱项 → 回到今天', async () => {
  await page.goto(BASE + '#home'); await page.waitForTimeout(1200);
  await page.evaluate(() => { Object.keys(ITEMS).filter(id => ITEMS[id].w).slice(0, 3).forEach(id => { S.wrong[id] = { n: 1, t: Date.now() }; }); save(); });
  await page.goto(BASE + 'blank'); await page.goto(BASE + '#home'); await page.waitForTimeout(1200);
  await page.click('.task:has-text("专练弱项") button', { timeout: 5000 });
  await finishQuiz();
  await page.click('main a.btn[href="#home"]', { timeout: 5000 });
  await page.waitForSelector('.home-head', { timeout: 5000 });
});
await flow('中文首页声调练习 → ホームへ', async () => {
  await page.goto(BASE + '#zh'); await page.waitForTimeout(2000);
  await page.click('.task:has-text("声調トレーニング") button', { timeout: 5000 });
  await finishQuiz();
  await page.click('main a.btn[href="#zh"]', { timeout: 5000 });
  await page.waitForSelector('.home-head', { timeout: 5000 });
  await page.evaluate(() => { S.track = 'ja'; save(); });
});
await flow('日语变形练习', async () => {
  await page.goto(BASE + '#home'); await page.goto(BASE + '#conj');
  await page.click('[data-conj-go]', { timeout: 8000 });
  await page.click('.opt', { timeout: 5000 });
  await page.waitForSelector('.feedback', { timeout: 5000 });
});
await flow('英语阅读文章', async () => {
  await page.goto(BASE + '#en/read/A1'); await page.click('a.read-card', { timeout: 5000 });
  await page.waitForSelector('.en-art', { timeout: 5000 });
});
await flow('接受好友挑战', async () => {
  await page.goto(BASE + '#home'); await page.goto(BASE + '#buddy');
  await page.click('[data-chal]', { timeout: 8000 });
  await page.waitForSelector('.duel-target', { timeout: 5000 });
  await page.click('.opt', { timeout: 5000 });
});
await flow('做题中查词典、按返回不丢进度', async () => {
  await page.goto(BASE + '#home'); await page.goto(BASE + '#conj');
  await page.click('[data-conj-go]', { timeout: 8000 }); await page.click('.opt', { timeout: 5000 }); await page.waitForSelector('.feedback', { timeout: 5000 });
  await page.fill('.gsearch input', '勉強'); await page.press('.gsearch input', 'Enter');
  await page.waitForSelector('.dict-layer .dict-card', { timeout: 8000 });
  await page.goBack(); await page.waitForTimeout(300);
  if (await page.$('.dict-layer') || !await page.$('.feedback')) throw new Error('关掉词典后没有回到题目');
  await page.goBack(); await page.waitForSelector('.ask-mask', { timeout: 5000 });
  await page.mouse.move(0, 0);   // 鼠标停在按钮边缘时，悬停上浮 1px 会来回抖动，测试工具会一直等它「稳定」
  await page.click('.ask-mask [data-k="0"]'); await page.waitForTimeout(300);
  if (!await page.$('.feedback')) throw new Error('选「继续做题」后题目不见了');
});
await flow('中国語：声調クイズと単語カード', async () => {
  await page.goto(BASE + '#zh/pinyin'); await page.click('[data-tq]', { timeout: 8000 });
  await page.click('.opt', { timeout: 5000 }); await page.waitForSelector('.feedback', { timeout: 5000 });
  await page.goto(BASE + 'blank'); await page.goto(BASE + '#zh/words');
  await page.click('[data-new]', { timeout: 8000 }); await page.click('[data-card]', { timeout: 5000 }); await page.click('[data-g="2"]', { timeout: 5000 });
});
await flow('假名写一写', async () => {
  await page.goto(BASE + '#kana'); await page.click('.kana[data-say="あ"]', { timeout: 8000 });
  await page.click('.kana-sheet [data-pad]', { timeout: 5000 });
  await page.waitForSelector('.pad-area .pad-plain path', { timeout: 8000 });
});
await flow('后台页面', async () => {
  await page.goto(BASE + 'admin.html'); await page.waitForSelector('table', { timeout: 8000 });
});

await browser.close();
server.close();
if (fails.length) { console.error(`失败 ${fails.length} 项：\n` + fails.map(f => ' - ' + f).join('\n')); process.exit(1); }
console.log(`全部通过：${PAGES.length} 个页面 + ${nFlow} 个流程`);
