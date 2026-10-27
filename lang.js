'use strict';
/* 韩语、英语入门板块。数据：lang-ko.js / lang-en.js（tools/build_lang.py 从 tools/lang/*.json 生成），第一次打开时加载。
   切换：顶部查词框下面的「日本語 / 한국어 / English」。复习用和日语单词同一套间隔重复（S.srs，id 以 ko| en| 开头）。 */

const TRACKS = {
  ja: { name: '日本語', home: 'home' },
  ko: { name: '한국어', home: 'ko', title: '韩语', tts: 'ko-KR', file: 'lang-ko.js', data: () => typeof LANG_KO !== 'undefined' && LANG_KO },
  en: { name: 'English', home: 'en', title: '英语', tts: 'en-US', file: 'lang-en.js', data: () => typeof LANG_EN !== 'undefined' && LANG_EN }
};
const trackOf = view => view === 'ko' || view === 'en' ? view : 'ja';

// 浏览器朗读（韩语、英语还没有预生成的音频）
function speakLang(text, lang) {
  if (!hasTTS) { toast('这个浏览器不支持朗读'); return; }
  stopSpeech();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; u.rate = S.rate + .1;
  const vs = speechSynthesis.getVoices().filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
  const v = vs.find(v => /natural|online|google|premium|enhanced/i.test(v.name)) || vs.find(v => v.lang.replace('_', '-') === lang) || vs[0];
  if (v) u.voice = v;
  else if (!speakLang.warned) { speakLang.warned = 1; toast(`没有找到${lang.startsWith('ko') ? '韩语' : '英语'}语音，可以在系统设置的「文字转语音」里添加`); }
  speechSynthesis.speak(u);
}
const sayBtn = (text, lang) => `<button class="speak" type="button" data-lsay="${esc(text)}" data-lang="${lang}" aria-label="朗读">${SPEAK_SVG}</button>`;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lsay]');
  if (b) { e.stopPropagation(); speakLang(b.dataset.lsay, b.dataset.lang); }
}, true);

/* ---------- 韩文字母 ---------- */
const HG = {
  vowels: [['ㅏ', 'a', '啊'], ['ㅑ', 'ya', '呀'], ['ㅓ', 'eo', '介于「哦」和「呃」，嘴张大'], ['ㅕ', 'yeo', '哟（嘴张大）'], ['ㅗ', 'o', '哦（嘴唇圆）'], ['ㅛ', 'yo', '哟'], ['ㅜ', 'u', '乌'], ['ㅠ', 'yu', '优'], ['ㅡ', 'eu', '嘴角向两边拉，发「呃」'], ['ㅣ', 'i', '衣']],
  vowels2: [['ㅐ', 'ae', '诶（嘴稍大）'], ['ㅒ', 'yae', '耶'], ['ㅔ', 'e', '诶'], ['ㅖ', 'ye', '耶'], ['ㅘ', 'wa', '哇'], ['ㅙ', 'wae', '歪'], ['ㅚ', 'oe', '威'], ['ㅝ', 'wo', '窝'], ['ㅞ', 'we', '威'], ['ㅟ', 'wi', '喂（短）'], ['ㅢ', 'ui', '「ㅡ」快速滑到「ㅣ」']],
  cons: [['ㄱ', 'g / k', '词首像 k，词中像 g'], ['ㄴ', 'n', 'n'], ['ㄷ', 'd / t', '词首像 t，词中像 d'], ['ㄹ', 'r / l', '词中像 r，收音像 l'], ['ㅁ', 'm', 'm'], ['ㅂ', 'b / p', '词首像 p，词中像 b'], ['ㅅ', 's', 's（在 ㅣ 前像 sh）'], ['ㅇ', '- / ng', '在开头不发音，收音是 ng'], ['ㅈ', 'j', '像「z」和「j」之间'], ['ㅊ', 'ch', '送气，像「c / q」'], ['ㅋ', 'k', '送气 k'], ['ㅌ', 't', '送气 t'], ['ㅍ', 'p', '送气 p'], ['ㅎ', 'h', 'h']],
  tense: [['ㄲ', 'kk', '紧音：喉咙收紧、不送气的 g'], ['ㄸ', 'tt', '紧音 d'], ['ㅃ', 'pp', '紧音 b'], ['ㅆ', 'ss', '紧音 s'], ['ㅉ', 'jj', '紧音 j']],
  batchim: [['각', 'ㄱ ㄲ ㅋ', 'k（不爆破）'], ['간', 'ㄴ', 'n'], ['갇', 'ㄷ ㅅ ㅆ ㅈ ㅊ ㅌ ㅎ', 't（不爆破）'], ['갈', 'ㄹ', 'l'], ['감', 'ㅁ', 'm（闭嘴）'], ['갑', 'ㅂ ㅍ', 'p（闭嘴不爆破）'], ['강', 'ㅇ', 'ng']]
};
const HG_L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', HG_V = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const hgSyl = (l, v, t = 0) => String.fromCharCode(0xAC00 + (HG_L.indexOf(l) * 21 + HG_V.indexOf(v)) * 28 + t);
const HG_ROM = { ㄱ: 'g', ㄲ: 'kk', ㄴ: 'n', ㄷ: 'd', ㄸ: 'tt', ㄹ: 'r', ㅁ: 'm', ㅂ: 'b', ㅃ: 'pp', ㅅ: 's', ㅆ: 'ss', ㅇ: '', ㅈ: 'j', ㅉ: 'jj', ㅊ: 'ch', ㅋ: 'k', ㅌ: 't', ㅍ: 'p', ㅎ: 'h' };
const HG_VROM = { ㅏ: 'a', ㅐ: 'ae', ㅑ: 'ya', ㅒ: 'yae', ㅓ: 'eo', ㅔ: 'e', ㅕ: 'yeo', ㅖ: 'ye', ㅗ: 'o', ㅘ: 'wa', ㅙ: 'wae', ㅚ: 'oe', ㅛ: 'yo', ㅜ: 'u', ㅝ: 'wo', ㅞ: 'we', ㅟ: 'wi', ㅠ: 'yu', ㅡ: 'eu', ㅢ: 'ui', ㅣ: 'i' };
// 单独读字母时，用它和 ㅏ（辅音）或 ㅇ（元音）拼成的音节，朗读引擎才读得出来
const hgSay = j => HG_L.includes(j) ? hgSyl(j, 'ㅏ') : HG_V.includes(j) ? hgSyl('ㅇ', j) : j;

