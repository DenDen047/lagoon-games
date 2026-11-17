/* =========================================================================
   SNOW HAUNT ― 絵
   すべて プログラムで 描く。ゆきオバケ / おきゃくさん / しかけ / マス
   どれも 1マス = 32 の 大きさで 描いて、ts / 32 倍に のばす。
   ========================================================================= */
'use strict';

const INK = '#2a2440';

function ell(g, x, y, rx, ry, fill, stroke, lw = 1.5) {
  g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
function circ(g, x, y, r, fill, stroke, lw) { ell(g, x, y, r, r, fill, stroke, lw); }
function rect(g, x, y, w, h, fill, stroke, lw = 1.2) {
  if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); }
  if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.strokeRect(x, y, w, h); }
}
function poly(g, pts, fill, stroke, lw = 1.2) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
function line(g, x1, y1, x2, y2, color, lw = 1.2) {
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
  g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.stroke();
}
function flame(g, x, y, s, t, seed) {
  const f = 1 + Math.sin(t * 17 + seed) * 0.12 + Math.sin(t * 7.3 + seed * 2) * 0.08;
  g.beginPath(); g.moveTo(x, y - 5 * s * f); g.quadraticCurveTo(x + 2.6 * s, y - 1 * s, x, y + 1.2 * s); g.quadraticCurveTo(x - 2.6 * s, y - 1 * s, x, y - 5 * s * f);
  g.fillStyle = '#ffb030'; g.fill();
  ell(g, x, y - 0.6 * s, 1 * s, 1.7 * s * f, '#fff4b0');
}

/* ================================ ゆきオバケ ================================
   ネズミの冒険の 雪山に でてくる ゆきオバケと おなじ かたち。
   o: { t, face, alpha, scare, sleep, seed } */
function drawGhost(g, x, y, ts, type, o) {
  const d = GHOSTS[type], k = ts / 32 * (d.scale || 1), t = o.t || 0, seed = o.seed || 0;
  const alpha = o.alpha == null ? 1 : o.alpha;
  g.save();
  g.translate(x, y);
  g.globalAlpha = alpha * 0.22; ell(g, 0, 0, 9 * k, 3 * k, '#000');
  g.globalAlpha = alpha;
  if (d.robot) { g.scale(k * (o.face || 1), k); drawRobot(g, type, o, t, seed); g.restore(); return; }
  const bob = o.sleep ? 0 : Math.sin(t * 3 + seed) * 2;
  g.translate(0, (-7 - bob) * k);
  g.scale(k * (o.face || 1), k);
  if (type === 'fubuki') {
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + i * 2.1;
      g.beginPath(); g.ellipse(0, -12, 17, 7, 0, a, a + 1.6);
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.6; g.stroke();
    }
  }
  // からだ。すその なみが ゆらゆら うごく
  if (o.scare) { ell(g, -12.5, -13, 3, 4.5, d.body, d.line, 1.2); ell(g, 12.5, -13, 3, 4.5, d.body, d.line, 1.2); }
  g.beginPath(); g.moveTo(-11, -4);
  for (let i = 0; i <= 4; i++) {
    const w = Math.sin(t * 6 + i + seed) * 1.2;
    g.quadraticCurveTo(-11 + i * 5.5 - 2.75, -1 + (i % 2 ? 2 : -2) + w, -11 + i * 5.5, -4);
  }
  g.lineTo(11, -14); g.arc(0, -14, 11, 0, Math.PI, true); g.closePath();
  g.fillStyle = d.body; g.fill(); g.strokeStyle = d.line; g.lineWidth = 1.4; g.stroke();
  // しゅるいごとの しるし
  if (type === 'yozora') {
    for (const [sx, sy] of [[-6, -19], [5, -8], [-3, -7], [7, -20], [0, -22]]) circ(g, sx, sy, 0.8, '#ffe680');
  } else if (type === 'kori') {
    poly(g, [-5, -24, -3, -29, -1, -24], '#aee6ff', '#4a9ad0', 0.8);
    poly(g, [-1, -25, 1.5, -31, 4, -25], '#c8f0ff', '#4a9ad0', 0.8);
    poly(g, [4, -24, 6, -28, 8, -23], '#aee6ff', '#4a9ad0', 0.8);
  } else if (type === 'ousama') {
    poly(g, [-7, -23, -7, -30, -3.5, -26, 0, -32, 3.5, -26, 7, -30, 7, -23], '#ffd23a', '#a07010', 1);
    circ(g, 0, -27, 1.2, '#ff5a7a');
  } else if (type === 'oo') {
    line(g, -6, -20, -1.5, -18.5, d.line, 1.8); line(g, 6, -20, 1.5, -18.5, d.line, 1.8);
  }
  // かお
  const eye = type === 'yozora' ? '#ffe24a' : '#2a3048';
  if (o.sleep) {
    for (const ex of [-3.5, 3.5]) { g.beginPath(); g.arc(ex + 1, -15, 2, 0.2, Math.PI - 0.2); g.strokeStyle = eye; g.lineWidth = 1.2; g.stroke(); }
    ell(g, 1, -10, 1.4, 0.9, '#4a5070');
  } else if (o.scare) {
    ell(g, -3.5, -16, 2.6, 3.2, eye); ell(g, 4.5, -16, 2.6, 3.2, eye);
    circ(g, -2.8, -17, 0.9, '#fff'); circ(g, 5.2, -17, 0.9, '#fff');
    ell(g, 0.5, -9, 4, 3.4, '#3a2a48'); ell(g, 0.5, -7.6, 2.4, 1.3, '#ff7a9a');
  } else {
    circ(g, -2.5, -15, 2, eye); circ(g, 4.5, -15, 2, eye);
    circ(g, -2, -15.6, 0.6, '#fff'); circ(g, 5, -15.6, 0.6, '#fff');
    const blush = type === 'kori' ? 'rgba(120,200,255,.6)' : 'rgba(255,140,170,.6)';
    ell(g, -5, -11, 2.2, 1.2, blush); ell(g, 7.5, -11, 2.2, 1.2, blush);
    ell(g, 1, -10.5, 1.8, 1.1, '#4a5070');
  }
  g.restore();
}

/* ロボット。ガシャガシャ あるく きかい */
function drawRobot(g, type, o, t, seed) {
  const walk = o.scare ? Math.sin(t * 20) * 1.5 : 0, eye = o.sleep ? '#3a3a4a' : o.scare ? '#ff3a3a' : '#ffe24a';
  const metal = type === 'mecha' ? '#eef2f8' : type === 'skull' ? '#2e2a3a' : '#9aa6b8', dark = type === 'mecha' ? '#9aaac0' : type === 'skull' ? '#18141f' : '#5a6478';
  rect(g, -7 + walk, -6, 5, 6, dark, INK, 1); rect(g, 2 - walk, -6, 5, 6, dark, INK, 1);
  rr(g, -9, -19, 18, 14, 3); g.fillStyle = metal; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
  if (type === 'skull') for (let i = 0; i < 3; i++) line(g, -5, -16 + i * 3.5, 5, -16 + i * 3.5, '#e8e4dc', 1.4);
  else if (type === 'mecha') { for (let i = 0; i < 5; i++) line(g, -8 + i * 4, -6, -7 + i * 4, -3, '#dfe6f0', 1.6); rect(g, -4, -16, 8, 5, '#6ad0ff', INK, 0.8); }
  else { circ(g, -6, -16, 0.8, dark); circ(g, 6, -16, 0.8, dark); rect(g, -4, -14, 8, 5, '#4a5468', INK, 0.8); circ(g, -2, -11.5, 1, '#4ad06a'); circ(g, 1.5, -11.5, 1, '#ff6a6a'); }
  const up = o.scare ? -8 : 0;
  line(g, -9, -15, -13, -11 + up, INK, 3); line(g, -9, -15, -13, -11 + up, metal, 1.8);
  line(g, 9, -15, 13, -11 + up, INK, 3); line(g, 9, -15, 13, -11 + up, metal, 1.8);
  poly(g, [-14, -11 + up, -12, -9 + up, -14, -8 + up], dark); poly(g, [14, -11 + up, 12, -9 + up, 14, -8 + up], dark);
  if (type === 'skull') {
    circ(g, 0, -25, 7.5, '#f4f0e8', INK, 1.1);
    ell(g, -2.8, -25.5, 2.2, 2.6, '#1a1424'); ell(g, 2.8, -25.5, 2.2, 2.6, '#1a1424');
    circ(g, -2.8, -25.5, 0.9, eye); circ(g, 2.8, -25.5, 0.9, eye);
    for (let i = -2; i <= 2; i++) line(g, i * 1.4, -20, i * 1.4, -18.5, INK, 0.8);
  } else {
    rr(g, -7, -31, 14, 11, 3); g.fillStyle = metal; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
    if (type === 'mecha') { ell(g, -4, -31, 3, 2, '#ffffff'); ell(g, 4, -31, 3, 2, '#ffffff'); }
    rect(g, -5, -28, 10, 4, '#1a1a2a');
    circ(g, -2.5, -26, 1.3, eye); circ(g, 2.5, -26, 1.3, eye);
    line(g, 0, -31, 0, -35, INK, 1); circ(g, 0, -36, 1.6, o.scare ? '#ff3a3a' : '#ff8a4a');
  }
}

