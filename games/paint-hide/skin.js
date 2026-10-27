/* =========================================================================
   PAINT & HIDE ― キャラクターと ぬりえ
   キャラクターは 丸だけで できている。かお = まんまるの 円、からだ = すこし たてながの 楕円、
   て = ちいさな 円 2つ。目は かおに ぬってあるだけなので、上から ぬれば 消せる。
   ぬった 色は 部品ごとの 小さな canvas に しまい、形を かえても 部品に くっついたまま のびる。
   座標は 足もとを (0, 0) とした ワールド座標 (px)。
   ========================================================================= */
'use strict';

/* 形の はんい [さいしょう, さいだい, はじめ] */
const SHAPE = { bw: [9, 22, 13], bh: [12, 25, 18], fr: [9, 16, 12.5] };
const HAND_R = 4.2;
const TEX = { face: [64, 64], body: [64, 96], handL: [16, 16], handR: [16, 16] };
const PART_ORDER = ['body', 'face', 'handL', 'handR'];   // 描く じゅん (うしろ → まえ)
/* キャラクターが おさまる はこ (足もと基準)。ぬりえの 画面と 迷彩の 判定は この はこで 行う */
const BOX = { x: -30, y: -84, w: 60, h: 88 };

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/* 部品の 位置と 大きさ。swing は 歩いているときの 手の ふり */
function partsOf(sh, swing = 0) {
  const by = -2 - sh.bh;
  const fy = -2 - 2 * sh.bh - sh.fr + 5;
  const hy = -2 - sh.bh * 0.85;
  const hx = sh.bw + 2.5;
  const P = {
    body: { kind: 'ell', cx: 0, cy: by, rx: sh.bw, ry: sh.bh },
    face: { kind: 'ell', cx: 0, cy: fy, rx: sh.fr, ry: sh.fr },
    handL: { kind: 'ell', cx: -hx, cy: hy + swing, rx: HAND_R, ry: HAND_R },
    handR: { kind: 'ell', cx: hx, cy: hy - swing, rx: HAND_R, ry: HAND_R },
  };
  for (const k in P) { const p = P[k]; p.x = p.cx - p.rx; p.y = p.cy - p.ry; p.w = p.rx * 2; p.h = p.ry * 2; }
  return P;
}
function partPath(g, p) { g.beginPath(); g.ellipse(p.cx, p.cy, p.rx, p.ry, 0, 0, TAU); }

