/* =========================================================================
   BEAST CRADLE ― けものの中身
   生まれかた、能力の伸びかた、疲れ・ごきげん・体重・けが、わざの習得。
   闘技場の計算は battle.js 側にある。
   ========================================================================= */
'use strict';

const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let uidSeq = 1;
const uid = () => 'c' + (Date.now() % 100000) + '-' + (uidSeq++);

/* --------------------------------------------------------------
   生まれる
   -------------------------------------------------------------- */
function makeCreature(spId, opt) {
  opt = opt || {};
  const sp = SPECIES[spId];
  const c = {
    id: uid(),
    sp: spId,
    name: opt.name || pick(NAME_POOL),
    tint: opt.tint != null ? opt.tint : rint(-26, 26),
    pers: opt.pers || pick(PERSONALITIES).id,
    stats: {},
    talent: {},
    moves: [],
    age: 0,
    fatigue: 0,
    mood: 62,
    weight: TUNE.weightIdeal + rint(-5, 5),
    injury: 0,
    injuryLv: 0,
    bond: {},
    wins: 0,
    losses: 0,
    fromKeepsake: opt.keepsake ? opt.keepsake.name : null,
  };
  STAT_IDS.forEach((id) => {
    c.stats[id] = sp.base[id] + rnd(-2, 2);
    c.talent[id] = clamp(rnd(0.78, 1.22), 0.7, 1.3);
  });
  /* 才能はひとつだけ尖らせる。同じ種族でも個体で役割が変わる。 */
  const spike = pick(STAT_IDS);
  c.talent[spike] = clamp(c.talent[spike] + rnd(0.06, 0.14), 0.7, 1.32);

  sp.start.forEach((m) => c.moves.push({ id: m, mastery: 0 }));

  if (opt.keepsake) {
    const k = opt.keepsake;
    c.talent[k.stat] = clamp(c.talent[k.stat] + k.bonus, 0.7, 1.42);
    if (k.move && !hasMove(c, k.move) && c.moves.length < TUNE.maxMoves) {
      c.moves.push({ id: k.move, mastery: 20 });
    }
  }
  return c;
}

const speciesOf = (c) => SPECIES[c.sp];
const persOf = (c) => PERSONALITY_BY_ID[c.pers];
const hasMove = (c, id) => c.moves.some((m) => m.id === id);

/* 才能で決まる、その子の限界値。 */
function statCap(c, id) {
  return Math.round(speciesOf(c).cap[id] * c.talent[id]);
}
function talentStars(c, id) {
  const t = c.talent[id];
  if (t < 0.86) return 1;
  if (t < 0.96) return 2;
  if (t < 1.06) return 3;
  if (t < 1.17) return 4;
  return 5;
}

/* 闘技場で実際に使う値。体重とけがはここで効く。 */
function battleStat(c, id) {
  let v = c.stats[id];
  const over = c.weight - (TUNE.weightIdeal + TUNE.weightBand);
  const under = (TUNE.weightIdeal - TUNE.weightBand) - c.weight;
  if (over > 0) {
    if (id === 'speed') v *= Math.max(0.68, 1 - over * 0.011);
    if (id === 'vital') v *= 1 + over * 0.007;
  }
  if (under > 0) {
    if (id === 'vital') v *= Math.max(0.72, 1 - under * 0.011);
    if (id === 'speed') v *= 1 + under * 0.005;
  }
  if (c.injury === 1) v *= 0.9;
  if (c.injury >= 2) v *= 0.78;
  return v;
}
const maxHp = (c) => Math.round(52 + battleStat(c, 'vital') * 1.25);

/* --------------------------------------------------------------
   伸びかた
   年齢・疲れ・ごきげん・せいかく・限界までの残りが全部かかる。
   -------------------------------------------------------------- */
function ageFactor(age) {
  if (age <= TUNE.ageYoung) return TUNE.growYoung;
  if (age <= TUNE.agePrime) return TUNE.growPrime;
  if (age <= TUNE.ageMellow) return TUNE.growMellow;
  return TUNE.growOld;
}
function fatigueFactor(f) {
  if (f <= TUNE.fatigueSoft) return 1 - (f / TUNE.fatigueSoft) * 0.15;
  if (f <= TUNE.fatigueHard) return 0.85 - ((f - TUNE.fatigueSoft) / (TUNE.fatigueHard - TUNE.fatigueSoft)) * 0.4;
  return Math.max(0.12, 0.45 - (f - TUNE.fatigueHard) * 0.018);
}
const moodFactor = (m) => 0.80 + (m / 100) * 0.36;

function ageStage(c) {
  if (c.age <= TUNE.ageYoung) return { id: 'young', name: '伸び盛り' };
  if (c.age <= TUNE.agePrime) return { id: 'prime', name: '全盛' };
  if (c.age <= TUNE.ageMellow) return { id: 'mellow', name: '円熟' };
  return { id: 'old', name: '老齢' };
}

