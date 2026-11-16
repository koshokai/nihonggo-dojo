// 对战：和正在学习的人（或「道场对手」）比一局单词速答。
// 匹配和对战同步走数据库函数（docs/SUPABASE_SETUP.md 第 14 节），不依赖 WebSocket，中国大陆也能用。
// 题目由双方共同的随机种子在各自设备上生成，所以两边题目完全一样，不需要服务器出题。
// 交流只用固定的短句和表情（不能打字），没人在线时和「道场对手」（系统对手，会明确标出）练习。
// 免费用户每天 5 局「单词速答」；其他玩法是会员玩法（DUEL_MODES 里 vip，内容在私有仓库开发，开放后再放进来）。
// 好友挑战（第 15 节）：打完一局可以把同一组题发给伙伴，伙伴有空时来做，比谁分高。免费每天发 1 个，会员不限；接受挑战不限次数。
const DUEL_Q = 10, DUEL_SEC = 12, DUEL_FREE = 5, CHAL_FREE = 1;
// 玩法说明跟着界面语言（学中文的日本用户看日语），所以每次显示时现算
const DUEL_MODES = () => [
  { id: 'word', name: tj('单词速答', '単語スピード対戦'), desc: tj('看单词选意思、看意思选单词，每题限时', '単語を見て意味を、意味を見て単語を選ぶ。1 問ごとに制限時間あり'), vip: false },
  { id: 'listen', name: tj('听力抢答', 'リスニング早押し'), desc: tj('只听发音，选出意思', '発音だけを聞いて、意味を選ぶ'), vip: true },
  { id: 'kanji', name: tj('汉字读音', 'ピンイン当て'), desc: tj('看汉字词，选出正确的读音', '漢字を見て、正しいピンインを選ぶ'), vip: true }
].filter(x => !(x.id === 'kanji' && S.track === 'en'));   // 英语没有「汉字读音」
const duelMode = () => { const m = S.duelMode || 'word'; return m !== 'word' && !isMember() ? 'word' : DUEL_MODES().some(x => x.id === m) ? m : 'word'; };
// 真人对战按玩法分开匹配要服务器的新函数（docs/SUPABASE_SETUP.md 第 19 节，duel_version）；还没更新时会员玩法先只和道场对手练
// 英语（EN-A1…）的真人匹配要第 20 节（duel_version 3）
let duelV2 = null, duelVer = 0;
const duelNeed = () => duelIsEn(duelLevel()) ? 3 : duelMode() !== 'word' ? 2 : 0;
const duelCheckV2 = () => duelV2 !== null ? Promise.resolve(duelVer >= duelNeed()) : duelRpc('duel_version', {}).then(v => { duelVer = +v || 0; duelV2 = duelVer >= 2; return duelVer >= duelNeed(); }).catch(() => { duelV2 = false; return false; });
// 短句本身是日语；第 2 个是给中国用户看的中文意思，第 3 个是给学中文的日本用户看的说明
const DUEL_STAMPS = [['よろしく！', '请多指教', 'よろしくお願いします'], ['やるね！', '厉害', 'すごいね'], ['負けないぞ！', '我不会输的', '負けないよ'], ['ナイス！', '漂亮', 'いいね'], ['おつかれ！', '辛苦了', 'お疲れさま'], ['もう一回！', '再来一局', 'もう 1 局やろう']];
// 学中文（zh 板块）的对战：题目用 HSK 级别的中文单词（zh.js 的 zhDuelPool），级别名 HSK1… 也传给匹配，学中文的人互相匹配
// 学英语（en 板块）：题目用 CEFR 级别的英语单词（enDuelPool），级别名 EN-A1… 只和学英语的人匹配
const duelLevel = () => S.track === 'zh' ? (S.zhLevel || 'HSK1') : S.track === 'en' && typeof enLevel === 'function' ? 'EN-' + enLevel() : S.level;
const duelIsZh = L => /^HSK/i.test(String(L || ''));
const duelIsEn = L => /^EN-/.test(String(L || ''));
// 题目只按中文意思抽（不管母语是中文还是日语，两边的种子抽到的题完全一样）；显示时日语母语的人看日语意思
const DUEL_EN = {};
function enDuelPool(L) {
  const lv = String(L).slice(3);
  if (!DUEL_EN[lv]) { DUEL_EN[lv] = []; enFetch(`en-${lv}`).then(rows => { DUEL_EN[lv] = enItems(lv, rows).map(x => ({ id: x.id, w: x.w, r: x.ipa, m: (x.zh || '').split(/[；;、，,]/)[0], mj: (x.ja || '').split(/[；;、，,]/)[0], q: true })).filter(x => x.m && x.mj); }).catch(() => {}); }
  return DUEL_EN[lv];
}
// 会员按语言分开，另有全通：S.member = { until: 全通到期, ja: 日语到期, en: 英语到期, zh: 中文到期 }（毫秒，由服务器写入）
// isMember('en')：英语的会员内容能不能用（全通或英语会员）；isMember()：有任何一种会员（VIP 标志、对战次数）
const isMember = track => { const m = S.member, now = Date.now(); if (!m) return false; if (m.until > now) return true; return track ? m[track] > now : m.exp > now || ['ja', 'en', 'zh'].some(k => m[k] > now); };
const duelPid = (() => { try { return sessionStorage.getItem('duel-pid') || (sessionStorage.setItem('duel-pid', Math.random().toString(36).slice(2, 10)), sessionStorage.getItem('duel-pid')); } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
const duelNick = () => (S.lb && S.lb.nick) || S.duelNick || (S.duelNick = tj('学习者', '学習者') + Math.floor(Math.random() * 9000 + 1000));
const chalToday = () => { const d = S.chalDay; return d && d.d === dkey() ? d : (S.chalDay = { d: dkey(), n: 0 }); };
const duelToday = () => { const d = S.duelDay; return d && d.d === dkey() ? d : (S.duelDay = { d: dkey(), n: 0 }); };
let duelLobby = null, duelRoom = null;

// 带种子的随机数：两边用同一个种子，抽到的题和选项顺序完全一样
function duelRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const duelMeaning = m => m.split(/[；;]/)[0].trim();
function duelQuestions(seed, L, mode = 'word') {
  const rnd = duelRng(seed), pick = a => a[Math.floor(rnd() * a.length)];
  const src = duelIsZh(L) ? (typeof zhDuelPool === 'function' ? zhDuelPool(L) : []) : duelIsEn(L) ? enDuelPool(L) : VOCAB[L];
  // 汉字读音：只用带汉字的词（读音和写法不同），选项是读音（日语假名 / 中文拼音）
  const pool = (src || []).filter(v => v.q && duelMeaning(v.m).length <= 16 && (mode !== 'kanji' || (v.r && v.w !== v.r)));
  if (mode === 'kanji') {
    if (pool.length < 8) throw new Error('duel pool too small: ' + L);
    const used = new Set(), qs = [];
    while (qs.length < DUEL_Q) {
      const v = pick(pool);
      if (used.has(v.w)) continue;
      used.add(v.w);
      // 干扰项尽量用同样字数的词（不然看读音长短就能猜出来）
      const same = pool.filter(x => x.w.length === v.w.length && x.r !== v.r), from = new Set(same.map(x => x.r)).size >= 3 ? same : pool;
      const opts = [v];
      while (opts.length < 4) { const o = pick(from); if (!opts.some(x => x.r === o.r)) opts.push(o); }
      for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
      qs.push({ v, kanji: true, opts, answer: opts.indexOf(v) });
    }
    return qs;
  }
  if (pool.length < 8) throw new Error('duel pool too small: ' + L);
  const used = new Set(), qs = [];
  while (qs.length < DUEL_Q) {
    const v = pick(pool);
    if (used.has(v.w)) continue;
    used.add(v.w);
    const opts = [v];
    while (opts.length < 4) { const o = pick(pool); if (!opts.some(x => x.w === o.w || duelMeaning(x.m) === duelMeaning(o.m))) opts.push(o); }
    for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    const toMeaning = mode === 'listen' || rnd() < 0.6;   // 六成「看单词选意思」，四成「看意思选单词」；听力抢答都是听了选意思
    qs.push({ v, toMeaning, listen: mode === 'listen', opts, answer: opts.indexOf(v) });
  }
  return qs;
}

function viewDuel() {
  const m = duelToday(), left = isMember() ? tj('不限', '無制限') : Math.max(0, DUEL_FREE - m.n);
  const p = h(`<section class="panel duel-lobby">
    <h2>${tj('对战', '対戦')}</h2>
    <p class="muted">${tj('和正在学习的人比一局，答得又快又对分数越高。随时可以退出。', 'いま学習中の人と 1 局勝負。速く正確に答えるほど高得点です。いつでも退出できます。')}</p>
    <div class="duel-online"><i class="dot" aria-hidden="true"></i><span data-online>${tj('正在连接……', '接続中…')}</span></div>
    <div class="duel-me"><span class="small muted">${tj('你的昵称', 'あなたのニックネーム')}</span><b>${esc(duelNick())}</b><span class="small muted">· ${tj('题目级别', '出題レベル')} ${esc(duelLevel())}</span></div>
    <h3>${tj('选玩法', '遊び方を選ぶ')}</h3>
    <div class="duel-modes">${DUEL_MODES().map(x => `<button type="button" class="duel-mode has-vip ${duelMode() === x.id ? 'on' : ''} ${x.vip && !isMember() ? 'lock' : ''}" data-mode="${x.id}">${x.vip ? vipTag() : ''}<b>${esc(x.name)}</b><div class="small muted">${esc(x.desc)}</div></button>`).join('')}</div>
    <div class="row"><button class="btn pri big" type="button" data-match>${tj('开始匹配', 'マッチング開始')}</button><button class="btn" type="button" data-bot>${tj('和道场对手练习', '道場の相手と練習')}</button></div>
    <div class="duel-chals" data-chals hidden></div>
    <p class="small muted">${tj(`今天还能玩 <b>${left}</b> 局${isMember() ? '' : `（每天 ${DUEL_FREE} 局）`}。等 15 秒没有匹配到人，会自动换成「道场对手」（系统对手，不是真人）。`, `今日はあと <b>${left}</b> 局遊べます${isMember() ? '' : `（1 日 ${DUEL_FREE} 局まで）`}。15 秒待っても相手が見つからない場合は、自動で「道場の相手」（システムの相手で、人間ではありません）に切り替わります。`)}</p>
    <p class="small muted">${tj('对战中只能发送固定的短句和表情，不能打字聊天；对方只看得到你的昵称。', '対戦中に送れるのは決まったひと言と絵文字だけで、文字は入力できません。相手に見えるのはあなたのニックネームだけです。')}</p>
  </section>`);
  main.append(p);
  if (duelIsZh(duelLevel()) && typeof zhDuelPool === 'function') zhDuelPool(duelLevel());   // 先把中文、英语词表下载好
  if (duelIsEn(duelLevel())) enDuelPool(duelLevel());
  const status = p.querySelector('[data-online]');
  const canPlay = () => isMember() || duelToday().n < DUEL_FREE;
  const used = () => tj(`今天的 ${DUEL_FREE} 局已经玩完了，明天再来吧`, `今日の ${DUEL_FREE} 局はすべて遊びました。また明日どうぞ`);
  p.querySelector('[data-bot]').onclick = () => { if (!canPlay()) return toast(used()); duelStart({ bot: true, seed: Date.now() & 0x7fffffff, L: duelLevel(), mode: duelMode() }); };
  // 选玩法：会员玩法非会员点了提示会员
  p.querySelectorAll('[data-mode]').forEach(b => { b.onclick = () => {
    const x = DUEL_MODES().find(m => m.id === b.dataset.mode);
    if (x.vip && !isMember()) return askSheet(tj(`「${x.name}」是会员玩法。免费可以玩单词速答。`, `「${x.name}」はメンバー向けの遊び方です。単語スピード対戦は無料で遊べます。`), [[false, tj('知道了', 'OK')], [true, tj('了解会员', 'メンバーについて'), 'pri']]).then(v => { if (v) location.hash = '#vip'; });
    S.duelMode = x.id; save(); render();
  }; });
  const btn = p.querySelector('[data-match]');
  if (!cloudOn() || (typeof isGuest === 'function' && isGuest())) {
    status.textContent = typeof isGuest === 'function' && isGuest() ? tj('游客可以先和道场对手练习，注册后可以和真人对战', 'ゲストは道場の相手と練習できます。登録すると人と対戦できます') : tj('现在只能和道场对手练习', '現在は道場の相手との練習のみです');
    btn.disabled = true;
    return;
  }
  // 伙伴发来的挑战：放在大厅里，点了就开始（不占免费局数）
  if (typeof chalLoad === 'function') chalLoad(true).then(cl => {
    const box = p.querySelector('[data-chals]'), pend = chalPending(cl);
    if (!box || !pend.length) return;
    box.append(h(`<h3>${tj('伙伴的挑战', '仲間からの挑戦')} <span class="small muted">${tj(`${pend.length} 个`, `${pend.length} 件`)}</span></h3>`), chalBlock(pend, 3));
    box.hidden = false;
  }).catch(() => {});
  duelJoinLobby(n => { if (status.isConnected) status.textContent = n > 1 ? tj(`现在有 ${n} 人在线学习，点「开始匹配」找对手`, `いま ${n} 人が学習中です。「マッチング開始」で相手を探しましょう`) : tj('现在只有你在线，可以先开始匹配等一等', 'いまオンラインなのはあなただけです。マッチングを開始して待ってみましょう'); });
  btn.onclick = () => {
    if (!canPlay()) return toast(used());
    btn.disabled = true; btn.textContent = tj('匹配中……', 'マッチング中…');
    if (duelNeed() && (duelV2 === null || duelVer < duelNeed())) {   // 服务器还没更新：会员玩法、英语先和道场对手练
      if (duelV2 !== null) { toast(tj('这个玩法的真人匹配还在准备中，先和道场对手练一局吧', 'この遊び方の対人マッチングは準備中です。まずは道場の相手と練習しましょう')); return duelStart({ bot: true, seed: Date.now() & 0x7fffffff, L: duelLevel(), mode: duelMode() }); }
      return duelCheckV2().then(ok => { if (ok) { btn.disabled = false; btn.click(); return; } toast(tj('这个玩法的真人匹配还在准备中，先和道场对手练一局吧', 'この遊び方の対人マッチングは準備中です。まずは道場の相手と練習しましょう')); duelStart({ bot: true, seed: Date.now() & 0x7fffffff, L: duelLevel(), mode: duelMode() }); });
    }
    duelSeek(found => { if (!p.isConnected) return; if (!found) { toast(tj('暂时没有匹配到人，先和道场对手练一局吧', '相手が見つかりませんでした。まずは道場の相手と 1 局練習しましょう')); duelStart({ bot: true, seed: Date.now() & 0x7fffffff, L: duelLevel() }); } });
  };
}

// 匹配和对战同步都走普通 HTTPS 请求（数据库函数，见 docs/SUPABASE_SETUP.md 第 14 节），每 1–2 秒问一次。
// 不用 Realtime（WebSocket）：中国大陆的网络经常连不上 WebSocket，用普通请求两边都能匹配到。
const duelRpc = async (fn, args) => { const c = await cloudClient(); const r = await c.rpc(fn, args); if (r.error) throw r.error; return r.data; };
function duelJoinLobby(onCount) {
  // 大厅人数直接用右上角的在线人数（online.js）
  const draw = () => onCount(window.ONLINE_N || 1);
  draw(); addEventListener('online-change', draw);
  duelLobby = { off: () => removeEventListener('online-change', draw) };
}
function duelLeaveLobby() { if (duelLobby) { duelLobby.off(); duelLobby = null; } duelRpc('duel_cancel', { p: duelPid }).catch(() => {}); }
// 每 2 秒报一次「我在等」，服务器把两个在等的人配成一对；最多等 15 秒
function duelSeek(done) {
  const t0 = Date.now();
  let stop = false;
  const tick = async () => {
    if (stop) return;
    let r = null;
    const md = duelMode();
    try { r = await duelRpc('duel_seek', { p: duelPid, nick: duelNick(), lv: duelLevel() + (md === 'word' ? '' : '~' + md) }); } catch (e) { stop = true; return done(false); }
    if (r && r.room) { stop = true; done(true); const [L, m] = String(r.lv).split('~'); return duelStart({ net: true, room: r.room, seed: r.seed, L, mode: m || 'word', opp: r.opp }); }
    if (Date.now() - t0 > 15000) { stop = true; duelRpc('duel_cancel', { p: duelPid }).catch(() => {}); return done(false); }
    setTimeout(tick, 2000);
  };
  tick();
  return () => { stop = true; };
}

// 一局：真人对战（ch）或道场对手（bot）
function duelStart(o) {
  let qs;
  try { qs = duelQuestions(o.seed, o.L, o.mode || 'word'); } catch (e) {
    // 中文词表是异步加载的（zh.js 的 zhDuelPool 第一次调用时才开始下载）：等一会儿再试，最多 5 秒
    if ((duelIsZh(o.L) || duelIsEn(o.L)) && (o.tries || 0) < 10) { o.tries = (o.tries || 0) + 1; setTimeout(() => duelStart(o), 500); return; }
    toast(tj('题目加载失败，请稍后再试', '問題を読み込めませんでした。しばらくしてからお試しください')); return;
  }
  const zh = duelIsZh(o.L), en = duelIsEn(o.L), wl = zh ? 'zh-CN' : en ? 'en' : 'ja', ml = zh || (en && enJa()) ? ' lang="ja"' : '';   // 单词的语言、意思的语言（学中文时意思是日语）
  const mOf = x => en && enJa() && x.mj ? x.mj : duelMeaning(x.m);   // 显示用的意思
  const ch = o.chal;   // 好友挑战：对方已经做过这组题，分数就是要超过的目标
  const opp = { name: o.bot ? tj('道场对手', '道場の相手') : o.opp || tj('对手', '対戦相手'), score: ch ? ch.target : 0, done: -1, left: false };
  let i = 0, score = 0, timer = null, t0 = 0, answered = false, over = false, waiting = false;
  if (!ch) { duelToday().n++; save(); }
  duelRoom = o.net ? o.room : null;
  main.innerHTML = '';
  focusMode(true);
  const box = h(`<section class="panel duel">
    <div class="duel-bar">
      <div class="duel-p me"><b>${esc(duelNick())}</b><span data-my>0</span></div>
      <div class="duel-vs">VS<div class="small muted" data-qn>1 / ${DUEL_Q}</div></div>
      <div class="duel-p op"><b>${esc(opp.name)}</b>${o.bot ? `<span class="small muted duel-sys">${tj('系统对手', 'システムの相手')}</span>` : ''}${ch ? `<span class="duel-target">${tj('挑战目标', '目標スコア')}</span>` : ''}<span data-op>${opp.score}</span></div>
    </div>
    <div class="bar duel-time"><i data-time style="width:100%"></i></div>
    <div data-stage></div>
    <div class="duel-stamps" ${ch ? 'hidden' : ''}>${DUEL_STAMPS.map(([s, cn, ja], k) => `<button class="chip-btn" type="button" data-st="${k}" title="${esc(tj(cn, ja))}" lang="ja">${esc(s)}</button>`).join('')}</div>
    <div class="duel-toast" data-optoast hidden></div>
    <div class="row"><button class="btn ghost" type="button" data-quit>${tj('退出', '退出する')}</button></div>
  </section>`);
  main.append(box);
  const stage = box.querySelector('[data-stage]'), my = box.querySelector('[data-my]'), op = box.querySelector('[data-op]'), tbar = box.querySelector('[data-time]');
  const opToast = text => { const t = box.querySelector('[data-optoast]'); t.textContent = `${opp.name}：${text}`; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 2500); };
  // 对战同步：把自己的进度写进服务器，每 1.5 秒读一次对方的进度（分数、短句、是否离开）
  let mine = { i: -1, score: 0, stamp: -1, sn: 0, bye: false }, lastStamp = 0, poll = null;
  const push = () => duelRpc('duel_post', { room: duelRoom, p: duelPid, i: mine.i, score: mine.score, stamp: mine.stamp, sn: mine.sn, bye: mine.bye }).catch(() => {});
  const send = (event, payload) => {
    if (!duelRoom) return;
    if (event === 'ans') { mine.i = payload.i; mine.score = payload.score; }
    if (event === 'stamp') { mine.stamp = payload.k; mine.sn++; }
    if (event === 'bye') mine.bye = true;
    push();
  };
  if (duelRoom) {
    push();
    poll = setInterval(async () => {
      const r = await duelRpc('duel_peek', { room: duelRoom, p: duelPid }).catch(() => null);
      if (!r || over) return;
      if (r.score !== opp.score || r.i !== opp.done) { opp.score = r.score; opp.done = r.i; op.textContent = opp.score; op.parentElement.classList.toggle('lead', opp.score > score); }
      if (r.sn > lastStamp) { lastStamp = r.sn; const st = DUEL_STAMPS[r.stamp]; if (st) opToast(st[0]); }
      if (r.bye && !opp.left) { opp.left = true; opToast(tj('离开了对战', '対戦から退出しました')); if (waiting) finish(); }
      if (waiting && opp.done >= DUEL_Q - 1) finish();
    }, 1500);
  }
  box.querySelectorAll('[data-st]').forEach(b => { b.onclick = () => { const s = DUEL_STAMPS[+b.dataset.st]; send('stamp', { k: +b.dataset.st }); b.disabled = true; setTimeout(() => { b.disabled = false; }, 3000); toast(tj(`已发送：${s[0]}`, `送信しました：${s[0]}`)); }; });
  box.querySelector('[data-quit]').onclick = async () => {
    if (!over && !await askConfirm(tj('确定退出这一局吗？', 'この対戦から退出しますか？'), tj('退出', '退出する'), tj('继续', '続ける'))) return;
    send('bye', {}); cleanup(); go('duel');
  };
  // 道场对手：按级别设定正确率，每题答题时间 2–9 秒；结果一开始就定好，你答得再快它也照样答完每一题
  const botAcc = { N5: 0.8, N4: 0.75, N3: 0.7, N2: 0.65, N1: 0.6 }[o.L] || 0.75;
  const botRes = qs.map(() => { const ms = 2000 + Math.random() * 7000; return { ms, pts: Math.random() < botAcc ? 100 + Math.round(50 * (1 - ms / (DUEL_SEC * 1000))) : 0, done: false }; });
  const botApply = k => { const r = botRes[k]; if (!r || r.done) return; r.done = true; opp.score += r.pts; opp.done = k; op.textContent = opp.score; op.parentElement.classList.toggle('lead', opp.score > score); };
  const botPlay = k => setTimeout(() => {
    if (over) return;
    botApply(k);
    if (Math.random() < 0.12) opToast(DUEL_STAMPS[Math.floor(Math.random() * DUEL_STAMPS.length)][0]);   // 偶尔回个短句，像在对战
  }, botRes[k].ms);
  let botT = null;
  function cleanup() {
    over = true; clearInterval(timer); clearTimeout(botT); focusMode(false);
    clearInterval(poll); duelRoom = null;
  }
  function show() {
    const q = qs[i]; answered = false; t0 = Date.now();
    box.querySelector('[data-qn]').textContent = `${i + 1} / ${DUEL_Q}`;
    const say = () => { if (zh && typeof zhSay === 'function') zhSay(q.v.w); else if (en) speakLang(q.v.w, 'en-US'); else speak(q.v.r || q.v.w); };
    const head = q.listen ? `<div class="eyebrow">${tj('听发音，选出意思', '発音を聞いて、意味を選んでください')}</div><button class="btn pri ls-play" type="button" data-say>▶ ${tj('再听一次', 'もう一度聞く')}</button>`
      : q.kanji ? `<div class="eyebrow">${zh ? tj('选出正确的拼音', '正しいピンインを選んでください') : tj('选出正确的读音', '正しい読み方を選んでください')}</div><div class="q-big" lang="${wl}">${esc(q.v.w)}</div>` : null;
    if (head) {
      stage.innerHTML = `<div class="q-prompt duel-q">${head}</div>
      <div class="opts">${q.opts.map((x, k) => `<button class="opt" type="button" data-o="${k}"><span class="k">${k + 1}</span><span ${q.kanji ? `lang="${zh ? 'zh-Latn-pinyin' : 'ja'}"` : ml}>${esc(q.kanji ? x.r : mOf(x))}</span></button>`).join('')}</div>
      <div data-fb></div>`;
      const sb = stage.querySelector('[data-say]'); if (sb) { sb.onclick = say; say(); }
    } else
    stage.innerHTML = `<div class="q-prompt duel-q">${q.toMeaning ? `<div class="q-big" lang="${wl}">${esc(q.v.w)}</div>` : `<div class="eyebrow">${tj('选出这个意思的单词', 'この意味の単語を選んでください')}</div><div class="duel-m"${ml}>${esc(mOf(q.v))}</div>`}</div>
      <div class="opts">${q.opts.map((x, k) => `<button class="opt" type="button" data-o="${k}"><span class="k">${k + 1}</span><span ${q.toMeaning ? ml : `lang="${wl}"`}>${esc(q.toMeaning ? mOf(x) : x.w)}</span></button>`).join('')}</div>
      <div data-fb></div>`;
    stage.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => pick(+b.dataset.o); });
    keyHandler = e => { if (!answered && '1234'.includes(e.key)) pick(+e.key - 1); };
    clearInterval(timer);
    timer = setInterval(() => {
      const left = Math.max(0, DUEL_SEC * 1000 - (Date.now() - t0));
      tbar.style.width = (left / (DUEL_SEC * 10)) + '%';
      tbar.parentElement.classList.toggle('hurry', left < 4000);
      if (!left && !answered) pick(-1);
    }, 100);
    if (o.bot) { if (i) botApply(i - 1); botT = botPlay(i); }
  }
  function pick(k) {
    if (answered || over) return; answered = true; clearInterval(timer);
    const q = qs[i], ok = k === q.answer, ms = Date.now() - t0;
    if (ok) score += 100 + Math.round(50 * Math.max(0, 1 - ms / (DUEL_SEC * 1000)));
    my.textContent = score; my.parentElement.classList.toggle('lead', score > opp.score);
    buzz(ok ? 12 : [30, 50, 30]);
    const btns = stage.querySelectorAll('[data-o]');
    btns.forEach((b, x) => { b.disabled = true; if (x === q.answer) b.classList.add('right'); else if (x === k) b.classList.add('wrong'); });
    if (ok && btns[k]) popFrom(btns[k]);
    stage.querySelector('[data-fb]').innerHTML = `<div class="small duel-fb"><b lang="${wl}">${esc(q.v.w)}</b> <span lang="${zh ? 'zh-Latn-pinyin' : 'ja'}" class="muted">${esc(q.v.r)}</span> <span${ml}>${esc(mOf(q.v))}</span></div>`;
    send('ans', { i, score, ok });
    // 第一次答错的词加进单词卡复习
    if (!ok && q.v.id && !S.srs[q.v.id]) { S.srs[q.v.id] = { i: 0, e: 2.5, r: 0, due: Date.now() }; save(); }
    setTimeout(() => { if (over) return; i++; if (i < DUEL_Q) show(); else waitOpp(); }, ok ? 900 : 1600);
  }
  // 自己答完了：等对方最多 15 秒（道场对手直接出结果）
  function waitOpp() {
    waiting = true;
    stage.innerHTML = `<p class="muted duel-wait">${tj('你答完了，等对方……', '解答が終わりました。相手を待っています…')}</p>`;
    if (o.bot || ch || opp.left || opp.done >= DUEL_Q - 1) return finish();
    setTimeout(finish, 15000);
  }
  function finish() {
    if (over) return;
    if (o.bot) botRes.forEach((r, k) => botApply(k));
    cleanup();
    const win = score > opp.score, tie = score === opp.score;
    const canChallenge = !ch && (o.mode || 'word') === 'word' && cloudOn() && !(typeof isGuest === 'function' && isGuest()) && typeof chalLoad === 'function' && chalReady !== false;
    addXP(Math.round(score / 50) + (win ? 10 : 3));
    const rec = S.duelRec = S.duelRec || { w: 0, l: 0, d: 0 };
    rec[win ? 'w' : tie ? 'd' : 'l']++; save();
    stage.innerHTML = `<div class="duel-result ${win ? 'win' : tie ? 'tie' : 'lose'}"><div class="duel-big" lang="ja">${win ? '勝ち！' : tie ? '引き分け' : '負け……'}</div>
      <p>${esc(duelNick())} <b>${score}</b> : <b>${opp.score}</b> ${esc(opp.name)}${opp.left ? tj('（对方中途离开）', '（相手が途中で退出）') : ''}</p>
      <p class="small muted">${tj(`战绩：${rec.w} 胜 ${rec.l} 负 ${rec.d} 平。答错的单词已经加进单词卡。`, `戦績：${rec.w} 勝 ${rec.l} 敗 ${rec.d} 分。間違えた単語は単語カードに追加しました。`)}</p>
      ${canChallenge ? `<div class="row"><button class="btn" type="button" data-send>⚔ ${tj('发给伙伴挑战', '仲間に挑戦状を送る')}</button></div>` : ''}
      <div class="row"><button class="btn pri" type="button" data-again>${ch ? tj('回到伙伴', '仲間ページへ') : tj('再来一局', 'もう 1 局')}</button><a class="btn" href="#${homeView()}">${tj('回到今天', '今日の学習へ')}</a></div></div>`;
    stage.querySelector('[data-again]').onclick = () => go(ch ? 'buddy' : 'duel');
    if (ch) {
      duelRpc('challenge_answer', { cid: ch.id, score }).then(r => {
        if (r === 'ok' && typeof livePing === 'function') livePing(ch.from, 'chaldone');
        if (typeof chalCache !== 'undefined') chalCache = null;
      }).catch(() => toast(tj('结果没有保存上，请检查网络', '結果を保存できませんでした。ネットワークを確認してください')));
    }
    const sendBtn = stage.querySelector('[data-send]');
    if (sendBtn) sendBtn.onclick = () => chalSend(o.seed, o.L, score, sendBtn);
    box.querySelector('.duel-time').hidden = true;
  }
  show();
}
// 把刚打完的这一局（同一个种子、同一级别）发给伙伴
async function chalSend(seed, L, score, btn) {
  if (!isMember() && chalToday().n >= CHAL_FREE) return toast(tj(`每天可以发 ${CHAL_FREE} 个挑战，明天再来吧`, `挑戦状は 1 日 ${CHAL_FREE} 件までです。また明日どうぞ`));
  const list = await buddyLoad().catch(() => null);
  const ok = (list || []).filter(b => b.status === 'ok');
  if (!ok.length) { toast(tj('还没有伙伴，先去加一个吧', 'まだ仲間がいません。まずは仲間を追加しましょう')); return go('buddy'); }
  const b = await askSheet(tj(`你得了 ${score} 分。发给哪位伙伴？对方会做同一组题，比比谁分高。`, `${score} 点でした。どの仲間に送りますか？相手が同じ問題に挑戦して、点数を競います。`), [...ok.slice(0, 8).map(x => [x.buddy_id, x.nickname]), [null, tj('取消', 'キャンセル')]]);
  if (!b) return;
  btn.disabled = true;
  const r = await duelRpc('challenge_send', { b, seed, lv: L, score, mode: 'word' }).catch(() => null);
  if (r === 'ok') {
    chalToday().n++; save();
    btn.textContent = tj('已发送挑战', '挑戦状を送りました');
    toast(tj('挑战已发送，对方做完你会收到结果', '挑戦状を送りました。相手が挑戦すると結果が届きます'));
    if (typeof livePing === 'function') livePing(b, 'challenge');
    chalCache = null;
    return;
  }
  btn.disabled = false;
  toast({ limit: tj('今天发的挑战太多了，明天再来', '今日はこれ以上挑戦状を送れません。また明日どうぞ'), pending: tj('对方还有 3 个挑战没做，等等再发', '相手に未対応の挑戦状が 3 件あります。少し待ってから送ってください'), not_buddy: tj('对方不是你的伙伴', 'この相手は仲間ではありません') }[r] || tj('挑战功能还在准备中，稍后再试', '挑戦状の機能は準備中です。しばらくしてからお試しください'));
}
addEventListener('hashchange', () => { if (!location.hash.startsWith('#duel')) duelLeaveLobby(); });
