// よるの ぼちの ガイコツたち: わきだし・うごき・こうげき・ガイコツ王・とびどうぐ・おとしもの。
import * as THREE from 'three';
import * as A from './assets.js';
import { Actor } from './actor.js';
import { G, SV, save } from './state.js';
import { ENEMY_TYPES, BOSS, BOSS_UNLOCK, CATALOG } from './data.js';
import { scene, cam } from './engine.js';
import { CEM, GRAVES, blocked } from './world.js';
import { sfx } from './audio.js';
import { burst, popText, ring } from './fx.js';
import { UI } from './ui.js';

const tmp = new THREE.Vector3();
const inCemetery = (p, pad = 0) => p.x > CEM.x0 - pad && p.x < CEM.x1 + pad && p.z > CEM.z0 - pad && p.z < CEM.z1 + pad;

class Skeleton extends Actor {
  constructor(type, x, z, { boss = false, rise = true } = {}) {
    const T = boss ? { ...ENEMY_TYPES.Skeleton_Warrior, ...BOSS, range: 3.2 } : ENEMY_TYPES[type];
    super(boss ? 'Skeleton_Warrior' : type, { scale: boss ? BOSS.scale : 1 });
    this.T = T;
    this.boss = boss;
    this.type = type;
    this.hp = this.maxHp = T.hp;
    this.alive = true;
    this.pos.set(x, 0, z);
    this.yaw = -Math.PI / 2 + (Math.random() - 0.5);
    this.cd = 1 + Math.random();
    this.wanderT = 0;
    this.goal = new THREE.Vector3(x, 0, z);
    if (T.weapon) this.attach('handslotr', T.weapon);
    if (T.shield) this.attach('handslotl', T.shield);
    if (boss) { this.attach('handslotl', 'Skeleton_Shield_Small_A'); this.summoned = 0; }
    this.state = rise ? 'rise' : 'idle';
    this.stateT = 0;
    if (rise) { this.play('Skeletons_Awaken_Floor', { once: true, speed: 1.3, fade: 0 }); sfx('rise'); }
    else this.play('Idle_Combat');
    burst(this.pos.clone().setY(0.3), 0x6b5a4a, 14, 2.5, { up: 3, life: 0.8 });
  }

  set(s) { this.state = s; this.stateT = 0; this.hitDone = false; }

  hurt(dmg, from, knock = 3, crit = false) {
    if (!this.alive || this.state === 'rise') return false;
    this.hp -= dmg;
    popText(this.pos.clone().setY(2.3 * this.scale), crit ? dmg + '!' : String(dmg), crit ? 'crit' : 'dmg');
    this.flash(0xffffff, 0.1);
    burst(this.pos.clone().setY(1.2 * this.scale), 0xf4ecd8, 8, 4, { life: 0.4 });
    sfx('bone');
    tmp.set(this.pos.x - from.x, 0, this.pos.z - from.z).normalize();
    if (this.hp <= 0) { this.die(true); return true; }
    const poise = this.boss ? 0.12 : this.type === 'Skeleton_Warrior' ? 0.18 : 0;
    if (dmg >= this.maxHp * poise) {
      this.knock = tmp.clone().multiplyScalar(knock * (this.boss ? 0.2 : 1));
      this.set('hurt');
      this.play('Hit_A', { once: true, restart: true, speed: 1.4 });
    }
    return true;
  }

  die(loot) {
    this.alive = false;
    this.set('dead');
    this.play(loot ? (Math.random() < 0.5 ? 'Death_A' : 'Death_B') : 'Death_C_Skeletons', { once: true, speed: 1.2 });
    sfx('die');
    burst(this.pos.clone().setY(1), 0xf4ecd8, 22, 5, { up: 4, life: 0.8 });
    if (!loot) return;
    SV.stats.kills++;
    const [a, b] = this.T.coins;
    dropLoot(this.pos, a + Math.floor(Math.random() * (b - a + 1)), this.boss ? 0 : 1 + (Math.random() < 0.4 ? 1 : 0), this.boss ? bossItem() : (Math.random() < 0.08 ? randomDecor() : null));
    if (this.boss) {
      SV.stats.boss++;
      G.boss = null;
      UI.boss(null);
      UI.toast('ガイコツ王を たおした!', 'big');
      cam.shake = 1;
    }
    save();
  }

