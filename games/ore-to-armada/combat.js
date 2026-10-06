/* =========================================================================
   ORE TO ARMADA ― 戦闘
   敵味方 / 光線と弾の当たり / 砲塔 / ダメージと破壊 / 爆発 / 敵の動き / 無人機 / 回収物
   ========================================================================= */
'use strict';

/* 敵味方。連合と戦うのは評判が下がりすぎたときだけ。 */
function hostile(a, b) {
  if (!a || !b || a === b) return false;
  const p = (x) => x === 'player';
  if (a === 'derelict' || b === 'derelict') return p(a) || p(b);
  if ((p(a) && b === 'union') || (p(b) && a === 'union')) return G.rep < -30;
  if (a === 'swarm' || b === 'swarm') return true;
  if (a === 'pirate' || b === 'pirate') return true;
  return false;
}

/* グリッドのマスを線分に沿ってたどる。cb(i,j,t) が true を返したら止める。
   (ax,ay)-(bx,by) はローカル座標。 */
function ddaGrid(g, ax, ay, bx, by, cb) {
  const dx = bx - ax, dy = by - ay;
  let i = Math.floor(ax), j = Math.floor(ay);
  const si = dx > 0 ? 1 : -1, sj = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tmx = dx !== 0 ? (dx > 0 ? (i + 1 - ax) : (ax - i)) * tdx : Infinity;
  let tmy = dy !== 0 ? (dy > 0 ? (j + 1 - ay) : (ay - j)) * tdy : Infinity;
  let t = 0;
  // 範囲外から入ってくる場合は、グリッドの外枠まで一気に進める
  const x0 = g.minX, y0 = g.minY, x1 = g.minX + g.w, y1 = g.minY + g.h;
  for (let n = 0; n < 2000; n++) {
    if (i >= x0 && j >= y0 && i < x1 && j < y1) { if (cb(i, j, t)) return true; }
    else if ((i < x0 && si < 0) || (i >= x1 && si > 0) || (j < y0 && sj < 0) || (j >= y1 && sj > 0)) return false;
    if (tmx < tmy) { t = tmx; if (t > 1) return false; tmx += tdx; i += si; }
    else { t = tmy; if (t > 1) return false; tmy += tdy; j += sj; }
  }
  return false;
}
/* 線分と円の交わり (最初の t)。なければ -1 */
function segCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay, fx = ax - cx, fy = ay - cy;
  const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const disc = b * b - 4 * a * c;
  if (disc < 0 || a === 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}
/* 点と線分の距離の2乗 */
function segDist2(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
  return dist2(ax + dx * t, ay + dy * t, px, py);
}

