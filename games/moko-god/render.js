/* =========================================================================
   MOKO GOD ― 絵をかく
   カメラ / モコ / 魔物 / 地面 / 村 / 城 / 小さな地図
   ========================================================================= */
'use strict';

const R = {
  ctx: null, W: 0, H: 0, dpr: 1, t: 0,
  cam: { x: 0, y: 0 },
  lights: [],

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
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

  follow(x, y, snap = false) {
    const tx = clamp(x - this.W / 2, 0, Math.max(0, World.pxW() - this.W));
    const ty = clamp(y - this.H / 2, 0, Math.max(0, World.pxH() - this.H));
    if (snap) { this.cam.x = tx; this.cam.y = ty; return; }
    this.cam.x += (tx - this.cam.x) * 0.16;
    this.cam.y += (ty - this.cam.y) * 0.16;
  },

  shadow(ctx, x, y, w, h, a = 0.20) {
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
     CASTAWAY PLANET の「モコ」とおなじ描きかた。               */
  drawMoko(ctx, x, y, o = {}) {
    const s = o.s || 1;
    const wob = o.wob || 0;
    const bob = Math.sin(wob) * 2 * s;
    const c1 = o.c1 || '#ffc2dc', c2 = o.c2 || '#ff8ab4';
    const eye = o.eye || '#4a2f3a';

    this.shadow(ctx, x, y + 11 * s, 11 * s, 4 * s);
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale((o.face || 1) * s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.ellipse(0, -2, 11, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = eye;
    ctx.beginPath(); ctx.arc(-4, -3, 2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -3, 2, 0, TAU); ctx.fill();
    ctx.fillStyle = c2;
    ctx.fillRect(-7, 9, 5, 4); ctx.fillRect(3, 9, 5, 4);

    ctx.restore();
  },

  /* ============================== 勇者 ==============================
     モコの体はそのまま。剣と、ふりかぶった軌跡だけを重ねる。       */
  drawHero(ctx, x, y, P) {
    /* 体は CASTAWAY PLANET のモコとまったく同じ。剣だけを重ねる。 */
    const s = 1;
    if (P.roll > 0) {
      /* ころがっているあいだは、白い残り光を落とす */
      this.glow(ctx, x, y, 34, 'rgba(180,220,255,ALPHA)', 0.35);
    }
    if (P.ward > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(159,216,255,${0.35 + Math.sin(this.t * 6) * 0.15})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(x, y - 2, 24, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    const hurt = P.iframe > 0 && Math.floor(this.t * 22) % 2 === 0;
    this.drawMoko(ctx, x, y, { s, face: P.face, wob: P.wob, alpha: hurt ? 0.45 : undefined });

    /* 剣。ふっているときは弧をえがく。 */
    const w = WEAPONS[P.weapon];
    const swing = P.swing > 0 ? 1 - P.swing / P.swingMax : -1;
    ctx.save();
    ctx.translate(x, y + Math.sin(P.wob) * 2 * s);
    if (swing >= 0) {
      const a = P.aim - w.arc / 2 + w.arc * swing;
      ctx.rotate(a);
      ctx.fillStyle = '#e8eef8';
      ctx.fillRect(10, -2, w.range * 0.62, 4);
      ctx.fillStyle = '#c8a05a';
      ctx.fillRect(6, -3.5, 5, 7);
    } else {
      ctx.rotate(P.aim + 0.5);
      ctx.fillStyle = '#c8d2e0';
      ctx.fillRect(9, -1.6, 15, 3.2);
      ctx.fillStyle = '#a8834a';
      ctx.fillRect(6, -3, 4, 6);
    }
    ctx.restore();
  },

  /* ふりぬいた軌跡 */
  drawSwingArc(ctx, x, y, P) {
    if (P.swing <= 0) return;
    const w = WEAPONS[P.weapon];
    const k = 1 - P.swing / P.swingMax;
    const a0 = P.aim - w.arc / 2, a1 = a0 + w.arc * k;
    ctx.save();
    ctx.globalAlpha = 0.35 * (1 - k * 0.5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y - 2, w.range * 0.78, a0, a1); ctx.stroke();
    ctx.restore();
  },

  /* ============================== 魔物 ============================== */
  drawMob(ctx, x, y, m) {
    const d = m.def;
    const s = m.scale || 1;
    const wob = m.wob;
    const flash = m.hurt > 0;
    if (d.glow) this.glow(ctx, x, y, 46 * s, `rgba(255,179,71,ALPHA)`, 0.4);

    this.shadow(ctx, x, y + 12 * s, 12 * s, 4.4 * s, d.fly ? 0.12 : 0.2);
    ctx.save();
    ctx.translate(x, y + Math.sin(wob) * (d.fly ? 4 : 2) * s);
    ctx.scale(m.face * s, s);
    if (flash) { ctx.globalAlpha = 0.85; }
    const c1 = flash ? '#ffffff' : d.c1;
    const c2 = flash ? '#ffd8d8' : d.c2;

    switch (d.form) {
      case 'shade': {
        ctx.fillStyle = c1;
        ctx.beginPath();
        for (let i = 0; i <= 14; i++) {
          const a = (i / 14) * TAU;
          const rr = 12 + Math.sin(a * 3 + wob * 2.2) * 2.4;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.86;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.ellipse(0, -2, 9, 7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.eye || '#ff5a7a';
        ctx.beginPath(); ctx.arc(-4, -3, 2, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(4, -3, 2, 0, TAU); ctx.fill();
        break;
      }
      case 'bug': {
        ctx.strokeStyle = c1; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        for (let k = -1; k <= 1; k++) {
          const p = Math.sin(wob * 2.4 + k) * 3;
          ctx.beginPath(); ctx.moveTo(k * 5, 2); ctx.lineTo(k * 5 - 9, 10 + p); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(k * 5, 2); ctx.lineTo(k * 5 + 9, 10 - p); ctx.stroke();
        }
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.ellipse(-3, 0, 12, 8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.ellipse(8, -2, 7, 6, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = c2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(12, -4); ctx.lineTo(19, -10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(12, 1); ctx.lineTo(19, 5); ctx.stroke();
        ctx.fillStyle = '#ff5a4a';
        ctx.beginPath(); ctx.arc(10, -3, 1.8, 0, TAU); ctx.fill();
        break;
      }
      case 'mush': {
        ctx.fillStyle = c2;
        ctx.fillRect(-4, -2, 8, 13);
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.ellipse(0, -4, 15, 10, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.beginPath(); ctx.arc(-7, -7, 2.4, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(3, -10, 2.8, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(9, -6, 2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a2a2a';
        ctx.beginPath(); ctx.arc(-3, 3, 1.6, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(3, 3, 1.6, 0, TAU); ctx.fill();
        break;
      }
      case 'wolf': {
        ctx.strokeStyle = c1; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
          const p = Math.sin(wob * 2.6 + k * 1.6) * 3.4;
          ctx.beginPath(); ctx.moveTo(-9 + k * 6, 4); ctx.lineTo(-10 + k * 6 + p, 13); ctx.stroke();
        }
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.ellipse(-2, 0, 15, 8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.ellipse(11, -4, 8, 7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.moveTo(6, -9); ctx.lineTo(5, -16); ctx.lineTo(11, -10); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(14, -9); ctx.lineTo(17, -16); ctx.lineTo(18, -8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(22, 3); ctx.lineTo(16, 3.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffdc4a';
        ctx.beginPath(); ctx.arc(13, -5, 2, 0, TAU); ctx.fill();
        break;
      }
      case 'scorp': {
        ctx.strokeStyle = c1; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        for (let k = -1; k <= 1; k++) {
          const p = Math.sin(wob * 2 + k) * 3;
          ctx.beginPath(); ctx.moveTo(k * 5, 3); ctx.lineTo(k * 5 - 11, 11 + p); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(k * 5, 3); ctx.lineTo(k * 5 + 11, 11 - p); ctx.stroke();
        }
        /* しっぽ */
        ctx.strokeStyle = c2; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.quadraticCurveTo(-22, -12 + Math.sin(wob * 2) * 3, -14, -22);
        ctx.stroke();
        ctx.fillStyle = '#ff6a4a';
        ctx.beginPath(); ctx.moveTo(-14, -22); ctx.lineTo(-8, -26); ctx.lineTo(-13, -28); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.ellipse(0, 0, 14, 9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.ellipse(11, -1, 7, 6, 0, 0, TAU); ctx.fill();
        /* はさみ */
        ctx.strokeStyle = c2; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(18, -6, 5, 0.6, 5.4); ctx.stroke();
        ctx.beginPath(); ctx.arc(18, 6, 5, 1.0, 5.8); ctx.stroke();
        ctx.fillStyle = '#2a1a0a';
        ctx.beginPath(); ctx.arc(13, -2, 1.6, 0, TAU); ctx.fill();
        break;
      }
      case 'wisp': {
        const f = Math.sin(wob * 3);
        ctx.fillStyle = c1;
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) {
          const a = (i / 12) * TAU;
          const rr = 11 + Math.sin(a * 4 + wob * 4) * 3;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr - 2;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.arc(0, -2, 6 + f, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a1408';
        ctx.beginPath(); ctx.arc(-3, -3, 1.5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(3, -3, 1.5, 0, TAU); ctx.fill();
        break;
      }
      case 'golem': {
        ctx.fillStyle = c1;
        ctx.fillRect(-13, -6, 26, 20);
        ctx.fillStyle = c2;
        ctx.fillRect(-9, -18, 18, 14);
        ctx.fillStyle = c1;
        const arm = Math.sin(wob * 1.6) * 3;
        ctx.fillRect(-21, -4 + arm, 8, 16);
        ctx.fillRect(13, -4 - arm, 8, 16);
        ctx.fillStyle = '#ff8a4a';
        ctx.fillRect(-6, -13, 4, 4);
        ctx.fillRect(2, -13, 4, 4);
        ctx.fillStyle = 'rgba(0,0,0,.2)';
        ctx.fillRect(-13, 8, 26, 3);
        break;
      }
      case 'beast': {
        ctx.strokeStyle = c1; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
          const p = Math.sin(wob * 2.4 + k * 1.5) * 3;
          ctx.beginPath(); ctx.moveTo(-10 + k * 7, 5); ctx.lineTo(-11 + k * 7 + p, 14); ctx.stroke();
        }
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.ellipse(-2, 0, 16, 9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.ellipse(12, -4, 9, 8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(18, 1); ctx.lineTo(23, 5); ctx.lineTo(16, 5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(13, 2); ctx.lineTo(16, 7); ctx.lineTo(11, 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5ad8ff';
        ctx.beginPath(); ctx.arc(14, -6, 2.2, 0, TAU); ctx.fill();
        break;
      }
      case 'knight': {
        ctx.strokeStyle = c2; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
        const st = Math.sin(wob * 2) * 3;
        ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(-6, 16 + st); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4, 6); ctx.lineTo(6, 16 - st); ctx.stroke();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.moveTo(-10, 8); ctx.lineTo(-7, -10); ctx.lineTo(7, -10); ctx.lineTo(10, 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.ellipse(0, -15, 7.5, 7, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1a1020';
        ctx.beginPath(); ctx.ellipse(-3, -16, 2, 2.6, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(3, -16, 2, 2.6, 0, 0, TAU); ctx.fill();
        /* 大剣 */
        ctx.save(); ctx.rotate(-0.5 + Math.sin(wob * 1.4) * 0.2);
        ctx.fillStyle = '#b8c0cc'; ctx.fillRect(10, -30, 4.5, 30);
        ctx.fillStyle = '#6a5a3a'; ctx.fillRect(8, -2, 9, 4);
        ctx.restore();
        break;
      }
      case 'mage': {
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.moveTo(-12, 14); ctx.lineTo(-6, -12); ctx.lineTo(6, -12); ctx.lineTo(12, 14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.moveTo(-9, -10); ctx.lineTo(0, -26); ctx.lineTo(9, -10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0a0616';
        ctx.beginPath(); ctx.ellipse(0, -12, 6.5, 5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe08a';
        ctx.beginPath(); ctx.arc(-2.6, -12, 1.5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(2.6, -12, 1.5, 0, TAU); ctx.fill();
        /* 杖 */
        ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(13, 12); ctx.lineTo(15, -18); ctx.stroke();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.arc(15, -21, 4 + Math.sin(wob * 4) * 0.8, 0, TAU); ctx.fill();
        break;
      }
      case 'demon': {
        /* 黒いモコ。角と、赤い目。 */
        ctx.fillStyle = c2 || '#3a1030';
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 12, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = c1 || '#1a0a18';
        ctx.beginPath(); ctx.ellipse(0, -2, 11, 9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff4a6a';
        ctx.beginPath(); ctx.ellipse(-4, -3, 2.6, 2.2, 0.2, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(4, -3, 2.6, 2.2, -0.2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#160816';
        ctx.beginPath(); ctx.moveTo(-11, -8); ctx.lineTo(-16, -19); ctx.lineTo(-6.5, -11); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(11, -8); ctx.lineTo(16, -19); ctx.lineTo(6.5, -11); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c2 || '#3a1030';
        ctx.fillRect(-7, 9, 5, 4); ctx.fillRect(3, 9, 5, 4);
        break;
      }
    }
    ctx.restore();

    /* HPバー */
    if (m.hp < m.maxhp && !m.boss) {
      const w2 = 30;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - w2 / 2, y - 26 * s, w2, 4);
      ctx.fillStyle = '#ff6a5a'; ctx.fillRect(x - w2 / 2, y - 26 * s, w2 * (m.hp / m.maxhp), 4);
    }
  },

  /* ============================ 村びと ============================ */
  drawNpc(ctx, x, y, n, near) {
    this.drawMoko(ctx, x, y, { s: n.child ? 0.8 : 1, c1: n.c1, c2: n.c2, face: n.face, wob: n.wob });
    ctx.font = 'bold 11px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(0,0,0,.6)';
    const label = (n.icon ? n.icon + ' ' : '') + n.name;
    ctx.strokeText(label, x, y - 22); ctx.fillStyle = '#ffe6f2'; ctx.fillText(label, x, y - 22);
    if (near) {
      ctx.strokeText('💬', x, y - 36); ctx.fillStyle = '#fff'; ctx.fillText('💬', x, y - 36);
    }
    ctx.textAlign = 'left';
  },
};

/* ========================================================================
   けしき
   ======================================================================== */
Object.assign(R, {
  /* 空の明るさ。0 = 真夜中, 1 = まひる */
  dayLight(tod) {
    return clamp(Math.sin(tod * TAU - Math.PI / 2) * 0.5 + 0.5, 0, 1);
  },

  drawTree(ctx, x, y, s, kind) {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(x, y + 2 * s, 9 * s, 3.4 * s, 0, 0, TAU); ctx.fill();
    if (kind === 'dead') {
      ctx.strokeStyle = '#4a4050'; ctx.lineWidth = 2.6 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 18 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - 11 * s); ctx.lineTo(x - 8 * s, y - 19 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - 14 * s); ctx.lineTo(x + 7 * s, y - 21 * s); ctx.stroke();
      return;
    }
    if (kind === 'cactus') {
      ctx.fillStyle = '#4a8a5a';
      ctx.fillRect(x - 3 * s, y - 20 * s, 6 * s, 21 * s);
      ctx.fillRect(x - 10 * s, y - 15 * s, 5 * s, 3 * s);
      ctx.fillRect(x - 10 * s, y - 15 * s, 3 * s, 9 * s);
      ctx.fillRect(x + 6 * s, y - 18 * s, 5 * s, 3 * s);
      ctx.fillRect(x + 8 * s, y - 18 * s, 3 * s, 8 * s);
      return;
    }
    ctx.fillStyle = '#5a3f28';
    ctx.fillRect(x - 1.6 * s, y - 9 * s, 3.2 * s, 11 * s);
    const c = kind === 'marsh' ? '#4a7f5f' : kind === 'snow' ? '#3a6a52' : '#2f6b3c';
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y - 14 * s, 9 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(c, 22);
    ctx.beginPath(); ctx.arc(x - 3 * s, y - 17 * s, 6 * s, 0, TAU); ctx.fill();
    if (kind === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.arc(x - 2 * s, y - 20 * s, 5 * s, 0, TAU); ctx.fill();
    }
  },

  /* ============================== 地面 ============================== */
  drawWorld(G) {
    const ctx = this.ctx, W = this.W, H = this.H, cam = this.cam;
    this.lights.length = 0;

    ctx.fillStyle = '#0e1a2a';
    ctx.fillRect(0, 0, W, H);

    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(World.w - 1, Math.ceil((cam.x + W) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(World.h - 1, Math.ceil((cam.y + H) / TILE));

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
            if (t === T.FLOWER && v > 0.6) {
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
          case T.ROAD: {
            ctx.fillStyle = shade(def.c2, -6); ctx.globalAlpha = 0.5;
            for (let i = 0; i < 3; i++) {
              ctx.fillRect(px + hash2(tx, ty, i + 60) * (TILE - 4), py + hash2(tx, ty, i + 70) * (TILE - 4), 3, 3);
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
            const rx = px + 6 + hash2(tx, ty, 11) * 8, ry = py + 8 + hash2(tx, ty, 12) * 8;
            ctx.beginPath();
            ctx.moveTo(rx, ry + 10); ctx.lineTo(rx + 5, ry - 4); ctx.lineTo(rx + 14, ry + 2);
            ctx.lineTo(rx + 17, ry + 11); ctx.closePath(); ctx.fill();
            break;
          }
          case T.SNOW: {
            if (v > 0.68) { ctx.fillStyle = '#ffffff'; ctx.fillRect(px + 8, py + 10, 3, 3); }
            break;
          }
          case T.ASH: {
            ctx.fillStyle = 'rgba(20,12,26,.4)'; ctx.globalAlpha = 0.6;
            for (let i = 0; i < 3; i++) {
              ctx.fillRect(px + hash2(tx, ty, i + 80) * TILE, py + hash2(tx, ty, i + 90) * TILE, 3, 2);
            }
            ctx.globalAlpha = 1;
            if (v > 0.86) {
              ctx.fillStyle = 'rgba(168,120,208,.35)';
              ctx.beginPath(); ctx.arc(px + 16, py + 16, 6, 0, TAU); ctx.fill();
            }
            break;
          }
        }
      }
    }

    /* --- 木・サボテン・枯れ木 --- */
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = World.get(tx, ty);
        let kind = null, n = 0;
        if (t === T.FOREST) { kind = 'tree'; n = 2; }
        else if (t === T.MARSH && hash2(tx, ty, 61) > 0.7) { kind = 'marsh'; n = 1; }
        else if (t === T.SNOW && hash2(tx, ty, 62) > 0.86) { kind = 'snow'; n = 1; }
        else if (t === T.DESERT && hash2(tx, ty, 63) > 0.90) { kind = 'cactus'; n = 1; }
        else if (t === T.ASH && hash2(tx, ty, 64) > 0.86) { kind = 'dead'; n = 1; }
        if (!kind) continue;
        for (let i = 0; i < n; i++) {
          const bx = tx * TILE + 6 + hash2(tx, ty, i + 70) * (TILE - 12) - cam.x;
          const by = ty * TILE + 8 + hash2(tx, ty, i + 80) * (TILE - 10) - cam.y;
          this.drawTree(ctx, bx, by, 0.8 + hash2(tx, ty, i + 90) * 0.5, kind);
        }
      }
    }

    /* --- 村 --- */
    for (const v of World.villages) {
      const vx = v.tx * TILE + 16 - cam.x, vy = v.ty * TILE + 16 - cam.y;
      if (vx < -420 || vx > W + 420 || vy < -420 || vy > H + 420) continue;
      this.drawVillage(ctx, v, vx, vy);
    }

    /* --- 主の住みか --- */
    for (const l of World.lairs) {
      const lx = l.tx * TILE + 16 - cam.x, ly = l.ty * TILE + 16 - cam.y;
      if (lx < -400 || lx > W + 400 || ly < -400 || ly > H + 400) continue;
      this.drawLair(ctx, G, l, lx, ly);
    }

    /* --- 城 --- */
    const cs = World.castle;
    const csx = cs.tx * TILE + 16 - cam.x, csy = cs.ty * TILE + 16 - cam.y;
    if (csx > -520 && csx < W + 520 && csy > -520 && csy < H + 520) this.drawCastle(ctx, G, csx, csy);

    /* --- 落ちもの --- */
    for (const d of G.drops) {
      const dx = d.x - cam.x, dy = d.y - cam.y + Math.sin(this.t * 3 + d.x) * 2;
      if (dx < -40 || dx > W + 40 || dy < -40 || dy > H + 40) continue;
      ctx.font = '17px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(d.icon, dx, dy);
      ctx.textAlign = 'left';
    }

    /* --- 生きもの。奥から手前へ --- */
    const ents = [];
    for (const m of G.mobs) ents.push({ y: m.y, kind: 'mob', o: m });
    for (const n of G.npcs) ents.push({ y: n.y, kind: 'npc', o: n });
    ents.push({ y: G.p.y, kind: 'hero', o: G.p });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      const sx = e.o.x - cam.x, sy = e.o.y - cam.y;
      if (sx < -120 || sx > W + 120 || sy < -140 || sy > H + 120) continue;
      if (e.kind === 'mob') this.drawMob(ctx, sx, sy, e.o);
      else if (e.kind === 'npc') this.drawNpc(ctx, sx, sy, e.o, G.nearNpc === e.o);
      else { this.drawSwingArc(ctx, sx, sy, e.o); this.drawHero(ctx, sx, sy, e.o); }
    }

    /* --- 弾 --- */
    for (const b of G.bullets) {
      const bx = b.x - cam.x, by = b.y - cam.y;
      if (bx < -40 || bx > W + 40 || by < -40 || by > H + 40) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.glow(ctx, bx, by, b.r * 3.4, hexToGlow(b.color), 0.55);
      ctx.restore();
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(bx, by, b.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.arc(bx - b.r * 0.25, by - b.r * 0.25, b.r * 0.4, 0, TAU); ctx.fill();
    }

    /* --- 光の輪（サンダー・聖なる爆発） --- */
    for (const n of G.novas) {
      const nx = n.x - cam.x, ny = n.y - cam.y;
      const k = 1 - n.life / n.max;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = n.color; ctx.lineWidth = 6 * (1 - k) + 2;
      ctx.beginPath(); ctx.arc(nx, ny, n.r * k, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    FX.draw(ctx, cam);

    /* --- 夜 --- */
    const day = this.dayLight(G.tod);
    const night = clamp(1 - day * 1.5, 0, 0.66);
    if (night > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(74,92,168,${night})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const l of this.lights) this.glow(ctx, l.x, l.y, l.r, l.c, night * 0.5);
      this.glow(ctx, G.p.x - cam.x, G.p.y - cam.y, 170, 'rgba(255,240,200,ALPHA)', night * 0.34);
      ctx.restore();
    }
  },

  /* ============================== 村 ============================== */
  drawVillage(ctx, v, x, y) {
    const rng = hash2(v.tx, v.ty, 3);
    /* 柵 */
    ctx.strokeStyle = 'rgba(120,92,58,.75)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 132, 0, TAU); ctx.stroke();
    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = 'rgba(160,130,86,.5)';
    ctx.beginPath(); ctx.arc(x, y, 124, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);

    /* 井戸 */
    ctx.fillStyle = '#6a6a74';
    ctx.beginPath(); ctx.ellipse(x, y, 14, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#25303f';
    ctx.beginPath(); ctx.ellipse(x, y - 1, 9, 5.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7a5a3a';
    ctx.fillRect(x - 13, y - 22, 3, 16); ctx.fillRect(x + 10, y - 22, 3, 16);
    ctx.fillStyle = '#a8542a';
    ctx.beginPath(); ctx.moveTo(x - 18, y - 21); ctx.lineTo(x, y - 30); ctx.lineTo(x + 18, y - 21); ctx.closePath(); ctx.fill();

    /* 家 */
    const n = v.main ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rng * 3;
      const r = 66 + ((i * 37 + v.tx) % 26);
      const hx = x + Math.cos(a) * r, hy = y + Math.sin(a) * r * 0.82;
      this.drawHouse(ctx, hx, hy, (i + v.tx) % 3);
      this.lights.push({ x: hx, y: hy - 6, r: 90, c: 'rgba(255,200,120,ALPHA)' });
    }
    /* 名まえ */
    ctx.font = 'bold 13px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.strokeText(v.name, x, y - 146); ctx.fillStyle = '#ffe6c8'; ctx.fillText(v.name, x, y - 146);
    ctx.textAlign = 'left';
  },

  drawHouse(ctx, x, y, kind) {
    this.shadow(ctx, x, y + 12, 20, 6, 0.22);
    const wall = ['#e0cba8', '#d8bfa0', '#cbb392'][kind];
    const roof = ['#a8542a', '#8a5a7a', '#5a7a8a'][kind];
    ctx.fillStyle = wall;
    ctx.fillRect(x - 18, y - 14, 36, 26);
    ctx.fillStyle = roof;
    ctx.beginPath(); ctx.moveTo(x - 23, y - 13); ctx.lineTo(x, y - 32); ctx.lineTo(x + 23, y - 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a3f28';
    ctx.fillRect(x - 5, y - 2, 10, 14);
    ctx.fillStyle = '#ffd98a';
    ctx.fillRect(x - 15, y - 10, 7, 7);
    ctx.fillRect(x + 8, y - 10, 7, 7);
  },

  /* ========================= 主の住みか ========================= */
  drawLair(ctx, G, l, x, y) {
    const g = GUARDIANS[l.key];
    const done = G.seals[g.seal];
    /* 石のわ */
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const sx = x + Math.cos(a) * 108, sy = y + Math.sin(a) * 86;
      this.shadow(ctx, sx, sy + 10, 9, 4, 0.2);
      ctx.fillStyle = done ? '#7a8a96' : '#5c5a68';
      ctx.fillRect(sx - 7, sy - 22, 14, 32);
      ctx.fillStyle = done ? '#96a6b4' : '#74707e';
      ctx.fillRect(sx - 7, sy - 26, 14, 6);
      if (!done) {
        ctx.fillStyle = `rgba(200,138,255,${0.35 + Math.sin(this.t * 2 + i) * 0.2})`;
        ctx.beginPath(); ctx.arc(sx, sy - 12, 3.4, 0, TAU); ctx.fill();
      }
    }
    /* まんなかの祭壇 */
    ctx.fillStyle = done ? 'rgba(255,224,138,.20)' : 'rgba(168,120,208,.20)';
    ctx.beginPath(); ctx.ellipse(x, y, 96, 76, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = done ? '#8a94a4' : '#4a4256';
    ctx.beginPath(); ctx.ellipse(x, y, 26, 16, 0, 0, TAU); ctx.fill();
    if (!done) this.lights.push({ x, y, r: 190, c: 'rgba(200,138,255,ALPHA)' });

    ctx.font = 'bold 13px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)';
    const label = done ? `${g.name}の跡` : `${g.name} の住みか`;
    ctx.strokeText(label, x, y - 96); ctx.fillStyle = done ? '#c8d8ff' : '#e8c8ff';
    ctx.fillText(label, x, y - 96);
    ctx.textAlign = 'left';
  },

  /* ============================== 城 ============================== */
  drawCastle(ctx, G, x, y) {
    const open = sealCount(G) >= 3;
    /* 影のもや */
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(30,14,40,.8)';
    ctx.beginPath(); ctx.ellipse(x, y + 20, 250, 130, 0, 0, TAU); ctx.fill();
    ctx.restore();

    this.shadow(ctx, x, y + 46, 140, 30, 0.3);
    /* 本体 */
    ctx.fillStyle = '#241a30';
    ctx.fillRect(x - 110, y - 96, 220, 142);
    ctx.fillStyle = '#2f2340';
    ctx.fillRect(x - 96, y - 84, 192, 118);
    /* 塔 */
    for (const tx2 of [-118, -66, 62, 110]) {
      ctx.fillStyle = '#1c1428';
      ctx.fillRect(x + tx2 - 16, y - 150, 32, 196);
      ctx.fillStyle = '#3a2a4e';
      ctx.beginPath();
      ctx.moveTo(x + tx2 - 22, y - 148); ctx.lineTo(x + tx2, y - 194); ctx.lineTo(x + tx2 + 22, y - 148);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(200,90,140,${0.5 + Math.sin(this.t * 1.6 + tx2) * 0.3})`;
      ctx.fillRect(x + tx2 - 5, y - 122, 10, 14);
    }
    /* 門 */
    ctx.fillStyle = open ? '#5a2a3a' : '#120c18';
    ctx.beginPath();
    ctx.moveTo(x - 30, y + 46); ctx.lineTo(x - 30, y - 18);
    ctx.arc(x, y - 18, 30, Math.PI, 0);
    ctx.lineTo(x + 30, y + 46); ctx.closePath(); ctx.fill();
    if (open) {
      this.glow(ctx, x, y + 16, 90, 'rgba(255,120,150,ALPHA)', 0.5);
      ctx.font = 'bold 13px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText('門はひらいている', x, y + 74); ctx.fillStyle = '#ffc8d8';
      ctx.fillText('門はひらいている', x, y + 74);
      ctx.textAlign = 'left';
    } else {
      /* 三つの印の穴 */
      const keys = ['seal_leaf', 'seal_sun', 'seal_ice'];
      for (let i = 0; i < 3; i++) {
        const sx = x - 34 + i * 34;
        ctx.fillStyle = G.seals[keys[i]] ? '#ffe08a' : '#3a2a4e';
        ctx.beginPath(); ctx.arc(sx, y - 32, 8, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(sx, y - 32, 8, 0, TAU); ctx.stroke();
      }
    }
    this.lights.push({ x, y: y - 60, r: 260, c: 'rgba(200,80,140,ALPHA)' });

    ctx.font = 'bold 15px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4.5; ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.strokeText('黒い城', x, y - 206); ctx.fillStyle = '#e8b8d8';
    ctx.fillText('黒い城', x, y - 206);
    ctx.textAlign = 'left';
  },

  /* 小さな地図の置き場所。せまい画面では、右のボタンと魔法バーをよける。 */
  minimapSpot() {
    const narrow = this.W < 760;
    if (narrow) { const r = 40; return { x: this.W - 12 - r, y: 14 + r, r }; }
    const r = 58;
    return { x: this.W - 16 - r, y: this.H - 16 - r, r };
  },

  /* ============================ 小さな地図 ============================ */
  drawMinimap(ctx, G, x, y, size) {
    const px = G.p.x / World.pxW(), py = G.p.y / World.pxH();
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.clip();
    ctx.fillStyle = '#0e1a2a'; ctx.fillRect(x - size, y - size, size * 2, size * 2);

    const span = 26;   /* 何マス分うつすか（半径） */
    const cell = size / span;
    const ctx2 = ctx;
    const ptx = Math.floor(G.p.x / TILE), pty = Math.floor(G.p.y / TILE);
    for (let dy = -span; dy <= span; dy++) {
      for (let dx = -span; dx <= span; dx++) {
        if (dx * dx + dy * dy > span * span) continue;
        const t = World.get(ptx + dx, pty + dy);
        ctx2.fillStyle = TILE_DEF[t].c1;
        ctx2.fillRect(x + dx * cell, y + dy * cell, cell + 1, cell + 1);
      }
    }
    /* 村・住みか・城 */
    const mark = (tx, ty, color, r) => {
      const dx = tx - ptx, dy = ty - pty;
      if (dx * dx + dy * dy > span * span) return;
      ctx2.fillStyle = color;
      ctx2.beginPath(); ctx2.arc(x + dx * cell, y + dy * cell, r, 0, TAU); ctx2.fill();
    };
    for (const v of World.villages) mark(v.tx, v.ty, '#ffe08a', 4);
    for (const l of World.lairs) mark(l.tx, l.ty, G.seals[GUARDIANS[l.key].seal] ? '#7a8a96' : '#c88aff', 4);
    mark(World.castle.tx, World.castle.ty, '#ff5a7a', 5);
    for (const m of G.mobs) mark(Math.floor(m.x / TILE), Math.floor(m.y / TILE), m.boss ? '#ff9a3a' : '#ff6a6a', m.boss ? 4 : 2);
    /* 自分 */
    ctx2.fillStyle = '#ffffff';
    ctx2.beginPath(); ctx2.arc(x, y, 3.4, 0, TAU); ctx2.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(200,220,255,.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.stroke();
  },

  /* ========================= 全体の地図 ========================= */
  drawFullMap(cv, G) {
    const c = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    const sx = w / World.w, sy = h / World.h;
    c.fillStyle = '#0a0c22'; c.fillRect(0, 0, w, h);
    for (let ty = 0; ty < World.h; ty += 1) {
      for (let tx = 0; tx < World.w; tx += 1) {
        c.fillStyle = TILE_DEF[World.get(tx, ty)].c1;
        c.fillRect(tx * sx, ty * sy, sx + 1, sy + 1);
      }
    }
    const pin = (tx, ty, color, r, label) => {
      const x = tx * sx, y = ty * sy;
      c.fillStyle = color;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1.5; c.stroke();
      if (label) {
        c.font = 'bold 10px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
        c.textAlign = 'center';
        c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.7)';
        c.strokeText(label, x, y - r - 4); c.fillStyle = '#fff'; c.fillText(label, x, y - r - 4);
        c.textAlign = 'left';
      }
    };
    for (const v of World.villages) pin(v.tx, v.ty, '#ffe08a', 4, v.name);
    for (const l of World.lairs) {
      const g = GUARDIANS[l.key];
      pin(l.tx, l.ty, G.seals[g.seal] ? '#8a96a4' : '#c88aff', 5, G.seals[g.seal] ? '討伐ずみ' : g.name);
    }
    pin(World.castle.tx, World.castle.ty, '#ff5a7a', 6, '黒い城');
    pin(G.p.x / TILE, G.p.y / TILE, '#ffffff', 4, 'いまここ');
  },
});

function hexToGlow(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},ALPHA)`;
}
