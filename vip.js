/* 猫先生会员（1.1）：入口在左上角的小猫图标（会员的图标右下角显示 VIP）。
   iPhone App 里用 App Store 订阅（RevenueCat，app/native.js 的 appIAP）；网页暂不销售，同一账号登录网页也能用会员。
   会员身份在服务器（memberships 表，member.js 读进 S.member）；档位：l1 一种语言、l2 两种、l3 三种，买完选语言。 */
function vipBadge() {
  const b = document.querySelector('.brand');
  if (!b) return;
  b.classList.toggle('is-vip', typeof isMember === 'function' && isMember());
  b.title = tje('猫先生会员', '猫先生メンバー', 'Neko Sensei Membership');
}
const VIP_LANGS = { ja: ['日语', '日本語', 'Japanese'], zh: ['中文', '中国語', 'Chinese'], en: ['英语', '英語', 'English'] };
const vipLang = k => tje(...VIP_LANGS[k]);
const VIP_TIERS = { l1: 1, l2: 2, l3: 3 };
// 会员能多学到什么：三种语言用同一套分类、同样的写法（不写「共多少个」这种数字）；界面语言不同只是翻译不同
const VIP_CAT = {
  course: ['情景课程', 'シーン別レッスン', 'Scenario lessons'],
  words: ['单词例句', '単語の例文', 'Word examples'],
  grammar: ['语法', '文法', 'Grammar'],
  exam: ['模拟考', '模擬試験', 'Mock exams'],
  read: ['阅读', '読み物', 'Reading'],
  listen: ['听力', 'リスニング', 'Listening'],
  biz: ['商务', 'ビジネス', 'Business'],
  play: ['闯关', 'ステージ', 'Stages'],
  anime: ['动漫日剧', 'アニメ・ドラマ', 'Anime & drama']
};
const VIP_PERKS = {
  ja: [
    ['course', '每个主题第 2 课以后全部开放（校园、恋爱、打工、职场、留学、商务），每课都有配音', '各テーマの第 2 課以降がすべて学べます（キャンパス・恋愛・アルバイト・職場・留学・ビジネス）。全レッスン音声つき', 'Every lesson after lesson 1 in each theme (campus, dating, part-time work, office, study abroad, business), all with audio'],
    ['words', 'N3、N2、N1 单词的全部例句和配音（N5、N4 免费）', 'N3・N2・N1 の単語の例文をすべて、音声つきで（N5・N4 は無料）', 'All example sentences for N3, N2 and N1 words, with audio (N5 and N4 are free)'],
    ['grammar', 'N3、N2、N1 每个句型的全部例句和配音，以及例句填空练习（N5、N4 免费）', 'N3・N2・N1 の文型の例文をすべて音声つきで、例文の穴埋め練習も（N5・N4 は無料）', 'All example sentences for N3, N2 and N1 grammar points, with audio and fill-in practice (N5 and N4 are free)'],
    ['exam', 'N3、N2、N1 的模拟考和题型专项练习（N5、N4 免费）', 'N3・N2・N1 の模擬試験と問題形式別の練習（N5・N4 は無料）', 'N3, N2 and N1 mock exams and question-type drills (N5 and N4 are free)'],
    ['read', 'N2、N1 文章和会员专属文章，带配音、假名和生词', 'N2・N1 の読み物とメンバー限定の読み物。音声・ふりがな・単語つき', 'N2 and N1 articles plus member-only articles, with audio, furigana and vocabulary'],
    ['listen', '全部听力题，按 JLPT 题型顺序的听力测验，题型练习不限题数', '全問題、JLPT の出題順どおりのリスニングテスト、形式別練習は無制限', 'All questions, full JLPT-style listening tests and unlimited drills'],
    ['biz', '商务邮件全部范文、完整的敬语表、全部商务词汇（免费是样课）', 'ビジネスメールの全例文、敬語の完全な一覧、ビジネス語彙のすべて（無料はサンプル）', 'All business email samples, the full keigo table and all business vocabulary (free: samples)'],
    ['play', '闯关每个级别第 16 关以后', '各レベルのステージ 16 以降', 'Stages from 16 onward at every level'],
    ['anime', '动漫·日剧名台词的全部作品（免费是每周精选），动漫风台词每日一课的往期', 'アニメ・ドラマ名セリフの全作品（無料は毎週のおすすめ）、アニメ風セリフ「毎日の一課」のバックナンバー', 'Every anime & drama quote collection (free: weekly picks) and past daily anime-style lessons']
  ],
  zh: [
    ['course', '每个主题第 2 课以后全部开放（含商务中文），每课都有配音', '各テーマの第 2 課以降がすべて学べます（ビジネス中国語を含む）。全レッスン音声つき', 'Every lesson after lesson 1 in each theme, including Business Chinese, all with audio'],
    ['words', 'HSK4 以上单词的全部例句和配音（HSK1–3 免费）', 'HSK4 以上の単語の例文をすべて、音声つきで（HSK1〜3 は無料）', 'All example sentences for HSK 4+ words, with audio (HSK 1–3 are free)'],
    ['grammar', 'HSK3 以上每个语法点的全部例句和配音', 'HSK3 以上の文法項目の例文をすべて、音声つきで', 'All example sentences for HSK 3+ grammar points, with audio'],
    ['exam', 'HSK3 到 HSK6 的模拟考和题型练习（HSK1、HSK2 免费）', 'HSK3〜HSK6 の模擬試験と形式別練習（HSK1・HSK2 は無料）', 'HSK 3–6 mock exams and question-type drills (HSK 1–2 are free)'],
    ['read', '会员专属读物，带配音、拼音和生词', 'メンバー限定の読み物。音声・ピンイン・単語つき', 'Member-only articles with audio, pinyin and vocabulary'],
    ['listen', '会员听力题，带配音、原文和解说', 'メンバー限定のリスニング問題。音声・スクリプト・解説つき', 'Member-only listening questions with audio, script and explanations'],
    ['biz', '商务中文的全部邮件和微信范文、全部商务词汇（免费是样课）', 'ビジネス中国語のメール・WeChat の全例文、ビジネス単語のすべて（無料はサンプル）', 'All Business Chinese email and WeChat samples and all business vocabulary (free: samples)'],
    ['play', '学习路线每个级别第 16 关以后', '学習ルートの各レベル第 16 ステージ以降', 'Learning-path stages from 16 onward at every level']
  ],
  en: [
    ['course', '每个主题第 2 课以后全部开放（吃饭、购物、旅行、职场、商务等），每课有对话、生词、句型和测验', '各テーマの第 2 課以降がすべて学べます（食事・買い物・旅行・職場・ビジネスなど）。会話・単語・文型・クイズつき', 'Every lesson after lesson 1 in each theme (food, shopping, travel, office, business and more), with dialogue, words, patterns and quizzes'],
    ['words', 'B2、C1 单词的全部例句和配音（A1–B1 免费）', 'B2・C1 の単語の例文をすべて、音声つきで（A1〜B1 は無料）', 'All example sentences for B2 and C1 words, with audio (A1–B1 are free)'],
    ['grammar', '每个级别的全部语法讲解和练习题（免费是每个级别的一部分）', '各レベルの文法解説と練習問題をすべて（無料は各レベルの一部）', 'All grammar lessons and exercises at every level (free: part of each level)'],
    ['exam', 'B1 到 C1 的模拟考和题型练习（A1、A2 免费）', 'B1〜C1 の模擬試験と形式別練習（A1・A2 は無料）', 'B1–C1 mock exams and question-type drills (A1–A2 are free)'],
    ['read', '每个级别的全部文章，带配音和生词（免费是每个级别的一部分）', '各レベルの読み物をすべて、音声・単語つきで（無料は各レベルの一部）', 'All articles at every level, with audio and vocabulary (free: part of each level)'],
    ['listen', '每个级别的全部听力题，带配音、原文和解说（免费是每个级别的一部分）', '各レベルのリスニング問題をすべて、音声・スクリプト・解説つきで（無料は各レベルの一部）', 'All listening questions at every level, with audio, script and explanations (free: part of each level)'],
    ['biz', '商务英语的全部邮件范文、全部商务词汇（免费是样课）', 'ビジネス英語のメール全例文、ビジネス単語のすべて（無料はサンプル）', 'All business English email samples and all business vocabulary (free: samples)'],
    ['play', '学习路线每个级别第 16 关以后', '学習ルートの各レベル第 16 ステージ以降', 'Learning-path stages from 16 onward at every level']
  ]
};
const VIP_ALL = [['点词看释义、例句语音不限次数（免费每天有次数）', '単語タップ・例文音声が回数無制限（無料は 1 日の回数に上限あり）', 'Unlimited word lookups and example audio (free: daily limit)'],
  ['学习诊断、水平测试的完整报告', '学習診断・レベルチェックの詳しいレポート', 'Full study diagnosis and level-check reports'],
  ['对战不限局数，还能玩听力抢答、汉字读音', '対戦が回数無制限、リスニング早押し・ピンイン当ても遊べる', 'Unlimited duels, plus listening and reading modes']];