function trainGain(c, statId, base, steady) {
  const cap = statCap(c, statId);
  const cur = c.stats[statId];
  if (cur >= cap) return 0;
  const pe = persOf(c);
  let g = base * speciesOf(c).grow[statId];
  g *= ageFactor(c.age) * fatigueFactor(c.fatigue) * moodFactor(c.mood);
  g *= pe.train;
  if (pe.focus === statId) g *= pe.focusMul;
  if (c.injury === 1) g *= 0.55;
  if (c.injury >= 2) g *= 0.3;
  /* 限界が近いほど鈍る */
  g *= 1 - Math.pow(cur / cap, 1.9) * 0.72;
  if (!steady) {
    const varW = 0.18 * (pe.variance || 1);
    g *= 1 - varW + Math.random() * varW * 2;
  }
  return Math.max(0, Math.min(g, cap - cur));
}

/* --------------------------------------------------------------
   一週ぶんの育成をやる。戻り値はそのまま画面に出す報告。
   menu … FOODS / RUN_MENU / HIT_MENU / TECH_MENU のどれか1件
   -------------------------------------------------------------- */
function doTraining(c, menu, opt) {
  opt = opt || {};
  const rep = { name: menu.name, gains: {}, notes: [], learned: null, injured: null };
  const pe = persOf(c);

  for (const id in (menu.gain || {})) {
    const g = trainGain(c, id, menu.gain[id]);
    c.stats[id] += g;
    if (g >= 0.5) rep.gains[id] = Math.round(g);
    else if (g > 0) rep.gains[id] = 0;
    else rep.notes.push(STAT_BY_ID[id].name + 'はもう限界まで来ている。');
  }

  const fat = menu.fatigue >= 0 ? menu.fatigue * pe.fatigue : menu.fatigue;
  c.fatigue = clamp(c.fatigue + fat, 0, 100);
  c.mood = clamp(c.mood + (menu.mood || 0) + (pe.mood || 0) * 0.5, 0, 100);
  c.weight = clamp(c.weight + (menu.weight || 0), 18, 88);
  if (menu.cure && c.injury) { c.injury = 0; c.injuryLv = 0; rep.notes.push('けががすっかり癒えた。'); }

  /* わざの熟練 */
  if (menu.mastery && opt.moveId) {
    const mv = c.moves.find((m) => m.id === opt.moveId);
    if (mv) {
      const before = mv.mastery;
      mv.mastery = Math.min(100, mv.mastery + menu.mastery);
      if (mv.mastery > before) rep.notes.push(MOVES[mv.id].name + ' の熟練 +' + Math.round(mv.mastery - before) + '（' + Math.round(mv.mastery) + '）');
    }
  }

  /* ひらめき。打ち場は打撃わざ、技場は技わざと必殺。 */
  if (menu.spark) {
    const pool = learnableMoves(c, menu.masteryKind === 'strike' ? ['strike'] : ['tech', 'finish']);
    if (pool.length && Math.random() < menu.spark * (0.8 + c.mood / 220)) {
      rep.learned = pick(pool);
    }
  }

  /* けが */
  let risk = (menu.injury || 0) + Math.max(0, c.fatigue - 62) * 0.004;
  if (pe.id === 'sincho') risk *= 0.7;
  if (Math.random() < risk) {
    const heavy = Math.random() < 0.24;
    c.injury = Math.max(c.injury, heavy ? 3 : 1);
    c.injuryLv = heavy ? 2 : 1;
    c.mood = clamp(c.mood - (heavy ? 18 : 8), 0, 100);
    rep.injured = heavy ? '重いけが' : '軽いけが';
  }
  return rep;
}

/* --------------------------------------------------------------
   わざ
   -------------------------------------------------------------- */
function moveReqStat(mv) {
  return mv.stat || (mv.kind === 'strike' ? 'power' : 'tech');
}
function moveReqValue(mv) {
  if (mv.kind === 'finish') return Math.round(88 + mv.power * 0.35);
  return Math.round(12 + mv.power * 1.35);
}
/* いま覚えられるわざ。kinds は ['strike'] か ['tech','finish']。 */
function learnableMoves(c, kinds) {
  return speciesOf(c).learn.filter((id) => {
    const mv = MOVES[id];
    if (!mv || hasMove(c, id)) return false;
    if (kinds.indexOf(mv.kind) < 0) return false;
    if (mv.kind === 'finish' && c.age < 12) return false;
    return c.stats[moveReqStat(mv)] >= moveReqValue(mv);
  });
}
/* まだ届いていない、次に見えているわざ（一覧で「あと少し」を見せる用） */
function nextMoveHints(c) {
  return speciesOf(c).learn
    .filter((id) => !hasMove(c, id))
    .map((id) => ({ id: id, need: moveReqValue(MOVES[id]), stat: moveReqStat(MOVES[id]) }))
    .map((h) => Object.assign(h, { left: h.need - c.stats[h.stat] }))
    .filter((h) => h.left > 0)
    .sort((a, b) => a.left - b.left)
    .slice(0, 3);
}

