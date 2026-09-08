/* =========================================================================
   BEAST CRADLE ― 育てる場所
   餌場・走路・打ち場・技場。どれも一週つかい、伸びと引きかえに
   疲れ・ごきげん・体重・けがが動く。
   ========================================================================= */
'use strict';

const TRAIN_PLACES = [
  { id: 'food', name: '餌をあげる', icon: '🍚', place: '餌場',
    lead: '食べさせると疲れが抜け、ごきげんも戻る。ただし太る。何を出すかで伸びる能力が変わる。',
    menu: () => FOODS },
  { id: 'run',  name: '走らせる',   icon: '🏃', place: '走路',
    lead: 'すばやさを伸ばす。走らせるほど締まるが、疲れがたまる。',
    menu: () => RUN_MENU },
  { id: 'hit',  name: '殴る練習',   icon: '🥊', place: '打ち場',
    lead: 'ちからを伸ばす。打撃わざをひらめくのはここ。無理をすればけがをする。',
    menu: () => HIT_MENU },
  { id: 'tech', name: '技の練習',   icon: '✨', place: '技場',
    lead: 'わざを伸ばし、選んだわざの熟練を上げる。新しい技わざと必殺はここでひらめく。',
    menu: () => TECH_MENU },
];

/* --------------------------------------------------------------
   場所をひらく
   -------------------------------------------------------------- */
function screenTrain(placeId) {
  const place = TRAIN_PLACES.find((p) => p.id === placeId);
  const c = focusCreature();
  if (!c) { toast('育てる子がいない。'); return screenHome(); }

  const body = el('div', 'train', [
    el('div', 'train-who', [
      beastCard(c, { size: 92, full: true, extra: conditionBlock(c) }),
      G.stable.length > 1 ? btn('別の子にする', askFocus, 'ghost small') : null,
    ]),
    c.injury >= 2 ? el('p', 'warn', 'けがが重い。いまは休ませたほうがいい（餌場でのんびりさせると治りが早い）。') : null,
    el('div', 'menu-list', place.menu().map((m) => {
      const cost = m.cost || 0;
      const poor = cost > G.coins;
      const lonely = m.pair && !G.stable.some((x) => x.id !== c.id && x.injury < 2);
      const off = poor || lonely;
      return el('button', {
        class: 'menu-item' + (off ? ' off' : ''), type: 'button', disabled: off,
        onClick: () => beginTraining(place, m),
      }, [
        el('span', 'mi-icon', m.icon),
        el('span', 'mi-body', [
          el('b', null, m.name + (cost ? '　🪙' + cost : '')),
          el('span', 'mi-note', lonely ? '組む相手がいない。牧舎に二匹めが来てから。' : m.note),
          el('span', 'mi-eff', trainEffectLine(c, m)),
        ]),
      ]);
    })),
  ]);

  show(panel({
    eyebrow: place.place,
    title: place.name,
    lead: place.lead,
    body: body,
    foot: [btn('もどる', screenHome, 'ghost')],
  }));
}

/* 伸びかたの目安を、その子の今の状態で見積もって出す。 */
function trainEffectLine(c, m) {
  const parts = [];
  for (const id in (m.gain || {})) {
    const g = trainGain(c, id, m.gain[id], true);
    parts.push(STAT_BY_ID[id].name + ' +' + (g < 0.5 ? '0' : Math.round(g)));
  }
  if (m.fatigue) parts.push('つかれ ' + (m.fatigue > 0 ? '+' : '') + Math.round(m.fatigue));
  if (m.mood) parts.push('ごきげん ' + (m.mood > 0 ? '+' : '') + m.mood);
  if (m.weight) parts.push('体重 ' + (m.weight > 0 ? '+' : '') + m.weight);
  if (m.mastery) parts.push('熟練 +' + m.mastery);
  if (m.injury) parts.push('けが ' + Math.round(m.injury * 100) + '%');
  if (m.cure) parts.push('けが全快');
  return parts.join('　');
}

/* --------------------------------------------------------------
   えらんだ内容を実行する前の枝分かれ
   組手は相手えらび、型のけいこはわざえらび。
   -------------------------------------------------------------- */
function beginTraining(place, m) {
  const c = focusCreature();
  if (m.cost && m.cost > G.coins) { toast('コインが足りない。'); return; }

  if (m.pair) {
    const others = G.stable.filter((x) => x.id !== c.id && x.injury < 2);
    if (!others.length) { toast('組手の相手がいない。'); return; }
    askPick('組手の相手', 'どちらも同じだけ伸び、絆が育つ。', others.map((o) => ({
      value: o.id, icon: '🤝', label: o.name,
      note: SPECIES[o.sp].name + '　' + o.age + '週　つかれ ' + Math.round(o.fatigue) +
        '　絆 ' + '♥'.repeat(bondLevel(c, o)),
    })), (id) => runTraining(place, m, { partnerId: id }));
    return;
  }

  if (m.mastery && c.moves.length) {
    const kind = m.masteryKind === 'strike' ? 'strike' : 'tech';
    const targets = c.moves.filter((mm) => {
      const k = MOVES[mm.id].kind;
      return kind === 'strike' ? (k === 'strike' || (k === 'finish' && MOVES[mm.id].stat === 'power'))
                               : (k === 'tech' || (k === 'finish' && MOVES[mm.id].stat === 'tech'));
    });
    if (!targets.length) return runTraining(place, m, {});
    askPick('どのわざをみがく？',
      (kind === 'strike' ? '打ち場でみがけるのは打撃わざ。' : '技場でみがけるのは技わざ。') + '熟練は威力と命中に効く。',
      targets.map((mm) => {
      const mv = MOVES[mm.id];
      return {
        value: mm.id, icon: mv.kind === 'finish' ? '💥' : mv.kind === 'tech' ? '✨' : '👊',
        label: mv.name, note: mv.text,
        right: '熟練 ' + Math.round(mm.mastery),
        disabled: mm.mastery >= 100,
      };
    }), (id) => runTraining(place, m, { moveId: id }));
    return;
  }
  runTraining(place, m, {});
}

