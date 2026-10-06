/* =========================================================================
   DEAD DRIVE ― 戦闘
   車の武器と基地の砲台の照準・発射、弾、爆発、電撃、地雷、拾いもの、木箱。
   すべて場面 S（scene.js）を受けとって動く。
   ========================================================================= */
'use strict';

/* 線分 a→b を進む点が、中心 (x, y)・半径 R の円に入る位置を 0〜1 で返す。触れなければ null */
function sweepEntry(x, y, R, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  if (l2 < 1e-6) return dist2(ax, ay, x, y) <= R * R ? 0 : null;
  const tp = ((x - ax) * dx + (y - ay) * dy) / l2;
  const dp2 = dist2(ax + dx * tp, ay + dy * tp, x, y);
  if (dp2 > R * R) return null;
  const half = Math.sqrt((R * R - dp2) / l2);
  if (tp + half < 0 || tp - half > 1) return null;
  return Math.max(0, tp - half);
}

/* 射界 (mount ± arc) と射程のなかで、いちばん近いゾンビ（prefer があればそこに近いもの） */
function findTarget(S, x, y, range, mount, arc, prefer, minRange = 0) {
  const list = S.zh.query(x, y, range, S._tq || (S._tq = []));
  let best = null, bestS = 1e12;
  for (const z of list) {
    if (z.dead) continue;
    const dx = z.x - x, dy = z.y - y, d2 = dx * dx + dy * dy;
    if (d2 > range * range || d2 < minRange * minRange) continue;
    if (arc < Math.PI - 0.01 && Math.abs(angDiff(mount, Math.atan2(dy, dx))) > arc) continue;
    let score = d2;
    if (prefer) score = dist2(z.x, z.y, prefer.x, prefer.y) * 4 + d2 * 0.2;
    if (z.def.boss) score *= 0.7;
    if (score < bestS) { bestS = score; best = z; }
  }
  return best;
}

/* 武器の強さに強化を掛けたもの */
function weaponMods(S, forTower) {
  const p = S.run.perks;
  return {
    dmg: 1 + 0.18 * (p.dmg || 0),
    rate: 1 + 0.15 * (p.rate || 0),
    range: 1 + 0.15 * (p.range || 0),
    pierce: p.pierce || 0,
    fire: p.fire || 0,
    critN: p.crit || 0,
    chain: 2 * (p.chain || 0),
    radius: 1 + 0.2 * (p.chain || 0),
    tower: forTower ? 1 + 0.15 * (p.turret || 0) : 1,
  };
}

function fireWeapon(S, w, x, y, ang, m, src) {
  const dmg = w.dmg * m.dmg * (m.extra || 1);
  switch (w.kind) {
    case 'bullet': {
      const n = w.pellets || 1;
      for (let i = 0; i < n; i++) {
        const a = ang + rand(-w.spread, w.spread);
        const sp = w.speed * rand(0.92, 1.08);
        const crit = m.critN > 0 && Math.random() < 0.15 * m.critN;
        S.shots.push({ kind: 'bullet', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (w.range * m.range) / sp * 1.05,
          dmg: dmg * (crit ? 2.5 : 1), pierce: (w.pierce || 0) + m.pierce, knock: w.knock || 30,
          fire: m.fire, hit: [], crit, big: n === 1 && w.dmg > 50 });
      }
      FX.add({ x: x + Math.cos(ang) * 10, y: y + Math.sin(ang) * 10, col: '#ffe08a', r: n > 1 ? 9 : 6, life: 0.06, glow: 1 });
      if (n > 1) Sfx.shotgun(); else Sfx.shot();
      return;
    }
    case 'flame': {
      for (let i = 0; i < 2; i++) {
        const a = ang + rand(-w.spread, w.spread);
        const sp = w.speed * rand(0.85, 1.15);
        S.shots.push({ kind: 'flame', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (w.range * m.range) / sp, t: 0,
          dmg: dmg * 0.5, burn: w.burn * (1 + 0.3 * m.fire), hit: [], pierce: 99 });
      }
      Sfx.flame();
      return;
    }
    case 'rocket': {
      S.shots.push({ kind: 'rocket', x, y, vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed, life: (w.range * m.range) / w.speed * 1.1,
        dmg, radius: w.radius * m.radius, hit: [], pierce: 0, ang });
      Sfx.rocket();
      return;
    }
    case 'shell': {
      const tx = src.tx, ty = src.ty;
      S.shots.push({ kind: 'shell', x, y, sx: x, sy: y, tx, ty, t: 0, T: 0.8 + dist(x, y, tx, ty) / 900, dmg, radius: w.radius * m.radius, hit: [], pierce: 0 });
      Sfx.thud();
      return;
    }
    case 'tesla': {
      teslaChain(S, x, y, src.target, dmg, (w.chain || 3) + m.chain);
      return;
    }
  }
}

