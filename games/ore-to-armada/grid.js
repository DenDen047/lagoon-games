/* =========================================================================
   ORE TO ARMADA ― グリッド
   船・基地・ステーション・漂流船・破片・小惑星は、どれもこの仕組みで表す。
   マス (i,j) はグリッドの座標で [i,i+1]×[j,j+1] を占める。
   ワールド座標 = 位置(x,y) + 回転(a) × (ローカル座標 − 重心)
   ========================================================================= */
'use strict';

const CHUNK = 16;

class Grid {
  constructor(o = {}) {
    this.id = ++Grid.seq;
    this.kind = o.kind || 'ship';        // ship / station / asteroid / base / debris
    this.faction = o.faction || null;    // player / pirate / union / swarm / null
    this.name = o.name || '';
    this.terrain = !!o.terrain;
    this.static = !!o.static;
    this.minX = 0; this.minY = 0; this.w = 0; this.h = 0;
    this.cells = new Int32Array(0);
    this.thp = null;                      // 小惑星のマスの耐久
    this.blocks = []; this.freeIdx = []; this.count = 0;
    this.x = o.x || 0; this.y = o.y || 0; this.a = o.a || 0;
    this.vx = 0; this.vy = 0; this.va = 0;
    this.mass = 1; this.inertia = 1; this.comX = 0; this.comY = 0; this.radius = 1;
    this.dirtyMass = true; this.dirtyRooms = true; this.dirtySys = true; this.dirtyEdge = true; this.dirtySplit = false;
    this.chunks = new Map();
    this.rooms = []; this.roomOf = null; this.press = null;
    this.edge = null;
    this.sys = null;
    this.ctrl = { mx: 0, my: 0, rot: 0, assist: true, face: null };
    this.power = { gen: 0, use: 0, ratio: 1, stored: 0, cap: 0 };
    this.shield = 0; this.shieldMax = 0; this.shieldHit = 0; this.shieldDown = 0;
    this.h2 = 0; this.h2cap = 0;
    this.dead = false;
    this.dockedTo = null;                 // 母艦 (格納・ドッキング中)
    this.dockRel = null;
    this.order = null;                    // 艦隊命令
    this.crewIds = [];
    this.flash = 0;
    this.lastHitBy = null;
  }

  /* ---------- 座標 ---------- */
  toWorld(lx, ly, out) {
    const c = Math.cos(this.a), s = Math.sin(this.a), dx = lx - this.comX, dy = ly - this.comY;
    out = out || {};
    out.x = this.x + c * dx - s * dy; out.y = this.y + s * dx + c * dy;
    return out;
  }
  toLocal(wx, wy, out) {
    const c = Math.cos(this.a), s = Math.sin(this.a), dx = wx - this.x, dy = wy - this.y;
    out = out || {};
    out.x = c * dx + s * dy + this.comX; out.y = -s * dx + c * dy + this.comY;
    return out;
  }
  vecToWorld(vx, vy) { const c = Math.cos(this.a), s = Math.sin(this.a); return { x: c * vx - s * vy, y: s * vx + c * vy }; }
  vecToLocal(vx, vy) { const c = Math.cos(this.a), s = Math.sin(this.a); return { x: c * vx + s * vy, y: -s * vx + c * vy }; }
  /* ワールドの点の速度 (回転を含む) */
  velAt(wx, wy) {
    if (this.dockedTo) return this.dockedTo.velAt(wx, wy);
    return { x: this.vx - this.va * (wy - this.y), y: this.vy + this.va * (wx - this.x) };
  }

