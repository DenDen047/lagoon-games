/* =========================================================================
   WILD INN ― 絵
   動物 (横向き) / 人 / 家具 / 画面で使う小さなアイコン
   絵はすべてプログラムで描く
   ========================================================================= */
'use strict';

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}
/* ぬって、ふちをかく */
function fs(ctx, fill, line, lw = 1.3) {
  ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(); }
}
function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.45, y - s, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
}

/* =========================================================================
   動物
   look = { sp, c (色の番号) }
   o    = { dir: 'l'|'r', t, walk, moving, sleep, happy, eat }
   (0, 0) が足もと。右向きに描いて、左向きは裏返す
   ========================================================================= */
function drawPet(ctx, x, y, look, o = {}) {
  const S = SPECIES[look.sp], P = S.cols[look.c] || S.cols[0];
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(40,30,20,0.18)';
  ellipse(ctx, 0, 0, SHADOW[look.sp] || 12, 3.5); ctx.fill();
  if (o.hop) ctx.translate(0, -o.hop);
  if (o.dir === 'l') ctx.scale(-1, 1);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  PET_ART[look.sp](ctx, P, o);
  ctx.restore();
}
const SHADOW = { dog: 15, cat: 13, rabbit: 11, hamster: 10, chameleon: 12, sloth: 11, macaw: 9, orangutan: 15, lion: 19, zebra: 18, giraffe: 17, meerkat: 8, fennec: 11, camel: 20, lizard: 13, penguin: 10, seal: 16, polarbear: 20 };

const swing = (o, ph, a = 3) => (o.moving ? Math.sin(o.walk + ph) * a : 0);
function leg(ctx, x, y0, w, col, sw, line) {
  ctx.lineCap = 'round';
  if (line) {
    ctx.strokeStyle = line; ctx.lineWidth = w + 2.2;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + sw, -w / 2); ctx.stroke();
  }
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + sw, -w / 2); ctx.stroke();
}
function eye(ctx, x, y, r, o) {
  ctx.lineCap = 'round';
  if (o.sleep) {
    ctx.strokeStyle = '#2a2020'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y - r * 0.3, r, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    return;
  }
  if (o.happy) {
    ctx.strokeStyle = '#2a2020'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y + r * 0.6, r, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    return;
  }
  ctx.fillStyle = '#231a18'; ellipse(ctx, x, y, r, r * 1.12); ctx.fill();
  ctx.fillStyle = '#fff'; ellipse(ctx, x + r * 0.3, y - r * 0.4, r * 0.4, r * 0.4); ctx.fill();
}
function cheek(ctx, x, y, r = 2.2) {
  ctx.fillStyle = 'rgba(255,120,130,0.35)'; ellipse(ctx, x, y, r, r * 0.7); ctx.fill();
}
function tailWag(o) { return o.happy ? Math.sin(o.t * 16) * 0.5 : o.moving ? Math.sin(o.walk * 0.5) * 0.25 : Math.sin(o.t * 1.5) * 0.1; }

