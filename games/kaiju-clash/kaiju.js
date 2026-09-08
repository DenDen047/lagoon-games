/* =========================================================================
   KAIJU CLASH ― 怪獣の絵
   怪獣は画像を持たず、すべてその場で描いている。
   描画は「身長を 1.0 とした空間・上が +y・前が +x」で行い、
   呼ぶ側が ctx.scale(size * facing, -size) してから使う。
   ========================================================================= */
'use strict';

/* ------------------------------ 描画の小物 ------------------------------ */
function polar(x, y, a, l) { return [x + Math.cos(a) * l, y + Math.sin(a) * l]; }

/** 折れ線に沿って太さの変わる帯を作る。尾・首・触腕・手足はこれで描く。 */
function ribbonPath(ctx, pts, widths) {
  const n = pts.length;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    const w = widths[i] / 2;
    left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
    right.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) {
    const m = [(left[i - 1][0] + left[i][0]) / 2, (left[i - 1][1] + left[i][1]) / 2];
    ctx.quadraticCurveTo(left[i - 1][0], left[i - 1][1], m[0], m[1]);
  }
  ctx.lineTo(left[n - 1][0], left[n - 1][1]);
  ctx.lineTo(right[n - 1][0], right[n - 1][1]);
  for (let i = n - 2; i >= 0; i--) {
    const m = [(right[i + 1][0] + right[i][0]) / 2, (right[i + 1][1] + right[i][1]) / 2];
    ctx.quadraticCurveTo(right[i + 1][0], right[i + 1][1], m[0], m[1]);
  }
  ctx.closePath();
}

function fillStroke(ctx, fill, line, lw) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw || 0.013; ctx.lineJoin = 'round'; ctx.stroke(); }
}

function ell(ctx, x, y, rx, ry, rot, fill, line, lw) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, Math.PI * 2);
  fillStroke(ctx, fill, line, lw);
}

/** ひじ・ひざのある手足。先端の座標を返す。 */
function drawLimb(ctx, x, y, a1, l1, a2, l2, w, C, fill) {
  const j = polar(x, y, a1, l1);
  const e = polar(j[0], j[1], a2, l2);
  ribbonPath(ctx, [[x, y], j, e], [w * 1.15, w * 0.9, w * 0.62]);
  fillStroke(ctx, fill || C.main, C.dark);
  return e;
}

/** かぎ爪。手足の先に付ける。 */
function drawClaws(ctx, x, y, a, len, n, C) {
  for (let i = 0; i < n; i++) {
    const aa = a + (i - (n - 1) / 2) * 0.42;
    const p = polar(x, y, aa, len);
    ribbonPath(ctx, [[x, y], p], [len * 0.5, 0.004]);
    fillStroke(ctx, C.belly, null);
  }
}

/** 目。白目と瞳、光のハイライト。 */
function drawEye(ctx, x, y, r, C, look) {
  ell(ctx, x, y, r, r * 0.86, 0, '#120c08', null);
  ell(ctx, x, y, r * 0.82, r * 0.7, 0, C.eye, null);
  ell(ctx, x + r * 0.18 * (look || 1), y, r * 0.3, r * 0.55, 0, '#150d06', null);
  ell(ctx, x - r * 0.22, y + r * 0.28, r * 0.2, r * 0.16, 0, 'rgba(255,255,255,.8)', null);
}

/* =========================================================================
   ポーズ
   状態と技の進み具合から、体の各部の振りを決める。
   ========================================================================= */
function computePose(f, time) {
  const p = {
    bob: 0, lean: 0, crouch: 0, armF: 0, armB: 0, legF: 0, legB: 0, liftF: 0, liftB: 0,
    head: 0, mouth: 0, tail: 0, wing: 0, twist: 0, fall: 0, glow: 0,
    air: 0, atk: null, atkT: 0, swing: 0, step: 0,
  };
  const t = time * 0.06;

  if (f.state === 'ko' || f.state === 'down') {
    const d = clamp(f.stateT / 26, 0, 1);
    p.fall = easeOut(d) * (Math.PI / 2 - 0.12);
    p.legF = -0.4; p.legB = 0.3; p.armF = -0.5; p.armB = -0.3;
    p.mouth = 0.5 * (1 - d * 0.4);
    p.tail = Math.sin(time * 0.1) * 0.15;
    return p;
  }

  if (f.state === 'win') {
    const w = f.stateT * 0.1;
    p.bob = Math.sin(w) * 0.02;
    p.head = 0.7 + Math.sin(w * 0.7) * 0.15;
    p.mouth = 0.55 + Math.sin(w * 1.6) * 0.35;
    p.armF = -0.7; p.armB = -0.6;
    p.wing = Math.sin(w) * 0.9;
    p.tail = Math.sin(w * 0.8) * 0.6;
    p.glow = 0.3 + Math.sin(w) * 0.2;
    return p;
  }

  /* 空中 */
  if (!f.onGround) {
    p.air = 1;
    const rise = clamp(-f.vy / 12, -1, 1);
    p.legF = 0.5 + rise * 0.3; p.legB = -0.35 - rise * 0.2;
    p.liftF = 0.7; p.liftB = 0.5;
    p.armF = -0.35; p.armB = 0.25;
    p.lean = 0.1;
    p.tail = Math.sin(time * 0.12) * 0.3 - rise * 0.3;
    p.wing = Math.sin(time * 0.25) * 1;
  } else if (f.state === 'guard') {
    p.crouch = 0.55;
    p.armF = 0.75; p.armB = 0.5;
    p.lean = -0.12;
    p.bob = -0.03 + Math.sin(t) * 0.004;
    p.tail = Math.sin(t * 0.6) * 0.1;
  } else if (f.state === 'hurt') {
    const d = clamp(f.stateT / 10, 0, 1);
    p.lean = -0.4 * (1 - d * 0.5);
    p.head = -0.5; p.mouth = 0.7 * (1 - d * 0.4);
    p.armF = -0.6; p.armB = -0.4;
    p.legF = -0.2; p.legB = 0.2;
    p.tail = -0.6 + d * 0.4;
    p.bob = -0.02;
  } else if (Math.abs(f.vx) > 0.4) {
    /* 歩き。重い怪獣なので歩幅は大きくゆっくり */
    const w = f.walkPhase;
    const dir = f.vx * f.facing > 0 ? 1 : -1;
    p.legF = Math.sin(w) * 0.85 * dir;
    p.legB = -Math.sin(w) * 0.85 * dir;
    /* 前に振り出しているあいだだけ足が浮く */
    p.liftF = Math.max(0, Math.cos(w) * dir);
    p.liftB = Math.max(0, -Math.cos(w) * dir);
    p.armF = -Math.sin(w) * 0.5 * dir;
    p.armB = Math.sin(w) * 0.5 * dir;
    p.bob = Math.abs(Math.cos(w)) * 0.022 - 0.011;
    p.lean = 0.07 * dir;
    p.tail = Math.sin(w * 0.5) * 0.5;
    p.wing = Math.sin(w) * 0.6;
    p.step = Math.sin(w);
  } else {
    /* 立ち。呼吸で少し動く */
    p.bob = Math.sin(t) * 0.012;
    p.lean = Math.sin(t * 0.6) * 0.02;
    p.armF = Math.sin(t + 0.4) * 0.07;
    p.armB = Math.sin(t) * 0.07;
    p.tail = Math.sin(t * 0.7) * 0.35;
    p.wing = Math.sin(t * 1.4) * 0.5;
    p.head = Math.sin(t * 0.5) * 0.08;
  }

  /* 技の振り */
  const a = f.act;
  if (a) {
    const total = a.def.startup + a.def.active + a.def.recovery;
    p.atk = a.key;
    p.atkT = clamp(a.frame / total, 0, 1);
    const s = a.def.startup, ac = a.def.active;
    let sw;
    if (a.frame < s) sw = -easeOut(a.frame / Math.max(1, s));            /* 振りかぶり */
    else if (a.frame < s + ac) sw = lerp(-1, 1, (a.frame - s) / Math.max(1, ac));
    else sw = 1 - easeIn((a.frame - s - ac) / Math.max(1, a.def.recovery)) * 1.0;
    p.swing = sw;

    if (a.key === 'light') {
      p.armF = clamp(sw, -1, 1) * 1.0;
      p.armB = -sw * 0.3;
      p.lean = sw * 0.16;
      p.twist = sw * 0.3;
      p.mouth = clamp(sw * 0.5, 0, 0.5);
    } else if (a.key === 'heavy') {
      p.armF = clamp(sw, -1, 1) * 1.15;
      p.armB = -sw * 0.5;
      p.lean = sw * 0.3;
      p.twist = sw * 0.55;
      p.tail = -sw * 1.3;
      p.mouth = clamp(Math.abs(sw) * 0.6, 0, 0.7);
      p.crouch = clamp(-sw, 0, 1) * 0.2;
    } else if (a.key === 'air') {
      p.legF = clamp(sw, -1, 1) * 1.0;
      p.legB = -0.4;
      p.armF = -0.5; p.armB = -0.5;
      p.lean = 0.25;
    } else if (a.key === 'special' || a.key === 'super') {
      const charging = a.frame < s;
      const cd = a.frame / Math.max(1, s);
      if (charging) {
        p.crouch = easeOut(cd) * 0.22;
        p.lean = -0.18 * easeOut(cd);
        p.head = 0.2 * easeOut(cd);
        p.mouth = easeOut(cd) * 0.35;
        p.glow = easeOut(cd);
        p.armF = -0.4 * easeOut(cd); p.armB = -0.4 * easeOut(cd);
        p.wing = Math.sin(a.frame * 0.5) * 1;
      } else if (a.frame < s + ac) {
        const k = (a.frame - s) / Math.max(1, ac);
        p.lean = 0.16;
        p.head = 0.1;
        p.mouth = 1;
        p.glow = 1;
        p.armF = -0.75; p.armB = -0.7;
        p.bob = Math.sin(a.frame * 0.9) * 0.012;
        p.wing = Math.sin(a.frame * 0.35) * 1;
        p.tail = Math.sin(k * 4) * 0.4;
        if (a.def.type === 'shot' || a.def.type === 'pillar' || a.def.type === 'rain') {
          p.armF = 1.0; p.armB = 0.3;
        }
        if (a.def.type === 'dash') { p.lean = 0.6; p.crouch = 0.5; }
        if (a.def.type === 'rush') {
          p.armF = Math.sin(a.frame * 0.9);
          p.armB = -Math.sin(a.frame * 0.9);
          p.lean = 0.3;
        }
      } else {
        const k = (a.frame - s - ac) / Math.max(1, a.def.recovery);
        p.glow = 1 - k;
        p.mouth = (1 - k) * 0.5;
        p.lean = 0.16 * (1 - k);
      }
    }
  }

  if (f.hitFlash > 0) p.bob += Math.sin(f.hitFlash * 2.2) * 0.008;
  return p;
}

