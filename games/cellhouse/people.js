/* =========================================================================
   CELLHOUSE ― 人
   歩く / 予定をこなす / 囚人と職員それぞれの考え
   予定 (plan) は小さな手順の列。go=歩く / wait=その場で何かする / do=一瞬の処理
   ========================================================================= */
'use strict';

const SPEED = { prisoner: 2.1, staff: 2.7, police: 3.1, visitor: 2.2 };

class Person {
  constructor(sim, kind, role) {
    this.sim = sim;
    this.id = sim.nextId++;
    this.kind = kind;
    this.role = role || kind;
    this.x = 0; this.y = 0; this.face = Math.PI / 2;
    this.walkT = 0; this.moving = false;
    this.path = null; this.pi = 0;
    this.plan = []; this.si = 0; this.st = 0;
    this.pose = 'stand';
    this.hp = 100;
    this.carry = null;          /* 手に持っている物 (crate / tray / mop) */
    this.carrying = null;       /* 運んでいる人 */
    this.carriedBy = null;
    this.res = null;            /* 予約している設備の席 */
    this.job = null;
    this.cool = rnd();
    this.scanT = rnd();
    this.bubble = null; this.bubbleT = 0;
    this.hitT = 0; this.atkT = 0; this.chaseT = 0;
    this.mode = null; this.target = null; this.foe = null;
    this.koUntil = 0;
    this.confined = -1; this.escort = false; this.homeDoors = null; this.inHome = false; this.rioting = false;
    this.gone = false; this.leaving = false; this.atDesk = false;
    this.speed = SPEED[kind];
    this.look = { skin: pick(SKIN), hair: pick(HAIR), style: rint(0, 3), size: 0.92 + rnd() * 0.16 };
  }
  get tx() { return Math.floor(this.x); }
  get ty() { return Math.floor(this.y); }
  get ti() { return this.ty * MAP_W + this.tx; }
  place(x, y) { this.x = x + 0.5; this.y = y + 0.5; }
  say(b, t = 2.5) { this.bubble = b; this.bubbleT = t; }
  get world() { return this.sim.world; }

  /* ------------------------------ 毎フレーム ------------------------------ */
  update(dt) {
    if (this.bubbleT > 0 && (this.bubbleT -= dt) <= 0) this.bubble = null;
    if (this.hitT > 0) this.hitT -= dt;
    if (this.atkT > 0) this.atkT -= dt;
    if (this.carriedBy) {
      const c = this.carriedBy;
      if (c.gone || c.carrying !== this) this.carriedBy = null;
      else {
        this.x = c.x - Math.cos(c.face) * 0.42; this.y = c.y - Math.sin(c.face) * 0.42;
        this.face = c.face; this.pose = 'lie'; this.moving = false;
        return;
      }
    }
    if (this.kind === 'prisoner') { if (this.updateState(dt)) return; }
    else if (this.updateMode(dt)) return;
    if (this.cool > 0) { this.cool -= dt; this.moving = false; return; }
    if (!this.plan.length) {
      this.decide();
      if (!this.plan.length) { this.cool = 0.6 + rnd(); this.moving = false; return; }
    }
    this.runPlan(dt);
  }

  /* ------------------------------ 予定 ------------------------------ */
  setPlan(steps) { this.endPlan(); this.plan = steps; this.si = 0; this.st = 0; }
  runPlan(dt) {
    const st = this.plan[this.si];
    if (!st) { this.endPlan(); return; }
    if (st.t === 'go') {
      const r = this.moveStep(st, dt);
      if (r === 1) this.nextStep();
      else if (r === -1) this.abort();
    } else if (st.t === 'wait') {
      this.moving = false;
      this.pose = st.pose || 'stand';
      if (st.face !== undefined) this.face = st.face;
      this.st += dt;
      if (st.tick && st.tick(this, dt) === false) { this.abort(); return; }
      if ((st.d !== undefined && this.st >= st.d) || (st.until && st.until(this))) this.nextStep();
    } else if (st.t === 'do') {
      const ok = st.f(this);
      if (ok === false) this.abort(); else this.nextStep();
    }
  }
  nextStep() {
    this.si++; this.st = 0; this.path = null; this.pose = 'stand';
    if (this.si >= this.plan.length) this.endPlan();
  }
  endPlan() {
    this.release();
    if (this.carrying) this.dropCarried();
    if (this.job) { this.sim.jobs.unassign(this.job, this); this.job = null; }
    this.plan = []; this.si = 0; this.st = 0; this.path = null;
    this.pose = 'stand'; this.atDesk = false; this.vandal = false;
    if (this.carry === 'crate' || this.carry === 'mop') this.carry = null;
  }
  abort() { this.endPlan(); this.cool = 0.8 + rnd() * 1.5; }

  go(i, opt) { return Object.assign({ t: 'go', i }, opt); }
  wait(d, pose, extra) { return Object.assign({ t: 'wait', d, pose }, extra); }
  act(f) { return { t: 'do', f }; }

