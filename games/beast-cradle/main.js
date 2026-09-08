/* =========================================================================
   BEAST CRADLE ― 進行
   タイトル → 最初の一匹 → 牧舎（育成の4か所・闘技場・市場）→ 引退と継承
   ========================================================================= */
'use strict';

const SAVE_KEY = 'beast-cradle-save-v1';

const G = {
  week: 1,
  coins: TUNE.startCoins,
  rank: 0,
  stable: [],
  focus: null,
  team: [],
  cleared: {},
  keepsakes: [],
  retired: [],
  battles: 0,
  wins: 0,
  champion: false,
  market: null,
};

/* --------------------------------------------------------------
   セーブ
   -------------------------------------------------------------- */
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) { /* 保存できない設定なら黙って諦める */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.stable) || !d.stable.length) return false;
    Object.keys(G).forEach((k) => { if (d[k] !== undefined) G[k] = d[k]; });
    return true;
  } catch (e) { return false; }
}
function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

const byId = (id) => G.stable.find((c) => c.id === id);
function focusCreature() {
  let c = byId(G.focus);
  if (!c) { c = G.stable[0]; G.focus = c ? c.id : null; }
  return c;
}
function setFocus(id) { G.focus = id; saveGame(); }

function advanceWeek() {
  passWeek(G.stable);
  G.week += 1;
  G.market = null;   /* 市場は毎週入れかわる */
  saveGame();
}

/* --------------------------------------------------------------
   タイトル
   -------------------------------------------------------------- */
function screenTitle() {
  const demo = ['mofumo', 'kagizume', 'tsunosuke', 'hanebi', 'nushi'];
  show(el('div', 'title-screen', [
    el('h1', 'big-title', 'BEAST CRADLE'),
    el('p', 'title-sub', '育ての闘技場'),
    el('div', 'title-row', demo.map((id, i) => {
      const cv = el('canvas', { class: 'portrait', style: { width: '118px', height: '118px' } });
      cv.dataset.sp = id; cv.dataset.tint = String(i * 11 - 22); cv.dataset.ph = String(i * 0.7);
      return cv;
    })),
    el('p', 'title-lead',
      '一匹のけものを引きとって、餌をやり、走らせ、殴らせ、技をみがく。'
      + '一回の稽古で一週が過ぎ、その子は歳をとる。'
      + '育った子を最大5匹つれて闘技場に上がり、E級から王者まで駆けあがる。'),
    el('div', 'title-btns', [
      hasSave() ? btn('つづきから', () => { if (loadGame()) screenHome(); else toast('保存が読めなかった。'); }, 'big primary') : null,
      btn(hasSave() ? 'はじめから' : 'はじめる', () => {
        if (hasSave()) {
          askConfirm('はじめから', '前の牧舎は消えてしまう。よい？', 'はじめから', startNewGame, { danger: true });
        } else startNewGame();
      }, hasSave() ? 'big ghost' : 'big primary'),
      btn('あそびかた', screenHelp, 'big ghost'),
    ]),
    el('p', 'title-foot', '記録はこの端末のブラウザにだけ残る。'),
  ]));
}

