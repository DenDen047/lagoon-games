/* =========================================================================
   ORE TO ARMADA ― 人
   主人公・乗員・敵の乗員を同じ仕組みで動かす。
   居場所は3つ: 席に座る (seat) / グリッドの中を歩く (walk) / 宇宙服で外にいる (eva)
   ========================================================================= */
'use strict';

const PR = 0.3;   // 人の半径 (マス)

function makePerson(kind, o = {}) {
  return Object.assign({
    id: ++G.nextId, kind, isPerson: true, name: '', faction: kind === 'hostile' ? 'pirate' : 'player',
    hp: 100, maxhp: 100, o2: TUNE.suitO2, suit: TUNE.suitPower, mode: 'eva', grid: null, lx: 0, ly: 0,
    x: 0, y: 0, vx: 0, vy: 0, face: 0, seat: null, att: null, inv: {}, invCap: 40, tool: 1, dead: false,
    color: '#e8864a', walkT: 0, cd: 0,
  }, o);
}

function personWorld(p) {
  if (p.mode === 'seat' && p.seat && p.grid) return p.grid.toWorld(p.seat.x + p.seat.w / 2, p.seat.y + p.seat.h / 2);
  if (p.mode === 'walk' && p.grid) return p.grid.toWorld(p.lx, p.ly);
  if (p.att) return p.att.g.toWorld(p.att.lx, p.att.ly);
  return { x: p.x, y: p.y };
}
function personVel(p) {
  if (p.grid && p.mode !== 'eva') { const w = personWorld(p); return p.grid.velAt(w.x, w.y); }
  if (p.att) { const w = personWorld(p); return p.att.g.velAt(w.x, w.y); }
  return { x: p.vx, y: p.vy };
}
function allPersons() {
  const out = [];
  if (G.player && !G.player.dead) out.push(G.player);
  for (const p of S.persons) if (!p.dead) out.push(p);
  return out;
}
function playerShip() {
  const p = G.player;
  return p && p.mode === 'seat' && p.seat && p.seat.def.seat === 'pilot' && p.grid && !p.grid.dead ? p.grid : null;
}

/* ---------- マスの性質 ---------- */
function walkableCell(g, i, j, p) {
  const b = g.at(i, j);
  if (b) {
    if (b.def.door) return !b.lock || !p || p.faction === g.faction;
    return !!b.def.walk;
  }
  if (g.rockGrid && g.rockGrid.dugAt(i, j)) return true;
  return false;
}
/* 人にとって壁か (空きマスは壁ではない。外へ出られる) */
function blockedCell(g, i, j, p) {
  if (g.terrain) return g.tt(i, j) !== 0;
  if (g.rockGrid && g.rockGrid.tt(i, j)) return true;
  const b = g.at(i, j);
  if (!b) return false;
  return !walkableCell(g, i, j, p);
}
function isOutside(g, i, j) {
  if (g.at(i, j)) return false;
  if (g.rockGrid && (g.rockGrid.dugAt(i, j) || g.rockGrid.tt(i, j))) return false;
  return true;
}
/* 円 (r) がふさがったマスに重なるか */
function overlapsBlocked(g, x, y, r, p) {
  for (let j = Math.floor(y - r); j <= Math.floor(y + r); j++) for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) {
    if (!blockedCell(g, i, j, p)) continue;
    const cx = clamp(x, i, i + 1), cy = clamp(y, j, j + 1);
    if (dist2(cx, cy, x, y) < r * r) return true;
  }
  return false;
}
function breathable(p) {
  if (p.mode === 'seat') return true;
  // 空気のある惑星の地上では、建物の外でも中でも息ができる
  const w = personWorld(p), P = Planet.surfAt(w.x, w.y);
  if (P && PLANET_TYPES[P.type].air) return true;
  if (p.mode !== 'walk' || !p.grid) return false;
  return p.grid.pressureAt(Math.floor(p.lx), Math.floor(p.ly)) > 0.45;
}