  think(dt) {
    const p = G.player;
    this.stateT += dt;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    const hunting = p.state !== 'dead' && p.area === 'town' && (inCemetery(p.pos, 2) || (this.boss && dist < 14 && p.pos.x > 46));
    const T = this.T;
    switch (this.state) {
      case 'rise':
        if (this.stateT > 2.0) { this.set('idle'); this.play('Idle_Combat'); }
        break;
      case 'idle':
        this.wanderT -= dt;
        if (hunting && (dist < (this.boss ? 30 : 16))) { this.set('chase'); if (this.boss) { sfx('roar'); this.play('Taunt', { once: true }); this.stateT = -1.2; } break; }
        if (this.wanderT <= 0) {
          this.wanderT = 2 + Math.random() * 4;
          this.goal.set(CEM.x0 + 3 + Math.random() * (CEM.x1 - CEM.x0 - 6), 0, CEM.z0 + 2 + Math.random() * (CEM.z1 - CEM.z0 - 4));
        }
        this.walkTo(this.goal, T.speed * 0.4, dt, 'Walking_D_Skeletons');
        break;
      case 'chase': {
        if (this.stateT < 0) break;   // おうさまの さけび中
        if (!hunting) { this.set('idle'); break; }
        this.cd -= dt;
        if (T.kind === 'melee' || this.boss) {
          if (dist < T.range + 0.3 && this.cd <= 0) { this.attack(); break; }
          if (dist > T.range * 0.8) this.walkTo(p.pos, T.speed * (dist > 6 ? 1.15 : 0.9), dt, dist > 6 ? 'Running_C' : 'Walking_D_Skeletons');
          else { this.faceTo(dx, dz, dt); this.play('Idle_Combat'); }
        } else {
          const see = !blocked('town', this.pos.x, this.pos.z, p.pos.x, p.pos.z);
          if (dist < T.range && see && this.cd <= 0) { this.attack(); break; }
          if (dist > T.range * 0.85 || !see) this.walkTo(p.pos, T.speed, dt, 'Running_C');
          else if (dist < 5) { this.walkAway(p.pos, T.speed * 0.6, dt); }
          else { this.faceTo(dx, dz, dt); this.play('Idle_Combat'); }
        }
        break;
      }
      case 'attack':
        this.attackTick(dt, dist, dx, dz);
        break;
      case 'recover':
        this.play('Idle_Combat');
        this.faceTo(dx, dz, dt, 4);
        if (this.stateT > (this.boss ? 0.7 : 0.5 + Math.random() * 0.4)) this.set('chase');
        break;
      case 'hurt':
        if (this.knock) { this.move(this.knock.x * dt * 3, this.knock.z * dt * 3); this.knock.multiplyScalar(1 - dt * 8); }
        if (this.stateT > 0.4) this.set('chase');
        break;
      case 'dead':
        if (this.stateT > 1.8) this.pos.y -= dt * 0.9;
        break;
    }
    // ぼちの そとには でられない (ガイコツ王は 門の前まで)
    this.pos.x = Math.min(CEM.x1, Math.max(CEM.x0 + (this.boss ? -1 : 0.5), this.pos.x));
    this.pos.z = Math.min(CEM.z1, Math.max(CEM.z0, this.pos.z));
  }

