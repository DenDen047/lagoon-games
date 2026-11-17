/* MECH FRONTIER の生活まわり: 住人・車・家と泥棒・警察 (手配度)・空腹と眠気・仕事・話しかける相手さがし */
'use strict';

// ---------- 手配度と警察 ----------
function addWanted(n, why) {
  const before = G.wanted; G.wanted = Math.min(3, G.wanted + n); G.wantedT = 40;
  if (G.wanted > before) { UI.toast('[police] 手配度 ' + G.wanted + (why ? '　' + why : '')); sfx('boom', 0); }
}
function clearPolice(msg) {
  G.wanted = 0; for (const e of ents.slice()) if (e.police) ents.splice(ents.indexOf(e), 1);
  if (msg) UI.toast(msg);
}
function spawnPolice() {
  const b = body(), an = rnd(6.28), d = rnd(38, 60), x = b.x + Math.sin(an) * d, z = b.z + Math.cos(an) * d;
  if (W.pointIn(x, 1, z) || W.houseAt(x, z)) return;
  if (G.wanted >= 3 && !ents.some(e => e.police && e.kind === 'mech')) {
    const m = spawnEnemyMech(x, z, 2, false); m.police = true; m.name = '警察メカ'; m.spec.c1 = 0; m.spec.c2 = 8; m.ai.aggro = true; m.ai.keep = true; return;
  }
  const e = mkHuman(1, x, z, OUTFIT_POLICE); e.hp = e.maxhp = 90; e.dmgMul = .5; e.tier = 1; e.police = true; e.name = '警官';
  e.load = { main: G.wanted >= 2 ? 'mg' : 'pistol', sub: null, melee: 'pipe' }; e.ai = mkAi(1, 14, 200); e.ai.aggro = true; e.ai.keep = true; ents.push(e);
}
function updWanted(dt) {
  if (G.wanted <= 0) return;
  const b = body(); let near = 1e9, n = 0;
  for (const e of ents.slice()) {
    if (!e.police || e.dead) continue;
    const d = Math.hypot(e.x - b.x, e.z - b.z);
    if (d > 150) { ents.splice(ents.indexOf(e), 1); continue; }
    n++; near = Math.min(near, d);
  }
  if (near > 55) G.wantedT -= dt; else G.wantedT = Math.max(G.wantedT, 18);
  G.polT -= dt; if (G.polT <= 0 && n < G.wanted * 2 + (G.wanted >= 3 ? 1 : 0)) { G.polT = 2.5; spawnPolice(); }
  if (G.wantedT <= 0) { G.wanted--; G.wantedT = 22; if (G.wanted <= 0) clearPolice('警察は追跡をあきらめた'); }
}

