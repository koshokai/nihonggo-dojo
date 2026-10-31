// 听写：放一句真人感录音（VOICEVOX / MeloTTS / Kokoro），把听到的写下来，自动比对。日语、韩语、英语共用。
// 只用已经生成了音频的句子；日语可以写假名也可以写汉字，两种都算。
const DICT_SRC = { ex: '单词例句', anime: '动漫台词', daily: '今日一句' };

// 日语句子按假名标注换成全假名（「景気の悪化」→「けいきのあっか」），用来比对只写假名的答案
function furiReading(jp, furi) {
  const notes = (furi || '').split(',').map(x => x.match(/^(\d+)\.(\d+)(.*)$/)).filter(Boolean);
  let out = '', i = 0;
  for (const m of notes) { const s = +m[1], l = +m[2]; out += jp.slice(i, s) + m[3]; i = s + l; }
  return out + jp.slice(i);
}
const dictNorm = (s, tr) => {
  s = s.toLowerCase().replace(/[\s。、，．,.!！?？「」『』"'“”‘’…・~〜～\-—:;：；()（）]/g, '');
  return tr === 'ja' ? s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)) : s;
};

function dictPool(tr) {
  if (tr === 'ja') {
    const out = [];
    const L = S.level || 'N5';
    for (const v of VOCAB[L]) for (const [jp, kana, zh, furi] of (EXAMPLES || {})[v.w] || []) if (AUDIO_IDX[kana]) out.push({ src: 'ex', say: kana, jp, zh, furi, L });
    for (const g of GRAM[L]) for (const e of g.eg) if (AUDIO_IDX[e.kana]) out.push({ src: 'ex', say: e.kana, jp: e.full, zh: e.t, furi: e.furi, L });
    if (typeof DAILY !== 'undefined') for (const d of DAILY) if (AUDIO_IDX[d[8]]) out.push({ src: 'daily', say: d[8], jp: d[0], zh: d[2] });
    return animeLoad().then(list => {
      list.forEach(w => w.lines.forEach(l => { if (AUDIO_IDX[l.jp]) out.push({ src: 'anime', say: l.jp, jp: l.jp, zh: l.zh, furi: l.furi }); }));
      return out;
    }).catch(() => out);
  }
  const code = tr;
  return Promise.all([langAudioIdx(code), l2Fetch(tr, 'grammar').catch(() => []), l2Fetch(tr, 'reading').catch(() => []), l2Fetch(tr, 'daily').catch(() => [])]).then(([idx, gram, reads, daily]) => {
    const out = [], seen = new Set(), add = (s, zh, L, src) => { if (idx[s] && !seen.has(s)) { seen.add(s); out.push({ src, say: s, jp: s, zh, L }); } };
    gram.forEach(g => g.eg.forEach(([s, zh]) => add(s, zh, g.lv, 'ex')));
    reads.forEach(a => a.p.forEach(p => p.forEach(([s, zh]) => add(s, zh, a.lv, 'ex'))));
    daily.forEach(d => add(d[0], d[2], '', 'daily'));
    return out;
  });
}

function viewDictation(tr = 'ja') {
  const name = { ja: '日语', ko: '韩语', en: '英语' }[tr];
  const box = h(`<section class="panel"><h2>听写</h2><div class="skel" aria-label="加载中" role="status"><i></i><i></i><i></i></div></section>`);
  main.append(box);
  const o = ((S.dictOpt = S.dictOpt || {})[tr] = Object.assign({ src: 'ex', lv: tr === 'ja' ? '' : LV_NAMES[tr][0] }, (S.dictOpt || {})[tr]));
  dictPool(tr).then(all => {
    if (!box.isConnected) return;
    const srcs = Object.keys(DICT_SRC).filter(k => all.some(x => x.src === k));
    if (srcs.length && !srcs.includes(o.src)) o.src = srcs[0];   // 还没有录音的来源先跳过
    const pool = all.filter(x => x.src === o.src && (tr === 'ja' || o.src !== 'ex' || !o.lv || x.L === o.lv));
    const p = h(`<section class="panel">
      <div class="row between"><h2>听写 · ${name}</h2>${tr === 'ja' ? levelSeg(S.level) : ''}</div>
      <p class="small muted">听一句，把听到的写下来，写完自动比对。${tr === 'ja' ? '写平假名、片假名或汉字都可以。' : '大小写和标点不算错。'}没听清可以再放一遍或放慢。</p>
      <div class="seg" role="group">${srcs.map(k => `<button type="button" data-src="${k}" class="${o.src === k ? 'on' : ''}">${DICT_SRC[k]}</button>`).join('')}</div>
      ${tr !== 'ja' && o.src === 'ex' ? `<div class="seg" role="group">${LV_NAMES[tr].map(l => `<button type="button" data-lv="${l}" class="${o.lv === l ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
      <div class="row between"><span class="small muted">可练的句子 <b>${pool.length}</b> 句</span><button class="btn pri" type="button" data-dict-go ${pool.length ? '' : 'disabled'}>开始 10 句</button></div>
      ${pool.length ? '' : '<p class="small muted">这一类句子的录音还在生成中，先换一个来源试试。</p>'}
    </section>`);
    if (tr === 'ja') bindLevel(p);
    p.querySelectorAll('[data-src]').forEach(b => { b.onclick = () => { o.src = b.dataset.src; save(); render(); }; });
    p.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => { o.lv = b.dataset.lv; save(); render(); }; });
    const go = p.querySelector('[data-dict-go]');
    if (go) go.onclick = () => dictSession(sample(pool, 10), tr);
    box.replaceWith(p);
  });
}

