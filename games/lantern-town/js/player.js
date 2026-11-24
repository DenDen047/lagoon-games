// プレイヤー: いどう・こうげき (3 れんげき)・ガード・回避・ひっさつわざ・すわる・ねる・ものを もつ。
import * as THREE from 'three';
import { Actor } from './actor.js';
import { G, SV, maxHp } from './state.js';
import { HERO_CLASSES, WEAPON_LV, STEW } from './data.js';
import { I } from './input.js';
import { cam } from './engine.js';
import { INTERACT, DUMMIES } from './world.js';
import { sfx } from './audio.js';
import { burst, popText } from './fx.js';
import { shoot } from './enemies.js';

const tmp = new THREE.Vector3();

export class Player extends Actor {
  constructor(hero) {
    const C = HERO_CLASSES[hero];
    super(hero, { show: C.show });
    this.C = C;
    this.hero = hero;
    this.state = 'move';
    this.stateT = 0;
    this.combo = 0;
    this.queued = false;
    this.hitDone = false;
    this.inv = 0;            // むてき時間
    this.skillCd = 0;
    this.dodgeCd = 0;
    this.held = null;
    this.heldObj = null;
    this.seat = null;
    this.speedNow = 0;
    this.dodgeDir = new THREE.Vector3();
    this.hitstop = 0;
    this.chopping = false;
    this.armedItems = [];
    for (const slot of ['handslotr', 'handslotl']) {
      const s = this.model.getObjectByName(slot);
      if (s) for (const c of s.children) if (c.visible) this.armedItems.push(c);
    }
    this.play('Idle');
  }

  get dmg() { return this.C.dmg * WEAPON_LV[SV.weaponLv].mul; }

  setArmed(on) { for (const o of this.armedItems) o.visible = on; }

  /** 手に ものを もつ (バーガー屋)。null で 手を あける */
  hold(id, obj = null) {
    if (this.heldObj) { this.root.remove(this.heldObj); this.heldObj = null; }
    this.held = id;
    if (obj) { obj.position.set(0, 1.35, 0.62); this.root.add(obj); this.heldObj = obj; }
  }

  teleport(area, x, z, yaw = 0) {
    this.area = area;
    this.pos.set(x, 0, z);
    this.yaw = yaw;
    this.state = 'move';
    this.seat = null;
    this.play('Idle', { fade: 0 });
    this.setArmed(area === 'town');
  }

  set(state) { this.state = state; this.stateT = 0; this.hitDone = false; }

  // ---------- ダメージを うける ----------
  hurt(dmg, from) {
    if (this.state === 'dead' || this.inv > 0 || this.state === 'sleep') return false;
    if (this.state === 'dodge') return false;
    if (this.state === 'block') {
      tmp.set(from.x - this.pos.x, 0, from.z - this.pos.z).normalize();
      const front = Math.sin(this.yaw) * tmp.x + Math.cos(this.yaw) * tmp.z;
      if (front > 0.2) {
        dmg = Math.round(dmg * (1 - this.C.guard));
        this.play('Block_Hit', { once: true, restart: true, speed: 1.4 });
        sfx('block');
        burst(this.pos.clone().setY(1.3).addScaledVector(tmp, 0.6), 0xbfe0ff, 10, 4, { life: 0.3 });
        this.blockHitT = 0.35;
        if (dmg <= 0) return true;
      }
    }
    SV.hp = Math.max(0, SV.hp - dmg);
    popText(this.pos.clone().setY(2.4), '-' + dmg, 'hurt');
    this.flash(0xff3030, 0.15);
    cam.shake = Math.max(cam.shake, 0.5);
    sfx('hurt');
    if (this.state === 'sit') this.seat = null;
    if (SV.hp <= 0) {
      this.set('dead');
      this.play('Death_A', { once: true });
      return true;
    }
    if (this.state !== 'block') {
      this.set('hurt');
      this.play(Math.random() < 0.5 ? 'Hit_A' : 'Hit_B', { once: true, restart: true, speed: 1.3 });
      tmp.set(this.pos.x - from.x, 0, this.pos.z - from.z).normalize();
      this.knock = tmp.clone().multiplyScalar(5);
    }
    this.inv = 0.5;
    return true;
  }

