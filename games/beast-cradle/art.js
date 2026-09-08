/* =========================================================================
   BEAST CRADLE ― けものの絵
   種族ごとに手で描き分ける。座標は「足もとが原点、背丈100」の箱のなかで、
   上が負の y。呼ぶ側は drawBeast() に高さと向きを渡すだけでよい。
   ========================================================================= */
'use strict';

/* --------------------------------------------------------------
   色の小道具
   -------------------------------------------------------------- */
function hexRgb(h) {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function rgbHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
function mixHex(a, b, t) {
  const x = hexRgb(a), y = hexRgb(b);
  return rgbHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
/* 個体ごとの毛色のちがいは色相をずらして出す。 */
function shiftHue(hex, deg) {
  if (!deg) return hex;
  let [r, g, b] = hexRgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + deg + 360) % 360;
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let p = [0, 0, 0];
  if (h < 60) p = [c, x, 0]; else if (h < 120) p = [x, c, 0]; else if (h < 180) p = [0, c, x];
  else if (h < 240) p = [0, x, c]; else if (h < 300) p = [x, 0, c]; else p = [c, 0, x];
  return rgbHex((p[0] + m) * 255, (p[1] + m) * 255, (p[2] + m) * 255);
}

/* その一匹ぶんの色をまとめて作る。flash は白に寄せる量（被弾の光り）。 */
function beastPalette(sp, tint, flash) {
  const a = sp.art;
  const f = flash || 0;
  const c = (k) => mixHex(shiftHue(a[k], tint || 0), '#ffffff', f);
  return {
    main: c('main'), dark: c('dark'), light: c('light'), belly: c('belly'),
    eye: a.eye, line: mixHex(shiftHue(a.dark, tint || 0), '#000000', 0.42),
  };
}

/* --------------------------------------------------------------
   形の小道具
   -------------------------------------------------------------- */
function ell(ctx, x, y, rx, ry, fill, line, lw) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw || 2.4; ctx.stroke(); }
}

/* もこもこした輪郭。fur が大きいほど毛が長く見える。 */
function furBlob(ctx, x, y, rx, ry, bumps, fur, phase, fill, line) {
  ctx.beginPath();
  const steps = bumps * 12;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const w = 1 + Math.sin(a * bumps + phase) * fur;
    const px = x + Math.cos(a) * rx * w;
    const py = y + Math.sin(a) * ry * w;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = line; ctx.lineWidth = 2.4; ctx.stroke();
}

function limb(ctx, x, y, len, w, color, line, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean || 0);
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w / 2, len - w / 2);
  ctx.arc(0, len - w / 2, w / 2, Math.PI, 0, true);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = line; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.restore();
}

/* 目。style: round / sharp / glow / closed */
function eyes(ctx, x, y, r, pal, style, blink) {
  const draw = (ex) => {
    if (blink || style === 'closed') {
      ctx.beginPath();
      ctx.moveTo(ex - r, y); ctx.quadraticCurveTo(ex, y + r * 0.8, ex + r, y);
      ctx.strokeStyle = pal.line; ctx.lineWidth = 2.2; ctx.stroke();
      return;
    }
    if (style === 'sharp') {
      ctx.beginPath();
      ctx.moveTo(ex - r * 1.2, y - r * 0.5);
      ctx.quadraticCurveTo(ex, y + r * 1.1, ex + r * 1.2, y - r * 0.3);
      ctx.quadraticCurveTo(ex, y - r * 0.9, ex - r * 1.2, y - r * 0.5);
      ctx.fillStyle = '#fdfbf5'; ctx.fill();
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1.6; ctx.stroke();
      ell(ctx, ex + r * 0.15, y, r * 0.45, r * 0.55, pal.eye, null);
      return;
    }
    if (style === 'glow') {
      ctx.save();
      ctx.shadowColor = pal.eye; ctx.shadowBlur = 8;
      ell(ctx, ex, y, r * 0.75, r * 0.75, pal.eye, null);
      ctx.restore();
      return;
    }
    ell(ctx, ex, y, r, r * 1.08, '#fdfbf5', pal.line, 1.6);
    ell(ctx, ex + r * 0.12, y + r * 0.08, r * 0.5, r * 0.58, pal.eye, null);
    ell(ctx, ex + r * 0.34, y - r * 0.34, r * 0.2, r * 0.2, '#ffffff', null);
  };
  draw(x); draw(x + r * 3.1);
}

