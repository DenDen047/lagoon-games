/* =========================================================================
   SKYDROP ROYALE ― がめんに かく
   カメラ / 地図 / キャラ / 弾 / ゾーン / HUD / ミニマップ
   ========================================================================= */
'use strict';

const Cam = { x: WORLD_W / 2, y: WORLD_H / 2, z: 1 };
let canvas, ctx;

const Render = {
  bigMap: false,

  baseZoom() {
    const viewW = Input.touch ? 820 : 1060;
    return Math.max(G.W / viewW, G.H / (viewW * 0.62));
  },
  scopeZoom(p) {
    const s = curItem(p);
    if (!s || s.kind !== 'w' || s.id === 'pickaxe') return 1;
    const w = WEAPONS[s.id];
    return w.scope && (Input.mright || (Input.touch && Input.aim.on && Math.hypot(Input.aim.x, Input.aim.y) > 0.85)) ? w.scope : 1;
  },
  updateCam(dt) {
    const g = Game, me = g.me;
    let tx = me.x, ty = me.y, z = this.baseZoom();
    if (g.phase === 'bus' && me.air === 'bus') { tx = g.bus.x; ty = g.bus.y; z *= 0.42; }
    else if (me.air === 'fall' || me.air === 'glide') z *= 0.5 + (1 - me.z) * 0.35;
    else if (!me.alive) z *= 0.9;
    else {
      z /= this.scopeZoom(me);
      if (!Input.touch) { const a = Controls.aimWorld(); tx += (a.x - me.x) * 0.18; ty += (a.y - me.y) * 0.18; }
    }
    const k = 1 - Math.pow(0.0005, dt);
    Cam.x += (tx - Cam.x) * k; Cam.y += (ty - Cam.y) * k;
    Cam.z += (z - Cam.z) * (1 - Math.pow(0.02, dt));
  },
  toWorld(sx, sy) { return { x: (sx - G.W / 2) / Cam.z + Cam.x, y: (sy - G.H / 2) / Cam.z + Cam.y }; },

  draw() {
    const g = Game, me = g.me, d = G.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = GR_COL[GR.OCEAN];
    ctx.fillRect(0, 0, G.W, G.H);
    const sh = g.shake ? (Math.random() - 0.5) * g.shake : 0;
    const z = Cam.z;
    const ox = G.W / 2 - Cam.x * z + sh, oy = G.H / 2 - Cam.y * z + sh;
    ctx.setTransform(d * z, 0, 0, d * z, d * ox, d * oy);
    const vx0 = Cam.x - G.W / 2 / z, vy0 = Cam.y - G.H / 2 / z, vw = G.W / z, vh = G.H / z;

    // じめん
    ctx.imageSmoothingEnabled = false;
    const gx0 = clamp(vx0, 0, WORLD_W), gy0 = clamp(vy0, 0, WORLD_H), gx1 = clamp(vx0 + vw, 0, WORLD_W), gy1 = clamp(vy0 + vh, 0, WORLD_H);
    if (gx1 > gx0 && gy1 > gy0) ctx.drawImage(World.groundCanvas, gx0 / 5, gy0 / 5, (gx1 - gx0) / 5, (gy1 - gy0) / 5, gx0, gy0, gx1 - gx0, gy1 - gy0);
    ctx.imageSmoothingEnabled = true;

    const tx0 = Math.max(0, Math.floor(vx0 / TILE) - 1), ty0 = Math.max(0, Math.floor(vy0 / TILE) - 1);
    const tx1 = Math.min(MW - 1, Math.floor((vx0 + vw) / TILE) + 1), ty1 = Math.min(MH - 1, Math.floor((vy0 + vh) / TILE) + 2);

    // ゆかの こうか
    for (const f of g.fx) if (!f.dead) this.drawGroundFx(f);
    // もの
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * MW + tx, o = World.ob[i];
      if (!o) continue;
      const mx = OBD[o].hp;
      drawObj(ctx, o, tx, ty, mx ? World.hp[i] / mx : 1);
    }
    // おちてる アイテム
    for (const L of g.loot) {
      if (L.dead || L.x < vx0 - 40 || L.x > vx0 + vw + 40 || L.y < vy0 - 40 || L.y > vy0 + vh + 40) continue;
      const k = Math.min(1, L.age);
      const x = lerp(L.sx, L.x, k), y = lerp(L.sy, L.y, k) - Math.sin(k * Math.PI) * 18;
      drawLootItem(ctx, L.it, x, y, G.time);
    }
    // ほきゅうぶっし
    for (const f of g.fx) if (f.type === 'supply' && !f.dead) this.drawSupply(f);

    // キャラ
    const thermal = this.hasThermal(me);
    const list = g.players.filter((p) => p.alive && !p.air && p.x > vx0 - 60 && p.x < vx0 + vw + 60 && p.y > vy0 - 80 && p.y < vy0 + vh + 80);
    list.sort((a, b) => a.y - b.y);
    for (const p of list) this.drawPlayer(p, me);
    // 弾
    this.drawBullets();
    for (const b of g.beams) {
      const a = 1 - b.t / b.life;
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = b.col; ctx.lineWidth = b.wd; ctx.lineCap = 'round';
      ctx.shadowColor = b.col; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0);
      if (b.zig) { const n = 6; for (let i = 1; i < n; i++) { const t = i / n; ctx.lineTo(lerp(b.x0, b.x1, t) + rand(-8, 8), lerp(b.y0, b.y1, t) + rand(-8, 8)); } }
      ctx.lineTo(b.x1, b.y1); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = b.wd * 0.35; ctx.stroke();
      ctx.restore();
    }
    this.drawParts();
    // 木の 葉っぱ
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const o = World.ob[ty * MW + tx];
      if (o !== OB.TREE && o !== OB.PINE) continue;
      const cx = tx * TILE + TILE / 2, cy = ty * TILE;
      const near = Math.abs(me.x - cx) < 50 && me.y < cy + 30 && me.y > cy - 60;
      drawCanopy(ctx, o, tx, ty, near ? 0.4 : 1);
    }
    // やね
    const myHouse = me.alive && !me.air ? World.houseAt(me.x, me.y) : null;
    for (const h of World.houses) {
      const x = h.x0 * TILE, y = h.y0 * TILE, w = (h.x1 - h.x0 + 1) * TILE, hh = (h.y1 - h.y0 + 1) * TILE;
      if (x > vx0 + vw || x + w < vx0 || y > vy0 + vh || y + hh < vy0) continue;
      h.fade = lerp(h.fade ?? 1, h === myHouse ? 0 : 1, 0.15);
      if (h.fade < 0.03) continue;
      this.drawRoof(h, x, y, w, hh, h.fade);
    }
    // けむり
    for (const f of g.fx) if (f.type === 'smoke' && !f.dead) this.drawSmoke(f);
    // サーマル
    if (thermal) for (const p of g.players) if (p !== me && p.alive && !p.air && dist(p.x, p.y, me.x, me.y) < 1100) { ctx.save(); ctx.globalAlpha = 0.75; ctx.strokeStyle = '#ff5a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y - 6, 20, 0, TAU); ctx.stroke(); ctx.restore(); }
    // ダメージの すうじ
    for (const t of g.texts) {
      ctx.save(); ctx.globalAlpha = 1 - t.t / 0.9;
      ctx.font = `900 ${t.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#1d1a2a';
      ctx.strokeText(t.s, t.x, t.y); ctx.fillStyle = t.col; ctx.fillText(t.s, t.x, t.y);
      ctx.restore();
    }
    // 建築の かげ
    if (me.buildMode && me.alive && !me.air) this.drawBuildGhost(me);
    // ゾーン
    if (g.zone) this.drawZone(g.zone, vx0, vy0, vw, vh);
    // そらの もの
    if (g.phase === 'bus') drawAirship(ctx, g.bus.x, g.bus.y, g.bus.ang, G.time);
    for (const p of g.players) if (p.alive && (p.air === 'fall' || p.air === 'glide' || p.air === 'jump')) this.drawFlyer(p);

    // ここから がめんの ざひょう
    ctx.setTransform(d, 0, 0, d, 0, 0);
    if (g.hurtFlash > 0) {
      const grd = ctx.createRadialGradient(G.W / 2, G.H / 2, Math.min(G.W, G.H) * 0.3, G.W / 2, G.H / 2, Math.max(G.W, G.H) * 0.7);
      grd.addColorStop(0, 'rgba(255,0,0,0)'); grd.addColorStop(1, `rgba(255,30,30,${g.hurtFlash * 0.5})`);
      ctx.fillStyle = grd; ctx.fillRect(0, 0, G.W, G.H);
    }
    if (g.zone && me.alive && !me.air && dist(me.x, me.y, g.zone.x, g.zone.y) > g.zone.r) { ctx.fillStyle = 'rgba(140,60,220,0.18)'; ctx.fillRect(0, 0, G.W, G.H); }
    HUD.draw();
  },

  hasThermal(p) { const s = curItem(p); return s && s.kind === 'w' && s.id !== 'pickaxe' && WEAPONS[s.id].thermal; },

  drawPlayer(p, me) {
    let alpha = 1;
    if (p !== me) {
      const d = dist(p.x, p.y, me.x, me.y);
      if (World.inBush(p.x, p.y) && d > 110 && Game.t - (p.noiseT || -9) > 0.6) return;
      if (AI.inSmoke(p.x, p.y) && d > 90) return;
    } else if (World.inBush(p.x, p.y)) alpha = 0.55;
    const st = p.st;
    const s = curItem(p);
    const item = s && s.kind === 'w' ? (s.id === 'pickaxe' ? PICKAXE : WEAPONS[s.id]) : null;
    ctx.save();
    ctx.globalAlpha = alpha;
    // ぶき（うえむきなら からだの うしろ）
    const up = Math.sin(p.aim) < -0.25;
    const drawW = () => {
      ctx.save();
      ctx.translate(p.x, p.y - 2);
      ctx.rotate(p.aim);
      if (Math.cos(p.aim) < 0) ctx.scale(1, -1);
      let off = 8;
      const sw = Game.parts.find((q) => q.type === 'swing' && Math.abs(q.x - p.x) < 2 && Math.abs(q.y - (p.y - 4)) < 2);
      if (sw && item && item.proj === 'melee') { const k = sw.t / sw.life; ctx.rotate((k - 0.5) * item.arc * (Math.cos(p.aim) < 0 ? -1 : 1)); off = 10; }
      if (p.cd > 0 && item && item.proj !== 'melee' && p.cd > (1 / item.r) - 0.06) off = 4;
      ctx.translate(off, 2);
      if (s && s.kind === 'h') drawHeal(ctx, s.id, 0.6);
      else if (item) drawWeapon(ctx, item, s.r || 0, item.cat === 'sniper' || item.cat === 'launcher' ? 0.72 : 0.8);
      circle(ctx, 0, 1, 3.5, p.skin.tone, OUT, 1.2);
      ctx.restore();
    };
    if (up) drawW();
    drawChar(ctx, p.skin, p.x, p.y, 1, p.face, { t: G.time + p.id, walk: p.moving ? p.walk : 0 });
    if (!up) drawW();
    // じょうたい
    if (st.freeze > 0) { ctx.globalAlpha = 0.35 * alpha; circle(ctx, p.x, p.y - 4, 20, '#aef0ff', '#ffffff', 2); ctx.globalAlpha = alpha; }
    if (st.burn > 0 && Math.random() < 0.8) Game.parts.push({ type: 'fire', x: p.x + rand(-10, 10), y: p.y + rand(-14, 8), t: 0, life: 0.4 });
    if (st.poison > 0 && Math.random() < 0.3) Game.parts.push({ type: 'bubble', x: p.x + rand(-10, 10), y: p.y - 10, t: 0, life: 0.6, col: '#8aff4a' });
    if (st.stun > 0) { for (let i = 0; i < 3; i++) { const a = G.time * 4 + i * 2.1; star(ctx, p.x + Math.cos(a) * 14, p.y - 36 + Math.sin(a) * 4, 4, '#ffd23a', OUT); } }
    if (p.heal) { const k = p.heal.t / HEALS[p.heal.id].t; ctx.strokeStyle = '#5fd35a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y - 4, 24, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.stroke(); }
    // なまえと たいりょく
    if (p !== me && !p.dummy) {
      ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(p.name, p.x, p.y - 42); ctx.fillStyle = '#ffffff'; ctx.fillText(p.name, p.x, p.y - 42);
    }
    if (p !== me && (Game.t - (p.lastHurt || -9) < 3 || p.dummy)) {
      box(ctx, p.x - 18, p.y - 38, 36, 6, '#1d1a2a', 2, null);
      ctx.fillStyle = '#5fd35a'; ctx.fillRect(p.x - 17, p.y - 37, 34 * clamp(p.hp / 100, 0, 1), 2);
      ctx.fillStyle = '#4ab0ff'; ctx.fillRect(p.x - 17, p.y - 35, 34 * clamp(p.sh / 100, 0, 1), 2);
    }
    ctx.restore();
  },

  drawFlyer(p) {
    const k = p.air === 'jump' ? p.z : p.z;
    const s = 1 + k * 0.8;
    const lift = k * 60;
    ellipse(ctx, p.x, p.y + 14, 12 * (1 - k * 0.5), 4 * (1 - k * 0.5), 'rgba(0,0,0,0.25)', null);
    if (p.air === 'glide') drawGlider(ctx, p.glider, p.x, p.y - lift - 6 * s, s, G.time + p.id);
    ctx.save();
    if (p.air === 'fall') { ctx.translate(p.x, p.y - lift); ctx.rotate(p.face * 0.6); ctx.translate(-p.x, -(p.y - lift)); }
    drawChar(ctx, p.skin, p.x, p.y - lift, s, p.face, { t: G.time + p.id, noShadow: true });
    ctx.restore();
    if (p === Game.me) { ctx.fillStyle = '#ffd23a'; poly(ctx, [p.x - 7, p.y - lift - 52 * s, p.x + 7, p.y - lift - 52 * s, p.x, p.y - lift - 42 * s], '#ffd23a'); }
  },

  drawBullets() {
    for (const b of Game.bullets) {
      const a = Math.atan2(b.vy, b.vx);
      switch (b.kind) {
        case 'bullet': case 'arrow': {
          const L = b.kind === 'arrow' ? 18 : 14;
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
          if (b.kind === 'arrow') { ctx.strokeStyle = '#e8d0a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, 0); ctx.stroke(); poly(ctx, [0, -3, 6, 0, 0, 3], b.col, OUT, 1); }
          else { ctx.strokeStyle = b.col; ctx.lineWidth = b.w.cat === 'sniper' ? 4 : 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, 0); ctx.stroke(); }
          ctx.restore();
          break;
        }
        case 'orb': ctx.save(); ctx.shadowColor = b.col; ctx.shadowBlur = 12; circle(ctx, b.x, b.y, b.rad, b.col, '#ffffff', 1.5); ctx.restore(); break;
        case 'rocket': ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a); box(ctx, -9, -3.5, 16, 7, b.w.rainbow ? b.col : '#c8c0b0', 3); poly(ctx, [7, -3.5, 12, 0, 7, 3.5], '#e84a4a', OUT, 1); poly(ctx, [-9, -2, -14 - Math.random() * 6, 0, -9, 2], '#ffb52e', null); ctx.restore(); break;
        case 'flame': { const k = b.d / b.range; ctx.save(); ctx.globalAlpha = 0.75 * (1 - k); circle(ctx, b.x, b.y, b.rad, b.col, null); ctx.globalAlpha = 0.5 * (1 - k); circle(ctx, b.x, b.y, b.rad * 0.5, '#ffffff', null); ctx.restore(); break; }
        case 'grenade': {
          const zz = b.z || 0;
          ellipse(ctx, b.x, b.y + 4, 6, 2.5, 'rgba(0,0,0,0.3)', null);
          ctx.save(); ctx.translate(b.x - 6, b.y - zz); ctx.rotate(b.landed ? 0 : b.t * 12);
          if (b.w.cat === 'throw') drawThrowable(ctx, b.w, b.col); else if (b.w.id === 'piethrow') drawGadget(ctx, b.w, b.col); else circle(ctx, 6, 0, 5, '#5a6a3a');
          ctx.restore();
          if (b.landed && (b.w.fuse || 0) > 0 && Math.sin(G.time * 20) > 0) circle(ctx, b.x, b.y - zz - 8, 2.5, '#ff4a4a', null);
          break;
        }
        case 'boomerang': ctx.save(); ctx.translate(b.x - 8, b.y); ctx.rotate(b.t * 18); ctx.translate(-8, 0); drawMelee(ctx, b.w, '#ffd23a'); ctx.restore(); break;
        case 'grapple': { const o = b.owner; ctx.strokeStyle = '#2a2c34'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o.x, o.y - 4); ctx.lineTo(b.x, b.y); ctx.stroke(); circle(ctx, b.x, b.y, 4, '#8a8ea0'); break; }
      }
    }
    // グラップルで ひっぱられている せん
    for (const p of Game.players) if (p.pull && p.alive) { ctx.strokeStyle = '#2a2c34'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.pull.x, p.pull.y); ctx.stroke(); }
  },

  drawParts() {
    for (const p of Game.parts) {
      const k = p.t / p.life;
      ctx.save();
      switch (p.type) {
        case 'spark': ctx.globalAlpha = 1 - k; ctx.fillStyle = p.col; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); break;
        case 'smoke': ctx.globalAlpha = 0.4 * (1 - k); circle(ctx, p.x, p.y, p.r + k * 8, '#d8d8d8', null); break;
        case 'fire': ctx.globalAlpha = 1 - k; circle(ctx, p.x, p.y - k * 20, 5 * (1 - k) + 2, k < 0.4 ? '#ffd23a' : '#ff6a2a', null); break;
        case 'bubble': ctx.globalAlpha = 1 - k; circle(ctx, p.x, p.y - k * 20, 3, null, p.col, 1.5); break;
        case 'flash': ctx.globalAlpha = 1 - k; ctx.translate(p.x, p.y); ctx.rotate(p.a); poly(ctx, [0, -5, 14, 0, 0, 5], '#fff3a0', null); break;
        case 'boom': {
          ctx.globalAlpha = 1 - k;
          circle(ctx, p.x, p.y, p.r * (0.4 + k * 0.7), p.col || '#ff9a2a', null);
          ctx.globalAlpha = (1 - k) * 0.8; circle(ctx, p.x, p.y, p.r * (0.2 + k * 0.4), '#fff6c0', null);
          ctx.globalAlpha = (1 - k) * 0.6; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + k * 0.6), 0, TAU); ctx.stroke();
          break;
        }
        case 'ring': ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.col || '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.3 + k), 0, TAU); ctx.stroke(); break;
        case 'swing': {
          ctx.globalAlpha = 0.6 * (1 - k); ctx.strokeStyle = p.col; ctx.lineWidth = 6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.range * 0.85, p.a - p.arc / 2, p.a - p.arc / 2 + p.arc * Math.min(1, k * 1.6)); ctx.stroke();
          break;
        }
      }
      ctx.restore();
    }
  },

  drawGroundFx(f) {
    const k = f.life ? f.t / f.life : 0;
    switch (f.type) {
      case 'mine': ellipse(ctx, f.x, f.y, 10, 7, '#5a5e48'); circle(ctx, f.x, f.y - 1, 3, f.arm > 0 ? '#888' : (Math.sin(G.time * 8) > 0 ? '#ff4a4a' : '#5a1a1a'), OUT, 1); break;
      case 'banana': ctx.save(); ctx.translate(f.x - 8, f.y + 4); drawGadget(ctx, WEAPONS.banana); ctx.restore(); break;
      case 'pad': ellipse(ctx, f.x, f.y, 18, 10, '#5a5e6a'); ellipse(ctx, f.x, f.y - 2, 14, 7, Math.sin(G.time * 6) > 0 ? '#5affb0' : '#3ad090'); poly(ctx, [f.x - 5, f.y - 1, f.x, f.y - 9, f.x + 5, f.y - 1], '#ffffff', null); break;
      case 'fire': ctx.save(); ctx.globalAlpha = 0.35 * (1 - k * 0.5); circle(ctx, f.x, f.y, f.r, '#ff6a2a', null); ctx.restore(); break;
      case 'heal': ctx.save(); ctx.globalAlpha = 0.25 + Math.sin(G.time * 4) * 0.08; circle(ctx, f.x, f.y, f.r, '#ff9ae8', '#ffffff', 2); ctx.restore(); for (let i = 0; i < 3; i++) { const a = G.time + i * 2; ctx.fillStyle = '#ffffff'; ctx.font = `bold 16px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('+', f.x + Math.cos(a) * f.r * 0.5, f.y + Math.sin(a) * f.r * 0.5); } break;
      case 'sleep': ctx.save(); ctx.globalAlpha = 0.35 * (1 - k * 0.5); circle(ctx, f.x, f.y, f.r, '#c8a0ff', null); ctx.fillStyle = '#ffffff'; ctx.font = `bold 18px ${FONT}`; ctx.textAlign = 'center'; ctx.globalAlpha = 0.8; ctx.fillText('Zzz', f.x, f.y - Math.sin(G.time * 2) * 10); ctx.restore(); break;
      case 'hole': {
        ctx.save();
        for (let i = 0; i < 4; i++) { ctx.globalAlpha = 0.3; ctx.strokeStyle = '#a64aff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, (((G.time * 120 + i * 60) % 240) * (1 - k * 0.3)), 0, TAU); ctx.stroke(); }
        ctx.globalAlpha = 1; circle(ctx, f.x, f.y, 26, '#0a0010', '#c86aff', 3);
        ctx.restore();
        break;
      }
      case 'turret':
        ellipse(ctx, f.x, f.y + 10, 14, 5, 'rgba(0,0,0,0.3)', null);
        ctx.save(); ctx.translate(f.x, f.y); box(ctx, -10, -6, 20, 16, '#5a8ac8', 4); ctx.rotate(f.aim); box(ctx, 2, -3, 16, 6, '#3a3e48', 2); ctx.restore();
        circle(ctx, f.x, f.y - 8, 5, '#ffd23a', OUT, 1.2);
        break;
    }
  },
  drawSupply(f) {
    const lift = f.z * 400;
    ellipse(ctx, f.x, f.y + 12, 18 * (1 - f.z * 0.5), 6 * (1 - f.z * 0.5), 'rgba(0,0,0,0.3)', null);
    if (!f.landed) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(f.x - 14, f.y - lift - 6); ctx.lineTo(f.x, f.y - lift - 40); ctx.lineTo(f.x + 14, f.y - lift - 6); ctx.stroke();
      circle(ctx, f.x, f.y - lift - 52, 18, '#4aa8ff');
    }
    box(ctx, f.x - 16, f.y - lift - 14, 32, 26, '#2a5ab8', 4);
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(f.x - 16, f.y - lift - 4, 32, 5);
    if (f.landed) { ctx.save(); ctx.globalAlpha = 0.3 + Math.sin(G.time * 4) * 0.15; ctx.fillStyle = '#4aa8ff'; ctx.fillRect(f.x - 3, f.y - 300, 6, 290); ctx.restore(); }
  },
  drawSmoke(f) {
    const k = f.t / f.life;
    ctx.save();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + f.t * 0.2;
      const rr2 = f.r * (i ? 0.55 : 0);
      ctx.globalAlpha = 0.8 * (k > 0.8 ? (1 - k) * 5 : 1);
      circle(ctx, f.x + Math.cos(a) * rr2, f.y + Math.sin(a) * rr2, f.r * 0.55, i % 2 ? '#c8ccd4' : '#b0b4bc', null);
    }
    ctx.restore();
  },
  drawRoof(h, x, y, w, hh, a) {
    ctx.save(); ctx.globalAlpha = a;
    const c = h.col;
    ctx.fillStyle = shade(c, -0.25); ctx.fillRect(x - 4, y - 4, w + 8, hh + 8);
    ctx.fillStyle = c; ctx.fillRect(x - 4, y - 4, w + 8, hh / 2 + 4);
    ctx.fillStyle = shade(c, -0.12); ctx.fillRect(x - 4, y + hh / 2, w + 8, hh / 2 + 4);
    ctx.strokeStyle = shade(c, -0.35); ctx.lineWidth = 2;
    ctx.beginPath();
    const step = h.style === 'metal' ? 14 : 10;
    for (let yy = y + step; yy < y + hh; yy += step) { ctx.moveTo(x - 4, yy); ctx.lineTo(x + w + 4, yy); }
    ctx.stroke();
    ctx.strokeStyle = shade(c, 0.3); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 4, y + hh / 2); ctx.lineTo(x + w + 4, y + hh / 2); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.strokeRect(x - 4, y - 4, w + 8, hh + 8);
    if (h.style !== 'metal') { box(ctx, x + w * 0.7, y + 6, 14, 18, '#8a5a4a', 2); }
    ctx.restore();
  },
  drawBuildGhost(p) {
    const m = MATS[p.matSel || 0];
    for (const [tx, ty] of Game.buildCells(p)) {
      const ok = Game.canBuildAt(tx, ty, p) && p.mats[m.id] >= BUILD_COST;
      ctx.save(); ctx.globalAlpha = 0.45;
      box(ctx, tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4, ok ? m.color : '#ff4a4a', 4, '#ffffff', 2);
      ctx.restore();
    }
  },
  drawZone(z, vx0, vy0, vw, vh) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(vx0 - 10, vy0 - 10, vw + 20, vh + 20);
    ctx.arc(z.x, z.y, Math.max(1, z.r), 0, TAU, true);
    ctx.fillStyle = 'rgba(120,40,200,0.32)';
    ctx.fill('evenodd');
    ctx.strokeStyle = '#c86aff'; ctx.lineWidth = 6 / Cam.z;
    ctx.beginPath(); ctx.arc(z.x, z.y, Math.max(1, z.r), 0, TAU); ctx.stroke();
    if (z.state !== 'done') { ctx.setLineDash([24, 16]); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3 / Cam.z; ctx.beginPath(); ctx.arc(z.tx, z.ty, Math.max(1, z.tr), 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
  },
};