function screenHelp() {
  show(panel({
    eyebrow: 'あそびかた',
    title: '育てて、連れていく',
    body: el('div', 'help', [
      el('ol', 'help-steps', [
        el('li', null, '牧舎の4か所で育てる。餌場・走路・打ち場・技場、どれも一週かかる。'),
        el('li', null, '一週たつと牧舎の全員が歳をとる。誰に週をつかうかがこのゲームの悩みどころ。'),
        el('li', null, '闘技場には最大5匹つれていける。すばやさ順に一体ずつ動く。'),
        el('li', null, '気合が100たまると必殺わざが撃てる。ガードで身がまえると気合がよく溜まる。'),
        el('li', null, 'E級の相手2組を倒すと昇格戦（3連戦）に挑める。S級の王者を倒せば頂点。'),
      ]),
      el('div', 'help-grid', [
        helpCard('能力は4つ', STATS.map((s) => s.name + 'は' + s.note).join('。') + '。'),
        helpCard('属性は三すくみ',
          '剛は妙に強く、妙は迅に強く、迅は剛に強い。有利なら 1.45 倍、不利なら 0.74 倍。'),
        helpCard('つかれとごきげん',
          'つかれが 55 を超えると伸びが落ち、82 を超えるとほとんど伸びない。ごきげんが高いほどよく伸びる。餌場で両方戻せる。'),
        helpCard('体重',
          '餌をやると太り、走らせると締まる。太りすぎるとすばやさが落ち、痩せすぎるとたいりょくが落ちる。'),
        helpCard('才能と限界',
          '能力ごとに★1〜5の才能があり、伸ばせる限界値もそれで決まる。限界に近づくほど伸びは鈍る。'),
        helpCard('年齢',
          '24週までが伸び盛り、60週までが全盛。84週を過ぎると老いて足が落ちる。引退させると形見が残り、次の子に才能とわざを継げる。'),
        helpCard('組手と絆',
          '打ち場の組手は二匹同時に伸び、絆が育つ。絆で結んだ仲間が倒れると、残った子が奮い立つ。'),
        helpCard('ひらめき',
          '打ち場で打撃わざ、技場で技わざと必殺をひらめく。能力が足りないと出てこない。技場の「めいそう」が一番ひらめきやすい。'),
        helpCard('状態異常',
          Object.keys(AILMENTS).map((k) => AILMENTS[k].name + 'は' + AILMENTS[k].note).join('。') + '。'),
      ]),
    ]),
    foot: [btn('もどる', () => (G.stable.length ? screenHome() : screenTitle()), 'ghost')],
  }));
}
function helpCard(title, text) {
  return el('div', 'help-card', [el('b', null, title), el('p', null, text)]);
}

/* --------------------------------------------------------------
   最初の一匹
   -------------------------------------------------------------- */
function startNewGame() {
  G.week = 1; G.coins = TUNE.startCoins; G.rank = 0;
  G.stable = []; G.focus = null; G.team = []; G.cleared = {};
  G.keepsakes = []; G.retired = []; G.battles = 0; G.wins = 0;
  G.champion = false; G.market = null;
  screenFirstPick();
}

function screenFirstPick() {
  const cands = SPECIES_LIST.filter((s) => s.unlock === 0).map((s) => makeCreature(s.id, { week: 0 }));
  show(panel({
    eyebrow: 'はじまり',
    title: '引きとる子をえらぶ',
    lead: '育て屋のあなたに、三匹が持ちこまれた。せいかくと才能（★）は一匹ずつちがう。',
    body: el('div', 'pick-grid', cands.map((c) =>
      el('div', 'pick-card', [
        el('div', 'pk-pic', [portraitCanvas(c, 132)]),
        el('div', 'pk-name', [el('b', null, SPECIES[c.sp].name), typeChip(SPECIES[c.sp])]),
        el('p', 'pk-lead', SPECIES[c.sp].lead),
        el('div', 'pk-pers', [el('b', null, persOf(c).name), el('span', null, persOf(c).note)]),
        statBlock(c),
        btn('この子にする', () => nameAndTake(c, () => { G.coins = TUNE.startCoins; screenHome(); }), 'primary'),
      ]))),
  }));
}

/* 名前をつけて牧舎に入れる */
function nameAndTake(c, done) {
  const input = el('input', { class: 'name-input', type: 'text', maxlength: '6', value: c.name });
  const box = el('div', 'ask', [
    el('h3', null, '名前をつける'),
    el('div', 'name-row', [el('div', 'name-pic', [portraitCanvas(c, 96)]), input]),
    el('div', 'ask-btns', [
      btn('おまかせ', () => { input.value = pick(NAME_POOL); }, 'ghost'),
      btn('決める', () => {
        const v = input.value.trim();
        c.name = v ? v.slice(0, 6) : c.name;
        back.remove();
        G.stable.push(c);
        G.focus = c.id;
        saveGame();
        done();
      }, 'primary'),
    ]),
  ]);
  const back = overlay(box, { sticky: true });
  setTimeout(() => input.focus(), 30);
}

/* --------------------------------------------------------------
   牧舎（メニュー画面）
   -------------------------------------------------------------- */
