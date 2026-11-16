'use strict';
/* 「学习」页（新排版）：
   1. 继续学习：学习路线上的下一步（path.js），一键开始
   2. 基础：单词、语法、汉字、假名，带本级进度（学完的排到后面，标「已掌握」）
   3. 练习、场景：一行一项的紧凑列表，按级别调整顺序
   4. 工具：一排小图标（词典、收藏、水平测试、我的弱项、学习伙伴）
   日语「学习」（studyHubJa）、中文「学ぶ」（studyHubLang('zh')）、英语「Learn」（studyHubLang('en'，阅读听力也在这一页)、
   日语「阅读 · 听力」和中文「読む・聴く」（riHub）都用这一套。 */
const hubPct = x => Math.round(Math.max(0, Math.min(1, x)) * 100);

// 继续学习：路线上现在这一步（英语、中文的数据要下载，先显示骨架）
function hubContinue(tr) {
  const T = (zh, ja) => ptT(tr, zh, ja), lv = ptCurLv(tr);
  const box = h('<section class="panel sh-continue"><div class="skel" role="status"><i></i><i></i></div></section>');
  const fill = ph => {
    const cur = ptCurIdx(tr, lv, ph);
    if (cur >= ph.length) {
      const nx = ptNextLv(tr, lv);
      box.innerHTML = `<div class="sh-c-top"><span class="sh-c-ic">🎓</span><div><div class="eyebrow">${T('继续学习', '続きから')}</div><b>${T(`${lv} 已经毕业`, `${lv} 卒業`)}</b></div></div>
        <div class="row">${nx ? `<button class="btn pri" type="button" data-up>${T(`升到 ${nx}`, `${nx} へ進む`)}</button>` : ''}<a class="btn ghost" href="#path/${lv}">${T('查看路线', 'ロードマップ')} ›</a></div>`;
      const up = box.querySelector('[data-up]'); if (up) up.onclick = () => { ptSetLv(tr, nx); render(); };
      return;
    }
    const x = ph[cur], all = (cur + x.prog) / ph.length;
    box.innerHTML = `<div class="sh-c-top"><span class="sh-c-ic" lang="${tr === 'en' ? 'en' : 'ja'}">${esc(x.ic)}</span><div class="sh-c-t"><div class="eyebrow">${T('继续学习', '続きから')} · ${esc(lv)} ${T(`第 ${cur + 1} 步`, `ステップ ${cur + 1}`)}</div><b>${esc(x.t)}</b><div class="small muted">${esc(x.d)}</div></div><span class="sh-c-pct">${hubPct(x.prog)}%</span></div>
      <div class="bar"><i style="width:${hubPct(x.prog)}%"></i></div>
      <div class="row sh-c-acts">${x.acts.map(([t, a]) => `<button class="btn soft" type="button" data-act="${esc(a)}">${esc(t)}</button>`).join('')}
        ${x.mock ? '' : `<button class="btn ${x.grad || x.prog >= PT_PASS ? 'pri' : 'ghost'}" type="button" data-test>${x.grad ? T('毕业测试', '卒業テスト') : x.prog >= PT_PASS ? T('阶段测试', 'ステージテスト') : T('直接挑战', 'いきなり挑戦')}</button>`}
        <a class="small sh-c-more" href="#path/${lv}">${T(`整个 ${lv} 的路线 · ${hubPct(all)}%`, `${lv} 全体 · ${hubPct(all)}%`)} ›</a></div>`;
    box.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => ptAct(tr, lv, ph, b.dataset.act); });
    const tb = box.querySelector('[data-test]'); if (tb) tb.onclick = () => ptStart(tr, lv, x, false);
  };
  if (tr === 'ja') fill(ptPhasesJa(lv));
  else ptPhases(tr, lv).then(ph => { if (box.isConnected) fill(ph); }).catch(() => box.remove());
  return box;
}

