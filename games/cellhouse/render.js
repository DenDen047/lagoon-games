/* =========================================================================
   CELLHOUSE ― 描画
   真上から見下ろした図。地面 → 床 → 部屋の色 → 設計図 → 壁 → 設備 → 人 → 車 → 夜
   ========================================================================= */
'use strict';

const Render = {
  /* ------------------------------ 全体 ------------------------------ */
  frame(g) {
    const ctx = g.ctx, w = g.world, s = g.sim, cam = g.cam;
    const Z = cam.z * TILE;
    const vw = g.cw, vh = g.ch;
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.fillStyle = '#1b2016';
    ctx.fillRect(0, 0, vw, vh);
    ctx.setTransform(g.dpr * Z, 0, 0, g.dpr * Z, g.dpr * (vw / 2 - cam.x * Z), g.dpr * (vh / 2 - cam.y * Z));
    const x0 = Math.max(0, Math.floor(cam.x - vw / 2 / Z) - 1), x1 = Math.min(w.W - 1, Math.ceil(cam.x + vw / 2 / Z) + 1);
    const y0 = Math.max(0, Math.floor(cam.y - vh / 2 / Z) - 1), y1 = Math.min(w.H - 1, Math.ceil(cam.y + vh / 2 / Z) + 2);
    const view = { x0, x1, y0, y1, z: cam.z };
    this.ground(ctx, w, view);
    this.floors(ctx, w, view);
    this.dirtLayer(ctx, w, view);
    this.tunnels(ctx, w, view);
    this.zones(ctx, g, view);
    this.shadows(ctx, w, view);
    this.blueprints(ctx, g, view);
    this.walls(ctx, w, view);
    this.doors(ctx, w, view);
    this.objects(ctx, g, view);
    this.people(ctx, g, view);
    this.vehicles(ctx, s, view);
    this.effects(ctx, s);
    this.night(ctx, g, view);
    this.labels(ctx, g, view);
    this.tool(ctx, g, view);
    this.patrol(ctx, g);
  },

  /* ------------------------------ 地面 ------------------------------ */
  ground(ctx, w, v) {
    for (let y = v.y0; y <= v.y1; y++) {
      for (let x = v.x0; x <= v.x1; x++) {
        const i = y * w.W + x, gnd = w.ground[i];
        if (w.floor[i] && gnd < 2) continue;
        const h = hash2(x, y);
        if (gnd === 3) {
          ctx.fillStyle = h < 0.5 ? '#474a4f' : '#4a4d52';
          ctx.fillRect(x, y, 1.02, 1.02);
          if (y === ROAD_Y && (x % 3) === 0) { ctx.fillStyle = '#d8c46a'; ctx.fillRect(x + 0.1, y + 0.94, 1.4, 0.12); }
          if (y === ROAD_Y + 1 && h > 0.93) { ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(x + h * 0.3, y + 0.3, 0.4, 0.2); }
        } else if (gnd === 2) {
          ctx.fillStyle = '#b9b5ab';
          ctx.fillRect(x, y, 1.02, 1.02);
          ctx.fillStyle = '#a19d93';
          ctx.fillRect(x, y, 1, 0.04); ctx.fillRect(x, y, 0.04, 1);
          ctx.fillStyle = '#8a877f'; ctx.fillRect(x, y + 0.9, 1.02, 0.1);
        } else {
          const m = this.grassMix(x, y);
          const d = (h - 0.5) * 5;
          ctx.fillStyle = `rgb(${96 + m * 30 + d | 0},${138 + m * 12 + d | 0},${68 + m * 10 + d * 0.6 | 0})`;
          ctx.fillRect(x, y, 1.02, 1.02);
          if (v.z > 0.7 && h > 0.6) {
            ctx.fillStyle = gnd === 1 ? 'rgba(90,100,50,0.45)' : 'rgba(60,100,45,0.5)';
            const k = hash2(x * 3, y * 7);
            ctx.fillRect(x + k * 0.7, y + h * 0.6, 0.06, 0.2);
            ctx.fillRect(x + k * 0.7 + 0.09, y + h * 0.6 + 0.04, 0.06, 0.16);
          }
        }
      }
    }
  },

  /* 草の色むら (0〜1)。マスの境目が目立たないよう、なめらかに変える */
  grassMix(x, y) {
    const n = (a, b) => { const xi = Math.floor(a), yi = Math.floor(b), fx = a - xi, fy = b - yi;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const v00 = hash2(xi, yi), v10 = hash2(xi + 1, yi), v01 = hash2(xi, yi + 1), v11 = hash2(xi + 1, yi + 1);
      return (v00 + (v10 - v00) * sx) + ((v01 + (v11 - v01) * sx) - (v00 + (v10 - v00) * sx)) * sy; };
    return n(x / 7, y / 7) * 0.7 + n(x / 3 + 40, y / 3) * 0.3;
  },

  floors(ctx, w, v) {
    for (let y = v.y0; y <= v.y1; y++) {
      for (let x = v.x0; x <= v.x1; x++) {
        const i = y * w.W + x, f = w.floor[i];
        if (!f) continue;
        this.floorTile(ctx, f, x, y, v.z);
      }
    }
  },
  floorTile(ctx, f, x, y, z) {
    const F = FLOORS[f];
    const h = hash2(x, y);
    ctx.fillStyle = F.color;
    ctx.fillRect(x, y, 1.02, 1.02);
    if (z < 0.45) return;
    switch (F.key) {
      case 'concrete':
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(x, y, 1, 0.03); ctx.fillRect(x, y, 0.03, 1);
        if (h > 0.7) { ctx.fillStyle = 'rgba(0,0,0,0.04)'; ctx.fillRect(x + h * 0.5, y + 0.3, 0.3, 0.25); }
        break;
      case 'tile':
        ctx.fillStyle = (x + y) % 2 ? '#d2d9da' : '#e6ebec';
        ctx.fillRect(x + 0.03, y + 0.03, 0.44, 0.44); ctx.fillRect(x + 0.53, y + 0.53, 0.44, 0.44);
        ctx.fillStyle = 'rgba(80,100,110,0.12)';
        ctx.fillRect(x, y + 0.48, 1, 0.04); ctx.fillRect(x + 0.48, y, 0.04, 1);
        break;
      case 'wood':
        ctx.fillStyle = 'rgba(80,45,15,0.22)';
        ctx.fillRect(x, y + 0.24, 1, 0.03); ctx.fillRect(x, y + 0.49, 1, 0.03); ctx.fillRect(x, y + 0.74, 1, 0.03);
        ctx.fillRect(x + ((y * 7) % 5) * 0.2, y + 0.26 * ((x + y) % 3), 0.03, 0.24);
        ctx.fillStyle = 'rgba(255,230,190,0.08)';
        ctx.fillRect(x, y + h * 0.7, 1, 0.1);
        break;
      case 'carpet':
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        if ((x + y) % 2) ctx.fillRect(x + 0.2, y + 0.2, 0.6, 0.6);
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(x + h * 0.8, y + 0.1, 0.08, 0.08);
        break;
      case 'paving':
        ctx.fillStyle = 'rgba(0,0,0,0.13)';
        ctx.fillRect(x, y, 1, 0.04); ctx.fillRect(x, y + 0.5, 1, 0.04);
        ctx.fillRect(x + ((y % 2) ? 0.5 : 0), y, 0.04, 0.5);
        ctx.fillRect(x + ((y % 2) ? 0 : 0.5), y + 0.5, 0.04, 0.5);
        break;
    }
  },

  dirtLayer(ctx, w, v) {
    for (let y = v.y0; y <= v.y1; y++) {
      for (let x = v.x0; x <= v.x1; x++) {
        const d = w.dirt[y * w.W + x];
        if (d < 30) continue;
        const a = Math.min(0.45, d / 400);
        ctx.fillStyle = `rgba(90,70,40,${a})`;
        const h = hash2(x + 11, y + 5);
        ctx.beginPath();
        ctx.ellipse(x + 0.3 + h * 0.4, y + 0.35 + hash2(y, x) * 0.3, 0.22 + d / 900, 0.16 + d / 1200, h * 3, 0, TAU);
        ctx.fill();
      }
    }
  },

  tunnels(ctx, w, v) {
    for (let y = v.y0; y <= v.y1; y++) {
      for (let x = v.x0; x <= v.x1; x++) {
        const i = y * w.W + x;
        if (w.tunnelSeen[i]) {
          ctx.fillStyle = `rgba(60,35,20,${w.tunnelSeen[i] / 400})`;
          ctx.fillRect(x + 0.2, y + 0.2, 0.6, 0.6);
        }
      }
    }
  },

  zones(ctx, g, v) {
    const w = g.world;
    const strong = g.tool && (g.tool.kind === 'zone' || g.tool.kind === 'unzone');
    const show = strong || g.showZones;
    if (!show && v.z < 0.3) return;
    for (let y = v.y0; y <= v.y1; y++) {
      for (let x = v.x0; x <= v.x1; x++) {
        const i = y * w.W + x, z = w.zone[i];
        if (!z) continue;
        const r = w.roomOf(i);
        const def = ROOMS[ROOM_KEYS[z - 1]];
        ctx.fillStyle = def.color;
        ctx.globalAlpha = strong ? 0.42 : show ? 0.24 : 0.1;
        ctx.fillRect(x, y, 1.01, 1.01);
        if (r && !r.valid && (strong || show)) {
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#c03030';
          if ((x + y) % 2 === 0) ctx.fillRect(x + 0.42, y + 0.42, 0.16, 0.16);
        }
      }
    }
    ctx.globalAlpha = 1;
  },

  shadows(ctx, w, v) {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = v.y0; y <= v.y1; y++) {
      for (let x = v.x0; x <= v.x1; x++) {
        const i = y * w.W + x;
        if (!w.wall[i] || w.wall[i] === 3) continue;
        if (y + 1 < w.H && !w.wall[i + w.W]) ctx.fillRect(x + 0.05, y + 1, 1, 0.22);
        if (x + 1 < w.W && !w.wall[i + 1]) ctx.fillRect(x + 1, y + 0.1, 0.16, 1);
      }
    }
  },

  /* ------------------------------ 設計図 ------------------------------ */
  blueprints(ctx, g, v) {
    const jobs = g.sim.jobs;
    ctx.lineWidth = 0.05;
    const inView = (j) => j.x >= v.x0 - 4 && j.x <= v.x1 && j.y >= v.y0 - 4 && j.y <= v.y1;
    for (const j of jobs.list) {
      if (!inView(j)) continue;
      const pr = Math.min(1, j.prog / jobs.workTime(j));
      if (j.kind === 'floor') {
        ctx.fillStyle = 'rgba(90,160,230,0.22)';
        ctx.fillRect(j.x + 0.04, j.y + 0.04, 0.92, 0.92);
      } else if (j.kind === 'wall' || j.kind === 'door') {
        ctx.fillStyle = 'rgba(90,160,230,0.38)';
        ctx.fillRect(j.x + 0.08, j.y + 0.08, 0.84, 0.84);
        ctx.strokeStyle = 'rgba(160,210,255,0.8)';
        ctx.strokeRect(j.x + 0.1, j.y + 0.1, 0.8, 0.8);
        if (j.kind === 'door') { ctx.fillStyle = 'rgba(220,240,255,0.8)'; ctx.fillRect(j.x + 0.3, j.y + 0.44, 0.4, 0.12); }
      } else if (j.kind === 'obj') {
        const [fw, fh] = g.world.footprint(j.key, j.rot);
        ctx.save();
        ctx.globalAlpha = 0.45;
        this.drawObj(ctx, { key: j.key, def: OBJECTS[j.key], x: j.x, y: j.y, rot: j.rot, w: fw, h: fh, hp: 100, food: 0, t: 0 }, g.sim, true);
        ctx.restore();
        ctx.strokeStyle = 'rgba(160,210,255,0.85)';
        ctx.strokeRect(j.x + 0.04, j.y + 0.04, fw - 0.08, fh - 0.08);
      } else {
        const col = j.kind === 'repair' ? 'rgba(255,200,60,0.9)' : 'rgba(255,90,70,0.85)';
        ctx.strokeStyle = col;
        ctx.beginPath();
        if (j.kind === 'repair') { ctx.arc(j.x + 0.5, j.y + 0.5, 0.32, 0, TAU); }
        else {
          const tiles = j.tiles.length > 1 ? j.tiles : [j.i];
          for (const t of tiles) {
            const tx = t % MAP_W, ty = (t / MAP_W) | 0;
            ctx.moveTo(tx + 0.2, ty + 0.2); ctx.lineTo(tx + 0.8, ty + 0.8);
            ctx.moveTo(tx + 0.8, ty + 0.2); ctx.lineTo(tx + 0.2, ty + 0.8);
          }
        }
        ctx.stroke();
      }
      if (pr > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(j.x + 0.1, j.y - 0.14, 0.8, 0.1);
        ctx.fillStyle = '#7fd4ff'; ctx.fillRect(j.x + 0.1, j.y - 0.14, 0.8 * pr, 0.1);
      }
    }
  },

  /* ------------------------------ 壁と扉 ------------------------------ */
  walls(ctx, w, v) {
    for (let y = v.y0; y <= v.y1; y++) {
      for (let x = v.x0; x <= v.x1; x++) {
        const i = y * w.W + x, t = w.wall[i];
        if (!t) continue;
        const W_ = WALLS[t];
        const n = (dx, dy) => { const nx = x + dx, ny = y + dy; if (!w.inb(nx, ny)) return false; const j = ny * w.W + nx; return !!(w.wall[j] || w.door[j]); };
        if (t === 3) { this.fence(ctx, x, y, n); continue; }
        ctx.fillStyle = W_.color;
        ctx.fillRect(x, y, 1.01, 1.01);
        ctx.fillStyle = W_.top;
        const e = 0.12;
        const l = n(-1, 0) ? 0 : e, r = n(1, 0) ? 0 : e, u = n(0, -1) ? 0 : e, d = n(0, 1) ? 0 : e;
        ctx.fillRect(x + l, y + u, 1 - l - r + (r ? 0 : 0.01), 1 - u - d - 0.08 + (d ? 0 : 0.08));
        if (v.z > 0.5) {
          if (t === 1) {
            ctx.fillStyle = 'rgba(70,30,20,0.35)';
            const off = (y % 2) * 0.25;
            ctx.fillRect(x, y + 0.33, 1, 0.03); ctx.fillRect(x, y + 0.66, 1, 0.03);
            ctx.fillRect(x + 0.25 + off, y + 0.02, 0.03, 0.31); ctx.fillRect(x + 0.75 - off, y + 0.36, 0.03, 0.3); ctx.fillRect(x + 0.25 + off, y + 0.69, 0.03, 0.28);
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(x + 0.1, y + 0.12, 0.8, 0.05);
          }
        }
        if (w.hp[i] > 0 && w.hp[i] < 60) { ctx.strokeStyle = 'rgba(30,20,20,0.6)'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(x + 0.2, y + 0.3); ctx.lineTo(x + 0.5, y + 0.55); ctx.lineTo(x + 0.4, y + 0.8); ctx.stroke(); }
      }
    }
  },
  fence(ctx, x, y, n) {
    ctx.strokeStyle = 'rgba(150,158,166,0.9)';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    const cx = x + 0.5, cy = y + 0.5;
    if (n(1, 0)) { ctx.moveTo(cx, cy); ctx.lineTo(x + 1, cy); }
    if (n(-1, 0)) { ctx.moveTo(cx, cy); ctx.lineTo(x, cy); }
    if (n(0, 1)) { ctx.moveTo(cx, cy); ctx.lineTo(cx, y + 1); }
    if (n(0, -1)) { ctx.moveTo(cx, cy); ctx.lineTo(cx, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,206,212,0.35)';
    ctx.lineWidth = 0.18;
    ctx.stroke();
    ctx.fillStyle = '#6d747b';
    ctx.fillRect(cx - 0.08, cy - 0.08, 0.16, 0.16);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(cx - 0.02, cy + 0.08, 0.14, 0.12);
  },
  doors(ctx, w, v) {
    for (let y = v.y0; y <= v.y1; y++) {
      for (let x = v.x0; x <= v.x1; x++) {
        const i = y * w.W + x, t = w.door[i];
        if (!t) continue;
        const D = DOORS[t];
        const horiz = w.doorHorizontal(x, y);
        const open = w.doorOpen[i];
        const broken = w.hp[i] === 0;
        ctx.save();
        ctx.translate(x + 0.5, y + 0.5);
        if (!horiz) ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#5f6468';
        ctx.fillRect(-0.5, -0.16, 0.12, 0.32); ctx.fillRect(0.38, -0.16, 0.12, 0.32);
        const slide = open * 0.4;
        if (broken) {
          ctx.fillStyle = shade(D.color, -40);
          ctx.save(); ctx.rotate(0.5); ctx.fillRect(-0.35, -0.05, 0.5, 0.1); ctx.restore();
        } else if (D.key === 'jail') {
          ctx.fillStyle = '#6f777f';
          ctx.fillRect(-0.38 - slide, -0.07, 0.76, 0.14);
          ctx.fillStyle = '#2c3034';
          for (let k = 0; k < 5; k++) ctx.fillRect(-0.34 - slide + k * 0.16, -0.05, 0.05, 0.1);
          ctx.fillStyle = w.jailLocked || w.lockdown ? '#d04a3a' : '#5ab05a';
          ctx.fillRect(0.4, -0.22, 0.08, 0.08);
        } else {
          ctx.fillStyle = D.color;
          ctx.fillRect(-0.38 - slide / 2, -0.08, 0.38, 0.16);
          ctx.fillRect(0 + slide / 2, -0.08, 0.38, 0.16);
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(-0.36 - slide / 2, -0.07, 0.34, 0.04); ctx.fillRect(0.02 + slide / 2, -0.07, 0.34, 0.04);
          if (D.key === 'staff') { ctx.fillStyle = '#9ad0ff'; ctx.fillRect(-0.1 - slide / 2, -0.04, 0.06, 0.08); ctx.fillRect(0.04 + slide / 2, -0.04, 0.06, 0.08); }
          if (w.lockdown) { ctx.fillStyle = '#d04a3a'; ctx.fillRect(0.4, -0.22, 0.08, 0.08); }
        }
        ctx.restore();
      }
    }
  },

  /* ------------------------------ 設備 ------------------------------ */
  objects(ctx, g, v) {
    const w = g.world;
    const list = [];
    for (const o of w.objects.values()) {
      if (o.x + o.w < v.x0 - 1 || o.x > v.x1 + 1 || o.y + o.h < v.y0 - 1 || o.y > v.y1 + 1) continue;
      list.push(o);
    }
    list.sort((a, b) => (a.key === 'tree') - (b.key === 'tree') || a.y - b.y);
    for (const o of list) this.drawObj(ctx, o, g.sim, false);
    if (g.sel && g.sel.type === 'obj') {
      const o = g.sel.o;
      ctx.strokeStyle = '#ffe07a'; ctx.lineWidth = 0.06;
      ctx.strokeRect(o.x - 0.05, o.y - 0.05, o.w + 0.1, o.h + 0.1);
    }
  },

  /* 回転前の向き (正面が下) で描く。中心が原点、幅 W 高さ H */
  drawObj(ctx, o, s, ghost) {
    const d = o.def;
    const W = d.w, H = d.h;
    ctx.save();
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    ctx.rotate(o.rot * Math.PI / 2);
    const L = -W / 2, T = -H / 2;
    const rr = (x, y, w, h, r, fill) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); };
    const shadow = () => { if (!ghost) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(L + 0.1, T + 0.14, W - 0.1, H - 0.08); } };
    const on = ghost || !s || !d.power || o.powered;
    switch (o.key) {
      case 'bed':
        shadow();
        rr(L + 0.08, T + 0.06, W - 0.16, H - 0.12, 0.08, '#6a717a');
        rr(L + 0.13, T + 0.1, W - 0.26, H - 0.2, 0.06, '#ece6d8');
        rr(L + 0.18, T + 0.14, W - 0.36, 0.34, 0.08, '#ffffff');
        rr(L + 0.13, T + 0.62, W - 0.26, H - 0.72, 0.05, '#5d7ea8');
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(L + 0.13, T + 0.62, W - 0.26, 0.06);
        break;
      case 'toilet':
        shadow();
        rr(L + 0.25, T + 0.1, 0.5, 0.22, 0.05, '#dfe5e8');
        ctx.fillStyle = '#f4f7f8'; ctx.beginPath(); ctx.ellipse(0, 0.08, 0.24, 0.3, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#b8c8d0'; ctx.beginPath(); ctx.ellipse(0, 0.1, 0.14, 0.19, 0, 0, TAU); ctx.fill();
        break;
      case 'cooker':
        shadow();
        rr(L + 0.06, T + 0.06, 0.88, 0.88, 0.06, '#3c4044');
        for (const [bx, by] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
          ctx.fillStyle = '#1e2124'; ctx.beginPath(); ctx.arc(bx, by, 0.14, 0, TAU); ctx.fill();
          const hot = s && on && s.mealNeed && s.mealNeed() > 0;
          ctx.strokeStyle = hot ? '#ff6a3a' : '#555a60'; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.arc(bx, by, 0.09, 0, TAU); ctx.stroke();
        }
        break;
      case 'fridge':
        shadow();
        rr(L + 0.08, T + 0.06, 0.84, 0.88, 0.08, '#e3e8ea');
        ctx.fillStyle = '#c3cbd0'; ctx.fillRect(L + 0.1, 0.12, 0.8, 0.03);
        ctx.fillStyle = '#8a959c'; ctx.fillRect(L + 0.2, 0.2, 0.3, 0.05);
        ctx.fillStyle = on ? '#6ad0ff' : '#666'; ctx.fillRect(0.2, T + 0.16, 0.08, 0.06);
        break;
      case 'sink':
        shadow();
        rr(L + 0.06, T + 0.08, 0.88, 0.84, 0.06, '#b9c2c8');
        rr(L + 0.18, T + 0.26, 0.64, 0.5, 0.1, '#8d9aa2');
        ctx.fillStyle = '#e0e6ea'; ctx.fillRect(-0.04, T + 0.1, 0.08, 0.2);
        break;
      case 'serving': {
        shadow();
        rr(L + 0.04, T + 0.1, W - 0.08, H - 0.2, 0.06, '#aab4ba');
        ctx.fillStyle = '#c9d2d7'; ctx.fillRect(L + 0.08, T + 0.14, W - 0.16, 0.08);
        const n = Math.min(9, Math.ceil((o.food || 0) / 3));
        for (let k = 0; k < n; k++) {
          const fx = L + 0.25 + (k % 9) * 0.3;
          ctx.fillStyle = '#6a7278'; ctx.fillRect(fx - 0.11, -0.12, 0.22, 0.26);
          ctx.fillStyle = k % 3 === 0 ? '#e8a24a' : k % 3 === 1 ? '#8fc05a' : '#f0e0b0';
          ctx.fillRect(fx - 0.08, -0.08, 0.16, 0.18);
        }
        break;
      }
      case 'table':
        if (!ghost) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(L + 0.1, T - 0.6, W - 0.1, H + 1.3); }
        rr(L + 0.1, T - 0.72, W - 0.2, 0.3, 0.06, '#7a7f86');
        rr(L + 0.1, T + H + 0.42, W - 0.2, 0.3, 0.06, '#7a7f86');
        rr(L + 0.02, T + 0.04, W - 0.04, H - 0.08, 0.08, '#b78a58');
        ctx.fillStyle = 'rgba(255,240,210,0.15)'; ctx.fillRect(L + 0.06, T + 0.08, W - 0.12, 0.08);
        break;
      case 'shower':
        shadow();
        rr(L + 0.04, T + 0.04, 0.92, 0.92, 0.04, '#bcdbe6');
        ctx.fillStyle = '#a4c6d2';
        for (let k = 0; k < 4; k++) { ctx.fillRect(L + 0.04 + k * 0.23, T + 0.04, 0.02, 0.92); ctx.fillRect(L + 0.04, T + 0.04 + k * 0.23, 0.92, 0.02); }
        ctx.fillStyle = '#7c8b92'; ctx.beginPath(); ctx.arc(0, 0.08, 0.07, 0, TAU); ctx.fill();
        ctx.fillStyle = '#d0d6da'; ctx.beginPath(); ctx.arc(0, T + 0.18, 0.1, 0, TAU); ctx.fill();
        break;
      case 'washer':
        shadow();
        for (let k = 0; k < 2; k++) {
          const bx = L + k;
          rr(bx + 0.06, T + 0.06, 0.88, 0.88, 0.08, '#eef1f2');
          ctx.fillStyle = '#9aa8ae'; ctx.beginPath(); ctx.arc(bx + 0.5, 0.05, 0.28, 0, TAU); ctx.fill();
          ctx.fillStyle = on ? '#5f8fb0' : '#666'; ctx.beginPath(); ctx.arc(bx + 0.5, 0.05, 0.2, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(bx + 0.44, -0.02, 0.07, 0, TAU); ctx.fill();
        }
        break;
      case 'medbed':
        shadow();
        rr(L + 0.08, T + 0.06, W - 0.16, H - 0.12, 0.08, '#c8d0d6');
        rr(L + 0.13, T + 0.1, W - 0.26, H - 0.2, 0.06, '#f4f8f8');
        rr(L + 0.18, T + 0.14, W - 0.36, 0.3, 0.08, '#ffffff');
        ctx.fillStyle = '#4ab07a'; ctx.fillRect(-0.05, 0.1, 0.1, 0.36); ctx.fillRect(-0.18, 0.23, 0.36, 0.1);
        break;
      case 'wardenDesk':
        shadow();
        rr(L + 0.02, T + 0.08, W - 0.04, H - 0.26, 0.06, '#5a3a24');
        ctx.fillStyle = '#6e4a30'; ctx.fillRect(L + 0.06, T + 0.12, W - 0.12, 0.06);
        ctx.fillStyle = '#f0ece0'; ctx.fillRect(-0.5, -0.2, 0.34, 0.24); ctx.fillRect(-0.44, -0.24, 0.34, 0.24);
        ctx.fillStyle = '#c8a040'; ctx.beginPath(); ctx.arc(0.62, -0.1, 0.1, 0, TAU); ctx.fill();
        rr(-0.22, T + H - 0.06, 0.44, 0.34, 0.1, '#2a2a30');
        break;
      case 'desk':
        shadow();
        rr(L + 0.02, T + 0.08, W - 0.04, H - 0.26, 0.05, '#a88a60');
        ctx.fillStyle = '#30343a'; ctx.fillRect(-0.3, -0.26, 0.5, 0.12);
        ctx.fillStyle = on ? '#7ab8e0' : '#444'; ctx.fillRect(-0.27, -0.24, 0.44, 0.07);
        ctx.fillStyle = '#f0ece0'; ctx.fillRect(0.4, -0.2, 0.3, 0.2);
        rr(-0.2, T + H - 0.06, 0.4, 0.3, 0.08, '#4a4e56');
        break;
      case 'monitor':
        shadow();
        rr(L + 0.02, T + 0.08, W - 0.04, H - 0.26, 0.05, '#3a3e46');
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = '#16181c'; ctx.fillRect(L + 0.12 + k * 0.6, T + 0.12, 0.52, 0.2);
          ctx.fillStyle = on ? `hsl(${200 + k * 12},60%,${45 + Math.sin((s ? s.t : 0) * 3 + k) * 8}%)` : '#333';
          ctx.fillRect(L + 0.15 + k * 0.6, T + 0.14, 0.46, 0.15);
        }
        rr(-0.2, T + H - 0.06, 0.4, 0.3, 0.08, '#4a4e56');
        break;
      case 'camera':
        ctx.fillStyle = '#e4e8ea'; ctx.beginPath(); ctx.arc(0, 0, 0.2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#23272b'; ctx.beginPath(); ctx.arc(0, 0.06, 0.1, 0, TAU); ctx.fill();
        ctx.fillStyle = on && s && s.world && s.world.countRooms('security') ? '#ff4a4a' : '#666'; ctx.beginPath(); ctx.arc(0.12, -0.1, 0.035, 0, TAU); ctx.fill();
        break;
      case 'detector':
        ctx.fillStyle = '#8a929a'; ctx.fillRect(L + 0.06, T + 0.2, 0.14, 0.6); ctx.fillRect(L + 0.8, T + 0.2, 0.14, 0.6);
        ctx.fillStyle = '#5a6268'; ctx.fillRect(L + 0.06, T + 0.2, 0.88, 0.1);
        ctx.fillStyle = on ? '#6aff8a' : '#666'; ctx.fillRect(-0.05, T + 0.21, 0.1, 0.07);
        break;
      case 'tv':
        shadow();
        rr(L + 0.08, T + 0.3, 0.84, 0.36, 0.04, '#1a1c20');
        ctx.fillStyle = on ? `hsl(${((s ? s.t : 0) * 40) % 360},45%,55%)` : '#2a2c30';
        ctx.fillRect(L + 0.12, T + 0.33, 0.76, 0.12);
        ctx.fillStyle = '#44484e'; ctx.fillRect(-0.12, T + 0.66, 0.24, 0.1);
        break;
      case 'sofa':
        shadow();
        rr(L + 0.04, T + 0.08, W - 0.08, H - 0.14, 0.14, '#7a4a3a');
        rr(L + 0.1, T + 0.3, W - 0.2, H - 0.42, 0.1, '#9a624e');
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(-0.02, T + 0.3, 0.04, H - 0.42);
        break;
      case 'bench':
        shadow();
        rr(L + 0.06, T + 0.28, W - 0.12, 0.46, 0.05, '#9a7248');
        ctx.fillStyle = '#7a5530';
        for (let k = 0; k < 3; k++) ctx.fillRect(L + 0.06, T + 0.32 + k * 0.14, W - 0.12, 0.03);
        break;
      case 'weights':
        shadow();
        rr(L + 0.1, T + 0.3, 1.3, 0.4, 0.08, '#30343a');
        ctx.fillStyle = '#9aa2a8'; ctx.fillRect(L + 0.3, T + 0.1, 0.06, 0.8);
        ctx.fillStyle = '#1a1c20';
        ctx.fillRect(L + 0.18, T + 0.04, 0.3, 0.14); ctx.fillRect(L + 0.18, T + 0.82, 0.3, 0.14);
        ctx.fillStyle = '#4a4e56'; ctx.fillRect(L + 1.5, T + 0.25, 0.4, 0.5);
        break;
      case 'phone':
        shadow();
        rr(L + 0.2, T + 0.06, 0.6, 0.4, 0.06, '#3a6a9a');
        ctx.fillStyle = '#20252a'; ctx.fillRect(L + 0.28, T + 0.12, 0.44, 0.1);
        ctx.fillStyle = '#d0d6da'; for (let k = 0; k < 6; k++) ctx.fillRect(L + 0.3 + (k % 3) * 0.14, T + 0.26 + Math.floor(k / 3) * 0.08, 0.08, 0.05);
        break;
      case 'pingpong':
        shadow();
        rr(L + 0.08, T + 0.1, W - 0.16, H - 0.2, 0.04, '#2f7a5a');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(L + 0.1, -0.02, W - 0.2, 0.04);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-0.03, T + 0.1, 0.06, H - 0.2);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.03; ctx.strokeRect(L + 0.1, T + 0.12, W - 0.2, H - 0.24);
        break;
      case 'bookshelf':
        shadow();
        rr(L + 0.02, T + 0.04, W - 0.04, 0.5, 0.03, '#5a3a22');
        for (let k = 0; k < 11; k++) {
          ctx.fillStyle = ['#b84a3a', '#3a6ab0', '#e0b040', '#4a9a5a', '#8a4ab0', '#d0d0c0'][k % 6];
          ctx.fillRect(L + 0.1 + k * 0.165, T + 0.1, 0.12, 0.36);
        }
        break;
      case 'workbench':
        shadow();
        rr(L + 0.02, T + 0.1, W - 0.04, H - 0.3, 0.04, '#9a6a3a');
        ctx.fillStyle = '#b07a44'; ctx.fillRect(L + 0.05, T + 0.12, W - 0.1, 0.06);
        ctx.fillStyle = '#707880'; ctx.fillRect(-0.6, -0.14, 0.4, 0.08); ctx.fillRect(0.2, -0.22, 0.08, 0.3);
        ctx.fillStyle = '#c04a3a'; ctx.fillRect(0.45, -0.18, 0.25, 0.18);
        break;
      case 'press':
        shadow();
        rr(L + 0.06, T + 0.06, W - 0.12, H - 0.3, 0.06, '#5a6068');
        ctx.fillStyle = '#e0b030';
        for (let k = 0; k < 6; k++) ctx.fillRect(L + 0.1 + k * 0.3, T + 0.1, 0.15, 0.1);
        rr(L + 0.4, T + 0.4, W - 0.8, H - 0.9, 0.04, on ? '#8a9098' : '#555');
        ctx.fillStyle = '#c8d0d6'; ctx.fillRect(L + 0.55, T + 0.55, W - 1.1, 0.3);
        break;
      case 'schoolDesk':
        shadow();
        rr(L + 0.14, T + 0.08, 0.72, 0.44, 0.04, '#c0a070');
        ctx.fillStyle = '#f4f0e4'; ctx.fillRect(-0.18, T + 0.14, 0.3, 0.2);
        rr(-0.2, T + 0.58, 0.4, 0.3, 0.06, '#6a7a8a');
        break;
      case 'blackboard':
        shadow();
        rr(L + 0.02, T + 0.1, W - 0.04, 0.34, 0.03, '#6a4a2a');
        ctx.fillStyle = '#2f5a42'; ctx.fillRect(L + 0.08, T + 0.14, W - 0.16, 0.26);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.025;
        ctx.beginPath(); ctx.moveTo(L + 0.2, T + 0.22); ctx.lineTo(L + 0.8, T + 0.22); ctx.moveTo(L + 0.3, T + 0.3); ctx.lineTo(L + 1.4, T + 0.3); ctx.stroke();
        break;
      case 'visitTable':
        shadow();
        rr(L + 0.02, T + 0.08, W - 0.04, H - 0.16, 0.05, '#9a8068');
        ctx.fillStyle = 'rgba(190,230,255,0.75)'; ctx.fillRect(L, -0.04, W, 0.08);
        ctx.fillStyle = '#60707a'; ctx.fillRect(L, -0.05, 0.06, 0.1); ctx.fillRect(-W / 2 + W - 0.06, -0.05, 0.06, 0.1); ctx.fillRect(-0.03, -0.05, 0.06, 0.1);
        break;
      case 'generator': {
        shadow();
        rr(L + 0.04, T + 0.04, W - 0.08, H - 0.08, 0.08, '#6a7078');
        rr(L + 0.14, T + 0.14, W - 0.28, H - 0.28, 0.06, '#d8b040');
        ctx.fillStyle = '#3a3e44';
        for (let k = 0; k < 7; k++) ctx.fillRect(L + 0.3 + k * 0.34, T + 0.4, 0.14, H - 0.8);
        const run = !ghost && o.hp > 0;
        ctx.fillStyle = run ? '#6aff8a' : '#444'; ctx.beginPath(); ctx.arc(W / 2 - 0.3, T + 0.3, 0.07, 0, TAU); ctx.fill();
        break;
      }
      case 'plant':
        ctx.fillStyle = '#8a5a3a'; ctx.beginPath(); ctx.arc(0, 0.05, 0.22, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3f8a3a';
        for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + 0.3; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.16, 0.08, a, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#5aa84a'; ctx.beginPath(); ctx.arc(0, 0, 0.1, 0, TAU); ctx.fill();
        break;
      case 'tree': {
        const hx = hash2(o.x, o.y);
        if (!ghost) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0.18, 0.22, 0.62, 0.5, 0, 0, TAU); ctx.fill(); }
        const c1 = hx < 0.5 ? '#3f7a34' : '#4a8a3a', c2 = hx < 0.5 ? '#5a9a44' : '#64a84a';
        ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(0, 0, 0.62, 0, TAU); ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.arc(-0.18, -0.16, 0.36, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(0.2, -0.05, 0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(-0.24, -0.26, 0.16, 0, TAU); ctx.fill();
        break;
      }
    }
    ctx.restore();
    if (!ghost && o.hp <= 0) {
      ctx.fillStyle = 'rgba(40,30,30,0.5)';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = '#ff8a4a'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(o.x + 0.2, o.y + 0.2); ctx.lineTo(o.x + o.w - 0.2, o.y + o.h - 0.2); ctx.stroke();
    }
    if (!ghost && d.power && s && !o.powered && o.hp > 0) {
      ctx.fillStyle = '#ffcf3a';
      ctx.font = '0.4px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('⚡', o.x + o.w / 2, o.y + 0.4);
    }
  },

  /* ------------------------------ 人 ------------------------------ */
  people(ctx, g, v) {
    const list = g.sim.people.filter((p) => p.x > v.x0 - 1 && p.x < v.x1 + 2 && p.y > v.y0 - 1 && p.y < v.y1 + 2);
    list.sort((a, b) => (a.pose === 'lie' ? -1 : 0) - (b.pose === 'lie' ? -1 : 0) || a.y - b.y);
    for (const p of list) if (!p.carriedBy) this.person(ctx, p, g);
    for (const p of list) if (p.carriedBy) this.person(ctx, p, g);
    for (const p of list) this.overhead(ctx, p, g);
  },
  uniform(p) {
    if (p.kind === 'prisoner') return SEC[p.sec].color;
    if (p.kind === 'police') return '#26303a';
    if (p.kind === 'visitor') return '#8a6aa0';
    return STAFF[p.role].color;
  },
  person(ctx, p, g) {
    const lie = p.pose === 'lie';
    const sz = p.look.size * 1.25;
    const col = this.uniform(p);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.hitT > 0) ctx.translate((rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.08);
    if (g.sel && g.sel.type === 'person' && g.sel.p === p) {
      ctx.strokeStyle = '#ffe07a'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.arc(0, 0, 0.55, 0, TAU); ctx.stroke();
    }
    if (!lie) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(0.05, 0.08, 0.3 * sz, 0.24 * sz, 0, 0, TAU); ctx.fill(); }
    ctx.rotate(p.face - Math.PI / 2);
    ctx.scale(sz, sz);
    const skin = p.look.skin;
    if (lie) {
      /* 仰向け。頭は向きの反対側 */
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.roundRect(-0.2, -0.3, 0.4, 0.62, 0.14); ctx.fill();
      ctx.fillStyle = shade(col.startsWith('#') ? col : '#888888', -25);
      ctx.fillRect(-0.16, 0.18, 0.13, 0.26); ctx.fillRect(0.03, 0.18, 0.13, 0.26);
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -0.4, 0.15, 0, TAU); ctx.fill();
      ctx.fillStyle = p.look.hair; ctx.beginPath(); ctx.arc(0, -0.44, 0.13, Math.PI, TAU); ctx.fill();
      ctx.restore();
      return;
    }
    /* 腕 (歩くと前後にふれる) */
    const sw = p.moving ? Math.sin(p.walkT * 7) * 0.13 : 0;
    const fight = p.pose === 'fight', work = p.pose === 'work';
    const armY = fight ? 0.22 + Math.max(0, Math.sin(p.sim.t * 14)) * 0.12 : work ? 0.2 + Math.sin(p.sim.t * 9) * 0.04 : sw;
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(-0.24, (fight || work) ? armY : sw, 0.075, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0.24, (fight || work) ? armY * 0.7 : -sw, 0.075, 0, TAU); ctx.fill();
    /* 肩と胴 */
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.27, 0.16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(0, -0.05, 0.25, 0.1, 0, 0, Math.PI); ctx.fill();
    if (p.kind === 'prisoner') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-0.03, -0.12, 0.06, 0.1);
      if (p.escort) { ctx.strokeStyle = '#c0c6cc'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(-0.24, 0.12); ctx.lineTo(0.24, 0.12); ctx.stroke(); }
    }
    if (p.role === 'doctor') { ctx.fillStyle = '#4ab07a'; ctx.fillRect(0.08, 0.02, 0.08, 0.08); }
    if (p.role === 'guard' && p.sim.research.has('riotgear')) { ctx.fillStyle = 'rgba(160,190,220,0.8)'; ctx.fillRect(-0.3, 0.14, 0.26, 0.06); }
    if (p.role === 'police') { ctx.fillStyle = 'rgba(170,200,230,0.85)'; ctx.fillRect(-0.3, 0.16, 0.6, 0.07); }
    /* 手に持つ物 */
    if (p.carry === 'crate') { ctx.fillStyle = '#b8864a'; ctx.fillRect(-0.18, 0.12, 0.36, 0.26); ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 0.03; ctx.strokeRect(-0.18, 0.12, 0.36, 0.26); }
    if (p.carry === 'tray') { ctx.fillStyle = '#c8d0d6'; ctx.fillRect(-0.16, 0.14, 0.32, 0.2); ctx.fillStyle = '#e8a24a'; ctx.fillRect(-0.1, 0.17, 0.12, 0.1); ctx.fillStyle = '#8fc05a'; ctx.fillRect(0.03, 0.17, 0.08, 0.1); }
    if (p.carry === 'mop') { ctx.strokeStyle = '#a07a4a'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(0.22, 0); ctx.lineTo(0.3, 0.45); ctx.stroke(); ctx.fillStyle = '#d0d8e0'; ctx.fillRect(0.2, 0.42, 0.2, 0.08); }
    if ((p.role === 'guard' || p.role === 'police') && fight) { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0.2, armY * 0.7, 0.05, 0.3); }
    /* 頭 */
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, 0.01, 0.15, 0, TAU); ctx.fill();
    this.headwear(ctx, p);
    ctx.restore();
    if (p.carrying) { /* 運ばれる人は別に描く */ }
  },
  headwear(ctx, p) {
    const r = p.role;
    if (r === 'guard') {
      ctx.fillStyle = '#1e3050'; ctx.beginPath(); ctx.arc(0, -0.01, 0.15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#152238'; ctx.beginPath(); ctx.ellipse(0, 0.11, 0.13, 0.06, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#d0b050'; ctx.fillRect(-0.03, 0.04, 0.06, 0.04);
    } else if (r === 'police') {
      ctx.fillStyle = '#1a2028'; ctx.beginPath(); ctx.arc(0, 0, 0.17, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(160,190,220,0.6)'; ctx.beginPath(); ctx.ellipse(0, 0.1, 0.13, 0.05, 0, 0, Math.PI); ctx.fill();
    } else if (r === 'worker') {
      ctx.fillStyle = '#f2c02a'; ctx.beginPath(); ctx.arc(0, 0, 0.16, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d8a818'; ctx.fillRect(-0.02, -0.16, 0.04, 0.32);
      ctx.fillStyle = '#e0b020'; ctx.beginPath(); ctx.ellipse(0, 0.13, 0.12, 0.05, 0, 0, Math.PI); ctx.fill();
    } else if (r === 'cook') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, 0.14, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(-0.06, -0.04, 0.08, 0, TAU); ctx.arc(0.06, -0.04, 0.08, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#d8d8d0'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.arc(0, 0, 0.14, 0, TAU); ctx.stroke();
    } else if (r === 'janitor') {
      ctx.fillStyle = '#3a7a4a'; ctx.beginPath(); ctx.arc(0, -0.01, 0.15, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      ctx.fillRect(-0.12, 0.08, 0.24, 0.05);
    } else if (r === 'warden') {
      ctx.fillStyle = '#9a9a9a'; ctx.beginPath(); ctx.arc(0, -0.03, 0.14, Math.PI, TAU); ctx.fill();
    } else {
      const st = p.kind === 'prisoner' ? (p.look.style % 3) : p.look.style;
      ctx.fillStyle = p.look.hair;
      if (st === 0) { ctx.beginPath(); ctx.arc(0, -0.03, 0.145, Math.PI * 0.95, Math.PI * 2.05); ctx.fill(); }
      else if (st === 1) { ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(0, -0.01, 0.14, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      else if (st === 2) { ctx.beginPath(); ctx.arc(0, -0.04, 0.15, Math.PI * 0.85, Math.PI * 2.15); ctx.fill(); ctx.fillRect(-0.15, -0.06, 0.3, 0.06); }
      else { ctx.beginPath(); ctx.arc(0, -0.05, 0.16, Math.PI * 0.8, Math.PI * 2.2); ctx.fill(); ctx.beginPath(); ctx.arc(0, -0.16, 0.07, 0, TAU); ctx.fill(); }
    }
  },
  overhead(ctx, p, g) {
    const s = g.sim;
    let icon = p.bubble;
    if (!icon) {
      if (p.state === 'ko' || p.mode === 'ko') icon = '💫';
      else if (p.state === 'riot') icon = '🔥';
      else if (p.state === 'escape' && p.noticed) icon = '🏃';
      else if (p.pose === 'lie' && p.kind === 'prisoner' && p.state !== 'ko') icon = g.cam.z > 0.8 ? 'z' : null;
    }
    if (icon === 'z') {
      ctx.fillStyle = 'rgba(220,230,255,0.8)'; ctx.font = 'bold 0.26px sans-serif'; ctx.textAlign = 'center';
      const k = (s.t * 0.8 + p.id * 0.37) % 1;
      ctx.globalAlpha = 1 - k; ctx.fillText('z', p.x + 0.2 + k * 0.2, p.y - 0.25 - k * 0.3); ctx.globalAlpha = 1;
    } else if (icon) {
      ctx.font = '0.36px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(icon, p.x, p.y - 0.5);
    }
    if (p.kind === 'prisoner' && s.research.has('danger') && g.showDanger && p.state !== 'release' && p.anger >= 25 && g.cam.z > 0.6) {
      const a = p.anger / 100;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(p.x - 0.3, p.y + 0.46, 0.6, 0.07);
      ctx.fillStyle = a > 0.7 ? '#ff4a3a' : a > 0.45 ? '#ffb13a' : '#6ad06a';
      ctx.fillRect(p.x - 0.3, p.y + 0.46, 0.6 * a, 0.07);
    }
    if (p.hp < 70 && p.hp > 0 && (p.kind !== 'visitor')) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(p.x - 0.3, p.y - 0.52, 0.6, 0.06);
      ctx.fillStyle = '#ff5a5a'; ctx.fillRect(p.x - 0.3, p.y - 0.52, 0.6 * p.hp / 100, 0.06);
    }
  },

  /* ------------------------------ 車 ------------------------------ */
  vehicles(ctx, s, v) {
    for (const c of s.vehicles) {
      if (c.x < v.x0 - 6 || c.x - c.len > v.x1 + 2) continue;
      const L = c.x - c.len, T = c.y - 0.72, W = c.len, H = 1.44;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(L + 0.1, T + 0.14, W, H);
      const body = { bus: '#e8e4dc', truck: '#c8622a', police: '#1e2a3a', ambulance: '#f2f4f4' }[c.type];
      ctx.beginPath(); ctx.roundRect(L, T, W, H, 0.22); ctx.fillStyle = body; ctx.fill();
      if (c.type === 'bus') {
        ctx.fillStyle = '#3a4e6a'; ctx.fillRect(L + 0.1, T + 0.12, W - 0.2, 0.14); ctx.fillRect(L + 0.1, T + H - 0.26, W - 0.2, 0.14);
        ctx.fillStyle = '#9ab0c8'; ctx.fillRect(c.x - 0.7, T + 0.2, 0.55, H - 0.4);
        ctx.fillStyle = '#b04a3a'; ctx.fillRect(L + 0.3, T + H / 2 - 0.05, W - 1.2, 0.1);
      } else if (c.type === 'truck') {
        ctx.fillStyle = '#e0d8c8'; ctx.fillRect(L + 0.08, T + 0.08, W - 1.1, H - 0.16);
        ctx.fillStyle = '#8ab0d0'; ctx.fillRect(c.x - 0.55, T + 0.25, 0.35, H - 0.5);
        ctx.fillStyle = '#b8864a'; for (let k = 0; k < 4; k++) ctx.fillRect(L + 0.25 + k * 0.52, T + 0.3, 0.4, 0.36);
      } else if (c.type === 'police') {
        ctx.fillStyle = '#e8ecf0'; ctx.fillRect(L + 0.3, T + 0.1, W - 0.9, 0.2); ctx.fillRect(L + 0.3, T + H - 0.3, W - 0.9, 0.2);
        ctx.fillStyle = (s.t * 4) % 2 < 1 ? '#ff3a3a' : '#3a6aff'; ctx.fillRect(c.x - 1.3, T + 0.5, 0.2, 0.44);
        ctx.fillStyle = '#8ab0d0'; ctx.fillRect(c.x - 0.6, T + 0.22, 0.35, H - 0.44);
      } else {
        ctx.fillStyle = '#d83a3a'; ctx.fillRect(L + 0.2, T + H / 2 - 0.08, W - 0.9, 0.16); ctx.fillRect(L + 0.8, T + 0.3, 0.16, H - 0.6);
        ctx.fillStyle = (s.t * 4) % 2 < 1 ? '#ff3a3a' : '#ffffff'; ctx.fillRect(c.x - 1.2, T + 0.5, 0.2, 0.44);
        ctx.fillStyle = '#8ab0d0'; ctx.fillRect(c.x - 0.6, T + 0.22, 0.35, H - 0.44);
      }
    }
  },

  effects(ctx, s) {
    for (const f of s.fx) {
      const k = f.t / f.life;
      if (f.k === 'hit') {
        ctx.strokeStyle = `rgba(255,240,180,${1 - k})`; ctx.lineWidth = 0.05;
        ctx.beginPath();
        for (let a = 0; a < 6; a++) { const r0 = 0.1 + k * 0.2, r1 = 0.25 + k * 0.3, an = a * TAU / 6; ctx.moveTo(f.x + Math.cos(an) * r0, f.y + Math.sin(an) * r0); ctx.lineTo(f.x + Math.cos(an) * r1, f.y + Math.sin(an) * r1); }
        ctx.stroke();
      } else if (f.k === 'spark') {
        ctx.fillStyle = f.c; ctx.globalAlpha = 1 - k;
        ctx.fillRect(f.x + f.vx * f.t, f.y + f.vy * f.t + f.t * f.t * 3, 0.06, 0.06);
        ctx.globalAlpha = 1;
      } else if (f.k === 'steam') {
        ctx.fillStyle = `rgba(240,240,240,${0.4 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(f.x + Math.sin(f.t * 3) * 0.1, f.y - k * 0.8, 0.12 + k * 0.2, 0, TAU); ctx.fill();
      } else if (f.k === 'money') {
        ctx.fillStyle = `rgba(140,240,140,${1 - k})`; ctx.font = 'bold 0.3px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y - k * 0.8);
      } else if (f.k === 'heal') {
        ctx.fillStyle = `rgba(120,240,160,${1 - k})`; ctx.font = 'bold 0.4px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('+', f.x, f.y - 0.4 - k * 0.5);
      }
    }
  },

  /* ------------------------------ 夜 ------------------------------ */
  night(ctx, g, v) {
    const h = g.sim.hourF();
    let dark = 0;
    if (h >= 19 || h < 5) dark = 1;
    else if (h >= 17) dark = (h - 17) / 2;
    else if (h < 7) dark = 1 - (h - 5) / 2;
    if (dark <= 0) return;
    const w = g.world;
    const outA = 0.5 * dark, inA = 0.12 * dark;
    for (let y = v.y0; y <= v.y1; y++) {
      let run = -1, runA = -1;
      for (let x = v.x0; x <= v.x1 + 1; x++) {
        const a = x > v.x1 ? -1 : (w.isIndoor(y * w.W + x) || w.wall[y * w.W + x] ? inA : outA);
        if (a !== runA) {
          if (run >= 0 && runA > 0) { ctx.fillStyle = `rgba(12,18,42,${runA})`; ctx.fillRect(run, y, x - run, 1.01); }
          run = x; runA = a;
        }
      }
    }
    /* 街灯 */
    if (dark > 0.3) {
      for (let x = 2; x < MAP_W; x += 8) {
        const gr = ctx.createRadialGradient(x, WALK_Y + 0.5, 0.1, x, WALK_Y + 0.5, 2.6);
        gr.addColorStop(0, `rgba(255,220,150,${0.28 * dark})`); gr.addColorStop(1, 'rgba(255,220,150,0)');
        ctx.fillStyle = gr; ctx.fillRect(x - 3, WALK_Y - 2.5, 6, 6);
      }
    }
  },

  labels(ctx, g, v) {
    const w = g.world;
    const zoneMode = g.showZones || (g.tool && (g.tool.kind === 'zone' || g.tool.kind === 'unzone'));
    const all = zoneMode || v.z < 0.75;
    ctx.save();
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px "Hiragino Sans", sans-serif';
    for (const r of w.rooms) {
      if (!all && r.valid) continue;
      if (r.cx < v.x0 || r.cx > v.x1 + 1 || r.cy < v.y0 || r.cy > v.y1 + 1) continue;
      if (r.n < 3 && !zoneMode) continue;
      const name = ROOMS[r.type].name + (r.valid ? '' : ' ✕');
      const sp = g.toScreen(r.cx, zoneMode || v.z < 0.75 ? r.cy : r.y0 + 0.5);
      const tw = ctx.measureText(name).width + 12;
      ctx.fillStyle = r.valid ? 'rgba(20,24,30,0.72)' : 'rgba(130,32,28,0.85)';
      ctx.beginPath(); ctx.roundRect(sp.x - tw / 2, sp.y - 9, tw, 18, 5); ctx.fill();
      ctx.fillStyle = r.valid ? '#f0f2f4' : '#ffe0da';
      ctx.fillText(name, sp.x, sp.y + 0.5);
    }
    ctx.restore();
  },

  patrol(ctx, g) {
    const w = g.world;
    if (!w.patrol.length || !(g.tool && g.tool.kind === 'patrol')) {
      if (!w.patrol.length) return;
    }
    const strong = g.tool && g.tool.kind === 'patrol';
    ctx.globalAlpha = strong ? 0.95 : 0.35;
    ctx.strokeStyle = '#7ab0ff'; ctx.lineWidth = 0.05; ctx.setLineDash([0.15, 0.12]);
    ctx.beginPath();
    w.patrol.forEach((i, k) => { const x = i % MAP_W + 0.5, y = ((i / MAP_W) | 0) + 0.5; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    if (w.patrol.length > 2) ctx.closePath();
    ctx.stroke(); ctx.setLineDash([]);
    ctx.font = 'bold 0.3px sans-serif'; ctx.textAlign = 'center';
    w.patrol.forEach((i, k) => {
      const x = i % MAP_W + 0.5, y = ((i / MAP_W) | 0) + 0.5;
      ctx.fillStyle = '#2f5aa0'; ctx.beginPath(); ctx.arc(x, y, 0.22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(String(k + 1), x, y + 0.1);
    });
    ctx.globalAlpha = 1;
  },

  /* ------------------------------ 道具の下書き ------------------------------ */
  tool(ctx, g) {
    const t = g.tool;
    if (!t || !g.hover) return;
    const { x, y } = g.hover;
    ctx.lineWidth = 0.05;
    if (t.kind === 'obj') {
      const [fw, fh] = g.world.footprint(t.key, g.rot);
      const ok = !g.world.canPlace(t.key, x, y, g.rot);
      ctx.save(); ctx.globalAlpha = 0.6;
      this.drawObj(ctx, { key: t.key, def: OBJECTS[t.key], x, y, rot: g.rot, w: fw, h: fh, hp: 100, food: 0, t: 0 }, g.sim, true);
      ctx.restore();
      ctx.fillStyle = ok ? 'rgba(120,220,140,0.18)' : 'rgba(255,80,60,0.3)';
      ctx.fillRect(x, y, fw, fh);
      ctx.strokeStyle = ok ? '#8fe0a0' : '#ff7a6a';
      ctx.strokeRect(x, y, fw, fh);
      /* 使う人が立つ場所 */
      const probe = { key: t.key, def: OBJECTS[t.key], x, y, rot: g.rot, w: fw, h: fh };
      const sp = g.world.spots(probe);
      ctx.fillStyle = 'rgba(255,230,120,0.5)';
      for (const s of sp) if (!s.on) { ctx.beginPath(); ctx.arc(s.x + 0.5, s.y + 0.5, 0.12, 0, TAU); ctx.fill(); }
      return;
    }
    const tiles = g.previewTiles();
    if (!tiles) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.strokeRect(x + 0.03, y + 0.03, 0.94, 0.94);
      return;
    }
    let col = 'rgba(140,200,255,0.35)';
    if (t.kind === 'remove' || t.kind === 'rmFloor' || t.kind === 'unzone') col = 'rgba(255,90,70,0.35)';
    if (t.kind === 'zone') col = ROOMS[t.key].color;
    ctx.fillStyle = col;
    if (t.kind === 'zone') ctx.globalAlpha = 0.5;
    for (const i of tiles) ctx.fillRect(i % MAP_W + 0.04, ((i / MAP_W) | 0) + 0.04, 0.92, 0.92);
    ctx.globalAlpha = 1;
  },
};
