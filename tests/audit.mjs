// 全面检查：日语 N5–N1、中文 HSK1–6、英语 A1–C1 每个级别，免费和会员两种状态，把主要页面打开、能做题的从头答二十多题，
// 一路看有没有 JS 报错、页面上有没有「加载失败」、undefined、NaN 之类的异常文字。约 20 分钟。
// 冒烟测试（smoke.mjs）只用默认级别，查不出「某个级别才出错」的问题（例如 N2/N1 水平测试第 3 题），上线前跑这个。
// 运行：node tests/audit.mjs            两种状态都跑
//      node tests/audit.mjs free ja     只跑免费状态的日语
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = new URL('..', import.meta.url).pathname;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const sv = http.createServer(async (q, r) => { let f = normalize(decodeURIComponent(q.url.split('?')[0])); if (f === '/') f = '/index.html'; try { const b = await readFile(join(ROOT, f)); r.writeHead(200, { 'Content-Type': T[extname(f)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const B = `http://127.0.0.1:${sv.address().port}/`;
const MOCK = await readFile(join(ROOT, 'tests/mock-supabase.js'), 'utf8');
let MEMBER = false;
const MODES = process.argv[2] === 'free' ? [false] : process.argv[2] === 'member' ? [true] : [false, true];
const ONLY = process.argv[3];
const br = await chromium.launch();
const LV = { ja: ['N5','N4','N3','N2','N1'], zh: ['HSK1','HSK2','HSK3','HSK4','HSK5','HSK6'], en: ['A1','A2','B1','B2','C1'] };
const KEY = { ja: 'level', zh: 'zhLevel', en: 'enLevel' };
const R = {
  ja: L => ['home','study','ri','game','vocab','kanji','grammar','read','listen','exam','check','dictation','trans','conj','course','week','calendar','commute','fav','me/exam','me/weak','kana','dict','biz','anime','diagnose'],
  zh: L => ['zh','zh/study','zh/ri','zh/words',`zh/words/${L}`,'zh/grammar','zh/read','zh/listen','zh/exam',`zh/exam/${L}`,'zh/placement','zh/path','zh/dictation','zh/trans','zh/week','check','commute','me/exam','me/weak','zh/biz','zh/course','zh/pinyin'],
  en: L => ['en','en/ri',`en/words/${L}`,`en/grammar/${L}`,`en/read/${L}`,`en/listen/${L}`,'en/exam',`en/exam/${L}`,`en/path/${L}`,'en/placement','en/dictation','en/trans','en/week','check','commute','me/exam','me/weak','en/course','en/biz','en/abc'],
};
const BAD = /加载失败|読み込めません|読み込みに失敗|Could not load|undefined|NaN|\[object|\bnull\b/;
const out = [];
async function run(tr, L) {
  const ctx = await br.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  await ctx.route('**/vendor/supabase.js', r => r.fulfill({ contentType: 'text/javascript', body: MOCK }));
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const pg = await ctx.newPage(); let cur = '';
  const tag = () => `${MEMBER ? 'M ' : ''}${tr}/${L} #${cur}`;
  pg.on('pageerror', e => out.push(`${tag()}: JS ${e.message}`));
  pg.on('dialog', d => d.dismiss().catch(() => {}));
  await pg.addInitScript(([k, L, tr, M]) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('nihongo-dojo:v1', JSON.stringify({ onboarded: true, xp: 40, track: tr, [k]: L, petals: false, uiV2: 1, installHint: 1, badges: { first: 1 }, ...(M ? { member: { until: Date.now() + 9e9 } } : {}) })); localStorage.setItem('sb-test-auth-token', '1'); localStorage.setItem('dojo-intro', '1'); } }, [KEY[tr], L, tr, MEMBER]);
  for (const p of R[tr](L)) {
    cur = p;
    try {
      await pg.goto(B + 'blank'); await pg.goto(B + '#' + p); await pg.waitForTimeout(1200);
      const chk = async (s) => { const t = await pg.evaluate(() => (document.querySelector('main') || document.body).innerText); const m = t.match(BAD); if (m) out.push(`${tag()}${s}: "${t.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}"`); return !!m; };
      if (await chk('')) continue;
      // 开始按钮
      const st = await pg.$('main [data-start], main button.btn.pri.big');
      if (st && await st.isVisible()) { await st.click().catch(() => {}); await pg.waitForTimeout(1200); }
      for (let i = 0; i < 22; i++) {
        const o = await pg.$('main .opt:not([disabled])');
        if (!o || !(await o.isVisible())) break;
        await o.click().catch(() => {}); await pg.waitForTimeout(500);
        const nx = await pg.$('main [data-next]'); if (nx && await nx.isVisible()) { await nx.click().catch(() => {}); }
        await pg.waitForTimeout(700);
        if (await chk(` q${i + 1}`)) break;
      }
    } catch (e) { out.push(`${tag()}: EXC ${e.message.split('\n')[0]}`); }
  }
  await ctx.close();
}
const jobs = Object.entries(LV).flatMap(([tr, ls]) => ls.map(L => [tr, L])).filter(([tr]) => !ONLY || tr === ONLY);
for (MEMBER of MODES) {
  const N = 4; let k = 0;
  await Promise.all(Array.from({ length: N }, async () => { while (k < jobs.length) { const j = jobs[k++]; await run(...j); console.error('done', MEMBER ? 'member' : 'free', j.join('/')); } }));
}
const uniq = [...new Set(out)];
console.log(uniq.join('\n') || '全面检查通过：16 个级别 × ' + MODES.length + ' 种状态，没有发现问题');
await br.close(); sv.close();
process.exit(uniq.length ? 1 : 0);
