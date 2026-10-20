/* =========================================================================
   ハムスターの冒険 ― 画面に描く
   カメラ / 地面のかたまり (チャンク) / 奥行きの順 / 天気 / 地図の絵
   ========================================================================= */
'use strict';

const CHUNK = 8;
const CHUNK_PAD = 4;

const R = {
  canvas: null, ctx: null, W: 0, H: 0, dpr: 1, zoom: 1.6,
  cam: { x: 0, y: 0 },
  t: 0,
  chunks: new Map(),
  weather: [],
  fade: 0,
  shake: 0,
  vignette: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
  },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px'; this.canvas.style.height = this.H + 'px';
    this.zoom = clamp(Math.sqrt(this.W * this.H) / (17 * TILE), 0.85, 2.1);
    this.vignette = null;
  },
  get vw() { return this.W / this.zoom; },
  get vh() { return this.H / this.zoom; },

  follow(m, x, y, snap) {
    let tx = x - this.vw / 2, ty = y - this.vh / 2 - 10;
    const mw = m.w * TILE, mh = m.h * TILE;
    tx = mw < this.vw ? (mw - this.vw) / 2 : clamp(tx, 0, mw - this.vw);
    ty = mh < this.vh ? (mh - this.vh) / 2 : clamp(ty, 0, mh - this.vh);
    if (snap) { this.cam.x = tx; this.cam.y = ty; return; }
    this.cam.x = lerp(this.cam.x, tx, 0.14);
    this.cam.y = lerp(this.cam.y, ty, 0.14);
  },
  toWorld(sx, sy) { return { x: sx / this.zoom + this.cam.x, y: sy / this.zoom + this.cam.y }; },
  toScreen(wx, wy) { return { x: (wx - this.cam.x) * this.zoom, y: (wy - this.cam.y) * this.zoom }; },

  /* ------------------------------ 地面 ------------------------------ */
  chunk(m, cx, cy) {
    const key = m.id + ':' + cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c && c.ver === m.ver) { this.chunks.delete(key); this.chunks.set(key, c); return c; }
    /* となりのタイルも少しはみ出して焼き、拡大したときの継ぎ目を消す */
    const S = 2, size = CHUNK * TILE, P = CHUNK_PAD;
    const cv = c ? c.cv : document.createElement('canvas');
    cv.width = (size + P * 2) * S; cv.height = (size + P * 2) * S;
    const g = cv.getContext('2d');
    g.setTransform(S, 0, 0, S, P * S, P * S);
    const pal = m.kind === 'tower' ? TOWERS[m.tower].pal : null;
    for (let y = -1; y <= CHUNK; y++) for (let x = -1; x <= CHUNK; x++) {
      const tx = cx * CHUNK + x, ty = cy * CHUNK + y;
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
      bakeTile(g, m, tx, ty, x * TILE, y * TILE, pal);
    }
    c = { cv, ver: m.ver };
    this.chunks.delete(key);
    this.chunks.set(key, c);
    while (this.chunks.size > 48) this.chunks.delete(this.chunks.keys().next().value);
    return c;
  },
  dropChunks() { this.chunks.clear(); },

  /* ============================== 1 こま ============================== */
  draw(G) {
    const g = this.ctx, m = G.map;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = m.kind === 'tower' ? '#0c0a14' : '#2e5a28';
    g.fillRect(0, 0, this.W, this.H);

    const sh = this.shake > 0 ? this.shake : 0;
    const ox = sh ? (Math.random() - 0.5) * sh * 2 : 0, oy = sh ? (Math.random() - 0.5) * sh * 2 : 0;
    g.setTransform(this.dpr * this.zoom, 0, 0, this.dpr * this.zoom, (-this.cam.x * this.zoom + ox) * this.dpr, (-this.cam.y * this.zoom + oy) * this.dpr);
    g.imageSmoothingEnabled = true;

    const x0 = Math.floor(this.cam.x / TILE), y0 = Math.floor(this.cam.y / TILE);
    const x1 = Math.ceil((this.cam.x + this.vw) / TILE), y1 = Math.ceil((this.cam.y + this.vh) / TILE);
    for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor(y1 / CHUNK); cy++) {
      for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++) {
        if (cx < 0 || cy < 0 || cx * CHUNK >= m.w || cy * CHUNK >= m.h) continue;
        const c = this.chunk(m, cx, cy);
        /* 少し重ねて描くと、拡大したときの半透明のふちが残らない */
        const O = 0.75;
        g.drawImage(c.cv, (CHUNK_PAD - O) * 2, (CHUNK_PAD - O) * 2, (CHUNK * TILE + O * 2) * 2, (CHUNK * TILE + O * 2) * 2,
          cx * CHUNK * TILE - O, cy * CHUNK * TILE - O, CHUNK * TILE + O * 2, CHUNK * TILE + O * 2);
      }
    }
    this.drawWater(g, m, x0, y0, x1, y1);

    /* 地面にはりつく物 */
    const st = Game.structState();
    for (const s of m.structs) {
      if (!s.flat && !['stairsDown', 'stairsUp', 'torch', 'stakes', 'exit'].includes(s.kind)) continue;
      if (!this.inView(s.x * TILE, s.y * TILE, s.w * TILE, s.h * TILE, 64)) continue;
      drawStruct(g, s, this.t, st);
    }
    for (const fx of G.marks) this.drawMark(g, fx);

    /* 奥から手前へ */
    const list = [];
    for (let ty = Math.max(0, y0 - 1); ty <= Math.min(m.h - 1, y1 + 3); ty++) {
      for (let tx = Math.max(0, x0 - 1); tx <= Math.min(m.w - 1, x1 + 1); tx++) {
        const n = m.nodes.get(ty * m.w + tx);
        if (n) list.push({ y: ty * TILE + 26 - (n.dead ? 20 : 0), k: 0, o: n });
      }
    }
    for (const s of m.structs) {
      if (['stairsDown', 'stairsUp', 'torch', 'stakes', 'exit'].includes(s.kind)) continue;
      if (!this.inView(s.x * TILE - 40, s.y * TILE - 260, s.w * TILE + 80, s.h * TILE + 280, 0)) continue;
      list.push({ y: (s.y + s.h) * TILE - 1, k: 1, o: s });
    }
    for (const d of G.drops) list.push({ y: d.y, k: 2, o: d });
    for (const n of G.npcs) if (n.map === m.id) list.push({ y: n.y, k: 3, o: n });
    for (const e of G.mobs) list.push({ y: e.y, k: 4, o: e });
    if (G.boss) list.push({ y: G.boss.y, k: 5, o: G.boss });
    list.push({ y: G.p.y, k: 6, o: G.p });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      switch (it.k) {
        case 0: drawNode(g, it.o, this.t); break;
        case 1: drawStruct(g, it.o, this.t, st); break;
        case 2: this.drawDrop(g, it.o); break;
        case 3: this.drawNpc(g, it.o); break;
        case 4: drawMob(g, it.o, this.t); break;
        case 5: drawBoss(g, it.o, this.t); break;
        case 6: this.drawPlayer(g, G); break;
      }
    }
    for (const b of G.shots) this.drawShot(g, b);
    for (const fx of G.zaps) this.drawZap(g, fx);
    FX.draw(g);
    this.drawPrompt(g, G);
    this.drawArrow(g, G);

    /* ここからは画面の座標 */
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawWeather(g, G);
    this.drawStick(g);
    if (G.p.hurtT > 0) {
      g.fillStyle = `rgba(255,40,40,${G.p.hurtT * 0.35})`;
      g.fillRect(0, 0, this.W, this.H);
    }
    if (G.coldT > 0.05) {
      g.fillStyle = `rgba(180,220,255,${G.coldT * 0.35})`;
      g.fillRect(0, 0, this.W, this.H);
    }
    if (this.fade > 0) {
      g.fillStyle = `rgba(10,6,14,${this.fade})`;
      g.fillRect(0, 0, this.W, this.H);
    }
  },

  inView(x, y, w, h, pad) {
    return x + w + pad > this.cam.x && x - pad < this.cam.x + this.vw && y + h + pad > this.cam.y && y - pad < this.cam.y + this.vh;
  },

  drawWater(g, m, x0, y0, x1, y1) {
    const t = this.t;
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.4;
    for (let ty = Math.max(0, y0); ty <= Math.min(m.h - 1, y1); ty++) {
      for (let tx = Math.max(0, x0); tx <= Math.min(m.w - 1, x1); tx++) {
        if (m.tiles[ty * m.w + tx] !== T.WATER) continue;
        const h = hash2(tx, ty, 77);
        if (h > 0.35) continue;
        const k = (t * 0.6 + h * 10) % 1;
        const px = tx * TILE + 6 + h * 18, py = ty * TILE + 10 + ((h * 31) % 1) * 14;
        g.globalAlpha = Math.sin(k * Math.PI) * 0.8;
        g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + 4, py - 2.5, px + 8, py); g.stroke();
      }
    }
    g.globalAlpha = 1;
  },

  drawPlayer(g, G) {
    const p = G.p;
    if (p.iframe > 0 && p.roll < 0 && Math.floor(this.t * 20) % 2) return;
    drawHamster(g, p.x, p.y, {
      face: p.face, t: this.t, moving: p.moving, fur: FURS.gold[0], belly: FURS.gold[1],
      body: G.eq.body, hat: G.eq.hat, bag: Game.bagId(), weapon: G.eq.weapon || 'paw', staff: G.eq.staff,
      swing: p.swing >= 0 ? p.swing / p.swingMax : -1, aim: p.aim, roll: p.roll >= 0 ? p.roll / 0.32 : -1,
      cheek: Game.bagFill(), flash: p.flash, cast: p.castT > 0 ? p.castT / 0.3 : 0, seed: 1,
    });
    if (p.slowT > 0) { g.globalAlpha = 0.55; circ(g, p.x, p.y - 10, 14, null, '#ffffff', 2); g.globalAlpha = 1; }
  },

  drawNpc(g, n) {
    const f = FURS[n.fur] || FURS.cream;
    drawHamster(g, n.x, n.y, {
      face: n.face, t: this.t + n.seed, moving: n.moving, fur: f[0], belly: f[1], body: n.body, hat: n.hat,
      bag: n.bag || 'cheek', weapon: null, swing: -1, roll: -1, cheek: 0.1, seed: n.seed,
      beard: n.beard, apron: n.apron, glasses: n.glasses, scale: n.scale || 1,
    });
    if (n.mark) {
      const k = Math.sin(this.t * 5) * 2;
      rrect(g, n.x - 8, n.y - 46 + k, 16, 16, 5, n.mark === '!' ? '#ffd84a' : '#9fe8ff', INK, 1.4);
      g.fillStyle = INK; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(n.mark, n.x, n.y - 38 + k);
    }
  },

  drawDrop(g, d) {
    const k = Math.sin(this.t * 4 + d.seed) * 2.5;
    const blink = d.life < 8 && Math.floor(this.t * 6) % 2;
    if (blink) return;
    shadow(g, d.x, d.y, 6, 2.2, 0.2);
    if (d.coin) {
      circ(g, d.x, d.y - 7 + k, 5, '#ffd84a', '#b8861a', 1.3);
      g.fillStyle = '#b8861a'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('C', d.x, d.y - 6.5 + k);
      return;
    }
    const icon = d.book ? BOOKS[d.book].icon : d.gear ? GEAR[d.gear].icon : ITEMS[d.item].icon;
    const sp = Art.sprite('ic:' + icon, 24, 24, 12, 12, (gg) => {
      gg.font = '17px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText(icon, 0, 1);
    });
    if (d.book || d.gear) { g.globalAlpha = 0.35 + Math.sin(this.t * 5) * 0.2; circ(g, d.x, d.y - 10 + k, 14, '#ffe680'); g.globalAlpha = 1; }
    Art.blit(g, sp, d.x, d.y - 10 + k);
  },

  drawShot(g, b) {
    const t = this.t;
    switch (b.kind) {
      case 'bolt':
        g.globalAlpha = 0.35; circ(g, b.x - b.vx * 0.03, b.y - b.vy * 0.03, 6, '#9fe8ff'); g.globalAlpha = 1;
        circ(g, b.x, b.y, 5, '#b8f4ff', '#3aa0d8', 1.4); circ(g, b.x - 1.5, b.y - 1.5, 1.6, '#fff'); break;
      case 'fire':
        g.globalAlpha = 0.4; circ(g, b.x - b.vx * 0.03, b.y - b.vy * 0.03, 9, '#ff8a3a'); g.globalAlpha = 1;
        circ(g, b.x, b.y, 7, '#ff9a3a', '#c8401a', 1.4); circ(g, b.x, b.y, 3.5, '#ffe680'); break;
      case 'wind': {
        g.save(); g.translate(b.x, b.y);
        for (let i = 0; i < 4; i++) {
          g.globalAlpha = 0.65 - i * 0.12;
          ell(g, Math.sin(t * 20 + i) * 3, -i * 7, 12 - i * 1.5, 4, null, '#e8fbff', 2.4);
        }
        g.restore(); g.globalAlpha = 1; break;
      }
      case 'star':
        g.fillStyle = '#ffe680'; g.font = '22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('★', b.x, b.y); break;
      case 'web': circ(g, b.x, b.y, 6, '#f4f4f8', '#9a9aaa', 1.2); line(g, b.x - 4, b.y, b.x + 4, b.y, '#9a9aaa', 0.8); line(g, b.x, b.y - 4, b.x, b.y + 4, '#9a9aaa', 0.8); break;
      case 'snow': circ(g, b.x, b.y, 6, '#ffffff', '#9ab0d0', 1.3); break;
      case 'spore': g.globalAlpha = 0.85; circ(g, b.x, b.y, 6 + Math.sin(t * 20) * 1, '#b8e05a', '#6a9a2a', 1.2); g.globalAlpha = 1; break;
      case 'dark': g.globalAlpha = 0.5; circ(g, b.x, b.y, 10, '#8a5aff'); g.globalAlpha = 1; circ(g, b.x, b.y, 6, '#3a1a6a', '#b88aff', 1.6); break;
      case 'feather':
        g.save(); g.translate(b.x, b.y); g.rotate(Math.atan2(b.vy, b.vx));
        ell(g, 0, 0, 10, 3, '#a8743f', INK, 1); line(g, -10, 0, 10, 0, '#5a3a1a', 1); g.restore(); break;
      case 'yarn':
        circ(g, b.x, b.y, 9, '#e85a8a', INK, 1.4);
        g.strokeStyle = '#ffb0c8'; g.lineWidth = 1.2; g.beginPath(); g.arc(b.x, b.y, 5, t * 8, t * 8 + 3); g.stroke(); break;
      default: circ(g, b.x, b.y, 5, '#fff');
    }
  },

  drawZap(g, z) {
    const k = 1 - z.t / z.max;
    if (z.kind === 'boom') {
      g.globalAlpha = 1 - k; circ(g, z.x, z.y, z.r * (0.4 + k * 0.7), '#ffb84a'); circ(g, z.x, z.y, z.r * (0.2 + k * 0.4), '#fff1a8'); g.globalAlpha = 1;
    } else if (z.kind === 'ring') {
      g.globalAlpha = (1 - k) * 0.9; g.save(); g.translate(z.x, z.y); g.scale(1, 0.55);
      circ(g, 0, 0, z.r * k, null, z.col || '#ffffff', 5); g.restore(); g.globalAlpha = 1;
    } else if (z.kind === 'warn') {
      g.globalAlpha = 0.25 + Math.sin(this.t * 20) * 0.1; g.save(); g.translate(z.x, z.y); g.scale(1, 0.55);
      circ(g, 0, 0, z.r, '#ff4a4a'); g.restore(); g.globalAlpha = 1;
    } else if (z.kind === 'swipe') {
      g.globalAlpha = 0.25 + (z.live ? 0.5 : 0.1);
      g.beginPath(); g.moveTo(z.x, z.y); g.arc(z.x, z.y, z.r, z.a - z.arc / 2, z.a + z.arc / 2); g.closePath();
      g.fillStyle = z.live ? '#ffb0a0' : '#ff4a4a'; g.fill(); g.globalAlpha = 1;
    } else if (z.kind === 'heal') {
      g.globalAlpha = 1 - k; circ(g, z.x, z.y - 10, 10 + k * 30, null, '#7aff9a', 4); g.globalAlpha = 1;
    } else if (z.kind === 'line') {
      g.globalAlpha = 0.3 + Math.sin(this.t * 30) * 0.15;
      line(g, z.x, z.y, z.x2, z.y2, '#ff5a4a', z.r || 16); g.globalAlpha = 1;
    }
  },
  drawMark(g, m) {
    if (m.kind === 'scorch') { g.globalAlpha = Math.min(1, m.t) * 0.4; ell(g, m.x, m.y, 14, 6, '#2a1a10'); g.globalAlpha = 1; }
  },

  /* しらべられる物の上に吹き出し */
  drawPrompt(g, G) {
    const n = G.near;
    if (!n || UI.isBusy()) return;
    const label = Input.isTouch ? n.label : 'E ' + n.label;
    g.font = 'bold 11px "Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif';
    const w = g.measureText(label).width + 14;
    /* ハムスターの頭にも、しらべる物にも重ならない高さに出す */
    const y = Math.min(n.y - (n.h || 40), G.p.y - 48) - Math.sin(this.t * 4) * 2;
    rrect(g, n.x - w / 2, y - 10, w, 20, 8, 'rgba(255,250,236,.95)', INK, 1.4);
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, n.x, y + 0.5);
  },

  /* 目的地の向きを、ハムスターのまわりに矢印で出す */
  drawArrow(g, G) {
    const q = G.target;
    if (!q || q.map !== G.map.id || UI.isBusy()) return;
    const p = G.p, d = dist(p.x, p.y, q.x, q.y);
    if (d < 140) return;
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    const r = 46, ax = p.x + Math.cos(a) * r, ay = p.y - 12 + Math.sin(a) * r;
    g.save(); g.translate(ax, ay); g.rotate(a);
    g.globalAlpha = 0.75 + Math.sin(this.t * 5) * 0.2;
    poly(g, [10, 0, -5, -7, -2, 0, -5, 7], '#ffd84a', INK, 1.5);
    g.restore(); g.globalAlpha = 1;
  },

  drawStick(g) {
    const s = Input.touch;
    if (!s.active) return;
    g.globalAlpha = 0.35; circ(g, s.ox, s.oy, 56, null, '#fff', 3);
    g.globalAlpha = 0.5; circ(g, s.ox + s.dx * 56, s.oy + s.dy * 56, 22, '#fff');
    g.globalAlpha = 1;
  },

  /* ------------------------------ 天気 ------------------------------ */
  drawWeather(g, G) {
    const reg = G.region, W = this.W, H = this.H;
    let kind = null;
    if (G.map.kind === 'tower') kind = 'tower';
    else if (reg === 'snow') kind = 'snow';
    else if (reg === 'forest' || reg === 'deepwood') kind = 'leaf';
    else if (reg === 'valley') kind = 'mist';
    else if (reg === 'moon') kind = 'moon';
    const want = kind === 'snow' ? 90 : kind === 'leaf' ? 14 : kind === 'mist' ? 10 : kind === 'moon' ? 30 : 0;
    const list = this.weather;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].kind !== kind) list.splice(i, 1);
    while (list.length < want) {
      list.push({ kind, x: Math.random() * W, y: Math.random() * H, s: Math.random(), p: Math.random() * TAU });
    }
    const dt = 1 / 60, t = this.t;
    for (const w of list) {
      if (kind === 'snow') {
        w.y += (40 + w.s * 60) * dt; w.x += Math.sin(t + w.p) * 20 * dt - 12 * dt;
        g.globalAlpha = 0.85; circ(g, w.x, w.y, 1.4 + w.s * 2, '#fff');
      } else if (kind === 'leaf') {
        w.y += (18 + w.s * 18) * dt; w.x += Math.sin(t * 1.3 + w.p) * 30 * dt;
        g.save(); g.translate(w.x, w.y); g.rotate(t * 2 + w.p); g.globalAlpha = 0.8;
        ell(g, 0, 0, 5, 2.4, w.s > 0.5 ? '#8ad05a' : '#e8c84a'); g.restore();
      } else if (kind === 'mist') {
        w.x += (8 + w.s * 10) * dt;
        g.globalAlpha = 0.12; ell(g, w.x, w.y, 160 + w.s * 120, 50 + w.s * 30, '#e8f4f0');
      } else if (kind === 'moon') {
        w.y -= 6 * dt; w.x += Math.sin(t + w.p) * 8 * dt;
        g.globalAlpha = 0.35 + Math.sin(t * 3 + w.p) * 0.35; circ(g, w.x, w.y, 1.6 + w.s, '#fff3a8');
      }
      if (w.y > H + 10) { w.y = -10; w.x = Math.random() * W; }
      if (w.y < -10) { w.y = H + 10; w.x = Math.random() * W; }
      if (w.x > W + 200) w.x = -200;
      if (w.x < -200) w.x = W + 200;
    }
    g.globalAlpha = 1;
    if (kind === 'mist') { g.fillStyle = 'rgba(200,230,225,.12)'; g.fillRect(0, 0, W, H); }
    if (kind === 'moon') { g.fillStyle = 'rgba(40,20,80,.16)'; g.fillRect(0, 0, W, H); }
    if (kind === 'snow') { g.fillStyle = 'rgba(220,235,255,.08)'; g.fillRect(0, 0, W, H); }
    if (kind === 'tower' || kind === 'moon' || kind === 'mist') {
      if (!this.vignette) {
        const grd = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
        grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,.5)');
        this.vignette = grd;
      }
      g.fillStyle = this.vignette; g.fillRect(0, 0, W, H);
    }
  },

  /* ------------------------------ 地図の絵 ------------------------------ */
  mapCanvas: null, mapVer: -1,
  worldMap(m) {
    if (this.mapCanvas && this.mapVer === m.ver) return this.mapCanvas;
    const c = this.mapCanvas || document.createElement('canvas');
    c.width = m.w; c.height = m.h;
    const g = c.getContext('2d');
    const img = g.createImageData(m.w, m.h);
    const COL = {
      [T.FOREST]: [78, 150, 60], [T.MEADOW]: [130, 196, 92], [T.GRASS]: [124, 195, 90], [T.PATH]: [222, 190, 130],
      [T.TOWN]: [150, 210, 110], [T.COBBLE]: [236, 222, 196], [T.ROCKY]: [170, 152, 128], [T.SNOW]: [240, 246, 252],
      [T.VALLEY]: [80, 154, 130], [T.MOON]: [126, 108, 172], [T.SAND]: [236, 217, 166], [T.FIELD]: [220, 180, 60],
      [T.BRIDGE]: [200, 140, 70], [T.WATER]: [74, 166, 220], [T.CLIFF]: [110, 96, 82], [T.SNOWCLIFF]: [170, 186, 210],
      [T.CHASM]: [20, 14, 30], [T.DENSE]: [40, 96, 40],
    };
    for (let i = 0; i < m.tiles.length; i++) {
      const c3 = COL[m.tiles[i]] || [0, 0, 0];
      const n = m.nodes.get(i);
      const k = n && (n.type === 'tree' || n.type === 'pine' || n.type === 'snowpine') ? 0.8 : 1;
      img.data[i * 4] = c3[0] * k; img.data[i * 4 + 1] = c3[1] * k; img.data[i * 4 + 2] = c3[2] * k; img.data[i * 4 + 3] = 255;
    }
    for (const s of m.structs) {
      if (!['home', 'shop', 'magic', 'house', 'tower', 'hut', 'tent'].includes(s.kind)) continue;
      for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) {
        const i = y * m.w + x; img.data[i * 4] = 200; img.data[i * 4 + 1] = 90; img.data[i * 4 + 2] = 70;
      }
    }
    g.putImageData(img, 0, 0);
    this.mapCanvas = c; this.mapVer = m.ver;
    return c;
  },
};
