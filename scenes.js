// 阅读卡片的插图：全部是手绘 SVG（320×180），不依赖外部图片。
// scene(key) 返回 SVG 字符串；每次调用的渐变 id 都不同，同一页面里可以放很多张。
let sceneSeq = 0;
function scene(key) {
  const u = 's' + (++sceneSeq);
  const f = SCENES[key] || SCENES.sakura;
  return `<svg class="scene" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">${f(u)}</svg>`;
}
const sky = (u, a, b) => `<defs><linearGradient id="${u}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="180" fill="url(#${u}k)"/>`;
const sun = (x, y, r, c, o = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}"/>`;
const cloud = (x, y, s = 1, c = '#fff', o = .9) => `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}" opacity="${o}"><ellipse cx="0" cy="0" rx="22" ry="9"/><ellipse cx="-12" cy="-5" rx="11" ry="9"/><ellipse cx="8" cy="-8" rx="13" ry="11"/></g>`;
const hill = (d, c) => `<path d="${d}" fill="${c}"/>`;
const petal = (x, y, r = 0, s = 1, c = '#F7A8C2') => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M0 0C-4-5-3-10 0-11C3-10 4-5 0 0Z" fill="${c}" opacity=".9"/>`;
const petals = (n, seed, c) => { let o = '', s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280; for (let i = 0; i < n; i++) o += petal(rnd() * 320, rnd() * 180, rnd() * 360, .6 + rnd() * .7, c); return o; };
const blossom = (x, y, r, c = '#F9B9CD') => `<g fill="${c}"><circle cx="${x}" cy="${y}" r="${r}"/><circle cx="${x - r * .8}" cy="${y + r * .3}" r="${r * .75}"/><circle cx="${x + r * .85}" cy="${y + r * .25}" r="${r * .8}"/><circle cx="${x + r * .1}" cy="${y - r * .6}" r="${r * .7}"/></g>`;
const stars = (n, seed) => { let o = '', s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280; for (let i = 0; i < n; i++) o += `<circle cx="${rnd() * 320}" cy="${rnd() * 110}" r="${.6 + rnd() * 1.2}" fill="#fff" opacity="${.4 + rnd() * .6}"/>`; return o; };