/* =========================================================================
   本体の描画
   ========================================================================= */
const FORMS = {};

/** 怪獣ひとりを描く。ctx は世界座標のまま渡す。 */
function drawKaiju(ctx, f, time) {
  const k = f.k;
  const p = f.pose || computePose(f, time);
  const flash = f.hitFlash > 0 ? clamp(f.hitFlash / 6, 0, 1) * 0.8 : 0;
  const C = {};
  for (const key in k.colors) C[key] = flash > 0 ? mixColor(k.colors[key], '#ffffff', flash) : k.colors[key];
  C.line = k.colors.dark;
  C.glowCol = k.colors.glow;

  ctx.save();
  ctx.translate(f.x, f.groundY - f.y);
  if (p.fall) ctx.rotate(p.fall * -f.facing);
  ctx.scale(k.size * f.facing, -k.size);
  ctx.translate(0, p.bob);
  ctx.lineCap = 'round';

  const fn = FORMS[k.form] || FORMS.saurian;
  fn(ctx, C, p, f, time);

  ctx.restore();
}

/* 怪獣選択画面などで使う立ち絵 */
function drawPortrait(ctx, kdata, x, y, size, time, facing) {
  const fake = {
    k: kdata, x: 0, y: 0, groundY: 0, facing: facing || 1, vx: 0, vy: 0,
    onGround: true, state: 'idle', stateT: 0, act: null, hitFlash: 0,
    walkPhase: 0,
  };
  const p = computePose(fake, time);
  const C = {};
  for (const key in kdata.colors) C[key] = kdata.colors[key];
  C.line = kdata.colors.dark;
  C.glowCol = kdata.colors.glow;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size * (facing || 1), -size);
  ctx.translate(0, p.bob);
  ctx.lineCap = 'round';
  (FORMS[kdata.form] || FORMS.saurian)(ctx, C, p, fake, time);
  ctx.restore();
}

/* ------------------------------------------------------------------------
   恐竜型（ガイオン）
   ------------------------------------------------------------------------ */
