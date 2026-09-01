/* =========================================================================
   MOKO GOD ― 絵をかく
   雲の上 / 地上 / 城のなか / 世界地図 / モコたち
   ========================================================================= */
'use strict';

const R = {
  canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
  cam: { x: 0, y: 0 },
  thumb: null, thumbDirty: true,
  t: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.thumb = document.createElement('canvas');
    this.thumb.width = World.w; this.thumb.height = World.h;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * dpr);
    this.canvas.height = Math.floor(this.H * dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
  },

  follow(x, y, bounds) {
    let cx = x - this.W / 2, cy = y - this.H / 2;
    if (bounds) {
      cx = clamp(cx, 0, Math.max(0, bounds.w - this.W));
      cy = clamp(cy, 0, Math.max(0, bounds.h - this.H));
    }
    this.cam.x = lerp(this.cam.x, cx, 0.16);
    this.cam.y = lerp(this.cam.y, cy, 0.16);
  },

  snap(x, y, bounds) {
    this.cam.x = x - this.W / 2; this.cam.y = y - this.H / 2;
    if (bounds) {
      this.cam.x = clamp(this.cam.x, 0, Math.max(0, bounds.w - this.W));
      this.cam.y = clamp(this.cam.y, 0, Math.max(0, bounds.h - this.H));
    }
  },

  /* ------------------------- 世界のちいさな絵 ------------------------- */
  buildThumb() {
    const c = this.thumb.getContext('2d');
    const img = c.createImageData(World.w, World.h);
    const d = img.data;
    for (let i = 0; i < World.tiles.length; i++) {
      const def = TILE_DEF[World.tiles[i]];
      const n = parseInt(def.c1.slice(1), 16);
      d[i * 4] = (n >> 16) & 255; d[i * 4 + 1] = (n >> 8) & 255; d[i * 4 + 2] = n & 255; d[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    this.thumbDirty = false;
  },

  /* --------------------------- 共通の小物 --------------------------- */
  shadow(ctx, x, y, w, h, a = 0.24) {
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); ctx.fill();
  },

  glow(ctx, x, y, r, color, a = 0.5) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace('ALPHA', a));
    g.addColorStop(1, color.replace('ALPHA', 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  },

  /* ============================== モコ ==============================
     o: {s 大きさ, c1 体, c2 影, halo 天使の輪, face 向き, wob ゆれ,
         eye 目の色, demon 悪魔, sleep, glow}                          */
  drawMoko(ctx, x, y, o = {}) {
    const s = o.s || 1;
    const wob = o.wob || 0;
    const bob = Math.sin(wob) * 1.8 * s;
    const c1 = o.c1 || '#ffc2dc', c2 = o.c2 || '#ff8ab4';
    const eye = o.eye || '#4a2f3a';

    this.shadow(ctx, x, y + 12 * s, 12 * s, 4.4 * s, o.demon ? 0.34 : 0.22);

    if (o.glow) this.glow(ctx, x, y - 2 * s, 46 * s, 'rgba(255,236,180,ALPHA)', 0.4);

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale((o.face || 1) * s, s);

    /* からだ */
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.ellipse(0, -2, 11, 9.4, 0, 0, TAU); ctx.fill();

    /* ふわふわの毛 */
    ctx.fillStyle = c1;
    for (let i = -2; i <= 2; i++) {
      const a = -1.9 + i * 0.42;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 10, Math.sin(a) * 8 - 2, 3.4 + (i % 2 ? 0.7 : 0), 0, TAU);
      ctx.fill();
    }

    /* 顔 */
    if (o.demon) {
      ctx.fillStyle = '#ff4a6a';
      ctx.beginPath(); ctx.ellipse(-4.4, -3, 2.6, 2.2, 0.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(4.4, -3, 2.6, 2.2, -0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a0a18';
      ctx.beginPath(); ctx.moveTo(-11, -8); ctx.lineTo(-15, -17); ctx.lineTo(-6.5, -11); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(11, -8); ctx.lineTo(15, -17); ctx.lineTo(6.5, -11); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a0f2a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-3.5, 3.6); ctx.lineTo(0, 1.8); ctx.lineTo(3.5, 3.6); ctx.stroke();
    } else if (o.sleep) {
      ctx.strokeStyle = eye; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-4, -3, 2.4, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(4, -3, 2.4, 0.2, Math.PI - 0.2); ctx.stroke();
    } else {
      ctx.fillStyle = eye;
      ctx.beginPath(); ctx.arc(-4, -3, 2.1, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(4, -3, 2.1, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.arc(-4.7, -3.8, 0.8, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(3.3, -3.8, 0.8, 0, TAU); ctx.fill();
      if (o.blush) {
        ctx.fillStyle = 'rgba(255,140,170,.5)';
        ctx.beginPath(); ctx.ellipse(-7.5, 0.5, 2.4, 1.6, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(7.5, 0.5, 2.4, 1.6, 0, 0, TAU); ctx.fill();
      }
    }

    /* あし */
    ctx.fillStyle = c2;
    const step = Math.sin(wob * 2) * 1.4;
    ctx.beginPath(); ctx.ellipse(-5, 10 + step, 3.2, 2.4, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, 10 - step, 3.2, 2.4, 0, 0, TAU); ctx.fill();
    ctx.restore();

    /* 天使の輪 */
    if (o.halo) {
      const hy = y + bob - 16 * s;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,224,138,.95)';
      ctx.lineWidth = 2.6 * s;
      ctx.shadowColor = 'rgba(255,224,138,.9)'; ctx.shadowBlur = 12 * s;
      ctx.beginPath(); ctx.ellipse(x, hy, 9.5 * s, 3.2 * s, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  },

  /* 神さま。まっしろで、天使の輪つき。 */
  drawGod(ctx, x, y, g, s = 1.15) {
    this.drawMoko(ctx, x, y, {
      s, c1: '#ffffff', c2: '#d8e2f5', eye: '#5a6a8a',
      halo: true, face: g.face, wob: g.wob, glow: true, blush: true,
    });
  },

  /* ============================ いきもの ============================ */
  drawCreature(ctx, x, y, sp, wob, face = 1, s = 1) {
    const d = SPECIES[sp];
    if (!d) return;
    this.shadow(ctx, x, y + 9 * s, 9 * s, 3.4 * s);
    ctx.save();
    ctx.translate(x, y + Math.sin(wob) * 1.6);
    ctx.scale(face * s, s);
    switch (d.form) {
      case 'hop': {
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.ellipse(0, 1, 8, 6.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.c1;
        ctx.beginPath(); ctx.ellipse(3, -3, 5.5, 5, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = d.c1; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(3, -7); ctx.lineTo(1, -14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5, -7); ctx.lineTo(6, -14); ctx.stroke();
        ctx.fillStyle = '#3a2a2a';
        ctx.beginPath(); ctx.arc(5.4, -3.4, 1.1, 0, TAU); ctx.fill();
        break;
      }
      case 'wool': {
        ctx.fillStyle = d.c2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 6, Math.sin(a) * 4.5, 4.4, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = d.c1;
        ctx.beginPath(); ctx.ellipse(0, 0, 8, 6.4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#5a5a68';
        ctx.beginPath(); ctx.ellipse(7.5, 0, 3.6, 3.2, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#5a5a68'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(-4, 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4, 6); ctx.lineTo(4, 10); ctx.stroke();
        break;
      }
      case 'beast': {
        ctx.strokeStyle = d.c1; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
          const p = Math.sin(wob * 1.7 + k * 1.5) * 2.6;
          ctx.beginPath(); ctx.moveTo(-9 + k * 6, 5); ctx.lineTo(-10 + k * 6 + p, 13); ctx.stroke();
        }
        ctx.fillStyle = d.c1;
        ctx.beginPath(); ctx.ellipse(-2, 0, 14, 9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.ellipse(9, -3, 7.5, 6.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f4ffd2';
        ctx.beginPath(); ctx.arc(11, -4, 3.2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a1f3a';
        ctx.beginPath(); ctx.arc(12, -4, 1.5, 0, TAU); ctx.fill();
        break;
      }
      case 'fish': {
        ctx.fillStyle = d.c1;
        ctx.beginPath(); ctx.ellipse(0, 0, 9, 4.6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-14, -5); ctx.lineTo(-14, 5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(-2, -11); ctx.lineTo(5, -3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#123';
        ctx.beginPath(); ctx.arc(5, -1, 1.2, 0, TAU); ctx.fill();
        break;
      }
      case 'bug': {
        ctx.strokeStyle = d.c1; ctx.lineWidth = 2;
        for (let k = -1; k <= 1; k++) {
          const p = Math.sin(wob * 1.6 + k) * 2.4;
          ctx.beginPath(); ctx.moveTo(k * 4, 2); ctx.lineTo(k * 4 - 7, 8 + p); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(k * 4, 2); ctx.lineTo(k * 4 + 7, 8 - p); ctx.stroke();
        }
        ctx.fillStyle = d.c1;
        ctx.beginPath(); ctx.ellipse(-2, 0, 9, 6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.c2;
        ctx.beginPath(); ctx.ellipse(6, -1, 5, 4.4, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = d.c2; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(9, -3); ctx.lineTo(14, -8); ctx.stroke();
        break;
      }
      case 'shadow': {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = d.c1;
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) {
          const a = (i / 12) * TAU;
          const rr = 9 + Math.sin(a * 3 + wob * 2) * 2.2;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.8;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff3a5a';
        ctx.beginPath(); ctx.arc(-3, -1, 1.6, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(3, -1, 1.6, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
    }
    ctx.restore();
  },
};

/* ========================================================================
   雲の上のけしき
   ======================================================================== */
Object.assign(R, {
  skyColors(tod) {
    /* tod: 0 = 真夜中, 0.5 = まひる */
    const day = clamp(Math.sin(tod * TAU - Math.PI / 2) * 0.5 + 0.5, 0, 1);
    const top = mixHex('#0a0f38', '#3f7fd8', day);
    const mid = mixHex('#1d1b4a', '#7fc0f0', day);
    const bot = mixHex('#3a2a52', '#d8f0ff', day);
    return { day, top, mid, bot };
  },

  drawSky(G, dt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const sc = this.skyColors(G.tod);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sc.top); g.addColorStop(0.45, sc.mid); g.addColorStop(1, sc.bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    /* 星 */
    if (sc.day < 0.6) {
      ctx.globalAlpha = (1 - sc.day / 0.6) * 0.9;
      for (let i = 0; i < 90; i++) {
        const sx = (hash2(i, 3) * W * 1.2 - this.cam.x * 0.03) % W;
        const sy = hash2(i, 7) * H * 0.62;
        const tw = 0.6 + Math.sin(this.t * 2 + i) * 0.4;
        ctx.fillStyle = i % 9 === 0 ? '#ffe0a8' : '#ffffff';
        ctx.beginPath(); ctx.arc(sx < 0 ? sx + W : sx, sy, tw, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* はるか下の星（地上） */
    if (this.thumbDirty) this.buildThumb();
    ctx.save();
    ctx.globalAlpha = 0.34 + sc.day * 0.2;
    const px = -this.cam.x * 0.055, py = H * 0.30 - this.cam.y * 0.05;
    ctx.drawImage(this.thumb, px - W * 0.15, py, W * 1.5, H * 0.95);
    ctx.restore();
    const haze = ctx.createLinearGradient(0, H * 0.2, 0, H);
    haze.addColorStop(0, sc.mid); haze.addColorStop(0.45, 'rgba(255,255,255,0)');
    haze.addColorStop(1, `rgba(${sc.day > 0.5 ? '210,235,255' : '40,40,80'},.35)`);
    ctx.fillStyle = haze; ctx.fillRect(0, H * 0.2, W, H * 0.8);

    /* とおくの雲（ゆっくり流れる） */
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 10; i++) {
      const cw = 180 + hash2(i, 21) * 260;
      const cx = ((hash2(i, 22) * 2600 + this.t * (8 + i)) % (W + 600)) - 300 - this.cam.x * 0.08;
      const cy = 60 + hash2(i, 23) * (H * 0.7) - this.cam.y * 0.06;
      ctx.fillStyle = sc.day > 0.5 ? 'rgba(255,255,255,.5)' : 'rgba(180,190,240,.22)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw * 0.5, cw * 0.16, 0, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + cw * 0.14, cy - cw * 0.06, cw * 0.28, cw * 0.14, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* 雲の島 */
    const cam = this.cam;
    const vis = (c) => c.x - cam.x > -c.r - 120 && c.x - cam.x < W + c.r + 120
      && c.y - cam.y > -c.r - 160 && c.y - cam.y < H + c.r + 160;
    const dark = G.demon.bridge;

    const drawIsles = (isDark) => {
      const list = SKY.circles.filter((c) => !!c.dark === isDark && vis(c));
      if (!list.length) return;
      const body = new Path2D(), shad = new Path2D();
      let top = 1e9, bot = -1e9;
      for (const c of list) {
        const x = c.x - cam.x, y = c.y - cam.y;
        body.moveTo(x + c.r, y);
        body.ellipse(x, y, c.r, c.r * 0.82, 0, 0, TAU);
        shad.moveTo(x + c.r * 1.01, y + c.r * 0.30);
        shad.ellipse(x, y + c.r * 0.30, c.r * 1.01, c.r * 0.80, 0, 0, TAU);
        top = Math.min(top, y - c.r * 0.82); bot = Math.max(bot, y + c.r * 0.82);
      }
      ctx.fillStyle = isDark ? 'rgba(20,8,30,.7)' : 'rgba(148,168,214,.5)';
      ctx.fill(shad);
      ctx.fillStyle = isDark ? '#2d1c40' : '#ffffff';
      ctx.fill(body);
      ctx.save();
      ctx.clip(body);
      const gg = ctx.createLinearGradient(0, top, 0, bot);
      if (isDark) { gg.addColorStop(0, 'rgba(120,86,164,.55)'); gg.addColorStop(0.5, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(8,2,14,.6)'); }
      else { gg.addColorStop(0, 'rgba(255,255,255,.9)'); gg.addColorStop(0.45, 'rgba(255,255,255,0)'); gg.addColorStop(1, 'rgba(150,176,220,.55)'); }
      ctx.fillStyle = gg;
      ctx.fillRect(0, top, W, bot - top);
      /* 下のふくらみに、やわらかい影をつける */
      ctx.fillStyle = isDark ? 'rgba(10,4,18,.35)' : 'rgba(154,180,224,.32)';
      ctx.fill(shad);
      ctx.restore();
    };
    drawIsles(false);
    if (dark) drawIsles(true);

    /* 建っているもの */
    for (const s of SKY.spots) {
      if (s.dark && !dark) continue;
      this.drawSpot(ctx, G, s, s.x - cam.x, s.y - cam.y);
    }

    /* 神さま */
    FX.draw(ctx, cam);
    this.drawGod(ctx, G.god.x - cam.x, G.god.y - cam.y, G.god, 1.8);

    /* 夜のとばり */
    if (sc.day < 0.45) {
      ctx.fillStyle = `rgba(20,20,60,${(0.45 - sc.day) * 0.7})`;
      ctx.fillRect(0, 0, W, H);
    }
  },

  drawSpot(ctx, G, s, x, y) {
    ctx.save();
    switch (s.id) {
      case 'shrine': {
        this.shadow(ctx, x, y + 22, 44, 12, 0.2);
        ctx.fillStyle = '#f2f4ff';
        ctx.beginPath(); ctx.moveTo(x - 26, y + 18); ctx.lineTo(x - 20, y - 10);
        ctx.lineTo(x + 20, y - 10); ctx.lineTo(x + 26, y + 18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e05f6a';
        ctx.fillRect(x - 30, y - 22, 60, 6);
        ctx.fillRect(x - 34, y - 30, 68, 5);
        ctx.fillRect(x - 22, y - 22, 6, 40);
        ctx.fillRect(x + 16, y - 22, 6, 40);
        this.glow(ctx, x, y - 4, 70, 'rgba(255,228,160,ALPHA)', 0.28 + Math.sin(this.t * 2) * 0.06);
        break;
      }
      case 'window': {
        const rr = 54;
        this.glow(ctx, x, y, 100, 'rgba(160,220,255,ALPHA)', 0.32);
        ctx.save();
        ctx.beginPath(); ctx.ellipse(x, y + 6, rr, rr * 0.62, 0, 0, TAU); ctx.clip();
        if (this.thumbDirty) this.buildThumb();
        ctx.drawImage(this.thumb, x - rr, y + 6 - rr * 0.62, rr * 2, rr * 1.24);
        ctx.fillStyle = 'rgba(120,190,255,.28)';
        ctx.fillRect(x - rr, y - 60, rr * 2, 140);
        ctx.restore();
        ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.ellipse(x, y + 6, rr, rr * 0.62, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(x, y + 6, rr - 7, rr * 0.62 - 5, 0, 0, TAU); ctx.stroke();
        break;
      }
      case 'altar': {
        this.shadow(ctx, x, y + 24, 40, 11, 0.2);
        ctx.fillStyle = '#cfd8ee';
        ctx.fillRect(x - 30, y + 8, 60, 14);
        ctx.fillStyle = '#e8eefc';
        ctx.fillRect(x - 20, y - 6, 40, 16);
        const fl = Math.sin(this.t * 1.6) * 6;
        this.glow(ctx, x, y - 26 + fl, 62, 'rgba(255,224,138,ALPHA)', 0.55);
        ctx.fillStyle = '#fff6d8';
        ctx.beginPath(); ctx.arc(x, y - 26 + fl, 11, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,224,138,.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y - 26 + fl, 22, 7, this.t * 0.8, 0, TAU); ctx.stroke();
        break;
      }
      case 'gate': {
        this.shadow(ctx, x, y + 26, 46, 12, 0.2);
        ctx.fillStyle = '#f2f5ff';
        ctx.beginPath();
        ctx.moveTo(x - 34, y + 24); ctx.lineTo(x - 34, y - 14);
        ctx.arc(x, y - 14, 34, Math.PI, 0); ctx.lineTo(x + 34, y + 24);
        ctx.lineTo(x + 22, y + 24); ctx.lineTo(x + 22, y - 12);
        ctx.arc(x, y - 12, 22, 0, Math.PI, true); ctx.lineTo(x - 22, y + 24);
        ctx.closePath(); ctx.fill();
        const lg = ctx.createLinearGradient(0, y - 20, 0, y + 200);
        lg.addColorStop(0, 'rgba(255,236,170,.8)'); lg.addColorStop(1, 'rgba(255,236,170,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(x - 20, y - 20, 40, 220);
        for (let i = 0; i < 4; i++) {
          const p = ((this.t * 40 + i * 40) % 160);
          ctx.fillStyle = `rgba(255,245,200,${0.5 - p / 320})`;
          ctx.beginPath(); ctx.arc(x + Math.sin(this.t + i) * 9, y + p, 2.6, 0, TAU); ctx.fill();
        }
        break;
      }
      case 'tower': {
        this.shadow(ctx, x, y + 26, 32, 9, 0.2);
        ctx.fillStyle = '#e6ecfa';
        ctx.beginPath(); ctx.moveTo(x - 17, y + 24); ctx.lineTo(x - 12, y - 26);
        ctx.lineTo(x + 12, y - 26); ctx.lineTo(x + 17, y + 24); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8aa0d0';
        ctx.fillRect(x - 16, y - 32, 32, 7);
        ctx.strokeStyle = '#5a6a90'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + 2, y - 34); ctx.lineTo(x + 20, y - 52); ctx.stroke();
        ctx.fillStyle = '#ffe08a';
        ctx.beginPath(); ctx.arc(x + 22, y - 54, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(180,210,255,.7)';
        ctx.fillRect(x - 5, y - 16, 10, 12);
        break;
      }
      case 'castle': {
        const flick = 0.6 + Math.sin(this.t * 3.1) * 0.14;
        this.shadow(ctx, x, y + 46, 86, 20, 0.34);
        ctx.fillStyle = '#170d22';
        ctx.fillRect(x - 58, y - 24, 116, 70);
        ctx.fillStyle = '#20112e';
        for (const bx of [-58, -18, 18, 42]) ctx.fillRect(x + bx, y - 62, 22, 108);
        ctx.fillStyle = '#3a1a3f';
        for (const bx of [-58, -18, 18, 42]) {
          ctx.beginPath();
          ctx.moveTo(x + bx - 5, y - 62); ctx.lineTo(x + bx + 11, y - 92); ctx.lineTo(x + bx + 27, y - 62);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = `rgba(255,70,110,${flick})`;
        for (const w of [[-50, -44], [-10, -44], [26, -44], [50, -44], [-30, -4], [10, -4], [34, -4]]) {
          ctx.fillRect(x + w[0], y + w[1], 8, 12);
        }
        ctx.fillStyle = '#0d0612';
        ctx.beginPath();
        ctx.moveTo(x - 14, y + 46); ctx.lineTo(x - 14, y + 8);
        ctx.arc(x, y + 8, 14, Math.PI, 0); ctx.lineTo(x + 14, y + 46); ctx.closePath(); ctx.fill();
        this.glow(ctx, x, y - 10, 150, 'rgba(180,40,120,ALPHA)', 0.3);
        break;
      }
    }
    ctx.restore();

    /* 名ふだ */
    const near = G.scene === 'sky' && dist(G.god.x, G.god.y, s.x, s.y) < s.r + 90;
    if (near) {
      ctx.font = 'bold 13px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
      ctx.textAlign = 'center';
      const label = `${s.icon} ${s.name}`;
      const w = ctx.measureText(label).width + 18;
      ctx.fillStyle = 'rgba(14,16,36,.72)';
      ctx.beginPath(); ctx.roundRect(x - w / 2, y - 96, w, 24, 9); ctx.fill();
      ctx.fillStyle = '#ffe08a';
      ctx.fillText(label, x, y - 79);
      ctx.textAlign = 'left';
    }
  },
});

/* ========================================================================
   地上のけしき
   ======================================================================== */
Object.assign(R, {
  drawGround(G) {
    const ctx = this.ctx, W = this.W, H = this.H, cam = this.cam;
    const sc = this.skyColors(G.tod);

    ctx.fillStyle = '#0e1a2a';
    ctx.fillRect(0, 0, W, H);

    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(World.w - 1, Math.ceil((cam.x + W) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(World.h - 1, Math.ceil((cam.y + H) / TILE));

    /* --- 地面 --- */
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = World.get(tx, ty);
        const def = TILE_DEF[t];
        const px = tx * TILE - cam.x, py = ty * TILE - cam.y;
        const v = hash2(tx, ty, 5);
        const patch = hash2(tx >> 1, ty >> 1, 6);
        ctx.fillStyle = patch > 0.7 ? shade(def.c1, 4) : (patch < 0.3 ? shade(def.c1, -3) : def.c1);
        ctx.fillRect(px, py, TILE + 1, TILE + 1);

        switch (t) {
          case T.SEA: case T.SHALLOW: {
            const w = Math.sin(this.t * 1.4 + tx * 0.7 + ty * 0.5);
            ctx.fillStyle = def.c2;
            ctx.globalAlpha = 0.25 + w * 0.14;
            ctx.fillRect(px + 4, py + 8 + w * 3, TILE - 10, 3);
            ctx.globalAlpha = 1;
            break;
          }
          case T.PLAIN: case T.GRASS: case T.FLOWER: case T.MARSH: {
            ctx.strokeStyle = shade(def.c2, -14); ctx.globalAlpha = 0.55; ctx.lineWidth = 1.3;
            for (let i = 0; i < 2; i++) {
              const gx = px + hash2(tx, ty, i * 3 + 1) * TILE;
              const gy = py + hash2(tx, ty, i * 3 + 2) * TILE;
              ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 1.4, gy - 4.2); ctx.stroke();
            }
            ctx.globalAlpha = 1;
            if (t === T.FLOWER && v > 0.62) {
              const fx = px + hash2(tx, ty, 20) * TILE, fy = py + hash2(tx, ty, 30) * TILE;
              ctx.fillStyle = ['#f0a8d0', '#ffe08a', '#fff2f8'][(tx + ty) % 3];
              ctx.beginPath(); ctx.arc(fx, fy, 2, 0, TAU); ctx.fill();
              ctx.beginPath(); ctx.arc(fx + 5, fy + 4, 1.5, 0, TAU); ctx.fill();
            }
            if (t === T.MARSH && v > 0.7) {
              ctx.fillStyle = 'rgba(120,190,220,.45)';
              ctx.beginPath(); ctx.ellipse(px + TILE / 2, py + TILE / 2, 9, 5, 0, 0, TAU); ctx.fill();
            }
            break;
          }
          case T.SAND: case T.DESERT: {
            ctx.fillStyle = def.c2; ctx.globalAlpha = 0.5;
            for (let i = 0; i < 4; i++) {
              ctx.fillRect(px + hash2(tx, ty, i + 40) * TILE, py + hash2(tx, ty, i + 50) * TILE, 2, 2);
            }
            ctx.globalAlpha = 1;
            break;
          }
          case T.HILL: {
            ctx.strokeStyle = shade(def.c2, 8); ctx.lineWidth = 1.3; ctx.globalAlpha = 0.45;
            const hr = 8 + hash2(tx, ty, 17) * 8;
            ctx.beginPath();
            ctx.arc(px + 6 + hash2(tx, ty, 18) * 20, py + TILE * (0.5 + hash2(tx, ty, 19) * 0.4), hr, Math.PI * 1.1, Math.PI * 1.9);
            ctx.stroke();
            ctx.globalAlpha = 1;
            break;
          }
          case T.ROCK: {
            ctx.fillStyle = shade(def.c2, hash2(tx, ty, 9) > 0.5 ? 8 : -10);
            ctx.beginPath();
            const rx = px + 6 + hash2(tx, ty, 11) * 8, ry = py + 8 + hash2(tx, ty, 12) * 8;
            ctx.moveTo(rx, ry + 10); ctx.lineTo(rx + 5, ry - 4); ctx.lineTo(rx + 14, ry + 2);
            ctx.lineTo(rx + 17, ry + 11); ctx.closePath(); ctx.fill();
            break;
          }
          case T.SNOW: {
            if (v > 0.7) { ctx.fillStyle = '#ffffff'; ctx.fillRect(px + 8, py + 10, 3, 3); }
            break;
          }
          case T.FIELD: {
            ctx.strokeStyle = shade(def.c2, 10); ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
              ctx.beginPath(); ctx.moveTo(px + 3, py + 6 + i * 9); ctx.lineTo(px + TILE - 3, py + 6 + i * 9); ctx.stroke();
            }
            ctx.fillStyle = '#8ac06a';
            for (let i = 0; i < 4; i++) {
              ctx.beginPath();
              ctx.arc(px + 6 + i * 7, py + 8 + (i % 3) * 9, 2.2, 0, TAU); ctx.fill();
            }
            break;
          }
        }
      }
    }

    /* --- 木 --- */
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = World.get(tx, ty);
        if (t !== T.FOREST && !(t === T.MARSH && hash2(tx, ty, 61) > 0.75)) continue;
        const n = t === T.FOREST ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const bx = tx * TILE + 6 + hash2(tx, ty, i + 70) * (TILE - 12) - cam.x;
          const by = ty * TILE + 8 + hash2(tx, ty, i + 80) * (TILE - 10) - cam.y;
          this.drawTree(ctx, bx, by, 0.8 + hash2(tx, ty, i + 90) * 0.5, t === T.MARSH);
        }
      }
    }

    /* --- 街 --- */
    const lights = [];
    for (const tw of G.towns) {
      const cx = tw.tx * TILE + TILE / 2, cy = tw.ty * TILE + TILE / 2;
      if (cx - cam.x < -400 || cx - cam.x > W + 400 || cy - cam.y < -400 || cy - cam.y > H + 400) continue;
      this.drawTown(ctx, G, tw, cx - cam.x, cy - cam.y, lights);
    }

    /* 降りたところの柱 */
    if (G.landing) this.drawPillar(ctx, G.landing.x - cam.x, G.landing.y - cam.y);

    /* --- いきもの・モコ・神さま --- */
    const ents = G.agents.slice();
    ents.push({ kind: 'god', x: G.god.gx, y: G.god.gy });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      const sx = e.x - cam.x, sy = e.y - cam.y;
      if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) continue;
      if (e.kind === 'god') this.drawGod(ctx, sx, sy, G.god, 1.35);
      else if (e.kind === 'moko') {
        this.drawMoko(ctx, sx, sy, {
          s: e.child ? 0.72 : 1, c1: e.c1, c2: e.c2, face: e.face, wob: e.wob,
          sleep: e.sleep, blush: e.child,
        });
        if (e.name && dist(e.x, e.y, G.god.gx, G.god.gy) < 130) {
          ctx.font = 'bold 11px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.55)';
          ctx.strokeText(e.name, sx, sy - 24); ctx.fillStyle = '#ffe6f2';
          ctx.fillText(e.name, sx, sy - 24);
          ctx.textAlign = 'left';
        }
      } else if (e.kind === 'beast') {
        this.drawCreature(ctx, sx, sy, e.sp, e.wob, e.face, e.sp === 'gulpa' ? 1.15 : 1);
      }
    }

    FX.draw(ctx, cam);

    /* --- 夜 --- */
    const night = clamp(1 - sc.day * 1.6, 0, 0.72);
    if (night > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(70,90,170,${night})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lights) this.glow(ctx, l.x, l.y, l.r, l.c, night * 0.4);
      this.glow(ctx, G.god.gx - cam.x, G.god.gy - cam.y, 150, 'rgba(255,240,200,ALPHA)', night * 0.42);
      ctx.restore();
    }
  },

  drawTree(ctx, x, y, s, marsh) {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(x, y + 2 * s, 9 * s, 3.4 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3f28';
    ctx.fillRect(x - 1.6 * s, y - 9 * s, 3.2 * s, 11 * s);
    const c = marsh ? '#4a7f5f' : '#2f6b3c';
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y - 14 * s, 9 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(c, 22);
    ctx.beginPath(); ctx.arc(x - 3 * s, y - 17 * s, 6 * s, 0, TAU); ctx.fill();
  },

  /* ---------------------------- 街をかく ---------------------------- */
  drawTown(ctx, G, tw, x, y, lights) {
    const era = ERAS[tw.era];
    /* 畑（実りの時代から） */
    if (tw.era >= 2) {
      ctx.fillStyle = 'rgba(138,111,58,.75)';
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6 + tw.id, r = 70 + (i % 2) * 22;
        const fx = x + Math.cos(a) * r, fy = y + Math.sin(a) * r * 0.75;
        ctx.fillRect(fx - 22, fy - 13, 44, 26);
        ctx.strokeStyle = 'rgba(168,137,74,.9)'; ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath(); ctx.moveTo(fx - 20, fy - 8 + k * 8); ctx.lineTo(fx + 20, fy - 8 + k * 8); ctx.stroke();
        }
      }
    }

    /* 家 */
    for (const h of tw.houses) {
      this.drawHouse(ctx, x + h.dx, y + h.dy, tw, h, lights);
    }

    /* 社（石の時代から）― あなたのための建物 */
    if (tw.era >= 3) {
      const sx = x, sy = y - 8;
      ctx.fillStyle = '#e8e2d0';
      ctx.fillRect(sx - 16, sy - 4, 32, 20);
      ctx.fillStyle = '#c8bfa8';
      ctx.beginPath(); ctx.moveTo(sx - 22, sy - 4); ctx.lineTo(sx, sy - 22); ctx.lineTo(sx + 22, sy - 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(sx, sy - 30, 9, 3.2, 0, 0, TAU); ctx.stroke();
      lights.push({ x: sx, y: sy - 10, r: 62, c: 'rgba(255,228,160,ALPHA)' });
    }

    /* 火（火の時代から） */
    if (tw.era >= 1 && tw.era < 4) {
      const fx = x - 4, fy = y + 26;
      const fl = 6 + Math.sin(this.t * 8 + tw.id) * 2.4;
      ctx.fillStyle = '#5a3f28';
      ctx.fillRect(fx - 9, fy + 2, 18, 4);
      ctx.fillStyle = '#ff9a3a';
      ctx.beginPath(); ctx.moveTo(fx - 6, fy + 2); ctx.lineTo(fx, fy - fl); ctx.lineTo(fx + 6, fy + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath(); ctx.moveTo(fx - 3, fy + 2); ctx.lineTo(fx, fy - fl * 0.6); ctx.lineTo(fx + 3, fy + 2); ctx.closePath(); ctx.fill();
      lights.push({ x: fx, y: fy, r: 84, c: 'rgba(255,170,90,ALPHA)' });
    }

    /* 昇りの柱 ― ここから雲へもどれる */
    this.drawPillar(ctx, x + 62, y - 34);

    /* 街の名まえ */
    ctx.font = 'bold 13px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
    ctx.textAlign = 'center';
    const label = `${tw.name} ・ ${era.short}の時代 ・ ${Math.round(tw.pop)}人`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.strokeText(label, x, y - 88);
    ctx.fillStyle = '#f2f6ff'; ctx.fillText(label, x, y - 88);
    ctx.textAlign = 'left';
  },

  drawHouse(ctx, x, y, tw, h, lights) {
    const s = h.size, era = tw.era;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(h.rot); ctx.scale(s, s);
    this.shadow(ctx, 0, 10, 17, 5.5, 0.2);
    switch (ERAS[era].house) {
      case 'nest':
        ctx.fillStyle = '#7f8f4a';
        ctx.beginPath(); ctx.ellipse(0, 2, 17, 12, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#5f6f36';
        ctx.beginPath(); ctx.ellipse(0, 2, 17, 12, 0, Math.PI, 0); ctx.clip();
        for (let i = -3; i <= 3; i++) { ctx.fillRect(i * 5 - 1, -12, 1.6, 24); }
        break;
      case 'hut':
        ctx.fillStyle = '#a8853f';
        ctx.beginPath(); ctx.moveTo(-17, 10); ctx.lineTo(0, -18); ctx.lineTo(17, 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7f6330';
        ctx.beginPath(); ctx.moveTo(-17, 10); ctx.lineTo(-6, 10); ctx.lineTo(0, -18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a2a18';
        ctx.fillRect(-4, 2, 8, 8);
        break;
      case 'farm':
        ctx.fillStyle = '#c8a56a';
        ctx.fillRect(-15, -4, 30, 15);
        ctx.fillStyle = '#8a5f3a';
        ctx.beginPath(); ctx.moveTo(-19, -4); ctx.lineTo(0, -19); ctx.lineTo(19, -4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffdc8a'; ctx.fillRect(-11, 0, 7, 7);
        ctx.fillStyle = '#5a3f28'; ctx.fillRect(3, 1, 8, 10);
        lights.push({ x, y, r: 42, c: 'rgba(255,210,130,ALPHA)' });
        break;
      case 'stone':
        ctx.fillStyle = '#d6d2c4';
        ctx.fillRect(-16, -8, 32, 19);
        ctx.strokeStyle = 'rgba(120,116,104,.55)'; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-16, -3 + i * 6); ctx.lineTo(16, -3 + i * 6); ctx.stroke(); }
        ctx.fillStyle = '#a05a4a';
        ctx.beginPath(); ctx.moveTo(-20, -8); ctx.lineTo(0, -22); ctx.lineTo(20, -8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffdc8a'; ctx.fillRect(-10, -3, 7, 7); ctx.fillRect(4, -3, 7, 7);
        lights.push({ x, y, r: 46, c: 'rgba(255,210,130,ALPHA)' });
        break;
      case 'gear':
        ctx.fillStyle = '#9a5f4a';
        ctx.fillRect(-17, -12, 34, 23);
        ctx.fillStyle = '#6a4034'; ctx.fillRect(-17, -14, 34, 4);
        ctx.fillStyle = '#7a7a86'; ctx.fillRect(9, -30, 8, 18);
        ctx.fillStyle = 'rgba(210,210,220,.5)';
        for (let i = 0; i < 3; i++) {
          const p = (this.t * 22 + i * 14) % 42;
          ctx.beginPath(); ctx.arc(13 + Math.sin(this.t + i) * 4, -32 - p, 4 + p * 0.12, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#ffd06a'; ctx.fillRect(-12, -6, 8, 8); ctx.fillRect(1, -6, 8, 8);
        lights.push({ x, y, r: 50, c: 'rgba(255,190,110,ALPHA)' });
        break;
      case 'spire':
        ctx.fillStyle = '#e8eefc';
        ctx.beginPath(); ctx.moveTo(-11, 11); ctx.lineTo(-8, -30); ctx.lineTo(8, -30); ctx.lineTo(11, 11); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9fc8e8';
        ctx.beginPath(); ctx.moveTo(-8, -30); ctx.lineTo(0, -44); ctx.lineTo(8, -30); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8ae6ff';
        for (let i = 0; i < 4; i++) ctx.fillRect(-5, -25 + i * 8, 10, 4);
        ctx.fillStyle = '#ffe08a';
        ctx.beginPath(); ctx.arc(0, -47, 3 + Math.sin(this.t * 3) * 0.8, 0, TAU); ctx.fill();
        lights.push({ x, y: y - 20, r: 58, c: 'rgba(150,220,255,ALPHA)' });
        break;
    }
    ctx.restore();
  },

  drawPillar(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#e8e2d0';
    ctx.fillRect(x - 9, y + 6, 18, 16);
    ctx.fillStyle = '#cfc7b0';
    ctx.fillRect(x - 12, y + 20, 24, 5);
    const g = ctx.createLinearGradient(0, y - 260, 0, y + 12);
    g.addColorStop(0, 'rgba(255,236,170,0)');
    g.addColorStop(1, `rgba(255,236,170,${0.4 + Math.sin(this.t * 2) * 0.08})`);
    ctx.fillStyle = g;
    ctx.fillRect(x - 9, y - 260, 18, 272);
    for (let i = 0; i < 4; i++) {
      const p = ((this.t * 46 + i * 45) % 180);
      ctx.fillStyle = `rgba(255,248,214,${0.55 - p / 360})`;
      ctx.beginPath(); ctx.arc(x + Math.sin(this.t * 1.4 + i * 2) * 6, y + 6 - p, 2.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  },
});

/* ========================================================================
   城のなか / 世界地図
   ======================================================================== */
const ERA_COLORS = ['#8a9f6a', '#e0955f', '#e0c05f', '#cfd8ee', '#9a8ac0', '#8ae6ff'];

Object.assign(R, {
  drawCastle(G) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const C = G.castle;
    const ox = W / 2, oy = H / 2;

    const g = ctx.createRadialGradient(ox, oy, 40, ox, oy, Math.max(W, H) * 0.75);
    g.addColorStop(0, '#3a1a44'); g.addColorStop(0.55, '#1a0c26'); g.addColorStop(1, '#08040e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    /* 広間の床 */
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = '#2a1636';
    ctx.beginPath(); ctx.ellipse(0, 0, CASTLE.R, CASTLE.R * 0.78, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,80,160,.5)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(0, 0, CASTLE.R - 12, CASTLE.R * 0.78 - 10, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,90,140,.28)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, (CASTLE.R - 60) * (1 - i * 0.28), (CASTLE.R * 0.78 - 50) * (1 - i * 0.28), this.t * (0.2 + i * 0.1), 0, TAU);
      ctx.stroke();
    }
    /* 柱 */
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.4;
      const px = Math.cos(a) * (CASTLE.R + 26), py = Math.sin(a) * (CASTLE.R * 0.78 + 16);
      ctx.fillStyle = '#1a0e26';
      ctx.fillRect(px - 14, py - 96, 28, 110);
      ctx.fillStyle = '#3a1f4a';
      ctx.fillRect(px - 18, py - 104, 36, 12);
      ctx.fillStyle = `rgba(255,70,110,${0.35 + Math.sin(this.t * 2 + i) * 0.15})`;
      ctx.fillRect(px - 5, py - 76, 10, 16);
    }
    ctx.restore();

    /* 影のたま */
    for (const o of C.orbs) {
      const x = ox + o.x, y = oy + o.y;
      this.glow(ctx, x, y, o.r * 3.4, 'rgba(180,40,140,ALPHA)', 0.5);
      ctx.fillStyle = '#2a0a2a';
      ctx.beginPath(); ctx.arc(x, y, o.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff4a8a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, o.r, 0, TAU); ctx.stroke();
    }

    /* 光のたま（神さまの攻撃） */
    for (const s of C.shots) {
      const x = ox + s.x, y = oy + s.y;
      this.glow(ctx, x, y, 30, 'rgba(255,236,170,ALPHA)', 0.8);
      ctx.fillStyle = '#fff8d8';
      ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
    }

    /* 悪魔 */
    if (G.demon.alive) {
      const dx = ox + C.dx, dy = oy + C.dy + Math.sin(this.t * 1.6) * 8;
      this.glow(ctx, dx, dy, 120, 'rgba(160,30,120,ALPHA)', 0.55);
      ctx.save();
      ctx.globalAlpha = C.hurt > 0 ? 0.6 : 1;
      this.drawMoko(ctx, dx, dy, { s: 2.4, c1: '#3a2050', c2: '#1e1030', demon: true, wob: this.t * 2, face: C.face });
      ctx.restore();
    }

    FX.draw(ctx, { x: -ox, y: -oy });
    this.drawGod(ctx, ox + G.god.cx, oy + G.god.cy, G.god, 1.2);

    /* まわりの闇 */
    const vg = ctx.createRadialGradient(ox, oy, Math.min(W, H) * 0.32, ox, oy, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.75)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  },

  /* ---------------------------- 世界地図 ---------------------------- */
  drawWorldMap(ctx, w, h, G, ui) {
    if (this.thumbDirty) this.buildThumb();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.thumb, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    const sx = w / World.w, sy = h / World.h;

    /* 影のひろがり */
    if (G.demon.alive && G.demon.power > 40) {
      ctx.globalAlpha = clamp((G.demon.power - 40) / 260, 0, 0.3);
      ctx.fillStyle = '#3a0a3a'; ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    /* いきもの */
    for (const hd of G.herds) {
      const d = SPECIES[hd.sp];
      const x = (hd.tx + 0.5) * sx, y = (hd.ty + 0.5) * sy;
      ctx.fillStyle = d.evil ? '#c04ae0' : d.c1;
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 3 + Math.min(hd.n, 20) * 0.12, 0, TAU); ctx.fill(); ctx.stroke();
    }

    /* 街 */
    ctx.font = 'bold 11px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const t of G.towns) {
      const x = (t.tx + 0.5) * sx, y = (t.ty + 0.5) * sy;
      const r = 4 + Math.min(Math.sqrt(t.pop) * 0.9, 10);
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath(); ctx.arc(x, y + 1, r + 2, 0, TAU); ctx.fill();
      ctx.fillStyle = ERA_COLORS[t.era];
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      if (t.event) {
        ctx.fillStyle = '#ff6a8a';
        ctx.beginPath(); ctx.arc(x + r, y - r, 3.2, 0, TAU); ctx.fill();
      }
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(t.name, x, y - r - 5);
      ctx.fillStyle = '#fff'; ctx.fillText(t.name, x, y - r - 5);
    }
    ctx.textAlign = 'left';

    /* 地上にいるときは神さまの居場所 */
    if (G.scene === 'ground') {
      const x = (G.god.gx / TILE) * sx, y = (G.god.gy / TILE) * sy;
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, 8 + Math.sin(this.t * 3) * 2, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, TAU); ctx.fill();
    }

    /* えらんだ場所 */
    if (ui && ui.cur) {
      const m = MIRACLES.find((k) => k.id === ui.miracle);
      const x = (ui.cur.tx + 0.5) * sx, y = (ui.cur.ty + 0.5) * sy;
      const rr = Math.max(6, (m ? m.r : 1) * sx);
      ctx.strokeStyle = 'rgba(255,224,138,.95)'; ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(160,190,255,.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  },
});