  walkTo(target, speed, dt, anim) {
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.3) { this.play(this.boss ? 'Idle_Combat' : 'Idle'); return; }
    this.move(dx / d * speed * dt, dz / d * speed * dt);
    this.faceTo(dx, dz, dt, 8);
    this.play(anim, { speed: this.boss ? 0.75 : 1 });
  }
  walkAway(target, speed, dt) {
    const dx = this.pos.x - target.x, dz = this.pos.z - target.z, d = Math.hypot(dx, dz) || 1;
    this.move(dx / d * speed * dt, dz / d * speed * dt);
    this.faceTo(-dx, -dz, dt, 8);
    this.play('Walking_Backwards');
  }

  attack() {
    this.set('attack');
    const T = this.T;
    if (this.boss) {
      const k = this.hp / this.maxHp;
      if (this.summoned < 2 && k < (this.summoned === 0 ? 0.66 : 0.33)) { this.move_ = 'summon'; this.play('Spellcast_Summon', { once: true, speed: 1 }); UI.toast('ガイコツ王が なかまを よんだ!'); }
      else if (Math.random() < 0.4) { this.move_ = 'spin'; this.play('2H_Melee_Attack_Spin', { once: true, speed: 0.75 }); ring(this.pos, 4.2, 0.7); }
      else {
        this.move_ = 'slam';
        this.play('2H_Melee_Attack_Chop', { once: true, speed: 0.7 });
        this.slamAt = this.pos.clone().add(tmp.set(Math.sin(this.yaw) * 2.6, 0, Math.cos(this.yaw) * 2.6));
        ring(this.slamAt, 3.2, 0.85);
      }
      return;
    }
    this.play(T.attack, { once: true, restart: true, speed: T.kind === 'melee' ? 1.0 : 1.2 });
    this.flash(0xff6020, 0.18);   // こうげきの 合図
  }

  attackTick(dt, dist, dx, dz) {
    const p = G.player, T = this.T, k = this.progress();
    if (k < 0.3 && this.move_ !== 'spin') this.faceTo(dx, dz, dt, this.boss ? 2 : 6);
    if (this.boss) {
      if (this.move_ === 'summon') {
        if (k > 0.6 && !this.hitDone) {
          this.hitDone = true; this.summoned++;
          for (let i = 0; i < 3; i++) {
            const a = this.yaw + (i - 1) * 1.2;
            spawn('Skeleton_Minion', this.pos.x + Math.sin(a) * 3, this.pos.z + Math.cos(a) * 3);
          }
        }
      } else if (this.move_ === 'slam') {
        if (k > 0.5 && !this.hitDone) {
          this.hitDone = true;
          sfx('slam'); cam.shake = 0.9;
          burst(this.slamAt.clone().setY(0.2), 0x8a7a6a, 30, 6, { up: 4, life: 0.9 });
          if (Math.hypot(p.pos.x - this.slamAt.x, p.pos.z - this.slamAt.z) < 3.4) p.hurt(T.dmg, this.pos);
        }
      } else if (this.move_ === 'spin') {
        const hits = [0.35, 0.6].filter((h) => k > h).length;
        if (hits > (this.hitN || 0)) {
          this.hitN = hits; sfx('swing');
          if (dist < 4.4) p.hurt(Math.round(T.dmg * 0.7), this.pos);
        }
      }
      if (k > 0.95) { this.hitN = 0; this.cd = 1.2; this.set('recover'); }
      return;
    }
    const hitAt = T.kind === 'melee' ? 0.45 : 0.5;
    if (!this.hitDone && k > hitAt) {
      this.hitDone = true;
      if (T.kind === 'melee') {
        const front = (Math.sin(this.yaw) * dx + Math.cos(this.yaw) * dz) / (dist || 1);
        if (dist < T.range + 0.6 && front > 0.3) p.hurt(T.dmg, this.pos);
        sfx('swing');
      } else {
        const muzzle = this.pos.clone().setY(1.4).add(tmp.set(Math.sin(this.yaw) * 0.7, 0, Math.cos(this.yaw) * 0.7));
        if (T.kind === 'archer') { shoot('arrow', muzzle, this.yaw, { from: 'enemy', dmg: T.dmg, speed: 15 }); sfx('throw'); }
        else { shoot('orb', muzzle, this.yaw, { from: 'enemy', dmg: T.dmg, speed: 8, target: p, color: 0xb070ff }); sfx('magic'); }
      }
    }
    if (k > 0.92) { this.cd = T.kind === 'melee' ? 0.6 + Math.random() * 0.6 : 1.8 + Math.random(); this.set('recover'); }
  }
}

function bossItem() { return SV.inv.coffin_decorated || SV.house.some((f) => f.id === 'coffin_decorated') ? randomDecor() : 'coffin_decorated'; }
function randomDecor() { const d = CATALOG.filter((c) => c.drop && !c.boss); return d[Math.floor(Math.random() * d.length)].id; }

export function spawn(type, x, z, opts) {
  const e = new Skeleton(type, x, z, opts);
  G.enemies.push(e);
  return e;
}

