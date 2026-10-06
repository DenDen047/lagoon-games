/* =========================================================================
   DEAD DRIVE ― 走る場面
   出撃（街）と襲撃（基地）の両方をここで動かし、描く。
   ========================================================================= */
'use strict';

let S = null;   // いま動いている場面

function sceneCommon(world, mode) {
  const s = {
    mode, world,
    zombies: [], zh: new SpatialHash(64), _nb: [],
    people: [], pickups: [], crates: [], shots: [], enemyShots: [], bolts: [], mines: [], towers: [],
    run: Run.state, t: 0, kills: 0, aimPoint: null, paused: false, over: false,
    loot: { scrap: 0, food: 0, fuel: 0, kits: 0, bp: [] },
    sense: 330, spawnT: 2, fullWarned: false,
    hasRoom(n) { return this.car.cargo + n <= this.car.st.cargo; },
  };
  const rs = Run.state;
  const sc = {
    hp: 1 + (rs.day - 1) * 0.1,
    speed: 1 + (rs.day - 1) * 0.02,
    dmg: (1 + (rs.day - 1) * 0.08) * (rs.easy ? 0.7 : 1),
  };
  s.zscale = sc;
  const g = Run.gridSize();
  s.car = new Car(rs.design, g[0], g[1], rs);
  s.car.scene = s;
  s.car.x = world.start.x; s.car.y = world.start.y; s.car.a = world.start.a;
  s.car.cosA = Math.cos(s.car.a); s.car.sinA = Math.sin(s.car.a);
  G.cam.x = s.car.x; G.cam.y = s.car.y - 80;
  FX.clear();
  return s;
}

function spawnZombie(type, x, y, aware) {
  const z = new Zombie(type, x, y, S.zscale);
  z.aware = !!aware;
  S.zombies.push(z);
  return z;
}

/* ------------------------------ 出撃 ------------------------------ */
function startExpedition(dest) {
  const rs = Run.state;
  const world = genCity({ seed: dest.seed, dest, area: AREAS[dest.area], day: rs.day, mods: dest.mods, easy: rs.easy });
  S = sceneCommon(world, 'exp');
  S.dest = dest;
  S.dusk = dest.mods.includes('dusk');
  for (const z of world.ents.zombies) spawnZombie(z.type, z.x, z.y, false);
  S.pickups = world.ents.pickups; S.crates = world.ents.crates; S.people = world.ents.people;
  S.goal = world.goal || null;
  S.goalDone = dest.type === 'patrol';
  S.exitT = 0; S.leftStart = false; S.loadT = 0; S.surge = false; S.chase = 0; S.loaded = 0;
  S.cap = 150 + rs.day * 10;
  S.onBoard = (p) => {
    rs.rescuedToday = (rs.rescuedToday || 0) + 1;
    if (S.goal && S.goal.kind === 'rescue') {
      const left = S.people.filter((q) => q.goal && !q.dead && q.state !== 'aboard').length;
      if (left === 0) completeGoal();
    }
  };
  S.onGoalCrate = () => {
    S.goal.got++;
    if (S.goal.got >= S.goal.need) completeGoal();
  };
  S.collect = collectPickup;
  if (S.goal && S.goal.kind !== 'collect' && S.goal.kind !== 'crates') S.goal.initial = S.goal.stock;
  UI.hud(true);
  UI.objective();
  Sfx.setEngine(true, 0);
  if (rs.day === 1) {
    toast(Input.isTouch ? '左のスティックを倒した方向へ走る' : 'W / ↑ で走る。A D / ← → で曲がる', '');
    setTimeout(() => toast('速いままぶつかればゾンビを轢ける。行き先は画面の端の矢印の方向', ''), 1800);
  }
}

function completeGoal() {
  if (S.goalDone) return;
  S.goalDone = true;
  S.surge = false;
  S.chase = 30;
  Sfx.alarm();
  toast('目的を果たした！ 入口の撤収地点へ戻ろう', 'good');
  /* 騒ぎを聞きつけて、まわりから群れが寄ってくる */
  const g = S.goal || S.car;
  const mix = zombieMix(S.run.day, {});
  for (let i = 0; i < 8 + S.run.day * 2; i++) {
    const a = rand(TAU), d = rand(520, 820);
    const x = g.x + Math.cos(a) * d, y = g.y + Math.sin(a) * d;
    if (S.world.free(x, y, 12)) spawnZombie(new RNG((Math.random() * 1e9) | 0).weighted(mix).id, x, y, true);
  }
  UI.objective();
}

