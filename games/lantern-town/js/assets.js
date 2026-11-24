// 3D 素材の読みこみと複製。
// 素材は tools/lantern-town-assets.sh が KayKit から作った GLB。パックごとに 1 ファイルで、
// 中の各モデルは元のファイル名のノードになっている。
import * as THREE from 'three';
import { GLTFLoader } from '../lib/three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../lib/three/addons/utils/SkeletonUtils.js';

const PACKS = ['city', 'halloween', 'furniture', 'restaurant', 'prototype', 'skeleton-weapons'];
export const HEROES = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded'];
const SKELETONS = ['Skeleton_Minion', 'Skeleton_Warrior', 'Skeleton_Rogue', 'Skeleton_Mage'];

const props = new Map();
const bodies = new Map();
export const clips = new Map();

// 同じ名前のモデルが別のパックにもある (bench など)。'city/bench' のように
// パック名つきでも引けるようにし、名前だけのときは先に登録したほうを返す。
function register(pack, obj) {
  props.set(pack + '/' + obj.name, obj);
  if (!props.has(obj.name)) props.set(obj.name, obj);
}

function prepare(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const m = o.material;
    if (m.map) m.map.anisotropy = 4;
    m.roughness = Math.max(m.roughness ?? 1, 0.55);
    m.metalness = Math.min(m.metalness ?? 0, 0.2);
  });
}

export async function loadAll(onProgress) {
  const loader = new GLTFLoader();
  const files = [...PACKS, ...HEROES, ...SKELETONS, 'anims', 'anims-skeleton'];
  let done = 0;
  await Promise.all(files.map(async (f) => {
    const g = await loader.loadAsync(`assets/${f}.glb`);
    prepare(g.scene);
    if (PACKS.includes(f)) for (const c of [...g.scene.children]) register(f, c);
    else if (!f.startsWith('anims')) bodies.set(f, g.scene);
    for (const a of g.animations) clips.set(a.name, a);
    onProgress?.(++done / files.length);
  }));
}

export function has(name) { return props.has(name); }

/** 小物を 1 つ複製する。形と色は元と共有するので軽い。 */
export function prop(name) {
  const t = props.get(name);
  if (!t) throw new Error('素材がない: ' + name);
  const o = t.clone();
  o.position.set(0, 0, 0);
  o.rotation.set(0, 0, 0);
  o.scale.set(1, 1, 1);
  return o;
}

/** キャラクターの体を複製する (骨ごと)。 */
export function body(name) {
  const o = cloneSkinned(bodies.get(name));
  o.traverse((m) => { if (m.isMesh) m.frustumCulled = false; });
  return o;
}

const tmpM = new THREE.Matrix4();
/**
 * 同じ小物をたくさん置くときは 1 回の描画命令で済む InstancedMesh にする。
 * list は {x, y, z, ry, s} の配列。s は大きさ (数値)。
 */
export function instanced(name, list) {
  const t = props.get(name);
  const group = new THREE.Group();
  if (!list.length) return group;
  t.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const placements = list.map((p) => new THREE.Matrix4().compose(
    new THREE.Vector3(p.x, p.y || 0, p.z), q.setFromAxisAngle(up, p.ry || 0).clone(), new THREE.Vector3().setScalar(p.s || 1)));
  t.traverse((m) => {
    if (!m.isMesh) return;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
    placements.forEach((P, i) => im.setMatrixAt(i, tmpM.multiplyMatrices(P, rel)));
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  });
  return group;
}
