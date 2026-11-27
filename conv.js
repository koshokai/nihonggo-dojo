// 方便学习的五个功能：通勤听力模式、贴一段就能读的阅读器、「接着学」、收藏夹、离线下载录音。
// 都跟着当前在学的语言走（日语界面中文；学中文时界面日语，用 tj()）。依赖 app.js / zh.js / read.js 的全局函数（运行时才调用）。
const isZh = () => S.track === 'zh';
const isEn = () => S.track === 'en';
const T2 = (zh, ja) => tj(zh, ja);

/* =====================================================================
   1. 通勤听力模式：单词 → 停顿 → 意思 → 例句，自动连续播放，不用看屏幕
   ===================================================================== */
// 等朗读结束再往下走（录音 / 手机朗读都支持；万一没有回调，按长度估一个超时）
const waitMs = ms => new Promise(r => setTimeout(r, ms));
function sayJa(text) { return new Promise(res => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; speak(text, { onend: fin }); setTimeout(fin, 1500 + text.length * 350); }); }
// 母语的意思：没有录音，不用手机朗读，停一会儿让人看屏幕上的意思
function sayTTS(text) { return waitMs(Math.min(3500, 900 + text.length * 120)); }
// 中文、英语：有录音（MeloTTS / Kokoro）用录音（没有就跳过，不用手机朗读）
// 录音目录还没好时先等一下（最多 8 秒）；公开目录里没有、是会员的话再到会员录音里找
async function sayZh(text, code = 'zh', tts = 'zh-CN') {
  // 目录只到了一部分（主目录还在下载）时也要等完，不然会误报「还在准备中」
  if (!(LANG_IDX_READY[code] || {})[text] && !LANG_IDX_DONE[code] && typeof langAudioIdx === 'function') await Promise.race([langAudioIdx(code), waitMs(15000)]).catch(() => {});
  if (!(LANG_IDX_READY[code] || {})[text] && typeof langIdxRetry === 'function') await Promise.race([langIdxRetry(code) || Promise.resolve(), waitMs(15000)]).catch(() => {});
  let src = (LANG_IDX_READY[code] || {})[text];
  if (src) src = audUrl(src);
  else if (typeof memberTextAudio === 'function' && typeof isMember === 'function' && isMember(code)) src = await memberTextAudio(code, text).catch(() => null);
  if (!src) return new Promise(res => noVoice(res, LANG_IDX_DONE[code] ? '' : 'net'));
  return new Promise(res => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; const el = langPlayer(); el.src = src; el.onended = fin; el.onerror = fin; el.play().catch(fin); setTimeout(fin, 1500 + text.length * 450); });
}
async function commuteItems(src, n) {
  if (isEn()) {   // 英语：A1–C1 词表（en.js）
    langAudioIdx('en');
    const lv = enLevel(), all = (await Promise.all(EN_LV.map(L => enFetch(`en-${L}`).then(r => enItems(L, r)).catch(() => [])))).flat();
    const pick = src === 'due' ? all.filter(x => S.srs[x.id] && S.srs[x.id].due <= Date.now())
      : src === 'new' ? all.filter(x => x.lv === lv && !S.srs[x.id])
      : src === 'fav' ? all.filter(x => (S.fav || []).some(f => f.k === 'w' && f.l === 'en' && f.t === x.w))
      : all.filter(x => x.lv === lv);
    return (src === 'new' ? pick : shuffle(pick)).slice(0, n).map(x => ({ w: x.w, say: x.w, sub: x.ipa || '', m: enGloss(x).split(/[；;、，,]/)[0], ex: x.ex, exm: enNat(x.exzh, x.exja) }));
  }
  if (isZh()) {
    const all = await zhAllWords(), lv = zhLvNum();
    const pick = src === 'due' ? all.filter(x => S.srs[x.id] && S.srs[x.id].due <= Date.now())
      : src === 'new' ? all.filter(x => x.L === lv && !S.srs[x.id])
      : src === 'fav' ? all.filter(x => (S.fav || []).some(f => f.k === 'w' && f.t === x.w))
      : all.filter(x => x.L === lv);
    return (src === 'new' ? pick : shuffle(pick)).slice(0, n).map(x => ({ w: x.w, say: x.w, sub: x.py, m: (x.ja || '').split('；')[0], ex: x.ex, exm: x.exja }));
  }
  const ex = v => (typeof EXAMPLES !== 'undefined' && (EXAMPLES[v.w] || [])[0]) || null;
  const vs = src === 'due' ? dueList(LEVELS).filter(v => v.w)
    : src === 'new' ? newList(S.level)
    : src === 'wrong' ? Object.keys(S.wrong).map(id => ITEMS[id]).filter(v => v && v.w)
    : src === 'fav' ? (S.fav || []).filter(f => f.k === 'w' && f.l === 'ja').map(f => wordIndex().get(f.t)).filter(Boolean)
    : VOCAB[S.level];
  return (src === 'new' ? vs : shuffle(vs)).slice(0, n).map(v => { const e = ex(v); return { w: v.w, say: v.r, sub: v.r, m: v.m.split(/[；;]/)[0], ex: e ? e[0] : '', exsay: e ? e[1] : '', exm: e ? e[2] : '' }; });
}
let commuteStop = null;
function viewCommute() {
  const J = uiJa(), o = (S.commute = Object.assign({ src: 'due', n: 20, gap: 2, ex: true }, S.commute));
  // 今天没有要复习的词：默认换成「新单词」（不然点开始只会提示没有内容）
  const tr0 = S.track || 'ja', hasDue = Object.keys(S.srs).some(id => (tr0 === 'ja' ? !/^(zh|en)\|/.test(id) : id.startsWith(tr0 + '|')) && S.srs[id].due <= Date.now());
  if (o.src === 'due' && !hasDue && !o.userSet) o.src = 'new';
  const seg = (k, items) => `<div class="seg">${items.map(([v, t]) => `<button type="button" data-${k}="${v}" class="${String(o[k]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const p = h(`<section class="panel commute"><h2>🎧 ${T2('通勤听力', '通勤リスニング')}</h2>
    <p class="muted">${T2('戴上耳机按开始：单词 → 停顿让你回想 → 意思 → 例句，自动一个接一个播放，不用看屏幕。', 'イヤホンをつけてスタート。単語 → 思い出す間 → 意味 → 例文の順に自動で流れます。画面を見なくてOK。')}</p>
    <div class="row between"><span>${T2('内容', '内容')}</span>${seg('src', [['due', T2('今天要复习', '今日の復習')], ['new', T2('新单词', '新しい単語')], ...(isZh() || isEn() ? [] : [['wrong', T2('错题', '間違えた単語')]]), ['fav', T2('收藏', 'お気に入り')], ['all', isZh() ? zhLevel() : isEn() ? enLevel() : S.level]])}</div>
    <div class="row between"><span>${T2('数量', '数')}</span>${seg('n', [[10, '10'], [20, '20'], [50, '50']])}</div>
    <div class="row between"><span>${T2('回想时间', '思い出す時間')}</span>${seg('gap', [[1, T2('1 秒', '1 秒')], [2, T2('2 秒', '2 秒')], [4, T2('4 秒', '4 秒')]])}</div>
    <div class="row between"><span>${T2('读例句', '例文も読む')}</span>${seg('ex', [[true, T2('读', 'あり')], [false, T2('不读', 'なし')]])}</div>
    <div class="row"><button class="btn pri big" type="button" data-play>▶ ${T2('开始', 'スタート')}</button></div>
    <p class="small muted">${T2('提示：锁屏后有的手机会暂停朗读，最好保持屏幕亮着（可以调暗）。', 'ヒント：画面をロックすると読み上げが止まる端末があります。画面はつけたまま（暗くしてOK）がおすすめです。')}</p></section>`);
  ['src', 'n', 'gap', 'ex'].forEach(k => p.querySelectorAll(`[data-${k}]`).forEach(b => { b.onclick = () => { const v = b.dataset[k]; o[k] = k === 'src' ? v : k === 'ex' ? v === 'true' : +v; if (k === 'src') o.userSet = 1; save(); render(); }; }));
  p.querySelector('[data-play]').onclick = async () => {
    if (typeof audioPrime === 'function') audioPrime();   // 点击当下解锁播放器：下面要先下载词表，过了点击那一刻 iPhone 就不让出声了
    const code = isEn() ? 'en' : isZh() ? 'zh' : '';
    const items = await commuteItems(o.src, o.n).catch(() => []);
    if (items.length && code && !LANG_IDX_DONE[code]) { toast(T2('正在准备录音…', '音声を準備しています…')); await Promise.race([langAudioIdx(code), waitMs(15000)]).catch(() => {}); }
    if (!items.length) return toast(T2('这里还没有内容，换一个试试', 'まだ内容がありません。別のものを選んでください'));
    commutePlay(items, o);
  };
  main.append(p);
}
function commutePlay(items, o) {
  const J = uiJa(), zh = isZh(), en = isEn();
  const sayW = t => en ? sayZh(t, 'en', 'en-US') : zh ? sayZh(t) : sayJa(t);   // 学习语言
  const sayM = t => sayTTS(t, zh || (en && enJa()) ? 'ja-JP' : 'zh-CN');           // 意思（母语）
  let i = 0, paused = false, stop = false;
  main.innerHTML = '';
  const box = h(`<section class="panel commute-play"><div class="row between"><span class="small muted" data-pos></span><button class="btn ghost" type="button" data-x>✕ ${T2('结束', '終了')}</button></div>
    <div class="cm-word" data-w></div><div class="cm-sub" data-s></div><div class="cm-m" data-m></div><div class="cm-ex small" data-e></div>
    <div class="bar"><i data-bar style="width:0"></i></div>
    <div class="row cm-ctl"><button class="btn" type="button" data-prev>⏮</button><button class="btn pri big" type="button" data-pp>⏸</button><button class="btn" type="button" data-next>⏭</button></div></section>`);
  main.append(box);
  const $ = s => box.querySelector(s);
  const end = () => { stop = true; stopSpeech(); if (hasTTS) speechSynthesis.cancel(); langPlayer().pause(); commuteStop = null; };
  commuteStop = end;
  $('[data-x]').onclick = () => { end(); render(); };
  $('[data-pp]').onclick = () => { paused = !paused; $('[data-pp]').textContent = paused ? '▶' : '⏸'; if (paused) { stopSpeech(); if (hasTTS) speechSynthesis.cancel(); langPlayer().pause(); } else loop(); };
  $('[data-next]').onclick = () => { stopSpeech(); if (hasTTS) speechSynthesis.cancel(); i = Math.min(items.length, i + 1); jump(); };
  $('[data-prev]').onclick = () => { stopSpeech(); if (hasTTS) speechSynthesis.cancel(); i = Math.max(0, i - 1); jump(); };
  let gen = 0;
  const jump = () => { gen++; if (!paused) loop(); };
  const ms = 'mediaSession' in navigator ? navigator.mediaSession : null;
  if (ms) { try { ms.setActionHandler('nexttrack', () => $('[data-next]').click()); ms.setActionHandler('previoustrack', () => $('[data-prev]').click()); ms.setActionHandler('pause', () => { if (!paused) $('[data-pp]').click(); }); ms.setActionHandler('play', () => { if (paused) $('[data-pp]').click(); }); } catch (e) { /* 忽略 */ } }
  async function loop() {
    const my = ++gen;
    while (!stop && !paused && my === gen && i < items.length) {
      const x = items[i];
      $('[data-pos]').textContent = `${i + 1} / ${items.length}`; $('[data-bar]').style.width = (i / items.length * 100) + '%';
      $('[data-w]').textContent = x.w; $('[data-w]').lang = zh ? 'zh-CN' : en ? 'en' : 'ja'; $('[data-s]').textContent = x.sub !== x.w ? x.sub : '';
      $('[data-m]').textContent = ''; $('[data-e]').textContent = '';
      if (ms && window.MediaMetadata) ms.metadata = new MediaMetadata({ title: x.w, artist: `${BRAND} · ${T2('通勤听力', '通勤リスニング')}` });
      await sayW(x.say); if (my !== gen || stop || paused) return;
      await waitMs(o.gap * 1000); if (my !== gen || stop || paused) return;
      $('[data-m]').textContent = x.m;
      await sayM(x.m); if (my !== gen || stop || paused) return;
      if (o.ex && x.ex) {
        $('[data-e]').innerHTML = `<div lang="${zh ? 'zh-CN' : en ? 'en' : 'ja'}">${esc(x.ex)}</div><div class="muted">${esc(x.exm || '')}</div>`;
        await waitMs(400);
        await (zh || en ? sayW(x.ex) : sayJa(x.exsay || x.ex)); if (my !== gen || stop || paused) return;
      }
      await waitMs(900);
      if (my !== gen) return;
      i++;
    }
    if (!stop && i >= items.length) { $('[data-bar]').style.width = '100%'; $('[data-w]').textContent = T2('听完了！', 'おつかれさま！'); $('[data-s]').textContent = ''; $('[data-m]').textContent = T2(`${items.length} 个`, `${items.length} 語`); addXP(Math.round(items.length / 2)); commuteStop = null; }
  }
  loop();
}
addEventListener('hashchange', () => { if (commuteStop) commuteStop(); });

/* =====================================================================
   2. 贴一段就能读：粘贴任何日语（或中文），自动注音 / 拼音，点词查意思、加单词卡，整段朗读
   ===================================================================== */
// 日语：浏览器分词 → 查词典（本站词表 + JMdict）→ 给汉字部分标读音（活用形只标汉字部分）
const JA_PARTICLE = /^(は|が|を|に|へ|と|も|の|や|ね|よ|で|から|まで|より|だけ|しか|ほど|など|には|では|とは|にも|でも|への|との|での|からの|までの|って|けど|けれど|ので|のに|です|でした|でしょう|だった|だろう)$/;
const JA_AUX = /^(ます|ました|ません|ませんでした|ましょう|ない|なかった|た|だ|て|で|る|れる|られる|せる|させる|たい|そう|ている|ていた|てる|ください|って|か|な|わ|ぞ|さ)$/;
function readerTokensJa(text) {
  const segs = [...new Intl.Segmenter('ja', { granularity: 'word' }).segment(text)].map(s => s.segment);
  const W = wordIndex(), JM = jmIndex();
  const known = w => W.has(w) || (JM && JM.has(w));
  // 浏览器把「ください」切成「くだ|さい」这类：相邻的平假名片段合起来是助词、助动词就合并
  for (let i = 0; i + 1 < segs.length; i++) {
    const j = segs[i] + segs[i + 1];
    if (/^[ぁ-ゟ]+$/.test(j) && (JA_AUX.test(j) || JA_PARTICLE.test(j))) { segs.splice(i, 2, j); i--; }
  }
  // 「時に」「家で」这种汉字 + 助词连在一起的片段拆开（数字后的量词、名词才查得准）
  for (let i = 0; i < segs.length; i++) { const m = segs[i].match(/^([一-鿿々]+)(.+)$/); if (m && JA_PARTICLE.test(m[2]) && !known(segs[i])) segs.splice(i, 1, m[1], m[2]); }
  // 浏览器有时把一个词切碎（会社員 → 会 | 社員）：相邻的纯汉字片段，合起来是词典里的词就合并（先试 3 段，再试 2 段）
  for (let i = 0; i < segs.length; i++) {
    for (const n of [3, 2]) {
      const parts = segs.slice(i, i + n);
      if (parts.length === n && parts.every(x => /^[一-鿿々]+$/.test(x)) && known(parts.join(''))) { segs.splice(i, n, parts.join('')); break; }
    }
  }
  const out = [];
  for (let i = 0; i < segs.length; i++) {
    let t = segs[i];
    // 动词、形容词：汉字后面的平假名词尾并进来（飲 + み + ます → 飲みます 查「飲む」）
    // 助词不并进来，除非后面接着动词词尾（下|が|って → 下がって）（空が、上で、下から 要按名词查，不然会被当成动词「空く」「上る」「下る」）
    if (/[一-鿿]$/.test(t) && segs[i + 1] && /^[ぁ-ゟ]+$/.test(segs[i + 1]) && (!JA_PARTICLE.test(segs[i + 1]) || (segs[i + 2] && /^[っりらるれろ]/.test(segs[i + 2]) && known(t + segs[i + 1] + 'る')) || (/^し/.test(segs[i + 1]) && known(t + 'しい')))) { t += segs[++i]; while (segs[i + 1] && /^(ます|ました|ません|ない|なかった|た|だ|て|で|る|れる|られる|せる|たい|そう)$/.test(segs[i + 1])) t += segs[++i]; }
    out.push(t);
  }
  // 活用形的词尾第一个假名 → 原形的词尾（話せる → 話す，行きます → 行く，通って → 通う / 通る）
  const ROW = { かきくけこ: 'く', がぎぐげご: 'ぐ', さしすせそ: 'す', たちつてと: 'つ', なにぬねの: 'ぬ', ばびぶべぼ: 'ぶ', まみむめも: 'む', らりるれろ: 'る', わいうえお: 'う' };
  // 「い」开头：書いて・聞いた → く，泳いで → ぐ，言います → う
  const baseEnds = tail => { const c = tail[0]; if (c === 'っ') return ['う', 'つ', 'る']; if (c === 'ん') return ['む', 'ぶ', 'ぬ'];
    if (c === 'い') return /^い[でだ]/.test(tail) ? ['ぐ', 'く', 'う'] : /^い[てた]/.test(tail) ? ['く', 'う'] : ['う', 'く'];
    const r = Object.entries(ROW).find(([k]) => k.includes(c)); return r ? [r[1]] : []; };
  const COUNTER = { 時: 'じ', 円: 'えん', 年: 'ねん', 月: 'がつ', 回: 'かい', 階: 'かい', 歳: 'さい', 冊: 'さつ', 枚: 'まい', 台: 'だい', 度: 'ど', 番: 'ばん', 週: 'しゅう', 時間: 'じかん', 人: 'にん', 個: 'こ', 号: 'ごう', 位: 'い', 点: 'てん', 倍: 'ばい' };
  return out.map((t, idx, arr) => {
    if (!/[一-鿿ぁ-ヿ]/.test(t) || JA_PARTICLE.test(t) || JA_AUX.test(t)) return { t };   // 助词、助动词不查词典（不然「が」会查成「絵」）
    const forms = [t];
    const m = t.match(/^([一-鿿々]+)([ぁ-ゟ]*)$/);
    if (m && m[2]) {   // 有词尾：先找动词、形容词的原形，最后才用单独的汉字（避免「話せる」查成名词「話」）
      if (/^し(い|く|かっ|けれ|さ|そう)/.test(m[2])) forms.push(m[1] + 'しい');   // 形容词：楽しかった → 楽しい
      else if (/^(く|かっ|けれ|さ|そう|い$)/.test(m[2])) forms.push(m[1] + 'い');   // 高くて → 高い
      // 词尾是え段、い段（入れ・止め・起き）先试一段动词「入れる」「止める」，再试五段「入る」「止む」
      if (/^[えけげせぜてでねへべぺめれいきぎしじちぢにひびぴみり]/.test(m[2]) && !/^[いっ]/.test(m[2])) forms.push(m[1] + m[2][0] + 'る');
      // 词干带假名的五段动词（止まる、終わる、曲がる）：先试把词尾前几个假名算进词干
      for (let j = Math.min(2, m[2].length - 1); j >= 0; j--) baseEnds(m[2].slice(j)).forEach(e => forms.push(m[1] + m[2].slice(0, j) + e));
      forms.push(m[1] + m[2][0] + 'る', m[1] + 'る', m[1] + 'い', m[1] + 'しい');
      for (let j = m[2].length - 1; j >= 1; j--) forms.push(m[1] + m[2].slice(0, j));   // 名词带假名（止め、話し合い）放在动词原形后面
      forms.push(m[1]);
    } else if (m) { forms.push(m[1]); ['る', 'う', 'く', 'す', 'つ', 'む', 'ぶ', 'ぐ', 'ぬ', 'い', 'しい'].forEach(e => forms.push(m[1] + e)); }
    let hit = null, base = null;
    for (const f of forms) { const v = W.get(f); if (v) { hit = { w: v.w, r: v.r, zh: v.m, v }; base = f; break; } }
    if (!hit && JM) for (const f of forms) { const e = JM.get(f); if (e && !(/^[ぁ-ゟー]+$/.test(t) && e.k[0] && e.k[0] !== t)) { hit = { w: e.k[0] || e.r[0], r: e.r[0], en: e.s.slice(0, 3).map(g => g.join('; ')), jm: e }; base = f; break; } }
    let ruby = null;
    if (hit && m && hit.r && /[一-鿿]/.test(base)) {
      const okuri = base.slice(m[1].length);   // 原形里汉字后面的假名
      const hr = base === m[1] && /する$/.test(hit.r) && !/する$/.test(base) ? hit.r.slice(0, -2) : hit.r;   // 「運動（する）」只标「うんどう」
      let kr = base === '日本' ? 'にほん' : okuri && hr.endsWith(okuri) ? hr.slice(0, hr.length - okuri.length) : base === m[1] ? hr : null;
      if (base === '来る' && m[2]) kr = /^[まただてよ]/.test(m[2]) ? 'き' : /^[なさい]/.test(m[2]) ? 'こ' : 'く';   // 来ます・来た → き，来ない → こ
      const prev = idx > 0 ? arr[idx - 1].slice(-1) : '';
      if (/[〇一二三四五六七八九十百千万0-9０-９何]/.test(prev) && COUNTER[m[1]] && !m[2]) kr = COUNTER[m[1]];   // 数字后面的量词：六時 → じ，一万円 → えん
      // 词典用的是旧写法（終る＝おわる），原文写「終わ」：读音末尾和原文汉字后的假名重叠的部分去掉
      if (kr && m[2] && base !== m[1]) for (let k = Math.min(kr.length - 1, m[2].length); k >= 1; k--) if (m[2].startsWith(kr.slice(-k)) && !okuri.startsWith(m[2].slice(0, k))) { kr = kr.slice(0, -k); break; }
      if (kr && kr !== m[1]) ruby = { k: m[1], r: kr, rest: t.slice(m[1].length) };
    }
    return { t, hit, ruby };
  });
}
function readerHTMLJa(text) {
  return readerTokensJa(text).map((x, i) => {
    const inner = x.ruby ? `<ruby>${esc(x.ruby.k)}<rt>${esc(x.ruby.r)}</rt></ruby>${esc(x.ruby.rest)}` : esc(x.t).replace(/\n/g, '<br>');
    return x.hit ? `<span class="wd rd-w" data-i="${i}">${inner}</span>` : inner;
  }).join('');
}
function readerHTMLZh(text, by) {
  const segs = [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(text)].map(s => s.segment);
  return segs.map(t => {
    const x = by[t];
    if (!x) return esc(t).replace(/\n/g, '<br>');
    const pys = x.py.split(' ');
    const inner = [...t].length === pys.length ? [...t].map((c, k) => `<ruby>${esc(c)}<rt>${esc(pys[k])}</rt></ruby>`).join('') : esc(t);
    return `<span class="zh-tok rd-w" data-zw="${esc(t)}">${inner}</span>`;
  }).join('');
}
function viewReader() {
  const J = uiJa(), zh = isZh();
  const saved = (S.myTexts || []).filter(x => (x.l === 'zh') === zh);
  const p = h(`<section class="panel reader"><h2>📋 ${T2('贴一段就能读', '貼りつけて読む')}</h2>
    <p class="muted">${zh ? 'ネットやSNSで見かけた中国語を貼りつけると、ピンインつきで表示。単語をタップすると意味が出て、単語カードにも追加できます。' : '把在网上、新闻、漫画、聊天里看到的日语贴进来：自动标读音，点词看意思，一键加进单词卡。'}</p>
    <textarea class="tr-input" rows="5" data-txt lang="${zh ? 'zh-CN' : 'ja'}" placeholder="${zh ? 'ここに中国語を貼りつけ' : '在这里粘贴日语'}"></textarea>
    <div class="row"><button class="btn pri" type="button" data-rgo>${T2('开始读', '読む')}</button><button class="btn" type="button" data-paste>📋 ${T2('从剪贴板粘贴', 'クリップボードから')}</button></div>
    ${saved.length ? `<h3>${T2('最近读过', '最近読んだもの')}</h3><div class="zh-arts">${saved.slice(0, 10).map(x => `<div class="rd-saved"><button type="button" class="link-btn" data-open="${x.id}" lang="${zh ? 'zh-CN' : 'ja'}">${esc(x.t.slice(0, 40))}${x.t.length > 40 ? '…' : ''}</button><button type="button" class="ws-x rd-del" data-del="${x.id}" aria-label="delete">×</button></div>`).join('')}</div>` : ''}
    <div data-out></div></section>`);
  main.append(p);
  const ta = p.querySelector('[data-txt]'), out = p.querySelector('[data-out]');
  const go = async text => {
    text = (text || '').trim().slice(0, 4000);
    if (!text) return toast(T2('先贴一段文字', 'まず文章を貼りつけてください'));
    if (typeof Intl === 'undefined' || !Intl.Segmenter) return toast(T2('这个浏览器太旧，不支持自动分词', 'このブラウザは自動分割に対応していません'));
    out.innerHTML = `<div class="skel"><i></i><i></i></div>`;
    const list = (S.myTexts = (S.myTexts || []).filter(x => x.t !== text));
    list.unshift({ id: Date.now().toString(36), t: text, l: zh ? 'zh' : 'ja', at: Date.now() }); S.myTexts = list.slice(0, 20); save();
    if (zh) {
      const by = await zhIndex();
      out.innerHTML = `<div class="row between"><b>${T2('原文', '本文')}</b></div><div class="rd-text zh-line" lang="zh-CN">${readerHTMLZh(text, by)}</div>
        <p class="small muted">HSK の単語にピンインをつけています。点線の単語はタップで意味。</p>`;
      out.querySelectorAll('[data-zw]').forEach(el => { el.onclick = e => { e.stopPropagation(); if (!glossOK()) return; zhSheet(by[el.dataset.zw]); }; });
    } else {
      await loadJmdict().catch(() => {});
      const toks = readerTokensJa(text);
      out.innerHTML = `<div class="row between"><b>原文</b></div><div class="rd-text jp furi" lang="ja">${readerHTMLJa(text)}</div>
        <p class="small muted">词典里能查到的词标了读音、画了虚线，点一下看意思；读音按词典的原形推算，偶尔不准。 <a href="https://translate.google.com/?sl=ja&tl=zh-CN&text=${encodeURIComponent(text.slice(0, 1500))}&op=translate" target="_blank" rel="noopener">整段翻译 ↗</a></p>`;
      out.querySelectorAll('[data-i]').forEach(el => { el.onclick = e => { e.stopPropagation(); if (!glossOK()) return; const x = toks[+el.dataset.i]; showSheet(x.t, x.hit, null); }; });
    }
    out.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  p.querySelector('[data-rgo]').onclick = () => go(ta.value);
  p.querySelector('[data-paste]').onclick = async () => { try { ta.value = await navigator.clipboard.readText(); go(ta.value); } catch (e) { toast(T2('没有剪贴板权限，请长按输入框粘贴', 'クリップボードを読めませんでした。入力欄を長押しして貼りつけてください')); } };
  p.querySelectorAll('[data-open]').forEach(b => { b.onclick = () => { const x = (S.myTexts || []).find(y => y.id === b.dataset.open); if (x) { ta.value = x.t; go(x.t); } }; });
  p.querySelectorAll('[data-del]').forEach(b => { b.onclick = () => { S.myTexts = (S.myTexts || []).filter(y => y.id !== b.dataset.del); save(); render(); }; });
}

/* =====================================================================
   4. 收藏夹：单词、例句、语法、句子都能点 ☆ 收藏，集中复习、做成单词卡、导出 Anki
   ===================================================================== */
// favBtn(种类 w/s/g, 正文, 补充（读音或翻译）, 语言)
const favKey = (k, t) => k + '|' + t;
// 收藏夹里的日语：录音按读音（假名）找，不能用写法。单词用「写法|读音」，句子用收藏时存下的假名（y）；以前收藏的句子到例句、语法、今日一句里找
let FAV_KANA = null;
const favSay = f => {
  if (f.y) return f.y;
  if (f.k === 'w') { const r = (f.s || '').split(/\s/)[0]; return r && r !== f.t && /^[ぁ-ゟァ-ヿー・]+$/.test(r) ? `${f.t}|${r}` : f.t; }
  if (!FAV_KANA) {
    FAV_KANA = new Map();
    for (const rows of Object.values(typeof EXAMPLES !== 'undefined' && EXAMPLES || {})) for (const [jp, kana] of rows) if (!FAV_KANA.has(jp)) FAV_KANA.set(jp, kana);
    for (const gs of Object.values(typeof GRAM !== 'undefined' ? GRAM : {})) for (const g of gs) for (const e of g.eg || []) if (e.full && e.kana && !FAV_KANA.has(e.full)) FAV_KANA.set(e.full, e.kana);
    if (typeof DAILY !== 'undefined') for (const d of DAILY) { if (d[4] && d[5]) FAV_KANA.set(d[4], d[5]); if (d[0] && d[8]) FAV_KANA.set(d[0], d[8]); }
    if (!EXAMPLES) { const m = FAV_KANA; setTimeout(() => { if (FAV_KANA === m) FAV_KANA = null; }, 0); }   // 例句还没加载好：下次再建
  }
  return FAV_KANA.get(f.t) || f.t;
};
const isFav = (k, t) => (S.fav || []).some(f => favKey(f.k, f.t) === favKey(k, t));
const favBtn = (k, t, sub = '', l = 'ja', furi = '', say = '') => `<button class="speak fav ${isFav(k, t) ? 'on' : ''}" type="button" data-fav="${k}" data-ft="${esc(t)}" data-fs="${esc(sub)}" data-fl="${l}"${furi ? ` data-ff="${esc(furi)}"` : ''}${say ? ` data-fy="${esc(say)}"` : ''} aria-label="${T2('收藏', 'お気に入り')}">${isFav(k, t) ? '★' : '☆'}</button>`;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-fav]');
  if (!b) return;
  e.stopPropagation(); e.preventDefault();   // 放在折叠标题里时，点星星不展开
  const k = b.dataset.fav, t = b.dataset.ft;
  const list = S.fav = S.fav || [];
  const i = list.findIndex(f => favKey(f.k, f.t) === favKey(k, t));
  // 收藏例句时把它的假名（data-ff）一起存下来（f），收藏夹里就能标假名
  if (i >= 0) { list.splice(i, 1); toast(T2('已取消收藏', 'お気に入りから外しました')); }
  else { list.unshift(Object.assign({ k, t, s: b.dataset.fs, l: b.dataset.fl, at: Date.now() }, b.dataset.ff ? { f: b.dataset.ff } : {}, b.dataset.fy ? { y: b.dataset.fy } : {})); toast(T2('已收藏 ★', 'お気に入りに追加 ★')); buzz(10); }
  save();
  document.querySelectorAll(`[data-fav="${k}"]`).forEach(x => { if (x.dataset.ft === t) { x.classList.toggle('on', i < 0); x.textContent = i < 0 ? '★' : '☆'; } });
}, true);
let favFilter = '';
function viewFav() {
  const J = uiJa(), zh = isZh(), en = isEn(), lang = en ? 'en' : zh ? 'zh' : 'ja';
  const all = (S.fav || []).filter(f => (f.l || 'ja') === lang || (lang === 'ja' && !['zh', 'en'].includes(f.l)));
  const list = all.filter(f => !favFilter || f.k === favFilter);
  const name = { w: T2('单词', '単語'), s: T2('句子', '文'), g: T2('语法', '文法') };
  const p = h(`<section class="panel"><h2>★ ${T2('收藏夹', 'お気に入り')}</h2>
    <p class="muted">${T2('在单词卡片、例句、语法、读物旁边点 ☆ 就能收藏到这里。', '単語カード・例文・文法・読み物の ☆ をタップすると、ここに集まります。')}</p>
    <div class="row zh-cats"><button type="button" class="chip-btn ${favFilter ? '' : 'on'}" data-ff="">${T2('全部', 'すべて')} ${all.length}</button>${Object.entries(name).map(([k, n]) => `<button type="button" class="chip-btn ${favFilter === k ? 'on' : ''}" data-ff="${k}">${n} ${all.filter(f => f.k === k).length}</button>`).join('')}</div>
    ${list.length ? `<div class="fav-list">${list.map(f => `<div class="fav-item"><div><b lang="${zh ? 'zh-CN' : en ? 'en' : 'ja'}" class="${zh || en ? '' : 'furi'}">${zh || en ? esc(f.t) : f.f ? furiHTML(f.t, f.f) : f.k === 'w' && f.s && /^[ぁ-ゟァ-ヿー]+/.test(f.s) ? jrWord(f.t, f.s.split(/\s/)[0]) : jr(f.t)}</b>${f.s ? `<div class="small muted">${esc(f.s)}</div>` : ''}</div>
      <span class="tag">${name[f.k] || ''}</span>${f.k !== 'g' ? (zh ? sayBtn(f.t, 'zh-CN') : en ? sayBtn(f.t, 'en-US') : speakBtn(favSay(f))) : ''}${favBtn(f.k, f.t, f.s, f.l)}</div>`).join('')}</div>` : `<p class="small muted">${T2('还没有收藏。在单词卡、例句、今日一句旁边点 ☆ 就会出现在这里。', 'まだありません。単語カード・例文・今日のひとことの ☆ をタップすると、ここに集まります。')}</p><div class="row"><a class="btn pri" href="#${en ? 'en/words' : zh ? 'zh/words' : 'vocab'}">${T2('去单词表看看', '単語帳を開く')}</a></div>`}
    <div class="row" ${all.length ? '' : 'hidden'}><button class="btn pri" type="button" data-cards ${all.some(f => f.k === 'w') ? '' : 'disabled'}>${T2('收藏的单词做成卡片', '単語をカードで復習')}</button><button class="btn" type="button" data-commute ${all.some(f => f.k === 'w') ? '' : 'disabled'}>🎧 ${T2('通勤听', '通勤リスニングで聞く')}</button><button class="btn ghost" type="button" data-export ${all.length ? '' : 'disabled'}>${T2('导出 Anki', 'Anki に書き出す')}</button></div></section>`);
  p.querySelectorAll('[data-ff]').forEach(b => { b.onclick = () => { favFilter = b.dataset.ff; render(); }; });
  p.querySelector('[data-cards]').onclick = async () => {
    const ws = all.filter(f => f.k === 'w');
    if (en) {   // 英语：在各级词表里找到这些词，用英语的单词卡复习
      const all2 = (await Promise.all(EN_LV.map(L => enFetch(`en-${L}`).then(r => enItems(L, r)).catch(() => [])))).flat();
      const items = ws.map(f => all2.find(x => x.w === f.t)).filter(Boolean);
      if (items.length) enCards(items, T2('收藏的单词', 'お気に入りの単語')); return;
    }
    if (zh) { const by = await zhIndex(); const items = ws.map(f => by[f.t]).filter(Boolean); if (items.length) langCards(items.map(zhCard), T2('收藏的单词', 'お気に入りの単語'), 'zh'); return; }
    const ids = ws.map(f => wordIndex().get(f.t)).filter(Boolean).map(v => v.id);
    if (!ids.length) return toast('这些词不在 JLPT 词表里，暂时不能做成卡片');
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    startCards(host, ids, '收藏的单词', () => go('fav'));
  };
  p.querySelector('[data-commute]').onclick = () => { S.commute = Object.assign({}, S.commute, { src: 'fav' }); save(); go('commute'); };
  p.querySelector('[data-export]').onclick = () => {
    const rows = ['#separator:tab', '#html:false', `#deck:${BRAND} ${T2('收藏', 'お気に入り')}`, ...all.map(f => `${f.t.replace(/\t/g, ' ')}\t${(f.s || '').replace(/\t/g, ' ')}`)];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/tab-separated-values' })); a.download = `${BRAND}-favorites-${lang}.txt`; a.click();
  };
  main.append(p);
}

