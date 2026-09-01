/* =========================================================================
   MOKO GOD ― はじまりのえほん
   モコのお母さんが、子どもに読み聞かせるところから始まる。
   絵は、古い本の挿し絵ふうに描く。
   ========================================================================= */
'use strict';

const Book = {
  canvas: null, ctx: null, W: 760, H: 570,
  page: 0, t: 0, reveal: 0, onDone: null, running: false,

  init() {
    this.canvas = document.getElementById('bookCanvas');
    this.ctx = this.canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.W * dpr; this.canvas.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.canvas.addEventListener('click', () => this.advance());
    document.getElementById('bookText').addEventListener('click', () => this.advance());
    document.getElementById('btnNext').addEventListener('click', () => this.advance());
    document.getElementById('btnSkip').addEventListener('click', () => this.finish());
  },

  start(onDone) {
    this.onDone = onDone;
    this.page = 0; this.t = 0; this.reveal = 0; this.running = true;
    document.getElementById('bookScreen').classList.remove('hidden');
    this.render();
  },

  advance() {
    if (!this.running) return;
    const p = BOOK_PAGES[this.page];
    if (this.reveal < p.text.length) { this.reveal = p.text.length; this.render(); return; }
    this.page++;
    if (this.page >= BOOK_PAGES.length) { this.finish(); return; }
    this.reveal = 0;
    this.render();
  },

  finish() {
    if (!this.running) return;
    this.running = false;
    document.getElementById('bookScreen').classList.add('hidden');
    if (this.onDone) this.onDone();
  },

  update(dt) {
    if (!this.running) return;
    this.t += dt;
    const p = BOOK_PAGES[this.page];
    if (this.reveal < p.text.length) {
      this.reveal = Math.min(p.text.length, this.reveal + dt * 34);
      this.render();
    }
    this.draw();
  },

  render() {
    const p = BOOK_PAGES[this.page];
    const box = document.getElementById('bookText');
    const who = p.who ? `<span class="who">${p.who}</span>` : '';
    box.innerHTML = who + p.text.slice(0, Math.floor(this.reveal));
    const btn = document.getElementById('btnNext');
    btn.textContent = this.page >= BOOK_PAGES.length - 1 ? 'はじめる ▶' : 'つぎへ ▶';
  },

  /* ------------------------------- 絵 ------------------------------- */
  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    const art = BOOK_PAGES[this.page].art;
    if (art === 'room') this.drawRoom(ctx, W, H);
    else if (art === 'wake') this.drawWake(ctx, W, H);
    else this.drawPlate(ctx, W, H, art);
  },

  /* こモコに読み聞かせしている部屋 */
  drawRoom(ctx, W, H) {
    const t = this.t;
    const g = ctx.createRadialGradient(W * 0.5, H * 0.62, 40, W * 0.5, H * 0.6, W * 0.75);
    g.addColorStop(0, '#4a3620'); g.addColorStop(0.55, '#2a1c10'); g.addColorStop(1, '#140c06');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    /* 窓と星 */
    ctx.fillStyle = '#101a3a';
    ctx.beginPath(); ctx.roundRect(W * 0.06, H * 0.10, 150, 130, 12); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(W * 0.06, H * 0.10, 150, 130, 12); ctx.clip();
    for (let i = 0; i < 22; i++) {
      const sx = W * 0.06 + hash2(i, 1) * 150, sy = H * 0.10 + hash2(i, 2) * 130;
      ctx.globalAlpha = 0.4 + Math.sin(t * 2 + i) * 0.35;
      ctx.fillStyle = '#fff8d8';
      ctx.beginPath(); ctx.arc(sx, sy, 1.4, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f2e8c0';
    ctx.beginPath(); ctx.arc(W * 0.06 + 112, H * 0.10 + 36, 17, 0, TAU); ctx.fill();
    ctx.fillStyle = '#101a3a';
    ctx.beginPath(); ctx.arc(W * 0.06 + 104, H * 0.10 + 30, 15, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#5a3f24'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.roundRect(W * 0.06, H * 0.10, 150, 130, 12); ctx.stroke();

    /* ゆか */
    ctx.fillStyle = '#3a2814';
    ctx.fillRect(0, H * 0.74, W, H * 0.26);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo(0, H * 0.74 + i * 20); ctx.lineTo(W, H * 0.74 + i * 20); ctx.stroke();
    }

    /* ろうそく */
    const fx = W * 0.83, fy = H * 0.60;
    const fl = 12 + Math.sin(t * 9) * 3;
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(fx - 7, fy, 14, 42);
    ctx.fillStyle = '#ffb84a';
    ctx.beginPath(); ctx.ellipse(fx, fy - fl * 0.5, 6, fl, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff2b0';
    ctx.beginPath(); ctx.ellipse(fx, fy - fl * 0.4, 3, fl * 0.55, 0, 0, TAU); ctx.fill();
    R.glow(ctx, fx, fy - 10, 230, 'rgba(255,190,90,ALPHA)', 0.30);

    /* ママモコと、こモコふたり */
    const my = H * 0.585;
    R.drawMoko(ctx, W * 0.34, my, { s: 3.3, c1: '#ffc2dc', c2: '#e07fb0', eye: '#4a2f3a', wob: t * 0.9, face: 1 });
    /* えほん */
    ctx.save();
    ctx.translate(W * 0.34 + 56, my + 16); ctx.rotate(-0.16); ctx.scale(1.25, 1.25);
    ctx.fillStyle = '#f0e2bc';
    ctx.beginPath(); ctx.roundRect(-34, -24, 68, 44, 3); ctx.fill();
    ctx.fillStyle = '#c8b48a'; ctx.fillRect(-2, -24, 4, 44);
    ctx.strokeStyle = '#8a7048'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(-28, -14 + i * 9); ctx.lineTo(-8, -14 + i * 9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, -14 + i * 9); ctx.lineTo(28, -14 + i * 9); ctx.stroke();
    }
    /* 挿し絵のなかの、まっしろなモコ */
    R.drawMoko(ctx, 17, -6, { s: 0.5, c1: '#ffffff', c2: '#d8d0bc', eye: '#6a5a48', halo: true });
    ctx.restore();

    R.drawMoko(ctx, W * 0.57, my + 30, { s: 2.2, c1: '#ffd8e8', c2: '#f0a8c8', eye: '#4a2f3a', wob: t * 1.6 + 1, face: -1, blush: true });
    R.drawMoko(ctx, W * 0.70, my + 40, { s: 1.9, c1: '#fff0e0', c2: '#e8c0a8', eye: '#4a2f3a', wob: t * 1.4 + 2.4, face: -1, blush: true });

    /* まわりの暗がり */
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.6, W * 0.28, W * 0.5, H * 0.6, W * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.72)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  },

  /* えほんの中の挿し絵（古い本の版画ふう） */
  drawPlate(ctx, W, H, kind) {
    const t = this.t;
    const INK = '#4a331f', INK2 = '#6b5233', PAPER = '#efe0bd';
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);

    /* 紙のしみ */
    for (let i = 0; i < 260; i++) {
      const x = hash2(i, 11) * W, y = hash2(i, 12) * H;
      ctx.fillStyle = `rgba(120,90,50,${hash2(i, 13) * 0.12})`;
      ctx.beginPath(); ctx.arc(x, y, hash2(i, 14) * 2.4 + 0.4, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(150,110,60,.14)';
    ctx.beginPath(); ctx.ellipse(W * 0.86, H * 0.14, 90, 60, 0.4, 0, TAU); ctx.fill();

    /* かざり枠 */
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(33, 33, W - 66, H - 66);
    ctx.fillStyle = INK;
    for (const [cx, cy] of [[24, 24], [W - 24, 24], [24, H - 24], [W - 24, H - 24]]) {
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill();
    }

    ctx.save();
    ctx.beginPath(); ctx.rect(36, 36, W - 72, H - 72); ctx.clip();
    const cx = W / 2, gy = H * 0.40;

    /* ななめの線でつける影 */
    const hatch = (x, y, w, h, gap = 6, alpha = 0.18) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.strokeStyle = `rgba(74,51,31,${alpha})`; ctx.lineWidth = 1;
      for (let i = -h; i < w + h; i += gap) {
        ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke();
      }
      ctx.restore();
    };

    if (kind === 'plate_god') {
      hatch(36, 36, W - 72, H * 0.36, 7, 0.14);
      /* 雲 */
      ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
      for (const [x, y, r] of [[cx - 130, 190, 52], [cx - 60, 168, 66], [cx + 40, 176, 60], [cx + 130, 196, 48]]) {
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.62, 0, 0, TAU); ctx.fill(); ctx.stroke();
      }
      /* 光の筋 */
      ctx.strokeStyle = 'rgba(74,51,31,.4)'; ctx.lineWidth = 1.6;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(cx + i * 12, 205); ctx.lineTo(cx + i * 46, H - 60); ctx.stroke();
      }
      /* まっしろなモコ（神さま） */
      R.drawMoko(ctx, cx, 132, { s: 2.9, c1: '#fdf6e6', c2: '#cbb691', eye: INK, halo: true, wob: t });
      /* 見あげるモコたち */
      for (let i = 0; i < 5; i++) {
        const x = cx - 190 + i * 95, y = H - 84 + (i % 2) * 14;
        R.drawMoko(ctx, x, y, { s: 1.7, c1: '#dcc59c', c2: '#a88a5f', eye: INK, wob: t * 1.2 + i, face: i < 2 ? 1 : -1 });
      }
      ctx.fillStyle = INK2;
      ctx.fillRect(60, H - 62, W - 120, 4);
    }

    if (kind === 'plate_land') {
      /* 海 */
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      for (let r = 0; r < 5; r++) {
        ctx.beginPath();
        for (let x = 40; x < W - 40; x += 12) {
          const y = H * 0.66 + r * 22 + Math.sin(x * 0.05 + r + t * 0.6) * 5;
          x === 40 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      /* もりあがる丘 */
      ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(cx - 165, H * 0.72);
      ctx.bezierCurveTo(cx - 90, H * 0.40, cx + 90, H * 0.40, cx + 165, H * 0.72);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      hatch(cx - 165, H * 0.52, 330, H * 0.22, 8, 0.16);
      /* 草と木 */
      for (let i = 0; i < 9; i++) {
        const x = cx - 130 + i * 33, y = H * 0.70 - Math.cos((i - 4) * 0.38) * 42;
        ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 14); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y - 20, 9, 0, TAU); ctx.stroke();
      }
      /* 神さまの手（光） */
      ctx.strokeStyle = 'rgba(74,51,31,.45)'; ctx.lineWidth = 1.6;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath(); ctx.moveTo(cx + i * 9, 120); ctx.lineTo(cx + i * 40, H * 0.56); ctx.stroke();
      }
      R.drawMoko(ctx, cx, 96, { s: 2.2, c1: '#fdf6e6', c2: '#cbb691', eye: INK, halo: true, wob: t * 0.8 });
    }

    if (kind === 'plate_pray') {
      hatch(36, 36, W - 72, H - 72, 9, 0.10);
      const fy = H * 0.54;
      const fl = 76 + Math.sin(t * 6) * 8;

      /* 火のむこうがわのモコ */
      for (let i = 0; i < 3; i++) {
        const x = cx - 155 + i * 155, y = fy + 8 + (i === 1 ? -18 : 0);
        R.drawMoko(ctx, x, y, { s: 1.4, c1: '#dcc59c', c2: '#a88a5f', eye: INK, wob: t + i, face: x <= cx ? 1 : -1 });
      }

      /* けむり */
      ctx.strokeStyle = 'rgba(74,51,31,.45)'; ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const y = fy - fl - 10 - i * 15, x = cx + Math.sin(i * 0.9 + t) * 13;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();

      /* 炎 */
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(cx - 30, fy + 30);
      ctx.bezierCurveTo(cx - 42, fy - 8, cx - 16, fy - 26, cx - 7, fy - fl);
      ctx.bezierCurveTo(cx + 4, fy - fl * 0.56, cx + 24, fy - fl * 0.46, cx + 15, fy - 14);
      ctx.bezierCurveTo(cx + 27, fy - 22, cx + 35, fy + 6, cx + 30, fy + 30);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.moveTo(cx - 11, fy + 26);
      ctx.bezierCurveTo(cx - 19, fy - 2, cx - 6, fy - 18, cx - 2, fy - fl * 0.5);
      ctx.bezierCurveTo(cx + 8, fy - fl * 0.28, cx + 12, fy - 6, cx + 12, fy + 26);
      ctx.closePath(); ctx.fill();

      /* まき */
      ctx.fillStyle = INK;
      ctx.save(); ctx.translate(cx, fy + 34); ctx.rotate(0.15); ctx.fillRect(-54, -5, 108, 10); ctx.restore();
      ctx.save(); ctx.translate(cx, fy + 34); ctx.rotate(-0.17); ctx.fillRect(-48, -5, 96, 10); ctx.restore();

      /* 手前のモコ */
      for (let i = 0; i < 3; i++) {
        const x = cx - 190 + i * 190, y = fy + 96 + (i === 1 ? 18 : 0);
        R.drawMoko(ctx, x, y, { s: 1.85, c1: '#dcc59c', c2: '#a88a5f', eye: INK, wob: t * 1.2 + i, face: x <= cx ? 1 : -1 });
      }

      /* 星 */
      ctx.fillStyle = INK;
      for (let i = 0; i < 14; i++) {
        const x = 60 + hash2(i, 31) * (W - 120), y = 52 + hash2(i, 32) * 100;
        ctx.beginPath();
        ctx.moveTo(x, y - 5); ctx.lineTo(x + 1.6, y - 1.6); ctx.lineTo(x + 5, y);
        ctx.lineTo(x + 1.6, y + 1.6); ctx.lineTo(x, y + 5); ctx.lineTo(x - 1.6, y + 1.6);
        ctx.lineTo(x - 5, y); ctx.lineTo(x - 1.6, y - 1.6); ctx.closePath(); ctx.fill();
      }
    }

    if (kind === 'plate_castle') {
      hatch(36, 36, W - 72, H - 72, 5, 0.26);
      /* 黒い雲 */
      ctx.fillStyle = INK;
      for (const [x, y, r] of [[cx - 150, 400, 66], [cx - 40, 386, 84], [cx + 90, 398, 74], [cx + 190, 414, 56]]) {
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, 0, TAU); ctx.fill();
      }
      /* 城 */
      ctx.fillStyle = INK;
      ctx.fillRect(cx - 78, 210, 156, 170);
      for (const bx of [-104, -30, 44]) {
        ctx.fillRect(cx + bx, 150, 42, 230);
        ctx.beginPath();
        ctx.moveTo(cx + bx - 10, 150); ctx.lineTo(cx + bx + 21, 96); ctx.lineTo(cx + bx + 52, 150);
        ctx.closePath(); ctx.fill();
      }
      /* 灯り */
      ctx.fillStyle = PAPER;
      for (const w of [[-92, 190], [-18, 190], [56, 190], [-50, 268], [22, 268]]) {
        ctx.fillRect(cx + w[0], w[1], 16, 24);
      }
      ctx.fillStyle = INK;
      /* こわいモコの影 */
      R.drawMoko(ctx, cx - 10, 262, { s: 2.1, c1: '#3a2a1a', c2: '#241a10', eye: PAPER, demon: true, wob: t });
      /* とびかう影 */
      for (let i = 0; i < 6; i++) {
        const x = cx - 200 + i * 80 + Math.sin(t + i) * 14, y = 130 + (i % 3) * 34;
        ctx.strokeStyle = INK; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 10, y); ctx.quadraticCurveTo(x - 5, y - 7, x, y);
        ctx.quadraticCurveTo(x + 5, y - 7, x + 10, y); ctx.stroke();
      }
    }
    ctx.restore();

    /* ページのすみ */
    ctx.fillStyle = 'rgba(120,90,50,.5)';
    ctx.font = 'italic 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('― ' + (this.page + 1) + ' ―', W / 2, H - 12);
    ctx.textAlign = 'left';
  },

  /* 目がさめる場面 */
  drawWake(ctx, W, H) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7fc0f0'); g.addColorStop(0.6, '#d8f0ff'); g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) {
      const x = (i * 140 + t * 12) % (W + 200) - 100, y = 80 + (i % 3) * 90;
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.ellipse(x, y, 90, 26, 0, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(W / 2, H * 0.80, 260, 76, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8f0ff';
    ctx.beginPath(); ctx.ellipse(W / 2, H * 0.86, 230, 50, 0, 0, TAU); ctx.fill();
    R.glow(ctx, W / 2, H * 0.56, 240, 'rgba(255,236,170,ALPHA)', 0.55);
    R.drawMoko(ctx, W / 2, H * 0.60, { s: 3.4, c1: '#ffffff', c2: '#d8e2f5', eye: '#5a6a8a', halo: true, wob: t, blush: true });
  },
};
