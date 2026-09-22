/* =========================================================================
   CELLHOUSE ― 土地
   マス目 / 設備の置き場所 / 部屋の判定 / 経路探索
   ========================================================================= */
'use strict';

const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const FRONT_ANGLE = [Math.PI / 2, Math.PI, -Math.PI / 2, 0];

class World {
  constructor() {
    const W = this.W = MAP_W, H = this.H = MAP_H, n = W * H;
    this.n = n;
    this.ground = new Uint8Array(n);   /* 0 草 / 1 乾いた草 / 2 歩道 / 3 車道 */
    this.floor = new Uint8Array(n);
    this.wall = new Uint8Array(n);
    this.door = new Uint8Array(n);
    this.hp = new Uint8Array(n);       /* 壁と扉の耐久 (0〜100) */
    this.doorOpen = new Float32Array(n);
    this.zone = new Uint8Array(n);     /* ROOM_KEYS の index+1 */
    this.dirt = new Uint8Array(n);
    this.tunnel = new Int32Array(n);   /* 掘っている囚人の id */
    this.tunnelSeen = new Uint8Array(n);
    this.objAt = new Int32Array(n).fill(-1);
    this.roomAt = new Int32Array(n).fill(-1);
    this.objects = new Map();
    this.nextObjId = 1;
    this.rooms = [];
    this.roomByKey = new Map();
    this.roomsDirty = true;
    this.patrol = [];
    this.jailLocked = false;
    this.lockdown = false;
    this.reservedAt = () => false;     /* 建築予定の場所 (Jobs が差しかえる) */
    /* 探索用の作業領域 */
    this.gS = new Float32Array(n);
    this.came = new Int32Array(n);
    this.seen = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.gen = 1;
    this.heap = new Heap();
  }

