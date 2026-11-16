// 吉祥物：日本的小猫「ミケ」和中国的熊猫「パン」。学日语、韩语时小猫当老师，学中文时熊猫当老师；欢迎页两个一起出现。
// mascotSVG(who, mood, cls)：who = 'cat' | 'panda'；mood = happy / wow / sad / think / cheer；
// cls 里的 big / mini / wave / jump 沿用原来 .neko 的尺寸和动画（style.css）。
let MASCOT_N = 0;
const MASCOT_INK = '#2D2640';

function mascotEyes(mood, lx, rx, y, onDark) {
  const ink = onDark ? '#FFFFFF' : MASCOT_INK, hi = onDark ? MASCOT_INK : '#FFFFFF';
  const open = (x, r = 1) => onDark
    // 黑眼圈上：细细的白边 + 黑亮的大眼珠 + 两个高光（不画白眼球，免得像在瞪人）
    ? `<circle cx="${x}" cy="${y + .5}" r="${6.2 * r}" fill="#FFFFFF" opacity=".9"/><circle cx="${x}" cy="${y + 1}" r="${5.3 * r}" fill="#15121F"/><circle cx="${x + 1.9 * r}" cy="${y - 1.4 * r}" r="${2.2 * r}" fill="#FFFFFF"/><circle cx="${x - 1.8 * r}" cy="${y + 2.6 * r}" r="${1 * r}" fill="#FFFFFF" opacity=".85"/>`
    : `<ellipse cx="${x}" cy="${y}" rx="${4.4 * r}" ry="${5.4 * r}" fill="${ink}"/><circle cx="${x + 1.6 * r}" cy="${y - 2 * r}" r="${1.8 * r}" fill="${hi}"/><circle cx="${x - 1.4 * r}" cy="${y + 2 * r}" r="${.8 * r}" fill="${hi}" opacity=".8"/>`;
  const arc = x => `<path d="M${x - 5.5} ${y + 1} q5.5 -7 11 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  if (mood === 'happy' || mood === 'cheer') return arc(lx) + arc(rx);
  if (mood === 'wow') return open(lx, 1.18) + open(rx, 1.18);
  if (mood === 'think') return arc(lx) + open(rx);
  if (mood === 'sad') return open(lx, .9) + open(rx, .9) +
    `<path d="M${lx - 6} ${y - 9} l9 3M${rx + 6} ${y - 9} l-9 3" stroke="${onDark ? '#FFFFFF' : MASCOT_INK}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M${rx + 7} ${y + 4} q-3 5 0 7 q3 -2 0 -7z" fill="#7CC6F2"/>`;
  return open(lx) + open(rx);
}
function mascotMouth(mood, y) {
  if (mood === 'wow') return `<ellipse cx="60" cy="${y + 2}" rx="4" ry="4.6" fill="#7A2E45"/><ellipse cx="60" cy="${y + 4}" rx="2.6" ry="2" fill="#FF8FA8"/>`;
  if (mood === 'sad') return `<path d="M54 ${y + 4} q6 -5 12 0" fill="none" stroke="${MASCOT_INK}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (mood === 'cheer') return `<path d="M52 ${y} q8 10 16 0z" fill="#7A2E45"/><path d="M55 ${y + 3.5} q5 4 10 0" fill="#FF8FA8"/>`;
  return `<path d="M54 ${y} q3 3.2 6 0 q3 3.2 6 0" fill="none" stroke="${MASCOT_INK}" stroke-width="2.4" stroke-linecap="round"/>`;
}
const mascotSparkles = mood => mood === 'cheer' || mood === 'wow'
  ? '<g class="nk-spark" fill="#FFC94A"><path d="M14 30l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z"/><path d="M104 18l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z"/><circle cx="110" cy="44" r="2.2"/></g>' : '';

