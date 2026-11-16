/* =========================================================================
   SKYDROP ROYALE ― しまの 地図
   地面 / ものの マス / たてもの / 当たり判定 / みとおし
   ========================================================================= */
'use strict';

const TILE = 40;
const MW = 160, MH = 160;            // 6400 x 6400 px の しま
const WORLD_W = MW * TILE, WORLD_H = MH * TILE;

/* 地面 */
const GR = { GRASS: 0, FOREST: 1, SAND: 2, SNOW: 3, SWAMP: 4, WATER: 5, ROAD: 6, WOOD: 7, CONCRETE: 8, DIRT: 9, STONEF: 10, OCEAN: 11 };
const GR_COL = ['#6cbf4a', '#4f9a3c', '#e8d38a', '#eef4fa', '#6a8a4a', '#3a9ad8', '#6e6e74', '#b0814e', '#9a9ea6', '#8a6a42', '#a8a294', '#2a7ac0'];

/* ものの マス */
const OB = {
  NONE: 0, TREE: 1, PINE: 2, CACTUS: 3, ROCK: 4, BUSH: 5, WWOOD: 6, WBRICK: 7, WMETAL: 8,
  BWOOD: 9, BSTONE: 10, BMETAL: 11, CRATE: 12, CHEST: 13, CARL: 14, CARR: 15, FENCE: 16,
  BARREL: 17, HAY: 18, SNOWMAN: 19, AMMOBOX: 20, CHESTOPEN: 21, DEADTREE: 22, TENT: 23,
  MACHINE: 24, PILLAR: 25, EBARRIER: 26, CAMPFIRE: 27,
};
/* solid=ぶつかる, hp, mat=こわすと もらえる素材, n=1かいで もらえる数, see=みとおしを ふさぐ, hide=かくれられる */
const OBD = [];
function obd(id, o) { OBD[id] = Object.assign({ solid: false, hp: 0, mat: null, n: 0, see: false, hide: false, build: false }, o); }
obd(OB.NONE, {});
obd(OB.TREE, { solid: true, hp: 300, mat: 'wood', n: 7, see: true, canopy: true });
obd(OB.PINE, { solid: true, hp: 300, mat: 'wood', n: 7, see: true, canopy: true });
obd(OB.CACTUS, { solid: true, hp: 150, mat: 'wood', n: 5 });
obd(OB.ROCK, { solid: true, hp: 500, mat: 'stone', n: 7, see: true });
obd(OB.BUSH, { hp: 60, mat: 'wood', n: 3, hide: true });
obd(OB.WWOOD, { solid: true, hp: 250, mat: 'wood', n: 6, see: true });
obd(OB.WBRICK, { solid: true, hp: 420, mat: 'stone', n: 6, see: true });
obd(OB.WMETAL, { solid: true, hp: 600, mat: 'metal', n: 5, see: true });
obd(OB.BWOOD, { solid: true, hp: 150, mat: 'wood', n: 3, see: true, build: true });
obd(OB.BSTONE, { solid: true, hp: 280, mat: 'stone', n: 3, see: true, build: true });
obd(OB.BMETAL, { solid: true, hp: 450, mat: 'metal', n: 3, see: true, build: true });
obd(OB.CRATE, { solid: true, hp: 120, mat: 'wood', n: 6 });
obd(OB.CHEST, { solid: true, hp: 0 });
obd(OB.CARL, { solid: true, hp: 500, mat: 'metal', n: 8 });
obd(OB.CARR, { solid: true, hp: 500, mat: 'metal', n: 8 });
obd(OB.FENCE, { solid: true, hp: 80, mat: 'wood', n: 4 });
obd(OB.BARREL, { solid: true, hp: 60, mat: 'metal', n: 3 });
obd(OB.HAY, { solid: true, hp: 100, mat: 'wood', n: 4 });
obd(OB.SNOWMAN, { solid: true, hp: 100, mat: 'stone', n: 3 });
obd(OB.AMMOBOX, { solid: true, hp: 0 });
obd(OB.CHESTOPEN, {});
obd(OB.DEADTREE, { solid: true, hp: 200, mat: 'wood', n: 6, see: true });
obd(OB.TENT, { solid: true, hp: 120, mat: 'wood', n: 5, see: true });
obd(OB.MACHINE, { solid: true, hp: 700, mat: 'metal', n: 8, see: true });
obd(OB.PILLAR, { solid: true, hp: 600, mat: 'stone', n: 8, see: true });
obd(OB.EBARRIER, { solid: true, hp: 400, see: false, build: true });
obd(OB.CAMPFIRE, {});