/* --------------------------------------------------------------
   一週つかう
   -------------------------------------------------------------- */
function runTraining(place, m, opt) {
  const c = focusCreature();
  if (m.cost) G.coins -= m.cost;

  const before = snapshot(c);
  const rep = doTraining(c, m, opt);
  const reports = [{ c: c, rep: rep, before: before }];

  if (opt.partnerId) {
    const p = byId(opt.partnerId);
    const pb = snapshot(p);
    const prep = doTraining(p, m, {});
    reports.push({ c: p, rep: prep, before: pb });
    addBond(c, p, 1);
  }

  advanceWeek();
  showTrainingResult(place, reports, opt);
}

function snapshot(c) {
  const s = { stats: {}, fatigue: c.fatigue, mood: c.mood, weight: c.weight };
  STAT_IDS.forEach((id) => { s.stats[id] = c.stats[id]; });
  return s;
}

function showTrainingResult(place, reports, opt) {
  const rows = [];
  reports.forEach((r) => {
    const c = r.c;
    rows.push(el('div', 'res-row', [
      el('div', 'res-pic', [portraitCanvas(c, 84)]),
      el('div', 'res-body', [
        el('b', 'res-name', c.name),
        el('div', 'res-gains', STATS.map((s) => {
          const d = c.stats[s.id] - r.before.stats[s.id];
          return el('span', { class: 'gain' + (d >= 0.5 ? ' up' : ''), style: { '--c': s.color } },
            s.name + ' ' + (d >= 0.5 ? '+' + Math.round(d) : '±0'));
        })),
        el('div', 'res-cond', [
          condDelta('つかれ', c.fatigue - r.before.fatigue, true),
          condDelta('ごきげん', c.mood - r.before.mood, false),
          condDelta('体重', c.weight - r.before.weight, true),
        ]),
        r.rep.notes.length ? el('ul', 'res-notes', r.rep.notes.map((n) => el('li', null, n))) : null,
        r.rep.injured ? el('p', 'res-injury', c.name + ' は' + r.rep.injured + 'をした。しばらく本調子ではない。') : null,
      ]),
    ]));
  });

  /* ひらめきは一件ずつ処理する */
  const sparks = reports.filter((r) => r.rep.learned);

  show(panel({
    eyebrow: place.place + '　第 ' + (G.week - 1) + ' 週',
    title: '今週の手ごたえ',
    body: el('div', 'result', rows),
    foot: [
      btn('つづける', () => {
        if (sparks.length) handleSpark(sparks, 0, () => screenTrain(place.id));
        else screenTrain(place.id);
      }, 'primary'),
      btn('牧舎へ', () => {
        if (sparks.length) handleSpark(sparks, 0, screenHome);
        else screenHome();
      }, 'ghost'),
    ],
  }));
}

function condDelta(name, d, worseUp) {
  const r = Math.round(d);
  if (r === 0) return el('span', 'cd', name + ' ±0');
  const bad = worseUp ? r > 0 : r < 0;
  return el('span', { class: 'cd ' + (bad ? 'bad' : 'good') }, name + ' ' + (r > 0 ? '+' : '') + r);
}

/* --------------------------------------------------------------
   ひらめき
   -------------------------------------------------------------- */
function handleSpark(list, i, done) {
  if (i >= list.length) return done();
  const c = list[i].c;
  const mvId = list[i].rep.learned;
  const mv = MOVES[mvId];
  const next = () => handleSpark(list, i + 1, done);

  const body = el('div', 'spark', [
    el('div', 'spark-pic', [portraitCanvas(c, 96)]),
    el('div', 'spark-body', [
      el('div', 'spark-move', [
        el('b', null, mv.name),
        el('span', { class: 'chip type', style: { '--c': mv.type ? TYPES[mv.type].color : '#8d93a6' } },
          mv.kind === 'finish' ? '必殺' : mv.kind === 'tech' ? '技' : '打撃'),
      ]),
      el('p', null, mv.text),
      el('p', 'spark-num', '威力 ' + mv.power + '　命中 ' + (mv.acc >= 100 ? '必中' : mv.acc)),
    ]),
  ]);

  if (c.moves.length < TUNE.maxMoves) {
    addMove(c, mvId);
    saveGame();
    askConfirm(c.name + ' が ' + mv.name + ' をひらめいた！', body, 'おぼえた', next, { single: true });
    return;
  }
  askPick(c.name + ' が ' + mv.name + ' をひらめいた', 'わざは ' + TUNE.maxMoves + ' つまで。どれかを忘れる。',
    c.moves.map((mm) => ({
      value: mm.id, label: MOVES[mm.id].name, note: MOVES[mm.id].text,
      right: '熟練 ' + Math.round(mm.mastery), icon: '🔁',
    })).concat([{ value: '__skip', label: 'おぼえない', note: 'いまのわざのままにする。', icon: '✋' }]),
    (drop) => {
      if (drop !== '__skip') { dropMove(c, drop); addMove(c, mvId); }
      saveGame();
      next();
    }, { cancelLabel: 'おぼえない', sticky: true, onCancel: next });
}