// 一种语言的会员内容：分类 + 内容，三种语言同一个格式
const vipPerkRows = rows => `<dl class="vip-rows">${rows.map(([c, ...t]) => `<div><dt>${esc(tje(...VIP_CAT[c]))}</dt><dd>${esc(tje(...t))}</dd></div>`).join('')}</dl>`;

function viewVip() {
  const on = typeof isMember === 'function' && isMember(), m = S.member || {};
  const until = on ? new Date(Math.max(...['until', 'exp', 'ja', 'en', 'zh'].map(k => m[k] || 0))).toLocaleDateString(uiJa() ? 'ja-JP' : S.track === 'en' ? 'en-US' : 'zh-CN') : '';
  const need = on && m.tier && m.tier !== 'l3' && (m.langs || []).length < VIP_TIERS[m.tier];
  const app = !!window.appIAP, login = typeof sbUser !== 'undefined' && !!sbUser;
  const p = h(`<section class="panel vip">
    <div class="vip-head"><img class="vip-mark" src="icon-192.png" alt="" width="64" height="64"><div>
      <h2>${tje('猫先生会员', '猫先生メンバー', 'Neko Sensei Membership')}</h2>
      <p class="muted">${on ? tje(`会员有效期至 ${until}`, `メンバー期間：${until} まで`, `Member until ${until}`) + (m.tier ? ` · ${m.tier === 'l3' ? tje('三种语言', '3 言語', 'All 3 languages') : (m.langs || []).map(vipLang).join('・')}` : '')
        : tje('选你要学的语言，解锁全部内容', '学びたい言語を選んで、すべてのコンテンツを解放', 'Pick your languages and unlock everything')}</p></div></div>
    <div data-langs></div>
    <h3>${tje('会员能多学到什么', 'メンバーになると', 'What you get')}</h3>
    ${on && isMember(S.track || 'ja') ? '' : `<div class="vip-now"><p>${esc(tje(`你正在学${vipLang(S.track || 'ja')}。开通${vipLang(S.track || 'ja')}会员后，这些内容全部开放：`, `いま${vipLang(S.track || 'ja')}を学習中です。${vipLang(S.track || 'ja')}のメンバーになると、次のコンテンツがすべて使えます：`, `You're learning ${vipLang(S.track || 'ja')}. Membership unlocks all of:`))}</p>
      <div class="row">${VIP_PERKS[S.track || 'ja'].map(([c]) => `<span class="tag">${esc(tje(...VIP_CAT[c]))}</span>`).join('')}</div></div>`}
    <p class="small muted">${tje('选了哪种语言，就开放那种语言的全部会员内容（三种语言方案全部开放）。最下面「所有会员」的功能，每个方案都有。', '選んだ言語のメンバーコンテンツがすべて使えます（3 言語プランはすべて）。いちばん下の「すべてのメンバー」の機能はどのプランにもついています。', 'You get all member content for the languages you choose (the 3-language plan includes everything). The "All members" features come with every plan.')}</p>
    <div class="vip-perks">${['ja', 'zh', 'en'].map(k => `<details class="vip-perk" ${k === (S.track || 'ja') ? 'open' : ''}><summary><b>${vipLang(k)}</b>${vipTag('inl')}</summary>${vipPerkRows(VIP_PERKS[k])}</details>`).join('')}
      <details class="vip-perk"><summary><b>${tje('所有会员', 'すべてのメンバー', 'All members')}</b></summary><ul>${VIP_ALL.map(t => `<li>${esc(tje(...t))}</li>`).join('')}</ul></details></div>
    <h3>${tje('选择方案', 'プランを選ぶ', 'Choose a plan')}</h3>
    <div data-plans>${app ? (login ? `<p class="small muted">${tje('正在读取价格…', '価格を読み込み中…', 'Loading prices…')}</p>`
        : `<p>${tje('开通会员需要先登录（会员跟着账号走，换手机也不丢）。', 'メンバー登録にはログインが必要です（メンバーはアカウントに紐づくので、機種変更しても引き継げます）。', 'Please sign in first — membership is tied to your account.')}</p><button class="btn pri" type="button" data-login>${tje('登录', 'ログイン', 'Sign in')}</button>`)
      : `<p>${tje('网页版暂时不能购买：请在 iPhone 的「猫先生」App 里开通。用同一个账号登录网页，会员也能用。', 'ウェブ版では購入できません。iPhone の「猫先生」アプリで登録してください。同じアカウントでログインすれば、ウェブでもメンバー機能が使えます。', 'Membership can be purchased in the Neko Sensei iPhone app. Sign in here with the same account to use it on the web.')}</p>
        <div class="row"><a class="btn pri" href="https://apps.apple.com/app/id6830187313" target="_blank" rel="noopener">${tje('在 App Store 打开', 'App Store で開く', 'Open in the App Store')}</a><a class="btn" href="#${S.track === 'zh' ? 'zh' : S.track === 'en' ? 'en' : 'home'}">${tje('继续学习', '学習に戻る', 'Back to learning')}</a></div>`}</div>
    ${app ? `<div class="row"><button class="btn ghost" type="button" data-restore>${tje('恢复购买', '購入を復元', 'Restore purchases')}</button>${on ? `<button class="btn ghost" type="button" data-manage>${tje('管理订阅', 'サブスクリプションを管理', 'Manage subscription')}</button>` : ''}</div>` : ''}
    <p class="small muted vip-legal">${tje('订阅会自动续费：1 个月方案每月、3 个月方案每 3 个月按所选价格从 Apple ID 账户扣款。可以随时在 iPhone「设置 → Apple ID → 订阅」中取消；在当前周期结束前至少 24 小时取消，就不会续费。购买时选择要学的语言（一种方案选 1 个、两种方案选 2 个，三种方案全部开放），之后每个付费周期可以改选一次。',
      'サブスクリプションは自動更新です。1 か月プランは毎月、3 か月プランは 3 か月ごとに、選んだ料金が Apple ID アカウントに請求されます。iPhone の「設定 → Apple ID → サブスクリプション」からいつでも解約でき、現在の期間が終わる 24 時間前までに解約すれば更新されません。購入時に学ぶ言語を選びます（1 言語プランは 1 つ、2 言語プランは 2 つ、3 言語プランはすべて）。その後、言語は支払い期間ごとに 1 回変更できます。',
      'Subscriptions renew automatically: monthly plans every month, 3-month plans every 3 months, charged to your Apple ID. Cancel anytime in iPhone Settings → Apple ID → Subscriptions at least 24 hours before the current period ends to avoid renewal. Choose your languages when you buy (1 for the 1-language plan, 2 for the 2-language plan, all for the 3-language plan); after that you can change them once per billing period.')}
      <br><a href="terms.html" target="_blank">${tje('服务条款', '利用規約', 'Terms of Use')}</a> · <a href="privacy.html" target="_blank">${tje('隐私政策', 'プライバシーポリシー', 'Privacy Policy')}</a> · <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noopener">${tje('Apple 标准许可协议', 'Apple 標準使用許諾契約', 'Apple Standard EULA')}</a></p>
  </section>`);
  main.append(p);
  const lg = p.querySelector('[data-login]'); if (lg) lg.onclick = () => authScreen('login');
  if (need) vipLangPicker(p.querySelector('[data-langs]'), m);
  else if (on && m.tier && m.tier !== 'l3') {
    // 每个付费周期只能改一次：这个周期改过了就告诉用户下次什么时候能改
    const used = m.lc && m.ps && m.lc >= m.ps, next = new Date(m.exp || 0).toLocaleDateString(uiJa() ? 'ja-JP' : S.track === 'en' ? 'en-US' : 'zh-CN');
    const b = h(used ? `<p class="small muted">${tje(`这个付费周期已经改过语言了，${next} 续费以后可以再改。`, `この支払い期間はすでに言語を変更済みです。${next} の更新後にまた変更できます。`, `You've already changed languages this period. You can change again after renewal on ${next}.`)}</p>`
      : `<div><button class="btn ghost small" type="button">${tje('更改语言', '言語を変更', 'Change languages')}</button> <span class="small muted">${tje('这个付费周期还可以改一次', 'この支払い期間はあと 1 回変更できます', 'You can change once this period')}</span></div>`);
    const bt = b.querySelector && b.querySelector('button');
    if (bt) bt.onclick = () => { b.remove(); vipLangPicker(p.querySelector('[data-langs]'), m); };
    p.querySelector('[data-langs]').append(b);
  }
  // 会员：把会员内容下载到设备上（没网也能学）
  if (on) {
    const dl = h(`<div class="vip-dl"><button class="btn small" type="button">${tje('下载会员内容（离线也能学）', 'メンバーコンテンツをダウンロード（オフラインでも学習）', 'Download member content for offline use')}</button> <span class="small muted" data-dlst></span></div>`);
    const st = dl.querySelector('[data-dlst]'), btn = dl.querySelector('button');
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        st.textContent = tje('正在下载…', 'ダウンロード中…', 'Downloading…');
        await memberDownloadAll();
        st.textContent = tje('已下载。没网的时候也能看（录音需要联网）。', 'ダウンロードしました。オフラインでも読めます（音声はネット接続が必要です）。', 'Downloaded. Text works offline (audio needs a connection).');
      } catch (e) { st.textContent = tje('下载没有完成，请联网后再试。', 'ダウンロードできませんでした。ネットに接続してもう一度お試しください。', 'Download failed. Please try again online.'); }
      btn.disabled = false;
    };
    p.querySelector('[data-langs]').after(dl);
  }
  const rs = p.querySelector('[data-restore]');
  if (rs) rs.onclick = async () => {
    if (!login) return authScreen('login');
    rs.disabled = true;
    try { await window.appIAP.restore(); await memberSyncNow(); toast(isMember() ? tje('已恢复会员', 'メンバーを復元しました', 'Membership restored') : tje('没有找到可以恢复的订阅', '復元できるサブスクリプションが見つかりません', 'No subscription found to restore')); render(); }
    catch (e) { toast(tje('恢复失败，请稍后再试', '復元できませんでした。しばらくしてからお試しください', 'Restore failed. Please try again later.')); rs.disabled = false; }
  };
  const mg = p.querySelector('[data-manage]'); if (mg) mg.onclick = () => window.appIAP.manage();
  if (app && login) vipPlans(p.querySelector('[data-plans]'));
}

