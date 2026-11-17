/* MECH FRONTIER のゲーム本体: 人・メカ・ひこうきの動き、たたかい、しごと、たてもの、セーブ */
'use strict';
const SAVE_KEY = 'mech-frontier-save-v1';
const IN = { k: {}, hit: {}, mdx: 0, mdy: 0, fire: false, sub: false, sx: 0, sy: 0, wheel: 0 };
const cam = { yaw: 0, pitch: -.15, ex: 0, ey: 5, ez: -10, tx: 0, ty: 2, tz: 0, fov: 1.05, shadowR: 90 };
let SV = null;
let ents = [], shots = [], fx = [], beams = [];
const P = { human: null, mech: null, plane: null, state: 'foot' };
const G = {
  t: 0, running: false, menu: false, preview: null, pvAng: 0, aim: { x: 0, y: 0, z: 0 }, lock: null, lockT: 0, prompt: null,
  job: null, groups: [], turrets: [], usePieces: [], build: { on: false, t: 0, rot: 0, lvl: 0, col: 0, ghost: null, ok: false },
  beacons: [], hitT: 0, lastHurt: -99, deadT: 0, callCd: 0, spawnT: 0, raidT: 240, groupT: 5, planes: [], kills: 0,
};
const body = () => P.state === 'mech' ? P.mech : P.state === 'plane' ? P.plane : P.human;

// ---------- セーブ ----------
function freshSave() {
  return { money: 200, mats: { scrap: 0, iron: 0, core: 0, rare: 0 }, mechs: [], active: 0, own: { pistol: 1, pipe: 1 }, load: { main: 'pistol', sub: null, melee: 'pipe' },
    pieces: [], rank: 1, xp: 0, quest: 0, kits: 1, time: .4, jet: 0, bed: null, jobs: 0, q: { shadow: 2, auto: 1 } };
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SV)); } catch (e) { /* ほぞんできない たんまつ */ } }
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.mats) { SV = Object.assign(freshSave(), s); return true; } } catch (e) { /* こわれた データ */ }
  SV = freshSave(); return false;
}
const canPay = (c) => MAT_KEYS.every(k => (SV.mats[k] || 0) >= (c[k] || 0));
function pay(c) { for (const k of MAT_KEYS) SV.mats[k] -= c[k] || 0; }
function gainMat(k, n) { SV.mats[k] += n; UI.gain(MATS[k].icon + '+' + n); }
function addXp(n) {
  SV.xp += n;
  while (SV.xp >= SV.rank * 120) { SV.xp -= SV.rank * 120; SV.rank++; UI.toast('[star] ランク ' + SV.rank + ' に なった！ てきも つよくなるぞ'); sfx('coin'); }
}

// ---------- 作る ----------
const TIMERS = ['fcd', 'scd', 'mcd', 'dcd', 'qcd', 'dashT', 'spinT', 'swingT', 'flash', 'fireFlash', 'ramCd'];
function baseEnt(kind, team, x, z) {
  const e = { kind, team, x, y: 0, z, vx: 0, vy: 0, vz: 0, yaw: 0, aimYaw: 0, aimPitch: 0, walk: 0, mode: 0, onGround: true, dmgMul: 1,
    spinA: 0, rollA: 0, load: {}, inp: { mx: 0, mz: 0, aimYaw: 0, aimPitch: 0 } };
  for (const t of TIMERS) e[t] = 0;
  return e;
}
function mkHuman(team, x, z, look) {
  const e = baseEnt('human', team, x, z);
  e.st = { spd: 8, jump: 8, turn: 14, dmg: .4, melee: .5, r: .4, h: 1.8, kind: '' };
  e.r = .4; e.h = 1.8; e.hp = e.maxhp = 100; e.look = look || HUMAN_LOOKS[0];
  return e;
}
function mkMech(spec, team, x, z) {
  const e = baseEnt('mech', team, x, z);
  e.spec = spec; e.st = mechStats(spec); e.r = e.st.r; e.h = e.st.h; e.hp = e.maxhp = e.st.hp; e.name = spec.name;
  return e;
}
function mkAi(tier, range, sight) { return { aggro: false, tier, range, sight, err: Math.max(.012, .06 - tier * .007), wt: 0, wa: 0, wm: 0, st: 0, sdir: 1, burst: 1, pause: 1, bt: 0, mcd: 0 }; }
const GUNS_BY_TIER = [['pistol', 'mg'], ['mg', 'shotgun'], ['mg', 'shotgun', 'rifle', 'grenade'], ['gatling', 'rocket', 'rifle', 'flame'], ['rocket', 'missile', 'laser', 'gatling'], ['plasma', 'laser', 'missile'], ['rail', 'plasma', 'missile']];
const MELEE_BY_TIER = ['pipe', 'pipe', 'sword', 'sword', 'hammer', 'saber', 'gigaaxe'];
function spawnEnemyMech(x, z, tier, boss) {
  const lo = Math.min(38, tier * 6), spec = Object.assign({}, FRAMES[lo + rndi(0, 11)]);
  if (boss) { spec.size *= 1.3; spec.c1 = 13; spec.c2 = 2; }
  const e = mkMech(spec, 1, x, z);
  e.hp = e.maxhp = Math.round(e.maxhp * (.4 + .2 * tier) * (boss ? 3 : 1)); e.dmgMul = (.28 + .11 * tier) * (boss ? 1.3 : 1);
  e.load = { main: pick(GUNS_BY_TIER[Math.min(6, tier)]), sub: tier >= 2 && Math.random() < .3 ? 'shield' : null, melee: MELEE_BY_TIER[Math.min(6, tier)] };
  const w = WEAPONS[e.load.main];
  e.ai = mkAi(tier, clamp(w.range * .4, 10, 45), 75); e.tier = tier; e.boss = !!boss;
  e.name = (boss ? 'おたずねもの ' : 'ならずもの ') + spec.name; e.yaw = rnd(6.28);
  ents.push(e); return e;
}
function spawnDrone(x, z, tier) {
  const e = baseEnt('drone', 1, x, z); e.y = 9; e.r = .9; e.h = 1.2; e.hp = e.maxhp = 30 + tier * 20; e.tier = tier; e.name = 'ドローン';
  e.st = { kind: '' }; e.ai = mkAi(tier, 22, 85); e.ai.sdir = Math.random() < .5 ? -1 : 1; e.dmgMul = .3 + .1 * tier;
  ents.push(e); return e;
}
function spawnThug(x, z, tier, dealer, group) {
  const e = mkHuman(1, x, z, dealer ? [0x2a2a30, 0x18181c, 0x101010] : pick(HUMAN_LOOKS.slice(1)));
  e.hp = e.maxhp = dealer ? 120 + tier * 40 : 50 + tier * 20; e.dmgMul = .45 + .12 * tier; e.tier = tier; e.boss = dealer;
  e.load = { main: dealer ? 'shotgun' : pick(['pistol', 'mg']), sub: null, melee: 'pipe' };
  e.ai = mkAi(tier, dealer ? 8 : 12, 10); e.ai.guard = true; e.ai.shout = dealer ? '「なんだ おまえは！ やっちまえ！」' : null; e.group = group;
  e.name = dealer ? 'やみしょうにん' : 'ようじんぼう'; e.yaw = rnd(6.28);
  ents.push(e); return e;
}
function spawnCitizen() {
  const c = pick(W.corners), e = mkHuman(2, c.x, c.z, pick(HUMAN_LOOKS)); e.y = .2; e.corner = c; e.st.spd = 1.6 + rnd(1); e.citizen = true;
  ents.push(e);
}
function mkPlane(spot, jet) {
  const p = baseEnt('plane', 0, spot.x, spot.z); p.yaw = spot.yaw; p.pitch = 0; p.roll = 0; p.speed = 0; p.thr = 0; p.jet = jet; p.prop = 0;
  p.r = 3; p.h = 2.6; p.hp = p.maxhp = jet ? 400 : 250; p.parked = true; p.spot = spot; p.rollT = 0; p.bcd = 0; p.st = { kind: '' };
  p.name = jet ? 'ジェットき' : 'プロペラき';
  ents.push(p); G.planes.push(p); return p;
}
function spawnPlayerMech(x, z, y) {
  if (P.mech) { const i = ents.indexOf(P.mech); if (i >= 0) ents.splice(i, 1); }
  const s = SV.mechs[SV.active]; if (!s) { P.mech = null; return; }
  const m = mkMech(s, 0, x, z); m.y = y || 0; m.parked = true; m.load = SV.load; m.mine = true; m.yaw = cam.yaw;
  P.mech = m; ents.push(m);
}

// ---------- 効果 ----------
function spark(x, y, z, n, col, sp, size, life) {
  for (let i = 0; i < n && fx.length < 500; i++) fx.push({ x, y, z, vx: rnd(-sp, sp), vy: rnd(-sp * .3, sp), vz: rnd(-sp, sp), life: life || rnd(.2, .6), max: .6, size: size || .2, col, type: 0 });
}
function boom(x, y, z, r) {
  fx.push({ x, y, z, vx: 0, vy: 0, vz: 0, life: .35, max: .35, size: r, col: 0xffb040, type: 1 });
  fx.push({ x, y, z, vx: 0, vy: 2, vz: 0, life: 1.1, max: 1.1, size: r * .7, col: 0x50505a, type: 2 });
  spark(x, y, z, 10, 0xffd060, r * 2.5, .25); sfx('boom', Math.hypot(x - cam.ex, z - cam.ez));
}

