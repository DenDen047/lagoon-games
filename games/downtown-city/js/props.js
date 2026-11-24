// キットに入っていない街の小物 (木・街灯・信号・消火栓・ごみ箱・給水塔・車・人) の形を作る。
// 色は頂点ごとに持たせ、1 種類 1 回の描画で済むようにする。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function xf(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}
// 形に色をつけて置く
export function part(geo, color, m) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (m) g.applyMatrix4(m);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
export const merge = (parts) => mergeGeometries(parts.filter(Boolean));
const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// ------------------------------------------------------------ 木
function noise3(x, y, z, s) {
  return Math.sin(x * 1.7 + s) * Math.cos(y * 2.3 + s * 2) * 0.5 + Math.sin(z * 2.9 + y + s * 3) * 0.3 + Math.sin((x + z) * 4.1 + s) * 0.2;
}
export function treeGeometry(seed) {
  const r = (k) => (Math.sin(seed * 91.7 + k * 13.3) * 0.5 + 0.5);
  const parts = [];
  const h = 3.4 + r(1) * 1.2;
  const bark = 0x463a30;
  parts.push(part(cyl(0.1, 0.16, h + 0.6, 8), bark));
  for (let k = 0; k < 4; k++) parts.push(part(cyl(0.035, 0.07, 1.7, 5), bark, xf(0, h - 0.2 + k * 0.25, 0, 0.75, k * 1.7 + r(k + 5), 0)));
  // 葉のかたまり: 樹冠 (横 2.3 m・縦 1.9 m の楕円体) の中に小さな球を散らす
  const cy = h + 1.7, n = 13;
  const dark = new THREE.Color(0x26411d), light = new THREE.Color(0x5d7d34), tmp = new THREE.Color();
  for (let k = 0; k < n; k++) {
    const a = k * 2.399 + r(k), t = (k + 0.5) / n;
    const rad = Math.sqrt(t) * 1.55, y = (r(k + 20) - 0.45) * 2.1;
    const R = 0.75 + r(k + 7) * 0.45;
    const cx = Math.cos(a) * rad, cz = Math.sin(a) * rad, yy = cy + y * (1 - rad / 2.6);
    const g = new THREE.IcosahedronGeometry(R, 1);
    g.deleteAttribute('uv');
    const p = g.attributes.position, nm = g.attributes.normal;
    const cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y0 = p.getY(i), z = p.getZ(i);
      const d = 1 + 0.18 * noise3(x * 2, y0 * 2, z * 2, seed + k);
      p.setXYZ(i, cx + x * d, yy + y0 * d * 0.85, cz + z * d);
      nm.setXYZ(i, x / R, y0 / R, z / R); // 球の向きの法線でなめらかに見せる
      // 上と外側ほど明るい
      const lit = 0.35 + (y0 / R) * 0.3 + (yy - cy) * 0.12 + (rad / 1.55) * 0.15 + noise3(x * 5, y0 * 5, z * 5, seed) * 0.15;
      tmp.copy(dark).lerp(light, Math.min(1, Math.max(0, lit)));
      cols.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    parts.push(g);
  }
  return merge(parts);
}

// ------------------------------------------------------------ 街灯 (アームが +x に伸びる)
export function lampGeometry() {
  const c = 0x2c3330;
  return merge([
    part(cyl(0.16, 0.2, 0.5, 10), c),
    part(cyl(0.07, 0.11, 8.4, 10), c),
    part(cyl(0.05, 0.06, 2.6, 8), c, xf(0, 8.2, 0, 0, 0, -Math.PI / 2 + 0.12)),
    part(box(0.95, 0.2, 0.42), c, xf(2.75, 8.42, 0)),
  ]);
}
export function lampGlowGeometry() {
  return box(0.75, 0.05, 0.3).translate(2.75, 8.3, 0);
}

// ------------------------------------------------------------ 信号 (柱から -x 方向に腕が伸び、灯器は +z を向く)
export function signalPoleGeometry(arm) {
  const c = 0x3a3f3a;
  return merge([
    part(cyl(0.18, 0.22, 0.4, 10), c),
    part(cyl(0.11, 0.13, 6.4, 10), c),
    part(cyl(0.07, 0.09, arm, 8), c, xf(0, 6.1, 0, 0, 0, Math.PI / 2)),
  ]);
}
export function signalHeadGeometry() {
  const c = 0x1d201d, y = 0x3a3a20;
  const parts = [part(box(0.38, 1.1, 0.26), c), part(box(0.5, 1.24, 0.04), y, xf(0, 0, -0.14))];
  for (let k = 0; k < 3; k++) parts.push(part(box(0.32, 0.06, 0.18), c, xf(0, 0.38 - k * 0.36 + 0.17, 0.2, -0.4)));
  return merge(parts).translate(0, -0.55, 0);
}
export function signalLampGeometry() {
  return new THREE.CircleGeometry(0.12, 12).translate(0, 0, 0.135);
}

