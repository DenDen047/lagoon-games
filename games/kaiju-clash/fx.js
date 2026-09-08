/* =========================================================================
   KAIJU CLASH ― 技の見た目
   弾、置いておく雲、光線、ヒットの火花、砂ぼこり。
   すべて世界座標で持ち、描くときは world 変換の中で使う。
   ========================================================================= */
'use strict';

const FX = {
  /* ------------------------------ 弾 ------------------------------ */
  spawnShots(B, f, def, wave) {
    const s = def.shot;
    const foe = B.foeOf(f);
    const muzzle = FX.muzzle(f, s.y);
    const base = Math.atan2(
      (foe.y + foe.k.size * 0.45) - muzzle.y,
      (foe.x - muzzle.x) * f.facing
    );
    const aim = s.homing != null || s.gravity ? clamp(base, -0.7, 0.7) : 0;
    for (let i = 0; i < s.count; i++) {
      const off = s.count > 1 ? (i - (s.count - 1) / 2) * s.spread : 0;
      const a = aim + off + (wave ? Math.sin(wave * 1.7) * 0.05 : 0);
      B.shots.push({
        x: muzzle.x, y: muzzle.y,
        vx: Math.cos(a) * s.speed * f.facing,
        vy: Math.sin(a) * s.speed,
        g: s.gravity || 0, r: s.size, life: 150,
        col: s.color, trail: s.trail, kind: s.kind || 'orb',
        spin: s.spin ? rand(0.4, -0.4) : 0, a: 0,
        homing: s.homing || 0, owner: f.side, dmg: def.dmg, def,
        hit: false, t: 0,
      });
    }
    Sound.shot();
  },

  muzzle(f, y) {
    const k = f.k;
    let fx = 0.34, fy = (y != null ? y : k.size * 0.8);
    if (k.form === 'ape') fx = 0.3;
    if (k.form === 'cephalopod') fx = 0.28;
    if (k.form === 'mecha') fx = 0.36;
    return { x: f.x + f.facing * k.size * fx, y: f.y + fy };
  },

  updateShots(B) {
    for (let i = B.shots.length - 1; i >= 0; i--) {
      const s = B.shots[i];
      s.t++;
      if (s.homing) {
        const foe = B.fighters[1 - s.owner];
        const tx = foe.x, ty = foe.y + foe.k.size * 0.45;
        const a = Math.atan2(ty - s.y, tx - s.x);
        const sp = Math.hypot(s.vx, s.vy);
        const ca = Math.atan2(s.vy, s.vx);
        let d = a - ca;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const na = ca + clamp(d, -s.homing, s.homing);
        s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
      }
      s.x += s.vx; s.y += s.vy; s.vy -= s.g;
      s.a += s.spin;
      s.life--;
      if (s.kind === 'missile' && s.t % 2 === 0) {
        B.fx.push({ kind: 'puff', x: s.x, y: s.y, r: s.r * 0.8, life: 14, max: 14, col: '#ffd8bc' });
      }
      /* 建物はなぎ倒すが、弾は止まらない */
      if (s.y < 300 && s.t % 3 === 0
        && hitBuildings(B.stage, s.x - s.r, s.x + s.r, s.y - s.r, s.y + s.r, s.dmg * 0.9, sign(s.vx))) {
        FX.burst(B, s.x, s.y, s.r * 1.3, s.col);
      }
      if (s.y <= 0) {
        FX.burst(B, s.x, 6, s.r * 1.5, s.col);
        B.shake(4);
        B.shots.splice(i, 1); continue;
      }
      if (s.life <= 0 || Math.abs(s.x) > WORLD_W) { B.shots.splice(i, 1); continue; }
      /* 相手に当たる */
      const foe = B.fighters[1 - s.owner];
      if (B.overlapFighter(foe, s.x - s.r, s.x + s.r, s.y - s.r, s.y + s.r)) {
        B.applyHit(B.fighters[s.owner], foe, s.def, s.x, s.y, { projectile: true });
        FX.burst(B, s.x, s.y, s.r * 1.8, s.col);
        B.shots.splice(i, 1);
      }
    }
  },

  drawShots(ctx, B) {
    for (const s of B.shots) {
      ctx.save();
      ctx.translate(s.x, -s.y);
      if (s.kind === 'lava') {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.r * 2.6);
        g.addColorStop(0, 'rgba(255,235,150,.95)');
        g.addColorStop(0.4, rgba(s.col, 0.7));
        g.addColorStop(1, rgba(s.col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, s.r * 2.6, 0, Math.PI * 2); ctx.fill();
        /* 燃えかす */
        ctx.save();
        ctx.rotate(Math.atan2(-s.vy, s.vx));
        const tg = ctx.createLinearGradient(0, 0, -s.r * 5, 0);
        tg.addColorStop(0, rgba(s.col, 0.8));
        tg.addColorStop(1, rgba(s.col, 0));
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.moveTo(0, -s.r * 0.6); ctx.lineTo(-s.r * 5, 0); ctx.lineTo(0, s.r * 0.6);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.rotate(s.a);
        ctx.fillStyle = '#3a2320';
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const rr = s.r * 0.7 * (0.8 + Math.sin(i * 3.1) * 0.22);
          if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffb04a'; ctx.lineWidth = 2.4; ctx.stroke();
      } else if (s.kind === 'rock') {
        ctx.rotate(s.a);
        ctx.fillStyle = s.col;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const r = s.r * (0.8 + Math.sin(i * 3.1) * 0.25);
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = shade(s.col, -0.4); ctx.lineWidth = 2; ctx.stroke();
      } else if (s.kind === 'missile') {
        ctx.rotate(-Math.atan2(s.vy, s.vx));
        ctx.fillStyle = '#e9edf2';
        ctx.beginPath();
        ctx.moveTo(s.r * 1.6, 0); ctx.lineTo(-s.r, -s.r * 0.6);
        ctx.lineTo(-s.r, s.r * 0.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = s.col;
        ctx.fillRect(-s.r * 1.6, -s.r * 0.4, s.r * 0.7, s.r * 0.8);
      } else {
        /* 尾を先に引いてから玉を重ねる */
        const len = Math.hypot(s.vx, s.vy) * 3.2;
        const ang = Math.atan2(-s.vy, s.vx);
        ctx.save();
        ctx.rotate(ang);
        const tg = ctx.createLinearGradient(0, 0, -len, 0);
        tg.addColorStop(0, rgba(s.trail || s.col, 0.75));
        tg.addColorStop(1, rgba(s.trail || s.col, 0));
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.moveTo(0, -s.r * 0.75);
        ctx.lineTo(-len, 0);
        ctx.lineTo(0, s.r * 0.75);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.r * 2);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.32, s.col);
        g.addColorStop(1, rgba(s.trail || s.col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, s.r * 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  },

  /* ------------------------------ 置いておく雲・渦 ------------------------------ */
  spawnZone(B, f, def) {
    const t = def.type;
    if (t === 'cloud') {
      const c = def.cloud;
      B.zones.push({
        kind: 'cloud', x: f.x + f.facing * c.x, y: c.y, r: c.r,
        life: c.life, max: c.life, owner: f.side, def, col: c.color,
        slow: c.slow, blind: c.blind, tick: def.tick, t: 0,
      });
    } else if (t === 'storm') {
      const s = def.storm;
      B.zones.push({
        kind: 'storm', x: f.x, y: 0, w: s.w, follow: f.side,
        life: def.active, max: def.active, owner: f.side, def, col: s.color,
        motes: s.motes, tick: def.tick, t: 0,
      });
    } else if (t === 'vortex') {
      const v = def.vortex;
      B.zones.push({
        kind: 'vortex', x: f.x + f.facing * v.x, y: v.r * 0.6, r: v.r,
        life: def.active, max: def.active, owner: f.side, def, col: v.color,
        pull: v.pull, tick: def.tick, t: 0,
      });
    } else if (t === 'pillar') {
      const p = def.pillar;
      const foe = B.foeOf(f);
      B.zones.push({
        kind: 'pillar', x: foe.x, y: 0, w: p.w, h: p.h,
        life: def.active, max: def.active, owner: f.side, def,
        col: p.color, core: p.core, t: 0, once: true,
      });
      Sound.boom();
      B.shake(9);
    }
  },

  spawnRain(B, f, def) {
    const r = def.rain;
    const foe = B.foeOf(f);
    const cx = foe.x + rand(r.spread, -r.spread) * 0.5;
    B.shots.push({
      x: cx, y: 640, vx: rand(1.2, -1.2), vy: -6, g: 0.3, r: r.size,
      life: 160, col: r.color, trail: '#ffcf6a', kind: 'lava', spin: rand(0.3, -0.3),
      a: 0, homing: 0, owner: f.side, dmg: def.dmg, def, t: 0,
    });
  },

  updateZones(B) {
    for (let i = B.zones.length - 1; i >= 0; i--) {
      const z = B.zones[i];
      z.t++; z.life--;
      const owner = B.fighters[z.owner];
      const foe = B.fighters[1 - z.owner];
      if (z.kind === 'storm') z.x = owner.x;
      if (z.kind === 'pillar' && z.t === 1) {
        hitBuildings(B.stage, z.x - z.w, z.x + z.w, 0, z.h, 300, 0);
      }
      /* 当たり判定 */
      let inside = false;
      if (z.kind === 'cloud' || z.kind === 'vortex') {
        const dx = foe.x - z.x, dy = (foe.y + foe.k.size * 0.4) - z.y;
        inside = Math.hypot(dx, dy) < z.r + foe.k.size * 0.22;
        if (z.kind === 'vortex' && inside) {
          foe.vx += -sign(dx) * z.pull * 0.35;
          if (foe.onGround === false) foe.vy += 0.2;
        }
      } else if (z.kind === 'storm') {
        inside = Math.abs(foe.x - z.x) < z.w / 2;
      } else if (z.kind === 'pillar') {
        inside = Math.abs(foe.x - z.x) < z.w * 0.7 && foe.y < z.h;
      }
      if (inside && z.t % (z.tick || 8) === 0) {
        B.applyHit(owner, foe, z.def, foe.x, foe.y + foe.k.size * 0.4, { zone: true });
        if (z.slow) foe.slow = Math.max(foe.slow, 20);
        if (z.blind) foe.blind = Math.max(foe.blind, 50);
      }
      if (z.life <= 0) B.zones.splice(i, 1);
    }
  },

  drawZones(ctx, B) {
    for (const z of B.zones) {
      const fade = clamp(z.life / 40, 0, 1);
      ctx.save();
      if (z.kind === 'cloud') {
        ctx.globalAlpha = fade * 0.75;
        const g = ctx.createRadialGradient(z.x, -z.y, 0, z.x, -z.y, z.r);
        g.addColorStop(0, rgba(z.col, 0.95));
        g.addColorStop(0.55, rgba(z.col, 0.85));
        g.addColorStop(0.82, rgba(z.col, 0.45));
        g.addColorStop(1, rgba(z.col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(z.x, -z.y, z.r, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 10; i++) {
          const a = i * 1.9 + z.t * 0.02;
          const rr = z.r * (0.3 + (i % 4) * 0.16);
          ctx.globalAlpha = fade * 0.5;
          ctx.beginPath();
          ctx.arc(z.x + Math.cos(a) * rr, -z.y + Math.sin(a * 1.3) * rr * 0.6, z.r * 0.34, 0, Math.PI * 2);
          ctx.fillStyle = rgba(z.col, 0.7); ctx.fill();
        }
      } else if (z.kind === 'storm') {
        const H = 760;
        ctx.globalAlpha = fade;
        const g = ctx.createLinearGradient(0, -H, 0, 0);
        g.addColorStop(0, rgba(z.col, 0.04));
        g.addColorStop(0.65, rgba(z.col, 0.14));
        g.addColorStop(1, rgba(z.col, 0.26));
        ctx.fillStyle = g;
        ctx.fillRect(z.x - z.w / 2, -H, z.w, H);
        /* 内側の明るい芯 */
        const g2 = ctx.createLinearGradient(z.x - z.w / 2, 0, z.x + z.w / 2, 0);
        g2.addColorStop(0, rgba(z.col, 0));
        g2.addColorStop(0.5, rgba('#ffffff', 0.14));
        g2.addColorStop(1, rgba(z.col, 0));
        ctx.fillStyle = g2;
        ctx.fillRect(z.x - z.w / 2, -H, z.w, H);
        /* 降ってくる鱗粉 */
        for (let i = 0; i < z.motes; i++) {
          const ph = (z.t * 7 + i * 41) % H;
          const px = z.x - z.w / 2 + ((i * 137) % z.w) + Math.sin(z.t * 0.06 + i) * 14;
          const py = -H + ph;
          const k = 1 - ph / H;
          ctx.globalAlpha = fade * (0.35 + k * 0.55);
          ctx.fillStyle = '#ffffff';
          const r = 2 + (i % 3);
          ctx.beginPath();
          ctx.moveTo(px, py - r * 3); ctx.lineTo(px + r, py); ctx.lineTo(px, py + r * 3); ctx.lineTo(px - r, py);
          ctx.closePath(); ctx.fill();
        }
        /* 地面のにじみ */
        ctx.globalAlpha = fade * 0.45;
        const g3 = ctx.createRadialGradient(z.x, 0, 0, z.x, 0, z.w * 0.55);
        g3.addColorStop(0, rgba('#ffffff', 0.4));
        g3.addColorStop(1, rgba(z.col, 0));
        ctx.fillStyle = g3;
        ctx.beginPath(); ctx.ellipse(z.x, 0, z.w * 0.55, z.w * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      } else if (z.kind === 'vortex') {
        ctx.globalAlpha = fade * 0.85;
        ctx.translate(z.x, -z.y);
        ctx.rotate(z.t * 0.09);
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          const rr = z.r * (0.35 + i * 0.16);
          ctx.arc(0, 0, rr, i * 0.6, i * 0.6 + 2.4);
          ctx.strokeStyle = rgba(z.col, 0.75 - i * 0.1);
          ctx.lineWidth = 12 - i * 1.6;
          ctx.stroke();
        }
        ctx.globalAlpha = fade * 0.3;
        ctx.beginPath(); ctx.arc(0, 0, z.r, 0, Math.PI * 2);
        ctx.fillStyle = rgba(z.col, 0.18); ctx.fill();
      } else if (z.kind === 'pillar') {
        const grow = clamp(z.t / 6, 0, 1);
        const h = z.h * grow;
        ctx.globalAlpha = fade;
        const g = ctx.createLinearGradient(0, 0, 0, -h);
        g.addColorStop(0, rgba(z.core, 0.95));
        g.addColorStop(0.4, rgba(z.col, 0.85));
        g.addColorStop(1, rgba(z.col, 0));
        ctx.fillStyle = g;
        const w = z.w * (1 + Math.sin(z.t * 0.4) * 0.08);
        ctx.beginPath();
        ctx.moveTo(z.x - w / 2, 0);
        ctx.quadraticCurveTo(z.x - w * 0.2, -h * 0.6, z.x, -h);
        ctx.quadraticCurveTo(z.x + w * 0.2, -h * 0.6, z.x + w / 2, 0);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = fade * 0.8;
        ctx.fillStyle = rgba(z.core, 0.9);
        ctx.beginPath();
        ctx.moveTo(z.x - w * 0.16, 0);
        ctx.quadraticCurveTo(z.x, -h * 0.7, z.x + w * 0.16, 0);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  },

  /* ------------------------------ 光線 ------------------------------ */
  drawBeam(ctx, B, f) {
    const a = f.act;
    if (!a || !a.def.beam) return;
    const prog = (a.frame - a.def.startup) / Math.max(1, a.def.active);
    if (prog < 0 || prog > 1) return;
    const b = a.def.beam;
    const m = FX.muzzle(f, b.y);
    const fade = prog < 0.12 ? prog / 0.12 : prog > 0.86 ? (1 - prog) / 0.14 : 1;
    const th = b.thick * fade * (1 + Math.sin(a.frame * 0.8) * 0.08);
    const len = b.len;
    ctx.save();
    ctx.translate(m.x, -m.y);
    ctx.scale(f.facing, 1);
    /* 外側 */
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, rgba(b.color, 0.95));
    g.addColorStop(0.7, rgba(b.color, 0.6));
    g.addColorStop(1, rgba(b.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -th * 0.7);
    ctx.lineTo(len, -th * 1.5);
    ctx.lineTo(len, th * 1.5);
    ctx.lineTo(0, th * 0.7);
    ctx.closePath(); ctx.fill();
    /* 芯 */
    ctx.fillStyle = b.core;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(0, -th * 0.28);
    ctx.lineTo(len, -th * 0.55);
    ctx.lineTo(len, th * 0.55);
    ctx.lineTo(0, th * 0.28);
    ctx.closePath(); ctx.fill();
    /* 口元の光 */
    ctx.globalAlpha = 0.8;
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, th * 2.4);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(1, rgba(b.color, 0));
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, th * 2.4, 0, Math.PI * 2); ctx.fill();
    /* 走る輪 */
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      const t = ((a.frame * 0.06 + i * 0.2) % 1);
      const x = t * len;
      ctx.beginPath();
      ctx.ellipse(x, 0, th * 0.3, th * (0.9 + t * 0.6), 0, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(b.core, 0.6); ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
  },

  /* ------------------------------ 火花・ほこり ------------------------------ */
  hit(B, x, y, power, col) {
    B.fx.push({ kind: 'flash', x, y, r: 22 + power * 0.35, life: 10, max: 10, col: col || '#fff2b0' });
    const n = 6 + Math.floor(power * 0.12);
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI * 2, 0);
      const sp = rand(9, 2.5) * (0.6 + power * 0.008);
      B.fx.push({
        kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: randInt(14, 26), max: 26, col: col || '#ffd76e', r: rand(5, 2),
      });
    }
  },
  burst(B, x, y, r, col) {
    B.fx.push({ kind: 'ring', x, y, r: r * 0.4, max: 18, life: 18, col: col || '#fff', grow: r * 0.12 });
    for (let i = 0; i < 10; i++) {
      const a = rand(Math.PI * 2, 0);
      B.fx.push({
        kind: 'spark', x, y, vx: Math.cos(a) * rand(7, 2), vy: Math.sin(a) * rand(7, 2),
        life: randInt(10, 22), max: 22, col: col || '#fff', r: rand(4, 1.6),
      });
    }
  },
  dust(B, x, n, col) {
    for (let i = 0; i < (n || 6); i++) {
      B.fx.push({
        kind: 'dust', x: x + rand(30, -30), y: rand(14, 0),
        vx: rand(3.5, -3.5), vy: rand(3.2, 0.6), r: rand(26, 12),
        life: randInt(22, 40), max: 40, col: col || '#cfc4b4',
      });
    }
  },
  quake(B, x, power) {
    B.shake(power * 6);
    FX.dust(B, x, 10);
    B.fx.push({ kind: 'shock', x, y: 4, r: 20, max: 24, life: 24, col: '#ffffff', grow: 22 });
    hitBuildings(B.stage, x - 190, x + 190, 0, 30, 26 * power, 0);
  },

  updateFx(B) {
    for (let i = B.fx.length - 1; i >= 0; i--) {
      const p = B.fx[i];
      p.life--;
      if (p.kind === 'spark') { p.x += p.vx; p.y += p.vy; p.vy -= 0.45; p.vx *= 0.94; }
      else if (p.kind === 'dust') { p.x += p.vx; p.y += p.vy; p.vy *= 0.92; p.r += 0.9; }
      else if (p.kind === 'ring' || p.kind === 'shock') p.r += p.grow;
      if (p.life <= 0) B.fx.splice(i, 1);
    }
  },

  drawFx(ctx, B) {
    for (const p of B.fx) {
      const k = p.life / p.max;
      ctx.save();
      if (p.kind === 'spark') {
        ctx.globalAlpha = clamp(k, 0, 1);
        ctx.strokeStyle = p.col;
        ctx.lineWidth = p.r * 0.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, -p.y);
        ctx.lineTo(p.x - p.vx * 1.6, -p.y + p.vy * 1.6);
        ctx.stroke();
      } else if (p.kind === 'flash') {
        ctx.globalAlpha = clamp(k, 0, 1) * 0.95;
        const g = ctx.createRadialGradient(p.x, -p.y, 0, p.x, -p.y, p.r * (2 - k));
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, p.col);
        g.addColorStop(1, rgba(p.col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, -p.y, p.r * (2 - k), 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.globalAlpha = clamp(k, 0, 1) * 0.8;
        ctx.strokeStyle = p.col; ctx.lineWidth = 6 * k + 1;
        ctx.beginPath(); ctx.arc(p.x, -p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'shock') {
        ctx.globalAlpha = clamp(k, 0, 1) * 0.55;
        ctx.strokeStyle = p.col; ctx.lineWidth = 9 * k + 2;
        ctx.beginPath(); ctx.ellipse(p.x, -p.y, p.r, p.r * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'dust') {
        ctx.globalAlpha = clamp(k, 0, 1) * 0.5;
        const g = ctx.createRadialGradient(p.x, -p.y, 0, p.x, -p.y, p.r);
        g.addColorStop(0, rgba(p.col, 0.8));
        g.addColorStop(1, rgba(p.col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, -p.y, p.r, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'puff') {
        const r = p.r * (2 - k);
        ctx.globalAlpha = clamp(k, 0, 1) * 0.75;
        const g = ctx.createRadialGradient(p.x, -p.y, 0, p.x, -p.y, r);
        g.addColorStop(0, rgba('#fff3c0', 0.9));
        g.addColorStop(0.45, rgba(p.col, 0.55));
        g.addColorStop(1, rgba(p.col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, -p.y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  },

  /* 墨をかぶった側の画面。人が操作している側だけに出す。 */
  drawBlind(ctx, amount, seed) {
    ctx.save();
    ctx.globalAlpha = clamp(amount, 0, 1) * 0.85;
    const r = mulberry32(seed);
    for (let i = 0; i < 14; i++) {
      const x = r() * View.w, y = r() * View.h;
      const rr = 40 + r() * 130;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, 'rgba(18,6,22,.95)');
      g.addColorStop(1, 'rgba(18,6,22,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },
};