function screenHome() {
  const c = focusCreature();
  if (!c) return screenTitle();
  const rank = RANKS[G.rank];

  const head = el('div', 'home-head', [
    el('div', 'hh-item', [el('span', 'hh-l', '週'), el('b', null, '第 ' + G.week + ' 週')]),
    el('div', 'hh-item', [el('span', 'hh-l', 'コイン'), el('b', null, '🪙 ' + Math.round(G.coins))]),
    el('div', 'hh-item', [el('span', 'hh-l', 'ランク'),
      el('b', { class: 'rank-tag r' + rank.id }, rank.name + '　' + rank.title)]),
    el('div', 'hh-btns', [
      btn('記録', screenRecords, 'ghost small'),
      btn('あそびかた', screenHelp, 'ghost small'),
    ]),
  ]);

  const focusStrip = el('div', 'focus-strip', [
    el('div', 'fs-label', 'いま見ている子'),
    beastCard(c, { size: 92, full: true, extra: conditionBlock(c) }),
    el('div', 'fs-btns', [
      G.stable.length > 1 ? btn('別の子にする', askFocus, 'ghost small') : null,
      btn('くわしく見る', () => screenDetail(c.id), 'ghost small'),
    ]),
  ]);

  const places = el('div', 'places', TRAIN_PLACES.map((p) =>
    el('button', { class: 'place', type: 'button', onClick: () => screenTrain(p.id) }, [
      el('span', 'pl-icon', p.icon),
      el('b', 'pl-name', p.name),
      el('span', 'pl-note', p.lead.split('。')[0] + '。'),
    ])));

  const outs = el('div', 'outs', [
    el('button', { class: 'out big', type: 'button', onClick: screenArena }, [
      el('span', 'pl-icon', '🏟'),
      el('b', null, '闘技場へ'),
      el('span', 'pl-note', rank.name + 'の相手に挑む。最大 ' + TUNE.maxTeam + ' 匹つれていける。'),
    ]),
    el('button', { class: 'out', type: 'button', onClick: screenShop }, [
      el('span', 'pl-icon', '🏪'),
      el('b', null, '市場'),
      el('span', 'pl-note', '新しい子を引きとる。品ぞろえは毎週かわる。'),
    ]),
  ]);

  const stable = el('div', 'stable', [
    el('h3', 'sec-title', '牧舎　' + G.stable.length + ' / ' + TUNE.maxStable),
    el('div', 'stable-list', G.stable.map((x) => beastCard(x, {
      size: 84,
      selected: x.id === G.focus,
      badge: x.injury ? (x.injuryLv >= 2 ? '重傷' : '軽傷') : null,
      onClick: () => { setFocus(x.id); screenHome(); },
      extra: el('div', 'bc-foot', [
        el('span', null, 'つかれ ' + Math.round(x.fatigue)),
        el('span', null, 'ごきげん ' + Math.round(x.mood)),
        el('span', null, x.wins + '勝' + x.losses + '敗'),
      ]),
    }))),
  ]);

  show(el('div', 'home', [head, focusStrip, el('h3', 'sec-title', '育てる'), places, outs, stable]));
}

function askFocus() {
  askPick('どの子を見る？', '育てる場所は、選んだ子に対して開く。', G.stable.map((x) => ({
    value: x.id, label: x.name,
    note: SPECIES[x.sp].name + '　' + x.age + '週　つかれ ' + Math.round(x.fatigue) +
      (x.injury ? '　' + (x.injuryLv >= 2 ? '重傷' : '軽傷') : ''),
    icon: x.id === G.focus ? '👉' : '　',
  })), (id) => { setFocus(id); screenHome(); });
}

/* --------------------------------------------------------------
   けものの詳細
   -------------------------------------------------------------- */
