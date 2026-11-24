// わたしの いえ: へやを つくり、セーブデータの とおりに 家具を ならべる。もようがえ (家具を おく・しまう) も ここ。
import * as THREE from 'three';
import * as A from './assets.js';
import { scene } from './engine.js';
import { SV, save } from './state.js';
import { ITEM } from './data.js';
import { addBox, addInteract, removeInteract, clearColliders, addLamp, removeLamp, setBounds, hooks, addBeam, ROOM_LIGHTS } from './world.js';
import { sfx } from './audio.js';

export const HX = 300;           // へやの 中心 (町から 遠く はなれた 場所に つくる)
const ROOM = { x0: -5.9, x1: 5.9, z0: -4.3, z1: 4.4 };
export const houseRoot = new THREE.Group();
const furnRoot = new THREE.Group();
let furnInteracts = [], furnLamps = [];
export const deco = { on: false, pick: null, ghost: null, r: 0, ok: false, x: 0, z: 0 };

function planks() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const cols = ['#b07a4f', '#a86f45', '#b9845a', '#a2693f'];
  for (let i = 0; i < 8; i++) {
    g.fillStyle = cols[i % 4]; g.fillRect(0, i * 32, 256, 32);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, i * 32 + 30, 256, 2);
    const off = (i * 97) % 256; g.fillRect(off, i * 32, 2, 32);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let k = 0; k < 6; k++) g.fillRect((k * 53 + i * 31) % 256, i * 32 + 6 + (k % 3) * 7, 40, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2.5); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildHouse() {
  houseRoot.position.set(HX, 0, 0);
  scene.add(houseRoot);
  houseRoot.add(furnRoot);
  setBounds('house', [HX + ROOM.x0 - 0.4, HX + ROOM.x1 + 0.4, ROOM.z0 - 0.2, ROOM.z1 + 0.6]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(13, 10.5), new THREE.MeshStandardMaterial({ map: planks(), roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.25); floor.receiveShadow = true;
  houseRoot.add(floor);
  const base = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.6, 11), new THREE.MeshStandardMaterial({ color: 0x6d4a33 }));
  base.position.set(0, -0.31, 0.25); houseRoot.add(base);
  const wall = (n, x, z, ry) => { const o = A.prop(n); o.position.set(x, 0, z); o.rotation.y = ry; houseRoot.add(o); };
  wall('wall', -4, -4.75, 0); wall('wall_window_open', 0, -4.75, 0); wall('wall', 4, -4.75, 0);
  wall('wall_window_open', -6.25, -2.75, Math.PI / 2); wall('wall', -6.25, 1.25, Math.PI / 2);
  wall('wall', 6.25, -2.75, -Math.PI / 2); wall('wall_window_open', 6.25, 1.25, -Math.PI / 2);
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x9c3b32, roughness: 1 }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.015, 4.6); houseRoot.add(mat);
  addInteract({ area: 'house', x: HX, z: 4.5, r: 1.6, label: () => (deco.on ? null : 'そとに でる'), act: () => hooks.enter('town') });
  // 窓から さしこむ 日の光
  addBeam(houseRoot, new THREE.Vector3(0, 2.5, -4.5), new THREE.Vector3(0, -1, 1.25), { len: 5.2 });
  addBeam(houseRoot, new THREE.Vector3(-6.0, 2.5, -2.75), new THREE.Vector3(1.3, -1, 0.1), { len: 5.4 });
  const light = new THREE.PointLight(0xffd9a0, 6, 16, 1.6); ROOM_LIGHTS.push(light); light.userData.base = light.intensity;
  light.position.set(0, 3.6, 0.5);
  houseRoot.add(light);
  rebuildFurniture();
}

/** モデルの 床の上の 大きさ (半分) を 回転こみで 返す */
const boxCache = new Map();
function footprint(id, r) {
  if (!boxCache.has(id)) boxCache.set(id, new THREE.Box3().setFromObject(A.prop(id)));
  const b = boxCache.get(id);
  let hw = (b.max.x - b.min.x) / 2, hd = (b.max.z - b.min.z) / 2;
  const cx = (b.max.x + b.min.x) / 2, cz = (b.max.z + b.min.z) / 2;
  if (r % 2) [hw, hd] = [hd, hw];
  // 中心のずれも 回す
  const a = r * Math.PI / 2;
  return { hw, hd, ox: cx * Math.cos(a) + cz * Math.sin(a), oz: -cx * Math.sin(a) + cz * Math.cos(a) };
}