FORMS.saurian = function (ctx, C, p, f, time) {
  const cr = p.crouch * 0.09;
  const hipY = 0.43 - cr;
  const lean = p.lean;
  const leg = { stride: 0.12, l1: 0.25, l2: 0.23, ankle: 0.1, lift: 0.09, foot: 0.15, claws: 3 };

  /* --- 奥の脚 --- */
  drawFootLeg(ctx, C, -0.05, hipY, p.legB, p.liftB,
    Object.assign({ w: 0.1, col: shade(C.main, -0.28) }, leg));

  /* --- 尾 --- */
  const tw = p.tail;
  const tail = [
    [-0.1, hipY + 0.02],
    [-0.28, hipY - 0.01 + tw * 0.05],
    [-0.46, hipY - 0.08 + tw * 0.11],
    [-0.62, hipY - 0.18 + tw * 0.17],
    [-0.74, hipY - 0.3 + tw * 0.22],
  ];
  ribbonPath(ctx, tail, [0.2, 0.155, 0.11, 0.07, 0.024]);
  fillStroke(ctx, C.main, C.line);
  for (let i = 1; i < tail.length; i++) {
    const a = tail[i - 1], b = tail[i];
    const h = 0.08 * (1 - i / tail.length) + 0.018;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1] + 0.02);
    ctx.lineTo((a[0] + b[0]) / 2 - 0.01, (a[1] + b[1]) / 2 + h);
    ctx.lineTo(b[0], b[1] + 0.02);
    ctx.closePath();
    fillStroke(ctx, mixColor(C.dark, C.accent, 0.25 + p.glow * 0.6), C.line, 0.008);
  }

  /* --- 胴 --- */
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean * 0.45);
  ctx.beginPath();
  ctx.moveTo(-0.17, 0.0);
  ctx.quadraticCurveTo(-0.21, 0.18, -0.1, 0.3);      /* 背中 */
  ctx.quadraticCurveTo(0.0, 0.4, 0.13, 0.37);        /* 肩 */
  ctx.quadraticCurveTo(0.23, 0.32, 0.2, 0.2);        /* 胸 */
  ctx.quadraticCurveTo(0.17, 0.06, 0.08, -0.05);     /* 腹 */
  ctx.quadraticCurveTo(-0.04, -0.09, -0.17, 0.0);
  ctx.closePath();
  fillStroke(ctx, C.main, C.line, 0.015);
  /* 腹の板 */
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0.16, 0.28);
  ctx.quadraticCurveTo(0.2, 0.14, 0.1, -0.02);
  ctx.quadraticCurveTo(0.02, 0.02, 0.05, 0.16);
  ctx.quadraticCurveTo(0.08, 0.26, 0.16, 0.28);
  ctx.closePath();
  fillStroke(ctx, C.belly, null);
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0.06, 0.02 + i * 0.065);
    ctx.quadraticCurveTo(0.13, 0.05 + i * 0.065, 0.18, 0.02 + i * 0.062);
    ctx.strokeStyle = C.dark; ctx.lineWidth = 0.007; ctx.stroke();
  }
  ctx.restore();
  /* 背びれ */
  const spine = [[-0.14, 0.1], [-0.09, 0.24], [0.0, 0.35], [0.11, 0.38]];
  for (let i = 1; i < spine.length; i++) {
    const a = spine[i - 1], b = spine[i];
    const h = 0.13 - i * 0.02;
    const nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const L = Math.hypot(nx, ny) || 1;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo((a[0] + b[0]) / 2 - nx / L * h, (a[1] + b[1]) / 2 - ny / L * h);
    ctx.lineTo(b[0], b[1]);
    ctx.closePath();
    fillStroke(ctx, mixColor(C.dark, C.accent, 0.3 + p.glow * 0.65), C.line, 0.008);
  }
  ctx.restore();

  /* --- 首と頭 --- */
  const chest = [0.13 + lean * 0.06, hipY + 0.36];
  const headA = 0.62 + p.head * 0.35 - lean * 0.3;
  const neckEnd = polar(chest[0], chest[1], headA, 0.2);
  ribbonPath(ctx, [chest, polar(chest[0], chest[1], headA - 0.2, 0.11), neckEnd], [0.19, 0.15, 0.12]);
  fillStroke(ctx, C.main, C.line);

  ctx.save();
  ctx.translate(neckEnd[0], neckEnd[1]);
  ctx.rotate(-0.42 + p.head * 0.3 + lean * 0.2);
  /* 頭 */
  ctx.beginPath();
  ctx.moveTo(-0.07, 0.02);
  ctx.quadraticCurveTo(-0.02, 0.11, 0.08, 0.09);
  ctx.quadraticCurveTo(0.2, 0.06, 0.23, 0.0);
  ctx.quadraticCurveTo(0.16, -0.04, 0.06, -0.04);
  ctx.quadraticCurveTo(-0.03, -0.05, -0.07, 0.02);
  ctx.closePath();
  fillStroke(ctx, C.main, C.line, 0.014);
  /* 下あご */
  ctx.save();
  ctx.rotate(-p.mouth * 0.55);
  ribbonPath(ctx, [[-0.03, -0.035], [0.09, -0.05], [0.19, -0.05]], [0.09, 0.075, 0.045]);
  fillStroke(ctx, shade(C.main, -0.2), C.line);
  for (let i = 0; i < 3; i++) {
    const x = 0.04 + i * 0.05;
    ctx.beginPath(); ctx.moveTo(x - 0.014, -0.03); ctx.lineTo(x, 0.012); ctx.lineTo(x + 0.014, -0.03); ctx.closePath();
    fillStroke(ctx, '#f4efe2', null);
  }
  ctx.restore();
  /* 口の奥の光 */
  if (p.glow > 0.05) {
    ell(ctx, 0.15, -0.015, 0.055 * p.glow + 0.012, 0.045 * p.glow + 0.012, 0, rgba(C.glowCol, 0.95), null);
    ctx.save(); ctx.globalAlpha = p.glow * 0.45;
    ell(ctx, 0.18, -0.015, 0.14, 0.1, 0, rgba(C.glowCol, 0.5), null);
    ctx.restore();
  }
  /* 上の牙 */
  for (let i = 0; i < 3; i++) {
    const x = 0.05 + i * 0.05;
    ctx.beginPath(); ctx.moveTo(x - 0.014, -0.026); ctx.lineTo(x, -0.058); ctx.lineTo(x + 0.014, -0.026); ctx.closePath();
    fillStroke(ctx, '#f4efe2', null);
  }
  drawEye(ctx, 0.03, 0.045, 0.031, C);
  /* 角 */
  ctx.beginPath(); ctx.moveTo(-0.04, 0.06); ctx.lineTo(-0.1, 0.15); ctx.lineTo(-0.01, 0.08); ctx.closePath();
  fillStroke(ctx, shade(C.main, -0.3), C.line, 0.008);
  ctx.restore();

  /* --- 奥の腕 --- */
  const sh = [chest[0] - 0.03, chest[1] - 0.08];
  const handB = drawLimb(ctx, sh[0], sh[1], -1.15 + p.armB * 1.4, 0.13, -0.95 + p.armB * 1.5, 0.11, 0.072,
    { main: shade(C.main, -0.22), dark: C.line });
  drawClaws(ctx, handB[0], handB[1], p.armB * 1.4 - 0.6, 0.05, 3, C);

  /* --- 手前の脚 --- */
  drawFootLeg(ctx, C, 0.03, hipY, p.legF, p.liftF,
    Object.assign({ w: 0.115, col: C.main }, leg));

  /* --- 手前の腕 --- */
  const handF = drawLimb(ctx, sh[0] + 0.04, sh[1] + 0.01, -1.1 + p.armF * 1.5, 0.14, -0.9 + p.armF * 1.6, 0.12, 0.08, C);
  drawClaws(ctx, handF[0], handF[1], p.armF * 1.5 - 0.5, 0.055, 3, C);
};

/** 足の先を地面に置いて、ひざを前に折る二足の脚。恐竜も亀も岩の巨人もこれを使う。 */
function drawFootLeg(ctx, C, hx, hy, swing, lift, o) {
  const stride = o.stride, l1 = o.l1, l2 = o.l2;
  const toeX = hx + swing * stride;
  const toeY = (lift || 0) * (o.lift || 0.08);
  const ax = toeX - (o.foot || 0.12) * 0.4;
  const ay = toeY + (o.ankle || 0.08);
  /* ひざの位置を出す */
  let dx = ax - hx, dy = ay - hy;
  let d = Math.hypot(dx, dy);
  const maxD = (l1 + l2) * 0.985;
  if (d > maxD) { const k = maxD / d; dx *= k; dy *= k; d = maxD; }
  const base = Math.atan2(dy, dx);
  const cosT = clamp((d * d + l1 * l1 - l2 * l2) / (2 * d * l1), -1, 1);
  const knee = polar(hx, hy, base + Math.acos(cosT), l1);
  const ankle = [hx + dx, hy + dy];
  const w = o.w;
  const col = o.col || C.main;
  /* もも・すね */
  ribbonPath(ctx, [[hx, hy], knee, ankle], [w * 1.5, w, w * 0.66]);
  fillStroke(ctx, col, C.dark);
  /* 足 */
  const fl = o.foot || 0.12;
  ribbonPath(ctx, [[ankle[0] - fl * 0.35, toeY + 0.012], [ankle[0] + fl * 0.6, toeY + 0.01]], [w * 0.85, w * 0.55]);
  fillStroke(ctx, col, C.dark);
  /* 爪 */
  const claws = o.claws == null ? 3 : o.claws;
  for (let i = 0; i < claws; i++) {
    const cx = ankle[0] + fl * 0.5 + i * 0.004;
    ctx.beginPath();
    ctx.moveTo(cx, toeY + w * 0.3);
    ctx.lineTo(cx + fl * 0.3, toeY + 0.006 + i * 0.005);
    ctx.lineTo(cx, toeY - w * 0.05);
    ctx.closePath();
    fillStroke(ctx, C.belly, null);
  }
  return ankle;
}

/* ------------------------------------------------------------------------
   三首竜（トライガ）
   ------------------------------------------------------------------------ */
