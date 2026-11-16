// 跟读：播放原音 → 录下自己的声音（可回放对比）→ 浏览器支持语音识别时，把识别结果和原句比对打分。
// 入口：任何带 data-shadow 的按钮（例句旁的麦克风），以及阅读 / 商务会话里的「跟读模式」。
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const MIC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>';
// lang：'ko' / 'en' 时用韩语、英语的朗读和语音识别（默认日语）
const shadowBtn = (jp, kana, zh, lang) => `<button class="speak mic" type="button" data-shadow data-jp="${esc(jp)}" data-kana="${esc(kana)}" data-zh="${esc(zh || '')}"${lang ? ` data-lang="${lang}"` : ''} aria-label="${tj('跟读', '発音チェック')}">${MIC_SVG}</button>`;

// 比对用：去掉标点空格，片假名转平假名
const normJa = s => toHira(String(s).replace(/[\s、。，．・「」『』（）()！？!?…ー〜～,.]/g, ''));
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const similarity = (a, b) => (!a.length && !b.length) ? 1 : 1 - editDistance(a, b) / Math.max(a.length, b.length);
// 原句里没被识别出来的字标出来（按最长公共子序列对齐）
function markMissing(orig, heard) {
  const a = [...orig], b = normJa(heard), n = a.length, m = b.length;
  const na = a.map(c => normJa(c));
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = na[i] && na[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0, j = 0, out = '';
  while (i < n) {
    if (!na[i]) { out += esc(a[i]); i++; continue; }          // 标点
    if (j < m && na[i] === b[j]) { out += esc(a[i]); i++; j++; }
    else if (j < m && L[i][j + 1] >= L[i + 1][j]) j++;
    else { out += `<span class="miss">${esc(a[i])}</span>`; i++; }
  }
  return out;
}

let shadowRec = null;
function shadowSheet(jp, kana, zh, lang) {
  const norm = !lang || lang === 'ja' ? normJa : s => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const tag = { ko: 'ko-KR', en: 'en-US', zh: 'zh-CN' }[lang] || 'ja-JP', ll = lang === 'zh' ? 'zh-CN' : lang || 'ja';
  const cjk = ll === 'ja' || ll === 'zh-CN';   // 汉字、假名逐字比对，标出没读出来的字
  closeSheet();
  const sh = h(`<div class="word-sheet shadow-sheet" role="dialog" aria-label="${tj('跟读', '発音チェック')}">
    <button class="ws-x" type="button" aria-label="${tj('关闭', '閉じる')}">×</button>
    <div class="eyebrow">${tj('跟读练习', '発音チェック')}</div>
    <div class="sh-jp" lang="${ll}">${esc(jp)}</div>
    ${kana && kana !== jp ? `<div class="small muted" lang="${ll}">${esc(kana)}</div>` : ''}
    ${zh ? `<div class="small">${esc(zh)}</div>` : ''}
    <div class="row sh-ctl">
      <button class="btn" type="button" data-orig>${SPEAK_SVG}<span>${tj('原音', 'お手本')}</span></button>
      <button class="btn pri" type="button" data-rec>${MIC_SVG}<span>${tj('开始跟读', '話してみる')}</span></button>
      <button class="btn" type="button" data-mine disabled>${SPEAK_SVG}<span>${tj('我的录音', '自分の声')}</span></button>
    </div>
    <div class="sh-pitch" data-pitch hidden><canvas width="600" height="170"></canvas><div class="small muted" data-pinfo></div></div>
    <div class="sh-res small muted">${SR ? tj('先听原音，再点「开始跟读」说一遍，说完点「停止」。', 'お手本を聞いてから「話してみる」を押して発音し、終わったら「停止」。') : tj('这个浏览器不支持语音识别，可以录音后和原音对比着听（Chrome、Edge、Safari 支持自动打分）。', 'このブラウザは音声認識に対応していません。録音してお手本と聞き比べてください（Chrome・Edge・Safari は自動採点に対応）。')}</div>
  </div>`);
  document.body.append(sh);
  const res = sh.querySelector('.sh-res'), recBtn = sh.querySelector('[data-rec]'), mineBtn = sh.querySelector('[data-mine]');
  let audioURL = null, stream = null, mr = null, rec = null, heard = '', active = false, denied = false;
  const say = () => ll === 'ja' ? speak(kana || jp) : speakLang(jp, tag);
  const stopAll = () => {
    active = false;
    try { rec && rec.stop(); } catch (e) { /* 忽略 */ }
    try { mr && mr.state !== 'inactive' && mr.stop(); } catch (e) { /* 忽略 */ }
    recBtn.querySelector('span').textContent = tj('再说一遍', 'もう一度'); recBtn.classList.remove('live');
  };
  const finish = () => {
    if (!SR || denied) return;   // 没有麦克风权限：留着权限提示，不要再盖成「没有听清楚」
    if (!heard) { res.innerHTML = tj('没有听清楚，请靠近麦克风再说一遍。', 'うまく聞き取れませんでした。マイクに近づいてもう一度どうぞ。'); return; }
    const target = norm(jp), targetK = ll === 'ja' ? norm(kana || jp) : target, got = norm(heard);
    const score = Math.round(Math.max(similarity(target, got), similarity(targetK, got)) * 100);
    const msg = score >= 90 ? tj('すごい！发音很清楚。', '很好！発音がとてもクリアです。') : score >= 70 ? tj('不错！再注意一下标红的部分。', 'いい感じ！赤い字に気をつけてもう一度。') : tj('多听几遍原音，跟着节奏再试一次。', 'お手本を何度か聞いて、リズムをまねしてもう一度。');
    res.innerHTML = `<div class="sh-score ${score >= 70 ? 'good' : ''}">${score}<small> ${tj('分', '点')}</small></div>
      <div>${tj('识别到', '認識結果')}：<span lang="${ll}">${esc(heard)}</span></div>
      <div>${tj('原句', 'お手本')}：<span lang="${ll}">${cjk ? markMissing(jp, heard) : esc(jp)}</span></div>
      <div class="muted">${msg}</div>`;
    if (score >= 70) addXP(3);
  };
  const start = async () => {
    if (active) return stopAll();
    stopSpeech();
    heard = ''; active = true; denied = false;
    recBtn.querySelector('span').textContent = tj('停止', '停止'); recBtn.classList.add('live');
    res.innerHTML = tj('请说……', 'どうぞ話してください……');
    try {
      stream = stream || await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      mr = new MediaRecorder(stream);
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = () => {
        if (audioURL) URL.revokeObjectURL(audioURL);
        const blob = new Blob(chunks, { type: mr.mimeType });
        audioURL = URL.createObjectURL(blob);
        mineBtn.disabled = false;
        // 音高曲线对比（pitch.js）：标准录音有就一起画
        if (typeof pitchCompare === 'function') {
          const ref = ll === 'ja' ? (AUDIO_IDX[kana] || AUDIO_IDX[jp]) : ((typeof LANG_IDX_READY !== 'undefined' && LANG_IDX_READY[tag.slice(0, 2)]) || {})[jp];
          pitchCompare(sh.querySelector('[data-pitch]'), blob, ref ? audUrl(ref) : null);
        }
        if (!SR) res.innerHTML = tj('录好了，点「我的录音」和原音对比着听。', '録音しました。「自分の声」でお手本と聞き比べましょう。');
      };
      mr.start();
    } catch (e) {
      if (!SR) { stopAll(); res.innerHTML = tj('没有麦克风权限。' + (window.DOJO_APP ? '请在 iPhone「设置 → 猫先生」里打开麦克风和语音识别。' : '请在浏览器地址栏旁允许使用麦克风。'), 'マイクの使用が許可されていません。' + (window.DOJO_APP ? 'iPhone の「設定 → 猫先生」でマイクと音声認識をオンにしてください。' : 'ブラウザの設定でマイクを許可してください。')); return; }
    }
    if (SR) {
      rec = new SR();
      rec.lang = tag; rec.interimResults = false; rec.maxAlternatives = 3;
      rec.onresult = e => {
        // 几个候选里取和原句最接近的
        const alts = [...e.results[0]].map(r => r.transcript);
        heard = alts.sort((a, b) => similarity(norm(jp), norm(b)) - similarity(norm(jp), norm(a)))[0] || '';
      };
      rec.onerror = e => { if (e.error === 'not-allowed') denied = true; if (e.error === 'not-allowed') res.innerHTML = tj('没有麦克风权限。' + (window.DOJO_APP ? '请在 iPhone「设置 → 猫先生」里打开麦克风和语音识别。' : '请在浏览器地址栏旁允许使用麦克风。'), 'マイクの使用が許可されていません。' + (window.DOJO_APP ? 'iPhone の「設定 → 猫先生」でマイクと音声認識をオンにしてください。' : 'ブラウザの設定でマイクを許可してください。')); };
      rec.onend = () => { if (active) stopAll(); finish(); };
      try { rec.start(); } catch (e) { /* 已经在识别 */ }
    }
    // 最长 12 秒自动停
    setTimeout(() => { if (active) stopAll(); }, 12000);
  };
  sh.querySelector('[data-orig]').onclick = say;
  recBtn.onclick = start;
  mineBtn.onclick = () => { if (audioURL) new Audio(audioURL).play(); };
  sh.querySelector('.ws-x').onclick = () => { stopAll(); closeSheet(); };
  shadowRec = () => { stopAll(); if (stream) stream.getTracks().forEach(t => t.stop()); };
  say();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-shadow]');
  if (b) { e.stopPropagation(); shadowSheet(b.dataset.jp, b.dataset.kana, b.dataset.zh, b.dataset.lang); }
}, true);
// 关掉面板或换页时释放麦克风
const _closeSheet = closeSheet;
closeSheet = function () { if (shadowRec) { shadowRec(); shadowRec = null; } _closeSheet(); };
