// Downtown City MegaKit の部品を読み込み、街じゅうに置いた部品を
// マテリアルごとの BatchedMesh にまとめて描く。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// 元のマテリアル名 → 見た目の調整。
// glTF 版は色ちがいの変種 (Pale/Dark/Green) が同じテクスチャを共有しているので、ここで色を作り分ける。
//   sat: 彩度 (1 = そのまま)、gain: 明るさ、tint: 掛ける色
const GRADE = {
  RedBrick: { sat: 1, gain: 1 },
  RedBrick_Pale: { sat: 0.25, gain: 1.9, tint: 0xf1e6d2 },
  InteriorWall: { sat: 0.3, gain: 1.4 },
  Trim: { sat: 1, gain: 1.05 },
  Trim_Dark: { sat: 0.2, gain: 0.32 },
  Trim_Green: { sat: 0.5, gain: 0.55, tint: 0x4f7a5c },
  Trim_MetalConcrete: { sat: 1, gain: 1 },
};
// 建物ごとに色を振るマテリアル (色を指定しなかった部品は白 = テクスチャのまま)
const TINTABLE = new Set(['RedBrick', 'RedBrick_Pale', 'Trim_MetalConcrete']);

export class Kit {
  constructor() {
    this.pieces = {}; // 部品名 → { parts: [{ geo, mat }], box }
    this.buckets = new Map(); // マテリアル名 → { material, geos: Map, list: [] }
    this.meshes = [];
    this.uniforms = { uNight: { value: 0 }, uTime: { value: 0 } };
  }

  async load(url, onProgress) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url, (e) => onProgress && e.total && onProgress(e.loaded / e.total));
    gltf.scene.updateMatrixWorld(true);
    const srcMats = new Map();
    for (const root of gltf.scene.children) {
      const parts = [];
      const box = new THREE.Box3();
      root.traverse((o) => {
        if (!o.isMesh) return;
        const geo = cleanGeometry(o.geometry, o.matrixWorld);
        geo.computeBoundingBox();
        box.union(geo.boundingBox);
        const name = o.material.name.replace(/^MI_/, '');
        srcMats.set(name, o.material);
        parts.push({ geo, mat: name });
      });
      this.pieces[root.name] = { parts, box };
    }
    this.srcMats = srcMats;
    this.makeMaterials();
  }

  makeMaterials() {
    const src = this.srcMats;
    this.materials = {};
    for (const [name, m] of src) {
      let mat;
      if (name.startsWith('FakeInterior')) continue;
      if (name === 'Glass') {
        mat = new THREE.MeshPhysicalMaterial({
          color: 0x0c1014, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.42,
          depthWrite: false, envMapIntensity: 3, specularIntensity: 1, ior: 1.5,
        });
      } else if (name === 'StreetDecals') {
        mat = new THREE.MeshStandardMaterial({
          map: m.map, transparent: true, roughness: 0.75, depthWrite: false,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        });
      } else {
        mat = new THREE.MeshStandardMaterial({
          map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, metalnessMap: m.metalnessMap,
          roughness: 1, metalness: m.metalnessMap ? 1 : 0, side: THREE.FrontSide,
        });
        if (mat.normalMap) mat.normalScale.set(1, 1);
        const g = GRADE[name];
        if (g) gradeMaterial(mat, g);
      }
      mat.name = name;
      this.materials[name] = mat;
    }
    this.materials.FakeInterior = makeInteriorMaterial(src, this.uniforms);
  }

  // 部品を 1 つ置く。opt.tints: マテリアル名 → 掛ける色 (建物ごとのばらつき)、opt.room: 窓の中の部屋 [種類 0-2, 明かり 0-1]
  place(name, matrix, opt = {}) {
    const p = this.pieces[name];
    if (!p) throw new Error('部品がない: ' + name);
    for (const part of p.parts) {
      let mat = part.mat;
      let color = null;
      if (mat.startsWith('FakeInterior')) {
        const fixed = { FakeInterior_1: 0, FakeInterior_3: 0, FakeInterior_2: 1, FakeInterior_4: 2 }[mat];
        const room = opt.room || randomRoom(opt.rng || Math.random, fixed, opt.lit);
        color = new THREE.Color(room[0] / 2, room[1], room[2] ?? Math.random());
        mat = 'FakeInterior';
      } else if (opt.tints && opt.tints[mat]) {
        color = opt.tints[mat];
      }
      let b = this.buckets.get(mat);
      if (!b) this.buckets.set(mat, (b = { geos: new Map(), list: [] }));
      b.geos.set(part.geo, null);
      const g = this.group;
      if (g) { const r = g.ranges[mat]; if (r) r[1] = b.list.length + 1; else g.ranges[mat] = [b.list.length, b.list.length + 1]; }
      b.list.push({ geo: part.geo, m: matrix.clone(), color });
    }
  }

  // まとまり (1 棟など) を記録して、あとで遠近で出し入れできるようにする
  beginGroup(g) { g.ranges = {}; this.group = g; this.imp?.beginGroup(g); }
  endGroup() { this.group = null; this.imp?.endGroup(); }
  setGroupVisible(g, v) {
    for (const [name, [s, e]] of Object.entries(g.ranges)) {
      const mesh = this.meshByName[name];
      for (let i = s; i < e; i++) mesh.setVisibleAt(i, v);
    }
  }

  // 置いた部品を BatchedMesh にする
  build(scene) {
    for (const [name, b] of this.buckets) {
      const material = this.materials[name];
      let vtx = 0, idx = 0;
      for (const g of b.geos.keys()) { vtx += g.attributes.position.count; idx += g.index.count; }
      const mesh = new THREE.BatchedMesh(b.list.length, vtx, idx, material);
      mesh.name = name;
      for (const g of b.geos.keys()) b.geos.set(g, mesh.addGeometry(g));
      const white = new THREE.Color(1, 1, 1);
      for (const it of b.list) {
        const id = mesh.addInstance(b.geos.get(it.geo));
        mesh.setMatrixAt(id, it.m);
        if (it.color || name === 'FakeInterior' || TINTABLE.has(name)) mesh.setColorAt(id, it.color || white);
      }
      mesh.sortObjects = false;
      const flat = name === 'StreetDecals' || name === 'Asphalt' || name === 'Glass' || name === 'FakeInterior';
      mesh.castShadow = !flat;
      mesh.receiveShadow = name !== 'FakeInterior' && name !== 'Glass';
      if (name === 'StreetDecals') mesh.renderOrder = 1;
      if (name === 'Glass') mesh.renderOrder = 2;
      scene.add(mesh);
      this.meshes.push(mesh);
      (this.meshByName ||= {})[name] = mesh;
    }
    const n = [...this.buckets.values()].reduce((s, b) => s + b.list.length, 0);
    this.buckets.clear();
    return n;
  }
}

