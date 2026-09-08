/* =========================================================================
   SUNSET SHIFT ― 車（見下ろし）
   真上から見た形をベジェと角丸で組み、屋根の映り込み・窓・ホイールを描く。
   走りは格子の道をたどり、交差点で曲がる。左側通行。
   ========================================================================= */
'use strict';

const CAR_MODELS = {
  gt: {
    name: 'スーパーカー', len: 100, wid: 46, wheel: [[-30, 1], [28, 1]], ww: 15, wt: 7,
    nose: 0.46, tail: 0.62, roof: { x: -6, len: 34, wid: 34 },
    glassF: { x: 12, len: 16 }, glassR: { x: -24, len: 13 },
    wing: true, vent: true, low: true,
  },
  sport: {
    name: 'スポーツクーペ', len: 96, wid: 44, wheel: [[-28, 1], [27, 1]], ww: 14, wt: 7,
    nose: 0.5, tail: 0.68, roof: { x: -8, len: 32, wid: 33 },
    glassF: { x: 10, len: 16 }, glassR: { x: -25, len: 12 }, vent: true,
  },
  coupe: {
    name: 'クーペ', len: 94, wid: 44, wheel: [[-27, 1], [27, 1]], ww: 14, wt: 7,
    nose: 0.56, tail: 0.72, roof: { x: -6, len: 34, wid: 34 },
    glassF: { x: 12, len: 15 }, glassR: { x: -24, len: 13 },
  },
  sedan: {
    name: 'セダン', len: 100, wid: 44, wheel: [[-29, 1], [28, 1]], ww: 14, wt: 7,
    nose: 0.62, tail: 0.76, roof: { x: -4, len: 40, wid: 35 },
    glassF: { x: 17, len: 15 }, glassR: { x: -25, len: 14 },
  },
  suv: {
    name: 'SUV', len: 104, wid: 48, wheel: [[-30, 1], [30, 1]], ww: 15, wt: 8,
    nose: 0.78, tail: 0.86, roof: { x: -2, len: 52, wid: 40 },
    glassF: { x: 25, len: 13 }, glassR: { x: -29, len: 12 }, rack: true,
  },
  van: {
    name: 'バン', len: 112, wid: 50, wheel: [[-34, 1], [32, 1]], ww: 15, wt: 8,
    nose: 0.86, tail: 0.94, roof: { x: 2, len: 64, wid: 42 },
    glassF: { x: 33, len: 12 }, glassR: { x: -30, len: 10 }, boxy: true,
  },
};

const CAR_PAINTS = [
  { body: '#c02430' }, { body: '#14181f' }, { body: '#eceef2' }, { body: '#8d949f' },
  { body: '#1f45a0' }, { body: '#e6a81c' }, { body: '#1f7050' }, { body: '#d9581e' },
  { body: '#4e3070' }, { body: '#2c4c60' },
];

const DIRV = [[1, 0], [0, 1], [-1, 0], [0, -1]];