/* ---------- 席 ---------- */
function sitDown(p, g, b) {
  if (b.occ && b.occ !== p) return false;
  if (p.seat) standUp(p);
  p.mode = 'seat'; p.grid = g; p.seat = b; b.occ = p; p.att = null;
  if (p.kind === 'player') {
    Sfx.play('ui');
    if (b.def.seat === 'pilot') onPlayerPilot(g);
  }
  return true;
}
function standUp(p) {
  const g = p.grid, b = p.seat;
  if (!b || !g) { p.mode = 'eva'; return; }
  b.occ = null; p.seat = null;
  // 席の隣の歩けるマス。なければ船外へ
  const cand = [];
  for (let j = b.y - 1; j <= b.y + b.h; j++) for (let i = b.x - 1; i <= b.x + b.w; i++) {
    const inX = i >= b.x && i < b.x + b.w, inY = j >= b.y && j < b.y + b.h;
    if (inX && inY) continue;
    if (walkableCell(g, i, j, p) && !(g.at(i, j) && g.at(i, j).def.door)) cand.push([i, j, (inX || inY) ? 0 : 1]);
  }
  cand.sort((a, c) => a[2] - c[2]);
  if (cand.length) { p.mode = 'walk'; p.lx = cand[0][0] + 0.5; p.ly = cand[0][1] + 0.5; return; }
  // 外に出す: 一番近い空きマス
  let best = null, bd = 1e9;
  for (let j = b.y - 3; j <= b.y + b.h + 2; j++) for (let i = b.x - 3; i <= b.x + b.w + 2; i++) {
    if (g.occupied(i, j)) continue;
    if (g.occupied(i + 1, j) + g.occupied(i - 1, j) + g.occupied(i, j + 1) + g.occupied(i, j - 1) === 0) continue;
    const d = dist2(i, j, b.x, b.y);
    if (d < bd) { bd = d; best = [i, j]; }
  }
  const w = g.toWorld(best ? best[0] + 0.5 : b.x + 0.5, best ? best[1] + 0.5 : b.y - 1);
  const v = g.velAt(w.x, w.y);
  p.mode = 'eva'; p.x = w.x; p.y = w.y; p.vx = v.x; p.vy = v.y; p.grid = null;
  p.att = best ? { g, lx: best[0] + 0.5, ly: best[1] + 0.5 } : null;
}
/* 歩けないマスに埋まっていたら、近くの歩けるマスへ移す (ステーションの間取りが変わったときなど) */
function unstick(p) {
  const g = p.grid;
  if (!g || !overlapsBlocked(g, p.lx, p.ly, PR, p)) return;
  let best = null, bd = 1e9;
  for (let j = Math.floor(p.ly) - 4; j <= Math.floor(p.ly) + 4; j++) for (let i = Math.floor(p.lx) - 4; i <= Math.floor(p.lx) + 4; i++) {
    if (!walkableCell(g, i, j, p) || overlapsBlocked(g, i + 0.5, j + 0.5, PR, p)) continue;
    const d = dist2(i + 0.5, j + 0.5, p.lx, p.ly);
    if (d < bd) { bd = d; best = [i + 0.5, j + 0.5]; }
  }
  if (best) { p.lx = best[0]; p.ly = best[1]; }
}
function ejectFromSeat(p) { if (p.seat) { const g = p.grid; standUp(p); if (p.mode === 'walk' && !g) p.mode = 'eva'; } }