const Combat = {
  /* ---------- 線分の当たり ----------
     ワールドの線分 a→b が最初に当たるものを返す: {t, g, i, j, shield, person, drone, missile} */
  trace(ax, ay, bx, by, o) {
    let best = null;
    const fac = o.fac, skip = o.skipGrid;
    for (const g of S.grids) {
      if (g.dead || g === skip || g.kind === 'gate' || (skip && (g.dockedTo === skip || skip.dockedTo === g))) continue;
      if (fac && g.faction === fac) continue;
      if (fac === 'player' && g.faction === 'union' && !hostile('player', 'union') && g.kind !== 'station') continue;
      let rr = g.radius + 3;
      const shieldUp = g.shield > 0 && g.shieldDown <= 0 && !o.noShield && hostile(fac, g.faction);
      if (shieldUp) { const sh = Ship.shieldShape(g); rr = Math.max(rr, Math.hypot(sh.cx - g.comX, sh.cy - g.comY) + Math.max(sh.rx, sh.ry) + 1); }
      if (g.sys && g.sys.arcs.length) rr = Math.max(rr, g.radius + 8);
      if (segDist2(ax, ay, bx, by, g.x, g.y) > rr * rr) continue;
      const la = g.toLocal(ax, ay), lb = g.toLocal(bx, by);
      // 弧のバリア (バリア投射器)
      if (g.sys && g.sys.arcs.length && !o.noShield && hostile(fac, g.faction)) for (const b of g.sys.arcs) {
        if (b.charge < 5) continue;
        const p = g.blockWorld(b);
        const t = segCircle(ax, ay, bx, by, p.x, p.y, 6);
        if (t <= 0 || (best && t >= best.t)) continue;
        const hx = ax + (bx - ax) * t, hy = ay + (by - ay) * t;
        const face = Math.atan2(DIRS[b.r][1], DIRS[b.r][0]) + g.a;
        if (Math.abs(angNorm(Math.atan2(hy - p.y, hx - p.x) - face)) < Math.PI / 4) best = { t, g, arc: b };
      }
      // バリア (敵対しているときだけ)
      if (shieldUp) {
        const sh = Ship.shieldShape(g);
        const ex = (x) => (x - sh.cx) / sh.rx, ey = (y) => (y - sh.cy) / sh.ry;
        const t = segCircle(ex(la.x), ey(la.y), ex(lb.x), ey(lb.y), 0, 0, 1);
        if (t > 0 && (!best || t < best.t)) best = { t, g, shield: true };
      }
      ddaGrid(g, la.x, la.y, lb.x, lb.y, (i, j, t) => {
        if (best && t >= best.t) return true;
        if (!g.occupied(i, j)) return false;
        if (!g.terrain) { const b = g.at(i, j); if (b.def.airBarrier || (o.personShot && (b.def.air === 'room' || (b.def.door && b.open > 0.5)))) return false; }
        best = { t, g, i, j };
        return true;
      });
    }
    // 人
    if (o.persons !== false) for (const p of allPersons()) {
      if (p.dead || (fac && p.faction === fac) || p.hidden) continue;
      const w = personWorld(p);
      const t = segCircle(ax, ay, bx, by, w.x, w.y, 0.42);
      if (t >= 0 && (!best || t < best.t)) best = { t, person: p };
    }
    if (o.drones !== false) for (const d of S.drones) {
      if (d.fac === fac) continue;
      const t = segCircle(ax, ay, bx, by, d.x, d.y, 0.7);
      if (t >= 0 && (!best || t < best.t)) best = { t, drone: d };
    }
    if (o.missiles) for (const m of S.bullets) {
      if (!m.homing || m.fac === fac || m.dead) continue;
      const t = segCircle(ax, ay, bx, by, m.x, m.y, 0.8);
      if (t >= 0 && (!best || t < best.t)) best = { t, missile: m };
    }
    return best;
  },

  /* ---------- ダメージ ---------- */
  hitResult(h, dmg, type, src, x, y) {
    if (!h) return;
    if (h.shield) { Ship.absorb(h.g, dmg * DMG_MUL[type].shield); spark(x, y, '#b9a4ff', 3); return; }
    if (h.arc) { h.arc.charge = Math.max(0, h.arc.charge - dmg * DMG_MUL[type].shield); h.arc.hitT = 1; spark(x, y, '#d8ccff', 3); return; }
    if (h.person) { hurtPerson(h.person, dmg * 0.8, src); spark(x, y, '#ff6a6a', 3); return; }
    if (h.drone) { h.drone.hp -= dmg; spark(x, y, '#ffd24a', 3); return; }
    if (h.missile) { h.missile.hp -= dmg; if (h.missile.hp <= 0) { h.missile.dead = true; boom(h.missile.x, h.missile.y, 1); } return; }
    const g = h.g;
    if (g.terrain) { const t = g.digTerrain(h.i, h.j, dmg * 0.4); if (t) onDug(g, h.i, h.j, t, src); spark(x, y, '#a08870', 2); return; }
    const b = g.at(h.i, h.j);
    if (b) damageBlock(g, b, dmg, type, src);
    spark(x, y, type === 'beam' ? '#ff9ad8' : '#ffd08a', 2);
  },

  /* ---------- 撃つ ---------- */
  fire(g, b, W, ang, src) {
    const p = g.blockWorld(b);
    const len = Math.max(b.w, b.h) * 0.5 + 0.3;
    const x = p.x + Math.cos(ang) * len, y = p.y + Math.sin(ang) * len;
    const v = g.velAt(p.x, p.y);
    if (W.type === 'beam') return;          // 光線は beam() で毎ティック当てる
    const sp = (W.spread || 0) * (b.gunner ? 0.5 : 1) * (src.accMul || 1);
    const a = ang + (Math.random() - 0.5) * 2 * sp;
    const bl = {
      x, y, vx: Math.cos(a) * W.speed + v.x, vy: Math.sin(a) * W.speed + v.y, dmg: W.dmg, type: W.type, fac: g.faction, src: g,
      life: W.range / W.speed * 1.15, big: W.big, kind: b.def.weapon, radius: W.radius || 0, pierce: W.pierce || 0,
    };
    if (W.homing) { bl.homing = true; bl.hp = 12; bl.target = src.target || null; bl.speed = W.speed; }
    if (S.bullets.length < TUNE.maxBullets) S.bullets.push(bl);
    if (g.onScreen) Sfx.play(W.sfx, 0.5);
    muzzle(x, y, ang, b.def.weapon);
  },
  beam(g, b, W, ang, dt, src) {
    const p = g.blockWorld(b);
    const x1 = p.x + Math.cos(ang) * W.range, y1 = p.y + Math.sin(ang) * W.range;
    const h = this.trace(p.x, p.y, x1, y1, { fac: g.faction, skipGrid: g, persons: true });
    const t = h ? h.t : 1;
    const ex = p.x + (x1 - p.x) * t, ey = p.y + (y1 - p.y) * t;
    S.beams.push({ x0: p.x, y0: p.y, x1: ex, y1: ey, c: W.mine ? '#ffcf4a' : b.def.id === 'laser_h' ? '#ff4ab0' : '#ff8ad0', w: W.mine ? 0.18 : W.dps > 50 ? 0.4 : 0.22, hit: !!h });
    if (!h) return;
    if (W.mine && h.g && h.g.terrain) {
      const mul = src.mineMul || 1;
      const tt = h.g.digTerrain(h.i, h.j, W.mine * mul * dt);
      if (tt) onDug(h.g, h.i, h.j, tt, g);
      if (Math.random() < dt * 8) spark(ex, ey, '#ffe08a', 1);
      if (g.onScreen && Math.random() < dt * 6) Sfx.play('mine', 0.3);
      return;
    }
    this.hitResult(h, W.dps * dt, 'beam', g, ex, ey);
  },

  /* ---------- 船の武器 ----------
     aim: 砲塔が狙う点 (手で狙うとき)。fixedFire: 前向きの武器を撃つか */
  weapons(g, dt, ctl) {
    const s = g.sys;
    if (s && s.dronebays.length && !g.disabled) this.pickTargets(g, dt);
    if (!s || (!s.turrets.length && !s.fixed.length && !s.drills.length)) return;
    if (g.disabled || (g.faction !== 'player' && !g.hasControl())) return;
    const wr = g.power.cat ? g.power.cat.weapon : 1;
    const manual = ctl && ctl.aim && ctl.fire;
    if (!manual) this.pickTargets(g, dt);
    for (const b of s.turrets) {
      const W = WEAPONS[b.def.weapon];
      b.cd -= dt; b.firing = false;
      const p = g.blockWorld(b);
      let aimX, aimY, want = false;
      if (manual && !W.pd) { aimX = ctl.aim.x; aimY = ctl.aim.y; want = ctl.fire; }
      else {
        const tg = W.pd ? this.pdTarget(g, p, W) : this.turretTarget(g, p, W);
        if (tg) { aimX = tg.x; aimY = tg.y; want = true; }
      }
      if (aimX == null) continue;
      const desired = Math.atan2(aimY - p.y, aimX - p.x) - g.a;
      const err = angNorm(desired - b.ta);
      const turn = (W.turn || 3) * (b.gunner ? 1.5 : 1) * dt;
      b.ta = angNorm(b.ta + clamp(err, -turn, turn));
      if (!want || Math.abs(err) > 0.2) continue;
      if (W.type === 'beam') {
        if (wr < 0.3) continue;
        g.weaponDraw = (g.weaponDraw || 0) + W.power;
        b.firing = true;
        this.beam(g, b, W, b.ta + g.a, dt, g);
        continue;
      }
      if (b.cd > 0) continue;
      if (!useAmmo(g, W)) { if (g === playerShip() && !g.noAmmoMsg) { g.noAmmoMsg = true; Toast.show('弾がない。部品屋で弾薬箱を買うか、組立機で作る', 'bad'); } continue; }
      b.cd = 1 / W.rof * (b.gunner ? 0.85 : 1);
      this.fire(g, b, W, b.ta + g.a, g);
    }
    for (const b of s.drills) {
      const want = ctl ? ctl.fire : g.fireFixed;
      if (!want) continue;
      // 前のマスに触れているものを掘る・削る
      const f = g.toWorld(b.x + 0.5 + DIRS[b.r][0] * 1.05, b.y + 0.5 + DIRS[b.r][1] * 1.05);
      for (const o of S.grids) {
        if (o === g || o.dead || o.kind === 'gate' || o.invuln || dist2(o.x, o.y, f.x, f.y) > (o.radius + 2) ** 2) continue;
        const q = o.toLocal(f.x, f.y), i = Math.floor(q.x), j = Math.floor(q.y);
        if (!o.occupied(i, j)) continue;
        if (o.terrain) { const t = o.digTerrain(i, j, 100 * (g.mineMul || 1) * dt); if (t) onDug(o, i, j, t, g); }
        else if (o.faction !== g.faction) damageBlock(o, o.at(i, j), 40 * dt, 'kinetic', g);
        if (Math.random() < dt * 10) spark(f.x, f.y, '#e0d0b0', 1);
        if (g.onScreen && Math.random() < dt * 5) Sfx.play('mine', 0.3);
        break;
      }
    }
    for (const b of s.fixed) {
      const W = WEAPONS[b.def.weapon];
      if (!W) continue;
      b.cd -= dt; b.firing = false;
      const ang = Math.atan2(DIRS[b.r][1], DIRS[b.r][0]) + g.a;
      const want = ctl ? ctl.fire && (ctl.fixed !== false) : g.fireFixed;
      if (W.charge) {
        if (want && wr > 0.3 && b.charge < W.charge) { b.charge += dt; g.weaponDraw = (g.weaponDraw || 0) + W.power; }
        if (b.charge >= W.charge && want) { b.charge = 0; this.fire(g, b, W, ang, g); shake(0.4); }
        continue;
      }
      if (!want) continue;
      if (W.type === 'beam') {
        if (wr < 0.2) continue;
        g.weaponDraw = (g.weaponDraw || 0) + W.power;
        b.firing = true;
        this.beam(g, b, W, ang, dt, g);
      }
    }
  },
  pickTargets(g, dt) {
    g.tgtT = (g.tgtT || 0) - dt;
    if (g.tgtT > 0) return;
    g.tgtT = 0.5 + Math.random() * 0.3;
    const list = [];
    for (const o of S.grids) {
      if (o === g || o.dead || o.disabled || o.terrain || !hostile(g.faction, o.faction) || o.kind === 'gate') continue;
      if (o.faction === 'derelict' && g.target !== o) continue;
      const d = dist(o.x, o.y, g.x, g.y) - o.radius;
      if (d < 260) list.push({ o, d });
    }
    list.sort((a, b) => a.d - b.d);
    g.cands = list.slice(0, 4).map((e) => e.o);
  },
  turretTarget(g, p, W) {
    let t = g.target && !g.target.dead && !g.target.disabled ? g.target : null;
    const cand = t ? [t].concat(g.cands || []) : (g.cands || []);
    for (const o of cand) {
      if (o.dead) continue;
      const d = dist(o.x, o.y, p.x, p.y);
      if (d - o.radius * 0.8 > W.range) continue;
      // 近い方のブロックを狙う (大きい船でも外さないように)
      let tx = o.x, ty = o.y;
      if (o.radius > 6) { const l = o.toLocal(p.x, p.y); const q = nearestBlockTo(o, l.x, l.y); if (q) { const w = o.toWorld(q.x + 0.5, q.y + 0.5); tx = w.x; ty = w.y; } }
      if (W.speed && W.type !== 'beam') {
        const tt = dist(tx, ty, p.x, p.y) / W.speed;
        const v = g.velAt(p.x, p.y);
        tx += (o.vx - v.x) * tt; ty += (o.vy - v.y) * tt;
      }
      return { x: tx, y: ty };
    }
    // 敵の人 (乗り込んできた海賊など)
    return null;
  },
  pdTarget(g, p, W) {
    let best = null, bd = W.range * W.range;
    for (const m of S.bullets) {
      if (!m.homing || m.dead || !hostile(g.faction, m.fac)) continue;
      const d = dist2(m.x, m.y, p.x, p.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (best) return { x: best.x, y: best.y };
    for (const d of S.drones) if (hostile(g.faction, d.fac) && dist2(d.x, d.y, p.x, p.y) < W.range * W.range) return { x: d.x, y: d.y };
    return null;
  },

  /* ---------- 弾を進める ---------- */
  bullets(dt) {
    const out = [];
    for (const b of S.bullets) {
      if (b.dead) continue;
      b.life -= dt;
      if (b.life <= 0) { if (b.homing || b.radius) this.detonate(b, b.x, b.y); continue; }
      if (b.homing) {
        let t = b.target && !b.target.dead ? b.target : null;
        if (!t) { let bd = 1e9; for (const g of S.grids) if (!g.dead && !g.terrain && hostile(b.fac, g.faction) && g.kind !== 'gate') { const d = dist2(g.x, g.y, b.x, b.y); if (d < bd && d < 200 * 200) { bd = d; t = g; } } b.target = t; }
        if (t) {
          const want = Math.atan2(t.y - b.y, t.x - b.x), cur = Math.atan2(b.vy, b.vx);
          const na = cur + clamp(angNorm(want - cur), -2.6 * dt, 2.6 * dt);
          b.vx = Math.cos(na) * b.speed; b.vy = Math.sin(na) * b.speed;
        }
        if (Math.random() < 0.5) S.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.5, max: 0.5, c: '#ffb07a', s: 0.35 });
      }
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      const h = this.trace(b.x, b.y, nx, ny, { fac: b.fac, skipGrid: b.src && b.src.isPerson ? null : b.src, missiles: b.kind === 'pd', personShot: b.kind === 'hand' });
      if (h) {
        const hx = b.x + (nx - b.x) * h.t, hy = b.y + (ny - b.y) * h.t;
        if (b.radius && (h.shield || h.arc)) { this.hitResult(h, b.dmg, b.type, b.src, hx, hy); boom(hx, hy, 1); continue; }
        if (b.radius) { this.detonate(b, hx, hy); continue; }
        this.hitResult(h, b.dmg, b.type, b.src, hx, hy);
        if (b.pierce > 0 && h.g && !h.shield) { b.pierce--; b.x = hx + b.vx * 0.02; b.y = hy + b.vy * 0.02; b.dmg *= 0.85; out.push(b); continue; }
        if (h.g && S.onScreenGrid(h.g)) Sfx.play('hit', 0.4);
        continue;
      }
      b.x = nx; b.y = ny;
      out.push(b);
    }
    S.bullets = out;
  },
  detonate(b, x, y) {
    b.dead = true;
    explode(x, y, b.radius || 1.5, b.dmg, b.src, b.fac);
  },
};