/* ================================ おきゃくさん ================================ */
function drawGuest(g, x, y, ts, gu, t) {
  const sp = GUESTS[gu.sp], k = ts / 32 * (gu.kid ? 0.8 : 1);
  const fled = gu.st === 'flee', fear = gu.fear;
  g.save();
  g.translate(x, y);
  g.globalAlpha = 0.22; ell(g, 0, 0, 7 * k, 2.6 * k, '#000'); g.globalAlpha = 1;
  const moving = gu.stun <= 0 && !gu.idle;
  const step = moving ? Math.sin(t * (fled ? 26 : 13) + gu.id) : 0;
  const hop = Math.sin(gu.hop * Math.PI) * 7;
  const shiver = (gu.aura || fear > 70) && !fled ? Math.sin(t * 50 + gu.id) * 0.6 : 0;
  g.translate(shiver * k, (-Math.abs(step) * 1.4 - hop) * k);
  g.scale(k * gu.face, k);
  const fur = sp.fur, belly = sp.belly, scarf = `hsl(${Math.round(gu.hue * 360)},70%,58%)`;
  // しっぽ
  if (sp.tail) { g.beginPath(); g.moveTo(-5, -6); g.bezierCurveTo(-16, -4, -16, -22, -8, -22); g.bezierCurveTo(-12, -16, -9, -10, -4, -9); g.fillStyle = fur; g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke(); }
  // あし
  ell(g, -3 + step * 1.5, -1.5, 2.6, 1.8, sp.ear === 'none' ? '#f0a030' : shade2(fur), INK, 0.8);
  ell(g, 3 - step * 1.5, -1.5, 2.6, 1.8, sp.ear === 'none' ? '#f0a030' : shade2(fur), INK, 0.8);
  // からだ
  ell(g, 0, -8, 7.5, 7, fur, INK, 1);
  ell(g, 1, -7, 4.6, 4.8, belly);
  // うで (にげるときは ばんざい)
  if (fled) { line(g, -5, -11, -9, -19, INK, 3.2); line(g, -5, -11, -9, -19, fur, 2); line(g, 5, -11, 9, -19, INK, 3.2); line(g, 5, -11, 9, -19, fur, 2); }
  // あたま
  const hy = -17;
  if (sp.ear === 'long') {
    ell(g, -3, hy - 10, 2.4, 6.5, fur, INK, 1); ell(g, -3, hy - 10, 1.1, 4.5, '#ffb0c0');
    ell(g, 3, hy - 10, 2.4, 6.5, fur, INK, 1); ell(g, 3, hy - 10, 1.1, 4.5, '#ffb0c0');
  } else if (sp.ear === 'round' || sp.ear === 'big') {
    const r = sp.ear === 'big' ? 4.4 : 3;
    circ(g, -5, hy - 5.5, r, fur, INK, 1); circ(g, -5, hy - 5.5, r * 0.55, '#ffb0c0');
    circ(g, 5, hy - 5.5, r, fur, INK, 1); circ(g, 5, hy - 5.5, r * 0.55, '#ffb0c0');
  } else if (sp.ear === 'tuft') {
    poly(g, [-7, hy - 3, -5, hy - 11, -2, hy - 5], fur, INK, 1); poly(g, [7, hy - 3, 5, hy - 11, 2, hy - 5], fur, INK, 1);
  }
  circ(g, 0, hy, 7.5, fur, INK, 1);
  if (sp.ear === 'none') ell(g, 1.5, hy + 1, 5, 5, belly);
  // マフラー
  g.beginPath(); g.ellipse(0, -11.5, 6.8, 2.2, 0, 0, TAU); g.fillStyle = scarf; g.fill();
  rect(g, -5, -11, 3, 6, scarf);
  // こどもは ニットぼう
  if (gu.kid) { g.beginPath(); g.arc(0, hy - 2, 7.6, Math.PI, 0); g.fillStyle = scarf; g.fill(); circ(g, 0, hy - 10.5, 2.2, '#fff'); rect(g, -7.6, hy - 3, 15.2, 2.4, '#fff'); }
  // かお
  const ex = 2;
  if (fled) {
    line(g, ex - 4.5, hy - 2, ex - 2, hy - 0.5, INK, 1.3); line(g, ex - 4.5, hy + 1, ex - 2, hy - 0.5, INK, 1.3);
    line(g, ex + 4.5, hy - 2, ex + 2, hy - 0.5, INK, 1.3); line(g, ex + 4.5, hy + 1, ex + 2, hy - 0.5, INK, 1.3);
    ell(g, ex, hy + 3.6, 2.2, 2.6, '#5a2030');
    ell(g, ex - 5, hy + 2, 0.9, 2.2, '#8ad0ff'); ell(g, ex + 5, hy + 2, 0.9, 2.2, '#8ad0ff');
  } else if (fear > 50) {
    circ(g, ex - 3, hy - 0.5, 2.2, '#fff', INK, 0.7); circ(g, ex + 3, hy - 0.5, 2.2, '#fff', INK, 0.7);
    circ(g, ex - 3, hy - 0.5, 0.9, INK); circ(g, ex + 3, hy - 0.5, 0.9, INK);
    ell(g, ex, hy + 3.6, 1.3, 1.6, '#5a2030');
  } else {
    circ(g, ex - 3, hy - 0.5, 1.3, INK); circ(g, ex + 3, hy - 0.5, 1.3, INK);
    circ(g, ex - 2.6, hy - 1, 0.45, '#fff'); circ(g, ex + 3.4, hy - 1, 0.45, '#fff');
    if (sp.ear === 'none') poly(g, [ex - 1.5, hy + 1.5, ex + 1.5, hy + 1.5, ex, hy + 3.5], '#f0a030');
    else { g.beginPath(); g.arc(ex, hy + 2, 1.6, 0.2, Math.PI - 0.2); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke(); }
  }
  if (sp.ear !== 'none' && !fled) { ell(g, ex - 5, hy + 2.2, 1.6, 1, 'rgba(255,130,150,.55)'); ell(g, ex + 5, hy + 2.2, 1.6, 1, 'rgba(255,130,150,.55)'); }
  if (fear > 60 && !fled) { g.beginPath(); g.moveTo(-7, hy - 6); g.quadraticCurveTo(-9.5, hy - 2, -7, hy - 1.5); g.quadraticCurveTo(-4.5, hy - 2, -7, hy - 6); g.fillStyle = '#8ad0ff'; g.fill(); }
  // レポーターは カメラを もつ
  if (gu.reporter) { rect(g, 4, -12, 9, 6, '#30303a', INK, 0.8); circ(g, 13, -9, 2, '#6a7aa0', INK, 0.8); circ(g, 6, -13, 1, '#ff4040'); }
  // こおりづけ
  if (gu.iced) {
    g.globalAlpha = 0.55; rect(g, -10, -27, 20, 27, '#bfeaff', '#6ac0f0', 1.2); g.globalAlpha = 0.9;
    line(g, -7, -24, -3, -20, '#ffffff', 1.2); line(g, 4, -10, 7, -6, '#ffffff', 1.2);
  }
  g.restore();
}
function shade2(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * 0.82);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/* ================================ しかけ ================================
   x, y は マスの まんなか。 p: { type, _anim, x, y } */