/* ---------- ダメージと死 ---------- */
function hurtPerson(p, dmg, src) {
  if (p.dead || dmg <= 0) return;
  p.hp -= dmg;
  p.hurtT = 0.3;
  if (p.kind === 'player') shake(0.15);
  if (p.hp <= 0) killPerson(p, src);
}
function killPerson(p, src) {
  if (p.dead) return;
  p.dead = true;
  const w = personWorld(p);
  if (p.seat) { p.seat.occ = null; p.seat = null; }
  spark(w.x, w.y, '#ff6a6a', 8);
  if (p.kind === 'player') onPlayerDeath(w);
  else if (p.kind === 'crew') {
    if (G.diff === 'relaxed') { p.dead = false; Crew.injure(p); return; }
    Toast.show(`乗員の ${p.name} が亡くなった`, 'bad'); Crew.onDeath(p);
  }
  else if (p.kind === 'survivor') {
    const m = G.missions.find((x) => x.id === p.survivor);
    if (m) { G.missions = G.missions.filter((x) => x !== m); Toast.show('救助の依頼に失敗した。生存者が亡くなった', 'bad'); }
  }
  else if (p.kind === 'hostile') { G.stats.kills++; if (Math.random() < 0.5) dropPickup(w.x, w.y, { ammo: 2, p_circuit: 1 }, 'salvage'); }
}

/* ---------- 1ティックの動き (人の共通部分) ---------- */
function movePerson(p, dt, input) {
  // input: {x,y} (ワールドの向き、長さ 0..1), brake, jet
  if (p.dead) return;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.mode === 'seat') {
    if (!p.seat || p.seat.dead || !p.grid || p.grid.dead) { p.seat = null; p.mode = 'eva'; const w = { x: p.x, y: p.y }; p.x = w.x; p.y = w.y; }
    else { p.suit = Math.min(TUNE.suitPower, p.suit + 5 * dt); p.o2 = Math.min(TUNE.suitO2, p.o2 + 20 * dt); }
  }
  if (p.mode === 'walk') walkStep(p, dt, input);
  else if (p.mode === 'eva') evaStep(p, dt, input);
  // 酸素
  const mul = G.diff === 'relaxed' ? 0.5 : 1;
  if (breathable(p)) p.o2 = Math.min(TUNE.suitO2, p.o2 + 25 * dt);
  else {
    p.o2 -= dt * mul * (p.kind === 'hostile' ? 0.5 : 1);
    if (p.o2 < 25 && p.inv.o2_bottle) { invTakeP(p, 'o2_bottle', 1); p.o2 = Math.min(TUNE.suitO2, p.o2 + 90); if (p.kind === 'player') Toast.show('酸素ボトルを使った'); }
  }
  if (p.o2 <= 0) { p.o2 = 0; hurtPerson(p, 8 * dt, null); p.choke = true; } else p.choke = false;
  if (p.suit < 3 && p.inv.battery_pack) { invTakeP(p, 'battery_pack', 1); p.suit = Math.min(TUNE.suitPower, p.suit + 60); if (p.kind === 'player') Toast.show('予備バッテリーを使った'); }
  // 充電台・医療室
  if (p.mode === 'walk' && p.grid) {
    const b = p.grid.at(Math.floor(p.lx), Math.floor(p.ly));
    if (b && b.def.charger) { p.suit = Math.min(TUNE.suitPower, p.suit + 25 * dt); p.o2 = Math.min(TUNE.suitO2, p.o2 + 30 * dt); }
    if (b && b.def.medbay && (p.grid.power.cat ? p.grid.power.cat.life > 0.3 : true)) p.hp = Math.min(p.maxhp, p.hp + (p.grid.doctorHere ? 12 : 5) * dt);
    if (b && b.def.kiosk === 'k_med') p.hp = Math.min(p.maxhp, p.hp + 8 * dt);
  }
  if (p.mode !== 'eva' && p.hp < p.maxhp && breathable(p)) p.hp = Math.min(p.maxhp, p.hp + 0.3 * dt);
}