function nearestBlockTo(g, lx, ly) {
  // 外周のマスから近いものを探す (全ブロックを回さない)
  g.updateEdge();
  const e = g.edge;
  let best = null, bd = 1e9;
  for (let k = 0; k < e.length; k += 2) { const d = dist2(e[k] + 0.5, e[k + 1] + 0.5, lx, ly); if (d < bd) { bd = d; best = { x: e[k], y: e[k + 1] }; } }
  return best;
}

/* 弾を使う。撃てるなら true */
function useAmmo(g, W) {
  if (W.ammoItem) return g.invTake(W.ammoItem, 1) > 0 || g.faction !== 'player' && g.faction !== 'derelict';
  if (!W.ammo) return true;
  g.ammoFrac = (g.ammoFrac || 0) - W.ammo;
  if (g.ammoFrac >= 0) return true;
  if (g.invTake('ammo', 1)) { g.ammoFrac += 1; return true; }
  if (g.faction !== 'player') { g.ammoFrac = 0; return g.faction !== 'derelict'; }
  g.ammoFrac = 0;
  return false;
}

/* ---------- ブロックのダメージと破壊 ---------- */
function damageBlock(g, b, dmg, type, src) {
  if (g.invuln || b.dead) return;
  const cls = b.def.armor === 'heavy' ? 'heavy' : b.def.armor === 'bio' ? 'bio' : 'normal';
  const before = b.hp;
  b.hp -= dmg * DMG_MUL[type][cls];
  g.flash = 0.08;
  if (src && src.faction) g.lastHitBy = src;
  if ((before / b.def.hp * 4 | 0) !== (Math.max(0, b.hp) / b.def.hp * 4 | 0)) g.markChunks(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1);
  if (b.hp <= 0) destroyBlock(g, b, src);
}
function destroyBlock(g, b, src, quiet) {
  if (b.dead) return;
  const p = g.blockWorld(b);
  g.removeBlock(b);
  // 自分の船が壊されたブロックは予定図に残り、技師や溶接機で建て直せる
  if (!quiet && g.faction === 'player' && (g.kind === 'ship' || g.kind === 'base') && !b.def.noBuild) {
    g.plan = g.plan || [];
    if (!g.plan.some((e) => e[1] === b.x && e[2] === b.y)) g.plan.push([b.def.id, b.x, b.y, b.r]);
  }
  if (!quiet) {
    debrisBurst(p.x, p.y, CAT[b.def.cat] ? CAT[b.def.cat].color : '#999', Math.max(b.w, b.h));
    if (S.onScreenGrid(g)) Sfx.play('hit', 0.6);
  }
  // 誘爆
  let ex = 0;
  if (b.def.id === 'h2tank' && b.h2 > b.def.h2cap * 0.2) ex = b.def.explode;
  else if (b.def.id === 'reactor' && b.fuel > 0) ex = b.def.explode;
  else if (b.def.id === 'ammobox' && b.used > 10) ex = b.def.explode;
  if (ex) setTimeout(() => explode(p.x, p.y, ex, 60 + ex * 40, src, null), 60);
  // 積み荷の半分が散らばる
  if (b.inv && b.used > 0) {
    const items = {};
    for (const k in b.inv) { const n = Math.floor(b.inv[k] / 2); if (n > 0) items[k] = n; }
    if (Object.keys(items).length) dropPickup(p.x, p.y, items, 'salvage', g);
  }
  if (b.occ) ejectFromSeat(b.occ);
  if (b.def.bioCore) { g.updateSys(); if (g.sys.bioCores.length === 0) killBioShip(g, p); }
  checkDisabled(g, src);
  if (g.count === 0) g.dead = true;
}
/* 操縦できなくなった敵の船は「無力化」 */
function checkDisabled(g, src) {
  if (g.disabled || g.terrain || g.static) return;
  g.updateSys();
  const noCtl = g.sys.pilotSeats.length === 0 && g.sys.bioCores.length === 0;
  if (noCtl && (g.faction === 'pirate' || g.faction === 'swarm' || g.faction === 'derelict' || g.faction === 'union')) {
    g.disabled = true;
    if (!g.bountyPaid && g.faction !== 'derelict' && g.faction !== 'union') { g.bountyPaid = true; Econ.onDefeat(g, src); }
  }
}
function killBioShip(g, at) {
  if (g.bioDead) return;
  g.bioDead = true;
  const n = Math.max(1, Math.round(g.count / 60));
  dropPickup(at.x, at.y, { ore_void: n + (g.boss ? 20 : 0) }, 'salvage', g);
  if (!g.bountyPaid) { g.bountyPaid = true; Econ.onDefeat(g, g.lastHitBy); }
  g.faction = null; g.kind = 'debris'; g.name = '群体の死骸'; g.disabled = true;
  boom(at.x, at.y, 3);
}

