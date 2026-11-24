// 町・ぼち・くんれんじょう・森を つくる。ぶつかり判定と「E で使えるもの」の 登録も ここ。
import * as THREE from 'three';
import * as A from './assets.js';
import { scene } from './engine.js';

export const CS = 5;          // 街パック (City Builder Bits) は ミニチュアの大きさなので 5 倍にする
const CY = -0.45;             // 道路の上面が 地面と そろう高さ
export const CEM = { x0: 51.5, x1: 87, z0: -18.5, z1: 18.5 };   // ぼちの 内側
export const townRoot = new THREE.Group();
export const hooks = { enter: null, shop: null, sit: null };     // main.js が 中身を入れる

// ---------- ぶつかり判定 ----------
const COL = { town: [], house: [], diner: [] };
const BOUNDS = { town: [-52, 90, -52, 52], house: [-6.4, 6.4, -4.4, 4.9], diner: [-7.4, 7.4, -5.0, 5.4] };
export function setBounds(area, b) { BOUNDS[area] = b; }
export function addBox(area, x, z, hw, hd, tag) { const c = { x, z, hw, hd, tag }; COL[area].push(c); return c; }
export function addCircle(area, x, z, r, tag) { const c = { x, z, r, tag }; COL[area].push(c); return c; }
export function removeCollider(area, c) { const i = COL[area].indexOf(c); if (i >= 0) COL[area].splice(i, 1); }
export function clearColliders(area, tag) { COL[area] = COL[area].filter((c) => c.tag !== tag); }
/** p を 壁や 物から 押し出す (x と z だけ) */
export function resolve(p, rad, area) {
  for (const c of COL[area]) {
    if (c.r !== undefined) {
      const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + rad, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); p.x = c.x + dx / d * rr; p.z = c.z + dz / d * rr; }
    } else {
      const dx = p.x - c.x, dz = p.z - c.z;
      const ox = c.hw + rad - Math.abs(dx), oz = c.hd + rad - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) p.x += Math.sign(dx || 1) * ox;
        else p.z += Math.sign(dz || 1) * oz;
      }
    }
  }
  const b = BOUNDS[area];
  p.x = Math.min(b[1], Math.max(b[0], p.x));
  p.z = Math.min(b[3], Math.max(b[2], p.z));
}
/** 2 点の あいだに かべが あるか (ガイコツの 目線用。箱だけ見る) */
export function blocked(area, ax, az, bx, bz) {
  for (const c of COL[area]) {
    if (c.r !== undefined || c.hw < 1.5) continue;
    for (let t = 0.1; t < 1; t += 0.15) {
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd) return true;
    }
  }
  return false;
}

// ---------- E で使えるもの ----------
export const INTERACT = [];
export function addInteract(o) { INTERACT.push(o); return o; }
export function removeInteract(o) { const i = INTERACT.indexOf(o); if (i >= 0) INTERACT.splice(i, 1); }

// ---------- よるに 光るもの ----------
export const LAMPS = [];
const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false, transparent: true, opacity: 0 });
const bulbGeo = new THREE.SphereGeometry(1, 12, 8);
export function addLamp(area, x, y, z, { color = 0xffb35c, power = 1, bulb = 0.22 } = {}) {
  let mesh = null;
  if (bulb) {
    mesh = new THREE.Mesh(bulbGeo, bulbMat);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(bulb);
    scene.add(mesh);
  }
  const l = { area, x, y, z, color, power, mesh };
  LAMPS.push(l);
  return l;
}
export function setBulbs(k) { bulbMat.opacity = k; }
export function removeLamp(l) { const i = LAMPS.indexOf(l); if (i >= 0) LAMPS.splice(i, 1); if (l.mesh) scene.remove(l.mesh); }

export const SEATS = [];       // ベンチ: {x, z, yaw, area, used}
export const DUMMIES = [];     // かかし: {x, z, obj, wob}
export const WAYPOINTS = [];   // 町の人が 歩く 目的地
export const MAP = [];         // ミニマップ用の 四角 {x, z, w, d, c}
export const LABELS = [];      // 建物の 名前 {text, x, y, z, area}
export const GRAVES = [];      // ガイコツが おきあがる 場所
export const DOORS = {};       // 家・お店の 入口 {x, z}

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function put(name, x, z, { ry = 0, s = 1, y = 0, parent = townRoot } = {}) {
  const o = A.prop(name);
  o.position.set(x, y, z);
  o.rotation.y = ry;
  o.scale.setScalar(s);
  parent.add(o);
  return o;
}
const city = (name, x, z, ry = 0, sxz = CS) => { const o = put(name, x, z, { ry, s: CS, y: CY }); if (sxz !== CS) { o.scale.x = o.scale.z = sxz; } return o; };

function grassTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#7fa653'; g.fillRect(0, 0, 256, 256);
  const r = rng(7);
  for (let i = 0; i < 2600; i++) {
    const v = r();
    g.fillStyle = v < 0.33 ? '#86b05a' : v < 0.66 ? '#75994b' : '#8db862';
    g.fillRect(r() * 256, r() * 256, 2 + r() * 3, 2 + r() * 3);
  }
  for (let i = 0; i < 60; i++) { g.fillStyle = r() < 0.5 ? '#d98a3a' : '#c9b04a'; g.fillRect(r() * 256, r() * 256, 3, 2); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(70, 70);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// 建物 (正面は +z)。footprint は ベース無しの 大きさ (KayKit の元の単位)
const BLD = { building_A: [1.21, 1.45, 0.08], building_B: [1.61, 1.30, 0], building_C: [1.21, 1.30, 0], building_D: [1.61, 1.30, 0], building_E: [2.01, 1.45, 0.08], building_F: [2.01, 1.30, 0], building_G: [2.01, 1.45, 0.08], building_H: [2.01, 1.30, 0] };
function building(name, x, z, ry) {
  city(name, x, z, ry);
  const [w, d, oz] = BLD[name];
  const front = ry === 0 ? 1 : -1;
  addBox('town', x, z + oz * CS * front, w * CS / 2, d * CS / 2);
  MAP.push({ x, z: z + oz * CS * front, w: w * CS, d: d * CS, c: '#c98f63' });
  return { x, z: z + front * ((d / 2 + oz) * CS + 1.2) };
}

export function buildTown() {
  scene.add(townRoot);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  townRoot.add(ground);

  // 大通り (z=0)。真ん中に 横断歩道
  // 道路は 縁石より 路面が ひくいので、たてだけ つぶして 地面の 高さに おく
  for (let x = -40; x <= 40; x += 10) { const r = city(x === 0 ? 'road_straight_crossing' : 'road_straight', x, 0, Math.PI / 2); r.scale.y = 1; r.position.y = 0.0; }
  MAP.push({ x: 0, z: 0, w: 90, d: 10, c: '#6b6f78' });

  // 建物。北側 (z=-10) は 正面が 南、南側 (z=10) は 正面が 北
  const north = { '-30': 'building_C', '-10': 'building_A', '10': 'building_E', '30': 'building_G' };
  const south = { '-30': 'building_D', '-10': 'building_B', '10': 'building_F', '30': 'building_H' };
  for (const [x, n] of Object.entries(north)) DOORS[n] = building(n, +x, -10, 0);
  for (const [x, n] of Object.entries(south)) DOORS[n] = building(n, +x, 10, Math.PI);
  // すき間には 歩道だけ
  for (const x of [-20, 0, 20, -40, 40]) for (const z of [-6.5, 6.5]) { const b = city('base', x, z, 0, CS); b.scale.z = 1.5; b.scale.y = 1; b.position.y = -0.04; }

  const house = DOORS.building_A, diner = DOORS.building_E, shop = DOORS.building_B;
  addInteract({ area: 'town', x: house.x, z: house.z, r: 2.6, label: () => 'いえに はいる', act: () => hooks.enter('house') });
  addInteract({ area: 'town', x: diner.x, z: diner.z, r: 2.6, label: () => 'バーガー屋に はいる', act: () => hooks.enter('diner') });
  addInteract({ area: 'town', x: shop.x, z: shop.z, r: 2.6, label: () => 'ざっかやで かいもの', act: () => hooks.shop() });
  LABELS.push({ text: 'わたしの いえ', x: house.x, y: 6.5, z: house.z - 1.5, area: 'town', icon: 'home' });
  LABELS.push({ text: 'バーガー屋', x: diner.x, y: 6.5, z: diner.z - 1.5, area: 'town', icon: 'food' });
  LABELS.push({ text: 'ざっかや', x: shop.x, y: 6.5, z: shop.z + 1.5, area: 'town', icon: 'shop' });
  MAP.push({ x: house.x, z: -10, w: 6, d: 7, c: '#f2c14e', tag: 'いえ' });
  MAP.push({ x: diner.x, z: -10, w: 10, d: 7, c: '#ef7d57', tag: 'バーガー' });
  MAP.push({ x: shop.x, z: 10, w: 8, d: 7, c: '#5fb3a1', tag: 'ざっかや' });

  // 街灯 (腕が 道路の上に 出る向き)
  for (const x of [-35, -15, 5, 25]) streetlight(x, -5.6, Math.PI / 2);
  for (const x of [-25, -5, 15, 35]) streetlight(x, 5.6, -Math.PI / 2);
  // 歩道の 小物
  const sideProps = [['firehydrant', -22, -6.2], ['trash_A', 18, 6.4], ['dumpster', 23, -6.6], ['box_A', 3, 6.5], ['box_B', 3.8, 6.8], ['trash_B', -3.5, -6.3]];
  for (const [n, x, z] of sideProps) { city(n, x, z, 0); addCircle('town', x, z, 0.6); }
  city('trafficlight_B', -4.6, 5.4, -Math.PI / 2); city('trafficlight_B', 4.6, -5.4, Math.PI / 2);
  // 止まっている車
  for (const [n, x, z, ry] of [['car_sedan', -27, 3, Math.PI / 2], ['car_taxi', 13, -3, -Math.PI / 2], ['car_hatchback', 31, 3, Math.PI / 2], ['car_stationwagon', -14, -3, -Math.PI / 2]]) {
    city(n, x, z, ry);
    addBox('town', x, z, 2.4, 1.1);
  }

  buildPark();
  buildYard();
  buildCemetery();
  buildForest();
}

function streetlight(x, z, ry) {
  city('streetlight', x, z, ry);
  addCircle('town', x, z, 0.35);
  const ax = -Math.cos(ry) * 0.2 * CS, az = Math.sin(ry) * 0.2 * CS;
  addLamp('town', x + ax, 0.92 * CS + CY - 0.15, z + az, { color: 0xffc777, power: 1.4, bulb: 0.28 });
}

function bench(x, z, yaw, name = 'halloween/bench') {
  put(name, x, z, { ry: yaw });
  addBox('town', x, z, Math.abs(Math.cos(yaw)) * 1.0 + Math.abs(Math.sin(yaw)) * 0.35, Math.abs(Math.sin(yaw)) * 1.0 + Math.abs(Math.cos(yaw)) * 0.35);
  for (const off of [-0.5, 0.5]) {
    const seat = { x: x + Math.cos(yaw) * off + Math.sin(yaw) * 0.15, z: z - Math.sin(yaw) * off + Math.cos(yaw) * 0.15, yaw, area: 'town', used: null };
    SEATS.push(seat);
  }
  const it = addInteract({ area: 'town', x: x + Math.sin(yaw) * 1.1, z: z + Math.cos(yaw) * 1.1, r: 1.8, label: () => 'すわる', act: () => hooks.sit(SEATS.find((s) => Math.hypot(s.x - x, s.z - z) < 1 && !s.used)) });
  return it;
}

function buildPark() {
  // 広場: 大通りの 南、まんなか
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(13, 40), new THREE.MeshStandardMaterial({ color: 0xc9b48f, roughness: 1 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.012, 24);
  plaza.receiveShadow = true;
  townRoot.add(plaza);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(4, 9), plaza.material);
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.011, 9.5); path.receiveShadow = true;
  townRoot.add(path);
  MAP.push({ x: 0, z: 24, w: 26, d: 26, c: '#c9b48f', round: true });
  // 給水塔を 広場の 目印にする
  put('watertower', 0, 26, { s: 9 });
  addCircle('town', 0, 26, 2.6);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.5;
    bench(Math.sin(a) * 8.5, 26 + Math.cos(a) * 8.5, a + Math.PI);
  }
  for (const [x, z] of [[-11, 18], [11, 18], [-11, 32], [11, 32]]) {
    put('lantern_standing', x, z, { s: 1.3 });
    addCircle('town', x, z, 0.5);
    addLamp('town', x, 0.85 * 1.3, z, { color: 0xffa040, power: 1.0, bulb: 0 });
  }
  for (const [n, x, z] of [['pumpkin_orange_jackolantern', -4, 13], ['pumpkin_yellow_jackolantern', 4, 13], ['pumpkin_orange', -5.5, 14], ['pumpkin_yellow_small', 5.6, 13.8]]) {
    put(n, x, z, { ry: Math.PI });
    addCircle('town', x, z, 0.7);
    if (n.includes('jacko')) addLamp('town', x, 0.6, z, { color: 0xff8a2a, power: 0.6, bulb: 0 });
  }
  for (let i = 0; i < 6; i++) WAYPOINTS.push({ x: Math.sin(i) * 11, z: 24 + Math.cos(i) * 11 });
  // かぼちゃばたけ
  const pumpkins = [];
  const r = rng(3);
  for (let gx = 0; gx < 5; gx++) for (let gz = 0; gz < 4; gz++) pumpkins.push({ x: 20 + gx * 3 + r() * 0.6, z: 20 + gz * 3.2 + r() * 0.6, ry: r() * 6, s: 0.7 + r() * 0.5 });
  townRoot.add(A.instanced('pumpkin_orange', pumpkins.filter((_, i) => i % 3 !== 0)));
  townRoot.add(A.instanced('pumpkin_yellow', pumpkins.filter((_, i) => i % 3 === 0)));
  const soil = new THREE.Mesh(new THREE.PlaneGeometry(17, 14), new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 1 }));
  soil.rotation.x = -Math.PI / 2; soil.position.set(26, 0.01, 24.8); soil.receiveShadow = true;
  townRoot.add(soil);
  addBox('town', 26, 24.8, 8, 6.5);
  MAP.push({ x: 26, z: 24.8, w: 17, d: 14, c: '#8a5a3a' });
  for (const [x, z] of [[-16, 8], [16, -6.6], [-6, -6.6], [24, 8]]) WAYPOINTS.push({ x, z: z > 0 ? 7 : -7 });
  for (let x = -36; x <= 36; x += 8) { WAYPOINTS.push({ x, z: 7 }); WAYPOINTS.push({ x, z: -7 }); }
}

