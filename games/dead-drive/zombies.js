/* =========================================================================
   DEAD DRIVE ― ゾンビと生存者
   ========================================================================= */
'use strict';

const GOO = '#3d4a1f';

class Zombie {
  constructor(type, x, y, sc) {
    const d = ZOMBIES[type];
    this.type = type; this.def = d;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.r = d.r;
    this.maxhp = this.hp = d.hp * sc.hp;
    this.speed = d.speed * sc.speed * rand(0.85, 1.15);
    this.dmg = d.dmg * sc.dmg;
    this.face = rand(TAU); this.anim = rand(TAU);
    this.fling = 0; this.spin = 0; this.flash = 0;
    this.burn = 0; this.burnDps = 0;
    this.atkCd = rand(0.5); this.hitCd = 0; this.spitCd = rand(1, 3);
    this.wander = rand(TAU); this.wanderT = rand(1, 3);
    this.aware = false; this.dead = false;
    this.charge = 0; this.chargeCd = rand(2, 4); this.cdir = 0;
    this.attacking = false; this.stuck = 0;
  }

  hurt(dmg, kind, scene) {
    if (this.dead) return;
    if (this.def.armor && kind === 'bullet') dmg *= this.def.armor;
    this.hp -= dmg;
    this.flash = 0.08;
    this.aware = true;
    if (this.hp <= 0) { this.dead = true; this.killedBy = kind; }
  }

  update(dt, S) {
    if (this.dead) return;
    const car = S.car;
    this.anim += dt * (4 + this.speed * 0.04);
    if (this.flash > 0) this.flash -= dt;
    if (this.hitCd > 0) this.hitCd -= dt;
    if (this.burn > 0) {
      this.burn -= dt;
      this.hurt(this.burnDps * dt, 'fire', S);
      if (this.dead) return;
      if (Math.random() < dt * 14) FX.add({ x: this.x + rand(-5, 5), y: this.y + rand(-5, 5), vx: rand(-15, 15), vy: rand(-40, -10), col: pick(['#ffb347', '#ff6a2a', '#ffd35a']), r: 3.5, life: 0.35, glow: 1 });
    }

    /* はね飛ばされている最中は操れない */
    if (this.fling > 0) {
      this.fling -= dt;
      this.spin += dt * 14;
      const k = Math.exp(-2.6 * dt);
      this.vx *= k; this.vy *= k;
      this.x += this.vx * dt; this.y += this.vy * dt;
      const hit = S.world.pushCircle(this, this.r);
      if (hit) {
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > 260) { this.hurt(sp * 0.12, 'wall', S); S.world.decal.splat(this.x, this.y, 6); }
        this.vx *= -0.3; this.vy *= -0.3;
      }
      if (Math.random() < dt * 10) S.world.decal.smear(this.x, this.y, -this.vx * 0.03, -this.vy * 0.03, 4);
      return;
    }

    /* 狙う相手を決める */
    let tx = null, ty = null, tgtCar = false;
    const dc = car && !car.dead ? dist(this.x, this.y, car.x, car.y) : 1e9;
    if (S.mode === 'raid') {
      if (dc < 230 || (this.aware && dc < 330)) { tx = car.x; ty = car.y; tgtCar = true; }
      else if (this.tower && !this.tower.dead && dist(this.x, this.y, this.tower.x, this.tower.y) < 90) { tx = this.tower.x; ty = this.tower.y; }
      else { tx = S.world.hq.x + S.world.hq.w / 2; ty = S.world.hq.y + S.world.hq.h / 2; }
    } else {
      const sense = S.sense + (this.type === 'dog' ? 200 : 0);
      if (dc < sense || (this.aware && dc < 1100)) {
        this.aware = true;
        tx = car.x + car.vx * 0.25; ty = car.y + car.vy * 0.25; tgtCar = true;
      }
    }
    /* 車へ走っている生存者のほうが近ければそちらへ。立てこもっているあいだは襲われない */
    for (const p of S.people) {
      if (p.state !== 'run' || p.dead) continue;
      const dp = dist(this.x, this.y, p.x, p.y);
      if (dp < 170 && dp < dc) { tx = p.x; ty = p.y; tgtCar = false; this.aware = true;
        if (dp < this.r + 8) { p.hp -= this.dmg * dt * 2; p.hitT = 0.2; }
      }
    }

