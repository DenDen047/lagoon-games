import * as THREE from 'three';
import { Kit } from './kit.js';
import { L, BOUNDS, blockRect, rng32, buildRoads, buildSidewalks, planBlock, buildBuilding, impostorViews } from './city.js';
import { Impostors } from './lod.js';
import { Street } from './street.js';
import { Traffic } from './traffic.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sky as SkyDome } from './sky.js';
import { Controls } from './controls.js';

const q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('view').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 1400);

const kit = new Kit();
await kit.load('assets/city.glb', (p) => ($('loadBar').style.width = (p * 100).toFixed(0) + '%'));

// 遠くの建物の板の絵を撮る
const imp = new Impostors(kit, renderer, kit.uniforms);
imp.bake(impostorViews());
kit.imp = imp;

// ------------------------------------------------ 街をつくる
const seed = Number(q.get('seed') || 7);
const rng = rng32(seed);
const center = { x: 0, z: 0 };
buildRoads(kit, rng);
const allLots = [], groups = [];
const only = q.get('block')?.split(',').map(Number);
const RING = 2; // 街の外に遠景だけの区画を 2 周
for (let i = -1 - RING; i < L.NI + RING; i++) for (let j = -1 - RING; j < L.NJ + RING; j++) {
  if (only && (i !== only[0] || j !== only[1])) continue;
  const farOnly = i < -1 || j < -1 || i >= L.NI || j >= L.NJ;
  const b = blockRect(i, j);
  if (!farOnly) buildSidewalks(kit, b);
  const lots = planBlock(b, rng, center);
  for (const lot of lots) lot.farOnly = farOnly;
  // 隣の高さ (左右は同じ列、裏は反対の列)
  for (const lot of lots) {
    const row = lots.filter((o) => o.facing === lot.facing).sort((a, c) => a.x0 - c.x0);
    const k = row.indexOf(lot);
    const west = row[k - 1], east = row[k + 1];
    const behind = lots.filter((o) => o.facing !== lot.facing && o.x0 < lot.x1 - 0.1 && o.x1 > lot.x0 + 0.1);
    const back = Math.min(...behind.map((o) => o.h));
    // 南向き (+z) なら建物の左 = 西、北向きなら左 = 東
    const [left, right] = lot.facing > 0 ? [west, east] : [east, west];
    const nb = {
      left: left ? left.h : 0, right: right ? right.h : 0, back,
      leftOpen: !left, rightOpen: !right,
    };
    const g = { cx: (lot.x0 + lot.x1) / 2, cz: (lot.z0 + lot.z1) / 2, near: !farOnly, farOnly };
    kit.beginGroup(g);
    buildBuilding(kit, lot, nb, rng);
    kit.endGroup();
    groups.push(g);
    if (!farOnly) allLots.push(lot);
  }
}
const street = only ? null : new Street(kit, scene, rng, kit.uniforms); // 植え込みはキットの部品なので build の前に置く
const count = kit.build(scene);
const traffic = only || q.has('notraffic') ? null : new Traffic(scene, rng);
imp.build(scene);
for (const g of groups) if (g.farOnly) imp.setVisible(g, true);

// 近くの建物だけ部品で、遠くは板で描く
const LOD_NEAR = Number(q.get('lod') || 150);
const lodAt = new THREE.Vector3(1e9, 0, 0);
function updateLOD(force) {
  const p = camera.position;
  if (!force && Math.hypot(p.x - lodAt.x, p.z - lodAt.z) < 6) return;
  lodAt.copy(p);
  for (const g of groups) {
    if (g.farOnly) continue;
    const d = Math.hypot(g.cx - p.x, g.cz - p.z);
    const near = d < (g.near ? LOD_NEAR + 12 : LOD_NEAR);
    if (near !== g.near || force) {
      g.near = near;
      kit.setGroupVisible(g, near);
      imp.setVisible(g, !near);
    }
  }
}

// 地面 (街の外まで)
{
  const w = BOUNDS.x1 - BOUNDS.x0 + 600, d = BOUNDS.z1 - BOUNDS.z0 + 600;
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 6, uv.getY(i) * d / 6);
  const ground = new THREE.Mesh(g, kit.materials.Asphalt);
  ground.position.y = -0.16;
  ground.receiveShadow = true;
  scene.add(ground);
}

// ------------------------------------------------ 空と光
const sky = new SkyDome(scene, renderer);
let hour = Number(q.get('t') || 16.5);
sky.setHour(hour);
kit.uniforms.uNight.value = sky.night;

const controls = new Controls(camera, renderer.domElement, { lots: allLots });
if (traffic) controls.follow = {
  get() {
    const c = traffic.followTarget();
    const p = traffic.carPos(c);
    return { pos: new THREE.Vector3(p.x, 0, p.z), dir: new THREE.Vector3(p.hx, 0, p.hz).normalize() };
  },
};
if (q.get('cam')) {
  const c = q.get('cam').split(',').map(Number);
  controls.setView(new THREE.Vector3(c[0], c[1], c[2]), new THREE.Vector3(c[3], c[4], c[5]));
} else controls.setView(new THREE.Vector3(-75, 48, 125), new THREE.Vector3(-10, 6, 38));

// ------------------------------------------------ UI
$('timeRange').value = hour;
$('timeRange').addEventListener('input', (e) => {
  hour = Number(e.target.value);
  sky.setHour(hour);
  kit.uniforms.uNight.value = sky.night;
  $('timeLabel').textContent = fmtHour(hour);
});
$('timeLabel').textContent = fmtHour(hour);
function fmtHour(h) { const m = Math.round((h % 1) * 60); return `${Math.floor(h)}:${String(m).padStart(2, '0')}`; }
for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));
function setMode(m) {
  if (m === 'follow' && controls.mode === 'follow' && traffic) traffic.nextFollow(); // もう一度押すと別の車
  controls.setMode(m);
  for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === m);
  $('help').textContent = m === 'walk' ? 'クリックで視点を固定 / W A S D で歩く / Shift で走る / Esc で解除'
    : m === 'follow' ? 'ドラッグで回り込む / ホイールで近づく / もう一度押すと別の車'
    : 'ドラッグで回す / 右ドラッグか Shift+ドラッグで動かす / ホイールで近づく / W A S D でも動く';
}
setMode(q.get('mode') || 'fly');
$('loading').classList.add('hidden');
$('stats').textContent = `部品 ${count.toLocaleString()} 個`;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.5, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ------------------------------------------------ ループ
const clock = new THREE.Timer();
let simT = 0;
let fpsT = 0, fpsN = 0;
function frame() {
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.1);
  controls.update(dt);
  updateLOD();
  sky.follow(controls.focus());
  kit.uniforms.uTime.value += dt;
  simT += dt;
  if (traffic) { traffic.night = sky.night; traffic.update(dt, simT); }
  if (street) { street.update(simT, sky.night); street.updateLights(camera.position, sky.night); }
  // 夕方から夜は明かりをにじませる
  if (sky.night > 0.2) { bloom.strength = 0.55 * sky.night; composer.render(dt); } else renderer.render(scene, camera);
  fpsN++; fpsT += dt;
  if (fpsT > 1) { $('fps').textContent = `${Math.round(fpsN / fpsT)} fps`; fpsT = 0; fpsN = 0; }
}
// 描きはじめて数フレームたったら、自動の画面確認用に合図する
let frames = 0;
renderer.setAnimationLoop(() => {
  frame();
  if (++frames === 8) window.__ready = true;
});
window.__dbg = { scene, camera, renderer, kit, controls, sky, traffic, street };