// ---------- わきだしの ルール ----------
let spawnT = 0;
let wasNight = false;
export function updateEnemies(dt) {
  const night = SV.time >= 18.5 || SV.time < 5.5;
  const p = G.player;
  if (night && G.area === 'town') {
    spawnT -= dt;
    const alive = G.enemies.filter((e) => e.alive && !e.boss).length;
    const cap = Math.min(4 + SV.day, 10);
    if (spawnT <= 0 && alive < cap) {
      spawnT = 2.5 + Math.random() * 2;
      const spots = GRAVES.filter((g) => Math.hypot(g.x - p.pos.x, g.z - p.pos.z) > 8);
      const g = spots[Math.floor(Math.random() * spots.length)];
      if (g) {
        const r = Math.random(), d = SV.day;
        const type = r < 0.45 ? 'Skeleton_Minion' : r < 0.65 ? (d >= 2 ? 'Skeleton_Warrior' : 'Skeleton_Minion') : r < 0.83 ? 'Skeleton_Rogue' : (d >= 2 ? 'Skeleton_Mage' : 'Skeleton_Rogue');
        spawn(type, g.x, g.z);
      }
    }
    // ガイコツ王: たくさん たおしたあとの よる 0 時すぎ
    const late = SV.time >= 23.5 || SV.time < 4;
    if (late && !G.boss && SV.stats.kills >= BOSS_UNLOCK && G.bossNight !== SV.day) {
      G.bossNight = SV.day;
      G.boss = spawn('Skeleton_Warrior', 77, 0, { boss: true });
      UI.boss(G.boss);
      UI.toast('ぼちの おくで ガイコツ王が めざめた……!', 'big');
      sfx('roar');
    }
    if (inCemetery(p.pos) && !SV.stats.nightVisit) SV.stats.nightVisit = 1;
  }
  if (wasNight && !night) {
    // 朝に なると のこりの ガイコツは くずれる
    for (const e of G.enemies) if (e.alive) e.die(false);
    if (G.boss) { G.boss = null; UI.boss(null); }
  }
  wasNight = night;

  // おたがいに かさならない ように
  const list = G.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (!b.alive) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.radius + b.radius;
      if (d < m && d > 0.001) { const push = (m - d) / 2; a.pos.x -= dx / d * push; a.pos.z -= dz / d * push; b.pos.x += dx / d * push; b.pos.z += dz / d * push; }
    }
    const dx = p.pos.x - a.pos.x, dz = p.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.radius + p.radius;
    if (d < m && d > 0.001 && p.area === 'town') { a.pos.x -= dx / d * (m - d); a.pos.z -= dz / d * (m - d); }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    e.think(dt);
    e.update(dt);
    if (!e.alive && e.stateT > 3.2) { e.dispose(); list.splice(i, 1); }
  }
  updateProjectiles(dt);
  updateDrops(dt);
}

export function clearEnemies() {
  for (const e of G.enemies) e.dispose();
  G.enemies.length = 0;
  G.boss = null;
  UI.boss(null);
}

// ---------- とびどうぐ ----------
const orbGeo = new THREE.SphereGeometry(0.22, 12, 8);
export function shoot(kind, pos, yaw, { from, dmg, speed, target = null, splash = 0, color = 0x6fd3ff, small = false }) {
  const g = new THREE.Group();
  if (kind === 'arrow') { const a = A.prop('Skeleton_Arrow'); a.rotation.x = -Math.PI / 2; a.position.z = 0.3; g.add(a); }
  else if (kind === 'knife') { const a = A.prop('knife'); a.rotation.z = Math.PI / 2; g.add(a); g.userData.spin = true; }
  else { const m = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false })); m.scale.setScalar(small ? 0.8 : 1.4); g.add(m); }
  g.position.copy(pos);
  g.rotation.y = yaw;
  scene.add(g);
  G.projectiles.push({ g, kind, from, dmg: Math.round(dmg), vel: new THREE.Vector3(Math.sin(yaw) * speed, 0, Math.cos(yaw) * speed), life: 2.6, target, splash, color, speed });
}
function updateProjectiles(dt) {
  const p = G.player;
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const s = G.projectiles[i];
    s.life -= dt;
    if (s.target && (s.target.alive ?? true)) {
      tmp.set(s.target.pos.x - s.g.position.x, 0, s.target.pos.z - s.g.position.z).normalize().multiplyScalar(s.speed);
      s.vel.lerp(tmp, Math.min(1, dt * (s.from === 'enemy' ? 1.2 : 4)));
      s.g.rotation.y = Math.atan2(s.vel.x, s.vel.z);
    }
    s.g.position.addScaledVector(s.vel, dt);
    if (s.g.userData.spin) s.g.children[0].rotation.x += dt * 25;
    if (s.kind === 'orb' && Math.random() < 0.6) burst(s.g.position, s.color, 1, 0.4, { up: 0.3, grav: 0, life: 0.35 });
    let hit = false;
    if (s.from === 'player') {
      for (const e of G.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.pos.x - s.g.position.x, e.pos.z - s.g.position.z) < e.radius + 0.45) {
          e.hurt(s.dmg, s.g.position, 3);
          hit = true;
          break;
        }
      }
      if (hit && s.splash) {
        for (const e of G.enemies) if (e.alive && Math.hypot(e.pos.x - s.g.position.x, e.pos.z - s.g.position.z) < s.splash) e.hurt(Math.round(s.dmg * 0.5), s.g.position, 4);
        burst(s.g.position, s.color, 24, 6, { life: 0.5 });
      }
      if (hit) { sfx('hit'); cam.shake = Math.max(cam.shake, 0.25); }
    } else if (p.area === 'town' && Math.hypot(p.pos.x - s.g.position.x, p.pos.z - s.g.position.z) < 0.75) {
      hit = p.hurt(s.dmg, s.g.position) || p.state === 'dodge';
      if (p.state === 'dodge') hit = false;
    }
    if (hit || s.life <= 0) {
      if (s.kind === 'orb') burst(s.g.position, s.color, 10, 3, { life: 0.4 });
      scene.remove(s.g);
      G.projectiles.splice(i, 1);
    }
  }
}