    let want = 0, dir = this.face;
    if (tx !== null) {
      dir = Math.atan2(ty - this.y, tx - this.x);
      want = this.speed;
      if (this.def.spit && tgtCar && dc < 200) want = -this.speed * 0.4;   // 吐くゾンビは間合いをとる
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) { this.wanderT = rand(1.5, 4); this.wander = rand(TAU); }
      dir = this.wander; want = this.speed * 0.3;
    }

    /* 巨体の突進 */
    if (this.def.boss) {
      this.chargeCd -= dt;
      if (this.charge > 0) {
        this.charge -= dt; dir = this.cdir; want = this.speed * 3.6;
        if (Math.random() < dt * 20) FX.add({ x: this.x, y: this.y, vx: rand(-30, 30), vy: rand(-30, 30), col: '#6b5a44', kind: 'smoke', r: 8, grow: 20, life: 0.6, alpha: 0.5, layer: 'low' });
      } else if (tgtCar && dc < 420 && this.chargeCd <= 0) {
        this.charge = 1.3; this.chargeCd = rand(4, 6); this.cdir = Math.atan2(car.y - this.y, car.x - this.x);
        Sfx.groan(); FX.text(this.x, this.y - 40, '突進!', '#ff6a5a', 18);
      }
    }

    if (this.attacking) want *= 0.25;
    const tvx = Math.cos(dir) * want, tvy = Math.sin(dir) * want;
    const acc = (this.type === 'dog' || this.charge > 0 ? 900 : 380) * dt;
    this.vx = approach(this.vx, tvx, acc);
    this.vy = approach(this.vy, tvy, acc);
    if (Math.hypot(this.vx, this.vy) > 8) this.face = turnToward(this.face, Math.atan2(this.vy, this.vx), dt * 8);

    /* 近くのゾンビと押しあう */
    const near = S.zh.query(this.x, this.y, this.r + 16, S._nb);
    let n = 0;
    for (const o of near) {
      if (o === this || o.dead) continue;
      const dx = this.x - o.x, dy = this.y - o.y, m = this.r + o.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < m * m && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (m - d) * 0.5;
        const wk = o.def.mass / (o.def.mass + this.def.mass);
        this.x += dx / d * push * wk * 1.6; this.y += dy / d * push * wk * 1.6;
        if (++n > 6) break;
      }
    }

    this.x += this.vx * dt; this.y += this.vy * dt;
    const hit = S.world.pushCircle(this, this.r);
    this.attacking = false;

    /* 防壁・砲台・本部にぶつかったら殴る */
    if (hit && hit.hp !== undefined && hit.hp > 0 && S.mode === 'raid') {
      this.attacking = true;
      this.atkCd -= dt;
      if (this.atkCd <= 0) {
        this.atkCd = 1 / this.def.rate;
        const dmg = this.def.boss ? this.dmg * 1.5 : this.dmg;
        S.hitStructure(hit, dmg, this);
      }
    } else if (hit && tx !== null) {
      /* 建物に引っかかったら少し横へずれる */
      this.stuck += dt;
      if (this.stuck > 0.6) { this.stuck = 0; this.wander = dir + (chance(0.5) ? 1.4 : -1.4); this.wanderT = 0.8; }
    } else this.stuck = Math.max(0, this.stuck - dt);

    /* 吐く */
    if (this.def.spit && tgtCar && dc < this.def.spit.range) {
      this.spitCd -= dt;
      if (this.spitCd <= 0) {
        this.spitCd = 1 / this.def.spit.rate * rand(0.8, 1.2);
        const t = dc / 330;
        const a = Math.atan2(car.y + car.vy * t - this.y, car.x + car.vx * t - this.x);
        S.enemyShots.push({ x: this.x, y: this.y, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, life: 1.2, dmg: this.def.spit.dmg * (this.dmg / this.def.dmg) });
        Sfx.splat();
      }
    }
    if (this.aware && dc < 300 && Math.random() < dt * 0.25) Sfx.groan();
  }

  draw(ctx) {
    const d = this.def;
    const r = this.r;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(3, 4, r * 1.05, r * 0.9, 0, 0, TAU); ctx.fill();
    ctx.rotate(this.fling > 0 ? this.face + this.spin : this.face);
    const sw = Math.sin(this.anim) * 0.35;
    const skin = this.flash > 0 ? '#ffffff' : d.skin;
    const shirt = this.flash > 0 ? '#ffffff' : d.shirt;

    if (d.dog) {
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.ellipse(-2, 0, r * 1.4, r * 0.62, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = shade(d.shirt, -0.3); ctx.lineWidth = 2.5;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(4, s * 3); ctx.lineTo(6 + sw * 6, s * 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-8, s * 3); ctx.lineTo(-10 - sw * 6, s * 8); ctx.stroke();
      }
      ctx.fillStyle = shade(d.shirt, 0.1);
      ctx.beginPath(); ctx.ellipse(r * 1.35, 0, r * 0.62, r * 0.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff5a4a'; ctx.fillRect(r * 1.7, -2, 2, 1.5); ctx.fillRect(r * 1.7, 1, 2, 1.5);
      ctx.restore();
      return;
    }

    /* 腕（前へのばす） */
    const reach = this.attacking ? 1 + Math.sin(this.anim * 3) * 0.3 : 1;
    ctx.fillStyle = skin;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(r * 0.1, s * r * 0.72);
      ctx.rotate(s * sw * 0.4);
      const len = r * (d.boss ? 1.3 : 1.15) * reach;
      ctx.fillRect(0, -r * 0.18, len, r * 0.36);
      ctx.beginPath(); ctx.arc(len, 0, r * 0.24, 0, TAU); ctx.fill();
      ctx.restore();
    }
    /* 胴 */
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.ellipse(-r * 0.1, 0, r * (this.type === 'fat' ? 0.95 : 0.62), r * 0.95, 0, 0, TAU); ctx.fill();
    if (this.type === 'fat') {
      ctx.fillStyle = shade(d.shirt, -0.15);
      ctx.beginPath(); ctx.ellipse(-r * 0.05, 0, r * 0.8, r * 0.85, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.ellipse(r * 0.25, 0, r * 0.45, r * 0.55, 0, 0, TAU); ctx.fill();
    }
    if (this.type === 'bomber') {
      ctx.fillStyle = '#6a5a3a';
      for (let i = -1; i <= 1; i++) ctx.fillRect(-r * 0.5, i * r * 0.45 - 2, r * 0.7, 4);
      ctx.fillStyle = Math.sin(G.time * 12) > 0 ? '#ff3a2a' : '#5a1a14';
      ctx.beginPath(); ctx.arc(-r * 0.15, 0, 2.5, 0, TAU); ctx.fill();
    }
    if (this.type === 'armored') {
      ctx.fillStyle = '#1e242c';
      ctx.fillRect(r * 0.45, -r * 0.95, r * 0.3, r * 1.9);
      ctx.fillStyle = 'rgba(160,200,255,0.35)'; ctx.fillRect(r * 0.5, -r * 0.8, r * 0.12, r * 1.6);
    }
    if (d.boss) {
      ctx.fillStyle = shade(d.shirt, -0.2);
      ctx.beginPath(); ctx.ellipse(-r * 0.2, 0, r * 0.7, r * 1.05, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.ellipse(-r * 0.1, -r * 0.75, r * 0.4, r * 0.35, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-r * 0.1, r * 0.75, r * 0.4, r * 0.35, 0, 0, TAU); ctx.fill();
    }
    /* 頭 */
    const hr = r * (d.boss ? 0.34 : this.type === 'spitter' ? 0.62 : 0.5);
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(r * 0.12, 0, hr, 0, TAU); ctx.fill();
    ctx.fillStyle = this.type === 'armored' ? '#2a3340' : shade(d.skin, -0.45);
    ctx.beginPath(); ctx.arc(r * 0.02, 0, hr * (this.type === 'armored' ? 1.05 : 0.7), Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
    if (this.type === 'spitter') { ctx.fillStyle = '#d4f06a'; ctx.beginPath(); ctx.arc(r * 0.45, 0, hr * 0.35, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffe36a';
    ctx.fillRect(r * 0.3, -hr * 0.45, 1.8, 1.8); ctx.fillRect(r * 0.3, hr * 0.3, 1.8, 1.8);
    ctx.restore();

    if (d.boss || (this.hp < this.maxhp && this.maxhp > 60)) {
      const k = clamp(this.hp / this.maxhp, 0, 1), w = d.boss ? 60 : 26;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(this.x - w / 2, this.y - r - 12, w, 5);
      ctx.fillStyle = d.boss ? '#ff5f6d' : '#ffb347'; ctx.fillRect(this.x - w / 2 + 1, this.y - r - 11, (w - 2) * k, 3);
    }
  }
}

/* ------------------------------ 生存者 ------------------------------ */
function updatePerson(p, dt, S) {
  if (p.dead || p.state === 'aboard') return;
  p.t += dt;
  if (p.hitT > 0) p.hitT -= dt;
  if (p.hp <= 0) {
    p.dead = true;
    S.world.decal.splat(p.x, p.y, 7, '#5a1e1a');
    FX.text(p.x, p.y - 20, '間に合わなかった…', '#ff8a8a', 14);
    toast('生存者がやられてしまった', 'bad');
    return;
  }
  const car = S.car;
  const d = dist(p.x, p.y, car.x, car.y);
  const callR = p.goal ? S.world.goal.r + 60 : 170;
  if (p.state === 'stay') return;
  if (p.state === 'wait' && d < callR && car.speed < 90 && !car.dead && car.st.seats > car.riders.length) p.state = 'run';
  if (p.state === 'run') {
    const free = car.st.seats - car.riders.length;
    const a = Math.atan2(car.y - p.y, car.x - p.x);
    const stopAt = car.R + 4;
    if (d > stopAt) { p.vx = Math.cos(a) * 125; p.vy = Math.sin(a) * 125; }
    else { p.vx = 0; p.vy = 0; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    S.world.pushCircle(p, 7);
    if (d < car.R + 12) {
      if (free > 0 && car.speed < 120) {
        p.state = 'aboard';
        car.riders.push({ trait: p.trait });
        Sfx.good();
        FX.text(car.x, car.y - 40, '乗った!', '#7ee39b', 16);
        S.onBoard(p);
      } else if (free <= 0 && !p.warned) {
        p.warned = true; toast('座席がいっぱいで乗せられない', 'bad');
      }
    }
    if (d > callR + 260) p.state = 'wait';
  }
}

function drawPerson(ctx, p) {
  if (p.dead || p.state === 'aboard' || p.state === 'stay') return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 8, 7, 0, 0, TAU); ctx.fill();
  if (p.state === 'wait' && p.waving) {
    const w = Math.sin(p.t * 10) * 0.6;
    ctx.strokeStyle = '#f0c9a0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(Math.sin(w) * 10, -12 - Math.cos(w) * 4); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  ctx.fillStyle = p.hitT > 0 ? '#ffffff' : p.shirt;
  ctx.beginPath(); ctx.ellipse(0, 0, 7, 5.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f0c9a0'; ctx.beginPath(); ctx.arc(0, 0, 4.2, 0, TAU); ctx.fill();
  ctx.fillStyle = p.hair; ctx.beginPath(); ctx.arc(0, -1, 3.6, Math.PI, TAU); ctx.fill();
  ctx.restore();
  if (p.state === 'wait') {
    const bob = Math.sin(p.t * 5) * 3;
    ctx.font = `800 13px ${FONT}`; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText('たすけて!', p.x, p.y - 16 + bob); ctx.fillStyle = '#ffe9a8'; ctx.fillText('たすけて!', p.x, p.y - 16 + bob);
  }
}