/* ---------- 爆発 ---------- */
function explode(x, y, r, dmg, src, fac) {
  boom(x, y, r);
  for (const g of S.grids.slice()) {
    if (g.dead || g.invuln || g.kind === 'gate') continue;
    if (dist(g.x, g.y, x, y) > g.radius + r + 1) continue;
    if (fac && g.faction === fac) continue;
    const l = g.toLocal(x, y);
    const blocks = new Set();
    for (let j = Math.floor(l.y - r); j <= Math.ceil(l.y + r); j++) for (let i = Math.floor(l.x - r); i <= Math.ceil(l.x + r); i++) {
      const d = dist(i + 0.5, j + 0.5, l.x, l.y);
      if (d > r) continue;
      const k = 1 - d / (r + 0.5);
      if (g.terrain) { const t = g.digTerrain(i, j, dmg * k * 0.6); if (t) onDug(g, i, j, t, src); continue; }
      const b = g.at(i, j);
      if (b && !blocks.has(b)) { blocks.add(b); if (g.shield > 0 && fac && hostile(fac, g.faction)) { const rest = Ship.absorb(g, dmg * k * 0.5); if (rest <= 0) continue; } damageBlock(g, b, dmg * k, 'blast', src); }
    }
  }
  for (const p of allPersons()) { if (fac && p.faction === fac) continue; const w = personWorld(p); const d = dist(w.x, w.y, x, y); if (d < r + 1) hurtPerson(p, dmg * 0.6 * (1 - d / (r + 1)), src); }
  for (const dr of S.drones) if (dist(dr.x, dr.y, x, y) < r + 1) dr.hp -= dmg;
  if (dist(x, y, Render.cam.x, Render.cam.y) < 60) { Sfx.play('boom', clamp(r / 3, 0.4, 1)); shake(clamp(r * 0.25, 0.2, 1.2)); }
}