function teslaChain(S, x, y, first, dmg, n) {
  let cur = first, px = x, py = y;
  const hit = new Set();
  for (let i = 0; i < n && cur; i++) {
    hit.add(cur);
    S.bolts.push({ x1: px, y1: py, x2: cur.x, y2: cur.y, life: 0.14, t: 0, seed: Math.random() });
    cur.hurt(dmg * (i === 0 ? 1 : 0.8), 'zap', S);
    cur.vx *= 0.3; cur.vy *= 0.3;
    px = cur.x; py = cur.y;
    let next = null, nd = 130 * 130;
    for (const z of S.zh.query(px, py, 130, S._tq2 || (S._tq2 = []))) {
      if (z.dead || hit.has(z)) continue;
      const d2 = dist2(px, py, z.x, z.y);
      if (d2 < nd) { nd = d2; next = z; }
    }
    cur = next;
  }
  Sfx.zap();
}

function explode(S, x, y, r, dmg, opts = {}) {
  for (const z of S.zh.query(x, y, r + 30, S._tq3 || (S._tq3 = []))) {
    if (z.dead) continue;
    const d = dist(x, y, z.x, z.y);
    if (d > r + z.r) continue;
    const k = 1 - clamp(d / (r + z.r), 0, 0.6);
    z.hurt(dmg * k, 'boom', S);
    if (!z.def.boss && d > 1) { const f = 380 * k / Math.max(1, z.def.mass * 0.6); z.vx += (z.x - x) / d * f; z.vy += (z.y - y) / d * f; z.fling = 0.35; }
  }
  if (opts.hurtsCar && S.car && !S.car.dead) {
    const car = S.car;
    for (const c of car.cells) {
      if (!c.alive) continue;
      const [wx, wy] = car.cellWorld(c);
      const d = dist(x, y, wx, wy);
      if (d < r) car.damageCell(c, opts.hurtsCar * (1 - d / r * 0.7));
    }
  }
  if (opts.hurtsPeople) for (const p of S.people) if (!p.dead && p.state === 'run' && dist(x, y, p.x, p.y) < r) p.hp -= opts.hurtsPeople;
  S.world.decal.scorch(x, y, r * 0.7);
  FX.add({ x, y, col: '#fff2c0', r: r * 0.5, grow: r * 2, life: 0.12, glow: 1 });
  FX.burst(x, y, 16, { col: '#ffb347', r: 6, spMin: 80, spMax: 320, lifeMin: 0.2, lifeMax: 0.45, glow: 1, drag: 0.88 });
  FX.burst(x, y, 10, { col: '#3a3632', kind: 'smoke', r: 12, grow: 30, spMin: 20, spMax: 90, lifeMin: 0.6, lifeMax: 1.2, alpha: 0.6, drag: 0.9, layer: 'low' });
  FX.add({ x, y, col: '#ffd28a', kind: 'ring', r: r * 0.3, grow: r * 2.4, life: 0.3, alpha: 0.8 });
  Sfx.boom();
  shakeCam(Math.min(10, r / 12));
}