function dictSession(items, tr) {
  main.innerHTML = '';
  const box = h('<section class="panel tr-card"></section>');
  main.append(box);
  let i = 0, right = 0;
  const play = (x, slow) => {
    if (tr === 'ja') speak(x.say, slow ? { rate: .6 } : {});
    else { const r = S.rate; if (slow) S.rate = .5; speakLang(x.say, TRACKS[tr].tts); S.rate = r; }
  };
  const show = () => {
    if (i >= items.length) {
      box.innerHTML = `<h2>听写完成</h2><p>${items.length} 句里写对 ${right} 句。</p><div class="row"><button class="btn pri" type="button" data-more>再来 10 句</button><a class="btn" href="#${tr === 'ja' ? 'ri' : tr + '/ri'}">返回</a></div>`;
      box.querySelector('[data-more]').onclick = () => { main.innerHTML = ''; viewDictation(tr); };
      addXP(right * 4 + (items.length - right));
      return;
    }
    const x = items[i];
    box.innerHTML = `<div class="row between small muted"><span>${i + 1} / ${items.length}</span><span>${DICT_SRC[x.src]}</span></div>
      <div class="row dict-play"><button class="btn pri big" type="button" data-play>${SPEAK_SVG}<span>播放</span></button><button class="btn" type="button" data-slow>慢速</button></div>
      <textarea class="tr-input" rows="2" lang="${tr}" placeholder="把听到的写下来"></textarea>
      <div class="row"><button class="btn pri" type="button" data-check>对答案</button><button class="btn ghost" type="button" data-skip>听不出来，看答案</button></div>
      <div class="tr-ans" hidden></div>`;
    const ta = box.querySelector('textarea');
    box.querySelector('[data-play]').onclick = () => play(x);
    box.querySelector('[data-slow]').onclick = () => play(x, true);
    setTimeout(() => play(x), 300);
    const check = give => {
      const mine = ta.value.trim();
      const targets = [x.jp]; if (tr === 'ja' && x.furi) targets.push(furiReading(x.jp, x.furi));
      const score = give || !mine ? 0 : Math.max(...targets.map(t => trSimilar(dictNorm(mine, tr), dictNorm(t, tr))));
      const ok = score >= 90;
      if (ok) right++;
      const ans = box.querySelector('.tr-ans');
      ans.hidden = false;
      ans.innerHTML = `<div class="${ok ? 'tag done' : 'tag'}">${give ? '没关系，看看原文' : ok ? `写对了（${score}%）` : `相似度 ${score}%`}</div>
        <div class="tr-ref ${tr === 'ja' ? 'furi' : ''}" lang="${tr}">${tr === 'ja' ? furiHTML(x.jp, x.furi) : esc(x.jp)}</div>
        <div class="small muted">${esc(x.zh)}</div>
        <div class="row"><button class="btn pri" type="button" data-next>下一句</button></div>`;
      box.querySelector('[data-check]').parentElement.remove();
      ans.querySelector('[data-next]').onclick = () => { i++; show(); };
    };
    box.querySelector('[data-check]').onclick = () => check(false);
    box.querySelector('[data-skip]').onclick = () => check(true);
    setTimeout(() => ta.focus(), 50);
  };
  show();
}
