// 中国語（日本用户学中文）。界面全部日语；中文内容一律标 lang="zh-CN"（用中国大陆字形显示）。
// 数据由 tools/build_zh.py 生成：lang/zh-hsk1..6.json、zh-pinyin.json、zh-read.json、zh-course*.json
// 路由：#zh 首页 · #zh/pinyin 拼音和声调 · #zh/words 单词（HSK）· #zh/read 读物 · #zh/course 场景会话 · #zh/dict 辞书 · #zh/study 学习入口
const ZH_LEVELS = [['HSK1', '入門', 'あいさつ・数字・家族'], ['HSK2', '初級', '買い物・道案内'], ['HSK3', '初級〜中級', '日常会話'], ['HSK4', '中級', '仕事・旅行の会話'], ['HSK5', '中上級', 'ニュース・文章'], ['HSK6', '上級', '新聞・専門的な話題']];
const ZH_NAV = { home: 'home', placement: 'study', path: 'study', study: 'study', pinyin: 'study', words: 'study', course: 'study', biz: 'study', exam: 'exam', grammar: 'study', dict: 'study', trans: 'study', read: 'ri', listen: 'ri', dictation: 'ri', ri: 'ri' };
const ZH_CAT = { history: ['歴史・文化', '史'], city: ['都市めぐり', '都'], food: ['グルメ・屋台', '食'], tech: ['今どきの中国', '技'], life: ['人と暮らし', '人'], classic: ['漢詩・成語', '詩'] };
const zhLevel = () => S.zhLevel || 'HSK1';
const zhLvNum = (L = zhLevel()) => +String(L).replace(/\D/g, '') || 1;
const ZHL = 'lang="zh-CN"';
const zhSay = text => speakLang(text, 'zh-CN');
const zhSayBtn = text => sayBtn(text, 'zh-CN');

/* ---------- 数据 ---------- */
const ZH = { hsk: {}, py: null, read: null, course: null, theme: {} };
const zhFetch = url => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
function zhHsk(n) {
  // HSK4–6 的例句是会员内容：会员读服务器上的完整版（member.js），其他人读网站上的（没有例句）
  return ZH.hsk[n] || (ZH.hsk[n] = (n >= 4 && typeof memberJson === 'function' ? memberJson('zh', `lang/zh-hsk${n}.json`) : zhFetch(`lang/zh-hsk${n}.json`)).then(rows => rows.map(r => ({
    id: 'zh|w|' + r[0], w: r[0], py: r[1], ja: r[2] || r[7], ex: r[3], expy: r[4], exja: r[5], note: r[6], en: r[7], trad: r[8], cl: r[9], L: n
  }))).catch(e => { delete ZH.hsk[n]; throw e; }));
}
// HSK 以外の常用語（辞書用、lang/zh-dict.json：[単語, ピンイン, 日本語]）。L は 7（HSK の外）
const zhDictExt = () => ZH.ext || (ZH.ext = zhFetch('lang/zh-dict.json').then(rows => rows.map(([w, py, ja]) => ({ id: 'zh|w|' + w, w, py, ja, L: 7, ext: 1 }))).catch(() => []));
const zhAllWords = () => Promise.all([1, 2, 3, 4, 5, 6].map(zhHsk)).then(a => a.flat());
const zhDictWords = () => Promise.all([zhAllWords(), zhDictExt()]).then(([a, b]) => { const seen = new Set(a.map(x => x.w)); return a.concat(b.filter(x => !seen.has(x.w))); });
let ZH_BY = null;   // 词 → 词条
const zhIndex = () => zhAllWords().then(all => { if (!ZH_BY) { ZH_BY = {}; all.forEach(x => { if (!ZH_BY[x.w]) ZH_BY[x.w] = x; }); } return ZH_BY; });
const zhPy = () => ZH.py || (ZH.py = zhFetch('lang/zh-pinyin.json'));
// 会员：读物、听力加上服务器上的会员篇目（member.js；带 m: 1），课程读完整版
const zhPlus = (pub, mem) => Promise.all([pub, memberData('zh', mem).catch(() => null)]).then(([a, b]) => b ? a.concat(b.filter(x => !a.some(y => y.id === x.id))) : a);
// 写真（Wikimedia Commons、lang/zh-photos.json：id → [画像, 作者, ライセンス, 元ページ]）は読み物データとは別に読み込んで合わせる
const zhRead = () => ZH.read || (ZH.read = Promise.all([zhPlus(zhFetch('lang/zh-read.json').catch(() => []), 'lang/zh-read-member.json'), fetch('lang/zh-photos.json').then(r => r.ok ? r.json() : {}).catch(() => ({}))])
  .then(([d, ph]) => { d.forEach(a => { if (ph[a.id]) a.ph = ph[a.id]; }); return (window.__zhRead = d); }));
const zhArtImg = a => a.ph ? `<img class="rc-photo" src="${esc(a.ph[0])}" alt="${esc(a.title_ja || '')}" loading="lazy" decoding="async">` : '';
const zhPhotoCredit = a => a.ph ? `<div class="ph-credit small muted">写真：${esc(a.ph[1])} · ${esc(a.ph[2])} · <a href="${esc(a.ph[3])}" target="_blank" rel="noopener">Wikimedia Commons</a></div>` : '';
const zhListen = () => ZH.listen || (ZH.listen = zhPlus(zhFetch('lang/zh-listen.json').catch(() => []), 'lang/zh-listen-member.json'));
// HSK3 以上的语法：网站上每项 1 句例句，会员读全部（member.js）
const zhGrammar = () => ZH.grammar || (ZH.grammar = memberJson('zh', 'lang/zh-grammar.json').catch(() => []).then(d => (window.__zhGrammar = d)));
const zhDaily = () => ZH.daily || (ZH.daily = zhFetch('lang/zh-daily.json').catch(() => []));
const zhCourse = () => ZH.course || (ZH.course = memberJson('zh', 'lang/zh-course.json').catch(() => []));
const zhTheme = id => ZH.theme[id] || (ZH.theme[id] = memberJson('zh', `lang/zh-course-${id}.json`).catch(e => { delete ZH.theme[id]; throw e; }));
// 卡片 → 学习情况
const zhCard = x => ({ id: x.id, t: x.w, pr: x.py, zh: x.ja, ex: x.ex ? [x.ex, x.exja, x.expy] : null, note: x.note });
const zhKnown = list => list.filter(x => S.srs[x.id] && S.srs[x.id].r > 0).length;
const zhDueIds = () => Object.keys(S.srs).filter(id => id.startsWith('zh|w|') && S.srs[id].due <= Date.now());
// 对战用（duel.js）：当前级别的词（已加载时）
let ZH_DUEL = {};
function zhDuelPool(L) {
  const n = zhLvNum(L);
  if (!ZH_DUEL[n]) { ZH_DUEL[n] = []; zhHsk(n).then(list => { ZH_DUEL[n] = list.filter(x => x.ja && x.ja.length <= 24).map(x => ({ id: x.id, w: x.w, r: x.py, m: x.ja.split('；')[0], q: true })); }).catch(() => {}); }
  return ZH_DUEL[n];
}
addEventListener('load', () => { if (S.track === 'zh') setTimeout(() => { zhDuelPool(zhLevel()); zhGrammar(); zhRead(); }, 1500); });

function zhLevelMenu() {
  askSheet('目標の級を選んでください（あとでいつでも変更できます）', [...ZH_LEVELS.map(([L, n, c]) => [L, `${L}　${n}・${c}`, L === zhLevel() ? 'pri' : '']), [null, 'キャンセル']]).then(v => {
    if (!v) return;
    S.zhLevel = v; save(); toast(`${v} に変更しました`); render();
  });
}

/* ---------- 游客：注册前能用的范围 ---------- */
const zhGuest = () => typeof isGuest === 'function' && isGuest();
function zhLocked(what) {
  const p = h(`<section class="panel"><h2>${esc(what)}</h2><p class="muted">無料の会員登録で、すべての単語・読み物・会話レッスンが使えるようになります。学習の記録もクラウドに保存されます。</p>
    <div class="row"><button class="btn pri" type="button" data-s>無料で登録</button><a class="btn" href="#zh">今日に戻る</a></div></section>`);
  p.querySelector('[data-s]').onclick = e => { e.stopPropagation(); authScreen('signup'); };
  main.append(p);
}

/* ---------- 入口 ---------- */
function viewZh(sub = '') {
  if (S.track !== 'zh') { S.track = 'zh'; save(); }
  const [a, b, c] = sub.split('/');
  if (a === 'pinyin') return zhPinyinPage();
  if (a === 'words') return zhWordsPage(b);
  if (a === 'read') return b ? zhArticle(b) : zhReadList();
  if (a === 'course') return b ? zhLesson(b, c) : zhCourseList();
  if (a === 'dict') return zhDictPage(main);
  if (a === 'listen') return zhListenPage();
  if (a === 'path') return zhPathPage(b);
  if (a === 'placement') return zhPlacement();
  if (a === 'grammar') return b && b.startsWith('zg-') ? zhGrammarItem(b) : zhGrammarPage(b);
  if (a === 'biz') return zhBizPage(b, c);
  if (a === 'exam' && typeof exam2Page === 'function') return exam2Page('zh', b);   // HSK 模拟考（exam2.js）
  if (a === 'week') return w2Page('zh', b);   // 今週のピックアップ（week2.js）
  if (a === 'dictation') return p2Setup('zh', 'dict');   // 听写、翻译练习（practice2.js）
  if (a === 'trans') return p2Setup('zh', 'trans');
  if (a === 'ri') return main.append(typeof riHub === 'function' ? riHub('zh') : zhRIHub());   // 新排版：hub.js
  if (a === 'study') return main.append(typeof studyHubLang === 'function' ? studyHubLang('zh') : zhHub());
  return zhHome();
}
const zhLoading = () => h('<section class="panel"><div class="skel" aria-label="読み込み中" role="status"><i></i><i></i><i></i></div></section>');
const zhFail = el => { el.innerHTML = '<p class="muted">読み込めませんでした。通信状況を確認して、もう一度開いてください。</p>'; };

// 「学ぶ」の項目（読む・聴く、試験はそれぞれ下のタブにあるのでここには入れない；日本語コースの「学习」と同じ分け方）
function zhTiles() {
  return [['#zh/path', '关', '学習ルート', '少しずつクリアして HSK を制覇'], ['#check', '测', 'レベルチェック', '今の実力と伸びをチェック'], ['#zh/pinyin', 'pīn', 'ピンイン・声調', '発音の基本と四声トレーニング'], ['#zh/words', '词', '単語帳', 'HSK 1〜6級の単語カード'], ['#zh/grammar', '文', '文法', 'HSK 1〜6級の文型と例文'],
    ['#zh/course', '话', '場面別会話', '旅行・食事・仕事・友達'], ['#zh/biz', '商', 'ビジネス中国語', 'メール・WeChat・ビジネス単語'], ['#zh/trans', '译', '翻訳トレーニング', '日本語⇄中国語を訳して自己採点'], ['#zh/dict', '辞', '辞書', '単語・例文をすばやく検索'], ['#duel', '战', '対戦', '同じ問題で早押しバトル'], ['#fav', '★', 'お気に入り', '保存した単語・文・文法'], ['#buddy', '伴', '学習仲間', '一緒に続ける・つつく']];
}
function zhRIHub() {
  const p = h('<section class="panel"><h2>読む・聴く</h2></section>');
  p.append(tileGrid([['#zh/read', '读', '読み物', '歴史・都市・グルメ・今どき中国'], ['#zh/listen', '听', 'リスニング', 'HSK 1〜6級の会話・アナウンス'], ['#zh/dictation', '写', 'ディクテーション', '1 文聞いて書き取る'], ['#commute', '通', '通勤リスニング', '画面を見ずに聞き流し']]));
  return p;
}
function zhHub() {
  const p = h('<section class="panel"><h2>学ぶ</h2></section>');
  p.append(tileGrid(zhTiles()));
  return p;
}

