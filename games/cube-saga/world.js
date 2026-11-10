/* ワールド: 3つのディメンションの地形生成・建物・光・変更の記録 */
'use strict';
(function () {
  const CS = window.CS;
  const B = CS.B, OPAQUE = CS.OPAQUE, ATT = CS.ATT, EMIT = CS.EMIT;

  const DIMS = {
    over: { name: 'ふつうの せかい', W: 256, D: 256, H: 72 },
    ancient: { name: 'こだいの せかい', W: 192, D: 192, H: 72 },
    sky: { name: 'てんくうの せかい', W: 160, D: 160, H: 80 },
  };

  class World {
    constructor(dim, seed) {
      const c = DIMS[dim];
      this.dim = dim; this.seed = seed | 0;
      this.W = c.W; this.D = c.D; this.H = c.H;
      const n = this.W * this.D * this.H;
      this.b = new Uint8Array(n);
      this.sky = new Uint8Array(n);
      this.bl = new Uint8Array(n);
      this.CX = this.W >> 4; this.CZ = this.D >> 4;
      this.dirty = new Uint8Array(this.CX * this.CZ).fill(1);
      this.diffs = new Map();
      this.info = { npcs: [] };
      this.batch = null;
      this.recording = false;
    }
    idx(x, y, z) { return (y * this.D + z) * this.W + x; }
    inside(x, y, z) { return x >= 0 && z >= 0 && y >= 0 && x < this.W && z < this.D && y < this.H; }
    get(x, y, z) {
      x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
      if (y < 0) return B.bedrock;
      if (y >= this.H || x < 0 || z < 0 || x >= this.W || z >= this.D) return 0;
      return this.b[(y * this.D + z) * this.W + x];
    }
    raw(x, y, z, id) { if (this.inside(x, y, z)) this.b[this.idx(x, y, z)] = id; }
    rawIf(x, y, z, id, onlyAir) { if (this.inside(x, y, z) && (!onlyAir || this.b[this.idx(x, y, z)] === 0)) this.b[this.idx(x, y, z)] = id; }
    topY(x, z) {
      for (let y = this.H - 1; y >= 0; y--) { const id = this.get(x, y, z); if (CS.SOLID[id] || id === B.water) return y; }
      return -1;
    }
    set(x, y, z, id) {
      if (!this.inside(x, y, z)) return false;
      const i = this.idx(x, y, z);
      if (this.b[i] === id) return false;
      this.b[i] = id;
      if (this.recording) this.diffs.set(i, id);
      if (this.batch) {
        const bb = this.batch;
        bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], z); bb[2] = Math.max(bb[2], x); bb[3] = Math.max(bb[3], z);
      } else this.relight(x, z, x, z);
      this.markDirty(x - 1, z - 1, x + 1, z + 1);
      return true;
    }
    beginBatch() { this.batch = [1e9, 1e9, -1e9, -1e9]; }
    endBatch() { const bb = this.batch; this.batch = null; if (bb[0] <= bb[2]) { this.relight(bb[0], bb[1], bb[2], bb[3]); this.markDirty(bb[0] - 1, bb[1] - 1, bb[2] + 1, bb[3] + 1); } }
    markDirty(x0, z0, x1, z1) {
      const cx0 = CS.clamp(x0 >> 4, 0, this.CX - 1), cx1 = CS.clamp(x1 >> 4, 0, this.CX - 1);
      const cz0 = CS.clamp(z0 >> 4, 0, this.CZ - 1), cz1 = CS.clamp(z1 >> 4, 0, this.CZ - 1);
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) this.dirty[cz * this.CX + cx] = 1;
    }

    // ---------- 光 ----------
    // 空の光は上からまっすぐ届き、そこから横にしみ出す。ブロックの光は光るブロックから広がる。
    spread(arr, q, qn) {
      const W = this.W, D = this.D, H = this.H, WD = W * D, b = this.b;
      let head = 0;
      const MASK = q.length - 1;
      while (head !== qn) {
        const i = q[head]; head = (head + 1) & MASK;
        const L = arr[i];
        if (L <= 1) continue;
        const x = i % W, z = ((i / W) | 0) % D, y = (i / WD) | 0;
        for (let k = 0; k < 6; k++) {
          let n;
          if (k === 0) { if (x === 0) continue; n = i - 1; }
          else if (k === 1) { if (x === W - 1) continue; n = i + 1; }
          else if (k === 2) { if (z === 0) continue; n = i - W; }
          else if (k === 3) { if (z === D - 1) continue; n = i + W; }
          else if (k === 4) { if (y === 0) continue; n = i - WD; }
          else { if (y === H - 1) continue; n = i + WD; }
          const id = b[n];
          if (OPAQUE[id]) continue;
          const nl = L - 1 - ATT[id];
          if (nl > arr[n]) { arr[n] = nl; q[qn] = n; qn = (qn + 1) & MASK; }
        }
      }
    }
    skyColumn(x, z) {
      let l = 15;
      for (let y = this.H - 1; y >= 0; y--) {
        const i = this.idx(x, y, z), id = this.b[i];
        if (OPAQUE[id]) l = 0; else if (l > 0) l = Math.max(0, l - ATT[id]);
        this.sky[i] = l;
      }
    }
    lightAll() {
      const W = this.W, D = this.D, H = this.H;
      this.bl.fill(0);
      for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) this.skyColumn(x, z);
      const q = World.queue();
      let qn = 0; const MASK = q.length - 1;
      for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
        const i = this.idx(x, y, z), s = this.sky[i];
        if (s > 1) {
          // 横に暗いとなりがあるときだけ広げる起点にする
          if ((x > 0 && this.sky[i - 1] < s - 1 && !OPAQUE[this.b[i - 1]]) || (x < W - 1 && this.sky[i + 1] < s - 1 && !OPAQUE[this.b[i + 1]]) ||
            (z > 0 && this.sky[i - W] < s - 1 && !OPAQUE[this.b[i - W]]) || (z < D - 1 && this.sky[i + W] < s - 1 && !OPAQUE[this.b[i + W]])) {
            q[qn] = i; qn = (qn + 1) & MASK;
          }
        }
        if (qn > MASK - 64) { this.spread(this.sky, q, qn); qn = 0; }
      }
      this.spread(this.sky, q, qn);
      qn = 0;
      for (let i = 0; i < this.b.length; i++) { const e = EMIT[this.b[i]]; if (e) { this.bl[i] = e; q[qn] = i; qn = (qn + 1) & MASK; } }
      this.spread(this.bl, q, qn);
    }
    // 変えた場所のまわり (±15) だけ光を計算し直す
    relight(ax, az, bx, bz) {
      const W = this.W, D = this.D, H = this.H;
      const x0 = Math.max(0, ax - 15), x1 = Math.min(W - 1, bx + 15), z0 = Math.max(0, az - 15), z1 = Math.min(D - 1, bz + 15);
      const rw = x1 - x0 + 1, rd = z1 - z0 + 1;
      const old = new Uint8Array(rw * rd * H * 2);
      let k = 0;
      for (let y = 0; y < H; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const i = this.idx(x, y, z); old[k++] = this.sky[i]; old[k++] = this.bl[i]; this.bl[i] = 0;
      }
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.skyColumn(x, z);
      const q = World.queue(), MASK = q.length - 1;
      let qs = 0;
      const qb = World.queue2();
      let qbn = 0;
      const push = (i) => {
        if (this.sky[i] > 1) { q[qs] = i; qs = (qs + 1) & MASK; }
        if (this.bl[i] > 1) { qb[qbn] = i; qbn = (qbn + 1) & MASK; }
      };
      for (let y = 0; y < H; y++) for (let z = z0 - 1; z <= z1 + 1; z++) for (let x = x0 - 1; x <= x1 + 1; x++) {
        if (x < 0 || z < 0 || x >= W || z >= D) continue;
        const i = this.idx(x, y, z);
        const border = x < x0 || x > x1 || z < z0 || z > z1;
        if (!border) { const e = EMIT[this.b[i]]; if (e) this.bl[i] = e; }
        push(i);
      }
      this.spread(this.sky, q, qs);
      this.spread(this.bl, qb, qbn);
      k = 0;
      for (let y = 0; y < H; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const i = this.idx(x, y, z);
        if (old[k] !== this.sky[i] || old[k + 1] !== this.bl[i]) this.dirty[(z >> 4) * this.CX + (x >> 4)] = 1;
        k += 2;
      }
    }

    // ---------- 保存 ----------
    diffArray() { const a = []; for (const [i, id] of this.diffs) a.push(i, id); return a; }
    applyDiffs(a) {
      if (!a) return;
      for (let k = 0; k + 1 < a.length; k += 2) { const i = a[k], id = a[k + 1]; if (i >= 0 && i < this.b.length) { this.b[i] = id; this.diffs.set(i, id); } }
    }
  }
  let Q1 = null, Q2 = null;
  World.queue = () => (Q1 || (Q1 = new Int32Array(1 << 21)));
  World.queue2 = () => (Q2 || (Q2 = new Int32Array(1 << 20)));

  // ================= 共通の部品 =================
  function heightMapLoop(w, fn) {
    const hm = new Int16Array(w.W * w.D);
    for (let z = 0; z < w.D; z++) for (let x = 0; x < w.W; x++) hm[z * w.W + x] = fn(x, z);
    return hm;
  }
  function oakTree(w, x, y, z, r) {
    const h = 4 + Math.floor(r() * 3);
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy >= 0 ? 1 : 2;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy === 1 || r() < 0.5)) continue;
        w.rawIf(x + dx, y + h + dy, z + dz, B.leaves, true);
      }
    }
    for (let i = 0; i < h; i++) w.raw(x, y + i, z, B.log);
  }
  function heroTree(w, x, y, z, r) {
    const h = 7 + Math.floor(r() * 4), R = 2.6 + r() * 0.8;
    for (let dy = -3; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      if (Math.hypot(dx, dy * 1.2, dz) <= R) w.rawIf(x + dx, y + h + dy, z + dz, B.heroLeaves, true);
    }
    for (let i = 0; i < h; i++) w.raw(x, y + i, z, B.heroLog);
  }
  function cycad(w, x, y, z, r) {
    const h = 3 + Math.floor(r() * 3);
    for (let i = 0; i < h; i++) w.raw(x, y + i, z, B.cycad);
    const t = y + h;
    w.rawIf(x, t, z, B.cycadLeaves, true);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      w.rawIf(x + dx, t, z + dz, B.cycadLeaves, true);
      w.rawIf(x + dx * 2, t - 1, z + dz * 2, B.cycadLeaves, true);
    }
  }
  function caves(w, r, count, hm, avoid) {
    for (let c = 0; c < count; c++) {
      let x = r() * w.W, z = r() * w.D, y = 6 + r() * 30;
      let yaw = r() * Math.PI * 2, pitch = (r() - 0.5) * 0.4;
      const steps = 50 + r() * 80;
      for (let s = 0; s < steps; s++) {
        yaw += (r() - 0.5) * 0.5; pitch = CS.clamp(pitch + (r() - 0.5) * 0.2, -0.5, 0.5);
        x += Math.cos(yaw) * Math.cos(pitch); z += Math.sin(yaw) * Math.cos(pitch); y += Math.sin(pitch);
        const rad = 1.3 + Math.sin(s * 0.3) * 0.4 + r() * 0.8;
        if (avoid && avoid(x, y, z)) continue;
        for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) {
          if (dx * dx + dy * dy + dz * dz > rad * rad) continue;
          const X = Math.floor(x + dx), Y = Math.floor(y + dy), Z = Math.floor(z + dz);
          if (Y < 1 || !w.inside(X, Y, Z)) continue;
          const id = w.b[w.idx(X, Y, Z)];
          if (id === B.bedrock || id === B.water || id === 0) continue;
          // 水の真下は掘らない (水が宙に浮くのを防ぐ)
          if (w.get(X, Y + 1, Z) === B.water) continue;
          w.b[w.idx(X, Y, Z)] = 0;
        }
      }
    }
  }
  function veins(w, r, id, count, ymax, inside, size) {
    for (let c = 0; c < count; c++) {
      let x = Math.floor(r() * w.W), z = Math.floor(r() * w.D), y = 1 + Math.floor(r() * ymax);
      const n = (size || 3) + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        if (w.inside(x, y, z) && w.b[w.idx(x, y, z)] === inside) w.b[w.idx(x, y, z)] = id;
        const d = Math.floor(r() * 6);
        if (d === 0) x++; else if (d === 1) x--; else if (d === 2) z++; else if (d === 3) z--; else if (d === 4) y++; else y--;
      }
    }
  }
  function box(w, x0, y0, z0, x1, y1, z1, id) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) w.raw(x, y, z, id);
  }
  function walls(w, x0, y0, z0, x1, y1, z1, id) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (x === x0 || x === x1 || z === z0 || z === z1) w.raw(x, y, z, id);
    }
  }
  function gate(w, x, y, z, frame, portal, alongX) {
    // 4×5 の枠、なかに 2×3 のゲート
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
      const edge = i === 0 || i === 3 || j === 0 || j === 4;
      const X = alongX ? x + i : x, Z = alongX ? z : z + i;
      w.raw(X, y + j, Z, edge ? frame : portal);
    }
  }

  // ================= ふつうの世界 =================
  function genOver(w) {
    const s = w.seed, r = CS.rng(s * 31 + 7);
    const W = w.W, D = w.D, SEA = 24, G = 30;
    const K = { x: 128, z: 128 };
    const fa = r() * Math.PI * 2;
    const F = { x: Math.round(K.x + Math.cos(fa) * 68), z: Math.round(K.z + Math.sin(fa) * 68), r: 22 };
    const hm = heightMapLoop(w, (x, z) => {
      const edge = CS.smooth(Math.min(x, z, W - 1 - x, D - 1 - z) / 40);
      const n = CS.fbm2(x / 64, z / 64, s), m = CS.fbm2(x / 44 + 50, z / 44, s + 7);
      let h = 20 + n * 18 + Math.max(0, m - 0.55) * 70;
      h = CS.lerp(12, h, edge);
      const dk = Math.hypot(x - K.x, z - K.z);
      if (dk < 46) h = CS.lerp(G, h, CS.smooth((dk - 38) / 8));
      const df = Math.hypot(x - F.x, z - F.z);
      if (df < F.r + 8) h = CS.lerp(31 + n * 4, h, CS.smooth((df - F.r) / 8));
      return Math.floor(CS.clamp(h, 4, w.H - 8));
    });
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const h = hm[z * W + x];
      const desert = CS.fbm2(x / 90, z / 90, s + 3) > 0.66 && Math.hypot(x - F.x, z - F.z) > F.r + 6 && Math.hypot(x - K.x, z - K.z) > 46;
      w.raw(x, 0, z, B.bedrock);
      for (let y = 1; y <= h; y++) {
        let id;
        if (y < h - 3) id = B.stone;
        else if (y < h) id = desert || h <= SEA + 1 ? B.sand : B.dirt;
        else id = h <= SEA + 1 || desert ? B.sand : h > 48 ? B.snow : B.grass;
        w.raw(x, y, z, id);
      }
      for (let y = h + 1; y <= SEA; y++) w.raw(x, y, z, B.water);
    }
    caves(w, r, 70, hm, (x, y, z) => Math.hypot(x - K.x, z - K.z) < 44 && y > G - 9 || Math.hypot(x - F.x, z - F.z) < F.r + 2 && y > 22);
    veins(w, r, B.coalOre, 900, 56, B.stone, 3);
    veins(w, r, B.ironOre, 600, 42, B.stone, 3);
    veins(w, r, B.goldOre, 160, 24, B.stone, 2);
    veins(w, r, B.diamondOre, 80, 14, B.stone, 2);
    veins(w, r, B.crystalOre, 90, 18, B.stone, 2);
    // 木と草花
    for (let z = 2; z < D - 2; z++) for (let x = 2; x < W - 2; x++) {
      const h = hm[z * W + x];
      if (w.get(x, h, z) !== B.grass && w.get(x, h, z) !== B.snow) continue;
      const dk = Math.hypot(x - K.x, z - K.z), df = Math.hypot(x - F.x, z - F.z);
      const v = CS.hash(x, z, 1, s);
      if (df < F.r) {
        if (v < 0.04) heroTree(w, x, h + 1, z, r);
        else if (v < 0.4) w.rawIf(x, h + 1, z, B.tallGrass, true);
        else if (v < 0.43) w.rawIf(x, h + 1, z, B.flowerYellow, true);
        continue;
      }
      if (dk < 40) { if (dk > 12 && v < 0.025) w.rawIf(x, h + 1, z, v < 0.012 ? B.flowerRed : B.flowerYellow, true); continue; }
      const dens = df < F.r + 10 ? 0.06 : CS.fbm2(x / 50, z / 50, s + 11) > 0.55 ? 0.035 : 0.004;
      if (v < dens && w.get(x, h, z) === B.grass) oakTree(w, x, h + 1, z, r);
      else if (v < 0.12 && w.get(x, h, z) === B.grass) w.rawIf(x, h + 1, z, B.tallGrass, true);
      else if (v < 0.13 && w.get(x, h, z) === B.grass) w.rawIf(x, h + 1, z, v < 0.125 ? B.flowerRed : B.flowerYellow, true);
    }
    buildKingdom(w, K, G);
    // 勇者の森のほこら (森のまんなかから少しはずれた場所)
    const sa = r() * Math.PI * 2, sd = 7 + r() * 8;
    const S = { x: Math.round(F.x + Math.cos(sa) * sd), z: Math.round(F.z + Math.sin(sa) * sd) };
    const sy = hm[S.z * W + S.x];
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
      if (dx * dx + dz * dz > 30) continue;
      for (let y = sy - 1; y < w.H; y++) {
        const id = w.get(S.x + dx, y, S.z + dz);
        if (y <= sy) { if (y === sy || id === 0) w.raw(S.x + dx, y, S.z + dz, B.grass); continue; }
        if (id) w.raw(S.x + dx, y, S.z + dz, 0);
      }
    }
    box(w, S.x - 3, sy, S.z - 3, S.x + 3, sy, S.z + 3, B.shrine);
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      box(w, S.x + dx, sy + 1, S.z + dz, S.x + dx, sy + 3, S.z + dz, B.shrine);
      w.raw(S.x + dx, sy + 4, S.z + dz, B.heroLeaves);
    }
    w.raw(S.x, sy + 1, S.z, B.pedestal);
    w.info.forest = F;
    w.info.shrine = { x: S.x, y: sy + 1, z: S.z };
  }

  function buildKingdom(w, K, G) {
    const info = w.info, kx = K.x, kz = K.z;
    info.kingdom = { x: kx, z: kz, r: 36 };
    // 地面をならして、上の草木をはらう
    for (let z = kz - 37; z <= kz + 37; z++) for (let x = kx - 37; x <= kx + 37; x++) {
      if (Math.hypot(x - kx, z - kz) > 37.5) continue;
      for (let y = G + 1; y < w.H; y++) w.raw(x, y, z, 0);
      for (let y = G - 3; y < G; y++) if (!CS.SOLID[w.get(x, y, z)]) w.raw(x, y, z, B.dirt);
      w.raw(x, G, z, B.grass);
    }
    // 広場と道
    for (let z = kz - 12; z <= kz + 12; z++) for (let x = kx - 12; x <= kx + 12; x++) if (Math.hypot(x - kx, z - kz) <= 11.5) w.raw(x, G, z, B.stoneBrick);
    for (let t = -36; t <= 36; t++) for (let o = -1; o <= 1; o++) {
      if (Math.abs(t) > 11) { w.raw(kx + o, G, kz + t, B.cobble); w.raw(kx + t, G, kz + o, B.cobble); }
    }
    // 噴水
    for (let z = kz - 4; z <= kz + 4; z++) for (let x = kx - 4; x <= kx + 4; x++) {
      const d = Math.hypot(x - kx, z - kz);
      if (d < 2.6) w.raw(x, G, z, B.water);
      else if (d < 3.6) w.raw(x, G + 1, z, B.stoneBrick);
    }
    box(w, kx, G, kz, kx, G + 2, kz, B.stoneBrick);
    w.raw(kx, G + 3, kz, B.lamp);
    // 町の壁
    for (let z = kz - 38; z <= kz + 38; z++) for (let x = kx - 38; x <= kx + 38; x++) {
      const d = Math.hypot(x - kx, z - kz);
      if (d < 35.5 || d >= 37) continue;
      if (Math.abs(x - kx) <= 2 || Math.abs(z - kz) <= 2) continue;
      box(w, x, G + 1, z, x, G + 4, z, B.stoneBrick);
      if ((x + z) % 2 === 0) w.raw(x, G + 5, z, B.stoneBrick);
    }
    for (const [dx, dz] of [[3, 36], [-3, 36], [3, -36], [-3, -36], [36, 3], [36, -3], [-36, 3], [-36, -3]]) w.raw(kx + dx, G + 5, kz + dz, B.lamp);
    // お城
    const cx0 = kx - 11, cx1 = kx + 11, cz0 = kz - 31, cz1 = kz - 13;
    box(w, cx0, G, cz0, cx1, G, cz1, B.planks);
    walls(w, cx0, G + 1, cz0, cx1, G + 9, cz1, B.stoneBrick);
    box(w, cx0, G + 10, cz0, cx1, G + 10, cz1, B.stoneBrick);
    for (let x = cx0; x <= cx1; x++) for (let z = cz0; z <= cz1; z++) {
      if ((x === cx0 || x === cx1 || z === cz0 || z === cz1) && (x + z) % 2 === 0) w.raw(x, G + 11, z, B.stoneBrick);
    }
    for (const [tx, tz] of [[cx0, cz0], [cx1 - 3, cz0], [cx0, cz1 - 3], [cx1 - 3, cz1 - 3]]) {
      box(w, tx, G + 1, tz, tx + 3, G + 14, tz + 3, B.stoneBrick);
      box(w, tx, G + 15, tz, tx + 3, G + 15, tz + 3, B.roof);
      w.raw(tx + 1, G + 16, tz + 1, B.woolBlue); w.raw(tx + 1, G + 17, tz + 1, B.woolBlue);
    }
    for (let x = cx0 + 4; x <= cx1 - 4; x += 3) { box(w, x, G + 4, cz1, x, G + 6, cz1, B.glass); box(w, x, G + 4, cz0, x, G + 6, cz0, B.glass); }
    for (let z = cz0 + 5; z <= cz1 - 5; z += 3) { box(w, cx0, G + 4, z, cx0, G + 6, z, B.glass); box(w, cx1, G + 4, z, cx1, G + 6, z, B.glass); }
    box(w, kx - 1, G + 1, cz1, kx + 1, G + 4, cz1, 0);
    w.raw(kx - 2, G + 4, cz1 + 1, B.lamp); w.raw(kx + 2, G + 4, cz1 + 1, B.lamp);
    box(w, kx - 1, G, cz0 + 3, kx + 1, G, cz1, B.woolRed);
    w.raw(kx, G + 1, cz0 + 2, B.goldBlock); box(w, kx, G + 1, cz0 + 1, kx, G + 3, cz0 + 1, B.goldBlock);
    for (let z = cz0 + 2; z <= cz1 - 2; z += 4) for (let x = cx0 + 3; x <= cx1 - 3; x += 4) w.raw(x, G + 10, z, B.lamp);
    for (let z = cz0 + 3; z <= cz1 - 2; z += 4) { w.raw(cx0 + 1, G + 7, z, B.lamp); w.raw(cx1 - 1, G + 7, z, B.lamp); box(w, cx0 + 1, G + 2, z + 2, cx0 + 1, G + 5, z + 2, B.woolBlue); box(w, cx1 - 1, G + 2, z + 2, cx1 - 1, G + 5, z + 2, B.woolBlue); }
    info.npcs.push({ type: 'king', x: kx + 0.5, y: G + 1, z: cz0 + 4.5, yaw: Math.PI });
    info.npcs.push({ type: 'guard', x: kx - 2.5, y: G + 1, z: cz1 + 2.5, yaw: Math.PI });
    info.npcs.push({ type: 'guard', x: kx + 3.5, y: G + 1, z: cz1 + 2.5, yaw: Math.PI });
    info.castle = { x: kx + 0.5, y: G + 1, z: cz0 + 5 };
    // お店
    function house(hx, hz, hw, hd, wall, door, npc) {
      const x0 = hx - hw, x1 = hx + hw, z0 = hz - hd, z1 = hz + hd;
      box(w, x0, G, z0, x1, G, z1, B.darkPlanks);
      walls(w, x0, G + 1, z0, x1, G + 4, z1, wall);
      for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box(w, x, G + 1, z, x, G + 4, z, B.log);
      box(w, x0 - 1, G + 5, z0 - 1, x1 + 1, G + 5, z1 + 1, B.roof);
      box(w, x0 + 1, G + 6, z0 + 1, x1 - 1, G + 6, z1 - 1, B.roof);
      w.raw(hx, G + 5, hz, B.lamp);
      for (let x = x0 + 2; x <= x1 - 2; x += 3) { w.raw(x, G + 3, z0, B.glass); w.raw(x, G + 3, z1, B.glass); }
      // ドア
      const [dx, dz] = door;
      const ddx = dx ? (dx > 0 ? x1 : x0) : hx, ddz = dz ? (dz > 0 ? z1 : z0) : hz;
      box(w, ddx, G + 1, ddz, ddx, G + 2, ddz, 0);
      w.raw(ddx + dx, G + 3, ddz + dz, B.torch);
      if (npc) info.npcs.push({ type: npc, x: hx + 0.5 - dx * (hw - 1), y: G + 1, z: hz + 0.5 - dz * (hd - 1), yaw: Math.atan2(dx, -dz) });
    }
    house(kx - 20, kz + 2, 4, 3, B.planks, [1, 0], 'shop');
    box(w, kx - 22, G + 1, kz, kx - 22, G + 1, kz + 4, B.planks); // カウンター
    house(kx + 20, kz + 2, 4, 3, B.brick, [-1, 0], 'mage');
    w.raw(kx + 23, G + 1, kz + 4, B.crystalOre); w.raw(kx + 23, G + 1, kz, B.table);
    house(kx + 19, kz - 7, 3, 3, B.planks, [0, 1], null);
    house(kx + 19, kz + 22, 3, 3, B.brick, [0, -1], null);
    house(kx - 21, kz - 8, 3, 3, B.planks, [0, 1], null);
    // 博物館
    const mx = kx - 15, mz = kz + 19, mx0 = mx - 9, mx1 = mx + 9, mz0 = mz - 6, mz1 = mz + 6;
    box(w, mx0, G, mz0, mx1, G, mz1, B.planks);
    walls(w, mx0, G + 1, mz0, mx1, G + 6, mz1, B.stoneBrick);
    box(w, mx0, G + 7, mz0, mx1, G + 7, mz1, B.stoneBrick);
    box(w, mx0 + 2, G + 7, mz - 1, mx1 - 2, G + 7, mz + 1, B.glass);
    for (let x = mx0 + 2; x <= mx1 - 2; x += 3) { box(w, x, G + 3, mz0, x, G + 4, mz0, B.glass); box(w, x, G + 3, mz1, x, G + 4, mz1, B.glass); }
    for (let x = mx0; x <= mx1; x++) if (x % 2 === 0) { w.raw(x, G + 8, mz0, B.stoneBrick); w.raw(x, G + 8, mz1, B.stoneBrick); }
    box(w, mx1, G + 1, mz - 1, mx1, G + 3, mz + 1, 0);
    w.raw(mx1 + 1, G + 4, mz - 2, B.lamp); w.raw(mx1 + 1, G + 4, mz + 2, B.lamp);
    for (let z = mz0 + 2; z <= mz1 - 2; z += 4) { w.raw(mx0 + 1, G + 5, z, B.lamp); w.raw(mx1 - 1, G + 5, z, B.lamp); }
    for (let x = mx0 + 2; x <= mx1 - 2; x += 4) { w.raw(x, G + 7, mz0 + 2, B.lamp); w.raw(x, G + 7, mz1 - 2, B.lamp); }
    info.fossilCases = [];
    for (let i = 0; i < 7; i++) { const z = mz - 3 + i; w.raw(mx0 + 1, G + 1, z, B.display); info.fossilCases.push({ x: mx0 + 1.5, y: G + 2.4, z: z + 0.5 }); }
    info.pens = [];
    for (const pz of [-3.5, 3.5]) for (const px of [-6, -2.5, 1, 4.5]) {
      info.pens.push({ x: mx + px + 0.5, y: G + 1, z: mz + pz + 0.5 });
      // ロープのかわりに赤い毛糸の床
      box(w, Math.floor(mx + px) - 1, G, Math.floor(mz + pz) - 1, Math.floor(mx + px) + 1, G, Math.floor(mz + pz) + 1, B.woolRed);
    }
    info.npcs.push({ type: 'curator', x: mx1 - 2.5, y: G + 1, z: mz + 0.5, yaw: Math.PI / 2 });
    info.museum = { x: mx, z: mz };
    // ゲート
    gate(w, kx + 5, G + 1, kz + 9, B.ancientStone, B.ancientPortal, true);
    gate(w, kx - 8, G + 1, kz + 9, B.skyStone, B.skyPortal, true);
    w.raw(kx - 8, G + 5, kz + 9, B.goldBlock); w.raw(kx - 5, G + 5, kz + 9, B.goldBlock);
    info.ancientGate = { x: kx + 7, y: G + 1, z: kz + 11.5 };
    info.skyGate = { x: kx - 6, y: G + 1, z: kz + 11.5 };
    info.spawn = { x: kx + 0.5, y: G + 1, z: kz + 6.5 };
    for (const [vx, vz] of [[-6, -6], [6, -5], [-5, 5], [8, 2]]) info.npcs.push({ type: 'villager', x: kx + vx + 0.5, y: G + 1, z: kz + vz + 0.5, yaw: 0 });
  }

  // ================= 古代の世界 =================
  function genAncient(w) {
    const s = w.seed * 7 + 99, r = CS.rng(s);
    const W = w.W, D = w.D, SEA = 22, C = W >> 1;
    const vols = [];
    for (let i = 0; i < 2; i++) { const a = r() * Math.PI * 2 + i * Math.PI; vols.push({ x: C + Math.cos(a) * 52, z: C + Math.sin(a) * 52, r: 20 }); }
    const sites = [];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + r() * 0.5, d = 18 + r() * 40; sites.push({ x: Math.round(C + Math.cos(a) * d), z: Math.round(C + Math.sin(a) * d), r: 4 + r() * 2 }); }
    const hm = heightMapLoop(w, (x, z) => {
      const edge = CS.smooth(Math.min(x, z, W - 1 - x, D - 1 - z) / 30);
      const n = CS.fbm2(x / 48, z / 48, s);
      let h = 19 + n * 16;
      for (const v of vols) {
        const d = Math.hypot(x - v.x, z - v.z);
        if (d < v.r) h += (v.r - d) * 1.5;
        if (d < 3.5) h -= (3.5 - d) * 3;
      }
      h = CS.lerp(10, h, edge);
      const dc = Math.hypot(x - C, z - C);
      if (dc < 12) h = CS.lerp(26, h, CS.smooth((dc - 8) / 4));
      for (const st of sites) { const d = Math.hypot(x - st.x, z - st.z); if (d < st.r + 3) h = CS.lerp(Math.max(SEA + 2, h - 1), h, CS.smooth((d - st.r) / 3)); }
      return Math.floor(CS.clamp(h, 4, w.H - 6));
    });
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const h = hm[z * W + x];
      let nearVol = false;
      for (const v of vols) if (Math.hypot(x - v.x, z - v.z) < v.r - 4) nearVol = true;
      let site = false;
      for (const st of sites) if (Math.hypot(x - st.x, z - st.z) < st.r) site = true;
      w.raw(x, 0, z, B.bedrock);
      for (let y = 1; y <= h; y++) {
        let id;
        if (nearVol) id = B.volcanic;
        else if (y < h - 3) id = B.ancientStone;
        else if (y < h) id = site || h <= SEA + 1 ? B.sand : B.dirt;
        else id = site || h <= SEA + 1 ? B.sand : B.ancientGrass;
        w.raw(x, y, z, id);
      }
      for (let y = h + 1; y <= SEA; y++) w.raw(x, y, z, B.water);
      // 化石 (地表から 2〜14 ブロック下に多い)
      for (let y = Math.max(2, h - 14); y < h - 1; y++) {
        const v = CS.hash(x, y, z, s);
        if (w.get(x, y, z) !== B.ancientStone) continue;
        if (v < 0.018) w.raw(x, y, z, B.fossilBlock);
        else if (v < 0.026) w.raw(x, y, z, B.amberOre);
      }
      if (site) for (let y = h - 4; y <= h; y++) {
        const v = CS.hash(x, y, z, s + 5);
        if (v < (y === h ? 0.08 : 0.22)) w.raw(x, y, z, v < 0.03 ? B.amberOre : B.fossilBlock);
      }
    }
    caves(w, r, 30, hm, (x, y, z) => Math.hypot(x - C, z - C) < 14 && y > 18);
    veins(w, r, B.coalOre, 500, 50, B.ancientStone, 3);
    veins(w, r, B.ironOre, 350, 40, B.ancientStone, 3);
    veins(w, r, B.goldOre, 120, 26, B.ancientStone, 2);
    veins(w, r, B.crystalOre, 140, 22, B.ancientStone, 2);
    veins(w, r, B.diamondOre, 40, 14, B.ancientStone, 2);
    for (let z = 2; z < D - 2; z++) for (let x = 2; x < W - 2; x++) {
      const h = hm[z * W + x];
      if (w.get(x, h, z) !== B.ancientGrass || Math.hypot(x - C, z - C) < 9) continue;
      const v = CS.hash(x, z, 3, s);
      if (v < 0.018) cycad(w, x, h + 1, z, r);
      else if (v < 0.022) oakTree(w, x, h + 1, z, r);
      else if (v < 0.3) w.rawIf(x, h + 1, z, B.fern, true);
    }
    const g = hm[C * W + C];
    gate(w, C - 1, g + 1, C - 5, B.goldBlock, B.homePortal, true);
    w.info.spawn = { x: C + 0.5, y: g + 1, z: C + 0.5 };
    w.info.sites = sites;
    w.info.hm = hm;
  }

  // ================= 天空の世界 =================
  function genSky(w) {
    const s = w.seed * 13 + 5, r = CS.rng(s);
    const C = w.W >> 1;
    function island(cx, cz, rad, top, grassTrees) {
      for (let z = Math.floor(cz - rad - 2); z <= cz + rad + 2; z++) for (let x = Math.floor(cx - rad - 2); x <= cx + rad + 2; x++) {
        const d = Math.hypot(x - cx, z - cz) / (rad * (0.9 + CS.noise2(x / 6, z / 6, s) * 0.25));
        if (d >= 1) continue;
        const t = top + Math.floor(CS.noise2(x / 9, z / 9, s + 1) * 2);
        const bot = t - Math.floor(Math.pow(1 - d, 0.7) * rad * 0.7) - 1;
        for (let y = bot; y <= t; y++) w.raw(x, y, z, y === t ? B.skyGrass : B.skyStone);
        if (grassTrees) {
          const v = CS.hash(x, z, 9, s);
          if (v < 0.015 && d < 0.7) heroTree(w, x, t + 1, z, r);
          else if (v < 0.08) w.rawIf(x, t + 1, z, v < 0.05 ? B.flowerYellow : B.tallGrass, true);
        }
      }
    }
    island(C, C, 22, 40, false);
    const ring = [];
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, rad = i === 0 ? 9 : 6 + r() * 3;
      const p = { x: Math.round(C + Math.cos(a) * 50), z: Math.round(C + Math.sin(a) * 50), top: 38 + (i % 3) * 2 };
      island(p.x, p.z, rad, p.top, i > 0); // スタートの島は 竜が 見えるように 木を 生やさない
      ring.push(p);
    }
    // 雲の橋: スタートの島からまんなかの島へ
    const sp = ring[0];
    for (let x = C + 18; x <= sp.x - 6; x++) for (let z = C - 1; z <= C + 1; z++) w.raw(x, 40, z, B.cloud);
    // ほかの島どうしも雲でつなぐ
    for (let i = 1; i < 6; i++) {
      const p = ring[i];
      const n = Math.ceil(Math.hypot(p.x - C, p.z - C));
      for (let k = 18; k < n - 5; k++) {
        const x = Math.round(C + (p.x - C) * k / n), z = Math.round(C + (p.z - C) * k / n);
        w.raw(x, 40, z, B.cloud); w.raw(x + 1, 40, z, B.cloud);
      }
    }
    // 飾りの雲
    for (let i = 0; i < 26; i++) {
      const cx = r() * w.W, cz = r() * w.D, cy = 54 + Math.floor(r() * 14), rx = 4 + r() * 8, rz = 3 + r() * 5;
      for (let z = Math.floor(cz - rz); z <= cz + rz; z++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        if (((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 < 1) w.rawIf(x, cy, z, B.cloud, true);
      }
    }
    // まんなかの島に竜のとまり木 (4本の柱)
    for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { box(w, C + dx, 41, C + dz, C + dx, 46, C + dz, B.skyStone); w.raw(C + dx, 47, C + dz, B.lamp); }
    gate(w, sp.x - 1, sp.top + 1, sp.z + 4, B.goldBlock, B.homePortal, true);
    w.info.spawn = { x: sp.x + 0.5, y: sp.top + 2, z: sp.z + 0.5 };
    w.info.center = { x: C + 0.5, y: 41, z: C + 0.5 };
  }

  function generate(dim, seed, diffs) {
    const w = new World(dim, seed);
    if (dim === 'over') genOver(w); else if (dim === 'ancient') genAncient(w); else genSky(w);
    w.applyDiffs(diffs);
    w.lightAll();
    w.recording = true;
    return w;
  }

  CS.DIMS = DIMS;
  CS.World = World;
  CS.generate = generate;
})();
