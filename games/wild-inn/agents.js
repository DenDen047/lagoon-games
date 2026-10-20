/* =========================================================================
   WILD INN ― 動くもの
   歩く道すじ (階段で階をまたぐ) / オーナー / 受付に来るお客さん / ペット /
   近くでできること
   ========================================================================= */
'use strict';

class Walker {
  constructor() {
    this.floor = 0; this.x = 0; this.y = 0; this.dir = 'd';
    this.path = null; this.legs = null; this.done = null;
    this.walk = 0; this.moving = false; this.speed = 2;
  }
  /* 目的地まで歩く。ちがう階なら階段を通る。道がなければ false */
  goTo(floor, tx, ty, done, only) {
    this.legs = [];
    if (floor !== this.floor) {
      const s = Hotel.stairs();
      this.legs.push({ x: s.x + 1, y: s.y + 1 });
      this.legs.push({ to: floor });
    }
    this.legs.push({ x: tx, y: ty, only });
    this.done = done || null;
    return this.nextLeg();
  }
  nextLeg() {
    const L = this.legs && this.legs.shift();
    if (!L) {
      this.path = null; this.legs = null;
      const d = this.done;
      this.done = null;
      if (d) d();
      return true;
    }
    if (L.to !== undefined) {
      this.floor = L.to;
      const s = Hotel.stairs();
      this.x = s.x + 1.5; this.y = s.y + 1.5;
      this.changedFloor();
      return this.nextLeg();
    }
    const p = Hotel.route(this.floor, this.x, this.y, L.x, L.y, L.only);
    if (!p) { this.path = null; this.legs = null; this.done = null; return false; }
    this.path = p;
    return true;
  }
  changedFloor() {}
  stop() { this.path = null; this.legs = null; this.done = null; this.moving = false; }
  stepPath(dt) {
    if (!this.path) { this.moving = false; return; }
    const tg = this.path[0];
    const dx = tg.x - this.x, dy = tg.y - this.y, d = Math.hypot(dx, dy), sp = this.speed * dt;
    this.face(dx, dy);
    this.moving = true;
    this.walk += dt * 10 * Math.min(1.4, this.speed / 2);
    if (d <= sp) {
      this.x = tg.x; this.y = tg.y;
      this.path.shift();
      if (!this.path.length) { this.path = null; this.nextLeg(); }
    } else {
      this.x += (dx / d) * sp; this.y += (dy / d) * sp;
    }
  }
  face(dx, dy) {
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return;
    if (Math.abs(dx) > Math.abs(dy) * 0.6) this.dir = dx < 0 ? 'l' : 'r';
    else this.dir = dy < 0 ? 'u' : 'd';
  }
}

/* ------------------------------ オーナー (自分) ------------------------------ */
class Player extends Walker {
  constructor() {
    super();
    this.speed = 3.4;
  }
  get look() { return G.owner.look; }
  update(dt) {
    const a = Input.axis();
    if (a.x || a.y) {
      this.stop();
      const n = Math.hypot(a.x, a.y), sp = this.speed * dt;
      const c = Hotel.collide(this.floor, this.x + (a.x / n) * sp, this.y + (a.y / n) * sp, 0.28);
      this.x = c.x; this.y = c.y;
      this.face(a.x, a.y);
      this.moving = true;
      this.walk += dt * 11;
    } else if (this.path) this.stepPath(dt);
    else this.moving = false;
  }
  changedFloor() {
    R.viewFloor = this.floor;
    R.fade = 0.35;
    Sound.play('stairs');
  }
  /* 階段で別の階へ */
  useStairs(to) {
    const s = Hotel.stairs();
    this.stop();
    this.floor = to;
    this.x = s.x + 1.5; this.y = s.y + 1.5;
    const p = Hotel.nearestFree(to, this.x, this.y);
    this.x = p.x; this.y = p.y;
    this.changedFloor();
  }
}

/* ------------------------------ ペット ------------------------------
   mode: follow (飼い主についていく) / travel (部屋へ向かう) / room (部屋の中) /
         leave (受付へ向かう) / wait (受付で待つ) */