const World = {
  gr: new Uint8Array(MW * MH),
  ob: new Uint8Array(MW * MH),
  hp: new Int16Array(MW * MH),
  houses: [],          // 屋根の ある たてもの {x0,y0,x1,y1,col}
  pois: [],            // 名前の ついた 場所
  lootSpots: [],       // {x,y,q} q=質
  groundCanvas: null,  // 地面の え (1マス 8px)
  mapCanvas: null,     // ミニマップ用 (1マス 2px)
  growing: [],         // たてている とちゅうの かべ
  seed: 1,

  idx(tx, ty) { return ty * MW + tx; },
  inb(tx, ty) { return tx >= 0 && ty >= 0 && tx < MW && ty < MH; },
  obAt(tx, ty) { return this.inb(tx, ty) ? this.ob[ty * MW + tx] : OB.ROCK; },
  grAt(tx, ty) { return this.inb(tx, ty) ? this.gr[ty * MW + tx] : GR.OCEAN; },
  solid(tx, ty) { return !this.inb(tx, ty) || OBD[this.ob[ty * MW + tx]].solid; },
  setOb(tx, ty, o) {
    if (!this.inb(tx, ty)) return;
    const i = ty * MW + tx;
    this.ob[i] = o;
    this.hp[i] = OBD[o].hp;
  },

  /* -------------------------------- 地図づくり -------------------------------- */
  generate(seed) {
    this.seed = seed;
    const R = seeded(seed);
    const elevN = makeNoise(seed * 3 + 1), moistN = makeNoise(seed * 7 + 5), tempN = makeNoise(seed * 11 + 9);
    this.gr.fill(0); this.ob.fill(0); this.hp.fill(0);
    this.houses = []; this.pois = []; this.lootSpots = []; this.growing = [];

    const elev = new Float32Array(MW * MH), moist = new Float32Array(MW * MH), temp = new Float32Array(MW * MH);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = y * MW + x;
      const nx = x / MW - 0.5, ny = y / MH - 0.5;
      const d = Math.sqrt(nx * nx + ny * ny) * 2; // 0=まんなか 1=はし
      let e = elevN(x / 34, y / 34, 5);
      e = e * 0.9 + 0.35 - Math.pow(d, 2.6) * 0.75;
      elev[i] = e;
      moist[i] = moistN(x / 28, y / 28, 4);
      temp[i] = 1 - y / MH + (tempN(x / 40, y / 40, 3) - 0.5) * 0.55;
    }
    // 地面の しゅるい
    for (let i = 0; i < MW * MH; i++) {
      const e = elev[i], m = moist[i], t = temp[i];
      let g;
      if (e < 0.2) g = GR.OCEAN;
      else if (e < 0.25) g = GR.WATER;
      else if (t > 0.8) g = GR.SNOW;
      else if (t < 0.24) g = GR.SAND;
      else if (m > 0.63) g = GR.SWAMP;
      else if (m > 0.53) g = GR.FOREST;
      else g = GR.GRASS;
      this.gr[i] = g;
    }
    // 川を 1〜2本
    for (let k = 0; k < 2; k++) {
      let x = MW * (0.35 + R() * 0.3), y = MH * (0.35 + R() * 0.3);
      let a = R() * TAU;
      for (let s = 0; s < 260; s++) {
        a += (R() - 0.5) * 0.35;
        x += Math.cos(a); y += Math.sin(a);
        const tx = Math.round(x), ty = Math.round(y);
        if (!this.inb(tx, ty)) break;
        if (this.gr[ty * MW + tx] === GR.OCEAN) break;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          if (Math.abs(ox) + Math.abs(oy) > 1) continue;
          if (this.inb(tx + ox, ty + oy) && this.gr[(ty + oy) * MW + tx + ox] !== GR.OCEAN) this.gr[(ty + oy) * MW + tx + ox] = GR.WATER;
        }
      }
    }
    // すなはま
    const isW = (g) => g === GR.WATER || g === GR.OCEAN;
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      const i = y * MW + x, g = this.gr[i];
      if (isW(g) || g === GR.SNOW) continue;
      if (this.gr[i - 1] === GR.OCEAN || this.gr[i + 1] === GR.OCEAN || this.gr[i - MW] === GR.OCEAN || this.gr[i + MW] === GR.OCEAN) this.gr[i] = GR.SAND;
    }

    const land = (tx, ty) => this.inb(tx, ty) && !isW(this.gr[ty * MW + tx]);
    const landRatio = (cx, cy, r) => {
      let n = 0, l = 0;
      for (let y = cy - r; y <= cy + r; y += 2) for (let x = cx - r; x <= cx + r; x += 2) { n++; if (land(x, y)) l++; }
      return l / n;
    };

    // 名前の ついた 場所
    const used = new Set();
    const types = ['town', 'town', 'town', 'factory', 'farm', 'farm', 'ruins', 'ruins', 'camp', 'town', 'factory', 'camp', 'town'];
    for (let tries = 0; tries < 3000 && this.pois.length < types.length; tries++) {
      const cx = 18 + Math.floor(R() * (MW - 36)), cy = 18 + Math.floor(R() * (MH - 36));
      if (landRatio(cx, cy, 10) < 0.92) continue;
      if (this.pois.some((p) => Math.hypot(p.tx - cx, p.ty - cy) < 30)) continue;
      const type = types[this.pois.length];
      const pool = POI_NAMES[type].filter((n) => !used.has(n));
      const name = pool[Math.floor(R() * pool.length)] || type;
      used.add(name);
      this.pois.push({ tx: cx, ty: cy, type, name, x: (cx + 0.5) * TILE, y: (cy + 0.5) * TILE, r: 12 * TILE });
    }
    // 道
    for (const p of this.pois) {
      const near = this.pois.filter((q) => q !== p).sort((a, b) => Math.hypot(a.tx - p.tx, a.ty - p.ty) - Math.hypot(b.tx - p.tx, b.ty - p.ty)).slice(0, 2);
      for (const q of near) this.road(p.tx, p.ty, q.tx, q.ty, R() < 0.5);
    }
    // たてもの
    for (const p of this.pois) this.buildPoi(p, R);

    // しぜん
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = y * MW + x;
      if (this.ob[i]) continue;
      const g = this.gr[i];
      if (this.pois.some((p) => Math.abs(p.tx - x) < 11 && Math.abs(p.ty - y) < 11)) {
        if (g !== GR.GRASS && g !== GR.FOREST && g !== GR.SNOW && g !== GR.SAND) continue;
        if (R() < 0.015) this.setOb(x, y, OB.BUSH);
        continue;
      }
      const r = R();
      switch (g) {
        case GR.GRASS: if (r < 0.035) this.setOb(x, y, OB.TREE); else if (r < 0.05) this.setOb(x, y, OB.BUSH); else if (r < 0.058) this.setOb(x, y, OB.ROCK); break;
        case GR.FOREST: if (r < 0.14) this.setOb(x, y, R() < 0.7 ? OB.TREE : OB.PINE); else if (r < 0.18) this.setOb(x, y, OB.BUSH); else if (r < 0.19) this.setOb(x, y, OB.ROCK); break;
        case GR.SNOW: if (r < 0.06) this.setOb(x, y, OB.PINE); else if (r < 0.075) this.setOb(x, y, OB.ROCK); else if (r < 0.078) this.setOb(x, y, OB.SNOWMAN); break;
        case GR.SAND: if (r < 0.022) this.setOb(x, y, OB.CACTUS); else if (r < 0.034) this.setOb(x, y, OB.ROCK); break;
        case GR.SWAMP: if (r < 0.05) this.setOb(x, y, OB.DEADTREE); else if (r < 0.1) this.setOb(x, y, OB.BUSH); break;
      }
    }
    // 岩山（かたまり）
    for (let k = 0; k < 14; k++) {
      const cx = Math.floor(R() * MW), cy = Math.floor(R() * MH);
      if (!land(cx, cy) || this.pois.some((p) => Math.hypot(p.tx - cx, p.ty - cy) < 16)) continue;
      const rad = 2 + R() * 3;
      for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
        const tx = cx + x, ty = cy + y;
        if (!land(tx, ty) || this.ob[ty * MW + tx] || this.gr[ty * MW + tx] === GR.ROAD) continue;
        if (Math.hypot(x, y) < rad + R() * 1.5) this.setOb(tx, ty, OB.ROCK);
      }
    }
    // 野原の たからばこ と 落ちてる ぶき
    for (let k = 0; k < 70; k++) {
      const tx = 4 + Math.floor(R() * (MW - 8)), ty = 4 + Math.floor(R() * (MH - 8));
      if (!land(tx, ty) || this.ob[ty * MW + tx]) continue;
      if (R() < 0.35) this.setOb(tx, ty, OB.CHEST); else this.lootSpots.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, q: 0 });
    }
    // 車
    for (let k = 0; k < 400 && k >= 0; k++) {
      const tx = Math.floor(R() * (MW - 2)), ty = Math.floor(R() * MH);
      if (this.gr[ty * MW + tx] !== GR.ROAD || this.gr[ty * MW + tx + 1] !== GR.ROAD) continue;
      if (this.ob[ty * MW + tx] || this.ob[ty * MW + tx + 1] || R() > 0.25) continue;
      this.setOb(tx, ty, OB.CARL); this.setOb(tx + 1, ty, OB.CARR);
    }
    this.paintGround();
  },

  road(x0, y0, x1, y1, xFirst) {
    const put = (x, y) => {
      for (let o = 0; o < 2; o++) {
        const tx = xFirst ? x : x + o, ty = xFirst ? y + o : y;
        if (!this.inb(tx, ty)) continue;
        const i = ty * MW + tx;
        if (this.gr[i] === GR.OCEAN) continue;
        this.gr[i] = GR.ROAD;
        this.ob[i] = 0;
      }
    };
    let x = x0, y = y0;
    if (xFirst) { while (x !== x1) { put(x, y); x += Math.sign(x1 - x); } xFirst = false; while (y !== y1) { put(x, y); y += Math.sign(y1 - y); } }
    else { while (y !== y1) { put(x, y); y += Math.sign(y1 - y); } xFirst = true; while (x !== x1) { put(x, y); x += Math.sign(x1 - x); } }
  },

  /* 屋根つきの いえ */
  house(x0, y0, w, h, wall, floor, R, opt = {}) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (!this.inb(x, y)) return false;
      const g = this.gr[y * MW + x];
      if (g === GR.OCEAN || g === GR.WATER) return false;
      if (this.ob[y * MW + x] && this.ob[y * MW + x] !== OB.BUSH) return false;
    }
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      this.gr[y * MW + x] = floor;
      this.setOb(x, y, edge ? wall : OB.NONE);
    }
    // ドア（かべに すきま）
    const doors = opt.doors || 2;
    const sides = [0, 1, 2, 3].sort(() => R() - 0.5).slice(0, doors);
    for (const s of sides) {
      const big = opt.bigDoor ? 2 : 1;
      if (s === 0 || s === 2) {
        const dx = x0 + 1 + Math.floor(R() * (w - 2 - big));
        const dy = s === 0 ? y0 : y0 + h - 1;
        for (let b = 0; b < big; b++) this.setOb(dx + b, dy, OB.NONE);
      } else {
        const dy = y0 + 1 + Math.floor(R() * (h - 2 - big));
        const dx = s === 1 ? x0 + w - 1 : x0;
        for (let b = 0; b < big; b++) this.setOb(dx, dy + b, OB.NONE);
      }
    }
    // しきりの かべ
    if (w >= 8 && R() < 0.6) {
      const sx = x0 + 3 + Math.floor(R() * (w - 6));
      for (let y = y0 + 1; y < y0 + h - 1; y++) if (y !== y0 + Math.floor(h / 2)) this.setOb(sx, y, wall);
    }
    // なかみ
    const inner = [];
    for (let y = y0 + 1; y < y0 + h - 1; y++) for (let x = x0 + 1; x < x0 + w - 1; x++) if (!this.ob[y * MW + x]) inner.push([x, y]);
    inner.sort(() => R() - 0.5);
    const chests = opt.chests ?? (R() < 0.7 ? 1 : 2);
    for (let c = 0; c < chests && inner.length; c++) { const [x, y] = inner.pop(); this.setOb(x, y, OB.CHEST); }
    if (R() < 0.4 && inner.length) { const [x, y] = inner.pop(); this.setOb(x, y, OB.AMMOBOX); }
    const loot = opt.loot ?? 2 + Math.floor(R() * 3);
    for (let c = 0; c < loot && inner.length; c++) { const [x, y] = inner.pop(); this.lootSpots.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, q: opt.q || 0 }); }
    if (opt.crates) for (let c = 0; c < opt.crates && inner.length; c++) { const [x, y] = inner.pop(); this.setOb(x, y, R() < 0.25 ? OB.BARREL : (opt.machine && R() < 0.5 ? OB.MACHINE : OB.CRATE)); }
    const roofs = opt.roof || ['#c84a3a', '#3a6ac8', '#4a8a4a', '#8a5aa0', '#c8883a', '#5a5e6a', '#2a8a8a'];
    this.houses.push({ x0, y0, x1: x0 + w - 1, y1: y0 + h - 1, col: opt.roofCol || roofs[Math.floor(R() * roofs.length)], style: opt.style || 'tile' });
    return true;
  },

  buildPoi(p, R) {
    const { tx, ty } = p;
    const g = this.gr[ty * MW + tx];
    const snowy = g === GR.SNOW, sandy = g === GR.SAND;
    const tryHouse = (w, h, wall, floor, opt) => {
      for (let t = 0; t < 25; t++) {
        const x0 = tx - 11 + Math.floor(R() * (22 - w)), y0 = ty - 11 + Math.floor(R() * (22 - h));
        if (this.houses.some((hh) => x0 <= hh.x1 + 2 && x0 + w - 1 >= hh.x0 - 2 && y0 <= hh.y1 + 2 && y0 + h - 1 >= hh.y0 - 2)) continue;
        if (this.house(x0, y0, w, h, wall, floor, R, opt)) return true;
      }
      return false;
    };
    const scatter = (o, n, rad = 11) => {
      for (let k = 0; k < n; k++) {
        const x = tx - rad + Math.floor(R() * rad * 2), y = ty - rad + Math.floor(R() * rad * 2);
        if (!this.inb(x, y) || this.ob[y * MW + x]) continue;
        const gg = this.gr[y * MW + x];
        if (gg === GR.WATER || gg === GR.OCEAN || gg === GR.WOOD || gg === GR.CONCRETE) continue;
        if (this.houses.some((hh) => x >= hh.x0 && x <= hh.x1 && y >= hh.y0 && y <= hh.y1)) continue;
        this.setOb(x, y, o);
      }
    };
    if (p.type === 'town') {
      const n = 4 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) tryHouse(6 + Math.floor(R() * 4), 5 + Math.floor(R() * 4), R() < 0.5 ? OB.WBRICK : OB.WWOOD, GR.WOOD, {});
      scatter(OB.BUSH, 6); scatter(OB.CRATE, 3); scatter(OB.BARREL, 2);
      if (snowy) scatter(OB.SNOWMAN, 2);
    } else if (p.type === 'factory') {
      tryHouse(14, 10, OB.WMETAL, GR.CONCRETE, { bigDoor: true, doors: 3, chests: 2, loot: 4, crates: 8, machine: true, roofCol: '#5a6070', style: 'metal', q: 1 });
      tryHouse(8, 7, OB.WMETAL, GR.CONCRETE, { crates: 3, machine: true, roofCol: '#6a7080', style: 'metal' });
      for (let y = ty - 11; y <= ty + 11; y++) for (let x = tx - 11; x <= tx + 11; x++) {
        if (this.inb(x, y) && !this.ob[y * MW + x] && this.gr[y * MW + x] !== GR.WATER && this.gr[y * MW + x] !== GR.OCEAN && this.gr[y * MW + x] !== GR.CONCRETE && R() < 0.5) this.gr[y * MW + x] = GR.CONCRETE;
      }
      scatter(OB.CRATE, 14); scatter(OB.BARREL, 8); scatter(OB.MACHINE, 3);
      for (let k = 0; k < 3; k++) { const x = tx - 9 + Math.floor(R() * 18), y = ty - 9 + Math.floor(R() * 18); if (this.inb(x, y) && !this.ob[y * MW + x] && this.gr[y * MW + x] !== GR.WATER) this.setOb(x, y, OB.CHEST); }
    } else if (p.type === 'farm') {
      tryHouse(10, 8, OB.WWOOD, GR.WOOD, { bigDoor: true, roofCol: '#b83a2a', style: 'barn', chests: 2, crates: 2 });
      tryHouse(6, 5, OB.WWOOD, GR.WOOD, {});
      // はたけ
      const fx = tx + (R() < 0.5 ? -10 : 2), fy = ty + (R() < 0.5 ? -10 : 2);
      for (let y = fy; y < fy + 8; y++) for (let x = fx; x < fx + 8; x++) {
        if (!this.inb(x, y) || this.ob[y * MW + x] || this.gr[y * MW + x] === GR.WATER || this.gr[y * MW + x] === GR.OCEAN || this.gr[y * MW + x] === GR.WOOD) continue;
        this.gr[y * MW + x] = GR.DIRT;
        if ((x === fx || x === fx + 7 || y === fy || y === fy + 7) && R() < 0.8) this.setOb(x, y, OB.FENCE);
        else if (R() < 0.08) this.setOb(x, y, OB.HAY);
      }
      scatter(OB.HAY, 8); scatter(OB.FENCE, 6); scatter(OB.TREE, 4);
    } else if (p.type === 'ruins') {
      for (let y = ty - 8; y <= ty + 8; y++) for (let x = tx - 8; x <= tx + 8; x++) {
        if (!this.inb(x, y) || this.gr[y * MW + x] === GR.WATER || this.gr[y * MW + x] === GR.OCEAN) continue;
        if (Math.hypot(x - tx, y - ty) < 8.5) { this.gr[y * MW + x] = GR.STONEF; this.ob[y * MW + x] = 0; }
      }
      // こわれた かべの わ
      for (let a = 0; a < TAU; a += 0.09) {
        const x = Math.round(tx + Math.cos(a) * 7), y = Math.round(ty + Math.sin(a) * 7);
        if (this.inb(x, y) && R() < 0.65) this.setOb(x, y, OB.WBRICK);
      }
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; this.setOb(Math.round(tx + Math.cos(a) * 4), Math.round(ty + Math.sin(a) * 4), OB.PILLAR); }
      this.setOb(tx, ty, OB.CHEST); this.setOb(tx + 1, ty + 1, OB.CHEST); this.setOb(tx - 1, ty - 1, OB.CHEST);
      for (let k = 0; k < 6; k++) this.lootSpots.push({ x: (tx - 5 + R() * 10) * TILE, y: (ty - 5 + R() * 10) * TILE, q: 1 });
      if (sandy) scatter(OB.CACTUS, 5); else scatter(OB.BUSH, 6);
    } else if (p.type === 'camp') {
      for (let k = 0; k < 6; k++) scatter(OB.TENT, 1, 6);
      this.setOb(tx, ty, OB.CAMPFIRE);
      scatter(OB.CHEST, 3, 7); scatter(OB.BUSH, 10); scatter(OB.TREE, 12); scatter(OB.CRATE, 3, 7);
      for (let k = 0; k < 5; k++) this.lootSpots.push({ x: (tx - 6 + R() * 12) * TILE, y: (ty - 6 + R() * 12) * TILE, q: 0 });
    }
  },

  /* 地面の えを 1かいだけ かく（1マス 8px のドット絵） */
  paintGround() {
    const S = 8;
    const c = document.createElement('canvas');
    c.width = MW * S; c.height = MH * S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const D = img.data;
    const cols = GR_COL.map(hexRgb);
    const R = seeded(this.seed * 13 + 2);
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      const g = this.gr[ty * MW + tx];
      const base = cols[g];
      for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
        let v = (R() - 0.5) * 14;
        if (g === GR.ROAD) { v = (R() - 0.5) * 8; }
        if (g === GR.WOOD) { v = (py === 0 ? -26 : 0) + (R() - 0.5) * 6 + ((tx * 3 + ty) % 2 ? 6 : 0); }
        if (g === GR.CONCRETE) { v = (px === 0 || py === 0 ? -14 : 0) + (R() - 0.5) * 6; }
        if (g === GR.STONEF) { v = (px === 0 || py === 0 ? -22 : 0) + ((tx + ty) % 2 ? 8 : -4) + (R() - 0.5) * 6; }
        if (g === GR.DIRT) { v = (py % 4 === 0 ? -20 : 0) + (R() - 0.5) * 8; }
        if (g === GR.WATER || g === GR.OCEAN) { v = ((px + py * 2 + tx * 5) % 9 === 0 ? 18 : 0) + (R() - 0.5) * 6; }
        if ((g === GR.GRASS || g === GR.FOREST) && R() < 0.06) v += 22;
        const o = ((ty * S + py) * c.width + tx * S + px) * 4;
        D[o] = base[0] + v; D[o + 1] = base[1] + v; D[o + 2] = base[2] + v; D[o + 3] = 255;
      }
    }
    // 道の まんなかの せん
    ctx.putImageData(img, 0, 0);
    this.groundCanvas = c;
    this.paintMap();
  },

  paintMap() {
    const S = 2;
    const c = document.createElement('canvas');
    c.width = MW * S; c.height = MH * S;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.groundCanvas, 0, 0, c.width, c.height);
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      const o = this.ob[ty * MW + tx];
      if (o === OB.TREE || o === OB.PINE) { ctx.fillStyle = 'rgba(30,80,30,0.8)'; ctx.fillRect(tx * S, ty * S, S, S); }
      else if (o === OB.ROCK) { ctx.fillStyle = '#8a8e96'; ctx.fillRect(tx * S, ty * S, S, S); }
    }
    for (const h of this.houses) { ctx.fillStyle = h.col; ctx.fillRect(h.x0 * S, h.y0 * S, (h.x1 - h.x0 + 1) * S, (h.y1 - h.y0 + 1) * S); }
    this.mapCanvas = c;
  },

  /* ------------------------------- 当たり判定 ------------------------------- */
  /* 円が かべに めりこまないように うごかす */
  moveCircle(e, dx, dy, ghost = false) {
    if (ghost) { e.x = clamp(e.x + dx, 20, WORLD_W - 20); e.y = clamp(e.y + dy, 20, WORLD_H - 20); return; }
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 12) || 1;
    const sx = dx / steps, sy = dy / steps;
    for (let s = 0; s < steps; s++) {
      e.x += sx; this.pushOut(e, true);
      e.y += sy; this.pushOut(e, false);
    }
    e.x = clamp(e.x, e.r, WORLD_W - e.r); e.y = clamp(e.y, e.r, WORLD_H - e.r);
  },
  pushOut(e) {
    const r = e.r;
    const tx0 = Math.floor((e.x - r) / TILE), tx1 = Math.floor((e.x + r) / TILE);
    const ty0 = Math.floor((e.y - r) / TILE), ty1 = Math.floor((e.y + r) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!this.solid(tx, ty)) continue;
      const bx = tx * TILE, by = ty * TILE;
      const cx = clamp(e.x, bx, bx + TILE), cy = clamp(e.y, by, by + TILE);
      const ddx = e.x - cx, ddy = e.y - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 >= r * r) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2), push = r - d;
        e.x += (ddx / d) * push; e.y += (ddy / d) * push;
      } else {
        // 中心が マスの なか: いちばん ちかい へりへ
        const l = e.x - bx, rt = bx + TILE - e.x, t = e.y - by, b = by + TILE - e.y;
        const m = Math.min(l, rt, t, b);
        if (m === l) e.x = bx - r; else if (m === rt) e.x = bx + TILE + r; else if (m === t) e.y = by - r; else e.y = by + TILE + r;
      }
    }
  },
  /* 2点の あいだが みとおせるか（かべ・木・やぶ） */
  los(x0, y0, x1, y1, bushBlocks = true) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 16);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const tx = Math.floor(lerp(x0, x1, t) / TILE), ty = Math.floor(lerp(y0, y1, t) / TILE);
      const o = this.obAt(tx, ty);
      const D = OBD[o];
      if (D.see) return false;
      if (bushBlocks && D.hide && i > 2 && i < n - 2) return false;
    }
    return true;
  },
  houseAt(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    for (const h of this.houses) if (tx >= h.x0 && tx <= h.x1 && ty >= h.y0 && ty <= h.y1) return h;
    return null;
  },
  inWater(x, y) { const g = this.grAt(Math.floor(x / TILE), Math.floor(y / TILE)); return g === GR.WATER || g === GR.OCEAN; },
  inBush(x, y) { return this.obAt(Math.floor(x / TILE), Math.floor(y / TILE)) === OB.BUSH; },
  /* じめんに おけるか */
  freeSpot(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    return this.inb(tx, ty) && !OBD[this.ob[ty * MW + tx]].solid;
  },
  poiAt(x, y) {
    for (const p of this.pois) if (Math.abs(p.x - x) < p.r && Math.abs(p.y - y) < p.r) return p;
    return null;
  },
};
