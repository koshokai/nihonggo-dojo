// 把 stickers.js 里的贴图渲染成 LINE 要求的透明 PNG：
//   node tools/stickers/render.js <fontsource 目录>
// 字体（SIL OFL，可商用）：npm i @fontsource/zen-maru-gothic @fontsource/noto-sans-sc，把 node_modules/@fontsource 传进来。
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const { SET, sticker, MAIN, TAB } = require('./stickers.js');
const FONTS = path.resolve(process.argv[2] || 'node_modules/@fontsource');
const OUT = path.resolve(__dirname, '../../stickers/line');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  const pkg = n => fs.existsSync(`${FONTS}/${n}/package`) ? `${FONTS}/${n}/package` : `${FONTS}/${n}`;
  for (const n of ['zen-maru-gothic', 'noto-sans-sc']) if (!fs.existsSync(`${pkg(n)}/package.json`)) throw new Error('font package not found: ' + pkg(n));
  const css = [`${pkg('zen-maru-gothic')}/900.css`, `${pkg('noto-sans-sc')}/700.css`].map(f => `<link rel="stylesheet" href="file://${f}">`).join('');
  const all = [...SET.map((s, i) => [String(i + 1).padStart(2, '0'), sticker(s)]), ['main', MAIN()], ['tab', TAB()]];
  const text = SET.map(s => s[0] + s[1]).join('') + '!?Zz福';
  const html = path.join(require('os').tmpdir(), 'stickers-render.html');
  fs.writeFileSync(html, `<html><head>${css}<style>body{margin:0;background:transparent}svg{display:block}</style></head><body>
    <div style="font-family:'Zen Maru Gothic';font-weight:900">${text}</div><div style="font-family:'Noto Sans SC';font-weight:700">${text}</div>
    ${all.map(([n, svg]) => `<div id="s${n}" style="display:inline-block">${svg}</div>`).join('')}</body></html>`);
  await p.goto('file://' + html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  const loaded = await p.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family));
  if (!loaded.some(f => /Zen Maru/.test(f)) || !loaded.some(f => /Noto Sans SC/.test(f))) throw new Error('fonts not loaded: ' + [...new Set(loaded)]);
  console.log('fonts', [...new Set(loaded)].join(', '));
  for (const [n] of all) await (await p.$(`#s${n} svg`)).screenshot({ path: `${OUT}/${n}.png`, omitBackground: true });
  await b.close();
  console.log('wrote', all.length, 'images to', OUT);
})();