  reserve(o, k) {
    this.release();
    this.world.spots(o);
    o.res[k] = this.id;
    this.res = { o, k };
  }
  release() {
    if (!this.res) return;
    const { o, k } = this.res;
    if (o.res && o.res[k] === this.id) o.res[k] = 0;
    this.res = null;
  }

  /* ------------------------------ 歩く ------------------------------ */
  /* 1=着いた / 0=歩いている / -1=行けない */
  moveStep(st, dt) {
    const w = this.world;
    if (!this.path) {
      if (this.sim.pathBudget <= 0) { this.moving = false; return 0; }
      this.sim.pathBudget--;
      let path = null;
      if (st.pred) {
        const r = w.search(this.tx, this.ty, this, st.pred, st.max || 6000);
        path = r && r.path;
      } else {
        const gx = st.i % MAP_W, gy = (st.i / MAP_W) | 0;
        if (st.near) {
          if (Math.max(Math.abs(gx - this.tx), Math.abs(gy - this.ty)) <= 1 && this.ti !== st.i && w.canWalk(this.ti, this, false)) return 1;
          path = w.findPath(this.tx, this.ty, gx, gy, this, 9000, true);
        } else {
          path = w.findPath(this.tx, this.ty, gx, gy, this);
        }
      }
      if (!path) return -1;
      this.path = path; this.pi = 0;
    }
    const r = this.follow(dt, st.run ? 1.5 : 1);
    if (r === -1) {
      this.path = null;
      st.blk = (st.blk || 0) + 1;
      return st.blk > 4 ? -1 : 0;
    }
    return r;
  }
  follow(dt, mul) {
    const w = this.world;
    if (this.pi >= this.path.length) { this.moving = false; return 1; }
    const n = this.path[this.pi];
    if (!w.canWalk(n, this, this.pi === this.path.length - 1)) { this.moving = false; return -1; }
    if (w.door[n]) this.sim.touchDoor(n);
    const nx = (n % MAP_W) + 0.5, ny = ((n / MAP_W) | 0) + 0.5;
    const dx = nx - this.x, dy = ny - this.y;
    const d = Math.hypot(dx, dy);
    const sp = this.speed * mul * (this.hp < 40 ? 0.6 : 1) * (this.carrying ? 0.7 : 1);
    const step = sp * dt;
    if (d > 0.001) this.face = Math.atan2(dy, dx);
    this.moving = true;
    this.walkT += step;
    if (d <= step) {
      this.x = nx; this.y = ny; this.pi++;
      this.sim.onStep(this, n);
    } else {
      this.x += (dx / d) * step; this.y += (dy / d) * step;
    }
    return this.pi >= this.path.length ? 1 : 0;
  }
  /* 動く相手を追いかける (ケンカ・取り押さえ) */
  chase(f, dt) {
    const w = this.world;
    this.chaseT -= dt;
    if (!this.path || this.chaseT <= 0 || this.pi >= this.path.length) {
      this.chaseT = 0.6 + rnd() * 0.3;
      if (this.sim.pathBudget > 0) {
        this.sim.pathBudget--;
        this.path = w.findPath(this.tx, this.ty, f.tx, f.ty, this, 4000);
        this.pi = 0;
      }
    }
    if (this.path && this.pi < this.path.length) {
      if (this.follow(dt, 1.35) === -1) this.path = null;
    } else if (dist(this.x, this.y, f.x, f.y) < 2.2) {
      const d = dist(this.x, this.y, f.x, f.y), step = this.speed * dt;
      this.face = Math.atan2(f.y - this.y, f.x - this.x);
      const nx = this.x + ((f.x - this.x) / d) * step, ny = this.y + ((f.y - this.y) / d) * step;
      if (w.canWalk(Math.floor(ny) * MAP_W + Math.floor(nx), this, true)) { this.x = nx; this.y = ny; this.moving = true; }
    } else this.moving = false;
  }
  /* 近づいて殴る。当たる距離なら true */
  engage(f, dt) {
    const d = dist(this.x, this.y, f.x, f.y);
    if (d > 1.1) { this.pose = 'stand'; this.chase(f, dt); return false; }
    this.moving = false;
    this.face = Math.atan2(f.y - this.y, f.x - this.x);
    this.pose = 'fight';
    if (this.atkT <= 0) { this.atkT = 0.75 + rnd() * 0.45; this.sim.strike(this, f); }
    return true;
  }

  /* いまの場所から歩いて行けるマスの印。ほかの人が上書きしたら作り直す */
  reach() {
    const w = this.world;
    if (this._rg !== w.rgen || this._ri !== this.ti || this._rt !== this.sim.t) {
      this._rg = w.reachMap(this.tx, this.ty, this);
      this._ri = this.ti; this._rt = this.sim.t;
    }
    return this._rg;
  }
  canReach(i) { const g = this.reach(); return this.world.rch[i] === g; }
  randomTileNear(r, filter) {
    const w = this.world;
    for (let k = 0; k < 12; k++) {
      const x = this.tx + rint(-r, r), y = this.ty + rint(-r, r);
      if (!w.inb(x, y) || w.isOutside(x, y)) continue;
      const i = w.idx(x, y);
      if (!w.canWalk(i, this, false) || !this.canReach(i)) continue;
      if (filter && !filter(i)) continue;
      return i;
    }
    return -1;
  }
  randomTileIn(room) {
    const w = this.world;
    for (let k = 0; k < 14; k++) {
      const i = pick(room.tiles);
      if (w.canWalk(i, this, false) && this.canReach(i)) return i;
    }
    return -1;
  }
  planWander(r, filter) {
    const i = this.randomTileNear(r, filter);
    if (i < 0) { this.plan = [this.wait(2 + rnd() * 2, 'stand')]; return; }
    this.setPlan([this.go(i), this.wait(2 + rnd() * 4, 'stand')]);
  }

