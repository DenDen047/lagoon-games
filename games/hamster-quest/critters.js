/* =========================================================================
   ハムスターの冒険 ― なかまの動物
   魔物ではない生きもの。のれる虫や動物、ついてくる相棒、牧場のアブラムシ。
   攻撃は当たらない (G.mobs とは別の入れもの G.critters に入っている)。
   ========================================================================= */
'use strict';

/* ride: のったときの速さ / pet: 相棒になる / milk: あまつゆをくれる / shy: 近づくとにげる
   gift: のっているあいだや相棒のときに ときどきくれる物 [アイテム, 秒] */
const CRITTERS = {
  rabbit:    { name: 'ウサギ', ride: 1.8, seat: 30, r: 22, spd: 50, gift: ['seed', 50], hint: '大きなウサギ。背中にのせてくれる。' },
  worm:      { name: 'イモムシ', ride: 1.3, seat: 11, r: 10, spd: 22, gift: ['silk', 45] },
  bee:       { name: 'ハチ', ride: 1.6, seat: 26, r: 16, spd: 55, fly: true, gift: ['honey', 40] },
  gecko:     { name: 'ヤモリ', pet: 'tame', r: 10, spd: 95, gift: ['acorn', 55] },
  spider:    { name: 'クモ', pet: 'catch', r: 20, spd: 70, shy: true, gift: ['silk', 50] },
  aphid:     { name: 'アブラムシ', milk: true, r: 7, spd: 10 },
  squirrel:  { name: 'リス', r: 9, spd: 80, shy: true },
  bird:      { name: '小鳥', r: 7, spd: 60, shy: true, bird: true },
  butterfly: { name: 'ちょうちょ', r: 4, spd: 40, fly: true },
  ladybug:   { name: 'テントウムシ', r: 4, spd: 18 },
  frog:      { name: 'カエル', r: 9, spd: 40, shy: true },
};

/* 地方ごとにあらわれる生きもの [種類, 重み] */
const CRITTER_SPAWN = {
  forest:   [['rabbit', 2], ['worm', 3], ['bee', 2], ['squirrel', 3], ['butterfly', 3], ['ladybug', 2], ['gecko', 2], ['bird', 2], ['aphid', 1]],
  deepwood: [['spider', 4], ['worm', 2], ['gecko', 2], ['squirrel', 2], ['bird', 1], ['ladybug', 1]],
  lake:     [['frog', 3], ['bee', 2], ['butterfly', 2], ['bird', 2], ['rabbit', 1]],
  outskirt: [['rabbit', 2], ['bee', 2], ['butterfly', 2], ['aphid', 1], ['bird', 2], ['ladybug', 1]],
  town:     [['bird', 2], ['butterfly', 2]],
  mountain: [['gecko', 3], ['bird', 2], ['squirrel', 1]],
  snow:     [['rabbit', 3], ['bird', 1]],
  valley:   [['frog', 3], ['spider', 2], ['butterfly', 1]],
  moon:     [['butterfly', 3], ['rabbit', 1]],
  kingdom:  [['bird', 3], ['butterfly', 3], ['squirrel', 1], ['ladybug', 1]],
};

const RANCH = { x: 25, y: 104, w: 6, h: 4 };
let CRITTER_ID = 1;

