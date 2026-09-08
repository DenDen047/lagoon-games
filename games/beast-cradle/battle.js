/* =========================================================================
   BEAST CRADLE ― 闘技場
   すばやさ順に一体ずつ動く、最大5対5のターン制。
   気合が100たまると必殺、属性は三すくみ、組手で結んだ絆は弔い合戦になる。
   ========================================================================= */
'use strict';

const FIELD_W = 960, FIELD_H = 540;

const B = {
  on: false, units: [], queue: [], qi: 0, round: 0, active: null,
  events: [], ei: -1, eT: 0, afterEvents: null,
  pops: [], shake: 0, log: [], over: false,
  fast: false, auto: false, phase: 'idle',
  meta: null, onEnd: null, raf: 0, last: 0, clock: 0,
  pendingMove: null,
};

/* --------------------------------------------------------------
   組み立て
   -------------------------------------------------------------- */
function btUnit(c, ally, carry) {
  return {
    c: c, ally: ally,
    maxHp: maxHp(c),
    hp: Math.max(1, Math.round(maxHp(c) * (carry != null ? carry : 1))),
    kiai: 0, down: false, guard: false,
    ail: { doku: 0, shibire: 0, sukumi: 0 },
    buff: { defDown: 0, evade: 0, slow: 0, atkUp: 0 },
    pose: 'idle', flash: 0, dx: 0, dy: 0, phase: Math.random() * 6,
  };
}

/* 立ち位置。手前が味方、奥が相手。前列ほど画面の中央寄りに立つ。 */
function btLayout() {
  const place = (arr, ally) => {
    const n = arr.length;
    const front = Math.min(3, n);
    arr.forEach((u, i) => {
      /* 名札が下の列の頭にかぶらないよう、列の間を広くとってある */
      if (i < front) {
        u.x = ally ? 176 + i * 114 : FIELD_W - 176 - i * 114;
        u.y = ally ? 494 : 300;
        u.h = ally ? 92 : 82;
      } else {
        const j = i - front;
        u.x = ally ? 244 + j * 114 : FIELD_W - 244 - j * 114;
        u.y = ally ? 356 : 176;
        u.h = ally ? 76 : 66;
      }
    });
  };
  place(B.units.filter((u) => u.ally), true);
  place(B.units.filter((u) => !u.ally), false);
}

function startBattle(allies, foes, meta, onEnd) {
  B.units = [];
  allies.forEach((c) => B.units.push(btUnit(c, true, meta.carry ? meta.carry[c.id] : null)));
  foes.forEach((c) => B.units.push(btUnit(c, false, null)));
  btLayout();
  B.on = true; B.over = false; B.round = 0; B.qi = 0; B.queue = [];
  B.events = []; B.ei = -1; B.pops = []; B.log = []; B.shake = 0;
  B.meta = meta; B.onEnd = onEnd; B.active = null; B.pendingMove = null;
  B.phase = 'idle';
  /* 早送りとおまかせは一度入れたら次の試合でもそのまま */
  if (meta.auto != null) B.auto = !!meta.auto;
  btBuildScreen();
  btSay('― ' + meta.title + ' ―');
  btSay(meta.master + 'の「' + meta.team + '」が向かいあった。');
  B.last = performance.now();
  B.raf = requestAnimationFrame(btFrame);
  setTimeout(btStep, 900);
}

const btAllies = () => B.units.filter((u) => u.ally && !u.down);
const btFoes = () => B.units.filter((u) => !u.ally && !u.down);
const btEnemiesOf = (u) => B.units.filter((x) => x.ally !== u.ally && !x.down);
const btFriendsOf = (u) => B.units.filter((x) => x.ally === u.ally && !x.down);

/* --------------------------------------------------------------
   計算
   -------------------------------------------------------------- */