  /* ---------- マスの記憶領域 ---------- */
  idx(i, j) {
    const x = i - this.minX, y = j - this.minY;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return y * this.w + x;
  }
  ensure(i0, j0, i1, j1) {
    if (this.w && i0 >= this.minX && j0 >= this.minY && i1 < this.minX + this.w && j1 < this.minY + this.h) return;
    const m = 4;
    const nx0 = this.w ? Math.min(this.minX, i0 - m) : i0 - m, ny0 = this.w ? Math.min(this.minY, j0 - m) : j0 - m;
    const nx1 = this.w ? Math.max(this.minX + this.w - 1, i1 + m) : i1 + m, ny1 = this.w ? Math.max(this.minY + this.h - 1, j1 + m) : j1 + m;
    const nw = nx1 - nx0 + 1, nh = ny1 - ny0 + 1;
    const nc = new Int32Array(nw * nh);
    const nt = this.terrain ? new Float32Array(nw * nh) : null;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const k = (y + this.minY - ny0) * nw + (x + this.minX - nx0);
      nc[k] = this.cells[y * this.w + x];
      if (nt) nt[k] = this.thp[y * this.w + x];
    }
    let nr = null;
    if (this.roomOf && this.roomOf.length === this.w * this.h) {
      nr = new Int32Array(nw * nh).fill(-1);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) nr[(y + this.minY - ny0) * nw + (x + this.minX - nx0)] = this.roomOf[y * this.w + x];
    }
    this.cells = nc; this.thp = nt; this.minX = nx0; this.minY = ny0; this.w = nw; this.h = nh;
    this.roomOf = nr; this.press = null; this.dirtyRooms = true; this.dirtyEdge = true;
  }
  at(i, j) {
    const k = this.idx(i, j);
    if (k < 0) return null;
    const v = this.cells[k];
    return v && !this.terrain ? this.blocks[v - 1] : null;
  }
  tt(i, j) { const k = this.idx(i, j); return k < 0 ? 0 : (this.terrain ? this.cells[k] : 0); }
  dugAt(i, j) { return !!(this.dug && this.dug.has(i + ',' + j)); }
  /* 船同士の衝突で固いか */
  solid(i, j) {
    const k = this.idx(i, j);
    if (k < 0) return false;
    const v = this.cells[k];
    if (!v) return false;
    if (this.terrain) return true;
    return this.blocks[v - 1].def.gridSolid;
  }
  occupied(i, j) { const k = this.idx(i, j); return k >= 0 && this.cells[k] !== 0; }

  /* ---------- ブロック ---------- */
  static sizeOf(def, r) { return (r & 1) ? [def.size[1], def.size[0]] : [def.size[0], def.size[1]]; }
  canPlace(def, x, y, r) {
    const [w, h] = Grid.sizeOf(def, r);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.occupied(i, j)) return false;
    return true;
  }
  addBlock(defId, x, y, r = 0, st) {
    const def = BLOCKS[defId];
    if (!def) throw new Error('unknown block ' + defId);
    const [w, h] = Grid.sizeOf(def, r);
    this.ensure(x, y, x + w - 1, y + h - 1);
    if (!this.canPlace(def, x, y, r)) return null;
    const i = this.freeIdx.length ? this.freeIdx.pop() : this.blocks.length;
    const b = { i, def, x, y, r, w, h, hp: def.hp };
    initBlockState(b);
    if (st) Object.assign(b, st);
    this.blocks[i] = b; this.count++;
    for (let j = y; j < y + h; j++) for (let ii = x; ii < x + w; ii++) this.cells[this.idx(ii, j)] = i + 1;
    this.touch(x, y, w, h);
    return b;
  }
  removeBlock(b) {
    if (!b || this.blocks[b.i] !== b) return;
    for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) {
      const k = this.idx(i, j); if (k >= 0) this.cells[k] = 0;
    }
    this.blocks[b.i] = null; this.freeIdx.push(b.i); this.count--;
    b.dead = true;
    this.touch(b.x, b.y, b.w, b.h);
    this.dirtySplit = true;
  }
  touch(x, y, w, h) {
    this.dirtyMass = this.dirtyRooms = this.dirtySys = this.dirtyEdge = true;
    this.markChunks(x - 1, y - 1, x + w, y + h);
  }
  markChunks(i0, j0, i1, j1) {
    for (let cj = Math.floor(j0 / CHUNK); cj <= Math.floor(j1 / CHUNK); cj++)
      for (let ci = Math.floor(i0 / CHUNK); ci <= Math.floor(i1 / CHUNK); ci++) {
        const c = this.chunks.get(ci + ',' + cj); if (c) c.dirty = true;
      }
  }
  eachBlock(fn) { for (const b of this.blocks) if (b) fn(b); }
  blockCenter(b) { return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }
  blockWorld(b) { return this.toWorld(b.x + b.w / 2, b.y + b.h / 2); }

  /* ---------- 小惑星のマス ---------- */
  setTerrain(i, j, t) {
    this.ensure(i, j, i, j);
    const k = this.idx(i, j);
    if (!this.cells[k] && t) this.count++;
    if (this.cells[k] && !t) this.count--;
    this.cells[k] = t; this.thp[k] = t ? TERRAIN[t].hp : 0;
  }
  /* 掘る。壊れたらそのマスの種類を返す */
  digTerrain(i, j, amt) {
    const k = this.idx(i, j);
    if (k < 0 || !this.cells[k]) return 0;
    this.thp[k] -= amt;
    if (this.thp[k] > 0) return 0;
    const t = this.cells[k];
    this.cells[k] = 0; this.count--;
    this.dug = this.dug || new Set(); this.dug.add(i + ',' + j);
    this.markChunks(i - 1, j - 1, i + 1, j + 1);
    this.dirtyEdge = true; this.dirtyRooms = true;
    if (this.base) { this.base.dirtyRooms = true; this.base.markChunks(i - 1, j - 1, i + 1, j + 1); }
    return t;
  }

  /* ---------- 重さ・重心・回りにくさ ---------- */
  updateMass() {
    if (!this.dirtyMass) return;
    this.dirtyMass = false;
    let m = 0, cx = 0, cy = 0;
    if (this.terrain) {
      let n = 0;
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.cells[y * this.w + x]) { n++; cx += x + this.minX + 0.5; cy += y + this.minY + 0.5; }
      m = n * 3;
      if (n) { cx /= n; cy /= n; }
    } else {
      for (const b of this.blocks) if (b) { const bm = b.def.mass; m += bm; cx += (b.x + b.w / 2) * bm; cy += (b.y + b.h / 2) * bm; }
      if (m > 0) { cx /= m; cy /= m; }
    }
    // 重心が動いても、マスのワールド位置は変えない
    const p = this.toWorld(cx, cy);
    this.x = p.x; this.y = p.y; this.comX = cx; this.comY = cy;
    this.mass = Math.max(0.5, m);
    let I = 0, r2max = 0;
    if (this.terrain) {
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.cells[y * this.w + x]) {
        const dx = x + this.minX + 0.5 - cx, dy = y + this.minY + 0.5 - cy, d2 = dx * dx + dy * dy;
        I += 3 * (0.3 + Math.sqrt(d2)) * 2; if (d2 > r2max) r2max = d2;
      }
    } else {
      for (const b of this.blocks) if (b) {
        const dx = b.x + b.w / 2 - cx, dy = b.y + b.h / 2 - cy, d = Math.hypot(dx, dy);
        // 回りにくさは本物の慣性モーメントより緩くする (大きい船でもジャイロで回せるように)
        I += b.def.mass * (0.3 + d) * 2;
        const rr = d + Math.hypot(b.w, b.h) / 2; if (rr * rr > r2max) r2max = rr * rr;
      }
    }
    this.inertia = Math.max(1, I);
    this.radius = Math.sqrt(r2max) + 0.8;
  }

  /* ---------- 衝突に使う外周のマス ---------- */
  updateEdge() {
    if (!this.dirtyEdge) return;
    this.dirtyEdge = false;
    const e = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = x + this.minX, j = y + this.minY;
      if (!this.solid(i, j)) continue;
      if (!this.solid(i + 1, j) || !this.solid(i - 1, j) || !this.solid(i, j + 1) || !this.solid(i, j - 1)) e.push(i, j);
    }
    this.edge = e;
  }

  /* ---------- 機能ごとのブロック一覧 ---------- */
  updateSys() {
    if (!this.dirtySys) return;
    this.dirtySys = false;
    const s = {
      thr: [[], [], [], []], thrCap: [0, 0, 0, 0], torque: 0, seats: [], pilotSeats: [], turrets: [], fixed: [], beams: [],
      batteries: [], tanks: [], cargos: [], gens: [], solars: [], reactors: [], shields: [], arcs: [], o2gens: [],
      refineries: [], assemblers: [], doors: [], beds: [], medbays: [], chargers: [], connectors: [], dronebays: [],
      repairs: [], pods: [], jumps: [], anchors: [], kiosks: [], bioCores: [], jaws: [], regens: [], airbarriers: [],
      remotes: [], aicore: null, bridge: null, shipyards: [], gyros: [], drills: [], catapults: [], hangars: 0,
      powerUse: 0,
    };
    for (const b of this.blocks) {
      if (!b) continue;
      const d = b.def;
      if (d.thrust) { const push = (b.r + 2) & 3; s.thr[push].push(b); s.thrCap[push] += d.thrust; }
      if (d.torque) { s.torque += d.torque; if (d.id === 'gyro') s.gyros.push(b); }
      if (d.seat) { s.seats.push(b); if (d.seat === 'pilot') s.pilotSeats.push(b); }
      if (d.bridge) s.bridge = b;
      if (d.turret) s.turrets.push(b);
      if (d.fixed) s.fixed.push(b);
      if (d.drill) s.drills.push(b);
      if (d.cap) s.batteries.push(b);
      if (d.h2cap) s.tanks.push(b);
      if (d.cargo) s.cargos.push(b);
      if (d.gen && !d.rodTime) s.gens.push(b);
      if (d.rodTime) s.reactors.push(b);
      if (d.solar) s.solars.push(b);
      if (d.shieldCap) s.shields.push(b);
      if (d.arcCap) s.arcs.push(b);
      if (d.o2gen) s.o2gens.push(b);
      if (d.refine) s.refineries.push(b);
      if (d.assemble) s.assemblers.push(b);
      if (d.door) s.doors.push(b);
      if (d.bed) s.beds.push(b);
      if (d.medbay) s.medbays.push(b);
      if (d.charger) s.chargers.push(b);
      if (d.connector) s.connectors.push(b);
      if (d.drones) s.dronebays.push(b);
      if (d.repair) s.repairs.push(b);
      if (d.pod) s.pods.push(b);
      if (d.jump) s.jumps.push(b);
      if (d.anchor) s.anchors.push(b);
      if (d.kiosk) s.kiosks.push(b);
      if (d.bioCore) s.bioCores.push(b);
      if (d.jaw) s.jaws.push(b);
      if (d.regen) s.regens.push(b);
      if (d.airBarrier) s.airbarriers.push(b);
      if (d.remote) s.remotes.push(b);
      if (d.aicore) s.aicore = b;
      if (d.shipyard) s.shipyards.push(b);
      if (d.catapult) s.catapults.push(b);
      if (d.hangar) s.hangars++;
      if (d.power < 0) s.powerUse += -d.power;
    }
    this.sys = s;
    this.shieldMax = s.shields.reduce((t, b) => t + b.def.shieldCap, 0);
    this.h2cap = s.tanks.reduce((t, b) => t + b.def.h2cap, 0);
    this.h2 = s.tanks.reduce((t, b) => t + b.h2, 0);
    this.power.cap = s.batteries.reduce((t, b) => t + b.def.cap, 0);
  }
  hasControl() { this.updateSys(); return this.sys.pilotSeats.length > 0 || this.sys.bioCores.length > 0; }

  /* ---------- 部屋と空気 ----------
     床のマスを塗りつぶし、気密なマスで止まれば部屋。空き・気密でないマスに出たら漏れている。 */
  airClass(i, j) {
    const k = this.idx(i, j);
    if (k < 0) return 0;
    const v = this.cells[k];
    if (!v) return 0;
    if (this.terrain) return 2;                      // 岩は気密
    const b = this.blocks[v - 1], d = b.def;
    if (d.door) return b.open > 0.5 ? 1 : 2;
    if (d.airBarrier) return b.powered === false ? 0 : 2;
    if (d.air === 'room') return 1;
    if (d.air === 'leak') return 0;
    return 2;
  }
  updateRooms(rockGrid) {
    if (!this.dirtyRooms || this.terrain) return;
    this.dirtyRooms = false;
    if (rockGrid) this.ensure(rockGrid.minX, rockGrid.minY, rockGrid.minX + rockGrid.w - 1, rockGrid.minY + rockGrid.h - 1);
    const n = this.w * this.h;
    const oldRoomOf = this.roomOf && this.roomOf.length === n ? this.roomOf : null;
    const oldRooms = this.rooms;
    const roomOf = new Int32Array(n).fill(-1);
    const rooms = [];
    const stack = [];
    const cls = (i, j) => {
      let c = this.airClass(i, j);
      // 基地は小惑星の岩を気密な壁として使う
      if (c === 0 && rockGrid) {
        if (rockGrid.tt(i, j)) c = 2;
        else if (rockGrid.dugAt(i, j) && !this.occupied(i, j)) c = 1;
      }
      return c;
    };
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const k0 = y * this.w + x;
      if (roomOf[k0] >= 0) continue;
      const i0 = x + this.minX, j0 = y + this.minY;
      if (cls(i0, j0) !== 1) continue;
      const room = { id: rooms.length, cells: [], leak: false, air: 0, size: 0 };
      roomOf[k0] = room.id; stack.push(i0, j0);
      while (stack.length) {
        const j = stack.pop(), i = stack.pop();
        room.cells.push(i, j);
        if (oldRoomOf) { const ok = this.idx(i, j), orid = oldRoomOf[ok]; if (orid >= 0 && oldRooms[orid]) room.air += oldRooms[orid].size ? oldRooms[orid].air / oldRooms[orid].size : 0; }
        for (let d = 0; d < 4; d++) {
          const ni = i + DIRS[d][0], nj = j + DIRS[d][1];
          const nk = this.idx(ni, nj);
          if (nk < 0) { room.leak = true; continue; }
          const c = cls(ni, nj);
          if (c === 0) { room.leak = true; continue; }
          if (c === 2 || roomOf[nk] >= 0) continue;
          roomOf[nk] = room.id; stack.push(ni, nj);
        }
      }
      room.size = room.cells.length / 2;
      room.air = Math.min(room.air, room.size);
      rooms.push(room);
    }
    // 部屋の境目が変わったら、その部屋の床を描き直す
    for (const r of rooms) {
      const was = r.cells.length && oldRoomOf ? oldRooms[oldRoomOf[this.idx(r.cells[0], r.cells[1])]] : null;
      if (was && was.leak && !r.leak) r.air = Math.min(r.air, r.size * 0.02);
      if (was && !was.leak && r.leak && was.air / Math.max(1, was.size) > 0.3) r.breach = 1;
    }
    this.rooms = rooms; this.roomOf = roomOf;
    this.chunks.forEach((c) => { c.dirty = true; });
  }
  roomAt(i, j) { const k = this.idx(i, j); if (k < 0 || !this.roomOf) return null; const r = this.roomOf[k]; return r >= 0 ? this.rooms[r] : null; }
  pressureAt(i, j) { const r = this.roomAt(i, j); return r ? (r.leak ? 0 : r.air / r.size) : 0; }

  /* ---------- 貨物 (貨物庫ごとに持ち、画面では1つの在庫に見せる) ---------- */
  invTotal(id) { this.updateSys(); let n = 0; for (const b of this.sys.cargos) n += b.inv[id] || 0; return n; }
  invAll() { this.updateSys(); const o = {}; for (const b of this.sys.cargos) for (const k in b.inv) o[k] = (o[k] || 0) + b.inv[k]; return o; }
  invUsed() { this.updateSys(); let n = 0; for (const b of this.sys.cargos) n += b.used; return n; }
  invCap() { this.updateSys(); let n = 0; for (const b of this.sys.cargos) n += b.def.cargo; return n; }
  /* 入れる。入りきらなかった数を返す */
  invAdd(id, n) {
    this.updateSys();
    const ammo = ITEMS[id] && ITEMS[id].kind === 'ammo';
    const order = this.sys.cargos.slice().sort((a, b) => (ammo ? (b.def.ammoOnly ? 1 : 0) - (a.def.ammoOnly ? 1 : 0) : (a.def.ammoOnly ? 1 : 0) - (b.def.ammoOnly ? 1 : 0)));
    for (const b of order) {
      if (n <= 0) break;
      if (b.def.ammoOnly && !ammo) continue;
      const room = b.def.cargo - b.used;
      if (room <= 0) continue;
      const k = Math.min(room, n);
      b.inv[id] = (b.inv[id] || 0) + k; b.used += k; n -= k;
    }
    return n;
  }
  /* 取り出す。取り出せた数を返す */
  invTake(id, n) {
    this.updateSys();
    let got = 0;
    for (const b of this.sys.cargos) {
      if (got >= n) break;
      const have = b.inv[id] || 0;
      if (!have) continue;
      const k = Math.min(have, n - got);
      b.inv[id] = have - k; b.used -= k; got += k;
      if (!b.inv[id]) delete b.inv[id];
    }
    return got;
  }
  invFree() { return this.invCap() - this.invUsed(); }
}
Grid.seq = 0;

