/* =========================================================================
   PHANTOM DUEL ― すがたを描く
   真上から見た絵。見えるのはほとんど頭の上面で、肩と手だけがそのまわりから
   のぞく。ローカル座標では前方が +X。
   ========================================================================= */
'use strict';

function rrect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry, rot) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
}

function shadowBlob(ctx, x, y, rx, ry, a) {
  ctx.save();
  ctx.globalAlpha = a == null ? 0.28 : a;
  ctx.fillStyle = '#000';
  ellipse(ctx, x, y + ry * 0.5, rx, ry, 0);
  ctx.fill();
  ctx.restore();
}

/* =========================================================================
   幻影
   o = { scale, punchL, punchR, charge, alpha, flash, stopped }
   ========================================================================= */
function drawGhost(ctx, c, x, y, dir, t, o) {
  o = o || {};
  const s = o.scale == null ? 1 : o.scale;
  ctx.save();
  ctx.translate(x, y);
  shadowBlob(ctx, 0, 8 * s, 26 * s, 11 * s, 0.24);

  if (o.aura !== false) {
    const g = ctx.createRadialGradient(0, 0, 5 * s, 0, 0, 46 * s);
    g.addColorStop(0, rgba(c.colors.glow, 0.28));
    g.addColorStop(1, rgba(c.colors.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 46 * s, 0, Math.PI * 2); ctx.fill();
  }

  ctx.rotate(dir);
  ctx.scale(s, s);
  ctx.globalAlpha = o.alpha == null ? 0.95 : o.alpha;
  if (c.preset === 'moot') drawMoot(ctx, c, t, o);
  else if (c.preset === 'cat') drawCat(ctx, c, t, o);
  else drawCustomGhost(ctx, c, t, o);

  if (o.flash > 0) {
    ctx.globalAlpha = Math.min(0.75, o.flash);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(2, 0, 22, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  /* 溜めのリング */
  if (o.charge > 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = rgba(c.colors.glow, 0.9);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * s, 0, Math.PI * 2 * clamp(o.charge, 0, 1));
    ctx.stroke();
    ctx.restore();
  }
}

/* -------------------------------------------------------------------------
   共通の下ごしらえ
   ------------------------------------------------------------------------- */

/** 肩と背中。頭のうしろから少しだけのぞく。 */
function drawShoulders(ctx, main, rx, ry) {
  const g = ctx.createLinearGradient(0, -ry, 0, ry);
  g.addColorStop(0, shade(main, 0.10));
  g.addColorStop(1, shade(main, -0.22));
  ctx.fillStyle = g;
  ellipse(ctx, -10, 0, rx, ry, 0); ctx.fill();
  ctx.strokeStyle = shade(main, -0.45); ctx.lineWidth = 2; ctx.stroke();
}

/** 猫の耳。頭より先に描いて、頭の輪郭から張り出させる。 */
function drawCatEars(ctx, main, glow, hx, spread) {
  [-1, 1].forEach((sg) => {
    ctx.beginPath();
    ctx.moveTo(hx + 6, sg * 10);
    ctx.lineTo(hx - 2, sg * (28 + spread));
    ctx.lineTo(hx - 13, sg * 12);
    ctx.closePath();
    ctx.fillStyle = shade(main, 0.02); ctx.fill();
    ctx.strokeStyle = shade(main, -0.46); ctx.lineWidth = 1.8; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx + 3, sg * 13);
    ctx.lineTo(hx - 2, sg * (23 + spread * 0.6));
    ctx.lineTo(hx - 8, sg * 14);
    ctx.closePath();
    ctx.fillStyle = '#e8909c'; ctx.fill();
  });
}

/** ひげと鼻先。頭のふちから前にだけのぞく。 */
function drawCatFace(ctx, main, hx, hr) {
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.3;
  [-1, 1].forEach((sg) => {
    ctx.beginPath(); ctx.moveTo(hx + 12, sg * 6); ctx.lineTo(hx + 30, sg * 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + 13, sg * 7); ctx.lineTo(hx + 32, sg * 4); ctx.stroke();
  });
  ctx.fillStyle = shade(main, 0.3);
  ellipse(ctx, hx + hr - 3, 0, 6, 7, 0); ctx.fill();
  ctx.fillStyle = '#e8909c';
  ctx.beginPath();
  ctx.moveTo(hx + hr - 1, -2.6); ctx.lineTo(hx + hr - 1, 2.6); ctx.lineTo(hx + hr + 3, 0);
  ctx.closePath(); ctx.fill();
}

/** 頭の上面。いちばん大きく、いちばん上に描く。 */
function drawSkull(ctx, main, hx, r) {
  const g = ctx.createRadialGradient(hx + r * 0.3, -r * 0.35, r * 0.15, hx, 0, r * 1.15);
  g.addColorStop(0, shade(main, 0.26));
  g.addColorStop(1, shade(main, -0.14));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(hx, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = shade(main, -0.46); ctx.lineWidth = 2; ctx.stroke();
}

/* ------------------------------ ムートくん ------------------------------ */
function drawMoot(ctx, c, t, o) {
  const main = c.colors.main, sub = c.colors.sub, glow = c.colors.glow;
  const pL = o.punchL || 0, pR = o.punchR || 0;
  const tw = o.stopped ? 0.5 : Math.sin(t * 2.6);

  /* しっぽ。うしろにだけ見える。 */
  ctx.lineCap = 'round';
  ctx.strokeStyle = shade(main, -0.12);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.quadraticCurveTo(-36, 8 + tw * 10, -46, 22 + tw * 14);
  ctx.stroke();
  ctx.strokeStyle = sub;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-42, 17 + tw * 11);
  ctx.lineTo(-46, 22 + tw * 14);
  ctx.stroke();

  /* 肩と背中 */
  drawShoulders(ctx, main, 17, 23);
  ctx.fillStyle = rgba(sub, 0.22);
  ellipse(ctx, -16, 0, 9, 15, 0); ctx.fill();

  /* うで。上から見ると肩から手がのぞくだけ。 */
  drawMootArm(ctx, -1, pL, main, sub, glow);
  drawMootArm(ctx, 1, pR, main, sub, glow);

  /* あたま */
  const hx = 4, hr = 20;
  /* 耳（頭のうしろ寄りの左右） */
  [-1, 1].forEach((sg) => {
    ctx.beginPath();
    ctx.moveTo(hx - 2, sg * 15);
    ctx.lineTo(hx - 14, sg * 26);
    ctx.lineTo(hx - 15, sg * 9);
    ctx.closePath();
    ctx.fillStyle = shade(main, -0.02); ctx.fill();
    ctx.strokeStyle = shade(main, -0.46); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx - 5, sg * 15);
    ctx.lineTo(hx - 12, sg * 22);
    ctx.lineTo(hx - 12, sg * 12);
    ctx.closePath();
    ctx.fillStyle = '#e8909c'; ctx.fill();
  });

  drawSkull(ctx, main, hx, hr);

  /* かぶと。頭の前半分をおおって、まん中に稜線が走る。 */
  ctx.fillStyle = sub;
  ctx.beginPath();
  ctx.arc(hx, 0, hr, -1.65, 1.65);
  ctx.lineTo(hx - 4, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(sub, -0.35); ctx.lineWidth = 1.6; ctx.stroke();
  ctx.strokeStyle = shade(sub, 0.35); ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx + hr - 2, 0); ctx.lineTo(hx - hr * 0.5, 0);
  ctx.stroke();

  /* つの。前へ突き出す。 */
  [-1, 1].forEach((sg) => {
    ctx.beginPath();
    ctx.moveTo(hx + 8, sg * 15);
    ctx.lineTo(hx + 30, sg * 24);
    ctx.lineTo(hx + 15, sg * 5);
    ctx.closePath();
    ctx.fillStyle = shade(sub, 0.24); ctx.fill();
    ctx.strokeStyle = shade(sub, -0.3); ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx + 25, sg * 21);
    ctx.lineTo(hx + 30, sg * 24);
    ctx.lineTo(hx + 24, sg * 17);
    ctx.closePath();
    ctx.fillStyle = glow; ctx.fill();
  });

}

