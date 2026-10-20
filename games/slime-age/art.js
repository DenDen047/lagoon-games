/* =========================================================================
   SLIME AGE ― 絵
   スライム / 武器 / てきの ぼうし / 落ちているもの / 地面。ぜんぶ プログラムで描く
   ========================================================================= */
'use strict';

const WORLD_W = 2400, WORLD_H = 1600, EDGE = 120;

/* ------------------------------- スライム ------------------------------- */
/* (0,0) が あたり判定の まんなか。足もとは y = r*0.62。
   s: { r, col, members, look, mood, flash, sq, crown, hat, boss, t } */
function slimePath(ctx, w, hh, r) {
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.bezierCurveTo(-w * 0.6, -hh * 0.58, -w * 0.2, -hh * 0.8, 0, -hh);
  ctx.bezierCurveTo(w * 0.2, -hh * 0.8, w * 0.6, -hh * 0.58, w / 2, 0);
  ctx.quadraticCurveTo(0, r * 0.2, -w / 2, 0);
  ctx.closePath();
}

function drawSlime(ctx, s) {
  const r = s.r, sq = s.sq || 0;
  const w = r * 2.1 * (1 + sq * 0.28);
  const hh = r * 1.78 * (1 - sq * 0.28);
  ctx.save();
  ctx.translate(0, r * 0.62);

  slimePath(ctx, w, hh, r);
  const g = ctx.createRadialGradient(-w * 0.16, -hh * 0.62, r * 0.1, 0, -hh * 0.35, r * 1.5);
  g.addColorStop(0, shade(s.col, 0.55));
  g.addColorStop(0.45, s.col);
  g.addColorStop(1, shade(s.col, -0.32));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.strokeStyle = shade(s.col, -0.5);
  ctx.stroke();

  /* くっついた なかまの 色の つぶ */
  if (s.members && s.members.length > 1) {
    ctx.save();
    slimePath(ctx, w, hh, r);
    ctx.clip();
    s.members.forEach((m, i) => {
      const a = i * 2.4 + 0.6, k = 0.25 + (i * 0.37) % 0.55;
      const px = Math.cos(a) * w * 0.3 * k * 1.4, py = -hh * (0.16 + (i * 0.23) % 0.3) + Math.sin(s.t * 2 + i) * r * 0.03;
      ctx.fillStyle = rgba(COLORS[m].col, 0.85);
      ctx.beginPath(); ctx.arc(px, py, r * 0.12, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.arc(px - r * 0.035, py - r * 0.04, r * 0.035, 0, TAU); ctx.fill();
    });
    ctx.restore();
  }

  /* つや */
  ctx.save();
  ctx.translate(-w * 0.2, -hh * 0.68);
  ctx.rotate(-0.6);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.ellipse(0, 0, w * 0.1, hh * 0.055, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.arc(-w * 0.3, -hh * 0.5, r * 0.05, 0, TAU); ctx.fill();

  drawFace(ctx, s, w, hh);

  if (s.flash > 0) {
    slimePath(ctx, w, hh, r);
    ctx.fillStyle = `rgba(255,255,255,${s.flash * 0.75})`;
    ctx.fill();
  }
  if (s.hat !== null && s.hat !== undefined) drawHat(ctx, s.hat, r, w, hh, s.boss, s.t);
  if (s.crown) drawCrown(ctx, r, hh);
  ctx.restore();
}

function drawFace(ctx, s, w, hh) {
  const r = s.r;
  const lx = Math.cos(s.look || 0) * r * 0.13, ly = Math.sin(s.look || 0) * r * 0.07;
  const ey = -hh * 0.42 + ly, ex = w * 0.17;
  const ink = '#1d1b2b';
  ctx.lineCap = 'round';
  if (s.mood === 'ouch') {
    ctx.strokeStyle = ink; ctx.lineWidth = r * 0.07;
    for (const sgn of [-1, 1]) {
      const x = sgn * ex + lx;
      ctx.beginPath();
      ctx.moveTo(x - sgn * r * 0.09, ey - r * 0.09); ctx.lineTo(x + sgn * r * 0.06, ey); ctx.lineTo(x - sgn * r * 0.09, ey + r * 0.09);
      ctx.stroke();
    }
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.ellipse(lx, -hh * 0.22 + ly, r * 0.07, r * 0.09, 0, 0, TAU); ctx.fill();
    return;
  }
  /* め */
  for (const sgn of [-1, 1]) {
    const x = sgn * ex + lx;
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.ellipse(x, ey, r * 0.1, r * (s.mood === 'angry' ? 0.12 : 0.15), 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - r * 0.03, ey - r * 0.05, r * 0.038, 0, TAU); ctx.fill();
    if (s.mood === 'cand') {
      ctx.fillStyle = '#ff7ab0';
      ctx.beginPath(); ctx.arc(x + r * 0.03, ey + r * 0.05, r * 0.025, 0, TAU); ctx.fill();
    }
  }
  if (s.mood === 'angry') {
    ctx.strokeStyle = ink; ctx.lineWidth = r * 0.08;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sgn * w * 0.3 + lx, -hh * 0.6 + ly); ctx.lineTo(sgn * w * 0.07 + lx, -hh * 0.51 + ly);
      ctx.stroke();
    }
    /* ギザギザの くち */
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = ink; ctx.lineWidth = r * 0.05;
    const my = -hh * 0.22 + ly;
    ctx.beginPath();
    ctx.moveTo(lx - r * 0.2, my); ctx.lineTo(lx + r * 0.2, my); ctx.lineTo(lx + r * 0.16, my + r * 0.1); ctx.lineTo(lx - r * 0.16, my + r * 0.1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) { ctx.moveTo(lx + i * r * 0.1, my); ctx.lineTo(lx + i * r * 0.1, my + r * 0.1); }
    ctx.stroke();
    return;
  }
  /* ほっぺ */
  ctx.fillStyle = 'rgba(255,120,150,0.35)';
  for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sgn * w * 0.3 + lx * 0.5, -hh * 0.3 + ly, r * 0.12, r * 0.07, 0, 0, TAU); ctx.fill(); }
  /* くち */
  const my = -hh * 0.27 + ly;
  ctx.fillStyle = '#7a2238';
  ctx.beginPath();
  if (s.mood === 'shout') ctx.ellipse(lx, my + r * 0.04, r * 0.11, r * 0.13, 0, 0, TAU);
  else ctx.arc(lx, my, r * 0.13, 0.1, Math.PI - 0.1);
  ctx.fill();
  ctx.fillStyle = '#ff8aa0';
  ctx.beginPath(); ctx.ellipse(lx, my + r * 0.09, r * 0.06, r * 0.035, 0, 0, TAU); ctx.fill();
}