function collectPickup(p) {
  const car = S.car, perks = S.run.perks;
  switch (p.kind) {
    case 'scrap': {
      const n = Math.round(p.amt * (1 + 0.25 * (perks.scrap || 0)));
      S.loot.scrap += n; FX.text(p.x, p.y - 10, '+' + n, '#cfd6dd', 12); Sfx.pickup(); break;
    }
    case 'pile': {
      const n = Math.round(p.amt * (1 + 0.25 * (perks.scrap || 0)));
      S.loot.scrap += n; FX.text(p.x, p.y - 16, 'スクラップ +' + n, '#e6ecf2', 16); Sfx.good();
      FX.burst(p.x, p.y, 16, { col: '#9aa3ad', kind: 'rect', r: 3, spMin: 80, spMax: 260, lifeMin: 0.3, lifeMax: 0.7 });
      if (S.goal && S.goal.kind === 'collect') { S.goal.got++; UI.objective(); if (S.goal.got >= S.goal.need) completeGoal(); }
      break;
    }
    case 'food': car.cargo += 1; car.cargoKind = car.cargoKind || 'food'; S.loot.food += 1; FX.text(p.x, p.y - 10, '食料 +1', '#ffe08a', 13); Sfx.pickup(); break;
    case 'fuel': car.cargo += 2; car.cargoKind = car.cargoKind || 'fuel'; S.loot.fuel += 1; FX.text(p.x, p.y - 10, '燃料 +1', '#ff9a8a', 13); Sfx.pickup(); break;
    case 'kit': car.healAll(0.3); S.loot.kits++; FX.text(p.x, p.y - 10, '修理 +30%', '#7ee39b', 15); Sfx.good(); car.derive(); break;
    case 'bp': { const msg = Run.giveBlueprint(); S.loot.bp.push(msg); toast(msg, 'good'); Sfx.level(); break; }
  }
}

/* 搬入口・給油機の前で止まっていると少しずつ積める */
const LOAD_RATE = { food: { per: 1, slot: 1, every: 0.26 }, fuel: { per: 1, slot: 2, every: 0.55 }, scrap: { per: 5, slot: 1, every: 0.3 } };
function updateGoal(dt) {
  const car = S.car, g = S.goal;
  if (!g || S.goalDone) { S.surge = false; return; }
  if (g.kind === 'load') {
    const inZone = dist(car.x, car.y, g.x, g.y) < g.r && car.speed < 50;
    S.surge = inZone;
    if (!inZone) return;
    const L = LOAD_RATE[g.res];
    S.loadT += dt;
    while (S.loadT >= L.every) {
      S.loadT -= L.every;
      if (g.stock <= 0) { completeGoal(); return; }
      if (!S.hasRoom(L.slot)) {
        if (!S.fullWarned) { S.fullWarned = true; toast('荷台がいっぱいになった。帰ろう', 'bad'); }
        if (S.loaded > 0) completeGoal();
        return;
      }
      g.stock -= 1; S.loaded++;
      car.cargo += L.slot; car.cargoKind = car.cargoKind || g.res;
      if (g.res === 'food') S.loot.food += L.per; else if (g.res === 'fuel') S.loot.fuel += L.per; else S.loot.scrap += L.per;
      g.progress = 1 - g.stock / g.initial;
      Sfx.load();
      FX.text(car.x + rand(-20, 20), car.y - 30, g.res === 'food' ? '食料 +1' : g.res === 'fuel' ? '燃料 +1' : 'スクラップ +5', '#ffe08a', 13);
    }
  } else if (g.kind === 'rescue') {
    const alive = S.people.filter((q) => q.goal && !q.dead);
    S.surge = alive.some((q) => q.state === 'run');
    if (alive.length === 0) { toast('避難所の人たちは助けられなかった', 'bad'); S.goalDone = true; UI.objective(); }
    else if (alive.every((q) => q.state === 'aboard')) completeGoal();
    else if (car.st.seats - car.riders.length <= 0 && alive.some((q) => q.state === 'aboard')) {
      /* 座席が埋まった。乗れなかった人は建物に戻って待つ */
      const left = alive.filter((q) => q.state !== 'aboard');
      for (const q of left) { q.state = 'stay'; q.x = g.x + rand(-40, 40); q.y = g.y - g.r + rand(0, 20); }
      toast(`座席が足りず、${left.length}人は避難所に残った`, 'bad');
      completeGoal();
    }
  }
}

