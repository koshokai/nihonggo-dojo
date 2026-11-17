'use strict';
/* 学习语言的切换（日本語 / 中国語 / English）、各语言共用的朗读、首页公共部分。
   下面 viewLangTrack / lang2.js 是旧版「英语板块」的通用框架（现在的英语在 en.js，中文在 zh.js），已经没有入口。 */

const TRACKS = {
  ja: { name: '日本語', home: 'home' },
  // 英语板块已下线（节省空间留给情景课程）；数据和生成脚本留在 tools/ 里，以后要恢复可以重新生成
  // 中国語：面向日本用户学中文，界面全部日语（i18n.js 的 tj()），内容见 zh.js
  zh: { name: '中国語', home: 'zh', title: '中国語', tts: 'zh-CN', data: () => true },
  // 英语（en.js）：给中文和日语母语者，A1–C1，中日双语释义
  en: { name: 'English', home: 'en', title: 'English', tts: 'en-US', data: () => true }
};
// 「我的」这类公共页面不属于某一门语言：留在当前正在学的语言里（导航栏不跳回日语）
const TRACK_NEUTRAL = ['hi', 'check', 'diag', 'path', 'me', 'welcome', 'about', 'buddy', 'duel', 'commute', 'reader', 'fav', 'offline', 'calendar', 'vip'];   // 伙伴、对战也是公共页面（学中文的日本用户也用）
const trackOf = view => view === 'zh' || view === 'en' ? view : TRACK_NEUTRAL.includes(view) ? (S.track || 'ja') : 'ja';

// MeloTTS 预生成的音频（audio/index-ko.json、index-en.json：朗读文本 → mp3），没有的再用浏览器朗读
const LANG_AUDIO = {};
// 单词优先用真人录音（audio/index-<语言>-human.json，来自 Wikimedia Commons），其次是合成音
const jsonOr = url => fetch(url).then(r => r.ok ? r.json() : {}).catch(() => ({}));
const LANG_IDX_READY = {};   // 已经加载好的录音目录（同步可用）
// 词典里级别词表以外的词：录音在 nihonggo-dojo-audio2（index-dict-<语言>.json）
const langAudioIdx = code => LANG_AUDIO[code] || (LANG_AUDIO[code] = Promise.all([jsonOr(`${audIdxBase(code)}index-${code}.json`), jsonOr(`${audIdxBase(code)}index-${code}-human.json`), code === 'zh' || code === 'en' ? jsonOr(`${AUD2}index-dict-${code}.json`) : {}, code === 'zh' ? jsonOr(`${AUD_EN}index-zh2.json`) : {}])
  .then(([tts, human, dict, more]) => (LANG_IDX_READY[code] = Object.assign({}, dict, more, tts, human))));   // more：音频仓库里新增的中文录音（zh2/）
// 中文、英语的录音共用一个播放器：iPhone 只允许「点击当下」开始播放，
// 同一个播放器被点击解锁过一次以后，之后换录音再播放（例如测验每题自动播放）就不会被拦。
let langAudioEl = null, langSeq = 0;
// 0.05 秒的静音 WAV：用来在点击当下解锁播放器
const SILENT_WAV = (() => { const n = 400, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, t) => [...t].forEach((c, i) => b[o + i] = c.charCodeAt(0));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
  return 'data:audio/wav;base64,' + btoa(String.fromCharCode(...b)); })();
const langPlayer = () => langAudioEl || (langAudioEl = new Audio());
// 要先等网络（会员录音的临时地址）再播放时：点击当下先用静音把播放器「解锁」（iPhone 只允许点击当下开始播放）
const langUnlock = () => { const el = langPlayer(); if (!el.paused || typeof SILENT_WAV === 'undefined') return; el.onended = el.onerror = null; el.src = SILENT_WAV; el.play().catch(() => {}); };
// rate：这一次的语速（例如听写的「慢速」）；不传就用设置里的语速
function speakLang(text, lang, rate) {
  const code = lang.slice(0, 2), rt = rate || S.rate;
  stopSpeech();
  const el = langPlayer(); el.pause();
  const idx = LANG_IDX_READY[code];
  // 录音目录还没加载好（刚打开 App 时）：点击当下先用一段静音「解锁」播放器（iPhone 只允许点击当下开始播放），
  // 等目录加载好再放录音
  if (!idx) {
    const seq = ++langSeq;
    el.src = SILENT_WAV; el.play().catch(() => {});
    let done = false;
    const give = setTimeout(() => { if (!done && seq === langSeq) { done = true; speakLangTTS(text, lang, rt); } }, 4000);
    langAudioIdx(code).then(() => { if (done || seq !== langSeq) return; done = true; clearTimeout(give); speakLang(text, lang, rate); });
    return;
  }
  ++langSeq;
  const file = idx[text];
  if (!file) {
    // 会员内容的录音在私有存储里：取临时地址再放（同一个播放器之前被点击解锁过，异步播放也不会被拦）
    if (typeof memberTextAudio === 'function' && (code === 'zh' || code === 'en') && isMember(code)) {
      langUnlock();
      memberTextAudio(code, text).then(u => { if (!u) return speakLangTTS(text, lang, rt); el.src = u; el.defaultPlaybackRate = el.playbackRate = Math.min(1.3, Math.max(.5, rt + .2)); el.play().catch(() => speakLangTTS(text, lang, rt)); }).catch(() => speakLangTTS(text, lang, rt));
      return;
    }
    return speakLangTTS(text, lang, rt);
  }
  el.src = audUrl(file);
  el.defaultPlaybackRate = el.playbackRate = Math.min(1.3, Math.max(.5, rt + .2));
  el.play().catch(() => speakLangTTS(text, lang, rt));
}
// 以前没有录音时用手机朗读；现在只放生成的人声
function speakLangTTS() { noVoice(); }
const sayBtn = (text, lang) => `<button class="speak" type="button" data-lsay="${esc(text)}" data-lang="${lang}" aria-label="${tj('朗读', '読み上げ')}">${SPEAK_SVG}</button>`;
const exSayBtn = (text, lang) => sayBtn(text, lang).replace('<button ', '<button data-exq ');   // 例句：有每日额度
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lsay]');
  if (!b) return;
  e.stopPropagation();
  if (typeof b._say === 'function' && b._say()) return;   // 页面自己接管了这个按钮（例如读物里的「くり返し再生」）
  if (b.hasAttribute('data-exq') && typeof exAudioOK === 'function') { exAudioOK(b.dataset.lang + '|' + b.dataset.lsay).then(ok => { if (ok) speakLang(b.dataset.lsay, b.dataset.lang); }); return; }
  speakLang(b.dataset.lsay, b.dataset.lang);
}, true);

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
    <div class="row between"><h2>${T.title}${kind === 'words' ? '单词' : '常用句'}</h2><span class="small muted">已学 ${known}</span></div>
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
      return { kind: 'meaning', options, optLang: toZh ? '' : tr, answer: options.indexOf(toZh ? x.zh : x.t), lsay: x.t, item: x,
        prompt: toZh ? `<div class="eyebrow">选出中文意思</div><div class="q-big" lang="${tr}">${esc(x.t)}</div>${x.pr ? `<div class="small muted">${esc(x.pr)}</div>` : ''}` : `<div class="eyebrow">用${T.title}怎么说？</div><div class="q-big">${esc(x.zh)}</div>`,
        explain: `<b lang="${tr}">${esc(x.t)}</b> ${x.pr ? `<span class="muted">${esc(x.pr)}</span> ` : ''}= ${esc(x.zh)}` };
    });
    langQuiz(qs, `${T.title}小测验`, T.tts, () => render());
  };
  return p;
}

