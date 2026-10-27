/* =========================================================================
   PAINT & HIDE ― キャラクターと、コンピューターの頭
   かくれる人 は 30びょうで 場所を えらび、ぬって とけこむか、はこや ロッカーに 入る。
   オニ は へやを 見まわり、うごくものや 足あと、あやしい ところを 撃つ。
   ========================================================================= */
'use strict';

const SPEED = 150;
const RADIUS = 14;
const VISION = { hider: 6 * TILE, oni: 6.5 * TILE };
const HIDE_T = 30, HUNT_T = 120;
const AMMO_MAX = 6, AMMO_RELOAD = 2.2, SHOT_GAP = 0.35;
const NAMES = ['ポン', 'ピコ', 'モモ', 'コロ', 'ミミ', 'タロ', 'ルル', 'ソラ', 'ハナ', 'ゴロ'];

class Agent {
  constructor(id, role, skin, isPlayer, name) {
    this.id = id; this.role = role; this.skin = skin; this.isPlayer = isPlayer; this.name = name;
    this.x = 0; this.y = 0; this.dir = 1; this.walk = 0; this.moving = false;
    this.alive = true;        // つかまって いない
    this.caughtT = null;      // さがす時間の 何びょう目に つかまったか
    this.inSpot = null;       // 入っている かくれ場所
    this.ammo = AMMO_MAX; this.reload = 0; this.shotCD = 0;
    this.aim = 0;
    this.painting = 0;        // ぬっている 最中 (きらきら)
    this.footT = 0; this.footSide = 1;
    this.phase = rand(TAU);
    this.brain = isPlayer ? null : role === 'oni' ? new OniBrain(this) : new HiderBrain(this);
  }
  /* 1フレームぶん (dx, dy) の向きに歩く。ゆうれいは かべを ぬける */
  step(dx, dy, dt) {
    const l = Math.hypot(dx, dy);
    this.moving = l > 0.05;
    if (!this.moving) return;
    const sp = SPEED * (this.alive ? 1 : 1.2) * Math.min(1, l);
    this.x += dx / l * sp * dt;
    if (this.alive) pushOut(this, RADIUS);
    this.y += dy / l * sp * dt;
    if (this.alive) pushOut(this, RADIUS);
    this.x = clamp(this.x, TILE, (MW - 1) * TILE); this.y = clamp(this.y, TILE, (MH - 1) * TILE);
    if (Math.abs(dx) > 0.2) this.dir = dx > 0 ? 1 : -1;
    this.walk += dt * 14 * Math.min(1, l);
  }
  /* 銃口の 位置 (オニ) */
  gunTip() {
    const P = partsOf(this.skin.shape);
    const hp = Math.cos(this.aim) >= 0 ? P.handR : P.handL;
    return { x: this.x + hp.cx + Math.cos(this.aim) * 20, y: this.y + hp.cy + Math.sin(this.aim) * 20 };
  }
}

/* 道を たどって 歩く 部分は かくれる人と オニで 同じ */
class Walker {
  constructor(a) {
    this.a = a;
    this.goal = null; this.path = [];
    this.wait = rand(0.2, 1);
    this.thinkT = rand(0.25);
    this.stuck = { t: 0, x: 0, y: 0 };
  }
  setGoal(g) { this.goal = g; this.path = findPath(this.a.x, this.a.y, g.x, g.y); this.stuck.t = 0; }
  clearGoal() { this.goal = null; this.path = []; }
  update(dt) {
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.2; this.think(); }
    this.move(dt);
  }
  move(dt) {
    const a = this.a;
    if (!this.goal || a.inSpot || a.painting > 0) { a.moving = false; this.wait -= dt; return; }
    const p = this.path[0];
    if (!p) { const g = this.goal; this.clearGoal(); this.arrive(g); return; }
    const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
    if (d < 6) { this.path.shift(); return; }
    a.step(dx / d, dy / d, Math.min(dt, d / SPEED));
    this.stuck.t += dt;
    if (this.stuck.t > 1.2) {
      if (dist(a.x, a.y, this.stuck.x, this.stuck.y) < 8) this.path = findPath(a.x, a.y, this.goal.x, this.goal.y);
      this.stuck.t = 0; this.stuck.x = a.x; this.stuck.y = a.y;
    }
  }
  wander() {
    const sp = randomSpot(pick(ROOMS).id);
    this.setGoal({ kind: 'wander', x: sp.x, y: sp.y });
  }
  arrive() { this.wait = rand(0.8, 2.5); }
}