/* ---------- 首页 ---------- */
function zhHome() {
  const box = zhLoading(); main.append(box);
  const n = zhLvNum();
  Promise.all([zhHsk(n), zhRead(), zhDaily()]).then(([list, arts, daily]) => {
    if (!box.isConnected) return;
    const day = ((S.zhTask = S.zhTask || {})[dkey()] = S.zhTask[dkey()] || {});
    Object.keys(S.zhTask).filter(k => k < dkey(new Date(Date.now() - 14 * DAY))).forEach(k => delete S.zhTask[k]);
    const due = zhDueIds(), fresh = list.filter(x => !S.srs[x.id]).slice(0, S.newPerDay || 10);   // 1日の新しい単語の数（設定）
    const art = arts.find(a => a.lv === zhLevel() && !(S.zhRead || {})[a.id]) || arts.find(a => !(S.zhRead || {})[a.id]) || arts[0];
    const hr = new Date().getHours();
    const frag = document.createDocumentFragment();
    const hiEl = homeHi(hr < 11 ? '早上好！ おはようございます' : hr < 18 ? '你好！ こんにちは' : '晚上好！ こんばんは', '1 日 10 分。下のタスクをこなせば今日は OK！', todayXP(), streak(), `${zhLevel()} · 覚えた ${zhKnown(list)} · 復習 ${due.length}`);
    const tasks = [
      { ic: '復', t: '復習', d: due.length ? `${due.length} 枚のカードが復習の時間です` : '復習するカードはありません', done: !due.length, go: () => zhReview() },
      (() => {   // 学習ルートの次のステージ（新しい単語 → テスト）
        const st = (S.zhPath || {})[n] || {}, stages = Math.ceil(list.length / 10);
        const i = Array.from({ length: stages }, (_, k) => k).find(k => !st[k]);
        return i == null ? { ic: '新', t: 'この級をすべてクリア！', d: '上の級に進むか、学習ルートで★3 を目指そう', done: true }
          : { ic: '关', t: `学習ルート · ステージ ${i + 1}`, d: list.slice(i * 10, i * 10 + 10).map(x => x.w).slice(0, 5).join('・') + '…', dl: 'zh-CN', done: !!day.n, go: () => { if (zhStageVip(i)) return go(`zh/path/HSK${n}`); day.n = 1; save(); zhStage(n, i, list); } };
      })(),
      n <= 2 ? { ic: '声', t: '声調トレーニング', d: '音を聞いて四声を当てる 10 問', done: !!day.t, go: () => { day.t = 1; save(); zhToneQuiz(); } }
        : { ic: '測', t: `${zhLevel()} 単語テスト`, d: '意味を選ぶ 10 問', done: !!day.q, go: () => { day.q = 1; save(); zhWordQuiz(list); } },
      typeof weakTask === 'function' ? weakTask('zh') : null,   // 弱点トレーニング（weak.js）
      typeof nightTask === 'function' ? nightTask() : null,   // 夕方以降：寝る前の復習（conv.js）
      art ? { ic: '読', t: '今日の読み物', d: `${art.title_ja}（${art.lv}）`, done: !!day.r || !!(S.zhRead || {})[art.id] && day.r, go: () => { day.r = 1; save(); location.hash = `zh/read/${art.id}`; } } : null
    ].filter(Boolean);
    // 今日のひとこと：日本語コースと同じく 1 年 366 句、日付（うるう年の何日目）で決まる
    // [中国語, ピンイン, 日本語, 解説, 分類, 例文, 例文ピンイン, 例文の訳]
    let dailyEl = null;
    if (daily.length) {
      const day = new Date(); day.setHours(12, 0, 0, 0);
      const d = daily[(daily.length >= 366 ? dailySlot(day) : Math.floor(Date.now() / DAY)) % daily.length];
      const ex = d[5] ? `<div class="ex"><div style="flex:1;min-width:0"><div ${ZHL}>${zhTap(d[5])}</div><div class="zh-py">${esc(d[6] || '')}</div><div class="small muted">${esc(d[7] || '')}</div></div>${exSayBtn(d[5], 'zh-CN')}</div>` : '';
      dailyEl = h(`<div class="proverb daily zh-daily2">
        <div class="row between"><span class="row"><span class="eyebrow">今日のひとこと</span>${d[4] ? `<span class="tag">${esc(d[4])}</span>` : ''}<span class="small muted">${day.getMonth() + 1}月${day.getDate()}日</span></span></div>
        <div class="row"><span class="zh-daily-zh" ${ZHL}>${zhTap(d[0])}</span><span class="row daily-btns">${zhSayBtn(d[0])}${shadowBtn(d[0], d[1], d[2], 'zh')}</span></div>
        <div class="zh-py">${esc(d[1])}</div><b>${esc(d[2])}</b>
        ${dailyMore(`${d[3] ? `<span class="small muted">${esc(d[3])}</span>` : ''}${ex}`, '解説と例文')}</div>`);
    }
    // 今日の読み物（写真つき）：日本語・英語のホームと同じく、いちばん上に
    const artEl = art && !(S.zhRead || {})[art.id] ? h(`<a class="today-art ${art.ph ? '' : 'no-img'}" href="#zh/read/${art.id}">${art.ph ? `<div class="ta-img">${zhArtImg(art)}</div>` : ''}<div><span class="tag done">今日の読み物</span> <span class="tag lv">${esc(art.lv)}</span><div class="rc-title" ${ZHL}>${esc(art.title)}</div><div class="small muted">${esc(art.title_ja || '')}</div></div></a>`) : null;
    const rv = typeof planReviewCard === 'function' && planReviewCard();   // 学習プランの週ふりかえり（日曜）
    frag.append(homeHead(hiEl, artEl, dailyEl), ...(rv ? [rv] : []), typeof planTaskPanel === 'function' ? planTaskPanel('zh', '今日のタスク', tasks, '終わったら自由に', { list }) : taskPanel('今日のタスク', tasks, '終わったら自由に'));
    if (typeof w2Card === 'function') frag.append(w2Card('zh'));   // 今週のピックアップはタスクの下に
    if (typeof buddyStrip === 'function') frag.append(buddyStrip());
    // 進み具合・学習記録・スタンプ（日本語・英語のホームと同じ折りたたみ）
    frag.append(...homeBanners());
    frag.append(homeFold([homeProgress(), homeRecords(`<p class="small muted">覚えた単語 ${Object.keys(S.srs).filter(id => id.startsWith('zh|w|') && S.srs[id].r > 0).length} 語 · 今の目標 ${esc(zhLevel())}</p><a class="btn soft" href="#zh/words">単語帳を開く</a>`, '単語の進み具合'), homeStamps()]));
    box.replaceWith(frag);
  }).catch(() => zhFail(box));
}
// 复习到期的卡片（所有级别）
function zhReview() {
  const ids = new Set(zhDueIds());
  if (!ids.size) return toast('今は復習するカードがありません');
  zhAllWords().then(all => langCards(shuffle(all.filter(x => ids.has(x.id))).slice(0, 30).map(zhCard), '復習', 'zh')).catch(() => toast('読み込めませんでした'));
}
// 单词测验：看中文选日语意思 / 看日语选中文
function zhWordQuiz(list, title) {
  const pool = list.filter(x => x.ja);
  if (pool.length < 4) return toast('単語データを準備中です');
  const qs = sample(pool, Math.min(10, pool.length)).map(x => {
    const toJa = Math.random() < 0.6;
    const short = y => y.ja.split('；')[0];
    // 干扰项：共用汉字的词更容易混（HSK3 以上放 2 个，入门放 1 个）
    const sim = hanSim(x.w, short(x));
    const others = nearPick(x, pool.filter(y => y.ja !== x.ja), (a, y) => sim(y, y.w, short(y)), toJa ? short : (y => y.w), nearN(x.L));
    return toJa
      ? makeQ(x, 'meaning', others.map(short), short(x), { prompt: `<div class="eyebrow">この単語の意味は？</div><div class="q-big" ${ZHL}>${esc(x.w)}</div><div class="small muted">${esc(x.py)}</div>`, say: x.w, sayLang: 'zh-CN', explain: `<span ${ZHL}>${esc(x.w)}</span> ${esc(x.py)}：${esc(x.ja)}` })
      : makeQ(x, 'word', others.map(y => y.w), x.w, { prompt: `<div class="eyebrow">「${esc(short(x))}」は中国語で？</div>`, optLang: 'zh-CN', say: x.w, sayLang: 'zh-CN', explain: `<span ${ZHL}>${esc(x.w)}</span> ${esc(x.py)}：${esc(x.ja)}` });
  });
  zhRunQuiz(qs, title || `${zhLevel()} 単語テスト`, 5, undefined, 'v');
}
function zhRunQuiz(qs, title, xpEach = 5, back, act = null) {
  main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
  runQuiz(host, qs, { title, noRecord: true, xpEach, act: act && [act, 'zh'], onDone: r => {
    if (!r) return back ? back() : render();
    // 答错的词进单词卡，今天复习
    r.res.forEach(x => { if (!x.ok && x.q.id && x.q.id.startsWith('zh|w|')) S.srs[x.q.id] = Object.assign({ i: 0, e: 2.5, r: 0 }, S.srs[x.q.id], { due: Date.now() }); });
    save();
    quizSummary(host, r, { title, again: () => zhRunQuiz(qs.map(q => Object.assign({}, q)), title, xpEach, back, act) });
  } });
}

/* ---------- 级别诊断：HSK1–6 各 3 题（看中文选意思），每级答对 2 题以上算通过，推荐通过的最高级别的下一级 ---------- */
function zhPlacement() {
  main.append(zhLoading());
  zhAllWords().then(all => {
    const short = y => y.ja.split('；')[0];
    const qs = [1, 2, 3, 4, 5, 6].flatMap(L => sample(all.filter(x => x.L === L && x.ja && x.w.length <= 3), 3).map(x => {
      const others = sample(all.filter(y => y.L === L && y.ja && short(y) !== short(x)), 3);
      return Object.assign(makeQ(x, 'meaning', others.map(short), short(x), { prompt: `<div class="eyebrow">意味を選んでください（わからなければ勘でOK）</div><div class="q-big" ${ZHL}>${esc(x.w)}</div>` }), { lv: L });
    }));
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    runQuiz(host, qs, { title: 'レベル診断', exam: true, noRecord: true, noWeak: true, xpEach: 2, onDone: r => {
      if (!r) return go('zh');
      const pass = L => r.res.filter(x => x.q.lv === L && x.ok).length >= 2;
      let top = 0; for (let L = 1; L <= 6 && pass(L); L++) top = L;
      const rec = 'HSK' + Math.min(6, Math.max(1, top + (top && top < 6 ? 1 : 0) || 1));
      host.innerHTML = `<section class="panel"><div class="welcome-hi">${neko('cheer', 'big')}<div class="bubble"><b>おすすめは ${rec}</b><span>${top ? `HSK${top} までの単語はよく分かっています。${rec} から始めると、ちょうどいい手ごたえです。` : 'まずは HSK1 の基本の単語から。ピンインと声調もいっしょに身につけましょう。'}</span></div></div>
        <div class="row"><button class="btn pri" type="button" data-set>${rec} で始める</button><a class="btn" href="#zh">今のレベルのまま</a></div></section>`;
      host.querySelector('[data-set]').onclick = () => { S.zhLevel = rec; save(); toast(`${rec} に設定しました`); go('zh'); };
    } });
  }).catch(() => toast('読み込めませんでした'));
}