const Critters = {
  spawnT: 0,

  make(type, x, y, extra) {
    return Object.assign({
      id: CRITTER_ID++, type, x, y, vx: 0, vy: 0, face: Math.random() < 0.5 ? -1 : 1, t: rand(0, 5),
      home: { x, y }, wd: Math.random() * TAU, flee: 0, leave: 0, z: 0, milkT: 0,
      snowy: type === 'rabbit' && Game.G.region === 'snow',
    }, extra);
  },

  clear() { const G = Game.G; G.critters = []; if (G.pet) this.placePet(); },

  /* ------------------------------ わく ------------------------------ */
  spawn(dt) {
    const G = Game.G, p = G.p, m = G.map;
    this.spawnT += dt;
    if (this.spawnT < 1.1) return;
    this.spawnT = 0;
    G.critters = G.critters.filter((c) => c.fixed || dist(c.x, c.y, p.x, p.y) < 1000);
    if (m.kind === 'over') this.keepRanch();
    if (m.kind === 'tower') return;
    const near = G.critters.filter((c) => !c.fixed && dist(c.x, c.y, p.x, p.y) < 700).length;
    if (near >= 9) return;
    for (let tries = 0; tries < 5; tries++) {
      const a = Math.random() * TAU, r = rand(Math.max(R.vw, R.vh) * 0.5, Math.max(R.vw, R.vh) * 0.5 + 220);
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      const rg = m.kind === 'over' ? World.regionAt(m, x, y) : m.kind === 'kingdom' ? 'kingdom' : null;
      const tbl = CRITTER_SPAWN[rg];
      if (!tbl) continue;
      if (!World.walkable(m, x, y, 12)) continue;
      let tot = 0; for (const [, w] of tbl) tot += w;
      let k = Math.random() * tot, type = tbl[0][0];
      for (const [tt, w] of tbl) { if (k < w) { type = tt; break; } k -= w; }
      if (G.pet && G.pet.type === type && type === 'gecko' && Math.random() < 0.5) continue;
      G.critters.push(this.make(type, x, y));
      return;
    }
  },
  /* 家のそばの牧場には、いつもアブラムシが 3 びきいる */
  keepRanch() {
    const G = Game.G;
    let n = G.critters.filter((c) => c.fixed).length;
    while (n < 3) {
      const x = (RANCH.x + 1 + n * 2) * TILE, y = (RANCH.y + 1.5 + (n % 2)) * TILE;
      G.critters.push(this.make('aphid', x, y, { fixed: true }));
      n++;
    }
  },

  /* ------------------------------ うごき ------------------------------ */
  update(dt) {
    const G = Game.G;
    if (!G.critters) G.critters = [];
    this.spawn(dt);
    for (let i = G.critters.length - 1; i >= 0; i--) {
      const c = G.critters[i];
      this.think(c, dt);
      if (c.gone) G.critters.splice(i, 1);
    }
    this.updateRide(dt);
    this.updatePet(dt);
  },

  think(c, dt) {
    const G = Game.G, p = G.p, d = CRITTERS[c.type], m = G.map;
    c.t += dt; c.milkT = Math.max(0, c.milkT - dt); c.flee = Math.max(0, c.flee - dt);
    const dx = c.x - p.x, dy = c.y - p.y, dp = Math.hypot(dx, dy) || 1;
    let vx = 0, vy = 0;
    /* 小鳥は近づくと飛んでいく */
    if (d.bird && (c.leave > 0 || (dp < 80 && p.moving))) {
      c.leave += dt; c.z = Math.min(80, c.z + dt * 120);
      c.x += (dx / dp) * 140 * dt; c.y -= 60 * dt;
      if (c.leave > 1.6) c.gone = true;
      c.vx = dx; return;
    }
    if (d.shy && (c.flee > 0 || (dp < 70 && p.moving && !G.ride))) {
      if (c.flee <= 0) c.flee = 0.8;
      vx = (dx / dp) * d.spd * 1.6; vy = (dy / dp) * d.spd * 1.6;
    } else if (d.fly) {
      c.wd += rand(-1, 1) * dt * 3;
      if (dist(c.x, c.y, c.home.x, c.home.y) > 120) c.wd = Math.atan2(c.home.y - c.y, c.home.x - c.x);
      vx = Math.cos(c.wd) * d.spd; vy = Math.sin(c.wd) * d.spd;
    } else if (dp < 56 && (d.ride || d.pet === 'tame' || d.milk)) {
      /* なかよしの動物は、近くに来ると こっちを見る */
      c.face = dx > 0 ? -1 : 1;
    } else {
      c.wd += rand(-1, 1) * dt * 2;
      const leash = c.fixed ? 2.2 * TILE : 130;
      if (dist(c.x, c.y, c.home.x, c.home.y) > leash) c.wd = Math.atan2(c.home.y - c.y, c.home.x - c.x);
      const go = Math.sin(c.t * 0.8 + c.id) > 0 ? 1 : 0;
      vx = Math.cos(c.wd) * d.spd * 0.45 * go; vy = Math.sin(c.wd) * d.spd * 0.45 * go;
    }
    if (c.type === 'frog' && Math.sin(c.t * 3) < 0.4) { vx *= 0.1; vy *= 0.1; }
    const ox = c.x;
    if (d.fly) { c.x += vx * dt; c.y += vy * dt; }
    else World.move(m, c, vx * dt, vy * dt, Math.min(d.r, 10));
    c.vx = (c.x - ox) / Math.max(dt, 0.001);
    if (Math.abs(c.vx) > 3) c.face = c.vx > 0 ? 1 : -1;
  },

  /* ------------------------------ しらべる ------------------------------ */
  /* findNear の consider に、動物ごとの「できること」をわたす */
  actions(consider) {
    const G = Game.G;
    for (const c of G.critters) {
      if (c.leave > 0) continue;
      const d = CRITTERS[c.type];
      let label = 'なでる', fn = () => this.pat(c);
      if (d.ride && !G.ride) { label = 'のる'; fn = () => this.mount(c); }
      else if (d.pet === 'tame') { label = 'なかまにする'; fn = () => this.tame(c); }
      else if (d.pet === 'catch') { label = 'つかまえる'; fn = () => this.catchIt(c); }
      else if (d.milk) { label = 'あまつゆ'; fn = () => this.milk(c); }
      consider(c.x, c.y, label, fn, 20 + d.r * 1.6, 30 + d.r);
    }
  },
  hearts(x, y) { FX.burst(x, y, '#ff8ab0', 6, 40, 0.8, -40); FX.icon(x, y - 10, '💗'); },
  pat(c) { this.hearts(c.x, c.y - 20); Sfx.pickup(); if (CRITTERS[c.type].shy) c.flee = 0; },
  milk(c) {
    if (c.milkT > 0) { toast('まだ あまつゆが たまっていないみたい'); return; }
    c.milkT = 60;
    Game.give('honeydew', 1, c.x, c.y);
    FX.icon(c.x, c.y - 40, ITEMS.honeydew.icon);
    this.hearts(c.x, c.y - 24);
    toast('アブラムシが あまつゆを わけてくれた！', 'good');
  },
  tame(c) {
    const G = Game.G;
    if (G.pet && G.pet.type === c.type) { this.pat(c); return; }
    if (!Game.count('seed')) { toast(`${CRITTERS[c.type].name}は おなかがすいているみたい。ひまわりのタネを あげよう`); this.pat(c); return; }
    Game.remove('seed', 1);
    this.setPet(c);
    toast(`${CRITTERS[c.type].name}が なかまになった！ ついてきて いっしょに戦ってくれる`, 'good');
  },
  catchIt(c) {
    if (Math.random() < 0.55) {
      this.setPet(c);
      Game.give('silk', 2, c.x, c.y);
      toast('クモを つかまえた！ なかまになって 糸をはいて戦ってくれる', 'good');
    } else {
      c.flee = 1.4;
      Sfx.error();
      toast('にげられた！ そっと近づいて もう一度');
    }
  },
  setPet(c) {
    const G = Game.G;
    if (G.pet) toast(`${CRITTERS[G.pet.type].name}は 森へ かえっていった`);
    c.gone = true;
    G.pet = { type: c.type, x: c.x, y: c.y, vx: 0, face: c.face, t: 0, atkT: 0, giftT: 0 };
    G.flags.pet = c.type;
    this.hearts(c.x, c.y - 24);
    Sfx.fanfare();
    Game.save();
  },

  /* ------------------------------ のる ------------------------------ */
  mount(c) {
    const G = Game.G;
    c.gone = true;
    G.ride = { type: c.type, giftT: 0, snowy: c.snowy };
    G.p.x = c.x; G.p.y = c.y;
    Sfx.roll();
    this.hearts(c.x, c.y - 30);
    toast(`${CRITTERS[c.type].name}に のった！ ${Input.isTouch ? '「おりる」' : 'R キー'}で おりる`, 'good');
  },
  dismount(silent) {
    const G = Game.G;
    if (!G.ride) return;
    const r = G.ride;
    G.ride = null;
    if (silent) return;
    if (G.map.kind !== 'tower') G.critters.push(this.make(r.type, G.p.x + 18, G.p.y + 4, { snowy: r.snowy }));
    Sfx.roll();
  },
  speed() { const G = Game.G; return G.ride ? CRITTERS[G.ride.type].ride : 1; },
  updateRide(dt) {
    const G = Game.G;
    if (!G.ride) return;
    const d = CRITTERS[G.ride.type];
    G.ride.giftT += dt;
    if (d.gift && G.ride.giftT > d.gift[1]) {
      G.ride.giftT = 0;
      Game.give(d.gift[0], 1);
      FX.icon(G.p.x, G.p.y - 50, ITEMS[d.gift[0]].icon);
      toast(`${d.name}が ${ITEMS[d.gift[0]].name}を くれた！`, 'good');
    }
  },

  /* ------------------------------ 相棒 ------------------------------ */
  placePet() {
    const G = Game.G;
    G.pet.x = G.p.x - 26; G.pet.y = G.p.y + 6;
  },
  loadPet() {
    const G = Game.G;
    G.pet = G.flags.pet && CRITTERS[G.flags.pet] ? { type: G.flags.pet, x: G.p.x - 26, y: G.p.y + 6, vx: 0, face: 1, t: 0, atkT: 0, giftT: 0 } : null;
  },
  updatePet(dt) {
    const G = Game.G, p = G.p, pet = G.pet;
    if (!pet) return;
    const d = CRITTERS[pet.type];
    pet.t += dt; pet.atkT = Math.max(0, pet.atkT - dt); pet.giftT += dt;
    /* 近くの魔物をさがす */
    let foe = null, fd = 150;
    const list = G.boss && !G.boss.dead ? [...G.mobs, G.boss] : G.mobs;
    for (const e of list) { const dd = dist(e.x, e.y, p.x, p.y); if (dd < fd + 60 && dist(e.x, e.y, pet.x, pet.y) < fd + 40) { foe = e; fd = dd; } }
    let tx, ty, sp = d.spd;
    if (foe && !p.high) {
      const want = pet.type === 'spider' ? 90 : foe.r + 14;
      const a = Math.atan2(pet.y - foe.y, pet.x - foe.x);
      tx = foe.x + Math.cos(a) * want; ty = foe.y + Math.sin(a) * want;
      if (pet.atkT <= 0) {
        const fdist = dist(pet.x, pet.y, foe.x, foe.y);
        const atk = Game.atk();
        if (pet.type === 'spider' && fdist < 170) {
          const aa = Math.atan2(foe.y - 10 - (pet.y - 14), foe.x - pet.x);
          G.shots.push({ x: pet.x, y: pet.y - 14, vx: Math.cos(aa) * 220, vy: Math.sin(aa) * 220, kind: 'web', from: 'p', life: 1, r: 7, dmg: Math.max(3, Math.round(atk * 0.7)), slowMob: 1.6, hit: new Set() });
          pet.atkT = 1.7; Sfx.shoot();
        } else if (fdist < foe.r + 26) {
          Mobs.damage(foe, Math.max(3, Math.round(atk * 0.8)), Math.cos(-a) * 120, Math.sin(-a) * 120);
          pet.atkT = 0.8; pet.bite = 0.2; Sfx.hit();
        }
      }
    } else {
      const side = p.face === 'left' ? 1 : -1;
      tx = p.x + side * 30; ty = p.y + 8;
    }
    pet.bite = Math.max(0, (pet.bite || 0) - dt);
    const dx = tx - pet.x, dy = ty - pet.y, dd = Math.hypot(dx, dy);
    if (dist(pet.x, pet.y, p.x, p.y) > 420) this.placePet();
    else if (dd > 6) {
      const k = Math.min(1, dd / 40);
      const v = Math.min(sp * (dd > 120 ? 2.2 : 1.2), dd / dt) * k;
      const ox = pet.x;
      World.move(G.map, pet, (dx / dd) * v * dt, (dy / dd) * v * dt, 7);
      pet.vx = (pet.x - ox) / Math.max(dt, 0.001);
      if (Math.abs(pet.vx) > 3) pet.face = pet.vx > 0 ? 1 : -1;
      pet.moving = true;
    } else { pet.moving = false; pet.vx = 0; }
    if (d.gift && pet.giftT > d.gift[1]) {
      pet.giftT = 0;
      Game.drop(pet.x, pet.y, d.gift[0], 1);
      toast(`${d.name}が ${ITEMS[d.gift[0]].name}を 見つけてきた！`, 'good');
    }
  },
};

