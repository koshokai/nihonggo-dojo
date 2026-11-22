// 只在 iPhone App（Capacitor）里加载：用原生功能代替网页里在 App 内不能用的部分。
// 1. 答题震动 → 原生触感（Haptics）
// 2. 学习提醒：App 内没有网页推送，改用本地通知（内容由 remind.js 按学习情况排好未来几天）；不需要服务器，也不收集任何信息
(() => {
  const P = window.Capacitor && Capacitor.Plugins;
  if (!P) return;
  const { Haptics, LocalNotifications } = P;
  if (Haptics) {
    window.buzz = p => {
      if (S.haptic === false) return;
      Haptics.impact({ style: Array.isArray(p) ? 'HEAVY' : 'LIGHT' }).catch(() => {});
    };
  }
  // 3. App 内订阅（RevenueCat）：用 Supabase 的用户 id 作为 RevenueCat 的用户 id，服务器的 member-sync 按它写会员表
  const { Purchases } = P;
  if (Purchases && typeof CLOUD !== 'undefined' && CLOUD.rcKey) {
    let conf = null, who = null;
    const ready = async () => {
      if (typeof sbUser === 'undefined' || !sbUser) throw Object.assign(new Error('login'), { login: true });
      if (!conf) conf = Purchases.configure({ apiKey: CLOUD.rcKey, appUserID: sbUser.id }).then(() => { who = sbUser.id; }).catch(e => { conf = null; throw e; });
      await conf;
      if (who !== sbUser.id) { await Purchases.logIn({ appUserID: sbUser.id }); who = sbUser.id; }
    };
    const cancelled = e => e && (e.userCancelled || e.code === '1' || e.code === 1 || /cancel/i.test(e.message || ''));
    window.appIAP = {
      // default 这个 Offering 里的 6 个商品（价格是 App Store 按地区给的当地货币）
      async packages() {
        await ready();
        const o = await Purchases.getOfferings();
        const off = (o.all && o.all.default) || o.current;
        return off ? off.availablePackages : [];
      },
      async buy(pkg) {
        await ready();
        try { await Purchases.purchasePackage({ aPackage: pkg }); return true; }
        catch (e) { if (cancelled(e)) return false; throw e; }
      },
      async restore() { await ready(); await Purchases.restorePurchases(); return true; },
      // 管理 / 取消订阅：打开 App Store 的订阅管理页
      async manage() {
        let url = 'https://apps.apple.com/account/subscriptions';
        try { await ready(); const r = await Purchases.getCustomerInfo(); if (r && r.customerInfo && r.customerInfo.managementURL) url = r.customerInfo.managementURL; } catch (e) { /* 用默认地址 */ }
        window.open(url, '_blank');
      }
    };
  }
  if (!LocalNotifications) return;
  // 学习提醒：按 remind.js 的计划一次排好未来几天（每天内容不同；今天学过就从明天开始），每次打开、学完、回到 App 时重排
  const IDS = Array.from({ length: 12 }, (_, i) => 1001 + i);
  const tt = (zh, ja) => (typeof rmdJa === 'function' ? rmdJa() : false) ? ja : zh;
  async function setReminder(hour) {
    await LocalNotifications.cancel({ notifications: IDS.map(id => ({ id })) }).catch(() => {});
    if (hour == null) return;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') throw new Error(tt('没有允许通知。可以在 iPhone「设置 → 通知 → 猫先生」里打开。', '通知が許可されていません。iPhone の「設定 → 通知 → 猫先生」でオンにしてください。'));
    }
    let plan = [];
    try { plan = typeof remindPlan === 'function' ? await remindPlan(hour, new Date(), S.appRemindTip !== false) : []; } catch (e) { plan = []; }
    if (!plan.length && typeof remindPlan !== 'function') {   // 万一计划没算出来：退回每天固定一条
      await LocalNotifications.schedule({ notifications: [{ id: IDS[0], title: '猫先生', body: tt('今天的十分钟还没学哦，来复习几张卡片吧。', '今日の10分がまだです。カードを少し復習しよう。'), schedule: { on: { hour, minute: 0 }, allowWhileIdle: true } }] });
      return;
    }
    await LocalNotifications.schedule({ notifications: plan.slice(0, IDS.length).map((m, i) => ({
      id: IDS[i], title: m.title, body: m.body, extra: { url: m.url }, schedule: { at: m.at, allowWhileIdle: true }
    })) });
  }
  // 点通知：打开对应的页面
  LocalNotifications.addListener('localNotificationActionPerformed', ev => {
    const u = ev && ev.notification && ev.notification.extra && ev.notification.extra.url;
    if (u && /^#[\w/-]*$/.test(u)) location.hash = u;
  });
  // 重排：已经打开提醒、已经允许过通知才排（不弹权限框）；学完（今天从 0 变成有经验）、换语言、回到 App 时
  let sig = '', timer = null;
  const replan = (force) => {
    if (typeof S === 'undefined' || S.appRemind == null) return;
    const k = dkey(), now = `${k}|${S.days[k] > 0}|${S.track}|${S.appRemind}|${S.appRemindTip !== false}`;
    if (!force && now === sig) return;
    sig = now; clearTimeout(timer);
    timer = setTimeout(() => LocalNotifications.checkPermissions().then(p => { if (p.display === 'granted') return setReminder(S.appRemind); }).catch(() => {}), 1200);
  };
  replan(true);
  if (typeof save === 'function') { const save0 = save; window.save = function () { const r = save0.apply(this, arguments); replan(false); return r; }; }
  const CapApp0 = P.App;
  if (CapApp0) CapApp0.addListener('appStateChange', ({ isActive }) => { if (isActive) replan(true); });
  // 「我的」页面的学习提醒面板（代替网页的推送提醒）
  window.appReminderPanel = () => {
    const cur = S.appRemind;
    const p = h(`<section class="panel"><h2>${tt('学习提醒', '学習リマインダー')}</h2>
      <p class="small muted">${tt('每天在这个时间提醒你（iPhone 本地通知，不需要联网）。今天学过就不打扰；每天的内容不一样：连续天数、要复习的卡片、学习路线进度。', '毎日この時間にお知らせします（iPhone のローカル通知・通信なし）。その日に学習済みなら通知しません。連続日数、復習カード、ロードマップの進み具合など、毎日ちがう内容です。')}</p>
      <div class="row"><select data-hr>${[7, 8, 9, 12, 18, 19, 20, 21, 22].map(x => `<option value="${x}" ${cur === x ? 'selected' : ''}>${x}:00</option>`).join('')}</select>
      <button class="btn pri" type="button" data-on>${cur != null ? tt('更新时间', '時間を変更') : tt('打开提醒', 'オンにする')}</button>${cur != null ? `<button class="btn ghost" type="button" data-off>${tt('关闭', 'オフ')}</button>` : ''}</div>
      <label class="row small" style="margin-top:10px;gap:8px"><input type="checkbox" data-tip ${S.appRemindTip !== false ? 'checked' : ''}> ${tt('提醒里附带「今日一句」', '通知に「今日のひとこと」をつける')}</label></section>`);
    p.querySelector('[data-on]').onclick = async () => {
      const hr = +p.querySelector('[data-hr]').value;
      try { S.appRemind = hr; await setReminder(hr); save(); toast(tt(`每天 ${hr}:00 提醒你学习`, `毎日 ${hr}:00 にお知らせします`)); render(); } catch (e) { S.appRemind = cur; toast(e.message || tt('设置失败', '設定できませんでした')); }
    };
    p.querySelector('[data-tip]').onchange = e => { S.appRemindTip = e.target.checked; save(); if (S.appRemind != null) setReminder(S.appRemind).catch(() => {}); };
    const off = p.querySelector('[data-off]');
    if (off) off.onclick = async () => { await setReminder(null); S.appRemind = null; save(); toast(tt('已关闭学习提醒', '学習リマインダーをオフにしました')); render(); };
    return p;
  };

  // 4. 一键登录（cloud.js 的 socialGo / appAuthReturn）：
  //    Apple：系统原生的「通过 Apple 登录」（@capacitor-community/apple-sign-in）→ 拿到 Apple 的 ID token → supabase.auth.signInWithIdToken
  //    Google / Facebook（Supabase OAuth）、LINE（Edge Function line-auth）：在系统浏览器（@capacitor/browser）里登录，
  //    最后跳到 com.koshokai.omnisphere://login?…（Info.plist 登记的 URL scheme）→ App 收到（@capacitor/app 的 appUrlOpen）→ 关掉浏览器，交给 appAuthReturn 完成登录
  const { App: CapApp, Browser, SignInWithApple, LineLogin } = P;
  const BACK = 'com.koshokai.omnisphere://login';
  if (CapApp && Browser) {
    const sha256hex = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, '0')).join('');
    const cancelled = e => Object.assign(new Error('cancelled'), { cancelled: true, cause: e });
    window.appAuth = {
      apple: SignInWithApple ? async () => {
        const raw = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
        let r;
        try {
          r = await SignInWithApple.authorize({ clientId: 'com.koshokai.omnisphere', redirectURI: `${CLOUD.url}/auth/v1/callback`, scopes: 'email name', nonce: await sha256hex(raw) });
        } catch (e) {
          if (/cancel|1001/i.test(String((e && (e.code || e.message)) || ''))) throw cancelled(e);
          throw e;
        }
        const res = (r && r.response) || {};
        const c = await cloudClient();
        const { data, error } = await c.auth.signInWithIdToken({ provider: 'apple', token: res.identityToken, nonce: raw });
        if (error) throw error;
        const name = [res.familyName, res.givenName].filter(Boolean).join(' ');   // Apple 只在第一次登录时给名字
        if (name) c.auth.updateUser({ data: { full_name: name } }).catch(() => {});
        return data.user;
      } : null,
      async oauth(provider) {
        const c = await cloudClient();
        const { data, error } = await c.auth.signInWithOAuth({ provider, options: { redirectTo: BACK, skipBrowserRedirect: true } });
        if (error) throw error;
        if (window.markAuthPending) markAuthPending();
        await Browser.open({ url: data.url, presentationStyle: 'popover' });
      },
      // LINE：有 LINE SDK 插件（app/plugins/capacitor-line-login）时直接打开手机上的 LINE App 授权，不用输入账号；
      // 拿到 ID token 交给服务器 line-auth 换成一次性登录凭证，再登录。没有插件时在系统浏览器里用网页登录
      async line() {
        if (LineLogin && CLOUD.lineChannelId) {
          let r;
          try { r = await LineLogin.login({ channelId: CLOUD.lineChannelId }); } catch (e) {
            if (e && (e.code === 'CANCELLED' || /cancel/i.test(e.message || ''))) throw cancelled(e);
            throw e;
          }
          const res = await fetch(`${CLOUD.url}/functions/v1/line-auth`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CLOUD.anonKey }, body: JSON.stringify({ id_token: r.idToken }),
          });
          const d = await res.json().catch(() => ({}));
          if (!res.ok || !d.token_hash) throw new Error('LINE 登录没有完成，请再试一次。');
          const c = await cloudClient();
          const { data, error } = await c.auth.verifyOtp({ token_hash: d.token_hash, type: 'magiclink' });
          if (error) throw error;
          return data.user;
        }
        if (window.markAuthPending) markAuthPending();
        await Browser.open({ url: `${CLOUD.url}/functions/v1/line-auth?redirect=${encodeURIComponent(BACK)}`, presentationStyle: 'popover' });
        return null;
      },
    };
    CapApp.addListener('appUrlOpen', ({ url }) => {
      if (!url || !url.startsWith(BACK)) return;
      Browser.close().catch(() => {});
      if (typeof window.appAuthReturn === 'function') window.appAuthReturn(url);
    });
  }
})();
