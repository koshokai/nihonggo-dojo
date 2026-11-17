// 会员（1.1）：会员身份和会员内容都放在服务器上（Supabase，docs/SUPABASE_SETUP.md 第 18 节）。
// - 身份：memberships 表（只有服务器能写）。登录后读一次，存进 S.member 当缓存（离线时用到到期为止）。
// - 内容：member_content 表，按「公开数据文件的路径」存会员完整版（kind = 'file'，id = 'lang/ja-course-food.json' 这样）。
//   网站和 App 里只有免费部分；会员打开时用 memberJson() 取完整版，取不到就用公开版。
//   取到的完整版存在设备的 IndexedDB 里（没网也能看）；到期、退款、换语言、退出登录、换账号时删掉。
const MEMBER_DB = 'neko-member', MEMBER_STORE = 'files';
let memberMem = {}, memberGen = 0, memberSig = '';

/* ---------- 设备上的存储（IndexedDB：App 的 capacitor:// 页面也能用） ---------- */
let memberDbP = null;
function memberDb() {
  if (!memberDbP) memberDbP = new Promise((ok, fail) => {
    if (!self.indexedDB) return fail(new Error('no idb'));
    const r = indexedDB.open(MEMBER_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(MEMBER_STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  }).catch(e => { memberDbP = null; throw e; });
  return memberDbP;
}
function memberIdb(mode, fn) {
  return memberDb().then(db => new Promise((ok, fail) => {
    const tx = db.transaction(MEMBER_STORE, mode), r = fn(tx.objectStore(MEMBER_STORE));
    tx.oncomplete = () => ok(r && r.result);
    tx.onerror = tx.onabort = () => fail(tx.error);
  }));
}
const memberIdbGet = k => memberIdb('readonly', st => st.get(k)).catch(() => null);
const memberIdbPut = (k, v) => memberIdb('readwrite', st => st.put(v, k)).catch(() => {});
// 删掉某几种语言（不传 = 全部）的存储
function memberIdbDrop(tracks) {
  return memberIdb('readwrite', st => {
    if (!tracks) return st.clear();
    const r = st.openCursor();
    r.onsuccess = () => { const c = r.result; if (!c) return; if (tracks.some(t => String(c.key).startsWith(t + '/'))) c.delete(); c.continue(); };
    return null;
  }).catch(() => {});
}

/* ---------- 身份 ---------- */
// 服务器的 memberships 行 → S.member（isMember() 在 duel.js 里）
function memberFromRow(r) {
  if (!r || !r.until) return undefined;
  const until = Date.parse(r.until), m = { tier: r.tier, langs: r.langs || [], exp: until };
  if (r.langs_changed_at) m.lc = Date.parse(r.langs_changed_at);   // 这个付费周期改过语言没有（vip.js 显示下次能改的时间）
  if (r.period_start) m.ps = Date.parse(r.period_start);   // exp：订阅到期（还没选语言时也算会员，用来显示选语言）
  if (r.tier === 'l3') m.until = until;
  else for (const k of r.langs || []) m[k] = until;
  return m;
}
// 现在是哪几种语言的会员（用来发现变化：到期、退款、换语言）
const memberState = () => typeof isMember !== 'function' ? '' : ['ja', 'zh', 'en'].map(t => isMember(t) ? t : '-').join('') + (isMember() ? '+' : '');
function memberCheck() {
  const s = memberState();
  memberPurge();
  if (s === memberSig) return;
  const first = !memberSig, was = memberSig.endsWith('+');
  memberSig = s;
  // 到期、退款：告诉用户一声（不然内容突然不见了，会以为出错了）
  if (!first && was && !s.endsWith('+') && typeof askSheet === 'function')
    setTimeout(() => askSheet(tje('会员已经到期了，会员内容暂时收起来了。续订以后马上恢复，学习记录都还在。', 'メンバー期間が終了したため、メンバーコンテンツは非表示になりました。再登録するとすぐに元どおり使えます。学習記録はそのまま残っています。', 'Your membership has ended, so member content is hidden for now. Renew to get it back right away — your progress is saved.'),
      [[false, tje('知道了', 'OK', 'OK')], [true, tje('续订会员', 'メンバーを再開', 'Renew'), 'pri']]).then(v => { if (v) location.hash = '#vip'; }), 300);
  if (!first || isMember()) memberChanged();   // 第一次检查：不是会员就不用重画（不打断正在做的事）
}
async function memberRefresh() {
  if (typeof sbUser === 'undefined' || !sbUser || typeof cloudClient !== 'function') return;
  const uid = sbUser.id;
  try {
    const c = await cloudClient();
    const { data, error } = await c.from('memberships').select('tier, langs, until, langs_changed_at, period_start').eq('user_id', uid).maybeSingle();
    if (error || !sbUser || sbUser.id !== uid) return;
    S.member = memberFromRow(data);
    if (!S.member) delete S.member;
    S.memberUser = uid;
    save();
    memberCheck();
    if (S.vipPend && typeof vipApplyPend === 'function') vipApplyPend();   // 买的时候选好的语言（vip.js）
  } catch (e) { /* 离线：沿用缓存 */ }
}
// 登录以后（各种登录方式都走这里）：换了账号先清掉上一个人的会员身份和内容，再读这个人的
function memberLogin(user) {
  if (!user) return;
  if (S.memberUser && S.memberUser !== user.id) memberSignedOut();
  return memberRefresh().then(() => { if (typeof refAfterLogin === 'function') refAfterLogin(); });   // 邀请码（invite.js）
}
// 购买 / 恢复购买以后：让服务器马上向 RevenueCat 查一次（webhook 可能晚几秒到）
async function memberSyncNow() {
  try {
    const c = await cloudClient();
    await c.functions.invoke('member-sync', { body: {} });
  } catch (e) { /* 忽略，webhook 会补上 */ }
  await memberRefresh();
}
// 选语言（一种档选 1 个、两种档选 2 个）
async function memberChooseLangs(langs) {
  const c = await cloudClient();
  const { data, error } = await c.rpc('choose_langs', { l: langs });
  if (error) throw error;
  if (data === 'ok') await memberRefresh();
  return data;
}
// 会员身份变了：作废还在路上的请求，清掉各板块已经加载的数据，重新画页面
function memberChanged() {
  memberGen++;
  memberMem = {};
  for (const k in MEMBER_SIGNED) delete MEMBER_SIGNED[k];
  if (typeof EN_DATA !== 'undefined') for (const k in EN_DATA) delete EN_DATA[k];
  if (typeof ZH !== 'undefined') { ZH.read = ZH.listen = ZH.course = ZH.grammar = null; for (const j in ZH.theme) delete ZH.theme[j]; for (const n of [4, 5, 6]) delete ZH.hsk[n]; }
  if (typeof courseReset === 'function') courseReset();
  if (typeof bizMember === 'function' && typeof BIZ !== 'undefined') bizMember();
  if (typeof lsMemberReset === 'function') lsMemberReset();
  if (typeof exMemberReload === 'function') exMemberReload();
  if (typeof gramMember === 'function') gramMember();
  if (typeof jlptMember === 'function') jlptMember();
  if (typeof readMember === 'function') readMember();
  if (typeof ANIME_DAILY !== 'undefined') ANIME_DAILY = null;
  if (typeof ANIME !== 'undefined') ANIME = null;
  if (typeof ZHB !== 'undefined') ZHB.p = null;
  if (typeof EXAM2_DATA !== 'undefined') for (const k in EXAM2_DATA) delete EXAM2_DATA[k];
  if (typeof updateTop === 'function') updateTop();
  if (typeof render === 'function' && !(typeof busy === 'function' && busy())) render();
}
// 已经不是会员的语言：把设备里存的那部分会员内容删掉
function memberPurge() {
  if (typeof isMember !== 'function') return;
  const gone = ['ja', 'zh', 'en'].filter(t => !isMember(t));
  if (gone.length) memberIdbDrop(gone);
}
// 退出登录 / 换账号：清掉会员身份和设备里的会员内容
function memberSignedOut() {
  delete S.member; delete S.memberUser;
  delete S.refCode; delete S.refUser; delete S.ref;   // 邀请码和邀请状态跟着账号走（invite.js；S.refAsked 记的是账号 ID，不用删）
  memberIdbDrop();
  save(); memberSig = memberState(); memberChanged();
}

/* ---------- 内容 ---------- */
// 会员完整版：先查服务器，失败（离线）时用设备里存的；不是会员返回 null
function memberData(track, path) {
  if (typeof isMember !== 'function' || !isMember(track)) return Promise.resolve(null);
  const key = `${track}/${path}`;
  if (memberMem[key]) return memberMem[key];
  const gen = memberGen, still = () => gen === memberGen && isMember(track);
  const net = typeof sbUser !== 'undefined' && sbUser
    ? cloudClient().then(c => c.from('member_content').select('data').eq('track', track).eq('kind', 'file').eq('id', path).maybeSingle())
    : Promise.reject(new Error('offline'));
  let p = null;
  p = net.then(({ data, error }) => {
    if (error) throw error;
    if (!data) return null;
    if (still()) memberIdbPut(key, data.data);
    return data.data;
  })
    .catch(() => memberIdbGet(key))
    .then(d => {
      if (!still()) return null;   // 等待期间身份变了：结果作废
      if (!d && memberMem[key] === p) delete memberMem[key];   // 没取到：下次再试
      return d || null;
    });
  memberMem[key] = p;
  return p;
}
// 会员录音：私有存储 member-audio 里的文件 → 临时播放地址（6 小时有效；只有对应语言的会员能取到）
const MEMBER_SIGNED = {};
async function memberSign(paths) {
  const now = Date.now(), need = [...new Set(paths)].filter(p => !(MEMBER_SIGNED[p] && MEMBER_SIGNED[p].t > now));
  if (need.length && typeof sbUser !== 'undefined' && sbUser) {
    const c = await cloudClient();
    for (let i = 0; i < need.length; i += 100) {
      const { data } = await c.storage.from('member-audio').createSignedUrls(need.slice(i, i + 100), 6 * 3600);
      for (const x of data || []) if (x && x.signedUrl && !x.error) MEMBER_SIGNED[x.path] = { u: x.signedUrl, t: now + 5 * 3600e3 };
    }
  }
  return Object.fromEntries(paths.map(p => [p, MEMBER_SIGNED[p] && MEMBER_SIGNED[p].t > now ? MEMBER_SIGNED[p].u : null]));
}
// 页面上的朗读按钮（data-say，按假名）有会员录音的：先取好临时地址放进 AUDIO_IDX，点的时候就能同步播放（iPhone 要求点击当下开始播放）
async function memberAudioScan(root, track, name) {
  if (typeof isMember !== 'function' || !isMember(track) || !root || typeof AUDIO_IDX === 'undefined') return;
  const m = await memberData(track, `audio/${name}.json`).catch(() => null);
  if (!m) return;
  return memberAudioKeys(track, name, [...root.querySelectorAll('[data-say]')].map(b => b.dataset.say), m);
}
// 指定的假名（阅读文章的每一句等）有会员录音的：取好临时地址放进 AUDIO_IDX
async function memberAudioKeys(track, name, list, m) {
  if (typeof isMember !== 'function' || !isMember(track) || typeof AUDIO_IDX === 'undefined') return;
  m = m || await memberData(track, `audio/${name}.json`).catch(() => null);
  if (!m) return;
  const keys = [...new Set(list)].filter(k => k && m[k] && !(typeof HUMAN_JA !== 'undefined' && HUMAN_JA[k]));
  if (!keys.length) return;
  const url = await memberSign(keys.map(k => m[k])).catch(() => ({}));
  for (const k of keys) if (url[m[k]]) AUDIO_IDX[k] = url[m[k]];
}
// 中文、英语的会员录音按文字查（audio/zh.json、audio/en.json：文字 → 文件），返回临时播放地址或 null。
// name：别的索引（中文听力里男声等的台词：audio/zh-voices.json，key「说话人|原文」）
async function memberTextAudio(track, text, name = track) {
  if (typeof isMember !== 'function' || !isMember(track)) return null;
  const m = await memberData(track, `audio/${name}.json`).catch(() => null);
  const p = m && m[text];
  return p ? (await memberSign([p]))[p] : null;
}
// 会员内容的标记：卡片右上角的彩色小字 VIP（会员看到的是自己买到的内容，其他人看到的是会员才能学的内容）
const vipTag = (cls = '') => `<span class="vip-tag ${cls}" aria-label="VIP">VIP</span>`;
// 把这个账号能用的会员内容（文字）全部存到设备上：没网的时候也能学（录音要联网）。onProgress(0–1)
async function memberDownloadAll(onProgress) {
  if (typeof isMember !== 'function' || !isMember() || typeof sbUser === 'undefined' || !sbUser) return false;
  const tracks = ['ja', 'zh', 'en'].filter(t => isMember(t));
  const c = await cloudClient();
  const { data, error } = await c.from('member_content').select('track, id').eq('kind', 'file').in('track', tracks);
  if (error) throw error;
  const list = (data || []).filter(x => !x.id.startsWith('audio/'));
  for (let i = 0; i < list.length; i++) {
    await memberData(list[i].track, list[i].id).catch(() => null);
    if (onProgress) onProgress((i + 1) / list.length);
  }
  return true;
}
// 公开数据文件的读取入口：会员拿完整版，其他人拿公开版
function memberJson(track, path) {
  return memberData(track, path).then(d => d || fetch(path).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));
}

// 每次打开、回到前台、每分钟检查一次到期（到期那一刻起就不再给、并从设备上删掉）
// （启动时 S 还没准备好：第一次检查放到页面加载以后；登录后读到身份时会自动重画，会员内容随之加载）
// 页面加载完（S 准备好）以后马上检查一次：会员一打开就能看到会员内容，不用等
addEventListener('load', () => setTimeout(memberCheck, 200));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { memberCheck(); memberRefresh(); } });
setInterval(memberCheck, 60000);

// 会员：页面上新出现的日语朗读按钮（单词例句、语法例句、商务……）有会员录音的，提前取好临时地址
let memberScanT = 0;
new MutationObserver(() => {
  if (typeof S === 'undefined' || typeof isMember !== 'function' || !isMember('ja')) return;
  clearTimeout(memberScanT);
  memberScanT = setTimeout(() => { memberAudioScan(document.body, 'ja', 'ja-ex'); memberAudioScan(document.body, 'ja', 'ja-biz'); }, 400);
}).observe(document.documentElement, { childList: true, subtree: true });