function screenDetail(id) {
  const c = byId(id);
  if (!c) return screenHome();
  const sp = speciesOf(c);
  const hints = nextMoveHints(c);

  const moves = el('div', 'move-list', c.moves.map((m) => {
    const mv = MOVES[m.id];
    return el('div', 'move-row', [
      el('span', { class: 'mv-kind', style: { '--c': mv.type ? TYPES[mv.type].color : '#8d93a6' } },
        mv.kind === 'finish' ? '必殺' : mv.kind === 'tech' ? '技' : '打'),
      el('b', 'mv-name', mv.name),
      el('span', 'mv-pow', mv.power ? '威力 ' + mv.power : '補助'),
      el('span', 'mv-acc', mv.acc >= 100 ? '必中' : '命中 ' + mv.acc),
      el('div', 'mv-mas', [bar(m.mastery / 100, '#f0b23c'), el('span', null, '熟練 ' + Math.round(m.mastery))]),
      el('p', 'mv-text', mv.text),
    ]);
  }));

  const bonds = G.stable.filter((o) => o.id !== c.id && bondLevel(c, o) > 0);

  show(panel({
    eyebrow: sp.name + '　' + TYPES[sp.type].name + '属',
    title: c.name,
    body: el('div', 'detail', [
      el('div', 'dt-top', [
        el('div', 'dt-pic', [portraitCanvas(c, 160)]),
        el('div', 'dt-info', [
          el('p', 'dt-lead', sp.lead),
          el('div', 'dt-facts', [
            fact('せいかく', persOf(c).name + '　' + persOf(c).note),
            fact('闘技場での癖', persOf(c).battle),
            fact('年齢', c.age + ' 週（' + ageStage(c).name + '）'),
            fact('体力（HP）', String(maxHp(c))),
            fact('戦績', c.wins + ' 勝 ' + c.losses + ' 敗'),
            c.fromKeepsake ? fact('継承', c.fromKeepsake + ' の形見を受けている') : null,
          ]),
        ]),
      ]),
      statBlock(c),
      conditionBlock(c),
      el('h4', 'sec-sub', 'おぼえているわざ　' + c.moves.length + ' / ' + TUNE.maxMoves),
      moves,
      hints.length ? el('div', 'hints', [
        el('b', null, 'もう少しでひらめきそうなわざ'),
        el('ul', null, hints.map((h) => el('li', null,
          MOVES[h.id].name + '（' + STAT_BY_ID[h.stat].name + ' ' + h.need + ' 必要、あと ' + Math.ceil(h.left) + '）'))),
      ]) : null,
      bonds.length ? el('div', 'bonds', [
        el('b', null, '絆'),
        el('ul', null, bonds.map((o) => el('li', null, [
          o.name + '　', el('span', 'hearts', '♥'.repeat(bondLevel(c, o))),
        ]))),
      ]) : null,
    ]),
    foot: [
      btn('名前をかえる', () => renameCreature(c), 'ghost'),
      btn('引退させる', () => retireCreature(c), 'ghost danger'),
      btn('もどる', screenHome, 'primary'),
    ],
  }));
}
function fact(k, v) { return el('div', 'fact', [el('span', null, k), el('b', null, v)]); }

function renameCreature(c) {
  const input = el('input', { class: 'name-input', type: 'text', maxlength: '6', value: c.name });
  const box = el('div', 'ask', [
    el('h3', null, '名前をかえる'),
    el('div', 'name-row', [el('div', 'name-pic', [portraitCanvas(c, 88)]), input]),
    el('div', 'ask-btns', [
      btn('やめる', () => back.remove(), 'ghost'),
      btn('決める', () => {
        const v = input.value.trim();
        if (v) c.name = v.slice(0, 6);
        back.remove(); saveGame(); screenDetail(c.id);
      }, 'primary'),
    ]),
  ]);
  const back = overlay(box, { sticky: true });
  setTimeout(() => input.focus(), 30);
}

function retireCreature(c) {
  if (G.stable.length <= 1) { toast('最後の一匹は引退させられない。'); return; }
  const k = makeKeepsake(c);
  const body = el('div', null, [
    el('p', null, c.name + ' を引退させると形見が残る。次に引きとる子へ、'
      + STAT_BY_ID[k.stat].name + ' の才能 +' + k.bonus.toFixed(2)
      + (k.move ? ' と ' + MOVES[k.move].name : '') + ' を継げる。'),
    el('p', 'small', '引退した子は牧舎からいなくなる。'),
  ]);
  askConfirm(c.name + ' を引退させる', body, '引退させる', () => {
    G.keepsakes.push(k);
    G.retired.push({ name: c.name, sp: c.sp, age: c.age, wins: c.wins, losses: c.losses, week: G.week });
    G.stable = G.stable.filter((x) => x.id !== c.id);
    G.team = G.team.filter((x) => x !== c.id);
    if (G.focus === c.id) G.focus = G.stable[0].id;
    saveGame();
    toast(c.name + ' の形見を受けとった。');
    screenHome();
  }, { danger: true });
}

/* --------------------------------------------------------------
   市場
   -------------------------------------------------------------- */
function refreshMarket() {
  /* 同じ種族が並ぶと選ぶ楽しみがないので、3枠は別々の種族にする */
  const pool = SPECIES_LIST.filter((s) => s.unlock <= G.rank && s.price > 0).slice();
  const items = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const sp = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    items.push({ price: Math.round(sp.price * rnd(0.85, 1.2)), c: makeCreature(sp.id, { week: G.week }) });
  }
  G.market = { week: G.week, items: items };
  saveGame();
}