  /* 空いている席を探す。keys: 設備の種類 / types: 部屋の種類 / room: 部屋の key / side: f か b */
  findSpot(keys, opt = {}) {
    const w = this.world, s = this.sim;
    let best = null, bd = 1e9;
    const gen = this.reach();
    for (const o of w.objects.values()) {
      if (!keys.includes(o.key) || o.hp <= 0) continue;
      if (opt.types || opt.room !== undefined) {
        if (o.room < 0) continue;
        const r = w.rooms[o.room];
        if (!r || !r.valid) continue;
        if (opt.room !== undefined && r.key !== opt.room) continue;
        if (opt.types && !opt.types.includes(r.type)) continue;
      }
      if (opt.powered && o.def.power && !o.powered) continue;
      if (opt.filter && !opt.filter(o)) continue;
      const sp = w.spots(o);
      for (let k = 0; k < sp.length; k++) {
        if (opt.side && sp[k].side !== opt.side) continue;
        const r = o.res[k];
        if (r && r !== this.id) {
          const holder = s.byId.get(r);
          if (holder && holder.res && holder.res.o === o && holder.res.k === k) continue;
          o.res[k] = 0;
        }
        if (!w.spotUsable(o, sp[k])) continue;
        if (sp[k].on ? !w.nearReachable(sp[k].i, gen) : w.rch[sp[k].i] !== gen) continue;
        const d = dist(this.x, this.y, sp[k].x + 0.5, sp[k].y + 0.5) + rnd() * 2;
        if (d < bd) { bd = d; best = { o, k, s: sp[k] }; }
      }
    }
    if (best && opt.maxDist && bd > opt.maxDist) return null;
    return best;
  }
  /* 席まで行ってそこで何かする */
  useSteps(f, d, pose, extra = {}) {
    this.reserve(f.o, f.k);
    return [this.go(f.s.i), this.wait(d, pose, Object.assign({ face: f.s.face }, extra))];
  }

  /* 壁で閉じこめられた職員は、しばらくすると搬入口へもどる */
  rescueIfTrapped() {
    const st = this.sim.stockTile();
    if (this.world.nearReachable(st, this.reach())) { this.trappedT = 0; return false; }
    this.trappedT = (this.trappedT || 0) + 1;
    if (this.trappedT < 4) return false;
    this.trappedT = 0;
    this.endPlan();
    this.place(st % MAP_W, ((st / MAP_W) | 0));
    this.say('💨', 2);
    return true;
  }

  decide() {
    if (this.kind === 'prisoner') return this.decidePrisoner();
    if ((this.kind === 'staff' || this.kind === 'police') && this.rescueIfTrapped()) return;
    if (this.leaving) return this.planExit();
    switch (this.role) {
      case 'worker': return this.decideWorker();
      case 'guard': return this.decideGuard();
      case 'cook': return this.decideCook();
      case 'doctor': return this.decideDoctor();
      case 'janitor': return this.decideJanitor();
      case 'teacher': return this.decideTeacher();
      case 'police': return this.decidePolice();
      case 'visitor': return this.planExit();
      default: return this.decideDesk();
    }
  }

  planExit() {
    const i = this.sim.exitTile();
    this.setPlan([this.go(i), this.act((p) => { p.sim.remove(p); })]);
  }

  /* =========================================================================
     囚人
     ========================================================================= */
  updateState(dt) {
    const s = this.sim;
    if (this.state === 'ko') {
      this.pose = 'lie'; this.moving = false;
      if (s.t >= this.koUntil && !this.carriedBy) {
        this.state = this.confined >= 0 ? 'solitary' : 'normal';
        this.pose = 'stand';
        this.hp = Math.max(this.hp, 30);
      }
      return true;
    }
    if (this.state === 'fight' || (this.state === 'riot' && this.foe)) {
      const f = this.foe;
      this.fightT += dt;
      const over = !f || f.gone || f.carriedBy || f.mode === 'ko' || f.state === 'ko' ||
        (f.kind === 'prisoner' && f.state !== 'fight' && f.state !== 'riot') ||
        this.fightT > 24 || dist(this.x, this.y, f.x, f.y) > 14;
      if (over) {
        this.foe = null;
        if (this.state === 'fight') { this.state = 'normal'; this.anger = Math.max(0, this.anger - 15); }
        return false;
      }
      this.endPlanKeep();
      this.engage(f, dt);
      return true;
    }
    return false;
  }
  /* 手順は捨てるが、立ち止まらずに次の処理へ */
  endPlanKeep() { if (this.plan.length) this.endPlan(); }