function walkStep(p, dt, input) {
  const g = p.grid;
  if (!g || g.dead) { p.mode = 'eva'; p.grid = null; return; }
  // 入力 (ワールドの向き) をグリッドの向きへ
  const sp = TUNE.walkSpeed * (p.kind === 'player' ? 1 : 0.8);
  const lv = g.vecToLocal(input.x * sp, input.y * sp);
  const tryMove = (nx, ny) => { if (!overlapsBlocked(g, nx, ny, PR, p)) { p.lx = nx; p.ly = ny; return true; } return false; };
  if (lv.x || lv.y) {
    if (!tryMove(p.lx + lv.x * dt, p.ly)) { /* 壁 */ }
    if (!tryMove(p.lx, p.ly + lv.y * dt)) { /* 壁 */ }
    p.face = Math.atan2(lv.y, lv.x);
    p.walkT += dt;
  }
  // ドアを開ける
  for (let j = Math.floor(p.ly - 1); j <= Math.floor(p.ly + 1); j++) for (let i = Math.floor(p.lx - 1); i <= Math.floor(p.lx + 1); i++) {
    const b = g.at(i, j);
    if (b && b.def.door && dist2(i + 0.5, j + 0.5, p.lx, p.ly) < 1.3 && (!b.lock || p.faction === g.faction)) b.want = 0.25;
  }
  // グリッドの外へ出た
  const ci = Math.floor(p.lx), cj = Math.floor(p.ly);
  if (isOutside(g, ci, cj)) {
    const w = g.toWorld(p.lx, p.ly), v = g.velAt(w.x, w.y);
    const wv = g.vecToWorld(lv.x, lv.y);
    p.mode = 'eva'; p.grid = null; p.x = w.x; p.y = w.y; p.vx = v.x + wv.x * 0.6; p.vy = v.y + wv.y * 0.6; p.att = null;
  }
}