function randomRoom(rng, fixed, litP = 0.55) {
  const kind = fixed ?? (rng() < 0.45 ? 0 : rng() < 0.6 ? 1 : 2);
  const lit = rng() < litP ? 0.55 + rng() * 0.45 : rng() * 0.12;
  return [kind, lit, rng()];
}

// 量子化された頂点を Float32 に戻し、位置・法線・UV だけの形にそろえる (BatchedMesh は属性の形が全部同じでないといけない)
function cleanGeometry(src, matrix) {
  const g = new THREE.BufferGeometry();
  for (const [name, n] of [['position', 3], ['normal', 3], ['uv', 2]]) {
    let a = src.attributes[name];
    if (!a && name === 'normal') { src = src.clone(); src.computeVertexNormals(); a = src.attributes.normal; }
    if (!a) a = new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * n), n);
    const arr = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) {
      arr[i * n] = a.getX(i); arr[i * n + 1] = a.getY(i);
      if (n === 3) arr[i * n + 2] = a.getZ(i);
    }
    g.setAttribute(name, new THREE.BufferAttribute(arr, n));
  }
  const ix = src.index;
  const ia = new Uint32Array(ix.count);
  for (let i = 0; i < ix.count; i++) ia[i] = ix.getX(i);
  g.setIndex(new THREE.BufferAttribute(ia, 1));
  g.applyMatrix4(matrix);
  g.computeBoundingSphere();
  return g;
}

// テクスチャの色を彩度・明るさ・色味で作り変える
function gradeMaterial(mat, g) {
  const tint = new THREE.Color(g.tint ?? 0xffffff);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSat = { value: g.sat };
    sh.uniforms.uGain = { value: g.gain };
    sh.uniforms.uTint = { value: tint };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform float uSat; uniform float uGain; uniform vec3 uTint;\nvoid main() {')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, uSat) * uGain * uTint;`);
  };
  mat.customProgramCacheKey = () => `grade${g.sat}_${g.gain}_${g.tint}`;
}