/* ブロックが持つ状態の初期値 */
function initBlockState(b) {
  const d = b.def;
  if (d.cargo) { b.inv = {}; b.used = 0; }
  if (d.cap) b.charge = d.cap * 0.5;
  if (d.h2cap) b.h2 = 0;
  if (d.turret || d.fixed) { b.ta = 0; b.cd = Math.random() * 0.5; b.firing = false; }
  if (d.weapon === 'rail') b.charge = 0;
  if (d.shieldCap) b.charge = 0;
  if (d.arcCap) b.charge = d.arcCap;
  if (d.door) { b.open = 0; b.lock = false; }
  if (d.refine || d.assemble) { b.job = null; b.prog = 0; }
  if (d.assemble) b.recipe = null;
  if (d.rodTime) b.fuel = 0;
  if (d.o2gen) b.prog = 0;
  if (d.drones) b.drones = d.drones;
  if (d.jump) b.charge = 0;
  if (d.seat) b.occ = null;
}

/* ---------- 型 (ASCII) から作る ---------- */
function gridFromRows(rows, o = {}) {
  const g = new Grid(o);
  const legend = Object.assign({}, LEGEND, o.legend || {});
  const H = rows.length;
  const covered = new Set();
  const rng = o.rng || new RNG(1);
  const cx = o.cx || 0, cy = o.cy || 0;
  for (let y = 0; y < H; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ' || ch === '+') continue;
      let ent = legend[ch];
      if (ch === 'w') { const small = (o.weapons || ['mg']).filter((id) => BLOCKS[id].size[0] === 1 && BLOCKS[id].size[1] === 1); ent = [rng.pick(small.length ? small : ['mg']), 0]; }
      if (ch === 'a') ent = [rng.chance(o.armorChance || 0) ? 'armor' : 'wall', 0];
      if (!ent) throw new Error(`型「${o.name}」の文字 ${ch} が分からない (${x},${y})`);
      const b = g.addBlock(ent[0], x - cx, y - cy, ent[1]);
      if (!b) throw new Error(`型「${o.name}」の (${x},${y}) ${ch} が重なっている`);
      for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) covered.add(i + ',' + j);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < rows[y].length; x++)
    if (rows[y][x] === '+' && !covered.has((x - cx) + ',' + (y - cy))) throw new Error(`型「${o.name}」の + (${x},${y}) を埋めるブロックがない`);
  return g;
}
function makeShip(key, o = {}) {
  const t = SHIPS[key];
  const W = Math.max(...t.rows.map((r) => r.length)), H = t.rows.length;
  const g = gridFromRows(t.rows, Object.assign({ name: t.name, cx: Math.floor(W / 2), cy: Math.floor(H / 2), faction: t.faction }, o));
  g.template = key;
  g.updateMass(); g.updateSys();
  return g;
}