function evaStep(p, dt, input) {
  // 惑星の地上では、ジェットパックを使わずに地面を歩く (スーツ電力は減らない)
  const surf = Planet.surfAt(p.x, p.y);
  p.onGround = !!surf;
  // 磁力ブーツで張りついている
  if (p.att) {
    const a = p.att;
    if (a.g.dead) { p.att = null; }
    else if (input.x || input.y) {
      const w = a.g.toWorld(a.lx, a.ly), v = a.g.velAt(w.x, w.y);
      p.x = w.x; p.y = w.y; p.vx = v.x; p.vy = v.y; p.att = null;
    } else { const w = a.g.toWorld(a.lx, a.ly); p.x = w.x; p.y = w.y; const v = a.g.velAt(w.x, w.y); p.vx = v.x; p.vy = v.y; return; }
  }
  if (surf) {
    const sp = TUNE.walkSpeed * (p.kind === 'player' ? 1.15 : 0.9), k = Math.min(1, dt * 10);
    p.vx += (input.x * sp - p.vx) * k; p.vy += (input.y * sp - p.vy) * k;
    if (input.x || input.y) { p.face = Math.atan2(input.y, input.x); p.walkT += dt; }
  }
  const jet = !surf && (input.x || input.y) && p.suit > 0;
  if (jet) {
    p.vx += input.x * TUNE.jetForce * dt; p.vy += input.y * TUNE.jetForce * dt;
    p.suit = Math.max(0, p.suit - TUNE.jetDrain * dt * (G.diff === 'relaxed' ? 0.5 : 1));
    p.face = Math.atan2(input.y, input.x);
    if (Math.random() < 0.5) S.particles.push({ x: p.x - input.x * 0.4, y: p.y - input.y * 0.4, vx: -input.x * 6 + p.vx, vy: -input.y * 6 + p.vy, life: 0.25, max: 0.25, c: '#bfe8ff', s: 0.18 });
  }
  if (input.brake && p.suit > 0 && !surf) {
    // 近くのグリッドに対して止まる
    const ref = nearestGridTo(p.x, p.y, 20);
    const v = ref ? ref.velAt(p.x, p.y) : { x: 0, y: 0 };
    const dvx = v.x - p.vx, dvy = v.y - p.vy, dv = Math.hypot(dvx, dvy);
    if (dv > 0.05) { const k = Math.min(1, TUNE.jetForce * dt / dv); p.vx += dvx * k; p.vy += dvy * k; p.suit = Math.max(0, p.suit - TUNE.jetDrain * dt); }
  }
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 30) { p.vx *= 30 / sp; p.vy *= 30 / sp; }
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (surf) Planet.keepIn(p, surf, TUNE.surfaceR);
  // グリッドとの当たり
  for (const g of S.grids) {
    if (g.dead || g.kind === 'gate') continue;
    if (dist2(g.x, g.y, p.x, p.y) > (g.radius + 1.5) ** 2) continue;
    const l = g.toLocal(p.x, p.y);
    // 歩けるマス (エアロック・ドア・床の縁) に入ったら船内へ
    if (!g.terrain) {
      const ci = Math.floor(l.x), cj = Math.floor(l.y);
      if (walkableCell(g, ci, cj, p)) {
        const b = g.at(ci, cj);
        if (b && b.def.door && b.lock && p.faction !== g.faction) { /* 鍵がかかっている */ }
        else if (!overlapsBlocked(g, l.x, l.y, PR, p)) { p.mode = 'walk'; p.grid = g; p.lx = l.x; p.ly = l.y; p.att = null; if (b && b.def.door) b.want = 0.4; return; }
      }
    }
    for (let j = Math.floor(l.y - 1); j <= Math.floor(l.y + 1); j++) for (let i = Math.floor(l.x - 1); i <= Math.floor(l.x + 1); i++) {
      if (!blockedCell(g, i, j, p)) continue;
      const cx = clamp(l.x, i, i + 1), cy = clamp(l.y, j, j + 1);
      let nx = l.x - cx, ny = l.y - cy, d = Math.hypot(nx, ny);
      if (d >= PR + 0.05) continue;
      if (d < 1e-6) { nx = l.x - (i + 0.5); ny = l.y - (j + 0.5); d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d; d = 0; }
      else { nx /= d; ny /= d; }
      l.x += nx * (PR + 0.05 - d); l.y += ny * (PR + 0.05 - d);
      const wn = g.vecToWorld(nx, ny), v = g.velAt(p.x, p.y);
      const rvx = p.vx - v.x, rvy = p.vy - v.y, vn = rvx * wn.x + rvy * wn.y;
      if (vn < 0) {
        if (-vn > 14) hurtPerson(p, (-vn - 14) * 3, null);
        p.vx -= vn * wn.x; p.vy -= vn * wn.y;
      }
      const w = g.toWorld(l.x, l.y); p.x = w.x; p.y = w.y;
      // 止まったら磁力ブーツで張りつく (地上では地面に立っているので張りつかない)
      if (!surf && !input.x && !input.y && Math.hypot(p.vx - v.x, p.vy - v.y) < 3) p.att = { g, lx: l.x, ly: l.y };
    }
  }
}
function nearestGridTo(x, y, maxD, filter) {
  let best = null, bd = 1e9;
  for (const g of S.grids) {
    if (g.dead || g.kind === 'gate' || (filter && !filter(g))) continue;
    const d = dist(g.x, g.y, x, y) - g.radius;
    if (d < maxD && d < bd) { bd = d; best = g; }
  }
  return best;
}

