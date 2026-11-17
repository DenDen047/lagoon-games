/* =========================================================================
   SNOW HAUNT ― 画面に 描く
   よぞら / やしき / しかけ・オバケ・おきゃくさん / あかり / ふきだし / ゆき
   ========================================================================= */
'use strict';

const View = {
  c: null, g: null, light: null, W: 0, H: 0, dpr: 1, ts: 32, ox: 0, oy: 0, flakes: [], last: 0,

  init() {
    this.c = $('game'); this.g = this.c.getContext('2d');
    this.light = document.createElement('canvas');
    for (let i = 0; i < 90; i++) this.flakes.push({ x: rnd(), y: rnd(), r: rfloat(0.8, 2.4), v: rfloat(0.03, 0.08), w: rnd() * TAU });
    addEventListener('resize', () => this.resize());
    this.resize();
  },
  resize() {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.W = innerWidth; this.H = innerHeight;
    for (const c of [this.c, this.light]) { c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr); }
    this.c.style.width = this.W + 'px'; this.c.style.height = this.H + 'px';
    this.fit();
  },
  /* 上と下の 帯に かからないように、やしき全体が 入る 大きさを きめる */
  fit() {
    let top = 0, bot = this.H;
    if (!$('hud').classList.contains('hide')) {
      $('banner').style.top = ($('top').getBoundingClientRect().bottom + 5) + 'px';
      for (const id of ['top', 'banner']) { const r = $(id).getBoundingClientRect(); if (r.height) top = Math.max(top, r.bottom); }
      for (const id of ['dayBar', 'nightBar', 'pick']) { const el = $(id); if (!el.classList.contains('hide')) bot = Math.min(bot, el.getBoundingClientRect().top); }
    }
    const aw = this.W - 12, ah = bot - top - 8;
    // まだ ひろげていない ゆきの ばしょは 1れつ ちょっとだけ 見せる
    const cols = Sim.s ? EXPAND[Sim.s.expand].cols : MAP_W;
    const wT = Math.min(MAP_W, cols + 1.4) + 1.9, hT = MAP_H + 1.25;
    this.ts = Math.max(12, Math.floor(Math.min(aw / wT, ah / hT)));
    this.ox = Math.round(6 + (aw - this.ts * wT) / 2 + this.ts * 1.75);
    this.oy = Math.round(top + 4 + (ah - this.ts * hT) / 2 + this.ts * 0.95);
  },
  toCell(sx, sy) { return { x: Math.floor((sx - this.ox) / this.ts), y: Math.floor((sy - this.oy) / this.ts) }; },
  px(x) { return this.ox + x * this.ts; },
  py(y) { return this.oy + y * this.ts; },

  /* ------------------------------ 描く ------------------------------ */
  draw(t, dt) {
    const g = this.g, s = Sim.s, n = Sim.n, ts = this.ts;
    const dark = Game.mode === 'day' ? 0.16 : 0.62;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.sky(g, t);
    const cols = EXPAND[s.expand].cols;
    // マス
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const c = s.grid[idx(x, y)], px = this.px(x), py = this.py(y);
      if (c === CELL.LOCK) drawSnow(g, px, py, ts, x, y, t);
      else if (c === CELL.WALL) drawWall(g, px, py, ts, x, y);
      else drawFloor(g, px, py, ts, x, y);
    }
    this.outside(g, t);
    this.frame(g, cols);
    if (Game.mode === 'day') this.pathPreview(g, t);
    if (Game.mode === 'day') this.cursor(g);

    // 手前ほど あとに 描く
    const list = [];
    for (const p of s.props) list.push({ y: p.y + 0.8, f: () => drawProp(g, this.px(p.x + 0.5), this.py(p.y + 0.5), ts, p.type, p._anim || 0, t, p.x * 7 + p.y) });
    for (const gh of s.ghosts) {
      if (gh.x < 0) continue;
      const gy = gh.y + 0.62 + (gh._oy || 0);
      list.push({ y: gy + 0.1, f: () => this.ghost(g, gh, t) });
    }
    if (n) for (const gu of n.guests) list.push({ y: gu.y + 0.2, f: () => drawGuest(g, this.px(gu.x), this.py(gu.y + 0.2), ts, gu, t) });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.f();

    this.lighting(g, dark, cols, t);

    // あかりの 上に 文字を のせる
    if (n) {
      for (const gu of n.guests) this.guestHud(g, gu);
      for (const p of n.parts) { g.globalAlpha = 1 - p.t / p.life; circ(g, this.px(p.x), this.py(p.y), p.r * ts, p.color); }
      g.globalAlpha = 1;
      for (const f of n.fx) {
        const a = 1 - Math.max(0, f.t - f.life * 0.6) / (f.life * 0.4);
        g.globalAlpha = a; this.text(g, f.text, this.px(f.x), this.py(f.y), Math.max(11, ts * 0.36) * f.size, f.color);
      }
      g.globalAlpha = 1;
    }
    for (const gh of s.ghosts) {
      if (gh.x < 0) continue;
      if (gh.bub) this.bubble(g, gh.bub.text, this.px(gh.x + 0.5 + (gh._ox || 0)), this.py(gh.y - 0.45 + (gh._oy || 0)), '#fff4f4', '#c03050');
      else if (gh._st === 'sleep') this.text(g, 'z z', this.px(gh.x + 0.85) + Math.sin(t * 2) * 2, this.py(gh.y - 0.1) - (t * 6 % 6), Math.max(10, ts * 0.3), '#c8d8ff');
    }
    this.snow(g, dt);
  },

  sky(g, t) {
    const W = this.W, H = this.H;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#0c0a26'); gr.addColorStop(0.55, '#2a2a5c'); gr.addColorStop(1, '#4a5a8a');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const a = 0.4 + 0.4 * Math.sin(t * 1.5 + i);
      g.globalAlpha = a; circ(g, hash2(i, 1) * W, hash2(i, 2) * H * 0.6, hash2(i, 3) * 1.2 + 0.4, '#ffffff');
    }
    g.globalAlpha = 0.25; circ(g, W - 70, 70, 60, '#fff6c8'); g.globalAlpha = 1;
    circ(g, W - 70, 70, 34, '#fff6d8');
    circ(g, W - 80, 62, 6, '#efe4b8'); circ(g, W - 58, 80, 4, '#efe4b8');
    // 雪山
    const hy = this.oy - this.ts * 0.5;
    for (let L = 0; L < 2; L++) {
      g.beginPath(); g.moveTo(0, hy);
      for (let x = 0; x <= W; x += 20) {
        const h = Math.abs(Math.sin(x * 0.006 + L * 2) * 90 + Math.sin(x * 0.017 + L) * 30) + 40 - L * 30;
        g.lineTo(x, hy - h);
      }
      g.lineTo(W, hy); g.closePath(); g.fillStyle = L ? '#3a4678' : '#2c3464'; g.fill();
    }
    const gg = g.createLinearGradient(0, hy, 0, H);
    gg.addColorStop(0, '#b8c8e4'); gg.addColorStop(1, '#dce6f6');
    g.fillStyle = gg; g.fillRect(0, hy, W, H - hy);
  },

  /* やしきの 外: いりぐちと でぐちを むすぶ ゆきみち と かんばん */
  outside(g) {
    const ts = this.ts, x0 = this.px(-1.6);
    g.fillStyle = 'rgba(150,165,200,.45)';
    g.fillRect(x0, this.py(ENTRANCE.y + 0.18), ts * 1.6, ts * 0.64);
    g.fillRect(x0, this.py(EXIT.y + 0.18), ts * 1.6, ts * 0.64);
    g.fillRect(x0 - ts * 0.05, this.py(ENTRANCE.y + 0.18), ts * 0.6, this.py(EXIT.y + 2) - this.py(ENTRANCE.y + 0.18));
    for (const [d, label, col] of [[ENTRANCE, 'いりぐち', '#4fb071'], [EXIT, 'でぐち', '#e08a3a']]) {
      const sx = this.px(-0.95), sy = this.py(d.y - 0.15);
      line(g, sx, sy, sx, sy + ts * 0.5, '#5a4030', Math.max(2, ts * 0.08));
      const fs = Math.max(9, ts * 0.28);
      g.font = `900 ${fs}px ${FONT}`;
      const w = g.measureText(label).width + fs * 0.7;
      g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 2;
      rr(g, sx - w / 2, sy - fs * 1.2, w, fs * 1.5, fs * 0.4); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, sx, sy - fs * 0.45);
    }
  },

  frame(g, cols) {
    const ts = this.ts, x0 = this.ox, y0 = this.oy, w = cols * ts, h = MAP_H * ts, b = Math.max(3, ts * 0.16);
    g.fillStyle = '#1a1428';
    g.fillRect(x0 - b, y0 - b, w + b * 2, b); g.fillRect(x0 - b, y0 + h, w + b * 2, b);
    g.fillRect(x0 + w, y0 - b, b, h + b * 2);
    for (let y = 0; y < MAP_H; y++) if (!Sim.isDoor(0, y)) g.fillRect(x0 - b, y0 + y * ts, b, ts);
    // やね
    const rt = y0 - b - ts * 0.7;
    g.fillStyle = '#3e3258'; g.fillRect(x0 - b * 2, rt, w + b * 4, ts * 0.7);
    g.fillStyle = '#2e2444';
    for (let i = 0; i < (w + b * 4) / (ts * 0.5); i++) g.fillRect(x0 - b * 2 + i * ts * 0.5, rt + ts * 0.35, 2, ts * 0.35);
    g.fillStyle = '#f2f7ff'; rr(g, x0 - b * 2 - 2, rt - ts * 0.12, w + b * 4 + 4, ts * 0.22, ts * 0.1); g.fill();
    for (let i = 0; i < w / (ts * 0.4); i++) {
      const ix = x0 + i * ts * 0.4 + ts * 0.15, l = ts * (0.15 + hash2(i, 9) * 0.25);
      poly(g, [ix - ts * 0.06, y0 - b, ix + ts * 0.06, y0 - b, ix, y0 - b + l], '#dff4ff');
    }
    // ドア
    for (const d of [ENTRANCE, EXIT]) {
      const dy = this.py(d.y);
      g.fillStyle = '#7a4a2a'; g.fillRect(x0 - b, dy, b, ts * 0.12); g.fillRect(x0 - b, dy + ts * 0.88, b, ts * 0.12);
    }
    // ひろげられる ばしょ
    if (Game.mode === 'day' && cols < MAP_W) {
      g.setLineDash([6, 6]); g.strokeStyle = 'rgba(80,100,150,.6)'; g.lineWidth = 2;
      g.strokeRect(x0 + w + b + 3, y0 + 3, (MAP_W - cols) * ts - b - 6, h - 6); g.setLineDash([]);
      const right = Math.min(this.W, x0 + MAP_W * ts), cx = (x0 + w + b + right) / 2, fs = Math.max(10, ts * 0.3);
      if (right - x0 - w > ts * 3.2) this.text(g, '🔒 ひろげられる', cx, y0 + h / 2, fs, '#4a5a88', true);
      else { this.text(g, '🔒', cx, y0 + h / 2 - fs * 1.4, fs, '#4a5a88', true); this.text(g, 'ひろげ', cx, y0 + h / 2, fs * 0.85, '#4a5a88', true); this.text(g, 'られる', cx, y0 + h / 2 + fs * 1.1, fs * 0.85, '#4a5a88', true); }
    }
  },

  pathPreview(g, t) {
    const p = Sim.path, ts = this.ts;
    if (!p) {
      const k = 0.6 + 0.4 * Math.sin(t * 5);
      g.globalAlpha = k;
      for (const d of [ENTRANCE, EXIT]) { g.strokeStyle = '#ff5a5a'; g.lineWidth = 3; g.strokeRect(this.px(d.x) + 2, this.py(d.y) + 2, ts - 4, ts - 4); }
      g.globalAlpha = 1;
      return;
    }
    g.setLineDash([ts * 0.12, ts * 0.18]); g.lineDashOffset = -t * ts * 0.6;
    g.strokeStyle = 'rgba(255,240,170,.55)'; g.lineWidth = Math.max(2, ts * 0.07);
    g.beginPath(); p.forEach((c, i) => (i ? g.lineTo : g.moveTo).call(g, this.px(c.x + 0.5), this.py(c.y + 0.5))); g.stroke();
    g.setLineDash([]); g.lineDashOffset = 0;
  },

  /* おく ばしょの わく と とどく はんい */
  cursor(g) {
    const h = UI.hover, ts = this.ts;
    const show = (o, range) => { g.strokeStyle = 'rgba(255,240,150,.8)'; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.arc(this.px(o.x + 0.5), this.py(o.y + 0.5), range * ts, 0, TAU); g.stroke(); g.setLineDash([]); };
    if (UI.sel) {
      const o = UI.sel;
      show(o, o.range);
    }
    if (!h || Sim.cell(h.x, h.y) < 0) return;
    const ok = UI.canPlace(h.x, h.y);
    if (ok === null) return;
    g.fillStyle = ok ? 'rgba(120,255,160,.22)' : 'rgba(255,90,90,.25)';
    g.fillRect(this.px(h.x), this.py(h.y), ts, ts);
    g.strokeStyle = ok ? '#8affb0' : '#ff7070'; g.lineWidth = 2;
    g.strokeRect(this.px(h.x) + 1, this.py(h.y) + 1, ts - 2, ts - 2);
    const r = UI.toolRange();
    if (r && ok) show(h, r);
  },

  ghost(g, gh, t) {
    const d = GHOSTS[gh.type];
    const scare = gh._st === 'go' || gh._st === 'hold';
    let alpha = 1;
    if (d.hidden && !scare) alpha = Game.mode === 'day' ? 0.55 : 0.16;
    const face = gh._st && gh._st !== 'idle' && gh._st !== 'sleep' ? (gh._ox >= 0 ? 1 : -1) : 1;
    drawGhost(g, this.px(gh.x + 0.5 + (gh._ox || 0)), this.py(gh.y + 0.62 + (gh._oy || 0)), this.ts, gh.type,
      { t, alpha, scare, sleep: gh._st === 'sleep', seed: gh.id * 1.7, face });
  },

  /* あたまの うえ: どきどきメーター (いっぱいで にげる) と、いまの まんぞくの ★ */
  guestHud(g, gu) {
    const ts = this.ts, x = this.px(gu.x), y = this.py(gu.y + 0.2) - ts * (gu.kid ? 0.95 : 1.15);
    if (gu.st === 'walk') {
      const w = ts * 0.8, h = Math.max(4, ts * 0.12), f = clamp(gu.fear / 100, 0, 1);
      g.fillStyle = 'rgba(20,14,40,.75)'; rr(g, x - w / 2 - 1, y - 1, w + 2, h + 2, h / 2); g.fill();
      g.fillStyle = f < 0.5 ? '#7ae07a' : f < 0.8 ? '#ffb030' : '#ff4a4a';
      g.fillRect(x - w / 2, y, w * f, h);
      const r = gu.thrill > 0.5 ? rateThrill(gu.thrill, Sim.n.expect) : 0, ss = Math.max(5, ts * 0.17);
      g.font = `900 ${ss * 1.25}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < 5; i++) {
        const sx = x + (i - 2) * ss * 1.05, sy = y - ss * 0.8;
        g.fillStyle = i < r ? (r === 5 ? '#ffe24a' : '#ffc04a') : 'rgba(30,20,60,.55)';
        g.fillText('★', sx, sy);
      }
      if (gu.reporter) this.text(g, '📺', x - w / 2 - ts * 0.25, y + h / 2, Math.max(9, ts * 0.28));
    }
    if (gu.bub) this.bubble(g, gu.bub.text, x, y - ts * 0.3, '#ffffff', '#2a2440');
  },

  bubble(g, text, x, y, bg, fg) {
    const fs = Math.max(10, Math.min(16, this.ts * 0.32));
    g.font = `800 ${fs}px ${FONT}`;
    const w = g.measureText(text).width + fs * 0.9, h = fs * 1.5;
    const bx = clamp(x - w / 2, 4, this.W - w - 4), by = y - h - fs * 0.4;
    g.fillStyle = bg; g.strokeStyle = 'rgba(40,30,70,.5)'; g.lineWidth = 1.2;
    rr(g, bx, by, w, h, h / 2); g.fill(); g.stroke();
    poly(g, [x - fs * 0.3, by + h - 1, x + fs * 0.3, by + h - 1, x, by + h + fs * 0.4], bg);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, bx + w / 2, by + h / 2 + 1);
  },

  text(g, s, x, y, size, color = '#fff', noOutline) {
    g.font = `900 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (!noOutline) { g.lineWidth = Math.max(2.5, size * 0.22); g.strokeStyle = 'rgba(20,12,40,.85)'; g.lineJoin = 'round'; g.strokeText(s, x, y); }
    g.fillStyle = color; g.fillText(s, x, y);
  },

  /* やみを ぬって、ろうそくや オバケの まわりだけ あかるくする */
  lighting(g, dark, cols, t) {
    const L = this.light, lg = L.getContext('2d'), s = Sim.s, n = Sim.n, ts = this.ts, d = this.dpr;
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, L.width, L.height);
    lg.fillStyle = `rgba(8,5,26,${dark})`; lg.fillRect(0, 0, L.width, L.height);
    lg.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => {
      const X = x * d, Y = y * d, R = r * d;
      const gr = lg.createRadialGradient(X, Y, 0, X, Y, R);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = gr; lg.fillRect(X - R, Y - R, R * 2, R * 2);
    };
    const warm = [];
    for (const p of s.props) {
      const cx = this.px(p.x + 0.5), cy = this.py(p.y + 0.3);
      if (p.type === 'candle') { const f = 1 + Math.sin(t * 9 + p.x) * 0.04; hole(cx, cy, ts * 2.6 * f, 0.95); warm.push([cx, cy, ts * 2.2]); }
      else if (p.type === 'chandelier') { hole(cx, cy, ts * 2.8, 0.85); warm.push([cx, cy, ts * 2.2]); }
      else hole(cx, cy, ts * 0.9, 0.35 + (p._anim || 0) * 0.5);
    }
    for (const gh of s.ghosts) {
      if (gh.x < 0) continue;
      const scare = gh._st === 'go' || gh._st === 'hold';
      if (GHOSTS[gh.type].hidden && !scare) continue;
      hole(this.px(gh.x + 0.5 + (gh._ox || 0)), this.py(gh.y + 0.3 + (gh._oy || 0)), ts * (scare ? 1.6 : 1.1), scare ? 0.8 : 0.5);
    }
    if (n) for (const gu of n.guests) hole(this.px(gu.x), this.py(gu.y - 0.2), ts * 0.85, 0.4);
    for (const dd of [ENTRANCE, EXIT]) hole(this.px(0.3), this.py(dd.y + 0.5), ts * 1.5, 0.7);
    // やしきの 中だけに かける
    const b = Math.max(3, ts * 0.16);
    g.save();
    g.beginPath(); g.rect(this.ox - b, this.oy - b, cols * ts + b * 2, MAP_H * ts + b * 2); g.clip();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(L, 0, 0);
    g.setTransform(d, 0, 0, d, 0, 0);
    g.globalCompositeOperation = 'lighter';
    for (const [x, y, r] of warm) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,160,60,${dark * 0.28})`); gr.addColorStop(1, 'rgba(255,160,60,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();
  },

  snow(g, dt) {
    const W = this.W, H = this.H;
    g.fillStyle = 'rgba(255,255,255,.8)';
    for (const f of this.flakes) {
      f.y += f.v * dt; f.w += dt;
      if (f.y > 1.02) { f.y = -0.02; f.x = rnd(); }
      g.beginPath(); g.arc(f.x * W + Math.sin(f.w) * 12, f.y * H, f.r, 0, TAU); g.fill();
    }
  },
};

const FONT = '"Hiragino Maru Gothic ProN", "Hiragino Sans", "BIZ UDPGothic", "Yu Gothic", "Meiryo", sans-serif';
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
