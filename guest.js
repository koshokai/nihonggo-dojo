// 游客模式：不注册也能先体验入门内容，进度只存在这台设备上；更多内容注册（免费）后解锁。
// 开放：日语 N5 的单词 / 汉字 / 语法、假名、闯关前 3 关、每天 1 篇阅读、每天 1 道听力、词典；
//       韩语、英语的字母、入门单词和常用句、最低一级的语法和分级词库、闯关前 3 关、每天 1 篇阅读、每天 1 道听力、词典。
// 需要注册：更高级别、模拟考、商务、动漫·日剧、翻译练习。登录后游客进度会合并到账号（见 cloud.js 的 cloudPull）。
const GUEST_KEY = 'nihongo-dojo:guest';
const GUEST_STAGES = 3;
const guestFlag = () => { try { return localStorage.getItem(GUEST_KEY) === '1'; } catch (e) { return false; } };
function setGuest(on) { try { if (on) localStorage.setItem(GUEST_KEY, '1'); else localStorage.removeItem(GUEST_KEY); } catch (e) { /* 无痕模式 */ } }
const isGuest = () => typeof CLOUD !== 'undefined' && CLOUD.requireLogin && !sbUser && guestFlag();
const GUEST_FIRST_LV = { ko: 'A', en: 'zk' };   // 分级词库最低一级
const guestDay = () => { const d = S.guestDay; return d && d.d === dkey() ? d : (S.guestDay = { d: dkey() }); };

// 这个页面游客能不能看：能看返回 null，不能看返回锁定说明
function guestLock(view, arg) {
  if (!isGuest()) return null;
  const sub = arg || '', tr = view === 'ko' || view === 'en' ? view : 'ja';
  const lock = (what, extra) => ({ what, tr, extra });
  if (tr === 'ja') {
    if (['exam', 'biz', 'anime', 'trans'].includes(view)) return lock({ exam: '模拟考', biz: '商务日语', anime: '动漫·日剧名台词', trans: '翻译练习' }[view]);
    if (['vocab', 'kanji', 'grammar'].includes(view) && S.level !== 'N5') return lock(`${S.level} 的内容`, { n5: true });
    if (view === 'listen') return guestDay().listen ? lock('更多听力（今天的试听题已经做过了）') : lock('完整的听力练习', { listen: true });
    if (view === 'read' && sub) return guestRead(sub, lock);
    return null;
  }
  const s = sub.split('/')[0];
  if (['exam', 'biz', 'trans'].includes(s)) return lock({ exam: '模拟考', biz: `商务${TRACKS[tr].title}`, trans: '翻译练习' }[s]);
  if (s === 'grammar' && l2Sel[tr + 'g'] && l2Sel[tr + 'g'] !== LV_NAMES[tr][0]) return lock(`${l2Sel[tr + 'g']}语法`, { lvReset: tr + 'g' });
  if (s === 'levels' && lvSel[tr] && lvSel[tr] !== GUEST_FIRST_LV[tr]) return lock('更高级别的词库', { lvLevels: true });
  if (s === 'listen') return guestDay().listen ? lock('更多听力（今天的试听题已经做过了）') : lock('完整的听力练习', { listen: true });
  if (s === 'read' && sub.split('/')[1]) return guestRead(tr + '|' + sub.split('/')[1], lock);
  return null;
}
// 阅读：每天可以完整读 1 篇
function guestRead(id, lock) {
  const d = guestDay();
  if (!d.read) { d.read = id; save(); return null; }
  return d.read === id ? null : lock('更多文章（游客每天可以读 1 篇，今天已经读过了）');
}
// 闯关：前 3 关
function guestStage(where, n) {
  if (!isGuest() || n <= GUEST_STAGES && (where === 'ja' ? S.level === 'N5' : true)) return false;
  main.innerHTML = '';
  main.append(lockPanel({ what: `第 ${GUEST_STAGES + 1} 关以后的关卡${where === 'ja' && S.level !== 'N5' ? `和 ${S.level}` : ''}`, tr: where }));
  return true;
}