function drawProp(g, x, y, ts, type, anim, t, seed = 0) {
  const k = ts / 32;
  g.save();
  g.translate(x, y + 8 * k);
  g.scale(k, k);
  switch (type) {
    case 'candle': {
      ell(g, 0, 0, 8, 2.6, '#1a1428');
      line(g, 0, 0, 0, -10, '#6a5a40', 2.4);
      g.beginPath(); g.moveTo(-8, -12); g.quadraticCurveTo(0, -6, 8, -12); g.strokeStyle = '#6a5a40'; g.lineWidth = 2; g.stroke();
      for (const [cx, h] of [[-8, 7], [0, 10], [8, 6]]) {
        const top = cx === 0 ? -10 - h : -12 - h;
        rect(g, cx - 1.8, top, 3.6, h, '#f4ecd8', '#b8a888', 0.6);
        ell(g, cx, top + h, 3, 1.2, '#8a7a5a');
        flame(g, cx, top - 1.5, 1, t, seed + cx);
      }
      break;
    }
    case 'icicle': {
      rect(g, -15, -27, 30, 4, '#5a4a6a', INK, 1);
      for (let i = 0; i < 4; i++) {
        const ix = -10 + i * 6.7, l = [9, 13, 11, 8][i];
        let oy = 0, a = 1;
        if (i === 1 && anim > 0) { oy = (1 - anim) * 26; a = Math.min(1, anim * 2); }
        g.globalAlpha = a;
        poly(g, [ix - 2.6, -23 + oy, ix + 2.6, -23 + oy, ix, -23 + l + oy], '#d8f4ff', '#6ab0e0', 0.9);
        line(g, ix - 0.8, -22 + oy, ix - 0.2, -18 + oy, '#ffffff', 0.9);
        g.globalAlpha = 1;
      }
      ell(g, 0, 0, 10, 3, 'rgba(220,240,255,.35)');
      break;
    }
    case 'snowman': {
      ell(g, 0, 0, 9, 3, 'rgba(0,0,0,.25)');
      circ(g, 0, -8, 9, '#f6faff', '#9ab0cc', 1.1);
      const spin = anim > 0 ? Math.sin(anim * 30) * 1.5 : 0;
      circ(g, spin, -21, 7, '#f6faff', '#9ab0cc', 1.1);
      line(g, -8, -12, -15, -18, '#6a4a2a', 1.6); line(g, 8, -12, 15, -17, '#6a4a2a', 1.6);
      rect(g, -5 + spin, -32, 10, 6, '#2a2a3a'); rect(g, -7 + spin, -27, 14, 1.8, '#2a2a3a');
      if (anim > 0) {
        circ(g, -2.5 + spin, -22, 1.6, '#ff3030'); circ(g, 2.5 + spin, -22, 1.6, '#ff3030');
        g.globalAlpha = 0.4; circ(g, -2.5 + spin, -22, 3.2, '#ff5050'); circ(g, 2.5 + spin, -22, 3.2, '#ff5050'); g.globalAlpha = 1;
        poly(g, [-4 + spin, -18, -2 + spin, -16, 0 + spin, -18, 2 + spin, -16, 4 + spin, -18, 0 + spin, -15], '#2a1a2a');
      } else {
        circ(g, 1.5, -22, 1, '#2a2a3a'); circ(g, 5, -22, 1, '#2a2a3a');
        poly(g, [4, -20, 10, -19, 4, -18.5], '#f08a30');
      }
      circ(g, 0, -10, 0.9, '#2a2a3a'); circ(g, 0, -6, 0.9, '#2a2a3a');
      break;
    }
    case 'portrait': {
      rect(g, -11, -32, 22, 26, '#c89a30', '#7a5a10', 1.2);
      rect(g, -8, -29, 16, 20, '#2a2238');
      ell(g, 0, -17, 5, 6.5, '#d8d0c0');
      ell(g, 0, -10, 7, 3, '#4a3050');
      const look = anim > 0 ? 0 : Math.sin(t * 0.9 + seed) * 1.2;
      const ec = anim > 0 ? '#ff3a3a' : '#2a2238';
      circ(g, -2 + look, -18, 1.1, ec); circ(g, 2 + look, -18, 1.1, ec);
      if (anim > 0) { g.globalAlpha = anim * 0.5; circ(g, -2, -18, 3, '#ff4040'); circ(g, 2, -18, 3, '#ff4040'); g.globalAlpha = 1; line(g, -2, -14, 2, -14, '#5a1010', 1); }
      break;
    }
    case 'mirror': {
      ell(g, 0, 0, 8, 2.4, 'rgba(0,0,0,.3)');
      line(g, -5, 0, 0, -6, '#8ab0d0', 1.6); line(g, 5, 0, 0, -6, '#8ab0d0', 1.6);
      ell(g, 0, -18, 9, 12.5, '#a8d8f4', '#5a8ab0', 2);
      const gr = g.createLinearGradient(-8, -30, 8, -6);
      gr.addColorStop(0, '#e8f8ff'); gr.addColorStop(0.5, '#9ab8d8'); gr.addColorStop(1, '#5a6a90');
      ell(g, 0, -18, 7, 10.5, gr);
      line(g, -4, -25, -1, -28, '#ffffff', 1.2);
      if (anim > 0) {
        g.globalAlpha = Math.min(1, anim * 1.6);
        ell(g, 0, -17, 4.6, 6, '#f8fbff');
        ell(g, -1.8, -18.5, 1.2, 1.6, '#1a1a30'); ell(g, 1.8, -18.5, 1.2, 1.6, '#1a1a30'); ell(g, 0, -14.5, 1.5, 1.8, '#1a1a30');
        g.globalAlpha = 1;
      }
      break;
    }
    case 'blizzard': {
      ell(g, 0, 0, 10, 3, 'rgba(0,0,0,.3)');
      rect(g, -9, -14, 18, 14, '#6a7a9a', INK, 1);
      rect(g, -6, -4, 4, 2, '#4ad06a');
      circ(g, 0, -20, 8, '#8a9aba', INK, 1);
      for (let i = 0; i < 4; i++) {
        const a = t * 14 + i * TAU / 4;
        poly(g, [0, -20, Math.cos(a) * 7, -20 + Math.sin(a) * 7, Math.cos(a + 0.6) * 6, -20 + Math.sin(a + 0.6) * 6], '#e8f0ff');
      }
      circ(g, 0, -20, 1.6, INK);
      for (let i = 0; i < 4; i++) {
        const p = (t * 1.6 + i / 4 + seed) % 1;
        circ(g, 9 + p * 18, -22 + Math.sin(p * 8 + i) * 5, 1.2 * (1 - p) + 0.4, 'rgba(255,255,255,.85)');
        circ(g, -9 - p * 18, -18 + Math.cos(p * 8 + i) * 5, 1.2 * (1 - p) + 0.4, 'rgba(255,255,255,.85)');
      }
      break;
    }
    case 'musicbox': {
      ell(g, 0, 0, 10, 3, 'rgba(0,0,0,.3)');
      rect(g, -9, -9, 18, 9, '#8a4a3a', INK, 1);
      poly(g, [-9, -9, 9, -9, 7, -20, -7, -20], '#a85a48', INK, 1);
      rect(g, -7, -8, 14, 2, '#d8b060');
      const sw = Math.sin(t * 3);
      g.save(); g.translate(0, -10); g.scale(sw, 1);
      circ(g, 0, -9, 1.6, '#f8e0d0'); poly(g, [0, -7.5, -3, -2, 3, -2], '#ffb0d0'); line(g, 0, -2, 0, 0, '#f8e0d0', 0.9);
      g.restore();
      g.fillStyle = 'rgba(220,200,255,.9)'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center';
      for (let i = 0; i < 2; i++) { const p = (t * 0.5 + i * 0.5 + seed) % 1; g.globalAlpha = 1 - p; g.fillText('♪', 6 + p * 6 + i * 3, -16 - p * 14); }
      g.globalAlpha = 1;
      break;
    }
    case 'coffin': {
      ell(g, 0, 0, 10, 3, 'rgba(0,0,0,.3)');
      const body = [-6, -32, 6, -32, 9.5, -22, 6, 0, -6, 0, -9.5, -22];
      poly(g, body, '#9ad0ec', '#4a80a8', 1.4);
      poly(g, [-4, -29, 4, -29, 6.5, -22, 4, -3, -4, -3, -6.5, -22], '#c8eaff');
      if (anim > 0) {
        poly(g, [-4, -29, 4, -29, 6.5, -22, 4, -3, -4, -3, -6.5, -22], '#1a1830');
        g.save(); g.translate(10 * Math.min(1, anim * 2), 0); g.rotate(0.25 * anim);
        poly(g, body, 'rgba(160,215,240,.92)', '#4a80a8', 1.4); g.restore();
        for (const hx of [-3, 3]) { ell(g, hx, -17, 2.4, 3.2, '#d8f0e0', INK, 0.8); line(g, hx - 1.4, -20, hx - 1.6, -23, '#d8f0e0', 1.2); line(g, hx + 0.2, -20.5, hx + 0.2, -24, '#d8f0e0', 1.2); line(g, hx + 1.6, -20, hx + 1.9, -23, '#d8f0e0', 1.2); }
        circ(g, -2, -26, 0.9, '#ff3a3a'); circ(g, 2, -26, 0.9, '#ff3a3a');
      } else {
        line(g, 0, -27, 0, -8, '#7ab0d0', 1.2); line(g, -3.5, -21, 3.5, -21, '#7ab0d0', 1.2);
      }
      break;
    }
    case 'chandelier': {
      const sw = Math.sin(t * 1.6 + seed) * 0.08 + (anim > 0 ? Math.sin(anim * 22) * 0.35 * anim : 0);
      g.save(); g.translate(0, -34); g.rotate(sw);
      line(g, 0, 0, 0, 14, '#8a7a5a', 1.2);
      ell(g, 0, 18, 13, 4, null, '#c8a040', 2);
      circ(g, 0, 15, 3, '#d8b050', INK, 0.8);
      for (let i = 0; i < 5; i++) {
        const cx = -12 + i * 6, cy = 18 + (i === 0 || i === 4 ? -1 : i === 2 ? 3 : 2);
        rect(g, cx - 1.2, cy - 5, 2.4, 5, '#f4ecd8');
        flame(g, cx, cy - 6, 0.7, t, seed + i);
        for (let j = 0; j < 2; j++) poly(g, [cx - 1, cy + 1, cx + 1, cy + 1, cx, cy + 4 + j], '#d8f4ff');
      }
      g.restore();
      ell(g, 0, 0, 12, 3, 'rgba(0,0,0,.2)');
      break;
    }
  }
  g.restore();
}