/* ================================ 絵 ================================ */
/* 魔物の絵を大きくして使う */
function drawBigBug(g, type, x, y, s, face, t, id) {
  g.save(); g.translate(x, y); g.scale(s, s);
  drawMob(g, { type, x: 0, y: 0, vx: face, face, id, flash: 0, tele: 0, slow: 0 }, t);
  g.restore();
}

/* ハムスターとくらべた大きさ。アブラムシなど小さい虫はうんと小さく、ヤモリは人にとっての犬くらい */
const CRITTER_SCALE = { aphid: 0.32, ladybug: 0.55, butterfly: 0.6, gecko: 0.62 };

function drawCritter(g, c, t, o = {}) {
  const d = CRITTERS[c.type];
  const sc = CRITTER_SCALE[c.type];
  if (sc) { g.save(); g.translate(c.x, c.y); g.scale(sc, sc); g.translate(-c.x, -c.y); }
  const fx = c.face || 1;
  const moving = o.moving !== undefined ? o.moving : Math.abs(c.vx || 0) > 3;
  const hop = moving ? Math.abs(Math.sin(t * 9 + c.id)) : 0;
  switch (c.type) {
    case 'worm': drawBigBug(g, 'worm', c.x, c.y, 1.25, fx, t, c.id); break;
    case 'bee': drawBigBug(g, 'bee', c.x, c.y - (o.riding ? 0 : 4), 2.3, fx, t, c.id); break;
    case 'spider': {
      drawBigBug(g, 'spider', c.x, c.y, 2.3, fx, t, c.id);
      /* 毛のふさふさ */
      g.strokeStyle = 'rgba(30,10,40,.5)'; g.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) { const a = Math.PI + i * 0.4; const bx = c.x - 14 * fx, by = c.y - 21; g.beginPath(); g.moveTo(bx + Math.cos(a) * 16 * fx, by + Math.sin(a) * 14); g.lineTo(bx + Math.cos(a) * 21 * fx, by + Math.sin(a) * 18); g.stroke(); }
      if (o.pet) collar(g, c.x + 9 * fx, c.y - 14);
      break;
    }
    case 'rabbit': drawRabbit(g, c, t, fx, hop, o); break;
    case 'gecko': drawGecko(g, c, t, fx, moving, o); break;
    case 'aphid': drawAphid(g, c, t, fx, moving); break;
    case 'squirrel': {
      g.save(); g.translate(c.x, c.y - hop * 4); g.scale(fx, 1);
      shadow(g, 0, hop * 4, 8, 3);
      g.beginPath(); g.moveTo(-4, -4); g.quadraticCurveTo(-16, -6, -12, -20); g.quadraticCurveTo(-8, -26, -4, -18);
      g.lineWidth = 7; g.strokeStyle = '#b8743a'; g.lineCap = 'round'; g.stroke();
      ell(g, 1, -6, 6, 5, '#c8844a', INK, 1); circ(g, 6, -11, 4, '#c8844a', INK, 1);
      ell(g, 2, -4.5, 3.5, 2.5, '#f4dcc0'); circ(g, 7.5, -12, 1, '#1a1010'); circ(g, 4, -15, 1.6, '#c8844a', INK, 0.8);
      g.restore(); break;
    }
    case 'bird': {
      const z = c.z || 0, wa = Math.sin(t * (z > 0 ? 30 : 4) + c.id);
      shadow(g, c.x, c.y, 6, 2, 0.18 * (1 - z / 100));
      g.save(); g.translate(c.x, c.y - 4 - z - Math.abs(Math.sin(t * 6 + c.id)) * (z ? 0 : 1.5)); g.scale(fx, 1);
      ell(g, -2, -4 - wa * 3, 5, 2.4, '#7aa8d8', INK, 0.9);
      circ(g, 0, -4, 5, '#8ab8e8', INK, 1); ell(g, 1.5, -2.5, 3, 2.2, '#fff4dc');
      circ(g, 2.5, -6, 1, '#1a1010'); poly(g, [4.5, -5, 8, -4, 4.5, -3], '#f0b03a');
      g.restore(); break;
    }
    case 'butterfly': {
      const wa = Math.abs(Math.sin(t * 14 + c.id));
      const col = Game.G.region === 'moon' ? '#fff3a8' : ['#ff9ac0', '#ffd84a', '#9fd8ff', '#c8a0ff'][c.id % 4];
      g.save(); g.translate(c.x, c.y - 22 - Math.sin(t * 3 + c.id) * 4);
      ell(g, -3 * wa - 1, -2, 4 * wa + 0.5, 4, col, INK, 0.8); ell(g, 3 * wa + 1, -2, 4 * wa + 0.5, 4, col, INK, 0.8);
      ell(g, 0, -1, 1, 3.5, '#3a2a2a');
      g.restore(); break;
    }
    case 'ladybug': {
      g.save(); g.translate(c.x, c.y); g.scale(fx, 1);
      shadow(g, 0, 0, 6, 2);
      circ(g, 5, -4, 2.6, '#2a2020'); ell(g, 0, -4, 6, 4.8, '#e0403a', INK, 1);
      line(g, 0, -8.6, 0, -0.5, '#2a2020', 0.8);
      for (const [x, y] of [[-3, -5], [2, -6], [-1, -2.5], [3, -2.5]]) circ(g, x, y, 1, '#2a2020');
      circ(g, 6, -5, 0.7, '#fff');
      g.restore(); break;
    }
    case 'frog': {
      const j = c.vx && Math.abs(c.vx) > 3 ? Math.abs(Math.sin(t * 8)) * 5 : 0;
      g.save(); g.translate(c.x, c.y); shadow(g, 0, 0, 8, 3); g.translate(0, -j); g.scale(fx, 1);
      ell(g, -4, -2, 4, 2.5, '#5aba4a', INK, 1); ell(g, 4, -2, 4, 2.5, '#5aba4a', INK, 1);
      ell(g, 0, -6, 8, 6, '#6aca5a', INK, 1.1); ell(g, 1, -4, 5, 3, '#e8f4c0');
      circ(g, -3, -11, 2.8, '#6aca5a', INK, 1); circ(g, 4, -11, 2.8, '#6aca5a', INK, 1);
      circ(g, -3, -11.5, 1.3, '#1a1010'); circ(g, 4, -11.5, 1.3, '#1a1010');
      g.restore(); break;
    }
  }
  if (sc) g.restore();
  if (o.heart) {
    const k = Math.sin(t * 5) * 2;
    g.fillStyle = '#ff6a9a'; g.font = '13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('♥', c.x, c.y - d.r * 2.6 - 12 + k);
  }
}

