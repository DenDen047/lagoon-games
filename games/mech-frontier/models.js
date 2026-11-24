/* MECH FRONTIER のモデル: メカ・人・ひこうき・ドローンなどを 箱や球から 組み立てて描く。
   前は +Z。右は -X (R.rotY の向きに合わせている)。 */
'use strict';
let DK = 0x2a2e36, MID = 0x555c68;
/* 警察ロボットを 描く あいだだけ 黒・青・赤に 差しかえる。EYE は 目の光、ACC は 噴射などの 光。 */
let EYE = 0, ACC = 0;
const POL_RED = 0xff2030, POL_BLUE = 0x2a5cff;
const B = (x, y, z, sx, sy, sz, c, em) => R.prim(0, x, y, z, sx, sy, sz, c, em);
const S = (x, y, z, sx, sy, sz, c, em) => R.prim(1, x, y, z, sx, sy, sz, c, em);
const C = (x, y, z, sx, sy, sz, c, em) => R.prim(2, x, y, z, sx, sy, sz, c, em);
const K = (x, y, z, sx, sy, sz, c, em) => R.prim(3, x, y, z, sx, sy, sz, c, em);
const CP = (x, y, z, sx, sy, sz, c, em) => R.prim(4, x, y, z, sx, sy, sz, c, em);   // カプセル
const SB = (x, y, z, sx, sy, sz, c, em) => R.prim(5, x, y, z, sx, sy, sz, c, em);   // 丸い箱
function glowS(x, y, z, s, c, a) { R.glow(1); S(x, y, z, s, s, s, c, a); R.glow(0); }

// ---------- あし (こしの 高さを かえす) ----------
function drawLegs(type, w, c1, c2, e) {
  const sw = Math.sin(w);
  if (type === 0 || type === 6) {
    const t = type === 6 ? 1.45 : 1;
    for (const sx of [-1, 1]) {
      const a = sw * sx * .55;
      R.push(); R.translate(sx * .55 * (type === 6 ? 1.2 : 1), 2, 0); R.rotX(a);
      B(0, -.5, 0, .5 * t, 1.1, .6 * t, c1); S(0, 0, 0, .62 * t, .62 * t, .62 * t, DK); B(0, -.45, .32 * t, .3 * t, .6, .08, c2);
      R.translate(0, -1, 0); S(0, 0, 0, .56 * t, .56 * t, .56 * t, c2); R.rotX(Math.max(0, a) * .9 + .1); B(0, -.5, -.3 * t, .12, .7, .12, MID);
      B(0, -.5, 0, .42 * t, 1, .5 * t, DK); B(0, -.93, .15, .6 * t, .22, t, c2);
      R.pop();
    }
    B(0, 2, 0, 1.2 * t, .4, .7, DK);
    return 2.1;
  }
  if (type === 1) {
    for (const sx of [-1, 1]) {
      const a = sw * sx * .45;
      R.push(); R.translate(sx * .6, 1.85, 0); R.rotX(.75 + a);
      B(0, -.5, 0, .45, 1.1, .55, c1);
      R.translate(0, -1, 0); R.rotX(-1.5 - a * .5);
      B(0, -.55, 0, .32, 1.2, .38, DK);
      R.translate(0, -1.1, 0); R.rotX(.75);
      B(0, -.06, .25, .55, .2, 1.1, c2);
      R.pop();
    }
    B(0, 1.85, 0, 1.3, .4, .7, DK);
    return 1.95;
  }
  if (type === 2 || type === 5) {
    const n = type === 2 ? 4 : 6, th = type === 2 ? .42 : .28, rolling = e && e.st.kind === 'ball' && e.mode === 1;
    for (let i = 0; i < n; i++) {
      const ang = type === 2 ? Math.PI / 4 + i * Math.PI / 2 : (i < 3 ? 1 : -1) * (Math.PI / 2 + (i % 3 - 1) * .85);
      const ph = Math.sin(w + (i % 2) * Math.PI), lift = Math.max(0, ph) * .35;
      R.push(); R.translate(0, 1.3, 0); R.rotY(ang + ph * .18);
      if (rolling) { B(0, 0, .9, th, th, .5, DK); R.pop(); continue; }
      B(0, .15, 1, th, th, 1.5, c1); S(0, .15, 1.75, th * 1.5, th * 1.5, th * 1.5, c2);
      B(0, -.55 + lift, 1.75, th * .9, 1.5, th * .9, DK); B(0, -1.22 + lift, 1.8, th * 1.6, .16, th * 2, c2);
      R.pop();
    }
    return 1.3;
  }
  if (type === 3) {
    for (const sx of [-1, 1]) {
      B(sx * 1.05, .5, 0, .75, 1, 3.3, DK); B(sx * 1.05, 1.05, 0, .85, .14, 3, c1);
      for (let k = 0; k < 5; k++) B(sx * 1.05, .5, ((k * .66 + w * .2) % 3.3 + 3.3) % 3.3 - 1.65, .8, 1.04, .1, MID);
    }
    B(0, .95, 0, 1.6, .5, 2.6, c2);
    return 1.25;
  }
  if (type === 4) {
    const bob = Math.sin(w * .5) * .12 + .15;
    C(0, .95 + bob, 0, 2.5, .45, 2.5, c1); C(0, .7 + bob, 0, 1.9, .3, 1.9, DK);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.094, x = Math.sin(a) * .8, z = Math.cos(a) * .8;
      C(x, .5 + bob, z, .5, .3, .5, ACC || 0x80f0ff, 1); R.glow(1); K(x, .1 + bob, z, .6, -.7, .6, ACC || 0x40c0ff, .5); R.glow(0);
    }
    return 1.25 + bob;
  }
  // タイヤ
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    R.push(); R.translate(sx * 1.05, .55, sz * .95); R.rotZ(Math.PI / 2); R.rotY(w * 1.5);
    C(0, 0, 0, 1.1, .45, 1.1, DK); B(0, 0, 0, .9, .5, .2, c2); R.pop();
  }
  B(0, .8, 0, 1.7, .5, 2.6, c1);
  return 1.15;
}

