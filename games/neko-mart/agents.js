/* =========================================================================
   NEKO MART ― 猫たち
   自分の猫 (店長) / お客さんの猫 / 家具を使う
   ========================================================================= */
'use strict';

const TRASH_CAP = 10;
const UMB_COLORS = ['#ff7b8a', '#6cb8ff', '#ffd25e', '#8fdc7a', '#c79cff'];
const dirOf = (vx, vy) => (Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'r' : 'l') : (vy > 0 ? 'd' : 'u'));

/* ------------------------------ 店長 (自分で動かす猫) ------------------------------ */
class Player {
  constructor() {
    this.x = 0; this.y = 0; this.dir = 'd'; this.walk = 0; this.moving = false; this.t = 0;
    this.carry = null; this.path = null; this.useOnArrive = null; this.speed = 3.7; this.layoutV = R.layoutV;
  }
  get look() { return heroLook(); }
  walkTo(tx, ty, use) {
    const r = Shop.route(this.x, this.y, tx, ty);
    if (!r) return false;
    this.path = r;
    this.useOnArrive = use || null;
    if (!r.length && use) { this.path = null; this.useOnArrive = null; Interact.use(use); }
    return true;
  }
  free(x, y) {
    const r = 0.26;
    return Shop.walk(Math.floor(x - r), Math.floor(y - r)) && Shop.walk(Math.floor(x + r), Math.floor(y - r)) &&
      Shop.walk(Math.floor(x - r), Math.floor(y + r)) && Shop.walk(Math.floor(x + r), Math.floor(y + r));
  }
  /* かべに当たったら、マスの真ん中へ寄せて通りぬけやすくする */
  moveAxis(dx, dy) {
    if (this.free(this.x + dx, this.y + dy)) { this.x += dx; this.y += dy; return; }
    const step = Math.abs(dx || dy);
    if (dy) {
      const cx = Math.floor(this.x) + 0.5;
      if (Shop.walk(Math.floor(this.x), Math.floor(this.y + Math.sign(dy) * 0.6))) {
        const nx = this.x + clamp(cx - this.x, -step, step);
        if (this.free(nx, this.y)) this.x = nx;
      }
    } else {
      const cy = Math.floor(this.y) + 0.5;
      if (Shop.walk(Math.floor(this.x + Math.sign(dx) * 0.6), Math.floor(this.y))) {
        const ny = this.y + clamp(cy - this.y, -step, step);
        if (this.free(this.x, ny)) this.y = ny;
      }
    }
  }
  update(dt) {
    this.t += dt;
    if (this.layoutV !== R.layoutV) {
      this.layoutV = R.layoutV;
      const p = Shop.nearestFree(this.x, this.y);
      this.x = p.x; this.y = p.y; this.path = null; this.useOnArrive = null;
    }
    const ax = Input.axis();
    let vx = 0, vy = 0;
    const step = this.speed * dt;
    if (ax.x || ax.y) {
      this.path = null; this.useOnArrive = null;
      const l = Math.hypot(ax.x, ax.y);
      vx = ax.x / l; vy = ax.y / l;
      this.moveAxis(vx * step, 0);
      this.moveAxis(0, vy * step);
    } else if (this.path) {
      const wp = this.path[0];
      const dx = wp.x - this.x, dy = wp.y - this.y, d = Math.hypot(dx, dy);
      if (d <= step) {
        this.x = wp.x; this.y = wp.y; this.path.shift();
        if (!this.path.length) {
          this.path = null;
          if (this.useOnArrive) { const u = this.useOnArrive; this.useOnArrive = null; Interact.use(u); }
        }
      } else { this.x += (dx / d) * step; this.y += (dy / d) * step; }
      vx = dx; vy = dy;
    }
    this.moving = !!(vx || vy);
    if (this.moving) { this.walk += dt * 11; this.dir = dirOf(vx, vy); }
    /* 床のゴミを拾う・水たまりをふく */
    for (let i = G.litter.length - 1; i >= 0; i--) {
      const l = G.litter[i];
      if (dist(l.x, l.y, this.x, this.y) < 0.5) {
        G.litter.splice(i, 1);
        Sound.play('pick');
        FX.text('ゴミをひろった', l.x, l.y - 0.6, '#9be89b', 1);
      }
    }
    for (let i = G.puddles.length - 1; i >= 0; i--) {
      const p = G.puddles[i];
      if (dist(p.x, p.y, this.x, this.y) < 0.55) {
        p.a -= dt * 2.4;
        if (p.a <= 0) { G.puddles.splice(i, 1); Sound.play('mop'); FX.sparkle(p.x, p.y, 3); }
      }
    }
  }
}