/* ================================ ひろばの かざり ================================
   x, y は マスの まんなか。おおきな のりものは マスより 上へ はみだす */
function drawDeco(g, x, y, ts, type, anim, t, seed = 0) {
  const k = ts / 32;
  g.save();
  g.translate(x, y + 10 * k);
  g.scale(k, k);
  const shadow = (w) => ell(g, 0, 0, w, w * 0.3, 'rgba(40,50,90,.18)');
  const stall = (c1, c2, sign) => {
    shadow(13); rect(g, -12, -12, 24, 12, '#c89060', INK, 1);
    rect(g, -12, -13, 24, 2.5, '#e8c08a');
    line(g, -11, -12, -11, -26, '#7a5a3a', 1.6); line(g, 11, -12, 11, -26, '#7a5a3a', 1.6);
    for (let i = 0; i < 6; i++) poly(g, [-14 + i * 4.7, -26, -14 + (i + 1) * 4.7, -26, -14 + (i + 1) * 4.7 - 2.35, -21], i % 2 ? c1 : c2, INK, 0.6);
    rect(g, -14, -29, 28, 3.5, c1, INK, 0.8);
    sign();
  };
  switch (type) {
    case 'lantern':
      shadow(8); rect(g, -6, -8, 12, 8, '#eef4ff', '#9ab0cc', 1); rect(g, -4.5, -15, 9, 7, '#f6faff', '#9ab0cc', 1);
      ell(g, 0, -11.5, 2.2, 2.6, '#ffc860'); flame(g, 0, -11, 0.7, t, seed);
      poly(g, [-8, -15, 8, -15, 0, -21], '#f6faff', '#9ab0cc', 1);
      break;
    case 'flower':
      ell(g, 0, -2, 12, 4.5, '#f6faff', '#c8d4e8', 1);
      for (let i = 0; i < 5; i++) {
        const fx = -8 + i * 4, fy = -6 - (i % 2) * 3; line(g, fx, -2, fx, fy, '#5a9a6a', 1);
        for (let a = 0; a < 5; a++) circ(g, fx + Math.cos(a * 1.26) * 1.6, fy + Math.sin(a * 1.26) * 1.6, 1.2, i % 2 ? '#ffffff' : '#c8e4ff');
        circ(g, fx, fy, 0.8, '#ffd860');
      }
      break;
    case 'balloon':
      for (let i = 0; i < 3; i++) {
        const bx = -6 + i * 6 + Math.sin(t * 1.5 + i + seed) * 1.5, by = -22 - (i % 2) * 5 + Math.sin(t * 2 + i) * 1;
        g.beginPath(); g.moveTo(0, -1); g.quadraticCurveTo(bx * 0.4, by * 0.5, bx, by + 5); g.strokeStyle = '#8a8aa8'; g.lineWidth = 0.6; g.stroke();
        const col = ['#ffc8dc', '#c8f0ff', '#fff0b0'][i];
        g.beginPath(); g.moveTo(bx - 4, by + 4); g.lineTo(bx - 4, by - 1); g.arc(bx, by - 1, 4, Math.PI, 0); g.lineTo(bx + 4, by + 4);
        g.quadraticCurveTo(bx + 2, by + 2.5, bx, by + 4); g.quadraticCurveTo(bx - 2, by + 2.5, bx - 4, by + 4);
        g.fillStyle = col; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.7; g.stroke();
        circ(g, bx - 1.3, by - 1, 0.7, INK); circ(g, bx + 1.3, by - 1, 0.7, INK);
      }
      circ(g, 0, -1, 1.5, '#7a6a5a');
      break;
    case 'bench':
      shadow(12); rect(g, -11, -7, 22, 3, '#a8703a', INK, 0.8); rect(g, -11, -14, 22, 3, '#a8703a', INK, 0.8);
      line(g, -9, -4, -9, 0, '#4a3a2a', 1.6); line(g, 9, -4, 9, 0, '#4a3a2a', 1.6);
      rect(g, -11, -15.5, 22, 1.8, '#f6faff');
      break;
    case 'cocoa':
      stall('#ff9ab8', '#ffffff', () => { rr(g, -4, -10, 8, 7, 1.5); g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke(); ell(g, 0, -10, 3.5, 1.2, '#7a4a2a');
        for (let i = 0; i < 2; i++) { const p = (t * 0.6 + i * 0.5) % 1; g.globalAlpha = 1 - p; line(g, -1 + i * 2, -12 - p * 6, i * 2, -14 - p * 6, '#ffffff', 1); } g.globalAlpha = 1; });
      break;
    case 'candy':
      stall('#8ad0ff', '#ffffff', () => { line(g, 0, -3, 0, -9, '#c89060', 1); circ(g, 0, -11, 3.5, '#ffd8ec'); circ(g, -2, -12, 2.4, '#ffe8f4'); });
      break;
    case 'pumpkin': {
      shadow(9);
      for (const dx of [-4.5, 0, 4.5]) ell(g, dx, -6, 5, 6.5, '#f08a2a', '#a04a10', 1);
      rect(g, -1, -14, 2, 3, '#4a8a3a');
      const glow = 0.7 + Math.sin(t * 5 + seed) * 0.2;
      g.globalAlpha = glow;
      poly(g, [-5, -8, -2, -8, -3.5, -5.5], '#ffe060'); poly(g, [2, -8, 5, -8, 3.5, -5.5], '#ffe060');
      poly(g, [-4, -3.5, -2, -2, 0, -3.5, 2, -2, 4, -3.5, 2, -1, -2, -1], '#ffe060');
      g.globalAlpha = 1;
      break;
    }
    case 'lights': {
      shadow(10); rect(g, -1.5, -5, 3, 5, '#6a4a32');
      for (let i = 0; i < 3; i++) { const w = 11 - i * 3, yy = -4 - i * 7; poly(g, [-w, yy, w, yy, 0, yy - 11], '#3a7a5a'); }
      const cols = ['#ff6a8a', '#ffe060', '#6ad0ff', '#9aff8a'];
      for (let i = 0; i < 9; i++) { const on = Math.sin(t * 4 + i * 1.7) > 0; circ(g, -8 + (i * 7.3) % 16, -7 - i * 2.4, 1.2, on ? cols[i % 4] : '#2a4a3a'); }
      g.fillStyle = '#ffe060'; g.font = '900 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', 0, -29);
      break;
    }
    case 'photo':
      shadow(12); line(g, -8, 0, -8, -6, '#6a4a2a', 1.6); line(g, 8, 0, 8, -6, '#6a4a2a', 1.6);
      g.beginPath(); g.moveTo(-12, -6); g.lineTo(-12, -20); g.arc(0, -20, 12, Math.PI, 0); g.lineTo(12, -6); g.closePath();
      g.fillStyle = '#f6faff'; g.fill(); g.strokeStyle = '#8aa0c0'; g.lineWidth = 1.4; g.stroke();
      circ(g, 0, -20, 4.5, '#2a2440');
      ell(g, -6, -13, 2, 1.1, 'rgba(255,140,170,.7)'); ell(g, 6, -13, 2, 1.1, 'rgba(255,140,170,.7)');
      break;
    case 'statue':
      shadow(10); rect(g, -8, -6, 16, 6, '#c8d0e0', INK, 0.8);
      g.globalAlpha = 0.85;
      g.beginPath(); g.moveTo(-8, -8); for (let i = 0; i <= 4; i++) g.quadraticCurveTo(-8 + i * 4 - 2, -6 + (i % 2 ? 1.5 : -1.5), -8 + i * 4, -8);
      g.lineTo(8, -20); g.arc(0, -20, 8, 0, Math.PI, true); g.closePath(); g.fillStyle = '#bfeaff'; g.fill(); g.strokeStyle = '#4a9ad0'; g.lineWidth = 1.2; g.stroke();
      g.globalAlpha = 1;
      circ(g, -2.5, -21, 1.4, '#4a7aa8'); circ(g, 3, -21, 1.4, '#4a7aa8'); line(g, -4, -25, -2, -27, '#ffffff', 1.2);
      break;
    case 'carousel': {
      ell(g, 0, -1, 15, 5, '#c8a0e0', INK, 1);
      line(g, 0, -2, 0, -26, '#d8b050', 2);
      for (let i = 0; i < 4; i++) {
        const a = t * 1.4 + i * Math.PI / 2, hx = Math.cos(a) * 11, hy = -6 + Math.sin(a) * 3.5 + Math.sin(t * 4 + i) * 1.5;
        if (Math.sin(a) < 0) { line(g, hx, -24, hx, hy, '#d8b050', 0.8); drawMiniGhost(g, hx, hy, ['#ffd8ec', '#d8f2ff', '#fff4c0', '#e8dcff'][i]); }
      }
      for (let i = 0; i < 4; i++) {
        const a = t * 1.4 + i * Math.PI / 2, hx = Math.cos(a) * 11, hy = -6 + Math.sin(a) * 3.5 + Math.sin(t * 4 + i) * 1.5;
        if (Math.sin(a) >= 0) { line(g, hx, -24, hx, hy, '#d8b050', 0.8); drawMiniGhost(g, hx, hy, ['#ffd8ec', '#d8f2ff', '#fff4c0', '#e8dcff'][i]); }
      }
      for (let i = 0; i < 8; i++) poly(g, [0, -36, -16 + i * 4, -25, -12 + i * 4, -25], i % 2 ? '#ffffff' : '#ff9ab8', INK, 0.6);
      circ(g, 0, -37, 2, '#ffd860', INK, 0.8);
      break;
    }
    case 'wheel': {
      line(g, -10, 0, 0, -30, '#7a6a8a', 2.4); line(g, 10, 0, 0, -30, '#7a6a8a', 2.4);
      circ(g, 0, -30, 22, null, '#c8a0e0', 2);
      const a0 = t * 0.35;
      for (let i = 0; i < 8; i++) { const a = a0 + i * TAU / 8; line(g, 0, -30, Math.cos(a) * 22, -30 + Math.sin(a) * 22, '#d8c8ec', 1); }
      for (let i = 0; i < 8; i++) {
        const a = a0 + i * TAU / 8, cx = Math.cos(a) * 22, cy = -30 + Math.sin(a) * 22;
        rr(g, cx - 3.5, cy, 7, 6, 2); g.fillStyle = ['#ff9ab8', '#8ad0ff', '#ffe060', '#b48aff'][i % 4]; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.7; g.stroke();
      }
      circ(g, 0, -30, 3, '#ffd860', INK, 0.8);
      break;
    }
    case 'station':
      shadow(14); rect(g, -14, -6, 28, 6, '#8a7a9a', INK, 1);
      line(g, -12, -6, -12, -24, '#5a4a6a', 1.8); line(g, 12, -6, 12, -24, '#5a4a6a', 1.8);
      poly(g, [-16, -23, 16, -23, 12, -30, -12, -30], '#b48aff', INK, 1);
      rr(g, -9, -21, 18, 7, 2); g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
      g.fillStyle = '#4e3fb0'; g.font = '900 5.5px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('のりば', 0, -17.5);
      break;
    case 'skelpop': {
      shadow(10); rect(g, -8, -10, 16, 10, '#5a4a3a', INK, 1); line(g, -8, -6, 8, -6, '#3a2a1a', 1);
      const up = anim > 0 ? Math.min(1, anim * 2) * 14 : 0;
      if (up) {
        circ(g, 0, -12 - up, 5.5, '#f4f0e8', INK, 1);
        ell(g, -2, -12.5 - up, 1.5, 1.9, INK); ell(g, 2, -12.5 - up, 1.5, 1.9, INK);
        for (let i = 0; i < 3; i++) line(g, -4, -5 - up + i * 3, 4, -5 - up + i * 3, '#f4f0e8', 1.3);
        line(g, -5, -6 - up, -10, -12 - up, '#f4f0e8', 1.3); line(g, 5, -6 - up, 10, -12 - up, '#f4f0e8', 1.3);
      }
      poly(g, [-9, -10 - (up ? 6 : 0), 9, -10, 9, -12, -9, -12 - (up ? 6 : 0)], '#7a6a5a', INK, 1);
      break;
    }
    case 'spider': {
      line(g, -10, -34, -10, -2, '#5a4a6a', 1.5); line(g, -12, -34, 12, -34, '#5a4a6a', 2);
      const dy = anim > 0 ? Math.min(1, anim * 2) * 16 : Math.sin(t * 1.2 + seed) * 1.5;
      line(g, 4, -34, 4, -26 + dy, '#e8e8f4', 0.6);
      for (let i = 0; i < 4; i++) { line(g, 4, -24 + dy, -3 + i * 0.5, -28 + dy + i * 2.5, INK, 1); line(g, 4, -24 + dy, 11 - i * 0.5, -28 + dy + i * 2.5, INK, 1); }
      ell(g, 4, -24 + dy, 4, 3.5, '#3a2a48', INK, 0.8); circ(g, 2.5, -24 + dy, 0.8, '#ff4a4a'); circ(g, 5.5, -24 + dy, 0.8, '#ff4a4a');
      break;
    }
    case 'ghostgate':
      shadow(14);
      g.beginPath(); g.moveTo(-14, 0); g.lineTo(-14, -16); g.arc(0, -16, 14, Math.PI, 0); g.lineTo(14, 0); g.closePath();
      g.fillStyle = '#5a4a7a'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
      g.beginPath(); g.moveTo(-9, 0); g.lineTo(-9, -15); g.arc(0, -15, 9, Math.PI, 0); g.lineTo(9, 0); g.closePath(); g.fillStyle = '#16122a'; g.fill();
      for (const [ex, ey] of [[-4, -14], [3, -9], [-1, -19]]) { const bl = Math.sin(t * 3 + ex) > -0.8; if (bl || anim > 0) { circ(g, ex - 1.2, ey, 0.9, anim > 0 ? '#ff4a4a' : '#ffe24a'); circ(g, ex + 1.2, ey, 0.9, anim > 0 ? '#ff4a4a' : '#ffe24a'); } }
      if (anim > 0) drawMiniGhost(g, 0, -12 - anim * 10, '#ffffff');
      break;
    case 'school':
      shadow(14); rect(g, -13, -16, 26, 16, '#ffe8c8', INK, 1);
      poly(g, [-15, -16, 15, -16, 0, -28], '#ff9ab8', INK, 1);
      rect(g, -3, -9, 6, 9, '#a8703a');
      rect(g, -10, -13, 5, 4, '#bfeaff', INK, 0.6); rect(g, 5, -13, 5, 4, '#bfeaff', INK, 0.6);
      drawMiniGhost(g, 10 + Math.sin(t * 2 + seed) * 2, -24, '#ffffff');
      rr(g, -9, -35, 18, 6, 2); g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
      g.fillStyle = '#c0306a'; g.font = '900 4.6px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('たいけん', 0, -32);
      break;
    case 'hotel': {
      shadow(14); rect(g, -13, -40, 26, 40, '#6a5a8a', INK, 1.2);
      poly(g, [-15, -40, 15, -40, 10, -48, -10, -48], '#3e3258', INK, 1);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        const on = hash2(r * 3 + c, seed) > 0.35 || Math.sin(t * 0.7 + r + c * 2) > 0.6;
        rect(g, -10 + c * 7.5, -36 + r * 8, 5, 5, on ? '#ffe680' : '#2a2238', INK, 0.5);
      }
      rect(g, -3, -8, 6, 8, '#a8703a');
      rr(g, -9, -55, 18, 6, 2); g.fillStyle = '#ffe680'; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
      g.fillStyle = '#4e3fb0'; g.font = '900 5px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ホテル', 0, -52);
      drawMiniGhost(g, -9 + Math.sin(t * 1.3 + seed) * 2, -28, 'rgba(255,255,255,.85)');
      break;
    }
  }
  g.restore();
}
function drawMiniGhost(g, x, y, col) {
  g.beginPath(); g.moveTo(x - 3.5, y + 3); g.lineTo(x - 3.5, y - 1); g.arc(x, y - 1, 3.5, Math.PI, 0); g.lineTo(x + 3.5, y + 3);
  g.lineTo(x + 1.75, y + 2); g.lineTo(x, y + 3); g.lineTo(x - 1.75, y + 2); g.closePath();
  g.fillStyle = col; g.fill(); g.strokeStyle = '#8aa0c0'; g.lineWidth = 0.6; g.stroke();
  circ(g, x - 1.2, y - 1, 0.6, INK); circ(g, x + 1.2, y - 1, 0.6, INK);
}