// ---------- あたり判定つきの 移動 ----------
function collide(e) {
  const boxes = W.near(e.x, e.z, e.r + 1), step = e.kind === 'mech' ? .9 * e.spec.size : .6;
  let ground = 0;
  for (const b of boxes) {
    if (e.y + step >= b.y1) {
      const m = e.r * .35;
      if (e.x > b.x0 - m && e.x < b.x1 + m && e.z > b.z0 - m && e.z < b.z1 + m && b.y1 > ground) ground = b.y1;
      continue;
    }
    if (e.y + e.h <= b.y0) continue;
    const cx = clamp(e.x, b.x0, b.x1), cz = clamp(e.z, b.z0, b.z1), dx = e.x - cx, dz = e.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= e.r * e.r) continue;
    if (d2 > 1e-6) { const d = Math.sqrt(d2); e.x = cx + dx / d * e.r; e.z = cz + dz / d * e.r; }
    else {
      const l = e.x - b.x0, r = b.x1 - e.x, t = e.z - b.z0, bm = b.z1 - e.z, m = Math.min(l, r, t, bm);
      if (m === l) e.x = b.x0 - e.r; else if (m === r) e.x = b.x1 + e.r; else if (m === t) e.z = b.z0 - e.r; else e.z = b.z1 + e.r;
    }
  }
  return ground;
}
function physics(e, dt) {
  e.vy -= 30 * dt;
  e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
  e.x = clamp(e.x, -W.size, W.size); e.z = clamp(e.z, -W.size, W.size);
  const g = collide(e);
  if (e.y <= g) { e.y = g; if (e.vy < 0) e.vy = 0; e.onGround = true; e.chute = false; } else e.onGround = false;
}

// ---------- ダメージ ----------
function hurt(e, dmg, src) {
  if (e.dead || e.parked || e.citizen) return;
  if (src && (e.blocking || (e.st.kind === 'titan' && e.mode === 1))) {
    const front = Math.sin(e.aimYaw) * (src.x - e.x) + Math.cos(e.aimYaw) * (src.z - e.z) > 0;
    if (e.st.kind === 'titan' && e.mode === 1) dmg *= front ? .1 : .6;
    else if (front) { dmg *= 1 - WEAPONS[e.load.sub].block; spark(e.x + Math.sin(e.aimYaw) * e.r, e.y + e.h * .6, e.z + Math.cos(e.aimYaw) * e.r, 2, 0x80e0ff, 4, .15); }
  }
  if (e.dashT > 0 || e.rollT > 0) dmg *= .4;
  e.hp -= dmg; e.flash = .14;
  if (e === body()) { G.hitT = .35; G.lastHurt = G.t; }
  else if (src === body() || (src && src.team === 0)) { G.lock = e; G.lockT = 3; }
  if (e.ai && !e.ai.aggro) { e.ai.aggro = true; if (e.group) for (const m of e.group.members) if (m.ai) m.ai.aggro = true; }
  if (e.hp <= 0) kill(e);
}
function explode(x, y, z, r, dmg, team, src) {
  boom(x, y, z, r);
  for (const e of ents) {
    if (e.team === team || e.team === 2 || e.dead || e.hidden) continue;
    const d = Math.hypot(e.x - x, e.y + e.h * .5 - y, e.z - z) - e.r;
    if (d < r) hurt(e, dmg * (1 - .6 * Math.max(0, d) / r), src);
  }
  if (team === 0) for (const n of W.nodes) if (n.hp > 0 && Math.hypot(n.x - x, n.z - z) < r) mine(n, 2);
}
function kill(e) {
  e.dead = true;
  boom(e.x, e.y + e.h * .5, e.z, e.kind === 'mech' ? 4 * e.spec.size : e.kind === 'human' ? 1 : 3);
  if (e === P.human) { G.deadT = 3; P.human.hidden = true; UI.toast('[boom] やられた… ひろばに もどるよ'); return; }
  if (e === P.mech) {
    if (P.state === 'mech') exitVehicle(true);
    e.hidden = true; e.broken = 40; UI.toast('[boom] メカが こわれた！ 40びょうで しゅうり できる'); return;
  }
  if (e === P.plane || e.kind === 'plane') {
    if (P.plane === e) exitVehicle(true);
    e.hidden = true; e.broken = 30; return;
  }
  const i = ents.indexOf(e); if (i >= 0) ents.splice(i, 1);
  if (e.team !== 1) return;
  const t = e.tier || 0; G.kills++;
  if (e.kind === 'mech') {
    const m = (60 + 50 * t) * (e.boss ? 6 : 1); SV.money += m; addXp((20 + 15 * t) * (e.boss ? 4 : 1));
    gainMat('scrap', rndi(3, 6) + t); if (t >= 1) gainMat('iron', rndi(1, 3)); if (Math.random() < .3 + t * .08) gainMat('core', 1 + (t > 3 ? 1 : 0));
    if (e.boss || Math.random() < .04 + t * .01) gainMat('rare', e.boss ? 2 : 1);
    UI.gain('[money]+' + m);
  } else if (e.kind === 'drone') { SV.money += 25 + 10 * t; gainMat('scrap', 2); addXp(10); }
  else if (e.boss) { const m = 500 + 150 * SV.rank; SV.money += m; gainMat('rare', 1); gainMat('core', 2); addXp(60); UI.toast('[dealer] やみしょうにんを やっつけた！ [money]+' + m); }
  else { SV.money += 60; addXp(15); UI.gain('[money]+60'); }
  if (e.group) {
    e.group.members = e.group.members.filter(m => m !== e);
    if (!e.group.members.length) { G.groups = G.groups.filter(g => g !== e.group); G.groupT = 60; if (G.job && G.job.group === e.group) jobDone(G.job.pay, 'やみしょうにん たいじ'); }
  }
  if (G.job && G.job.target === e) jobDone(G.job.pay, 'おたずねもの たいじ');
}
function mine(n, amt) {
  if (n.hp <= 0) return; amt = Math.min(amt, n.hp); n.hp -= amt;
  gainMat(n.type, n.type === 'scrap' ? amt * 2 : amt);
  spark(n.x, 1.2, n.z, 4, n.type === 'core' ? 0x60e0ff : 0xc0a080, 5, .2); sfx('hit');
  if (n.hp <= 0) n.t = 75;
}

