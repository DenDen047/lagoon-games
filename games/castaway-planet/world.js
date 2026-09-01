/* =========================================================================
   CASTAWAY PLANET ― 惑星の生成と地形
   タイル / 生成 / 当たり判定 / 作物の成長 / 宇宙人の湧き
   ========================================================================= */
'use strict';

const GT = { BASE: 0, ALT: 1, SAND: 2, WATER: 3, ROCK: 4, SOIL: 5 };

/* 宇宙人・在来生物を1体つくる */
function makeAlien(sp, x, y, planet) {
  const d = ALIENS[sp];
  const a = {
    sp, x, y, hp: d.hp, maxhp: d.hp, vx: 0, vy: 0, face: 1,
    state: 'wander', t: Math.random() * 3, cd: 0, hurt: 0, wob: Math.random() * TAU, traded: false,
  };
  if (d.mount) {
    a.tame = 0; a.ridden = false; a.blink = 0; a.chew = 0;
    if (planet && planet.faunaSkin) a.skin = planet.faunaSkin.slice();
  }
  return a;
}

class World {
  constructor(planetIdx, seed) {
    this.pi = planetIdx;
    this.planet = PLANETS[planetIdx];
    this.seed = seed >>> 0;
    this.w = 100;
    this.h = 76;
    this.ground = new Uint8Array(this.w * this.h);
    this.wet = new Float32Array(this.w * this.h);
    this.obj = new Array(this.w * this.h).fill(null);
    this.aliens = [];
    this.shots = [];
    this.spawn = { x: 0, y: 0 };
    this.shipTile = { x: 0, y: 0 };
    this.shipRepaired = false;
    this.generate();
  }

