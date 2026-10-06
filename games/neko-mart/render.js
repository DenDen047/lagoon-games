/* =========================================================================
   NEKO MART ― 描画
   カメラ / 町 / お店 / 家具 / 猫 / ふきだし / もようがえの表示
   ========================================================================= */
'use strict';

const FONT = '"Hiragino Maru Gothic ProN","Hiragino Sans","BIZ UDPGothic","Yu Gothic","Meiryo",sans-serif';
const T = TILE;

const Render = {
  cv: null, ctx: null, dpr: 1, cw: 0, ch: 0,
  cam: { px: 48, ox: 0, oy: 0, follow: false, cx: 0, cy: 0 },

  init() {
    this.cv = document.getElementById('game');
    this.ctx = this.cv.getContext('2d');
    this.resize();
  },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cw = window.innerWidth; this.ch = window.innerHeight;
    this.cv.width = Math.round(this.cw * this.dpr);
    this.cv.height = Math.round(this.ch * this.dpr);
    this.cv.style.width = this.cw + 'px';
    this.cv.style.height = this.ch + 'px';
  },
  /* お店全体が入るように拡大率を決める。小さすぎるときは店長を追いかける */
  fit(dt) {
    if (!G) return;
    const m = UI.margins();
    const W = Shop.W, H = Shop.H;
    const narrow = this.cw < this.ch;
    const x0 = narrow ? -0.45 : -1.2, x1 = narrow ? W + 0.45 : W + 1.2, y0 = -1.9, y1 = H + 3.0;
    const aw = this.cw - 12, ah = this.ch - m.top - m.bottom - 6;
    let px = Math.min(aw / (x1 - x0), ah / (y1 - y0));
    px = Math.min(px, 72);
    const cam = this.cam;
    const minPx = this.cw < 600 ? 34 : 30;
    cam.follow = px < minPx;
    if (cam.follow) px = minPx;
    cam.px = px;
    let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (cam.follow && R.player) {
      const vw = aw / px, vh = ah / px;
      cx = clamp(R.player.x, x0 + vw / 2, x1 - vw / 2);
      cy = clamp(R.player.y - 0.5, y0 + vh / 2, y1 - vh / 2);
      if (vw >= x1 - x0) cx = (x0 + x1) / 2;
      if (vh >= y1 - y0) cy = (y0 + y1) / 2;
    }
    const k = dt ? Math.min(1, dt * 6) : 1;
    cam.cx = cam.cx ? lerp(cam.cx, cx, k) : cx;
    cam.cy = cam.cy ? lerp(cam.cy, cy, k) : cy;
    cam.ox = 6 + aw / 2 - cam.cx * px;
    cam.oy = m.top + 3 + ah / 2 - cam.cy * px;
  },
  toWorld(sx, sy) { return { x: (sx - this.cam.ox) / this.cam.px, y: (sy - this.cam.oy) / this.cam.px }; },
  toScreen(x, y) { return { x: this.cam.ox + x * this.cam.px, y: this.cam.oy + y * this.cam.px }; },

  draw() {
    const ctx = this.ctx, d = this.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#e9dfcc';
    ctx.fillRect(0, 0, this.cw, this.ch);
    if (!G) return;
    const k = this.cam.px / T;
    ctx.setTransform(d * k, 0, 0, d * k, d * this.cam.ox, d * this.cam.oy);
    ctx.imageSmoothingEnabled = true;
    const W = Shop.W, H = Shop.H;
    this.view = {
      x0: Math.floor(-this.cam.ox / this.cam.px) - 1, x1: Math.ceil((this.cw - this.cam.ox) / this.cam.px) + 1,
      y0: Math.floor(-this.cam.oy / this.cam.px) - 1, y1: Math.ceil((this.ch - this.cam.oy) / this.cam.px) + 1,
    };
    this.drawTown(ctx, W, H);
    this.drawFloor(ctx, W, H);
    this.drawBackWall(ctx, W);
    this.drawFloorStuff(ctx, H);

    /* 奥から順に描く */
    const ents = [];
    for (const f of G.furn) ents.push({ y: f.y + FURN[f.type].h, f });
    for (const c of R.cats) ents.push({ y: c.y, c });
    ents.push({ y: R.player.y, p: R.player });
    for (const s of G.signs) ents.push({ y: H + 1.9, s });
    ents.push({ y: H + 0.96, wall: true });
    for (let x = this.view.x0; x <= this.view.x1; x++) {
      if ((x < -1 || x > W) && ((x % 4) + 4) % 4 === 1) ents.push({ y: H + 2.92, tree: x });
    }
    ents.sort((a, b) => a.y - b.y);
    const sel = Editor.active ? null : Interact.target();
    for (const e of ents) {
      if (e.f) this.drawFurn(ctx, e.f, sel && sel.f === e.f);
      else if (e.c) this.drawCustomer(ctx, e.c);
      else if (e.p) this.drawPlayer(ctx, e.p);
      else if (e.s) this.drawSign(ctx, e.s, H);
      else if (e.wall) this.drawFrontWall(ctx, W, H);
      else if (e.tree != null) this.drawTree(ctx, e.tree, H);
    }
    if (G.weather === 'rain') this.drawRain(ctx, W, H);
    this.drawFx(ctx);
    if (!Editor.active) {
      this.drawBubbles(ctx);
      this.drawGuide(ctx, sel);
    } else Editor.drawOverlay(ctx);
    this.drawTint(ctx);
  },

  /* ------------------------------ 町 ------------------------------ */
  drawTown(ctx, W, H) {
    const v = this.view;
    const X0 = v.x0 * T, X1 = v.x1 * T;
    /* 車道 */
    ctx.fillStyle = '#7d8290';
    ctx.fillRect(X0, (H + 3) * T, X1 - X0, Math.max(4, v.y1 - H - 3) * T);
    ctx.fillStyle = '#f4f1e8';
    for (let x = Math.floor(v.x0 / 2) * 2; x < v.x1; x += 2) ctx.fillRect(x * T + 10, (H + 4.45) * T, T - 6, 5);
    ctx.fillStyle = '#b9b4ac';
    ctx.fillRect(X0, (H + 3) * T - 4, X1 - X0, 8);
    /* 歩道 */
    for (let y = H + 1; y < H + 3; y++) {
      for (let x = v.x0; x < v.x1; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#ddd6cb' : '#e5dfd4';
        ctx.fillRect(x * T, y * T, T, T);
      }
    }
    ctx.strokeStyle = 'rgba(150,140,125,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = v.x0; x < v.x1; x++) { ctx.moveTo(x * T, (H + 1) * T); ctx.lineTo(x * T, (H + 3) * T); }
    ctx.moveTo(X0, (H + 2) * T); ctx.lineTo(X1, (H + 2) * T);
    ctx.stroke();
    /* お店のうしろと横は芝生、その外にとなりの建物 */
    const gy0 = v.y0 * T, gy1 = (H + 1) * T;
    ctx.fillStyle = '#cfe8b6';
    ctx.fillRect(X0, gy0, X1 - X0, gy1 - gy0);
    ctx.fillStyle = 'rgba(120,170,90,0.18)';
    for (let y = v.y0; y < H + 1; y++) {
      for (let x = v.x0; x < v.x1; x++) {
        if (hash2(x, y) < 0.45) continue;
        const px = x * T + hash2(x, y + 9) * 36 + 6, py = y * T + hash2(x + 3, y) * 36 + 6;
        ctx.fillRect(px, py, 2, 5); ctx.fillRect(px + 3, py + 1, 2, 4);
      }
    }
    for (let y = v.y0; y < H; y++) {
      for (const x of [-1, W]) {
        if (hash2(x * 7, y) < 0.55) continue;
        const cx = x * T + T / 2 + (x < 0 ? -6 : 6), cy = y * T + 28;
        ctx.fillStyle = '#9fd48a'; ellipse(ctx, cx, cy, 13, 10); ctx.fill();
        ctx.fillStyle = '#b6e2a0'; ellipse(ctx, cx - 3, cy - 3, 7, 5); ctx.fill();
        if (hash2(x, y * 3) > 0.5) { ctx.fillStyle = '#ff9fb8'; ellipse(ctx, cx + 5, cy - 2, 2.5, 2.5); ctx.fill(); }
      }
    }
    for (let k = 0; -1 - 3 * k > v.x0; k++) this.drawNeighbor(ctx, -k - 1, -4 - 3 * k, -1 - 3 * k, H);
    for (let k = 0; W + 1 + 3 * k < v.x1; k++) this.drawNeighbor(ctx, k + 40, W + 1 + 3 * k, W + 4 + 3 * k, H);
  },
  /* となりの建物 (3マスで1軒)。上から見た屋根と、通りに向いた壁 */
  drawNeighbor(ctx, b, x0, x1, H) {
    const pal = [['#f4b6a6', '#fbe8dc'], ['#a8d0e6', '#eef6fb'], ['#e8d89a', '#fff7e0'], ['#b9dcb0', '#f0f8ea'], ['#d9bfe0', '#f8eefa'], ['#f2c79a', '#fff2e2']];
    const [roof, wall] = pal[Math.floor(hash2(b, 7) * pal.length)];
    const L = x0 * T + 3, R = x1 * T - 3, back = (H - 2.4 - hash2(b, 2) * 2) * T;
    const ridge = (back + H * T) / 2;
    ctx.fillStyle = 'rgba(60,80,40,0.15)'; ctx.fillRect(L + 4, back + 6, R - L, H * T - back);
    ctx.fillStyle = shade(roof, 0.12); ctx.fillRect(L, back, R - L, ridge - back);
    ctx.fillStyle = roof; ctx.fillRect(L, ridge, R - L, H * T - ridge + 4);
    ctx.strokeStyle = rgba(roof === '#a8d0e6' ? '#5a7a90' : '#8a5a40', 0.12); ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = back + 8; y < H * T; y += 9) { ctx.moveTo(L, y); ctx.lineTo(R, y); }
    ctx.stroke();
    ctx.fillStyle = shade(roof, -0.15); ctx.fillRect(L, ridge - 1.5, R - L, 3);
    ctx.strokeStyle = shade(roof, -0.3); ctx.lineWidth = 1.5; ctx.strokeRect(L, back, R - L, H * T - back + 4);
    /* 通りに向いた壁 */
    const fy = H * T + 4;
    ctx.fillStyle = wall; ctx.fillRect(L, fy, R - L, T - 4);
    ctx.strokeStyle = shade(wall, -0.25); ctx.lineWidth = 1.5; ctx.strokeRect(L, fy, R - L, T - 4);
    const kind = Math.floor(hash2(b, 3) * 3);
    const mid = (L + R) / 2;
    if (kind === 0) {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#fff' : shade(roof, -0.1);
        ctx.fillRect(L + 6 + i * ((R - L - 12) / 4), fy + 2, (R - L - 12) / 4 + 0.5, 9);
      }
      ctx.fillStyle = '#bfe3f4'; ctx.fillRect(L + 12, fy + 16, R - L - 50, 20);
      ctx.fillStyle = shade(wall, -0.45); ctx.fillRect(R - 32, fy + 14, 18, T - 18);
    } else if (kind === 1) {
      for (const wx of [L + 14, mid - 12, R - 38]) {
        ctx.fillStyle = '#bfe3f4'; ctx.fillRect(wx, fy + 12, 24, 16);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(wx, fy + 12, 24, 16);
      }
    } else {
      ctx.fillStyle = shade(wall, -0.4); ctx.fillRect(mid - 10, fy + 12, 20, T - 16);
      ctx.fillStyle = '#ffd25e'; ellipse(ctx, mid + 6, fy + 28, 1.5, 1.5); ctx.fill();
      ctx.fillStyle = '#7fc46d';
      for (const px of [L + 18, R - 18]) { ellipse(ctx, px, fy + T - 10, 10, 8); ctx.fill(); }
    }
  },
  drawTree(ctx, x, H) {
    const cx = x * T + T / 2, cy = (H + 2.92) * T;
    ctx.fillStyle = 'rgba(40,50,30,0.18)'; ellipse(ctx, cx, cy, 16, 5); ctx.fill();
    ctx.fillStyle = '#8a6040'; ctx.fillRect(cx - 3, cy - 26, 6, 26);
    const g = ['#7cc46d', '#69b35c', '#8fd27e'];
    [[-10, -34, 14], [10, -36, 14], [0, -48, 16], [0, -34, 13]].forEach(([dx, dy, r], i) => {
      ctx.fillStyle = g[i % 3]; ellipse(ctx, cx + dx, cy + dy, r, r * 0.9); ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ellipse(ctx, cx - 5, cy - 52, 7, 4); ctx.fill();
  },

  /* ------------------------------ お店の床とかべ ------------------------------ */
  drawFloor(ctx, W, H) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#f6ead3' : '#efdfc2';
        ctx.fillRect(x * T, y * T, T, T);
      }
    }
    ctx.strokeStyle = 'rgba(160,120,70,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x++) { ctx.moveTo(x * T, 0); ctx.lineTo(x * T, H * T); }
    for (let y = 0; y <= H; y++) { ctx.moveTo(0, y * T); ctx.lineTo(W * T, y * T); }
    ctx.stroke();
    /* 入り口のマット */
    const d = G.door.x;
    ctx.fillStyle = '#b0605a';
    rrect(ctx, d * T + 5, (H - 1) * T + 18, T - 10, T - 22, 4); ctx.fill();
    ctx.strokeStyle = '#d98a7f'; ctx.lineWidth = 2;
    rrect(ctx, d * T + 9, (H - 1) * T + 22, T - 18, T - 30, 3); ctx.stroke();
  },
  drawBackWall(ctx, W) {
    const top = -1.6 * T;
    const g = ctx.createLinearGradient(0, top, 0, 0);
    g.addColorStop(0, '#cfe8de'); g.addColorStop(1, '#bfdfd2');
    ctx.fillStyle = g;
    ctx.fillRect(-0.35 * T, top, (W + 0.7) * T, -top);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = 0; x < W * 4; x++) ctx.fillRect(x * 12 + 4, top + 8, 3, -top - 18);
    ctx.fillStyle = '#9c7a5a';
    ctx.fillRect(-0.35 * T, -9, (W + 0.7) * T, 9);
    ctx.fillStyle = '#86d0c0';
    ctx.fillRect(-0.35 * T, top - 6, (W + 0.7) * T, 8);
    ctx.fillStyle = '#5a9e90';
    ctx.fillRect(-0.35 * T, top - 6, (W + 0.7) * T, 2);
    for (let x = 0; x < W; x++) {
      const w = G.walls.top[x];
      if (!w) continue;
      if (w.type === 'window') this.drawWindowBack(ctx, x * T + 6, top + 12, T - 12, 40);
      else if (w.type === 'poster') this.drawPoster(ctx, w.pic, x * T + 8, top + 10, 32, 43);
    }
    /* 左右のかべ */
    ctx.fillStyle = '#a6c9bc';
    ctx.fillRect(-0.35 * T, top - 6, 0.35 * T, (Shop.H + 1.6) * T + 6);
    ctx.fillRect(W * T, top - 6, 0.35 * T, (Shop.H + 1.6) * T + 6);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, top, 3, -top + Shop.H * T);
    ctx.fillRect(W * T - 3, top, 3, -top + Shop.H * T);
  },
  sky(ctx, x, y, w, h) {
    const ev = G.clock > 16.5 * 60 ? clamp((G.clock - 16.5 * 60) / 90, 0, 1) : 0;
    const wt = G.weather;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (wt === 'rain' || wt === 'cloudy') { g.addColorStop(0, '#aab4c2'); g.addColorStop(1, '#cdd4dc'); }
    else { g.addColorStop(0, ev ? '#f5a36c' : '#8fd0f5'); g.addColorStop(1, ev ? '#ffd9a0' : '#d8f1ff'); }
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    if (wt === 'rain') {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const sx = x + ((i * 9 + R.t * 40) % w), sy = y + ((i * 13 + R.t * 90) % h);
        ctx.moveTo(sx, sy); ctx.lineTo(sx - 2, sy + 6);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const cx = x + ((R.t * 3 + x) % (w + 20)) - 10;
      ellipse(ctx, cx, y + h * 0.4, 7, 3.5); ctx.fill();
      ellipse(ctx, cx + 6, y + h * 0.36, 5, 3); ctx.fill();
    }
  },
  drawWindowBack(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    this.sky(ctx, x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = '#f8f3ea'; ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
    ctx.fillStyle = '#e6d9c8'; ctx.fillRect(x - 3, y + h, w + 6, 4);
  },
  drawPoster(ctx, picId, x, y, w, h) {
    const pic = G.pics[picId];
    const img = pic ? Pics.get('pic:' + picId, pic.data) : null;
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + 2, y + 2, w, h);
    if (img) ctx.drawImage(img, x, y, w, h);
    else { ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); }
    ctx.strokeStyle = 'rgba(80,60,50,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#e8505b'; ellipse(ctx, x + w / 2, y + 2, 2, 2); ctx.fill();
  },
  drawFrontWall(ctx, W, H) {
    const y = H * T;
    for (let x = 0; x < W; x++) {
      const X = x * T;
      if (x === G.door.x) { this.drawDoor(ctx, X, y); continue; }
      ctx.fillStyle = '#f2e6d4'; ctx.fillRect(X, y, T + 0.5, T);
      ctx.fillStyle = '#d9c7ad'; ctx.fillRect(X, y + T - 7, T + 0.5, 7);
      const w = G.walls.bottom[x];
      if (w && w.type === 'window') {
        const gx = X + 5, gy = y + 13, gw = T - 10, gh = 24;
        const g = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
        g.addColorStop(0, '#c8ecfb'); g.addColorStop(1, '#8cc8e8');
        ctx.fillStyle = g; ctx.fillRect(gx, gy, gw, gh);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.moveTo(gx + 6, gy + gh); ctx.lineTo(gx + 14, gy); ctx.lineTo(gx + 19, gy); ctx.lineTo(gx + 11, gy + gh); ctx.fill();
        ctx.strokeStyle = '#fffaf2'; ctx.lineWidth = 3; ctx.strokeRect(gx, gy, gw, gh);
      } else if (w && w.type === 'poster') {
        this.drawPoster(ctx, w.pic, X + 11, y + 11, 26, 34);
      }
    }
    ctx.fillStyle = '#5f9e8f';
    ctx.fillRect(-0.35 * T, y, 0.35 * T, T);
    ctx.fillRect(W * T, y, 0.35 * T, T);
    /* しましまのひさしと店名 */
    const ax0 = -0.2 * T, ax1 = (W + 0.2) * T, ay = y - 3, ah = 13;
    ctx.save();
    ctx.beginPath(); ctx.rect(ax0, ay, ax1 - ax0, ah + 6); ctx.clip();
    for (let i = 0, x = ax0; x < ax1; x += 12, i++) {
      ctx.fillStyle = i % 2 ? '#fff7f0' : '#ff8fa3';
      ctx.fillRect(x, ay, 12, ah);
      ctx.beginPath(); ctx.arc(x + 6, ay + ah, 6, 0, Math.PI); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(160,60,80,0.25)'; ctx.fillRect(ax0, ay, ax1 - ax0, 2);
    if (G.shopName) {
      ctx.font = `800 11px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = Math.min(ctx.measureText(G.shopName).width + 18, W * T - 8);
      const cx = W * T / 2, cy = ay + 7;
      ctx.fillStyle = '#fffdf8';
      rrect(ctx, cx - tw / 2, cy - 8, tw, 16, 8); ctx.fill();
      ctx.strokeStyle = '#e0607a'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#e0506e';
      ctx.fillText(G.shopName, cx, cy + 0.5, tw - 12);
    }
  },
  drawDoor(ctx, X, y) {
    const o = R.doorOpen;
    ctx.fillStyle = '#6a8f86'; ctx.fillRect(X, y, 4, T); ctx.fillRect(X + T - 4, y, 4, T);
    ctx.fillStyle = '#7fbfae'; ctx.fillRect(X, y, T, 6);
    const glass = (gx, gw) => {
      if (gw < 1) return;
      ctx.fillStyle = 'rgba(190,230,248,0.55)'; ctx.fillRect(gx, y + 6, gw, T - 8);
      ctx.strokeStyle = '#c9d6dc'; ctx.lineWidth = 2; ctx.strokeRect(gx, y + 6, gw, T - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(gx + 3, y + 9, 2, T - 16);
    };
    if (G.door.auto) {
      const pw = (T - 8) / 2, off = o * (pw - 3);
      glass(X + 4 - off, pw);
      glass(X + 4 + pw + off, pw);
      ctx.fillStyle = '#5ac08f'; ctx.fillRect(X + T / 2 - 5, y + 1, 10, 3);
    } else {
      glass(X + 4, (T - 8) * (1 - o * 0.8));
      ctx.fillStyle = '#c9a050'; ctx.fillRect(X + 4 + (T - 8) * (1 - o * 0.8) - 6, y + 26, 3, 8);
    }
    /* 営業中の札 */
    const open = G.phase === 'open';
    ctx.fillStyle = open ? '#ffef9e' : '#e0d6cc';
    rrect(ctx, X + T + 2, y + 14, 22, 11, 2); ctx.fill();
    ctx.fillStyle = open ? '#d0402a' : '#7a6e66';
    ctx.font = `800 7px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'OPEN' : 'CLOSE', X + T + 13, y + 20);
  },
  drawFloorStuff(ctx) {
    for (const p of G.puddles) {
      ctx.fillStyle = `rgba(120,180,230,${0.45 * p.a})`;
      ellipse(ctx, p.x * T, p.y * T, 15 * p.s, 7 * p.s); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.5 * p.a})`;
      ellipse(ctx, p.x * T - 4, p.y * T - 2, 4 * p.s, 1.5); ctx.fill();
    }
    for (const l of G.litter) {
      const h = hash2(Math.round(l.x * 100), Math.round(l.y * 100));
      ctx.save();
      ctx.translate(l.x * T, l.y * T); ctx.rotate(h * 6);
      ctx.fillStyle = ['#f6f2ea', '#ffd0d8', '#cfe8ff'][Math.floor(h * 3)];
      ctx.strokeStyle = 'rgba(90,80,70,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(1, -5); ctx.lineTo(5, -1); ctx.lineTo(3, 4); ctx.lineTo(-4, 3); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  },

  /* ------------------------------ 家具 ------------------------------ */
  box(ctx, x, yb, w, hz, depth, front, top) {
    ctx.fillStyle = 'rgba(60,40,30,0.16)';
    ctx.fillRect(x + 2, yb - 3, w, 6);
    ctx.fillStyle = front; ctx.fillRect(x, yb - hz, w, hz);
    ctx.fillStyle = top; ctx.fillRect(x, yb - hz - depth, w, depth);
    ctx.strokeStyle = 'rgba(60,40,40,0.45)'; ctx.lineWidth = 1.2;
    ctx.strokeRect(x, yb - hz - depth, w, hz + depth);
    ctx.beginPath(); ctx.moveTo(x, yb - hz); ctx.lineTo(x + w, yb - hz); ctx.stroke();
  },
  /* 棚の列ごとに、数に応じて1〜3段に商品を描く */
  slotIcons(ctx, f, x, w, baseY, tiers, size) {
    const n = f.slots.length, cw = w / n;
    f.slots.forEach((s, i) => {
      if (s.n <= 0 || !s.pid) return;
      const shown = s.n >= 5 ? 3 : s.n >= 3 ? 2 : 1;
      for (let k = 0; k < Math.min(shown, tiers.length); k++) {
        ProdArt.draw(ctx, s.pid, x + cw * (i + 0.5), baseY - tiers[k], size);
      }
    });
  },
  drawFurn(ctx, f, hi) {
    const d = FURN[f.type];
    const x = f.x * T, y = f.y * T, w = d.w * T, yb = (f.y + d.h) * T;
    ctx.save();
    switch (f.type) {
      case 'shelf': {
        this.box(ctx, x + 2, yb - 4, w - 4, 52, 12, '#d8aa78', '#e9c497');
        ctx.fillStyle = '#c69261';
        for (const ty of [yb - 6, yb - 23, yb - 40]) ctx.fillRect(x + 4, ty, w - 8, 3);
        ctx.fillStyle = 'rgba(80,50,30,0.12)';
        ctx.fillRect(x + 4, yb - 54, w - 8, 48);
        this.slotIcons(ctx, f, x + 4, w - 8, yb - 6, [8, 25, 42], 16);
        break;
      }
      case 'wagon': {
        ctx.fillStyle = '#7a5a40';
        ctx.fillRect(x + 8, yb - 10, 3, 10); ctx.fillRect(x + w - 11, yb - 10, 3, 10);
        ctx.fillStyle = '#555'; ellipse(ctx, x + 10, yb - 1, 3, 3); ctx.fill(); ellipse(ctx, x + w - 10, yb - 1, 3, 3); ctx.fill();
        this.box(ctx, x + 4, yb - 10, w - 8, 12, 18, '#e8b75e', '#f6d38c');
        ctx.strokeStyle = '#c9963d'; ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 6 + i * 11, yb - 22); ctx.lineTo(x + 10 + i * 11, yb - 10); ctx.stroke(); }
        this.slotIcons(ctx, f, x + 4, w - 8, yb - 22, [6, 13, 20], 16);
        break;
      }
      case 'fridge': {
        this.box(ctx, x + 2, yb - 3, w - 4, 70, 10, '#eef2f5', '#dfe6ec');
        ctx.fillStyle = '#5fb3e8'; ctx.fillRect(x + 2, yb - 83, w - 4, 10);
        ctx.fillStyle = '#fff'; ctx.font = `800 7px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('DRINK', x + w / 2, yb - 78);
        const gx = x + 6, gw = w - 12, gy = yb - 69, gh = 62;
        ctx.fillStyle = '#d7eef9'; ctx.fillRect(gx, gy, gw, gh);
        ctx.fillStyle = '#b8d8ea';
        for (const ty of [yb - 9, yb - 29, yb - 49]) ctx.fillRect(gx, ty, gw, 2);
        this.slotIcons(ctx, f, gx, gw, yb - 9, [8, 28, 48], 16);
        ctx.fillStyle = 'rgba(220,240,255,0.25)'; ctx.fillRect(gx, gy, gw, gh);
        ctx.strokeStyle = '#a9b8c4'; ctx.lineWidth = 2;
        ctx.strokeRect(gx, gy, gw / 2, gh); ctx.strokeRect(gx + gw / 2, gy, gw / 2, gh);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.moveTo(gx + 6, gy + gh); ctx.lineTo(gx + 18, gy); ctx.lineTo(gx + 23, gy); ctx.lineTo(gx + 11, gy + gh); ctx.fill();
        break;
      }
      case 'freezer':
      case 'icecase': {
        const ice = f.type === 'icecase';
        this.box(ctx, x + 2, yb - 3, w - 4, 24, 28, ice ? '#ffe3ef' : '#f2f6f9', ice ? '#ffd0e2' : '#dfe9f0');
        ctx.fillStyle = ice ? '#ff8fb5' : '#6aa8e0';
        ctx.fillRect(x + 2, yb - 16, w - 4, 6);
        ctx.fillStyle = '#fff'; ctx.font = `800 7px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ice ? 'ICE CREAM' : 'FROZEN', x + w / 2, yb - 13);
        const gx = x + 6, gy = yb - 52, gw = w - 12, gh = 24;
        ctx.fillStyle = ice ? '#fff3f8' : '#e6f3fb'; ctx.fillRect(gx, gy, gw, gh);
        this.slotIcons(ctx, f, gx, gw, gy + gh - 1, [7, 13, 19], 15);
        ctx.fillStyle = 'rgba(200,230,255,0.3)'; ctx.fillRect(gx, gy, gw, gh);
        ctx.strokeStyle = '#a9b8c4'; ctx.lineWidth = 1.5; ctx.strokeRect(gx, gy, gw, gh);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(gx + 4, gy + 2, gw * 0.4, 3);
        break;
      }
      case 'register': {
        this.box(ctx, x + 1, yb - 3, w - 2, 28, 16, '#c98f5e', '#f3e2c6');
        ctx.fillStyle = '#b07a4a'; ctx.fillRect(x + 1, yb - 12, w - 2, 3);
        /* レジの機械 */
        const mx = x + 6, my = yb - 46;
        ctx.fillStyle = '#5c6470'; rrect(ctx, mx, my + 6, 30, 14, 3); ctx.fill();
        ctx.fillStyle = '#434a55'; ctx.fillRect(mx + 4, my - 6, 22, 12);
        const paying = R.queue[0] && R.queue[0].state === 'pay';
        ctx.fillStyle = paying ? '#9ff0a8' : '#7fd0e0'; ctx.fillRect(mx + 6, my - 4, 18, 8);
        ctx.fillStyle = '#2b3038'; ctx.font = `700 6px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (paying) ctx.fillText(yen(R.queue[0].basket.slice(0, R.queue[0].scanI).reduce((s, b) => s + b.price, 0)), mx + 15, my);
        ctx.fillStyle = '#d6dbe2';
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ctx.fillRect(mx + 4 + i * 8, my + 9 + j * 5, 6, 3);
        /* 右側の小物 */
        const jx = x + w - 20, jy = yb - 44;
        ctx.fillStyle = 'rgba(220,240,255,0.7)'; rrect(ctx, jx - 8, jy, 16, 16, 4); ctx.fill();
        ctx.strokeStyle = '#9ab'; ctx.lineWidth = 1; ctx.stroke();
        ['#ff7b8a', '#ffd25e', '#7fd0a0', '#9fb5ff'].forEach((c, i) => { ctx.fillStyle = c; ellipse(ctx, jx - 3 + (i % 2) * 6, jy + 6 + Math.floor(i / 2) * 5, 2.5, 2.5); ctx.fill(); });
        ctx.fillStyle = '#c05a72'; ctx.fillRect(jx - 6, jy - 3, 12, 3);
        break;
      }
      case 'stock': {
        this.box(ctx, x + 2, yb - 3, w - 4, 60, 10, '#9aa3ad', '#b9c1ca');
        ctx.fillStyle = '#7d8691';
        for (const ty of [yb - 5, yb - 25, yb - 45]) ctx.fillRect(x + 3, ty, w - 6, 3);
        const total = Object.values(G.stock).reduce((a, b) => a + b, 0);
        const boxes = Math.min(9, Math.ceil(total / 8));
        for (let i = 0; i < boxes; i++) {
          const bx = x + 7 + (i % 3) * 28, by = yb - 5 - Math.floor(i / 3) * 20;
          ctx.fillStyle = i % 2 ? '#d9a86a' : '#cf9c5e';
          ctx.fillRect(bx, by - 15, 24, 15);
          ctx.strokeStyle = '#8a6232'; ctx.lineWidth = 1; ctx.strokeRect(bx, by - 15, 24, 15);
          ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(bx + 10, by - 15, 4, 15);
        }
        ctx.fillStyle = '#fff8e0'; rrect(ctx, x + w / 2 - 16, yb - 74, 32, 11, 3); ctx.fill();
        ctx.fillStyle = '#6a5a40'; ctx.font = `800 7px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('そうこ', x + w / 2, yb - 68.5);
        break;
      }
      case 'bench': {
        ctx.fillStyle = '#8a6040';
        ctx.fillRect(x + 6, yb - 14, 4, 14); ctx.fillRect(x + w - 10, yb - 14, 4, 14);
        this.box(ctx, x + 3, yb - 10, w - 6, 10, 24, '#b57f52', '#d9a878');
        ctx.fillStyle = '#f2f2f2'; ellipse(ctx, x + 22, yb - 30, 10, 6); ctx.fill();
        ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#ffe9b0'; ellipse(ctx, x + 22, yb - 31, 6, 3); ctx.fill();
        ctx.fillStyle = '#e0b070'; rrect(ctx, x + 38, yb - 32, 26, 5, 2.5); ctx.fill();
        ctx.fillStyle = '#ff7b8a'; ellipse(ctx, x + 74, yb - 28, 6, 6); ctx.fill();
        ctx.strokeStyle = '#d0506a'; ctx.beginPath(); ctx.arc(x + 74, yb - 28, 3.5, 0, 4); ctx.stroke();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x + 46, yb - 22); ctx.lineTo(x + 58, yb - 18); ctx.moveTo(x + 46, yb - 18); ctx.lineTo(x + 58, yb - 22); ctx.stroke();
        break;
      }
      case 'trash': {
        const cx = x + T / 2;
        ctx.fillStyle = 'rgba(60,40,30,0.16)'; ellipse(ctx, cx + 2, yb - 8, 14, 4); ctx.fill();
        ctx.fillStyle = '#7fb48a'; rrect(ctx, cx - 12, yb - 34, 24, 26, 4); ctx.fill();
        ctx.strokeStyle = '#4f7a58'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = '#9fd0a8'; ellipse(ctx, cx, yb - 35, 13, 4.5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `800 7px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('ゴミ', cx, yb - 22);
        const fr = f.fill / TRASH_CAP;
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(cx - 9, yb - 15, 18, 4);
        ctx.fillStyle = fr >= 1 ? '#ff6a5a' : fr > 0.6 ? '#ffc24a' : '#e8f8e0';
        ctx.fillRect(cx - 9, yb - 15, 18 * Math.min(1, fr), 4);
        if (fr >= 1) {
          ctx.fillStyle = '#f6f2ea'; ellipse(ctx, cx - 4, yb - 39, 5, 3.5); ctx.fill(); ellipse(ctx, cx + 5, yb - 40, 4, 3); ctx.fill();
        }
        break;
      }
      case 'umbrella': {
        const cx = x + T / 2;
        const n = Math.min(5, f.umb);
        for (let i = 0; i < n; i++) {
          const ux = cx - 8 + i * 4;
          ctx.strokeStyle = UMB_COLORS[i % UMB_COLORS.length]; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(ux, yb - 16); ctx.lineTo(ux + (i - 2) * 1.5, yb - 40); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(60,40,30,0.16)'; ellipse(ctx, cx + 2, yb - 8, 12, 4); ctx.fill();
        ctx.fillStyle = '#7d9cc8'; rrect(ctx, cx - 10, yb - 26, 20, 18, 3); ctx.fill();
        ctx.strokeStyle = '#4f6a92'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = '#a6c0e4'; ellipse(ctx, cx, yb - 26, 10, 3.5); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `700 9px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('☂', cx, yb - 16);
        break;
      }
      case 'survey': {
        const cx = x + T / 2;
        ctx.fillStyle = '#8a6040';
        ctx.fillRect(cx - 12, yb - 14, 3, 14); ctx.fillRect(cx + 9, yb - 14, 3, 14);
        this.box(ctx, cx - 15, yb - 12, 30, 6, 14, '#c99566', '#e3b98a');
        ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = 'rgba(80,60,50,0.4)'; ctx.lineWidth = 1;
        ctx.save(); ctx.translate(cx - 7, yb - 25); ctx.rotate(-0.12);
        ctx.fillRect(-6, -4, 12, 8); ctx.strokeRect(-6, -4, 12, 8);
        ctx.strokeStyle = 'rgba(120,140,200,0.6)';
        for (let i = -2; i <= 2; i += 2) { ctx.beginPath(); ctx.moveTo(-4, i); ctx.lineTo(4, i); ctx.stroke(); }
        ctx.restore();
        ctx.strokeStyle = '#ff8fa3'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - 3, yb - 22); ctx.lineTo(cx + 1, yb - 30); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#d9a0a8'; ctx.lineWidth = 1;
        rrect(ctx, cx + 1, yb - 38, 12, 14, 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5a4a48'; ctx.fillRect(cx + 3.5, yb - 36, 7, 1.6);
        ctx.fillStyle = '#ff6f8a'; ctx.font = `800 5px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('ご意見', cx + 7, yb - 29);
        if (G.survey.unread) {
          const bx = cx + 12, by = yb - 46;
          ctx.fillStyle = '#ff5f6a'; ellipse(ctx, bx, by, 7, 7); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.font = `900 8px ${FONT}`; ctx.fillText(String(G.survey.unread), bx, by + 0.5);
        }
        break;
      }
      case 'plant': {
        const cx = x + T / 2;
        ctx.fillStyle = 'rgba(60,40,30,0.16)'; ellipse(ctx, cx + 2, yb - 8, 12, 4); ctx.fill();
        const g = ['#5fae5a', '#78c46d', '#4e9c4c'];
        [[-10, -36, -0.6], [10, -38, 0.6], [0, -46, 0], [-6, -48, -0.3], [7, -50, 0.3]].forEach(([dx, dy, r], i) => {
          ctx.fillStyle = g[i % 3]; ellipse(ctx, cx + dx, yb + dy, 6, 13, r); ctx.fill();
        });
        ctx.fillStyle = '#d07a4a';
        ctx.beginPath(); ctx.moveTo(cx - 11, yb - 28); ctx.lineTo(cx + 11, yb - 28); ctx.lineTo(cx + 8, yb - 8); ctx.lineTo(cx - 8, yb - 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8956a'; ctx.fillRect(cx - 12, yb - 30, 24, 4);
        break;
      }
    }
    if (hi) {
      ctx.strokeStyle = 'rgba(255,200,40,0.9)'; ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]); ctx.lineDashOffset = -R.t * 20;
      const top = VIS_H[f.type] || 50;
      rrect(ctx, x - 1, yb - top - 3, w + 2, top + 4, 6); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  },
  drawSign(ctx, s, H) {
    const cx = s.x * T + T / 2, yb = (H + 1.9) * T;
    ctx.fillStyle = 'rgba(40,30,20,0.18)'; ellipse(ctx, cx, yb, 30, 5); ctx.fill();
    ctx.fillStyle = '#8a6040';
    ctx.fillRect(cx - 26, yb - 24, 4, 24); ctx.fillRect(cx + 22, yb - 24, 4, 24);
    const bw = 76, bh = 31, bx = cx - bw / 2, by = yb - 24 - bh;
    ctx.fillStyle = '#6e4a30'; rrect(ctx, bx - 3, by - 3, bw + 6, bh + 6, 4); ctx.fill();
    const pic = G.pics[s.design];
    const img = pic ? Pics.get('pic:' + s.design, pic.data) : null;
    if (img) ctx.drawImage(img, bx, by, bw, bh);
    else { ctx.fillStyle = '#fff8e8'; ctx.fillRect(bx, by, bw, bh); }
  },

  /* ------------------------------ 猫 ------------------------------ */
  drawPlayer(ctx, p) {
    const x = p.x * T, y = p.y * T;
    ctx.strokeStyle = 'rgba(255,143,163,0.9)'; ctx.lineWidth = 2;
    ellipse(ctx, x, y, 14, 5); ctx.stroke();
    drawAnimal(ctx, x, y, p.look, { dir: p.dir, t: p.t, walk: p.walk, moving: p.moving, box: p.carry ? p.carry.pid : null });
    if (p.carry) {
      ctx.font = `800 9px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(40,30,30,0.7)'; rrect(ctx, x + 8, y - 26, 18, 11, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText('×' + p.carry.n, x + 17, y - 20.5);
    }
  },
  drawCustomer(ctx, c) {
    const x = c.x * T, y = c.y * T;
    const out = c.y >= Shop.H + 0.6;
    const o = {
      dir: c.dir, t: c.t, walk: c.walk, moving: c.moving,
      basket: c.basket.length ? c.basket.map((b) => b.pid) : null,
      umbrella: c.umb && out ? c.umb : null,
      umbClosed: c.umb && !out && c.standUid == null && c.state !== 'put' ? c.umb : null,
      eat: c.eating, spin: c.slipT > 0 ? 0.9 - c.slipT : 0,
      happy: c.happy > 0 || c.state === 'eat', sad: c.angry, open: c.state === 'eat' && Math.sin(c.t * 10) > 0,
    };
    drawAnimal(ctx, x, y, c.look, o);
  },

  /* ------------------------------ ふきだし ------------------------------ */
  bubble(ctx, x, y, text, icon, warn) {
    ctx.font = `700 10px ${FONT}`;
    const tw = ctx.measureText(text).width + (icon ? 15 : 0);
    const w = Math.max(22, tw + 12), h = 18;
    ctx.fillStyle = warn ? '#fff0ec' : '#fffdf8';
    ctx.strokeStyle = warn ? '#e0705a' : 'rgba(90,70,70,0.55)'; ctx.lineWidth = 1.2;
    rrect(ctx, x - w / 2, y - h, w, h, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 4, y - 0.5); ctx.lineTo(x, y + 5); ctx.lineTo(x + 4, y - 0.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x + 4, y); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    let tx = x - tw / 2;
    if (icon) {
      ctx.font = `12px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(icon, tx, y - h / 2 + 1);
      tx += 15;
      ctx.font = `700 10px ${FONT}`;
    }
    ctx.fillStyle = warn ? '#b0402a' : '#4a3a3a';
    ctx.fillText(text, tx, y - h / 2 + 0.5);
  },
  drawBubbles(ctx) {
    for (const c of R.cats) {
      const x = c.x * T, y = c.y * T - 46 * (c.look.size || 1);
      if (c.bubble) {
        const b = c.bubble;
        ctx.globalAlpha = clamp(b.t * 4, 0, 1);
        this.bubble(ctx, x, y, b.text, b.icon, c.angry);
        ctx.globalAlpha = 1;
      }
      if (c.state === 'queue' && c.patience < 18) {
        const fr = clamp(c.patience / 18, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 12, y + 4, 24, 4);
        ctx.fillStyle = fr > 0.5 ? '#8fd17a' : fr > 0.25 ? '#ffc24a' : '#ff6a5a';
        ctx.fillRect(x - 12, y + 4, 24 * fr, 4);
      }
    }
    /* レジ待ちのお知らせ */
    const reg = Shop.register();
    if (reg && R.queue.length && !R.atRegister) {
      const x = (reg.x + 0.5) * T, y = reg.y * T - 38 - Math.abs(Math.sin(R.t * 5)) * 5;
      ctx.fillStyle = '#ff5f6a';
      ellipse(ctx, x, y, 10, 10); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `900 13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', x, y + 1);
    }
  },
  drawGuide(ctx, sel) {
    const g = Missions.guide();
    if (g && (!sel || sel.f !== g)) {
      const d = FURN[g.type];
      const x = (g.x + d.w / 2) * T, y = g.y * T - 34 - Math.abs(Math.sin(R.t * 4)) * 8;
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a07000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 10, y - 14); ctx.lineTo(x + 10, y - 14); ctx.lineTo(x, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(x - 4, y - 24, 8, 11); ctx.strokeRect(x - 4, y - 24, 8, 11);
    }
    /* 近くの物で何ができるか */
    if (sel && !UI.touch) {
      const label = Interact.label(sel);
      if (label) {
        const d = FURN[sel.f.type];
        ctx.font = `800 10px ${FONT}`;
        const text = 'スペース: ' + label;
        const w = ctx.measureText(text).width + 14;
        const reg = sel.kind === 'register';
        const x = reg ? (sel.f.x + d.w) * T + w / 2 + 4 : (sel.f.x + d.w / 2) * T;
        const y = reg ? sel.f.y * T + 4 : (sel.f.y + d.h) * T - (VIS_H[sel.f.type] || 50) - 6;
        ctx.fillStyle = 'rgba(40,30,40,0.82)';
        rrect(ctx, x - w / 2, y - 16, w, 16, 8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y - 7.5);
      }
    }
    const p = R.player;
    if (p.path && p.path.length) {
      const e = p.path[p.path.length - 1];
      ctx.strokeStyle = 'rgba(255,143,163,0.8)'; ctx.lineWidth = 2;
      ellipse(ctx, e.x * T, e.y * T, 8 + Math.sin(R.t * 8) * 1.5, 3.5); ctx.stroke();
    }
  },

  /* ------------------------------ 雨・演出・夕方 ------------------------------ */
  drawRain(ctx, W, H) {
    const v = this.view;
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x0 * T, v.y0 * T, (v.x1 - v.x0) * T, (v.y1 - v.y0) * T);
    ctx.rect((W + 0.35) * T, -2 * T, -(W + 0.7) * T, (H + 1) * T + 2 * T);
    ctx.clip('evenodd');
    ctx.strokeStyle = 'rgba(200,220,255,0.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    const n = 140;
    for (let i = 0; i < n; i++) {
      const sx = (hash2(i, 1) * (v.x1 - v.x0) + v.x0) * T;
      const span = (v.y1 - v.y0) * T;
      const sy = v.y0 * T + ((hash2(i, 2) * span + R.t * 520) % span);
      ctx.moveTo(sx, sy); ctx.lineTo(sx - 3, sy + 11);
    }
    ctx.stroke();
    ctx.restore();
  },
  drawFx(ctx) {
    for (const f of R.fx) {
      if (f.t < 0) continue;
      const a = 1 - f.t / f.life;
      if (f.k === 'text') {
        ctx.globalAlpha = clamp(a * 2, 0, 1);
        ctx.font = `900 13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,40,30,0.8)';
        const y = (f.y - f.t * 0.8) * T;
        ctx.strokeText(f.text, f.x * T, y);
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x * T, y);
      } else if (f.k === 'coin') {
        ctx.globalAlpha = clamp(a * 2, 0, 1);
        ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#b08a00'; ctx.lineWidth = 1;
        ellipse(ctx, f.x * T, f.y * T, 4 * Math.abs(Math.cos(f.t * 12)) + 1, 4); ctx.fill(); ctx.stroke();
      } else if (f.k === 'fly') {
        const k = clamp(f.t / f.life, 0, 1);
        const x = lerp(f.x0, f.x1, k) * T, y = lerp(f.y0, f.y1, k) * T - Math.sin(k * Math.PI) * 18;
        ProdArt.draw(ctx, f.pid, x, y, 14);
      } else if (f.k === 'spark') {
        ctx.globalAlpha = a;
        ctx.fillStyle = '#fff6a0';
        const x = f.x * T, y = (f.y - f.t * 0.5) * T, r = 3 + a * 2;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); }
        ctx.closePath(); ctx.fill();
      } else if (f.k === 'heart') {
        ctx.globalAlpha = a;
        const x = f.x * T, y = (f.y - f.t * 0.7) * T, s = 6;
        ctx.fillStyle = '#ff6f91';
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.9);
        ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4);
        ctx.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  },
  drawTint(ctx) {
    let col = null, a = 0;
    if (G.phase === 'summary') { col = '30,30,80'; a = 0.28; }
    else if (G.clock > 16 * 60) { col = '255,140,60'; a = clamp((G.clock - 16 * 60) / 120, 0, 1) * 0.14; }
    if (!a) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(${col},${a})`;
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.restore();
  },
};