// ---------- うつ・きる ----------
function rayEnts(ox, oy, oz, dx, dy, dz, max, team) {
  let best = null, bt = max;
  for (const e of ents) {
    if (e.team === team || e.team === 2 || e.hidden || e.dead || e.parked) continue;
    const cx = e.x - ox, cy = e.y + e.h * .5 - oy, cz = e.z - oz, tca = cx * dx + cy * dy + cz * dz;
    if (tca < 0 || tca > bt + 6) continue;
    const rad = Math.max(e.r, e.h * .45), d2 = cx * cx + cy * cy + cz * cz - tca * tca;
    if (d2 > rad * rad) continue;
    const t = tca - Math.sqrt(rad * rad - d2); if (t < bt) { bt = Math.max(0, t); best = e; }
  }
  return best ? { e: best, t: bt } : null;
}
const PROJ = {
  bullet: { col: 0xffe080, size: .14 }, rocket: { col: 0xff8030, size: .4 }, grenade: { col: 0x80a060, size: .35, g: 20 }, missile: { col: 0xffffff, size: .32, homing: 1 },
  flame: { col: 0xff7020, size: .5, flame: 1 }, plasma: { col: 0x60ffc0, size: .9 },
};
function fireGun(e, w, side, inp) {
  const mech = e.kind === 'mech', z = mech ? e.spec.size : .45, kind = e.st.kind;
  let rate = w.rate; if (kind === 'ball' && e.mode === 2) rate /= 3;
  if (side > 0) e.fcd = rate; else e.scd = rate;
  e.fireFlash = .06; e.subFlash = side < 0;
  const ay = e.aimYaw, fxx = Math.sin(ay), fzz = Math.cos(ay), off = (mech ? e.st.r * 1.1 : .36) * side, fwd = mech ? 1.9 * z : .9;
  const ox = e.x - fzz * off + fxx * fwd, oy = e.y + (mech ? e.h * .62 : 1.4), oz = e.z + fxx * off + fzz * fwd;
  let dx, dy, dz;
  const a = inp.aim;
  if (a && Math.hypot(a.x - ox, a.y - oy, a.z - oz) > 5) { dx = a.x - ox; dy = a.y - oy; dz = a.z - oz; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l; }
  else { const cp = Math.cos(e.aimPitch); dx = fxx * cp; dy = Math.sin(e.aimPitch); dz = fzz * cp; }
  const dmg = w.dmg * e.dmgMul * (mech ? e.st.dmg : .4), sc = mech ? Math.min(2, z) : .5;
  const spin = kind === 'ball' && e.mode === 3, n = spin ? 4 : (w.n || 1);
  for (let i = 0; i < n; i++) {
    let x = dx, y = dy, zz = dz, sx = ox, sy = oy, sz = oz;
    if (spin) { const an = e.spinA + e.yaw + i * Math.PI / 2; x = Math.sin(an); y = 0; zz = Math.cos(an); sx = e.x + x * e.r * 1.6; sy = e.y + 1.3 * z; sz = e.z + zz * e.r * 1.6; }
    const s = w.spread + (kind === 'ball' && e.mode === 2 ? .02 : 0);
    x += rnd(-s, s); y += rnd(-s, s); zz += rnd(-s, s);
    if (w.proj === 'laser') {
      let far = W.raycast(sx, sy, sz, x, y, zz, w.range);
      const h = rayEnts(sx, sy, sz, x, y, zz, far, e.team);
      if (h) { far = h.t; hurt(h.e, dmg, e); }
      beams.push({ x0: sx, y0: sy, z0: sz, x1: sx + x * far, y1: sy + y * far, z1: sz + zz * far, life: w.big ? .25 : .07, max: w.big ? .25 : .07, col: w.big ? 0xb070ff : 0xff4060, w: (w.big ? .5 : .16) * sc });
      spark(sx + x * far, sy + y * far, sz + zz * far, w.big ? 8 : 1, 0xffa0c0, 5, .15);
      continue;
    }
    const pj = PROJ[w.proj], v = w.spd;
    let tgt = null;
    if (pj.homing) tgt = e.team === 0 ? (G.lock && !G.lock.dead ? G.lock : nearestEnemy(e.x, e.z, w.range)) : body();
    shots.push({ x: sx, y: sy, z: sz, vx: x * v, vy: y * v + (pj.g ? 4 : 0), vz: zz * v, life: w.range / v, dmg, team: e.team, aoe: w.aoe || 0, g: pj.g || 0,
      size: pj.size * sc, col: pj.col, tgt, src: e, flame: pj.flame, v });
  }
  if (e === body() || Math.hypot(e.x - cam.ex, e.z - cam.ez) < 90) sfx(w.proj === 'laser' ? 'laser' : w.aoe ? 'launch' : 'shot', Math.hypot(e.x - cam.ex, e.z - cam.ez));
}
function nearestEnemy(x, z, max) {
  let best = null, bd = max;
  for (const e of ents) { if (e.team !== 1 || e.dead || e.hidden) continue; const d = Math.hypot(e.x - x, e.z - z); if (d < bd) { bd = d; best = e; } }
  return best;
}
function melee(e, spin) {
  const w = WEAPONS[e.load.melee]; if (!w) return;
  const mech = e.kind === 'mech', reach = w.reach * (mech ? e.spec.size * 1.5 : 1) * (spin ? 1.25 : 1) + e.r;
  const dmg = w.dmg * e.dmgMul * (mech ? e.st.melee : .5) * (spin ? 1.4 : 1);
  if (!spin) { e.swingT = .3; e.mcd = w.cd; }
  const hitOk = (x, z, r) => {
    const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz); if (d > reach + r) return false;
    return spin || d < e.r + r || Math.abs(angDiff(Math.atan2(dx, dz), e.aimYaw)) < 1.15;
  };
  for (const o of ents.slice()) {
    if (o.team === e.team || o.team === 2 || o.dead || o.hidden) continue;
    if (Math.abs(o.y - e.y) > Math.max(e.h, o.h) || !hitOk(o.x, o.z, o.r)) continue;
    hurt(o, dmg, e); spark(o.x, o.y + o.h * .5, o.z, 5, 0xffe0a0, 6, .2);
    const d = Math.hypot(o.x - e.x, o.z - e.z) || 1; o.vx += (o.x - e.x) / d * 8; o.vz += (o.z - e.z) / d * 8;
  }
  if (e.team === 0) for (const n of W.nodes) if (n.hp > 0 && hitOk(n.x, n.z, 1.4)) mine(n, mech ? 3 : 1);
  if (e === body() || Math.hypot(e.x - cam.ex, e.z - cam.ez) < 60) sfx('swing');
}

/* 人と メカに 共通の 操作。プレイヤーも てきの AI も、同じ inp を わたして 動かす。 */
function control(e, inp, dt) {
  const st = e.st, mech = e.kind === 'mech', kind = st.kind, me = e === body();
  for (const k of TIMERS) if (e[k] > 0) e[k] -= dt;
  if (inp.mode && mech) {
    if (kind === 'ball') { e.mode = (e.mode + 1) % 4; if (me) UI.toast('[gear] モード: ' + BALL_MODES[e.mode]); }
    else if (kind === 'titan') { e.mode = e.mode ? 0 : 1; if (me) UI.toast(e.mode ? '[shield] たてモード！ まえからの こうげきを ほとんど ふせぐ' : '[gear] こうげきモード'); }
    else if (me) UI.toast('この メカに とくべつな モードは ないよ');
    if (me) sfx('ui');
  }
  let spd = st.spd;
  if (kind === 'ball') spd *= [1, 2.3, .3, 1.1][e.mode];
  if (kind === 'titan' && e.mode) spd *= .35;
  const sub = e.load.sub && WEAPONS[e.load.sub];
  e.blocking = !!(inp.sub && sub && sub.kind === 'shield');
  if (e.blocking) spd *= .7;
  e.aimYaw = inp.aimYaw; e.aimPitch = inp.aimPitch;
  const mt = st.turn * dt; e.yaw += clamp(angDiff(inp.aimYaw, e.yaw), -mt, mt);

  if (inp.dash && e.dcd <= 0) {
    e.dcd = 1.3; e.dashT = .42; const l = Math.hypot(inp.mx, inp.mz);
    if (l > .1) { e.dx = inp.mx / l; e.dz = inp.mz / l; } else { e.dx = Math.sin(e.aimYaw); e.dz = Math.cos(e.aimYaw); }
    if (me) sfx('dash');
  }
  if (inp.spin && e.qcd <= 0 && !(kind === 'ball' && e.mode)) { e.qcd = 2.5; e.spinT = .5; melee(e, true); }
  if (e.dashT > 0) {
    const v = spd * 2.4 + 6; e.vx = e.dx * v; e.vz = e.dz * v;
    if (mech) e.spinA += dt * Math.PI * 2 / .42; else e.rollA += dt * Math.PI * 2 / .42;
  } else {
    const ac = Math.min(1, (e.onGround ? 10 : 3) * dt);
    e.vx += (inp.mx * spd - e.vx) * ac; e.vz += (inp.mz * spd - e.vz) * ac;
    if (!mech) e.rollA = 0;
  }
  if (e.spinT > 0) e.spinA += dt * Math.PI * 4 / .5;
  else if (kind === 'ball' && e.mode === 3) e.spinA += dt * 15;
  else if (e.dashT <= 0) e.spinA = 0;
  const sp2 = Math.hypot(e.vx, e.vz);
  if (kind === 'ball' && e.mode === 1) e.rollA += sp2 * dt / (1.2 * e.spec.size);
  e.thrust = 0;
  if (inp.jump && e.onGround) { e.vy = st.jump; e.onGround = false; }
  else if (mech && inp.jumpHold && !e.onGround) { e.vy += (st.hover ? 34 : 15) * dt; if (st.hover && e.vy > 9) e.vy = 9; e.thrust = 1; }
  physics(e, dt);
  if (e.onGround) e.walk += sp2 * dt * (mech ? 1.1 / e.spec.size : 2.2);

  // たいあたり (ころがる・コマ)
  if (kind === 'ball' && (e.mode === 1 || e.mode === 3) && e.ramCd <= 0 && (sp2 > 8 || e.mode === 3)) {
    for (const o of ents.slice()) {
      if (o.team === e.team || o.team === 2 || o.dead || o.hidden) continue;
      const d = Math.hypot(o.x - e.x, o.z - e.z); if (d > e.r * 1.5 + o.r || Math.abs(o.y - e.y) > e.h) continue;
      hurt(o, (e.mode === 1 ? 4 * sp2 : 30) * st.melee * e.dmgMul, e); o.vx += (o.x - e.x) / (d || 1) * 12; o.vz += (o.z - e.z) / (d || 1) * 12;
      e.ramCd = .35; spark(o.x, o.y + o.h * .5, o.z, 6, 0xffe0a0, 7, .2);
    }
  }
  const canShoot = !(kind === 'ball' && e.mode === 1) && !(kind === 'titan' && e.mode === 1) && e.dashT <= 0 && e.swingT <= 0 && !(me && G.build.on);
  if (canShoot) {
    const mw = WEAPONS[e.load.main];
    if (inp.fire && mw && e.fcd <= 0) fireGun(e, mw, 1, inp);
    if (inp.sub && sub && sub.kind === 'gun' && e.scd <= 0) fireGun(e, sub, -1, inp);
  }
  if (inp.melee && e.mcd <= 0 && e.swingT <= 0) melee(e, false);
}