/* ---------- 主人公の道具 ---------- */
const TOOLS = [
  null,
  { id: 'drill', name: '手持ちドリル', range: 6, drain: 1 },
  { id: 'weld', name: '溶接機', range: 6, drain: 1 },
  { id: 'grind', name: '解体機', range: 6, drain: 1.5 },
  { id: 'gun', name: '手持ち銃', range: 30, drain: 0 },
];
function useTool(p, dt, aimW) {
  const T = TOOLS[p.tool];
  if (!T) return;
  const w = personWorld(p);
  const dx = aimW.x - w.x, dy = aimW.y - w.y, d = Math.hypot(dx, dy) || 1;
  const ang = Math.atan2(dy, dx);
  p.face = p.grid && p.mode === 'walk' ? ang - p.grid.a : ang;
  p.cd -= dt;
  if (T.id === 'gun') {
    if (p.cd > 0) return;
    const W = WEAPONS.hand; p.cd = 1 / W.rof;
    const v = personVel(p);
    S.bullets.push({ x: w.x + Math.cos(ang) * 0.5, y: w.y + Math.sin(ang) * 0.5, vx: Math.cos(ang) * W.speed + v.x, vy: Math.sin(ang) * W.speed + v.y, dmg: W.dmg, type: 'kinetic', fac: p.faction, src: p, life: W.range / W.speed, kind: 'hand' });
    Sfx.play('mg', 0.3);
    return;
  }
  if (p.suit <= 0) { if (p.kind === 'player' && !p.noSuitMsg) { p.noSuitMsg = true; Toast.show('スーツの電力が切れた。操縦席か充電台で満たそう', 'bad'); } return; }
  p.noSuitMsg = false;
  p.suit = Math.max(0, p.suit - T.drain * dt);
  if (T.id === 'drill') {
    const ex = w.x + dx / d * T.range, ey = w.y + dy / d * T.range;
    const h = Combat.trace(w.x, w.y, ex, ey, { fac: p.faction, persons: false, drones: false, personShot: true });
    const hx = h ? w.x + (ex - w.x) * h.t : ex, hy = h ? w.y + (ey - w.y) * h.t : ey;
    S.beams.push({ x0: w.x, y0: w.y, x1: hx, y1: hy, c: '#ffe08a', w: 0.1, hit: !!h, tool: true });
    if (!h || !h.g || !h.g.terrain) return;
    const t = h.g.digTerrain(h.i, h.j, 14 * dt);
    if (t) onDug(h.g, h.i, h.j, t, p);
    if (Math.random() < dt * 6) { spark(hx, hy, '#ffe08a', 1); Sfx.play('mine', 0.25); }
    return;
  }
  // 溶接機と解体機は、カーソルの下のブロックを直接狙う (船の中から床越しに壁も狙える)
  const reach = Math.min(d, T.range);
  const hx = w.x + dx / d * reach, hy = w.y + dy / d * reach;
  S.beams.push({ x0: w.x, y0: w.y, x1: hx, y1: hy, c: T.id === 'weld' ? '#8affd0' : '#ff9a4a', w: 0.1, hit: d <= T.range, tool: true });
  if (d > T.range) return;
  let g = null, b = null;
  for (const o of S.grids) {
    if (o.dead || o.terrain || o.invuln || o.kind === 'gate' || dist2(o.x, o.y, aimW.x, aimW.y) > (o.radius + 1) ** 2) continue;
    const q = o.toLocal(aimW.x, aimW.y), ob = o.at(Math.floor(q.x), Math.floor(q.y));
    if (ob) { g = o; b = ob; break; }
  }
  if (!b) return;
  if (T.id === 'weld') {
    // 自分の船の壊れたブロックを直す (鋼板は船の貨物か背負いかばんから)
    const src = g.faction === 'player' && g.invTotal('p_steel') > 0 ? null : p;
    if (!repairBlock(g, b, 40 * dt, src)) { if (!p.noSteelMsg && b.hp < b.def.hp) { p.noSteelMsg = true; Toast.show('修理に使う鋼板がない', 'bad'); } }
    else { p.noSteelMsg = false; if (Math.random() < dt * 10) spark(hx, hy, '#8affd0', 1); }
    return;
  }
  if (T.id === 'grind') {
    if (b.def.noBuild) return;
    b.hp -= 45 * dt;
    if (Math.random() < dt * 12) spark(hx, hy, '#ff9a4a', 1);
    if (b.hp <= 0) {
      const own = g.faction === 'player';
      // 自分の貨物庫の中身はそのまま残す
      const stash = own && b.inv ? b.inv : null;
      if (stash) { b.inv = {}; b.used = 0; }
      const rate = own ? TUNE.refundRate : 0.5;
      const refund = {};
      if (!g.loan) for (const k in b.def.cost) { const n = Math.floor(b.def.cost[k] * rate); if (n > 0) refund[k] = n; }
      destroyBlock(g, b, p, true);
      Sfx.play('remove', 0.6);
      if (stash) for (const k in stash) refund[k] = (refund[k] || 0) + stash[k];
      for (const k in refund) {
        let rest = refund[k];
        if (own && !g.dead) rest = g.invAdd(k, rest);
        if (rest > 0) rest = invAddP(p, k, rest);
        if (rest > 0) dropPickup(hx, hy, { [k]: rest }, 'salvage');
      }
    }
  }
}

