/* =========================================================================
   ORE TO ARMADA ― 世界
   銀河 / 星系の中身 / 小惑星 / ステーション / 敵の船の手順生成 / できごと
   ========================================================================= */
'use strict';

/* ---------------- 銀河 ---------------- */
function makeGalaxy(seed) {
  const rng = new RNG(seed ^ 0x51ed);
  const systems = [];
  let k = 0;
  RINGS.forEach((ring, ri) => {
    const off = rng.f(TAU);
    for (let i = 0; i < ring.count; i++) {
      const ang = off + i / ring.count * TAU + rng.f(-0.12, 0.12);
      const r = ring.r + rng.f(-0.04, 0.04);
      systems.push({
        id: k, name: SYSTEM_NAMES[k], ring: ri, mx: Math.cos(ang) * r, my: Math.sin(ang) * r, ang,
        star: { c: rng.pick(STAR_COLORS), r: rng.f(28, 46) }, bg: rng.pick(BG_COLORS),
        station: ri <= 1 ? true : ri === 2 ? rng.chance(0.7) : false,
        hideout: ri === 0 ? rng.chance(0.4) : ri === 1 ? rng.chance(0.6) : ri === 2 ? rng.chance(0.3) : false,
        seed: rng.i(1, 1e9), danger: ring.danger, lanes: [],
      });
      k++;
    }
  });
  const lanes = [];
  const link = (a, b) => {
    if (a === b || systems[a].lanes.some((l) => l.to === b)) return;
    const gate = systems[a].ring === 0 && systems[b].ring === 0;
    const lane = { a, b, gate };
    lanes.push(lane);
    systems[a].lanes.push({ to: b, gate }); systems[b].lanes.push({ to: a, gate });
  };
  // 同じ環の隣どうし
  let base = 0;
  RINGS.forEach((ring) => {
    for (let i = 0; i < ring.count; i++) link(base + i, base + (i + 1) % ring.count);
    base += ring.count;
  });
  // 内側の環の各星系を、外側の近い星系とつなぐ
  const byRing = (r) => systems.filter((s) => s.ring === r);
  for (let r = 1; r < RINGS.length; r++) {
    for (const s of byRing(r)) {
      const outer = byRing(r - 1).slice().sort((a, b) => dist(a.mx, a.my, s.mx, s.my) - dist(b.mx, b.my, s.mx, s.my));
      link(s.id, outer[0].id);
      if (r < 3 && rng.chance(0.5)) link(s.id, outer[1].id);
    }
  }
  // 最初の星系にはステーションを必ず置き、海賊の隠れ家は置かない
  systems[0].station = true; systems[0].hideout = false;
  // 各環のボスがいる星系 (最初の星系から遠いところ)
  const bossSys = RINGS.map((_, r) => {
    const c = byRing(r).slice().sort((a, b) => dist(b.mx, b.my, systems[0].mx, systems[0].my) - dist(a.mx, a.my, systems[0].mx, systems[0].my));
    return c[0].id;
  });
  return { systems, lanes, bossSys };
}

/* ---------------- 小惑星 ---------------- */
function makeAsteroid(seed, diam, ores, o = {}) {
  const rng = new RNG(seed);
  const n1 = makeNoise(seed), n2 = makeNoise(seed + 7), n3 = makeNoise(seed + 13);
  const g = new Grid({ kind: 'asteroid', terrain: true, static: diam >= 30, name: diam >= 30 ? '大きな小惑星' : '小惑星' });
  const R = diam / 2;
  const iceOnly = o.comet;
  for (let j = -Math.ceil(R) - 3; j <= Math.ceil(R) + 3; j++) for (let i = -Math.ceil(R) - 3; i <= Math.ceil(R) + 3; i++) {
    const d = Math.hypot(i + 0.5, j + 0.5);
    const edge = R * (0.74 + 0.4 * n1(i * 0.13 + 50, j * 0.13 + 50));
    if (d >= edge) continue;
    const depth = 1 - d / edge;
    let t = depth > 0.45 && n2(i * 0.2, j * 0.2) > 0.55 ? 2 : 1;
    const vein = n3(i * 0.24 + 9, j * 0.24 + 9);
    if (iceOnly) t = vein > 0.25 ? TERRAIN_BY_ORE.ore_ice : 1;
    else if (vein > 0.6 - depth * 0.16) {
      // 深いところほど珍しい鉱石が出やすい
      const w = ores.map((id, k) => (id === 'ore_ice' ? 1.2 : 1) * Math.pow(0.55 + depth * 0.9, k) / (1 + k * 0.6));
      let r = rng.f(w.reduce((a, b) => a + b, 0)), pick = ores[0];
      for (let k = 0; k < ores.length; k++) { r -= w[k]; if (r <= 0) { pick = ores[k]; break; } }
      t = TERRAIN_BY_ORE[pick];
    }
    g.setTerrain(i, j, t);
  }
  g.updateMass();
  return g;
}

