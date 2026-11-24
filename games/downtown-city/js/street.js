// 歩道と屋上の小物、信号、店の看板と日よけを置く
import * as THREE from 'three';
import { L, avX, stZ, stDir, blockRect, mat, roofTops, shopFronts } from './city.js';
import * as P from './props.js';

const vcMat = (opt = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, ...opt });

// 同じ形をたくさん置く入れ物
class Inst {
  constructor(geo, mat, { shadow = true, color = false } = {}) {
    this.geo = geo; this.mat = mat; this.items = []; this.shadow = shadow; this.useColor = color;
  }
  add(m, c) { this.items.push([m, c]); return this.items.length - 1; }
  build(scene) {
    const mesh = new THREE.InstancedMesh(this.geo, this.mat, Math.max(1, this.items.length));
    mesh.count = this.items.length;
    this.items.forEach(([m, c], i) => { mesh.setMatrixAt(i, m); if (this.useColor) mesh.setColorAt(i, c || new THREE.Color(1, 1, 1)); });
    mesh.castShadow = this.shadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    this.mesh = mesh;
    return mesh;
  }
}
const yaw = (dx, dz) => Math.atan2(-dz, dx); // 形の +x を (dx, dz) に向ける回転

// ------------------------------------------------------------ 信号の状態
// 交差点ごとに 大通り青 26 秒 → 黄 3 → 全赤 2 → 通り青 18 → 黄 3 → 全赤 2 を繰り返す
export const CYCLE = 54;
export function signalState(i, j, t) {
  const off = (i * 11 + j * 5) % CYCLE;
  const s = (t + off) % CYCLE;
  if (s < 26) return { av: 'G', st: 'R' };
  if (s < 29) return { av: 'Y', st: 'R' };
  if (s < 31) return { av: 'R', st: 'R' };
  if (s < 49) return { av: 'R', st: 'G' };
  if (s < 52) return { av: 'R', st: 'Y' };
  return { av: 'R', st: 'R' };
}

export class Street {
  constructor(kit, scene, rng, uniforms) {
    this.kit = kit; this.scene = scene; this.rng = rng; this.uniforms = uniforms;
    this.lampGlows = [];
    this.heads = []; // { i, j, axis, lamps: [r, y, g] (instance ids) }
    this.build();
  }

  build() {
    const r = this.rng, kit = this.kit;
    const trees = [0, 1, 2].map((k) => new Inst(P.treeGeometry(k * 3.1 + 1), vcMat({ roughness: 0.9 })));
    const lamps = new Inst(P.lampGeometry(), vcMat({ metalness: 0.3, roughness: 0.6 }));
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
    const glows = new Inst(P.lampGlowGeometry(), this.glowMat, { shadow: false });
    const hydrants = new Inst(P.hydrantGeometry(), vcMat({ roughness: 0.5 }));
    const trash = new Inst(P.trashGeometry(), vcMat());
    const mail = new Inst(P.mailboxGeometry(), vcMat({ roughness: 0.5 }));
    const towers = new Inst(P.waterTowerGeometry(), vcMat({ roughness: 0.95 }));
    const poleGeos = {};
    const poles = {};
    const heads = new Inst(P.signalHeadGeometry(), vcMat({ roughness: 0.6 }));
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const lampsSig = new Inst(P.signalLampGeometry(), this.lampMat, { shadow: false, color: true });
    // 夜の街灯の光だまり
    this.poolMat = new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
    const pools = new Inst(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), this.poolMat, { shadow: false });

    const busy = []; // 置いた場所 (重ならないように)
    const free = (x, z, d) => busy.every(([bx, bz, bd]) => Math.hypot(bx - x, bz - z) > Math.max(d, bd));
    const mark = (x, z, d) => busy.push([x, z, d]);

