// LINE 贴图「日语道场的招财猫」：中日双语。由 render.js 用浏览器逐张渲染成透明 PNG。
// 每张：表情 eyes、嘴 mouth、姿势 pose、道具 props、日语 jp、中文 zh。
const INK = '#4A3F52', PINK = '#F6A9C0', BLUSH = '#F9B9CD', RED = '#D9452F', GOLD = '#F2C14B', WHITE = '#FFFFFF';

const EYES = {
  happy: '<path d="M44 52 q5 -6 10 0M66 52 q5 -6 10 0"/>',
  wow: `<circle cx="49" cy="50" r="4" fill="${INK}" stroke="none"/><circle cx="71" cy="50" r="4" fill="${INK}" stroke="none"/><circle cx="50.5" cy="48.5" r="1.3" fill="#fff" stroke="none"/><circle cx="72.5" cy="48.5" r="1.3" fill="#fff" stroke="none"/>`,
  sad: '<path d="M44 50 q5 5 10 0M66 50 q5 5 10 0"/><path d="M43 43 l10 3M77 43 l-10 3"/>',
  wink: `<path d="M44 52 q5 -6 10 0"/><circle cx="71" cy="50" r="4" fill="${INK}" stroke="none"/>`,
  sleepy: '<path d="M44 51 h10M66 51 h10"/>',
  love: `<path d="M49 55 c-6 -4 -6 -10 -2 -10 c1.5 0 2 1 2 2 c0 -1 .5 -2 2 -2 c4 0 4 6 -2 10z" fill="${RED}" stroke="none"/><path d="M71 55 c-6 -4 -6 -10 -2 -10 c1.5 0 2 1 2 2 c0 -1 .5 -2 2 -2 c4 0 4 6 -2 10z" fill="${RED}" stroke="none"/>`,
  worry: `<circle cx="49" cy="51" r="3.4" fill="${INK}" stroke="none"/><circle cx="71" cy="51" r="3.4" fill="${INK}" stroke="none"/><path d="M42 42 l10 -3M78 42 l-10 -3"/>`,
  cry: '<path d="M43 49 l10 4 M43 55 l10 -2M77 49 l-10 4M77 55 l-10 -2"/>',
  angry: `<path d="M42 44 l12 5M78 44 l-12 5"/><circle cx="49" cy="53" r="3" fill="${INK}" stroke="none"/><circle cx="71" cy="53" r="3" fill="${INK}" stroke="none"/>`
};
const MOUTH = {
  w: '<path d="M54 62 q3 3 6 0 q3 3 6 0"/>',
  open: `<path d="M54 61 q6 9 12 0z" fill="#E8738F"/>`,
  o: `<ellipse cx="60" cy="64" rx="3.2" ry="4" fill="#E8738F"/>`,
  flat: '<path d="M55 64 h10"/>',
  wave: '<path d="M53 64 q2.3 -2 4.6 0 q2.3 2 4.6 0 q2.3 -2 4.6 0"/>'
};

// 猫：pose = maneki（举右爪）| both（双爪举起）| bow（低头鞠躬）| none（双爪放下）| wave（挥手）
function cat({ eyes = 'happy', mouth = 'w', pose = 'maneki', tears = false }) {
  const paw = (x, y, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot})"><ellipse rx="11" ry="14" fill="${WHITE}" stroke="${INK}" stroke-width="2.4"/><path d="M-5 -8 v5M0 -9 v5M5 -8 v5" stroke="${INK}" stroke-width="2" stroke-linecap="round"/></g>`;
  const head = `<g class="head">
      <path d="M29 42 L35 13 L53 30 Z M91 42 L85 13 L67 30 Z" fill="${WHITE}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M35 33 L38 21 L46 29Z M85 33 L82 21 L74 29Z" fill="${PINK}"/>
      <ellipse cx="60" cy="50" rx="35" ry="28" fill="${WHITE}" stroke="${INK}" stroke-width="2.4"/>
      <circle cx="40" cy="62" r="5.5" fill="${BLUSH}" opacity=".85"/><circle cx="80" cy="62" r="5.5" fill="${BLUSH}" opacity=".85"/>
      <g fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${EYES[eyes]}${MOUTH[mouth]}</g>
      <path d="M57.5 58 h5 l-2.5 2.6z" fill="${PINK}"/>
      ${tears ? `<path d="M45 58 q-3 8 0 10 q3 -2 0 -10z M75 58 q-3 8 0 10 q3 -2 0 -10z" fill="#7FC8F0"/>` : ''}
    </g>`;
  const body = `<ellipse cx="60" cy="100" rx="34" ry="27" fill="${WHITE}" stroke="${INK}" stroke-width="2.4"/>
    <ellipse cx="60" cy="104" rx="17" ry="14" fill="#FFF3F6"/>
    <path d="M31 74 q29 13 58 0" fill="none" stroke="${RED}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="60" cy="82" r="5.5" fill="${GOLD}" stroke="${INK}" stroke-width="1.5"/>
    <ellipse cx="45" cy="123" rx="10" ry="6" fill="${WHITE}" stroke="${INK}" stroke-width="2.2"/><ellipse cx="75" cy="123" rx="10" ry="6" fill="${WHITE}" stroke="${INK}" stroke-width="2.2"/>`;
  const paws = { maneki: paw(98, 64), both: paw(98, 62) + paw(22, 62), none: paw(40, 100, 20) + paw(80, 100, -20), wave: paw(100, 58, 18), bow: paw(44, 98, 25) + paw(76, 98, -25) }[pose];
  const h = pose === 'bow' ? head.replace('class="head"', 'class="head" transform="rotate(14 60 70) translate(0 8)"') : head;
  return `<g>${body}${h}${paws}</g>`;
}

