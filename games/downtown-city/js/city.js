// 街の配置。マンハッタンのような碁盤の目で、南北 (z) に走る大通り (Avenue) と
// 東西 (x) に走る一方通行の通り (Street) が交わる。1 m = 1 単位、北が -z。
import * as THREE from 'three';

export const L = {
  AV: 18, // 大通りの車道の幅 (片側 2 車線 + 路肩)
  ST: 12, // 通りの車道の幅 (一方通行 2 車線 + 両側の駐車帯)
  SW: 3, // 歩道の幅
  BX: 60, // 区画の東西の長さ
  BZ: 36, // 区画の南北の長さ (奥行き 18 m の建物が背中合わせに 2 列)
  NI: 6, // 大通りの本数
  NJ: 7, // 通りの本数
};
L.PX = L.BX + 2 * L.SW + L.AV;
L.PZ = L.BZ + 2 * L.SW + L.ST;
export const avX = (i) => (i - (L.NI - 1) / 2) * L.PX;
export const stZ = (j) => (j - (L.NJ - 1) / 2) * L.PZ;
export const stDir = (j) => (j % 2 === 0 ? 1 : -1); // 通りの向き (+1 = 東行き)
// 区画 (i, j) は大通り i と i+1、通り j と j+1 の間。i = -1, j = -1 は街の外周
export function blockRect(i, j) {
  return {
    x0: avX(i) + L.AV / 2 + L.SW, x1: avX(i + 1) - L.AV / 2 - L.SW,
    z0: stZ(j) + L.ST / 2 + L.SW, z1: stZ(j + 1) - L.ST / 2 - L.SW,
  };
}
export const BOUNDS = (() => {
  const a = blockRect(-1, -1), b = blockRect(L.NI - 1, L.NJ - 1);
  return { x0: a.x0 - L.SW, x1: b.x1 + L.SW, z0: a.z0 - L.SW, z1: b.z1 + L.SW };
})();