// ------------------------------------------------------------ 消火栓・ごみ箱・郵便ポスト
export function hydrantGeometry() {
  const c = 0xb8241c, cap = 0xd8c040;
  return merge([
    part(cyl(0.16, 0.18, 0.08, 10), c),
    part(cyl(0.13, 0.13, 0.55, 10), c),
    part(new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), cap, xf(0, 0.6, 0)),
    part(cyl(0.06, 0.06, 0.34, 8), c, xf(-0.17, 0.4, 0, 0, 0, -Math.PI / 2)),
    part(cyl(0.05, 0.05, 0.12, 8), cap, xf(0, 0.42, 0.12, Math.PI / 2, 0, 0)),
  ]);
}
export function trashGeometry() {
  return merge([
    part(cyl(0.3, 0.26, 0.9, 12), 0x2f4a33),
    part(cyl(0.32, 0.32, 0.06, 12), 0x223326, xf(0, 0.9, 0)),
  ]);
}
export function mailboxGeometry() {
  const c = 0x24427a;
  return merge([
    part(box(0.5, 0.75, 0.5), c, xf(0, 0.55, 0)),
    part(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 12, 1, false, 0, Math.PI), c, xf(0, 0.92, 0, 0, 0, Math.PI / 2)),
    part(box(0.08, 0.2, 0.08), 0x1a1a1a, xf(0.18, 0.1, 0.18)), part(box(0.08, 0.2, 0.08), 0x1a1a1a, xf(-0.18, 0.1, 0.18)),
    part(box(0.08, 0.2, 0.08), 0x1a1a1a, xf(0.18, 0.1, -0.18)), part(box(0.08, 0.2, 0.08), 0x1a1a1a, xf(-0.18, 0.1, -0.18)),
  ]);
}

// ------------------------------------------------------------ 屋上の給水塔 (ニューヨークの木の樽)
export function waterTowerGeometry() {
  const wood = 0x6b4d36, band = 0x2a2522, steel = 0x3a3d40;
  const parts = [];
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) parts.push(part(box(0.18, 3, 0.18), steel, xf(x, 1.5, z)));
  parts.push(part(box(3, 0.2, 3), steel, xf(0, 3.05, 0)));
  parts.push(part(cyl(1.55, 1.65, 3.6, 16), wood, xf(0, 3.15, 0)));
  for (const y of [3.6, 4.4, 5.2, 6.0]) parts.push(part(cyl(1.62, 1.62, 0.07, 16), band, xf(0, y, 0)));
  parts.push(part(new THREE.ConeGeometry(1.75, 1.2, 16), band, xf(0, 7.35, 0)));
  parts.push(part(cyl(0.12, 0.12, 0.3, 8), band, xf(0, 7.9, 0)));
  return merge(parts);
}