/* ---------- 学习路线：每关 10 个词，新词卡 → 3 条命的测验 → 星星，过关解锁下一关 ---------- */
const ZH_STAGE_FREE = 15;   // 每个级别前 15 关免费，之后是中文会员（和日语闯关一样）
const zhStageVip = i => i >= ZH_STAGE_FREE && !(typeof isMember === 'function' && isMember('zh'));
function zhPathPage(Lsel) {
  const n = Lsel ? zhLvNum(Lsel) : zhLvNum();
  if (zhGuest() && n > 1) return zhLocked(`学習ルート HSK${n}`);
  const box = zhLoading(); main.append(box);
  zhHsk(n).then(list => {
    if (!box.isConnected) return;
    const st = ((S.zhPath = S.zhPath || {})[n] = S.zhPath[n] || {});
    const stages = Math.ceil(list.length / 10), cur = Array.from({ length: stages }, (_, i) => i).find(i => !st[i]) ?? stages;
    const stars = Object.values(st).reduce((a, b) => a + b, 0);
    const p = h(`<section class="panel zh-path"><h2>学習ルート</h2>
      <div class="seg zh-lvseg">${ZH_LEVELS.map(([L]) => `<a href="#zh/path/${L}" class="${zhLvNum(L) === n ? 'on' : ''}">${L}</a>`).join('')}</div>
      <p class="small muted">HSK${n}：クリア ${Object.keys(st).length} · ★ ${stars}</p>
      <div class="zh-nodes">${Array.from({ length: stages }, (_, i) => {
        const done = st[i], open = i <= cur, words = list.slice(i * 10, i * 10 + 10);
        return `<button type="button" class="zh-node has-vip ${done ? 'done' : ''} ${i === cur ? 'cur' : ''}" data-st="${i}" ${open || zhStageVip(i) ? '' : 'disabled'} style="--x:${[0, 34, 54, 34, 0, -34, -54, -34][i % 8]}px">${i >= ZH_STAGE_FREE ? vipTag() : ''}
          <span class="zh-node-n">${done ? '★'.repeat(done) || '✓' : zhStageVip(i) && open ? '🔒' : i + 1}</span>${i === cur ? `<span class="zh-node-here">${neko('happy', 'mini wave')}</span>` : ''}
          <span class="zh-node-w" ${ZHL}>${esc(words.slice(0, 3).map(x => x.w).join('・'))}</span></button>`;
      }).join('')}</div></section>`);
    p.querySelectorAll('[data-st]').forEach(b => { b.onclick = () => {
      const i = +b.dataset.st;
      if (zhStageVip(i)) return askSheet(`ステージ ${ZH_STAGE_FREE + 1} 以降は中国語メンバー向けです。ここまでの単語は復習カードでいつでも練習できます。`, [[false, 'あとで'], [true, 'メンバーについて', 'pri']]).then(v => { if (v) location.hash = '#vip'; });
      zhStage(n, i, list);
    }; });
    box.replaceWith(p);
    const c = p.querySelector('.zh-node.cur'); if (c) setTimeout(() => c.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
  }).catch(() => zhFail(box));
}
function zhStage(n, i, list) {
  const words = list.slice(i * 10, i * 10 + 10).filter(x => x.ja);
  const fresh = words.filter(x => !S.srs[x.id]);
  const quiz = () => {
    const pool = list.filter(x => x.ja);
    const short = y => y.ja.split('；')[0];
    const qs = shuffle(words).map(x => {
      const others = sample(pool.filter(y => y.w !== x.w && short(y) !== short(x)), 3);
      return Math.random() < .55
        ? makeQ(x, 'meaning', others.map(short), short(x), { prompt: `<div class="eyebrow">この単語の意味は？</div><div class="q-big" ${ZHL}>${esc(x.w)}</div><div class="small muted">${esc(x.py)}</div>`, say: x.w, sayLang: 'zh-CN', explain: `<span ${ZHL}>${esc(x.w)}</span> ${esc(x.py)}：${esc(x.ja)}` })
        : makeQ(x, 'word', others.map(y => y.w), x.w, { prompt: `<div class="eyebrow">「${esc(short(x))}」は中国語で？</div>`, optLang: 'zh-CN', say: x.w, sayLang: 'zh-CN', explain: `<span ${ZHL}>${esc(x.w)}</span> ${esc(x.py)}：${esc(x.ja)}` });
    });
    main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
    runQuiz(host, qs, { title: `HSK${n} ステージ ${i + 1}`, hearts: 3, noRecord: true, xpEach: 5, act: ['s', 'zh'], onDone: r => {
      if (!r) return go(`zh/path/HSK${n}`);
      r.res.forEach(x => { if (!x.ok && x.q.id) S.srs[x.q.id] = Object.assign({ i: 0, e: 2.5, r: 0 }, S.srs[x.q.id], { due: Date.now() }); });
      const stars = r.failed ? 0 : Math.max(1, r.hearts);
      const st = ((S.zhPath = S.zhPath || {})[n] = S.zhPath[n] || {});
      if (stars) { st[i] = Math.max(st[i] || 0, stars); celebrate(); }
      save();
      host.innerHTML = `<section class="panel"><div class="welcome-hi">${neko(stars ? (stars === 3 ? 'cheer' : 'happy') : 'sad', 'big')}<div class="bubble"><b>${stars ? `ステージクリア！ ${'★'.repeat(stars)}` : 'ライフがなくなりました'}</b><span>${stars ? (stars === 3 ? 'ノーミスで完璧です！' : '間違えた単語は復習カードに入りました。') : 'もう一度チャレンジしてみましょう。間違えた単語は復習カードに入っています。'}</span></div></div>
        <div class="row"><button class="btn pri" type="button" data-next>${stars ? '次のステージへ' : 'もう一度'}</button><a class="btn" href="#zh/path/HSK${n}">ルートに戻る</a></div></section>`;
      host.querySelector('[data-next]').onclick = () => stars ? (i + 1 < Math.ceil(list.length / 10) && !zhStageVip(i + 1) ? zhStage(n, i + 1, list) : go(`zh/path/HSK${n}`)) : zhStage(n, i, list);
    } });
  };
  // 新出語があれば先にカードで覚えてからテスト
  if (fresh.length) {
    langCards(fresh.map(zhCard), `HSK${n} ステージ ${i + 1} · 新しい単語`, 'zh');
    const end = document.querySelector('.deck [data-exit]');
    // カードを全部めくり終わったら（langCards の「戻る」）テストへ進む
    const ob = new MutationObserver(() => { const back = main.querySelector('.deck [data-back]'); if (back) { ob.disconnect(); back.textContent = 'テストへ進む'; back.onclick = () => { keyHandler = null; focusMode(false); quiz(); }; } if (!main.querySelector('.deck')) ob.disconnect(); });
    ob.observe(main, { childList: true, subtree: true });
    if (end) end.textContent = 'やめる';
  } else quiz();
}

/* ---------- 拼音和声调 ---------- */
// 四声示范：汤 糖 躺 趟（四个声调都有母语者真人录音，听起来是同一种声音；原来的 妈麻马骂 大多只有合成音）
const ZH_TONES = [['第1声', 'ˉ', '高く平らに', '汤', 'tāng', '「あー」と高いまま'], ['第2声', 'ˊ', '一気に上げる', '糖', 'táng', '「えっ？」と聞き返す感じ'], ['第3声', 'ˇ', '低く抑える', '躺', 'tǎng', '会話では低いままが基本'], ['第4声', 'ˋ', '一気に下げる', '趟', 'tàng', '「あっ！」と気づく感じ']];
const ZH_INITIALS = [
  ['b p m f', '「バ・パ・マ・ファ」行。b は息を出さない、p は息を強く出す（有気音）'],
  ['d t n l', 'd は息なし、t は息を強く。日本語の「ダ」は濁るので、d は「タ」を息なしで言う感じ'],
  ['g k h', 'g は息なしの「カ」、k は息を強く。h は喉の奥でこする「ハ」'],
  ['j q x', '舌を下の歯の裏につけて「ジ・チ・シ」。q は息を強く。後ろの u は ü（「ユ」の口で「イ」）'],
  ['zh ch sh r', 'そり舌音：舌先を上あごにそり上げて「ジ・チ・シ」。r は舌をそらせた「リ」と「ジ」の中間'],
  ['z c s', '舌先を前歯の裏に。z は「ツ」を濁らせない感じ、c は息を強く「ツ」、s は「ス」']
];
const ZH_FINALS = [
  ['a o e', 'a は口を大きく「ア」、o は唇を丸めて「オ」、e は「ウ」の口で「オ」と言うようなあいまいな音'],
  ['i u ü', 'i は「イ」、u は唇を突き出して「ウ」、ü は「ユ」の口のまま「イ」'],
  ['-n と -ng', 'an（舌先を上の歯ぐきにつける「アン」）と ang（舌を奥に引く「アン」）は別の音。「案内（あんない）」と「案外（あんがい）」の「ん」の違いに近い'],
  ['er', '「アル」と言いながら舌をそらせる。儿化（-r）は語尾を同じようにそらせる']
];
const ZH_RULES = [['三声＋三声', '前の三声は二声に変わる：你好 nǐhǎo → níhǎo'], ['不 bù', '後ろが四声なら二声に：不是 bùshì → búshì'], ['一 yī', '後ろが四声なら二声、それ以外は四声に：一个 yígè、一起 yìqǐ'], ['軽声', '弱く短く、声調をつけない：妈妈 māma、我的 wǒde']];

function zhPinyinPage() {
  const p = h(`<section class="panel zh-pinyin">
    <h2>ピンイン・声調</h2>
    <p class="muted">中国語の発音は「ピンイン（ローマ字）＋声調（音の高低）」。同じ ma でも声調が変わると別の意味になります。まずは四声の聞き分けから。</p>
    <div class="zh-tones">${ZH_TONES.map(([n, m, d, ch, py, tip], i) => `<button type="button" class="zh-tone" data-lsay="${ch}" data-lang="zh-CN" title="${esc(tip)}"><svg viewBox="0 0 60 40" aria-hidden="true"><path d="${['M8 10H52', 'M8 32L52 8', 'M8 20Q30 40 52 14', 'M8 8L52 34'][i]}"/></svg><b ${ZHL}>${ch}</b><span class="zh-py">${py}</span><span class="small"><b>${n}</b><br>${esc(d)}</span></button>`).join('')}</div>
    <p class="small muted">${ZH_TONES.map(([n, , , , , tip]) => `${n}：${esc(tip)}`).join('　')}</p>
    <div class="row"><button class="btn pri big" type="button" data-tq>声調クイズ（10問）</button><button class="btn" type="button" data-sq>聞き取りクイズ</button></div>
    <h3>声調の変化</h3>
    <div class="zh-rules">${ZH_RULES.map(([a, b]) => `<div><b>${esc(a)}</b><span class="small">${esc(b)}</span></div>`).join('')}</div>
    <h3>子音（声母）</h3>
    <div class="zh-rules">${ZH_INITIALS.map(([a, b]) => `<div><b class="zh-py">${a}</b><span class="small">${esc(b)}</span></div>`).join('')}</div>
    <h3>母音（韻母）</h3>
    <div class="zh-rules">${ZH_FINALS.map(([a, b]) => `<div><b class="zh-py">${a}</b><span class="small">${esc(b)}</span></div>`).join('')}</div>
    <h3>ピンイン表 <span class="small muted">音節をタップすると四声を聞けます</span></h3>
    <div data-chart><div class="skel"><i></i><i></i></div></div>
  </section>`);
  main.append(p);
  p.querySelector('[data-tq]').onclick = () => zhToneQuiz();
  p.querySelector('[data-sq]').onclick = () => zhSylQuiz();
  zhPy().then(t => {
    const chart = p.querySelector('[data-chart]'); if (!chart) return;
    const INI = ['', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'];
    const ini = s => INI.slice(1).sort((a, b) => b.length - a.length).find(i => s.startsWith(i)) || '';
    const groups = INI.map(i => [i, Object.keys(t).filter(s => ini(s) === i).sort()]).filter(([, l]) => l.length);
    chart.innerHTML = groups.map(([i, l]) => `<div class="zh-row"><b class="zh-ini">${i || '—'}</b><div class="zh-syls">${l.map(s => `<button type="button" class="chip-btn zh-py" data-syl="${s}">${s}</button>`).join('')}</div></div>`).join('');
    chart.querySelectorAll('[data-syl]').forEach(b => {
      b.onclick = () => {
        const tones = t[b.dataset.syl];
        askSheet(`${b.dataset.syl} の四声（タップで再生）`, [[null, '閉じる']]);
        const box = document.querySelector('.ask-box'); if (!box) return;
        box.querySelector('p').insertAdjacentHTML('afterend', `<div class="zh-four">${['1', '2', '3', '4'].map(k => tones[k] ? `<button type="button" class="zh-tone mini" data-lsay="${esc(tones[k][0])}" data-lang="zh-CN"><b ${ZHL}>${esc(tones[k][0])}</b><span class="zh-py">${esc(zhMark(b.dataset.syl, +k))}</span><span class="small muted" ${ZHL}>${esc(tones[k][1])}</span></button>` : `<span class="zh-tone mini off"><span class="small muted">第${k}声なし</span></span>`).join('')}</div>`);
      };
    });
  }).catch(() => { const c = p.querySelector('[data-chart]'); if (c) zhFail(c); });
}
// 给无调音节标声调（a > o > e > i/u 规则；iu、ui 标在后一个）
function zhMark(s, t) {
  const M = { a: 'āáǎà', o: 'ōóǒò', e: 'ēéěè', i: 'īíǐì', u: 'ūúǔù', ü: 'ǖǘǚǜ' };
  let k = s.indexOf('a'); if (k < 0) k = s.indexOf('o'); if (k < 0) k = s.indexOf('e');
  if (k < 0) { const iu = s.search(/iu|ui/); k = iu >= 0 ? iu + 1 : s.search(/[iuü]/); }
  return k < 0 ? s : s.slice(0, k) + M[s[k]][t - 1] + s.slice(k + 1);
}
const zhPlayPrompt = (ch, label) => `<div class="eyebrow">${label}</div><button type="button" class="speak zh-play" data-lsay="${esc(ch)}" data-lang="zh-CN" aria-label="もう一度聞く">${SPEAK_SVG}<span>もう一度聞く</span></button>`;
function zhAutoPlay(qs) {   // 每题出现时自动播放一次
  const ob = new MutationObserver(() => { const b = main.querySelector('.q-prompt .zh-play:not([data-played])'); if (b) { b.dataset.played = 1; setTimeout(() => zhSay(b.dataset.lsay), 250); } if (!main.querySelector('.quiz')) ob.disconnect(); });
  ob.observe(main, { childList: true, subtree: true });
  return qs;
}
function zhToneQuiz() {
  zhPy().then(t => {
    const items = Object.entries(t).flatMap(([s, tones]) => Object.entries(tones).map(([k, [ch, w]]) => ({ s, k: +k, ch, w })));
    const names = ['第1声 ˉ', '第2声 ˊ', '第3声 ˇ', '第4声 ˋ'];
    const qs = sample(items, 10).map(x => Object.assign(makeQ(null, 'listen', names.filter((_, i) => i !== x.k - 1), names[x.k - 1], {
      prompt: zhPlayPrompt(x.ch, '何声ですか？'), explain: `<span ${ZHL}>${esc(x.ch)}</span> ${esc(zhMark(x.s, x.k))}（${esc(x.w)}）`, say: x.ch, sayLang: 'zh-CN'
    }), {}));
    // 选项按 1–4 声的顺序排，方便记位置
    qs.forEach(q => { const right = q.options[q.answer]; q.options = names.slice(); q.answer = names.indexOf(right); });
    zhRunQuiz(zhAutoPlay(qs), '声調クイズ', 5, () => go('zh/pinyin'), 't');
  }).catch(() => toast('読み込めませんでした'));
}
// 听音选拼音：混淆项来自容易混的音（zh/z、an/ang、ü/u……）
function zhSylQuiz() {
  zhPy().then(t => {
    const all = Object.keys(t);
    const SWAP = [['zh', 'z'], ['ch', 'c'], ['sh', 's'], ['ang', 'an'], ['eng', 'en'], ['ing', 'in'], ['q', 'j'], ['x', 'sh'], ['ü', 'u'], ['r', 'l'], ['p', 'b'], ['t', 'd'], ['k', 'g']];
    const qs = sample(Object.entries(t).flatMap(([s, tones]) => Object.entries(tones).map(([k, [ch]]) => ({ s, k: +k, ch }))), 10).map(x => {
      const near = SWAP.flatMap(([a, b]) => [x.s.includes(a) ? x.s.replace(a, b) : null, x.s.includes(b) ? x.s.replace(b, a) : null]).filter(s => s && s !== x.s && t[s]);
      const opts = [...new Set([...sample(near, 2), ...sample(all.filter(s => s !== x.s), 4)])].filter(s => s !== x.s).slice(0, 3).map(s => zhMark(s, x.k));
      return makeQ(null, 'listen', opts, zhMark(x.s, x.k), { prompt: zhPlayPrompt(x.ch, '聞こえた音はどれ？'), explain: `<span ${ZHL}>${esc(x.ch)}</span> ${esc(zhMark(x.s, x.k))}`, say: x.ch, sayLang: 'zh-CN' });
    });
    zhRunQuiz(zhAutoPlay(qs), '聞き取りクイズ', 5, () => go('zh/pinyin'), 't');
  }).catch(() => toast('読み込めませんでした'));
}

/* ---------- 单词（HSK） ---------- */
let zhWordsShown = 60, zhWordsQ = '';
function zhWordsPage(Lsel) {
  const n = Lsel ? zhLvNum(Lsel) : zhLvNum();
  if (zhGuest() && n > 2) return zhLocked(`単語帳 HSK${n}`);
  const box = zhLoading(); main.append(box);
  zhHsk(n).then(list => {
    if (!box.isConnected) return;
    const known = zhKnown(list), fresh = list.filter(x => !S.srs[x.id]);
    const p = h(`<section class="panel zh-words">
      <h2>単語帳</h2>
      <div class="seg zh-lvseg" role="group" aria-label="級">${ZH_LEVELS.map(([L]) => `<a href="#zh/words/${L}" class="${zhLvNum(L) === n ? 'on' : ''}">${L}</a>`).join('')}</div>
      <div class="lv-row zh-prog"><span class="small muted">覚えた</span><div class="bar"><i style="width:${known / list.length * 100}%"></i></div><span class="small muted">${known} / ${list.length}</span></div>
      <div class="row"><button class="btn pri" type="button" data-new ${fresh.length ? '' : 'disabled'}>新しい単語を覚える</button><button class="btn" type="button" data-quiz>テスト</button></div>
      <input class="lb-input" type="search" placeholder="中国語・ピンイン・日本語で探す" value="${esc(zhWordsQ)}" data-q>
      <div class="zh-list" data-list></div>
      <div class="row" data-morebox></div>
      <p class="small muted">英語の語義は CC-CEDICT（CC BY-SA 4.0）、HSK 語彙表は complete-hsk-vocabulary（MIT）、HSK 外の語の選定は wordfreq（CC BY-SA 4.0）より。日本語訳と例文は当サイトのオリジナルです。</p>
    </section>`);
    box.replaceWith(p);
    p.querySelector('[data-new]').onclick = () => langCards(fresh.slice(0, S.newPerDay || 10).map(zhCard), `新しい単語 · HSK${n}`, 'zh');
    p.querySelector('[data-quiz]').onclick = () => zhWordQuiz(list, `HSK${n} 単語テスト`);
    const draw = () => {
      const q = zhWordsQ.trim().toLowerCase(), qn = zhNoTone(q);
      const hits = q ? list.filter(x => x.w.includes(q) || zhNoTone(x.py).replace(/ /g, '').includes(qn.replace(/ /g, '')) || (x.ja || '').includes(q)) : list;
      p.querySelector('[data-list]').innerHTML = hits.slice(0, zhWordsShown).map(x => zhRow(x)).join('') || '<p class="small muted">見つかりませんでした。</p>';
      const more = p.querySelector('[data-morebox]');
      more.innerHTML = hits.length > zhWordsShown ? `<button class="btn ghost" type="button">もっと見る</button>` : '';
      if (more.firstChild) more.firstChild.onclick = () => { zhWordsShown += 100; draw(); };
      zhBindRows(p.querySelector('[data-list]'), list);
    };
    let tm; p.querySelector('[data-q]').oninput = e => { clearTimeout(tm); tm = setTimeout(() => { zhWordsQ = e.target.value; zhWordsShown = 60; draw(); }, 200); };
    draw();
  }).catch(() => zhFail(box));
}
const zhNoTone = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ü/g, 'v').toLowerCase();
const zhRow = x => `<div class="zh-row-w ${S.srs[x.id] ? 'known' : ''}" data-w="${esc(x.w)}" role="button" tabindex="0"><b ${ZHL}>${esc(x.w)}</b><span class="zh-py">${esc(x.py)}</span><span class="zh-ja">${esc(x.ja || '')}</span>${zhSayBtn(x.w)}</div>`;
function zhBindRows(el, list) {
  el.querySelectorAll('[data-w]').forEach(r => { r.onclick = e => { e.stopPropagation(); const x = list.find(y => y.w === r.dataset.w); if (x) zhSheet(x); }; });
}

/* ---------- 单词卡片（弹出） ---------- */
// 英语释义去掉「surname Leng」这种姓氏义项（CC-CEDICT 常把它排第一）
const zhEn = en => (en || '').split(/;\s*/).filter(t => !/^(old variant of|variant of|)\s*surname\b/i.test(t)).join('; ');
function zhSheet(x) {
  closeSheet();
  const inDeck = !!S.srs[x.id];
  const sh = h(`<div class="word-sheet zh-sheet" role="dialog" aria-label="単語">
    <button class="ws-x" type="button" aria-label="閉じる">×</button>
    <div class="row"><span class="ws-w" ${ZHL}>${esc(x.w)}</span>${zhSayBtn(x.w)}<span class="tag lv">${x.ext ? 'HSK 外' : `HSK${x.L}`}</span></div>
    <div class="zh-py">${esc(x.py)}${x.trad ? ` <span class="small muted">繁体字 <span lang="zh-TW">${esc(x.trad)}</span></span>` : ''}</div>
    <div class="ws-m">${esc(x.ja || '')}</div>${!x.ex && !x.ext && x.L >= 4 && !isMember('zh') ? `<p class="small muted">${vipTag('inl')} HSK4 以上の例文と音声はメンバー向けです <a href="#vip">メンバーについて ›</a></p>` : ''}
    ${x.cl ? `<div class="small muted">量詞：<span ${ZHL}>${esc(x.cl)}</span></div>` : ''}
    ${x.note ? `<div class="small zh-note">${esc(x.note)}</div>` : ''}
    ${x.ex ? `<div class="small zh-ex"><div class="row"><span ${ZHL}>${zhTap(x.ex)}</span>${exSayBtn(x.ex, 'zh-CN')}${shadowBtn(x.ex, x.expy, x.exja, 'zh')}</div><div class="zh-py muted">${esc(x.expy)}</div><div class="muted">${esc(x.exja)}</div></div>` : ''}
    ${zhEn(x.en) ? `<div class="small muted">英語：${esc(zhEn(x.en))}</div>` : ''}
    <div class="row"><button class="btn soft" type="button" data-add ${inDeck ? 'disabled' : ''}>${inDeck ? '単語カードに追加済み' : '+ 単語カード'}</button><button class="btn" type="button" data-strokes>✍ 書き順・手書き</button>${favBtn('w', x.w, `${x.py} ${(x.ja || '').split('；')[0]}`, 'zh')}</div>
  </div>`);
  document.body.append(sh);
  sh.querySelector('.ws-x').onclick = closeSheet;
  const add = sh.querySelector('[data-add]');
  add.onclick = () => { S.srs[x.id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; save(); add.textContent = '追加しました'; add.disabled = true; toast(`「${x.w}」を単語カードに追加しました`); };
  sh.querySelector('[data-strokes]').onclick = () => { closeSheet(); zhStrokes(x.w, x.py); };
}

/* ---------- 書き順・手書き練習（Hanzi Writer，MIT；字形データ Make Me a Hanzi，Arphic Public License，vendor/hanzi/） ---------- */
let zhHWLoad = null;
const zhHW = () => zhHWLoad || (zhHWLoad = new Promise((res, rej) => { if (window.HanziWriter) return res(); const s = document.createElement('script'); s.src = 'vendor/hanzi-writer.min.js'; s.onload = res; s.onerror = () => { zhHWLoad = null; rej(); }; document.head.append(s); }));
function zhStrokes(word, py) {
  const chars = [...word].filter(c => /[\u4e00-\u9fff]/.test(c));
  if (!chars.length) return;
  const pys = (py || '').split(' ');
  let k = 0, writer = null;
  const m = h(`<div class="ask-mask zh-stroke-mask" role="dialog" aria-modal="true" aria-label="書き順"><div class="ask-box zh-stroke">
    <div class="row between"><b>書き順・手書き</b><button class="ws-x" type="button" aria-label="閉じる" data-x>×</button></div>
    <div class="row zh-stroke-tabs">${chars.map((c, i) => `<button type="button" class="chip-btn" data-k="${i}" ${ZHL}>${esc(c)}</button>`).join('')}</div>
    <div class="zh-stroke-box" data-box></div>
    <div class="small muted center" data-info></div>
    <div class="row zh-stroke-btns"><button class="btn" type="button" data-anim>▶ 書き順を見る</button><button class="btn pri" type="button" data-hwquiz>✍ なぞって練習</button></div>
  </div></div>`);
  document.body.append(m);
  const close = () => { m.remove(); applyTheme(); };
  m.querySelector('[data-x]').onclick = close;
  m.onclick = e => { if (e.target === m) close(); };
  const info = m.querySelector('[data-info]'), box = m.querySelector('[data-box]');
  const load = c => fetch(`vendor/hanzi/${c.codePointAt(0).toString(16)}.json`).then(r => { if (!r.ok) throw 0; return r.json(); });
  const show = i => {
    k = i;
    m.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', +b.dataset.k === k));
    box.innerHTML = ''; info.textContent = '読み込み中……';
    const css = getComputedStyle(document.body);
    writer = HanziWriter.create(box, chars[k], {
      width: 240, height: 240, padding: 12, showOutline: true, strokeAnimationSpeed: 1.1, delayBetweenStrokes: 220,
      strokeColor: css.getPropertyValue('--ink').trim() || '#1E1B36', radicalColor: css.getPropertyValue('--ai').trim() || '#0E9F78',
      outlineColor: css.getPropertyValue('--line').trim() || '#E4E2F1', highlightColor: css.getPropertyValue('--ai').trim() || '#0E9F78', drawingColor: css.getPropertyValue('--ai').trim() || '#0E9F78',
      charDataLoader: (c, ok, fail) => load(c).then(d => { info.textContent = `${chars[k]}　${pys[k] || ''}　全 ${d.strokes.length} 画（部首は色つき）`; ok(d); }).catch(() => { info.textContent = 'この字の書き順データはまだありません'; fail && fail(); })
    });
    setTimeout(() => writer && writer.animateCharacter(), 300);
  };
  m.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => show(+b.dataset.k); });
  m.querySelector('[data-anim]').onclick = () => writer && writer.animateCharacter();
  m.querySelector('[data-hwquiz]').onclick = () => {
    if (!writer) return;
    info.textContent = '1 画ずつ、正しい順番でなぞってください（3 回まちがえるとヒント）';
    writer.quiz({ showHintAfterMisses: 3, onComplete: s => { info.textContent = s.totalMistakes ? `書けました！（まちがい ${s.totalMistakes} 回）` : '完璧です！'; addXP(3); buzz(12); if (k < chars.length - 1) setTimeout(() => show(k + 1), 900); } });
  };
  zhHW().then(() => show(0)).catch(() => { info.textContent = '読み込めませんでした。通信状況を確認してください。'; });
}