// ---------- てきの あたま ----------
function aiThink(e, dt) {
  const inp = e.inp, t = body(), a = e.ai;
  inp.fire = inp.sub = inp.melee = inp.dash = inp.spin = inp.mode = inp.jump = inp.jumpHold = false; inp.mx = inp.mz = 0; inp.aim = null;
  const dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz);
  if (!a.aggro) {
    if (d < a.sight && Math.abs(t.y - e.y) < 30 && !P.human.dead) { a.aggro = true; if (a.shout) UI.toast(a.shout); if (e.group) for (const m of e.group.members) m.ai.aggro = true; }
    a.wt -= dt; if (a.wt <= 0) { a.wt = rnd(2, 6); a.wa = rnd(6.28); a.wm = a.guard ? 0 : (Math.random() < .6 ? 1 : 0); }
    inp.aimYaw = a.wa; inp.aimPitch = 0; inp.mx = Math.sin(a.wa) * .3 * a.wm; inp.mz = Math.cos(a.wa) * .3 * a.wm;
    return inp;
  }
  if (d > 200 || P.human.dead) a.aggro = false;
  inp.aimYaw = Math.atan2(dx, dz); inp.aimPitch = Math.atan2(t.y + t.h * .55 - (e.y + (e.kind === 'mech' ? e.h * .62 : 1.4)), d);
  a.st -= dt;
  if (a.st <= 0) {
    a.st = rnd(1.5, 4); a.sdir = Math.random() < .5 ? -1 : 1; a.burst = rnd(.6, 1.8); a.pause = rnd(.5, 1.5) / (1 + a.tier * .2);
    if (Math.random() < .35) inp.dash = true; if (Math.random() < .2) inp.jump = true;
  }
  const fx_ = dx / (d || 1), fz = dz / (d || 1), f = d > a.range * 1.15 ? 1 : d < a.range * .6 ? -1 : 0;
  inp.mx = fx_ * f - fz * a.sdir * .6; inp.mz = fz * f + fx_ * a.sdir * .6;
  a.bt += dt;
  const mw = WEAPONS[e.load.main];
  if (mw && d < mw.range * .9 && a.bt % (a.burst + a.pause) < a.burst) {
    inp.fire = true; const er = a.err * d;
    inp.aim = { x: t.x + rnd(-er, er), y: t.y + t.h * .55 + rnd(-er, er) * .5, z: t.z + rnd(-er, er) };
  }
  if (d < (e.kind === 'mech' ? e.spec.size * 4 : 2.2) + t.r) { inp.melee = true; if (Math.random() < .02) inp.spin = true; }
  if (e.load.sub === 'shield' && a.bt % 6 > 4.5) inp.sub = true;
  a.mcd -= dt;
  if (e.st.kind === 'ball') { const want = d > 55 ? 1 : d > 16 ? 2 : 3; if (e.mode !== want && a.mcd <= 0) { inp.mode = true; a.mcd = .3; } }
  if (e.st.kind === 'titan') { const want = e.hp < e.maxhp * .5 && a.bt % 9 < 4 ? 1 : 0; if (e.mode !== want) inp.mode = true; }
  return inp;
}
function updDrone(e, dt) {
  const t = body(), a = e.ai, dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz);
  for (const k of ['fcd', 'flash']) if (e[k] > 0) e[k] -= dt;
  if (!a.aggro && d < a.sight) a.aggro = true;
  let mx = 0, mz = 0;
  if (a.aggro) {
    e.yaw = Math.atan2(dx, dz); const f = d > 26 ? 1 : d < 16 ? -1 : 0, ux = dx / (d || 1), uz = dz / (d || 1);
    mx = ux * f - uz * a.sdir * .7; mz = uz * f + ux * a.sdir * .7;
    if (e.fcd <= 0 && d < 70) {
      e.fcd = 1.2 - Math.min(.6, e.tier * .1); const er = a.err * d, ox = e.x, oy = e.y + .3, oz = e.z;
      let vx = t.x + rnd(-er, er) - ox, vy = t.y + t.h * .5 - oy, vz = t.z + rnd(-er, er) - oz; const l = Math.hypot(vx, vy, vz);
      shots.push({ x: ox, y: oy, z: oz, vx: vx / l * 70, vy: vy / l * 70, vz: vz / l * 70, life: 1.6, dmg: 8 * e.dmgMul * 2, team: 1, aoe: 0, g: 0, size: .16, col: 0xff6060, src: e, v: 70 });
      sfx('shot', d);
    }
    if (d > 220) a.aggro = false;
  }
  e.vx += (mx * 9 - e.vx) * Math.min(1, 2 * dt); e.vz += (mz * 9 - e.vz) * Math.min(1, 2 * dt);
  e.x += e.vx * dt; e.z += e.vz * dt;
  const want = Math.max(8, (a.aggro ? t.y : 0) + 8) + Math.sin(G.t * 1.3 + e.x) * 1.2; e.y += (want - e.y) * Math.min(1, dt);
  if (W.pointIn(e.x, e.y, e.z)) e.y += 12 * dt;
}
function updCitizen(e, dt) {
  const c = e.corner, dx = c.x - e.x, dz = c.z - e.z, d = Math.hypot(dx, dz);
  if (d < .6) {
    let n;
    if (Math.random() < .55) { const ax = Math.random() < .5; n = W.corners.find(q => q.i === c.i && q.j === c.j && q.sx === (ax ? -c.sx : c.sx) && q.sz === (ax ? c.sz : -c.sz)); }
    else { const ax = Math.random() < .5; n = W.corners.find(q => q.i === c.i + (ax ? c.sx : 0) && q.j === c.j + (ax ? 0 : c.sz) && q.sx === (ax ? -c.sx : c.sx) && q.sz === (ax ? c.sz : -c.sz)); }
    if (n) e.corner = n; return;
  }
  e.yaw = Math.atan2(dx, dz); e.x += dx / d * e.st.spd * dt; e.z += dz / d * e.st.spd * dt; e.walk += e.st.spd * dt * 2.2;
  const g = collide(e); e.y = g;
}

// ---------- ひこうき ----------
function updPlane(p, dt) {
  for (const k of ['fcd', 'bcd', 'flash', 'rollT']) if (p[k] > 0) p[k] -= dt;
  const piloted = P.state === 'plane' && P.plane === p, maxS = p.jet ? 100 : 62;
  let yawRate = 0;
  if (piloted) {
    p.thr = clamp(p.thr + ((IN.k.KeyW ? 1 : 0) - (IN.k.KeyS ? 1 : 0) + IN.sy) * dt * .7, 0, 1);
    const turn = (IN.k.KeyD ? 1 : 0) - (IN.k.KeyA ? 1 : 0) + IN.sx;
    yawRate = -(IN.mdx * .0024) / Math.max(dt, .001) - turn * 1.1;
    yawRate = clamp(yawRate, -2.2, 2.2) * clamp(p.speed / 20, .15, 1);
    p.yaw += yawRate * dt; p.pitch = clamp(p.pitch - IN.mdy * .0022, -1.1, 1.1); IN.mdx = IN.mdy = 0;
    if (IN.hit.KeyQ && p.rollT <= 0 && p.y > 3) { p.rollT = .7; sfx('dash'); }
    cam.yaw = p.yaw; cam.pitch = p.pitch * .7 - .12;
  } else p.thr = 0;
  const tgt = p.thr * maxS; p.speed += (tgt - p.speed) * dt * (tgt > p.speed ? .45 : .3);
  const air = p.y > .05;
  if (!air && p.speed < 24) p.pitch += (0 - p.pitch) * Math.min(1, 6 * dt);
  if (air && p.speed < 22) p.pitch -= dt * .5;
  const cp = Math.cos(p.pitch), fx_ = Math.sin(p.yaw) * cp, fy = Math.sin(p.pitch), fz = Math.cos(p.yaw) * cp;
  let vy = fy * p.speed; if (air && p.speed < 26) vy -= (26 - p.speed) * 1.1;
  p.x += fx_ * p.speed * dt; p.y += vy * dt; p.z += fz * p.speed * dt;
  if (p.rollT > 0) { p.x += -Math.cos(p.yaw) * 14 * dt * (yawRate > 0 ? -1 : 1); p.z += Math.sin(p.yaw) * 14 * dt * (yawRate > 0 ? -1 : 1); }
  p.roll += (clamp(-yawRate * .55, -1, 1) - p.roll) * Math.min(1, 4 * dt);
  p.vx = fx_ * p.speed; p.vz = fz * p.speed; p.prop += p.speed * dt * 2 + p.thr * dt * 20;
  if (p.y <= 0) { if (vy < -16 || p.pitch < -.55) hurt(p, 60 + -vy * 2, null); p.y = 0; if (p.pitch < 0) p.pitch *= .5; }
  if (p.y > 420) { p.y = 420; if (p.pitch > 0) p.pitch *= .9; }
  if (Math.abs(p.x) > 950 || Math.abs(p.z) > 950) { p.x = clamp(p.x, -950, 950); p.z = clamp(p.z, -950, 950); p.yaw += dt * 1.5; if (piloted && G.t % 3 < dt) UI.toast('ここから さきは いけない。ひきかえそう'); }
  if (p.speed > 3 && W.pointIn(p.x + fx_ * 3, p.y + 1.3, p.z + fz * 3)) { hurt(p, 70 + p.speed, null); p.x -= fx_ * 5; p.z -= fz * 5; p.speed = -4; boom(p.x + fx_ * 4, p.y + 1, p.z + fz * 4, 3); }
  if (!piloted || p.dead) return;
  if (IN.fire && p.fcd <= 0) {
    p.fcd = .08; const v = 210;
    for (const s of [-1, 1]) shots.push({ x: p.x - Math.cos(p.yaw) * s * 2.2 + fx_ * 3, y: p.y + 1, z: p.z + Math.sin(p.yaw) * s * 2.2 + fz * 3, vx: fx_ * v + rnd(-2, 2), vy: fy * v + rnd(-2, 2), vz: fz * v + rnd(-2, 2), life: 1.4, dmg: 18, team: 0, aoe: 0, g: 0, size: .22, col: 0xffe080, src: p, v });
    sfx('shot', 0);
  }
  if (IN.sub && p.bcd <= 0) {
    p.bcd = .7; shots.push({ x: p.x, y: p.y + .3, z: p.z, vx: p.vx * .9, vy: vy * .5 - 4, vz: p.vz * .9, life: 8, dmg: 110, team: 0, aoe: 10, g: 22, size: .6, col: 0x404850, src: p, v: p.speed });
    sfx('launch', 0);
  }
}