function screenShop() {
  if (!G.market || G.market.week !== G.week) refreshMarket();
  const full = G.stable.length >= TUNE.maxStable;

  show(panel({
    eyebrow: '市場　第 ' + G.week + ' 週　🪙 ' + Math.round(G.coins),
    title: '今週の売り子たち',
    lead: 'その場で見られるのは、せいかくと才能（★）まで。品ぞろえは週がかわると入れかわる。'
      + (G.keepsakes.length ? '　形見が ' + G.keepsakes.length + ' つある。引きとるときに継がせられる。' : ''),
    body: el('div', 'pick-grid', G.market.items.map((it, i) => {
      const c = it.c;
      const poor = it.price > G.coins;
      return el('div', 'pick-card', [
        el('div', 'pk-pic', [portraitCanvas(c, 126)]),
        el('div', 'pk-name', [el('b', null, SPECIES[c.sp].name), typeChip(SPECIES[c.sp])]),
        el('p', 'pk-lead', SPECIES[c.sp].lead),
        el('div', 'pk-pers', [el('b', null, persOf(c).name), el('span', null, persOf(c).note)]),
        statBlock(c),
        el('div', 'pk-price', '🪙 ' + it.price),
        btn(full ? '牧舎がいっぱい' : poor ? 'コインが足りない' : '引きとる',
          () => buyCreature(i), full || poor ? 'off' : 'primary'),
      ]);
    })),
    foot: [
      btn('見なおす（🪙15）', () => {
        if (G.coins < 15) { toast('コインが足りない。'); return; }
        G.coins -= 15; refreshMarket(); screenShop();
      }, 'ghost'),
      btn('牧舎へ', screenHome, 'primary'),
    ],
  }));
}

function buyCreature(i) {
  const it = G.market.items[i];
  if (!it) return;
  if (G.stable.length >= TUNE.maxStable) { toast('牧舎がいっぱい。'); return; }
  if (it.price > G.coins) { toast('コインが足りない。'); return; }

  const take = (keepsake) => {
    G.coins -= it.price;
    const c = it.c;
    if (keepsake) applyKeepsake(c, keepsake);
    G.market.items.splice(i, 1);
    nameAndTake(c, () => { toast(c.name + ' を引きとった。'); screenHome(); });
  };

  if (!G.keepsakes.length) return take(null);
  askPick('形見を継がせる？', '一度つかうと形見はなくなる。', G.keepsakes.map((k, ki) => ({
    value: ki, icon: '🕊', label: k.name + ' の形見',
    note: STAT_BY_ID[k.stat].name + ' の才能 +' + k.bonus.toFixed(2)
      + (k.move ? '　' + MOVES[k.move].name + ' を最初からおぼえる' : ''),
  })).concat([{ value: -1, icon: '　', label: '継がせない', note: 'そのまま引きとる。' }]),
    (ki) => {
      if (ki < 0) return take(null);
      const k = G.keepsakes.splice(ki, 1)[0];
      take(k);
    });
}

function applyKeepsake(c, k) {
  c.talent[k.stat] = clamp(c.talent[k.stat] + k.bonus, 0.7, 1.45);
  c.fromKeepsake = k.name;
  if (k.move && !hasMove(c, k.move) && c.moves.length < TUNE.maxMoves) {
    c.moves.push({ id: k.move, mastery: 20 });
  }
}

/* --------------------------------------------------------------
   闘技場
   -------------------------------------------------------------- */
const clearKey = (rank, i) => 'r' + rank + '-' + i;

