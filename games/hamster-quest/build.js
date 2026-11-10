/* =========================================================================
   ハムスターの冒険 ― 建築と機械
   B キーで建築モード。水車で力をつくり、軸とベルトで機械へおくる。
   建てた物は G.builds に入り、セーブに残る。地図には kind: 'build' の
   建物として入るので、当たり判定や「しらべる」は ほかの建物と同じしくみで動く。
   ========================================================================= */
'use strict';

const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const DIR_ARROW = ['→', '↓', '←', '↑'];
const BELT_SPEED = 46;
let BUILD_ID = 1;

const Build = {
  active: false, sel: 'belt', dir: 0, at: new Map(), powT: 0, ghost: null, touchAt: null,

  /* ------------------------------ 地図に入れる ------------------------------ */
  attach(m) {
    const G = Game.G;
    this.at.clear();
    m.structs = m.structs.filter((s) => s.kind !== 'build');
    for (const b of G.builds) { BUILD_ID = Math.max(BUILD_ID, (b.id || 0) + 1); this.addStruct(m, b); }
    if (G.bedAt) World.rests.bed = { x: G.bedAt.x, y: G.bedAt.y, name: 'わらのベッド' };
    World.rebuildSolid(m);
    this.power();
  },
  addStruct(m, b) {
    const d = BUILDS[b.k];
    const s = { kind: 'build', b, x: b.x, y: b.y, w: d.w, h: d.h, solid: !d.flat, flat: !!d.flat, act: 'build' };
    Object.defineProperty(b, 's', { value: s, writable: true, enumerable: false, configurable: true });
    m.structs.push(s);
    this.each(b, (i) => this.at.set(i, b));
  },
  each(b, fn) {
    const d = BUILDS[b.k], W = World.over.w;
    for (let y = b.y; y < b.y + d.h; y++) for (let x = b.x; x < b.x + d.w; x++) fn(y * W + x, x, y);
  },
  /* セーブ用: 地図への参照を外した中身だけ */
  saveData() {
    return Game.G.builds.map((b) => ({ id: b.id, k: b.k, x: b.x, y: b.y, dir: b.dir, store: b.store, buf: b.buf, out: b.out, grow: b.grow }));
  },
  load(list) {
    return (list || []).filter((b) => BUILDS[b.k]).map((b) => Object.assign({ dir: 0 }, b, BUILDS[b.k].recipes ? { buf: b.buf || {}, out: b.out || [], prog: 0 } : {}, BUILDS[b.k].store ? { store: b.store || {} } : {}));
  },

  /* ------------------------------ 建築モード ------------------------------ */
  toggle(on) {
    const G = Game.G;
    const want = on === undefined ? !this.active : on;
    if (want && G.map.kind !== 'over') { toast('建てられるのは 外の世界だけ'); return; }
    this.active = want;
    this.touchAt = null;
    document.body.classList.toggle('building', want);
    UI.buildBar(want);
    if (want) toast(Input.isTouch ? '建てたい所を タップ。もう一度 🔨 でおわる' : 'クリックで建てる・R で向きをかえる・B でおわる');
  },
  select(k) { this.sel = k; this.touchAt = null; UI.buildBar(true); Sfx.click(); },
  rotate() { this.dir = (this.dir + 1) % 4; Sfx.click(); UI.buildBar(true); },

  /* 建築モードのときの入力。true を返したら 攻撃などには使わない */
  input() {
    const G = Game.G;
    if (!this.active) return false;
    if (G.map.kind !== 'over') { this.toggle(false); return false; }
    if (Input.hit('r')) this.rotate();
    let click = null;
    if (Input.mouse.clicked) click = R.toWorld(Input.mouse.x, Input.mouse.y);
    if (Input.tap) click = R.toWorld(Input.tap.x, Input.tap.y);
    const aim = click || (Input.isTouch ? this.touchAt : R.toWorld(Input.mouse.x, Input.mouse.y));
    this.ghost = aim ? this.ghostAt(aim) : null;
    if (click) {
      const t = this.ghostAt(click);
      if (this.sel === 'remove') this.removeAt(t.x, t.y);
      else if (Input.isTouch && (!this.touchAt || Math.floor(this.touchAt.x / TILE) !== Math.floor(click.x / TILE) || Math.floor(this.touchAt.y / TILE) !== Math.floor(click.y / TILE))) {
        /* スマホは 1 回目のタップで場所をえらび、同じ場所をもう一度タップで建てる */
        this.touchAt = click;
      } else this.place(this.sel, t.x, t.y, this.dir);
    }
    return true;
  },
  ghostAt(w) {
    if (this.sel === 'remove') return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE), w: 1, h: 1 };
    const d = BUILDS[this.sel];
    return { x: Math.floor(w.x / TILE - d.w / 2 + 0.5), y: Math.floor(w.y / TILE - d.h / 2 + 0.5), w: d.w, h: d.h };
  },

  /* ------------------------------ 建てる・こわす ------------------------------ */
  canPlace(k, x, y) {
    const G = Game.G, m = G.map, d = BUILDS[k];
    if (m.kind !== 'over') return '外の世界にしか 建てられない';
    for (let ty = y; ty < y + d.h; ty++) for (let tx = x; tx < x + d.w; tx++) {
      if (tx < 1 || ty < 1 || tx >= m.w - 1 || ty >= m.h - 1) return 'ここには 建てられない';
      const i = ty * m.w + tx;
      if (tileSolid(m.tiles[i])) return '水や崖の上には 建てられない';
      if (this.at.has(i)) return 'もう 何か建っている';
      if (m.nodes.has(i)) return '木や草や岩が じゃま（たたいて とりのぞこう）';
      if (m.solid[i]) return 'じゃまな物がある';
      const rg = World.regionAt(m, tx * TILE, ty * TILE);
      if (rg && REGIONS[rg].safe) return '町の中には 建てられない';
    }
    for (const s of m.structs) {
      if (s.kind === 'build') continue;
      if (x < s.x + s.w && x + d.w > s.x && y < s.y + s.h && y + d.h > s.y) return 'じゃまな物がある';
    }
    if (d.water) {
      let wet = false;
      for (let ty = y - 1; ty <= y + d.h; ty++) for (let tx = x - 1; tx <= x + d.w; tx++) if (World.tileAt(m, tx, ty) === T.WATER) wet = true;
      if (!wet) return '水車は 水のとなりに 建てよう';
    }
    if (!d.flat) {
      const p = G.p;
      if (p.x + 8 > x * TILE && p.x - 8 < (x + d.w) * TILE && p.y + 8 > y * TILE && p.y - 8 < (y + d.h) * TILE) return 'ハムスターが じゃま。少し はなれよう';
    }
    if (!Game.hasAll(d.cost)) return '材料が たりない';
    return null;
  },
  place(k, x, y, dir) {
    const G = Game.G, m = G.map, d = BUILDS[k];
    const why = this.canPlace(k, x, y);
    if (why) { toast(why, 'bad'); Sfx.error(); return false; }
    for (const id in d.cost) Game.remove(id, d.cost[id]);
    const b = { id: BUILD_ID++, k, x, y, dir: d.dir ? dir : 0 };
    if (d.recipes) { b.buf = {}; b.out = []; b.prog = 0; }
    if (d.store) b.store = {};
    if (k === 'field') b.grow = 0;
    G.builds.push(b);
    this.addStruct(m, b);
    World.rebuildSolid(m);
    this.power();
    Sfx.build();
    FX.burst((x + d.w / 2) * TILE, (y + d.h / 2) * TILE, '#c8a070', 10, 60, 0.5);
    Game.refreshObjective();
    return true;
  },
  removeAt(tx, ty) {
    const G = Game.G, m = G.map;
    const b = this.at.get(ty * m.w + tx);
    if (!b) { toast('ここには 建てた物がない'); return; }
    const d = BUILDS[b.k];
    const cx = (b.x + d.w / 2) * TILE, cy = (b.y + d.h / 2) * TILE;
    for (const id in d.cost) Game.give(id, d.cost[id], cx, cy);
    const dump = (bag) => { for (const id in bag || {}) if (bag[id] > 0) Game.drop(cx, cy, id, bag[id]); };
    dump(b.store); dump(b.buf);
    for (const id of b.out || []) Game.drop(cx, cy, id, 1);
    G.bitems = G.bitems.filter((it) => this.at.get(Math.floor(it.y / TILE) * m.w + Math.floor(it.x / TILE)) !== b || (Game.drop(it.x, it.y, it.item, 1), false));
    this.each(b, (i) => this.at.delete(i));
    G.builds = G.builds.filter((x) => x !== b);
    m.structs = m.structs.filter((s) => s.b !== b);
    if (b.k === 'bed' && G.bedAt && G.bedAt.x === b.x && G.bedAt.y + 1 === b.y + d.h) { G.bedAt = null; delete World.rests.bed; if (G.rest === 'bed') G.rest = 'home'; }
    World.rebuildSolid(m);
    this.power();
    Sfx.chop();
    FX.burst(cx, cy, '#c8a070', 8, 60, 0.5);
  },

  /* ------------------------------ 力 ------------------------------ */
  isPow(b) { const d = BUILDS[b.k]; return !!(d.power || d.conduct || d.use); },
  power() {
    const G = Game.G, W = World.over.w;
    for (const b of G.builds) b.pow = 0;
    const seen = new Set();
    for (const src of G.builds) {
      if (!BUILDS[src.k].power || seen.has(src)) continue;
      const net = [], q = [src];
      while (q.length) {
        const cur = q.pop();
        if (seen.has(cur)) continue;
        seen.add(cur); net.push(cur);
        this.each(cur, (i, x, y) => {
          for (let k = 0; k < 4; k++) {
            const nb = this.at.get((y + DY[k]) * W + x + DX[k]);
            if (nb && nb !== cur && !seen.has(nb) && this.isPow(nb)) q.push(nb);
          }
        });
      }
      let sup = 0, dem = 0;
      for (const b of net) { sup += BUILDS[b.k].power || 0; dem += BUILDS[b.k].use || 0; }
      const k = dem > 0 ? Math.min(1, sup / dem) : 1;
      for (const b of net) { b.pow = k; b.net = { sup, dem }; }
    }
  },

  /* ------------------------------ うごき ------------------------------ */
  front(b) {
    const d = BUILDS[b.k], r = b.dir;
    const fx = r === 0 ? b.x + d.w : r === 2 ? b.x - 1 : b.x + Math.floor((d.w - 1) / 2);
    const fy = r === 1 ? b.y + d.h : r === 3 ? b.y - 1 : b.y + Math.floor((d.h - 1) / 2);
    return { x: fx, y: fy };
  },
  accepts(b, item) {
    const d = BUILDS[b.k];
    if (d.store) { let n = 0; for (const k in b.store) n += b.store[k]; return n < 400; }
    if (d.recipes) return d.recipes.some((r) => r.in[item]) && (b.buf[item] || 0) < 20;
    return false;
  },
  insert(b, item, n = 1) {
    const bag = BUILDS[b.k].store ? b.store : b.buf;
    bag[item] = (bag[item] || 0) + n;
  },
  freeAt(x, y) { for (const it of Game.G.bitems) if (Math.abs(it.x - x) < 13 && Math.abs(it.y - y) < 13) return false; return true; },
  /* 機械や箱の前へ 1 こ だす */
  output(b, item, toGround) {
    const G = Game.G, W = World.over.w, f = this.front(b);
    const nb = this.at.get(f.y * W + f.x);
    const cx = f.x * TILE + 16, cy = f.y * TILE + 16;
    if (nb && nb.k === 'belt') {
      if (!this.freeAt(cx, cy)) return false;
      G.bitems.push({ item, x: cx, y: cy });
      return true;
    }
    if (nb && nb !== b && this.accepts(nb, item)) { this.insert(nb, item); return true; }
    if (toGround && !nb) { Game.drop(cx, cy - 4, item, 1, { vx: 0, vy: 0, delay: 0.4 }); return true; }
    return false;
  },

  update(dt) {
    const G = Game.G;
    this.powT += dt;
    if (this.powT > 0.5) { this.powT = 0; this.power(); }
    for (const b of G.builds) {
      const d = BUILDS[b.k];
      b.anim = (b.anim || 0) + dt * (b.pow || 0);
      if (d.recipes) {
        if (!b.out.length && b.pow > 0) {
          const r = d.recipes.find((rr) => Object.keys(rr.in).every((k) => (b.buf[k] || 0) >= rr.in[k]));
          if (r) {
            b.prog += dt * b.pow;
            if (b.prog >= r.t) {
              for (const k in r.in) b.buf[k] -= r.in[k];
              for (let i = 0; i < r.out[1]; i++) b.out.push(r.out[0]);
              b.prog = 0;
            }
          } else b.prog = 0;
        }
        b.emitT = (b.emitT || 0) - dt;
        if (b.out.length && b.emitT <= 0 && this.output(b, b.out[0], true)) { b.out.shift(); b.emitT = 0.35; }
      } else if (d.store) {
        b.emitT = (b.emitT || 0) - dt;
        const f = this.front(b), nb = this.at.get(f.y * World.over.w + f.x);
        if (b.emitT <= 0 && nb && nb.k === 'belt' && nb.pow > 0) {
          const id = Object.keys(b.store).find((k) => b.store[k] > 0);
          if (id && this.output(b, id, false)) { b.store[id]--; if (!b.store[id]) delete b.store[id]; b.emitT = 0.6; }
        }
      } else if (b.k === 'field') b.grow = Math.min(90, (b.grow || 0) + dt);
      else if (b.k === 'belt' && b.feed && b.feed.length && b.pow > 0) {
        const cx = b.x * TILE + 16, cy = b.y * TILE + 16;
        if (this.freeAt(cx, cy)) { G.bitems.push({ item: b.feed[0].item, x: cx, y: cy }); if (--b.feed[0].n <= 0) b.feed.shift(); }
      }
    }
    if (G.map.kind === 'over') { this.catchDrops(); this.carryPlayer(dt); }
    this.moveItems(dt);
  },

  /* ベルトの上に すてた物は、ベルトにのる */
  catchDrops() {
    const G = Game.G, W = World.over.w;
    for (let i = G.drops.length - 1; i >= 0; i--) {
      const d = G.drops[i];
      if (!d.item || d.delay <= 0) continue;
      const b = this.at.get(Math.floor(d.y / TILE) * W + Math.floor(d.x / TILE));
      if (!b || b.k !== 'belt') continue;
      (b.feed = b.feed || []).push({ item: d.item, n: d.n });
      G.drops.splice(i, 1);
    }
  },
  carryPlayer(dt) {
    const G = Game.G, p = G.p, W = World.over.w;
    if (p.roll >= 0 || p.high) return;
    const b = this.at.get(Math.floor(p.y / TILE) * W + Math.floor(p.x / TILE));
    if (!b || b.k !== 'belt' || !(b.pow > 0)) return;
    World.move(G.map, p, DX[b.dir] * BELT_SPEED * b.pow * dt, DY[b.dir] * BELT_SPEED * b.pow * dt, 8);
  },
  moveItems(dt) {
    const G = Game.G, W = World.over.w, list = G.bitems;
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      const tx = Math.floor(it.x / TILE), ty = Math.floor(it.y / TILE);
      const b = this.at.get(ty * W + tx);
      if (!b || b.k !== 'belt') { list.splice(i, 1); Game.drop(it.x, it.y, it.item, 1, { vx: 0, vy: 0, delay: 0 }); continue; }
      if (!(b.pow > 0)) continue;
      const d = b.dir, sp = BELT_SPEED * b.pow * dt;
      const cx = tx * TILE + 16, cy = ty * TILE + 16;
      if (DX[d]) it.y += (cy - it.y) * Math.min(1, dt * 8); else it.x += (cx - it.x) * Math.min(1, dt * 8);
      let blocked = false;
      for (const o of list) {
        if (o === it) continue;
        const ox = o.x - it.x, oy = o.y - it.y;
        const along = ox * DX[d] + oy * DY[d], side = Math.abs(ox * DY[d] - oy * DX[d]);
        if (along > 0 && along < 13 && side < 9) { blocked = true; break; }
      }
      if (blocked) continue;
      const nx = it.x + DX[d] * sp, ny = it.y + DY[d] * sp;
      const ntx = Math.floor(nx / TILE), nty = Math.floor(ny / TILE);
      if (ntx === tx && nty === ty) { it.x = nx; it.y = ny; continue; }
      const nb = this.at.get(nty * W + ntx);
      if (nb && nb.k === 'belt') { it.x = nx; it.y = ny; }
      else if (nb && this.accepts(nb, it.item)) { this.insert(nb, it.item); list.splice(i, 1); }
    }
  },

  /* ------------------------------ しらべる ------------------------------ */
  act(s) {
    const b = s.b, d = BUILDS[b.k];
    if (d.recipes) return { label: '材料を入れる', fn: () => this.feed(b) };
    if (d.store) return { label: 'あける', fn: () => UI.openBox(b) };
    if (b.k === 'bed') return { label: 'ねむる', fn: () => { Game.G.bedAt = { x: b.x, y: b.y + d.h - 1 }; World.rests.bed = { x: b.x, y: b.y + d.h, name: 'わらのベッド' }; Game.rest('bed'); } };
    if (b.k === 'field') return b.grow >= 90 ? { label: 'しゅうかく', fn: () => this.harvest(b) } : null;
    if (b.k === 'waterwheel') return { label: 'しらべる', fn: () => UI.talk(d.name, [`まわる力 ${d.power}。いま この水車から つながっている機械は 力を ${b.net ? b.net.dem.toFixed(1) : 0} つかっている。`, '力がたりないと 機械がゆっくりになる。水車をふやして 軸でつなごう。']) };
    return null;
  },
  feed(b) {
    const G = Game.G, d = BUILDS[b.k];
    let put = 0;
    for (const r of d.recipes) for (const id in r.in) {
      const n = Math.min(Game.count(id), 20 - (b.buf[id] || 0));
      if (n > 0) { Game.remove(id, n); this.insert(b, id, n); put += n; }
    }
    const recipes = d.recipes.map((r) => Object.entries(r.in).map(([k, v]) => `${ITEMS[k].name}${v}`).join('+') + ` → ${ITEMS[r.out[0]].name}${r.out[1]}`).join('、');
    const powTxt = !(b.pow > 0) ? '力が来ていない！ 水車から 軸かベルトで つなごう。' : b.pow < 1 ? '力が すこし たりない（ゆっくり動いている）。' : '力は じゅうぶん。';
    if (put) { toast(`${d.name}に 材料を ${put}こ 入れた`, 'good'); Sfx.pickup(); }
    else UI.talk(d.name, [`つくれる物：${recipes}`, `${powTxt} できた物は 前（${DIR_ARROW[b.dir]}）に出てくる。ベルトでつなぐと 自動で はこべる。`]);
  },
  harvest(b) {
    const n = randi(2, 4);
    Game.give('seed', n, (b.x + 0.5) * TILE, (b.y + 0.5) * TILE);
    b.grow = 0;
    Sfx.pickup();
    toast(`ひまわりのタネを ${n}こ とった！`, 'good');
  },
};

