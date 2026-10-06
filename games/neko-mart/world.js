/* =========================================================================
   NEKO MART ― お店の形
   マス目 / 家具の置き場所 / 通れるかの確認 / 道さがし / レジの行列
   ========================================================================= */
'use strict';

/* マスの並び (y は上から)
     0 .. H-1   店の中 (x = 0..W-1)。左右の外は隣の建物で通れない
     H          お店の前のかべ。ドアのマスだけ通れる
     H+1, H+2   歩道 (x = -OUT .. W+OUT-1)。看板は H+1 の列に置く  */
const Shop = {
  gw: 0, gh: 0, block: null, fmap: null, qspots: [],

  get W() { return SHOP_SIZES[G.lv].w; },
  get H() { return SHOP_SIZES[G.lv].h; },

  idx(x, y) { return y * this.gw + (x + OUT); },
  inGrid(x, y) { return x >= -OUT && x < this.W + OUT && y >= 0 && y < this.gh; },
  interior(x, y) { return x >= 0 && x < this.W && y >= 0 && y < this.H; },
  walk(x, y) { return this.inGrid(x, y) && !this.block[this.idx(x, y)]; },
  furnAt(x, y) {
    if (!this.inGrid(x, y)) return null;
    const i = this.fmap[this.idx(x, y)];
    return i >= 0 ? G.furn[i] : null;
  },
  doorIn() { return { x: G.door.x, y: this.H - 1 }; },
  doorOut() { return { x: G.door.x, y: this.H + 1 }; },

  rebuild() {
    const W = this.W, H = this.H;
    this.gw = W + OUT * 2;
    this.gh = H + 3;
    const n = this.gw * this.gh;
    this.block = new Uint8Array(n);
    this.fmap = new Int32Array(n).fill(-1);
    for (let y = 0; y < this.gh; y++) {
      for (let x = -OUT; x < W + OUT; x++) {
        let b = 0;
        if (y < H) b = x < 0 || x >= W ? 1 : 0;
        else if (y === H) b = x === G.door.x ? 0 : 1;
        this.block[this.idx(x, y)] = b;
      }
    }
    G.furn.forEach((f, i) => {
      const d = FURN[f.type];
      for (let j = 0; j < d.h; j++) {
        for (let k = 0; k < d.w; k++) {
          if (!this.inGrid(f.x + k, f.y + j)) continue;
          const id = this.idx(f.x + k, f.y + j);
          this.block[id] = 1;
          this.fmap[id] = i;
        }
      }
    });
    for (const s of G.signs) this.block[this.idx(s.x, H + 1)] = 1;
    this.computeQueue();
  },

  /* 家具を使うときに立つマス */
  access(f) {
    const d = FURN[f.type], out = [];
    const add = (x, y) => { if (this.interior(x, y) && this.walk(x, y)) out.push({ x, y }); };
    if (f.type === 'register') { add(f.x, f.y - 1); return out; }
    if (d.w === 1 && d.h === 1) {
      add(f.x, f.y + 1); add(f.x - 1, f.y); add(f.x + 1, f.y); add(f.x, f.y - 1);
      return out;
    }
    for (let k = 0; k < d.w; k++) add(f.x + k, f.y + d.h);
    return out;
  },
  cashTile(reg) { return { x: reg.x, y: reg.y - 1 }; },
  custTile(reg) { return { x: reg.x, y: reg.y + 1 }; },
  register() { return G.furn.find((f) => f.type === 'register'); },
  stockRack() { return G.furn.find((f) => f.type === 'stock'); },
  displays() { return G.furn.filter((f) => FURN[f.type].display); },
  count(type) { let n = 0; for (const f of G.furn) if (f.type === type) n++; return n; },

  /* ドアから全部の家具まで歩いて行けるか。だめなら理由を返す */
  check() {
    const H = this.H;
    const din = this.doorIn(), dout = this.doorOut();
    if (!this.walk(din.x, din.y)) return 'ドアの前はあけておこう';
    if (!this.walk(dout.x, dout.y)) return 'ドアの外はあけておこう';
    const seen = new Uint8Array(this.gw * this.gh);
    const q = [[G.door.x, H]];
    seen[this.idx(G.door.x, H)] = 1;
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.walk(nx, ny)) continue;
        const id = this.idx(nx, ny);
        if (seen[id]) continue;
        seen[id] = 1;
        q.push([nx, ny]);
      }
    }
    const ok = (t) => this.walk(t.x, t.y) && seen[this.idx(t.x, t.y)];
    for (const f of G.furn) {
      const name = FURN[f.type].name;
      if (f.type === 'plant') continue;
      if (f.type === 'register') {
        if (!this.interior(f.x, f.y - 1) || !ok(this.cashTile(f))) return 'レジのうしろに立てる場所がないよ';
        if (!this.interior(f.x, f.y + 1) || !ok(this.custTile(f))) return 'レジの前にお客さんが立てないよ';
        continue;
      }
      if (!this.access(f).some(ok)) return name + 'の前に立てる場所がないよ';
    }
    return null;
  },

  /* 家具の出し入れ。だめなら元にもどして理由を返す */
  canFit(type, x, y, ignore) {
    const d = FURN[type];
    for (let j = 0; j < d.h; j++) {
      for (let k = 0; k < d.w; k++) {
        if (!this.interior(x + k, y + j)) return 'お店の中に置こう';
        const f = this.furnAt(x + k, y + j);
        if (f && f !== ignore) return 'ほかの物とかさなっているよ';
      }
    }
    return null;
  },
  newFurn(type, x, y) {
    const f = this.ghost(type);
    f.uid = G.nextUid++; f.x = x; f.y = y;
    return f;
  },
  /* 置く前の見本 (番号なし) */
  ghost(type) {
    const d = FURN[type];
    const f = { uid: -1, type, x: 0, y: 0 };
    if (d.display) f.slots = Array.from({ length: d.slots }, () => ({ pid: null, n: 0 }));
    if (type === 'trash') f.fill = 0;
    if (type === 'umbrella') f.umb = 0;
    return f;
  },
  place(type, x, y) {
    const why = this.canFit(type, x, y, null);
    if (why) return why;
    const f = this.newFurn(type, x, y);
    G.furn.push(f);
    this.rebuild();
    const bad = this.check();
    if (bad) { G.furn.pop(); this.rebuild(); return bad; }
    return null;
  },
  move(f, x, y) {
    const why = this.canFit(f.type, x, y, f);
    if (why) return why;
    const ox = f.x, oy = f.y;
    f.x = x; f.y = y;
    this.rebuild();
    const bad = this.check();
    if (bad) { f.x = ox; f.y = oy; this.rebuild(); return bad; }
    return null;
  },
  remove(f) {
    const i = G.furn.indexOf(f);
    if (i >= 0) G.furn.splice(i, 1);
    this.rebuild();
  },
  moveDoor(x) {
    if (x < 0 || x >= this.W) return 'ドアはお店の前のかべにつけよう';
    if (G.walls.bottom[x]) return 'そこには ' + WALLS[G.walls.bottom[x].type].name + ' があるよ';
    const ox = G.door.x;
    G.door.x = x;
    this.rebuild();
    const bad = this.check();
    if (bad) { G.door.x = ox; this.rebuild(); return bad; }
    return null;
  },
  placeSign(x, design) {
    if (x < -2 || x > this.W + 1) return 'お店の前の歩道に置こう';
    if (G.signs.some((s) => s.x === x)) return 'もう看板があるよ';
    G.signs.push({ x, design });
    this.rebuild();
    const bad = this.check();
    if (bad) { G.signs.pop(); this.rebuild(); return bad; }
    return null;
  },
  expand() {
    const oldH = this.H;
    G.lv++;
    const W = this.W;
    while (G.walls.top.length < W) G.walls.top.push(null);
    while (G.walls.bottom.length < W) G.walls.bottom.push(null);
    G.litter = G.litter.filter((l) => l.y < oldH);
    G.puddles = G.puddles.filter((p) => p.y < oldH);
    this.rebuild();
  },

  /* 行列のならび。レジの前から下へ、ふさがったら横へ伸ばす */
  computeQueue() {
    this.qspots = [];
    const reg = this.register();
    if (!reg) return;
    const start = this.custTile(reg);
    if (!this.interior(start.x, start.y) || !this.walk(start.x, start.y)) return;
    const din = this.doorIn();
    const used = new Set([start.x + ',' + start.y, reg.x + ',' + (reg.y - 1)]);
    const ok = (x, y) => this.interior(x, y) && this.walk(x, y) && !used.has(x + ',' + y) && !(x === din.x && y === din.y);
    this.qspots.push(start);
    let cx = start.x, cy = start.y, dir = [0, 1];
    while (this.qspots.length < 10) {
      const tries = [dir, [1, 0], [-1, 0], [0, 1], [0, -1]];
      let moved = false;
      for (const [dx, dy] of tries) {
        if (ok(cx + dx, cy + dy)) {
          cx += dx; cy += dy; dir = [dx, dy];
          used.add(cx + ',' + cy);
          this.qspots.push({ x: cx, y: cy });
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
  },
  qspot(i) {
    const s = this.qspots[Math.min(i, this.qspots.length - 1)];
    if (!s) return null;
    const extra = Math.max(0, i - this.qspots.length + 1);
    return { x: s.x + 0.5 + extra * 0.18, y: s.y + 0.5 + extra * 0.1 };
  },

  /* いちばん近い通れるマス (家具を置いたあと、上にいた猫を逃がす) */
  nearestFree(px, py) {
    const sx = Math.floor(px), sy = Math.floor(py);
    if (this.walk(sx, sy)) return { x: px, y: py };
    for (let r = 1; r < 20; r++) {
      let best = null, bd = 1e9;
      for (let y = sy - r; y <= sy + r; y++) {
        for (let x = sx - r; x <= sx + r; x++) {
          if (!this.walk(x, y)) continue;
          const d = dist(x + 0.5, y + 0.5, px, py);
          if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 0.5 }; }
        }
      }
      if (best) return best;
    }
    const din = this.doorIn();
    return { x: din.x + 0.5, y: din.y + 0.5 };
  },

  /* ------------------------------ 道さがし (A*) ------------------------------ */
  path(sx, sy, tx, ty) {
    const W = this.gw, n = W * this.gh;
    const si = this.idx(sx, sy), ti = this.idx(tx, ty);
    if (!this.inGrid(tx, ty) || this.block[ti]) return null;
    if (si === ti) return [];
    const g = new Float32Array(n).fill(1e9), from = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    const open = [si];
    g[si] = 0;
    const h = (i) => {
      const dx = Math.abs((i % W) - (ti % W)), dy = Math.abs(((i / W) | 0) - ((ti / W) | 0));
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    const f = new Float32Array(n).fill(1e9);
    f[si] = h(si);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let guard = 0;
    while (open.length && guard++ < 6000) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
      const cur = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      if (cur === ti) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = (cur % W) - OUT, cy = (cur / W) | 0;
      for (const [dx, dy, c] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.walk(nx, ny)) continue;
        if (dx && dy && (!this.walk(cx + dx, cy) || !this.walk(cx, cy + dy))) continue;
        const ni = this.idx(nx, ny);
        if (closed[ni]) continue;
        const ng = g[cur] + c;
        if (ng < g[ni]) {
          g[ni] = ng; f[ni] = ng + h(ni); from[ni] = cur;
          open.push(ni);
        }
      }
    }
    if (from[ti] < 0) return null;
    const pts = [];
    for (let i = ti; i !== si; i = from[i]) pts.push({ x: (i % W) - OUT + 0.5, y: ((i / W) | 0) + 0.5 });
    pts.reverse();
    return pts;
  },
  /* まっすぐ歩いて通れるか (半径 r の猫がかべにぶつからないか) */
  los(ax, ay, bx, by, r = 0.28) {
    const d = dist(ax, ay, bx, by), steps = Math.ceil(d / 0.2);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, x = lerp(ax, bx, t), y = lerp(ay, by, t);
      if (!this.walk(Math.floor(x - r), Math.floor(y - r)) || !this.walk(Math.floor(x + r), Math.floor(y - r)) ||
          !this.walk(Math.floor(x - r), Math.floor(y + r)) || !this.walk(Math.floor(x + r), Math.floor(y + r))) return false;
    }
    return true;
  },
  /* 道を作って、見通せる所は角をとばす */
  route(px, py, tx, ty) {
    const p = this.path(Math.floor(px), Math.floor(py), tx, ty);
    if (!p) return null;
    if (!p.length) return [{ x: tx + 0.5, y: ty + 0.5 }];
    const out = [];
    let ax = px, ay = py, i = 0;
    while (i < p.length) {
      let j = p.length - 1;
      while (j > i && !this.los(ax, ay, p[j].x, p[j].y)) j--;
      out.push(p[j]);
      ax = p[j].x; ay = p[j].y;
      i = j + 1;
    }
    return out;
  },
};