// 一个分组：tiles = 带进度的大格子；rows = 一行一项
function hubSection(title, cls, items, kind, into) {
  const sec = into ? h(`<div class="sh-sub ${cls}"><h3>${esc(title)}</h3></div>`) : h(`<section class="panel sh-sec ${cls}"><h3>${esc(title)}</h3></section>`);
  if (kind === 'tiles') sec.append(h(`<div class="sh-tiles">${items.map(it => `<a class="sh-tile ${it.done ? 'done' : ''}" href="${it.href}"><span class="sh-ic" lang="ja">${esc(it.ic)}</span><span class="sh-tile-t"><b>${esc(it.t)}</b>
      <span class="small muted">${esc(it.sub)}</span>${it.p != null ? `<span class="bar"><i style="width:${hubPct(it.p)}%"></i></span>` : ''}</span></a>`).join('')}</div>`));
  else sec.append(h(`<div class="sh-list">${items.map(it => `<a class="sh-row" href="${it.href}"><span class="sh-ic" lang="ja">${esc(it.ic)}</span><span class="sh-row-t"><b>${esc(it.t)}</b><span class="small muted">${esc(it.sub)}</span></span>${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ''}<span class="sh-go">›</span></a>`).join('')}</div>`));
  if (into) { into.append(sec); return into; }
  return sec;
}

function studyHubJa() {
  const T = (zh, ja) => tj(zh, ja), L = S.level, frag = document.createDocumentFragment();
  frag.append(hubContinue('ja'));
  // 基础：本级的进度
  const ratio = (list, f) => list.length ? list.filter(f).length / list.length : 0;
  const wp = ratio(VOCAB[L], learned), gp = ratio(GRAM[L], g => ptGramDone('ja', g)), kp = ratio(KANJI[L] || [], k => ((S.srs || {})[k.id] || {}).r > 0), kana = Math.min(1, (S.kanaRight || 0) / 80);
  const base = [
    { ic: '词', t: T('单词', '単語'), href: '#vocab', p: wp, sub: `${L} · ${hubPct(wp)}%`, done: wp >= 1 },
    { ic: '文', t: T('语法', '文法'), href: '#grammar', p: gp, sub: `${L} · ${hubPct(gp)}%`, done: gp >= 1 },
    { ic: '漢', t: T('汉字', '漢字'), href: '#kanji', p: kp, sub: `${L} · ${hubPct(kp)}%`, done: kp >= 1 },
    { ic: 'あ', t: T('假名', 'かな'), href: '#kana', p: kana >= 1 ? null : kana, sub: kana >= 1 ? T('✓ 已掌握', '✓ マスター') : T('五十音 · ', '五十音・') + hubPct(kana) + '%', done: kana >= 1 }
  ];
  // 零基础（N5、假名还不熟）假名排第一；学完的排到后面
  if (L === 'N5' && kana < 1) base.unshift(base.pop());
  base.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
  frag.append(hubSection(T('基础', '基礎'), 'g-base', base, 'tiles'));
  // 练习
  const ns = typeof nextStage === 'function' ? nextStage(L) : 1;
  const more = h('<section class="panel sh-sec sh-more"></section>');
  frag.append(more);
  hubSection(T('练习', '練習'), 'g-prac', [
    { ic: '関', t: T('闯关', 'ステージ'), href: '#game', sub: T('每关一组新词，3 条命', '1 ステージ 1 セット、ライフ 3 つ'), tag: T(`第 ${ns} 关`, `ステージ ${ns}`) },
    { ic: '変', t: T('变形练习', '活用練習'), href: '#conj', sub: T('动词、形容词的各种变形', '動詞・形容詞の活用') },
    { ic: '訳', t: T('翻译练习', '翻訳練習'), href: '#trans', sub: T('中日互译，自己打分', '日中翻訳、自己採点') },
    { ic: '戦', t: T('对战', '対戦'), href: '#duel', sub: T('和在线的人比单词速答', 'オンラインで単語の早押し') }
  ], 'rows', more);
  // 场景：N5、N4 课程在前，N3 以上商务在前
  const cn = Object.keys(S.course || {}).length;
  const course = { ic: '课', t: T('情景课程', 'シーン別レッスン'), href: '#course', sub: T('校园、打工、职场、生活……真实场景的会话', '学校・バイト・職場・生活…本物の場面の会話'), tag: cn ? T(`已学 ${cn} 课`, `${cn} 課 学習済み`) : '' };
  const biz = { ic: '商', t: T('商务日语', 'ビジネス日本語'), href: '#biz', sub: T('敬语、邮件、会议', '敬語・メール・会議') };
  const anime = { ic: '劇', t: T('动漫·日剧台词', 'アニメ・ドラマのセリフ'), href: '#anime', sub: T('名台词和生活里的用法', '名セリフと日常での使い方') };
  hubSection(T('场景', '場面'), 'g-scene', ['N5', 'N4'].includes(L) ? [course, anime, biz] : [biz, course, anime], 'rows', more);
  // 工具
  const tools = [['#dict', '🔍', T('词典', '辞書')], ['#fav', '★', T('收藏', 'お気に入り')], ['#me/weak', '弱', T('我的弱项', '弱点ノート')], ['#check', '測', T('水平测试', 'レベルチェック')], ['#buddy', '伴', T('学习伙伴', '学習仲間')]];
  frag.append(h(`<section class="panel sh-tools"><h3>${T('工具', 'ツール')}</h3><div class="sh-tool-row">${tools.map(([href, ic, t]) => `<a class="sh-tool" href="${href}"><span class="sh-ic" lang="ja">${esc(ic)}</span><span class="small">${esc(t)}</span></a>`).join('')}</div></section>`));
  return frag;
}