// ---------- のりおり ----------
function enterMech() { const m = P.mech; P.state = 'mech'; P.human.hidden = true; m.parked = false; m.aimYaw = cam.yaw; sfx('ui'); if (SV.quest === 2) SV.quest = 3; UI.toast('[mech] ' + m.name + ' に のった'); }
function enterPlane(p) { P.plane = p; P.state = 'plane'; P.human.hidden = true; p.parked = false; cam.yaw = p.yaw; sfx('ui'); UI.toast('[plane] W で スピードアップ、マウスを うえに うごかすと とびたつ'); }
function exitVehicle(forced) {
  const b = body(), h = P.human; if (b === h) return;
  const off = b.r + 1; h.x = b.x - Math.cos(b.yaw) * off; h.z = b.z + Math.sin(b.yaw) * off; h.y = b.y; h.vx = h.vz = h.vy = 0; h.yaw = b.yaw;
  h.hidden = false; h.chute = b.y > 4 || !b.onGround && P.state === 'plane';
  if (P.state === 'plane') { if (!forced) b.thr = 0; }
  b.parked = true; b.mode = 0; b.blocking = false;
  P.state = 'foot'; if (!forced) sfx('ui');
}
function callMech() {
  if (P.state !== 'foot') return;
  const m = P.mech;
  if (!m) return UI.toast('まだ メカを もっていない。[wrench]こうぼうで つくろう');
  if (m.broken > 0) return UI.toast('メカは しゅうりちゅう… あと ' + Math.ceil(m.broken) + 'びょう');
  if (G.callCd > 0) return UI.toast('よびだしは あと ' + Math.ceil(G.callCd) + 'びょう まってね');
  if (P.human.y > 1 && W.pointIn(P.human.x, P.human.y - .5, P.human.z)) { /* たてものの 上でも よべる */ }
  G.callCd = 15; m.x = P.human.x + Math.sin(cam.yaw) * 7; m.z = P.human.z + Math.cos(cam.yaw) * 7; m.y = P.human.y + 45; m.vx = m.vz = m.vy = 0;
  UI.toast('[call] メカを よんだ！ そらから おりてくる'); sfx('launch', 0);
}

// ---------- たてる ----------
function pieceBoxes(p) {
  const d = PIECES[p.t], th = -p.rot * Math.PI / 2, c = Math.round(Math.cos(th)), s = Math.round(Math.sin(th)), out = [];
  for (const b of d.boxes) {
    if (!b[7]) continue;
    const x = p.gx * 4 + b[0] * c + b[2] * s, z = p.gz * 4 - b[0] * s + b[2] * c, sx = s ? b[5] : b[3], sz = s ? b[3] : b[5], y = p.gy * 3 + b[1];
    out.push({ x0: x - sx / 2, x1: x + sx / 2, z0: z - sz / 2, z1: z + sz / 2, y0: y - b[4] / 2, y1: y + b[4] / 2 });
  }
  return out;
}
function addPiece(p) {
  p.boxes = pieceBoxes(p); for (const b of p.boxes) W.addBox(b);
  const u = PIECES[p.t].use;
  if (u === 'turret') G.turrets.push({ x: p.gx * 4, y: p.gy * 3, z: p.gz * 4, yaw: 0, cd: 0, fireFlash: 0, p });
  else if (u) G.usePieces.push(p);
}
function removePiece(p) {
  for (const b of p.boxes) W.removeBox(b);
  SV.pieces.splice(SV.pieces.indexOf(p), 1); G.turrets = G.turrets.filter(t => t.p !== p); G.usePieces = G.usePieces.filter(q => q !== p);
  for (const k in PIECES[p.t].cost) SV.mats[k] += PIECES[p.t].cost[k];
}
const edgePiece = (t) => ['wall', 'door', 'window', 'bigwall'].includes(PIECES[t].id);
function updBuild() {
  const B_ = G.build, b = body();
  if (IN.hit.KeyB && P.state !== 'plane') { B_.on = !B_.on; UI.buildBar(); sfx('ui'); if (B_.on && W.inCity(b.x, b.z, 6)) UI.toast('まちの なかには たてられない。まちの そとへ 出よう'); }
  if (!B_.on) { B_.ghost = null; return; }
  if (IN.wheel) { B_.t = (B_.t + (IN.wheel > 0 ? 1 : -1) + PIECES.length) % PIECES.length; UI.buildBar(); }
  if (IN.hit.KeyR) { B_.rot = (B_.rot + 1) % 4; }
  if (IN.hit.KeyT) { B_.lvl = Math.min(8, B_.lvl + 1); UI.buildBar(); }
  if (IN.hit.KeyG) { B_.lvl = Math.max(0, B_.lvl - 1); UI.buildBar(); }
  if (IN.hit.KeyC) { B_.col = (B_.col + 1) % BUILD_COLS.length; UI.buildBar(); }
  const cy = Math.cos(cam.pitch), dx = Math.sin(cam.yaw) * cy, dy = Math.sin(cam.pitch), dz = Math.cos(cam.yaw) * cy, py = B_.lvl * 3;
  let t = dy < -.05 ? (py - cam.ey) / dy : 14; t = clamp(t, 3, 30 + Math.hypot(cam.ex - b.x, cam.ez - b.z));
  const g = { t: B_.t, gx: Math.round((cam.ex + dx * t) / 4), gy: B_.lvl, gz: Math.round((cam.ez + dz * t) / 4), rot: B_.rot, col: B_.col };
  const same = SV.pieces.find(p => p.gx === g.gx && p.gy === g.gy && p.gz === g.gz && p.t === g.t && (!edgePiece(g.t) || p.rot === g.rot));
  const x = g.gx * 4, z = g.gz * 4;
  B_.ok = !same && canPay(PIECES[g.t].cost) && !W.inCity(x, z, 6) && !W.inAirport(x, z) && Math.hypot(x - b.x, z - b.z) > b.r + 1.5;
  B_.ghost = g;
  if (IN.hit.fire) {
    if (B_.ok) { pay(PIECES[g.t].cost); SV.pieces.push(g); addPiece(g); sfx('build'); if (SV.quest === 4) SV.quest = 5; save(); UI.buildBar(); }
    else UI.toast(same ? 'そこには もう ある' : !canPay(PIECES[g.t].cost) ? 'ざいりょうが たりない (' + costText(PIECES[g.t].cost) + ')' : 'ここには たてられない');
  }
  if (IN.hit.sub) {
    const p = same || SV.pieces.slice().reverse().find(q => q.gx === g.gx && q.gy === g.gy && q.gz === g.gz);
    if (p) { removePiece(p); sfx('hit'); save(); UI.buildBar(); }
  }
}
function updTurrets(dt) {
  for (const t of G.turrets) {
    t.cd -= dt; t.fireFlash -= dt;
    const e = nearestEnemy(t.x, t.z, 60); if (!e) continue;
    t.yaw = Math.atan2(e.x - t.x, e.z - t.z);
    if (t.cd <= 0) {
      t.cd = .22; t.fireFlash = .06; const ox = t.x, oy = t.y + 1.5, oz = t.z; let vx = e.x - ox, vy = e.y + e.h * .5 - oy, vz = e.z - oz; const l = Math.hypot(vx, vy, vz);
      shots.push({ x: ox + vx / l * 1.5, y: oy, z: oz + vz / l * 1.5, vx: vx / l * 120, vy: vy / l * 120, vz: vz / l * 120, life: .7, dmg: 9, team: 0, aoe: 0, g: 0, size: .14, col: 0x80ffa0, src: t, v: 120 });
    }
  }
}

