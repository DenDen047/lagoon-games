// 1 日の ながれ: 時間・空と雲・太陽と月・まわりの光・色の仕上げ・街灯・窓の明かり・BGM。
import * as THREE from 'three';
import { scene, sky, skyUniforms, sun, rim, hemi, sunDir, setBloom, camera, renderer, gradeU, updateEnv } from './engine.js';
import { G, SV, save } from './state.js';
import { LAMPS, setBulbs, setBeams, ROOM_LIGHTS } from './world.js';
import { setMusic, sfx } from './audio.js';
import { UI } from './ui.js';

// 時刻ごとの 見た目。あいだの 時刻は となりどうしを まぜる
// top/bottom=空 sun=太陽(よるは月) hs/hg/hi=半球光 cloud=雲 rim=ふちの光 env=空からの光 sh/hl=暗部と明部の色味 exp=明るさ
const N = { top: 0x050818, bottom: 0x141c3a, sun: 0x8fa8ff, sunI: 0.55, hs: 0x2a3670, hg: 0x0c0c16, hi: 0.16, cloud: 0x1c2240, rim: 0x6f8cff, rimI: 0.9, env: 0.14, sh: 0x5068a8, hl: 0xa08462, sat: 1.0, con: 1.1, vig: 0.45, exp: 1.0 };
const D = { top: 0x3f8ee6, bottom: 0xcde6f7, sun: 0xfff2dc, sunI: 2.9, hs: 0xd6eaff, hg: 0x5b6b3a, hi: 0.55, cloud: 0xffffff, rim: 0xbfd8ff, rimI: 0.45, env: 0.9, sh: 0x6f7898, hl: 0x948a76, sat: 1.12, con: 1.06, vig: 0.22, exp: 1.0 };
const KEYS = [
  [0, N],
  [4.8, { ...N, top: 0x111a44, bottom: 0x3a3462 }],
  [6.3, { top: 0x5d8fd6, bottom: 0xffb88a, sun: 0xffa060, sunI: 1.9, hs: 0xffd0b0, hg: 0x4a3a30, hi: 0.5, cloud: 0xffc6a8, rim: 0xff9a6a, rimI: 0.9, env: 0.7, sh: 0x6a6aa0, hl: 0xb08058, sat: 1.12, con: 1.08, vig: 0.3, exp: 1.05 }],
  [9, D],
  [15.5, D],
  [17.6, { top: 0x4a5aa0, bottom: 0xff9a5a, sun: 0xff8a40, sunI: 2.3, hs: 0xffbe98, hg: 0x4a3434, hi: 0.5, cloud: 0xffb080, rim: 0xff7a50, rimI: 1.2, env: 0.75, sh: 0x6a5aa8, hl: 0xbc7a46, sat: 1.18, con: 1.1, vig: 0.32, exp: 1.05 }],
  [19, { ...N, top: 0x0b1030, bottom: 0x2c2450, cloud: 0x282850, env: 0.2, hi: 0.2 }],
  [24, N],
];
const COLOR_KEYS = ['top', 'bottom', 'sun', 'hs', 'hg', 'cloud', 'rim', 'sh', 'hl'];
const cur = Object.fromEntries(COLOR_KEYS.map((k) => [k, new THREE.Color()]));
const tmpC = new THREE.Color();
const fogCol = new THREE.Color();
const INDOOR = new THREE.Color(0x2a1f18);
const MOON = new THREE.Vector3(-0.35, 0.62, -0.7).normalize();
const dayDir = new THREE.Vector3();

const POOL = [];
let stars = null;
const heroLight = new THREE.PointLight(0xffd6a0, 0, 8, 1.6);
export function initDayNight() {
  scene.add(heroLight);
  for (let i = 0; i < 12; i++) {
    const l = new THREE.PointLight(0xffb35c, 0, 15, 1.5);
    scene.add(l);
    POOL.push(l);
  }
  // 星 (ちらちら またたく)
  const n = 700, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.08 + Math.pow(Math.random(), 0.7) * 1.4;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * 280; pos[i * 3 + 1] = Math.sin(e) * 280; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 280;
    const w = 0.6 + Math.random() * 0.4; tmpC.setHSL(0.6 - Math.random() * 0.5, 0.4, w);
    col[i * 3] = tmpC.r; col[i * 3 + 1] = tmpC.g; col[i * 3 + 2] = tmpC.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  sky.add(stars);
}

