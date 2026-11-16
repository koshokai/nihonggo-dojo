// 功能地图（「我的 → 功能地图」）：把藏得比较深的功能列出来，点一下就去用；没看过的标 NEW。日语板块中文、中文板块日语。
const TOUR_JA = [
  ['swipe', '👆', '左右滑动换页', '在「今天」「学习」这些主页面上左右滑，就能切到相邻的页面。在「今天」再往右滑，有个秘密抽屉……', null],
  ['commute', '🎧', '通勤听力', '戴上耳机按开始，单词、意思、例句自动连续播放，坐车走路都能学。', '#commute'],
  ['fav', '⭐', '收藏夹', '单词卡、例句、语法旁边的 ☆ 点一下就收藏，可以集中复习、导出 Anki。', '#fav'],
  ['write', '✍️', '写一写', '五十音图里点假名，或者在汉字页，都能跟着笔顺一笔一笔写。', '#kana'],
  ['order', '🧩', '翻译排序', '翻译练习可以选「排序」：把打乱的词块排成句子，对完答案有语序解说。', '#trans'],
  ['exam', '🎯', '考试目标', '设定 JLPT 日期，显示倒计时和每天该学多少，考前一个月自动冲刺。', '#me/exam'],
  ['demon', '😈', '魔鬼挑战', '觉得 N1 太简单？单词页右上角有魔鬼挑战：难读词、促音浊音长音专挑你看走眼的地方。', '#vocab'],
  ['calendar', '📅', '学习日历', '每天学了多少一目了然，断签了还能用经验补签。', '#calendar'],
  ['pitch', '🎤', '发音检查', '例句旁的麦克风：读一遍，看你和标准录音的音调曲线有多像。', null]
];
const TOUR_ZH = [
  ['swipe', '👆', '左右スワイプ', '「今日」「学ぶ」などのページは左右にスワイプで切り替え。「今日」でさらに右へスワイプすると、ひみつの引き出しが……', null],
  ['path', '🗺️', '学習ルート', '10 語ずつのステージをクリアしていく、ゲーム感覚の単語学習です。', '#zh/path'],
  ['strokes', '✍️', '書き順・手書き', '単語カードの「書き順・手書き」で、漢字を 1 画ずつなぞって練習できます。', '#zh/words'],
  ['commute', '🎧', '通勤リスニング', 'イヤホンでスタートするだけ。単語・意味・例文が自動で流れます。', '#commute'],
  ['fav', '⭐', 'お気に入り', '単語や例文の ☆ をタップして保存。まとめて復習できます。', '#fav'],
  ['pitch', '🎤', '発音チェック', '例文のマイクボタンで読み上げると、お手本との音の高さの違いがグラフで見られます。', null],
  ['calendar', '📅', '学習カレンダー', '毎日の学習量がひと目でわかり、連続記録が切れても XP で補えます。', '#calendar']
];
const tourList = () => S.track === 'zh' ? TOUR_ZH : TOUR_JA;
// 「我的 → 功能地图」
function featuresPanel() {
  const J = uiJa(), seen = S.tour || {};
  const p = h(`<section class="panel"><h2>${J ? '機能マップ' : '功能地图'}</h2><p class="muted">${J ? '便利な機能をまとめました。気になるものをタップしてみてください。' : '把容易被忽略的功能列在这里，点一下就能去用。'}</p>
    <div class="feat-list">${tourList().map(([id, ic, title, text, href]) => `<${href ? `a href="${href}"` : 'div'} class="feat ${seen[id] ? '' : 'new'}"><span class="feat-ic">${ic}</span><div><b>${esc(title)}</b>${seen[id] ? '' : `<span class="tag">NEW</span>`}<div class="small muted">${esc(text)}</div></div></${href ? 'a' : 'div'}>`).join('')}</div></section>`);
  const again = h(`<p><button type="button" class="btn soft" data-intro>${typeof tje === 'function' ? tje('再看一遍使用介绍', '使い方の紹介をもう一度見る', 'Show the tour again') : '再看一遍使用介绍'}</button></p>`);
  again.querySelector('[data-intro]').onclick = introShow; p.append(again);
  p.querySelectorAll('.feat').forEach((el, i) => { el.addEventListener('click', () => { S.tour = Object.assign(S.tour || {}, { [tourList()[i][0]]: Date.now() }); save(); }); });
  return p;
}