/* ---------- 掘ったマス ---------- */
function onDug(g, i, j, t, src) {
  const T = TERRAIN[t];
  const w = g.toWorld(i + 0.5, j + 0.5);
  if (S.onScreenGrid(g)) debrisBurst(w.x, w.y, T.color, 0.6);
  if (!T.ore) return;
  G.stats.mined++;
  // 掘った人・船の貨物に直接入れる。入らなければ浮かせる
  const n = src && src.mineYield ? src.mineYield : 2;
  if (src && src.isPerson) { const rest = invAddP(src, T.ore, n); if (rest > 0) dropPickup(w.x, w.y, { [T.ore]: rest }, 'ore'); else oreFly(w.x, w.y, src); }
  else if (src && src.invAdd && !src.dead) { const rest = src.invAdd(T.ore, n); if (rest > 0) dropPickup(w.x, w.y, { [T.ore]: rest }, 'ore'); else oreFly(w.x, w.y, src); }
  else dropPickup(w.x, w.y, { [T.ore]: n }, 'ore');
  if (src === playerShip() || src === G.player) { Sfx.play('ore', 0.5); Quest.event('mine', T.ore); }
}

/* ---------- 回収物 ---------- */
function dropPickup(x, y, items, kind, fromGrid) {
  const v = fromGrid ? fromGrid.velAt(x, y) : { x: 0, y: 0 };
  S.pickups.push({ x, y, vx: v.x * 0.5 + (Math.random() - 0.5) * 3, vy: v.y * 0.5 + (Math.random() - 0.5) * 3, items, kind: kind || 'salvage', t: 0, id: ++G.nextId });
}
function updatePickups(dt) {
  const keep = [];
  const pl = G.player, ship = playerShip();
  const pw = pl && !pl.dead ? personWorld(pl) : null;
  for (const p of S.pickups) {
    p.t += dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.995; p.vy *= 0.995;
    if (p.kind !== 'grave' && p.t > 300) continue;
    // 主人公が近くにいれば背負いかばんへ、操縦中なら船の貨物へ
    let taker = null;
    if (ship && pl.mode === 'seat' && dist(p.x, p.y, ship.x, ship.y) < ship.radius + 5) taker = ship;
    else if (pw && dist(p.x, p.y, pw.x, pw.y) < 2.2) taker = pl;
    if (taker && p.t > 0.4) {
      let any = false;
      for (const k in p.items) {
        const rest = taker === pl ? invAddP(pl, k, p.items[k]) : ship.invAdd(k, p.items[k]);
        if (rest < p.items[k]) any = true;
        if (rest > 0) p.items[k] = rest; else delete p.items[k];
      }
      if (any) Sfx.play('ore', 0.4);
      if (!Object.keys(p.items).length) { if (p.kind === 'grave') Toast.show('遺品の箱を取り戻した'); continue; }
      if (any === false && !p.fullMsg) { p.fullMsg = true; Toast.show(taker === pl ? '背負いかばんがいっぱい' : '貨物庫がいっぱい', 'bad'); }
    }
    keep.push(p);
  }
  S.pickups = keep;
}

