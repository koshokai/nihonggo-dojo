// 情景课程：校园生活、恋爱、打工、职场社交、留学生活，每个主题 12 课。
// 每课：场景和人物关系 → 语音对话（逐句播放 / 连续播放、假名、点词查词典、复制、跟读）→ 生词 → 句型 → 场合与语境 → 文化与为人处事 → 情景测验。
// 数据：lang/ja-course.json（目录）、lang/ja-course-<主题>.json（tools/build_course.py 生成，内容规范见 tools/course/SPEC.md）。
// 配音：audio/index-course.json（句子 id → mp3，tools/gen_audio.py course），没有的句子用浏览器朗读。
// 游客每个主题可以学第 1 课（guest.js）；带 vip 标记的课是将来的会员课，现在显示「即将开放」。
let COURSE_IDX = null, COURSE_AUD = null, COURSE_ALL = {};
const COURSE = {};
// 会员读完整版（member.js：服务器上的 member_content），其他人读网站上的样课版
const courseIdx = () => COURSE_IDX ? Promise.resolve(COURSE_IDX) : memberJson('ja', 'lang/ja-course.json').then(d => enApply('ja', 'ja-course.json', 'course', d)).then(d => (COURSE_IDX = d));   // 英语母语的用户换上英文（i18n.js enApply）
const courseTheme = id => COURSE[id] ? Promise.resolve(COURSE[id]) : memberJson('ja', `lang/ja-course-${id}.json`).then(d => enApply('ja', `ja-course-${id}.json`, 'course', d)).then(d => (COURSE[id] = d));
// 会员身份变了（登录、购买、到期）：重新加载
function courseReset() { COURSE_IDX = null; for (const k in COURSE) delete COURSE[k]; COURSE_AUD = null; COURSE_ALL = {}; }
// 会员课的录音：在服务器的私有存储里（member.js），打开这一课时取临时播放地址，填进 COURSE_AUD / COURSE_ALL
async function courseMemberAud(l) {
  if (!(typeof isMember === 'function' && isMember('ja')) || !l.lines || !COURSE_AUD || l.lines.every(x => COURSE_AUD[x.id])) return;
  const m = await memberData('ja', 'audio/ja-course.json');
  if (!m || !m.idx) return;
  const keys = [...l.lines.map(x => x.id), ...l.patterns.flatMap(pt => pt.eg.map(e => e[4]))].filter(k => m.idx[k]);
  const all = m.all && m.all[l.id];
  const url = await memberSign(keys.map(k => m.idx[k]).concat(all ? [all.f] : []));
  for (const k of keys) if (url[m.idx[k]]) COURSE_AUD[k] = url[m.idx[k]];
  if (all && url[all.f]) COURSE_ALL[l.id] = { f: url[all.f], t: all.t };
}
const courseAud = () => COURSE_AUD ? Promise.resolve(COURSE_AUD) : Promise.all([
  fetch(AUD + 'index-course.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
  fetch(AUD + 'index-course-all.json').then(r => r.ok ? r.json() : {}).catch(() => ({}))   // 每课整段对话一个文件 + 每句开始时间
]).then(([d, all]) => { COURSE_ALL = all; return (COURSE_AUD = d); });
const courseDone = id => (S.course || {})[id];
const COURSE_TYPE_IC = { 对话: '💬', 电话: '📞', LINE: '📱', 邮件: '✉️', 独白: '🎤' };
const courseNo = id => +id.split('-').pop();

function viewCourse(arg) {
  const [tid, lid] = (arg || '').split('/');
  const box = h('<section class="panel"><h2>情景课程</h2><div class="skel" aria-label="加载中" role="status"><i></i><i></i><i></i></div></section>');
  main.append(box);
  const fail = e => { box.innerHTML = `<h2>情景课程</h2><p class="muted">${/404/.test(e && e.message) ? '课程正在准备中，很快上线，敬请期待。' : '暂时打不开，请检查网络后再试。'}</p>`; };
  if (!tid) return courseIdx().then(list => box.replaceWith(courseHome(list))).catch(fail);
  if (!lid) return Promise.all([courseIdx(), courseTheme(tid)]).then(([, t]) => box.replaceWith(courseThemePage(t))).catch(fail);
  Promise.all([courseTheme(tid), courseAud()]).then(async ([t]) => {
    const l = t.lessons.find(x => x.id === lid);
    if (!l) return box.replaceWith(courseThemePage(t));
    await courseMemberAud(l).catch(() => {});
    if (!box.isConnected) return;
    box.replaceWith(courseLesson(t, l));
  }).catch(fail);
}

function courseHome(list) {
  const p = h(`<section class="panel"><h2>情景课程</h2>
    <p class="muted">在日本的校园、恋爱、打工、职场和生活里，日本人真的怎么说、为什么这样说、对方听了心里怎么想。每课一段语音对话，配生词、句型、场合讲解和情景测验。</p>
    <div class="course-grid">${list.map(t => {
      const n = t.lessons.filter(l => courseDone(l.id)).length;
      return `<a class="course-card" href="#course/${esc(t.id)}"><span class="course-ic">${esc(t.icon)}</span><div><b>${esc(t.title)}</b><div class="small muted">${esc(t.intro)}</div>
        ${n ? `<div class="small muted">已学 ${n} 课</div>` : ''}</div></a>`;
    }).join('')}</div></section>`);
  return p;
}

function courseThemePage(t) {
  const p = h(`<section class="panel">
    <a class="an-back" href="#course">← 全部主题</a>
    <h2>${esc(t.title)}</h2><p class="muted">${esc(t.intro)}</p>
    <div class="course-list">${t.lessons.map(l => {
      const locked = typeof isGuest === 'function' && isGuest() && courseNo(l.id) > 1;
      const d = courseDone(l.id);
      return `<a class="course-row has-vip ${d ? 'done' : ''}" href="#course/${esc(t.id)}/${esc(l.id)}">${courseNo(l.id) > 1 && !l.soon ? vipTag() : ''}
        <span class="course-no">${courseNo(l.id)}</span>
        <div class="course-t"><b>${esc(l.title)}</b><span class="small muted">${COURSE_TYPE_IC[l.type] || ''} ${esc(l.type)} · ${esc(l.lv)}</span></div>
        ${l.soon ? '<span class="tag">即将开放</span>' : l.vip ? '<span class="tag">会员</span>' : locked ? '<span class="tile-lock" title="注册后解锁">🔒</span>' : d ? '<span class="tag done">✓</span>' : l.id.endsWith('-01') && t.lessons.length === 1 ? '<span class="tag done">样课</span>' : ''}</a>`;
    }).join('')}</div>
    ${t.lessons.length === 1 && !(typeof isMember === 'function' && isMember('ja')) ? `<a class="panel wk-more" href="#vip"><div class="wk-more-t">✨ ${tj('这个主题后面还有更多课', 'このテーマにはまだ続きがあります')}</div><div class="small">${tj('同一个主人公的故事继续展开，难度一步步提高。', '同じ主人公の物語が続き、少しずつレベルアップしていきます。')}</div><div class="wk-more-go">${tj('加入会员即可学习', 'メンバーになると学べます')} ›</div></a>` : ''}</section>`);
  return p;
}

// 一句日语：汉字头上标假名，实词可以点开查词典（分词和假名位置由 build_course.py 对齐好）
function courseJP(x) {
  if (!x.toks) return furiHTML(x.jp, x.furi);
  const notes = (x.furi || '').split(',').map(s => s.match(/^(\d+)\.(\d+)(.*)$/)).filter(Boolean).map(m => [+m[1], +m[2], m[3]]);
  let pos = 0;
  return x.toks.map(t => {
    const s = pos, e = pos + t[0].length; pos = e;
    const f = notes.filter(([a, n]) => a >= s && a + n <= e).map(([a, n, r]) => `${a - s}.${n}${r}`).join(',');
    const inner = furiHTML(t[0], f);
    return t.length > 1 ? `<span class="wd" data-f="${esc(t.slice(1).concat(t[0]).join('|'))}">${inner}</span>` : inner;
  }).join('');
}

// 整课共用一个播放器：手机浏览器（尤其 iPhone）每次新建播放器都要重新缓冲，句子之间会卡；同一个播放器换音源就顺了
let courseAudioEl = null, courseSeq = 0;
const coursePlayer = () => courseAudioEl || (courseAudioEl = Object.assign(new Audio(), { preload: 'auto' }));
function courseStop() {
  if (courseAudioEl) { courseAudioEl.pause(); courseAudioEl.onended = courseAudioEl.ontimeupdate = courseAudioEl.onerror = null; }
  stopSpeech();
}
function coursePlay(x, onend) {
  courseStop();
  const file = S.voiceSrc !== 'tts' && COURSE_AUD && COURSE_AUD[x.id];
  if (!file) return speak(x.kana || x.jp, { onend });
  const a = coursePlayer(), fb = () => { a.onerror = null; speak(x.kana || x.jp, { onend }); };
  a.src = audUrl(file);
  a.playbackRate = Math.min(1.5, Math.max(0.5, S.rate + 0.2));
  a.onended = () => { if (onend) onend(); };
  a.onerror = fb;
  a.play().catch(fb);
}
const copyText = (text, msg = '已复制') => (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(msg), () => toast('复制失败，可以长按文字手动复制'));

function courseLesson(t, l) {
  const who = Object.fromEntries(l.who.map(w => [w.k, w]));
  const idx = t.lessons.indexOf(l), next = t.lessons[idx + 1];
  const keyset = new Map(l.words.map(([w, r, zh]) => [w, [w, r, zh]]));
  // 跟读、长按朗读等走通用 speak()：把这一课的配音也登记进去（按原文和假名都能找到）
  if (COURSE_AUD && typeof AUDIO_IDX !== 'undefined' && l.lines) {
    for (const x of l.lines) { const f = COURSE_AUD[x.id]; if (f) { AUDIO_IDX[x.jp] = AUDIO_IDX[x.jp] || f; if (x.kana) AUDIO_IDX[x.kana] = AUDIO_IDX[x.kana] || f; } }
    for (const pt of l.patterns) for (const [jp, kana, , , id] of pt.eg) { const f = COURSE_AUD[id]; if (f) { AUDIO_IDX[jp] = AUDIO_IDX[jp] || f; AUDIO_IDX[kana] = AUDIO_IDX[kana] || f; } }
  }
  if (l.soon || l.vip) {
    return h(`<section class="panel lock-panel"><a class="an-back" href="#course/${esc(t.id)}">← ${esc(t.title)}</a><div class="lock-ic" aria-hidden="true">✨</div>
      <h2>${esc(l.title)}</h2><p class="muted">${l.soon ? '这一课正在准备中，即将开放，敬请期待。先学学每个主题的第 1 课样课吧。' : '这一课是会员内容，加入会员即可学习。'}</p></section>`);
  }
  const p = h(`<article class="panel course-lesson">
    <a class="an-back" href="#course/${esc(t.id)}">← ${esc(t.title)}</a>
    <div class="row"><span class="tag lv">${esc(l.lv)}</span><span class="tag">${COURSE_TYPE_IC[l.type] || ''} ${esc(l.type)}</span><span class="small muted">第 ${idx + 1} 课</span></div>
    <h2>${esc(l.title)}</h2>
    <section class="cl-box"><h3>场景</h3><p>${jrNote(l.scene)}</p>
      <div class="cl-who">${l.who.map(w => `<div class="cl-person"><span class="cl-av v-${esc(w.v)}">${esc(w.k)}</span><div><b lang="ja">${esc(w.name)}</b><div class="small muted">${esc(w.role)}</div></div></div>`).join('')}</div>
      <p class="small cl-rel"><b>${tz('人物关系：', 'Relationship: ')}</b>${jrNote(l.relation)}</p></section>

    <h3>对话</h3>
    <div class="cl-ctrl">
      <button class="btn pri" type="button" data-all>${SPEAK_SVG}<span>连续播放</span></button>
      <label class="small"><input type="checkbox" data-kana checked> 假名</label>
      <label class="small"><input type="checkbox" data-zh checked> ${tz('中文', 'English')}</label>
      <button class="btn ghost small" type="button" data-copyall>复制全文</button>
    </div>
    <p class="small muted">点日语原文或 🔊 听这一句，点有下划线的词看释义和词典；「为什么这样说」里有讲解。</p>
    <div class="cl-lines">${l.lines.map((x, i) => {
      const w = who[x.k] || {};
      return `<div class="cl-line" data-i="${i}">
        <span class="cl-av v-${esc(w.v || 'F')}" title="${esc(w.name || '')}">${esc(x.k)}</span>
        <div class="cl-b">
          <div class="cl-name small muted" lang="ja">${esc(w.name || x.k)}</div>
          <div class="cl-jp furi" lang="ja">${courseJP(x)}</div>
          <div class="cl-zh small">${esc(x.zh)}</div>
          ${x.note ? `<details class="cl-note"><summary class="small">为什么这样说</summary><p class="small">${jrNote(x.note)}</p></details>` : ''}
          <div class="cl-acts"><button class="speak" type="button" data-cl-say="${i}" aria-label="播放这一句">${SPEAK_SVG}</button>${shadowBtn(x.jp, x.kana || '', x.zh)}<button class="speak" type="button" data-copy="${i}" aria-label="复制这一句" title="复制">⧉</button>${typeof reportBtn === 'function' ? reportBtn(x.jp, x.zh) : ''}</div>
        </div></div>`;
    }).join('')}</div>

    <h3>生词</h3>
    <div class="cl-words">${l.words.map(([w, r, zh, use]) => {
      const v = wordIndex().get(w);
      return `<div class="cl-word"><div class="row"><b lang="ja" class="cl-w furi" data-w="${esc(w)}" role="button" tabindex="0">${jrWord(w, r)}</b><span lang="ja" class="muted">${esc(r)}</span>${speakBtn(r === w ? w : r)}
        ${v && v.q ? `<button class="chip-btn" type="button" data-add="${esc(v.id)}">${S.srs[v.id] ? '已在单词卡' : '+ 单词卡'}</button>` : ''}</div>
        <div>${esc(zh)}</div><div class="small muted">${jrNote(use)}</div></div>`;
    }).join('')}</div>

    <h3>句型</h3>
    ${l.patterns.map(pt => `<section class="cl-pat"><div class="row"><b lang="ja">${esc(pt.p)}</b><span>${esc(pt.m)}</span></div>
      <div class="small"><b>接续：</b><span lang="ja" class="furi">${jrNote(pt.how)}</span></div>
      <p class="small">${jrNote(pt.why)}</p>
      ${pt.eg.map(([jp, kana, zh, f, id]) => `<div class="ex"><div style="flex:1;min-width:0"><div class="jp furi" lang="ja">${furiHTML(jp, f)}</div><div class="small muted">${esc(zh)}</div></div><button class="speak" type="button" data-egsay="${esc(id)}" data-kana="${esc(kana)}" data-jp="${esc(jp)}" aria-label="朗读例句">${SPEAK_SVG}</button><button class="speak" type="button" data-copytext="${esc(jp)}" aria-label="复制" title="复制">⧉</button></div>`).join('')}
    </section>`).join('')}

    <h3>场合与语境</h3>
    <div class="cl-ctx">
      <div class="cl-ctx-i ok"><b>这样用</b><p class="small">${jrNote(l.context.ok)}</p></div>
      <div class="cl-ctx-i ng"><b>别这样用</b><p class="small">${jrNote(l.context.ng)}</p></div>
      <div class="cl-ctx-i feel"><b>对方的心情</b><p class="small">${jrNote(l.context.feel)}</p></div>
    </div>

    <h3>文化与为人处事</h3>
    <div class="cl-culture">${jrNote(l.culture).replace(/\n/g, '<br>')}</div>

    <h3>情景测验</h3>
    <div class="cl-quiz"></div>
    <div class="row cl-next">${next ? `<a class="btn pri" href="#course/${esc(t.id)}/${esc(next.id)}">下一课：${esc(next.title)} →</a>` : `<a class="btn pri" href="#course">这个主题学完了，看看其他主题 →</a>`}</div>
  </article>`);

  // 对话：播放、连续播放、复制、显示开关
  const lineEl = i => p.querySelector(`.cl-line[data-i="${i}"]`);
  const mark = i => { p.querySelectorAll('.cl-line.on').forEach(x => x.classList.remove('on')); const el = lineEl(i); if (el) el.classList.add('on'); };
  const playOne = i => { const seq = ++courseSeq; mark(i); coursePlay(l.lines[i], () => { if (seq === courseSeq) mark(-1); }); };
  p.querySelectorAll('[data-cl-say]').forEach(b => { b.onclick = e => { e.stopPropagation(); playOne(+b.dataset.clSay); }; });
  // 只有点日语原文（没有下划线的部分）才播放这一句；点空白处、中文、按钮都不播
  p.querySelectorAll('.cl-line .cl-jp').forEach(el => {
    el.onclick = e => { if (e.target.closest('.wd')) return; playOne(+el.closest('.cl-line').dataset.i); };
  });
  const allBtn = p.querySelector('[data-all]');
  const allOff = () => { mark(-1); allBtn.classList.remove('on'); allBtn.querySelector('span').textContent = '连续播放'; };
  const follow = i => { const el = lineEl(i); if (el) el.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); };
  allBtn.onclick = () => {
    if (allBtn.classList.contains('on')) { ++courseSeq; courseStop(); allOff(); return; }
    const seq = ++courseSeq;
    allBtn.classList.add('on'); allBtn.querySelector('span').textContent = '停止';
    const whole = S.voiceSrc !== 'tts' && COURSE_ALL[l.id];
    if (whole) {
      // 整段对话一个文件，一口气播完；按每句的开始时间高亮当前这一句
      courseStop();
      const a = coursePlayer();
      let cur = -1;
      a.src = audUrl(whole.f);
      a.playbackRate = Math.min(1.5, Math.max(0.5, S.rate + 0.2));
      a.ontimeupdate = () => {
        if (seq !== courseSeq || !p.isConnected) { courseStop(); return; }
        let i = 0; while (i + 1 < whole.t.length && a.currentTime >= whole.t[i + 1] - 0.05) i++;
        if (i !== cur) { cur = i; mark(i); follow(i); }
      };
      a.onended = () => { if (seq === courseSeq) allOff(); };
      a.onerror = () => { if (seq === courseSeq) allOff(); };
      a.play().catch(() => allOff());
      return;
    }
    // 还没有整段文件时一句一句放（下一句提前加载）
    const go = i => {
      if (seq !== courseSeq || !p.isConnected) return;
      if (i >= l.lines.length) return allOff();
      mark(i); follow(i);
      const nx = l.lines[i + 1] && COURSE_AUD && COURSE_AUD[l.lines[i + 1].id];
      if (nx && !/^https?:/.test(nx)) fetch(audUrl(nx)).catch(() => {});
      coursePlay(l.lines[i], () => setTimeout(() => go(i + 1), 300));
    };
    go(0);
  };
  p.querySelectorAll('[data-copy]').forEach(b => { b.onclick = e => { e.stopPropagation(); const x = l.lines[+b.dataset.copy]; copyText(`${x.jp}\n${x.zh}`, '已复制这一句'); }; });
  p.querySelectorAll('[data-copytext]').forEach(b => { b.onclick = () => copyText(b.dataset.copytext); });
  p.querySelector('[data-copyall]').onclick = () => copyText(`${l.title}\n\n` + l.lines.map(x => `${(who[x.k] || {}).name || x.k}：${x.jp}\n（${x.zh}）`).join('\n'), '已复制整段对话');
  p.querySelector('[data-kana]').onchange = e => p.classList.toggle('hide-kana', !e.target.checked);
  p.querySelector('[data-zh]').onchange = e => p.classList.toggle('hide-zh', !e.target.checked);
  p.querySelectorAll('[data-egsay]').forEach(b => { b.onclick = () => coursePlay({ id: b.dataset.egsay, jp: b.dataset.jp, kana: b.dataset.kana }); });

  // 点词查词典（和阅读文章同一个释义面板，「查看详情」进内置词典）
  const art = { title: l.title, w: l.words.map(([w, r, zh]) => [w, r, zh]) };
  p.querySelectorAll('.cl-lines .wd').forEach(el => {
    el.onclick = e => { e.stopPropagation(); if (!glossOK()) return; const hit = lookupWord(el.dataset.f.split('|'), keyset); const [ws, wr] = wdText(el); showSheet(ws.replace(/\s+/g, ''), hit, art, wr.replace(/\s+/g, '')); el.classList.add('on'); };
  });
  p.querySelectorAll('.cl-w').forEach(el => {
    el.onclick = e => { e.stopPropagation(); if (!glossOK()) return; const w = el.dataset.w; showSheet(w, lookupWord([w], keyset), art); };
  });
  p.querySelectorAll('[data-add]').forEach(b => {
    b.onclick = () => { const id = b.dataset.add; if (S.srs[id]) return; S.srs[id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; save(); b.textContent = '已加入'; toast('已加入单词卡，今天就会复习'); };
  });

  courseQuiz(p.querySelector('.cl-quiz'), l);
  return p;
}

// 情景测验：选完马上看解释，全部做完记为学过这一课
function courseQuiz(box, l) {
  let i = 0, right = 0;
  const show = () => {
    if (i >= l.quiz.length) {
      const prev = courseDone(l.id);
      (S.course = S.course || {})[l.id] = { t: Date.now(), s: Math.max(right, prev ? prev.s : 0), n: l.quiz.length };
      if (typeof actLog === 'function') actLog('c', 'ja');   // 学习方案：今天上了一课情景会话
      if (!prev) addXP(20 + right * 5); else save();
      box.innerHTML = `<div class="cl-result"><b>答对 ${right} / ${l.quiz.length}</b><span class="small muted">${prev ? '这一课已经学过了，复习得很好。' : `这一课学完了，+${20 + right * 5} 经验。`}</span><button class="btn" type="button">再做一次</button></div>`;
      box.querySelector('button').onclick = () => { i = 0; right = 0; show(); };
      return;
    }
    const q = l.quiz[i];
    box.innerHTML = `<div class="small muted">${i + 1} / ${l.quiz.length}</div><p class="cl-q">${esc(q.q)}</p>
      <div class="an-opts">${q.opts.map((o, k) => `<button class="btn" type="button" data-k="${k}"><span lang="ja">${esc(o)}</span></button>`).join('')}</div><div data-why role="status" aria-live="polite"></div>`;
    box.querySelectorAll('[data-k]').forEach(b => {
      b.onclick = () => {
        const ok = +b.dataset.k === q.a;
        if (ok) right++;
        buzz(ok ? 12 : [30, 50, 30]);
        box.querySelectorAll('[data-k]').forEach(x => { x.disabled = true; if (+x.dataset.k === q.a) x.classList.add('pri'); });
        if (!ok) b.classList.add('danger');
        box.querySelector('[data-why]').innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}"><div class="fb-t"><b>${ok ? '答对了' : '再想想'}</b><div class="small">${jrNote(q.why)}</div></div></div>
          <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn pri" type="button" data-nx>${i + 1 < l.quiz.length ? '下一题' : '看结果'}</button></div>`;
        const nx = box.querySelector('[data-nx]');
        nx.onclick = () => { i++; show(); };
        requestAnimationFrame(() => nx.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }));
      };
    });
  };
  show();
}