// ---------- からだ (かたの位置・あたまの位置を かえす) ----------
function drawBody(type, c1, c2, e) {
  switch (type) {
    case 1: B(0, .8, 0, 1.2, 1.5, .8, c1); B(0, 1.05, .42, .7, .5, .12, c2); B(0, .1, 0, .8, .4, .6, DK); B(0, 1, -.5, .7, .8, .3, DK);
      return { sh: .85, sy: 1.25, top: 1.6, hz: 0 };
    case 2: B(0, .9, 0, 2.3, 1.6, 1.5, c1); B(0, 1.1, .77, 1.3, .7, .14, c2); B(0, .1, 0, 1.4, .4, 1, DK);
      for (const s of [-1, 1]) B(s * 1.5, 1.85, 0, .9, .5, 1.3, c2);
      B(0, 1, -.9, 1.5, 1.1, .4, DK);
      return { sh: 1.5, sy: 1.3, top: 1.75, hz: 0 };
    case 3: {
      R.push(); R.translate(0, 1, 0); if (e && e.rollA) R.rotX(e.rollA);
      S(0, 0, 0, 2.4, 2.4, 2.4, c1); C(0, 0, 0, 2.46, .34, 2.46, c2); B(0, 0, 0, .3, 2.44, .3, DK);
      S(0, .15, 1.05, .5, .5, .4, 0xff5040, 1); R.pop();
      return { sh: 1.3, sy: 1, top: 2.15, hz: 0 };
    }
    case 4: B(0, 1.1, 0, 2.8, 2, 1.7, c1); B(0, 2.25, 0, 3.3, .7, 1.9, c2); B(0, .05, 0, 1.6, .5, 1.2, DK);
      S(0, 1.2, .86, .8, .8, .3, EYE || 0x60e8ff, 1); B(0, 1.2, .86, 1.5, 1.3, .1, DK);
      for (const s of [-1, 1]) { B(s * 2, 2.3, 0, 1, 1.1, 1.5, c2); B(s * .9, 1.2, -1, .6, 1.4, .5, DK); }
      return { sh: 2, sy: 1.75, top: 2.65, hz: 0 };
    case 5: C(0, .7, 0, 2.9, .6, 2.9, c1); S(0, 1, 0, 1.7, 1.1, 1.7, c2); C(0, .35, 0, 1.6, .3, 1.6, DK);
      for (let k = 0; k < 6; k++) S(Math.sin(k * 1.047) * 1.3, .7, Math.cos(k * 1.047) * 1.3, .22, .22, .22, ACC ? (k % 2 ? POL_RED : POL_BLUE) : 0xfff080, 1);
      return { sh: 1.55, sy: .75, top: 1.5, hz: 0 };
    case 6: B(0, .7, .1, 1.3, 1.1, 2.7, c1); B(0, 1.3, -.2, .9, .3, 1.8, c2); B(0, .1, 0, .9, .3, 1.2, DK);
      B(0, .8, -1.6, .5, .5, 1, c1); B(0, .95, -2.4, .3, .3, .9, c2);
      return { sh: .85, sy: .9, top: 1.15, hz: 1.25 };
    case 7: C(0, .9, 0, 1.8, 1.8, 1.8, c1); C(0, 1.5, 0, 1.86, .25, 1.86, c2); C(0, .4, 0, 1.86, .25, 1.86, c2); C(0, 0, 0, 1.2, .3, 1.2, DK);
      return { sh: 1.05, sy: 1.25, top: 1.8, hz: 0 };
    default: B(0, .8, 0, 1.8, 1.4, 1.1, c1); B(0, .95, .57, 1, .6, .14, c2); B(0, .1, 0, 1, .4, .8, DK); B(0, .9, -.7, 1, .9, .4, DK);
      return { sh: 1.15, sy: 1.2, top: 1.5, hz: 0 };
  }
}
function drawHead(type, c1, c2) {
  switch (type) {
    case 1: S(0, .3, 0, .9, .8, .9, c2); S(0, .32, .36, .3, .22, .2, EYE || 0x60f0ff, 1); break;
    case 2: B(0, .28, 0, .8, .5, .8, DK); S(0, .28, .4, .3, .3, .2, EYE || 0xff4050, 1); B(.3, .75, -.1, .06, .6, .06, MID); break;
    case 3: B(0, .18, 0, 1, .3, .8, c1); S(-.25, .2, .4, .16, .16, .1, EYE || 0x80ff80, 1); S(.25, .2, .4, .16, .16, .1, EYE || 0x80ff80, 1); B(0, .4, -.1, .5, .16, .5, c2); break;
    case 4: B(0, .3, 0, .7, .55, .7, c1); B(0, .34, .36, .5, .12, .06, EYE || 0xffe060, 1);
      for (const s of [-1, 1]) { R.push(); R.translate(s * .32, .6, 0); R.rotZ(-s * .45); K(0, .3, 0, .2, .7, .2, c2); R.pop(); } break;
    case 5: S(0, .3, .05, .95, .75, 1.15, 0x8fd8ff, .18); B(0, .05, 0, 1, .16, 1.1, c1); break;
    default: B(0, .3, 0, .7, .55, .7, c1); B(0, .34, .36, .58, .15, .06, EYE || 0x60f0ff, 1); B(0, .62, -.1, .3, .12, .4, c2);
  }
}

