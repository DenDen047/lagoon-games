/* =========================================================================
   ハムスターの冒険 ― 世界
   大地図 (森・町・山・谷・月の野原) と 塔の各階 をつくる。当たり判定もここ。
   ========================================================================= */
'use strict';

/* タイルの種類。20 以上は歩けない。 */
const T = {
  GRASS: 0, FOREST: 1, MEADOW: 2, PATH: 3, TOWN: 4, ROCKY: 5, SNOW: 6, VALLEY: 7, MOON: 8,
  SAND: 9, FIELD: 10, BRIDGE: 11, FLOOR: 12, COBBLE: 13,
  WATER: 20, CLIFF: 21, SNOWCLIFF: 22, CHASM: 23, DENSE: 24, WALL: 25,
};
/* 0 = 歩ける, 1 = 壁 (弾も止まる), 2 = 水や谷 (弾と鳥はこえる) */
const tileSolid = (t) => (t === T.WATER || t === T.CHASM ? 2 : t >= 20 ? 1 : 0);

/* たたくと素材が出るもの。drops: [アイテム, 最小, 最大, 確率] */
const NODE_DEFS = {
  tree:       { hp: 3, solid: 10, drops: [['wood', 2, 3, 1], ['acorn', 1, 1, 0.12]], regrow: 70, sfx: 'chop', chip: '#8a5a32' },
  pine:       { hp: 4, solid: 10, drops: [['wood', 1, 2, 1]], regrow: 80, sfx: 'chop', chip: '#6a4a2a' },
  snowpine:   { hp: 4, solid: 10, drops: [['wood', 1, 2, 1]], regrow: 90, sfx: 'chop', chip: '#e8f4ff' },
  deadtree:   { hp: 3, solid: 10, drops: [['wood', 1, 2, 1]], regrow: 90, sfx: 'chop', chip: '#6a5a6a' },
  bush:       { hp: 1, solid: 0, drops: [['grass', 1, 2, 1], ['seed', 1, 1, 0.12]], regrow: 35, sfx: 'rustle', chip: '#5aa040' },
  sunflower:  { hp: 1, solid: 0, drops: [['seed', 1, 3, 1]], regrow: 50, sfx: 'rustle', chip: '#ffd23a' },
  mushroom:   { hp: 1, solid: 0, drops: [['mushroom', 1, 1, 1]], regrow: 60, sfx: 'rustle', chip: '#e0544f' },
  snowflower: { hp: 1, solid: 0, drops: [['snowflower', 1, 1, 1]], regrow: 80, sfx: 'rustle', chip: '#ffffff' },
  rock:       { hp: 3, solid: 12, tool: 1, drops: [['stone', 1, 2, 1]], regrow: 100, sfx: 'clink', chip: '#9a9a9a' },
  iron:       { hp: 4, solid: 12, tool: 1, drops: [['iron', 1, 1, 1], ['stone', 1, 1, 0.4]], regrow: 130, sfx: 'clink', chip: '#c08a6a' },
  crystal:    { hp: 5, solid: 11, tool: 2, drops: [['crystal', 1, 1, 1]], regrow: 160, sfx: 'clink', chip: '#9fe8ff' },
  moonrock:   { hp: 5, solid: 12, tool: 2, drops: [['moon', 1, 1, 1], ['stone', 1, 1, 0.5]], regrow: 160, sfx: 'clink', chip: '#d8c8ff' },
  thorns:     { hp: 1, solid: 15, fireOnly: true, tileSolid: true, chip: '#4a6a2a' },
};

/* ------------------------------ 大地図の下書き ------------------------------
   1 文字 = 4x4 タイル。48 x 32。
   # 深い森  F 森  g 草原  y ひまわり畑  H 家  1 森の塔  ~ 湖  b 砂浜  T 町
   ^ 岩山  m 山道  G いばらの門  h 山小屋  K ガイドの門  S 雪  A 雪の崖  2 風の塔
   v 谷  c キャンプ  C 割れ目  B 橋をかける所  n 月の野原  3 月の塔 */