// 窓の奥の部屋。平らな板に部屋の絵を、見る角度に合わせて奥行きがあるように描く (interior mapping)。
// 部屋の絵は「奥の壁が絵の中央 FAR の大きさで写った 1 点透視」なので、箱の中を光線で追って絵の座標に戻す。
// バッチの色: r = 部屋の種類 (0, .5, 1)、g = 明かり、b = 乱数
function makeInteriorMaterial(src, uniforms) {
  const rooms = ['FakeInterior_1', 'FakeInterior_2', 'FakeInterior_4'].map((n) => src.get(n)?.map?.image);
  const W = 512;
  const cv = document.createElement('canvas');
  cv.width = W * 3; cv.height = W;
  const cx = cv.getContext('2d');
  rooms.forEach((img, i) => img && cx.drawImage(img, i * W, 0, W, W));
  const atlas = new THREE.CanvasTexture(cv);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.flipY = false; // glTF の UV は上が v=0
  atlas.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: atlas });
  mat.name = 'FakeInterior';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = uniforms.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'varying vec3 vIWorld; varying vec3 vINormal;\nvoid main() {')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 ip = vec4(transformed, 1.0);
        vec3 inr = normal;
        #ifdef USE_BATCHING
          ip = batchingMatrix * ip; inr = mat3(batchingMatrix) * inr;
        #endif
        vIWorld = (modelMatrix * ip).xyz;
        vINormal = normalize(mat3(modelMatrix) * inr);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'varying vec3 vIWorld; varying vec3 vINormal; uniform float uNight;\nvoid main() {')
      .replace('#include <map_fragment>', `
        vec3 N = normalize(vINormal);
        vec3 q0 = dFdx(vIWorld), q1 = dFdy(vIWorld);
        vec2 s0 = dFdx(vMapUv), s1 = dFdy(vMapUv);
        vec3 q1p = cross(q1, N), q0p = cross(N, q0);
        vec3 T = q1p * s0.x + q0p * s1.x;
        vec3 B = q1p * s0.y + q0p * s1.y;
        float sc = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12));
        T *= sc; B *= sc;
        vec3 vd = vIWorld - cameraPosition;
        vec3 td = vec3(dot(vd, T), dot(vd, B), dot(vd, N));
        const float FAR = 0.5;
        const float DEPTH = 1.0 / (1.0 - FAR) - 1.0;
        vec3 pos = vec3(fract(vMapUv) * 2.0 - 1.0, -1.0);
        td.z *= -DEPTH;
        vec3 id = 1.0 / td;
        vec3 k = abs(id) - pos * id;
        float kMin = min(min(k.x, k.y), k.z);
        pos += kMin * td;
        float interp = pos.z * 0.5 + 0.5;
        float realZ = clamp(interp, 0.0, 1.0) / DEPTH + 1.0;
        interp = (1.0 - 1.0 / realZ) * (DEPTH + 1.0);
        vec2 iuv = pos.xy * mix(1.0, FAR, interp) * 0.5 + 0.5;
        vec3 info = vec3(0.0, 0.6, 0.3);
        #ifdef USE_COLOR_ALPHA
          info = vColor.rgb; // バッチの色は fragment では USE_COLOR_ALPHA (vec4) として届く
        #endif
        float kind = floor(info.r * 2.0 + 0.5);
        vec3 room = texture2D(map, vec2((clamp(iuv.x, 0.002, 0.998) + kind) / 3.0, iuv.y)).rgb;
        float lit = info.g;
        // 昼は外から見ると部屋は暗い。夜は明かりのついた部屋だけ光る
        float day = 1.0 - uNight;
        vec3 warm = mix(vec3(1.0, 0.86, 0.66), vec3(0.85, 0.92, 1.0), step(0.5, info.b));
        vec3 c = room * (day * (0.5 + 0.45 * lit) + uNight * (lit > 0.3 ? 4.0 * lit : 0.04) * warm);
        diffuseColor.rgb = c;`)
      .replace('#include <color_fragment>', '');
  };
  mat.customProgramCacheKey = () => 'interior1';
  return mat;
}