    // ---- 信号 (交差点の向こう側の右の角に柱、腕が車線の上に伸びる)
    const AH = L.AV / 2 + 0.6, SH = L.ST / 2 + 0.6;
    for (let i = 0; i < L.NI; i++) for (let j = 0; j < L.NJ; j++) {
      const X = avX(i), Z = stZ(j), d = stDir(j);
      const approaches = [
        // [柱 x, z, 回転, 灯器の腕上の位置(柱から), 軸]
        [X + AH, Z - SH, 0, [AH - 5.1, AH - 1.85], 'av'], // 北行き
        [X - AH, Z + SH, Math.PI, [AH - 5.1, AH - 1.85], 'av'], // 南行き
        d > 0 ? [X + AH, Z + SH, -Math.PI / 2, [SH - 1.875, SH + 1.875], 'st'] : [X - AH, Z - SH, Math.PI / 2, [SH - 1.875, SH + 1.875], 'st'],
      ];
      for (const [px, pz, rot, offs, axis] of approaches) {
        const arm = Math.max(...offs) + 0.6;
        const key = arm.toFixed(1);
        if (!poles[key]) { poleGeos[key] = P.signalPoleGeometry(arm); poles[key] = new Inst(poleGeos[key], vcMat({ metalness: 0.3, roughness: 0.6 })); }
        const base = mat(px, 0, pz).multiply(new THREE.Matrix4().makeRotationY(rot));
        poles[key].add(base);
        mark(px, pz, 1.2);
        for (const o of offs) {
          const hm = base.clone().multiply(P.xf(-o, 6.05, 0));
          heads.add(hm);
          const ids = [0.36, 0, -0.36].map((dy) => lampsSig.add(hm.clone().multiply(P.xf(0, -0.55 + dy, 0))));
          this.heads.push({ i, j, axis, ids });
        }
      }
    }

    // ---- 区画ごと: 街灯・木・消火栓・ごみ箱
    for (let i = -1; i < L.NI; i++) for (let j = -1; j < L.NJ; j++) {
      const b = blockRect(i, j);
      const sides = [
        // 歩道の縁 (車道側) に沿った線: 始点, 向き, 長さ, 車道の方向, 通りか
        { x: b.x0, z: b.z0 - L.SW, dx: 1, dz: 0, len: b.x1 - b.x0, ox: 0, oz: -1, street: j >= 0 },
        { x: b.x0, z: b.z1 + L.SW, dx: 1, dz: 0, len: b.x1 - b.x0, ox: 0, oz: 1, street: j + 1 < L.NJ },
        { x: b.x0 - L.SW, z: b.z0, dx: 0, dz: 1, len: b.z1 - b.z0, ox: -1, oz: 0, street: false, av: i >= 0 },
        { x: b.x1 + L.SW, z: b.z0, dx: 0, dz: 1, len: b.z1 - b.z0, ox: 1, oz: 0, street: false, av: i + 1 < L.NI },
      ];
      for (const s of sides) {
        if (!s.street && !s.av) continue;
        const at = (t, inset) => [s.x + s.dx * t - s.ox * inset, s.z + s.dz * t - s.oz * inset];
        // 街灯: 縁から 0.5 m 内側、腕は車道へ
        const step = s.street ? 28 : 24;
        for (let t = 7; t < s.len - 5; t += step) {
          const [x, z] = at(t, 0.5);
          const m = mat(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(yaw(s.ox, s.oz)));
          lamps.add(m); glows.add(m);
          pools.add(mat(x + s.ox * 2.75, 0.02, z + s.oz * 2.75));
          this.lampGlows.push([x + s.ox * 2.75, z + s.oz * 2.75]);
          mark(x, z, 1.5);
        }
        // 消火栓 (角から 6 m)
        { const [x, z] = at(6 + r() * 4, 0.55); if (free(x, z, 1)) { hydrants.add(mat(x, 0, z, r() * 360)); mark(x, z, 2.5); } }
        // ごみ箱 (角の近く)
        if (r() < 0.7) { const [x, z] = at(s.len - 2.2, 0.6); if (free(x, z, 1)) { trash.add(mat(x, 0, z)); mark(x, z, 1); } }
        if (r() < 0.2) { const [x, z] = at(s.len / 2 + 3, 0.6); if (free(x, z, 1)) { mail.add(mat(x, 0, z, yaw(s.ox, s.oz) * 57.3)); mark(x, z, 1); } }
        // 木 (通りは多め、大通りは少なめ)
        const tstep = s.street ? 8 : 12;
        if (!s.street && r() < 0.5) continue;
        for (let t = 6; t < s.len - 5; t += tstep + Math.floor(r() * 3)) {
          const [x, z] = at(t, 1.1);
          if (!free(x, z, 2.2)) continue;
          kit.place('Sidewalk_Planter', mat(x, 0, z, s.dx ? 0 : 90));
          const k = Math.floor(r() * 3), sc = 0.85 + r() * 0.35;
          trees[k].add(mat(x, 0.3, z, r() * 360, sc, sc, sc));
          mark(x, z, 2.2);
        }
      }
    }