function spawnTick(dt) {
  const car = S.car;
  S.spawnT -= dt;
  if (S.chase > 0) S.chase -= dt;
  if (S.spawnT > 0) return;
  const day = S.run.day;
  S.spawnT = S.surge ? 0.8 : S.chase > 0 ? 1.0 : Math.max(0.8, 2.0 - day * 0.09);
  if (S.zombies.length >= S.cap) return;
  const mix = zombieMix(day, { dogs: S.dest.mods.includes('dogs') });
  const rng = new RNG((Math.random() * 1e9) | 0);
  const view = Math.hypot(G.W, G.H) / 2 / G.zoom;
  let cx, cy;
  if (S.surge && S.goal) {
    const a = rand(TAU), d = rand(380, 620);
    cx = S.goal.x + Math.cos(a) * d; cy = S.goal.y + Math.sin(a) * d;
  } else {
    /* 進む先のほうに多めに湧く */
    const ahead = Math.atan2(car.vy, car.vx);
    const a = car.speed > 80 && chance(0.6) ? ahead + rand(-0.9, 0.9) : rand(TAU);
    const d = view + rand(60, 240);
    cx = car.x + Math.cos(a) * d; cy = car.y + Math.sin(a) * d;
  }
  const n = randi(1, 2 + Math.floor(day / 3));
  for (let i = 0; i < n; i++) {
    const x = cx + rand(-50, 50), y = cy + rand(-50, 50);
    if (S.world.free(x, y, 12) && dist(x, y, S.world.start.x, S.world.start.y) > 250) spawnZombie(rng.weighted(mix).id, x, y, S.surge || S.chase > 0 || chance(0.4));
  }
}

function endExpedition(ok) {
  const rs = Run.state, car = S.car;
  S.over = true;
  Sfx.setEngine(false);
  rs.design = car.toDesign();
  if (!ok) { Run.gameOver('車が壊された'); return; }
  const riders = car.riders.slice();
  const res = { dest: S.dest, loot: S.loot, riders: [], kills: S.kills, goalDone: S.goalDone };
  for (const r of riders) res.riders.push(Run.addSurvivor(r.trait));
  rs.scrap += S.loot.scrap; rs.food += S.loot.food; rs.fuel += S.loot.fuel;
  rs.stats.food += S.loot.food; rs.stats.scrap += S.loot.scrap; rs.stats.rescued += riders.length;
  UI.hud(false);
  UI.expeditionResult(res);
}

/* ------------------------------ 襲撃 ------------------------------ */
function startRaid() {
  const rs = Run.state, b = rs.base;
  const dogs = rs.survivors.filter((s) => s.trait === 'dog').length;
  const world = genBase({ seed: rs.seed * 31 + rs.day, wall: b.wall, farm: b.farm, workshop: b.workshop, radio: b.radio, easy: rs.easy, dogs });
  S = sceneCommon(world, 'raid');
  /* 砲台に仲間を立たせる。射撃手から先に */
  const crew = rs.survivors.filter((s) => s.trait !== 'dog').slice().sort((a, c) => (c.trait === 'gunner') - (a.trait === 'gunner'));
  let ci = 0;
  for (const t of b.towers) {
    if (t.slot >= TURRET_SLOTS[b.wall]) continue;
    const who = crew[ci++];
    const tw = makeTower(world.slots[t.slot], t.type, t.lv, who ? (who.trait === 'gunner' ? 'gunner' : 'crew') : null);
    const solid = world.addSolid({ x: tw.x, y: tw.y, r: 20, kind: 'tower', blocks: false, hp: tw.hp, maxhp: tw.maxhp, tower: tw });
    tw.solid = solid;
    S.towers.push(tw);
  }
  const day = rs.day;
  S.raid = {
    dur: 60 + day * 5,
    total: Math.round((40 + (day - 2) * 22) * (rs.easy ? 0.7 : 1)),
    spawned: 0, acc: 0, side: randi(0, 3), sideT: 0,
    bosses: day >= 6 ? (day >= 10 ? [0.45, 0.75] : [0.6]) : [],
    won: false,
  };
  S.hitStructure = hitStructure;
  S.collect = collectPickup;
  S.onBoard = () => {};
  S.onGoalCrate = () => {};
  S.hasRoom = () => true;
  S.night = true;
  UI.hud(true);
  UI.objective();
  Sfx.setEngine(true, 0);
  Sfx.alarm();
  toast(day >= MAX_DAY ? '最後の夜。夜明けまで本部を守りぬけ！' : 'ゾンビの群れが基地に向かってくる！', 'bad');
  if (day === RAID_NIGHTS[0]) setTimeout(() => toast('門は車で近づくと開く。外に出て群れを轢いてもいい', ''), 1800);
}

