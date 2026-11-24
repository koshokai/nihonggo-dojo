// 英语界面检查：以「母语是英语」的用户（学日语、学中文）打开所有页面，找出还没翻译成英语的界面文字。
// 学习内容本身（学日语时的日语原文 lang="ja"、学中文时的中文原文 lang="zh-CN"）不算；其余地方出现的汉字、假名都算没翻译。
// 用法：node tests/en-ui-audit.mjs [ja|zh] [输出文件]   → 打印每页的数量，并把所有没翻译的文字写进输出文件（JSON）
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = new URL('..', import.meta.url).pathname;
const TRACKS = process.argv[2] ? [process.argv[2]] : ['ja', 'zh'];
const OUT = process.argv[3] || '/tmp/en-ui-audit.json';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const file = path === '/' ? 'index.html' : path;
  try { const body = await readFile(join(ROOT, file)); res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;
const MOCK = await readFile(join(ROOT, 'tests/mock-supabase.js'), 'utf8');
const smoke = await readFile(join(ROOT, 'tests/smoke.mjs'), 'utf8');
const ALL = eval(smoke.slice(smoke.indexOf('const PAGES = ') + 14, smoke.indexOf('];', smoke.indexOf('const PAGES = ')) + 1));
const PAGES = { ja: ALL.filter(p => !/^(en|zh)\b/.test(p) && p !== 'ko'), zh: ALL.filter(p => /^zh\b/.test(p) || ['me/settings', 'me', 'plan', 'calendar', 'fav', 'me/features', 'me/inbox', 'me/account', 'me/device', 'path', 'buddy', 'duel', 'about'].includes(p)) };

const browser = await chromium.launch();
const PAGE_ERRORS = [];
const report = {};
for (const tr of TRACKS) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, locale: 'en-US' });
  await ctx.route('**/vendor/supabase.js', r => r.fulfill({ contentType: 'text/javascript', body: MOCK }));
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await ctx.addInitScript(t => {
    localStorage.setItem('dojo-en-dev', '1');
    if (!localStorage.getItem('nihongo-dojo:v1')) localStorage.setItem('nihongo-dojo:v1', JSON.stringify({ onboarded: true, xp: 40, track: t, native: 'en', petals: false, uiV2: 1, installHint: 1, level: 'N5', zhLevel: 'HSK1' }));
    localStorage.setItem('sb-test-auth-token', '1');
  }, tr);
  const page = await ctx.newPage();
  page.on('pageerror', e => PAGE_ERRORS.push(`${tr}: ${e.message}`));   // 英语界面下页面报错（例如全局变量重名）也要发现
  const all = new Map();
  for (const p of [...PAGES[tr]].sort((x, y) => /placement/.test(x) - /placement/.test(y))) {   // 分级测试会一直占着页面，放到最后
    await page.goto(BASE + '#' + p);
    await page.waitForTimeout(700);
    const found = await page.evaluate(tr => {
      const out = [], cjk = /[぀-ヿ㐀-鿿]/;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode());) {
        const t = n.textContent.replace(/\s+/g, ' ').trim();
        if (!t || !cjk.test(t)) continue;
        const el = n.parentElement;
        if (!el || el.closest('script,style,[hidden],[aria-hidden="true"]')) continue;
        const lang = (el.closest('[lang]') || {}).lang || '';
        if (new RegExp('^' + (tr === 'zh' ? 'zh' : 'ja'), 'i').test(lang)) continue;   // 学习内容（学日语：日语原文；学中文：中文原文）。另一种语言写的讲解、翻译都要换成英语
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (/^[\s猫先生·]+$/.test(t)) continue;   // 品牌名
        // 已经是英文、只引用了日语（例如 "Noun + は marks the topic"、人名）的不算
        const nCjk = (t.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length, nLat = (t.match(/[A-Za-z]/g) || []).length;
        if (nLat > nCjk * 2) continue;
        out.push(t.slice(0, 120));
      }
      return [...new Set(out)];
    }, tr);
    report[`${tr}:${p}`] = found;
    found.forEach(t => all.set(t, (all.get(t) || 0) + 1));
    console.log(`${tr} #${p}`.padEnd(34), found.length);
  }
  console.log(`== ${tr}: 没翻译的不同文字 ${all.size} 条`);
  await ctx.close();
}
await writeFile(OUT, JSON.stringify(report, null, 1));
await browser.close();
if (PAGE_ERRORS.length) { console.log(`✗ 页面报错 ${PAGE_ERRORS.length} 次：`); [...new Set(PAGE_ERRORS)].slice(0, 20).forEach(e => console.log('  ' + e)); process.exitCode = 1; }
server.close();
