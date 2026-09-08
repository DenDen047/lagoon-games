/* =========================================================================
   SUNSET SHIFT ― 光
   見下ろしの画面には空が写らない。かわりに太陽は「影の向きと長さ」と
   「地面と壁の色」で見せる。朝は影が西へ、正午は足元に短く、夕方は東へ長い。
   ========================================================================= */
'use strict';

const SUNRISE = 5.6;
const SUNSET = 18.6;

/* 時刻ごとの光の色。hor は日ざしが当たる面、mid は日陰、ambC は全体にかかる色。 */
const SKY_KEYS = [
  { h: 0.0,  hor: '#2a3350', mid: '#161d33', glow: '#1e2544', sunI: 0.00, amb: 0.30, ambC: '#5570b0' },
  { h: 4.2,  hor: '#3a3a58', mid: '#1c2340', glow: '#6b4a5e', sunI: 0.02, amb: 0.34, ambC: '#5a6ea8' },
  { h: 5.4,  hor: '#8a6270', mid: '#3c3c60', glow: '#d98a6a', sunI: 0.18, amb: 0.48, ambC: '#7d7099' },
  { h: 6.3,  hor: '#ffb07a', mid: '#6c7396', glow: '#ff9a5c', sunI: 0.62, amb: 0.66, ambC: '#a58aa0' },
  { h: 8.0,  hor: '#ffe6c0', mid: '#93b0cc', glow: '#ffe6c0', sunI: 0.95, amb: 0.90, ambC: '#a8c0e0' },
  { h: 12.0, hor: '#fffaf0', mid: '#a8c0d8', glow: '#ffffff', sunI: 1.00, amb: 1.00, ambC: '#c4d8ee' },
  { h: 15.5, hor: '#ffeec4', mid: '#a4b8cc', glow: '#ffe0a8', sunI: 0.94, amb: 0.96, ambC: '#c0c4d0' },
  { h: 17.2, hor: '#ffc978', mid: '#98899e', glow: '#ffae5c', sunI: 0.82, amb: 0.98, ambC: '#c09a92' },
  { h: 18.2, hor: '#ff8a4c', mid: '#7a6480', glow: '#ff6a3c', sunI: 0.55, amb: 0.90, ambC: '#b0708a' },
  { h: 18.9, hor: '#e05c38', mid: '#4f4370', glow: '#ff5230', sunI: 0.22, amb: 0.78, ambC: '#8a5a80' },
  { h: 19.8, hor: '#8a4258', mid: '#2c2c50', glow: '#b8482e', sunI: 0.05, amb: 0.58, ambC: '#6a5a94' },
  { h: 21.0, hor: '#2e3858', mid: '#131a30', glow: '#2c2c4e', sunI: 0.00, amb: 0.31, ambC: '#5570b0' },
  { h: 24.0, hor: '#2a3350', mid: '#161d33', glow: '#1e2544', sunI: 0.00, amb: 0.30, ambC: '#5570b0' },
];