function buildYard() {
  // くんれんじょう: 北西、建物の うら
  const cx = -24, cz = -28;
  const dirt = [];
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 1; z++) dirt.push({ x: cx + x * 4, z: cz + z * 4 });
  townRoot.add(A.instanced('floor_dirt', dirt));
  MAP.push({ x: cx, z: cz - 2, w: 20, d: 16, c: '#b08a5a', tag: 'くんれん' });
  LABELS.push({ text: 'くんれんじょう', x: cx, y: 4.2, z: cz + 6, area: 'town', icon: 'sword' });
  for (const [x, z] of [[cx - 5, cz - 3], [cx, cz - 4], [cx + 5, cz - 3]]) {
    const o = put('Dummy_Base', x, z);
    DUMMIES.push({ x, z, obj: o, wob: 0, hp: 1 });
    addCircle('town', x, z, 0.7);
  }
  put('target_stand_A_Decorated', cx - 8, cz - 7, { ry: 0.4 }); addCircle('town', cx - 8, cz - 7, 1);
  put('target_stand_A', cx + 8, cz - 7, { ry: -0.4 }); addCircle('town', cx + 8, cz - 7, 0.8);
  put('table_medium_Decorated', cx + 7, cz + 1, { ry: -Math.PI / 2 }); addBox('town', cx + 7, cz + 1, 0.8, 1);
  for (const [n, x, z] of [['Barrel_A', cx - 9, cz + 1], ['Barrel_B', cx - 9, cz + 2.3], ['Barrel_C', cx - 7.8, cz + 1.6], ['Pallet_Small_Decorated_A', cx + 2, cz - 9], ['Box_C', cx - 3, cz - 9]]) {
    put(n, x, z, { ry: x * 0.7 });
    addCircle('town', x, z, n.startsWith('Pallet') ? 1.2 : 0.55);
  }
  // さく (南側は 入口として あけておく)
  for (let i = 0; i < 5; i++) {
    const x = cx - 8 + i * 4;
    put('fence_seperate', x, cz - 11, {}); addBox('town', x, cz - 11, 2, 0.15);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = cz - 9 + i * 4;
    put('fence_seperate', cx + side * 10.2, z, { ry: Math.PI / 2 }); addBox('town', cx + side * 10.2, z, 0.15, 2);
  }
}

