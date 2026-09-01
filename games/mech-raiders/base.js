/* =========================================================================
   MECH RAIDERS ― 母艦「アークライト」
   帰投の演出（輸送機が艦の下部ハッチから格納デッキへ降りる → パイロットが降りる）と、
   艦内を自分で歩いて部屋へ入る拠点画面。
   ========================================================================= */
'use strict';

(function () {
const C = window.MRCore, D = window.MRData, R = window.MRRender;
const { TAU, clamp, lerp, el, rnd, roundRect } = C;

/* ---------------- 登場人物の色 ---------------- */
const PILOT_LOOK = { suit: '#3d5f86', trim: '#9fd4ff', skin: '#e8c39a' };
const CHIEF_LOOK = { suit: '#4a4438', trim: '#ffcf4a', skin: '#dcb089', cap: true };

const SHIP_NAME = 'LGN-04 アークライト';

/* ---------------- 艦内の見取り図 ----------------
   左端が下部格納デッキ（輸送機が降りてくる場所）、右端が運転室。
   歩いて扉の前に立ち、↑ で入る。                                        */
const DECK = { w: 2620, floorY: 306, ceilY: 54, spawn: 312 };

const DOORS = [
  { id: 'launch',   x: 560,  name: '発進口',       sub: 'LAUNCH BAY', icon: '▶', kind: 'go',
    line: 'セクターを選んで出撃する。' },
  { id: 'hangar',   x: 800,  name: '整備ハンガー', sub: 'HANGAR',     icon: '▚', kind: 'go',
    line: '機体の編成・改造。武装と外装を組み替える。' },
  { id: 'supply',   x: 1040, name: '補給廠',       sub: 'SUPPLY',     icon: '◆', kind: 'go',
    line: 'チケットで補給ガチャを回す。' },
  { id: 'lab',      x: 1280, name: '研究室',       sub: 'LAB',        icon: '⌬', kind: 'panel',
    line: '持ち帰った能力データから、新しいコアや装備を作る。' },
  { id: 'training', x: 1520, name: '訓練場',       sub: 'TRAINING',   icon: '◎', kind: 'go',
    line: '的と動く相手で撃ち心地を確かめる。' },
  { id: 'quarters', x: 1760, name: '自室',         sub: 'QUARTERS',   icon: '⌂', kind: 'panel',
    line: 'パイロットの部屋。戦績と手持ちの外装を眺める。' },
  { id: 'command',  x: 2000, name: '指令室',       sub: 'COMMAND',    icon: '★', kind: 'panel',
    line: '司令官に会う。次の方針を聞ける。' },
  { id: 'bridge',   x: 2150, name: '運転室',       sub: 'BRIDGE',     icon: '✦', kind: 'panel',
    line: '艦の操舵室。航路と艦の状態を見る。' },
];
const DOOR_REACH = 64;      // 扉の前と見なす距離

/* ---------------- 司令官のせりふ ----------------
   制圧数で内容が変わる。最後の 1 本は繰り返し使う。 */
function chiefLines(save) {
  const cleared = Object.keys(save.cleared || {}).length;
  const name = (save.pilot && save.pilot.callsign) || 'RAIDER-01';
  if (cleared === 0) {
    return [
      `${name}、よく来た。ここが母艦アークライトだ。`,
      '相手はぜんぶ機械だ。痛みも恐れも感じない。だから、こちらは考えて勝つ。',
      '装甲に噛み合う属性を選べ。それだけで手応えが変わる。',
      'まずは廃棄港湾を片付けてこい。無理はするな。',
    ];
  }
  if (cleared < 3) {
    return [
      `${cleared} セクター制圧、確認した。悪くない。`,
      '背中と胸に武装を足せるようになった。あれは君が撃たなくても、機体が勝手に撃つ。',
      'それと EMP 爆弾だ。相手が機械なら、当てた 1 体は完全に止まる。厄介な個体に使え。',
      '整備班が新しい塗装も用意している。好きに塗れ。士気の問題だ。',
    ];
  }
  if (cleared < 6) {
    return [
      '深部の敵は数で来る。単騎で押すな。',
      'ドローンベイを積め。あれは君の代わりに周りを見てくれる。',
      '四足機が上がってきている。武装は 1 本きりだが、砲は機体が自分で狙う。君はグレネードに集中しろ。',
    ];
  }
  return [
    '全セクター制圧。……よくやった、と言っておく。',
    '記録は残る。君の部屋に飾ってある。',
    '休め。次の作戦はまだ決まっていない。',
  ];
}

/* ---------------- 星（窓と宇宙の背景に使い回す） ---------------- */
function makeStars(n, w, h) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: rnd(w), y: rnd(h), z: rnd(0.3, 1), r: rnd(0.6, 1.8) });
  return out;
}
function drawStars(ctx, stars, x0, y0, w, h, t, drift) {
  for (const s of stars) {
    const x = ((s.x - t * (drift || 0) * s.z) % w + w) % w;
    ctx.globalAlpha = 0.25 + s.z * 0.6;
    ctx.fillStyle = '#dfe9ff';
    ctx.fillRect(x0 + x, y0 + (s.y % h), s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

/* =========================================================================
   帰投の演出
   0: 回収 ― 輸送機が降りてきて機体を吊る
   1: 帰艦 ― 大気圏を抜けて母艦アークライトへ寄る
   2: 着艦 ― 艦の下部ハッチが開き、輸送機が格納デッキへ降りてくる
   ========================================================================= */
const CUT_DUR = [3.4, 3.8, 5.2];

class Cutscene {
  constructor(app, onDone) {
    this.app = app;
    this.canvas = app.canvas;
    this.ctx = this.canvas.getContext('2d');
    this.onDone = onDone;
    this.t = 0;
    this.stage = 0;
    this.done = false;
    const lo = app.save ? window.MRField.buildLoadout(1, app.save) : null;
    this.lo = lo;
    this.col = lo ? lo.colors : { body: '#5b7fa8', trim: '#9fd4ff', accent: '#ffd166' };
    this.shape = lo ? lo.shape : 'standard';
    this.attach = lo ? lo.attachments : [];
    this.decal = lo ? lo.decal : null;
    this.clouds = [];
    for (let i = 0; i < 18; i++) {
      this.clouds.push({ x: rnd(-200, 1400), y: rnd(40, 420), r: rnd(28, 96), v: rnd(30, 110), a: rnd(0.05, 0.18) });
    }
    this.stars = makeStars(160, 1600, 900);
  }

  skip() { this.finish(); }
  finish() {
    if (this.done) return;
    this.done = true;
    this.onDone();
  }

  update(dt) {
    this.t += dt;
    if (this.t >= CUT_DUR[this.stage]) {
      this.t = 0;
      this.stage++;
      if (this.stage >= CUT_DUR.length) return this.finish();
      if (this.stage === 2) this.app.audio.sfx('uiBig');
    }
  }

  /* 上下に黒帯を入れた映画風の枠で描く */
  draw() {
    const cv = this.canvas, ctx = this.ctx;
    const dpr = this.app.dpr || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    const W = cv.width / dpr, H = cv.height / dpr;

    if (this.stage === 0) this.drawPickup(ctx, W, H);
    else if (this.stage === 1) this.drawFlight(ctx, W, H);
    else this.drawLanding(ctx, W, H);

    const bar = H * 0.10;
    ctx.fillStyle = '#05080d';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
    const caption = [
      '回収班 ― 輸送機が降りてくる',
      `帰艦中 ― 母艦 ${SHIP_NAME} へ`,
      '着艦 ― 艦の下部ハッチが開く',
    ][this.stage];
    ctx.fillStyle = '#dff0ff';
    ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(caption, W / 2, H - bar * 0.38);
    ctx.fillStyle = 'rgba(143,212,255,0.55)';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('クリック / Space でスキップ', W / 2, bar * 0.62);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  /* ---------- 空と雲 ---------- */
  sky(ctx, W, H, top, bottom) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  drawClouds(ctx, W, H) {
    for (const c of this.clouds) {
      c.x -= c.v * 0.016;
      if (c.x < -160) { c.x = W + rnd(40, 300); c.y = rnd(40, H * 0.66); }
      ctx.fillStyle = `rgba(200,220,240,${c.a})`;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.r, c.r * 0.42, 0, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + c.r * 0.5, c.y + c.r * 0.12, c.r * 0.7, c.r * 0.32, 0, 0, TAU); ctx.fill();
    }
  }

  /* ---------- 輸送機 ---------- */
  plane(ctx, x, y, s, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    ctx.scale(s, s);
    /* 主翼 */
    ctx.fillStyle = '#4b5766';
    ctx.beginPath();
    ctx.moveTo(10, -8); ctx.lineTo(-42, -58); ctx.lineTo(-16, -58); ctx.lineTo(32, -8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a323d'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#3c4654';
    ctx.beginPath();
    ctx.moveTo(10, 8); ctx.lineTo(-42, 54); ctx.lineTo(-16, 54); ctx.lineTo(32, 8);
    ctx.closePath(); ctx.fill();
    ctx.stroke();
    /* 尾翼 */
    ctx.fillStyle = '#525f70';
    ctx.beginPath();
    ctx.moveTo(-78, -10); ctx.lineTo(-102, -56); ctx.lineTo(-62, -12); ctx.closePath(); ctx.fill();
    ctx.stroke();
    /* 胴体 */
    ctx.fillStyle = '#5b6878';
    roundRect(ctx, -84, -17, 170, 36, 14); ctx.fill();
    ctx.strokeStyle = '#2a323d'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#6d7b8d';
    roundRect(ctx, -60, -13, 120, 12, 6); ctx.fill();
    /* 機首と風防 */
    ctx.fillStyle = '#6d7b8d';
    roundRect(ctx, 60, -13, 34, 26, 12); ctx.fill();
    ctx.fillStyle = '#8fe0ff';
    roundRect(ctx, 68, -9, 20, 11, 5); ctx.fill();
    /* エンジン二基と噴射 */
    for (const sx of [-34, 10]) {
      ctx.fillStyle = '#39424e';
      roundRect(ctx, sx, 6, 34, 15, 6); ctx.fill();
      ctx.strokeStyle = '#232a34'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = 'rgba(127,240,255,0.85)';
      roundRect(ctx, sx - 11, 9, 11, 8, 4); ctx.fill();
      ctx.fillStyle = 'rgba(127,240,255,0.25)';
      roundRect(ctx, sx - 26, 10, 16, 6, 3); ctx.fill();
    }
    /* 貨物ハッチと識別帯 */
    ctx.fillStyle = '#39424e';
    roundRect(ctx, -46, 4, 40, 15, 4); ctx.fill();
    ctx.fillStyle = '#ffcf4a';
    ctx.fillRect(-14, -17, 7, 36);
    ctx.fillStyle = 'rgba(223,230,240,0.9)';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText('SALVAGE', -76, -3);
    ctx.restore();
  }

  /* ---------- 母艦の外観。hatch 0→1 で下部ハッチが開く ---------- */
  ship(ctx, cx, cy, s, hatch) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    /* 下部の張り出し（格納庫ブロック） */
    ctx.fillStyle = '#222c40';
    roundRect(ctx, -170, 30, 340, 70, 12); ctx.fill();
    ctx.strokeStyle = '#38455f'; ctx.lineWidth = 3; ctx.stroke();
    /* 主船体 */
    ctx.fillStyle = '#2c3850';
    ctx.beginPath();
    ctx.moveTo(-330, 0); ctx.lineTo(-268, -54); ctx.lineTo(250, -54);
    ctx.lineTo(360, -14); ctx.lineTo(360, 16); ctx.lineTo(250, 44);
    ctx.lineTo(-268, 44); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(67,83,115,0.85)'; ctx.lineWidth = 3; ctx.stroke();
    /* 上部構造 */
    ctx.fillStyle = '#354363';
    roundRect(ctx, -110, -110, 250, 60, 10); ctx.fill();
    ctx.strokeStyle = '#4a5b80'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#8fd4ff';
    for (let i = 0; i < 9; i++) ctx.fillRect(-92 + i * 26, -94, 14, 9);
    /* 前方の運転室 */
    ctx.fillStyle = '#3d4d70';
    ctx.beginPath();
    ctx.moveTo(150, -54); ctx.lineTo(268, -40); ctx.lineTo(268, -14); ctx.lineTo(150, -14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(143,212,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(176, -46); ctx.lineTo(258, -36); ctx.lineTo(258, -22); ctx.lineTo(176, -22);
    ctx.closePath(); ctx.fill();
    /* 主機 */
    for (const oy of [-26, 4]) {
      ctx.fillStyle = '#1c2436';
      roundRect(ctx, -358, oy, 40, 22, 6); ctx.fill();
      ctx.fillStyle = 'rgba(127,240,255,0.75)';
      roundRect(ctx, -380, oy + 4, 24, 14, 6); ctx.fill();
      ctx.fillStyle = 'rgba(127,240,255,0.20)';
      roundRect(ctx, -430, oy + 6, 54, 10, 5); ctx.fill();
    }
    /* パネル線と識別 */
    ctx.strokeStyle = 'rgba(0,0,0,0.30)'; ctx.lineWidth = 2;
    for (let i = -5; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(i * 56, -50); ctx.lineTo(i * 56, 40); ctx.stroke();
    }
    ctx.fillStyle = '#ffcf4a';
    ctx.fillRect(-40, -52, 10, 96);
    ctx.fillStyle = 'rgba(223,230,240,0.85)';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText('ARC-LIGHT', 10, 26);

    /* 下部ハッチ */
    const h = clamp(hatch || 0, 0, 1);
    ctx.fillStyle = '#0a1020';
    roundRect(ctx, -104, 84, 208, 18, 5); ctx.fill();
    ctx.fillStyle = '#39476a';
    roundRect(ctx, -104 - h * 96, 84, 104, 18, 5); ctx.fill();
    roundRect(ctx, 0 + h * 96, 84, 104, 18, 5); ctx.fill();
    ctx.strokeStyle = '#55679a'; ctx.lineWidth = 2;
    roundRect(ctx, -104 - h * 96, 84, 104, 18, 5); ctx.stroke();
    roundRect(ctx, 0 + h * 96, 84, 104, 18, 5); ctx.stroke();
    if (h > 0.05) {
      ctx.fillStyle = `rgba(255,207,74,${0.25 * h})`;
      roundRect(ctx, -100, 86, 200, 14, 4); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- 0: 回収 ---------- */
  drawPickup(ctx, W, H) {
    const k = clamp(this.t / CUT_DUR[0], 0, 1);
    this.sky(ctx, W, H, '#26364c', '#5a4a3c');
    this.drawClouds(ctx, W, H);
    const gy = H * 0.74;
    ctx.fillStyle = '#2b2419';
    ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 14; i++) {
      const x = (i * 137) % W;
      ctx.fillRect(x, gy + 12 + (i % 4) * 18, 60 + (i % 3) * 40, 5);
    }
    for (let i = 0; i < 4; i++) {
      const x = W * (0.12 + i * 0.22);
      ctx.fillStyle = `rgba(70,68,72,${0.25 + 0.1 * Math.sin(this.t * 2 + i)})`;
      ctx.beginPath(); ctx.ellipse(x, gy - 16, 40, 14, 0, 0, TAU); ctx.fill();
    }

    const lift = k > 0.72 ? (k - 0.72) / 0.28 * 80 : 0;
    const mx = W * 0.5, my = gy - 42 - lift;
    const px = lerp(-260, W * 0.5, clamp(k / 0.7, 0, 1));
    const py = lerp(H * 0.24, H * 0.34, clamp(k / 0.7, 0, 1));
    if (k > 0.45) {
      ctx.strokeStyle = 'rgba(200,210,225,0.75)'; ctx.lineWidth = 2;
      for (const dx of [-22, 22]) {
        ctx.beginPath(); ctx.moveTo(px + dx * 0.7, py + 22); ctx.lineTo(mx + dx, my - 34); ctx.stroke();
      }
    }
    R.shadow(ctx, mx, gy + 6, 52 - lift * 0.2, 15, 0.32);
    R.drawRobot(ctx, {
      x: mx, y: my, r: 46, ang: -0.4, aim: -0.4,
      walkPhase: 0, muzzle: 0, recoil: 0, hitFlash: 0, thrust: lift > 4,
    }, this.col, { shape: this.shape, decal: this.decal, attach: this.attach });

    this.plane(ctx, px, py, 1.5, 0.06);
  }

  /* ---------- 1: 帰艦 ---------- */
  drawFlight(ctx, W, H) {
    const k = clamp(this.t / CUT_DUR[1], 0, 1);
    /* 大気の色が抜けて宇宙になる */
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070b18');
    g.addColorStop(1, `rgb(${Math.round(lerp(70, 16, k))},${Math.round(lerp(58, 22, k))},${Math.round(lerp(74, 42, k))})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawStars(ctx, this.stars, 0, 0, 1600, 900, this.t * 40, 1);
    /* 眼下の惑星 */
    ctx.fillStyle = '#2a3348';
    ctx.beginPath(); ctx.ellipse(W * 0.5, H * 1.42, W * 0.9, H * 0.62, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(120,180,255,0.16)';
    ctx.beginPath(); ctx.ellipse(W * 0.5, H * 1.40, W * 0.92, H * 0.64, 0, 0, TAU); ctx.fill();

    /* 母艦が近づいてくる */
    const sx = lerp(W + 640, W * 0.66, k);
    this.ship(ctx, sx, H * 0.38, lerp(0.55, 0.95, k), 0);

    const px = W * 0.24 + Math.sin(this.t * 1.2) * 10;
    const py = H * 0.54 + Math.sin(this.t * 0.9) * 8;
    ctx.strokeStyle = 'rgba(200,210,225,0.75)'; ctx.lineWidth = 2.4;
    for (const dx of [-18, 18]) {
      ctx.beginPath(); ctx.moveTo(px + dx, py + 22); ctx.lineTo(px + dx * 1.5, py + 104); ctx.stroke();
    }
    R.drawRobot(ctx, {
      x: px, y: py + 138, r: 42, ang: 0.25, aim: 0.25,
      walkPhase: 0, muzzle: 0, recoil: 0, hitFlash: 0, thrust: false,
    }, this.col, { shape: this.shape, decal: this.decal, attach: this.attach });
    this.plane(ctx, px, py, 1.5, -0.03);
  }

  /* ---------- 2: 着艦（下部ハッチから格納デッキへ降りてくる） ---------- */
  drawLanding(ctx, W, H) {
    const k = clamp(this.t / CUT_DUR[2], 0, 1);
    const deckY = H * 0.80;
    const ceil = H * 0.20;

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d1424'); g.addColorStop(1, '#1d273b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    /* 天井 ＝ 艦の下部ハッチ。0.26 までに左右へ開く（端は開ききらない） */
    const hatch = clamp(k / 0.26, 0, 1) * 0.74;
    const half = W * 0.5;
    /* 開口部から見える宇宙 */
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, W, ceil);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, ceil); ctx.clip();
    drawStars(ctx, this.stars, 0, 0, 1600, 900, this.t * 18, 0.5);
    ctx.restore();
    /* 左右へ引く扉 */
    for (const side of [-1, 1]) {
      const x = side < 0 ? -half * hatch : half + half * hatch;
      ctx.fillStyle = '#26314a';
      roundRect(ctx, x, ceil - 34, half, 34, 6); ctx.fill();
      ctx.strokeStyle = '#3d4c6e'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#1b2438';
      for (let i = 0; i < 5; i++) roundRect(ctx, x + 20 + i * (half / 5), ceil - 28, half / 9, 22, 4), ctx.fill();
      ctx.fillStyle = '#ffcf4a';
      ctx.fillRect(side < 0 ? x + half - 10 : x, ceil - 34, 10, 34);
    }
    /* 開口部のレール */
    ctx.fillStyle = '#333f5c';
    ctx.fillRect(0, ceil - 2, W, 8);
    ctx.fillStyle = `rgba(255,207,74,${0.20 + 0.14 * (hatch / 0.74)})`;
    ctx.fillRect(0, ceil + 6, W, 4);

    /* 側壁 */
    ctx.fillStyle = '#212c44';
    ctx.fillRect(0, ceil + 10, W, deckY - ceil - 10);
    ctx.strokeStyle = 'rgba(143,212,255,0.10)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath(); ctx.moveTo(i * W / 10, ceil + 10); ctx.lineTo(i * W / 10, deckY); ctx.stroke();
    }
    /* 壁の表示と資材 */
    ctx.fillStyle = 'rgba(143,212,255,0.20)';
    ctx.font = '800 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('LOWER HANGAR  D-04', 40, ceil + 60);
    ctx.fillStyle = '#2a3550';
    for (let i = 0; i < 5; i++) {
      const cx = W * (0.06 + i * 0.055) + (i % 2) * 12;
      roundRect(ctx, cx, deckY - 46 - (i % 2) * 30, 54, 46, 5); ctx.fill();
      ctx.strokeStyle = '#3d4c6e'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffcf4a';
      ctx.fillRect(cx + 6, deckY - 40 - (i % 2) * 30, 42, 4);
      ctx.fillStyle = '#2a3550';
    }
    for (let i = 0; i < 3; i++) {
      const cx = W * (0.84 + i * 0.05);
      roundRect(ctx, cx, deckY - 44, 50, 44, 5); ctx.fill();
      ctx.strokeStyle = '#3d4c6e'; ctx.lineWidth = 2; ctx.stroke();
    }
    /* デッキ */
    ctx.fillStyle = '#2e3a52';
    ctx.fillRect(0, deckY, W, H - deckY);
    ctx.strokeStyle = 'rgba(255,207,74,0.35)'; ctx.lineWidth = 3;
    ctx.setLineDash([26, 18]); ctx.lineDashOffset = -this.t * 20;
    ctx.beginPath(); ctx.moveTo(0, deckY + 22); ctx.lineTo(W, deckY + 22); ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 9; i++) {
      const a = 0.4 + 0.35 * Math.sin(this.t * 4 + i);
      ctx.fillStyle = `rgba(255,207,74,${a})`;
      ctx.beginPath(); ctx.arc(W * 0.08 + i * W * 0.11, deckY + 8, 5, 0, TAU); ctx.fill();
    }

    /* 輸送機がハッチから降りてくる → 機体を降ろして戻る */
    const desc = clamp((k - 0.14) / 0.38, 0, 1);
    const rise = clamp((k - 0.64) / 0.36, 0, 1);
    const planeY = lerp(ceil - 90, deckY - 200, desc) - rise * (deckY + 200);
    const mx = W * 0.40;
    const mechDown = clamp((k - 0.44) / 0.18, 0, 1);
    const my = lerp(planeY + 124, deckY - 52, mechDown);

    if (rise < 0.98) {
      ctx.strokeStyle = `rgba(200,210,225,${0.75 * (1 - rise)})`; ctx.lineWidth = 2.4;
      for (const dx of [-20, 20]) {
        ctx.beginPath(); ctx.moveTo(mx + dx, planeY + 22); ctx.lineTo(mx + dx * 1.1, my - 34); ctx.stroke();
      }
    }
    R.shadow(ctx, mx, deckY - 2, 56, 16, 0.35);
    R.drawRobot(ctx, {
      x: mx, y: my, r: 48, ang: 0.2, aim: 0.2,
      walkPhase: 0, muzzle: 0, recoil: 0, hitFlash: 0, thrust: mechDown > 0 && mechDown < 1,
    }, this.col, { shape: this.shape, decal: this.decal, attach: this.attach });
    if (desc > 0.02) this.plane(ctx, mx, planeY, 1.4, 0);

    /* コックピットが開いてパイロットが降りる */
    if (k > 0.58) {
      const t2 = (k - 0.58) / 0.42;
      ctx.fillStyle = 'rgba(255,220,140,0.30)';
      ctx.beginPath(); ctx.ellipse(mx + 14, my - 8, 30 * t2, 16 * t2, 0, 0, TAU); ctx.fill();
      const walk = clamp((t2 - 0.2) / 0.8, 0, 1);
      const pxp = lerp(mx + 26, W * 0.64, walk);
      const pyp = lerp(my + 10, deckY + 40, Math.min(1, walk * 1.6));
      R.drawPilot(ctx, pxp, pyp, lerp(60, 132, walk), {
        suit: PILOT_LOOK.suit, trim: PILOT_LOOK.trim, skin: PILOT_LOOK.skin,
        step: walk < 0.96 ? this.t * 9 : 0,
        wave: walk > 0.96 ? 0.5 + 0.5 * Math.sin(this.t * 6) : 0,
      });
      if (walk > 0.9) {
        ctx.fillStyle = '#dff0ff';
        ctx.font = '800 22px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('着艦完了', W * 0.64, deckY - 132);
        ctx.textAlign = 'left';
      }
    }
  }
}

/* =========================================================================
   艦内（歩ける拠点）
   ========================================================================= */
class Base {
  constructor(app) {
    this.app = app;
    this.room = null;          // 開いている部屋
    this.talk = 0;
    this.craftMsg = null;
    this.t = 0;
    this.raf = null;
    this.px = DECK.spawn;      // パイロットの位置
    this.pvx = 0;
    this.face = 1;
    this.step = 0;
    this.camX = 0;
    this.targetX = null;       // クリックで歩く先
    this.keys = new Set();
    this.lo = null;
    this.stars = makeStars(90, 900, 300);
    this.bind();
  }

  /* ---------------- 入力と配線 ---------------- */
  bind() {
    el('base-rooms').addEventListener('click', (e) => {
      const b = e.target.closest('.roomchip'); if (!b) return;
      /* ショートカット。その扉の前へ移してから入る */
      const d = DOORS.find((x) => x.id === b.dataset.room);
      if (d) { this.px = d.x; this.pvx = 0; this.targetX = null; }
      this.enter(b.dataset.room);
    });
    el('btn-base-close').addEventListener('click', () => this.leaveRoom());
    el('base-panel-body').addEventListener('click', (e) => {
      const cb = e.target.closest('[data-craft]');
      if (cb && !cb.disabled) { this.craft(cb.dataset.craft); return; }
      if (e.target.closest('#bridge-launch')) { this.app.go('sector'); return; }
      if (!e.target.closest('#chief-next')) return;
      const lines = chiefLines(this.app.save);
      this.talk = Math.min(lines.length - 1, this.talk + 1);
      this.app.save.base.talk = Math.max(this.app.save.base.talk || 0, this.talk);
      C.Save.save();
      this.app.audio.sfx('ui');
      this.render();
    });
    el('btn-base-title').addEventListener('click', () => this.app.go('title'));

    /* 歩く / 入る */
    window.addEventListener('keydown', (e) => {
      if (this.app.screen !== 'base') return;
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName || '')) return;
      this.keys.add(e.code);
      if (this.room) {
        if (e.code === 'Escape') { e.preventDefault(); this.leaveRoom(); }
        return;
      }
      if (['ArrowUp', 'KeyW', 'Space', 'Enter', 'KeyE'].indexOf(e.code) >= 0) {
        e.preventDefault();
        const d = this.doorNear();
        if (d) this.enter(d.id);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    const cv = el('base-canvas');
    cv.addEventListener('click', (e) => {
      if (this.room) return;
      const r = cv.getBoundingClientRect();
      const scale = cv.height / 380;
      const wx = this.camX + ((e.clientX - r.left) / r.width) * (cv.width / scale);
      this.targetX = clamp(wx, 90, DECK.w - 90);
    });
  }

  doorNear() {
    for (const d of DOORS) if (Math.abs(d.x - this.px) < DOOR_REACH) return d;
    return null;
  }

  enter(id) {
    const a = this.app;
    const d = DOORS.find((x) => x.id === id);
    if (!d) return;
    a.audio.sfx('uiBig');
    if (id === 'hangar') { a.hangarTab = 'loadout'; return a.go('hangar'); }
    if (id === 'supply') { a.hangarTab = 'gacha'; return a.go('hangar'); }
    if (id === 'training') return a.startMission(D.TRAINING);
    if (id === 'launch') return a.go('sector');
    this.room = id;
    this.targetX = null;
    this.pvx = 0;
    if (id === 'command') this.talk = 0;
    if (id === 'lab') this.craftMsg = null;
    this.render();
  }
  leaveRoom() {
    this.room = null;
    this.render();
    this.app.audio.sfx('ui');
  }

  show() {
    const s = this.app.save;
    if (s) {
      s.base.visits = (s.base.visits || 0) + 1;
      C.Save.save();
      this.lo = window.MRField.buildLoadout(1, s);
    }
    this.room = null;
    this.targetX = null;
    this.keys.clear();
    this.render();
    this.startScene();
  }
  hide() { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; } }

  /* ---------------- 表示 ---------------- */
  render() {
    const s = this.app.save;
    if (!s) return;
    el('base-scrap').textContent = s.scrap.toLocaleString();
    el('base-ticket').textContent = s.tickets;

    const cleared = Object.keys(s.cleared).length;
    const cur = DOORS.find((d) => d.id === this.room);
    el('base-caption').textContent = cur
      ? `${cur.name}（${cur.sub}）― ${cur.line}　Esc か「閉じる」で通路へ戻る`
      : `${SHIP_NAME} 艦内 ― 制圧 ${cleared} / ${D.SECTORS.length} セクター　（← → で歩く／↑ で入る）`;

    el('base-rooms').innerHTML = DOORS.map((d) => `
      <button class="roomchip ${this.room === d.id ? 'on' : ''}" data-room="${d.id}" title="${d.line}">
        <span class="rc-ico">${d.icon}</span><b>${d.name}</b>
      </button>`).join('');

    const panel = el('base-panel');
    el('base-body').classList.toggle('open', !!this.room);
    if (!this.room) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    el('base-panel-body').innerHTML =
      this.room === 'command' ? this.commandHtml() :
      this.room === 'lab' ? this.labHtml() :
      this.room === 'bridge' ? this.bridgeHtml() : this.quartersHtml();
  }

  commandHtml() {
    const lines = chiefLines(this.app.save);
    const i = clamp(this.talk, 0, lines.length - 1);
    const last = i >= lines.length - 1;
    return `
      <h3 class="bp-title">指令室 <small>COMMAND</small></h3>
      <div class="talk">
        <div class="talk-who">司令官 ハルバード大佐</div>
        <p class="talk-line">${lines[i]}</p>
        <div class="talk-foot">
          <span class="talk-count">${i + 1} / ${lines.length}</span>
          <button class="btn ${last ? 'btn-ghost' : 'btn-main'}" id="chief-next">${last ? 'もう一度聞く' : '次へ'}</button>
        </div>
      </div>
      <p class="note">司令官の話は、制圧したセクターが増えると変わる。</p>`;
  }

  /* ---------------- 運転室 ---------------- */
  bridgeHtml() {
    const s = this.app.save;
    const cleared = Object.keys(s.cleared).length;
    const next = D.SECTORS.find((x, i) => !s.cleared[x.id] && (i === 0 || s.cleared[D.SECTORS[i - 1].id]));
    const hhmm = (t) => `${Math.floor(t / 3600)}時間${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}分`;
    const samples = Object.values(s.samples || {}).reduce((a, b) => a + b, 0);
    return `
      <h3 class="bp-title">運転室 <small>BRIDGE</small></h3>
      <p class="pane-lead">${SHIP_NAME}。作戦区域の上空に留まり、下の戦域へ機体を降ろしている。</p>
      <div class="quart">
        <div class="q-card">
          <b>航行状態</b><small>NAVIGATION</small>
          <div class="q-rows">
            <div><span>現在の軌道</span><b>${next ? `${next.name} 上空` : '待機軌道'}</b></div>
            <div><span>次の目標</span><b>${next ? `${next.sub}（推奨 Lv.${next.lv}）` : 'なし'}</b></div>
            <div><span>制圧セクター</span><b>${cleared} / ${D.SECTORS.length}</b></div>
            <div><span>総飛行時間</span><b>${hhmm(s.playtime || 0)}</b></div>
          </div>
        </div>
        <div class="q-card">
          <b>艦の積載</b><small>CARGO</small>
          <div class="q-rows">
            <div><span>スクラップ</span><b>⬢ ${s.scrap.toLocaleString()}</b></div>
            <div><span>補給チケット</span><b>◆ ${s.tickets}</b></div>
            <div><span>能力データ</span><b>${samples} 個</b></div>
            <div><span>格納機体</span><b>${Object.keys(s.frames).length} 機</b></div>
          </div>
        </div>
      </div>
      <div class="panel-foot btns">
        <button class="btn btn-main" id="bridge-launch">${next ? '艦を目標へ向ける ― 出撃' : 'セクターを選ぶ'}</button>
      </div>
      <p class="note">出撃は格納デッキの発進口からでも行ける。</p>`;
  }

  /* ---------------- 研究室（開発） ---------------- */
  labHtml() {
    const s = this.app.save;
    const H = window.MRHangar;
    const stock = s.samples || {};
    const have = D.RECIPES.map((rp) => {
      const def = H.defOf(rp.out);
      const owned = !!H.rec(s, rp.out);
      let ok = s.scrap >= rp.scrap;
      const cost = Object.keys(rp.cost).map((k) => {
        const need = rp.cost[k], got = stock[k] || 0;
        if (got < need) ok = false;
        const A = D.ABILITIES[k];
        return `<span class="cost ${got >= need ? 'ok' : 'ng'}" style="border-color:${A.color}55">
          <i style="background:${A.color}"></i>${A.name}<b>${got}/${need}</b></span>`;
      }).join('');
      return `<div class="craft r${def.rarity}">
        <div class="craft-top">
          <b>${def.name}</b>
          <span class="c-rar r${def.rarity}">${def.rarity}</span>
        </div>
        <p class="craft-line">${rp.line}</p>
        <div class="craft-cost">${cost}<span class="cost scrapcost ${s.scrap >= rp.scrap ? 'ok' : 'ng'}"><i style="background:#ffcf4a"></i>スクラップ<b>${rp.scrap}</b></span></div>
        <div class="craft-foot">
          <span class="craft-own">${owned ? '所持済み ― 作ると限界突破' : '未所持'}</span>
          <button class="btn ${ok ? 'btn-main' : ''}" data-craft="${rp.id}" ${ok ? '' : 'disabled'}>作る</button>
        </div>
      </div>`;
    }).join('');

    const inv = Object.keys(D.ABILITIES).map((k) => {
      const A = D.ABILITIES[k], n = stock[k] || 0;
      return `<span class="sample ${n ? '' : 'zero'}" title="${A.line}">
        <i style="background:${A.color}"></i>${A.name}<b>${n}</b></span>`;
    }).join('');

    return `
      <h3 class="bp-title">研究室 <small>LAB</small></h3>
      <p class="pane-lead">倒した敵から吸い出した能力データは、そのままでは使えない。ここで組み直して初めて装備になる。</p>
      <div class="sample-box">${inv}</div>
      ${this.craftMsg ? `<div class="craft-msg">${this.craftMsg}</div>` : ''}
      <div class="craft-grid">${have}</div>`;
  }

  quartersHtml() {
    const s = this.app.save;
    const hhmm = (t) => `${Math.floor(t / 3600)}時間${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}分`;
    const ranks = Object.values(s.cleared).filter((c) => c.rank === 'S').length;
    const owned = D.SKINS.filter((k) => s.skins[k.id]);
    const total = (b) => Object.keys(s[b] || {}).length;
    return `
      <h3 class="bp-title">自室 <small>QUARTERS</small></h3>
      <div class="quart">
        <div class="q-card">
          <b>${(s.pilot && s.pilot.name) || 'ノヴァ'}</b>
          <small>${(s.pilot && s.pilot.callsign) || 'RAIDER-01'}</small>
          <div class="q-rows">
            <div><span>制圧セクター</span><b>${Object.keys(s.cleared).length} / ${D.SECTORS.length}</b></div>
            <div><span>S 評価</span><b>${ranks}</b></div>
            <div><span>累計撃破</span><b>${s.totalKills}</b></div>
            <div><span>出撃時間</span><b>${hhmm(s.playtime || 0)}</b></div>
            <div><span>艦に戻った回数</span><b>${s.base.visits || 0}</b></div>
          </div>
        </div>
        <div class="q-card">
          <b>収蔵品</b>
          <div class="q-rows">
            <div><span>機体</span><b>${total('frames')} / ${D.FRAMES.length}</b></div>
            <div><span>武装</span><b>${total('weapons')} / ${D.WEAPONS.length}</b></div>
            <div><span>コア</span><b>${total('cores')} / ${D.CORES.length}</b></div>
            <div><span>装着武装</span><b>${total('attachments')} / ${D.ATTACHMENTS.length}</b></div>
            <div><span>外装</span><b>${owned.length} / ${D.SKINS.length}</b></div>
          </div>
        </div>
      </div>
      <h4 class="bp-sub">塗装の棚</h4>
      <div class="skin-shelf">
        ${owned.map((k) => `<span class="shelf-item" title="${k.desc}">
          <i style="background:${k.body || '#2a3444'};border-color:${k.trim || '#5f7591'}"></i>${k.name}</span>`).join('') || '<span class="note">まだ塗装を持っていない。</span>'}
      </div>`;
  }

  craft(rid) {
    const s = this.app.save;
    const rp = D.RECIPES.find((r) => r.id === rid);
    if (!rp) return;
    if (s.scrap < rp.scrap) return;
    for (const k in rp.cost) if ((s.samples[k] || 0) < rp.cost[k]) return;
    for (const k in rp.cost) s.samples[k] -= rp.cost[k];
    s.scrap -= rp.scrap;
    const res = window.MRHangar.grant(s, rp.out);
    s.seen[rp.out] = true;
    C.Save.save();
    const def = window.MRHangar.defOf(rp.out);
    this.craftMsg = res.dup
      ? `${def.name} を作った。重複したので限界突破 ★${res.lb} になった。`
      : `${def.name} を作った。整備ハンガーで装備できる。`;
    this.app.audio.sfx('reveal', def.rarity || 'SR');
    this.render();
  }

  /* ================= 艦内の絵と移動 ================= */
  startScene() {
    const cv = el('base-canvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let last = performance.now();
    const tick = (now) => {
      if (this.app.screen !== 'base') { this.raf = null; return; }
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      this.t += dt;
      this.fit(cv);
      this.walk(dt, cv.width / (cv.height / 380));
      this.drawDeck(ctx, cv.width, cv.height);
      this.raf = requestAnimationFrame(tick);
    };
    if (!this.raf) this.raf = requestAnimationFrame(tick);
  }

  /* 表示枠に合わせて実解像度を合わせる */
  fit(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, Math.round(cv.clientWidth * dpr));
    const h = Math.max(200, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
  }

  walk(dt, viewW) {
    const SPD = 240;
    let dir = 0;
    if (!this.room) {
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dir -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) dir += 1;
      if (dir) this.targetX = null;
      if (!dir && this.targetX != null) {
        const d = this.targetX - this.px;
        if (Math.abs(d) < 8) this.targetX = null; else dir = d > 0 ? 1 : -1;
      }
    }
    this.pvx = lerp(this.pvx, dir * SPD, 1 - Math.pow(0.002, dt));
    this.px = clamp(this.px + this.pvx * dt, 90, DECK.w - 90);
    if (dir) this.face = dir;
    if (Math.abs(this.pvx) > 8) this.step += Math.abs(this.pvx) * dt * 0.055; else this.step = 0;
    this.camX = clamp(this.px - viewW / 2, 0, Math.max(0, DECK.w - viewW));
  }

  drawDeck(ctx, W, H) {
    const scale = H / 380;                      // 見取り図は高さ 380 を基準に描く
    const VW = W / scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-Math.round(this.camX), 0);

    const floorY = DECK.floorY, ceilY = DECK.ceilY;
    const x0 = this.camX - 60, x1 = this.camX + VW + 60;

    /* 壁 */
    const g = ctx.createLinearGradient(0, ceilY, 0, floorY);
    g.addColorStop(0, '#1a2338'); g.addColorStop(1, '#243049');
    ctx.fillStyle = g;
    ctx.fillRect(x0, ceilY, x1 - x0, floorY - ceilY);

    /* 天井 */
    ctx.fillStyle = '#151d30';
    ctx.fillRect(x0, 0, x1 - x0, ceilY);
    ctx.fillStyle = '#0f1626';
    for (let x = Math.floor(x0 / 120) * 120; x < x1; x += 120) {
      roundRect(ctx, x + 20, 8, 80, 16, 4); ctx.fill();
    }
    /* 天井灯と光の帯 */
    for (let x = Math.floor(x0 / 240) * 240; x < x1; x += 240) {
      ctx.fillStyle = 'rgba(180,220,255,0.75)';
      roundRect(ctx, x + 100, ceilY - 8, 60, 6, 3); ctx.fill();
      const lg = ctx.createLinearGradient(0, ceilY, 0, floorY);
      lg.addColorStop(0, 'rgba(180,220,255,0.10)'); lg.addColorStop(1, 'rgba(180,220,255,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(x + 100, ceilY); ctx.lineTo(x + 160, ceilY);
      ctx.lineTo(x + 210, floorY); ctx.lineTo(x + 50, floorY);
      ctx.closePath(); ctx.fill();
    }

    /* 壁のリブとパイプ */
    ctx.strokeStyle = 'rgba(143,212,255,0.10)'; ctx.lineWidth = 3;
    for (let x = Math.floor(x0 / 120) * 120; x < x1; x += 120) {
      ctx.beginPath(); ctx.moveTo(x, ceilY); ctx.lineTo(x, floorY); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,120,160,0.32)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x0, ceilY + 26); ctx.lineTo(x1, ceilY + 26); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,120,160,0.20)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0, ceilY + 40); ctx.lineTo(x1, ceilY + 40); ctx.stroke();

    /* 舷窓（星が流れる） */
    for (let x = Math.floor(x0 / 240) * 240; x < x1; x += 240) {
      const wx = x + 150;
      if (wx < 440 || wx > 1900) continue;        // 格納デッキと艦首側は別に描く
      ctx.save();
      ctx.fillStyle = '#05070f';
      roundRect(ctx, wx, ceilY + 58, 74, 44, 8); ctx.fill();
      ctx.beginPath(); roundRect(ctx, wx, ceilY + 58, 74, 44, 8); ctx.clip();
      drawStars(ctx, this.stars, wx, ceilY + 58, 74, 44, this.t * 14, 1);
      ctx.restore();
      ctx.strokeStyle = '#4a5b80'; ctx.lineWidth = 3;
      roundRect(ctx, wx, ceilY + 58, 74, 44, 8); ctx.stroke();
    }

    /* 床 */
    ctx.fillStyle = '#2b3752';
    ctx.fillRect(x0, floorY, x1 - x0, 380 - floorY);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = Math.floor(x0 / 40) * 40; x < x1; x += 40) ctx.fillRect(x, floorY, 3, 380 - floorY);
    ctx.fillStyle = 'rgba(143,212,255,0.16)';
    ctx.fillRect(x0, floorY, x1 - x0, 3);
    ctx.fillStyle = 'rgba(255,207,74,0.20)';
    ctx.fillRect(x0, floorY + 26, x1 - x0, 4);

    this.drawHangarBay(ctx, floorY, ceilY);
    this.drawBridgeEnd(ctx, floorY, ceilY);

    /* 扉 */
    const nearDoor = this.doorNear();
    for (const d of DOORS) {
      if (d.x < x0 - 140 || d.x > x1 + 140) continue;
      this.drawDoor(ctx, d, floorY, nearDoor === d);
    }

    /* パイロット */
    R.drawPilot(ctx, this.px, floorY + 30, 116, {
      suit: PILOT_LOOK.suit, trim: PILOT_LOOK.trim, skin: PILOT_LOOK.skin,
      step: this.step, wave: 0,
    });
    ctx.fillStyle = 'rgba(143,212,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(this.px + this.face * 30, floorY + 18);
    ctx.lineTo(this.px + this.face * 44, floorY + 24);
    ctx.lineTo(this.px + this.face * 30, floorY + 30);
    ctx.closePath(); ctx.fill();

    ctx.restore();

    /* 画面に固定する案内 */
    ctx.save();
    ctx.scale(scale, scale);
    if (!this.room && nearDoor) {
      const label = `${nearDoor.name} に入る`;
      ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      const cx = nearDoor.x - this.camX;
      ctx.fillStyle = 'rgba(8,14,22,0.9)';
      roundRect(ctx, cx - tw / 2 - 16, floorY - 232, tw + 32, 30, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(143,212,255,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#dff0ff'; ctx.textAlign = 'center';
      ctx.fillText(label, cx, floorY - 212);
      ctx.fillStyle = 'rgba(143,212,255,0.85)';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillText('↑ / Space', cx, floorY - 240);
      ctx.textAlign = 'left';
    }
    /* 現在地バー */
    const bw = VW - 40;
    ctx.fillStyle = 'rgba(8,14,22,0.6)';
    roundRect(ctx, 20, 12, bw, 8, 4); ctx.fill();
    for (const d of DOORS) {
      ctx.fillStyle = 'rgba(143,212,255,0.5)';
      ctx.beginPath(); ctx.arc(20 + (d.x / DECK.w) * bw, 16, 3, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#ffcf4a';
    ctx.beginPath(); ctx.arc(20 + (this.px / DECK.w) * bw, 16, 5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* 左端 ― 下部格納デッキ。輸送機と自機が置いてある */
  drawHangarBay(ctx, floorY, ceilY) {
    /* 天井のハッチ（ここから輸送機が降りてくる） */
    ctx.fillStyle = '#0a1020';
    roundRect(ctx, 96, ceilY - 14, 320, 16, 4); ctx.fill();
    ctx.fillStyle = '#39476a';
    roundRect(ctx, 96, ceilY - 14, 150, 16, 4); ctx.fill();
    roundRect(ctx, 266, ceilY - 14, 150, 16, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,207,74,0.35)';
    ctx.fillRect(246, ceilY - 12, 20, 12);
    ctx.fillStyle = 'rgba(223,230,240,0.55)';
    ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('下部ハッチ', 256, ceilY + 26);
    ctx.textAlign = 'left';

    /* 着艦標識 */
    ctx.strokeStyle = 'rgba(255,207,74,0.40)'; ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]); ctx.lineDashOffset = -this.t * 18;
    ctx.beginPath(); ctx.ellipse(256, floorY + 18, 150, 22, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);

    /* 駐機した輸送機 */
    ctx.save();
    ctx.translate(160, floorY - 30);
    ctx.fillStyle = '#4b5766';
    roundRect(ctx, -78, -16, 156, 32, 13); ctx.fill();
    ctx.strokeStyle = '#2a323d'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#6d7b8d';
    roundRect(ctx, 54, -12, 30, 24, 11); ctx.fill();
    ctx.fillStyle = '#8fe0ff';
    roundRect(ctx, 62, -8, 17, 10, 5); ctx.fill();
    ctx.fillStyle = '#39424e';
    roundRect(ctx, -44, 2, 38, 14, 4); ctx.fill();
    ctx.fillStyle = '#ffcf4a';
    ctx.fillRect(-12, -16, 6, 32);
    ctx.fillStyle = '#2f3742';
    roundRect(ctx, -70, 14, 18, 12, 4); ctx.fill();
    roundRect(ctx, 40, 14, 18, 12, 4); ctx.fill();
    ctx.restore();

    /* 自機 */
    const lo = this.lo;
    const col = lo ? lo.colors : { body: '#5b7fa8', trim: '#9fd4ff', accent: '#ffd166' };
    R.shadow(ctx, 382, floorY + 6, 44, 13, 0.34);
    R.drawRobot(ctx, {
      x: 382, y: floorY - 40, r: 42,
      ang: -0.4 + Math.sin(this.t * 0.4) * 0.05, aim: -0.4 + Math.sin(this.t * 0.5) * 0.1,
      walkPhase: 0, muzzle: 0, recoil: 0, hitFlash: 0, thrust: false,
    }, col, { shape: lo ? lo.shape : 'standard', decal: lo ? lo.decal : null, attach: lo ? lo.attachments : [] });

    ctx.fillStyle = 'rgba(143,212,255,0.5)';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('格納デッキ  LOWER HANGAR', 100, floorY + 56);
  }

  /* 右端 ― 運転室の前方窓 */
  drawBridgeEnd(ctx, floorY, ceilY) {
    const x = 2210;
    ctx.save();
    ctx.fillStyle = '#05070f';
    roundRect(ctx, x, ceilY + 34, 380, 150, 10); ctx.fill();
    ctx.beginPath(); roundRect(ctx, x, ceilY + 34, 380, 150, 10); ctx.clip();
    drawStars(ctx, this.stars, x, ceilY + 34, 380, 150, this.t * 26, 1);
    ctx.fillStyle = '#2a3348';
    ctx.beginPath(); ctx.ellipse(x + 190, ceilY + 256, 260, 110, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(120,180,255,0.18)';
    ctx.beginPath(); ctx.ellipse(x + 190, ceilY + 252, 268, 114, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#4a5b80'; ctx.lineWidth = 5;
    roundRect(ctx, x, ceilY + 34, 380, 150, 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(74,91,128,0.8)'; ctx.lineWidth = 4;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(x + i * 95, ceilY + 34); ctx.lineTo(x + i * 95, ceilY + 184); ctx.stroke();
    }
    /* 操舵コンソール */
    ctx.fillStyle = '#233049';
    roundRect(ctx, x + 40, floorY - 56, 300, 56, 8); ctx.fill();
    ctx.strokeStyle = '#3d4c6e'; ctx.lineWidth = 2.5; ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = 0.3 + 0.3 * Math.sin(this.t * 3 + i);
      ctx.fillStyle = `rgba(143,212,255,${a})`;
      roundRect(ctx, x + 60 + i * 46, floorY - 44, 30, 10, 3); ctx.fill();
    }
    ctx.fillStyle = 'rgba(143,212,255,0.5)';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('運転室  BRIDGE', x + 40, floorY + 56);
  }

  drawDoor(ctx, d, floorY, near) {
    const x = d.x, top = floorY - 150;
    /* 壁のくぼみ */
    ctx.fillStyle = '#1a2338';
    roundRect(ctx, x - 62, top - 16, 124, 166, 8); ctx.fill();
    ctx.strokeStyle = near ? 'rgba(143,212,255,0.9)' : 'rgba(90,120,160,0.5)';
    ctx.lineWidth = near ? 3.5 : 2.5;
    roundRect(ctx, x - 62, top - 16, 124, 166, 8); ctx.stroke();
    /* 扉本体（近づくと開く） */
    const open = near ? 22 : 0;
    ctx.fillStyle = near ? 'rgba(255,207,74,0.28)' : 'rgba(10,16,32,0.9)';
    ctx.fillRect(x - 52, top, 104, 150);
    ctx.fillStyle = '#2f3d5c';
    roundRect(ctx, x - 52 - open, top, 50, 150, 5); ctx.fill();
    ctx.strokeStyle = '#4a5b80'; ctx.lineWidth = 2;
    roundRect(ctx, x - 52 - open, top, 50, 150, 5); ctx.stroke();
    ctx.fillStyle = '#2f3d5c';
    roundRect(ctx, x + 2 + open, top, 50, 150, 5); ctx.fill();
    roundRect(ctx, x + 2 + open, top, 50, 150, 5); ctx.stroke();
    /* 表示板 */
    ctx.fillStyle = near ? '#1d3350' : '#16203a';
    roundRect(ctx, x - 56, top - 46, 112, 30, 5); ctx.fill();
    ctx.strokeStyle = near ? 'rgba(143,212,255,0.9)' : 'rgba(90,120,160,0.5)';
    ctx.lineWidth = 1.6;
    roundRect(ctx, x - 56, top - 46, 112, 30, 5); ctx.stroke();
    ctx.fillStyle = near ? '#dff0ff' : '#8ba0bb';
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${d.icon} ${d.name}`, x, top - 26);
    if (!near) {                       /* 近づくと案内を出すので、そのときは伏せる */
      ctx.fillStyle = 'rgba(120,150,190,0.75)';
      ctx.font = '700 8px system-ui, sans-serif';
      ctx.fillText(d.sub, x, top - 52);
    }
    ctx.textAlign = 'left';
    /* 足元のランプ */
    const a = near ? 0.75 : 0.25 + 0.15 * Math.sin(this.t * 2 + x);
    ctx.fillStyle = `rgba(255,207,74,${a})`;
    ctx.beginPath(); ctx.arc(x, floorY + 12, 4, 0, TAU); ctx.fill();
  }
}

window.MRBase = { Base, Cutscene, DOORS, SHIP_NAME };
})();