class Skin {
  constructor(shape) {
    /* よそから 来た データでも こわれないよう、形は はんいに おさめる */
    this.shape = {};
    for (const k in SHAPE) { const v = shape && typeof shape[k] === 'number' ? shape[k] : NaN; this.shape[k] = isFinite(v) ? clamp(v, SHAPE[k][0], SHAPE[k][1]) : SHAPE[k][2]; }
    this.tex = {};
    for (const k of PART_ORDER) this.tex[k] = makeCanvas(TEX[k][0], TEX[k][1]);
    this.ver = 0;
  }
  clone() {
    const s = new Skin(this.shape);
    for (const k of PART_ORDER) s.tex[k].getContext('2d').drawImage(this.tex[k], 0, 0);
    return s;
  }
  copyFrom(o) {
    this.shape = Object.assign({}, o.shape);
    for (const k of PART_ORDER) { const g = this.tex[k].getContext('2d'); g.clearRect(0, 0, TEX[k][0], TEX[k][1]); g.drawImage(o.tex[k], 0, 0); }
    this.ver++;
  }
  toData() {
    const d = { shape: Object.assign({}, this.shape) };
    for (const k of PART_ORDER) d[k] = this.tex[k].toDataURL('image/png');
    return d;
  }
  /* 保存した データから もどす。画像の 読みこみは 非同期 */
  static fromData(d, done) {
    const s = new Skin(d && d.shape);
    let left = PART_ORDER.length;
    for (const k of PART_ORDER) {
      if (!d || typeof d[k] !== 'string' || !d[k].startsWith('data:image/')) { if (--left === 0 && done) done(s); continue; }
      const img = new Image();
      img.onload = () => { s.tex[k].getContext('2d').drawImage(img, 0, 0, TEX[k][0], TEX[k][1]); s.ver++; if (--left === 0 && done) done(s); };
      img.onerror = () => { if (--left === 0 && done) done(s); };
      img.src = d[k];
    }
    return s;
  }
  /* 部品の テクスチャに、足もと基準の 座標で 描くための 変換 */
  partCtx(k) {
    const p = partsOf(this.shape)[k], [tw, th] = TEX[k];
    const g = this.tex[k].getContext('2d');
    const sx = tw / p.w, sy = th / p.h;
    g.setTransform(sx, 0, 0, sy, -p.x * sx, -p.y * sy);
    return { g, p };
  }
  /* ふでで ぬる。(x0,y0)→(x1,y1) の 線を、キャラクターの 上だけに */
  stroke(x0, y0, x1, y1, r, color) {
    for (const k of PART_ORDER) {
      const { g, p } = this.partCtx(k);
      g.save(); partPath(g, p); g.clip();
      g.strokeStyle = color; g.fillStyle = color; g.lineWidth = r * 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.beginPath(); g.arc(x1, y1, r, 0, TAU); g.fill();
      g.restore();
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.ver++;
  }
  fillPart(k, color) {
    const g = this.tex[k].getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = color; g.fillRect(0, 0, TEX[k][0], TEX[k][1]);
    this.ver++;
  }
  /* (x, y) に ある いちばん 手前の 部品 */
  partAt(x, y) {
    const P = partsOf(this.shape);
    for (const k of ['handR', 'handL', 'face', 'body']) {
      const p = P[k];
      if (((x - p.cx) / p.rx) ** 2 + ((y - p.cy) / p.ry) ** 2 <= 1) return k;
    }
    return null;
  }
  /* 目を かく (かおの テクスチャに) */
  paintEyes() {
    const g = this.tex.face.getContext('2d'), [w, h] = TEX.face;
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const ex of [0.34, 0.66]) {
      g.fillStyle = '#1a1f2b'; g.beginPath(); g.arc(w * ex, h * 0.48, w * 0.085, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w * ex + w * 0.03, h * 0.45, w * 0.03, 0, TAU); g.fill();
    }
    this.ver++;
  }
}

/* はじめの 見た目。からだと 手は 同じ色、かおは 明るめ */
function makeSkin(bodyCol, faceCol, shape) {
  const s = new Skin(shape);
  s.fillPart('body', bodyCol);
  s.fillPart('handL', faceCol); s.fillPart('handR', faceCol);
  s.fillPart('face', faceCol);
  s.paintEyes();
  return s;
}
const SKIN_COLS = ['#e8403f', '#3a7bf0', '#34b86a', '#f5c932', '#f28a2e', '#9b59d6', '#f27fb5', '#2ec5d3', '#8a5a3a', '#5a6a8a'];
const FACE_COLS = ['#ffe0c4', '#f5cfa8', '#e8b48a', '#c98e62', '#fff4e0'];
function randomSkin() {
  const sh = { bw: rand(11, 16), bh: rand(15, 21), fr: rand(11, 14) };
  return makeSkin(pick(SKIN_COLS), pick(FACE_COLS), sh);
}

/* まわりの けしきを うつして 迷彩にする (コンピューター用)。
   blend は もとの 色が どれだけ 残るか (0 なら かんぺき)。eyes で 目を 残す */
function camoSkin(skin, wx, wy, blend, blendCol, eyes) {
  const map = Art.map, s = Art.mapScale;
  const P = partsOf(skin.shape);
  for (const k of PART_ORDER) {
    const p = P[k], [tw, th] = TEX[k], g = skin.tex[k].getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, tw, th);
    g.drawImage(map, (wx + p.x) * s, (wy + p.y) * s, p.w * s, p.h * s, 0, 0, tw, th);
    g.globalAlpha = blend; g.fillStyle = blendCol; g.fillRect(0, 0, tw, th); g.globalAlpha = 1;
  }
  if (eyes) skin.paintEyes();
  skin.ver++;
}