/* ------------------------------ 家具を使う ------------------------------ */
const Interact = {
  /* いま近くにある、使える物 */
  target() {
    const p = R.player;
    const reg = Shop.register();
    if (reg) {
      const c = Shop.cashTile(reg);
      if (dist(p.x, p.y, c.x + 0.5, c.y + 0.5) < 0.62) return { f: reg, kind: 'register' };
    }
    let best = null, bd = 0.8;
    for (const f of G.furn) {
      if (f.type === 'register') continue;
      const d = FURN[f.type];
      const dx = Math.max(f.x - p.x, 0, p.x - (f.x + d.w));
      const dy = Math.max(f.y - p.y, 0, p.y - (f.y + d.h));
      let dd = Math.hypot(dx, dy);
      const fx = f.x + d.w / 2 - p.x, fy = f.y + d.h / 2 - p.y;
      if (dirOf(fx, fy) === p.dir) dd -= 0.25;
      if (dd < bd) { bd = dd; best = f; }
    }
    return best ? { f: best, kind: best.type } : null;
  },
  label(t) {
    if (!t) return null;
    const f = t.f, carry = R.player.carry;
    switch (t.kind) {
      case 'register': return R.queue.length && R.queue[0].state === 'pay' ? 'レジを打つ' : 'レジ';
      case 'stock': return carry ? '箱をもどす' : '箱をとる';
      case 'bench': return 'つくる';
      case 'trash': return f.fill > 0 ? 'ゴミを出す' : 'ゴミ箱';
      case 'umbrella': return 'かさ立て';
      case 'plant': return 'みずやり';
      case 'survey': return G.survey.unread ? `読む (${G.survey.unread})` : 'アンケート';
      default:
        if (FURN[f.type].display) {
          if (!carry) return '見る';
          return FURN[f.type].display === prod(carry.pid).store ? 'ならべる' : 'ここには×';
        }
    }
    return null;
  },
  use(t) {
    if (!t || !G.furn.includes(t.f)) return;
    const f = t.f, p = R.player;
    switch (t.kind) {
      case 'register':
        if (R.queue.length && R.queue[0].state === 'pay') R.scanBoost = true;
        else if (!R.queue.length) Toast.show('お客さんが来たら、ここに立ってお会計するよ');
        return;
      case 'stock':
        if (p.carry) this.returnBox();
        else UI.openStock();
        return;
      case 'bench': UI.openWorkshop(); return;
      case 'trash':
        if (f.fill > 0) {
          f.fill = 0;
          Sound.play('trash');
          FX.text('ゴミを出した', f.x + 0.5, f.y - 0.8, '#9be89b');
        } else Toast.show('ゴミ箱はからっぽ');
        return;
      case 'umbrella': Toast.show(`かさが ${f.umb} 本入っている`); return;
      case 'plant': FX.sparkle(f.x + 0.5, f.y, 5); Sound.play('put'); return;
      case 'survey': UI.openSurvey(); return;
    }
    if (FURN[f.type].display) {
      if (p.carry) this.restock(f);
      else UI.openDisplay(f);
    }
  },
  takeBox(pid) {
    const have = G.stock[pid] || 0;
    if (!have) return;
    const n = Math.min(BOX_MAX, have);
    G.stock[pid] = have - n;
    if (!G.stock[pid]) delete G.stock[pid];
    R.player.carry = { pid, n };
    Sound.play('pick');
  },
  returnBox() {
    const c = R.player.carry;
    if (!c) return;
    G.stock[c.pid] = (G.stock[c.pid] || 0) + c.n;
    R.player.carry = null;
    Sound.play('put');
  },
  restock(f) {
    const c = R.player.carry, p = prod(c.pid);
    if (FURN[f.type].display !== p.store) {
      Sound.play('error');
      Toast.show(`${p.name}は「${STORES[p.store].name}」にならべよう`, 'bad');
      return;
    }
    let moved = 0;
    for (const s of f.slots) {
      if (s.pid === c.pid && s.n > 0 && s.n < SLOT_CAP && c.n > 0) {
        const k = Math.min(SLOT_CAP - s.n, c.n); s.n += k; c.n -= k; moved += k;
      }
    }
    for (const s of f.slots) {
      if (c.n > 0 && s.n <= 0) {
        const k = Math.min(SLOT_CAP, c.n); s.pid = c.pid; s.n = k; c.n -= k; moved += k;
      }
    }
    if (!moved) { Sound.play('error'); Toast.show('もう並べる場所がないよ'); return; }
    G.stats.shelved += moved;
    Sound.play('put');
    FX.fly(c.pid, R.player.x, R.player.y - 0.5, f.x + FURN[f.type].w / 2, f.y + 0.2, 0.3);
    if (c.n <= 0) R.player.carry = null;
    Missions.check();
  },
  /* 棚から倉庫へもどす */
  takeDown(f, i) {
    const s = f.slots[i];
    if (!s || s.n <= 0) return;
    G.stock[s.pid] = (G.stock[s.pid] || 0) + s.n;
    s.pid = null; s.n = 0;
    Sound.play('pick');
  },
};