// ---------- 住人 ----------
function spawnCitizen(k) {
  const n = W.walk[k], e = mkHuman(2, n.x + rnd(-1, 1), n.z + rnd(-1, 1), rndOutfit());
  e.y = n.y; e.node = k; e.prev = -1; e.st.spd = 1.5 + rnd(1.2); e.citizen = true; e.hp = e.maxhp = 60; e.sc = .92 + rnd(.14); e.name = '住人';
  e.walk = rnd(6); e.ox = rnd(-1.3, 1.3); e.oz = rnd(-1.3, 1.3);
  ents.push(e); return e;
}
function updCitizen(e, dt) {
  if (e.flash > 0) e.flash -= dt;
  if (e.ko > 0) { e.ko -= dt; if (e.ko <= 0) { e.down = false; e.hp = e.maxhp; e.far = true; } return; }
  if (e.resident) return;
  if (e.pause > 0) { e.pause -= dt; return; }
  const b = body(); let tx, tz, spd = e.st.spd;
  if (e.flee > 0) { e.flee -= dt; tx = e.x * 2 - b.x; tz = e.z * 2 - b.z; spd = 6.5; }
  else {
    const n = W.walk[e.node]; tx = n.x + e.ox; tz = n.z + e.oz;
    if (Math.hypot(tx - e.x, tz - e.z) < .8) {
      const nb = n.nb.filter(q => q !== e.prev), nx = nb.length ? pick(nb) : n.nb[0];
      if (nx !== undefined) { e.prev = e.node; e.node = nx; }
      return;
    }
  }
  const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz) || 1;
  e.yaw += angDiff(Math.atan2(dx, dz), e.yaw) * Math.min(1, 8 * dt);
  e.x += dx / d * spd * dt; e.z += dz / d * spd * dt; e.walk += spd * dt * 2.2; e.y = collide(e);
}
function citizenHurt(e, dmg, src) {
  if (e.down) return;
  e.hp -= dmg; e.flash = .14; e.flee = 9; e.pause = 0; e.asleep = false;
  const mine = !!src && (src === body() || src.team === 0);
  if (e.hp <= 0) {
    e.down = true; e.ko = 40;
    if (mine) { const m = rndi(20, 90); SV.money += m; UI.gain('[money]+' + m); addWanted(G.wanted < 2 ? 2 - G.wanted : 1, '住人を倒した'); }
  } else if (mine && G.t - G.crimeT > 2) { G.crimeT = G.t; if (!G.wanted) addWanted(1, '住人を攻撃した'); else G.wantedT = 40; }
  for (const o of ents) if (o.citizen && !o.resident && Math.hypot(o.x - e.x, o.z - e.z) < 25) o.flee = Math.max(o.flee || 0, 6);
}