// ---------- ぶき (うでの さきから +Z に のびる) ----------
function drawGun(w, s) {
  const p = w.proj;
  if (p === 'rocket' || p === 'missile') { B(0, 0, .4 * s, .42 * s, .42 * s, 1.5 * s, 0x4a5a3a); B(0, 0, 1.16 * s, .34 * s, .34 * s, .05, 0x101010); B(0, .28 * s, .2 * s, .12 * s, .2 * s, .3 * s, DK); return 1.2 * s; }
  if (p === 'grenade') { B(0, 0, .3 * s, .36 * s, .36 * s, 1 * s, 0x5a5040); C(0, -.25 * s, .2 * s, .4 * s, .3 * s, .4 * s, DK); return .8 * s; }
  if (p === 'laser') {
    const l = w.big ? 2.4 : 1.5; B(0, 0, l * .5 * s, .22 * s, .3 * s, l * s, 0xd0d8e0); B(0, 0, l * .5 * s, .26 * s, .08 * s, l * .9 * s, w.big ? 0xb070ff : 0xff4060, 1);
    return l * s;
  }
  if (p === 'plasma') { B(0, 0, .5 * s, .5 * s, .5 * s, 1.5 * s, 0x3a3f50); S(0, 0, 1.3 * s, .5 * s, .5 * s, .5 * s, 0x60ffc0, 1); return 1.4 * s; }
  if (p === 'flame') { B(0, 0, .4 * s, .28 * s, .28 * s, 1.2 * s, 0x8a4a2a); C(0, -.3 * s, 0, .35 * s, .5 * s, .35 * s, 0xc04030); return 1.1 * s; }
  R.push(); R.rotX(Math.PI / 2);
  if (w.id === 'gatling') { for (let k = 0; k < 3; k++) C(Math.sin(k * 2.09) * .12 * s, .8 * s, Math.cos(k * 2.09) * .12 * s, .12 * s, 1.6 * s, .12 * s, 0x30343c); C(0, .3 * s, 0, .4 * s, .5 * s, .4 * s, MID); }
  else if (w.id === 'shotgun') { C(0, .5 * s, 0, .26 * s, 1.1 * s, .26 * s, 0x30343c); }
  else if (w.id === 'rifle') { C(0, 1 * s, 0, .12 * s, 2.2 * s, .12 * s, 0x30343c); }
  else { C(0, .55 * s, 0, .14 * s, 1.1 * s, .14 * s, 0x30343c); }
  R.pop();
  B(0, 0, .15 * s, .24 * s, .3 * s, .7 * s, MID);
  return (w.id === 'rifle' ? 2.1 : w.id === 'gatling' ? 1.6 : 1.1) * s;
}
function drawMelee(w, s) {
  const r = w.reach * s * .8, c = w.col, em = w.glow ? 1 : 0;
  B(0, 0, .3 * s, .14 * s, .14 * s, .6 * s, DK);
  if (w.shape === 'fist') { SB(0, 0, .5 * s, .9 * s, .8 * s, 1 * s, c); SB(0, 0, 1.05 * s, .8 * s, .66 * s, .3 * s, 0x30343c); return; }
  if (w.shape === 'hammer') { B(0, 0, r * .5, .14 * s, .14 * s, r, MID); B(0, 0, r, .9 * s, .7 * s, .6 * s, c); }
  else if (w.shape === 'axe') { B(0, 0, r * .5, .14 * s, .14 * s, r, MID); B(0, .35 * s, r * .9, .1 * s, .9 * s, .8 * s, c, em); }
  else if (w.shape === 'lance') { R.push(); R.rotX(Math.PI / 2); K(0, r * .55, 0, .4 * s, r, .4 * s, c); R.pop(); }
  else if (w.shape === 'pipe') B(0, 0, r * .5, .12 * s, .12 * s, r, c);
  else { B(0, 0, r * .55, .08 * s, .34 * s, r * .9, c, em); B(0, 0, .55 * s, .5 * s, .12 * s, .1 * s, MID); if (em) { R.glow(1); B(0, 0, r * .55, .2 * s, .5 * s, r * .95, c, .4); R.glow(0); } }
}
function drawShield(w, s, up) {
  const hh = (w.big ? 2.6 : 1.8) * s, ww = (w.big ? 1.7 : 1.3) * s;
  if (w.glow) { B(0, 0, .5 * s, .3 * s, .3 * s, .3 * s, MID); R.glow(1); C(0, 0, .9 * s, ww * 1.5, .08, hh, w.col, up ? .55 : .25); R.glow(0); S(0, 0, .8 * s, .3 * s, .3 * s, .2 * s, w.col, 1); }
  else { B(0, 0, .85 * s, ww, hh, .14 * s, w.col); B(0, 0, .93 * s, ww * .5, hh * .5, .06 * s, 0xe0e4ea); }
}

/* うでと もちもの。side: 1 = 右手 (メイン), -1 = 左手 (サブ)。 */
function drawArm(type, side, m, e, c1, c2, s) {
  const L = e.load || {}, isR = side > 0, wid = isR ? L.main : L.sub, w = wid ? WEAPONS[wid] : null;
  const swing = isR && e.swingT > 0 ? 1 - e.swingT / .3 : -1, mel = L.melee ? WEAPONS[L.melee] : null;
  R.push(); R.translate(-side * m.sh, m.sy, 0);
  S(0, 0, 0, .62, .62, .62, c2);
  if (swing >= 0) { R.rotY(side * (1.3 - swing * 2.6)); R.rotX(-.2); }
  else if (!isR && e.blocking) { R.rotY(-.5); R.rotX(-(e.aimPitch || 0)); }
  else R.rotX(-(e.aimPitch || 0) + (w ? 0 : .5));
  let end = 1;
  if (type === 1) { B(0, -.05, .45, .58, .58, 1.1, c1); end = 1; }
  else if (type === 2) { B(0, -.05, .4, .42, .42, 1, c1); const o = .12 + Math.abs(Math.sin(e.walk * .5)) * .1; B(o, -.05, 1.2, .14, .5, .8, c2); B(-o, -.05, 1.2, .14, .5, .8, c2); end = 1; }
  else if (type === 3) { B(-side * .1, .1, .2, .7, .9, 1.3, c2); B(-side * .1, .1, .88, .5, .7, .06, DK); end = .85; }
  else if (type === 4) { B(0, -.05, .7, .3, .3, 1.6, c1); S(0, -.05, 1.5, .4, .4, .4, DK); end = 1.5; }
  else if (type === 5) { B(0, -.05, .4, .42, .42, 1, c1); B(-side * .35, -.1, .5, .14, 1.5, 1.3, c2); end = 1; }
  else { B(0, -.05, .4, .4, .4, 1, c1); B(0, -.05, .95, .46, .46, .3, DK); end = 1; }
  R.translate(0, -.05, end);
  if (swing >= 0 && mel) drawMelee(mel, 1);
  else if (w && w.kind === 'gun') { const ml = drawGun(w, 1); if (e.fireFlash > 0 && (isR || e.subFlash)) glowS(0, 0, ml + .2, .9, 0xffd070, .8); }
  else if (w && w.kind === 'shield') drawShield(w, 1, e.blocking);
  R.pop();
}

