// 只在 iPhone App（Capacitor）里加载：用原生功能代替网页里在 App 内不能用的部分。
// 1. 答题震动 → 原生触感（Haptics）
// 2. 学习提醒：App 内没有网页推送，改用本地通知，每天在选定的时间提醒；不需要服务器，也不收集任何信息
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
  const ID = 1001;
  async function setReminder(hour) {
    await LocalNotifications.cancel({ notifications: [{ id: ID }] }).catch(() => {});
    if (hour == null) return;
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') throw new Error('没有允许通知。可以在 iPhone「设置 → 通知 → 猫先生」里打开。');
    await LocalNotifications.schedule({ notifications: [{
      id: ID, title: '猫先生', body: '今天的十分钟还没学哦，来复习几张卡片吧。',
      schedule: { on: { hour, minute: 0 }, allowWhileIdle: true }
    }] });
  }
  // 已经打开的提醒每次启动都重新排一次：旧版本排的提醒还带着旧名字（OmniSphere），重排后标题变成新名字。已经允许过通知才排，不弹权限框
  if (typeof S !== 'undefined' && S.appRemind != null) {
    LocalNotifications.checkPermissions().then(p => { if (p.display === 'granted') return setReminder(S.appRemind); }).catch(() => {});
  }
  // 「我的」页面加一个学习提醒面板（代替网页的推送提醒）
  window.appReminderPanel = () => {
    const cur = S.appRemind;
    const p = h(`<section class="panel"><h2>学习提醒</h2>
      <p class="small muted">每天在这个时间提醒你学习（iPhone 本地通知，不需要联网）。</p>
      <div class="row"><select data-hr>${[7, 8, 9, 12, 18, 19, 20, 21, 22].map(x => `<option value="${x}" ${cur === x ? 'selected' : ''}>${x}:00</option>`).join('')}</select>
      <button class="btn pri" type="button" data-on>${cur != null ? '更新时间' : '打开提醒'}</button>${cur != null ? '<button class="btn ghost" type="button" data-off>关闭</button>' : ''}</div></section>`);
    p.querySelector('[data-on]').onclick = async () => {
      const hr = +p.querySelector('[data-hr]').value;
      try { await setReminder(hr); S.appRemind = hr; save(); toast(`每天 ${hr}:00 提醒你学习`); render(); } catch (e) { toast(e.message || '设置失败'); }
    };
    const off = p.querySelector('[data-off]');
    if (off) off.onclick = async () => { await setReminder(null); S.appRemind = null; save(); toast('已关闭学习提醒'); render(); };
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