// 价格从 App Store 读（当地货币）；按档位分组：一种 / 两种 / 三种语言，各有 1 个月和 3 个月
async function vipPlans(box) {
  let pk = [];
  try { pk = await window.appIAP.packages(); } catch (e) { box.innerHTML = `<p class="muted">${tje('暂时读不到价格，请检查网络后再打开这一页。', '価格を読み込めませんでした。ネットワークを確認して、もう一度開いてください。', 'Couldn\'t load prices. Please check your connection and try again.')}</p><p class="small muted">${esc(String((e && (e.code != null ? e.code + ' ' : '') + (e.message || e.underlyingErrorMessage || '')) || e).slice(0, 300))}</p>`; return; }
  const by = {};
  for (const x of pk) { const m = /^neko\.(l[123])\.(\d)m$/.exec(x.product && x.product.identifier || ''); if (m) (by[m[1]] = by[m[1]] || {})[m[2]] = x; }
  const cur = S.member && S.member.tier, on = isMember();
  const names = { l1: tje('一种语言', '1 言語', '1 language'), l2: tje('两种语言', '2 言語', '2 languages'), l3: tje('三种语言', '3 言語（すべて）', 'All 3 languages') };
  if (!Object.keys(by).length) { box.innerHTML = `<p class="muted">${tje('暂时没有可以购买的方案。', '現在購入できるプランはありません。', 'No plans available right now.')}</p>`; return; }
  box.innerHTML = ['l1', 'l2', 'l3'].filter(t => by[t]).map(t => `<div class="vip-tier ${on && cur === t ? 'cur' : ''}"><div class="vip-tier-t"><b>${names[t]}</b>${on && cur === t ? `<span class="tag done">${tje('当前方案', '現在のプラン', 'Current')}</span>` : ''}</div>
    <div class="vip-buy">${['1', '3'].filter(d => by[t][d]).map(d => `<button class="btn ${d === '3' ? 'pri' : ''}" type="button" data-pk="${t}.${d}"><span>${d === '1' ? tje('1 个月', '1 か月', '1 month') : tje('3 个月', '3 か月', '3 months')}</span><b>${esc(by[t][d].product.priceString)}</b></button>`).join('')}</div></div>`).join('');
  box.querySelectorAll('[data-pk]').forEach(b => { b.onclick = async () => {
    const [t, d] = b.dataset.pk.split('.'), pkg = by[t][d];
    // 一种、两种方案：先选语言，再付款（三种方案全部开放，直接付款）
    let langs = null;
    if (t !== 'l3') { langs = await vipPickSheet(t, pkg.product.priceString); if (!langs) return; }
    box.querySelectorAll('[data-pk]').forEach(x => { x.disabled = true; });
    try {
      const ok = await window.appIAP.buy(pkg);
      if (ok) {
        if (langs) { S.vipPend = { tier: t, langs, t: Date.now() }; save(); }   // 会员身份同步到以后自动设置语言（vipApplyPend）
        await memberSyncNow();
        if (!isMember()) { await new Promise(r => setTimeout(r, 2500)); await memberSyncNow(); }   // 付款通知可能晚几秒
        await vipApplyPend();
        toast(isMember() ? tje('开通成功，谢谢支持！', 'ご登録ありがとうございます！', 'Welcome aboard — thank you!') : tje('付款已完成，会员正在开通，稍后会自动生效', 'お支払いが完了しました。まもなく反映されます', 'Payment complete. Your membership will be active shortly.'));
        if (typeof celebrate === 'function' && isMember()) celebrate();
        render(); return;
      }
    } catch (e) { toast(tje('购买没有完成，请稍后再试', '購入が完了しませんでした。しばらくしてからお試しください', 'Purchase didn\'t complete. Please try again later.')); }
    box.querySelectorAll('[data-pk]').forEach(x => { x.disabled = false; });
  }; });
}