/* ------------------------------ お客さん ------------------------------ */
/* 町の動物の見た目をきめる。服や小物もときどき身につけている */
function randomLook() {
  const w = {};
  for (const k in SPECIES) w[k] = SPECIES[k].w;
  const sp = pickWeighted(w), S = SPECIES[sp];
  const look = { sp, size: rfloat(S.size[0], S.size[1]), seed: rnd() * 4 };
  if (sp === 'cat') {
    look.coat = pick(COATS).id;
    look.eye = pick(NATURAL_EYES);
    if (chance(look.coat === 'white' ? 0.35 : 0.04)) look.eye2 = pick(NATURAL_EYES.filter((e) => e !== look.eye));
  } else look.coat = rint(0, S.cols.length - 1);
  const wear = (slot, p) => {
    if (!chance(p)) return;
    const it = pick(FASHION[slot].filter((f) => !['none', 'apron', 'crown'].includes(f.id)));
    look[slot] = it.id;
    if (it.col) look[slot + 'Col'] = pick(CLOTH_COLORS);
  };
  wear('body', 0.45); wear('head', 0.35); wear('face', 0.12); wear('neck', 0.25);
  return look;
}

class Customer {
  constructor(enter) {
    this.look = randomLook();
    this.name = pick(CAT_NAMES);
    const left = chance(0.5);
    this.x = left ? -OUT + 0.3 : Shop.W + OUT - 0.3;
    this.y = Shop.H + rfloat(2.28, 2.72);
    this.speed = rfloat(1.7, 2.2);
    this.dir = left ? 'r' : 'l'; this.walk = rnd() * 6; this.moving = false; this.t = rnd() * 5;
    this.alive = true; this.shopper = !!enter; this.state = 'pass';
    this.umb = G.weather === 'rain' ? pick(UMB_COLORS) : null;
    this.wet = false; this.standUid = null; this.inside = false; this.tileKey = '';
    this.basket = []; this.mood = 0; this.visited = new Set(); this.bubble = null; this.said = {};
    this.want = null; this.gotWant = false;
    this.budget = (rint(250, 700) + G.rep * 6 + G.lv * 120) * (SPECIES[this.look.sp].budget || 1);
    this.maxItems = rint(1, 3) + (chance(0.25) ? 1 : 0);
    this.visitsLeft = rint(2, 4) + G.lv;
    this.patience = rfloat(24, 36);
    this.path = null; this.onArrive = null; this.goal = null; this.layoutV = R.layoutV; this.timer = 0;
    this.slipT = 0; this.dripT = 1; this.drips = 3; this.eating = null; this.qi = 0; this.arrived = false;
    this.litterRoll = !enter && chance(0.03);
    if (enter) {
      this.state = 'enter';
      const d = Shop.doorIn();
      this.goto(d.x, d.y, () => this.arriveInside(), () => { this.shopper = false; this.passBy(); });
    } else this.passBy(left);
  }
  get spent() { return this.basket.reduce((s, b) => s + b.price, 0); }