function collar(g, x, y) {
  poly(g, [x - 5, y - 2, x + 5, y - 2, x, y + 6], '#e0405a', INK, 1);
}

/* 大きなウサギ。ハムスターをのせられるくらい */
function drawRabbit(g, c, t, fx, hop, o) {
  const fur = c.snowy ? '#fbfbff' : '#f2ece2', fur2 = c.snowy ? '#e4e8f4' : '#d8c8b4';
  const lift = hop * 7;
  g.save(); g.translate(c.x, c.y);
  shadow(g, 0, 0, 24, 7, 0.24 - hop * 0.08);
  g.translate(0, -lift); g.scale(fx, 1);
  ell(g, -14, -4, 10, 6, fur2, INK, 1.4);                  /* うしろ足 */
  circ(g, -24, -18, 6, '#ffffff', INK, 1.2);               /* しっぽ */
  ell(g, -4, -18, 22, 16, fur, INK, 1.8);                  /* 体 */
  ell(g, 4, -12, 12, 8, '#ffffff');
  ell(g, 12, -3, 5, 4, fur2, INK, 1.2);                    /* 前足 */
  const ear = Math.sin(t * 2 + c.id) * 0.1;
  for (const [ex, a] of [[16, -0.25 + ear], [23, 0.1 - ear]]) {
    g.save(); g.translate(ex, -40); g.rotate(a);
    ell(g, 0, -14, 5, 15, fur, INK, 1.4); ell(g, 0, -13, 2.4, 11, '#ffc0c8');
    g.restore();
  }
  circ(g, 20, -32, 12, fur, INK, 1.6);                     /* 頭 */
  circ(g, 24, -34, 2.6, '#c0303a'); circ(g, 24.6, -34.8, 0.9, '#fff');
  ell(g, 31, -29, 2, 1.5, '#f08a9a');
  line(g, 30, -27, 38, -26, 'rgba(60,40,30,.4)', 0.7); line(g, 30, -28, 38, -30, 'rgba(60,40,30,.4)', 0.7);
  ell(g, 19, -27, 3, 1.8, 'rgba(255,140,150,.5)');
  if (o.riding) { rrect(g, -12, -36, 20, 7, 3, '#c8364a', INK, 1.2); line(g, -2, -29, -2, -10, '#8a5a32', 1.6); }
  g.restore();
}

