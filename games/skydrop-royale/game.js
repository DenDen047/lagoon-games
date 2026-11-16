/* =========================================================================
   SKYDROP ROYALE ― しあいの なかみ
   プレイヤー / ぶきの はっしゃ / 弾 / ばくはつ / 建築 / アイテム / ゾーン
   ========================================================================= */
'use strict';

const PICKAXE = { id: 'pickaxe', name: 'ツルハシ', cat: 'melee', d: 15, p: 1, r: 1.8, m: 0, rl: 0, s: 0, proj: 'melee', range: 62, arc: deg(110), sound: 'swing', ammo: null, slow: 1, minR: 0 };
const BUILD_COST = 10;
const ZONE_PHASES = [
  { wait: 45, shrink: 35, r: 2400, dps: 1 },
  { wait: 30, shrink: 28, r: 1500, dps: 2 },
  { wait: 25, shrink: 25, r: 900, dps: 4 },
  { wait: 22, shrink: 20, r: 500, dps: 6 },
  { wait: 20, shrink: 16, r: 250, dps: 8 },
  { wait: 15, shrink: 15, r: 90, dps: 10 },
  { wait: 10, shrink: 12, r: 0, dps: 15 },
];
const RAR_ROLL = [[52, 30, 13, 4, 1], [18, 34, 30, 14, 4], [0, 0, 25, 48, 27]];

function wstat(w, r) {
  const R = RARITY[r];
  return { dmg: w.d * R.dmg, rl: w.rl * R.rel, mag: w.m ? Math.max(1, Math.round(w.m * R.mag)) : 0 };
}