/* --------------------------------------------------------------
   種族ごとの絵
   どれも「足もとが 0、頭のてっぺんが -100 前後」に収まるように描く。
   -------------------------------------------------------------- */
const BEAST_ART = {
  /* まるい毛玉 */
  blob(ctx, p, s) {
    const bob = s.bob;
    limb(ctx, -14, -12 + bob, 12, 13, p.dark, p.line, 0);
    limb(ctx, 16, -12 + bob, 12, 13, p.dark, p.line, 0);
    ctx.save(); ctx.translate(-26, -62 + bob); ctx.rotate(-0.5);
    ell(ctx, 0, 0, 9, 20, p.dark, p.line); ctx.restore();
    ctx.save(); ctx.translate(28, -60 + bob); ctx.rotate(0.55);
    ell(ctx, 0, 0, 9, 20, p.dark, p.line); ctx.restore();
    furBlob(ctx, 0, -46 + bob, 36, 34, 11, 0.045, s.t * 1.2, p.main, p.line);
    ell(ctx, 0, -34 + bob, 20, 15, p.belly, null);
    eyes(ctx, -12, -50 + bob, 5.6, p, 'round', s.blink);
    ctx.beginPath();
    ctx.moveTo(-5, -37 + bob); ctx.quadraticCurveTo(0, -32 + bob, 5, -37 + bob);
    ctx.strokeStyle = p.line; ctx.lineWidth = 2.2; ctx.stroke();
  },

  /* 鉤づめの四足 */
  cat(ctx, p, s) {
    const bob = s.bob;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-26, -40 + bob);
    ctx.quadraticCurveTo(-52, -52 + bob + Math.sin(s.t * 2.4) * 5, -46, -76 + bob);
    ctx.strokeStyle = p.line; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();
    ctx.strokeStyle = p.dark; ctx.lineWidth = 6.4; ctx.stroke();
    ctx.restore();
    limb(ctx, -18, -30 + bob, 30, 10, p.dark, p.line, 0.06);
    limb(ctx, 20, -30 + bob, 30, 10, p.dark, p.line, -0.06);
    ell(ctx, 0, -44 + bob, 30, 19, p.main, p.line);
    ell(ctx, 2, -36 + bob, 20, 10, p.belly, null);
    limb(ctx, -10, -30 + bob, 30, 10, p.main, p.line, 0.1);
    limb(ctx, 26, -30 + bob, 30, 10, p.main, p.line, -0.1);
    ctx.save(); ctx.translate(30, -62 + bob);
    ctx.beginPath(); ctx.moveTo(-13, -4); ctx.lineTo(-18, -22); ctx.lineTo(-2, -12); ctx.closePath();
    ctx.fillStyle = p.main; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(11, -6); ctx.lineTo(17, -23); ctx.lineTo(1, -13); ctx.closePath();
    ctx.fillStyle = p.main; ctx.fill(); ctx.stroke();
    ell(ctx, 0, 0, 16, 14, p.main, p.line);
    ell(ctx, 4, 5, 8, 6, p.light, null);
    eyes(ctx, -8, -2, 4.6, p, 'sharp', s.blink);
    ell(ctx, 5, 5, 2.4, 2, p.line, null);
    ctx.restore();
  },

  /* 一本角の山羊 */
  goat(ctx, p, s) {
    const bob = s.bob;
    limb(ctx, -20, -28 + bob, 28, 11, p.dark, p.line, 0.05);
    limb(ctx, 16, -28 + bob, 28, 11, p.dark, p.line, -0.05);
    ell(ctx, 0, -46 + bob, 31, 22, p.main, p.line);
    ell(ctx, 0, -37 + bob, 20, 11, p.belly, null);
    limb(ctx, -12, -28 + bob, 28, 11, p.main, p.line, 0.08);
    limb(ctx, 24, -28 + bob, 28, 11, p.main, p.line, -0.08);
    ctx.save(); ctx.translate(28, -66 + bob);
    /* 後ろに反った一本角 */
    ctx.beginPath();
    ctx.moveTo(-1, -9);
    ctx.quadraticCurveTo(-20, -28, -6, -40);
    ctx.quadraticCurveTo(-6, -24, 8, -9);
    ctx.closePath();
    ctx.fillStyle = mixHex(p.dark, '#3a2a18', 0.45); ctx.fill();
    ctx.strokeStyle = p.line; ctx.lineWidth = 2.4; ctx.stroke();
    /* たれ耳 */
    ctx.save(); ctx.translate(-13, -6); ctx.rotate(0.55);
    ell(ctx, -8, 4, 10, 5, p.dark, p.line, 2);
    ctx.restore();
    ell(ctx, 0, 0, 15, 13, p.main, p.line);
    /* 鼻づら */
    ctx.beginPath();
    ctx.moveTo(6, -6); ctx.quadraticCurveTo(21, -4, 20, 4);
    ctx.quadraticCurveTo(18, 11, 4, 10); ctx.closePath();
    ctx.fillStyle = p.light; ctx.fill(); ctx.stroke();
    ell(ctx, 18, 2, 2.2, 1.8, p.line, null);
    /* あごひげ */
    ctx.beginPath(); ctx.moveTo(-1, 11); ctx.quadraticCurveTo(-7, 24, 3, 25);
    ctx.quadraticCurveTo(6, 16, 7, 11); ctx.closePath();
    ctx.fillStyle = p.light; ctx.fill(); ctx.stroke();
    eyes(ctx, -8, -3, 4.2, p, 'round', s.blink);
    ctx.restore();
  },

  /* 燃える羽の小鳥 */
  bird(ctx, p, s) {
    const bob = s.bob;
    const flap = Math.sin(s.t * 3.4) * 0.3;
    limb(ctx, -8, -26 + bob, 26, 6, p.dark, p.line, 0.04);
    limb(ctx, 8, -26 + bob, 26, 6, p.dark, p.line, -0.04);
    ctx.save(); ctx.translate(-18, -48 + bob);
    for (let i = -1; i <= 1; i++) {
      ctx.save(); ctx.rotate(i * 0.34 + 0.2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-22, -6, -34, 4);
      ctx.quadraticCurveTo(-20, 6, 0, 8); ctx.closePath();
      ctx.fillStyle = i === 0 ? p.light : p.dark; ctx.fill();
      ctx.strokeStyle = p.line; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ell(ctx, 0, -52 + bob, 21, 25, p.main, p.line);
    ell(ctx, 2, -46 + bob, 12, 15, p.belly, null);
    ctx.save(); ctx.translate(-2, -56 + bob); ctx.rotate(-0.35 + flap);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-16, -22, -2, -30);
    ctx.quadraticCurveTo(10, -18, 9, 2); ctx.closePath();
    ctx.fillStyle = p.light; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(6, -82 + bob);
    ctx.beginPath(); ctx.moveTo(-6, -8);
    ctx.quadraticCurveTo(-2, -26 - Math.sin(s.t * 5) * 3, 6, -14);
    ctx.quadraticCurveTo(10, -26, 14, -8); ctx.closePath();
    ctx.fillStyle = p.light; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 2; ctx.stroke();
    ell(ctx, 0, 0, 14, 13, p.main, p.line);
    ctx.beginPath(); ctx.moveTo(11, -2); ctx.lineTo(25, 3); ctx.lineTo(11, 7); ctx.closePath();
    ctx.fillStyle = '#f7c94a'; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 2; ctx.stroke();
    eyes(ctx, -4, -2, 4.4, p, 'round', s.blink);
    ctx.restore();
  },

  /* 宙を泳ぐ長ひれ */
  fish(ctx, p, s) {
    const sw = Math.sin(s.t * 2.2) * 4;
    const bob = s.bob - 8;
    ctx.save(); ctx.translate(-30, -50 + bob); ctx.rotate(sw * 0.03);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-26, -22, -34, -4);
    ctx.quadraticCurveTo(-24, 2, -30, 20);
    ctx.quadraticCurveTo(-14, 10, 0, 8); ctx.closePath();
    ctx.fillStyle = p.light; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = p.line; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(-14, -62 + bob);
    ctx.quadraticCurveTo(0, -84 + bob + sw, 16, -60 + bob); ctx.closePath();
    ctx.fillStyle = p.light; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 2.2; ctx.stroke();
    ell(ctx, 0, -50 + bob, 32, 21, p.main, p.line);
    ell(ctx, -2, -44 + bob, 22, 11, p.belly, null);
    ctx.save(); ctx.translate(6, -44 + bob); ctx.rotate(0.5 + sw * 0.02);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6, 22, 10, 26);
    ctx.quadraticCurveTo(12, 10, 8, 0); ctx.closePath();
    ctx.fillStyle = p.light; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    eyes(ctx, 14, -54 + bob, 5.4, p, 'round', s.blink);
    ctx.beginPath(); ctx.arc(30, -46 + bob, 4, -0.9, 0.9);
    ctx.strokeStyle = p.line; ctx.lineWidth = 2.2; ctx.stroke();
  },

  /* 岩の甲羅 */
  shell(ctx, p, s) {
    const bob = s.bob * 0.5;
    limb(ctx, -22, -20 + bob, 20, 14, p.dark, p.line, 0);
    limb(ctx, 14, -20 + bob, 20, 14, p.dark, p.line, 0);
    ell(ctx, 0, -34 + bob, 34, 18, p.belly, p.line);
    limb(ctx, -14, -20 + bob, 20, 14, mixHex(p.main, '#ffffff', 0.1), p.line, 0);
    limb(ctx, 22, -20 + bob, 20, 14, mixHex(p.main, '#ffffff', 0.1), p.line, 0);
    ctx.beginPath();
    const pts = [[-36, -38], [-30, -58], [-12, -70], [10, -72], [30, -62], [38, -42], [34, -34], [-34, -34]];
    pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1] + bob) : ctx.moveTo(q[0], q[1] + bob)));
    ctx.closePath();
    ctx.fillStyle = p.main; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-18, -40 + bob); ctx.lineTo(-8, -62 + bob); ctx.lineTo(8, -58 + bob);
    ctx.lineTo(16, -40 + bob);
    ctx.strokeStyle = p.dark; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.save(); ctx.translate(34, -44 + bob);
    ell(ctx, 0, 0, 15, 12, mixHex(p.main, '#ffffff', 0.14), p.line);
    ell(ctx, 8, 3, 8, 6, p.belly, null);
    eyes(ctx, -6, -3, 4.2, p, 'round', s.blink);
    ctx.restore();
  },

  /* 影のような細身 */
  wisp(ctx, p, s) {
    const bob = s.bob;
    ctx.save();
    ctx.globalAlpha = 0.92;
    /* 下半身は霧になって消える */
    ctx.beginPath();
    ctx.moveTo(-16, -44 + bob);
    ctx.quadraticCurveTo(-22, -14 + bob, -7 + Math.sin(s.t * 2) * 4, -2);
    ctx.quadraticCurveTo(3, -12 + bob, 12 + Math.sin(s.t * 2 + 1) * 4, -2);
    ctx.quadraticCurveTo(20, -18 + bob, 16, -44 + bob);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -44, 0, 0);
    g.addColorStop(0, p.main); g.addColorStop(1, mixHex(p.dark, '#000000', 0.25));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = p.line; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.restore();
    /* 短い腕 */
    limb(ctx, -18, -62 + bob, 20, 6.5, p.dark, p.line, 0.85);
    limb(ctx, 18, -62 + bob, 20, 6.5, p.dark, p.line, -0.85);
    ell(ctx, 0, -58 + bob, 18, 21, p.main, p.line);
    /* 頭巾 */
    ctx.beginPath();
    ctx.moveTo(-16, -74 + bob);
    ctx.quadraticCurveTo(-15, -100 + bob, 1, -102 + bob);
    ctx.quadraticCurveTo(17, -99 + bob, 16, -74 + bob);
    ctx.quadraticCurveTo(0, -67 + bob, -16, -74 + bob);
    ctx.closePath();
    ctx.fillStyle = p.dark; ctx.fill();
    ctx.strokeStyle = p.line; ctx.lineWidth = 2.4; ctx.stroke();
    /* 頭巾の奥の闇 */
    ell(ctx, 0, -80 + bob, 11, 10, mixHex(p.dark, '#000000', 0.55), null);
    eyes(ctx, -6, -81 + bob, 4.6, p, 'glow', false);
  },

  /* きのこ坊 */
  cap(ctx, p, s) {
    const bob = s.bob;
    limb(ctx, -10, -12 + bob, 12, 9, p.belly, p.line, 0);
    limb(ctx, 4, -12 + bob, 12, 9, p.belly, p.line, 0);
    ell(ctx, 0, -34 + bob, 17, 20, p.belly, p.line);
    ctx.beginPath();
    ctx.moveTo(-34, -50 + bob);
    ctx.quadraticCurveTo(-30, -84 + bob, 0, -86 + bob);
    ctx.quadraticCurveTo(30, -84 + bob, 34, -50 + bob);
    ctx.quadraticCurveTo(20, -44 + bob, 0, -45 + bob);
    ctx.quadraticCurveTo(-20, -44 + bob, -34, -50 + bob);
    ctx.closePath();
    ctx.fillStyle = p.main; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 2.6; ctx.stroke();
    [[-18, -62, 5], [4, -70, 6], [20, -58, 4.5], [-6, -56, 3.6]].forEach((d) =>
      ell(ctx, d[0], d[1] + bob, d[2], d[2] * 0.8, p.light, null));
    eyes(ctx, -8, -36 + bob, 4, p, 'round', s.blink);
    ctx.beginPath(); ctx.arc(0, -28 + bob, 3.4, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = p.line; ctx.lineWidth = 2; ctx.stroke();
  },

  /* 大狼 */
  wolf(ctx, p, s) {
    const bob = s.bob;
    ctx.beginPath();
    ctx.moveTo(-30, -48 + bob);
    ctx.quadraticCurveTo(-52, -54 + bob + Math.sin(s.t * 2) * 5, -50, -76 + bob);
    ctx.quadraticCurveTo(-40, -68 + bob, -30, -58 + bob);
    ctx.closePath();
    ctx.fillStyle = p.dark; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 2.4; ctx.stroke();
    limb(ctx, -20, -34 + bob, 34, 12, p.dark, p.line, 0.08);
    limb(ctx, 20, -34 + bob, 34, 12, p.dark, p.line, -0.08);
    ell(ctx, 0, -52 + bob, 34, 21, p.main, p.line);
    ell(ctx, 2, -43 + bob, 22, 11, p.belly, null);
    limb(ctx, -12, -34 + bob, 34, 12, p.main, p.line, 0.12);
    limb(ctx, 27, -34 + bob, 34, 12, p.main, p.line, -0.12);
    furBlob(ctx, 12, -56 + bob, 16, 15, 9, 0.09, s.t, p.light, p.line);
    ctx.save(); ctx.translate(34, -70 + bob);
    ctx.beginPath(); ctx.moveTo(-13, -6); ctx.lineTo(-19, -28); ctx.lineTo(-1, -15); ctx.closePath();
    ctx.fillStyle = p.dark; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, -8); ctx.lineTo(17, -29); ctx.lineTo(0, -16); ctx.closePath();
    ctx.fillStyle = p.dark; ctx.fill(); ctx.stroke();
    ell(ctx, 0, 0, 17, 14, p.main, p.line);
    ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(23, 2); ctx.lineTo(21, 9); ctx.lineTo(5, 10);
    ctx.closePath(); ctx.fillStyle = p.light; ctx.fill(); ctx.stroke();
    ell(ctx, 22, 3, 3.2, 2.6, p.line, null);
    eyes(ctx, -8, -3, 4.6, p, 'sharp', s.blink);
    ctx.restore();
  },

  /* 沼の主 */
  dragon(ctx, p, s) {
    const bob = s.bob;
    /* 翼は体の後ろ。背中の上に大きく出す */
    ctx.save(); ctx.translate(-8, -62 + bob); ctx.rotate(-0.2 + Math.sin(s.t * 2) * 0.07);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-14, -22, -22, -34);
    ctx.quadraticCurveTo(-8, -30, -4, -26);
    ctx.quadraticCurveTo(-6, -20, 2, -18);
    ctx.quadraticCurveTo(4, -10, 6, 0);
    ctx.closePath();
    ctx.fillStyle = mixHex(p.light, '#ffffff', 0.18); ctx.fill();
    ctx.strokeStyle = p.line; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.restore();
    /* しっぽ */
    ctx.beginPath();
    ctx.moveTo(-24, -42 + bob);
    ctx.quadraticCurveTo(-44, -34 + bob + Math.sin(s.t * 1.6) * 5, -46, -58 + bob);
    ctx.quadraticCurveTo(-36, -50 + bob, -24, -54 + bob);
    ctx.closePath();
    ctx.fillStyle = p.dark; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 2.4; ctx.stroke();
    /* 後ろ足 */
    limb(ctx, -18, -32 + bob, 32, 13, p.dark, p.line, 0.06);
    limb(ctx, 14, -32 + bob, 32, 13, p.dark, p.line, -0.06);
    /* 胴 */
    ell(ctx, 0, -50 + bob, 30, 22, p.main, p.line);
    ell(ctx, 1, -42 + bob, 20, 12, p.belly, null);
    /* 背びれ */
    ctx.beginPath();
    ctx.moveTo(-18, -64 + bob); ctx.lineTo(-12, -78 + bob); ctx.lineTo(-5, -68 + bob);
    ctx.lineTo(1, -80 + bob); ctx.lineTo(8, -66 + bob);
    ctx.closePath();
    ctx.fillStyle = p.light; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 2.2; ctx.stroke();
    /* 首 */
    ctx.beginPath();
    ctx.moveTo(11, -60 + bob);
    ctx.quadraticCurveTo(26, -70 + bob, 26, -84 + bob);
    ctx.lineTo(39, -84 + bob);
    ctx.quadraticCurveTo(38, -66 + bob, 23, -52 + bob);
    ctx.closePath();
    ctx.fillStyle = p.main; ctx.fill(); ctx.strokeStyle = p.line; ctx.lineWidth = 2.4; ctx.stroke();
    /* 前足 */
    limb(ctx, -10, -32 + bob, 32, 13, mixHex(p.main, '#ffffff', 0.06), p.line, 0.1);
    limb(ctx, 21, -32 + bob, 32, 13, mixHex(p.main, '#ffffff', 0.06), p.line, -0.1);
    /* 頭 */
    ctx.save(); ctx.translate(33, -90 + bob);
    ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(-21, -22); ctx.lineTo(-3, -13); ctx.closePath();
    ctx.fillStyle = mixHex(p.dark, '#2a1c10', 0.4); ctx.fill();
    ctx.strokeStyle = p.line; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, -10); ctx.lineTo(-4, -27); ctx.lineTo(11, -15); ctx.closePath();
    ctx.fillStyle = mixHex(p.dark, '#2a1c10', 0.4); ctx.fill(); ctx.stroke();
    ell(ctx, 0, 0, 15, 12, p.main, p.line);
    ctx.beginPath();
    ctx.moveTo(7, -5); ctx.quadraticCurveTo(20, -3, 19, 3);
    ctx.quadraticCurveTo(17, 9, 5, 9); ctx.closePath();
    ctx.fillStyle = p.light; ctx.fill(); ctx.stroke();
    ell(ctx, 16, 1, 2.2, 1.8, p.line, null);
    eyes(ctx, -8, -3, 4.4, p, 'sharp', s.blink);
    ctx.restore();
  },
};