/* ---------- 辞书 ---------- */
// 日本の漢字（新字体）→ 简体字：常用字里写法不同的一部分，查词时自动换算
const ZH_JP2S = { 経: '经', 済: '济', 気: '气', 円: '圆', 図: '图', 書: '书', 東: '东', 車: '车', 電: '电', 話: '话', 語: '语', 読: '读', 買: '买', 売: '卖', 楽: '乐', 学: '学', 習: '习', 時: '时', 間: '间', 門: '门', 問: '问', 聞: '闻', 開: '开', 関: '关', 長: '长', 張: '张', 飯: '饭', 館: '馆', 飲: '饮', 食: '食', 駅: '驿', 鉄: '铁', 道: '道', 国: '国', 会: '会', 社: '社', 員: '员', 見: '见', 覚: '觉', 親: '亲', 歳: '岁', 銀: '银', 行: '行', 業: '业', 楽: '乐', 薬: '药', 医: '医', 院: '院', 様: '样', 単: '单', 戦: '战', 対: '对', 発: '发', 髪: '发', 写: '写', 真: '真', 価: '价', 値: '值', 違: '违', 運: '运', 動: '动', 転: '转', 達: '达', 遠: '远', 選: '选', 連: '连', 進: '进', 過: '过', 頭: '头', 顔: '颜', 題: '题', 願: '愿', 類: '类', 風: '风', 飛: '飞', 馬: '马', 魚: '鱼', 鳥: '鸟', 黒: '黑', 黄: '黄', 広: '广', 応: '应', 恋: '恋', 愛: '爱', 歓: '欢', 迎: '迎', 帰: '归', 当: '当', 実: '实', 写: '写', 将: '将', 来: '来', 歴: '历', 史: '史', 号: '号', 個: '个', 後: '后', 従: '从', 側: '侧', 労: '劳', 勉: '勉', 強: '强', 弾: '弹', 縁: '缘', 紅: '红', 級: '级', 紙: '纸', 細: '细', 結: '结', 給: '给', 続: '续', 練: '练', 線: '线', 緑: '绿', 総: '总', 網: '网', 説: '说', 試: '试', 験: '验', 険: '险', 検: '检', 査: '查', 計: '计', 記: '记', 訪: '访', 設: '设', 許: '许', 証: '证', 評: '评', 詞: '词', 誌: '志', 調: '调', 談: '谈', 請: '请', 論: '论', 識: '识', 議: '议', 護: '护', 譲: '让', 変: '变', 豊: '丰', 貝: '贝', 負: '负', 財: '财', 貨: '货', 販: '贩', 貴: '贵', 費: '费', 貿: '贸', 賃: '赁', 資: '资', 賞: '赏', 質: '质', 贈: '赠', 軽: '轻', 較: '较', 輸: '输', 辺: '边', 郵: '邮', 鍵: '键', 針: '针', 録: '录', 鏡: '镜', 陽: '阳', 隊: '队', 階: '阶', 際: '际', 雑: '杂', 難: '难', 雲: '云', 電: '电', 静: '静', 頼: '赖', 額: '额', 養: '养', 餅: '饼', 麺: '面', 図: '图', 団: '团', 園: '园', 圧: '压', 塩: '盐', 壊: '坏', 声: '声', 売: '卖', 夢: '梦', 奥: '奥', 婦: '妇', 嬉: '嬉', 宝: '宝', 寝: '寝', 専: '专', 尋: '寻', 導: '导', 届: '届', 層: '层', 岡: '冈', 島: '岛', 帯: '带', 庁: '厅', 処: '处', 弁: '辩', 彼: '彼', 徳: '德', 恵: '惠', 悪: '恶', 情: '情', 惨: '惨', 憶: '忆', 戸: '户', 払: '拂', 担: '担', 拡: '扩', 挙: '举', 捜: '搜', 掃: '扫', 揺: '摇', 摂: '摄', 擁: '拥', 数: '数', 断: '断', 旧: '旧', 晩: '晚', 暁: '晓', 曜: '曜', 様: '样', 権: '权', 横: '横', 機: '机', 欧: '欧', 歩: '步', 残: '残', 殺: '杀', 毎: '每', 気: '气', 沢: '泽', 浅: '浅', 涙: '泪', 渋: '涩', 温: '温', 湾: '湾', 満: '满', 漢: '汉', 済: '济', 灯: '灯', 焼: '烧', 熱: '热', 犬: '犬', 状: '状', 猫: '猫', 献: '献', 現: '现', 産: '产', 画: '画', 痩: '瘦', 発: '发', 県: '县', 眠: '眠', 礼: '礼', 禅: '禅', 税: '税', 種: '种', 穏: '稳', 窓: '窗', 竜: '龙', 笑: '笑', 筆: '笔', 節: '节', 範: '范', 築: '筑', 簡: '简', 粋: '粹', 糸: '丝', 約: '约', 紹: '绍', 終: '终', 組: '组', 経: '经', 絵: '绘', 絶: '绝', 継: '继', 縄: '绳', 縦: '纵', 縮: '缩', 繁: '繁', 繊: '纤', 織: '织', 缶: '罐', 罰: '罚', 習: '习', 聴: '听', 肉: '肉', 脳: '脑', 腸: '肠', 舗: '铺', 芸: '艺', 茶: '茶', 荷: '荷', 蔵: '藏', 虫: '虫', 蚕: '蚕', 衛: '卫', 装: '装', 補: '补', 製: '制', 複: '复', 観: '观', 覧: '览', 触: '触', 訳: '译', 誤: '误', 課: '课', 誕: '诞', 謝: '谢', 賛: '赞', 趣: '趣', 跡: '迹', 軍: '军', 輪: '轮', 農: '农', 迷: '迷', 適: '适', 遅: '迟', 遊: '游', 遺: '遗', 還: '还', 鄉: '乡', 郷: '乡', 酔: '醉', 醤: '酱', 釈: '释', 鈴: '铃', 銭: '钱', 鋭: '锐', 錯: '错', 鍋: '锅', 闘: '斗', 陸: '陆', 険: '险', 隠: '隐', 雰: '氛', 電: '电', 響: '响', 頂: '顶', 預: '预', 領: '领', 飾: '饰', 騒: '骚', 験: '验', 髪: '发', 鶏: '鸡', 麦: '麦', 齢: '龄', 亜: '亚', 仏: '佛', 仮: '假', 伝: '传', 価: '价', 倹: '俭', 偽: '伪', 児: '儿', 両: '两', 乗: '乘', 争: '争', 亀: '龟', 予: '预', 余: '余', 写: '写', 冷: '冷', 処: '处', 剣: '剑', 剤: '剂', 労: '劳', 効: '效', 勧: '劝', 区: '区', 卒: '卒', 単: '单', 厳: '严', 参: '参', 収: '收', 叙: '叙', 号: '号', 図: '图', 囲: '围', 売: '卖', 変: '变', 姉: '姐', 学: '学', 宮: '宫', 実: '实', 対: '对', 寿: '寿', 将: '将', 巻: '卷', 帰: '归', 広: '广', 庄: '庄', 廃: '废', 弐: '贰', 径: '径', 従: '从', 恥: '耻', 悩: '恼', 態: '态', 戯: '戏', 択: '择', 抜: '拔', 拝: '拜', 拠: '据', 挿: '插', 掲: '揭', 摂: '摄', 斉: '齐', 斎: '斋', 昼: '昼', 暦: '历', 条: '条', 来: '来', 枢: '枢', 栄: '荣', 桜: '樱', 楼: '楼', 概: '概', 様: '样', 歯: '齿', 殻: '壳', 気: '气', 汚: '污', 決: '决', 没: '没', 沖: '冲', 浄: '净', 涼: '凉', 渇: '渴', 湿: '湿', 滞: '滞', 滝: '泷', 漁: '渔', 潜: '潜', 灰: '灰', 炉: '炉', 点: '点', 為: '为', 焔: '焰', 犠: '牺', 狭: '狭', 独: '独', 猟: '猎', 獣: '兽', 瓶: '瓶', 畳: '叠', 疎: '疏', 盗: '盗', 県: '县', 研: '研', 砕: '碎', 秘: '秘', 称: '称', 稲: '稻', 穂: '穗', 突: '突', 粛: '肃', 粧: '妆', 糖: '糖', 経: '经', 縁: '缘', 繰: '缲', 聖: '圣', 胆: '胆', 脱: '脱', 臓: '脏', 舎: '舍', 芽: '芽', 茎: '茎', 荘: '庄', 薫: '薰', 蛍: '萤', 蝶: '蝶', 衆: '众', 視: '视', 覚: '觉', 訴: '诉', 診: '诊', 詳: '详', 誉: '誉', 謡: '谣', 譜: '谱', 豪: '豪', 貸: '贷', 賀: '贺', 賦: '赋', 購: '购', 践: '践', 軟: '软', 載: '载', 辞: '辞', 逓: '递', 遥: '遥', 郊: '郊', 酸: '酸', 鉱: '矿', 銘: '铭', 錬: '炼', 鋼: '钢', 閉: '闭', 闇: '暗', 陣: '阵', 随: '随', 雇: '雇', 霊: '灵', 静: '静', 頃: '顷', 頻: '频', 飢: '饥', 駆: '驱', 駐: '驻', 騎: '骑', 鬱: '郁', 黙: '默' };
const zhJp2s = s => [...s].map(c => ZH_JP2S[c] || c).join('');
function zhSearchAll(q) {
  q = (q || '').trim();
  if (!q) return Promise.resolve([]);
  return zhDictWords().then(all => {   // 辞書は HSK 以外の常用語も含める
    const s = zhJp2s(q), qn = zhNoTone(q).replace(/\s+/g, ''), latin = /^[a-zA-Züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s]+$/.test(q);
    const score = x => {
      if (x.w === q || x.w === s) return 0;
      if (latin && zhNoTone(x.py).replace(/\s+/g, '') === qn) return 1;
      if (x.w.startsWith(s)) return 2;
      if (x.w.includes(s)) return 3;
      if (latin && zhNoTone(x.py).replace(/\s+/g, '').startsWith(qn)) return 4;
      if ((x.ja || '').split(/[；、（）〔〕]/).some(m => m === q)) return 5;
      if ((x.ja || '').includes(q)) return 6;
      if (latin && (x.en || '').toLowerCase().split(/[;,()\s]+/).includes(q.toLowerCase())) return 7;
      return 99;
    };
    return all.map(x => [score(x), x]).filter(([k]) => k < 99).sort((a, b) => a[0] - b[0] || a[1].L - b[1].L).map(([, x]) => x);
  });
}
// 顶部查词框（zh 板块）：下拉显示前几个，点开看单词卡片
function zhSearch(q, drop) {
  drop.innerHTML = '<div class="small muted" style="padding:10px">検索中……</div>'; drop.hidden = false;
  zhSearchAll(q).then(hits => {
    const top = hits.slice(0, 6);
    drop.innerHTML = top.map((x, i) => `<button type="button" class="gs-item" data-zi="${i}"><span class="gs-w" ${ZHL}>${esc(x.w)}</span><span class="gs-r">${esc(x.py)}</span><span class="gs-m">${esc((x.ja || '').split('；')[0])}</span><span class="tag lv">${x.ext ? 'HSK 外' : `HSK${x.L}`}</span></button>`).join('')
      + (typeof siteSearchHTML === 'function' ? siteSearchHTML(q) : '') + `<button type="button" class="gs-all" data-zall>${top.length ? 'すべての結果を見る →' : '見つかりませんでした。辞書ページで探す →'}</button>`;
    drop.querySelectorAll('[data-zi]').forEach(b => { b.onclick = e => { e.stopPropagation(); drop.hidden = true; zhSheet(top[+b.dataset.zi]); }; });
    drop.querySelector('[data-zall]').onclick = e => { e.stopPropagation(); drop.hidden = true; const inp = document.getElementById('gs-q'); if (inp) { inp.value = ''; inp.blur(); } zhDictOverlay(q); };
  }).catch(() => { drop.innerHTML = '<div class="small muted" style="padding:10px">読み込めませんでした</div>'; });
  return true;
}
let zhDictQ = '';
function zhDictPage(host, q) {
  if (q != null) zhDictQ = q;
  const p = h(`<section class="panel zh-dict"><h2>辞書</h2>
    <form class="dict-form" data-form role="search"><input type="search" placeholder="中国語・ピンイン・日本語・英語" value="${esc(zhDictQ)}" aria-label="辞書を検索" autocomplete="off" data-in><button class="btn pri" type="submit">検索</button></form>
    <div class="row small"><span class="muted">例：</span>${['你好', 'xiexie', '経済', 'おいしい', '电脑', 'happy'].map(w => `<button type="button" class="chip-btn" data-try="${w}">${w}</button>`).join('')}</div>
    <p class="small muted" data-st>HSK 1〜6級の単語と HSK 外のよく使う語を収録。日本の漢字（経済・電話など）で入力しても簡体字に変換して探します。ピンインは声調なしでも OK です。</p>
    <div class="zh-list" data-res></div></section>`);
  host.append(p);
  const inp = p.querySelector('[data-in]'), res = p.querySelector('[data-res]'), st = p.querySelector('[data-st]');
  const run = () => {
    zhDictQ = inp.value;
    if (!inp.value.trim()) { res.innerHTML = ''; return; }
    st.textContent = '検索中……';
    zhSearchAll(inp.value).then(hits => {
      if (inp.value !== zhDictQ) return;
      st.textContent = hits.length ? `${hits.length} 件` : '見つかりませんでした。別の書き方（ピンイン・日本語）でも試してみてください。';
      res.innerHTML = hits.slice(0, 80).map(zhRow).join('');
      res.querySelectorAll('[data-w]').forEach(r => { r.onclick = e => { e.stopPropagation(); const x = hits.find(y => y.w === r.dataset.w); if (x) zhSheet(x); }; });
    }).catch(() => { st.textContent = '読み込めませんでした'; });
  };
  p.querySelector('[data-form]').onsubmit = e => { e.preventDefault(); run(); };
  let tm; inp.oninput = () => { clearTimeout(tm); tm = setTimeout(run, 250); };
  p.querySelectorAll('[data-try]').forEach(b => { b.onclick = () => { inp.value = b.dataset.try; run(); }; });
  run();
  if (host === main) setTimeout(() => inp.focus({ preventScroll: true }), 50);
}
// 在当前页面上盖一层辞书（做题、读文章时查词不离开原来的页面）
function zhDictOverlay(q) {
  document.querySelectorAll('.dict-layer').forEach(l => l.remove());
  const layer = h(`<div class="dict-layer" role="dialog" aria-modal="true" aria-label="辞書">
    <div class="dict-layer-top"><button class="btn ghost" type="button" data-close>← 戻る</button><span class="small muted">閉じると元のページに戻ります</span></div><div class="dict-layer-body"></div></div>`);
  zhDictPage(layer.querySelector('.dict-layer-body'), q);
  let closed = false;
  const close = () => { if (closed) return; closed = true; layer.remove(); document.body.classList.remove('dict-open'); removeEventListener('popstate', close); removeEventListener('hashchange', close); };
  layer.querySelector('[data-close]').onclick = () => { if (history.state && history.state.dictLayer) history.back(); else close(); };
  try { history.pushState({ dictLayer: 1 }, ''); } catch (e) { /* 忽略 */ }
  addEventListener('popstate', close); addEventListener('hashchange', close);
  document.body.append(layer); document.body.classList.add('dict-open');
}