function btSpeed(u) {
  let s = battleStat(u.c, 'speed');
  if (u.ail.shibire) s *= 0.7;
  if (u.buff.slow) s *= 0.75;
  return s;
}
function btMastery(u, mvId) {
  const m = u.c.moves.find((x) => x.id === mvId);
  return m ? m.mastery : 0;
}
function btTypeMul(mv, att, def) {
  const t = mv.type || speciesOf(att.c).type;
  const dt = speciesOf(def.c).type;
  if (TYPES[t].beats === dt) return TYPE_ADV;
  if (TYPES[dt].beats === t) return TYPE_DIS;
  return 1;
}
function btHitChance(att, def, mv) {
  if (mv.acc >= 100) return 1;
  let a = mv.acc + btMastery(att, mv.id) * 0.06;
  a += (btSpeed(att) - btSpeed(def)) * 0.06;
  if (def.buff.evade) a -= 28;
  if (persOf(att.c).id === 'tsuyogari') a += 2;
  return clamp(a, 35, 99) / 100;
}
function btCritChance(att, def, mv) {
  let p = 4 + btSpeed(att) / 14 + (mv.crit || 0) * 0.6;
  if (persOf(att.c).id === 'abare') p += 10;
  if (persOf(att.c).id === 'tsuyogari') p += 3;
  if (persOf(def.c).id === 'sincho') p *= 0.5;
  return clamp(p, 1, 62) / 100;
}
function btDamage(att, def, mv, crit) {
  const statId = mv.kind === 'tech' ? 'tech' : (mv.stat === 'tech' ? 'tech' : 'power');
  let atk = battleStat(att.c, statId);
  const dfn = battleStat(def.c, 'vital');
  let d = mv.power * (atk + 34) / (dfn + 70) * 1.55;
  d *= 1 + btMastery(att, mv.id) / 280;
  d *= btTypeMul(mv, att, def);
  if (crit) d *= 1.65;
  if (att.buff.atkUp) d *= 1.28;
  if (att.ail.sukumi) d *= 0.75;
  if (def.buff.defDown) d *= 1.3;
  if (def.guard) d *= persOf(def.c).id === 'sincho' ? 0.4 : 0.5;
  if (persOf(att.c).id === 'ganbari' && att.hp / att.maxHp <= 0.25) d *= 1.25;
  const spread = persOf(att.c).id === 'kimagure' ? 0.26 : 0.09;
  d *= 1 - spread + Math.random() * spread * 2;
  return Math.max(1, Math.round(d));
}
function btKiaiGain(u, n) {
  const mul = persOf(u.c).id === 'namake' ? 1.6 : 1;
  u.kiai = clamp(u.kiai + n * mul, 0, 100);
}

/* --------------------------------------------------------------
   行動を組み立てる
   -------------------------------------------------------------- */
function btAction(u, mvId, target) {
  const mv = MOVES[mvId];
  const ev = [];
  u.guard = false;

  if (mvId === '__guard') {
    ev.push({ t: 'say', text: u.c.name + ' は身がまえた。' });
    ev.push({ t: 'guard', u: u });
    btActEnd(u, ev);
    return;
  }

  if (mv.kind === 'finish') { u.kiai = 0; ev.push({ t: 'burst', u: u }); }
  btKiaiGain(u, 14);
  ev.push({ t: 'say', text: u.c.name + ' の ' + mv.name + '！' });
  ev.push({ t: 'lunge', u: u });

  /* 回復 */
  if (mv.heal) {
    const amt = Math.round(target.maxHp * mv.heal * (1 + battleStat(u.c, 'tech') / 400));
    ev.push({ t: 'heal', u: target, amt: amt });
    btActEnd(u, ev);
    return;
  }
  /* 自分にかける */
  if (mv.self === 'evade') {
    ev.push({ t: 'buff', u: u, key: 'evade', n: 3, text: u.c.name + ' の姿がぼやけた。' });
    btActEnd(u, ev);
    return;
  }

  const targets = mv.all ? btEnemiesOf(u) : [target];
  targets.forEach((tg, idx) => {
    if (tg.down) return;
    const hits = mv.hits ? rint(mv.hits[0], mv.hits[1]) : 1;
    let landed = 0;
    for (let h = 0; h < hits; h++) {
      if (Math.random() > btHitChance(u, tg, mv)) {
        if (hits === 1) ev.push({ t: 'miss', u: tg });
        continue;
      }
      landed++;
      const crit = Math.random() < btCritChance(u, tg, mv);
      let dmg = btDamage(u, tg, mv, crit);
      if (mv.all) dmg = Math.round(dmg * 0.86);
      ev.push({ t: 'hit', u: tg, from: u, dmg: dmg, crit: crit, mv: mv, part: hits > 1 ? h + 1 : 0 });
    }
    if (landed && hits > 1) ev.push({ t: 'say', text: landed + ' 回あたった。' });
    if (landed) {
      if (mv.status && Math.random() < (mv.power === 0 ? 1 : 0.7)) {
        ev.push({ t: 'ail', u: tg, kind: mv.status, n: 3 });
      }
      if (mv.defDown) ev.push({ t: 'buff', u: tg, key: 'defDown', n: mv.defDown, text: tg.c.name + ' の守りが崩れた。' });
      if (mv.slowAll) ev.push({ t: 'buff', u: tg, key: 'slow', n: 3, text: tg.c.name + ' の動きが鈍った。' });
    }
    if (mv.recoil && landed && idx === 0) {
      ev.push({ t: 'recoil', u: u, dmg: Math.max(1, Math.round(u.maxHp * mv.recoil)) });
    }
  });
  if (mv.selfDefDown) ev.push({ t: 'buff', u: u, key: 'defDown', n: mv.selfDefDown, text: u.c.name + ' も守りを崩した。' });
  btActEnd(u, ev);
}