const PET_ART = {
  dog(ctx, P, o) {
    const ol = shade(P.base, -0.45), L = o.sleep ? 0 : 10, by = -(L + 8);
    if (L) { leg(ctx, -9, by + 3, 4.5, shade(P.base, -0.15), swing(o, Math.PI), ol); leg(ctx, 7, by + 3, 4.5, shade(P.base, -0.15), swing(o, 0), ol); }
    ctx.save(); ctx.translate(-13, by - 3); ctx.rotate(-0.6 + tailWag(o));
    ellipse(ctx, 0, -6, 2.6, 7); fs(ctx, P.base, ol); ctx.restore();
    ellipse(ctx, -2, by, 13, 8.5); fs(ctx, P.base, ol);
    ellipse(ctx, 0, by + 3, 9, 4.5); ctx.fillStyle = P.sub; ctx.fill();
    if (L) { leg(ctx, -5, by + 4, 4.5, P.base, swing(o, 0), ol); leg(ctx, 10, by + 4, 4.5, P.base, swing(o, Math.PI), ol); }
    const hx = 12, hy = by - (o.sleep ? 2 : 9) + (o.eat ? 5 : 0);
    ellipse(ctx, hx, hy, 8.5, 8); fs(ctx, P.base, ol);
    ellipse(ctx, hx + 7, hy + 3, 5.5, 4); fs(ctx, P.sub, ol, 1);
    ctx.fillStyle = '#2a2020'; ellipse(ctx, hx + 11.5, hy + 1.5, 2, 1.6); ctx.fill();
    ctx.save(); ctx.translate(hx - 3, hy - 4); ctx.rotate(0.35 + (o.happy ? Math.sin(o.t * 16) * 0.15 : 0));
    ellipse(ctx, 0, 5, 3.6, 7); fs(ctx, P.dark, shade(P.dark, -0.3)); ctx.restore();
    eye(ctx, hx + 3.5, hy - 2, 1.7, o);
    cheek(ctx, hx + 3, hy + 3);
  },
  cat(ctx, P, o) {
    const ol = shade(P.base, -0.45), L = o.sleep ? 0 : 9, by = -(L + 7);
    if (L) { leg(ctx, -8, by + 3, 4, shade(P.base, -0.15), swing(o, Math.PI), ol); leg(ctx, 6, by + 3, 4, shade(P.base, -0.15), swing(o, 0), ol); }
    ctx.save(); ctx.translate(-12, by - 1); ctx.rotate(-0.9 + tailWag(o));
    ctx.strokeStyle = ol; ctx.lineWidth = 5.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-4, -10, 2, -16); ctx.stroke();
    ctx.strokeStyle = P.base; ctx.lineWidth = 3.4; ctx.stroke(); ctx.restore();
    ellipse(ctx, -2, by, 12, 7); fs(ctx, P.base, ol);
    ellipse(ctx, 0, by + 3, 8, 3.5); ctx.fillStyle = P.sub; ctx.fill();
    if (P.dark && P.base !== '#3a3438') {
      ctx.strokeStyle = rgba(P.dark.length === 7 ? P.dark : '#000000', 0.45); ctx.lineWidth = 1.8;
      for (const sx of [-8, -3, 2]) { ctx.beginPath(); ctx.moveTo(sx, by - 6.5); ctx.lineTo(sx + 1, by - 2); ctx.stroke(); }
    }
    if (L) { leg(ctx, -4, by + 4, 4, P.base, swing(o, 0), ol); leg(ctx, 8, by + 4, 4, P.base, swing(o, Math.PI), ol); }
    const hx = 11, hy = by - (o.sleep ? 1 : 8) + (o.eat ? 5 : 0);
    for (const ex of [-4, 3]) {
      ctx.beginPath(); ctx.moveTo(hx + ex - 3, hy - 4); ctx.lineTo(hx + ex, hy - 12); ctx.lineTo(hx + ex + 3.5, hy - 4); ctx.closePath();
      fs(ctx, P.base, ol);
    }
    ellipse(ctx, hx, hy, 8, 7); fs(ctx, P.base, ol);
    ellipse(ctx, hx + 5, hy + 2.5, 3.6, 2.6); ctx.fillStyle = P.sub; ctx.fill();
    ctx.fillStyle = '#ff8fa3'; ellipse(ctx, hx + 7.5, hy + 1, 1.3, 1); ctx.fill();
    eye(ctx, hx + 2.5, hy - 1.5, 1.6, o);
    ctx.strokeStyle = 'rgba(80,60,60,0.5)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(hx + 7, hy + 3); ctx.lineTo(hx + 13, hy + 2); ctx.moveTo(hx + 7, hy + 3.6); ctx.lineTo(hx + 13, hy + 4.6); ctx.stroke();
  },
  rabbit(ctx, P, o) {
    const ol = shade(P.base, -0.4), hopY = o.moving ? Math.abs(Math.sin(o.walk * 0.5)) * 4 : 0, by = -9 - hopY;
    ellipse(ctx, -10, by - 1, 3.5, 3.5); fs(ctx, '#ffffff', ol, 1);
    ellipse(ctx, -2, by, 11, 8.5); fs(ctx, P.base, ol);
    ellipse(ctx, -6, by + 5, 6, 3.6); fs(ctx, P.base, ol, 1);
    ellipse(ctx, 5, by + 7, 2.5, 1.8); fs(ctx, P.base, ol, 1);
    const hx = 7, hy = by - 7 + (o.eat ? 4 : 0) + (o.sleep ? 4 : 0);
    const ear = o.sleep ? 1.1 : 0.25 + Math.sin(o.t * 2) * 0.05;
    for (const [ex, rot] of [[-2, ear + 0.15], [1, ear]]) {
      ctx.save(); ctx.translate(hx + ex, hy - 5); ctx.rotate(-rot);
      ellipse(ctx, 0, -8, 3, 8.5); fs(ctx, P.base, ol);
      ellipse(ctx, 0, -8, 1.4, 6); ctx.fillStyle = '#ffb3c0'; ctx.fill(); ctx.restore();
    }
    ellipse(ctx, hx, hy, 7, 6.5); fs(ctx, P.base, ol);
    ctx.fillStyle = '#ff8fa3'; ellipse(ctx, hx + 6.5, hy + 1, 1.3, 1.1); ctx.fill();
    eye(ctx, hx + 2.5, hy - 1, 1.6, o);
    cheek(ctx, hx + 2, hy + 3);
  },
  hamster(ctx, P, o) {
    const ol = shade(P.base, -0.45), bob = o.moving ? Math.abs(Math.sin(o.walk)) * 1.5 : 0, by = -7.5 - bob;
    ctx.fillStyle = '#f2a6a6';
    for (const fx of [-5, 4]) { ellipse(ctx, fx + swing(o, fx, 1.5), -1, 2, 1.3); ctx.fill(); }
    ellipse(ctx, 0, by, 10.5, 7.8); fs(ctx, P.base, ol);
    ellipse(ctx, 2, by + 2.5, 7, 4.5); ctx.fillStyle = P.sub; ctx.fill();
    ellipse(ctx, 1, by - 7, 2.6, 2.3); fs(ctx, P.base, ol, 1);
    ellipse(ctx, 1, by - 7, 1.4, 1.2); ctx.fillStyle = '#f5b0b0'; ctx.fill();
    ellipse(ctx, 7, by + 1, 3.6, 3); ctx.fillStyle = o.eat ? shade(P.sub, -0.05) : P.sub; ctx.fill();
    if (o.eat) { ellipse(ctx, 7, by + 1.5, 4.5, 3.8); ctx.strokeStyle = ol; ctx.lineWidth = 0.8; ctx.stroke(); }
    ctx.fillStyle = '#ff8fa3'; ellipse(ctx, 10.3, by - 0.5, 1.1, 0.9); ctx.fill();
    eye(ctx, 6, by - 2.5, 1.4, o);
  },
  chameleon(ctx, P, o) {
    const k = (Math.sin(o.t * 0.6) + 1) / 2;
    const base = k > 0.5 ? P.base : shade(P.base, 0.15), ol = shade(P.base, -0.5);
    const by = -9;
    leg(ctx, -5, by + 3, 2.2, shade(base, -0.2), swing(o, 0, 2), ol);
    leg(ctx, 5, by + 3, 2.2, shade(base, -0.2), swing(o, Math.PI, 2), ol);
    ctx.strokeStyle = ol; ctx.lineWidth = 4.6;
    ctx.beginPath(); ctx.moveTo(-8, by + 1); ctx.quadraticCurveTo(-15, by + 2, -15, by - 4); ctx.arc(-12, by - 4, 3, Math.PI, Math.PI * 2.6); ctx.stroke();
    ctx.strokeStyle = base; ctx.lineWidth = 2.8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, by); ctx.quadraticCurveTo(-2, by - 12, 8, by - 3); ctx.quadraticCurveTo(4, by + 6, -10, by); fs(ctx, base, ol);
    ctx.fillStyle = rgba(P.sub, 0.7);
    for (const sx of [-5, -1, 3]) { ellipse(ctx, sx, by - 1, 1.6, 1.2); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(5, by - 4); ctx.lineTo(9, by - 11); ctx.lineTo(15, by - 3); ctx.quadraticCurveTo(12, by + 2, 6, by + 1); ctx.closePath(); fs(ctx, base, ol);
    leg(ctx, -2, by + 3, 2.2, base, swing(o, Math.PI, 2), ol);
    leg(ctx, 8, by + 2, 2.2, base, swing(o, 0, 2), ol);
    ellipse(ctx, 10, by - 3.5, 3, 3); fs(ctx, P.sub, ol, 1);
    if (o.sleep) eye(ctx, 10.5, by - 3.5, 1.4, o);
    else { ctx.fillStyle = '#231a18'; ellipse(ctx, 10.8 + Math.sin(o.t * 1.7) * 0.8, by - 3.5, 1.2, 1.2); ctx.fill(); }
    if (o.eat) { ctx.strokeStyle = '#ff7a9a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(14, by - 1); ctx.lineTo(14 + 8 * Math.abs(Math.sin(o.t * 6)), by - 2); ctx.stroke(); }
  },
  sloth(ctx, P, o) {
    const ol = shade(P.base, -0.45), by = -13, sway = Math.sin(o.t * 1.2) * 0.8;
    ellipse(ctx, sway, by, 10.5, 12); fs(ctx, P.base, ol);
    ctx.strokeStyle = ol; ctx.lineWidth = 5.2;
    const arm = o.moving ? Math.sin(o.walk) * 2 : 0;
    ctx.beginPath(); ctx.moveTo(5, by - 4); ctx.quadraticCurveTo(12, by + 2, 9 + arm, -1); ctx.stroke();
    ctx.strokeStyle = shade(P.base, -0.1); ctx.lineWidth = 3.4; ctx.stroke();
    ctx.strokeStyle = '#f2ead8'; ctx.lineWidth = 1;
    for (const c of [-1.2, 0, 1.2]) { ctx.beginPath(); ctx.moveTo(9 + arm + c, -2); ctx.lineTo(11 + arm + c, 0); ctx.stroke(); }
    const hx = 4 + sway, hy = by - 9 + (o.sleep ? 2 : 0);
    ellipse(ctx, hx, hy, 8, 7); fs(ctx, P.base, ol);
    ellipse(ctx, hx + 2, hy + 0.5, 6, 5); ctx.fillStyle = P.sub; ctx.fill();
    ctx.fillStyle = P.dark;
    ellipse(ctx, hx - 0.5, hy - 0.5, 2.4, 1.5, 0.3); ctx.fill();
    ellipse(ctx, hx + 4.5, hy - 0.5, 2.4, 1.5, -0.3); ctx.fill();
    if (o.sleep || o.happy) { eye(ctx, hx - 0.5, hy - 0.4, 1.1, o); eye(ctx, hx + 4.5, hy - 0.4, 1.1, o); }
    else {
      ctx.fillStyle = '#fff'; ellipse(ctx, hx - 0.2, hy - 0.8, 0.5, 0.5); ctx.fill(); ellipse(ctx, hx + 4.8, hy - 0.8, 0.5, 0.5); ctx.fill();
    }
    ctx.fillStyle = '#3a2a24'; ellipse(ctx, hx + 2, hy + 2, 1.3, 0.9); ctx.fill();
    ctx.strokeStyle = '#3a2a24'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(hx + 2, hy + 2.6, 2, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  },
  macaw(ctx, P, o) {
    const ol = shade(P.base, -0.45), hop = o.moving ? Math.abs(Math.sin(o.walk)) * 2 : 0;
    ctx.strokeStyle = '#6a6a72'; ctx.lineWidth = 1.6;
    for (const fx of [-1.5, 2]) { ctx.beginPath(); ctx.moveTo(fx, -6 - hop); ctx.lineTo(fx + 0.5, 0); ctx.stroke(); }
    ctx.save(); ctx.translate(-3, -10 - hop); ctx.rotate(0.55);
    ellipse(ctx, 0, 9, 2.6, 11); fs(ctx, P.base, ol); ellipse(ctx, 1, 9, 1, 9); ctx.fillStyle = P.dark; ctx.fill(); ctx.restore();
    ellipse(ctx, 0, -15 - hop, 7.5, 10.5, 0.15); fs(ctx, P.base, ol);
    const wf = o.happy ? Math.sin(o.t * 20) * 0.4 : 0;
    ctx.save(); ctx.translate(-1, -18 - hop); ctx.rotate(0.35 - wf);
    ellipse(ctx, -1, 5, 4.6, 9); fs(ctx, P.dark, shade(P.dark, -0.35));
    ellipse(ctx, 0, 0, 4, 4.5); ctx.fillStyle = P.sub; ctx.fill(); ctx.restore();
    const hx = 4, hy = -27 - hop + (o.eat ? 3 : 0);
    ellipse(ctx, hx, hy, 6.5, 6.2); fs(ctx, P.base, ol);
    ellipse(ctx, hx + 3, hy, 3.2, 2.8); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx + 5, hy - 2.5); ctx.quadraticCurveTo(hx + 12, hy - 2, hx + 9.5, hy + 4.5); ctx.lineTo(hx + 6, hy + 2.5); ctx.closePath(); fs(ctx, '#3a3438', '#1a1618', 1);
    ctx.beginPath(); ctx.moveTo(hx + 5.5, hy + 1.5); ctx.lineTo(hx + 8, hy + 3.5); ctx.lineTo(hx + 5.5, hy + 3.8); ctx.closePath(); ctx.fillStyle = '#e8e2d8'; ctx.fill();
    eye(ctx, hx + 2.8, hy - 0.6, 1.4, o);
  },
  orangutan(ctx, P, o) {
    const ol = shade(P.base, -0.45), by = -16, sw = swing(o, 0, 2.5);
    ctx.strokeStyle = ol; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-4, by + 4); ctx.lineTo(-8 - sw, -3); ctx.stroke();
    ctx.strokeStyle = shade(P.base, -0.15); ctx.lineWidth = 5; ctx.stroke();
    ellipse(ctx, -2, by, 12, 12); fs(ctx, P.base, ol);
    ctx.strokeStyle = shade(P.base, -0.2); ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-10 + i * 3, by + 6); ctx.lineTo(-11 + i * 3, by + 11); ctx.stroke(); }
    ctx.strokeStyle = ol; ctx.lineWidth = 7.4;
    ctx.beginPath(); ctx.moveTo(6, by - 4); ctx.quadraticCurveTo(14, by + 4, 12 + sw, -3); ctx.stroke();
    ctx.strokeStyle = P.base; ctx.lineWidth = 5.4; ctx.stroke();
    const hx = 6, hy = by - 10 + (o.eat ? 2 : 0) + (o.sleep ? 3 : 0);
    ellipse(ctx, hx - 1, hy - 1, 9, 9); fs(ctx, P.base, ol);
    ellipse(ctx, hx + 2.5, hy + 1, 6.5, 6.5); fs(ctx, '#7a5444', '#4a3024', 1);
    ellipse(ctx, hx + 4, hy + 3.5, 3.6, 2.4); ctx.fillStyle = '#9a7262'; ctx.fill();
    eye(ctx, hx + 1.2, hy - 0.5, 1.2, o); eye(ctx, hx + 5, hy - 0.5, 1.2, o);
    ctx.strokeStyle = '#3a2018'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(hx + 4, hy + 3.5, 1.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  },
  lion(ctx, P, o) {
    const ol = shade(P.base, -0.45), L = o.sleep ? 0 : 12, by = -(L + 10);
    if (L) { leg(ctx, -12, by + 4, 6, shade(P.base, -0.15), swing(o, Math.PI), ol); leg(ctx, 9, by + 4, 6, shade(P.base, -0.15), swing(o, 0), ol); }
    ctx.save(); ctx.translate(-17, by - 2); ctx.rotate(0.6 + tailWag(o));
    ctx.strokeStyle = ol; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-10, 4, -12, 14); ctx.stroke();
    ctx.strokeStyle = P.base; ctx.lineWidth = 1.8; ctx.stroke();
    ellipse(ctx, -12, 15, 2.8, 3.6); fs(ctx, P.dark, shade(P.dark, -0.3), 1); ctx.restore();
    ellipse(ctx, -3, by, 17, 10); fs(ctx, P.base, ol);
    ellipse(ctx, -1, by + 4, 12, 4.5); ctx.fillStyle = P.sub; ctx.fill();
    if (L) { leg(ctx, -7, by + 5, 6, P.base, swing(o, 0), ol); leg(ctx, 13, by + 5, 6, P.base, swing(o, Math.PI), ol); }
    const hx = 15, hy = by - (o.sleep ? 0 : 8) + (o.eat ? 5 : 0);
    ctx.fillStyle = P.dark;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ellipse(ctx, hx - 2 + Math.cos(a) * 9, hy + Math.sin(a) * 9, 5.5, 5.5); ctx.fill();
    }
    ellipse(ctx, hx - 2, hy, 11.5, 11.5); ctx.strokeStyle = shade(P.dark, -0.3); ctx.lineWidth = 1.2; ctx.stroke();
    ellipse(ctx, hx - 2, hy, 10.5, 10.5); ctx.fillStyle = P.dark; ctx.fill();
    for (const ex of [-6, 2]) { ellipse(ctx, hx + ex, hy - 7, 2.6, 2.6); fs(ctx, P.base, ol, 1); }
    ellipse(ctx, hx, hy, 7.5, 7); fs(ctx, P.base, ol);
    ellipse(ctx, hx + 4.5, hy + 3, 4.4, 3.4); ctx.fillStyle = P.sub; ctx.fill();
    ctx.fillStyle = '#6a3a2a'; ellipse(ctx, hx + 7, hy + 1.2, 1.8, 1.3); ctx.fill();
    eye(ctx, hx + 2.5, hy - 2, 1.5, o);
  },
  zebra(ctx, P, o) {
    const ol = '#2a282e', L = o.sleep ? 0 : 16, by = -(L + 9);
    const hoof = (x, ph, far) => {
      if (!L) return;
      const s = swing(o, ph);
      leg(ctx, x, by + 4, 4, far ? '#dcdad4' : P.base, s, ol);
      ctx.fillStyle = ol; ellipse(ctx, x + s, -1.6, 2.4, 1.6); ctx.fill();
      ctx.strokeStyle = P.dark; ctx.lineWidth = 1.2;
      for (const yy of [by + 9, by + 14, by + 19]) { if (yy > -3) continue; const k = (yy - by - 4) / (-(by + 4)); ctx.beginPath(); ctx.moveTo(x + s * k - 2, yy); ctx.lineTo(x + s * k + 2, yy); ctx.stroke(); }
    };
    hoof(-11, Math.PI, true); hoof(8, 0, true);
    ctx.save(); ctx.translate(-17, by - 3); ctx.rotate(0.4 + tailWag(o));
    ctx.strokeStyle = ol; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-3, 11); ctx.stroke();
    ellipse(ctx, -3.5, 13, 2, 3.5); ctx.fillStyle = ol; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(8, by - 4); ctx.lineTo(16, by - 22); ctx.lineTo(22, by - 18); ctx.lineTo(15, by + 2); ctx.closePath(); fs(ctx, P.base, ol);
    ellipse(ctx, -2, by, 16, 9); fs(ctx, P.base, ol);
    ctx.save(); ellipse(ctx, -2, by, 15.4, 8.4); ctx.clip();
    ctx.strokeStyle = P.dark; ctx.lineWidth = 2.2;
    for (let i = -14; i <= 12; i += 4.5) { ctx.beginPath(); ctx.moveTo(i, by - 10); ctx.quadraticCurveTo(i + 2.5, by, i - 1, by + 8); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.moveTo(8, by - 4); ctx.lineTo(16, by - 22); ctx.lineTo(22, by - 18); ctx.lineTo(15, by + 2); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = P.dark; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(8, by - 2 - i * 4.5); ctx.lineTo(22, by - 6 - i * 4.5); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = ol; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(9, by - 6); ctx.lineTo(16, by - 23); ctx.stroke();
    hoof(-6, 0, false); hoof(12, Math.PI, false);
    const hx = 18, hy = by - 23 + (o.eat ? 10 : 0) + (o.sleep ? 8 : 0), ha = o.eat ? 1.3 : 0.95;
    ellipse(ctx, hx - 1, hy - 4, 1.8, 3.6, -0.3); fs(ctx, P.base, ol, 1);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ha);
    ellipse(ctx, 6.5, 0, 9, 4.8); fs(ctx, P.base, ol);
    ellipse(ctx, 13, 0, 3.6, 3.9); ctx.fillStyle = '#3a383e'; ctx.fill();
    ctx.strokeStyle = P.dark; ctx.lineWidth = 1.3;
    for (const xx of [1, 4, 7]) { ctx.beginPath(); ctx.moveTo(xx, -4.4); ctx.lineTo(xx + 0.5, 4.4); ctx.stroke(); }
    ctx.restore();
    eye(ctx, hx + Math.cos(ha) * 4.5 + Math.sin(ha) * 2, hy + Math.sin(ha) * 4.5 - Math.cos(ha) * 2, 1.3, o);
  },
  giraffe(ctx, P, o) {
    const ol = shade(P.dark, -0.2), L = o.sleep ? 2 : 26, by = -(L + 9);
    const legC = (x, ph, far) => {
      const s = L > 4 ? swing(o, ph, 3.5) : 0;
      leg(ctx, x, by + 4, 4, far ? shade(P.base, -0.12) : P.base, s, ol);
      ctx.fillStyle = '#5a3a20'; ellipse(ctx, x + s, -1.5, 2.2, 1.5); ctx.fill();
    };
    legC(-11, Math.PI, true); legC(7, 0, true);
    ctx.save(); ctx.translate(-16, by - 3); ctx.rotate(0.3 + tailWag(o));
    ctx.strokeStyle = ol; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2, 13); ctx.stroke();
    ellipse(ctx, -2.2, 14, 1.8, 2.6); ctx.fillStyle = '#3a2614'; ctx.fill(); ctx.restore();
    const nb = o.sleep ? 0.9 : 0;
    const nx1 = 15 + nb * 10, ny1 = by - 34 + nb * 26 + (o.eat ? 12 : 0);
    const neck = () => { ctx.beginPath(); ctx.moveTo(4, by - 6); ctx.lineTo(nx1 - 3, ny1); ctx.lineTo(nx1 + 4, ny1 + 2); ctx.lineTo(13, by + 1); ctx.closePath(); };
    neck(); fs(ctx, P.base, ol);
    ellipse(ctx, -3, by, 15, 9); fs(ctx, P.base, ol);
    ctx.save(); ellipse(ctx, -3, by, 14.4, 8.4); neck(); ctx.clip();
    ctx.fillStyle = P.dark;
    for (let i = 0; i < 16; i++) {
      const sx = -16 + (i % 6) * 5.5 + ((i / 6) | 0) * 2.5, sy = by - 6 + ((i / 6) | 0) * 5.5;
      rrect(ctx, sx, sy, 4, 3.6, 1.2); ctx.fill();
    }
    for (let i = 0; i < 6; i++) {
      const t = i / 6, sx = lerp(6, nx1 - 1, t), sy = lerp(by - 4, ny1 + 2, t);
      rrect(ctx, sx - 1, sy - 1.5, 4.5, 3.2, 1.2); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(5, by - 7); ctx.lineTo(nx1 - 3.5, ny1 + 1); ctx.stroke();
    legC(-6, 0, false); legC(11, Math.PI, false);
    const hx = nx1 + 1, hy = ny1 - 2;
    ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 1.6;
    for (const ex of [-2, 1]) { ctx.beginPath(); ctx.moveTo(hx + ex, hy - 3); ctx.lineTo(hx + ex - 0.5, hy - 8); ctx.stroke(); ctx.fillStyle = '#5a3a1a'; ellipse(ctx, hx + ex - 0.5, hy - 8.5, 1.4, 1.4); ctx.fill(); }
    ellipse(ctx, hx - 4, hy - 2, 1.8, 3.2, -0.9); fs(ctx, P.base, ol, 1);
    ellipse(ctx, hx + 3, hy, 7.5, 4.5, 0.25); fs(ctx, P.base, ol);
    ellipse(ctx, hx + 8, hy + 2, 3.2, 2.6); ctx.fillStyle = P.sub; ctx.fill();
    eye(ctx, hx + 1.5, hy - 1.2, 1.3, o);
  },
  meerkat(ctx, P, o) {
    const ol = shade(P.base, -0.45), bob = o.moving ? 0 : Math.sin(o.t * 2) * 0.6, by = -14;
    if (o.moving && !o.sleep) {
      ctx.save(); ctx.translate(0, 6); ctx.rotate(1.2);
    }
    ctx.strokeStyle = ol; ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(-3, by + 10); ctx.quadraticCurveTo(-11, by + 12, -12, -1); ctx.stroke();
    ctx.strokeStyle = P.base; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.fillStyle = '#3a2a1a'; ellipse(ctx, -12, -1.5, 1.4, 1.6); ctx.fill();
    ellipse(ctx, 0, by + bob, 6.5, 11.5); fs(ctx, P.base, ol);
    ellipse(ctx, 1.8, by + 2 + bob, 3.6, 8); ctx.fillStyle = P.sub; ctx.fill();
    ctx.fillStyle = shade(P.base, -0.2);
    for (const fx of [-2, 2.5]) { ellipse(ctx, fx, -1.2, 2.4, 1.4); ctx.fill(); }
    ctx.strokeStyle = ol; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(3, by - 4 + bob); ctx.lineTo(5.5, by - 1 + bob); ctx.stroke();
    const hx = 2, hy = by - 13 + bob + (o.sleep ? 3 : 0);
    ellipse(ctx, hx - 2.5, hy - 2.5, 1.8, 1.8); fs(ctx, P.dark, null);
    ellipse(ctx, hx, hy, 5.2, 4.6); fs(ctx, P.base, ol);
    ctx.beginPath(); ctx.moveTo(hx + 2, hy - 2.5); ctx.lineTo(hx + 8, hy + 0.5); ctx.lineTo(hx + 2, hy + 3); ctx.closePath(); fs(ctx, P.sub, ol, 1);
    ctx.fillStyle = '#2a2018'; ellipse(ctx, hx + 7.8, hy + 0.4, 1, 0.9); ctx.fill();
    ellipse(ctx, hx + 1, hy - 0.5, 2.4, 1.8, -0.2); ctx.fillStyle = P.dark; ctx.fill();
    eye(ctx, hx + 1.2, hy - 0.6, 1.1, o);
    if (o.moving && !o.sleep) ctx.restore();
  },
  fennec(ctx, P, o) {
    const ol = shade(P.base, -0.45), L = o.sleep ? 0 : 8, by = -(L + 6);
    if (L) { leg(ctx, -7, by + 2, 3, shade(P.base, -0.12), swing(o, Math.PI), ol); leg(ctx, 5, by + 2, 3, shade(P.base, -0.12), swing(o, 0), ol); }
    ctx.save(); ctx.translate(-10, by); ctx.rotate(-0.3 + tailWag(o));
    ellipse(ctx, -6, 2, 8, 4, 0.3); fs(ctx, P.base, ol);
    ellipse(ctx, -12, 4, 3, 2.6); ctx.fillStyle = '#3a2a1a'; ctx.fill(); ctx.restore();
    ellipse(ctx, -1, by, 10, 6); fs(ctx, P.base, ol);
    ellipse(ctx, 0, by + 2.5, 7, 3); ctx.fillStyle = P.sub; ctx.fill();
    if (L) { leg(ctx, -3, by + 3, 3, P.base, swing(o, 0), ol); leg(ctx, 7, by + 3, 3, P.base, swing(o, Math.PI), ol); }
    const hx = 9, hy = by - 6 + (o.eat ? 4 : 0) + (o.sleep ? 2 : 0);
    for (const [ex, rot] of [[-3, -0.35], [1.5, 0.1]]) {
      ctx.save(); ctx.translate(hx + ex, hy - 3); ctx.rotate(rot);
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(0, -15); ctx.lineTo(4, 0); ctx.closePath(); fs(ctx, P.base, ol);
      ctx.beginPath(); ctx.moveTo(-2, -1); ctx.lineTo(0, -11); ctx.lineTo(2, -1); ctx.closePath(); ctx.fillStyle = '#f5c0b0'; ctx.fill();
      ctx.restore();
    }
    ellipse(ctx, hx, hy, 5.6, 5); fs(ctx, P.base, ol);
    ctx.beginPath(); ctx.moveTo(hx + 3, hy - 1.5); ctx.lineTo(hx + 10, hy + 1.5); ctx.lineTo(hx + 3, hy + 3.5); ctx.closePath(); fs(ctx, P.sub, ol, 1);
    ctx.fillStyle = '#2a2018'; ellipse(ctx, hx + 9.6, hy + 1.3, 1.1, 1); ctx.fill();
    eye(ctx, hx + 2, hy - 1, 1.4, o);
  },
  camel(ctx, P, o) {
    const ol = shade(P.base, -0.45), L = o.sleep ? 2 : 22, by = -(L + 10);
    const legC = (x, ph, far) => {
      const s = L > 4 ? swing(o, ph, 3) : 0;
      leg(ctx, x, by + 4, 4.5, far ? shade(P.base, -0.12) : P.base, s, ol);
      ellipse(ctx, x + s * 0.5, by + 4 + L * 0.5, 2.6, 2.2); ctx.fillStyle = far ? shade(P.base, -0.12) : P.base; ctx.fill();
    };
    legC(-11, Math.PI, true); legC(8, 0, true);
    ctx.save(); ctx.translate(-17, by - 2); ctx.rotate(0.3 + tailWag(o));
    ctx.strokeStyle = ol; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2, 9); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-14, by - 2); ctx.quadraticCurveTo(-4, by - 22, 6, by - 4); ctx.closePath(); fs(ctx, P.base, ol);
    ellipse(ctx, -3, by, 17, 9.5); fs(ctx, P.base, ol);
    ellipse(ctx, -4, by - 8, 7, 4); ctx.fillStyle = P.base; ctx.fill();
    ctx.fillStyle = rgba(P.sub, 0.6); ellipse(ctx, -2, by + 4, 12, 3.5); ctx.fill();
    legC(-6, 0, false); legC(12, Math.PI, false);
    const nd = o.eat ? 10 : o.sleep ? 8 : 0;
    ctx.strokeStyle = ol; ctx.lineWidth = 7.4;
    ctx.beginPath(); ctx.moveTo(10, by - 2); ctx.quadraticCurveTo(22, by + 2 + nd * 0.5, 22, by - 14 + nd); ctx.stroke();
    ctx.strokeStyle = P.base; ctx.lineWidth = 5.4; ctx.stroke();
    const hx = 24, hy = by - 17 + nd;
    ellipse(ctx, hx - 3, hy - 3, 1.6, 2.4, -0.4); fs(ctx, P.base, ol, 1);
    ellipse(ctx, hx + 2, hy, 7.5, 4.6, 0.15); fs(ctx, P.base, ol);
    ellipse(ctx, hx + 7, hy + 1.5, 3, 2.8); ctx.fillStyle = P.sub; ctx.fill();
    ctx.strokeStyle = shade(P.base, -0.5); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(hx + 7, hy + 2); ctx.lineTo(hx + 9.4, hy + 2.6); ctx.stroke();
    eye(ctx, hx + 1, hy - 1.5, 1.3, o);
  },
  lizard(ctx, P, o) {
    const ol = shade(P.base, -0.45), by = -5, wig = o.moving ? Math.sin(o.walk) * 0.12 : 0;
    ctx.save(); ctx.rotate(wig);
    ctx.strokeStyle = ol; ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.moveTo(-8, by + 1); ctx.quadraticCurveTo(-16, by + 3, -23, by + 4); ctx.stroke();
    ctx.strokeStyle = P.base; ctx.lineWidth = 2.6; ctx.stroke();
    for (const [lx, ph, far] of [[-6, 0, 1], [6, Math.PI, 1], [-4, Math.PI, 0], [8, 0, 0]]) {
      const s = swing(o, ph, 2.5);
      ctx.strokeStyle = far ? shade(P.base, -0.2) : P.base; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(lx, by + 1); ctx.lineTo(lx + s + (lx < 0 ? -2 : 2), -0.6); ctx.stroke();
    }
    ellipse(ctx, 0, by, 11, 4.6); fs(ctx, P.base, ol);
    ctx.fillStyle = shade(P.base, -0.15);
    for (let i = -8; i <= 8; i += 3.2) { ctx.beginPath(); ctx.moveTo(i - 1.2, by - 3.5); ctx.lineTo(i, by - 6); ctx.lineTo(i + 1.2, by - 3.5); ctx.fill(); }
    const hx = 11, hy = by - 1.5 + (o.eat ? 1.5 : 0);
    ctx.beginPath(); ctx.moveTo(hx - 3, hy - 3.5); ctx.lineTo(hx + 6, hy - 1); ctx.lineTo(hx + 6, hy + 1.5); ctx.lineTo(hx - 3, hy + 4); ctx.closePath(); fs(ctx, P.base, ol);
    ctx.fillStyle = P.dark;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx - 3 + i * 2, hy + 3.5); ctx.lineTo(hx - 2 + i * 2, hy + 6); ctx.lineTo(hx - 1 + i * 2, hy + 3.2); ctx.fill(); }
    eye(ctx, hx + 1.5, hy - 1.2, 1.1, o);
    if (o.eat) { ctx.strokeStyle = '#ff7a9a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hx + 6, hy + 0.5); ctx.lineTo(hx + 9, hy + 0.5); ctx.stroke(); }
    ctx.restore();
  },
  penguin(ctx, P, o) {
    const ol = '#14181e', wob = o.moving ? Math.sin(o.walk) * 0.12 : Math.sin(o.t * 1.5) * 0.03;
    ctx.fillStyle = P.dark;
    for (const fx of [-3, 3]) { ellipse(ctx, fx + 1, -1, 3.2, 1.6); ctx.fill(); }
    ctx.save(); ctx.translate(0, -1); ctx.rotate(wob);
    ellipse(ctx, 0, -14, 9.5, 14); fs(ctx, P.base, ol);
    ellipse(ctx, 2.5, -12, 6.6, 11.5); ctx.fillStyle = P.sub; ctx.fill();
    ctx.fillStyle = rgba('#ffd23a', 0.7); ellipse(ctx, 3, -22, 3.6, 2.4); ctx.fill();
    const fl = o.happy ? Math.sin(o.t * 18) * 0.6 : o.moving ? Math.sin(o.walk) * 0.3 : 0;
    ctx.save(); ctx.translate(-2, -18); ctx.rotate(0.3 + fl);
    ellipse(ctx, 0, 7, 3, 8); fs(ctx, P.base, ol, 1); ctx.restore();
    eye(ctx, 4, -24 + (o.sleep ? 1 : 0), 1.5, o);
    ctx.beginPath(); ctx.moveTo(7, -24); ctx.lineTo(12.5, -22.5 + (o.eat ? 1.5 : 0)); ctx.lineTo(7, -21); ctx.closePath(); fs(ctx, P.dark, shade(P.dark, -0.3), 1);
    cheek(ctx, 5, -20.5, 1.6);
    ctx.restore();
  },
  seal(ctx, P, o) {
    const ol = shade(P.base, -0.45), wig = o.moving ? Math.sin(o.walk) * 1.5 : 0, by = -7 - (o.moving ? Math.abs(Math.sin(o.walk)) * 1.2 : 0);
    ctx.beginPath(); ctx.moveTo(-14, by + 2); ctx.lineTo(-21, by - 3 + wig); ctx.lineTo(-20, by + 6); ctx.closePath(); fs(ctx, shade(P.base, -0.1), ol);
    ellipse(ctx, -2, by, 15, 7); fs(ctx, P.base, ol);
    ellipse(ctx, 0, by + 3.5, 11, 3); ctx.fillStyle = P.sub; ctx.fill();
    ctx.fillStyle = rgba(P.dark, 0.35);
    for (const [sx, sy] of [[-8, -3], [-3, -5], [2, -2], [-10, 1]]) { ellipse(ctx, sx, by + sy, 1.4, 1); ctx.fill(); }
    ellipse(ctx, 4, by + 5, 4, 2, 0.4); fs(ctx, shade(P.base, -0.1), ol, 1);
    const hx = 11, hy = by - 3 + (o.sleep ? 2 : 0);
    ellipse(ctx, hx, hy, 6.8, 6.2); fs(ctx, P.base, ol);
    ellipse(ctx, hx + 4.5, hy + 2, 3.2, 2.6); ctx.fillStyle = P.sub; ctx.fill();
    ctx.fillStyle = '#2a2a30'; ellipse(ctx, hx + 6.8, hy + 1.2, 1.2, 1); ctx.fill();
    if (o.sleep || o.happy) eye(ctx, hx + 2, hy - 1.5, 1.6, o);
    else { ctx.fillStyle = '#16161a'; ellipse(ctx, hx + 2, hy - 1.5, 2, 2.2); ctx.fill(); ctx.fillStyle = '#fff'; ellipse(ctx, hx + 2.7, hy - 2.3, 0.7, 0.7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(60,60,70,0.5)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(hx + 6, hy + 2.5); ctx.lineTo(hx + 11, hy + 1.5); ctx.moveTo(hx + 6, hy + 3.2); ctx.lineTo(hx + 11, hy + 4.2); ctx.stroke();
  },
  polarbear(ctx, P, o) {
    const ol = '#b9b2a2', L = o.sleep ? 0 : 11, by = -(L + 11);
    const legC = (x, ph, far) => { if (L) leg(ctx, x, by + 5, 7, far ? '#e6e0d2' : P.base, swing(o, ph, 2.5), ol); };
    legC(-12, Math.PI, true); legC(9, 0, true);
    ellipse(ctx, -3, by, 17.5, 11); fs(ctx, P.base, ol);
    ellipse(ctx, -16, by - 3, 3, 2.6); fs(ctx, P.base, ol, 1);
    ctx.fillStyle = 'rgba(200,190,170,0.35)'; ellipse(ctx, -2, by + 5, 13, 4.5); ctx.fill();
    legC(-7, 0, false); legC(13, Math.PI, false);
    const hx = 15, hy = by - (o.sleep ? -3 : 3) + (o.eat ? 5 : 0);
    ellipse(ctx, hx - 4, hy - 6.5, 2.6, 2.6); fs(ctx, P.base, ol, 1);
    ellipse(ctx, hx, hy, 8, 7); fs(ctx, P.base, ol);
    ellipse(ctx, hx + 6.5, hy + 2, 5, 3.6); fs(ctx, '#fbf8f0', ol, 1);
    ctx.fillStyle = P.dark; ellipse(ctx, hx + 10.6, hy + 1, 1.8, 1.5); ctx.fill();
    eye(ctx, hx + 2.5, hy - 2, 1.4, o);
  },
};

/* =========================================================================
   人 (オーナーとお客さん)
   look = { skin, hair, hs (かみがた 0〜3), shirt, pants, apron }
   o    = { dir: 'd'|'u'|'l'|'r', t, walk, moving, wave }
   ========================================================================= */
const SKINS = ['#ffdcc0', '#f2c49e', '#d9a477', '#a8724a'];
const HAIRS = ['#3a2a22', '#6a4428', '#c98a3a', '#2a2a32', '#b4462a', '#e9d39a'];
const SHIRTS = ['#6cb6e8', '#ff8fa3', '#8fd27e', '#ffd25e', '#b59ae8', '#ff9f5a', '#5ac2b0', '#e8e8e8'];
function randomPerson() {
  return { skin: pick(SKINS), hair: pick(HAIRS), hs: rint(0, 3), shirt: pick(SHIRTS), pants: pick(['#4a5a7a', '#6a4a3a', '#3a3a44', '#8a7a6a']) };
}
function drawPerson(ctx, x, y, look, o = {}) {
  const dir = o.dir || 'd', back = dir === 'u';
  const ol = 'rgba(60,40,40,0.55)';
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(40,30,20,0.2)'; ellipse(ctx, 0, 0, 10, 3.4); ctx.fill();
  const bob = o.moving ? Math.abs(Math.sin(o.walk)) * 1.6 : 0;
  const s1 = o.moving ? Math.sin(o.walk) * 3 : 0;
  ctx.fillStyle = look.pants;
  rrect(ctx, -5 + (dir === 'l' ? -s1 * 0.4 : 0), -11, 4.2, 10 + (o.moving ? s1 * 0.3 : 0), 2); ctx.fill();
  rrect(ctx, 1 + (dir === 'r' ? s1 * 0.4 : 0), -11, 4.2, 10 - (o.moving ? s1 * 0.3 : 0), 2); ctx.fill();
  ctx.fillStyle = '#4a3a34';
  ellipse(ctx, -3, -1.2, 3, 1.8); ctx.fill(); ellipse(ctx, 3, -1.2, 3, 1.8); ctx.fill();
  ctx.translate(0, -bob);
  rrect(ctx, -8, -24, 16, 15, 6); fs(ctx, look.shirt, ol, 1);
  if (look.apron && !back) { rrect(ctx, -5.5, -20, 11, 11, 3); fs(ctx, look.apron, shade(look.apron, -0.3), 1); ctx.fillStyle = shade(look.apron, -0.2); rrect(ctx, -2.5, -16, 5, 3.5, 1); ctx.fill(); }
  const arm = o.wave ? -10 + Math.sin(o.t * 14) * 3 : o.moving ? -s1 : 0;
  ctx.strokeStyle = look.shirt; ctx.lineWidth = 4.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-7, -21); ctx.lineTo(-9, -13 + arm * 0.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7, -21); ctx.lineTo(o.wave ? 11 : 9, (o.wave ? -30 : -13) - arm * 0.3); ctx.stroke();
  ctx.fillStyle = look.skin;
  ellipse(ctx, -9.2, -12.5 + arm * 0.3, 2.2, 2.2); ctx.fill();
  ellipse(ctx, o.wave ? 11.5 : 9.2, (o.wave ? -31 : -12.5) - arm * 0.3, 2.2, 2.2); ctx.fill();
  const hy = -33;
  ellipse(ctx, 0, hy, 10, 9.5); fs(ctx, look.skin, ol, 1);
  ctx.fillStyle = look.hair;
  if (back) { ellipse(ctx, 0, hy - 1, 10.4, 9.8); ctx.fill(); }
  else {
    ctx.beginPath(); ctx.ellipse(0, hy - 2.5, 10.4, 8.5, 0, Math.PI, TAU); ctx.fill();
    if (look.hs === 1) { ellipse(ctx, -9, hy + 2, 2.6, 6); ctx.fill(); ellipse(ctx, 9, hy + 2, 2.6, 6); ctx.fill(); }
    if (look.hs === 2) { ellipse(ctx, 0, hy - 11, 4, 3.5); ctx.fill(); }
    if (look.hs === 3) { ellipse(ctx, -6, hy - 4, 5, 3); ctx.fill(); }
  }
  if (look.hs === 1 && back) { ellipse(ctx, 0, hy + 6, 9, 5); ctx.fill(); }
  if (look.cap) {
    ctx.fillStyle = look.cap;
    ctx.beginPath(); ctx.ellipse(0, hy - 4, 10.6, 8, 0, Math.PI, TAU); ctx.fill();
    if (!back) { ellipse(ctx, dir === 'l' ? -6 : dir === 'r' ? 6 : 0, hy - 4, 7, 2.2); ctx.fill(); }
  }
  if (!back) {
    const ex = dir === 'l' ? -3 : dir === 'r' ? 3 : 0;
    ctx.fillStyle = '#2a2020';
    if (dir !== 'r') { ellipse(ctx, ex - 3.6, hy + 1, 1.3, 1.6); ctx.fill(); }
    if (dir !== 'l') { ellipse(ctx, ex + 3.6, hy + 1, 1.3, 1.6); ctx.fill(); }
    cheek(ctx, ex - 5.5, hy + 4, 1.8); cheek(ctx, ex + 5.5, hy + 4, 1.8);
    ctx.strokeStyle = '#8a4a40'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ex, hy + 4, 1.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  ctx.restore();
}

/* =========================================================================
   家具。(x, y) は置いたマスの左上 (ワールド座標)、t は時間
   ========================================================================= */
const FurnArt = {
  draw(ctx, type, x, y, t = 0) {
    const d = FURN[type];
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    (this[type] || this.box).call(this, ctx, d.w * TILE, d.h * TILE, t);
    ctx.restore();
  },
  shadow(ctx, cx, cy, rx, ry) { ctx.fillStyle = 'rgba(40,30,20,0.18)'; ellipse(ctx, cx, cy, rx, ry); ctx.fill(); },
  box(ctx, w, h) { rrect(ctx, 4, 4, w - 8, h - 8, 6); fs(ctx, '#ccc', '#999'); },

  water(ctx, w, h, t) {
    this.shadow(ctx, 20, 30, 14, 5);
    ellipse(ctx, 20, 25, 14, 9); fs(ctx, '#b8c2cc', '#7a8490');
    ellipse(ctx, 20, 24, 10.5, 6.5); fs(ctx, '#6cc4f0', '#3a90c0', 1);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ellipse(ctx, 17 + Math.sin(t * 2) * 1.5, 22, 3.5, 1.4); ctx.fill();
  },
  bed(ctx) {
    this.shadow(ctx, 20, 32, 16, 5);
    rrect(ctx, 3, 9, 34, 26, 12); fs(ctx, '#8ab6e0', '#5a86b0');
    rrect(ctx, 8, 13, 24, 18, 9); fs(ctx, '#d6eafc', '#9ac0e0', 1);
    ellipse(ctx, 20, 15, 9, 4); fs(ctx, '#ffffff', '#c0d4e8', 1);
  },
  scratch(ctx) {
    this.shadow(ctx, 20, 33, 14, 5);
    rrect(ctx, 6, 24, 28, 12, 4); fs(ctx, '#d8b48a', '#9a7448');
    rrect(ctx, 15, -10, 10, 38, 3); fs(ctx, '#e8d0a0', '#9a7448');
    ctx.strokeStyle = '#b89460'; ctx.lineWidth = 1.2;
    for (let yy = -6; yy < 26; yy += 3) { ctx.beginPath(); ctx.moveTo(15, yy); ctx.lineTo(25, yy + 1.5); ctx.stroke(); }
    rrect(ctx, 6, -16, 28, 9, 4); fs(ctx, '#ff9fb0', '#c96a80');
    ctx.strokeStyle = '#ffd25e'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(30, -8); ctx.lineTo(31, 0); ctx.stroke();
    ctx.fillStyle = '#ffd25e'; ellipse(ctx, 31, 1.5, 2.4, 2.4); ctx.fill();
  },
  ball(ctx, w, h, t) {
    this.shadow(ctx, 20, 32, 9, 3);
    ellipse(ctx, 20, 25, 8, 8); fs(ctx, '#ff6a6a', '#b03a3a');
    ctx.save(); ellipse(ctx, 20, 25, 8, 8); ctx.clip();
    ctx.fillStyle = '#fff'; ctx.fillRect(10, 23, 20, 4); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ellipse(ctx, 17, 21, 2.5, 1.6); ctx.fill();
  },
  wheel(ctx, w, h, t) {
    this.shadow(ctx, 20, 33, 14, 4);
    ctx.strokeStyle = '#7a8490'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(10, 34); ctx.lineTo(20, 12); ctx.lineTo(30, 34); ctx.stroke();
    ellipse(ctx, 20, 12, 15, 15); ctx.strokeStyle = '#4ab0e0'; ctx.lineWidth = 3.4; ctx.stroke();
    ctx.strokeStyle = '#9ad6f0'; ctx.lineWidth = 1;
    const a0 = t * 2;
    for (let i = 0; i < 8; i++) { const a = a0 + (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(20, 12); ctx.lineTo(20 + Math.cos(a) * 14, 12 + Math.sin(a) * 14); ctx.stroke(); }
    ctx.fillStyle = '#ffd25e'; ellipse(ctx, 20, 12, 2.6, 2.6); ctx.fill();
  },
  jtree(ctx, w, h, t) {
    this.shadow(ctx, 40, 72, 30, 9);
    ctx.fillStyle = '#7a5434';
    ctx.beginPath(); ctx.moveTo(32, 74); ctx.quadraticCurveTo(36, 40, 34, 10); ctx.lineTo(46, 10); ctx.quadraticCurveTo(44, 40, 50, 74); ctx.closePath(); fs(ctx, '#8a5e3a', '#5a3a1e');
    ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 1;
    for (const yy of [56, 40, 26]) { ctx.beginPath(); ctx.moveTo(36, yy); ctx.quadraticCurveTo(40, yy + 3, 45, yy - 1); ctx.stroke(); }
    const sway = Math.sin(t * 0.8) * 1.5;
    const leaves = [[22, 4, 18, '#3e8a3a'], [58, 2, 18, '#3e8a3a'], [40, -14, 22, '#4fa048'], [24, -18, 15, '#5cb054'], [56, -20, 16, '#5cb054'], [40, 4, 16, '#68bc5c']];
    for (const [cx, cy, r, c] of leaves) { ellipse(ctx, cx + sway, cy, r, r * 0.8); fs(ctx, c, '#2a6a2a', 1.2); }
    ctx.strokeStyle = '#3a8a34'; ctx.lineWidth = 1.8;
    for (const vx of [18, 62]) {
      ctx.beginPath(); ctx.moveTo(vx + sway, 10); ctx.quadraticCurveTo(vx - 4 + sway, 30, vx + 2, 46); ctx.stroke();
      ctx.fillStyle = '#5cb054';
      for (const yy of [22, 34, 44]) { ellipse(ctx, vx + 1, yy, 2.6, 1.6, 0.6); ctx.fill(); }
    }
    ctx.fillStyle = '#ff7a5a'; for (const [fx, fy] of [[30, -10], [52, -8], [44, 6]]) { ellipse(ctx, fx + sway, fy, 2.6, 2.6); ctx.fill(); }
  },
  vine(ctx, w, h, t) {
    this.shadow(ctx, 20, 34, 15, 4);
    ctx.strokeStyle = '#8a5e3a'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(6, 34); ctx.lineTo(6, -12); ctx.moveTo(34, 34); ctx.lineTo(34, -12); ctx.moveTo(4, -10); ctx.lineTo(36, -10); ctx.stroke();
    const sway = Math.sin(t * 1.3) * 2;
    ctx.strokeStyle = '#3e8a3a'; ctx.lineWidth = 2;
    for (const vx of [12, 20, 28]) {
      ctx.beginPath(); ctx.moveTo(vx, -10); ctx.bezierCurveTo(vx - 5 + sway, 2, vx + 5 + sway, 12, vx + sway * 0.5, 24); ctx.stroke();
      ctx.fillStyle = '#5cb054';
      for (const yy of [-2, 8, 18]) { ellipse(ctx, vx + 2 + sway * 0.5, yy, 3, 1.8, 0.5); ctx.fill(); }
    }
  },
  perch(ctx) {
    this.shadow(ctx, 20, 34, 13, 4);
    rrect(ctx, 10, 28, 20, 8, 3); fs(ctx, '#9a7448', '#5a3a1e');
    ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 5.4; ctx.beginPath(); ctx.moveTo(20, 30); ctx.lineTo(20, -2); ctx.stroke();
    ctx.strokeStyle = '#9a6a3e'; ctx.lineWidth = 3.4; ctx.stroke();
    ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(3, -2); ctx.quadraticCurveTo(20, -6, 37, -1); ctx.stroke();
    ctx.strokeStyle = '#9a6a3e'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#5cb054'; ellipse(ctx, 6, -6, 3.6, 2, -0.5); ctx.fill(); ellipse(ctx, 34, -5, 3.6, 2, 0.5); ctx.fill();
  },
  fern(ctx, w, h, t) {
    const sway = Math.sin(t * 1.1) * 0.06;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.42 + sway;
      ctx.save(); ctx.translate(20, 30); ctx.rotate(a + Math.PI / 2);
      ellipse(ctx, 0, -12, 5, 13); fs(ctx, i % 2 ? '#3e9a44' : '#4fae52', '#2a6a2a', 1);
      ctx.strokeStyle = '#2a6a2a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22); ctx.stroke();
      ctx.restore();
    }
  },
  pond(ctx, w, h, t) {
    ellipse(ctx, 40, 22, 36, 15); fs(ctx, '#7a6a5a', '#4a3a2a');
    ellipse(ctx, 40, 21, 31, 11.5); fs(ctx, '#4aa6c8', '#2a7090', 1);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ellipse(ctx, 30 + Math.sin(t) * 3, 18, 7, 1.6); ctx.fill();
    ellipse(ctx, 54, 24, 6, 4); fs(ctx, '#5cb054', '#2a6a2a', 1);
    ctx.fillStyle = '#ff9fb8'; ellipse(ctx, 55, 23, 2, 1.6); ctx.fill();
    ctx.fillStyle = '#9a8a7a'; for (const [sx, sy] of [[8, 18], [72, 24], [20, 34], [62, 10]]) { ellipse(ctx, sx, sy, 4, 3); ctx.fill(); }
  },
  acacia(ctx, w, h, t) {
    this.shadow(ctx, 40, 72, 30, 9);
    ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(40, 74); ctx.lineTo(38, 30); ctx.lineTo(24, 4); ctx.moveTo(38, 34); ctx.lineTo(54, 2); ctx.stroke();
    ctx.strokeStyle = '#8a5e3a'; ctx.lineWidth = 4.6; ctx.stroke();
    const sway = Math.sin(t * 0.7) * 1.2;
    ctx.beginPath(); ctx.ellipse(40 + sway, -4, 40, 12, 0, 0, TAU); fs(ctx, '#7aa64a', '#4a7a2a');
    ctx.beginPath(); ctx.ellipse(40 + sway, -9, 34, 9, 0, 0, TAU); ctx.fillStyle = '#8fbc56'; ctx.fill();
    ctx.fillStyle = '#a6cc6a';
    for (let i = 0; i < 7; i++) { ellipse(ctx, 12 + i * 9.5 + sway, -10 + (i % 2) * 3, 5, 2.4); ctx.fill(); }
  },
  rock(ctx) {
    this.shadow(ctx, 40, 34, 34, 6);
    ctx.beginPath(); ctx.moveTo(6, 34); ctx.quadraticCurveTo(2, 8, 26, 2); ctx.quadraticCurveTo(54, -6, 72, 12); ctx.quadraticCurveTo(80, 28, 74, 34); ctx.closePath(); fs(ctx, '#b8a080', '#7a6448');
    ctx.fillStyle = 'rgba(255,240,210,0.45)'; ellipse(ctx, 36, 8, 22, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(110,90,60,0.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(26, 18); ctx.lineTo(34, 24); ctx.moveTo(52, 14); ctx.lineTo(58, 22); ctx.stroke();
  },
  tallgrass(ctx, w, h, t) {
    for (let i = 0; i < 9; i++) {
      const bx = 6 + i * 3.6, sway = Math.sin(t * 1.6 + i) * 2.5;
      ctx.strokeStyle = i % 2 ? '#b8a040' : '#9a8a30'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx, 34); ctx.quadraticCurveTo(bx + sway * 0.5, 16, bx + sway, 2 + (i % 3) * 4); ctx.stroke();
    }
  },
  mound(ctx) {
    this.shadow(ctx, 20, 34, 15, 4);
    ctx.beginPath(); ctx.moveTo(4, 35); ctx.quadraticCurveTo(10, 8, 14, -12); ctx.quadraticCurveTo(20, -18, 24, -10); ctx.quadraticCurveTo(30, 10, 36, 35); ctx.closePath(); fs(ctx, '#c08a50', '#7a5428');
    ctx.fillStyle = '#5a3a1e';
    for (const [hx, hy] of [[16, 4], [24, 16], [14, 24], [21, -4]]) { ellipse(ctx, hx, hy, 2, 2.6); ctx.fill(); }
  },
  waterhole(ctx, w, h, t) {
    ellipse(ctx, 40, 42, 37, 30); fs(ctx, '#a6884e', '#7a6034');
    ellipse(ctx, 40, 41, 31, 24); fs(ctx, '#5aa0b8', '#3a7890', 1);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ellipse(ctx, 32 + Math.sin(t) * 3, 34, 10, 2.5); ctx.fill();
    ctx.strokeStyle = '#8a9a3a'; ctx.lineWidth = 1.8;
    for (const [gx, gy] of [[8, 30], [70, 50], [14, 64], [64, 20]]) {
      for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + k * 3, gy - 8); ctx.stroke(); }
    }
  },
  cactus(ctx, w, h, t) {
    this.shadow(ctx, 20, 34, 11, 4);
    const g = '#5aa05a', ol = '#2a6a3a';
    ctx.lineCap = 'round';
    ctx.strokeStyle = ol; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(20, 33); ctx.lineTo(20, -8); ctx.stroke();
    ctx.lineWidth = 7.4;
    ctx.beginPath(); ctx.moveTo(20, 16); ctx.lineTo(9, 16); ctx.lineTo(9, 4); ctx.moveTo(20, 10); ctx.lineTo(31, 10); ctx.lineTo(31, -2); ctx.stroke();
    ctx.strokeStyle = g; ctx.lineWidth = 8.6;
    ctx.beginPath(); ctx.moveTo(20, 33); ctx.lineTo(20, -8); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(20, 16); ctx.lineTo(9, 16); ctx.lineTo(9, 4); ctx.moveTo(20, 10); ctx.lineTo(31, 10); ctx.lineTo(31, -2); ctx.stroke();
    ctx.strokeStyle = '#7cc07a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(19, 30); ctx.lineTo(19, -7); ctx.stroke();
    ctx.fillStyle = '#ff7a9a'; ellipse(ctx, 20, -11, 3, 2.4); ctx.fill();
  },
  dune(ctx) {
    ctx.beginPath(); ctx.moveTo(2, 34); ctx.quadraticCurveTo(26, -2, 48, 10); ctx.quadraticCurveTo(66, 18, 78, 34); ctx.closePath(); fs(ctx, '#f2cf8a', '#c99a5a');
    ctx.strokeStyle = 'rgba(190,140,80,0.5)'; ctx.lineWidth = 1.2;
    for (const yy of [16, 24, 30]) { ctx.beginPath(); ctx.moveTo(14, yy + 2); ctx.quadraticCurveTo(40, yy - 6, 66, yy + 2); ctx.stroke(); }
  },
  heatlamp(ctx, w, h, t) {
    const glow = 0.25 + Math.sin(t * 3) * 0.05;
    const g = ctx.createRadialGradient(20, 26, 2, 20, 26, 22);
    g.addColorStop(0, `rgba(255,190,80,${glow + 0.2})`); g.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = g; ellipse(ctx, 20, 26, 22, 12); ctx.fill();
    ctx.strokeStyle = '#5a5a62'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(8, 36); ctx.lineTo(8, -14); ctx.quadraticCurveTo(8, -20, 18, -18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, -20); ctx.lineTo(30, -14); ctx.lineTo(24, -6); ctx.closePath(); fs(ctx, '#7a7a84', '#4a4a52');
    ctx.fillStyle = '#ffd25e'; ellipse(ctx, 25, -8, 3.6, 3.2); ctx.fill();
    ctx.fillStyle = '#8a8a92'; rrect(ctx, 2, 33, 12, 4, 2); ctx.fill();
  },
  burrow(ctx) {
    ellipse(ctx, 20, 26, 17, 11); fs(ctx, '#e0b878', '#a07840');
    ellipse(ctx, 20, 25, 10, 6.5); ctx.fillStyle = '#4a3220'; ctx.fill();
    ellipse(ctx, 20, 27, 8, 3.6); ctx.fillStyle = '#2a1a10'; ctx.fill();
  },
  ice(ctx, w, h, t) {
    this.shadow(ctx, 20, 34, 15, 4);
    ctx.beginPath(); ctx.moveTo(5, 18); ctx.lineTo(20, 10); ctx.lineTo(35, 18); ctx.lineTo(35, 32); ctx.lineTo(20, 38); ctx.lineTo(5, 32); ctx.closePath(); fs(ctx, '#bfe6f8', '#6aaed0');
    ctx.beginPath(); ctx.moveTo(5, 18); ctx.lineTo(20, 10); ctx.lineTo(35, 18); ctx.lineTo(20, 25); ctx.closePath(); ctx.fillStyle = '#e8f8ff'; ctx.fill();
    ctx.strokeStyle = '#6aaed0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(20, 25); ctx.lineTo(20, 38); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 2) * 0.3})`; ellipse(ctx, 14, 16, 2.2, 1.2); ctx.fill();
  },
  snowhill(ctx) {
    ctx.beginPath(); ctx.moveTo(2, 34); ctx.quadraticCurveTo(22, -4, 44, 6); ctx.quadraticCurveTo(68, 14, 78, 34); ctx.closePath(); fs(ctx, '#ffffff', '#a9cce0');
    ctx.fillStyle = 'rgba(160,200,230,0.4)'; ellipse(ctx, 52, 26, 18, 6); ctx.fill();
  },
  coldpool(ctx, w, h, t) {
    rrect(ctx, 3, 5, 74, 72, 10); fs(ctx, '#e8f6ff', '#9ac6e0');
    rrect(ctx, 10, 12, 60, 58, 6); fs(ctx, '#3a9ad0', '#2a6a9a', 1);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 3; i++) { ellipse(ctx, 26 + i * 14 + Math.sin(t + i) * 3, 26 + i * 12, 8, 1.6); ctx.fill(); }
    ctx.fillStyle = '#e8f8ff'; rrect(ctx, 46, 44, 14, 10, 3); ctx.fill(); ctx.strokeStyle = '#9ac6e0'; ctx.stroke();
  },
  igloo(ctx) {
    this.shadow(ctx, 40, 72, 34, 8);
    ctx.beginPath(); ctx.moveTo(6, 72); ctx.arc(40, 72, 34, Math.PI, TAU); ctx.closePath(); fs(ctx, '#ffffff', '#9ac6e0', 1.6);
    ctx.strokeStyle = '#c4def0'; ctx.lineWidth = 1.2;
    for (const r of [24, 14]) { ctx.beginPath(); ctx.arc(40, 72, 34, Math.PI + 0.1, TAU - 0.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(40 - 34, 72 - r); ctx.lineTo(40 + 34, 72 - r); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(30, 74); ctx.arc(40, 74, 10, Math.PI, TAU); ctx.closePath(); fs(ctx, '#3a5a74', '#2a4a60');
  },
  sofa(ctx) {
    this.shadow(ctx, 40, 34, 36, 5);
    rrect(ctx, 4, 2, 72, 18, 7); fs(ctx, '#d0705a', '#8a4030');
    rrect(ctx, 6, 14, 68, 20, 6); fs(ctx, '#e88a70', '#8a4030');
    rrect(ctx, 0, 8, 12, 26, 5); fs(ctx, '#c0604a', '#8a4030');
    rrect(ctx, 68, 8, 12, 26, 5); fs(ctx, '#c0604a', '#8a4030');
    ctx.strokeStyle = 'rgba(138,64,48,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(40, 15); ctx.lineTo(40, 32); ctx.stroke();
    rrect(ctx, 16, 8, 14, 10, 4); fs(ctx, '#ffd25e', '#c99a20', 1);
  },
  plant(ctx, w, h, t) {
    this.shadow(ctx, 20, 34, 11, 4);
    ctx.beginPath(); ctx.moveTo(10, 22); ctx.lineTo(30, 22); ctx.lineTo(27, 36); ctx.lineTo(13, 36); ctx.closePath(); fs(ctx, '#e8a070', '#a0603a');
    const sway = Math.sin(t * 1.2) * 0.05;
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.translate(20, 22); ctx.rotate((i - 2.5) * 0.45 + sway);
      ellipse(ctx, 0, -12, 4.5, 12); fs(ctx, i % 2 ? '#4fae52' : '#3e9a44', '#2a6a2a', 1);
      ctx.restore();
    }
  },
  aquarium(ctx, w, h, t) {
    this.shadow(ctx, 40, 35, 36, 5);
    rrect(ctx, 4, 24, 72, 12, 3); fs(ctx, '#8a6a4a', '#5a3a1e');
    rrect(ctx, 4, -8, 72, 33, 4); fs(ctx, 'rgba(120,200,240,0.75)', '#4a8ab0', 1.6);
    ctx.fillStyle = '#e8d8a8'; ctx.fillRect(6, 19, 68, 5);
    ctx.strokeStyle = '#3e9a44'; ctx.lineWidth = 2;
    for (const px of [14, 62]) { ctx.beginPath(); ctx.moveTo(px, 22); ctx.quadraticCurveTo(px + Math.sin(t * 2) * 3, 8, px, -2); ctx.stroke(); }
    for (let i = 0; i < 3; i++) {
      const fx = 20 + ((t * 9 + i * 17) % 40), fy = 2 + i * 6;
      ctx.fillStyle = ['#ff8a3a', '#ffd25e', '#ff6a8a'][i];
      ellipse(ctx, fx, fy, 3.6, 2.2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(fx - 3, fy); ctx.lineTo(fx - 6, fy - 2.5); ctx.lineTo(fx - 6, fy + 2.5); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(8, -5, 3, 22);
  },
  rug(ctx) {
    rrect(ctx, 4, 4, 72, 72, 8); fs(ctx, '#c9605a', '#8a3a34');
    rrect(ctx, 10, 10, 60, 60, 6); ctx.strokeStyle = '#ffd25e'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#e8a050';
    ctx.beginPath(); ctx.moveTo(40, 22); ctx.lineTo(58, 40); ctx.lineTo(40, 58); ctx.lineTo(22, 40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd25e'; ellipse(ctx, 40, 40, 6, 6); ctx.fill();
  },
  lamp(ctx, w, h, t) {
    const g = ctx.createRadialGradient(20, 30, 2, 20, 30, 20);
    g.addColorStop(0, 'rgba(255,230,150,0.35)'); g.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = g; ellipse(ctx, 20, 30, 20, 10); ctx.fill();
    ctx.fillStyle = '#6a5a4a'; ellipse(ctx, 20, 34, 8, 3); ctx.fill();
    ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(20, 34); ctx.lineTo(20, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(30, -4); ctx.lineTo(26, -18); ctx.lineTo(14, -18); ctx.closePath(); fs(ctx, '#fff2c8', '#c9a860');
  },
};

/* 家具の見た目の高さ (ワールド座標)。押したときに上の方でも選べるように */
const VIS_H = { jtree: 112, acacia: 96, scratch: 58, vine: 54, perch: 48, wheel: 44, cactus: 52, heatlamp: 60, mound: 54, igloo: 64, lamp: 62, aquarium: 48, plant: 42, ice: 36 };

/* =========================================================================
   画面で使う小さなアイコン (canvas → 画像 URL を覚えておく)
   ========================================================================= */
const ICON = 64;
const Icons = {
  cache: new Map(),
  get(key, draw) {
    let u = this.cache.get(key);
    if (u) return u;
    const c = document.createElement('canvas');
    c.width = c.height = ICON * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    draw(ctx);
    u = c.toDataURL();
    this.cache.set(key, u);
    return u;
  },
  pet(sp, c = 0, mood) {
    return this.get(`p:${sp}:${c}:${mood || ''}`, (ctx) => {
      const S = SPECIES[sp];
      const w = { giraffe: 50, camel: 60, zebra: 52, lion: 56, polarbear: 52, lizard: 46, seal: 46 }[sp] || 40;
      const k = Math.min(1.5, 52 / Math.max(S.h, 20), 58 / w);
      ctx.translate(ICON / 2 - (sp === 'giraffe' ? 4 : 0), ICON - 6);
      ctx.scale(k, k);
      drawPet(ctx, 0, 0, { sp, c }, { dir: 'r', t: 0, happy: mood === 'happy', sleep: mood === 'sleep' });
    });
  },
  furn(type) {
    return this.get(`f:${type}`, (ctx) => {
      const d = FURN[type];
      const top = VIS_H[type] ? VIS_H[type] - d.h * TILE : 6;
      const wpx = d.w * TILE, hpx = d.h * TILE + top;
      const k = Math.min(56 / wpx, 56 / hpx, 1.3);
      ctx.translate(ICON / 2 - (wpx * k) / 2, ICON / 2 - (hpx * k) / 2 + top * k);
      ctx.scale(k, k);
      FurnArt.draw(ctx, type, 0, 0, 0.6);
    });
  },
  person(look) {
    return this.get(`h:${JSON.stringify(look)}`, (ctx) => {
      ctx.translate(ICON / 2, ICON - 6);
      ctx.scale(1.25, 1.25);
      drawPerson(ctx, 0, 0, look, { dir: 'd', t: 0 });
    });
  },
  img(url, cls = 'pi') { return `<img class="${cls}" src="${url}" alt="">`; },
};
