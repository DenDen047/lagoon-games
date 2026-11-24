// キャラクター (プレイヤー・町の人・ガイコツ) の共通部分: 体・動き・持ち物・ぶつかり。
import * as THREE from 'three';
import * as A from './assets.js';
import { scene } from './engine.js';
import { resolve } from './world.js';

const ONCE = new Set(['Death_A', 'Death_B', 'Death_C_Skeletons', 'Sit_Chair_Down', 'Lie_Down', 'Skeletons_Awaken_Floor', 'Spawn_Ground_Skeletons']);

export class Actor {
  constructor(bodyName, { show = null, scale = 1, area = 'town' } = {}) {
    this.root = new THREE.Group();
    this.model = A.body(bodyName);
    this.model.scale.setScalar(scale);
    this.root.add(this.model);
    this.scale = scale;
    this.area = area;
    this.radius = 0.55 * scale;
    this.pos = this.root.position;
    this.yaw = 0;
    this.vel = new THREE.Vector3();
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = new Map();
    this.current = null;
    this.currentName = '';
    this.flashT = 0;
    this.mats = [];
    // 手や頭に つける もの (剣・盾・ぼうし) は show に あるものだけ見せる
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        this.mats.push(o.material);
      }
    });
    for (const slot of ['handslotr', 'handslotl', 'head', 'chest']) {
      const s = this.model.getObjectByName(slot);
      if (!s) continue;
      for (const c of s.children) if (!c.isBone) c.visible = !show || show.includes(c.name);
    }
    scene.add(this.root);
  }

  /** 素材パックの小物を 手に もたせる */
  attach(slot, propName, { rot = null, pos = null, scale = 1 } = {}) {
    const s = this.model.getObjectByName(slot);
    const p = A.prop(propName);
    if (rot) p.rotation.set(...rot);
    if (pos) p.position.set(...pos);
    p.scale.setScalar(scale);
    p.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); this.mats.push(o.material); } });
    s.add(p);
    return p;
  }

  action(name) {
    if (!this.actions.has(name)) {
      const clip = A.clips.get(name);
      if (!clip) return null;
      const a = this.mixer.clipAction(clip);
      if (ONCE.has(name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions.set(name, a);
    }
    return this.actions.get(name);
  }

  /** 動きを切りかえる。once=true なら 1 回だけ再生して最後で止まる */
  play(name, { fade = 0.18, speed = 1, once = false, restart = false } = {}) {
    if (this.currentName === name && !restart) { if (this.current) this.current.timeScale = speed; return this.current; }
    const a = this.action(name);
    if (!a) return null;
    if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    a.reset();
    a.timeScale = speed;
    a.enabled = true;
    a.setEffectiveWeight(1);
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    a.play();
    this.current = a;
    this.currentName = name;
    return a;
  }

  /** いま再生中の動きが どこまで進んだか (0〜1) */
  progress() {
    if (!this.current) return 1;
    return this.current.time / this.current.getClip().duration;
  }

  flash(color = 0xffffff, t = 0.12) {
    this.flashT = t;
    for (const m of this.mats) m.emissive?.set(color);
  }

  faceTo(x, z, dt, rate = 12) {
    const target = Math.atan2(x, z);
    let d = target - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * rate);
  }

  move(dx, dz) {
    this.pos.x += dx;
    this.pos.z += dz;
    resolve(this.pos, this.radius, this.area);
  }

  update(dt) {
    this.mixer.update(dt);
    this.root.rotation.y = this.yaw;
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) for (const m of this.mats) m.emissive?.set(0x000000);
    }
  }

  dispose() {
    scene.remove(this.root);
    this.mixer.stopAllAction();
    for (const m of this.mats) m.dispose();
  }
}
