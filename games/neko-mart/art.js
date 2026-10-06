/* =========================================================================
   NEKO MART ― 絵
   動物とファッションの描きかた / 商品のアイコン / かいた絵の読み込み
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

/* ------------------------------ かいた絵 ------------------------------
   dataURL を Image にして覚えておく。読み込みが終わるまでは null */
const Pics = {
  map: new Map(),
  get(key, data) {
    if (!data) return null;
    let e = this.map.get(key);
    if (!e || e.data !== data) {
      const img = new Image();
      e = { data, img, ok: false };
      img.onload = () => { e.ok = true; ProdArt.cache.clear(); ProdArt.urls.clear(); };
      img.src = data;
      this.map.set(key, e);
    }
    return e.ok ? e.img : null;
  },
};

/* =========================================================================
   動物 (猫・いぬ・うさぎ・くま…)
   look = { sp, coat, eye, eye2, head, headCol, face, neck, neckCol, body, bodyCol, size, seed }
     猫の coat は COATS の id、ほかの動物は SPECIES[sp].cols の番号。eye2 はオッドアイの左目
   o    = { dir: 'd'|'u'|'l'|'r', t, walk, moving, happy, blink, sad, open, box, basket, umbrella, umbClosed, eat, spin }
   (x, y) は足もと。高さはおよそ 40 (size 1)
   ========================================================================= */

/* 動物ごとの色をそろえる */
function palOf(look) {
  const sp = look.sp || 'cat';
  if (sp === 'cat') {
    const c = COAT[look.coat] || COATS[0];
    return { cat: c, base: c.base, sub: c.pat === 'tux' ? c.white : '#fffaf2', ear: c.pat === 'point' ? c.point : c.base,
      foot: c.pat === 'tux' ? c.white : c.pat === 'point' ? c.point : c.base, ol: shade(c.base, -0.5) };
  }
  const S = SPECIES[sp];
  const p = S.cols[look.coat | 0] || S.cols[0];
  return { base: p.base, sub: p.sub, ear: p.ear || p.base, mark: p.mark || shade(p.base, -0.4),
    foot: p.foot || (S.panda ? p.sub : p.base), point: p.point, ol: shade(p.base, -0.5) };
}
const wearCol = (look, slot) => look[slot + 'Col'] || fashionOf(slot, look[slot] || 'none').col || '#ff8fa3';

function drawAnimal(ctx, x, y, look, o = {}) {
  const sp = look.sp || 'cat', S = SPECIES[sp], P = palOf(look);
  const dir = o.dir || 'd', t = o.t || 0, s = look.size || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (o.spin) ctx.rotate(Math.sin(o.spin * 18) * 0.35);
  ctx.fillStyle = 'rgba(50,35,25,0.2)';
  ellipse(ctx, 0, 0, 11, 3.6); ctx.fill();
  if (o.umbrella && dir !== 'u') drawUmbrellaOpen(ctx, o.umbrella, true);
  const lift = o.moving ? Math.sin(o.walk || 0) : 0;
  const bob = o.moving ? -Math.abs(Math.sin(o.walk || 0)) * 2 : Math.sin(t * 2.2) * 0.35;
  const wag = Math.sin(t * (S.tail === 'wag' ? 14 : o.moving ? 7 : 2.6)) * (o.happy ? 5 : 2.5);
  const blink = o.blink || ((t * 0.7 + (look.seed || 0)) % 4.2) < 0.12;
  const flip = dir === 'l';
  if (flip) ctx.scale(-1, 1);
  const view = dir === 'l' || dir === 'r' ? 'side' : dir;
  const A = { look, sp, S, P, view, bob, flip, blink, o };
  const hx = view === 'side' ? 2.5 : 0, hy = -24 + bob;

  if (view === 'u') {
    if (o.box) drawBox(ctx, o.box, 0, -12 + bob, 0.85);
    drawFeet(ctx, A, lift);
    drawBodyBase(ctx, A);
    drawWearBody(ctx, A, 'over');
    drawWearNeck(ctx, A, hx);
    drawHeadAll(ctx, A, hx, hy);
    drawTailAll(ctx, A, wag);
    if (o.umbrella) drawUmbrellaOpen(ctx, o.umbrella, false);
    ctx.restore();
    return;
  }
  drawTailAll(ctx, A, wag);
  drawWearBody(ctx, A, 'behind');
  if (o.umbClosed) drawUmbrellaClosed(ctx, o.umbClosed);
  drawFeet(ctx, A, lift);
  drawBodyBase(ctx, A);
  drawWearBody(ctx, A, 'over');
  drawWearNeck(ctx, A, hx);
  if (o.box) drawBox(ctx, o.box, view === 'side' ? 6 : 0, -10 + bob, 1);
  drawHeadAll(ctx, A, hx, hy);
  if (o.basket) drawBasket(ctx, o.basket, view === 'side' ? 7 : 9, -6 + bob);
  if (o.eat) drawEatItem(ctx, o.eat, view === 'side' ? 9 : 0, -17 + bob);
  if (o.umbrella) drawUmbrellaOpen(ctx, o.umbrella, false);
  ctx.restore();
}

function drawFeet(ctx, A, lift) {
  const { P, S, view } = A;
  ctx.fillStyle = P.foot; ctx.strokeStyle = S.penguin ? '#c07020' : P.ol; ctx.lineWidth = 1;
  [-4.4, 4.4].forEach((fx, i) => {
    const l = i ? -lift : lift;
    if (S.penguin) ellipse(ctx, fx + (view === 'side' ? 1.5 : 0), -1.4 - Math.max(0, l) * 1.6, 4, 1.8);
    else ellipse(ctx, fx, -1.8 - Math.max(0, l) * 2.2, 3.6, 2.5);
    ctx.fill(); ctx.stroke();
  });
}