function buildCemetery() {
  const { x0, x1, z0, z1 } = CEM;
  const dirt = [];
  for (let x = 52; x <= 86; x += 4) for (let z = -18; z <= 18; z += 4) dirt.push({ x, z, ry: ((x + z) % 3) * Math.PI / 2 });
  townRoot.add(A.instanced('floor_dirt', dirt));
  MAP.push({ x: 69.5, z: 0, w: 37, d: 38, c: '#5d5466', tag: 'ぼち' });
  LABELS.push({ text: 'ぼち (よるは きけん)', x: 50, y: 5.2, z: 0, area: 'town', icon: 'skull' });

  // さく。西側の まんなかに 門
  const fence = [];
  for (let z = -18; z <= 18; z += 4) if (Math.abs(z) > 3) fence.push({ x: 50, z, ry: Math.PI / 2 });
  for (let x = 52; x <= 86; x += 4) { fence.push({ x, z: -20, ry: 0 }); fence.push({ x, z: 20, ry: 0 }); }
  for (let z = -18; z <= 18; z += 4) fence.push({ x: 88, z, ry: Math.PI / 2 });
  townRoot.add(A.instanced('fence', fence));
  townRoot.add(A.instanced('fence_pillar', [{ x: 50, z: -20 }, { x: 50, z: 20 }, { x: 88, z: -20 }, { x: 88, z: 20 }]));
  addBox('town', 50, -11.5, 0.3, 8.5); addBox('town', 50, 11.5, 0.3, 8.5);
  addBox('town', 69, -20, 19, 0.3); addBox('town', 69, 20, 19, 0.3); addBox('town', 88, 0, 0.3, 20);
  put('arch_gate', 50, 0, { ry: Math.PI / 2 });
  addCircle('town', 50, -2.2, 0.5); addCircle('town', 50, 2.2, 0.5);

  // 門までの 道
  const path = [];
  for (let x = 41; x <= 49; x += 1.9) for (const z of [-0.95, 0.95]) path.push({ x, z, ry: Math.floor(x) % 4 * Math.PI / 2 });
  for (let x = 52; x <= 76; x += 1.9) for (const z of [-0.95, 0.95]) path.push({ x, z, ry: Math.floor(x * 3) % 4 * Math.PI / 2 });
  ['path_A', 'path_B', 'path_C'].forEach((n, k) => townRoot.add(A.instanced(n, path.filter((_, i) => i % 3 === k))));

  // おはか。道 (z=0 付近) は あけておく
  const kinds = ['grave_A', 'grave_B', 'gravestone', 'gravemarker_A', 'gravemarker_B', 'grave_A_destroyed'];
  const r = rng(11);
  const byKind = Object.fromEntries(kinds.map((k) => [k, []]));
  for (const gx of [57, 63, 69, 75]) for (const gz of [-15, -10, -5.5, 5.5, 10, 15]) {
    const k = kinds[Math.floor(r() * kinds.length)];
    const x = gx + (r() - 0.5) * 1.2, z = gz + (r() - 0.5) * 0.8;
    byKind[k].push({ x, z, ry: -Math.PI / 2 + (r() - 0.5) * 0.3 });
    addBox('town', x, z, 0.5, k.startsWith('grave_') ? 1.0 : 0.6);
    GRAVES.push({ x: x - 1.8, z });
  }
  for (const k of kinds) townRoot.add(A.instanced(k, byKind[k]));
  // ほら穴の あいた おはか (ガイコツの 出口に 見える)
  for (const [x, z] of [[60, -12.5], [72, 12.5], [66, -8], [78, 8]]) {
    put('floor_dirt_grave', x, z, { y: 0.01 });
    GRAVES.push({ x, z });
  }

  const crypt = put('crypt', 82, 0, { ry: -Math.PI / 2 });
  addBox('town', 82.5, 0, 3.5, 3.2);
  crypt.userData.boss = { x: 77, z: 0 };
  for (const z of [-3.6, 3.6]) for (const x of [56, 66, 76]) {
    put('post_lantern', x, z, { ry: z > 0 ? Math.PI : 0 });
    addCircle('town', x, z, 0.35);
    addLamp('town', x, 2.75, z + (z > 0 ? -1.0 : 1.0), { color: 0x9e7bff, power: 1.1, bulb: 0 });
  }
  for (const [n, x, z, ry] of [['tree_dead_large_decorated', 55, -17, 0.3], ['tree_dead_large', 84, 15, 2], ['tree_dead_medium', 71, -17.5, 1], ['tree_dead_small', 61, 17, 0], ['tree_dead_medium', 85, -9, 2.4], ['tree_dead_large', 53.5, 13, 1.2]]) {
    put(n, x, z, { ry }); addCircle('town', x, z, 0.6);
  }
  for (const [n, x, z, ry] of [['shrine_candles', 75, -16.5, 0], ['skull_candle', 64, 2.6, 0.4], ['candle_triple', 70, -2.8, 0], ['candle_melted', 58, 2.9, 0],
    ['ribcage', 68, 16, 1], ['bone_A', 62, -16.5, 0.4], ['bone_C', 80, -14, 2], ['skull', 85, 11, -1], ['coffin', 84, -15, 0.2], ['pumpkin_orange_jackolantern', 47, -3.3, -Math.PI / 2], ['pumpkin_yellow_jackolantern', 47, 3.3, -Math.PI / 2]]) {
    put(n, x, z, { ry, y: n.startsWith('bone') || n === 'ribcage' ? 0.15 : 0 });
    if (!n.startsWith('bone')) addCircle('town', x, z, 0.6);
    if (n.includes('candle') || n.includes('jacko')) addLamp('town', x, 0.8, z, { color: n.includes('jacko') ? 0xff8a2a : 0xffb060, power: 0.7, bulb: 0 });
  }
}