// ------------------------------------------------------------ 車
// 前が +x。paint = 車体 (色は 1 台ずつ)、trim = ガラス・タイヤなど、light = ライト
function extrudeProfile(pts, width, bevel = 0.05) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 2 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  return g;
}
function wheels(xs, r, z, w) {
  const out = [];
  for (const x of xs) for (const s of [-1, 1]) {
    out.push(part(new THREE.CylinderGeometry(r, r, w, 12), 0x161616, xf(x, r, s * z, Math.PI / 2)));
    out.push(part(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 8, 1, true), 0x8a8d90, xf(x, r, s * z, Math.PI / 2)));
  }
  return out;
}
const GLASS = 0x1b2229;
export const CAR_TYPES = {
  sedan: {
    len: 4.6, w: 1.8,
    build() {
      const paint = [part(extrudeProfile([[-2.3, 0.3], [2.3, 0.3], [2.33, 0.62], [2.2, 0.8], [1.85, 0.86], [0.75, 0.94], [-1.55, 0.97], [-2.2, 0.93], [-2.33, 0.66]], 1.8), 0xffffff),
        part(extrudeProfile([[0.02, 1.38], [-0.95, 1.38], [-0.95, 1.42], [0.0, 1.42]], 1.44, 0.02), 0xffffff)];
      const trim = [part(extrudeProfile([[0.8, 0.93], [0.05, 1.39], [-0.98, 1.39], [-1.62, 0.95]], 1.6, 0.04), GLASS),
        part(box(4.5, 0.12, 1.84), 0x26282a, xf(0, 0.36, 0)),
        part(box(0.1, 0.18, 1.6), 0x222222, xf(2.33, 0.42, 0)), part(box(0.1, 0.18, 1.6), 0x222222, xf(-2.33, 0.42, 0)),
        ...wheels([1.42, -1.38], 0.33, 0.78, 0.24)];
      return { paint, trim, ...lights(2.32, -2.32, 0.74, 0.62) };
    },
  },
  taxi: {
    len: 4.7, w: 1.82, color: 0xf2b705,
    build() {
      const b = CAR_TYPES.sedan.build();
      b.trim.push(part(box(0.65, 0.22, 0.28), 0xf4f0e0, xf(-0.4, 1.56, 0)));
      return b;
    },
  },
  suv: {
    len: 4.85, w: 1.95,
    build() {
      const paint = [part(extrudeProfile([[-2.42, 0.42], [2.42, 0.42], [2.44, 0.95], [2.25, 1.12], [1.15, 1.2], [-2.3, 1.22], [-2.44, 1.1]], 1.95), 0xffffff),
        part(box(3.0, 0.06, 1.66), 0xffffff, xf(-0.75, 1.82, 0))];
      const trim = [part(extrudeProfile([[1.2, 1.18], [0.55, 1.8], [-2.25, 1.8], [-2.3, 1.18]], 1.76, 0.03), GLASS),
        part(box(0.12, 0.22, 1.7), 0x222222, xf(2.45, 0.55, 0)), part(box(0.12, 0.22, 1.7), 0x222222, xf(-2.45, 0.55, 0)),
        ...wheels([1.5, -1.5], 0.4, 0.84, 0.28)];
      return { paint, trim, ...lights(2.44, -2.44, 0.95, 0.7) };
    },
  },
  van: {
    len: 5.4, w: 2.0,
    build() {
      const paint = [part(extrudeProfile([[-2.7, 0.38], [2.7, 0.38], [2.72, 1.0], [2.2, 1.3], [1.6, 2.3], [-2.7, 2.35]], 2.0), 0xffffff)];
      const trim = [part(extrudeProfile([[2.25, 1.3], [1.68, 2.2], [1.1, 2.2], [1.1, 1.3]], 2.04, 0.02), GLASS),
        part(box(0.12, 0.22, 1.9), 0x222222, xf(2.74, 0.5, 0)),
        ...wheels([1.75, -1.8], 0.38, 0.88, 0.26)];
      return { paint, trim, ...lights(2.72, -2.72, 1.0, 0.75) };
    },
  },
  truck: {
    len: 7.2, w: 2.3,
    build() {
      const paint = [part(extrudeProfile([[1.9, 0.5], [3.6, 0.5], [3.62, 1.3], [3.3, 2.5], [1.9, 2.55]], 2.2), 0xffffff)];
      const trim = [part(box(5.0, 2.7, 2.3), 0xe8e6e0, xf(-0.7, 2.0, 0)),
        part(extrudeProfile([[3.32, 1.45], [3.05, 2.4], [2.6, 2.4], [2.6, 1.45]], 2.24, 0.02), GLASS),
        part(box(7.0, 0.25, 1.4), 0x1e1e1e, xf(0.2, 0.55, 0)),
        ...wheels([2.7, -1.6, -2.6], 0.48, 0.92, 0.32)];
      return { paint, trim, ...lights(3.62, -3.22, 1.0, 0.85) };
    },
  },
  bus: {
    len: 12, w: 2.55, color: 0x2a5aa8,
    build() {
      const paint = [part(extrudeProfile([[-6, 0.4], [6, 0.4], [6.02, 2.95], [5.85, 3.15], [-5.95, 3.15], [-6.02, 2.9]], 2.55, 0.08), 0xffffff)];
      const trim = [part(box(10.4, 1.05, 2.58), GLASS, xf(-0.4, 2.1, 0)),
        part(box(0.06, 1.6, 2.2), GLASS, xf(6.04, 2.1, 0)),
        part(box(11.9, 0.35, 2.58), 0xe8e8e8, xf(0, 0.95, 0)),
        part(box(1.6, 0.45, 1.6), 0x9aa0a6, xf(-2.5, 3.35, 0)),
        ...wheels([4.2, -3.4], 0.5, 1.05, 0.34)];
      return { paint, trim, ...lights(6.02, -6.02, 0.85, 1.0) };
    },
  },
};
function lights(front, back, y, z) {
  const head = [], tail = [];
  for (const s of [-1, 1]) {
    head.push(part(box(0.06, 0.16, 0.34), 0xffffff, xf(front, y, s * z)));
    tail.push(part(box(0.06, 0.16, 0.3), 0xffffff, xf(back, y, s * z)));
  }
  return { head, tail };
}
export function carGeometries(type) {
  const b = CAR_TYPES[type].build();
  return { paint: merge(b.paint), trim: merge(b.trim), head: merge(b.head), tail: merge(b.tail) };
}

// ------------------------------------------------------------ 人 (腰の高さが原点の脚・肩が原点の腕・胴と頭)
export function personGeometries() {
  const torso = merge([
    part(new THREE.CapsuleGeometry(0.19, 0.42, 4, 10), 0xffffff, xf(0, 1.22, 0, 0, 0, 0, 1, 1, 0.7)),
    part(cyl(0.06, 0.07, 0.12, 8), 0xffffff, xf(0, 1.6, 0)),
  ]);
  const head = merge([
    part(new THREE.SphereGeometry(0.115, 12, 10), 0xffffff, xf(0, 1.74, 0, 0, 0, 0, 0.92, 1.05, 1)),
    part(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), 0x2a1d16, xf(0, 1.76, -0.012)),
  ]);
  const leg = merge([
    part(new THREE.CapsuleGeometry(0.075, 0.72, 3, 8), 0xffffff, xf(0, -0.43, 0)),
    part(box(0.11, 0.08, 0.26), 0x1a1a1a, xf(0, -0.86, 0.05)),
  ]);
  const arm = part(new THREE.CapsuleGeometry(0.055, 0.5, 3, 8), 0xffffff, xf(0, -0.3, 0));
  return { torso, head, leg, arm };
}