function mascotCat(mood, id) {
  return `<defs>
      <radialGradient id="cf${id}" cx="38%" cy="28%" r="80%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#F7F4FB"/><stop offset="1" stop-color="#E4DEEE"/></radialGradient>
      <clipPath id="ch${id}"><ellipse cx="60" cy="50" rx="38" ry="31"/></clipPath>
    </defs>
    <g class="nk-body">
      <path d="M86 112 C106 110 112 90 103 82 C97 77 90 83 96 89" fill="none" stroke="#F2A65A" stroke-width="7.5" stroke-linecap="round"/>
      <path d="M30 105 C30 85 44 77 60 77 C76 77 90 85 90 105 C90 121 78 126 60 126 C42 126 30 121 30 105Z" fill="url(#cf${id})" stroke="#E2DCEC" stroke-width="1.2"/>
      <ellipse cx="60" cy="108" rx="16" ry="13" fill="#FFF7FA"/>
      <ellipse cx="45" cy="123" rx="9.5" ry="5.5" fill="url(#cf${id})" stroke="#E2DCEC" stroke-width="1.2"/><ellipse cx="75" cy="123" rx="9.5" ry="5.5" fill="url(#cf${id})" stroke="#E2DCEC" stroke-width="1.2"/>
      <path d="M36 81 Q60 93 84 81" fill="none" stroke="#E5484D" stroke-width="6" stroke-linecap="round"/>
      <circle cx="60" cy="88.5" r="5.2" fill="#F7C548" stroke="#C9921C" stroke-width="1.2"/><path d="M57 89.5h6" stroke="#C9921C" stroke-width="1.2"/>
      <path d="M25 42 Q22 13 38 11 Q49 19 53 29Z" fill="url(#cf${id})" stroke="#E2DCEC" stroke-width="1.2"/><path d="M95 42 Q98 13 82 11 Q71 19 67 29Z" fill="url(#cf${id})" stroke="#E2DCEC" stroke-width="1.2"/>
      <path d="M31 35 Q30 19 38 17 Q44 22 47 29Z" fill="#FFB3C7"/><path d="M89 35 Q90 19 82 17 Q76 22 73 29Z" fill="#FFB3C7"/>
      <ellipse cx="60" cy="50" rx="38" ry="31" fill="url(#cf${id})" stroke="#E2DCEC" stroke-width="1.2"/>
      <g clip-path="url(#ch${id})"><path d="M18 46 Q22 22 46 18 Q54 30 46 40 Q34 46 18 46Z" fill="#F4A259"/><path d="M80 18 Q98 22 100 38 Q90 36 82 30Z" fill="#4A3F52"/></g>
      ${mascotEyes(mood, 47, 73, 51)}
      <path d="M57 57.5h6l-3 3.2z" fill="#FF8FA8"/>
      ${mascotMouth(mood, 62)}
      <ellipse cx="38" cy="61" rx="6.5" ry="3.8" fill="#FF9DB5" opacity=".55"/><ellipse cx="82" cy="61" rx="6.5" ry="3.8" fill="#FF9DB5" opacity=".55"/>
      <path d="M22 56l10 1M22 61l10-1M98 56l-10 1M98 61l-10-1" stroke="#C3BBD3" stroke-width="1.4" stroke-linecap="round"/>
    </g>
    <g class="nk-paw"><ellipse cx="96" cy="70" rx="10.5" ry="12.5" fill="url(#cf${id})" stroke="#E2DCEC" stroke-width="1.2"/><circle cx="92" cy="66" r="2" fill="#FFB3C7"/><circle cx="96.5" cy="64.5" r="2" fill="#FFB3C7"/><circle cx="101" cy="66" r="2" fill="#FFB3C7"/><ellipse cx="96.5" cy="72" rx="3.6" ry="3" fill="#FFB3C7"/></g>
    ${mascotSparkles(mood)}`;
}

