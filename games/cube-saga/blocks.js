/* ブロック・アイテム・レシピの定義と、テクスチャ/アイコンの生成 */
'use strict';
(function () {
  const CS = window.CS;

  // ================= テクスチャ (16px タイル × 16×16 枚) =================
  const ATLAS = document.createElement('canvas');
  ATLAS.width = ATLAS.height = 256;
  const aimg = new ImageData(256, 256);
  const TILE = {};
  let tileN = 0;
  function tile(name, fn) {
    const t = tileN++;
    TILE[name] = t;
    const ox = (t % 16) * 16, oy = (t >> 4) * 16;
    const r = CS.rng(t * 7919 + 13);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const c = fn(x, y, r);
      if (!c) continue;
      const i = ((oy + y) * 256 + ox + x) * 4;
      aimg.data[i] = CS.clamp(c[0], 0, 255); aimg.data[i + 1] = CS.clamp(c[1], 0, 255);
      aimg.data[i + 2] = CS.clamp(c[2], 0, 255); aimg.data[i + 3] = c.length > 3 ? c[3] : 255;
    }
    return t;
  }
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k, c.length > 3 ? c[3] : 255];
  const nz = (c, r, a, b) => mul(c, a + r() * (b - a));
  // 継ぎ目のない Voronoi (丸石など)
  function vor(seed, n) {
    const r = CS.rng(seed), pts = [];
    for (let i = 0; i < n; i++) pts.push([r() * 16, r() * 16, 0.75 + r() * 0.35]);
    return function (x, y) {
      let d1 = 99, d2 = 99, k = 1;
      for (const p of pts) for (let ox = -16; ox <= 16; ox += 16) for (let oy = -16; oy <= 16; oy += 16) {
        const d = Math.hypot(x + 0.5 - p[0] - ox, y + 0.5 - p[1] - oy);
        if (d < d1) { d2 = d1; d1 = d; k = p[2]; } else if (d < d2) d2 = d;
      }
      return [d2 - d1, k];
    };
  }
  const STONE = [125, 125, 128];
  const stoneFn = (x, y, r) => nz(STONE, r, 0.82, 1.1);
  const ANC = [146, 122, 98];
  const ancFn = (x, y, r) => nz(((y + (x >> 3)) % 5 < 2) ? ANC : mul(ANC, 0.86), r, 0.88, 1.08);
  function ore(name, base, col, seed) {
    const r2 = CS.rng(seed), spots = new Set();
    for (let k = 0; k < 6; k++) {
      const cx = 1 + Math.floor(r2() * 13), cy = 1 + Math.floor(r2() * 13);
      spots.add(cx + cy * 16); spots.add(cx + 1 + cy * 16); spots.add(cx + (cy + 1) * 16);
      if (r2() < 0.5) spots.add(cx + 1 + (cy + 1) * 16);
    }
    return tile(name, (x, y, r) => spots.has(x + y * 16) ? nz(col, r, 0.85, 1.15) : base(x, y, r));
  }
  function grassSide(name, top, side) {
    return tile(name, (x, y, r) => {
      const edge = 3 + ((x * 7) % 3 === 0 ? 1 : 0);
      return y < edge ? nz(top, r, 0.85, 1.1) : side(x, y, r);
    });
  }
  function planks(name, base) {
    return tile(name, (x, y, r) => {
      const band = y >> 2;
      if (y % 4 === 3) return mul(base, 0.62);
      if (x === (band * 5 + 3) % 16) return mul(base, 0.7);
      return nz(base, r, 0.88, 1.08);
    });
  }
  function swirl(name, c1, c2) {
    return tile(name, (x, y) => {
      const a = Math.atan2(y - 7.5, x - 7.5), d = Math.hypot(x - 7.5, y - 7.5);
      const v = (Math.sin(a * 3 + d * 1.3) + 1) / 2;
      return [CS.lerp(c1[0], c2[0], v), CS.lerp(c1[1], c2[1], v), CS.lerp(c1[2], c2[2], v), 225];
    });
  }

  const GRASS = [96, 162, 56], DIRT = [134, 96, 67];
  const dirtFn = (x, y, r) => nz(r() < 0.08 ? mul(DIRT, 0.75) : DIRT, r, 0.86, 1.12);
  tile('grassTop', (x, y, r) => nz(r() < 0.1 ? mul(GRASS, 0.8) : GRASS, r, 0.86, 1.12));
  grassSide('grassSide', GRASS, dirtFn);
  tile('dirt', dirtFn);
  tile('stone', stoneFn);
  const cob = vor(5, 9);
  tile('cobble', (x, y, r) => { const [e, k] = cob(x, y); return e < 1.1 ? nz([72, 72, 74], r, 0.9, 1.1) : nz(STONE, r, k * 0.9, k * 1.05); });
  tile('bedrock', (x, y, r) => { const v = r(); return v < 0.33 ? [40, 40, 42] : v < 0.66 ? [85, 85, 88] : [120, 120, 124]; });
  tile('sand', (x, y, r) => nz([220, 207, 160], r, 0.92, 1.05));
  tile('water', (x, y, r) => ((y + (x >> 2)) % 5 === 0 ? [90, 150, 235, 170] : nz([42, 98, 205, 170], r, 0.92, 1.06)));
  const LOG = [108, 80, 48];
  tile('logSide', (x, y, r) => (x % 4 === 0 ? mul(LOG, 0.7) : nz(LOG, r, 0.85, 1.1)));
  tile('logTop', (x, y, r) => { const d = Math.hypot(x - 7.5, y - 7.5); return d > 6.8 ? mul(LOG, 0.9) : nz(Math.floor(d) % 2 ? [168, 130, 78] : [140, 106, 62], r, 0.94, 1.05); });
  tile('leaves', (x, y, r) => (r() < 0.16 ? null : nz(r() < 0.2 ? [44, 110, 30] : [62, 142, 42], r, 0.85, 1.12)));
  planks('planks', [176, 140, 86]);
  tile('glass', (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return [215, 238, 255];
    if ((x + y === 7 || x + y === 8) && x > 2 && y > 2) return [255, 255, 255, 220];
    return [200, 230, 255, 30];
  });
  ore('coalOre', stoneFn, [35, 35, 38], 21);
  ore('ironOre', stoneFn, [214, 170, 140], 22);
  ore('goldOre', stoneFn, [250, 212, 60], 23);
  ore('diamondOre', stoneFn, [90, 235, 230], 24);
  tile('crystalOre', (x, y, r) => {
    const sh = ((x === 4 || x === 11) && y > 3 && y < 10) || ((x === 7 || x === 8) && y > 6 && y < 14) || (x === 13 && y > 1 && y < 6);
    return sh ? nz([235, 90, 235], r, 0.9, 1.15) : stoneFn(x, y, r);
  });
  tile('tableTop', (x, y, r) => (x === 0 || y === 0 || x === 15 || y === 15) ? [90, 60, 35] : (x === 8 || y === 8 ? [120, 85, 50] : nz([176, 140, 86], r, 0.9, 1.06)));
  tile('tableSide', (x, y, r) => {
    if (y < 3) return [90, 60, 35];
    if (y > 4 && y < 9 && x > 2 && x < 7) return [170, 170, 175]; // のこぎり
    if (x > 9 && x < 12 && y > 4 && y < 12) return [110, 80, 45]; // かなづち
    if (y > 4 && y < 7 && x > 8 && x < 14) return [150, 150, 155];
    return y % 4 === 3 ? [110, 85, 50] : nz([176, 140, 86], r, 0.9, 1.06);
  });
  tile('furnace', (x, y, r) => {
    if (x > 3 && x < 12 && y > 7 && y < 14) return y > 11 ? [255, 140 + r() * 60, 30] : [25, 22, 22];
    const [e, k] = cob(x, y); return e < 1.1 ? [70, 70, 72] : nz([130, 130, 132], r, k * 0.9, k);
  });
  tile('torch', (x, y, r) => {
    if (x < 7 || x > 8) return null;
    if (y < 6) return null;
    if (y < 8) return y === 6 ? [255, 240, 120] : [255, 170, 40];
    return nz([110, 80, 40], r, 0.9, 1.1);
  });
  tile('brick', (x, y, r) => (y % 4 === 3 || (x + ((y >> 2) % 2) * 4) % 8 === 7) ? [190, 180, 168] : nz([152, 62, 46], r, 0.88, 1.1));
  tile('stoneBrick', (x, y, r) => (y % 8 === 7 || (x + ((y >> 3) % 2) * 8) % 16 === 15) ? [85, 85, 88] : nz([128, 128, 132], r, 0.9, 1.06));
  tile('goldBlock', (x, y, r) => (x === 0 || y === 0) ? [255, 240, 140] : (x === 15 || y === 15) ? [190, 140, 30] : ((x + y) % 9 === 0 ? [255, 250, 190] : nz([245, 200, 50], r, 0.94, 1.05)));
  const wool = (name, c) => tile(name, (x, y, r) => nz(c, r, (x + y) % 2 ? 0.9 : 0.97, 1.05));
  wool('woolWhite', [236, 236, 236]);
  wool('woolRed', [190, 40, 40]);
  wool('woolBlue', [50, 80, 190]);
  function flower(name, petal) {
    return tile(name, (x, y) => {
      if ((x === 7 || x === 8) && y > 7) return [60, 140, 40];
      if ((x === 6 && y === 11) || (x === 9 && y === 12) || (x === 5 && y === 11)) return [70, 160, 45];
      const d = Math.hypot(x - 7.5, y - 5.5);
      if (d < 1.2) return [250, 220, 60];
      if (d < 3) return petal;
      return null;
    });
  }
  flower('flowerRed', [220, 40, 50]);
  flower('flowerYellow', [255, 210, 40]);
  tile('tallGrass', (x, y) => {
    const h = [9, 5, 11, 4, 8, 12, 6, 10, 3, 9, 7, 11, 5, 8, 10, 6][x];
    if (y < h || x % 2 === 1 && y < h + 3) return null;
    return mul(GRASS, 0.8 + (x % 3) * 0.12);
  });
  tile('heroLogSide', (x, y, r) => (x % 5 === 1 ? [150, 185, 235] : r() < 0.04 ? [255, 255, 255] : nz([212, 216, 228], r, 0.9, 1.05)));
  tile('heroLogTop', (x, y, r) => { const d = Math.hypot(x - 7.5, y - 7.5); return d > 6.8 ? [190, 196, 210] : nz(Math.floor(d) % 2 ? [235, 240, 250] : [170, 200, 240], r, 0.95, 1.05); });
  tile('heroLeaves', (x, y, r) => (r() < 0.14 ? null : r() < 0.12 ? [190, 255, 245] : nz([70, 196, 186], r, 0.85, 1.12)));
  const sbFn = (x, y, r) => (y % 8 === 7 || (x + ((y >> 3) % 2) * 8) % 16 === 15) ? [85, 85, 88] : (r() < 0.12 ? [80, 130, 70] : nz([128, 128, 132], r, 0.9, 1.06));
  tile('shrine', sbFn);
  tile('pedestalSide', (x, y, r) => {
    if (y < 2) return [230, 190, 70];
    if ((x === 7 || x === 8) && y > 2 && y < 10) return [200, 220, 255];
    if (y === 10 && x > 4 && x < 11) return [240, 200, 70];
    if ((x === 7 || x === 8) && y > 10 && y < 14) return [120, 80, 50];
    return sbFn(x, y, r);
  });
  tile('pedestalTop', (x, y, r) => (x < 2 || y < 2 || x > 13 || y > 13) ? [230, 190, 70] : nz([140, 140, 150], r, 0.9, 1.05));
  tile('snow', (x, y, r) => nz([244, 248, 255], r, 0.95, 1.02));
  tile('ice', (x, y, r) => (x === y || x === 15 - y && x > 6) ? [235, 245, 255, 220] : nz([150, 195, 250, 190], r, 0.95, 1.05));
  tile('ancientStone', ancFn);
  tile('fossil', (x, y, r) => {
    const t = (x - 3) / 9, ly = 11 - t * 7;
    const onBone = t >= 0 && t <= 1 && Math.abs(y - ly) < 1.2;
    const knob = Math.hypot(x - 3, y - 11) < 1.8 || Math.hypot(x - 2, y - 12.5) < 1.2 || Math.hypot(x - 12, y - 4) < 1.8 || Math.hypot(x - 13, y - 2.5) < 1.2;
    return onBone || knob ? nz([238, 230, 205], r, 0.92, 1.05) : ancFn(x, y, r);
  });
  ore('amberOre', ancFn, [245, 150, 30], 31);
  tile('fern', (x, y) => {
    const dx = Math.abs(x - 7.5), w = (16 - y) * 0.45;
    if (dx < 0.6 && y > 3) return [50, 110, 35];
    if (dx < w && (x + y) % 2 === 0 && y > 2) return [70 + y * 3, 150, 45];
    return null;
  });
  const AGRASS = [92, 132, 48];
  tile('ancientGrassTop', (x, y, r) => nz(r() < 0.12 ? mul(AGRASS, 0.78) : AGRASS, r, 0.86, 1.12));
  grassSide('ancientGrassSide', AGRASS, dirtFn);
  tile('cycadSide', (x, y, r) => (((x + y) % 4 === 0) || ((x - y + 16) % 4 === 0)) ? [80, 60, 38] : nz([128, 100, 62], r, 0.9, 1.08));
  tile('cycadTop', (x, y, r) => nz(Math.floor(Math.hypot(x - 7.5, y - 7.5)) % 2 ? [150, 120, 75] : [120, 95, 60], r, 0.95, 1.05));
  tile('cycadLeaves', (x, y, r) => (r() < 0.24 ? null : nz(x % 3 === 0 ? [100, 150, 30] : [130, 178, 44], r, 0.88, 1.1)));
  tile('volcanic', (x, y, r) => (r() < 0.04 ? [210, 70, 20] : nz([48, 42, 44], r, 0.8, 1.25)));
  swirl('ancientPortal', [140, 60, 210], [60, 225, 150]);
  swirl('skyPortal', [100, 200, 255], [250, 255, 255]);
  swirl('homePortal', [255, 205, 70], [255, 255, 235]);
  tile('cloud', (x, y, r) => nz([242, 246, 252], r, 0.95, 1.02));
  const SKS = [192, 182, 222];
  const skyStoneFn = (x, y, r) => nz(r() < 0.1 ? mul(SKS, 0.85) : SKS, r, 0.9, 1.06);
  tile('skyStone', skyStoneFn);
  tile('skyGrassTop', (x, y, r) => nz([140, 222, 230], r, 0.88, 1.08));
  grassSide('skyGrassSide', [140, 222, 230], skyStoneFn);
  tile('display', (x, y, r) => (x < 2 || y < 2 || x > 13 || y > 13) ? nz([120, 85, 50], r, 0.9, 1.05) : ((x + y === 10 || x + y === 11) ? [255, 255, 255, 200] : [200, 230, 255, 30]));
  tile('roof', (x, y, r) => (y % 4 === 3 || ((x + (y >> 2) * 2) % 4 === 0 && y % 4 === 2)) ? [100, 40, 30] : nz([165, 72, 50], r, 0.9, 1.08));
  tile('lamp', (x, y, r) => (x < 2 || y < 2 || x > 13 || y > 13) ? [120, 80, 170] : nz([255, 238, 185], r, 0.95, 1.03));
  planks('darkPlanks', [104, 72, 46]);

  // ================= ブロック =================
  const B = {};
  const BLOCKS = [];
  function blk(id, key, o) {
    o.id = id; o.key = key;
    if (o.solid === undefined) o.solid = true;
    if (o.opaque === undefined) o.opaque = true;
    if (!o.render) o.render = 'cube';
    if (o.hard === undefined) o.hard = 1;
    if (typeof o.tex === 'string') o.tex = { top: o.tex, bottom: o.tex, side: o.tex };
    if (o.tex) o.tx = { top: TILE[o.tex.top], bottom: TILE[o.tex.bottom || o.tex.top], side: TILE[o.tex.side || o.tex.top] };
    BLOCKS[id] = o; B[key] = id;
  }
  const see = { opaque: false };
  blk(0, 'air', { name: 'くうき', solid: false, opaque: false, render: 'none' });
  blk(1, 'grass', { name: 'くさブロック', tex: { top: 'grassTop', bottom: 'dirt', side: 'grassSide' }, hard: 0.9, tool: 'shovel', drop: 'dirt' });
  blk(2, 'dirt', { name: 'つち', tex: 'dirt', hard: 0.75, tool: 'shovel' });
  blk(3, 'stone', { name: 'いし', tex: 'stone', hard: 2.5, tool: 'pick', tier: 1, drop: 'cobble', hardSound: 1 });
  blk(4, 'cobble', { name: 'まるいし', tex: 'cobble', hard: 3, tool: 'pick', tier: 1, hardSound: 1 });
  blk(5, 'bedrock', { name: 'かたいいわ', tex: 'bedrock', unbreak: true });
  blk(6, 'sand', { name: 'すな', tex: 'sand', hard: 0.75, tool: 'shovel' });
  blk(7, 'water', { name: 'みず', tex: 'water', solid: false, opaque: false, render: 'liquid', unbreak: true, att: 2 });
  blk(8, 'log', { name: 'げんぼく', tex: { top: 'logTop', side: 'logSide' }, hard: 3, tool: 'axe' });
  blk(9, 'leaves', { name: 'はっぱ', tex: 'leaves', opaque: false, render: 'cutout', hard: 0.3, att: 1, drop: 'leafDrop' });
  blk(10, 'planks', { name: 'いたざい', tex: 'planks', hard: 3, tool: 'axe' });
  blk(11, 'glass', { name: 'ガラス', tex: 'glass', opaque: false, render: 'cutout', hard: 0.5, hardSound: 1 });
  blk(12, 'coalOre', { name: 'せきたんのこうせき', tex: 'coalOre', hard: 4, tool: 'pick', tier: 1, drop: 'coal', hardSound: 1 });
  blk(13, 'ironOre', { name: 'てつのこうせき', tex: 'ironOre', hard: 4.5, tool: 'pick', tier: 2, drop: 'rawIron', hardSound: 1 });
  blk(14, 'goldOre', { name: 'きんのこうせき', tex: 'goldOre', hard: 4.5, tool: 'pick', tier: 3, drop: 'rawGold', hardSound: 1 });
  blk(15, 'diamondOre', { name: 'ダイヤのこうせき', tex: 'diamondOre', hard: 5, tool: 'pick', tier: 3, drop: 'diamond', hardSound: 1 });
  blk(16, 'crystalOre', { name: 'まほうのこうせき', tex: 'crystalOre', hard: 5, tool: 'pick', tier: 3, drop: 'crystal', light: 7, hardSound: 1 });
  blk(17, 'table', { name: 'さぎょうだい', tex: { top: 'tableTop', bottom: 'planks', side: 'tableSide' }, hard: 3.5, tool: 'axe', station: 'table' });
  blk(18, 'furnace', { name: 'かまど', tex: { top: 'cobble', side: 'furnace' }, hard: 5, tool: 'pick', tier: 1, station: 'furnace', light: 6, hardSound: 1 });
  blk(19, 'torch', { name: 'たいまつ', tex: 'torch', solid: false, opaque: false, render: 'torch', hard: 0, light: 14 });
  blk(20, 'brick', { name: 'レンガ', tex: 'brick', hard: 5, tool: 'pick', tier: 1, hardSound: 1 });
  blk(21, 'stoneBrick', { name: 'いしレンガ', tex: 'stoneBrick', hard: 5, tool: 'pick', tier: 1, hardSound: 1 });
  blk(22, 'goldBlock', { name: 'きんブロック', tex: 'goldBlock', hard: 6, tool: 'pick', tier: 3, hardSound: 1 });
  blk(23, 'woolWhite', { name: 'しろいけいと', tex: 'woolWhite', hard: 1.2 });
  blk(24, 'woolRed', { name: 'あかいけいと', tex: 'woolRed', hard: 1.2 });
  blk(25, 'woolBlue', { name: 'あおいけいと', tex: 'woolBlue', hard: 1.2 });
  blk(26, 'flowerRed', { name: 'あかいはな', tex: 'flowerRed', solid: false, opaque: false, render: 'cross', hard: 0 });
  blk(27, 'flowerYellow', { name: 'きいろいはな', tex: 'flowerYellow', solid: false, opaque: false, render: 'cross', hard: 0 });
  blk(28, 'tallGrass', { name: 'くさ', tex: 'tallGrass', solid: false, opaque: false, render: 'cross', hard: 0, drop: null });
  blk(29, 'heroLog', { name: 'ゆうしゃのき', tex: { top: 'heroLogTop', side: 'heroLogSide' }, hard: 4, tool: 'axe' });
  blk(30, 'heroLeaves', { name: 'ひかるはっぱ', tex: 'heroLeaves', opaque: false, render: 'cutout', hard: 0.4, light: 9, att: 1, drop: null });
  blk(31, 'pedestal', { name: 'つるぎのだいざ', tex: { top: 'pedestalTop', side: 'pedestalSide' }, unbreak: true, light: 10 });
  blk(32, 'shrine', { name: 'しんでんのいし', tex: 'shrine', hard: 6, tool: 'pick', tier: 2, hardSound: 1 });
  blk(33, 'snow', { name: 'ゆき', tex: 'snow', hard: 0.4, tool: 'shovel' });
  blk(34, 'ice', { name: 'こおり', tex: 'ice', opaque: false, render: 'glassy', hard: 0.7, att: 1, drop: null, hardSound: 1 });
  blk(35, 'ancientStone', { name: 'こだいのいし', tex: 'ancientStone', hard: 2.5, tool: 'pick', tier: 1, hardSound: 1 });
  blk(36, 'fossilBlock', { name: 'かせきのいし', tex: 'fossil', hard: 3, tool: 'pick', tier: 1, drop: 'fossilDrop', hardSound: 1 });
  blk(37, 'amberOre', { name: 'こはくのこうせき', tex: 'amberOre', hard: 3.5, tool: 'pick', tier: 1, drop: 'amberDrop', hardSound: 1 });
  blk(38, 'fern', { name: 'こだいのシダ', tex: 'fern', solid: false, opaque: false, render: 'cross', hard: 0, drop: null });
  blk(39, 'ancientGrass', { name: 'こだいのくさブロック', tex: { top: 'ancientGrassTop', bottom: 'dirt', side: 'ancientGrassSide' }, hard: 0.9, tool: 'shovel', drop: 'dirt' });
  blk(40, 'cycad', { name: 'ソテツのみき', tex: { top: 'cycadTop', side: 'cycadSide' }, hard: 3, tool: 'axe' });
  blk(41, 'cycadLeaves', { name: 'ソテツのは', tex: 'cycadLeaves', opaque: false, render: 'cutout', hard: 0.3, att: 1, drop: null });
  blk(42, 'volcanic', { name: 'かざんがん', tex: 'volcanic', hard: 3, tool: 'pick', tier: 1, hardSound: 1 });
  blk(43, 'ancientPortal', { name: 'こだいのゲート', tex: 'ancientPortal', solid: false, opaque: false, render: 'portal', unbreak: true, light: 13, portal: 'ancient' });
  blk(44, 'skyPortal', { name: 'てんくうのゲート', tex: 'skyPortal', solid: false, opaque: false, render: 'portal', unbreak: true, light: 13, portal: 'sky' });
  blk(45, 'homePortal', { name: 'かえりのゲート', tex: 'homePortal', solid: false, opaque: false, render: 'portal', unbreak: true, light: 13, portal: 'home' });
  blk(46, 'cloud', { name: 'くも', tex: 'cloud', hard: 0.5 });
  blk(47, 'skyStone', { name: 'そらのいし', tex: 'skyStone', hard: 2.5, tool: 'pick', tier: 1, hardSound: 1 });
  blk(48, 'skyGrass', { name: 'そらのくさブロック', tex: { top: 'skyGrassTop', bottom: 'skyStone', side: 'skyGrassSide' }, hard: 0.9, tool: 'shovel' });
  blk(49, 'display', { name: 'てんじケース', tex: 'display', opaque: false, render: 'cutout', hard: 1.5, tool: 'axe' });
  blk(50, 'roof', { name: 'やねがわら', tex: 'roof', hard: 3, tool: 'pick', tier: 1, hardSound: 1 });
  blk(51, 'lamp', { name: 'まほうのランプ', tex: 'lamp', hard: 1, light: 15, hardSound: 1 });
  blk(52, 'darkPlanks', { name: 'こげちゃのいたざい', tex: 'darkPlanks', hard: 3, tool: 'axe' });
  const NB = 53;

  // 高速参照用の表
  const SOLID = new Uint8Array(256), OPAQUE = new Uint8Array(256), ATT = new Uint8Array(256), EMIT = new Uint8Array(256), RENDER = [];
  for (let i = 0; i < NB; i++) {
    const b = BLOCKS[i];
    SOLID[i] = b.solid ? 1 : 0;
    OPAQUE[i] = b.opaque ? 1 : 0;
    ATT[i] = b.opaque ? 15 : (b.att || 0);
    EMIT[i] = b.light || 0;
    RENDER[i] = b.render;
  }

  // ================= アイテム =================
  const I = {};       // key -> id (ブロックも含む)
  const ITEMS = [];   // id -> def (ブロックは 0..255)
  for (let i = 0; i < NB; i++) { ITEMS[i] = { id: i, key: BLOCKS[i].key, name: BLOCKS[i].name, block: i, stack: 64 }; I[BLOCKS[i].key] = i; }
  let nextItem = 256;
  function item(key, o) {
    o.id = nextItem++; o.key = key;
    if (!o.stack) o.stack = 64;
    ITEMS[o.id] = o; I[key] = o.id;
    return o.id;
  }
  item('coal', { name: 'せきたん', sell: 2 });
  item('rawIron', { name: 'てつのかたまり', sell: 3 });
  item('ironIngot', { name: 'てつインゴット', sell: 8 });
  item('rawGold', { name: 'きんのかたまり', sell: 6 });
  item('goldIngot', { name: 'きんインゴット', sell: 15 });
  item('diamond', { name: 'ダイヤモンド', sell: 50 });
  item('crystal', { name: 'まほうのけっしょう', sell: 25 });
  item('stick', { name: 'ぼう', sell: 0 });
  item('apple', { name: 'りんご', food: 4, sell: 1 });
  item('bread', { name: 'パン', food: 6 });
  item('rawMeat', { name: 'なまにく', food: 3, sell: 1 });
  item('cookedMeat', { name: 'やきにく', food: 8, sell: 3 });
  const MATS = [['wood', 'き', 1, [176, 140, 86]], ['stone', 'いし', 2, [140, 140, 145]], ['iron', 'てつ', 3, [225, 225, 230]], ['diamond', 'ダイヤ', 4, [90, 235, 230]]];
  const TOOLK = [['pick', 'つるはし', 'pick'], ['axe', 'おの', 'axe'], ['shovel', 'シャベル', 'shovel'], ['sword', 'つるぎ', null]];
  for (const m of MATS) for (const t of TOOLK) {
    const dmg = t[0] === 'sword' ? 3 + m[2] : t[0] === 'axe' ? 2 + m[2] : 1 + Math.ceil(m[2] / 2);
    item(m[0] + '_' + t[0], { name: m[1] + 'の' + t[1], stack: 1, tool: t[2], tier: m[2], dmg, mat: m[3], kind: t[0] });
  }
  item('heroSword', { name: 'ゆうしゃのつるぎ', stack: 1, dmg: 12, tier: 4, kind: 'hero', special: 'beam' });
  item('bow', { name: 'ゆみ', stack: 1 });
  item('arrow', { name: 'や' });
  item('net', { name: 'つかまえアミ', stack: 1 });
  const WANDS = [
    ['fire', 'ほのおのつえ', [255, 90, 30], 3],
    ['ice', 'こおりのつえ', [120, 210, 255], 3],
    ['thunder', 'かみなりのつえ', [255, 230, 60], 8],
    ['heal', 'いやしのつえ', [120, 255, 140], 6],
    ['warp', 'ワープのつえ', [200, 110, 255], 5],
    ['blast', 'ばくれつのつえ', [255, 140, 200], 6],
  ];
  for (const w of WANDS) item('wand_' + w[0], { name: w[1], stack: 1, wand: w[0], gem: w[2], mp: w[3] });
  // 古代の生きもの (つかまえると「〜のおり」になる)
  const SPECIES = [
    { key: 'mammoth', name: 'マンモス', price: 400, col: [120, 80, 50] },
    { key: 'dodo', name: 'ドードー', price: 150, col: [140, 140, 150] },
    { key: 'trike', name: 'トリケラトプス', price: 600, col: [120, 150, 90] },
    { key: 'stego', name: 'ステゴサウルス', price: 500, col: [110, 140, 70] },
    { key: 'saber', name: 'サーベルタイガー', price: 700, col: [210, 150, 70] },
    { key: 'raptor', name: 'ラプトル', price: 350, col: [150, 120, 70] },
    { key: 'ptera', name: 'プテラノドン', price: 450, col: [180, 110, 90] },
    { key: 'trex', name: 'ティラノサウルス', price: 1500, col: [90, 110, 70] },
  ];
  for (const s of SPECIES) s.item = item('cage_' + s.key, { name: s.name + 'のおり', stack: 1, cage: s.key, col: s.col, price: s.price });
  const FOSSILS = [
    { key: 'ammonite', name: 'アンモナイトのかせき', price: 30, w: 30 },
    { key: 'trilobite', name: 'サンヨウチュウのかせき', price: 40, w: 25 },
    { key: 'bone', name: 'きょうりゅうのほね', price: 60, w: 25 },
    { key: 'tooth', name: 'きょうりゅうのキバ', price: 90, w: 12 },
    { key: 'skull', name: 'きょうりゅうのずがいこつ', price: 260, w: 4 },
    { key: 'amber', name: 'こはく', price: 25, w: 0 },
    { key: 'amberBug', name: 'むしいりこはく', price: 180, w: 0 },
  ];
  for (const f of FOSSILS) f.item = item('fos_' + f.key, { name: f.name, fossil: f.key, price: f.price });
  item('scale', { name: 'てんくうりゅうのウロコ', sell: 200 });
  const NITEMS = nextItem;

  // ================= ドロップ =================
  function rollDrop(bid, r) {
    const d = BLOCKS[bid].drop;
    if (d === null) return null;
    if (d === undefined) return [bid, 1];
    if (d === 'leafDrop') return r < 0.07 ? [I.apple, 1] : r < 0.17 ? [I.stick, 1] : null;
    if (d === 'fossilDrop') {
      const tot = FOSSILS.reduce((s, f) => s + f.w, 0);
      let k = r * tot;
      for (const f of FOSSILS) { k -= f.w; if (k < 0) return [f.item, 1]; }
      return [FOSSILS[0].item, 1];
    }
    if (d === 'amberDrop') return [r < 0.12 ? I.fos_amberBug : I.fos_amber, 1];
    return [I[d], 1];
  }

  // ================= レシピ =================
  // at: null=どこでも / table=さぎょうだいの近く / furnace=かまどの近く
  const R = [];
  const rec = (out, n, ins, at) => R.push({ out: I[out], n, ins: ins.map(([k, c]) => [I[k], c]), at: at || null });
  rec('planks', 4, [['log', 1]]);
  rec('planks', 4, [['heroLog', 1]]);
  rec('planks', 4, [['cycad', 1]]);
  rec('stick', 4, [['planks', 2]]);
  rec('table', 1, [['planks', 4]]);
  rec('torch', 4, [['stick', 1], ['coal', 1]]);
  rec('furnace', 1, [['cobble', 8]], 'table');
  const matIn = { wood: 'planks', stone: 'cobble', iron: 'ironIngot', diamond: 'diamond' };
  for (const m of MATS) {
    const mi = matIn[m[0]];
    rec(m[0] + '_pick', 1, [[mi, 3], ['stick', 2]], 'table');
    rec(m[0] + '_sword', 1, [[mi, 2], ['stick', 1]], 'table');
    rec(m[0] + '_axe', 1, [[mi, 3], ['stick', 2]], 'table');
    rec(m[0] + '_shovel', 1, [[mi, 1], ['stick', 2]], 'table');
  }
  rec('ironIngot', 1, [['rawIron', 1], ['coal', 1]], 'furnace');
  rec('goldIngot', 1, [['rawGold', 1], ['coal', 1]], 'furnace');
  rec('cookedMeat', 1, [['rawMeat', 1], ['coal', 1]], 'furnace');
  rec('glass', 2, [['sand', 2], ['coal', 1]], 'furnace');
  rec('brick', 2, [['dirt', 2], ['coal', 1]], 'furnace');
  rec('stoneBrick', 4, [['cobble', 4]], 'table');
  rec('darkPlanks', 2, [['planks', 2], ['coal', 1]], 'table');
  rec('roof', 4, [['brick', 2], ['cobble', 2]], 'table');
  rec('goldBlock', 1, [['goldIngot', 9]], 'table');
  rec('woolRed', 1, [['woolWhite', 1], ['flowerRed', 1]]);
  rec('woolBlue', 1, [['woolWhite', 1], ['crystal', 1]]);
  rec('bow', 1, [['stick', 3], ['woolWhite', 2]], 'table');
  rec('arrow', 4, [['stick', 1], ['cobble', 1]], 'table');
  rec('net', 1, [['stick', 3], ['woolWhite', 3]], 'table');
  rec('lamp', 2, [['crystal', 1], ['glass', 1]], 'table');
  rec('display', 2, [['glass', 2], ['planks', 2]], 'table');
  rec('wand_fire', 1, [['stick', 1], ['crystal', 2], ['coal', 3]], 'table');
  rec('wand_ice', 1, [['stick', 1], ['crystal', 2], ['snow', 4]], 'table');
  rec('wand_heal', 1, [['stick', 1], ['crystal', 2], ['apple', 3]], 'table');
  rec('wand_blast', 1, [['stick', 1], ['crystal', 2], ['ironIngot', 3]], 'table');
  rec('wand_thunder', 1, [['stick', 1], ['crystal', 3], ['goldIngot', 2]], 'table');
  rec('wand_warp', 1, [['stick', 1], ['crystal', 3], ['diamond', 1]], 'table');

  // ================= アイコン (32px × 16×16 枚) =================
  const ICONS = document.createElement('canvas');
  ICONS.width = ICONS.height = 576; // 36px のマスに 32px の絵 (となりの絵がにじまないよう すきまを空ける)
  const ig = ICONS.getContext('2d');
  ig.imageSmoothingEnabled = false;
  const ATL_IMG = document.createElement('canvas'); ATL_IMG.width = ATL_IMG.height = 256;
  ATL_IMG.getContext('2d').putImageData(aimg, 0, 0);
  ATLAS.getContext('2d').drawImage(ATL_IMG, 0, 0);
  // 白い1ドット (色だけの箱を描くときに使う) は右下
  ig.fillStyle = '#fff'; ig.fillRect(568, 568, 8, 8);

  const tileXY = (t) => [(t % 16) * 16, (t >> 4) * 16];
  function isoCube(g, def) {
    const faces = [
      [def.tx.top, [14 / 16, -7 / 16, 14 / 16, 7 / 16, 2, 9], 0],
      [def.tx.side, [14 / 16, 7 / 16, 0, 15 / 16, 2, 9], 0.22],
      [def.tx.side, [14 / 16, -7 / 16, 0, 15 / 16, 16, 16], 0.42],
    ];
    for (const [t, m, dark] of faces) {
      g.save(); g.transform(...m);
      const [sx, sy] = tileXY(t);
      g.drawImage(ATL_IMG, sx, sy, 16, 16, 0, 0, 16, 16);
      if (dark) { g.fillStyle = `rgba(0,0,0,${dark})`; g.fillRect(0, 0, 16, 16); }
      g.restore();
    }
  }
  // 16×16 のドット絵をかく小さな道具
  function pix() {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d');
    const col = (v) => typeof v === 'string' ? v : `rgb(${v[0] | 0},${v[1] | 0},${v[2] | 0})`;
    const P = {
      c, g,
      px(x, y, v) { if (x < 0 || y < 0 || x > 15 || y > 15) return; g.fillStyle = col(v); g.fillRect(x | 0, y | 0, 1, 1); },
      line(x0, y0, x1, y1, v) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
        for (let i = 0; i <= n; i++) P.px(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), v);
      },
      disc(cx, cy, r, v, ry) {
        ry = ry || r;
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (((x + 0.5 - cx) / r) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) P.px(x, y, v);
      },
      each(fn) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = fn(x, y); if (v) P.px(x, y, v); } },
    };
    return P;
  }
  const HANDLE = [122, 84, 44], HDARK = [74, 48, 24];
  function handle(P, x0, y0, x1, y1) { P.line(x0 + 1, y0, x1 + 1, y1, HDARK); P.line(x0, y0, x1, y1, HANDLE); }
  function drawItem(def) {
    const P = pix();
    const m = def.mat, md = m && mul(m, 0.62), ml = m && mul(m, 1.25);
    if (def.kind === 'sword' || def.kind === 'hero') {
      const bl = def.kind === 'hero' ? [200, 225, 255] : m, bd = def.kind === 'hero' ? [110, 150, 220] : md;
      P.line(5, 10, 14, 1, bl); P.line(6, 10, 14, 2, bd); P.line(5, 9, 13, 1, def.kind === 'hero' ? [255, 255, 255] : ml);
      const guard = def.kind === 'hero' ? [240, 200, 60] : md;
      P.line(2, 8, 7, 13, guard); P.line(3, 8, 7, 12, guard);
      handle(P, 1, 14, 4, 11);
      if (def.kind === 'hero') { P.px(5, 10, [60, 120, 255]); P.px(1, 14, [240, 200, 60]); }
    } else if (def.kind === 'pick') {
      handle(P, 3, 13, 10, 6);
      for (let a = -118; a <= 28; a += 4) {
        const r = a * Math.PI / 180;
        P.px(9 + Math.cos(r) * 6, 7 + Math.sin(r) * 6, m); P.px(9 + Math.cos(r) * 5, 7 + Math.sin(r) * 5, md);
      }
    } else if (def.kind === 'axe') {
      // 柄の先の片側に 刃 (行ごとの x の範囲)
      const rows = { 1: [5, 7], 2: [3, 9], 3: [2, 10], 4: [2, 10], 5: [3, 10], 6: [4, 9], 7: [6, 8] };
      for (const y in rows) for (let x = rows[y][0]; x <= rows[y][1]; x++) P.px(x, +y, x === rows[y][0] ? ml : x === rows[y][1] ? md : m);
      handle(P, 2, 14, 12, 4);
    } else if (def.kind === 'shovel') {
      handle(P, 2, 14, 9, 7);
      P.disc(11.5, 4.5, 3.2, m); P.disc(11, 5, 1.6, ml);
    } else if (def.wand) {
      handle(P, 3, 13, 10, 6);
      P.disc(12, 4, 2.8, def.gem); P.px(11, 3, [255, 255, 255]);
      P.px(14, 8, def.gem); P.px(8, 2, def.gem); P.px(15, 1, [255, 255, 255]);
    } else if (def.key === 'bow') {
      for (let a = -100; a <= 10; a += 3) { const r = a * Math.PI / 180; P.px(4 + Math.cos(r) * 10, 12 + Math.sin(r) * 10, HANDLE); P.px(4 + Math.cos(r) * 9, 12 + Math.sin(r) * 9, HDARK); }
      P.line(2, 2, 13, 13, [230, 230, 230]);
    } else if (def.key === 'arrow') {
      P.line(3, 13, 12, 4, HANDLE); P.px(13, 3, [180, 180, 190]); P.px(12, 3, [180, 180, 190]); P.px(13, 4, [180, 180, 190]); P.px(14, 2, [220, 220, 230]);
      P.px(2, 13, [250, 250, 250]); P.px(3, 14, [250, 250, 250]); P.px(2, 14, [220, 60, 60]);
    } else if (def.key === 'stick') {
      handle(P, 2, 14, 12, 4);
    } else if (def.key === 'net') {
      handle(P, 2, 14, 8, 8);
      P.each((x, y) => { const d = Math.hypot(x + 0.5 - 11, y + 0.5 - 5); return d < 4.6 && d > 3.6 ? [240, 240, 240] : d < 3.6 && (x + y) % 2 === 0 ? [190, 200, 210] : null; });
    } else if (def.cage) {
      P.disc(8, 10, 5, def.col, 3.5); P.disc(11, 8, 2, mul(def.col, 1.2)); P.px(12, 7, [20, 20, 20]);
      P.each((x, y) => (y === 2 || y === 14 || ((x === 2 || x === 5 || x === 8 || x === 11 || x === 14) && y > 2 && y < 14)) && x > 1 && x < 15 ? [150, 150, 160] : null);
    } else if (def.fossil) {
      const f = def.fossil;
      if (f === 'ammonite') {
        P.disc(8, 8, 6, [205, 180, 140]);
        for (let t = 0; t < 14; t += 0.2) { const r = 0.42 * t; P.px(8 + Math.cos(t) * r, 8 + Math.sin(t) * r, [120, 95, 70]); }
      } else if (f === 'trilobite') {
        P.disc(8, 8, 4.5, [150, 130, 110], 6.5);
        P.each((x, y) => (y % 2 === 0 && y > 2 && y < 14 && Math.abs(x - 7.5) < 4) ? [100, 85, 70] : (Math.abs(x - 7.5) < 1 && y > 2 && y < 14 ? [180, 160, 135] : null));
      } else if (f === 'bone') {
        P.line(4, 11, 11, 4, [240, 235, 215]); P.line(4, 12, 12, 4, [240, 235, 215]);
        P.disc(3.5, 11.5, 1.6, [240, 235, 215]); P.disc(4.5, 13, 1.4, [240, 235, 215]); P.disc(12.5, 4.5, 1.6, [240, 235, 215]); P.disc(11.5, 3, 1.4, [240, 235, 215]);
      } else if (f === 'tooth') {
        P.each((x, y) => (y > 2 && y < 14 && Math.abs(x - 7.5 + (y - 8) * 0.25) < (14 - y) * 0.35) ? (x > 8 ? [210, 200, 175] : [245, 240, 225]) : null);
      } else if (f === 'skull') {
        P.disc(8, 7, 6, [235, 228, 205], 5); P.disc(8, 11, 4, [235, 228, 205], 3);
        P.disc(5.5, 7, 1.5, [40, 30, 25]); P.disc(10.5, 7, 1.5, [40, 30, 25]);
        for (let x = 5; x <= 11; x += 2) P.px(x, 12, [40, 30, 25]);
      } else {
        P.disc(8, 8, 5.5, [240, 150, 30]); P.disc(7, 6.5, 2, [255, 210, 120]);
        if (f === 'amberBug') { P.line(7, 9, 10, 9, [30, 20, 10]); P.px(8, 8, [30, 20, 10]); P.px(7, 10, [30, 20, 10]); P.px(10, 10, [30, 20, 10]); }
      }
    } else {
      const k = def.key;
      const lump = (c) => { P.disc(8, 9, 5.5, mul(c, 0.8), 4.5); P.disc(7, 8, 3.5, c, 3); P.px(6, 7, mul(c, 1.3)); };
      const ingot = (c) => P.each((x, y) => y > 5 && y < 12 && x >= 2 + (11 - y) * 0.4 && x <= 13 - (11 - y) * 0.4 ? (y < 8 ? mul(c, 1.2) : y > 10 ? mul(c, 0.7) : c) : null);
      const gem = (c) => P.each((x, y) => { const d = Math.abs(x - 7.5) + Math.abs(y - 8) * 0.8; return d < 6 ? (d < 2.5 ? mul(c, 1.3) : x < 8 ? c : mul(c, 0.75)) : null; });
      if (k === 'coal') lump([50, 50, 55]);
      else if (k === 'rawIron') lump([200, 160, 135]);
      else if (k === 'rawGold') lump([240, 200, 70]);
      else if (k === 'ironIngot') ingot([215, 215, 222]);
      else if (k === 'goldIngot') ingot([250, 205, 55]);
      else if (k === 'diamond') gem([90, 235, 230]);
      else if (k === 'crystal') { P.each((x, y) => (Math.abs(x - 7.5) < 3 - Math.abs(y - 8) * 0.0 && y > 1 + Math.abs(x - 7.5) && y < 15 - Math.abs(x - 7.5)) ? (x < 8 ? [245, 120, 245] : [190, 70, 200]) : null); P.px(7, 5, [255, 230, 255]); }
      else if (k === 'apple') { P.disc(8, 9.5, 5, [210, 35, 40]); P.px(6, 7, [255, 140, 140]); P.line(8, 2, 8, 5, HDARK); P.px(9, 3, [70, 160, 50]); P.px(10, 3, [70, 160, 50]); }
      else if (k === 'bread') { P.disc(8, 9, 6.5, [190, 125, 55], 4); P.line(5, 7, 6, 9, [240, 200, 140]); P.line(8, 7, 9, 9, [240, 200, 140]); P.line(11, 7, 12, 9, [240, 200, 140]); }
      else if (k === 'rawMeat' || k === 'cookedMeat') {
        const c = k === 'rawMeat' ? [225, 110, 110] : [150, 85, 45];
        P.disc(9, 7, 5, c, 4); P.disc(9, 7, 2, mul(c, 1.25)); P.line(3, 13, 6, 10, [240, 235, 220]); P.disc(3, 13, 1.3, [240, 235, 220]);
      } else if (k === 'scale') {
        P.each((x, y) => { const d = Math.hypot((x - 7.5) / 5, (y - 9) / 6); return d < 1 && y > 2 + Math.abs(x - 7.5) * 0.4 ? (x < 7 ? [150, 90, 220] : [90, 50, 160]) : null; });
        P.px(6, 6, [230, 210, 255]);
      } else { P.disc(8, 8, 5, [200, 0, 200]); }
    }
    return P.c;
  }
  // 各アイテムのアイコン番号を決めて描く
  let iconN = 0;
  for (let id = 0; id < NITEMS; id++) {
    const def = ITEMS[id];
    if (!def || id === 0) continue;
    def.icon = iconN++;
    const ox = (def.icon % 16) * 36 + 2, oy = (def.icon >> 4) * 36 + 2;
    ig.save(); ig.translate(ox, oy);
    if (def.block !== undefined) {
      const b = BLOCKS[def.block];
      if (b.render === 'cross' || b.render === 'torch') {
        const [sx, sy] = tileXY(b.tx.side);
        ig.drawImage(ATL_IMG, sx, sy, 16, 16, 0, 0, 32, 32);
      } else isoCube(ig, b);
    } else {
      ig.drawImage(drawItem(def), 0, 0, 16, 16, 0, 0, 32, 32);
    }
    ig.restore();
  }
  const ICON_URL = ICONS.toDataURL();
  // HTML 要素にアイコンを貼る
  function iconCss(el, id, size) {
    const d = ITEMS[id];
    if (!d) { el.style.backgroundImage = ''; return; }
    const k = size / 32;
    el.style.backgroundImage = `url(${ICON_URL})`;
    el.style.backgroundSize = `${576 * k}px ${576 * k}px`;
    el.style.backgroundPosition = `${-((d.icon % 16) * 36 + 2) * k}px ${-((d.icon >> 4) * 36 + 2) * k}px`;
  }

  Object.assign(CS, {
    ATLAS, TILE, ICONS, ICON_URL, iconCss,
    B, BLOCKS, NB, SOLID, OPAQUE, ATT, EMIT, RENDER,
    I, ITEMS, NITEMS, WANDS, SPECIES, FOSSILS, RECIPES: R, rollDrop,
  });
})();