const hourLen = (h) => (h >= 6 && h < 18 ? 18 : 12);   // 1 時間が 何びょうか
export function nightAmount(h) {
  if (h >= 7 && h < 17.3) return 0;
  if (h >= 19 || h < 5) return 1;
  if (h < 7) return 1 - (h - 5) / 2;
  return (h - 17.3) / 1.7;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

let assignT = 0, envT = 0, lastArea = '', lastSig = -1;
export function updateDayNight(dt, running) {
  if (running) {
    const before = SV.time;
    SV.time += dt / hourLen(SV.time);
    if (SV.time >= 24) SV.time -= 24;
    if (before < 18 && SV.time >= 18) { UI.toast('よるに なった。ぼちで ガイコツが めを さます……', 'night'); sfx('bell'); save(); }
    if (before < 6 && SV.time >= 6) { SV.day++; UI.toast(`${SV.day}にちめの あさ`, 'big'); sfx('morning'); save(); }
  }
  const h = G.mode === 'play' ? SV.time : 17.0;   // タイトル画面は 夕やけ
  let i = 0;
  while (KEYS[i + 1][0] <= h) i++;
  const [ha, a] = KEYS[i], [hb, b] = KEYS[i + 1];
  const k = (h - ha) / (hb - ha);
  for (const c of COLOR_KEYS) cur[c].set(a[c]).lerp(tmpC.set(b[c]), k);
  const num = (key) => a[key] + (b[key] - a[key]) * k;
  const indoor = G.area !== 'town';
  G.night = nightAmount(h);
  // よるは 主人公の まわりを ほんのり 照らす (暗がりでも すがたが 見えるように)
  if (G.player) { heroLight.position.set(G.player.pos.x, 4.2, G.player.pos.z); heroLight.intensity = (indoor ? 0.6 : 5) * G.night; }

  // 空
  skyUniforms.top.value.copy(cur.top);
  skyUniforms.bottom.value.copy(cur.bottom);
  skyUniforms.cloudCol.value.copy(cur.cloud);
  skyUniforms.night.value = G.night;
  skyUniforms.time.value = G.now;
  skyUniforms.ground.value.copy(cur.hg).multiplyScalar(0.8);
  skyUniforms.moonDir.value.copy(MOON);

  // 太陽の 通り道 (東から 西へ)。夕方と 明け方は 月の 向きへ なめらかに うつる
  const t = Math.min(1, Math.max(0, (h - 6) / 12.5));
  const ang = 0.3 + t * (Math.PI - 0.6);
  dayDir.set(Math.cos(ang) * 0.85, Math.max(0.12, Math.sin(ang) * 0.95), 0.45).normalize();
  const toMoon = h >= 12 ? smooth(18.3, 19.1, h) : 1 - smooth(5.2, 6.1, h);
  sunDir.copy(dayDir).lerp(MOON, toMoon).normalize();
  skyUniforms.sunDir.value.copy(dayDir);
  skyUniforms.sunCol.value.copy(cur.sun).multiplyScalar(1 - G.night * 0.85);
  sun.color.copy(cur.sun);
  sun.intensity = num('sunI');
  rim.color.copy(cur.rim);
  rim.intensity = num('rimI');
  hemi.color.copy(cur.hs);
  hemi.groundColor.copy(cur.hg);
  hemi.intensity = num('hi');
  sky.position.copy(camera.position);
  if (stars) { stars.material.opacity = G.night * 0.95; stars.rotation.y = G.now * 0.002; }
  renderer.toneMappingExposure = num('exp');

  // 色の 仕上げ
  gradeU.shadowTint.value.copy(cur.sh);
  gradeU.highTint.value.copy(cur.hl);
  gradeU.saturation.value = num('sat');
  gradeU.contrast.value = num('con');
  gradeU.vignette.value = num('vig');

  fogCol.copy(cur.bottom).lerp(cur.top, 0.25);
  if (indoor) {
    scene.background = INDOOR;
    scene.fog.color.copy(INDOOR);
    scene.fog.near = 40; scene.fog.far = 90;
    sky.visible = false;
    // よるの へやは あたたかい 明かりで
    hemi.color.lerp(tmpC.set(0x8a6a50), G.night * 0.85);
    hemi.groundColor.lerp(tmpC.set(0x2a1c14), G.night * 0.85);
    hemi.intensity = 0.3 + 0.3 * (1 - G.night) + 0.15 * G.night;
    sun.intensity = Math.max(0.06, sun.intensity * 0.75 * (1 - G.night * 0.92));
    rim.intensity *= 0.4;
    gradeU.shadowTint.value.set(0x766a64).lerp(cur.sh, 0.3);
    gradeU.highTint.value.set(0xa88a68);
    gradeU.vignette.value = 0.34;
    renderer.toneMappingExposure = 1.08;
  } else {
    scene.background = null;
    scene.fog.color.copy(fogCol);
    scene.fog.near = 55 - G.night * 25; scene.fog.far = 190 - G.night * 60;
    sky.visible = true;
  }
  for (const l of ROOM_LIGHTS) l.intensity = l.userData.base * (1 + G.night * 1.6);
  setBulbs(indoor ? 0 : G.night);
  setBeams(indoor ? (1 - G.night) * 0.13 : 0, cur.sun);
  setBloom(indoor ? 0.35 : 0.22 + G.night * 0.5, indoor ? 0.85 : 0.92 - G.night * 0.22);
  setMusic(G.mode !== 'play' ? 'day' : !indoor && G.night > 0.5 ? 'night' : 'day');

  // 空の色を まわりの光に する (数秒に 1 回 作りなおす)
  // 空の色が かわったときだけ、こまめに 作りなおす (一度に 大きく かわると 画面が ちらつく)
  envT -= dt;
  const sig = cur.top.r + cur.top.g + cur.top.b + cur.bottom.r * 2 + cur.bottom.g * 2 + cur.bottom.b * 2 + cur.sun.r + cur.sun.g + cur.sun.b;
  if (lastArea !== G.area || (envT <= 0 && Math.abs(sig - lastSig) > 0.01)) {
    envT = 0.2;
    lastSig = sig;
    lastArea = G.area;
    updateEnv();
  }
  scene.environmentIntensity = indoor ? 0.35 : num('env');

  // 近くの あかりに 光を わりあてる。光は いきなり 動かさず、消えてから 次の場所で ついていく
  assignT -= dt;
  if (assignT <= 0) {
    assignT = 0.25;
    const p = G.player ? G.player.pos : camera.position;
    const want = LAMPS.filter((l) => l.area === G.area).map((l) => [l, (l.x - p.x) ** 2 + (l.z - p.z) ** 2]).sort((x, y) => x[1] - y[1]).slice(0, POOL.length).map((e) => e[0]);
    for (const pl of POOL) if (pl.userData.lamp && !want.includes(pl.userData.lamp)) pl.userData.leaving = true;
    for (const l of want) {
      if (POOL.some((pl) => pl.userData.lamp === l)) continue;
      const free = POOL.find((pl) => !pl.userData.lamp || (pl.userData.leaving && pl.intensity < 0.05));
      if (!free) break;
      free.userData.lamp = l; free.userData.leaving = false;
      free.intensity = 0;
      free.position.set(l.x, l.y, l.z);
      free.color.set(l.color);
    }
  }
  for (const pl of POOL) {
    const l = pl.userData.lamp;
    pl.userData.target = !l || pl.userData.leaving || l.area !== G.area ? 0 : l.power * (indoor ? 4 * (0.35 + 0.65 * G.night) : 16 * G.night);
  }
  for (const pl of POOL) pl.intensity += ((pl.userData.target || 0) - pl.intensity) * Math.min(1, dt * 5);
}