function drawMech(e) {
  const sp = e.spec, z = sp.size, c1 = PAL[sp.c1], c2 = PAL[sp.c2], st = e.st, pol = sp.police;
  if (pol) { DK = 0x101216; MID = POL_BLUE; EYE = POL_RED; ACC = POL_BLUE; }
  R.flash = e.flash > 0 ? Math.min(1, e.flash * 6) : 0;
  R.push(); R.translate(e.x, e.y, e.z); R.rotY(e.yaw + (e.spinA || 0)); R.scale(z, z, z);
  const crouch = st.kind === 'titan' && e.mode === 1 ? .35 : 0;
  if (crouch) R.translate(0, -crouch, 0);
  let hip = drawLegs(sp.legs, e.walk, c1, c2, e);
  if (st.kind === 'ball' && e.mode === 1) hip = .25;
  R.translate(0, hip, 0); R.rotY(angDiff(e.aimYaw, e.yaw));
  const m = drawBody(sp.body, c1, c2, e);
  const bk = [.9, .62, 1.1, 0, 1.25, 0, 0, .95][sp.body];
  if (bk) {
    for (const s of [-1, 1]) {
      R.push(); R.translate(s * .36, m.sy - .55, -bk); R.rotX(Math.PI / 2); C(0, -.12, 0, .42, .5, .42, DK); C(0, -.4, 0, .5, .12, .5, MID); if (e.thrust > 0) { R.glow(1); K(0, -1.1, 0, .44, -1.3, .44, 0x60c0ff, .7); R.glow(0); } R.pop();
      S(s * (m.sh - .15), m.sy + .42, .2, .16, .16, .16, 0xffe060, 1); B(s * .5, -.1, .48, .44, .5, .1, c2); B(s * .5, -.1, -.48, .44, .5, .1, c2);
      B(s * (m.sh - .5), m.sy - .2, bk * .62, .34, .1, .04, DK); B(s * (m.sh - .5), m.sy - .38, bk * .62, .34, .1, .04, DK);
    }
    B(m.sh * .55, m.top + .5, -bk * .6, .05, 1.1, .05, MID); S(m.sh * .55, m.top + 1.06, -bk * .6, .1, .1, .1, 0xff4040, 1);
    B(0, m.sy - .75, bk * .64, .5, .06, .04, DK);
  }
  if (!(st.kind === 'ball' && e.mode === 1)) {
    R.push(); R.translate(0, m.top, m.hz); drawHead(sp.head, c1, c2); R.pop();
    drawArm(sp.arms, 1, m, e, c1, c2, 1); drawArm(sp.arms, -1, m, e, c1, c2, 1);
    if (pol) {      // 肩の 回転灯 (左が 赤、右が 青)
      const fl = Math.floor(G.t * 5) % 2 === 0, lit = e.team === 1 || e === body() || e.show;
      for (const s of [-1, 1]) {
        const col = s > 0 ? POL_RED : POL_BLUE, on = (s > 0) === fl, x = s * m.sh, y = m.sy + .44;
        B(x, y - .1, 0, .46, .08, .46, DK); SB(x, y + .04, 0, .38, .24, .38, col, on ? 1 : .25);
        if (on && lit) glowS(x, y + .05, 0, 1.6, col, .35);
      }
    }
    if (st.kind === 'ball' && e.mode >= 2) {       // ほうだい・コマ: じゅうが 4 本 とびだす
      for (let k = 0; k < 4; k++) {
        R.push(); R.translate(0, 1, 0); R.rotY(e.mode === 3 ? k * Math.PI / 2 : (k - 1.5) * .22); R.rotX(e.mode === 3 ? 0 : -(e.aimPitch || 0));
        B(0, e.mode === 3 ? 0 : (k % 2) * .5 - .25, 1.5, .22, .22, 1.3, 0x30343c);
        if (e.fireFlash > 0) glowS(0, e.mode === 3 ? 0 : (k % 2) * .5 - .25, 2.3, .7, 0xffd070, .7);
        R.pop();
      }
    }
    if (st.kind === 'titan' && e.mode === 1) {       // たてモード
      for (const s of [-1, 1]) { R.push(); R.translate(s * 1.25, .9, 1.9); R.rotY(-s * .28); B(0, 0, 0, 2.6, 3.6, .3, c2); B(0, 0, .17, 1.8, 2.6, .06, c1); R.pop(); }
      R.glow(1); B(0, 1, 2.5, 6, 4.4, .1, 0x60e8ff, .28); R.glow(0);
    }
  }
  if (e.thrust > 0) { R.glow(1); K(0, -.3, -.9, .8, -1.6, .8, 0x60c0ff, .7); R.glow(0); }
  R.pop(); R.flash = 0;
  if (pol) { DK = 0x2a2e36; MID = 0x555c68; EYE = ACC = 0; }
}