  homeRoom() {
    if (this.home === undefined || this.home < 0) return null;
    const r = this.world.roomByKey.get(this.home);
    return r && r.valid && HOME_ROOMS.includes(r.type) ? r : null;
  }

  decidePrisoner() {
    const s = this.sim, w = this.world;
    switch (this.state) {
      case 'arrive': return this.planArrive();
      case 'release': return this.planExit();
      case 'solitary': return this.planSolitary();
      case 'escape': return this.planEscape();
      case 'riot': return this.planRiot();
    }
    if (this.visit) return this.planVisit();
    if (this.hp < 45 && this.planInfirmary()) return;
    if (this.needs.bladder > 75 && !(this.noToilet > s.t)) {
      if (this.planToilet()) return;
      this.noToilet = s.t + HOUR_SEC;
    }
    const act = w.lockdown ? 'lock' : s.act();
    if (act === 'sleep') { if (this.planSleep()) return; }
    else if (act === 'lock') { if (this.planStayHome()) return; }
    else if (act === 'eat') { if (this.planEat()) return; }
    else if (act === 'shower') { if (this.needs.hygiene > 12 && this.planShower()) return; }
    else if (act === 'yard') { if (this.planYard()) return; }
    else if (act === 'work') { if (this.planJob()) return; }
    if (act === 'sleep' || act === 'lock') {
      if (act === 'sleep') { this.setPlan([this.wait(8, 'lie', { tick: (p, dt) => { p.needs.sleep -= 10 * dt / HOUR_SEC; } })]); return; }
      this.planWander(2); return;
    }
    this.planFree();
  }

  planArrive() {
    const s = this.sim;
    const home = s.assignHome(this);
    if (home) {
      const i = this.randomTileIn(home);
      if (i >= 0) {
        this.waiting = false;
        this.setPlan([this.go(i), this.act((p) => { p.state = 'normal'; p.escort = false; p.inHome = true; })]);
        return;
      }
    }
    /* 房がない・房まで歩いて行けないときは、護送されたまま搬入口で待つ */
    this.waiting = true;
    this.setPlan([this.go(s.stockTile(), { near: true }), this.wait(5, 'stand')]);
  }

  planSleep() {
    const home = this.homeRoom();
    const tick = (rate) => (p, dt) => { p.needs.sleep -= rate * dt / HOUR_SEC; if (p.needs.bladder > 92 && !(p.noToilet > p.sim.t)) return false; };
    const until = (p) => p.sim.act() !== 'sleep';
    if (!home) return false;
    if (home.type !== 'holding') {
      const f = this.findSpot(['bed'], { room: home.key });
      if (f) { this.setPlan(this.useSteps(f, undefined, 'lie', { tick: tick(22), until })); return true; }
    }
    const i = this.inHome ? this.randomTileNear(2, (t) => this.world.roomAt[t] === home.idx) : this.randomTileIn(home);
    if (i < 0) return false;
    this.setPlan([this.go(i), this.wait(undefined, 'lie', { tick: tick(13), until })]);
    return true;
  }

  planStayHome() {
    const home = this.homeRoom();
    if (!home) return false;
    if (this.needs.bladder > 40 && this.planToilet(home.key)) return true;
    const i = this.randomTileIn(home);
    if (i < 0) return false;
    this.setPlan([this.go(i), this.wait(4 + rnd() * 6, chance(0.4) ? 'sit' : 'stand')]);
    return true;
  }

  planToilet(roomKey) {
    const home = this.homeRoom();
    let f = null;
    if (roomKey !== undefined) f = this.findSpot(['toilet'], { room: roomKey });
    else if (home) f = this.findSpot(['toilet'], { room: home.key });
    if (!f && roomKey === undefined) f = this.findSpot(['toilet'], { maxDist: 30 });
    if (!f) return false;
    this.setPlan(this.useSteps(f, 3, 'sit', { tick: (p) => { if (p.st > 2.5) p.needs.bladder = 0; } }));
    return true;
  }

  planEat() {
    if (this.needs.hunger < 18) return false;
    const s = this.sim;
    const f = this.findSpot(['serving'], { types: ['canteen'], filter: (o) => o.food > 0 }) ||
              this.findSpot(['serving'], { types: ['canteen'] });
    if (!f) return false;
    const serving = f.o;
    const steps = this.useSteps(f, undefined, 'stand', {
      until: (p) => serving.food > 0 || p.st > 14,
    });
    steps.push(this.act((p) => {
      if (serving.food <= 0) { p.needs.hunger += 3; return false; }
      serving.food--;
      p.carry = 'tray';
      p.release();
      const seat = p.findSpot(['table'], { types: ['canteen'], maxDist: 40 });
      const eat = p.wait(7, seat ? 'sit' : 'stand', {
        tick: (q) => { if (q.st > 6.5 && q.carry === 'tray') s.fed(q); },
      });
      if (seat) {
        p.reserve(seat.o, seat.k);
        eat.face = seat.s.face;
        p.plan.push(p.go(seat.s.i), eat);
      } else p.plan.push(eat);
      p.plan.push(p.act((q) => { q.carry = null; }));
    }));
    this.setPlan(steps);
    return true;
  }