  passBy(toRight) {
    if (toRight === undefined) toRight = chance(0.5);
    this.state = 'pass';
    this.goal = null;
    const y = Shop.H + rfloat(2.3, 2.7);
    const ex = toRight ? Shop.W + OUT - 0.3 : -OUT + 0.3;
    this.path = [];
    if (Math.abs(this.y - y) > 0.3) this.path.push({ x: this.x, y });
    this.path.push({ x: ex, y });
    this.onArrive = () => { this.alive = false; };
  }
  goto(tx, ty, cb, fail) {
    this.goal = { tx, ty, cb, fail };
    const r = Shop.route(this.x, this.y, tx, ty);
    if (!r) { this.path = null; this.onArrive = null; if (fail) fail(); return false; }
    this.path = r;
    this.onArrive = cb;
    if (!r.length) { this.path = null; this.onArrive = null; if (cb) cb(); }
    return true;
  }
  repath() {
    if (!Shop.walk(Math.floor(this.x), Math.floor(this.y))) {
      const p = Shop.nearestFree(this.x, this.y);
      this.x = p.x; this.y = p.y;
    }
    if (this.state === 'queue' || this.state === 'pay') { this.goQueue(); return; }
    if (this.state === 'pass') return;
    const g = this.goal;
    if (g && this.path) this.goto(g.tx, g.ty, g.cb, g.fail);
  }
  say(text, dur = 2.2) {
    text = voice(text, this.look.sp);
    this.bubble = { text, t: dur };
    if (G.today.quotes.length < 40) G.today.quotes.push({ name: this.name, text, look: this.look });
  }
  sayIcon(icon, text, dur = 1.8) { this.bubble = { icon, text, t: dur }; }
  faceTo(f) {
    const d = FURN[f.type];
    this.dir = dirOf(f.x + d.w / 2 - this.x, f.y + d.h / 2 - this.y);
  }

  update(dt) {
    this.t += dt;
    if (this.layoutV !== R.layoutV) { this.layoutV = R.layoutV; this.repath(); }
    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
    if (this.happy > 0) this.happy -= dt;
    if (this.slipT > 0) { this.slipT -= dt; this.moving = false; return; }

    if (this.path && this.path.length) {
      const wp = this.path[0];
      const dx = wp.x - this.x, dy = wp.y - this.y, d = Math.hypot(dx, dy);
      const step = this.speed * dt;
      if (d <= step) { this.x = wp.x; this.y = wp.y; this.path.shift(); }
      else { this.x += (dx / d) * step; this.y += (dy / d) * step; }
      if (d > 0.01) this.dir = dirOf(dx, dy);
      this.moving = true;
      this.walk += dt * 10;
      if (!this.path.length) {
        this.path = null; this.moving = false;
        const cb = this.onArrive; this.onArrive = null;
        if (cb) cb();
      }
    } else this.moving = false;

    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    const inside = Shop.interior(tx, ty);
    if (inside && !this.inside && this.state === 'enter' && R.chimeT <= 0) { Sound.play('chime'); R.chimeT = 0.5; }
    this.inside = inside;
    const key = tx + ',' + ty;
    if (key !== this.tileKey) {
      this.tileKey = key;
      if (inside && this.moving) {
        const pd = G.puddles.find((p) => dist(p.x, p.y, this.x, this.y) < 0.55);
        if (pd && chance(0.22)) {
          this.slipT = 0.9; this.mood -= 0.8;
          this.say(pick(SAY.slip), 1.4);
          Sound.play('slip');
        }
      }
      if (this.litterRoll && ty >= Shop.H + 1 && tx >= -1 && tx <= Shop.W && chance(0.4)) {
        this.litterRoll = false;
        if (G.litter.length < 30) G.litter.push({ x: this.x + rfloat(-0.2, 0.2), y: Shop.H + 1.3 + rnd() * 0.4 });
      }
    }
    if (this.wet && inside && this.drips > 0) {
      this.dripT -= dt;
      if (this.dripT <= 0) {
        this.dripT = rfloat(2.5, 4.5);
        this.drips--;
        if (G.puddles.length < 20) G.puddles.push({ x: this.x + rfloat(-0.15, 0.15), y: this.y + rfloat(0, 0.2), a: 1, s: rfloat(0.8, 1.2) });
      }
    }

    switch (this.state) {
      case 'look': this.timer -= dt; if (this.timer <= 0) this.evaluate(); break;
      case 'think': this.timer -= dt; if (this.timer <= 0) this.browse(); break;
      case 'put': this.timer -= dt; if (this.timer <= 0) this.putUmbrella(); break;
      case 'eat': this.timer -= dt; if (this.timer <= 0) this.throwTrash(); break;
      case 'write':
        this.timer -= dt;
        if (this.timer <= 0) { if (G.furn.some((f) => f.type === 'survey')) Survey.write(this); this.leave(); }
        break;
      case 'queue':
      case 'pay':
        if (!(R.queue[0] === this && R.atRegister)) this.patience -= dt;
        if (this.patience < 9 && !this.said.wait) { this.said.wait = 1; this.say(pick(SAY.wait)); }
        if (this.patience <= 0) this.giveUp();
        break;
    }
  }