/* ------------------------------ 車の武器 ------------------------------ */
function updateCarWeapons(S, dt) {
  const car = S.car;
  if (car.dead) return;
  const m = weaponMods(S, false);
  const prefer = S.aimPoint;
  for (const c of car.weapons) {
    if (!c.alive) continue;
    const w = WEAPONS[c.def.weapon];
    const [wx, wy] = car.cellWorld(c);
    c.cd -= dt * m.rate;
    if (w.kind === 'mine') {
      if (c.cd <= 0 && car.speed > 70) {
        c.cd = 1 / w.rate;
        S.mines.push({ x: wx - car.cosA * CS, y: wy - car.sinA * CS, t: 0, dmg: w.dmg * m.dmg * partPowMul(c.lv), r: w.radius * m.radius });
      }
      continue;
    }
    const mount = car.a + c.rot * Math.PI / 2;
    const arc = w.arc;
    const range = w.range * m.range;
    c.retarget = (c.retarget || 0) - dt;
    if (c.retarget <= 0 || !c.target || c.target.dead) {
      c.retarget = 0.12;
      c.target = findTarget(S, wx, wy, range, mount, arc, prefer);
    }
    let want = mount, shoot = false;
    if (c.target && !c.target.dead) {
      const t = dist(wx, wy, c.target.x, c.target.y) / (w.speed || 2000);
      want = Math.atan2(c.target.y + c.target.vy * t - wy, c.target.x + c.target.vx * t - wx);
      shoot = true;
    } else if (prefer && dist(wx, wy, prefer.x, prefer.y) < range) {
      const a = Math.atan2(prefer.y - wy, prefer.x - wx);
      if (Math.abs(angDiff(mount, a)) <= arc) { want = a; shoot = w.kind !== 'tesla'; }
    }
    c.aim = turnToward(c.aim, want, dt * (arc > 3 ? 9 : 14));
    if (arc < 3) {
      const off = angDiff(mount, c.aim);
      if (Math.abs(off) > arc) c.aim = mount + Math.sign(off) * arc;
    }
    if (shoot && c.cd <= 0 && Math.abs(angDiff(c.aim, want)) < 0.3) {
      c.cd = 1 / w.rate;
      const bx = wx + Math.cos(c.aim) * CS * 0.7, by = wy + Math.sin(c.aim) * CS * 0.7;
      m.extra = partPowMul(c.lv);   // 強化した武器ほど威力が上がる
      fireWeapon(S, w, bx, by, c.aim, m, { target: c.target });
    }
  }
}

/* ------------------------------ 基地の砲台 ------------------------------ */
function makeTower(slot, type, lv, crew) {
  const d = TOWERS[type];
  const mul = towerMult(lv);
  return { x: slot.x, y: slot.y, type, lv, crew, def: d, cd: rand(0.5), aim: -Math.PI / 2, hp: d.hp * (1 + 0.4 * (lv - 1)), maxhp: d.hp * (1 + 0.4 * (lv - 1)), mul, dead: false, target: null, retarget: 0 };
}

function updateTowers(S, dt) {
  const base = weaponMods(S, true);
  for (const t of S.towers) {
    if (t.dead) continue;
    const d = t.def;
    const crewRate = t.crew ? 1 : 0.65;
    const gun = t.crew === 'gunner' ? 1.25 : 1;
    const m = Object.assign({}, base, { dmg: base.dmg * t.mul.dmg * base.tower * gun, range: t.mul.range, rate: 1, pierce: base.pierce, extra: 1 });
    t.cd -= dt * t.mul.rate * crewRate * base.rate;
    const range = d.range * t.mul.range;
    t.retarget -= dt;
    if (t.retarget <= 0 || !t.target || t.target.dead) { t.retarget = 0.15; t.target = findTarget(S, t.x, t.y, range, 0, Math.PI, null, d.min || 0); }
    if (!t.target) continue;
    const z = t.target;
    const lead = d.speed ? dist(t.x, t.y, z.x, z.y) / d.speed : 0;
    const want = Math.atan2(z.y + z.vy * lead - t.y, z.x + z.vx * lead - t.x);
    t.aim = turnToward(t.aim, want, dt * 7);
    if (t.cd <= 0 && Math.abs(angDiff(t.aim, want)) < 0.2) {
      t.cd = 1 / d.rate;
      const bx = t.x + Math.cos(t.aim) * 18, by = t.y + Math.sin(t.aim) * 18;
      fireWeapon(S, d, bx, by, t.aim, m, { target: z, tx: z.x + z.vx * 0.9, ty: z.y + z.vy * 0.9 });
    }
  }
}