function koHangul() {
  const cell = ([j, rom, tip], say) => `<button type="button" class="hg-cell" data-lsay="${esc(say || hgSay(j))}" data-lang="ko-KR"><b lang="ko">${j}</b><span class="small">${rom}</span><span class="small muted">${esc(tip)}</span></button>`;
  const L = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'.split(''), V = 'ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ'.split('');
  const p = h(`<section class="panel">
    <h2>韩文字母（한글）</h2>
    <p>韩文是拼音文字：每个方块字 = <b>辅音 + 元音</b>（+ 收音）。例如 <b lang="ko">한</b> = ㅎ h + ㅏ a + ㄴ n。记住 40 个字母，就能读出所有韩文。点任何一个格子听发音。</p>
    <h3>基本元音 10 个</h3><div class="hg-grid">${HG.vowels.map(x => cell(x)).join('')}</div>
    <h3>基本辅音 14 个</h3><div class="hg-grid">${HG.cons.map(x => cell(x)).join('')}</div>
    <p class="small muted">ㅋ ㅌ ㅍ ㅊ 是<b>送气音</b>（发音时有一股气冲出来，像汉语拼音的 k t p q）；ㄱ ㄷ ㅂ ㅈ 是<b>平音</b>（气流弱）。</p>
    <h3>紧音 5 个</h3><div class="hg-grid">${HG.tense.map(x => cell(x)).join('')}</div>
    <h3>复合元音 11 个</h3><div class="hg-grid">${HG.vowels2.map(x => cell(x)).join('')}</div>
    <h3>收音（받침）只有 7 种读法</h3><p class="small">写在下面的辅音叫收音。收音很多，但读出来只有 7 种：</p>
    <div class="hg-grid">${HG.batchim.map(([s, js, r]) => cell([s, js, r], s)).join('')}</div>
    <h3>拼读表</h3><p class="small">横着是元音，竖着是辅音，点一下听这个音节。</p>
    <div class="list-wrap"><table class="list hg-table"><thead><tr><th></th>${V.map(v => `<th lang="ko">${v}</th>`).join('')}</tr></thead><tbody>
      ${L.map(l => `<tr><th lang="ko">${l}</th>${V.map(v => { const s = hgSyl(l, v); return `<td><button type="button" class="hg-s" data-lsay="${s}" data-lang="ko-KR" lang="ko">${s}</button></td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div>
    <div class="row" style="margin-top:12px"><button class="btn pri" type="button" data-hgq>字母小测验（10 题）</button></div>
  </section>`);
  p.querySelector('[data-hgq]').onclick = () => {
    const qs = Array.from({ length: 10 }, () => {
      const l = sample(L, 1)[0], v = sample(V.concat('ㅐㅔㅘㅝㅟ'.split('')), 1)[0], s = hgSyl(l, v), rom = HG_ROM[l] + HG_VROM[v];
      const opts = new Set([rom]);
      while (opts.size < 4) { const l2 = sample(L, 1)[0], v2 = sample(V, 1)[0]; opts.add(HG_ROM[l2] + HG_VROM[v2]); }
      const options = shuffle([...opts]);
      return { kind: 'reading', options, answer: options.indexOf(rom), prompt: `<div class="eyebrow">这个字怎么读？</div><div class="q-big" lang="ko">${s}</div>`, explain: `<b lang="ko">${s}</b> = ${l} ${HG_ROM[l] || '（不发音）'} + ${v} ${HG_VROM[v]}`, lsay: s };
    });
    langQuiz(qs, '韩文字母测验', 'ko-KR', () => koHangul());
  };
  return p;
}

/* ---------- 英语：字母和音标 ---------- */
const IPA = {
  vowels: [['iː', 'see', '拉长的「衣」'], ['ɪ', 'sit', '短促的「衣」，嘴放松'], ['e', 'bed', '「哎」的前半'], ['æ', 'cat', '嘴张大的「哎」'], ['ɑː', 'father', '拉长的「啊」'], ['ʌ', 'cup', '短促的「啊」'], ['ɔː', 'law', '拉长的「哦」'], ['ɒ', 'hot', '短「哦」（英式）'], ['ʊ', 'book', '短促的「乌」'], ['uː', 'food', '拉长的「乌」'], ['ɜːr', 'bird', '卷舌的「饿」'], ['ə', 'about', '轻读的「呃」'], ['ər', 'teacher', '轻读并卷舌']],
  diph: [['eɪ', 'day', '「诶」'], ['aɪ', 'my', '「爱」'], ['ɔɪ', 'boy', '「奥一」'], ['aʊ', 'now', '「凹」'], ['oʊ', 'go', '「欧」'], ['ɪr', 'here', '「衣」+卷舌'], ['er', 'hair', '「诶」+卷舌'], ['ʊr', 'tour', '「乌」+卷舌']],
  cons: [['p', 'pen'], ['b', 'bag'], ['t', 'ten'], ['d', 'dog'], ['k', 'key'], ['ɡ', 'go'], ['f', 'fish'], ['v', 'very', '上齿轻咬下唇，声带振动'], ['θ', 'think', '舌尖放在上下齿之间吹气'], ['ð', 'this', '同 θ，声带振动'], ['s', 'see'], ['z', 'zoo'], ['ʃ', 'she', '像「诗」'], ['ʒ', 'vision'], ['h', 'hat'], ['tʃ', 'chair', '像「吃」'], ['dʒ', 'job', '像「知」'], ['m', 'man'], ['n', 'no'], ['ŋ', 'sing', '后鼻音 ng'], ['l', 'leg'], ['r', 'red', '舌头卷起不碰上颚'], ['w', 'we'], ['j', 'yes', '像「耶」的开头']]
};
function enAbc() {
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const cell = ([sym, word, tip]) => `<button type="button" class="hg-cell" data-lsay="${word}" data-lang="en-US"><b>${sym}</b><span class="small">${word}</span>${tip ? `<span class="small muted">${esc(tip)}</span>` : ''}</button>`;
  const p = h(`<section class="panel">
    <h2>字母和音标</h2>
    <h3>26 个字母</h3><div class="hg-grid abc">${ABC.map(c => `<button type="button" class="hg-cell" data-lsay="${c}" data-lang="en-US"><b>${c}${c.toLowerCase()}</b></button>`).join('')}</div>
    <p>英语的拼写和发音不完全对应，所以要借助<b>音标</b>（本站用美式音标）。下面每个音标点一下，会读出例词。</p>
    <h3>单元音</h3><div class="hg-grid">${IPA.vowels.map(cell).join('')}</div>
    <h3>双元音</h3><div class="hg-grid">${IPA.diph.map(cell).join('')}</div>
    <h3>辅音</h3><div class="hg-grid">${IPA.cons.map(cell).join('')}</div>
    <p class="small muted">中国人最容易错的：θ / ð（think、this）不要读成 s / z；v 不要读成 w；词尾的 d、t、k 要轻轻带出来，不要加「呃」。</p>
  </section>`);
  return p;
}

/* ---------- 单词、句子、闪卡、测验 ---------- */
const langItems = (tr, kind) => {
  const d = TRACKS[tr].data(); if (!d) return [];
  const key = kind === 'words' ? 'w' : 'p';
  return (kind === 'words' ? d.words : d.phrases).map(([t, pr, zh, cat]) => ({ id: `${tr}|${key}|${t}`, t, pr, zh, cat }));
};
let langCat = {};
function langList(tr, kind) {
  const T = TRACKS[tr], items = langItems(tr, kind), cats = [...new Set(items.map(x => x.cat))];
  const k = tr + kind; if (!cats.includes(langCat[k])) langCat[k] = cats[0];
  const cur = items.filter(x => x.cat === langCat[k]);
  const known = items.filter(x => S.srs[x.id] && S.srs[x.id].r > 0).length;
  const due = items.filter(x => S.srs[x.id] && S.srs[x.id].due <= Date.now());
  const p = h(`<section class="panel">
    <div class="row between"><h2>${T.title}${kind === 'words' ? '单词' : '常用句'}</h2><span class="small muted">已学 ${known} / ${items.length}</span></div>
    <div class="row"><button class="btn pri" type="button" data-cards>闪卡复习${due.length ? `（到期 ${due.length}）` : ''}</button><button class="btn" type="button" data-quiz>小测验</button></div>
    <p class="small muted">闪卡和 Anki 一样：先想，再翻面，按记得的程度选「重来 / 困难 / 记得 / 简单」，系统按遗忘曲线安排下次复习。</p>
    <div class="chips-row">${cats.map(c => `<button type="button" class="chip-btn ${c === langCat[k] ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)} <span class="small">${items.filter(x => x.cat === c).length}</span></button>`).join('')}</div>
    <div class="list-wrap"><table class="list"><tbody>${cur.map(x => `<tr><td style="width:40px">${sayBtn(x.t, T.tts)}</td><td><b lang="${tr}">${esc(x.t)}</b>${x.pr ? `<div class="small muted">${esc(x.pr)}</div>` : ''}</td><td>${esc(x.zh)}</td><td>${S.srs[x.id] && S.srs[x.id].r > 0 ? '<span class="tag done">已学</span>' : ''}</td></tr>`).join('')}</tbody></table></div>
  </section>`);
  p.querySelectorAll('[data-cat]').forEach(b => { b.onclick = () => { langCat[k] = b.dataset.cat; render(); }; });
  p.querySelector('[data-cards]').onclick = () => {
    const pool = due.length ? due : [...cur.filter(x => !S.srs[x.id]), ...items.filter(x => !S.srs[x.id])];
    const ids = [...new Map(pool.map(x => [x.id, x])).values()].slice(0, 15);
    if (!ids.length) return toast('这一组都学过了，换个分类吧');
    langCards(ids, `${T.title}闪卡`, tr);
  };
  p.querySelector('[data-quiz]').onclick = () => {
    const pool = items.length >= 4 ? items : [];
    const src = cur.length >= 4 ? cur : items;
    const qs = sample(src, Math.min(10, src.length)).map(x => {
      const toZh = Math.random() < .6;
      const opts = [x, ...sample(pool.filter(y => y.cat === x.cat && y.zh !== x.zh && y.t !== x.t), 3)];
      while (opts.length < 4) { const y = sample(pool, 1)[0]; if (!opts.includes(y)) opts.push(y); }
      const options = shuffle(opts.map(y => toZh ? y.zh : y.t));
      return { kind: 'meaning', options, optLang: toZh ? '' : tr, answer: options.indexOf(toZh ? x.zh : x.t), lsay: x.t,
        prompt: toZh ? `<div class="eyebrow">选出中文意思</div><div class="q-big" lang="${tr}">${esc(x.t)}</div>${x.pr ? `<div class="small muted">${esc(x.pr)}</div>` : ''}` : `<div class="eyebrow">用${T.title}怎么说？</div><div class="q-big">${esc(x.zh)}</div>`,
        explain: `<b lang="${tr}">${esc(x.t)}</b> ${x.pr ? `<span class="muted">${esc(x.pr)}</span> ` : ''}= ${esc(x.zh)}` };
    });
    langQuiz(qs, `${T.title}小测验`, T.tts, () => render());
  };
  return p;
}

function langQuiz(qs, title, tts, back) {
  main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
  qs.forEach(q => { if (q.lsay) { q.say = q.lsay; q.sayLang = tts; } });
  runQuiz(host, qs, { title, noRecord: true, xpEach: 5, onDone: r => {
    if (!r) { main.innerHTML = ''; const b = back(); if (b) main.append(b); return; }
    quizSummary(host, r, { title, again: () => langQuiz(qs.map(q => Object.assign({}, q, { options: q.options })), title, tts, back) });
  } });
}

function langCards(items, title, tr) {
  const T = TRACKS[tr];
  let queue = items.slice(), done = 0, revealed = false;
  main.innerHTML = '';
  const box = h(`<section class="panel deck">
    <div class="row between"><h2>${esc(title)}</h2><button class="btn ghost" type="button" data-exit>结束</button></div>
    <div class="progress-top"><span class="small muted" data-left></span><div class="bar"><i data-bar style="width:0"></i></div></div>
    <div data-stage></div></section>`);
  main.append(box);
  const stage = box.querySelector('[data-stage]');
  const finish = () => { keyHandler = null; render(); };
  box.querySelector('[data-exit]').onclick = finish;
  function show() {
    const total = done + queue.length;
    box.querySelector('[data-left]').textContent = `剩余 ${queue.length}`;
    box.querySelector('[data-bar]').style.width = (total ? done / total * 100 : 100) + '%';
    if (!queue.length) {
      stage.innerHTML = `<div class="card" style="cursor:default"><div class="word">完成！</div><p class="meaning">这一组 ${done} 张。到期的卡片会在「闪卡复习」里提醒你。</p></div>
        <div class="row" style="justify-content:center;margin-top:12px"><button class="btn pri" type="button" data-back>返回</button></div>`;
      stage.querySelector('[data-back]').onclick = finish;
      return;
    }
    const x = queue[0], c = S.srs[x.id];
    revealed = false;
    stage.innerHTML = `<div class="card" data-card tabindex="0" role="button">
        <span class="corner tag ${c ? 'learn' : ''}">${c ? '复习' : '新卡'}</span>
        <span class="corner-r">${sayBtn(x.t, T.tts)}</span>
        <div class="word" lang="${tr}">${esc(x.t)}</div>
        <div data-ans hidden>${x.pr ? `<div class="reading">${esc(x.pr)}</div>` : ''}<div class="meaning">${esc(x.zh)}</div></div>
        <div class="hint" data-hint>先想一想意思，再点卡片看答案（空格键）</div></div>
      <div class="grades" data-grades hidden style="margin-top:12px">
        ${['重来', '困难', '记得', '简单'].map((t, g) => `<button class="btn g${g}" type="button" data-g="${g}">${t}<small>${fmtDays(preview(c, g))}</small></button>`).join('')}</div>`;
    const reveal = () => {
      if (revealed) return; revealed = true;
      stage.querySelector('[data-ans]').hidden = false; stage.querySelector('[data-hint]').hidden = true; stage.querySelector('[data-grades]').hidden = false;
      if (S.autoSpeak) speakLang(x.t, T.tts);
    };
    stage.querySelector('[data-card]').onclick = reveal;
    stage.querySelectorAll('[data-g]').forEach(b => { b.onclick = () => rate(+b.dataset.g); });
    keyHandler = e => {
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
      else if (revealed && '1234'.includes(e.key)) rate(+e.key - 1);
    };
  }
  function rate(g) {
    const x = queue.shift();
    grade(x.id, g);
    if (g === 0) queue.splice(Math.min(queue.length, 3), 0, x); else done++;
    addXP(g === 0 ? 2 : 5);
    show();
  }
  show();
}

/* ---------- 分级词库（英语：ECDICT 考试标签；韩语：国立国语院《한국어기초사전》等级） ---------- */
const LV_DATA = {};      // 'en' → [[key, 名称, 词数]]；'en-cet4' → [[词, 发音, 中文]]
const lvFetch = name => LV_DATA[name] ? Promise.resolve(LV_DATA[name])
  : fetch(`lang/${name}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => (LV_DATA[name] = d));
let lvSel = {}, lvQuery = {}, lvShown = 100;
function langLevels(tr) {
  const T = TRACKS[tr];
  const p = h(`<section class="panel"><h2>${T.title}分级词库</h2><p class="muted">加载中……</p></section>`);
  main.append(p);
  lvFetch(`${tr}-levels`).then(meta => {
    const cur = lvSel[tr] && meta.some(m => m[0] === lvSel[tr]) ? lvSel[tr] : meta[0][0];
    lvSel[tr] = cur;
    return lvFetch(`${tr}-${cur}`).then(rows => ({ meta, cur, rows }));
  }).then(({ meta, cur, rows }) => {
    if (!p.isConnected) return;
    const items = rows.map(([t, pr, zh]) => ({ id: `${tr}|L|${cur}|${t}|${pr}`, t, pr, zh }));
    const q = (lvQuery[tr] || '').trim().toLowerCase();
    const list = q ? items.filter(x => x.t.toLowerCase().includes(q) || x.zh.includes(q)) : items;
    const known = items.filter(x => S.srs[x.id] && S.srs[x.id].r > 0).length;
    const due = items.filter(x => S.srs[x.id] && S.srs[x.id].due <= Date.now());
    const name = meta.find(m => m[0] === cur)[1];
    p.innerHTML = `<div class="row between"><h2>${T.title}分级词库</h2><span class="small muted">${esc(name)}：已学 ${known} / ${items.length}</span></div>
      <div class="chips-row">${meta.map(([k, n, c]) => `<button type="button" class="chip-btn ${k === cur ? 'on' : ''}" data-lv="${k}">${esc(n)} <span class="small">${c}</span></button>`).join('')}</div>
      <p class="small muted">${tr === 'en' ? '按中国的英语考试分级：每个词只放在它第一次出现的级别（例如四级里只有四级新增、高考没有的词），同一级里常用词在前。' : '按国立国语院《韩国语基础词典》的等级：初级≈TOPIK 1–2 级，中级≈3–4 级，高级≈5–6 级。括号里是汉字词的汉字，学过汉语的人一看就懂。'}</p>
      <div class="row"><button class="btn pri" type="button" data-cards>闪卡：${due.length ? `复习 ${due.length} + ` : ''}新词 15</button><button class="btn" type="button" data-quiz>小测验 10 题</button></div>
      <input type="search" class="lv-q" placeholder="在这一级里查找：${tr === 'en' ? '英文' : '韩语'} / 中文" value="${esc(lvQuery[tr] || '')}">
      <div class="list-wrap"><table class="list"><tbody>${list.slice(0, lvShown).map(x => `<tr><td style="width:40px">${sayBtn(x.t, T.tts)}</td><td><b lang="${tr}">${esc(x.t)}</b>${x.pr ? `<div class="small muted">${tr === 'ko' ? '汉字 ' : ''}${esc(x.pr)}</div>` : ''}</td><td>${esc(x.zh)}</td><td>${S.srs[x.id] && S.srs[x.id].r > 0 ? '<span class="tag done">已学</span>' : ''}</td></tr>`).join('')}</tbody></table></div>
      ${list.length > lvShown ? `<div class="row" style="justify-content:center"><button class="btn" type="button" data-more>再显示 100 个（共 ${list.length}）</button></div>` : ''}
      <p class="small muted">${tr === 'en' ? '词表和中文释义来自 <a href="https://github.com/skywind3000/ECDICT" target="_blank" rel="noopener">ECDICT</a>（MIT 许可）。' : '词表、汉字和等级来自国立国语院《<a href="https://krdict.korean.go.kr" target="_blank" rel="noopener">한국어기초사전</a>》（CC BY-SA 2.0 KR），中文释义为本站编写，同样以 CC BY-SA 2.0 KR 发布。'}</p>`;
    p.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => { lvSel[tr] = b.dataset.lv; lvShown = 100; render(); }; });
    const qi = p.querySelector('.lv-q');
    let tm; qi.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { lvQuery[tr] = qi.value; lvShown = 100; render(); setTimeout(() => { const n = document.querySelector('.lv-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 0); }, 300); };
    const more = p.querySelector('[data-more]'); if (more) more.onclick = () => { lvShown += 100; render(); };
    p.querySelector('[data-cards]').onclick = () => {
      const fresh = items.filter(x => !S.srs[x.id]).slice(0, 15);
      const deck = [...due.slice(0, 50), ...fresh];
      if (!deck.length) return toast('这一级全部学完了！');
      langCards(deck, `${name} 闪卡`, tr);
    };
    p.querySelector('[data-quiz]').onclick = () => {
      const studied = items.filter(x => S.srs[x.id]);
      const src = studied.length >= 10 ? studied : items.slice(0, Math.max(40, studied.length));
      const qs = sample(src, 10).map(x => {
        const opts = [x.zh, ...sample(items.filter(y => y.zh !== x.zh), 3).map(y => y.zh)];
        const options = shuffle(opts);
        return { kind: 'meaning', options, answer: options.indexOf(x.zh), lsay: x.t,
          prompt: `<div class="eyebrow">选出中文意思</div><div class="q-big" lang="${tr}">${esc(x.t)}</div>${x.pr ? `<div class="small muted">${esc(x.pr)}</div>` : ''}`,
          explain: `<b lang="${tr}">${esc(x.t)}</b> = ${esc(x.zh)}` };
      });
      langQuiz(qs, `${name} 测验`, T.tts, () => { render(); });
    };
  }).catch(() => { if (p.isConnected) p.innerHTML = '<h2>分级词库</h2><p>加载失败：这部分词库可能还在准备中，或者网络有问题，请稍后再试。</p>'; });
}

/* ---------- 页面 ---------- */
let langLoading = {};
function langReady(tr) {
  if (TRACKS[tr].data()) return true;
  main.append(h('<section class="panel"><p class="muted">正在加载……</p></section>'));
  if (!langLoading[tr]) {
    langLoading[tr] = true;
    const s = document.createElement('script');
    s.src = TRACKS[tr].file;
    s.onload = () => { if (trackOf((location.hash || '').slice(1).split('/')[0]) === tr) render(); };
    s.onerror = () => { langLoading[tr] = false; toast('加载失败，请检查网络'); };
    document.body.append(s);
  }
  return false;
}
function viewLangTrack(tr, sub) {
  if (S.track !== tr) { S.track = tr; save(); }
  if (sub === 'abc') return main.append(tr === 'ko' ? koHangul() : enAbc());
  if (sub === 'levels') return langLevels(tr);
  if (!langReady(tr)) return;
  if (sub === 'words' || sub === 'phrases') return main.append(langList(tr, sub));
  // 首页
  const T = TRACKS[tr], words = langItems(tr, 'words'), phrases = langItems(tr, 'phrases');
  const known = [...words, ...phrases].filter(x => S.srs[x.id] && S.srs[x.id].r > 0).length;
  const due = [...words, ...phrases].filter(x => S.srs[x.id] && S.srs[x.id].due <= Date.now());
  const p = h(`<section class="panel">
    <h2>${T.title}入门 · ${T.name}</h2>
    <p>${tr === 'ko' ? '韩语和日语语法很像（主宾谓语序、助词、敬语），又有大量和汉语相近的汉字词——学过日语的人学韩语特别快。先花一两天学会韩文字母，就能自己读出所有单词。' : '从字母和音标开始，掌握最常用的 500 个单词和 150 句日常会话，够应付旅行、点餐、问路和简单聊天。'}</p>
    <div class="stat-row"><div><b>${known}</b><span class="small muted">已学</span></div><div><b>${due.length}</b><span class="small muted">今天要复习</span></div><div><b>${words.length + phrases.length}</b><span class="small muted">全部</span></div></div>
    ${due.length ? `<div class="row"><button class="btn pri" type="button" data-due>复习到期的 ${due.length} 张卡</button></div>` : ''}
    <div class="lang-menu">
      <a class="lang-tile" href="#${tr}/abc"><b>${tr === 'ko' ? '한글 字母' : 'Aa 字母音标'}</b><span class="small muted">${tr === 'ko' ? '40 个字母 + 拼读表 + 测验' : '26 个字母 + 美式音标'}</span></a>
      <a class="lang-tile" href="#${tr}/words"><b>单词 ${words.length}</b><span class="small muted">按主题分类，闪卡 + 测验</span></a>
      <a class="lang-tile" href="#${tr}/phrases"><b>常用句 ${phrases.length}</b><span class="small muted">按场景分类，点击朗读</span></a>
      <a class="lang-tile" href="#${tr}/levels"><b>${tr === 'ko' ? '分级词库 TOPIK' : '分级词库 中考→GRE'}</b><span class="small muted">${tr === 'ko' ? '初级 / 中级 / 高级，约 1.1 万词' : '中考、高考、四六级、考研、雅思、托福、GRE，约 1.5 万词'}</span></a>
    </div>
    <p class="small muted">发音使用手机或浏览器自带的${T.title}语音；没有声音的话，在系统设置的「文字转语音」里添加${T.title}。</p>
  </section>`);
  const b = p.querySelector('[data-due]'); if (b) b.onclick = () => langCards(due.slice(0, 30), `${T.title}复习`, tr);
  main.append(p);
}
const viewKo = sub => viewLangTrack('ko', sub);
const viewEn = sub => viewLangTrack('en', sub);

// 顶部「日本語 / 한국어 / English」切换；导航栏只显示当前语言的栏目
function initTrackSwitch() {
  const form = document.querySelector('.gsearch'); if (!form) return;
  const seg = h(`<div class="track-seg" role="group" aria-label="学习的语言">${Object.entries(TRACKS).map(([k, t]) => `<button type="button" data-track="${k}">${t.name}</button>`).join('')}</div>`);
  form.after(seg);
  seg.querySelectorAll('[data-track]').forEach(b => {
    b.onclick = () => { const tr = b.dataset.track; S.track = tr; save(); location.hash = TRACKS[tr].home; };
  });
}
function applyTrack(view) {
  const tr = trackOf(view);
  document.body.dataset.track = tr;
  document.querySelectorAll('.track-seg [data-track]').forEach(b => b.classList.toggle('on', b.dataset.track === tr));
  const input = document.getElementById('gs-q');
  if (input) input.placeholder = tr === 'ja' ? '查词：日语 / 假名 / 中文 / 英文' : `查${TRACKS[tr].title}：${TRACKS[tr].title} / 中文`;
  const h0 = location.hash || '#home';
  document.querySelectorAll('.tabs a[data-trk]').forEach(a => a.classList.toggle('on', a.getAttribute('href') === h0 || (h0 === '#' + tr && a.getAttribute('href') === '#' + tr)));
}
// 查词框在韩语、英语模式下搜这门语言的单词和句子
function langSearch(q, drop) {
  const tr = document.body.dataset.track;
  if (!TRACKS[tr] || tr === 'ja') return false;
  if (!TRACKS[tr].data()) { drop.innerHTML = '<div class="small muted" style="padding:10px">先打开一次这个语言的页面，加载词表</div>'; drop.hidden = false; return true; }
  const ql = q.toLowerCase();
  const hits = [...langItems(tr, 'words'), ...langItems(tr, 'phrases')].filter(x => x.t.toLowerCase().includes(ql) || x.zh.includes(q) || (x.pr && x.pr.toLowerCase().includes(ql))).slice(0, 8);
  drop.innerHTML = hits.map(x => `<div class="gs-item"><span class="gs-w" lang="${tr}">${esc(x.t)}</span><span class="gs-r">${esc(x.pr || '')}</span><span class="gs-m">${esc(x.zh)}</span>${sayBtn(x.t, TRACKS[tr].tts)}</div>`).join('') || '<div class="small muted" style="padding:10px">没有找到</div>';
  drop.hidden = false;
  return true;
}
// 点当前所在的栏目（例如闪卡做到一半点「单词」）也要回到列表
document.addEventListener('click', e => {
  const a = e.target.closest('.tabs a[data-trk]');
  if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); render(); }
});