/* ---------- 带拼音的中文（读物、会话） ---------- */
// toks: [[片段, 逐字拼音(空格分隔), 可查]] → 每个字上面标拼音；可查的词点开看意思
function zhRuby(toks) {
  return toks.map(([seg, py, can]) => {
    const pys = py ? py.split(' ') : [];
    const inner = /[一-鿿]/.test(seg) ? [...seg].map((c, i) => pys[i] ? `<ruby>${esc(c)}<rt>${esc(pys[i])}</rt></ruby>` : esc(c)).join('') : esc(seg);
    return can ? `<span class="zh-tok" data-tok="${esc(seg)}">${inner}</span>` : inner;
  }).join('');
}
function zhBindToks(el, gloss) {
  el.querySelectorAll('[data-tok]').forEach(t => {
    t.onclick = e => {
      e.stopPropagation();
      if (!glossOK()) return;
      const w = t.dataset.tok;
      el.querySelectorAll('.zh-tok.on').forEach(x => x.classList.remove('on')); t.classList.add('on');
      zhIndex().then(by => zhSheet(by[w] || { id: 'zh|w|' + w, w, py: (gloss[w] || [])[0] || '', ja: (gloss[w] || [])[1] || '', L: '–' })).catch(() => {});
    };
  });
}
// 拼音 / 日语翻译的显示开关（记在 S.zhShow）
function zhToggles(el) {
  const st = S.zhShow = S.zhShow || { py: true, ja: true };
  const bar = h(`<div class="seg zh-toggles" role="group" aria-label="表示"><button type="button" data-k="py">ピンイン</button><button type="button" data-k="ja">日本語訳</button></div>`);
  const paint = () => { bar.querySelectorAll('[data-k]').forEach(b => { b.classList.toggle('on', !!st[b.dataset.k]); b.setAttribute('aria-pressed', !!st[b.dataset.k]); }); el.classList.toggle('no-py', !st.py); el.classList.toggle('no-ja', !st.ja); };
  bar.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { st[b.dataset.k] = !st[b.dataset.k]; save(); paint(); }; });
  paint();
  return bar;
}