function drawMootArm(ctx, sg, punch, main, sub, glow) {
  const ax = 8 + punch * 28;
  const ay = sg * (22 - punch * 4);
  ctx.strokeStyle = shade(main, -0.1);
  ctx.lineCap = 'round';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(-8, sg * 17);
  ctx.lineTo(ax, ay);
  ctx.stroke();
  const fg = ctx.createRadialGradient(ax + 3, ay - 3, 1, ax, ay, 12);
  fg.addColorStop(0, shade(sub, 0.4));
  fg.addColorStop(1, shade(sub, -0.12));
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(ax, ay, 11, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = shade(sub, -0.42); ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = shade(sub, -0.28); ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(ax + 3, ay - 7); ctx.lineTo(ax + 6, ay + 2);
  ctx.stroke();
  if (punch > 0.05) {
    ctx.strokeStyle = rgba(glow, 0.55 * punch);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ax, ay, 13 + punch * 3, 0, Math.PI * 2); ctx.stroke();
  }
}

/* ------------------------------ 猫（ニャワールド） ------------------------------ */
function drawCat(ctx, c, t, o) {
  const main = c.colors.main, sub = c.colors.sub, glow = c.colors.glow;
  const pL = o.punchL || 0, pR = o.punchR || 0;
  const stopped = !!o.stopped;
  const tw = stopped ? 0.6 : Math.sin(t * 2.4);

  /* しっぽ */
  ctx.lineCap = 'round';
  ctx.strokeStyle = shade(main, -0.12);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-20, 2);
  ctx.quadraticCurveTo(-38, 10 + tw * 10, -48, 26 + tw * 14);
  ctx.stroke();
  ctx.strokeStyle = sub;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-45, 21 + tw * 11);
  ctx.lineTo(-48, 26 + tw * 14);
  ctx.stroke();

  /* 肩と背中。ここに時計が見える。 */
  drawShoulders(ctx, main, 15, 20);
  const cx = -14;
  ctx.fillStyle = rgba(sub, 0.9);
  ctx.beginPath(); ctx.arc(cx, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = glow; ctx.lineWidth = 1.5; ctx.stroke();
  const hand = stopped ? 0.9 : t * 1.6;
  ctx.strokeStyle = glow; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, 0); ctx.lineTo(cx + Math.cos(hand) * 6, Math.sin(hand) * 6);
  ctx.stroke();
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(cx, 0); ctx.lineTo(cx + Math.cos(hand * 0.35) * 8, Math.sin(hand * 0.35) * 8);
  ctx.stroke();

  /* まえ足 */
  drawCatPaw(ctx, -1, pL, main, sub, glow);
  drawCatPaw(ctx, 1, pR, main, sub, glow);

  /* あたま */
  const hx = 5, hr = 18;
  drawCatEars(ctx, main, glow, hx, 2);
  drawSkull(ctx, main, hx, hr);

  /* ひたいの模様 */
  ctx.strokeStyle = rgba(sub, 0.5); ctx.lineWidth = 3;
  [-6, 0, 6].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(hx - 10, y); ctx.lineTo(hx - 2, y);
    ctx.stroke();
  });

  drawCatFace(ctx, main, hx, hr);

  /* め */
  ctx.fillStyle = glow;
  [-6.5, 6.5].forEach((ey) => { ellipse(ctx, hx + 5, ey, 4.4, 2.6, 0); ctx.fill(); });
  ctx.fillStyle = '#20242e';
  [-6.5, 6.5].forEach((ey) => { ellipse(ctx, hx + 5, ey, 1.3, 2.4, 0); ctx.fill(); });
}

