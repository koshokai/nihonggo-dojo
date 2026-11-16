// 学习伙伴：用 6 位伙伴码互加好友，互相看到今天学了没有、连续天数和本周经验，可以「戳一下」提醒，
// 两人同一天都完成今日目标就累计「一起打卡」天数（7 / 30 / 100 天有纪念）。
// 只公开昵称和这几个数字。数据库表和函数见 docs/SUPABASE_SETUP.md 第 13 节，没建表时整个功能不显示。
let buddyCache = null, buddyLast = 0, buddyReady = null;   // buddyReady：null 还不知道，true / false 后台有没有建表
const BUDDY_MILES = () => [[100, tj('百日之约', '100 日の約束')], [30, tj('一月同行', '1 か月いっしょ')], [7, tj('一周同行', '1 週間いっしょ')]];
const buddyNick = () => typeof duelNick === 'function' ? duelNick() : (S.duelNick || tj('学习者', '学習者'));

// 学习时（cloudPush 之后）更新自己的状态，最多两分钟一次
async function buddySync(force) {
  if (buddyReady === false || (!force && Date.now() - buddyLast < 120000)) return;
  if (!sbUser && typeof inboxUser === 'function') sbUser = await inboxUser();   // 页面刚打开时登录状态可能还没读出来
  if (!sbUser) return;
  buddyLast = Date.now();
  try {
    const c = await cloudClient();
    const wk = typeof lbWeekXP === 'function' ? lbWeekXP() : 0;
    const { data, error } = await c.rpc('buddy_update', { nick: buddyNick(), d: dkey(), xp: todayXP(), is_done: todayXP() >= S.goal, stk: streak(), wk });
    if (error) { if (/function|does not exist|schema cache/i.test(error.message)) buddyReady = false; return; }
    buddyReady = true;
    if (data && S.buddyCode !== data) { S.buddyCode = data; save(); }
  } catch (e) { /* 下次再同步 */ }
}
async function buddyLoad(force) {
  if (!force && buddyCache && Date.now() - buddyCache.at < 30000) return buddyCache.list;
  const u = typeof inboxUser === 'function' ? await inboxUser() : sbUser;
  if (!u) return null;
  if (!sbUser) sbUser = u;
  const c = await cloudClient();
  const { data, error } = await c.rpc('buddy_list');
  if (error) { buddyReady = false; return null; }
  buddyReady = true;
  buddyCache = { at: Date.now(), list: data || [] };
  return buddyCache.list;
}
// 好友挑战（第 15 节）：异步比同一组题。chalReady：null 还不知道，false 后台还没建
let chalReady = null, chalCache = null;
async function chalLoad(force) {
  if (chalReady === false) return null;
  if (!force && chalCache && Date.now() - chalCache.at < 30000) return chalCache.list;
  const c = await cloudClient();
  const { data, error } = await c.rpc('challenge_list');
  if (error) { if (/function|does not exist|schema cache/i.test(error.message)) chalReady = false; return null; }
  chalReady = true;
  chalCache = { at: Date.now(), list: data || [] };
  return chalCache.list;
}
const chalPending = list => (list || []).filter(c => !c.mine && c.to_score == null);
// 挑战列表：收到的（没做的可以「接受挑战」）、做完的结果、发出去等对方做的
function chalBlock(list, max = 8) {
  const rows = (list || []).slice(0, max);
  const box = h(`<div class="buddy-list chal-list">${rows.map(c => {
    const done = c.to_score != null, me = c.mine ? c.from_score : c.to_score, them = c.mine ? c.to_score : c.from_score;
    const res = !done ? '' : me > them ? `<span class="tag done">${tj('赢了', '勝ち')}</span>` : me === them ? `<span class="tag">${tj('平手', '引き分け')}</span>` : `<span class="tag lose">${tj('输了', '負け')}</span>`;
    const line = !done ? (c.mine ? tj(`你 ${c.from_score} 分 · 等对方来做`, `あなた ${c.from_score} 点 · 相手の挑戦待ち`) : tj(`对方 ${c.from_score} 分 · ${esc(c.lv)} · 10 题`, `相手 ${c.from_score} 点 · ${esc(c.lv)} · 10 問`)) : tj(`你 ${me} : ${them} ${esc(c.nickname)} · ${esc(c.lv)}`, `あなた ${me} : ${them} ${esc(c.nickname)} · ${esc(c.lv)}`);
    return `<div class="buddy-row"><span class="buddy-st" aria-hidden="true">⚔</span><div class="buddy-n"><b>${c.mine ? tj(`挑战 ${esc(c.nickname)}`, `${esc(c.nickname)} さんへの挑戦`) : tj(`${esc(c.nickname)} 的挑战`, `${esc(c.nickname)} さんからの挑戦`)} ${res}</b><span class="small muted">${line}</span></div>
      ${!done && !c.mine ? `<button class="btn pri" type="button" data-chal="${esc(c.id)}">${tj('接受挑战', '挑戦を受ける')}</button>` : ''}</div>`;
  }).join('')}</div>`);
  box.querySelectorAll('[data-chal]').forEach(b => {
    b.onclick = () => {
      const c = rows.find(x => x.id === b.dataset.chal);
      duelStart({ chal: { id: c.id, from: c.other_id, target: c.from_score }, opp: c.nickname, seed: c.seed, L: c.lv });
    };
  });
  return box;
}