/* ---------- 文法 ---------- */
function zhGrammarPage(Lsel) {
  const lv = Lsel || zhLevel();
  const box = zhLoading(); main.append(box);
  zhGrammar().then(all => {
    if (!box.isConnected) return;
    const list = all.filter(g => g.lv === lv), seen = S.zhGr = S.zhGr || {};
    const p = h(`<section class="panel"><h2>文法</h2>
      <p class="muted">日本語話者がつまずきやすいポイントを中心に、例文と練習問題つきで。</p>
      <div class="seg zh-lvseg">${ZH_LEVELS.map(([L]) => `<a href="#zh/grammar/${L}" class="${L === lv ? 'on' : ''}">${L}</a>`).join('')}</div>
      <div class="row"><button class="btn pri" type="button" data-q ${list.length ? '' : 'disabled'}>${lv} 文法クイズ</button><span class="small muted">確認済み ${list.filter(g => seen[g.id]).length}</span></div>
      <div class="zh-arts">${list.map(g => `<a class="zh-art ${seen[g.id] ? 'done' : ''}" href="#zh/grammar/${g.id}"><span class="course-ic">文</span><div><b>${esc(g.title)}</b><span class="small zh-py" ${ZHL}>${esc(g.p)}</span></div>${seen[g.id] ? '<span class="tag done">✓</span>' : ''}</a>`).join('')}</div></section>`);
    p.querySelector('[data-q]').onclick = () => {
      if (zhGuest() && zhLvNum(lv) > 1) return zhLocked('文法 ' + lv);
      zhRunQuiz(shuffle(list.flatMap(g => g.q.map(q => ({ kind: 'grammar', options: q.opts, answer: q.a, explain: `<b>${esc(g.title)}</b>：${esc(q.why)}`, prompt: `<div class="eyebrow">${esc(g.title)}</div><div class="duel-m" ${/[\u4e00-\u9fff]{3}/.test(q.q) ? '' : ''}>${esc(q.q)}</div>` })))).slice(0, 10), `${lv} 文法クイズ`, 8, () => go(`zh/grammar/${lv}`), 'g');
    };
    box.replaceWith(p);
  }).catch(() => zhFail(box));
}
function zhGrammarItem(id) {
  const box = zhLoading(); main.append(box);
  zhGrammar().then(all => {
    if (!box.isConnected) return;
    const i = all.findIndex(g => g.id === id), g = all[i];
    if (!g) { box.innerHTML = '<p class="muted">見つかりませんでした。</p><a class="btn" href="#zh/grammar">一覧へ</a>'; return; }
    if (zhGuest() && zhLvNum(g.lv) > 1) { box.remove(); return zhLocked(g.title); }
    const prev = all[i - 1], next = all[i + 1];
    const p = h(`<article class="panel zh-article"><a class="small" href="#zh/grammar/${g.lv}">← ${g.lv} 文法</a>
      <div class="row between"><span class="tag lv">${g.lv}</span></div>
      <div class="row between"><h2>${esc(g.title)}</h2>${favBtn('g', g.p, g.title, 'zh')}</div><div class="zh-gp" ${ZHL}>${esc(g.p)}</div>
      <p>${esc(g.ja)}</p>
      <h3>例文</h3>${g.eg.map(([zh, py, ja]) => `<div class="zh-ex"><div class="row"><span ${ZHL}>${zhTap(zh)}</span>${exSayBtn(zh, 'zh-CN')}${shadowBtn(zh, py, ja, 'zh')}</div><div class="zh-py small">${esc(py)}</div><div class="small muted">${esc(ja)}</div></div>`).join('')}${!['HSK1', 'HSK2'].includes(g.lv) && !isMember('zh') ? `<p class="small muted">ほかの例文はメンバー向けです <a href="#vip">メンバーについて ›</a></p>` : ''}
      <div class="zh-memo ng"><b class="small">ワンポイント</b><p>${esc(g.tip)}</p></div>
      <div class="row"><button class="btn pri" type="button" data-q>練習問題（${g.q.length}問）</button></div>
      <div class="row between">${prev ? `<a class="btn ghost" href="#zh/grammar/${prev.id}">← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="btn ghost" href="#zh/grammar/${next.id}">${esc(next.title)} →</a>` : ''}</div></article>`);
    p.querySelector('[data-q]').onclick = () => zhRunQuiz(g.q.map(q => ({ kind: 'grammar', options: q.opts, answer: q.a, explain: esc(q.why), prompt: `<div class="eyebrow">${esc(g.title)}</div><div class="duel-m">${esc(q.q)}</div>` })), g.title, 8, () => go(`zh/grammar/${g.id}`), 'g');
    if (!(S.zhGr = S.zhGr || {})[g.id]) { S.zhGr[g.id] = 1; addXP(3); save(); }
    box.replaceWith(p);
  }).catch(() => zhFail(box));
}

