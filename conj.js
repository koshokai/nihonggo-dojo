// 动词、形容词变形练习：词表在 lang/ja-conj.json（tools/build_conj.py 生成，带活用类型），变形规则在这里按规则算。
// 类型：g 五段、i 一段、s サ变（〜する）、k カ变（来る）、a い形容词。
let CONJ = null;
const conjLoad = () => CONJ ? Promise.resolve(CONJ) : fetch('lang/ja-conj.json').then(r => r.json()).then(d => (CONJ = d));
const G_ROW = { う: 'いわえお', く: 'きかけこ', ぐ: 'ぎがげご', す: 'しさせそ', つ: 'ちたてと', ぬ: 'になねの', ぶ: 'びばべぼ', む: 'みまめも', る: 'りられろ' };
const G_TE = { う: 'って', つ: 'って', る: 'って', む: 'んで', ぶ: 'んで', ぬ: 'んで', く: 'いて', ぐ: 'いで', す: 'して' };
const CONJ_FORMS = {
  masu: ['ます形', '礼貌的现在形'], nai: ['ない形', '否定'], ta: ['た形', '过去'], te: ['て形', '连接、请求（〜てください）'],
  nakatta: ['なかった形', '过去否定'], pot: ['可能形', '能……'], vol: ['意向形', '……吧（〜よう）'], ba: ['ば形', '如果……'],
};
const ADJ_FORMS = {
  kunai: ['〜くない', '否定'], katta: ['〜かった', '过去'], kunakatta: ['〜くなかった', '过去否定'], kute: ['〜くて', '连接'], ku: ['〜く', '副词（修饰动词）'], kereba: ['〜ければ', '如果……'],
};

// 把写法和读音都按同样的词尾变化（写法的送假名和读音的末尾一致）
function conjOne(w, r, k, form) {
  const tail = (s, n, add) => s.slice(0, s.length - n) + add;
  const both = (n, add) => [tail(w, n, add), tail(r, n, add)];
  if (k === 'a') {
    const good = r === 'いい' || r === 'よい';
    const W = good ? (w === 'いい' ? 'よい' : w) : w, R = good ? 'よい' : r;
    const st = add => [tail(W, 1, add), tail(R, 1, add)];
    return { kunai: st('くない'), katta: st('かった'), kunakatta: st('くなかった'), kute: st('くて'), ku: st('く'), kereba: st('ければ') }[form];
  }
  if (k === 's') {   // 〜する
    const m = { masu: 'します', nai: 'しない', ta: 'した', te: 'して', nakatta: 'しなかった', pot: 'できる', vol: 'しよう', ba: 'すれば' }[form];
    return both(2, m);
  }
  if (k === 'k') {   // 来る：写法留着「来」，读音变
    const m = { masu: ['ます', 'きます'], nai: ['ない', 'こない'], ta: ['た', 'きた'], te: ['て', 'きて'], nakatta: ['なかった', 'こなかった'], pot: ['られる', 'こられる'], vol: ['よう', 'こよう'], ba: ['れば', 'くれば'] }[form];
    return w.endsWith('来る') ? [tail(w, 1, m[0]), tail(r, 2, m[1])] : both(2, m[1]);
  }
  if (k === 'i') {
    const m = { masu: 'ます', nai: 'ない', ta: 'た', te: 'て', nakatta: 'なかった', pot: 'られる', vol: 'よう', ba: 'れば' }[form];
    return both(1, m);
  }
  // 五段
  const end = r.slice(-1), row = G_ROW[end];
  const iku = w.endsWith('行く') || r === 'いく';   // 行く的て形、た形是「行って」「行った」
  const te = iku ? 'って' : G_TE[end];
  if (form === 'nai' || form === 'nakatta') {
    if (r === 'ある') return [form === 'nai' ? 'ない' : 'なかった', form === 'nai' ? 'ない' : 'なかった'];
    return both(1, row[1] + (form === 'nai' ? 'ない' : 'なかった'));
  }
  return both(1, {
    masu: row[0] + 'ます', ta: te.replace('て', 'た').replace('で', 'だ'), te, pot: row[2] + 'る', vol: row[3] + 'う', ba: row[2] + 'ば',
  }[form]);
}
const conjShow = ([w, r]) => w === r ? w : `${w}（${r}）`;