/* --------------------------------- 描く --------------------------------- */
/* o: moving, walk(歩きの位相), alpha, ghost, outline, me(自分の しるし), gun(向き または null), ring(足もとの 色) */
function drawChar(ctx, skin, x, y, o = {}) {
  const t = o.walk || 0;
  const hop = o.moving ? Math.abs(Math.sin(t)) * 2.2 : 0;
  const float = o.ghost ? 6 + Math.sin(G.time * 3 + (o.phase || 0)) * 3 : 0;
  ctx.save();
  ctx.translate(x, y);
  if (o.scale) ctx.scale(o.scale, o.scale);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.ring) {
    ctx.strokeStyle = o.ring; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 1, skin.shape.bw + 8, 7, 0, 0, TAU); ctx.stroke();
  }
  if (o.moving || o.ghost) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(0, 1, skin.shape.bw + 2, 4.5, 0, 0, TAU); ctx.fill();
  }
  ctx.translate(0, -hop - float);
  const P = partsOf(skin.shape, o.moving ? Math.sin(t) * 3.5 : 0);
  for (const k of PART_ORDER) {
    const p = P[k];
    ctx.save(); partPath(ctx, p); ctx.clip();
    ctx.drawImage(skin.tex[k], p.x, p.y, p.w, p.h);
    ctx.restore();
  }
  if (o.outline) {
    ctx.strokeStyle = o.outline; ctx.lineWidth = 1.4;
    for (const k of PART_ORDER) { partPath(ctx, P[k]); ctx.stroke(); }
  }
  if (o.gun !== undefined && o.gun !== null) {
    const right = Math.cos(o.gun) >= 0;
    const hp = right ? P.handR : P.handL;
    ctx.save(); ctx.translate(hp.cx, hp.cy); ctx.rotate(o.gun);
    ctx.fillStyle = '#2a2e36'; roundRect(ctx, -2, -3.5, 20, 7, 3); ctx.fill();
    ctx.fillStyle = '#e8403f'; roundRect(ctx, 14, -2.5, 6, 5, 2); ctx.fill();
    ctx.fillStyle = '#2a2e36'; ctx.beginPath(); ctx.arc(0, 4, 3.5, 0, TAU); ctx.fill();
    ctx.restore();
    /* 銃を もつ 手は 銃の 上に もう一度 */
    ctx.save(); partPath(ctx, hp); ctx.clip(); ctx.drawImage(skin.tex[right ? 'handR' : 'handL'], hp.x, hp.y, hp.w, hp.h); ctx.restore();
  }
  if (o.me) {
    const top = P.face.cy - P.face.ry - 10;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(-6, top - 7); ctx.lineTo(6, top - 7); ctx.lineTo(0, top); ctx.fill();
  }
  ctx.restore();
}

/* --------------------------- 迷彩の うまさ --------------------------- */
/* キャラクターを その場の けしきと くらべて、0 (すぐ わかる) 〜 1 (見わけが つかない) を かえす */
const Camo = {
  a: null, b: null,
  score(skin, wx, wy) {
    const W = 15, H = 22;
    if (!this.a) { this.a = makeCanvas(W, H); this.b = makeCanvas(W, H); }
    const ga = this.a.getContext('2d', { willReadFrequently: true }), gb = this.b.getContext('2d', { willReadFrequently: true });
    const k = W / BOX.w;
    ga.setTransform(1, 0, 0, 1, 0, 0); ga.clearRect(0, 0, W, H);
    ga.setTransform(k, 0, 0, k, -BOX.x * k, -BOX.y * k);
    drawChar(ga, skin, 0, 0, {});
    const s = Art.mapScale;
    gb.setTransform(1, 0, 0, 1, 0, 0);
    gb.drawImage(Art.map, (wx + BOX.x) * s, (wy + BOX.y) * s, BOX.w * s, BOX.h * s, 0, 0, W, H);
    const A = ga.getImageData(0, 0, W, H).data, B = gb.getImageData(0, 0, W, H).data;
    let sum = 0, n = 0;
    for (let i = 0; i < A.length; i += 4) {
      if (A[i + 3] < 200) continue;
      const dr = A[i] - B[i], dg = A[i + 1] - B[i + 1], db = A[i + 2] - B[i + 2];
      sum += Math.sqrt(dr * dr + dg * dg + db * db); n++;
    }
    if (!n) return 1;
    return 1 - clamp(sum / n / 150, 0, 1);
  },
};