// 工具一排
function hubTools(tr, list) {
  const T = (zh, ja) => ptT(tr, zh, ja);
  return h(`<section class="panel sh-tools"><h3>${tr === 'en' ? 'Tools' : T('工具', 'ツール')}</h3><div class="sh-tool-row">${list.map(([href, ic, t]) => `<a class="sh-tool" href="${href}"><span class="sh-ic" lang="ja">${esc(ic)}</span><span class="small">${esc(t)}</span></a>`).join('')}</div></section>`);
}
// 先放一块骨架，数据（单词表、语法、阅读、听力）下载好以后换成各个分组
function hubLater(tr, build) {
  const hold = h('<section class="panel"><div class="skel" role="status"><i></i><i></i><i></i></div></section>');
  ptData(tr, ptCurLv(tr)).then(D => { if (!hold.isConnected) return; const f = document.createDocumentFragment(); build(D).forEach(n => f.append(n)); hold.replaceWith(f); })
    .catch(() => { if (hold.isConnected) hold.innerHTML = `<p class="muted">${ptT(tr, '暂时打不开，请检查网络后再试。', '読み込めませんでした。通信状況を確認してください。')}</p>`; });
  return hold;
}
const hubRatio = (list, f) => list.length ? list.filter(f).length / list.length : 0;