/* ---------- 主人公が F で調べる ---------- */
function interactTarget(p) {
  const w = personWorld(p);
  if (p.mode === 'walk' && p.grid) {
    const g = p.grid;
    let best = null, bd = 2.2 * 2.2;
    for (let j = Math.floor(p.ly - 2); j <= Math.floor(p.ly + 2); j++) for (let i = Math.floor(p.lx - 2); i <= Math.floor(p.lx + 2); i++) {
      const b = g.at(i, j);
      if (!b || !(b.def.seat || b.def.kiosk || b.def.cargo || b.def.medbay || b.def.refine || b.def.assemble || b.def.shipyard || b.def.jump)) continue;
      const cx = clamp(p.lx, b.x, b.x + b.w), cy = clamp(p.ly, b.y, b.y + b.h);
      const d = dist2(cx, cy, p.lx, p.ly);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) return { g, b: best };
    return null;
  }
  if (p.mode === 'eva') {
    // 近くの船の席に外から乗る
    let best = null, bd = 2.8 * 2.8;
    for (const g of S.grids) {
      if (g.dead || g.terrain || dist2(g.x, g.y, w.x, w.y) > (g.radius + 3) ** 2) continue;
      g.updateSys();
      const l = g.toLocal(w.x, w.y);
      for (const b of g.sys.seats) {
        const d = dist2(b.x + b.w / 2, b.y + b.h / 2, l.x, l.y);
        if (d < bd) { bd = d; best = { g, b }; }
      }
    }
    return best;
  }
  return null;
}
function interactLabel(t) {
  if (!t) return '';
  const d = t.b.def;
  if (d.seat && t.b.occ && t.b.occ.kind === 'crew') return `${t.b.occ.name} と${d.seat === 'pilot' ? '操縦' : '砲手'}を代わる`;
  if (d.seat) return d.seat === 'pilot' ? (t.g.faction === 'player' ? '操縦する' : t.g.faction === 'derelict' || t.g.disabled ? '操縦席に座る' : '操縦席') : '砲手席に座る';
  if (d.kiosk === 'k_board') return '船に乗る';
  if (d.kiosk) return KIOSKS[d.kiosk] + 'に入る';
  if (d.medbay) return '医療室を蘇生地点にする';
  if (d.refine || d.assemble) return '生産を見る';
  if (d.shipyard) return '造船台を使う';
  if (d.jump) return 'ジャンプドライブを見る';
  if (d.cargo) return '貨物を見る';
  return '調べる';
}

/* ---------- 乗員の経路探索 (床のマスを幅優先) ---------- */
function findPath(g, p, sx, sy, goals, maxN = 4000) {
  const key = (i, j) => (i - g.minX) + (j - g.minY) * g.w;
  const goalSet = new Set(goals.map(([i, j]) => key(i, j)));
  const P = Planet.surfAt(g.x, g.y), outsideAir = !!(P && PLANET_TYPES[P.type].air);
  const start = key(sx, sy);
  if (goalSet.has(start)) return [];
  const prev = new Map([[start, -1]]);
  const q = [sx, sy];
  let head = 0, found = -1;
  while (head < q.length && prev.size < maxN) {
    const i = q[head++], j = q[head++];
    for (let d = 0; d < 4; d++) {
      const ni = i + DIRS[d][0], nj = j + DIRS[d][1];
      const k = key(ni, nj);
      if (prev.has(k) || g.idx(ni, nj) < 0) continue;
      if (!walkableCell(g, ni, nj, p)) continue;
      if (p.avoidVac && !outsideAir && g.pressureAt(ni, nj) < 0.3 && !goalSet.has(k)) continue;
      prev.set(k, key(i, j));
      if (goalSet.has(k)) { found = k; head = q.length; break; }
      q.push(ni, nj);
    }
  }
  if (found < 0) return null;
  const path = [];
  for (let k = found; k !== start && k !== -1; k = prev.get(k)) path.push([(k % g.w) + g.minX + 0.5, Math.floor(k / g.w) + g.minY + 0.5]);
  return path.reverse();
}
/* ブロックの隣の歩けるマス */
function cellsBeside(g, b, p) {
  const out = [];
  for (let j = b.y - 1; j <= b.y + b.h; j++) for (let i = b.x - 1; i <= b.x + b.w; i++) {
    const inX = i >= b.x && i < b.x + b.w, inY = j >= b.y && j < b.y + b.h;
    if (inX === inY) continue;
    if (walkableCell(g, i, j, p)) out.push([i, j]);
  }
  return out;
}
/* 経路に沿って歩く。着いたら true */
function followPath(p, dt) {
  if (!p.path || !p.path.length) return true;
  const [tx, ty] = p.path[0];
  const g = p.grid;
  const dx = tx - p.lx, dy = ty - p.ly, d = Math.hypot(dx, dy);
  if (d < 0.15) { p.path.shift(); return !p.path.length; }
  const w = g.vecToWorld(dx / d, dy / d);
  movePerson(p, dt, { x: w.x, y: w.y });
  p.moved = true;
  return false;
}