function hitStructure(s, dmg, z) {
  if (s.tower) {
    const t = s.tower;
    t.hp -= dmg; s.hp = t.hp;
    if (t.hp <= 0 && !t.dead) {
      t.dead = true; s.off = true;
      explode(S, t.x, t.y, 50, 20);
      toast(`${TOWERS[t.type].name}が壊された`, 'bad');
    }
    return;
  }
  s.hp -= dmg;
  FX.burst(z.x, z.y, 2, { col: '#a89878', kind: 'rect', r: 2, spMin: 30, spMax: 90, lifeMin: 0.2, lifeMax: 0.4 });
  if (s.hp <= 0) {
    if (s === S.world.hq) { S.world.hq.hp = 0; raidLost(); return; }
    s.off = true;
    FX.burst(s.x + s.w / 2, s.y + s.h / 2, 16, { col: '#8a7a5a', kind: 'rect', r: 4, spMin: 60, spMax: 220, lifeMin: 0.4, lifeMax: 0.8 });
    Sfx.crash();
    if (Sfx.gate('wallmsg', 4000)) toast(s.kind === 'gate' ? '門が破られた！' : '防壁が破られた！', 'bad');
  }
}

function raidLost() {
  if (S.over) return;
  S.over = true;
  Sfx.setEngine(false);
  Run.state.design = S.car.toDesign();
  Run.gameOver('本部が落とされた');
}

function updateRaid(dt) {
  const R = S.raid, w = S.world, car = S.car;
  /* 門は車が近づくと開く */
  const gt = w.gate;
  if (gt.hp > 0) {
    const gx = gt.x + gt.w / 2, gy = gt.y + gt.h / 2;
    const near = dist(car.x, car.y, gx, gy) < 120 + car.R * 0.5;
    const inside = Math.abs(car.x - gx) < gt.w / 2 + car.R * 0.6 && Math.abs(car.y - gy) < car.R + 10;
    gt.off = near || inside;
  }
  if (R.won) return;
  const frac = S.t / R.dur;
  if (S.t < R.dur && R.spawned < R.total) {
    /* 15秒ごとに主な方角が変わる。波のように強弱をつける */
    R.sideT -= dt;
    if (R.sideT <= 0) { R.sideT = 15; R.side = randi(0, 3); }
    const pulse = 1 + 0.9 * Math.max(0, Math.sin(S.t * TAU / 15));
    R.acc += dt * (R.total / R.dur) * pulse * 0.8;
    const mix = zombieMix(S.run.day);
    const rng = new RNG((Math.random() * 1e9) | 0);
    while (R.acc >= 1 && R.spawned < R.total) {
      R.acc -= 1; R.spawned++;
      const side = chance(0.7) ? R.side : randi(0, 3);
      const p = edgePoint(side);
      if (w.free(p.x, p.y, 12)) spawnZombie(rng.weighted(mix).id, p.x, p.y, true);
    }
  }
  while (R.bosses.length && frac >= R.bosses[0]) {
    R.bosses.shift();
    const p = edgePoint(randi(0, 3));
    spawnZombie('brute', p.x, p.y, true);
    Sfx.alarm(); toast('巨体が来る！', 'bad');
  }
  if (S.t >= R.dur + 45 && !R.bosses.length && S.zombies.length) {
    for (const z of S.zombies) z.dead = true, z.killedBy = 'dawn';
    toast('夜が明けて、残りの群れは去っていった', 'good');
  }
  if (S.t >= R.dur && S.zombies.length === 0 && !R.bosses.length) {
    R.won = true;
    raidWon();
  }
}

function edgePoint(side) {
  const W = BASE_W, m = 60, r = rand(200, W - 200);
  return side === 0 ? { x: r, y: m } : side === 1 ? { x: W - m, y: r } : side === 2 ? { x: r, y: W - m } : { x: m, y: r };
}

function raidWon() {
  S.over = true;
  Sfx.setEngine(false);
  Sfx.level();
  Run.state.design = S.car.toDesign();
  const res = { kills: S.kills, hq: S.world.hq.hp / S.world.hq.maxhp, towersLost: S.towers.filter((t) => t.dead).length, scrap: S.loot.scrap };
  Run.state.scrap += S.loot.scrap;
  UI.hud(false);
  UI.raidResult(res);
}

