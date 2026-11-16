// 英语学习路线（闯关）：每关一组新词 → 3 条命的测验 → 星星，过关解锁下一关。和中文的学习路线（zh.js zhPathPage）一样：
// 每个级别前 15 关免费，之后是英语会员（EN_STAGE_FREE）。路线：#en/path/<级别>
const EN_STAGE_FREE = 15, EN_STAGE_N = 10;
const enStageVip = i => i >= EN_STAGE_FREE && !(typeof isMember === 'function' && isMember('en'));
const enShort = x => enNat(x.zh, x.ja).split(/[；;、，,]/)[0];

function enPathPage(lvArg) {
  const lv = EN_LV.includes(lvArg) ? lvArg : enLevel();
  enSetLevel(lv);
  const p = h('<section class="panel"><div class="skel" role="status"><i></i><i></i><i></i></div></section>');
  main.append(p);
  enFetch(`en-${lv}`).then(rows => {
    if (!p.isConnected) return;
    const list = enItems(lv, rows).filter(x => x.zh && x.ja);
    const st = ((S.enPath = S.enPath || {})[lv] = S.enPath[lv] || {});
    const stages = Math.ceil(list.length / EN_STAGE_N), cur = Array.from({ length: stages }, (_, i) => i).find(i => !st[i]) ?? stages;
    const stars = Object.values(st).reduce((a, b) => a + b, 0);
    p.className = 'panel zh-path';
    p.innerHTML = `<div class="row between"><h2>Learning path</h2><a class="small" href="#en/ri">Back</a></div>
      ${enLvSeg(lv, 'path')}
      <p class="small muted">${enNat(`已过 ${Object.keys(st).length} 关 · ★ ${stars}　每关一组新词，3 条命，答错扣一条。`, `クリア ${Object.keys(st).length} · ★ ${stars}　1 ステージごとに新しい単語、ライフ 3 つ。`)}</p>
      <div class="zh-nodes">${Array.from({ length: stages }, (_, i) => {
        const done = st[i], open = i <= cur, words = list.slice(i * EN_STAGE_N, i * EN_STAGE_N + EN_STAGE_N);
        return `<button type="button" class="zh-node has-vip ${done ? 'done' : ''} ${i === cur ? 'cur' : ''}" data-st="${i}" ${open || enStageVip(i) ? '' : 'disabled'} style="--x:${[0, 34, 54, 34, 0, -34, -54, -34][i % 8]}px">${i >= EN_STAGE_FREE ? vipTag() : ''}
          <span class="zh-node-n">${done ? '★'.repeat(done) || '✓' : enStageVip(i) && open ? '🔒' : i + 1}</span>${i === cur ? `<span class="zh-node-here">${neko('happy', 'mini wave')}</span>` : ''}
          <span class="zh-node-w" lang="en">${esc(words.slice(0, 3).map(x => x.w).join(' · '))}</span></button>`;
      }).join('')}</div>`;
    p.prepend(enLangBar());
    p.querySelectorAll('[data-st]').forEach(b => { b.onclick = () => {
      const i = +b.dataset.st;
      if (typeof guestStage === 'function' && guestStage('en', i + 1)) return;   // 游客：前 3 关
      if (enStageVip(i)) return askSheet(enNat(`第 ${EN_STAGE_FREE + 1} 关以后是英语会员内容。前面的单词随时可以在单词卡里复习。`, `ステージ ${EN_STAGE_FREE + 1} 以降は英語メンバー向けです。ここまでの単語は復習カードでいつでも練習できます。`),
        [[false, enNat('以后再说', 'あとで')], [true, enNat('了解会员', 'メンバーについて'), 'pri']]).then(v => { if (v) location.hash = '#vip'; });
      enStage(lv, i, list);
    }; });
    const c = p.querySelector('.zh-node.cur'); if (c) setTimeout(() => c.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
  }).catch(() => { if (p.isConnected) p.innerHTML = `<h2>Learning path</h2>${enLoadFail()}`; });
}

function enStage(lv, i, list) {
  const words = list.slice(i * EN_STAGE_N, i * EN_STAGE_N + EN_STAGE_N);
  const qs = shuffle(words).map(x => {
    const others = sample(list.filter(y => y.w !== x.w && enShort(y) !== enShort(x)), 3);
    return Math.random() < .55
      ? makeQ(x, 'meaning', others.map(enShort), enShort(x), { prompt: `<div class="eyebrow">What does this word mean?</div><div class="q-big" lang="en">${esc(x.w)}</div><div class="small muted">${esc(x.ipa || '')}</div>`, say: x.w, sayLang: 'en-US', explain: `<b lang="en">${esc(x.w)}</b> ${esc(enNat(x.zh, x.ja))}` })
      : makeQ(x, 'word', others.map(y => y.w), x.w, { prompt: `<div class="eyebrow">${enNat('用英语怎么说？', '英語で言うと？')}</div><div class="q-big">${esc(enShort(x))}</div>`, optLang: 'en', say: x.w, sayLang: 'en-US', explain: `<b lang="en">${esc(x.w)}</b> ${esc(enNat(x.zh, x.ja))}` });
  });
  main.innerHTML = ''; const host = h('<div></div>'); main.append(host);
  runQuiz(host, qs, { title: `${lv} Stage ${i + 1}`, hearts: 3, noRecord: true, xpEach: 5, onDone: r => {
    if (!r) return go(`en/path/${lv}`);
    r.res.forEach(x => { if (!x.ok && x.q.id) S.srs[x.q.id] = Object.assign({ i: 0, e: 2.5, r: 0 }, S.srs[x.q.id], { due: Date.now() }); });
    const stars = r.failed ? 0 : Math.max(1, r.hearts);
    const st = ((S.enPath = S.enPath || {})[lv] = S.enPath[lv] || {});
    if (stars) { st[i] = Math.max(st[i] || 0, stars); celebrate(); }
    save();
    const more = i + 1 < Math.ceil(list.length / EN_STAGE_N) && !enStageVip(i + 1);
    host.innerHTML = `<section class="panel"><div class="welcome-hi">${neko(stars ? (stars === 3 ? 'cheer' : 'happy') : 'sad', 'big')}<div class="bubble"><b>${stars ? `Stage clear! ${'★'.repeat(stars)}` : 'Out of lives'}</b><span>${stars ? enNat('答错的单词已经加入复习卡。', '間違えた単語は復習カードに入りました。') : enNat('再挑战一次吧，答错的单词已经加入复习卡。', 'もう一度挑戦しましょう。間違えた単語は復習カードに入っています。')}</span></div></div>
      <div class="row"><button class="btn pri" type="button" data-next>${stars ? (more ? 'Next stage' : 'Back to the path') : 'Try again'}</button><a class="btn" href="#en/path/${lv}">${'Back to the path'}</a></div></section>`;
    host.querySelector('[data-next]').onclick = () => stars ? (more ? enStage(lv, i + 1, list) : go(`en/path/${lv}`)) : enStage(lv, i, list);
  } });
}