const Traffic = {
  cars: [],
  timer: 0,
  halted: false,

  reset() { this.cars.length = 0; this.timer = 0; this.halted = false; },

  /* 進行方向ごとの車線。左側通行なので、進む向きの左へ寄る。 */
  lanePoint(dir, i, j) {
    const q = ROADW / 4;
    if (dir === 0) return { x: City.roadX(i), y: City.roadY(j) - q };
    if (dir === 2) return { x: City.roadX(i), y: City.roadY(j) + q };
    if (dir === 1) return { x: City.roadX(i) + q, y: City.roadY(j) };
    return { x: City.roadX(i) - q, y: City.roadY(j) };
  },

  nextTarget(c) {
    let i = c.i, j = c.j;
    if (c.dir === 0) i++; else if (c.dir === 2) i--; else if (c.dir === 1) j++; else j--;
    if (i < 0 || i > COLS || j < 0 || j > ROWS) {
      /* 端に来たら曲がる。 */
      const opts = [];
      if (c.dir === 0 || c.dir === 2) { opts.push(1, 3); } else { opts.push(0, 2); }
      c.dir = pick(opts);
      i = c.i; j = c.j;
      if (c.dir === 0) i++; else if (c.dir === 2) i--; else if (c.dir === 1) j++; else j--;
      i = clamp(i, 0, COLS); j = clamp(j, 0, ROWS);
    }
    c.i = i; c.j = j;
    const p = this.lanePoint(c.dir, i, j);
    c.tx = p.x; c.ty = p.y;
  },

  turnAt(c) {
    const straight = chance(0.55);
    if (!straight) {
      const left = (c.dir + 3) % 4, right = (c.dir + 1) % 4;
      c.dir = chance(0.5) ? left : right;
    }
    this.nextTarget(c);
  },

  spawn(cam, VW, VH, forceKind) {
    const kind = forceKind || pick(['gt', 'sport', 'coupe', 'sedan', 'sedan', 'suv', 'van', 'coupe', 'sport']);
    const livery = kind === 'sedan' && chance(0.2) ? (chance(0.5) ? 'police' : 'taxi') : null;
    const paint = livery === 'police' ? { body: '#eceef2' } : livery === 'taxi' ? { body: '#f0c419' } : pick(CAR_PAINTS);
    /* カメラの少し外の交差点から出す。 */
    const ci = clamp(Math.round((cam.x + VW / 2 - ROADW / 2) / (BLOCK + ROADW)) + randi(-2, 2), 0, COLS);
    const cj = clamp(Math.round((cam.y + VH / 2 - ROADW / 2) / (BLOCK + ROADW)) + randi(-2, 2), 0, ROWS);
    const dir = randi(0, 3);
    const p = this.lanePoint(dir, ci, cj);
    const c = {
      kind, m: CAR_MODELS[kind], paint, livery,
      x: p.x, y: p.y, i: ci, j: cj, dir,
      ang: Math.atan2(DIRV[dir][1], DIRV[dir][0]),
      sp: rand(150, 250), want: 0, wheel: 0, brake: 0,
      state: 'drive', z: 0, vz: 0, spin: 0, hp: 3, wreckT: 0,
      vx: 0, vy: 0,
    };
    c.want = c.sp;
    this.nextTarget(c);
    this.cars.push(c);
    return c;
  },

  update(dt, cam, VW, VH) {
    this.timer -= dt;
    if (this.timer <= 0 && this.cars.length < 14) {
      this.timer = rand(0.5, 1.4);
      this.spawn(cam, VW, VH);
    }
    for (let k = this.cars.length - 1; k >= 0; k--) {
      const c = this.cars[k];
      if (c.state === 'held') continue;

      if (c.state === 'thrown') {
        c.x += c.vx * dt; c.y += c.vy * dt;
        c.z += c.vz * dt; c.vz += 1400 * dt;
        c.ang += c.spin * dt;
        c.vx *= Math.pow(0.4, dt); c.vy *= Math.pow(0.4, dt);
        if (c.z >= 0) {
          c.z = 0; c.vz *= -0.3;
          FX.burst(c.x, c.y, 14, { col: '#ffd08a', g: 0, spMax: 300, glow: 1, r: 2.6, drag: 0.9 });
          shakeCam(8); Sfx.heavy();
          if (Math.hypot(c.vx, c.vy) < 70) { c.state = 'wreck'; c.wreckT = 0; }
        }
        continue;
      }
      if (c.state === 'wreck') {
        c.wreckT += dt;
        if (chance(dt * 6)) FX.add({ x: c.x + rand(-30, 30), y: c.y + rand(-20, 20), vx: rand(-14, 14), vy: rand(-30, -10), g: -14, r: rand(6, 13), col: '#2a2f3a', life: rand(1, 2), shrink: false, alpha: 0.45 });
        if (c.wreckT > 24) this.cars.splice(k, 1);
        continue;
      }

      /* 目的地へ向けて曲がりながら進む。 */
      const want = this.halted ? 0 : c.want;
      c.sp = approach(c.sp, want, (want < c.sp ? 460 : 220) * dt);
      c.brake = this.halted ? Math.min(1, c.brake + dt * 3) : Math.max(0, c.brake - dt * 2);
      const da = Math.atan2(c.ty - c.y, c.tx - c.x);
      let diff = ((da - c.ang + Math.PI * 3) % TAU) - Math.PI;
      c.ang += clamp(diff, -2.6 * dt, 2.6 * dt);
      c.x += Math.cos(c.ang) * c.sp * dt;
      c.y += Math.sin(c.ang) * c.sp * dt;
      c.wheel += c.sp * dt * 0.05;
      if (dist(c.x, c.y, c.tx, c.ty) < 26) this.turnAt(c);

      if (Math.abs(c.x - (cam.x + VW / 2)) > VW * 1.4 || Math.abs(c.y - (cam.y + VH / 2)) > VH * 1.6) this.cars.splice(k, 1);
    }
  },

  halt(on) {
    this.halted = on;
    if (!on) for (const c of this.cars) if (c.state === 'drive') c.want = rand(150, 250);
  },

  grabbable(x, y, maxD = 150) {
    let best = null, bd = maxD;
    for (const c of this.cars) {
      if (c.state !== 'drive' || c.sp > 30) continue;
      const d = dist(c.x, c.y, x, y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  },

  /* ------------------------------ 影 ------------------------------ */
  shadows(sctx, cam, L, VW, VH) {
    for (const c of this.cars) {
      if (c.state === 'held') continue;
      const sx = c.x - cam.x, sy = c.y - cam.y;
      if (sx < -220 || sy < -220 || sx > VW + 220 || sy > VH + 220) continue;
      const m = c.m;
      const co = Math.cos(c.ang), si = Math.sin(c.ang);
      const hl = m.len / 2, hw = m.wid / 2;
      const pts = [[hl, -hw], [hl, hw], [-hl, hw], [-hl, -hw]].map(([px, py]) =>
        [c.x + px * co - py * si, c.y + px * si + py * co]);
      const h = 26 + c.z;
      const dx = L.dir.x * h * L.len, dy = L.dir.y * h * L.len;
      const ox = L.dir.x * c.z * L.len, oy = L.dir.y * c.z * L.len;
      const all = [];
      for (const q of pts) { all.push([q[0] + ox, q[1] + oy]); all.push([q[0] + dx, q[1] + dy]); }
      const hh = hull(all);
      sctx.beginPath();
      for (let i = 0; i < hh.length; i++) {
        const x = hh[i][0] - cam.x, y = hh[i][1] - cam.y;
        i ? sctx.lineTo(x, y) : sctx.moveTo(x, y);
      }
      sctx.closePath(); sctx.fill();
    }
  },

  collect(list, cam, VW, VH) {
    for (const c of this.cars) {
      if (c.state === 'held') continue;
      const sx = c.x - cam.x, sy = c.y - cam.y;
      if (sx < -180 || sy < -180 || sx > VW + 180 || sy > VH + 180) continue;
      list.push({ key: c.z > 6 ? 1e6 + c.y : c.y, o: c, kind: 'car' });
    }
  },

  /* ------------------------------ 描画 ------------------------------ */
  drawCar(ctx, cam, L, c) {
    ctx.save();
    ctx.translate(c.x - cam.x, c.y - cam.y - c.z);
    ctx.rotate(c.ang);
    this.paint(ctx, L, c.m, c.paint.body, c, false);
    ctx.restore();
  },

  drawParked(ctx, L, pr) {
    if (!pr._m) {
      const rng = mulberry32(pr.seed);
      const keys = Object.keys(CAR_MODELS);
      pr._m = CAR_MODELS[keys[Math.floor(rng() * keys.length)]];
      pr._col = CAR_PAINTS[Math.floor(rng() * CAR_PAINTS.length)].body;
    }
    ctx.save();
    ctx.rotate(pr.ang + Math.PI / 2);
    this.paint(ctx, L, pr._m, pr._col, { brake: 0, wheel: 0, livery: null, state: 'park' }, false);
    ctx.restore();
  },

  drawHeld(ctx, cam, L, c, x, y, z, rot) {
    const sx = x - cam.x, sy = y - cam.y - z;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, 130);
    g.addColorStop(0, 'rgba(111,211,255,0.26)');
    g.addColorStop(1, 'rgba(111,211,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sx, sy, 130, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    ctx.scale(1.05, 1.05);
    this.paint(ctx, L, c.m, c.paint.body, c, false);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(111,211,255,0.5)';
    ctx.lineWidth = 2;
    const t = performance.now() * 0.002;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(sx, sy, 78 - i * 14, 46 - i * 9, t * 0.6 + i, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  },

  /* 車体。原点は中心、鼻先が +x。 */
  paint(ctx, L, m, body, c, isRefl) {
    const wreck = c.state === 'wreck';
    const col = wreck ? mix(body, '#2a2622', 0.55) : body;
    const hl = m.len / 2, hw = m.wid / 2;
    const sky = L.pal.hor;

    /* タイヤ。 */
    ctx.fillStyle = '#14171d';
    for (const [wx] of m.wheel) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.roundRect(wx - m.ww / 2, s * (hw - 1) - m.wt / 2, m.ww, m.wt, 3);
        ctx.fill();
      }
    }

    /* 車体の輪郭。鼻とお尻を丸める。 */
    ctx.beginPath();
    ctx.moveTo(-hl * m.tail, -hw);
    ctx.lineTo(hl * m.nose, -hw);
    ctx.quadraticCurveTo(hl, -hw * 0.72, hl, 0);
    ctx.quadraticCurveTo(hl, hw * 0.72, hl * m.nose, hw);
    ctx.lineTo(-hl * m.tail, hw);
    ctx.quadraticCurveTo(-hl, hw * 0.8, -hl, 0);
    ctx.quadraticCurveTo(-hl, -hw * 0.8, -hl * m.tail, -hw);
    ctx.closePath();

    ctx.save();
    ctx.clip();
    /* 金属の階調。真上から見ると、中央がハイライトになる。 */
    const g = ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, shade(col, -0.4));
    g.addColorStop(0.18, mix(shade(col, 0.16), sky, 0.16));
    g.addColorStop(0.45, shade(col, 0.06));
    g.addColorStop(0.72, shade(col, -0.2));
    g.addColorStop(1, shade(col, -0.48));
    ctx.fillStyle = g;
    ctx.fillRect(-hl - 4, -hw - 4, m.len + 8, m.wid + 8);
    /* 空の映り込み。 */
    const rg = ctx.createLinearGradient(-hl, 0, hl, 0);
    rg.addColorStop(0, rgba(sky, 0.05));
    rg.addColorStop(0.55, rgba(sky, 0.2));
    rg.addColorStop(1, rgba(sky, 0.06));
    ctx.fillStyle = rg;
    ctx.fillRect(-hl - 4, -hw - 4, m.len + 8, m.wid + 8);
    /* 太陽の側の照り返し。 */
    if (L.direct > 0.05) {
      const a = clamp(0.1 + L.golden * 0.42, 0, 0.55);
      ctx.save();
      ctx.rotate(-c.ang || 0);
      const wg = ctx.createLinearGradient(L.sunSide * -hl * 1.4, 0, L.sunSide * hl * 1.4, 0);
      wg.addColorStop(0, rgba(L.warm, a));
      wg.addColorStop(0.6, rgba(L.warm, a * 0.15));
      wg.addColorStop(1, rgba(L.warm, 0));
      ctx.fillStyle = wg;
      ctx.fillRect(-m.len, -m.len, m.len * 2, m.len * 2);
      ctx.restore();
    }
    if (c.livery === 'police') {
      ctx.fillStyle = '#131a24';
      ctx.fillRect(-hl * 0.3, -hw, hl * 0.6, m.wid);
    } else if (c.livery === 'taxi') {
      ctx.fillStyle = '#1b2028';
      ctx.fillRect(-hl, -hw * 0.3, m.len, 5);
    }
    ctx.restore();

    ctx.strokeStyle = rgba(shade(col, -0.68), 0.9);
    ctx.lineWidth = 2;
    ctx.stroke();

    /* ボンネットとトランクの筋。 */
    ctx.strokeStyle = rgba(shade(col, -0.35), 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(m.roof.x + m.roof.len / 2 + 4, -hw * 0.5); ctx.lineTo(hl * 0.86, -hw * 0.38);
    ctx.moveTo(m.roof.x + m.roof.len / 2 + 4, hw * 0.5); ctx.lineTo(hl * 0.86, hw * 0.38);
    ctx.stroke();

    /* 屋根とガラス。 */
    const rw = m.roof.wid / 2;
    ctx.beginPath();
    ctx.roundRect(m.roof.x - m.roof.len / 2, -rw, m.roof.len, m.roof.wid, m.boxy ? 5 : 12);
    const rgd = ctx.createLinearGradient(0, -rw, 0, rw);
    rgd.addColorStop(0, mix('#2a3a4e', sky, 0.5));
    rgd.addColorStop(0.4, mix(shade(col, 0.1), sky, 0.12));
    rgd.addColorStop(1, shade(col, -0.32));
    ctx.fillStyle = rgd;
    ctx.fill();
    ctx.strokeStyle = rgba(shade(col, -0.55), 0.8);
    ctx.lineWidth = 1.6; ctx.stroke();

    const glass = (gx, glen, back) => {
      ctx.beginPath();
      ctx.moveTo(gx - glen / 2, -rw * (back ? 0.86 : 0.9));
      ctx.lineTo(gx + glen / 2, -rw * (back ? 0.7 : 0.62));
      ctx.lineTo(gx + glen / 2, rw * (back ? 0.7 : 0.62));
      ctx.lineTo(gx - glen / 2, rw * (back ? 0.86 : 0.9));
      ctx.closePath();
      const gg = ctx.createLinearGradient(0, -rw, 0, rw);
      gg.addColorStop(0, mix('#20303f', sky, 0.62));
      gg.addColorStop(0.5, mix('#16212e', sky, 0.28));
      gg.addColorStop(1, '#101822');
      ctx.fillStyle = gg;
      ctx.fill();
      if (L.golden > 0.12) {
        ctx.fillStyle = rgba(L.warm, 0.35 * L.golden);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(10,14,20,0.8)'; ctx.lineWidth = 1.4; ctx.stroke();
    };
    if (m.glassF) glass(m.glassF.x, m.glassF.len, false);
    if (m.glassR) glass(m.glassR.x, m.glassR.len, true);

    /* サイドミラー。 */
    ctx.fillStyle = shade(col, -0.12);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(m.roof.x + m.roof.len / 2 - 2, s * (hw + 3), 5, 3, 0, 0, TAU);
      ctx.fill();
    }

    /* ライト。 */
    ctx.fillStyle = '#eef4ff';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(hl - 9, s * hw * 0.62 - 4, 8, 8, 2);
      ctx.fill();
    }
    ctx.fillStyle = c.brake > 0.2 ? '#ff3524' : '#a8202a';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(-hl + 2, s * hw * 0.6 - 4, 7, 8, 2);
      ctx.fill();
    }

    if (m.wing) {
      ctx.fillStyle = shade(col, -0.24);
      ctx.beginPath(); ctx.roundRect(-hl + 2, -hw - 2, 9, m.wid + 4, 3); ctx.fill();
      ctx.strokeStyle = rgba(shade(col, -0.6), 0.8); ctx.lineWidth = 1.2; ctx.stroke();
    }
    if (m.rack) {
      ctx.strokeStyle = '#20252e'; ctx.lineWidth = 3;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(m.roof.x - m.roof.len / 2 + 6, s * rw * 0.7);
        ctx.lineTo(m.roof.x + m.roof.len / 2 - 6, s * rw * 0.7);
        ctx.stroke();
      }
    }
    if (m.vent) {
      ctx.fillStyle = 'rgba(10,14,20,0.7)';
      ctx.beginPath(); ctx.roundRect(hl * 0.42, -hw * 0.32, 14, m.wid * 0.32, 2); ctx.fill();
    }
    if (c.livery === 'police') {
      const t = performance.now() * 0.006;
      ctx.fillStyle = Math.sin(t) > 0 ? '#ff2a2a' : '#3a1010';
      ctx.fillRect(m.roof.x - 6, -rw - 5, 12, 8);
      ctx.fillStyle = Math.sin(t) > 0 ? '#2a4aff' : '#101a3a';
      ctx.fillRect(m.roof.x - 6, rw - 3, 12, 8);
    }
    if (c.livery === 'taxi') {
      ctx.fillStyle = '#f7f2e0';
      ctx.beginPath(); ctx.roundRect(m.roof.x - 10, -7, 20, 14, 3); ctx.fill();
    }

    if (wreck) {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(-hl * 0.6 + i * 16, -hw * 0.7);
        ctx.lineTo(-hl * 0.4 + i * 16, hw * 0.7);
        ctx.stroke();
      }
    }
  },

  /* 夜のライト。暗さをかけたあとに足す。 */
  drawLights(ctx, cam, L, VW, VH) {
    const night = clamp(1 - L.ambient * 1.2, 0, 1);
    if (night < 0.1) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const c of this.cars) {
      if (c.state === 'wreck' || c.state === 'held') continue;
      const sx = c.x - cam.x, sy = c.y - cam.y;
      if (sx < -320 || sy < -320 || sx > VW + 320 || sy > VH + 320) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(c.ang);
      const hl = c.m.len / 2, hw = c.m.wid / 2;
      /* 前照灯の帯。 */
      const cone = ctx.createLinearGradient(hl, 0, hl + 300, 0);
      cone.addColorStop(0, rgba('#fff2cf', 0.3 * night));
      cone.addColorStop(1, rgba('#fff2cf', 0));
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(hl - 4, -hw * 0.8); ctx.lineTo(hl - 4, hw * 0.8);
      ctx.lineTo(hl + 310, hw * 2.6); ctx.lineTo(hl + 310, -hw * 2.6);
      ctx.closePath(); ctx.fill();
      for (const s of [-1, 1]) {
        const g = ctx.createRadialGradient(hl - 4, s * hw * 0.62, 0, hl - 4, s * hw * 0.62, 40);
        g.addColorStop(0, rgba('#fffaf0', 0.65 * night)); g.addColorStop(1, rgba('#fff2cf', 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(hl - 4, s * hw * 0.62, 40, 0, TAU); ctx.fill();
      }
      const tr = c.brake > 0.2 ? 42 : 24;
      for (const s of [-1, 1]) {
        const g = ctx.createRadialGradient(-hl + 4, s * hw * 0.6, 0, -hl + 4, s * hw * 0.6, tr);
        g.addColorStop(0, rgba('#ff3a28', (c.brake > 0.2 ? 0.75 : 0.4) * night));
        g.addColorStop(1, rgba('#ff3a28', 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(-hl + 4, s * hw * 0.6, tr, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  },
};
