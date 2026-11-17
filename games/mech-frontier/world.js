/* MECH FRONTIER の世界: まち・くうこう・スクラップおきば・岩山・こうや を作り、あたり判定を もつ */
'use strict';
const W = (() => {
  const CELL = 16, grid = new Map(); let stamp = 0;
  const key = (cx, cz) => (cx + 600) * 4096 + (cz + 600);
  const w = { size: 1120, maxX: 832, cityR: 203, facilities: [], alleys: [], nodes: [], corners: [], planeSpots: [], showroom: { x: -940, z: 940 },
    walk: [], houses: [], lamps: [], carSpots: [], trees: [], roadLines: [-196, -140, -84, -28, 28, 84, 140, 196] };

  // ---------- あたり判定の 箱 ----------
  w.addBox = (b) => {
    for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++)
      for (let cz = Math.floor(b.z0 / CELL); cz <= Math.floor(b.z1 / CELL); cz++) {
        const k = key(cx, cz); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(b);
      }
    return b;
  };
  w.removeBox = (b) => {
    for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++)
      for (let cz = Math.floor(b.z0 / CELL); cz <= Math.floor(b.z1 / CELL); cz++) {
        const l = grid.get(key(cx, cz)); if (!l) continue; const i = l.indexOf(b); if (i >= 0) l.splice(i, 1);
      }
  };
  const out = [];
  w.near = (x, z, r) => {
    out.length = 0; stamp++;
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const l = grid.get(key(cx, cz)); if (!l) continue;
        for (const b of l) if (b.s !== stamp) { b.s = stamp; out.push(b); }
      }
    return out;
  };
  w.pointIn = (x, y, z) => {
    const l = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))); if (!l) return null;
    for (const b of l) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && y >= b.y0 && y <= b.y1) return b;
    return null;
  };
  /* 光線が 地面か 建物に 当たるまでの きょり (当たらなければ max) */
  w.raycast = (ox, oy, oz, dx, dy, dz, max) => {
    let t = 0;
    while (t < max) {
      const st = t < 60 ? .8 : 1.6; t += st;
      const y = oy + dy * t;
      if (y <= w.h(ox + dx * t, oz + dz * t)) return t - st * .5;
      if (w.pointIn(ox + dx * t, y, oz + dz * t)) return t - st * .5;
    }
    return max;
  };
  w.inCity = (x, z, m = 0) => Math.abs(x) < w.cityR + m && Math.abs(z) < w.cityR + m;
  w.inAirport = (x, z) => x > 226 && x < 660 && Math.abs(z) < 82;
  w.inTown = (x, z) => x > 236 && x < 624 && z > -564 && z < -124;
  w.inFarm = (x, z) => x > -604 && x < -256 && z > -624 && z < -296;
  w.region = (x, z) => w.inCity(x, z) ? 'city' : w.inAirport(x, z) ? 'airport' : w.inTown(x, z) ? 'town' : w.inFarm(x, z) ? 'farm' : x > 690 ? 'sea'
    : z > 232 ? 'waste' : (z < -232 && Math.abs(x) < 150) ? 'junk' : x < -232 ? 'rock' : 'grass';
  /* 地面の高さ。街・住宅街・空港・農場・海辺は 平ら。そのほかは 丘になり、西の岩山ほど 高い。 */
  w.h = (x, z) => {
    const rect = (x0, x1, z0, z1) => Math.max(x0 - x, x - x1, z0 - z, z - z1);
    const d = Math.min(Math.max(Math.abs(x), Math.abs(z)) - 216, rect(226, 630, -570, -118), rect(216, 670, -92, 92), rect(-614, -246, -634, -286), 650 - x, Math.hypot(x + 940, z - 940) - 50);
    if (d <= 0) return 0;
    const rock = smooth(-250, -430, x), amp = 4.5 + 30 * rock + 7 * smooth(250, 420, z) * (1 - rock);
    const n = vnoise(x / 95 + 11.3, z / 95 + 4.7) * .65 + vnoise(x / 41 + 3.1, z / 41 + 9.2) * .35;
    return Math.max(0, n - .38) * amp * 2.2 * smooth(0, 80, d);
  };
  w.houseAt = (x, z) => { for (const h of w.houses) if (x > h.x - 6 && x < h.x + 6 && z > h.z - 5 && z < h.z + 5) return h; return null; };

  // ---------- 動かない形を 区画ごとに ためる ----------
  const CH = 128, chunkMap = new Map();
  const FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]];
  const FN6 = FN.concat([[0, -1, 0]]);
  function sbox(x, y, z, sx, sy, sz, col, mat = 0, solid = true) {   // (x,z) は中心、y は底
    const k = Math.floor(x / CH) + ',' + Math.floor(z / CH);
    let c = chunkMap.get(k); if (!c) chunkMap.set(k, c = { v: [], box: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9] });
    const r = (col >> 16 & 255) / 255, g = (col >> 8 & 255) / 255, b = (col & 255) / 255, cy = y + sy / 2, v = c.v;
    for (const n of (y > .05 ? FN6 : FN)) {     // 浮いている箱は 下の面も 描く (家の天井など)
      const u = n[1] ? [1, 0, 0] : [0, 1, 0];
      const t = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      for (const [a, bb] of [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, -.5], [.5, .5], [-.5, .5]]) {
        v.push(x + (n[0] * .5 + u[0] * a + t[0] * bb) * sx, cy + (n[1] * .5 + u[1] * a + t[1] * bb) * sy, z + (n[2] * .5 + u[2] * a + t[2] * bb) * sz,
          n[0], n[1], n[2], r, g, b, mat);
      }
    }
    const bx = c.box;
    bx[0] = Math.min(bx[0], x - sx / 2); bx[1] = Math.min(bx[1], y); bx[2] = Math.min(bx[2], z - sz / 2);
    bx[3] = Math.max(bx[3], x + sx / 2); bx[4] = Math.max(bx[4], y + sy); bx[5] = Math.max(bx[5], z + sz / 2);
    if (solid) w.addBox({ x0: x - sx / 2, x1: x + sx / 2, z0: z - sz / 2, z1: z + sz / 2, y0: y, y1: y + sy });
  }

  /* 起伏のある 区画の 地面。8m きざみの 格子で 高さを つける。 */
  function terrain(x0, z0) {
    const N = 16, st = CH / N, k = Math.floor(x0 / CH) + ',' + Math.floor(z0 / CH);
    let c = chunkMap.get(k); if (!c) chunkMap.set(k, c = { v: [], box: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9] });
    const P = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const x = x0 + i * st, z = z0 + j * st, y = w.h(x, z); let nx = w.h(x - 2, z) - w.h(x + 2, z), nz = w.h(x, z - 2) - w.h(x, z + 2); const l = Math.hypot(nx, 4, nz);
      P.push([x, y, z, nx / l, 4 / l, nz / l]);
    }
    const v = c.v, put = (p) => v.push(p[0], p[1], p[2], p[3], p[4], p[5], 1, 1, 1, 3); let top = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const a = P[i * (N + 1) + j], b = P[(i + 1) * (N + 1) + j], cc = P[(i + 1) * (N + 1) + j + 1], dd = P[i * (N + 1) + j + 1];
      put(a); put(dd); put(cc); put(a); put(cc); put(b); top = Math.max(top, a[1], b[1], cc[1], dd[1]);
    }
    const bx = c.box; bx[0] = Math.min(bx[0], x0); bx[1] = Math.min(bx[1], -1); bx[2] = Math.min(bx[2], z0); bx[3] = Math.max(bx[3], x0 + CH); bx[4] = Math.max(bx[4], top); bx[5] = Math.max(bx[5], z0 + CH);
  }
  const WALLS = [0x8fa3b8, 0xa9b4c2, 0x6f8196, 0xc9d1da, 0x5d7a8c, 0x9a8f86, 0x7890a8, 0xb8a898];
  const NEON = [0x40e0ff, 0xff50c0, 0x80ff60, 0xffb030, 0xa070ff];
  function roofStuff(r, x, z, bw, bd, h) {
    sbox(x, h, z, bw + .6, .5, bd + .6, 0x4a525e, 0, false);                        // パラペット
    for (let k = 0; k < 3; k++) { const ax = x + (r() - .5) * bw * .6, az = z + (r() - .5) * bd * .6; sbox(ax, h + .5, az, 2.2, 1.3, 1.6, 0x9aa0a8, 0, false); sbox(ax, h + 1.8, az, 1.6, .15, 1.6, 0x30343c, 0, false); }   // 室外機
    if (r() < .5) { const ax = x - bw * .25, az = z + bd * .2; sbox(ax, h + .5, az, .3, 2.4, .3, 0x50545c, 0, false); sbox(ax, h + 2.6, az, 2.6, 2.4, 2.6, 0x8a7a66, 0, false); }      // 給水タンク
    if (r() < .5) sbox(x + bw * .2, h + .5, z - bd * .2, .35, 7 + r() * 8, .35, 0x30343c, 0, false);
  }
  function building(r, x, z, bw, bd, h, kind) {
    const col = WALLS[Math.floor(r() * WALLS.length)], neon = NEON[Math.floor(r() * NEON.length)];
    sbox(x, 0, z, bw, h, bd, col, 1);
    if (kind === 'tower') {                          // 上がすこし細い 2 段のタワー
      const h2 = h * (.25 + r() * .2); sbox(x, h, z, bw * .7, h2, bd * .7, col, 1, false); sbox(x, h, z, bw + .5, .6, bd + .5, 0x40464f, 0, false);
      roofStuff(r, x, z, bw * .7, bd * .7, h + h2); sbox(x, h + h2 + .5, z, .5, 14, .5, 0xd03030, 2, false);
    } else roofStuff(r, x, z, bw, bd, h);
    for (const [ox, oz, sx, sz] of [[0, bd / 2, bw + .3, .3], [0, -bd / 2, bw + .3, .3], [bw / 2, 0, .3, bd + .3], [-bw / 2, 0, .3, bd + .3]])
      sbox(x + ox, h - 1.2, z + oz, sx, .5, sz, neon, 2, false);
    if (kind === 'mansion') {                        // ベランダ
      const fl = Math.min(14, Math.floor(h / 3.2) - 1), side = r() < .5 ? 1 : -1;
      for (let f = 1; f <= fl; f++) { sbox(x + side * (bw / 2 + .6), f * 3.2 - .1, z, 1.2, .15, bd - 2, 0xd8dce2, 0, false); sbox(x + side * (bw / 2 + 1.15), f * 3.2, z, .1, 1, bd - 2, 0x70767e, 0, false); }
    }
    // 入口
    sbox(x, .2, z + bd / 2 + .15, 3, 2.8, .3, 0x202630, 0, false); sbox(x, 3, z + bd / 2 + .8, 4.4, .25, 1.6, neon, 2, false);
    if (r() < .35 && h > 20) { const sy = 8 + r() * (h - 16); sbox(x + bw / 2 + .25, sy, z, .3, 5, Math.min(8, bd * .5), NEON[Math.floor(r() * NEON.length)], 2, false); }
  }
  /* 木は 位置だけ 覚えておき、近くのものを 毎コマ 丸い形で描く (models.js の drawTree)。 */
  const LEAF = [0x4fae4a, 0x3f9a4a, 0x62b84e, 0x2f8a50, 0x7cc452], BLOSSOM = [0xf2a6c8, 0xf0c060, 0xe8804a];
  function tree(r, x, z, y = 0) {
    const pine = r() < .25, t = r();
    w.trees.push({ x, y, z, h: 3 + r() * 3.2, s: .85 + r() * .5, pine, col: t < .1 ? BLOSSOM[Math.floor(r() * 3)] : LEAF[Math.floor(r() * LEAF.length)], ph: r() * 6.28 });
  }
  /* 動かない 円すい (遠くの山)。面ごとの法線で、ローポリの山に見せる。 */
  function scone(x, y, z, rad, h, col, sides, tw) {
    const k = Math.floor(x / CH) + ',' + Math.floor(z / CH);
    let c = chunkMap.get(k); if (!c) chunkMap.set(k, c = { v: [], box: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9] });
    const cr = (col >> 16 & 255) / 255, cg = (col >> 8 & 255) / 255, cb = (col & 255) / 255, v = c.v;
    for (let i = 0; i < sides; i++) {
      const a0 = i / sides * 6.283 + tw, a1 = (i + 1) / sides * 6.283 + tw, x0 = Math.cos(a0) * rad, z0 = Math.sin(a0) * rad, x1 = Math.cos(a1) * rad, z1 = Math.sin(a1) * rad;
      let nx = h * (z1 - z0) * -1, ny = x0 * z1 - x1 * z0, nz = h * (x1 - x0); const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      v.push(x, y + h, z, nx, ny, nz, cr, cg, cb, 0, x + x0, y, z + z0, nx, ny, nz, cr, cg, cb, 0, x + x1, y, z + z1, nx, ny, nz, cr, cg, cb, 0);
    }
    const bx = c.box; bx[0] = Math.min(bx[0], x - rad); bx[1] = Math.min(bx[1], y); bx[2] = Math.min(bx[2], z - rad); bx[3] = Math.max(bx[3], x + rad); bx[4] = Math.max(bx[4], y + h); bx[5] = Math.max(bx[5], z + rad);
  }
  const HOUSE_COL = [0xe8dcc4, 0xd8c8b0, 0xc8d4dc, 0xe0c8c0, 0xcfd8c0, 0xf0ece0, 0xb8c4cc], ROOF_COL = [0x8a3c30, 0x3a4a5c, 0x5a4636, 0x2f5a4a, 0x70402c];
  function house(r, hx, hz, f, id) {
    const col = HOUSE_COL[Math.floor(r() * HOUSE_COL.length)], rc = ROOF_COL[Math.floor(r() * ROOF_COL.length)], H = 3.2, y0 = .15, wood = 0x8a6a48;
    sbox(hx, 0, hz, 12, y0, 10, 0xb89870, 0);                                       // 床
    sbox(hx, y0, hz - 4.85 * f, 12, H, .3, col, 0);                                  // 奥の壁
    sbox(hx - 5.85, y0, hz, .3, H, 10, col, 0); sbox(hx + 5.85, y0, hz, .3, H, 10, col, 0);
    sbox(hx - 4.4, y0, hz + 4.85 * f, 3.2, H, .3, col, 0); sbox(hx + 2.4, y0, hz + 4.85 * f, 7.2, H, .3, col, 0);   // 玄関の両がわ
    sbox(hx - 2, y0 + 2.3, hz + 4.85 * f, 1.6, H - 2.3, .3, col, 0);                 // 玄関の上
    sbox(hx - 2.85, y0, hz + 5.02 * f, .12, 2.3, .1, wood, 0, false); sbox(hx - 1.15, y0, hz + 5.02 * f, .12, 2.3, .1, wood, 0, false);
    sbox(hx - 2, 0, hz + 5.7 * f, 2.2, .1, 1.2, 0x9a9a94, 0, false);                 // 玄関ポーチ
    for (const wx of [1.2, 4]) { sbox(hx + wx, y0 + 1, hz + 5.02 * f, 1.8, 1.3, .08, 0x9fd0e8, 2, false); sbox(hx + wx, y0 + .9, hz + 5.05 * f, 2, .12, .16, 0xf4f4f0, 0, false); }
    for (const s of [-1, 1]) sbox(hx + s * 6.02, y0 + 1, hz - 1.5 * f, .08, 1.3, 2, 0x9fd0e8, 2, false);
    sbox(hx, y0 + H, hz, 13, .3, 11, rc, 0); sbox(hx, y0 + H + .3, hz, 13, .7, 8, rc, 0, false); sbox(hx, y0 + H + 1, hz, 13, .7, 4.6, rc, 0, false); sbox(hx, y0 + H + 1.7, hz, 13, .4, 1.6, rc, 0, false);
    sbox(hx + 4, y0 + H + .6, hz - 2 * f, .9, 2.2, .9, 0x8a5a48, 0, false);          // えんとつ
    // 間取り: 左がリビング、右奥が寝室、右手前が台所
    sbox(hx + 1.5, y0, hz - 2.45 * f, .2, H, 4.5, 0xf0ece4, 0); sbox(hx + 4.55, y0, hz - .2 * f, 2.4, H, .2, 0xf0ece4, 0); sbox(hx + 2.4, y0 + 2.3, hz - .2 * f, 1.9, H - 2.3, .2, 0xf0ece4, 0);
    sbox(hx + 4.6, y0, hz - 3.4 * f, 1.6, .45, 2.4, 0x4a78c8, 0); sbox(hx + 4.6, y0 + .45, hz - 4.2 * f, 1.3, .18, .6, 0xf4f4f0, 0, false); sbox(hx + 4.6, y0, hz - 4.6 * f, 1.7, .9, .15, wood, 0, false);
    sbox(hx + 2.4, y0, hz - 4.35 * f, 1.3, 2.1, .6, wood, 0); sbox(hx + 2.4, y0 + 1, hz - 4.04 * f, .08, .5, .04, 0xd0c060, 0, false);          // クローゼット
    sbox(hx - 5, y0, hz - 1.6 * f, 1, .45, 3, 0x7a5a8a, 0); sbox(hx - 5.4, y0 + .45, hz - 1.6 * f, .3, .55, 3, 0x6a4a7a, 0, false);            // ソファ
    sbox(hx - 3, y0, hz - 1.6 * f, 1.2, .45, 1.6, wood, 0); sbox(hx - 3, 0.16, hz - 1.6 * f, 3.4, .02, 3.2, 0xa04a40, 0, false);                // テーブルとラグ
    sbox(hx - 2.6, y0, hz - 4.4 * f, 2.2, .55, .5, 0x4a4038, 0);                                                                              // テレビ台
    sbox(hx + 4, y0, hz + 4.2 * f, 3.2, .95, .7, 0xe8e8e4, 0); sbox(hx + 4, y0 + .95, hz + 4.2 * f, 3.3, .06, .8, 0x50545c, 0, false);         // 台所
    sbox(hx + 5.3, y0, hz + 2.9 * f, .8, 1.9, .8, 0xd8dce0, 0); sbox(hx + 3.6, y0, hz + 1.8 * f, 1.3, .75, .9, wood, 0);
    sbox(hx - 2, y0 + H - .12, hz - 1 * f, .9, .1, .9, 0xfff0c0, 2, false); sbox(hx + 3.8, y0 + H - .12, hz - 2.6 * f, .7, .1, .7, 0xfff0c0, 2, false);
    // 庭
    sbox(hx - 3.6, 0, hz + 9.5 * f, .25, 1.1, .25, 0x70767e, 0, false); sbox(hx - 3.6, 1.1, hz + 9.5 * f, .5, .35, .7, 0xc03030, 0, false);
    for (const s of [-1, 1]) sbox(hx + s * 7.2, 0, hz + 6.5 * f, .5, .9, 7, 0x3f7a3a, 0, false);
    if (r() < .7) tree(r, hx + 4 + r() * 2, hz + 8 * f);
    const loot = [];
    const L = [['テレビ', 400, hx - 2.6, y0 + .55, hz - 4.4 * f, 'tv'], ['宝石箱', 600, hx + 2.4, y0 + 2.1, hz - 4.3 * f, 'gem'], ['現金', 200, hx + 4, y0 + 1.01, hz + 4.2 * f, 'cash'], ['ノートPC', 500, hx - 3, y0 + .45, hz - 1.6 * f, 'pc'], ['腕時計', 300, hx + 3.6, y0 + .75, hz + 1.8 * f, 'watch']];
    for (const l of L) if (r() < .62) loot.push({ name: l[0], val: l[1], x: l[2], y: l[3], z: l[4], kind: l[5], t: 0 });
    w.houses.push({ id, x: hx, z: hz, f, door: { x: hx - 2, z: hz + 6.6 * f }, loot, sale: id % 9 === 4 ? 9000 + (id % 5) * 1500 : 0,
      bed: { x: hx + 3.4, z: hz - 2.6 * f }, ward: { x: hx + 2.4, z: hz - 3.3 * f }, fridge: { x: hx + 4.6, z: hz + 2.2 * f }, inRoom: { x: hx - 3.6, z: hz + 1.5 * f }, bedRoom: { x: hx + 3.2, z: hz - 1.8 * f } });
    if (id % 4 === 1) w.carSpots.push({ x: hx - 8.5, z: hz + 4 * f, yaw: f > 0 ? 0 : Math.PI });
  }

  w.build = () => {
    const r = seeded(20261117);
    for (let gx = -9; gx < 9; gx++) for (let gz = -9; gz < 9; gz++) {
      let hi = 0; for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) hi = Math.max(hi, w.h(gx * CH + i * 16, gz * CH + j * 16));
      if (hi < .02) sbox(gx * CH + CH / 2, -1, gz * CH + CH / 2, CH, 1, CH, 0xffffff, 3, false); else terrain(gx * CH, gz * CH);
    }

    // --- 街: 7×7 の 区画 ---
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const cx = (i - 3) * 56, cz = (j - 3) * 56, dc = Math.max(Math.abs(i - 3), Math.abs(j - 3));
      const plaza = i === 3 && j === 3;
      sbox(cx, 0, cz, 44, .2, 44, plaza ? 0xb4ae9e : 0x9aa0a8, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.corners.push({ x: cx + sx * 20.5, z: cz + sz * 20.5, i, j, sx, sz });
      if (plaza) { for (let k = 0; k < 8; k++) { const a = k * .785 + .39; sbox(Math.sin(a) * 20, .2, Math.cos(a) * 20, 2.4, .5, .8, 0x7a5a40, 0, false); } continue; }
      for (const [tx, tz] of [[-19.5, -8], [-19.5, 8], [19.5, -8], [19.5, 8], [-8, 19.5], [8, -19.5]]) if (r() < .7) { sbox(cx + tx, .2, cz + tz, 1.6, .12, 1.6, 0x5a4a3a, 0, false); tree(r, cx + tx, cz + tz, .2); }
      if (i === 5 && j === 3) {              // 警察署
        sbox(cx, .2, cz - 7, 32, 9, 20, 0xe4e8ee, 1); sbox(cx, 9.2, cz - 7, 33, .7, 21, 0x1c3a8a, 0, false); sbox(cx, 3.4, cz + 4.4, 14, .4, 3, 0x1c3a8a, 0, false);
        for (const s of [-1, 1]) sbox(cx + s * 6.4, .2, cz + 5.6, .4, 3.2, .4, 0xc8ccd2, 0, false);
        sbox(cx, 6.2, cz + 3.2, 9, 1.6, .3, 0x40a0ff, 2, false); sbox(cx + 12, 9.9, cz - 7, .3, 7, .3, 0x30343c, 0, false); sbox(cx + 12, 16.5, cz - 7, 1, 1, 1, 0xff4040, 2, false);
        for (let k = 0; k < 4; k++) sbox(cx - 15 + k * 4, .2, cz + 16, .15, .02, 5, 0xf0f0f0, 0, false);
        w.station = { x: cx, z: cz + 9, carX: cx + 28, carZ: cz + 6 };
        continue;
      }
      const hb = () => 12 + r() * 26 + (3 - dc) * 14 * r();
      const t = r();
      if (t < .14) {                       // 公園
        sbox(cx, .2, cz, 38, .05, 38, 0x4a9a48, 0, false); sbox(cx, .2, cz, 4, .08, 38, 0xc8b890, 0, false); sbox(cx, .2, cz, 38, .08, 4, 0xc8b890, 0, false);
        sbox(cx, .2, cz, 5, .6, 5, 0x8a9098, 0); sbox(cx, .8, cz, 3.6, .15, 3.6, 0x60b0e0, 2, false); sbox(cx, .8, cz, .5, 1.6, .5, 0x8a9098, 0, false);   // ふん水
        for (let k = 0; k < 9; k++) tree(r, cx + (r() - .5) * 32, cz + (r() - .5) * 32, .2);
        for (const s of [-1, 1]) { sbox(cx + s * 7, .2, cz + 3.4, 2.4, .5, .7, 0x7a5a40, 0, false); sbox(cx + s * 7, .7, cz + 3.7, 2.4, .6, .12, 0x7a5a40, 0, false); }
      } else if (t < .5) {                 // マンション 4 棟 (裏路地 十字)
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) building(r, cx + sx * 11.5, cz + sz * 11.5, 16, 16, hb(), 'mansion');
        w.alleys.push({ x: cx, z: cz });
        sbox(cx + 2, .2, cz + 8, 1.6, 1.3, 2.4, 0x3a6a4a, 0); sbox(cx + 2, 1.5, cz + 8, 1.7, .1, 2.5, 0x2a4a34, 0, false);
        sbox(cx - 8, .2, cz - 2.2, 2.2, 1, 1.2, 0x6a5a3a, 0); sbox(cx - 2.4, .2, cz - 9, .8, .9, .8, 0x8a8f98, 0, false);
      } else if (t < .78) {                // 細長い ビル 2 棟
        const rot = r() < .5;
        for (const s of [-1, 1]) building(r, cx + (rot ? 0 : s * 12), cz + (rot ? s * 12 : 0), rot ? 38 : 15, rot ? 15 : 38, hb(), 'slab');
        w.alleys.push({ x: cx, z: cz });
        sbox(cx + (rot ? 9 : 2.5), .2, cz + (rot ? 2.5 : 9), 1.6, 1.3, 1.6, 0x3a6a4a, 0);
      } else building(r, cx, cz, 30, 30, hb() * 1.4 + 10, 'tower');
    }
    // 街灯と信号
    for (let k = -3; k <= 3; k++) for (let m = -6; m <= 6; m++) {
      const a = k * 56 + 22.8, b = m * 28 + 14;
      for (const [x, z, ax] of [[a, b, 0], [b, a, 1]]) {
        if (Math.abs(x) > 196 || Math.abs(z) > 196) continue;
        sbox(x, .2, z, .25, 6, .25, 0x40444c, 0, false); sbox(x + (ax ? 0 : .9), 6.1, z + (ax ? .9 : 0), ax ? .5 : 2, .22, ax ? 2 : .5, 0x40444c, 0, false);
        sbox(x + (ax ? 0 : 1.6), 5.95, z + (ax ? 1.6 : 0), .7, .16, .7, 0xfff2c0, 2, false);
        w.lamps.push({ x: x + (ax ? 0 : 1.6), z: z + (ax ? 1.6 : 0) });
      }
    }
    for (const lx of w.roadLines) for (const lz of w.roadLines) for (const [sx, sz] of [[1, 1], [-1, -1]]) {
      const x = lx + sx * 6.6, z = lz + sz * 6.6; sbox(x, .2, z, .22, 5, .22, 0x30343c, 0, false); sbox(x, 5.2, z, .5, 1.5, .5, 0x202428, 0, false);
      sbox(x - sx * .28, 6.2, z, .12, .34, .34, 0xff4030, 2, false); sbox(x - sx * .28, 5.75, z, .12, .34, .34, 0xffc030, 2, false); sbox(x - sx * .28, 5.3, z, .12, .34, .34, 0x40e070, 2, false);
    }
    // 歩く人の 道すじ
    const idx = new Map(); w.corners.forEach((c, k) => { idx.set(c.i + ',' + c.j + ',' + c.sx + ',' + c.sz, k); w.walk.push({ x: c.x, z: c.z, y: .2, nb: [] }); });
    w.corners.forEach((c, k) => {
      for (const key of [c.i + ',' + c.j + ',' + (-c.sx) + ',' + c.sz, c.i + ',' + c.j + ',' + c.sx + ',' + (-c.sz), (c.i + c.sx) + ',' + c.j + ',' + (-c.sx) + ',' + c.sz, c.i + ',' + (c.j + c.sz) + ',' + c.sx + ',' + (-c.sz)])
        if (idx.has(key)) w.walk[k].nb.push(idx.get(key));
    });
    const base = w.walk.length;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) {
      const nb = []; if (i > 0) nb.push(base + (i - 1) * 7 + j); if (i < 5) nb.push(base + (i + 1) * 7 + j); if (j > 0) nb.push(base + i * 7 + j - 1); if (j < 6) nb.push(base + i * 7 + j + 1);
      w.walk.push({ x: 240 + 76 * i + 4.8, z: -560 + 72 * j + 4.8, y: 0, nb });
    }

    // --- 広場の 施設 ---
    const FAC = [
      ['workshop', '[wrench]', '工房', 0xff9a30], ['mechshop', '[mech]', 'メカショップ', 0x40b0ff], ['weapons', '[gun]', '武器屋', 0xff5050],
      ['jobs', '[jobs]', '仕事案内', 0x60d060], ['factory', '[factory]', '工場', 0xc0c0c8], ['food', '[food]', '食堂', 0xffd040], ['mats', '[mats]', '買取・素材', 0xb080ff], ['clothes', '[shirt]', '服屋', 0xff80c0],
    ];
    FAC.forEach((f, k) => {
      const a = k / FAC.length * Math.PI * 2 + .3, x = Math.sin(a) * 16.5, z = Math.cos(a) * 16.5;
      sbox(x, .2, z, 6, 3.6, 6, 0x50586a, 0); sbox(x, 3.8, z, 7, .4, 7, f[3], 2, false); sbox(x, 4.2, z, 2.2, 1.8, 2.2, f[3], 2, false); sbox(x, 6, z, .2, 1.6, .2, 0x30343c, 0, false);
      sbox(Math.sin(a) * 13.4, .9, Math.cos(a) * 13.4, Math.abs(Math.cos(a)) * 3.4 + .4, 1.9, Math.abs(Math.sin(a)) * 3.4 + .4, 0x9fd0e8, 2, false);
      w.facilities.push({ id: f[0], icon: f[1], name: f[2], col: f[3], x: Math.sin(a) * 9.5, z: Math.cos(a) * 9.5, y: .2, r: 3.2 });
    });
    w.facilities.push({ id: 'police', icon: '[police]', name: '警察署', col: 0x4080ff, x: w.station.x, z: w.station.z, y: .2, r: 2.6 });
    const al = w.alleys[2]; w.facilities.push({ id: 'fence', icon: '[bag]', name: '裏の買取屋', col: 0xa060ff, x: al.x - 1, z: al.z + 1, y: .2, r: 1.8 });

    // --- 空港 (東) ---
    for (let k = 0; k < 3; k++) { sbox(320 + k * 46, 0, -58, 34, 13, 26, 0x8a94a4, 0); sbox(320 + k * 46, 13, -58, 36, 1, 28, 0x40b0ff, 2, false); sbox(320 + k * 46, 0, -44.8, 22, 9, .3, 0x50586a, 0, false); }
    sbox(262, 0, -56, 9, 30, 9, 0xb0b8c4, 1); sbox(262, 30, -56, 13, 5, 13, 0x304050, 1, false); sbox(262, 35, -56, 1, 8, 1, 0xff4040, 2, false);
    for (let k = 0; k < 14; k++) { sbox(250 + k * 30, 0, 16.5, .4, .4, .4, 0x40a0ff, 2, false); sbox(250 + k * 30, 0, -16.5, .4, .4, .4, 0x40a0ff, 2, false); }
    w.facilities.push({ id: 'airport', icon: '[plane]', name: '空港', col: 0x40d0ff, x: 262, z: -40, y: 0, r: 3.2 });
    w.planeSpots.push({ x: 252, z: 0, yaw: Math.PI / 2 }, { x: 300, z: -30, yaw: 0 }, { x: 330, z: -30, yaw: 0 });

    // --- 住宅街 (北東) ---
    let hid = 0;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 6; j++) {
      const cx = 240 + 76 * i + 38, cz = -560 + 72 * j + 36;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) house(r, cx + sx * 17, cz + sz * 16, sz, hid++);
      sbox(cx, 0, cz, 30, .9, .5, 0x3f7a3a, 0, false);
    }
    for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) { const x = 240 + 76 * i + 5.2, z = -560 + 72 * j + 5.2; sbox(x, 0, z, .2, 5, .2, 0x40444c, 0, false); sbox(x, 5, z, .6, .2, .6, 0xfff2c0, 2, false); w.lamps.push({ x, z }); }

    // --- 農場 (北西) ---
    sbox(-430, 0, -280, 22, 9, 14, 0xa03a30, 0); sbox(-430, 9, -280, 23, 1.2, 10, 0x6a2a24, 0, false); sbox(-430, 10.2, -280, 23, 1.2, 5, 0x6a2a24, 0, false); sbox(-430, 0, -272.8, 6, 5, .3, 0xf0ece0, 0, false);
    sbox(-410, 0, -282, 5, 14, 5, 0xc8ccd2, 0); sbox(-410, 14, -282, 4, 1.5, 4, 0x8a9098, 0, false);
    for (let k = 0; k < 30; k++) sbox(-604 + k * 12, 0, -296, .25, 1.2, .25, 0x8a6a48, 0, false);
    sbox(-430, .6, -296, 348, .15, .15, 0x8a6a48, 0, false);
    for (let a = 0; a < 13; a++) for (let b = 0; b < 5; b++) w.nodes.push({ type: 'crop', x: -580 + a * 24 + 1.5, z: -600 + b * 60, hp: 1, seed: a * 7 + b });

    // --- 海と桟橋 (東) ---
    sbox(775, 0, 200, 70, .5, 5, 0x9a7a52, 0); for (let k = 0; k < 8; k++) { sbox(744 + k * 9, -1, 197.3, .5, 2.4, .5, 0x6a4a30, 0, false); sbox(744 + k * 9, -1, 202.7, .5, 2.4, .5, 0x6a4a30, 0, false); }
    sbox(806, 0, 200, 8, .5, 12, 0x9a7a52, 0); sbox(808, .5, 204, 2.6, 2.4, 2.6, 0xd8c8a0, 0); sbox(808, 2.9, 204, 3.2, .3, 3.2, 0xc04a3a, 0, false);
    w.facilities.push({ id: 'pier', icon: '[fish]', name: '釣り場', col: 0x40c0ff, x: 804, z: 197, y: .5, r: 2.2 });
    sbox(812, 0, 330, 7, 4, 7, 0xe8e8e4, 0); sbox(812, 4, 330, 5, 22, 5, 0xf4f4f0, 0); sbox(812, 12, 330, 5.2, 4, 5.2, 0xd03a30, 0, false); sbox(812, 26, 330, 6.4, .5, 6.4, 0x40444c, 0, false); sbox(812, 26.5, 330, 3.4, 3, 3.4, 0xfff0a0, 2, false); sbox(812, 29.5, 330, 4.4, 1.6, 4.4, 0xd03a30, 0, false);
    for (let k = 0; k < 12; k++) { const x = 705 + r() * 40, z = -500 + r() * 1000; if (Math.abs(z) < 90) continue; sbox(x, 0, z, .12, 2.2, .12, 0xf0f0f0, 0, false); sbox(x, 2.2, z, 3, .25, 3, [0xe04a3a, 0x3fa7e8, 0xf2d13a][k % 3], 0, false); sbox(x + .4, 0, z + .8, .8, .12, 2, [0xf6f6f2, 0x7fe0e8][k % 2], 0, false); }

    // --- スクラップ置き場 (北) ---
    const RUST = [0x8a5a3a, 0x6a5a50, 0x9a6a40, 0x5a5f66, 0x7a4a30];
    for (let k = 0; k < 70; k++) {
      const x = (r() - .5) * 260, z = -250 - r() * 450, s = 2 + r() * 5, hh = 1 + r() * 4, gy = w.h(x, z) - .5;
      sbox(x, gy, z, s, hh, s * (.6 + r() * .8), RUST[Math.floor(r() * 5)], 0, s > 3.5);
      if (r() < .5) sbox(x + s * .2, gy + hh, z, s * .5, .6 + r(), s * .4, RUST[Math.floor(r() * 5)], 0, false);
    }
    sbox(-60, 0, -330, 3, 30, 3, 0xd0a030, 0); sbox(-48, 28, -330, 30, 2, 2, 0xd0a030, 0, false); sbox(-36, 20, -330, .3, 8, .3, 0x303030, 0, false); sbox(-36, 18.6, -330, 2, 1.4, 2, 0x50545c, 0, false);
    for (let k = 0; k < 50; k++) w.nodes.push({ type: 'scrap', x: (r() - .5) * 230, z: -248 - r() * 430, hp: 6, seed: k });
    for (let k = 0; k < 6; k++) w.nodes.push({ type: 'scrap', x: -40 + k * 16, z: -214 - r() * 8, hp: 6, seed: 60 + k });

    // --- 岩山 (西) ---
    for (let k = 0; k < 130; k++) {
      const x = -250 - r() * 830, z = (r() - .5) * 1700, s = 3 + r() * 11;
      if (w.inFarm(x, z)) continue;
      const hh = 2 + r() * s, gy = w.h(x, z) - 1; sbox(x, gy, z, s, hh, s * (.7 + r() * .6), r() < .5 ? 0x7a7f84 : 0x8a8a80, 0, s > 5);
      sbox(x + s * .15, gy + hh, z - s * .1, s * .6, hh * .5, s * .5, 0x6e7378, 0, false);
    }
    for (let k = 0; k < 60; k++) { const x = -246 - r() * 800, z = (r() - .5) * 1600; if (!w.inFarm(x, z)) w.nodes.push({ type: 'iron', x, z, hp: 8, seed: k }); }

    // --- 荒野 (南) ---
    for (let k = 0; k < 110; k++) {
      const x = (r() - .5) * 1800, z = 260 + r() * 820;
      if (x > 680) continue;
      const l = 5 + r() * 12, rot = r() < .5, hh = 2 + r() * 6, gy = w.h(x, z) - 1.2;
      sbox(x, gy, z, rot ? l : 1, hh + 1, rot ? 1 : l, 0xa09078, 0);
      if (r() < .5) sbox(x + (rot ? l / 2 : 0), gy, z + (rot ? 0 : l / 2), 1.6, 7 + r() * 6, 1.6, 0x90806a, 0);
      if (r() < .4) sbox(x + (rot ? 0 : 3), gy, z + (rot ? 3 : 0), 2.5, 2 + r() * 1.5, 2.5, 0x8a7a64, 0, false);
    }
    for (let k = 0; k < 50; k++) { const x = (r() - .5) * 1700; if (x < 680) w.nodes.push({ type: 'core', x, z: 270 + r() * 800, hp: 5, seed: k }); }
    for (let k = 0; k < 10; k++) w.nodes.push({ type: 'core', x: -300 - r() * 700, z: (r() - .5) * 600, hp: 5, seed: 60 + k });

    // --- 木 ---
    for (let k = 0; k < 1100; k++) {
      const x = (r() - .5) * 2200, z = (r() - .5) * 2200;
      if (w.region(x, z) === 'grass' && !w.inCity(x, z, 8) && !w.inTown(x + 8, z + 8) && !w.inTown(x - 8, z - 8)) tree(r, x, z, w.h(x, z));
    }
    // --- 遠くの山なみ (行けない 背景) ---
    for (let k = 0; k < 46; k++) {
      const a = k / 46 * 6.283 + r() * .1, d = 2150 + r() * 250, x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (x > 1200 && Math.abs(z) < 1700) continue;      // 東は 海
      const rad = 260 + r() * 200, h = 200 + r() * 260, tw = r() * 6;
      scone(x, -2, z, rad, h, [0x5f7f5a, 0x6a8662, 0x7a8474, 0x556f60][k % 4], 7, tw);
      if (h > 320) scone(x, h * .62 - 2, z, rad * .39, h * .385, 0xf2f4f8, 7, tw);
    }
    for (const n of w.nodes) { n.max = n.hp; n.t = 0; n.y = w.h(n.x, n.z); }
    for (const c of chunkMap.values()) R.addStatic(new Float32Array(c.v), c.box);
    chunkMap.clear();
  };
  return w;
})();