function btActEnd(u, ev) {
  btPlay(ev, () => btEndTurn(u));
}

/* --------------------------------------------------------------
   ひとつずつ演出しながら効果を出す
   -------------------------------------------------------------- */
const EV_DUR = { say: 640, lunge: 250, hit: 400, miss: 360, heal: 420, ail: 420, buff: 420, guard: 380, recoil: 380, burst: 520, poison: 460 };

function btPlay(list, done) {
  B.events = list.filter(Boolean);
  B.ei = -1; B.eT = 0; B.afterEvents = done || null;
  btAdvanceEvent();
}

function btAdvanceEvent() {
  /* 直前の演出の後始末 */
  const prev = B.events[B.ei];
  if (prev && prev.u) { prev.u.pose = 'idle'; prev.u.flash = 0; prev.u.dx = 0; }
  B.ei++;
  if (B.ei >= B.events.length) {
    B.events = []; B.ei = -1;
    const cb = B.afterEvents; B.afterEvents = null;
    if (cb) cb();
    return;
  }
  B.eT = 0;
  btApplyEvent(B.events[B.ei]);
}

function btApplyEvent(e) {
  switch (e.t) {
    case 'say': btSay(e.text); break;
    case 'lunge': e.u.pose = 'attack'; break;
    case 'burst': btSay(e.u.c.name + ' の気合がはじけた！'); e.u.pose = 'ready'; B.shake = 8; break;
    case 'guard': e.u.guard = true; btKiaiGain(e.u, 22); e.u.pose = 'ready'; break;
    case 'hit': {
      const u = e.u;
      u.hp = Math.max(0, u.hp - e.dmg);
      u.pose = 'hurt'; u.flash = 1;
      btKiaiGain(u, 9);
      const tm = btTypeMul(e.mv, e.from, u);
      btPop(u, '-' + e.dmg, e.crit ? '#ffd75e' : '#ff6b6b', e.crit ? 1.5 : 1);
      B.shake = e.crit ? 10 : 5;
      if (e.crit) btSay('会心の一撃！');
      else if (tm > 1) btSay('よく効いている。');
      else if (tm < 1) btSay('効きがわるい。');
      if (u.guard) u.guard = false;
      if (u.hp <= 0) btFall(u);
      break;
    }
    case 'miss': btSay(e.u.c.name + ' はかわした。'); btPop(e.u, 'かわした', '#c8d4e6', 0.9); break;
    case 'recoil':
      e.u.hp = Math.max(0, e.u.hp - e.dmg);
      btPop(e.u, '-' + e.dmg, '#ff9d6b', 0.9);
      btSay(e.u.c.name + ' も反動を受けた。');
      if (e.u.hp <= 0) btFall(e.u);
      break;
    case 'poison': {
      const d = Math.max(1, Math.round(e.u.maxHp * 0.08));
      e.u.hp = Math.max(0, e.u.hp - d);
      e.u.pose = 'hurt';
      btPop(e.u, '-' + d, '#c78bf0', 0.9);
      btSay(e.u.c.name + ' は毒で苦しんでいる。');
      if (e.u.hp <= 0) btFall(e.u);
      break;
    }
    case 'heal':
      e.u.hp = Math.min(e.u.maxHp, e.u.hp + e.amt);
      btPop(e.u, '+' + e.amt, '#7fe08a', 1.1);
      btSay(e.u.c.name + ' の傷がふさがった。');
      break;
    case 'ail':
      e.u.ail[e.kind] = e.n;
      btSay(e.u.c.name + ' は' + AILMENTS[e.kind].name + 'になった。');
      break;
    case 'buff':
      e.u.buff[e.key] = Math.max(e.u.buff[e.key], e.n);
      if (e.text) btSay(e.text);
      break;
  }
}

