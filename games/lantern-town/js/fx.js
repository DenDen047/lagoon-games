// 見た目の演出: 火花・ダメージの数字・落ち葉・よるの ひかりの たま・こうげき予告の わ。
import * as THREE from 'three';
import { scene, camera, Q, noAO } from './engine.js';

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,0.8)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function leafTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(32, 32, 26, 13, 0.6, 0, Math.PI * 2); g.fill();
  return new THREE.CanvasTexture(c);
}
const DOT = dotTexture();

// ---------- 火花 (たくさんの点を 1 回で描く) ----------
const N = 500;
const pPos = new Float32Array(N * 3), pCol = new Float32Array(N * 3), pVel = new Float32Array(N * 3), pLife = new Float32Array(N), pGrav = new Float32Array(N);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const sparks = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.28, map: DOT, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
sparks.frustumCulled = false;
let pNext = 0;
const tmpC = new THREE.Color();

export function burst(pos, color, n = 12, speed = 5, { up = 2, grav = 9, life = 0.6, spread = 1 } = {}) {
  tmpC.set(color);
  for (let k = 0; k < n; k++) {
    const i = pNext; pNext = (pNext + 1) % N;
    pPos[i * 3] = pos.x; pPos[i * 3 + 1] = pos.y; pPos[i * 3 + 2] = pos.z;
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
    pVel[i * 3] = Math.cos(a) * s * spread; pVel[i * 3 + 1] = up + Math.random() * speed * 0.6; pVel[i * 3 + 2] = Math.sin(a) * s * spread;
    pCol[i * 3] = tmpC.r; pCol[i * 3 + 1] = tmpC.g; pCol[i * 3 + 2] = tmpC.b;
    pLife[i] = life * (0.6 + Math.random() * 0.5);
    pGrav[i] = grav;
  }
}

// ---------- 落ち葉と、よるの ひかりの たま ----------
const L = 220;
const lPos = new Float32Array(L * 3), lCol = new Float32Array(L * 3), lPh = new Float32Array(L);
const lGeo = new THREE.BufferGeometry();
lGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
lGeo.setAttribute('color', new THREE.BufferAttribute(lCol, 3));
const leafMat = new THREE.PointsMaterial({ size: 0.32, map: leafTexture(), vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.3 });
const leaves = new THREE.Points(lGeo, leafMat);
leaves.frustumCulled = false;
const LEAF_COLS = [0xe2742b, 0xf0a531, 0xc9462c, 0xf2c94c].map((c) => new THREE.Color(c));
for (let i = 0; i < L; i++) {
  lPos[i * 3] = (Math.random() - 0.5) * 50; lPos[i * 3 + 1] = Math.random() * 14; lPos[i * 3 + 2] = (Math.random() - 0.5) * 50;
  const c = LEAF_COLS[i % 4]; lCol[i * 3] = c.r; lCol[i * 3 + 1] = c.g; lCol[i * 3 + 2] = c.b;
  lPh[i] = Math.random() * 10;
}

const W = 70;
const wPos = new Float32Array(W * 3), wBase = new Float32Array(W * 3);
const wGeo = new THREE.BufferGeometry();
wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
const wispMat = new THREE.PointsMaterial({ size: 0.45, map: DOT, color: 0x9dffb0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
const wisps = new THREE.Points(wGeo, wispMat);
wisps.frustumCulled = false;
for (let i = 0; i < W; i++) {
  wBase[i * 3] = 52 + Math.random() * 34; wBase[i * 3 + 1] = 0.5 + Math.random() * 3; wBase[i * 3 + 2] = (Math.random() - 0.5) * 34;
}

// ---------- こうげき予告の わ ----------
const rings = [];
export function ring(pos, radius, dur, color = 0xff3030) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos.x, 0.08, pos.z);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false }));
  fill.rotation.x = -Math.PI / 2;
  fill.position.set(pos.x, 0.07, pos.z);
  m.scale.setScalar(radius);
  scene.add(m, fill);
  rings.push({ m, fill, radius, t: 0, dur });
}

