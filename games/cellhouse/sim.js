/* =========================================================================
   CELLHOUSE ― 刑務所の運営
   時間 / お金 / 入所と出所 / ケンカ・暴動・脱走 / 研究 / 補助金 / 車 / 建築の仕事
   ========================================================================= */
'use strict';

const DAY_SEC = HOUR_SEC * 24;
const NEED_W = { hunger: 1.3, sleep: 1, bladder: 0.5, hygiene: 0.8, exercise: 0.6, fun: 0.6, family: 0.4, freedom: 0.7, comfort: 0.7, safety: 0.9 };
const outsidePred = (w) => (i) => w.isOutside(i % MAP_W, (i / MAP_W) | 0);

class Sim {
  constructor(world) {
    this.world = world;
    this.people = [];
    this.byId = new Map();
    this.nextId = 1;
    this.jobs = new Jobs(this);
    world.reservedAt = (i) => this.jobs.reserved(i);
    this.vehicles = [];
    this.fx = [];
    this.logs = [];
    this.t = 7 * HOUR_SEC;
    this.lastHour = 7;
    this.lastDay = 1;
    this.secT = 0;
    this.money = START_MONEY;
    this.ledger = Sim.newLedger();
    this.lastLedger = null;
    this.history = [];
    this.policy = {
      intakeOn: true, intake: [2, 2, 0], cap: true,
      mealQty: 1, mealQual: 1, solitary: true, solHours: 6, workSec: [true, true, false],
    };
    this.sched = DEFAULT_SCHED.slice();
    this.research = new Set();
    this.resActive = {};
    this.resProg = {};
    this.grantsDone = new Set();
    const self = this;
    this.stat = {
      goods: 0, graduates: 0, calmDays: 0, escapes: 0, riots: 0, fights: 0, hospital: 0,
      released: 0, found: 0, meals: 0, dayEscapes: 0, dayRiots: 0, arrived: 0, visits: 0,
      homeBeds() { let n = 0; for (const r of self.world.rooms) if (r.valid && (r.type === 'cell' || r.type === 'dorm')) n += r.cap; return n; },
      perimeterClosed() { return self.perimeterClosed(); },
    };
    this.kitchenFood = 0;
    this.meal = { id: -1, cooked: 0 };
    this.laundry = 60;
    this.powerOK = true; this.powerUse = 0; this.powerCap = GRID_POWER;
    this.searchQueue = [];
    this.visits = [];
    this.HW = Math.ceil(MAP_W / 4);
    this.heat = new Float32Array(this.HW * Math.ceil(MAP_H / 4));
    this.pathBudget = 40;
    this.negDays = 0;
    this.loan = null;
    this.over = null;
    this.activeDoors = new Set();
    this.touched = new Set();
    this.stock = -1;
    this.truckT = -999;
    this.perimCache = { t: -99, v: null };
    this.grantT = 0;
    this.onLog = null;
    this.onDay = null;
  }

  static newLedger() { return { inc: {}, out: {} }; }

  /* ------------------------------ 時間 ------------------------------ */
  day() { return Math.floor(this.t / DAY_SEC) + 1; }
  hourF() { return (this.t % DAY_SEC) / HOUR_SEC; }
  hour() { return Math.floor(this.hourF()); }
  act(h) { if (h === undefined) h = this.hour(); return this.sched[((h % 24) + 24) % 24]; }

  /* ------------------------------ お金 ------------------------------ */
  earn(n, cat) { this.money += n; this.ledger.inc[cat] = (this.ledger.inc[cat] || 0) + n; }
  spend(n, cat) { this.money -= n; this.ledger.out[cat] = (this.ledger.out[cat] || 0) + n; }
  canAfford(n) { return this.money >= n; }

  log(text, kind = 'info', x, y) {
    const e = { t: this.t, text, kind, x, y };
    this.logs.unshift(e);
    if (this.logs.length > 80) this.logs.length = 80;
    if (this.onLog) this.onLog(e);
  }