// 韩语、英语闪卡：入门单词和常用句以外的卡（分级词库、阅读生词、做错的题）把内容记在 S.l2cards，首页复习时用
function l2AddCard(tr, x, dueNow) {
  S.l2cards = S.l2cards || {};
  if (!x.id.includes('|w|') && !x.id.includes('|p|')) S.l2cards[x.id] = Object.assign({ tr, t: x.t, pr: x.pr || '', zh: x.zh }, x.ex ? { ex: x.ex.slice(0, 2) } : {});
  if (dueNow || !S.srs[x.id]) S.srs[x.id] = Object.assign({ i: 0, e: 2.5, r: 0 }, S.srs[x.id], { due: Date.now() });
}
const l2AllCards = tr => [...langItems(tr, 'words'), ...langItems(tr, 'phrases'),
  ...Object.entries(S.l2cards || {}).filter(([, c]) => c.tr === tr).map(([id, c]) => ({ id, t: c.t, pr: c.pr, zh: c.zh, ex: c.ex }))];
function langQuiz(qs, title, tts, back) {
  main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
  qs.forEach(q => { if (q.lsay) { q.say = q.lsay; q.sayLang = tts; } });
  runQuiz(host, qs, { title, noRecord: true, xpEach: 5, onDone: r => {
    if (!r) { main.innerHTML = ''; const b = back(); if (b) main.append(b); return; }
    // 答错的词进闪卡，今天就复习
    const tr = tts.slice(0, 2);
    r.res.forEach(x => { if (!x.ok && x.q.item) l2AddCard(tr, x.q.item, true); });
    save();
    quizSummary(host, r, { title, again: () => langQuiz(qs.map(q => Object.assign({}, q, { options: q.options })), title, tts, back) });
  } });
}

