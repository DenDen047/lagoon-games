/* MECH FRONTIER の世界: まち・くうこう・スクラップおきば・岩山・こうや を作り、あたり判定を もつ */
'use strict';
const W = (() => {
  const CELL = 16, grid = new Map(); let stamp = 0;
  const key = (cx, cz) => (cx + 600) * 4096 + (cz + 600);
  const w = { size: 780, cityR: 203, facilities: [], alleys: [], nodes: [], corners: [], planeSpots: [], showroom: { x: 860, z: 860 } };

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
      if (y <= 0) return dy < 0 ? -oy / dy : t;
      if (w.pointIn(ox + dx * t, y, oz + dz * t)) return t - st * .5;
    }
    return max;
  };
  w.inCity = (x, z, m = 0) => Math.abs(x) < w.cityR + m && Math.abs(z) < w.cityR + m;
  w.inAirport = (x, z) => x > 226 && x < 660 && Math.abs(z) < 82;
  w.region = (x, z) => w.inCity(x, z) ? 'city' : w.inAirport(x, z) ? 'airport' : z > 232 ? 'waste' : (z < -232 && Math.abs(x) < 150) ? 'junk' : x < -232 ? 'rock' : 'grass';

  // ---------- 動かない形を 区画ごとに ためる ----------
  const CH = 128, chunkMap = new Map();
  const FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]];
  function sbox(x, y, z, sx, sy, sz, col, mat = 0, solid = true) {   // (x,z) は中心、y は底
    const k = Math.floor(x / CH) + ',' + Math.floor(z / CH);
    let c = chunkMap.get(k); if (!c) chunkMap.set(k, c = { v: [], box: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9] });
    const r = (col >> 16 & 255) / 255, g = (col >> 8 & 255) / 255, b = (col & 255) / 255, cy = y + sy / 2, v = c.v;
    for (const n of FN) {
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

  const WALLS = [0x8fa3b8, 0xa9b4c2, 0x6f8196, 0xc9d1da, 0x5d7a8c, 0x9a8f86, 0x7890a8, 0xb8a898];
  const NEON = [0x40e0ff, 0xff50c0, 0x80ff60, 0xffb030, 0xa070ff];
  function building(r, x, z, bw, bd, h) {
    const col = WALLS[Math.floor(r() * WALLS.length)], neon = NEON[Math.floor(r() * NEON.length)];
    sbox(x, 0, z, bw, h, bd, col, 1);
    sbox(x, h, z, bw * .7, 1.6, bd * .7, 0x4a525e, 0, false);
    for (const [ox, oz, sx, sz] of [[0, bd / 2, bw + .3, .3], [0, -bd / 2, bw + .3, .3], [bw / 2, 0, .3, bd + .3], [-bw / 2, 0, .3, bd + .3]])
      sbox(x + ox, h - 1.2, z + oz, sx, .5, sz, neon, 2, false);
    if (r() < .5) sbox(x + bw * .2, h + 1.6, z - bd * .2, .4, 6 + r() * 8, .4, 0x30343c, 0, false);
    if (r() < .35 && h > 20) {   // かんばん
      const sy = 8 + r() * (h - 16);
      sbox(x + bw / 2 + .25, sy, z, .3, 5, Math.min(8, bd * .5), NEON[Math.floor(r() * NEON.length)], 2, false);
    }
  }
  function tree(r, x, z) {
    const h = 3 + r() * 3, g = r() < .5 ? 0x3f8a3a : 0x2f7a44;
    sbox(x, 0, z, .6, h, .6, 0x6a4a30, 0, false);
    sbox(x, h - .5, z, 3 + r() * 1.5, 2.2, 3 + r() * 1.5, g, 0, false);
    sbox(x, h + 1.5, z, 1.8, 1.6, 1.8, g, 0, false);
  }

  w.build = () => {
    const r = seeded(20261117);
    // --- じめん ---
    for (let gx = -8; gx < 8; gx++) for (let gz = -8; gz < 8; gz++) sbox(gx * CH + CH / 2, -1, gz * CH + CH / 2, CH, 1, CH, 0xffffff, 3, false);

    // --- まち: 7×7 の 区画 ---
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const cx = (i - 3) * 56, cz = (j - 3) * 56, dc = Math.max(Math.abs(i - 3), Math.abs(j - 3));
      const plaza = i === 3 && j === 3;
      sbox(cx, 0, cz, 44, .2, 44, plaza ? 0xb4ae9e : 0x9aa0a8, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.corners.push({ x: cx + sx * 20.5, z: cz + sz * 20.5, i, j, sx, sz });
      if (plaza) continue;
      const hb = () => 12 + r() * 26 + (3 - dc) * 14 * r();
      const t = r();
      if (t < .14) {                       // こうえん
        sbox(cx, .2, cz, 38, .05, 38, 0x4a9a48, 0, false);
        for (let k = 0; k < 7; k++) tree(r, cx + (r() - .5) * 32, cz + (r() - .5) * 32);
      } else if (t < .5) {                 // マンション 4 むね (うらろじ 十字)
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) building(r, cx + sx * 11.5, cz + sz * 11.5, 16, 16, hb());
        w.alleys.push({ x: cx, z: cz });
        sbox(cx + 2, .2, cz + 8, 1.6, 1.3, 2.4, 0x3a6a4a, 0);     // ごみばこ
        sbox(cx - 8, .2, cz - 2.2, 2.2, 1, 1.2, 0x6a5a3a, 0);
      } else if (t < .78) {                // ほそ長い ビル 2 むね
        const rot = r() < .5;
        for (const s of [-1, 1]) building(r, cx + (rot ? 0 : s * 12), cz + (rot ? s * 12 : 0), rot ? 38 : 15, rot ? 15 : 38, hb());
        w.alleys.push({ x: cx, z: cz });
        sbox(cx + (rot ? 9 : 2.5), .2, cz + (rot ? 2.5 : 9), 1.6, 1.3, 1.6, 0x3a6a4a, 0);
      } else {                             // 大きな タワー
        building(r, cx, cz, 30, 30, hb() * 1.5 + 10);
      }
    }
    // がいとう
    for (let k = -3; k <= 3; k++) for (let m = -6; m <= 6; m++) {
      const a = k * 56 + 22.8, b = m * 28 + 14;
      for (const [x, z] of [[a, b], [b, a]]) {
        if (Math.abs(x) > 196 || Math.abs(z) > 196) continue;
        sbox(x, .2, z, .25, 6, .25, 0x40444c, 0, false); sbox(x, 6.1, z, 1.4, .25, .5, 0xfff2c0, 2, false);
      }
    }

    // --- ひろばの しせつ ---
    const FAC = [
      ['workshop', '[wrench]', 'こうぼう', 0xff9a30], ['mechshop', '[mech]', 'メカショップ', 0x40b0ff], ['weapons', '[gun]', 'ぶきや', 0xff5050],
      ['jobs', '[jobs]', 'しごと あんない', 0x60d060], ['factory', '[factory]', 'こうじょう', 0xc0c0c8], ['food', '[food]', 'しょくどう', 0xffd040], ['mats', '[mats]', 'ざいりょうや', 0xb080ff],
    ];
    FAC.forEach((f, k) => {
      const a = k / FAC.length * Math.PI * 2 + .3, x = Math.sin(a) * 16.5, z = Math.cos(a) * 16.5;
      sbox(x, .2, z, 6, 4, 6, 0x50586a, 0); sbox(x, 4.2, z, 6.6, .5, 6.6, f[3], 2, false); sbox(x, 4.7, z, 2, 2, 2, f[3], 2, false);
      w.facilities.push({ id: f[0], icon: f[1], name: f[2], col: f[3], x: Math.sin(a) * 9.5, z: Math.cos(a) * 9.5, y: .2, r: 3.2 });
    });

    // --- くうこう (ひがし) ---
    for (let k = 0; k < 3; k++) { sbox(320 + k * 46, 0, -58, 34, 13, 26, 0x8a94a4, 0); sbox(320 + k * 46, 13, -58, 36, 1, 28, 0x40b0ff, 2, false); }
    sbox(262, 0, -56, 9, 30, 9, 0xb0b8c4, 1); sbox(262, 30, -56, 13, 5, 13, 0x304050, 1, false); sbox(262, 35, -56, 1, 8, 1, 0xff4040, 2, false);
    w.facilities.push({ id: 'airport', icon: '[plane]', name: 'くうこう', col: 0x40d0ff, x: 262, z: -40, y: 0, r: 3.2 });
    w.planeSpots.push({ x: 252, z: 0, yaw: Math.PI / 2 }, { x: 300, z: -30, yaw: 0 }, { x: 330, z: -30, yaw: 0 });

    // --- スクラップおきば (きた) ---
    const RUST = [0x8a5a3a, 0x6a5a50, 0x9a6a40, 0x5a5f66, 0x7a4a30];
    for (let k = 0; k < 46; k++) {
      const x = (r() - .5) * 260, z = -250 - r() * 190, s = 2 + r() * 5;
      sbox(x, 0, z, s, 1 + r() * 4, s * (.6 + r() * .8), RUST[Math.floor(r() * 5)], 0, s > 3.5);
    }
    sbox(-60, 0, -330, 3, 30, 3, 0xd0a030, 0); sbox(-48, 28, -330, 30, 2, 2, 0xd0a030, 0, false); sbox(-36, 20, -330, .3, 8, .3, 0x303030, 0, false);
    for (let k = 0; k < 30; k++) w.nodes.push({ type: 'scrap', x: (r() - .5) * 230, z: -248 - r() * 170, hp: 6, seed: k });
    for (let k = 0; k < 6; k++) w.nodes.push({ type: 'scrap', x: -40 + k * 16, z: -214 - r() * 8, hp: 6, seed: 40 + k });

    // --- 岩山 (にし) ---
    for (let k = 0; k < 60; k++) {
      const x = -250 - r() * 300, z = (r() - .5) * 460, s = 3 + r() * 9;
      sbox(x, 0, z, s, 2 + r() * s, s * (.7 + r() * .6), r() < .5 ? 0x7a7f84 : 0x8a8a80, 0, s > 5);
    }
    for (let k = 0; k < 26; k++) w.nodes.push({ type: 'iron', x: -246 - r() * 280, z: (r() - .5) * 420, hp: 8, seed: k });

    // --- こうや (みなみ) ---
    for (let k = 0; k < 40; k++) {
      const x = (r() - .5) * 900, z = 260 + r() * 420;
      if (w.inAirport(x, z)) continue;
      const l = 5 + r() * 12, rot = r() < .5;
      sbox(x, 0, z, rot ? l : 1, 2 + r() * 6, rot ? 1 : l, 0xa09078, 0);
      if (r() < .5) sbox(x + (rot ? l / 2 : 0), 0, z + (rot ? 0 : l / 2), 1.6, 6 + r() * 6, 1.6, 0x90806a, 0);
    }
    for (let k = 0; k < 20; k++) w.nodes.push({ type: 'core', x: (r() - .5) * 800, z: 270 + r() * 400, hp: 5, seed: k });
    for (let k = 0; k < 5; k++) w.nodes.push({ type: 'core', x: -300 - r() * 200, z: (r() - .5) * 300, hp: 5, seed: 30 + k });

    // --- 木 ---
    for (let k = 0; k < 520; k++) {
      const x = (r() - .5) * 1500, z = (r() - .5) * 1500;
      if (w.region(x, z) === 'grass' && !w.inCity(x, z, 8)) tree(r, x, z);
    }
    for (const n of w.nodes) { n.max = n.hp; n.t = 0; }
    for (const c of chunkMap.values()) R.addStatic(new Float32Array(c.v), c.box);
    chunkMap.clear();
  };
  return w;
})();