function bodyBox(A) {
  const big = A.S.hamster;
  return { y: -10.5 + A.bob * 0.5, rx: (A.view === 'side' ? 10.5 : 9.5) + (big ? 1 : 0), ry: big ? 8.8 : 8.4 };
}
function drawBodyBase(ctx, A) {
  const { P, S, view } = A;
  const { y, rx, ry } = bodyBox(A);
  ctx.fillStyle = P.base;
  ellipse(ctx, 0, y, rx, ry); ctx.fill();
  ctx.save();
  ellipse(ctx, 0, y, rx, ry); ctx.clip();
  const c = P.cat;
  if (c) {
    if (c.pat === 'tabby') {
      ctx.strokeStyle = c.stripe; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (const sg of view === 'side' ? [-1] : [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(sg * (rx - 0.5), y - 5 + k * 4);
          ctx.quadraticCurveTo(sg * (rx - 4), y - 4 + k * 4, sg * (rx - 5.5), y - 2 + k * 4);
          ctx.stroke();
        }
      }
      if (view === 'u') { ctx.beginPath(); ctx.moveTo(0, y - 8); ctx.lineTo(0, y + 6); ctx.stroke(); }
    } else if (c.pat === 'tux' && view !== 'u') {
      ctx.fillStyle = c.white; ellipse(ctx, view === 'side' ? 4 : 0, y + 1.5, 5.5, 7); ctx.fill();
    } else if (c.pat === 'calico') {
      ctx.fillStyle = c.p1; ellipse(ctx, -6, y - 2, 6, 5); ctx.fill();
      ctx.fillStyle = c.p2; ellipse(ctx, 6.5, y + 3, 5, 4.2); ctx.fill();
    } else if (c.pat === 'point') {
      ctx.fillStyle = rgba(c.point, 0.18); ellipse(ctx, 0, y + 6, rx, 4); ctx.fill();
    }
  } else if (S.panda) {
    ctx.fillStyle = P.sub; ellipse(ctx, 0, y - 4.5, rx + 1, 4.4); ctx.fill();
  } else if (view !== 'u') {
    ctx.fillStyle = P.sub;
    if (S.penguin) ellipse(ctx, view === 'side' ? 3.5 : 0, y + 1.5, view === 'side' ? 5.5 : 6.8, 7.4);
    else ellipse(ctx, view === 'side' ? 4 : 0, y + 2, 5.5, 6);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = P.ol; ctx.lineWidth = 1.1;
  ellipse(ctx, 0, y, rx, ry); ctx.stroke();
  if (S.penguin) {
    ctx.fillStyle = P.base;
    const fl = view === 'side' ? [[-1, -0.3]] : [[-(rx - 0.5), 0.35], [rx - 0.5, -0.35]];
    for (const [fx, r] of fl) { ellipse(ctx, fx, y - 0.5, 2.6, 6, r); ctx.fill(); ctx.stroke(); }
  }
}

/* しっぽ。種類ごとに形がちがう */
function drawTailAll(ctx, A, wag) {
  const { P, S, view } = A;
  const kind = S.tail || 'cat';
  if (kind === 'none') return;
  if (kind === 'puff' || kind === 'stub') {
    if (view === 'd') return;
    const r = kind === 'puff' ? 3.6 : 2.7;
    ctx.fillStyle = kind === 'puff' ? P.sub : P.base; ctx.strokeStyle = P.ol; ctx.lineWidth = 1;
    ellipse(ctx, view === 'side' ? -10 : 0, view === 'side' ? -8 : -7, r, r); ctx.fill(); ctx.stroke();
    return;
  }
  let pts;
  const short = kind === 'wag';
  if (view === 'side') pts = short ? [-7, -8, -12, -10, -13 + wag * 0.3, -16] : [-7, -7, -15, -10 + wag * 0.3, -14 - wag * 0.4, -21];
  else if (view === 'u') pts = short ? [0, -7, wag * 0.5, -11, wag * 0.8, -16] : [0, -6, 9 + wag * 0.4, -12, 7 + wag, -22];
  else pts = short ? [6, -8, 11, -10, 11 + wag * 0.4, -16] : [7, -7, 15, -10, 13 + wag * 0.6, -21];
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]); };
  const bushy = kind === 'bushy';
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.ol; ctx.lineWidth = bushy ? 10.5 : short ? 6 : 5.6; path(); ctx.stroke();
  const c = P.cat;
  ctx.strokeStyle = c && c.pat === 'point' ? c.point : P.base; ctx.lineWidth = bushy ? 8.5 : short ? 4.2 : 3.8; path(); ctx.stroke();
  if (c && c.pat === 'tabby') {
    ctx.strokeStyle = c.stripe; ctx.setLineDash([2, 3.2]); path(); ctx.stroke(); ctx.setLineDash([]);
  } else if (c && (c.pat === 'tux' || c.pat === 'calico')) {
    ctx.fillStyle = c.pat === 'tux' ? c.white : c.p1; ellipse(ctx, pts[4], pts[5], 2.2, 2.2); ctx.fill();
  } else if (bushy && A.sp === 'tanuki') {
    ctx.strokeStyle = P.mark; ctx.setLineDash([2.5, 4]); path(); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = P.mark; ellipse(ctx, pts[4], pts[5], 4, 4); ctx.fill();
  } else if (bushy) {
    ctx.fillStyle = P.sub; ellipse(ctx, pts[4], pts[5], 4, 4); ctx.fill();
  } else if (P.point) {
    ctx.fillStyle = P.sub; ellipse(ctx, pts[4], pts[5], 2, 2); ctx.fill();
  }
}