/* コースターの くるま。riders は のっている 人数 */
function drawCar(g, x, y, ts, ang, riders, t) {
  const k = ts / 32;
  g.save(); g.translate(x, y); g.scale(k, k);
  g.globalAlpha = 0.25; ell(g, 0, 2, 12, 4, '#000'); g.globalAlpha = 1;
  const flip = Math.cos(ang) < 0 ? -1 : 1;
  g.scale(flip, 1);
  for (let i = 0; i < riders; i++) {
    const rx = -6 + i * 4, ry = -11 + Math.sin(t * 12 + i) * 0.8;
    circ(g, rx, ry, 3, ['#f0b060', '#f6f2ee', '#c0703a', '#a8a8b4'][i % 4], INK, 0.7);
    line(g, rx, ry - 2, rx - 2, ry - 6, INK, 1.2);
  }
  rr(g, -11, -9, 22, 9, 3); g.fillStyle = '#b48aff'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
  circ(g, 8, -5, 3.5, '#f6faff', INK, 0.8); circ(g, 7, -5.5, 0.7, INK); circ(g, 9.2, -5.5, 0.7, INK);
  circ(g, -7, 0, 1.8, '#3a3a4a'); circ(g, 5, 0, 1.8, '#3a3a4a');
  g.restore();
}