class Pet extends Walker {
  constructor(look, name) {
    super();
    this.look = look; this.name = name; this.sp = look.sp;
    this.speed = SPECIES[look.sp].speed;
    this.mode = 'follow'; this.g = null; this.leader = null;
    this.state = 'idle'; this.timer = rfloat(0.5, 2); this.reactT = 0; this.dir = chance(0.5) ? 'l' : 'r';
    this.gone = false;
  }
  static fromGuest(g) {
    const p = new Pet(g.look, g.name);
    p.g = g; p.floor = clamp(g.floor, 0, G.floors - 1); p.x = g.x; p.y = g.y;
    const room = Hotel.roomById(g.roomId);
    if (room && room.floor === p.floor && Hotel.zone(p.floor, Math.floor(p.x), Math.floor(p.y)) === room.id) {
      p.mode = 'room';
      const q = Hotel.nearestFree(p.floor, p.x, p.y, room.id);
      p.x = q.x; p.y = q.y;
    } else {
      const q = Hotel.nearestFree(p.floor, p.x, p.y);
      p.x = q.x; p.y = q.y;
      p.travel();
    }
    return p;
  }
  attach(g) { this.g = g; this.leader = null; this.travel(); }
  travel() {
    const room = Hotel.roomById(this.g.roomId);
    if (!room) return;
    this.mode = 'travel'; this.state = 'idle';
    const t = Hotel.doorTiles(room).in;
    const arrive = () => { this.mode = 'room'; this.timer = 0.6; };
    if (!this.goTo(room.floor, t.x, t.y, arrive)) {
      this.stop();
      this.floor = room.floor;
      const q = Hotel.nearestFree(room.floor, t.x + 0.5, t.y + 0.5, room.id);
      this.x = q.x; this.y = q.y;
      arrive();
    }
  }
  leaveRoom() {
    this.mode = 'leave'; this.state = 'idle';
    const s = Hotel.petSpot();
    if (!this.goTo(0, s.x, s.y, () => { this.mode = 'wait'; })) {
      this.stop();
      this.floor = 0; this.x = s.x + 0.5; this.y = s.y + 0.5;
      this.mode = 'wait';
    }
  }
  wake() { this.state = 'idle'; this.timer = rfloat(1, 2); }
  react(state, sec) {
    this.state = state; this.reactT = sec; this.timer = sec + rfloat(0.5, 1.5);
    this.stop();
    const P = R.player;
    if (P && P.floor === this.floor) this.dir = P.x < this.x ? 'l' : 'r';
  }
  face(dx) { if (Math.abs(dx) > 0.02) this.dir = dx < 0 ? 'l' : 'r'; }
  update(dt) {
    this.reactT -= dt;
    if (this.reactT <= 0 && (this.state === 'happy' || this.state === 'eat')) this.state = 'idle';
    if (this.mode === 'follow' && this.leader) this.follow(dt);
    else if (this.mode === 'room') this.roomAI(dt);
    else this.stepPath(dt);
    if (this.g) { this.g.floor = this.floor; this.g.x = this.x; this.g.y = this.y; }
  }
  /* 飼い主の歩いたあと (足あと) を 0.75 マスうしろからたどる。かべをこえない */
  follow(dt) {
    const L = this.leader;
    if (this.floor !== L.floor) { this.floor = L.floor; this.x = L.x; this.y = L.y; }
    let tx = L.x, ty = L.y, px = L.x, py = L.y, need = 0.75;
    for (let i = L.trail.length - 1; i >= 0 && need > 0; i--) {
      const q = L.trail[i], d = dist(px, py, q.x, q.y);
      if (d >= need) { tx = px + ((q.x - px) * need) / d; ty = py + ((q.y - py) * need) / d; break; }
      need -= d; px = tx = q.x; py = ty = q.y;
    }
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d > 3) { this.x = tx; this.y = ty; return; }
    if (d > 0.1) {
      const sp = Math.max(this.speed, L.speed) * 1.1 * dt * Math.min(1, d * 1.5);
      const c = Hotel.collide(this.floor, this.x + (dx / d) * sp, this.y + (dy / d) * sp, 0.15);
      this.x = c.x; this.y = c.y;
      this.face(dx);
      this.moving = true;
      this.walk += dt * 10;
    } else this.moving = false;
  }
  roomAI(dt) {
    if (this.path) { this.stepPath(dt); return; }
    this.moving = false;
    this.timer -= dt;
    if (this.timer > 0 || this.reactT > 0) return;
    const room = Hotel.roomById(this.g.roomId);
    if (!room) return;
    const S = SPECIES[this.sp], r = rnd();
    if (this.state === 'sleep' && r < 0.55) { this.timer = rfloat(4, 8); return; }
    this.state = 'idle';
    const sleepy = G.clock > 18 * 60 ? 0.35 : this.sp === 'sloth' ? 0.4 : 0.12;
    if (r < sleepy && this.g.hunger > 25) { this.state = 'sleep'; this.timer = rfloat(6, 12); return; }
    const done = (st) => () => { this.timer = rfloat(2, 6); if (st) this.state = st; };
    if (r < 0.55) {
      const fav = Hotel.furnIn(room).filter((fu) => fu.type === S.likes || FURN[fu.type].hab === S.hab);
      if (fav.length) {
        const fu = pick(fav), d = FURN[fu.type];
        const spots = [];
        for (let y = fu.y - 1; y <= fu.y + d.h; y++) {
          for (let x = fu.x - 1; x <= fu.x + d.w; x++) {
            if (Hotel.walk(room.floor, x, y) && Hotel.zone(room.floor, x, y) === room.id) spots.push({ x, y });
          }
        }
        const s = spots.length && pick(spots);
        if (s && this.goTo(this.floor, s.x, s.y, done(fu.type === S.likes ? 'play' : null), room.id)) return;
      }
    }
    const t = pick(Hotel.roomTiles(room));
    if (!t || !this.goTo(this.floor, t.x, t.y, done(null), room.id)) this.timer = 2;
  }
  /* 描くときの見た目 */
  pose() {
    return {
      dir: this.dir, t: R.t + (this.g ? this.g.id : 0), walk: this.walk, moving: this.moving,
      sleep: this.state === 'sleep', happy: this.state === 'happy' || this.state === 'play', eat: this.state === 'eat',
      hop: this.state === 'happy' ? Math.abs(Math.sin(R.t * 9)) * 4 : this.state === 'play' ? Math.abs(Math.sin(R.t * 5)) * 2 : 0,
    };
  }
}

