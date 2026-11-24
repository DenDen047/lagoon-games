// 描画まわり: レンダラー・カメラ・光・空・画質設定・アイコン作り。
import * as THREE from 'three';
import { EffectComposer } from '../lib/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../lib/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../lib/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../lib/three/addons/postprocessing/OutputPass.js';

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
export let renderer = null;
let composer = null, bloom = null;
export const Q = { level: 'high', bloom: true, dpr: 2, shadow: 2048, leaves: true };

export const sun = new THREE.DirectionalLight(0xffffff, 2.2);
export const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5b6b3a, 1.2);
export const ambient = new THREE.AmbientLight(0xffffff, 0);

// 空: 上と地平線の 2 色を混ぜる大きな球
export const sky = new THREE.Mesh(
  new THREE.SphereGeometry(300, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x5aa0e0) }, bottom: { value: new THREE.Color(0xcfe6f5) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xfff2c0) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP;
      void main(){ float h = clamp(vP.y * 1.6 + 0.1, 0.0, 1.0); vec3 c = mix(bottom, top, pow(h, 0.8));
      float s = max(dot(normalize(vP), normalize(sunDir)), 0.0); c += sunCol * (pow(s, 600.0) * 1.5 + pow(s, 12.0) * 0.18);
      gl_FragColor = vec4(c, 1.0); }`,
  }),
);
sky.renderOrder = -1;

export function init(canvas) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return false;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  scene.fog = new THREE.Fog(0xcfe6f5, 60, 190);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target, hemi, ambient, sky);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.5, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  window.addEventListener('resize', resize);
  return true;
}

export function setQuality(level) {
  const touch = matchMedia('(pointer: coarse)').matches;
  if (level === 'auto') level = touch ? 'mid' : 'high';
  Q.level = level;
  Q.bloom = level === 'high';
  Q.dpr = level === 'high' ? 2 : level === 'mid' ? 1.5 : 1;
  Q.shadow = level === 'low' ? 1024 : 2048;
  Q.leaves = level !== 'low';
  renderer.shadowMap.enabled = true;
  if (sun.shadow.mapSize.x !== Q.shadow) {
    sun.shadow.mapSize.set(Q.shadow, Q.shadow);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  resize();
}

export function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.dpr));
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w < h ? 62 : 50;
  camera.updateProjectionMatrix();
}

export function setBloom(strength) { if (bloom) bloom.strength = strength; }

export function render() {
  if (Q.bloom) composer.render();
  else renderer.render(scene, camera);
}

// ---------- カメラ (プレイヤーの うしろから見る) ----------
export const cam = { yaw: Math.PI, pitch: 0.42, dist: 11, target: new THREE.Vector3(), shake: 0, fixed: null };
const camPos = new THREE.Vector3();
const look = new THREE.Vector3();

/** fixed が あるとき (家の中など) は、ななめ上の きまった向きから見る */
export function updateCamera(dt, focus) {
  const k = 1 - Math.exp(-dt * 8);
  cam.target.lerp(focus, k);
  if (cam.fixed) {
    const f = cam.fixed, t = cam.target;
    camPos.set(f.x + (t.x - f.x) * 0.35, f.y, f.z + t.z * 0.25);
    look.set(f.x + (t.x - f.x) * 0.5, 0.8, t.z * 0.5 + f.lz);
    camera.position.lerp(camPos, cam.snap ? 1 : k);
  } else {
    const cp = Math.cos(cam.pitch);
    camPos.set(cam.target.x + Math.sin(cam.yaw) * cp * cam.dist, cam.target.y + 1.4 + Math.sin(cam.pitch) * cam.dist,
      cam.target.z + Math.cos(cam.yaw) * cp * cam.dist);
    camera.position.copy(camPos);
    look.set(cam.target.x, cam.target.y + 1.6, cam.target.z);
  }
  cam.snap = false;
  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt * 2.5);
    const s = cam.shake * cam.shake * 0.35;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
  }
  camera.lookAt(look);
  // 影を作る範囲は いつも プレイヤーの まわり
  sun.target.position.copy(cam.target);
  sun.position.copy(cam.target).addScaledVector(sunDir, 70);
}
export const sunDir = new THREE.Vector3(0.4, 1, 0.3).normalize();

// ---------- アイコン (お店の 品物などの 絵) を 3D モデルから作る ----------
const iconCache = new Map();
let iconScene = null, iconCam = null, iconRT = null;
export function icon(key, makeObj, size = 128) {
  if (iconCache.has(key)) return iconCache.get(key);
  if (!iconScene) {
    iconScene = new THREE.Scene();
    iconScene.add(new THREE.HemisphereLight(0xffffff, 0x887766, 2.2));
    const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 3, 4); iconScene.add(d);
    iconCam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    iconRT = new THREE.WebGLRenderTarget(size, size, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  }
  iconRT.setSize(size, size);
  const obj = makeObj();
  iconScene.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() * 0.5;
  const dir = new THREE.Vector3(0.9, 0.75, 1.3).normalize();
  iconCam.position.copy(c).addScaledVector(dir, r / Math.sin(THREE.MathUtils.degToRad(15)) * 1.02);
  iconCam.lookAt(c);
  const old = renderer.getRenderTarget();
  const oldTM = renderer.toneMapping;
  renderer.setRenderTarget(iconRT);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(iconScene, iconCam);
  const px = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(iconRT, 0, 0, size, size, px);
  renderer.setRenderTarget(old);
  renderer.toneMapping = oldTM;
  iconScene.remove(obj);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  ctx.putImageData(img, 0, 0);
  const url = cv.toDataURL();
  iconCache.set(key, url);
  return url;
}