function drawCatPaw(ctx, sg, punch, main, sub, glow) {
  const ax = 8 + punch * 26;
  const ay = sg * (20 - punch * 3);
  ctx.strokeStyle = shade(main, -0.1);
  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-8, sg * 15);
  ctx.lineTo(ax, ay);
  ctx.stroke();
  const fg = ctx.createRadialGradient(ax + 2, ay - 2, 1, ax, ay, 9);
  fg.addColorStop(0, shade(sub, 0.44));
  fg.addColorStop(1, shade(sub, -0.08));
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(ax, ay, 8.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = shade(sub, -0.4); ctx.lineWidth = 1.8; ctx.stroke();
  ctx.fillStyle = rgba(glow, 0.85);
  ctx.beginPath(); ctx.arc(ax + 2, ay, 2.8, 0, Math.PI * 2); ctx.fill();
  [-1, 0, 1].forEach((i) => {
    ctx.beginPath(); ctx.arc(ax + 5 - Math.abs(i), ay + i * 3.4, 1.4, 0, Math.PI * 2); ctx.fill();
  });
  if (punch > 0.05) {
    ctx.strokeStyle = rgba(glow, 0.55 * punch);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ax, ay, 11 + punch * 3, 0, Math.PI * 2); ctx.stroke();
  }
}

