'use strict';
// 启动最先运行的设置（以前写在 index.html 里；为了内容安全策略 CSP 只允许本站脚本文件，搬到这里）
// 视觉方案「清爽」（style.css 末尾的 data-look="clean"）：默认打开；开发时 localStorage.setItem('dojo-look', 'old') 可以看回旧样式
(function () { var look = 'clean'; try { look = localStorage.getItem('dojo-look') || 'clean'; } catch (e) { /* 忽略 */ } document.documentElement.setAttribute('data-look', look); })();
// 不让别的网站把本站套在框架里（防点击劫持）
if (window.top !== window.self) { try { window.top.location = window.location.href; } catch (e) { document.documentElement.style.display = 'none'; } }
// 图片加载失败（以前写在 <img onerror> 里，CSP 不允许内嵌代码）：data-fail="parent" 去掉外框，"self" 去掉图片，"cover" 换成文字封面
document.addEventListener('error', function (e) {
  var t = e.target; if (!t || t.tagName !== 'IMG' || !t.dataset || !t.dataset.fail) return;
  var f = t.dataset.fail;
  if (f === 'parent' && t.parentElement) t.parentElement.remove();
  else if (f === 'cover') { var c = t.closest('.an-card'), s = document.createElement('span'); s.className = 'an-cover'; s.textContent = c ? c.dataset.t : ''; t.replaceWith(s); }
  else t.remove();
}, true);
// 英语母语的用户（学日语、学中文）：先加载英语界面对照表 en-ui.js（i18n.js 的 enUiStart 用）。中文、日文用户不加载
(function () {
  try {
    var st = JSON.parse(localStorage.getItem('nihongo-dojo:v1') || '{}'), pref = localStorage.getItem('dojo-ui');
    var lang = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    var need = (st.native === 'en' && st.track !== 'en') || localStorage.getItem('dojo-en-dev') === '1' || (!st.onboarded && (pref === 'en' || (!pref && !/^(zh|ja)\b/i.test(lang))));
    if (need) document.write('<script src="en-ui.js"><\/script>' + (st.track === 'zh' ? '' : '<script src="en/ja-vocab.js"><\/script><script src="en/ja-grammar.js"><\/script><script src="en/ja-daily.js"><\/script>'));   // 学日语的英语用户：单词、语法、今日一句的英文版（app.js 换上）
  } catch (e) { /* 读不到就不加载 */ }
})();
// 网页字体：不阻塞页面显示，连不上 Google（例如中国大陆）时直接用系统字体
(function () { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@600;800&family=Zen+Maru+Gothic:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;700&family=Nunito:wght@800&display=swap'; document.head.appendChild(l); })();
  // 首屏：脚本把页面画好以前先不显示空的顶栏和页脚（app.js 画完第一页时去掉 boot）；万一脚本出错，5 秒后照样显示
  setTimeout(() => document.documentElement.classList.remove('boot'), 5000);
  // 录音的位置：网站上就是 audio/；装在 iPhone App 里时（app/build-web.mjs 会在前面加上 DOJO_APP），录音从网站在线加载
  // 日语录音（VOICEVOX）放在公开的音频仓库的 ja/ 下（在那边生成，Actions 不限分钟）；中文录音还在本站 audio/ 下
  window.AUD = 'https://koshokai.github.io/nihonggo-dojo-audio/ja/';
  window.AUD_ZH = (window.DOJO_APP && DOJO_APP.remote || '') + 'audio/';
  // 英语的录音（en-k/、en-h/、en-listen/ 和目录 index-en*.json）
  // 放在另一个仓库的 GitHub Pages 上：一个 GitHub Pages 网站最多 1 GB，主站放不下（koshokai/nihonggo-dojo-audio）
  window.AUD_EN = 'https://koshokai.github.io/nihonggo-dojo-audio/';
  window.audIdxBase = code => code === 'en' ? AUD_EN : code === 'zh' ? AUD_ZH : AUD;
  // App 里没有 Service Worker：录音目录（index-*.json，共约 2 MB）存在手机里，启动时先用存的那份（马上能播录音），同时在后台更新
  if (window.DOJO_APP && window.caches) {
    const net = window.fetch.bind(window), IDX = /\/index-[\w-]+\.json$/;
    window.fetch = (u, o) => {
      if (o || typeof u !== 'string' || !IDX.test(u) || !/^https:/.test(u)) return net(u, o);
      return caches.open('audio-idx').then(c => c.match(u).then(hit => {
        const fresh = net(u).then(r => { if (r.ok) c.put(u, r.clone()).catch(() => {}); return r; });
        if (hit) { fresh.catch(() => {}); return hit; }
        return fresh;
      })).catch(() => net(u));
    };
  }
  // 词典里级别词表以外的词（三种语言）：录音在第二个音频仓库（ja-d/、zh-d/、en-d/，index-dict-*.json）
  window.AUD2 = 'https://koshokai.github.io/nihonggo-dojo-audio2/';
  window.audUrl = f => /^https?:/.test(f) ? f : /^(ja-d2?|zh-d|en-d)\//.test(f) ? AUD2 + f : (/^(en-(k|h|listen)|zh-v|zh2|zh-s|zh-h2)\//.test(f) ? AUD_EN : /^zh(-h)?\//.test(f) ? AUD_ZH : AUD) + f;   // zh-v/：中文听力的男声（Kokoro），在音频仓库里生成   // 会员录音是完整的临时地址（member.js memberSign）