/* --------------------------------------------------------------
   drawBeast(ctx, species, {x, y, h, face, t, pose, tint, flash})
   y は足もとの線。h は背丈（px）。
   -------------------------------------------------------------- */
function drawBeast(ctx, sp, o) {
  const h = o.h || 100;
  const t = o.t || 0;
  const pose = o.pose || 'idle';
  const pal = beastPalette(sp, o.tint, o.flash);
  const k = h / 100;

  ctx.save();
  ctx.translate(o.x, o.y);
  if (pose !== 'down') {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ell(ctx, 0, 0, 34 * k, 8 * k, '#1a1420', null);
    ctx.restore();
  }
  ctx.scale(k * (o.face || 1), k);

  if (pose === 'attack') { ctx.translate(10, -3); ctx.rotate(-0.1); }
  else if (pose === 'hurt') { ctx.translate(-7, 0); ctx.rotate(0.13); }
  else if (pose === 'down') { ctx.translate(0, 4); ctx.rotate(1.35); ctx.globalAlpha = 0.55; }
  else if (pose === 'ready') { ctx.translate(2, 0); }

  const s = {
    t: t,
    bob: pose === 'down' ? 0 : Math.sin(t * 1.9) * 2.4,
    blink: pose === 'down' ? true : (t % 4.3) < 0.13,
  };
  (BEAST_ART[sp.plan] || BEAST_ART.blob)(ctx, pal, s);

  if (pose === 'down') {
    ctx.strokeStyle = pal.line; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-16, -54); ctx.lineTo(-8, -46); ctx.moveTo(-8, -54); ctx.lineTo(-16, -46);
    ctx.stroke();
  }
  ctx.restore();
}

/* 一覧などで使う小さな似顔。canvas ひとつを丸ごと使う。 */
function paintPortrait(cv, sp, tint, t, pose) {
  const ctx = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 120, hgt = cv.clientHeight || 120;
  if (!w || !hgt) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hgt);
  drawBeast(ctx, sp, { x: w * 0.5, y: hgt * 0.94, h: hgt * 0.84, face: -1, t: t, pose: pose || 'idle', tint: tint });
}