/* ================================ HUD ================================ */
const HUD = {
  u: 1,
  draw() {
    const g = Game, me = g.me;
    const u = (this.u = clamp(Math.min(G.W / 1280, G.H / 720) * (Input.touch ? 1.1 : 1), 0.55, 1.25));
    ctx.save();
    ctx.textBaseline = 'middle';
    this.minimap(u);
    this.feed(u);
    if (me.alive) {
      if (g.phase === 'bus' && me.air === 'bus') this.center(Input.touch ? 'とびおりる ボタンで ジャンプ！' : 'スペースキーで とびおりる！', G.H * 0.2, 26 * u, '#ffffff');
      else if (me.air === 'fall') this.center(Input.touch ? 'もういちど おすと グライダーを ひらく' : 'スペースで グライダーを ひらく', G.H * 0.2, 18 * u, '#ffffff');
      if (!me.air) { this.bars(u); this.slots(u); this.mats(u); this.prompts(u); }
    }
    if (g.banner) {
      const a = Math.min(1, g.banner.t * 2);
      ctx.globalAlpha = a;
      this.center(g.banner.text, G.H * (g.banner.small ? 0.3 : 0.26), (g.banner.small ? 20 : 34) * u, g.banner.col || '#ffffff');
      ctx.globalAlpha = 1;
    }
    if (g.hurtDir && g.t - g.hurtDir.t < 1) {
      const a = g.hurtDir.a, k = 1 - (g.t - g.hurtDir.t);
      ctx.save(); ctx.translate(G.W / 2, G.H / 2); ctx.rotate(a); ctx.globalAlpha = k;
      ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 8 * u; ctx.beginPath(); ctx.arc(0, 0, 120 * u, -0.35, 0.35); ctx.stroke();
      ctx.restore();
    }
    if (g.training) this.text('れんしゅうモード  ・  まとは 3びょうで もとに もどる', 16 * u, G.H - 16 * u - (Input.touch ? 0 : 0), 13 * u, '#ffffff', 'left', true);
    if (!Input.touch && me.alive && !me.air) this.cursor(u);
    if (Render.bigMap) this.bigMap();
    ctx.restore();
  },
  text(s, x, y, size, col, align = 'center', bold = true) {
    ctx.font = `${bold ? 900 : 500} ${size}px ${FONT}`; ctx.textAlign = align;
    ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = 'rgba(20,16,32,0.85)'; ctx.lineJoin = 'round';
    ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y);
  },
  center(s, y, size, col) { this.text(s, G.W / 2, y, size, col); },

  cursor(u) {
    const me = Game.me;
    const x = Input.mx, y = Input.my;
    const s = curItem(me);
    let spread = 6;
    if (s && s.kind === 'w' && s.id !== 'pickaxe') { const w = WEAPONS[s.id]; spread = 6 + w.s * 60; }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * spread, y + Math.sin(a) * spread); ctx.lineTo(x + Math.cos(a) * (spread + 8), y + Math.sin(a) * (spread + 8)); ctx.stroke(); }
    ctx.shadowBlur = 0;
    if (me.reload > 0) { ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, spread + 14, -Math.PI / 2, -Math.PI / 2 + (1 - me.reload / me.reloadMax) * TAU); ctx.stroke(); }
    if (me.charging && s) { const w = WEAPONS[s.id]; const k = me.charge / w.charge; ctx.strokeStyle = k >= 1 ? '#5fd35a' : '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, spread + 14, -Math.PI / 2, -Math.PI / 2 + k * TAU); ctx.stroke(); }
  },

  minimap(u) {
    const g = Game, me = g.me;
    const S = 170 * u, x0 = G.W - S - 14 * u, y0 = 14 * u;
    const view = g.phase === 'bus' || me.air ? 4200 : 1800;
    ctx.save();
    box(ctx, x0 - 3, y0 - 3, S + 6, S + 6, 'rgba(20,16,32,0.75)', 8 * u, null);
    rr(ctx, x0, y0, S, S, 6 * u); ctx.clip();
    const cx = clamp(me.x, view / 2, WORLD_W - view / 2), cy = clamp(me.y, view / 2, WORLD_H - view / 2);
    const k = S / view;
    const mc = World.mapCanvas, mk = mc.width / WORLD_W;
    ctx.fillStyle = GR_COL[GR.OCEAN]; ctx.fillRect(x0, y0, S, S);
    ctx.drawImage(mc, (cx - view / 2) * mk, (cy - view / 2) * mk, view * mk, view * mk, x0, y0, S, S);
    const wx = (X) => x0 + (X - (cx - view / 2)) * k, wy = (Y) => y0 + (Y - (cy - view / 2)) * k;
    if (g.zone) {
      const z = g.zone;
      ctx.beginPath(); ctx.rect(x0, y0, S, S); ctx.arc(wx(z.x), wy(z.y), z.r * k, 0, TAU, true); ctx.fillStyle = 'rgba(120,40,200,0.4)'; ctx.fill('evenodd');
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(wx(z.tx), wy(z.ty), z.tr * k, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    if (g.phase === 'bus') { ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx(g.bus.x0), wy(g.bus.y0)); ctx.lineTo(wx(g.bus.x1), wy(g.bus.y1)); ctx.stroke(); }
    for (const f of g.fx) if (f.type === 'supply' && !f.dead) { ctx.fillStyle = '#4aa8ff'; ctx.fillRect(wx(f.x) - 3, wy(f.y) - 3, 6, 6); }
    ctx.font = `bold ${9 * u}px ${FONT}`; ctx.textAlign = 'center';
    if (view > 3000) for (const p of World.pois) { ctx.fillStyle = '#ffffff'; ctx.fillText(p.name, wx(p.x), wy(p.y)); }
    // じぶん
    ctx.save(); ctx.translate(wx(me.x), wy(me.y)); ctx.rotate(me.aim + Math.PI / 2); poly(ctx, [0, -7 * u, 5 * u, 5 * u, -5 * u, 5 * u], '#ffd23a', OUT, 1.5); ctx.restore();
    ctx.restore();
    // した の じょうほう
    const zy = y0 + S + 18 * u;
    this.text(`👤 ${g.alive}`, x0 + 6 * u, zy, 15 * u, '#ffffff', 'left');
    this.text(`⚔ ${me.kills}`, x0 + S * 0.42, zy, 15 * u, '#ffffff', 'left');
    if (g.zone && g.zone.state !== 'done' && g.phase !== 'bus') {
      const z = g.zone;
      const left = Math.ceil(z.state === 'wait' ? z.wait - z.t : z.shrink - z.t);
      this.text(`${z.state === 'wait' ? '⏱' : '⚠'} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, x0 + S - 4 * u, zy, 15 * u, z.state === 'wait' ? '#ffffff' : '#ff9af0', 'right');
    }
    this.mapRect = { x: x0, y: y0, w: S, h: S };
  },

  bigMap() {
    const g = Game, me = g.me;
    const S = Math.min(G.W, G.H) * 0.86, x0 = (G.W - S) / 2, y0 = (G.H - S) / 2;
    ctx.fillStyle = 'rgba(10,8,20,0.6)'; ctx.fillRect(0, 0, G.W, G.H);
    box(ctx, x0 - 6, y0 - 6, S + 12, S + 12, '#1d1a2a', 12, null);
    ctx.drawImage(World.mapCanvas, x0, y0, S, S);
    const k = S / WORLD_W;
    if (g.zone) {
      const z = g.zone;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, S, S); ctx.arc(x0 + z.x * k, y0 + z.y * k, z.r * k, 0, TAU, true); ctx.fillStyle = 'rgba(120,40,200,0.4)'; ctx.fill('evenodd'); ctx.restore();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(x0 + z.tx * k, y0 + z.ty * k, z.tr * k, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    if (g.phase === 'bus') { ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 + g.bus.x0 * k, y0 + g.bus.y0 * k); ctx.lineTo(x0 + g.bus.x1 * k, y0 + g.bus.y1 * k); ctx.stroke(); circle(ctx, x0 + g.bus.x * k, y0 + g.bus.y * k, 6, '#5ab0ff'); }
    for (const p of World.pois) this.text(p.name, x0 + p.x * k, y0 + p.y * k, 13, '#ffffff');
    poly(ctx, [x0 + me.x * k, y0 + me.y * k - 9, x0 + me.x * k + 7, y0 + me.y * k + 6, x0 + me.x * k - 7, y0 + me.y * k + 6], '#ffd23a', OUT, 2);
    this.text(Input.touch ? 'もういちど タップで とじる' : 'M キーで とじる', G.W / 2, y0 + S + 22 > G.H - 10 ? y0 + S - 16 : y0 + S + 22, 14, '#ffffff');
  },

  feed(u) {
    const g = Game;
    let y = 22 * u;
    for (const f of g.feed) {
      const age = g.t - f.t;
      if (age > 7) continue;
      ctx.globalAlpha = clamp(7 - age, 0, 1);
      this.text(f.msg, 14 * u, y, 12.5 * u, f.me ? '#ffd23a' : '#ffffff', 'left', true);
      y += 20 * u;
    }
    ctx.globalAlpha = 1;
  },

  bars(u) {
    const me = Game.me;
    const x = 18 * u, w = 230 * u, h = 16 * u;
    const y = G.H - (Input.touch ? 150 : 70) * u;
    box(ctx, x - 4, y - 4, w + 8, h * 2 + 14, 'rgba(20,16,32,0.7)', 8 * u, null);
    box(ctx, x, y, w, h, '#1a2a4a', 4, null);
    box(ctx, x, y, w * clamp(me.sh / 100, 0, 1), h, '#4ab0ff', 4, null);
    this.text(`🛡 ${Math.ceil(me.sh)}`, x + 8 * u, y + h / 2, 12 * u, '#ffffff', 'left');
    const y2 = y + h + 6;
    box(ctx, x, y2, w, h, '#1a3a1a', 4, null);
    box(ctx, x, y2, w * clamp(me.hp / 100, 0, 1), h, me.hp > 30 ? '#5fd35a' : '#ff5a4a', 4, null);
    this.text(`❤ ${Math.ceil(me.hp)}`, x + 8 * u, y2 + h / 2, 12 * u, '#ffffff', 'left');
    let sx = x + w + 14 * u;
    const st = me.st;
    for (const [k, ic] of [['burn', '🔥'], ['freeze', '❄'], ['poison', '☠'], ['stun', '💫']]) if (st[k] > 0) { this.text(ic, sx, y + h, 18 * u, '#ffffff', 'left'); sx += 26 * u; }
  },

  slotRects: [],
  slots(u) {
    const me = Game.me;
    const n = 6, sz = 58 * u, gap = 6 * u;
    const tw = n * sz + (n - 1) * gap;
    const x0 = G.W / 2 - tw / 2, y0 = G.H - sz - (Input.touch ? 14 : 16) * u;
    this.slotRects = [];
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (sz + gap);
      const s = i === 0 ? { kind: 'w', id: 'pickaxe', r: 0 } : me.inv[i - 1];
      const sel = me.sel === i && !me.buildMode;
      const rc = s && s.kind === 'w' && s.id !== 'pickaxe' ? RARITY[s.r].color : '#6a6e78';
      box(ctx, x, y0, sz, sz, s ? rgba(rc, 0.35) : 'rgba(20,16,32,0.55)', 8 * u, sel ? '#ffffff' : 'rgba(255,255,255,0.25)', sel ? 3 : 1.5);
      if (sel) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + sz * 0.3, y0 - 5 * u, sz * 0.4, 3 * u); }
      if (s) {
        ctx.save();
        ctx.translate(x + sz / 2, y0 + sz / 2 - 4 * u);
        if (s.kind === 'h') drawHeal(ctx, s.id, 1.0 * u);
        else {
          const w = s.id === 'pickaxe' ? PICKAXE : WEAPONS[s.id];
          const sc = (w.cat === 'sniper' || w.cat === 'launcher' ? 0.95 : w.cat === 'pistol' ? 1.5 : w.cat === 'throw' ? 1.6 : 1.2) * u;
          const len = ({ pistol: 15, smg: 22, ar: 30, shotgun: 31, sniper: 42, lmg: 32, launcher: 36, energy: 30, element: 28, melee: 30, bow: 18, throw: 14, toy: 22, utility: 22 }[w.cat] || 24) * sc;
          ctx.translate(-len / 2, 0);
          drawWeapon(ctx, w, s.r, sc);
        }
        ctx.restore();
        let label = '';
        if (s.kind === 'h' || (s.kind === 'w' && s.id !== 'pickaxe' && WEAPONS[s.id].stack)) label = '×' + s.n;
        else if (s.kind === 'w' && s.id !== 'pickaxe' && WEAPONS[s.id].m) label = String(s.mag);
        if (label) this.text(label, x + sz - 6 * u, y0 + sz - 9 * u, 12 * u, '#ffffff', 'right');
      }
      this.text(String(i + 1), x + 8 * u, y0 + 10 * u, 10 * u, 'rgba(255,255,255,0.7)', 'left');
      this.slotRects.push({ x, y: y0, w: sz, h: sz, i });
    }
    // いまの ぶきの なまえと 弾
    const s = curItem(me);
    if (s && !me.buildMode) {
      let name, sub = '';
      if (s.kind === 'h') { name = HEALS[s.id].name; sub = `のこり ${s.n}`; }
      else if (s.id === 'pickaxe') name = 'ツルハシ（木・いし・てつを あつめる）';
      else {
        const w = WEAPONS[s.id];
        name = `${w.name}`;
        if (w.m) sub = `${s.mag} / ${Game.training ? '∞' : me.ammo[w.ammo]}  ${AMMO[w.ammo].name}`;
        else if (w.stack) sub = `のこり ${s.n}`;
      }
      const col = s.kind === 'w' && s.id !== 'pickaxe' ? RARITY[s.r].color : '#ffffff';
      this.text(name + (s.kind === 'w' && s.id !== 'pickaxe' ? `  [${RARITY[s.r].name}]` : ''), G.W / 2, y0 - 34 * u, 15 * u, col);
      if (sub) this.text(sub, G.W / 2, y0 - 15 * u, 12 * u, '#ffffff');
    }
    if (me.buildMode) {
      const m = MATS[me.matSel || 0];
      this.text(`🧱 けんちくモード  ${m.name}  ${me.shape ? '（3れん）' : '（1マス）'}`, G.W / 2, y0 - 22 * u, 17 * u, '#ffd23a');
      if (!Input.touch) this.text('クリック: おく  1/2/3: そざい  X: かたち  Q: もどる', G.W / 2, y0 - 44 * u, 12 * u, '#ffffff');
    }
    this.slotY = y0;
  },

  matRects: [],
  mats(u) {
    const me = Game.me;
    const x0 = G.W / 2 + 3 * (58 * u + 6 * u) + 16 * u;
    const y0 = G.H - (Input.touch ? 14 : 16) * u - 58 * u;
    this.matRects = [];
    MATS.forEach((m, i) => {
      const y = y0 + i * 20 * u;
      const sel = me.buildMode && me.matSel === i;
      box(ctx, x0, y, 96 * u, 17 * u, sel ? rgba(m.color, 0.6) : 'rgba(20,16,32,0.6)', 5 * u, sel ? '#ffffff' : null, 2);
      box(ctx, x0 + 4 * u, y + 3 * u, 11 * u, 11 * u, m.color, 2, OUT, 1);
      this.text(`${m.name} ${me.mats[m.id]}`, x0 + 20 * u, y + 9 * u, 11.5 * u, '#ffffff', 'left');
      this.matRects.push({ x: x0, y, w: 96 * u, h: 17 * u, i });
    });
    // 弾の いちらん
    if (!Input.touch && !Game.training) {
      let ax = x0 + 106 * u;
      let row = 0;
      for (const k in AMMO) { if (me.ammo[k] <= 0) continue; this.text(`${AMMO[k].icon}${me.ammo[k]}`, ax + Math.floor(row / 3) * 56 * u, y0 + (row % 3) * 20 * u + 9 * u, 11 * u, AMMO[k].color, 'left'); row++; }
    }
  },

  prompts(u) {
    const me = Game.me;
    const t = Game.interactTarget(me);
    if (!t) { Controls.promptText = ''; return; }
    let s;
    if (t.type === 'chest') s = 'たからばこを あける';
    else if (t.type === 'ammobox') s = 'だんやくばこを あける';
    else if (t.type === 'supply') s = 'ほきゅうぶっしを あける';
    else {
      const it = t.L.it;
      const name = it.kind === 'h' ? HEALS[it.id].name : WEAPONS[it.id].name + ` [${RARITY[it.r].name}]`;
      const full = !me.inv.includes(null);
      s = (full ? 'いれかえる: ' : 'ひろう: ') + name;
    }
    Controls.promptText = s;
    if (!Input.touch) this.text(`E  ${s}`, G.W / 2, G.H * 0.62, 15 * u, '#ffffff');
  },
};