// ---------- しごと ----------
function startJob(type) {
  if (G.job) return UI.toast('いまの しごとを さきに おわらせよう');
  if (type === 'deliver') {
    const a = pick(W.corners); let b = pick(W.corners); for (let i = 0; i < 20 && Math.hypot(a.x - b.x, a.z - b.z) < 120; i++) b = pick(W.corners);
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    G.job = { type, stage: 0, a, b, pay: Math.round(120 + d * .9), t: 0, limit: 25 + d / 5, name: 'はいたつ' };
    UI.toast('[box] にもつを うけとりに いこう (あおい ひかり)');
  } else if (type === 'bounty') {
    if (!SV.mechs.length) return UI.toast('メカを もってから うけよう');
    const tier = Math.min(6, 1 + Math.floor(SV.rank / 2)), e = spawnEnemyMech(rnd(-320, 320), rnd(300, 560), tier, true);
    e.ai.keep = true; G.job = { type, target: e, pay: 700 + 300 * SV.rank, name: 'おたずねもの たいじ' };
    UI.toast('[target] みなみの こうやに おたずねものが いる！');
  } else if (type === 'dealer') {
    if (!G.groups.length) spawnGroup(true);
    const g = G.groups[0]; if (!g) return UI.toast('いまは やみしょうにんの じょうほうが ない');
    G.job = { type, group: g, pay: 400 + 100 * SV.rank, name: 'やみしょうにん たいじ' };
    UI.toast('[dealer] マンションの うらろじに やみしょうにんが いる！');
  }
  save();
}
function jobDone(payAmt, name) {
  SV.money += payAmt; SV.jobs++; addXp(30); G.job = null; if (SV.quest === 3) SV.quest = 4;
  UI.toast('[check] ' + name + ' かんりょう！ [money]+' + payAmt); sfx('coin'); save();
}
function updJob(dt) {
  const j = G.job; if (!j) return;
  const b = body();
  if (j.type === 'deliver') {
    j.t += dt; const p = j.stage ? j.b : j.a;
    if (Math.hypot(b.x - p.x, b.z - p.z) < 5 + b.r) {
      if (!j.stage) { j.stage = 1; j.t = 0; UI.toast('[box] にもつを うけとった！ とどけさきへ いそげ'); sfx('ui'); }
      else jobDone(Math.round(j.pay * (j.t < j.limit ? 1.5 : 1)), j.t < j.limit ? 'はいたつ (スピード ボーナス！)' : 'はいたつ');
    }
  }
}
function spawnGroup(force) {
  const used = G.groups.map(g => g.alley), h = P.human;
  const cand = W.alleys.filter(a => !used.includes(a) && (force || Math.hypot(a.x - h.x, a.z - h.z) > 70));
  if (!cand.length) return;
  const a = pick(cand), tier = Math.min(5, Math.floor(SV.rank / 3)), g = { alley: a, members: [] };
  g.members.push(spawnThug(a.x, a.z, tier, true, g));
  for (let i = 0; i < 2 + Math.min(2, tier); i++) { const an = rnd(6.28); g.members.push(spawnThug(a.x + Math.sin(an) * 2.2, a.z + Math.cos(an) * 2.2, tier, false, g)); }
  for (const m of g.members) m.y = .2;
  G.groups.push(g);
}
function spawnTick() {
  const b = body(), reg = W.region(b.x, b.z);
  // 遠くの てきは けす
  for (const e of ents.slice()) if (e.team === 1 && !e.group && !(e.ai && e.ai.keep) && Math.hypot(e.x - b.x, e.z - b.z) > 430) ents.splice(ents.indexOf(e), 1);
  if (G.groups.length < 3 && G.groupT <= 0) { spawnGroup(false); G.groupT = 20; }
  if (!SV.mechs.length || reg === 'city' || reg === 'airport') return;
  const wild = ents.filter(e => e.team === 1 && !e.group && !e.boss).length;
  const rk = Math.floor(SV.rank / 3), far = Math.hypot(b.x, b.z) > 480 ? 1 : 0;
  const cfg = { grass: [2, 0], junk: [2, 0], rock: [3, 0], waste: [Math.min(9, 5 + SV.rank / 2), 1] }[reg];
  if (wild >= cfg[0]) return;
  for (let i = 0; i < 8; i++) {
    const an = rnd(6.28), d = rnd(110, 170), x = b.x + Math.sin(an) * d, z = b.z + Math.cos(an) * d;
    if (W.inCity(x, z, 30) || W.inAirport(x, z) || Math.abs(x) > W.size - 20 || Math.abs(z) > W.size - 20) continue;
    const tier = Math.min(6, cfg[1] + rk + far);
    if (reg === 'junk' || Math.random() < .3) spawnDrone(x, z, tier); else spawnEnemyMech(x, z, tier, false);
    return;
  }
}

// ---------- プレイヤー ----------
function interact() {
  const pr = G.prompt; if (pr && pr.act) pr.act();
}
function findPrompt() {
  const b = body(); G.prompt = null;
  if (G.build.on) return;
  for (const f of W.facilities) if (Math.hypot(f.x - b.x, f.z - b.z) < f.r + b.r) { G.prompt = { text: 'E: ' + f.icon + ' ' + f.name, act: () => UI.open(f.id) }; return; }
  for (const p of G.usePieces) {
    if (Math.hypot(p.gx * 4 - b.x, p.gz * 4 - b.z) > 2.6 + b.r || Math.abs(p.gy * 3 - b.y) > 2) continue;
    if (PIECES[p.t].use === 'pad') { G.prompt = { text: 'E: [wrench] こうぼう (じぶんの きち)', act: () => UI.open('workshop') }; return; }
    if (P.state === 'foot') { G.prompt = { text: 'E: [bed] ねる (あさまで やすむ)', act: () => sleep(p) }; return; }
  }
  if (P.state === 'foot') {
    const m = P.mech;
    if (m && !m.hidden && Math.hypot(m.x - b.x, m.z - b.z) < m.r + 2.5) { G.prompt = { text: 'E: [mech] ' + m.name + ' に のる', act: enterMech }; return; }
    for (const p of G.planes) if (!p.hidden && Math.hypot(p.x - b.x, p.z - b.z) < 6 && Math.abs(p.y - b.y) < 4) { G.prompt = { text: 'E: [plane] ' + p.name + ' に のる', act: () => enterPlane(p) }; return; }
  } else G.prompt = { text: P.state === 'plane' && b.y > 4 ? 'E: とびおりる (パラシュート)' : 'E: おりる', act: () => exitVehicle(false) };
}
function sleep(p) {
  SV.time = .27; P.human.hp = P.human.maxhp; SV.bed = { x: p.gx * 4 + 1.6, y: p.gy * 3, z: p.gz * 4 }; save();
  UI.toast('[bed] ぐっすり ねた。あさに なった！ (やられたら ここに もどる)'); sfx('coin');
}
function useKit() {
  const b = body();
  if (SV.kits <= 0) return UI.toast('リペアキットが ない。[food]しょくどうで かえる');
  if (b.hp >= b.maxhp) return UI.toast('たいりょくは まんたん');
  SV.kits--; b.hp = Math.min(b.maxhp, b.hp + b.maxhp * .5); sfx('coin'); UI.toast('[kit] かいふくした (のこり ' + SV.kits + ')');
}
function updPlayer(dt) {
  const b = body(), h = P.human;
  if (G.deadT > 0) {
    G.deadT -= dt;
    if (G.deadT <= 0) {
      h.dead = false; h.hidden = false; h.hp = h.maxhp; const s = SV.bed || { x: 0, y: .2, z: 0 }; h.x = s.x; h.y = s.y; h.z = s.z; h.vx = h.vy = h.vz = 0;
      const loss = Math.round(SV.money * .1); SV.money -= loss; if (loss) UI.toast('[money] ちりょうひ ' + loss + ' を はらった'); save();
    }
    return;
  }
  if (IN.hit.KeyE) interact();
  if (IN.hit.KeyH) useKit();
  if (IN.hit.KeyC && !G.build.on) callMech();
  if (P.state === 'plane') return;
  cam.yaw -= IN.mdx * .0026; cam.pitch = clamp(cam.pitch - IN.mdy * .0026, -1.25, 1.3); IN.mdx = IN.mdy = 0;
  const f = (IN.k.KeyW ? 1 : 0) - (IN.k.KeyS ? 1 : 0) + IN.sy, s = (IN.k.KeyD ? 1 : 0) - (IN.k.KeyA ? 1 : 0) + IN.sx;
  const sn = Math.sin(cam.yaw), cs = Math.cos(cam.yaw);
  let mx = sn * f - cs * s, mz = cs * f + sn * s; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  const inp = b.inp, bd = G.build.on;
  inp.mx = mx; inp.mz = mz; inp.aimYaw = cam.yaw; inp.aimPitch = clamp(cam.pitch, -1, 1); inp.aim = G.aim;
  inp.fire = IN.fire && !bd; inp.sub = IN.sub && !bd; inp.melee = !!IN.hit.KeyF; inp.jump = !!IN.hit.Space; inp.jumpHold = !!IN.k.Space;
  inp.dash = !!(IN.hit.ShiftLeft || IN.hit.ShiftRight); inp.spin = !!IN.hit.KeyQ; inp.mode = !!IN.hit.KeyR && !bd;
  if (b.chute && b.vy < -4) b.vy = -4;
  control(b, inp, dt);
  // かいふく
  if (G.t - G.lastHurt > 7 && b.hp < b.maxhp) b.hp = Math.min(b.maxhp, b.hp + b.maxhp * .03 * dt);
}