/* ---------- つながりと分断 ---------- */
function splitGrid(g) {
  g.dirtySplit = false;
  if (g.terrain || g.count === 0) return [];
  const seen = new Uint8Array(g.blocks.length);
  const comps = [];
  for (const b0 of g.blocks) {
    if (!b0 || seen[b0.i]) continue;
    const comp = [];
    const st = [b0]; seen[b0.i] = 1;
    while (st.length) {
      const b = st.pop(); comp.push(b);
      for (let j = b.y - 1; j <= b.y + b.h; j++) for (let i = b.x - 1; i <= b.x + b.w; i++) {
        const inX = i >= b.x && i < b.x + b.w, inY = j >= b.y && j < b.y + b.h;
        if (inX === inY) continue;                 // 角と自分自身は見ない (辺だけ)
        const nb = g.at(i, j);
        if (nb && !seen[nb.i]) { seen[nb.i] = 1; st.push(nb); }
      }
    }
    comps.push(comp);
  }
  if (comps.length <= 1) return [];
  // 操縦席がある塊のうち一番大きいものを元の船として残す。基地は岩に触れている塊を全部残す
  const rock = g.rockGrid;
  const onRock = (c) => rock && c.some((b) => { for (let j = b.y - 1; j <= b.y + b.h; j++) for (let i = b.x - 1; i <= b.x + b.w; i++) if (rock.tt(i, j)) return true; return false; });
  const score = (c) => c.length + (c.some((b) => b.def.seat === 'pilot' || b.def.bioCore || b.def.anchor || b.def.kiosk) ? 1e6 : 0) + (onRock(c) ? 1e6 : 0);
  comps.sort((a, b) => score(b) - score(a));
  const pieces = [];
  for (let k = 1; k < comps.length; k++) {
    const comp = comps[k];
    if (rock && onRock(comp)) continue;
    const ng = new Grid({ kind: 'debris', faction: null, name: '破片' });
    ng.a = g.a;
    for (const b of comp) {
      const st = Object.assign({}, b); delete st.i; delete st.def; delete st.x; delete st.y; delete st.r; delete st.w; delete st.h;
      g.removeBlock(b);
      const nb = ng.addBlock(b.def.id, b.x, b.y, b.r, st);
      // 座っていた人は新しい塊の席へ
      if (b.occ && nb) { const o = b.occ; nb.occ = o; o.seat = nb; o.grid = ng; o.path = null; if (o.kind === 'crew') o.gridId = ng.id; b.occ = null; }
    }
    // ローカル座標をそのまま引き継ぐので、重心も同じ基準で合わせる
    ng.comX = g.comX; ng.comY = g.comY; ng.x = g.x; ng.y = g.y;
    ng.updateMass();
    const v = g.velAt(ng.x, ng.y);
    ng.vx = v.x; ng.vy = v.y; ng.va = g.va;
    ng.loan = g.loan;
    pieces.push(ng);
  }
  g.dirtySplit = false;
  return pieces;
}