/* 耳。頭より先に描く (いぬのたれ耳だけは頭のあと) */
function triEars(ctx, A, hx, hy, k, col, inner, tip) {
  const { view, P } = A;
  const ears = view === 'side' ? [[-8.5, -1, 0.85], [2.5, 1, 1]] : [[0, -1, 1], [0, 1, 1]];
  for (const [ex, sg, sc] of ears) {
    const bx = hx + ex;
    const p = view === 'side'
      ? [[bx - 1.5, hy - 6], [bx + 1.5 * sg, hy - 15 * sc * k], [bx + 6.5, hy - 8]]
      : [[bx + sg * 10.4 * Math.sqrt(k), hy - 4], [bx + sg * 8.6 * k, hy - 15 * k], [bx + sg * 2.6, hy - 9.6]];
    const tri = (q) => { ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.closePath(); };
    tri(p);
    ctx.fillStyle = typeof col === 'function' ? col(sg) : col; ctx.fill();
    if (tip) {
      const m = (a, b, f) => [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
      ctx.fillStyle = tip; tri([m(p[1], p[0], 0.35), p[1], m(p[1], p[2], 0.35)]); ctx.fill();
    }
    tri(p);
    ctx.strokeStyle = P.ol; ctx.lineWidth = 1.1; ctx.lineJoin = 'round'; ctx.stroke();
    if (view !== 'u' && inner) {
      const cen = [(p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3];
      tri(p.map((pt) => [lerp(cen[0], pt[0], 0.55), lerp(cen[1], pt[1], 0.55)]));
      ctx.fillStyle = inner; ctx.fill();
    }
  }
}
function drawEarsBack(ctx, A, hx, hy) {
  const { S, P, view, sp } = A;
  let type = S.ears || 'cat';
  if (sp === 'dog' && P.point) type = 'cat';
  ctx.strokeStyle = P.ol; ctx.lineWidth = 1.1;
  if (type === 'cat') {
    const c = P.cat;
    triEars(ctx, A, hx, hy, 1, c && c.pat === 'calico' ? (sg) => (sg < 0 ? c.p1 : c.p2) : P.ear, sp === 'dog' ? P.sub : '#f2a0ae');
  } else if (type === 'fox') {
    triEars(ctx, A, hx, hy, 1.25, P.base, P.sub, P.mark);
  } else if (type === 'long') {
    const list = view === 'side' ? [[-3, -0.3], [0.5, -0.15]] : [[-4.6, -0.12], [4.6, 0.12]];
    list.forEach(([ex, r], i) => {
      ctx.fillStyle = P.base; ellipse(ctx, hx + ex, hy - 17, 3.7, 10, r); ctx.fill(); ctx.stroke();
      if (view !== 'u' && (view !== 'side' || i === 1)) { ctx.fillStyle = '#f6b6c2'; ellipse(ctx, hx + ex, hy - 16.5, 1.8, 7, r); ctx.fill(); }
    });
  } else if (type === 'round' || type === 'small') {
    const big = type === 'round';
    const list = view === 'side' ? [[-3.5, big ? -10 : -9.5]] : [[-(big ? 8.6 : 8), big ? -8.4 : -8], [big ? 8.6 : 8, big ? -8.4 : -8]];
    for (const [ex, ey] of list) {
      ctx.fillStyle = big ? P.ear : P.base;
      ellipse(ctx, hx + ex, hy + ey, big ? 4.6 : 3.4, big ? 4.6 : 3.4); ctx.fill(); ctx.stroke();
      if (view !== 'u' && !S.panda) {
        ctx.fillStyle = big ? P.sub : '#f6b6c2';
        ellipse(ctx, hx + ex, hy + ey, big ? 2.4 : 1.9, big ? 2.4 : 1.9); ctx.fill();
      }
    }
  }
}
function drawEarsFlop(ctx, A, hx, hy) {
  const { S, P, view, sp } = A;
  if (S.ears !== 'flop' || (sp === 'dog' && P.point)) return;
  ctx.fillStyle = P.ear; ctx.strokeStyle = P.ol; ctx.lineWidth = 1.1;
  const list = view === 'side' ? [[-4, 0.35]] : [[-10.2, 0.28], [10.2, -0.28]];
  for (const [ex, r] of list) { ellipse(ctx, hx + ex, hy - 0.5, 4.2, 7.8, r); ctx.fill(); ctx.stroke(); }
}

function drawHeadAll(ctx, A, hx, hy) {
  const { S, P, view, look, o, blink, sp } = A;
  const c = P.cat;
  const r = S.hamster ? 12.2 : 11.5, ry = S.hamster ? 10.6 : 11.5 * 0.94;
  const side = view === 'side', back = view === 'u';
  drawEarsBack(ctx, A, hx, hy);
  ctx.fillStyle = P.base;
  ellipse(ctx, hx, hy, r, ry); ctx.fill();
  ctx.save();
  ellipse(ctx, hx, hy, r, ry); ctx.clip();
  if (c) {
    if (c.pat === 'tabby') {
      ctx.strokeStyle = c.stripe; ctx.lineWidth = 1.9; ctx.lineCap = 'round';
      const fx = side ? hx + 1 : hx;
      for (const dx of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(fx + dx, hy - r + 0.5); ctx.lineTo(fx + dx * 0.7, hy - r + 5); ctx.stroke(); }
      if (!back) {
        for (const sg of side ? [-1] : [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(hx + sg * r, hy - 1); ctx.lineTo(hx + sg * (r - 3.5), hy - 0.5); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(hx + sg * r, hy + 2.5); ctx.lineTo(hx + sg * (r - 3), hy + 2.5); ctx.stroke();
        }
      }
    } else if (c.pat === 'tux' && !back) {
      vFace(ctx, side ? hx + 6 : hx, hy, r, -8.5, c.white);
    } else if (c.pat === 'calico') {
      ctx.fillStyle = c.p1; ellipse(ctx, hx - 8, hy - 8, 8, 7); ctx.fill();
      ctx.fillStyle = c.p2; ellipse(ctx, hx + 9, hy - 7, 6.5, 6); ctx.fill();
    } else if (c.pat === 'point' && !back) {
      const mx = side ? hx + 7 : hx;
      const g = ctx.createRadialGradient(mx, hy + 3, 1, mx, hy + 3, 8.5);
      g.addColorStop(0, rgba(c.point, 0.95)); g.addColorStop(0.6, rgba(c.point, 0.7)); g.addColorStop(1, rgba(c.point, 0));
      ctx.fillStyle = g; ellipse(ctx, mx, hy + 3, 9, 8); ctx.fill();
    }
  } else if (!back) {
    const ex = side ? [hx + 6.6] : [hx - 4.6, hx + 4.6];
    if (S.cheeks) vFace(ctx, side ? hx + 6 : hx, hy, r, -2, P.sub);
    if (S.muzzle && !side) { ctx.fillStyle = P.sub; ellipse(ctx, hx, hy + 4.4, 6.4, 4.6); ctx.fill(); }
    if (S.mask) {
      ctx.fillStyle = P.mark;
      ex.forEach((x) => { ellipse(ctx, x, hy + 1, 3.9, 3.3, x < hx ? 0.25 : -0.25); ctx.fill(); });
      if (!side) { ctx.fillStyle = P.sub; ellipse(ctx, hx, hy + 5.2, 4.5, 3.3); ctx.fill(); }
    }
    if (S.panda) { ctx.fillStyle = P.sub; ex.forEach((x) => { ellipse(ctx, x, hy + 1, 3.2, 4.3, side ? -0.3 : x < hx ? 0.45 : -0.45); ctx.fill(); }); }
    if (S.penguin) {
      ctx.fillStyle = P.sub;
      if (side) { ellipse(ctx, hx + 5, hy + 1.5, 6, 6.6); ctx.fill(); }
      else { ellipse(ctx, hx - 3.6, hy + 1.5, 5.2, 6.4); ctx.fill(); ellipse(ctx, hx + 3.6, hy + 1.5, 5.2, 6.4); ctx.fill(); }
    }
    if (S.hamster) { ctx.fillStyle = P.sub; ellipse(ctx, side ? hx + 4 : hx, hy + 5.5, 9.5, 6); ctx.fill(); }
  }
  if (!back) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ellipse(ctx, hx - 3, hy - 5, 6, 3.4, -0.3); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle = P.ol; ctx.lineWidth = 1.2;
  ellipse(ctx, hx, hy, r, ry); ctx.stroke();
  if (S.hamster && !back) {
    ctx.fillStyle = P.sub;
    for (const x of side ? [hx + 8] : [hx - 9.5, hx + 9.5]) { ellipse(ctx, x, hy + 4.2, 4.4, 3.6); ctx.fill(); ctx.stroke(); }
  }
  /* 横向きのいぬ・くま・たぬきは鼻づらが前に出る */
  if (side && S.nose === 'big') {
    ctx.fillStyle = P.sub; ellipse(ctx, hx + 9.6, hy + 4, 4.8, 3.7); ctx.fill(); ctx.stroke();
  }
  drawEarsFlop(ctx, A, hx, hy);
  if (back) { drawWearHead(ctx, A, hx, hy); return; }

  /* かお */
  const eyeY = hy + 0.5;
  const eyes = side ? [hx + 6.6] : [hx - 4.4, hx + 4.4];
  const onDark = S.panda || S.mask;
  for (const ex of eyes) {
    const ink = onDark ? '#ffffff' : '#2b2230';
    if (o.happy) {
      ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(ex, eyeY + 1, 2.2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    } else if (blink) {
      ctx.strokeStyle = ink; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(ex - 2.2, eyeY); ctx.lineTo(ex + 2.2, eyeY); ctx.stroke();
    } else if (o.sad) {
      ctx.fillStyle = ink; ellipse(ctx, ex, eyeY + 0.6, 1.6, 1.8); ctx.fill();
      const tilt = ex < hx ? 1 : -1;
      ctx.strokeStyle = ink; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(ex - 2.4, eyeY - 3 + tilt * 0.8); ctx.lineTo(ex + 2.4, eyeY - 3 - tilt * 0.8); ctx.stroke();
    } else if (c) {
      /* 右目は look.eye、左目は look.eye2 (オッドアイ)。正面では向かって左が右目 */
      const left = side ? A.flip : ex > hx;
      ctx.fillStyle = (left && look.eye2) || look.eye || EYES[0];
      ellipse(ctx, ex, eyeY, 2.3, 2.8); ctx.fill();
      ctx.fillStyle = c.base === '#3d3c48' && c.pat !== 'tux' ? '#191820' : '#2b2230';
      ellipse(ctx, ex, eyeY + 0.2, 1.25, 2.3); ctx.fill();
      ctx.fillStyle = '#fff'; ellipse(ctx, ex + 0.8, eyeY - 1.1, 0.75, 0.75); ctx.fill();
    } else if (onDark) {
      ctx.fillStyle = '#fff'; ellipse(ctx, ex, eyeY + 0.4, 1.8, 2); ctx.fill();
      ctx.fillStyle = '#1e1d24'; ellipse(ctx, ex, eyeY + 0.6, 1.15, 1.4); ctx.fill();
    } else {
      ctx.fillStyle = '#2b2230'; ellipse(ctx, ex, eyeY, 1.8, 2.2); ctx.fill();
      ctx.fillStyle = '#fff'; ellipse(ctx, ex + 0.7, eyeY - 0.9, 0.65, 0.65); ctx.fill();
    }
  }
  /* はな・くち */
  const nose = c ? 'cat' : S.penguin ? 'beak' : S.nose || 'small';
  let nx = side ? hx + 11.2 : hx, ny = hy + 4;
  const mouth = (mx, my) => {
    ctx.strokeStyle = c ? shade(c.pat === 'point' ? c.point : c.base, -0.6) : '#5a4248'; ctx.lineWidth = 0.9;
    if (o.open) { ctx.fillStyle = '#c0485e'; ellipse(ctx, mx, my + 1.6, 1.6, 1.4); ctx.fill(); return; }
    ctx.beginPath(); ctx.arc(mx - 1.2, my + 0.1, 1.2, 0.1, Math.PI - 0.3); ctx.stroke();
    if (!side) { ctx.beginPath(); ctx.arc(mx + 1.2, my + 0.1, 1.2, 0.3, Math.PI - 0.1); ctx.stroke(); }
  };
  if (nose === 'cat') {
    ctx.fillStyle = '#ef8a9c';
    ctx.beginPath(); ctx.moveTo(nx - 1.5, ny - 0.8); ctx.lineTo(nx + 1.5, ny - 0.8); ctx.lineTo(nx, ny + 0.9); ctx.closePath(); ctx.fill();
    mouth(nx, ny + 1);
  } else if (nose === 'big') {
    if (side) nx = hx + 13.4;
    ny = side ? hy + 3 : hy + 3.2;
    if (sp === 'dog' && (o.happy || o.open)) { ctx.fillStyle = '#ff7f96'; ellipse(ctx, nx - (side ? 1.5 : 0), ny + 4.4, 1.6, 2.1); ctx.fill(); }
    ctx.fillStyle = '#2b2230'; ellipse(ctx, nx, ny, side ? 1.8 : 2.3, 1.6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ellipse(ctx, nx - 0.6, ny - 0.6, 0.7, 0.45); ctx.fill();
    ctx.strokeStyle = '#5a4248'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(nx, ny + 1.4); ctx.lineTo(nx, ny + 2.4); ctx.stroke();
    mouth(nx, ny + 2.4);
  } else if (nose === 'small') {
    ctx.fillStyle = '#2b2230'; ellipse(ctx, nx, ny - 0.2, 1.4, 1); ctx.fill();
    mouth(nx, ny + 1);
  } else if (nose === 'bunny') {
    ctx.fillStyle = '#f08aa0'; ellipse(ctx, nx, ny - 0.4, 1.3, 0.9); ctx.fill();
    ctx.strokeStyle = '#8a5a64'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(nx, ny + 0.4); ctx.lineTo(nx, ny + 1.5);
    ctx.moveTo(nx, ny + 1.5); ctx.lineTo(nx - 1.3, ny + 2.3);
    if (!side) { ctx.moveTo(nx, ny + 1.5); ctx.lineTo(nx + 1.3, ny + 2.3); }
    ctx.stroke();
    if (sp === 'rabbit' && !side) { ctx.fillStyle = '#fff'; ctx.fillRect(nx - 1, ny + 2.2, 2, 1.6); ctx.strokeRect(nx - 1, ny + 2.2, 2, 1.6); }
  } else if (nose === 'beak') {
    ctx.fillStyle = '#ffa94d'; ctx.strokeStyle = '#c07020'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    if (side) { ctx.moveTo(hx + 9.5, hy + 2); ctx.lineTo(hx + 15.5, hy + 3.4); ctx.lineTo(hx + 9.5, hy + 5); }
    else { ctx.moveTo(nx - 3, ny - 1.6); ctx.lineTo(nx + 3, ny - 1.6); ctx.lineTo(nx, ny + 2.2); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,130,150,0.32)';
  for (const ex of eyes) { ellipse(ctx, ex + (side ? -1 : ex < hx ? -2.6 : 2.6), eyeY + 4.2, 2.4, 1.4); ctx.fill(); }
  if (c || S.whisk) {
    ctx.strokeStyle = 'rgba(60,50,60,0.45)'; ctx.lineWidth = 0.6;
    for (const sg of side ? [1] : [-1, 1]) {
      const wx = side ? hx + 9 : hx + sg * 5.5;
      ctx.beginPath(); ctx.moveTo(wx, ny + 1); ctx.lineTo(wx + sg * 7.5, ny - 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(wx, ny + 2); ctx.lineTo(wx + sg * 7.5, ny + 2.6); ctx.stroke();
    }
  }
  drawWearFace(ctx, A, hx, eyes, eyeY, nx, ny);
  drawWearHead(ctx, A, hx, hy);
}
/* はちわれ猫やきつねの、下が白い顔 */
function vFace(ctx, mx, hy, r, top, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(mx - 9, hy + r);
  ctx.lineTo(mx - 8, hy + 1.5);
  ctx.quadraticCurveTo(mx - 2.5, hy - 1, mx, hy + top);
  ctx.quadraticCurveTo(mx + 2.5, hy - 1, mx + 8, hy + 1.5);
  ctx.lineTo(mx + 9, hy + r);
  ctx.closePath(); ctx.fill();
}

/* ------------------------------ ファッション ------------------------------ */
function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
  ctx.closePath();
}
function starPath(ctx, x, y, r1, r2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? r2 : r1;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function drawWearBody(ctx, A, phase) {
  const { look, view, P } = A;
  const id = look.body || 'none';
  if (id === 'none') return;
  const col = wearCol(look, 'body'), dk = shade(col, -0.3);
  const { y, rx, ry } = bodyBox(A);
  const side = view === 'side', back = view === 'u';
  ctx.lineWidth = 1; ctx.strokeStyle = dk;
  if (id === 'cape') {
    if (phase === 'behind' && !back) {
      ctx.fillStyle = shade(col, -0.12);
      ctx.beginPath();
      if (side) { ctx.moveTo(-1, y - 8); ctx.quadraticCurveTo(-12, y - 2, -15, y + 8.5); ctx.lineTo(-2, y + 8.5); }
      else { ctx.moveTo(-5, y - 8); ctx.quadraticCurveTo(-13, y, -13.5, y + 8.5); ctx.lineTo(13.5, y + 8.5); ctx.quadraticCurveTo(13, y, 5, y - 8); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (phase === 'over') {
      if (back) {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(-6, y - 8.5); ctx.quadraticCurveTo(-13, y, -13, y + 8.5);
        ctx.quadraticCurveTo(0, y + 10.5, 13, y + 8.5); ctx.quadraticCurveTo(13, y, 6, y - 8.5); ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(side ? -2 : -6, y - 7.6); ctx.lineTo(side ? 5 : 6, y - 7.6); ctx.stroke();
        ctx.fillStyle = '#ffd23f'; ellipse(ctx, side ? 3 : 0, y - 7.4, 1.8, 1.8); ctx.fill();
      }
    }
    return;
  }
  if (phase !== 'over') return;
  const clipBody = (fn) => { ctx.save(); ellipse(ctx, 0, y, rx, ry); ctx.clip(); fn(); ctx.restore(); };
  const outline = () => { ctx.strokeStyle = P.ol; ctx.lineWidth = 1.1; ellipse(ctx, 0, y, rx, ry); ctx.stroke(); ctx.strokeStyle = dk; ctx.lineWidth = 1; };
  switch (id) {
    case 'apron':
      if (back) {
        ctx.fillStyle = col;
        ellipse(ctx, -3.2, y + 2.5, 2.6, 1.7, -0.4); ctx.fill();
        ellipse(ctx, 3.2, y + 2.5, 2.6, 1.7, 0.4); ctx.fill();
        ctx.fillStyle = dk; ellipse(ctx, 0, y + 2.5, 1.4, 1.4); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-rx + 1, y + 2.5); ctx.lineTo(rx - 1, y + 2.5); ctx.stroke();
      } else if (side) {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(2, y - 6); ctx.lineTo(9.5, y - 5); ctx.quadraticCurveTo(11.5, y + 4, 8, y + 7.5); ctx.lineTo(2, y + 7);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(-6, y - 6.5); ctx.lineTo(6, y - 6.5); ctx.lineTo(7, y + 6); ctx.quadraticCurveTo(0, y + 9, -7, y + 6);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = shade(col, 0.35); rrect(ctx, -3.2, y - 0.5, 6.4, 3.8, 1.2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-5.5, y - 6.5); ctx.lineTo(-4, y - 10); ctx.moveTo(5.5, y - 6.5); ctx.lineTo(4, y - 10); ctx.stroke();
      }
      break;
    case 'tshirt':
      clipBody(() => {
        ctx.fillStyle = col; ctx.fillRect(-rx - 1, y - ry - 1, rx * 2 + 2, ry + 4);
        ctx.fillStyle = dk; ctx.fillRect(-rx - 1, y + 2.6, rx * 2 + 2, 0.9);
      });
      outline();
      ctx.fillStyle = col;
      for (const sx of back ? [-rx + 0.5, rx - 0.5] : side ? [1.5] : [-rx + 0.5, rx - 0.5]) { ellipse(ctx, sx, y - 4, 3.2, 2.8); ctx.fill(); ctx.stroke(); }
      if (!back && !side) { ctx.fillStyle = '#fff'; heartPath(ctx, 0, y - 2.6, 2); ctx.fill(); }
      break;
    case 'dress':
      ctx.fillStyle = col;
      ctx.beginPath();
      if (side) { ctx.moveTo(-4, y - 6.5); ctx.lineTo(6, y - 6.5); ctx.quadraticCurveTo(8.5, y, 10.5, y + 8.6); ctx.quadraticCurveTo(1, y + 10.6, -8.5, y + 8.6); ctx.quadraticCurveTo(-6.5, y, -4, y - 6.5); }
      else { ctx.moveTo(-6.5, y - 6.5); ctx.lineTo(6.5, y - 6.5); ctx.quadraticCurveTo(9, y, 11.5, y + 8.6); ctx.quadraticCurveTo(0, y + 10.8, -11.5, y + 8.6); ctx.quadraticCurveTo(-9, y, -6.5, y - 6.5); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      for (let k = -2; k <= 2; k++) { ellipse(ctx, k * 4.3 + (side ? 1 : 0), y + 8.3, 0.9, 0.9); ctx.fill(); }
      if (!back && !side) { ellipse(ctx, 0, y - 6.6, 4, 1.8); ctx.fill(); }
      if (back) { ellipse(ctx, -2.2, y - 1, 2, 1.3, -0.4); ctx.fill(); ellipse(ctx, 2.2, y - 1, 2, 1.3, 0.4); ctx.fill(); }
      ctx.fillStyle = col;
      for (const sx of side ? [2] : [-7.5, 7.5]) { ellipse(ctx, sx, y - 5, 2.8, 2.3); ctx.fill(); ctx.stroke(); }
      break;
    case 'overalls':
      clipBody(() => { ctx.fillStyle = col; ctx.fillRect(-rx - 1, y + 0.5, rx * 2 + 2, ry + 2); });
      outline();
      ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      if (back) {
        ctx.beginPath(); ctx.moveTo(-5, y - 8.2); ctx.lineTo(3, y + 0.8); ctx.moveTo(5, y - 8.2); ctx.lineTo(-3, y + 0.8); ctx.stroke();
      } else {
        const bx = side ? 2.5 : -4.2, bw = side ? 6 : 8.4;
        ctx.fillStyle = col; ctx.fillRect(bx, y - 5.5, bw, 6.4);
        ctx.strokeStyle = dk; ctx.lineWidth = 0.9; ctx.strokeRect(bx, y - 5.5, bw, 6.4);
        ctx.strokeStyle = col; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(bx + 0.6, y - 5.5); ctx.lineTo(bx - 0.8, y - 8.6);
        if (!side) { ctx.moveTo(bx + bw - 0.6, y - 5.5); ctx.lineTo(bx + bw + 0.8, y - 8.6); }
        ctx.stroke();
        ctx.fillStyle = '#ffd23f';
        for (const bxx of side ? [bx + 1.4] : [bx + 1.6, bx + bw - 1.6]) { ellipse(ctx, bxx, y - 4.4, 0.9, 0.9); ctx.fill(); }
      }
      break;
    case 'hoodie': {
      const hood = shade(col, -0.12);
      clipBody(() => { ctx.fillStyle = col; ctx.fillRect(-rx - 1, y - ry - 1, rx * 2 + 2, ry * 2 + 2); });
      outline();
      ctx.fillStyle = hood;
      if (back) { ellipse(ctx, 0, y - 6.5, 6.8, 5.2); ctx.fill(); ctx.stroke(); ctx.fillStyle = shade(col, -0.25); ellipse(ctx, 0, y - 7.5, 4, 2.4); ctx.fill(); }
      else if (side) { ellipse(ctx, -4.5, y - 8.5, 4.5, 3.8); ctx.fill(); ctx.stroke(); }
      else {
        ellipse(ctx, 0, y - 7.6, 7.5, 2.4); ctx.fill(); ctx.stroke();
        rrect(ctx, -5, y + 0.8, 10, 4.6, 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-1.8, y - 7); ctx.lineTo(-1.8, y - 3.5); ctx.moveTo(1.8, y - 7); ctx.lineTo(1.8, y - 3.5); ctx.stroke();
      }
      break;
    }
    case 'happi':
      clipBody(() => {
        ctx.fillStyle = col; ctx.fillRect(-rx - 1, y - ry - 1, rx * 2 + 2, ry * 2 + 2);
        ctx.fillStyle = '#fff'; ctx.fillRect(-rx - 1, y + 4.6, rx * 2 + 2, 1.5);
        if (!back) for (const bx of side ? [4] : [-3.4, 1.6]) ctx.fillRect(bx, y - ry, 1.8, ry * 2);
      });
      outline();
      if (back) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ellipse(ctx, 0, y - 1, 4.4, 4.4); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `900 5.5px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('祭', 0, y - 0.8);
      }
      break;
    case 'yukata':
      clipBody(() => {
        ctx.fillStyle = col; ctx.fillRect(-rx - 1, y - ry - 1, rx * 2 + 2, ry * 2 + 2);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (let j = 0; j < 5; j++) for (let i = -3; i <= 3; i++) { ellipse(ctx, i * 4.5 + (j % 2) * 2.2, y - 7 + j * 3.6, 0.9, 0.9); ctx.fill(); }
        ctx.fillStyle = '#ffd25e'; ctx.fillRect(-rx - 1, y + 0.3, rx * 2 + 2, 3.4);
        ctx.fillStyle = '#e0a830'; ctx.fillRect(-rx - 1, y + 1.7, rx * 2 + 2, 0.6);
      });
      outline();
      if (back) {
        ctx.fillStyle = '#ffd25e'; ctx.strokeStyle = '#c08a20';
        ellipse(ctx, -3.2, y + 1.6, 3, 2.2); ctx.fill(); ctx.stroke();
        ellipse(ctx, 3.2, y + 1.6, 3, 2.2); ctx.fill(); ctx.stroke();
        ellipse(ctx, 0, y + 1.8, 1.4, 1.4); ctx.fill();
      } else {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        if (side) { ctx.moveTo(1, y - 8.2); ctx.lineTo(7, y + 0.3); }
        else { ctx.moveTo(-4.6, y - 8.2); ctx.lineTo(1.2, y + 0.3); ctx.moveTo(4.6, y - 8.2); ctx.lineTo(-0.6, y - 2.5); }
        ctx.stroke();
      }
      break;
  }
}

function drawWearNeck(ctx, A, hx) {
  const { look, view, bob } = A;
  const id = look.neck || 'none';
  if (id === 'none') return;
  const col = wearCol(look, 'neck');
  const side = view === 'side', back = view === 'u';
  const hy = -24 + bob;
  switch (id) {
    case 'bell':
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hx, hy, 11, Math.PI * 0.28, Math.PI * 0.72); ctx.stroke();
      if (!back) {
        ctx.fillStyle = '#ffd34d'; ellipse(ctx, side ? 4 : 0, -13 + bob, 2.4, 2.4); ctx.fill();
        ctx.strokeStyle = '#b08a1a'; ctx.lineWidth = 0.7; ctx.stroke();
      }
      break;
    case 'scarf':
      ctx.fillStyle = col;
      rrect(ctx, -8.5, -17.5 + bob, 17, 4.2, 2); ctx.fill();
      if (!back) { rrect(ctx, side ? -6 : 2, -15 + bob, 4, 8, 1.5); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-8, -16.3 + bob, 16, 0.9);
      break;
    case 'bowtie': {
      if (back) return;
      const bx = side ? 4.5 : 0, by = -14.8 + bob;
      ctx.fillStyle = col; ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 0.8;
      for (const sg of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + sg * 4.6, by - 2.4); ctx.lineTo(bx + sg * 4.6, by + 2.4); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      ellipse(ctx, bx, by, 1.4, 1.4); ctx.fill(); ctx.stroke();
      break;
    }
    case 'bandana':
      ctx.fillStyle = col; ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 0.8;
      if (back) { ellipse(ctx, 0, -16 + bob, 2.2, 1.6); ctx.fill(); ctx.stroke(); return; }
      ctx.beginPath();
      { const ox = side ? 3 : 0;
        ctx.moveTo(ox - 6.8, -16.6 + bob); ctx.lineTo(ox + 6.8, -16.6 + bob); ctx.lineTo(ox, -9.6 + bob); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      for (const [dx, dy] of [[-2.5, -14.8], [2.5, -14.8], [0, -12.4]]) { ellipse(ctx, dx + (side ? 3 : 0), dy + bob, 0.7, 0.7); ctx.fill(); }
      break;
    case 'necklace':
      if (back) return;
      ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#c8bfb4'; ctx.lineWidth = 0.6;
      for (let k = 0; k <= 6; k++) {
        if (side && k < 3) continue;
        const a = Math.PI * 0.27 + k * Math.PI * 0.46 / 6;
        ellipse(ctx, hx + Math.cos(a) * 12, hy + Math.sin(a) * 12, 1.2, 1.2); ctx.fill(); ctx.stroke();
      }
      break;
  }
}

function drawWearFace(ctx, A, hx, eyes, eyeY, nx, ny) {
  const id = A.look.face || 'none';
  if (id === 'none') return;
  const side = A.view === 'side';
  const bridge = (col) => {
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath();
    if (eyes.length === 2) { ctx.moveTo(eyes[0] + 3.2, eyeY); ctx.lineTo(eyes[1] - 3.2, eyeY); }
    else { ctx.moveTo(eyes[0] - 3.4, eyeY); ctx.lineTo(hx - 4, eyeY - 1.5); }
    ctx.stroke();
  };
  switch (id) {
    case 'glasses':
      ctx.strokeStyle = '#3a2e2a'; ctx.lineWidth = 1;
      for (const ex of eyes) { ctx.beginPath(); ctx.arc(ex, eyeY, 3.6, 0, TAU); ctx.stroke(); }
      bridge('#3a2e2a');
      break;
    case 'sun':
      for (const ex of eyes) {
        ctx.fillStyle = 'rgba(25,25,35,0.9)'; ellipse(ctx, ex, eyeY, 3.9, 3.1); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ellipse(ctx, ex - 1.2, eyeY - 1, 1.3, 0.7, -0.4); ctx.fill();
      }
      bridge('#1e1e26');
      break;
    case 'heart':
      for (const ex of eyes) {
        heartPath(ctx, ex, eyeY + 0.6, 2.9);
        ctx.fillStyle = 'rgba(255,90,140,0.55)'; ctx.fill();
        ctx.strokeStyle = '#e0406a'; ctx.lineWidth = 0.9; ctx.stroke();
      }
      bridge('#e0406a');
      break;
    case 'star':
      for (const ex of eyes) {
        starPath(ctx, ex, eyeY, 4.4, 2.2);
        ctx.fillStyle = 'rgba(255,210,60,0.6)'; ctx.fill();
        ctx.strokeStyle = '#d09a10'; ctx.lineWidth = 0.9; ctx.stroke();
      }
      bridge('#d09a10');
      break;
    case 'stache':
      ctx.fillStyle = '#4a3028';
      for (const sg of side ? [-1] : [-1, 1]) {
        ellipse(ctx, nx + sg * 2.6 - (side ? 1 : 0), ny + 1.9, 2.8, 1.25, sg * -0.25); ctx.fill();
        ellipse(ctx, nx + sg * 5.2 - (side ? 1 : 0), ny + 1.1, 1.1, 1.1); ctx.fill();
      }
      break;
  }
}

function drawWearHead(ctx, A, hx, hy) {
  const { look, view } = A;
  const id = look.head || 'none';
  if (id === 'none') return;
  const col = wearCol(look, 'head'), dk = shade(col, -0.3);
  const side = view === 'side', back = view === 'u';
  ctx.lineWidth = 1; ctx.strokeStyle = dk;
  switch (id) {
    case 'ribbon': drawRibbon(ctx, side ? hx - 2 : back ? hx - 6 : hx + 6.5, hy - 8.5, col); break;
    case 'beret': drawHat(ctx, hx, hy, view, col); break;
    case 'flower': {
      const fx = side ? hx - 1 : back ? hx - 7 : hx + 7, fy = hy - 7.5;
      ctx.fillStyle = col;
      for (let k = 0; k < 5; k++) { const a = k * TAU / 5 - Math.PI / 2; ellipse(ctx, fx + Math.cos(a) * 2.5, fy + Math.sin(a) * 2.5, 2.2, 2.2); ctx.fill(); }
      ctx.fillStyle = '#ffd23f'; ellipse(ctx, fx, fy, 1.5, 1.5); ctx.fill();
      break;
    }
    case 'cap':
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(hx - (side ? 0.5 : 0), hy - 4.5, 11.6, 8.8, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dk;
      if (side) { ellipse(ctx, hx + 11, hy - 4.6, 6.5, 1.8); ctx.fill(); }
      else if (back) { rrect(ctx, hx - 2.5, hy - 6.6, 5, 2, 1); ctx.fill(); }
      else { ellipse(ctx, hx, hy - 4.2, 10, 2.4); ctx.fill(); }
      ellipse(ctx, hx - (side ? 0.5 : 0), hy - 13.2, 1.3, 1.3); ctx.fill();
      break;
    case 'knit':
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(hx, hy - 3.8, 12, 9.6, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.35);
      for (const dx of [-6, -2, 2, 6]) { ctx.beginPath(); ctx.moveTo(hx + dx, hy - 5); ctx.lineTo(hx + dx * 0.8, hy - 11.5); ctx.stroke(); }
      ctx.fillStyle = shade(col, 0.15); ctx.strokeStyle = dk;
      rrect(ctx, hx - 12.4, hy - 6.2, 24.8, 3.8, 1.8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fffaf2'; ellipse(ctx, hx, hy - 14.2, 3.4, 3.2); ctx.fill(); ctx.stroke();
      break;
    case 'straw':
      ctx.fillStyle = '#ecc873'; ctx.strokeStyle = '#b08a3a';
      ellipse(ctx, hx, hy - 8, 16.5, side ? 3.8 : 5.2, side ? -0.08 : 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8505b'; ellipse(ctx, hx, hy - 10, 8, 2.6); ctx.fill();
      ctx.fillStyle = '#f2d68a'; ellipse(ctx, hx, hy - 12.6, 7.4, 3.8); ctx.fill(); ctx.stroke();
      break;
    case 'chef':
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#c8c0b8';
      for (const [dx, dy, r] of [[-4.5, -17.5, 4.8], [4.5, -17.5, 4.8], [0, -20, 5.6]]) { ellipse(ctx, hx + dx, hy + dy, r, r); ctx.fill(); ctx.stroke(); }
      rrect(ctx, hx - 7.5, hy - 14.5, 15, 5, 1.5); ctx.fill(); ctx.stroke();
      break;
    case 'usamimi': {
      ctx.strokeStyle = '#4a3a40'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(hx, hy + 0.5, 11.2, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
      const ears = side ? [[-2.5, -0.35], [1, -0.2]] : [[-4.8, -0.18], [4.8, 0.18]];
      ctx.lineWidth = 1;
      ears.forEach(([ex, r], i) => {
        ctx.fillStyle = col; ctx.strokeStyle = shade(col, -0.35);
        ellipse(ctx, hx + ex, hy - 17, 3.1, 8.5, r); ctx.fill(); ctx.stroke();
        if (!back && (!side || i === 1)) { ctx.fillStyle = '#f6b6c2'; ellipse(ctx, hx + ex, hy - 16.5, 1.5, 6, r); ctx.fill(); }
      });
      break;
    }
    case 'witch':
      ctx.fillStyle = col;
      ellipse(ctx, hx, hy - 8.5, 15, side ? 3 : 4, side ? -0.08 : 0); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - 7.5, hy - 9.5); ctx.quadraticCurveTo(hx - 3, hy - 20, hx + 6, hy - 27);
      ctx.quadraticCurveTo(hx + 2, hy - 18, hx + 7.5, hy - 9.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.moveTo(hx - 7.2, hy - 10.4); ctx.lineTo(hx + 7.2, hy - 10.4); ctx.lineTo(hx + 6.6, hy - 12.8); ctx.lineTo(hx - 6.4, hy - 12.8); ctx.closePath(); ctx.fill();
      if (!back) { starPath(ctx, hx - 0.5, hy - 17, 2.2, 1); ctx.fill(); }
      break;
    case 'crown':
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#b08a00';
      ctx.beginPath();
      ctx.moveTo(hx - 8, hy - 9.5); ctx.lineTo(hx - 8.5, hy - 17); ctx.lineTo(hx - 4.2, hy - 13); ctx.lineTo(hx, hy - 19);
      ctx.lineTo(hx + 4.2, hy - 13); ctx.lineTo(hx + 8.5, hy - 17); ctx.lineTo(hx + 8, hy - 9.5); ctx.closePath();
      ctx.fill(); ctx.stroke();
      for (const [dx, dy] of [[-8.5, -17], [0, -19], [8.5, -17]]) { ellipse(ctx, hx + dx, hy + dy, 1.1, 1.1); ctx.fill(); }
      if (!back) {
        ctx.fillStyle = '#e8364f'; ellipse(ctx, hx, hy - 12.2, 1.6, 1.6); ctx.fill();
        ctx.fillStyle = '#3a8fe0'; ellipse(ctx, hx - 5, hy - 11.6, 1.1, 1.1); ctx.fill();
        ctx.fillStyle = '#3fae6a'; ellipse(ctx, hx + 5, hy - 11.6, 1.1, 1.1); ctx.fill();
      }
      break;
  }
}

function drawRibbon(ctx, x, y, col = '#ff5f8a') {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4.5, y - 3); ctx.lineTo(x - 4.5, y + 3); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4.5, y - 3); ctx.lineTo(x + 4.5, y + 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(col, -0.25); ellipse(ctx, x, y, 1.5, 1.5); ctx.fill();
}
function drawHat(ctx, hx, hy, view, col = '#5a6fd0') {
  const x = hx + (view === 'side' ? -1 : 0), r = view === 'side' ? -0.15 : 0;
  ctx.fillStyle = col; ellipse(ctx, x, hy - 9.5, 9.5, 3.8, r); ctx.fill();
  ctx.fillStyle = shade(col, 0.18); ellipse(ctx, x, hy - 10.5, 7.5, 3, r); ctx.fill();
  ctx.fillStyle = shade(col, -0.3); ellipse(ctx, x, hy - 13, 1.4, 1.4); ctx.fill();
}

function drawBox(ctx, pid, x, y, sc) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.fillStyle = '#d9a86a';
  ctx.strokeStyle = '#8a6232'; ctx.lineWidth = 1;
  rrect(ctx, -9, -6, 18, 12, 1.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c8955a'; ctx.fillRect(-9, -6, 18, 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, -3); ctx.stroke();
  if (pid && pid !== true) ProdArt.draw(ctx, pid, 0, 1.6, 9);
  ctx.restore();
}
function drawBasket(ctx, items, x, y) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < Math.min(items.length, 3); i++) ProdArt.draw(ctx, items[i], -3 + i * 3.4, -4.5 - (i % 2) * 1.4, 7.5);
  ctx.fillStyle = '#e6b45e'; ctx.strokeStyle = '#9c6d22'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(6, -3); ctx.lineTo(4.5, 3.5); ctx.lineTo(-4.5, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -3, 5, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,80,20,0.5)';
  ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke();
  ctx.restore();
}
function drawEatItem(ctx, pid, x, y) { ProdArt.draw(ctx, pid, x, y, 9); }
function drawUmbrellaOpen(ctx, col, behind) {
  if (behind) {
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(4, -10); ctx.lineTo(1, -44); ctx.stroke();
    return;
  }
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-20, -40);
  ctx.quadraticCurveTo(0, -64, 22, -40);
  for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(16.5 - k * 10.5, -44, 11.5 - k * 10.5, -40);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ellipse(ctx, -6, -50, 7, 3, -0.4); ctx.fill();
}
function drawUmbrellaClosed(ctx, col) {
  ctx.save();
  ctx.translate(-10, -6); ctx.rotate(0.25);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(2.6, 6); ctx.lineTo(-2.6, 6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 10); ctx.arc(-1.5, 10, 1.5, 0, Math.PI); ctx.stroke();
  ctx.restore();
}

/* =========================================================================
   商品のアイコン
   仕入れた商品は絵文字、オリジナル商品は「かたち」に絵をはって描く
   ========================================================================= */
const ICON = 64;
const ProdArt = {
  cache: new Map(), urls: new Map(),
  icon(pid) {
    const d = isOrig(pid) ? designOf(pid) : null;
    const key = pid + ':' + (d ? d.v : 0);
    let cv = this.cache.get(key);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = cv.height = ICON;
    const ctx = cv.getContext('2d');
    if (d) drawPackage(ctx, d);
    else {
      const g = GOOD[pid];
      ctx.font = `${ICON * 0.78}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g ? g.emoji : '❓', ICON / 2, ICON * 0.55);
    }
    this.cache.set(key, cv);
    return cv;
  },
  draw(ctx, pid, x, y, size) {
    if (!pid) return;
    ctx.drawImage(this.icon(pid), x - size / 2, y - size / 2, size, size);
  },
  url(pid) {
    const d = isOrig(pid) ? designOf(pid) : null;
    const key = pid + ':' + (d ? d.v : 0);
    let u = this.urls.get(key);
    if (!u) { u = this.icon(pid).toDataURL(); this.urls.set(key, u); }
    return u;
  },
  html(pid, cls = 'pi') {
    if (isOrig(pid)) return `<img class="${cls}" src="${this.url(pid)}" alt="">`;
    const g = GOOD[pid];
    return `<span class="${cls} emo">${g ? g.emoji : '❓'}</span>`;
  },
};

/* オリジナル商品の入れ物の形。clip した中にかいた絵をはる */
function packagePath(ctx, form) {
  ctx.beginPath();
  switch (form) {
    case 'juice':
      ctx.moveTo(26, 14); ctx.lineTo(38, 14); ctx.lineTo(39, 18);
      ctx.quadraticCurveTo(50, 20, 50, 30); ctx.lineTo(50, 56); ctx.quadraticCurveTo(50, 61, 45, 61);
      ctx.lineTo(19, 61); ctx.quadraticCurveTo(14, 61, 14, 56); ctx.lineTo(14, 30); ctx.quadraticCurveTo(14, 20, 25, 18);
      ctx.closePath();
      return { x: 14, y: 20, w: 36, h: 41 };
    case 'cookie':
      ctx.moveTo(12, 12);
      for (let k = 0; k < 8; k++) ctx.lineTo(12 + k * 5 + 2.5, k % 2 ? 12 : 9);
      ctx.lineTo(52, 12); ctx.lineTo(53, 54); ctx.quadraticCurveTo(53, 60, 47, 60); ctx.lineTo(17, 60);
      ctx.quadraticCurveTo(11, 60, 11, 54); ctx.closePath();
      return { x: 11, y: 9, w: 42, h: 51 };
    case 'onigiri':
      ctx.moveTo(32, 6); ctx.quadraticCurveTo(36, 6, 39, 11); ctx.lineTo(58, 49); ctx.quadraticCurveTo(60, 58, 52, 58);
      ctx.lineTo(12, 58); ctx.quadraticCurveTo(4, 58, 6, 49); ctx.lineTo(25, 11); ctx.quadraticCurveTo(28, 6, 32, 6);
      ctx.closePath();
      return { x: 5, y: 6, w: 54, h: 52 };
    case 'pizza':
      ctx.rect(5, 14, 54, 40);
      return { x: 5, y: 14, w: 54, h: 40 };
    case 'ice':
      ctx.moveTo(11, 22); ctx.lineTo(53, 22); ctx.lineTo(47, 58); ctx.quadraticCurveTo(46, 61, 42, 61);
      ctx.lineTo(22, 61); ctx.quadraticCurveTo(18, 61, 17, 58); ctx.closePath();
      return { x: 11, y: 22, w: 42, h: 39 };
    case 'doll':
    default:
      ctx.moveTo(12, 30); ctx.lineTo(52, 30); ctx.lineTo(54, 56); ctx.quadraticCurveTo(54, 61, 48, 61);
      ctx.lineTo(16, 61); ctx.quadraticCurveTo(10, 61, 10, 56); ctx.closePath();
      return { x: 10, y: 30, w: 44, h: 31 };
  }
}

function drawPackage(ctx, d, imgOverride) {
  const form = d.form;
  const base = FORM[form].color;
  const img = imgOverride || (d.wrap ? Pics.get('wrap:' + d.id, d.wrap) : null);
  if (form === 'doll') drawDollHead(ctx, d.shape || 'cat', d.color || DOLL_COLORS[0]);
  if (form === 'juice') {
    ctx.fillStyle = shade(d.color || '#ff8fa3', -0.1);
    rrect(ctx, 25, 4, 14, 9, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(27, 6, 3, 5);
  }
  const box = packagePath(ctx, form);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = base; ctx.fillRect(0, 0, ICON, ICON);
  if (img) {
    const k = Math.max(box.w / img.width, box.h / img.height);
    const w = img.width * k, h = img.height * k;
    ctx.drawImage(img, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
  } else {
    ctx.font = '20px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.85;
    const fl = (d.flav || []).filter(Boolean);
    const em = fl.length ? MAT[fl[0]].emoji : FORM[form].emoji;
    ctx.fillText(em, box.x + box.w / 2, box.y + box.h / 2 + 1);
    ctx.globalAlpha = 1;
  }
  if (form === 'onigiri') { ctx.fillStyle = '#2f4a32'; ctx.fillRect(21, 40, 22, 20); }
  if (form === 'pizza') { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(5, 48, 54, 6); }
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(box.x + 3, box.y + 2, 4, box.h - 6);
  ctx.restore();
  packagePath(ctx, form);
  ctx.strokeStyle = 'rgba(70,50,60,0.75)'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  if (form === 'ice') {
    ctx.fillStyle = '#fffaf2';
    ellipse(ctx, 32, 21, 23, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = shade(d.color || '#ff8fa3', 0.3);
    ellipse(ctx, 32, 19.5, 12, 3.4); ctx.fill();
  }
  if (form === 'doll') {
    ctx.fillStyle = '#ff6f91';
    ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(25, 27); ctx.lineTo(25, 37); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(39, 27); ctx.lineTo(39, 37); ctx.closePath(); ctx.fill();
  }
}

/* ぬいぐるみの頭 (ふくろから顔を出す) */
function drawDollHead(ctx, shape, col) {
  const ol = shade(col, -0.45);
  ctx.fillStyle = col; ctx.strokeStyle = ol; ctx.lineWidth = 1.6;
  const cx = 32, cy = 22;
  if (shape === 'fish') {
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 16, 10, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 14, cy + 2); ctx.lineTo(cx + 24, cy - 6); ctx.lineTo(cx + 24, cy + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b2230'; ellipse(ctx, cx - 8, cy, 2, 2); ctx.fill();
    return;
  }
  const ear = (pts) => { ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.lineTo(...pts[2]); ctx.closePath(); ctx.fill(); ctx.stroke(); };
  if (shape === 'cat') { ear([[cx - 13, cy - 2], [cx - 11, cy - 17], [cx - 3, cy - 10]]); ear([[cx + 13, cy - 2], [cx + 11, cy - 17], [cx + 3, cy - 10]]); }
  if (shape === 'bear') { ellipse(ctx, cx - 10, cy - 10, 5, 5); ctx.fill(); ctx.stroke(); ellipse(ctx, cx + 10, cy - 10, 5, 5); ctx.fill(); ctx.stroke(); }
  if (shape === 'rabbit') { ellipse(ctx, cx - 6, cy - 16, 3.6, 10, -0.15); ctx.fill(); ctx.stroke(); ellipse(ctx, cx + 6, cy - 16, 3.6, 10, 0.15); ctx.fill(); ctx.stroke(); }
  ellipse(ctx, cx, cy, 14, 12.5); ctx.fill(); ctx.stroke();
  if (shape === 'dog') {
    ctx.fillStyle = col; ellipse(ctx, cx - 13, cy + 1, 5, 9, 0.3); ctx.fill(); ctx.stroke(); ellipse(ctx, cx + 13, cy + 1, 5, 9, -0.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = shade(col, 0.5); ellipse(ctx, cx, cy + 4.5, 6, 4.2); ctx.fill();
  }
  ctx.fillStyle = '#2b2230';
  ellipse(ctx, cx - 5, cy, 1.9, 2.3); ctx.fill(); ellipse(ctx, cx + 5, cy, 1.9, 2.3); ctx.fill();
  ctx.fillStyle = '#ef8a9c'; ellipse(ctx, cx, cy + 4, 1.6, 1.1); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,140,0.35)'; ellipse(ctx, cx - 8.5, cy + 4, 2.6, 1.5); ctx.fill(); ellipse(ctx, cx + 8.5, cy + 4, 2.6, 1.5); ctx.fill();
}