// ---------- 1 コマ すすめる ----------
function update(dt) {
  G.t += dt; SV.time = (SV.time + dt / 600) % 1;
  if (G.hitT > 0) G.hitT -= dt; if (G.callCd > 0) G.callCd -= dt; if (G.lockT > 0) { G.lockT -= dt; if (G.lockT <= 0) G.lock = null; }
  if (G.lock && G.lock.dead) G.lock = null;
  G.groupT -= dt;
  updBuild(); findPrompt(); updPlayer(dt);
  for (const e of ents.slice()) {
    if (e.dead && !e.broken) continue;
    if (e.broken > 0) { e.broken -= dt; if (e.broken <= 0) { e.dead = false; e.hidden = false; e.hp = e.maxhp; e.parked = true; if (e.kind === 'plane') { e.x = e.spot.x; e.z = e.spot.z; e.y = 0; e.yaw = e.spot.yaw; e.pitch = 0; e.speed = 0; } else { e.x = P.human.x + 4; e.z = P.human.z; e.y = P.human.y + 40; UI.toast('[wrench] メカの しゅうりが おわった！'); } } continue; }
    if (e.kind === 'plane') { updPlane(e, dt); continue; }
    if (e === body()) continue;
    if (e.citizen) { if (Math.hypot(e.x - cam.ex, e.z - cam.ez) < 220) updCitizen(e, dt); continue; }
    if (e.kind === 'drone') { updDrone(e, dt); continue; }
    if (e.parked || e === P.human) { if (!e.hidden) { e.vx *= .8; e.vz *= .8; physics(e, dt); for (const k of TIMERS) if (e[k] > 0) e[k] -= dt; e.spinA = 0; } continue; }
    if (e.ai) { if (Math.hypot(e.x - cam.ex, e.z - cam.ez) < 320 || e.ai.keep) control(e, aiThink(e, dt), dt); }
  }
  updTurrets(dt); updJob(dt);
  // たま
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; let done = false;
    const n = Math.max(1, Math.ceil(s.v * dt / .9)), h = dt / n;
    if (s.tgt && !s.tgt.dead) {
      const dx = s.tgt.x - s.x, dy = s.tgt.y + s.tgt.h * .5 - s.y, dz = s.tgt.z - s.z, l = Math.hypot(dx, dy, dz) || 1, k = Math.min(1, 3.5 * dt);
      s.vx += (dx / l * s.v - s.vx) * k; s.vy += (dy / l * s.v - s.vy) * k; s.vz += (dz / l * s.v - s.vz) * k;
    }
    for (let j = 0; j < n && !done; j++) {
      s.vy -= s.g * h; s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h; s.life -= h;
      let hit = null;
      if (s.life <= 0 || s.y <= 0 || W.pointIn(s.x, s.y, s.z)) done = true;
      else for (const e of ents) {
        if (e.team === s.team || e.team === 2 || e.dead || e.hidden || e.parked) continue;
        const dx = e.x - s.x, dz = e.z - s.z, rr = e.r + s.size;
        if (dx * dx + dz * dz < rr * rr && s.y > e.y - .2 && s.y < e.y + e.h + .2) { hit = e; done = true; break; }
      }
      if (!done && s.team === 0 && s.y < 3) for (const nd of W.nodes) if (nd.hp > 0 && Math.abs(nd.x - s.x) < 1.5 && Math.abs(nd.z - s.z) < 1.5) { mine(nd, 1); done = true; break; }
      if (done) {
        if (s.aoe) explode(s.x, Math.max(.3, s.y), s.z, s.aoe, s.dmg, s.team, s.src);
        else { if (hit) hurt(hit, s.dmg, s.src); if (!s.flame && s.life > 0) spark(s.x, s.y, s.z, 2, 0xffe0a0, 4, .12, .25); }
      }
    }
    if (s.flame) s.size += dt * 3;
    if ((s.aoe || s.tgt) && fx.length < 480 && Math.random() < .7) fx.push({ x: s.x, y: s.y, z: s.z, vx: 0, vy: .5, vz: 0, life: .5, max: .5, size: .5, col: 0x8a8a90, type: 2 });
    if (done) shots.splice(i, 1);
  }
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.life -= dt; if (f.life <= 0) { fx.splice(i, 1); continue; } f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; if (f.type === 0) f.vy -= 14 * dt; }
  for (let i = beams.length - 1; i >= 0; i--) { beams[i].life -= dt; if (beams[i].life <= 0) beams.splice(i, 1); }
  for (const n of W.nodes) if (n.hp <= 0) { n.t -= dt; if (n.t <= 0) n.hp = n.max; }
  G.spawnT -= dt; if (G.spawnT <= 0) { G.spawnT = 1.2; spawnTick(); }
  // きちへの しゅうげき
  if (G.turrets.length || SV.bed) {
    G.raidT -= dt;
    if (G.raidT <= 0) {
      G.raidT = 300 + rnd(120); const b = body(), base = SV.bed || G.turrets[0];
      if (Math.hypot(base.x - b.x, base.z - b.z) < 160 && !W.inCity(b.x, b.z)) {
        const n = 2 + Math.min(4, Math.floor(SV.rank / 2)), an = rnd(6.28);
        for (let i = 0; i < n; i++) { const e = spawnEnemyMech(base.x + Math.sin(an + i * .3) * 110, base.z + Math.cos(an + i * .3) * 110, Math.min(6, Math.floor(SV.rank / 3) + 1), false); e.ai.aggro = true; }
        UI.toast('[warn] しゅうげきだ！ ならずものが きちに むかってくる！'); sfx('boom', 0);
      }
    }
  }
  // チュートリアル
  if (SV.quest === 0 && SV.mats.scrap >= 20) { SV.quest = 1; UI.toast('[scrap] スクラップが あつまった！ ひろばの [wrench]こうぼうへ'); }
  if (SV.quest <= 1 && SV.mechs.length) SV.quest = 2;
  for (const k in IN.hit) IN.hit[k] = false; IN.wheel = 0;
}
function questInfo() {
  const b = body();
  switch (SV.quest) {
    case 0: return { text: 'きたの スクラップおきばで スクラップを 20こ あつめよう (F で たたく)  ' + SV.mats.scrap + '/20', x: 0, z: -222 };
    case 1: return { text: 'ひろばの [wrench]こうぼうで じぶんの メカを つくろう', x: W.facilities[0].x, z: W.facilities[0].z };
    case 2: return P.mech ? { text: 'メカに ちかづいて E で のろう (C で よびだせる)', x: P.mech.x, z: P.mech.z } : null;
    case 3: return { text: 'ひろばの [jobs]しごと あんないで しごとを うけて おかねを かせごう', x: W.facilities[3].x, z: W.facilities[3].z };
    case 4: return { text: 'まちの そとで B を おして じぶんの きちを たてよう', x: b.x, z: b.z, none: true };
    default: return null;
  }
}

