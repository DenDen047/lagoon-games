/* =========================================================================
   STAR FLICK ― 絵
   船（形ごと）とパーツの見た目、パーツのアイコン、ステージの床と背景。
   船は原点を中心に +x 向きで描く。大きさは船体の r に合わせる。
   ========================================================================= */
'use strict';

const TEAM = ['#39d0ff', '#ff4a5a'];

function bodyGrad(ctx, r, col, cx = 0, cy = 0) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r * 1.15);
  g.addColorStop(0, shade(col, 0.45));
  g.addColorStop(0.55, col);
  g.addColorStop(1, shade(col, -0.55));
  return g;
}
function poly(ctx, pts, r) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
  ctx.closePath();
}
function cockpit(ctx, x, y, rx, ry) {
  const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 1, x, y, Math.max(rx, ry));
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#bdf3ff'); g.addColorStop(1, '#1d4f78');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
}
function outline(ctx, w = 1.6) { ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = w; ctx.stroke(); }
function lightDot(ctx, x, y, r, col, on) {
  ctx.fillStyle = on ? col : shade(col, -0.6);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if (on) { ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
}

/* 形ごとの描き方。r は大きさ、t は時刻（光の点滅などに使う） */
const HULL_ART = {
  disc(ctx, r, c, t) {
    ctx.fillStyle = bodyGrad(ctx, r, c);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); outline(ctx);
    ctx.strokeStyle = rgba('#000000', 0.3); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72); ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); ctx.stroke();
      lightDot(ctx, Math.cos(a + 0.39) * r * 0.85, Math.sin(a + 0.39) * r * 0.85, r * 0.05, '#fff6a0', Math.floor(t * 4 + i) % 3 === 0);
    }
    cockpit(ctx, r * 0.2, 0, r * 0.34, r * 0.3);
  },
  arrow(ctx, r, c) {
    ctx.fillStyle = bodyGrad(ctx, r, c); poly(ctx, [[1.25, 0], [0.2, 0.32], [-0.75, 1.0], [-0.5, 0.35], [-0.72, 0], [-0.5, -0.35], [-0.75, -1.0], [0.2, -0.32]], r); ctx.fill(); outline(ctx);
    ctx.fillStyle = rgba('#000000', 0.25);
    poly(ctx, [[0.9, 0], [-0.55, 0.16], [-0.55, -0.16]], r); ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', 0.4); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-0.1 * r, 0.42 * r); ctx.lineTo(-0.6 * r, 0.82 * r); ctx.moveTo(-0.1 * r, -0.42 * r); ctx.lineTo(-0.6 * r, -0.82 * r); ctx.stroke();
    cockpit(ctx, r * 0.32, 0, r * 0.3, r * 0.15);
  },
  tank(ctx, r, c) {
    const oct = []; for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; oct.push([Math.cos(a), Math.sin(a)]); }
    ctx.fillStyle = shade(c, -0.35); ctx.fillRect(r * 0.6, -r * 0.5, r * 0.5, r * 1.0);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(r * 0.6, -r * 0.5, r * 0.5, r * 1.0);
    ctx.fillStyle = bodyGrad(ctx, r, c); poly(ctx, oct, r * 0.98); ctx.fill(); outline(ctx, 2);
    ctx.fillStyle = shade(c, -0.15); poly(ctx, oct, r * 0.66); ctx.fill(); outline(ctx, 1.2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const [x, y] of oct) { ctx.beginPath(); ctx.arc(x * r * 0.82, y * r * 0.82, r * 0.05, 0, TAU); ctx.fill(); }
    cockpit(ctx, r * 0.18, 0, r * 0.26, r * 0.22);
  },
  ring(ctx, r, c, t) {
    ctx.fillStyle = bodyGrad(ctx, r, c);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.arc(0, 0, r * 0.62, 0, TAU, true); ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.stroke();
    ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = r * 0.14;
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); ctx.lineTo(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66); ctx.stroke(); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; lightDot(ctx, Math.cos(a) * r * 0.81, Math.sin(a) * r * 0.81, r * 0.045, '#9ff7ff', Math.floor(t * 8 + i) % 4 === 0); }
    ctx.fillStyle = bodyGrad(ctx, r * 0.34, shade(c, 0.2)); ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, TAU); ctx.fill(); outline(ctx, 1.2);
    cockpit(ctx, r * 0.06, 0, r * 0.17, r * 0.17);
  },
  sting(ctx, r, c) {
    ctx.fillStyle = shade(c, -0.25);
    poly(ctx, [[-0.2, 0.25], [-0.75, 0.95], [-0.95, 0.85], [-0.7, 0.2], [-0.7, -0.2], [-0.95, -0.85], [-0.75, -0.95], [-0.2, -0.25]], r); ctx.fill(); outline(ctx);
    ctx.fillStyle = bodyGrad(ctx, r, c);
    poly(ctx, [[1.45, 0], [0.4, 0.22], [-0.2, 0.3], [-0.95, 0.18], [-0.95, -0.18], [-0.2, -0.3], [0.4, -0.22]], r); ctx.fill(); outline(ctx);
    ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(1.3 * r, 0); ctx.lineTo(-0.8 * r, 0); ctx.stroke();
    cockpit(ctx, r * 0.15, 0, r * 0.26, r * 0.13);
  },
  fortress(ctx, r, c, t) {
    ctx.fillStyle = bodyGrad(ctx, r, c); roundRect(ctx, -r * 0.88, -r * 0.88, r * 1.76, r * 1.76, r * 0.3); ctx.fill(); outline(ctx, 2.2);
    ctx.fillStyle = shade(c, -0.2); roundRect(ctx, -r * 0.58, -r * 0.58, r * 1.16, r * 1.16, r * 0.18); ctx.fill(); outline(ctx, 1.2);
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      ctx.fillStyle = bodyGrad(ctx, r * 0.24, shade(c, 0.15), sx * r * 0.66, sy * r * 0.66);
      ctx.beginPath(); ctx.arc(sx * r * 0.66, sy * r * 0.66, r * 0.22, 0, TAU); ctx.fill(); outline(ctx, 1.2);
      ctx.strokeStyle = '#222'; ctx.lineWidth = r * 0.08;
      ctx.beginPath(); ctx.moveTo(sx * r * 0.66, sy * r * 0.66); ctx.lineTo(sx * r * 0.66 + r * 0.3, sy * r * 0.66); ctx.stroke();
    }
    lightDot(ctx, 0, -r * 0.4, r * 0.05, '#ff5a5a', Math.floor(t * 2) % 2 === 0);
    cockpit(ctx, r * 0.15, 0, r * 0.28, r * 0.28);
  },
  nova(ctx, r, c, t) {
    const pts = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, k = i % 2 ? 0.52 : 1.15; pts.push([Math.cos(a) * k, Math.sin(a) * k]); }
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.6);
    g.addColorStop(0, rgba(shade(c, 0.6), 0.5)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = bodyGrad(ctx, r, c); poly(ctx, pts, r); ctx.fill(); outline(ctx, 1.8);
    ctx.strokeStyle = rgba('#ffffff', 0.45); ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05); ctx.stroke(); }
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    const cg = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 0.42);
    cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.5, shade(c, 0.5)); cg.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, r * (0.34 + pulse * 0.08), 0, TAU); ctx.fill();
  },
  claw(ctx, r, c) {
    ctx.fillStyle = shade(c, -0.2);
    for (const s of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(0.05 * r, s * 0.45 * r);
      ctx.quadraticCurveTo(1.0 * r, s * 0.95 * r, 1.25 * r, s * 0.18 * r);
      ctx.lineTo(0.95 * r, s * 0.28 * r);
      ctx.quadraticCurveTo(0.7 * r, s * 0.55 * r, 0.25 * r, s * 0.2 * r);
      ctx.closePath(); ctx.fill(); outline(ctx);
    }
    ctx.fillStyle = bodyGrad(ctx, r * 0.85, c, -0.15 * r, 0);
    ctx.beginPath(); ctx.arc(-0.15 * r, 0, r * 0.78, 0, TAU); ctx.fill(); outline(ctx, 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(-0.15 * r, 0, r * 0.78, Math.PI * 0.6 + i * 0.25, Math.PI * 0.6 + i * 0.25 + 0.01); ctx.lineTo(-0.15 * r, 0); ctx.stroke(); }
    cockpit(ctx, r * 0.15, 0, r * 0.26, r * 0.2);
    lightDot(ctx, r * 0.35, r * 0.12, r * 0.06, '#ff3030', true); lightDot(ctx, r * 0.35, -r * 0.12, r * 0.06, '#ff3030', true);
  },
  manta(ctx, r, c, t) {
    const flap = Math.sin(t * 3) * 0.06;
    ctx.fillStyle = bodyGrad(ctx, r, c);
    ctx.beginPath();
    ctx.moveTo(0.95 * r, 0);
    ctx.bezierCurveTo(0.6 * r, 0.35 * r, 0.1 * r, (1.15 + flap) * r, -0.35 * r, (1.05 + flap) * r);
    ctx.quadraticCurveTo(-0.45 * r, 0.5 * r, -0.7 * r, 0.22 * r);
    ctx.lineTo(-1.35 * r, 0.05 * r); ctx.lineTo(-1.35 * r, -0.05 * r);
    ctx.lineTo(-0.7 * r, -0.22 * r);
    ctx.quadraticCurveTo(-0.45 * r, -0.5 * r, -0.35 * r, -(1.05 + flap) * r);
    ctx.bezierCurveTo(0.1 * r, -(1.15 + flap) * r, 0.6 * r, -0.35 * r, 0.95 * r, 0);
    ctx.closePath(); ctx.fill(); outline(ctx, 1.8);
    ctx.fillStyle = rgba('#ffffff', 0.18);
    for (const s of [1, -1]) { ctx.beginPath(); ctx.ellipse(-0.05 * r, s * 0.55 * r, r * 0.22, r * 0.09, s * 0.5, 0, TAU); ctx.fill(); }
    cockpit(ctx, r * 0.4, 0, r * 0.22, r * 0.16);
  },
  hornet(ctx, r, c, t) {
    ctx.fillStyle = rgba('#e8f6ff', 0.35);
    const flap = Math.sin(t * 30) * 0.15;
    for (const s of [1, -1]) { ctx.beginPath(); ctx.ellipse(-0.05 * r, s * 0.62 * r, r * 0.55, r * (0.24 + flap * 0.5), s * (0.5 + flap), 0, TAU); ctx.fill(); outline(ctx, 1); }
    ctx.fillStyle = '#222'; poly(ctx, [[-1.0, 0.12], [-1.45, 0], [-1.0, -0.12]], r); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(-0.55 * r, 0, r * 0.55, r * 0.4, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = c; ctx.fillRect(-1.2 * r, -r, r * 1.3, 2 * r);
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 3; i++) ctx.fillRect((-0.9 + i * 0.28) * r, -r, r * 0.12, 2 * r);
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(-0.55 * r, 0, r * 0.55, r * 0.4, 0, 0, TAU); outline(ctx, 1.5);
    ctx.fillStyle = bodyGrad(ctx, r * 0.45, shade(c, -0.2)); ctx.beginPath(); ctx.arc(0.05 * r, 0, r * 0.38, 0, TAU); ctx.fill(); outline(ctx, 1.5);
    ctx.fillStyle = bodyGrad(ctx, r * 0.35, c, 0.55 * r, 0); ctx.beginPath(); ctx.arc(0.55 * r, 0, r * 0.3, 0, TAU); ctx.fill(); outline(ctx, 1.5);
    lightDot(ctx, 0.68 * r, 0.14 * r, r * 0.07, '#ff2a2a', true); lightDot(ctx, 0.68 * r, -0.14 * r, r * 0.07, '#ff2a2a', true);
  },
  phantom(ctx, r, c, t) {
    ctx.save();
    ctx.globalAlpha *= 0.82;
    const g = ctx.createLinearGradient(r, 0, -1.3 * r, 0);
    g.addColorStop(0, shade(c, 0.35)); g.addColorStop(0.6, c); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0.25 * r, 0, r * 0.75, -Math.PI / 2, Math.PI / 2);
    const wv = (k) => Math.sin(t * 6 + k) * 0.12 * r;
    ctx.bezierCurveTo(-0.3 * r, 0.75 * r, -0.6 * r, 0.5 * r + wv(0), -1.3 * r, 0.45 * r + wv(1));
    ctx.quadraticCurveTo(-0.85 * r, 0.15 * r, -1.35 * r, 0 + wv(2));
    ctx.quadraticCurveTo(-0.85 * r, -0.15 * r, -1.3 * r, -0.45 * r + wv(3));
    ctx.bezierCurveTo(-0.6 * r, -0.5 * r + wv(4), -0.3 * r, -0.75 * r, 0.25 * r, -0.75 * r);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    for (const s of [1, -1]) { ctx.beginPath(); ctx.ellipse(0.5 * r, s * 0.25 * r, r * 0.13, r * 0.09, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#4a1aff';
    for (const s of [1, -1]) { ctx.beginPath(); ctx.arc(0.55 * r, s * 0.25 * r, r * 0.05, 0, TAU); ctx.fill(); }
  },
  titan(ctx, r, c, t) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      ctx.fillStyle = shade(c, -0.35);
      poly(ctx, [[Math.cos(a - 0.12) * 0.9, Math.sin(a - 0.12) * 0.9], [Math.cos(a) * 1.12, Math.sin(a) * 1.12], [Math.cos(a + 0.12) * 0.9, Math.sin(a + 0.12) * 0.9]], r); ctx.fill();
    }
    ctx.fillStyle = bodyGrad(ctx, r, c); ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, TAU); ctx.fill(); outline(ctx, 2.4);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45); ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, TAU); ctx.stroke();
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(255,${Math.round(80 + pulse * 80)},40,1)`;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.26, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(0, 0, r * (0.36 + pulse * 0.08), 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffdd88'; ctx.fillRect(r * 0.55, -r * 0.08, r * 0.3, r * 0.16);
  },
  emperor(ctx, r, c, t) {
    const halo = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.7);
    halo.addColorStop(0, 'rgba(255,220,120,0.45)'); halo.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, TAU); ctx.fill();
    const pts = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, k = i % 2 ? 0.7 : 1.2; pts.push([Math.cos(a) * k, Math.sin(a) * k]); }
    ctx.fillStyle = '#5a3a10'; poly(ctx, pts, r * 1.04); ctx.fill();
    ctx.fillStyle = bodyGrad(ctx, r, c); poly(ctx, pts, r); ctx.fill(); outline(ctx, 2);
    ctx.fillStyle = bodyGrad(ctx, r * 0.6, '#7a1aa0'); ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 2; ctx.stroke();
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    const jg = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 0.3);
    jg.addColorStop(0, '#ffffff'); jg.addColorStop(0.4, '#ff6af0'); jg.addColorStop(1, 'rgba(255,60,200,0)');
    ctx.fillStyle = jg; ctx.beginPath(); ctx.arc(0, 0, r * (0.26 + pulse * 0.06), 0, TAU); ctx.fill();
  },
};

/* 船を1隻描く。ship = { hull, col, parts }。opt.jet=炎を出す, opt.t=時刻 */
function drawShip(ctx, ship, opt = {}) {
  const hl = HULLS[ship.hull] || HULLS.disc;
  const r = opt.r || hl.r;
  const t = opt.t || 0;
  const pp = ship.parts || {};
  const k = r / hl.r;
  /* ジャイロの輪（船の向きとは関係なく回す） */
  if (pp.gyro && PARTS[pp.gyro]) {
    const col = RARITY[PARTS[pp.gyro].rar].col;
    ctx.save(); ctx.rotate(t * 2.5);
    ctx.strokeStyle = rgba(col, 0.75); ctx.lineWidth = 2.2 * k; ctx.setLineDash([6 * k, 5 * k]);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  /* ジェット（船の後ろに2つ） */
  if (pp.jet && PARTS[pp.jet]) {
    const col = RARITY[PARTS[pp.jet].rar].col;
    for (const s of [1, -1]) {
      const y = s * r * 0.42, x = -r * 0.95;
      if (opt.jet) {
        const L = r * (1.2 + Math.random() * 0.6);
        const g = ctx.createLinearGradient(x, y, x - L, y);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, '#9fe8ff'); g.addColorStop(0.6, 'rgba(80,140,255,0.6)'); g.addColorStop(1, 'rgba(80,140,255,0)');
        ctx.fillStyle = g; ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.moveTo(x, y - r * 0.16); ctx.lineTo(x - L, y); ctx.lineTo(x, y + r * 0.16); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = '#3a4250'; roundRect(ctx, x - r * 0.12, y - r * 0.15, r * 0.4, r * 0.3, r * 0.06); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = opt.jet ? '#ffffff' : col; ctx.fillRect(x - r * 0.14, y - r * 0.09, r * 0.06, r * 0.18);
    }
  }
  /* バリアのアンテナ（左右に1本ずつ） */
  if (pp.barrier && PARTS[pp.barrier]) {
    const col = RARITY[PARTS[pp.barrier].rar].col;
    for (const s of [1, -1]) {
      ctx.strokeStyle = '#8894a8'; ctx.lineWidth = 2 * k;
      ctx.beginPath(); ctx.moveTo(-r * 0.1, s * r * 0.75); ctx.lineTo(-r * 0.3, s * r * 1.12); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.lineTo(-r * 0.3 + Math.cos(a) * r * 0.12, s * r * 1.12 + Math.sin(a) * r * 0.12); }
      ctx.closePath(); ctx.fill();
    }
  }
  (HULL_ART[ship.hull] || HULL_ART.disc)(ctx, r, ship.col || '#4fd1ff', t);
  /* コア（真ん中のうしろ寄りに光る玉） */
  if (pp.core && PARTS[pp.core]) {
    const col = RARITY[PARTS[pp.core].rar].col;
    const pulse = 0.6 + 0.4 * Math.sin(t * 6);
    const g = ctx.createRadialGradient(-r * 0.3, 0, 0, -r * 0.3, 0, r * 0.3);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, col); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.globalAlpha = pulse;
    ctx.beginPath(); ctx.arc(-r * 0.3, 0, r * 0.3, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* DOM のカード用に、小さなキャンバスへ船を描く */
function paintShipCanvas(cv, ship, opt = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth, hgt = cv.clientHeight;
  if (!w || !hgt) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hgt);
  const hl = HULLS[ship.hull] || HULLS.disc;
  const fit = (Math.min(w, hgt) * 0.36) / hl.r * (opt.zoom || 1);
  ctx.translate(w / 2, hgt / 2);
  ctx.rotate(opt.angle === undefined ? -Math.PI / 2 : opt.angle);
  ctx.scale(fit, fit);
  if (opt.team !== undefined) teamRing(ctx, hl.r, opt.team, opt.t || 0);
  drawShip(ctx, ship, { t: opt.t || 0, jet: opt.jet });
}

function teamRing(ctx, r, side, t) {
  const col = TEAM[side];
  const g = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 1.45);
  g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.45, rgba(col, 0.35)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(col, 0.85); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.18, t * 1.5, t * 1.5 + TAU * 0.8); ctx.stroke();
}

/* パーツのアイコン（ガチャやハンガーで使う） */
function drawPartIcon(ctx, id, s, t = 0) {
  const p = PARTS[id];
  const col = RARITY[p.rar].col;
  ctx.save();
  if (p.slot === 'core') {
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, s * 0.45);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.14, t + 0.4, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.14, -t - 0.4, 0, TAU); ctx.stroke();
  } else if (p.slot === 'jet') {
    const g = ctx.createLinearGradient(0, s * 0.05, 0, s * 0.48);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#8fe0ff'); g.addColorStop(1, 'rgba(80,140,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-s * 0.14, s * 0.05); ctx.lineTo(0, s * (0.42 + Math.sin(t * 20) * 0.04)); ctx.lineTo(s * 0.14, s * 0.05); ctx.fill();
    ctx.fillStyle = '#56627a'; roundRect(ctx, -s * 0.2, -s * 0.38, s * 0.4, s * 0.44, s * 0.06); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(-s * 0.2, -s * 0.05, s * 0.4, s * 0.08);
    ctx.fillStyle = '#2a3140'; ctx.fillRect(-s * 0.13, s * 0.03, s * 0.26, s * 0.06);
  } else if (p.slot === 'gyro') {
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.06;
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.rotate(t * (i % 2 ? -2 : 2) + i);
      ctx.beginPath(); ctx.arc(0, 0, s * (0.16 + i * 0.12), 0, TAU * 0.75); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, s * 0.07, 0, TAU); ctx.fill();
  } else {
    ctx.strokeStyle = col; ctx.fillStyle = rgba(col, 0.25); ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; ctx.lineTo(Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; ctx.lineTo(Math.cos(a) * s * 0.22, Math.sin(a) * s * 0.22); }
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}

function paintIconCanvas(cv, item, t = 0) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth, hgt = cv.clientHeight;
  if (!w || !hgt) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hgt);
  ctx.translate(w / 2, hgt / 2);
  if (item.kind === 'hull') {
    const hl = HULLS[item.id];
    const fit = (Math.min(w, hgt) * 0.34) / hl.r;
    ctx.rotate(-Math.PI / 2); ctx.scale(fit, fit);
    drawShip(ctx, { hull: item.id, col: item.col || '#9fb3c8', parts: {} }, { t });
  } else {
    drawPartIcon(ctx, item.id, Math.min(w, hgt), t);
  }
}

/* ------------------------------ 背景 ------------------------------ */
const STARS = [];
(function () {
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 260; i++) STARS.push({ x: rnd(), y: rnd(), z: rnd(), tw: rnd() * TAU });
})();

const THEMES = {
  station:   { top: '#050b1e', bot: '#0b1838', neb: ['#2a4aa8', '#8a3ab8'], planet: { x: 0.12, y: 0.86, r: 0.32, col: '#3a7ad8', ring: true } },
  asteroid:  { top: '#0b0614', bot: '#1a0e26', neb: ['#7a3ab0', '#c0603a'] },
  moon:      { top: '#020306', bot: '#080a12', neb: ['#203060', '#102040'], planet: { x: 0.9, y: 0.55, r: 0.12, col: '#3a8ad8', earth: true } },
  city:      { top: '#120624', bot: '#2a0a3a', neb: ['#ff3ad9', '#3a6aff'], city: true },
  hangar:    { top: '#0c0f15', bot: '#161b24', neb: null, hangar: true },
  blackhole: { top: '#04020a', bot: '#0e0618', neb: ['#5a2aa8', '#a02a6a'] },
};

function drawBackground(ctx, theme, t, W, H) {
  const th = THEMES[theme] || THEMES.station;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.top); g.addColorStop(1, th.bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (th.hangar) {
    /* 母艦の中: 鉄骨のはりと、奥の照明 */
    ctx.strokeStyle = 'rgba(120,140,170,0.08)'; ctx.lineWidth = 2;
    for (let x = ((t * 6) % 90) - 90; x < W + 90; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H * 0.3, H); ctx.stroke(); }
    for (let i = 0; i < 6; i++) {
      const lx = (i + 0.5) / 6 * W;
      const lg = ctx.createRadialGradient(lx, 0, 0, lx, 0, H * 0.35);
      lg.addColorStop(0, 'rgba(255,220,150,0.12)'); lg.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = lg; ctx.fillRect(lx - H * 0.35, 0, H * 0.7, H * 0.35);
    }
    return;
  }
  if (th.neb) {
    for (let i = 0; i < 3; i++) {
      const nx = W * (0.25 + 0.5 * ((i * 0.37 + Math.sin(t * 0.02 + i) * 0.05) % 1)), ny = H * (0.3 + 0.4 * ((i * 0.61) % 1));
      const nr = Math.max(W, H) * (0.35 + i * 0.1);
      const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      ng.addColorStop(0, rgba(th.neb[i % 2], 0.16)); ng.addColorStop(1, rgba(th.neb[i % 2], 0));
      ctx.fillStyle = ng; ctx.fillRect(0, 0, W, H);
    }
  }
  for (const s of STARS) {
    const x = ((s.x * W + t * (4 + s.z * 10)) % W), y = s.y * H;
    const a = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.5 + s.z) + s.tw));
    ctx.fillStyle = `rgba(255,255,255,${a * (0.3 + s.z * 0.7)})`;
    const sz = 0.6 + s.z * 1.5;
    ctx.fillRect(x, y, sz, sz);
  }
  if (th.planet) {
    const p = th.planet, px = W * p.x, py = H * p.y, pr = Math.min(W, H) * p.r;
    const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, shade(p.col, 0.4)); pg.addColorStop(0.7, p.col); pg.addColorStop(1, shade(p.col, -0.7));
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
    if (p.earth) {
      ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.clip();
      ctx.fillStyle = 'rgba(90,180,90,0.75)';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(px + Math.cos(i * 2.1) * pr * 0.5, py + Math.sin(i * 1.7) * pr * 0.45, pr * 0.32, pr * 0.18, i, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(px + Math.cos(i * 1.3 + t * 0.05) * pr * 0.6, py + Math.sin(i * 2.3) * pr * 0.6, pr * 0.35, pr * 0.06, i * 0.7, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    const atm = ctx.createRadialGradient(px, py, pr * 0.95, px, py, pr * 1.15);
    atm.addColorStop(0, rgba(shade(p.col, 0.5), 0.45)); atm.addColorStop(1, rgba(p.col, 0));
    ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(px, py, pr * 1.15, 0, TAU); ctx.fill();
    if (p.ring) {
      ctx.save(); ctx.translate(px, py); ctx.rotate(-0.35);
      ctx.strokeStyle = 'rgba(200,220,255,0.35)'; ctx.lineWidth = pr * 0.06;
      ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.7, pr * 0.32, 0, Math.PI, TAU); ctx.stroke();
      ctx.restore();
    }
  }
  if (th.city) {
    /* 遠くの宇宙都市のビル群 */
    for (let layer = 0; layer < 2; layer++) {
      const base = H * (0.82 + layer * 0.08);
      ctx.fillStyle = layer ? '#1a0830' : '#120622';
      let x = -((t * (3 + layer * 4)) % 60);
      let seed = 11 + layer * 7;
      while (x < W) {
        seed = (seed * 9301 + 49297) % 233280;
        const bw = 26 + (seed % 40), bh = H * (0.12 + ((seed >> 3) % 100) / 400) * (layer ? 0.7 : 1);
        ctx.fillRect(x, base - bh, bw, H);
        ctx.fillStyle = layer ? 'rgba(255,90,220,0.5)' : 'rgba(90,200,255,0.4)';
        for (let wy = base - bh + 6; wy < base; wy += 10) for (let wx = x + 4; wx < x + bw - 4; wx += 8) if (((wx * 7 + wy * 3 + seed) % 5) === 0) ctx.fillRect(wx, wy, 3, 4);
        ctx.fillStyle = layer ? '#1a0830' : '#120622';
        x += bw + 4;
      }
    }
  }
}

/* ------------------------------ 床 ------------------------------ */
function ringsPath(ctx, rings) {
  ctx.beginPath();
  for (const ring of rings) { ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
}
/* 床の模様は重いので、ステージごとに1回だけ画像に焼いておく */
const floorCache = {};
function floorImage(st) {
  if (floorCache[st.id]) return floorCache[st.id];
  const pad = 40, s = 1;
  const b = st.box, w = Math.ceil((b.x1 - b.x0 + pad * 2) * s), hgt = Math.ceil((b.y1 - b.y0 + pad * 2) * s);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hgt;
  const ctx = cv.getContext('2d');
  ctx.translate(-b.x0 + pad, -b.y0 + pad);
  paintFloor(ctx, st);
  floorCache[st.id] = { cv, x: b.x0 - pad, y: b.y0 - pad, w, h: hgt };
  return floorCache[st.id];
}

function paintFloor(ctx, st) {
  const b = st.box;
  let s = 3;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  ctx.save();
  ringsPath(ctx, st.rings); ctx.clip('evenodd');
  const th = st.theme;
  if (th === 'station') {
    ctx.fillStyle = '#2b3448'; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    for (let x = b.x0; x < b.x1; x += 80) for (let y = b.y0; y < b.y1; y += 80) {
      ctx.fillStyle = ((x / 80 + y / 80) & 1) ? '#303a50' : '#29324a';
      ctx.fillRect(x + 1, y + 1, 78, 78);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (const [dx, dy] of [[6, 6], [72, 6], [6, 72], [72, 72]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 2, 0, TAU); ctx.fill(); }
    }
    ctx.strokeStyle = 'rgba(120,200,255,0.25)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 90, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, b.y0); ctx.lineTo(0, b.y1); ctx.stroke();
    ctx.fillStyle = 'rgba(120,200,255,0.12)'; ctx.font = `900 64px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, 0);
  } else if (th === 'asteroid') {
    const g = ctx.createRadialGradient(-80, -60, 40, 0, 0, 480);
    g.addColorStop(0, '#7a6658'); g.addColorStop(1, '#3a2e2a');
    ctx.fillStyle = g; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    for (let i = 0; i < 60; i++) {
      const x = lerp(b.x0, b.x1, rnd()), y = lerp(b.y0, b.y1, rnd()), r = 6 + rnd() * 26;
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,200,0.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x - 1, y - 1, r, Math.PI * 0.9, Math.PI * 1.7); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      let x = lerp(b.x0, b.x1, rnd()), y = lerp(b.y0, b.y1, rnd());
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  } else if (th === 'moon') {
    const g = ctx.createRadialGradient(-120, -100, 40, 0, 0, 520);
    g.addColorStop(0, '#c4c8cf'); g.addColorStop(1, '#7c818a');
    ctx.fillStyle = g; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    for (let i = 0; i < 90; i++) {
      const x = lerp(b.x0, b.x1, rnd()), y = lerp(b.y0, b.y1, rnd()), r = 3 + rnd() * 14;
      ctx.fillStyle = 'rgba(40,40,50,0.18)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    }
    for (const z of st.zones) {
      const zg = ctx.createRadialGradient(z.x, z.y, z.r * 0.2, z.x, z.y, z.r);
      zg.addColorStop(0, '#8a7e68'); zg.addColorStop(1, '#a89a7e');
      ctx.fillStyle = zg; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(60,50,30,0.25)';
      for (let k = 0; k < z.r * 1.2; k++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * z.r * 0.95; ctx.fillRect(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, 2, 2); }
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, Math.PI * 1.0, Math.PI * 1.8); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, Math.PI * 0.05, Math.PI * 0.85); ctx.stroke();
    }
  } else if (th === 'city') {
    ctx.fillStyle = '#1c1430'; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    ctx.strokeStyle = 'rgba(255,58,217,0.18)'; ctx.lineWidth = 1.5;
    for (let x = b.x0; x < b.x1; x += 40) { ctx.beginPath(); ctx.moveTo(x, b.y0); ctx.lineTo(x, b.y1); ctx.stroke(); }
    for (let y = b.y0; y < b.y1; y += 40) { ctx.beginPath(); ctx.moveTo(b.x0, y); ctx.lineTo(b.x1, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(58,220,255,0.10)';
    ctx.fillRect(-60, -225, 120, 130); ctx.fillRect(-60, 95, 120, 130);
    ctx.strokeStyle = 'rgba(255,230,90,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([18, 14]);
    ctx.beginPath(); ctx.moveTo(-460, -175); ctx.lineTo(460, -175); ctx.moveTo(-460, 175); ctx.lineTo(460, 175); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(58,220,255,0.12)'; ctx.font = `900 48px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('NEO', -260, -100); ctx.fillText('CITY', 260, 100);
  } else if (th === 'hangar') {
    ctx.fillStyle = '#394252'; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    for (let x = b.x0; x < b.x1; x += 60) for (let y = b.y0; y < b.y1; y += 60) {
      ctx.fillStyle = ((x / 60 + y / 60) & 1) ? '#3d4757' : '#36404f'; ctx.fillRect(x + 1, y + 1, 58, 58);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = -6; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i * 140, b.y0); ctx.lineTo(i * 140 + 60, b.y0); ctx.lineTo(i * 140 - 220, b.y1); ctx.lineTo(i * 140 - 280, b.y1); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,210,60,0.55)'; ctx.lineWidth = 4;
    ctx.strokeRect(-430, -270, 860, 540);
    ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.stroke();
  } else if (th === 'blackhole') {
    const g = ctx.createRadialGradient(0, 0, 60, 0, 0, 440);
    g.addColorStop(0, '#2a1446'); g.addColorStop(1, '#171030');
    ctx.fillStyle = g; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    ctx.strokeStyle = 'rgba(180,120,255,0.18)'; ctx.lineWidth = 1.5;
    for (let r = 120; r < 440; r += 50) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 110, Math.sin(a) * 110); ctx.lineTo(Math.cos(a) * 440, Math.sin(a) * 440); ctx.stroke(); }
  }
  ctx.restore();
  /* ふちどり */
  ctx.save();
  ringsPath(ctx, st.rings);
  if (th === 'station') {
    ctx.strokeStyle = '#141820'; ctx.lineWidth = 14; ctx.stroke();
    ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 10; ctx.setLineDash([16, 16]); ctx.stroke(); ctx.setLineDash([]);
  } else if (th === 'asteroid') {
    ctx.strokeStyle = '#241a16'; ctx.lineWidth = 10; ctx.stroke();
  } else if (th === 'moon') {
    ctx.strokeStyle = '#5c6068'; ctx.lineWidth = 8; ctx.stroke();
  } else if (th === 'city') {
    ctx.strokeStyle = '#3affe0'; ctx.lineWidth = 5; ctx.stroke();
  } else if (th === 'hangar') {
    ctx.strokeStyle = '#1c2028'; ctx.lineWidth = 6; ctx.stroke();
  } else {
    ctx.strokeStyle = '#b07bff'; ctx.lineWidth = 5; ctx.stroke();
  }
  ctx.restore();
}