function mascotPanda(mood, id) {
  const black = '#2E2A3B';
  // 熊猫：大头、圆滚滚的小身子，下垂的泪滴形黑眼圈里是闪亮的大眼睛；抱着一根竹子
  const patch = (x, flip) => `<path d="M${x - flip * 3} 42 C${x + flip * 7} 39 ${x + flip * 14} 50 ${x + flip * 13} 60 C${x + flip * 12} 68 ${x + flip * 2} 70 ${x - flip * 4} 63 C${x - flip * 9} 56 ${x - flip * 10} 45 ${x - flip * 3} 42Z" fill="url(#pb${id})"/>`;
  return `<defs>
      <radialGradient id="pf${id}" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".75" stop-color="#F7F6FA"/><stop offset="1" stop-color="#E4E1EC"/></radialGradient>
      <radialGradient id="pb${id}" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#4E4960"/><stop offset="1" stop-color="${black}"/></radialGradient>
    </defs>
    <g class="nk-body">
      <ellipse cx="60" cy="108" rx="29" ry="22" fill="url(#pf${id})" stroke="#E2DCEC" stroke-width="1.2"/>
      <ellipse cx="42" cy="121" rx="11" ry="8" fill="url(#pb${id})"/><ellipse cx="78" cy="121" rx="11" ry="8" fill="url(#pb${id})"/>
      <ellipse cx="42" cy="122" rx="5" ry="3.6" fill="#FFB3C7"/><ellipse cx="78" cy="122" rx="5" ry="3.6" fill="#FFB3C7"/>
      <g transform="rotate(-14 34 100)"><rect x="31" y="78" width="6" height="40" rx="3" fill="#7FD36B"/><path d="M31 90h6M31 102h6" stroke="#4FA93E" stroke-width="1.5"/><path d="M37 84 q10 -8 16 -4 q-8 6 -16 4z" fill="#5CC277"/></g>
      <ellipse cx="40" cy="104" rx="8" ry="10" transform="rotate(30 40 104)" fill="url(#pb${id})"/><ellipse cx="38" cy="108" rx="3" ry="2.4" fill="#FFB3C7" transform="rotate(30 38 108)"/>
      <circle cx="27" cy="25" r="12" fill="url(#pb${id})"/><circle cx="93" cy="25" r="12" fill="url(#pb${id})"/>
      <circle cx="27" cy="26" r="5.5" fill="#5A5470"/><circle cx="93" cy="26" r="5.5" fill="#5A5470"/>
      <ellipse cx="60" cy="52" rx="41" ry="34" fill="url(#pf${id})" stroke="#E2DCEC" stroke-width="1.2"/>
      ${patch(45, -1)}${patch(75, 1)}
      ${mascotEyes(mood, 45, 75, 53, true)}
      <path d="M56.5 62 q3.5 -2.4 7 0 q-1 3.2 -3.5 3.6 q-2.5 -.4 -3.5 -3.6z" fill="${black}"/>
      ${mascotMouth(mood, 67)}
      <ellipse cx="33" cy="67" rx="7" ry="4.2" fill="#FF9DB5" opacity=".7"/><ellipse cx="87" cy="67" rx="7" ry="4.2" fill="#FF9DB5" opacity=".7"/>
      <path d="M52 86 l8 4 l8 -4 l-2 7 l-6 -2 l-6 2z" fill="#14A37F"/><circle cx="60" cy="89.5" r="2.6" fill="#0E8A6A"/>
    </g>
    <g class="nk-paw"><ellipse cx="96" cy="72" rx="10" ry="12" fill="url(#pb${id})"/><ellipse cx="96" cy="74" rx="4" ry="3.4" fill="#FFB3C7"/><circle cx="91.5" cy="67.5" r="1.8" fill="#FFB3C7"/><circle cx="96" cy="66" r="1.8" fill="#FFB3C7"/><circle cx="100.5" cy="67.5" r="1.8" fill="#FFB3C7"/></g>
    ${mascotSparkles(mood)}`;
}

function mascotSVG(who = 'cat', mood = 'happy', cls = '') {
  const id = ++MASCOT_N;
  return `<svg class="neko ${who} ${cls}" viewBox="0 0 120 130" aria-hidden="true">${who === 'panda' ? mascotPanda(mood, id) : mascotCat(mood, id)}</svg>`;
}
// 两个一起（欢迎页、大的庆祝画面）
const mascotDuo = (mood = 'happy', cls = '') => `<span class="mascot-duo">${mascotSVG('cat', mood, cls + ' wave')}${mascotSVG('panda', mood, cls)}</span>`;