/* ------------------------------ 共通の更新 ------------------------------ */
function sceneUpdate(dt) {
  if (!S || S.over) return;
  S.t += dt;
  const car = S.car;

  /* 操作 */
  const ctl = { throttle: 0, steer: 0, nitro: Input.down('nitro'), dir: null, dirMag: 0 };
  if (Input.down('up')) ctl.throttle += 1;
  if (Input.down('down') || Input.down('back')) ctl.throttle -= 1;
  if (Input.down('left')) ctl.steer -= 1;
  if (Input.down('right')) ctl.steer += 1;
  if (Input.stick.on && !Input.down('back')) {
    ctl.dir = Math.atan2(Input.stick.y, Input.stick.x);
    ctl.dirMag = Math.min(1, Math.hypot(Input.stick.x, Input.stick.y) * 1.3);
  }
  S.aimPoint = Input.mouse.down && !Input.isTouch ? screenToWorld(Input.mouse.x, Input.mouse.y) : null;

  car.update(dt, ctl, S.world);
  Sfx.setEngine(!car.dead, car.speed, car.boosting);

  /* ゾンビ */
  S.zh.clear();
  for (const z of S.zombies) S.zh.insert(z);
  for (const z of S.zombies) z.update(dt, S);
  if (S.over) return;   // 本部が落とされた
  collideCarZombies(dt);
  updateCarWeapons(S, dt);
  if (S.mode === 'raid') updateTowers(S, dt);
  updateShots(S, dt);
  updatePickups(S, dt);
  for (const p of S.people) updatePerson(p, dt, S);

  /* 倒れたゾンビを片づける */
  for (let i = S.zombies.length - 1; i >= 0; i--) {
    const z = S.zombies[i];
    if (z.dead) { onKill(z); S.zombies[i] = S.zombies[S.zombies.length - 1]; S.zombies.pop(); }
  }

  if (car.dead) {
    S.over = true;
    explode(S, car.x, car.y, 90, 60);
    Sfx.setEngine(false);
    const scene = S;
    setTimeout(() => { if (S === scene) endExpedition(false); }, 1400);
    return;
  }

  if (S.mode === 'exp') {
    updateGoal(dt);
    spawnTick(dt);
    const ex = S.world.exit;
    const dE = dist(car.x, car.y, ex.x, ex.y);
    if (dE > ex.r + 60) S.leftStart = true;
    if (S.leftStart && dE < ex.r && car.speed < 60) {
      S.exitT += dt;
      ex.progress = S.exitT / 1.4;
      if (S.exitT >= 1.4) { endExpedition(true); return; }
    } else { S.exitT = 0; ex.progress = 0; }
  } else {
    updateRaid(dt);
  }

  if (Run.pendingLevels > 0 && !S.over) UI.showPerks();
}