const shade = (c, f) => (Math.min(255, (c >> 16 & 255) * f) << 16) | (Math.min(255, (c >> 8 & 255) * f) << 8) | Math.min(255, (c & 255) * f);
let RAIN = 0, BLOOD = 1;
/* 人。カプセルと球で 丸みのある 体を 作る。走ると 腕と脚を ふり、体が はずんで 前に かたむく。 */
function drawHuman(e) {
  const o = e.fit || baseOutfit(), L = e.load || {}, tc = o.topC, hc = o.hairC, sk = o.skin, bc = o.botC;
  const spd = Math.hypot(e.vx || 0, e.vz || 0);
  const amp = e.citizen ? (e.down || e.pause > 0 || e.resident ? 0 : e.flee > 0 ? 1 : .55) : clamp(spd / 7, 0, 1);
  const sw = Math.sin(e.walk) * amp, bob = Math.abs(Math.cos(e.walk)) * .06 * amp, lean = amp * .16;
  R.flash = e.flash > 0 ? Math.min(1, e.flash * 6) : 0; R.matte(1);
  R.push(); R.translate(e.x, e.y, e.z); R.rotY(e.yaw + (e.spinA || 0)); if (e.sc) R.scale(e.sc, e.sc, e.sc);
  if (e.down) { R.translate(0, .22, 0); R.rotX(-Math.PI / 2); }
  if (e.rollA) { R.translate(0, .9, 0); R.rotX(e.rollA); R.translate(0, -.9, 0); }
  R.translate(0, bob, 0);
  const bare = o.bottom > 0;
  for (const s of [-1, 1]) {                                  // 脚
    R.push(); R.translate(s * .115, .93, 0); R.rotX(sw * s * .95 - lean * .4);
    CP(0, -.22, 0, .21, .5, .23, bc); R.translate(0, -.44, 0); R.rotX(Math.max(0, sw * s) * 1.1 + amp * .2);
    CP(0, -.2, 0, .17, .46, .19, bare ? sk : bc); SB(0, -.43, .06, .2, .15, .36, o.shoeC); SB(0, -.49, .06, .21, .04, .37, 0x1a1a1e); R.pop();
  }
  R.translate(0, .93, 0); R.rotX(lean);
  SB(0, .04, 0, .44, .22, .27, o.top === 4 ? tc : bc);
  if (o.bottom === 2) SB(0, -.08, 0, .54, .34, .4, bc);
  B(0, .12, 0, .46, .06, .285, 0x2a2a2e); B(0, .12, .145, .08, .07, .02, 0xd8b860);                      // ベルト
  SB(0, .4, 0, .52, .52, .31, tc); SB(0, .56, 0, .58, .18, .3, tc);                                      // 胸と肩
  if (o.top === 1) { SB(0, .7, -.15, .4, .26, .16, tc); B(-.06, .5, .158, .02, .2, .02, 0xf4f4f0); B(.06, .5, .158, .02, .2, .02, 0xf4f4f0); SB(0, .22, .15, .32, .14, .04, shade(tc, .8)); }
  else if (o.top === 2) { B(0, .4, .152, .14, .5, .02, 0xf4f4f0); SB(-.11, .58, .15, .1, .14, .05, shade(tc, .85)); SB(.11, .58, .15, .1, .14, .05, shade(tc, .85)); }
  else if (o.top === 3) { B(0, .42, .152, .13, .46, .02, 0xf4f4f0); B(0, .4, .164, .05, .36, .02, 0xc03030); SB(-.1, .55, .158, .11, .2, .04, shade(tc, .85)); SB(.1, .55, .158, .11, .2, .04, shade(tc, .85)); }
  else if (o.top === 4) { SB(0, .3, .15, .32, .36, .04, bc); B(-.13, .56, .152, .05, .22, .02, bc); B(.13, .56, .152, .05, .22, .02, bc); }
  if (o.badge) B(-.14, .52, .16, .07, .08, .02, 0xffd24a, .5);
  CP(0, .7, 0, .14, .16, .14, sk);
  R.push(); R.translate(0, .9, .01);                                                                      // 頭
  SB(0, 0, 0, .36, .38, .36, sk); S(-.185, 0, 0, .05, .1, .09, sk); S(.185, 0, 0, .05, .1, .09, sk); S(0, -.03, .185, .06, .07, .06, shade(sk, .95));
  for (const s of [-1, 1]) { S(s * .085, .035, .172, .095, .1, .04, 0xffffff); S(s * .085, .03, .188, .05, .058, .025, 0x30241c); B(s * .085, .115, .178, .1, .022, .02, hc); }
  B(0, -.11, .176, .1, .018, .012, 0x9a4a44);
  if (o.face === 1) { for (const s of [-1, 1]) B(s * .085, .035, .2, .12, .1, .012, 0x9fd8f0, .1); B(0, .05, .202, .34, .02, .012, 0x202020); }
  else if (o.face === 2) { for (const s of [-1, 1]) SB(s * .085, .035, .2, .14, .09, .02, 0x101014); B(0, .06, .202, .35, .02, .012, 0x101014); }
  if (o.hat !== 3) {
    if (o.hair === 3) SB(0, .15, 0, .365, .12, .365, hc);
    else { SB(0, .17, -.02, .39, .18, .4, hc); SB(0, .04, -.17, .38, .3, .1, hc); SB(-.185, .1, -.04, .05, .18, .28, hc); SB(.185, .1, -.04, .05, .18, .28, hc); SB(.06, .2, .13, .26, .1, .14, hc); }
    if (o.hair === 1) { SB(0, -.16, -.18, .38, .42, .1, hc); SB(-.19, -.1, -.06, .06, .34, .22, hc); SB(.19, -.1, -.06, .06, .34, .22, hc); }
    else if (o.hair === 2 && !o.hat) for (let k = 0; k < 6; k++) K(-.14 + k * .056, .32, -.1 + (k % 2) * .14, .12, .24, .12, hc);
  }
  if (o.hat === 1) { SB(0, .21, 0, .4, .16, .4, o.hatC); SB(0, .16, .26, .32, .04, .22, o.hatC); }
  else if (o.hat === 2) { C(0, .19, 0, .68, .03, .68, o.hatC); C(0, .29, 0, .37, .19, .37, o.hatC); C(0, .22, 0, .38, .04, .38, 0x202020); }
  else if (o.hat === 3) { S(0, .08, 0, .48, .48, .48, o.hatC); SB(0, .04, .2, .32, .14, .08, 0x60f0ff, .3); }
  else if (o.hat === 4) { S(0, .18, 0, .41, .3, .41, o.hatC); C(0, .12, 0, .4, .07, .4, shade(o.hatC, .85)); S(0, .35, 0, .1, .1, .1, o.hatC); }
  R.pop();
  if (e.wounds && BLOOD) for (let k = 0; k < e.wounds; k++) { const a = hash2(k, 5), b = hash2(k, 9); B((a - .5) * .4, .18 + b * .46, b > .5 ? .158 : -.158, .07, .06, .02, 0x9a0818); }
  const sl = o.top === 5 ? sk : tc, fore = o.top === 0 || o.top === 5 ? sk : tc;
  const arm = (bend) => { S(0, 0, 0, .19, .19, .19, sl); R.push(); R.rotX(Math.PI / 2); CP(0, .17, 0, .15, .38, .15, sl); R.translate(0, .34, 0); R.rotX(-bend); CP(0, .14, 0, .13, .32, .13, fore); S(0, .32, 0, .15, .16, .15, sk); R.pop(); R.translate(0, 0, .66); };
  const sw2 = e.swingT > 0 ? 1 - e.swingT / .3 : -1;
  R.push(); R.translate(-.33, .52, 0);
  if (e.surrender) { R.rotX(-1.5); arm(.5); } else
  if (sw2 >= 0) { R.rotY(1.3 - sw2 * 2.6); R.rotX(-.2); arm(0); } else if (L.main) { R.rotX(-(e.aimPitch || 0)); arm(0); } else { R.rotX(1.42 - sw * .95); arm(.25 + amp * .9); }
  if (e.surrender) { /* 手を上げている */ }
  else if (sw2 >= 0 && L.melee) drawMelee(WEAPONS[L.melee], .45);
  else if (L.main) { const ml = drawGun(WEAPONS[L.main], .42); if (e.fireFlash > 0) glowS(0, 0, ml + .1, .4, 0xffd070, .8); }
  R.pop();
  R.push(); R.translate(.33, .52, 0);
  const sub = L.sub ? WEAPONS[L.sub] : null;
  if (e.surrender) { R.rotX(-1.5); arm(.5); } else
  if (sub && sub.kind === 'shield' && e.blocking) { R.rotY(-.6); R.rotX(-.1); arm(0); } else if (sub) { R.rotX(-(e.aimPitch || 0)); arm(0); } else { R.rotX(1.42 + sw * .95); arm(.25 + amp * .9); }
  if (e.surrender) { /* 手を上げている */ } else if (sub && sub.kind === 'gun') drawGun(sub, .42); else if (sub) drawShield(sub, .5, e.blocking);
  R.pop();
  if (e.citizen && !e.resident && !e.down && RAIN > .5) { R.matte(0); C(.25, .95, .15, .03, 1.3, .03, 0x404448); K(.25, 1.7, .15, 1.5, .34, 1.5, o.hatC); R.matte(1); }
  if (e.chute) { R.translate(0, 2.7, 0); S(0, 0, 0, 3, 1.4, 3, 0xff8040); for (const s of [-1, 1]) B(s * .7, -1, 0, .03, 2, .03, 0xf0f0f0); }
  R.pop(); R.flash = 0; R.matte(0);
}
function drawTree(t, tm) {
  const s = t.s, h = t.h, sw = Math.sin(tm * 1.2 + t.ph) * .08 * (1 + RAIN), c = t.col;
  R.matte(1); R.push(); R.translate(t.x, t.y, t.z);
  if (t.pine) {
    C(0, h * .3, 0, .45 * s, h * .6, .45 * s, 0x6a4a30);
    for (let k = 0; k < 3; k++) K(sw * (k + 1), h * (.55 + k * .32), 0, (3.4 - k * .9) * s, h * .55, (3.4 - k * .9) * s, shade(0x2f7a48, 1 + k * .12));
  } else {
    R.push(); R.rotZ(.04); C(0, h * .5, 0, .5 * s, h, .5 * s, 0x7a5236); R.pop(); CP(.5 * s, h * .8, 0, .18 * s, 1.3 * s, .18 * s, 0x7a5236);
    S(sw, h + .7 * s, 0, 3.7 * s, 3.1 * s, 3.7 * s, c); S(1.2 * s + sw, h + .1, .5 * s, 2.5 * s, 2.1 * s, 2.5 * s, shade(c, .9));
    S(-1.1 * s + sw, h + .3, -.6 * s, 2.7 * s, 2.3 * s, 2.7 * s, shade(c, .94)); S(.2 * s + sw * 1.6, h + 2 * s, -.2 * s, 2.3 * s, 1.9 * s, 2.3 * s, shade(c, 1.12));
  }
  R.pop(); R.matte(0);
}
/* カメラの近くにだけ 草むら・花・しげみを はやす (位置は 場所から 決まるので、毎回 同じ所に 出る)。 */
function drawGrass(cx, cz, tm) {
  const R0 = 46, st = 3; R.matte(1);
  for (let gx = Math.floor((cx - R0) / st); gx <= (cx + R0) / st; gx++) for (let gz = Math.floor((cz - R0) / st); gz <= (cz + R0) / st; gz++) {
    const hs = hash2(gx, gz); if (hs > .36) continue;
    const x = gx * st + (hs * 31 % 1) * st, z = gz * st + (hs * 57 % 1) * st, dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz > R0 * R0 || W.region(x, z) !== 'grass' || W.inCity(x, z, 3)) continue;
    const sw = Math.sin(tm * 2 + x * .3 + z * .2) * .12 * (1 + RAIN);
    R.push(); R.translate(0, W.h(x, z), 0);
    if (hs < .025) { B(x, .3, z, .04, .6, .04, 0x3f8a3a); S(x + sw * .5, .66, z, .28, .24, .28, [0xf2d13a, 0xf07090, 0xf6f6f2, 0xa070f0][Math.floor(hs * 4000) % 4]); }
    else if (hs < .06) { S(x, .45, z, 1.7, 1.1, 1.5, 0x3f9a4a); S(x + .6, .35, z + .3, 1.1, .8, 1.1, 0x4fae4a); }
    else { const g = hs < .2 ? 0x5fb84e : 0x4aa64a; K(x + sw, .32, z, .34, .7, .34, g); K(x + .22 + sw, .25, z + .12, .28, .55, .28, shade(g, .9)); K(x - .16 + sw, .28, z - .2, .28, .6, .28, shade(g, 1.08)); }
    R.pop();
  }
  R.matte(0);
}
function drawRain(cam_, tm, k) {
  R.glow(1);
  for (let i = 0; i < 300; i++) {
    const a = hash2(i, 7), b = hash2(i, 13), c = hash2(i, 29), y = 22 - ((tm * 30 + c * 26) % 26);
    R.prim(0, cam_.ex + (a * 2 - 1) * 26 + Math.sin(cam_.yaw) * 10, cam_.ey + y - 10, cam_.ez + (b * 2 - 1) * 26 + Math.cos(cam_.yaw) * 10, .03, 1.1, .03, 0xa8c8ff, .22 * k);
  }
  R.glow(0);
}

