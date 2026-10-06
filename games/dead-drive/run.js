/* =========================================================================
   DEAD DRIVE ― ラン（1回の挑戦）の進行
   日付・資源・仲間・設計図・基地・経験値・遺産。画面には触らない。
   ========================================================================= */
'use strict';

const Run = {
  state: null,
  meta: null,
  /* まだ選んでいない強化の数。出撃中にしか選べないので、次の出撃まで持ち越す */
  get pendingLevels() { return this.state ? this.state.pendLv || 0 : 0; },
  set pendingLevels(v) { if (this.state) this.state.pendLv = v; },

  loadMeta() {
    this.meta = Object.assign({ medals: 0, up: {}, best: 0, runs: 0, wins: 0, kills: 0 }, Save.read(Save.META) || {});
    return this.meta;
  },
  saveMeta() { Save.write(Save.META, this.meta); },
  metaLv(id) { return this.meta.up[id] || 0; },

  newRun(easy) {
    const m = (id) => this.metaLv(id);
    const seed = (Math.random() * 1e9) | 0;
    this.state = {
      day: 1, phase: 'morning', easy, seed, ver: 2,
      scrap: 70 + m('scrap') * 40 + (easy ? 30 : 0),
      food: 12 + m('food') * 8,
      fuel: 5 + m('fuel') * 2,
      survivors: [], bps: [],
      design: START_DESIGN.map((c) => ({ c: c.c, r: c.r, t: c.t, rot: c.rot || 0 })),
      base: { wall: 1, garage: 1, farm: 0, workshop: 0, radio: 0, towers: m('tower') ? [{ slot: 0, type: 'mg', lv: 1 }] : [] },
      perks: {}, level: 1, xp: 0,
      meta: { plate: m('plate') },
      stats: { kills: 0, rescued: 0, food: 0, scrap: 0 },
      dests: [], flags: {}, rerolls: m('reroll'), log: [],
    };
    const nCrew = 2 + m('crew');
    for (let i = 0; i < nCrew; i++) this.addSurvivor(null);
    for (let i = 0; i < m('bp'); i++) this.giveBlueprint();
    this.genDestinations();
    this.save();
  },

  save() {
    if (!this.state) return;
    /* ひみつのコードを使ったランは、使ったぶんのスクラップをここで満たし直す */
    if (this.state.cheat) this.state.scrap = CHEAT_SCRAP;
    Save.write(Save.RUN, this.state);
  },
  load() {
    const s = Save.read(Save.RUN);
    if (!s || !s.design) return false;
    if (!s.ver) { this.addMissingWheels(s); s.ver = 2; }
    this.state = s;
    return true;
  },

  /* タイヤが部品になる前（ver なし）のセーブには、車のいちばん外の列の前と後ろにふつうのタイヤを足す。
     車がマス目の端まで広がっていて外に付けられなければ、となりの空いたマスに4つまで付ける */
  addMissingWheels(s) {
    const d = s.design;
    const [cols, rows] = GARAGE_GRID[s.base.garage];
    const cs = d.map((x) => x.c), minC = Math.min(...cs), maxC = Math.max(...cs);
    for (const [edge, wc] of [[minC, minC - 1], [maxC, maxC + 1]]) {
      if (wc < 0 || wc >= cols) continue;
      const rs = d.filter((x) => x.c === edge).map((x) => x.r);
      for (const r of new Set([Math.min(...rs), Math.max(...rs)])) d.push({ c: wc, r, t: 'wheel', rot: 0 });
    }
    const free = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && !d.some((x) => x.c === c && x.r === r);
    for (const x of d.slice()) {
      for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (d.filter((y) => y.t === 'wheel').length >= 4) return;
        if (free(x.c + dc, x.r + dr)) d.push({ c: x.c + dc, r: x.r + dr, t: 'wheel', rot: 0 });
      }
    }
  },

  /* ひみつのコード。このランの設計図をすべてそろえ、スクラップを減らなくする */
  cheat() {
    const s = this.state;
    s.cheat = true;
    s.scrap = CHEAT_SCRAP;
    for (const id of BP_POOL) if (!s.bps.includes(id)) s.bps.push(id);
  },
  clear() { this.state = null; Save.clear(Save.RUN); },

  gridSize() { return GARAGE_GRID[this.state.base.garage]; },
  lockedParts() { return BP_POOL.filter((id) => !this.state.bps.includes(id)); },
  unlocked(id) { return !PARTS[id].bp || this.state.bps.includes(id); },

  giveBlueprint(id) {
    const pool = this.lockedParts();
    if (!pool.length) { this.state.scrap += 40; return '設計図はそろっている。代わりにスクラップ +40'; }
    const p = id && pool.includes(id) ? id : pick(pool);
    this.state.bps.push(p);
    return `設計図「${PARTS[p].name}」を手に入れた。ガレージで組みこめる`;
  },

  addSurvivor(trait, name) {
    const s = this.state;
    const used = new Set(s.survivors.map((x) => x.name));
    const free = NAMES.filter((n) => !used.has(n));
    const who = {
      id: (Math.random() * 1e9) | 0,
      name: name || (free.length ? pick(free) : pick(NAMES) + (s.survivors.length + 1)),
      trait: trait || pick(TRAIT_POOL),
      since: s.day,
    };
    s.survivors.push(who);
    return who;
  },

  addXp(n) {
    const s = this.state;
    s.xp += n;
    while (s.xp >= xpNeed(s.level)) { s.xp -= xpNeed(s.level); s.level++; this.pendingLevels++; }
  },

  /* 強化の候補を3つ。上限に達したもの、車に合わないものは出さない */
  perkChoices() {
    const s = this.state;
    const hasWeapon = s.design.some((c) => PARTS[c.t].weapon && (c.hp === undefined || c.hp > 0));
    const hasChain = s.design.some((c) => ['tesla', 'rocket', 'mines'].includes(c.t)) || s.base.towers.some((t) => t.type === 'tesla' || t.type === 'mortar');
    const hasContact = s.design.some((c) => PARTS[c.t].contact);
    const pool = PERKS.filter((p) => {
      if ((s.perks[p.id] || 0) >= p.max) return false;
      if (p.needWeapon && !hasWeapon) return false;
      if (p.id === 'chain' && !hasChain) return false;
      if (p.id === 'nitro' && !s.design.some((c) => c.t === 'nitro')) return false;
      if (p.id === 'shock' && !s.design.some((c) => c.t === 'nitro')) return false;
      if (p.id === 'turret' && !s.base.towers.length) return false;
      return true;
    });
    const weighted = pool.map((p) => ({ p, w: p.once ? 0.4 : p.id === 'spikes' && hasContact ? 1.6 : 1 }));
    const out = [];
    const rng = new RNG((Math.random() * 1e9) | 0);
    while (out.length < 3 && weighted.length) {
      const o = rng.weighted(weighted);
      out.push(o.p);
      weighted.splice(weighted.indexOf(o), 1);
    }
    return out;
  },
  takePerk(id) {
    const s = this.state;
    s.perks[id] = (s.perks[id] || 0) + 1;
    if (id === 'heal') { s.perks.heal = 0; if (S && S.car) { S.car.healAll(0.4); S.car.derive(); } }
    if (S && S.car) { S.car.perks = s.perks; S.car.dmgTaken = (1 - 0.1 * (s.perks.armor || 0)) * (s.easy ? 0.6 : 1); S.car.derive(); }
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
  },

  /* ------------------------------ 車の修理 ------------------------------ */
  cellMax(c) { return partMaxHp(c.t, c.lv, this.state.meta.plate); },
  cellHp(c) { return c.hp === undefined ? this.cellMax(c) : c.hp; },
  /* その部品に使ったスクラップ（置いた値段と強化の値段） */
  cellInvest(c) {
    let v = PARTS[c.t].cost;
    for (let l = 1; l < (c.lv || 1); l++) v += partUpCost(c.t, l);
    return v;
  },
  mechanics() { return this.state.survivors.filter((x) => x.trait === 'mechanic').length; },
  repairCost() {
    let cost = 0;
    for (const c of this.state.design) {
      const max = this.cellMax(c), hp = this.cellHp(c);
      if (hp >= max) continue;
      const base = (c.t === 'cabin' ? 30 : PARTS[c.t].cost) * partHpMul(c.lv);
      cost += base * 0.5 * (1 - hp / max) + (hp <= 0 ? 1 : 0);
    }
    return Math.ceil(cost * Math.max(0.4, 1 - 0.25 * this.mechanics()));
  },
  repairAll() {
    const cost = this.repairCost();
    if (cost <= 0 || this.state.scrap < cost) return false;
    this.state.scrap -= cost;
    for (const c of this.state.design) c.hp = this.cellMax(c);
    return true;
  },
  repairCarFree(frac) {
    for (const c of this.state.design) { const max = this.cellMax(c); c.hp = Math.min(max, this.cellHp(c) + max * frac); }
  },
  damageCar(frac) {
    for (const c of this.state.design) { const max = this.cellMax(c); c.hp = Math.max(c.t === 'cabin' ? 1 : 0, this.cellHp(c) - max * frac); }
  },

  /* ------------------------------ 行き先 ------------------------------ */
  genDestinations() {
    const s = this.state;
    const rng = new RNG(s.seed + s.day * 977);
    const n = 3 + s.base.radio;
    const list = [];
    const need = this.foodNeed();
    const types = [];
    if (s.food < need * 2) types.push('market');
    if (s.fuel <= 2) types.push('gas');
    while (types.length < n) {
      const t = rng.pick(DEST_POOL);
      if (types.filter((x) => x === t).length >= (t === 'market' || t === 'rescue' ? 2 : 1)) continue;
      types.push(t);
    }
    if (s.flags.sos) { types[0] = 'rescue'; }
    types.forEach((type, i) => list.push(this.makeDest(rng, type, i === 0 && s.flags.sos)));
    s.flags.sos = false;
    list.push(this.makeDest(rng, 'patrol', false));
    s.dests = list;
  },

  makeDest(rng, type, sos) {
    const s = this.state, day = s.day;
    const fuel = type === 'patrol' ? 0 : rng.i(1, 3);
    const mods = [];
    if (type !== 'patrol' && rng.chance(0.35 + day * 0.03)) {
      const pool = MODS.filter((m) => !m.minDay || day >= m.minDay);
      mods.push(rng.pick(pool).id);
    }
    let reward = 1 + (fuel - 1) * 0.35;
    let danger = day * 0.35 + fuel * 0.6 + rng.f(-0.3, 0.7);
    for (const id of mods) { const m = MODS.find((x) => x.id === id); reward *= m.reward; danger += m.danger; }
    if (type === 'patrol') { reward = 0.6; danger = day * 0.3; }
    let stock = 0;
    switch (type) {
      case 'market': stock = Math.round((14 + day * 2) * reward); break;
      case 'gas': stock = Math.round((3 + fuel) * reward); break;
      case 'hardware': stock = Math.round((9 + day * 1.2) * reward); break;
      case 'rescue': stock = sos ? 5 : 2 + (fuel >= 2 ? 1 : 0) + (fuel >= 3 ? 1 : 0) + (s.base.radio >= 2 ? 1 : 0); break;
      case 'hospital': stock = 2 + (fuel >= 3 ? 1 : 0) + (s.base.radio >= 2 ? 1 : 0); break;
      case 'junk': stock = Math.round((55 + day * 8) * reward); break;
      case 'police': stock = 5; break;
    }
    return {
      type, fuel, mods, stock, sos,
      danger: clamp(Math.round(danger), 1, 5),
      area: rng.i(0, AREAS.length - 1),
      seed: rng.i(1, 1e9),
    };
  },

  destReward(d) {
    switch (d.type) {
      case 'market': return `食料 最大 ${d.stock}`;
      case 'gas': return `燃料 最大 ${d.stock}`;
      case 'hardware': return `スクラップ 最大 ${d.stock * 5}`;
      case 'rescue': return `生存者 ${d.stock}人`;
      case 'hospital': return `生存者 ${d.stock}人（医者）・修理キット`;
      case 'junk': return `スクラップ 約 ${Math.round(d.stock * 1.5)}`;
      case 'police': return '設計図 1枚・スクラップ';
      case 'patrol': return '落ちている物を拾う';
    }
    return '';
  },

  /* ------------------------------ 1日の終わり ------------------------------ */
  eaters() { return this.state.survivors.filter((x) => x.trait !== 'dog').length; },
  foodNeed() {
    const cooks = this.state.survivors.filter((x) => x.trait === 'cook').length;
    return Math.max(1, 1 + this.eaters() - cooks * 2);
  },
  production() {
    const s = this.state, b = s.base;
    const farmers = s.survivors.filter((x) => x.trait === 'farmer').length;
    const scavs = s.survivors.filter((x) => x.trait === 'scav').length;
    return {
      food: FARM_FOOD[b.farm] + farmers * (b.farm > 0 ? 3 : 1),
      scrap: SHOP_SCRAP[b.workshop] + scavs * 6 + s.survivors.length * 2,
    };
  },

  /* 夕方の精算。食べて、作って、足りなければ仲間が去る */
  evening() {
    const s = this.state;
    const need = this.foodNeed();
    const prod = this.production();
    const out = { need, prod, left: [], short: 0 };
    s.food += prod.food;
    s.scrap += prod.scrap;
    if (s.food >= need) s.food -= need;
    else {
      out.short = need - s.food;
      s.food = 0;
      const doctors = s.survivors.some((x) => x.trait === 'doctor');
      let leave = doctors ? Math.floor(out.short / 2) : out.short;
      while (leave-- > 0) {
        const cand = s.survivors.filter((x) => x.trait !== 'dog' && x.trait !== 'doctor');
        if (!cand.length) break;
        const who = pick(cand);
        s.survivors.splice(s.survivors.indexOf(who), 1);
        out.left.push(who);
      }
    }
    s.phase = 'evening';
    return out;
  },

  isRaidNight() { return RAID_NIGHTS.includes(this.state.day); },
  nextRaid() { return RAID_NIGHTS.find((d) => d >= this.state.day) || MAX_DAY; },

  nextMorning() {
    const s = this.state;
    s.day++;
    s.phase = 'morning';
    s.rerolls = this.metaLv('reroll');
    if (s.survivors.some((x) => x.trait === 'doctor')) this.repairCarFree(0.1);
    this.genDestinations();
    this.save();
  },

  pickEvent() {
    const rng = new RNG(this.state.seed + this.state.day * 131);
    const seen = this.state.log;
    let pool = EVENTS.filter((e) => !seen.includes(e.id));
    if (!pool.length) pool = EVENTS;
    const ev = rng.pick(pool);
    seen.push(ev.id);
    return ev;
  },

  /* ------------------------------ 終わり ------------------------------ */
  medalsFor(win) {
    const s = this.state;
    return 1 + (s.day - 1) + Math.floor(s.stats.kills / 40) + s.stats.rescued + (win ? 12 : 0) + (s.easy ? 0 : Math.floor(s.day / 3));
  },
  finish(win, reason) {
    const s = this.state;
    const medals = this.medalsFor(win);
    const m = this.meta;
    m.medals += medals; m.runs++; m.kills += s.stats.kills;
    if (win) m.wins++;
    m.best = Math.max(m.best, win ? MAX_DAY + 1 : s.day);
    this.saveMeta();
    const sum = { win, reason, day: s.day, medals, stats: Object.assign({}, s.stats), level: s.level, survivors: s.survivors.length };
    this.clear();
    return sum;
  },
  gameOver(reason) {
    const sum = this.finish(false, reason);
    setTimeout(() => UI.gameOver(sum), 300);
  },
};