// ---------- 車 ----------
const CAR_COLS = [0xd8dde6, 0x39414f, 0xc0392b, 0x2f6fb5, 0xf2d13a, 0x1d2026, 0x4a8a5a, 0x9aa7b5, 0xe08030, 0x7a4ab0];
function mkCar(x, z, yaw, traffic) {
  const c = baseEnt('car', 2, x, z); c.yaw = yaw; c.r = 1.5; c.h = 1.6; c.hp = c.maxhp = 260; c.speed = 0; c.wheel = 0; c.col = pick(CAR_COLS); c.type = pick([0, 0, 0, 1, 2]);
  c.st = { kind: '' }; c.name = ['セダン', 'ワゴン', 'トラック'][c.type]; c.traffic = !!traffic; c.parked = !traffic;
  ents.push(c); G.cars.push(c); return c;
}
function removeCar(c) { let i = ents.indexOf(c); if (i >= 0) ents.splice(i, 1); i = G.cars.indexOf(c); if (i >= 0) G.cars.splice(i, 1); }
function placeTraffic(c) {
  const b = body();
  for (let i = 0; i < 14; i++) {
    const ax = Math.random() < .5 ? 'x' : 'z', line = pick(W.roadLines), dir = Math.random() < .5 ? 1 : -1, pos = rnd(-190, 190);
    const x = ax === 'x' ? pos : line + 3 * dir, z = ax === 'x' ? line - 3 * dir : pos, d = Math.hypot(x - b.x, z - b.z);
    if (d < 60 || d > 290 || G.cars.some(o => o !== c && Math.hypot(o.x - x, o.z - z) < 14)) continue;
    c.ax = ax; c.line = line; c.dir = dir; c.pos = pos; c.lastC = null; c.x = x; c.z = z; c.y = 0; c.speed = 9;
    c.yaw = ax === 'x' ? dir * Math.PI / 2 : (dir > 0 ? 0 : Math.PI); return true;
  }
  return false;
}
function updTraffic(c, dt) {
  const fx_ = Math.sin(c.yaw), fz = Math.cos(c.yaw), b = body(); let block = false;
  for (const o of G.cars) { if (o === c) continue; const dx = o.x - c.x, dz = o.z - c.z, f = dx * fx_ + dz * fz; if (f > 0 && f < 9 && Math.abs(-dx * fz + dz * fx_) < 2.2) { block = true; break; } }
  if (!block) { const dx = b.x - c.x, dz = b.z - c.z, f = dx * fx_ + dz * fz; if (f > 0 && f < 8 + b.r && Math.abs(-dx * fz + dz * fx_) < 1.6 + b.r) block = true; }
  c.speed += ((block ? 0 : 10) - c.speed) * Math.min(1, 3 * dt);
  const prev = c.pos; c.pos += c.dir * c.speed * dt; c.wheel += c.speed * dt * 2.5;
  const cc = 28 + 56 * Math.round((c.pos - 28) / 56);
  if (cc !== c.lastC && (prev - cc) * (c.pos - cc) <= 0 && Math.abs(cc) <= 196) {
    c.lastC = cc; const opts = [];
    if (Math.abs(cc + c.dir * 56) <= 196) opts.push([c.ax, c.dir], [c.ax, c.dir]);
    for (const d of [-1, 1]) if (Math.abs(c.line + d * 56) <= 196) opts.push([c.ax === 'x' ? 'z' : 'x', d]);
    const o = pick(opts);
    if (o[0] !== c.ax) { const np = c.line; c.ax = o[0]; c.dir = o[1]; c.line = cc; c.pos = np; c.lastC = np; }
  }
  if (c.ax === 'x') { c.x = c.pos; c.z = c.line - 3 * c.dir; } else { c.z = c.pos; c.x = c.line + 3 * c.dir; }
  c.yaw += angDiff(c.ax === 'x' ? c.dir * Math.PI / 2 : (c.dir > 0 ? 0 : Math.PI), c.yaw) * Math.min(1, 6 * dt);
}
function updCar(c, dt) {
  if (c.flash > 0) c.flash -= dt;
  const thr = (IN.k.KeyW ? 1 : 0) - (IN.k.KeyS ? 1 : 0) + IN.sy, st = (IN.k.KeyD ? 1 : 0) - (IN.k.KeyA ? 1 : 0) + IN.sx;
  c.speed += thr * (thr * c.speed < 0 ? 32 : 13) * dt; c.speed *= 1 - (IN.k.Space ? 2.5 : .35) * dt; c.speed = clamp(c.speed, -9, 31);
  c.yaw -= st * 1.8 * dt * clamp(c.speed / 6, -1, 1);
  const ox = c.x, oz = c.z; c.vx = Math.sin(c.yaw) * c.speed; c.vz = Math.cos(c.yaw) * c.speed; physics(c, dt);
  const sp = Math.abs(c.speed); c.wheel += c.speed * dt * 2.5;
  if (sp > 4 && Math.hypot(c.x - ox, c.z - oz) < sp * dt * .55) { if (sp > 12) { sfx('hit'); spark(c.x + Math.sin(c.yaw) * 2, 1, c.z + Math.cos(c.yaw) * 2, 6, 0xffe0a0, 6, .2); hurt(c, sp * .5, null); } c.speed *= .25; }
  if (sp > 3) cam.yaw += angDiff(c.yaw, cam.yaw) * Math.min(1, 2.2 * dt);
  if (sp > 7 && !c.dead) for (const o of ents.slice()) {
    if (o === c || o.dead || o.hidden || o.down || o.kind === 'car' || o.parked || o.team === 0) continue;
    const d = Math.hypot(o.x - c.x, o.z - c.z); if (d > c.r + o.r || Math.abs(o.y - c.y) > 2.5) continue;
    hurt(o, sp * 3, c); o.vx += (o.x - c.x) / (d || 1) * sp; o.vz += (o.z - c.z) / (d || 1) * sp; c.speed *= .8;
  }
}
function enterCar(c) {
  if (c.traffic) { c.traffic = false; if (!G.wanted && Math.random() < .4) addWanted(1, '車を盗んだ'); }
  P.car = c; P.state = 'car'; P.human.hidden = true; c.parked = false; c.team = 0; sfx('ui');
}