function collideCarZombies(dt) {
  const car = S.car;
  if (car.dead) return;
  const perks = S.run.perks;
  const near = S.zh.query(car.x, car.y, car.R + 30, S._cq || (S._cq = []));
  for (const z of near) {
    if (z.dead) continue;
    if (dist2(z.x, z.y, car.x, car.y) > (car.R + z.r) * (car.R + z.r)) continue;
    const hit = car.contactCell(z.x, z.y, z.r);
    if (!hit) continue;
    const rx = z.x - car.x, ry = z.y - car.y;
    const cvx = car.vx - car.av * ry, cvy = car.vy + car.av * rx;
    const rel = (cvx - z.vx) * hit.nx + (cvy - z.vy) * hit.ny;
    const cell = hit.cell;
    if (rel > 150 && z.hitCd <= 0) {
      /* 轢いた */
      let ram = 1;
      if (cell.def.ram) {
        const face = car.a + cell.rot * Math.PI / 2;
        if (Math.cos(face) * hit.nx + Math.sin(face) * hit.ny > 0.3) ram = cell.def.ram;
      }
      const dmg = (rel - 90) * 0.5 * car.st.ramPow * ram * (1 + 0.35 * (perks.ram || 0));
      z.hurt(dmg, 'ram', S);
      z.hitCd = 0.3;
      if (!z.def.boss) {
        z.fling = 0.45;
        z.vx = cvx * 0.8 + hit.nx * rel * 0.6; z.vy = cvy * 0.8 + hit.ny * rel * 0.6;
      } else { z.vx += hit.nx * rel * 0.08; z.vy += hit.ny * rel * 0.08; }
      const k = Math.min(0.85, z.def.mass / car.st.M * 0.9);
      car.vx -= hit.nx * rel * k; car.vy -= hit.ny * rel * k;
      const self = z.def.mass * rel * 0.012 * (ram > 1 ? 0.15 : 1) * (z.def.boss ? 2 : 1);
      car.damageCell(cell, self);
      FX.burst(z.x, z.y, 8, { col: GOO, r: 3, spMin: 60, spMax: 240, dir: Math.atan2(hit.ny, hit.nx), spread: 1, lifeMin: 0.2, lifeMax: 0.45 });
      S.world.decal.splat(z.x, z.y, z.r * 0.8);
      Sfx.splat();
      shakeCam(z.def.boss ? 8 : 1.5);
      if (z.def.bomb && !z.dead) { z.hp = 0; z.dead = true; z.killedBy = 'ram'; }
      if (z.def.boss && z.charge > 0) z.charge = 0;
    } else {
      /* 押し合い。ゾンビは張りついて殴ってくる */
      z.x += hit.nx * hit.pen; z.y += hit.ny * hit.pen;
      const vn = z.vx * hit.nx + z.vy * hit.ny;
      if (vn < 0) { z.vx -= vn * hit.nx; z.vy -= vn * hit.ny; }
      if (z.def.boss) {
        const push = z.charge > 0 ? 0.9 : 0.35;
        car.x -= hit.nx * hit.pen * push; car.y -= hit.ny * hit.pen * push;
        if (z.charge > 0) {
          car.vx -= hit.nx * 320; car.vy -= hit.ny * 320; car.av += rand(-2, 2);
          car.damageCell(cell, z.dmg * 1.6); z.charge = 0;
          Sfx.crash(); shakeCam(12);
        }
      }
      if (z.def.bomb) { z.hp = 0; z.dead = true; z.killedBy = 'self'; continue; }
      z.attacking = true;
      z.atkCd -= dt;
      if (z.atkCd <= 0) {
        z.atkCd = 1 / z.def.rate;
        car.damageCell(cell, z.dmg);
        if (Math.random() < 0.3) FX.burst(z.x, z.y, 2, { col: '#ffd27a', kind: 'line', r: 1, spMin: 50, spMax: 120, lifeMin: 0.08, lifeMax: 0.15 });
      }
    }
    /* トゲ。スパイカーは向けた側だけ、スパイクタイヤとノコはどこでも刺す */
    const stab = cell.def.contact && (!cell.def.face || car.facing(hit)) ? cell.def.contact * partPowMul(cell.lv) : 0;
    if (stab) z.hurt(stab * (1 + 0.5 * (perks.spikes || 0)) * dt, 'saw', S);
    else if (perks.spikes && cell.open) z.hurt(9 * perks.spikes * dt, 'saw', S);
    if ((stab || perks.spikes) && Math.random() < dt * 12) FX.burst(z.x, z.y, 1, { col: GOO, r: 2.5, spMin: 30, spMax: 100, lifeMin: 0.15, lifeMax: 0.3 });
  }
}

function onKill(z) {
  if (z.killedBy === 'dawn' || !Run.state) return;
  const d = z.def, perks = S.run.perks;
  S.kills++; S.run.stats.kills++;
  Run.addXp(d.xp * (1 + 0.25 * (perks.xp || 0)));
  S.world.decal.splat(z.x, z.y, z.r * (d.boss ? 1.6 : 0.9));
  FX.burst(z.x, z.y, d.boss ? 30 : 7, { col: GOO, r: 3, spMin: 40, spMax: 200, lifeMin: 0.2, lifeMax: 0.5 });
  if (Math.random() < 0.35) FX.burst(z.x, z.y, 2, { col: d.skin, kind: 'rect', r: 2.5, spMin: 60, spMax: 180, lifeMin: 0.3, lifeMax: 0.6 });
  if (z.killedBy === 'ram') {
    S.car.roadkills++;
    S.combo = S.t - (S.comboT || -9) < 1.6 ? (S.combo || 0) + 1 : 1;
    S.comboT = S.t;
    if (S.combo >= 3) FX.text(S.car.x, S.car.y - 50, `${S.combo}連続！`, S.combo >= 10 ? '#ff7a5a' : '#ffd35a', 14 + Math.min(10, S.combo));
    if (perks.repair) S.car.healWorst(3 * perks.repair);
  }
  Sfx.splat();
  /* スクラップを落とす */
  let drops = d.boss ? 8 : Math.random() < d.scrap ? 1 : 0;
  while (drops-- > 0) S.pickups.push({ x: z.x + rand(-10, 10), y: z.y + rand(-10, 10), kind: 'scrap', amt: randi(1, 3), vx: rand(-60, 60), vy: rand(-60, 60) });
  if (d.boss) { S.pickups.push({ x: z.x, y: z.y, kind: 'kit', amt: 1 }); FX.text(z.x, z.y - 30, '巨体をたおした!', '#ffd35a', 20); shakeCam(10); }
  if (d.bomb) explode(S, z.x, z.y, d.bomb.radius, d.bomb.dmg * S.zscale.dmg, { hurtsCar: d.bomb.dmg * S.zscale.dmg * 0.7, hurtsPeople: 20 });
  if (d.splash && S.car && !S.car.dead) {
    const car = S.car;
    for (const c of car.cells) {
      if (!c.alive) continue;
      const [wx, wy] = car.cellWorld(c);
      if (dist(wx, wy, z.x, z.y) < 36) car.damageCell(c, 8 * S.zscale.dmg);
    }
    FX.burst(z.x, z.y, 14, { col: '#b6c04a', r: 4, spMin: 60, spMax: 200, lifeMin: 0.3, lifeMax: 0.6 });
    S.world.decal.splat(z.x, z.y, 22, '#5a6a20');
  }
  const ex = perks.explode ? [0, 0.12, 0.2, 0.28][perks.explode] : 0;
  if (ex && Math.random() < ex && !d.bomb) explode(S, z.x, z.y, 60, 30);
}