function drawCrown(ctx, r, hh) {
  const k = r / 17;
  ctx.save();
  ctx.translate(0, -hh * 0.93);
  ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#9a6a00'; ctx.lineWidth = 1.2 * k;
  ctx.beginPath();
  ctx.moveTo(-9 * k, 0); ctx.lineTo(-10 * k, -11 * k); ctx.lineTo(-5 * k, -5 * k); ctx.lineTo(0, -13 * k);
  ctx.lineTo(5 * k, -5 * k); ctx.lineTo(10 * k, -11 * k); ctx.lineTo(9 * k, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff4a6a';
  for (const x of [-10, 0, 10]) { ctx.beginPath(); ctx.arc(x * k, (x ? -11 : -13) * k, 1.8 * k, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#4ad0ff';
  ctx.beginPath(); ctx.arc(0, -4 * k, 2 * k, 0, TAU); ctx.fill();
  ctx.restore();
}

/* てきの ぼうし（時代ごと）。boss のときは 大きく はでに */
function drawHat(ctx, era, r, w, hh, boss, t) {
  const k = r / 17;
  const top = -hh;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (ERAS[era].id) {
    case 'wild': {
      const leaves = boss ? 6 : 2;
      for (let i = 0; i < leaves; i++) {
        const a = boss ? -Math.PI / 2 + (i - (leaves - 1) / 2) * 0.45 : (i ? -0.5 : 0.5) - Math.PI / 2;
        ctx.save();
        ctx.translate(0, top + 3 * k);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = i % 2 ? '#3fae4a' : '#5cc85a'; ctx.strokeStyle = '#26702e'; ctx.lineWidth = 1 * k;
        ctx.beginPath(); ctx.ellipse(0, -8 * k, 3.4 * k, 8 * k, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      if (boss) { ctx.fillStyle = '#ff7ab0'; ctx.beginPath(); ctx.arc(0, top - 1 * k, 3 * k, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.arc(0, top - 1 * k, 1.2 * k, 0, TAU); ctx.fill(); }
      break;
    }
    case 'stone': {
      if (boss) {
        /* マンモスの きば */
        for (const sgn of [-1, 1]) {
          ctx.strokeStyle = '#7a6a50'; ctx.lineWidth = 5.5 * k;
          ctx.beginPath(); ctx.moveTo(sgn * w * 0.18, -hh * 0.2); ctx.quadraticCurveTo(sgn * w * 0.62, -hh * 0.05, sgn * w * 0.58, -hh * 0.5); ctx.stroke();
          ctx.strokeStyle = '#fff8e6'; ctx.lineWidth = 4 * k;
          ctx.stroke();
        }
        ctx.fillStyle = '#7a4a2a';
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(i * 3 * k, top + 2 * k, 2 * k, 6 * k, i * 0.3, 0, TAU); ctx.fill(); }
      }
      ctx.save();
      ctx.translate(0, top + 1 * k);
      ctx.rotate(-0.35);
      ctx.fillStyle = '#fbf3df'; ctx.strokeStyle = '#a89878'; ctx.lineWidth = 1 * k;
      ctx.beginPath(); roundRect(ctx, -8 * k, -1.6 * k, 16 * k, 3.2 * k, 1.5 * k); ctx.fill(); ctx.stroke();
      for (const sx of [-8, 8]) for (const sy of [-1.6, 1.6]) { ctx.beginPath(); ctx.arc(sx * k, sy * k, 2.2 * k, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.restore();
      break;
    }
    case 'bronze': {
      ctx.fillStyle = '#c98a3a'; ctx.strokeStyle = '#7a5016'; ctx.lineWidth = 1.2 * k;
      ctx.beginPath(); ctx.ellipse(0, -hh * 0.8, w * 0.33, hh * 0.24, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (boss) {
        ctx.fillStyle = '#ffd25a';
        ctx.beginPath();
        for (let i = 0; i <= 4; i++) { const x = (i - 2) * w * 0.12; ctx.lineTo(x - w * 0.05, -hh * 0.98); ctx.lineTo(x, -hh * 1.2); ctx.lineTo(x + w * 0.05, -hh * 0.98); }
        ctx.lineTo(w * 0.3, -hh * 0.86); ctx.lineTo(-w * 0.3, -hh * 0.86); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = '#a84a2a';
        ctx.beginPath(); ctx.ellipse(0, top - 2 * k, 2.5 * k, 6 * k, 0, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'iron': {
      ctx.fillStyle = '#7d848c'; ctx.strokeStyle = '#3a3f45'; ctx.lineWidth = 1.2 * k;
      ctx.beginPath(); ctx.ellipse(0, -hh * 0.8, w * 0.34, hh * 0.25, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#9aa2aa'; ctx.fillRect(-w * 0.34, -hh * 0.82, w * 0.68, 2.4 * k);
      const hl = boss ? 1.6 : 1;
      for (const sgn of [-1, 1]) {
        ctx.fillStyle = '#f2ead6'; ctx.strokeStyle = '#8a7e66';
        ctx.beginPath();
        ctx.moveTo(sgn * w * 0.28, -hh * 0.86);
        ctx.quadraticCurveTo(sgn * w * (0.5 + 0.1 * hl), -hh * (1.0 + 0.1 * hl), sgn * w * (0.42 + 0.08 * hl), -hh * (1.2 + 0.2 * hl));
        ctx.quadraticCurveTo(sgn * w * 0.36, -hh * 1.0, sgn * w * 0.16, -hh * 0.92);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
    }
    case 'castle': {
      const steel = boss ? '#2c3048' : '#b8c0c8';
      ctx.fillStyle = steel; ctx.strokeStyle = boss ? '#0e1020' : '#5d6670'; ctx.lineWidth = 1.2 * k;
      ctx.beginPath(); ctx.ellipse(0, -hh * 0.78, w * 0.35, hh * 0.27, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
      const plume = boss ? '#a04aff' : '#e04a4a';
      ctx.fillStyle = plume; ctx.strokeStyle = shade(plume, -0.4);
      ctx.beginPath();
      ctx.moveTo(-2 * k, -hh * 1.0);
      ctx.quadraticCurveTo(-2 * k, top - 14 * k * (boss ? 1.3 : 1), -14 * k, top - 10 * k);
      ctx.quadraticCurveTo(-6 * k, top - 4 * k, 3 * k, -hh * 1.0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'samurai': {
      if (boss) {
        ctx.fillStyle = '#7a1a1a'; ctx.strokeStyle = '#2a0808'; ctx.lineWidth = 1.2 * k;
        ctx.beginPath(); ctx.ellipse(0, -hh * 0.78, w * 0.38, hh * 0.28, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#8a6000';
        ctx.beginPath();
        ctx.moveTo(0, -hh * 0.92);
        ctx.quadraticCurveTo(-w * 0.34, -hh * 1.0, -w * 0.4, -hh * 1.35);
        ctx.quadraticCurveTo(-w * 0.2, -hh * 1.06, 0, -hh * 1.02);
        ctx.quadraticCurveTo(w * 0.2, -hh * 1.06, w * 0.4, -hh * 1.35);
        ctx.quadraticCurveTo(w * 0.34, -hh * 1.0, 0, -hh * 0.92);
        ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = '#1f1d24';
        ctx.beginPath(); ctx.ellipse(0, top - 1.5 * k, 7 * k, 2.6 * k, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e8e0d0'; ctx.fillRect(-1 * k, top - 4 * k, 2 * k, 5 * k);
      }
      break;
    }
    case 'machine': {
      if (boss) {
        ctx.fillStyle = '#5d6670'; ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = 1.4 * k;
        ctx.fillRect(-5 * k, top - 16 * k, 10 * k, 18 * k); ctx.strokeRect(-5 * k, top - 16 * k, 10 * k, 18 * k);
        ctx.fillStyle = 'rgba(220,220,220,0.6)';
        for (let i = 0; i < 3; i++) { const p = (t * 0.8 + i / 3) % 1; ctx.globalAlpha = 1 - p; ctx.beginPath(); ctx.arc(p * 6 * k, top - 18 * k - p * 26 * k, (3 + p * 6) * k, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#1f1d24'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1 * k;
        ctx.fillRect(-9 * k, top + 1 * k, 18 * k, 2.4 * k);
        ctx.fillRect(-6 * k, top - 10 * k, 12 * k, 11 * k);
        ctx.fillStyle = '#c9a227'; ctx.fillRect(-6 * k, top - 2.5 * k, 12 * k, 2 * k);
      }
      /* ゴーグル */
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-w * 0.45, -hh * 0.7, w * 0.9, 2.6 * k);
      for (const sgn of [-1, 1]) {
        ctx.fillStyle = '#b8862f'; ctx.beginPath(); ctx.arc(sgn * w * 0.16, -hh * 0.66, 4.2 * k, 0, TAU); ctx.fill();
        ctx.fillStyle = '#9fe6ff'; ctx.beginPath(); ctx.arc(sgn * w * 0.16, -hh * 0.66, 2.8 * k, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'future': {
      ctx.strokeStyle = '#c8d0e0'; ctx.lineWidth = 1.4 * k;
      ctx.beginPath(); ctx.moveTo(0, top + 2 * k); ctx.lineTo(0, top - 9 * k); ctx.stroke();
      ctx.fillStyle = boss ? '#ff5ad9' : '#4ff0ff';
      ctx.beginPath(); ctx.arc(0, top - 10 * k, 2.6 * k * (1 + 0.2 * Math.sin(t * 6)), 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(80,240,255,0.45)'; ctx.strokeStyle = '#4ff0ff'; ctx.lineWidth = 1 * k;
      ctx.beginPath(); roundRect(ctx, -w * 0.36, -hh * 0.53, w * 0.72, hh * 0.2, hh * 0.1); ctx.fill(); ctx.stroke();
      if (boss) {
        ctx.strokeStyle = 'rgba(255,220,90,0.9)'; ctx.lineWidth = 2 * k;
        ctx.beginPath(); ctx.ellipse(0, top - 18 * k, w * 0.3, 4 * k, 0, 0, TAU); ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

/* --------------------------------- 武器 --------------------------------- */
/* 手で もつところが (0,0)。さきは +x の向き。len は さきまでの 長さ */
function leaf(c, x, y, rot, col) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = col; c.strokeStyle = shade(col, -0.4); c.lineWidth = 0.8;
  c.beginPath(); c.ellipse(0, 0, 4.6, 2.3, 0, 0, TAU); c.fill(); c.stroke();
  c.restore();
}
function steelGrad(c, y0, y1, a, b, d) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, d);
  return g;
}

const WART = {
  branch: { len: 34, draw(c) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#6b4423'; c.lineWidth = 3.4;
    c.beginPath(); c.moveTo(-4, 1); c.lineTo(8, -1); c.lineTo(18, 1.5); c.lineTo(31, -1); c.stroke();
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(14, 0); c.lineTo(20, -7); c.moveTo(23, 1); c.lineTo(27, 6); c.stroke();
    leaf(c, 21, -8, -0.8, '#5cbf4a'); leaf(c, 32, -2, 0.2, '#4caf3e'); leaf(c, 28, 7, 0.9, '#5cbf4a');
  } },
  club: { len: 38, draw(c) {
    c.fillStyle = '#a0692f'; c.strokeStyle = '#5e3a17'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-4, -2.4); c.lineTo(18, -4.5); c.quadraticCurveTo(38, -9, 38, 0); c.quadraticCurveTo(38, 9, 18, 4.5); c.lineTo(-4, 2.4); c.closePath();
    c.fill(); c.stroke();
    c.fillStyle = '#6e4519';
    for (const [x, y, r] of [[24, -2.5, 1.7], [31, 2.6, 1.5], [14, 1, 1.1]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(255,230,180,0.4)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(2, -1.2); c.lineTo(30, -5); c.stroke();
  } },
  woodsword: { len: 42, draw(c) {
    c.fillStyle = '#6b4423'; c.fillRect(-5, -2.2, 11, 4.4);
    c.fillStyle = '#8b5a2b'; roundRect(c, 5, -7, 4, 14, 1.5); c.fill();
    c.fillStyle = '#e3b57c'; c.strokeStyle = '#8b5a2b'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(9, -3.4); c.lineTo(36, -3.4); c.lineTo(42, 0); c.lineTo(36, 3.4); c.lineTo(9, 3.4); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(139,90,43,0.5)'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(12, -1); c.lineTo(34, -1); c.moveTo(16, 1.5); c.lineTo(30, 1.5); c.stroke();
  } },
  stoneaxe: { len: 38, draw(c) {
    c.lineCap = 'round';
    c.strokeStyle = '#7a4c20'; c.lineWidth = 3.8;
    c.beginPath(); c.moveTo(-4, 0); c.lineTo(33, 0); c.stroke();
    c.fillStyle = '#9aa0a6'; c.strokeStyle = '#4d5257'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(25, -3); c.lineTo(29, -13); c.quadraticCurveTo(39, -7, 38, 1); c.quadraticCurveTo(37, 10, 29, 12); c.lineTo(25, 3); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#c3c8cd';
    c.beginPath(); c.moveTo(29, -9); c.lineTo(35, -5); c.lineTo(30, -2); c.closePath(); c.fill();
    c.strokeStyle = '#d7b77a'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(23, -3.5); c.lineTo(27, 3.5); c.moveTo(25.5, -3.5); c.lineTo(29.5, 3.5); c.stroke();
  } },
  spear: { len: 72, draw(c) {
    c.lineCap = 'round';
    c.strokeStyle = '#a0692f'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-8, 0); c.lineTo(58, 0); c.stroke();
    c.fillStyle = '#8e949b'; c.strokeStyle = '#4d5257'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(56, -5.5); c.lineTo(72, 0); c.lineTo(56, 5.5); c.lineTo(59, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#c0c5ca';
    c.beginPath(); c.moveTo(59, -3); c.lineTo(70, 0); c.lineTo(60, 0); c.closePath(); c.fill();
    c.strokeStyle = '#d7b77a'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(51, -2.6); c.lineTo(54, 2.6); c.moveTo(53.5, -2.6); c.lineTo(56.5, 2.6); c.stroke();
  } },
  sling: { len: 26, draw(c, t, anim) {
    c.save();
    if (anim > 0) c.rotate(anim * 40);
    c.strokeStyle = '#c8a26a'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10, -6, 19, -3); c.moveTo(0, 0); c.quadraticCurveTo(10, 6, 19, 3); c.stroke();
    c.fillStyle = '#8a5a30'; c.beginPath(); c.ellipse(21, 0, 5, 4, 0, 0, TAU); c.fill();
    c.fillStyle = '#a5abb1'; c.beginPath(); c.arc(22, 0, 3.2, 0, TAU); c.fill();
    c.restore();
    c.fillStyle = '#c8a26a'; c.beginPath(); c.arc(0, 0, 2.2, 0, TAU); c.fill();
  } },
  bronzesword: { len: 48, draw(c) {
    c.fillStyle = '#5a3a1a'; c.fillRect(-6, -2.2, 12, 4.4);
    c.fillStyle = '#b8862f'; c.beginPath(); c.arc(-6, 0, 3, 0, TAU); c.fill();
    roundRect(c, 6, -8, 4, 16, 2); c.fill();
    c.fillStyle = steelGrad(c, -6, 6, '#fbe08e', '#d9a040', '#a8701e'); c.strokeStyle = '#7a5016'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(10, -3); c.quadraticCurveTo(32, -8, 48, 0); c.quadraticCurveTo(32, 8, 10, 3); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,245,200,0.75)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(12, 0); c.lineTo(42, 0); c.stroke();
  } },
  bow: { len: 30, draw(c, t, anim) {
    const ex = -14 + 17 * Math.cos(1.15), ey = 17 * Math.sin(1.15);
    const pull = anim > 0 ? 0 : 3;
    c.lineCap = 'round';
    c.strokeStyle = '#8b5a2b'; c.lineWidth = 3.2;
    c.beginPath(); c.arc(-14, 0, 17, -1.15, 1.15); c.stroke();
    c.strokeStyle = '#ead2a2'; c.lineWidth = 3.6;
    c.beginPath(); c.arc(-14, 0, 17, -0.22, 0.22); c.stroke();
    c.strokeStyle = '#f4f4f4'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(ex, -ey); c.lineTo(-8 - pull, 0); c.lineTo(ex, ey); c.stroke();
    if (anim <= 0) {
      c.strokeStyle = '#c49a5a'; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(-8 - pull, 0); c.lineTo(24, 0); c.stroke();
      c.fillStyle = '#8e949b'; c.beginPath(); c.moveTo(22, -3); c.lineTo(29, 0); c.lineTo(22, 3); c.closePath(); c.fill();
      c.fillStyle = '#e04a4a'; c.beginPath(); c.moveTo(-7 - pull, 0); c.lineTo(-3 - pull, -3); c.lineTo(-1 - pull, 0); c.lineTo(-3 - pull, 3); c.closePath(); c.fill();
    }
  } },
  ironsword: { len: 52, draw(c) {
    c.fillStyle = '#3a2a1a'; c.fillRect(-7, -2.4, 13, 4.8);
    c.strokeStyle = '#6a5a4a'; c.lineWidth = 0.8;
    c.beginPath(); for (let x = -5; x < 6; x += 3) { c.moveTo(x, -2.4); c.lineTo(x + 2, 2.4); } c.stroke();
    c.fillStyle = '#8a9099'; c.beginPath(); c.arc(-7, 0, 3.2, 0, TAU); c.fill();
    c.fillStyle = '#7a828c'; roundRect(c, 6, -9, 4, 18, 2); c.fill();
    c.fillStyle = steelGrad(c, -4, 4, '#ffffff', '#d4dbe2', '#9aa5b0'); c.strokeStyle = '#5d6670'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(10, -3.8); c.lineTo(44, -3.8); c.lineTo(52, 0); c.lineTo(44, 3.8); c.lineTo(10, 3.8); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#a9b3bd'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(12, 0); c.lineTo(40, 0); c.stroke();
  } },
  hammer: { len: 44, draw(c) {
    c.lineCap = 'round';
    c.strokeStyle = '#7a4c20'; c.lineWidth = 4.2;
    c.beginPath(); c.moveTo(-6, 0); c.lineTo(33, 0); c.stroke();
    c.fillStyle = '#4a4f55'; c.fillRect(26, -2.8, 4, 5.6);
    c.fillStyle = '#626a73'; c.strokeStyle = '#2e3338'; c.lineWidth = 1.6;
    roundRect(c, 30, -13, 14, 26, 3); c.fill(); c.stroke();
    c.fillStyle = '#8f98a1'; c.fillRect(32, -11, 3.5, 22);
  } },
  greatsword: { len: 66, draw(c) {
    c.fillStyle = '#2a1d14'; c.fillRect(-10, -2.8, 18, 5.6);
    c.fillStyle = '#e0b84a'; c.beginPath(); c.arc(-10, 0, 4, 0, TAU); c.fill();
    c.strokeStyle = '#8a6a10'; c.lineWidth = 1;
    roundRect(c, 8, -13, 5, 26, 2.5); c.fill(); c.stroke();
    c.fillStyle = steelGrad(c, -6, 6, '#ffffff', '#cdd6df', '#8f9aa5'); c.strokeStyle = '#4d5560'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(13, -6); c.lineTo(56, -6); c.lineTo(66, 0); c.lineTo(56, 6); c.lineTo(13, 6); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#a8b3be'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(16, 0); c.lineTo(52, 0); c.stroke();
    c.fillStyle = '#e04a4a'; c.beginPath(); c.arc(10.5, 0, 2.4, 0, TAU); c.fill();
  } },
  crossbow: { len: 40, draw(c) {
    c.fillStyle = '#7a4a22'; c.strokeStyle = '#4a2a10'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-8, -3); c.lineTo(30, -2.4); c.lineTo(30, 2.4); c.lineTo(-8, 4.5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#333'; c.fillRect(2, 3, 3, 4);
    c.strokeStyle = '#5a5f66'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(22, -16); c.quadraticCurveTo(31, 0, 22, 16); c.stroke();
    c.strokeStyle = '#eeeeee'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(22, -16); c.lineTo(13, 0); c.lineTo(22, 16); c.stroke();
    c.strokeStyle = '#3a3a3a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(13, 0); c.lineTo(36, 0); c.stroke();
    c.fillStyle = '#9aa0a6'; c.beginPath(); c.moveTo(34, -2.8); c.lineTo(40, 0); c.lineTo(34, 2.8); c.closePath(); c.fill();
  } },
  katana: { len: 56, draw(c) {
    c.fillStyle = '#1f1f2a'; c.fillRect(-8, -2.6, 17, 5.2);
    c.fillStyle = '#e8e0d0';
    for (const x of [-5, -1, 3]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 1.6, -2); c.lineTo(x + 3.2, 0); c.lineTo(x + 1.6, 2); c.closePath(); c.fill(); }
    c.fillStyle = '#c9a227'; c.beginPath(); c.ellipse(10, 0, 2.2, 6.5, 0, 0, TAU); c.fill();
    c.fillStyle = steelGrad(c, -4, 3, '#ffffff', '#e2e8ee', '#aab4be'); c.strokeStyle = '#6f7a85'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(12, -2.2); c.quadraticCurveTo(36, -5, 56, -7); c.quadraticCurveTo(38, 0.5, 12, 2.6); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(160,175,190,0.9)'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(14, 0.6); c.quadraticCurveTo(34, -1.2, 52, -5.4); c.stroke();
  } },
  musket: { len: 56, draw(c, t) {
    c.fillStyle = '#7a4a22'; c.strokeStyle = '#4a2a10'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-10, -2.5); c.lineTo(22, -2); c.lineTo(22, 2.8); c.lineTo(0, 4); c.lineTo(-10, 7); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#3c3f45'; c.fillRect(6, -3.6, 50, 3.8);
    c.fillStyle = '#c9a227'; c.fillRect(20, -4, 2.2, 4.6); c.fillRect(38, -4, 2.2, 4.6);
    c.fillStyle = '#ff6a2a';
    c.beginPath(); c.arc(4, -5.5, 1.6 + Math.sin(t * 20) * 0.5, 0, TAU); c.fill();
  } },
  drill: { len: 52, draw(c, t, anim) {
    c.fillStyle = '#f2c230'; c.strokeStyle = '#8a6a10'; c.lineWidth = 1.2;
    roundRect(c, -8, -6, 22, 12, 3); c.fill(); c.stroke();
    c.fillStyle = '#333'; c.fillRect(-4, 5, 5, 7);
    c.fillStyle = '#555'; c.fillRect(14, -5, 4, 10);
    c.fillStyle = steelGrad(c, -6, 6, '#eef2f5', '#b8c0c8', '#6d757d'); c.strokeStyle = '#4d5560';
    c.beginPath(); c.moveTo(18, -6); c.lineTo(52, 0); c.lineTo(18, 6); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(60,70,80,0.75)'; c.lineWidth = 1;
    const off = ((anim > 0 ? t * 90 : t * 6) % 7);
    c.beginPath();
    for (let x = 18 + off; x < 48; x += 7) {
      const hw = 6 * (1 - (x - 18) / 34), hw2 = 6 * (1 - (x + 3.5 - 18) / 34);
      c.moveTo(x, -hw); c.lineTo(x + 3.5, hw2);
    }
    c.stroke();
  } },
  dynamite: { len: 26, draw(c, t) {
    c.fillStyle = '#d8342c'; c.strokeStyle = '#7a1410'; c.lineWidth = 1;
    for (const y of [-7, -2.3, 2.4]) { roundRect(c, 0, y, 20, 4.6, 2); c.fill(); c.stroke(); }
    c.fillStyle = '#e8d8b0'; c.fillRect(8, -7.5, 3, 15);
    c.strokeStyle = '#444'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(20, 0); c.quadraticCurveTo(24, -1, 25, -5); c.stroke();
    c.fillStyle = Math.sin(t * 30) > 0 ? '#ffe14a' : '#ff8a2a';
    c.beginPath(); c.arc(25, -5.5, 2.2, 0, TAU); c.fill();
  } },
  beamsword: { len: 74, draw(c, t) {
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(70,230,255,0.35)'; c.lineWidth = 12;
    c.beginPath(); c.moveTo(16, 0); c.lineTo(72, 0); c.stroke();
    c.strokeStyle = '#6ff3ff'; c.lineWidth = 6.5 + Math.sin(t * 30) * 0.6;
    c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 2.6;
    c.stroke();
    c.fillStyle = '#9aa3ad'; c.strokeStyle = '#4d5560'; c.lineWidth = 1;
    roundRect(c, -8, -3, 21, 6, 2); c.fill(); c.stroke();
    c.fillStyle = '#5d6670'; c.fillRect(12, -4.2, 3.4, 8.4);
    c.fillStyle = '#ff4a4a'; c.beginPath(); c.arc(1, -0.8, 1.3, 0, TAU); c.fill();
    c.fillStyle = '#4aff7a'; c.beginPath(); c.arc(5.5, -0.8, 1.3, 0, TAU); c.fill();
  } },
  laser: { len: 34, draw(c, t) {
    c.fillStyle = '#3a4250'; roundRect(c, -4, 1, 7, 10, 2); c.fill();
    c.fillStyle = '#eef2f8'; c.strokeStyle = '#6a7280'; c.lineWidth = 1.1;
    roundRect(c, -6, -5, 34, 9, 3.5); c.fill(); c.stroke();
    c.fillStyle = '#3ad8ff'; c.fillRect(1, -2.2, 22, 2.4);
    c.fillStyle = '#c8d0dc'; c.fillRect(28, -3, 4, 5);
    c.fillStyle = `rgba(120,245,255,${0.6 + Math.sin(t * 8) * 0.3})`;
    c.beginPath(); c.arc(33, -0.5, 2.6, 0, TAU); c.fill();
  } },
};

function drawWeapon(ctx, id, t = 0, anim = 0) {
  ctx.save();
  WART[id].draw(ctx, t, anim);
  ctx.restore();
}

/* もっている 武器のならび。いくつも もつと からだの まわりに ひろがる */
const SLOT_OFFS = [[0], [-0.6, 0.6], [-0.85, 0, 0.85], [-1.1, -0.38, 0.38, 1.1]];
const wscale = (r) => 0.85 + r / 60;

/* front: からだの まえに 描くぶんか、うしろに 描くぶんか */
function drawHeldWeapons(ctx, b, front, t) {
  const k = b.wpns.length;
  if (!k) return;
  const offs = SLOT_OFFS[Math.min(k, 4) - 1];
  const sc = wscale(b.r);
  for (let i = 0; i < k; i++) {
    const w = b.wpns[i];
    const def = WEAPONS[w.id];
    const base = w.anim > 0 ? w.aim : b.aim;
    const hand = base + offs[i];
    if ((Math.sin(hand) > -0.3) !== front) continue;
    let hx = Math.cos(hand) * b.r * 0.92, hy = Math.sin(hand) * b.r * 0.55 + b.r * 0.12;
    let ang = base + offs[i] * 0.3 + Math.sin(t * 2.4 + i * 1.7 + b.id) * 0.06;
    let push = 0;
    if (w.anim > 0) {
      const p = 1 - w.anim / w.dur;
      if (def.kind === 'swing') ang = base + offs[i] * 0.2 + (easeOut(p) - 0.5) * def.arc * 1.05;
      else if (def.kind === 'thrust') push = Math.sin(p * Math.PI) * def.reach * 0.55;
      else if (def.kind === 'smash') ang = base + (p < 0.45 ? -1.3 * (p / 0.45) : -1.3 + 1.6 * easeOut((p - 0.45) / 0.55));
      else if (def.kind === 'throw') ang = base - 1.6 + 2.4 * easeOut(p);
      else push = -4 * (1 - p);
    }
    ctx.save();
    ctx.translate(hx + Math.cos(ang) * push, hy + Math.sin(ang) * push);
    ctx.rotate(ang);
    ctx.scale(sc, Math.cos(ang) < 0 ? -sc : sc);
    if (!(def.kind === 'throw' && w.anim > 0 && w.anim < w.dur * 0.6)) drawWeapon(ctx, w.id, t, w.anim);
    ctx.restore();
    /* ふった あとの すじ */
    if (w.anim > 0 && def.kind === 'swing') {
      const p = 1 - w.anim / w.dur;
      const rr = b.r * 0.92 + def.reach * sc * 0.85;
      const a0 = base + offs[i] * 0.2 - def.arc * 0.52, a1 = ang;
      ctx.strokeStyle = w.id === 'beamsword' ? `rgba(110,240,255,${0.7 * (1 - p)})` : `rgba(255,255,255,${0.6 * (1 - p)})`;
      ctx.lineWidth = 7 * sc * (1 - p * 0.5);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(0, b.r * 0.12, rr, rr * 0.62, 0, Math.min(a0, a1), Math.max(a0, a1));
      ctx.stroke();
    }
  }
}

/* ------------------------------- とぶもの ------------------------------- */
function drawProj(ctx, p, t) {
  ctx.save();
  if (p.throw) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 6, 9, 4, 0, 0, TAU); ctx.fill();
    ctx.translate(p.x, p.y - p.z);
    ctx.rotate(t * 14);
    ctx.translate(-12, 0);
    drawWeapon(ctx, 'dynamite', t);
    ctx.restore();
    return;
  }
  const a = Math.atan2(p.vy, p.vx);
  ctx.translate(p.x, p.y);
  ctx.rotate(a);
  switch (p.shape) {
    case 'stone':
      ctx.fillStyle = '#9aa0a6'; ctx.strokeStyle = '#5d6268'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill(); ctx.stroke();
      break;
    case 'arrow':
    case 'bolt':
      ctx.strokeStyle = p.shape === 'bolt' ? '#3a3a3a' : '#c49a5a'; ctx.lineWidth = p.shape === 'bolt' ? 2.6 : 2;
      ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.fillStyle = '#9aa0a6'; ctx.beginPath(); ctx.moveTo(4, -3.5); ctx.lineTo(11, 0); ctx.lineTo(4, 3.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e04a4a'; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-13, -3.5); ctx.lineTo(-11, 0); ctx.lineTo(-13, 3.5); ctx.closePath(); ctx.fill();
      break;
    case 'bullet':
      ctx.fillStyle = 'rgba(255,220,120,0.5)'; ctx.fillRect(-22, -2, 22, 4);
      ctx.fillStyle = '#fff2b0'; ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill();
      break;
    case 'laser':
      ctx.lineCap = 'round';
      ctx.strokeStyle = p.ally ? 'rgba(80,240,255,0.45)' : 'rgba(255,80,200,0.45)'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.5; ctx.stroke();
      break;
  }
  ctx.restore();
}

/* ------------------------------- 落ちているもの ------------------------------- */
function drawItem(ctx, it, t) {
  const bob = Math.sin(t * 3 + it.x * 0.01) * 3;
  if (it.type === 'idea') {
    ctx.save();
    ctx.translate(it.x, it.y - 6 + bob * 0.6);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16);
    g.addColorStop(0, 'rgba(255,240,120,0.8)'); g.addColorStop(1, 'rgba(255,240,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff59a'; ctx.strokeStyle = '#d8a800'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, -2, 6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9aa0a6'; ctx.fillRect(-3, 3, 6, 4);
    ctx.restore();
    return;
  }
  if (it.type === 'heart') {
    ctx.save();
    ctx.translate(it.x, it.y - 8 + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(0, 12 - bob, 8, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff5a8a'; ctx.strokeStyle = '#a0204a'; ctx.lineWidth = 1.4;
    heartPath(ctx, 0, 0, 9); ctx.fill(); ctx.stroke();
    ctx.restore();
    return;
  }
  /* 武器 */
  const def = WART[it.id];
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0, 6, 16, 5, 0, 0, TAU); ctx.fill();
  const glow = it.fresh ? 'rgba(255,220,80,' : 'rgba(255,255,255,';
  const gr = it.fresh ? 34 : 22;
  const g = ctx.createRadialGradient(0, -8, 2, 0, -8, gr);
  g.addColorStop(0, glow + (0.55 + Math.sin(t * 5) * 0.2) + ')'); g.addColorStop(1, glow + '0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -8, gr, 0, TAU); ctx.fill();
  ctx.translate(0, -10 + bob);
  const sc = Math.min(1, 40 / def.len) * 1.1;
  ctx.rotate(-0.75);
  ctx.scale(sc, sc);
  ctx.translate(-def.len * 0.45, 0);
  drawWeapon(ctx, it.id, t);
  ctx.restore();
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.3, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.3, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

/* ------------------------------- アイコン（DOM用） ------------------------------- */
const iconCache = {};
function weaponIcon(id, locked = false) {
  const key = id + (locked ? ':l' : '');
  if (iconCache[key]) return iconCache[key];
  const S = 96;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const c = cv.getContext('2d');
  const def = WART[id];
  const sc = (S * 1.12) / (def.len + 14);
  c.translate(S / 2, S / 2);
  c.rotate(-Math.PI / 4);
  c.scale(sc, sc);
  c.translate(-(def.len - 8) / 2, 0);
  drawWeapon(c, id, 0.3);
  if (locked) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = 'rgba(190,215,200,0.42)';
    c.fillRect(0, 0, S, S);
  }
  return (iconCache[key] = cv.toDataURL());
}

/* カードに 描く スライム（武器つき） */
function paintSlimeCard(cv, team, t) {
  const W = cv.clientWidth || 140, H = cv.clientHeight || 110;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  const n = team.members.length;
  const r = bodyRadius(n);
  const sc = Math.min(1.7, (H * 0.3) / Math.max(r, 24), (W * 0.18) / r);
  const b = { id: 1, r, aim: -0.25, wpns: team.wpns.map((id) => ({ id, anim: 0, dur: 1 })) };
  c.save();
  c.translate(W / 2 - r * sc * 0.3, H * 0.6);
  c.scale(sc, sc);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath(); c.ellipse(0, r * 0.62, r * 1.1, r * 0.28, 0, 0, TAU); c.fill();
  const hop = Math.abs(Math.sin(t * 3)) * r * 0.12;
  c.translate(0, -hop);
  drawHeldWeapons(c, b, false, t);
  drawSlime(c, { r, col: bodyColor(team.members), members: team.members, look: 0.3, mood: 'happy', sq: Math.sin(t * 6) * 0.04, crown: n >= MAX_MEMBERS, t });
  drawHeldWeapons(c, b, true, t);
  c.restore();
}

/* ------------------------------- 地面 ------------------------------- */
/* 時代ごとの 地面を いちど だけ 大きな キャンバスに 描いておく */
const groundCache = {};
function groundFor(era) {
  if (!groundCache[era]) {
    for (const k of Object.keys(groundCache)) if (+k !== 0) delete groundCache[k];
    groundCache[era] = buildGround(era);
  }
  return groundCache[era];
}

function buildGround(era) {
  const E = ERAS[era];
  const cv = document.createElement('canvas');
  cv.width = WORLD_W; cv.height = WORLD_H;
  const c = cv.getContext('2d');
  const R = seeded(1000 + era * 77);
  const rx = (a, b) => a + R() * (b - a);
  c.fillStyle = E.ground[0];
  c.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let i = 0; i < 160; i++) {
    c.fillStyle = rgba(E.ground[1], 0.7);
    c.beginPath(); c.ellipse(rx(0, WORLD_W), rx(0, WORLD_H), rx(40, 150), rx(25, 80), rx(0, 3), 0, TAU); c.fill();
  }
  groundPattern(c, E.id, R);

  /* 小さな かざり */
  const inside = () => [rx(EDGE, WORLD_W - EDGE), rx(EDGE, WORLD_H - EDGE)];
  const scatter = (n, fn) => { for (let i = 0; i < n; i++) { const [x, y] = inside(); fn(c, x, y, R); } };
  switch (E.id) {
    case 'wild': scatter(260, tuft); scatter(90, flower); scatter(30, mushroom); scatter(26, bush); break;
    case 'stone': scatter(160, tuft); scatter(70, rock); scatter(22, bone); scatter(8, bonfire); break;
    case 'bronze': scatter(140, wheat); scatter(60, tuft); scatter(18, pot); scatter(30, rock); break;
    case 'iron': scatter(120, pebble); scatter(50, rock); scatter(26, ore); scatter(10, anvil); break;
    case 'castle': scatter(26, barrel); scatter(16, banner); scatter(60, pebble); break;
    case 'samurai': scatter(120, petal); scatter(24, lantern); scatter(30, rock); break;
    case 'machine': scatter(30, gear); scatter(24, crate); scatter(60, pebble); break;
    case 'future': scatter(40, pad); scatter(120, light); break;
  }

  /* はしっこ（出られないところ） */
  c.fillStyle = rgba(E.edge, 0.7);
  c.fillRect(0, 0, WORLD_W, EDGE); c.fillRect(0, WORLD_H - EDGE, WORLD_W, EDGE);
  c.fillRect(0, EDGE, EDGE, WORLD_H - EDGE * 2); c.fillRect(WORLD_W - EDGE, EDGE, EDGE, WORLD_H - EDGE * 2);
  c.strokeStyle = rgba(E.edge, 0.9); c.lineWidth = 4;
  c.strokeRect(EDGE, EDGE, WORLD_W - EDGE * 2, WORLD_H - EDGE * 2);
  const tall = TALL[E.id];
  for (let x = 30; x < WORLD_W; x += rx(70, 110)) { tall(c, x, EDGE * 0.8, R); }
  for (let y = EDGE + 40; y < WORLD_H - EDGE; y += rx(80, 120)) { tall(c, rx(20, EDGE * 0.7), y, R); tall(c, WORLD_W - rx(20, EDGE * 0.7), y + rx(-20, 20), R); }
  for (let x = 30; x < WORLD_W; x += rx(70, 110)) { tall(c, x, WORLD_H - rx(10, 40), R); }
  return cv;
}

function groundPattern(c, id, R) {
  c.save();
  if (id === 'castle') {
    c.strokeStyle = 'rgba(60,70,80,0.18)'; c.lineWidth = 2;
    for (let y = 0; y < WORLD_H; y += 64) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(WORLD_W, y); c.stroke();
      const off = (y / 64) % 2 ? 48 : 0;
      for (let x = off; x < WORLD_W; x += 96) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 64); c.stroke(); }
    }
  } else if (id === 'samurai') {
    c.strokeStyle = 'rgba(120,90,50,0.13)'; c.lineWidth = 2;
    for (let y = 0; y < WORLD_H; y += 18) {
      c.beginPath();
      for (let x = 0; x <= WORLD_W; x += 40) c.lineTo(x, y + Math.sin(x * 0.01 + y * 0.05) * 4);
      c.stroke();
    }
  } else if (id === 'machine') {
    c.strokeStyle = 'rgba(60,30,20,0.25)'; c.lineWidth = 2;
    for (let y = 0; y < WORLD_H; y += 30) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(WORLD_W, y); c.stroke();
      const off = (y / 30) % 2 ? 30 : 0;
      for (let x = off; x < WORLD_W; x += 60) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 30); c.stroke(); }
    }
  } else if (id === 'future') {
    c.strokeStyle = 'rgba(80,220,255,0.16)'; c.lineWidth = 2;
    for (let x = 0; x < WORLD_W; x += 100) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, WORLD_H); c.stroke(); }
    for (let y = 0; y < WORLD_H; y += 100) { c.beginPath(); c.moveTo(0, y); c.lineTo(WORLD_W, y); c.stroke(); }
  } else if (id === 'iron') {
    for (let i = 0; i < 600; i++) { c.fillStyle = `rgba(40,30,20,${0.08 + R() * 0.1})`; c.fillRect(R() * WORLD_W, R() * WORLD_H, 3, 3); }
  }
  c.restore();
}

/* 地面の 小物 */
function tuft(c, x, y) {
  c.strokeStyle = 'rgba(40,110,40,0.55)'; c.lineWidth = 2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x - 6, y - 7); c.moveTo(x, y); c.lineTo(x, y - 9); c.moveTo(x + 4, y); c.lineTo(x + 6, y - 7); c.stroke();
}
function flower(c, x, y, R) {
  const col = ['#ffffff', '#ffe14a', '#ff8ab0', '#a88aff'][Math.floor(R() * 4)];
  c.fillStyle = col;
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5; c.beginPath(); c.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.4, 0, TAU); c.fill(); }
  c.fillStyle = '#ffb000'; c.beginPath(); c.arc(x, y, 1.8, 0, TAU); c.fill();
}
function mushroom(c, x, y) {
  c.fillStyle = '#f4ead8'; c.fillRect(x - 2, y - 5, 4, 6);
  c.fillStyle = '#e04a3a'; c.beginPath(); c.ellipse(x, y - 5, 7, 5, 0, Math.PI, TAU); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x - 3, y - 7, 1.2, 0, TAU); c.arc(x + 2, y - 8, 1.4, 0, TAU); c.fill();
}
function bush(c, x, y) {
  c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.ellipse(x, y + 8, 26, 7, 0, 0, TAU); c.fill();
  for (const [dx, dy, r, col] of [[-12, 0, 12, '#3f9a45'], [12, 0, 12, '#3f9a45'], [0, -6, 14, '#4fb055']]) {
    c.fillStyle = col; c.beginPath(); c.arc(x + dx, y + dy, r, 0, TAU); c.fill();
  }
  c.fillStyle = 'rgba(255,255,255,0.2)'; c.beginPath(); c.arc(x - 4, y - 12, 5, 0, TAU); c.fill();
}
function rock(c, x, y, R) {
  const s = 6 + R() * 10;
  c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.ellipse(x, y + s * 0.4, s * 1.1, s * 0.35, 0, 0, TAU); c.fill();
  c.fillStyle = '#9a958a'; c.strokeStyle = '#6a665e'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(x - s, y + s * 0.3); c.lineTo(x - s * 0.7, y - s * 0.5); c.lineTo(x + s * 0.2, y - s * 0.8); c.lineTo(x + s, y - s * 0.1); c.lineTo(x + s * 0.8, y + s * 0.4); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.moveTo(x - s * 0.6, y - s * 0.4); c.lineTo(x + s * 0.1, y - s * 0.65); c.lineTo(x - s * 0.1, y - s * 0.2); c.closePath(); c.fill();
}
function pebble(c, x, y) { c.fillStyle = 'rgba(70,60,50,0.35)'; c.beginPath(); c.ellipse(x, y, 3, 2, 0, 0, TAU); c.fill(); }
function bone(c, x, y, R) {
  c.save(); c.translate(x, y); c.rotate(R() * 3);
  c.fillStyle = '#f4ecd8'; c.fillRect(-7, -1.5, 14, 3);
  for (const sx of [-7, 7]) for (const sy of [-1.6, 1.6]) { c.beginPath(); c.arc(sx, sy, 2.2, 0, TAU); c.fill(); }
  c.restore();
}
function bonfire(c, x, y) {
  c.fillStyle = '#8a8478';
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.beginPath(); c.arc(x + Math.cos(a) * 16, y + Math.sin(a) * 9, 4, 0, TAU); c.fill(); }
  c.strokeStyle = '#6b4423'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - 10, y + 3); c.lineTo(x + 10, y - 3); c.moveTo(x - 10, y - 3); c.lineTo(x + 10, y + 3); c.stroke();
  c.fillStyle = '#ff8a2a'; c.beginPath(); c.moveTo(x - 8, y); c.quadraticCurveTo(x, y - 30, x + 8, y); c.closePath(); c.fill();
  c.fillStyle = '#ffe14a'; c.beginPath(); c.moveTo(x - 4, y); c.quadraticCurveTo(x, y - 16, x + 4, y); c.closePath(); c.fill();
}
function wheat(c, x, y) {
  c.strokeStyle = '#b8902a'; c.lineWidth = 1.4;
  for (let i = -1; i <= 1; i++) {
    c.beginPath(); c.moveTo(x + i * 3, y); c.lineTo(x + i * 5, y - 14); c.stroke();
    c.fillStyle = '#e8c04a'; c.beginPath(); c.ellipse(x + i * 5, y - 16, 2, 5, i * 0.3, 0, TAU); c.fill();
  }
}
function pot(c, x, y) {
  c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.ellipse(x, y + 10, 11, 4, 0, 0, TAU); c.fill();
  c.fillStyle = '#c0703a'; c.strokeStyle = '#7a4018'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(x - 4, y - 14); c.lineTo(x + 4, y - 14); c.quadraticCurveTo(x + 14, y - 4, x + 5, y + 10); c.lineTo(x - 5, y + 10); c.quadraticCurveTo(x - 14, y - 4, x - 4, y - 14); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#2a1a10'; c.beginPath(); c.moveTo(x - 8, y - 2); c.lineTo(x + 8, y - 2); c.stroke();
}
function ore(c, x, y, R) {
  rock(c, x, y, R);
  c.fillStyle = R() < 0.5 ? '#ff8a3a' : '#9fe6ff';
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + (R() - 0.5) * 10, y - R() * 6, 1.8, 0, TAU); c.fill(); }
}
function anvil(c, x, y) {
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(x, y + 9, 18, 5, 0, 0, TAU); c.fill();
  c.fillStyle = '#3a3f45';
  c.beginPath(); c.moveTo(x - 18, y - 10); c.lineTo(x + 12, y - 10); c.quadraticCurveTo(x + 22, y - 10, x + 24, y - 6); c.lineTo(x + 10, y - 4); c.lineTo(x + 6, y + 2); c.lineTo(x + 10, y + 8); c.lineTo(x - 12, y + 8); c.lineTo(x - 8, y + 2); c.lineTo(x - 12, y - 4); c.closePath(); c.fill();
  c.fillStyle = '#5d646c'; c.fillRect(x - 18, y - 10, 30, 3);
}
function barrel(c, x, y) {
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(x, y + 12, 13, 4, 0, 0, TAU); c.fill();
  c.fillStyle = '#9a6234'; c.strokeStyle = '#5a3414'; c.lineWidth = 1.2;
  roundRect(c, x - 11, y - 14, 22, 26, 6); c.fill(); c.stroke();
  c.strokeStyle = '#4a4f55'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x - 11, y - 6); c.lineTo(x + 11, y - 6); c.moveTo(x - 11, y + 5); c.lineTo(x + 11, y + 5); c.stroke();
}
function banner(c, x, y, R) {
  c.strokeStyle = '#5a3414'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x, y - 40); c.stroke();
  c.fillStyle = R() < 0.5 ? '#3a6ae0' : '#e04a4a';
  c.beginPath(); c.moveTo(x, y - 40); c.lineTo(x + 20, y - 36); c.lineTo(x + 16, y - 28); c.lineTo(x + 20, y - 20); c.lineTo(x, y - 22); c.closePath(); c.fill();
  c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(x + 9, y - 30, 3, 0, TAU); c.fill();
}
function petal(c, x, y, R) { c.fillStyle = 'rgba(255,170,200,0.8)'; c.beginPath(); c.ellipse(x, y, 3.2, 2, R() * 3, 0, TAU); c.fill(); }
function lantern(c, x, y) {
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(x, y + 8, 12, 4, 0, 0, TAU); c.fill();
  c.fillStyle = '#a8a49a'; c.strokeStyle = '#6a665e'; c.lineWidth = 1.2;
  c.fillRect(x - 3, y - 10, 6, 18);
  c.beginPath(); c.moveTo(x - 12, y - 24); c.lineTo(x + 12, y - 24); c.lineTo(x + 6, y - 32); c.lineTo(x - 6, y - 32); c.closePath(); c.fill(); c.stroke();
  c.fillRect(x - 8, y - 24, 16, 12); c.strokeRect(x - 8, y - 24, 16, 12);
  c.fillStyle = '#ffe08a'; c.fillRect(x - 4, y - 21, 8, 6);
}
function gear(c, x, y, R) {
  const r = 8 + R() * 10;
  c.save(); c.translate(x, y); c.rotate(R() * 3);
  c.fillStyle = '#7a7f88'; c.strokeStyle = '#3a3f45'; c.lineWidth = 1.2;
  c.beginPath();
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16; const rr = i % 2 ? r : r * 1.25; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.62); }
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#4a4f55'; c.beginPath(); c.ellipse(0, 0, r * 0.35, r * 0.22, 0, 0, TAU); c.fill();
  c.restore();
}
function crate(c, x, y) {
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(x, y + 12, 16, 4, 0, 0, TAU); c.fill();
  c.fillStyle = '#b07a40'; c.strokeStyle = '#6a4418'; c.lineWidth = 1.4;
  c.fillRect(x - 14, y - 16, 28, 28); c.strokeRect(x - 14, y - 16, 28, 28);
  c.beginPath(); c.moveTo(x - 14, y - 16); c.lineTo(x + 14, y + 12); c.moveTo(x + 14, y - 16); c.lineTo(x - 14, y + 12); c.stroke();
}
function pad(c, x, y) {
  c.strokeStyle = 'rgba(80,240,255,0.55)'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(x, y, 22, 13, 0, 0, TAU); c.stroke();
  c.fillStyle = 'rgba(80,240,255,0.12)'; c.fill();
  c.beginPath(); c.ellipse(x, y, 12, 7, 0, 0, TAU); c.stroke();
}
function light(c, x, y, R) { c.fillStyle = R() < 0.5 ? 'rgba(255,90,220,0.6)' : 'rgba(80,240,255,0.6)'; c.fillRect(x, y, 3, 3); }

