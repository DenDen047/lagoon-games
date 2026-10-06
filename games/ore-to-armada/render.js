/* =========================================================================
   ORE TO ARMADA ― 描画
   背景 / グリッド (16×16 マスの区画ごとに裏の Canvas へ描き置く) / 動く部分 / 弾と光
   ========================================================================= */
'use strict';

const Render = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1,
  cam: { x: 0, y: 0, a: 0, zoom: 1 },
  stars: null,
  cachePx: 0, cacheLimit: 256 * 1024 * 1024, frame: 0,

  init(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.resize(); addEventListener('resize', () => this.resize());
    const rng = new RNG(99);
    this.stars = [0.03, 0.08, 0.18].map((par, li) => Array.from({ length: 170 - li * 40 }, () => ({
      x: rng.f(), y: rng.f(), s: rng.f(0.5, 1.6) + li * 0.5, c: rng.pick(['#ffffff', '#cfe3ff', '#ffe9c4', '#c9d6ff', '#ffd6e8']), par, tw: rng.f(TAU),
    })));
  },
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = innerWidth; this.H = innerHeight;
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
  },
  get k() { return TUNE.tilePx * this.cam.zoom; },
  toScreen(wx, wy) {
    const c = this.cam, dx = wx - c.x, dy = wy - c.y, co = Math.cos(-c.a), si = Math.sin(-c.a), k = this.k;
    return { x: this.W / 2 + (co * dx - si * dy) * k, y: this.H / 2 + (si * dx + co * dy) * k };
  },
  toWorld(sx, sy) {
    const c = this.cam, k = this.k, dx = (sx - this.W / 2) / k, dy = (sy - this.H / 2) / k, co = Math.cos(c.a), si = Math.sin(c.a);
    return { x: c.x + co * dx - si * dy, y: c.y + si * dx + co * dy };
  },
  viewRadius() { return Math.hypot(this.W, this.H) / 2 / this.k + 2; },
  worldTransform() {
    const c = this.cam, k = this.k * this.dpr, ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.W / 2, this.H / 2); ctx.scale(this.k, this.k); ctx.rotate(-c.a); ctx.translate(-c.x, -c.y);
    return k;
  },
  gridTransform(g) {
    const ctx = this.ctx;
    ctx.translate(g.x, g.y); ctx.rotate(g.a); ctx.translate(-g.comX, -g.comY);
  },

  /* ---------- 背景 ---------- */
  background(sys, t) {
    const ctx = this.ctx, W = this.W, H = this.H, c = this.cam;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = sys ? sys.bg : '#05070d'; ctx.fillRect(0, 0, W, H);
    const D = Math.hypot(W, H);
    const co = Math.cos(-c.a), si = Math.sin(-c.a);
    // 星雲 (遠い背景)
    if (sys && sys.nebulae) for (const n of sys.nebulae) {
      const px = (n.x - c.x) * 0.25 * this.cam.zoom * 0.5, py = (n.y - c.y) * 0.25 * this.cam.zoom * 0.5;
      const sx = W / 2 + co * px - si * py, sy = H / 2 + si * px + co * py;
      const r = n.r * 0.5;
      if (sx < -r || sy < -r || sx > W + r || sy > H + r) continue;
      const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      gr.addColorStop(0, n.c + '38'); gr.addColorStop(1, n.c + '00');
      ctx.fillStyle = gr; ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    for (const layer of this.stars) for (const s of layer) {
      let px = (s.x * D - c.x * TUNE.tilePx * s.par) % D, py = (s.y * D - c.y * TUNE.tilePx * s.par) % D;
      if (px < 0) px += D; if (py < 0) py += D;
      px -= D / 2; py -= D / 2;
      const sx = W / 2 + co * px - si * py, sy = H / 2 + si * px + co * py;
      if (sx < -2 || sy < -2 || sx > W + 2 || sy > H + 2) continue;
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 1.3 + s.tw);
      ctx.fillStyle = s.c; ctx.fillRect(sx, sy, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  },
  sun(sys) {
    if (!sys || !sys.star) return;
    const ctx = this.ctx, st = sys.star;
    const p = this.toScreen(st.x, st.y), r = st.r * this.k;
    const glow = r * 6;
    if (p.x < -glow || p.y < -glow || p.x > this.W + glow || p.y > this.H + glow) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const g = ctx.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, glow);
    g.addColorStop(0, st.c + 'ff'); g.addColorStop(0.18, st.c + 'aa'); g.addColorStop(0.45, st.c + '22'); g.addColorStop(1, st.c + '00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, glow, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
  },

  /* ---------- グリッド ---------- */
  levelFor(zoom) { return zoom > 1.25 ? 2 : zoom > 0.6 ? 1 : zoom > 0.3 ? 0.5 : 0.25; },
  drawGrid(g, now) {
    const ctx = this.ctx;
    const lvl = this.levelFor(this.cam.zoom);
    const px = TUNE.tilePx * lvl;
    ctx.save();
    this.gridTransform(g);
    const vr = this.viewRadius();
    const ci0 = Math.floor(g.minX / CHUNK), cj0 = Math.floor(g.minY / CHUNK);
    const ci1 = Math.floor((g.minX + g.w - 1) / CHUNK), cj1 = Math.floor((g.minY + g.h - 1) / CHUNK);
    const cc = Math.cos(g.a), ss = Math.sin(g.a);
    ctx.imageSmoothingEnabled = lvl < 1;
    for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) {
      const lx = ci * CHUNK + CHUNK / 2 - g.comX, ly = cj * CHUNK + CHUNK / 2 - g.comY;
      const wx = g.x + cc * lx - ss * ly, wy = g.y + ss * lx + cc * ly;
      if (dist2(wx, wy, this.cam.x, this.cam.y) > (vr + CHUNK * 0.75) ** 2) continue;
      const key = ci + ',' + cj;
      let ch = g.chunks.get(key);
      if (!ch || ch.lvl !== lvl) {
        if (ch) this.cachePx -= ch.px;
        ch = { cv: null, lvl, dirty: true, px: 0, empty: false, used: 0 };
        g.chunks.set(key, ch);
      }
      if (ch.dirty) this.bakeChunk(g, ci, cj, ch, px);
      ch.used = this.frame;
      if (!ch.empty) ctx.drawImage(ch.cv, ci * CHUNK, cj * CHUNK, CHUNK, CHUNK);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
  },
  bakeChunk(g, ci, cj, ch, px) {
    ch.dirty = false;
    const size = CHUNK * px;
    let any = false;
    for (let j = cj * CHUNK; j < cj * CHUNK + CHUNK && !any; j++) for (let i = ci * CHUNK; i < ci * CHUNK + CHUNK; i++) if (g.occupied(i, j)) { any = true; break; }
    if (!any && !g.rockGrid) { ch.empty = true; if (ch.cv) { this.cachePx -= ch.px; ch.cv = null; ch.px = 0; } return; }
    ch.empty = false;
    if (!ch.cv) { ch.cv = document.createElement('canvas'); ch.cv.width = ch.cv.height = size; ch.px = size * size; this.cachePx += ch.px; }
    const c = ch.cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, size, size);
    c.setTransform(px, 0, 0, px, -ci * CHUNK * px, -cj * CHUNK * px);
    c.lineWidth = 1 / px;
    if (g.terrain) { this.bakeTerrain(g, c, ci, cj); return; }
    const done = new Set();
    for (let j = cj * CHUNK; j < cj * CHUNK + CHUNK; j++) for (let i = ci * CHUNK; i < ci * CHUNK + CHUNK; i++) {
      const b = g.at(i, j);
      if (!b || done.has(b.i)) continue;
      done.add(b.i);
      c.save();
      c.beginPath(); c.rect(ci * CHUNK, cj * CHUNK, CHUNK, CHUNK); c.clip();
      drawBlock(c, b, g, px);
      c.restore();
    }
  },
  bakeTerrain(g, c, ci, cj) {
    for (let j = cj * CHUNK; j < cj * CHUNK + CHUNK; j++) for (let i = ci * CHUNK; i < ci * CHUNK + CHUNK; i++) {
      const t = g.tt(i, j);
      if (!t) continue;
      const T = TERRAIN[t];
      const h = ((i * 73856093) ^ (j * 19349663)) >>> 0;
      const shade = (h % 17) / 17;
      const base = t === 2 ? [74, 64, 57] : [94, 82, 72];
      const edge = !g.tt(i - 1, j) || !g.tt(i + 1, j) || !g.tt(i, j - 1) || !g.tt(i, j + 1);
      const m = 0.8 + shade * 0.3 - (edge ? 0.12 : 0);
      c.fillStyle = `rgb(${base[0] * m | 0},${base[1] * m | 0},${base[2] * m | 0})`;
      c.fillRect(i, j, 1.02, 1.02);
      if (T.ore) {
        c.fillStyle = T.color;
        const n = 2 + (h % 3);
        for (let k = 0; k < n; k++) {
          const ox = ((h >> (k * 4)) & 15) / 16 * 0.7 + 0.1, oy = ((h >> (k * 4 + 2)) & 15) / 16 * 0.7 + 0.1;
          c.beginPath(); c.moveTo(i + ox, j + oy - 0.18); c.lineTo(i + ox + 0.14, j + oy); c.lineTo(i + ox, j + oy + 0.18); c.lineTo(i + ox - 0.14, j + oy); c.fill();
        }
        if (T.id === 'v_ice') { c.fillStyle = 'rgba(190,240,255,0.45)'; c.fillRect(i, j, 1, 1); }
      } else if (h % 5 === 0) {
        c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.arc(i + 0.3 + (h % 7) / 14, j + 0.4, 0.14, 0, TAU); c.fill();
      }
      const k = g.idx(i, j), hp = g.thp[k];
      if (hp < T.hp) { c.strokeStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.moveTo(i + 0.2, j + 0.3); c.lineTo(i + 0.5, j + 0.55); c.lineTo(i + 0.8, j + 0.4); c.stroke(); }
    }
  },
  /* 描き置きが大きくなりすぎたら、長く使っていない区画から捨てる */
  trimCache(grids) {
    if (this.cachePx <= this.cacheLimit / 4) return;
    const all = [];
    for (const g of grids) g.chunks.forEach((ch, key) => { if (ch.cv) all.push([ch, g, key]); });
    all.sort((a, b) => a[0].used - b[0].used);
    for (const [ch, g, key] of all) {
      if (this.cachePx <= this.cacheLimit / 4 * 0.8) break;
      if (ch.used >= this.frame - 2) break;
      this.cachePx -= ch.px; g.chunks.delete(key);
    }
  },
  dropGrid(g) { g.chunks.forEach((ch) => { this.cachePx -= ch.px; }); g.chunks.clear(); },
};