  planShower() {
    const f = this.findSpot(['shower'], { types: ['shower'] });
    if (!f) return false;
    this.setPlan(this.useSteps(f, 5, 'shower', {
      tick: (p) => { if (p.st > 4.5) { p.needs.hygiene = 0; p.sim.dirty(p.ti, 3); } },
    }));
    return true;
  }

  planYard() {
    const w = this.world;
    const yards = w.roomsOf('yard');
    if (!yards.length) return false;
    const r = chance(0.5) ? this.findSpot(['weights'], { types: ['yard'] }) : null;
    if (r) {
      this.setPlan(this.useSteps(r, 9, 'work', { tick: (p, dt) => { p.needs.exercise -= 60 * dt / HOUR_SEC; } }));
      return true;
    }
    const b = chance(0.3) ? this.findSpot(['bench'], { types: ['yard'] }) : null;
    if (b) {
      this.setPlan(this.useSteps(b, 8, 'sit', { tick: (p, dt) => { p.needs.fun -= 20 * dt / HOUR_SEC; } }));
      return true;
    }
    let yard = yards[0], bd = 1e9;
    for (const y of yards) { const d = dist(this.x, this.y, y.cx, y.cy); if (d < bd) { bd = d; yard = y; } }
    const i = this.inYard() ? this.randomTileNear(6, (t) => w.roomAt[t] === yard.idx) : this.randomTileIn(yard);
    if (i < 0) return false;
    this.setPlan([this.go(i), this.wait(2 + rnd() * 5, chance(0.3) ? 'work' : 'stand', {
      tick: (p, dt) => { p.needs.exercise -= 25 * dt / HOUR_SEC; },
    })]);
    return true;
  }
  inYard() { const r = this.world.roomOf(this.ti); return r && r.type === 'yard'; }

  planJob() {
    const s = this.sim, j = this.task;
    if (!j) return false;
    const ok = this.planTask(j);
    if (!ok && j !== 'clean') { this.taskBan = j; this.task = null; }
    return ok;
  }
  planTask(j) {
    const s = this.sim;
    const until = (p) => p.sim.act() !== 'work';
    if (j === 'workshop') {
      const f = this.findSpot(['workbench', 'press'], { types: ['workshop'] });
      if (!f) return false;
      this.setPlan(this.useSteps(f, undefined, 'work', {
        until, tick: (p, dt) => {
          if (f.o.def.power && !f.o.powered) return;
          p.workAcc = (p.workAcc || 0) + dt * (f.o.key === 'press' ? 1.4 : 1);
          if (p.workAcc > 11) { p.workAcc = 0; s.madeGoods(p, f.o); }
        },
      }));
      return true;
    }
    if (j === 'laundry') {
      const f = this.findSpot(['washer'], { types: ['laundry'] });
      if (!f) return false;
      this.setPlan(this.useSteps(f, undefined, 'work', {
        until, tick: (p, dt) => { if (f.o.powered) s.laundry = Math.min(100, s.laundry + dt * 0.35); },
      }));
      return true;
    }
    if (j === 'kitchen') {
      const f = this.findSpot(['cooker'], { types: ['kitchen'] });
      if (!f) return false;
      this.setPlan(this.useSteps(f, undefined, 'work', {
        until, tick: (p, dt) => {
          if (!f.o.powered || s.mealNeed() <= 0) return;
          p.workAcc = (p.workAcc || 0) + dt;
          if (p.workAcc > 7) { p.workAcc = 0; s.cook(2, p); }
        },
      }));
      return true;
    }
    if (j === 'clean') {
      const w = this.world;
      const r = w.search(this.tx, this.ty, this, (i) => w.dirt[i] > 50, 1500);
      if (!r) { this.planWander(6); return true; }
      this.setPlan([this.go(r.i), this.wait(1.6, 'work', { tick: (p) => { if (p.st > 1.5) w.dirt[r.i] = 0; } })]);
      return true;
    }
    if (j === 'class') {
      const f = this.findSpot(['schoolDesk'], { types: ['classroom'] });
      if (!f) return false;
      const room = f.o.room;
      this.setPlan(this.useSteps(f, undefined, 'sit', {
        until, tick: (p, dt) => { if (s.teacherIn(room)) s.study(p, dt); },
      }));
      return true;
    }
    return false;
  }

  planFree() {
    const n = this.needs, s = this.sim;
    const order = [
      ['fun', n.fun], ['family', n.family], ['exercise', Math.max(n.exercise, n.freedom)],
      ['hygiene', n.hygiene * 0.8], ['comfort', n.comfort * 0.6],
    ].sort((a, b) => b[1] - a[1]);
    for (const [k, v] of order) {
      if (v < 25) break;
      if (k === 'fun' && this.planFun()) return;
      if (k === 'family' && this.planFamily()) return;
      if (k === 'exercise' && this.planYard()) return;
      if (k === 'hygiene' && this.planShower()) return;
      if (k === 'comfort' && this.planStayHome()) return;
    }
    if (chance(0.3) && this.planFun()) return;
    const common = this.world.roomsOf('common');
    if (common.length && chance(0.4)) {
      const i = this.randomTileIn(pick(common));
      if (i >= 0) { this.setPlan([this.go(i), this.wait(3 + rnd() * 5, 'stand')]); return; }
    }
    this.planWander(6);
    void s;
  }