function viewConj() {
  const o = S.conjOpt = Object.assign({ kind: 'v', forms: ['masu', 'nai', 'ta', 'te'] }, S.conjOpt);
  const box = h('<section class="panel"><h2>动词变形</h2><div class="skel" aria-label="加载中" role="status"><i></i><i></i><i></i></div></section>');
  main.append(box);
  conjLoad().then(d => {
    if (!box.isConnected) return;
    const L = S.level, words = (d[L] || []).filter(x => o.kind === 'a' ? x[2] === 'a' : o.kind === 'v' ? x[2] !== 'a' : true);
    const forms = o.kind === 'a' ? Object.keys(ADJ_FORMS) : o.forms.length ? o.forms : ['masu'];
    const p = h(`<section class="panel">
      <div class="row between"><h2>变形练习 · ${L}</h2>${levelSeg(L)}</div>
      <p class="small muted">给出原形和要变的形式，选出正确的变形。答错的会告诉你规则。动词有五段、一段、サ变（〜する）、カ变（来る）四类，变法不同。</p>
      <div class="seg" role="group">${[['v', '动词'], ['a', 'い形容词'], ['all', '混合']].map(([k, t]) => `<button type="button" data-kind="${k}" class="${o.kind === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${o.kind === 'a' ? '' : `<div class="row cat-row">${Object.entries(CONJ_FORMS).map(([k, [t]]) => `<button type="button" class="chip-btn ${o.forms.includes(k) ? 'on' : ''}" data-form="${k}">${t}</button>`).join('')}</div>`}
      <div class="row between"><span class="small muted">${L} 有 ${words.length} 个${o.kind === 'a' ? '形容词' : o.kind === 'v' ? '动词' : '动词和形容词'}</span><button class="btn pri" type="button" data-conj-go ${words.length ? '' : 'disabled'}>开始 10 题</button></div>
      <details class="gram-item"><summary><b>变形规则速查</b></summary>
        <div class="small conj-rules">
          <p><b>五段动词</b>（词尾 う・く・ぐ・す・つ・ぬ・ぶ・む・る）：ます形把词尾变成 い 段（書く→書きます），ない形变成 あ 段（書かない，う→わ：買わない），て形按词尾：う・つ・る→って，む・ぶ・ぬ→んで，く→いて（行く→行って 例外），ぐ→いで，す→して。</p>
          <p><b>一段动词</b>（〜いる・〜える，如 見る、食べる）：去掉 る 直接接：食べます、食べない、食べて、食べられる。</p>
          <p><b>サ变</b>：する→します・しない・して・できる。<b>カ变</b>：来る→きます・こない・きて・こられる。</p>
          <p><b>い形容词</b>：去掉 い 接：高くない、高かった、高くて、高く。いい→よくない・よかった。</p>
        </div></details>
    </section>`);
    bindLevel(p);
    p.querySelectorAll('[data-kind]').forEach(b => { b.onclick = () => { o.kind = b.dataset.kind; save(); render(); }; });
    p.querySelectorAll('[data-form]').forEach(b => { b.onclick = () => { const f = b.dataset.form; o.forms = o.forms.includes(f) ? o.forms.filter(x => x !== f) : [...o.forms, f]; save(); render(); }; });
    p.querySelector('[data-conj-go]').onclick = () => {
      const qs = sample(words, 10).map(([w, r, k, zh]) => {
        const fs = k === 'a' ? Object.keys(ADJ_FORMS) : forms;
        const f = fs[Math.floor(Math.random() * fs.length)], names = k === 'a' ? ADJ_FORMS : CONJ_FORMS;
        const right = conjOne(w, r, k, f);
        // 干扰项：同一个词的其他形式 + 按别的类型变（五段/一段搞混是最常见的错）
        const wrong = [...Object.keys(names).filter(x => x !== f).map(x => conjOne(w, r, k, x)),
          ...(k === 'g' && r.endsWith('る') ? [conjOne(w, r, 'i', f)] : k === 'i' ? [conjOne(w, r, 'g', f)] : [])].filter(Boolean).map(conjShow);
        return makeQ(null, 'conj', distract(conjShow(right), wrong), conjShow(right), {
          optLang: 'ja', say: right[1],
          prompt: `<div class="eyebrow">变成「${names[f][0]}」（${names[f][1]}）</div><div class="q-big" lang="ja">${esc(w)}</div><div class="muted" lang="ja">${esc(r)} · ${esc(zh)}</div>`,
          explain: `<span lang="ja">${esc(w)}</span> 是${{ g: '五段动词', i: '一段动词', s: 'サ变动词', k: 'カ变动词', a: 'い形容词' }[k]}，${esc(names[f][0])}：<b lang="ja">${esc(conjShow(right))}</b>`,
        });
      });
      main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
      runQuiz(host, qs, { title: `${L} 变形练习`, noRecord: true, xpEach: 5, onDone: r => { if (!r) return render(); quizSummary(host, r, { title: '变形练习', again: () => render() }); } });
    };
    box.replaceWith(p);
  });
}