/* ------------------------------ 受付に来るお客さん ------------------------------
   kind 'in' はペットをあずけに来る人、'out' はむかえに来る人 */
class Visitor extends Walker {
  constructor(kind, data) {
    super();
    this.kind = kind;
    this.speed = 2.2;
    this.booking = kind === 'in' ? data : null;
    this.guest = kind === 'out' ? data : null;
    this.look = kind === 'in' ? data.owner : data.owner.look;
    this.name = kind === 'in' ? data.caller : data.owner.name;
    this.fromLeft = chance(0.5);
    this.x = (this.fromLeft ? -OUT : Hotel.W + OUT - 1) + 0.5;
    this.y = Hotel.H + 1.5;
    this.state = 'come'; this.wait = 0; this.qi = -1; this.gone = false;
    this.trail = [{ x: this.x, y: this.y }];
    if (kind === 'in') {
      this.pet = new Pet(data.look, data.name);
      this.pet.leader = this;
      this.pet.x = this.x + (this.fromLeft ? -0.7 : 0.7); this.pet.y = this.y;
      R.pets.push(this.pet);
    } else {
      this.pet = R.pets.find((p) => p.g === data) || null;
      if (this.pet) this.pet.leaveRoom();
    }
    R.queue.push(this);
    this.goQueue();
  }
  goQueue() {
    this.qi = R.queue.indexOf(this);
    const spots = Hotel.qspots(), s = spots[Math.min(this.qi, spots.length - 1)];
    this.state = 'come';
    if (!this.goTo(0, s.x, s.y, () => { this.state = 'wait'; this.dir = 'u'; })) { this.x = s.x + 0.5; this.y = s.y + 0.5; this.state = 'wait'; }
  }
  update(dt, dm) {
    this.stepPath(dt);
    const last = this.trail[this.trail.length - 1];
    if (dist(last.x, last.y, this.x, this.y) > 0.15) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 40) this.trail.shift();
    }
    if (this.state === 'leave') return;
    const qi = R.queue.indexOf(this);
    if (qi >= 0 && qi !== this.qi) this.goQueue();
    this.wait += dm;
    if (this.wait > PATIENCE && !UI.modalOpen()) this.giveUp();
  }
  giveUp() {
    if (this.kind === 'in') {
      G.bookings = G.bookings.filter((b) => b !== this.booking);
      G.rep = clamp(G.rep - 3, 0, 100);
      Sound.play('sad');
      Toast.show(`${this.name}は待ちくたびれて帰ってしまった…`, 'bad');
      this.leave();
    } else Desk.checkout(this, true);
  }
  leave() {
    R.queue = R.queue.filter((v) => v !== this);
    this.state = 'leave';
    const o = Hotel.entOut();
    const side = (this.fromLeft ? -OUT : Hotel.W + OUT - 1);
    const exit = () => { if (!this.goTo(0, side, Hotel.H + 1, () => this.vanish())) this.vanish(); };
    if (!this.goTo(0, o.x, o.y + 1, exit)) this.vanish();
  }
  vanish() {
    this.gone = true;
    R.queue = R.queue.filter((v) => v !== this);
    if (this.pet && this.pet.leader === this) this.pet.gone = true;
  }
  pose() { return { dir: this.dir, t: R.t, walk: this.walk, moving: this.moving, wave: this.state === 'wait' && this.qi === 0 && Math.sin(R.t * 0.7) > 0.85 }; }
}