  planFun() {
    const s = this.sim, w = this.world;
    const tvNear = (o) => {
      for (const t of w.objects.values()) {
        if (t.key === 'tv' && t.hp > 0 && t.powered && t.room === o.room && dist(t.x, t.y, o.x, o.y) < 6) return true;
      }
      return false;
    };
    const opts = [];
    const pp = this.findSpot(['pingpong']);
    if (pp) opts.push(['pp', pp, 3]);
    const book = this.findSpot(['bookshelf'], { types: ['library', 'common'] });
    if (book) opts.push(['book', book, this.traits.includes('reader') ? 4 : 2]);
    const seat = this.findSpot(['sofa', 'bench'], { maxDist: 45 });
    if (seat) opts.push(['seat', seat, seat.o.room >= 0 && tvNear(seat.o) ? 4 : 1.5]);
    if (this.contra.includes('cards')) opts.push(['cards', null, 2]);
    if (!opts.length) return false;
    let tot = 0; for (const o of opts) tot += o[2];
    let r = rnd() * tot, c = opts[0];
    for (const o of opts) { r -= o[2]; if (r <= 0) { c = o; break; } }
    const [kind, f] = c;
    if (kind === 'cards') {
      this.setPlan([this.wait(8, 'sit', { tick: (p, dt) => { p.needs.fun -= 50 * dt / HOUR_SEC; } }),
        this.act((p) => { if (chance(0.12)) s.cardsTrouble(p); })]);
      return true;
    }
    const rate = kind === 'seat' ? (c[2] >= 4 ? 70 : 28) : kind === 'pp' ? 80 : (this.traits.includes('reader') ? 90 : 55);
    const pose = kind === 'pp' ? 'work' : kind === 'book' ? 'stand' : 'sit';
    this.setPlan(this.useSteps(f, 10 + rnd() * 6, pose, { tick: (p, dt) => { p.needs.fun -= rate * dt / HOUR_SEC; } }));
    return true;
  }

  planFamily() {
    const s = this.sim;
    if (s.research.has('visits') && chance(0.5) && s.requestVisit(this)) return true;
    const f = this.findSpot(['phone']);
    if (!f) return false;
    this.setPlan(this.useSteps(f, 7, 'stand', { tick: (p, dt) => { p.needs.family -= 160 * dt / HOUR_SEC; } }));
    return true;
  }

  planVisit() {
    const v = this.visit;
    if (!v || v.done || v.vis.gone) { this.visit = null; return; }
    this.reserve(v.o, v.k);
    this.setPlan([this.go(v.s.i), this.wait(undefined, 'sit', {
      face: v.s.face, until: (p) => !p.visit || p.visit.done || p.st > 70,
    }), this.act((p) => { p.visit = null; })]);
  }

  planInfirmary() {
    const f = this.findSpot(['medbed'], { types: ['infirmary'] });
    if (!f) return false;
    this.setPlan(this.useSteps(f, undefined, 'lie', {
      until: (p) => p.hp >= 85 || p.st > 60,
      tick: (p, dt) => { p.hp = Math.min(100, p.hp + 30 * dt / HOUR_SEC); },
    }));
    return true;
  }

  planSolitary() {
    const room = this.world.roomByKey.get(this.confined);
    if (!room) { this.confined = -1; this.state = 'normal'; return; }
    const i = this.randomTileIn(room);
    this.setPlan([this.go(i >= 0 ? i : this.ti), this.wait(6 + rnd() * 6, chance(0.6) ? 'sit' : 'stand')]);
  }

  planEscape() {
    const w = this.world;
    this.say('❗', 4);
    this.setPlan([
      this.go(-1, { pred: (i) => w.isOutside(i % MAP_W, (i / MAP_W) | 0), max: 20000, run: true }),
      this.act((p) => { p.sim.escaped(p, false); }),
    ]);
    const st = this.plan[0];
    const fail = () => { this.state = 'normal'; this.cool = 2; };
    st.onFail = fail;
    /* 経路がなければあきらめる */
    const r = w.search(this.tx, this.ty, this, st.pred, 20000);
    if (!r) { this.endPlan(); fail(); }
  }

  planRiot() {
    const s = this.sim, w = this.world;
    const staff = s.nearestPerson(this, 9, (q) => q.kind === 'staff' && q.mode !== 'ko' && !q.gone);
    if (staff) { this.foe = staff; this.fightT = 0; return; }
    /* 扉か設備を壊す */
    let best = -1, bd = 9;
    const x0 = this.tx, y0 = this.ty;
    for (let y = y0 - 6; y <= y0 + 6; y++) for (let x = x0 - 6; x <= x0 + 6; x++) {
      if (!w.inb(x, y)) continue;
      const i = w.idx(x, y);
      const ok = (w.door[i] && w.hp[i] > 0) || (w.objAt[i] >= 0 && w.obj(i).hp > 0 && w.obj(i).key !== 'tree');
      if (!ok) continue;
      const d = dist(x, y, x0, y0) + rnd() * 2;
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0 && chance(0.7)) { this.planSmash(best); return; }
    this.planWander(5);
  }

