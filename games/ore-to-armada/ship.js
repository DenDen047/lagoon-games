/* =========================================================================
   ORE TO ARMADA ― 船の中の仕組み
   電力 / 酸素と部屋 / ドア / 精錬と組立 / 修理アーム / バリア / 燃料 / 恒星の熱
   ========================================================================= */
'use strict';

const PRIO = ['life', 'shield', 'weapon', 'thrust', 'prod'];

const Ship = {
  solarFactor(x, y) { const d = Math.hypot(x, y); return clamp(1.25 - d / 1200, 0.05, 1); },

  /* 1ティックぶんの船の仕組みを進める */
  update(g, dt, env) {
    if (g.terrain || g.dead) return;
    g.updateSys(); g.updateMass();
    if (g.kind === 'gate') return;
    this.power(g, dt, env);
    this.shields(g, dt);
    this.doors(g, dt);
    g.updateRooms(g.rockGrid);
    this.air(g, dt, env);
    this.production(g, dt, env);
    this.repairArms(g, dt, env);
    this.heat(g, dt, env);
    this.regen(g, dt);
    if (g.flash > 0) g.flash -= dt;
  },

  /* ---------- 電力 ----------
     使う順は 太陽 → 核融合 → 水素 → バッテリー。足りなければ PRIO の後ろから止まる。 */
  power(g, dt) {
    const s = g.sys, P = g.power;
    g.h2 = 0; for (const b of s.tanks) g.h2 += b.h2;
    const solar = s.solars.reduce((t, b) => t + b.def.solar, 0) * this.solarFactor(g.x, g.y);
    let genRMax = 0;
    for (const b of s.reactors) {
      if (b.fuel <= 0 && g.invTake('fuel_rod', 1)) b.fuel += b.def.rodTime;
      if (b.fuel > 0) genRMax += b.def.gen;
    }
    const h2Max = s.gens.reduce((t, b) => t + b.def.gen, 0);
    const h2PerPow = s.gens.length ? s.gens[0].def.h2use / s.gens[0].def.gen : 0;
    const genH2Max = h2PerPow > 0 ? Math.min(h2Max, g.h2 / (h2PerPow * dt)) : 0;
    let stored = 0; for (const b of s.batteries) stored += b.charge;
    // 消費の見込み (前のティックの動きから)
    const dem = { life: 0, shield: 0, weapon: g.weaponDraw || 0, thrust: (g.thrUse || 0) + s.gyros.length, prod: 0 };
    if (g.o2Busy) for (const b of s.o2gens) dem.life += b.def.pdraw;
    dem.life += s.medbays.length * 3 + (s.aicore ? 2 : 0) + s.airbarriers.length;
    for (const b of s.shields) if (b.charge < b.def.shieldCap && g.shieldDown <= 0) dem.shield += b.def.pdraw;
    for (const b of s.arcs) if (b.charge < b.def.arcCap) dem.shield += b.def.pdraw;
    for (const b of s.refineries) if (b.job) dem.prod += b.def.pdraw;
    for (const b of s.assemblers) if (b.job != null) dem.prod += b.def.pdraw;
    for (const b of s.repairs) if (b.busy) dem.prod += b.def.pdraw;
    dem.prod += s.dronebays.length * 2;
    const total = PRIO.reduce((t, k) => t + dem[k], 0);
    let need = total;
    const useS = Math.min(need, solar); need -= useS;
    const useR = Math.min(need, genRMax); need -= useR;
    const useH = Math.min(need, genH2Max); need -= useH;
    const useB = Math.min(need, stored / dt); need -= useB;
    const supplied = total - need;
    if (useH > 0) this.takeH2(g, useH * h2PerPow * dt);
    if (genRMax > 0) { const k = useR / genRMax; for (const b of s.reactors) if (b.fuel > 0) b.fuel -= Math.max(0.05, k) * dt; }
    // バッテリー: 使ったぶん減り、太陽と核融合の余りで充電する
    let delta = (solar - useS + genRMax - useR) * dt - useB * dt;
    if (delta > 0) { for (const b of s.batteries) { const k = Math.min(b.def.cap - b.charge, delta); b.charge += k; delta -= k; if (delta <= 0) break; } }
    else if (delta < 0) { let take = -delta; for (const b of s.batteries) { const k = Math.min(b.charge, take); b.charge -= k; take -= k; if (take <= 0) break; } }
    stored = 0; for (const b of s.batteries) stored += b.charge;
    const ratio = {};
    let avail = supplied;
    for (const k of PRIO) { const d = dem[k]; ratio[k] = d <= 0 ? (supplied > 0 || total === 0 ? 1 : 0) : clamp(avail / d, 0, 1); avail = Math.max(0, avail - d); }
    const anySource = solar > 0 || genRMax > 0 || genH2Max > 0 || stored > 0;
    if (!anySource) for (const k of PRIO) ratio[k] = 0;
    P.gen = solar + genRMax + genH2Max; P.use = total; P.stored = stored;
    P.cap = s.batteries.reduce((t, b) => t + b.def.cap, 0);
    P.cat = ratio; P.ratio = !anySource ? 0 : total > 0 ? supplied / total : 1;
    P.thrRatio = ratio.thrust;
    const pw = ratio.life > 0.5;
    for (const b of s.airbarriers) if (b.powered !== pw) { b.powered = pw; g.dirtyRooms = true; }
    g.weaponDraw = 0;
  },
  takeH2(g, amt) {
    for (const b of g.sys.tanks) { const k = Math.min(b.h2, amt); b.h2 -= k; amt -= k; if (amt <= 0) break; }
    g.h2 = g.sys.tanks.reduce((t, b) => t + b.h2, 0);
  },
  addH2(g, amt) {
    for (const b of g.sys.tanks) { const k = Math.min(b.def.h2cap - b.h2, amt); b.h2 += k; amt -= k; if (amt <= 0) break; }
    g.h2 = g.sys.tanks.reduce((t, b) => t + b.h2, 0);
    return amt;
  },

  /* ---------- バリア ---------- */
  shields(g, dt) {
    const s = g.sys;
    if (g.shieldDown > 0) g.shieldDown -= dt;
    if (g.shieldHit > 0) g.shieldHit -= dt;
    const r = g.power.cat ? g.power.cat.shield : 1;
    if (g.shieldDown <= 0 && g.shieldHit <= 0) for (const b of s.shields) b.charge = Math.min(b.def.shieldCap, b.charge + b.def.shieldRegen * r * dt);
    for (const b of s.arcs) { if (b.hitT > 0) b.hitT -= dt; else b.charge = Math.min(b.def.arcCap, b.charge + b.def.arcRegen * r * dt); }
    g.shield = s.shields.reduce((t, b) => t + b.charge, 0);
  },
  /* バリアで受ける。受けきれなかったダメージを返す */
  absorb(g, dmg) {
    const s = g.sys;
    if (!s || g.shield <= 0 || g.shieldDown > 0) return dmg;
    let rest = dmg;
    for (const b of s.shields) { const k = Math.min(b.charge, rest); b.charge -= k; rest -= k; if (rest <= 0) break; }
    g.shield = s.shields.reduce((t, b) => t + b.charge, 0);
    g.shieldHit = 1; g.shieldFlash = 0.25;
    if (g.shield <= 0.5) { g.shieldDown = 5; Sfx.play('shield', 0.5); }
    return rest;
  },
  /* バリアの楕円 (ローカル座標) */
  shieldShape(g) {
    if (g._shapeAt === g.count && g._shape) return g._shape;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    g.eachBlock((b) => { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
    g._shape = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2 * 1.42 + 1.5, ry: (y1 - y0) / 2 * 1.42 + 1.5 };
    g._shapeAt = g.count;
    return g._shape;
  },

  /* ---------- ドア ----------
     人が近くにいると開く。穴があいた部屋の隣では、人がいなければ閉まる。 */
  doors(g, dt) {
    for (const b of g.sys.doors) {
      const want = b.want > 0;
      const target = want ? 1 : 0;
      const before = b.open > 0.5;
      b.open = clamp(b.open + (target ? 6 : -6) * dt, 0, 1);
      if ((b.open > 0.5) !== before) { g.dirtyRooms = true; if (g.onScreen) Sfx.play('door', 0.4); }
      if (b.want > 0) b.want -= dt;
    }
  },

  /* ---------- 空気 ---------- */
  air(g, dt, env) {
    const s = g.sys;
    let need = 0;
    for (const r of g.rooms) {
      if (r.leak) {
        if (r.air > 0) {
          if (r.breach && r.air / r.size > 0.3 && env && env.onBreach) env.onBreach(g, r);
          r.air = Math.max(0, r.air - Math.max(r.size * 1.5, r.air * 3) * dt);
        }
        r.breach = 0;
      } else if (r.air < r.size) need += r.size - r.air;
      const b = r.leak ? 0 : (r.air / r.size > 0.75 ? 2 : r.air / r.size > 0.25 ? 1 : 0);
      if (r.bucket !== b) { if (r.bucket != null) for (let k = 0; k < r.cells.length; k += 2) g.markChunks(r.cells[k], r.cells[k + 1], r.cells[k], r.cells[k + 1]); r.bucket = b; }
    }
    g.o2Busy = need > 0.02 && s.o2gens.length > 0;
    if (!g.o2Busy) return;
    const pr = g.power.cat ? g.power.cat.life : 1;
    let supply = 0;
    for (const b of s.o2gens) {
      if (pr < 0.3) continue;
      if (b.prog <= 0) { if (g.invTake('ore_ice', 1)) { b.prog = 1; this.addH2(g, 3); } else continue; }
      const rate = 0.34 * pr;               // 氷1つで約3秒
      const k = Math.min(b.prog, rate * dt);
      b.prog -= k; supply += k * 14;
    }
    // 足りない部屋へ、足りない割合に応じて配る
    if (supply > 0) for (const r of g.rooms) if (!r.leak && r.air < r.size) r.air = Math.min(r.size, r.air + supply * (r.size - r.air) / need);
  },

  /* ---------- 精錬と組立 ---------- */
  production(g, dt, env) {
    const s = g.sys;
    if (!s.refineries.length && !s.assemblers.length) return;
    const pr = g.power.cat ? g.power.cat.prod : 1;
    for (const b of s.refineries) {
      if (!b.job) {
        if (g.refineOff) continue;
        const inv = g.invAll();
        const ore = ORE_IDS.find((id) => inv[id] > 0 && REFINE[id] && (id !== 'ore_ice' || (g.h2cap - g.h2 > 10 && (inv[id] > 10 || !s.o2gens.length))));
        if (!ore) continue;
        g.invTake(ore, 1); b.job = ore; b.prog = 0;
      }
      b.prog += dt * pr * b.def.refine;
      const R = REFINE[b.job];
      if (b.prog >= R.t) {
        if (R.h2) this.addH2(g, R.h2);
        else if (g.invAdd(R.out, 1) > 0) { g.invAdd(b.job, 1); }
        b.job = null; b.prog = 0;
      }
    }
    for (const b of s.assemblers) {
      if (b.job == null) {
        const q = (g.asmQueue || []).find((e) => e.n > 0 && canAfford(g, ASSEMBLE[e.r].in));
        if (!q) continue;
        const rec = ASSEMBLE[q.r];
        for (const k in rec.in) g.invTake(k, rec.in[k]);
        q.n--; b.job = q.r; b.prog = 0;
        if (q.n <= 0) g.asmQueue = g.asmQueue.filter((e) => e.n > 0);
      }
      b.prog += dt * pr;
      const rec = ASSEMBLE[b.job];
      if (b.prog >= rec.t) { if (g.invAdd(rec.out, rec.n) > 0 && env && env.dropNear) env.dropNear(g, rec.out, 1); b.job = null; b.prog = 0; }
    }
  },

  /* ---------- 修理アーム ---------- */
  repairArms(g, dt) {
    for (const b of g.sys.repairs) {
      b.busy = false;
      if ((g.power.cat ? g.power.cat.prod : 1) < 0.3) continue;
      if (!b.tgt || b.tgt.dead || b.tgt.hp >= b.tgt.def.hp || g.blocks[b.tgt.i] !== b.tgt) {
        b.tgt = null;
        let best = null, bd = 1e9;
        g.eachBlock((o) => { if (o.hp < o.def.hp) { const d = dist2(o.x, o.y, b.x, b.y); if (d < 36 && d < bd) { bd = d; best = o; } } });
        b.tgt = best;
      }
      if (b.tgt) { if (repairBlock(g, b.tgt, 12 * dt)) b.busy = true; else b.tgt = null; }
    }
  },

  /* ---------- 恒星の熱 ---------- */
  heat(g, dt, env) {
    if (!env || !env.star || g.static) return;
    const d = Math.hypot(g.x, g.y) - env.star.r - g.radius;
    if (d > 60) return;
    g.hot = (g.hot || 0) + dt;
    if (g.hot > 0.5) {
      g.hot = 0;
      const list = g.blocks.filter(Boolean);
      for (let k = 0; k < 3 && list.length; k++) { const b = list[(Math.random() * list.length) | 0]; if (env.damageBlock) env.damageBlock(g, b, 8 + (60 - d) * 0.5, 'beam', null); }
    }
  },

  /* ---------- 群体の再生腺 ---------- */
  regen(g, dt) {
    for (const r of g.sys.regens) {
      r.acc = (r.acc || 0) + dt;
      if (r.acc < 0.5) continue;
      r.acc = 0;
      g.eachBlock((o) => { if (o.hp < o.def.hp && Math.abs(o.x - r.x) < 5 && Math.abs(o.y - r.y) < 5) { o.hp = Math.min(o.def.hp, o.hp + r.def.regen * 0.5); } });
    }
  },
};

/* 修理: 鋼板1枚で耐久100ぶん直す。直せたら true */
function repairBlock(g, b, amt, fromInv) {
  if (b.hp >= b.def.hp) return false;
  const need = Math.min(amt, b.def.hp - b.hp);
  const src = fromInv || g;
  // 鋼板を払えたぶんだけ直す (払えないのに借りがたまらないように)
  let frac = (g.repFrac || 0) + need / 100;
  while (frac >= 1) {
    const ok = src === g ? g.invTake('p_steel', 1) : invTakeP(src, 'p_steel', 1);
    if (!ok) return false;
    frac -= 1;
    g.repFrac = frac;
  }
  g.repFrac = frac;
  b.hp += need;
  if (b.hp >= b.def.hp * 0.75) g.markChunks(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1);
  if ((b.hp / b.def.hp * 4 | 0) !== ((b.hp - need) / b.def.hp * 4 | 0)) g.markChunks(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1);
  return true;
}

function canAfford(g, cost) { for (const k in cost) if (g.invTotal(k) < cost[k]) return false; return true; }

/* 人の持ち物 (背負いかばん) */
function invCountP(p, id) { return p.inv[id] || 0; }
function invUsedP(p) { let n = 0; for (const k in p.inv) n += p.inv[k]; return n; }
function invAddP(p, id, n) { const room = p.invCap - invUsedP(p); const k = Math.min(room, n); if (k > 0) p.inv[id] = (p.inv[id] || 0) + k; return n - k; }
function invTakeP(p, id, n) { const have = p.inv[id] || 0; const k = Math.min(have, n); if (k) { p.inv[id] = have - k; if (!p.inv[id]) delete p.inv[id]; } return k; }