/* ---------- 听力 ---------- */
// 一句一句播放，每题自动播放一次，答完显示原文、拼音、翻译和解析。
// 每个人用自己的声音：第一个女声（F）和旁白（N）是 MeloTTS 的录音（index-zh.json，按原文）；
// 听力的每个说话人都是 Kokoro 的录音（index-zh-voices.json，按「说话人|原文」；会员题在私有存储，索引 audio/zh-voices.json）：
// 男声（M、M2）、女声（F：晓伊，F2）同一个引擎，听起来是一个整体。女声（F、N）没有 Kokoro 录音时用原来的 MeloTTS 录音
// （读物里的句子也走这里，用的是 MeloTTS）；男声没有录音就不播（不拿女声的录音冒充），接下一句。
let zhListenLv = '';
let ZH_VOICES = null, ZH_VOICES_READY = null;
const zhVoiceIdx = () => ZH_VOICES || (ZH_VOICES = jsonOr(`${AUD_EN}index-zh-voices.json`).then(d => (ZH_VOICES_READY = d)));
function zhPlayLines(lines, onDone) {
  let i = 0, stop = false;
  const el = langPlayer();
  const next = () => {
    if (stop || i >= lines.length) { el.onended = null; if (!stop && onDone) onDone(); return; }
    const [spk, zh] = lines[i++];
    const key = `${spk}|${zh}`, female = spk === 'F' || spk === 'N';
    const file = (ZH_VOICES_READY || {})[key] || (female ? (LANG_IDX_READY.zh || {})[zh] : null);
    // 会员题：录音在私有存储里，取临时地址（女声先找 Kokoro 的，没有再找 MeloTTS 的）
    if (!file && S.voiceSrc !== 'tts' && typeof memberTextAudio === 'function' && isMember('zh')) {
      langUnlock();
      memberTextAudio('zh', key, 'zh-voices').then(u => u || (female ? memberTextAudio('zh', zh, 'zh') : null))
        .then(u => { if (!stop) playLine(u); }, () => { if (!stop) playLine(null); });
      return;
    }
    playLine(file);
  };
  const playLine = file => {
    if (!file) return noVoice(next);   // 没有录音：不用手机朗读，接下一句
    el.src = audUrl(file); el.defaultPlaybackRate = el.playbackRate = 1;
    el.onended = () => setTimeout(next, 350);
    el.play().catch(() => { el.onended = null; });
  };
  stopSpeech(); el.pause();
  // 两个录音目录都加载好了再开始（第一次要等网络：先在点击当下解锁播放器，iPhone 才能接着自动播放）
  const go = () => { if (!stop) next(); };
  if (LANG_IDX_READY.zh && ZH_VOICES_READY) go();
  else { langUnlock(); Promise.all([langAudioIdx('zh'), zhVoiceIdx()]).then(go, go); }
  return () => { stop = true; el.pause(); el.onended = null; if (hasTTS) speechSynthesis.cancel(); };
}
function zhListenPage() {
  const box = zhLoading(); main.append(box);
  zhListen().then(all => {
    if (!box.isConnected) return;
    if (!all.length) { box.innerHTML = '<h2>リスニング</h2><p class="muted">準備中です。</p>'; return; }
    const done = S.zhLs = S.zhLs || {};
    const lv = zhListenLv || zhLevel();
    const pool = all.filter(x => x.lv === lv);
    const p = h(`<section class="panel"><h2>リスニング</h2>
      <p class="muted">会話やアナウンスを聞いて答えます。答えたあとで原文・ピンイン・日本語訳を確認できます。</p>
      <div class="seg zh-lvseg">${ZH_LEVELS.map(([L]) => `<button type="button" data-lv="${L}" class="${L === lv ? 'on' : ''}">${L}</button>`).join('')}</div>
      <div class="row"><button class="btn pri big" type="button" data-lstart ${pool.length ? '' : 'disabled'}>${Math.min(5, pool.length)} 問に挑戦</button>
        <span class="small muted">${lv}：${pool.length} 問 · 解いた ${pool.filter(x => done[x.id]).length} 問</span></div>
      ${pool.length ? `<ol class="ls-list">${pool.map((x, k) => `<li><button type="button" class="ls-item${done[x.id] ? ' done' : ''}" data-one="${k}">
        <span class="ls-n">${done[x.id] ? '✓' : k + 1}</span><span class="ls-b"><span class="ls-q">${esc(x.q)}</span><span class="small muted">${esc(x.t || '')}</span></span></button></li>`).join('')}</ol>` : ''}</section>`);
    p.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => { zhListenLv = b.dataset.lv; render(); }; });
    // 一覧から 1 問だけ解く（会員向けの級は同じ判定）
    p.querySelectorAll('[data-one]').forEach(b => { b.onclick = () => { if (zhGuest() && zhLvNum(lv) > 2) return zhLocked('リスニング ' + lv); zhListenRun([pool[+b.dataset.one]]); }; });
    p.querySelector('[data-lstart]').onclick = () => {
      if (zhGuest() && zhLvNum(lv) > 2) return zhLocked('リスニング ' + lv);
      const fresh = pool.filter(x => !done[x.id]);
      zhListenRun([...shuffle(fresh), ...shuffle(pool.filter(x => done[x.id]))].slice(0, 5));
    };
    box.replaceWith(p);
  }).catch(() => zhFail(box));
}
function zhListenRun(items, back = 'zh/listen') {   // back：やめた・もう一度のときに戻る場所（今週のピックアップから来たらその号へ）
  let i = 0, right = 0, stopPlay = null;
  main.innerHTML = '';
  const box = h(`<section class="panel quiz"><div class="row between"><h2>リスニング</h2><button class="btn ghost" type="button" data-exit>やめる</button></div>
    <div class="progress-top"><span class="small" data-count></span><div class="bar"><i data-bar style="width:0"></i></div></div><div data-stage></div></section>`);
  main.append(box); focusMode(true);
  const stage = box.querySelector('[data-stage]');
  const quit = () => { if (stopPlay) stopPlay(); focusMode(false); };
  box.querySelector('[data-exit]').onclick = async () => { if (i && i < items.length && !await askConfirm('やめますか？', 'やめる', '続ける')) return; quit(); go(back); };
  const show = () => {
    const x = items[i];
    box.querySelector('[data-count]').textContent = `${i + 1} / ${items.length}`;
    box.querySelector('[data-bar]').style.width = (i / items.length * 100) + '%';
    stage.innerHTML = `<div class="q-prompt"><div class="eyebrow">${esc(x.lv)} · ${esc(x.t)}</div>
      <button type="button" class="speak zh-play" data-play>${SPEAK_SVG}<span>聞く</span></button><div class="duel-m">${esc(x.q)}</div></div>
      <div class="opts">${x.opts.map((o, k) => `<button class="opt" type="button" data-o="${k}"><span class="k">${k + 1}</span><span>${esc(o)}</span></button>`).join('')}</div><div data-fb></div>`;
    const play = () => { if (stopPlay) stopPlay(); stopPlay = zhPlayLines(x.lines); };
    stage.querySelector('[data-play]').onclick = play;
    audioPrime(); setTimeout(play, 300);   // 点击当下先解锁播放器（iPhone）
    stage.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => pick(+b.dataset.o); });
  };
  const pick = k => {
    const x = items[i], ok = k === x.a;
    if (stage.querySelector('[data-fb]').innerHTML) return;
    if (typeof actLog === 'function') actLog('l', 'zh');
    if (ok) { right++; addXP(10); } else save();
    (S.zhLs = S.zhLs || {})[x.id] = ok ? 2 : 1;
    if (typeof weakNote === 'function') weakNote('zh', `l:${x.id}`, ok, { sk: 'l', l: x.q || x.t || '', m: (x.opts || [])[x.a] || '', href: '#zh/listen' });   // 弱点ノート
    save();
    buzz(ok ? 12 : [30, 50, 30]);
    stage.querySelectorAll('[data-o]').forEach((b, j) => { b.disabled = true; if (j === x.a) b.classList.add('right'); else if (j === k) b.classList.add('wrong'); });
    stage.querySelector('[data-fb]').innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}">${neko(ok ? 'happy' : 'sad', 'mini')}<div class="fb-t"><b>${ok ? '正解！' : 'ドンマイ！'}</b><p class="small">${esc(x.why)}</p></div></div>
      <details class="zh-script" open><summary class="small">スクリプト</summary>${x.lines.map(([spk, zh, ja, py]) => `<div class="zh-sent"><div class="row"><b class="small muted">${{ M: '男', M2: '男2', F2: '女2' }[spk] || '女'}</b><span ${ZHL}>${zhTap(zh)}</span>${zhSayBtn(zh)}</div><div class="zh-py small">${esc(py)}</div><div class="small muted">${esc(ja)}</div></div>`).join('')}
      ${x.words.length ? `<div class="small zh-lw">${x.words.map(([w, py, ja]) => `<span><b ${ZHL}>${esc(w)}</b> ${esc(py)} ${esc(ja)}</span>`).join('')}</div>` : ''}</details>
      <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-next>${i + 1 < items.length ? '次へ' : '結果を見る'}</button></div>`;
    stage.querySelector('[data-next]').onclick = () => { if (stopPlay) stopPlay(); i++; if (i < items.length) show(); else end(); };
  };
  const end = () => {
    quit();
    stage.innerHTML = `<div class="welcome-hi">${neko(right >= items.length - 1 ? 'cheer' : 'happy', 'big')}<div class="bubble"><b>${right} / ${items.length} 問正解</b><span>${right === items.length ? '完璧！耳がどんどん中国語に慣れてきています。' : '聞き取れなかった問題は、スクリプトを見ながらもう一度聞くと効果的です。'}</span></div></div>
      <div class="row"><button class="btn pri" type="button" data-again>${back === 'zh/listen' ? 'もう一度' : '戻る'}</button><a class="btn" href="#zh">今日へ</a></div>`;
    box.querySelector('[data-bar]').style.width = '100%';
    stage.querySelector('[data-again]').onclick = () => go(back);
  };
  show();
}

/* ---------- 读物 ---------- */
let zhReadCat = '';
let ZH_READ_IDX = null;
let zhReadLv = '';   // 読み物の級フィルター（空 = いま学んでいる級）
function zhReadList() {
  const box = zhLoading(); main.append(box);
  Promise.all([zhRead(), ZH_READ_IDX || isMember('zh') ? null : fetch('lang/zh-read-index.json').then(r => r.ok ? r.json() : []).catch(() => [])]).then(([arts, idx]) => {
    if (idx) ZH_READ_IDX = idx;
    if (!box.isConnected) return;
    if (!arts.length) { box.innerHTML = '<h2>読み物</h2><p class="muted">読み物を準備中です。もうしばらくお待ちください。</p>'; return; }
    const done = S.zhRead || {};
    // 非会员：会员读物只显示标题（lang/zh-read-index.json），点进去提示会员
    if (!isMember('zh') && ZH_READ_IDX) arts = arts.concat(ZH_READ_IDX.filter(x => !arts.some(a => a.id === x.id)).map(x => Object.assign({ lock: 1, m: 1 }, x)));
    // 級で絞り込み（初期値はいま学んでいる級）。まだ読んでいないものを先に、20 本ずつ表示
    const lvSel = zhReadLv || zhLevel();
    const all = arts.filter(a => (!zhReadCat || a.cat === zhReadCat) && (lvSel === 'all' || a.lv === lvSel)).sort((x, y) => (done[x.id] ? 1 : 0) - (done[y.id] ? 1 : 0));
    let lim = 20;
    const shown = all;
    const p = h(`<section class="panel"><h2>読み物</h2>
      <p class="muted">中国の歴史・都市・グルメ・今どきの暮らしを、やさしい中国語で。ピンインと日本語訳つき、知らない単語はタップで意味が出ます。</p>
      <div class="seg read-lv" role="group" aria-label="級">${ZH_LEVELS.map(x => x[0]).map(L => `<button type="button" data-zlv="${L}" class="${lvSel === L ? 'on' : ''}">${L.replace('HSK', '')}</button>`).join('')}<button type="button" data-zlv="all" class="${lvSel === 'all' ? 'on' : ''}">すべて</button></div>
      ${pickSelect('ジャンル', 'data-cat', [['', 'すべて'], ...Object.entries(ZH_CAT).map(([k, [n]]) => [k, n])], zhReadCat || '')}
      ${all.length ? '' : '<p class="muted">この級・ジャンルの読み物はまだありません。ほかの級も見てみましょう。</p>'}
      <div class="zh-arts">${shown.map(a => `<a class="zh-art has-vip ${done[a.id] ? 'done' : ''}" href="${a.lock ? '#vip' : `#zh/read/${a.id}`}">${a.m ? vipTag() : ''}${a.ph ? `<span class="zh-art-ph">${zhArtImg(a)}</span>` : `<span class="course-ic">${ZH_CAT[a.cat] ? ZH_CAT[a.cat][1] : '读'}</span>`}<div><b>${esc(a.title_ja)}</b><span class="small" ${ZHL}>${esc(a.title)}</span><span class="small muted">${esc(a.intro_ja)}</span></div><span class="tag lv">${a.lv}</span>${done[a.id] ? '<span class="tag done">読了</span>' : ''}</a>`).join('')}</div></section>`);
    p.querySelector('[data-cat]').onchange = e => { zhReadCat = e.target.value; render(); };
    p.querySelectorAll('[data-zlv]').forEach(b => { b.onclick = () => { zhReadLv = b.dataset.zlv; render(); }; });
    // 20 本ずつ：残りは隠しておき「もっと見る」で表示
    const cards = [...p.querySelectorAll('.zh-arts > .zh-art')];
    const more = h('<div class="row read-more"><button class="btn" type="button">もっと見る（20 本）</button></div>');
    const page = () => { cards.forEach((c, i) => { c.hidden = i >= lim; }); more.hidden = cards.length <= lim; };
    more.querySelector('button').onclick = () => { lim += 20; page(); };
    p.querySelector('.zh-arts').after(more); page();
    p.querySelectorAll('.zh-art').forEach(a => {
      const art = shown.find(x => a.getAttribute('href').endsWith('/' + x.id));
      if (zhGuest() && art && zhLvNum(art.lv) > 3) a.querySelector('b').insertAdjacentHTML('beforeend', ' <span class="tile-lock" title="登録で解放">🔒</span>');
    });
    box.replaceWith(p);
  }).catch(() => zhFail(box));
}
function zhArticle(id) {
  const box = zhLoading(); main.append(box);
  zhRead().then(arts => {
    if (!box.isConnected) return;
    const a = arts.find(x => x.id === id);
    if (!a) { box.innerHTML = '<p class="muted">この読み物は見つかりませんでした。</p><a class="btn" href="#zh/read">一覧へ</a>'; return; }
    if (zhGuest() && zhLvNum(a.lv) > 3) { box.remove(); return zhLocked(a.title_ja); }
    const p = h(`<article class="panel zh-article">
      ${a.ph ? `<div class="ra-hero">${zhArtImg(a)}</div>${zhPhotoCredit(a)}` : ''}
      <a class="small" href="#zh/read">← 読み物一覧</a>
      <div class="row between"><span class="tag lv">${a.lv}</span><span class="small muted">${esc((ZH_CAT[a.cat] || [''])[0])}</span></div>
      <h2 ${ZHL}>${esc(a.title)}</h2><div class="zh-py muted">${esc(a.title_py)}</div><p class="muted">${esc(a.title_ja)}</p>
      <div data-tg></div>
      <div class="row"><button class="btn pri" type="button" data-all>${SPEAK_SVG}<span>全文を聞く</span></button><label class="switch"><input type="checkbox" data-loop${S.readLoop ? ' checked' : ''}> 🔁 くり返し再生</label></div>
      <p class="small muted">「くり返し再生」をオンにすると、全文を最後まで読んだら最初から繰り返します。文の横のスピーカーを押すと、その文をくり返します（もう一度押すと止まります）。</p>
      <div class="zh-text">${a.p.map(para => `<div class="zh-para">${para.map(([zh, ja, toks], k) => `<div class="zh-sent"><div class="zh-line" ${ZHL}>${zhRuby(toks)}<button class="speak" type="button" data-lsay="${esc(zh)}" data-lang="zh-CN" aria-label="読み上げ">${SPEAK_SVG}</button>${shadowBtn(zh, '', ja, 'zh')}${favBtn('s', zh, ja, 'zh')}</div><div class="zh-tr small muted">${esc(ja)}</div></div>`).join('')}</div>`).join('')}</div>
      <h3>単語</h3>
      <div class="zh-list">${a.w.map(([w, py, ja]) => `<div class="zh-row-w"><b ${ZHL}>${esc(w)}</b><span class="zh-py">${esc(py)}</span><span class="zh-ja">${esc(ja)}</span>${zhSayBtn(w)}</div>`).join('')}</div>
      ${a.note_ja ? `<h3>文化メモ</h3><p class="zh-memo">${esc(a.note_ja)}</p>` : ''}
      <div class="row"><button class="btn pri" type="button" data-q>内容チェック（${a.q.length}問）</button><a class="btn" href="#zh/read">一覧へ</a></div>
    </article>`);
    p.querySelector('[data-tg]').append(zhToggles(p));
    zhBindToks(p, a.gloss || {});
    // 全文を聞く：1文ずつ続けて読み、読んでいる文をハイライト。くり返し再生なら最後まで読んだら最初から
    const sEls = [...p.querySelectorAll('.zh-sent')], sents = a.p.flat(), allBtn = p.querySelector('[data-all]'), loopEl = p.querySelector('[data-loop]');
    let stopFn = null, run = 0;
    const mark = i => sEls.forEach((el, j) => el.classList.toggle('now', j === i));
    let repBtn = null;
    const stopAll = () => { run++; repBtn = null; if (stopFn) stopFn(); stopFn = null; mark(-1); allBtn.querySelector('span').textContent = '全文を聞く'; };
    const playFrom = (i, r) => {
      if (r !== run || !p.isConnected) return;
      if (i >= sents.length) { if (loopEl.checked) return setTimeout(() => playFrom(0, r), 1200); return stopAll(); }
      mark(i); if (sEls[i]) sEls[i].scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
      stopFn = zhPlayLines([['F', sents[i][0]]], () => playFrom(i + 1, r));
    };
    allBtn.onclick = () => { if (stopFn) return stopAll(); stopAll(); allBtn.querySelector('span').textContent = '停止'; playFrom(0, run); };
    loopEl.onchange = () => { S.readLoop = loopEl.checked; save(); };
    // 文ごとのスピーカー：くり返し再生がオンならその文をくり返す（もう一度押すと止まる）
    p.querySelectorAll('.zh-sent [data-lsay]').forEach(b => { b._say = () => {
      const again = repBtn === b; stopAll();
      if (!loopEl.checked) return false;   // オフ：ふつうに 1 回再生（lang.js）
      if (again) return true;
      const r = run, i = sEls.indexOf(b.closest('.zh-sent'));
      repBtn = b; allBtn.querySelector('span').textContent = '停止';
      const one = () => { if (r !== run || !p.isConnected) return; mark(i); stopFn = zhPlayLines([['F', b.dataset.lsay]], () => setTimeout(() => { if (r === run && loopEl.checked) one(); else if (r === run) stopAll(); }, 700)); };
      one(); return true;
    }; });
    addEventListener('hashchange', stopAll, { once: true });
    p.querySelector('[data-q]').onclick = () => {
      const qs = a.q.map(q => ({ kind: 'meaning', options: q.opts, answer: q.a, prompt: `<div class="eyebrow">${esc(a.title_ja)}</div><div class="duel-m">${esc(q.q)}</div>` }));
      zhRunQuiz(qs, a.title_ja, 10, () => go(`zh/read/${a.id}`));
    };
    if (typeof actLog === 'function') actLog('r', 'zh');
    if (!(S.zhRead = S.zhRead || {})[a.id]) { S.zhRead[a.id] = Date.now(); addXP(10); save(); }
    box.replaceWith(p);
  }).catch(() => zhFail(box));
}

