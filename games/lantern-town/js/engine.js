// 描画まわり: レンダラー・カメラ・光・空・後処理 (影の濃さ・光のにじみ・色の仕上げ)・画質設定・アイコン作り。
import * as THREE from 'three';
import { EffectComposer } from '../lib/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../lib/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../lib/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../lib/three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from '../lib/three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from '../lib/three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from '../lib/three/addons/postprocessing/SMAAPass.js';

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
export let renderer = null;
let composer = null, bloom = null, gtao = null, grade = null, smaa = null;
export const Q = { level: 'high', post: true, ao: true, dpr: 2, shadow: 2048, leaves: true };
export const noAO = [];      // かげの計算 (GTAO) から はずすもの: 光の すじ・火花・空など

export const sun = new THREE.DirectionalLight(0xffffff, 2.2);
export const rim = new THREE.DirectionalLight(0x9fc4ff, 0.5);   // うしろから ふちを 光らせる光
export const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5b6b3a, 1.2);
export const ambient = new THREE.AmbientLight(0xffffff, 0);

// 空: 上・地平線・地面の 3 色 + 太陽 + 月 + ゆっくり流れる雲
export const skyUniforms = {
  top: { value: new THREE.Color(0x5aa0e0) }, bottom: { value: new THREE.Color(0xcfe6f5) }, ground: { value: new THREE.Color(0x4a5a32) },
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xfff2c0) },
  moonDir: { value: new THREE.Vector3(-0.45, 0.6, -0.65).normalize() }, night: { value: 0 },
  cloudCol: { value: new THREE.Color(0xffffff) }, time: { value: 0 },
};
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top, bottom, ground, sunDir, sunCol, moonDir, cloudCol; uniform float night, time; varying vec3 vP;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
    void main(){
      vec3 d = normalize(vP);
      float h = clamp(d.y * 1.6 + 0.1, 0.0, 1.0);
      vec3 c = mix(bottom, top, pow(h, 0.75));
      float s = max(dot(d, normalize(sunDir)), 0.0);
      // 地平線の 太陽がわは 夕やけで あかるく
      c += sunCol * pow(s, 4.0) * 0.25 * (1.0 - h);
      c += sunCol * (smoothstep(0.9993, 0.9997, s) * 6.0 + pow(s, 900.0) * 2.0 + pow(s, 14.0) * 0.22);
      float m = max(dot(d, normalize(moonDir)), 0.0);
      c += vec3(0.85, 0.9, 1.0) * night * (smoothstep(0.9990, 0.9994, m) * 3.0 + pow(m, 60.0) * 0.25);
      if (d.y > 0.0) {
        vec2 uv = d.xz / (d.y + 0.25) * 1.4 + vec2(time * 0.006, time * 0.002);
        float cl = smoothstep(0.5, 0.78, fbm(uv));
        float lit = 0.75 + 0.5 * pow(s, 3.0);
        vec3 cc = mix(cloudCol * lit, sunCol * 1.4, pow(s, 6.0) * 0.6);
        c = mix(c, cc, cl * smoothstep(0.0, 0.25, d.y) * (0.85 - night * 0.55));
      }
      c = mix(c, ground, smoothstep(0.0, -0.08, d.y));
      gl_FragColor = vec4(c, 1.0);
    }`,
});
export const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), skyMat);
sky.renderOrder = -1;
noAO.push(sky);

// 色の 仕上げ: コントラスト・彩度・暗いところと 明るいところの 色味・画面の すみを 少し暗く
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, contrast: { value: 1.08 }, saturation: { value: 1.12 }, vignette: { value: 0.28 },
    shadowTint: { value: new THREE.Color(0x1a2a55) }, highTint: { value: new THREE.Color(0xffd9a0) }, tintAmt: { value: 1 }, seed: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float contrast, saturation, vignette, tintAmt, seed; uniform vec3 shadowTint, highTint; varying vec2 vUv;
    void main(){
      vec4 t = texture2D(tDiffuse, vUv); vec3 c = t.rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, saturation);
      c = (c - 0.5) * contrast + 0.5;
      c += (shadowTint - 0.5) * (1.0 - l) * (1.0 - l) * 0.16 * tintAmt + (highTint - 0.5) * l * l * 0.10 * tintAmt;
      vec2 q = (vUv - 0.5) * vec2(1.0, 0.8);
      c *= mix(1.0 - vignette, 1.0, smoothstep(0.75, 0.2, length(q)));
      c += (fract(sin(dot(vUv + seed, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), t.a);
    }`,
};
export const gradeU = GradeShader.uniforms;

