/* =========================================================================
   SKYDROP ROYALE ― え（キャラ・ぶき・アイテム・地図の もの）
   すべて canvas の 図形で かく。画像ファイルは つかわない
   ========================================================================= */
'use strict';

const OUT = '#1d1a2a';

function circle(ctx, x, y, r, fill, stroke = OUT, lw = 1.5) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function ellipse(ctx, x, y, rx, ry, fill, stroke = OUT, lw = 1.5, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function poly(ctx, pts, fill, stroke = OUT, lw = 1.5) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function box(ctx, x, y, w, h, fill, r = 2, stroke = OUT, lw = 1.5) {
  rr(ctx, x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function star(ctx, x, y, r, fill, stroke = OUT, n = 5, inner = 0.45) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n, rr2 = i % 2 ? r * inner : r;
    pts.push(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  poly(ctx, pts, fill, stroke, 1);
}
function heart(ctx, x, y, s, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  ctx.fillStyle = fill; ctx.fill();
}

/* ================================ キャラ ================================ */
const HOODS = new Set(['dino', 'bear', 'shark', 'frog']);
const FULLHEAD = new Set(['pumpkin', 'robot', 'knight']);
const HIDE_HAIR = new Set(['helmet', 'ninja', 'astro', 'pumpkin', 'robot', 'dino', 'bear', 'shark', 'frog', 'knight', 'kabuto', 'chef', 'beanie', 'witch', 'pirate', 'cowboy']);

/* キャラを かく。x,y は 体の まんなか。face=1 で 右むき */
function drawChar(ctx, sk, x, y, s, face, opt = {}) {
  const t = opt.t || 0;
  const walk = opt.walk || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * face, s);
  if (!opt.noShadow) ellipse(ctx, 0, 15, 13, 4.5, 'rgba(0,0,0,0.28)', null);
  if (sk.fx && sk.fx !== 'none' && !opt.noFx) drawFx(ctx, sk, t, true);
  drawBack(ctx, sk, t, walk);
  // あし
  const sw = Math.sin(walk * 10) * (walk ? 2.5 : 0);
  box(ctx, -7, 6 + sw * 0.4, 6, 8 - sw * 0.3, sk.legs, 2);
  box(ctx, 1, 6 - sw * 0.4, 6, 8 + sw * 0.3, sk.legs, 2);
  box(ctx, -8, 12 + sw * 0.5, 7, 4, sk.shoes, 2);
  box(ctx, 1, 12 - sw * 0.5, 7, 4, sk.shoes, 2);
  // からだ
  rr(ctx, -10, -6, 20, 15, 6);
  ctx.fillStyle = sk.c1; ctx.fill();
  ctx.save(); ctx.clip(); drawPattern(ctx, sk); ctx.restore();
  rr(ctx, -10, -6, 20, 15, 6); ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.stroke();
  if (sk.back === 'pack' || sk.back === 'jetpack') { ctx.strokeStyle = shade(sk.backC, -0.3); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-5, 8); ctx.moveTo(6, -6); ctx.lineTo(5, 8); ctx.stroke(); }
  if (sk.back === 'scarf') { box(ctx, -10, -8, 20, 5, sk.backC, 2); box(ctx, 3, -5, 5, 10, sk.backC, 2); }
  // あたま
  drawHead(ctx, sk, t);
  if (sk.fx && sk.fx !== 'none' && !opt.noFx) drawFx(ctx, sk, t, false);
  ctx.restore();
}

function drawPattern(ctx, sk) {
  const c2 = sk.c2;
  ctx.fillStyle = c2; ctx.strokeStyle = c2;
  switch (sk.pat) {
    case 'stripe': for (let y = -4; y < 10; y += 5) ctx.fillRect(-11, y, 22, 2.2); break;
    case 'dots': for (let y = -3; y < 10; y += 5) for (let x = -8 + ((y + 3) % 10 ? 2.5 : 0); x < 10; x += 5) { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fill(); } break;
    case 'star': star(ctx, 0, 1.5, 5.5, c2, null); break;
    case 'bolt': poly(ctx, [1, -6, -4, 2, 0, 2, -2, 9, 5, 0, 1, 0], c2, null); break;
    case 'zip': ctx.fillRect(-0.8, -6, 1.6, 16); poly(ctx, [-6, -6, 0, -1, 6, -6], shade(sk.c1, -0.2), null); break;
    case 'armor': ctx.lineWidth = 1.2; ctx.strokeStyle = shade(sk.c1, -0.35); ctx.beginPath(); ctx.moveTo(-10, 1); ctx.lineTo(10, 1); ctx.moveTo(0, -6); ctx.lineTo(0, 9); ctx.stroke(); circle(ctx, -9, -4, 3.2, c2, OUT, 1); circle(ctx, 9, -4, 3.2, c2, OUT, 1); break;
    case 'belly': ellipse(ctx, 0, 3, 6.5, 6, c2, null); break;
    case 'suit': poly(ctx, [-4, -6, 0, 2, 4, -6], '#ffffff', null); poly(ctx, [-1.2, -4, 1.2, -4, 1.8, 4, 0, 6, -1.8, 4], c2, null); break;
    case 'heart': heart(ctx, 0, 1, 4.2, c2); break;
    case 'number': box(ctx, -5, -3, 10, 9, '#ffffff', 1, null); ctx.fillStyle = c2; ctx.font = `bold 8px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('7', 0, 1.8); break;
    case 'check': ctx.globalAlpha = 0.5; for (let x = -10; x < 10; x += 5) ctx.fillRect(x, -6, 2, 16); for (let y = -6; y < 10; y += 5) ctx.fillRect(-10, y, 20, 2); ctx.globalAlpha = 1; break;
  }
}

function drawBack(ctx, sk, t, walk) {
  const c = sk.backC, d = shade(c, -0.25);
  const flap = Math.sin(t * 6) * 0.15;
  switch (sk.back) {
    case 'cape': poly(ctx, [-9, -6, 9, -6, 13 + Math.sin(t * 4) * 1.5, 13, -13 - Math.sin(t * 4) * 1.5, 13], c); break;
    case 'pack': box(ctx, -13, -4, 5, 11, d, 2); box(ctx, 8, -4, 5, 11, d, 2); break;
    case 'jetpack':
      box(ctx, -14, -5, 6, 13, c, 2); box(ctx, 8, -5, 6, 13, c, 2);
      if (walk) { poly(ctx, [-13, 8, -9, 8, -11, 14 + Math.random() * 4], '#ffb52e', null); poly(ctx, [9, 8, 13, 8, 11, 14 + Math.random() * 4], '#ffb52e', null); }
      break;
    case 'angel':
      for (const sd of [-1, 1]) { ctx.save(); ctx.scale(sd, 1); ctx.rotate(flap); poly(ctx, [6, -4, 22, -14, 25, -6, 20, 0, 23, 4, 14, 6, 8, 4], c); ctx.restore(); }
      break;
    case 'bat':
      for (const sd of [-1, 1]) { ctx.save(); ctx.scale(sd, 1); ctx.rotate(flap); poly(ctx, [6, -4, 24, -12, 22, -4, 26, 0, 20, 2, 18, 7, 8, 4], c); ctx.restore(); }
      break;
    case 'butterfly':
      for (const sd of [-1, 1]) { ctx.save(); ctx.scale(sd, 1); ctx.rotate(flap * 1.5); ellipse(ctx, 15, -7, 9, 7, c, OUT, 1.5, -0.4); ellipse(ctx, 13, 5, 6, 5, d, OUT, 1.5, 0.4); circle(ctx, 16, -8, 2.5, '#ffffff', null); ctx.restore(); }
      break;
    case 'dinotail': poly(ctx, [6, 4, 22, 10 + Math.sin(t * 5) * 2, 7, 12], c); poly(ctx, [11, 6, 13, 3, 15, 7], '#ffe08a', null); break;
    case 'cattail': ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(6, 6); ctx.quadraticCurveTo(18, 8, 16 + Math.sin(t * 4) * 3, -4); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke(); break;
    case 'foxtail': ellipse(ctx, 15, 4, 9, 5, c, OUT, 1.5, -0.6 + Math.sin(t * 4) * 0.15); ellipse(ctx, 21, 0, 3, 2.5, '#ffffff', null, 0, -0.6); break;
    case 'shell': ellipse(ctx, 0, 1, 14, 11, c); ctx.strokeStyle = shade(c, -0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-14, 1); ctx.lineTo(14, 1); ctx.stroke(); break;
    case 'swordback': ctx.save(); ctx.rotate(0.6); box(ctx, -1.5, -24, 3, 22, '#e0e4ec', 1); box(ctx, -4, -3, 8, 2.5, c, 1); box(ctx, -1.5, -1, 3, 6, '#6a4028', 1); ctx.restore(); break;
  }
}

function drawHead(ctx, sk, t) {
  const hy = -16, hc = sk.headC;
  const head = sk.head;
  if (head === 'pumpkin') {
    ellipse(ctx, 0, hy, 14, 12, hc); ctx.strokeStyle = shade(hc, -0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, hy, 6, 12, 0, 0, TAU); ctx.stroke();
    box(ctx, -1.5, hy - 15, 3, 5, '#4a8a2a', 1);
    poly(ctx, [-8, hy - 3, -3, hy - 3, -5.5, hy - 7], '#2a1a00', null); poly(ctx, [3, hy - 3, 8, hy - 3, 5.5, hy - 7], '#2a1a00', null);
    poly(ctx, [-7, hy + 3, 7, hy + 3, 4, hy + 7, 0, hy + 5, -4, hy + 7], '#2a1a00', null);
    return;
  }
  if (head === 'robot') {
    box(ctx, -12, hy - 11, 24, 21, hc, 4); box(ctx, -9, hy - 5, 18, 8, '#1d1a2a', 2, null);
    ctx.fillStyle = sk.c2; ctx.fillRect(-7, hy - 2.5, 4, 3); ctx.fillRect(3, hy - 2.5, 4, 3);
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, hy - 11); ctx.lineTo(0, hy - 16); ctx.stroke(); circle(ctx, 0, hy - 17, 2.5, '#ff4a4a');
    return;
  }
  if (head === 'knight') {
    circle(ctx, 0, hy, 12.5, hc); box(ctx, -8, hy - 2, 16, 3, '#1d1a2a', 1, null);
    ctx.strokeStyle = shade(hc, -0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, hy + 2); ctx.lineTo(0, hy + 11); ctx.stroke();
    poly(ctx, [-2, hy - 12, 2, hy - 12, 4, hy - 22, 0, hy - 19, -3, hy - 21], sk.c2);
    return;
  }
  if (HOODS.has(head)) {
    circle(ctx, 0, hy, 14, hc);
    if (head === 'bear') { circle(ctx, -10, hy - 10, 4.5, hc); circle(ctx, 10, hy - 10, 4.5, hc); circle(ctx, -10, hy - 10, 2, shade(hc, 0.3), null); circle(ctx, 10, hy - 10, 2, shade(hc, 0.3), null); }
    if (head === 'dino') { for (let i = 0; i < 4; i++) poly(ctx, [-9 + i * 5, hy - 11 + Math.abs(i - 1.5) * 1.2, -6.5 + i * 5, hy - 17 + Math.abs(i - 1.5) * 1.2, -4 + i * 5, hy - 11 + Math.abs(i - 1.5) * 1.2], '#ffe08a'); }
    if (head === 'shark') { poly(ctx, [-3, hy - 13, 3, hy - 20, 6, hy - 12], hc); }
    if (head === 'frog') { circle(ctx, -7, hy - 12, 5, hc); circle(ctx, 7, hy - 12, 5, hc); circle(ctx, -7, hy - 12, 3, '#ffffff', null); circle(ctx, 7, hy - 12, 3, '#ffffff', null); circle(ctx, -6.5, hy - 12, 1.6, '#1d1a2a', null); circle(ctx, 7.5, hy - 12, 1.6, '#1d1a2a', null); }
    circle(ctx, 0, hy + 1.5, 9.5, sk.tone);
    if (head === 'shark') { for (let i = -3; i <= 3; i++) poly(ctx, [i * 2.6 - 1.3, hy - 7, i * 2.6 + 1.3, hy - 7, i * 2.6, hy - 4], '#ffffff', null); }
    drawFace(ctx, sk, hy + 2);
    return;
  }
  // ふつうの あたま
  circle(ctx, 0, hy, 12.5, sk.tone);
  if (!HIDE_HAIR.has(head)) drawHair(ctx, sk, hy);
  else if (head === 'beanie' || head === 'cowboy' || head === 'pirate') drawHair(ctx, Object.assign({}, sk, { hair: sk.hair === 'none' ? 'none' : 'short' }), hy);
  drawFace(ctx, sk, hy);
  drawHat(ctx, sk, hy, t);
}

function drawHair(ctx, sk, hy) {
  const c = sk.hairC;
  switch (sk.hair) {
    case 'short': ctx.beginPath(); ctx.arc(0, hy, 12.5, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(4, hy - 4, -12.4, hy - 1); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke(); break;
    case 'spiky': poly(ctx, [-12, hy - 1, -14, hy - 10, -8, hy - 9, -7, hy - 17, -1, hy - 12, 3, hy - 19, 6, hy - 11, 13, hy - 14, 11, hy - 6, 12.5, hy - 1, 4, hy - 6, -4, hy - 4], c); break;
    case 'long':
      box(ctx, -14, hy - 4, 6, 18, c, 3); box(ctx, 8, hy - 4, 6, 18, c, 3);
      ctx.beginPath(); ctx.arc(0, hy, 13, Math.PI * 1.0, Math.PI * 2.0); ctx.quadraticCurveTo(2, hy - 6, -13, hy); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke(); break;
    case 'bun': circle(ctx, 0, hy - 14, 5.5, c); ctx.beginPath(); ctx.arc(0, hy, 12.5, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(0, hy - 6, -12, hy - 3); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = OUT; ctx.stroke(); break;
    case 'twin': circle(ctx, -13, hy - 6, 5, c); circle(ctx, 13, hy - 6, 5, c); ctx.beginPath(); ctx.arc(0, hy, 12.5, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(0, hy - 6, -12, hy - 3); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = OUT; ctx.stroke(); break;
    case 'mohawk': poly(ctx, [-3, hy - 11, -4, hy - 19, 0, hy - 16, 2, hy - 21, 4, hy - 15, 4, hy - 11], c); break;
    case 'curly': for (let i = -2; i <= 2; i++) circle(ctx, i * 5, hy - 10 + Math.abs(i) * 2.2, 5, c); break;
  }
}

function drawFace(ctx, sk, ey) {
  if (sk.head === 'ninja') {
    ctx.beginPath(); ctx.arc(0, ey, 12.5, 0, TAU); ctx.fillStyle = sk.headC; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
    box(ctx, -9, ey - 4, 18, 6, sk.tone, 3, null);
    ctx.fillStyle = sk.c2; ctx.fillRect(-12.5, ey - 8, 25, 2.5);
    poly(ctx, [-12, ey - 7, -18, ey - 10, -17, ey - 4], sk.c2, null);
  }
  const ex = 4.5, y = ey + 0.5;
  ctx.fillStyle = '#1d1a2a'; ctx.strokeStyle = '#1d1a2a'; ctx.lineWidth = 1.6;
  switch (sk.eyes) {
    case 'happy': for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * ex + 1.5, y + 1, 2.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } break;
    case 'angry': for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * ex + 1.5, y, 1.8, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(s * ex + 1.5 - 3 * s, y - 4.5); ctx.lineTo(s * ex + 1.5 + 2.5 * s, y - 3); ctx.stroke(); } break;
    case 'shades': box(ctx, -9, y - 3, 20, 5.5, '#1d1a2a', 2, null); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-6, y - 2, 3, 1.5); ctx.fillRect(5, y - 2, 3, 1.5); break;
    case 'visor': box(ctx, -10, y - 3.5, 22, 6, '#2ad0e0', 3); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-6, y - 2.5, 8, 1.5); break;
    case 'star': star(ctx, -ex + 1.5, y, 3.2, '#ffd23a', OUT); star(ctx, ex + 1.5, y, 3.2, '#ffd23a', OUT); break;
    case 'sleepy': for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * ex - 1, y); ctx.lineTo(s * ex + 4, y); ctx.stroke(); } break;
    case 'big': for (const s of [-1, 1]) { circle(ctx, s * ex + 1.5, y, 3.4, '#ffffff', OUT, 1); circle(ctx, s * ex + 2.5, y + 0.5, 1.8, '#1d1a2a', null); circle(ctx, s * ex + 3, y - 0.5, 0.7, '#ffffff', null); } break;
    default: for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * ex + 1.5, y, 1.8, 0, TAU); ctx.fill(); }
  }
  if (sk.head !== 'ninja') {
    ctx.strokeStyle = '#1d1a2a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(2, y + 4.5, 2, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,120,0.35)'; ctx.beginPath(); ctx.arc(-6, y + 3.5, 2, 0, TAU); ctx.arc(9, y + 3.5, 2, 0, TAU); ctx.fill();
  }
}

function drawHat(ctx, sk, hy, t) {
  const c = sk.headC, d = shade(c, -0.25);
  switch (sk.head) {
    case 'cap': ctx.beginPath(); ctx.arc(0, hy - 2, 12.5, Math.PI, 0); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke(); box(ctx, 2, hy - 4, 15, 4, d, 2); break;
    case 'beanie': ctx.beginPath(); ctx.arc(0, hy - 2, 13, Math.PI, 0); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke(); box(ctx, -13.5, hy - 5, 27, 5, d, 2); circle(ctx, 0, hy - 16, 3.5, '#ffffff'); break;
    case 'helmet': ctx.beginPath(); ctx.arc(0, hy, 14, Math.PI * 0.95, Math.PI * 2.05); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-8, hy - 11, 6, 2.5); break;
    case 'cat': poly(ctx, [-12, hy - 5, -10, hy - 18, -3, hy - 11], c); poly(ctx, [12, hy - 5, 10, hy - 18, 3, hy - 11], c); poly(ctx, [-10, hy - 9, -9.5, hy - 15, -5.5, hy - 11], '#ffb0c8', null); poly(ctx, [10, hy - 9, 9.5, hy - 15, 5.5, hy - 11], '#ffb0c8', null); break;
    case 'fox': poly(ctx, [-12, hy - 4, -12, hy - 20, -2, hy - 11], c); poly(ctx, [12, hy - 4, 12, hy - 20, 2, hy - 11], c); poly(ctx, [-11, hy - 9, -11, hy - 16, -6, hy - 11], '#ffffff', null); poly(ctx, [11, hy - 9, 11, hy - 16, 6, hy - 11], '#ffffff', null); break;
    case 'bunny': ellipse(ctx, -5, hy - 20, 3.5, 10, c, OUT, 1.5, -0.15); ellipse(ctx, 6, hy - 20, 3.5, 10, c, OUT, 1.5, 0.2); ellipse(ctx, -5, hy - 20, 1.6, 7, '#ffb0c8', null, 0, -0.15); ellipse(ctx, 6, hy - 20, 1.6, 7, '#ffb0c8', null, 0, 0.2); break;
    case 'horns': poly(ctx, [-9, hy - 8, -13, hy - 20, -4, hy - 11], c); poly(ctx, [9, hy - 8, 13, hy - 20, 4, hy - 11], c); break;
    case 'crown': poly(ctx, [-10, hy - 8, -11, hy - 20, -5, hy - 14, 0, hy - 22, 5, hy - 14, 11, hy - 20, 10, hy - 8], c); circle(ctx, 0, hy - 12, 2, '#ff4a6a', null); circle(ctx, -6, hy - 11, 1.5, '#4aa8ff', null); circle(ctx, 6, hy - 11, 1.5, '#5fd35a', null); break;
    case 'tiara': poly(ctx, [-8, hy - 9, -6, hy - 14, -3, hy - 11, 0, hy - 17, 3, hy - 11, 6, hy - 14, 8, hy - 9], c); circle(ctx, 0, hy - 13, 1.8, '#ff9ae8', null); break;
    case 'astro': ctx.beginPath(); ctx.arc(0, hy, 16, 0, TAU); ctx.fillStyle = 'rgba(190,240,255,0.25)'; ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.arc(0, hy, 17.5, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-7, hy - 8, 3, 5, 0.6, 0, TAU); ctx.fill(); break;
    case 'witch': poly(ctx, [-16, hy - 6, 16, hy - 6, 8, hy - 9, 4, hy - 28, -3, hy - 22, -8, hy - 9], c); box(ctx, -8, hy - 11, 16, 3, sk.c2, 1, null); break;
    case 'halo': ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, hy - 18 + Math.sin(t * 3), 9, 3, 0, 0, TAU); ctx.stroke(); break;
    case 'headphones': ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, hy, 14, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.stroke(); box(ctx, -16, hy - 5, 6, 10, c, 3); box(ctx, 10, hy - 5, 6, 10, c, 3); break;
    case 'flower': for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.3; circle(ctx, 8 + Math.cos(a) * 3.5, hy - 10 + Math.sin(a) * 3.5, 2.6, c, OUT, 1); } circle(ctx, 8, hy - 10, 2, '#ffd23a', null); break;
    case 'pirate': poly(ctx, [-16, hy - 6, 16, hy - 6, 10, hy - 18, 0, hy - 14, -10, hy - 18], c); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, hy - 11, 2.2, 0, TAU); ctx.fill(); break;
    case 'cowboy': ellipse(ctx, 0, hy - 7, 18, 4, c); box(ctx, -8, hy - 18, 16, 11, c, 4); box(ctx, -8, hy - 10, 16, 2.5, '#2a1a10', 1, null); break;
    case 'propeller': ctx.beginPath(); ctx.arc(0, hy - 2, 12.5, Math.PI, 0); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
      box(ctx, -1, hy - 19, 2, 6, OUT, 1, null); { const w = Math.cos(t * 20) * 11; ellipse(ctx, 0, hy - 19, Math.abs(w) + 1, 2, '#ff4a4a', OUT, 1); } break;
    case 'kabuto': ctx.beginPath(); ctx.arc(0, hy - 1, 14, Math.PI * 0.95, Math.PI * 2.05); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
      poly(ctx, [-2, hy - 13, -12, hy - 26, -5, hy - 13], '#ffd23a'); poly(ctx, [2, hy - 13, 12, hy - 26, 5, hy - 13], '#ffd23a'); box(ctx, -16, hy - 4, 32, 4, d, 2); break;
    case 'chef': box(ctx, -9, hy - 12, 18, 7, c, 2); circle(ctx, -6, hy - 16, 5.5, c); circle(ctx, 0, hy - 19, 6, c); circle(ctx, 6, hy - 16, 5.5, c); break;
  }
}

function drawFx(ctx, sk, t, behind) {
  const k = sk.fx;
  ctx.save();
  if (behind) {
    if (k === 'flame') for (let i = 0; i < 4; i++) { const f = (t * 3 + i * 0.25) % 1; ctx.globalAlpha = 1 - f; poly(ctx, [-10 + i * 6, 14, -7 + i * 6, 14 - f * 20 - 4, -4 + i * 6, 14], i % 2 ? '#ffd23a' : '#ff6a2a', null); }
    if (k === 'rainbow') { const cs = ['#ff4a4a', '#ff8a2a', '#ffd23a', '#5fd35a', '#4aa8ff', '#a64aff']; cs.forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(0, 15, 14 + i * 1.5, 5 + i * 0.6, 0, 0, TAU); ctx.stroke(); }); }
  } else {
    if (k === 'sparkle') for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * 2.1; const p = (Math.sin(t * 4 + i * 2) + 1) / 2; ctx.globalAlpha = p; star(ctx, Math.cos(a) * 18, -8 + Math.sin(a * 1.3) * 14, 2.5 + p * 1.5, '#fff6a0', null, 4, 0.35); }
    if (k === 'snow') for (let i = 0; i < 5; i++) { const f = (t * 0.5 + i * 0.2) % 1; ctx.globalAlpha = 1 - f; circle(ctx, -16 + i * 8 + Math.sin(t * 2 + i) * 3, -30 + f * 44, 1.5, '#ffffff', null); }
    if (k === 'bubbles') for (let i = 0; i < 4; i++) { const f = (t * 0.6 + i * 0.25) % 1; ctx.globalAlpha = 1 - f; circle(ctx, -14 + i * 9 + Math.sin(t * 3 + i) * 2, 10 - f * 40, 2 + f * 2, 'rgba(190,240,255,0.3)', '#bdf4ff', 1); }
    if (k === 'hearts') for (let i = 0; i < 3; i++) { const f = (t * 0.5 + i * 0.33) % 1; ctx.globalAlpha = 1 - f; heart(ctx, -12 + i * 12, -10 - f * 26, 2.5, '#ff5a9a'); }
    if (k === 'bolt') { if (Math.sin(t * 13) > 0.6) { ctx.strokeStyle = '#9ae8ff'; ctx.lineWidth = 1.5; const a = (Math.floor(t * 7) * 2.4) % TAU; const x = Math.cos(a) * 16, y = -6 + Math.sin(a) * 14; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 4); ctx.lineTo(x, y + 6); ctx.lineTo(x + 5, y + 11); ctx.stroke(); } }
  }
  ctx.restore();
}

/* ============================== グライダー ============================== */
function drawGlider(ctx, id, x, y, s, t) {
  const g = GLIDER_BY_ID[id] || GLIDERS[0];
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const sway = Math.sin(t * 2) * 0.08;
  ctx.rotate(sway);
  ctx.strokeStyle = 'rgba(30,26,42,0.7)'; ctx.lineWidth = 1;
  switch (id) {
    case 'umbrella':
      ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(0, -8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-30, -36); ctx.quadraticCurveTo(0, -66, 30, -36);
      for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(22.5 - i * 15, -32, 15 - i * 15, -36);
      ctx.closePath(); ctx.fillStyle = g.c1; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = g.c2; ctx.beginPath(); ctx.moveTo(0, -51); ctx.lineTo(-10, -36); ctx.lineTo(10, -36); ctx.fill();
      break;
    case 'para':
      ctx.beginPath(); ctx.moveTo(-30, -40); ctx.lineTo(-6, -6); ctx.moveTo(30, -40); ctx.lineTo(6, -6); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -44, 36, 12, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = g.c1; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = g.c2; ctx.fillRect(-12, -54, 8, 10); ctx.fillRect(4, -54, 8, 10);
      break;
    case 'balloon':
      ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -8); ctx.stroke();
      circle(ctx, -10, -44, 10, g.c1); circle(ctx, 10, -44, 10, g.c2); circle(ctx, 0, -56, 11, '#4aa8ff');
      break;
    case 'leaf':
      ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, -8); ctx.stroke();
      ellipse(ctx, 0, -44, 34, 11, g.c1); ctx.strokeStyle = g.c2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-32, -44); ctx.lineTo(32, -44); ctx.stroke();
      break;
    case 'plane':
      ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(-4, -8); ctx.moveTo(6, -30); ctx.lineTo(4, -8); ctx.stroke();
      poly(ctx, [-34, -34, 34, -34, 0, -50], g.c1); poly(ctx, [-6, -34, 6, -34, 0, -50], g.c2);
      break;
    case 'dragonwing':
      for (const sd of [-1, 1]) { ctx.save(); ctx.scale(sd, 1); ctx.rotate(Math.sin(t * 5) * 0.2); poly(ctx, [4, -6, 40, -30, 34, -14, 40, -8, 28, -2, 24, 6, 8, 2], g.c1); ctx.restore(); }
      break;
    case 'rocketboard':
      box(ctx, -22, 14, 44, 7, g.c1, 3); poly(ctx, [-22, 15, -32 - Math.random() * 6, 17.5, -22, 20], g.c2, null);
      break;
    case 'ufo':
      ellipse(ctx, 0, -44, 30, 9, g.c1); ellipse(ctx, 0, -50, 13, 9, 'rgba(120,255,240,0.6)', OUT);
      ctx.fillStyle = 'rgba(120,255,240,0.18)'; poly(ctx, [-14, -38, 14, -38, 22, 10, -22, 10], 'rgba(120,255,240,0.15)', null);
      for (let i = 0; i < 5; i++) circle(ctx, -20 + i * 10, -42, 2, (Math.floor(t * 6) + i) % 2 ? '#ffd23a' : g.c2, null);
      break;
  }
  ctx.restore();
}

/* ============================== ひこうせん ============================== */
function drawAirship(ctx, x, y, ang, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.globalAlpha = 0.25; ellipse(ctx, 40, 90, 150, 40, '#000', null); ctx.globalAlpha = 1;
  // ふうせん（クジラ）
  ellipse(ctx, 0, 0, 160, 58, '#5ab0ff', OUT, 3);
  ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.ellipse(10, 22, 120, 26, 0, 0, Math.PI); ctx.fill();
  for (let i = -3; i <= 3; i++) { ctx.strokeStyle = 'rgba(30,26,42,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(i * 36, -54); ctx.quadraticCurveTo(i * 40, 0, i * 36, 54); ctx.stroke(); }
  circle(ctx, 110, -12, 8, '#ffffff', OUT, 2); circle(ctx, 112, -12, 4, '#1d1a2a', null);
  poly(ctx, [-150, -10, -205, -50 + Math.sin(t * 3) * 6, -190, 0, -205, 50 - Math.sin(t * 3) * 6, -150, 10], '#4a98e8', OUT, 3);
  // ゴンドラ
  box(ctx, -50, 50, 100, 28, '#ffd23a', 8, OUT, 3);
  for (let i = 0; i < 4; i++) box(ctx, -40 + i * 22, 56, 14, 12, '#bdf4ff', 3, OUT, 1.5);
  // プロペラ
  ctx.save(); ctx.translate(-60, 64); ctx.rotate(t * 30); box(ctx, -2, -18, 4, 36, '#6a6e78', 2, OUT, 1.5); ctx.restore();
  ctx.restore();
}

/* ================================ ぶき ================================ */
/* 右むきに かく。原点は にぎる ところ。長さは だいたい 30px */
const _wvar = {};
function wVar(id) {
  if (_wvar[id]) return _wvar[id];
  const h = hashStr(id);
  const bodies = ['#3a3e48', '#4a4038', '#2e3440', '#50545e', '#3a4a3a'];
  return (_wvar[id] = { body: bodies[h % bodies.length], k: ((h >> 4) % 100) / 100, k2: ((h >> 11) % 100) / 100 });
}
function drawWeapon(ctx, w, rar = 0, s = 1) {
  if (!w) return;
  const v = wVar(w.id);
  const acc = w.col || RARITY[rar].color;
  const B = w.cat === 'energy' ? '#e8ecf4' : w.cat === 'toy' ? '#ff8ac8' : v.body;
  const D = shade(B, -0.3);
  ctx.save(); ctx.scale(s, s);
  ctx.lineJoin = 'round';
  const L = { pistol: 15, smg: 22, ar: 30, shotgun: 31, sniper: 42, lmg: 32, launcher: 36, energy: 30, element: 28, bow: 0, toy: 22 }[w.cat] || 24;
  const len = L * (0.9 + v.k * 0.2);
  const id = w.id;
  switch (w.cat) {
    case 'pistol':
      box(ctx, -2, 0, 5, 8, D, 1.5);
      box(ctx, -3, -5, len, 6, B, 2);
      if (w.p > 1) box(ctx, -1, -9, len, 5, B, 2);
      ctx.fillStyle = acc; ctx.fillRect(2, -4, len - 9, 1.6);
      if (id === 'revolver' || id === 'handcannon') circle(ctx, 4, -2, 3.5, D, OUT, 1);
      if (id === 'silencer') box(ctx, len - 3, -4.5, 8, 5, '#1d1a2a', 2);
      break;
    case 'smg': case 'ar': case 'lmg': {
      const body = len * 0.62;
      box(ctx, -10, -3, 9, 6, D, 2); // ストック
      box(ctx, -2, -5, body, 8, B, 2);
      box(ctx, body - 3, -2.5, len - body + 3, 3.5, D, 1);
      if (id.includes('drum')) circle(ctx, body * 0.45, 6, 5, D, OUT, 1.2);
      else if (w.cat === 'lmg') box(ctx, body * 0.3, 2, 9, 8, D, 1.5);
      else { ctx.save(); ctx.translate(body * 0.45, 2); ctx.rotate(0.25); box(ctx, -2, 0, 4.5, 8, D, 1.5); ctx.restore(); }
      box(ctx, 1, 2, 4, 6, D, 1.5);
      if (w.scope) box(ctx, body * 0.25, -9, body * 0.5, 4, '#1d1a2a', 2);
      if (w.p > 1) box(ctx, body - 3, -7, len - body + 1, 3, D, 1);
      if (w.silent) box(ctx, len - 2, -3.5, 9, 5, '#1d1a2a', 2);
      if (w.spin) for (let i = -1; i <= 1; i++) box(ctx, body - 2, -1 + i * 3, len - body + 6, 2, '#6a6e78', 1, OUT, 0.8);
      ctx.fillStyle = acc; ctx.fillRect(1, -3.5, body - 6, 2);
      break;
    }
    case 'shotgun':
      box(ctx, -11, -3, 10, 7, '#8a5a3a', 2);
      box(ctx, -2, -4, len * 0.4, 8, B, 2);
      box(ctx, len * 0.35, -4, len * 0.65, 4, D, 1);
      if (id === 'doublebarrel' || id === 'sawedoff') box(ctx, len * 0.35, 0, len * 0.65 * (id === 'sawedoff' ? 0.6 : 1), 3.5, D, 1);
      else box(ctx, len * 0.45, 0, 9, 4, '#8a5a3a', 1.5);
      if (id.includes('drum')) circle(ctx, len * 0.2, 6, 5, D, OUT, 1.2);
      ctx.fillStyle = acc; ctx.fillRect(0, -3, len * 0.32, 2);
      break;
    case 'sniper':
      box(ctx, -12, -3, 12, 7, w.silent ? '#2a2c34' : '#6a4a2a', 2);
      box(ctx, -2, -4, len * 0.4, 7, B, 2);
      box(ctx, len * 0.35, -2.5, len * 0.65, 3, D, 1);
      if (w.scope) { box(ctx, len * 0.05, -10, len * 0.32, 4.5, '#1d1a2a', 2); circle(ctx, len * 0.37 + 2, -8, 2.5, acc, OUT, 1); }
      if (w.silent) box(ctx, len - 2, -3.5, 10, 5, '#1d1a2a', 2);
      if (w.proj === 'beam') for (let i = 0; i < 3; i++) box(ctx, len * 0.45 + i * 7, -4.5, 3, 7, acc, 1, OUT, 0.8);
      ctx.fillStyle = acc; ctx.fillRect(0, 0, len * 0.3, 2);
      break;
    case 'launcher':
      if (w.proj === 'grenade' || id === 'harpoon') {
        box(ctx, -8, -3, 8, 7, D, 2); box(ctx, -1, -6, len * 0.75, 10, B, 3);
        if (id !== 'harpoon') circle(ctx, len * 0.25, -1, 6.5, D, OUT, 1.2);
        else { ctx.strokeStyle = '#cfd7e0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(len * 0.7, -1); ctx.lineTo(len + 6, -1); ctx.stroke(); poly(ctx, [len + 6, -5, len + 13, -1, len + 6, 3], '#cfd7e0', OUT, 1); }
      } else {
        box(ctx, -6, -6, len, 12, B, 5);
        box(ctx, len - 8, -7, 6, 14, acc, 2);
        box(ctx, -8, -5, 4, 10, D, 1);
        if (id === 'quadlauncher') for (let i = 0; i < 4; i++) circle(ctx, len - 2, -4.5 + i * 3, 1.3, '#1d1a2a', null);
        if (w.homing || w.guided) box(ctx, len * 0.3, -11, 9, 5, '#1d1a2a', 2);
      }
      box(ctx, 2, 4, 4, 7, D, 1.5);
      break;
    case 'energy':
      box(ctx, -8, -3, 8, 6, D, 2);
      box(ctx, -1, -5, len * 0.65, 9, B, 4);
      box(ctx, len * 0.6, -2.5, len * 0.4, 4, D, 2);
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(len * 0.7 + i * 4, -0.5, 4, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = acc; ctx.fillRect(2, -2, len * 0.5, 2.5);
      box(ctx, 2, 3, 4, 6, D, 1.5);
      if (w.hole) circle(ctx, len * 0.3, -1, 5, '#1d1a2a', acc, 2);
      break;
    case 'element':
      circle(ctx, -4, 2, 7, acc, OUT, 1.5);
      box(ctx, 0, -4, len * 0.7, 7, B, 3);
      box(ctx, len * 0.65, -5, 7, 9, D, 2);
      ctx.fillStyle = acc; ctx.fillRect(len * 0.65 + 7, -2, 3, 3);
      break;
    case 'bow':
      ctx.strokeStyle = OUT; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(-6, 0, 15, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = w.col || '#a8784a'; ctx.lineWidth = 2.8; ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-6 + Math.cos(-1.1) * 15, Math.sin(-1.1) * 15); ctx.lineTo(-6 + Math.cos(1.1) * 15, Math.sin(1.1) * 15); ctx.stroke();
      if (id === 'repeatxbow') { box(ctx, -4, -2.5, 22, 5, '#6a4a2a', 1.5); }
      ctx.strokeStyle = '#e8d0a0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(18, 0); ctx.stroke();
      poly(ctx, [18, -3, 24, 0, 18, 3], acc, OUT, 1);
      if (w.p > 1) { ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(16, -6); ctx.moveTo(-2, 4); ctx.lineTo(16, 6); ctx.stroke(); }
      break;
    case 'throw': drawThrowable(ctx, w, acc); break;
    case 'melee': drawMelee(ctx, w, acc); break;
    case 'toy': case 'utility': drawGadget(ctx, w, acc, B, D); break;
  }
  ctx.restore();
}

function drawThrowable(ctx, w, acc) {
  const id = w.id;
  if (id === 'landmine') { ellipse(ctx, 6, 0, 9, 6, '#5a5e48'); circle(ctx, 6, -1, 2.5, '#ff4a4a', OUT, 1); return; }
  if (id === 'molotov') { box(ctx, 0, -5, 12, 10, '#5ab04a', 3); box(ctx, 11, -2, 6, 4, '#5ab04a', 1); poly(ctx, [17, -3, 23, 0, 17, 3], '#ff8a2a', null); return; }
  const col = { grenade: '#5a6a3a', stickygrenade: '#5ad04a', smokebomb: '#9a9ea6', icegrenade: '#aef0ff', shockwave: '#7a6aff', clustergrenade: '#c84a3a', thundergrenade: '#ffd23a', blackholegrenade: '#2a1a4a', sleepgas: '#c8a0ff', healgrenade: '#ff9ae8' }[id] || acc;
  circle(ctx, 6, 0, 7, col);
  box(ctx, 3, -10, 6, 4, '#6a6e78', 1, OUT, 1);
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(11, -9, 3, 0, TAU); ctx.stroke();
  if (id === 'healgrenade') { ctx.fillStyle = '#ffffff'; ctx.fillRect(4.5, -3.5, 3, 7); ctx.fillRect(2.5, -1.5, 7, 3); }
  if (id === 'blackholegrenade') circle(ctx, 6, 0, 3, '#000', '#c86aff', 1.5);
  if (id === 'thundergrenade') poly(ctx, [7, -5, 3, 1, 6, 1, 4, 5, 9, -1, 6, -1], '#ffffff', null);
}

function drawMelee(ctx, w, acc) {
  const id = w.id;
  const handle = (l) => { box(ctx, -4, -2, l, 4, '#6a4028', 1.5); };
  switch (id) {
    case 'pickaxe': handle(26); poly(ctx, [20, -12, 24, -12, 28, 0, 24, 12, 20, 12, 23, 0], '#9aa4b0'); poly(ctx, [19, -10, 25, -10, 25, 10, 19, 10], acc, OUT, 1); break;
    case 'sword': handle(8); box(ctx, 3, -6, 3, 12, '#ffd23a', 1); poly(ctx, [6, -2.5, 34, -2.5, 38, 0, 34, 2.5, 6, 2.5], '#e0e4ec'); break;
    case 'greatsword': handle(10); box(ctx, 5, -8, 4, 16, '#6a6e78', 1); poly(ctx, [9, -4.5, 40, -4.5, 46, 0, 40, 4.5, 9, 4.5], '#cfd7e0'); ctx.fillStyle = acc; ctx.fillRect(10, -1, 24, 2); break;
    case 'katana': handle(9); ellipse(ctx, 6, 0, 2, 4, '#ffd23a', OUT, 1); ctx.strokeStyle = OUT; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(7, 0); ctx.quadraticCurveTo(22, -1, 38, -5); ctx.stroke(); ctx.strokeStyle = '#eef2f8'; ctx.lineWidth = 2.6; ctx.stroke(); break;
    case 'hammer': handle(26); box(ctx, 18, -9, 12, 18, '#8a8ea0', 2); ctx.fillStyle = acc; ctx.fillRect(19, -2, 10, 3); break;
    case 'spear': box(ctx, -6, -1.5, 40, 3, '#8a5a3a', 1); poly(ctx, [34, -5, 46, 0, 34, 5], '#e0e4ec'); box(ctx, 31, -3, 3, 6, acc, 1, OUT, 1); break;
    case 'axe': handle(26); ctx.beginPath(); ctx.moveTo(18, -2); ctx.lineTo(16, -12); ctx.quadraticCurveTo(30, -10, 28, 4); ctx.lineTo(18, 2); ctx.closePath(); ctx.fillStyle = '#cfd7e0'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke(); break;
    case 'dualblades': for (const o of [-5, 5]) { box(ctx, -3, o - 1.5, 7, 3, '#2a2c34', 1); poly(ctx, [4, o - 2, 20, o - 1, 23, o, 20, o + 1, 4, o + 2], '#e0e4ec', OUT, 1); } break;
    case 'beamsword': box(ctx, -4, -2.5, 11, 5, '#8a8ea0', 1.5); ctx.save(); ctx.shadowColor = acc; ctx.shadowBlur = 8; box(ctx, 7, -2.5, 34, 5, acc, 2.5, '#ffffff', 1); ctx.restore(); break;
    case 'boomerang': poly(ctx, [0, -10, 6, -10, 8, 0, 20, 4, 18, 9, 2, 4], '#c8883a'); ctx.fillStyle = acc; ctx.fillRect(3, -6, 3, 6); break;
    default: handle(12);
  }
}

function drawGadget(ctx, w, acc, B, D) {
  switch (w.id) {
    case 'watergun': box(ctx, -2, 0, 5, 8, '#ffd23a', 1.5); box(ctx, -4, -6, 22, 7, '#3a8aff', 3); circle(ctx, 4, -9, 4, '#7fd8ff', OUT, 1); box(ctx, 17, -4.5, 5, 3, '#ffd23a', 1, OUT, 1); break;
    case 'piethrow': ellipse(ctx, 8, 0, 10, 7, '#e8c080'); ellipse(ctx, 8, -1, 7, 4.5, '#fff4e0', null); circle(ctx, 8, -3, 2, '#ff4a4a', null); break;
    case 'pikohammer': box(ctx, -4, -1.5, 24, 3, '#ffd23a', 1); box(ctx, 18, -8, 9, 16, '#ff5a8a', 3); box(ctx, 16, -8, 3, 16, '#ffd23a', 1); box(ctx, 26, -8, 3, 16, '#ffd23a', 1); break;
    case 'paperplane': box(ctx, -4, -5, 26, 9, '#ffffff', 3); poly(ctx, [8, -12, 20, -8, 8, -6], '#ffffff', OUT, 1); box(ctx, 1, 3, 4, 6, '#c0c4cc', 1.5); break;
    case 'snowballer': box(ctx, -4, -6, 22, 11, '#3a8aff', 4); circle(ctx, 6, -9, 5, '#ffffff', OUT, 1); circle(ctx, 20, -0.5, 3, '#ffffff', OUT, 1); box(ctx, 1, 4, 4, 6, '#2a5ab8', 1.5); break;
    case 'banana': ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(8, -6, 10, 0.4, 2.6); ctx.stroke(); ctx.strokeStyle = '#ffe04a'; ctx.lineWidth = 4; ctx.stroke(); break;
    case 'toyturret': box(ctx, 0, -2, 14, 10, '#5a8ac8', 3); box(ctx, 12, 0, 9, 3.5, '#3a3e48', 1); circle(ctx, 7, -4, 4, '#ffd23a', OUT, 1); break;
    case 'confetti': box(ctx, -4, -6, 26, 11, '#ffd23a', 4); for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#ff4a4a', '#4aa8ff', '#5fd35a', '#ff5ac8', '#a64aff'][i]; ctx.fillRect(1 + i * 4, -4, 2.5, 7); } box(ctx, 2, 4, 4, 6, '#c8883a', 1.5); break;
    case 'grappler': box(ctx, -2, 0, 5, 8, D, 1.5); box(ctx, -4, -6, 20, 8, '#4a6a8a', 3); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(16, -2); ctx.lineTo(22, -2); ctx.moveTo(22, -2); ctx.lineTo(26, -7); ctx.moveTo(22, -2); ctx.lineTo(26, 3); ctx.stroke(); break;
    case 'dashboots': poly(ctx, [0, -10, 8, -10, 8, 2, 20, 4, 20, 9, 0, 9], '#ff5a3a'); poly(ctx, [-6, -6, -2, -8, -2, 0], '#ffffff', OUT, 1); poly(ctx, [-8, 0, -2, -2, -2, 6], '#ffffff', OUT, 1); break;
    case 'portafort': box(ctx, 0, -8, 18, 16, '#7f9ab8', 2); ctx.strokeStyle = OUT; ctx.lineWidth = 1; for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, -8 + i * 5.3); ctx.lineTo(18, -8 + i * 5.3); ctx.stroke(); } break;
    case 'jumppad': ellipse(ctx, 9, 2, 12, 6, '#5a5e6a'); ellipse(ctx, 9, 0, 9, 4, '#5affb0'); poly(ctx, [6, 0, 9, -6, 12, 0], '#ffffff', null); break;
    case 'barrier': poly(ctx, [9, -10, 18, -5, 18, 5, 9, 10, 0, 5, 0, -5], 'rgba(90,200,255,0.6)', '#5ac8ff', 2); break;
    default: box(ctx, 0, -5, 20, 10, B, 3);
  }
}

/* かいふく アイテム */
function drawHeal(ctx, hid, s = 1) {
  const h = HEALS[hid];
  ctx.save(); ctx.scale(s, s);
  switch (h.icon) {
    case 'bandage': ctx.save(); ctx.rotate(-0.6); box(ctx, -12, -4, 24, 8, '#f0d0a0', 3); box(ctx, -4, -4, 8, 8, '#e0b880', 1, null); ctx.restore(); ctx.save(); ctx.rotate(0.6); box(ctx, -12, -4, 24, 8, '#f6dcb0', 3); ctx.restore(); break;
    case 'medkit': box(ctx, -12, -9, 24, 18, '#ffffff', 3); ctx.fillStyle = '#ff4a4a'; ctx.fillRect(-2.5, -6, 5, 12); ctx.fillRect(-6, -2.5, 12, 5); box(ctx, -5, -12, 10, 4, '#c0c4cc', 1, OUT, 1); break;
    case 'smallsh': box(ctx, -5, -6, 10, 15, h.col, 4); box(ctx, -2.5, -11, 5, 5, '#e0e4ec', 1); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-3, -3, 2, 8); break;
    case 'bigsh': box(ctx, -9, -8, 18, 19, h.col, 6); box(ctx, -3, -13, 6, 5, '#e0e4ec', 1); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-6, -4, 3, 10); break;
    case 'mixjuice': poly(ctx, [-6, -10, 6, -10, 8, 10, -8, 10], h.col); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(5, -16); ctx.stroke(); circle(ctx, -1, 2, 3, '#ff9ae8', null); break;
    case 'supersoda': box(ctx, -8, -11, 16, 22, h.col, 4); ctx.fillStyle = '#ff4a4a'; ctx.fillRect(-8, -3, 16, 6); star(ctx, 0, 0, 3.5, '#ffffff', null); break;
  }
  ctx.restore();
}

/* ============================== 地図の もの ============================== */
function tileRand(tx, ty, k = 0) { return ((Math.imul(tx * 73856093 ^ ty * 19349663 ^ k * 83492791, 2654435761) >>> 0) % 1000) / 1000; }

function drawObj(ctx, o, tx, ty, hpr) {
  const x = tx * TILE, y = ty * TILE, T = TILE, cx = x + T / 2, cy = y + T / 2;
  const r = tileRand(tx, ty);
  switch (o) {
    case OB.TREE: case OB.PINE: ellipse(ctx, cx, cy + 6, 12, 6, 'rgba(0,0,0,0.25)', null); box(ctx, cx - 5, cy - 6, 10, 16, '#7a4a2a', 3); break;
    case OB.DEADTREE: box(ctx, cx - 4, cy - 8, 8, 18, '#5a4030', 2); ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx - 12, cy - 14); ctx.moveTo(cx, cy - 2); ctx.lineTo(cx + 12, cy - 12); ctx.stroke(); break;
    case OB.CACTUS: ellipse(ctx, cx, cy + 10, 10, 4, 'rgba(0,0,0,0.2)', null); box(ctx, cx - 6, cy - 16, 12, 28, '#4aa04a', 6); box(ctx, cx - 15, cy - 8, 7, 12, '#4aa04a', 3.5); box(ctx, cx + 8, cy - 12, 7, 12, '#4aa04a', 3.5); break;
    case OB.ROCK: {
      const c = '#9a9ea8';
      poly(ctx, [x + 3, cy + 6, x + 7 + r * 4, y + 6, cx + 4, y + 2, x + T - 4, y + 10 + r * 4, x + T - 2, cy + 10, cx, y + T - 2, x + 6, y + T - 4], c);
      poly(ctx, [x + 9, y + 10, cx, y + 6, cx + 6, y + 12, cx, cy], shade(c, 0.25), null);
      break;
    }
    case OB.BUSH: for (let i = 0; i < 4; i++) circle(ctx, x + 10 + (i % 2) * 18 + r * 4, y + 12 + Math.floor(i / 2) * 16, 11, i % 2 ? '#3a9a3a' : '#48b048', '#2a6a2a', 1.5); break;
    case OB.WWOOD: case OB.WBRICK: case OB.WMETAL: case OB.BWOOD: case OB.BSTONE: case OB.BMETAL: drawWall(ctx, o, tx, ty, x, y, hpr); break;
    case OB.CRATE: box(ctx, x + 4, y + 4, T - 8, T - 8, '#c8904a', 2); ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + T - 6, y + T - 6); ctx.moveTo(x + T - 6, y + 6); ctx.lineTo(x + 6, y + T - 6); ctx.stroke(); break;
    case OB.CHEST: {
      const glow = 0.5 + Math.sin(G.time * 4 + tx) * 0.5;
      ctx.save(); ctx.shadowColor = '#ffd23a'; ctx.shadowBlur = 10 + glow * 10;
      box(ctx, x + 5, y + 9, T - 10, T - 14, '#b8742a', 3); ctx.restore();
      box(ctx, x + 5, y + 9, T - 10, 9, '#d8943a', 3); box(ctx, cx - 3, y + 15, 6, 7, '#ffd23a', 1, OUT, 1);
      ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2; ctx.strokeRect(x + 6, y + 10, T - 12, T - 16);
      break;
    }
    case OB.CHESTOPEN: box(ctx, x + 5, y + 14, T - 10, T - 18, '#6a4a2a', 3); box(ctx, x + 5, y + 6, T - 10, 8, '#8a5a2a', 3); break;
    case OB.AMMOBOX: box(ctx, x + 5, y + 10, T - 10, T - 18, '#4a6a3a', 2); ctx.fillStyle = '#ffd23a'; ctx.fillRect(x + 8, y + 14, T - 16, 4); ctx.fillStyle = '#ffffff'; ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('AMMO', cx, y + T - 10); break;
    case OB.CARL: case OB.CARR: {
      if (o === OB.CARR) break; // ひだりの マスで 2マスぶん かく
      const cols = ['#e84a4a', '#3a8aff', '#ffd23a', '#ffffff', '#5ad04a', '#a64aff'];
      const c = cols[Math.floor(r * cols.length)];
      box(ctx, x + 4, y + 6, T * 2 - 8, T - 12, c, 8);
      box(ctx, x + 22, y + 10, T * 2 - 44, T - 20, '#bdf4ff', 4);
      ctx.fillStyle = '#1d1a2a'; ctx.fillRect(x + 12, y + 3, 10, 4); ctx.fillRect(x + T * 2 - 22, y + 3, 10, 4); ctx.fillRect(x + 12, y + T - 7, 10, 4); ctx.fillRect(x + T * 2 - 22, y + T - 7, 10, 4);
      if (hpr < 1) drawCracks(ctx, x, y, T * 2, T, hpr);
      break;
    }
    case OB.FENCE: {
      const hz = World.obAt(tx - 1, ty) === OB.FENCE || World.obAt(tx + 1, ty) === OB.FENCE;
      ctx.fillStyle = '#c8945a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
      if (hz) { box(ctx, x, cy - 6, T, 4, '#c8945a', 1); box(ctx, x, cy + 2, T, 4, '#c8945a', 1); box(ctx, x + 4, cy - 10, 6, 20, '#a87440', 1); box(ctx, x + T - 10, cy - 10, 6, 20, '#a87440', 1); }
      else { box(ctx, cx - 6, y, 4, T, '#c8945a', 1); box(ctx, cx + 2, y, 4, T, '#c8945a', 1); box(ctx, cx - 10, y + 4, 20, 6, '#a87440', 1); box(ctx, cx - 10, y + T - 10, 20, 6, '#a87440', 1); }
      break;
    }
    case OB.BARREL: circle(ctx, cx, cy, 14, '#d83a2a'); ctx.strokeStyle = '#8a1a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, TAU); ctx.stroke(); ctx.fillStyle = '#ffd23a'; ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', cx, cy + 1); break;
    case OB.HAY: box(ctx, x + 3, y + 5, T - 6, T - 10, '#e8c85a', 4); ctx.strokeStyle = '#b8983a'; ctx.lineWidth = 1.5; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 3 + i * 8.5, y + 6); ctx.lineTo(x + 3 + i * 8.5, y + T - 6); ctx.stroke(); } break;
    case OB.SNOWMAN: circle(ctx, cx, cy + 6, 12, '#ffffff'); circle(ctx, cx, cy - 9, 8, '#ffffff'); circle(ctx, cx - 3, cy - 10, 1.3, '#1d1a2a', null); circle(ctx, cx + 3, cy - 10, 1.3, '#1d1a2a', null); poly(ctx, [cx, cy - 8, cx + 7, cy - 7, cx, cy - 6], '#ff8a2a', null); break;
    case OB.TENT: poly(ctx, [x + 2, y + T - 4, cx, y + 2, x + T - 2, y + T - 4], r < 0.5 ? '#ff8a2a' : '#3a8aff'); poly(ctx, [cx - 5, y + T - 4, cx, y + 14, cx + 5, y + T - 4], '#1d1a2a', null); break;
    case OB.MACHINE: box(ctx, x + 2, y + 2, T - 4, T - 4, '#6a7080', 3); box(ctx, x + 8, y + 8, T - 16, 10, '#2a2c34', 2); ctx.fillStyle = Math.sin(G.time * 5 + tx) > 0 ? '#5aff7a' : '#ff4a4a'; ctx.fillRect(x + 10, y + 26, 5, 5); ctx.fillStyle = '#ffd23a'; ctx.fillRect(x + 20, y + 26, 10, 5); break;
    case OB.PILLAR: circle(ctx, cx, cy, 15, '#c8c0b0'); circle(ctx, cx, cy, 10, '#d8d0c0', '#a8a090', 1.5); break;
    case OB.EBARRIER: { ctx.save(); ctx.globalAlpha = 0.55 + Math.sin(G.time * 8) * 0.1; box(ctx, x + 1, y + 1, T - 2, T - 2, '#5ac8ff', 4, '#bdf4ff', 2); ctx.restore(); break; }
    case OB.CAMPFIRE: circle(ctx, cx, cy, 10, '#5a4a3a', null); for (let i = 0; i < 3; i++) poly(ctx, [cx - 7 + i * 5, cy + 4, cx - 4 + i * 5, cy - 8 - Math.sin(G.time * 10 + i) * 4, cx - 1 + i * 5, cy + 4], i === 1 ? '#ffd23a' : '#ff6a2a', null); break;
  }
}

function drawCracks(ctx, x, y, w, h, hpr) {
  ctx.strokeStyle = 'rgba(20,16,30,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (hpr < 0.75) { ctx.moveTo(x + w * 0.3, y + h * 0.2); ctx.lineTo(x + w * 0.45, y + h * 0.5); ctx.lineTo(x + w * 0.35, y + h * 0.8); }
  if (hpr < 0.45) { ctx.moveTo(x + w * 0.7, y + h * 0.15); ctx.lineTo(x + w * 0.55, y + h * 0.45); ctx.lineTo(x + w * 0.75, y + h * 0.7); }
  if (hpr < 0.25) { ctx.moveTo(x + w * 0.1, y + h * 0.6); ctx.lineTo(x + w * 0.5, y + h * 0.55); ctx.lineTo(x + w * 0.9, y + h * 0.9); }
  ctx.stroke();
}

function drawWall(ctx, o, tx, ty, x, y, hpr) {
  const T = TILE;
  const col = { [OB.WWOOD]: '#b07a44', [OB.WBRICK]: '#b85a44', [OB.WMETAL]: '#7a8698', [OB.BWOOD]: '#d09a5a', [OB.BSTONE]: '#a8acb4', [OB.BMETAL]: '#8aa4c4' }[o];
  const build = OBD[o].build;
  // まだ たてている とちゅうなら うすく
  let alpha = 1;
  if (build) { const mx = OBD[o].hp; const h = World.hp[ty * MW + tx]; alpha = clamp(0.45 + (h / mx) * 0.55, 0.45, 1); }
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = shade(col, -0.35); ctx.fillRect(x, y + T - 7, T, 7);
  ctx.fillStyle = col; ctx.fillRect(x, y, T, T - 7);
  ctx.strokeStyle = shade(col, -0.25); ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (o === OB.WBRICK || o === OB.BSTONE) { for (let i = 1; i < 4; i++) { ctx.moveTo(x, y + i * 8.25); ctx.lineTo(x + T, y + i * 8.25); } for (let i = 0; i < 4; i++) { const off = i % 2 ? 10 : 0; ctx.moveTo(x + off + 20, y + i * 8.25); ctx.lineTo(x + off + 20, y + (i + 1) * 8.25); } }
  else if (o === OB.WWOOD || o === OB.BWOOD) { for (let i = 1; i < 4; i++) { ctx.moveTo(x + i * 10, y); ctx.lineTo(x + i * 10, y + T - 7); } }
  else { ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + T - 4, y + 4); ctx.moveTo(x + 4, y + T - 11); ctx.lineTo(x + T - 4, y + T - 11); }
  ctx.stroke();
  if (build) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3); }
  ctx.restore();
  if (hpr < 1) drawCracks(ctx, x, y, T, T, hpr);
}

/* 木の 葉っぱ（キャラより うえに かく） */
function drawCanopy(ctx, o, tx, ty, alpha) {
  const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
  const r = tileRand(tx, ty, 3);
  ctx.save(); ctx.globalAlpha = alpha;
  if (o === OB.PINE) {
    const snowy = World.grAt(tx, ty) === GR.SNOW;
    for (let i = 0; i < 3; i++) poly(ctx, [cx - 26 + i * 6, cy - 4 - i * 14, cx, cy - 34 - i * 12, cx + 26 - i * 6, cy - 4 - i * 14], i % 2 ? '#2a7a4a' : '#358a55', '#1d4a2a', 1.5);
    if (snowy) poly(ctx, [cx - 8, cy - 50, cx, cy - 58, cx + 8, cy - 50], '#ffffff', null);
  } else {
    const c = r < 0.33 ? '#3aa04a' : r < 0.66 ? '#4ab04a' : '#2f9040';
    circle(ctx, cx - 14, cy - 14, 18, c, '#1d5a2a', 1.5);
    circle(ctx, cx + 14, cy - 16, 18, c, '#1d5a2a', 1.5);
    circle(ctx, cx, cy - 28, 20, shade(c, 0.1), '#1d5a2a', 1.5);
    circle(ctx, cx - 6, cy - 32, 6, 'rgba(255,255,255,0.18)', null);
  }
  ctx.restore();
}

/* ゆかに おちている アイテム */
function drawLootItem(ctx, it, x, y, t) {
  const bob = Math.sin(t * 3 + x * 0.01) * 2;
  if (it.kind === 'w') {
    const w = WEAPONS[it.id], col = RARITY[it.r].color;
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.1;
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y + 8, 18, 6, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.25; ctx.fillRect(x - 1.5, y - 30, 3, 36);
    ctx.restore();
    ctx.save(); ctx.translate(x - 10, y + bob - 2); drawWeapon(ctx, w, it.r, 0.85); ctx.restore();
  } else if (it.kind === 'h') {
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, y + 8, 14, 5, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(x, y + bob - 2); drawHeal(ctx, it.id, 0.85); ctx.restore();
  } else if (it.kind === 'ammo') {
    const a = AMMO[it.id];
    box(ctx, x - 9, y - 5 + bob, 18, 12, '#3a4a3a', 2);
    ctx.fillStyle = a.color; ctx.fillRect(x - 6, y - 2 + bob, 12, 5);
  } else if (it.kind === 'mat') {
    const m = MATS.find((mm) => mm.id === it.id);
    for (let i = 0; i < 3; i++) box(ctx, x - 9 + i * 3, y - 6 + i * 3 + bob, 14, 7, m.color, 2);
  }
}