/* =====================================================================
   5. 离线下载录音：把一个级别的单词和例句录音存进浏览器，没网也能听
   ===================================================================== */
const AUDIO_CACHE = 'audio-v3';   // 和 sw.js 的 AUDIO 一样；换名字时旧缓存被清掉，下载记录也要清掉（下面 viewOffline）
function audioFilesFor(L) {
  if (isEn()) {   // 英语的录音在同一个域名下的音频仓库（koshokai.github.io/nihonggo-dojo-audio），service worker 一样能离线读
    return langAudioIdx('en').then(() => enFetch(`en-${L}`)).then(rows => { const idx = LANG_IDX_READY.en || {}; return [...new Set(enItems(L, rows).flatMap(x => [idx[x.w], idx[x.ex]]).filter(Boolean))]; });
  }
  if (isZh()) {
    return langAudioIdx('zh').then(() => zhHsk(zhLvNum(L))).then(list => { const idx = LANG_IDX_READY.zh || {}; return [...new Set(list.flatMap(x => [idx[x.w], idx[x.ex]]).filter(Boolean))]; });
  }
  const files = [];
  for (const v of VOCAB[L]) { files.push(AUDIO_IDX[v.r], AUDIO_IDX[v.w]); for (const e of (typeof EXAMPLES !== 'undefined' && EXAMPLES[v.w]) || []) files.push(AUDIO_IDX[e[1]], AUDIO_IDX[e[0]]); }
  return Promise.resolve([...new Set(files.filter(Boolean))]);
}
let offlineJob = null;
function viewOffline() {
  const J = uiJa(), zh = isZh(), en = isEn(), app = !!window.DOJO_APP;
  if (S.offlineCache !== AUDIO_CACHE) { S.offline = {}; S.offlineCache = AUDIO_CACHE; save(); }   // 录音缓存换过名字：以前下载的已经清掉了，要重新下载
  const lvs = zh ? ZH_LEVELS.map(x => x[0]) : en ? EN_LV : LEVELS, done = (S.offline = S.offline || {});
  const p = h(`<section class="panel"><h2>⬇ ${T2('离线录音', 'オフライン音声')}</h2>
    <p class="muted">${T2('把一个级别的单词和例句录音下载到这台设备，地铁里、没网的时候也能听。', 'レベルごとに単語と例文の音声をこの端末に保存します。電波のない場所でも聞けます。')}</p>
    ${app ? `<p class="small">${T2('App 版的离线下载正在准备中，目前请在浏览器版使用。', 'アプリ版は準備中です。現在はブラウザ版でご利用ください。')}</p>` : ''}
    <div class="off-list">${lvs.map(L => `<div class="off-row"><b>${L}</b><span class="small muted" data-st="${L}">${done[L] ? T2(`已下载 ${done[L]} 个`, `${done[L]} 件 保存済み`) : ''}</span><button class="btn ${done[L] ? 'ghost' : 'pri'}" type="button" data-dl="${L}" ${app ? 'disabled' : ''}>${done[L] ? T2('更新', '更新') : T2('下载', 'ダウンロード')}</button></div>`).join('')}</div>
    <div class="bar off-bar" hidden><i data-pbar style="width:0"></i></div><p class="small" data-pmsg></p>
    <div class="row"><span class="small muted" data-usage></span><button class="btn ghost" type="button" data-clear>${T2('删除全部离线录音', 'オフライン音声をすべて削除')}</button></div></section>`);
  main.append(p);
  const usage = () => navigator.storage && navigator.storage.estimate && navigator.storage.estimate().then(e => { const u = p.querySelector('[data-usage]'); if (u) u.textContent = T2(`本网站占用约 ${(e.usage / 1e6).toFixed(0)} MB`, `このサイトの使用量 約 ${(e.usage / 1e6).toFixed(0)} MB`); });
  usage();
  if (zh) langAudioIdx('zh');
  if (en) langAudioIdx('en');
  p.querySelectorAll('[data-dl]').forEach(b => {
    b.onclick = async () => {
      if (offlineJob) return toast(T2('正在下载，请稍等', 'ダウンロード中です'));
      if (!('caches' in window)) return toast(T2('这个浏览器不支持离线保存', 'このブラウザはオフライン保存に対応していません'));
      const L = b.dataset.dl;
      if (zh) await langAudioIdx('zh');
      if (en) await langAudioIdx('en');
      const files = await audioFilesFor(L);
      if (!files.length) return toast(T2('这个级别还没有录音', 'このレベルにはまだ音声がありません'));
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      const bar = p.querySelector('.off-bar'), pb = p.querySelector('[data-pbar]'), msg = p.querySelector('[data-pmsg]');
      bar.hidden = false; let n = 0, fail = 0; offlineJob = { stop: false };
      const cache = await caches.open(AUDIO_CACHE);
      const queue = files.slice();
      const worker = async () => {
        while (queue.length && !offlineJob.stop) {
          const f = queue.shift(), url = new URL(audUrl(f), location.href).href;
          try { if (!(await cache.match(url))) { const r = await fetch(url); if (r.ok) await cache.put(url, r); else fail++; } } catch (e) { fail++; }
          n++; if (n % 5 === 0 || !queue.length) { pb.style.width = (n / files.length * 100) + '%'; msg.textContent = T2(`${L}：${n} / ${files.length}`, `${L}：${n} / ${files.length}`); }
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      offlineJob = null; done[L] = n - fail; save();
      msg.textContent = fail ? T2(`完成，${fail} 个没下载成功，可以再点一次「更新」`, `完了（${fail} 件失敗。もう一度「更新」を押してください）`) : T2(`${L} 的录音已经可以离线听了 ✓`, `${L} の音声をオフラインで聞けます ✓`);
      const st = p.querySelector(`[data-st="${L}"]`); if (st) st.textContent = T2(`已下载 ${done[L]} 个`, `${done[L]} 件 保存済み`);
      usage();
    };
  });
  p.querySelector('[data-clear]').onclick = async () => {
    if (!await askConfirm(T2('删除全部离线录音？以后在线听时会重新下载。', 'オフライン音声をすべて削除しますか？'), T2('删除', '削除'), T2('取消', 'キャンセル'))) return;
    if ('caches' in window) await caches.delete(AUDIO_CACHE);
    S.offline = {}; save(); toast(T2('已删除', '削除しました')); render();
  };
}

/* =====================================================================
   全站搜索：顶部搜索框的下拉里，单词后面再列出语法、读物、课程、收藏（同步数据才搜，异步的用已经加载的）
   ===================================================================== */
function siteSearchHTML(q) {
  q = q.trim(); if (q.length < 1) return '';
  const low = q.toLowerCase(), hit = s => s && String(s).toLowerCase().includes(low);
  const out = [];
  if (isZh()) {
    const gr = window.__zhGrammar || [], rd = window.__zhRead || [];
    gr.filter(g => hit(g.p) || hit(g.title)).slice(0, 3).forEach(g => out.push(['文', g.title, g.p, `#zh/grammar/${g.id}`]));
    rd.filter(a => hit(a.title) || hit(a.title_ja)).slice(0, 2).forEach(a => out.push(['读', a.title_ja, a.title, `#zh/read/${a.id}`]));
  } else {
    for (const L of LEVELS) for (const g of GRAM[L]) if (out.length < 3 && (hit(g.p) || hit(g.m))) out.push(['文', g.p, `${L} · ${g.m}`, '#grammar']);
    if (typeof readList === 'function') readList().filter(a => hit(a.title) || hit(a.zh)).slice(0, 2).forEach(a => out.push(['读', a.title, a.zh, `#read/${a.id}`]));
    if (typeof COURSE_IDX !== 'undefined' && COURSE_IDX) COURSE_IDX.forEach(t => t.lessons.filter(l => !l.soon && hit(l.title)).slice(0, 2).forEach(l => out.push(['课', l.title, t.title, `#course/${t.id}/${l.id}`])));
  }
  (S.fav || []).filter(f => (f.l === 'zh') === isZh() && (hit(f.t) || hit(f.s))).slice(0, 3).forEach(f => out.push(['★', f.t, f.s, '#fav']));
  if (!out.length) return '';
  return `<div class="gs-sec small muted">${T2('站内其他内容', 'サイト内のほかの内容')}</div>` + out.map(([ic, t, sub, href]) => `<a class="gs-item gs-link" href="${esc(href)}"><span class="gs-ic">${ic}</span><span class="gs-w">${esc(t)}</span><span class="gs-m">${esc(sub || '')}</span></a>`).join('');
}

/* =====================================================================
   学习日历：最近 26 周的热力图，点一天看详情；连续记录断了可以用 100 经验补签（最近 2 天内、每周一次）
   ===================================================================== */
const REPAIR_COST = 100;
function viewCalendar() {
  const J = uiJa(), today = dkey();
  const days = S.days || {}, max = Math.max(S.goal, ...Object.values(days));
  const start = new Date(); start.setDate(start.getDate() - 7 * 26 + 1); start.setDate(start.getDate() - start.getDay());   // 从周日开始
  const cells = [];
  for (let d = new Date(start); dkey(d) <= today; d.setDate(d.getDate() + 1)) cells.push(dkey(d));
  const lvl = x => !x ? 0 : x >= S.goal * 2 ? 4 : x >= S.goal ? 3 : x >= S.goal / 2 ? 2 : 1;
  const studied = Object.keys(days).filter(k => days[k] > 0).length;
  const y = dkey(new Date(Date.now() - DAY)), y2 = dkey(new Date(Date.now() - 2 * DAY));
  const missed = [y, y2].find(d => !(days[d] > 0) && Object.keys(days).some(k => k < d && days[k] > 0));
  const lastRepair = S.repairAt || 0, canRepair = missed && Date.now() - lastRepair > 7 * DAY && (S.xp || 0) >= REPAIR_COST;
  const months = J ? ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'] : ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const p = h(`<section class="panel cal"><h2>📅 ${T2('学习日历', '学習カレンダー')}</h2>
    <div class="row cal-stat small"><span>${T2('学习天数', '学習日数')} <b>${studied}</b></span><span>${T2('连续', '連続')} <b>${streak()}</b> ${T2('天', '日')}</span><span>${T2('最长', '最長')} <b>${S.best || 0}</b> ${T2('天', '日')}</span></div>
    <div class="cal-wrap" data-noswipe><div class="cal-grid">${cells.map(d => `<button type="button" class="cal-d l${lvl(days[d])} ${d === today ? 'today' : ''} ${(S.repaired || {})[d] ? 'rep' : ''}" data-d="${d}" title="${d}" aria-label="${d} ${days[d] || 0} XP">${new Date(d + 'T12:00').getDay() === 0 && new Date(d + 'T12:00').getDate() <= 7 ? `<i>${months[new Date(d + 'T12:00').getMonth()]}</i>` : ''}</button>`).join('')}</div></div>
    <div class="row cal-legend small muted">${T2('少', '少')} <span class="cal-d l0"></span><span class="cal-d l1"></span><span class="cal-d l2"></span><span class="cal-d l3"></span><span class="cal-d l4"></span> ${T2('多', '多')}</div>
    <div data-info class="cal-info small"></div>
    ${missed ? `<div class="cal-repair"><b>${T2(`${missed.slice(5)} 断签了`, `${missed.slice(5)} が抜けています`)}</b><p class="small muted">${T2(`用 ${REPAIR_COST} 经验补签这一天，连续记录就能接上（每周一次）。`, `${REPAIR_COST} XP で補えば、連続記録がつながります（週 1 回まで）。`)}</p>
      <button class="btn pri" type="button" data-repair ${canRepair ? '' : 'disabled'}>${canRepair ? T2(`补签（-${REPAIR_COST} 经验）`, `補う（-${REPAIR_COST} XP）`) : (S.xp || 0) < REPAIR_COST ? T2('经验不够', 'XP が足りません') : T2('这周已经补过了', '今週は使用済み')}</button></div>` : ''}
  </section>`);
  main.append(p);
  const info = p.querySelector('[data-info]');
  p.querySelectorAll('[data-d]').forEach(b => {
    b.onclick = () => {
      p.querySelectorAll('.cal-d.on').forEach(x => x.classList.remove('on')); b.classList.add('on');
      const d = b.dataset.d, x = days[d] || 0, qs = (S.qstat || {})[d] || {};
      const qn = Object.values(qs).reduce((a, [n]) => a + n, 0), qok = Object.values(qs).reduce((a, [, ok]) => a + ok, 0);
      info.innerHTML = `<b>${d}</b>　${x ? T2(`${x} 经验`, `${x} XP`) : T2('没有学习', '学習なし')}${(S.goalDays || {})[d] ? ' · ✓ ' + T2('达成目标', '目標達成') : ''}${(S.repaired || {})[d] ? ' · ' + T2('补签', '補填') : ''}${qn ? ` · ${T2(`做题 ${qn} 道，对 ${qok} 道`, `問題 ${qn} 問・正解 ${qok} 問`)}` : ''}`;
    };
  });
  const tb = p.querySelector('.cal-d.today'); if (tb) { tb.click(); setTimeout(() => { const w = p.querySelector('.cal-wrap'); w.scrollLeft = w.scrollWidth; }, 50); }
  const rb = p.querySelector('[data-repair]');
  if (rb) rb.onclick = async () => {
    if (!await askConfirm(T2(`用 ${REPAIR_COST} 经验补签 ${missed}？`, `${REPAIR_COST} XP を使って ${missed} を補いますか？`), T2('补签', '補う'), T2('取消', 'キャンセル'))) return;
    S.xp -= REPAIR_COST; S.days[missed] = Math.max(1, S.days[missed] || 0); (S.repaired = S.repaired || {})[missed] = 1; S.repairAt = Date.now();
    S.best = Math.max(S.best || 0, streak()); save(); updateTop();
    toast(T2(`补签成功！现在连续 ${streak()} 天`, `補いました！ ${streak()} 日連続です`));
    if (typeof fxFireworks === 'function' && !fxCalm()) fxFireworks(1500);
    render();
  };
}

/* =====================================================================
   智能提醒：记下平时几点学习，提醒时间选「智能」时按习惯自动调整（每天最多同步一次）
   ===================================================================== */
function habitLog() {
  const d = new Date(), k = dkey(), hl = (S.habit = S.habit || {});
  if (hl.last === k + d.getHours()) return;   // 同一个小时只记一次
  hl.last = k + d.getHours();
  const hrs = (hl.h = hl.h || Array(24).fill(0));
  for (let i = 0; i < 24; i++) hrs[i] *= .97;   // 越近的习惯越重要
  hrs[d.getHours()] += 1 + d.getMinutes() / 120;   // 一小时里越晚开始，越该在这一小时提醒
  hl.min = Math.round(((hl.min || 30) * 4 + d.getMinutes()) / 5);
}
// 习惯的学习时间（至少记过 5 次才算数）；通常在整点前后开始的话，提前一小时提醒
function habitHour() {
  const hl = S.habit; if (!hl || !hl.h) return null;
  const sum = hl.h.reduce((a, b) => a + b, 0); if (sum < 5) return null;
  let best = 0; hl.h.forEach((v, i) => { if (v > hl.h[best]) best = i; });
  return (hl.min || 30) < 20 ? (best + 23) % 24 : best;
}
addEventListener('load', () => setTimeout(() => {
  if (!S.remindSmart || typeof pushEnable !== 'function') return;
  const target = habitHour();
  if (target == null || target === S.remindHour || (S.habit || {}).synced === dkey()) return;
  (S.habit = S.habit || {}).synced = dkey();
  pushSub().then(sub => { if (sub && Notification.permission === 'granted') return pushEnable(target).then(() => { S.remindHour = target; save(); }); }).catch(() => {});
}, 4000));

/* =====================================================================
   睡前复习：把今天学过、复习过、做错的词打包成一组小测验（傍晚以后出现在今日任务里）
   ===================================================================== */
function todayIds() {
  const t0 = startOfToday(), zh = isZh();
  const ids = Object.entries(S.srs).filter(([id, c]) => c && c.lr >= t0 && (zh ? id.startsWith('zh|w|') : !id.startsWith('zh|'))).map(([id]) => id);
  if (!zh) Object.entries(S.wrong || {}).forEach(([id, w]) => { if (w.t >= t0 && !ids.includes(id)) ids.push(id); });
  return ids;
}
async function todayReview() {
  const ids = shuffle(todayIds()).slice(0, 15);
  if (!ids.length) return toast(T2('今天还没学过单词', '今日はまだ単語を学習していません'));
  if (isZh()) {
    const by = await zhIndex(), list = ids.map(id => by[id.slice(5)]).filter(x => x && x.ja);
    const pool = Object.values(by).filter(x => x.ja && x.L === zhLvNum());
    const short = y => y.ja.split('；')[0];
    const qs = list.map(x => makeQ(x, 'meaning', sample(pool.filter(y => short(y) !== short(x)), 3).map(short), short(x), { prompt: `<div class="eyebrow">今日の単語</div><div class="q-big" ${ZHL}>${esc(x.w)}</div><div class="small muted">${esc(x.py)}</div>`, say: x.w, sayLang: 'zh-CN', explain: `<span ${ZHL}>${esc(x.w)}</span> ${esc(x.py)}：${esc(x.ja)}` }));
    return zhRunQuiz(qs, '🌙 寝る前の復習', 4, () => go('zh'));
  }
  const qs = ids.map(id => ITEMS[id]).filter(Boolean).map(it => it.type === 'k' ? qKanji(it) : it.w ? qVocab(it, sample(['meaning', 'reading', 'word'], 1)[0]) : null).filter(Boolean);
  if (!qs.length) return toast('今天学的是语法和句子，去单词卡里复习吧');
  main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
  runQuiz(host, qs, { title: '🌙 睡前复习', noRecord: true, xpEach: 4, onDone: r => { if (!r) return go('home'); quizSummary(host, r, { title: '🌙 睡前复习', again: todayReview }); } });
}
// 今日任务里的一项（日语、中文首页）：傍晚 5 点以后、今天学过 3 个词以上才出现
function nightTask() {
  if (new Date().getHours() < 17) return null;
  const n = todayIds().length, done = (S.nightDone || '') === dkey();
  if (n < 3) return null;
  return { ic: '夜', t: T2('睡前复习', '寝る前の復習'), d: done ? T2('今天复习过了', '今日はおさらいしました') : T2(`把今天学过的 ${n} 个词过一遍，3 分钟`, `今日学んだ ${n} 語をおさらい、3 分`),
    done, go: () => { S.nightDone = dkey(); save(); todayReview(); } };
}

// 学日语时，首页画完以后再在后台把阅读文章加载进来（「今日上新」卡片和搜索要用）；加载完如果还停在首页顶部就刷新一下
addEventListener('load', () => setTimeout(() => {
  if ((S.track || 'ja') === 'zh' || typeof needScripts !== 'function') return;
  needScripts(['reading.js', 'scenes.js']).then(() => {
    ['reading.js', 'scenes.js'].forEach(f => { LAZY_JS[f].done = true; });
    const v = (location.hash || '#home').slice(1);
    if ((v === 'home' || v === '') && scrollY < 40 && !document.body.classList.contains('focus') && !document.querySelector('.ask-mask, .word-sheet')) render();
  }).catch(() => {});
}, 2500));