const FOREST_ROWS = [
  '##############', '###FFFFFF#####', '##FFgggggFF###', '#FFggggggFFFF#', '#FFg1ggggFFFFF',
  '#FFgggggFFFFFF', 'FFFFgggFFFFFFF', 'FFFFFgFFFFFFgF', 'FFFFFgFFFFggFF', 'FFgggFFFFFggFF',
  'FFgggFFFFFFFFF', 'FFFgFFFFgggFFF', 'FFFFFFFggggggg', 'FFFFFFFgggFFFg', 'FFgggFFFgFFFFg',
  'FFgggFFFFFFFgg', 'FFFFFFFFFFFFgg', 'FFFFFFggFFFggg', 'FFFFFggg~~Fggg', 'FFFFFggg~~gggg',
  'FFgggFFFggggFg', 'FgggggFFFggggg', 'FFgggFFFFFgggg', 'FFFFFFFFggggFF', 'FFgggFFFggggFF',
  'FggHgggggggggg', 'FgggggyyyggFFF', 'FgggggyyyggFFF', 'FFgggyyyyggFFF', 'FFFFggggggFFFF',
  '###FFFFFFFF###', '##############',
];
const LAKE_ROWS = [
  '~~~~~~^', 'b~~~~b^', 'b~~~~~^', 'b~~~~~^', 'bb~~~~^', 'Fb~~~b^', 'Fb~~~b^', 'Fb~~~b^',
  'Fbb~~b^', 'FFb~bb^', 'FFbbbg^', 'gggggg^', 'gggggg^', 'gggggg^',
  'TTTTTT^', 'TTTTTT^', 'TTTTTT^', 'TTTTTT^', 'TTTTTT^', 'TTTTTT^', 'TTTTTTg', 'TTTTTTg', 'TTTTTTg',
  'TTTTTT^', 'TTTTTT^', 'gggggg^', 'gggggg^', 'gggggg^', 'gggggg^', 'gggggg^', 'FFgggF^', '######^',
];
const MOUNT_ROWS = [
  '^^^^^AAAA^^^', '^^^^AAAAAA^^', '^^^AAAAAAA^^', '^^^AAS2SAA^^', '^^^ASSSSSA^^', '^^^ASSSSSS^^',
  '^^^SSSSSSS^^', '^^^SSSSSSS^^', '^^^^SSSSSSm^', '^^^^SSSS^^mm', '^^^^^SS^^^^m', '^^^^^K^^^^^m',
  '^^^^mh^^^^^^', '^^^^mm^^^^^^', '^^^mm^^^^^^^', '^^^mm^^^^^^^', '^^mm^^^^^^^^', '^^mm^^m^^^^^',
  '^^mmmmm^^^^^', '^^mm^mm^^^^^', '^^mm^^^^^^^^', 'Gmmm^^^^^^^^',
  '^^^^^^^^^^^^', '^^^^^^^^^^^^', '^^^^^^^^^^^^', '^^^^^^^^^^^^', '^^^^^^^^^^^^',
  '^^^^^^^^^^^^', '^^^^^^^^^^^^', '^^^^^^^^^^^^', '^^^^^^^^^^^^', '^^^^^^^^^^^^',
];
const MOON_ROWS = [
  '######', 'nnnnn#', 'nnnnnn', 'nnnnnn', 'nnn3nn', 'nnnnnn', 'n#nnnn', 'nnnnnn', 'nnnn#n', 'nnnnnn',
  'nnnnnn', 'nnnnnn', 'nnnnnn', 'nnnnnn', 'nn##nn', 'nn##nn', 'nnnnnn', 'nnnnnn', 'nnnnnn', 'nnnnnn',
  'n#nnnn', 'nnnnnn', 'nnnnnn', 'nnnnnn', 'nnnnnn', 'nnnn#n', 'nnnnnn', 'nnnnnn', 'nnnnnn', 'nnnnnn',
  'nnnnnn', '######',
];
function valleyW(y) {
  if (y === 0 || y === 31) return '^^^';
  if (y === 5 || y === 6) return 'vv^';
  if (y === 22 || y === 23) return '^vv';
  if (y === 12) return 'vcv';
  return 'vvv';
}
const COARSE = [];
for (let y = 0; y < 32; y++) {
  const row = '#' + FOREST_ROWS[y] + LAKE_ROWS[y] + MOUNT_ROWS[y] + valleyW(y) +
    (y === 16 ? 'BB' : 'CC') + (y === 0 || y === 31 ? '##' : 'vv') + MOON_ROWS[y] + '#';
  if (row.length !== 48) throw new Error('大地図の行の長さがちがう: ' + y + ' ' + row.length);
  COARSE.push(row);
}
const CW = 48, CH = 32, CELL = 4;
const OW = CW * CELL, OH = CH * CELL;   /* 192 x 128 タイル */