// ---------- 家: 住人・見つかりそう・盗む ----------
const isNight = () => SV.time < .29 || SV.time > .79;
function updHouses(dt) {
  const h = P.human, hs = P.state === 'foot' ? W.houseAt(h.x, h.z) : null; G.inHouse = hs;
  const r = hs && hs.id !== SV.home ? hs.res : null;
  if (r && !r.down) {
    const d = Math.hypot(r.x - h.x, r.z - h.z), sp = Math.hypot(h.vx, h.vz);
    G.sus += dt * (r.asleep ? .1 : .45) * (sp > 9 ? 2.5 : 1) * clamp(1.3 - d / 9, .15, 1.3);
    if (!r.asleep) r.yaw = Math.atan2(h.x - r.x, h.z - r.z);
    if (G.sus >= 1) { G.sus = 0; r.asleep = false; UI.toast('「泥棒！ 警察を呼ぶぞ！」'); addWanted(G.wanted ? 1 : (G.t - G.stoleT < 60 ? 2 : 1), '見つかった'); }
  } else G.sus = Math.max(0, G.sus - dt * .4);
}
function refreshResidents() {
  const b = body(), night = isNight();
  if (night !== G.wasNight) { G.wasNight = night; for (const hs of W.houses) if (hs.res) { const i = ents.indexOf(hs.res); if (i >= 0) ents.splice(i, 1); hs.res = null; } }
  for (const hs of W.houses) {
    for (const l of hs.loot) if (l.t > 0) l.t -= 1.2;
    const d = Math.hypot(hs.x - b.x, hs.z - b.z);
    if (hs.res && d > 170) { const i = ents.indexOf(hs.res); if (i >= 0) ents.splice(i, 1); hs.res = null; }
    else if (!hs.res && d < 130 && hs.id !== SV.home && !hs.sale && (night || (hs.id * 7 + G.dayN * 3) % 10 < 4)) {
      const p = night ? hs.bedRoom : hs.inRoom, e = mkHuman(2, p.x, p.z, rndOutfit());
      e.y = .15; e.citizen = true; e.resident = true; e.asleep = night; e.hp = e.maxhp = 60; e.name = night ? '住人 (睡眠中)' : '住人'; e.yaw = rnd(6.28); e.house = hs;
      hs.res = e; ents.push(e);
    }
  }
}
function steal(hs, l) {
  l.t = 300; SV.loot += l.val; G.stoleT = G.t; sfx('coin'); UI.gain('[bag]+' + l.val);
  if (hs.res && !hs.res.down && Math.hypot(hs.res.x - P.human.x, hs.res.z - P.human.z) < 8) G.sus += hs.res.asleep ? .25 : .6;
}
function buyHouse(hs) {
  if (SV.money < hs.sale) return UI.toast('お金が足りない');
  SV.money -= hs.sale; SV.home = hs.id; hs.sale = 0; SV.bed = { x: hs.bed.x, y: .15, z: hs.bed.z }; sfx('coin'); save();
  UI.toast('[house] 家を買った！ ベッド・クローゼット・冷蔵庫が使える');
}
function sleep(pos) {
  SV.time = .27; SV.energy = 100; P.human.hp = P.human.maxhp; SV.bed = { x: pos.x, y: pos.y, z: pos.z }; save();
  UI.toast('[bed] 朝になった (ここが復活地点)'); sfx('coin');
}
function eat(n) { SV.hunger = Math.min(100, SV.hunger + n); sfx('coin'); }

