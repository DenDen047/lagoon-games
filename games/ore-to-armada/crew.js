/* =========================================================================
   ORE TO ARMADA ― 乗員 (従業員)
   求人 / 雇う / 日給とやる気 / 持ち場 / 船内での動き
   ========================================================================= */
'use strict';

const ROLES = {
  pilot: { name: '操縦士', skill: 'pilot' }, gunner: { name: '砲手', skill: 'gun' }, engineer: { name: '技師', skill: 'repair' },
  miner: { name: '採掘士', skill: 'mine' }, doctor: { name: '医師', skill: 'med' }, rest: { name: '休む', skill: null },
};

const Crew = {
  /* 求人所の候補 (ステーションと日ごとに決まる) */
  candidates(sys) {
    const r = new RNG(sys.seed ^ (G.day * 31337) ^ 0xc0de);
    const n = r.i(3, 5), out = [];
    for (let k = 0; k < n; k++) { const c = this.candidate(r, sys); c.offerId = `${sys.id}-${G.day}-${k}`; if (!(G.hiredOffers || []).includes(c.offerId)) out.push(c); }
    return out;
  },
  candidate(r, sys) {
    const used = new Set(G.crew.map((c) => c.name));
    let name = r.pick(CREW_NAMES); for (let k = 0; k < 10 && used.has(name); k++) name = r.pick(CREW_NAMES);
    const skills = { pilot: r.i(1, 2), gun: r.i(1, 2), repair: r.i(1, 2), mine: r.i(1, 2), med: r.i(1, 2) };
    const main = r.pick(SKILLS).id;
    skills[main] = Math.min(5, r.i(2, 3) + (sys.ring >= 1 && r.chance(0.5) ? 1 : 0) + (sys.ring >= 2 && r.chance(0.4) ? 1 : 0));
    const trait = r.pick(TRAITS).id;
    let wage = Object.values(skills).reduce((a, b) => a + b, 0) * 5;
    if (trait === 'frugal') wage = Math.round(wage * 0.7);
    // 最初の持ち場は、いちばん高い腕前 (肩書き) に合わせる
    const best = SKILLS.slice().sort((a, b) => skills[b.id] - skills[a.id])[0].id;
    const role = { pilot: 'pilot', gun: 'gunner', repair: 'engineer', mine: 'miner', med: 'doctor' }[best];
    return makePerson('crew', { name, skills, trait, wage, morale: 70, role, color: r.pick(SUIT_COLORS), mode: 'walk', xp: {} });
  },
  /* 保存した情報から人を作り直す */
  fromPlain(o) {
    const best = SKILLS.slice().sort((a, b) => o.skills[b.id] - o.skills[a.id])[0].id;
    const role = { pilot: 'pilot', gun: 'gunner', repair: 'engineer', mine: 'miner', med: 'doctor' }[best];
    return makePerson('crew', { name: o.name, skills: Object.assign({}, o.skills), trait: o.trait, wage: o.wage, color: o.color, morale: 70, role, mode: 'walk', xp: {} });
  },
  title(c) { const best = SKILLS.slice().sort((a, b) => c.skills[b.id] - c.skills[a.id])[0]; return best.title; },
  stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); },
  freeBeds(g) { g.updateSys(); return g.sys.beds.length - G.crew.filter((c) => c.gridId === g.id).length; },
  /* 乗員が立てる床があるか (床のない小さな船には乗せられない) */
  hasFloor(g) { let ok = false; g.eachBlock((b) => { if (b.def.walk && !b.def.door && !b.def.airlock) ok = true; }); return ok; },
  hire(c, g) {
    if (G.crew.length >= TUNE.maxCrew) { Toast.show(`乗員は ${TUNE.maxCrew} 人まで`, 'bad'); return false; }
    // クリエイティブでは寝台がなくても、お金がなくても雇える
    if (!g || (!G.creative && this.freeBeds(g) <= 0)) { Toast.show('空いている寝台がない。寝台を置いた船で雇おう', 'bad'); return false; }
    if (!this.hasFloor(g)) { Toast.show(`${g.name} には乗員が立てる床がない。床のある船に乗せよう`, 'bad'); return false; }
    if (!G.creative && !Econ.spend(c.wage)) return false;
    G.hiredOffers = (G.hiredOffers || []).concat(c.offerId || []).slice(-80);
    this.board(c, g);
    G.crew.push(c);
    Toast.show(`${c.name} (${this.title(c)}) を雇った。` + (G.creative ? 'クリエイティブなので無料' : `日給 ${c.wage} ₵`), 'good');
    Quest.event('hire');
    return true;
  },
  /* クリエイティブ: 持ち場を選んで、いつでも1人足す。乗せるのは今いる船 (なければ近くの持ち船) */
  addCreative(role) {
    if (G.crew.length >= TUNE.maxCrew) { Toast.show(`乗員は ${TUNE.maxCrew} 人まで`, 'bad'); return null; }
    const p = G.player, w = personWorld(p);
    const mine = (o) => o && o.faction === 'player' && !o.terrain && !o.dead && (o.kind === 'ship' || o.kind === 'base') && this.hasFloor(o);
    const here = playerShip() || p.grid;
    const g = (mine(here) ? here : null) || nearestGridTo(w.x, w.y, 200, mine);
    if (!g) { Toast.show('乗員が立てる床のある船がない。床のある船に乗っているときか、そのそばで足そう', 'bad'); return null; }
    const c = this.candidate(new RNG((Math.random() * 1e9) | 0), S.sys);
    const sk = ROLES[role].skill;
    if (sk) c.skills[sk] = Math.max(c.skills[sk], 4);
    c.role = role;
    this.board(c, g);
    G.crew.push(c);
    Toast.show(`${c.name} (${ROLES[role].name}) が ${g.name} に乗った`, 'good');
    Quest.event('hire');
    return c;
  },
  hireRescued(c) {
    const g = S.grids.find((o) => o.faction === 'player' && !o.terrain && this.freeBeds(o) > 0);
    S.persons = S.persons.filter((p) => p !== c);
    if (!g) { Toast.show('空いている寝台がないので雇えなかった', 'bad'); return; }
    c.kind = 'crew'; c.survivor = null; c.hidden = false; c.inShip = false;
    this.board(c, g);
    G.crew.push(c);
    Toast.show(`${c.name} が乗員になった`, 'good');
  },
  /* 船に乗せる (寝台の横に立たせる) */
  board(c, g) {
    if (c.seat) { c.seat.occ = null; c.seat = null; }
    c.att = null; c.path = null; c.jobKey = null; c.blockedJob = null; c.fleeing = false;
    g.updateSys();
    const bed = g.sys.beds[0];
    const spots = bed ? cellsBeside(g, bed, c).concat([[bed.x, bed.y]]) : [];
    const any = []; g.eachBlock((b) => { if (b.def.walk && !b.def.door && !b.def.airlock) any.push([b.x, b.y]); });
    const s = spots[0] || any[0] || [0, 0];
    c.mode = 'walk'; c.grid = g; c.lx = s[0] + 0.5; c.ly = s[1] + 0.5; c.gridId = g.id; c.sysId = S.sys.id; c.dead = false;
    if (!S.persons.includes(c)) S.persons.push(c);
  },
  fire(c) {
    G.crew = G.crew.filter((x) => x !== c);
    if (c.seat) standUp(c);
    S.persons = S.persons.filter((x) => x !== c);
    Toast.show(`${c.name} に辞めてもらった`);
  },
  /* のんびり: 重傷で3日休む。安全な船へ運ばれる (なければ脱出ポッド扱いで次の船に合流) */
  injure(c) {
    c.hp = 30; c.o2 = TUNE.suitO2; c.injuredUntil = G.day + 3;
    const home = S.grids.find((o) => o.faction === 'player' && !o.terrain && !o.dead && !o.abandoned && o.selfDestruct == null && o.count > 3);
    if (c.seat) { c.seat.occ = null; c.seat = null; }
    if (home) this.board(c, home);
    else { c.inPod = true; c.grid = null; c.gridId = null; S.persons = S.persons.filter((x) => x !== c); }
    Toast.show(`${c.name} が重傷を負った。3日のあいだ休む`, 'bad');
  },
  onDeath(c) {
    G.crew = G.crew.filter((x) => x !== c);
    for (const o of G.crew) if (o.gridId === c.gridId && o.trait !== 'brave') o.morale = Math.max(0, o.morale - 15);
  },
  payday() {
    // クリエイティブでは日給はかからない
    if (G.creative) { for (const c of G.crew) c.morale = Math.min(100, c.morale + 5); return; }
    let paid = 0, unpaid = 0;
    const mul = G.diff === 'relaxed' ? 0.5 : 1;
    for (const c of G.crew) {
      const w = Math.round(c.wage * mul);
      if (G.credits >= w) { G.credits -= w; paid += w; c.morale = Math.min(100, c.morale + 5); }
      else { unpaid++; c.morale = Math.max(0, c.morale - 30); }
      if (c.morale <= 0) c.quitting = true;
    }
    if (G.crew.length) Toast.show(`${G.day}日目。日給 ${fmt(paid)} ₵ を払った` + (unpaid ? `。${unpaid}人に払えなかった` : ''), unpaid ? 'bad' : '');
  },
  /* ステーションに寄ったとき、やる気が尽きた乗員は辞める */
  onDock() {
    for (const c of G.crew.slice()) if (c.quitting) { this.fire(c); Toast.show(`${c.name} は給料が出ないので辞めていった`, 'bad'); }
  },

  /* ---------- 船内での動き ---------- */
  tick(dt) {
    for (const g of S.grids) if (g.sys) { g.doctorHere = false; g.gunseatMan = false; for (const b of g.sys.turrets) if (b.gunnerT > 0) b.gunnerT -= dt; else b.gunner = null; }
    for (const c of S.persons) {
      if (c.dead) continue;
      if (c.kind === 'crew') this.ai(c, dt);
      else if (c.kind === 'hostile') hostileAI(c, dt);
      else if (c.kind === 'survivor') this.survivorAI(c, dt);
    }
    S.persons = S.persons.filter((p) => !p.dead);
    // 船の乗員の働き
    for (const g of S.grids) {
      if (g.faction !== 'player' || !g.sys) continue;
      const pilot = g.sys.pilotSeats.map((s) => s.occ).find((o) => o && o.kind === 'crew');
      g.crewPilot = pilot || null;
      g.pilotBonus = pilot && pilot.seat.def.bridge ? 1.1 : 1;
      g.mineMul = 1 + (pilot ? (pilot.skills.mine - 1) * 0.15 + (pilot.trait === 'deft' ? 0.2 : 0) : 0);
      g.mineYield = pilot && pilot.skills.mine >= 4 ? 3 : 2;
    }
  },
  ai(c, dt) {
    c.moved = false;
    const g = c.grid;
    if (c.mode === 'eva') { this.floatHome(c, dt); return; }
    if (!g || g.dead) { c.mode = 'eva'; return; }
    c.repT = (c.repT || 0) - dt;
    const home = S.grids.find((o) => o.id === c.gridId);
    // 空気のない部屋からは逃げる (技師は宇宙服で3分まで働ける)
    const vac = c.mode === 'walk' && !breathable(c);
    if (vac && !(c.role === 'engineer' && c.o2 > 60)) {
      if (!c.fleeing) { c.fleeing = true; c.path = null; }
      if (!c.path || !c.path.length) {
        const goals = [];
        for (const r of g.rooms) if (!r.leak && r.air / r.size > 0.6) for (let k = 0; k < r.cells.length && goals.length < 200; k += 2) goals.push([r.cells[k], r.cells[k + 1]]);
        c.avoidVac = false;
        c.path = goals.length ? findPath(g, c, Math.floor(c.lx), Math.floor(c.ly), goals) : null;
        if (!c.path) c.path = [];
      }
      if (!followPath(c, dt)) return;
    }
    c.fleeing = false;
    if (c.mode === 'seat') {
      const keep = (c.role === 'pilot' || c.role === 'miner') && c.seat.def.seat === 'pilot' && g === home && !(G.player.grid === g && G.player.mode === 'seat' && G.player.seat === c.seat);
      const keepGun = c.role === 'gunner' && c.seat.def.seat === 'gunner';
      if (keepGun) g.gunseatMan = true;
      if (!keep && !keepGun) standUp(c);
      else { this.tickXp(c, dt); movePerson(c, dt, { x: 0, y: 0 }); return; }
    }
    // 陽気: 同じ船の仲間のやる気が少しずつ上がる
    if (c.trait === 'cheer') for (const o of G.crew) if (o !== c && o.grid === g) o.morale = Math.min(100, o.morale + dt * 0.03);
    // 臆病: 船が撃たれているあいだ、ときどき持ち場を離れて休む
    if (c.trait === 'timid' && g.flash > 0 && Math.random() < dt * 0.02) { c.scaredT = 8; if (c.seat) standUp(c); }
    if (c.scaredT > 0) c.scaredT -= dt;
    // 持ち場を決める (重傷のあいだと、怖がっているあいだは休む)
    const role = c.role;
    if (c.injuredUntil > G.day || c.scaredT > 0) c.role = 'rest';
    const job = this.job(c, g, home);
    c.role = role;
    if (!job) { movePerson(c, dt, { x: 0, y: 0 }); return; }
    if (c.jobKey !== job.key || !c.path || (c.pathT -= dt) < 0) {
      c.jobKey = job.key; c.pathT = 3;
      c.avoidVac = c.role !== 'engineer';
      c.path = findPath(g, c, Math.floor(c.lx), Math.floor(c.ly), job.goals);
      if (!c.path) { c.path = []; c.blockedJob = job.key; }
    }
    const arrived = c.path.length === 0 ? job.goals.some(([i, j]) => i === Math.floor(c.lx) && j === Math.floor(c.ly)) : followPath(c, dt);
    if (!c.moved) movePerson(c, dt, { x: 0, y: 0 });
    if (arrived) job.act(dt);
  },
  job(c, g, home) {
    const s = g.sys;
    const beside = (b) => cellsBeside(g, b, c);
    const on = (b) => { const o = []; for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) o.push([i, j]); return o; };
    if (c.role === 'pilot' || c.role === 'miner') {
      const pl = G.player;
      const seat = g === home && s.pilotSeats.find((b) => (!b.occ || b.occ === c) && !(pl.seat === b));
      if (seat) return { key: 'seat' + seat.i, goals: beside(seat), act: () => { sitDown(c, g, seat); } };
    }
    if (c.role === 'gunner') {
      const gs = s.seats.find((b) => b.def.seat === 'gunner' && !b.occ);
      if (gs) return { key: 'gseat' + gs.i, goals: beside(gs), act: () => sitDown(c, g, gs) };
      const t = s.turrets.find((b) => !b.gunner || b.gunner === c);
      if (t) return { key: 'tur' + t.i, goals: beside(t), act: (dt) => { t.gunner = c; t.gunnerT = 0.5; this.tickXp(c, dt); } };
    }
    if (c.role === 'engineer') {
      c.o2Left = c.o2;
      let best = null, bd = 1e9;
      g.eachBlock((b) => { if (b.hp < b.def.hp * 0.98 && c.blockedJob !== 'rep' + b.i) { const d = dist2(b.x, b.y, c.lx, c.ly); if (d < bd) { bd = d; best = b; } } });
      if (best) return { key: 'rep' + best.i, goals: beside(best), act: (dt) => { if (!repairBlock(g, best, 15 * dt * (c.trait === 'neat' ? 1.4 : 1) * (0.7 + c.skills.repair * 0.15))) { c.jobKey = null; } this.tickXp(c, dt); } };
      if (g.plan && g.plan.length) {
        const [id, x, y, r] = g.plan[0];
        const fake = { x, y, w: Grid.sizeOf(BLOCKS[id], r)[0], h: Grid.sizeOf(BLOCKS[id], r)[1] };
        return { key: 'plan' + x + ',' + y, goals: beside(fake), act: () => { if (c.repT <= 0) { c.repT = 1.2; if (!Blueprints.buildPlanAt(g, x, y)) { g.plan.push(g.plan.shift()); c.jobKey = null; } } } };
      }
    }
    if (c.role === 'doctor') {
      const m = s.medbays[0];
      if (m) return { key: 'med', goals: on(m), act: () => { g.doctorHere = true; } };
    }
    const bed = s.beds.find((b) => true);
    if (bed) return { key: 'bed', goals: on(bed), act: (dt) => { c.morale = Math.min(100, c.morale + dt * 0.02); } };
    return null;
  },
  tickXp(c, dt) {
    const sk = ROLES[c.role] && ROLES[c.role].skill;
    if (!sk) return;
    c.xp[sk] = (c.xp[sk] || 0) + dt;
    const need = 600 * c.skills[sk];
    if (c.xp[sk] >= need && c.skills[sk] < 5) { c.xp[sk] = 0; c.skills[sk]++; c.wage += 5; Toast.show(`${c.name} の${SKILLS.find((s) => s.id === sk).name}が ★${c.skills[sk]} に上がった`, 'good'); }
  },
  /* 船外に放り出された乗員は、家の船へ泳いで戻ろうとする */
  floatHome(c, dt) {
    const safe = (o) => !o.dead && !o.abandoned && o.selfDestruct == null && o.faction === 'player' && !o.terrain;
    const home = S.grids.find((o) => o.id === c.gridId && safe(o)) || S.grids.find(safe);
    let input = { x: 0, y: 0 };
    if (home) {
      home.updateSys();
      const entry = [];
      home.eachBlock((b) => { if (b.def.id === 'airlock' || b.def.door) entry.push(b); });
      const tgt = entry.length ? home.blockWorld(entry[0]) : { x: home.x, y: home.y };
      const w = personWorld(c), dx = tgt.x - w.x, dy = tgt.y - w.y, d = Math.hypot(dx, dy) || 1;
      const v = personVel(c), hv = home.velAt(w.x, w.y);
      input = { x: clamp(dx / d * 0.8 - (v.x - hv.x) * 0.1, -1, 1), y: clamp(dy / d * 0.8 - (v.y - hv.y) * 0.1, -1, 1) };
      if (c.att) c.att = null;
    }
    c.suit = Math.max(c.suit, 20);
    movePerson(c, dt, input);
    if (c.mode === 'walk') { c.gridId = c.grid.id; }
  },
  survivorAI(c, dt) {
    // 主人公が同じ船に入ってきたらついていく
    const pl = G.player;
    let input = { x: 0, y: 0 };
    if (c.follow || (pl.mode === 'walk' && pl.grid === c.grid && dist(pl.lx, pl.ly, c.lx, c.ly) < 5)) {
      if (!c.follow) { c.follow = true; Toast.show(`${c.name}「助かった！ついていきます」`, 'good'); }
      const a = personWorld(c), b = personWorld(pl), d = dist(a.x, a.y, b.x, b.y);
      if (d > 1.6) input = { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
      if (c.mode === 'eva' && d > 30) { c.x = b.x + 1; c.y = b.y; }
      // 主人公が船に乗ったら一緒に乗る
      const ship = playerShip();
      if (ship && d < 12) {
        const m = G.missions.find((x) => x.id === c.survivor);
        if (m) m.rescued = true;
        // 船の中に乗ったことにする (席は使わない)
        c.hidden = true; c.mode = 'walk'; c.grid = ship; c.lx = ship.comX; c.ly = ship.comY; c.inShip = true;
      }
    }
    if (!c.inShip) movePerson(c, dt, input);
  },
};