  /* ---- 店に入ってから ---- */
  arriveInside() {
    const plants = Math.min(3, Shop.count('plant'));
    this.mood += plants * 0.2;
    this.want = chooseWant(this.look.sp);
    if (this.umb) {
      const stand = G.furn.find((f) => f.type === 'umbrella');
      const acc = stand ? Shop.access(stand) : [];
      if (acc.length) {
        const a = pick(acc);
        this.state = 'toStand';
        this.goto(a.x, a.y, () => { this.state = 'put'; this.timer = 0.5; this.faceTo(stand); this.stand = stand; },
          () => { this.wet = true; this.startShopping(); });
        return;
      }
      this.wet = true;
    }
    this.startShopping();
  }
  putUmbrella() {
    if (this.stand && G.furn.includes(this.stand)) { this.stand.umb++; this.standUid = this.stand.uid; }
    else this.wet = true;
    this.stand = null;
    this.startShopping();
  }
  startShopping() {
    this.state = 'think';
    this.timer = 1.1;
    const h = G.hero;
    const style = SLOTS.filter(([s]) => (h[s] || 'none') !== 'none').length + SLOTS.filter(([s]) => fashionOf(s, h[s]).cost > 0).length;
    if (style >= 3 && chance(0.2)) { this.mood += 0.3; this.say(pick(SAY.stylish), 1.6); }
    else if (this.want) this.sayIcon(KINDS[this.want].icon, '?', 1.6);
    else if (chance(0.3)) this.say(pick(SAY.enter), 1.6);
  }
  browse() {
    if (!this.alive) return;
    const ds = Shop.displays().filter((f) => !this.visited.has(f.uid));
    if (this.basket.length >= this.maxItems || this.visitsLeft <= 0 || !ds.length) { this.finishShopping(); return; }
    if (!this.wandered && chance(0.2)) {
      this.wandered = true;
      for (let k = 0; k < 8; k++) {
        const x = rint(0, Shop.W - 1), y = rint(0, Shop.H - 1);
        if (Shop.walk(x, y)) {
          this.state = 'browse';
          if (this.goto(x, y, () => { this.state = 'think'; this.timer = rfloat(0.3, 0.8); }, null)) return;
        }
      }
    }
    const w = {};
    ds.forEach((f, i) => {
      let v = 1 / (1 + dist(this.x, this.y, f.x + 1, f.y + 1));
      if (this.want && FURN[f.type].display === KINDS[this.want].store) v *= 3;
      w[i] = v;
    });
    const f = ds[+pickWeighted(w)];
    this.visited.add(f.uid);
    this.visitsLeft--;
    const acc = Shop.access(f);
    if (!acc.length) { this.browse(); return; }
    const a = pick(acc);
    this.state = 'browse';
    this.goto(a.x, a.y, () => { this.state = 'look'; this.target = f; this.timer = rfloat(1.0, 2.0); this.faceTo(f); },
      () => this.browse());
  }
  evaluate() {
    const f = this.target;
    this.target = null;
    this.state = 'think';
    this.timer = rfloat(0.3, 0.6);
    if (!f || !G.furn.includes(f)) return;
    if (!f.slots.some((s) => s.n > 0)) {
      this.mood -= 0.5;
      if (!this.said.empty) { this.said.empty = 1; this.say(pick(SAY.empty), 1.5); }
      return;
    }
    const dirt = G.litter.filter((l) => l.y < Shop.H).length + G.puddles.length * 0.5;
    if (dirt >= 3 && !this.said.dirty) {
      this.said.dirty = 1;
      this.mood -= dirt >= 8 ? 1.4 : 0.8;
      this.say(pick(G.puddles.length > 3 ? SAY.wet : SAY.dirty), 1.6);
      return;
    }
    const W = WEATHER[G.weather];
    const order = shuffle(f.slots.map((s, i) => i));
    for (const i of order) {
      const s = f.slots[i];
      if (this.basket.length >= this.maxItems) break;
      if (s.n <= 0) continue;
      const p = prod(s.pid);
      if (!p) continue;
      const price = priceOf(s.pid), r = price / p.fair;
      if (price > this.budget - this.spent) continue;
      const wantMatch = this.want === p.kind;
      let base = wantMatch ? (this.gotWant ? 0.25 : 0.9) : 0.11 * p.appeal * (W.want[p.kind] || 1);
      const S = SPECIES[this.look.sp];
      const fav = p.tags.some((t) => (S.likes || []).includes(t)) || (S.kinds || []).includes(p.kind);
      if (fav) base *= 1.5;
      const pf = r <= 0.8 ? 1.25 : r <= 1.0 ? 1.0 : r <= 1.2 ? 0.62 : r <= 1.5 ? 0.28 : r <= 2 ? 0.07 : 0.01;
      if (chance(clamp(base * pf, 0, 0.95))) {
        let k = 1;
        if (wantMatch && s.n >= 2 && chance(0.25) && price * 2 <= this.budget - this.spent && this.basket.length + 2 <= this.maxItems + 1) k = 2;
        for (let j = 0; j < k; j++) this.basket.push({ pid: s.pid, price, cost: p.cost });
        s.n -= k;
        FX.fly(s.pid, f.x + FURN[f.type].w / 2, f.y + 0.3, this.x, this.y - 0.4, 0.35);
        if (s.n <= 0) { s.n = 0; s.pid = null; }
        this.mood += 0.3;
        if (wantMatch && !this.gotWant) { this.gotWant = true; this.mood += 1.5; }
        if (r <= 0.8) { this.mood += 0.8; this.say(pick(SAY.cheap), 1.5); }
        else if (p.orig && p.art && chance(0.65)) { this.mood += 1.2; this.say(pick(SAY.cute), 1.6); }
        else if (p.orig && chance(0.5)) { this.mood += 0.8; this.say(pick(SAY.orig), 1.6); }
        else if (fav && chance(0.4)) { this.mood += 0.4; this.say(pick(SAY.fav), 1.4); }
      } else if (r > 1.25 && (wantMatch || chance(0.4)) && !this.said.pricey) {
        this.said.pricey = 1;
        this.mood -= r > 1.7 ? 1.2 : 0.6;
        this.say(pick(r > 1.7 ? SAY.tooPricey : SAY.pricey), 1.6);
      }
    }
  }
  finishShopping() {
    if (this.surveyPlan == null && G.furn.some((f) => f.type === 'survey')) this.surveyPlan = chance(this.want && !this.gotWant ? 0.75 : 0.15);
    if (this.want && !this.gotWant && !this.said.noWant) {
      this.said.noWant = 1;
      this.mood -= 1.0;
      this.say(pick(SAY.noWant), 1.8);
    }
    if (this.basket.length) {
      this.state = 'queue';
      R.queue.push(this);
      this.qi = R.queue.length - 1;
      this.goQueue();
    } else this.leave();
  }
  goQueue() {
    const s = Shop.qspot(this.qi);
    if (!s) { this.arrived = true; return; }
    this.arrived = false;
    const tx = Math.floor(s.x), ty = Math.floor(s.y);
    this.goto(tx, ty, () => {
      this.arrived = true;
      this.x = s.x; this.y = s.y;
      this.dir = 'u';
    }, () => { this.arrived = true; });
  }
  giveUp() {
    this.angry = true;
    this.mood -= 3;
    this.say(pick(SAY.angry), 2);
    Sound.play('sad');
    for (const b of this.basket) G.stock[b.pid] = (G.stock[b.pid] || 0) + 1;
    this.basket = [];
    R.queue = R.queue.filter((c) => c !== this);
    this.leave();
  }
  paid() {
    this.state = 'after';
    this.mood += 0.5;
    if (this.mood >= 0) this.say(pick(SAY.thanks), 1.8);
    if (Math.random() < 0.3) Sound.play(chance(0.5) ? 'meow' : 'meowHi');
    const edible = this.basket.find((b) => { const p = prod(b.pid); return p && ['food', 'drink', 'ice'].includes(p.kind); });
    if (edible && chance(0.35)) {
      const trash = G.furn.filter((f) => f.type === 'trash');
      let spot = null;
      if (trash.length) {
        const acc = Shop.access(pick(trash));
        if (acc.length) spot = pick(acc);
      }
      if (!spot) {
        const d = Shop.doorIn();
        for (let k = 0; k < 10 && !spot; k++) {
          const x = d.x + rint(-3, 3), y = d.y - rint(0, 2);
          if (Shop.interior(x, y) && Shop.walk(x, y)) spot = { x, y };
        }
      }
      if (spot) {
        this.state = 'toEat';
        this.eatPid = edible.pid;
        this.goto(spot.x, spot.y, () => { this.state = 'eat'; this.eating = this.eatPid; this.timer = 2.4; this.dir = 'd'; },
          () => this.leave());
        return;
      }
    }
    this.leave();
  }
  throwTrash() {
    this.eating = null;
    const tr = G.furn.find((f) => f.type === 'trash' && dist(f.x + 0.5, f.y + 0.5, this.x, this.y) < 1.4);
    if (tr && tr.fill < TRASH_CAP) tr.fill++;
    else {
      if (G.litter.length < 30) G.litter.push({ x: this.x + rfloat(-0.25, 0.25), y: this.y + rfloat(-0.05, 0.2) });
      if (tr) { this.mood -= 0.5; this.say('ゴミ箱がいっぱい…', 1.5); }
    }
    this.leave();
  }
  leave() {
    if (this.standUid != null) {
      const st = G.furn.find((f) => f.uid === this.standUid);
      const acc = st ? Shop.access(st) : [];
      this.standUid = null;
      if (st && acc.length) {
        const a = pick(acc);
        this.state = 'toStand2';
        this.goto(a.x, a.y, () => { st.umb = Math.max(0, st.umb - 1); this.leave(); }, () => this.leave());
        return;
      }
    }
    if (this.surveyPlan && !this.angry && !this.wroteSurvey) {
      this.wroteSurvey = true;
      const sv = G.furn.find((f) => f.type === 'survey');
      const acc = sv ? Shop.access(sv) : [];
      if (acc.length) {
        const a = pick(acc);
        this.state = 'toSurvey';
        this.goto(a.x, a.y, () => { this.state = 'write'; this.timer = 1.8; this.faceTo(sv); this.sayIcon('📝', '…', 1.8); }, () => this.leave());
        return;
      }
    }
    this.settle();
    this.state = 'exit';
    const o = Shop.doorOut();
    const out = () => { this.shopper = false; this.passBy(); };
    this.goto(o.x, o.y, out, () => { this.x = o.x + 0.5; this.y = o.y + 0.5; out(); });
  }
  /* 帰るときに、満足したかで評判が動く */
  settle() {
    if (this.settled) return;
    this.settled = true;
    G.today.customers++;
    G.stats.customers++;
    const m = this.mood;
    if (this.angry) { addRep(-1.6); G.today.sad++; }
    else if (m >= 1.5) { addRep(0.7); G.today.happy++; FX.heart(this.x, this.y - 1.1); this.happy = 1.5; }
    else if (m >= 0) addRep(0.2);
    else { addRep(-0.6); G.today.sad++; }
  }
}