FORMS.hydra = function (ctx, C, p, f, time) {
  const cr = p.crouch * 0.08;
  const hipY = 0.37 - cr + (p.air ? 0.05 : 0);
  const lean = p.lean;
  const leg = { stride: 0.11, l1: 0.21, l2: 0.2, ankle: 0.09, lift: 0.08, foot: 0.13, claws: 3 };

  /* --- 尾 2 本 --- */
  for (let side = 0; side < 2; side++) {
    const sw = p.tail * (side === 0 ? 1 : -0.7);
    const dy = side === 0 ? 0.03 : -0.02;
    const tail = [
      [-0.08, hipY + dy],
      [-0.26, hipY + dy + sw * 0.07],
      [-0.44, hipY - 0.04 + dy + sw * 0.14],
      [-0.6, hipY - 0.14 + dy + sw * 0.2],
      [-0.72, hipY - 0.24 + dy + sw * 0.26],
    ];
    ribbonPath(ctx, tail, [0.12, 0.095, 0.07, 0.045, 0.014]);
    fillStroke(ctx, side === 0 ? shade(C.main, -0.22) : C.main, C.line);
    const e = tail[4], d = tail[3];
    const a = Math.atan2(e[1] - d[1], e[0] - d[0]);
    ctx.save(); ctx.translate(e[0], e[1]); ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-0.02, 0.055); ctx.lineTo(0.08, 0.022);
    ctx.lineTo(0.08, -0.022); ctx.lineTo(-0.02, -0.055);
    ctx.closePath();
    fillStroke(ctx, side === 0 ? shade(C.main, -0.12) : shade(C.main, 0.06), C.line, 0.008);
    ctx.restore();
  }

  /* --- 奥の翼 --- */
  drawWing(ctx, C, -0.1, hipY + 0.3, p.wing, -1, 0.56);
  /* --- 奥の脚 --- */
  drawFootLeg(ctx, C, -0.05, hipY, p.legB, p.liftB,
    Object.assign({ w: 0.082, col: shade(C.main, -0.3) }, leg));

  /* --- 胴 --- */
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean * 0.45);
  ctx.beginPath();
  ctx.moveTo(-0.15, 0.0);
  ctx.quadraticCurveTo(-0.18, 0.16, -0.08, 0.27);
  ctx.quadraticCurveTo(0.02, 0.36, 0.13, 0.33);
  ctx.quadraticCurveTo(0.21, 0.28, 0.18, 0.16);
  ctx.quadraticCurveTo(0.15, 0.04, 0.07, -0.05);
  ctx.quadraticCurveTo(-0.03, -0.08, -0.15, 0.0);
  ctx.closePath();
  fillStroke(ctx, C.main, C.line, 0.015);
  /* 腹の鱗 */
  ctx.beginPath();
  ctx.moveTo(0.15, 0.26);
  ctx.quadraticCurveTo(0.18, 0.12, 0.09, -0.02);
  ctx.quadraticCurveTo(0.02, 0.02, 0.05, 0.15);
  ctx.quadraticCurveTo(0.08, 0.24, 0.15, 0.26);
  ctx.closePath();
  fillStroke(ctx, C.belly, null);
  ctx.save();
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0.05, 0.0 + i * 0.06);
    ctx.quadraticCurveTo(0.11, 0.03 + i * 0.06, 0.16, 0.0 + i * 0.058);
    ctx.strokeStyle = C.dark; ctx.lineWidth = 0.007; ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  /* --- 首 3 本 --- */
  const chest = [0.1 + lean * 0.05, hipY + 0.31];
  const necks = [
    { dx: -0.05, dy: 0.0, a: 1.16, len: 0.3, sc: 0.84, col: shade(C.main, -0.22) },
    { dx: 0.0, dy: 0.02, a: 0.82, len: 0.34, sc: 1.0, col: C.main },
    { dx: 0.05, dy: -0.02, a: 0.42, len: 0.3, sc: 0.86, col: shade(C.main, 0.07) },
  ];
  necks.forEach((n, i) => {
    const wob = Math.sin(time * 0.06 + i * 2.1) * 0.09 + p.head * 0.3;
    const a = n.a + wob - lean * 0.25;
    const base = [chest[0] + n.dx, chest[1] + n.dy];
    const mid = polar(base[0], base[1], a - 0.42, n.len * 0.5);
    const end = polar(mid[0], mid[1], a + 0.3, n.len * 0.62);
    ribbonPath(ctx, [base, mid, end], [0.1 * n.sc, 0.08 * n.sc, 0.065 * n.sc]);
    fillStroke(ctx, n.col, C.line);
    /* たてがみ */
    for (let j = 0; j < 3; j++) {
      const t = 0.3 + j * 0.28;
      const q = [lerp(base[0], end[0], t) - 0.02, lerp(base[1], end[1], t)];
      ctx.beginPath();
      ctx.moveTo(q[0], q[1]);
      ctx.lineTo(q[0] - 0.05 * n.sc, q[1] + 0.05 * n.sc);
      ctx.lineTo(q[0] + 0.01, q[1] + 0.02);
      ctx.closePath();
      fillStroke(ctx, C.accent, null);
    }
    /* 頭 */
    ctx.save();
    ctx.translate(end[0], end[1]);
    ctx.rotate(a - 0.95 + p.head * 0.2);
    const S = n.sc;
    ctx.beginPath();
    ctx.moveTo(-0.05 * S, 0.015 * S);
    ctx.quadraticCurveTo(0.0, 0.075 * S, 0.08 * S, 0.06 * S);
    ctx.quadraticCurveTo(0.17 * S, 0.04 * S, 0.19 * S, 0.0);
    ctx.quadraticCurveTo(0.12 * S, -0.03 * S, 0.04 * S, -0.03 * S);
    ctx.quadraticCurveTo(-0.03 * S, -0.03 * S, -0.05 * S, 0.015 * S);
    ctx.closePath();
    fillStroke(ctx, n.col, C.line, 0.012);
    ctx.save();
    ctx.rotate(-p.mouth * 0.5);
    ribbonPath(ctx, [[-0.02 * S, -0.025 * S], [0.07 * S, -0.04 * S], [0.15 * S, -0.04 * S]], [0.055 * S, 0.045 * S, 0.028 * S]);
    fillStroke(ctx, shade(n.col, -0.22), C.line, 0.008);
    ctx.restore();
    if (p.glow > 0.05) {
      ell(ctx, 0.14 * S, -0.01, (0.04 * p.glow + 0.01) * S, (0.035 * p.glow + 0.01) * S, 0, rgba(C.glowCol, 0.95), null);
    }
    drawEye(ctx, 0.03 * S, 0.028 * S, 0.023 * S, C);
    /* 冠の角 */
    for (let h = 0; h < 3; h++) {
      ctx.beginPath();
      ctx.moveTo(-0.035 * S + h * 0.014 * S, 0.04 * S);
      ctx.lineTo(-0.075 * S + h * 0.018 * S, 0.13 * S);
      ctx.lineTo(-0.015 * S + h * 0.014 * S, 0.05 * S);
      ctx.closePath();
      fillStroke(ctx, C.accent, C.line, 0.006);
    }
    ctx.restore();
  });

  /* --- 手前の脚 --- */
  drawFootLeg(ctx, C, 0.04, hipY, p.legF, p.liftF,
    Object.assign({ w: 0.09, col: C.main }, leg));
  /* --- 手前の翼 --- */
  drawWing(ctx, C, -0.02, hipY + 0.27, p.wing, 1, 0.64);
};

/** 竜の翼。dirZ が 1 なら手前、-1 なら奥。 */
function drawWing(ctx, C, x, y, flap, dirZ, len) {
  const a = -0.15 + flap * 0.45;
  const col = dirZ > 0 ? C.main : shade(C.main, -0.3);
  const mem = dirZ > 0 ? mixColor(C.belly, C.accent, 0.35) : shade(mixColor(C.belly, C.accent, 0.35), -0.28);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  /* 膜 */
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-len * 0.5, len * 0.55, -len * 0.95, len * 0.32);
  ctx.quadraticCurveTo(-len * 0.75, len * 0.02, -len * 0.62, -len * 0.14);
  ctx.quadraticCurveTo(-len * 0.4, -len * 0.05, -len * 0.22, -len * 0.12);
  ctx.quadraticCurveTo(-len * 0.1, -len * 0.05, 0, 0);
  ctx.closePath();
  fillStroke(ctx, mem, C.line);
  /* 骨 */
  ctx.strokeStyle = col; ctx.lineWidth = 0.022; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-len * 0.45, len * 0.4, -len * 0.95, len * 0.32); ctx.stroke();
  ctx.lineWidth = 0.013;
  ctx.beginPath(); ctx.moveTo(-len * 0.3, len * 0.22); ctx.lineTo(-len * 0.62, -len * 0.12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-len * 0.18, len * 0.13); ctx.lineTo(-len * 0.24, -len * 0.11); ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------------
   大猿（ゴリガ）
   ------------------------------------------------------------------------ */