/* はしっこの 大きな もの */
const TALL = {
  wild(c, x, y, R) {
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(x, y + 4, 30, 9, 0, 0, TAU); c.fill();
    c.fillStyle = '#7a4c20'; c.fillRect(x - 6, y - 30, 12, 34);
    const s = 0.8 + R() * 0.5;
    for (const [dx, dy, r, col] of [[0, -58, 30, '#2f8a3a'], [-20, -40, 22, '#3a9a45'], [20, -40, 22, '#3a9a45'], [0, -70, 20, '#45ad50']]) {
      c.fillStyle = col; c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, TAU); c.fill();
    }
  },
  stone(c, x, y, R) {
    if (R() < 0.5) {
      c.fillStyle = '#8a6a44'; c.strokeStyle = '#4a3418'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x - 30, y); c.lineTo(x, y - 56); c.lineTo(x + 30, y); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#3a2a18'; c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x, y - 20); c.lineTo(x + 8, y); c.closePath(); c.fill();
      c.strokeStyle = '#6b4423'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 4, y - 50); c.lineTo(x - 10, y - 66); c.moveTo(x + 4, y - 50); c.lineTo(x + 10, y - 66); c.stroke();
    } else {
      c.fillStyle = '#8a857a'; c.strokeStyle = '#5a564e'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x - 26, y); c.lineTo(x - 20, y - 36); c.lineTo(x + 4, y - 48); c.lineTo(x + 26, y - 20); c.lineTo(x + 22, y); c.closePath(); c.fill(); c.stroke();
    }
  },
  bronze(c, x, y) {
    c.fillStyle = '#e8d8b0'; c.strokeStyle = '#8a7350'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(x, y - 14, 26, 18, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#c8a04a'; c.beginPath(); c.moveTo(x - 32, y - 22); c.lineTo(x, y - 56); c.lineTo(x + 32, y - 22); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#5a3a1a'; c.fillRect(x - 6, y - 16, 12, 16);
  },
  iron(c, x, y, R) {
    c.fillStyle = '#6a5a4e'; c.strokeStyle = '#3a2e26'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x - 24, y); c.lineTo(x - 18, y - 46); c.lineTo(x + 18, y - 46); c.lineTo(x + 24, y); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ff8a2a'; c.beginPath(); c.arc(x, y - 14, 9, Math.PI, TAU); c.fill();
    c.fillStyle = '#ffd25a'; c.beginPath(); c.arc(x, y - 12, 5, Math.PI, TAU); c.fill();
    if (R() < 0.6) { c.fillStyle = 'rgba(80,80,80,0.4)'; c.beginPath(); c.arc(x + 4, y - 60, 10, 0, TAU); c.arc(x - 2, y - 76, 13, 0, TAU); c.fill(); }
  },
  castle(c, x, y) {
    c.fillStyle = '#9aa2ac'; c.strokeStyle = '#5a626c'; c.lineWidth = 2;
    c.fillRect(x - 22, y - 70, 44, 72); c.strokeRect(x - 22, y - 70, 44, 72);
    for (let i = 0; i < 3; i++) { c.fillRect(x - 22 + i * 16, y - 80, 12, 10); c.strokeRect(x - 22 + i * 16, y - 80, 12, 10); }
    c.fillStyle = '#2a2f3a'; roundRect(c, x - 5, y - 52, 10, 16, 5); c.fill();
  },
  samurai(c, x, y, R) {
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(x, y + 4, 30, 9, 0, 0, TAU); c.fill();
    c.strokeStyle = '#5a3a2a'; c.lineWidth = 8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 6, y - 30, x + 4, y - 44); c.stroke();
    const s = 0.8 + R() * 0.4;
    for (const [dx, dy, r, col] of [[0, -56, 28, '#ffb0c8'], [-22, -44, 20, '#ff9ab8'], [22, -46, 20, '#ffc4d6'], [4, -72, 18, '#ffd0de']]) {
      c.fillStyle = col; c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, TAU); c.fill();
    }
  },
  machine(c, x, y, R) {
    c.fillStyle = '#6a3a2e'; c.strokeStyle = '#3a1e16'; c.lineWidth = 2;
    c.fillRect(x - 12, y - 80, 24, 82); c.strokeRect(x - 12, y - 80, 24, 82);
    c.fillStyle = '#3a1e16'; c.fillRect(x - 15, y - 84, 30, 6);
    c.fillStyle = 'rgba(90,90,90,0.4)';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + i * 8 + R() * 6, y - 96 - i * 18, 10 + i * 4, 0, TAU); c.fill(); }
  },
  future(c, x, y, R) {
    const hgt = 60 + R() * 60;
    c.fillStyle = '#121a33'; c.strokeStyle = R() < 0.5 ? '#4ff0ff' : '#ff5ad9'; c.lineWidth = 2;
    c.fillRect(x - 16, y - hgt, 32, hgt + 2); c.strokeRect(x - 16, y - hgt, 32, hgt + 2);
    c.fillStyle = 'rgba(255,240,150,0.7)';
    for (let yy = y - hgt + 8; yy < y - 8; yy += 12) for (const xx of [-9, 3]) if (R() < 0.6) c.fillRect(x + xx, yy, 6, 5);
  },
};