/* ---------------- 敵の軍艦の手順生成 ----------------
   左右対称の船体に、武器・機械・推進器を配置する。 */
function genWarship(rng, W, H, o = {}) {
  if (W % 2 === 0) W++;
  const g = new Grid({ kind: 'ship', faction: o.faction || 'pirate', name: o.name || '軍艦' });
  const cx = (W - 1) / 2;
  const hw = [];
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const prof = t < 0.28 ? 0.25 + t / 0.28 * 0.75 : t < 0.82 ? 1 : 1 - (t - 0.82) / 0.18 * 0.25;
    hw.push(Math.max(1, Math.round((W / 2) * prof - (rng.chance(0.15) ? 1 : 0))));
  }
  const inside = (x, y) => y >= 0 && y < H && Math.abs(x - cx) <= hw[y] - 0.5;
  const hull = o.armor || 0;
  const put = (id, x, y, r = 0) => g.addBlock(id, x - Math.floor(cx), y - Math.floor(H / 2), r);
  const at = (x, y) => g.at(x - Math.floor(cx), y - Math.floor(H / 2));
  const del = (x, y) => { const b = at(x, y); if (b) g.removeBlock(b); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    put(edge ? (rng.chance(hull) ? 'armor' : 'wall') : 'floor', x, y);
  }
  // 操縦席 (機首の中央) と前の窓
  let ny = 0; while (!inside(cx, ny)) ny++;
  const cy0 = ny + 1;
  del(cx, cy0); put('cockpit', cx, cy0, 0);
  del(cx, ny); put('glass', cx, ny);
  const mirror = (fn) => (x, y) => { fn(x, y, false); if (x !== cx) fn(W - 1 - x, y, true); };
  // 後ろの推進器
  const tailY = [];
  for (let x = 0; x < W; x++) { let y = H - 1; while (y >= 0 && !inside(x, y)) y--; if (y >= 0) tailY[x] = y; }
  const big = W >= 11;
  for (let x = 0; x <= cx; x++) {
    const y = tailY[x];
    if (y == null) continue;
    if (big && x + 1 <= cx && tailY[x + 1] === y && x % 3 === 0 && g.canPlace(BLOCKS.thruster_l, x - Math.floor(cx), y + 1 - Math.floor(H / 2), 2)) {
      put('thruster_l', x, y + 1, 2); if (W - 2 - x !== x) put('thruster_l', W - 2 - x, y + 1, 2);
    } else if (x % 2 === 0 && !at(x, y + 1)) mirror((xx, yy) => { if (!at(xx, yy)) put('thruster', xx, yy, 2); })(x, y + 1);
  }
  // 前と横の推進器
  for (let x = 0; x <= cx; x++) { let y = 0; while (y < H && !inside(x, y)) y++; if (y < H && x % 3 === 1) mirror((xx, yy) => { if (!at(xx, yy)) put('thruster', xx, yy, 0); })(x, y - 1); }
  for (let y = Math.floor(H * 0.3); y < H * 0.8; y += 4) {
    let x = 0; while (x < cx && !inside(x, y)) x++;
    if (x < cx) { if (!at(x - 1, y)) put('thruster', x - 1, y, 3); if (!at(W - x, y)) put('thruster', W - x, y, 1); }
  }
  // 中の機械 (空いている床に左右対称で置く)
  const tryPut = (id, r = 0) => {
    const d = BLOCKS[id];
    for (let tries = 0; tries < 60; tries++) {
      const x = rng.i(1, Math.floor(cx)), y = rng.i(cy0 + 1, H - 2);
      const [w, h] = Grid.sizeOf(d, r);
      let ok = true;
      for (let yy = y; yy < y + h && ok; yy++) for (let xx = x; xx < x + w && ok; xx++) { const b = at(xx, yy); if (!b || b.def.id !== 'floor' || !inside(xx - 1, yy) || !inside(xx + 1, yy)) ok = false; }
      const mx = W - x - w;
      if (mx !== x) for (let yy = y; yy < y + h && ok; yy++) for (let xx = mx; xx < mx + w && ok; xx++) { const b = at(xx, yy); if (!b || b.def.id !== 'floor') ok = false; }
      if (mx < x + w && mx !== x) ok = false;
      if (!ok) continue;
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) del(xx, yy);
      put(id, x, y, r);
      if (mx !== x) { for (let yy = y; yy < y + h; yy++) for (let xx = mx; xx < mx + w; xx++) del(xx, yy); put(id, mx, y, r); }
      return true;
    }
    return false;
  };
  const area = g.count;
  if (o.reactor) tryPut('reactor'); else tryPut('h2gen');
  tryPut('h2tank');
  for (let k = 0; k < Math.max(1, area / 90); k++) tryPut('gyro');
  for (let k = 0; k < Math.max(1, area / 120); k++) tryPut('battery');
  if (o.shield) for (let k = 0; k < o.shield; k++) tryPut('shield');
  tryPut('o2gen'); tryPut('cargo'); tryPut('ammobox');
  for (let k = 0; k < (o.beds || 1); k++) tryPut('bed');
  for (const id of o.big || []) tryPut(id);
  // 外周に武器
  const weapons = (o.weapons || ['mg']).filter((id) => BLOCKS[id].size[0] === 1 && BLOCKS[id].size[1] === 1);
  if (!weapons.length) weapons.push('mg');
  for (const id of (o.weapons || [])) if (BLOCKS[id].size[0] > 1) tryPut(id);
  let n = 0;
  for (let y = cy0 + 1; y < H - 1; y++) {
    let x = 0; while (x < cx && !inside(x, y)) x++;
    if (x >= cx) continue;
    if ((y + n) % (o.gunGap || 4) !== 0) continue;
    const id = rng.pick(weapons);
    mirror((xx, yy) => { del(xx, yy); put(id, xx, yy, 0); })(x, y);
    n++;
  }
  g.template = 'gen';
  g.updateMass(); g.updateSys();
  for (const b of g.sys.tanks) b.h2 = b.def.h2cap;
  for (const b of g.sys.batteries) b.charge = b.def.cap;
  for (const b of g.sys.reactors) b.fuel = 600;
  for (const b of g.sys.shields) b.charge = b.def.shieldCap;
  const ammo = g.sys.cargos.find((b) => b.def.ammoOnly);
  if (ammo) { g.invAdd('ammo', 60); if ((o.weapons || []).includes('missile') || (o.big || []).includes('missile')) g.invAdd('missile', 40); }
  g.crewSlots = Math.max(1, g.sys.beds.length);
  return g;
}