function screenArena() {
  const rank = RANKS[G.rank];
  const teams = FOE_TEAMS.filter((t) => t.rank === G.rank);
  const regulars = teams.filter((t) => !t.boss);
  const allCleared = regulars.every((t, i) => G.cleared[clearKey(G.rank, i)]);

  const cards = [];
  cards.push(arenaCard({
    icon: '🌾', title: '練習試合', sub: '近所の子と軽く一戦。負けても失うものはない。',
    right: '🪙 ' + (12 + G.rank * 8), onGo: () => prepareBattle('spar'),
  }));
  regulars.forEach((t, i) => {
    const done = G.cleared[clearKey(G.rank, i)];
    cards.push(arenaCard({
      icon: done ? '✅' : '⚔️',
      title: t.master + '「' + t.team + '」',
      sub: '相手 ' + rank.size + ' 匹　目安レベル ' + rank.lv[0] + '〜' + rank.lv[1]
        + (done ? '　※もう倒した相手' : ''),
      right: '🪙 ' + (done ? Math.round(rank.pay * 0.4) : rank.pay),
      onGo: () => prepareBattle('rank', i),
    }));
  });
  cards.push(arenaCard({
    icon: allCleared ? '👑' : '🔒',
    title: rank.name + ' 昇格戦（3連戦）',
    sub: allCleared
      ? '一回戦・準決勝・決勝を続けて戦う。あいだに少しだけ傷が癒える。勝てば ' + (G.rank < RANKS.length - 1 ? RANKS[G.rank + 1].name : '王者') + ' へ。'
      : 'この級の相手 2 組を倒すと挑める。',
    right: '🪙 ' + rank.pay * 3,
    locked: !allCleared,
    onGo: () => prepareBattle('promo'),
  }));

  show(panel({
    eyebrow: '闘技場　第 ' + G.week + ' 週　🪙 ' + Math.round(G.coins),
    title: rank.name + '　' + rank.title,
    lead: '一戦につき一週。連れていけるのは最大 ' + TUNE.maxTeam + ' 匹。前の 3 匹が前列、残りが後列に立つ。'
      + (G.champion ? '　※王者を倒したあとも、腕試しは続けられる。' : ''),
    body: el('div', 'arena', cards),
    foot: [btn('牧舎へ', screenHome, 'ghost')],
  }));
}

function arenaCard(o) {
  return el('button', {
    class: 'arena-card' + (o.locked ? ' off' : ''), type: 'button',
    disabled: !!o.locked, onClick: o.locked ? null : o.onGo,
  }, [
    el('span', 'ac-icon', o.icon),
    el('span', 'ac-body', [el('b', null, o.title), el('span', 'ac-sub', o.sub)]),
    el('span', 'ac-right', o.right),
  ]);
}

/* 出場メンバーをえらぶ */
function prepareBattle(kind, idx) {
  const able = G.stable.filter((c) => c.injury < 2);
  if (!able.length) { toast('出られる子がいない。けがを治してから。'); return; }
  let sel = G.team.filter((id) => able.some((c) => c.id === id));
  if (!sel.length) sel = able.slice(0, TUNE.maxTeam).map((c) => c.id);

  const render = () => {
    const list = el('div', 'team-list', G.stable.map((c) => {
      const hurt = c.injury >= 2;
      const at = sel.indexOf(c.id);
      return beastCard(c, {
        size: 84,
        selected: at >= 0,
        dim: hurt,
        badge: hurt ? '重傷で出られない' : (at >= 0 ? (at < 3 ? '前列 ' + (at + 1) : '後列 ' + (at - 2)) : null),
        onClick: hurt ? null : () => {
          if (at >= 0) sel.splice(at, 1);
          else if (sel.length >= TUNE.maxTeam) toast('連れていけるのは ' + TUNE.maxTeam + ' 匹まで。');
          else sel.push(c.id);
          render();
        },
        extra: el('div', 'bc-foot', [
          el('span', null, 'HP ' + maxHp(c)),
          el('span', null, 'つかれ ' + Math.round(c.fatigue)),
          el('span', null, TYPES[speciesOf(c).type].name + '属'),
        ]),
      });
    }));
    show(panel({
      eyebrow: '出場メンバー',
      title: 'だれを連れていく？',
      lead: 'えらんだ順に立ち位置が決まる。最大 ' + TUNE.maxTeam + ' 匹。疲れていても出られるが、能力は変わらない（つかれは育成にだけ効く）。',
      body: list,
      foot: [
        btn('もどる', screenArena, 'ghost'),
        btn(sel.length ? '出発する（' + sel.length + '匹）' : '一匹はえらぶ',
          () => { if (!sel.length) return toast('一匹はえらぶ。'); G.team = sel.slice(); saveGame(); launchBattle(kind, idx); },
          sel.length ? 'primary' : 'off'),
      ],
    }));
  };
  render();
}

/* --------------------------------------------------------------
   試合をはじめる
   -------------------------------------------------------------- */