// 中文「学ぶ」、英语「Learn」
function studyHubLang(tr) {
  const T = (zh, ja) => ptT(tr, zh, ja), lv = ptCurLv(tr), frag = document.createDocumentFragment(), en = tr === 'en';
  frag.append(hubContinue(tr));
  frag.append(hubLater(tr, D => {
    const wp = hubRatio(D.words, ptWordDone), gp = hubRatio(D.gram, g => ptGramDone(tr, g));
    const out = [];
    if (en) {
      const rp = D.reads.length ? hubRatio(D.reads, a => (S.enRead || {})[a.id] != null) : null, lp = D.listens.length ? hubRatio(D.listens, x => (S.enListen || {})[x.id] != null) : null;
      const base = [{ ic: '词', t: 'Words', href: `#en/words/${lv}`, p: wp, sub: `${lv} · ${hubPct(wp)}%`, done: wp >= 1 }, { ic: '文', t: 'Grammar', href: `#en/grammar/${lv}`, p: gp, sub: `${lv} · ${hubPct(gp)}%`, done: gp >= 1 },
        { ic: '読', t: 'Reading', href: `#en/read/${lv}`, p: rp, sub: rp == null ? enNat('会员内容', 'メンバー限定') : `${lv} · ${hubPct(rp)}%`, done: rp >= 1 }, { ic: '聴', t: 'Listening', href: `#en/listen/${lv}`, p: lp, sub: lp == null ? enNat('会员内容', 'メンバー限定') : `${lv} · ${hubPct(lp)}%`, done: lp >= 1 }];
      base.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
      out.push(hubSection(enNat('基础与阅读听力', '基礎・読む・聴く'), 'g-base', base, 'tiles'));
      const st = (S.enPath || {})[lv] || {}, ns = D.words.length ? Math.min(Math.ceil(D.words.length / 10), Object.keys(st).length + 1) : 1;
      const more = h('<section class="panel sh-sec sh-more"></section>');
      const abc = { ic: 'Aa', t: 'Letters & sounds', href: '#en/abc', sub: enNat('字母、音标和发音', 'アルファベットと発音記号') };
      hubSection(enNat('练习', '練習'), 'g-prac', [
        ...(['A1', 'A2'].includes(lv) ? [abc] : []),
        { ic: '関', t: 'Word path', href: `#en/path/${lv}`, sub: enNat('每关一组新词，3 条命', '1 ステージ 1 セット、ライフ 3 つ'), tag: `Stage ${ns}` },
        { ic: '写', t: 'Dictation', href: '#en/dictation', sub: enNat('听一句，写一句，自动比对', '1 文聞いて書き取る・自動で答え合わせ') },
        { ic: '訳', t: 'Translation', href: '#en/trans', sub: enNat('中英互译，自己打分', '日本語⇄英語を訳して自己採点') },
        { ic: '戦', t: 'Duel', href: '#duel', sub: enNat('和别人比单词速答', '単語のスピード対戦') },
        { ic: '通', t: 'Commute listening', href: '#commute', sub: enNat('不用看屏幕，自动连续播放', '画面を見ずに聞き流し') },
        ...(['A1', 'A2'].includes(lv) ? [] : [abc])], 'rows', more);
      const course = { ic: '話', t: 'Scenario course', href: '#en/course', sub: enNat('在美国生活、工作的真实场景', 'アメリカの暮らしと仕事の場面') };
      const biz = { ic: '商', t: 'Business English', href: '#en/biz', sub: enNat('商务邮件和商务词汇', 'ビジネスメールとビジネス単語') };
      hubSection(enNat('场景', '場面'), 'g-scene', ['B2', 'C1'].includes(lv) ? [biz, course] : [course, biz], 'rows', more);
      out.push(more, hubTools(tr, [['#en/dict', '🔍', 'Dictionary'], ['#fav', '★', 'Favorites'], ['#me/weak', '弱', 'Weak spots'], ['#check', '測', 'Level check'], ['#buddy', '伴', 'Buddy']]));
      return out;
    }
    // 中文（界面是日语）
    const tone = typeof qstatSum === 'function' ? ((qstatSum(60, 'zh').tone || [0])[0]) : 0, tp = Math.min(1, tone / 30);
    const base = [{ ic: 'pīn', t: 'ピンイン・声調', href: '#zh/pinyin', p: tp >= 1 ? null : tp, sub: tp >= 1 ? '✓ マスター' : `声調 · ${hubPct(tp)}%`, done: tp >= 1 },
      { ic: '词', t: '単語帳', href: '#zh/words', p: wp, sub: `${lv} · ${hubPct(wp)}%`, done: wp >= 1 }, { ic: '文', t: '文法', href: `#zh/grammar/${lv}`, p: gp, sub: `${lv} · ${hubPct(gp)}%`, done: gp >= 1 }];
    base.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
    out.push(hubSection('基礎', 'g-base', base, 'tiles'));
    const n = +lv.slice(3), st = (S.zhPath || {})[n] || {}, ns = Math.min(Math.ceil(D.words.length / 10) || 1, Object.keys(st).length + 1);
    const more = h('<section class="panel sh-sec sh-more"></section>');
    hubSection('練習', 'g-prac', [
      { ic: '関', t: '学習ルート', href: `#zh/path/${lv}`, sub: '1 ステージ 1 セット、ライフ 3 つ', tag: `ステージ ${ns}` },
      { ic: '訳', t: '翻訳トレーニング', href: '#zh/trans', sub: '日本語⇄中国語を訳して自己採点' },
      { ic: '戦', t: '対戦', href: '#duel', sub: '同じ問題で早押しバトル' }], 'rows', more);
    const course = { ic: '话', t: '場面別会話', href: '#zh/course', sub: '旅行・食事・仕事・友達' }, biz = { ic: '商', t: 'ビジネス中国語', href: '#zh/biz', sub: 'メール・WeChat・ビジネス単語' };
    hubSection('場面', 'g-scene', n >= 4 ? [biz, course] : [course, biz], 'rows', more);
    out.push(more, hubTools(tr, [['#zh/dict', '🔍', '辞書'], ['#fav', '★', 'お気に入り'], ['#me/weak', '弱', '弱点ノート'], ['#check', '測', 'レベル測定'], ['#buddy', '伴', '学習仲間']]));
    return out;
  }));
  return frag;
}