  planSmash(i) {
    const s = this.sim;
    const bx = i % MAP_W + 0.5, by = ((i / MAP_W) | 0) + 0.5;
    this.vandal = true;
    this.setPlan([this.go(i, { near: true }),
      this.act((p) => { p.vandal = true; p.face = Math.atan2(by - p.y, bx - p.x); }),
      this.wait(2.4, 'fight', { face: undefined }),
      this.act((p) => { s.smash(p, i); p.vandal = false; })]);
    this.plan[2].face = undefined;
  }

  /* =========================================================================
     職員
     ========================================================================= */
  updateMode(dt) {
    const s = this.sim;
    if (this.mode === 'ko') {
      this.pose = 'lie'; this.moving = false;
      if (s.t >= this.koUntil) { this.mode = null; this.pose = 'stand'; this.hp = Math.max(this.hp, 35); }
      return true;
    }
    if (this.role === 'guard' || this.role === 'police') {
      if (this.mode === 'subdue') {
        const tg = this.target;
        if (!tg || tg.gone || tg.carriedBy || tg.state === 'ko' || !s.isWanted(tg)) {
          this.mode = null; this.target = null; this.path = null;
          if (tg && !tg.gone && tg.state === 'ko' && !tg.carriedBy && this.role === 'guard' && tg.offense) s.requestSolitary(tg, this);
          return false;
        }
        this.engage(tg, dt);
        return true;
      }
      if (!this.carrying && (this.scanT -= dt) <= 0) {
        this.scanT = 0.5;
        const tg = s.pickTarget(this);
        if (tg) { this.endPlan(); this.mode = 'subdue'; this.target = tg; this.path = null; this.say('❗', 1.5); return true; }
      }
    }
    return false;
  }

  decideWorker() {
    const s = this.sim;
    const job = s.jobs.take(this);
    if (!job) {
      const i = this.randomTileNear(4, (t) => dist(t % MAP_W, (t / MAP_W) | 0, s.stockTile() % MAP_W, (s.stockTile() / MAP_W) | 0) < 7);
      if (i >= 0) this.setPlan([this.go(i), this.wait(3 + rnd() * 4, 'stand')]);
      else this.setPlan([this.go(s.stockTile(), { near: true }), this.wait(3, 'stand')]);
      return;
    }
    this.job = job;
    const steps = [];
    const stockOk = this.world.nearReachable(s.stockTile(), this.reachGen);
    if (s.jobs.needsCrate(job) && this.carry !== 'crate' && stockOk) {
      steps.push(this.go(s.stockTile(), { near: true }), this.wait(0.8, 'work'), this.act((p) => { p.carry = 'crate'; p.load = job.kind === 'obj' ? 1 : 8; }));
    }
    steps.push(...this.buildSteps(job));
    this.plan = steps; this.si = 0; this.st = 0;
  }
  buildSteps(job) {
    const s = this.sim;
    const work = s.jobs.workTime(job);
    return [
      this.go(job.i, { near: !(job.stand && this.world.canWalk(job.i, this, false)) }),
      this.act((p) => { if (job.dead) return false; p.face = Math.atan2(job.y + 0.5 - p.y, job.x + 0.5 - p.x); }),
      this.wait(undefined, 'work', {
        until: (p) => job.prog >= work,
        tick: (p, dt) => { if (job.dead) return false; job.prog += dt; if (rnd() < dt * 3) s.spark(job.x + 0.5, job.y + 0.5, '#c8c0a0'); },
      }),
      this.act((p) => {
        if (job.dead) return false;
        s.jobs.complete(job);
        p.job = null;
        if (s.jobs.needsCrate(job)) p.load = (p.load || 1) - 1;
        if (p.load > 0) {
          const next = s.jobs.takeNear(p, job);
          if (next) { p.job = next; p.plan.push(...p.buildSteps(next)); return; }
        }
        p.carry = null;
      }),
    ];
  }

  decideGuard() {
    const s = this.sim, w = this.world;
    const key = s.searchQueue.shift();
    if (key !== undefined) {
      const room = w.roomByKey.get(key);
      if (room) {
        const i = this.randomTileIn(room);
        if (i >= 0) {
          this.setPlan([this.go(i), this.wait(4, 'work'), this.act(() => { s.searchRoom(room, this); })]);
          return;
        }
      }
    }
    if (s.research.has('patrol') && w.patrol.length) {
      this.pk = ((this.pk === undefined ? this.id : this.pk) + 1) % w.patrol.length;
      this.setPlan([this.go(w.patrol[this.pk]), this.wait(2 + rnd() * 3, 'stand')]);
      return;
    }
    const ps = s.people.filter((p) => p.kind === 'prisoner' && p.state === 'normal');
    if (ps.length && chance(0.8)) {
      const p = pick(ps);
      const i = p.randomTileNear(3, (t) => w.canWalk(t, this, false));
      if (i >= 0) { this.setPlan([this.go(i), this.wait(4 + rnd() * 5, 'stand')]); return; }
    }
    this.planWander(8);
  }