/* ---------- 光と粒 ---------- */
function spark(x, y, c, n) { for (let k = 0; k < n; k++) S.particles.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, life: 0.25, max: 0.25, c, s: 0.25 }); }
function muzzle(x, y, a, kind) { S.particles.push({ x, y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, life: 0.08, max: 0.08, c: '#fff2b0', s: kind === 'cannon' ? 0.9 : 0.5 }); }
function debrisBurst(x, y, c, size) {
  for (let k = 0; k < 6 + size * 3; k++) S.particles.push({ x, y, vx: (Math.random() - 0.5) * 10 * size, vy: (Math.random() - 0.5) * 10 * size, life: 0.6 + Math.random() * 0.6, max: 1.2, c, s: 0.25 + Math.random() * 0.3, rock: true });
}
function boom(x, y, r) {
  S.particles.push({ x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, c: '#fff4c0', s: r * 1.6, flash: true });
  for (let k = 0; k < 10 + r * 8; k++) { const a = Math.random() * TAU, v = Math.random() * 8 * r; S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.7, max: 1.1, c: Math.random() < 0.5 ? '#ff9a4a' : '#ffd24a', s: 0.3 + Math.random() * 0.5 }); }
}
function oreFly(x, y, to) { S.particles.push({ x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, c: '#ffe08a', s: 0.3, to }); }
function updateParticles(dt) {
  const out = [];
  for (const p of S.particles) {
    p.life -= dt;
    if (p.life <= 0) continue;
    if (p.to) { const w = p.to.isPerson ? personWorld(p.to) : p.to; p.x = lerp(p.x, w.x, 0.2); p.y = lerp(p.y, w.y, 0.2); }
    else { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; }
    out.push(p);
  }
  S.particles = out.length > 2500 ? out.slice(out.length - 2500) : out;
}
let shakeAmt = 0;
function shake(a) { shakeAmt = Math.min(1.5, shakeAmt + a); }