let NIGHT = 0;
function drawCar(c) {
  const col = c.col, t = c.type | 0, gl = 0x1c2a38;
  R.flash = c.flash > 0 ? Math.min(1, c.flash * 6) : 0;
  R.push(); R.translate(c.x, c.y, c.z); R.rotY(c.yaw);
  B(0, .58, 0, 1.9, .5, 4.3, col); B(0, .34, 0, 1.94, .14, 4.36, 0x1a1c20); B(0, .82, 1.5, 1.8, .06, 1.2, col);
  if (t === 1) { B(0, 1.28, -.2, 1.84, .9, 3.6, col); B(0, 1.36, -.2, 1.88, .46, 3.3, gl); B(0, 1.36, 1.62, 1.6, .46, .06, gl); }
  else if (t === 2) { B(0, 1.22, .9, 1.84, .8, 1.5, col); B(0, 1.32, .9, 1.88, .4, 1.2, gl); B(0, 1.32, 1.67, 1.6, .4, .06, gl); B(0, .98, -1.1, 1.9, .3, 2.1, col); B(0, 1, -1.1, 1.66, .3, 1.9, 0x30343c); }
  else { B(0, 1.1, -.25, 1.7, .52, 2.2, col); B(0, 1.13, -.25, 1.74, .34, 1.9, gl); B(0, 1.13, .87, 1.5, .34, .06, gl); B(0, 1.13, -1.37, 1.5, .34, .06, gl); B(0, 1.37, -.25, 1.6, .04, 2, col); }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) { R.push(); R.translate(sx * .95, .37, sz * 1.38); R.rotZ(Math.PI / 2); R.rotY(c.wheel || 0); C(0, 0, 0, .74, .3, .74, 0x18181a); C(0, sx * .02, 0, .42, .32, .42, 0xb0b4ba); B(0, sx * .03, 0, .1, .3, .36, 0x60646c); R.pop(); }
    S(sx * .65, .62, 2.14, .34, .2, .12, 0xfff4c0, 1); B(sx * .68, .62, -2.16, .36, .16, .06, 0xff3030, 1); B(sx * 1, .98, .75, .16, .1, .12, col); B(sx * .97, .8, .3, .03, .04, .16, 0xc8ccd2);
  }
  B(0, .52, 2.17, .9, .18, .04, 0x202020); B(0, .4, 2.2, 1.9, .16, .1, 0x30343c); B(0, .4, -2.2, 1.9, .16, .1, 0x30343c); B(0, .56, -2.17, .5, .14, .03, 0xf4f4f0);
  if (c.taxi) B(0, 1.48, -.25, .5, .16, .24, 0xffe040, 1);
  if (c.police) {
    B(0, .6, 0, 1.92, .3, 1.7, 0x16203c); B(0, 1.46, -.25, 1.2, .1, .3, 0x30343c);
    const on = !c.deployed || true, fl = Math.floor(c.wheel * .2 + c.x) % 2 === 0;
    B(-.36, 1.56, -.25, .44, .16, .26, 0xff3030, on && fl ? 1 : .1); B(.36, 1.56, -.25, .44, .16, .26, 0x3060ff, on && !fl ? 1 : .1);
    if (!c.deployed || (c.duty && c === P.car)) { R.glow(1); S(fl ? -.36 : .36, 1.6, -.25, 2.4, 2.4, 2.4, fl ? 0xff3030 : 0x3060ff, .35); R.glow(0); }
  }
  if (NIGHT) { R.glow(1); for (const sx of [-1, 1]) S(sx * .65, .6, 3.4, 1.4, .8, 2.6, 0xfff0b0, .18); R.glow(0); }
  R.pop(); R.flash = 0;
}
function drawDecals(list) {
  R.matte(1);
  for (const d of list) { const k = Math.min(1, d.t / 6); if (d.flat) C(d.x, d.y, d.z, d.s * k, .025, d.s * k, d.col); else S(d.x, d.y, d.z, d.s, d.s, d.s, d.col); }
  R.matte(0);
}
function drawLoot(l, t) {
  const y = l.y;
  if (l.kind === 'tv') { B(l.x, y + .42, l.z, 1.3, .76, .08, 0x101014); B(l.x, y + .42, l.z, 1.2, .66, .1, 0x3060a0, .5); B(l.x, y + .03, l.z, .4, .06, .2, 0x101014); }
  else if (l.kind === 'gem') { B(l.x, y + .1, l.z, .34, .2, .24, 0x8a2a4a); B(l.x, y + .22, l.z, .36, .05, .26, 0xd0b060, .3); }
  else if (l.kind === 'cash') { B(l.x, y + .04, l.z, .3, .08, .16, 0x5aa86a); B(l.x + .2, y + .04, l.z + .1, .3, .08, .16, 0x5aa86a); }
  else if (l.kind === 'pc') { B(l.x, y + .02, l.z, .5, .03, .34, 0xb0b4ba); B(l.x, y + .18, l.z - .17, .5, .32, .03, 0x4080c0, .4); }
  else { B(l.x, y + .03, l.z, .14, .05, .14, 0xd0b060, .3); }
  glowS(l.x, y + .3, l.z, .5 + Math.sin(t * 4) * .1, 0xffe080, .25);
}
function drawPlane(p) {
  const jet = p.jet, c1 = jet ? 0x5a6478 : 0xe8e8e0, c2 = jet ? 0xff6030 : 0x3070d0;
  R.flash = p.flash > 0 ? Math.min(1, p.flash * 6) : 0;
  R.push(); R.translate(p.x, p.y + 1.3, p.z); R.rotY(p.yaw); R.rotX(-p.pitch); R.rotZ(p.roll);
  B(0, 0, 0, 1.3, 1.3, 7, c1); K(0, 0, 4.3, 1.3, 1.3, 1.6, c2); S(0, .6, 1, 1, .8, 2, 0x8fd8ff, .15);
  B(0, -.1, .4, jet ? 8 : 11, .16, jet ? 2.6 : 1.9, c1); B(0, -.1, .4, jet ? 8.1 : 11.1, .18, .5, c2);
  B(0, .1, -3, 4, .14, 1.1, c1); B(0, .9, -3, .16, 1.7, 1.2, c2);
  for (const s of [-1, 1]) { B(s * .9, -.9, 1.2, .14, .7, .14, DK); C(s * .9, -1.2, 1.2, .2, .5, .5, DK); B(s * 2.2, -.3, .9, .25, .25, 1.4, DK); }
  if (jet) { C(0, 0, -3.6, .9, .4, .9, DK); if (p.speed > 5) { R.glow(1); R.push(); R.translate(0, 0, -3.8); R.rotX(-Math.PI / 2); K(0, 1.2, 0, .8, 2.4 + p.speed * .03, .8, 0x80c0ff, .8); R.pop(); R.glow(0); } }
  else { R.push(); R.translate(0, 0, 5.2); R.rotZ(p.prop || 0); B(0, 0, 0, 3.2, .22, .08, DK); B(0, 0, 0, .22, 3.2, .08, DK); R.pop(); }
  R.pop(); R.flash = 0;
}
function drawDrone(e) {
  R.flash = e.flash > 0 ? Math.min(1, e.flash * 6) : 0;
  R.push(); R.translate(e.x, e.y + .6, e.z); R.rotY(e.yaw);
  S(0, 0, 0, 1.3, .8, 1.3, 0x4a4f5c); S(0, -.05, .55, .4, .4, .3, 0xff4040, 1); B(0, -.4, .3, .16, .16, .8, DK);
  for (let k = 0; k < 4; k++) { const a = k * 1.571 + .785, x = Math.sin(a) * .95, zz = Math.cos(a) * .95; B(x * .6, .1, zz * .6, .1, .1, .9, DK); C(x, .25, zz, .9, .05, .9, 0xa0a8b0); }
  R.pop(); R.flash = 0;
}
function drawTurret(t) {
  R.push(); R.translate(t.x, t.y + 1, t.z); R.rotY(t.yaw || 0);
  B(0, .35, 0, 1.1, .7, 1.1, 0x5a7ab0); B(0, .4, .9, .22, .22, 1.3, 0x30343c); S(0, .75, 0, .3, .3, .3, 0x60ff80, 1);
  if (t.fireFlash > 0) glowS(0, .4, 1.7, .6, 0xffd070, .8);
  R.pop();
}
function drawNode(n) {
  const r = seeded(n.seed * 77 + n.type.length), k = .5 + .5 * n.hp / n.max;
  R.matte(1); R.push(); R.translate(n.x, n.y, n.z); R.scale(k, k, k);
  if (n.type === 'crop') { B(0, .35, 0, .12, .7, .12, 0x3f8a3a); for (let i = 0; i < 4; i++) { R.push(); R.rotY(i * 1.57 + .4); R.rotX(.7); B(0, .6, .25, .35, .04, .6, 0x4aa84a); R.pop(); } S(0, .3, 0, .5, .45, .5, [0xe07030, 0xd03a30, 0xe8c040][n.seed % 3]); }
  else if (n.type === 'scrap') { for (let i = 0; i < 5; i++) { R.push(); R.rotY(r() * 6); B(r() * 1.4 - .7, .3 + i * .3, r() * 1.4 - .7, .8 + r() * 1.4, .4 + r() * .5, .6 + r(), [0x8a5a3a, 0x70757c, 0xa06a3a, 0x5a6068][i % 4]); R.pop(); } B(.3, 1.9, 0, .15, 1.2, .15, 0xb0b4ba); }
  else if (n.type === 'iron') { S(0, .7, 0, 2.6, 1.8, 2.2, 0x6a6e74); S(.8, .5, .6, 1.3, 1.1, 1.2, 0x7c8088); for (let i = 0; i < 4; i++) B(r() * 1.6 - .8, .9 + r() * .5, r() * 1.6 - .8, .35, .35, .35, 0xd09060, .25); }
  else { for (let i = 0; i < 4; i++) { R.push(); R.translate(r() * 1.4 - .7, 0, r() * 1.4 - .7); R.rotZ(r() * .6 - .3); K(0, .9 + r() * .6, 0, .7, 2 + r() * 1.4, .7, 0x50e0ff, .7); R.pop(); } glowS(0, 1.2, 0, 3, 0x40c0ff, .09); }
  R.pop(); R.matte(0);
}
function drawPiece(p, ghost) {
  const d = PIECES[p.t], col = BUILD_COLS[p.col || 0];
  R.push(); R.translate(p.gx * 4, p.gy * 3, p.gz * 4); R.rotY(-p.rot * Math.PI / 2);
  if (ghost) R.glow(1);
  for (const b of d.boxes) {
    const c = b[6] ? PIECE_FIX[b[6]] : col;
    B(b[0], b[1], b[2], b[3], b[4], b[5], ghost ? (ghost > 1 ? 0xff4040 : 0x60ff90) : c, ghost ? .45 : (b[6] === 14 || b[6] === 15 ? 1 : 0));
  }
  if (ghost) R.glow(0);
  R.pop();
}
function drawBeacon(x, y, z, col, t) {
  R.glow(1); R.push(); R.translate(x, y, z);
  C(0, 40, 0, 1.6, 80, 1.6, col, .22); C(0, .15, 0, 5 + Math.sin(t * 3) * .6, .2, 5 + Math.sin(t * 3) * .6, col, .3);
  R.pop(); R.glow(0);
}