function screenToWorld(sx, sy) {
  return { x: G.cam.x + (sx - G.W / 2) / G.zoom, y: G.cam.y + (sy - G.H / 2) / G.zoom };
}

/* ------------------------------ 描画 ------------------------------ */
let lightCanvas = null;

function sceneDraw(ctx, dt) {
  if (!S) return;
  const car = S.car;
  /* カメラは進む先を少し多めに見せる */
  const look = Math.min(1, car.speed / 400);
  const tx = car.x + car.vx * 0.32, ty = car.y + car.vy * 0.32;
  G.cam.x = lerp(G.cam.x, tx, 1 - Math.pow(0.02, dt));
  G.cam.y = lerp(G.cam.y, ty, 1 - Math.pow(0.02, dt));
  const baseZoom = clamp(Math.sqrt(G.W * G.H) / 800, 0.62, 1.05) * (S.mode === 'raid' ? 0.86 : 1);
  G.zoom = lerp(G.zoom, baseZoom * (1 - 0.14 * look), 1 - Math.pow(0.1, dt));
  G.cam.shake = Math.max(0, G.cam.shake - dt * 30);
  const sx = rand(-1, 1) * G.cam.shake, sy = rand(-1, 1) * G.cam.shake;

  ctx.save();
  ctx.translate(G.W / 2 + sx, G.H / 2 + sy);
  ctx.scale(G.zoom, G.zoom);
  ctx.translate(-G.cam.x, -G.cam.y);
  const hw = G.W / 2 / G.zoom + 40, hh = G.H / 2 / G.zoom + 40;
  const v = { x0: G.cam.x - hw, y0: G.cam.y - hh, x1: G.cam.x + hw, y1: G.cam.y + hh };

  S.world.drawGround(ctx, v);
  S.world.drawZones(ctx);
  FX.draw(ctx, 'low');
  drawPickups(ctx, S);
  for (const p of S.people) drawPerson(ctx, p);
  for (const z of S.zombies) if (z.x > v.x0 - 40 && z.x < v.x1 + 40 && z.y > v.y0 - 40 && z.y < v.y1 + 40) z.draw(ctx);
  for (const t of S.towers) drawTower(ctx, t);
  if (!car.dead || S.t % 0.2 < 0.1) car.draw(ctx);
  drawShots(ctx, S);
  S.world.drawTop(ctx, v);
  FX.draw(ctx, 'top');
  FX.drawTexts(ctx);
  ctx.restore();

  if (S.night || S.dusk) {
    drawLighting(ctx, v, S.night ? 0.64 : 0.4);
    /* 暗がりでも居場所がわかるように、ゾンビの目だけは明かりの上に描く */
    ctx.save();
    ctx.translate(G.W / 2 + sx, G.H / 2 + sy); ctx.scale(G.zoom, G.zoom); ctx.translate(-G.cam.x, -G.cam.y);
    ctx.fillStyle = 'rgba(255,226,90,0.85)';
    for (const z of S.zombies) {
      if (z.x < v.x0 || z.x > v.x1 || z.y < v.y0 || z.y > v.y1 || z.fling > 0) continue;
      const c = Math.cos(z.face), s = Math.sin(z.face), f = z.r * 0.32, k = z.r * 0.28;
      ctx.fillRect(z.x + c * f - s * k - 1, z.y + s * f + c * k - 1, 2.2, 2.2);
      ctx.fillRect(z.x + c * f + s * k - 1, z.y + s * f - c * k - 1, 2.2, 2.2);
    }
    ctx.restore();
  }

  /* 目的地の方向を画面の端に矢印で出す */
  const tgt = S.mode === 'exp' ? (S.goalDone || !S.goal ? S.world.exit : S.goal) : null;
  if (tgt) drawPointer(ctx, tgt.x, tgt.y, S.goalDone || !S.goal ? '#7ee39b' : tgt.col);
  if (S.mode === 'exp' && S.goal && S.goal.kind === 'collect' && !S.goalDone) {
    let best = null, bd = 1e12;
    for (const p of S.pickups) if (p.kind === 'pile') { const d2 = dist2(p.x, p.y, car.x, car.y); if (d2 < bd) { bd = d2; best = p; } }
    if (best) drawPointer(ctx, best.x, best.y, '#cfd6dd');
  }
  if (car.hurtT > 0) {
    const g = ctx.createRadialGradient(G.W / 2, G.H / 2, Math.min(G.W, G.H) * 0.35, G.W / 2, G.H / 2, Math.max(G.W, G.H) * 0.7);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(200,20,20,${car.hurtT})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, G.W, G.H);
  }
}

