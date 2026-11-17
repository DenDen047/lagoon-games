/* MECH FRONTIER の描画エンジン。Three.js (WebGL2) の上に、ゲーム側が使う うすい窓口 R を のせている。
   - 質感: 物理ベースの材質 + 環境光の映りこみ + ACES トーンマッピング
   - 光: 太陽 (やわらかい影つき) + 空からの環境光。光るものは ブルーム (Unreal 由来) で にじむ
   - 軽さ: 箱・球・円柱・円すいを インスタンス描画でまとめる。動かない街は 区画ごとの 1 メッシュ。
           解像度は フレーム時間に合わせて自動で上下し、影の質も切りかえられる */
import * as THREE from 'three';
import { EffectComposer } from './lib/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './lib/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './lib/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './lib/three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from './lib/three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from './lib/three/addons/environments/RoomEnvironment.js';

const R = (() => {
  const MAXI = 8192;
  let cv, renderer, scene, camera, composer, grade, sun, hemi, sky, shN = -1, cw = 0, ch = 0;
  const bat = [[], [], [], []];      // [金属, つや消し, 自分で光る, 加算で光る][形]
  const NT = 6;                      // 形の数: 箱・球・円柱・円すい・カプセル・丸い箱
  let matte = 0;
  let glow = 0;
  const stack = new Float32Array(16 * 64); let sp = 0;
  const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) LIN[i] = Math.pow(i / 255, 2.2);
  const lin = (v) => Math.pow(Math.max(0, v), 2.2);
  const SU = { uNight: { value: 0 }, uTime: { value: 0 }, uRain: { value: 0 } };
  const api = { flash: 0, res: 1, shadowQ: 2, stats: { draws: 0, inst: 0 }, ok: false };
  const v3 = new THREE.Vector3();

  // ---------- 行列スタック (モデルを組み立てる) ----------
  function reset() { sp = 0; stack.fill(0, 0, 16); stack[0] = stack[5] = stack[10] = stack[15] = 1; }
  api.push = () => { stack.copyWithin(sp + 16, sp, sp + 16); sp += 16; };
  api.pop = () => { sp -= 16; };
  api.translate = (x, y, z) => {
    const m = stack, o = sp;
    m[o + 12] += m[o] * x + m[o + 4] * y + m[o + 8] * z; m[o + 13] += m[o + 1] * x + m[o + 5] * y + m[o + 9] * z; m[o + 14] += m[o + 2] * x + m[o + 6] * y + m[o + 10] * z;
  };
  api.scale = (x, y, z) => { const m = stack, o = sp; m[o] *= x; m[o + 1] *= x; m[o + 2] *= x; m[o + 4] *= y; m[o + 5] *= y; m[o + 6] *= y; m[o + 8] *= z; m[o + 9] *= z; m[o + 10] *= z; };
  function rot(a, i, j, sg) {
    const m = stack, c = Math.cos(a), s = Math.sin(a) * sg;
    for (let k = 0; k < 3; k++) { const p = m[sp + i + k], q = m[sp + j + k]; m[sp + i + k] = p * c + q * s; m[sp + j + k] = q * c - p * s; }
  }
  api.rotY = (a) => rot(a, 0, 8, -1);
  api.rotX = (a) => rot(a, 4, 8, 1);
  api.rotZ = (a) => rot(a, 0, 4, 1);
  api.glow = (g) => { glow = g ? 1 : 0; };
  api.matte = (m) => { matte = m ? 1 : 0; };     // 人・木・岩などの つや消しの材質

  /* 形を 1 こ 置く。type: 0 箱 / 1 球 / 2 円柱 / 3 円すい / 4 カプセル / 5 丸い箱。col は 0xRRGGBB、em は 光る強さ (0〜1)。 */
  api.prim = (type, x, y, z, sx, sy, sz, col, em) => {
    em = em || 0;
    const b = bat[glow ? 3 : em >= .45 ? 2 : matte][type]; if (b.n >= MAXI) return;
    const a = b.mat, o = b.n * 16, m = stack, s = sp;
    a[o] = m[s] * sx; a[o + 1] = m[s + 1] * sx; a[o + 2] = m[s + 2] * sx; a[o + 3] = 0;
    a[o + 4] = m[s + 4] * sy; a[o + 5] = m[s + 5] * sy; a[o + 6] = m[s + 6] * sy; a[o + 7] = 0;
    a[o + 8] = m[s + 8] * sz; a[o + 9] = m[s + 9] * sz; a[o + 10] = m[s + 10] * sz; a[o + 11] = 0;
    a[o + 12] = m[s + 12] + m[s] * x + m[s + 4] * y + m[s + 8] * z;
    a[o + 13] = m[s + 13] + m[s + 1] * x + m[s + 5] * y + m[s + 9] * z;
    a[o + 14] = m[s + 14] + m[s + 2] * x + m[s + 6] * y + m[s + 10] * z; a[o + 15] = 1;
    let r = LIN[col >> 16 & 255], g = LIN[col >> 8 & 255], bl = LIN[col & 255];
    const f = api.flash; if (f > 0) { r += (1 - r) * f; g += (1 - g) * f; bl += (1 - bl) * f; }
    const k = glow ? em * 1.6 : em >= .45 ? 1 + em * 2.2 : 1 + em * .8, c = b.col, q = b.n * 3;
    c[q] = r * k; c[q + 1] = g * k; c[q + 2] = bl * k;
    b.n++;
  };

  // ---------- 形の頂点 ----------
  /* 角を 面取りした 箱。bv が 面取りの幅 (0.5 が 半分)。法線を なめらかに つなぐので 丸く見える。 */
  function boxMesh(bv) {
    const v = [], h = .5, q = h - bv, S = [-1, 1];
    const P = (ax, sx, sy, sz) => {      // 角 (sx,sy,sz) の、ax 向きの面に のる 頂点
      const p = [sx * (ax === 0 ? h : q), sy * (ax === 1 ? h : q), sz * (ax === 2 ? h : q)], n = [0, 0, 0]; n[ax] = [sx, sy, sz][ax];
      return [p[0], p[1], p[2], n[0], n[1], n[2]];
    };
    const tri = (a, b, c) => v.push(...a, ...b, ...c), quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
    for (const s of S) {
      quad(P(0, s, -1, -1), P(0, s, 1, -1), P(0, s, 1, 1), P(0, s, -1, 1));
      quad(P(1, -1, s, -1), P(1, 1, s, -1), P(1, 1, s, 1), P(1, -1, s, 1));
      quad(P(2, -1, -1, s), P(2, 1, -1, s), P(2, 1, 1, s), P(2, -1, 1, s));
    }
    for (const a of S) for (const b of S) {
      quad(P(0, a, b, -1), P(0, a, b, 1), P(1, a, b, 1), P(1, a, b, -1));      // z に そった へり
      quad(P(0, a, -1, b), P(0, a, 1, b), P(2, a, 1, b), P(2, a, -1, b));      // y に そった へり
      quad(P(1, -1, a, b), P(1, 1, a, b), P(2, 1, a, b), P(2, -1, a, b));      // x に そった へり
      for (const c of S) tri(P(0, a, b, c), P(1, a, b, c), P(2, a, b, c));     // 角
    }
    return v;
  }
  function sphMesh(cap) {   // cap: 0 = 球、0.3 = まん中が 円柱の カプセル (上下の 丸みの 高さが 0.2)
    const v = [], LA = 12, LO = 18, rows = [];
    for (let i = 0; i <= LA; i++) { const t = i / LA * Math.PI; rows.push([Math.sin(t), Math.cos(t), t <= Math.PI / 2 + 1e-6 ? 1 : -1]); }
    if (cap) rows.splice(LA / 2 + 1, 0, [1, 0, -1]);
    const p = (r, j) => { const f = j / LO * Math.PI * 2, y = cap ? r[2] * cap + r[1] * (.5 - cap) : r[1] * .5; return [r[0] * Math.cos(f) * .5, y, r[0] * Math.sin(f) * .5, r[0] * Math.cos(f), r[1], r[0] * Math.sin(f)]; };
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < LO; j++) {
      const a = p(rows[i], j), b = p(rows[i + 1], j), c = p(rows[i + 1], j + 1), d = p(rows[i], j + 1);
      v.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
    return v;
  }
  function cylMesh(top) {   // top: 上の半径 (1 = 円柱, 0 = 円すい)
    const v = [], S = 20, sl = (1 - top) * .5;
    for (let j = 0; j < S; j++) {
      const f0 = j / S * Math.PI * 2, f1 = (j + 1) / S * Math.PI * 2;
      const c0 = Math.cos(f0), s0 = Math.sin(f0), c1 = Math.cos(f1), s1 = Math.sin(f1);
      const P = (c, s, y) => { const r = y > 0 ? top * .5 : .5; v.push(c * r, y, s * r, c, sl, s); };
      P(c0, s0, -.5); P(c1, s1, -.5); P(c1, s1, .5); P(c0, s0, -.5); P(c1, s1, .5); P(c0, s0, .5);
      v.push(0, -.5, 0, 0, -1, 0, c0 * .5, -.5, s0 * .5, 0, -1, 0, c1 * .5, -.5, s1 * .5, 0, -1, 0);
      if (top) v.push(0, .5, 0, 0, 1, 0, c0 * .5 * top, .5, s0 * .5 * top, 0, 1, 0, c1 * .5 * top, .5, s1 * .5 * top, 0, 1, 0);
    }
    return v;
  }

  function toGeo(v) {
    const n = v.length / 6, p = new Float32Array(n * 3), nr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = v[i * 6]; p[i * 3 + 1] = v[i * 6 + 1]; p[i * 3 + 2] = v[i * 6 + 2]; nr[i * 3] = v[i * 6 + 3]; nr[i * 3 + 1] = v[i * 6 + 4]; nr[i * 3 + 2] = v[i * 6 + 5]; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); return g;
  }

  // ---------- 動かない街の材質: 地面の模様・ビルの窓・店のガラスを シェーダーで描く ----------
  const GROUND = `vec3 ground(vec2 p){
  float n1=hash(floor(p*.6)), n2=hash(floor(p/7.))*.45+.27; vec2 q=p+(n2-.5)*5.;
  if(abs(p.x)<203.&&abs(p.y)<203.){
    vec3 c=vec3(.19,.2,.23)+n1*.02; vec2 d=abs(mod(p,56.)-28.);
    if(d.x<5.&&d.y>6.5&&d.y<9.5){ if(fract(p.x/1.4)<.5) c=vec3(.82); }
    else if(d.y<5.&&d.x>6.5&&d.x<9.5){ if(fract(p.y/1.4)<.5) c=vec3(.82); }
    else if((d.x<.2&&d.y>10.&&fract(p.y/7.)<.5)||(d.y<.2&&d.x>10.&&fract(p.x/7.)<.5)) c=vec3(.8,.78,.6);
    else if((abs(d.x-5.6)<.12&&d.y>6.)||(abs(d.y-5.6)<.12&&d.x>6.)) c=vec3(.7);
    return c; }
  if(p.x>236.&&p.x<624.&&p.y>-564.&&p.y<-124.){
    vec2 m=mod(p-vec2(240.,-560.),vec2(76.,72.)); vec2 d=min(m,vec2(76.,72.)-m);
    if(d.x<4.||d.y<4.){ vec3 c=vec3(.23,.24,.26)+n1*.02; if((d.x<.15&&d.y>5.&&fract(p.y/6.)<.5)||(d.y<.15&&d.x>5.&&fract(p.x/6.)<.5)) c=vec3(.75); return c; }
    if(d.x<5.6||d.y<5.6) return vec3(.62,.62,.6)+n1*.03;
    return vec3(.34,.6,.3)*(.92+n1*.1); }
  if(p.x>-604.&&p.x<-256.&&p.y>-624.&&p.y<-296.){
    float r=fract(p.x/3.); return mix(vec3(.36,.25,.16),vec3(.26,.18,.12),step(.5,r))*(.9+n1*.15); }
  if(p.x>226.&&p.x<660.&&abs(p.y)<82.){
    if(abs(p.y)<15.&&p.x>236.&&p.x<650.){ vec3 c=vec3(.16,.17,.19)+n1*.02;
      if(abs(p.y)<.4&&fract(p.x/14.)<.55) c=vec3(.9); if(abs(abs(p.y)-13.5)<.3) c=vec3(.9,.8,.3); return c; }
    return vec3(.52,.54,.56)+n1*.03; }
  float shore=762.+sin(p.y*.045)*7.;
  if(p.x>shore){ gWet=1.; float wv=sin(p.x*.35+uTime*1.3)*sin(p.y*.27+uTime*.9);
    vec3 c=mix(vec3(.16,.5,.62),vec3(.05,.24,.48),clamp((p.x-shore)/60.,0.,1.))+wv*.035;
    float foam=smoothstep(3.5,0.,p.x-shore-1.5-sin(uTime*.8+p.y*.2)*1.5); return mix(c,vec3(.92),foam*.7); }
  if(p.x>690.) return vec3(.86,.78,.58)*(.93+n1*.08);
  if(q.y>232.) return vec3(.62,.51,.35)*(.9+n1*.12+n2*.1);
  if(q.y<-232.&&abs(q.x)<150.) return vec3(.36,.3,.25)*(.85+n1*.2);
  if(q.x<-232.) return vec3(.42,.46,.42)*(.85+n1*.15+n2*.1);
  return vec3(.3,.52,.27)*(.85+n1*.14+n2*.12);
}
`;
  function staticMaterial() {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: 0 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = SU.uNight; sh.uniforms.uTime = SU.uTime; sh.uniforms.uRain = SU.uRain;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aMat; varying float vMat; varying vec3 vWp; varying vec3 vOn;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vWp = (modelMatrix * vec4(transformed, 1.)).xyz; vOn = normal;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying float vMat; varying vec3 vWp; varying vec3 vOn; uniform float uNight, uTime, uRain; float gWet = 0.;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
${GROUND}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
float cEm = 0., cGl = 0.;
if (vMat > 2.5) { diffuseColor.rgb = pow(ground(vWp.xz), vec3(2.2)); cGl = max(gWet, uRain * .75); diffuseColor.rgb *= 1. - uRain * .35; }
else if (vMat > 1.5) { cEm = .5 + 1.5 * uNight; }
else if (vMat > .5) {
  vec3 n = normalize(vOn);
  if (abs(n.y) < .5 && vWp.y < 4.4 && vWp.y > .25) {
    float u = abs(n.x) > .5 ? vWp.z : vWp.x; float fx = fract(u / 5.); float sh = hash(floor(vec2(u / 5., 7.)) + floor(n.xz * 3.) * 31.);
    if (vWp.y > 3.5) { vec3 a = mix(vec3(.75,.2,.2), vec3(.15,.4,.7), step(.5, sh)) * (fract(u) < .5 ? 1. : .8); if (sh > .8) a = vec3(.9,.7,.2); diffuseColor.rgb = pow(a, vec3(2.2)); }
    else if (fx > .08 && fx < .92 && vWp.y > .9) { float lit = uNight * step(.25, sh); diffuseColor.rgb = mix(vec3(.02,.04,.07), vec3(1.,.8,.5), lit * .85); cEm = lit * .8; cGl = 1. - lit; }
    else diffuseColor.rgb *= .5;
  } else if (abs(n.y) < .5 && vWp.y > 4.8) {
    float u = abs(n.x) > .5 ? vWp.z : vWp.x; vec2 g = vec2(u / 3., vWp.y / 3.2); vec2 f = fract(g); vec2 cell = floor(g) + floor(n.xz * 3.) * 17.;
    if (f.x > .16 && f.x < .84 && f.y > .28 && f.y < .8) { float h = hash(cell); float lit = step(.5, h) * uNight;
      diffuseColor.rgb = mix(vec3(.03,.06,.11), vec3(1.,.72,.36) * (.7 + .3 * hash(cell + 3.)), lit); cEm = lit * .9; cGl = 1. - lit; }
  }
}`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .12, cGl);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, .55, cGl);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * cEm;');
    };
    return m;
  }
  const SKY_FS = `varying vec3 vDir; uniform vec3 uSun,uMoon,uTop,uHor,uSunCol; uniform float uNight,uTime;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
void main(){
  vec3 d=normalize(vDir); float h=max(d.y,0.); vec3 c=mix(uHor,uTop,pow(h,.55));
  float s=max(dot(d,uSun),0.); c+=uSunCol*(pow(s,900.)*14.+pow(s,10.)*.22);
  float m=max(dot(d,uMoon),0.); c+=vec3(.8,.85,1.)*pow(m,2500.)*6.*uNight;
  if(d.y>0.){
    vec2 st=floor(d.xz/(d.y+.4)*160.); c+=step(.996,hash(st))*uNight*smoothstep(0.,.3,d.y)*1.6;
    vec2 q=d.xz/(d.y+.08)*1.4+uTime*.006; float cl=noise(q)*.55+noise(q*2.3)*.3+noise(q*5.1)*.15;
    cl=smoothstep(.52,.78,cl)*smoothstep(.0,.22,d.y);
    c=mix(c,mix(vec3(1.),uHor,.35)*(1.-uNight*.82)+uSunCol*.08,cl*.85);
  }
  gl_FragColor=vec4(pow(c,vec3(2.2)),1.);
}`;

  api.init = (canvas) => {
    cv = canvas;
    try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' }); } catch (e) { return false; }
    if (!renderer.capabilities.isWebGL2) return false;
    renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x8090a0, .0013);
    camera = new THREE.PerspectiveCamera(60, 1, .5, 3600);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
    sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; sun.shadow.bias = -.0006; sun.shadow.normalBias = .09;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 900; scene.add(sun); scene.add(sun.target);
    hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
    const geos = [boxMesh(.06), sphMesh(0), cylMesh(1), cylMesh(0), sphMesh(.3), boxMesh(.2)].map(toGeo);
    /* 輪郭に 空の色の光が 回る (リムライト)。カートゥーン調の 立体感を出す。 */
    const rim = (m, k) => { m.onBeforeCompile = (sh) => { sh.uniforms.uNight = SU.uNight; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n{ float rm = pow(1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), 3.); totalEmissiveRadiance += min(diffuseColor.rgb * 1.6 + .015, vec3(.5)) * vec3(.8, .9, 1.) * rm * ${k} * (1. - uNight * .8) * (.3 + .7 * clamp(normal.y * .5 + .6, 0., 1.)); }`); }; return m; };
    const mats = [
      rim(new THREE.MeshStandardMaterial({ roughness: .42, metalness: .3, side: THREE.DoubleSide }), '.4'),
      rim(new THREE.MeshStandardMaterial({ roughness: .78, metalness: 0, side: THREE.DoubleSide }), '.42'),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    ];
    for (let k = 0; k < 4; k++) for (let t = 0; t < NT; t++) {
      const mesh = new THREE.InstancedMesh(geos[t], mats[k], MAXI);
      mesh.setColorAt(0, new THREE.Color(1, 1, 1)); mesh.frustumCulled = false; mesh.castShadow = k < 2; mesh.receiveShadow = k < 2; mesh.count = 0; mesh.renderOrder = k === 3 ? 10 : 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh); bat[k][t] = { mesh, mat: mesh.instanceMatrix.array, col: mesh.instanceColor.array, n: 0 };
    }
    sky = new THREE.Mesh(geos[1], new THREE.ShaderMaterial({
      side: THREE.DoubleSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { uSun: { value: new THREE.Vector3() }, uMoon: { value: new THREE.Vector3() }, uTop: { value: new THREE.Vector3() }, uHor: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Vector3() }, uNight: SU.uNight, uTime: SU.uTime },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }', fragmentShader: SKY_FS,
    }));
    sky.scale.setScalar(4000); sky.renderOrder = -100; sky.frustumCulled = false; scene.add(sky);
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), .3, .5, 1.05));
    grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uSat: { value: 1.14 }, uVig: { value: .55 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float uSat, uVig; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(.2126, .7152, .0722)); c.rgb = max(mix(vec3(l), c.rgb, uSat), 0.); vec2 d = vUv - .5; c.rgb *= 1. - dot(d, d) * uVig; gl_FragColor = c; }' });
    composer.addPass(grade);      // 色を あざやかにし、画面の はしを すこし 暗くする
    composer.addPass(new OutputPass());
    api.ok = true; reset();
    return true;
  };

  /* 動かない地形を 1 区画ぶん 登録する。data は [位置3, 法線3, 色3, 材質1] の並び。 */
  let smat = null;
  api.addStatic = (data, box) => {
    const n = data.length / 10, p = new Float32Array(n * 3), nr = new Float32Array(n * 3), c = new Float32Array(n * 3), mt = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const o = i * 10;
      p[i * 3] = data[o]; p[i * 3 + 1] = data[o + 1]; p[i * 3 + 2] = data[o + 2]; nr[i * 3] = data[o + 3]; nr[i * 3 + 1] = data[o + 4]; nr[i * 3 + 2] = data[o + 5];
      c[i * 3] = lin(data[o + 6]); c[i * 3 + 1] = lin(data[o + 7]); c[i * 3 + 2] = lin(data[o + 8]); mt[i] = data[o + 9];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aMat', new THREE.BufferAttribute(mt, 1));
    g.boundingBox = new THREE.Box3(new THREE.Vector3(box[0], box[1], box[2]), new THREE.Vector3(box[3], box[4], box[5]));
    g.boundingSphere = new THREE.Sphere(); g.boundingBox.getBoundingSphere(g.boundingSphere);
    const mesh = new THREE.Mesh(g, smat || (smat = staticMaterial())); mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; scene.add(mesh);
  };

  api.begin = () => { reset(); glow = 0; matte = 0; api.flash = 0; for (const g of bat) for (const b of g) b.n = 0; };

  /* cam: {ex,ey,ez,tx,ty,tz,fov,shadowR}  env: 光と空の色 (game.js の environment()) */
  api.render = (cam, env) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * api.res;
    const w = Math.max(2, Math.round(cv.clientWidth * dpr)), h = Math.max(2, Math.round(cv.clientHeight * dpr));
    if (w !== cw || h !== ch) { cw = w; ch = h; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; }
    camera.fov = cam.fov * 180 / Math.PI; camera.position.set(cam.ex, cam.ey, cam.ez); camera.lookAt(cam.tx, cam.ty, cam.tz); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    api.stats.inst = 0;
    for (const g of bat) for (const b of g) {
      const m = b.mesh; m.count = b.n; m.visible = b.n > 0; api.stats.inst += b.n; if (!b.n) continue;
      m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, b.n * 16); m.instanceMatrix.needsUpdate = true;
      m.instanceColor.clearUpdateRanges(); m.instanceColor.addUpdateRange(0, b.n * 3); m.instanceColor.needsUpdate = true;
    }
    // 光
    const lc = env.lightCol, li = Math.max(lc[0], lc[1], lc[2], .0001);
    sun.color.setRGB(lin(lc[0] / li), lin(lc[1] / li), lin(lc[2] / li)); sun.intensity = li * 3.4;
    hemi.color.setRGB(lin(env.ambS[0]), lin(env.ambS[1]), lin(env.ambS[2])); hemi.groundColor.setRGB(lin(env.ambG[0]), lin(env.ambG[1]), lin(env.ambG[2])); hemi.intensity = 2.6 + 3.4 * env.night;
    scene.environmentIntensity = .05 + .3 * (1 - env.night);
    scene.fog.color.setRGB(lin(env.hor[0]), lin(env.hor[1]), lin(env.hor[2]));
    const n = api.shadowQ === 2 ? 2048 : api.shadowQ === 1 ? 1024 : 0, on = n > 0 && li > .01;
    if (n !== shN) { shN = n; if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } if (n) sun.shadow.mapSize.set(n, n); }
    sun.castShadow = on;
    const L = cam.shadowR || 90, lx = env.lx, ly = env.ly, lz = env.lz, sc = sun.shadow.camera;
    if (sc.right !== L) { sc.left = -L; sc.right = L; sc.top = L; sc.bottom = -L; sc.updateProjectionMatrix(); }
    let fx = cam.tx, fy = cam.ty, fz = cam.tz;
    if (n) {   // 影が ちらつかないよう、影の 1 画素ぶんの 刻みに そろえる
      let rx = lz, rz = -lx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      const ux = -rz * ly, uy = rz * lx - rx * lz, uz = rx * ly, tex = 2 * L / n;
      const pr = fx * rx + fz * rz, pu = fx * ux + fy * uy + fz * uz, dr = Math.round(pr / tex) * tex - pr, du = Math.round(pu / tex) * tex - pu;
      fx += rx * dr + ux * du; fy += uy * du; fz += rz * dr + uz * du;
    }
    sun.target.position.set(fx, fy, fz); sun.position.set(fx + lx * 400, fy + ly * 400, fz + lz * 400); sun.target.updateMatrixWorld();
    // 空
    SU.uNight.value = env.night; SU.uTime.value = env.time; SU.uRain.value = env.rain || 0; scene.fog.density = .0013 + .0022 * (env.rain || 0);
    const u = sky.material.uniforms; u.uSun.value.fromArray(env.sun); u.uMoon.value.fromArray(env.moon); u.uTop.value.fromArray(env.top); u.uHor.value.fromArray(env.hor); u.uSunCol.value.fromArray(env.sunCol);
    sky.position.copy(camera.position);
    composer.render();
    api.stats.draws = renderer.info.render.calls;
  };

  /* 世界の点を 画面の位置 (CSS ピクセル) に直す。うしろ側なら null。 */
  api.project = (x, y, z) => {
    v3.set(x, y, z).applyMatrix4(camera.matrixWorldInverse); if (v3.z > -.1) return null;
    const w = -v3.z; v3.applyMatrix4(camera.projectionMatrix);
    return { x: (v3.x * .5 + .5) * cv.clientWidth, y: (.5 - v3.y * .5) * cv.clientHeight, w };
  };
  return api;
})();
window.R = R;
window.boot();