// ---------- カメラと 描画 ----------
function updateCamera(dt) {
  if (G.title) {
    G.pvAng += dt * .12; cam.tx = 0; cam.ty = 4.5; cam.tz = 0; cam.ex = Math.sin(G.pvAng) * 13.5; cam.ey = 2.6; cam.ez = Math.cos(G.pvAng) * 13.5; cam.shadowR = 90; return;
  }
  if (G.preview) {
    G.pvAng += dt * .5; const s = G.preview.size || 1, d = 9 * s + 4, sr = W.showroom, h = 2.4 * s;
    cam.tx = sr.x - Math.cos(G.pvAng) * d * .38; cam.ty = h; cam.tz = sr.z + Math.sin(G.pvAng) * d * .38;
    cam.ex = sr.x + Math.sin(G.pvAng) * d; cam.ey = h + 2 * s; cam.ez = sr.z + Math.cos(G.pvAng) * d; cam.shadowR = 40; return;
  }
  const b = body(), cy = Math.cos(cam.pitch), dx = Math.sin(cam.yaw) * cy, dy = Math.sin(cam.pitch), dz = Math.cos(cam.yaw) * cy;
  let dist, h, side;
  if (P.state === 'plane') { dist = 17; h = 3.6; side = 0; }
  else if (b.kind === 'mech') { const z = b.spec.size; dist = 7.5 * z + 3.5; h = b.h * .82; side = 1.5 * z; }
  else { dist = 4.4; h = 1.65; side = .65; }
  const tx = b.x - Math.cos(cam.yaw) * side, ty = b.y + h, tz = b.z + Math.sin(cam.yaw) * side;
  let d = dist;
  for (let t = .6; t < dist; t += .6) if (ty - dy * t < .25 || W.pointIn(tx - dx * t, ty - dy * t, tz - dz * t)) { d = Math.max(.8, t - .6); break; }
  cam.ex = tx - dx * d; cam.ey = ty - dy * d; cam.ez = tz - dz * d; cam.tx = tx; cam.ty = ty; cam.tz = tz; cam.shadowR = P.state === 'plane' ? 140 : 90;
  let far = W.raycast(tx, ty, tz, dx, dy, dz, 300);
  const hit = rayEnts(tx, ty, tz, dx, dy, dz, far, 0);
  if (hit) { far = hit.t; G.lock = hit.e; G.lockT = 1.5; }
  G.aim.x = tx + dx * far; G.aim.y = ty + dy * far; G.aim.z = tz + dz * far;
}
function environment() {
  const a = (SV.time - .25) * Math.PI * 2; let sx = Math.cos(a) * .9, sy = Math.sin(a), sz = .38;
  const l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l;
  const sm = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const day = sm(-.12, .22, sy), night = 1 - day, mix3 = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)];
  let lx = sx, ly = sy, lz = sz; if (sy < 0) { lx = -sx; ly = -sy; }
  if (ly < .16) { ly = .16; const k = Math.hypot(lx, ly, lz); lx /= k; ly /= k; lz /= k; }
  const warm = sm(0, .45, sy), sunCol = mix3([1, .5, .25], [1, .95, .86], warm);
  const li = sy > 0 ? sm(0, .18, sy) : sm(0, .2, -sy) * .28;
  const lightCol = sy > 0 ? sunCol.map(v => v * li * .78) : [.5 * li, .6 * li, 1 * li];
  const dusk = clamp(1 - Math.abs(sy) / .3, 0, 1) * .65;
  return {
    lx, ly, lz, lightCol, sun: [sx, sy, sz], moon: [-sx, -sy, sz], night, time: G.t,
    ambS: mix3([.17, .2, .32], [.38, .44, .56], day), ambG: mix3([.09, .09, .14], [.24, .22, .2], day),
    top: mix3([.02, .03, .09], [.2, .44, .88], day), hor: mix3(mix3([.07, .09, .17], [.7, .82, .95], day), [.95, .55, .32], dusk),
    sunCol: sunCol.map(v => v * sm(-.1, .1, sy)),
  };
}
function drawEnt(e) {
  if (e.kind === 'mech') drawMech(e); else if (e.kind === 'human') drawHuman(e); else if (e.kind === 'plane') drawPlane(e); else drawDrone(e);
}
function render(dt) {
  updateCamera(dt);
  R.begin();
  const cx = cam.tx, cz = cam.tz;
  for (const e of ents) {
    if (e.hidden || e.dead) continue;
    const d = Math.hypot(e.x - cx, e.z - cz); if (d > (e.kind === 'human' ? 170 : 420)) continue;
    drawEnt(e);
  }
  for (const n of W.nodes) if (n.hp > 0 && Math.hypot(n.x - cx, n.z - cz) < 240) drawNode(n);
  for (const p of SV.pieces) if (Math.hypot(p.gx * 4 - cx, p.gz * 4 - cz) < 380) drawPiece(p, 0);
  for (const t of G.turrets) drawTurret(t);
  for (const g of G.groups) { const a = g.alley; if (Math.hypot(a.x - cx, a.z - cz) < 150) { B(a.x + 1.4, .7, a.z, 1.6, 1, 1, 0x6a4a2a); B(a.x + 1.4, 1.35, a.z, 1.2, .3, .7, 0x303038); S(a.x + 1.4, 2.4, a.z, .3, .3, .3, 0xb060ff, 1); } }
  R.glow(1);
  for (const f of W.facilities) if (Math.hypot(f.x - cx, f.z - cz) < 200) C(f.x, f.y + .1, f.z, f.r * 2, .12, f.r * 2, f.col, .35 + Math.sin(G.t * 3) * .1);
  R.glow(0);
  for (const s of shots) {
    if (s.flame) { R.glow(1); S(s.x, s.y, s.z, s.size, s.size, s.size, s.col, .5); R.glow(0); continue; }
    const k = Math.hypot(s.vx, s.vy, s.vz) || 1; R.push(); R.translate(s.x, s.y, s.z); R.rotY(Math.atan2(s.vx, s.vz)); R.rotX(-Math.asin(clamp(s.vy / k, -1, 1)));
    B(0, 0, 0, s.size, s.size, s.aoe ? s.size * 3 : s.size * 9, s.col, 1); R.pop();
    if (s.size > .3) { R.glow(1); S(s.x, s.y, s.z, s.size * 3, s.size * 3, s.size * 3, s.col, .35); R.glow(0); }
  }
  for (const f of fx) {
    const k = f.life / f.max;
    if (f.type === 0) B(f.x, f.y, f.z, f.size * k, f.size * k, f.size * k, f.col, 1);
    else if (f.type === 1) { R.glow(1); const s = f.size * (2.2 - k * 1.4); S(f.x, f.y, f.z, s, s, s, f.col, k * .9); R.glow(0); }
    else { const s = f.size * (2 - k); S(f.x, f.y, f.z, s, s, s, f.col, 0); }
  }
  R.glow(1);
  for (const b of beams) {
    const dx = b.x1 - b.x0, dy = b.y1 - b.y0, dz = b.z1 - b.z0, l = Math.hypot(dx, dy, dz) || 1, k = b.life / b.max;
    R.push(); R.translate((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2); R.rotY(Math.atan2(dx, dz)); R.rotX(-Math.asin(clamp(dy / l, -1, 1)));
    B(0, 0, 0, b.w * k, b.w * k, l, b.col, 1); R.pop();
  }
  R.glow(0);
  G.beacons.length = 0;
  const q = questInfo(); if (q && !q.none) G.beacons.push({ x: q.x, z: q.z, col: 0xffd040, label: 'もくひょう' });
  const j = G.job;
  if (j) {
    if (j.type === 'deliver') { const p = j.stage ? j.b : j.a; G.beacons.push({ x: p.x, z: p.z, col: j.stage ? 0x60ff80 : 0x40a0ff, label: j.stage ? 'とどけさき' : 'にもつ' }); }
    else if (j.type === 'bounty' && !j.target.dead) G.beacons.push({ x: j.target.x, z: j.target.z, col: 0xff4040, label: 'おたずねもの' });
    else if (j.type === 'dealer') G.beacons.push({ x: j.group.alley.x, z: j.group.alley.z, col: 0xb060ff, label: 'やみしょうにん' });
  }
  for (const b of G.beacons) drawBeacon(b.x, 0, b.z, b.col, G.t);
  if (G.build.ghost) drawPiece(G.build.ghost, G.build.ok ? 1 : 2);
  if (G.preview) { const pv = G.pv || (G.pv = baseEnt('mech', 0, W.showroom.x, W.showroom.z)); pv.spec = G.preview; pv.st = mechStats(G.preview); pv.load = SV.load; pv.walk = G.t * 2; pv.aimYaw = pv.yaw = 0; drawMech(pv); }
  R.render(cam, environment());
}

// ---------- 効果音 (ブラウザの シンセ) ----------
let AC = null, noiseBuf = null; let soundOn = true;
function sfx(name, dist) {
  if (!soundOn) return;
  try {
    if (!AC) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return; AC = new A(); noiseBuf = AC.createBuffer(1, AC.sampleRate * .5, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    if (AC.state === 'suspended') return;
    const vol = (dist ? clamp(1 - dist / 120, 0, 1) : 1) * .22; if (vol <= .01) return;
    const t = AC.currentTime, g = AC.createGain(); g.connect(AC.destination);
    const P_ = { shot: [0, 900, 200, .07], laser: [1, 1400, 500, .12], launch: [0, 300, 80, .3], boom: [0, 160, 30, .6], hit: [2, 300, 150, .06], swing: [0, 500, 1200, .12], dash: [0, 300, 900, .2], coin: [1, 880, 1320, .16], ui: [1, 520, 660, .07], build: [2, 180, 240, .1] }[name] || [1, 440, 440, .1];
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + P_[3]);
    if (P_[0] === 0) { const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(P_[1], t); f.frequency.exponentialRampToValueAtTime(P_[2], t + P_[3]); s.connect(f); f.connect(g); s.start(t); s.stop(t + P_[3]); }
    else { const o = AC.createOscillator(); o.type = P_[0] === 1 ? 'square' : 'triangle'; o.frequency.setValueAtTime(P_[1], t); o.frequency.exponentialRampToValueAtTime(P_[2], t + P_[3]); o.connect(g); o.start(t); o.stop(t + P_[3]); }
  } catch (e) { /* 音が 出せない たんまつ */ }
}

// ---------- はじめる ----------
function startGame() {
  ents = []; shots = []; fx = []; beams = []; G.planes = []; G.turrets = []; G.usePieces = []; G.groups = []; G.job = null;
  P.human = mkHuman(0, 0, 0); P.human.load = SV.load; P.human.y = .2; P.state = 'foot'; P.mech = null; P.plane = null;
  if (SV.bed) { P.human.x = SV.bed.x; P.human.y = SV.bed.y; P.human.z = SV.bed.z; }
  ents.push(P.human);
  if (SV.mechs.length) spawnPlayerMech(P.human.x + 5, P.human.z + 3);
  W.planeSpots.forEach((s, i) => { if (i < 2 || SV.jet) mkPlane(s, i === 2); });
  for (const p of SV.pieces) addPiece(p);
  for (let i = 0; i < 16; i++) spawnCitizen();
  G.running = true;
}