/* 犬みたいなヤモリ */
function drawGecko(g, c, t, fx, moving, o) {
  const w = moving ? Math.sin(t * 16 + c.id) : 0;
  const tail = Math.sin(t * (o.pet ? 9 : 3) + c.id) * (o.pet ? 6 : 3);
  g.save(); g.translate(c.x, c.y); shadow(g, 0, 0, 16, 4); g.scale(fx, 1);
  const body = '#8ac85a', spot = '#e8a04a';
  g.beginPath(); g.moveTo(-10, -6); g.quadraticCurveTo(-22, -6 + tail * 0.5, -28, -10 + tail);
  g.strokeStyle = INK; g.lineWidth = 6.5; g.lineCap = 'round'; g.stroke(); g.strokeStyle = body; g.lineWidth = 4.5; g.stroke();
  for (const [lx, s] of [[-8, 1], [8, -1]]) {
    line(g, lx, -5, lx - 4, 0 + w * 2 * s, INK, 3.4); line(g, lx, -5, lx - 4, 0 + w * 2 * s, body, 2);
    line(g, lx, -5, lx + 4, 0 - w * 2 * s, INK, 3.4); line(g, lx, -5, lx + 4, 0 - w * 2 * s, body, 2);
  }
  ell(g, 0, -7, 13, 6, body, INK, 1.3);
  for (const x of [-6, 0, 6]) circ(g, x, -9, 1.6, spot);
  ell(g, 15, -10, 7.5, 6, body, INK, 1.3);
  circ(g, 17, -14, 3.4, '#fff8c8', INK, 1); circ(g, 18, -14, 2, '#1a1010'); circ(g, 18.6, -14.8, 0.7, '#fff');
  g.beginPath(); g.arc(19, -9, 3, 0.2, 1.2); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
  if (o.pet && (c.bite || 0) > 0) { ell(g, 22, -8, 2.6, 1.6, '#e05a6a'); }
  if (o.pet) collar(g, 10, -10);
  g.restore();
}