export function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const D2R = Math.PI / 180;
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
export function mat(x, y, z, deg = 0, sx = 1, sy = 1, sz = 1) {
  _q.setFromAxisAngle(_up, deg * D2R);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

// ------------------------------------------------------------------ 道路

export function buildRoads(kit, rng) {
  const P = (n, x, z, deg, sx, sz) => kit.place(n, mat(x, 0, z, deg, sx, 1, sz));
  const { AV, ST, SW } = L;
  const ziv = [], xiv = []; // 区画の並び (道路の区間)
  // 道路は遠景の区画のところまで延ばす
  for (let j = -3; j < L.NJ + 2; j++) { const b = blockRect(0, j); ziv.push([b.z0 - SW, b.z1 + SW]); }
  for (let i = -3; i < L.NI + 2; i++) { const b = blockRect(i, 0); xiv.push([b.x0 - SW, b.x1 + SW]); }

  // 大通り: 区画の横を走る区間 (タイル 3 枚幅)
  for (let i = 0; i < L.NI; i++) {
    const X = avX(i);
    for (const [z0, z1] of ziv) {
      for (let z = z0 + 3; z < z1; z += 6) {
        for (const dx of [-6, 0, 6]) P('Street_Asphalt_6x6', X + dx, z, 0);
        P('Decal_DoubleYellow_Straight', X, z, 90);
        P('Decal_BrokenLine_Straight', X - 3.5, z, 90);
        P('Decal_BrokenLine_Straight', X + 3.5, z, 90);
      }
      // 停止線の手前の矢印
      if (z0 > BOUNDS.z0 + 1) { P('Decal_ArrowStraight', X + 1.85, z0 + 14, 0); P('Decal_ArrowForwardRight', X + 5.1, z0 + 14, 0); }
      if (z1 < BOUNDS.z1 - 1) { P('Decal_ArrowStraight', X - 1.85, z1 - 14, 180); P('Decal_ArrowForwardRight', X - 5.1, z1 - 14, 180); }
    }
  }
  // 通り
  for (let j = 0; j < L.NJ; j++) {
    const Z = stZ(j), d = stDir(j);
    for (const [x0, x1] of xiv) {
      for (let x = x0 + 3; x < x1; x += 6) {
        for (const dz of [-3, 3]) P('Street_Asphalt_6x6', x, Z + dz, 0);
        P('Decal_BrokenLine_Straight', x, Z, 0);
      }
      const end = d > 0 ? x1 : x0;
      if (end > BOUNDS.x0 + 1 && end < BOUNDS.x1 - 1) {
        P('Decal_Only', end - d * 12, Z + 1.875 * d, -90 * d);
        P('Decal_ArrowStraight', end - d * 16, Z - 1.875 * d, -90 * d);
        P('Decal_ArrowStraight', end - d * 16, Z + 1.875 * d, -90 * d);
      }
    }
  }
  // 交差点: アスファルト 4x3 枚、横断歩道 4 本、停止線
  for (let i = 0; i < L.NI; i++) for (let j = 0; j < L.NJ; j++) {
    const X = avX(i), Z = stZ(j);
    for (const dx of [-9, -3, 3, 9]) for (const dz of [-6, 0, 6]) P('Street_Asphalt_6x6', X + dx, Z + dz, 0);
    const cwD = 4.66, cwW = 11.42; // Decal_Crosswalk_Wide の奥行きと幅
    for (const s of [-1, 1]) {
      // 大通りを渡る (半分ずつ 2 枚)
      for (const h of [-1, 1]) P('Decal_Crosswalk_Wide', X + h * AV / 4, Z + s * (ST / 2 + SW / 2), 90, (SW - 0.4) / cwD, AV / 2 / cwW);
      // 通りを渡る
      P('Decal_Crosswalk_Wide', X + s * (AV / 2 + SW / 2), Z, 0, (SW - 0.4) / cwD, ST / cwW);
    }
    stopLines.push({ x: X + AV / 4, z: Z + ST / 2 + SW + 0.6, w: AV / 2, rot: 0 });
    stopLines.push({ x: X - AV / 4, z: Z - ST / 2 - SW - 0.6, w: AV / 2, rot: 0 });
    const d = stDir(j);
    stopLines.push({ x: X - d * (AV / 2 + SW + 0.6), z: Z, w: ST, rot: 90 });
  }
}
export const stopLines = [];

// 区画のまわりの歩道
export function buildSidewalks(kit, b) {
  const P = (n, x, z, deg) => kit.place(n, mat(x, 0, z, deg));
  const h = L.SW / 2;
  for (let x = b.x0 + h; x < b.x1; x += 3) { P('Sidewalk_Straight_3m', x, b.z0 - h, 180); P('Sidewalk_Straight_3m', x, b.z1 + h, 0); }
  for (let z = b.z0 + h; z < b.z1; z += 3) { P('Sidewalk_Straight_3m', b.x0 - h, z, -90); P('Sidewalk_Straight_3m', b.x1 + h, z, 90); }
  P('Sidewalk_Corner_Round_3m', b.x0 - h, b.z0 - h, 0);
  P('Sidewalk_Corner_Round_3m', b.x0 - h, b.z1 + h, 90);
  P('Sidewalk_Corner_Round_3m', b.x1 + h, b.z1 + h, 180);
  P('Sidewalk_Corner_Round_3m', b.x1 + h, b.z0 - h, -90);
}

// ------------------------------------------------------------------ 建物

// 外壁のスタイル。win2 = 幅 2 m の窓、win4 = 幅 4 m の窓、plain = 窓なしの壁
const STYLES = {
  brick: {
    win2: ['Brick_Window_Trim', 'Brick_Window_Trim_Single', 'Brick_Window_Square_Single'],
    win4: ['Brick_RedWhite_DoubleWindow', 'Brick_Window_CurvedDouble'],
    plain: 'Brick_Plain_3', band: 'Metal_Plain_1', cornice: ['Cornice_Brick', 'Cornice_Trim', 'Cornice_Metal'],
    corner: ['Brick_CornerColumn_Bottom', 'Brick_CornerColumn_Center', 'Brick_CornerColumn_Top'], cornerSet: 'cc',
    shop: ['Metal_FirstFloor_Window', 'Trim_FirstFloor_Window_001'], door: [['DoorFrame_Metal_Single', 'Door_2'], ['DoorFrame_Wooden', 'Door_1']],
  },
  pale: {
    win4: ['Brick_Inset_Window', 'Brick_Inset_Window_Curved', 'Brick_Inset_Window_Curved_Small'], oddFill: 'Trim_Plain_3',
    plain: 'Brick_Plain_3', band: 'Metal_FirstFloor_Wall_1', cornice: ['Cornice_Trim', 'Cornice_Metal'],
    corner: ['Brick_CornerColumn_Bottom', 'Brick_CornerColumn_Center', 'Brick_CornerColumn_Top'], cornerSet: 'cc',
    shop: ['Trim_FirstFloor_Window_001', 'Metal_FirstFloor_Window'], door: [['DoorFrame_Trim', 'Door_3'], ['DoorFrame_Metal_Single', 'Door_2']],
  },
  trim: {
    win2: ['Trim_Window'], plain: 'Trim_Plain_3', band: 'Metal_FirstFloor_Wall_1', cornice: ['Cornice_Trim'],
    corner: ['Trim_Column_Bottom', 'Trim_Column_Center', 'Trim_Column_Top'], cornerSet: 'col',
    shop: ['Trim_FirstFloor_Window_001'], door: [['DoorFrame_Trim', 'Door_3']], groundWall: 'Trim_FirstFloor_Wall',
  },
  metal: {
    win2: ['Metal_FullWindow', 'Metal_Window_Half'], win4: ['Metal_Window'], plain: 'Metal_Plain_3', band: 'Metal_Plain_1',
    cornice: ['Cornice_Metal'], corner: ['Metal_Column_Bottom', 'Metal_Column_Center', 'Metal_Column_Top'], cornerSet: 'col',
    pilaster: ['Metal_Column_Small_Bottom', 'Metal_Column_Small_Center', 'Metal_Column_Small_Top'],
    shop: ['Metal_FirstFloor_Window'], door: [['DoorFrame_Metal_Single', 'Door_2']], groundWall: 'Metal_FirstFloor_Wall',
  },
  loft: { // レンガの柱の間に大きな金属の窓 (表紙の絵の角の建物)
    win2: ['Metal_FullWindow'], plain: 'Brick_Plain_3', band: 'Metal_Plain_1', cornice: ['Cornice_Metal'],
    corner: ['Brick_CornerColumn_Bottom', 'Brick_CornerColumn_Center', 'Brick_CornerColumn_Top'], cornerSet: 'cc',
    pilaster: ['Brick_Column_RedBricks', 'Brick_Column_RedBricks', 'Brick_Column_RedBricks'],
    shop: ['Metal_FirstFloor_Window'], door: [['DoorFrame_Metal_Single', 'Door_2']], groundWall: 'Metal_FirstFloor_Wall',
  },
};
// 建物ごとのレンガの色 (テクスチャの色に掛ける)
const BRICK_TINTS = [0xffffff, 0xf2d6c8, 0xd9b8a6, 0xc49a8a, 0xffe2cc, 0xb88878, 0xe8c0a0];
const PALE_TINTS = [0xffffff, 0xf4efe6, 0xe9e2d4, 0xdcd6cc, 0xfff6e6];
const METAL_TINTS = [0xffffff, 0x9aa4a0, 0x7f8c8a, 0xb0a090, 0x6f7f74];

// 既製の建物 (キットに入っている完成品): 区画の幅、前面からの左右の位置、高さ
const PREBUILT = {
  Building_Large_2: { w: 22, ox: 9.32 + 0.68, h: 29 },
  Building_Medium_2_001: { w: 16, ox: 7.53 + 0.47, h: 26 },
  Building_Small_1: { w: 14, ox: 7.23 + 0.77, h: 18 },
};

// 区画を建物で埋める。奥行き 18 m の列が北向きと南向きに背中合わせで並ぶ
export function planBlock(b, rng, center) {
  const lots = [];
  const D = L.BZ / 2;
  for (const facing of [-1, 1]) {
    let x = b.x0;
    const row = [];
    while (x < b.x1 - 0.1) {
      const rest = b.x1 - x;
      let w, pre = null;
      const r = rng();
      if (x > b.x0 && r < 0.14) {
        const ok = Object.keys(PREBUILT).filter((k) => PREBUILT[k].w <= rest - 10 || PREBUILT[k].w === rest);
        if (ok.length) pre = pick(rng, ok);
      }
      if (pre) w = PREBUILT[pre].w;
      else {
        w = Math.min(rest, pick(rng, [10, 12, 12, 14, 16, 16, 18, 20, 24]));
        if (rest - w < 10 && rest - w > 0) w = rest; // 端に細すぎる余りを残さない
      }
      row.push({ x0: x, x1: x + w, pre });
      x += w;
    }
    for (const lot of row) {
      const z0 = facing < 0 ? b.z0 : b.z1 - D;
      lots.push({ ...lot, z0, z1: z0 + D, facing });
    }
  }
  // 高さ: 街の中心ほど高く、ときどき塔が立つ
  for (const lot of lots) {
    const cx = (lot.x0 + lot.x1) / 2 - center.x, cz = (lot.z0 + lot.z1) / 2 - center.z;
    const d = Math.hypot(cx, cz);
    const W = lot.x1 - lot.x0;
    let f = 4 + Math.round(rng() * 4 + 7 * Math.exp(-((d / 200) ** 2)) * rng());
    if (W >= 16 && rng() < 0.03 + 0.1 * Math.exp(-((d / 150) ** 2))) f += 6 + Math.floor(rng() * 10);
    // 細長すぎる塔にしない (高さは幅の 3.5 倍まで)
    f = Math.min(f, Math.floor((W * 3.5 - 5) / 3) + 1);
    lot.floors = f;
    lot.h = lot.pre ? PREBUILT[lot.pre].h : 4 + 3 * (f - 1) + 1;
  }
  return lots;
}

// 1 棟を組み立てる。lot は世界座標の矩形と向き。nb = 隣の高さ { left, right, back } と大通り側か
export function buildBuilding(kit, lot, nb, rng) {
  const W = lot.x1 - lot.x0, D = lot.z1 - lot.z0;
  // 建物の座標系: 正面 (道路側) が z = 0 で +z を向き、x が 0..W、奥が -z
  const deg = lot.facing > 0 ? 0 : 180;
  const ox = lot.facing > 0 ? lot.x0 : lot.x1, oz = lot.facing > 0 ? lot.z1 : lot.z0;
  const M = mat(ox, 0, oz, deg);
  const P = (n, x, y, z, d = 0, sy = 1, opt = o) => {
    const m = M.clone().multiply(mat(x, y, z, d, 1, sy, 1));
    if (!lot.farOnly) kit.place(n, m, opt);
    kit.imp?.add(n, m, opt.tints.RedBrick && n.startsWith('Brick_') && !n.startsWith('Brick_Inset') ? opt.tints.RedBrick : tintFor(n)); // 遠くで代わりに描く板 (壁の部品だけ絵がある)
  };
  const tintFor = (n) => n.startsWith('Brick_Inset') ? tints.RedBrick_Pale : n.startsWith('Brick') ? tints.RedBrick
    : n.startsWith('Metal') ? tints.Trim_MetalConcrete : null;

  let styleName = pick(rng, ['brick', 'brick', 'brick', 'pale', 'trim', 'metal', 'loft']);
  if (styleName === 'pale' && W % 4 !== 0) styleName = 'brick';
  const S = STYLES[styleName];
  const tints = {};
  tints.RedBrick = new THREE.Color(pick(rng, BRICK_TINTS));
  tints.RedBrick_Pale = new THREE.Color(pick(rng, PALE_TINTS));
  if (styleName === 'metal' || styleName === 'loft') tints.Trim_MetalConcrete = new THREE.Color(pick(rng, METAL_TINTS));
  const o = { tints, rng };
  const oShop = { tints, rng, lit: 0.9 }; // 店は夜もたいてい明るい
  // 隣との境の壁は少し暗いレンガ
  const oParty = { tints: { RedBrick: tints.RedBrick.clone().multiplyScalar(0.62 + rng() * 0.2) }, rng };
  const partyWin = rng() < 0.4; // 境の壁にも小さな窓がある建物

  if (lot.pre) {
    const m = M.clone().multiply(mat(PREBUILT[lot.pre].ox + (W - PREBUILT[lot.pre].w) / 2, 0, 0));
    if (!lot.farOnly) kit.place(lot.pre, m, o);
    if (kit.imp) {
      const b = kit.pieces[lot.pre].box, c = b.getCenter(new THREE.Vector3());
      const w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y, e = 0.05;
      const Q = (face, x, y, z, deg, qw, qh, flat) => {
        const q = m.clone().multiply(mat(x, y, z, deg));
        if (flat) q.multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
        kit.imp.addQuad(lot.pre + ':' + face, q, qw, qh, tints.RedBrick);
      };
      Q('front', c.x, b.min.y, b.max.z + e, 0, w, h);
      Q('back', c.x, b.min.y, b.min.z - e, 180, w, h);
      Q('right', b.max.x + e, b.min.y, c.z, 90, d, h);
      Q('left', b.min.x - e, b.min.y, c.z, -90, d, h);
      Q('top', c.x, b.max.y - 0.6, b.max.z, 0, w, d, true);
    }
    return;
  }
  const F = lot.floors;
  const top = 4 + 3 * (F - 1); // 屋根の高さ (1 階 3 m + 帯 1 m + 2 階から上 3 m ずつ)
  const floorY = (f) => (f === 0 ? 0 : 4 + 3 * (f - 1));

  // 窓の並べ方を決める (階ごとに同じ並び)
  const nW = W / 2;
  const win2 = S.win2 ? pick(rng, S.win2) : null;
  const win4 = S.win4 ? pick(rng, S.win4) : null;
  const mode = styleName === 'pale' ? 'w4' : !win2 ? 'w4' : win4 && rng() < 0.35 ? 'w4' : rng() < 0.6 ? 'all' : 'alt';
  function rowPattern(n) {
    // 1 列ぶんの部品 [名前, 幅(モジュール数)] を返す。左右対称になるようにする
    const out = [];
    if (mode === 'w4') {
      const pairs = Math.floor(n / 2), odd = n % 2;
      const half = Math.floor(pairs / 2);
      for (let k = 0; k < half; k++) out.push([win4, 2]);
      if (odd) out.push([win2 || S.oddFill || S.plain, 1]);
      if (pairs % 2) out.push([win4, 2]);
      for (let k = 0; k < half; k++) out.push([win4, 2]);
    } else if (mode === 'alt') {
      // 両端から数えて偶数番目に窓 (6 枠なら 窓 壁 窓 窓 壁 窓)
      for (let k = 0; k < n; k++) out.push([Math.min(k, n - 1 - k) % 2 === 0 ? win2 : S.plain, 1]);
    } else for (let k = 0; k < n; k++) out.push([win2, 1]);
    return out;
  }
  const upper = rowPattern(nW);
  // 1 階: 店のガラス窓と入口
  const ground = [];
  const doorAt = Math.floor(rng() * nW);
  const shop = pick(rng, S.shop), door = pick(rng, S.door);
  for (let k = 0; k < nW; k++) ground.push(k === doorAt ? 'DOOR' : S.groundWall && rng() < 0.15 ? S.groundWall : shop);

  // 壁を 1 面置く。start から dir 方向に len メートル、外向きは deg。fromY より上だけ置く
  function wall(sx, sz, dx, dz, len, wdeg, kind, fromY) {
    const n = len / 2;
    const at = (m, w) => [sx + dx * 2 * (m + w), sz + dz * 2 * (m + w)]; // m 番目のモジュール (2 m) から w モジュールぶん進んだ位置
    for (let f = 0; f < F; f++) {
      const y = floorY(f);
      if (y + (f === 0 ? 4 : 3) <= fromY) continue;
      if (kind === 'front') {
        if (f === 0) {
          ground.forEach((g, m) => {
            const [x, z] = at(m, 0.5);
            if (g === 'DOOR') { P(door[0], x, 0, z, wdeg); P(door[1], x + dx * 0.5, 0, z + dz * 0.5, wdeg); } else P(g, x, 0, z, wdeg, 1, oShop);
          });
        } else {
          let m = 0;
          for (const [name, w] of upper) { const [x, z] = at(m, w / 2); P(name, x, y, z, wdeg); m += w; }
        }
      } else if (kind === 'side') {
        // 大通り側の側面: 1 階は店、上は窓。並びは正面とは別に作る
        if (f === 0) for (let m = 0; m < n; m++) { const [x, z] = at(m, 0.5); P(m === 2 ? S.groundWall || shop : shop, x, 0, z, wdeg, 1, oShop); }
        else {
          const pat = rowPattern(n);
          let m = 0;
          for (const [name, w] of pat) { const [x, z] = at(m, w / 2); P(name, x, y, z, wdeg); m += w; }
        }
      } else {
        // 隣と接する面・裏: 窓のない壁 (ときどき小さな窓)
        for (let m = 0; m < n; m++) {
          const [x, z] = at(m, 0.5);
          if (f === 0) P('Brick_Plain_4', x, 0, z, wdeg, 1, oParty);
          else P(partyWin && f > 1 && m % 3 === 1 && y >= fromY ? 'Brick_Window_Square_Single' : 'Brick_Plain_3', x, y, z, wdeg, 1, oParty);
        }
      }
      // 1 階の上の帯 (高さ 1 m)
      if (f === 0 && (kind === 'front' || kind === 'side')) for (let m = 0; m < n; m++) { const [x, z] = at(m, 0.5); P(S.band, x, 3, z, wdeg); }
    }
    if ((kind === 'front' || kind === 'side') && !lot.farOnly) shopFronts.push({ m: M.clone().multiply(mat(sx, 0, sz, wdeg)), len, rng: rng() });
    // 屋上のふち
    if (kind === 'front' || kind === 'side') {
      const c = corniceSet;
      for (let m = 0; m < n; m++) {
        const [x, z] = at(m, 0.5);
        P(m === 0 ? c + '_L' : m === n - 1 ? c + '_R' : c + '_Center', x, top, z, wdeg);
      }
    } else {
      for (let m = 0; m < n; m++) { const [x, z] = at(m, 0.5); P('Trim_90Angle_TopCover', x, top, z, wdeg); }
    }
  }
  const corniceSet = pick(rng, S.cornice);

  // 正面
  wall(0, 0, 1, 0, W, 0, 'front', 0);
  // 右 (x = W) と左 (x = 0)。大通り側なら窓のある面、隣が低ければその上だけ窓なしの壁
  wall(W, 0, 0, -1, D, 90, nb.rightOpen ? 'side' : 'party', nb.rightOpen ? 0 : nb.right);
  wall(0, -D, 0, 1, D, -90, nb.leftOpen ? 'side' : 'party', nb.leftOpen ? 0 : nb.left);
  // 裏
  wall(W, -D, -1, 0, W, 180, 'party', nb.back);

  // 外に出ている角に柱
  const corners = [[W, 0, 0, true], [0, 0, -90, true], [W, -D, 90, nb.rightOpen], [0, -D, 180, nb.leftOpen]];
  for (const [x, z, d, show] of corners) {
    if (!show) continue;
    for (let f = 0; f < F; f++) {
      const name = S.corner[f === 0 ? 0 : f === F - 1 ? 2 : 1];
      P(name, x, floorY(f), z, d);
      if (f === 0) P(S.corner[1], x, 3, z, d, 1 / 3); // 1 階の上の帯の高さ 1 m のぶん
    }
  }
  // 正面の付け柱 (金属・ロフト)
  if (S.pilaster) {
    const dx = S.pilaster[0] === 'Brick_Column_RedBricks' ? -0.12 : 0;
    for (let m = 1; m < nW; m += mode === 'all' ? 1 : 2) {
      for (let f = 1; f < F; f++) P(S.pilaster[f === F - 1 ? 2 : 1], m * 2 + dx, floorY(f), 0, 0);
    }
  }

  // 屋根
  if (!lot.farOnly) kit.place('Roof_4x4', M.clone().multiply(mat(W / 2, top + 0.18, -D / 2, 0, W / 4, 1, D / 4)));
  kit.imp?.addQuad('roof', M.clone().multiply(mat(W / 2, top + 0.02, 0)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)), W, D);
  // 屋上の階段室と室外機
  if (!lot.farOnly && W >= 10) {
    const bx = 2 + Math.floor(rng() * (W / 2 - 3)) * 2, bz = -4 - Math.floor(rng() * 3) * 2;
    for (const [x, z, d] of [[bx + 1, bz, 0], [bx + 3, bz, 0], [bx + 4, bz - 1, 90], [bx + 4, bz - 3, 90], [bx + 3, bz - 4, 180], [bx + 1, bz - 4, 180], [bx, bz - 3, -90], [bx, bz - 1, -90]]) P('Brick_Plain_3', x, top, z, d, 1, oParty);
    kit.place('Roof_4x4', M.clone().multiply(mat(bx + 2, top + 3.18, bz - 2)));
    for (let k = 0; k < 1 + Math.floor(rng() * 3); k++) P('Prop_ACUnit', 1.5 + rng() * (W - 3), top, -D + 1 + rng() * 6, Math.floor(rng() * 4) * 90);
  }
  roofTops.push({ M, W, D, top, rng: rng(), farOnly: lot.farOnly });
  return top;
}
export const roofTops = [];
export const shopFronts = [];

// 遠くの建物の板に使う絵の一覧
export function impostorViews() {
  const names = new Set(['Brick_Plain_3', 'Brick_Plain_4']);
  for (const S of Object.values(STYLES)) {
    for (const k of ['win2', 'win4', 'shop']) for (const n of S[k] || []) names.add(n);
    for (const k of ['plain', 'band', 'groundWall', 'oddFill']) if (S[k]) names.add(S[k]);
    for (const [frame] of S.door) names.add(frame);
  }
  const views = [...names].map((n) => ({ key: n, piece: n, face: 'front' }));
  views.push({ key: 'roof', piece: 'Roof_4x4', face: 'top', px: 10 });
  for (const pre of Object.keys(PREBUILT)) for (const face of ['front', 'back', 'left', 'right', 'top']) views.push({ key: pre + ':' + face, piece: pre, face, px: 14 });
  return views;
}
