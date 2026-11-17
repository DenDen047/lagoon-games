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

/* ================================ おきゃくさん ================================ */
function drawGuest(g, x, y, ts, gu, t) {
  const sp = GUESTS[gu.sp], k = ts / 32 * (gu.kid ? 0.8 : 1);
  const fled = gu.st === 'flee', fear = gu.fear;
  g.save();
  g.translate(x, y);
  g.globalAlpha = 0.22; ell(g, 0, 0, 7 * k, 2.6 * k, '#000'); g.globalAlpha = 1;
  const moving = gu.stun <= 0;
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

/* ================================ マス ================================ */
function drawFloor(g, px, py, ts, x, y) {
  g.fillStyle = (x + y) % 2 ? '#5e4b74' : '#594770';
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
  g.fillStyle = '#3a2f55'; g.fillRect(px, py, ts, ts - lip);
  g.fillStyle = '#251d3b'; g.fillRect(px, py + ts - lip, ts, lip);
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
    } else drawProp(g, 28, 30, 40, type, 0, 0.3);
    const url = c.toDataURL();
    this.cache.set(key, url);
    return url;
  },
};