/* ------------------------------ かくれる人 ------------------------------ */
class HiderBrain extends Walker {
  constructor(a) {
    super(a);
    this.plan = null;
    this.ready = false;                 // かくれ おわった
    this.blend = rand(0.12, 0.38);      // ぬりの うまさ (小さいほど うまい)
    this.blendCol = pick(SKIN_COLS);
    this.eyes = chance(0.45);
  }
  choosePlan() {
    const a = this.a;
    const free = SPOTS.filter((s) => !s.occ && s.res === undefined);
    if (free.length && chance(0.45)) {
      free.sort((p, q) => dist(q.cx, q.cy, HALL.x, HALL.y) - dist(p.cx, p.cy, HALL.x, HALL.y));
      const s = free[Math.floor(Math.random() * Math.min(free.length, 8))];
      s.res = a.id;
      const d = spotDoor(s);
      this.plan = { kind: 'spot', spot: s, x: d.x, y: d.y };
    } else {
      const room = pick(ROOMS.filter((r) => r.id !== 'hall' || chance(0.15)));
      const sp = randomSpot(room.id);
      this.plan = { kind: 'camo', x: sp.x + rand(-12, 12), y: sp.y + rand(-12, 12) };
    }
    this.setGoal({ kind: 'plan', x: this.plan.x, y: this.plan.y });
  }
  arrive(g) {
    const a = this.a;
    if (!g || g.kind !== 'plan' || !a.alive) { this.wait = rand(0.8, 2.5); return; }
    if (this.plan.kind === 'spot' && Game.enterSpot(a, this.plan.spot)) { this.ready = true; return; }
    this.startPaint();
  }
  /* その場の けしきを うつして とけこむ */
  startPaint() {
    const a = this.a;
    a.painting = 1.1;
    this.onPainted = () => {
      a.skin.shape = { bw: rand(10, 17), bh: rand(13, 20), fr: rand(10, 14) };
      camoSkin(a.skin, a.x, a.y, this.blend, this.blendCol, this.eyes);
      this.ready = true;
      if (Net.host) Net.emit({ t: 'skin', id: a.id, data: a.skin.toData() });
    };
  }
  update(dt) {
    const a = this.a;
    if (a.painting > 0) {
      a.painting -= dt;
      if (a.painting <= 0 && this.onPainted) { this.onPainted(); this.onPainted = null; }
    }
    super.update(dt);
  }
  think() {
    const a = this.a;
    if (!a.alive) { if (!this.goal && this.wait <= 0) this.wander(); return; }
    if (!this.plan) { this.choosePlan(); return; }
    if (this.ready || a.painting > 0) {
      /* オニが すぐそばに 来たら、ときどき こわくなって にげだす */
      if (Game.phase === 'hunt' && !a.inSpot) {
        for (const o of Game.agents) {
          if (o.role !== 'oni' || !o.alive) continue;
          const d = dist(a.x, a.y, o.x, o.y);
          if (d < TILE * 1.8 && los(a.x, a.y, o.x, o.y) && chance(0.05)) { this.flee(o); return; }
        }
      }
      return;
    }
    /* さがす時間に なっても 着いていなければ、その場で ぬる */
    if (Game.phase === 'hunt' && !this.goal) this.startPaint();
    else if (Game.phase === 'hunt' && chance(0.04)) { this.clearGoal(); this.startPaint(); }
  }
  flee(o) {
    const a = this.a;
    this.ready = false;
    const rooms = ROOMS.filter((r) => dist(r.cx, r.cy, o.x, o.y) > TILE * 10);
    const sp = randomSpot(pick(rooms.length ? rooms : ROOMS).id);
    this.plan = { kind: 'camo', x: sp.x, y: sp.y };
    this.setGoal({ kind: 'plan', x: sp.x, y: sp.y });
  }
}