  /* ------------------------------ 1ステップ ------------------------------ */
  step(dt) {
    if (this.over) return;
    this.pathBudget = 40;
    this.t += dt;
    const w = this.world;
    if (w.roomsDirty) { w.recomputeRooms(this.research); this.afterRooms(); }
    const h = this.hour(), d = this.day();
    if (h !== this.lastHour) { this.lastHour = h; this.onHour(h); }
    if (d !== this.lastDay) { this.lastDay = d; this.newDay(); }
    this.secT += dt;
    if (this.secT >= 1) { this.secT -= 1; this.onSecond(); }
    const ps = this.people;
    for (let k = 0; k < ps.length; k++) if (!ps[k].gone) ps[k].update(dt);
    if (this.removed) { this.people = this.people.filter((p) => !p.gone); this.removed = false; }
    this.updateDoors(dt);
    this.updateVehicles(dt);
    this.updateVisits(dt);
    this.updateResearch(dt);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.life);
  }

  touchDoor(i) { this.touched.add(i); this.activeDoors.add(i); }
  updateDoors(dt) {
    const w = this.world;
    for (const i of this.activeDoors) {
      if (this.touched.has(i)) w.doorOpen[i] = Math.min(1, w.doorOpen[i] + dt * 5);
      else {
        w.doorOpen[i] = Math.max(0, w.doorOpen[i] - dt * 2.5);
        if (w.doorOpen[i] <= 0) this.activeDoors.delete(i);
      }
    }
    this.touched.clear();
  }

  afterRooms() {
    const w = this.world;
    for (const r of w.rooms) r.owners = [];
    for (const p of this.people) {
      if (p.kind !== 'prisoner') continue;
      const r = p.home >= 0 ? w.roomByKey.get(p.home) : null;
      if (!r || !r.valid || !HOME_ROOMS.includes(r.type)) { p.home = -1; p.homeDoors = null; }
      else { r.owners.push(p.id); p.homeDoors = new Set(r.doors); }
      if (p.confined >= 0) {
        const c = w.roomByKey.get(p.confined);
        if (!c || !c.valid || c.type !== 'solitary') { p.confined = -1; if (p.state === 'solitary') p.state = 'normal'; }
      }
      p.inHome = p.home >= 0 && w.roomAt[p.ti] >= 0 && w.rooms[w.roomAt[p.ti]].key === p.home;
    }
    /* 定員オーバーを直す */
    for (const r of w.rooms) {
      while (r.owners.length > r.cap) {
        const id = r.owners.pop();
        const p = this.byId.get(id);
        if (p) { p.home = -1; p.homeDoors = null; }
      }
    }
    const dels = w.roomsOf('deliveries');
    if (dels.length) {
      let best = dels[0];
      for (const r of dels) if (r.y1 > best.y1) best = r;
      const cx = Math.floor(best.cx), cy = Math.floor(best.cy);
      let bi = best.tiles[0], bd = 1e9;
      for (const i of best.tiles) {
        if (!w.canWalk(i, null, false)) continue;
        const d = dist(i % MAP_W, (i / MAP_W) | 0, cx, cy);
        if (d < bd) { bd = d; bi = i; }
      }
      this.stock = bi;
    } else this.stock = w.idx(MAP_W >> 1, WALK_Y - 1);
    this.perimCache.t = -99;
  }
  stockTile() { if (this.stock < 0) this.afterRooms(); return this.stock; }
  stopX() { return (this.stockTile() % MAP_W) + 0.5; }
  exitTile() { return this.world.idx(Math.floor(this.stopX()), WALK_Y); }

  /* ------------------------------ 毎時 ------------------------------ */
  onHour(h) {
    const w = this.world;
    const act = this.act(h), prev = this.act(h - 1);
    w.jailLocked = act === 'sleep' || act === 'lock';
    if (act !== prev) {
      if (prev === 'eat') {
        for (const o of w.objects.values()) if (o.key === 'serving') o.food = 0;
        this.kitchenFood = 0;
      }
      for (const p of this.people) {
        if (p.kind === 'prisoner' && p.state === 'normal' && !p.visit) { p.endPlan(); p.cool = rnd() * 2.5; }
      }
    }
    if (h === 9 && this.day() > 1) this.intake();
    if (h === 10) this.releaseDue();
    this.upgradeHomes();
    this.assignTasks();
    this.hourlyPrisoners();
    if (act === 'sleep') this.tunnels();
    if (act === 'free' || act === 'yard') this.maybeVisits();
    for (let k = 0; k < this.heat.length; k++) this.heat[k] *= 0.55;
    this.laundry = Math.max(0, this.laundry - 3);
    if (this.jobs.crateJobs() > 0 && this.t - this.truckT > HOUR_SEC * 2) { this.truckT = this.t; this.spawnVehicle('truck'); }
    if (this.onHourCb) this.onHourCb(h);
  }

  newDay() {
    let pay = 0;
    const mul = this.research.has('subsidy') ? 1.15 : 1;
    for (const p of this.people) {
      if (p.kind !== 'prisoner' || p.state === 'release') continue;
      pay += SEC[p.sec].pay * mul;
      p.served += 1;
    }
    if (pay) this.earn(Math.round(pay), 'pay');
    let wages = 0;
    const wm = this.research.has('payroll') ? 0.9 : 1;
    for (const p of this.people) if (p.kind === 'staff' && !p.leaving) wages += STAFF[p.role].wage * wm;
    if (wages) this.spend(Math.round(wages), 'wage');
    if (this.loan) {
      this.spend(this.loan.per, 'loan');
      if (--this.loan.left <= 0) { this.loan = null; this.log('融資を返し終えた', 'good'); }
    }
    if (this.stat.dayEscapes === 0 && this.stat.dayRiots === 0) this.stat.calmDays++;
    else this.stat.calmDays = 0;
    this.stat.dayEscapes = 0; this.stat.dayRiots = 0;
    for (const p of this.people) if (p.kind === 'prisoner') p.taskBan = null;
    const inc = Object.values(this.ledger.inc).reduce((a, b) => a + b, 0);
    const out = Object.values(this.ledger.out).reduce((a, b) => a + b, 0);
    this.history.push({ day: this.day() - 1, money: Math.round(this.money), inc: Math.round(inc), out: Math.round(out), pris: this.prisonerCount() });
    if (this.history.length > 40) this.history.shift();
    this.lastLedger = this.ledger;
    this.ledger = Sim.newLedger();
    if (this.money < 0) {
      this.negDays++;
      if (this.negDays >= 3) { this.over = 'bankrupt'; this.log('3日続けて赤字のまま。刑務所は閉鎖された', 'bad'); }
      else this.log(`お金がマイナスです。あと${3 - this.negDays}日で閉鎖されます`, 'bad');
    } else this.negDays = 0;
    if (this.onDay) this.onDay();
  }

  /* ------------------------------ 毎秒 ------------------------------ */
  onSecond() {
    const w = this.world;
    /* 電気は大事な設備から順に回す。足りない分は止まる */
    let cap = GRID_POWER, use = 0;
    const users = [];
    for (const o of w.objects.values()) {
      if (o.hp <= 0) { o.powered = false; continue; }
      if (o.def.supply) cap += o.def.supply;
      if (o.def.power) { use += o.def.power; users.push(o); }
    }
    users.sort((a, b) => (POWER_PRIO[a.key] || 5) - (POWER_PRIO[b.key] || 5));
    let left = cap;
    for (const o of users) { o.powered = left >= o.def.power; if (o.powered) left -= o.def.power; }
    const was = this.powerOK;
    this.powerCap = cap; this.powerUse = use; this.powerOK = use <= cap;
    if (was && !this.powerOK) this.log('電力が足りない。優先度の低い設備から止まった', 'warn');

    for (const p of this.people) {
      if (p.kind !== 'prisoner') continue;
      this.tickNeeds(p);
      if (p.state === 'solitary' && this.t >= p.solUntil) {
        p.state = 'normal'; p.confined = -1; p.endPlan();
      }
      if (p.rioting) {
        p.anger -= 0.12;
        if (p.anger < 45) { p.rioting = false; p.state = 'normal'; p.foe = null; }
      }
      if (this.isWanted(p) && !p.noticed && this.seen(p)) {
        p.noticed = true;
        if (p.state === 'escape') this.log(`${p.name} の脱走に看守が気づいた`, 'warn', p.x, p.y);
      }
      if (!this.isWanted(p)) p.noticed = false;
    }
    if ((this.grantT += 1) >= 2) { this.grantT = 0; this.checkGrants(); }
    if (this.seenTiles !== 0) {
      let n = 0;
      for (let i = 0; i < w.n; i++) if (w.tunnelSeen[i]) { w.tunnelSeen[i]--; n++; }
      this.seenTiles = n;
    }
  }

  tickNeeds(p) {
    if (p.state === 'ko' || p.carriedBy || p.state === 'arrive') return;
    const n = p.needs, f = 1 / HOUR_SEC, tr = p.traits;
    n.hunger += NEEDS.hunger.rate * f * (tr.includes('glutton') ? 1.4 : 1);
    if (p.pose !== 'lie') n.sleep += NEEDS.sleep.rate * f;
    n.bladder += NEEDS.bladder.rate * f * (p.pose === 'lie' ? 0.35 : 1);
    n.hygiene += NEEDS.hygiene.rate * f * (this.laundry < 30 ? 1.35 : 1);
    n.exercise += NEEDS.exercise.rate * f * (p.moving ? 0.6 : 1);
    n.fun += NEEDS.fun.rate * f;
    n.family += NEEDS.family.rate * f * (tr.includes('family') ? 1.8 : 1) * (p.contra.includes('phone') ? 0.3 : 1);
    const i = p.ti;
    const r = this.world.roomOf(i);
    if (r && r.type === 'yard') { n.freedom -= 9 * f * Math.min(1.5, r.n / 60); n.exercise -= 2 * f; n.fun -= 4 * f; }
    else if (!this.world.isIndoor(i) && !r) n.freedom -= 3 * f;
    else n.freedom += NEEDS.freedom.rate * f * (p.state === 'solitary' ? 3 : 1);
    if (n.bladder >= 100) {
      n.bladder = 0; n.hygiene = Math.min(100, n.hygiene + 40);
      p.anger = Math.min(100, p.anger + 3);
      this.world.dirt[i] = Math.min(255, this.world.dirt[i] + 80);
    }
    for (const k of NEED_KEYS) n[k] = clamp(n[k], 0, 100);
  }

  seen(p) {
    for (const q of this.people) {
      if ((q.role === 'guard' && q.mode !== 'ko') || q.role === 'police') {
        if (dist(q.x, q.y, p.x, p.y) < (q.role === 'police' ? 13 : 10)) return true;
      }
    }
    return this.camSees(p.x, p.y);
  }
  camSees(x, y) {
    if (!this.world.countRooms('security')) return false;
    let mon = false;
    for (const o of this.world.objects.values()) if (o.key === 'monitor' && o.powered) mon = true;
    if (!mon) return false;
    for (const o of this.world.objects.values()) {
      if (o.key === 'camera' && o.powered && dist(o.x + 0.5, o.y + 0.5, x, y) < 7.5) return true;
    }
    return false;
  }

  /* ------------------------------ 囚人の出入り ------------------------------ */
  prisonerCount() { let n = 0; for (const p of this.people) if (p.kind === 'prisoner' && p.state !== 'release') n++; return n; }
  staffCount(role) { let n = 0; for (const p of this.people) if (p.kind === 'staff' && !p.leaving && (!role || p.role === role)) n++; return n; }
  capacity() { let c = 0; for (const r of this.world.rooms) if (HOME_ROOMS.includes(r.type)) c += r.cap; return c; }
  freeCapacity() { return this.capacity() - this.prisonerCount(); }

  makePrisoner(sec) {
    const p = new Person(this, 'prisoner');
    p.sec = sec;
    p.name = pick(FAMILY_NAMES) + ' ' + pick(GIVEN_NAMES);
    p.crime = pick(CRIMES[sec]);
    p.sentence = rint(4, 7) + sec * 3 + rint(0, sec * 3);
    p.served = 0;
    const tr = [];
    const nt = chance(0.35) ? 2 : 1;
    while (tr.length < nt) {
      const t = pick(TRAIT_KEYS);
      if (tr.includes(t) || (t === 'timid' && tr.includes('volatile')) || (t === 'volatile' && tr.includes('timid')) || (t === 'model' && sec === 2 && chance(0.7))) continue;
      tr.push(t);
    }
    if (sec === 2 && chance(0.4) && !tr.includes('volatile') && !tr.includes('timid')) tr.push('volatile');
    p.traits = tr;
    p.needs = {};
    for (const k of NEED_KEYS) p.needs[k] = rint(10, 35);
    p.anger = rint(5, 20) + sec * 8;
    p.state = 'arrive'; p.escort = true;
    p.home = -1; p.task = null; p.contra = [];
    if (chance(0.04 + sec * 0.04)) p.contra.push(pick(['blade', 'phone', 'cards']));
    p.study = 0; p.graduated = false;
    p.offense = false; p.noticed = false; p.visit = null; p.tunnel = null;
    p.arrivedT = this.t;
    p.solUntil = 0; p.fightT = 0;
    return p;
  }

  add(p, x, y) {
    p.place(x, y);
    this.people.push(p);
    this.byId.set(p.id, p);
    return p;
  }
  remove(p) {
    if (p.gone) return;
    p.endPlan();
    p.gone = true;
    if (p.carriedBy) { p.carriedBy.carrying = null; p.carriedBy = null; }
    if (p.visit) p.visit.done = true;
    this.byId.delete(p.id);
    this.removed = true;
    this.world.roomsDirty = this.world.roomsDirty || p.kind === 'prisoner';
  }

  hire(role) {
    const d = STAFF[role];
    if (!this.canAfford(d.wage)) return 'お金が足りない';
    const why = this.hireBlock(role);
    if (why) return why;
    this.spend(d.wage, 'hire');
    const p = new Person(this, 'staff', role);
    p.name = pick(FAMILY_NAMES) + ' ' + pick(STAFF_GIVEN);
    const ex = this.exitTile();
    this.add(p, (ex % MAP_W) + rint(-1, 1), WALK_Y);
    return '';
  }
  hireBlock(role) {
    const d = STAFF[role];
    if (d.research && !this.research.has(d.research)) return '研究がまだ';
    if (d.unique && this.staffCount(role) > 0) return '1人まで';
    if (d.needRoom && !this.world.countRooms(d.needRoom)) return `${ROOMS[d.needRoom].name}がいる`;
    if (d.admin) {
      if (!this.staffCount('warden')) return '所長がいる';
      if (!this.research.has('deputies')) return '「幹部の登用」の研究がいる';
    }
    return '';
  }
  fire(p) {
    if (p.kind !== 'staff' || p.leaving) return;
    p.leaving = true; p.mode = null; p.target = null;
    p.endPlan();
    this.log(`${STAFF[p.role].name}の${p.name}が辞めた`);
  }

  intake() {
    const pol = this.policy;
    if (!pol.intakeOn) return;
    const want = pol.intake.slice();
    if (!this.research.has('maxsec')) want[2] = 0;
    let total = want[0] + want[1] + want[2];
    if (pol.cap) total = Math.min(total, Math.max(0, this.freeCapacity()));
    if (total <= 0) { this.log('定員に空きがないので、今日の受け入れは見送った'); return; }
    const cargo = [];
    const pool = [];
    for (let s = 0; s < 3; s++) for (let k = 0; k < want[s]; k++) pool.push(s);
    while (cargo.length < total && pool.length) cargo.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    this.spawnVehicle('bus', { cargo });
  }

  releaseDue() {
    for (const p of this.people) {
      if (p.kind !== 'prisoner' || p.served < p.sentence) continue;
      if (p.state !== 'normal' && p.state !== 'solitary') continue;
      p.endPlan();
      p.state = 'release'; p.escort = true; p.confined = -1; p.home = -1; p.homeDoors = null;
      this.stat.released++;
      this.log(`${p.name} が刑期を終えて出所した${p.graduated ? '（教育課程を修了）' : ''}`, 'good');
    }
    this.world.roomsDirty = true;
  }

  assignHome(p) {
    const cur = p.homeRoom();
    if (cur) return cur;
    const w = this.world;
    let best = null, bd = 1e9;
    for (const pass of [['cell', 'dorm'], ['holding']]) {
      for (const r of w.rooms) {
        if (!r.valid || !pass.includes(r.type) || r.owners.length >= r.cap) continue;
        const d = dist(p.x, p.y, r.cx, r.cy) + (r.type === 'dorm' && p.sec === 2 ? 40 : 0);
        if (d < bd) { bd = d; best = r; }
      }
      if (best) break;
    }
    if (!best) return null;
    p.home = best.key; best.owners.push(p.id); p.homeDoors = new Set(best.doors);
    return best;
  }
  /* 房のない囚人に房を、仮監房の囚人に空いた独房・雑居房を割りあてる */
  upgradeHomes() {
    const w = this.world;
    for (const p of this.people) {
      if (p.kind !== 'prisoner' || p.state === 'release' || p.state === 'arrive') continue;
      const h = p.homeRoom();
      if (h && h.type !== 'holding') continue;
      if (h) {
        const free = w.rooms.some((r) => r.valid && (r.type === 'cell' || r.type === 'dorm') && r.owners.length < r.cap);
        if (!free) continue;
        h.owners = h.owners.filter((id) => id !== p.id); p.home = -1; p.homeDoors = null;
      }
      this.assignHome(p);
    }
  }

  assignTasks() {
    const w = this.world;
    const slots = { class: 0, workshop: 0, kitchen: 0, laundry: 0, clean: 0 };
    const spots = (key, type) => { let n = 0; for (const o of w.objects.values()) if (o.key === key && o.hp > 0 && o.room >= 0 && w.rooms[o.room].valid && w.rooms[o.room].type === type) n += w.spots(o).length; return n; };
    if (this.staffCount('teacher')) slots.class = spots('schoolDesk', 'classroom');
    slots.workshop = spots('workbench', 'workshop') + spots('press', 'workshop');
    slots.kitchen = Math.min(spots('cooker', 'kitchen'), w.countRooms('kitchen') * 3);
    slots.laundry = spots('washer', 'laundry');
    const pris = this.people.filter((p) => p.kind === 'prisoner' && p.state !== 'release' && p.state !== 'arrive');
    slots.clean = Math.max(1, Math.floor(pris.length / 12));
    const used = { class: 0, workshop: 0, kitchen: 0, laundry: 0, clean: 0 };
    for (const p of pris) {
      if (!this.policy.workSec[p.sec] || (p.task === 'class' && p.graduated)) p.task = null;
      if (p.task && used[p.task] < slots[p.task]) used[p.task]++;
      else p.task = null;
    }
    const order = ['class', 'workshop', 'kitchen', 'laundry', 'clean'];
    for (const p of pris) {
      if (p.task || !this.policy.workSec[p.sec]) continue;
      for (const k of order) {
        if ((k === 'class' && p.graduated) || k === p.taskBan) continue;
        if (used[k] < slots[k]) { p.task = k; used[k]++; break; }
      }
    }
  }

  /* 苛立ちと、それが引き起こすこと */
  hourlyPrisoners() {
    const w = this.world;
    const cleanRoom = new Map();
    const roomDirt = (r) => {
      if (cleanRoom.has(r.idx)) return cleanRoom.get(r.idx);
      let s = 0; for (const i of r.tiles) s += w.dirt[i];
      const v = s / r.n; cleanRoom.set(r.idx, v); return v;
    };
    const ps = this.people.filter((p) => p.kind === 'prisoner' && !p.gone);
    for (const p of ps) {
      if (p.state === 'arrive' || p.state === 'release') continue;
      const n = p.needs;
      const home = p.homeRoom();
      let c = !home ? 80 : home.type === 'holding' ? 58 : home.type === 'dorm' ? 32 : 22;
      const here = w.roomOf(p.ti) || home;
      if (here) {
        let plants = 0;
        for (const id of here.objs) { const o = w.objects.get(id); if (o && o.key === 'plant') plants++; }
        c += roomDirt(here) / 5 - Math.min(3, plants) * 6;
      }
      if (p.state === 'solitary') c = 70;
      n.comfort = clamp(c, 0, 100);
      let guards = 0;
      for (const q of this.people) if (q.role === 'guard' && dist(q.x, q.y, p.x, p.y) < 9) guards++;
      let sf = this.heatAt(p.x, p.y) * 10 + (p.traits.includes('timid') ? 18 : 0) + (home && home.type === 'dorm' ? 10 : 0) - guards * 7 + 12;
      n.safety = clamp(sf, 0, 100);

      let sum = 0, ws = 0;
      for (const k of NEED_KEYS) { sum += n[k] * NEED_W[k]; ws += NEED_W[k]; }
      const avg = sum / ws;
      p.mood = avg;
      let d = (avg - 35) * 0.35;
      if (d > 0) {
        if (p.traits.includes('volatile')) d *= 1.7;
        if (p.traits.includes('model')) d *= 0.4;
      } else d *= 1.3;
      if (p.state === 'solitary') d = this.research.has('counsel') ? -14 : -7;
      if (p.graduated) d -= 1.5;
      p.anger = clamp(p.anger + d, 0, 100);

      if (p.state !== 'normal' || p.escort) continue;
      if (p.anger > 55) {
        let pr = (p.anger - 55) / 90;
        if (guards > 0) pr *= 0.45;
        if (this.camSees(p.x, p.y)) pr *= 0.6;
        if (rnd() < pr) {
          if (!p.traits.includes('timid') && chance(0.6)) {
            const v = this.nearestPerson(p, 6, (q) => q.kind === 'prisoner' && q !== p && q.state === 'normal') ||
                      this.nearestPerson(p, 4, (q) => q.role === 'guard' && q.mode !== 'ko');
            if (v) this.startFight(p, v);
          } else {
            const t = this.smashTarget(p, 5);
            if (t >= 0) { p.planSmash(t); p.offense = true; }
          }
        }
      }
      if (p.state === 'normal' && p.confined < 0) {
        const esc = p.traits.includes('escapee');
        let want = (esc ? 0.08 : 0.006) * (p.anger > 60 ? 2 : 1) * (n.freedom > 70 ? 1.6 : 1);
        if (p.contra.includes('phone')) want *= 1.5;
        if (rnd() < want && w.search(p.tx, p.ty, p, outsidePred(w), 12000)) {
          p.endPlan(); p.state = 'escape'; p.offense = true;
        }
      }
    }
    const act = this.act();
    const angry = ps.filter((p) => p.state === 'normal' && p.anger > 78);
    if (act !== 'sleep' && angry.length >= Math.max(5, ps.length * 0.25) && chance(0.35)) this.startRiot(ps);
  }

  startRiot(ps) {
    let n = 0, cx = 0, cy = 0;
    for (const p of ps) {
      if (p.state !== 'normal' || p.anger < 62 || p.escort) continue;
      p.endPlan(); p.state = 'riot'; p.rioting = true; p.offense = true; p.say('🔥', 5);
      n++; cx += p.x; cy += p.y;
    }
    if (!n) return;
    this.stat.riots++; this.stat.dayRiots++;
    this.log(`暴動が起きた！ ${n} 人が暴れている`, 'bad', cx / n, cy / n);
    Toast.show(`暴動発生！ ${n} 人`, 'bad');
  }

  tunnels() {
    const w = this.world;
    for (const p of this.people) {
      if (p.kind !== 'prisoner' || p.state !== 'normal' || !p.contra.includes('tool') || !p.inHome) continue;
      const home = p.homeRoom();
      if (!home || home.type === 'holding') continue;
      if (!chance(0.8)) continue;
      if (!p.tunnel) {
        const x = p.tx, y = p.ty;
        const opts = [[x, -1, 0], [MAP_W - 1 - x, 1, 0], [y, 0, -1], [WALK_Y - y, 0, 1]].sort((a, b) => a[0] - b[0]);
        const [, dx, dy] = opts[0];
        const tiles = [];
        let tx = x, ty = y;
        while (!w.isOutside(tx, ty)) { tiles.push(w.idx(tx, ty)); tx += dx; ty += dy; }
        tiles.push(w.idx(tx, ty));
        p.tunnel = { tiles, prog: 0 };
      }
      const tn = p.tunnel;
      tn.prog += p.traits.includes('clever') ? 1.3 : 0.8;
      for (let k = 0; k < Math.min(tn.tiles.length, Math.floor(tn.prog)); k++) w.tunnel[tn.tiles[k]] = p.id;
      this.dirty(p.ti, 25);
      if (tn.prog >= tn.tiles.length) this.escaped(p, true);
    }
  }
  clearTunnel(p, reveal) {
    const w = this.world;
    if (!p.tunnel) return;
    for (const i of p.tunnel.tiles) {
      if (w.tunnel[i] === p.id) { w.tunnel[i] = 0; if (reveal) { w.tunnelSeen[i] = 200; this.seenTiles = 1; } }
    }
    p.tunnel = null;
  }

  escaped(p, viaTunnel) {
    this.stat.escapes++; this.stat.dayEscapes++;
    this.spend(1500, 'penalty');
    this.log(`${p.name} が${viaTunnel ? 'トンネルを掘って' : ''}脱走した（罰金 ¥1,500）`, 'bad', p.x, p.y);
    Toast.show(`${p.name} が脱走！`, 'bad');
    this.clearTunnel(p, true);
    this.remove(p);
  }

  /* ------------------------------ ケンカ ------------------------------ */
  isWanted(p) {
    return p.kind === 'prisoner' && !p.gone && !p.carriedBy && p.state !== 'ko' &&
      (p.state === 'fight' || p.state === 'riot' || p.state === 'escape' || p.vandal);
  }
  nearestPerson(p, r, pred) {
    let best = null, bd = r;
    for (const q of this.people) {
      if (q === p || q.gone || !pred(q)) continue;
      const d = dist(q.x, q.y, p.x, p.y);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }
  startFight(a, b) {
    a.endPlan(); a.state = 'fight'; a.foe = b; a.fightT = 0; a.offense = true; a.say('💢');
    if (b.kind === 'prisoner') {
      b.endPlan(); b.state = 'fight'; b.foe = a; b.fightT = 0;
    } else if (b.role === 'guard' && !b.mode) {
      b.endPlan(); b.mode = 'subdue'; b.target = a;
    }
    this.stat.fights++;
    this.addHeat(a.x, a.y, 3);
    this.log(`${a.name} が${b.kind === 'prisoner' ? b.name : '看守'}に殴りかかった`, 'warn', a.x, a.y);
  }
  cardsTrouble(p) {
    const v = this.nearestPerson(p, 5, (q) => q.kind === 'prisoner' && q.state === 'normal');
    if (v) this.startFight(p, v);
  }
  pickTarget(g) {
    let best = null, bd = g.role === 'police' ? 90 : 45;
    for (const p of this.people) {
      if (!this.isWanted(p) || !p.noticed) continue;
      let n = 0;
      for (const q of this.people) if (q !== g && q.mode === 'subdue' && q.target === p) n++;
      if (g.role === 'guard' && n >= 2) continue;
      const d = dist(p.x, p.y, g.x, g.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  strike(a, b) {
    let dmg = 6 + rnd() * 6;
    if (a.kind === 'prisoner') {
      if (a.traits.includes('strong')) dmg *= 1.5;
      if (a.contra.includes('blade')) dmg *= 1.8;
    } else if (a.role === 'guard') dmg = (11 + rnd() * 6) * (this.research.has('riotgear') ? 1.4 : 1);
    else if (a.role === 'police') dmg = 20 + rnd() * 8;
    if (b.kind === 'prisoner' && b.traits.includes('strong')) dmg *= 0.75;
    if (b.role === 'guard' && this.research.has('riotgear')) dmg *= 0.55;
    b.hp -= dmg; b.hitT = 0.25;
    this.fx.push({ k: 'hit', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0, life: 0.35 });
    this.addHeat(b.x, b.y, 1);
    if (b.kind === 'staff' && b.role === 'guard' && !b.mode) { b.endPlan(); b.mode = 'subdue'; b.target = a; }
    if (b.hp <= 0) { this.hospital(b); return; }
    const byLaw = a.role === 'guard' || a.role === 'police';
    if (b.kind === 'prisoner' ? (b.hp < (byLaw ? 55 : 25)) : b.hp < 20) this.knockOut(b, a);
  }
  knockOut(b, by) {
    const byLaw = by && (by.role === 'guard' || by.role === 'police');
    if (b.kind === 'prisoner') {
      b.endPlan();
      b.state = 'ko'; b.koUntil = this.t + HOUR_SEC * (by && by.role === 'police' ? 1.5 : 1);
      b.foe = null; b.vandal = false; b.noticed = false;
      if (b.rioting) { b.rioting = false; b.anger = 35; }
      if (byLaw) {
        let found = 0;
        b.contra = b.contra.filter((c) => { if (chance(0.7)) { found++; return false; } return true; });
        if (found) { this.stat.found += found; this.log(`${b.name} の身体検査で隠し物を${found}つ見つけた`, 'good', b.x, b.y); }
      }
    } else {
      b.endPlan(); b.mode = 'ko'; b.koUntil = this.t + HOUR_SEC; b.target = null;
      this.log(`${STAFF[b.role] ? STAFF[b.role].name : ''}の${b.name}が倒された`, 'warn', b.x, b.y);
    }
  }
  hospital(p) {
    this.stat.hospital++;
    if (p.kind === 'prisoner') this.spend(1500, 'penalty');
    this.log(`${p.name} が重いけがで外の病院へ運ばれた${p.kind === 'prisoner' ? '（¥1,500）' : ''}`, 'bad', p.x, p.y);
    this.spawnVehicle('ambulance');
    this.remove(p);
  }
  treat(pt, doc) {
    if (pt.gone || dist(pt.x, pt.y, doc.x, doc.y) > 2.5) return;
    pt.hp = Math.min(100, pt.hp + 50);
    if (pt.kind === 'prisoner' && pt.state === 'ko') pt.koUntil = Math.min(pt.koUntil, this.t + 4);
    if (pt.mode === 'ko') pt.koUntil = Math.min(pt.koUntil, this.t + 2);
    this.fx.push({ k: 'heal', x: pt.x, y: pt.y, t: 0, life: 1 });
  }
  requestSolitary(p, guard) {
    p.offense = false;
    if (!this.policy.solitary) return;
    const w = this.world;
    const busy = new Set();
    for (const q of this.people) {
      if (q.confined >= 0) busy.add(q.confined);
      if (q.carrying && q.carryTo !== undefined) busy.add(q.carryTo);
    }
    let room = null, bd = 1e9;
    for (const r of w.roomsOf('solitary')) {
      if (busy.has(r.key)) continue;
      const d = dist(r.cx, r.cy, p.x, p.y);
      if (d < bd) { bd = d; room = r; }
    }
    if (!room) return;
    const i = guard.randomTileIn(room);
    if (i < 0) return;
    guard.setPlan([guard.go(i), guard.act((g) => {
      const c = g.carrying;
      g.carrying = null; g.carryTo = undefined;
      if (!c || c.gone) return;
      c.carriedBy = null;
      c.place(i % MAP_W, (i / MAP_W) | 0);
      c.confined = room.key;
      c.solUntil = this.t + this.policy.solHours * HOUR_SEC;
      this.log(`${c.name} を懲罰房に入れた（${this.policy.solHours}時間）`, 'info', c.x, c.y);
    })]);
    guard.carrying = p; guard.carryTo = room.key; p.carriedBy = guard;
  }
  smashTarget(p, r) {
    const w = this.world;
    let best = -1, bd = r + 1;
    for (let y = p.ty - r; y <= p.ty + r; y++) for (let x = p.tx - r; x <= p.tx + r; x++) {
      if (!w.inb(x, y)) continue;
      const i = w.idx(x, y);
      const o = w.obj(i);
      if (!(o && o.hp > 0 && o.key !== 'tree') && !(w.door[i] && w.hp[i] > 0)) continue;
      const d = dist(x, y, p.tx, p.ty) + rnd();
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  smash(p, i) {
    const w = this.world;
    this.addHeat(p.x, p.y, 1.5);
    this.fx.push({ k: 'hit', x: (i % MAP_W) + 0.5, y: ((i / MAP_W) | 0) + 0.5, t: 0, life: 0.4 });
    if (w.door[i] && w.hp[i] > 0) {
      w.hp[i] = Math.max(0, w.hp[i] - Math.round(1500 / DOORS[w.door[i]].hp));
      if (w.hp[i] === 0) { this.log(`${p.name} が${DOORS[w.door[i]].name}を壊した`, 'bad', p.x, p.y); this.jobs.repairDoor(i); }
      return;
    }
    const o = w.obj(i);
    if (!o || o.hp <= 0) return;
    o.hp = Math.max(0, o.hp - 35);
    if (o.hp === 0) {
      this.log(`${p.name} が${o.def.name}を壊した`, 'warn', p.x, p.y);
      this.jobs.repairObj(o);
      w.roomsDirty = true;
    }
  }

  /* ------------------------------ 食事・作業・学習 ------------------------------ */
  mealWindow() {
    const h = this.hour();
    let start = -1;
    if (this.act(h) === 'eat') { start = h; while (this.act(start - 1) === 'eat' && start > h - 23) start--; }
    else if (this.act(h + 1) === 'eat') start = h + 1;
    if (start < 0) return -1;
    return this.day() * 24 + start;
  }
  mealNeed() {
    const id = this.mealWindow();
    if (id < 0) return 0;
    if (this.meal.id !== id) this.meal = { id, cooked: 0 };
    return this.prisonerCount() + 2 - this.meal.cooked;
  }
  cook(n, who) {
    if (this.mealNeed() <= 0) return;
    const mult = [0.8, 1, 1.3][this.policy.mealQty];
    this.kitchenFood += n;
    this.meal.cooked += n;
    this.spend(Math.round(n * FOOD_COST[this.policy.mealQual] * mult), 'food');
    if (who && who.kind === 'prisoner' && chance(0.006)) who.contra.push('blade');
  }
  fed(p) {
    p.needs.hunger = Math.max(0, p.needs.hunger - [55, 75, 95][this.policy.mealQty]);
    p.anger = Math.max(0, p.anger - [0, 1.5, 4][this.policy.mealQual]);
    if (this.policy.mealQual === 0) p.anger = Math.min(100, p.anger + 1.5);
    p.carry = null;
    this.stat.meals++;
    this.dirty(p.ti, 5);
  }
  madeGoods(p, o) {
    this.stat.goods++;
    this.earn(GOODS_PRICE, 'goods');
    this.fx.push({ k: 'money', x: o.x + o.w / 2, y: o.y, t: 0, life: 1.2, text: '+' + yen(GOODS_PRICE) });
    if (chance(p.traits.includes('clever') ? 0.03 : 0.012)) p.contra.push(chance(0.6) ? 'tool' : 'blade');
  }
  teacherIn(roomIdx) {
    for (const q of this.people) if (q.role === 'teacher' && this.world.roomAt[q.ti] === roomIdx) return true;
    return false;
  }
  study(p, dt) {
    p.study += 14 * dt / HOUR_SEC * (p.traits.includes('reader') ? 1.5 : 1);
    if (p.study >= 100 && !p.graduated) {
      p.graduated = true; p.anger = Math.max(0, p.anger - 15); p.task = null;
      this.stat.graduates++;
      this.log(`${p.name} が教育課程を修了した`, 'good', p.x, p.y);
    }
  }
  dirty(i, n) { const w = this.world; if (w.isIndoor(i)) w.dirt[i] = Math.min(255, w.dirt[i] + n); }
  onStep(p, i) {
    if (p.kind !== 'prisoner') return;
    const w = this.world;
    const r = w.roomAt[i];
    p.inHome = r >= 0 && w.rooms[r].key === p.home;
    if (rnd() < 0.035) this.dirty(i, 5);
    const o = w.obj(i);
    if (o && o.key === 'detector' && o.powered) this.detect(p, o);
  }
  detect(p, o) {
    const metal = p.contra.filter((c) => CONTRABAND[c].metal);
    if (!metal.length) return;
    p.contra = p.contra.filter((c) => !CONTRABAND[c].metal);
    p.anger = Math.min(100, p.anger + 10);
    this.stat.found += metal.length;
    p.say('🚨', 3);
    this.log(`金属探知機が ${p.name} の${metal.map((c) => CONTRABAND[c].name).join('・')}を見つけた`, 'good', o.x, o.y);
  }
  addHeat(x, y, v) { const k = (Math.floor(y) >> 2) * this.HW + (Math.floor(x) >> 2); if (k >= 0 && k < this.heat.length) this.heat[k] += v; }
  heatAt(x, y) { const k = (Math.floor(y) >> 2) * this.HW + (Math.floor(x) >> 2); return this.heat[k] || 0; }
  spark(x, y, c) { if (this.fx.length < 300) this.fx.push({ k: 'spark', x, y, t: 0, life: 0.4, c, vx: (rnd() - 0.5) * 2, vy: -rnd() * 2 }); }
  steam(o) { if (this.fx.length < 300) this.fx.push({ k: 'steam', x: o.x + 0.5, y: o.y + 0.4, t: 0, life: 1.4 }); }

  /* ------------------------------ 捜索・施錠・機動隊 ------------------------------ */
  shakedown() {
    const w = this.world;
    this.searchQueue = [];
    for (const r of w.rooms) if (r.valid && HOME_ROOMS.includes(r.type) && r.owners.length) this.searchQueue.push(r.key);
    if (!this.searchQueue.length) return false;
    for (const p of this.people) if (p.kind === 'prisoner') p.anger = Math.min(100, p.anger + 3);
    this.log(`一斉捜索を始めた（${this.searchQueue.length} 部屋）`);
    return true;
  }
  searchRoom(room, guard) {
    let found = 0, tunnel = false;
    for (const p of this.people) {
      if (p.kind !== 'prisoner' || p.gone) continue;
      const here = p.home === room.key || this.world.roomAt[p.ti] === room.idx;
      if (!here) continue;
      const cl = p.traits.includes('clever');
      const before = p.contra.length;
      p.contra = p.contra.filter(() => !chance(cl ? 0.45 : 0.75));
      found += before - p.contra.length;
      if (p.tunnel && p.home === room.key && chance(0.8)) {
        this.clearTunnel(p, true); tunnel = true; found++;
        this.log(`${p.name} の房の床下にトンネルが見つかった！ 埋め戻した`, 'good', guard.x, guard.y);
      }
      if (p.home === room.key) p.anger = Math.min(100, p.anger + 5);
    }
    this.stat.found += found;
    if (found && !tunnel) this.log(`${ROOMS[room.type].name}の捜索で隠し物を${found}つ見つけた`, 'good', guard.x, guard.y);
  }
  setLockdown(on) {
    this.world.lockdown = on;
    for (const p of this.people) if (p.kind === 'prisoner' && p.state === 'normal') p.endPlan();
    this.log(on ? '非常施錠。すべての扉を閉めた' : '非常施錠を解いた', on ? 'warn' : 'info');
  }
  policeCost() { return this.research.has('police') ? POLICE_COST / 2 : POLICE_COST; }
  callPolice() {
    const c = this.policeCost();
    if (!this.canAfford(c)) return false;
    if (this.vehicles.some((v) => v.type === 'police' && v.state !== 'out')) return false;
    this.spend(c, 'police');
    this.spawnVehicle('police');
    this.log('機動隊を呼んだ', 'warn');
    return true;
  }

  /* ------------------------------ 面会 ------------------------------ */
  requestVisit(p) {
    const w = this.world;
    if (p.visit || !w.countRooms('visit')) return false;
    for (const o of w.objects.values()) {
      if (o.key !== 'visitTable' || o.hp <= 0 || o.room < 0 || !w.rooms[o.room].valid || w.rooms[o.room].type !== 'visit') continue;
      const sp = w.spots(o);
      const half = sp.length / 2;
      for (let k = 0; k < half; k++) {
        const kb = k + half;
        if ((o.res[k] && this.byId.has(o.res[k])) || (o.res[kb] && this.byId.has(o.res[kb]))) continue;
        if (!w.spotUsable(o, sp[k]) || !w.spotUsable(o, sp[kb])) continue;
        const vis = new Person(this, 'visitor', 'visitor');
        vis.name = p.name.split(' ')[0] + ' の家族';
        const ex = this.exitTile();
        this.add(vis, ex % MAP_W, WALK_Y);
        const v = { p, vis, o, k, s: sp[k], kb, sb: sp[kb], done: false, talk: 0, t: 0 };
        p.visit = v; vis.visit = v;
        vis.reserve(o, kb);
        vis.setPlan([vis.go(sp[kb].i), vis.wait(undefined, 'sit', { face: sp[kb].face, until: (q) => v.done || q.st > 80 }),
          vis.act((q) => { v.done = true; q.planExit(); return true; })]);
        vis.res = { o, k: kb };
        p.endPlan();
        this.visits.push(v);
        return true;
      }
    }
    return false;
  }
  updateVisits(dt) {
    for (const v of this.visits) {
      v.t += dt;
      if (v.done) continue;
      if (v.p.gone || v.vis.gone || v.t > 110) { v.done = true; continue; }
      const at = (q, s) => dist(q.x, q.y, s.x + 0.5, s.y + 0.5) < 0.4 && q.plan[q.si] && q.plan[q.si].t === 'wait';
      if (at(v.p, v.s) && at(v.vis, v.sb)) {
        v.talk += dt;
        if (v.talk > 9) {
          v.done = true;
          this.stat.visits++;
          v.p.needs.family = Math.max(0, v.p.needs.family - 75);
          v.p.anger = Math.max(0, v.p.anger - 8);
          if (chance(v.p.traits.includes('smuggler') ? 0.3 : 0.07)) v.p.contra.push(pick(['phone', 'cards', 'cards', 'tool', 'blade']));
        }
      }
    }
    this.visits = this.visits.filter((v) => !v.done || v.t < 1);
  }
  maybeVisits() {
    if (!this.research.has('visits')) return;
    let n = 0;
    for (const p of this.people) {
      if (n >= 3) break;
      if (p.kind === 'prisoner' && p.state === 'normal' && p.needs.family > 55 && chance(0.4) && this.requestVisit(p)) n++;
    }
  }

  /* ------------------------------ 研究 ------------------------------ */
  startResearch(id) {
    const r = RESEARCH.find((x) => x.id === id);
    if (!r || this.research.has(id) || this.resActive[r.by]) return '研究中';
    if (r.req && r.req.some((q) => !this.research.has(q))) return '先に必要な研究がある';
    if (!this.staffCount(r.by)) return `${STAFF[r.by].name}がいない`;
    if (!this.canAfford(r.cost)) return 'お金が足りない';
    this.spend(r.cost, 'research');
    this.resActive[r.by] = id;
    this.resProg[id] = this.resProg[id] || 0;
    return '';
  }
  updateResearch(dt) {
    for (const by in this.resActive) {
      const id = this.resActive[by];
      const r = RESEARCH.find((x) => x.id === id);
      let working = false;
      for (const p of this.people) if (p.role === by && p.atDesk) working = true;
      if (!working) continue;
      this.resProg[id] = (this.resProg[id] || 0) + dt / (r.hours * HOUR_SEC);
      if (this.resProg[id] >= 1) {
        this.research.add(id);
        delete this.resActive[by];
        this.log(`研究「${r.name}」が終わった`, 'good');
        Toast.show(`研究完了：${r.name}`, 'good');
        if (id === 'loan') { this.earn(30000, 'loan'); this.loan = { left: 20, per: 1800 }; }
        this.world.roomsDirty = true;
      }
    }
  }

  checkGrants() {
    const ctx = { world: this.world, sim: this, stat: this.stat };
    for (const g of GRANTS) {
      if (this.grantsDone.has(g.id)) continue;
      if (g.check(ctx).done) {
        this.grantsDone.add(g.id);
        this.earn(g.reward, 'grant');
        this.log(`補助金「${g.name}」を受けとった（${yen(g.reward)}）`, 'good');
        Toast.show(`補助金 ${yen(g.reward)}：${g.name}`, 'good');
      }
    }
  }
  perimeterClosed() {
    if (this.t - this.perimCache.t < 5) return this.perimCache.v;
    const w = this.world;
    const st = this.stockTile();
    const gen = w.reachMap(st % MAP_W, (st / MAP_W) | 0, null);
    const home = w.rooms.find((r) => r.valid && HOME_ROOMS.includes(r.type) && r.doors.length && r.tiles.some((i) => w.rch[i] === gen));
    let v = null;
    if (home) {
      const probe = { kind: 'prisoner', escort: false, confined: -1, homeDoors: null, inHome: false, rioting: false };
      const jl = w.jailLocked, ld = w.lockdown;
      w.jailLocked = false; w.lockdown = false;
      const s = home.tiles.find((i) => w.canWalk(i, probe, false));
      v = s === undefined ? true : !w.search(s % MAP_W, (s / MAP_W) | 0, probe, outsidePred(w), 40000);
      w.jailLocked = jl; w.lockdown = ld;
    }
    this.perimCache = { t: this.t, v };
    return v;
  }

  /* ------------------------------ 車 ------------------------------ */
  spawnVehicle(type, data = {}) {
    const len = { bus: 4.2, truck: 3.4, police: 2.8, ambulance: 2.8 }[type];
    const v = Object.assign({ type, len, x: -len - 1 - rnd() * 3, y: ROAD_Y + 1.5, speed: 7, state: 'in', t: 0, wait: type === 'bus' ? 5 : 3 }, data);
    v.stop = type === 'ambulance' ? MAP_W * 0.5 + 6 : this.stopX() + len / 2;
    this.vehicles.push(v);
    return v;
  }
  updateVehicles(dt) {
    for (const v of this.vehicles) {
      if (v.state === 'in') {
        const rem = v.stop - v.x;
        const sp = Math.max(1.2, Math.min(v.speed, rem * 1.6));
        v.x += sp * dt;
        if (rem <= 0.05) { v.x = v.stop; v.state = 'stop'; v.t = 0; this.arrive(v); }
      } else if (v.state === 'stop') {
        v.t += dt;
        if (v.t > v.wait) v.state = 'out';
      } else {
        v.speed = Math.min(9, v.speed + dt * 4);
        v.x += v.speed * dt;
      }
    }
    this.vehicles = this.vehicles.filter((v) => v.x < MAP_W + 8);
  }
  arrive(v) {
    const sx = Math.floor(v.x - v.len / 2);
    if (v.type === 'bus') {
      const list = [];
      for (const sec of v.cargo) {
        const p = this.makePrisoner(sec);
        this.add(p, clamp(sx + rint(-2, 2), 1, MAP_W - 2), WALK_Y);
        list.push(p);
      }
      this.stat.arrived += list.length;
      const c = [0, 0, 0]; for (const p of list) c[p.sec]++;
      const txt = c.map((n, s) => n ? `${SEC[s].short}${n}` : '').filter(Boolean).join('・');
      this.log(`護送車が囚人 ${list.length} 人を連れてきた（${txt}）`, 'info', sx, WALK_Y);
    } else if (v.type === 'police') {
      for (let k = 0; k < 6; k++) {
        const p = new Person(this, 'police', 'police');
        p.name = '機動隊員';
        this.add(p, clamp(sx + rint(-2, 2), 1, MAP_W - 2), WALK_Y);
      }
    }
  }

  /* ------------------------------ セーブ ------------------------------ */
  serialize(seed) {
    const w = this.world;
    const tun = [];
    for (let i = 0; i < w.n; i++) if (w.tunnel[i]) tun.push(i, w.tunnel[i]);
    const ps = this.people.filter((p) => p.kind === 'prisoner' || p.kind === 'staff').map((p) => {
      const o = { id: p.id, kind: p.kind, role: p.role, name: p.name, x: +p.x.toFixed(2), y: +p.y.toFixed(2), hp: Math.round(p.hp), look: p.look, leaving: p.leaving };
      if (p.kind === 'prisoner') {
        Object.assign(o, {
          sec: p.sec, crime: p.crime, sentence: p.sentence, served: p.served, traits: p.traits, needs: p.needs,
          anger: p.anger, home: p.home, state: ['fight', 'escape'].includes(p.state) ? 'normal' : p.state,
          contra: p.contra, study: p.study, graduated: p.graduated, confined: p.confined, solUntil: p.solUntil,
          tunnel: p.tunnel, arrivedT: p.arrivedT, escort: p.escort, task: p.task, koUntil: p.koUntil, rioting: p.rioting,
        });
      }
      return o;
    });
    return {
      v: 1, seed, t: this.t, money: this.money, ledger: this.ledger, lastLedger: this.lastLedger, history: this.history,
      policy: this.policy, sched: this.sched, research: [...this.research], resActive: this.resActive, resProg: this.resProg,
      grants: [...this.grantsDone], stat: Object.fromEntries(Object.entries(this.stat).filter(([, v]) => typeof v === 'number')),
      laundry: this.laundry, negDays: this.negDays, loan: this.loan, nextId: this.nextId, lockdown: w.lockdown,
      world: {
        floor: packU8(w.floor), wall: packU8(w.wall), door: packU8(w.door), hp: packU8(w.hp), zone: packU8(w.zone),
        dirt: packU8(w.dirt), ground: packU8(w.ground), patrol: w.patrol, tunnel: tun,
        objects: [...w.objects.values()].map((o) => [o.id, o.key, o.x, o.y, o.rot, o.hp]),
      },
      jobs: this.jobs.list.map((j) => ({ kind: j.kind, i: j.i, v: j.v, key: j.key, rot: j.rot, oid: j.oid, cost: j.cost, prog: j.prog })),
      people: ps,
    };
  }
  static load(d) {
    const w = new World();
    unpackU8(d.world.ground, w.ground); unpackU8(d.world.floor, w.floor); unpackU8(d.world.wall, w.wall);
    unpackU8(d.world.door, w.door); unpackU8(d.world.hp, w.hp); unpackU8(d.world.zone, w.zone); unpackU8(d.world.dirt, w.dirt);
    w.patrol = d.world.patrol || [];
    for (let k = 0; k < d.world.tunnel.length; k += 2) w.tunnel[d.world.tunnel[k]] = d.world.tunnel[k + 1];
    for (const [id, key, x, y, rot, hp] of d.world.objects) { const o = w.addObject(key, x, y, rot, id); o.hp = hp; }
    w.lockdown = !!d.lockdown;
    const s = new Sim(w);
    Object.assign(s, {
      t: d.t, money: d.money, ledger: d.ledger, lastLedger: d.lastLedger, history: d.history || [],
      policy: Object.assign(s.policy, d.policy), sched: d.sched, research: new Set(d.research), resActive: d.resActive || {},
      resProg: d.resProg || {}, grantsDone: new Set(d.grants), laundry: d.laundry, negDays: d.negDays, loan: d.loan, nextId: d.nextId,
    });
    Object.assign(s.stat, d.stat);
    s.lastHour = s.hour(); s.lastDay = s.day();
    w.jailLocked = s.act() === 'sleep' || s.act() === 'lock';
    for (const j of d.jobs) s.jobs.restore(j);
    for (const q of d.people) {
      const p = new Person(s, q.kind, q.role);
      p.id = q.id; Object.assign(p, q);
      p.x = q.x; p.y = q.y;
      if (p.kind === 'prisoner') {
        p.visit = null; p.offense = false; p.noticed = false; p.foe = null;
        if (p.state === 'riot' && !p.rioting) p.state = 'normal';
      }
      s.people.push(p); s.byId.set(p.id, p);
    }
    s.nextId = Math.max(d.nextId, ...s.people.map((p) => p.id + 1), 1);
    return s;
  }
}

/* =========================================================================
   建築の仕事。設計図を置くとここに積まれ、作業員が1つずつ片づける。
   ========================================================================= */
const JOB_PRIO = { repair: 0, floor: 1, rmFloor: 1, wall: 2, rmWall: 2, rmObj: 2, door: 3, obj: 4 };

class Jobs {
  constructor(sim) { this.sim = sim; this.list = []; this.at = new Map(); this.nextId = 1; }
  count() { return this.list.length; }
  crateJobs() { let n = 0; for (const j of this.list) if (this.needsCrate(j)) n++; return n; }
  get world() { return this.sim.world; }
  jobsAt(i) { return this.at.get(i) || []; }
  find(i, kind) { const a = this.at.get(i); return a ? a.find((j) => j.kind === kind) : undefined; }
  reserved(i) { const a = this.at.get(i); return !!(a && a.some((j) => j.kind === 'obj' || j.kind === 'wall' || j.kind === 'door')); }
  needsCrate(j) { return j.kind === 'floor' || j.kind === 'wall' || j.kind === 'door' || j.kind === 'obj'; }
  workTime(j) {
    let t;
    switch (j.kind) {
      case 'floor': t = 0.9; break;
      case 'wall': t = [0, 2, 2.8, 1.2][j.v]; break;
      case 'door': t = 3; break;
      case 'obj': t = 2 + OBJECTS[j.key].w * OBJECTS[j.key].h * 0.6; break;
      case 'rmWall': t = 1.8; break;
      case 'rmObj': t = 1.5; break;
      case 'rmFloor': t = 0.6; break;
      default: t = 3.5;
    }
    return t * (this.sim.research.has('maint') ? 0.7 : 1);
  }

  add(j) {
    j.id = this.nextId++;
    j.prog = j.prog || 0; j.w = 0; j.blockT = 0; j.dead = false;
    j.x = j.i % MAP_W; j.y = (j.i / MAP_W) | 0;
    j.tiles = j.tiles || [j.i];
    j.stand = j.kind === 'floor' || j.kind === 'rmFloor';
    this.list.push(j);
    for (const t of j.tiles) { let a = this.at.get(t); if (!a) this.at.set(t, a = []); a.push(j); }
    return j;
  }
  drop(j) {
    j.dead = true;
    const k = this.list.indexOf(j);
    if (k >= 0) this.list.splice(k, 1);
    for (const t of j.tiles) {
      const a = this.at.get(t);
      if (!a) continue;
      const q = a.indexOf(j);
      if (q >= 0) a.splice(q, 1);
      if (!a.length) this.at.delete(t);
    }
  }
  cancel(j) {
    if (j.cost) this.sim.spend(-j.cost, 'build');
    this.drop(j);
    return j.cost || 0;
  }
  restore(d) {
    if (d.kind === 'obj') {
      const [w, h] = this.world.footprint(d.key, d.rot);
      const tiles = [];
      const x = d.i % MAP_W, y = (d.i / MAP_W) | 0;
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) tiles.push(this.world.idx(x + dx, y + dy));
      d.tiles = tiles;
    }
    this.add(Object.assign({}, d));
  }

  /* 設計図を置く。dry なら費用だけ返す。置けなければ -1 */
  planFloor(i, v, dry) {
    const w = this.world;
    if (!w.buildable(i)) return -1;
    const cur = this.find(i, 'floor');
    if (w.floor[i] === v && !cur && !this.find(i, 'rmFloor')) return 0;
    if (cur && cur.v === v) return 0;
    if (dry) return FLOORS[v].cost;
    if (cur) this.cancel(cur);
    const rm = this.find(i, 'rmFloor'); if (rm) this.drop(rm);
    this.add({ kind: 'floor', i, v, cost: FLOORS[v].cost });
    return FLOORS[v].cost;
  }
  planWall(i, v, dry) {
    const w = this.world;
    if (!w.buildable(i)) return -1;
    const x = i % MAP_W;
    if (x === 0 || x === MAP_W - 1 || i < MAP_W) return -1;
    const cur = this.find(i, 'wall');
    if (cur && cur.v === v) return 0;
    if (w.wall[i] === v && !this.find(i, 'rmWall')) return 0;
    if ((w.objAt[i] >= 0 && !this.find(i, 'rmObj')) || this.find(i, 'obj')) return -1;
    if (dry) return WALLS[v].cost;
    if (cur) this.cancel(cur);
    const d = this.find(i, 'door'); if (d) this.cancel(d);
    const rm = this.find(i, 'rmWall'); if (rm) this.drop(rm);
    this.add({ kind: 'wall', i, v, cost: WALLS[v].cost });
    return WALLS[v].cost;
  }
  planDoor(i, v, dry) {
    const w = this.world;
    if (!w.buildable(i)) return -1;
    const cur = this.find(i, 'door');
    if (cur && cur.v === v) return 0;
    if (w.door[i] === v && !this.find(i, 'rmWall')) return 0;
    if ((w.objAt[i] >= 0 && !this.find(i, 'rmObj')) || this.find(i, 'obj')) return -1;
    if (dry) return DOORS[v].cost;
    if (cur) this.cancel(cur);
    const wl = this.find(i, 'wall'); if (wl) this.cancel(wl);
    const rm = this.find(i, 'rmWall'); if (rm) this.drop(rm);
    this.add({ kind: 'door', i, v, cost: DOORS[v].cost });
    return DOORS[v].cost;
  }
  planObj(key, x, y, rot, dry) {
    const w = this.world;
    if (w.canPlace(key, x, y, rot)) return -1;
    const cost = OBJECTS[key].cost;
    if (dry) return cost;
    const [fw, fh] = w.footprint(key, rot);
    const tiles = [];
    for (let dy = 0; dy < fh; dy++) for (let dx = 0; dx < fw; dx++) tiles.push(w.idx(x + dx, y + dy));
    this.add({ kind: 'obj', i: w.idx(x, y), key, rot, cost, tiles });
    return cost;
  }
  /* 撤去。取り消した設計図の代金は全額、建っている物は半額もどる */
  planRemove(i, dry) {
    const w = this.world;
    let refund = 0;
    for (const j of this.jobsAt(i).slice()) {
      if (j.kind === 'rmWall' || j.kind === 'rmObj' || j.kind === 'rmFloor') continue;
      refund += j.cost || 0;
      if (!dry) this.cancel(j);
    }
    let did = refund > 0;
    if ((w.wall[i] || w.door[i]) && !this.find(i, 'rmWall')) { did = true; if (!dry) this.add({ kind: 'rmWall', i }); }
    const o = w.obj(i);
    if (o && !this.list.some((j) => j.kind === 'rmObj' && j.oid === o.id)) {
      did = true;
      if (!dry) {
        const tiles = [];
        for (let dy = 0; dy < o.h; dy++) for (let dx = 0; dx < o.w; dx++) tiles.push(w.idx(o.x + dx, o.y + dy));
        this.add({ kind: 'rmObj', i: w.idx(o.x, o.y), oid: o.id, tiles });
      }
    }
    return did ? -refund : 0;
  }
  planRemoveFloor(i, dry) {
    const w = this.world;
    const cur = this.find(i, 'floor');
    let refund = 0;
    if (cur) { refund = cur.cost; if (!dry) this.cancel(cur); }
    if (w.floor[i] && !this.find(i, 'rmFloor')) { if (!dry) this.add({ kind: 'rmFloor', i }); return -refund || 0; }
    return refund ? -refund : 0;
  }
  repairObj(o) {
    if (this.list.some((j) => j.kind === 'repair' && j.oid === o.id)) return;
    this.add({ kind: 'repair', i: this.world.idx(o.x, o.y), oid: o.id });
  }
  repairDoor(i) {
    if (this.list.some((j) => j.kind === 'repair' && j.i === i && !j.oid)) return;
    this.add({ kind: 'repair', i });
  }

  take(p) {
    const s = this.sim, w = this.world;
    let best = null, bs = 1e9;
    const gen = w.reachMap(p.tx, p.ty, p);
    p.reachGen = gen;
    for (const j of this.list) {
      if (j.w) {
        const q = s.byId.get(j.w);
        if (q && q.job === j) continue;
        j.w = 0;
      }
      if (j.blockT > s.t) continue;
      if (!w.nearReachable(j.i, gen)) continue;
      const sc = JOB_PRIO[j.kind] * 10 + dist(p.x, p.y, j.x, j.y);
      if (sc < bs) { bs = sc; best = j; }
    }
    if (best) best.w = p.id;
    return best;
  }
  takeNear(p, prev) {
    let best = null, bd = 7;
    const w = this.world;
    const gen = w.reachMap(p.tx, p.ty, p);
    for (const j of this.list) {
      if (j.w || !this.needsCrate(j) || j.kind === 'obj' || j.blockT > this.sim.t) continue;
      if (!w.nearReachable(j.i, gen)) continue;
      const d = dist(prev.x, prev.y, j.x, j.y);
      if (d < bd) { bd = d; best = j; }
    }
    if (best) best.w = p.id;
    return best;
  }
  unassign(j, p) {
    if (j.w === p.id) { j.w = 0; if (!j.dead) j.blockT = this.sim.t + 12; }
  }

  complete(j) {
    const w = this.world, s = this.sim;
    const i = j.i;
    this.drop(j);
    switch (j.kind) {
      case 'floor': w.floor[i] = j.v; break;
      case 'wall': w.wall[i] = j.v; w.door[i] = 0; w.hp[i] = 100; this.pushOut(i); break;
      case 'door': w.wall[i] = 0; w.door[i] = j.v; w.hp[i] = 100; break;
      case 'obj': {
        const x = i % MAP_W, y = (i / MAP_W) | 0;
        if (w.canPlace(j.key, x, y, j.rot) === '') {
          const o = w.addObject(j.key, x, y, j.rot);
          if (o.def.solid) for (let dy = 0; dy < o.h; dy++) for (let dx = 0; dx < o.w; dx++) this.pushOut(w.idx(x + dx, y + dy));
        } else s.spend(-j.cost, 'build');
        break;
      }
      case 'rmWall': {
        const c = w.wall[i] ? WALLS[w.wall[i]].cost : w.door[i] ? DOORS[w.door[i]].cost : 0;
        if (c) s.earn(Math.round(c / 2), 'refund');
        w.wall[i] = 0; w.door[i] = 0; w.hp[i] = 0;
        break;
      }
      case 'rmObj': {
        const o = w.objects.get(j.oid);
        if (o) { s.earn(Math.round(o.def.cost / 2), 'refund'); w.removeObject(o.id); }
        break;
      }
      case 'rmFloor': w.floor[i] = 0; break;
      case 'repair': {
        if (j.oid) { const o = w.objects.get(j.oid); if (o) o.hp = 100; }
        else if (w.door[i]) w.hp[i] = 100;
        break;
      }
    }
    w.roomsDirty = true;
    s.renderDirty = true;
  }
  /* 壁や設備ができたマスに立っていた人をどかす */
  pushOut(i) {
    const w = this.world;
    for (const p of this.sim.people) {
      if (p.ti !== i || p.carriedBy) continue;
      for (const [dx, dy] of DIRS8) {
        const nx = p.tx + dx, ny = p.ty + dy;
        if (w.inb(nx, ny) && w.canWalk(w.idx(nx, ny), null, false)) { p.place(nx, ny); p.path = null; break; }
      }
    }
  }
}