function btFall(u) {
  if (u.down) return;
  u.down = true; u.pose = 'down'; u.guard = false;
  btSay(u.c.name + ' はたおれた。');
  /* 組手で結んだ相手が倒れると火がつく */
  btFriendsOf(u).forEach((f) => {
    if (f.c.foe || u.c.foe) return;
    if (bondLevel(f.c, u.c) >= 1) {
      f.buff.atkUp = Math.max(f.buff.atkUp, 3);
      btSay(f.c.name + ' が' + u.c.name + 'のぶんまで、と前に出た。');
    }
  });
  btFriendsOf(u).forEach((f) => {
    if (persOf(f.c).id === 'oyabun') f.buff.atkUp = Math.max(f.buff.atkUp, 2);
  });
}

function btPop(u, text, color, size) {
  B.pops.push({ x: u.x, y: u.y - u.h * 0.7, text: text, color: color, t: 0, size: size || 1 });
}
function btSay(text) {
  B.log.push(text);
  if (B.log.length > 40) B.log.shift();
  btRenderLog();
}

/* --------------------------------------------------------------
   順番まわり
   -------------------------------------------------------------- */
function btNewRound() {
  B.round++;
  B.queue = B.units.filter((u) => !u.down)
    .map((u) => ({ u: u, k: btSpeed(u) * rnd(0.9, 1.12) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.u);
  B.qi = 0;
  btRenderOrder();
}

function btStep() {
  if (B.over || !B.on) return;
  if (btAllies().length === 0 || btFoes().length === 0) return btFinish();
  if (B.qi >= B.queue.length) btNewRound();
  const u = B.queue[B.qi++];
  if (!u || u.down) return btStep();
  B.active = u;
  btRenderOrder();
  btBeginTurn(u);
}

function btBeginTurn(u) {
  u.guard = false;
  const pre = [];
  if (u.ail.doku > 0) pre.push({ t: 'poison', u: u });
  btPlay(pre, () => {
    if (u.down || B.over) return btStep();
    if (u.ail.shibire > 0 && Math.random() < 0.25) {
      btPlay([{ t: 'say', text: u.c.name + ' はしびれて動けない。' }], () => btEndTurn(u));
      return;
    }
    if (u.ally && !B.auto) { B.phase = 'command'; btRenderCommand(u); }
    else { const a = btChooseAI(u); btAction(u, a.move, a.target); }
  });
}

function btEndTurn(u) {
  const quick = persOf(u.c).id === 'sunao' ? 2 : 1;
  for (const k in u.ail) if (u.ail[k] > 0) u.ail[k] = Math.max(0, u.ail[k] - quick);
  for (const k in u.buff) if (u.buff[k] > 0) u.buff[k] -= 1;
  B.phase = 'idle';
  btRenderCommand(null);
  if (btAllies().length === 0 || btFoes().length === 0) return btFinish();
  btStep();
}

function btFinish() {
  if (B.over) return;
  B.over = true; B.phase = 'over';
  const win = btFoes().length === 0 && btAllies().length > 0;
  btSay(win ? 'こちらの勝ちだ！' : '負けてしまった…');
  const carry = {};
  B.units.filter((u) => u.ally).forEach((u) => { carry[u.c.id] = u.hp / u.maxHp; });
  const downed = B.units.filter((u) => u.ally && u.down).map((u) => u.c);
  setTimeout(() => {
    B.on = false;
    cancelAnimationFrame(B.raf);
    if (B.onEnd) B.onEnd({ win: win, carry: carry, downed: downed, rounds: B.round });
  }, 1400);
}

/* --------------------------------------------------------------
   相手の考え
   -------------------------------------------------------------- */
function btChooseAI(u) {
  const foes = btEnemiesOf(u);
  const friends = btFriendsOf(u);
  const moves = u.c.moves.map((m) => MOVES[m.id]).filter(Boolean);

  /* 気合が満ちていれば必殺 */
  const fin = moves.filter((m) => m.kind === 'finish');
  if (u.kiai >= 100 && fin.length) {
    const mv = fin.sort((a, b) => b.power - a.power)[0];
    return { move: mv.id, target: mv.all ? null : btBestTarget(u, mv, foes) };
  }
  /* 手当て */
  const heal = moves.find((m) => m.heal);
  if (heal) {
    const hurt = friends.filter((f) => f.hp / f.maxHp < 0.42).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt && Math.random() < 0.75) return { move: heal.id, target: hurt };
  }
  /* 状態異常はまだかかっていない相手に */
  const ail = moves.filter((m) => m.status);
  if (ail.length && Math.random() < 0.35) {
    const mv = pick(ail);
    const t = foes.filter((f) => !f.ail[mv.status])[0];
    if (t) return { move: mv.id, target: t };
  }
  /* 期待値の高い組み合わせを選ぶ。少しだけ迷う。 */
  let best = null;
  moves.filter((m) => m.kind !== 'finish' && !m.heal && !m.self).forEach((mv) => {
    if (mv.all) {
      const sum = foes.reduce((s, f) => s + btDamage(u, f, mv, false) * btHitChance(u, f, mv) * 0.86, 0);
      if (!best || sum * rnd(0.9, 1.1) > best.score) best = { score: sum, move: mv.id, target: null };
      return;
    }
    foes.forEach((f) => {
      let sc = btDamage(u, f, mv, false) * btHitChance(u, f, mv);
      if (sc >= f.hp) sc *= 1.6;               /* 倒しきれるなら優先 */
      sc *= 1 + (1 - f.hp / f.maxHp) * 0.35;   /* 弱った相手を狙う */
      sc *= rnd(0.88, 1.12);
      if (!best || sc > best.score) best = { score: sc, move: mv.id, target: f };
    });
  });
  if (!best) return { move: '__guard', target: null };
  return best;
}
function btBestTarget(u, mv, foes) {
  let best = foes[0], bs = -1;
  foes.forEach((f) => {
    let s = btDamage(u, f, mv, false);
    if (s >= f.hp) s *= 1.5;
    if (s > bs) { bs = s; best = f; }
  });
  return best;
}

/* --------------------------------------------------------------
   画面（HTML の部分）
   -------------------------------------------------------------- */
function btBuildScreen() {
  const wrap = el('div', 'battle', [
    el('div', 'bt-top', [
      el('div', 'bt-title', [
        el('b', null, B.meta.title),
        el('span', 'bt-vs', 'vs ' + B.meta.master + '「' + B.meta.team + '」'),
      ]),
      el('div', 'bt-toggles', [
        el('button', { class: 'tgl' + (B.fast ? ' on' : ''), id: 'btFast', type: 'button', onClick: btToggleFast }, '早送り'),
        el('button', { class: 'tgl' + (B.auto ? ' on' : ''), id: 'btAuto', type: 'button', onClick: btToggleAuto }, 'おまかせ'),
      ]),
    ]),
    el('div', { class: 'bt-order', id: 'btOrder' }),
    el('div', 'bt-field', [el('canvas', { id: 'btField' })]),
    el('div', { class: 'bt-log', id: 'btLog' }),
    el('div', { class: 'bt-cmd', id: 'btCmd' }),
  ]);
  show(wrap);
  document.getElementById('btField').addEventListener('click', btFieldClick);
}
function btToggleFast() { B.fast = !B.fast; document.getElementById('btFast').classList.toggle('on', B.fast); }
function btToggleAuto() {
  B.auto = !B.auto;
  document.getElementById('btAuto').classList.toggle('on', B.auto);
  if (B.auto && B.phase === 'command' && B.active) {
    B.pendingMove = null;
    const a = btChooseAI(B.active);
    B.phase = 'idle';
    btRenderCommand(null);
    btAction(B.active, a.move, a.target);
  }
}

function btRenderLog() {
  const box = document.getElementById('btLog');
  if (!box) return;
  box.innerHTML = '';
  B.log.slice(-3).forEach((t, i, a) =>
    box.appendChild(el('div', 'lg' + (i === a.length - 1 ? ' now' : ''), t)));
}

function btRenderOrder() {
  const box = document.getElementById('btOrder');
  if (!box) return;
  box.innerHTML = '';
  const rest = B.queue.slice(Math.max(0, B.qi - 1)).filter((u) => !u.down).slice(0, 7);
  box.appendChild(el('span', 'ord-label', '第' + Math.max(1, B.round) + 'ラウンド　行動順'));
  rest.forEach((u, i) => {
    box.appendChild(el('span', {
      class: 'ord' + (u.ally ? ' ally' : ' foe') + (i === 0 ? ' now' : ''),
    }, u.c.name));
  });
}

function btRenderCommand(u) {
  const box = document.getElementById('btCmd');
  if (!box) return;
  box.innerHTML = '';
  if (!u) {
    box.appendChild(el('div', 'cmd-wait', B.over ? '　' : '…'));
    return;
  }
  const head = el('div', 'cmd-head', [
    el('b', null, u.c.name),
    el('span', 'cmd-hp', 'HP ' + u.hp + ' / ' + u.maxHp),
    el('span', { class: 'cmd-kiai' + (u.kiai >= 100 ? ' full' : '') }, '気合 ' + Math.round(u.kiai)),
  ]);
  const list = el('div', 'cmd-moves');
  u.c.moves.forEach((m) => {
    const mv = MOVES[m.id];
    if (!mv) return;
    const locked = mv.kind === 'finish' && u.kiai < 100;
    list.appendChild(el('button', {
      class: 'mv' + (locked ? ' off' : '') + (mv.kind === 'finish' ? ' fin' : ''),
      type: 'button', disabled: locked,
      onClick: () => btPickMove(u, m.id),
    }, [
      el('span', 'mv-name', mv.name),
      el('span', 'mv-meta', [
        el('i', { class: 'mv-kind', style: { '--c': mv.type ? TYPES[mv.type].color : '#8d93a6' } },
          mv.kind === 'finish' ? '必殺' : mv.kind === 'tech' ? '技' : '打'),
        el('i', 'mv-pow', mv.power ? '威' + mv.power : '―'),
        el('i', 'mv-mas', '熟' + Math.round(m.mastery)),
      ]),
    ]));
  });
  list.appendChild(el('button', { class: 'mv guard', type: 'button', onClick: () => btPickMove(u, '__guard') }, [
    el('span', 'mv-name', 'ガード'),
    el('span', 'mv-meta', [el('i', 'mv-kind', '守'), el('i', 'mv-pow', '半減'), el('i', 'mv-mas', '気合+22')]),
  ]));
  box.appendChild(head);
  box.appendChild(list);
}

function btPickMove(u, mvId) {
  if (B.phase !== 'command') return;
  const mv = MOVES[mvId];
  if (!mv || mv.all || mv.self) {
    B.phase = 'idle'; btRenderCommand(null);
    btAction(u, mvId, null);
    return;
  }
  if (mv.heal) { btAskTarget(u, mvId, btFriendsOf(u)); return; }
  btAskTarget(u, mvId, btEnemiesOf(u));
}

function btAskTarget(u, mvId, list) {
  if (list.length === 1) {
    B.phase = 'idle'; btRenderCommand(null);
    btAction(u, mvId, list[0]);
    return;
  }
  B.phase = 'target';
  B.pendingMove = { u: u, mvId: mvId, list: list };
  const box = document.getElementById('btCmd');
  box.innerHTML = '';
  box.appendChild(el('div', 'cmd-head', [
    el('b', null, MOVES[mvId].name),
    el('span', 'cmd-hp', 'だれに？（けものを直接たたいてもよい）'),
  ]));
  const row = el('div', 'cmd-targets');
  list.forEach((t) => {
    row.appendChild(el('button', { class: 'tg' + (t.ally ? ' ally' : ''), type: 'button', onClick: () => btChooseTarget(t) }, [
      el('b', null, t.c.name),
      el('span', null, Math.round((t.hp / t.maxHp) * 100) + '%'),
      el('i', { style: { '--c': TYPES[speciesOf(t.c).type].color } }, TYPES[speciesOf(t.c).type].name),
    ]));
  });
  box.appendChild(row);
  box.appendChild(el('div', 'cmd-back', [btn('わざを選びなおす', () => { B.phase = 'command'; B.pendingMove = null; btRenderCommand(u); }, 'ghost small')]));
}

function btChooseTarget(t) {
  if (B.phase !== 'target' || !B.pendingMove) return;
  const p = B.pendingMove;
  B.pendingMove = null; B.phase = 'idle';
  btRenderCommand(null);
  btAction(p.u, p.mvId, t);
}

function btFieldClick(e) {
  if (B.phase !== 'target' || !B.pendingMove) return;
  const cv = e.currentTarget;
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * FIELD_W;
  const y = (e.clientY - r.top) / r.height * FIELD_H;
  let hit = null;
  B.pendingMove.list.forEach((u) => {
    if (Math.abs(x - u.x) < 52 && y > u.y - u.h - 14 && y < u.y + 30) hit = u;
  });
  if (hit) btChooseTarget(hit);
}

/* --------------------------------------------------------------
   画面（canvas の部分）
   -------------------------------------------------------------- */
function btFrame(now) {
  if (!B.on) return;
  B.raf = requestAnimationFrame(btFrame);
  const dt = Math.min(64, now - B.last);
  B.last = now;
  B.clock = now / 1000;

  /* 演出をすすめる */
  if (B.ei >= 0 && B.ei < B.events.length) {
    const e = B.events[B.ei];
    const dur = (EV_DUR[e.t] || 400) * (B.fast ? 0.42 : 1);
    B.eT += dt;
    const p = Math.min(1, B.eT / dur);
    if (e.t === 'lunge' && e.u) e.u.dx = Math.sin(p * Math.PI) * (e.u.ally ? 46 : -46);
    if (e.t === 'hit' && e.u) { e.u.flash = 1 - p; e.u.dx = (e.u.ally ? -1 : 1) * Math.sin(p * Math.PI) * 16; }
    if (B.eT >= dur) btAdvanceEvent();
  }
  B.shake *= 0.86;
  B.pops.forEach((p) => { p.t += dt; });
  B.pops = B.pops.filter((p) => p.t < 1100);

  btDrawField();
}

function btDrawField() {
  const cv = document.getElementById('btField');
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  const ctx = cv.getContext('2d');
  const k = w / FIELD_W;
  ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  ctx.clearRect(0, 0, FIELD_W, FIELD_H);

  ctx.save();
  const sh = B.shake;
  if (sh > 0.4) ctx.translate(rnd(-sh, sh), rnd(-sh, sh));

  btDrawArena(ctx);

  /* 奥から手前へ。名札はそのあとにまとめて重ねる。 */
  const order = B.units.slice().sort((a, b) => a.y - b.y);
  order.forEach((u) => btDrawUnit(ctx, u));
  order.forEach((u) => btDrawPlate(ctx, u, u.x + u.dx, u.y));

  B.pops.forEach((p) => {
    const t = p.t / 1100;
    ctx.save();
    ctx.globalAlpha = 1 - t * t;
    ctx.font = 'bold ' + Math.round(24 * p.size) + 'px "Hiragino Kaku Gothic ProN", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,14,26,0.85)';
    ctx.strokeText(p.text, p.x, p.y - t * 46);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y - t * 46);
    ctx.restore();
  });
  ctx.restore();
}