/* ------------------------------ 近くでできること ------------------------------ */
const Interact = {
  target() {
    const p = R.player;
    if (!p || !G || G.phase !== 'day') return null;
    if (p.floor === 0) {
      const v = Desk.front();
      const st = Hotel.staffSpot(), cs = Hotel.custSpot();
      if (v && (dist(p.x, p.y, st.x + 0.5, st.y + 0.5) < 1.3 || dist(p.x, p.y, cs.x + 0.5, cs.y + 0.5) < 1.7)) return { kind: 'desk', v };
    }
    const z = Hotel.zone(p.floor, Math.floor(p.x), Math.floor(p.y));
    let best = null, bd = 1.6;
    for (const pet of R.pets) {
      if (!pet.g || pet.mode !== 'room' || pet.floor !== p.floor) continue;
      if (Hotel.zone(pet.floor, Math.floor(pet.x), Math.floor(pet.y)) !== z) continue;
      const d = dist(p.x, p.y, pet.x, pet.y);
      if (d < bd) { bd = d; best = pet; }
    }
    if (best) return { kind: 'pet', pet: best };
    if (G.floors > 1 && Hotel.isStairs(Math.floor(p.x), Math.floor(p.y))) return { kind: 'stairs' };
    return null;
  },
  actions(t) {
    if (!t) return [];
    if (t.kind === 'desk') return [{ id: 'desk', icon: '🛎️', label: t.v.kind === 'in' ? 'チェックイン' : 'お見送り', key: 'E' }];
    if (t.kind === 'pet') return [{ id: 'pet', icon: '🤚', label: 'なでる', key: 'E' }, { id: 'feed', icon: '🍖', label: 'えさ', key: 'F' }, { id: 'info', icon: '🔍', label: 'ようす', key: 'Q' }];
    if (t.kind === 'stairs') {
      const out = [];
      for (let f = G.floors - 1; f >= 0; f--) if (f !== R.player.floor) out.push({ id: 'floor' + f, icon: f > R.player.floor ? '⬆️' : '⬇️', label: `${f + 1}階へ`, key: String(f + 1) });
      return out;
    }
    return [];
  },
  use(id) {
    const t = this.target();
    if (!t) return;
    if (id === 'desk' && t.kind === 'desk') UI.openDesk(t.v);
    else if (id === 'pet' && t.kind === 'pet') Guests.pet(t.pet);
    else if (id === 'feed' && t.kind === 'pet') UI.openFeed(t.pet);
    else if (id === 'info' && t.kind === 'pet') UI.openPet(t.pet);
    else if (id.startsWith('floor') && t.kind === 'stairs') R.player.useStairs(+id.slice(5));
  },
};