/* ================================ マス ================================ */
function drawFloor(g, px, py, ts, x, y) {
  g.fillStyle = (x + y) % 2 ? '#7a6496' : '#755f91';
  g.fillRect(px, py, ts, ts);
  g.strokeStyle = 'rgba(30,20,45,.45)'; g.lineWidth = Math.max(1, ts / 32);
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(px, py + ts * i / 4); g.lineTo(px + ts, py + ts * i / 4); g.stroke(); }
  for (let i = 0; i < 4; i++) {
    const jx = px + ts * ((hash2(x * 7 + i, y * 3) * 0.8 + 0.1));
    g.beginPath(); g.moveTo(jx, py + ts * i / 4); g.lineTo(jx, py + ts * (i + 1) / 4); g.stroke();
  }
  if (hash2(x, y) < 0.18) { g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.ellipse(px + ts * 0.5, py + ts * 0.6, ts * 0.3, ts * 0.15, 0, 0, TAU); g.fill(); }
}
function drawWall(g, px, py, ts, x, y) {
  const lip = ts * 0.24;
  g.fillStyle = '#4c3f72'; g.fillRect(px, py, ts, ts - lip);
  g.fillStyle = '#342a52'; g.fillRect(px, py + ts - lip, ts, lip);
  // かべがみの もよう
  g.fillStyle = 'rgba(160,140,220,.10)';
  const s = ts / 4;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    if ((i + j) % 2) continue;
    const cx = px + s * (i + 0.5), cy = py + s * (j + 0.5);
    g.beginPath(); g.moveTo(cx, cy - s * 0.35); g.lineTo(cx + s * 0.3, cy); g.lineTo(cx, cy + s * 0.35); g.lineTo(cx - s * 0.3, cy); g.fill();
  }
  const h = hash2(x + 11, y + 5);
  if (h < 0.12) { // くもの す
    g.strokeStyle = 'rgba(230,230,255,.25)'; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(i * 0.5) * ts * 0.45, py + Math.sin(i * 0.5) * ts * 0.45); g.stroke(); }
    for (let r = 1; r <= 2; r++) { g.beginPath(); g.arc(px, py, ts * 0.17 * r, 0, Math.PI / 2); g.stroke(); }
  } else if (h > 0.9) { // ひび
    g.strokeStyle = 'rgba(10,6,20,.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(px + ts * 0.6, py + ts * 0.1); g.lineTo(px + ts * 0.5, py + ts * 0.3); g.lineTo(px + ts * 0.62, py + ts * 0.45); g.stroke();
  }
}
function drawSnow(g, px, py, ts, x, y, t) {
  g.fillStyle = (x + y) % 2 ? '#dfe8f5' : '#e3ecf8';
  g.fillRect(px, py, ts, ts);
  const h = hash2(x * 3 + 1, y * 5 + 2);
  if (h < 0.35) { g.fillStyle = '#f6faff'; g.beginPath(); g.ellipse(px + ts * (0.3 + h), py + ts * 0.6, ts * 0.25, ts * 0.1, 0, 0, TAU); g.fill(); }
  if (h > 0.72) drawPine(g, px + ts * 0.5, py + ts * 0.85, ts * (0.8 + (h - 0.72)));
}
function drawPine(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s / 32, s / 32);
  ell(g, 0, 0, 9, 3, 'rgba(60,80,120,.18)');
  rect(g, -2, -6, 4, 6, '#6a4a32');
  for (let i = 0; i < 3; i++) {
    const w = 13 - i * 3.4, yy = -5 - i * 8;
    poly(g, [-w, yy, w, yy, 0, yy - 13], '#3a6a5a');
    poly(g, [-w * 0.6, yy - 4, w * 0.6, yy - 4, 0, yy - 13], '#f4f8ff');
  }
  g.restore();
}

/* ================================ オーナー (あなた) ================================
   ネズミの冒険の 主人公と おなじ ネズミ。かそうを きて おどかす。
   o: { t, face, moving, walk, pose } pose は 1 で ばんざい */