  /* ------------------------------ 生成 ------------------------------ */
  generate() {
    const P = this.planet, rng = new RNG(this.seed);
    const nElev = makeNoise(this.seed);
    const nMoist = makeNoise(this.seed + 977);
    const nOre = makeNoise(this.seed + 4231);

    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const edge = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
        let e = fbm(nElev, x / 17, y / 17, 4);
        const m = fbm(nMoist, x / 11, y / 11, 3);
        if (edge < 3) e = 0.95;                       /* 外周は岩壁で閉じる */
        else if (edge < 6) e = lerp(e, 0.95, (6 - edge) / 3);

        let g;
        if (e < 0.33) g = GT.WATER;
        else if (e < 0.38) g = GT.SAND;
        else if (e > 0.72) g = GT.ROCK;
        else g = m > 0.5 ? GT.BASE : GT.ALT;
        this.ground[i] = g;
      }
    }

    /* 不時着地点: 地面の広いところを探して 9x9 を均す */
    this.spawn = this.findClearing(rng);
    const sx = Math.round(this.spawn.x / TILE), sy = Math.round(this.spawn.y / TILE);
    for (let y = sy - 5; y <= sy + 5; y++) {
      for (let x = sx - 5; x <= sx + 5; x++) {
        if (!this.inBounds(x, y)) continue;
        const i = y * this.w + x;
        if (this.ground[i] === GT.WATER || this.ground[i] === GT.ROCK) this.ground[i] = GT.SAND;
      }
    }

    /* 植物 */
    for (let y = 2; y < this.h - 2; y++) {
      for (let x = 2; x < this.w - 2; x++) {
        const i = y * this.w + x;
        const g = this.ground[i];
        if (g !== GT.BASE && g !== GT.ALT && g !== GT.SAND) continue;
        const cluster = fbm(nMoist, x / 6, y / 6, 2);
        const chance = P.density * (0.35 + cluster * 1.5) * (g === GT.SAND ? 0.4 : 1);
        if (!rng.chance(chance)) continue;
        const treeFirst = rng.chance(P.treeRatio);
        const list = P.plants.filter((p) => (PLANTS[p].form === 'tree') === treeFirst);
        const id = list.length ? rng.pick(list) : rng.pick(P.plants);
        const def = PLANTS[id];
        this.obj[i] = { t: 'plant', id, stage: def.stages - 1, growth: 0, wild: true };
      }
    }

    /* 鉱脈: 岩場を中心に、ノイズの塊で配置する */
    for (let y = 2; y < this.h - 2; y++) {
      for (let x = 2; x < this.w - 2; x++) {
        const i = y * this.w + x;
        if (this.obj[i]) continue;
        const g = this.ground[i];
        const onRock = g === GT.ROCK;
        if (!onRock && g !== GT.BASE && g !== GT.ALT && g !== GT.SAND) continue;
        const v = fbm(nOre, x / 7, y / 7, 3);
        const chance = P.oreDensity * (onRock ? 9 : 1.4) * (0.3 + v * 1.8);
        if (!rng.chance(chance)) continue;
        /* 硬い鉱石ほど岩場の奥に出る */
        const pool = P.ores.filter((o) => (ORES[o].hardness >= 2 ? onRock && v > 0.55 : true));
        const ore = rng.pick(pool.length ? pool : ['stone']);
        this.obj[i] = { t: 'ore', ore, hp: ORES[ore].hp };
      }
    }

    /* 外周の岩壁は掘れない壁にする */
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const edge = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
        if (edge < 2) { const i = y * this.w + x; this.ground[i] = GT.ROCK; this.obj[i] = { t: 'wall' }; }
      }
    }

    /* 墜落した宇宙船 (3x3) と散らばった残骸 */
    this.placeShip(sx, sy - 2);
    for (let k = 0; k < 14; k++) {
      const x = sx + rng.i(-7, 7), y = sy + rng.i(-6, 7);
      if (!this.inBounds(x, y)) continue;
      const i = y * this.w + x;
      if (this.obj[i] || this.ground[i] === GT.WATER) continue;
      this.obj[i] = { t: 'debris', hp: 2 };
    }
    /* 立ち位置は必ず空ける */
    for (let y = sy; y <= sy + 1; y++) for (let x = sx - 1; x <= sx + 1; x++) {
      if (this.inBounds(x, y)) this.obj[y * this.w + x] = null;
    }
    this.spawn = { x: (sx + 0.5) * TILE, y: (sy + 0.9) * TILE };
    this.spawnAliens(true);
  }

  findClearing(rng) {
    let best = null, bestScore = -1;
    for (let k = 0; k < 260; k++) {
      const x = rng.i(12, this.w - 13), y = rng.i(12, this.h - 13);
      let score = 0;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const g = this.ground[(y + dy) * this.w + (x + dx)];
        if (g === GT.BASE || g === GT.ALT) score += 2;
        else if (g === GT.SAND) score += 1;
        else if (g === GT.WATER) score -= 2;
      }
      /* 水が近いほうが暮らしやすい */
      let water = 0;
      for (let dy = -9; dy <= 9; dy += 2) for (let dx = -9; dx <= 9; dx += 2) {
        const yy = y + dy, xx = x + dx;
        if (this.inBounds(xx, yy) && this.ground[yy * this.w + xx] === GT.WATER) water++;
      }
      score += Math.min(water, 8) * 2;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    return { x: (best.x + 0.5) * TILE, y: (best.y + 0.5) * TILE };
  }

  placeShip(cx, cy) {
    this.shipTile = { x: cx, y: cy };
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!this.inBounds(x, y)) continue;
        this.obj[y * this.w + x] = { t: 'ship', anchor: dx === 0 && dy === 0 };
      }
    }
  }

  /* ------------------------------ 参照 ------------------------------ */
  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  idx(tx, ty) { return ty * this.w + tx; }
  groundAt(tx, ty) { return this.inBounds(tx, ty) ? this.ground[this.idx(tx, ty)] : GT.ROCK; }
  objAt(tx, ty) { return this.inBounds(tx, ty) ? this.obj[this.idx(tx, ty)] : { t: 'wall' }; }
  setObj(tx, ty, o) { if (this.inBounds(tx, ty)) this.obj[this.idx(tx, ty)] = o; }

  isSolidTile(tx, ty) {
    if (!this.inBounds(tx, ty)) return true;
    const i = this.idx(tx, ty);
    if (this.ground[i] === GT.WATER) return true;
    const o = this.obj[i];
    if (!o) return false;
    if (o.t === 'plant') return !!(PLANTS[o.id].solid && o.stage >= 2);
    if (o.t === 'station') return true;
    return o.t === 'ore' || o.t === 'ship' || o.t === 'wall' || o.t === 'debris';
  }

  /* 円と地形の当たり判定。軸ごとに押し戻す */
  moveCircle(ent, dx, dy, r) {
    const step = (ax, d) => {
      if (!d) return;
      ent[ax] += d;
      const minTX = Math.floor((ent.x - r) / TILE), maxTX = Math.floor((ent.x + r) / TILE);
      const minTY = Math.floor((ent.y - r) / TILE), maxTY = Math.floor((ent.y + r) / TILE);
      for (let ty = minTY; ty <= maxTY; ty++) {
        for (let tx = minTX; tx <= maxTX; tx++) {
          if (!this.isSolidTile(tx, ty)) continue;
          const L = tx * TILE, T = ty * TILE, R = L + TILE, B = T + TILE;
          if (ent.x + r <= L || ent.x - r >= R || ent.y + r <= T || ent.y - r >= B) continue;
          if (ax === 'x') ent.x = d > 0 ? L - r : R + r;
          else ent.y = d > 0 ? T - r : B + r;
        }
      }
    };
    step('x', dx); step('y', dy);
  }

  /* ---------------------------- タイル操作 ---------------------------- */
  /* 掘る。掘りきったら収穫物を返す */
  mine(tx, ty, hardness, power = 1) {
    const o = this.objAt(tx, ty);
    if (!o || o.t !== 'ore') return null;
    const def = ORES[o.ore];
    if (def.hardness > hardness) return { fail: 'hard', need: def.hardness, name: def.name };
    o.hp -= power;
    FX.burst(tx * TILE + 16, ty * TILE + 16, def.c2, 6, 70, 0.4);
    if (o.hp > 0) return { hit: true };
    this.setObj(tx, ty, null);
    return { drops: def.yield.map((y) => [y[0], y[1]]), name: def.name };
  }

  /* 草・木・残骸を採る */
  gather(tx, ty, opts = {}) {
    const o = this.objAt(tx, ty);
    if (!o) return null;
    if (o.t === 'debris') {
      o.hp -= 1;
      FX.burst(tx * TILE + 16, ty * TILE + 16, '#c8b48a', 5, 60, 0.4);
      if (o.hp > 0) return { hit: true };
      this.setObj(tx, ty, null);
      return { drops: [['scrap', 2]], name: '船の残骸' };
    }
    if (o.t !== 'plant') return null;
    const def = PLANTS[o.id];
    if (def.form === 'tree' && !opts.canChop) return { fail: 'tree', name: def.name };
    if (o.stage < def.stages - 1) return { fail: 'young', name: def.name };
    FX.burst(tx * TILE + 16, ty * TILE + 16, def.c2, 8, 80, 0.5);
    /* 栽培した株は根が残り、次の実りを待てる */
    if (!o.wild && def.form !== 'tree') { o.stage = 1; o.growth = 0; }
    else this.setObj(tx, ty, null);
    const mult = opts.mult || 1;
    return { drops: def.yield.map((y) => [y[0], Math.max(1, Math.round(y[1] * mult))]), name: def.name };
  }

  canTill(tx, ty) {
    if (!this.inBounds(tx, ty)) return false;
    const g = this.ground[this.idx(tx, ty)];
    if (g !== GT.BASE && g !== GT.ALT && g !== GT.SAND) return false;
    return !this.obj[this.idx(tx, ty)];
  }
  till(tx, ty) {
    if (!this.canTill(tx, ty)) return false;
    this.ground[this.idx(tx, ty)] = GT.SOIL;
    FX.burst(tx * TILE + 16, ty * TILE + 16, '#8a6a45', 6, 55, 0.4);
    return true;
  }

  water(tx, ty) {
    if (!this.inBounds(tx, ty)) return false;
    const i = this.idx(tx, ty);
    if (this.ground[i] !== GT.SOIL) return false;
    if (this.wet[i] > 0.85) return false;
    this.wet[i] = 1;
    FX.drip(tx * TILE + 16, ty * TILE + 10, '#7ec8ff', 5);
    return true;
  }

  sow(tx, ty, seedId) {
    if (!this.inBounds(tx, ty)) return false;
    const i = this.idx(tx, ty);
    if (this.ground[i] !== GT.SOIL || this.obj[i]) return false;
    const def = ITEMS[seedId];
    if (!def || def.kind !== 'seed') return false;
    this.obj[i] = { t: 'plant', id: def.plant, stage: 0, growth: 0, wild: false };
    FX.burst(tx * TILE + 16, ty * TILE + 16, '#9fe08a', 4, 40, 0.35);
    return true;
  }

  /* 育ちきった作物だけ刈る */
  harvest(tx, ty) {
    const o = this.objAt(tx, ty);
    if (!o || o.t !== 'plant' || o.wild) return null;
    const def = PLANTS[o.id];
    if (o.stage < def.stages - 1) return null;
    return this.gather(tx, ty, { canChop: true, mult: 1.5 });
  }

  place(tx, ty, stationId) {
    if (!this.inBounds(tx, ty)) return false;
    const i = this.idx(tx, ty);
    const g = this.ground[i];
    if (g === GT.WATER || this.obj[i]) return false;
    const st = { t: 'station', id: stationId };
    if (stationId === 'st_chest') st.items = [];
    if (stationId === 'st_tank') st.water = 40;
    this.obj[i] = st;
    return true;
  }

  /* ---------------------------- 時間の進行 ---------------------------- */
  /* dtHours: このフレームで進んだゲーム内時間 */
  tick(dtHours) {
    if (dtHours <= 0) return;
    const dry = this.planet.dry ? 0.16 : 0.085;
    const slow = this.planet.slowGrow || 1;
    for (let i = 0; i < this.obj.length; i++) {
      if (this.wet[i] > 0) this.wet[i] = Math.max(0, this.wet[i] - dry * dtHours);
      const o = this.obj[i];
      if (!o || o.t !== 'plant' || o.wild) continue;
      const def = PLANTS[o.id];
      if (o.stage >= def.stages - 1) continue;
      if (this.wet[i] <= 0.02) continue;
      o.growth += dtHours / slow;
      if (o.growth >= def.grow) { o.growth = 0; o.stage++; }
    }
  }

  /* ---------------------------- 宇宙人 ---------------------------- */
  targetCount(isNight) {
    const P = this.planet;
    return { hostile: isNight ? P.hostileNight : P.hostileDay, friendly: 3, fauna: 3 };
  }

  spawnAliens(initial, px = null, py = null) {
    const P = this.planet, rng = new RNG((Math.random() * 1e9) | 0);
    const add = (sp, x, y) => { this.aliens.push(makeAlien(sp, x, y, P)); };
    const pick = (minD, maxD) => {
      for (let k = 0; k < 80; k++) {
        const tx = rng.i(3, this.w - 4), ty = rng.i(3, this.h - 4);
        if (this.isSolidTile(tx, ty)) continue;
        const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
        if (px !== null) { const d = dist(x, y, px, py); if (d < minD || d > maxD) continue; }
        return { x, y };
      }
      return null;
    };
    const roster = [P.friendly, P.hostile, (P.fauna || ['gulpa'])[0], P.friendly, P.hostile, (P.fauna || ['gulpa'])[0], P.hostile];
    const n = initial ? roster.length : 1;
    for (let k = 0; k < n; k++) {
      const p = initial ? pick(220, 1e9) : pick(420, 900);
      if (!p) continue;
      add(roster[k % roster.length], p.x, p.y);
    }
  }

  updateAliens(dt, isNight, targets) {
    const want = this.targetCount(isNight);
    let hostile = 0, friendly = 0, fauna = 0;
    for (const a of this.aliens) {
      const d = ALIENS[a.sp];
      if (d.hostile) hostile++; else if (d.mount) fauna++; else friendly++;
    }
    const focus = targets[0];
    this._spawnCd = (this._spawnCd || 0) - dt;
    if (this._spawnCd <= 0) {
      this._spawnCd = 3;
      const P = this.planet;
      if (hostile < want.hostile || friendly < want.friendly || fauna < want.fauna) {
        const sp = hostile < want.hostile ? P.hostile
          : (friendly < want.friendly ? P.friendly : (P.fauna || ['gulpa'])[0]);
        const rng = new RNG((Math.random() * 1e9) | 0);
        for (let k = 0; k < 60; k++) {
          const tx = rng.i(3, this.w - 4), ty = rng.i(3, this.h - 4);
          if (this.isSolidTile(tx, ty)) continue;
          const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
          const d = dist(x, y, focus.x, focus.y);
          if (d < 420 || d > 1000) continue;
          this.aliens.push(makeAlien(sp, x, y, P));
          break;
        }
      }
    }

    for (let i = this.aliens.length - 1; i >= 0; i--) {
      const a = this.aliens[i];
      const def = ALIENS[a.sp];
      a.t -= dt; a.cd -= dt; a.hurt = Math.max(0, a.hurt - dt);
      a.wob += dt * 6;
      if (a.chew > 0) a.chew = Math.max(0, a.chew - dt);
      if (a.ridden) continue;   /* 乗っているあいだは操作側が動かす */
      if (a.hp <= 0) {
        FX.burst(a.x, a.y, def.c2, 12, 110, 0.6);
        this.aliens.splice(i, 1);
        continue;
      }
      /* 遠すぎるものは消える。なついた相棒は消えない */
      if (!a.tame && dist(a.x, a.y, focus.x, focus.y) > 1500) { this.aliens.splice(i, 1); continue; }

      let tgt = null, td = 1e9;
      for (const t of targets) { const d = dist(a.x, a.y, t.x, t.y); if (d < td) { td = d; tgt = t; } }

      /* なついたガルパは、少し離れてついてくる */
      if (def.mount && a.tame >= 100 && tgt) {
        if (td > 90) {
          const ang = Math.atan2(tgt.y - a.y, tgt.x - a.x);
          a.vx = Math.cos(ang) * def.speed * 1.9; a.vy = Math.sin(ang) * def.speed * 1.9;
          a.face = Math.cos(ang) >= 0 ? 1 : -1;
        } else { a.vx *= 0.8; a.vy *= 0.8; }
        this.moveCircle(a, a.vx * dt, a.vy * dt, 13);
        continue;
      }

      if (def.hostile && td < 300) {
        a.state = 'chase';
        const ang = Math.atan2(tgt.y - a.y, tgt.x - a.x);
        if (def.ranged && td < 220) {
          a.vx *= 0.85; a.vy *= 0.85;
          if (a.cd <= 0) {
            a.cd = 1.6;
            this.shots.push({ x: a.x, y: a.y, vx: Math.cos(ang) * 220, vy: Math.sin(ang) * 220, dmg: def.dmg, life: 2.2, foe: true, c: def.c2 });
          }
        } else {
          a.vx = Math.cos(ang) * def.speed; a.vy = Math.sin(ang) * def.speed;
          if (td < 26 && a.cd <= 0) {
            a.cd = 1.1;
            if (tgt.onHit) tgt.onHit(def.dmg, a);
          }
        }
        a.face = Math.cos(ang) >= 0 ? 1 : -1;
      } else {
        if (a.t <= 0) {
          a.t = 1.2 + Math.random() * 2.6;
          if (Math.random() < 0.4) { a.vx = 0; a.vy = 0; }
          else {
            const ang = Math.random() * TAU;
            a.vx = Math.cos(ang) * def.speed * 0.45; a.vy = Math.sin(ang) * def.speed * 0.45;
            a.face = Math.cos(ang) >= 0 ? 1 : -1;
          }
        }
        a.state = 'wander';
      }
      const before = { x: a.x, y: a.y };
      this.moveCircle(a, a.vx * dt, a.vy * dt, 11);
      if (Math.abs(a.x - before.x) < 0.01 && Math.abs(a.y - before.y) < 0.01) { a.vx = 0; a.vy = 0; a.t = Math.min(a.t, 0.2); }
    }

    /* 弾 */
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      const tx = Math.floor(s.x / TILE), ty = Math.floor(s.y / TILE);
      let dead = s.life <= 0 || this.isSolidTile(tx, ty);
      if (!dead) {
        if (s.foe) {
          for (const t of targets) {
            if (dist(s.x, s.y, t.x, t.y) < 14) { if (t.onHit) t.onHit(s.dmg, null); dead = true; break; }
          }
        } else {
          for (const a of this.aliens) {
            if (dist(s.x, s.y, a.x, a.y) < 15) {
              a.hp -= s.dmg; a.hurt = 0.25; dead = true;
              FX.burst(a.x, a.y, '#ffd28a', 5, 60, 0.3);
              if (!ALIENS[a.sp].hostile) a.state = 'flee';
              break;
            }
          }
        }
      }
      if (dead) { FX.burst(s.x, s.y, s.c, 4, 50, 0.25); this.shots.splice(i, 1); }
    }
  }

  /* ---------------------------- セーブ ---------------------------- */
  toJSON() {
    const objs = [];
    for (let i = 0; i < this.obj.length; i++) {
      const o = this.obj[i];
      if (o && o.t !== 'wall') objs.push([i, o]);
    }
    const wet = [];
    for (let i = 0; i < this.wet.length; i++) if (this.wet[i] > 0.02) wet.push([i, Math.round(this.wet[i] * 100) / 100]);
    return {
      pi: this.pi, seed: this.seed,
      ground: Array.from(this.ground).join(''),
      objs, wet,
      aliens: this.aliens.map((a) => ({ sp: a.sp, x: Math.round(a.x), y: Math.round(a.y), hp: a.hp, tame: a.tame || 0, skin: a.skin })),
      shipTile: this.shipTile, spawn: this.spawn, shipRepaired: this.shipRepaired,
    };
  }

  static fromJSON(d) {
    const w = Object.create(World.prototype);
    w.pi = d.pi; w.planet = PLANETS[d.pi]; w.seed = d.seed;
    w.w = 100; w.h = 76;
    w.ground = new Uint8Array(w.w * w.h);
    for (let i = 0; i < w.ground.length; i++) w.ground[i] = +d.ground[i];
    w.wet = new Float32Array(w.w * w.h);
    for (const [i, v] of d.wet) w.wet[i] = v;
    w.obj = new Array(w.w * w.h).fill(null);
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      if (Math.min(x, y, w.w - 1 - x, w.h - 1 - y) < 2) w.obj[y * w.w + x] = { t: 'wall' };
    }
    for (const [i, o] of d.objs) w.obj[i] = o;
    w.aliens = (d.aliens || []).filter((a) => ALIENS[a.sp]).map((a) => {
      const o = makeAlien(a.sp, a.x, a.y, w.planet);
      o.hp = a.hp;
      if (a.tame) o.tame = a.tame;
      if (a.skin) o.skin = a.skin;
      return o;
    });
    w.shots = [];
    w.shipTile = d.shipTile; w.spawn = d.spawn; w.shipRepaired = !!d.shipRepaired;
    return w;
  }
}