/* ---------------- 群体の生きた船 ---------------- */
function genBioShip(rng, diam, o = {}) {
  const g = new Grid({ kind: 'ship', faction: 'swarm', name: o.name || 'ヴォイド群体' });
  const noise = makeNoise(rng.i(1, 1e9));
  const R = diam / 2;
  const inside = (i, j) => {
    const d = Math.hypot(i + 0.5, (j + 0.5) * 0.85);
    return d < R * (0.8 + 0.3 * noise(Math.abs(i) * 0.3, j * 0.3));
  };
  for (let j = -Math.ceil(R) - 2; j <= Math.ceil(R) + 2; j++) for (let i = -Math.ceil(R) - 2; i <= Math.ceil(R) + 2; i++) {
    if (!inside(i, j)) continue;
    const edge = !inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1);
    g.addBlock(edge ? 'bio_shell' : 'bio_flesh', i, j, 0);
  }
  const swap = (i, j, id, r = 0) => { const b = g.at(i, j); if (b) g.removeBlock(b); return g.addBlock(id, i, j, r); };
  swap(0, 0, 'bio_core');
  if (diam > 14) { swap(-1, 0, 'bio_core'); }
  // 前の縁に顎
  for (let i = -Math.floor(R); i <= Math.floor(R); i++) {
    let j = -Math.ceil(R) - 2; while (j < 0 && !g.at(i, j)) j++;
    if (j < 0 && g.at(i, j) && Math.abs(i) < R * 0.6 && (i & 1) === 0) swap(i, j, 'bio_jaw', 0);
  }
  const cells = [];
  g.eachBlock((b) => { if (b.def.id === 'bio_flesh') cells.push(b); });
  rng.shuffle(cells);
  const nSpore = Math.max(1, Math.round(diam * diam / 40)), nRegen = Math.max(1, Math.round(diam / 8));
  for (let k = 0; k < nSpore && cells.length; k++) { const b = cells.pop(); swap(b.x, b.y, 'bio_spore'); }
  for (let k = 0; k < nRegen && cells.length; k++) { const b = cells.pop(); swap(b.x, b.y, 'bio_regen'); }
  g.updateMass(); g.updateSys();
  return g;
}