/* ---------- 敵の船の動き ---------- */
const AI = {
  ship(g, dt) {
    const c = g.ctrl;
    c.mx = 0; c.my = 0; c.rot = 0; c.face = null; c.assist = true; g.fireFixed = false;
    if (g.disabled || !g.hasControl()) { c.assist = false; return; }
    // 護衛される輸送船: 目的地へまっすぐ向かう
    if (g.escortTo) {
      const dx = g.escortTo.x - g.x, dy = g.escortTo.y - g.y, d = Math.hypot(dx, dy) || 1;
      const l = g.vecToLocal(dx / d * 12 - g.vx, dy / d * 12 - g.vy);
      c.mx = clamp(l.x * 0.35, -1, 1); c.my = clamp(l.y * 0.35, -1, 1); c.face = Math.atan2(dy, dx) + Math.PI / 2;
      return;
    }
    g.aiT = (g.aiT || 0) - dt;
    if (g.aiT <= 0) {
      g.aiT = 0.8 + Math.random() * 0.4;
      let best = null, bd = (g.aggro || 320) ** 2;
      const zone = Planet.zone(g.x, g.y);
      for (const o of S.grids) {
        if (o.dead || o.disabled || o.terrain || o.kind === 'gate' || !hostile(g.faction, o.faction)) continue;
        // 惑星の地上と宇宙は別の場所なので、追いかけない
        if (Planet.zone(o.x, o.y) !== zone) continue;
        if (o.kind === 'station' && g.faction !== 'swarm') continue;
        const d = dist2(o.x, o.y, g.x, g.y) * (o.faction === 'player' ? 0.7 : 1);
        if (d < bd) { bd = d; best = o; }
      }
      g.target = best;
      if (!best && g.home) g.target = null;
    }
    const hull = g.count / (g.startCount || g.count);
    if (!g.boss && hull < 0.3 && g.faction === 'pirate') g.fleeing = true;
    const t = g.target;
    let dvx = 0, dvy = 0;
    if (g.fleeing) {
      const src = t || { x: 0, y: 0 };
      const a = Math.atan2(g.y - src.y, g.x - src.x);
      dvx = Math.cos(a) * TUNE.maxSpeed - g.vx; dvy = Math.sin(a) * TUNE.maxSpeed - g.vy;
      c.face = a + Math.PI / 2;
      if (!t || dist(g.x, g.y, t.x, t.y) > 500) g.despawn = true;
    } else if (t) {
      const dx = t.x - g.x, dy = t.y - g.y, d = Math.hypot(dx, dy) || 1;
      const range = g.sys.bioCores.length ? 0 : (g.prefRange || 35) + t.radius;
      let vx, vy;
      const spd = Math.min(g.maxSpd || 30, TUNE.maxSpeed);
      if (d > range + 12) { vx = dx / d * spd; vy = dy / d * spd; }
      else if (d < range - 8 && range > 0) { vx = -dx / d * spd * 0.6; vy = -dy / d * spd * 0.6; }
      else { const side = (g.id & 1) ? 1 : -1; vx = -dy / d * 10 * side; vy = dx / d * 10 * side; }
      dvx = vx + t.vx - g.vx; dvy = vy + t.vy - g.vy;
      c.face = Math.atan2(dy, dx) + Math.PI / 2;
      g.fireFixed = Math.abs(angNorm(c.face - g.a)) < 0.25 && d < 120;
    } else if (g.patrol) {
      const pt = g.patrol;
      const dx = pt.x - g.x, dy = pt.y - g.y, d = Math.hypot(dx, dy);
      if (d < 30) { const a = Math.random() * TAU; g.patrol = { x: pt.cx + Math.cos(a) * pt.r, y: pt.cy + Math.sin(a) * pt.r, cx: pt.cx, cy: pt.cy, r: pt.r }; }
      dvx = dx / (d || 1) * 12 - g.vx; dvy = dy / (d || 1) * 12 - g.vy;
      c.face = Math.atan2(dy, dx) + Math.PI / 2;
    }
    const l = g.vecToLocal(dvx, dvy);
    c.mx = clamp(l.x * 0.35, -1, 1); c.my = clamp(l.y * 0.35, -1, 1);
    if (Math.abs(c.mx) < 0.05) c.mx = 0;
    if (Math.abs(c.my) < 0.05) c.my = 0;
    // 群体の顎: 前に触れたブロックをかじる
    if (g.sys.jaws.length) for (const j of g.sys.jaws) {
      const f = g.toWorld(j.x + 0.5 + DIRS[j.r][0] * 1.1, j.y + 0.5 + DIRS[j.r][1] * 1.1);
      for (const o of S.grids) {
        if (o === g || o.dead || o.terrain || !hostile(g.faction, o.faction) || dist2(o.x, o.y, f.x, f.y) > (o.radius + 2) ** 2) continue;
        const q = o.toLocal(f.x, f.y), b = o.at(Math.floor(q.x), Math.floor(q.y));
        if (b) { damageBlock(o, b, 60 * dt, 'kinetic', g); if (Math.random() < dt * 4) spark(f.x, f.y, '#e06aa8', 2); }
      }
    }
  },
};