const buddyMile = n => { const m = BUDDY_MILES().find(([d]) => n >= d); return m ? m[1] : ''; };

function viewBuddy() {
  const T = tj('学习伙伴', '学習仲間');
  const box = h(`<section class="panel"><h2>${T}</h2><div class="skel" aria-label="${tj('加载中', '読み込み中')}" role="status"><i></i><i></i><i></i></div></section>`);
  main.append(box);
  if (typeof isGuest === 'function' && isGuest()) {
    box.innerHTML = `<h2>${T}</h2><p class="muted">${tj('注册（免费）后可以和朋友互加伙伴，一起打卡、互相提醒。', '無料登録すると、友だちと学習仲間になって、一緒に目標達成を目指したり声をかけ合ったりできます。')}</p><div class="row"><button class="btn pri" type="button" data-s>${tj('免费注册', '無料で登録')}</button></div>`;
    box.querySelector('[data-s]').onclick = e => { e.stopPropagation(); authScreen('signup'); };
    return;
  }
  buddySync(true).then(() => buddyLoad(true)).then(list => {
    if (!box.isConnected) return;
    if (!list) { box.innerHTML = `<h2>${T}</h2><p class="muted">${tj('伙伴功能正在准备中，很快开放。', '学習仲間の機能は準備中です。もうしばらくお待ちください。')}</p>`; return; }
    box.replaceWith(buddyPage(list));
  }).catch(() => { box.innerHTML = `<h2>${T}</h2><p class="muted">${tj('暂时打不开，请检查网络后再试。', '読み込めませんでした。ネットワークを確認して、もう一度お試しください。')}</p>`; });
}