/* ---------- 场景会话（样课） ---------- */
// 一課の行：会員課（lock）は会員ページへ
const zhCoRow = (t, l, i) => `<a class="zh-art has-vip" href="${l.lock ? '#vip' : `#zh/course/${t.id}/${l.id}`}">${i ? vipTag() : ''}<div><b>${esc(l.title)}</b></div><span class="tag lv">${esc(l.lv || '')}</span></a>`;
function zhCourseList() {
  const box = zhLoading(); main.append(box);
  zhCourse().then(idx => {
    if (!box.isConnected) return;
    const p = h(`<section class="panel"><h2>場面別会話</h2>
      <p class="muted">旅行・食事・仕事・友達づくり……。実際の場面の会話を、ネイティブの言い回しと文化の解説つきで。${isMember('zh') ? '' : '各テーマの第1課は無料、続きのレッスンはメンバー向けです。'}</p>
      ${idx.length ? `<div class="zh-arts">${idx.map(t => `<div class="zh-theme"><div class="row"><span class="course-ic">${esc(t.icon)}</span><div><b>${esc(t.title)}</b><div class="small muted">${esc(t.intro)}</div></div></div>
        ${zhCoRow(t, t.lessons[0], 0)}${t.lessons.length > 1 ? `<details class="zh-more"><summary class="small">続きのレッスン</summary>${t.lessons.slice(1).map((l, i) => zhCoRow(t, l, i + 1)).join('')}</details>` : ''}</div>`).join('')}</div>` : '<p class="muted">レッスンを準備中です。</p>'}
    </section>`);
    box.replaceWith(p);
  }).catch(() => zhFail(box));
}
function zhLesson(tid, lid) {
  const box = zhLoading(); main.append(box);
  zhTheme(tid).then(t => {
    if (!box.isConnected) return;
    if (lid && !t.lessons.some(x => x.id === lid) && !isMember('zh')) {   // 会員のレッスン（網站上没有内容）
      box.innerHTML = `<div class="has-vip">${vipTag()}<a class="small" href="#zh/course">← 場面別会話</a><h2>${esc(t.title || '')}</h2><p>このレッスンはメンバー向けです。各テーマの第1課は無料で学べます。</p><div class="row"><a class="btn pri" href="#vip">メンバーについて</a><a class="btn" href="#zh/course/${esc(tid)}/${esc((t.lessons[0] || {}).id || '')}">第1課を学ぶ</a></div></div>`;
      return;
    }
    const l = t.lessons.find(x => x.id === lid) || t.lessons[0];
    if (!l || l.soon) { box.innerHTML = '<p class="muted">このレッスンは準備中です。</p><a class="btn" href="#zh/course">一覧へ</a>'; return; }
    const who = Object.fromEntries((l.who || []).map(w => [w.k, w]));
    const p = h(`<article class="panel zh-article zh-lesson">
      <a class="small" href="#zh/course">← 場面別会話</a>
      <div class="row between"><span class="tag lv">${esc(l.lv || '')}</span><span class="small muted">${esc(t.title)}</span></div>
      <h2>${esc(l.title)}</h2>
      ${l.scene ? `<p class="zh-memo">${esc(l.scene)}</p>` : ''}
      ${(l.who || []).length ? `<div class="zh-who">${l.who.map(w => `<div><b ${ZHL}>${esc(w.name)}</b><span class="small muted">${esc(w.role || '')}</span></div>`).join('')}</div>` : ''}
      ${l.relation ? `<p class="small muted">${esc(l.relation)}</p>` : ''}
      <div data-tg></div>
      <div class="zh-text">${l.lines.map(x => `<div class="zh-sent zh-talk ${who[x.k] && who[x.k] === l.who[0] ? 'a' : 'b'}"><span class="zh-who-n small" ${ZHL}>${esc((who[x.k] || {}).name || x.k)}</span>
        <div class="zh-line" ${ZHL}>${zhRuby(x.toks)}<button class="speak" type="button" data-lsay="${esc(x.zh)}" data-lang="zh-CN" aria-label="読み上げ">${SPEAK_SVG}</button>${shadowBtn(x.zh, x.py, x.ja, 'zh')}${favBtn('s', x.zh, x.ja, 'zh')}</div>
        <div class="zh-tr small muted">${esc(x.ja)}</div>${x.note ? `<details class="zh-note-d"><summary class="small">解説</summary><p class="small">${esc(x.note)}</p></details>` : ''}</div>`).join('')}</div>
      ${(l.words || []).length ? `<h3>単語</h3><div class="zh-wlist">${l.words.map(([w, py, ja, use]) => `<div class="zh-wl"><div class="row"><b ${ZHL}>${esc(w)}</b><span class="zh-py">${esc(py)}</span>${zhSayBtn(w)}</div><div>${esc(ja)}</div>${use ? `<div class="small muted">${esc(use)}</div>` : ''}</div>`).join('')}</div>` : ''}
      ${(l.patterns || []).length ? `<h3>文型</h3>${l.patterns.map(pt => `<div class="zh-pat"><div><b ${ZHL}>${esc(pt.p)}</b>${pt.m ? `　<span>${esc(pt.m)}</span>` : ''}</div>${pt.how ? `<div class="small zh-py" ${ZHL}>${esc(pt.how)}</div>` : ''}<p class="small">${esc(pt.ja || pt.explain || '')}</p>${(pt.eg || []).map(([zh, py, ja]) => `<div class="small zh-ex"><div class="row"><span ${ZHL}>${zhTap(zh)}</span>${zhSayBtn(zh)}</div><div class="zh-py muted">${esc(py)}</div><div class="muted">${esc(ja)}</div></div>`).join('')}</div>`).join('')}` : ''}
      ${l.context ? `<h3>場面のポイント</h3>${typeof l.context === 'string' ? `<p class="zh-memo">${esc(l.context)}</p>` : `<div class="zh-ctx">${[['ok', '◎ こう言えば伝わる'], ['ng', '△ 気をつけたいこと'], ['feel', '♡ 相手の気持ち']].filter(([k]) => l.context[k]).map(([k, t]) => `<div class="zh-memo ${k}"><b class="small">${t}</b><p>${esc(l.context[k])}</p></div>`).join('')}</div>`}` : ''}
      ${l.culture ? `<h3>文化メモ</h3><p class="zh-memo">${esc(typeof l.culture === 'string' ? l.culture : JSON.stringify(l.culture))}</p>` : ''}
      ${(l.quiz || []).length ? `<div class="row"><button class="btn pri" type="button" data-q>確認クイズ（${l.quiz.length}問）</button></div>` : ''}
    </article>`);
    p.querySelector('[data-tg]').append(zhToggles(p));
    zhBindToks(p, l.gloss || {});
    const qb = p.querySelector('[data-q]');
    if (qb) qb.onclick = () => zhRunQuiz(l.quiz.map(q => ({ kind: 'meaning', options: q.opts || q.options, answer: q.a != null ? q.a : q.answer, explain: q.why ? esc(q.why) : '', prompt: `<div class="eyebrow">${esc(l.title)}</div><div class="duel-m">${esc(q.q)}</div>` })), l.title, 10, () => go(`zh/course/${tid}/${l.id}`), 'c');
    box.replaceWith(p);
  }).catch(() => zhFail(box));
}

/* ---------- 单词、文法例句：点词看释义（和读物一样） ---------- */
// 例句没有预先分词：按 HSK 词表最长匹配；单字的虚词（的、了、是…）不画线
const ZH_STOP = new Set([...'的了是在我你他她它们这那有不也都就和吗呢吧啊很个一二三四五六七八九十上下里去来到说要会能对着过把被给让从向跟比还又再才']);
function zhSegHTML(s) {
  let out = '';
  for (let i = 0; i < s.length;) {
    let w = '';
    if (/[一-鿿]/.test(s[i])) for (let j = Math.min(s.length, i + 6); j > i; j--) { const c = s.slice(i, j); if (ZH_BY[c] && (c.length > 1 || !ZH_STOP.has(c))) { w = c; break; } }
    if (w) { out += `<span class="zw" data-zw="${esc(w)}">${esc(w)}</span>`; i += w.length; } else { out += esc(s[i]); i++; }
  }
  return out;
}
let zhTapPending = false;
function zhTap(s) {
  if (!s) return '';
  if (ZH_BY) return `<span class="ztap on">${zhSegHTML(s)}</span>`;
  if (!zhTapPending) { zhTapPending = true; zhIndex().then(() => { zhTapPending = false; document.querySelectorAll('.ztap:not(.on)').forEach(el => { el.innerHTML = zhSegHTML(el.textContent); el.classList.add('on'); }); }).catch(() => { zhTapPending = false; }); }
  return `<span class="ztap">${esc(s)}</span>`;
}
document.addEventListener('click', e => {
  const el = e.target.closest('.ztap .zw');
  if (!el || !ZH_BY || !ZH_BY[el.dataset.zw]) return;
  e.stopPropagation();
  if (!glossOK()) return;
  zhSheet(ZH_BY[el.dataset.zw]);
}, true);