function launchBattle(kind, idx) {
  const rank = RANKS[G.rank];
  const allies = G.team.map(byId).filter(Boolean);
  const teams = FOE_TEAMS.filter((t) => t.rank === G.rank);
  const regulars = teams.filter((t) => !t.boss);
  const boss = teams.find((t) => t.boss);

  if (kind === 'spar') {
    const size = Math.max(1, Math.min(allies.length, rank.size - 1));
    const lv = [Math.max(4, rank.lv[0] - 10), Math.max(6, rank.lv[0] - 4)];
    const def = { master: pick(SPAR_MASTERS), team: 'その辺の子ら', roster: [pick(SPECIES_LIST.filter((s) => s.unlock <= G.rank)).id] };
    const foes = makeFoeTeam(def, size, lv);
    runBattle(allies, foes, { title: '練習試合', master: def.master, team: def.team },
      (r) => finishBattle(r, { coins: r.win ? 12 + G.rank * 8 : 4, kind: 'spar' }));
    return;
  }

  if (kind === 'rank') {
    const def = regulars[idx];
    const foes = makeFoeTeam(def, rank.size, rank.lv);
    runBattle(allies, foes, { title: rank.name + ' 挑戦試合', master: def.master, team: def.team },
      (r) => finishBattle(r, {
        coins: r.win ? (G.cleared[clearKey(G.rank, idx)] ? Math.round(rank.pay * 0.4) : rank.pay) : Math.round(rank.pay * 0.15),
        kind: 'rank', clearIdx: idx,
      }));
    return;
  }

  /* 昇格戦は3連戦。あいだに少しだけ癒える。 */
  const legs = [
    { def: regulars[0], lv: rank.lv, title: rank.name + ' 昇格戦　一回戦' },
    { def: regulars[1], lv: [rank.lv[0] + 4, rank.lv[1] + 5], title: rank.name + ' 昇格戦　準決勝' },
    { def: boss, lv: rank.boss, title: rank.name + ' 昇格戦　決勝' },
  ];
  runGauntlet(legs, 0, null, allies);
}

function runGauntlet(legs, i, carry, allies) {
  const leg = legs[i];
  const foes = makeFoeTeam(leg.def, RANKS[G.rank].size, leg.lv);
  runBattle(allies, foes, {
    title: leg.title, master: leg.def.master, team: leg.def.team, carry: carry,
  }, (r) => {
    if (!r.win) return finishBattle(r, { coins: Math.round(RANKS[G.rank].pay * 0.2), kind: 'promo' });
    if (i === legs.length - 1) return finishBattle(r, { coins: RANKS[G.rank].pay * 3, kind: 'promo', promote: true });
    /* つぎの一戦へ */
    const next = {};
    allies.forEach((c) => {
      const cur = r.carry[c.id] != null ? r.carry[c.id] : 1;
      next[c.id] = cur <= 0 ? 0.25 : Math.min(1, cur + 0.35);
    });
    showInterval(leg, legs[i + 1], () => runGauntlet(legs, i + 1, next, allies));
  });
}

function showInterval(done, next, go) {
  show(panel({
    eyebrow: '小休止',
    title: done.title + ' を勝ちぬいた',
    lead: '手当てのあいだに、次の相手が呼ばれている。倒れた子も立ちあがるが、本調子ではない。',
    body: el('div', 'interval', [
      el('p', null, 'つぎは ' + next.title + '。相手は ' + next.def.master + '「' + next.def.team + '」。'),
      el('p', 'small', '体力は最大値の 35% ぶん戻る。倒れていた子は 25% で復帰する。'),
    ]),
    foot: [btn('つづける', go, 'primary')],
  }));
}

function runBattle(allies, foes, meta, onEnd) {
  document.body.classList.add('in-battle');
  startBattle(allies, foes, meta, (r) => {
    document.body.classList.remove('in-battle');
    onEnd(r);
  });
}

/* --------------------------------------------------------------
   試合のあと
   -------------------------------------------------------------- */