// 道具：坐标都在 370×320 画布上
const PROPS = {
  hearts: '<g fill="#F2789F"><path d="M300 70 c-14 -10 -14 -24 -4 -24 c4 0 6 3 6 5 c0 -2 2 -5 6 -5 c10 0 10 14 -8 24z"/><path transform="translate(42 92) scale(.6)" d="M0 30 c-14 -10 -14 -24 -4 -24 c4 0 6 3 6 5 c0 -2 2 -5 6 -5 c10 0 10 14 -8 24z"/></g>',
  sparkle: `<g fill="${GOLD}"><path d="M300 60 l5 14 14 5 -14 5 -5 14 -5 -14 -14 -5 14 -5z"/><path d="M55 110 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3z"/><path d="M318 150 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z"/></g>`,
  sweat: '<path d="M262 92 q-10 16 0 22 q10 -6 0 -22z" fill="#7FC8F0" stroke="#4A9AD0" stroke-width="2"/>',
  zzz: `<g fill="#8C7BB0" font-family="Zen Maru Gothic" font-weight="900"><text x="268" y="96" font-size="34">Z</text><text x="300" y="70" font-size="26">z</text><text x="322" y="50" font-size="20">z</text></g>`,
  moon: `<path d="M70 70 a26 26 0 1 0 22 36 a20 20 0 1 1 -22 -36z" fill="${GOLD}"/>`,
  sun: `<g transform="translate(305 80)"><circle r="20" fill="#FFC94D"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path transform="rotate(${a})" d="M0 -27 v-10" stroke="#FFB020" stroke-width="5" stroke-linecap="round"/>`).join('')}</g>`,
  confetti: [['#F2789F', 60, 80, 20], ['#7FC8F0', 300, 70, -30], [GOLD, 320, 140, 40], ['#93C46A', 48, 150, -10], ['#B78CF2', 280, 40, 60], ['#F2789F', 90, 40, 30]].map(([c, x, y, r]) => `<rect x="${x}" y="${y}" width="12" height="6" rx="2" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`).join(''),
  bowl: `<g transform="translate(270 196)"><path d="M-40 0 h80 q-4 36 -40 36 q-36 0 -40 -36z" fill="${RED}"/><ellipse cy="0" rx="40" ry="9" fill="#FFF8E7"/><path d="M-22 -4 q8 -6 16 0 M-2 -4 q8 -6 16 0" stroke="#E8D9B0" stroke-width="3" fill="none"/><path d="M10 -40 L30 -6 M18 -42 L36 -8" stroke="#B07A4F" stroke-width="4" stroke-linecap="round"/></g>`,
  exclaim: `<g fill="${RED}" font-family="Zen Maru Gothic" font-weight="900" font-size="52"><text x="276" y="120" transform="rotate(12 276 120)">!?</text></g>`,
  question: `<g fill="#4A9AD0" font-family="Zen Maru Gothic" font-weight="900" font-size="48"><text x="282" y="118" transform="rotate(10 282 118)">?</text></g>`,
  flower: `<g transform="translate(300 90)">${[0, 72, 144, 216, 288].map(a => `<ellipse rx="9" ry="14" transform="rotate(${a}) translate(0 -12)" fill="#F7A8C2"/>`).join('')}<circle r="7" fill="${GOLD}"/></g>`,
  note: `<g fill="#8C7BB0"><path d="M290 60 v34 a8 6 0 1 1 -4 -5 v-24 l20 -5 v26 a8 6 0 1 1 -4 -5 v-19z"/></g>`,
  fire: '<path d="M300 150 c-20 -14 -12 -36 0 -50 c0 14 14 14 12 28 c8 -6 8 -14 6 -20 c12 16 8 36 -18 42z" fill="#FF8A3D"/>',
  coin: `<g transform="translate(300 170)"><ellipse rx="26" ry="16" fill="${GOLD}" stroke="#C99A2E" stroke-width="3"/><text x="0" y="7" text-anchor="middle" font-size="20" font-weight="900" fill="#8A5A00" font-family="Zen Maru Gothic">福</text></g>`,
  tear: '<g fill="#7FC8F0"><path d="M84 160 q-8 12 0 16 q8 -4 0 -16z"/></g>',
  ok: `<g transform="translate(300 150)"><circle r="30" fill="none" stroke="#3E8A55" stroke-width="9"/></g>`,
  book: '<g transform="translate(262 196)"><path d="M0 0 q-30 -12 -56 -6 v40 q26 -6 56 6z M0 0 q30 -12 56 -6 v40 q-26 -6 -56 6z" fill="#fff" stroke="#4A3F52" stroke-width="3"/></g>'
};

// 16 张：[日语, 中文, 表情, 嘴, 姿势, 道具[], 落泪?]
const SET = [
  ['ありがとう', '谢谢', 'happy', 'open', 'maneki', ['hearts']],
  ['おつかれさま', '辛苦了', 'happy', 'w', 'none', ['sparkle']],
  ['了解です！', '收到！', 'wink', 'open', 'maneki', ['ok']],
  ['よろしく\nお願いします', '请多关照', 'happy', 'w', 'bow', []],
  ['おはよう', '早上好', 'happy', 'open', 'both', ['sun']],
  ['おやすみ', '晚安', 'sleepy', 'w', 'none', ['zzz', 'moon']],
  ['すみません…', '不好意思…', 'sad', 'wave', 'bow', ['sweat']],
  ['やったー！', '太好了！', 'happy', 'open', 'both', ['confetti']],
  ['がんばって！', '加油！', 'angry', 'open', 'maneki', ['fire']],
  ['えっ！？', '诶？！', 'wow', 'o', 'none', ['exclaim']],
  ['おめでとう！', '恭喜！', 'happy', 'open', 'both', ['confetti', 'sparkle']],
  ['いただきます', '我开动了', 'happy', 'open', 'none', ['bowl']],
  ['ごめんね', '对不起', 'cry', 'wave', 'none', [], true],
  ['だいじょうぶ？', '没事吧？', 'worry', 'flat', 'maneki', ['question']],
  ['すき！', '喜欢！', 'love', 'open', 'both', ['hearts', 'sparkle']],
  ['またね！', '回头见！', 'happy', 'open', 'wave', ['note']]
];

// 一张贴图的 SVG（370×320，四周留 10px）
function sticker([jp, zh, eyes, mouth, pose, props, tears]) {
  // 全角标点在 palt（比例宽度）下更紧凑；按最长一行的字数定字号，保证左右各留 ≥ 14px
  const lines = jp.split('\n');
  const longest = Math.max(...lines.map(l => [...l].length));
  const fs = Math.min(58, Math.floor(330 / (longest * 0.92)));
  const top = lines.length > 1 ? 10 + fs : 14 + fs;
  const jpText = lines.map((l, i) => `<text x="185" y="${top + i * (fs + 2)}" text-anchor="middle" font-size="${fs}">${l}</text>`).join('');
  const textH = top + (lines.length - 1) * (fs + 2);
  // 猫放大到 1.62 倍，紧贴在文字下面，底部留给中文
  const sc = lines.length > 1 ? 1.42 : 1.62, catW = 120 * sc, catH = 130 * sc;
  const catY = Math.min(textH - 8, 274 - catH);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="370" height="320" viewBox="0 0 370 320">
    ${props.map(p => PROPS[p]).join('')}
    <g transform="translate(${185 - catW / 2} ${catY}) scale(${sc})">${cat({ eyes, mouth, pose, tears })}</g>
    <g font-family="Zen Maru Gothic" font-weight="900" fill="#E0457B" stroke="#fff" stroke-width="11" stroke-linejoin="round" paint-order="stroke" style="font-feature-settings:'palt'">${jpText}</g>
    <g font-family="Noto Sans SC" font-weight="700" font-size="26" fill="${INK}" stroke="#fff" stroke-width="8" stroke-linejoin="round" paint-order="stroke"><text x="185" y="298" text-anchor="middle">${zh}</text></g>
  </svg>`;
}
// 主图 240×240、聊天标签 96×74
const MAIN = () => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">${PROPS.sparkle.replace(/translate\(0 0\)/, '')}<g transform="translate(40 30) scale(1.35)">${cat({ eyes: 'happy', mouth: 'open', pose: 'maneki' })}</g></svg>`;
const TAB = () => `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="74" viewBox="0 0 96 74"><g transform="translate(14 1) scale(.55)">${cat({ eyes: 'happy', mouth: 'w', pose: 'maneki' })}</g></svg>`;
if (typeof module !== 'undefined') module.exports = { SET, sticker, MAIN, TAB };
