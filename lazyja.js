'use strict';
// 打开速度：注音表（furi-map.js，约 300 KB）和今日一句（daily.js）只有日语板块用。学中文、英语、打开的也不是日语页面时，
// 先不加载（页面出来以后再在后台加载，app.js 的 LAZY_JA）；去日语页面时 render 会等它们加载好
(function () {
  var tr = 'ja';
  try { tr = JSON.parse(localStorage.getItem('nihongo-dojo:v1') || '{}').track || 'ja'; } catch (e) { /* 忽略 */ }
  var later = (tr === 'zh' || tr === 'en') && (!location.hash || /^#(zh|en|me|path|check|diag|fav|calendar|offline|buddy|duel|vip|hi|about|commute)\b/.test(location.hash));
  if (later) window.LAZY_JA = ['furi-map.js', 'daily.js'];
  else document.write('<script src="furi-map.js"><\/script><script src="daily.js"><\/script>');
})();