/* ---------- 保存 ---------- */
function gridToSave(g) {
  const bin = [];
  const extra = {};
  for (const b of g.blocks) {
    if (!b) continue;
    bin.push(b.def.index, b.x + 32768, b.y + 32768, b.r);
    const e = {};
    if (b.hp < b.def.hp) e.hp = Math.round(b.hp);
    if (b.inv && b.used) e.inv = b.inv;
    if (b.charge != null) e.charge = Math.round(b.charge);
    if (b.h2) e.h2 = Math.round(b.h2);
    if (b.fuel) e.fuel = Math.round(b.fuel);
    if (b.recipe) e.recipe = b.recipe;
    if (b.job != null) { e.job = b.job; e.prog = +(b.prog || 0).toFixed(2); }
    // 出撃中の無人機も数に入れて保存する (読み込むとベイに戻っている)
    if (b.def.drones) { const n = (b.drones || 0) + (b.out || 0); if (n !== b.def.drones) e.drones = n; }
    if (b.lock) e.lock = 1;
    if (Object.keys(e).length) extra[bin.length / 4 - 1] = e;
  }
  const u16 = new Uint16Array(bin);
  let s = '';
  const bytes = new Uint8Array(u16.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  const rooms = g.rooms.filter((r) => !r.leak && r.size).map((r) => [r.cells[0], r.cells[1], +(r.air / r.size).toFixed(2)]);
  return {
    id: g.id, kind: g.kind, faction: g.faction, name: g.name, x: +g.x.toFixed(2), y: +g.y.toFixed(2), a: +g.a.toFixed(4),
    vx: +g.vx.toFixed(2), vy: +g.vy.toFixed(2), va: +g.va.toFixed(3), comX: g.comX, comY: g.comY,
    static: g.static, b: btoa(s), extra, rooms, order: g.order, loan: g.loan || undefined, template: g.template,
    rockId: g.rockId, crewIds: g.crewIds, fleet: g.fleet || undefined, bp: g.bp || undefined,
    derelict: g.derelict || undefined, hideout: g.hideout || undefined, bpLoot: g.bpLoot || undefined, plan: g.plan || undefined,
    asmQueue: g.asmQueue || undefined, refineOff: g.refineOff || undefined, disabled: g.disabled || undefined, bountyPaid: g.bountyPaid || undefined,
    abandoned: g.abandoned || undefined, selfDestruct: g.selfDestruct != null ? g.selfDestruct : undefined, escortTo: g.escortTo || undefined, rescueId: g.rescueId || undefined,
    dockedTo: g.dockedTo ? g.dockedTo.id : undefined, dockRel: g.dockRel || undefined, startCount: g.startCount || undefined, crewSlots: g.crewSlots || undefined,
  };
}
function gridFromSave(o) {
  const g = new Grid({ kind: o.kind, faction: o.faction, name: o.name, static: o.static });
  if (o.id) { g.id = o.id; Grid.seq = Math.max(Grid.seq, o.id); }
  const s = atob(o.b);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  const u16 = new Uint16Array(bytes.buffer);
  for (let k = 0; k < u16.length; k += 4) {
    const def = BLOCK_LIST[u16[k]];
    const b = g.addBlock(def.id, u16[k + 1] - 32768, u16[k + 2] - 32768, u16[k + 3]);
    const e = o.extra[k / 4];
    if (b && e) Object.assign(b, e, e.inv ? { inv: Object.assign({}, e.inv), used: Object.values(e.inv).reduce((t, v) => t + v, 0) } : {});
  }
  g.comX = o.comX; g.comY = o.comY; g.x = o.x; g.y = o.y; g.a = o.a;
  g.updateMass();
  g.vx = o.vx; g.vy = o.vy; g.va = o.va;
  g.order = o.order || null; g.loan = o.loan; g.template = o.template; g.rockId = o.rockId;
  g.crewIds = o.crewIds || []; g.fleet = o.fleet; g.bp = o.bp;
  for (const k of ['derelict', 'hideout', 'bpLoot', 'plan', 'asmQueue', 'refineOff', 'disabled', 'bountyPaid', 'dockRel', 'startCount', 'crewSlots', 'abandoned', 'selfDestruct', 'escortTo', 'rescueId']) if (o[k] != null) g[k] = o[k];
  g.dockedToId = o.dockedTo;
  g.savedRooms = o.rooms;
  return g;
}
/* 保存しておいた部屋の空気を戻す */
function restoreRooms(g) {
  if (!g.savedRooms) return;
  g.updateRooms(g.rockGrid);
  for (const [i, j, p] of g.savedRooms) { const r = g.roomAt(i, j); if (r && !r.leak) r.air = p * r.size; }
  g.savedRooms = null;
}

/* 設計図: ブロックの並びだけを持つ */
function gridToBlueprint(g, name) {
  const list = [];
  let x0 = Infinity, y0 = Infinity;
  g.eachBlock((b) => { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); });
  g.eachBlock((b) => { if (!b.def.noBuild) list.push([b.def.id, b.x - x0, b.y - y0, b.r]); });
  return { name: name || g.name, blocks: list };
}
function blueprintCost(bp) {
  const c = {};
  for (const [id] of bp.blocks) { const d = BLOCKS[id]; for (const k in d.cost) c[k] = (c[k] || 0) + d.cost[k]; }
  return c;
}
function costValue(cost) { let v = 0; for (const k in cost) v += ITEMS[k].price * cost[k]; return v; }
function blueprintCode(bp) {
  const s = JSON.stringify({ n: bp.name, b: bp.blocks.map(([id, x, y, r]) => [BLOCKS[id].index, x, y, r]) });
  return 'OA1:' + btoa(unescape(encodeURIComponent(s)));
}
function blueprintFromCode(code) {
  const m = /^OA1:(.+)$/.exec(code.trim());
  if (!m) return null;
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    return { name: o.n, blocks: o.b.filter((e) => BLOCK_LIST[e[0]] && !BLOCK_LIST[e[0]].noBuild).map(([k, x, y, r]) => [BLOCK_LIST[k].id, x, y, r & 3]) };
  } catch (e) { return null; }
}
function gridFromBlueprint(bp, o = {}) {
  const g = new Grid(Object.assign({ kind: 'ship', name: bp.name }, o));
  let W = 0, H = 0;
  for (const [id, x, y, r] of bp.blocks) { const [w, h] = Grid.sizeOf(BLOCKS[id], r); W = Math.max(W, x + w); H = Math.max(H, y + h); }
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
  for (const [id, x, y, r] of bp.blocks) g.addBlock(id, x - cx, y - cy, r);
  g.updateMass(); g.updateSys();
  return g;
}