/* ---------------- ボス ---------------- */
function makeBoss(key, rng) {
  let g;
  if (key === 'boss_pirate_king') g = genWarship(rng, 17, 29, { faction: 'pirate', name: '海賊王の旗艦 グレイブ', weapons: ['mg', 'mg', 'laser'], big: ['autocannon', 'missile'], armor: 0.5, shield: 1, beds: 3, gunGap: 3 });
  else if (key === 'boss_fortress') g = genWarship(rng, 25, 41, { faction: 'pirate', name: '鉄の要塞艦 バルバロス', weapons: ['laser', 'mg', 'pd'], big: ['autocannon', 'autocannon', 'missile', 'laser_h'], armor: 1, shield: 3, reactor: true, beds: 4, gunGap: 3 });
  else if (key === 'boss_queen') g = genBioShip(rng, 30, { name: '群体の女王' });
  else g = genBioShip(rng, 48, { name: '群体の母艦' });
  g.boss = key;
  return g;
}

/* ---------------- 勢力ごとの敵の船 ---------------- */
const PIRATE_WEAPONS = [['mg'], ['mg', 'laser'], ['laser', 'mg', 'missile'], ['laser', 'missile']];
function makeEnemy(kind, ring, rng) {
  const weapons = PIRATE_WEAPONS[Math.min(3, ring)];
  let g;
  if (kind === 'scout') g = makeShip('pirate_scout', { rng, weapons: ['mg'], armorChance: ring * 0.2 });
  else if (kind === 'raider') g = makeShip('pirate_raider', { rng, weapons, armorChance: 0.2 + ring * 0.2 });
  else if (kind === 'gunship') g = makeShip('pirate_gunship', { rng, weapons, armorChance: 0.3 + ring * 0.2 });
  else if (kind === 'cruiser') g = genWarship(rng, rng.pick([11, 13]), rng.i(17, 23), { faction: 'pirate', name: '海賊の巡洋艦', weapons, big: ring >= 2 ? ['autocannon'] : [], armor: 0.3 + ring * 0.2, shield: ring >= 1 ? 1 : 0, beds: 2 });
  else if (kind === 'patrol') g = makeShip('union_patrol', { rng });
  else if (kind === 'swarm_s') g = genBioShip(rng, rng.i(6, 9), { name: '群体の子' });
  else if (kind === 'swarm_m') g = genBioShip(rng, rng.i(11, 15), { name: '群体の兵' });
  else g = makeShip('pirate_scout', { rng });
  g.updateSys();
  for (const b of g.sys.tanks) b.h2 = b.def.h2cap;
  for (const b of g.sys.batteries) b.charge = b.def.cap;
  for (const b of g.sys.shields) b.charge = b.def.shieldCap;
  if (!g.invTotal('ammo') && g.sys.cargos.length) g.invAdd('ammo', 30);
  g.enemyKind = kind;
  g.accMul = 2.2;
  return g;
}

