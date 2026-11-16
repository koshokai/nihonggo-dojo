// 只在 iPhone App（Capacitor）里加载，而且要在其他脚本之前：App 内的网页没有浏览器的语音识别，
// 这里用 iOS 原生的语音识别（@capgo/capacitor-speech-recognition）做一个同样用法的 SpeechRecognition，
// 跟读（shadow.js）不用改就能在 App 里识别你说的话。识别在苹果的系统里完成，我们不保存录音和识别结果。
(() => {
  if (!window.Capacitor || window.SpeechRecognition || window.webkitSpeechRecognition) return;
  const plugin = () => (window.Capacitor.Plugins || {}).SpeechRecognition;
  class NativeSR {
    constructor() { this.lang = 'ja-JP'; this.maxAlternatives = 3; this.interimResults = false; this.onresult = this.onerror = this.onend = null; }
    async start() {
      const P = plugin();
      const end = () => { if (this.onend) this.onend(); };
      if (!P) { if (this.onerror) this.onerror({ error: 'not-allowed' }); return end(); }
      try {
        const ok = await P.available();
        if (!ok || !ok.available) throw new Error('unavailable');
        const perm = await P.requestPermissions();
        if (perm.speechRecognition !== 'granted') { if (this.onerror) this.onerror({ error: 'not-allowed' }); return end(); }
        const r = await P.start({ language: this.lang, maxResults: this.maxAlternatives, partialResults: false, popup: false });
        const m = (r && r.matches) || [];
        if (m.length && this.onresult) {
          const alts = m.map(t => ({ transcript: t, confidence: 1 }));
          alts.isFinal = true;
          this.onresult({ results: [alts] });
        }
      } catch (e) {
        if (this.onerror) this.onerror({ error: 'no-speech' });
      }
      end();
    }
    stop() { const P = plugin(); if (P) P.stop().catch(() => {}); }
    abort() { this.stop(); }
  }
  window.SpeechRecognition = NativeSR;
})();