function finishBattle(r, o) {
  const allies = G.team.map(byId).filter(Boolean);
  const notes = [];

  allies.forEach((c) => {
    const down = r.downed.indexOf(c) >= 0;
    c.fatigue = clamp(c.fatigue + 12 + (down ? 14 : 0), 0, 100);
    c.mood = clamp(c.mood + (r.win ? 7 : -7), 0, 100);
    if (r.win) c.wins++; else c.losses++;
    if (down && Math.random() < 0.12) {
      c.injury = Math.max(c.injury, 1); c.injuryLv = Math.max(c.injuryLv, 1);
      notes.push(c.name + ' は試合で軽いけがをした。');
    }
    if (r.win) {
      /* 実戦でも少しは育つ */
      const sp = speciesOf(c);
      const best = STAT_IDS.slice().sort((a, b) => sp.grow[b] - sp.grow[a]).slice(0, 2);
      best.forEach((id) => { c.stats[id] += trainGain(c, id, 1.6); });
      c.moves.forEach((m) => { m.mastery = Math.min(100, m.mastery + 2); });
    }
  });

  G.battles++;
  if (r.win) G.wins++;
  G.coins += o.coins;
  if (r.win && o.kind === 'rank' && o.clearIdx != null) G.cleared[clearKey(G.rank, o.clearIdx)] = true;

  let promoted = false;
  if (r.win && o.promote) {
    if (G.rank < RANKS.length - 1) { G.rank++; promoted = true; }
    else { G.champion = true; }
  }
  advanceWeek();

  show(panel({
    eyebrow: r.win ? '勝った' : '負けた',
    title: r.win ? (promoted ? RANKS[G.rank].name + ' に昇格した' : '勝利') : '敗北',
    lead: r.rounds + ' ラウンドの戦いだった。'
      + (r.win ? '報酬 🪙 ' + o.coins + ' を受けとった。' : '慰労金 🪙 ' + o.coins + ' を受けとった。'),
    body: el('div', 'after', [
      G.champion && o.promote ? el('div', 'champ', [
        el('b', null, '王者を倒した。'),
        el('p', null, 'あなたの牧舎は頂点に立った。腕試しはこのあとも続けられる。'),
      ]) : null,
      el('div', 'after-list', allies.map((c) => el('div', 'after-row', [
        el('div', 'ar-pic', [portraitCanvas(c, 72)]),
        el('div', 'ar-body', [
          el('b', null, c.name),
          el('span', null, (r.downed.indexOf(c) >= 0 ? 'たおれた　' : '立っていた　')
            + 'つかれ ' + Math.round(c.fatigue) + '　' + c.wins + '勝' + c.losses + '敗'),
        ]),
      ]))),
      notes.length ? el('ul', 'res-notes', notes.map((n) => el('li', null, n))) : null,
    ]),
    foot: [
      btn('闘技場へ', screenArena, 'ghost'),
      btn('牧舎へ', screenHome, 'primary'),
    ],
  }));
  saveGame();
}

/* --------------------------------------------------------------
   記録
   -------------------------------------------------------------- */
function screenRecords() {
  show(panel({
    eyebrow: '記録',
    title: '牧舎のあゆみ',
    body: el('div', 'records', [
      el('div', 'rec-grid', [
        recItem('経過', '第 ' + G.week + ' 週'),
        recItem('ランク', RANKS[G.rank].name + '　' + RANKS[G.rank].title),
        recItem('戦績', G.wins + ' 勝 / ' + G.battles + ' 戦'),
        recItem('コイン', '🪙 ' + Math.round(G.coins)),
        recItem('牧舎', G.stable.length + ' / ' + TUNE.maxStable + ' 匹'),
        recItem('形見', G.keepsakes.length + ' つ'),
      ]),
      G.retired.length ? el('div', null, [
        el('h4', 'sec-sub', '引退した子'),
        el('div', 'retired', G.retired.slice().reverse().map((r) => el('div', 'ret-row', [
          el('b', null, r.name),
          el('span', null, SPECIES[r.sp].name + '　' + r.age + '週まで　' + r.wins + '勝' + r.losses + '敗　第' + r.week + '週に引退'),
        ]))),
      ]) : null,
      G.keepsakes.length ? el('div', null, [
        el('h4', 'sec-sub', '手もとの形見'),
        el('ul', 'keepsakes', G.keepsakes.map((k) => el('li', null,
          k.name + ' の形見　' + STAT_BY_ID[k.stat].name + ' +' + k.bonus.toFixed(2)
          + (k.move ? '　' + MOVES[k.move].name : '')))),
      ]) : null,
    ]),
    foot: [btn('もどる', screenHome, 'primary')],
  }));
}
function recItem(k, v) { return el('div', 'rec-item', [el('span', null, k), el('b', null, v)]); }

/* --------------------------------------------------------------
   起動
   -------------------------------------------------------------- */
screenTitle();
