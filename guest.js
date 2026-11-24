// 游客模式：不注册也能先体验入门内容，进度只存在这台设备上；更多内容注册（免费）后解锁。
// 开放：日语 N5 的单词 / 汉字 / 语法、假名、闯关前 3 关、每天 1 篇阅读、每天 1 道听力、词典；
//       英语 A1 的单词、语法、阅读（每天 1 篇）、听力、每个情景课程主题的第 1 课；中文的游客限制在 zh.js（zhGuest）。
// 需要注册：更高级别、模拟考、商务、动漫·日剧、翻译练习。登录后游客进度会合并到账号（见 cloud.js 的 cloudPull）。
const GUEST_KEY = 'nihongo-dojo:guest';
const GUEST_STAGES = 3;
const guestFlag = () => { try { return localStorage.getItem(GUEST_KEY) === '1'; } catch (e) { return false; } };
function setGuest(on) { try { if (on) localStorage.setItem(GUEST_KEY, '1'); else localStorage.removeItem(GUEST_KEY); } catch (e) { /* 无痕模式 */ } }
const isGuest = () => typeof CLOUD !== 'undefined' && CLOUD.requireLogin && !sbUser && guestFlag();
const guestDay = () => { const d = S.guestDay; return d && d.d === dkey() ? d : (S.guestDay = { d: dkey() }); };

// 这个页面游客能不能看：能看返回 null，不能看返回锁定说明
function guestLock(view, arg) {
  if (!isGuest()) return null;
  const sub = arg || '', tr = view === 'en' ? 'en' : 'ja';
  const lock = (what, extra) => ({ what, tr, extra });
  if (tr === 'ja') {
    if (['exam', 'biz', 'anime', 'trans', 'dictation'].includes(view)) return lock({ exam: tj('模拟考', '模擬試験'), biz: tj('商务日语', 'ビジネス日本語'), anime: tj('动漫·日剧名台词', 'アニメ・ドラマの名セリフ'), trans: tj('翻译练习', '翻訳練習'), dictation: tj('听写', 'ディクテーション') }[view]);
    if (['vocab', 'kanji', 'grammar', 'conj'].includes(view) && S.level !== 'N5') return lock(tj(`${S.level} 的内容`, `${S.level} のコンテンツ`), { n5: true });
    if (view === 'listen') return guestDay().listen ? lock(tj('更多听力（今天的试听题已经做过了）', 'もっと多くのリスニング（今日のお試し問題は解答済みです）')) : lock(tj('完整的听力练习', 'すべてのリスニング練習'), { listen: true });
    if (view === 'read' && sub) return guestRead(sub, lock);
    // 情景课程：每个主题的第 1 课可以试听
    if (view === 'course' && sub.split('/')[1] && +sub.split('/')[1].split('-').pop() > 1) return lock(tj('全部情景课程（游客每个主题可以先学第 1 课）', 'すべての場面別レッスン（ゲストは各テーマの第 1 課まで）'));
    return null;
  }
  // 英语（en.js）：A1 的单词、语法、阅读、听力，情景课程每个主题的第 1 课，学习路线前 3 关；其余注册后解锁
  const [s, a1, a2] = sub.split('/');
  if (['exam', 'biz', 'trans', 'dictation'].includes(s)) return lock({ exam: tj('模拟考', '模擬試験'), biz: tj('商务英语', 'ビジネス英語'), trans: tj('翻译练习', '翻訳練習'), dictation: tj('听写', 'ディクテーション') }[s]);
  if (['words', 'grammar', 'listen', 'path'].includes(s) && a1 && a1 !== 'A1') return lock(tj(`${a1} 的内容`, `${a1} のコンテンツ`));
  if (s === 'read' && a1) {
    const lv = /^r-/.test(a1) ? a1.split('-')[1] : a1;
    if (lv !== 'A1') return lock(tj(`${lv} 的阅读`, `${lv} の読み物`));
    if (/^r-/.test(a1)) return guestRead('en|' + a1, lock);
  }
  if (s === 'course' && a2 && +a2.split('-').pop() > 1) return lock(tj('全部情景课程（游客每个主题可以先学第 1 课）', 'すべての場面別レッスン（ゲストは各テーマの第 1 課まで）'));
  return null;
}
// 阅读：每天可以完整读 1 篇
function guestRead(id, lock) {
  const d = guestDay();
  if (!d.read) { d.read = id; save(); return null; }
  return d.read === id ? null : lock(tj('更多文章（游客每天可以读 1 篇，今天已经读过了）', 'もっと多くの文章（ゲストは 1 日 1 本まで。今日はもう読みました）'));
}
// 闯关：前 3 关
function guestStage(where, n) {
  if (!isGuest() || n <= GUEST_STAGES && (where === 'ja' ? S.level === 'N5' : true)) return false;
  main.innerHTML = '';
  main.append(lockPanel({ what: tj(`第 ${GUEST_STAGES + 1} 关以后的关卡${where === 'ja' && S.level !== 'N5' ? `和 ${S.level}` : ''}`, `ステージ ${GUEST_STAGES + 1} 以降${where === 'ja' && S.level !== 'N5' ? `と ${S.level}` : ''}`), tr: where }));
  return true;
}