function buildForest() {
  // 町の まわりの 森。町・広場・ぼち・道の 上には 生やさない
  const r = rng(42);
  const kinds = ['tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_yellow_large', 'tree_pine_yellow_medium', 'tree_pine_orange_small', 'tree_pine_yellow_small'];
  const lists = Object.fromEntries(kinds.map((k) => [k, []]));
  const bushes = [];
  const free = (x, z, pad) => {
    if (x > -45 - pad && x < 45 + pad && z > -17 - pad && z < 17 + pad) return false;   // 町
    if (Math.hypot(x, z - 24) < 15 + pad) return false;                                 // 広場
    if (x > 16 - pad && x < 36 + pad && z > 16 - pad && z < 34 + pad) return false;    // 畑
    if (x > -36 - pad && x < -12 + pad && z > -41 - pad && z < -16 + pad) return false; // くんれんじょう
    if (x > 47 - pad && x < 90 + pad && z > -22 - pad && z < 22 + pad) return false;   // ぼち
    if (x > 38 && x < 52 && Math.abs(z) < 5 + pad) return false;                        // 門への道
    return true;
  };
  let n = 0;
  for (let i = 0; i < 2000 && n < 190; i++) {
    const x = -60 + r() * 160, z = -60 + r() * 120;
    if (!free(x, z, 1)) continue;
    const k = kinds[Math.floor(r() * kinds.length)];
    lists[k].push({ x, z, ry: r() * 6, s: 0.8 + r() * 0.5 });
    if (Math.abs(x) < 95 && Math.abs(z) < 55) addCircle('town', x, z, 0.8);
    n++;
  }
  for (const k of kinds) townRoot.add(A.instanced(k, lists[k]));
  for (let i = 0; i < 600 && bushes.length < 70; i++) {
    const x = -50 + r() * 140, z = -50 + r() * 100;
    if (free(x, z, -0.5) || (Math.abs(z) > 8.5 && Math.abs(z) < 16 && Math.abs(x) < 45 && (Math.abs(x % 20) < 1 || r() < 0.1))) bushes.push({ x, z, ry: r() * 6, s: CS * (0.9 + r() * 0.5) });
  }
  townRoot.add(A.instanced('bush', bushes.map((b) => ({ ...b, y: CY + 0.4 }))));
}