/* ------------------------------ 自作の幻影 ------------------------------ */
function drawCustomGhost(ctx, c, t, o) {
  const p = c.parts, main = c.colors.main, sub = c.colors.sub, glow = c.colors.glow;
  const pL = o.punchL || 0, pR = o.punchR || 0;

  drawLower(ctx, p.lower, t, main, sub, glow, o.stopped);
  drawBack(ctx, p.body, t, main, sub, glow);
  drawMark(ctx, p.mark, main, sub, glow);
  drawShoulderDeco(ctx, p.shoulder, main, sub, glow);
  drawArm(ctx, p.arm, -1, pL, main, sub, glow);
  drawArm(ctx, p.arm, 1, pR, main, sub, glow);
  drawHead(ctx, p.head, p.eyes, t, main, sub, glow);
}

/** うしろ足と、しっぽ。しっぽの形は「した」のパーツで変わる。 */
function drawLower(ctx, id, t, main, sub, glow, stopped) {
  const w = stopped ? 0.5 : Math.sin(t * 2.6);
  ctx.lineCap = 'round';

  if (id === 'legs') {
    /* みじかい尾 */
    ctx.strokeStyle = shade(main, -0.1); ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-18, 2);
    ctx.quadraticCurveTo(-30, 8 + w * 6, -34, 18 + w * 8);
    ctx.stroke();
    ctx.fillStyle = shade(main, 0.1);
    ctx.beginPath(); ctx.arc(-34, 18 + w * 8, 5.5, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'tail') {
    /* ながい尾 */
    ctx.strokeStyle = shade(main, -0.1); ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-18, 2);
    ctx.quadraticCurveTo(-38, 10 + w * 10, -50, 28 + w * 14);
    ctx.stroke();
    ctx.strokeStyle = sub; ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-47, 23 + w * 11);
    ctx.lineTo(-50, 28 + w * 14);
    ctx.stroke();
  } else if (id === 'mist') {
    /* 霧の尾 */
    ctx.fillStyle = rgba(glow, 0.22);
    for (let i = 0; i < 4; i++) {
      const a = t * 1.4 + i * 1.7;
      ctx.beginPath();
      ctx.arc(-22 - i * 8 + Math.sin(a) * 4, 6 + i * 5 + Math.cos(a) * 5, 12 - i * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    /* 輪の尾 */
    ctx.strokeStyle = shade(main, -0.1); ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-18, 2);
    ctx.lineTo(-28, 12);
    ctx.stroke();
    ctx.strokeStyle = sub; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(-36, 20, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba(glow, 0.85); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-36, 20, 12, t * 3, t * 3 + 2.2); ctx.stroke();
  }

  /* うしろ足 */
  ctx.fillStyle = shade(main, -0.24);
  ellipse(ctx, -22, -14, 9, 7, -0.4); ctx.fill();
  ellipse(ctx, -22, 14, 9, 7, 0.4); ctx.fill();
}

