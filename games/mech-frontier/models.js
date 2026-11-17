/* MECH FRONTIER のモデル: メカ・人・ひこうき・ドローンなどを 箱や球から 組み立てて描く。
   前は +Z。右は -X (R.rotY の向きに合わせている)。 */
'use strict';
const DK = 0x2a2e36, MID = 0x555c68;
const B = (x, y, z, sx, sy, sz, c, em) => R.prim(0, x, y, z, sx, sy, sz, c, em);
const S = (x, y, z, sx, sy, sz, c, em) => R.prim(1, x, y, z, sx, sy, sz, c, em);
const C = (x, y, z, sx, sy, sz, c, em) => R.prim(2, x, y, z, sx, sy, sz, c, em);
const K = (x, y, z, sx, sy, sz, c, em) => R.prim(3, x, y, z, sx, sy, sz, c, em);
function glowS(x, y, z, s, c, a) { R.glow(1); S(x, y, z, s, s, s, c, a); R.glow(0); }

// ---------- あし (こしの 高さを かえす) ----------
function drawLegs(type, w, c1, c2, e) {
  const sw = Math.sin(w);
  if (type === 0 || type === 6) {
    const t = type === 6 ? 1.45 : 1;
    for (const sx of [-1, 1]) {
      const a = sw * sx * .55;
      R.push(); R.translate(sx * .55 * (type === 6 ? 1.2 : 1), 2, 0); R.rotX(a);
      B(0, -.5, 0, .5 * t, 1.1, .6 * t, c1);
      R.translate(0, -1, 0); R.rotX(Math.max(0, a) * .9 + .1);
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
      C(x, .5 + bob, z, .5, .3, .5, 0x80f0ff, 1); R.glow(1); K(x, .1 + bob, z, .6, -.7, .6, 0x40c0ff, .5); R.glow(0);
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
      S(0, 1.2, .86, .8, .8, .3, 0x60e8ff, 1); B(0, 1.2, .86, 1.5, 1.3, .1, DK);
      for (const s of [-1, 1]) { B(s * 2, 2.3, 0, 1, 1.1, 1.5, c2); B(s * .9, 1.2, -1, .6, 1.4, .5, DK); }
      return { sh: 2, sy: 1.75, top: 2.65, hz: 0 };
    case 5: C(0, .7, 0, 2.9, .6, 2.9, c1); S(0, 1, 0, 1.7, 1.1, 1.7, c2); C(0, .35, 0, 1.6, .3, 1.6, DK);
      for (let k = 0; k < 6; k++) S(Math.sin(k * 1.047) * 1.3, .7, Math.cos(k * 1.047) * 1.3, .22, .22, .22, 0xfff080, 1);
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
    case 1: S(0, .3, 0, .9, .8, .9, c2); S(0, .32, .36, .3, .22, .2, 0x60f0ff, 1); break;
    case 2: B(0, .28, 0, .8, .5, .8, DK); S(0, .28, .4, .3, .3, .2, 0xff4050, 1); B(.3, .75, -.1, .06, .6, .06, MID); break;
    case 3: B(0, .18, 0, 1, .3, .8, c1); S(-.25, .2, .4, .16, .16, .1, 0x80ff80, 1); S(.25, .2, .4, .16, .16, .1, 0x80ff80, 1); B(0, .4, -.1, .5, .16, .5, c2); break;
    case 4: B(0, .3, 0, .7, .55, .7, c1); B(0, .34, .36, .5, .12, .06, 0xffe060, 1);
      for (const s of [-1, 1]) { R.push(); R.translate(s * .32, .6, 0); R.rotZ(-s * .45); K(0, .3, 0, .2, .7, .2, c2); R.pop(); } break;
    case 5: S(0, .3, .05, .95, .75, 1.15, 0x8fd8ff, .18); B(0, .05, 0, 1, .16, 1.1, c1); break;
    default: B(0, .3, 0, .7, .55, .7, c1); B(0, .34, .36, .58, .15, .06, 0x60f0ff, 1); B(0, .62, -.1, .3, .12, .4, c2);
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
  const sp = e.spec, z = sp.size, c1 = PAL[sp.c1], c2 = PAL[sp.c2], st = e.st;
  R.flash = e.flash > 0 ? Math.min(1, e.flash * 6) : 0;
  R.push(); R.translate(e.x, e.y, e.z); R.rotY(e.yaw + (e.spinA || 0)); R.scale(z, z, z);
  const crouch = st.kind === 'titan' && e.mode === 1 ? .35 : 0;
  if (crouch) R.translate(0, -crouch, 0);
  let hip = drawLegs(sp.legs, e.walk, c1, c2, e);
  if (st.kind === 'ball' && e.mode === 1) hip = .25;
  R.translate(0, hip, 0); R.rotY(angDiff(e.aimYaw, e.yaw));
  const m = drawBody(sp.body, c1, c2, e);
  if (!(st.kind === 'ball' && e.mode === 1)) {
    R.push(); R.translate(0, m.top, m.hz); drawHead(sp.head, c1, c2); R.pop();
    drawArm(sp.arms, 1, m, e, c1, c2, 1); drawArm(sp.arms, -1, m, e, c1, c2, 1);
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
}

function drawHuman(e) {
  const lk = e.look || HUMAN_LOOKS[0], sw = Math.sin(e.walk) * .7, L = e.load || {};
  R.flash = e.flash > 0 ? Math.min(1, e.flash * 6) : 0;
  R.push(); R.translate(e.x, e.y, e.z); R.rotY(e.yaw + (e.spinA || 0));
  if (e.rollA) { R.translate(0, .9, 0); R.rotX(e.rollA); R.translate(0, -.9, 0); }
  for (const s of [-1, 1]) { R.push(); R.translate(s * .14, .85, 0); R.rotX(sw * s); B(0, -.42, 0, .22, .85, .25, lk[1]); R.pop(); }
  B(0, 1.2, 0, .55, .68, .3, lk[0]); B(0, 1.72, 0, .34, .34, .34, 0xf0c8a0); B(0, 1.88, -.03, .38, .14, .4, lk[2]);
  if (e.boss) B(0, 2.0, 0, .5, .08, .5, 0x202020);
  const sw2 = e.swingT > 0 ? 1 - e.swingT / .3 : -1;
  R.push(); R.translate(-.36, 1.42, 0);
  if (sw2 >= 0) { R.rotY(1.3 - sw2 * 2.6); R.rotX(-.2); } else R.rotX(-(e.aimPitch || 0) + (L.main ? 0 : 1.2 - sw * .5));
  B(0, 0, .28, .16, .16, .6, lk[0]); R.translate(0, 0, .6);
  if (sw2 >= 0 && L.melee) drawMelee(WEAPONS[L.melee], .45);
  else if (L.main) { const ml = drawGun(WEAPONS[L.main], .42); if (e.fireFlash > 0) glowS(0, 0, ml + .1, .4, 0xffd070, .8); }
  R.pop();
  R.push(); R.translate(.36, 1.42, 0);
  const sub = L.sub ? WEAPONS[L.sub] : null;
  if (sub && sub.kind === 'shield' && e.blocking) { R.rotY(-.6); R.rotX(-.1); } else R.rotX(sub ? -(e.aimPitch || 0) : 1.2 + sw * .5);
  B(0, 0, .28, .16, .16, .6, lk[0]); R.translate(0, 0, .6);
  if (sub && sub.kind === 'gun') drawGun(sub, .42); else if (sub) drawShield(sub, .5, e.blocking);
  R.pop();
  if (e.chute) { R.translate(0, 3.6, 0); S(0, 0, 0, 3, 1.4, 3, 0xff8040); }
  R.pop(); R.flash = 0;
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
  R.push(); R.translate(n.x, 0, n.z); R.scale(k, k, k);
  if (n.type === 'scrap') { for (let i = 0; i < 5; i++) { R.push(); R.rotY(r() * 6); B(r() * 1.4 - .7, .3 + i * .3, r() * 1.4 - .7, .8 + r() * 1.4, .4 + r() * .5, .6 + r(), [0x8a5a3a, 0x70757c, 0xa06a3a, 0x5a6068][i % 4]); R.pop(); } B(.3, 1.9, 0, .15, 1.2, .15, 0xb0b4ba); }
  else if (n.type === 'iron') { S(0, .7, 0, 2.6, 1.8, 2.2, 0x6a6e74); S(.8, .5, .6, 1.3, 1.1, 1.2, 0x7c8088); for (let i = 0; i < 4; i++) B(r() * 1.6 - .8, .9 + r() * .5, r() * 1.6 - .8, .35, .35, .35, 0xd09060, .25); }
  else { for (let i = 0; i < 4; i++) { R.push(); R.translate(r() * 1.4 - .7, 0, r() * 1.4 - .7); R.rotZ(r() * .6 - .3); K(0, .9 + r() * .6, 0, .7, 2 + r() * 1.4, .7, 0x50e0ff, .7); R.pop(); } glowS(0, 1.2, 0, 3, 0x40c0ff, .09); }
  R.pop();
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
