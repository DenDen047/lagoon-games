// 空・太陽・環境光・霧を時刻から決める
import * as THREE from 'three';
import { Sky as SkyShader } from 'three/addons/objects/Sky.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.dome = new SkyShader();
    this.dome.scale.setScalar(5000);
    const u = this.dome.material.uniforms;
    u.turbidity.value = 4.5;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;
    scene.add(this.dome);
    // 夜空: 上は紺、地平線は街の明かりで少し赤茶色に光る
    this.nightDome = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
      // いちばん奥 (z = w) に描いて、カメラの描画距離の外でも消えないようにする
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform float uA; varying vec3 vP;
        void main(){ float h = clamp(vP.y, -0.1, 1.0);
          vec3 c = mix(vec3(0.16, 0.11, 0.09), vec3(0.012, 0.02, 0.05), smoothstep(0.0, 0.35, h));
          gl_FragColor = vec4(c, uA); }`,
    }));
    this.nightDome.renderOrder = -1;
    scene.add(this.nightDome);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(4096, 4096);
    s.camera.left = -170; s.camera.right = 170; s.camera.top = 170; s.camera.bottom = -170;
    s.camera.near = 10; s.camera.far = 900;
    s.bias = -0.0004; s.normalBias = 0.06;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x5a5048, 0.6);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xb8c6d4, 0.0026);

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envDome = new SkyShader();
    this.envDome.scale.setScalar(100);
    this.envScene.add(this.envDome);
    this.dir = new THREE.Vector3();
    this.night = 0;
  }

  setHour(h) {
    // 日の出 5:30、日の入り 18:30 ごろ。昼は南の空を通る
    const t = (h - 5.5) / 13; // 0..1 が昼
    const elev = Math.sin(t * Math.PI) * 58 - 4; // 度
    const az = 90 + t * 180; // 東 (90) → 南 (180) → 西 (270)
    const e = THREE.MathUtils.degToRad(elev), a = THREE.MathUtils.degToRad(az);
    // 北 = -z、東 = +x
    this.dir.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize();
    const u = this.dome.material.uniforms;
    u.sunPosition.value.copy(this.dir);
    this.envDome.material.uniforms.sunPosition.value.copy(this.dir);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) this.envDome.material.uniforms[k].value = u[k].value;

    const day = smooth(-6, 8, elev); // 0 = 夜、1 = 昼
    const golden = smooth(25, 3, elev) * smooth(-5, 2, elev); // 朝夕の赤み
    this.night = 1 - smooth(-5, 4, elev);
    const sunCol = new THREE.Color(1, 0.96, 0.9).lerp(new THREE.Color(1, 0.55, 0.28), golden);
    this.sun.color.copy(sunCol);
    this.sun.intensity = 4.4 * smooth(-3, 6, elev);
    this.hemi.intensity = 0.12 + 0.33 * day + 0.85 * this.night; // 夜も街の明かりで空がぼんやり明るい
    this.hemi.color.set(0xbfd6ff).lerp(new THREE.Color(0x3a4a78), this.night);
    this.hemi.groundColor.set(0x5a5048).lerp(new THREE.Color(0x3a2a20), this.night);
    this.nightDome.material.uniforms.uA.value = this.night;
    // 霧は地平線の色
    const fog = new THREE.Color(0xc4d2de).lerp(new THREE.Color(0xe0b494), golden).lerp(new THREE.Color(0x1a1612), this.night);
    this.scene.fog.color.copy(fog);
    this.renderer.toneMappingExposure = 0.55 + 0.25 * this.night;
    this.dome.visible = true;
    // 環境光 (反射) を作り直す
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 1, 1000);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.1 + 0.4 * day + 0.25 * this.night;
  }

  follow(p) {
    // 影は見ているあたりだけに落とす
    const snap = 4;
    const x = Math.round(p.x / snap) * snap, z = Math.round(p.z / snap) * snap;
    this.sun.target.position.set(x, 0, z);
    const d = this.dir.y > 0.05 ? this.dir : new THREE.Vector3(this.dir.x, 0.05, this.dir.z).normalize();
    this.sun.position.set(x + d.x * 400, d.y * 400, z + d.z * 400);
  }
}
