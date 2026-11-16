// 界面语言：学中文（zh 板块）的是日本用户，整个界面（导航、我的、登录、提示框……）都用日语显示。
// 用法：tj('中文文字', '日本語の文字') —— 学中文时返回日语，其余返回中文。
// 不属于某门语言的页面（我的、登录等）跟着当前正在学的语言走（S.track）。
// 还没选学什么语言（新装、刚打开、注册登录页）：按手机的系统语言显示中文或日语，注册页上可以手动切换（localStorage 的 dojo-ui）。
const uiPref = () => { try { return localStorage.getItem('dojo-ui'); } catch (e) { return null; } };
const uiJa = () => {
  try {
    const st = (typeof S !== 'undefined' && S) || JSON.parse(localStorage.getItem('nihongo-dojo:v1') || '{}');
    if (st.track === 'zh') return true;
    if (st.track === 'en') return st.enNative === 'ja';   // 英语板块：界面跟着用户的母语（en.js）
    if (st.onboarded) return false;
    const pref = uiPref();
    if (pref) return pref === 'ja';
    return /^ja\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || '');
  } catch (e) { return false; }
};
const tj = (zh, ja) => uiJa() ? ja : zh;
// 英语板块的界面以英语为主（讲解、翻译才用中文 / 日文）：各页面共用的部件（测验、今日任务、首页顶部、底部导航）在英语板块里显示 en
// 还没选语言的新用户（登录页、正在连接）：选了 English，或手机不是中文 / 日语时，用英语
const preEn = () => {
  try {
    const st = (typeof S !== 'undefined' && S) || JSON.parse(localStorage.getItem('nihongo-dojo:v1') || '{}');
    if (st.onboarded || st.track === 'zh') return false;
    const pref = uiPref();
    if (pref) return pref === 'en';
    return !/^(zh|ja)\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || '');
  } catch (e) { return false; }
};
const tje = (zh, ja, en) => { try { if (typeof S !== 'undefined' && S && S.track === 'en') return en; } catch (e) { /* 忽略 */ } return preEn() ? en : tj(zh, ja); };

// index.html 里写死的文字（页脚、顶栏小标签的提示、导航的无障碍名称……）：学中文时换成日语。
// 要换的元素在 HTML 里带 data-ja（文字）或 data-ja-<属性名>（title、aria-label、content 等属性）。
// 第一次换之前把原来的中文存进 data-zh / data-zh-<属性名>，切回其他语言时还原。lang.js 的 applyTrack 每次渲染都会调用。
function i18nStatic() {
  const ja = uiJa();
  document.querySelectorAll('[data-ja]').forEach(el => {
    if (!('zh' in el.dataset)) el.dataset.zh = el.textContent;
    const en = 'en' in el.dataset && typeof S !== 'undefined' && S && S.track === 'en';   // 英语板块：有 data-en 的用英语
    const t = en ? el.dataset.en : ja ? el.dataset.ja : el.dataset.zh;
    if (el.textContent !== t) el.textContent = t;
  });
  document.querySelectorAll('[data-ja-title],[data-ja-aria-label],[data-ja-placeholder],[data-ja-content]').forEach(el => {
    for (const a of [...el.attributes]) {
      if (!a.name.startsWith('data-ja-')) continue;
      const attr = a.name.slice(8), keep = 'data-zh-' + attr;
      if (!el.hasAttribute(keep)) el.setAttribute(keep, el.getAttribute(attr) || '');
      el.setAttribute(attr, ja ? a.value : el.getAttribute(keep));
    }
  });
}
// 产品名：所有显示品牌的地方都用这个（改名只改这里和 index.html / manifest.json / app/capacitor.config.json）
const BRAND = '猫先生';