/* ------------------------------ オニ ------------------------------ */
class OniBrain extends Walker {
  constructor(a) {
    super(a);
    this.target = null; this.lostT = 0;
    this.checked = new Map();    // かくれ場所 → 最後に 撃った 時
    this.inv = null;             // 足あとなど、見に 行く 場所
    this.repathT = 0;
    this.visited = {};           // へや → 最後に 見に 行った 時
  }
  /* しばらく 見ていない へやへ 見まわりに 行く */
  patrol() {
    const now = Game.clock;
    const rooms = ROOMS.slice().sort((p, q) => (this.visited[p.id] || -99) - (this.visited[q.id] || -99) + rand(-8, 8));
    const r = rooms[0];
    this.visited[r.id] = now;
    const sp = randomSpot(r.id);
    this.setGoal({ kind: 'patrol', x: sp.x, y: sp.y });
  }
  think() {
    const a = this.a;
    if (Game.phase !== 'hunt' || !a.alive) return;
    const vis = VISION.oni, now = Game.clock;
    /* 見つける */
    for (const h of Game.agents) {
      if (h.role !== 'hider' || !h.alive || h.inSpot || h === this.target) continue;
      if (!canSee(a.x, a.y, h.x, h.y, vis)) continue;
      const d = dist(a.x, a.y, h.x, h.y), fd = clamp(1 - d / vis, 0, 1);
      let p;
      if (h.moving || h.painting > 0) p = 0.3 + 0.4 * fd;
      else {
        const camo = Game.camoOf(h);
        p = Math.pow(1 - camo, 1.6) * (0.08 + 0.45 * fd);
        if (d < TILE * 1.3) p += 0.12;
      }
      if (chance(p)) { this.target = h; this.lostT = 0; this.inv = null; break; }
    }
    if (this.target) {
      const h = this.target;
      if (!h.alive) { this.target = null; }
      else if (h.inSpot || !canSee(a.x, a.y, h.x, h.y, vis)) {
        this.lostT += 0.2;
        if (this.lostT > 2) { this.inv = { x: h.x, y: h.y }; this.target = null; }
      } else this.lostT = 0;
    }
    /* 足あとを 見つけたら たどる */
    if (!this.target) {
      let best = null;
      for (const f of Game.prints) {
        if (Game.clock - f.t > 2.5 || !canSee(a.x, a.y, f.x, f.y, vis)) continue;
        if (!best || f.t > best.t) best = f;
      }
      if (best && (!this.inv || chance(0.3))) this.inv = { x: best.x, y: best.y };
    }
    /* そばの かくれ場所を ときどき 撃って たしかめる */
    if (!this.target && a.ammo >= 2) {
      for (const s of SPOTS) {
        if (now - (this.checked.get(s.i) || -99) < 20) continue;
        if (dist(a.x, a.y, s.cx, s.cy) > TILE * 3.2 || !los(a.x, a.y, s.cx, s.cy)) continue;
        this.checked.set(s.i, now);
        if (chance(0.6)) { a.aim = Math.atan2(s.cy - (a.y - 20), s.cx - a.x); Game.fire(a, a.aim + rand(-0.05, 0.05)); break; }
      }
    }
    /* 歩く 先 */
    if (this.target) {
      const h = this.target;
      this.repathT -= 0.2;
      if (this.repathT <= 0 && dist(a.x, a.y, h.x, h.y) > TILE * 3) { this.repathT = 0.6; this.setGoal({ kind: 'chase', x: h.x, y: h.y }); }
      else if (dist(a.x, a.y, h.x, h.y) <= TILE * 3) this.clearGoal();
    } else if (this.inv) {
      if (!this.goal || this.goal.kind !== 'inv') this.setGoal({ kind: 'inv', x: this.inv.x, y: this.inv.y });
    } else if (!this.goal && this.wait <= 0) this.patrol();
  }
  arrive(g) {
    if (g && g.kind === 'inv') this.inv = null;
    this.wait = rand(0.3, 1.5);
  }
  update(dt) {
    const a = this.a;
    super.update(dt);
    /* ねらって 撃つ */
    const h = this.target;
    if (h && h.alive && !h.inSpot && Game.phase === 'hunt') {
      const ty = h.y - h.skin.shape.bh - 2;
      const d = dist(a.x, a.y, h.x, ty);
      a.aim = Math.atan2(ty - (a.y - a.skin.shape.bh), h.x - a.x);
      if (d < TILE * 7 && a.shotCD <= 0 && a.ammo > 0 && los(a.x, a.y - 20, h.x, ty)) Game.fire(a, a.aim + rand(-0.07, 0.07));
    }
  }
}