/* 位置をずらさない (形をくずさない) 文字。山道や町はかっちりさせる。 */
const HARD = new Set(['#', 'T', '^', 'm', 'G', 'h', 'K', 'S', 'A', '2', 'C', 'B']);
const BULGE = new Set(['^', 'A', '#', 'C']);
const CHAR_TILE = {
  '#': T.DENSE, F: T.FOREST, g: T.MEADOW, y: T.FIELD, H: T.MEADOW, 1: T.MEADOW, '~': T.WATER, b: T.SAND,
  T: T.TOWN, '^': T.CLIFF, m: T.ROCKY, G: T.ROCKY, h: T.ROCKY, K: T.SNOW, S: T.SNOW, A: T.SNOWCLIFF,
  2: T.SNOW, v: T.VALLEY, c: T.VALLEY, C: T.CHASM, B: T.CHASM, n: T.MOON, 3: T.MOON,
};

const REGION_KEYS = Object.keys(REGIONS);
function coarseRegion(cx, cy) {
  const c = COARSE[cy][cx];
  if ('^mGh'.includes(c)) return 'mountain';
  if ('SAK2'.includes(c)) return 'snow';
  if (cx >= 41) return 'moon';
  if (cx >= 34) return 'valley';
  if (cx >= 15) {
    if (c === 'T') return 'town';
    if (cy <= 11) return 'lake';
    return 'outskirt';
  }
  return cy < 15 ? 'deepwood' : 'forest';
}

/* ------------------------------ 地図の入れもの ------------------------------ */
function makeMap(id, kind, w, h) {
  return {
    id, kind, w, h,
    tiles: new Uint8Array(w * h),
    solid: new Uint8Array(w * h),
    nodes: new Map(),     /* タイル番号 -> 素材ノード */
    structs: [],
    ver: 1,
    region: null,
  };
}