/* ================================ 絵 ================================ */
function drawBuild(g, b, t, ghost) {
  const d = BUILDS[b.k], x = b.x * TILE, y = b.y * TILE, w = d.w * TILE, h = d.h * TILE;
  const cx = x + w / 2, by = y + h, a = ghost ? 0 : (b.anim || 0);
  const wood = '#b07a42', woodD = '#7a4a24', woodL = '#d0a060';
  switch (b.k) {
    case 'waterwheel': {
      /* 大きな水車。ハムスターの何倍もある */
      shadow(g, cx, by, w * 0.55, 10);
      rrect(g, x + 4, by - 40, w - 8, 36, 4, woodD, INK, 2);
      for (const px of [x + 14, x + w - 22]) rrect(g, px, by - 120, 8, 116, 2, wood, INK, 1.6);
      const wy = by - 76, R0 = 54;
      g.save(); g.translate(cx, wy); g.rotate(a * 1.6);
      circ(g, 0, 0, R0, null, woodD, 7); circ(g, 0, 0, R0, null, woodL, 3.5);
      circ(g, 0, 0, R0 * 0.55, null, woodD, 4);
      for (let i = 0; i < 12; i++) {
        g.rotate(TAU / 12);
        line(g, 0, 0, R0, 0, woodD, 3);
        rrect(g, R0 - 6, -7, 14, 14, 2, wood, INK, 1.2);
      }
      circ(g, 0, 0, 9, woodL, INK, 1.6);
      g.restore();
      rrect(g, cx - 40, wy - 4, 80, 8, 3, wood, INK, 1.4);
      if (!ghost && b.pow > 0) {
        g.globalAlpha = 0.6;
        for (let i = 0; i < 5; i++) { const k = (t * 1.5 + i * 0.2) % 1; circ(g, cx + R0 * 0.8 - k * 10, wy + R0 * 0.6 + k * 26, 3 - k * 2, '#d8f4ff'); }
        g.globalAlpha = 1;
      }
      break;
    }
    case 'shaft': {
      const W = World.over.w;
      const side = (k) => { const nb = Build.at.get((b.y + DY[k]) * W + b.x + DX[k]); return nb && Build.isPow(nb); };
      const horiz = side(0) || side(2) || !(side(1) || side(3));
      g.save(); g.translate(x + 16, y + 16); if (!horiz) g.rotate(Math.PI / 2);
      rrect(g, -16, -4, 32, 8, 3, wood, INK, 1.2);
      const k = (a * 30) % 8;
      for (let i = -16 + k; i < 16; i += 8) line(g, i, -4, i, 4, woodD, 1.4);
      g.restore();
      break;
    }
    case 'belt': {
      rrect(g, x + 1, y + 1, 30, 30, 4, '#6a4a2a', INK, 1.2);
      g.save(); g.beginPath(); g.rect(x + 4, y + 4, 24, 24); g.clip();
      g.translate(x + 16, y + 16); g.rotate(b.dir * Math.PI / 2);
      const k = (a * BELT_SPEED) % 8;
      g.fillStyle = '#a8743f'; g.fillRect(-12, -12, 24, 24);
      for (let i = -16 + k; i < 16; i += 8) { g.fillStyle = '#8a5a2e'; g.fillRect(i, -12, 3, 24); }
      g.fillStyle = 'rgba(255,240,200,.75)'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('›', 0, 0);
      g.restore();
      break;
    }
    case 'sawmill': case 'spinner': case 'mill': {
      shadow(g, cx, by, w * 0.55, 8);
      rrect(g, x + 3, by - h - 10, w - 6, h + 6, 5, wood, INK, 2);
      rrect(g, x + 3, by - h - 18, w - 6, 12, 4, woodD, INK, 1.6);
      for (let i = 1; i < 3; i++) line(g, x + 5, by - h - 10 + i * (h + 6) / 3, x + w - 5, by - h - 10 + i * (h + 6) / 3, 'rgba(60,30,10,.35)', 1.2);
      const gx = cx, gy = by - h / 2 - 6;
      if (b.k === 'sawmill') {
        g.save(); g.translate(gx, gy - 6); g.rotate(a * 8);
        circ(g, 0, 0, 13, '#d8d0c0', INK, 1.4);
        for (let i = 0; i < 10; i++) { g.rotate(TAU / 10); poly(g, [12, -2, 17, 0, 12, 2], '#d8d0c0', INK, 0.8); }
        circ(g, 0, 0, 3, woodD);
        g.restore();
      } else if (b.k === 'spinner') {
        g.save(); g.translate(gx, gy - 6); g.rotate(a * 4);
        circ(g, 0, 0, 15, null, woodD, 3);
        for (let i = 0; i < 6; i++) { g.rotate(TAU / 6); line(g, 0, 0, 15, 0, woodD, 1.6); }
        g.restore();
        circ(g, gx + 18, gy + 6, 5, '#f4ecdd', INK, 1);
      } else {
        ell(g, gx, gy, 18, 9, '#a8a094', INK, 1.6);
        g.save(); g.translate(gx, gy - 6); g.scale(1, 0.5); g.rotate(a * 3);
        circ(g, 0, 0, 16, '#bab2a6', INK, 1.4); line(g, -16, 0, 16, 0, '#8a8276', 1.4); line(g, 0, -16, 0, 16, '#8a8276', 1.4);
        g.restore();
        line(g, gx, gy - 6, gx, gy - 26, woodD, 3);
      }
      /* 歯車 */
      g.save(); g.translate(x + 12, by - 12); g.rotate(-a * 4);
      circ(g, 0, 0, 7, woodL, INK, 1.1);
      for (let i = 0; i < 8; i++) { g.rotate(TAU / 8); g.fillStyle = woodL; g.fillRect(6, -1.5, 3, 3); }
      g.restore();
      if (!ghost) {
        g.font = '13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.icon, x + w - 12, by - h - 12);
        if (!(b.pow > 0)) { g.globalAlpha = 0.6 + Math.sin(t * 4) * 0.3; g.fillText('💤', x + w - 10, by - h - 30); g.globalAlpha = 1; }
      }
      drawFrontArrow(g, b);
      break;
    }
    case 'box': {
      shadow(g, x + 16, by - 2, 13, 4);
      rrect(g, x + 3, by - 26, 26, 24, 3, wood, INK, 1.6);
      line(g, x + 3, by - 14, x + 29, by - 14, woodD, 1.6);
      rrect(g, x + 1, by - 30, 30, 7, 2, woodL, INK, 1.4);
      if (!ghost) { let n = 0; for (const k in b.store) n += b.store[k]; if (n) { g.fillStyle = INK; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, x + 16, by - 8); } }
      drawFrontArrow(g, b);
      break;
    }
    case 'bed': {
      shadow(g, cx, by - 2, w * 0.5, 5);
      rrect(g, x + 3, by - 22, w - 6, 20, 4, woodD, INK, 1.6);
      rrect(g, x + 6, by - 26, w - 12, 14, 5, '#f0d880', INK, 1.3);
      for (let i = 0; i < 6; i++) line(g, x + 10 + i * 8, by - 24, x + 12 + i * 8, by - 14, 'rgba(160,120,40,.5)', 1);
      ell(g, x + 14, by - 22, 8, 5, '#fff4dc', INK, 1.1);
      break;
    }
    case 'field': {
      rrect(g, x + 1, y + 1, 30, 30, 3, '#7a5232', 'rgba(60,30,10,.5)', 1);
      g.fillStyle = 'rgba(40,20,5,.3)'; for (let i = 0; i < 3; i++) g.fillRect(x + 3, y + 6 + i * 9, 26, 2);
      const k = ghost ? 0 : (b.grow || 0) / 90;
      if (k < 0.99) {
        const hgt = 4 + k * 18;
        line(g, x + 16, y + 26, x + 16, y + 26 - hgt, '#4a8a2e', 2);
        ell(g, x + 12, y + 26 - hgt * 0.6, 4, 2, '#5aa83e'); ell(g, x + 20, y + 26 - hgt * 0.8, 4, 2, '#5aa83e');
        if (k > 0.6) circ(g, x + 16, y + 26 - hgt, 4, '#c8b030', INK, 0.8);
      } else {
        Art.blit(g, nodeSprite('sunflower', 0, false), x + 16, y + 28);
      }
      break;
    }
    case 'fence': {
      rrect(g, x + 12, by - 26, 8, 26, 2, wood, INK, 1.3);
      rrect(g, x, by - 22, 32, 5, 2, woodL, INK, 1.1);
      rrect(g, x, by - 12, 32, 5, 2, woodL, INK, 1.1);
      break;
    }
    case 'floor': {
      for (let i = 0; i < 4; i++) rrect(g, x + 0.5, y + i * 8 + 0.5, 31, 7, 1.5, i % 2 ? '#c89a62' : '#b8884e', 'rgba(60,30,10,.4)', 0.8);
      break;
    }
    case 'lamp': {
      shadow(g, x + 16, by - 4, 6, 2.5);
      line(g, x + 16, by - 4, x + 16, by - 40, woodD, 3.4);
      rrect(g, x + 10, by - 52, 12, 14, 4, '#ffd88a', INK, 1.3);
      if (!ghost) { g.globalAlpha = 0.2 + Math.sin(t * 3 + b.x) * 0.04; circ(g, x + 16, by - 46, 22, '#ffe680'); g.globalAlpha = 1; }
      break;
    }
  }
}
function drawFrontArrow(g, b) {
  const f = Build.front(b);
  const ax = f.x * TILE + 16 - DX[b.dir] * 10, ay = f.y * TILE + 16 - DY[b.dir] * 10;
  g.save(); g.translate(ax, ay); g.rotate(b.dir * Math.PI / 2);
  poly(g, [6, 0, -3, -5, -3, 5], 'rgba(255,230,140,.9)', INK, 1);
  g.restore();
}
/* ベルトの上の物 */
function drawBeltItem(g, it) {
  const icon = ITEMS[it.item].icon;
  const sp = Art.sprite('ic:' + icon, 24, 24, 12, 12, (gg) => {
    gg.font = '17px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText(icon, 0, 1);
  });
  shadow(g, it.x, it.y + 6, 6, 2, 0.25);
  g.drawImage(sp.c, it.x - 9, it.y - 12, 18, 18);
}
/* 建築モードの 置く場所 */
function drawGhost(g, gh, t) {
  const B = Build;
  const ok = B.sel === 'remove' ? !!B.at.get(gh.y * World.over.w + gh.x) : !B.canPlace(B.sel, gh.x, gh.y);
  g.globalAlpha = 0.28 + Math.sin(t * 6) * 0.08;
  rrect(g, gh.x * TILE, gh.y * TILE, gh.w * TILE, gh.h * TILE, 4, ok ? (B.sel === 'remove' ? '#ff9a6a' : '#7aff9a') : '#ff4a4a');
  g.globalAlpha = 1;
  rrect(g, gh.x * TILE, gh.y * TILE, gh.w * TILE, gh.h * TILE, 4, null, ok ? '#ffffff' : '#ff4a4a', 2);
  if (B.sel !== 'remove') {
    g.globalAlpha = 0.6;
    drawBuild(g, { k: B.sel, x: gh.x, y: gh.y, dir: B.dir, grow: 0 }, t, true);
    g.globalAlpha = 1;
  }
}