function langCards(items, title, tr) {
  const T = TRACKS[tr];
  let queue = items.slice(), done = 0, revealed = false;
  main.innerHTML = '';
  const box = h(`<section class="panel deck">
    <div class="row between"><h2>${esc(title)}</h2><button class="btn ghost" type="button" data-exit>${tj('结束', '終了')}</button></div>
    <div class="progress-top"><span class="small muted" data-left></span><div class="bar"><i data-bar style="width:0"></i></div></div>
    <div data-stage></div></section>`);
  main.append(box);
  const stage = box.querySelector('[data-stage]');
  focusMode(true);
  const finish = () => { keyHandler = null; focusMode(false); render(); };
  box.querySelector('[data-exit]').onclick = finish;
  function show() {
    const total = done + queue.length;
    box.querySelector('[data-left]').textContent = tj(`剩余 ${queue.length}`, `残り ${queue.length}`);
    box.querySelector('[data-bar]').style.width = (total ? done / total * 100 : 100) + '%';
    if (!queue.length) {
      stage.innerHTML = `<div class="card" style="cursor:default"><div class="word">${tj('完成！', 'おつかれさま！')}</div><p class="meaning">${tj(`这一组 ${done} 张。到期的卡片会在「闪卡复习」里提醒你。`, `${done} 枚クリア。復習のタイミングが来たら「今日」のタスクでお知らせします。`)}</p></div>
        <div class="row" style="justify-content:center;margin-top:12px"><button class="btn pri" type="button" data-back>${tj('返回', '戻る')}</button></div>`;
      stage.querySelector('[data-back]').onclick = finish;
      return;
    }
    const x = queue[0], c = S.srs[x.id];
    revealed = false;
    stage.innerHTML = `<div class="card" data-card tabindex="0" role="button">
        <span class="corner tag ${c ? 'learn' : ''}">${c ? tj('复习', '復習') : tj('新卡', '新しい')}</span>
        <span class="corner-r">${sayBtn(x.t, T.tts)}</span>
        <div class="word" lang="${tr === 'zh' ? 'zh-CN' : tr}">${esc(x.t)}</div>
        <div data-ans hidden>${x.pr ? `<div class="reading">${esc(x.pr)}</div>` : ''}<div class="meaning">${esc(x.zh)}</div>${x.ex ? `<div class="small card-ex"><span lang="${tr === 'zh' ? 'zh-CN' : tr}">${tr === 'zh' ? zhTap(x.ex[0]) : tr === 'en' ? enTap(x.ex[0]) : esc(x.ex[0])}</span>${x.ex[2] ? `<br><span class="muted zh-py">${esc(x.ex[2])}</span>` : ''}<br><span class="muted">${esc(x.ex[1])}</span></div>` : ''}${x.note ? `<div class="small zh-note">${esc(x.note)}</div>` : ''}</div>
        <div class="hint" data-hint>${tj('先想一想意思，再点卡片看答案（空格键）', '意味を思い浮かべてから、カードをタップして答えを確認（スペースキー）')}</div></div>
      <div class="grades" data-grades hidden style="margin-top:12px">
        ${(uiJa() ? ['もう一度', '難しい', '覚えた', '簡単'] : ['重来', '困难', '记得', '简单']).map((t, g) => `<button class="btn g${g}" type="button" data-g="${g}">${t}<small>${fmtDays(preview(c, g))}</small></button>`).join('')}</div>`;
    const reveal = () => {
      if (revealed) return; revealed = true; fxFlip(stage.querySelector('[data-card]'));
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
    fxCardOut(stage, g === 0 ? -1 : 1);
    if (tr !== 'zh') l2AddCard(tr, x);
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
  const p = h(`<section class="panel"><h2>${T.title}分级词库</h2><div class="skel" aria-label="加载中" role="status"><i></i><i></i><i></i></div></section>`);
  main.append(p);
  lvFetch(`${tr}-levels`).then(meta => {
    const cur = lvSel[tr] && meta.some(m => m[0] === lvSel[tr]) ? lvSel[tr] : meta[0][0];
    lvSel[tr] = cur;
    // 例句（英语来自 Tatoeba，韩语来自《한국어기초사전》）：没有例句文件时照常显示
    return Promise.all([lvFetch(`${tr}-${cur}`), lvFetch(`${tr}-ex-${cur}`).catch(() => ({}))]).then(([rows, ex]) => ({ meta, cur, rows, ex }));
  }).then(({ meta, cur, rows, ex }) => {
    if (!p.isConnected) return;
    const items = rows.map(([t, pr, zh]) => ({ id: `${tr}|L|${cur}|${t}|${pr}`, t, pr, zh, ex: (ex[t] || [])[0] }));
    const q = (lvQuery[tr] || '').trim().toLowerCase();
    const list = q ? items.filter(x => x.t.toLowerCase().includes(q) || x.zh.includes(q)) : items;
    const known = items.filter(x => S.srs[x.id] && S.srs[x.id].r > 0).length;
    const due = items.filter(x => S.srs[x.id] && S.srs[x.id].due <= Date.now());
    const name = meta.find(m => m[0] === cur)[1];
    const masteredN = items.filter(x => S.srs[x.id] && mastered(Object.assign({ id: x.id }, x))).length;
    // 和日语「单词」页同样的排版：级别 → 四格统计 → 背单词 / 测验
    p.innerHTML = `<div class="row between"><h2>${T.title}分级词库 · ${esc(name)}</h2></div>
      <div class="seg read-lv" role="group" aria-label="级别">${meta.map(([k, n, c]) => `<button type="button" data-lv="${k}" class="${k === cur ? 'on' : ''}">${esc(n)}<span class="lv-n">${c}</span></button>`).join('')}</div>
      <div class="stats">
        <div class="stat"><span class="small muted">本级单词</span><b>${items.length}</b></div>
        <div class="stat"><span class="small muted">学过</span><b>${known}</b></div>
        <div class="stat"><span class="small muted">已掌握</span><b>${masteredN}</b></div>
        <div class="stat"><span class="small muted">待复习</span><b>${due.length}</b></div>
      </div>
      <p class="small muted">${tr === 'en' ? '按中国的英语考试分级：每个词只放在它第一次出现的级别（例如四级里只有四级新增、高考没有的词），同一级里常用词在前。' : '按国立国语院《韩国语基础词典》的等级：初级≈TOPIK 1–2 级，中级≈3–4 级，高级≈5–6 级。单词下面标出了汉字词对应的汉字（繁体），学过汉语的人一看就懂。'}</p>
      <div class="row"><button class="btn pri" type="button" data-cards>背单词（复习 ${Math.min(due.length, 50)} + 新词 15）</button><button class="btn" type="button" data-quiz>单词测验 10 题</button></div>
      <input type="search" class="lv-q" placeholder="在这一级里查找：${tr === 'en' ? '英文' : '韩语'} / 中文" value="${esc(lvQuery[tr] || '')}">
      <div class="list-wrap"><table class="list"><tbody>${list.slice(0, lvShown).map(x => `<tr><td style="width:40px">${sayBtn(x.t, T.tts)}</td><td><b lang="${tr}">${esc(x.t)}</b>${x.pr ? `<div class="small muted">${tr === 'ko' ? '汉字 ' : ''}${esc(x.pr)}</div>` : ''}</td><td>${esc(x.zh)}${x.ex ? `<div class="small lv-ex"><span lang="${tr}">${tr === 'zh' ? zhTap(x.ex[0]) : tr === 'en' ? enTap(x.ex[0]) : esc(x.ex[0])}</span> ${exSayBtn(x.ex[0], T.tts)}<br><span class="muted">${esc(x.ex[1])}</span></div>` : ''}</td><td>${S.srs[x.id] && S.srs[x.id].r > 0 ? '<span class="tag done">已学</span>' : ''}</td></tr>`).join('')}</tbody></table></div>
      ${list.length > lvShown ? `<div class="row" style="justify-content:center"><button class="btn" type="button" data-more>显示更多</button></div>` : ''}
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
        return { kind: 'meaning', options, answer: options.indexOf(x.zh), lsay: x.t, item: x,
          prompt: `<div class="eyebrow">选出中文意思</div><div class="q-big" lang="${tr}">${esc(x.t)}</div>${x.pr ? `<div class="small muted">${esc(x.pr)}</div>` : ''}`,
          explain: `<b lang="${tr}">${esc(x.t)}</b> = ${esc(x.zh)}` };
      });
      langQuiz(qs, `${name} 测验`, T.tts, () => { render(); });
    };
  }).catch(() => { if (p.isConnected) p.innerHTML = '<h2>分级词库</h2><p>加载失败：这部分词库可能还在准备中，或者网络有问题，请稍后再试。</p>'; });
}

/* ---------- 模拟考：TOPIK / 四六级（排版和日语模拟考一致） ---------- */
const LEXAM = {
  ko: {
    levels: [['topik1', 'TOPIK I'], ['topik2', 'TOPIK II']],
    types: { 어휘: ['어휘·문법', '（　）에 들어갈 가장 알맞은 것을 고르십시오.'], 유의: ['비슷한 의미', '밑줄 친 부분과 의미가 비슷한 것을 고르십시오.'], 주제: ['주제·중심 생각', '무엇에 대한 내용입니까? / 중심 생각을 고르십시오.'],
      일치: ['내용 일치', '다음 글의 내용과 같은 것을 고르십시오.'], 순서: ['순서 배열', '다음을 순서대로 맞게 배열한 것을 고르십시오.'], 제목: ['신문 기사 제목', '다음 신문 기사의 제목을 가장 잘 설명한 것을 고르십시오.'], 독해: ['독해', '다음을 읽고 물음에 답하십시오.'] },
    plan: { topik1: [['어휘', 7], ['유의', 3], ['주제', 3], ['일치', 5], ['순서', 2], ['독해', 5]], topik2: [['어휘', 5], ['유의', 3], ['제목', 3], ['일치', 4], ['주제', 4], ['순서', 2], ['독해', 6]] },
    min: { topik1: 40, topik2: 50 },
    intro: '按 TOPIK 阅读试卷的题型出题：词汇语法 → 近义替换 → 主题 → 内容一致 → 排序 → 阅读理解。约 25 题，限时作答，交卷后统一批改，正确率 60% 以上盖「合格」章。'
  },
  en: {
    levels: [['cet4', '四级 CET-4'], ['cet6', '六级 CET-6']],
    types: { 词汇: ['词汇', '选出最适合填入空白处的词。'], 语法: ['语法结构', '选出语法正确的一项。'], 翻译: ['汉译英', '选出最准确、地道的英文翻译。'], 匹配: ['段落匹配', '这句话的信息出自哪一段？'], 阅读: ['仔细阅读', '阅读短文，回答问题。'] },
    plan: { cet4: [['词汇', 7], ['语法', 5], ['翻译', 4], ['匹配', 4], ['阅读', 10]], cet6: [['词汇', 7], ['语法', 5], ['翻译', 4], ['匹配', 4], ['阅读', 10]] },
    min: { cet4: 40, cet6: 45 },
    intro: '按大学英语四六级的题型出题：词汇 → 语法 → 汉译英 → 段落信息匹配 → 仔细阅读。30 题，限时作答，交卷后统一批改，正确率 60% 以上盖「合格」章。'
  }
};
let lexamSel = {};
function qLexam(tr, [t, q, opts, note]) {
  const X = LEXAM[tr], [name, inst] = X.types[t];
  const mark = s => esc(s).replace(/【(.+?)】/g, '<u class="jl-u">$1</u>').replace(/（\s*）/g, '<span class="blank">　　　</span>').replace(/\n/g, '<br>');
  const stem = q.includes('◆')
    ? (([pa, qu]) => `<div class="jl-passage" lang="${tr}">${mark(pa.trim())}</div><div class="q-sent" lang="${tr}">${mark(qu.trim())}</div>`)(q.split('◆'))
    : `<div class="q-sent" lang="${t === '翻译' ? 'zh' : tr}">${mark(q)}</div>`;
  return makeQ(null, 'x' + t, shuffle(opts.slice(1)).slice(0, 3), opts[0], {
    prompt: `<div class="eyebrow">${esc(name)}　<span class="jl-inst">${esc(inst)}</span></div>${stem}`,
    optLang: tr, explain: `<b lang="${tr}">${esc(opts[0])}</b>　${esc(note)}`
  });
}
function langExam(tr) {
  const X = LEXAM[tr];
  Object.entries(X.types).forEach(([k, [n]]) => { KIND_NAMES['x' + k] = n; });   // 成绩分析里显示题型名
  const L = lexamSel[tr] || X.levels[0][0]; lexamSel[tr] = L;
  const lname = X.levels.find(l => l[0] === L)[1];
  const p = h(`<section class="panel"><h2>模拟考 · ${esc(lname)}</h2><div class="skel" aria-label="加载中" role="status"><i></i><i></i><i></i></div></section>`);
  main.append(p);
  lvFetch(`exam-${L}`).then(bank => {
    if (!p.isConnected) return;
    S.lexams = S.lexams || [];
    const hist = S.lexams.filter(e => X.levels.some(l => l[0] === e.L)).slice(-6).reverse();
    const types = Object.keys(X.types).filter(t => bank.some(x => x[0] === t));
    p.innerHTML = `<div class="row between"><h2>模拟考 · ${esc(lname)}</h2><div class="seg" role="group">${X.levels.map(([k, n]) => `<button type="button" data-xl="${k}" class="${k === L ? 'on' : ''}">${esc(n)}</button>`).join('')}</div></div>
      <p>${X.intro.replace('限时作答', `限时 ${X.min[L]} 分钟`)}</p>
      <p class="small muted">题目为本站原创，按${tr === 'ko' ? ' TOPIK ' : '四六级'}官方题型编写（真题有版权，不能直接收录），干扰项专门挑容易混淆的。听力和写作部分以后补充。</p>
      <div class="row"><button class="btn pri" type="button" data-start>开始考试</button></div>
      <h3>题型专项练习</h3><div class="row">${types.map(t => `<button class="chip-btn" type="button" data-drill="${t}">${esc(X.types[t][0])} <span class="small">${bank.filter(x => x[0] === t).length}</span></button>`).join('')}</div>
      ${hist.length ? `<h3>最近成绩</h3><div class="list-wrap"><table class="list"><thead><tr><th>日期</th><th>考试</th><th>得分</th><th>结果</th></tr></thead><tbody>${hist.map(e => `<tr><td>${e.date}</td><td>${esc(X.levels.find(l => l[0] === e.L)[1])}</td><td>${e.score}/${e.total}</td><td>${e.score / e.total >= .6 ? '<span class="tag done">合格</span>' : '<span class="tag">未合格</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    p.querySelectorAll('[data-xl]').forEach(b => { b.onclick = () => { lexamSel[tr] = b.dataset.xl; render(); }; });
    const start = () => {
      const qs = [];
      X.plan[L].forEach(([t, n]) => sample(bank.filter(x => x[0] === t), n).forEach(x => qs.push(qLexam(tr, x))));
      main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
      runQuiz(host, qs, {
        title: `${lname} 模拟考`, exam: true, minutes: X.min[L], onDone: r => {
          if (!r) return render();
          S.lexams.push({ L, score: r.score, total: r.total, date: dkey() });
          const pass = r.score / r.total >= .6;
          addXP(r.score * 10 + (pass ? 50 : 0)); save();
          const by = {};
          r.res.forEach(x => { const k = x.q.kind; by[k] = by[k] || [0, 0]; by[k][1]++; if (x.ok) by[k][0]++; });
          const bd = `<div class="breakdown">${Object.entries(by).map(([k, [a, n]]) => `<div class="bd-row"><span>${KIND_NAMES[k]}</span><div class="bar"><i style="width:${a / n * 100}%"></i></div><span class="small">${a}/${n}</span></div>`).join('')}</div>
            <p class="small muted">获得 ${r.score * 10 + (pass ? 50 : 0)} 经验${pass ? '（含合格奖励 50）' : ''}。</p>`;
          quizSummary(host, r, { title: `${lname} 模拟考`, again: start, extraHTML: bd });
          const seal = host.querySelector('.seal');
          seal.textContent = pass ? '合格' : (tr === 'ko' ? '재도전' : 'Retry'); seal.style.fontSize = pass ? '2.2rem' : '1.3rem';
          if (pass) celebrate();
        }
      });
    };
    p.querySelector('[data-start]').onclick = start;
    p.querySelectorAll('[data-drill]').forEach(b => {
      const t = b.dataset.drill;
      const go = () => {
        const qs = sample(bank.filter(x => x[0] === t), 10).map(x => qLexam(tr, x));
        main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
        const title = `${lname} ${X.types[t][0]}练习`;
        runQuiz(host, qs, { title, noRecord: true, xpEach: 8, onDone: r => { if (!r) return render(); quizSummary(host, r, { title, again: go }); } });
      };
      b.onclick = go;
    });
  }).catch(() => { if (p.isConnected) p.innerHTML = `<h2>模拟考 · ${esc(lname)}</h2><p>加载失败：题库可能还在准备中，或者网络有问题，请稍后再试。</p>`; });
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
    // 不带 # 打开（从主屏幕图标启动、重新登录）时 hash 为空，所以按当前显示的语言判断
    s.onload = () => { if (document.body.dataset.track === tr && !busy()) render(); };
    s.onerror = () => { langLoading[tr] = false; toast('加载失败，请检查网络'); };
    document.body.append(s);
  }
  return false;
}
function viewLangTrack(tr, sub) {
  if (S.track !== tr) { S.track = tr; save(); }
  if (sub === 'abc') return main.append(enAbc());
  if (sub === 'levels') return langLevels(tr);
  if (sub === 'exam') return langExam(tr);
  if (sub === 'grammar') return l2Grammar(tr);
  if (sub && sub.startsWith('read')) return l2Reading(tr, sub.split('/')[1]);
  if (sub === 'listen') return l2Listen(tr);
  if (sub && sub.startsWith('biz')) return l2Biz(tr, sub.split('/')[1]);
  if (sub && sub.startsWith('quotes')) return l2Quotes(tr, sub.split('/')[1]);
  if (sub === 'trans') return viewTrans(tr);
  if (sub === 'dictation') return viewDictation(tr);
  if (sub === 'placement') return l2Placement(tr);
  if (sub === 'game') return l2Game(tr);
  if (sub === 'dict') return l2Dict(tr);
  if (!langReady(tr)) return;
  if (sub === 'words' || sub === 'phrases') return main.append(langList(tr, sub));
  if (sub === 'study' || sub === 'ri') return main.append(hubPage(tr, sub));
  // 首页：一行问候 → 今日任务 → 今日一句 → 入口（和日语首页同一结构）
  const T = TRACKS[tr], words = langItems(tr, 'words');
  const all = l2AllCards(tr), known = all.filter(x => S.srs[x.id] && S.srs[x.id].r > 0).length;
  const due = all.filter(x => S.srs[x.id] && S.srs[x.id].due <= Date.now());
  const day = ((S.l2task = S.l2task || {})[dkey()] = S.l2task[dkey()] || {});
  const td = (day[tr] = day[tr] || {});
  // 只保留最近两周的任务记录
  Object.keys(S.l2task).filter(k => k < dkey(new Date(Date.now() - 14 * DAY))).forEach(k => delete S.l2task[k]);
  const fresh = words.filter(x => !S.srs[x.id]).slice(0, 5);
  const stages = (S.l2game || {})[tr] || {}, nextStage = Array.from({ length: Math.ceil(words.length / 10) }, (_, i) => i).find(i => !stages[i]);
  const hr = new Date().getHours();
  const hello = tr === 'ko' ? (hr < 11 ? '좋은 아침이에요' : '안녕하세요') : (hr < 11 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening');
  const head = homeHead(homeHi(hello, '每天十分钟：完成下面的今日任务就好。', todayXP(), streak(), `已学 ${known} · 待复习 ${due.length}`));
  main.append(head);
  const mark = k => { td[k] = 1; save(); };
  const tasks = [
    { ic: '復', t: '复习到期的卡片', d: due.length ? `${due.length} 张卡片到了复习时间` : '没有到期的卡片', done: !due.length, go: () => langCards(due.slice(0, 50), `${T.title}复习`, tr) },
    { ic: '新', t: '学 5 个新词', dl: td.new || !fresh.length ? '' : tr, d: td.new ? '今天的新词学过了' : fresh.length ? fresh.map(x => x.t).join('、') : '入门单词都学过了，去分级词库继续', done: !!td.new || !fresh.length, go: () => { mark('new'); langCards(fresh, '今天的新词', tr); } },
    { ic: '跟', t: '今日一句 · 跟读一遍', d: '听原音，再自己说一遍，自动打分', done: !!td.shadow, go: () => l2Fetch(tr, 'daily').then(list => { const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / DAY) - 1; const [s0, pr, zh] = list[doy % list.length]; mark('shadow'); shadowSheet(s0, pr, zh, tr); }) },
    { ic: '听', t: '听力 1 题', d: `${tr === 'ko' ? 'TOPIK' : '四六级'}题型，听一段对话选答案`, done: !!td.listen, go: () => l2Fetch(tr, 'listen').then(list => { mark('listen'); const lv = LV_NAMES[tr][0], pool = list.filter(x => x.lv === (l2Sel[tr + 'l'] || lv)); runListen(sample(pool.length ? pool : list, 1), lv, { title: '今日听力', again: () => { location.hash = tr; } }); }) },
    nextStage != null ? { ic: '関', t: `闯关 · 第 ${nextStage + 1} 关`, d: `${words[nextStage * 10].cat}，10 个词，3 条命`, go: () => { location.hash = `${tr}/game`; } } : null
  ].filter(Boolean);
  const tp = taskPanel('今日任务', tasks, T.name);
  // 和日语首页同样的顺序：问候 → 今日阅读 → 今日一句 → 今日任务 → 进度、学习记录、印章（折叠）
  main.append(tp);
  // 还没做过分级测试：提示一次
  if (!(S.l2place || {})[tr] && !known) tp.after(h(`<section class="banner"><div><b>不知道从哪一级开始？</b><div class="small">做个 3 分钟的分级测试，帮你找到合适的起点。</div></div><div class="row"><a class="btn pri" href="#${tr}/placement">开始测试</a></div></section>`));
  const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / DAY) - 1;
  Promise.all([l2Fetch(tr, 'reading').catch(() => []), l2Fetch(tr, 'daily').catch(() => [])]).then(([reads, daily]) => {
    if (!head.isConnected) return;
    const a = reads.length && reads[doy % reads.length];
    if (a && !(S.l2read || {})[a.id]) head.append(h(`<a class="today-art" href="#${tr}/read/${a.id}"><div class="ta-img">${l2Img(a)}</div><div><span class="tag done">今日阅读</span> <span class="tag lv">${esc(a.lv)}</span><div class="rc-title" lang="${tr}">${esc(a.title)}</div><div class="small muted">${esc(a.zh)} · 生活短文${a.ph ? '，配照片' : ''}</div></div></a>`));
    if (daily.length) head.append(l2Daily(tr, daily));
  });
  const learnedN = pre => Object.keys(S.srs).filter(id => id.startsWith(pre) && S.srs[id].r > 0).length;
  const row = (name, n, t) => `<div class="lv-row"><b>${esc(name)}</b><div class="bar"><i style="width:${t ? n / t * 100 : 0}%"></i></div></div>`;
  const rec = homeRecords(row('入门', words.filter(x => S.srs[x.id] && S.srs[x.id].r > 0).length, words.length), '单词进度');
  main.append(homeFold([homeProgress(), rec, homeStamps()]));
  lvFetch(`${tr}-levels`).then(meta => { const box = rec.querySelector('.lv-list'); if (box) box.insertAdjacentHTML('beforeend', meta.map(([k, n, t]) => row(n, learnedN(`${tr}|L|${k}|`), t)).join('')); }).catch(() => {});
}
// 各语言的栏目（学习 / 阅读听力 两个分组页和首页都用）
function trackTiles(tr, group) {
  const ko = tr === 'ko';
  const study = [[`#${tr}/game`, '関', '闯关', '一关一关往前走'], [`#${tr}/abc`, ko ? '한' : 'Aa', ko ? '字母' : '字母音标', ko ? '字母和拼读' : '字母和音标'], [`#${tr}/words`, '词', '单词', '从入门词开始'],
    [`#${tr}/phrases`, '句', '常用句', '生活里常说的话'], [`#${tr}/grammar`, '文', '语法', '从基础到进阶'], [`#${tr}/levels`, '级', '分级词库', ko ? 'TOPIK 分级' : '按考试分级'],
    [`#${tr}/biz`, '商', '商务', '场景会话、邮件、词汇'], [`#${tr}/quotes`, '剧', ko ? '韩剧·韩影' : '影视台词', '名台词和生活用法'], [`#${tr}/trans`, '译', '翻译练习', '中外互译，自己打分']];
  const ri = [[`#${tr}/read`, '读', '阅读', '生活短文，配照片'], [`#${tr}/listen`, '听', '听力', '对话 + 题目'], [`#${tr}/dictation`, '写', '听写', '听一句，写一句']];
  const exam = [[`#${tr}/exam`, '考', '模拟考', ko ? 'TOPIK I / II' : '四级 / 六级']];
  return group === 'study' ? study : group === 'ri' ? ri : [...study, ...ri, ...exam];
}
const JA_TILES = {
  study: [['#course', '课', '情景课程', '校园·打工·职场·生活·旅行……'], ['#duel', '戦', '对战', '和在线的人比单词速答'], ['#game', '関', '闯关', '一关一关往前走'], ['#kana', 'あ', '假名', '五十音'], ['#vocab', '词', '单词', 'N5–N1 单词卡'], ['#kanji', '漢', '汉字', '读音、笔顺、例词'],
    ['#grammar', '文', '语法', 'N5–N1 句型和例句'], ['#biz', '商', '商务', '场景、敬语、邮件'], ['#anime', '剧', '动漫·日剧', '名台词和生活用法'], ['#trans', '译', '翻译练习', '中日互译，自己打分'], ['#conj', '変', '变形练习', '动词、形容词变形']],
  ri: [['#read', '读', '阅读', '每天上新，配照片'], ['#listen', '听', '听力', 'JLPT 题型'], ['#dictation', '写', '听写', '听一句，写一句'], ['#commute', '通', '通勤听力', '不用看屏幕，自动连续播放']]
};
// 「学习」「阅读听力」分组页
function hubPage(tr, group) {
  const title = group === 'study' ? '学习' : '阅读 · 听力';
  const tiles = tr === 'ja' ? JA_TILES[group] : trackTiles(tr, group);
  const p = h(`<section class="panel"><h2>${title}</h2></section>`);
  p.append(tileGrid(tiles));
  return p;
}
const viewStudy = () => main.append(typeof studyHubJa === 'function' ? studyHubJa() : hubPage('ja', 'study'));   // 新排版：hub.js
const viewRI = () => main.append(typeof riHub === 'function' ? riHub('ja') : hubPage('ja', 'ri'));
const viewEn = sub => viewEnglish(sub);   // 英语板块：en.js

// 顶部「日本語 / 한국어 / English」切换；导航栏只显示当前语言的栏目
function initTrackSwitch() {
  const form = document.querySelector('.gsearch'); if (!form) return;
  const seg = h(`<div class="track-seg" role="group" aria-label="${tj('学习的语言', '学ぶ言語')}">${Object.entries(TRACKS).map(([k, t]) => `<button type="button" data-track="${k}">${t.name}</button>`).join('')}</div>`);
  form.after(seg);
  seg.querySelectorAll('[data-track]').forEach(b => {
    b.onclick = () => { const tr = b.dataset.track; S.track = tr; save(); go(TRACKS[tr].home); };
  });
}
// 日语：点顶部的级别直接选（以前跳到「我的」，设置在很下面，找不到）
const JA_LV_DESC = { N5: '入门：假名、最基础的词', N4: '基础：日常简单对话', N3: '中级：能读懂日常文章', N2: '中高级：新闻、职场', N1: '高级：各种场合都能应对' };
function jaLevelMenu() {
  askSheet('选择日语目标级别（随时可以改）', [...LEVELS.map(L => [L, `${L}　${JA_LV_DESC[L]}`, L === S.level ? 'pri' : '']), [null, '取消']]).then(v => {
    if (!v || v === S.level) return;
    S.level = v; save(); toast(`已切换到 ${v}`); render();
  });
}
function applyTrack(view) {
  const tr = trackOf(view);
  document.body.dataset.track = tr;
  const lv = document.getElementById('chip-lv');
  document.documentElement.lang = tr === 'zh' || (tr === 'en' && S.enNative === 'ja') ? 'ja' : 'zh-CN';
  if (tr !== 'ja' && TRACKS[tr] && TRACKS[tr].tts) langAudioIdx(TRACKS[tr].tts.slice(0, 2));   // 提前加载录音目录，点读时能立刻播放   // 学中文时界面是日语（汉字用日本字形）
  if (lv && tr === 'en') {   // 英语：CEFR 级别，点开换
    lv.textContent = typeof enLevel === 'function' ? enLevel() : 'A1'; lv.href = 'javascript:void 0'; lv.title = tj('当前学习级别，点击更改', '学習レベル（タップで変更）');
    lv.onclick = async e => { e.preventDefault(); e.stopPropagation(); if (await leaveOk()) enLevelMenu(lv); };
  } else if (lv && tr === 'zh') {   // 中国語：HSK 级别，点开换
    lv.textContent = zhLevel(); lv.href = 'javascript:void 0'; lv.title = '目標の HSK 級（タップで変更）';
    lv.onclick = async e => { e.preventDefault(); e.stopPropagation(); if (await leaveOk()) zhLevelMenu(); };
  } else if (lv) {   // 日语显示 JLPT 级别；韩语、英语显示当前学习级别（分级测试结果或手动选的），点开可以换
    lv.textContent = tr === 'ja' ? S.level : l2CurLevel(tr);
    lv.href = 'javascript:void 0';
    lv.title = tr === 'ja' ? '当前目标级别，点击更改' : '当前学习级别，点击更改';
    lv.onclick = async e => { e.preventDefault(); e.stopPropagation(); if (await leaveOk()) { if (tr === 'ja') jaLevelMenu(); else l2LevelMenu(tr, lv); } };
  }
  document.querySelectorAll('.track-seg [data-track]').forEach(b => b.classList.toggle('on', b.dataset.track === tr));
  const input = document.getElementById('gs-q');
  if (input) input.placeholder = tr === 'ja' ? '查词：日语 / 假名 / 中文 / 英文' : tr === 'zh' ? '辞書：中国語・ピンイン・日本語' : tr === 'en' ? 'Search: English / 中文 / 日本語' : `查${TRACKS[tr].title}：${TRACKS[tr].title} / 中文`;
  // 站名随语言变化
  const name = BRAND;
  const bn = document.querySelector('.brand span'); if (bn) bn.textContent = name;
  const tagline = !S.onboarded ? (uiJa() ? '日本語・中国語・英語をもっと楽しく' : '日语、中文、英语，轻松学') : tr === 'zh' ? '中国語を、もっと楽しく' : tr === 'en' ? 'English, made fun' : '玩转' + { ja: '日语', ko: '韩语', en: '英语' }[tr];   // 还没选语言：不偏向哪一门
  const fb = document.querySelector('[data-foot-brand]'); if (fb) fb.textContent = `${name} · ${tagline}${tr === 'en' ? '. ' : '。'}`;   // 英语板块的标语是英文，用英文句号
  document.title = name + ' · ' + tagline;
  if (typeof i18nStatic === 'function') i18nStatic();
  buildNav(tr, view);
}
// 导航只有 5 个主栏目：今天 / 学习 / 阅读听力 / 考试 / 我的（手机上固定在底部）。其余栏目在「学习」「阅读听力」分组页里
const NAV_ICON = {
  home: '<path d="M12 3 2 11h3v9h5v-6h4v6h5v-9h3z"/>',
  study: '<path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-5a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h6z"/>',
  ri: '<path d="M12 3a9 9 0 0 0-9 9v6a3 3 0 0 0 3 3h2v-8H5v-1a7 7 0 0 1 14 0v1h-3v8h2a3 3 0 0 0 3-3v-6a9 9 0 0 0-9-9z"/>',
  exam: '<path d="M6 2h9l5 5v15H6zM14 3v5h5M9 12h8M9 16h8M9 20h5"/>',
  words: '<path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm4 2v2h6V7zm0 4v2h6v-2zM19 7h1a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H9v-2h10z"/>',
  me: '<path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z"/>'
};
// 英语：单词、定级在「单词」；语法、阅读、听力都在「阅读听力」的总页里
const EN_NAV = { home: 'home', words: 'study', placement: 'study', abc: 'study', dict: 'study', path: 'ri', ri: 'ri', study: 'ri', grammar: 'ri', read: 'ri', listen: 'ri', dictation: 'ri', trans: 'ri', course: 'ri', biz: 'ri', exam: 'exam' };
const NAV_GROUP = { vip: 'me', fav: 'me', calendar: 'me', offline: 'me', duel: 'study', commute: 'ri', home: 'home', study: 'study', game: 'study', kana: 'study', vocab: 'study', kanji: 'study', grammar: 'study', dict: 'study', biz: 'study',
  abc: 'study', words: 'study', phrases: 'study', levels: 'study', quotes: 'study', course: 'study', duel: 'study', buddy: 'me', anime: 'study', trans: 'study', conj: 'study', placement: 'study', dictation: 'ri', ri: 'ri', read: 'ri', listen: 'ri', exam: 'exam', me: 'me' };
const NAV_MOBILE = matchMedia('(max-width: 800px)');
// 顶栏有毛玻璃效果（backdrop-filter），里面的 position: fixed 不会贴到屏幕底部，所以手机上把导航移到 body 末尾
function placeNav() {
  const nav = document.querySelector('.tabs'), top = document.querySelector('.top'); if (!nav || !top) return;
  if (NAV_MOBILE.matches) { if (nav.parentElement !== document.body) document.body.append(nav); }
  else if (nav.parentElement !== top) top.append(nav);
}
NAV_MOBILE.addEventListener('change', placeNav);
function buildNav(tr, view) {
  const nav = document.querySelector('.tabs'); if (!nav) return;
  placeNav();
  const sub = (location.hash.slice(1).split('/')[1]) || '';
  // 三种语言共用的页面（收藏、会员、对战、通勤听力等）：亮对应的栏目，不亮「今天」
  const SHARED = { vip: 'me', fav: 'me', calendar: 'me', offline: 'me', buddy: 'me', duel: 'study', commute: 'ri', check: 'exam', diag: 'me', path: 'study' };
  const cur = view === 'me' ? 'me' : SHARED[view] ? SHARED[view] : tr === 'ja' ? NAV_GROUP[view] || 'home' : tr === 'zh' ? ZH_NAV[sub.split('/')[0] || 'home'] || 'home' : tr === 'en' ? EN_NAV[sub.split('/')[0] || 'home'] || 'home' : NAV_GROUP[sub || 'home'] || 'home';
  const base = tr === 'ja' ? '#' : `#${tr}/`;
  const items = tr === 'en'
    ? [['home', 'Today', '#en'], ['study', 'Words', '#en/words'], ['ri', 'Learn', '#en/ri'], ['exam', 'Tests', '#en/exam'], ['me', 'Me', '#me']]   // 英语板块的导航用英语
    : tr === 'zh'
    ? [['home', '今日', '#zh'], ['study', '学ぶ', '#zh/study'], ['ri', '読む・聴く', '#zh/ri'], ['exam', '試験', '#zh/exam'], ['me', 'マイページ', '#me']]
    : [['home', '今天', tr === 'ja' ? '#home' : `#${tr}`], ['study', '学习', base + 'study'], ['ri', '阅读听力', base + 'ri'], ['exam', '考试', base + 'exam'], ['me', '我的', '#me']];
  nav.innerHTML = items.map(([k, label, href]) => `<a href="${href}" class="${k === cur ? 'on' : ''}"${k === cur ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${NAV_ICON[tr === 'en' ? { study: 'words', ri: 'study' }[k] || k : k]}</svg><span>${label}</span></a>`).join('');
}
// 查词框在韩语、英语模式下搜这门语言的单词和句子
function langSearch(q, drop) {
  const tr = document.body.dataset.track;
  if (tr === 'zh') return zhSearch(q, drop);
  if (tr === 'en') return enSearch(q, drop);   // 英语：en.js
  if (!TRACKS[tr] || tr === 'ja') return false;
  if (!TRACKS[tr].data()) { drop.innerHTML = '<div class="small muted" style="padding:10px">先打开一次这个语言的页面，加载词表</div>'; drop.hidden = false; return true; }
  const ql = q.toLowerCase();
  const hits = [...langItems(tr, 'words'), ...langItems(tr, 'phrases')].filter(x => x.t.toLowerCase().includes(ql) || x.zh.includes(q) || (x.pr && x.pr.toLowerCase().includes(ql))).slice(0, 8);
  drop.innerHTML = hits.map(x => `<div class="gs-item"><span class="gs-w" lang="${tr}">${esc(x.t)}</span><span class="gs-r">${esc(x.pr || '')}</span><span class="gs-m">${esc(x.zh)}</span>${sayBtn(x.t, TRACKS[tr].tts)}</div>`).join('') || '<div class="small muted" style="padding:10px">没有找到</div>';
  drop.hidden = false;
  return true;
}
// 点当前所在的栏目（例如闪卡做到一半点「单词」）也要回到列表：见 app.js 里「点指向当前页面的站内链接」
// 左上角的小猫图标是会员入口（#vip，vip.js）；回首页用底部的「今天」

/* ---------- 首页公共部分（日语、韩语、英语首页同一结构） ---------- */
// 一行问候 + 一行进度（连续天数、今天的经验、学习量），代替原来的大卡片和一排数字方块
function homeHi(title, text, tx, streakN, extra) {
  const pct = Math.min(100, Math.round(tx / S.goal * 100));
  const el = h(`<section class="hi-line">
    <div class="hi-top">${neko('happy', 'mini')}<div><b>${esc(title)}</b><div class="small muted">${esc(text)}</div></div></div>
    <div class="hi-stats small"><span>🔥 ${tje(`连续 <b>${streakN}</b> 天`, `<b>${streakN}</b> 日連続`, `<b>${streakN}</b>-day streak`)}</span><span>${tje(`今天 <b>${tx}</b>/${S.goal} 经验`, `今日 <b>${tx}</b>/${S.goal} XP`, `Today <b>${tx}</b>/${S.goal} XP`)}</span><span class="muted">${esc(extra)}</span></div>
    <div class="bar hi-bar"><i style="width:${pct}%"></i></div>
  </section>`);
  if (typeof guestBanner === 'function') setTimeout(() => guestBanner(el), 0);
  return el;
}
// 首页最上面一组：问候 → 今日阅读 → 今日一句，挨得近一点（组内间距见 .home-head），下面紧接着今日任务（三种语言同一结构）
function homeHead(hi, ...items) {
  const el = h('<div class="home-head"></div>');
  el.append(hi, ...items.filter(Boolean));
  return el;
}
// 今日一句的说明（用法、例句）：收起来，点开才显示
const dailyMore = (html, label = tj('用法和例句', '解説')) => html ? `<details class="daily-more"><summary>${esc(label)}</summary><div class="daily-more-b">${html}</div></details>` : '';
// 今日任务面板：[{ic, t, d, done, go}]
function taskPanel(title, tasks, note = '') {
  const tp = h(`<section class="panel today-tasks"><div class="row between"><h2>${esc(title)}</h2><span class="small muted">${esc(note)}</span></div><div class="tasks"></div></section>`);
  const left = tasks.filter(t => !t.done).length;
  if (!left) tp.querySelector('h2').insertAdjacentHTML('afterend', `<span class="tag done">${tje('今天的任务完成了', '今日のタスク完了！', 'All done for today!')}</span>`);
  tasks.forEach(t => {
    const el = h(`<div class="task ${t.done ? 'done' : ''}"><span class="task-ic">${t.done ? '✓' : t.ic}</span><div class="task-t"><b>${esc(t.t)}</b><div class="small muted"${t.dl ? ` lang="${t.dl}"` : ''}>${esc(t.d)}</div></div>${t.done ? '' : `<button class="btn pri" type="button">${tje('开始', 'スタート', 'Start')}</button>`}</div>`);
    const b = el.querySelector('button'); if (b) b.onclick = e => { e.stopPropagation(); t.go(); };
    tp.querySelector('.tasks').append(el);
  });
  return tp;
}
// 下拉选择（题材、题型等很多选项时用，代替一排按钮）：pickSelect('题材', 'data-cat', [[值, 显示], …], 当前值)
const pickSelect = (label, attr, opts, cur) => `<label class="pick"><span class="pick-l">${esc(label)}</span><select ${attr}>${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
// 入口方块（两列，带图标）
const tileGrid = items => h(`<div class="tile-grid">${items.map(([href, ic, name, desc]) => `<a class="tile" href="${href}"><span class="tile-ic">${ic}</span><b>${esc(name)}${typeof guestLockedHref === 'function' && guestLockedHref(href) ? ` <span class="tile-lock" title="${tj('注册后解锁', '登録で解放')}">🔒</span>` : ''}</b><span class="small muted">${esc(desc)}</span></a>`).join('')}</div>`);

// 韩语、英语的学习级别：记在 S.l2place，打开网站时同步到语法/阅读/听力/分级词库的级别选择
const l2CurLevel = tr => tr === 'zh' ? zhLevel() : (S.l2place || {})[tr] || LV_NAMES[tr][0];
function l2SetLevel(tr, name) {
  (S.l2place = S.l2place || {})[tr] = name; save();
  const k = LV_NAMES[tr].indexOf(name);
  l2Sel[tr + 'g'] = l2Sel[tr + 'r'] = l2Sel[tr + 'l'] = name;
  if (k >= 0) lvSel[tr] = L2_PLACE_SRC[tr][k][0];
}
function l2LevelMenu(tr, anchor) {
  document.querySelectorAll('.lv-menu').forEach(m => m.remove());
  const cur = l2CurLevel(tr), r = anchor.getBoundingClientRect();
  const m = h(`<div class="lv-menu" role="menu" style="top:${r.bottom + 6}px;right:${Math.max(8, innerWidth - r.right)}px">
    <div class="small muted">${TRACKS[tr].title}学习级别</div>
    ${LV_NAMES[tr].map(n => `<button type="button" role="menuitem" data-lvm="${n}" class="${n === cur ? 'on' : ''}">${n}</button>`).join('')}
    <a href="#${tr}/placement" class="small">不确定？做个分级测试</a></div>`);
  m.querySelectorAll('[data-lvm]').forEach(b => { b.onclick = () => { l2SetLevel(tr, b.dataset.lvm); m.remove(); toast(`已切到「${b.dataset.lvm}」`); render(); }; });
  m.querySelector('a').onclick = () => m.remove();
  document.body.append(m);
  setTimeout(() => document.addEventListener('click', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', off); } }), 0);
}
// 所有脚本加载完再恢复（S 在 app.js 里定义）
addEventListener('DOMContentLoaded', () => { if (typeof LV_NAMES !== 'undefined') Object.entries(S.l2place || {}).forEach(([tr, n]) => { if (LV_NAMES[tr] && TRACKS[tr] && !l2Sel[tr + 'g']) l2SetLevel(tr, n); }); });