/* 毎フレーム動くもの（ふちの光、穴、ブラックホール、バンパー、カベ） */
function drawStage(ctx, st, t) {
  const th = st.theme;
  /* 床の下の影と、ふちの光 */
  ctx.save();
  ringsPath(ctx, st.rings);
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#000'; ctx.fill('evenodd');
  ctx.restore();
  if (th === 'station') {
    ctx.save(); ctx.strokeStyle = 'rgba(120,140,170,0.45)'; ctx.lineWidth = 6;
    for (const x of [-300, -100, 100, 300]) { ctx.beginPath(); ctx.moveTo(x, st.box.y1); ctx.lineTo(x * 1.2, st.box.y1 + 160); ctx.moveTo(x, st.box.y0); ctx.lineTo(x * 1.2, st.box.y0 - 160); ctx.stroke(); }
    ctx.restore();
  }
  const img = floorImage(st);
  ctx.drawImage(img.cv, img.x, img.y, img.w, img.h);
  /* 光るふち */
  ctx.save();
  ringsPath(ctx, st.rings);
  const glow = { station: '#5ac8ff', asteroid: '#ff9a5a', moon: '#cfe0ff', city: '#ff3ad9', hangar: '#ffd23a', blackhole: '#c07bff' }[th];
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(glow, 0.22 + 0.1 * Math.sin(t * 2)); ctx.lineWidth = 14; ctx.stroke();
  ctx.strokeStyle = rgba(glow, 0.5); ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();

  for (const ho of st.holes) {
    if (ho.bh) drawBlackHole(ctx, ho, t);
    else {
      const g = ctx.createRadialGradient(ho.x, ho.y, 2, ho.x, ho.y, ho.r);
      g.addColorStop(0, '#000'); g.addColorStop(0.75, '#05060a'); g.addColorStop(1, '#3a3e48');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ho.x, ho.y, ho.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba('#ff4a4a', 0.4 + 0.3 * Math.sin(t * 4)); ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(ho.x, ho.y, ho.r + 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  if (st.gravity) {
    ctx.strokeStyle = rgba('#ff4a7a', 0.25 + 0.15 * Math.sin(t * 3)); ctx.lineWidth = 2; ctx.setLineDash([10, 10]); ctx.lineDashOffset = -t * 20;
    ctx.beginPath(); ctx.arc(st.gravity.x, st.gravity.y, 105, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
  for (const r of st.rocks) {
    if (r.kind === 'bumper') {
      const p = 0.5 + 0.5 * Math.sin(t * 4 + r.x);
      ctx.fillStyle = '#2a0a3a'; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba('#ff3ad9', 0.6 + p * 0.4); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r - 3, 0, TAU); ctx.stroke();
      ctx.strokeStyle = rgba('#3affe0', 0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.5, 0, TAU); ctx.stroke();
      ctx.strokeStyle = rgba('#ff3ad9', 0.25 * p); ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(r.x, r.y, r.r + 6, 0, TAU); ctx.stroke();
      ctx.restore();
    } else {
      const g = ctx.createRadialGradient(r.x - r.r * 0.4, r.y - r.r * 0.4, 2, r.x, r.y, r.r);
      const base = th === 'blackhole' ? '#6a5a8a' : '#8a7462';
      g.addColorStop(0, shade(base, 0.35)); g.addColorStop(1, shade(base, -0.5));
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(r.x + 6, r.y + 8, r.r, 0, TAU); ctx.fill();
      ctx.fillStyle = g; ctx.beginPath();
      for (let i = 0; i < 11; i++) { const a = (i / 11) * TAU, k = 0.88 + 0.12 * Math.sin(i * 2.7 + r.x); ctx.lineTo(r.x + Math.cos(a) * r.r * k, r.y + Math.sin(a) * r.r * k); }
      ctx.closePath(); ctx.fill(); outline(ctx, 2);
    }
  }
  for (const w of st.walls) drawWall(ctx, w, t);
  if (st.exits) for (const e of st.exits) {
    for (const [x, y] of [[e.x1, e.y1], [e.x2, e.y2]]) lightDot(ctx, x, y, 6, '#ff3a3a', Math.floor(t * 2) % 2 === 0);
  }
}

function drawWall(ctx, w, t) {
  if (w.crate) {
    ctx.strokeStyle = '#6a5030'; ctx.lineWidth = PH.wallTh * 2; ctx.lineCap = 'square';
    ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();
    ctx.strokeStyle = '#c08a3a'; ctx.lineWidth = PH.wallTh * 2 - 5;
    ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();
    ctx.lineCap = 'butt';
    return;
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1a1e26'; ctx.lineWidth = PH.wallTh * 2 + 4;
  ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();
  ctx.strokeStyle = '#7a8496'; ctx.lineWidth = PH.wallTh * 2 - 2;
  ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();
  ctx.strokeStyle = rgba('#ffd23a', 0.55); ctx.lineWidth = 2; ctx.setLineDash([12, 12]);
  ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke(); ctx.setLineDash([]);
  ctx.lineCap = 'butt';
}

/* 木箱は4本のカベでできているので、中を塗って箱に見せる */
function drawCrates(ctx, st) {
  const seen = new Set();
  for (let i = 0; i < st.walls.length; i += 1) {
    const w = st.walls[i];
    if (!w.crate || seen.has(i)) continue;
    const ws = st.walls.slice(i, i + 4);
    ws.forEach((_, k) => seen.add(i + k));
    const xs = ws.flatMap((q) => [q.x1, q.x2]), ys = ws.flatMap((q) => [q.y1, q.y2]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x0 + 6, y0 + 8, x1 - x0, y1 - y0);
    ctx.fillStyle = '#a8763a'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = '#6a4a22'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.moveTo(x1, y0); ctx.lineTo(x0, y1); ctx.stroke();
  }
}

function drawBlackHole(ctx, ho, t) {
  ctx.save();
  ctx.translate(ho.x, ho.y);
  const R = ho.r;
  const halo = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, R * 3);
  halo.addColorStop(0, 'rgba(255,150,80,0.55)'); halo.addColorStop(0.4, 'rgba(200,80,255,0.25)'); halo.addColorStop(1, 'rgba(120,40,255,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, R * 3, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const a = t * (1.6 - i * 0.06) + i * 0.9;
    const rr = R * (1.05 + i * 0.09);
    ctx.strokeStyle = `hsla(${25 + i * 14},100%,${60 - i * 2}%,${0.55 - i * 0.03})`;
    ctx.lineWidth = 3 + (i % 3);
    ctx.beginPath(); ctx.arc(0, 0, rr, a, a + 1.6 + (i % 4) * 0.4); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,140,0.9)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

/* バリア。こわれない光のカベ。持ち主の色で、残りターンを点の数で出す。 */
function drawBarrier(ctx, b, t, ghost) {
  const col = b.side === 0 ? '#39d0ff' : '#ff6a4a';
  const c2 = b.ur ? '#a0ffcf' : shade(col, 0.5);
  const L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1), ang = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
  ctx.save();
  ctx.translate(b.x1, b.y1); ctx.rotate(ang);
  ctx.globalAlpha = ghost ? 0.55 : 1;
  ctx.globalCompositeOperation = 'lighter';
  const fl = b.flash || 0;
  const g = ctx.createLinearGradient(0, -22, 0, 22);
  g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.5, rgba(col, 0.6 + fl * 0.4)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.fillRect(0, -22, L, 44);
  ctx.strokeStyle = rgba(c2, 0.95); ctx.lineWidth = 6 + fl * 4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.stroke();
  ctx.strokeStyle = rgba(c2, 0.6); ctx.lineWidth = 1.5;
  const off = (t * 30) % 18;
  for (let x = -off; x < L; x += 18) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.lineTo(clamp(x + Math.cos(a) * 9, 0, L), Math.sin(a) * 9); }
    ctx.closePath(); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const x of [0, L]) {
    ctx.fillStyle = '#2a3140'; ctx.beginPath(); ctx.arc(x, 0, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(x, 0, 6, 0, TAU); ctx.fill();
  }
  if (!ghost && b.turns !== undefined) {
    for (let i = 0; i < b.turns; i++) { ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(L / 2 + (i - (b.turns - 1) / 2) * 12, 20, 4, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}