/** 肩と背中。どうのパーツで表情を変える。 */
function drawBack(ctx, id, t, main, sub, glow) {
  if (id === 'coat') {
    ctx.fillStyle = shade(sub, -0.08);
    ellipse(ctx, -14, 0, 24, 27, 0); ctx.fill();
    ctx.strokeStyle = shade(sub, -0.4); ctx.lineWidth = 1.6; ctx.stroke();
  }
  drawShoulders(ctx, main, id === 'armor' ? 18 : 16, id === 'armor' ? 24 : 22);

  if (id === 'armor') {
    ctx.strokeStyle = rgba(sub, 0.85); ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-2, -18); ctx.lineTo(-16, 0); ctx.lineTo(-2, 18);
    ctx.stroke();
  } else if (id === 'ribs') {
    ctx.strokeStyle = rgba(sub, 0.85); ctx.lineWidth = 2.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-12 - i * 5, 0, 15 - i * 3, -1.15, 1.15);
      ctx.stroke();
    }
  } else if (id === 'core') {
    const pulse = 0.6 + Math.sin(t * 4) * 0.25;
    const g = ctx.createRadialGradient(-10, 0, 1, -10, 0, 13);
    g.addColorStop(0, rgba(glow, 0.95));
    g.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(-10, 0, 12 * pulse + 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(-10, 0, 5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawShoulderDeco(ctx, id, main, sub, glow) {
  if (id === 'bare') return;
  [-1, 1].forEach((sg) => {
    ctx.save();
    ctx.translate(-8, sg * 20);
    if (id === 'pad') {
      ctx.fillStyle = shade(sub, 0.1);
      rrect(ctx, -10, -7, 20, 14, 6); ctx.fill();
      ctx.strokeStyle = shade(sub, -0.35); ctx.lineWidth = 1.6; ctx.stroke();
    } else if (id === 'spike') {
      ctx.fillStyle = shade(sub, 0.15);
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.lineTo(6, sg * -2); ctx.lineTo(2, sg * 14); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(sub, -0.3); ctx.lineWidth = 1.4; ctx.stroke();
    } else if (id === 'ring') {
      ctx.strokeStyle = glow; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
    } else if (id === 'wing') {
      ctx.fillStyle = rgba(glow, 0.45);
      ctx.beginPath();
      ctx.moveTo(2, 0); ctx.lineTo(-24, sg * 8); ctx.lineTo(-14, sg * 24); ctx.lineTo(0, sg * 6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(glow, 0.85); ctx.lineWidth = 1.4; ctx.stroke();
    }
    ctx.restore();
  });
}

function drawArm(ctx, id, sg, punch, main, sub, glow) {
  const ax = 8 + punch * 28;
  const ay = sg * (21 - punch * 4);
  ctx.lineCap = 'round';
  ctx.strokeStyle = shade(main, -0.12);
  ctx.lineWidth = id === 'slim' ? 7 : 11;
  ctx.beginPath(); ctx.moveTo(-8, sg * 16); ctx.lineTo(ax, ay); ctx.stroke();

  ctx.save();
  ctx.translate(ax, ay);
  if (id === 'fist') {
    ctx.fillStyle = shade(sub, 0.2);
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(sub, -0.35); ctx.lineWidth = 1.8; ctx.stroke();
  } else if (id === 'claw') {
    ctx.fillStyle = shade(sub, 0.15);
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = glow;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(3, i * 4.5 - 2); ctx.lineTo(17, i * 7); ctx.lineTo(3, i * 4.5 + 2);
      ctx.closePath(); ctx.fill();
    }
  } else if (id === 'slim') {
    ctx.fillStyle = shade(sub, 0.2);
    ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'cannon') {
    ctx.fillStyle = shade(sub, 0.1);
    rrect(ctx, -8, -8, 21, 16, 5); ctx.fill();
    ctx.strokeStyle = shade(sub, -0.35); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(11, 0, 4, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'blade') {
    ctx.fillStyle = shade(sub, 0.2);
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(glow, 0.9);
    ctx.beginPath();
    ctx.moveTo(2, -4.5); ctx.lineTo(28, 0); ctx.lineTo(2, 4.5);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawMark(ctx, id, main, sub, glow) {
  if (id === 'none') return;
  ctx.save();
  if (id === 'stripe') {
    ctx.strokeStyle = rgba(sub, 0.75); ctx.lineWidth = 3.5;
    [-6, -15].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, -15); ctx.lineTo(x - 3, 15);
      ctx.stroke();
    });
  } else if (id === 'dots') {
    ctx.fillStyle = rgba(glow, 0.9);
    [[-4, -9], [-14, -3], [-4, 9], [-18, 8]].forEach((d) => {
      ctx.beginPath(); ctx.arc(d[0], d[1], 2.8, 0, Math.PI * 2); ctx.fill();
    });
  } else if (id === 'cross') {
    ctx.strokeStyle = rgba(sub, 0.9); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-11, -13); ctx.lineTo(-11, 13); ctx.stroke();
  } else if (id === 'circuit') {
    ctx.strokeStyle = rgba(glow, 0.85); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-24, -7); ctx.lineTo(-10, -7); ctx.lineTo(-10, 7); ctx.lineTo(2, 7);
    ctx.stroke();
    ctx.fillStyle = glow;
    [[-24, -7], [-10, 0], [2, 7]].forEach((d) => {
      ctx.beginPath(); ctx.arc(d[0], d[1], 2.4, 0, Math.PI * 2); ctx.fill();
    });
  }
  ctx.restore();
}

/** 猫の頭。あたまのパーツはかぶりものとして上に乗る。 */
function drawHead(ctx, id, eyes, t, main, sub, glow) {
  const hx = 4, hr = 19;

  drawCatEars(ctx, main, glow, hx, 0);
  drawSkull(ctx, id === 'skull' ? shade(main, 0.3) : main, hx, hr);
  drawCatFace(ctx, main, hx, hr);

  if (id === 'helm') {
    ctx.fillStyle = shade(sub, 0.1);
    ctx.beginPath(); ctx.arc(hx, 0, hr, -1.35, 1.35); ctx.lineTo(hx - 3, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(sub, -0.35); ctx.lineWidth = 1.4; ctx.stroke();
    ctx.strokeStyle = glow; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(hx + hr - 4, 0); ctx.lineTo(hx - hr * 0.4, 0); ctx.stroke();
  } else if (id === 'horn') {
    [-1, 1].forEach((sg) => {
      ctx.fillStyle = shade(sub, 0.28);
      ctx.beginPath();
      ctx.moveTo(hx + 6, sg * 14); ctx.lineTo(hx + 28, sg * 24); ctx.lineTo(hx + 13, sg * 5);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = shade(sub, -0.3); ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.moveTo(hx + 23, sg * 21); ctx.lineTo(hx + 28, sg * 24); ctx.lineTo(hx + 22, sg * 17);
      ctx.closePath(); ctx.fill();
    });
  } else if (id === 'visor') {
    ctx.save();
    ctx.beginPath(); ctx.arc(hx, 0, hr - 1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = rgba(glow, 0.9);
    rrect(ctx, hx + 4, -hr, 8, hr * 2, 3); ctx.fill();
    ctx.restore();
  } else if (id === 'crown') {
    ctx.fillStyle = glow;
    [-1, 0, 1].forEach((i) => {
      ctx.beginPath();
      ctx.moveTo(hx + 8, i * 10 - 3); ctx.lineTo(hx + 27, i * 12); ctx.lineTo(hx + 8, i * 10 + 3);
      ctx.closePath(); ctx.fill();
    });
  } else if (id === 'hood') {
    ctx.fillStyle = shade(sub, 0.05);
    ctx.beginPath(); ctx.arc(hx - 4, 0, hr + 4, 1.1, -1.1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(sub, -0.4); ctx.lineWidth = 1.6; ctx.stroke();
  } else if (id === 'skull') {
    ctx.strokeStyle = shade(main, -0.5); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(hx + 2, -9); ctx.lineTo(hx + 11, -5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + 2, 9); ctx.lineTo(hx + 11, 5); ctx.stroke();
  }

  /* め。頭のふちの手前にのぞく。 */
  if (id !== 'visor') {
    const ex = hx + 5;
    ctx.fillStyle = glow;
    if (eyes === 'slit') {
      [-6.5, 6.5].forEach((ey) => { ellipse(ctx, ex, ey, 4.4, 2.4, 0); ctx.fill(); });
      ctx.fillStyle = '#20242e';
      [-6.5, 6.5].forEach((ey) => { ellipse(ctx, ex, ey, 1.3, 2.2, 0); ctx.fill(); });
    } else if (eyes === 'round') {
      [-6.5, 6.5].forEach((ey) => { ctx.beginPath(); ctx.arc(ex + 1, ey, 3.4, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#20242e';
      [-6.5, 6.5].forEach((ey) => { ctx.beginPath(); ctx.arc(ex + 1.6, ey, 1.5, 0, Math.PI * 2); ctx.fill(); });
    } else if (eyes === 'triple') {
      [-7, 7].forEach((ey) => { ctx.beginPath(); ctx.arc(ex, ey, 2.9, 0, Math.PI * 2); ctx.fill(); });
      ctx.beginPath(); ctx.arc(ex - 7, 0, 2.4, 0, Math.PI * 2); ctx.fill();
    } else if (eyes === 'cross') {
      ctx.strokeStyle = glow; ctx.lineWidth = 2;
      [-6.5, 6.5].forEach((ey) => {
        ctx.beginPath(); ctx.moveTo(ex - 3, ey - 3); ctx.lineTo(ex + 3, ey + 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex - 3, ey + 3); ctx.lineTo(ex + 3, ey - 3); ctx.stroke();
      });
    } else {
      ctx.fillStyle = '#0d0f16';
      [-6.5, 6.5].forEach((ey) => { ctx.beginPath(); ctx.arc(ex, ey, 3.4, 0, Math.PI * 2); ctx.fill(); });
      ctx.strokeStyle = rgba(glow, 0.6); ctx.lineWidth = 1.2;
      [-6.5, 6.5].forEach((ey) => { ctx.beginPath(); ctx.arc(ex, ey, 4.8, 0, Math.PI * 2); ctx.stroke(); });
    }
  }
}