// 日语「阅读 · 听力」、中文「読む・聴く」：本级的阅读、听力进度 + 下一篇推荐
function riHub(tr) {
  const T = (zh, ja) => ptT(tr, zh, ja), lv = ptCurLv(tr), hold = h('<section class="panel"><div class="skel" role="status"><i></i><i></i><i></i></div></section>');
  const build = (reads, rDone, lp, lsub, next, nextHref, nextTitle) => {
    const f = document.createDocumentFragment();
    if (next) f.append(h(`<a class="panel sh-next" href="${nextHref}"><span class="sh-c-ic" lang="ja">${T('读', '読')}</span><div class="sh-c-t"><div class="eyebrow">${T('下一篇推荐', '次のおすすめ')} · ${esc(lv)}</div><b lang="${tr === 'zh' ? 'zh-CN' : 'ja'}">${esc(nextTitle)}</b></div><span class="sh-go">›</span></a>`));
    const rp = reads ? rDone / reads : null;
    f.append(hubSection(T('阅读 · 听力', '読む・聴く'), 'g-base', [
      { ic: T('读', '読'), t: T('阅读', '読み物'), href: tr === 'ja' ? '#read' : '#zh/read', p: rp, sub: rp == null ? T('本级的文章是会员内容', 'このレベルはメンバー限定') : `${lv} · ${hubPct(rp)}%`, done: rp >= 1 },
      { ic: T('听', '聴'), t: T('听力', 'リスニング'), href: tr === 'ja' ? '#listen' : '#zh/listen', p: lp, sub: lsub, done: lp >= 1 }], 'tiles'));
    const more = h('<section class="panel sh-sec sh-more"></section>');
    hubSection(T('更多练习', 'もっと練習'), 'g-prac', [
      { ic: '写', t: T('听写', 'ディクテーション'), href: tr === 'ja' ? '#dictation' : '#zh/dictation', sub: T('听一句，写一句，自动比对', '1 文聞いて書き取る・自動で答え合わせ') },
      { ic: '通', t: T('通勤听力', '通勤リスニング'), href: '#commute', sub: T('不用看屏幕，自动连续播放', '画面を見ずに聞き流し') },
      ...(tr === 'ja' ? [{ ic: '劇', t: T('动漫·日剧台词', 'アニメ・ドラマのセリフ'), href: '#anime', sub: T('自然语速的口语', '自然な速さの話し言葉') }] : [])], 'rows', more);
    f.append(more);
    hold.replaceWith(f);
  };
  if (tr === 'ja') {
    loadScript('reading.js').then(() => (typeof readMember === 'function' ? readMember().catch(() => {}) : null)).then(() => {
      if (!hold.isConnected) return;
      const all = READING.filter(a => a.L === lv && a.p && a.p.length), done = all.filter(a => (S.read || {})[a.id]).length;
      const n = (S.listenHist || []).filter(e => e.L === lv && (e.lang || 'ja') === 'ja').length, nx = all.find(a => !(S.read || {})[a.id]);
      build(all.length, done, Math.min(1, n / 2), n ? T(`${lv} · 做过 ${n} 次听力测验`, `${lv} · 聴解テスト ${n} 回`) : T(`${lv} · 还没做过`, `${lv} · まだ受けていません`), nx, nx && `#read/${nx.id}`, nx && nx.title);
    }).catch(() => { if (hold.isConnected) hold.innerHTML = `<p class="muted">${T('暂时打不开，请检查网络后再试。', '読み込めませんでした。')}</p>`; });
  } else {
    Promise.all([zhRead().catch(() => []), zhListen().catch(() => [])]).then(([r, l]) => {
      if (!hold.isConnected) return;
      const all = r.filter(a => a.lv === lv), done = all.filter(a => (S.zhRead || {})[a.id]).length, ls = l.filter(x => x.lv === lv), ld = ls.filter(x => (S.zhLs || {})[x.id]).length;
      const nx = all.find(a => !(S.zhRead || {})[a.id]);
      build(all.length, done, ls.length ? ld / ls.length : null, ls.length ? `${lv} · ${hubPct(ld / ls.length)}%` : 'メンバー限定', nx, nx && `#zh/read/${nx.id}`, nx && (nx.title_ja || nx.title));
    });
  }
  return hold;
}