const OWNER_FUR = '#b9ab9d', OWNER_BELLY = '#f2eadf';
function drawOwner(g, x, y, ts, costume, o = {}) {
  const k = ts / 32, t = o.t || 0, pose = o.pose || 0;
  g.save();
  g.translate(x, y);
  g.globalAlpha = 0.22; ell(g, 0, 0, 7.5 * k, 2.6 * k, '#000'); g.globalAlpha = 1;
  const step = o.moving ? Math.sin((o.walk || 0) * 14) : 0;
  g.translate(0, (-Math.abs(step) * 1.4 - pose * 3) * k);
  g.scale(k * (o.face || 1), k);
  const hy = -17;
  let fur = OWNER_FUR, belly = OWNER_BELLY;
  if (costume === 'mummy') { fur = '#ece2c6'; belly = '#ece2c6'; }
  if (costume === 'skeleton') { fur = '#2a2838'; belly = '#2a2838'; }
  if (costume === 'vampire') { fur = '#d8d0dc'; belly = '#ffffff'; }
  const armUp = pose > 0.2;
  const arm = (side, col) => {
    if (armUp) { line(g, side * 5, -11, side * 10, -19, INK, 3.4); line(g, side * 5, -11, side * 10, -19, col, 2.2); }
    else ell(g, side * 7, -8, 2.2, 3.2, col, INK, 0.8);
  };
  // せなかの もの
  if (costume === 'vampire') {
    poly(g, [-4, -14, 4, -14, 11, 0, -11, 0], '#1a1424', INK, 1);
    poly(g, [-3, -13, 3, -13, 8, -1, -8, -1], '#b0203a');
  }
  if (costume === 'queen') poly(g, [-4, -14, 4, -14, 12, 0, -12, 0], 'rgba(170,225,255,.85)', '#6ab0e0', 1);
  if (costume !== 'sheet') { g.beginPath(); g.moveTo(-5, -4); g.bezierCurveTo(-14, -3, -12, 4, -17, 1); g.strokeStyle = '#e8a0a8'; g.lineWidth = 1.4; g.stroke(); }
  // あし
  ell(g, -3 + step * 1.5, -1.5, 2.6, 1.8, '#e8a0a8', INK, 0.8);
  ell(g, 3 - step * 1.5, -1.5, 2.6, 1.8, '#e8a0a8', INK, 0.8);
  if (costume === 'sheet') {
    // シーツを かぶる。耳の でっぱりが ふたつ
    g.beginPath(); g.moveTo(-10, -2);
    for (let i = 0; i <= 4; i++) g.quadraticCurveTo(-10 + i * 5 - 2.5, 0.5 + (i % 2 ? 1.6 : -1.6) + Math.sin(t * 6 + i) * 0.8, -10 + i * 5, -2);
    g.lineTo(9, -16); g.quadraticCurveTo(9, -22, 6, -24); g.arc(5, -26.5, 2.8, 0.6, Math.PI + 0.4, true);
    g.quadraticCurveTo(0, -26, -3, -25.5); g.arc(-5, -26.5, 2.8, -0.4 + Math.PI * 2, Math.PI - 0.6, true);
    g.quadraticCurveTo(-9, -22, -9.5, -16); g.closePath();
    g.fillStyle = '#f8f8ff'; g.fill(); g.strokeStyle = '#9a9ab8'; g.lineWidth = 1.2; g.stroke();
    if (armUp) { ell(g, -10, -17, 2.6, 3.6, '#f8f8ff', '#9a9ab8', 1); ell(g, 10, -17, 2.6, 3.6, '#f8f8ff', '#9a9ab8', 1); }
    ell(g, -1, -17, 1.8, 2.4, INK); ell(g, 4, -17, 1.8, 2.4, INK);
    if (armUp) ell(g, 1.5, -11.5, 2.2, 2.4, INK);
    g.restore();
    return;
  }
  // からだ
  if (costume === 'pumpkin') {
    arm(-1, fur); arm(1, fur);
    for (const dx of [-5, 0, 5]) ell(g, dx, -9, 5.5, 8, '#f08a2a', '#a04a10', 1);
    poly(g, [-5, -12, -2, -12, -3.5, -9], '#3a1a10'); poly(g, [2, -12, 5, -12, 3.5, -9], '#3a1a10');
    poly(g, [-5, -6, -3, -4, -1, -6, 1, -4, 3, -6, 5, -4, 4, -3, -4, -3], '#3a1a10');
  } else if (costume === 'snowman') {
    arm(-1, '#f6faff'); arm(1, '#f6faff');
    circ(g, 0, -8, 8.5, '#f6faff', '#9ab0cc', 1);
    circ(g, 0, -11, 1, INK); circ(g, 0, -7, 1, INK); circ(g, 0, -3, 1, INK);
  } else if (costume === 'queen') {
    arm(-1, fur); arm(1, fur);
    poly(g, [-4, -15, 4, -15, 9, -1, -9, -1], '#bfe8ff', '#4a9ad0', 1);
    for (const [sx, sy] of [[-3, -6], [3, -9], [0, -3]]) poly(g, [sx, sy - 1.6, sx + 1, sy, sx, sy + 1.6, sx - 1, sy], '#ffffff');
  } else {
    arm(-1, costume === 'vampire' ? '#1a1424' : fur); arm(1, costume === 'vampire' ? '#1a1424' : fur);
    ell(g, 0, -8, 7.5, 7, costume === 'vampire' ? '#1a1424' : fur, INK, 1);
    if (costume === 'vampire') poly(g, [-2.5, -14, 2.5, -14, 0, -6], '#ffffff');
    else if (costume === 'skeleton') {
      line(g, 0, -14, 0, -3, '#f4f0e8', 1.6);
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, -11 + i * 3, 4.5 - i * 0.6, Math.PI * 0.15, Math.PI * 0.85); g.strokeStyle = '#f4f0e8'; g.lineWidth = 1.3; g.stroke(); g.beginPath(); g.arc(0, -11 + i * 3, 4.5 - i * 0.6, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    } else ell(g, 0.5, -7, 4.6, 4.8, belly);
    if (costume === 'none') { rect(g, -4.5, -11, 9, 9, '#e0504a', INK, 0.8); line(g, -4, -11, -2.5, -15, '#e0504a', 1.4); line(g, 4, -11, 2.5, -15, '#e0504a', 1.4); }
    if (costume === 'mummy') for (let i = 0; i < 4; i++) line(g, -7, -13 + i * 3.4, 7, -11.5 + i * 3.4, '#c8b896', 1);
  }
  if (costume === 'vampire') { poly(g, [-7, -14, -3, -11, -3, -20], '#1a1424'); poly(g, [7, -14, 3, -11, 3, -20], '#1a1424'); }
  // あたま
  const earIn = costume === 'skeleton' ? '#4a4858' : costume === 'mummy' ? '#d8c8a6' : '#f0a8b4';
  circ(g, -5.5, hy - 6, 4.4, fur, INK, 1); circ(g, -5.5, hy - 6, 2.4, earIn);
  circ(g, 5.5, hy - 6, 4.4, fur, INK, 1); circ(g, 5.5, hy - 6, 2.4, earIn);
  circ(g, 0, hy, 7.5, costume === 'skeleton' ? '#f4f0e8' : fur, INK, 1);
  const ex = 2;
  if (costume === 'skeleton') {
    ell(g, ex - 3, hy - 1, 2.2, 2.6, INK); ell(g, ex + 3, hy - 1, 2.2, 2.6, INK);
    poly(g, [ex - 0.8, hy + 2.5, ex + 0.8, hy + 2.5, ex, hy + 1], INK);
    for (let i = -2; i <= 2; i++) line(g, ex + i * 1.2, hy + 4, ex + i * 1.2, hy + 5.5, INK, 0.7);
  } else {
    if (costume === 'mummy') { for (let i = 0; i < 4; i++) line(g, -7, hy - 5 + i * 3.2, 7, hy - 3.5 + i * 3.2, '#c8b896', 1); circ(g, ex + 3, hy - 0.5, 1.4, '#e04040'); }
    else { circ(g, ex - 3, hy - 0.5, 1.4, INK); circ(g, ex + 3, hy - 0.5, 1.4, INK); circ(g, ex - 2.6, hy - 1, 0.45, '#fff'); circ(g, ex + 3.4, hy - 1, 0.45, '#fff'); }
    if (costume === 'snowman') poly(g, [ex, hy + 1, ex + 6, hy + 2, ex, hy + 3], '#f08a30');
    else circ(g, ex + 0.5, hy + 2, 1, '#e88a98');
    if (armUp) ell(g, ex, hy + 4.4, 2, 2, '#5a2030');
    else { g.beginPath(); g.arc(ex, hy + 3, 1.6, 0.2, Math.PI - 0.2); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke(); }
    if (costume === 'vampire') { poly(g, [ex - 1.5, hy + 4, ex - 0.7, hy + 4, ex - 1.1, hy + 6], '#fff'); poly(g, [ex + 0.7, hy + 4, ex + 1.5, hy + 4, ex + 1.1, hy + 6], '#fff'); }
    if (costume !== 'mummy') { ell(g, ex - 5, hy + 2.2, 1.6, 1, 'rgba(255,130,150,.5)'); ell(g, ex + 5.5, hy + 2.2, 1.6, 1, 'rgba(255,130,150,.5)'); }
  }
  // ぼうし
  if (costume === 'pumpkin') { rect(g, -1, hy - 10, 2, 3.5, '#4a8a3a'); ell(g, 2.5, hy - 9, 2.6, 1.3, '#5aa04a'); }
  if (costume === 'snowman') { rect(g, -4.5, hy - 13, 9, 6, '#2a2a3a'); rect(g, -6.5, hy - 7.5, 13, 1.8, '#2a2a3a'); g.beginPath(); g.ellipse(0, -11.5, 6.8, 2.2, 0, 0, TAU); g.fillStyle = '#e0504a'; g.fill(); }
  if (costume === 'queen') poly(g, [-6, hy - 6, -6, hy - 11, -3, hy - 8, 0, hy - 13, 3, hy - 8, 6, hy - 11, 6, hy - 6], '#d8f4ff', '#4a9ad0', 0.9);
  if (costume === 'vampire') { g.beginPath(); g.arc(0, hy - 2, 7.6, Math.PI * 1.05, Math.PI * 1.95); g.lineWidth = 3; g.strokeStyle = '#1a1424'; g.stroke(); }
  g.restore();
}

