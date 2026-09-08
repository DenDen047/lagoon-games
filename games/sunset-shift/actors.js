/* =========================================================================
   SUNSET SHIFT ― 人と戦い（見下ろし）
   位置は (x, y)、高さは z。z があるので屋上に立てるし、影が体から離れる。
   ========================================================================= */
'use strict';

const GRAVZ = 1500;
const HERO_R = 14;
const HERO_H = 40;
const Z_CEIL = 300;   /* 上がれる高さの上限 */
const FIG = 1.42;   /* 上から見ると人は小さいので、読みやすいように誇張する */

function limb(ctx, x1, y1, x2, y2, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

/* 太陽の側に暖色を敷いて、輪郭を光らせる。 */
function edgeLight(ctx, dirX, dirY, col, alpha, drawFlat) {
  if (alpha <= 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(alpha, 0, 0.7);
  ctx.fillStyle = col;
  ctx.translate(dirX * 2.4, dirY * 2.4);
  drawFlat(ctx);
  ctx.restore();
}

function rimLight(ctx, L, drawFlat) {
  if (!L || L.direct < 0.08) return;
  edgeLight(ctx, -L.dir.x, -L.dir.y, L.warm, 0.1 + L.golden * 0.24, drawFlat);
}

function lampLight(ctx, L, x, y, drawFlat) {
  if (!L || L.ambient > 0.62) return;
  const lamp = City.nearestLight(x, y, 240);
  if (!lamp) return;
  const d = dist(lamp.x, lamp.y, x, y) || 1;
  edgeLight(ctx, (lamp.x - x) / d, (lamp.y - y) / d, lamp.col, (1 - d / 240) * 0.4 * (1 - L.ambient), drawFlat);
}

/* ============================== ヒーロー ============================== */
class Hero {
  constructor(def) {
    this.def = def;
    this.maxHp = def.base.hp;
    this.hp = this.maxHp;
    this.maxGauge = def.gauge.max;
    this.gauge = this.maxGauge;
    this.modules = { active: ['railgun', 'boost'], passive: [] };
    this.owned = ['railgun', 'boost'];
    this.data = 0;
    this.level = 1;
    this.solved = 0;
    this.reset(300, 300);
  }

  reset(x, y) {
    this.x = x; this.y = y; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.face = -Math.PI / 2; this.onGround = true; this.jumps = 0;
    this.state = 'idle'; this.t = 0; this.anim = 0;
    this.atk = null; this.hurt = 0; this.iframe = 0; this.guard = false;
    this.combo = 0; this.comboT = 0;
    this.charge = 0; this.chargeOn = false; this.boostOn = false;
    this.shieldT = 0; this.overT = 0; this.slowT = 0;
    this.drones = []; this.held = null; this.cd = {};
    this.camo = 0; this.leapCharge = 0; this.roofOn = false;
    this.deadT = 0; this.slamming = false;
  }

  get atkMul() {
    let m = this.def.base.atk;
    if (this.def.id === 'tech') {
      if (this.has('servo')) m *= 1.25;
      if (this.has('analyzer')) m *= 1.15;
      if (this.gauge <= 0) m *= 0.5;
      if (this.overT > 0) m *= 1.4;
    }
    if (this.def.id === 'bio' && this.def.side.id === 'molt' && G.day % 3 === 0) m *= 1.5;
    return m;
  }

  get spdMul() {
    let s = this.def.base.spd;
    if (this.def.id === 'tech') {
      if (this.has('lightframe')) s *= 1.18;
      if (this.overT > 0) s *= 1.25;
    }
    if (this.def.id === 'bio' && this.def.side.id === 'cold') s *= (G.hour > 18.5 || G.hour < 5.5) ? 1.2 : 0.88;
    return s;
  }

  has(mod) { return this.def.id === 'tech' && this.modules.passive.includes(mod); }

  spend(n) { if (this.gauge < n) return false; this.gauge -= n; return true; }

  damage(n, fromX, fromY) {
    if (this.iframe > 0 || this.deadT > 0) return;
    if (this.def.id === 'bio' && this.def.abil.util.id === 'sense' && chance(0.25)) {
      FX.text(this.x, this.y - 46 - this.z, 'かわした', '#7ee39b', 14);
      this.iframe = 0.4;
      return;
    }
    if (this.def.id === 'tech' && this.shieldT > 0) {
      const pay = Math.min(this.gauge, n * 1.6);
      this.gauge -= pay;
      n -= pay / 1.6;
      FX.burst(this.x + Math.cos(this.face) * 18, this.y + Math.sin(this.face) * 18 - this.z, 8, { col: '#ffb454', glow: 1, r: 2.4, g: 0, drag: 0.9 });
      if (n <= 0.5) { Sfx.tone(520, 0.1, 'square', 0.07); return; }
    }
    const ang = Math.atan2(fromY - this.y, fromX - this.x);
    if (this.guard && Math.abs(((ang - this.face + Math.PI * 3) % TAU) - Math.PI) < 1.1) n *= 0.32;
    if (this.has('lightframe')) n *= 1.15;
    if (this.def.id === 'bio' && this.def.side.id === 'molt' && G.day % 3 === 0) n *= 1.5;

    this.hp -= n;
    this.hurt = 0.3; this.iframe = 0.6;
    this.vx = -Math.cos(ang) * 220; this.vy = -Math.sin(ang) * 220;
    this.combo = 0;
    shakeCam(5); Sfx.bad();
    FX.burst(this.x, this.y - this.z, 10, { col: '#ff6b5f', spMax: 200, r: 3, glow: 1, g: 0, drag: 0.88 });
    FX.text(this.x, this.y - 44 - this.z, '-' + Math.round(n), '#ff8a7a', 15);
    if (this.def.id === 'bio' && this.def.abil.util.id === 'ink') {
      FX.burst(this.x, this.y - this.z, 16, { col: '#2a3040', spMax: 140, r: 9, g: 0, life: 1.1, shrink: false, alpha: 0.6, drag: 0.9 });
      this.iframe = 0.9;
    }
    if (this.hp <= 0) { this.hp = 0; this.deadT = 0.01; }
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
    FX.text(this.x, this.y - 50 - this.z, '+' + Math.round(n), '#7ee39b', 15);
  }

  /* ------------------------------ 更新 ------------------------------ */
  update(dt, canAct) {
    this.t += dt;
    for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] -= dt;
    this.hurt = Math.max(0, this.hurt - dt);
    this.iframe = Math.max(0, this.iframe - dt);
    this.overT = Math.max(0, this.overT - dt);
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    if (this.deadT > 0) { this.deadT += dt; this.vx *= 0.9; this.vy *= 0.9; return; }

    let regen = this.def.gauge.regen;
    if (this.def.id === 'tech' && this.has('capacitor')) this.maxGauge = this.def.gauge.max + 40;
    if (this.def.id === 'tech' && this.slowT > 0) regen *= 0.4;
    if (this.def.id === 'bio') {
      const sd = this.def.side.id;
      if (sd === 'sun' && G.hour > 7 && G.hour < 17.5) regen *= 0.5;
      if (sd === 'light') regen *= City.nearestLight(this.x, this.y, 170) || (G.hour > 7 && G.hour < 17.5) ? 1.3 : 0.7;
    }
    this.gauge = Math.min(this.maxGauge, this.gauge + regen * dt);
    if (this.has('nano') && this.hurt <= 0) this.hp = Math.min(this.maxHp, this.hp + 3.2 * dt);
    if (this.def.id === 'bio' && this.def.abil.util.id === 'regen') this.hp = Math.min(this.maxHp, this.hp + 3.6 * dt);
    if (this.def.id === 'bio' && this.def.abil.util.id === 'camo') {
      this.camo = approach(this.camo, Math.hypot(this.vx, this.vy) < 16 && !this.atk ? 1 : 0, dt * 1.6);
    }

    /* 移動。 */
    let ix = 0, iy = 0;
    if (canAct && !this.atk && this.hurt <= 0) {
      if (Input.down('left')) ix -= 1;
      if (Input.down('right')) ix += 1;
      if (Input.down('up')) iy -= 1;
      if (Input.down('down')) iy += 1;
      if (Input.axis.x || Input.axis.y) { ix = Input.axis.x; iy = Input.axis.y; }
      this.guard = Input.down('guard') && this.onGround;
      if (this.guard) { ix *= 0.25; iy *= 0.25; }
    } else this.guard = false;

    const mag = Math.hypot(ix, iy);
    const move = this.spdMul * 262;
    if (mag > 0.05) {
      ix /= mag; iy /= mag;
      const tvx = ix * move, tvy = iy * move;
      const acc = (this.onGround ? 2400 : 1500) * dt;
      this.vx = approach(this.vx, tvx, acc);
      this.vy = approach(this.vy, tvy, acc);
      if (!this.aiming) this.face = Math.atan2(iy, ix);
    } else if (!this.atk) {
      this.vx = approach(this.vx, 0, (this.onGround ? 2400 : 700) * dt);
      this.vy = approach(this.vy, 0, (this.onGround ? 2400 : 700) * dt);
    }

    /* 照準。マウスがあればそちらを向く。 */
    if (canAct && Input.mouseActive && !Input.isTouch) {
      const mx = G.cam.x + Input.mouse.x / G.Z, my = G.cam.y + Input.mouse.y / G.Z;
      this.face = Math.atan2(my - (this.y - this.z), mx - this.x);
      this.aiming = true;
    } else this.aiming = false;

    /* 高さ。 */
    let g = GRAVZ;
    if (this.def.id === 'grav' && this.vz < 0) g *= 0.55;
    if (this.def.id === 'bio' && this.def.abil.move.id === 'glide' && !this.onGround && canAct && Input.down('skill1') && this.vz < 0) {
      g = 240;
      const f = this.face;
      this.vx = approach(this.vx, Math.cos(f) * move * 1.25, 900 * dt);
      this.vy = approach(this.vy, Math.sin(f) * move * 1.25, 900 * dt);
      if (chance(dt * 20)) FX.add({ x: this.x, y: this.y - this.z, vx: rand(-20, 20), vy: rand(-20, 20), g: 0, r: 2, col: this.def.colors.accent, life: 0.4, glow: 1 });
    }
    if (this.boostOn) {
      g = 0;
      this.vz = approach(this.vz, Input.down('down') ? -180 : 260, 1200 * dt);
      this.gauge -= 18 * dt;
      if (this.gauge <= 0) { this.gauge = 0; this.boostOn = false; }
      if (chance(dt * 40)) FX.add({ x: this.x + rand(-6, 6), y: this.y - this.z + 6, vx: rand(-20, 20), vy: rand(20, 60), g: 0, r: rand(2, 4), col: pick(['#ffb454', '#ff7a3c', '#fff0c0']), life: 0.3, glow: 1 });
    }
    if (this.roofOn) {
      g = 0;
      this.vz = 620;
      this.gauge -= 22 * dt;
      if (this.gauge <= 0) { this.gauge = 0; this.roofOn = false; }
      if (chance(dt * 24)) FX.add({ x: this.x + rand(-8, 8), y: this.y - this.z, vx: 0, vy: 40, g: 0, r: 2, col: this.def.colors.accent, life: 0.35, glow: 1 });
    }
    this.vz -= g * dt;
    this.z += this.vz * dt;
    /* いちばん高いビルより少し上で頭打ちにする。 */
    if (this.z > Z_CEIL) { this.z = Z_CEIL; this.vz = Math.min(this.vz, 0); }

    /* 横の移動。建物にぶつかる。屋根より高ければ通れる。 */
    const nx = this.x + this.vx * dt;
    if (!City.blocked(nx, this.y, this.z, HERO_R)) this.x = nx; else this.vx *= 0.2;
    const ny = this.y + this.vy * dt;
    if (!City.blocked(this.x, ny, this.z, HERO_R)) this.y = ny; else this.vy *= 0.2;

    const gz = City.groundZ(this.x, this.y);
    if (this.z <= gz) {
      if (!this.onGround && this.vz < -700) {
        FX.burst(this.x, this.y - gz, 8, { col: '#c8cede', spMax: 130, r: 2.5, g: 0, drag: 0.86 });
        shakeCam(2);
      }
      this.z = gz; this.vz = 0; this.onGround = true; this.jumps = 0;
      this.boostOn = false; this.roofOn = false;
    } else this.onGround = false;

    if (this.atk) this.state = 'attack';
    else if (!this.onGround) this.state = 'air';
    else if (this.guard) this.state = 'guard';
    else if (Math.hypot(this.vx, this.vy) > 30) this.state = 'run';
    else this.state = 'idle';
    this.anim += dt * (this.state === 'run' ? Math.hypot(this.vx, this.vy) / 26 : 3.2);

    if (canAct) this.controls(dt);
    this.stepAttack(dt);
    for (const d of this.drones) d.update(dt, this);
    this.drones = this.drones.filter((d) => d.life > 0);
  }

  controls(dt) {
    const maxJumps = this.def.id === 'grav' ? 2 : 1;
    if (Input.consume('jump') && !this.atk) {
      if (this.onGround) { this.vz = 520; this.jumps = 1; this.onGround = false; Sfx.jump(); }
      else if (this.jumps < maxJumps) {
        this.vz = 470; this.jumps++;
        Sfx.jump();
        FX.burst(this.x, this.y - this.z, 12, { col: this.def.gauge.color, spMax: 150, r: 2.6, glow: 1, g: 0, drag: 0.86 });
      }
    }
    if (Input.consume('dash') && !this.atk && (this.cd.dash || 0) <= 0) {
      this.cd.dash = 0.6;
      this.vx = Math.cos(this.face) * 620; this.vy = Math.sin(this.face) * 620;
      this.iframe = Math.max(this.iframe, 0.22);
      FX.burst(this.x, this.y - this.z, 10, { col: '#ffffff', spMax: 140, r: 2, alpha: 0.7, g: 0, drag: 0.85 });
      Sfx.tone(300, 0.12, 'sine', 0.05, 700);
    }
    if (Input.consume('light') && !this.atk) this.startAttack('light');
    if (Input.consume('heavy') && !this.atk) this.startAttack('heavy');
    this.skillInput(dt, 'skill1');
    this.skillInput(dt, 'skill2');
  }

  slotAbility(slot) {
    const d = this.def;
    if (d.id === 'grav') return d.skills[slot];
    if (d.id === 'bio') return slot === 'skill1' ? d.abil.move : d.abil.atk;
    const id = this.modules.active[slot === 'skill1' ? 0 : 1];
    return MODULES.find((m) => m.id === id) || null;
  }

  skillInput(dt, slot) {
    const ab = this.slotAbility(slot);
    if (!ab) return;
    const held = Input.down(slot);
    const hit = Input.consume(slot);

    if (ab.id === 'boost') { this.boostOn = held && this.gauge > 0; return; }
    if (ab.id === 'roof') { this.roofOn = held && this.gauge > 0; return; }
    if (ab.id === 'railgun') {
      if (held) { this.chargeOn = true; this.charge = Math.min(1.4, this.charge + dt); }
      else if (this.chargeOn) { this.chargeOn = false; this.fireRailgun(); }
      return;
    }
    if (ab.id === 'glide') return;
    if (ab.id === 'leap') {
      if (held) { this.leapCharge = Math.min(1, this.leapCharge + dt * 1.6); this.vx *= 0.88; this.vy *= 0.88; }
      else if (this.leapCharge > 0.1) {
        if (this.spend(ab.cost)) {
          const p = 320 + 340 * this.leapCharge;
          this.vz = 520 + 300 * this.leapCharge;
          this.vx = Math.cos(this.face) * p; this.vy = Math.sin(this.face) * p;
          this.onGround = false;
          FX.burst(this.x, this.y - this.z, 16, { col: this.def.colors.accent, spMax: 220, r: 3, glow: 1, g: 0, drag: 0.88 });
          Sfx.power(); shakeCam(4);
        }
        this.leapCharge = 0;
      }
      return;
    }
    if (!hit) return;
    this.useAbility(ab);
  }

  /* 前方の扇のなかにいる敵。 */
  inCone(range, halfAngle) {
    const out = [];
    for (const e of Battle.enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.y, this.x, this.y);
      if (d > range) continue;
      const a = Math.atan2(e.y - this.y, e.x - this.x);
      if (Math.abs(((a - this.face + Math.PI * 3) % TAU) - Math.PI) <= halfAngle) out.push({ e, d });
    }
    return out;
  }

  useAbility(ab) {
    const cost = ab.cost !== undefined ? ab.cost : ab.energy || 0;
    if (ab.cd && (this.cd[ab.id] || 0) > 0) return;
    if (cost > 0 && !this.spend(cost)) { Sfx.tone(160, 0.1, 'square', 0.05); return; }
    if (ab.cd) this.cd[ab.id] = ab.cd;
    const fx = Math.cos(this.face), fy = Math.sin(this.face);

    switch (ab.id) {
      case 'pull': {
        FX.burst(this.x + fx * 40, this.y + fy * 40 - this.z, 16, { col: '#6fd3ff', spMax: 180, r: 2.6, glow: 1, g: 0, drag: 0.9 });
        Sfx.power();
        for (const { e } of this.inCone(340, 0.7)) {
          const a = Math.atan2(this.y - e.y, this.x - e.x);
          e.vx = Math.cos(a) * 430; e.vy = Math.sin(a) * 430;
          e.stun = Math.max(e.stun, 0.5);
          e.damage(6 * this.atkMul, this.x, this.y);
        }
        const car = Traffic.grabbable(this.x + fx * 180, this.y + fy * 180, 220);
        if (car) {
          const a = Math.atan2(this.y - car.y, this.x - car.x);
          car.state = 'thrown'; car.vx = Math.cos(a) * 520; car.vy = Math.sin(a) * 520; car.vz = 160; car.spin = rand(-3, 3);
          Sfx.car();
        }
        break;
      }
      case 'slam': {
        if (!this.onGround) { this.vz = -1700; this.slamming = true; break; }
        this.doSlam();
        break;
      }
      case 'drone': for (let i = 0; i < 2; i++) this.drones.push(new Drone(this, i)); Sfx.power(); break;
      case 'shield': this.shieldT = 5; Sfx.tone(440, 0.2, 'triangle', 0.07, 620); break;
      case 'emp': {
        FX.burst(this.x, this.y - this.z, 34, { col: '#8ff0ff', spMax: 380, r: 3, glow: 1, g: 0, life: 0.5, drag: 0.9 });
        shakeCam(9); Sfx.tone(120, 0.4, 'square', 0.1, 1200);
        Battle.ring(this.x, this.y, 300, '#8ff0ff');
        for (const e of Battle.enemies) {
          if (e.dead || dist(e.x, e.y, this.x, this.y) > 300) continue;
          const machine = e.type === 'drone' || e.type === 'heavy' || e.boss;
          e.damage((machine ? 34 : 12) * this.atkMul, this.x, this.y);
          e.stun = Math.max(e.stun, machine ? 2.4 : 0.8);
        }
        break;
      }
      case 'anchor': {
        const hits = this.inCone(440, 0.5).sort((a, b) => a.d - b.d);
        FX.add({ x: this.x, y: this.y - this.z, vx: fx * 900, vy: fy * 900, g: 0, r: 3, col: '#ffb454', life: 0.3, kind: 'line', glow: 1 });
        if (hits.length) {
          const e = hits[0].e;
          if (e.big) { this.vx = fx * 780; this.vy = fy * 780; }
          else {
            const a = Math.atan2(this.y - e.y, this.x - e.x);
            e.vx = Math.cos(a) * 600; e.vy = Math.sin(a) * 600; e.stun = 0.6;
            e.damage(10 * this.atkMul, this.x, this.y);
          }
        } else {
          const car = Traffic.grabbable(this.x + fx * 220, this.y + fy * 220, 260);
          if (car) {
            const a = Math.atan2(this.y - car.y, this.x - car.x);
            car.state = 'thrown'; car.vx = Math.cos(a) * 460; car.vy = Math.sin(a) * 460; car.vz = 120; car.spin = rand(-3, 3);
          } else { this.vx = fx * 720; this.vy = fy * 720; }
        }
        Sfx.shot();
        break;
      }
      case 'missile': {
        for (let i = 0; i < 4; i++) {
          const a = this.face + rand(-0.9, 0.9);
          Battle.shots.push({ x: this.x, y: this.y, z: this.z + 12, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, dmg: 13 * this.atkMul, mine: true, kind: 'missile', life: 3, t: 0, target: null });
        }
        Sfx.shot();
        break;
      }
      case 'overclock': this.overT = 8; this.slowT = 14; Sfx.good(); FX.text(this.x, this.y - 56 - this.z, 'OVERCLOCK', '#ffb454', 18); break;
      case 'zip': {
        const far = 420;
        let tx = this.x + fx * far, ty = this.y + fy * far;
        for (let s = 30; s < far; s += 20) {
          const px = this.x + fx * s, py = this.y + fy * s;
          if (City.blocked(px, py, this.z, 6)) { tx = this.x + fx * (s - 26); ty = this.y + fy * (s - 26); break; }
        }
        this.zipLine = { x: tx, y: ty, t: 0.3 };
        const d = dist(tx, ty, this.x, this.y) || 1;
        this.vx = (tx - this.x) / d * 900; this.vy = (ty - this.y) / d * 900;
        this.vz = Math.max(this.vz, 180);
        this.iframe = Math.max(this.iframe, 0.2);
        Sfx.tone(900, 0.12, 'triangle', 0.05, 400);
        break;
      }
      case 'blink': {
        const fromX = this.x, fromY = this.y;
        for (let s = 0; s <= 210; s += 14) {
          const px = this.x + fx * s, py = this.y + fy * s;
          if (City.blocked(px, py, this.z, 8)) break;
          this.tx2 = px; this.ty2 = py;
        }
        this.x = this.tx2 !== undefined ? this.tx2 : this.x;
        this.y = this.ty2 !== undefined ? this.ty2 : this.y;
        this.iframe = Math.max(this.iframe, 0.24);
        for (const e of Battle.enemies) {
          if (e.dead) continue;
          const d = distToSeg(e.x, e.y, fromX, fromY, this.x, this.y);
          if (d < 40) e.damage(16 * this.atkMul, fromX, fromY);
        }
        for (let i = 0; i < 6; i++) FX.add({ x: lerp(fromX, this.x, i / 6), y: lerp(fromY, this.y, i / 6) - this.z, vx: 0, vy: 0, g: 0, r: 8, col: this.def.colors.accent, life: 0.25, alpha: 0.4 });
        Sfx.tone(700, 0.12, 'sine', 0.06, 1400);
        break;
      }
      case 'sting': {
        this.startAttack('heavy');
        for (const { e } of this.inCone(80, 1.1)) { e.poison = 4; e.damage(10 * this.atkMul, this.x, this.y); }
        break;
      }
      case 'shock': {
        FX.burst(this.x, this.y - this.z, 26, { col: this.def.colors.accent, spMax: 320, r: 2.6, glow: 1, g: 0, life: 0.4, drag: 0.9 });
        Battle.ring(this.x, this.y, 230, this.def.colors.accent);
        Sfx.tone(90, 0.3, 'sawtooth', 0.1, 900); shakeCam(6);
        for (const e of Battle.enemies) if (!e.dead && dist(e.x, e.y, this.x, this.y) < 230) { e.damage(20 * this.atkMul, this.x, this.y); e.stun = Math.max(e.stun, 0.7); }
        break;
      }
      case 'sonic':
        Battle.shots.push({ x: this.x, y: this.y, z: this.z + 14, vx: fx * 900, vy: fy * 900, dmg: 22 * this.atkMul, mine: true, kind: 'sonic', life: 0.8, t: 0, pierce: true });
        Sfx.tone(1200, 0.18, 'sine', 0.06, 300); break;
      case 'acid':
        Battle.shots.push({ x: this.x, y: this.y, z: this.z + 14, vx: fx * 560, vy: fy * 560, dmg: 14 * this.atkMul, mine: true, kind: 'acid', life: 1.4, t: 0 });
        Sfx.shot(); break;
      case 'web':
        Battle.shots.push({ x: this.x, y: this.y, z: this.z + 14, vx: fx * 700, vy: fy * 700, dmg: 6 * this.atkMul, mine: true, kind: 'web', life: 0.7, t: 0 });
        Sfx.shot(); break;
      case 'quill':
        for (let i = -1; i <= 1; i++) {
          const a = this.face + i * 0.16;
          Battle.shots.push({ x: this.x, y: this.y, z: this.z + 14, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, dmg: 9 * this.atkMul, mine: true, kind: 'quill', life: 1, t: 0 });
        }
        Sfx.shot(); break;
      default: break;
    }
  }

  doSlam() {
    this.slamming = false;
    FX.burst(this.x, this.y - this.z, 30, { col: '#6fd3ff', spMax: 380, r: 3.4, glow: 1, g: 0, drag: 0.88 });
    FX.burst(this.x, this.y - this.z, 14, { col: '#c8cede', spMax: 220, r: 4, g: 0, drag: 0.9 });
    shakeCam(14); Sfx.heavy();
    Battle.ring(this.x, this.y, 260, '#6fd3ff');
    for (const e of Battle.enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.y, this.x, this.y);
      if (d < 260) {
        e.damage((34 - d * 0.06) * this.atkMul, this.x, this.y);
        const a = Math.atan2(e.y - this.y, e.x - this.x);
        e.vx = Math.cos(a) * 380; e.vy = Math.sin(a) * 380; e.stun = 0.8;
      }
    }
  }

  fireRailgun() {
    const c = clamp(this.charge / 1.4, 0.15, 1);
    this.charge = 0;
    if (!this.spend(10 + 16 * c)) return;
    const fx = Math.cos(this.face), fy = Math.sin(this.face);
    Battle.shots.push({
      x: this.x + fx * 16, y: this.y + fy * 16, z: this.z + 14,
      vx: fx * (900 + 500 * c), vy: fy * (900 + 500 * c),
      dmg: (12 + 34 * c) * this.atkMul, mine: true, kind: 'rail', life: 1.1, t: 0, pierce: c > 0.8, w: 4 + 8 * c,
    });
    this.vx -= fx * 120 * c; this.vy -= fy * 120 * c;
    shakeCam(3 + 6 * c);
    Sfx.tone(180 + 400 * c, 0.2, 'sawtooth', 0.09, 80);
  }

  startAttack(kind) {
    if (kind === 'light') {
      this.combo = (this.comboT > 0 ? this.combo + 1 : 0) % 3;
      this.comboT = 0.7;
      this.atk = { kind, t: 0, dur: 0.26, hit: false, step: this.combo };
    } else {
      this.atk = { kind, t: 0, dur: 0.42, hit: false, step: 0 };
      this.vx += Math.cos(this.face) * 150; this.vy += Math.sin(this.face) * 150;
    }
    Sfx.tone(kind === 'light' ? 520 : 300, 0.06, 'triangle', 0.05);
  }

  stepAttack(dt) {
    if (this.slamming && this.onGround) this.doSlam();
    if (!this.atk) return;
    const a = this.atk;
    a.t += dt;
    const active = a.kind === 'light' ? a.t > 0.06 && a.t < 0.18 : a.t > 0.13 && a.t < 0.3;
    if (active && !a.hit) {
      const reach = a.kind === 'light' ? 62 : 86;
      const wide = a.kind === 'light' ? 1.0 : 1.35;
      const dmg = (a.kind === 'light' ? (a.step === 2 ? 13 : 8) : 24) * this.atkMul;
      let landed = false;
      for (const { e } of this.inCone(reach + 14, wide)) {
        if (Math.abs((e.z || 0) - this.z) > 90) continue;
        e.damage(dmg, this.x, this.y, { breaker: a.kind === 'heavy' });
        const ang = Math.atan2(e.y - this.y, e.x - this.x);
        const k = a.kind === 'heavy' ? 420 : 160;
        e.vx += Math.cos(ang) * k; e.vy += Math.sin(ang) * k;
        if (a.kind === 'heavy') e.stun = Math.max(e.stun, 0.45);
        if (this.def.id === 'bio' && this.def.abil.util.id === 'venom') e.poison = 3;
        landed = true;
      }
      if (landed) {
        a.hit = true;
        Battle.hitStop = a.kind === 'heavy' ? 0.09 : 0.04;
        shakeCam(a.kind === 'heavy' ? 8 : 3);
        a.kind === 'heavy' ? Sfx.heavy() : Sfx.hit();
        FX.burst(this.x + Math.cos(this.face) * reach * 0.7, this.y + Math.sin(this.face) * reach * 0.7 - this.z,
          a.kind === 'heavy' ? 16 : 8, { col: a.kind === 'heavy' ? '#ffd08a' : '#ffffff', spMax: 200, r: 2.6, glow: 1, g: 0, drag: 0.88 });
      }
    }
    if (a.t >= a.dur) this.atk = null;
  }

  /* ------------------------------ 描画 ------------------------------ */
  shadow(sctx, cam, L) {
    blobShadow(sctx, cam, L, this.x, this.y, this.z, HERO_H, 17);
  }

  draw(ctx, cam, L) {
    /* 糸。 */
    if (this.zipLine) {
      this.zipLine.t -= 0.016;
      if (this.zipLine.t <= 0) this.zipLine = null;
      else {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x - cam.x, this.y - cam.y - this.z);
        ctx.lineTo(this.zipLine.x - cam.x, this.zipLine.y - cam.y - this.z);
        ctx.stroke(); ctx.restore();
      }
    }
    /* 足元の輪。上から見て自分を見失わないための目印。 */
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = this.def.gauge.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(this.x - cam.x, this.y - cam.y, 21, 21, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(this.x - cam.x, this.y - cam.y - this.z);
    let a = this.deadT > 0 ? 0.55 : 1;
    if (this.def.id === 'bio' && this.camo > 0) a *= 1 - this.camo * 0.72;
    if (this.iframe > 0 && this.hurt <= 0) a *= 0.55 + 0.45 * Math.sin(this.t * 40);
    ctx.globalAlpha = a;
    rimLight(ctx, L, (g) => this.figure(g, true, L));
    lampLight(ctx, L, this.x, this.y, (g) => this.figure(g, true, L));
    this.figure(ctx, false, L);
    ctx.restore();

    if (this.charge > 0.05 || this.leapCharge > 0.05) {
      const c = Math.max(this.charge / 1.4, this.leapCharge);
      const x = this.x - cam.x + Math.cos(this.face) * 22, y = this.y - cam.y - this.z + Math.sin(this.face) * 22;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 0, x, y, 6 + 22 * c);
      g.addColorStop(0, rgba(this.def.gauge.color, 0.9));
      g.addColorStop(1, rgba(this.def.gauge.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 6 + 22 * c, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (this.shieldT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba('#ffb454', 0.5 + 0.3 * Math.sin(this.t * 12));
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x - cam.x, this.y - cam.y - this.z, 26, this.face - 1.1, this.face + 1.1);
      ctx.stroke();
      ctx.restore();
    }
    for (const d of this.drones) d.draw(ctx, cam, L);
  }

  /* 真上から見た体。flat が真なら影用に一色で塗る。 */
  figure(ctx, flat, L) {
    const c = this.def.colors;
    const C = (col) => (flat ? ctx.fillStyle : col);
    const line = shade(c.suit, -0.62);
    ctx.save();
    ctx.rotate(this.face);
    ctx.scale(FIG, FIG);

    const run = this.state === 'run';
    const ph = this.anim;
    const sw = run ? Math.sin(ph) : Math.sin(ph * 0.5) * 0.16;

    /* 足。胴の左右から前後に出る。 */
    for (const s of [-1, 1]) {
      const o = s > 0 ? sw : -sw;
      ctx.fillStyle = C(shade(c.trim, -0.35));
      ctx.beginPath(); ctx.ellipse(o * 8, s * 7, 6.5, 4.2, 0, 0, TAU); ctx.fill();
      if (!flat) { ctx.strokeStyle = line; ctx.lineWidth = 1.4; ctx.stroke(); }
    }

    if (!flat) this.backDecor(ctx, c, L);

    /* 腕。攻撃で前に伸びる。 */
    let armF = 0.5, armB = -0.4;
    if (this.atk) {
      const k = clamp(this.atk.t / this.atk.dur, 0, 1);
      const p = Math.sin(k * Math.PI);
      armF = 0.4 + p * 1.5; armB = -0.3 - p * 0.4;
    } else if (this.guard) { armF = 1.0; armB = 0.85; }
    else if (run) { armF = 0.5 + sw * 0.5; armB = -0.4 + sw * 0.5; }
    for (const [ang, s] of [[armB, -1], [armF, 1]]) {
      const bx = 2, by = s * 10;
      const ex = bx + Math.cos(ang * s * 0.8) * 14, ey = by + Math.sin(ang * s * 0.8) * 3 + s * 1.5;
      if (!flat) { ctx.strokeStyle = line; ctx.lineWidth = 9.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke(); }
      limb(ctx, bx, by, ex, ey, 7, flat ? ctx.fillStyle : shade(c.suit, s > 0 ? 0.06 : -0.16));
      ctx.fillStyle = C(c.trim);
      ctx.beginPath(); ctx.arc(ex, ey, 4.2, 0, TAU); ctx.fill();
      if (!flat) { ctx.strokeStyle = line; ctx.lineWidth = 1.4; ctx.stroke(); }
    }

    /* 胴。 */
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 11, 0, 0, TAU);
    ctx.fillStyle = C(c.suit);
    ctx.fill();
    if (!flat) {
      ctx.strokeStyle = line; ctx.lineWidth = 2.4; ctx.stroke();
      const g = ctx.createLinearGradient(0, -11, 0, 11);
      g.addColorStop(0, rgba(shade(c.suit, 0.45), 0.45));
      g.addColorStop(0.55, 'rgba(255,255,255,0)');
      g.addColorStop(1, rgba('#000000', 0.34));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 11, 0, 0, TAU); ctx.fill();
      /* 肩の差し色。前を向いていることが分かる。 */
      ctx.fillStyle = rgba(c.accent, 0.9);
      ctx.beginPath();
      ctx.moveTo(6, -9.5); ctx.lineTo(12, -5); ctx.lineTo(12, 5); ctx.lineTo(6, 9.5);
      ctx.lineTo(3, 6); ctx.lineTo(8, 0); ctx.lineTo(3, -6);
      ctx.closePath(); ctx.fill();
    }

    /* 頭。少し前寄りに置く。 */
    ctx.fillStyle = C(c.skin);
    ctx.beginPath(); ctx.arc(4, 0, 8.6, 0, TAU); ctx.fill();
    if (!flat) {
      ctx.strokeStyle = line; ctx.lineWidth = 2.2; ctx.stroke();
      this.mask(ctx, c, L);
    }
    ctx.restore();
  }

  backDecor(ctx, c, L) {
    const id = this.def.id;
    if (id === 'grav') {
      const sp = clamp(Math.hypot(this.vx, this.vy) / 300, 0, 1);
      ctx.fillStyle = rgba(shade(c.suit, -0.34), 0.9);
      ctx.beginPath();
      ctx.moveTo(-4, -9);
      ctx.quadraticCurveTo(-22 - sp * 16, -13, -30 - sp * 26, 0);
      ctx.quadraticCurveTo(-22 - sp * 16, 13, -4, 9);
      ctx.closePath(); ctx.fill();
    } else if (id === 'tech') {
      ctx.fillStyle = shade(c.trim, 0.1);
      ctx.beginPath(); ctx.roundRect(-13, -9, 9, 18, 3); ctx.fill();
      if (this.boostOn) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(-14, 0, 0, -14, 0, 30);
        g.addColorStop(0, rgba('#ffd08a', 0.9)); g.addColorStop(1, rgba('#ff5c2c', 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(-14, 0, 30, 0, TAU); ctx.fill();
        ctx.restore();
      }
    } else {
      const cr = this.def.creature.id;
      if (cr === 'hornet' || cr === 'moth') {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = c.accent;
        const flap = Math.sin(this.t * (this.onGround ? 6 : 26)) * 0.28;
        for (const s of [-1, 1]) {
          ctx.save(); ctx.rotate(s * flap);
          ctx.beginPath(); ctx.ellipse(-8, s * 14, 20, 7, s * 0.5, 0, TAU); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      } else if (cr === 'bat') {
        ctx.save(); ctx.globalAlpha = 0.62; ctx.fillStyle = c.accent;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(-3, s * 6);
          ctx.quadraticCurveTo(-22, s * 20, -26, s * 4);
          ctx.quadraticCurveTo(-14, s * 2, -3, s * 6);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      } else if (cr === 'squid' || cr === 'jelly') {
        ctx.save(); ctx.globalAlpha = 0.6;
        for (let i = -2; i <= 2; i++) {
          const w = Math.sin(this.t * 4 + i) * 4;
          limb(ctx, -8, i * 3, -22 - Math.abs(i) * 2, i * 5 + w, 3, rgba(c.accent, 0.7));
        }
        ctx.restore();
      }
    }
  }

  mask(ctx, c, L) {
    const id = this.def.id;
    if (id === 'grav') {
      ctx.fillStyle = c.hair;
      ctx.beginPath(); ctx.arc(2, 0, 8.6, 0, TAU); ctx.fill();
      ctx.fillStyle = shade(c.suit, -0.05);
      ctx.beginPath(); ctx.ellipse(6.5, 0, 4, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.ellipse(8.6, 0, 2, 5.4, 0, 0, TAU); ctx.fill();
      /* 胸の重核。 */
      const p = 0.5 + 0.5 * Math.sin(this.t * 3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(-1, 0, 0, -1, 0, 14 + p * 5);
      g.addColorStop(0, rgba(c.accent, 0.75));
      g.addColorStop(1, rgba(c.accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(-1, 0, 14 + p * 5, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.arc(-1, 0, 3.4, 0, TAU); ctx.fill();
    } else if (id === 'tech') {
      ctx.fillStyle = shade(c.suit, 0.1);
      ctx.beginPath(); ctx.arc(3, 0, 8.8, 0, TAU); ctx.fill();
      ctx.fillStyle = shade(c.trim, 0.2);
      ctx.beginPath(); ctx.arc(3, 0, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(6, -4.5); ctx.lineTo(11.4, -2.4); ctx.lineTo(11.4, 2.4); ctx.lineTo(6, 4.5);
      ctx.closePath(); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(c.accent, 0.35);
      ctx.beginPath(); ctx.arc(9, 0, 8, 0, TAU); ctx.fill();
      ctx.restore();
      /* 胸のリアクター。 */
      ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.arc(-2, 0, 3.6, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(c.accent, 0.3);
      ctx.beginPath(); ctx.arc(-2, 0, 7, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = c.suit;
      ctx.beginPath(); ctx.arc(3, 0, 8.8, 0, TAU); ctx.fill();
      ctx.fillStyle = c.accent;
      const cr = this.def.creature.id;
      if (cr === 'spider' || cr === 'gecko') {
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.ellipse(7, s * 3.6, 3.6, 2.6, s * 0.4, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse(2, s * 5.4, 1.8, 1.4, 0, 0, TAU); ctx.fill();
        }
      } else if (cr === 'mantis' || cr === 'hornet') {
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(6, s * 4, 4.6, 3.4, s * 0.5, 0, TAU); ctx.fill(); }
      } else {
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(7, s * 3.4, 3.2, 2.4, 0, 0, TAU); ctx.fill(); }
      }
      if (cr === 'hornet' || cr === 'moth' || cr === 'beetle') {
        ctx.strokeStyle = c.accent; ctx.lineWidth = 1.5;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(9, s * 4); ctx.quadraticCurveTo(18, s * 10, 24, s * 6);
          ctx.stroke();
        }
      }
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(-2, -5); ctx.lineTo(2, 0); ctx.lineTo(-2, 5); ctx.lineTo(-6, 0);
      ctx.closePath(); ctx.fill();
    }
  }
}

/* 点と線分の距離。ブリンクの当たり判定に使う。 */
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(px, py, ax, ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = clamp(t, 0, 1);
  return dist(px, py, ax + dx * t, ay + dy * t);
}

/* ============================== ドローン ============================== */
class Drone {
  constructor(owner, i) {
    this.o = owner; this.i = i;
    this.x = owner.x; this.y = owner.y; this.z = owner.z + 40;
    this.life = 18; this.cool = rand(0.2, 0.6); this.ph = i * Math.PI;
  }
  update(dt) {
    this.life -= dt;
    this.ph += dt * 1.6;
    const tx = this.o.x + Math.cos(this.ph) * 40, ty = this.o.y + Math.sin(this.ph) * 40;
    this.x = lerp(this.x, tx, clamp(dt * 4, 0, 1));
    this.y = lerp(this.y, ty, clamp(dt * 4, 0, 1));
    this.z = lerp(this.z, this.o.z + 42, clamp(dt * 4, 0, 1));
    this.cool -= dt;
    if (this.cool <= 0) {
      let best = null, bd = 460;
      for (const e of Battle.enemies) {
        if (e.dead) continue;
        const d = dist(e.x, e.y, this.x, this.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        this.cool = 0.5;
        const a = Math.atan2(best.y - this.y, best.x - this.x);
        Battle.shots.push({ x: this.x, y: this.y, z: this.z, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, dmg: 7 * this.o.atkMul, mine: true, kind: 'bolt', life: 1.2, t: 0 });
        Sfx.tone(1100, 0.05, 'square', 0.03);
      }
    }
  }
  draw(ctx, cam) {
    const x = this.x - cam.x, y = this.y - cam.y - this.z;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, this.z * 0.5, 9, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7b8697';
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffb454';
    ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,220,255,0.45)'; ctx.lineWidth = 1.4;
    const s = 7 + Math.sin(performance.now() * 0.05) * 3;
    for (const [ox, oy] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) {
      ctx.beginPath(); ctx.ellipse(ox, oy, s * 0.5, s * 0.3, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}

/* ================================ 敵 ================================ */
class Enemy {
  constructor(type, x, y, opts = {}) {
    const d = ENEMIES[type] || ENEMIES.thug;
    this.type = type; this.d = d;
    this.name = opts.name || d.name;
    this.maxHp = (opts.hp || d.hp) * (1 + (G.day - 1) * 0.12);
    this.hp = this.maxHp;
    this.x = x; this.y = y; this.z = type === 'drone' ? 60 : 0;
    this.vx = 0; this.vy = 0;
    this.r = d.w * 0.5; this.h = d.h;
    this.face = 0; this.t = rand(3); this.stun = 0; this.cool = rand(0.4, 1.4);
    this.dead = false; this.deadT = 0; this.hurt = 0; this.poison = 0;
    this.big = type === 'heavy' || type === 'brute';
    this.boss = !!opts.boss;
    this.guardBreak = 0; this.tele = 0; this.wind = null;
    this.anim = 0;
  }

  damage(n, fromX, fromY, opt = {}) {
    if (this.dead) return;
    const ang = Math.atan2(fromY - this.y, fromX - this.x);
    if (this.type === 'brute' && !opt.breaker && this.guardBreak <= 0 &&
        Math.abs(((ang - this.face + Math.PI * 3) % TAU) - Math.PI) < 1.2) {
      n *= 0.25;
      FX.text(this.x, this.y - 30 - this.z, 'ガード', '#9aa6c4', 13);
      Sfx.tone(300, 0.06, 'square', 0.05);
    }
    if (opt.breaker) this.guardBreak = 1.6;
    this.hp -= n;
    this.hurt = 0.18;
    FX.text(this.x + rand(-8, 8), this.y - 26 - this.z, String(Math.round(n)), n > 20 ? '#ffd28a' : '#ffffff', n > 20 ? 17 : 14);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dead = true; this.deadT = 0;
    FX.burst(this.x, this.y - this.z, 20, { col: this.d.acc, spMax: 280, r: 3, glow: 1, g: 0, drag: 0.88 });
    Sfx.tone(160, 0.3, 'sawtooth', 0.08, 60);
    const pay = Math.round(this.d.drop * (1 + (G.day - 1) * 0.1));
    G.money += pay;
    FX.text(this.x, this.y - 44 - this.z, '+' + yen(pay) + '円', '#ffd28a', 15);
    Battle.onKill(this);
  }

  update(dt, hero) {
    this.t += dt;
    this.hurt = Math.max(0, this.hurt - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.guardBreak = Math.max(0, this.guardBreak - dt);
    this.tele = Math.max(0, this.tele - dt);
    if (this.poison > 0) {
      this.poison -= dt;
      if (chance(dt * 6)) { this.hp -= 1.6; FX.add({ x: this.x + rand(-8, 8), y: this.y - this.z, vx: 0, vy: -30, g: 0, r: 2.4, col: '#9be86b', life: 0.5, glow: 1 }); }
      if (this.hp <= 0) this.die();
    }
    if (this.dead) { this.deadT += dt; this.vx *= 0.9; this.vy *= 0.9; this.wind = null; return; }
    if (this.wind) {
      this.wind.t -= dt;
      if (this.wind.t <= 0) { const fn = this.wind.fn; this.wind = null; fn(); }
    }

    const flying = this.type === 'drone';
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (flying || !City.blocked(nx, this.y, this.z, this.r)) this.x = nx; else this.vx *= 0.2;
    if (flying || !City.blocked(this.x, ny, this.z, this.r)) this.y = ny; else this.vy *= 0.2;
    this.x = clamp(this.x, 20, City.W - 20);
    this.y = clamp(this.y, 20, City.H - 20);
    const drag = this.stun > 0 ? 300 : 1300;
    this.vx = approach(this.vx, 0, drag * dt);
    this.vy = approach(this.vy, 0, drag * dt);
    this.anim += dt * (Math.hypot(this.vx, this.vy) > 20 ? 8 : 2);
    if (this.stun > 0) return;

    const dx = hero.x - this.x, dy = hero.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.face = Math.atan2(dy, dx);
    const spd = this.d.spd * (1 + (G.day - 1) * 0.03);
    this.cool -= dt;

    if (flying) {
      this.z = lerp(this.z, hero.z + 70 + Math.sin(this.t * 1.6) * 14, clamp(dt * 1.6, 0, 1));
      if (d > 240) { this.vx = approach(this.vx, dx / d * spd, 600 * dt); this.vy = approach(this.vy, dy / d * spd, 600 * dt); }
      else if (d < 160) { this.vx = approach(this.vx, -dx / d * spd * 0.6, 600 * dt); this.vy = approach(this.vy, -dy / d * spd * 0.6, 600 * dt); }
      if (this.cool <= 0 && d < 420) {
        this.cool = rand(1.2, 2.2);
        Battle.shots.push({ x: this.x, y: this.y, z: this.z, vx: dx / d * 440, vy: dy / d * 440, dmg: this.d.atk, mine: false, kind: 'laser', life: 2, t: 0 });
        Sfx.tone(700, 0.08, 'sawtooth', 0.04, 400);
      }
      return;
    }

    if (this.d.kind === 'gun') {
      if (d > 260) { this.vx = approach(this.vx, dx / d * spd, 900 * dt); this.vy = approach(this.vy, dy / d * spd, 900 * dt); }
      else if (d < 170) { this.vx = approach(this.vx, -dx / d * spd, 900 * dt); this.vy = approach(this.vy, -dy / d * spd, 900 * dt); }
      if (this.cool <= 0 && d < 430 && Math.abs(hero.z - this.z) < 70) {
        this.cool = rand(1.4, 2.6);
        this.tele = 0.35;
        this.wind = { t: 0.34, fn: () => {
          const a = Math.atan2(hero.y - this.y, hero.x - this.x);
          Battle.shots.push({ x: this.x, y: this.y, z: 18, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, dmg: this.d.atk, mine: false, kind: 'bullet', life: 1.6, t: 0 });
          Sfx.shot();
        } };
      }
    } else if (this.d.kind === 'slam') {
      if (d > this.d.reach) { this.vx = approach(this.vx, dx / d * spd, 700 * dt); this.vy = approach(this.vy, dy / d * spd, 700 * dt); }
      if (this.cool <= 0 && d < this.d.reach + 50) {
        this.cool = rand(2.2, 3.2);
        this.tele = 0.62;
        this.wind = { t: 0.62, fn: () => {
          shakeCam(10); Sfx.heavy();
          Battle.ring(this.x, this.y, 200, '#ffa53c');
          FX.burst(this.x, this.y, 22, { col: '#c8a06b', spMax: 300, r: 3.4, g: 0, drag: 0.88 });
          if (dist(hero.x, hero.y, this.x, this.y) < 200 && hero.z < 60) hero.damage(this.d.atk, this.x, this.y);
        } };
      }
    } else {
      if (d > this.d.reach * 0.8) { this.vx = approach(this.vx, dx / d * spd, 900 * dt); this.vy = approach(this.vy, dy / d * spd, 900 * dt); }
      if (this.cool <= 0 && d < this.d.reach && Math.abs(hero.z - this.z) < 60) {
        this.cool = rand(0.9, 1.7);
        this.tele = 0.3;
        this.wind = { t: 0.28, fn: () => {
          if (dist(hero.x, hero.y, this.x, this.y) < this.d.reach + 18 && Math.abs(hero.z - this.z) < 60) hero.damage(this.d.atk, this.x, this.y);
          Sfx.hit();
          FX.burst(this.x + Math.cos(this.face) * 24, this.y + Math.sin(this.face) * 24, 6, { col: '#ffffff', spMax: 140, r: 2, g: 0, drag: 0.86 });
        } };
      }
    }
  }

  shadow(sctx, cam, L) {
    if (this.dead && this.deadT > 1.2) return;
    blobShadow(sctx, cam, L, this.x, this.y, this.z, this.h * 0.55, this.r * 1.4 + 2);
  }

  draw(ctx, cam, L) {
    if (this.dead && this.deadT > 1.2) return;
    ctx.save();
    ctx.translate(this.x - cam.x, this.y - cam.y - this.z);
    if (this.dead) ctx.globalAlpha = clamp(1 - this.deadT / 1.2, 0, 1);
    if (this.hurt > 0) ctx.globalAlpha *= 0.7;
    rimLight(ctx, L, (g) => this.figure(g, true));
    lampLight(ctx, L, this.x, this.y, (g) => this.figure(g, true));
    this.figure(ctx, false);
    ctx.restore();
    if (!this.dead) this.bar(ctx, cam);
  }

  bar(ctx, cam) {
    const x = this.x - cam.x, y = this.y - cam.y - this.z - this.r - 16;
    const w = Math.max(30, this.r * 2.4);
    ctx.fillStyle = 'rgba(8,10,18,0.75)';
    ctx.fillRect(x - w / 2, y, w, 5);
    const k = clamp(this.hp / this.maxHp, 0, 1);
    ctx.fillStyle = this.boss ? '#ff5f6d' : mix('#ff5f6d', '#7ee39b', k);
    ctx.fillRect(x - w / 2 + 1, y + 1, (w - 2) * k, 3);
    if (this.tele > 0) {
      ctx.fillStyle = rgba('#ff5f6d', 0.85);
      ctx.beginPath(); ctx.arc(x, y - 9, 4, 0, TAU); ctx.fill();
    }
  }

  figure(ctx, flat) {
    const d = this.d;
    const C = (c) => (flat ? ctx.fillStyle : c);
    ctx.save();
    ctx.rotate(this.face);
    ctx.scale(1.34, 1.34);
    if (this.type === 'drone') {
      ctx.fillStyle = C(d.col);
      ctx.beginPath(); ctx.ellipse(0, 0, this.r + 4, this.r, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = C(d.acc);
      ctx.beginPath(); ctx.arc(this.r * 0.5, 0, 3.4, 0, TAU); ctx.fill();
      if (!flat) {
        ctx.strokeStyle = 'rgba(190,210,255,0.45)'; ctx.lineWidth = 1.6;
        const s = 8 + Math.sin(this.t * 40) * 3;
        for (const [ox, oy] of [[-10, -8], [10, -8], [-10, 8], [10, 8]]) {
          ctx.beginPath(); ctx.ellipse(ox, oy, s * 0.5, s * 0.3, 0, 0, TAU); ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }
    const line = shade(d.col, -0.6);
    const sw = Math.sin(this.anim) * (Math.hypot(this.vx, this.vy) > 20 ? 1 : 0.2);
    for (const s of [-1, 1]) {
      ctx.fillStyle = C(shade(d.col, -0.34));
      ctx.beginPath(); ctx.ellipse((s > 0 ? sw : -sw) * 6, s * this.r * 0.55, 5.5, 3.6, 0, 0, TAU); ctx.fill();
      if (!flat) { ctx.strokeStyle = line; ctx.lineWidth = 1.4; ctx.stroke(); }
    }
    ctx.beginPath(); ctx.ellipse(0, 0, this.r + 1, this.r * 0.88, 0, 0, TAU);
    ctx.fillStyle = C(d.col); ctx.fill();
    if (!flat) { ctx.strokeStyle = line; ctx.lineWidth = 2.2; ctx.stroke(); }
    ctx.fillStyle = C(d.acc);
    ctx.beginPath(); ctx.ellipse(-this.r * 0.35, 0, 3.6, this.r * 0.6, 0, 0, TAU); ctx.fill();

    /* 腕と得物。 */
    const reach = this.tele > 0 ? 1.5 : 1;
    if (d.kind === 'gun') {
      limb(ctx, 2, this.r * 0.5, 12, this.r * 0.4, 5, C(shade(d.col, 0.05)));
      ctx.fillStyle = C('#20242e');
      ctx.fillRect(11, this.r * 0.4 - 2, 16, 4);
    } else if (d.kind === 'shield') {
      limb(ctx, 2, -this.r * 0.5, 10 * reach, -this.r * 0.4, 5, C(shade(d.col, 0.05)));
      ctx.fillStyle = C(this.guardBreak > 0 ? '#8a5a4a' : d.acc);
      ctx.beginPath(); ctx.roundRect(this.r * 0.5, -this.r * 0.9, 7, this.r * 1.8, 3); ctx.fill();
    } else if (d.kind === 'slam') {
      limb(ctx, 0, 0, 16 * reach, 0, 7, C(shade(d.col, 0.05)));
      ctx.fillStyle = C('#2a2f38');
      ctx.beginPath(); ctx.roundRect(12 * reach, -8, 18, 16, 4); ctx.fill();
    } else {
      limb(ctx, 2, this.r * 0.4, 13 * reach, this.r * 0.3, 5, C(shade(d.col, 0.05)));
      ctx.fillStyle = C('#6b563c');
      ctx.fillRect(12 * reach, this.r * 0.3 - 2, 16, 4);
    }

    ctx.beginPath(); ctx.arc(this.r * 0.34, 0, this.r * 0.55, 0, TAU);
    ctx.fillStyle = C(shade(d.col, 0.22)); ctx.fill();
    if (!flat) {
      ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = this.tele > 0 ? '#ff5f6d' : d.acc;
      ctx.beginPath(); ctx.ellipse(this.r * 0.62, 0, 2.4, 3.4, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

/* ============================== 戦いの場 ============================== */
const Battle = {
  enemies: [], shots: [], rings: [], civilians: [],
  hitStop: 0,
  onKillCb: null,

  reset() { this.enemies.length = 0; this.shots.length = 0; this.rings.length = 0; this.civilians.length = 0; },
  ring(x, y, r, col) { this.rings.push({ x, y, r, col, t: 0 }); },
  onKill(e) { if (this.onKillCb) this.onKillCb(e); },
  alive() { return this.enemies.filter((e) => !e.dead).length; },

  spawnWave(list, ax, ay) {
    for (let i = 0; i < list.length; i++) {
      const a = (i / list.length) * TAU + rand(0.4);
      const r = rand(160, 300);
      let x = clamp(ax + Math.cos(a) * r, 40, City.W - 40);
      let y = clamp(ay + Math.sin(a) * r, 40, City.H - 40);
      for (let t = 0; t < 12 && City.blocked(x, y, 0, 16); t++) {
        x = clamp(ax + Math.cos(a + t) * (r - t * 12), 40, City.W - 40);
        y = clamp(ay + Math.sin(a + t) * (r - t * 12), 40, City.H - 40);
      }
      this.enemies.push(new Enemy(list[i], x, y));
    }
  },

  update(dt, hero) {
    for (const e of this.enemies) e.update(dt, hero);
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].dead && this.enemies[i].deadT > 1.4) this.enemies.splice(i, 1);

    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.t += dt;
      if (s.kind === 'missile') {
        if (!s.target || s.target.dead) {
          let bd = 600;
          for (const e of this.enemies) if (!e.dead) { const d = dist(s.x, s.y, e.x, e.y); if (d < bd) { bd = d; s.target = e; } }
        }
        if (s.target) {
          const a = Math.atan2(s.target.y - s.y, s.target.x - s.x);
          s.vx = lerp(s.vx, Math.cos(a) * 520, clamp(dt * 4, 0, 1));
          s.vy = lerp(s.vy, Math.sin(a) * 520, clamp(dt * 4, 0, 1));
        }
        FX.add({ x: s.x, y: s.y - (s.z || 0), vx: rand(-16, 16), vy: rand(-16, 16), g: 0, r: 2.4, col: '#ffb454', life: 0.3, glow: 1 });
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.t > s.life) { this.shots.splice(i, 1); continue; }
      if (s.kind !== 'sonic' && s.kind !== 'rail' && City.blocked(s.x, s.y, s.z || 14, 3)) { this.shots.splice(i, 1); continue; }

      if (s.mine) {
        let gone = false;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (dist(e.x, e.y, s.x, s.y) < e.r + 10 && Math.abs((e.z || 0) - (s.z || 0)) < 80) {
            e.damage(s.dmg, s.x, s.y, { breaker: s.kind === 'rail' || s.kind === 'sonic' });
            if (s.kind === 'acid') e.poison = 3;
            if (s.kind === 'web') e.stun = Math.max(e.stun, 1.6);
            if (s.kind === 'missile') { shakeCam(5); FX.burst(s.x, s.y, 14, { col: '#ffb454', spMax: 260, r: 3, glow: 1, g: 0, drag: 0.88 }); }
            FX.burst(s.x, s.y, 6, { col: '#ffffff', spMax: 160, r: 2, glow: 1, g: 0, drag: 0.86 });
            if (!s.pierce) { this.shots.splice(i, 1); gone = true; break; }
          }
        }
        if (gone) continue;
      } else {
        const h = G.hero;
        if (h && dist(h.x, h.y, s.x, s.y) < HERO_R + 6 && Math.abs(h.z - (s.z || 0)) < 70) {
          h.damage(s.dmg, s.x, s.y);
          this.shots.splice(i, 1);
          continue;
        }
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].t += dt;
      if (this.rings[i].t > 0.5) this.rings.splice(i, 1);
    }
    for (const c of this.civilians) {
      c.t += dt;
      if (c.carried) {
        c.x = lerp(c.x, hero.x - Math.cos(hero.face) * 12, clamp(dt * 12, 0, 1));
        c.y = lerp(c.y, hero.y - Math.sin(hero.face) * 12, clamp(dt * 12, 0, 1));
        c.z = hero.z + 8;
      } else c.z = 0;
    }
    this.hitStop = Math.max(0, this.hitStop - dt);
  },

  shadows(sctx, cam, L, VW, VH) {
    for (const e of this.enemies) {
      const sx = e.x - cam.x, sy = e.y - cam.y;
      if (sx < -160 || sy < -160 || sx > VW + 160 || sy > VH + 160) continue;
      e.shadow(sctx, cam, L);
    }
    for (const c of this.civilians) blobShadow(sctx, cam, L, c.x, c.y, c.z || 0, 30, 10);
  },

  collect(list, cam, VW, VH) {
    for (const e of this.enemies) {
      const sx = e.x - cam.x, sy = e.y - cam.y;
      if (sx < -160 || sy < -160 || sx > VW + 160 || sy > VH + 160) continue;
      list.push({ key: e.z > 6 ? 1e6 + e.y : e.y, o: e, kind: 'enemy' });
    }
    for (const c of this.civilians) list.push({ key: c.carried ? 1e6 + c.y : c.y, o: c, kind: 'civil' });
  },

  drawGroundFx(ctx, cam, L) {
    for (const r of this.rings) {
      const k = r.t / 0.5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(r.col, (1 - k) * 0.8);
      ctx.lineWidth = 7 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x - cam.x, r.y - cam.y, r.r * k, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  },

  drawShots(ctx, cam) {
    ctx.save();
    for (const s of this.shots) {
      const x = s.x - cam.x, y = s.y - cam.y - (s.z || 0);
      ctx.globalCompositeOperation = 'lighter';
      if (s.kind === 'rail') {
        const g = ctx.createLinearGradient(x - s.vx * 0.045, y - s.vy * 0.045, x, y);
        g.addColorStop(0, 'rgba(255,180,84,0)');
        g.addColorStop(1, 'rgba(255,240,200,0.95)');
        ctx.strokeStyle = g; ctx.lineWidth = s.w || 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - s.vx * 0.045, y - s.vy * 0.045); ctx.lineTo(x, y); ctx.stroke();
      } else if (s.kind === 'sonic') {
        const a = Math.atan2(s.vy, s.vx);
        ctx.strokeStyle = 'rgba(200,240,255,0.7)'; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(x - Math.cos(a) * i * 20, y - Math.sin(a) * i * 20, 15 + i * 5, a - 1, a + 1);
          ctx.stroke();
        }
      } else {
        const col = s.mine ? (s.kind === 'acid' ? '#9be86b' : s.kind === 'web' ? '#e8f0ff' : '#ffd28a') : '#ff7a5c';
        const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
        g.addColorStop(0, rgba(col, 0.95)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  },

  drawCivilian(ctx, cam, L, c) {
    ctx.save();
    ctx.translate(c.x - cam.x, c.y - cam.y - (c.z || 0));
    ctx.fillStyle = c.col;
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e9b189';
    ctx.beginPath(); ctx.arc(2, 0, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#20222e';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
    ctx.restore();
    if (!c.carried && !c.safe) {
      const bob = Math.sin(c.t * 4) * 3;
      ctx.fillStyle = '#ffd05c';
      ctx.font = `800 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', c.x - cam.x, c.y - cam.y - 22 + bob);
    }
  },
};
