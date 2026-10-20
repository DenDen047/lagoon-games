/* =========================================================================
   ハムスターの冒険 ― 絵
   すべてプログラムで描く。ハムスター / 魔物 / ボス / 木や岩 / 建物 / 地面
   ========================================================================= */
'use strict';

const Art = {
  cache: new Map(),

  /* 一度描いた絵をとっておく。ox, oy は足もとの位置。 */
  sprite(key, w, h, ox, oy, fn) {
    let s = this.cache.get(key);
    if (!s) {
      const c = document.createElement('canvas');
      const S = 2;
      c.width = w * S; c.height = h * S;
      const g = c.getContext('2d');
      g.scale(S, S); g.translate(ox, oy);
      fn(g);
      s = { c, w, h, ox, oy };
      this.cache.set(key, s);
    }
    return s;
  },
  blit(ctx, s, x, y) { ctx.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h); },
};

/* ------------------------------- 小道具 ------------------------------- */
function ell(g, x, y, rx, ry, fill, stroke, lw = 1.5) {
  g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
function circ(g, x, y, r, fill, stroke, lw = 1.5) { ell(g, x, y, r, r, fill, stroke, lw); }
function rrect(g, x, y, w, h, r, fill, stroke, lw = 1.5) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
function shadow(g, x, y, rx, ry, a = 0.22) { ell(g, x, y, rx, ry, `rgba(30,20,10,${a})`); }
function poly(g, pts, fill, stroke, lw = 1.5) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
function line(g, x1, y1, x2, y2, col, lw = 1.5) {
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineWidth = lw; g.strokeStyle = col; g.lineCap = 'round'; g.stroke();
}
const INK = '#4a2e1c';

/* ============================== ハムスター ============================== */
const FURS = {
  gold: ['#eda24f', '#fff3dc'], white: ['#f6f1e8', '#ffffff'], gray: ['#a9a6b2', '#eeeaf2'],
  cream: ['#f2d6a8', '#fff8ec'], brown: ['#a8724a', '#f2dcc0'], black: ['#55515c', '#f0ecf2'],
  choco: ['#7a5236', '#e8d0b4'], panda: ['#3e3a44', '#ffffff'],
};

function drawWeaponShape(g, wid, len = 1) {
  const w = GEAR[wid];
  if (!w) return;
  const col = w.col || '#ccc';
  if (w.kind === 'sword') {
    line(g, 0, 0, 6, 0, '#7a4a28', 3);
    line(g, 6, -4, 6, 4, '#d8b04a', 2.5);
    poly(g, [7, -2.4, 7 + 15 * len, -1.6, 10 + 15 * len, 0, 7 + 15 * len, 1.6, 7, 2.4], col, INK, 1.1);
    line(g, 8, -0.6, 6 + 14 * len, -0.6, 'rgba(255,255,255,.55)', 0.8);
  } else if (w.kind === 'spear') {
    line(g, -4, 0, 26, 0, '#8a5a32', 2.6);
    poly(g, [25, -3.5, 34, 0, 25, 3.5], col, INK, 1.1);
  } else if (w.kind === 'hammer') {
    line(g, 0, 0, 16, 0, '#7a4a28', 3);
    rrect(g, 13, -7, 9, 14, 2, col, INK, 1.2);
    line(g, 15, -5, 15, 5, 'rgba(255,255,255,.4)', 1);
  }
}
function drawStaffShape(g, sid, glow) {
  const s = GEAR[sid];
  if (!s) return;
  line(g, -2, 0, 22, 0, s.col, 2.6);
  line(g, -2, 0, 22, 0, 'rgba(0,0,0,.18)', 0.8);
  circ(g, 24, 0, 3.8, s.gem, INK, 1);
  if (glow) { g.globalAlpha = 0.35 + glow * 0.4; circ(g, 24, 0, 7 + glow * 3, s.gem); g.globalAlpha = 1; }
  circ(g, 23, -1.3, 1.1, '#fff');
}

function drawBag(g, bag, view) {
  const b = GEAR[bag];
  if (!b || bag === 'cheek') return;
  const c = b.col;
  if (view === 'back') {
    if (bag === 'leafbag') {
      poly(g, [0, -22, 9, -14, 7, -4, -7, -4, -9, -14], c, '#2e5a1e', 1.3);
      line(g, 0, -21, 0, -5, '#3e7a2a', 1.2);
    } else {
      const big = bag === 'advbag' || bag === 'magicbag';
      rrect(g, big ? -10 : -8, -20, big ? 20 : 16, big ? 18 : 15, 4, c, INK, 1.3);
      rrect(g, big ? -10 : -8, -20, big ? 20 : 16, 6, 3, shade(c.length === 7 ? c : '#888888', -18), INK, 1.1);
      if (bag === 'advbag') { rrect(g, -11, -26, 22, 7, 3.5, '#5a8a4a', INK, 1.1); }
      if (bag === 'magicbag') { g.fillStyle = '#ffe680'; g.font = '9px sans-serif'; g.textAlign = 'center'; g.fillText('★', 0, -8); }
      circ(g, 0, -13, 1.6, '#e8c860');
    }
  } else if (view === 'side') {
    if (bag === 'leafbag') poly(g, [-9, -20, -16, -12, -13, -4, -7, -5], c, '#2e5a1e', 1.2);
    else {
      const big = bag === 'advbag' || bag === 'magicbag';
      rrect(g, big ? -18 : -16, -21, big ? 10 : 8, big ? 17 : 14, 3, c, INK, 1.2);
      if (bag === 'advbag') rrect(g, -19, -25, 10, 6, 3, '#5a8a4a', INK, 1);
    }
  } else {
    /* 正面からは肩の上に少し見えるだけ */
    if (bag === 'leafbag') poly(g, [-9, -16, 0, -27, 9, -16], c, '#2e5a1e', 1.2);
    else rrect(g, -9, bag === 'advbag' || bag === 'magicbag' ? -28 : -25, 18, 12, 4, c, INK, 1.2);
  }
}

function drawClothes(g, body, view, rx, ry, cy) {
  const b = GEAR[body];
  if (!b) return;
  g.save();
  g.beginPath(); g.ellipse(0, cy, rx, ry, 0, 0, TAU); g.clip();
  const top = body === 'robe' || body === 'royal' ? cy - 4 : cy - 1;
  g.fillStyle = b.col;
  g.fillRect(-rx - 2, top, rx * 2 + 4, ry + 6);
  if (b.armor) {
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(-rx, top + 1, rx * 2, 2.5);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
    for (let x = -rx; x < rx; x += 6) { g.beginPath(); g.moveTo(x, top + 4); g.lineTo(x, cy + ry); g.stroke(); }
  }
  if (b.trim) { g.fillStyle = b.trim; g.fillRect(-rx - 2, top - 1, rx * 2 + 4, 2.4); g.fillRect(-rx - 2, cy + ry - 3, rx * 2 + 4, 3); }
  if (body === 'leafsuit') {
    g.fillStyle = '#4e9a34';
    for (let x = -rx; x < rx; x += 5) poly(g, [x, top, x + 2.5, top + 4, x + 5, top], '#4e9a34');
  }
  g.restore();
  if ((body === 'royal') && view !== 'front') {
    /* マントは背中で広がる */
    poly(g, [-11, cy - 6, 11, cy - 6, 14, cy + 10, -14, cy + 10], b.col, INK, 1.2);
    line(g, -11, cy - 6, 11, cy - 6, b.trim, 2);
  }
}

function drawHat(g, hat, view) {
  if (!hat) return;
  const back = view === 'back', side = view === 'side';
  const hx = side ? 2 : 0;
  switch (hat) {
    case 'straw':
      ell(g, hx, -22, 13, 4, '#e8c86a', INK, 1.2);
      ell(g, hx, -25, 7, 5, '#f0d27a', INK, 1.2);
      g.fillStyle = '#d0503a'; g.fillRect(hx - 7, -24, 14, 2); break;
    case 'ribbon':
      if (back) { poly(g, [0, -21, -7, -25, -7, -17], '#f05a8a', INK, 1); poly(g, [0, -21, 7, -25, 7, -17], '#f05a8a', INK, 1); }
      else { const x = side ? 0 : 6; poly(g, [x, -22, x - 6, -26, x - 6, -18], '#f05a8a', INK, 1); poly(g, [x, -22, x + 6, -26, x + 6, -18], '#f05a8a', INK, 1); circ(g, x, -22, 1.8, '#ff8ab0', INK, 1); }
      break;
    case 'acornhat':
      g.beginPath(); g.ellipse(hx, -21, 10, 6.5, 0, Math.PI, TAU); g.closePath(); g.fillStyle = '#8a5a2a'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.8;
      for (let i = -8; i <= 8; i += 3) { g.beginPath(); g.moveTo(hx + i, -21); g.lineTo(hx + i * 0.7, -26); g.stroke(); }
      line(g, hx, -27, hx + 1.5, -30, '#5a3a1a', 2); break;
    case 'knitcap':
      g.beginPath(); g.ellipse(hx, -20, 10, 8, 0, Math.PI, TAU); g.closePath(); g.fillStyle = '#d84a5a'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
      rrect(g, hx - 10.5, -21.5, 21, 4, 2, '#f4ecdd', INK, 1);
      circ(g, hx, -29, 3.2, '#f4ecdd', INK, 1); break;
    case 'wizhat':
      ell(g, hx, -21, 12, 3.5, '#5a3aa8', INK, 1.2);
      poly(g, [hx - 8, -22, hx + 8, -22, hx + (side ? -5 : 3), -40], '#6a4ac8', INK, 1.2);
      g.fillStyle = '#ffe680'; g.font = '7px sans-serif'; g.textAlign = 'center'; g.fillText('★', hx, -26); break;
    case 'helmet':
      g.beginPath(); g.ellipse(hx, -19, 11, 9, 0, Math.PI, TAU); g.closePath(); g.fillStyle = '#b8c0cc'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
      line(g, hx - 10, -19, hx + 10, -19, '#8a929e', 2.4);
      if (!back) line(g, hx, -28, hx, -19, '#8a929e', 1.6);
      ell(g, hx - 4, -24, 2.5, 1.5, 'rgba(255,255,255,.6)'); break;
    case 'crown':
      poly(g, [hx - 8, -20, hx - 8, -28, hx - 4, -24, hx, -30, hx + 4, -24, hx + 8, -28, hx + 8, -20], '#ffd84a', INK, 1.2);
      circ(g, hx, -23, 1.6, '#e0445a'); break;
  }
}

/* o: face(down/up/left/right) t moving fur(belly) body hat bag weapon staff swing(0..1 / -1) aim kind
      roll(-1 / 0..1) cheek(0..1) flash cast(0..1) scale beard apron glasses */
function drawHamster(g, x, y, o) {
  g.save();
  g.translate(x, y);
  if (o.scale) g.scale(o.scale, o.scale);
  shadow(g, 0, 0, 11, 4);
  const fur = o.fur || FURS.gold[0], belly = o.belly || FURS.gold[1];
  const furD = shade(fur.startsWith('#') ? fur : '#eda24f', -40);

  if (o.roll >= 0) {
    g.translate(0, -10);
    g.rotate(o.roll * TAU * 1.5 * (o.face === 'left' ? -1 : 1));
    circ(g, 0, 0, 10.5, fur, INK, 1.5);
    g.beginPath(); g.arc(0, 0, 10.5, -0.6, 0.6); g.lineTo(0, 0); g.closePath(); g.fillStyle = belly; g.fill();
    circ(g, -5, -7, 2.6, '#f7b8b8');
    g.restore();
    return;
  }

  const bob = o.moving ? Math.abs(Math.sin(o.t * 15)) * 1.6 : Math.sin(o.t * 2.6) * 0.5;
  const step = o.moving ? Math.sin(o.t * 15) * 2.2 : 0;
  const face = o.face || 'down';
  const view = face === 'up' ? 'back' : face === 'down' ? 'front' : 'side';
  const flip = face === 'left' ? -1 : 1;
  const cheek = clamp(o.cheek || 0, 0, 1);

  /* 足 */
  ell(g, -5, -1 + (view === 'side' ? 0 : step * 0.5), 3.2, 2.2, '#f2a6a6', INK, 1);
  ell(g, 5, -1 - (view === 'side' ? 0 : step * 0.5), 3.2, 2.2, '#f2a6a6', INK, 1);

  g.translate(0, -bob);
  const BODY_Y = -11;

  /* 武器や杖の絵 (世界の向き)。体の後ろか前かを決めて描く */
  const weaponLayer = () => {
    if (o.cast > 0 && o.staff) {
      g.save(); g.translate(0, BODY_Y + 3); g.rotate(o.aim); g.translate(6, 0);
      drawStaffShape(g, o.staff, o.cast); g.restore();
      return;
    }
    if (o.swing >= 0 && o.weapon && o.weapon !== 'paw') {
      const k = GEAR[o.weapon].kind;
      const p = o.swing;
      g.save(); g.translate(0, BODY_Y + 2);
      let a = o.aim, off = 5;
      if (k === 'sword') a = o.aim + lerp(-1.25, 1.25, easeOut(p));
      else if (k === 'hammer') a = o.aim + lerp(-1.7, 1.5, easeOut(p));
      else if (k === 'spear') off = 2 + Math.sin(p * Math.PI) * 14;
      /* 振りの軌跡 */
      if (k !== 'spear' && p < 0.9) {
        const a0 = o.aim + (k === 'hammer' ? -1.7 : -1.25);
        g.beginPath(); g.arc(0, 0, k === 'hammer' ? 22 : 20, a0, a, false);
        g.strokeStyle = `rgba(255,255,255,${0.55 * (1 - p)})`; g.lineWidth = 7; g.lineCap = 'round'; g.stroke();
      }
      g.rotate(a); g.translate(off, 0);
      drawWeaponShape(g, o.weapon);
      g.restore();
      return;
    }
    if (o.swing >= 0 && (!o.weapon || o.weapon === 'paw')) {
      const p = o.swing, r = 6 + Math.sin(p * Math.PI) * 10;
      circ(g, Math.cos(o.aim) * r, BODY_Y + 4 + Math.sin(o.aim) * r, 3.2, '#f2a6a6', INK, 1);
      return;
    }
    /* しまっている武器 */
    if (o.weapon && o.weapon !== 'paw') {
      g.save();
      if (view === 'front') { g.translate(8, -7); g.rotate(-1.15); }
      else if (view === 'back') { g.translate(-8, -9); g.rotate(-2.0); }
      else { g.translate(6 * flip, -7); g.rotate(flip > 0 ? -0.75 : -(Math.PI - 0.75)); }
      drawWeaponShape(g, o.weapon, 0.85);
      g.restore();
    }
  };
  const staffOnBack = () => {
    if (!o.staff || o.cast > 0) return;
    g.save(); g.translate(view === 'side' ? -6 * flip : 0, -12);
    g.rotate(view === 'side' ? (flip > 0 ? -2.1 : -1.05) : -2.3);
    g.translate(-10, 0);
    drawStaffShape(g, o.staff, 0); g.restore();
  };
  const weaponBehind = (o.swing >= 0 || o.cast > 0) ? Math.sin(o.aim) < -0.35 : view === 'back';

  if (view === 'front') staffOnBack();
  if (weaponBehind) weaponLayer();

  g.save();
  g.scale(flip, 1);

  if (view === 'front') {
    drawBag(g, o.bag, 'front');
    if (o.body === 'royal') poly(g, [-12, -16, 12, -16, 14, -2, -14, -2], GEAR.royal.col, INK, 1.2);
    circ(g, -8, -20, 4.2, fur, INK, 1.3); circ(g, -8, -20, 2.2, '#f7b8b8');
    circ(g, 8, -20, 4.2, fur, INK, 1.3); circ(g, 8, -20, 2.2, '#f7b8b8');
    ell(g, 0, BODY_Y, 12, 11, fur, INK, 1.6);
    ell(g, 0, -6.5, 7.5, 6.2, belly);
    drawClothes(g, o.body, view, 12, 11, BODY_Y);
    if (o.apron) { g.save(); g.beginPath(); g.ellipse(0, BODY_Y, 12, 11, 0, 0, TAU); g.clip(); rrect(g, -6, -10, 12, 10, 2, o.apron); g.restore(); }
    /* ほお袋 */
    const cr = 3.2 + cheek * 4.2;
    circ(g, -9.5 - cheek * 1.5, -9.5, cr, fur, INK, 1.2);
    circ(g, 9.5 + cheek * 1.5, -9.5, cr, fur, INK, 1.2);
    ell(g, -8.5 - cheek, -9.5, 2.4, 1.4, 'rgba(255,140,150,.5)');
    ell(g, 8.5 + cheek, -9.5, 2.4, 1.4, 'rgba(255,140,150,.5)');
    /* 顔 */
    const blink = (Math.sin(o.t * 0.9 + (o.seed || 0)) > 0.985);
    if (blink) { line(g, -6, -14, -2.5, -14, '#1a1010', 1.4); line(g, 2.5, -14, 6, -14, '#1a1010', 1.4); }
    else {
      circ(g, -4.2, -14, 2.2, '#1a1010'); circ(g, 4.2, -14, 2.2, '#1a1010');
      circ(g, -3.5, -14.8, 0.8, '#fff'); circ(g, 4.9, -14.8, 0.8, '#fff');
    }
    if (o.glasses) { circ(g, -4.2, -14, 3.4, null, '#3a3a4a', 1); circ(g, 4.2, -14, 3.4, null, '#3a3a4a', 1); line(g, -0.8, -14, 0.8, -14, '#3a3a4a', 1); }
    ell(g, 0, -11, 1.6, 1.2, '#f07a8a');
    g.beginPath(); g.moveTo(-1.6, -9.6); g.quadraticCurveTo(0, -8.4, 0, -9.8); g.quadraticCurveTo(0, -8.4, 1.6, -9.6);
    g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
    line(g, -5, -10.5, -12, -11.5, 'rgba(60,40,30,.5)', 0.7); line(g, 5, -10.5, 12, -11.5, 'rgba(60,40,30,.5)', 0.7);
    if (o.beard) { poly(g, [-5, -9, 5, -9, 3, -2, 0, 1, -3, -2], '#ffffff', 'rgba(0,0,0,.2)', 0.8); }
    /* 前足 */
    circ(g, -4.5, -5.5, 2.3, '#f2a6a6', INK, 0.9); circ(g, 4.5, -5.5, 2.3, '#f2a6a6', INK, 0.9);
  } else if (view === 'back') {
    circ(g, -8, -20, 4.2, fur, INK, 1.3); circ(g, 8, -20, 4.2, fur, INK, 1.3);
    ell(g, 0, BODY_Y, 12, 11, fur, INK, 1.6);
    ell(g, 0, BODY_Y - 3, 8, 6, shade(fur.startsWith('#') ? fur : '#eda24f', 12));
    drawClothes(g, o.body, view, 12, 11, BODY_Y);
    circ(g, -12 - cheek * 1.5, -9.5, 2.2 + cheek * 3.2, fur, INK, 1);
    circ(g, 12 + cheek * 1.5, -9.5, 2.2 + cheek * 3.2, fur, INK, 1);
    circ(g, 0, -1.5, 2.2, belly, INK, 0.8);
    drawBag(g, o.bag, 'back');
  } else {
    drawBag(g, o.bag, 'side');
    circ(g, 3, -20, 4.2, fur, INK, 1.3); circ(g, 3.4, -20, 2.2, '#f7b8b8');
    ell(g, 0, BODY_Y, 12.5, 10.5, fur, INK, 1.6);
    ell(g, 4, -6.5, 6.5, 5, belly);
    drawClothes(g, o.body, view, 12.5, 10.5, BODY_Y);
    if (o.apron) { g.save(); g.beginPath(); g.ellipse(0, BODY_Y, 12.5, 10.5, 0, 0, TAU); g.clip(); rrect(g, 0, -10, 10, 10, 2, o.apron); g.restore(); }
    const cr = 3 + cheek * 4;
    circ(g, 7 + cheek, -9, cr, fur, INK, 1.1);
    ell(g, 7.5 + cheek, -9.5, 2.2, 1.3, 'rgba(255,140,150,.5)');
    circ(g, 6.5, -14.5, 2.2, '#1a1010'); circ(g, 7.2, -15.2, 0.8, '#fff');
    if (o.glasses) circ(g, 6.5, -14.5, 3.4, null, '#3a3a4a', 1);
    ell(g, 12, -11.5, 1.6, 1.3, '#f07a8a');
    line(g, 11, -10.5, 16, -10, 'rgba(60,40,30,.5)', 0.7);
    if (o.beard) poly(g, [6, -9, 12, -9, 9, -1, 5, -4], '#ffffff', 'rgba(0,0,0,.2)', 0.8);
    circ(g, 6.5, -5, 2.2, '#f2a6a6', INK, 0.9);
  }
  drawHat(g, o.hat, view);
  if (o.flash > 0) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(255,255,255,${o.flash})`; g.fillRect(-20, -34, 40, 40);
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();

  if (view === 'back') staffOnBack();
  else if (view === 'side') staffOnBack();
  if (!weaponBehind) weaponLayer();
  g.restore();
}
function easeOut(p) { return 1 - (1 - p) * (1 - p); }

/* ================================ 魔物 ================================ */
function drawMob(g, m, t) {
  const d = MOBS[m.type];
  const fx = m.vx < -1 ? -1 : m.vx > 1 ? 1 : (m.face || 1);
  m.face = fx;
  const fly = d.ai === 'flyer' || m.type === 'yeti';
  g.save();
  g.translate(m.x, m.y);
  shadow(g, 0, 0, d.r * 0.9, d.r * 0.32, fly ? 0.14 : 0.22);
  const hover = fly ? -10 - Math.sin(t * 5 + m.id) * 3 : 0;
  g.translate(0, hover);
  if (m.tele > 0) g.translate(Math.sin(t * 60) * 1.5, 0);
  g.scale(fx, 1);
  const wig = Math.sin(t * 12 + m.id);
  switch (m.type) {
    case 'ant': {
      for (let i = -1; i <= 1; i++) {
        line(g, i * 4, -5, i * 4 - 3, 1 + (i === 0 ? wig : -wig) * 1.5, '#2a1a14', 1.1);
        line(g, i * 4, -5, i * 4 + 3, 1 - (i === 0 ? wig : -wig) * 1.5, '#2a1a14', 1.1);
      }
      ell(g, -7, -6, 5, 4, '#9a3a24', INK, 1.1); ell(g, 0, -6, 3, 2.6, '#9a3a24', INK, 1.1); circ(g, 6, -7, 3.8, '#9a3a24', INK, 1.1);
      circ(g, 7.5, -8, 1.1, '#fff');
      line(g, 7, -10, 10, -15, '#2a1a14', 1); line(g, 8, -10, 12, -13, '#2a1a14', 1);
      break;
    }
    case 'worm': {
      for (let i = 3; i >= 0; i--) {
        const x = -i * 5.5, y = -6 + Math.sin(t * 6 + i * 1.2) * 1.6;
        circ(g, x, y, 5.2 - i * 0.3, i % 2 ? '#8ad04a' : '#7ac03e', INK, 1);
        circ(g, x, y - 3, 1.2, '#f2e05a');
      }
      circ(g, 5, -7, 5.5, '#9ae05a', INK, 1.1);
      circ(g, 7, -8.5, 1.4, '#1a1010'); ell(g, 9, -5.5, 1.8, 1, '#e07a7a');
      break;
    }
    case 'beetle': {
      for (let i = -1; i <= 1; i++) { line(g, i * 5, -4, i * 5 - 2, 1 + wig, '#1a1418', 1.4); line(g, i * 5, -4, i * 5 + 2, 1 - wig, '#1a1418', 1.4); }
      ell(g, -1, -8, 11, 8, '#4a2a3a', INK, 1.4);
      line(g, -1, -15.5, -1, -0.5, 'rgba(0,0,0,.35)', 1);
      ell(g, -4, -11, 4, 2, 'rgba(255,255,255,.3)');
      circ(g, 10, -8, 4.5, '#3a2030', INK, 1.2);
      g.beginPath(); g.moveTo(12, -10); g.quadraticCurveTo(20, -14, 19, -22); g.quadraticCurveTo(16, -15, 11, -12); g.fillStyle = '#3a2030'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
      circ(g, 12, -8, 1.1, '#ffd84a');
      break;
    }
    case 'bee': {
      const wa = Math.sin(t * 50) * 0.5 + 0.5;
      g.globalAlpha = 0.6; ell(g, -2, -12 - wa * 2, 5, 3 + wa * 2, '#eaf6ff', '#9ab'); ell(g, 3, -12 - wa * 2, 4, 2.5 + wa * 2, '#eaf6ff', '#9ab'); g.globalAlpha = 1;
      ell(g, 0, -6, 8, 6, '#f6c83a', INK, 1.2);
      g.save(); g.beginPath(); g.ellipse(0, -6, 8, 6, 0, 0, TAU); g.clip();
      g.fillStyle = '#2a2020'; g.fillRect(-4, -12, 2.6, 12); g.fillRect(1, -12, 2.6, 12); g.restore();
      poly(g, [-8, -6, -12, -5, -8, -4], '#2a2020');
      circ(g, 6, -7, 1.4, '#1a1010');
      break;
    }
    case 'spider': {
      for (let i = 0; i < 4; i++) {
        const a = -0.9 + i * 0.6, k = Math.sin(t * 10 + i) * 2;
        line(g, 0, -8, Math.cos(a) * 14, -8 + Math.sin(a) * 10 + 6 + k, '#2a1830', 1.6);
        line(g, 0, -8, -Math.cos(a) * 14, -8 + Math.sin(a) * 10 + 6 - k, '#2a1830', 1.6);
      }
      ell(g, -6, -9, 8, 7, '#4a2a5a', INK, 1.3); circ(g, -6, -10, 2.5, '#e05a7a');
      circ(g, 4, -8, 5.5, '#3a2048', INK, 1.2);
      circ(g, 6, -9, 1.3, '#ff4a5a'); circ(g, 8, -8, 1.1, '#ff4a5a'); circ(g, 4.5, -7, 1, '#ff4a5a');
      break;
    }
    case 'centi': {
      const n = 6;
      for (let i = n - 1; i >= 0; i--) {
        const x = -i * 5, y = -6 + Math.sin(t * 9 + i) * 1.6;
        line(g, x, y, x - 1, y + 6, '#5a1a10', 1); line(g, x, y, x + 1, y - 7 + 1, '#5a1a10', 0.8);
        circ(g, x, y, 4.6, i % 2 ? '#c8402a' : '#b0341f', INK, 1);
      }
      circ(g, 4, -7, 5, '#d8482e', INK, 1.1); circ(g, 6, -8.5, 1.2, '#ffe680');
      line(g, 8, -10, 12, -14, '#5a1a10', 1);
      break;
    }
    case 'lizard': {
      g.beginPath(); g.moveTo(-6, -5); g.quadraticCurveTo(-16, -4 + wig * 3, -22, -8 + wig * 2); g.strokeStyle = '#4a9a3a'; g.lineWidth = 4; g.lineCap = 'round'; g.stroke();
      line(g, -3, -4, -6, 1 + wig, '#3a7a2a', 2); line(g, 4, -4, 7, 1 - wig, '#3a7a2a', 2);
      ell(g, 0, -6, 9, 5, '#5aba4a', INK, 1.2);
      ell(g, 10, -7, 5, 3.6, '#5aba4a', INK, 1.2);
      circ(g, 11, -8.5, 1.3, '#1a1010');
      for (let i = -5; i <= 4; i += 3) circ(g, i, -9, 1, '#e8d84a');
      break;
    }
    case 'weasel': {
      const snowy = m.snowy;
      const c = snowy ? '#f2f2f6' : '#a8703a';
      g.beginPath(); g.moveTo(-10, -7); g.quadraticCurveTo(-18, -12 + wig * 2, -22, -6); g.strokeStyle = snowy ? '#d8d8e0' : '#8a5a2a'; g.lineWidth = 4.5; g.lineCap = 'round'; g.stroke();
      line(g, -6, -4, -8, 0.5 + wig, INK, 2); line(g, 6, -4, 8, 0.5 - wig, INK, 2);
      ell(g, 0, -7, 12, 5.5, c, INK, 1.3);
      ell(g, 2, -4.5, 8, 2.5, '#fff6e8');
      circ(g, 12, -9, 5, c, INK, 1.2); circ(g, 10, -14, 2, c, INK, 1);
      circ(g, 13.5, -10, 1.3, '#1a1010'); circ(g, 17, -8.5, 1.1, '#2a1a1a');
      break;
    }
    case 'crow': case 'owl': case 'bat': {
      const wa = Math.sin(t * (m.type === 'bat' ? 26 : 16) + m.id);
      const body = m.type === 'crow' ? '#2a2834' : m.type === 'owl' ? '#8a6a4a' : '#4a3a5a';
      const wing = m.type === 'crow' ? '#3a3846' : m.type === 'owl' ? '#a07a52' : '#5a4870';
      if (m.type === 'bat') {
        poly(g, [0, -8, -16, -14 - wa * 6, -12, -6, -8, -9, -4, -4], wing, INK, 1);
        poly(g, [0, -8, 16, -14 - wa * 6, 12, -6, 8, -9, 4, -4], wing, INK, 1);
        circ(g, 0, -8, 5.5, body, INK, 1.2);
        poly(g, [-4, -12, -2, -16, -1, -12], body); poly(g, [4, -12, 2, -16, 1, -12], body);
        circ(g, -2, -8.5, 1.2, '#ff5a6a'); circ(g, 2, -8.5, 1.2, '#ff5a6a');
      } else {
        ell(g, -6, -10 - wa * 5, 10, 4, wing, INK, 1.1);
        ell(g, 0, -8, 9, 7.5, body, INK, 1.3);
        ell(g, 4, -10 + wa * 5, 9, 3.6, wing, INK, 1.1);
        if (m.type === 'owl') {
          ell(g, 1, -6, 5.5, 4.5, '#e8d0a8');
          circ(g, 3, -11, 3, '#ffe680', INK, 1); circ(g, 3.5, -11, 1.6, '#1a1010');
          poly(g, [6, -9, 9, -8, 6, -7], '#e8a03a');
          poly(g, [-2, -15, 0, -19, 2, -15], body);
        } else {
          circ(g, 6, -10, 1.4, '#fff'); circ(g, 6.3, -10, 0.7, '#1a1010');
          poly(g, [8, -10, 14, -8, 8, -7], '#f0c03a', INK, 0.8);
        }
      }
      break;
    }
    case 'yeti': {
      g.beginPath(); g.moveTo(-11, -4);
      for (let i = 0; i <= 4; i++) g.quadraticCurveTo(-11 + i * 5.5 - 2.75, -1 + (i % 2 ? 2 : -2), -11 + i * 5.5, -4);
      g.lineTo(11, -14); g.arc(0, -14, 11, 0, Math.PI, true); g.closePath();
      g.fillStyle = '#f6faff'; g.fill(); g.strokeStyle = '#8aa0c0'; g.lineWidth = 1.4; g.stroke();
      circ(g, 0, -15, 2, '#2a3048'); circ(g, 6, -15, 2, '#2a3048');
      ell(g, -2, -11, 2.2, 1.2, 'rgba(255,140,170,.6)'); ell(g, 8, -11, 2.2, 1.2, 'rgba(255,140,170,.6)');
      ell(g, 3, -10, 2, 1.2, '#4a5070');
      break;
    }
    case 'snake': {
      g.beginPath();
      for (let i = 0; i <= 12; i++) {
        const x = -20 + i * 2.4, y = -5 + Math.sin(t * 7 + i * 0.7) * 3;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.strokeStyle = INK; g.lineWidth = 7.5; g.lineCap = 'round'; g.stroke();
      g.strokeStyle = '#7a5aa8'; g.lineWidth = 5.5; g.stroke();
      g.setLineDash([2, 4]); g.strokeStyle = '#e8d84a'; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
      ell(g, 10, -6, 6, 4.4, '#8a6ab8', INK, 1.2);
      circ(g, 12, -7.5, 1.3, '#ffe680');
      if (Math.sin(t * 8 + m.id) > 0.3) { line(g, 15, -5, 19, -5, '#e0405a', 1); }
      break;
    }
    case 'shroom': {
      const sq = 1 + Math.sin(t * 6 + m.id) * 0.06;
      rrect(g, -5, -10, 10, 10, 3, '#f4e6c8', INK, 1.2);
      circ(g, -2, -5.5, 1.3, '#1a1010'); circ(g, 3, -5.5, 1.3, '#1a1010');
      g.save(); g.scale(sq, 1 / sq);
      g.beginPath(); g.ellipse(0, -11, 13, 9, 0, Math.PI, TAU); g.closePath();
      g.fillStyle = '#d0404a'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
      circ(g, -5, -15, 2.4, '#fff'); circ(g, 4, -17, 2, '#fff'); circ(g, 8, -13, 1.6, '#fff');
      g.restore();
      break;
    }
    case 'catsol': case 'catmage': case 'catknight': {
      const fur = m.type === 'catmage' ? '#2e2a38' : m.type === 'catknight' ? '#e8e0d0' : '#9a96a6';
      line(g, -6, -8, -13, -16 + wig * 2, fur, 3.4);
      ell(g, -3, -1, 3, 2, fur, INK, 1); ell(g, 4, -1, 3, 2, fur, INK, 1);
      ell(g, 0, -9, 9, 9, fur, INK, 1.4);
      if (m.type === 'catknight') { g.save(); g.beginPath(); g.ellipse(0, -9, 9, 9, 0, 0, TAU); g.clip(); g.fillStyle = '#b8c0cc'; g.fillRect(-10, -12, 20, 14); g.restore(); }
      if (m.type === 'catsol') { g.save(); g.beginPath(); g.ellipse(0, -9, 9, 9, 0, 0, TAU); g.clip(); g.fillStyle = '#6a4a3a'; g.fillRect(-10, -9, 20, 10); g.restore(); }
      circ(g, 3, -20, 7.5, fur, INK, 1.4);
      poly(g, [-3, -24, -2, -32, 3, -26], fur, INK, 1.1); poly(g, [4, -26, 8, -32, 9, -23], fur, INK, 1.1);
      const eye = m.type === 'catmage' ? '#b8ff6a' : '#ffd84a';
      ell(g, 2, -21, 1.6, 2, eye); ell(g, 7, -21, 1.6, 2, eye);
      line(g, 2, -22, 2, -20, '#1a1010', 0.9); line(g, 7, -22, 7, -20, '#1a1010', 0.9);
      line(g, 9, -18, 14, -19, 'rgba(0,0,0,.4)', 0.6);
      if (m.type === 'catsol') {
        g.beginPath(); g.ellipse(3, -24, 8, 5, 0, Math.PI, TAU); g.closePath(); g.fillStyle = '#8a929e'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke();
        line(g, 10, -26, 10, 2, '#7a5a3a', 2); poly(g, [8, -26, 10, -33, 12, -26], '#c8ccd4', INK, 0.9);
      } else if (m.type === 'catmage') {
        poly(g, [-5, -25, 11, -25, 4, -41], '#5a3aa8', INK, 1.1);
        line(g, 11, -14, 11, 1, '#6a4a2a', 2); circ(g, 11, -16, 3.2, '#b8ff6a', INK, 1);
        g.globalAlpha = 0.3 + Math.sin(t * 6) * 0.15; circ(g, 11, -16, 6, '#b8ff6a'); g.globalAlpha = 1;
      } else {
        rrect(g, -12, -16, 8, 12, 3, '#4a6ab8', INK, 1.2); circ(g, -8, -10, 2, '#ffd84a');
        line(g, 10, -10, 18, -24, '#e8eef6', 2.6); line(g, 8, -12, 12, -9, '#d8b04a', 2);
        g.beginPath(); g.ellipse(3, -25, 8, 4.5, 0, Math.PI, TAU); g.fillStyle = '#b8c0cc'; g.fill();
      }
      break;
    }
  }
  if (m.flash > 0) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(255,255,255,${m.flash * 0.9})`; g.fillRect(-30, -45, 60, 50);
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
  if (m.slow > 0) { g.globalAlpha = 0.5; circ(g, m.x, m.y - 6, d.r + 2, null, '#9fe8ff', 2); g.globalAlpha = 1; }
}

/* ================================ ボス ================================ */
function drawBoss(g, b, t) {
  g.save();
  g.translate(b.x, b.y);
  const air = b.air || 0;
  shadow(g, 0, 0, b.r * 1.1 * (1 - air * 0.3), b.r * 0.35, 0.28);
  g.translate(0, -air * 60);
  if (b.tele > 0) g.translate(Math.sin(t * 50) * 2, 0);
  const fx = b.face || 1;
  if (b.type === 'queen') {
    for (let i = 0; i < 4; i++) {
      const a = -1.0 + i * 0.62, k = Math.sin(t * 7 + i * 1.3) * 4;
      for (const s of [-1, 1]) {
        const kx = s * Math.cos(a) * 30, ky = Math.sin(a) * 18 - 12;
        g.beginPath(); g.moveTo(0, -16); g.quadraticCurveTo(kx, ky - 16 + k * s, s * Math.cos(a) * 44, -2 + k * s);
        g.strokeStyle = '#2a1830'; g.lineWidth = 3.5; g.lineCap = 'round'; g.stroke();
      }
    }
    ell(g, 0, -24, 26, 20, '#5a2a6a', INK, 2);
    g.globalAlpha = 0.8;
    poly(g, [0, -38, 8, -26, 0, -14, -8, -26], '#e05a8a'); g.globalAlpha = 1;
    circ(g, 0, -6, 13, '#3a1a48', INK, 1.8);
    for (const [x, y, r] of [[-5, -8, 2.4], [5, -8, 2.4], [-2, -3, 1.8], [2, -3, 1.8]]) circ(g, x, y, r, '#ff3a5a');
    poly(g, [-9, -16, -9, -24, -4, -19, 0, -26, 4, -19, 9, -24, 9, -16], '#ffd84a', INK, 1.4);
  } else if (b.type === 'eagle') {
    const wa = Math.sin(t * (b.air > 0.3 ? 10 : 5)) ;
    g.scale(fx, 1);
    for (const s of [-1, 1]) {
      g.save(); g.scale(s, 1);
      g.beginPath(); g.moveTo(4, -26);
      g.quadraticCurveTo(30, -50 - wa * 18, 62, -36 - wa * 22);
      g.lineTo(54, -28 - wa * 14); g.lineTo(58, -22 - wa * 10); g.lineTo(46, -18 - wa * 6); g.lineTo(48, -12 - wa * 3);
      g.quadraticCurveTo(24, -14, 4, -16); g.closePath();
      g.fillStyle = '#7a4a24'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.8; g.stroke();
      g.restore();
    }
    ell(g, 0, -20, 15, 18, '#6a3e1e', INK, 2);
    poly(g, [-8, -4, 8, -4, 4, 6, 0, 2, -4, 6], '#f4f0e6', INK, 1.4);
    circ(g, 6, -38, 11, '#f6f2ea', INK, 1.8);
    poly(g, [13, -40, 24, -36, 14, -31], '#f0b03a', INK, 1.4);
    circ(g, 9, -41, 2.2, '#1a1010'); line(g, 4, -45, 12, -43, INK, 1.6);
    line(g, -5, -2, -6, 6, '#f0b03a', 2.4); line(g, 5, -2, 6, 6, '#f0b03a', 2.4);
  } else if (b.type === 'catking') {
    g.scale(fx, 1);
    line(g, -18, -24, -38, -44 + Math.sin(t * 2) * 6, '#e88a3a', 7);
    poly(g, [-24, -48, 24, -48, 34, -2, -34, -2], '#c8364a', INK, 2);
    line(g, -24, -48, 24, -48, '#ffe28a', 3.5);
    ell(g, -10, -2, 8, 5, '#f0a04a', INK, 1.5); ell(g, 10, -2, 8, 5, '#f0a04a', INK, 1.5);
    ell(g, 0, -26, 25, 24, '#f0a04a', INK, 2.2);
    ell(g, 2, -18, 14, 13, '#fff0dc');
    for (const y of [-40, -34, -28]) line(g, -20, y, -12, y + 2, '#c87a2a', 2.4);
    circ(g, 4, -58, 20, '#f0a04a', INK, 2.2);
    poly(g, [-12, -66, -10, -84, 0, -72], '#f0a04a', INK, 1.8); poly(g, [8, -72, 18, -84, 20, -64], '#f0a04a', INK, 1.8);
    poly(g, [-9, -70, -8, -79, -3, -72], '#ffb8b8'); poly(g, [11, -72, 16, -79, 17, -68], '#ffb8b8');
    const angry = b.phase > 1;
    ell(g, -3, -60, 3.5, 4.5, angry ? '#ff4a3a' : '#ffd84a', INK, 1); ell(g, 12, -60, 3.5, 4.5, angry ? '#ff4a3a' : '#ffd84a', INK, 1);
    line(g, -3, -63, -3, -57, '#1a1010', 1.6); line(g, 12, -63, 12, -57, '#1a1010', 1.6);
    line(g, -8, -67, 1, -64, INK, 2); line(g, 16, -67, 8, -64, INK, 2);
    ell(g, 5, -52, 2.6, 2, '#e0607a');
    line(g, 12, -52, 26, -54, 'rgba(0,0,0,.4)', 1); line(g, 12, -50, 26, -48, 'rgba(0,0,0,.4)', 1);
    poly(g, [-10, -74, -10, -86, -4, -80, 4, -90, 12, -80, 18, -86, 18, -74], '#ffd84a', INK, 1.8);
    circ(g, 4, -80, 2.6, '#e0445a');
    line(g, 26, -20, 30, -64, '#d8b04a', 3.5); circ(g, 30, -68, 6, '#b8ff6a', INK, 1.4);
  }
  if (b.flash > 0) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(255,255,255,${b.flash * 0.85})`; g.fillRect(-90, -110, 180, 120);
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}

/* ============================= 木や岩 ============================= */
function nodeSprite(type, v, dead) {
  const key = 'n:' + type + ':' + v + ':' + (dead ? 1 : 0);
  return Art.sprite(key, 64, 80, 32, 64, (g) => {
    if (dead) { drawDeadNode(g, type, v); return; }
    switch (type) {
      case 'tree': {
        shadow(g, 0, 0, 16, 5);
        rrect(g, -4, -16, 8, 18, 3, '#8a5a32', INK, 1.4);
        const greens = [['#5aa83e', '#7ccf52'], ['#4e9e3a', '#6ec24a'], ['#63b043', '#86d65c'], ['#58a040', '#7ac455']][v];
        circ(g, -10, -24, 12, greens[0], INK, 1.5); circ(g, 10, -24, 12, greens[0], INK, 1.5);
        circ(g, 0, -34, 15, greens[0], INK, 1.5);
        circ(g, -10, -24, 10.5, greens[0]); circ(g, 10, -24, 10.5, greens[0]);
        circ(g, -3, -37, 7, greens[1]); circ(g, -11, -27, 4.5, greens[1]); circ(g, 8, -29, 4, greens[1]);
        if (v === 2) { circ(g, 6, -22, 2.2, '#a0682e'); circ(g, -6, -30, 2.2, '#a0682e'); }
        if (v === 3) { circ(g, 7, -34, 1.8, '#ff8ab0'); circ(g, -8, -21, 1.8, '#ff8ab0'); circ(g, 12, -22, 1.8, '#fff'); }
        break;
      }
      case 'pine': case 'snowpine': {
        shadow(g, 0, 0, 13, 4);
        rrect(g, -3, -10, 6, 12, 2, '#6a4a2a', INK, 1.2);
        const c = ['#2e7a4a', '#2a6e44', '#348450', '#2c7448'][v];
        for (let i = 0; i < 3; i++) {
          const y = -10 - i * 11, w = 16 - i * 4;
          poly(g, [-w, y, w, y, 0, y - 18], c, INK, 1.3);
          if (type === 'snowpine') poly(g, [-w * 0.55, y - 8, w * 0.55, y - 8, 0, y - 18], '#f4f8ff');
        }
        break;
      }
      case 'deadtree': {
        shadow(g, 0, 0, 12, 4);
        g.lineCap = 'round';
        line(g, 0, 0, 0, -30, '#5a4a5e', 6); line(g, 0, -18, -12, -32, '#5a4a5e', 3.5); line(g, 0, -24, 11, -38, '#5a4a5e', 3.5);
        line(g, -8, -27, -14, -26, '#5a4a5e', 2); line(g, 7, -32, 13, -31, '#5a4a5e', 2); line(g, 0, -30, 2, -42, '#5a4a5e', 2.5);
        line(g, -1, -4, -1, -22, 'rgba(255,255,255,.12)', 1.4);
        break;
      }
      case 'bush': {
        shadow(g, 0, 0, 12, 3.5);
        const c = v % 2 ? '#5fae42' : '#4f9c38';
        circ(g, -6, -7, 7, c, INK, 1.3); circ(g, 6, -7, 7, c, INK, 1.3); circ(g, 0, -11, 8, c, INK, 1.3);
        circ(g, -6, -7, 6, c); circ(g, 6, -7, 6, c);
        circ(g, -2, -13, 3, 'rgba(255,255,255,.22)');
        if (v === 3) { circ(g, -5, -10, 1.7, '#ff6a8a'); circ(g, 5, -6, 1.7, '#ffe06a'); }
        break;
      }
      case 'sunflower': {
        shadow(g, 0, 0, 7, 2.5);
        line(g, 0, 0, 0, -26, '#4a8a2e', 2.6);
        ell(g, -5, -10, 5, 2.4, '#5aa83e', INK, 1); ell(g, 5, -15, 5, 2.4, '#5aa83e', INK, 1);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          ell(g, Math.cos(a) * 7, -30 + Math.sin(a) * 7, 4, 4, '#ffcf2e', '#c89a1a', 0.8);
        }
        circ(g, 0, -30, 5.5, '#7a4a20', INK, 1.1);
        for (let i = 0; i < 5; i++) circ(g, -2 + (i % 3) * 2, -32 + Math.floor(i / 3) * 3, 0.8, '#4a2a10');
        break;
      }
      case 'mushroom': {
        shadow(g, 0, 0, 8, 3);
        rrect(g, -3, -9, 6, 9, 2, '#f4e6c8', INK, 1.1);
        g.beginPath(); g.ellipse(0, -9, 9, 7, 0, Math.PI, TAU); g.closePath();
        g.fillStyle = v % 2 ? '#d0404a' : '#c86a2a'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke();
        circ(g, -3, -12, 1.6, '#fff'); circ(g, 3, -13, 1.3, '#fff');
        break;
      }
      case 'snowflower': {
        line(g, 0, 0, 0, -10, '#6a9a5a', 1.6);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; circ(g, Math.cos(a) * 3.6, -12 + Math.sin(a) * 3.6, 2.6, '#ffffff', '#a8c0d8', 0.7); }
        circ(g, 0, -12, 2, '#ffe680');
        break;
      }
      case 'rock': case 'iron': case 'moonrock': {
        shadow(g, 0, 0, 14, 4);
        const base = type === 'rock' ? '#9a968e' : type === 'iron' ? '#6a6268' : '#a898c8';
        poly(g, [-14, 0, -12, -12, -4, -18, 7, -17, 13, -8, 14, 0], base, INK, 1.5);
        poly(g, [-10, -10, -4, -16, 5, -15, 1, -9], shade(base, 30));
        if (type === 'iron') { for (const [x, y] of [[-6, -6], [4, -10], [8, -4], [-2, -13]]) circ(g, x, y, 1.8, '#d08a52'); }
        if (type === 'moonrock') { g.fillStyle = '#fff6b0'; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText('☾', 0, -5); }
        break;
      }
      case 'crystal': {
        shadow(g, 0, 0, 12, 4);
        for (const [x, h, w, a] of [[-6, 16, 5, -0.25], [5, 14, 5, 0.25], [0, 22, 6, 0]]) {
          g.save(); g.translate(x, 0); g.rotate(a);
          poly(g, [-w, 0, -w, -h + 5, 0, -h, w, -h + 5, w, 0], '#8ad8f0', '#3a7a9a', 1.2);
          poly(g, [-w * 0.3, -2, -w * 0.3, -h + 6, 0, -h + 1, w * 0.1, -h + 6], 'rgba(255,255,255,.55)');
          g.restore();
        }
        break;
      }
      case 'thorns': {
        g.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const a = i * 0.9 + v;
          g.beginPath(); g.moveTo(-14 + i * 4.6, 0);
          g.bezierCurveTo(-18 + Math.cos(a) * 20, -14, 12 + Math.sin(a) * 10, -26, -10 + i * 3.5, -34 + (i % 3) * 4);
          g.strokeStyle = i % 2 ? '#3e5a26' : '#4e6e2e'; g.lineWidth = 3.4; g.stroke();
        }
        g.fillStyle = '#c8a8d8';
        for (let i = 0; i < 12; i++) { const x = -13 + (i * 37 % 27), y = -4 - (i * 53 % 30); poly(g, [x, y, x + 2.5, y - 4.5, x + 3, y + 1], '#d8e8b8'); }
        circ(g, -6, -22, 2.4, '#b84a8a'); circ(g, 7, -12, 2.4, '#b84a8a');
        break;
      }
    }
  });
}
function drawDeadNode(g, type, v) {
  if (type === 'tree' || type === 'pine' || type === 'snowpine' || type === 'deadtree') {
    shadow(g, 0, 0, 9, 3);
    ell(g, 0, -4, 7, 3, type === 'deadtree' ? '#6a5a6e' : '#a8743f', INK, 1.2);
    rrect(g, -7, -4, 14, 5, 2, type === 'deadtree' ? '#5a4a5e' : '#8a5a32', INK, 1.2);
    ell(g, 0, -4, 6, 2.4, '#d8b07a');
    if (type === 'snowpine') ell(g, 0, -5, 5, 2, '#f4f8ff');
  } else if (type === 'rock' || type === 'iron' || type === 'moonrock' || type === 'crystal') {
    const c = type === 'crystal' ? '#8ad8f0' : '#9a968e';
    circ(g, -4, -2, 3, c, INK, 1); circ(g, 4, -1.5, 2.4, c, INK, 1); circ(g, 0, -4, 2, c, INK, 1);
  } else if (type === 'bush' || type === 'sunflower') {
    line(g, -3, 0, -4, -5, '#5a8a3a', 1.6); line(g, 0, 0, 0, -6, '#5a8a3a', 1.6); line(g, 3, 0, 4, -5, '#5a8a3a', 1.6);
  }
}
function drawNode(g, n, t) {
  const sp = nodeSprite(n.type, n.v, n.dead);
  const x = n.tx * TILE + 16 + (n.shake > 0 ? Math.sin(n.shake * 60) * 2.5 : 0);
  const y = n.ty * TILE + 26;
  Art.blit(g, sp, x, y);
}

/* ============================== 建物など ============================== */
function drawStruct(g, s, t, st) {
  const x = s.x * TILE, y = s.y * TILE, w = s.w * TILE, h = s.h * TILE;
  const cx = x + w / 2, by = y + h;
  switch (s.kind) {
    case 'home': {
      shadow(g, cx, by, w * 0.55, 10);
      rrect(g, x + 6, y - 34, w - 12, h + 30, 10, '#9a6a3c', INK, 2);
      for (let i = 0; i < 6; i++) line(g, x + 18 + i * 17, y - 26, x + 16 + i * 17, by - 8, 'rgba(60,30,10,.35)', 2);
      ell(g, cx, y - 34, w / 2 - 6, 14, '#c89a5c', INK, 2);
      for (let r = 4; r < 30; r += 7) ell(g, cx, y - 34, r * 1.6, r * 0.42, null, 'rgba(120,70,30,.4)', 1.2);
      for (let i = 0; i < 9; i++) circ(g, x + 14 + i * 12, y - 26 + Math.sin(i) * 3, 7, '#6ab84a', INK, 1);
      g.beginPath(); g.ellipse(cx, by - 4, 15, 22, 0, Math.PI, TAU); g.lineTo(cx + 15, by); g.lineTo(cx - 15, by); g.closePath();
      g.fillStyle = '#6a3e1e'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.8; g.stroke();
      circ(g, cx + 8, by - 12, 2, '#ffd84a');
      circ(g, x + 26, y + 18, 9, '#ffe9a8', INK, 1.6); line(g, x + 17, y + 18, x + 35, y + 18, INK, 1.2); line(g, x + 26, y + 9, x + 26, y + 27, INK, 1.2);
      rrect(g, x + w - 40, y - 52, 12, 22, 2, '#8a8a8a', INK, 1.5);
      g.globalAlpha = 0.4; circ(g, x + w - 34 + Math.sin(t) * 4, y - 62 - (t * 8 % 20), 5 + (t * 8 % 20) * 0.3, '#ddd'); g.globalAlpha = 1;
      break;
    }
    case 'shop': case 'house': case 'magic': {
      shadow(g, cx, by, w * 0.55, 9);
      const wallH = h * 0.75 + 20;
      rrect(g, x + 4, by - wallH, w - 8, wallH, 4, s.kind === 'magic' ? '#e8e0f4' : '#fbeed6', INK, 2);
      for (let i = 1; i < 4; i++) line(g, x + 6, by - wallH + i * wallH / 4, x + w - 6, by - wallH + i * wallH / 4, 'rgba(160,120,80,.18)', 1);
      const ry = by - wallH;
      if (s.kind === 'magic') {
        poly(g, [x - 2, ry + 4, x + w + 2, ry + 4, cx, ry - 70], s.roof, INK, 2);
        g.fillStyle = '#ffe680'; g.font = '14px sans-serif'; g.textAlign = 'center';
        g.fillText('★', cx - 16, ry - 14); g.fillText('☾', cx + 14, ry - 26); g.fillText('✦', cx, ry - 44);
      } else {
        poly(g, [x - 6, ry + 6, x + w + 6, ry + 6, x + w - 14, ry - 34, x + 14, ry - 34], s.roof, INK, 2);
        for (let i = 0; i < 4; i++) line(g, x - 2 + i * 3, ry + 2 - i * 9.5, x + w + 2 - i * 3, ry + 2 - i * 9.5, 'rgba(0,0,0,.14)', 2);
      }
      const dw = 24, dx = cx - dw / 2;
      rrect(g, dx, by - 34, dw, 34, 4, '#8a5a32', INK, 1.8);
      circ(g, dx + dw - 6, by - 17, 1.8, '#ffd84a');
      for (const wx of [x + 14, x + w - 34]) {
        rrect(g, wx, by - wallH + 14, 20, 16, 3, '#bfe6ff', INK, 1.6);
        line(g, wx + 10, by - wallH + 14, wx + 10, by - wallH + 30, INK, 1);
        rrect(g, wx - 2, by - wallH + 29, 24, 4, 2, '#a8743f', INK, 1);
      }
      if (s.sign) {
        rrect(g, cx - 15, ry - 10, 30, 22, 5, '#fff8e8', INK, 1.6);
        g.font = '15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.sign, cx, ry + 1.5);
      }
      break;
    }
    case 'fountain': {
      ell(g, cx, by - 30, 46, 26, '#c8c0b4', INK, 2);
      ell(g, cx, by - 32, 38, 20, '#6ac0e8');
      for (let i = 0; i < 3; i++) { const r = ((t * 14 + i * 12) % 36); g.globalAlpha = 1 - r / 36; ell(g, cx, by - 32, r, r * 0.52, null, '#e8f8ff', 1.4); }
      g.globalAlpha = 1;
      rrect(g, cx - 6, by - 62, 12, 32, 3, '#b8b0a4', INK, 1.6);
      g.globalAlpha = 0.85;
      for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.4, k = (t * 2 + i * 0.17) % 1; circ(g, cx + Math.cos(a) * k * 22, by - 64 + k * k * 34 - k * 18, 2.2, '#bfeaff'); }
      g.globalAlpha = 1;
      break;
    }
    case 'arch': {
      rrect(g, x + 10, y - 38, 12, h + 38, 3, '#8a5a32', INK, 1.6);
      circ(g, x + 16, y - 40, 6, '#ffd84a', INK, 1.4);
      if (s.label) {
        rrect(g, x + 26, y - 30, 82, 22, 5, '#fff3d6', INK, 1.6);
        g.fillStyle = '#6a3e1e'; g.font = 'bold 10px "Hiragino Maru Gothic ProN", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(s.label, x + 67, y - 19);
      }
      break;
    }
    case 'lamp': {
      shadow(g, cx, by - 4, 7, 3);
      line(g, cx, by - 6, cx, by - 44, '#3a3a44', 3);
      rrect(g, cx - 6, by - 56, 12, 13, 3, '#ffe9a8', INK, 1.5);
      g.globalAlpha = 0.18 + Math.sin(t * 3 + s.x) * 0.04; circ(g, cx, by - 50, 18, '#ffe680'); g.globalAlpha = 1;
      break;
    }
    case 'tree': {
      Art.blit(g, nodeSprite('tree', (s.x + s.y) % 4, false), cx, by - 6);
      break;
    }
    case 'flowerbed': {
      rrect(g, x + 2, y + 6, w - 4, h - 8, 5, '#8a5a32', INK, 1.4);
      for (let i = 0; i < s.w * 3; i++) {
        const fxp = x + 8 + i * ((w - 16) / (s.w * 3 - 1)), col = ['#ff6a8a', '#ffd84a', '#fff', '#b88aff'][i % 4];
        line(g, fxp, y + 16, fxp, y + 8, '#4a8a2e', 1.4);
        circ(g, fxp, y + 7, 3, col, INK, 0.8);
      }
      break;
    }
    case 'board': {
      line(g, x + 8, by, x + 8, y - 6, '#6a4422', 3); line(g, x + 24, by, x + 24, y - 6, '#6a4422', 3);
      rrect(g, x + 1, y - 18, 30, 22, 3, '#c89a5c', INK, 1.5);
      for (const [px, py, c] of [[5, -15, '#fff'], [17, -14, '#ffe9a8'], [8, -6, '#ffd0e0']]) rrect(g, x + px, y + py, 10, 8, 1, c, 'rgba(0,0,0,.3)', 0.6);
      break;
    }
    case 'sign': {
      shadow(g, cx, by - 4, 6, 2.5);
      line(g, cx, by - 4, cx, y - 2, '#6a4422', 3.5);
      rrect(g, x + 2, y - 14, 28, 16, 3, '#c89a5c', INK, 1.5);
      line(g, x + 7, y - 9, x + 25, y - 9, 'rgba(60,30,10,.5)', 1.2); line(g, x + 7, y - 4, x + 20, y - 4, 'rgba(60,30,10,.5)', 1.2);
      break;
    }
    case 'tower': {
      const pal = TOWERS[s.tower].pal;
      const tw = w - 8, th = 230, tx = x + 4, top = by - th;
      shadow(g, cx, by, w * 0.6, 12);
      rrect(g, tx, top, tw, th, 6, pal.wall, INK, 2.4);
      for (let r = 0; r < th / 18; r++) for (let c = 0; c < 5; c++) {
        const bx = tx + 4 + c * (tw - 8) / 5 + (r % 2 ? 10 : 0);
        if (bx > tx + tw - 18) continue;
        rrect(g, bx, top + 6 + r * 18, (tw - 8) / 5 - 3, 14, 2, shade(pal.wall.length === 7 ? pal.wall : '#555555', r % 3 === 0 ? 10 : 0), 'rgba(0,0,0,.18)', 0.8);
      }
      for (let i = 0; i < 6; i++) rrect(g, tx - 4 + i * (tw + 8) / 6, top - 12, (tw + 8) / 6 - 4, 16, 2, pal.wallTop, INK, 1.6);
      for (const wy of [top + 40, top + 100]) {
        rrect(g, cx - 10, wy, 20, 28, 10, '#1a1a2a', INK, 1.6);
        g.globalAlpha = 0.5 + Math.sin(t * 2 + wy) * 0.2; rrect(g, cx - 7, wy + 4, 14, 20, 7, pal.accent); g.globalAlpha = 1;
      }
      const open = st.towerOpen(s.tower);
      g.beginPath(); g.ellipse(cx, by - 30, 20, 26, 0, Math.PI, TAU); g.lineTo(cx + 20, by); g.lineTo(cx - 20, by); g.closePath();
      g.fillStyle = open ? '#1a1418' : '#4a3a2a'; g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
      if (!open) {
        line(g, cx - 18, by - 22, cx + 18, by - 22, '#8a6a4a', 3); line(g, cx, by - 54, cx, by, '#8a6a4a', 3);
        g.fillStyle = '#ffd84a'; g.font = '16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🔒', cx, by - 34);
      }
      if (s.tower === 'forest') {
        g.strokeStyle = '#4e8a32'; g.lineWidth = 3;
        for (const vx of [tx + 8, tx + tw - 12]) { g.beginPath(); g.moveTo(vx, by); for (let k = 0; k < 8; k++) g.lineTo(vx + Math.sin(k * 1.3) * 6, by - k * 22); g.stroke(); }
        for (let k = 0; k < 10; k++) circ(g, tx + 6 + (k * 37 % (tw - 10)), top + 20 + (k * 53 % 180), 5, '#6ab84a');
      } else if (s.tower === 'wind') {
        g.save(); g.translate(cx, top + 18); g.rotate(t * 2.2);
        for (let k = 0; k < 4; k++) { g.rotate(TAU / 4); poly(g, [0, 0, 8, -4, 40, -6, 40, 6, 8, 4], '#f4f0e6', INK, 1.4); }
        g.restore(); circ(g, cx, top + 18, 5, '#8a6a4a', INK, 1.4);
      } else if (s.tower === 'moon') {
        g.fillStyle = '#ffe680'; g.font = '34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('☾', cx, top - 30);
        for (let k = 0; k < 5; k++) { g.globalAlpha = 0.5 + Math.sin(t * 3 + k) * 0.4; g.fillText('·', tx + (k * 41 % tw), top + 30 + (k * 67 % 150)); }
        g.globalAlpha = 1;
      }
      if (st.towerCleared(s.tower)) { g.font = '18px sans-serif'; g.fillText('🏁', cx + tw / 2 + 4, top - 14); }
      break;
    }
    case 'hut': {
      shadow(g, cx, by, w * 0.6, 8);
      rrect(g, x + 2, by - 50, w - 4, 50, 3, '#8a5a32', INK, 2);
      for (let i = 1; i < 5; i++) line(g, x + 4, by - 50 + i * 10, x + w - 4, by - 50 + i * 10, 'rgba(40,20,5,.4)', 1.6);
      poly(g, [x - 8, by - 46, x + w + 8, by - 46, cx, by - 86], '#6a3e1e', INK, 2);
      poly(g, [x - 6, by - 48, x + w + 6, by - 48, cx + 26, by - 66, cx, by - 84, cx - 26, by - 66], '#f4f8ff');
      rrect(g, cx - 10, by - 30, 20, 30, 3, '#5a3418', INK, 1.6);
      rrect(g, x + 8, by - 42, 14, 12, 2, '#ffe9a8', INK, 1.3);
      break;
    }
    case 'fence': {
      for (let i = 0; i <= s.w; i++) rrect(g, x + i * TILE - 4, y - 14, 8, 30, 2, '#8a5a32', INK, 1.4);
      rrect(g, x - 4, y - 8, w + 8, 6, 2, '#a8743f', INK, 1.3);
      rrect(g, x - 4, y + 4, w + 8, 6, 2, '#a8743f', INK, 1.3);
      rrect(g, cx - 18, y - 30, 36, 18, 4, '#fff3d6', INK, 1.4);
      g.fillStyle = '#c8364a'; g.font = 'bold 10px "Hiragino Maru Gothic ProN", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ふぶき', cx, y - 21);
      break;
    }
    case 'tent': {
      shadow(g, cx, by, w * 0.6, 8);
      poly(g, [x - 4, by, x + w + 4, by, cx, by - 64], '#e86a4a', INK, 2);
      for (let i = 1; i < 4; i++) poly(g, [x - 4 + i * (w + 8) / 4 - 6, by, x - 4 + i * (w + 8) / 4 + 6, by, cx, by - 64], i % 2 ? '#fff3e0' : '#e86a4a');
      poly(g, [x - 4, by, x + w + 4, by, cx, by - 64], null, INK, 2);
      poly(g, [cx - 12, by, cx + 12, by, cx, by - 30], '#3a2418', INK, 1.4);
      rrect(g, x + w - 6, by - 16, 22, 16, 2, '#a8743f', INK, 1.4);
      g.font = '12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🧺', x + w + 5, by - 22);
      break;
    }
    case 'campfire': {
      line(g, cx - 12, by - 6, cx + 12, by - 12, '#6a3e1e', 4); line(g, cx - 12, by - 12, cx + 12, by - 6, '#6a3e1e', 4);
      for (let i = 0; i < 3; i++) {
        const k = Math.sin(t * 11 + i * 2) * 2;
        poly(g, [cx - 8 + i * 5, by - 10, cx - 4 + i * 5 + k, by - 30 + i * 3 - Math.abs(k) * 2, cx + i * 5, by - 10], i === 1 ? '#ffd84a' : '#ff8a3a');
      }
      g.globalAlpha = 0.15; circ(g, cx, by - 16, 30, '#ffb84a'); g.globalAlpha = 1;
      break;
    }
    case 'stakes': {
      const built = st.flags.bridge;
      for (const sy of [s.y, s.y + s.h]) {
        rrect(g, x + 10, sy * TILE - 18, 10, 26, 2, '#8a5a32', INK, 1.4);
        if (built) { rrect(g, x + 10 + 10 * TILE + 4, sy * TILE - 18, 10, 26, 2, '#8a5a32', INK, 1.4); }
      }
      if (!built) {
        g.globalAlpha = 0.5 + Math.sin(t * 4) * 0.3;
        g.fillStyle = '#fff'; g.font = '16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🪵', x + 52, y + 46);
        g.globalAlpha = 1;
      }
      break;
    }
    case 'warp': {
      const on = st.flags.warps && st.flags.warps[s.id];
      shadow(g, cx, by - 4, 11, 4);
      poly(g, [cx - 9, by - 4, cx + 9, by - 4, cx + 7, by - 40, cx, by - 46, cx - 7, by - 40], '#a8a4b8', INK, 1.6);
      g.fillStyle = on ? '#7af0ff' : '#6a6878'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✦', cx, by - 24);
      if (on) { g.globalAlpha = 0.25 + Math.sin(t * 3) * 0.1; circ(g, cx, by - 24, 14, '#7af0ff'); g.globalAlpha = 1; }
      break;
    }
    case 'chest': {
      const open = st.chestOpened(s.id);
      shadow(g, cx, by - 4, 13, 4);
      rrect(g, cx - 13, by - 22, 26, 18, 3, '#b8743a', INK, 1.6);
      line(g, cx - 13, by - 14, cx + 13, by - 14, '#ffd84a', 2);
      if (open) {
        poly(g, [cx - 13, by - 22, cx + 13, by - 22, cx + 11, by - 34, cx - 11, by - 34], '#9a5a2a', INK, 1.6);
        rrect(g, cx - 10, by - 23, 20, 4, 1, '#2a1a10');
      } else {
        rrect(g, cx - 13, by - 30, 26, 10, 5, '#c8843a', INK, 1.6);
        rrect(g, cx - 3, by - 22, 6, 7, 1, '#ffd84a', INK, 1);
        g.globalAlpha = 0.4 + Math.sin(t * 4 + s.x) * 0.3; g.fillStyle = '#fff'; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText('✦', cx + 14, by - 32); g.globalAlpha = 1;
      }
      break;
    }
    case 'stairsDown': {
      for (let i = 0; i < 4; i++) rrect(g, x + 2 + i * 2, y + 4 + i * 6, TILE - 4 - i * 4, 6, 1, shade('#7a7a8a', -i * 22), 'rgba(0,0,0,.4)', 0.8);
      g.fillStyle = '#fff'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('▼', cx, y + 2);
      break;
    }
    case 'stairsUp': {
      const open = st.stairsOpen();
      rrect(g, x - 4, y - 8, TILE + 8, TILE + 8, 8, '#14101c', INK, 2);
      for (let i = 0; i < 4; i++) rrect(g, x + 2 + i * 2, y + 18 - i * 6, TILE - 4 - i * 4, 5, 1, shade('#9a9aaa', -i * 18), 'rgba(0,0,0,.4)', 0.8);
      if (!open) {
        for (let i = 0; i < 4; i++) line(g, x + 2 + i * 9, y - 6, x + 2 + i * 9, y + TILE, '#8a8a9a', 3);
      } else {
        g.globalAlpha = 0.35 + Math.sin(t * 4) * 0.2; rrect(g, x - 4, y - 8, TILE + 8, TILE + 8, 8, '#ffe680'); g.globalAlpha = 1;
        g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('▲', cx, y - 12);
      }
      break;
    }
    case 'torch': {
      rrect(g, cx - 3, y + 12, 6, 12, 2, '#6a4422', INK, 1);
      const k = Math.sin(t * 13 + s.x) * 1.5;
      poly(g, [cx - 5, y + 13, cx + k, y - 2, cx + 5, y + 13], '#ff9a3a'); poly(g, [cx - 2.5, y + 13, cx + k * 0.5, y + 4, cx + 2.5, y + 13], '#ffe680');
      g.globalAlpha = 0.12; circ(g, cx, y + 8, 26, '#ffb84a'); g.globalAlpha = 1;
      break;
    }
    case 'exit': {
      const k = t * 1.5;
      g.save(); g.translate(cx, y + 16); g.scale(1, 0.5);
      for (let i = 0; i < 3; i++) { g.globalAlpha = 0.6 - i * 0.15; circ(g, 0, 0, 22 + i * 7, null, '#9ff0ff', 2.5); }
      g.rotate(k); g.globalAlpha = 0.8; g.fillStyle = '#e8fbff';
      for (let i = 0; i < 6; i++) { g.rotate(TAU / 6); g.fillRect(16, -1.5, 8, 3); }
      g.restore(); g.globalAlpha = 1;
      break;
    }
  }
}

/* ============================= 地面 (焼きこみ) ============================= */
const GROUND = {
  [T.GRASS]: '#7cc35a', [T.FOREST]: '#72b453', [T.MEADOW]: '#86c95e', [T.PATH]: '#d8b47c', [T.TOWN]: '#92cf68',
  [T.ROCKY]: '#c8b898', [T.SNOW]: '#eef4fb', [T.VALLEY]: '#4f9a82', [T.MOON]: '#7a6aa8', [T.SAND]: '#ecd9a6',
  [T.FIELD]: '#9a7448', [T.BRIDGE]: '#b8844a', [T.COBBLE]: '#d8ccb8', [T.WATER]: '#4aa6dc', [T.CLIFF]: '#8a7a68',
  [T.SNOWCLIFF]: '#c8d4e4', [T.CHASM]: '#1a1424', [T.DENSE]: '#3e7a34', [T.FLOOR]: '#8a7a5c', [T.WALL]: '#4d5e3a',
};

const SOFT_GROUND = new Set([T.GRASS, T.FOREST, T.MEADOW, T.TOWN, T.VALLEY, T.MOON, T.SAND, T.ROCKY, T.SNOW, T.FIELD]);

function bakeTile(g, m, tx, ty, px, py, pal) {
  const t = m.tiles[ty * m.w + tx];
  const h = hash2(tx, ty, 3), h2 = hash2(tx, ty, 11);
  const at = (dx, dy) => World.tileAt(m, tx + dx, ty + dy);
  const S = TILE;
  const moonSide = m.kind === 'over' && tx >= 164;
  let base = GROUND[t];
  if (t === T.FLOOR && pal) base = (tx + ty) % 2 ? pal.floor : pal.floor2;
  if (t === T.WALL && pal) base = pal.wallTop;
  if (t === T.DENSE && moonSide) base = '#3a3058';
  g.fillStyle = base;
  g.fillRect(px, py, S, S);
  const n = World.noise ? World.noise(tx * 0.25, ty * 0.25) : 0.5;
  if (t < 20 && ![T.COBBLE, T.FLOOR, T.BRIDGE, T.SNOW, T.SAND, T.PATH].includes(t)) {
    g.fillStyle = n > 0.5 ? `rgba(255,255,255,${(n - 0.5) * 0.18})` : `rgba(0,0,0,${(0.5 - n) * 0.14})`;
    g.fillRect(px, py, S, S);
  }
  /* 崖や壁の下には影が落ちる */
  if (t < 20) {
    const up = at(0, -1);
    if (up === T.CLIFF || up === T.SNOWCLIFF || up === T.WALL || up === T.DENSE) {
      const grd = g.createLinearGradient(0, py, 0, py + 12);
      grd.addColorStop(0, 'rgba(30,20,10,.28)'); grd.addColorStop(1, 'rgba(30,20,10,0)');
      g.fillStyle = grd; g.fillRect(px, py, S, 12);
    }
  }
  /* 草地どうしの境目は、となりの色を少しにじませる */
  if (SOFT_GROUND.has(t)) {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const o = at(dx, dy);
      if (o === t || !SOFT_GROUND.has(o)) continue;
      const x0 = dx > 0 ? px + S : px, y0 = dy > 0 ? py + S : py;
      const grd = dx ? g.createLinearGradient(x0, 0, x0 - dx * 18, 0) : g.createLinearGradient(0, y0, 0, y0 - dy * 18);
      grd.addColorStop(0, GROUND[o] + '99'); grd.addColorStop(1, GROUND[o] + '00');
      g.fillStyle = grd; g.fillRect(px, py, S, S);
    }
  }
  switch (t) {
    case T.GRASS: case T.MEADOW: case T.TOWN: case T.FOREST: case T.VALLEY: case T.MOON: {
      const dark = t === T.FOREST ? '#4e9038' : t === T.VALLEY ? '#3e8070' : t === T.MOON ? '#64569a' : '#6aae4a';
      for (let i = 0; i < 3; i++) {
        const gx = px + hash2(tx, ty, 20 + i) * 28 + 2, gy = py + hash2(tx, ty, 30 + i) * 26 + 4;
        line(g, gx, gy, gx - 1.5, gy - 4, dark, 1.3); line(g, gx, gy, gx + 1.5, gy - 4, dark, 1.3);
      }
      if (t === T.MEADOW && h < 0.3) circ(g, px + h2 * 26 + 3, py + h * 80 % 26 + 3, 2, ['#ffffff', '#ffe06a', '#ff9ac0', '#c8a0ff'][Math.floor(h2 * 4)]);
      if (t === T.FOREST && h < 0.18) ell(g, px + h2 * 24 + 4, py + 16, 3, 1.6, '#a8743f');
      if (t === T.MOON && h < 0.2) circ(g, px + h2 * 26 + 3, py + (h * 97 % 1) * 26 + 3, 1.3, '#e8e0ff');
      if (t === T.VALLEY && h < 0.12) circ(g, px + h2 * 26 + 3, py + 20, 1.5, '#b8f0e0');
      break;
    }
    case T.PATH: {
      for (let i = 0; i < 3; i++) circ(g, px + hash2(tx, ty, 40 + i) * 28 + 2, py + hash2(tx, ty, 50 + i) * 28 + 2, 1.4, 'rgba(120,80,40,.35)');
      const edge = (dx, dy) => { const o = at(dx, dy); return o !== T.PATH && o !== T.COBBLE && o !== T.BRIDGE; };
      g.fillStyle = 'rgba(120,170,80,.45)';
      if (edge(0, -1)) g.fillRect(px, py, S, 3);
      if (edge(0, 1)) g.fillRect(px, py + S - 3, S, 3);
      if (edge(-1, 0)) g.fillRect(px, py, 3, S);
      if (edge(1, 0)) g.fillRect(px + S - 3, py, 3, S);
      break;
    }
    case T.COBBLE: {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        const o = (r + ty) % 2 ? 8 : 0;
        rrect(g, px + c * 16 + 1 - o * (c ? 0 : 0.5) + (o ? 4 : 0), py + r * 16 + 1, 14 - (o ? 4 : 0), 14, 4, (hash2(tx * 2 + c, ty * 2 + r, 7) > 0.5 ? '#e2d6c2' : '#d2c4ae'), 'rgba(120,100,80,.35)', 1);
      }
      break;
    }
    case T.ROCKY: {
      if (h < 0.3) { g.strokeStyle = 'rgba(70,55,40,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px + 6, py + 10); g.lineTo(px + 14, py + 16); g.lineTo(px + 12, py + 24); g.stroke(); }
      for (let i = 0; i < 2; i++) circ(g, px + hash2(tx, ty, 60 + i) * 28 + 2, py + hash2(tx, ty, 70 + i) * 28 + 2, 1.8, 'rgba(90,80,70,.4)');
      break;
    }
    case T.SNOW: {
      if (h < 0.4) ell(g, px + h2 * 24 + 4, py + 14, 6, 2, 'rgba(160,190,230,.25)');
      if (h2 < 0.15) circ(g, px + h * 28 + 2, py + 8, 1, '#fff');
      break;
    }
    case T.SAND: {
      for (let i = 0; i < 3; i++) circ(g, px + hash2(tx, ty, 80 + i) * 28 + 2, py + hash2(tx, ty, 90 + i) * 28 + 2, 1, 'rgba(160,130,80,.5)');
      break;
    }
    case T.FIELD: {
      g.fillStyle = 'rgba(70,45,20,.35)';
      for (let i = 0; i < 4; i++) g.fillRect(px, py + 3 + i * 8, S, 2.5);
      break;
    }
    case T.BRIDGE: {
      for (let i = 0; i < 4; i++) rrect(g, px + i * 8 + 0.5, py, 7, S, 1.5, i % 2 ? '#c08a52' : '#b07a42', 'rgba(60,30,10,.5)', 0.8);
      if (at(0, -1) !== T.BRIDGE) { line(g, px, py + 2, px + S, py + 2, '#e8d0a0', 2.5); }
      if (at(0, 1) !== T.BRIDGE) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(px, py + S - 4, S, 4); line(g, px, py + S - 3, px + S, py + S - 3, '#e8d0a0', 2.5); }
      break;
    }
    case T.FLOOR: {
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, S - 1, S - 1);
      if (h < 0.15) { g.strokeStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.moveTo(px + 8, py + 6); g.lineTo(px + 16, py + 14); g.stroke(); }
      if (pal && h2 < 0.08) circ(g, px + 16, py + 16, 2, pal.accent);
      break;
    }
    case T.WATER: {
      const deep = [[0, -1], [0, 1], [-1, 0], [1, 0]].every(([dx, dy]) => at(dx, dy) === T.WATER);
      if (deep) { g.fillStyle = 'rgba(20,70,140,.18)'; g.fillRect(px, py, S, S); }
      /* 岸のかどを丸める */
      for (const [dx, dy, cx0, cy0, a0] of [[-1, -1, px, py, 0], [1, -1, px + S, py, Math.PI / 2], [1, 1, px + S, py + S, Math.PI], [-1, 1, px, py + S, Math.PI * 1.5]]) {
        const ox = at(dx, 0), oy = at(0, dy);
        if (ox === T.WATER || oy === T.WATER) continue;
        const land = GROUND[oy] || GROUND[T.SAND];
        g.fillStyle = land;
        g.beginPath(); g.moveTo(cx0, cy0);
        g.arc(cx0 - dx * 12, cy0 - dy * 12, 12, a0 + Math.PI, a0 + Math.PI * 1.5, false);
        g.closePath(); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,.55)';
      if (at(0, -1) !== T.WATER) g.fillRect(px, py, S, 3);
      if (at(-1, 0) !== T.WATER) g.fillRect(px, py, 2, S);
      if (at(1, 0) !== T.WATER) g.fillRect(px + S - 2, py, 2, S);
      if (at(0, 1) !== T.WATER) g.fillRect(px, py + S - 2, S, 2);
      break;
    }
    case T.CLIFF: case T.SNOWCLIFF: case T.WALL: {
      const below = at(0, 1);
      const face = below < 20 || below === T.WATER;
      const snow = t === T.SNOWCLIFF;
      if (t === T.WALL) {
        g.fillStyle = pal ? pal.wallTop : '#555'; g.fillRect(px, py, S, S);
        g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(px + 3, py + 3, S - 6, S - 6);
      } else {
        /* 岩山のてっぺん: ごつごつした岩のかたまり */
        g.fillStyle = snow ? '#c9d6e8' : '#6e5e4c'; g.fillRect(px, py, S, S);
        for (let i = 0; i < 3; i++) {
          const r = 7 + hash2(tx, ty, 130 + i) * 4;
          const bx = px + r + hash2(tx, ty, 100 + i) * (S - r * 2), by = py + r + hash2(tx, ty, 110 + i) * (S - r * 2);
          ell(g, bx, by + 1.5, r, r * 0.8, snow ? '#a8b8d0' : '#5a4a3a');
          ell(g, bx, by, r, r * 0.78, snow ? '#f2f7ff' : '#9a8670');
          ell(g, bx - r * 0.3, by - r * 0.3, r * 0.45, r * 0.3, snow ? '#ffffff' : '#b4a088');
        }
        if (!snow && h < 0.3) { line(g, px + 8 + h * 30, py + 26, px + 6 + h * 30, py + 21, '#6a9a4a', 1.6); line(g, px + 8 + h * 30, py + 26, px + 11 + h * 30, py + 22, '#6a9a4a', 1.6); }
      }
      if (face) {
        const fh = t === T.WALL ? S : 24;
        const fcol = t === T.WALL ? (pal ? pal.wall : '#333') : snow ? '#8a9ab4' : '#54443a';
        g.fillStyle = fcol; g.fillRect(px, py + S - fh, S, fh);
        if (t === T.WALL) {
          g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
          for (let r = 0; r < 4; r++) {
            g.beginPath(); g.moveTo(px, py + r * 8); g.lineTo(px + S, py + r * 8); g.stroke();
            const o = (r + tx) % 2 ? 8 : 0;
            for (let c = o; c < S; c += 16) { g.beginPath(); g.moveTo(px + c, py + r * 8); g.lineTo(px + c, py + r * 8 + 8); g.stroke(); }
          }
        } else {
          g.fillStyle = 'rgba(255,255,255,.12)';
          for (let i = 0; i < 3; i++) { const lx = px + 3 + hash2(tx, ty, 120 + i) * 22; g.fillRect(lx, py + S - fh + 3, 4, fh - 6); }
          g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2;
          for (let i = 0; i < 3; i++) { const lx = px + 4 + hash2(tx, ty, 140 + i) * 24; g.beginPath(); g.moveTo(lx, py + S - fh + 4); g.lineTo(lx - 2, py + S - 2); g.stroke(); }
          g.fillStyle = snow ? '#ffffff' : '#a8947a'; g.fillRect(px, py + S - fh - 1, S, 3);
        }
      }
      break;
    }
    case T.CHASM: {
      const up = at(0, -1);
      g.fillStyle = '#0e0a16'; g.fillRect(px, py, S, S);
      if (up !== T.CHASM && up !== T.BRIDGE) {
        const grd = g.createLinearGradient(0, py, 0, py + S);
        grd.addColorStop(0, '#5a4a48'); grd.addColorStop(0.5, '#2a2030'); grd.addColorStop(1, '#0e0a16');
        g.fillStyle = grd; g.fillRect(px, py, S, S);
      }
      for (const [dx, x0] of [[-1, 0], [1, S - 6]]) {
        const o = at(dx, 0);
        if (o !== T.CHASM && o !== T.BRIDGE) { g.fillStyle = 'rgba(90,70,70,.7)'; g.fillRect(px + x0, py, 6, S); }
      }
      if (h < 0.1) { g.globalAlpha = 0.25; ell(g, px + 16, py + 16, 14, 4, '#8a7aa8'); g.globalAlpha = 1; }
      break;
    }
    case T.DENSE: {
      const c1 = moonSide ? '#4a3a6a' : '#2e6a2a', c2 = moonSide ? '#5a4a7e' : '#3a7e34';
      circ(g, px + 8 + h * 6, py + 12, 11, c1); circ(g, px + 22 - h2 * 4, py + 20, 12, c1);
      circ(g, px + 10 + h * 4, py + 9, 6, c2); circ(g, px + 21, py + 16, 6, c2);
      break;
    }
  }
}