// ---------- 仕事 ----------
function startJob(type) {
  if (G.job) return UI.toast('先に今の仕事を終わらせよう');
  const def = JOBS.find(j => j.id === type), mul = 1 + Math.min(1, (SV.jobLv[type] || 0) * .05);
  const pt = (c, label) => ({ x: c.x, z: c.z, label });
  const far = (a, min) => { let b = pick(W.corners); for (let i = 0; i < 30 && Math.hypot(a.x - b.x, a.z - b.z) < min; i++) b = pick(W.corners); return b; };
  let j;
  if (type === 'deliver') { const a = pick(W.corners), b = far(a, 120); j = { pts: [pt(a, '荷物'), pt(b, '届け先')], order: 1, limit: 25 + Math.hypot(a.x - b.x, a.z - b.z) / 5 }; }
  else if (type === 'pizza') { const hs = []; while (hs.length < 3) { const h = pick(W.houses); if (!hs.includes(h)) hs.push(h); } j = { pts: [pt(W.facilities[5], 'ピザ')].concat(hs.map(h => pt(h.door, '注文'))), first: 1, limit: 150 }; }
  else if (type === 'taxi') { const a = pick(W.corners), b = far(a, 160); j = { pts: [pt(a, '客'), pt(b, '目的地')], order: 1, car: 1, limit: 25 + Math.hypot(a.x - b.x, a.z - b.z) / 9 }; }
  else if (type === 'trash') { const s = new Set(); while (s.size < 8) s.add(pick(W.corners)); j = { pts: [...s].map(c => pt(c, 'ごみ')), limit: 200 }; }
  else if (type === 'patrol') { let a = pick(W.corners); const pts = []; for (let i = 0; i < 5; i++) { pts.push(pt(a, '巡回 ' + (i + 1))); a = far(a, 90); } j = { pts, order: 1, limit: 240, night: 1 }; }
  else if (type === 'farm') j = { need: 10, got: 0, farm: 1 };
  else if (type === 'bounty') {
    if (!SV.mechs.length) return UI.toast('メカが必要');
    const e = spawnEnemyMech(rnd(-320, 320), rnd(300, 560), Math.min(6, 1 + Math.floor(SV.rank / 2)), true);
    e.ai.keep = true; j = { target: e, pay: 700 + 300 * SV.rank };
  } else {
    if (!G.groups.length) spawnGroup(true);
    if (!G.groups[0]) return UI.toast('今は情報がない');
    j = { group: G.groups[0], pay: 400 + 100 * SV.rank };
  }
  j.type = type; j.name = def.name; j.t = 0; j.pay = j.pay || Math.round(def.pay * mul); G.job = j;
  UI.toast(def.icon + ' ' + def.name + ' を開始'); save();
}
function jobDone(payAmt, name, type) {
  const t = type || (G.job && G.job.type); if (t) SV.jobLv[t] = (SV.jobLv[t] || 0) + 1;
  SV.money += payAmt; SV.jobs++; addXp(30); G.job = null; if (SV.quest === 3) SV.quest = 4;
  UI.toast('[check] ' + name + ' 完了　[money]+' + payAmt); sfx('coin'); save();
}
function jobPoints() {     // いま 行くべき 場所
  const j = G.job; if (!j) return [];
  if (j.pts) { const first = j.pts.findIndex(q => !q.done); return j.pts.filter((p, i) => !p.done && (!(j.order || (j.first && !j.pts[0].done)) || i === first)); }
  if (j.farm) return [{ x: -430, z: -450, label: '農場' }];
  if (j.target) return j.target.dead ? [] : [{ x: j.target.x, z: j.target.z, label: 'お尋ね者', col: 0xff4040 }];
  return [{ x: j.group.alley.x, z: j.group.alley.z, label: '闇商人', col: 0xb060ff }];
}
function updJob(dt) {
  const j = G.job; if (!j) return; j.t += dt;
  if (!j.pts) return;
  const b = body();
  for (const p of jobPoints()) {
    if (Math.hypot(b.x - p.x, b.z - p.z) > 5 + b.r) continue;
    if (j.car && P.state !== 'car') { if (G.t - (j.warn || 0) > 3) { j.warn = G.t; UI.toast('[car] 車に乗って来よう'); } continue; }
    p.done = true; sfx('ui');
    if (j.pts.every(q => q.done)) { const fast = j.t < j.limit, nb = j.night && isNight(); jobDone(Math.round(j.pay * (fast ? 1.4 : 1) * (nb ? 2 : 1)), j.name + (fast ? ' (スピードボーナス)' : '')); }
    else UI.gain(p.label + ' OK');
    break;
  }
}
function questInfo() {
  switch (SV.quest) {
    case 0: return { text: '北のスクラップ置き場で [scrap] を 20 個集める (F)　' + SV.mats.scrap + '/20', x: 0, z: -222 };
    case 1: return { text: '広場の工房でメカを作る', x: W.facilities[0].x, z: W.facilities[0].z };
    case 2: return P.mech ? { text: 'メカに近づいて E で乗る', x: P.mech.x, z: P.mech.z } : null;
    case 3: return { text: '仕事案内で仕事を受ける', x: W.facilities[3].x, z: W.facilities[3].z };
    case 4: return { text: '街の外で B を押して基地を建てる', none: true };
    default: return null;
  }
}