/* ---------- 敵の乗員 (乗り込み戦) ---------- */
function spawnHostiles(g, n) {
  const floors = [];
  g.eachBlock((b) => { if (b.def.id === 'floor') floors.push(b); });
  if (!floors.length) return;
  for (let k = 0; k < n; k++) {
    const b = floors[(Math.random() * floors.length) | 0];
    const p = makePerson('hostile', { name: '海賊', faction: g.faction, mode: 'walk', grid: g, lx: b.x + 0.5, ly: b.y + 0.5, color: '#c04040', hp: 60, maxhp: 60 });
    S.persons.push(p);
  }
  g.eachBlock((b) => { if (b.def.door) b.lock = true; });
}
function hostileAI(p, dt) {
  const g = p.grid;
  const pl = G.player;
  let input = { x: 0, y: 0 };
  if (g && p.mode === 'walk' && pl && !pl.dead && pl.mode === 'walk' && pl.grid === g) {
    const d = dist(pl.lx, pl.ly, p.lx, p.ly);
    if (d < 14 && lineClear(g, p.lx, p.ly, pl.lx, pl.ly)) {
      p.cd -= dt;
      if (d > 4) { const w = g.vecToWorld((pl.lx - p.lx) / d, (pl.ly - p.ly) / d); input = { x: w.x * 0.6, y: w.y * 0.6 }; }
      if (p.cd <= 0) {
        p.cd = 0.7 + Math.random() * 0.4;
        const a = personWorld(p), b = personWorld(pl);
        const ang = Math.atan2(b.y - a.y, b.x - a.x) + (Math.random() - 0.5) * 0.2;
        const W = WEAPONS.hand;
        S.bullets.push({ x: a.x + Math.cos(ang) * 0.5, y: a.y + Math.sin(ang) * 0.5, vx: Math.cos(ang) * W.speed, vy: Math.sin(ang) * W.speed, dmg: 9, type: 'kinetic', fac: p.faction, src: p, life: 0.5, kind: 'hand' });
        p.face = ang - g.a;
      }
    } else if (Math.random() < 0.01) p.wander = [Math.random() - 0.5, Math.random() - 0.5];
  }
  if (!input.x && p.wander && g) { const w = g.vecToWorld(p.wander[0], p.wander[1]); input = { x: w.x * 0.3, y: w.y * 0.3 }; }
  movePerson(p, dt, input);
}
/* 壁にさえぎられずに見えるか (ガラスは通す) */
function lineClear(g, ax, ay, bx, by) {
  let clear = true;
  ddaGrid(g, ax, ay, bx, by, (i, j) => { const b = g.at(i, j); if (b && !b.def.walk && !b.def.glass && !(b.def.door && b.open > 0.5)) { clear = false; return true; } return false; });
  return clear;
}