/* ---------- 無人機 (ブロックでできていない軽い機体) ---------- */
function updateDrones(dt) {
  // 出撃
  for (const g of S.grids) {
    if (g.dead || !g.sys || !g.sys.dronebays.length) continue;
    const enemy = g.cands && g.cands.find((o) => !o.dead && dist(o.x, o.y, g.x, g.y) < 180);
    for (const b of g.sys.dronebays) {
      b.rebuild = (b.rebuild || 0) + dt;
      if (b.drones < b.def.drones && b.rebuild > 20 && g.invTotal('p_steel') >= 4 && g.invTotal('p_circuit') >= 2 && (b.out || 0) + b.drones < b.def.drones) {
        g.invTake('p_steel', 4); g.invTake('p_circuit', 2); b.drones++; b.rebuild = 0;
      }
      if (enemy && b.drones > 0 && S.drones.length < TUNE.maxDrones) {
        b.launchT = (b.launchT || 0) - dt;
        if (b.launchT > 0) continue;
        b.launchT = 0.8;
        const p = g.blockWorld(b);
        b.drones--; b.out = (b.out || 0) + 1;
        S.drones.push({ x: p.x, y: p.y, vx: g.vx, vy: g.vy, hp: 30, owner: g, bay: b, fac: g.faction, cd: 0, a: g.a });
      }
    }
  }
  const W = WEAPONS.drone;
  const out = [];
  for (const d of S.drones) {
    if (d.hp <= 0) { boom(d.x, d.y, 0.8); if (d.bay) d.bay.out = Math.max(0, (d.bay.out || 1) - 1); continue; }
    const home = d.owner && !d.owner.dead ? d.owner : null;
    let tgt = null, bd = 150 * 150;
    for (const o of S.grids) if (!o.dead && !o.disabled && !o.terrain && hostile(d.fac, o.faction) && o.kind !== 'gate') { const dd = dist2(o.x, o.y, d.x, d.y); if (dd < bd) { bd = dd; tgt = o; } }
    let gx, gy;
    if (tgt) { const a = (performance.now() / 1000 + d.bay.i) * 0.8; gx = tgt.x + Math.cos(a) * (tgt.radius + 12); gy = tgt.y + Math.sin(a) * (tgt.radius + 12); }
    else if (home) {
      gx = home.x; gy = home.y;
      if (dist(d.x, d.y, home.x, home.y) < home.radius * 0.6 + 2) { d.bay.drones++; d.bay.out = Math.max(0, (d.bay.out || 1) - 1); continue; }
    } else { d.hp -= dt * 5; gx = d.x; gy = d.y; }
    const dx = gx - d.x, dy = gy - d.y, dd = Math.hypot(dx, dy) || 1;
    d.vx += (dx / dd * 30 - d.vx) * dt * 2; d.vy += (dy / dd * 30 - d.vy) * dt * 2;
    d.x += d.vx * dt; d.y += d.vy * dt;
    d.a = Math.atan2(d.vy, d.vx);
    d.cd -= dt;
    if (tgt && d.cd <= 0 && dist(tgt.x, tgt.y, d.x, d.y) < W.range + tgt.radius) {
      d.cd = 1 / W.rof;
      const a = Math.atan2(tgt.y - d.y, tgt.x - d.x) + (Math.random() - 0.5) * 0.1;
      if (S.bullets.length < TUNE.maxBullets) S.bullets.push({ x: d.x, y: d.y, vx: Math.cos(a) * W.speed + d.vx, vy: Math.sin(a) * W.speed + d.vy, dmg: W.dmg, type: 'kinetic', fac: d.fac, src: d.owner, life: W.range / W.speed, kind: 'mg' });
    }
    out.push(d);
  }
  S.drones = out;
}