FORMS.ape = function (ctx, C, p, f, time) {
  const cr = p.crouch * 0.1;
  const hipY = 0.36 - cr;
  const lean = p.lean + 0.12;

  /* 奥脚 */
  drawApeLeg(ctx, C, -0.05, hipY, p.legB, shade(C.main, -0.3));
  /* 奥腕 */
  const shB = [0.0, hipY + 0.3];
  drawApeArm(ctx, C, shB[0] - 0.06, shB[1], p.armB, shade(C.main, -0.3), 0.9);

  /* 胴（樽のような胸） */
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean * 0.4);
  ribbonPath(ctx, [[-0.02, -0.02], [0.0, 0.12], [0.02, 0.26], [0.02, 0.34]], [0.26, 0.34, 0.36, 0.3]);
  fillStroke(ctx, C.main, C.line);
  /* 胸板 */
  ribbonPath(ctx, [[0.06, 0.02], [0.09, 0.14], [0.09, 0.26]], [0.14, 0.2, 0.2]);
  fillStroke(ctx, C.belly, null);
  ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.moveTo(0.02, 0.3); ctx.quadraticCurveTo(0.1, 0.22, 0.09, 0.1);
  ctx.strokeStyle = C.dark; ctx.lineWidth = 0.01; ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  /* 頭 */
  const hx = 0.05 + lean * 0.08, hy = hipY + 0.42;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(p.head * 0.25 - lean * 0.2);
  ell(ctx, 0, 0, 0.13, 0.115, 0, C.main, C.line);
  /* 眉の張り出し */
  ribbonPath(ctx, [[-0.06, 0.06], [0.05, 0.075], [0.11, 0.05]], [0.07, 0.07, 0.05]);
  fillStroke(ctx, shade(C.main, -0.25), C.line, 0.008);
  /* 顔 */
  ell(ctx, 0.06, -0.02, 0.075, 0.07, 0, C.belly, C.line, 0.008);
  /* 口 */
  ctx.save(); ctx.translate(0.08, -0.045);
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.05, 0.012 + p.mouth * 0.045, 0, 0, Math.PI * 2);
  fillStroke(ctx, '#3a1810', C.line, 0.007);
  if (p.mouth > 0.3) {
    ctx.beginPath(); ctx.moveTo(-0.03, 0.005); ctx.lineTo(-0.02, -0.02); ctx.lineTo(-0.01, 0.005); ctx.closePath();
    fillStroke(ctx, '#fff', null);
    ctx.beginPath(); ctx.moveTo(0.02, 0.005); ctx.lineTo(0.03, -0.02); ctx.lineTo(0.04, 0.005); ctx.closePath();
    fillStroke(ctx, '#fff', null);
  }
  ctx.restore();
  drawEye(ctx, 0.045, 0.035, 0.026, C);
  /* 耳 */
  ell(ctx, -0.1, 0.02, 0.03, 0.038, 0, shade(C.main, -0.15), C.line, 0.008);
  ctx.restore();

  /* 手前脚 */
  drawApeLeg(ctx, C, 0.03, hipY, p.legF, C.main);
  /* 手前腕 */
  drawApeArm(ctx, C, 0.02, hipY + 0.32, p.armF, C.main, 1);
};

function drawApeLeg(ctx, C, x, y, sw, col) {
  const knee = polar(x, y, -1.25 + sw * 0.5, 0.18);
  const foot = polar(knee[0], knee[1], -1.75 - sw * 0.5, 0.16);
  ribbonPath(ctx, [[x, y], knee, foot], [0.19, 0.15, 0.1]);
  fillStroke(ctx, col, C.dark);
  ribbonPath(ctx, [[foot[0] - 0.05, foot[1]], [foot[0] + 0.09, foot[1] - 0.004]], [0.09, 0.06]);
  fillStroke(ctx, col, C.dark);
}

function drawApeArm(ctx, C, x, y, sw, col, sc) {
  const a1 = -1.5 + sw * 1.7;
  const elbow = polar(x, y, a1, 0.24 * sc);
  const a2 = a1 + (-0.5 + sw * 1.1);
  const hand = polar(elbow[0], elbow[1], a2, 0.22 * sc);
  ribbonPath(ctx, [[x, y], elbow, hand], [0.17 * sc, 0.13 * sc, 0.1 * sc]);
  fillStroke(ctx, col, C.dark);
  /* こぶし */
  ell(ctx, hand[0], hand[1], 0.075 * sc, 0.07 * sc, 0, col, C.dark);
  ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.arc(hand[0], hand[1], 0.045 * sc, 0.3, 2.9); ctx.strokeStyle = C.dark; ctx.lineWidth = 0.008; ctx.stroke();
  ctx.globalAlpha = 1;
  return hand;
}

/* ------------------------------------------------------------------------
   蛾（リンネ）
   ------------------------------------------------------------------------ */
FORMS.moth = function (ctx, C, p, f, time) {
  const hover = p.air ? Math.sin(time * 0.12) * 0.02 : 0;
  const bodyY = 0.44 + hover - p.crouch * 0.08;
  const flap = p.wing;

  /* 奥の翅 */
  drawMothWing(ctx, C, -0.02, bodyY + 0.12, flap, -1);
  /* 脚（細い 3 対） */
  for (let i = 0; i < 3; i++) {
    const bx = 0.06 - i * 0.07;
    const sw = i === 0 ? p.legF : i === 2 ? p.legB : (p.legF + p.legB) * 0.5;
    const knee = polar(bx, bodyY - 0.06, -1.1 - i * 0.25 + sw * 0.4, 0.17);
    const foot = polar(knee[0], knee[1], -1.9 - sw * 0.4, 0.17);
    ribbonPath(ctx, [[bx, bodyY - 0.06], knee, foot], [0.035, 0.026, 0.012]);
    fillStroke(ctx, i === 1 ? shade(C.dark, 0.2) : C.dark, null);
  }

  /* 腹部 */
  ctx.save();
  ctx.translate(0, bodyY);
  ctx.rotate(p.lean * 0.4);
  ribbonPath(ctx, [[0.02, 0.02], [-0.1, -0.02], [-0.24, -0.08], [-0.34, -0.14]], [0.2, 0.19, 0.14, 0.06]);
  fillStroke(ctx, C.main, C.line);
  /* 縞 */
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(-0.05 - i * 0.07, 0.06 - i * 0.02); ctx.lineTo(-0.06 - i * 0.07, -0.09 - i * 0.02);
    ctx.strokeStyle = C.dark; ctx.lineWidth = 0.022; ctx.stroke();
    ctx.restore();
  }
  /* 胸（もふもふ） */
  ell(ctx, 0.06, 0.05, 0.15, 0.14, 0.2, C.belly, C.line);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 0.13 + Math.sin(i * 3.1) * 0.02;
    ell(ctx, 0.06 + Math.cos(a) * r, 0.05 + Math.sin(a) * r * 0.95, 0.035, 0.03, a, C.belly, null);
  }
  ctx.restore();

  /* 頭 */
  const hx = 0.19, hy = bodyY + 0.13;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(p.head * 0.2 + p.lean * 0.3);
  ell(ctx, 0, 0, 0.085, 0.08, 0, C.belly, C.line);
  /* 複眼 */
  ell(ctx, 0.04, 0.015, 0.05, 0.055, -0.2, shade(C.eye, -0.15), C.line, 0.008);
  ell(ctx, 0.03, 0.03, 0.018, 0.02, 0, 'rgba(255,255,255,.65)', null);
  /* 触角 */
  for (let s = -1; s <= 1; s += 2) {
    const pts = [[0.02, 0.06], [0.08, 0.15 + s * 0.01], [0.16, 0.2 + s * 0.03], [0.24, 0.19 + s * 0.05]];
    ribbonPath(ctx, pts, [0.016, 0.013, 0.01, 0.006]);
    fillStroke(ctx, s < 0 ? shade(C.dark, 0.15) : C.dark, null);
    /* 羽毛状の櫛 */
    for (let i = 1; i < pts.length; i++) {
      for (let j = -1; j <= 1; j += 2) {
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[i][0] - 0.012, pts[i][1] + j * 0.035);
        ctx.strokeStyle = rgba(C.dark, 0.75); ctx.lineWidth = 0.006; ctx.stroke();
      }
    }
  }
  /* 口吻 */
  ctx.beginPath();
  ctx.arc(0.05, -0.055, 0.035, -0.4, 3.4);
  ctx.strokeStyle = C.dark; ctx.lineWidth = 0.014; ctx.stroke();
  ctx.restore();

  /* 手前の翅 */
  drawMothWing(ctx, C, 0.04, bodyY + 0.1, flap, 1);
};

function drawMothWing(ctx, C, x, y, flap, dirZ) {
  const spread = 1 - Math.abs(flap) * 0.28;
  const col = dirZ > 0 ? C.main : shade(C.main, -0.3);
  const col2 = dirZ > 0 ? C.belly : shade(C.belly, -0.3);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(flap * 0.22 * dirZ);
  ctx.scale(1, spread);
  /* 後翅 */
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-0.3, -0.12, -0.44, -0.3);
  ctx.quadraticCurveTo(-0.2, -0.34, -0.02, -0.16);
  ctx.closePath();
  fillStroke(ctx, col2, C.line);
  /* 前翅 */
  ctx.beginPath();
  ctx.moveTo(0.06, 0.02);
  ctx.quadraticCurveTo(-0.1, 0.42, -0.42, 0.4);
  ctx.quadraticCurveTo(-0.52, 0.16, -0.36, -0.06);
  ctx.quadraticCurveTo(-0.16, -0.12, 0.06, 0.02);
  ctx.closePath();
  fillStroke(ctx, col, C.line);
  /* 模様 */
  ctx.globalAlpha = 0.85;
  ell(ctx, -0.26, 0.2, 0.09, 0.07, 0.4, rgba(C.accent, 0.85), null);
  ell(ctx, -0.26, 0.2, 0.04, 0.032, 0.4, '#fff', null);
  ell(ctx, -0.3, -0.18, 0.05, 0.04, 0.3, rgba(C.accent, 0.6), null);
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(0.02, 0.04); ctx.quadraticCurveTo(-0.2, 0.24, -0.4, 0.36);
  ctx.strokeStyle = C.dark; ctx.lineWidth = 0.012; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.0, -0.01); ctx.quadraticCurveTo(-0.2, 0.08, -0.4, 0.12);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ------------------------------------------------------------------------
   対怪獣ロボ（ゼロガ）
   ------------------------------------------------------------------------ */