export function rebuildFurniture() {
  furnRoot.clear();
  clearColliders('house', 'furn');
  for (const it of furnInteracts) removeInteract(it);
  for (const l of furnLamps) removeLamp(l);
  furnInteracts = []; furnLamps = [];
  for (const f of SV.house) {
    const def = ITEM[f.id];
    const o = A.prop(f.id);
    o.position.set(f.x, 0, f.z);
    o.rotation.y = f.r * Math.PI / 2;
    furnRoot.add(o);
    const fp = footprint(f.id, f.r);
    if (!def.flat) addBox('house', HX + f.x + fp.ox, f.z + fp.oz, fp.hw - 0.08, fp.hd - 0.08, 'furn');
    if (def.light) furnLamps.push(addLamp('house', HX + f.x, 1.2, f.z, { color: 0xffc070, power: def.light, bulb: 0 }));
    const yaw = f.r * Math.PI / 2;
    if (def.use === 'sit') {
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      furnInteracts.push(addInteract({ area: 'house', x: HX + f.x + fx * 1.0, z: f.z + fz * 1.0, r: 1.5, label: () => (deco.on ? null : 'すわる'),
        act: () => hooks.sit({ x: HX + f.x + fx * 0.05, z: f.z + fz * 0.05, yaw, area: 'house', used: null, y: f.id.startsWith('couch') || f.id.startsWith('arm') ? 0.05 : 0 }) }));
    }
    if (def.use === 'bed') {
      const side = footprint(f.id, 0).hw + 0.7;
      furnInteracts.push(addInteract({ area: 'house', x: HX + f.x + Math.cos(yaw) * side, z: f.z - Math.sin(yaw) * side, r: 2.0,
        label: () => (deco.on ? null : (SV.time >= 18 || SV.time < 6 ? 'ねる (あさまで)' : 'ひるねする')),
        act: () => hooks.sleep({ x: HX + f.x, z: f.z, yaw }) }));
    }
  }
}

// ---------- もようがえ ----------
const ghostMat = new THREE.MeshStandardMaterial({ color: 0x8cff9a, transparent: true, opacity: 0.55, depthWrite: false, emissive: 0x2a6a30 });
export function decoStart() { deco.on = true; deco.pick = null; setGhost(null); }
export function decoEnd() { deco.on = false; setGhost(null); }
export function setGhost(id) {
  if (deco.ghost) { houseRoot.remove(deco.ghost); deco.ghost = null; }
  deco.pick = id;
  if (!id) return;
  const o = A.prop(id);
  o.traverse((m) => { if (m.isMesh) { m.material = ghostMat; m.castShadow = false; } });
  deco.ghost = o;
  houseRoot.add(o);
}
export function decoRotate() { deco.r = (deco.r + 1) % 4; sfx('ui'); }

function overlaps(id, x, z, r, skip = -1) {
  if (ITEM[id].flat) return false;
  const a = footprint(id, r);
  return SV.house.some((f, i) => {
    if (i === skip || ITEM[f.id].flat) return false;
    const b = footprint(f.id, f.r);
    return Math.abs(x + a.ox - (f.x + b.ox)) < a.hw + b.hw - 0.15 && Math.abs(z + a.oz - (f.z + b.oz)) < a.hd + b.hd - 0.15;
  });
}

/** 毎フレーム: プレイヤーの 前に 置く場所を 決める */
export function decoUpdate(player) {
  if (!deco.on || !deco.ghost) return;
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  const fp = footprint(deco.pick, deco.r);
  const reach = Math.max(fp.hw, fp.hd) + 1.0;
  let x = Math.round((player.pos.x - HX + fx * reach) * 2) / 2;
  let z = Math.round((player.pos.z + fz * reach) * 2) / 2;
  x = Math.min(ROOM.x1 - fp.hw - fp.ox, Math.max(ROOM.x0 + fp.hw - fp.ox, x));
  z = Math.min(ROOM.z1 - fp.hd - fp.oz, Math.max(ROOM.z0 + fp.hd - fp.oz, z));
  deco.x = x; deco.z = z;
  deco.ghost.position.set(x, 0.02, z);
  deco.ghost.rotation.y = deco.r * Math.PI / 2;
  const px = player.pos.x - HX, pz = player.pos.z;
  const onPlayer = !ITEM[deco.pick].flat && Math.abs(px - x - fp.ox) < fp.hw + 0.4 && Math.abs(pz - z - fp.oz) < fp.hd + 0.4;
  deco.ok = !overlaps(deco.pick, x, z, deco.r) && !onPlayer;
  ghostMat.color.set(deco.ok ? 0x8cff9a : 0xff7a7a);
  ghostMat.emissive.set(deco.ok ? 0x2a6a30 : 0x6a2020);
}

export function decoPlace() {
  if (!deco.ghost || !deco.ok) { sfx('fail'); return false; }
  const id = deco.pick;
  SV.house.push({ id, x: deco.x, z: deco.z, r: deco.r });
  SV.inv[id]--;
  if (SV.inv[id] <= 0) { delete SV.inv[id]; setGhost(null); }
  SV.stats.placed++;
  sfx('put');
  rebuildFurniture();
  save();
  return true;
}

/** プレイヤーの 前に ある 家具を しまう */
export function decoStore(player) {
  const px = player.pos.x - HX + Math.sin(player.yaw) * 1.2, pz = player.pos.z + Math.cos(player.yaw) * 1.2;
  let best = -1, bd = 2.2;
  SV.house.forEach((f, i) => { const d = Math.hypot(f.x - px, f.z - pz); if (d < bd) { bd = d; best = i; } });
  if (best < 0) { sfx('fail'); return null; }
  if (SV.house.length <= 1 || (ITEM[SV.house[best].id].use === 'bed' && SV.house.filter((f) => ITEM[f.id].use === 'bed').length <= 1)) return 'bed';
  const [f] = SV.house.splice(best, 1);
  SV.inv[f.id] = (SV.inv[f.id] || 0) + 1;
  sfx('pick');
  rebuildFurniture();
  save();
  return f.id;
}