const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  // ビットで しらべる (コンパイラの 最適化で isnan が 消えることが あるため)
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    bool bad(float x){ return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (bad(c.r) || bad(c.g) || bad(c.b) || bad(c.a)) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = vec4(min(max(c.rgb, vec3(0.0)), vec3(40.0)), c.a);
    }`,
};

export function init(canvas) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return false;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  scene.fog = new THREE.Fog(0xcfe6f5, 60, 190);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;                    // 影の ふちを やわらかく
  scene.add(sun, sun.target, rim, rim.target, hemi, ambient, sky);

  // 後処理の 中間画像は マルチサンプル (MSAA) に しない。Apple の GPU では MSAA と ブルームの 組み合わせで
  // ときどき 画面が まっ黒に なる。ふちの ギザギザは 最後の SMAA で なめらかにする
  const rt = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType, samples: 0 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, 256, 256);
  gtao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12, distanceFallOff: 1 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  gtao.blendIntensity = 0.9;
  // GTAO は 自分で もう一度 シーンを 描くので、そのあいだ 光の すじなどを かくす。解像度は 半分にして 軽くする
  const gRender = gtao.render.bind(gtao);
  gtao.render = (...a) => { const v = noAO.map((o) => o.visible); noAO.forEach((o) => { o.visible = false; }); gRender(...a); noAO.forEach((o, i) => { o.visible = v[i]; }); };
  const gSize = gtao.setSize.bind(gtao);
  gtao.setSize = (w, h) => gSize(Math.max(1, Math.floor(w / 2)), Math.max(1, Math.floor(h / 2)));
  composer.addPass(gtao);
  // 光のにじみ (ブルーム) は 画面全体を まぜるので、こわれた値 (NaN・無限大) の 画素が 1 つでも あると
  // 画面全体が まっ黒に なる。にじませる前に そういう 画素を 消し、明るすぎる 値も おさえる
  composer.addPass(new ShaderPass(SanitizeShader));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.6, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  smaa = new SMAAPass();
  composer.addPass(smaa);
  window.addEventListener('resize', resize);
  initEnv();
  return true;
}

// ---------- 空の色を まわりの 光として つかう (環境マップ) ----------
let pmrem = null, envRT = null;
const envScene = new THREE.Scene();
function initEnv() {
  pmrem = new THREE.PMREMGenerator(renderer);
  envScene.add(new THREE.Mesh(sky.geometry, skyMat));
}
/** 空の色が かわったら 呼ぶ (数秒に 1 回で じゅうぶん) */
export function updateEnv() {
  const old = envRT;
  envRT = pmrem.fromScene(envScene, 0.02, 0.1, 400);
  scene.environment = envRT.texture;
  old?.dispose();
}

export function setQuality(level) {
  const touch = matchMedia('(pointer: coarse)').matches;
  if (level === 'auto') level = touch ? 'mid' : 'high';
  Q.level = level;
  Q.post = level !== 'low';
  Q.ao = level === 'high';
  Q.dpr = level === 'high' ? 1.75 : level === 'mid' ? 1.5 : 1;
  Q.shadow = level === 'low' ? 1024 : level === 'mid' ? 2048 : 4096;
  Q.leaves = level !== 'low';
  gtao.enabled = Q.ao;
  sun.shadow.radius = level === 'low' ? 1 : 3;
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

export function passes() { return { gtao, bloom, grade, composer, smaa }; }   // テスト用
export function setBloom(strength, threshold = 0.85) { if (bloom) { bloom.strength = strength; bloom.threshold = threshold; } }

export function render() {
  if (Q.post) { gradeU.seed.value = (gradeU.seed.value + 0.37) % 10; composer.render(); }
  else renderer.render(scene, camera);
}

// ---------- カメラ (プレイヤーの うしろから見る) ----------
export const cam = { yaw: Math.PI, pitch: 0.42, dist: 11, cur: 11, target: new THREE.Vector3(), shake: 0, fixed: null, clip: null };
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
    // 建物が カメラを さえぎるときは 近づく (すぐ近づき、ゆっくり もどる)
    let d = cam.dist;
    if (cam.clip) {
      const y0 = cam.target.y + 1.6, y1 = cam.target.y + 1.4 + Math.sin(cam.pitch) * d;
      const t = cam.clip(cam.target.x, cam.target.z, cam.target.x + Math.sin(cam.yaw) * cp * d, cam.target.z + Math.cos(cam.yaw) * cp * d, y0, y1);
      if (t < 1) d = Math.max(2.2, d * t - 0.4);
    }
    // よるときは すばやく、もどるときは ゆっくり (どちらも なめらかに)
    cam.cur = cam.snap ? d : cam.cur + (d - cam.cur) * Math.min(1, dt * (d < cam.cur ? 14 : 2.5));
    camPos.set(cam.target.x + Math.sin(cam.yaw) * cp * cam.cur, cam.target.y + 1.4 + Math.sin(cam.pitch) * cam.cur,
      cam.target.z + Math.cos(cam.yaw) * cp * cam.cur);
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
  // 影の 範囲を 影の画素の 大きさ単位で 動かす (少しずつ ずれると 影のふちが ちらちらする)
  const texel = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
  lightBasis.lookAt(sunDir, ORIGIN, UP);
  lightInv.copy(lightBasis).invert();
  snapV.copy(cam.target).applyMatrix4(lightInv);
  snapV.x = Math.round(snapV.x / texel) * texel;
  snapV.y = Math.round(snapV.y / texel) * texel;
  snapV.applyMatrix4(lightBasis);
  sun.target.position.copy(snapV);
  sun.position.copy(snapV).addScaledVector(sunDir, 70);
  rim.target.position.copy(cam.target);
  rim.position.set(cam.target.x - sunDir.x * 40, cam.target.y + 25, cam.target.z - sunDir.z * 40);
}
export const sunDir = new THREE.Vector3(0.4, 1, 0.3).normalize();
const lightBasis = new THREE.Matrix4(), lightInv = new THREE.Matrix4(), snapV = new THREE.Vector3();
const ORIGIN = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

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