const Sky = {
  clouds: null,
  _cacheKey: -1,
  _pal: null,

  init(seed) {
    const rng = new RNG(seed ^ 0x51ce);
    this.clouds = [];
    for (let i = 0; i < 12; i++) {
      const puffs = [];
      for (let j = 0, n = rng.i(4, 7); j < n; j++) {
        puffs.push({ dx: rng.f(-1, 1) * 150, dy: rng.f(-1, 1) * 90, r: rng.f(70, 160) });
      }
      this.clouds.push({ x: rng.f(0, 1), y: rng.f(0, 1), sp: rng.f(0.6, 1.5), a: rng.f(0.25, 0.6), puffs });
    }
  },

  sample(h) {
    const t = ((h % 24) + 24) % 24;
    const key = Math.round(t * 50);
    if (key === this._cacheKey) return this._pal;
    let a = SKY_KEYS[0], b = SKY_KEYS[1];
    for (let i = 0; i < SKY_KEYS.length - 1; i++) {
      if (t >= SKY_KEYS[i].h && t <= SKY_KEYS[i + 1].h) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
    }
    const k = smooth(clamp(invLerp(a.h, b.h, t), 0, 1));
    const p = {
      hor: mix(a.hor, b.hor, k), mid: mix(a.mid, b.mid, k), glow: mix(a.glow, b.glow, k),
      sunI: lerp(a.sunI, b.sunI, k), amb: lerp(a.amb, b.amb, k), ambC: mix(a.ambC, b.ambC, k),
    };
    this._cacheKey = key; this._pal = p;
    return p;
  },

  sun(h) {
    const t = ((h % 24) + 24) % 24;
    const day = invLerp(SUNRISE, SUNSET, t);
    return { day: clamp(day, 0, 1), alt: Math.sin(clamp(day, 0, 1) * Math.PI), up: day >= 0 && day <= 1 };
  },

  /* 街じゅうが参照する光。dir は影が伸びる向き（正規化ずみ）。 */
  light(h) {
    const p = this.sample(h);
    const s = this.sun(h);
    const night = p.sunI < 0.08;

    /* 朝は太陽が東（右）にあるので影は西（左）へ。正午は短く手前へ。夕方は東（右）へ長く。 */
    const ang = Math.PI * (1 - s.day);
    let dx = Math.cos(ang), dy = Math.sin(ang) * 0.62 + 0.16;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;

    let len, alpha;
    if (s.up && s.alt > 0.02) {
      const cot = Math.sqrt(Math.max(0.0001, 1 - s.alt * s.alt)) / Math.max(0.14, s.alt);
      len = clamp(cot, 0.3, 4.6);
      alpha = clamp(0.24 + p.sunI * 0.34, 0, 0.58) * clamp(1.3 - len * 0.14, 0.4, 1);
    } else {
      len = 1.6; alpha = 0.12;
      dx = 0.3; dy = -0.95;   /* 月あかりは北向きの弱い影 */
    }

    const warm = p.sunI > 0.75 ? mix('#fff6e6', '#ffd9a8', invLerp(1, 0.75, p.sunI))
      : p.sunI > 0.3 ? mix('#ffd9a8', '#ff8a44', invLerp(0.75, 0.3, p.sunI))
      : mix('#ff8a44', '#39406e', invLerp(0.3, 0, p.sunI));

    return {
      pal: p, night, dir: { x: dx, y: dy }, len,
      alpha, col: mix('#0a0f22', p.ambC, 0.3),
      warm, direct: p.sunI, ambient: p.amb, ambC: p.ambC,
      sunAlt: s.alt, sunUp: s.up,
      sunSide: -sign(dx) || 1,          // 太陽のある向き。西日なら -1（左）
      golden: clamp(1 - Math.abs(h - 17.7) / 1.7, 0, 1),
    };
  },

  /* 雲の影。地面をゆっくり流れる。 */
  cloudShadows(sctx, cam, L, W, H) {
    if (!this.clouds || L.direct < 0.25) return;
    const t = performance.now() * 0.00004;
    sctx.save();
    for (const c of this.clouds) {
      const cx = ((((c.x + t * c.sp) % 1) + 1) % 1) * (City.W + 1200) - 600 - cam.x;
      const cy = c.y * (City.H + 600) - 300 - cam.y;
      if (cx < -600 || cx > W + 600 || cy < -500 || cy > H + 500) continue;
      sctx.globalAlpha = c.a * clamp(L.direct, 0, 1) * 0.55;
      for (const q of c.puffs) {
        sctx.beginPath();
        sctx.ellipse(cx + q.dx, cy + q.dy, q.r, q.r * 0.72, 0, 0, TAU);
        sctx.fill();
      }
    }
    sctx.restore();
  },

  /* 世界を描いたあと、時刻ぶんの暗さをかける。この後に光を足す。 */
  ambientPass(ctx, W, H, L) {
    const dark = 1 - clamp(L.ambient, 0, 1);
    if (dark <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mix('#ffffff', L.ambC, dark * 0.8));
    g.addColorStop(1, mix('#ffffff', mix(L.ambC, '#101830', 0.5), dark * 1.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  },

  /* 太陽の側から差す色。夕方は画面の西半分が濃い橙になる。 */
  grade(ctx, W, H, L) {
    const a = clamp(L.golden * 0.38 + clamp(1 - L.sunAlt * 2.4, 0, 1) * L.direct * 0.2, 0, 0.44);
    if (a > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      const x0 = L.sunSide < 0 ? 0 : W;
      const g = ctx.createLinearGradient(x0, 0, W - x0, 0);
      g.addColorStop(0, rgba(mix(L.warm, '#ff6a3c', 0.35), a * 1.25));
      g.addColorStop(0.6, rgba(L.warm, a * 0.5));
      g.addColorStop(1, rgba(L.warm, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const v = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.36, W / 2, H * 0.5, Math.max(W, H) * 0.76);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(0,0,0,${0.12 + (1 - L.ambient) * 0.3})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  },
};

/* ------------------------- 影を集めるレイヤー -------------------------
   影を一枚の板にまとめて描き、最後に一度だけ薄く重ねる。
   こうしないと影どうしが重なった所だけ濃くなってしまう。            */
const ShadowLayer = {
  cv: null, ctx: null, w: 0, h: 0,
  begin(W, H, dpr, L, Z) {
    if (!this.cv) { this.cv = document.createElement('canvas'); this.ctx = this.cv.getContext('2d'); }
    const w = Math.ceil(W * dpr), h = Math.ceil(H * dpr);
    if (w !== this.w || h !== this.h) { this.cv.width = w; this.cv.height = h; this.w = w; this.h = h; }
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);
    c.setTransform(dpr * Z, 0, 0, dpr * Z, 0, 0);
    c.globalAlpha = 1;
    c.fillStyle = L.col;
    return c;
  },
  flush(ctx, W, H, L) {
    if (!this.cv) return;
    ctx.save();
    ctx.globalAlpha = L.alpha;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.cv, 0, 0);
    ctx.restore();
  },
};
