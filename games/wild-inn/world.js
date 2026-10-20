/* =========================================================================
   WILD INN ― 建物の形
   階ごとのマス目 / 部屋とかべとドア / 通れるかの確認 / 道さがし / ぶつかり判定 /
   部屋と家具の出し入れ
   ========================================================================= */
'use strict';

/* マスの並び (y は上から、x は左から)
     0 .. W-1, 0 .. H-1   建物の中。部屋に入っていないマスはろうか
     1F だけ、建物の下 3 行 (y = H .. H+2) と左右 OUT マスが外の歩道
   受付・入り口・階段は左下にかためる。土地を広げると上と右にマスが足されるので、
   下からの位置はいつも同じ。
   zone: -2 何もない / -1 外 / 0 ろうか / 1〜 部屋の番号 */
const WT = 0.07;   // かべの厚さの半分 (マス)

const Hotel = {
  F: [],

  get W() { return LANDS[G.lv].w; },
  get H() { return LANDS[G.lv].h; },
  get gw() { return this.W + OUT * 2; },
  get gh() { return this.H + 3; },

  ent() { return { x: 3, y: this.H - 1 }; },
  entOut() { return { x: 3, y: this.H }; },
  stairs() { return { x: 0, y: this.H - 4, w: 2, h: 2 }; },
  counter() { return { x: 5, y: this.H - 3, w: 3, h: 1 }; },
  staffSpot() { return { x: 6, y: this.H - 4 }; },
  custSpot() { return { x: 6, y: this.H - 2 }; },
  petSpot() { return { x: 4, y: this.H - 2 }; },
  qspots() { const H = this.H; return [{ x: 6, y: H - 2 }, { x: 7, y: H - 2 }, { x: 7, y: H - 1 }, { x: 6, y: H - 1 }, { x: 5, y: H - 1 }]; },
  /* 部屋をつくれない所 (1F は受付まわり、ほかの階は階段の前) */
  lobby(f) { return f === 0 ? { x: 0, y: this.H - 4, w: 8, h: 4 } : { x: 0, y: this.H - 4, w: 3, h: 3 }; },

  idx(x, y) { return y * this.gw + (x + OUT); },
  ekey(a, b) { return a < b ? a * 100000 + b : b * 100000 + a; },
  inGrid(x, y) { return x >= -OUT && x < this.W + OUT && y >= 0 && y < this.gh; },
  inside(x, y) { return x >= 0 && x < this.W && y >= 0 && y < this.H; },
  zone(f, x, y) { return this.inGrid(x, y) && this.F[f] ? this.F[f].zone[this.idx(x, y)] : -2; },
  walk(f, x, y) { return this.inGrid(x, y) && !!this.F[f] && !this.F[f].block[this.idx(x, y)]; },
  furnAt(f, x, y) {
    if (!this.inGrid(x, y) || !this.F[f]) return null;
    const i = this.F[f].fmap[this.idx(x, y)];
    return i >= 0 ? G.furn[i] : null;
  },
  roomById(id) { return G.rooms.find((r) => r.id === id) || null; },
  roomAt(f, x, y) { const z = this.zone(f, x, y); return z > 0 ? this.roomById(z) : null; },
  isStairs(x, y) { const s = this.stairs(); return x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h; },

  rebuild() {
    const W = this.W, H = this.H, gw = this.gw, gh = this.gh, n = gw * gh;
    this.F = [];
    for (let f = 0; f < G.floors; f++) {
      const zone = new Int16Array(n), block = new Uint8Array(n), fmap = new Int32Array(n).fill(-1);
      for (let y = 0; y < gh; y++) {
        for (let x = -OUT; x < W + OUT; x++) {
          const i = y * gw + x + OUT;
          let z = -2;
          if (x >= 0 && x < W && y < H) z = 0;
          else if (f === 0 && y >= H) z = -1;
          zone[i] = z;
          block[i] = z === -2 ? 1 : 0;
        }
      }
      this.F.push({ zone, block, fmap, doors: new Set() });
    }
    for (const r of G.rooms) {
      const F = this.F[r.floor];
      if (!F) continue;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) F.zone[this.idx(x, y)] = r.id;
    }
    const c = this.counter();
    for (let k = 0; k < c.w; k++) this.F[0].block[this.idx(c.x + k, c.y)] = 1;
    G.furn.forEach((fu, i) => {
      const F = this.F[fu.floor], d = FURN[fu.type];
      if (!F) return;
      for (let j = 0; j < d.h; j++) {
        for (let k = 0; k < d.w; k++) {
          if (!this.inGrid(fu.x + k, fu.y + j)) continue;
          const id = this.idx(fu.x + k, fu.y + j);
          F.fmap[id] = i;
          if (!d.soft) F.block[id] = 1;
        }
      }
    });
    for (const r of G.rooms) {
      const F = this.F[r.floor];
      if (!F) continue;
      const t = this.doorTiles(r);
      if (this.inGrid(t.out.x, t.out.y)) F.doors.add(this.ekey(this.idx(t.in.x, t.in.y), this.idx(t.out.x, t.out.y)));
    }
    const e = this.ent(), eo = this.entOut();
    this.F[0].doors.add(this.ekey(this.idx(e.x, e.y), this.idx(eo.x, eo.y)));
    R.layoutV++;
  },

  /* ------------------------------ ドア ------------------------------ */
  doorTiles(r, d = r.door) {
    if (d.side === 's') return { in: { x: r.x + d.k, y: r.y + r.h - 1 }, out: { x: r.x + d.k, y: r.y + r.h } };
    if (d.side === 'n') return { in: { x: r.x + d.k, y: r.y }, out: { x: r.x + d.k, y: r.y - 1 } };
    if (d.side === 'w') return { in: { x: r.x, y: r.y + d.k }, out: { x: r.x - 1, y: r.y + d.k } };
    return { in: { x: r.x + r.w - 1, y: r.y + d.k }, out: { x: r.x + r.w, y: r.y + d.k } };
  },
  sideLen(r, side) { return side === 'n' || side === 's' ? r.w : r.h; },
  /* ドアをつけられる場所を、下のまん中から時計回りに */
  doorOptions(r) {
    const out = [];
    for (const side of ['s', 'e', 'n', 'w']) {
      const n = this.sideLen(r, side), mid = Math.floor((n - 1) / 2);
      for (let i = 0; i < n; i++) out.push({ side, k: (mid + i) % n });
    }
    return out;
  },
  doorOk(r, d) {
    const t = this.doorTiles(r, d), f = r.floor;
    return this.zone(f, t.out.x, t.out.y) === 0 && this.walk(f, t.out.x, t.out.y) && this.walk(f, t.in.x, t.in.y) && !this.isStairs(t.out.x, t.out.y);
  },
  isDoorTile(f, x, y) {
    for (const r of G.rooms) {
      if (r.floor !== f) continue;
      const t = this.doorTiles(r);
      if ((t.in.x === x && t.in.y === y) || (t.out.x === x && t.out.y === y)) return true;
    }
    return false;
  },
  /* 今のドアがだめなら、つけられる所をさがす。全部だめなら理由を返す */
  fixDoor(r) {
    const tries = [r.door, ...this.doorOptions(r)];
    let why = 'ドアをつけられる場所がないよ';
    for (const d of tries) {
      if (d.k >= this.sideLen(r, d.side) || !this.doorOk(r, d)) continue;
      r.door = { side: d.side, k: d.k };
      this.rebuild();
      const bad = this.check();
      if (!bad) return null;
      why = bad;
    }
    return why;
  },
  /* 次のドアの場所 (つけられる所だけ) */
  nextDoor(r) {
    const opts = this.doorOptions(r);
    const cur = opts.findIndex((d) => d.side === r.door.side && d.k === r.door.k);
    const old = r.door;
    for (let i = 1; i <= opts.length; i++) {
      const d = opts[(cur + i) % opts.length];
      if (!this.doorOk(r, d)) continue;
      r.door = d;
      this.rebuild();
      if (!this.check()) return null;
    }
    r.door = old;
    this.rebuild();
    return 'ほかにドアをつけられる場所がないよ';
  },

  /* ------------------------------ 通れるか ------------------------------ */
  /* となりのマスへ1歩 (上下左右)。かべはドアの所だけ通れる */
  step(f, ax, ay, bx, by) {
    if (!this.walk(f, bx, by)) return false;
    const F = this.F[f], a = this.idx(ax, ay), b = this.idx(bx, by);
    return F.zone[a] === F.zone[b] || F.doors.has(this.ekey(a, b));
  },
  /* 入り口 (ほかの階は階段) から、建物の中の歩ける床すべてに行けるか。だめなら理由 */
  check() {
    for (let f = 0; f < G.floors; f++) {
      const F = this.F[f];
      for (const r of G.rooms) {
        if (r.floor !== f) continue;
        if (!this.doorOk(r, r.door)) return `${r.name}のドアの前をあけておこう`;
      }
      const seen = new Uint8Array(F.zone.length);
      const root = f === 0 ? this.entOut() : this.stairs();
      const q = [[root.x, root.y]];
      seen[this.idx(root.x, root.y)] = 1;
      while (q.length) {
        const [x, y] = q.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!this.inGrid(nx, ny)) continue;
          const id = this.idx(nx, ny);
          if (seen[id] || !this.step(f, x, y, nx, ny)) continue;
          seen[id] = 1;
          q.push([nx, ny]);
        }
      }
      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          const id = this.idx(x, y);
          if (F.block[id] || seen[id]) continue;
          const r = this.roomAt(f, x, y);
          return r ? `${r.name}の中に、行けない場所ができちゃうよ` : 'ろうかに、行けない場所ができちゃうよ';
        }
      }
    }
    return null;
  },

  /* ------------------------------ 道さがし (A*) ------------------------------
     only を渡すと、その zone のマスだけを通る (動物は自分の部屋から出ない) */
  path(f, sx, sy, tx, ty, only) {
    if (!this.F[f] || !this.walk(f, tx, ty)) return null;
    if (only !== undefined && this.zone(f, tx, ty) !== only) return null;
    const gw = this.gw, n = gw * this.gh;
    const si = this.idx(sx, sy), ti = this.idx(tx, ty);
    if (si === ti) return [];
    const g = new Float32Array(n).fill(1e9), fs = new Float32Array(n).fill(1e9), from = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    const open = [si];
    g[si] = 0;
    const hh = (i) => {
      const dx = Math.abs((i % gw) - (ti % gw)), dy = Math.abs(((i / gw) | 0) - ((ti / gw) | 0));
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    fs[si] = hh(si);
    const Z = this.F[f].zone;
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let guard = 0;
    while (open.length && guard++ < 8000) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (fs[open[k]] < fs[open[bi]]) bi = k;
      const cur = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      if (cur === ti) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = (cur % gw) - OUT, cy = (cur / gw) | 0;
      for (const [dx, dy, c] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inGrid(nx, ny)) continue;
        if (dx && dy) {
          if (!this.walk(f, nx, ny) || !this.walk(f, cx + dx, cy) || !this.walk(f, cx, cy + dy)) continue;
          const z = Z[cur];
          if (Z[this.idx(nx, ny)] !== z || Z[this.idx(cx + dx, cy)] !== z || Z[this.idx(cx, cy + dy)] !== z) continue;
        } else if (!this.step(f, cx, cy, nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (closed[ni] || (only !== undefined && Z[ni] !== only)) continue;
        const ng = g[cur] + c;
        if (ng < g[ni]) {
          g[ni] = ng; fs[ni] = ng + hh(ni); from[ni] = cur;
          open.push(ni);
        }
      }
    }
    if (from[ti] < 0) return null;
    const pts = [];
    for (let i = ti; i !== si; i = from[i]) pts.push({ x: (i % gw) - OUT + 0.5, y: ((i / gw) | 0) + 0.5 });
    pts.reverse();
    return pts;
  },
  /* まっすぐ歩いて通れるか。同じ部屋 (ろうか) の中だけで、かどをかすらない */
  los(f, ax, ay, bx, by, r = 0.26) {
    const z = this.zone(f, Math.floor(ax), Math.floor(ay));
    if (this.zone(f, Math.floor(bx), Math.floor(by)) !== z) return false;
    const d = dist(ax, ay, bx, by), steps = Math.ceil(d / 0.2);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, x = lerp(ax, bx, t), y = lerp(ay, by, t);
      for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
        const cx = Math.floor(x + ox), cy = Math.floor(y + oy);
        if (!this.walk(f, cx, cy) || this.zone(f, cx, cy) !== z) return false;
      }
    }
    return true;
  },
  /* 道を作って、見通せる所は角をとばす */
  route(f, px, py, tx, ty, only) {
    const p = this.path(f, Math.floor(px), Math.floor(py), tx, ty, only);
    if (!p) return null;
    if (!p.length) return [{ x: tx + 0.5, y: ty + 0.5 }];
    const out = [];
    let ax = px, ay = py, i = 0;
    while (i < p.length) {
      let j = p.length - 1;
      while (j > i && !this.los(f, ax, ay, p[j].x, p[j].y)) j--;
      out.push(p[j]);
      ax = p[j].x; ay = p[j].y;
      i = j + 1;
    }
    return out;
  },

  /* ------------------------------ ぶつかり判定 ------------------------------
     半径 r の円を、通れないマスとかべから押し出す (自分で歩くときに使う) */
  collide(f, x, y, r) {
    const F = this.F[f];
    if (!F) return { x, y };
    const push = (x0, y0, x1, y1) => {
      const nx = clamp(x, x0, x1), ny = clamp(y, y0, y1);
      const dx = x - nx, dy = y - ny, d = Math.hypot(dx, dy);
      if (d >= r) return;
      if (d > 1e-6) { x = nx + (dx / d) * r; y = ny + (dy / d) * r; return; }
      const l = x - x0, rr = x1 - x, t = y - y0, b = y1 - y, m = Math.min(l, rr, t, b);
      if (m === l) x = x0 - r; else if (m === rr) x = x1 + r; else if (m === t) y = y0 - r; else y = y1 + r;
    };
    for (let it = 0; it < 2; it++) {
      const cx = Math.floor(x), cy = Math.floor(y);
      for (let j = cy - 1; j <= cy + 1; j++) {
        for (let i = cx - 1; i <= cx + 1; i++) {
          if (!this.walk(f, i, j)) { push(i, j, i + 1, j + 1); continue; }
          const a = this.idx(i, j), z = F.zone[a];
          if (this.walk(f, i + 1, j)) {
            const b = this.idx(i + 1, j);
            if (F.zone[b] !== z && !F.doors.has(this.ekey(a, b))) push(i + 1 - WT, j, i + 1 + WT, j + 1);
          }
          if (this.walk(f, i, j + 1)) {
            const b = this.idx(i, j + 1);
            if (F.zone[b] !== z && !F.doors.has(this.ekey(a, b))) push(i, j + 1 - WT, i + 1, j + 1 + WT);
          }
        }
      }
    }
    return { x, y };
  },
  /* いちばん近い歩けるマス (z を渡すとその部屋の中だけ) */
  nearestFree(f, px, py, z) {
    const sx = Math.floor(px), sy = Math.floor(py);
    const ok = (x, y) => this.walk(f, x, y) && (z === undefined || this.zone(f, x, y) === z);
    if (ok(sx, sy)) return { x: px, y: py };
    for (let r = 1; r < 30; r++) {
      let best = null, bd = 1e9;
      for (let y = sy - r; y <= sy + r; y++) {
        for (let x = sx - r; x <= sx + r; x++) {
          if (!ok(x, y)) continue;
          const d = dist(x + 0.5, y + 0.5, px, py);
          if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 0.5 }; }
        }
      }
      if (best) return best;
    }
    const s = this.stairs();
    return { x: s.x + 2.5, y: s.y + 0.5 };
  },
  roomTiles(r) {
    const out = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (this.walk(r.floor, x, y)) out.push({ x, y });
    return out;
  },

  /* ------------------------------ 部屋 ------------------------------ */
  cap(r) { return Math.max(1, Math.floor((r.w * r.h) / SLOT_AREA)); },
  used(r) {
    let n = 0;
    for (const g of G.guests) if (g.roomId === r.id) n += SPECIES[g.sp].slots;
    return n;
  },
  guestsIn(r) { return G.guests.filter((g) => g.roomId === r.id); },
  inRect(fu, rc) {
    const d = FURN[fu.type];
    return fu.x >= rc.x && fu.y >= rc.y && fu.x + d.w <= rc.x + rc.w && fu.y + d.h <= rc.y + rc.h;
  },
  furnIn(r) { return G.furn.filter((fu) => fu.floor === r.floor && this.inRect(fu, r)); },
  autoName(hab) {
    const base = HABITATS[hab].room;
    for (let i = 1; ; i++) {
      const name = `${base} ${i}`;
      if (!G.rooms.some((r) => r.name === name)) return name;
    }
  },
  roomWhy(f, rc, ignoreId) {
    if (rc.w < ROOM_MIN || rc.h < ROOM_MIN) return `部屋は ${ROOM_MIN}×${ROOM_MIN} マスより大きくしよう`;
    if (rc.w > ROOM_MAX_W || rc.h > ROOM_MAX_H) return `部屋は ${ROOM_MAX_W}×${ROOM_MAX_H} マスまでだよ`;
    if (rc.x < 0 || rc.y < 0 || rc.x + rc.w > this.W || rc.y + rc.h > this.H) return '建物の中につくろう';
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    if (hit(rc, this.lobby(f))) return f === 0 ? '受付のまわりには部屋をつくれないよ' : '階段のまわりには部屋をつくれないよ';
    for (const r of G.rooms) if (r.floor === f && r.id !== ignoreId && hit(rc, r)) return 'ほかの部屋とかさなっているよ';
    for (const fu of G.furn) {
      if (fu.floor !== f || this.zone(f, fu.x, fu.y) !== 0) continue;
      if (hit(rc, { x: fu.x, y: fu.y, w: FURN[fu.type].w, h: FURN[fu.type].h })) return 'ろうかの家具とかさなっているよ';
    }
    return null;
  },
  addRoom(f, rc, hab) {
    const why = this.roomWhy(f, rc, -1);
    if (why) return { why };
    const r = { id: G.nextRoom++, floor: f, x: rc.x, y: rc.y, w: rc.w, h: rc.h, hab, door: { side: 's', k: Math.floor((rc.w - 1) / 2) }, name: this.autoName(hab) };
    G.rooms.push(r);
    this.rebuild();
    const bad = this.fixDoor(r);
    if (bad) { G.rooms.pop(); G.nextRoom--; this.rebuild(); return { why: bad }; }
    return { room: r };
  },
  /* 部屋を動かす / 大きさを変える。はみ出した家具は「もちもの」にもどる。
     dry = true なら、できるかどうかだけ調べて元にもどす */
  setRoomRect(r, rc, dry) {
    const why = this.roomWhy(r.floor, rc, r.id);
    if (why) return { why };
    if (this.used(r) > this.cap(rc)) return { why: 'あずかっているペットが入りきらないよ' };
    const old = { x: r.x, y: r.y, w: r.w, h: r.h, door: { ...r.door } };
    const moving = rc.w === r.w && rc.h === r.h, dx = rc.x - r.x, dy = rc.y - r.y;
    const inside = this.furnIn(r);
    const saved = inside.map((fu) => ({ fu, x: fu.x, y: fu.y }));
    const furnBefore = G.furn.slice();
    Object.assign(r, { x: rc.x, y: rc.y, w: rc.w, h: rc.h });
    let stored = [];
    if (moving) for (const fu of inside) { fu.x += dx; fu.y += dy; }
    else {
      stored = inside.filter((fu) => !this.inRect(fu, r));
      G.furn = G.furn.filter((fu) => !stored.includes(fu));
    }
    r.door.k = Math.min(r.door.k, this.sideLen(r, r.door.side) - 1);
    this.rebuild();
    const bad = this.fixDoor(r);
    if (bad || dry) {
      Object.assign(r, old);
      for (const s of saved) { s.fu.x = s.x; s.fu.y = s.y; }
      G.furn = furnBefore;
      this.rebuild();
      return { why: bad, stored: stored.length };
    }
    for (const fu of stored) G.inv[fu.type] = (G.inv[fu.type] || 0) + 1;
    return { stored: stored.length, dx: moving ? dx : 0, dy: moving ? dy : 0 };
  },
  removeRoom(r) {
    if (this.guestsIn(r).length) return 'ペットがいる部屋はこわせないよ';
    for (const fu of this.furnIn(r)) G.inv[fu.type] = (G.inv[fu.type] || 0) + 1;
    G.furn = G.furn.filter((fu) => !(fu.floor === r.floor && this.inRect(fu, r)));
    G.rooms = G.rooms.filter((x) => x !== r);
    this.rebuild();
    return null;
  },

  /* ------------------------------ 家具 ------------------------------ */
  reserved(f, x, y) {
    if (this.isStairs(x, y)) return '階段の上にはおけないよ';
    if (f !== 0) return null;
    const c = this.counter();
    if (y === c.y && x >= c.x && x < c.x + c.w) return '受付のカウンターがあるよ';
    const keys = [this.ent(), this.staffSpot(), this.petSpot(), ...this.qspots()];
    if (keys.some((k) => k.x === x && k.y === y)) return 'そこは受付の通り道だよ';
    return null;
  },
  furnWhy(type, f, x, y, ignore) {
    const d = FURN[type];
    let z = null;
    for (let j = 0; j < d.h; j++) {
      for (let k = 0; k < d.w; k++) {
        const tx = x + k, ty = y + j;
        if (!this.inside(tx, ty)) return '建物の中におこう';
        const zz = this.zone(f, tx, ty);
        if (z === null) z = zz;
        else if (zz !== z) return '部屋のかべをまたいでいるよ';
        const res = this.reserved(f, tx, ty);
        if (res) return res;
        const o = this.furnAt(f, tx, ty);
        if (o && o !== ignore) return 'ほかの家具とかさなっているよ';
        if (this.isDoorTile(f, tx, ty)) return 'ドアの前はあけておこう';
      }
    }
    return null;
  },
  placeFurn(type, f, x, y) {
    const why = this.furnWhy(type, f, x, y, null);
    if (why) return why;
    const fu = { uid: G.nextUid++, type, floor: f, x, y };
    G.furn.push(fu);
    this.rebuild();
    const bad = this.check();
    if (bad) { G.furn.pop(); G.nextUid--; this.rebuild(); return bad; }
    return null;
  },
  moveFurn(fu, f, x, y) {
    const why = this.furnWhy(fu.type, f, x, y, fu);
    if (why) return why;
    const o = { floor: fu.floor, x: fu.x, y: fu.y };
    fu.floor = f; fu.x = x; fu.y = y;
    this.rebuild();
    const bad = this.check();
    if (bad) { Object.assign(fu, o); this.rebuild(); return bad; }
    return null;
  },
  removeFurn(fu) {
    const before = G.furn;
    G.furn = G.furn.filter((x) => x !== fu);
    this.rebuild();
    const bad = this.check();
    if (bad) { G.furn = before; this.rebuild(); return bad; }
    G.inv[fu.type] = (G.inv[fu.type] || 0) + 1;
    return null;
  },

  /* ------------------------------ 建物 ------------------------------ */
  /* 土地を広げる。上に dh 行、右に列が足されるので、今ある物は下へずらす */
  expandLand() {
    const dh = LANDS[G.lv + 1].h - LANDS[G.lv].h;
    G.lv++;
    for (const r of G.rooms) r.y += dh;
    for (const fu of G.furn) fu.y += dh;
    for (const g of G.guests) g.y += dh;
    this.rebuild();
    return dh;
  },
  addFloor() {
    G.floors++;
    this.rebuild();
  },
};