  idx(x, y) { return y * this.W + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  isOutside(x, y) { return x <= 0 || y <= 0 || x >= this.W - 1 || y >= WALK_Y; }
  buildable(i) { return this.ground[i] < 2; }
  isIndoor(i) { const f = this.floor[i]; return f > 0 && FLOORS[f].indoor; }
  obj(i) { const o = this.objAt[i]; return o >= 0 ? this.objects.get(o) : null; }
  roomOf(i) { const r = this.roomAt[i]; return r >= 0 ? this.rooms[r] : null; }

  /* ------------------------------ 土地をつくる ------------------------------ */
  generate(seed) {
    const r = mulberry32(seed);
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const i = this.idx(x, y);
        if (y >= ROAD_Y) this.ground[i] = 3;
        else if (y === WALK_Y) this.ground[i] = 2;
        else {
          const v = Math.sin(x * 0.11 + seed) * Math.cos(y * 0.13 - seed * 0.7) + (hash2(x, y) - 0.5) * 0.6;
          this.ground[i] = v > 0.55 ? 1 : 0;
        }
      }
    }
    /* 木を散らす。搬入口のまわりは空けておく。 */
    const cx = this.W >> 1;
    for (let k = 0; k < 90; k++) {
      const x = 1 + Math.floor(r() * (this.W - 2));
      const y = 1 + Math.floor(r() * (WALK_Y - 3));
      if (Math.abs(x - cx) < 12 && y > WALK_Y - 14) continue;
      if (this.canPlace('tree', x, y, 0) === '') this.addObject('tree', x, y, 0);
    }
    /* 最初の搬入口 */
    const z = ROOM_KEYS.indexOf('deliveries') + 1;
    for (let y = WALK_Y - 4; y < WALK_Y; y++) for (let x = cx - 4; x < cx + 4; x++) this.zone[this.idx(x, y)] = z;
    this.roomsDirty = true;
  }

  /* ------------------------------ 設備 ------------------------------ */
  footprint(key, rot) {
    const d = OBJECTS[key];
    return rot & 1 ? [d.h, d.w] : [d.w, d.h];
  }
  /* 置けないときは理由を返す。置けるなら '' */
  canPlace(key, x, y, rot) {
    const [w, h] = this.footprint(key, rot);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const tx = x + dx, ty = y + dy;
      if (!this.inb(tx, ty) || tx === 0 || ty === 0 || tx === this.W - 1) return '土地の外';
      const i = this.idx(tx, ty);
      if (!this.buildable(i)) return '道路には置けない';
      if (this.wall[i] || this.door[i]) return '壁がある';
      if (this.objAt[i] >= 0) return 'ほかの物がある';
      if (this.reservedAt(i)) return '建築予定の場所';
    }
    return '';
  }
  addObject(key, x, y, rot, id) {
    const def = OBJECTS[key];
    const [w, h] = this.footprint(key, rot);
    const o = { id: id || this.nextObjId++, key, def, x, y, rot, w, h, hp: 100, food: 0, res: null, spots: null, t: 0 };
    if (o.id >= this.nextObjId) this.nextObjId = o.id + 1;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.objAt[this.idx(x + dx, y + dy)] = o.id;
    this.objects.set(o.id, o);
    this.roomsDirty = true;
    return o;
  }
  removeObject(id) {
    const o = this.objects.get(id);
    if (!o) return;
    for (let dy = 0; dy < o.h; dy++) for (let dx = 0; dx < o.w; dx++) this.objAt[this.idx(o.x + dx, o.y + dy)] = -1;
    this.objects.delete(id);
    this.roomsDirty = true;
  }
  /* 設備の中の座標 (回転前) を土地の座標に直す */
  local(o, cx, cy) {
    const d = o.def;
    switch (o.rot) {
      case 1: return [o.x + (d.h - 1 - cy), o.y + cx];
      case 2: return [o.x + (d.w - 1 - cx), o.y + (d.h - 1 - cy)];
      case 3: return [o.x + cy, o.y + (d.w - 1 - cx)];
      default: return [o.x + cx, o.y + cy];
    }
  }
  /* 使う人が立つ (座る・寝る) マスの一覧 */
  spots(o) {
    if (o.spots) return o.spots;
    const d = o.def, list = [];
    const add = (cx, cy, side, on) => {
      const [x, y] = this.local(o, cx, cy);
      if (!this.inb(x, y)) return;
      const face = on ? FRONT_ANGLE[o.rot]
        : Math.atan2(o.y + o.h / 2 - (y + 0.5), o.x + o.w / 2 - (x + 0.5));
      list.push({ i: this.idx(x, y), x, y, face, side, on: !!on });
    };
    if (d.use === 'on') {
      if (d.spots === 'first') add(0, 0, 'f', true);
      else for (let cy = 0; cy < d.h; cy++) for (let cx = 0; cx < d.w; cx++) add(cx, cy, 'f', true);
    } else if (d.use === 'front') {
      for (let cx = 0; cx < d.w; cx++) add(cx, d.h, 'f');
    } else if (d.use === 'sides') {
      for (let cx = 0; cx < d.w; cx++) add(cx, d.h, 'f');
      for (let cx = 0; cx < d.w; cx++) add(cx, -1, 'b');
    } else if (d.use === 'ends') {
      add(-1, 0, 'f'); add(d.w, d.h - 1, 'b');
    }
    o.spots = list;
    o.res = new Array(list.length).fill(0);
    return list;
  }
  spotUsable(o, s) {
    if (s.on) return true;
    const i = s.i;
    if (this.wall[i] || this.door[i]) return false;
    const other = this.objAt[i];
    return other < 0 || !this.objects.get(other).def.solid;
  }

  /* ------------------------------ 部屋の判定 ------------------------------ */
  recomputeRooms(research) {
    const { W, H } = this;
    this.roomAt.fill(-1);
    const rooms = [];
    const stack = [];
    for (let i = 0; i < this.n; i++) {
      if (!this.zone[i] || this.wall[i] || this.door[i] || this.roomAt[i] >= 0) continue;
      const z = this.zone[i];
      const ri = rooms.length;
      const room = { key: i, idx: ri, type: ROOM_KEYS[z - 1], tiles: [], x0: W, y0: H, x1: 0, y1: 0, objs: [], doors: [], counts: {}, owners: [] };
      room.def = ROOMS[room.type];
      stack.push(i); this.roomAt[i] = ri;
      while (stack.length) {
        const c = stack.pop();
        room.tiles.push(c);
        const cx = c % W, cy = (c / W) | 0;
        if (cx < room.x0) room.x0 = cx; if (cx > room.x1) room.x1 = cx;
        if (cy < room.y0) room.y0 = cy; if (cy > room.y1) room.y1 = cy;
        for (const [dx, dy] of DIRS4) {
          const nx = cx + dx, ny = cy + dy;
          if (!this.inb(nx, ny)) continue;
          const ni = ny * W + nx;
          if (this.roomAt[ni] >= 0 || this.zone[ni] !== z || this.wall[ni] || this.door[ni]) continue;
          this.roomAt[ni] = ri; stack.push(ni);
        }
      }
      rooms.push(room);
    }
    for (const o of this.objects.values()) {
      o.room = this.roomAt[this.idx(o.x, o.y)];
      if (o.room >= 0) {
        const r = rooms[o.room];
        r.objs.push(o.id);
        if (o.hp > 0) r.counts[o.key] = (r.counts[o.key] || 0) + 1;
      }
      o.spots = null;
      const keep = o.res;
      this.spots(o);
      if (keep && keep.length === o.res.length) o.res = keep;
    }
    for (const r of rooms) {
      const seenDoor = new Set();
      let indoor = true, enclosed = true;
      for (const i of r.tiles) {
        if (!this.isIndoor(i)) indoor = false;
        const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of DIRS4) {
          const nx = x + dx, ny = y + dy;
          if (!this.inb(nx, ny)) { enclosed = false; continue; }
          const ni = ny * W + nx;
          if (this.door[ni]) { if (!seenDoor.has(ni)) { seenDoor.add(ni); r.doors.push(ni); } continue; }
          if (this.wall[ni]) continue;
          if (this.roomAt[ni] !== r.idx) enclosed = false;
        }
      }
      r.n = r.tiles.length;
      r.indoor = indoor; r.enclosed = enclosed;
      r.cx = (r.x0 + r.x1 + 1) / 2; r.cy = (r.y0 + r.y1 + 1) / 2;
      const def = r.def, probs = [];
      if (def.research && research && !research.has(def.research)) probs.push('研究がまだ');
      for (const k in def.req) {
        const have = r.counts[k] || 0;
        if (have < def.req[k]) probs.push(`${OBJECTS[k].name}が${def.req[k] - have}台たりない`);
      }
      if (def.indoor && !indoor) probs.push('屋内の床が敷かれていない');
      if (def.enclosed && !enclosed) probs.push('壁と扉で閉じていない');
      if (def.minTiles && r.n < def.minTiles) probs.push(`${def.minTiles}マス以上いる`);
      if (def.maxTiles && r.n > def.maxTiles) probs.push(`${def.maxTiles}マスまで`);
      if (r.type === 'cell' && (r.counts.bed || 0) > 1) probs.push('ベッドは1台まで');
      if (r.doors.length && !r.doors.some((d) => DIRS4.some(([dx, dy]) => {
        const x = d % W + dx, y = ((d / W) | 0) + dy;
        if (!this.inb(x, y)) return false;
        const i = this.idx(x, y);
        return this.roomAt[i] === r.idx && this.canWalk(i, null, false);
      }))) probs.push('入口を設備がふさいでいる');
      r.problems = probs;
      r.valid = probs.length === 0;
      r.cap = !r.valid ? 0
        : r.type === 'cell' || r.type === 'solitary' ? 1
        : r.type === 'dorm' ? (r.counts.bed || 0)
        : r.type === 'holding' ? Math.max(1, Math.floor(r.n / 2)) : 0;
    }
    this.rooms = rooms;
    this.roomByKey = new Map(rooms.map((r) => [r.key, r]));
    this.roomsDirty = false;
  }
  roomsOf(type) { return this.rooms.filter((r) => r.type === type && r.valid); }
  countRooms(type) { let n = 0; for (const r of this.rooms) if (r.type === type && r.valid) n++; return n; }
  largestRoom(type) { let n = 0; for (const r of this.rooms) if (r.type === type && r.valid) n = Math.max(n, r.n); return n; }
  countObjs(key) { let n = 0; for (const o of this.objects.values()) if (o.key === key) n++; return n; }
  countObjsInRooms(key, type) {
    let n = 0;
    for (const r of this.rooms) if (r.type === type && r.valid) n += r.counts[key] || 0;
    return n;
  }

  /* ------------------------------ 通れるか ------------------------------ */
  /* a: 歩く人 (null なら職員あつかい) / goal: 目的地のマスなら設備の上でもよい */
  canWalk(i, a, goal) {
    if (this.wall[i]) return false;
    const o = this.objAt[i];
    if (o >= 0 && !goal && this.objects.get(o).def.solid) return false;
    if (!a || a.kind !== 'prisoner') return true;
    if (a.confined >= 0 && this.roomAt[i] >= 0 && this.rooms[this.roomAt[i]].key !== a.confined) return false;
    if (a.confined >= 0 && this.roomAt[i] < 0) return false;
    const d = this.door[i];
    if (d && !a.escort && this.hp[i] > 0) {
      const who = DOORS[d].who;
      if (who === 'staff') return false;
      const home = a.homeDoors && a.homeDoors.has(i) && !a.inHome;
      if (this.lockdown && !a.rioting) return home;
      if (who === 'jail' && this.jailLocked && !a.rioting) return home;
    }
    return true;
  }

  /* 目的地が決まっているときの A*。near なら目的地のとなりに着けばよい */
  findPath(sx, sy, tx, ty, a, maxIter = 9000, near = false) {
    const W = this.W;
    const s = sy * W + sx, t = ty * W + tx;
    if (s === t && !near) return [];
    if (!this.inb(tx, ty) || (!near && !this.canWalk(t, a, true))) return null;
    const gen = ++this.gen;
    const G = this.gS, seen = this.seen, came = this.came, closed = this.closed, heap = this.heap;
    heap.clear();
    G[s] = 0; seen[s] = gen; came[s] = -1;
    heap.push(0, s);
    let iter = 0;
    while (heap.size) {
      const c = heap.pop();
      if (closed[c] === gen) continue;
      closed[c] = gen;
      const cx = c % W, cy = (c / W) | 0;
      if (near ? (c !== t && Math.abs(cx - tx) <= 1 && Math.abs(cy - ty) <= 1) : c === t) return this.trace(s, c);
      if (++iter > maxIter) return null;
      if (c !== s && !this.canWalk(c, a, false)) continue;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DIRS8[k][0], ny = cy + DIRS8[k][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= this.H) continue;
        const ni = ny * W + nx;
        if (closed[ni] === gen) continue;
        if (!this.canWalk(ni, a, ni === t && !near)) continue;
        let cost = 1;
        if (k >= 4) {
          if (!this.canWalk(cy * W + nx, a, false) || !this.canWalk(ny * W + cx, a, false)) continue;
          cost = 1.414;
        }
        if (this.door[ni]) cost += 0.4;
        const ng = G[c] + cost;
        if (seen[ni] !== gen || ng < G[ni]) {
          seen[ni] = gen; G[ni] = ng; came[ni] = c;
          const dx = Math.abs(nx - tx), dy = Math.abs(ny - ty);
          heap.push(ng + (dx + dy) + (1.414 - 2) * Math.min(dx, dy), ni);
        }
      }
    }
    return null;
  }

  /* いちばん近い「条件に合うマス」までの経路 */
  search(sx, sy, a, pred, maxNodes = 5000) {
    const W = this.W;
    const s = sy * W + sx;
    const gen = ++this.gen;
    const G = this.gS, seen = this.seen, came = this.came, closed = this.closed, heap = this.heap;
    heap.clear();
    G[s] = 0; seen[s] = gen; came[s] = -1;
    heap.push(0, s);
    let iter = 0;
    while (heap.size) {
      const c = heap.pop();
      if (closed[c] === gen) continue;
      closed[c] = gen;
      if (pred(c)) return { i: c, path: this.trace(s, c) };
      if (++iter > maxNodes) return null;
      if (c !== s && !this.canWalk(c, a, false)) continue;
      const cx = c % W, cy = (c / W) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DIRS8[k][0], ny = cy + DIRS8[k][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= this.H) continue;
        const ni = ny * W + nx;
        if (closed[ni] === gen) continue;
        if (!this.canWalk(ni, a, true)) continue;
        let cost = 1;
        if (k >= 4) {
          if (!this.canWalk(cy * W + nx, a, false) || !this.canWalk(ny * W + cx, a, false)) continue;
          cost = 1.414;
        }
        const ng = G[c] + cost;
        if (seen[ni] !== gen || ng < G[ni]) { seen[ni] = gen; G[ni] = ng; came[ni] = c; heap.push(ng, ni); }
      }
    }
    return null;
  }

  /* 歩いて行けるマスに印をつける。戻り値の番号と rch[i] が同じなら行ける */
  reachMap(sx, sy, a) {
    if (!this.rch) { this.rch = new Uint32Array(this.n); this.rq = new Int32Array(this.n); this.rgen = 0; }
    const gen = ++this.rgen, W = this.W, rch = this.rch, q = this.rq;
    let h = 0, t = 0;
    const s = sy * W + sx;
    rch[s] = gen; q[t++] = s;
    while (h < t) {
      const c = q[h++];
      const cx = c % W, cy = (c / W) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DIRS8[k][0], ny = cy + DIRS8[k][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= this.H) continue;
        const ni = ny * W + nx;
        if (rch[ni] === gen || !this.canWalk(ni, a, false)) continue;
        if (k >= 4 && (!this.canWalk(cy * W + nx, a, false) || !this.canWalk(ny * W + cx, a, false))) continue;
        rch[ni] = gen; q[t++] = ni;
      }
    }
    return gen;
  }
  /* そのマスか、となりのマスまで行けるか */
  nearReachable(i, gen) {
    if (this.rch[i] === gen) return true;
    const x = i % this.W, y = (i / this.W) | 0;
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy;
      if (this.inb(nx, ny) && this.rch[ny * this.W + nx] === gen) return true;
    }
    return false;
  }

  trace(s, t) {
    const out = [];
    let c = t;
    while (c !== s && c >= 0) { out.push(c); c = this.came[c]; }
    out.reverse();
    return out;
  }

  /* 扉の向き (true なら左右に壁がつながる横向き) */
  doorHorizontal(x, y) {
    const l = x > 0 && (this.wall[this.idx(x - 1, y)] || this.door[this.idx(x - 1, y)]);
    const r = x < this.W - 1 && (this.wall[this.idx(x + 1, y)] || this.door[this.idx(x + 1, y)]);
    return !!(l || r);
  }
}