/* したの ボタンの 絵 */
function drawTool(g, type) {
  switch (type) {
    case 'floor':
      rect(g, 8, 16, 40, 26, '#5e4b74', INK, 1.5);
      for (let i = 1; i < 3; i++) line(g, 8, 16 + i * 8.7, 48, 16 + i * 8.7, '#3a2c4c', 1.4);
      line(g, 22, 16, 22, 24.7, '#3a2c4c', 1.4); line(g, 34, 24.7, 34, 33.4, '#3a2c4c', 1.4); line(g, 18, 33.4, 18, 42, '#3a2c4c', 1.4);
      break;
    case 'prop': drawProp(g, 28, 34, 38, 'candle', 0, 0.3); break;
    case 'ghost': drawGhost(g, 28, 48, 36, 'yuki', { t: 0.6 }); break;
    case 'erase':
      line(g, 38, 8, 24, 34, '#9a6a3a', 3.5);
      poly(g, [17, 31, 30, 38, 24, 50, 8, 44], '#e8c060', INK, 1.2);
      for (let i = 0; i < 4; i++) line(g, 12 + i * 4, 43 + i * 1.5, 18 + i * 3.5, 33 + i * 1.8, '#b08a30', 1);
      break;
    case 'price':
      g.save(); g.translate(28, 28); g.rotate(-0.25);
      rr(g, -18, -11, 36, 22, 4); g.fillStyle = '#ffd860'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke();
      circ(g, -18, 0, 4, '#f8f8ff'); circ(g, 18, 0, 4, '#f8f8ff');
      g.setLineDash([2, 2]); line(g, -8, -9, -8, 9, '#b08a20', 1); g.setLineDash([]);
      g.fillStyle = '#c05a10'; g.font = '900 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', 5, 1);
      g.restore();
      break;
    case 'expand':
      poly(g, [8, 26, 28, 10, 48, 26], '#5a4a7a', INK, 1.3);
      rect(g, 13, 26, 30, 20, '#3a2f55', INK, 1.3);
      rect(g, 24, 34, 8, 12, '#7a4a2a');
      poly(g, [6, 16, 6, 8, 14, 12], '#4fb071'); poly(g, [50, 16, 50, 8, 42, 12], '#4fb071');
      break;
    case 'costume': drawOwner(g, 28, 50, 36, 'pumpkin', { t: 0.4 }); break;
    case 'deco': drawDeco(g, 28, 40, 40, 'balloon', 0, 0.4); break;
    case 'rail':
      for (let i = 0; i < 5; i++) line(g, 10 + i * 9, 18, 6 + i * 9, 40, '#8a6a4a', 3);
      line(g, 6, 22, 50, 22, '#a8a0c0', 2.5); line(g, 4, 36, 48, 36, '#a8a0c0', 2.5);
      drawCar(g, 30, 30, 34, 0, 1, 0.3);
      break;
    case 'night':
      circ(g, 28, 28, 16, '#ffe680');
      circ(g, 36, 22, 14, '#3a2a90');
      circ(g, 14, 12, 1.5, '#fff'); circ(g, 44, 42, 1.2, '#fff');
      break;
  }
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/* まんぞくの かお。r は 1〜5、2 は にげだした かお */
function drawFace(g, r) {
  const col = ['', '#c8c8d4', '#8ac8ff', '#fff0b0', '#ffd860', '#ffb830'][r];
  circ(g, 28, 28, 22, col, INK, 2);
  if (r === 5) {
    for (const ex of [19, 37]) { g.beginPath(); g.arc(ex, 26, 4, Math.PI * 1.1, Math.PI * 1.9); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke(); }
    g.beginPath(); g.arc(28, 32, 10, 0.1, Math.PI - 0.1); g.closePath(); g.fillStyle = '#7a2a30'; g.fill();
  } else if (r === 4) {
    circ(g, 20, 24, 2.6, INK); circ(g, 36, 24, 2.6, INK);
    g.beginPath(); g.arc(28, 30, 8, 0.25, Math.PI - 0.25); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke();
  } else if (r === 3) {
    circ(g, 20, 25, 2.4, INK); circ(g, 36, 25, 2.4, INK);
    g.beginPath(); g.arc(28, 28, 8, 0.6, Math.PI - 0.6); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke();
  } else if (r === 2) {
    circ(g, 20, 23, 5, '#fff', INK, 1.6); circ(g, 36, 23, 5, '#fff', INK, 1.6); circ(g, 20, 23, 2, INK); circ(g, 36, 23, 2, INK);
    ell(g, 28, 38, 5, 6, '#3a1a30');
    ell(g, 46, 18, 2.4, 4, '#4aa0e0');
  } else {
    line(g, 16, 25, 24, 25, INK, 2.4); line(g, 32, 25, 40, 25, INK, 2.4);
    line(g, 21, 37, 35, 37, INK, 2.4);
  }
}

/* ------------------------------ 画面の ボタンに つかう 小さな絵 ------------------------------ */
const Icons = {
  cache: new Map(),
  get(kind, type) {
    const key = kind + type;
    if (this.cache.has(key)) return this.cache.get(key);
    const c = document.createElement('canvas'); c.width = c.height = 112;
    const g = c.getContext('2d'); g.scale(2, 2);
    if (kind === 'ghost') {
      const sc = GHOSTS[type].scale || 1;
      drawGhost(g, 28, 46 + (sc > 1 ? 4 : 0), 32 * 1.25 / Math.max(1, sc * 0.9), type, { t: 0.6 });
    } else if (kind === 'owner') drawOwner(g, 28, 50, 44, type, { t: 0.4 });
    else if (kind === 'tool') drawTool(g, type);
    else if (kind === 'face') drawFace(g, type);
    else if (kind === 'deco') drawDeco(g, 28, ['wheel', 'hotel'].includes(type) ? 44 : 34, ['wheel', 'hotel'].includes(type) ? 26 : 38, type, 0.6, 0.4);
    else drawProp(g, 28, 30, 40, type, 0, 0.3);
    const url = c.toDataURL();
    this.cache.set(key, url);
    return url;
  },
};