FORMS.mecha = function (ctx, C, p, f, time) {
  const cr = p.crouch * 0.1;
  const hipY = 0.42 - cr;
  const lean = p.lean;
  const box = (x, y, w, h, col, rot) => {
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h);
    fillStroke(ctx, col, C.line); ctx.restore();
  };

  /* 奥脚 */
  drawMechLeg(ctx, C, -0.04, hipY, p.legB, shade(C.main, -0.32), box);
  /* 奥腕 */
  drawMechArm(ctx, C, -0.04, hipY + 0.28, p.armB, shade(C.main, -0.32), false, box, p);

  /* 腰と胴 */
  box(0, hipY + 0.02, 0.26, 0.12, shade(C.main, -0.15));
  ctx.save();
  ctx.translate(0, hipY + 0.08);
  ctx.rotate(lean * 0.4);
  ctx.beginPath();
  ctx.moveTo(-0.15, 0); ctx.lineTo(-0.17, 0.22); ctx.lineTo(-0.05, 0.3);
  ctx.lineTo(0.12, 0.28); ctx.lineTo(0.16, 0.1); ctx.lineTo(0.11, -0.01);
  ctx.closePath();
  fillStroke(ctx, C.main, C.line);
  /* 胸のダクト */
  box(0.02, 0.14, 0.16, 0.13, shade(C.main, -0.2));
  for (let i = 0; i < 3; i++) box(0.02, 0.09 + i * 0.045, 0.13, 0.02, C.dark);
  /* コア */
  ell(ctx, 0.02, 0.22, 0.045, 0.045, 0, mixColor(C.accent, '#fff', 0.2 + p.glow * 0.6), C.line, 0.008);
  ctx.save(); ctx.globalAlpha = 0.35 + p.glow * 0.5;
  ell(ctx, 0.02, 0.22, 0.09, 0.09, 0, rgba(C.glowCol, 0.5), null);
  ctx.restore();
  ctx.restore();

  /* 肩のミサイルポッド */
  const shy = hipY + 0.35;
  box(-0.1, shy + 0.02, 0.15, 0.14, shade(C.main, -0.1), -0.15);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    ell(ctx, -0.13 + i * 0.055, shy - 0.01 + j * 0.05, 0.018, 0.018, 0, C.dark, null);
  }

  /* 頭 */
  ctx.save();
  ctx.translate(0.04 + lean * 0.05, hipY + 0.46);
  ctx.rotate(p.head * 0.2);
  ctx.beginPath();
  ctx.moveTo(-0.08, -0.05); ctx.lineTo(-0.09, 0.06); ctx.lineTo(-0.02, 0.11);
  ctx.lineTo(0.08, 0.08); ctx.lineTo(0.1, -0.02); ctx.lineTo(0.03, -0.07);
  ctx.closePath();
  fillStroke(ctx, C.main, C.line);
  /* バイザー */
  ctx.beginPath();
  ctx.moveTo(-0.05, 0.01); ctx.lineTo(0.09, 0.0); ctx.lineTo(0.09, 0.04); ctx.lineTo(-0.05, 0.05);
  ctx.closePath();
  fillStroke(ctx, mixColor(C.eye, '#fff', p.glow * 0.5), null);
  ctx.save(); ctx.globalAlpha = 0.5;
  ell(ctx, 0.03, 0.025, 0.1, 0.045, 0, rgba(C.eye, 0.4), null);
  ctx.restore();
  /* 頭頂のブレード */
  ctx.beginPath();
  ctx.moveTo(-0.03, 0.1); ctx.lineTo(-0.12, 0.2); ctx.lineTo(0.0, 0.13); ctx.closePath();
  fillStroke(ctx, C.accent, C.line, 0.008);
  /* 口のスリット */
  for (let i = 0; i < 3; i++) box(0.05, -0.03 - i * 0.014, 0.07, 0.007, C.dark);
  ctx.restore();

  /* 手前脚 */
  drawMechLeg(ctx, C, 0.04, hipY, p.legF, C.main, box);
  /* 手前腕（ドリル） */
  drawMechArm(ctx, C, 0.06, hipY + 0.3, p.armF, C.main, true, box, p, f, time);
};

function drawMechLeg(ctx, C, x, y, sw, col, box) {
  const knee = polar(x, y, -1.35 + sw * 0.5, 0.22);
  const foot = polar(knee[0], knee[1], -1.65 - sw * 0.5, 0.2);
  ribbonPath(ctx, [[x, y], knee], [0.14, 0.11]);
  fillStroke(ctx, col, C.dark);
  ribbonPath(ctx, [knee, foot], [0.12, 0.09]);
  fillStroke(ctx, shade(col, -0.1), C.dark);
  ell(ctx, knee[0], knee[1], 0.055, 0.055, 0, shade(col, 0.1), C.dark, 0.008);
  box(foot[0] + 0.02, foot[1] - 0.012, 0.19, 0.055, shade(col, -0.15));
}

function drawMechArm(ctx, C, x, y, sw, col, drill, box, p, f, time) {
  const a1 = -1.4 + sw * 1.6;
  const elbow = polar(x, y, a1, 0.18);
  const a2 = a1 + (-0.2 + sw * 1.0);
  const hand = polar(elbow[0], elbow[1], a2, 0.16);
  ell(ctx, x, y, 0.075, 0.07, 0, shade(col, 0.06), C.dark, 0.009);
  ribbonPath(ctx, [[x, y], elbow], [0.1, 0.085]);
  fillStroke(ctx, col, C.dark);
  ribbonPath(ctx, [elbow, hand], [0.09, 0.08]);
  fillStroke(ctx, shade(col, -0.08), C.dark);
  if (drill) {
    /* ドリル */
    const tip = polar(hand[0], hand[1], a2, 0.19);
    ctx.save();
    ctx.translate(hand[0], hand[1]);
    ctx.rotate(a2);
    ctx.beginPath();
    ctx.moveTo(0, -0.06); ctx.lineTo(0.17, 0); ctx.lineTo(0, 0.06); ctx.closePath();
    fillStroke(ctx, shade(C.belly, 0.1), C.dark);
    const spin = (time || 0) * (p && p.atk === 'heavy' ? 1.2 : 0.2);
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 4; i++) {
      const o = ((spin + i * 0.9) % 3.6) * 0.045;
      ctx.beginPath();
      ctx.moveTo(o, -0.055 + o * 0.28); ctx.lineTo(o + 0.02, 0.055 - o * 0.28);
      ctx.strokeStyle = C.dark; ctx.lineWidth = 0.008; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    return tip;
  }
  ell(ctx, hand[0], hand[1], 0.06, 0.058, 0, shade(col, 0.05), C.dark, 0.009);
  return hand;
}

/* ------------------------------------------------------------------------
   甲羅（ガメルド）
   ------------------------------------------------------------------------ */