function buddyPage(list) {
  const ok = list.filter(b => b.status === 'ok'), inc = list.filter(b => b.status === 'incoming'), sent = list.filter(b => b.status === 'sent');
  const today = dkey(), doneToday = b => b.today === today && b.done;
  const p = h(`<section class="panel buddy">
    <h2>${tj('学习伙伴', '学習仲間')}</h2>
    <p class="muted">${tj('和朋友互加伙伴：每天看看对方学了没有，忘了就「戳一下」。两人同一天都完成目标，「一起打卡」天数 +1。对方只看得到你的昵称和学习天数、经验，看不到邮箱和学习内容。', '友だちと学習仲間になると、毎日おたがいの学習状況が見られます。忘れていたら「つつく」で声をかけましょう。同じ日に 2 人とも目標を達成すると「一緒に達成」が +1 日。相手に見えるのはニックネーム・学習日数・XP だけで、メールアドレスや学習内容は見えません。')}</p>
    <div class="buddy-me">
      <div><span class="small muted">${tj('我的伙伴码', '自分の仲間コード')}</span><div class="buddy-code" lang="en">${esc(S.buddyCode || '······')}</div></div>
      <button class="btn" type="button" data-copy>${tj('复制', 'コピー')}</button>
    </div>
    <div class="buddy-me"><div><span class="small muted">${tj('我的昵称', '自分のニックネーム')}</span><div><b>${esc(buddyNick())}</b></div></div><button class="btn ghost" type="button" data-nick>${tj('改昵称', 'ニックネームを変更')}</button></div>
    <form class="row buddy-add" data-add><input class="lb-input" type="text" name="code" maxlength="6" placeholder="${tj('输入朋友的 6 位伙伴码', '友だちの 6 桁の仲間コードを入力')}" autocomplete="off" autocapitalize="characters" lang="en"><button class="btn pri" type="submit">${tj('加为伙伴', '仲間に追加')}</button></form>
    ${inc.length ? `<h3>${tj('伙伴申请', '仲間リクエスト')}</h3><div class="buddy-list">${inc.map(b => `<div class="buddy-row"><div class="buddy-n"><b>${esc(b.nickname)}</b><span class="small muted">${tj('想和你成为学习伙伴', 'あなたと学習仲間になりたがっています')}</span></div>
      <button class="btn pri" type="button" data-acc="${b.buddy_id}">${tj('接受', '承認')}</button><button class="btn ghost" type="button" data-dec="${b.buddy_id}">${tj('拒绝', '拒否')}</button></div>`).join('')}</div>` : ''}
    <h3>${tj('我的伙伴', '自分の仲間')} <span class="small muted">${ok.length} / 20</span></h3>
    ${ok.length ? `<div class="buddy-list">${ok.map(b => `<div class="buddy-row ${doneToday(b) ? 'done' : ''}">
      <span class="buddy-st" aria-label="${doneToday(b) ? tj('今天已完成', '今日は達成済み') : tj('今天还没完成', '今日はまだ未達成')}">${doneToday(b) ? '✓' : '·'}</span>
      <div class="buddy-n"><b>${esc(b.nickname)} <span class="buddy-on" data-on="${b.buddy_id}" hidden>${tj('在线', 'オンライン')}</span></b>
        <span class="small muted">${b.today === today ? tj(`今天 ${b.today_xp} 经验`, `今日 ${b.today_xp} XP`) : tj('今天还没学', '今日はまだ学習していません')} · ${tj(`连续 ${b.streak} 天`, `${b.streak} 日連続`)} · ${tj(`本周 ${b.week_xp}`, `今週 ${b.week_xp}`)}</span>
        ${b.pair_streak ? `<span class="small buddy-pair">🔥 ${tj(`一起打卡 ${b.pair_streak} 天`, `一緒に達成 ${b.pair_streak} 日`)}${buddyMile(b.pair_streak) ? ` · ${buddyMile(b.pair_streak)}` : ''}</span>` : ''}</div>
      <button class="btn ${b.poked ? 'ghost' : 'pri'}" type="button" data-poke="${b.buddy_id}" data-kind="${doneToday(b) ? 'cheer' : 'poke'}" ${b.poked ? 'disabled' : ''}>${b.poked ? (doneToday(b) ? tj('已点赞', 'いいね済み') : tj('已戳', 'つつき済み')) : (doneToday(b) ? tj('点赞 👍', 'いいね 👍') : tj('戳一下', 'つつく'))}</button>
      <button class="btn ghost buddy-more" type="button" data-more="${b.buddy_id}" aria-label="${tj('更多', 'その他')}">⋯</button></div>`).join('')}</div>`
      : `<p class="small muted">${tj('还没有伙伴。把你的伙伴码发给朋友，或者输入朋友的伙伴码。', 'まだ仲間がいません。自分の仲間コードを友だちに送るか、友だちのコードを入力しましょう。')}</p>`}
    <div data-chals></div>
    ${sent.length ? `<h3>${tj('等待对方接受', '承認待ち')}</h3><div class="buddy-list">${sent.map(b => `<div class="buddy-row"><div class="buddy-n"><b>${esc(b.nickname)}</b><span class="small muted">${tj('已发送申请', 'リクエスト送信済み')}</span></div><button class="btn ghost" type="button" data-dec="${b.buddy_id}">${tj('撤回', '取り消す')}</button></div>`).join('')}</div>` : ''}
  </section>`);
  // 伙伴在线：和右上角在线人数同一个频道，比对账号哈希（online.js 的 onlineHash）
  const paintOnline = async () => {
    if (!p.isConnected) return removeEventListener('online-change', paintOnline);
    for (const el of p.querySelectorAll('[data-on]')) el.hidden = !(window.ONLINE_HASHES || new Set()).has(await onlineHash(el.dataset.on));
  };
  addEventListener('online-change', paintOnline);
  if (typeof onlineHash === 'function') setTimeout(paintOnline, 0);
  // 好友挑战：做完一局对战后可以发给伙伴；这里列出收到的和结果
  if (ok.length) chalLoad(true).then(cl => {
    const slot = p.querySelector('[data-chals]');
    if (!slot || !cl) return;
    slot.append(h(`<h3>${tj('伙伴挑战', '仲間からの挑戦状')}${chalPending(cl).length ? ` <span class="small muted">${tj(`${chalPending(cl).length} 个待接受`, `${chalPending(cl).length} 件が未対応`)}</span>` : ''}</h3>`));
    if (cl.length) slot.append(chalBlock(cl));
    else slot.append(h(`<p class="small muted">${tj('在「对战」里打完一局，点「发给伙伴挑战」：伙伴做同一组题，比比谁分高，不用同时在线。', '「対戦」で 1 局終えたら「仲間に挑戦状を送る」をタップ。仲間が同じ問題に挑戦して点数を競えます。同時にオンラインでなくても大丈夫です。')}</p>`));
  }).catch(() => {});
  const rpc = async (fn, args) => { const c = await cloudClient(); const r = await c.rpc(fn, args); if (r.error) throw r.error; return r.data; };
  const reload = () => { buddyCache = null; main.innerHTML = ''; viewBuddy(); };
  p.querySelector('[data-copy]').onclick = () => S.buddyCode && copyText(S.buddyCode, tj('已复制伙伴码，发给朋友吧', '仲間コードをコピーしました。友だちに送りましょう'));
  p.querySelector('[data-nick]').onclick = () => {
    const n = (prompt(tj('新的昵称（最多 16 字，不要用真名、邮箱或电话）', '新しいニックネーム（16 文字まで。本名・メールアドレス・電話番号は使わないでください）'), buddyNick()) || '').trim().slice(0, 16);
    if (!n) return;
    if (/@|https?:|www\.|\d{7,}/i.test(n)) return toast(tj('昵称里不要放邮箱、网址或电话号码', 'ニックネームにメールアドレス・URL・電話番号は使えません'));
    S.duelNick = n; if (S.lb) S.lb.nick = n; save(); buddySync(true).then(reload);
  };
  p.querySelector('[data-add]').onsubmit = async e => {
    e.preventDefault();
    const code = e.target.code.value.trim().toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(code)) return toast(tj('伙伴码是 6 位，由数字和 A–F 组成', '仲間コードは数字と A〜F を組み合わせた 6 桁です'));
    try {
      const r = await rpc('buddy_request', { c: code });
      toast({ ok: tj('成为伙伴了！', '仲間になりました！'), sent: tj('已发送申请，等对方接受', 'リクエストを送りました。相手の承認をお待ちください'), not_found: tj('没有找到这个伙伴码', 'この仲間コードは見つかりませんでした'), full: tj('伙伴已经满 20 人了', '仲間は 20 人までです') }[r] || tj('已发送', '送信しました'));
      reload();
    } catch (err) { toast(tj('发送失败，请稍后再试', '送信できませんでした。しばらくしてからお試しください')); }
  };
  p.querySelectorAll('[data-acc]').forEach(b => { b.onclick = () => rpc('buddy_act', { b: b.dataset.acc, act: 'accept' }).then(() => { toast(tj('成为伙伴了！', '仲間になりました！')); if (typeof livePing === 'function') livePing(b.dataset.acc, 'accept'); reload(); }).catch(() => toast(tj('操作失败', '操作に失敗しました'))); });
  p.querySelectorAll('[data-dec]').forEach(b => { b.onclick = () => rpc('buddy_act', { b: b.dataset.dec, act: 'decline' }).then(reload).catch(() => toast(tj('操作失败', '操作に失敗しました'))); });
  // 伙伴还没学：戳一下提醒；已经完成：点赞鼓励。每天对同一个人只能发一次
  p.querySelectorAll('[data-poke]').forEach(b => {
    b.onclick = async () => {
      const kind = b.dataset.kind;
      // 旧版数据库函数没有 kind 参数时，退回只传伙伴编号
      const r = await rpc('buddy_poke', { b: b.dataset.poke, kind }).catch(() => rpc('buddy_poke', { b: b.dataset.poke })).catch(() => null);
      if (r == null) return toast(tj('操作失败', '操作に失敗しました'));
      b.disabled = true; b.textContent = kind === 'cheer' ? tj('已点赞', 'いいね済み') : tj('已戳', 'つつき済み'); b.classList.replace('pri', 'ghost');
      toast(r === 'ok' ? (kind === 'cheer' ? tj('点了个赞，对方会收到', 'いいねしました。相手に届きます') : tj('戳了一下，对方会收到提醒', 'つつきました。相手にお知らせが届きます')) : r === 'already' ? tj('今天已经发过了，明天再来', '今日はもう送りました。また明日どうぞ') : tj('对方不是你的伙伴', 'この相手は仲間ではありません'));
      if (r === 'ok' && typeof livePing === 'function') livePing(b.dataset.poke, kind);
    };
  });

  p.querySelectorAll('[data-more]').forEach(b => {
    b.onclick = async () => {
      const it = ok.find(x => x.buddy_id === b.dataset.more);
      const act = await askSheet(tj(`和「${it.nickname}」`, `「${it.nickname}」さん`), [['remove', tj('解除伙伴', '仲間を解除')], ['block', tj('拉黑（对方不能再申请你）', 'ブロック（相手からリクエストできなくなります）'), 'danger'], [null, tj('取消', 'キャンセル')]]);
      if (act === 'remove') rpc('buddy_act', { b: it.buddy_id, act: 'remove' }).then(() => { toast(tj('已解除伙伴', '仲間を解除しました')); reload(); });
      if (act === 'block') rpc('buddy_act', { b: it.buddy_id, act: 'block' }).then(() => { toast(tj('已拉黑', 'ブロックしました')); reload(); });
    };
  });
  return p;
}