const Game = {
  players: [], me: null, bullets: [], fx: [], loot: [], parts: [], texts: [], beams: [], feed: [],
  phase: 'bus', t: 0, alive: 0, training: false, over: false,
  bus: null, zone: null, shake: 0, hurtFlash: 0, hurtDir: null, banner: null, lastPoi: null,
  pgrid: new Map(), lgrid: new Map(), lootId: 1, growing: [],

  /* ------------------------------ はじめる ------------------------------ */
  start(opts) {
    this.training = !!opts.training;
    const seed = opts.seed || (Math.random() * 1e9) | 0;
    World.generate(seed);
    this.players = []; this.bullets = []; this.fx = []; this.loot = []; this.parts = []; this.texts = []; this.beams = []; this.feed = []; this.growing = [];
    this.lgrid.clear(); this.t = 0; this.over = false; this.shake = 0; this.hurtFlash = 0; this.banner = null; this.lastPoi = null;
    this.diff = opts.diff ?? 1;

    const sd = Save.d;
    const meSkin = currentSkin();
    this.me = makePlayer(0, 'あなた', meSkin, false);
    this.me.glider = sd.glider;
    this.players.push(this.me);

    if (this.training) { this.startTraining(opts.weapon); return; }

    for (const s of World.lootSpots) this.spawnLoot(s.x, s.y, this.rollFloorLoot(s.q), false);
    const n = opts.players || 50;
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    for (let i = 1; i < n; i++) {
      const sk = Math.random() < 0.15 ? randomSkin() : pick(SKINS);
      const b = makePlayer(i, names[(i - 1) % names.length] + (i > names.length ? i : ''), sk, true);
      b.glider = pick(GLIDERS).id;
      this.players.push(b);
    }
    // ひこうせん
    const a = Math.random() * TAU;
    const off = (Math.random() - 0.5) * 1600;
    const cx = WORLD_W / 2 + Math.cos(a + Math.PI / 2) * off, cy = WORLD_H / 2 + Math.sin(a + Math.PI / 2) * off;
    const L = 3100;
    this.bus = { x0: cx - Math.cos(a) * L, y0: cy - Math.sin(a) * L, x1: cx + Math.cos(a) * L, y1: cy + Math.sin(a) * L, ang: a, t: 0, dur: 30, x: 0, y: 0 };
    for (const p of this.players) {
      p.air = 'bus'; p.z = 1;
      if (p.bot) {
        p.ai.jumpAt = 0.12 + Math.random() * 0.8;
        const poi = Math.random() < 0.45 ? pick(World.pois) : null;
        p.ai.land = poi ? { x: poi.x + rand(-300, 300), y: poi.y + rand(-300, 300) } : null;
      }
    }
    this.phase = 'bus';
    const zr = 4700;
    this.zone = { x: WORLD_W / 2, y: WORLD_H / 2, r: zr, fx: WORLD_W / 2, fy: WORLD_H / 2, fr: zr, tx: WORLD_W / 2, ty: WORLD_H / 2, tr: zr, i: -1, state: 'wait', t: 0, dps: 0, wait: 60, shrink: 1 };
    this.nextZone();
    this.alive = this.players.length;
  },

  startTraining(wid) {
    const p = World.pois.find((q) => q.type === 'town') || World.pois[0];
    const me = this.me;
    me.x = p.x; me.y = p.y; me.air = null; me.z = 0;
    // まわりを ひろく あける
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    for (let y = ty - 9; y <= ty + 9; y++) for (let x = tx - 13; x <= tx + 13; x++) if (World.inb(x, y)) { World.setOb(x, y, OB.NONE); World.gr[y * MW + x] = GR.CONCRETE; }
    World.houses = World.houses.filter((h) => h.x1 < tx - 13 || h.x0 > tx + 13 || h.y1 < ty - 9 || h.y0 > ty + 9);
    for (let x = tx - 3; x <= tx + 3; x++) World.setOb(x, ty - 6, OB.WBRICK);
    for (let y = ty - 2; y <= ty + 2; y++) World.setOb(tx + 8, y, OB.WWOOD);
    World.paintGround();
    this.trainGive(wid || 'ar');
    me.mats = { wood: 999, stone: 999, metal: 999 };
    me.inv[4] = { kind: 'h', id: 'bigsh', n: 3 };
    const spots = [[5, 0], [5, 3], [7, -3], [-5, 2], [-6, -2], [0, 5], [3, -4], [10, 0]];
    spots.forEach(([dx, dy], i) => {
      const d = makePlayer(100 + i, 'まと' + (i + 1), Object.assign({}, SKINS[(i * 5) % SKINS.length]), true);
      d.x = me.x + dx * TILE; d.y = me.y + dy * TILE; d.air = null; d.z = 0; d.dummy = true; d.sh = 100;
      d.home = { x: d.x, y: d.y };
      this.players.push(d);
    });
    this.phase = 'play';
    this.zone = null;
    this.alive = this.players.length;
  },
  trainGive(wid) {
    const w = WEAPONS[wid];
    const me = this.me;
    me.inv[0] = { kind: 'w', id: wid, r: 4, mag: wstat(w, 4).mag, n: w.stack || 0 };
    if (!me.inv[1]) me.inv[1] = { kind: 'w', id: 'pump', r: 2, mag: wstat(WEAPONS.pump, 2).mag };
    me.sel = 1; me.reload = 0; me.charge = 0;
    for (const k in AMMO) me.ammo[k] = 999;
    markSeen(wid);
  },

  nextZone() {
    const z = this.zone;
    z.i++;
    if (z.i >= ZONE_PHASES.length) { z.state = 'done'; return; }
    const ph = ZONE_PHASES[z.i];
    z.fx = z.x; z.fy = z.y; z.fr = z.r;
    const maxOff = Math.max(0, z.r - ph.r);
    let nx = z.x, ny = z.y;
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * TAU, d = Math.random() * maxOff * 0.9;
      nx = clamp(z.x + Math.cos(a) * d, 600, WORLD_W - 600); ny = clamp(z.y + Math.sin(a) * d, 600, WORLD_H - 600);
      if (dist(nx, ny, z.x, z.y) + ph.r <= z.r && !World.inWater(nx, ny)) break;
    }
    z.tx = nx; z.ty = ny; z.tr = ph.r;
    z.state = 'wait'; z.t = 0; z.wait = ph.wait; z.shrink = ph.shrink;
    z.dps = ZONE_PHASES[Math.max(0, z.i - 1)].dps;
    if (z.i > 0) { this.say('ゾーンが ちいさく なるよ！', '#c86aff'); Sfx.play('zone'); }
    if (z.i === 2 || z.i === 4) this.spawnSupply();
  },

  /* ------------------------------ アイテム ------------------------------ */
  rollWeapon(q) {
    const w = weightedPick(WEAPON_LIST, (x) => x.w);
    let r = weightedPick([0, 1, 2, 3, 4], (i) => RAR_ROLL[q][i]);
    r = Math.max(r, w.minR);
    return { kind: 'w', id: w.id, r, mag: wstat(w, r).mag, n: w.stack ? Math.max(1, Math.ceil(w.stack / 2)) : 0 };
  },
  rollHeal() { const h = weightedPick(Object.keys(HEALS), (k) => HEALS[k].w); return { kind: 'h', id: h, n: h === 'bandage' ? 5 : h === 'smallsh' ? 3 : 1 }; },
  ammoFor(it) { const w = WEAPONS[it.id]; if (!w || !w.ammo) return null; return { kind: 'ammo', id: w.ammo, n: AMMO[w.ammo].pick * 2 }; },
  rollFloorLoot(q) {
    const r = Math.random(), out = [];
    if (r < 0.55) { const it = this.rollWeapon(q); out.push(it); const a = this.ammoFor(it); if (a) out.push(a); }
    else if (r < 0.8) out.push(this.rollHeal());
    else if (r < 0.95) { const k = pick(Object.keys(AMMO)); out.push({ kind: 'ammo', id: k, n: AMMO[k].pick * 2 }); }
    else out.push({ kind: 'mat', id: pick(MATS).id, n: 30 });
    return out;
  },
  chestLoot(q = 1) {
    const out = [];
    const it = this.rollWeapon(q); out.push(it);
    const a = this.ammoFor(it); if (a) out.push(a);
    out.push(Math.random() < 0.6 ? this.rollHeal() : this.rollWeapon(q));
    const k = pick(Object.keys(AMMO)); out.push({ kind: 'ammo', id: k, n: AMMO[k].pick * 2 });
    if (Math.random() < 0.5) out.push({ kind: 'mat', id: 'wood', n: 30 });
    return out;
  },
  gkey(x, y) { return ((x / 160) | 0) + ',' + ((y / 160) | 0); },
  spawnLoot(x, y, items, spill = true) {
    const made = [];
    for (const it of items) {
      let px = x, py = y;
      if (spill || items.length > 1) {
        for (let k = 0; k < 10; k++) {
          const a = Math.random() * TAU, d = 16 + Math.random() * 34;
          px = x + Math.cos(a) * d; py = y + Math.sin(a) * d;
          if (World.freeSpot(px, py)) break;
          px = x; py = y;
        }
      }
      const L = { id: this.lootId++, x: px, y: py, it, age: spill ? 0 : 1, sx: x, sy: y };
      this.loot.push(L);
      const k = this.gkey(px, py);
      if (!this.lgrid.has(k)) this.lgrid.set(k, []);
      this.lgrid.get(k).push(L);
      made.push(L);
    }
    return made;
  },
  removeLoot(L) {
    L.dead = true;
    const arr = this.lgrid.get(this.gkey(L.x, L.y));
    if (arr) { const i = arr.indexOf(L); if (i >= 0) arr.splice(i, 1); }
  },
  lootNear(x, y, r) {
    const out = [];
    const c0 = ((x - r) / 160) | 0, c1 = ((x + r) / 160) | 0, r0 = ((y - r) / 160) | 0, r1 = ((y + r) / 160) | 0;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const arr = this.lgrid.get(cx + ',' + cy);
      if (arr) for (const L of arr) if (dist2(L.x, L.y, x, y) < r * r) out.push(L);
    }
    return out;
  },
  spawnSupply() {
    const z = this.zone;
    const a = Math.random() * TAU, d = Math.random() * z.tr * 0.6;
    const x = z.tx + Math.cos(a) * d, y = z.ty + Math.sin(a) * d;
    if (!World.freeSpot(x, y)) return;
    this.fx.push({ type: 'supply', x, y, t: 0, z: 1, landed: false });
    this.say('ほきゅうぶっしが おちてくる！', '#4aa8ff');
  },

  /* もちものに いれる。いれられたら true */
  give(p, it) {
    if (it.kind === 'ammo') { p.ammo[it.id] = Math.min(AMMO[it.id].max, p.ammo[it.id] + it.n); return true; }
    if (it.kind === 'mat') { p.mats[it.id] = Math.min(999, p.mats[it.id] + it.n); return true; }
    // おなじ なげもの・かいふくは かさねる
    if (it.kind === 'h' || (it.kind === 'w' && WEAPONS[it.id].stack)) {
      const max = it.kind === 'h' ? HEALS[it.id].stack : WEAPONS[it.id].stack;
      for (const s of p.inv) if (s && s.kind === it.kind && s.id === it.id && s.n < max) {
        const add = Math.min(max - s.n, it.n);
        s.n += add; it.n -= add;
        if (it.n <= 0) return true;
      }
    }
    const free = p.inv.indexOf(null);
    if (free < 0) return false;
    p.inv[free] = Object.assign({}, it);
    if (it.kind === 'w' && p === this.me) markSeen(it.id);
    if (p.bot && p.sel === 0) p.sel = free + 1;
    return true;
  },
  dropSlot(p, i) {
    const s = p.inv[i];
    if (!s) return;
    p.inv[i] = null;
    for (const L of this.spawnLoot(p.x, p.y, [s])) L.dropBy = p;
  },

  /* ------------------------------ 毎フレーム ------------------------------ */
  update(dt) {
    if (this.over) return;
    this.t += dt;
    G.time += dt;
    this.buildGrid();
    if (this.phase === 'bus') this.updateBus(dt);
    if (this.zone && this.phase !== 'bus') this.updateZone(dt);
    for (const p of this.players) if (p.alive) this.updatePlayer(p, dt);
    this.updateBullets(dt);
    this.updateFx(dt);
    this.updateGrowing(dt);
    this.updateParts(dt);
    for (const L of this.loot) if (L.age < 1) L.age += dt * 3;
    if (this.loot.length > 3000) this.loot = this.loot.filter((L) => !L.dead);
    else if (this.t % 5 < dt) this.loot = this.loot.filter((L) => !L.dead);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    const poi = World.poiAt(this.me.x, this.me.y);
    if (poi !== this.lastPoi) { this.lastPoi = poi; if (poi && this.me.alive && !this.me.air) this.banner = { text: poi.name, t: 2.5 }; }
  },

  buildGrid() {
    this.pgrid.clear();
    for (const p of this.players) {
      if (!p.alive) continue;
      const k = ((p.x / 200) | 0) + ',' + ((p.y / 200) | 0);
      let a = this.pgrid.get(k); if (!a) this.pgrid.set(k, (a = []));
      a.push(p);
    }
  },
  near(x, y, r) {
    const out = [];
    const c0 = ((x - r) / 200) | 0, c1 = ((x + r) / 200) | 0, r0 = ((y - r) / 200) | 0, r1 = ((y + r) / 200) | 0;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const a = this.pgrid.get(cx + ',' + cy);
      if (a) for (const p of a) out.push(p);
    }
    return out;
  },

  updateBus(dt) {
    const b = this.bus;
    b.t += dt;
    const k = clamp(b.t / b.dur, 0, 1);
    b.x = lerp(b.x0, b.x1, k); b.y = lerp(b.y0, b.y1, k);
    let still = 0;
    for (const p of this.players) {
      if (p.air !== 'bus') continue;
      p.x = b.x; p.y = b.y;
      const jump = (p.bot && k > p.ai.jumpAt) || k >= 1 || (p === this.me && Controls.jump);
      // まっすぐ せんの うえで 目的地に いちばん ちかい ところで とびおりる
      if (p.bot && p.ai.land && !jump) {
        const ahead = dist(lerp(b.x0, b.x1, k + 0.01), lerp(b.y0, b.y1, k + 0.01), p.ai.land.x, p.ai.land.y);
        if (ahead > dist(b.x, b.y, p.ai.land.x, p.ai.land.y) && dist(b.x, b.y, p.ai.land.x, p.ai.land.y) < 2400) this.jumpOff(p);
      }
      if (jump && p.air === 'bus') this.jumpOff(p);
      if (p.air === 'bus') still++;
    }
    if (k >= 1 || still === 0) { this.phase = 'play'; }
  },
  jumpOff(p) {
    p.air = 'fall'; p.z = 1;
    if (p.bot && !p.ai.land) p.ai.land = { x: p.x + rand(-900, 900), y: p.y + rand(-900, 900) };
    if (p === this.me) Sfx.play('jump');
  },

  updateZone(dt) {
    const z = this.zone;
    if (z.state === 'done') return;
    z.t += dt;
    if (z.state === 'wait') { if (z.t >= z.wait) { z.state = 'shrink'; z.t = 0; z.dps = ZONE_PHASES[z.i].dps; } }
    else if (z.state === 'shrink') {
      const k = clamp(z.t / z.shrink, 0, 1);
      z.x = lerp(z.fx, z.tx, k); z.y = lerp(z.fy, z.ty, k); z.r = lerp(z.fr, z.tr, k);
      if (k >= 1) this.nextZone();
    }
    // ゾーンの そとは ダメージ
    if ((this.t * 2 | 0) !== ((this.t - dt) * 2 | 0)) {
      for (const p of this.players) if (p.alive && !p.air && dist(p.x, p.y, z.x, z.y) > z.r) this.hurt(p, z.dps * 0.5 || 0.5, null, { zone: true });
    }
  },

  /* ------------------------------ プレイヤー ------------------------------ */
  updatePlayer(p, dt) {
    const st = p.st;
    for (const k in st) if (st[k] > 0) st[k] = Math.max(0, st[k] - dt);
    p.dotT += dt;
    if (p.dotT >= 0.5) {
      p.dotT = 0;
      if (st.burn > 0) this.hurt(p, 3, p.burnBy, { dot: true });
      if (st.poison > 0) this.hurt(p, 2, p.poisonBy, { dot: true, noShield: true });
    }
    if (p.hotT > 0) { const a = Math.min(p.hotT, dt) * 15; p.hotT -= dt; healP(p, a, 0, 100); }
    if (p.dummy) { this.updateDummy(p, dt); return; }

    if (p.air === 'bus') return;
    if (p.air === 'fall' || p.air === 'glide') { this.updateAir(p, dt); return; }
    if (p.air === 'jump') {
      p.jumpT += dt;
      const k = p.jumpT / p.jumpDur;
      p.z = Math.sin(Math.PI * clamp(k, 0, 1)) * 0.35;
      World.moveCircle(p, p.jvx * dt, p.jvy * dt, true);
      if (k >= 1) { p.air = null; p.z = 0; World.pushOut(p); this.unstick(p); }
      return;
    }

    // いれもの
    let mx = 0, my = 0, holding = false, released = false;
    if (p.bot) { AI.think(p, dt); mx = p.ai.mx; my = p.ai.my; holding = p.ai.fire; released = p.ai.release; }
    else {
      mx = Controls.mx; my = Controls.my; p.aim = Controls.aim; holding = Controls.fire; released = Controls.release;
      this.playerActions(p);
    }
    if (st.stun > 0) { mx = 0; my = 0; holding = false; released = false; }

    // いどう
    const item = curItem(p);
    let spd = 230;
    const w = item && item.kind === 'w' ? (item.id === 'pickaxe' ? PICKAXE : WEAPONS[item.id]) : null;
    if (w) spd *= w.slow;
    if (p.heal) spd *= 0.55;
    if (st.freeze > 0) spd *= 0.45;
    if (World.inWater(p.x, p.y)) spd *= 0.55;
    if (p.charging) spd *= 0.7;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    p.moving = ml > 0.1;
    if (p.moving) p.walk += dt; else p.walk = 0;
    let dx = mx * spd * dt + p.kx * dt, dy = my * spd * dt + p.ky * dt;
    const kd = Math.pow(0.02, dt);
    p.kx *= kd; p.ky *= kd;
    if (Math.abs(p.kx) < 5) p.kx = 0;
    if (Math.abs(p.ky) < 5) p.ky = 0;
    if (p.pull) {
      const d = dist(p.x, p.y, p.pull.x, p.pull.y);
      if (d < 30 || p.pull.t <= 0) p.pull = null;
      else { p.pull.t -= dt; dx = ((p.pull.x - p.x) / d) * 1100 * dt; dy = ((p.pull.y - p.y) / d) * 1100 * dt; }
    }
    const ox = p.x, oy = p.y;
    World.moveCircle(p, dx, dy);
    p.vxm = (p.x - ox) / dt; p.vym = (p.y - oy) / dt;
    p.face = Math.cos(p.aim) >= 0 ? 1 : -1;

    // ふむ もの
    for (const f of this.fx) {
      if (f.type === 'banana' && !f.dead && f.owner !== p && dist2(f.x, f.y, p.x, p.y) < 26 * 26) { f.dead = true; p.st.stun = Math.max(p.st.stun, 1.1); p.kx += Math.cos(p.aim) * 400; p.ky += Math.sin(p.aim) * 400; this.text(p.x, p.y - 30, 'ツルッ！', '#ffe04a'); }
      if (f.type === 'pad' && !f.dead && dist2(f.x, f.y, p.x, p.y) < 26 * 26 && !p.air) this.launch(p, mx || Math.cos(p.aim), my || Math.sin(p.aim));
      if (f.type === 'mine' && !f.dead && f.owner !== p && f.arm <= 0 && dist2(f.x, f.y, p.x, p.y) < 30 * 30) { f.dead = true; this.explode(f.x, f.y, f.owner, WEAPONS.landmine, f.r, WEAPONS.landmine.d * RARITY[f.r].dmg); }
    }

    // ひろう
    this.autoPickup(p);
    // かいふく
    if (p.heal) {
      p.heal.t += dt;
      const h = HEALS[p.heal.id];
      if (p.heal.t >= h.t) {
        const s = p.inv[p.heal.slot];
        if (s && s.kind === 'h' && s.id === p.heal.id) {
          if (h.hot) p.hotT = (p.hotT || 0) + h.hot / 15;
          healP(p, h.hp || 0, h.sh || 0, h.max || 100, h.maxSh || 100);
          s.n--; if (s.n <= 0) p.inv[p.heal.slot] = null;
          if (p === this.me) Sfx.play('heal');
        }
        p.heal = null;
      }
    }
    // リロード
    if (p.reload > 0) {
      p.reload -= dt;
      if (p.reload <= 0) this.finishReload(p);
    }
    p.cd -= dt;
    // ぶき
    if (p.buildMode && !p.bot) { if (Controls.place) this.tryBuild(p); p.charging = false; }
    else this.useItem(p, dt, holding, released);
    if (p.burst > 0) {
      p.burstT -= dt;
      if (p.burstT <= 0) {
        const s = curItem(p);
        if (s && s.kind === 'w' && s.mag > 0 && WEAPONS[s.id] === p.burstW) { this.fireShot(p, p.burstW, s.r, 1); s.mag--; p.burst--; p.burstT = 0.065; }
        else p.burst = 0;
      }
    }
  },

  updateDummy(p, dt) {
    p.walk = 0; p.aim = Math.atan2(this.me.y - p.y, this.me.x - p.x); p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
    const kd = Math.pow(0.02, dt);
    World.moveCircle(p, p.kx * dt, p.ky * dt); p.kx *= kd; p.ky *= kd;
    if (p.pull) p.pull = null;
    if (this.t - (p.lastHurt || 0) > 3) { p.hp = 100; p.sh = 100; const d = dist(p.x, p.y, p.home.x, p.home.y); if (d > 2) World.moveCircle(p, (p.home.x - p.x) * dt * 2, (p.home.y - p.y) * dt * 2); }
  },

  updateAir(p, dt) {
    let mx = 0, my = 0;
    if (p.bot) {
      const L = p.ai.land;
      const d = dist(p.x, p.y, L.x, L.y);
      if (d > 30) { mx = (L.x - p.x) / d; my = (L.y - p.y) / d; }
    } else { mx = Controls.mx; my = Controls.my; }
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    const sp = p.air === 'fall' ? 420 : 260;
    p.x = clamp(p.x + mx * sp * dt, 40, WORLD_W - 40); p.y = clamp(p.y + my * sp * dt, 40, WORLD_H - 40);
    p.moving = ml > 0.1;
    if (mx) p.face = mx > 0 ? 1 : -1;
    p.z -= dt * (p.air === 'fall' ? 0.11 : 0.09);
    if (p.air === 'fall' && (p.z <= 0.35 || (!p.bot && Controls.jump && p.z < 0.9))) p.air = 'glide';
    if (p.z <= 0) {
      p.z = 0; p.air = null; p.landT = this.t;
      this.unstick(p);
      if (p === this.me) this.say('ちゃくち！ ぶきを さがそう', '#ffffff');
    }
  },
  /* かべの なかに おりたら そとへ だす */
  unstick(p) {
    if (World.freeSpot(p.x, p.y) && World.freeSpot(p.x + p.r, p.y) && World.freeSpot(p.x - p.r, p.y)) { World.pushOut(p); return; }
    for (let r = 1; r < 10; r++) for (let a = 0; a < 8; a++) {
      const x = p.x + Math.cos((a / 8) * TAU) * r * TILE, y = p.y + Math.sin((a / 8) * TAU) * r * TILE;
      if (World.freeSpot(x, y)) { p.x = Math.floor(x / TILE) * TILE + TILE / 2; p.y = Math.floor(y / TILE) * TILE + TILE / 2; return; }
    }
  },
  launch(p, dx, dy) {
    const l = Math.hypot(dx, dy) || 1;
    p.air = 'jump'; p.jumpT = 0; p.jumpDur = 1.0; p.jvx = (dx / l) * 560; p.jvy = (dy / l) * 560;
    p.heal = null;
    if (p === this.me) Sfx.play('jump');
  },

  playerActions(p) {
    if (Controls.slot !== null) { this.selectSlot(p, Controls.slot); }
    if (Controls.cycle) { this.selectSlot(p, (p.sel + Controls.cycle + 6) % 6); }
    if (Controls.reload) this.startReload(p);
    if (Controls.build) { p.buildMode = !p.buildMode; p.heal = null; p.charging = false; Sfx.play('ui'); }
    if (Controls.mat !== null) { p.matSel = Controls.mat; }
    if (Controls.shape) { p.shape = 1 - (p.shape || 0); }
    if (Controls.interact) this.interact(p);
    if (Controls.drop && p.sel > 0) this.dropSlot(p, p.sel - 1);
  },
  selectSlot(p, i) {
    if (p.sel === i) return;
    p.sel = i; p.reload = 0; p.heal = null; p.charge = 0; p.charging = false; p.burst = 0; p.spin = 0;
    p.cd = Math.max(p.cd, 0.18);
    if (p === this.me) p.buildMode = false;
  },

  /* E キー: たからばこ / アイテムの いれかえ */
  interact(p) {
    const tgt = this.interactTarget(p);
    if (!tgt) return false;
    if (tgt.type === 'chest') {
      World.setOb(tgt.tx, tgt.ty, OB.CHESTOPEN);
      this.spawnLoot((tgt.tx + 0.5) * TILE, (tgt.ty + 0.5) * TILE + 10, this.chestLoot(1));
      if (p === this.me) Sfx.play('chest');
    } else if (tgt.type === 'ammobox') {
      World.setOb(tgt.tx, tgt.ty, OB.CHESTOPEN);
      const items = [];
      for (let i = 0; i < 3; i++) { const k = pick(Object.keys(AMMO)); items.push({ kind: 'ammo', id: k, n: AMMO[k].pick * 2 }); }
      this.spawnLoot((tgt.tx + 0.5) * TILE, (tgt.ty + 0.5) * TILE + 10, items);
      if (p === this.me) Sfx.play('chest');
    } else if (tgt.type === 'supply') {
      tgt.f.dead = true;
      this.spawnLoot(tgt.f.x, tgt.f.y, [this.rollWeapon(2), this.rollWeapon(2), { kind: 'h', id: 'bigsh', n: 2 }, { kind: 'mat', id: 'metal', n: 60 }]);
      if (p === this.me) Sfx.play('chest');
    } else if (tgt.type === 'loot') {
      const L = tgt.L;
      if (this.give(p, Object.assign({}, L.it))) { this.removeLoot(L); }
      else {
        // いっぱい: いま もっている ものと いれかえ
        let slot = p.sel - 1;
        if (slot < 0) slot = 0;
        const old = p.inv[slot];
        p.inv[slot] = Object.assign({}, L.it);
        if (L.it.kind === 'w' && p === this.me) markSeen(L.it.id);
        this.removeLoot(L);
        if (old) this.spawnLoot(p.x, p.y, [old]);
        if (p.sel === 0) p.sel = 1;
      }
      if (p === this.me) Sfx.play('pickup');
    }
    return true;
  },
  interactTarget(p) {
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
      const o = World.obAt(x, y);
      if ((o === OB.CHEST || o === OB.AMMOBOX) && dist(p.x, p.y, (x + 0.5) * TILE, (y + 0.5) * TILE) < 62) return { type: o === OB.CHEST ? 'chest' : 'ammobox', tx: x, ty: y };
    }
    for (const f of this.fx) if (f.type === 'supply' && f.landed && !f.dead && dist(p.x, p.y, f.x, f.y) < 60) return { type: 'supply', f };
    let best = null, bd = 44 * 44;
    for (const L of this.lootNear(p.x, p.y, 44)) {
      if (L.dead || (L.it.kind !== 'w' && L.it.kind !== 'h')) continue;
      const d = dist2(L.x, L.y, p.x, p.y);
      if (d < bd) { bd = d; best = L; }
    }
    return best ? { type: 'loot', L: best } : null;
  },
  autoPickup(p) {
    for (const L of this.lootNear(p.x, p.y, 30)) {
      if (L.dead || L.age < 1) continue;
      const it = L.it;
      if (it.kind === 'ammo' || it.kind === 'mat') { this.give(p, it); this.removeLoot(L); if (p === this.me) Sfx.play('pickup', 0.6); continue; }
      // あいている わくが あれば じどうで ひろう
      if (p.bot) continue;
      const stackable = it.kind === 'h' || WEAPONS[it.id].stack;
      const hasRoom = p.inv.includes(null) || (stackable && p.inv.some((s) => s && s.kind === it.kind && s.id === it.id));
      if (hasRoom && !L.dropBy) { if (this.give(p, Object.assign({}, it))) { this.removeLoot(L); Sfx.play('pickup'); } }
    }
  },

  /* ------------------------------ ぶきを つかう ------------------------------ */
  useItem(p, dt, holding, released) {
    const s = curItem(p);
    if (!s) return;
    if (s.kind === 'h') {
      if (holding && !p.heal && p.reload <= 0) {
        const h = HEALS[s.id];
        const can = (h.hp && p.hp < (h.max || 100)) || (h.sh && p.sh < (h.maxSh || 100)) || h.hot;
        if (can) p.heal = { id: s.id, slot: p.sel - 1, t: 0 };
        else if (p === this.me && Input.mclick) this.say('いまは つかえないよ', '#ffffff', 1);
      }
      return;
    }
    const w = s.id === 'pickaxe' ? PICKAXE : WEAPONS[s.id];
    if (w.spin) { if (holding && p.reload <= 0) p.spin = Math.min(1, p.spin + dt / w.spin); else p.spin = Math.max(0, p.spin - dt * 2); }
    if (p.reload > 0) { p.charging = false; return; }
    if (w.charge) {
      if (holding && this.hasAmmoInMag(p, s, w)) { p.charging = true; p.charge = Math.min(w.charge, p.charge + dt); if (p.bot && p.charge >= w.charge * 0.95) released = true; }
      if (released && p.charging && p.cd <= 0) {
        const pow = 0.35 + 0.65 * (p.charge / w.charge);
        this.trigger(p, s, w, pow);
        p.charge = 0; p.charging = false;
      }
      if (!holding && !released) { p.charging = false; p.charge = 0; }
      return;
    }
    if (holding && p.cd <= 0) this.trigger(p, s, w, 1);
  },
  hasAmmoInMag(p, s, w) {
    if (w.m) return s.mag > 0;
    if (w.stack) return s.n > 0;
    return true;
  },
  trigger(p, s, w, pow) {
    if (p.heal) p.heal = null;
    if (w.m) {
      if (s.mag <= 0) { if (!this.startReload(p)) { if (p === this.me) Sfx.play('empty'); p.cd = 0.3; } return; }
    }
    let rate = w.r;
    if (w.spin) rate *= 0.3 + 0.7 * p.spin;
    p.cd = 1 / rate;
    if (w.burst) { p.burst = w.burst - 1; p.burstT = 0.065; p.burstW = w; }
    this.fireShot(p, w, s.r || 0, pow);
    if (w.m) { s.mag--; if (s.mag <= 0 && !w.burst) this.startReload(p); }
    if (w.stack) { s.n--; if (s.n <= 0) { p.inv[p.sel - 1] = null; } }
  },
  startReload(p) {
    const s = curItem(p);
    if (!s || s.kind !== 'w' || s.id === 'pickaxe') return false;
    const w = WEAPONS[s.id];
    if (!w.m || p.reload > 0) return false;
    const st = wstat(w, s.r);
    if (s.mag >= st.mag) return false;
    if (!this.training && (!w.ammo || p.ammo[w.ammo] <= 0)) return false;
    p.reload = st.rl; p.reloadMax = st.rl; p.burst = 0;
    if (p === this.me) Sfx.play('reload');
    return true;
  },
  finishReload(p) {
    const s = curItem(p);
    if (!s || s.kind !== 'w' || s.id === 'pickaxe') return;
    const w = WEAPONS[s.id], st = wstat(w, s.r);
    const need = st.mag - s.mag;
    const got = this.training ? need : Math.min(need, p.ammo[w.ammo]);
    s.mag += got;
    if (!this.training) p.ammo[w.ammo] -= got;
    p.reload = 0;
  },

  aimPoint(p) {
    if (p.bot) return p.ai.aimPt || { x: p.x + Math.cos(p.aim) * 300, y: p.y + Math.sin(p.aim) * 300 };
    return Controls.aimWorld();
  },

  /* 1かいぶんの はっしゃ */
  fireShot(p, w, r, pow) {
    const st = wstat(w, r);
    const ang = p.aim;
    const vol = this.vol(p.x, p.y);
    Sfx.play(w.sound, vol * (w.silent ? 0.6 : 1));
    if (!w.silent) p.noiseT = this.t;
    const mx = p.x + Math.cos(ang) * 20, my = p.y - 4 + Math.sin(ang) * 20;
    switch (w.proj) {
      case 'melee': this.melee(p, w, r, st.dmg); return;
      case 'beam': {
        const n = w.p || 1;
        for (let i = 0; i < n; i++) this.beam(p, w, r, ang + (Math.random() - 0.5) * w.s * 2, st.dmg * pow);
        if (w.knock && w.range < 500) this.parts.push({ type: 'ring', x: mx, y: my, t: 0, life: 0.25, col: w.col, r: 30 });
        return;
      }
      case 'deploy': this.deploy(p, w, r); return;
      case 'dash': { let dx = Controls.mx, dy = Controls.my; if (p.bot || (!dx && !dy)) { dx = Math.cos(ang); dy = Math.sin(ang); } const l = Math.hypot(dx, dy) || 1; p.kx += (dx / l) * 1300; p.ky += (dy / l) * 1300; this.puff(p.x, p.y + 10, '#ffffff', 8); return; }
    }
    const isGren = w.proj === 'grenade';
    const ap = isGren ? this.aimPoint(p) : null;
    const n = w.p || 1;
    for (let i = 0; i < n; i++) {
      let a = ang;
      if (n > 1 && w.cat !== 'shotgun' && !w.rainbow && w.cat !== 'toy') a += ((i - (n - 1) / 2) * w.s) / Math.max(1, n - 1) * 2 + (Math.random() - 0.5) * w.s * 0.3;
      else a += (Math.random() - 0.5) * w.s * 2 * (w.charge ? 1.6 - pow : 1);
      const spd = w.spd * (w.proj === 'arrow' && w.charge ? 0.6 + 0.4 * pow : 1) * (w.proj === 'flame' ? rand(0.85, 1.15) : 1);
      const ox = n > 1 && (w.id === 'dualpistol' || w.id === 'twinsmg') ? Math.cos(ang + Math.PI / 2) * (i ? 5 : -5) : 0;
      const oy = n > 1 && (w.id === 'dualpistol' || w.id === 'twinsmg') ? Math.sin(ang + Math.PI / 2) * (i ? 5 : -5) : 0;
      const b = {
        x: mx + ox, y: my + oy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, owner: p, w, r, dmg: st.dmg * pow,
        kind: w.proj, d: 0, range: w.range * (w.proj === 'arrow' && w.charge ? 0.5 + 0.5 * pow : 1), pierce: w.pierce || 0, bounce: w.bounce || 0,
        hits: null, t: 0, rad: w.proj === 'orb' ? 6 : w.proj === 'rocket' ? 6 : w.proj === 'flame' ? 8 : 3,
        col: w.rainbow ? pick(['#ff4a4a', '#ffd23a', '#5fd35a', '#4aa8ff', '#ff5ac8', '#a64aff']) : (w.col || (w.proj === 'bullet' ? '#fff3a0' : RARITY[r].color)),
      };
      if (isGren) {
        let tx = ap.x, ty = ap.y;
        const dd = dist(mx, my, tx, ty);
        const maxD = w.cat === 'throw' || w.cat === 'toy' ? w.range : 900;
        if (dd > maxD) { tx = mx + ((tx - mx) / dd) * maxD; ty = my + ((ty - my) / dd) * maxD; }
        if (n > 1 || w.s) { tx += rand(-1, 1) * dd * Math.sin(w.s); ty += rand(-1, 1) * dd * Math.sin(w.s); }
        const D = Math.max(30, dist(mx, my, tx, ty));
        b.flyT = clamp(D / w.spd, 0.25, 1.4); b.vx = (tx - mx) / b.flyT; b.vy = (ty - my) / b.flyT; b.landed = false; b.z = 0;
      }
      if (w.proj === 'boomerang') { b.out = true; b.hits = new Set(); }
      if (w.proj === 'grapple') { b.rad = 4; }
      this.bullets.push(b);
    }
    // マズルフラッシュ
    if (w.proj === 'bullet' || w.proj === 'arrow') this.parts.push({ type: 'flash', x: mx, y: my, t: 0, life: 0.06, a: ang });
    if (w.cat === 'sniper' || w.cat === 'launcher' || w.id === 'slug' || w.id === 'handcannon') { p.kx -= Math.cos(ang) * 120; p.ky -= Math.sin(ang) * 120; if (p === this.me) this.shake = Math.max(this.shake, 6); }
  },

  vol(x, y) { const d = dist(x, y, this.me.x, this.me.y); return d > 1500 ? 0 : 1 - d / 1500; },

  melee(p, w, r, dmg) {
    const ang = p.aim;
    this.parts.push({ type: 'swing', x: p.x, y: p.y - 4, a: ang, arc: w.arc, range: w.range, t: 0, life: 0.18, col: w.col || '#ffffff' });
    if (w.lunge) { p.kx += Math.cos(ang) * w.lunge * 4; p.ky += Math.sin(ang) * w.lunge * 4; }
    let hitAny = false;
    for (const q of this.near(p.x, p.y, w.range + 30)) {
      if (q === p || q.air) continue;
      const d = dist(p.x, p.y, q.x, q.y);
      if (d > w.range + q.r) continue;
      if (Math.abs(angDiff(ang, Math.atan2(q.y - p.y, q.x - p.x))) > w.arc / 2 + 0.2) continue;
      if (!World.los(p.x, p.y, q.x, q.y, false)) continue;
      this.applyHit(q, p, w, r, dmg, Math.atan2(q.y - p.y, q.x - p.x));
      hitAny = true;
    }
    for (const f of this.fx) if (f.type === 'turret' && !f.dead && f.owner !== p && dist(p.x, p.y, f.x, f.y) < w.range + 16) { this.hurtFx(f, dmg); hitAny = true; }
    // まえの マスを たたく（素材あつめ）
    const hx = p.x + Math.cos(ang) * Math.min(w.range, 46), hy = p.y + Math.sin(ang) * Math.min(w.range, 46);
    let tx = Math.floor(hx / TILE), ty = Math.floor(hy / TILE);
    if (!OBD[World.obAt(tx, ty)].hp) { const hx2 = p.x + Math.cos(ang) * 26, hy2 = p.y + Math.sin(ang) * 26; tx = Math.floor(hx2 / TILE); ty = Math.floor(hy2 / TILE); }
    const o = World.obAt(tx, ty);
    if (OBD[o].hp && World.inb(tx, ty)) {
      const isPick = w === PICKAXE;
      const td = isPick ? 50 : dmg * (w.build || 1);
      if (isPick && OBD[o].mat && !OBD[o].build) {
        p.mats[OBD[o].mat] = Math.min(999, p.mats[OBD[o].mat] + OBD[o].n);
        if (p === this.me) this.text(hx, hy - 10, '+' + OBD[o].n, MATS.find((m) => m.id === OBD[o].mat).color);
      }
      this.damageTile(tx, ty, td, p);
      if (p === this.me || this.vol(hx, hy) > 0.3) Sfx.play('harvest', this.vol(hx, hy));
    } else if (hitAny) Sfx.play('hit', this.vol(p.x, p.y));
  },

  beam(p, w, r, ang, dmg) {
    let x = p.x + Math.cos(ang) * 18, y = p.y - 4 + Math.sin(ang) * 18;
    const sx = x, sy = y;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let pierce = w.pierce || 0;
    const hit = new Set();
    let ex = x + dx * w.range, ey = y + dy * w.range;
    const cands = this.near(x + dx * w.range / 2, y + dy * w.range / 2, w.range / 2 + 40).filter((q) => q !== p && !q.air);
    let lastTile = -1;
    for (let d = 0; d < w.range; d += 10) {
      x = sx + dx * d; y = sy + dy * d;
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (World.solid(tx, ty)) {
        const ti = ty * MW + tx;
        if (ti !== lastTile) { lastTile = ti; this.damageTile(tx, ty, dmg * (w.build || 1), p); }
        if (!w.wallP) { ex = x; ey = y; break; }
      }
      let stop = false;
      for (const q of cands) {
        if (hit.has(q)) continue;
        if (dist2(x, y, q.x, q.y) < (q.r + 4) * (q.r + 4)) {
          hit.add(q);
          this.applyHit(q, p, w, r, dmg, ang);
          if (pierce > 0) pierce--; else { stop = true; ex = x; ey = y; }
          break;
        }
      }
      if (!stop) for (const f of this.fx) if (f.type === 'turret' && !f.dead && f.owner !== p && dist2(x, y, f.x, f.y) < 18 * 18) { this.hurtFx(f, dmg); stop = true; ex = x; ey = y; break; }
      if (stop) break;
    }
    this.beams.push({ x0: sx, y0: sy, x1: ex, y1: ey, t: 0, life: w.cat === 'sniper' ? 0.35 : 0.12, col: w.col || '#ff4a4a', wd: w.cat === 'sniper' ? 5 : w.d > 40 ? 4 : 2.5 });
  },

  deploy(p, w, r) {
    const ang = p.aim;
    const x = p.x + Math.cos(ang) * 40, y = p.y + Math.sin(ang) * 40;
    const fxy = World.freeSpot(x, y) ? [x, y] : [p.x, p.y];
    switch (w.dep) {
      case 'mine': this.fx.push({ type: 'mine', x: fxy[0], y: fxy[1], owner: p, r, arm: 1.0, t: 0 }); break;
      case 'banana': this.fx.push({ type: 'banana', x: fxy[0], y: fxy[1], owner: p, t: 0 }); break;
      case 'turret': this.fx.push({ type: 'turret', x: fxy[0], y: fxy[1], owner: p, r, t: 0, life: 20, hp: 150, cd: 0, aim: ang }); break;
      case 'pad': this.fx.push({ type: 'pad', x: fxy[0], y: fxy[1], owner: p, t: 0, life: 25 }); break;
      case 'fort': {
        const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
        for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) {
          if (!xx && !yy) continue;
          if (this.canBuildAt(tx + xx, ty + yy, p)) { World.setOb(tx + xx, ty + yy, OB.BMETAL); World.hp[(ty + yy) * MW + tx + xx] = OBD[OB.BMETAL].hp; }
        }
        Sfx.play('build', this.vol(p.x, p.y));
        break;
      }
      case 'barrier': {
        const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
        const hor = Math.abs(Math.sin(ang)) > Math.abs(Math.cos(ang));
        const cells = [];
        for (let k = -1; k <= 1; k++) { const cx = tx + (hor ? k : 0), cy = ty + (hor ? 0 : k); if (this.canBuildAt(cx, cy, p)) { World.setOb(cx, cy, OB.EBARRIER); cells.push([cx, cy]); } }
        this.fx.push({ type: 'barrierT', cells, t: 0, life: 7 });
        Sfx.play('zap', this.vol(p.x, p.y));
        break;
      }
    }
  },

  /* ------------------------------ 弾 ------------------------------ */
  updateBullets(dt) {
    const keep = [];
    for (const b of this.bullets) {
      b.t += dt;
      if (b.kind === 'grenade') { if (this.stepGrenade(b, dt)) keep.push(b); continue; }
      // ホーミング
      if ((b.w.homing || b.w.guided) && b.t > 0.08) {
        let tx = null, ty = null;
        if (b.w.guided) { const ap = this.aimPoint(b.owner); tx = ap.x; ty = ap.y; }
        else {
          let best = null, bd = 520 * 520;
          for (const q of this.near(b.x, b.y, 520)) {
            if (q === b.owner || q.air || (b.hits && b.hits.has(q))) continue;
            const d = dist2(q.x, q.y, b.x, b.y);
            if (d < bd && Math.abs(angDiff(Math.atan2(b.vy, b.vx), Math.atan2(q.y - b.y, q.x - b.x))) < 1.4) { bd = d; best = q; }
          }
          if (best) { tx = best.x; ty = best.y; }
        }
        if (tx !== null) {
          const a = Math.atan2(b.vy, b.vx), want = Math.atan2(ty - b.y, tx - b.x);
          const turn = (b.w.homing || 3.5) * dt;
          const na = a + clamp(angDiff(a, want), -turn, turn);
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
      }
      if (b.kind === 'boomerang') {
        if (b.out && b.d >= b.range) { b.out = false; b.hits.clear(); }
        if (!b.out) {
          const o = b.owner, d = dist(b.x, b.y, o.x, o.y);
          if (d < 24 || !o.alive) continue;
          const sp = b.w.spd;
          b.vx = ((o.x - b.x) / d) * sp; b.vy = ((o.y - b.y) / d) * sp;
          b.d = 0;
        }
      }
      if (b.kind === 'rocket' && Math.random() < 0.7) this.parts.push({ type: 'smoke', x: b.x, y: b.y, t: 0, life: 0.6, r: 5 });
      if (b.kind === 'flame') { b.rad += dt * 30; }
      const sp = Math.hypot(b.vx, b.vy);
      const len = sp * dt;
      const n = Math.max(1, Math.ceil(len / 14));
      const hx = b.vx * dt / n, hy = b.vy * dt / n;
      let alive = true;
      for (let s = 0; s < n && alive; s++) {
        const px = b.x, py = b.y;
        b.x += hx; b.y += hy; b.d += len / n;
        const tx = Math.floor(b.x / TILE), ty = Math.floor(b.y / TILE);
        if (World.solid(tx, ty) && b.kind !== 'boomerang') {
          const ti = ty * MW + tx;
          if (b.w.wallP) { if (b.lastTile !== ti) { b.lastTile = ti; this.damageTile(tx, ty, b.dmg * (b.w.build || 1), b.owner); } }
          else if (b.kind === 'grapple') { b.owner.pull = { x: px, y: py, t: 1.2 }; alive = false; }
          else if (b.bounce > 0) {
            b.bounce--;
            const ptx = Math.floor(px / TILE), pty = Math.floor(py / TILE);
            if (ptx !== tx) b.vx = -b.vx; if (pty !== ty) b.vy = -b.vy;
            if (ptx === tx && pty === ty) { b.vx = -b.vx; b.vy = -b.vy; }
            b.x = px; b.y = py;
            break;
          } else {
            if (b.kind !== 'flame' || Math.random() < 0.3) this.damageTile(tx, ty, b.dmg * (b.w.build || 1) * (b.kind === 'flame' ? 3 : 1), b.owner);
            if (b.w.ex) this.explode(px, py, b.owner, b.w, b.r, b.dmg);
            else if (b.w.hole) this.fx.push({ type: 'hole', x: px, y: py, owner: b.owner, t: 0, life: 2.6 });
            else this.puff(px, py, b.kind === 'flame' ? b.col : '#d8d0c0', 3);
            alive = false;
          }
          continue;
        }
        if (b.kind === 'boomerang' && World.solid(tx, ty) && b.out) { b.out = false; b.hits.clear(); }
        // プレイヤーに あたったか
        for (const q of this.near(b.x, b.y, 40)) {
          if (q === b.owner || q.air || (b.hits && b.hits.has(q))) continue;
          const rr2 = (q.r + b.rad) * (q.r + b.rad);
          if (dist2(b.x, b.y, q.x, q.y - 2) > rr2) continue;
          if (b.kind === 'grapple') { b.owner.pull = { x: q.x, y: q.y, t: 1.0 }; alive = false; break; }
          if (b.w.ex) { this.explode(b.x, b.y, b.owner, b.w, b.r, b.dmg, q); alive = false; break; }
          this.applyHit(q, b.owner, b.w, b.r, b.dmg, Math.atan2(b.vy, b.vx));
          if (b.w.hole) { this.fx.push({ type: 'hole', x: b.x, y: b.y, owner: b.owner, t: 0, life: 2.6 }); alive = false; break; }
          if (b.pierce > 0 || b.kind === 'flame' || b.kind === 'boomerang') { b.pierce--; if (!b.hits) b.hits = new Set(); b.hits.add(q); if (b.kind === 'flame' || b.kind === 'boomerang') b.pierce = 9; }
          else { alive = false; }
          break;
        }
        if (!alive) break;
        for (const f of this.fx) if (f.type === 'turret' && !f.dead && f.owner !== b.owner && dist2(b.x, b.y, f.x, f.y) < 18 * 18) { this.hurtFx(f, b.dmg); if (b.w.ex) this.explode(b.x, b.y, b.owner, b.w, b.r, b.dmg); alive = false; break; }
      }
      if (alive && b.kind !== 'boomerang' && b.d >= b.range) {
        if (b.w.ex && (b.kind === 'rocket' || b.kind === 'orb' || b.kind === 'arrow')) this.explode(b.x, b.y, b.owner, b.w, b.r, b.dmg);
        else if (b.w.hole) this.fx.push({ type: 'hole', x: b.x, y: b.y, owner: b.owner, t: 0, life: 2.6 });
        alive = false;
      }
      if (alive) keep.push(b);
    }
    this.bullets = keep;
  },

  stepGrenade(b, dt) {
    if (b.stuck) {
      if (b.stuck.alive) { b.x = b.stuck.x + b.sox; b.y = b.stuck.y + b.soy; }
      else b.stuck = null;
    } else if (!b.landed) {
      const px = b.x, py = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.z = Math.sin(Math.PI * clamp(b.t / b.flyT, 0, 1)) * 40;
      const tx = Math.floor(b.x / TILE), ty = Math.floor(b.y / TILE);
      if (World.solid(tx, ty) && b.z < 30) {
        if (b.w.sticky) { b.x = px; b.y = py; b.landed = true; }
        else { if (Math.floor(px / TILE) !== tx) b.vx *= -0.5; if (Math.floor(py / TILE) !== ty) b.vy *= -0.5; b.x = px; b.y = py; }
      }
      if (b.w.sticky || b.w.fuse === 0) {
        for (const q of this.near(b.x, b.y, 30)) {
          if (q === b.owner || q.air) continue;
          if (dist2(b.x, b.y, q.x, q.y) < (q.r + 6) ** 2) {
            if (b.w.sticky) { b.stuck = q; b.sox = b.x - q.x; b.soy = b.y - q.y; }
            else { b.landed = true; }
            break;
          }
        }
      }
      if (b.t >= b.flyT) { b.landed = true; b.z = 0; }
    }
    const fuse = b.w.fuse ?? 1.5;
    if ((b.landed || b.stuck) && b.t >= Math.max(fuse, b.landed && fuse === 0 ? 0 : fuse)) {
      this.detonate(b);
      return false;
    }
    return true;
  },
  detonate(b) {
    const w = b.w;
    if (w.area) {
      const life = { smoke: 9, fire: 5, sleep: 4, heal: 6 }[w.area];
      this.fx.push({ type: w.area, x: b.x, y: b.y, owner: b.owner, t: 0, life, r: w.area === 'fire' ? 90 : 120 });
      if (w.area === 'fire') Sfx.play('flame', this.vol(b.x, b.y));
      else this.puff(b.x, b.y, '#ffffff', 10);
      return;
    }
    if (w.hole) { this.fx.push({ type: 'hole', x: b.x, y: b.y, owner: b.owner, t: 0, life: 3 }); return; }
    this.explode(b.x, b.y, b.owner, w, b.r, b.dmg);
  },

  explode(x, y, owner, w, r, dmg, direct) {
    const R = w.ex || 60;
    this.parts.push({ type: 'boom', x, y, t: 0, life: 0.45, r: R, col: w.col });
    for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, s = rand(60, 260); this.parts.push({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.3, 0.6), col: pick(['#ffd23a', '#ff8a2a', '#ffffff', w.col || '#ff5a2a']) }); }
    const v = this.vol(x, y);
    if (w.freeze || w.stun || w.knock) Sfx.play('zap', v); else Sfx.play('boom', v);
    if (v > 0.3) this.shake = Math.max(this.shake, 14 * v);
    for (const q of this.near(x, y, R + 20)) {
      if (q.air) continue;
      const d = dist(x, y, q.x, q.y);
      if (d > R + q.r) continue;
      const k = q === direct ? 1 : 1 - 0.5 * clamp(d / R, 0, 1);
      const a = Math.atan2(q.y - y, q.x - x);
      if (q === owner) { if (w.selfKnock) { q.kx += Math.cos(a) * w.knock; q.ky += Math.sin(a) * w.knock; } continue; }
      if (dmg > 0) this.applyHit(q, owner, w, r, dmg * k, a, true);
      else this.applyStatus(q, owner, w, a);
    }
    for (const f of this.fx) if (f.type === 'turret' && !f.dead && f.owner !== owner && dist(x, y, f.x, f.y) < R) this.hurtFx(f, dmg);
    // たてもの
    if (dmg > 0) {
      const t0x = Math.floor((x - R) / TILE), t1x = Math.floor((x + R) / TILE), t0y = Math.floor((y - R) / TILE), t1y = Math.floor((y + R) / TILE);
      for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
        if (!OBD[World.obAt(tx, ty)].hp) continue;
        const d = dist(x, y, (tx + 0.5) * TILE, (ty + 0.5) * TILE);
        if (d < R + 10) this.damageTile(tx, ty, dmg * (w.build || 1.5) * (1 - 0.4 * d / R), owner);
      }
    }
    if (w.split) {
      for (let i = 0; i < w.split; i++) {
        const a = Math.random() * TAU, dd = rand(60, 150);
        const mini = Object.assign({}, w, { split: 0, ex: R * 0.6, fuse: 0.5 });
        this.bullets.push({ x, y, vx: (Math.cos(a) * dd) / 0.4, vy: (Math.sin(a) * dd) / 0.4, owner, w: mini, r, dmg: dmg * 0.45, kind: 'grenade', flyT: 0.4, t: 0, landed: false, z: 0, rad: 4, col: '#ffd23a' });
      }
    }
  },

  applyHit(q, src, w, r, dmg, ang, fromBlast) {
    if (dmg > 0) this.hurt(q, dmg, src, { w });
    this.applyStatus(q, src, w, ang, fromBlast);
    if (w.chain && !fromBlast) this.chain(q, src, w, r, dmg * 0.7, w.chain, new Set([q, src]));
  },
  applyStatus(q, src, w, ang) {
    if (!q.alive) return;
    if (w.burn && !(q.st.wet > 0)) { q.st.burn = Math.max(q.st.burn, w.burn); q.burnBy = src; }
    if (w.poison) { q.st.poison = Math.max(q.st.poison, w.poison); q.poisonBy = src; }
    if (w.freeze) q.st.freeze = Math.max(q.st.freeze, w.freeze);
    if (w.stun) q.st.stun = Math.max(q.st.stun, w.stun);
    if (w.wet) { q.st.wet = 3; q.st.burn = 0; }
    if (w.knock && !q.dummyNoKnock) { q.kx += Math.cos(ang) * w.knock; q.ky += Math.sin(ang) * w.knock; }
  },
  chain(from, src, w, r, dmg, left, seen) {
    if (left <= 0) return;
    let best = null, bd = 230 * 230;
    for (const q of this.near(from.x, from.y, 230)) {
      if (seen.has(q) || q.air) continue;
      const d = dist2(q.x, q.y, from.x, from.y);
      if (d < bd) { bd = d; best = q; }
    }
    if (!best) return;
    seen.add(best);
    this.beams.push({ x0: from.x, y0: from.y - 4, x1: best.x, y1: best.y - 4, t: 0, life: 0.2, col: '#bfe8ff', wd: 2, zig: true });
    this.hurt(best, dmg, src, { w });
    if (w.stun) best.st.stun = Math.max(best.st.stun, w.stun * 0.5);
    this.chain(best, src, w, r, dmg * 0.8, left - 1, seen);
  },

  /* ダメージ */
  hurt(q, amt, src, opt = {}) {
    if (!q.alive || q.air || this.over) return;
    if (src && src.dummy) return;
    amt = Math.max(0, amt);
    // コンピューターどうしの ダメージは へらして しあいを ながく たのしめるように する
    if (src && src.bot && q.bot && !this.training) amt *= 0.32;
    let shDmg = 0;
    if (!opt.noShield && !opt.zone && q.sh > 0) { shDmg = Math.min(q.sh, amt); q.sh -= shDmg; amt -= shDmg; }
    q.hp -= amt;
    q.lastHurt = this.t;
    q.heal = null;
    if (src && src !== q) { q.lastHitBy = src; q.ai.hurtBy = src; q.ai.hurtT = this.t; }
    const total = Math.round(amt + shDmg);
    if (src === this.me && total > 0) {
      this.text(q.x + rand(-8, 8), q.y - 36, String(total), shDmg > amt ? '#7ad0ff' : opt.dot ? '#ffb08a' : '#ffffff', opt.dot ? 13 : 17);
      Sfx.play(shDmg > amt ? 'shieldhit' : 'hit');
    }
    if (q === this.me && total > 0) {
      this.hurtFlash = Math.min(1, this.hurtFlash + 0.35);
      if (src && src !== q) this.hurtDir = { a: Math.atan2(src.y - q.y, src.x - q.x), t: this.t };
    }
    if (q.dummy) { if (q.hp <= 0) { q.hp = 100; q.sh = 100; if (src === this.me) this.text(q.x, q.y - 52, 'たおした！', '#ffd23a', 20); } return; }
    if (q.hp <= 0) this.kill(q, src || q.lastHitBy, opt);
  },
  kill(q, killer, opt) {
    q.alive = false; q.hp = 0;
    q.deathT = this.t;
    this.alive--;
    q.place = this.alive + 1;
    const items = q.inv.filter(Boolean);
    for (const k in q.ammo) if (q.ammo[k] > 0) items.push({ kind: 'ammo', id: k, n: Math.min(q.ammo[k], 60) });
    for (const m of MATS) if (q.mats[m.id] > 0) items.push({ kind: 'mat', id: m.id, n: Math.min(q.mats[m.id], 100) });
    this.spawnLoot(q.x, q.y, items);
    for (let i = 0; i < 18; i++) { const a = Math.random() * TAU, s = rand(40, 200); this.parts.push({ type: 'spark', x: q.x, y: q.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.4, 0.8), col: pick([q.skin.c1, q.skin.c2, '#ffffff']) }); }
    let msg;
    if (killer && killer !== q && killer.alive !== undefined) {
      killer.kills++;
      const wn = opt.w ? opt.w.name : '';
      msg = `${killer.name} が ${q.name} を たおした${wn ? `（${wn}）` : ''}`;
      if (killer === this.me) { Sfx.play('kill'); this.say(`${q.name} を たおした！  のこり ${this.alive}人`, '#ffd23a', 2); }
    } else msg = opt.zone ? `${q.name} は ゾーンに のまれた` : `${q.name} が たおれた`;
    this.feed.unshift({ msg, t: this.t, me: killer === this.me || q === this.me });
    if (this.feed.length > 6) this.feed.length = 6;
    if (q === this.me) { Sfx.play('lose'); this.endMatch(false); return; }
    if (this.alive <= 1 && this.me.alive) { Sfx.play('win'); this.endMatch(true); }
  },
  endMatch(win) {
    this.over = true;
    const me = this.me;
    const place = win ? 1 : me.place;
    const bonus = place === 1 ? 300 : place <= 5 ? 150 : place <= 10 ? 100 : place <= 25 ? 50 : 20;
    const coins = bonus + me.kills * 15;
    const d = Save.d;
    d.coins += coins; d.games++; d.kills += me.kills;
    if (win) d.wins++;
    d.best = d.best ? Math.min(d.best, place) : place;
    Save.write();
    setTimeout(() => UI.showResult({ win, place, kills: me.kills, coins, total: this.players.length }), win ? 1200 : 900);
  },

  hurtFx(f, dmg) { f.hp -= dmg; if (f.hp <= 0) { f.dead = true; this.puff(f.x, f.y, '#5a8ac8', 12); Sfx.play('break', this.vol(f.x, f.y)); } },

  damageTile(tx, ty, dmg, src) {
    if (!World.inb(tx, ty)) return;
    const i = ty * MW + tx;
    const o = World.ob[i];
    const D = OBD[o];
    if (!D.hp) return;
    World.hp[i] -= dmg;
    if (World.hp[i] <= 0) {
      World.ob[i] = 0; World.hp[i] = 0;
      const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
      this.puff(cx, cy, o === OB.TREE || o === OB.PINE || o === OB.BUSH ? '#4ab04a' : '#c8b8a0', 10);
      Sfx.play('break', this.vol(cx, cy));
      if (o === OB.CARL) this.damageTile(tx + 1, ty, 9999, src);
      if (o === OB.CARR) this.damageTile(tx - 1, ty, 9999, src);
      if (o === OB.BARREL) this.explode(cx, cy, src, { ex: 100, build: 2, col: '#ff5a2a' }, 0, 60);
      if (o === OB.CRATE && Math.random() < 0.5) this.spawnLoot(cx, cy, this.rollFloorLoot(0));
      if (o === OB.EBARRIER) { /* きえるだけ */ }
    }
  },

  /* ------------------------------ 建築 ------------------------------ */
  buildCells(p) {
    const ang = p.aim;
    const x = p.x + Math.cos(ang) * 46, y = p.y + Math.sin(ang) * 46;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (!p.shape) return [[tx, ty]];
    const hor = Math.abs(Math.sin(ang)) > Math.abs(Math.cos(ang));
    return [-1, 0, 1].map((k) => [tx + (hor ? k : 0), ty + (hor ? 0 : k)]);
  },
  canBuildAt(tx, ty, p) {
    if (!World.inb(tx, ty)) return false;
    const o = World.ob[ty * MW + tx];
    if (o && o !== OB.BUSH) return false;
    const g = World.gr[ty * MW + tx];
    if (g === GR.OCEAN) return false;
    const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
    for (const q of this.near(cx, cy, 60)) if (Math.abs(q.x - cx) < TILE / 2 + q.r - 2 && Math.abs(q.y - cy) < TILE / 2 + q.r - 2) return false;
    return true;
  },
  tryBuild(p) {
    if ((p.buildCd || 0) > this.t) return false;
    const m = MATS[p.matSel || 0];
    let built = 0;
    for (const [tx, ty] of this.buildCells(p)) {
      if (p.mats[m.id] < BUILD_COST) break;
      if (!this.canBuildAt(tx, ty, p)) continue;
      const o = [OB.BWOOD, OB.BSTONE, OB.BMETAL][p.matSel || 0];
      World.setOb(tx, ty, o);
      World.hp[ty * MW + tx] = Math.round(OBD[o].hp * 0.3);
      this.growing.push({ tx, ty, o, rate: (OBD[o].hp * 0.7) / m.grow });
      p.mats[m.id] -= BUILD_COST;
      built++;
    }
    if (built) { Sfx.play('build', this.vol(p.x, p.y)); p.buildCd = this.t + 0.12; }
    else if (p === this.me && p.mats[m.id] < BUILD_COST && Input.mclick) this.say(`${m.name}が たりない！`, '#ffffff', 1);
    return built > 0;
  },
  updateGrowing(dt) {
    this.growing = this.growing.filter((g) => {
      const i = g.ty * MW + g.tx;
      if (World.ob[i] !== g.o) return false;
      World.hp[i] = Math.min(OBD[g.o].hp, World.hp[i] + g.rate * dt);
      return World.hp[i] < OBD[g.o].hp;
    });
  },

  /* ------------------------------ ばめんの こうか ------------------------------ */
  updateFx(dt) {
    for (const f of this.fx) {
      if (f.dead) continue;
      f.t += dt;
      if (f.life && f.t >= f.life) { f.dead = true; if (f.type === 'barrierT') for (const [x, y] of f.cells) if (World.obAt(x, y) === OB.EBARRIER) World.setOb(x, y, OB.NONE); continue; }
      switch (f.type) {
        case 'mine': f.arm -= dt; break;
        case 'fire':
          for (const q of this.near(f.x, f.y, f.r)) if (!q.air && dist(q.x, q.y, f.x, f.y) < f.r && q !== f.owner) { q.st.burn = Math.max(q.st.burn, 1.5); q.burnBy = f.owner; }
          if (Math.random() < 0.6) this.parts.push({ type: 'fire', x: f.x + rand(-f.r, f.r) * 0.8, y: f.y + rand(-f.r, f.r) * 0.6, t: 0, life: 0.5 });
          break;
        case 'sleep': for (const q of this.near(f.x, f.y, f.r)) if (!q.air && q !== f.owner && dist(q.x, q.y, f.x, f.y) < f.r) q.st.stun = Math.max(q.st.stun, 0.4); break;
        case 'heal': for (const q of this.near(f.x, f.y, f.r)) if (!q.air && dist(q.x, q.y, f.x, f.y) < f.r) healP(q, 12 * dt, q.hp >= 100 ? 8 * dt : 0, 100, 100); break;
        case 'hole':
          for (const q of this.near(f.x, f.y, 240)) {
            if (q === f.owner || q.air) continue;
            const d = dist(q.x, q.y, f.x, f.y);
            if (d < 240 && d > 4) { World.moveCircle(q, ((f.x - q.x) / d) * 280 * dt, ((f.y - q.y) / d) * 280 * dt); }
            if (d < 60 && (this.t * 4 | 0) !== ((this.t - dt) * 4 | 0)) this.hurt(q, 6, f.owner, { w: WEAPONS.blackholegun });
          }
          break;
        case 'turret': {
          f.cd -= dt;
          let best = null, bd = 460 * 460;
          for (const q of this.near(f.x, f.y, 460)) {
            if (q === f.owner || q.air || !q.alive) continue;
            const d = dist2(q.x, q.y, f.x, f.y);
            if (d < bd && World.los(f.x, f.y, q.x, q.y)) { bd = d; best = q; }
          }
          if (best) {
            f.aim = Math.atan2(best.y - f.y, best.x - f.x);
            if (f.cd <= 0) {
              f.cd = 0.33;
              const a = f.aim + rand(-0.06, 0.06);
              this.bullets.push({ x: f.x + Math.cos(a) * 16, y: f.y + Math.sin(a) * 16, vx: Math.cos(a) * 1300, vy: Math.sin(a) * 1300, owner: f.owner, w: WEAPONS.toyturret, r: f.r, dmg: 12 * RARITY[f.r].dmg, kind: 'bullet', d: 0, range: 500, pierce: 0, bounce: 0, t: 0, rad: 3, col: '#ffd23a' });
              Sfx.play('shotS', this.vol(f.x, f.y));
            }
          }
          break;
        }
        case 'supply':
          if (!f.landed) { f.z -= dt / 6; if (f.z <= 0) { f.z = 0; f.landed = true; this.puff(f.x, f.y, '#ffffff', 14); } }
          break;
      }
    }
    if (this.fx.length > 60 || this.t % 3 < dt) this.fx = this.fx.filter((f) => !f.dead);
  },
  updateParts(dt) {
    for (const p of this.parts) { p.t += dt; if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; } }
    this.parts = this.parts.filter((p) => p.t < p.life);
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    for (const t of this.texts) { t.t += dt; t.y -= dt * 30; }
    this.texts = this.texts.filter((t) => t.t < 0.9);
    for (const b of this.beams) b.t += dt;
    this.beams = this.beams.filter((b) => b.t < b.life);
  },
  puff(x, y, col, n) {
    if (this.vol(x, y) <= 0) return;
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = rand(30, 140); this.parts.push({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.25, 0.5), col }); }
  },
  text(x, y, s, col = '#ffffff', size = 16) { this.texts.push({ x, y, s, col, size, t: 0 }); },
  say(text, col = '#ffffff', t = 2.2) { this.banner = { text, col, t, small: true }; },
};