const SCENES = {
  sakura: u => sky(u, '#CFE8FF', '#FFE9F1') + cloud(70, 40) + cloud(250, 30, .8) +
    hill('M0 150Q80 125 160 140T320 135V180H0Z', '#BFE3B4') +
    `<path d="M200 180C204 140 198 118 186 96M196 130C214 118 232 112 250 112M190 110C176 100 164 98 150 100" stroke="#8A5A4A" stroke-width="7" fill="none" stroke-linecap="round"/>` +
    blossom(186, 82, 26) + blossom(244, 100, 22, '#F7A8C2') + blossom(150, 96, 20, '#FBC8D6') + blossom(215, 70, 18, '#FDD5E2') + petals(18, 7),
  castle: u => sky(u, '#BFDDF7', '#FDEBDD') + cloud(60, 36) + cloud(270, 50, .7) +
    hill('M0 160Q160 140 320 160V180H0Z', '#A9CFA0') +
    `<g transform="translate(160 0)"><path d="M-70 160L-60 128H60L70 160Z" fill="#9C9384"/><path d="M-62 128H62V112H-62Z" fill="#F7F3EC"/><path d="M-74 114L0 92L74 114Z" fill="#4D5B6E"/>` +
    `<path d="M-46 92H46V78H-46Z" fill="#F7F3EC"/><path d="M-58 80L0 60L58 80Z" fill="#4D5B6E"/><path d="M-30 60H30V48H-30Z" fill="#F7F3EC"/><path d="M-42 50L0 30L42 50Z" fill="#4D5B6E"/>` +
    `<path d="M-14 30Q0 20 14 30" stroke="#E2B13C" stroke-width="3" fill="none"/>${[-40, -16, 8, 32].map(x => `<rect x="${x}" y="116" width="8" height="8" fill="#4D5B6E"/>`).join('')}${[-22, 6].map(x => `<rect x="${x}" y="82" width="7" height="7" fill="#4D5B6E"/>`).join('')}</g>` +
    blossom(40, 150, 18) + blossom(285, 148, 20) + petals(10, 3),
  fuji: u => sky(u, '#9CC9F2', '#FCE3D6') + sun(260, 46, 18, '#FFD27A') + cloud(90, 40, .9) +
    `<path d="M40 160L140 54Q160 44 180 54L280 160Z" fill="#6E86B8"/><path d="M118 78L140 54Q160 44 180 54L202 78Q190 72 182 80Q170 70 160 80Q148 70 138 80Q128 72 118 78Z" fill="#fff"/>` +
    hill('M0 150Q100 130 200 150T320 145V180H0Z', '#8FC38A') + `<path d="M0 168H320V180H0Z" fill="#7FB6E0"/>`,
  torii: u => sky(u, '#FFE3C2', '#FFC9D6') + sun(80, 60, 30, '#FFF1C9', .9) +
    hill('M0 150Q160 135 320 150V180H0Z', '#C6A98C') +
    `<g fill="#D9452F"><rect x="60" y="48" width="200" height="12" rx="3"/><rect x="72" y="70" width="176" height="8"/><rect x="96" y="56" width="12" height="104"/><rect x="212" y="56" width="12" height="104"/></g><path d="M52 44Q160 30 268 44L262 52Q160 40 58 52Z" fill="#2E2A2F"/><rect x="152" y="58" width="16" height="14" fill="#2E2A2F"/>` +
    `<path d="M120 160H200L215 180H105Z" fill="#E7D4BD"/>` + petals(8, 11),
  onsen: u => sky(u, '#A9C6E8', '#EAD9F1') + hill('M0 110Q60 70 130 100T320 90V180H0Z', '#7FA88A') +
    `<ellipse cx="160" cy="145" rx="130" ry="30" fill="#BFE4EC"/><ellipse cx="160" cy="145" rx="110" ry="22" fill="#9AD3E0"/>` +
    [110, 160, 210].map(x => `<path d="M${x} 130C${x - 10} 115 ${x + 10} 105 ${x} 90" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>`).join('') +
    [40, 70, 260, 290].map((x, i) => `<ellipse cx="${x}" cy="${140 + i % 2 * 6}" rx="16" ry="9" fill="#8C8794"/>`).join('') +
    `<g transform="translate(160 150)"><circle r="12" fill="#FFE0CC"/><circle cx="-4" cy="-1" r="1.5" fill="#4A3F52"/><circle cx="4" cy="-1" r="1.5" fill="#4A3F52"/><rect x="-9" y="-16" width="18" height="6" rx="3" fill="#fff"/></g>`,
  sushi: u => sky(u, '#FFF4E4', '#FFE1E1') + `<rect x="30" y="120" width="260" height="30" rx="8" fill="#B07A4F"/><rect x="40" y="150" width="20" height="14" fill="#8A5A3A"/><rect x="260" y="150" width="20" height="14" fill="#8A5A3A"/>` +
    [[80, '#F28D6B'], [140, '#F5F0E8'], [200, '#E9555B']].map(([x, c]) => `<rect x="${x - 24}" y="96" width="48" height="24" rx="10" fill="#fff"/><path d="M${x - 28} 100Q${x} 80 ${x + 28} 100Q${x} 92 ${x - 28} 100Z" fill="${c}"/><path d="M${x - 26} 98Q${x} 84 ${x + 26} 98" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>`).join('') +
    `<rect x="236" y="96" width="44" height="24" rx="10" fill="#fff"/><rect x="236" y="104" width="44" height="10" fill="#2F3B2E"/><circle cx="258" cy="96" r="10" fill="#F2A13B"/>` +
    `<circle cx="60" cy="50" r="6" fill="#F6C9A8" opacity=".7"/>`,
  ramen: u => sky(u, '#FFE9C9', '#FFD6C2') + `<path d="M60 90H260Q256 160 160 160Q64 160 60 90Z" fill="#D9452F"/><path d="M70 100H250" stroke="#fff" stroke-width="3" stroke-dasharray="10 6"/>` +
    `<ellipse cx="160" cy="90" rx="100" ry="18" fill="#F6C878"/>` +
    [0, 1, 2, 3, 4].map(i => `<path d="M${100 + i * 22} 88q8 -6 16 0t16 0" stroke="#FFF1B8" stroke-width="3" fill="none"/>`).join('') +
    `<ellipse cx="130" cy="84" rx="16" ry="10" fill="#fff"/><circle cx="130" cy="84" r="6" fill="#F7B733"/><rect x="170" y="74" width="30" height="16" rx="4" fill="#B5654A"/><path d="M210 70L230 92" stroke="#3F5F2E" stroke-width="6"/>` +
    `<path d="M220 40L150 92M232 44L162 96" stroke="#C99B6A" stroke-width="4" stroke-linecap="round"/>` +
    [120, 160, 200].map(x => `<path d="M${x} 66C${x - 8} 54 ${x + 8} 46 ${x} 34" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>`).join(''),
  tea: u => sky(u, '#E8F2DA', '#F8EDE0') + `<rect x="0" y="130" width="320" height="50" fill="#C9B58F"/>` +
    `<path d="M110 100H210Q206 150 160 150Q114 150 110 100Z" fill="#3E4A3C"/><ellipse cx="160" cy="100" rx="50" ry="10" fill="#7DB35A"/><ellipse cx="160" cy="100" rx="36" ry="6" fill="#9BCB6E"/>` +
    `<g transform="translate(250 112)"><path d="M-14 0H14L10 30H-10Z" fill="#F2EBDD"/>${[-9, -5, -1, 3, 7].map(x => `<path d="M${x} 0L${x + 1} -22" stroke="#D9C59A" stroke-width="1.5"/>`).join('')}</g>` +
    blossom(50, 50, 14, '#FBC8D6') + petals(6, 5),
  matsuri: u => sky(u, '#2B2357', '#7A3B6E') + stars(30, 4) +
    `<path d="M0 50Q160 80 320 50" stroke="#3B2A1F" stroke-width="2" fill="none"/>` +
    [30, 75, 120, 165, 210, 255, 300].map((x, i) => `<g transform="translate(${x} ${58 + Math.sin(i) * 8})"><rect x="-1" y="-6" width="2" height="6" fill="#3B2A1F"/><ellipse rx="13" ry="17" cy="12" fill="${i % 2 ? '#F45B5B' : '#FFB347'}"/><ellipse rx="13" ry="17" cy="12" fill="#fff" opacity=".2"/><rect x="-8" y="-6" width="16" height="4" fill="#3B2A1F"/><rect x="-8" y="27" width="16" height="4" fill="#3B2A1F"/></g>`).join('') +
    hill('M0 150H320V180H0Z', '#3B2A3F') + `<g fill="#FFD27A" opacity=".9">${[60, 140, 220, 280].map(x => `<rect x="${x}" y="128" width="40" height="24" rx="3"/>`).join('')}</g>`,
  shinkansen: u => sky(u, '#BFE2FF', '#EAF6FF') + cloud(60, 40) + cloud(230, 30, .7) +
    `<path d="M240 170L180 80L120 170Z" fill="#7E95C9" opacity=".5"/>` + hill('M0 150H320V180H0Z', '#B5C9A8') + `<rect x="0" y="146" width="320" height="4" fill="#7A7A7A"/>` +
    `<path d="M20 110H220Q290 112 300 140H20Z" fill="#F6F7FA"/><path d="M20 128H290L296 136H20Z" fill="#3A63B8"/><path d="M220 110Q262 112 280 122H240Z" fill="#2A3550"/>` +
    [40, 75, 110, 145, 180].map(x => `<rect x="${x}" y="114" width="22" height="9" rx="3" fill="#2A3550"/>`).join('') + `<path d="M0 100H40M0 92H24" stroke="#fff" stroke-width="3" opacity=".8"/>`,
  sea: u => sky(u, '#8FD0F5', '#E7F7FF') + sun(260, 44, 20, '#FFE27A') + cloud(80, 36) +
    `<path d="M0 100H320V180H0Z" fill="#3FA3D6"/>` + [110, 128, 146].map((y, i) => `<path d="M0 ${y}q20 -8 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0" stroke="#fff" stroke-width="2.5" fill="none" opacity="${.7 - i * .15}"/>`).join('') +
    `<path d="M200 150Q260 140 320 150V180H170Z" fill="#F4DDA8"/><g transform="translate(90 92)"><path d="M0 0L-20 0L-14 10H14L20 0Z" fill="#fff"/><path d="M0 0V-30L18 -4Z" fill="#F6A9C0"/></g>`,
  momiji: u => sky(u, '#FFE6C4', '#FFD0B5') + hill('M0 140Q80 115 160 135T320 125V180H0Z', '#C88A5A') +
    `<path d="M70 180C74 140 66 112 58 92" stroke="#6B4232" stroke-width="7" fill="none"/>` + blossom(60, 80, 30, '#E2573B') + blossom(96, 96, 20, '#F08A3C') +
    (() => { let o = '', s = 13; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280; for (let i = 0; i < 16; i++) { const x = r() * 320, y = r() * 180, c = r() > .5 ? '#E2573B' : '#F2A13B'; o += `<path transform="translate(${x} ${y}) rotate(${r() * 360}) scale(.8)" d="M0-8L2-3L7-4L4 0L7 4L2 3L0 8L-2 3L-7 4L-4 0L-7-4L-2-3Z" fill="${c}"/>`; } return o; })(),
  snow: u => sky(u, '#B8C9E6', '#EEF2FA') + hill('M0 130Q100 100 200 125T320 115V180H0Z', '#FFFFFF') +
    `<g transform="translate(200 120)"><path d="M-40 0V-30H40V0Z" fill="#B35C44"/><path d="M-48-28L0-56L48-28Z" fill="#fff"/><rect x="-10" y="-18" width="14" height="18" fill="#6B4232"/><rect x="14" y="-22" width="14" height="10" fill="#FFE08A"/></g>` +
    `<g transform="translate(80 130)"><circle r="18" cy="0" fill="#fff" stroke="#DDE4F0"/><circle r="12" cy="-26" fill="#fff" stroke="#DDE4F0"/><circle cx="-4" cy="-28" r="1.5" fill="#333"/><circle cx="4" cy="-28" r="1.5" fill="#333"/><path d="M0-25L7-23L0-22Z" fill="#F28D3C"/><rect x="-12" y="-17" width="24" height="4" fill="#D9452F"/></g>` +
    stars(0, 1) + (() => { let o = ''; for (let i = 0; i < 40; i++) o += `<circle cx="${(i * 73) % 320}" cy="${(i * 47) % 170}" r="${1 + i % 3 * .6}" fill="#fff"/>`; return o; })(),
  rain: u => sky(u, '#8FA3BF', '#C9D6E6') + cloud(80, 30, 1.6, '#E8EDF4') + cloud(240, 26, 1.3, '#E8EDF4') +
    (() => { let o = ''; for (let i = 0; i < 36; i++) o += `<path d="M${(i * 37) % 320} ${(i * 29) % 150 + 20}l-4 10" stroke="#fff" stroke-width="1.6" opacity=".7"/>`; return o; })() +
    hill('M0 150H320V180H0Z', '#7FA88A') + `<g transform="translate(160 120)"><path d="M-40 0Q0-40 40 0Z" fill="#F6A9C0"/><path d="M-40 0Q-30-6-20 0Q-10-6 0 0Q10-6 20 0Q30-6 40 0" fill="#F6A9C0"/><path d="M0 0V30Q0 36 6 36" stroke="#5B4B5F" stroke-width="3" fill="none"/></g>` +
    [[60, 160], [250, 158]].map(([x, y]) => `<g transform="translate(${x} ${y})" fill="#A98ACB">${[0, 72, 144, 216, 288].map(r => `<ellipse rx="5" ry="9" transform="rotate(${r}) translate(0 -7)"/>`).join('')}<circle r="4" fill="#F3E3FF"/></g>`).join(''),
  moon: u => sky(u, '#1E2550', '#4A3F7A') + stars(40, 9) + sun(240, 56, 28, '#FFF4C9') + sun(250, 48, 6, '#F2E3A8', .6) +
    hill('M0 140Q90 115 180 135T320 125V180H0Z', '#2C2648') +
    [40, 60, 80, 100].map((x, i) => `<path d="M${x} 150Q${x + 4} ${110 + i * 4} ${x + 10} ${100 + i * 6}" stroke="#D8C9A0" stroke-width="2" fill="none"/>`).join('') +
    `<g transform="translate(170 140)"><path d="M-14 0H14L10 -6H-10Z" fill="#E7DCC4"/>${[[-8, -10], [0, -10], [8, -10], [-4, -17], [4, -17], [0, -24]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#fff"/>`).join('')}</g>`,
  cat: u => sky(u, '#FFE9F1', '#FFF6E6') + `<rect y="130" width="320" height="50" fill="#F3D9C8"/>` +
    `<g transform="translate(160 120)"><ellipse rx="44" ry="32" cy="10" fill="#fff" stroke="#4A3F52" stroke-width="2.5"/><circle r="30" cy="-30" fill="#fff" stroke="#4A3F52" stroke-width="2.5"/><path d="M-26-48L-22-70L-6-56Z M26-48L22-70L6-56Z" fill="#fff" stroke="#4A3F52" stroke-width="2.5" stroke-linejoin="round"/><path d="M-22-52L-20-64L-12-56Z M22-52L20-64L12-56Z" fill="#F6A9C0"/>` +
    `<path d="M-14-32q4 4 8 0M6-32q4 4 8 0" stroke="#4A3F52" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M-3-22q3 3 6 0" stroke="#4A3F52" stroke-width="2" fill="none"/><circle cx="-20" cy="-22" r="5" fill="#F6A9C0" opacity=".6"/><circle cx="20" cy="-22" r="5" fill="#F6A9C0" opacity=".6"/><path d="M40 20Q70 10 60 -20" stroke="#4A3F52" stroke-width="2.5" fill="none"/><circle cx="-14" cy="-50" r="7" fill="#F2A13B"/></g>` +
    `<circle cx="60" cy="150" r="12" fill="#F6A9C0"/><path d="M60 138q10 -10 20 0" stroke="#D9578A" stroke-width="2" fill="none"/>`,
  dog: u => sky(u, '#D8F0FF', '#FFF6E0') + hill('M0 140Q160 120 320 140V180H0Z', '#BFE3A0') + sun(270, 40, 18, '#FFD27A') +
    `<g transform="translate(150 118)"><ellipse rx="40" ry="24" cy="12" fill="#E8B07A"/><circle r="26" cy="-22" cx="-30" fill="#E8B07A"/><path d="M-52-36Q-60-10-46-6Z M-10-38Q0-14-14-8Z" fill="#B97A48"/><ellipse cx="-30" cy="-14" rx="12" ry="9" fill="#FFF1E0"/><circle cx="-30" cy="-18" r="4" fill="#3A2A2A"/><circle cx="-38" cy="-28" r="2.5" fill="#3A2A2A"/><circle cx="-22" cy="-28" r="2.5" fill="#3A2A2A"/><path d="M-30-12v4" stroke="#3A2A2A" stroke-width="2"/><path d="M38 4Q56-8 50-24" stroke="#E8B07A" stroke-width="8" fill="none" stroke-linecap="round"/>${[-24, -4, 16, 30].map(x => `<rect x="${x}" y="26" width="9" height="16" rx="4" fill="#E8B07A"/>`).join('')}<rect x="-48" y="-4" width="34" height="5" rx="2" fill="#D9452F"/></g>` +
    `<circle cx="250" cy="150" r="9" fill="#F45B5B"/>`,
  family: u => sky(u, '#FFE6D6', '#FFF4E8') + hill('M0 145Q160 130 320 145V180H0Z', '#C7E3B0') + sun(60, 40, 16, '#FFD27A') +
    [[110, 1.15, '#3F57A8'], [160, .8, '#F2A13B'], [205, 1.1, '#D9578A']].map(([x, s, c]) => `<g transform="translate(${x} 145) scale(${s})"><path d="M-14 0V-28Q0-40 14-28V0Z" fill="${c}"/><circle cy="-46" r="12" fill="#FFE0CC"/><path d="M-12-50Q0-62 12-50Q8-56 0-57Q-8-56-12-50Z" fill="#4A3F52"/><circle cx="-4" cy="-46" r="1.4" fill="#4A3F52"/><circle cx="4" cy="-46" r="1.4" fill="#4A3F52"/><path d="M-3-41q3 2 6 0" stroke="#4A3F52" stroke-width="1.4" fill="none"/></g>`).join('') +
    `<path d="M150 70c-6-8-18-2-12 8l12 12l12-12c6-10-6-16-12-8z" fill="#F6A9C0"/>`,
  school: u => sky(u, '#CBE7FF', '#FFF0F5') + cloud(260, 36, .8) + hill('M0 150H320V180H0Z', '#C9B48F') +
    `<rect x="70" y="70" width="180" height="80" fill="#F6EFE4"/><rect x="140" y="44" width="40" height="40" fill="#F6EFE4"/><circle cx="160" cy="62" r="11" fill="#fff" stroke="#4A3F52" stroke-width="2"/><path d="M160 62V55M160 62H166" stroke="#4A3F52" stroke-width="2"/>` +
    [0, 1, 2, 3, 4, 5].map(i => `<rect x="${80 + i * 28}" y="${84}" width="18" height="16" fill="#9CC9F2"/><rect x="${80 + i * 28}" y="112" width="18" height="16" fill="#9CC9F2"/>`).join('') + `<rect x="148" y="122" width="24" height="28" fill="#B07A4F"/>` +
    blossom(40, 120, 24) + blossom(285, 118, 22) + petals(12, 21),
  baseball: u => sky(u, '#A8D8FF', '#E9F6FF') + `<path d="M0 120H320V180H0Z" fill="#79B85B"/><path d="M160 180L60 130H260Z" fill="#D9B07A"/><path d="M160 112L200 132L160 152L120 132Z" fill="none" stroke="#fff" stroke-width="2"/>` +
    `<g transform="translate(250 60)"><circle r="16" fill="#fff" stroke="#DDD"/><path d="M-10-12Q-4 0-10 12M10-12Q4 0 10 12" stroke="#D9452F" stroke-width="1.5" fill="none" stroke-dasharray="2 2"/></g><path d="M200 66l-10 2M204 74l-12 4M198 58l-8-2" stroke="#fff" stroke-width="2"/>` +
    `<path d="M70 120L110 70" stroke="#C99B6A" stroke-width="7" stroke-linecap="round"/>`,
  sumo: u => sky(u, '#FFE9C9', '#F5D2A8') + `<path d="M40 140H280L300 180H20Z" fill="#D9C08F"/><ellipse cx="160" cy="150" rx="90" ry="14" fill="none" stroke="#B38B54" stroke-width="4"/>` +
    `<path d="M70 20H250L240 34H80Z" fill="#6B4232"/>${[90, 230].map(x => `<rect x="${x}" y="34" width="5" height="10" fill="#6B4232"/><circle cx="${x + 2}" cy="48" r="6" fill="${x < 160 ? '#3F57A8' : '#D9452F'}"/>`).join('')}` +
    `<g transform="translate(160 118)"><ellipse rx="34" ry="30" fill="#FFD9C2"/><circle cy="-38" r="16" fill="#FFD9C2"/><path d="M-10-52Q0-60 10-52Q0-50-10-52Z" fill="#2A2433"/><circle cx="0" cy="-58" r="5" fill="#2A2433"/><rect x="-34" y="8" width="68" height="14" fill="#3F57A8"/><circle cx="-5" cy="-38" r="1.6" fill="#2A2433"/><circle cx="5" cy="-38" r="1.6" fill="#2A2433"/><path d="M-4-31q4 3 8 0" stroke="#2A2433" stroke-width="1.6" fill="none"/></g>`,
  soccer: u => sky(u, '#B8E0FF', '#EAF7FF') + `<path d="M0 115H320V180H0Z" fill="#6DB35A"/>` + [0, 1, 2, 3].map(i => `<rect x="${i * 80}" y="115" width="40" height="65" fill="#7BC067"/>`).join('') +
    `<rect x="220" y="70" width="80" height="50" fill="none" stroke="#fff" stroke-width="4"/>${[0, 1, 2, 3, 4].map(i => `<path d="M${228 + i * 16} 72V118" stroke="#fff" stroke-width="1" opacity=".6"/>`).join('')}` +
    `<g transform="translate(120 130)"><circle r="18" fill="#fff" stroke="#333" stroke-width="1.5"/><path d="M0-7L7-2L4 6H-4L-7-2Z" fill="#333"/></g><path d="M80 130h-24M84 120h-18M84 140h-18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  run: u => sky(u, '#FFE3C2', '#FFF6E6') + sun(250, 50, 24, '#FFC86B') + hill('M0 140Q160 120 320 140V180H0Z', '#B9DCA0') + `<path d="M0 160H320" stroke="#D9452F" stroke-width="10"/><path d="M0 160H320" stroke="#fff" stroke-width="1.5" stroke-dasharray="20 14"/>` +
    `<g transform="translate(140 100)" stroke="#4A3F52" stroke-width="6" stroke-linecap="round" fill="none"><circle cy="-30" r="11" fill="#FFE0CC" stroke-width="0"/><path d="M0-18L4 14" stroke="#3F57A8" stroke-width="12"/><path d="M2-12L22-2L30-14M2-12L-18-4L-26 6"/><path d="M4 14L24 30L22 50M4 14L-10 34L-28 38"/></g>` +
    `<path d="M70 90h-30M80 104h-40M74 118h-24" stroke="#F6A9C0" stroke-width="3" stroke-linecap="round"/>`,
  book: u => sky(u, '#FFF0F5', '#F3E8FF') + `<rect y="140" width="320" height="40" fill="#E8D5C0"/>` +
    `<g transform="translate(160 118)"><path d="M0 0Q-40-20-90-12V30Q-40 22 0 40Z" fill="#fff" stroke="#C9B6CF" stroke-width="2"/><path d="M0 0Q40-20 90-12V30Q40 22 0 40Z" fill="#fff" stroke="#C9B6CF" stroke-width="2"/>${[0, 1, 2, 3].map(i => `<path d="M-76 ${-2 + i * 8}Q-40 ${-8 + i * 8} -10 ${4 + i * 8}M10 ${4 + i * 8}Q40 ${-8 + i * 8} 76 ${-2 + i * 8}" stroke="#D8CDE0" stroke-width="2" fill="none"/>`).join('')}</g>` +
    `<path d="M240 40l4 10l10 0l-8 6l3 10l-9-6l-9 6l3-10l-8-6l10 0z" fill="#FFD27A"/><path d="M70 50l3 7l7 0l-6 4l2 7l-6-4l-6 4l2-7l-6-4l7 0z" fill="#F6A9C0"/>` + petals(6, 31),
  heart: u => sky(u, '#FFD6E4', '#FFF0E6') + `<path d="M160 150C90 110 80 60 120 50C140 45 155 58 160 70C165 58 180 45 200 50C240 60 230 110 160 150Z" fill="#F2789F"/><path d="M128 66Q138 58 146 66" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>` +
    [[50, 50, .6], [270, 60, .5], [240, 140, .4], [70, 140, .45]].map(([x, y, s]) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 30C-35 10-40-15-20-20C-10-22-2-16 0-10C2-16 10-22 20-20C40-15 35 10 0 30Z" fill="#F9B9CD"/>`).join('') + petals(8, 41),
  laugh: u => sky(u, '#FFF3B8', '#FFE1C9') + `<g transform="translate(160 92)"><circle r="54" fill="#FFD84D"/><path d="M-30-12q8-10 16 0M14-12q8-10 16 0" stroke="#5B3A1A" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M-30 10Q0 46 30 10Z" fill="#7A2E1F"/><path d="M-18 24Q0 36 18 24Q0 30-18 24Z" fill="#F2789F"/><circle cx="-36" cy="8" r="8" fill="#F6A9C0" opacity=".7"/><circle cx="36" cy="8" r="8" fill="#F6A9C0" opacity=".7"/><path d="M-50-6q-8 6-4 16M50-6q8 6 4 16" stroke="#7FC8F0" stroke-width="5" fill="none" stroke-linecap="round"/></g>` +
    [[50, 40, 'ハハ'], [250, 44, 'www'], [262, 150, 'ふふ']].map(([x, y, t]) => `<text x="${x}" y="${y}" font-size="20" font-weight="700" fill="#E0763C" font-family="sans-serif">${t}</text>`).join(''),
  city: u => sky(u, '#2E2A5C', '#E6789B') + stars(20, 17) +
    [[10, 90, 40], [55, 60, 34], [95, 100, 28], [128, 40, 26], [160, 80, 40], [205, 54, 30], [240, 96, 36], [280, 70, 40]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${180 - y}" fill="#3A3360"/>` + Array.from({ length: Math.floor((170 - y) / 14) }, (_, r) => [0, 1].map(c => `<rect x="${x + 6 + c * (w / 2)}" y="${y + 8 + r * 14}" width="${w / 2 - 10}" height="6" fill="#FFD27A" opacity="${(r + c + x) % 3 ? .9 : .2}"/>`).join('')).join('')).join('') +
    `<path d="M140 40L144 0L148 40Z" fill="#F45B5B"/><rect x="138" y="36" width="12" height="6" fill="#F45B5B"/>`,
  temple: u => sky(u, '#FFE3C9', '#F9D2DC') + sun(250, 60, 22, '#FFF0C9') + hill('M0 160Q160 145 320 160V180H0Z', '#9DBF8A') +
    `<g transform="translate(120 0)" fill="#9C3B2B">${[0, 1, 2, 3, 4].map(i => `<rect x="${-14 + i * 2}" y="${150 - i * 24 - 14}" width="${28 - i * 4}" height="14"/><path d="M${-34 + i * 4} ${150 - i * 24 - 12}L0 ${150 - i * 24 - 24}L${34 - i * 4} ${150 - i * 24 - 12}Z" fill="#3B3138"/>`).join('')}<path d="M0 30V10" stroke="#C9A24A" stroke-width="3"/></g>` +
    blossom(220, 140, 20, '#FBC8D6') + blossom(40, 146, 18, '#F7A8C2') + petals(10, 51),
  ricefield: u => sky(u, '#BFE6FF', '#F2FAE6') + sun(260, 40, 18, '#FFE27A') + `<path d="M120 90Q160 60 200 90" fill="#9DBF8A"/>` + hill('M0 90Q100 70 200 90T320 85V180H0Z', '#9DCB6A') +
    [0, 1, 2, 3, 4, 5].map(i => `<path d="M0 ${100 + i * 14}Q160 ${92 + i * 14} 320 ${100 + i * 14}" stroke="#7FB54E" stroke-width="2" fill="none"/>`).join('') +
    `<g transform="translate(90 120)"><path d="M-20 0Q0-26 20 0Z" fill="#E8C877"/><circle cy="10" r="8" fill="#FFE0CC"/><path d="M-6 18H6V40H-6Z" fill="#3F57A8"/></g>`,
  kimono: u => sky(u, '#FFE6EF', '#F2E6FF') + `<g transform="translate(160 100)"><circle cy="-50" r="16" fill="#FFE8DA"/><path d="M-18-56Q0-80 18-56Q14-68 0-70Q-14-68-18-56Z" fill="#2A2433"/><circle cx="12" cy="-66" r="5" fill="#F6A9C0"/>` +
    `<path d="M-20-34L20-34L36 70H-36Z" fill="#D9578A"/><path d="M-20-34L0-14L20-34" fill="none" stroke="#fff" stroke-width="3"/><rect x="-24" y="0" width="48" height="16" fill="#F2C14B"/><path d="M-20-34L-52 20L-30 26L-16-6Z M20-34L52 20L30 26L16-6Z" fill="#E77AA0"/>` +
    [[-20, 40], [12, 50], [-6, 30], [20, 20]].map(([x, y]) => blossom(x, y, 5, '#FFE0EA')).join('') + `</g>` + petals(12, 61)
};
const SCENE_KEYS = Object.keys(SCENES);