  decidePolice() {
    const s = this.sim;
    const any = s.people.some((p) => p.kind === 'prisoner' && s.isWanted(p));
    if (!any) {
      this.idleT = (this.idleT || 0) + 1;
      if (this.idleT > 12) { this.leaving = true; this.planExit(); return; }
    } else this.idleT = 0;
    const r = s.people.find((p) => p.kind === 'prisoner' && (p.state === 'riot' || p.state === 'fight'));
    if (r) { this.setPlan([this.go(r.ti, { near: true }), this.wait(1, 'stand')]); return; }
    this.planWander(6);
  }

  decideCook() {
    const s = this.sim;
    const kit = this.nearestRoom('kitchen');
    if (!kit) { this.planWander(5); return; }
    if (s.kitchenFood > 0) {
      const f = this.findSpot(['serving'], { types: ['canteen'], filter: (o) => o.food < 30 });
      if (f) {
        const n = Math.min(8, s.kitchenFood);
        s.kitchenFood -= n;
        this.carry = 'tray';
        this.setPlan([
          ...this.useSteps(f, 1.2, 'work'),
          this.act((p) => { f.o.food += n; p.carry = null; }),
        ]);
        const plan = this.plan;
        plan.lost = n;
        return;
      }
    }
    if (s.mealNeed() > 0) {
      const f = this.findSpot(['cooker'], { types: ['kitchen'], powered: true });
      if (f) {
        this.setPlan([...this.useSteps(f, 5, 'work', { tick: (p, dt) => { if (rnd() < dt * 2) s.steam(f.o); } }),
          this.act(() => { s.cook(5, this); })]);
        return;
      }
    }
    const i = this.randomTileIn(kit);
    this.setPlan([this.go(i >= 0 ? i : this.ti), this.wait(3 + rnd() * 4, 'stand')]);
  }

  nearestRoom(type) {
    let best = null, bd = 1e9;
    for (const r of this.world.roomsOf(type)) {
      const d = dist(this.x, this.y, r.cx, r.cy);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  decideDoctor() {
    const s = this.sim;
    const pt = s.nearestPerson(this, 80, (q) => q !== this && q.hp < 60 && !q.carriedBy && q.state !== 'fight' && q.state !== 'riot' && q.state !== 'escape' && !q.gone && q.kind !== 'visitor');
    if (pt) {
      this.setPlan([this.go(pt.ti, { near: true }), this.act((p) => { if (dist(p.x, p.y, pt.x, pt.y) > 2.2) return false; }),
        this.wait(3, 'work', { face: Math.atan2(pt.y - this.y, pt.x - this.x) }),
        this.act(() => { s.treat(pt, this); })]);
      return;
    }
    const inf = this.nearestRoom('infirmary');
    if (inf) {
      const i = this.randomTileIn(inf);
      this.setPlan([this.go(i >= 0 ? i : this.ti), this.wait(5 + rnd() * 5, 'stand')]);
      return;
    }
    this.planWander(5);
  }

  decideJanitor() {
    const w = this.world;
    const r = w.search(this.tx, this.ty, this, (i) => w.dirt[i] > 40, 2500);
    if (r) {
      this.carry = 'mop';
      this.setPlan([this.go(r.i), this.wait(1.4, 'work', {
        tick: (p) => { if (p.st > 1.3) { const x = r.i % MAP_W, y = (r.i / MAP_W) | 0; for (const [dx, dy] of [[0, 0], ...DIRS4]) if (w.inb(x + dx, y + dy)) w.dirt[w.idx(x + dx, y + dy)] = 0; } },
      })]);
      return;
    }
    this.planWander(8);
  }

  decideTeacher() {
    const s = this.sim;
    if (s.act() === 'work') {
      const f = this.findSpot(['blackboard'], { types: ['classroom'] });
      if (f) {
        this.setPlan(this.useSteps(f, undefined, 'stand', { face: f.s.face + Math.PI, until: (p) => p.sim.act() !== 'work' }));
        return;
      }
    }
    const cls = this.nearestRoom('classroom');
    if (cls) { const i = this.randomTileIn(cls); if (i >= 0) { this.setPlan([this.go(i), this.wait(5, 'stand')]); return; } }
    this.planWander(5);
  }

  /* 所長と幹部。自分の机に座る。 */
  decideDesk() {
    const s = this.sim;
    let f = null;
    if (this.role === 'warden') f = this.findSpot(['wardenDesk'], { types: ['office'] });
    else f = this.findSpot(['desk'], { types: ['admin'] });
    if (!f) { this.planWander(4); return; }
    this.setPlan(this.useSteps(f, 30, 'sit', { tick: (p) => { p.atDesk = true; } }));
    void s;
  }

  dropCarried() {
    const c = this.carrying;
    this.carrying = null;
    if (!c) return;
    c.carriedBy = null;
    const w = this.world;
    const i = w.canWalk(this.ti, c, false) ? this.ti : this.ti;
    c.place(i % MAP_W, (i / MAP_W) | 0);
  }
}