FORMS.turtle = function (ctx, C, p, f, time) {
  const rolling = p.atk === 'special' || p.atk === 'super';
  const spinning = rolling && p.atkT > 0.2;
  const cr = p.crouch * 0.12;
  const hipY = 0.36 - cr;

  if (spinning) {
    /* 甲羅に籠って回っている */
    ctx.save();
    ctx.translate(0, 0.36 + Math.abs(Math.sin(time * 0.25)) * 0.03);
    ctx.rotate(-(time * 0.5) % (Math.PI * 2));
    ell(ctx, 0, 0, 0.34, 0.32, 0, C.main, C.line, 0.016);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ell(ctx, Math.cos(a) * 0.2, Math.sin(a) * 0.19, 0.09, 0.08, a, shade(C.main, -0.18), C.line, 0.008);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 0.3, Math.sin(a) * 0.29);
      ctx.lineTo(Math.cos(a + 0.1) * 0.42, Math.sin(a + 0.1) * 0.4);
      ctx.lineTo(Math.cos(a + 0.24) * 0.3, Math.sin(a + 0.24) * 0.29);
      ctx.closePath();
      fillStroke(ctx, C.accent, C.line, 0.008);
    }
    ell(ctx, 0, 0, 0.13, 0.12, 0, shade(C.main, -0.3), C.line, 0.01);
    ctx.restore();
    return;
  }

  /* 奥脚 */
  drawFootLeg(ctx, C, -0.07, hipY, p.legB, p.liftB, { stride: 0.075, l1: 0.17, l2: 0.15, ankle: 0.07, lift: 0.05, foot: 0.13, claws: 3, w: 0.115, col: shade(C.main, -0.3) });
  /* 尾 */
  ribbonPath(ctx, [[-0.16, hipY + 0.02], [-0.3, hipY - 0.02 + p.tail * 0.05], [-0.4, hipY - 0.08 + p.tail * 0.1]], [0.11, 0.07, 0.02]);
  fillStroke(ctx, C.main, C.line);

  /* 体 */
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(p.lean * 0.35);
  ell(ctx, 0.02, 0.16, 0.24, 0.2, 0, C.belly, C.line);
  /* 甲羅 */
  ctx.beginPath();
  ctx.moveTo(-0.28, 0.1);
  ctx.quadraticCurveTo(-0.24, 0.46, 0.04, 0.46);
  ctx.quadraticCurveTo(0.28, 0.44, 0.26, 0.08);
  ctx.quadraticCurveTo(0.0, 0.02, -0.28, 0.1);
  ctx.closePath();
  fillStroke(ctx, C.main, C.line, 0.016);
  /* 甲羅の板 */
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.45;
    ell(ctx, -0.02 + Math.cos(a) * 0.16, 0.26 + Math.sin(a) * 0.13, 0.075, 0.062, a * 0.4, shade(C.main, i % 2 ? -0.16 : 0.08), C.line, 0.008);
  }
  ctx.globalAlpha = 1;
  /* 縁のトゲ */
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.1 + i * 0.16);
    const bx = 0.0 + Math.cos(a) * 0.27, by = 0.26 + Math.sin(a) * 0.22;
    ctx.beginPath();
    ctx.moveTo(bx, by - 0.03);
    ctx.lineTo(bx + Math.cos(a) * 0.09, by + Math.sin(a) * 0.08);
    ctx.lineTo(bx, by + 0.03);
    ctx.closePath();
    fillStroke(ctx, C.accent, C.line, 0.008);
  }
  /* 腹甲の線 */
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(-0.15, 0.06 + i * 0.06); ctx.lineTo(0.2, 0.05 + i * 0.06);
    ctx.strokeStyle = C.dark; ctx.lineWidth = 0.008; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  /* 首と頭 */
  const nx = 0.2, ny = hipY + 0.3;
  ribbonPath(ctx, [[0.12, hipY + 0.24], [nx, ny], [nx + 0.06, ny + 0.05]], [0.15, 0.13, 0.12]);
  fillStroke(ctx, shade(C.main, 0.08), C.line);
  ctx.save();
  ctx.translate(nx + 0.06, ny + 0.05);
  ctx.rotate(p.head * 0.25 + p.lean * 0.2);
  ell(ctx, 0.04, 0, 0.1, 0.085, 0, shade(C.main, 0.08), C.line);
  /* あご */
  ctx.save(); ctx.rotate(-p.mouth * 0.5);
  ribbonPath(ctx, [[-0.01, -0.04], [0.07, -0.05], [0.13, -0.05]], [0.06, 0.055, 0.04]);
  fillStroke(ctx, shade(C.main, -0.15), C.line, 0.008);
  ctx.restore();
  if (p.glow > 0.05) ell(ctx, 0.1, -0.01, 0.045 * p.glow + 0.01, 0.04 * p.glow + 0.01, 0, rgba(C.glowCol, 0.9), null);
  /* 牙 */
  ctx.beginPath(); ctx.moveTo(0.07, -0.02); ctx.lineTo(0.085, -0.07); ctx.lineTo(0.1, -0.02); ctx.closePath();
  fillStroke(ctx, '#f6f0df', null);
  drawEye(ctx, 0.04, 0.03, 0.028, C);
  ctx.restore();

  /* 手前脚 */
  drawFootLeg(ctx, C, 0.06, hipY, p.legF, p.liftF, { stride: 0.08, l1: 0.18, l2: 0.16, ankle: 0.07, lift: 0.05, foot: 0.14, claws: 3, w: 0.125, col: C.main });
  /* 手前腕 */
  const h = drawLimb(ctx, 0.14, hipY + 0.2, -1.0 + p.armF * 1.5, 0.14, -0.8 + p.armF * 1.5, 0.11, 0.095, C);
  drawClaws(ctx, h[0], h[1], p.armF * 1.4 - 0.6, 0.05, 3, C);
};

/* ------------------------------------------------------------------------
   八腕（オクトガ）
   ------------------------------------------------------------------------ */
FORMS.cephalopod = function (ctx, C, p, f, time) {
  const baseY = 0.34 - p.crouch * 0.1 + (p.air ? 0.04 : 0);

  /* 後ろの腕 4 本 */
  for (let i = 0; i < 4; i++) drawTentacle(ctx, C, -0.04 - i * 0.02, baseY, i, time, p, -1, p.legB);
  /* マントル（頭） */
  ctx.save();
  ctx.translate(0, baseY);
  ctx.rotate(p.lean * 0.4);
  ctx.beginPath();
  ctx.moveTo(-0.19, 0.06);
  ctx.quadraticCurveTo(-0.16, 0.42, 0.0, 0.52);
  ctx.quadraticCurveTo(0.18, 0.42, 0.2, 0.06);
  ctx.quadraticCurveTo(0.0, -0.04, -0.19, 0.06);
  ctx.closePath();
  fillStroke(ctx, C.main, C.line, 0.015);
  /* まだら */
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    ell(ctx, Math.cos(a) * 0.1, 0.24 + Math.sin(a) * 0.16, 0.035 + (i % 3) * 0.012, 0.028, a, shade(C.main, -0.25), null);
  }
  ctx.globalAlpha = 1;
  /* えら（頭の左右のひれ） */
  for (let s = -1; s <= 1; s += 2) {
    ctx.beginPath();
    ctx.moveTo(s * 0.16, 0.3);
    ctx.quadraticCurveTo(s * 0.3, 0.4, s * 0.26, 0.16);
    ctx.quadraticCurveTo(s * 0.2, 0.16, s * 0.16, 0.24);
    ctx.closePath();
    fillStroke(ctx, mixColor(C.main, C.accent, 0.3), C.line, 0.009);
  }
  /* 大きな目 */
  ell(ctx, 0.09, 0.15, 0.085, 0.075, -0.1, '#f6f2e4', C.line, 0.01);
  ell(ctx, 0.115, 0.15, 0.045, 0.03, 0, '#1a0d16', null);
  ell(ctx, 0.09, 0.175, 0.024, 0.018, 0, 'rgba(255,255,255,.75)', null);
  /* 口（くちばし） */
  ctx.save(); ctx.translate(0.02, 0.0);
  ctx.beginPath();
  ctx.moveTo(-0.045, 0.02); ctx.lineTo(0.02, -0.02 - p.mouth * 0.03); ctx.lineTo(0.045, 0.03);
  ctx.closePath();
  fillStroke(ctx, C.dark, null);
  ctx.restore();
  if (p.glow > 0.05) {
    ctx.save(); ctx.globalAlpha = p.glow * 0.7;
    ell(ctx, 0.02, 0.0, 0.09, 0.07, 0, rgba(C.glowCol, 0.6), null);
    ctx.restore();
  }
  ctx.restore();

  /* 前の腕 4 本（うち 2 本は攻撃で伸びる） */
  for (let i = 0; i < 4; i++) drawTentacle(ctx, C, 0.02 + i * 0.03, baseY, i + 4, time, p, 1, i < 2 ? p.armF : p.legF);
};