// 首页的伙伴小条：伙伴今天的情况，有人还没学可以直接去戳
function buddyStrip() {
  const slot = h('<div></div>');
  if (buddyReady === false || !cloudOn() || (typeof isGuest === 'function' && isGuest())) return slot;
  buddyLoad().then(list => {
    if (!slot.isConnected || !list) return;
    const ok = list.filter(b => b.status === 'ok'), inc = list.filter(b => b.status === 'incoming');
    if (!ok.length && !inc.length) return slot.remove();
    const today = dkey(), done = ok.filter(b => b.today === today && b.done).length, best = Math.max(0, ...ok.map(b => b.pair_streak));
    const strip = h(`<a class="buddy-strip" href="#buddy"><span class="course-ic">${tj('伴', '仲')}</span><div><b>${tje('学习伙伴', '学習仲間', 'Study buddies')} <span class="buddy-on" data-n hidden></span></b>
      <span class="small muted">${inc.length ? tje(`${inc.length} 个伙伴申请待处理 · `, `仲間リクエスト ${inc.length} 件 · `, `${inc.length} buddy request${inc.length > 1 ? 's' : ''} · `) : ''}${ok.length ? tje(`今天 ${done} / ${ok.length} 人已完成${best ? ` · 最长一起打卡 ${best} 天` : ''}`, `今日 ${done} / ${ok.length} 人が達成${best ? ` · 一緒に達成 最長 ${best} 日` : ''}`, `Today ${done} / ${ok.length} done${best ? ` · best joint streak ${best} days` : ''}`) : ''}</span></div><span class="small buddy-go">${tje('查看', '見る', 'View')}</span></a>`);
    slot.replaceWith(strip);
    const paint = async () => {
      if (!strip.isConnected) return removeEventListener('online-change', paint);
      const on = window.ONLINE_HASHES || new Set();
      let n = 0; for (const b of ok) if (on.has(await onlineHash(b.buddy_id))) n++;
      const el = strip.querySelector('[data-n]'); el.hidden = !n; el.textContent = tj(`${n} 人在线`, `${n} 人オンライン`);
    };
    addEventListener('online-change', paint);
    if (typeof onlineHash === 'function') paint();
  }).catch(() => slot.remove());
  return slot;
}