// 购买前选语言：一种方案选 1 个、两种方案选 2 个。返回选好的语言，取消返回 null
function vipPickSheet(tier, price) {
  const n = VIP_TIERS[tier], m = S.member || {}, sel = new Set();
  for (const k of [...(m.langs || []), S.track || 'ja']) if (sel.size < n && VIP_LANGS[k]) sel.add(k);
  return new Promise(res => {
    const box = h(`<div class="ask-mask" role="dialog" aria-modal="true"><div class="ask-box vip-pick"></div></div>`), inner = box.querySelector('.vip-pick');
    const close = v => { box.remove(); res(v); };
    const draw = () => {
      inner.innerHTML = `<p><b>${tje(`请选择要学的 ${n} 种语言`, `学ぶ言語を ${n} つ選んでください`, `Choose ${n} language${n > 1 ? 's' : ''}`)}</b></p>
        <div class="row">${['ja', 'zh', 'en'].map(k => `<button type="button" class="btn ${sel.has(k) ? 'pri' : ''}" data-l="${k}">${sel.has(k) ? '✓ ' : ''}${vipLang(k)}</button>`).join('')}</div>
        <p class="small muted">${tje('买完以后，每个付费周期可以改选一次。', '購入後も、支払い期間ごとに 1 回変更できます。', 'You can change once per billing period after purchase.')}</p>
        <div class="ask-opts"><button class="btn" type="button" data-x>${tje('取消', 'キャンセル', 'Cancel')}</button><button class="btn pri" type="button" data-ok ${sel.size === n ? '' : 'disabled'}>${tje(`购买 ${price}`, `${price} で購入`, `Buy for ${price}`)}</button></div>`;
      inner.querySelectorAll('[data-l]').forEach(b => { b.onclick = () => { const k = b.dataset.l; if (sel.has(k)) sel.delete(k); else if (sel.size < n) sel.add(k); else if (n === 1) { sel.clear(); sel.add(k); } draw(); }; });
      inner.querySelector('[data-x]').onclick = () => close(null);
      inner.querySelector('[data-ok]').onclick = () => close([...sel]);
    };
    box.onclick = e => { if (e.target === box) close(null); };
    draw();
    document.body.append(box);
  });
}
// 买的时候选好的语言：会员身份从服务器读到以后设置（同一档、还没选够语言时；买完 1 天内有效）
let vipPendBusy = false;
async function vipApplyPend() {
  const p = S.vipPend, m = S.member;
  if (!p || vipPendBusy) return;
  if (Date.now() - p.t > 864e5) { delete S.vipPend; save(); return; }
  if (!m || m.tier !== p.tier || !(typeof isMember === 'function' && isMember())) return;
  const same = (m.langs || []).length === p.langs.length && p.langs.every(k => m.langs.includes(k));
  if (same) { delete S.vipPend; save(); return; }
  vipPendBusy = true;
  try {
    const r = await memberChooseLangs(p.langs);
    if (r === 'ok' || r === 'once_per_period' || r === 'all' || r === 'bad') { delete S.vipPend; save(); }
  } catch (e) { /* 下次读身份时再试 */ }
  vipPendBusy = false;
}

