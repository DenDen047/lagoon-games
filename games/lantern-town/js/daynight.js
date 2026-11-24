// 1 日の ながれ: 時間・空の色・太陽と月・街灯・BGM。
import * as THREE from 'three';
import { scene, sky, sun, hemi, sunDir, setBloom, camera } from './engine.js';
import { G, SV, save } from './state.js';
import { LAMPS, setBulbs } from './world.js';
import { setMusic, sfx } from './audio.js';
import { UI } from './ui.js';

// [時刻, 空の上, 地平線, 太陽の色, 太陽の強さ, 半球光(空), 半球光(地面), 半球光の強さ]
const KEYS = [
  [0, 0x0b1030, 0x1d2550, 0x8fa8ff, 0.5, 0x4a5cb0, 0x1a1a2a, 0.55],
  [4.8, 0x141a44, 0x3a3462, 0x8fa8ff, 0.5, 0x4a5cb0, 0x1a1a2a, 0.55],
  [6.3, 0x6a9ad8, 0xffc89a, 0xffb070, 1.5, 0xffd6b8, 0x5a4a3a, 0.95],
  [9, 0x4f95e0, 0xcfe6f5, 0xfff4e0, 2.5, 0xd6eaff, 0x5b6b3a, 1.25],
  [15.5, 0x4f95e0, 0xd6e8f5, 0xfff0d8, 2.4, 0xd6eaff, 0x5b6b3a, 1.2],
  [17.6, 0x5a6aa8, 0xffa070, 0xff9050, 1.6, 0xffc4a0, 0x4a3a3a, 0.95],
  [19, 0x141a40, 0x3a3060, 0x9fb0ff, 0.55, 0x4a5cb0, 0x202030, 0.6],
  [24, 0x0b1030, 0x1d2550, 0x8fa8ff, 0.5, 0x4a5cb0, 0x1a1a2a, 0.55],
];
const cA = new THREE.Color(), cB = new THREE.Color();
const lerpHex = (a, b, k, out) => out.set(a).lerp(cB.set(b), k);
const fogCol = new THREE.Color();
const INDOOR = new THREE.Color(0x2a1f18);

const POOL = [];
export function initDayNight() {
  for (let i = 0; i < 10; i++) {
    const l = new THREE.PointLight(0xffb35c, 0, 11, 1.4);
    scene.add(l);
    POOL.push(l);
  }
  // 星
  const n = 500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 0.85;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * 280; pos[i * 3 + 1] = Math.sin(e) * 280; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 280;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  sky.add(stars);
}
let stars = null;

const hourLen = (h) => (h >= 6 && h < 18 ? 18 : 12);   // 1 時間が 何びょうか
export function nightAmount(h) {
  if (h >= 7 && h < 17.3) return 0;
  if (h >= 19 || h < 5) return 1;
  if (h < 7) return 1 - (h - 5) / 2;
  return (h - 17.3) / 1.7;
}

let assignT = 0;
export function updateDayNight(dt, running) {
  if (running) {
    const before = SV.time;
    SV.time += dt / hourLen(SV.time);
    if (SV.time >= 24) SV.time -= 24;
    if (before < 18 && SV.time >= 18) { UI.toast('よるに なった。ぼちで ガイコツが めを さます……', 'night'); sfx('bell'); save(); }
    if (before < 6 && SV.time >= 6) { SV.day++; UI.toast(`${SV.day}にちめの あさ`, 'big'); sfx('morning'); save(); }
  }
  const h = SV.time;
  let i = 0;
  while (KEYS[i + 1][0] <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1], k = (h - a[0]) / (b[0] - a[0]);
  const indoor = G.area !== 'town';
  lerpHex(a[1], b[1], k, sky.material.uniforms.top.value);
  lerpHex(a[2], b[2], k, sky.material.uniforms.bottom.value);
  lerpHex(a[3], b[3], k, sun.color);
  sun.intensity = a[4] + (b[4] - a[4]) * k;
  lerpHex(a[5], b[5], k, hemi.color);
  lerpHex(a[6], b[6], k, hemi.groundColor);
  hemi.intensity = a[7] + (b[7] - a[7]) * k;
  G.night = nightAmount(h);

  // 太陽 (ひる) と 月 (よる) の 向き
  if (h >= 6 && h < 18.5) {
    const t = Math.min(1, Math.max(0, (h - 6) / 12));
    const ang = 0.35 + t * (Math.PI - 0.7);
    sunDir.set(Math.cos(ang) * 0.85, Math.max(0.35, Math.sin(ang)), 0.45).normalize();
  } else sunDir.set(-0.45, 0.9, 0.35).normalize();
  sky.material.uniforms.sunDir.value.copy(sunDir);
  sky.material.uniforms.sunCol.value.copy(sun.color).multiplyScalar(1 - G.night * 0.7);
  sky.position.copy(camera.position);
  if (stars) stars.material.opacity = G.night * 0.9;

  fogCol.copy(sky.material.uniforms.bottom.value);
  if (indoor) {
    scene.background = INDOOR;
    scene.fog.color.copy(INDOOR);
    scene.fog.near = 40; scene.fog.far = 90;
    sky.visible = false;
    hemi.intensity = Math.max(hemi.intensity, 0.9);
    sun.intensity = Math.max(sun.intensity * 0.7, 0.6);
  } else {
    scene.background = null;
    scene.fog.color.copy(fogCol);
    scene.fog.near = 55 - G.night * 15; scene.fog.far = 190 - G.night * 60;
    sky.visible = true;
  }
  setBulbs(indoor ? 0 : G.night);
  setBloom(0.28 + G.night * 0.55);
  setMusic(G.mode !== 'play' ? 'day' : !indoor && G.night > 0.5 ? 'night' : 'day');

  // 近くの あかりに 光を わりあてる (光の数は かえない)
  assignT -= dt;
  if (assignT <= 0) {
    assignT = 0.3;
    const p = G.player ? G.player.pos : camera.position;
    const list = LAMPS.filter((l) => l.area === G.area).map((l) => [l, (l.x - p.x) ** 2 + (l.z - p.z) ** 2]).sort((x, y) => x[1] - y[1]);
    POOL.forEach((pl, j) => {
      const e = list[j];
      if (!e) { pl.userData.target = 0; return; }
      const [l] = e;
      pl.position.set(l.x, l.y, l.z);
      pl.color.set(l.color);
      pl.userData.target = l.power * (indoor ? 3.5 * (0.35 + 0.65 * G.night) : 9 * G.night);
    });
  }
  for (const pl of POOL) pl.intensity += ((pl.userData.target || 0) - pl.intensity) * Math.min(1, dt * 6);
}