/* 牛のかわりのアブラムシ (40 センチくらい)。白と黒のもようが牛っぽい */
function drawAphid(g, c, t, fx, moving) {
  const w = moving ? Math.sin(t * 10 + c.id) : 0;
  const chew = Math.sin(t * 4 + c.id) * 0.8;
  g.save(); g.translate(c.x, c.y); shadow(g, 0, 0, 24, 6); g.scale(fx, 1);
  for (const lx of [-12, -2, 8]) { line(g, lx, -8, lx - 4, 0 + w * 2, INK, 2.4); line(g, lx, -8, lx + 4, 0 - w * 2, INK, 2.4); }
  line(g, -18, -22, -24, -30, '#5a9a3a', 3); line(g, -12, -26, -16, -34, '#5a9a3a', 3);   /* 角みたいな管 */
  ell(g, -4, -18, 22, 15, '#b8e88a', INK, 1.7);
  ell(g, -8, -26, 10, 5, 'rgba(255,255,255,.35)');
  for (const [x, y, r] of [[-12, -16, 5], [2, -24, 4], [6, -12, 3.5], [-4, -10, 2.5]]) ell(g, x, y, r, r * 0.8, '#f4fbe8');
  circ(g, 17, -16, 8.5, '#a8dc78', INK, 1.5);
  circ(g, 20, -19, 2.2, '#1a1010'); circ(g, 20.6, -19.8, 0.8, '#fff');
  ell(g, 24, -12 + chew, 2.4, 1.6, '#f0a0a8');
  ell(g, 15, -13, 2.6, 1.6, 'rgba(255,140,150,.5)');
  line(g, 20, -24, 26, -34, INK, 1.2); line(g, 22, -24, 31, -30, INK, 1.2);
  circ(g, 26, -34, 1.4, '#5a9a3a'); circ(g, 31, -30, 1.4, '#5a9a3a');
  if (c.milkT <= 0) { g.globalAlpha = 0.6 + Math.sin(t * 4) * 0.3; circ(g, -24, -14, 3, '#fff4b0', '#d8b04a', 1); g.globalAlpha = 1; }
  g.restore();
}