// 选语言（一种方案选 1 个、两种方案选 2 个）
function vipLangPicker(box, m) {
  const n = VIP_TIERS[m.tier], sel = new Set((m.langs || []).slice(0, n));
  const draw = () => {
    box.innerHTML = `<div class="vip-langs"><p><b>${tje(`请选择要学的 ${n} 种语言`, `学ぶ言語を ${n} つ選んでください`, `Choose ${n} language${n > 1 ? 's' : ''}`)}</b></p>
      <div class="row">${['ja', 'zh', 'en'].map(k => `<button type="button" class="btn ${sel.has(k) ? 'pri' : ''}" data-l="${k}">${sel.has(k) ? '✓ ' : ''}${vipLang(k)}</button>`).join('')}</div>
      <p class="small muted">${tje('每个付费周期可以改选一次。', '言語は支払い期間ごとに 1 回変更できます。', 'You can change once per billing period.')}</p>
      <button class="btn pri" type="button" data-ok ${sel.size === n ? '' : 'disabled'}>${tje('确定', '決定', 'Confirm')}</button></div>`;
    box.querySelectorAll('[data-l]').forEach(b => { b.onclick = () => { const k = b.dataset.l; if (sel.has(k)) sel.delete(k); else if (sel.size < n) sel.add(k); else if (n === 1) { sel.clear(); sel.add(k); } draw(); }; });
    box.querySelector('[data-ok]').onclick = async () => {
      try {
        const r = await memberChooseLangs([...sel]);
        if (r === 'ok') { toast(tje('已设置好语言', '言語を設定しました', 'Languages saved')); render(); }
        else if (r === 'once_per_period') toast(tje('这个付费周期已经改过一次了，下个周期再改', 'この支払い期間はすでに変更済みです。次の期間に変更できます', 'Already changed this period — you can change again next period'));
        else toast(tje('没有设置成功，请稍后再试', '設定できませんでした。しばらくしてからお試しください', 'Couldn\'t save. Please try again later.'));
      } catch (e) { toast(tje('没有设置成功，请稍后再试', '設定できませんでした。しばらくしてからお試しください', 'Couldn\'t save. Please try again later.')); }
    };
  };
  draw();
}