// ---------- おとしもの (コイン・ほね・かざり) ----------
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0x7a5200, metalness: 0.6, roughness: 0.3 });
const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16).rotateX(Math.PI / 2);
function dropLoot(at, coins, bones, item) {
  const n = Math.min(coins, 8);
  for (let i = 0; i < n; i++) {
    const v = Math.floor(coins / n) + (i < coins % n ? 1 : 0);
    addDrop(new THREE.Mesh(coinGeo, coinMat), at, { coin: v });
  }
  for (let i = 0; i < bones; i++) { const b = A.prop('bone_A'); b.scale.setScalar(0.45); addDrop(b, at, { bone: 1 }); }
  if (item) { const o = A.prop(item); o.scale.setScalar(0.5); addDrop(o, at, { item }); }
}
function addDrop(obj, at, value) {
  obj.position.set(at.x, 1, at.z);
  scene.add(obj);
  const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 2;
  G.drops.push({ obj, value, vel: new THREE.Vector3(Math.cos(a) * s, 5 + Math.random() * 2, Math.sin(a) * s), t: 0 });
}
function updateDrops(dt) {
  const p = G.player;
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i];
    d.t += dt;
    const o = d.obj.position;
    const dist = Math.hypot(p.pos.x - o.x, p.pos.z - o.z);
    if (d.t > 0.6 && dist < 4 && p.area === 'town' && p.state !== 'dead') {
      // プレイヤーに すいよせられる
      tmp.set(p.pos.x - o.x, 1.2 - o.y, p.pos.z - o.z).normalize().multiplyScalar(14);
      d.vel.lerp(tmp, Math.min(1, dt * 8));
      o.addScaledVector(d.vel, dt);
      if (dist < 0.6) { collect(d.value); scene.remove(d.obj); G.drops.splice(i, 1); }
      continue;
    }
    d.vel.y -= 18 * dt;
    o.addScaledVector(d.vel, dt);
    if (o.y < 0.25) { o.y = 0.25; d.vel.y *= -0.35; d.vel.x *= 0.6; d.vel.z *= 0.6; }
    d.obj.rotation.y += dt * 3;
    if (d.t > 60) { scene.remove(d.obj); G.drops.splice(i, 1); }
  }
}
function collect(v) {
  if (v.coin) { SV.coins += v.coin; sfx('coin'); popText(G.player.pos.clone().setY(2.2), '+' + v.coin, 'coin'); }
  if (v.bone) { SV.bones += v.bone; sfx('pick'); }
  if (v.item) {
    SV.inv[v.item] = (SV.inv[v.item] || 0) + 1;
    sfx('quest');
    UI.toast(CATALOG.find((c) => c.id === v.item).name + ' を てに いれた! (いえに かざれるよ)');
  }
}