/* ---------- 第一次打开时的介绍：一步一步，可以跳过；之后在「我的 → 功能地图」里能再看 ---------- */
// [图标, 中文标题, 中文说明, 日语标题, 日语说明, 英语标题, 英语说明]
const INTRO = [
  ['icon', '欢迎来到猫先生', '日语、中文、英语，一个 App 一起学。先花半分钟看看怎么用。', '猫先生へようこそ', '日本語・中国語・英語をひとつのアプリで。まずは 30 秒で使い方をご紹介します。', 'Welcome to 猫先生', 'Japanese, Chinese and English in one app. Here is a 30-second tour.'],
  ['📅', '每天几分钟', '「今天」页会排好当天的任务：新单词、到期的复习、一篇短文。照着做完就可以了。', '1 日数分でOK', '「今日」のページに、その日のタスク（新しい単語・復習・短い読み物）が並びます。順番にこなすだけです。', 'A few minutes a day', 'The Today page lines up your tasks: new words, reviews that are due, and a short story. Just follow the list.'],
  ['🔊', '能听，能点', '例句和文章都有录音。点句子听发音，点单词看意思，点 ☆ 收藏起来以后复习。', '聞ける・タップできる', '例文と読み物には音声があります。文をタップで再生、単語をタップで意味を表示、☆ でお気に入りに保存できます。', 'Listen and tap', 'Examples and stories have audio. Tap a sentence to hear it, tap a word to see its meaning, tap ☆ to save it.'],
  ['🧠', '自动安排复习', '学过的内容会按记忆规律自动回来复习。闯关、模拟考试和水平测试，随时检查自己的进步。', '復習は自動で', '学んだ内容は、忘れかけた頃に自動で復習に出てきます。ステージ・模擬試験・レベルチェックで上達を確認できます。', 'Reviews come back by themselves', 'What you learn returns for review just before you forget it. Stages, mock exams and the level check show your progress.'],
  ['⚙️', '随时可以调整', '级别、每天的量、发音和提醒都能在「我的」里改；顶部可以切换学习的语言。注册账号后进度会自动保存，换手机也不丢。', 'いつでも調整できます', 'レベル・1 日の量・音声・リマインダーは「マイページ」で変更できます。学ぶ言語は上部で切り替え。ログインすると記録が自動で保存されます。', 'Change anything, anytime', 'Level, daily amount, voice and reminders are under Me; switch languages at the top. Sign in to keep your progress across devices.']
];
const introSeen = () => { try { return !!localStorage.getItem('dojo-intro'); } catch (e) { return true; } };
function introShow() {
  if (document.querySelector('.intro-mask')) return;
  try { localStorage.setItem('dojo-intro', '1'); } catch (e) { /* 忽略 */ }
  const T = (z, j, e) => typeof tje === 'function' ? tje(z, j, e) : (uiJa() ? j : z);
  let i = 0;
  const m = h(`<div class="ask-mask intro-mask" role="dialog" aria-modal="true" aria-label="${T('使用介绍', '使い方', 'Tour')}"><div class="ask-box intro-box">
    <button type="button" class="intro-skip small" data-skip>${T('跳过', 'スキップ', 'Skip')}</button>
    <div class="intro-ic" data-ic aria-hidden="true"></div><h2 data-t></h2><p data-d></p>
    <div class="intro-dots" data-dots aria-hidden="true">${INTRO.map(() => '<i></i>').join('')}</div>
    <div class="row intro-btns"><button type="button" class="btn" data-prev>${T('上一步', '戻る', 'Back')}</button><button type="button" class="btn pri" data-next></button></div></div></div>`);
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); if (typeof applyTheme === 'function') applyTheme(); };
  const show = () => {
    const [ic, zt, zd, jt, jd, et, ed] = INTRO[i];
    const icEl = m.querySelector('[data-ic]');
    if (ic === 'icon') icEl.innerHTML = '<img src="icon-192.png" alt="" width="88" height="88">';   // 第一页用 App 图标（和桌面上的图标一样）
    else icEl.textContent = ic;
    m.querySelector('[data-t]').textContent = T(zt, jt, et);
    m.querySelector('[data-d]').textContent = T(zd, jd, ed);
    m.querySelectorAll('[data-dots] i').forEach((d, k) => d.classList.toggle('on', k === i));
    m.querySelector('[data-prev]').style.visibility = i ? '' : 'hidden';
    m.querySelector('[data-next]').textContent = i === INTRO.length - 1 ? T('开始', 'はじめる', 'Start') : T('下一步', '次へ', 'Next');
    m.querySelector('[data-skip]').style.visibility = i === INTRO.length - 1 ? 'hidden' : '';
  };
  const step = d => { if (i + d >= INTRO.length) return close(); i = Math.max(0, i + d); show(); };
  const onKey = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); step(1); } else if (e.key === 'ArrowLeft') step(-1); };
  m.querySelector('[data-skip]').onclick = close;
  m.querySelector('[data-next]').onclick = () => step(1);
  m.querySelector('[data-prev]').onclick = () => step(-1);
  // 左右滑动也能翻页
  let x0 = null;
  m.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  m.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); }, { passive: true });
  document.addEventListener('keydown', onKey);
  show();
  document.body.append(m);
  m.querySelector('[data-next]').focus();
}