function drawPointer(ctx, wx, wy, col) {
  const sx = (wx - G.cam.x) * G.zoom + G.W / 2, sy = (wy - G.cam.y) * G.zoom + G.H / 2;
  const m = 46;
  if (sx > m && sx < G.W - m && sy > m + 60 && sy < G.H - m) return;
  const a = Math.atan2(sy - G.H / 2, sx - G.W / 2);
  const k = Math.min((G.W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (G.H / 2 - m - 30) / Math.abs(Math.sin(a) || 1e-6));
  const px = G.W / 2 + Math.cos(a) * k, py = G.H / 2 + 15 + Math.sin(a) * k;
  ctx.save(); ctx.translate(px, py); ctx.rotate(a);
  ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11); ctx.closePath();
  ctx.stroke(); ctx.fill();
  ctx.restore();
  const d = Math.round(dist(wx, wy, S.car.x, S.car.y) / 10);
  ctx.font = `800 12px ${FONT}`; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  const lx = px - Math.cos(a) * 26, ly = py - Math.sin(a) * 26 + 4;
  ctx.strokeText(d + 'm', lx, ly); ctx.fillStyle = '#fff'; ctx.fillText(d + 'm', lx, ly);
}

/* 夜は暗くして、前照灯・砲台・火の明かりだけ抜く */
function drawLighting(ctx, v, dark) {
  if (!lightCanvas) lightCanvas = document.createElement('canvas');
  const lc = lightCanvas;
  const w = Math.ceil(G.W / 2), h = Math.ceil(G.H / 2);
  if (lc.width !== w || lc.height !== h) { lc.width = w; lc.height = h; }
  const l = lc.getContext('2d');
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalCompositeOperation = 'source-over';
  l.clearRect(0, 0, w, h);
  l.fillStyle = `rgba(6,10,26,${dark})`;
  l.fillRect(0, 0, w, h);
  l.globalCompositeOperation = 'destination-out';
  l.setTransform(G.zoom / 2, 0, 0, G.zoom / 2, (G.W / 2 - G.cam.x * G.zoom) / 2, (G.H / 2 - G.cam.y * G.zoom) / 2);
  const light = (x, y, r, a = 1) => {
    const g = l.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = g; l.beginPath(); l.arc(x, y, r, 0, TAU); l.fill();
  };
  const car = S.car;
  light(car.x, car.y, 150, 0.9);
  if (!car.dead) {
    /* 前照灯の扇 */
    const fx = car.x + car.cosA * 40, fy = car.y + car.sinA * 40;
    const g = l.createRadialGradient(fx, fy, 10, fx, fy, 430);
    g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = g;
    l.beginPath(); l.moveTo(fx, fy); l.arc(fx, fy, 430, car.a - 0.45, car.a + 0.45); l.closePath(); l.fill();
  }
  if (S.mode === 'raid') {
    const hq = S.world.hq;
    light(hq.x + hq.w / 2, hq.y + hq.h / 2, 420, 0.75);
    for (const t of S.towers) if (!t.dead) light(t.x, t.y, 170, 0.8);
    /* 防壁の四隅と門の投光器 */
    const B = BASE_BOX;
    for (const [x, y] of [[B.x, B.y], [B.x + B.w, B.y], [B.x, B.y + B.h], [B.x + B.w, B.y + B.h], [B.x + B.w / 2, B.y + B.h]]) light(x, y, 260, 0.6);
  }
  for (const p of FX.list) if (p.glow) light(p.x, p.y, 40 + p.r * 3, 0.7);
  for (const s of S.shots) if (s.kind === 'flame' || s.kind === 'rocket') light(s.x, s.y, 50, 0.5);
  for (const z of S.zombies) if (z.burn > 0) light(z.x, z.y, 50, 0.6);
  ctx.drawImage(lc, 0, 0, G.W, G.H);
}