function lockPanel(lk) {
  const T = lk.tr === 'ja' ? null : TRACKS[lk.tr];
  const p = h(`<section class="panel lock-panel">
    <div class="lock-ic" aria-hidden="true">🔒</div>
    <h2>注册后解锁${esc(lk.what)}</h2>
    <p class="muted">你现在是游客模式，可以先体验入门内容。免费注册一个账号，就能学到全部内容：</p>
    <ul class="lock-list">
      <li>${T ? `${esc(T.title)}全部级别的单词、语法和阅读` : 'N5 到 N1 全部单词、汉字、语法和阅读'}</li>
      <li>模拟考、听力、商务${T ? '' : '、动漫·日剧名台词'}、翻译练习</li>
      <li>学习进度云端同步，换手机、换浏览器都不丢</li>
      <li>学习提醒，到点提醒你今天还没学</li>
    </ul>
    <div class="row"><button class="btn pri big" type="button" data-signup>免费注册</button><button class="btn" type="button" data-login>已有账号，登录</button></div>
    ${lk.extra && lk.extra.listen ? '<div class="row"><button class="btn ghost" type="button" data-try>先试听今天的 1 道题</button></div>' : ''}
    ${lk.extra && (lk.extra.n5 || lk.extra.lvReset || lk.extra.lvLevels) ? '<div class="row"><button class="btn ghost" type="button" data-back>回到入门级别继续学</button></div>' : ''}
    <p class="small muted">注册不收费。游客期间的进度会在登录后合并到账号里。</p>
  </section>`);
  p.querySelector('[data-signup]').onclick = e => { e.stopPropagation(); authScreen('signup'); };
  p.querySelector('[data-login]').onclick = e => { e.stopPropagation(); authScreen('login'); };
  const back = p.querySelector('[data-back]');
  if (back) back.onclick = () => {
    if (lk.extra.n5) { S.level = 'N5'; save(); }
    if (lk.extra.lvReset) l2Sel[lk.extra.lvReset] = LV_NAMES[lk.tr][0];
    if (lk.extra.lvLevels) lvSel[lk.tr] = GUEST_FIRST_LV[lk.tr];
    render();
  };
  const tr = p.querySelector('[data-try]');
  if (tr) tr.onclick = () => guestListenOne(lk.tr);
  return p;
}
// 每天 1 道试听题
function guestListenOne(tr) {
  const d = guestDay(); d.listen = 1; save();
  const go = (qs, L) => runListen(qs, L, { title: '今日试听', again: () => render() });
  if (tr === 'ja') {
    if (typeof LISTEN !== 'undefined') return go(sample(LISTEN.N5, 1), 'N5');
    const s = document.createElement('script'); s.src = 'listening.js';
    s.onload = () => go(sample(LISTEN.N5, 1), 'N5'); document.body.append(s);
    return;
  }
  const lv = LV_NAMES[tr][0];
  l2Fetch(tr, 'listen').then(list => go(sample(list.filter(x => x.lv === lv), 1), lv)).catch(() => toast('加载失败，请检查网络'));
}

// 首页顶部提示
function guestBanner(anchor) {
  if (!isGuest() || !anchor.isConnected) return;
  const b = h(`<section class="banner guest-banner"><div><b>游客模式</b><div class="small">进度只保存在这台设备上，部分内容需要注册后解锁。免费注册就能学到全部内容，进度云端同步。</div></div>
    <div class="row"><button class="btn pri" type="button" data-s>免费注册</button><button class="btn ghost" type="button" data-l>登录</button></div></section>`);
  b.querySelector('[data-s]').onclick = e => { e.stopPropagation(); authScreen('signup'); };
  b.querySelector('[data-l]').onclick = e => { e.stopPropagation(); authScreen('login'); };
  anchor.after(b);
}
// 入口方块上的小锁
const guestLockedHref = href => isGuest() && /#((ko|en)\/)?(exam|biz|anime|trans)$/.test(href);