// ---------- 近くの「E で できること」をさがす ----------
function findPrompt() {
  const b = body(), foot = P.state === 'foot'; G.prompt = null;
  if (G.build.on) return;
  const near = (p, r) => Math.hypot(p.x - b.x, p.z - b.z) < r;
  for (const f of W.facilities) if (near(f, f.r + b.r) && Math.abs(f.y - b.y) < 3) { G.prompt = { text: f.icon + ' ' + f.name, act: () => UI.open(f.id) }; return; }
  for (const p of G.usePieces) {
    if (Math.hypot(p.gx * 4 - b.x, p.gz * 4 - b.z) > 2.6 + b.r || Math.abs(p.gy * 3 - b.y) > 2) continue;
    if (PIECES[p.t].use === 'pad') { G.prompt = { text: '[wrench] 工房', act: () => UI.open('workshop') }; return; }
    if (foot) { G.prompt = { text: '[bed] 寝る', act: () => sleep({ x: p.gx * 4 + 1.6, y: p.gy * 3, z: p.gz * 4 }) }; return; }
  }
  if (!foot) { G.prompt = { text: P.state === 'plane' && b.y > 4 ? '飛び降りる' : '降りる', act: () => exitVehicle(false) }; return; }
  const hs = G.inHouse;
  if (hs && hs.id === SV.home) {
    if (near(hs.bed, 1.8)) { G.prompt = { text: '[bed] 寝る', act: () => sleep({ x: hs.bed.x, y: .15, z: hs.bed.z }) }; return; }
    if (near(hs.ward, 1.6)) { G.prompt = { text: '[shirt] 着替える', act: () => UI.open('wardrobe') }; return; }
    if (near(hs.fridge, 1.6)) { G.prompt = { text: '[food] 冷蔵庫', act: () => UI.open('bag') }; return; }
  } else if (hs) {
    for (const l of hs.loot) if (l.t <= 0 && near(l, 1.7)) { G.prompt = { text: '[bag] 盗む　' + l.name, act: () => steal(hs, l) }; return; }
  }
  if (W.inTown(b.x, b.z)) for (const s of W.houses) if (s.sale && near(s.door, 2.2)) { G.prompt = { text: '[house] 家を買う　[money]' + s.sale.toLocaleString(), act: () => buyHouse(s) }; return; }
  const m = P.mech;
  if (m && !m.hidden && near(m, m.r + 2.5)) { G.prompt = { text: '[mech] 乗る', act: enterMech }; return; }
  for (const p of G.planes) if (!p.hidden && near(p, 6) && Math.abs(p.y - b.y) < 4) { G.prompt = { text: '[plane] 乗る', act: () => enterPlane(p) }; return; }
  for (const c of G.cars) if (near(c, 3.4)) { G.prompt = { text: '[car] ' + (c.traffic ? '車を奪う' : '乗る'), act: () => enterCar(c) }; return; }
  for (const e of ents) if (e.citizen && e.kind === 'human' && !e.down && !e.resident && !(e.flee > 0) && near(e, 2.2)) {
    G.prompt = { text: '話す', act: () => { e.pause = 2.5; e.yaw = Math.atan2(b.x - e.x, b.z - e.z); UI.toast('「' + pick(TALK) + '」'); } }; return;
  }
}