  // ---------- まわりの 敵を さがす ----------
  nearestTarget(maxD, cone = -0.2) {
    let best = null, bd = maxD;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const list = [...G.enemies.filter((e) => e.alive), ...(G.area === 'town' ? DUMMIES : [])];
    for (const e of list) {
      const p = e.pos || e;
      const dx = p.x - this.pos.x, dz = p.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) / (d || 1) > cone) { bd = d; best = e; }
    }
    return best;
  }

  /** 前の 扇形に いる 敵に ダメージ */
  strike(range, arc, mul, knock = 3) {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let any = false;
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > range + e.radius || (dx * fx + dz * fz) / (d || 1) < arc) continue;
      const crit = Math.random() < 0.12;
      const dmg = Math.round(this.dmg * mul * (0.9 + Math.random() * 0.2) * (crit ? 1.5 : 1));
      if (e.hurt(dmg, this.pos, knock, crit)) any = true;
    }
    if (G.area === 'town') {
      for (const d of DUMMIES) {
        const dx = d.x - this.pos.x, dz = d.z - this.pos.z, dist = Math.hypot(dx, dz);
        if (dist > range + 0.7 || (dx * fx + dz * fz) / (dist || 1) < arc) continue;
        d.wob = 1;
        d.dir = Math.atan2(dx, dz);
        const dmg = Math.round(this.dmg * mul);
        popText(new THREE.Vector3(d.x, 2.2, d.z), String(dmg), 'dmg');
        burst(new THREE.Vector3(d.x, 1.4, d.z), 0xf3d28a, 8, 3, { life: 0.4 });
        SV.stats.dummy++;
        any = true;
      }
    }
    if (any) { sfx('hit'); this.hitstop = 0.06; cam.shake = Math.max(cam.shake, 0.3); }
    return any;
  }

  aim() {
    const t = this.nearestTarget(6, -0.5);
    if (t) { const p = t.pos || t; this.yaw = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }
    return t;
  }

  startAttack() {
    this.set('attack');
    this.aim();
    const anim = this.C.combo[this.combo];
    this.play(anim, { once: true, restart: true, speed: 1.25 * (this.C.atkSpeed || 1), fade: 0.08 });
    this.queued = false;
    sfx('swing');
  }

  useSkill() {
    const id = this.C.skill.id;
    this.skillCd = this.C.skill.cd;
    this.set('skill');
    this.aim();
    const anim = { bash: 'Block_Attack', spin: '2H_Melee_Attack_Spin', bolt: 'Spellcast_Shoot', knives: 'Throw' }[id];
    this.play(anim, { once: true, restart: true, speed: id === 'spin' ? 1.1 : 1.3, fade: 0.08 });
    this.skillHits = 0;
  }

  skillTick() {
    const id = this.C.skill.id, k = this.progress();
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    if (id === 'bash') {
      if (k < 0.45) this.move(fx * 12 * G.dt, fz * 12 * G.dt);
      if (k > 0.3 && this.skillHits === 0) { this.skillHits = 1; this.strike(2.6, 0.2, 2.0, 9); burst(this.pos.clone().setY(1.2).addScaledVector(tmp.set(fx, 0, fz), 1.2), 0xcfe8ff, 16, 5, { life: 0.4 }); }
    } else if (id === 'spin') {
      if (k > 0.25 && this.skillHits === 0) { this.skillHits = 1; this.strike(3.4, -1.1, 1.4, 6); burst(this.pos.clone().setY(1), 0xffe1a0, 20, 7, { up: 1, life: 0.4 }); }
      if (k > 0.55 && this.skillHits === 1) { this.skillHits = 2; this.strike(3.4, -1.1, 1.4, 6); burst(this.pos.clone().setY(1), 0xffe1a0, 20, 7, { up: 1, life: 0.4 }); }
    } else if (id === 'bolt') {
      if (k > 0.35 && this.skillHits === 0) {
        this.skillHits = 1;
        const t = this.nearestTarget(20, 0.3);
        shoot('orb', this.pos.clone().setY(1.5).addScaledVector(tmp.set(fx, 0, fz), 0.8), this.yaw, { from: 'player', dmg: this.dmg * 2.4, speed: 15, target: t?.alive ? t : null, splash: 2.4 });
        sfx('magic');
      }
    } else if (id === 'knives') {
      if (k > 0.4 && this.skillHits === 0) {
        this.skillHits = 1;
        for (const a of [-0.22, 0, 0.22]) shoot('knife', this.pos.clone().setY(1.4), this.yaw + a, { from: 'player', dmg: this.dmg * 1.5, speed: 22 });
        sfx('throw');
      }
    }
    if (k >= 0.95) this.set('move');
  }

  sit(seat) {
    if (!seat || this.state !== 'move') return;
    this.seat = seat;
    seat.used = this;
    this.pos.set(seat.x, seat.y || 0, seat.z);
    this.yaw = seat.yaw;
    this.set('sit');
    this.play('Sit_Chair_Down', { once: true });
    SV.stats.sat++;
  }
  standUp() {
    if (this.seat) this.seat.used = null;
    this.seat = null;
    this.pos.y = 0;
    this.set('stand');
    this.play('Sit_Chair_StandUp', { once: true, speed: 1.4 });
  }
  lieDown(bed) {
    this.pos.set(bed.x, 0.62, bed.z);
    this.yaw = bed.yaw + Math.PI;
    this.set('sleep');
    this.play('Lie_Down', { once: true });
  }
  wake() {
    this.pos.y = 0;
    this.set('stand');
    this.play('Lie_StandUp', { once: true, speed: 1.3 });
    this.pos.x += Math.cos(this.yaw) * 1.6;
    this.pos.z -= Math.sin(this.yaw) * 1.6;
  }

  eat() {
    if (SV.stew <= 0) { sfx('fail'); return 'none'; }
    if (SV.hp >= maxHp()) return 'full';
    SV.stew--;
    SV.hp = Math.min(maxHp(), SV.hp + STEW.heal);
    this.set('eat');
    this.play('Use_Item', { once: true, speed: 1.4 });
    popText(this.pos.clone().setY(2.5), '+' + STEW.heal, 'heal');
    burst(this.pos.clone().setY(1.2), 0x8cff9a, 16, 2, { up: 3, grav: -1, life: 0.8 });
    sfx('pick');
    return 'ok';
  }

  // ---------- まいフレーム ----------
  tick(dt, busy) {
    this.inv = Math.max(0, this.inv - dt);
    this.skillCd = Math.max(0, this.skillCd - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.blockHitT = Math.max(0, (this.blockHitT || 0) - dt);
    this.stateT += dt;
    if (this.hitstop > 0) { this.hitstop -= dt; dt *= 0.05; }

    // カメラから見た いどう方向
    const yawRef = cam.fixed ? 0 : cam.yaw;
    const mx = I.move.x, mz = I.move.z;
    const wx = Math.cos(yawRef) * mx + Math.sin(yawRef) * mz;
    const wz = -Math.sin(yawRef) * mx + Math.cos(yawRef) * mz;
    const moving = I.move.mag > 0.12 && !busy;
    const armed = this.area === 'town' && !this.held;
    const st = this.state;

    if (st === 'dead') { this.update(dt); return; }
    if (st === 'sit') {
      if (this.stateT > 0.9 && this.currentName === 'Sit_Chair_Down') this.play('Sit_Chair_Idle');
      if (!busy && this.stateT > 0.6 && (moving || I.pressed('interact') || I.pressed('attack'))) this.standUp();
      this.update(dt); return;
    }
    if (st === 'sleep') {
      if (this.stateT > 1.4 && this.currentName === 'Lie_Down') this.play('Lie_Idle');
      this.update(dt); return;
    }
    if (st === 'stand' || st === 'eat') {
      if (this.stateT > (st === 'eat' ? 0.9 : 0.8)) this.set('move');
      this.update(dt); return;
    }
    if (st === 'hurt') {
      if (this.knock) { this.move(this.knock.x * dt, this.knock.z * dt); this.knock.multiplyScalar(1 - dt * 6); }
      if (this.stateT > 0.38) { this.set('move'); this.knock = null; }
      this.update(dt); return;
    }
    if (st === 'dodge') {
      const k = Math.min(1, this.stateT / 0.48);
      const sp = 13 * (1 - k * k);
      this.move(this.dodgeDir.x * sp * dt, this.dodgeDir.z * sp * dt);
      if (this.stateT > 0.5) this.set('move');
      this.update(dt); return;
    }
    if (st === 'attack') {
      const k = this.progress();
      if (moving) this.move(wx * 1.2 * dt, wz * 1.2 * dt);
      else if (k < 0.35) this.move(Math.sin(this.yaw) * 2.2 * dt, Math.cos(this.yaw) * 2.2 * dt);
      if (I.pressed('attack')) this.queued = true;
      const hitAt = this.C.combo[this.combo] === 'Spellcast_Shoot' ? 0.4 : 0.36;
      if (!this.hitDone && k > hitAt) {
        this.hitDone = true;
        if (this.C.combo[this.combo] === 'Spellcast_Shoot') {
          const t = this.nearestTarget(16, 0.4);
          shoot('orb', this.pos.clone().setY(1.5), this.yaw, { from: 'player', dmg: this.dmg * 1.3, speed: 16, target: t?.alive ? t : null, small: true });
          sfx('magic');
        } else {
          this.strike(this.hero === 'Barbarian' ? 2.7 : 2.3, 0.3, [1, 1.1, 1.6][this.combo], this.combo === 2 ? 6 : 2.5);
        }
      }
      if (k > 0.55 && this.queued && this.combo < 2) { this.combo++; this.startAttack(); }
      else if (k > 0.82) { this.combo = 0; this.set('move'); }
      if (I.pressed('dodge') && this.dodgeCd <= 0 && k > 0.3) this.startDodge(moving ? wx : Math.sin(this.yaw), moving ? wz : Math.cos(this.yaw));
      this.update(dt); return;
    }
    if (st === 'skill') { this.skillTick(); this.update(dt); return; }

    // ---- ふつうの 状態 (move / block) ----
    if (!busy && armed) {
      if (I.pressed('attack')) { this.combo = 0; this.startAttack(); this.update(dt); return; }
      if (I.pressed('skill') && this.skillCd <= 0) { this.useSkill(); this.update(dt); return; }
      if (I.pressed('dodge') && this.dodgeCd <= 0) { this.startDodge(moving ? wx : Math.sin(this.yaw), moving ? wz : Math.cos(this.yaw)); this.update(dt); return; }
    }
    const blocking = !busy && armed && I.held('block');
    this.state = blocking ? 'block' : 'move';
    const target = moving ? this.C.speed * (blocking ? 0.35 : I.move.mag < 0.6 ? 0.45 : 1) : 0;
    this.speedNow += (target - this.speedNow) * Math.min(1, dt * 12);
    if (this.speedNow > 0.05) {
      const dx = (moving ? wx : Math.sin(this.yaw)) * this.speedNow * dt, dz = (moving ? wz : Math.cos(this.yaw)) * this.speedNow * dt;
      const ox = this.pos.x, oz = this.pos.z;
      this.move(dx, dz);
      SV.stats.walk += Math.hypot(this.pos.x - ox, this.pos.z - oz);
      if (moving && !blocking) this.faceTo(wx, wz, dt);
    }
    if (blocking) {
      if (this.blockHitT <= 0) this.play('Blocking', { fade: 0.1 });
      const t = this.nearestTarget(8, -1);
      if (t) { const p = t.pos || t; this.faceTo(p.x - this.pos.x, p.z - this.pos.z, dt, 8); }
    } else if (this.chopping) this.play('Interact');
    else if (this.speedNow > 4) this.play('Running_A', { speed: this.speedNow / 6.4 });
    else if (this.speedNow > 0.4) this.play('Walking_A', { speed: Math.max(0.7, this.speedNow / 2.6) });
    else this.play(armed ? 'Idle' : 'Unarmed_Idle');
    this.chopping = false;
    this.update(dt);
  }

  startDodge(x, z) {
    const d = Math.hypot(x, z) || 1;
    this.dodgeDir.set(x / d, 0, z / d);
    this.yaw = Math.atan2(x, z);
    this.set('dodge');
    this.dodgeCd = 0.75;
    this.inv = 0.38;
    this.play('Dodge_Forward', { once: true, restart: true, speed: 1.5, fade: 0.06 });
    sfx('dodge');
  }

  /** E で 使えるものを えらぶ (近くて、前に あるもの) */
  findFocus() {
    let best = null, bs = 1e9;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    for (const it of INTERACT) {
      if (it.area !== this.area) continue;
      const dx = it.x - this.pos.x, dz = it.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > it.r) continue;
      const label = it.label();
      if (!label) continue;
      const score = d - (dx * fx + dz * fz) / (d || 1) * 0.6;
      if (score < bs) { bs = score; best = it; best.text = label; }
    }
    return best;
  }
}
