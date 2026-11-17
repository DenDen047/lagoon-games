/* =========================================================================
   ネズミの冒険 ― なかまの動物
   魔物ではない生きもの。のれる虫や動物、ついてくる相棒、牧場のアブラムシ。
   攻撃は当たらない (G.mobs とは別の入れもの G.critters に入っている)。
   ========================================================================= */
'use strict';

/* ride: のったときの速さ / milk: あまつゆをくれる / shy: 近づくとにげる
   food: 好物。何回か あげると なかまになる (tame は 1回で なかよくなる確率)
   gift: のっているあいだや なかまのときに ときどきくれる物 [アイテム, 秒] */
const CRITTERS = {
  rabbit:    { name: 'ウサギ', ride: 1.8, seat: 30, r: 22, spd: 50, gift: ['seed', 50], hint: '大きなウサギ。背中にのせてくれる。' },
  worm:      { name: 'イモムシ', ride: 1.3, seat: 11, r: 10, spd: 22, gift: ['silk', 45] },
  bee:       { name: 'ハチ', ride: 1.6, seat: 26, r: 16, spd: 55, fly: true, gift: ['honey', 40] },
  gecko:     { name: 'ヤモリ', food: 'seed', tame: 0.35, r: 10, spd: 95, gift: ['acorn', 55] },
  spider:    { name: 'クモ', food: 'honey', tame: 0.3, r: 20, spd: 70, shy: true, gift: ['silk', 50], shooter: true },
  squirrel:  { name: 'リス', food: 'acorn', tame: 0.35, r: 9, spd: 80, shy: true, gift: ['acorn', 70] },
  frog:      { name: 'カエル', food: 'honeydew', tame: 0.4, r: 9, spd: 60, shy: true },
  bird:      { name: '小鳥', food: 'seed', tame: 0.3, r: 7, spd: 90, shy: true, bird: true, gift: ['feather', 80] },
  aphid:     { name: 'アブラムシ', milk: true, r: 7, spd: 10 },
  butterfly: { name: 'ちょうちょ', r: 4, spd: 40, fly: true },
  ladybug:   { name: 'テントウムシ', r: 4, spd: 18 },
  /* 「つくる」で生まれる 味方。野原には あらわれない */
  golem:     { name: '小石のゴーレム', golem: true, r: 14, spd: 70 },
};