function lockPanel(lk) {
  const T = lk.tr === 'ja' ? null : TRACKS[lk.tr];
  if (uiJa()) return lockPanelJa(lk, T);
  const p = h(`<section class="panel lock-panel">
    <div class="lock-ic" aria-hidden="true">🔒</div>
    <h2>注册后解锁${esc(lk.what)}</h2>
    <p class="muted">你现在是游客模式，可以先体验入门内容。免费注册一个账号，就能学到全部内容：</p>
    <ul class="lock-list">
      <li>${T ? `${esc(T.title)}全部级别的单词、语法和阅读` : 'N5 到 N1 全部单词、汉字、语法和阅读'}</li>
      <li>${T ? '' : '全部情景课程（校园、恋爱、打工、职场、留学）、'}模拟考、听力、商务、${T ? '影视' : '动漫·日剧'}名台词、翻译练习</li>
      <li>学习进度云端同步，换手机、换浏览器都不丢</li>
      <li>学习提醒，到点提醒你今天还没学</li>
    </ul>
    <div class="row"><button class="btn pri big" type="button" data-signup>免费注册</button><button class="btn" type="button" data-login>已有账号，登录</button></div>
    ${lk.extra && lk.extra.listen ? '<div class="row"><button class="btn ghost" type="button" data-try>先试听今天的 1 道题</button></div>' : ''}
    ${lk.extra && (lk.extra.n5 || lk.extra.lvReset || lk.extra.lvLevels) ? '<div class="row"><button class="btn ghost" type="button" data-back>回到入门级别继续学</button></div>' : ''}
    <p class="small muted">注册不收费。游客期间的进度会在登录后合并到账号里。</p>
  </section>`);
  return lockPanelWire(p, lk);
}
// 学中文的日本用户：锁定说明用日语
function lockPanelJa(lk, T) {
  const p = h(`<section class="panel lock-panel">
    <div class="lock-ic" aria-hidden="true">🔒</div>
    <h2>${esc(lk.what)}は無料登録で利用できます</h2>
    <p class="muted">いまはゲストモードで、入門コンテンツをお試しいただけます。無料でアカウントを作成すると、すべてのコンテンツで学べます。</p>
    <ul class="lock-list">
      <li>${T ? `${esc(T.title)}の全レベルの単語・文法・読解` : 'すべてのレベルの単語・文法・読解'}</li>
      <li>模擬試験・リスニング・ビジネス・名セリフ・翻訳練習</li>
      <li>学習の進み具合をクラウドに保存。機種変更やブラウザを変えても消えません</li>
      <li>学習リマインダー：まだ学習していない日に通知でお知らせ</li>
    </ul>
    <div class="row"><button class="btn pri big" type="button" data-signup>無料で登録</button><button class="btn" type="button" data-login>アカウントをお持ちの方はログイン</button></div>
    ${lk.extra && lk.extra.listen ? '<div class="row"><button class="btn ghost" type="button" data-try>今日のお試し問題を 1 問解く</button></div>' : ''}
    ${lk.extra && (lk.extra.n5 || lk.extra.lvReset || lk.extra.lvLevels) ? '<div class="row"><button class="btn ghost" type="button" data-back>入門レベルに戻って続ける</button></div>' : ''}
    <p class="small muted">登録は無料です。ゲスト中の学習記録はログイン後にアカウントへ引き継がれます。</p>
  </section>`);
  return lockPanelWire(p, lk);
}
function lockPanelWire(p, lk) {
  p.querySelector('[data-signup]').onclick = e => { e.stopPropagation(); authScreen('signup'); };
  p.querySelector('[data-login]').onclick = e => { e.stopPropagation(); authScreen('login'); };
  const back = p.querySelector('[data-back]');
  if (back) back.onclick = () => {
    if (lk.extra.n5) { S.level = 'N5'; save(); }
    render();
  };
  const tr = p.querySelector('[data-try]');
  if (tr) tr.onclick = () => guestListenOne(lk.tr);
  return p;
}
// 每天 1 道试听题
function guestListenOne(tr) {
  const d = guestDay(); d.listen = 1; save();
  const go = (qs, L) => runListen(qs, L, { title: tj('今日试听', '今日のお試し'), again: () => render() });
  if (tr === 'ja') {
    if (typeof LISTEN !== 'undefined') return go(sample(LISTEN.N5, 1), 'N5');
    const s = document.createElement('script'); s.src = 'listening.js';
    s.onload = () => ovlReady('en/ja-listen.json').then(() => go(sample(LISTEN.N5, 1), 'N5')); document.body.append(s);
    return;
  }
  const lv = LV_NAMES[tr][0];
  l2Fetch(tr, 'listen').then(list => go(sample(list.filter(x => x.lv === lv), 1), lv)).catch(() => toast(tj('加载失败，请检查网络', '読み込みに失敗しました。ネットワークを確認してください')));
}

// 首页顶部提示
function guestBanner(anchor) {
  if (!isGuest() || !anchor.isConnected) return;
  // 一行小横条，不占地方
  const b = h(`<section class="guest-bar"><span class="gb-t"><b>${tj('游客模式', 'ゲストモード')}</b><span class="small muted">${tj(' · 进度只存在这台设备上', ' · 記録はこの端末だけに保存')}</span></span>
    <button class="btn pri small" type="button" data-s>${tj('注册', '登録')}</button><button class="btn ghost small" type="button" data-l>${tj('登录', 'ログイン')}</button></section>`);
  b.querySelector('[data-s]').onclick = e => { e.stopPropagation(); authScreen('signup'); };
  b.querySelector('[data-l]').onclick = e => { e.stopPropagation(); authScreen('login'); };
  anchor.after(b);
}
// 入口方块上的小锁
const guestLockedHref = href => isGuest() && /#((ko|en)\/)?(exam|biz|anime|quotes|trans|dictation)$/.test(href);