// ---------- ダメージの数字 (HTML) ----------
const nums = [];
let numLayer = null;
const v3 = new THREE.Vector3();
export function popText(pos, text, cls = '') {
  if (!numLayer) numLayer = document.getElementById('nums');
  const el = document.createElement('div');
  el.className = 'num ' + cls;
  el.textContent = text;
  numLayer.appendChild(el);
  nums.push({ el, p: pos.clone(), t: 0, dx: (Math.random() - 0.5) * 0.8 });
}

export function initFx() { scene.add(sparks, leaves, wisps); noAO.push(sparks, leaves, wisps); }

export function updateFx(dt, { night, area, focus, time }) {
  for (let i = 0; i < N; i++) {
    if (pLife[i] <= 0) { if (pPos[i * 3 + 1] > -50) pPos[i * 3 + 1] = -100; continue; }
    pLife[i] -= dt;
    pVel[i * 3 + 1] -= pGrav[i] * dt;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    if (pPos[i * 3 + 1] < 0.05) { pPos[i * 3 + 1] = 0.05; pVel[i * 3 + 1] *= -0.3; pVel[i * 3] *= 0.6; pVel[i * 3 + 2] *= 0.6; }
    if (pLife[i] <= 0) pPos[i * 3 + 1] = -100;
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;

  leaves.visible = Q.leaves && area === 'town';
  if (leaves.visible) {
    leafMat.opacity = 1 - night * 0.6;
    for (let i = 0; i < L; i++) {
      lPh[i] += dt;
      lPos[i * 3] += (Math.sin(lPh[i] * 1.3) * 0.8 + 0.6) * dt;
      lPos[i * 3 + 1] -= (0.7 + Math.sin(lPh[i] * 2.1) * 0.3) * dt;
      lPos[i * 3 + 2] += Math.cos(lPh[i] * 0.9) * 0.5 * dt;
      // カメラの まわりに おさまるように 回り込ませる
      for (const [ax, c] of [[0, focus.x], [2, focus.z]]) {
        if (lPos[i * 3 + ax] < c - 25) lPos[i * 3 + ax] += 50;
        if (lPos[i * 3 + ax] > c + 25) lPos[i * 3 + ax] -= 50;
      }
      if (lPos[i * 3 + 1] < 0) lPos[i * 3 + 1] += 14;
    }
    lGeo.attributes.position.needsUpdate = true;
  }

  wispMat.opacity = area === 'town' ? night * 0.9 : 0;
  if (wispMat.opacity > 0.01) {
    for (let i = 0; i < W; i++) {
      wPos[i * 3] = wBase[i * 3] + Math.sin(time * 0.7 + i) * 1.2;
      wPos[i * 3 + 1] = wBase[i * 3 + 1] + Math.sin(time * 1.3 + i * 2) * 0.4;
      wPos[i * 3 + 2] = wBase[i * 3 + 2] + Math.cos(time * 0.6 + i * 3) * 1.2;
    }
    wGeo.attributes.position.needsUpdate = true;
  }

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dt;
    const k = Math.min(1, r.t / r.dur);
    r.fill.scale.setScalar(r.radius * k);
    r.m.material.opacity = 0.5 + Math.sin(r.t * 20) * 0.2;
    if (r.t >= r.dur) {
      scene.remove(r.m, r.fill);
      r.m.geometry.dispose(); r.fill.geometry.dispose(); r.m.material.dispose(); r.fill.material.dispose();
      rings.splice(i, 1);
    }
  }

  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i];
    n.t += dt;
    v3.copy(n.p); v3.y += n.t * 1.6; v3.x += n.dx * n.t;
    v3.project(camera);
    if (n.t > 0.9 || v3.z > 1) { n.el.remove(); nums.splice(i, 1); continue; }
    n.el.style.transform = `translate(${(v3.x * 0.5 + 0.5) * innerWidth}px, ${(-v3.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.25 - n.t) * 2})`;
    n.el.style.opacity = String(Math.min(1, (0.9 - n.t) * 4));
  }
}