/* ------------------------------ プレイヤーの かたち ------------------------------ */
function makePlayer(id, name, skin, bot) {
  return {
    id, name, skin, bot, x: WORLD_W / 2, y: WORLD_H / 2, r: 13, hp: 100, sh: 0, alive: true,
    inv: [null, null, null, null, null], sel: 0,
    ammo: { light: 0, medium: 0, heavy: 0, shells: 0, rocket: 0, energy: 0, arrow: 0 },
    mats: { wood: 0, stone: 0, metal: 0 }, matSel: 0, shape: 0,
    aim: 0, face: 1, walk: 0, moving: false, kx: 0, ky: 0, pull: null,
    cd: 0, reload: 0, reloadMax: 1, burst: 0, burstT: 0, burstW: null, spin: 0, charge: 0, charging: false,
    st: { burn: 0, freeze: 0, poison: 0, stun: 0, wet: 0 }, dotT: 0, hotT: 0,
    kills: 0, air: null, z: 0, heal: null, buildMode: false, glider: 'umbrella',
    ai: { mx: 0, my: 0, fire: false, release: false, think: Math.random() * 0.3 }, lastHitBy: null,
  };
}
function curItem(p) {
  if (p.sel === 0) return { kind: 'w', id: 'pickaxe', r: 0, mag: 0 };
  return p.inv[p.sel - 1];
}
function healP(p, hp, sh, maxHp = 100, maxSh = 100) {
  if (hp && p.hp < maxHp) p.hp = Math.min(maxHp, p.hp + hp);
  if (sh && p.sh < maxSh) p.sh = Math.min(maxSh, p.sh + sh);
}
function markSeen(id) {
  const d = Save.d;
  if (!d.seen.includes(id)) { d.seen.push(id); Save.write(); }
}
function currentSkin() {
  const d = Save.d;
  if (d.skin && d.skin.startsWith('custom')) { const c = d.custom[+d.skin.slice(6)]; if (c) return c; }
  return SKIN_BY_ID[d.skin] || SKINS[0];
}
function randomSkin() {
  const L = PART_LISTS;
  return S('rnd', 'ランダム', 0, 0, {
    tone: pick(SKIN_TONES), hair: pick(L.hair), hairC: pick(COLOR_SWATCH), head: pick(L.head), headC: pick(COLOR_SWATCH),
    eyes: pick(L.eyes), c1: pick(COLOR_SWATCH), c2: pick(COLOR_SWATCH), pat: pick(L.pat), legs: pick(COLOR_SWATCH), shoes: pick(COLOR_SWATCH),
    back: pick(L.back), backC: pick(COLOR_SWATCH), fx: 'none',
  });
}