function btDrawArena(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  g.addColorStop(0, '#2b2740'); g.addColorStop(0.42, '#3d3552'); g.addColorStop(1, '#241f36');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  /* 観客席 */
  for (let row = 0; row < 4; row++) {
    const y = 20 + row * 20;
    for (let i = 0; i < 34; i++) {
      const x = 12 + i * 28.5 + (row % 2) * 14;
      const b = Math.sin(i * 3.1 + row * 2.3 + B.clock * 1.6) * 2;
      ctx.fillStyle = ['#5a5070', '#6a5c7d', '#4d4462', '#7a6a8c'][(i + row) % 4];
      ctx.beginPath();
      ctx.ellipse(x, y + b, 8, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(20,16,32,0.55)';
  ctx.fillRect(0, 96, FIELD_W, 14);
  /* 垂れ幕 */
  [96, 316, 644, 864].forEach((x, i) => {
    const c = ['#b8524f', '#c09a48', '#4f7fb8', '#7a5aa8'][i];
    ctx.fillStyle = c;
    ctx.fillRect(x - 19, 110, 38, 40);
    ctx.fillStyle = 'rgba(255,246,224,0.82)';
    ctx.fillRect(x - 19, 110, 38, 4);
    ctx.beginPath();
    ctx.moveTo(x - 19, 150); ctx.lineTo(x, 141); ctx.lineTo(x + 19, 150);
    ctx.lineTo(x + 19, 154); ctx.lineTo(x, 145); ctx.lineTo(x - 19, 154);
    ctx.closePath(); ctx.fillStyle = c; ctx.fill();
    ctx.fillStyle = 'rgba(255,246,224,0.5)';
    ctx.beginPath(); ctx.arc(x, 128, 6, 0, Math.PI * 2); ctx.fill();
  });

  /* 土俵 */
  ctx.save();
  ctx.translate(FIELD_W / 2, 366);
  const sand = ctx.createRadialGradient(0, -40, 40, 0, 0, 520);
  sand.addColorStop(0, '#d9c39a'); sand.addColorStop(1, '#a98f68');
  ctx.fillStyle = sand;
  ctx.beginPath(); ctx.ellipse(0, 0, 448, 218, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(120,94,60,0.55)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, 0, 384, 180, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,246,224,0.30)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 312, 144, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function btDrawUnit(ctx, u) {
  const sp = speciesOf(u.c);
  const x = u.x + u.dx;
  const y = u.y;
  /* 手番の子に輪 */
  if (B.active === u && !u.down && !B.over) {
    ctx.save();
    ctx.strokeStyle = u.ally ? 'rgba(120,230,190,0.9)' : 'rgba(240,150,150,0.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 7]);
    ctx.lineDashOffset = -B.clock * 22;
    ctx.beginPath(); ctx.ellipse(x, y + 2, 46, 13, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  /* 狙える相手の印 */
  if (B.phase === 'target' && B.pendingMove && B.pendingMove.list.indexOf(u) >= 0) {
    ctx.save();
    const a = 0.5 + Math.sin(B.clock * 6) * 0.35;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.moveTo(x, y - u.h - 22); ctx.lineTo(x - 11, y - u.h - 40); ctx.lineTo(x + 11, y - u.h - 40);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (u.guard && !u.down) {
    ctx.save();
    ctx.globalAlpha = 0.32 + Math.sin(B.clock * 4) * 0.08;
    ctx.fillStyle = '#8fd4ff';
    ctx.beginPath(); ctx.ellipse(x, y - u.h * 0.5, u.h * 0.52, u.h * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawBeast(ctx, sp, {
    x: x, y: y, h: u.h, face: u.ally ? 1 : -1,
    t: B.clock + u.phase, pose: u.pose, tint: u.tint != null ? u.tint : u.c.tint, flash: u.flash,
  });

}

function btDrawPlate(ctx, u, x, y) {
  const w = 96, py = y + 10;
  ctx.save();
  ctx.globalAlpha = u.down ? 0.4 : 1;
  ctx.fillStyle = 'rgba(20,15,28,0.72)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, py, w, 30, 6);
  ctx.fill();

  ctx.fillStyle = '#f2ecdf';
  ctx.font = 'bold 12px "Hiragino Kaku Gothic ProN", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(u.c.name.slice(0, 6), x - w / 2 + 6, py + 13);

  /* 属性 */
  const t = TYPES[speciesOf(u.c).type];
  ctx.fillStyle = t.color;
  ctx.textAlign = 'right';
  ctx.fillText(t.name, x + w / 2 - 6, py + 13);

  /* HP */
  const hr = u.hp / u.maxHp;
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x - w / 2 + 6, py + 17, w - 12, 6);
  ctx.fillStyle = hr > 0.5 ? '#6fdc7f' : hr > 0.22 ? '#e8c247' : '#e8564a';
  ctx.fillRect(x - w / 2 + 6, py + 17, (w - 12) * Math.max(0, hr), 6);
  /* 気合 */
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x - w / 2 + 6, py + 25, w - 12, 3);
  ctx.fillStyle = u.kiai >= 100 ? '#ffd75e' : '#8fb8ff';
  ctx.fillRect(x - w / 2 + 6, py + 25, (w - 12) * (u.kiai / 100), 3);

  /* 状態異常 */
  let ix = x - w / 2 + 4;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (const k in u.ail) {
    if (u.ail[k] > 0) { ctx.fillStyle = AILMENTS[k].color; ctx.fillText(AILMENTS[k].icon, ix, py - 4); ix += 14; }
  }
  if (u.buff.atkUp) { ctx.fillStyle = '#ff9b5e'; ctx.fillText('↑', ix, py - 4); ix += 12; }
  if (u.buff.evade) { ctx.fillStyle = '#9fe6ff'; ctx.fillText('◌', ix, py - 4); ix += 12; }
  if (u.buff.defDown) { ctx.fillStyle = '#ff7d7d'; ctx.fillText('▼', ix, py - 4); }
  ctx.restore();
}