/* ---------- 免费额度（会员不限）：点词看释义每天 20 次；例句语音每天 10 句，用完后可以用 100 经验换 1 句，每天最多换 5 次 ---------- */
const Q_GLOSS = 20, Q_EXA = 10, Q_BUY = 5, Q_COST = 100;
function qDay() { if (!S.q || S.q.d !== dkey()) S.q = { d: dkey(), g: 0, a: [], b: 0 }; return S.q; }
const qMember = () => typeof isMember === 'function' && isMember(S.track || 'ja');
function qUpsell(msg) {
  askSheet(msg, [[false, tje('明天再来', '明日また', 'Maybe tomorrow')], [true, tje('了解会员', 'メンバーについて', 'About membership'), 'pri']]).then(v => { if (v) location.hash = '#vip'; });
}
// 点词看释义：能看就记一次；不能看就提示
function glossOK() {
  if (qMember()) return true;
  const q = qDay();
  if (q.g < Q_GLOSS) { q.g++; save(); if (q.g === Q_GLOSS) toast(tje('这是今天最后一次免费的点词释义', '今日の無料の単語タップはこれが最後です', 'That was your last free word lookup today')); return true; }
  qUpsell(tje('今天免费的点词释义已经用完了，明天会重新开放。会员可以不限次数查看。', '今日の無料の単語タップは使い切りました。明日また使えます。メンバーは回数無制限です。', 'You\'ve used today\'s free word lookups. They reset tomorrow. Members get unlimited lookups.'));
  return false;
}
// 例句语音：同一句当天重听不算；auto 为 true 时（翻卡自动朗读）不弹窗，额度不够就不读
async function exAudioOK(key, auto) {
  if (qMember()) return true;
  const q = qDay();
  if (q.a.includes(key)) return true;
  if (q.a.length < Q_EXA + q.b) { q.a.push(key); save(); return true; }
  if (auto) return false;
  if (q.b >= Q_BUY) { qUpsell(tje('今天的例句语音已经听完了，明天会重新开放。会员可以不限次数收听。', '今日の例文音声は聞き切りました。明日また聞けます。メンバーは回数無制限です。', 'You\'ve reached today\'s limit for example audio. It resets tomorrow. Members can listen without limits.')); return false; }
  const left = Q_BUY - q.b;
  const ok = await askSheet(tje(`今天免费的例句语音听完了。用 ${Q_COST} 经验换 1 句吗？（今天还能换 ${left} 次，你现在有 ${S.xp} 经验）`, `今日の無料の例文音声は聞き終わりました。${Q_COST} XP で 1 文と交換しますか？（今日はあと ${left} 回、いまの XP：${S.xp}）`, `Free example audio for today is used up. Spend ${Q_COST} XP to hear this sentence? (${left} left today; you have ${S.xp} XP)`),
    [[false, tje('不用了', 'やめる', 'No thanks')], ['m', tje('了解会员', 'メンバーについて', 'About membership')], [true, tje(`用 ${Q_COST} 经验换`, `${Q_COST} XP で交換`, `Spend ${Q_COST} XP`), 'pri']]);
  if (ok === 'm') { location.hash = '#vip'; return false; }
  if (ok !== true) return false;
  if (S.xp < Q_COST) { toast(tje('经验不够，再学一会儿就有了', 'XP が足りません。もう少し学習しましょう', 'Not enough XP yet. Keep studying!')); return false; }
  S.xp -= Q_COST; q.b++; q.a.push(key); save();
  if (typeof updateTop === 'function') updateTop();
  return true;
}