    // ---- 屋上の給水塔
    for (const rt of roofTops) {
      if (rt.top < 16 || rt.W < 10 || rt.rng > 0.35) continue;
      const x = 3 + (rt.rng * 13 % 1) * (rt.W - 6), z = -rt.D + 4;
      towers.add(rt.M.clone().multiply(mat(x, rt.top, z, rt.rng * 900)));
    }

    // ---- 看板と日よけ
    this.buildSigns(shopFronts);

    for (const it of [...trees, lamps, glows, hydrants, trash, mail, towers, heads, lampsSig, pools, ...Object.values(poles)]) it.build(this.scene);
    pools.mesh.renderOrder = 3;
    this.lampsSig = lampsSig.mesh;
    this.sigState = new Map();
  }

  buildSigns(fronts) {
    const NAMES = ['DELI & GROCERY', 'PIZZA', 'PHARMACY', 'CAFE', 'BAGELS', 'LAUNDROMAT', 'HARDWARE', 'NAIL SPA', 'BOOKS', 'DINER',
      'FLOWERS', 'BAKERY', 'WINE & LIQUORS', 'SHOE REPAIR', 'OPTICIAN', 'BARBER', 'THAI KITCHEN', 'SUSHI', 'TACOS', 'SAVINGS BANK',
      'DRY CLEANERS', 'TOYS', 'RECORDS', 'FITNESS', 'HOTEL', 'BURGERS', 'NOODLE HOUSE', 'ICE CREAM', 'COFFEE ROASTERS', 'FRESH MARKET',
      'ART SUPPLY', 'TAILOR'];
    const COLS = [['#7a1f1f', '#f5e6c8'], ['#1f3d2b', '#f0e2b0'], ['#14213d', '#fca311'], ['#111111', '#f2f2f2'], ['#5b2a86', '#ffe9f3'],
      ['#b8860b', '#1a1a1a'], ['#0b5563', '#f0f0f0'], ['#8c2d19', '#ffd166'], ['#2b2d42', '#edf2f4'], ['#f2efe6', '#7a1f1f']];
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 1024;
    const g = cv.getContext('2d');
    const CW = 512, CH = 64;
    NAMES.forEach((name, k) => {
      const x = (k % 2) * CW, y = Math.floor(k / 2) * CH;
      const [bg, fg] = COLS[k % COLS.length];
      g.fillStyle = bg; g.fillRect(x, y, CW, CH);
      g.strokeStyle = fg; g.globalAlpha = 0.5; g.lineWidth = 2; g.strokeRect(x + 5, y + 5, CW - 10, CH - 10); g.globalAlpha = 1;
      g.fillStyle = fg;
      g.font = `bold ${k % 3 === 0 ? 38 : 34}px ${k % 4 === 1 ? 'Georgia, serif' : 'Helvetica, Arial, sans-serif'}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(name, x + CW / 2, y + CH / 2 + 2, CW - 40);
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(1, 1);
    const n = fronts.length * 2; // 長い壁は 2 軒に分けるので最大 2 倍
    const uvOff = new Float32Array(n * 2);
    this.signMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6 });
    this.signMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('void main() {', 'attribute vec2 aOff;\nvoid main() {')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = (uv + aOff) * vec2(0.5, 1.0 / 16.0); vEmissiveMapUv = vMapUv;');
    };
    const signs = new THREE.InstancedMesh(geo, this.signMat, n);
    const awnGeo = new THREE.BoxGeometry(1, 0.05, 1.1).translate(0, 0, 0.55);
    const awnings = new THREE.InstancedMesh(awnGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), n);
    const AWN = [0x7a1f1f, 0x1f3d2b, 0x14213d, 0x222222, 0x8c2d19, 0x0b5563, 0x5b2a86, 0xb07a1a];
    let ns = 0, na = 0;
    const flip = new THREE.Matrix4();
    for (const f of fronts) {
      // 長い壁は 2 軒に分ける
      const shops = f.len >= 20 ? [[0, f.len / 2], [f.len / 2, f.len]] : [[0, f.len]];
      shops.forEach(([a, b], k) => {
        const w = b - a - 0.8, cx = (a + b) / 2;
        const id = Math.floor(((f.rng * 97 + k * 31) % 1) * NAMES.length);
        // 看板 (1 階の上の帯)
        const m = f.m.clone().multiply(P.xf(cx, 3.5, 0.07, 0, 0, 0, Math.min(w, 9), 0.78, 1));
        signs.setMatrixAt(ns, m);
        uvOff[ns * 2] = id % 2; uvOff[ns * 2 + 1] = 15 - Math.floor(id / 2);
        ns++;
        // 日よけ
        if ((f.rng * 7 + k) % 1 < 0.45) {
          const am = f.m.clone().multiply(P.xf(cx, 2.95, 0.02, 0.38, 0, 0, w, 1, 1));
          awnings.setMatrixAt(na, am);
          awnings.setColorAt(na, new THREE.Color(AWN[id % AWN.length]));
          na++;
        }
      });
    }
    signs.count = ns; awnings.count = na;
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(uvOff, 2));
    signs.receiveShadow = true; awnings.castShadow = true; awnings.receiveShadow = true;
    signs.frustumCulled = false; awnings.frustumCulled = false;
    this.scene.add(signs, awnings);
  }

  // 夜はカメラに近い街灯にだけ本物の光を置く (全部に置くと重い)
  updateLights(cam, night) {
    if (!this.lights) {
      this.lights = [];
      for (let k = 0; k < 8; k++) {
        const l = new THREE.PointLight(0xffc98a, 0, 22, 1.6);
        l.position.set(0, -100, 0);
        this.scene.add(l);
        this.lights.push(l);
      }
      this.lightAt = new THREE.Vector3(1e9, 0, 0);
    }
    // 昼は光を消しておく (数が変わるとシェーダーを作り直すので、切り替えは夕方と朝の 1 回だけ)
    const on = night > 0.05;
    if (on !== this.lightsOn) { this.lightsOn = on; for (const l of this.lights) l.visible = on; }
    if (!on) return;
    if (cam.distanceTo(this.lightAt) > 8) {
      this.lightAt.copy(cam);
      const near = this.lampGlows.map(([x, z]) => [x, z, (x - cam.x) ** 2 + (z - cam.z) ** 2]).sort((a, b) => a[2] - b[2]).slice(0, this.lights.length);
      near.forEach(([x, z], k) => this.lights[k].position.set(x, 7.6, z));
    }
    for (const l of this.lights) l.intensity = night * 140;
  }

  update(t, night) {
    // 信号の色 (変わったときだけ書き換える)
    const on = { R: new THREE.Color(4, 0.25, 0.12), Y: new THREE.Color(4, 2.2, 0.1), G: new THREE.Color(0.2, 3.2, 1.6) };
    const off = new THREE.Color(0.06, 0.06, 0.06);
    let changed = false;
    for (const h of this.heads) {
      const st = signalState(h.i, h.j, t)[h.axis];
      if (h.cur === st) continue;
      h.cur = st;
      changed = true;
      this.lampsSig.setColorAt(h.ids[0], st === 'R' ? on.R : off);
      this.lampsSig.setColorAt(h.ids[1], st === 'Y' ? on.Y : off);
      this.lampsSig.setColorAt(h.ids[2], st === 'G' ? on.G : off);
    }
    if (changed) this.lampsSig.instanceColor.needsUpdate = true;
    // 夜の明かり
    this.glowMat.color.setRGB(0.35 + night * 3.5, 0.33 + night * 2.8, 0.3 + night * 1.8);
    this.poolMat.opacity = night * 0.35;
    this.signMat.emissiveIntensity = night * 0.9;
  }
}

function radialTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
