/* =========================================================================
   WILD INN ― 描画
   カメラ / 床とかべ (階ごとに絵を作っておく) / 家具と動物と人 / ふきだし / 演出
   ========================================================================= */
'use strict';

const FONT = '"Hiragino Maru Gothic ProN","Hiragino Sans","BIZ UDPGothic","Yu Gothic","Meiryo",sans-serif';
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const T = TILE;
const CACHE_PX = 1.5;   // 床の絵は 1マス 60px で作っておく

const Render = {
  cv: null, ctx: null, dpr: 1, cw: 0, ch: 0,
  cam: { px: 40, ox: 0, oy: 0, cx: 0, cy: 0, follow: false },
  bg: null, bgKey: '',

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
  floor() { return Editor.active ? Editor.floor : R.viewFloor; },
  bounds(f) {
    const W = Hotel.W, H = Hotel.H;
    return { x0: -0.7, x1: W + 0.7, y0: -0.9, y1: f === 0 ? H + 2.4 : H + 0.7 };
  },
  /* 建物が全部入るように拡大率を決める。小さすぎるときはオーナー (もようがえ中は見ている所) を追いかける */
  fit(dt) {
    if (!G) return;
    const m = UI.margins();
    const b = this.bounds(this.floor());
    const aw = this.cw - 12, ah = this.ch - m.top - m.bottom - 6;
    let px = Math.min(aw / (b.x1 - b.x0), ah / (b.y1 - b.y0), 64);
    const minPx = this.cw < 600 ? 30 : 26;
    const cam = this.cam;
    cam.follow = px < minPx;
    if (cam.follow) px = minPx;
    cam.px = px;
    let cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    if (cam.follow) {
      const fo = Editor.active ? Editor.focus : R.player;
      const vw = aw / px, vh = ah / px;
      if (vw < b.x1 - b.x0) cx = clamp(fo.x, b.x0 + vw / 2, b.x1 - vw / 2);
      if (vh < b.y1 - b.y0) cy = clamp(fo.y - 0.5, b.y0 + vh / 2, b.y1 - vh / 2);
    }
    const k = dt ? Math.min(1, dt * 7) : 1;
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
    if (!G) return;
    const f = this.floor();
    ctx.fillStyle = f === 0 ? '#bfe0a4' : '#bfe4f6';
    ctx.fillRect(0, 0, this.cw, this.ch);
    const k = this.cam.px / T;
    ctx.setTransform(d * k, 0, 0, d * k, d * this.cam.ox, d * this.cam.oy);
    this.view = {
      x0: (-this.cam.ox / this.cam.px) - 1, x1: ((this.cw - this.cam.ox) / this.cam.px) + 1,
      y0: (-this.cam.oy / this.cam.px) - 1, y1: ((this.ch - this.cam.oy) / this.cam.px) + 1,
    };
    this.drawSurround(ctx, f);
    this.drawBase(ctx, f);

    const ents = [];
    for (const fu of G.furn) if (fu.floor === f && !FURN[fu.type].flat) ents.push({ y: fu.y + FURN[fu.type].h - 0.01, fu });
    if (f === 0) { const c = Hotel.counter(); ents.push({ y: c.y + 0.99, counter: true }); }
    for (const p of R.pets) if (p.floor === f) ents.push({ y: p.y, pet: p });
    for (const v of R.visitors) if (v.floor === f) ents.push({ y: v.y, v });
    if (R.player.floor === f) ents.push({ y: R.player.y, me: true });
    ents.sort((a, b) => a.y - b.y);
    const tgt = Editor.active ? null : Interact.target();
    for (const e of ents) {
      if (e.fu) {
        const ghost = Editor.active && Editor.dragging(e.fu);
        if (ghost) ctx.globalAlpha = 0.3;
        FurnArt.draw(ctx, e.fu.type, e.fu.x * T, e.fu.y * T, R.t);
        ctx.globalAlpha = 1;
      } else if (e.counter) this.drawCounter(ctx);
      else if (e.pet) this.drawPetE(ctx, e.pet, tgt && tgt.pet === e.pet);
      else if (e.v) drawPerson(ctx, e.v.x * T, e.v.y * T, e.v.look, e.v.pose());
      else if (e.me) this.drawPlayer(ctx);
    }
    this.drawLabels(ctx, f);
    if (!Editor.active) {
      this.drawBubbles(ctx, f);
      this.drawGuide(ctx, f, tgt);
    } else Editor.drawOverlay(ctx);
    this.drawFx(ctx, f);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    this.drawTint(ctx);
  },

  /* ------------------------------ 建物のまわり ------------------------------ */
  drawSurround(ctx, f) {
    const v = this.view, W = Hotel.W, H = Hotel.H;
    if (f === 0) {
      ctx.fillStyle = 'rgba(120,170,90,0.25)';
      for (let y = Math.floor(v.y0); y < v.y1; y++) {
        for (let x = Math.floor(v.x0); x < v.x1; x++) {
          if (hash2(x, y) < 0.5) continue;
          const px = x * T + hash2(x, y + 9) * 34 + 3, py = y * T + hash2(x + 3, y) * 34 + 3;
          ctx.fillRect(px, py, 2, 5); ctx.fillRect(px + 3, py + 1, 2, 4);
        }
      }
      for (let x = Math.floor(v.x0); x < v.x1; x++) {
        if (x >= -1 && x <= W) continue;
        for (let y = Math.floor(v.y0); y < H; y++) if (hash2(x * 5, y * 3) > 0.84) this.drawBush(ctx, x * T + 20, y * T + 26, hash2(x, y));
      }
      for (let x = 1; x < W; x += 4) this.drawBush(ctx, x * T + 20, -0.45 * T, hash2(x, 77));
      /* 歩道と車道 */
      ctx.fillStyle = '#e3dccf'; ctx.fillRect(v.x0 * T, H * T, (v.x1 - v.x0) * T, 2 * T);
      ctx.strokeStyle = 'rgba(150,140,125,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = Math.floor(v.x0); x < v.x1; x++) { ctx.moveTo(x * T, H * T); ctx.lineTo(x * T, (H + 2) * T); }
      ctx.moveTo(v.x0 * T, (H + 1) * T); ctx.lineTo(v.x1 * T, (H + 1) * T);
      ctx.stroke();
      ctx.fillStyle = '#b9b4ac'; ctx.fillRect(v.x0 * T, (H + 2) * T - 3, (v.x1 - v.x0) * T, 6);
      ctx.fillStyle = '#7d8290'; ctx.fillRect(v.x0 * T, (H + 2) * T + 3, (v.x1 - v.x0) * T, Math.max(2, v.y1 - H - 2) * T);
      ctx.fillStyle = '#f4f1e8';
      for (let x = Math.floor(v.x0 / 2) * 2; x < v.x1; x += 2) ctx.fillRect(x * T + 10, (H + 3.3) * T, T - 6, 4);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 9; i++) {
        const cx = (hash2(i, f) * (W + 12) - 6) * T + Math.sin(R.t * 0.1 + i) * 20, cy = (hash2(i, f + 5) * (H + 8) - 4) * T;
        for (const [dx, dy, r] of [[0, 0, 26], [24, 6, 20], [-22, 8, 18], [6, 14, 22]]) { ellipse(ctx, cx + dx, cy + dy, r, r * 0.7); ctx.fill(); }
      }
    }
  },
  drawBush(ctx, cx, cy, h) {
    ctx.fillStyle = 'rgba(40,70,30,0.15)'; ellipse(ctx, cx, cy + 9, 15, 5); ctx.fill();
    ctx.fillStyle = '#7cc46d'; ellipse(ctx, cx, cy, 15, 11); ctx.fill();
    ctx.fillStyle = '#93d281'; ellipse(ctx, cx - 4, cy - 3, 8, 6); ctx.fill();
    if (h > 0.5) { ctx.fillStyle = '#ff9fb8'; ellipse(ctx, cx + 6, cy - 2, 2.5, 2.5); ctx.fill(); }
  },

  /* ------------------------------ 床とかべ (止まっている絵) ------------------------------ */
  drawBase(ctx, f) {
    const key = [R.layoutV, f, G.lv, G.floors].join(',');
    if (key !== this.bgKey || !this.bg) { this.bg = this.buildBase(f); this.bgKey = key; }
    const W = Hotel.W, H = Hotel.H;
    ctx.drawImage(this.bg, -0.5 * T, -0.5 * T, (W + 1) * T, (H + 1) * T);
  },
  buildBase(f) {
    const W = Hotel.W, H = Hotel.H;
    const c = document.createElement('canvas');
    c.width = Math.ceil((W + 1) * T * CACHE_PX); c.height = Math.ceil((H + 1) * T * CACHE_PX);
    const ctx = c.getContext('2d');
    ctx.scale(CACHE_PX, CACHE_PX);
    ctx.translate(0.5 * T, 0.5 * T);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    /* 建物の外かべの影 */
    ctx.fillStyle = 'rgba(40,40,30,0.22)'; ctx.fillRect(-4, 2, W * T + 12, H * T + 6);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const r = Hotel.roomAt(f, x, y);
        this.tile(ctx, r ? r.hab : 'hall', x, y, f);
      }
    }
    for (const fu of G.furn) if (fu.floor === f && FURN[fu.type].flat) FurnArt.draw(ctx, fu.type, fu.x * T, fu.y * T, 0);
    if (f === 0) this.drawLobbyFloor(ctx);
    if (G.floors > 1) this.drawStairs(ctx, f);
    else this.drawStairsPlan(ctx);
    for (const r of G.rooms) if (r.floor === f) this.drawRoomWalls(ctx, r);
    this.drawOuterWall(ctx, f);
    return c;
  },
  tile(ctx, kind, x, y, f) {
    const X = x * T, Y = y * T, h = hash2(x, y), h2 = hash2(x + 31, y * 7);
    if (kind === 'hall') {
      ctx.fillStyle = (x + y) % 2 ? (f === 0 ? '#f3ead9' : '#ede5f2') : (f === 0 ? '#ebdfc9' : '#e3d9ec');
      ctx.fillRect(X, Y, T, T);
      return;
    }
    const H = HABITATS[kind];
    ctx.fillStyle = H.floor; ctx.fillRect(X, Y, T, T);
    if (kind === 'town') {
      ctx.fillStyle = y % 2 ? 'rgba(160,110,60,0.10)' : 'rgba(255,255,255,0.08)'; ctx.fillRect(X, Y, T, T);
      ctx.strokeStyle = 'rgba(140,95,50,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X, Y + 0.5); ctx.lineTo(X + T, Y + 0.5);
      const sx = X + ((x * 17 + y * 23) % 3) * 13 + 6; ctx.moveTo(sx, Y); ctx.lineTo(sx, Y + T); ctx.stroke();
    } else if (kind === 'jungle') {
      ctx.fillStyle = 'rgba(30,80,30,0.25)'; ellipse(ctx, X + h * T, Y + h2 * T, 9, 6); ctx.fill();
      ctx.fillStyle = 'rgba(140,200,110,0.45)';
      for (let i = 0; i < 3; i++) { ellipse(ctx, X + hash2(x + i, y) * T, Y + hash2(x, y + i) * T, 4, 2, h * 3 + i); ctx.fill(); }
      if (h > 0.8) { ctx.fillStyle = '#ffd25e'; ellipse(ctx, X + 20, Y + 18, 2, 2); ctx.fill(); }
    } else if (kind === 'savanna') {
      ctx.strokeStyle = 'rgba(150,120,40,0.45)'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const gx = X + hash2(x * 3 + i, y) * 34 + 3, gy = Y + hash2(x, y * 3 + i) * 30 + 8;
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 2, gy - 6); ctx.moveTo(gx, gy); ctx.lineTo(gx + 2, gy - 7); ctx.stroke();
      }
      if (h > 0.7) { ctx.fillStyle = 'rgba(180,140,80,0.3)'; ellipse(ctx, X + h2 * T, Y + h * T, 10, 6); ctx.fill(); }
    } else if (kind === 'desert') {
      ctx.strokeStyle = 'rgba(200,150,80,0.4)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 2; i++) {
        const yy = Y + 12 + i * 15 + h * 4;
        ctx.beginPath(); ctx.moveTo(X, yy); ctx.quadraticCurveTo(X + 20, yy - 6, X + T, yy); ctx.stroke();
      }
      if (h > 0.85) { ctx.fillStyle = '#c9a070'; ellipse(ctx, X + 10 + h2 * 20, Y + 24, 3, 2); ctx.fill(); }
    } else if (kind === 'polar') {
      ctx.fillStyle = 'rgba(150,200,235,0.35)'; ellipse(ctx, X + h * T, Y + h2 * T, 12, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 3; i++) { ellipse(ctx, X + hash2(x + i * 3, y) * T, Y + hash2(x, y + i * 5) * T, 1.6, 1.6); ctx.fill(); }
    }
  },
  drawLobbyFloor(ctx) {
    const H = Hotel.H, e = Hotel.ent();
    ctx.fillStyle = '#b0605a';
    rrect(ctx, e.x * T + 5, e.y * T + 14, T - 10, T - 18, 4); ctx.fill();
    ctx.strokeStyle = '#d98a7f'; ctx.lineWidth = 2;
    rrect(ctx, e.x * T + 9, e.y * T + 18, T - 18, T - 26, 3); ctx.stroke();
    /* お客さんの立つ所 */
    const cs = Hotel.custSpot();
    ctx.strokeStyle = 'rgba(200,120,90,0.45)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2;
    ellipse(ctx, cs.x * T + 20, cs.y * T + 26, 13, 6); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(180,110,80,0.35)'; ctx.font = `800 9px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('LOBBY', 2 * T, (H - 0.15) * T);
  },
  drawStairs(ctx, f) {
    const s = Hotel.stairs(), X = s.x * T, Y = s.y * T, w = s.w * T, h = s.h * T;
    ctx.fillStyle = '#c9b49a'; ctx.fillRect(X + 2, Y + 2, w - 4, h - 4);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? '#e8d8c0' : '#dcc8ac';
      ctx.fillRect(X + 4, Y + 4 + i * ((h - 8) / 7), w - 8, (h - 8) / 7);
      ctx.fillStyle = 'rgba(90,60,30,0.25)';
      ctx.fillRect(X + 4, Y + 4 + (i + 1) * ((h - 8) / 7) - 2, w - 8, 2);
    }
    ctx.fillStyle = '#8a6a4a'; ctx.fillRect(X + 2, Y + 2, 4, h - 4); ctx.fillRect(X + w - 6, Y + 2, 4, h - 4);
    ctx.fillStyle = 'rgba(80,60,40,0.85)'; ctx.font = `900 12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const up = f < G.floors - 1, down = f > 0;
    ctx.fillText(up && down ? '▲▼' : up ? '▲ 上へ' : '▼ 下へ', X + w / 2, Y + h / 2);
    ctx.textBaseline = 'alphabetic';
  },
  drawStairsPlan(ctx) {
    const s = Hotel.stairs();
    ctx.strokeStyle = 'rgba(150,130,110,0.35)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5;
    ctx.strokeRect(s.x * T + 4, s.y * T + 4, s.w * T - 8, s.h * T - 8);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(150,130,110,0.6)'; ctx.font = `800 9px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('階段よてい地', (s.x + s.w / 2) * T, (s.y + s.h / 2) * T + 3);
  },
  /* かべ: 部屋のふちの線 (ドアの所だけあける) */
  drawRoomWalls(ctx, r) {
    const H = HABITATS[r.hab], X0 = r.x * T, Y0 = r.y * T, X1 = (r.x + r.w) * T, Y1 = (r.y + r.h) * T;
    ctx.fillStyle = 'rgba(30,20,10,0.16)';
    ctx.fillRect(X0, Y0, X1 - X0, 6); ctx.fillRect(X0, Y0, 6, Y1 - Y0);
    const t = Hotel.doorTiles(r), d = r.door;
    const segs = [];
    const side = (s, x0, y0, x1, y1, n) => {
      for (let i = 0; i < n; i++) {
        if (d.side === s && d.k === i) continue;
        const a = i / n, b = (i + 1) / n;
        segs.push([lerp(x0, x1, a), lerp(y0, y1, a), lerp(x0, x1, b), lerp(y0, y1, b)]);
      }
    };
    side('n', X0, Y0, X1, Y0, r.w); side('s', X0, Y1, X1, Y1, r.w);
    side('w', X0, Y0, X0, Y1, r.h); side('e', X1, Y0, X1, Y1, r.h);
    for (const [lw, col] of [[9, H.trim], [5.5, H.wall]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'square';
      ctx.beginPath();
      for (const s of segs) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
      ctx.stroke();
    }
    /* ドア: わくと、ひらいたとびら */
    const ix = t.in.x * T, iy = t.in.y * T;
    ctx.fillStyle = H.trim;
    const post = (x, y) => { ctx.fillRect(x - 4, y - 4, 8, 8); };
    if (d.side === 's' || d.side === 'n') {
      const yy = d.side === 's' ? Y1 : Y0;
      post(ix, yy); post(ix + T, yy);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(ix + 4, yy - 2, T - 8, 4);
    } else {
      const xx = d.side === 'e' ? X1 : X0;
      post(xx, iy); post(xx, iy + T);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(xx - 2, iy + 4, 4, T - 8);
    }
  },
  drawOuterWall(ctx, f) {
    const W = Hotel.W, H = Hotel.H, e = Hotel.ent();
    ctx.lineCap = 'square';
    for (const [lw, col] of [[13, '#6a5040'], [8, '#a8876a']]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath();
      if (f === 0) {
        ctx.moveTo(e.x * T, H * T); ctx.lineTo(0, H * T); ctx.lineTo(0, 0); ctx.lineTo(W * T, 0); ctx.lineTo(W * T, H * T); ctx.lineTo((e.x + 1) * T, H * T);
      } else ctx.rect(0, 0, W * T, H * T);
      ctx.stroke();
    }
    if (f === 0) {
      ctx.fillStyle = '#6a5040';
      ctx.fillRect(e.x * T - 6, H * T - 6, 6, 12); ctx.fillRect((e.x + 1) * T, H * T - 6, 6, 12);
      ctx.fillStyle = '#ffe9a8'; ctx.font = `900 10px ${FONT}`; ctx.textAlign = 'center';
    }
  },

  /* ------------------------------ 受付 ------------------------------ */
  drawCounter(ctx) {
    const c = Hotel.counter(), X = c.x * T, Y = c.y * T, w = c.w * T;
    ctx.fillStyle = 'rgba(40,30,20,0.2)'; ctx.fillRect(X + 2, Y + 30, w - 2, 8);
    rrect(ctx, X, Y + 6, w, 30, 5); fs(ctx, '#b07a4a', '#6a4424');
    rrect(ctx, X - 2, Y - 2, w + 4, 14, 4); fs(ctx, '#d9a46a', '#6a4424');
    ctx.fillStyle = '#ffe9b8'; rrect(ctx, X + w / 2 - 22, Y + 16, 44, 13, 4); ctx.fill();
    ctx.fillStyle = '#8a5a2a'; ctx.font = `900 9px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('うけつけ', X + w / 2, Y + 22.5);
    ctx.textBaseline = 'alphabetic';
    /* 呼びりん */
    ctx.fillStyle = '#e8c040'; ellipse(ctx, X + 16, Y + 4, 6, 3.5); ctx.fill();
    ctx.beginPath(); ctx.arc(X + 16, Y + 4, 5, Math.PI, TAU); ctx.fillStyle = '#f2d25e'; ctx.fill();
    /* 電話 (鳴っているとふるえる) */
    const ring = R.call ? Math.sin(R.t * 40) * 1.6 : 0;
    ctx.save(); ctx.translate(X + w - 22 + ring, Y + 3);
    rrect(ctx, -9, -5, 18, 11, 3); fs(ctx, '#e0504a', '#9a2a24');
    rrect(ctx, -10, -9, 20, 5, 2.5); fs(ctx, '#f06a5a', '#9a2a24');
    ctx.restore();
    if (R.call) {
      ctx.strokeStyle = 'rgba(224,80,74,0.8)'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(X + w - 22, Y + 1, 12 + i * 5 + (R.t * 10 % 5), -2.4, -0.7); ctx.stroke(); }
    }
    /* 予約のノート */
    ctx.fillStyle = '#fff'; ctx.save(); ctx.translate(X + w / 2, Y + 3); ctx.rotate(-0.1);
    ctx.fillRect(-9, -5, 18, 10); ctx.strokeStyle = '#9ac'; ctx.lineWidth = 0.8; ctx.strokeRect(-9, -5, 18, 10);
    ctx.restore();
  },

  /* ------------------------------ 動物と人 ------------------------------ */
  drawPetE(ctx, p, sel) {
    if (sel) {
      ctx.strokeStyle = 'rgba(255,190,40,0.9)'; ctx.lineWidth = 2.5;
      ellipse(ctx, p.x * T, p.y * T, (SHADOW[p.sp] || 12) + 5, 6); ctx.stroke();
    }
    drawPet(ctx, p.x * T, p.y * T, p.look, p.pose());
  },
  drawPlayer(ctx) {
    const p = R.player;
    ctx.fillStyle = 'rgba(255,210,70,0.35)'; ellipse(ctx, p.x * T, p.y * T, 13, 5); ctx.fill();
    drawPerson(ctx, p.x * T, p.y * T, p.look, { dir: p.dir, t: R.t, walk: p.walk, moving: p.moving });
  },

  /* 部屋の名札 */
  drawLabels(ctx, f) {
    ctx.font = `800 10px ${FONT}`;
    ctx.textBaseline = 'middle';
    for (const r of G.rooms) {
      if (r.floor !== f) continue;
      const H = HABITATS[r.hab];
      const text = `${r.name}  ${Hotel.used(r)}/${Hotel.cap(r)}`;
      const w = ctx.measureText(text).width + 24, x = (r.x + r.w / 2) * T - w / 2, y = r.y * T - 8;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#fffaf3'; rrect(ctx, x, y, w, 16, 8); ctx.fill();
      ctx.strokeStyle = H.trim; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.font = `10px ${EMOJI}`; ctx.textAlign = 'left'; ctx.fillText(H.icon, x + 4, y + 8.5);
      ctx.font = `800 10px ${FONT}`; ctx.fillStyle = shade(H.trim, -0.3); ctx.fillText(text, x + 18, y + 8.5);
    }
    ctx.textBaseline = 'alphabetic';
  },

  /* ------------------------------ ふきだし ------------------------------ */
  bubble(ctx, x, y, icon, col = '#fff', pulse = 0) {
    const s = 1 + pulse * Math.sin(R.t * 6) * 0.08;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(80,60,50,0.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, -11, 10.5, 0, TAU); ctx.moveTo(-4, -2); ctx.lineTo(0, 4); ctx.lineTo(4, -2); ctx.fill(); ctx.stroke();
    ctx.font = `12px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#333'; ctx.fillText(icon, 0, -10.5);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  },
  drawBubbles(ctx, f) {
    for (const p of R.pets) {
      if (p.floor !== f) continue;
      const top = p.y * T - SPECIES[p.sp].h - 6;
      if (p.state === 'sleep') {
        ctx.fillStyle = 'rgba(90,90,160,0.8)'; ctx.font = `900 ${10 + Math.sin(R.t * 2) * 1.5}px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText('z', p.x * T + 8, top + 4 - (R.t * 6 % 6)); ctx.fillText('Z', p.x * T + 14, top - 4 - (R.t * 6 % 6));
        continue;
      }
      if (!p.g || p.mode !== 'room' || p.reactT > 0) continue;
      if (p.g.hunger < 25) this.bubble(ctx, p.x * T, top, '🍖', '#fff3e0', 1);
      else if (p.g.mood < 30) this.bubble(ctx, p.x * T, top, '💧', '#e8f2ff', 1);
      else if (p.g.mood > 80 && Math.sin(R.t * 0.8 + p.g.id) > 0.7) this.bubble(ctx, p.x * T, top, '♥️', '#fff0f3');
    }
    const v0 = Desk.front();
    for (const v of R.visitors) {
      if (v.floor !== f || v.state === 'leave') continue;
      const top = v.y * T - 48;
      if (v === v0) this.bubble(ctx, v.x * T, top, v.wait > PATIENCE * 0.65 ? '💢' : '🛎️', v.wait > PATIENCE * 0.65 ? '#ffe1df' : '#fff', 1);
      else if (v.state === 'wait' && v.wait > PATIENCE * 0.65) this.bubble(ctx, v.x * T, top, '💢', '#ffe1df');
    }
  },
  /* 受付に人が待っていたら、矢印で知らせる */
  drawGuide(ctx, f, tgt) {
    const v = Desk.front();
    if (!v || f !== 0 || (tgt && tgt.kind === 'desk')) return;
    const s = Hotel.staffSpot(), b = Math.sin(R.t * 5) * 4;
    ctx.fillStyle = '#ff6f8a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath();
    const x = s.x * T + 20, y = s.y * T - 6 + b;
    ctx.moveTo(x, y + 12); ctx.lineTo(x - 9, y); ctx.lineTo(x - 4, y); ctx.lineTo(x - 4, y - 10); ctx.lineTo(x + 4, y - 10); ctx.lineTo(x + 4, y); ctx.lineTo(x + 9, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
  },

  /* ------------------------------ 演出 ------------------------------ */
  drawFx(ctx, f) {
    for (const e of R.fx) {
      if (e.floor !== f) continue;
      const t = e.t - (e.delay || 0);
      if (t < 0) continue;
      const k = t / e.life, a = 1 - k;
      if (e.kind === 'heart') {
        ctx.globalAlpha = Math.min(1, a * 1.5);
        heartPath(ctx, (e.x + e.vx * t) * T, e.y * T - t * 30, 6 + k * 2);
        ctx.fillStyle = '#ff5f8a'; ctx.fill();
      } else if (e.kind === 'text') {
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.font = `900 ${e.big ? 15 : 12}px ${FONT}`; ctx.textAlign = 'center';
        ctx.lineWidth = 3.5; ctx.strokeStyle = '#fff';
        const y = e.y * T - t * 22;
        ctx.strokeText(e.text, e.x * T, y); ctx.fillStyle = e.col || '#333'; ctx.fillText(e.text, e.x * T, y);
      } else if (e.kind === 'spark') {
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffd23f';
        ellipse(ctx, (e.x + e.vx * t) * T, (e.y + e.vy * t) * T, 3 * a + 1, 3 * a + 1); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  },
  /* 夕方と夜の色、階段をのぼったときの暗転 */
  drawTint(ctx) {
    const c = G.clock;
    let col = null, a = 0;
    if (G.phase === 'night') { col = '20,30,80'; a = 0.35; }
    else if (c > 18.5 * 60) { col = '40,50,120'; a = 0.22 * clamp((c - 18.5 * 60) / 90, 0, 1); }
    else if (c > 16.5 * 60) { col = '255,140,60'; a = 0.12 * clamp((c - 16.5 * 60) / 60, 0, 1); }
    if (col && a > 0) { ctx.fillStyle = `rgba(${col},${a})`; ctx.fillRect(0, 0, this.cw, this.ch); }
    if (R.fade > 0) { ctx.fillStyle = `rgba(255,250,243,${clamp(R.fade / 0.35, 0, 1) * 0.85})`; ctx.fillRect(0, 0, this.cw, this.ch); }
  },
};