/* ---------- ブロックの絵 (グリッドのローカル座標で、1マス = 1) ---------- */
function shade(hex, m) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * m, 0, 255) | 0, g = clamp(((n >> 8) & 255) * m, 0, 255) | 0, b = clamp((n & 255) * m, 0, 255) | 0;
  return `rgb(${r},${g},${b})`;
}
function drawBlock(c, b, g, px) {
  const d = b.def, x = b.x, y = b.y, w = b.w, h = b.h, cx = x + w / 2, cy = y + h / 2;
  const col = d.glass ? '#7fd0ff' : (CAT[d.cat] ? CAT[d.cat].color : '#888');
  const lw = 1 / px;
  const plate = (fill, inset = 0.04) => { c.fillStyle = fill; c.fillRect(x + inset, y + inset, w - inset * 2, h - inset * 2); };
  const rim = (color, inset = 0.04) => { c.strokeStyle = color; c.lineWidth = Math.max(lw, 0.06); c.strokeRect(x + inset + 0.03, y + inset + 0.03, w - inset * 2 - 0.06, h - inset * 2 - 0.06); };
  const rot = () => { c.translate(cx, cy); c.rotate(b.r * Math.PI / 2); c.translate(-cx, -cy); };
  const fwd = (b.r & 1) ? [h, w] : [w, h];
  const room = g.roomAt ? g.roomAt(x, y) : null;
  const floorCol = () => {
    const p = room ? (room.leak ? 0 : room.air / room.size) : 0;
    return p > 0.75 ? '#3a4a5c' : p > 0.25 ? '#33404f' : '#232a33';
  };
  switch (d.id) {
    case 'wall': case 'st_wall':
      plate('#7c8694', 0); c.fillStyle = '#8e99a8'; c.fillRect(x + 0.08, y + 0.08, w - 0.16, 0.2); rim('#56606c', 0); break;
    case 'armor':
      plate('#5b6571', 0); c.fillStyle = '#4a535e'; c.fillRect(x + 0.15, y + 0.15, 0.7, 0.7);
      c.fillStyle = '#9aa4b2'; for (const [ox, oy] of [[0.18, 0.18], [0.82, 0.18], [0.18, 0.82], [0.82, 0.82]]) { c.beginPath(); c.arc(x + ox, y + oy, 0.06, 0, TAU); c.fill(); }
      rim('#343b44', 0); break;
    case 'wall_slope': case 'armor_slope': {
      rot();
      c.fillStyle = d.id === 'armor_slope' ? '#5b6571' : '#7c8694';
      c.beginPath(); c.moveTo(x, y + 1); c.lineTo(x + 1, y + 1); c.lineTo(x + 1, y); c.closePath(); c.fill();
      c.strokeStyle = '#a8b2c0'; c.lineWidth = 0.07; c.beginPath(); c.moveTo(x + 0.02, y + 0.98); c.lineTo(x + 0.98, y + 0.02); c.stroke();
      break;
    }
    case 'glass': case 'glass_r': case 'st_glass':
      c.fillStyle = d.id === 'glass_r' ? 'rgba(120,200,255,0.55)' : 'rgba(127,208,255,0.38)'; c.fillRect(x, y, w, h);
      c.strokeStyle = 'rgba(220,245,255,0.7)'; c.lineWidth = 0.06; c.beginPath(); c.moveTo(x + 0.2, y + 0.75); c.lineTo(x + 0.75, y + 0.2); c.stroke();
      if (d.id === 'glass_r') rim('#6aa8d8', 0); break;
    case 'floor':
      c.fillStyle = floorCol(); c.fillRect(x, y, w, h);
      c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = lw; c.strokeRect(x + 0.02, y + 0.02, 0.96, 0.96); break;
    case 'frame':
      c.strokeStyle = '#6b7480'; c.lineWidth = 0.09; c.strokeRect(x + 0.1, y + 0.1, 0.8, 0.8);
      c.beginPath(); c.moveTo(x + 0.1, y + 0.1); c.lineTo(x + 0.9, y + 0.9); c.moveTo(x + 0.9, y + 0.1); c.lineTo(x + 0.1, y + 0.9); c.stroke(); break;
    case 'door':
      c.fillStyle = floorCol(); c.fillRect(x, y, w, h); break;
    case 'airlock':
      plate('#4a4f58', 0);
      for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#1c1c1c' : '#e0b43a'; c.fillRect(x, y + k * h / 6, 0.14, h / 6); c.fillRect(x + w - 0.14, y + k * h / 6, 0.14, h / 6); }
      c.fillStyle = '#2a3038'; c.fillRect(x + 0.22, y + 0.12, w - 0.44, h - 0.24); break;
    case 'cockpit': case 'bridge': {
      rot();
      const W2 = fwd[0], H2 = fwd[1], X = cx - W2 / 2, Y = cy - H2 / 2;
      c.fillStyle = '#5c6f86'; c.beginPath(); c.moveTo(X + 0.08, Y + H2); c.lineTo(X + 0.08, Y + H2 * 0.35); c.quadraticCurveTo(X + W2 / 2, Y - 0.05, X + W2 - 0.08, Y + H2 * 0.35); c.lineTo(X + W2 - 0.08, Y + H2); c.closePath(); c.fill();
      c.fillStyle = 'rgba(143,211,255,0.85)'; c.beginPath(); c.moveTo(X + 0.2, Y + H2 * 0.55); c.quadraticCurveTo(X + W2 / 2, Y + 0.1, X + W2 - 0.2, Y + H2 * 0.55); c.closePath(); c.fill();
      c.fillStyle = '#2a3340'; c.fillRect(X + W2 * 0.3, Y + H2 * 0.62, W2 * 0.4, H2 * 0.25); break;
    }
    case 'gunseat':
      plate('#4b5563'); c.fillStyle = '#ff9b9b'; c.beginPath(); c.arc(cx, cy, 0.22, 0, TAU); c.fill(); c.fillStyle = '#2a3340'; c.fillRect(cx - 0.25, cy + 0.1, 0.5, 0.25); break;
    case 'remote': case 'aicore':
      plate('#3a4656'); c.fillStyle = d.id === 'aicore' ? '#c7a6ff' : '#8fd3ff'; c.beginPath(); c.arc(cx, cy, 0.26, 0, TAU); c.fill();
      c.strokeStyle = '#1b2230'; c.lineWidth = 0.06; c.beginPath(); c.arc(cx, cy, 0.14, 0, TAU); c.stroke(); break;
    case 'solar':
      c.fillStyle = '#1d2c5a'; c.fillRect(x + 0.03, y + 0.03, 0.94, 0.94);
      c.strokeStyle = '#4c6ed0'; c.lineWidth = 0.04; for (let k = 1; k < 3; k++) { c.beginPath(); c.moveTo(x + k / 3, y + 0.05); c.lineTo(x + k / 3, y + 0.95); c.moveTo(x + 0.05, y + k / 3); c.lineTo(x + 0.95, y + k / 3); c.stroke(); }
      break;
    case 'battery':
      plate('#4a4632'); for (let k = 0; k < 3; k++) { c.fillStyle = '#ffd84a'; c.fillRect(x + 0.2 + k * 0.22, y + 0.25, 0.14, 0.5); } rim('#2b2818'); break;
    case 'h2gen':
      plate('#5a5230'); c.fillStyle = '#9fe0ff'; c.beginPath(); c.arc(cx - 0.45, cy, 0.4, 0, TAU); c.fill();
      c.fillStyle = '#ffd84a'; c.beginPath(); c.moveTo(cx + 0.45, cy - 0.5); c.lineTo(cx + 0.15, cy + 0.05); c.lineTo(cx + 0.45, cy + 0.05); c.lineTo(cx + 0.3, cy + 0.5); c.lineTo(cx + 0.75, cy - 0.1); c.lineTo(cx + 0.45, cy - 0.1); c.closePath(); c.fill(); rim('#2b2818'); break;
    case 'reactor': {
      plate('#3b4a3a'); rim('#1f2a1f');
      const gr = c.createRadialGradient(cx, cy, 0.1, cx, cy, 1.2); gr.addColorStop(0, '#eaffd8'); gr.addColorStop(0.4, '#7dff5a'); gr.addColorStop(1, 'rgba(60,120,40,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, 1.15, 0, TAU); c.fill();
      c.strokeStyle = '#1f2a1f'; c.lineWidth = 0.12; c.beginPath(); c.arc(cx, cy, 0.9, 0, TAU); c.stroke(); break;
    }
    case 'thruster': case 'thruster_l': {
      rot();
      const W2 = fwd[0], H2 = fwd[1], X = cx - W2 / 2, Y = cy - H2 / 2;
      c.fillStyle = '#6b5a4a'; c.fillRect(X + 0.1, Y + H2 * 0.35, W2 - 0.2, H2 * 0.65 - 0.04);
      c.fillStyle = '#ff9a4a'; c.beginPath(); c.moveTo(X + 0.12, Y + 0.02); c.lineTo(X + W2 - 0.12, Y + 0.02); c.lineTo(X + W2 * 0.72, Y + H2 * 0.4); c.lineTo(X + W2 * 0.28, Y + H2 * 0.4); c.closePath(); c.fill();
      c.fillStyle = '#2a1e16'; c.beginPath(); c.ellipse(cx, Y + 0.08, W2 * 0.3, 0.06 * H2 + 0.03, 0, 0, TAU); c.fill(); break;
    }
    case 'gyro':
      plate('#5a4a3a'); c.strokeStyle = '#ffb46a'; c.lineWidth = 0.08; c.beginPath(); c.arc(cx, cy, 0.3, 0, TAU); c.stroke();
      c.beginPath(); c.ellipse(cx, cy, 0.3, 0.12, 0.6, 0, TAU); c.stroke(); break;
    case 'h2tank':
      c.fillStyle = '#5f8fa8'; c.beginPath(); c.roundRect ? c.roundRect(x + 0.12, y + 0.08, w - 0.24, h - 0.16, 0.35) : c.rect(x + 0.12, y + 0.08, w - 0.24, h - 0.16); c.fill();
      c.fillStyle = '#9fe0ff'; c.fillRect(cx - 0.08, y + 0.3, 0.16, h - 0.6); break;
    case 'jumpdrive':
      plate('#2e2446'); c.strokeStyle = '#b89aff'; c.lineWidth = 0.14; c.beginPath(); c.arc(cx, cy, 1.05, 0, TAU); c.stroke();
      c.fillStyle = '#6a4ab8'; c.beginPath(); c.arc(cx, cy, 0.5, 0, TAU); c.fill(); rim('#1a1428'); break;
    case 'shield':
      plate('#3a3260'); c.fillStyle = '#9a7cff';
      c.beginPath(); for (let k = 0; k < 6; k++) { const an = k * TAU / 6; c.lineTo(cx + Math.cos(an) * 0.65, cy + Math.sin(an) * 0.65); } c.closePath(); c.fill();
      c.fillStyle = '#d8ccff'; c.beginPath(); c.arc(cx, cy, 0.22, 0, TAU); c.fill(); rim('#221c3c'); break;
    case 'shield_p':
      rot(); plate('#3a3260'); c.strokeStyle = '#c8b6ff'; c.lineWidth = 0.09; c.beginPath(); c.arc(cx, cy + 0.25, 0.45, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); break;
    case 'airbarrier':
      c.fillStyle = 'rgba(154,124,255,0.28)'; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(200,180,255,0.6)'; c.lineWidth = 0.05; c.strokeRect(x + 0.05, y + 0.05, 0.9, 0.9); break;
    case 'mg': case 'autocannon': case 'laser': case 'laser_h': case 'missile': case 'pd': case 'bio_spore':
      if (d.id === 'bio_spore') { c.fillStyle = '#7a2d5a'; c.beginPath(); c.arc(cx, cy, w * 0.48, 0, TAU); c.fill(); }
      else { plate('#4a3a3a', 0.06); rim('#2a1e1e', 0.06); }
      c.fillStyle = d.id === 'pd' ? '#b9a4ff' : d.id.startsWith('laser') ? '#ff8ad0' : d.id === 'missile' ? '#ff9a6a' : d.id === 'bio_spore' ? '#e06aa8' : '#c05a5a';
      c.beginPath(); c.arc(cx, cy, Math.min(w, h) * 0.36, 0, TAU); c.fill();
      if (d.id === 'missile') { c.fillStyle = '#2a1e1e'; for (const [ox, oy] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) { c.beginPath(); c.arc(cx + ox, cy + oy, 0.16, 0, TAU); c.fill(); } }
      break;
    case 'railgun': case 'minelaser': case 'drill': {
      rot();
      const W2 = fwd[0], H2 = fwd[1], X = cx - W2 / 2, Y = cy - H2 / 2;
      if (d.id === 'drill') {
        c.fillStyle = '#6b6b6b'; c.fillRect(X + 0.1, Y + 0.45, W2 - 0.2, H2 - 0.5);
        c.fillStyle = '#c9c9c9'; c.beginPath(); c.moveTo(cx, Y - 0.02); c.lineTo(X + 0.85, Y + 0.5); c.lineTo(X + 0.15, Y + 0.5); c.closePath(); c.fill();
        c.strokeStyle = '#777'; c.lineWidth = 0.05; c.beginPath(); c.moveTo(cx - 0.2, Y + 0.35); c.lineTo(cx + 0.15, Y + 0.2); c.stroke();
      } else if (d.id === 'minelaser') {
        c.fillStyle = '#5a4e40'; c.fillRect(X + 0.15, Y + 0.3, W2 - 0.3, H2 - 0.34);
        c.fillStyle = '#ffcf4a'; c.fillRect(cx - 0.1, Y + 0.02, 0.2, 0.4);
        c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(cx, Y + 0.1, 0.1, 0, TAU); c.fill();
      } else {
        c.fillStyle = '#3a3040'; c.fillRect(X + 0.12, Y + 0.3, W2 - 0.24, H2 - 0.34);
        c.fillStyle = '#b89aff'; c.fillRect(cx - 0.3, Y, 0.12, H2 * 0.8); c.fillRect(cx + 0.18, Y, 0.12, H2 * 0.8);
        c.fillStyle = '#e8e0ff'; c.fillRect(cx - 0.05, Y + 0.1, 0.1, H2 * 0.7);
      }
      break;
    }
    case 'ammobox':
      plate('#5a4a2a'); c.fillStyle = '#e0c070'; for (let k = 0; k < 3; k++) c.fillRect(x + 0.2 + k * 0.22, y + 0.3, 0.12, 0.4);
      c.fillStyle = '#c03030'; c.fillRect(x + 0.1, y + 0.1, 0.8, 0.1); break;
    case 'o2gen':
      plate('#2e5a40'); c.fillStyle = '#8affc0';
      for (const [ox, oy, r] of [[0.35, 0.5, 0.14], [0.6, 0.9, 0.18], [0.4, 1.35, 0.12], [0.62, 1.6, 0.1]]) { c.beginPath(); c.arc(x + ox * w, y + oy * (h / 2), r, 0, TAU); c.fill(); }
      rim('#1a3626'); break;
    case 'bed':
      c.fillStyle = floorCol(); c.fillRect(x, y, w, h);
      c.fillStyle = '#6a7fa0'; c.fillRect(x + 0.12, y + 0.1, w - 0.24, h - 0.2);
      c.fillStyle = '#e8eef8'; (b.r & 1) ? c.fillRect(x + 0.15, y + 0.15, 0.4, h - 0.3) : c.fillRect(x + 0.15, y + 0.15, w - 0.3, 0.4); break;
    case 'medbay':
      c.fillStyle = floorCol(); c.fillRect(x, y, w, h);
      c.fillStyle = '#dff5e8'; c.fillRect(x + 0.15, y + 0.15, w - 0.3, h - 0.3);
      c.fillStyle = '#e04a5a'; c.fillRect(cx - 0.12, cy - 0.45, 0.24, 0.9); c.fillRect(cx - 0.45, cy - 0.12, 0.9, 0.24); break;
    case 'charger':
      c.fillStyle = floorCol(); c.fillRect(x, y, w, h);
      c.fillStyle = '#2e5a40'; c.fillRect(x + 0.12, y + 0.12, 0.76, 0.76);
      c.fillStyle = '#ffe35a'; c.beginPath(); c.moveTo(cx + 0.08, y + 0.2); c.lineTo(cx - 0.18, cy + 0.05); c.lineTo(cx, cy + 0.05); c.lineTo(cx - 0.08, y + 0.8); c.lineTo(cx + 0.2, cy - 0.05); c.lineTo(cx, cy - 0.05); c.closePath(); c.fill(); break;
    case 'pod':
      c.fillStyle = '#e0e4ea'; c.beginPath(); c.ellipse(cx, cy, w * 0.42, h * 0.46, 0, 0, TAU); c.fill();
      c.fillStyle = '#ff9a4a'; c.fillRect(cx - 0.3, cy - 0.06, 0.6, 0.12); break;
    case 'cargo': case 'cargo_l':
      plate('#6a5236'); c.strokeStyle = '#3a2c1c'; c.lineWidth = 0.07;
      c.strokeRect(x + 0.15, y + 0.15, w - 0.3, h - 0.3); c.beginPath(); c.moveTo(x + 0.15, y + 0.15); c.lineTo(x + w - 0.15, y + h - 0.15); c.moveTo(x + w - 0.15, y + 0.15); c.lineTo(x + 0.15, y + h - 0.15); c.stroke(); break;
    case 'refinery': case 'refinery_l':
      plate('#5a4632'); c.fillStyle = '#ff7a3a'; c.beginPath(); c.arc(cx, cy, Math.min(w, h) * 0.28, 0, TAU); c.fill();
      c.fillStyle = '#ffd08a'; c.beginPath(); c.arc(cx, cy, Math.min(w, h) * 0.12, 0, TAU); c.fill(); rim('#2e2418'); break;
    case 'assembler':
      plate('#4a4a3a'); c.strokeStyle = '#d0c090'; c.lineWidth = 0.12;
      c.beginPath(); for (let k = 0; k < 8; k++) { const an = k * TAU / 8; c.moveTo(cx + Math.cos(an) * 0.3, cy + Math.sin(an) * 0.3); c.lineTo(cx + Math.cos(an) * 0.55, cy + Math.sin(an) * 0.55); } c.stroke();
      c.beginPath(); c.arc(cx, cy, 0.32, 0, TAU); c.stroke(); rim('#2a2a20'); break;
    case 'repairarm':
      plate('#3a4a4a'); c.strokeStyle = '#8affd0'; c.lineWidth = 0.1; c.beginPath(); c.moveTo(x + 0.2, y + 0.8); c.lineTo(cx, cy); c.lineTo(x + 0.8, y + 0.3); c.stroke(); break;
    case 'shipyard':
      plate('#34404a'); c.strokeStyle = '#5ec8b8'; c.lineWidth = 0.1; c.strokeRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8);
      c.fillStyle = '#5ec8b8'; c.font = '0.9px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('造', cx, cy); break;
    case 'connector':
      plate('#2e4a48'); c.strokeStyle = '#5ec8b8'; c.lineWidth = 0.1; c.beginPath(); c.arc(cx, cy, 0.3, 0, TAU); c.stroke(); break;
    case 'hangar': case 'catapult':
      c.fillStyle = '#262c33'; c.fillRect(x, y, w, h);
      if (d.id === 'catapult') { rot(); c.fillStyle = '#5ec8b8'; const H2 = fwd[1], Y = cy - H2 / 2; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(cx - 0.3, Y + k + 0.7); c.lineTo(cx, Y + k + 0.35); c.lineTo(cx + 0.3, Y + k + 0.7); c.lineTo(cx + 0.3, Y + k + 0.85); c.lineTo(cx, Y + k + 0.5); c.lineTo(cx - 0.3, Y + k + 0.85); c.fill(); } }
      else { c.fillStyle = 'rgba(224,180,58,0.35)'; c.fillRect(x, y + 0.45, w, 0.1); }
      break;
    case 'dronebay':
      plate('#2e3a48'); c.fillStyle = '#1a2230'; c.fillRect(x + 0.3, y + 0.3, w - 0.6, h - 0.6);
      c.strokeStyle = '#5ec8b8'; c.lineWidth = 0.08; c.beginPath(); c.moveTo(cx - 0.4, cy); c.lineTo(cx, cy - 0.3); c.lineTo(cx + 0.4, cy); c.stroke(); break;
    case 'anchor':
      plate('#4a4a4a'); c.strokeStyle = '#e0e0e0'; c.lineWidth = 0.08;
      c.beginPath(); c.moveTo(cx, y + 0.2); c.lineTo(cx, y + 0.8); c.moveTo(x + 0.25, y + 0.6); c.quadraticCurveTo(cx, y + 0.95, x + 0.75, y + 0.6); c.moveTo(x + 0.35, y + 0.35); c.lineTo(x + 0.65, y + 0.35); c.stroke(); break;
    case 'gate':
      c.strokeStyle = '#ffd24a'; c.lineWidth = 0.3; c.beginPath(); c.arc(cx, cy, 1.3, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(255,210,74,0.2)'; c.beginPath(); c.arc(cx, cy, 1.15, 0, TAU); c.fill(); break;
    case 'bio_shell': case 'bio_flesh': case 'bio_core': case 'bio_jaw': case 'bio_regen': {
      const base = d.id === 'bio_shell' ? '#6a2d4e' : d.id === 'bio_flesh' ? '#8a3a62' : d.id === 'bio_core' ? '#b04a8a' : d.id === 'bio_jaw' ? '#5a2a3a' : '#7a4a7a';
      c.fillStyle = base; c.beginPath(); c.arc(cx, cy, 0.62, 0, TAU); c.fill();
      if (d.id === 'bio_core') { c.fillStyle = '#ff9ad8'; c.beginPath(); c.arc(cx, cy, 0.35, 0, TAU); c.fill(); }
      if (d.id === 'bio_jaw') { rot(); c.fillStyle = '#e8d8c8'; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x + 0.15 + k * 0.28, y + 0.45); c.lineTo(x + 0.28 + k * 0.28, y); c.lineTo(x + 0.4 + k * 0.28, y + 0.45); c.fill(); } }
      if (d.id === 'bio_regen') { c.fillStyle = '#9affc0'; c.beginPath(); c.arc(cx, cy, 0.2, 0, TAU); c.fill(); }
      if (d.id === 'bio_shell') { c.strokeStyle = '#4a1d34'; c.lineWidth = 0.08; c.beginPath(); c.arc(cx, cy, 0.4, 0.3, 2.4); c.stroke(); }
      break;
    }
    default:
      if (d.kiosk) {
        plate('#2a3a4e'); rim('#8fd3ff');
        c.fillStyle = '#8fd3ff'; c.font = '0.62px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(d.name[0], cx, cy + 0.02);
      } else { plate(shade(col, 0.6)); rim(shade(col, 0.35)); }
  }
  // 傷
  if (b.hp < d.hp * 0.75 && d.hp < 90000) {
    const dmg = 1 - b.hp / d.hp;
    c.strokeStyle = `rgba(20,10,5,${0.35 + dmg * 0.5})`; c.lineWidth = 0.06;
    c.beginPath(); c.moveTo(x + 0.15, y + 0.25); c.lineTo(x + 0.45, y + 0.5); c.lineTo(x + 0.3, y + 0.8);
    if (dmg > 0.5) { c.moveTo(x + 0.45, y + 0.5); c.lineTo(x + 0.85, y + 0.35); }
    c.stroke();
  }
}