/* ---------------- 星系の中身 (シードから毎回同じものを作る) ---------------- */
function systemLayout(sys, galaxy) {
  const rng = new RNG(sys.seed);
  const L = { station: null, clusters: [], hideouts: [], gates: [], derelicts: [], nebulae: [], comets: [], boss: null };
  const R = TUNE.sectorRadius;
  const stAng = rng.f(TAU);
  if (sys.station) L.station = { x: Math.cos(stAng) * 450, y: Math.sin(stAng) * 450 };
  const far = (x, y, d) => (!L.station || dist(x, y, L.station.x, L.station.y) > d) && Math.hypot(x, y) > 220;
  const nCl = 3 + (sys.ring >= 1 ? 1 : 0) + rng.i(0, 1);
  for (let k = 0; k < nCl; k++) {
    let x, y, tries = 0;
    do { const a = rng.f(TAU), r = rng.f(300, R - 250); x = Math.cos(a) * r; y = Math.sin(a) * r; tries++; } while ((!far(x, y, 180) || L.clusters.some((c) => dist(c.x, c.y, x, y) < 260)) && tries < 50);
    L.clusters.push({ x, y, r: rng.f(80, 140), n: rng.i(10, 18), big: rng.i(1, 2), seed: rng.i(1, 1e9) });
  }
  // 最初の星系は、ステーションのそばに小さな小惑星帯を置く
  if (sys.id === 0 && L.station) {
    const a = stAng + 0.5;
    L.clusters.unshift({ x: L.station.x + Math.cos(a) * 110, y: L.station.y + Math.sin(a) * 110, r: 50, n: 10, big: 1, seed: rng.i(1, 1e9), home: true });
  }
  for (let k = 0; k < rng.i(1, 2); k++) { const a = rng.f(TAU), r = rng.f(R * 0.7, R * 0.9); L.comets.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, seed: rng.i(1, 1e9) }); }
  if (sys.hideout) { const c = rng.pick(L.clusters.filter((c) => !c.home)) || L.clusters[0]; L.hideouts.push({ x: c.x + rng.f(-40, 40), y: c.y + rng.f(-40, 40) }); }
  for (let k = 0; k < rng.i(1, 2); k++) { const a = rng.f(TAU), r = rng.f(400, R - 200); L.derelicts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, seed: rng.i(1, 1e9), key: rng.pick(['hauler', 'frigate', 'miner2', 'gunboat']) }); }
  for (let k = 0; k < rng.i(1, 3); k++) {
    const a = rng.f(TAU), r = rng.f(200, R), n = { x: Math.cos(a) * r, y: Math.sin(a) * r, r: rng.f(120, 260), c: rng.pick(NEBULA_COLORS) };
    // ステーションのまわりには星雲を置かない (レーダーが効かなくなるので)
    if (L.station && dist(n.x, n.y, L.station.x, L.station.y) < n.r + (sys.id === 0 ? 500 : 150)) continue;
    L.nebulae.push(n);
  }
  for (const lane of sys.lanes) {
    const o = galaxy.systems[lane.to];
    const a = Math.atan2(o.my - sys.my, o.mx - sys.mx);
    if (lane.gate) L.gates.push({ to: lane.to, x: Math.cos(a) * (R - 230), y: Math.sin(a) * (R - 230) });
  }
  if (galaxy.bossSys[sys.ring] === sys.id) { const a = rng.f(TAU); L.boss = { key: BOSSES[sys.ring].key, x: Math.cos(a) * (R - 400), y: Math.sin(a) * (R - 400) }; }
  return L;
}