const World = {
  over: null,
  cur: null,
  noise: null,
  warps: [],
  rests: {},

  /* =============================== 大地図 =============================== */
  buildOverworld(flags) {
    const m = makeMap('over', 'over', OW, OH);
    const n1 = makeNoise(7), n2 = makeNoise(13);
    this.noise = makeNoise(21);
    const at = (cx, cy) => COARSE[clamp(cy, 0, CH - 1)][clamp(cx, 0, CW - 1)];
    for (let ty = 0; ty < OH; ty++) {
      for (let tx = 0; tx < OW; tx++) {
        const c0 = at(Math.floor(tx / CELL), Math.floor(ty / CELL));
        let c = c0;
        if (!HARD.has(c0)) {
          const wx = tx + (fbm(n1, tx * 0.11, ty * 0.11) - 0.5) * 16;
          const wy = ty + (fbm(n2, tx * 0.11, ty * 0.11) - 0.5) * 16;
          const cw = at(Math.floor(wx / CELL), Math.floor(wy / CELL));
          if (!HARD.has(cw) || BULGE.has(cw)) c = cw;
        }
        let tt = CHAR_TILE[c];
        /* 山頂のあたりの岩山は雪をかぶる */
        if (tt === T.CLIFF && ty < 11 * CELL && tx >= 22 * CELL && tx < 34 * CELL) tt = T.SNOWCLIFF;
        m.tiles[ty * OW + tx] = tt;
      }
    }
    m.region = new Uint8Array(CW * CH);
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
      m.region[cy * CW + cx] = REGION_KEYS.indexOf(coarseRegion(cx, cy));
    }
    this.over = m;

    const reserved = new Uint8Array(OW * OH);
    this.carveRoads(m, reserved);
    this.buildTown(m, reserved);
    this.placeStructures(m, reserved, flags);
    this.placeNodes(m, reserved);
    this.applyFlags(m, flags);
    this.rebuildSolid(m);
    return m;
  },

  setTile(m, tx, ty, t) { if (tx >= 0 && ty >= 0 && tx < m.w && ty < m.h) m.tiles[ty * m.w + tx] = t; },
  tileAt(m, tx, ty) { return tx < 0 || ty < 0 || tx >= m.w || ty >= m.h ? T.CLIFF : m.tiles[ty * m.w + tx]; },
  baseChar(tx, ty) { return COARSE[clamp(Math.floor(ty / CELL), 0, CH - 1)][clamp(Math.floor(tx / CELL), 0, CW - 1)]; },

  /* ------------------------------- 道 ------------------------------- */
  carveRoads(m, reserved) {
    const ROADS = [
      [[18, 102], [30, 100], [40, 90], [48, 86], [60, 85]],            /* 家 → 町 */
      [[40, 90], [38, 72], [30, 52], [24, 34], [22, 19]],              /* 分かれ道 → 森の塔 */
      [[84, 85], [99, 85], [99, 66], [104, 58], [106, 52], [109, 48], [109, 44], [110, 40], [113, 30], [114, 19]],
      [[113, 30], [122, 32], [130, 36], [134, 41], [138, 42], [141, 52], [146, 65], [147, 66]],
      [[156, 66], [166, 50], [174, 32], [178, 20]],
      [[71, 56], [70, 48]],                                            /* 町 → 湖 */
    ];
    for (const line of ROADS) {
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, ay] = line[i], [bx, by] = line[i + 1];
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
        for (let s = 0; s <= steps; s++) {
          const x = lerp(ax, bx, s / steps), y = lerp(ay, by, s / steps);
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            this.carveTile(m, reserved, Math.round(x + ox), Math.round(y + oy));
          }
        }
      }
    }
  },
  carveTile(m, reserved, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return;
    const c = this.baseChar(tx, ty);
    if (c === '^' || c === 'A' || c === 'C' || c === 'B' || c === '#' || c === '~') return;
    const i = ty * m.w + tx;
    reserved[i] = 1;
    const t = m.tiles[i];
    if (c === 'm' || c === 'G' || c === 'h') m.tiles[i] = T.ROCKY;
    else if (c === 'S' || c === 'K' || c === '2') m.tiles[i] = T.SNOW;
    else if (c === 'T') { if (t !== T.COBBLE) m.tiles[i] = T.COBBLE; }
    else m.tiles[i] = T.PATH;
  },

  /* ------------------------------- 町 ------------------------------- */
  buildTown(m, reserved) {
    const fill = (x0, y0, x1, y1, t) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { this.setTile(m, x, y, t); reserved[y * m.w + x] = 1; }
    };
    fill(60, 56, 83, 99, T.TOWN);
    fill(60, 84, 87, 86, T.COBBLE);        /* 東西の大通り */
    fill(70, 56, 72, 99, T.COBBLE);        /* 南北の大通り */
    fill(61, 64, 81, 65, T.COBBLE);
    fill(61, 71, 81, 72, T.COBBLE);
    fill(61, 93, 81, 94, T.COBBLE);
    for (let y = 72; y <= 84; y++) for (let x = 64; x <= 78; x++) {
      if (Math.hypot(x - 71, (y - 78) * 1.1) < 6.2) { this.setTile(m, x, y, T.COBBLE); }
    }
  },

  /* ----------------------------- 建物など ----------------------------- */
  addStruct(m, reserved, s) {
    s.w = s.w || 1; s.h = s.h || 1;
    if (s.solid === undefined) s.solid = true;
    m.structs.push(s);
    for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) {
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      const i = y * m.w + x;
      reserved[i] = 1;
      const t = m.tiles[i];
      if (tileSolid(t) && this.baseChar(x, y) !== '^' && this.baseChar(x, y) !== 'A' && this.baseChar(x, y) !== 'C') {
        m.tiles[i] = this.groundFor(x, y);
      }
    }
    return s;
  },
  groundFor(tx, ty) {
    const t = CHAR_TILE[this.baseChar(tx, ty)];
    if (!tileSolid(t)) return t;
    const reg = coarseRegion(clamp(Math.floor(tx / CELL), 0, CW - 1), clamp(Math.floor(ty / CELL), 0, CH - 1));
    return { forest: T.FOREST, deepwood: T.FOREST, town: T.TOWN, mountain: T.ROCKY, snow: T.SNOW, valley: T.VALLEY, moon: T.MOON }[reg] || T.MEADOW;
  },
  door(s) { return { x: s.x + Math.floor(s.w / 2), y: s.y + s.h }; },

  placeStructures(m, reserved, flags) {
    const S = (o) => this.addStruct(m, reserved, o);
    this.warps = [];
    this.rests = {};

    /* 家 */
    S({ kind: 'home', x: 16, y: 98, w: 4, h: 3, act: 'rest', rest: 'home', label: 'ハム太の家' });
    this.rests.home = { x: 18, y: 102, name: 'ハム太の家' };

    /* 町の建物 */
    S({ kind: 'shop', shop: 'general', x: 61, y: 60, w: 6, h: 4, act: 'shop', roof: '#d9734a', sign: '🛒', label: 'よろず屋' });
    S({ kind: 'shop', shop: 'weapon', x: 75, y: 60, w: 6, h: 4, act: 'shop', roof: '#6a7a8c', sign: '⚔️', label: '武器屋' });
    S({ kind: 'shop', shop: 'clothes', x: 61, y: 67, w: 6, h: 4, act: 'shop', roof: '#e889b0', sign: '👕', label: '洋服屋' });
    S({ kind: 'magic', shop: 'magic', x: 75, y: 66, w: 6, h: 5, act: 'shop', roof: '#6a4ac8', sign: '🔮', label: '魔法屋' });
    S({ kind: 'shop', x: 61, y: 89, w: 7, h: 4, act: 'rest', rest: 'inn', roof: '#4a8ac8', sign: '🛏️', label: '宿屋' });
    this.rests.inn = { x: 64, y: 93, name: '宿屋' };
    S({ kind: 'shop', x: 75, y: 89, w: 6, h: 4, roof: '#8a5a3a', sign: '🏠', label: '長老の家', act: 'elderHouse' });
    S({ kind: 'house', x: 61, y: 95, w: 5, h: 3, roof: '#e0a040', label: 'パン屋' });
    S({ kind: 'house', x: 75, y: 95, w: 5, h: 3, roof: '#7aa04a', label: '大工の家' });
    S({ kind: 'fountain', x: 70, y: 77, w: 3, h: 3 });
    S({ kind: 'arch', x: 59, y: 82, w: 1, h: 1, label: 'ほおぶくろタウン' });
    S({ kind: 'arch', x: 59, y: 88, w: 1, h: 1 });
    for (const [x, y] of [[62, 75], [80, 75], [62, 81], [80, 81], [68, 58], [74, 58], [68, 89], [74, 89]]) S({ kind: 'lamp', x, y });
    for (const [x, y] of [[82, 58], [60, 58], [82, 97], [60, 99], [67, 97], [82, 66], [82, 90]]) S({ kind: 'tree', x, y });
    for (const [x, y, w] of [[63, 74, 3], [76, 74, 3], [63, 82, 3], [76, 82, 3]]) S({ kind: 'flowerbed', x, y, w, h: 1 });
    S({ kind: 'board', x: 68, y: 74, label: 'けいじばん' });

    /* 看板 */
    S({ kind: 'sign', x: 15, y: 102, act: 'sign', sign: 'home' });
    S({ kind: 'sign', x: 42, y: 88, act: 'sign', sign: 'forestCross' });
    S({ kind: 'sign', x: 57, y: 83, act: 'sign', sign: 'townWest' });
    S({ kind: 'sign', x: 86, y: 82, act: 'sign', sign: 'mtGate' });
    S({ kind: 'sign', x: 145, y: 62, act: 'sign', sign: 'bridgeSite' });
    S({ kind: 'sign', x: 175, y: 22, act: 'sign', sign: 'moonGate' });
    S({ kind: 'sign', x: 67, y: 50, act: 'sign', sign: 'lakeSign' });
    S({ kind: 'sign', x: 136, y: 45, act: 'sign', sign: 'valleySign' });

    /* 塔 */
    S({ kind: 'tower', tower: 'forest', x: 20, y: 15, w: 4, h: 3, act: 'tower', label: '森の塔' });
    S({ kind: 'tower', tower: 'wind', x: 112, y: 15, w: 4, h: 3, act: 'tower', label: '風の塔' });
    S({ kind: 'tower', tower: 'moon', x: 176, y: 16, w: 4, h: 3, act: 'tower', label: '月の塔' });

    /* 山小屋とガイド */
    S({ kind: 'hut', x: 104, y: 48, w: 3, h: 2, act: 'rest', rest: 'hut', shop: 'hut', label: '山小屋' });
    this.rests.hut = { x: 105, y: 51, name: '山小屋' };
    S({ kind: 'fence', id: 'guide', x: 108, y: 45, w: 4, h: 1 });

    /* 谷のキャンプ / 向こう岸のたき火 */
    S({ kind: 'tent', x: 141, y: 46, w: 3, h: 2, act: 'rest', rest: 'camp', shop: 'camp', label: '谷のキャンプ' });
    this.rests.camp = { x: 142, y: 49, name: '谷のキャンプ' };
    S({ kind: 'campfire', x: 160, y: 63, act: 'rest', rest: 'east', label: 'たき火' });
    this.rests.east = { x: 160, y: 65, name: '向こう岸のたき火' };
    S({ kind: 'stakes', x: 146, y: 64, w: 1, h: 3, solid: false, act: 'bridge' });

    /* 道しるべ (ワープ) */
    const W = (id, x, y, name) => { S({ kind: 'warp', id, x, y, act: 'warp', label: name }); this.warps.push({ id, x, y, name }); };
    W('home', 21, 101, 'ハム太の家');
    W('town', 68, 79, 'ほおぶくろタウン');
    W('forestTower', 25, 21, '森の塔');
    W('hut', 110, 53, '山小屋');
    W('windTower', 110, 22, '風の塔');
    W('camp', 145, 50, '谷のキャンプ');
    W('east', 162, 66, '月の野原');
    W('moonTower', 172, 23, '月の塔の前');

    /* 宝箱 */
    const C = (id, x, y) => S({ kind: 'chest', id, x, y, act: 'chest' });
    C('forestNE', 52, 22); C('forestSW', 8, 60); C('lakeIsle', 82, 46); C('mtPocket', 112, 74);
    C('snowPeak', 124, 24); C('valleyS', 140, 112); C('valleyN', 141, 8); C('moonSE', 184, 116);
  },

  /* --------------------------- 素材ノード --------------------------- */
  placeNodes(m, reserved) {
    const table = {
      [T.FOREST]: [['tree', 0.22], ['bush', 0.06], ['sunflower', 0.006], ['mushroom', 0.004]],
      [T.MEADOW]: [['tree', 0.035], ['bush', 0.05], ['sunflower', 0.025]],
      [T.FIELD]: [['sunflower', 0.5], ['bush', 0.05]],
      [T.SAND]: [['rock', 0.025]],
      [T.ROCKY]: [['rock', 0.07], ['iron', 0.06], ['pine', 0.04], ['bush', 0.01]],
      [T.SNOW]: [['snowpine', 0.07], ['rock', 0.02], ['snowflower', 0.03], ['crystal', 0.008], ['iron', 0.01]],
      [T.VALLEY]: [['mushroom', 0.035], ['crystal', 0.018], ['rock', 0.025], ['deadtree', 0.025], ['bush', 0.04], ['iron', 0.008]],
      [T.MOON]: [['moonrock', 0.018], ['deadtree', 0.035], ['bush', 0.03], ['crystal', 0.01]],
    };
    for (let ty = 1; ty < m.h - 1; ty++) {
      for (let tx = 1; tx < m.w - 1; tx++) {
        const i = ty * m.w + tx;
        if (reserved[i]) continue;
        const list = table[m.tiles[i]];
        if (!list) continue;
        let r = hash2(tx, ty, 99);
        for (const [type, p] of list) {
          if (r < p) { this.addNode(m, tx, ty, type); break; }
          r -= p;
        }
      }
    }
    /* 家のまわりに、最初の木と草むらをかならず置く */
    for (const [x, y, t] of [[22, 97, 'tree'], [24, 99, 'tree'], [13, 96, 'tree'], [23, 104, 'bush'], [14, 104, 'bush'], [25, 103, 'bush'], [12, 100, 'bush']]) {
      if (!m.nodes.has(y * m.w + x)) { m.tiles[y * m.w + x] = T.MEADOW; this.addNode(m, x, y, t); }
    }
    /* 山道の入口のいばら */
    for (let y = 84; y <= 87; y++) for (const x of [89, 90]) this.addNode(m, x, y, 'thorns');
  },
  addNode(m, tx, ty, type) {
    const d = NODE_DEFS[type];
    const node = { type, tx, ty, hp: d.hp, dead: false, timer: 0, v: Math.floor(hash2(tx, ty, 5) * 4), shake: 0 };
    m.nodes.set(ty * m.w + tx, node);
    return node;
  },

  /* セーブに残っている「もう終わったこと」を地図に反映する */
  applyFlags(m, flags) {
    if (flags.thorns) for (const n of m.nodes.values()) if (n.type === 'thorns') m.nodes.delete(n.ty * m.w + n.tx);
    if (flags.guide) m.structs = m.structs.filter((s) => s.id !== 'guide' || s.kind !== 'fence');
    if (flags.bridge) this.layBridge(m);
  },
  layBridge(m) {
    for (let y = 65; y <= 67; y++) for (let x = 146; x <= 157; x++) {
      if (m.tiles[y * m.w + x] === T.CHASM || x >= 148 && x <= 155) m.tiles[y * m.w + x] = T.BRIDGE;
    }
    m.ver++;
  },

  /* ------------------------------ 当たり判定 ------------------------------ */
  rebuildSolid(m) {
    for (let i = 0; i < m.tiles.length; i++) m.solid[i] = tileSolid(m.tiles[i]);
    for (const s of m.structs) {
      if (!s.solid) continue;
      for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) {
        if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.solid[y * m.w + x] = 1;
      }
    }
    for (const n of m.nodes.values()) {
      if (NODE_DEFS[n.type].tileSolid && !n.dead) m.solid[n.ty * m.w + n.tx] = 1;
    }
  },
  solidAt(m, tx, ty) { return tx < 0 || ty < 0 || tx >= m.w || ty >= m.h ? 1 : m.solid[ty * m.w + tx]; },
  nodeAt(m, tx, ty) { return m.nodes.get(ty * m.w + tx) || null; },

  /* 四角い体 (半径 r) を動かす。壁にそって すべる。 */
  move(m, e, dx, dy, r, fly) {
    const lim = fly ? (m.kind === 'tower' ? 1 : 0) : 2;
    if (dx) { e.x += dx; this.resolve(m, e, r, true, dx, lim); }
    if (dy) { e.y += dy; this.resolve(m, e, r, false, dy, lim); }
    if (!fly) this.resolveNodes(m, e, r);
    e.x = clamp(e.x, r + 2, m.w * TILE - r - 2);
    e.y = clamp(e.y, r + 2, m.h * TILE - r - 2);
  },
  resolve(m, e, r, isX, d, lim) {
    const x0 = Math.floor((e.x - r) / TILE), x1 = Math.floor((e.x + r - 0.01) / TILE);
    const y0 = Math.floor((e.y - r) / TILE), y1 = Math.floor((e.y + r - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const s = this.solidAt(m, tx, ty);
      if (!s || s > lim) continue;
      if (isX) e.x = d > 0 ? tx * TILE - r : (tx + 1) * TILE + r;
      else e.y = d > 0 ? ty * TILE - r : (ty + 1) * TILE + r;
      return;
    }
  },
  resolveNodes(m, e, r) {
    const cx = Math.floor(e.x / TILE), cy = Math.floor(e.y / TILE);
    for (let ty = cy - 1; ty <= cy + 1; ty++) for (let tx = cx - 1; tx <= cx + 1; tx++) {
      const n = m.nodes.get(ty * m.w + tx);
      if (!n || n.dead) continue;
      const sr = NODE_DEFS[n.type].solid;
      if (!sr) continue;
      const nx = tx * TILE + 16, ny = ty * TILE + 22;
      const dx = e.x - nx, dy = e.y - ny, d = Math.hypot(dx, dy), min = sr + r * 0.8;
      if (d < min) {
        const k = d > 0.01 ? (min - d) / d : 0;
        e.x += d > 0.01 ? dx * k : 0; e.y += d > 0.01 ? dy * k : min;
      }
    }
  },
  /* 弾が止まるか */
  blocksShot(m, x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (this.solidAt(m, tx, ty) === 1) return true;
    const n = m.nodes.get(ty * m.w + tx);
    if (n && !n.dead && NODE_DEFS[n.type].solid) return dist(x, y, tx * TILE + 16, ty * TILE + 22) < NODE_DEFS[n.type].solid + 2;
    return false;
  },
  walkable(m, x, y, r = 8) {
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
    const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (this.solidAt(m, tx, ty)) return false;
      const n = m.nodes.get(ty * m.w + tx);
      if (n && !n.dead && NODE_DEFS[n.type].solid) return false;
    }
    return true;
  },

  regionAt(m, x, y) {
    if (m.kind !== 'over') return null;
    const cx = clamp(Math.floor(x / TILE / CELL), 0, CW - 1), cy = clamp(Math.floor(y / TILE / CELL), 0, CH - 1);
    return REGION_KEYS[m.region[cy * CW + cx]];
  },

  /* ================================ 塔 ================================ */
  buildTowerFloor(tid, floor, flags) {
    const def = TOWERS[tid];
    const boss = floor === def.floors;
    const W = 24, H = 18;
    let seed = 0;
    for (const ch of tid) seed = seed * 31 + ch.charCodeAt(0);
    for (let attempt = 0; attempt < 40; attempt++) {
      const rng = new RNG(seed * 97 + floor * 1013 + attempt * 7);
      const m = makeMap(tid + ':' + floor, 'tower', W, H);
      m.tower = tid; m.floor = floor; m.boss = boss;
      m.tiles.fill(T.WALL);
      for (let y = 3; y < H - 1; y++) for (let x = 1; x < W - 1; x++) m.tiles[y * W + x] = T.FLOOR;
      const entry = { x: 12, y: H - 2 };
      let up = null;
      if (boss) {
        for (const [x, y] of [[5, 6], [18, 6], [5, 13], [18, 13]]) m.tiles[y * W + x] = T.WALL;
      } else {
        up = { x: rng.i(3, W - 5), y: 3 };
        const nBlocks = rng.i(5, 8);
        for (let b = 0; b < nBlocks; b++) {
          const bw = rng.i(1, 3), bh = rng.i(1, 2);
          const bx = rng.i(2, W - 3 - bw), by = rng.i(5, H - 5 - bh);
          if (Math.abs(bx - entry.x) < 4 && by + bh > H - 6) continue;
          for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) m.tiles[y * W + x] = T.WALL;
        }
        for (let y = up.y; y <= up.y + 1; y++) for (let x = up.x - 1; x <= up.x + 1; x++) m.tiles[y * W + x] = T.FLOOR;
      }
      /* 入口からとどかない床は壁にする。上り階段にとどかなければ作り直し。 */
      const seen = this.flood(m, entry.x, entry.y - 1);
      if (up && !seen[up.y * W + up.x]) continue;
      for (let i = 0; i < m.tiles.length; i++) if (m.tiles[i] === T.FLOOR && !seen[i]) m.tiles[i] = T.WALL;

      m.structs.push({ kind: 'stairsDown', x: entry.x, y: entry.y, w: 1, h: 1, solid: false, act: 'down' });
      m.tiles[entry.y * W + entry.x] = T.FLOOR;
      if (up) m.structs.push({ kind: 'stairsUp', x: up.x, y: up.y - 1, w: 1, h: 1, solid: false, act: 'up' });
      for (let x = 3; x < W - 2; x += 5) m.structs.push({ kind: 'torch', x, y: 2, w: 1, h: 1, solid: false });
      const chest = def.chests[floor];
      if (chest) {
        const cid = tid + '-' + floor;
        const spots = [];
        for (let y = 4; y < H - 4; y++) for (let x = 2; x < W - 2; x++) {
          if (m.tiles[y * W + x] === T.FLOOR && m.tiles[(y - 1) * W + x] === T.WALL && seen[y * W + x] && Math.abs(x - entry.x) > 3) spots.push([x, y]);
        }
        const sp = spots.length ? spots[rng.i(0, spots.length - 1)] : [3, 4];
        m.structs.push({ kind: 'chest', id: cid, x: sp[0], y: sp[1], w: 1, h: 1, solid: true, act: 'chest' });
      }
      m.entry = entry;
      m.up = up;
      this.rebuildSolid(m);
      return m;
    }
    throw new Error('塔の階をつくれなかった: ' + tid + floor);
  },

  flood(m, sx, sy) {
    const seen = new Uint8Array(m.w * m.h);
    const st = [[sx, sy]];
    while (st.length) {
      const [x, y] = st.pop();
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      const i = y * m.w + x;
      if (seen[i] || tileSolid(m.tiles[i])) continue;
      seen[i] = 1;
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return seen;
  },

  /* 歩いて行ける所をしらべる (確認用)。木や岩はこわせるので通れるとみなす。 */
  reach(m, sx, sy) {
    const seen = new Uint8Array(m.w * m.h);
    const st = [[sx, sy]];
    while (st.length) {
      const [x, y] = st.pop();
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      const i = y * m.w + x;
      if (seen[i] || m.solid[i]) continue;
      seen[i] = 1;
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return seen;
  },
};