/* ---------- 動く部分・人・弾 (毎フレーム描く) ---------- */
Object.assign(Render, {
  dropAll() { for (const g of (S ? S.grids : [])) g.chunks.clear(); this.cachePx = 0; },
  gridDynamic(g, t) {
    const ctx = this.ctx, s = g.sys;
    if (!s) return;
    ctx.save();
    this.gridTransform(g);
    // 推進炎
    for (let d = 0; d < 4; d++) for (const b of s.thr[d]) {
      if (!b.fire) continue;
      const ex = DIRS[b.r], len = (0.6 + b.fire * 1.4 + Math.random() * 0.4) * Math.max(b.w, b.h) * 0.8;
      const cx = b.x + b.w / 2 + ex[0] * b.w / 2, cy = b.y + b.h / 2 + ex[1] * b.h / 2;
      const wdt = (ex[0] ? b.h : b.w) * 0.35;
      const gr = ctx.createLinearGradient(cx, cy, cx + ex[0] * len, cy + ex[1] * len);
      gr.addColorStop(0, b.def.h2draw ? 'rgba(160,220,255,0.95)' : 'rgba(255,220,140,0.95)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(cx - ex[1] * wdt, cy + ex[0] * wdt); ctx.lineTo(cx + ex[0] * len, cy + ex[1] * len); ctx.lineTo(cx + ex[1] * wdt, cy - ex[0] * wdt); ctx.closePath(); ctx.fill();
    }
    // 砲身
    for (const b of s.turrets) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, big = Math.min(b.w, b.h);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(b.ta);
      ctx.fillStyle = b.def.id.startsWith('laser') ? '#ffc0e8' : b.def.id === 'pd' ? '#d8ccff' : b.def.id === 'missile' ? '#ffd0b0' : b.def.id === 'bio_spore' ? '#f0a0d0' : '#e8e0d0';
      if (b.def.id === 'missile') { ctx.fillRect(-0.1 * big, -0.35 * big, 0.55 * big, 0.7 * big); }
      else { const L = 0.55 * big + 0.1, Wd = (b.def.id === 'autocannon' ? 0.28 : 0.16) * big; ctx.fillRect(0, -Wd / 2, L, Wd); if (b.def.id === 'mg') ctx.fillRect(0, -Wd / 2 - 0.12, L * 0.8, Wd * 0.6); }
      ctx.fillStyle = b.gunner ? '#8affd0' : '#2a2a2a'; ctx.beginPath(); ctx.arc(0, 0, 0.14 * big, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // ドア
    for (const b of s.doors) {
      const o = b.open;
      const horiz = !(g.airClass(b.x - 1, b.y) === 1 || g.airClass(b.x + 1, b.y) === 1) || (g.airClass(b.x, b.y - 1) !== 2 && g.airClass(b.x, b.y + 1) !== 2) ? true : false;
      ctx.fillStyle = b.lock ? '#b04040' : '#9aa4b2';
      const gap = o * 0.45;
      if (g.occupied(b.x - 1, b.y) && g.occupied(b.x + 1, b.y) && !(g.at(b.x - 1, b.y) || {}).def?.walk) {
        ctx.fillRect(b.x, b.y + 0.38, 0.5 - gap, 0.24); ctx.fillRect(b.x + 0.5 + gap, b.y + 0.38, 0.5 - gap, 0.24);
      } else { ctx.fillRect(b.x + 0.38, b.y, 0.24, 0.5 - gap); ctx.fillRect(b.x + 0.38, b.y + 0.5 + gap, 0.24, 0.5 - gap); }
    }
    // 予定図
    if (g.plan && g.faction === 'player') {
      ctx.globalAlpha = 0.28 + 0.1 * Math.sin(t * 4);
      for (const [id, x, y, r] of g.plan) { const d = BLOCKS[id]; const [w, h] = Grid.sizeOf(d, r); ctx.fillStyle = CAT[d.cat].color; ctx.fillRect(x + 0.08, y + 0.08, w - 0.16, h - 0.16); }
      ctx.globalAlpha = 1;
    }
    // 当たったときの光
    if (g.flash > 0 && !g.terrain) { ctx.globalAlpha = g.flash * 3; ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.15; }
    ctx.restore();
    // バリア
    if (g.shieldMax > 0 && g.shield > 1 && g.shieldDown <= 0) {
      const sh = Ship.shieldShape(g);
      const hit = g.shieldFlash > 0 ? g.shieldFlash * 4 : 0;
      ctx.save(); this.gridTransform(g);
      ctx.translate(sh.cx, sh.cy);
      const a = 0.08 + 0.05 * (g.shield / g.shieldMax) + hit * 0.3;
      ctx.fillStyle = `rgba(154,124,255,${a})`; ctx.strokeStyle = `rgba(200,180,255,${0.25 + hit})`; ctx.lineWidth = 0.15;
      ctx.beginPath(); ctx.ellipse(0, 0, sh.rx, sh.ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (g.shieldFlash > 0) g.shieldFlash -= 1 / 60;
    }
    for (const b of s.arcs) {
      if (b.charge < 5) continue;
      const p = g.blockWorld(b), ang = Math.atan2(DIRS[b.r][1], DIRS[b.r][0]) + g.a;
      ctx.strokeStyle = `rgba(200,180,255,${0.3 + 0.4 * b.charge / b.def.arcCap})`; ctx.lineWidth = 0.3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, ang - Math.PI / 4, ang + Math.PI / 4); ctx.stroke();
    }
  },
  person(p, t) {
    const ctx = this.ctx, w = personWorld(p);
    if (p.hidden || (p.mode === 'seat' && p.kind !== 'player')) return;
    if (p.mode === 'seat') {
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(w.x, w.y, 0.18, 0, TAU); ctx.fill();
      return;
    }
    const face = p.mode === 'walk' && p.grid ? p.face + p.grid.a : p.face;
    ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(face);
    const bob = p.mode === 'walk' || p.onGround ? Math.sin(p.walkT * 12) * 0.05 : 0;
    // 背中のタンク
    ctx.fillStyle = '#d8dde6'; ctx.fillRect(-0.36, -0.2, 0.16, 0.4);
    // 体 (宇宙服)
    ctx.fillStyle = p.hurtT > 0 ? '#ff8080' : p.color; ctx.beginPath(); ctx.ellipse(bob, 0, 0.26, 0.3, 0, 0, TAU); ctx.fill();
    // ヘルメット
    ctx.fillStyle = '#eef3f8'; ctx.beginPath(); ctx.arc(0.08 + bob, 0, 0.19, 0, TAU); ctx.fill();
    ctx.fillStyle = p.kind === 'hostile' ? '#401010' : '#20303e'; ctx.beginPath(); ctx.ellipse(0.16 + bob, 0, 0.09, 0.13, 0, 0, TAU); ctx.fill();
    // 手に持つ道具
    if (p.kind === 'player' && p.tool && p.mode !== 'seat') { ctx.fillStyle = ['', '#ffcf4a', '#8affd0', '#ff9a4a', '#c0c0c0'][p.tool]; ctx.fillRect(0.18, 0.18, 0.3, 0.08); }
    if (p.kind === 'hostile') { ctx.fillStyle = '#c0c0c0'; ctx.fillRect(0.18, 0.16, 0.3, 0.07); }
    ctx.restore();
    if (p.kind !== 'player' && this.cam.zoom > 0.9) {
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(this.cam.a);
      ctx.fillStyle = p.kind === 'hostile' ? '#ff9a9a' : '#e8f0ff'; ctx.font = '0.42px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.name, 0, -0.55);
      ctx.restore();
    }
  },
  bullets() {
    const ctx = this.ctx;
    for (const b of S.bullets) {
      if (b.homing) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx)); ctx.fillStyle = '#ffd0b0'; ctx.fillRect(-0.5, -0.14, 0.9, 0.28); ctx.fillStyle = '#ff6a4a'; ctx.fillRect(0.3, -0.14, 0.2, 0.28); ctx.restore(); continue; }
      const sp = Math.hypot(b.vx, b.vy), L = Math.min(2.5, sp * 0.02 + 0.3);
      ctx.strokeStyle = b.kind === 'rail' ? '#e0d0ff' : b.kind === 'spore' ? '#f080c0' : b.fac === 'player' ? '#fff0a0' : '#ffb080';
      ctx.lineWidth = b.big ? 0.35 : b.kind === 'rail' ? 0.5 : 0.18;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx / sp * L, b.y - b.vy / sp * L); ctx.stroke();
    }
    for (const bm of S.beams) {
      ctx.strokeStyle = bm.c; ctx.lineWidth = bm.w; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(bm.x0, bm.y0); ctx.lineTo(bm.x1, bm.y1); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = bm.w * 0.35; ctx.stroke();
      if (bm.hit) { ctx.fillStyle = bm.c; ctx.beginPath(); ctx.arc(bm.x1, bm.y1, bm.w * 1.6, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  },
  particles() {
    const ctx = this.ctx;
    for (const p of S.particles) {
      const a = p.life / p.max;
      if (p.flash) { const r = p.s * (1.4 - a); const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, `rgba(255,250,220,${a})`); g.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); continue; }
      ctx.globalAlpha = Math.min(1, a * 1.5); ctx.fillStyle = p.c;
      ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  },
  pickups(t) {
    const ctx = this.ctx;
    for (const p of S.pickups) {
      const k = Object.keys(p.items)[0];
      const c = p.kind === 'grave' ? '#ffffff' : k ? itemDef(k).color : '#ccc';
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 1.5 + p.id);
      ctx.fillStyle = c; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.05;
      if (p.kind === 'grave') { ctx.fillStyle = '#6a7fa0'; ctx.fillRect(-0.4, -0.3, 0.8, 0.6); ctx.fillStyle = '#fff'; ctx.fillRect(-0.06, -0.3, 0.12, 0.6); }
      else if (p.kind === 'ore') { ctx.beginPath(); ctx.moveTo(0, -0.3); ctx.lineTo(0.25, 0); ctx.lineTo(0, 0.3); ctx.lineTo(-0.25, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else { ctx.fillRect(-0.3, -0.3, 0.6, 0.6); ctx.strokeRect(-0.3, -0.3, 0.6, 0.6); }
      ctx.restore();
    }
  },
  drones() {
    const ctx = this.ctx;
    for (const d of S.drones) {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a);
      ctx.fillStyle = d.fac === 'player' ? '#8affd0' : '#ff8a8a';
      ctx.beginPath(); ctx.moveTo(0.7, 0); ctx.lineTo(-0.5, 0.45); ctx.lineTo(-0.3, 0); ctx.lineTo(-0.5, -0.45); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  },
  buildGhost(t) {
    const h = Build.hover;
    if (!Build.on || !h) return;
    const ctx = this.ctx;
    const draw = (i, j, r, ok) => {
      const def = h.def, [w, hh] = Grid.sizeOf(def, r);
      ctx.save();
      if (h.frame) this.gridTransform(h.frame);
      ctx.globalAlpha = 0.6;
      const fake = { def, x: i, y: j, r, w, h: hh, hp: def.hp, i: -1, ta: -Math.PI / 2 + r * Math.PI / 2 };
      ctx.lineWidth = 0.06;
      try { drawBlock(ctx, fake, h.frame || { roomAt: () => null }, 16); } catch (e) { /* noop */ }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ok ? '#7dff9a' : '#ff5a5a'; ctx.lineWidth = 0.1;
      ctx.strokeRect(i + 0.03, j + 0.03, w - 0.06, hh - 0.06);
      // 向きの矢印
      if (def.thrust || def.turret || def.fixed || def.seat || def.slope || def.catapult || def.connector) {
        const cx = i + w / 2, cy = j + hh / 2, d = DIRS[r];
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + d[0] * 0.8, cy + d[1] * 0.8); ctx.stroke();
      }
      ctx.restore();
    };
    draw(h.i, h.j, h.rot, h.ok);
    if (h.mirror) draw(h.mirror.i, h.mirror.j, h.mirror.r, h.mirror.ok);
    if (Input.mdown[2] && h.remove) {
      const { g, b } = h.remove;
      ctx.save(); this.gridTransform(g); ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 0.12; ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.restore();
    }
  },
  /* 歩いているとき、壁の向こうは見えない (ガラスと開いたドアは見える) */
  fog(p) {
    if (!p || p.dead || p.mode !== 'walk' || !p.grid) return;
    const g = p.grid;
    if (!this.fogCv) { this.fogCv = document.createElement('canvas'); }
    const fc = this.fogCv;
    if (fc.width !== this.cv.width || fc.height !== this.cv.height) { fc.width = this.cv.width; fc.height = this.cv.height; }
    const c = fc.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, fc.width, fc.height);
    c.fillStyle = 'rgba(2,4,10,0.82)'; c.fillRect(0, 0, fc.width, fc.height);
    const N = 160, R = 70;
    const opaque = (i, j) => {
      if (g.rockGrid && g.rockGrid.tt(i, j)) return true;
      const b = g.at(i, j);
      if (!b) return false;
      if (b.def.glass || b.def.walk || b.def.air === 'leak') return b.def.door ? b.open < 0.5 : false;
      return true;
    };
    const pts = [];
    for (let k = 0; k < N; k++) {
      const a = k / N * TAU, ex = p.lx + Math.cos(a) * R, ey = p.ly + Math.sin(a) * R;
      let hitT = 1;
      ddaGrid(g, p.lx, p.ly, ex, ey, (i, j, t) => { if (opaque(i, j)) { hitT = t + 0.35 / R; return true; } return false; });
      pts.push(g.toWorld(p.lx + Math.cos(a) * R * hitT, p.ly + Math.sin(a) * R * hitT));
    }
    c.globalCompositeOperation = 'destination-out';
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.translate(this.W / 2, this.H / 2); c.scale(this.k, this.k); c.rotate(-this.cam.a); c.translate(-this.cam.x, -this.cam.y);
    c.beginPath(); pts.forEach((q, k) => (k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.fill();
    // 自分のまわりは少し見える
    const w = personWorld(p); c.beginPath(); c.arc(w.x, w.y, 1.4, 0, TAU); c.fill();
    c.globalCompositeOperation = 'source-over';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(fc, 0, 0);
  },
});

/* ---------- 惑星・地上・ステーションの看板 ---------- */
function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
Object.assign(Render, {
  /* 宇宙から見た惑星の模様。1回だけ裏の Canvas に描き置く。恒星の側が明るい */
  planetTex(P) {
    if (P.tex) return P.tex;
    const N = 384, cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const c = cv.getContext('2d'), img = c.createImageData(N, N), px = img.data;
    const n1 = makeNoise(P.seed), n2 = makeNoise(P.seed + 5);
    const [lo, hi, ac] = PLANET_TYPES[P.type].tex.map(hexRgb);
    const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    const L = Math.hypot(P.x, P.y) || 1, lx = -P.x / L, ly = -P.y / L;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N * 2 - 1, v = (y + 0.5) / N * 2 - 1, r2 = u * u + v * v;
      if (r2 > 1) continue;
      const z = Math.sqrt(1 - r2);
      const n = n1(u * 3 + 10, v * 3 + 10) * 0.65 + n1(u * 9 + 3, v * 9 + 3) * 0.35;
      const m = n2(u * 5 + 20, v * 5 + 20);
      let col, glow = 0;
      if (P.type === 'green') { const land = clamp((n - 0.48) / 0.04, 0, 1); col = mix(mix(lo, [40, 90, 140], n), mix(hi, [70, 120, 60], Math.max(0, n - 0.5) * 2), land); if (m > 0.62) col = mix(col, ac, Math.min(1, (m - 0.62) * 4)); }
      else if (P.type === 'lava') { col = mix(lo, hi, n); glow = clamp((1 - Math.abs(n - 0.5) / 0.018) * 1.6, 0, 1); }
      else if (P.type === 'desert') col = mix(lo, hi, 0.5 + 0.5 * Math.sin(v * 14 + n * 5));
      else if (P.type === 'ice') { col = mix(lo, hi, n); if (m > 0.7) col = mix(col, ac, 0.6); }
      else { col = mix(lo, hi, n); if (m > 0.7) col = mix(col, ac, Math.min(0.8, (m - 0.7) * 8)); }
      const light = clamp(0.22 + 0.9 * Math.max(0, u * lx + v * ly + z * 0.55), 0.18, 1.1);
      // 溶岩の筋は影の側でも光って見える
      col = col.map((q) => q * light);
      if (glow) col = mix(col, ac, glow);
      const k = (y * N + x) * 4, edge = clamp((1 - Math.sqrt(r2)) * N / 2, 0, 1);
      px[k] = col[0]; px[k + 1] = col[1]; px[k + 2] = col[2]; px[k + 3] = 255 * edge;
    }
    c.putImageData(img, 0, 0);
    P.tex = cv;
    return cv;
  },
  /* 宇宙に浮かぶ惑星 (船より下に描く。上を飛べて、真上で G を押すと降りられる) */
  planets(list, t) {
    const ctx = this.ctx, cam = this.cam, vr = this.viewRadius();
    for (const P of list) {
      if (dist(P.x, P.y, cam.x, cam.y) > vr + P.r * 1.3) continue;
      if (PLANET_TYPES[P.type].air) {
        const g = ctx.createRadialGradient(P.x, P.y, P.r * 0.94, P.x, P.y, P.r * 1.2);
        g.addColorStop(0, 'rgba(140,200,255,0.45)'); g.addColorStop(1, 'rgba(140,200,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P.x, P.y, P.r * 1.2, 0, TAU); ctx.fill();
      }
      ctx.drawImage(this.planetTex(P), P.x - P.r, P.y - P.r, P.r * 2, P.r * 2);
      const s = this.toScreen(P.x, P.y), k = this.k;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(230,240,255,0.85)';
      ctx.fillText(`${P.name} (${PLANET_TYPES[P.type].name})`, s.x, s.y + P.r * k + 18);
      ctx.restore();
    }
  },
  /* 惑星の地上。地面の色にまだら模様と、惑星ごとの小さな飾りを重ねる */
  ground(P, t) {
    const ctx = this.ctx, T = PLANET_TYPES[P.type], cam = this.cam;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = T.ground; ctx.fillRect(0, 0, this.W, this.H);
    this.worldTransform();
    const vr = this.viewRadius();
    const hash = (i, j, s) => { let h = (i * 73856093) ^ (j * 19349663) ^ (s * 83492791) ^ P.seed; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const cells = (C, fn) => {
      for (let j = Math.floor((cam.y - vr) / C) - 1; j <= Math.floor((cam.y + vr) / C) + 1; j++)
        for (let i = Math.floor((cam.x - vr) / C) - 1; i <= Math.floor((cam.x + vr) / C) + 1; i++) fn(i, j, C);
    };
    // 大きなまだら
    ctx.globalAlpha = 0.4;
    cells(36, (i, j, C) => {
      const h = hash(i, j, 1);
      ctx.fillStyle = h < 0.5 ? T.ground2 : (P.type === 'lava' ? '#241c1a' : T.spot);
      ctx.beginPath(); ctx.ellipse((i + hash(i, j, 2)) * C, (j + hash(i, j, 3)) * C, C * (0.4 + h * 0.6), C * (0.25 + hash(i, j, 4) * 0.4), hash(i, j, 5) * TAU, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // 小さな飾り (近づいたときだけ)
    if (cam.zoom > 0.5) cells(5, (i, j, C) => {
      const h = hash(i, j, 7);
      if (h > 0.45) return;
      const x = (i + hash(i, j, 8)) * C, y = (j + hash(i, j, 9)) * C, s = 0.5 + hash(i, j, 10);
      if (P.type === 'green') {
        if (h < 0.03) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 0.4, y + 0.5, 1.5 * s, 1.1 * s, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#2f6a2a'; ctx.beginPath(); ctx.arc(x, y, 1.4 * s, 0, TAU); ctx.fill(); ctx.fillStyle = '#4a8a3a'; ctx.beginPath(); ctx.arc(x - 0.35 * s, y - 0.35 * s, 0.8 * s, 0, TAU); ctx.fill(); }
        else if (h < 0.08) { ctx.fillStyle = ['#ffe35a', '#ff8ad0', '#ffffff'][(h * 100 | 0) % 3]; ctx.beginPath(); ctx.arc(x, y, 0.16, 0, TAU); ctx.fill(); }
        else { ctx.strokeStyle = '#5f8a4a'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(x - 0.2, y); ctx.lineTo(x - 0.3, y - 0.4 * s); ctx.moveTo(x, y); ctx.lineTo(x, y - 0.5 * s); ctx.moveTo(x + 0.2, y); ctx.lineTo(x + 0.32, y - 0.4 * s); ctx.stroke(); }
      } else if (P.type === 'lava') {
        const a = 0.45 + 0.35 * Math.sin(t * 2 + h * 40);
        ctx.strokeStyle = `rgba(255,${110 + (h * 200 | 0) % 60},40,${a})`; ctx.lineWidth = 0.14;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1.2 * s, y + 0.4); ctx.lineTo(x + 1.8 * s, y - 0.3); ctx.stroke();
      } else if (P.type === 'ice') {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.06;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1.4 * s, y + 0.6 * s); ctx.moveTo(x + 0.7 * s, y + 0.3 * s); ctx.lineTo(x + 0.9 * s, y - 0.5 * s); ctx.stroke();
      } else if (P.type === 'desert') {
        ctx.strokeStyle = 'rgba(255,240,200,0.3)'; ctx.lineWidth = 0.1;
        ctx.beginPath(); ctx.arc(x, y + 1.2, 1.4 * s, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
      } else {
        if (h < 0.04) { ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.18; ctx.beginPath(); ctx.arc(x, y, 1.2 * s, 0, TAU); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(x, y, 1.4 * s, Math.PI, Math.PI * 1.7); ctx.stroke(); }
        else { ctx.fillStyle = 'rgba(40,34,30,0.5)'; ctx.beginPath(); ctx.arc(x, y, 0.18 * s, 0, TAU); ctx.fill(); }
      }
    });
    // 地平線の外は暗くする
    const R = TUNE.surfaceR;
    const gr = ctx.createRadialGradient(P.sx, P.sy, R - 40, P.sx, P.sy, R + 140);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(2,3,8,0.9)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(P.sx, P.sy, R + 3000, 0, TAU); ctx.fill();
  },
  /* ステーションの店の名前と店員 (どこへ行けば何があるか分かるように) */
  stationSigns(st, t) {
    if (this.cam.zoom < 0.6) return;
    const ctx = this.ctx;
    st.updateSys();
    ctx.save();
    this.gridTransform(st);
    const fs = Math.max(0.55, 12 / this.k);
    for (const b of st.sys.kiosks) {
      const below = st.at(b.x, b.y + 2), above = st.at(b.x, b.y - 2);
      const doorDown = below && below.def.door, doorUp = above && above.def.door;
      // 店員はドアと反対側の、窓口の向こうに立つ
      if (doorDown || doorUp) {
        const cx = b.x + 0.5, cy = b.y + (doorDown ? -0.5 : 1.5);
        ctx.fillStyle = '#d8dde6'; ctx.beginPath(); ctx.ellipse(cx, cy, 0.28, 0.24, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = ['#8fd3ff', '#ffd24a', '#5fd18a', '#ff9a4a'][b.x * 7 + b.y & 3]; ctx.beginPath(); ctx.ellipse(cx, cy, 0.22, 0.18, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f0d0b0'; ctx.beginPath(); ctx.arc(cx, cy + (doorDown ? 0.08 : -0.08), 0.13, 0, TAU); ctx.fill();
      }
      // 名前の札 (画面の向きに合わせて立てる)
      // 店は窓口とドアのあいだ、乗り場は上の壁に札を出す (立っている人と重ならないように)
      const lx = b.x + 0.5, ly = b.y + (doorUp || b.def.kiosk === 'k_board' ? -0.5 : 1.5);
      const w = st.toWorld(lx, ly);
      ctx.save();
      this.worldTransform();
      ctx.translate(w.x, w.y); ctx.rotate(this.cam.a);
      ctx.font = `bold ${fs}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(b.def.name).width + fs * 0.8;
      ctx.fillStyle = 'rgba(8,16,30,0.78)'; ctx.fillRect(-tw / 2, -fs * 0.7, tw, fs * 1.4);
      ctx.fillStyle = b.def.kiosk === 'k_board' ? '#7dff9a' : '#8fd3ff'; ctx.fillText(b.def.name, 0, 0.02);
      ctx.restore();
    }
    ctx.restore();
  },
});