/* 星系に入る位置: ゲートの前、ジャンプの着地点、ステーションの近く */
function arrivalPoint(sys, galaxy, from, how) {
  const L = systemLayout(sys, galaxy);
  if (how === 'start' || how === 'respawn' || how === 'tow') {
    if (L.station) return { x: L.station.x + 6, y: L.station.y + 17 };
    return { x: 0, y: 700 };
  }
  if (from != null) {
    const o = galaxy.systems[from];
    const a = Math.atan2(o.my - sys.my, o.mx - sys.mx);
    const r = how === 'gate' ? TUNE.sectorRadius - 260 : TUNE.sectorRadius - 350;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }
  return { x: 0, y: 700 };
}

function makeStation(pos, sys) {
  const g = gridFromRows(STATION_ROWS, { kind: 'station', faction: 'union', name: sys.name + ' ステーション', legend: STATION_LEGEND, static: true, cx: 17, cy: 6 });
  g.static = true; g.invuln = true;
  g.updateMass();
  g.x = pos.x; g.y = pos.y; g.a = 0;
  g.updateRooms();
  for (const r of g.rooms) r.air = r.size;
  return g;
}
function makeHideout(pos, sys, rng) {
  const g = gridFromRows(HIDEOUT_ROWS, { kind: 'base', faction: 'pirate', name: '海賊の隠れ家', static: true, rng, weapons: PIRATE_WEAPONS[Math.min(3, sys.ring)], cx: 5, cy: 4 });
  g.static = true; g.updateMass(); g.x = pos.x; g.y = pos.y;
  g.updateSys();
  for (const b of g.sys.batteries) b.charge = b.def.cap;
  g.invAdd('ammo', 80);
  const loot = [['p_steel', 30], ['p_circuit', 12], ['m_iron', 40], ['p_thr', 8]];
  if (sys.ring >= 1) loot.push(['p_armor', 8], ['p_adv', 4]);
  for (const [id, n] of loot) g.invAdd(id, n);
  g.crewSlots = 3;
  g.hideout = true;
  return g;
}
function makeGate(pos, to) {
  const g = new Grid({ kind: 'gate', faction: 'union', name: 'ゲート', static: true });
  g.addBlock('gate', -1, -1, 0);
  g.static = true; g.invuln = true; g.updateMass(); g.x = pos.x; g.y = pos.y;
  g.gateTo = to;
  return g;
}
function makeDerelict(d, sys) {
  const rng = new RNG(d.seed);
  const g = makeShip(d.key, { rng });
  g.kind = 'ship'; g.faction = 'derelict'; g.name = '漂流船 (' + g.name + ')';
  g.derelict = true;
  // 壊れて、電気も空気もない
  const list = []; g.eachBlock((b) => { if (b.def.id !== 'cockpit' && b.def.id !== 'floor') list.push(b); });
  rng.shuffle(list);
  for (let k = 0; k < Math.floor(list.length * 0.15); k++) g.removeBlock(list[k]);
  splitGrid(g);
  g.eachBlock((b) => { b.hp = Math.max(5, b.hp * rng.f(0.3, 0.9)); if (b.charge) b.charge = 0; });
  g.updateSys();
  const loot = [['p_steel', rng.i(10, 30)], ['p_circuit', rng.i(4, 12)], ['p_glass', rng.i(4, 10)], ['p_thr', rng.i(2, 8)]];
  if (sys.ring >= 1) loot.push(['p_armor', rng.i(2, 8)], ['p_adv', rng.i(1, 4)]);
  if (sys.ring >= 2) loot.push(['p_lens', rng.i(1, 2)], ['p_barrier', rng.i(1, 2)]);
  for (const [id, n] of loot) if (g.invAdd(id, n) === n) break;
  // 設計図が1枚眠っている
  const pool = BLOCK_LIST.filter((b) => typeof b.tier === 'number' && b.tier >= 2 && b.tier <= Math.min(5, sys.ring + 3) && !b.noBuild);
  g.bpLoot = rng.pick(pool).id;
  g.updateMass();
  g.x = d.x; g.y = d.y; g.a = rng.f(TAU); g.va = rng.f(-0.05, 0.05);
  return g;
}