function drawTentacle(ctx, C, x, y, i, time, p, dirZ, sw) {
  const ph = time * 0.05 + i * 1.3;
  const reach = clamp(sw, -1, 1);
  const front = i >= 4;
  const spread = (i % 4) * 0.16 + 0.1;
  const pts = [];
  const segs = 5;
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const bend = Math.sin(ph + t * 2.4) * 0.06 * (1 - t * 0.3);
    const fx = front ? (0.1 + reach * 0.45) * t * t : -(0.06 + spread * 0.5) * t * t;
    const fy = -y * t * (front ? 0.92 : 0.95) + Math.sin(ph + t * 3) * 0.03 + bend;
    pts.push([x + fx + (front ? spread * 0.2 * t : 0), y + fy * 1.0 + (front ? reach * 0.12 * t : 0)]);
  }
  const w0 = front ? 0.085 : 0.075;
  ribbonPath(ctx, pts, [w0, w0 * 0.9, w0 * 0.75, w0 * 0.58, w0 * 0.4, w0 * 0.18]);
  fillStroke(ctx, dirZ > 0 ? C.main : shade(C.main, -0.28), C.line);
  /* 吸盤 */
  ctx.globalAlpha = 0.85;
  for (let s = 1; s < pts.length; s++) {
    const r = w0 * (0.26 - s * 0.03);
    if (r <= 0.004) continue;
    ell(ctx, pts[s][0] + 0.01, pts[s][1], r, r, 0, dirZ > 0 ? C.belly : shade(C.belly, -0.3), null);
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------------
   溶岩の巨人（ヴォルガ）
   ------------------------------------------------------------------------ */
FORMS.golem = function (ctx, C, p, f, time) {
  const cr = p.crouch * 0.12;
  const hipY = 0.4 - cr;
  const lean = p.lean;
  const heat = 0.45 + Math.sin(time * 0.06) * 0.12 + p.glow * 0.5;
  const lava = mixColor(C.belly, '#fff2a8', clamp(heat - 0.4, 0, 0.6));

  /* 割れ目を描く小物 */
  const crack = (x, y, len, a, w) => {
    let cx = x, cy = y, ca = a;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    for (let i = 0; i < 4; i++) {
      ca += Math.sin(i * 2.3 + x * 40) * 0.6;
      cx += Math.cos(ca) * len / 4; cy += Math.sin(ca) * len / 4;
      ctx.lineTo(cx, cy);
    }
    ctx.strokeStyle = lava; ctx.lineWidth = w || 0.014; ctx.stroke();
  };

  /* 奥脚 */
  drawRockLeg(ctx, C, -0.06, hipY, p.legB, p.liftB, shade(C.main, -0.3));
  /* 奥腕 */
  drawRockArm(ctx, C, -0.06, hipY + 0.3, p.armB, shade(C.main, -0.3), crack, lava, 0.9);

  /* 胴：岩の塊 */
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean * 0.4);
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.02); ctx.lineTo(-0.24, 0.2); ctx.lineTo(-0.14, 0.36);
  ctx.lineTo(0.04, 0.42); ctx.lineTo(0.2, 0.34); ctx.lineTo(0.22, 0.12);
  ctx.lineTo(0.12, -0.04);
  ctx.closePath();
  fillStroke(ctx, C.main, C.line, 0.016);
  /* 溶岩の割れ目 */
  ctx.save();
  ctx.globalAlpha = 0.95;
  crack(-0.1, 0.06, 0.3, 1.1, 0.018);
  crack(0.08, 0.1, 0.24, 2.0, 0.014);
  crack(-0.02, 0.34, 0.2, -1.2, 0.012);
  ctx.restore();
  /* 胸の火口 */
  ell(ctx, 0.0, 0.2, 0.09, 0.07, 0.1, lava, C.line, 0.01);
  ctx.save(); ctx.globalAlpha = 0.35 + p.glow * 0.4;
  ell(ctx, 0.0, 0.2, 0.18, 0.15, 0, rgba(C.glow, 0.5), null);
  ctx.restore();
  ctx.restore();

  /* 肩の岩 */
  rockChunk(ctx, C, -0.14, hipY + 0.36, 0.11, 3);
  rockChunk(ctx, C, 0.1, hipY + 0.36, 0.12, 7);

  /* 頭 */
  ctx.save();
  ctx.translate(0.03 + lean * 0.06, hipY + 0.48);
  ctx.rotate(p.head * 0.2);
  ctx.beginPath();
  ctx.moveTo(-0.1, -0.04); ctx.lineTo(-0.11, 0.07); ctx.lineTo(-0.02, 0.13);
  ctx.lineTo(0.1, 0.09); ctx.lineTo(0.12, -0.03); ctx.lineTo(0.02, -0.08);
  ctx.closePath();
  fillStroke(ctx, shade(C.main, 0.06), C.line, 0.013);
  /* 口 */
  ctx.beginPath();
  ctx.moveTo(-0.02, -0.02); ctx.lineTo(0.11, -0.01); ctx.lineTo(0.1, -0.03 - p.mouth * 0.05); ctx.lineTo(-0.02, -0.045 - p.mouth * 0.04);
  ctx.closePath();
  fillStroke(ctx, lava, null);
  drawEye(ctx, 0.04, 0.04, 0.028, C);
  /* 角 */
  ctx.beginPath(); ctx.moveTo(-0.06, 0.1); ctx.lineTo(-0.12, 0.22); ctx.lineTo(-0.02, 0.12); ctx.closePath();
  fillStroke(ctx, C.dark, C.line, 0.008);
  ctx.beginPath(); ctx.moveTo(0.04, 0.11); ctx.lineTo(0.06, 0.24); ctx.lineTo(0.1, 0.09); ctx.closePath();
  fillStroke(ctx, C.dark, C.line, 0.008);
  ctx.restore();

  /* 手前脚 */
  drawRockLeg(ctx, C, 0.05, hipY, p.legF, p.liftF, C.main);
  /* 手前腕 */
  drawRockArm(ctx, C, 0.06, hipY + 0.32, p.armF, C.main, crack, lava, 1);
};

function rockChunk(ctx, C, x, y, r, seed) {
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const rr = r * (0.78 + ((Math.sin(seed * 12.9 + i * 4.7) + 1) / 2) * 0.4);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  fillStroke(ctx, shade(C.main, 0.08), C.dark, 0.012);
}

function drawRockLeg(ctx, C, x, y, sw, lift, col) {
  const ankle = drawFootLeg(ctx, C, x, y, sw, lift, {
    stride: 0.1, l1: 0.22, l2: 0.2, ankle: 0.1, lift: 0.07, foot: 0.02, claws: 0,
    w: 0.165, col,
  });
  /* 岩の足 */
  ctx.beginPath();
  ctx.moveTo(ankle[0] - 0.1, 0.045); ctx.lineTo(ankle[0] + 0.13, 0.04);
  ctx.lineTo(ankle[0] + 0.11, 0.0); ctx.lineTo(ankle[0] - 0.09, 0.0);
  ctx.closePath();
  fillStroke(ctx, col, C.dark, 0.013);
}

function drawRockArm(ctx, C, x, y, sw, col, crack, lava, sc) {
  const a1 = -1.45 + sw * 1.6;
  const elbow = polar(x, y, a1, 0.22 * sc);
  const a2 = a1 + (-0.35 + sw * 1.1);
  const hand = polar(elbow[0], elbow[1], a2, 0.2 * sc);
  ribbonPath(ctx, [[x, y], elbow, hand], [0.15 * sc, 0.13 * sc, 0.12 * sc]);
  fillStroke(ctx, col, C.dark, 0.014);
  ctx.save(); ctx.globalAlpha = 0.8;
  crack(elbow[0], elbow[1], 0.12 * sc, a2, 0.01);
  ctx.restore();
  /* こぶし */
  ctx.save();
  ctx.translate(hand[0], hand[1]);
  ctx.rotate(a2);
  ctx.beginPath();
  ctx.moveTo(-0.08 * sc, -0.09 * sc); ctx.lineTo(0.11 * sc, -0.07 * sc);
  ctx.lineTo(0.13 * sc, 0.06 * sc); ctx.lineTo(-0.06 * sc, 0.1 * sc);
  ctx.closePath();
  fillStroke(ctx, shade(col, 0.05), C.dark, 0.013);
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(0.02 * sc, -0.06 * sc); ctx.lineTo(0.05 * sc, 0.07 * sc);
  ctx.strokeStyle = lava; ctx.lineWidth = 0.012 * sc; ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
  return hand;
}