function drawTower(ctx, t) {
  ctx.save();
  ctx.translate(t.x, t.y);
  if (t.dead) {
    ctx.fillStyle = '#4a443a';
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 12, Math.sin(a) * 12, 6, 0, TAU); ctx.fill(); }
    ctx.restore(); return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(3, 4, 22, 0, TAU); ctx.fill();
  ctx.fillStyle = '#a08a5c';
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 17, Math.sin(a) * 17, 7, 5, a + Math.PI / 2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#5a5448'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
  ctx.rotate(t.aim);
  const c = t.def.col;
  switch (t.type) {
    case 'mg': ctx.fillStyle = '#22262b'; ctx.fillRect(0, -4, 22, 3); ctx.fillRect(0, 1, 22, 3); break;
    case 'flame': ctx.fillStyle = '#3b3632'; ctx.fillRect(0, -3, 20, 6); ctx.fillStyle = c; ctx.fillRect(17, -4, 5, 8); break;
    case 'sniper': ctx.fillStyle = '#1d2024'; ctx.fillRect(0, -2, 32, 4); ctx.fillStyle = '#556b7d'; ctx.fillRect(4, -4, 8, 8); break;
    case 'mortar': ctx.fillStyle = '#2b3020'; ctx.beginPath(); ctx.arc(6, 0, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(8, 0, 4.5, 0, TAU); ctx.fill(); break;
    case 'tesla': break;
  }
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
  if (t.type === 'tesla') {
    ctx.strokeStyle = '#c28a3a'; ctx.lineWidth = 2;
    for (const rr of [11, 7]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = `rgba(150,210,255,${0.6 + 0.4 * Math.sin(G.time * 10)})`; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
  }
  if (t.crew) { ctx.fillStyle = '#f0c9a0'; ctx.beginPath(); ctx.arc(-8, 0, 4.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.arc(-9.5, 0, 3.5, 0, TAU); ctx.fill(); }
  ctx.restore();
  for (let i = 0; i < t.lv; i++) { ctx.fillStyle = '#ffd35a'; ctx.fillRect(t.x - 9 + i * 7, t.y + 23, 5, 4); }
  if (t.hp < t.maxhp) {
    const k = clamp(t.hp / t.maxhp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(t.x - 18, t.y - 32, 36, 5);
    ctx.fillStyle = k > 0.5 ? '#7ee39b' : '#ff5f6d'; ctx.fillRect(t.x - 17, t.y - 31, 34 * k, 3);
  }
}

/* ------------------------------ 弾 ------------------------------ */
function updateShots(S, dt) {
  const shots = S.shots;
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    if (s.kind === 'shell') {
      s.t += dt;
      const k = s.t / s.T;
      s.x = lerp(s.sx, s.tx, k); s.y = lerp(s.sy, s.ty, k); s.h = Math.sin(Math.PI * clamp(k, 0, 1)) * 120;
      if (k >= 1) { explode(S, s.tx, s.ty, s.radius, s.dmg); shots.splice(i, 1); }
      continue;
    }
    s.life -= dt;
    const px = s.x, py = s.y;
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.kind === 'flame') { s.t += dt; s.vx *= Math.pow(0.1, dt); s.vy *= Math.pow(0.1, dt); }
    if (s.kind === 'rocket' && Math.random() < 0.7) FX.add({ x: s.x, y: s.y, vx: rand(-20, 20), vy: rand(-20, 20), col: '#8a8580', kind: 'smoke', r: 4, grow: 14, life: 0.5, alpha: 0.5, layer: 'low' });
    let dead = s.life <= 0;
    /* 速い弾は1コマで長く進むので、通った線の上を調べる */
    let blocked = false;
    if (!dead && s.kind !== 'flame') {
      const n = Math.max(1, Math.ceil(Math.hypot(s.x - px, s.y - py) / 10));
      for (let k = 1; k <= n; k++) {
        const bx = lerp(px, s.x, k / n), by = lerp(py, s.y, k / n);
        if (S.world.shotBlock(bx, by, true)) { s.x = bx; s.y = by; blocked = true; break; }
      }
    }
    if (!dead) {
      const rr = s.kind === 'flame' ? 8 + s.t * 30 : 4;
      const sweep = s.kind !== 'flame';
      const mx = sweep ? (px + s.x) / 2 : s.x, my = sweep ? (py + s.y) / 2 : s.y;
      const reach = (sweep ? Math.hypot(s.x - px, s.y - py) / 2 : 0) + rr + 30;
      /* この1コマで弾が通った線に入った相手を、入った順に並べる。木箱も同じ列に入れる */
      const cands = [];
      for (const z of S.zh.query(mx, my, reach, S._sq || (S._sq = []))) {
        if (z.dead || s.hit.includes(z)) continue;
        const R = z.r + rr;
        const t = sweep ? sweepEntry(z.x, z.y, R, px, py, s.x, s.y) : (dist2(s.x, s.y, z.x, z.y) <= R * R ? 1 : null);
        if (t !== null) cands.push({ z, t });
      }
      if (s.kind === 'bullet') {
        for (const c of S.crates) {
          if (c.broken) continue;
          const t = sweepEntry(c.x, c.y, 18, px, py, s.x, s.y);
          if (t !== null) cands.push({ crate: c, t });
        }
      }
      if (cands.length > 1) cands.sort((a, b) => a.t - b.t);
      for (const { z, crate, t } of cands) {
        const cx = sweep ? lerp(px, s.x, t) : s.x, cy = sweep ? lerp(py, s.y, t) : s.y;
        if (crate) {
          crate.hp -= s.dmg / 20; dead = true; blocked = false;
          if (crate.hp <= 0) breakCrate(S, crate);
          break;
        }
        s.hit.push(z);
        if (s.kind === 'rocket') { explode(S, cx, cy, s.radius, s.dmg); dead = true; blocked = false; break; }
        if (s.kind === 'flame') { z.hurt(s.dmg, 'fire', S); z.burn = 2.2; z.burnDps = Math.max(z.burnDps, s.burn); continue; }
        z.hurt(s.dmg, 'bullet', S);
        if (s.fire) { z.burn = 1.6; z.burnDps = Math.max(z.burnDps, 4 * s.fire); }
        if (!z.def.boss) { const sp = Math.hypot(s.vx, s.vy); z.vx += s.vx / sp * s.knock / z.def.mass; z.vy += s.vy / sp * s.knock / z.def.mass; }
        FX.burst(cx, cy, 3, { col: GOO, r: 2.5, spMin: 40, spMax: 140, lifeMin: 0.15, lifeMax: 0.3, dir: Math.atan2(s.vy, s.vx), spread: 0.8 });
        if (s.crit) FX.text(z.x, z.y - 14, '急所', '#ffe36a', 12);
        if (--s.pierce < 0) { dead = true; blocked = false; break; }
      }
    }
    if (blocked && !dead) {
      dead = true;
      if (s.kind === 'rocket') explode(S, s.x, s.y, s.radius, s.dmg);
      else FX.burst(s.x, s.y, 3, { col: '#ffd27a', kind: 'line', r: 1.2, spMin: 60, spMax: 160, lifeMin: 0.08, lifeMax: 0.18 });
    }
    if (dead) shots.splice(i, 1);
  }

  /* 吐かれた酸 */
  const es = S.enemyShots;
  for (let i = es.length - 1; i >= 0; i--) {
    const s = es[i];
    s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
    let dead = s.life <= 0 || !!S.world.shotBlock(s.x, s.y);
    if (!dead && S.car && !S.car.dead && dist2(s.x, s.y, S.car.x, S.car.y) < S.car.R * S.car.R) {
      const hit = S.car.contactCell(s.x, s.y, 6);
      if (hit) { S.car.damageCell(hit.cell, s.dmg); dead = true; FX.burst(s.x, s.y, 8, { col: '#b6e04a', r: 3, spMin: 40, spMax: 140, lifeMin: 0.2, lifeMax: 0.4 }); Sfx.splat(); }
    }
    if (dead) { if (s.life > 0) S.world.decal.splat(s.x, s.y, 5, '#6a8a20'); es.splice(i, 1); }
  }

  /* 電撃の見た目 */
  for (let i = S.bolts.length - 1; i >= 0; i--) { S.bolts[i].t += dt; if (S.bolts[i].t >= S.bolts[i].life) S.bolts.splice(i, 1); }

  /* 地雷 */
  for (let i = S.mines.length - 1; i >= 0; i--) {
    const mn = S.mines[i];
    mn.t += dt;
    if (mn.t < 0.5) continue;
    let boom = mn.t > 40;
    if (!boom) for (const z of S.zh.query(mn.x, mn.y, 30, S._mq || (S._mq = []))) { if (!z.dead && dist2(mn.x, mn.y, z.x, z.y) < (z.r + 16) * (z.r + 16)) { boom = true; break; } }
    if (boom) { explode(S, mn.x, mn.y, mn.r, mn.dmg); S.mines.splice(i, 1); }
  }
}

function drawShots(ctx, S) {
  for (const s of S.shots) {
    if (s.kind === 'bullet') {
      ctx.strokeStyle = s.crit ? '#fff3a0' : '#ffe08a'; ctx.lineWidth = s.big ? 3.5 : 2;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.022, s.y - s.vy * 0.022); ctx.stroke();
    } else if (s.kind === 'flame') {
      const k = clamp(s.t / 0.5, 0, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = k < 0.3 ? 'rgba(255,230,140,0.55)' : k < 0.7 ? 'rgba(255,140,50,0.45)' : 'rgba(200,70,30,0.3)';
      ctx.beginPath(); ctx.arc(s.x, s.y, 5 + s.t * 30, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else if (s.kind === 'rocket') {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang);
      ctx.fillStyle = '#d8d8d0'; ctx.fillRect(-7, -2.5, 12, 5); ctx.fillStyle = '#d24a3a'; ctx.fillRect(4, -2.5, 4, 5);
      ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(-9, 0, 3 + Math.random() * 2, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (s.kind === 'shell') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2b3020'; ctx.beginPath(); ctx.arc(s.x, s.y - s.h, 5, 0, TAU); ctx.fill();
    }
  }
  for (const s of S.enemyShots) {
    ctx.fillStyle = '#b6e04a'; ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(210,255,120,0.5)'; ctx.beginPath(); ctx.arc(s.x - s.vx * 0.02, s.y - s.vy * 0.02, 3.5, 0, TAU); ctx.fill();
  }
  for (const b of S.bolts) {
    const a = 1 - b.t / b.life;
    ctx.strokeStyle = `rgba(170,220,255,${a})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
    const n = 6, rr = mulberry32(Math.floor(b.seed * 1e6));
    for (let i = 1; i < n; i++) {
      const k = i / n;
      ctx.lineTo(lerp(b.x1, b.x2, k) + (rr() - 0.5) * 18, lerp(b.y1, b.y2, k) + (rr() - 0.5) * 18);
    }
    ctx.lineTo(b.x2, b.y2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1; ctx.stroke();
  }
  for (const mn of S.mines) {
    ctx.fillStyle = '#3a3a2a'; ctx.beginPath(); ctx.arc(mn.x, mn.y, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = mn.t > 0.5 && Math.sin(G.time * 10) > 0 ? '#ff4a3a' : '#6a2a20'; ctx.beginPath(); ctx.arc(mn.x, mn.y, 2.2, 0, TAU); ctx.fill();
  }
}

/* ------------------------------ 拾いものと木箱 ------------------------------ */
const LOOT_COL = { scrap: '#aab3bd', food: '#e7c86a', kit: '#7ee39b', pile: '#9aa3ad', bp: '#6fc3ff', fuel: '#d64a3a' };

function breakCrate(S, c) {
  if (c.broken) return;
  c.broken = true;
  FX.burst(c.x, c.y, 14, { col: '#a8845a', kind: 'rect', r: 3, spMin: 60, spMax: 240, lifeMin: 0.3, lifeMax: 0.7 });
  Sfx.thud();
  const drop = (kind, amt) => S.pickups.push({ x: c.x + rand(-14, 14), y: c.y + rand(-14, 14), kind, amt, vx: rand(-80, 80), vy: rand(-80, 80) });
  let loot = c.loot;
  if (loot === 'random') {
    const canBp = Run.lockedParts().length > 0 && !S.bpDropped;
    loot = new RNG((Math.random() * 1e9) | 0).weighted([{ k: 'scrap', w: 5 }, { k: 'food', w: 2.2 }, { k: 'kit', w: 1 }, { k: 'fuel', w: 0.5 }, { k: 'bp', w: canBp ? 0.45 : 0 }]).k;
  }
  if (loot === 'scrap') { for (let i = 0; i < 4; i++) drop('scrap', randi(3, 6)); }
  else if (loot === 'food') { for (let i = 0; i < 3; i++) drop('food', 1); }
  else if (loot === 'kit') drop('kit', 1);
  else if (loot === 'fuel') drop('fuel', 1);
  else if (loot === 'bp') { drop('bp', 1); S.bpDropped = true; }
  if (c.goal) S.onGoalCrate(c);
}

function updatePickups(S, dt) {
  const car = S.car;
  if (!car || car.dead) return;
  /* 走ってぶつかれば木箱が割れる */
  for (const c of S.crates) {
    if (c.broken) continue;
    if (dist2(c.x, c.y, car.x, car.y) > (car.R + 20) * (car.R + 20)) continue;
    if (car.contactCell(c.x, c.y, c.big ? 16 : 12) && car.speed > 40) breakCrate(S, c);
  }
  const mag = car.st.magnet;
  for (let i = S.pickups.length - 1; i >= 0; i--) {
    const p = S.pickups[i];
    if (p.vx) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt); if (Math.abs(p.vx) < 2) p.vx = 0; }
    const d = dist(p.x, p.y, car.x, car.y);
    if (p.kind === 'pile') {
      if (d < car.R + 14 && car.contactCell(p.x, p.y, 22)) { S.collect(p); S.pickups.splice(i, 1); }
      continue;
    }
    if (d < mag + car.R * 0.6 && !(p.kind === 'food' && !S.hasRoom(1)) && !(p.kind === 'fuel' && !S.hasRoom(2))) {
      const k = 1 - d / (mag + car.R);
      p.x += (car.x - p.x) / d * (160 + 500 * k) * dt;
      p.y += (car.y - p.y) / d * (160 + 500 * k) * dt;
    }
    if (d < car.R * 0.75) {
      if ((p.kind === 'food' && !S.hasRoom(1)) || (p.kind === 'fuel' && !S.hasRoom(2))) {
        if (!S.fullWarned) { S.fullWarned = true; toast('荷台がいっぱい。荷台を増やすと多く運べる', 'bad'); }
        continue;
      }
      S.collect(p); S.pickups.splice(i, 1);
    }
  }
}

function drawPickups(ctx, S) {
  for (const c of S.crates) {
    if (c.broken) continue;
    const s = c.big ? 26 : 20;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(c.x - s / 2 + 3, c.y - s / 2 + 4, s, s);
    ctx.fillStyle = c.goal ? '#7a6a4a' : '#a8845a'; ctx.fillRect(c.x - s / 2, c.y - s / 2, s, s);
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2;
    ctx.strokeRect(c.x - s / 2 + 1, c.y - s / 2 + 1, s - 2, s - 2);
    ctx.beginPath(); ctx.moveTo(c.x - s / 2, c.y - s / 2); ctx.lineTo(c.x + s / 2, c.y + s / 2); ctx.stroke();
    if (c.goal) { ctx.fillStyle = '#ffd35a'; ctx.font = `900 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('?', c.x, c.y - s / 2 - 5); }
  }
  for (const p of S.pickups) {
    const bob = Math.sin(G.time * 4 + p.x) * 1.5;
    ctx.save(); ctx.translate(p.x, p.y + bob);
    switch (p.kind) {
      case 'scrap':
        ctx.fillStyle = '#6a737c'; ctx.fillRect(-5, -3, 8, 6);
        ctx.fillStyle = '#aab3bd'; ctx.beginPath(); ctx.arc(2, 1, 3.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#50575e'; ctx.beginPath(); ctx.arc(2, 1, 1.3, 0, TAU); ctx.fill();
        break;
      case 'food':
        ctx.fillStyle = '#c9c2b0'; ctx.fillRect(-5, -6, 10, 12);
        ctx.fillStyle = '#d64a3a'; ctx.fillRect(-5, -2, 10, 5);
        ctx.fillStyle = '#e7c86a'; ctx.fillRect(-5, -6, 10, 2);
        break;
      case 'fuel':
        ctx.fillStyle = '#d64a3a'; roundRect(ctx, -6, -8, 12, 16, 2); ctx.fill();
        ctx.fillStyle = '#222'; ctx.fillRect(-2, -10, 4, 3);
        break;
      case 'kit':
        ctx.fillStyle = '#f2f2f2'; roundRect(ctx, -7, -6, 14, 12, 2); ctx.fill();
        ctx.fillStyle = '#3aa35a'; ctx.fillRect(-1.5, -4, 3, 8); ctx.fillRect(-4, -1.5, 8, 3);
        break;
      case 'bp':
        ctx.fillStyle = `rgba(111,195,255,${0.3 + 0.2 * Math.sin(G.time * 6)})`; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a5a9a'; ctx.fillRect(-8, -6, 16, 12);
        ctx.strokeStyle = '#bfe3ff'; ctx.lineWidth = 1; ctx.strokeRect(-6, -4, 12, 8);
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
        break;
      case 'pile': {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(4, 5, 22, 15, 0, 0, TAU); ctx.fill();
        const cols = ['#6a737c', '#8a939c', '#5a5448', '#aab3bd', '#7a5a3a'];
        for (let i = 0; i < 9; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-16 + (i * 7) % 26, -10 + ((i * 5) % 16), 10, 7); }
        ctx.fillStyle = '#ffd35a'; ctx.font = `900 11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('轢く!', 0, -18);
        break;
      }
    }
    ctx.restore();
  }
}