/* なかま: ついてくるのは PET_FOLLOW ひきまで。ほかは 家のそばの牧場で まっている */
const PET_FOLLOW = 4, PET_MAX = 12;

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
  plains:   [['rabbit', 3], ['squirrel', 2], ['bird', 3], ['frog', 2], ['butterfly', 3], ['bee', 1], ['aphid', 1], ['ladybug', 1]],
  quarry:   [['gecko', 3], ['bird', 1], ['spider', 1]],
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

  clear() { const G = Game.G; G.critters = []; this.placePets(); },

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
    this.updatePets(dt);
  },

  think(c, dt) {
    const G = Game.G, p = G.p, d = CRITTERS[c.type], m = G.map;
    c.t += dt; c.milkT = Math.max(0, c.milkT - dt); c.flee = Math.max(0, c.flee - dt);
    const dx = c.x - p.x, dy = c.y - p.y, dp = Math.hypot(dx, dy) || 1;
    let vx = 0, vy = 0;
    /* 好物を もっていると こわがらずに 近よってくる */
    const lured = d.food && !G.ride && Game.count(d.food) > 0;
    /* 小鳥は近づくと飛んでいく */
    if (d.bird && (c.leave > 0 || (dp < 80 && p.moving && !lured))) {
      c.leave += dt; c.z = Math.min(80, c.z + dt * 120);
      c.x += (dx / dp) * 140 * dt; c.y -= 60 * dt;
      if (c.leave > 1.6) c.gone = true;
      c.vx = dx; return;
    }
    if (lured && dp < 170) {
      c.face = dx > 0 ? -1 : 1;
      if (dp > 36) { vx = (-dx / dp) * d.spd * 0.5; vy = (-dy / dp) * d.spd * 0.5; }
    } else if (d.shy && (c.flee > 0 || (dp < 70 && p.moving && !G.ride))) {
      if (c.flee <= 0) c.flee = 0.8;
      vx = (dx / dp) * d.spd * 1.6; vy = (dy / dp) * d.spd * 1.6;
    } else if (d.fly) {
      c.wd += rand(-1, 1) * dt * 3;
      if (dist(c.x, c.y, c.home.x, c.home.y) > 120) c.wd = Math.atan2(c.home.y - c.y, c.home.x - c.x);
      vx = Math.cos(c.wd) * d.spd; vy = Math.sin(c.wd) * d.spd;
    } else if (dp < 56 && (d.ride || d.food || d.milk)) {
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
    const G = Game.G, p = G.p;
    for (const c of G.critters) {
      if (c.leave > 0) continue;
      const d = CRITTERS[c.type];
      let label = 'なでる', fn = () => this.pat(c);
      if (d.ride && !G.ride) { label = 'のる'; fn = () => this.mount(c); }
      else if (d.food) { label = `えさ ${ITEMS[d.food].icon}`; fn = () => this.feed(c); }
      else if (d.milk) { label = 'あまつゆ'; fn = () => this.milk(c); }
      consider(c.x, c.y, label, fn, 20 + d.r * 1.6, 30 + d.r);
    }
    for (const pet of G.pets) {
      const r = 20 + CRITTERS[pet.type].r * 1.6, h = 30 + CRITTERS[pet.type].r * (pet.type === 'golem' ? 3 : 1);
      if (pet.home) { if (G.map.kind === 'over') consider(pet.x, pet.y, 'はなす', () => this.ranchTalk(pet), r, h); }
      else if (this.inRanch(p.x, p.y)) consider(pet.x, pet.y, '牧場で まってて', () => this.leaveHome(pet), r, h);
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
  /* 好物を あげる。あげるたびに なかよくなりやすくなる */
  feed(c) {
    const G = Game.G, d = CRITTERS[c.type], food = ITEMS[d.food];
    if (!Game.count(d.food)) { toast(`${d.name}の 好物は ${food.icon}${food.name}。もっていないみたい`); this.pat(c); return; }
    if (G.pets.length >= PET_MAX) { toast(`なかまが いっぱい（${PET_MAX}ひき）。これ以上は つれていけない`); return; }
    Game.remove(d.food, 1);
    c.fed = (c.fed || 0) + 1; c.flee = 0; c.leave = 0;
    FX.icon(c.x, c.y - d.r * 2 - 14, food.icon);
    Sfx.pickup();
    if (Math.random() < d.tame + 0.2 * (c.fed - 1)) { this.tame(c); return; }
    FX.burst(c.x, c.y - d.r, '#d8d0c0', 5, 30, 0.6, -30);
    toast(`${d.name}は ${food.name}を 食べた。まだ ようすを 見ている……`);
  },
  tame(c) {
    const G = Game.G, d = CRITTERS[c.type];
    c.gone = true;
    const home = this.followers().length >= PET_FOLLOW;
    const pet = this.newPet(c.type, c.x, c.y, home);
    G.pets.push(pet);
    this.hearts(c.x, c.y - 24);
    Sfx.fanfare();
    toast(home ? `${d.name}が なかまになった！ ついてくる なかまが いっぱいなので 牧場で まっている`
      : `${d.name}が なかまになった！ ついてきて いっしょに戦ってくれる`, 'good');
    this.savePets();
  },
  /* 「つくる」で ゴーレムを 目ざめさせる */
  makeAlly(type) {
    const G = Game.G, p = G.p;
    const home = this.followers().length >= PET_FOLLOW;
    const pet = this.newPet(type, p.x + 34, p.y + 6, home);
    G.pets.push(pet);
    FX.ring(pet.x, pet.y - 20, '#9fe8ff', 16, 80);
    FX.rise(pet.x, pet.y - 20, '#b8ff8a', 12);
    Sfx.fanfare(); R.shake = 4;
    toast(home ? `${ALLIES[type].name}が 目をさました！ ついてくる なかまが いっぱいなので 牧場で まっている`
      : `${ALLIES[type].name}が 目をさました！ ついてきて 魔物を なぐってくれる`, 'good');
    this.savePets();
  },
  allyCount(type) { return Game.G.pets.filter((p) => p.type === type).length; },
  takeOut(pet) {
    if (this.followers().length >= PET_FOLLOW) { toast(`ついてこられるのは ${PET_FOLLOW}ひきまで。だれかを 牧場で またせよう`); return; }
    pet.home = false;
    this.hearts(pet.x, pet.y - 24); Sfx.pickup();
    toast(`${CRITTERS[pet.type].name}が ついてくる！`, 'good');
    this.savePets();
  },
  /* 牧場で まっている なかま: つれていくか、野に かえす */
  ranchTalk(pet) {
    const d = CRITTERS[pet.type];
    UI.ask(d.name, `${d.name}は 牧場で まっている。`, [['つれていく', () => this.takeOut(pet)], [pet.type === 'golem' ? '石にもどす' : '野にかえす', () => this.release(pet)], ['やめる', null]]);
  },
  release(pet) {
    const G = Game.G, d = CRITTERS[pet.type];
    G.pets = G.pets.filter((p) => p !== pet);
    if (pet.type === 'golem') { Game.give('stone', 20, pet.x, pet.y); toast(`${d.name}は しずかに ねむり、石にもどった`); }
    else { G.critters.push(this.make(pet.type, pet.x, pet.y, { flee: 1.5 })); toast(`${d.name}は 野に かえっていった。またね！`); }
    this.hearts(pet.x, pet.y - 20);
    this.savePets();
  },
  leaveHome(pet) {
    pet.home = true; this.homeSpot(pet);
    Sfx.pickup();
    toast(`${CRITTERS[pet.type].name}は 牧場で まっている`);
    this.savePets();
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

  /* ------------------------------ なかま ------------------------------ */
  newPet(type, x, y, home) {
    const pet = { id: CRITTER_ID++, type, x, y, vx: 0, face: 1, t: rand(0, 5), atkT: 0, giftT: 0, home: !!home };
    if (home) this.homeSpot(pet);
    return pet;
  },
  followers() { return Game.G.pets.filter((p) => !p.home); },
  inRanch(x, y) { return x > (RANCH.x - 2) * TILE && x < (RANCH.x + RANCH.w + 2) * TILE && y > (RANCH.y - 2) * TILE && y < (RANCH.y + RANCH.h + 2) * TILE; },
  homeSpot(pet) {
    pet.x = (RANCH.x + rand(0.8, RANCH.w - 0.8)) * TILE; pet.y = (RANCH.y + rand(1, RANCH.h - 0.2)) * TILE;
    pet.goal = null;
  },
  savePets() {
    const G = Game.G;
    G.flags.pets = G.pets.map((p) => ({ type: p.type, home: p.home }));
    delete G.flags.pet;
    Game.save();
  },
  loadPets() {
    const G = Game.G;
    let list = G.flags.pets || (G.flags.pet ? [{ type: G.flags.pet, home: false }] : []);
    list = list.filter((p) => CRITTERS[p.type]);
    G.pets = list.map((p) => this.newPet(p.type, G.p.x, G.p.y, p.home));
    this.placePets();
  },
  /* ついてくる なかまの 立ち位置 (ネズミのうしろに ならぶ) */
  slot(i, pet) {
    const p = Game.G.p, side = p.face === 'left' ? 1 : -1, k = pet.type === 'golem' ? 1.35 : 1;
    const S = [[30, 10], [-30, 14], [4, 34], [54, -6]][i % 4];
    return { x: p.x + side * S[0] * k, y: p.y + S[1] * k };
  },
  placePets() {
    const G = Game.G;
    this.followers().forEach((pet, i) => { const s = this.slot(i, pet); pet.x = s.x; pet.y = s.y; });
  },
  updatePets(dt) {
    const G = Game.G, p = G.p;
    let i = 0;
    for (const pet of G.pets) {
      pet.t += dt; pet.atkT = Math.max(0, pet.atkT - dt); pet.bite = Math.max(0, (pet.bite || 0) - dt);
      if (pet.home) { if (G.map.kind === 'over') this.wanderHome(pet, dt); continue; }
      this.updateFollower(pet, i++, dt);
    }
  },
  wanderHome(pet, dt) {
    const d = CRITTERS[pet.type];
    if (!pet.goal || pet.t > pet.goalT) {
      pet.goal = { x: (RANCH.x + rand(0.8, RANCH.w - 0.8)) * TILE, y: (RANCH.y + rand(1, RANCH.h - 0.2)) * TILE };
      pet.goalT = pet.t + rand(3, 7);
    }
    const dx = pet.goal.x - pet.x, dy = pet.goal.y - pet.y, dd = Math.hypot(dx, dy);
    if (dd > 4) {
      const v = d.spd * 0.3, ox = pet.x;
      pet.x += (dx / dd) * v * dt; pet.y += (dy / dd) * v * dt;
      pet.vx = (pet.x - ox) / Math.max(dt, 0.001);
      if (Math.abs(pet.vx) > 3) pet.face = pet.vx > 0 ? 1 : -1;
      pet.moving = true;
    } else { pet.moving = false; pet.vx = 0; }
  },
  updateFollower(pet, idx, dt) {
    const G = Game.G, p = G.p, d = CRITTERS[pet.type];
    pet.giftT += dt;
    /* 近くの魔物をさがす */
    let foe = null, fd = 150;
    const list = G.boss && !G.boss.dead ? [...G.mobs, G.boss] : G.mobs;
    for (const e of list) { const dd = dist(e.x, e.y, p.x, p.y); if (dd < fd + 60 && dist(e.x, e.y, pet.x, pet.y) < fd + 40) { foe = e; fd = dd; } }
    let tx, ty;
    if (foe && !p.high) {
      const want = d.shooter ? 90 : foe.r + (d.golem ? 22 : 14);
      const a = Math.atan2(pet.y - foe.y, pet.x - foe.x) + idx * 0.7;
      tx = foe.x + Math.cos(a) * want; ty = foe.y + Math.sin(a) * want;
      if (pet.atkT <= 0) {
        const fdist = dist(pet.x, pet.y, foe.x, foe.y);
        const atk = Game.atk();
        if (d.shooter && fdist < 170) {
          const aa = Math.atan2(foe.y - 10 - (pet.y - 14), foe.x - pet.x);
          G.shots.push({ x: pet.x, y: pet.y - 14, vx: Math.cos(aa) * 220, vy: Math.sin(aa) * 220, kind: 'web', from: 'p', life: 1, r: 7, dmg: Math.max(3, Math.round(atk * 0.7)), slowMob: 1.6, hit: new Set() });
          pet.atkT = 1.7; Sfx.shoot();
        } else if (d.golem && fdist < foe.r + 40) {
          /* ゴーレムは 両うでで たたきつける。まわりの魔物にも とどく */
          const ga = Math.atan2(foe.y - pet.y, foe.x - pet.x);
          for (const e of list) {
            if (e.dead || dist(e.x, e.y, foe.x, foe.y) > 40 + e.r) continue;
            Mobs.damage(e, Math.max(8, Math.round(atk * 1.5)), Math.cos(ga) * 220, Math.sin(ga) * 220);
          }
          G.zaps.push({ kind: 'ring', x: foe.x, y: foe.y, r: 46, t: 0.35, max: 0.35, col: '#d8d0b8' });
          pet.atkT = 1.4; pet.bite = 0.35; R.shake = Math.max(R.shake || 0, 3); Sfx.boom();
        } else if (!d.golem && fdist < foe.r + 26) {
          Mobs.damage(foe, Math.max(3, Math.round(atk * 0.8)), Math.cos(-a) * 120, Math.sin(-a) * 120);
          pet.atkT = 0.8; pet.bite = 0.2; Sfx.hit();
        }
      }
    } else {
      const s = this.slot(idx, pet); tx = s.x; ty = s.y;
    }
    const dx = tx - pet.x, dy = ty - pet.y, dd = Math.hypot(dx, dy);
    if (dist(pet.x, pet.y, p.x, p.y) > 420) { const s = this.slot(idx, pet); pet.x = s.x; pet.y = s.y; }
    else if (dd > 6) {
      const k = Math.min(1, dd / 40);
      const v = Math.min(d.spd * (dd > 120 ? 2.2 : 1.2), dd / dt) * k;
      const ox = pet.x;
      if (d.bird) { pet.x += (dx / dd) * v * dt; pet.y += (dy / dd) * v * dt; }
      else World.move(G.map, pet, (dx / dd) * v * dt, (dy / dd) * v * dt, 7);
      pet.vx = (pet.x - ox) / Math.max(dt, 0.001);
      if (Math.abs(pet.vx) > 3) pet.face = pet.vx > 0 ? 1 : -1;
      pet.moving = true;
    } else { pet.moving = false; pet.vx = 0; }
    if (d.bird) pet.z = 16 + Math.sin(pet.t * 3) * 3;
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
    case 'golem': drawAllyGolem(g, c, t, fx, moving); break;
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
  /* なかまの しるしに 赤いスカーフ */
  if (o.pet && (c.type === 'squirrel' || c.type === 'frog' || c.type === 'bird')) {
    const sx = c.x + (c.type === 'squirrel' ? 4 : c.type === 'bird' ? 1.5 : 1) * fx, sy = c.y - (c.type === 'bird' ? 5.5 + (c.z || 0) : c.type === 'squirrel' ? 8 : 7.5);
    poly(g, [sx - 1.5 * fx, sy, sx - 4 * fx, sy + 3, sx - 1 * fx, sy + 2.4], '#e0405a', INK, 0.5);
    ell(g, sx, sy, 2.8, 1.1, '#e0405a', INK, 0.5);
  }
  if (o.heart) {
    const k = Math.sin(t * 5) * 2;
    g.fillStyle = '#ff6a9a'; g.font = '13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('♥', c.x, c.y - d.r * 2.6 - 12 + k);
  }
}

/* 小石のゴーレム: ネズミの世界の ゴーレム。小石を 小枝の関節と 草のひもで つないである。
   胸に 大魔法石、頭に 生命の力の 芽。背たけは ネズミの 1.6ばいくらい */
function drawAllyGolem(g, c, t, fx, moving) {
  const w = moving ? Math.sin(t * 9 + c.id) : 0;
  const slam = (c.bite || 0) > 0 ? c.bite / 0.35 : 0;
  const bob = moving ? Math.abs(w) * 1.4 : Math.sin(t * 2 + c.id) * 0.5;
  const ST = '#a39c8f', ST2 = '#878074', ST3 = '#bdb5a5', TW = '#7a5230', TWD = '#5a3a20';
  g.save(); g.translate(c.x, c.y); shadow(g, 0, 0, 15, 4.5); g.scale(fx, 1);
  const twig = (x1, y1, x2, y2) => { line(g, x1, y1, x2, y2, INK, 3.6); line(g, x1, y1, x2, y2, TW, 2.2); };
  const knot = (x, y) => { circ(g, x, y, 1.7, TWD, INK, 0.8); line(g, x, y, x + 2, y - 2.6, '#6aa84a', 1); };
  /* 足: 小枝のすね と 平たい小石の足 */
  for (const s of [1, -1]) {
    const k = w * 4 * s, lx = s * 4.5;
    twig(lx, -15 - bob, lx + k * 0.4, -8);
    knot(lx + k * 0.4, -8);
    twig(lx + k * 0.4, -8, lx + k * 0.7, -3);
    ell(g, lx + k * 0.7 + 1.5, -2.2, 4.6, 2.6, ST2, INK, 1.2);
  }
  g.translate(slam * 2, -bob + slam * 1.5);
  const arm = (sx, sy, a, back) => {
    g.save(); g.translate(sx, sy); g.rotate(-a);
    twig(0, 0, 0, 7); knot(0, 7.5);
    twig(0, 7.5, 0, 11);
    ell(g, 0, 13, 3, 3.8, back ? ST2 : ST, INK, 1.2);
    ell(g, 0, 18, 3.8, 3.4, back ? ST2 : ST3, INK, 1.3);
    g.restore();
  };
  const aim = slam > 0 ? 1.4 - (1 - slam) * 0.8 : null;
  arm(-3, -27, aim ?? (0.2 - w * 0.6), true);
  /* 胴: でこぼこの大きな小石を 草のひもで しばってある */
  g.beginPath();
  g.moveTo(-9, -16); g.bezierCurveTo(-12, -22, -11, -30, -4, -31.5); g.bezierCurveTo(3, -33, 10, -30, 10.5, -23);
  g.bezierCurveTo(11, -17, 7, -14.5, 0, -14.5); g.bezierCurveTo(-4, -14.5, -7, -14.8, -9, -16); g.closePath();
  g.fillStyle = ST; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
  ell(g, -4, -27, 4, 2.2, 'rgba(255,255,255,.22)');
  ell(g, -7, -18.5, 3.2, 2.4, ST3, INK, 1); ell(g, 8, -28, 2.8, 2, ST2, INK, 1);
  line(g, -9, -26, 9, -19, '#c8a060', 1.4); line(g, -8, -18, 8, -28.5, '#c8a060', 1.4);
  /* 大魔法石の心臓 */
  const pulse = 0.5 + Math.sin(t * 3 + c.id) * 0.3;
  g.globalAlpha = pulse * 0.5; circ(g, 2, -23, 6, '#7ac8ff'); g.globalAlpha = 1;
  poly(g, [2, -27.5, 5, -23, 2, -18.5, -1, -23], '#3a8ae8', '#1a3a7a', 1);
  poly(g, [1.5, -26, 2.8, -23.5, 1.5, -21], 'rgba(230,245,255,.8)');
  /* こけ */
  for (const [x, y, r] of [[-6, -30.5, 3], [-2, -32, 2.2], [9, -24, 1.8]]) ell(g, x, y, r, r * 0.55, '#6aa84a');
  /* 首と頭 */
  twig(1, -31, 2, -34.5);
  ell(g, 3, -38.5, 7, 5.4, ST3, INK, 1.4);
  ell(g, 1, -41, 2.6, 1.2, 'rgba(255,255,255,.3)');
  g.globalAlpha = 0.45 + pulse * 0.4; circ(g, 3.2, -38.5, 2.6, '#9fe8ff'); circ(g, 7.4, -38.5, 2.4, '#9fe8ff'); g.globalAlpha = 1;
  ell(g, 3.2, -38.5, 1.1, 1.5, '#e8fbff'); ell(g, 7.4, -38.5, 1, 1.4, '#e8fbff');
  /* 生命の力の 芽 */
  line(g, 2.5, -43.6, 2.8, -48, '#4a8a2e', 1.2);
  g.save(); g.translate(2.8, -48); g.rotate(-0.6 + Math.sin(t * 2.4 + c.id) * 0.15); ell(g, 2.6, 0, 2.8, 1.3, '#7ad04a', '#3e7a2a', 0.7); g.restore();
  g.save(); g.translate(2.8, -48); g.rotate(-2.5 - Math.sin(t * 2.4 + c.id) * 0.15); ell(g, 2.2, 0, 2.3, 1.1, '#8ae05a', '#3e7a2a', 0.7); g.restore();
  arm(4, -27, aim ?? (0.2 + w * 0.6), false);
  g.restore();
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