// ---------- まわりの にぎわいを 保つ (1.2 秒ごと) ----------
function spawnTick() {
  const b = body(), reg = W.region(b.x, b.z);
  for (const e of ents.slice()) if (e.team === 1 && !e.group && !(e.ai && e.ai.keep) && Math.hypot(e.x - b.x, e.z - b.z) > 430) ents.splice(ents.indexOf(e), 1);
  if (G.groups.length < 3 && G.groupT <= 0) { spawnGroup(false); G.groupT = 20; }
  // 住人を プレイヤーの 近くへ 回す
  const nodes = W.walk.filter(n => { const d = Math.hypot(n.x - b.x, n.z - b.z); return d > 45 && d < 190; });
  if (nodes.length) for (const e of ents) {
    if (!e.citizen || e.resident || e.kind !== 'human' || e.ko > 0) continue;
    if (!e.far && Math.hypot(e.x - b.x, e.z - b.z) < 240) continue;
    const n = pick(nodes); e.node = W.walk.indexOf(n); e.prev = -1; e.x = n.x + e.ox; e.z = n.z + e.oz; e.y = n.y; e.far = false; e.flee = 0;
  }
  // 車
  if (Math.hypot(b.x, b.z) < 520) for (const c of G.cars) if (c.traffic && Math.hypot(c.x - b.x, c.z - b.z) > 320) placeTraffic(c);
  for (const c of G.cars.slice()) if (!c.traffic && !c.keep && c !== P.car && Math.hypot(c.x - b.x, c.z - b.z) > 460) removeCar(c);
  while (G.cars.filter(c => c.traffic).length < 16) { const c = mkCar(0, 0, 0, true); if (!placeTraffic(c)) { removeCar(c); break; } }
  refreshResidents();
  // 野生の敵
  const cfg = { grass: [2, 0], junk: [2, 0], rock: [3, 0], waste: [Math.min(9, 5 + SV.rank / 2), 1] }[reg];
  if (!SV.mechs.length || !cfg) return;
  if (ents.filter(e => e.team === 1 && !e.group && !e.boss && !e.police).length >= cfg[0]) return;
  const dist = Math.hypot(b.x, b.z), far = dist > 900 ? 2 : dist > 560 ? 1 : 0;
  for (let i = 0; i < 8; i++) {
    const an = rnd(6.28), d = rnd(110, 170), x = b.x + Math.sin(an) * d, z = b.z + Math.cos(an) * d, rg = W.region(x, z);
    if (W.inCity(x, z, 30) || !['grass', 'junk', 'rock', 'waste'].includes(rg) || Math.abs(x) > W.size - 20 || Math.abs(z) > W.size - 20) continue;
    const tier = Math.min(6, cfg[1] + Math.floor(SV.rank / 3) + far);
    if (reg === 'junk' || Math.random() < .3) spawnDrone(x, z, tier); else spawnEnemyMech(x, z, tier, false);
    return;
  }
}

function lifeUpdate(dt) {
  updWanted(dt); updHouses(dt);
  const h0 = SV.hunger, e0 = SV.energy;
  SV.hunger = Math.max(0, SV.hunger - dt / 12); SV.energy = Math.max(0, SV.energy - dt / 15);
  if (h0 >= 15 && SV.hunger < 15) UI.toast('[food] お腹が空いた… 何か食べよう');
  if (e0 >= 15 && SV.energy < 15) UI.toast('[bed] 眠い… ベッドで寝よう');
  P.human.st.spd = SV.hunger < 15 || SV.energy < 15 ? 6.4 : 8;
}
function lifeStart() {
  G.cars = []; G.wanted = 0; G.wantedT = 0; G.polT = 0; G.sus = 0; G.crimeT = -99; G.stoleT = -999; G.inHouse = null; G.wasNight = isNight(); G.dayN = G.dayN || 0;
  for (const hs of W.houses) { hs.res = null; for (const l of hs.loot) l.t = 0; if (SV.home === hs.id) hs.sale = 0; }
  for (let i = 0; i < 64; i++) { const e = spawnCitizen(Math.floor(Math.random() * W.walk.length)); e.far = true; }
  for (const s of W.carSpots) { const c = mkCar(s.x, s.z, s.yaw, false); c.keep = true; }
  P.car = null;
}