function addMove(c, id) {
  if (hasMove(c, id)) return false;
  c.moves.push({ id: id, mastery: 0 });
  return true;
}
function dropMove(c, id) {
  c.moves = c.moves.filter((m) => m.id !== id);
}

/* --------------------------------------------------------------
   一週すすむ。全員が歳をとり、少しだけ回復する。
   -------------------------------------------------------------- */
function passWeek(stable) {
  stable.forEach((c) => {
    c.age += 1;
    c.fatigue = clamp(c.fatigue - 5, 0, 100);
    const pe = persOf(c);
    const target = 55 + (pe.mood || 0) * 4;
    c.mood += (target - c.mood) * 0.09;
    c.mood = clamp(c.mood, 0, 100);
    if (c.injury > 0) { c.injury -= 1; if (c.injury === 0) c.injuryLv = 0; }
    /* 老いると足が落ちる */
    if (c.age > TUNE.ageMellow) c.stats.speed = Math.max(speciesOf(c).base.speed, c.stats.speed - 0.7);
  });
}

/* 絆。組手を重ねた組は闘技場で仲間の弔い合戦をする。 */
function addBond(a, b, n) {
  a.bond[b.id] = (a.bond[b.id] || 0) + n;
  b.bond[a.id] = (b.bond[a.id] || 0) + n;
}
const bondLevel = (a, b) => Math.min(5, Math.floor((a.bond[b.id] || 0) / 2));

/* --------------------------------------------------------------
   引退と形見
   一番よく伸びた能力を、次の子に少しだけ引き継げる。
   -------------------------------------------------------------- */
function makeKeepsake(c) {
  let best = STAT_IDS[0];
  STAT_IDS.forEach((id) => {
    if (c.stats[id] / speciesOf(c).cap[id] > c.stats[best] / speciesOf(c).cap[best]) best = id;
  });
  const total = STAT_IDS.reduce((s, id) => s + c.stats[id], 0);
  const bonus = clamp(0.03 + total / 3600, 0.03, 0.20);
  const learned = c.moves.filter((m) => m.mastery >= 25).sort((a, b) => b.mastery - a.mastery)[0];
  return {
    name: c.name,
    sp: c.sp,
    stat: best,
    bonus: Math.round(bonus * 100) / 100,
    move: learned ? learned.id : null,
    wins: c.wins,
  };
}

/* --------------------------------------------------------------
   対戦相手をこしらえる
   level は 0〜145 くらい。基礎値から限界値へ向けて伸ばす。
   -------------------------------------------------------------- */
function makeFoe(spId, level, nameSeed) {
  const sp = SPECIES[spId];
  const c = {
    id: 'f' + (uidSeq++),
    sp: spId,
    name: nameSeed || sp.name,
    tint: rint(-22, 22),
    pers: pick(PERSONALITIES).id,
    stats: {}, talent: {}, moves: [],
    age: 30, fatigue: 0, mood: 70, weight: TUNE.weightIdeal,
    injury: 0, injuryLv: 0, bond: {}, wins: 0, losses: 0, foe: true,
  };
  /* 相手も一点集中で育てられている。全能力を均等に上げると、
     ひとつを伸ばすしかないこちらに対して強すぎる。 */
  const prog = Math.pow(clamp(level / 138, 0, 1.06), 0.95);
  const order = STAT_IDS.slice().sort((a, b) => sp.grow[b] - sp.grow[a]);
  STAT_IDS.forEach((id) => {
    c.talent[id] = 1;
    const focus = [1, 0.68, 0.42, 0.38][order.indexOf(id)];
    c.stats[id] = sp.base[id] + (sp.cap[id] - sp.base[id]) * prog * focus * rnd(0.92, 1.06);
  });
  sp.start.forEach((m) => c.moves.push({ id: m, mastery: Math.min(45, level * 0.35) }));
  const pool = sp.learn.filter((id) => {
    const mv = MOVES[id];
    return c.stats[moveReqStat(mv)] >= moveReqValue(mv) * 0.92;
  });
  while (c.moves.length < 5 && pool.length) {
    const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    c.moves.push({ id: id, mastery: Math.min(40, level * 0.3) });
  }
  return c;
}

/* 一座をまるごと作る。size に足りない分は roster の頭から埋める。 */
function makeFoeTeam(def, size, lvRange) {
  const roster = def.roster.slice();
  while (roster.length < size) roster.push(roster[roster.length % def.roster.length]);
  return roster.slice(0, size).map((spId, i) =>
    makeFoe(spId, rint(lvRange[0], lvRange[1]), SPECIES[spId].name + '・' + '甲乙丙丁戊'[i]));
}
