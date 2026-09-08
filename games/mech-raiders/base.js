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

/* ---------------- 艦内の見取り図（真上から見た平面図） ----------------
   艦尾（左）が下部格納デッキ。そこから艦首（右）へ中央通路が伸び、
   通路の上下に各室が並ぶ。突き当たりが運転室。                          */
const DECK = {
  w: 2470, h: 380,
  corr: { x0: 460, x1: 2300, y0: 148, y1: 232 },   // 中央通路
  bay:  { x0: 84,  x1: 520,  y0: 46,  y1: 334 },   // 下部格納デッキ
  spawn: { x: 300, y: 190 },
};
const ROOM_UP = { y0: 34, y1: 136 };     // 通路の上側に並ぶ部屋
const ROOM_DN = { y0: 244, y1: 346 };    // 通路の下側に並ぶ部屋
const ROOM_LABEL = 36;                   // 部屋名を出す帯（奥側）の高さ
const ROOM_HW = 106;                     // 部屋の横半分
const PILOT_R = 15;                      // パイロットの当たり半径

/* 歩ける範囲。格納デッキと中央通路が x=460..520 で重なってつながる */
const AREAS = [DECK.bay, { x0: DECK.corr.x0, x1: DECK.corr.x1, y0: DECK.corr.y0, y1: DECK.corr.y1 }];

function walkable(x, y) {
  for (const a of AREAS) {
    if (x > a.x0 + PILOT_R && x < a.x1 - PILOT_R && y > a.y0 + PILOT_R && y < a.y1 - PILOT_R) return true;
  }
  return false;
}
/* 歩けない所をクリックされたら、いちばん近い床へ寄せる */
function snapWalkable(x, y) {
  let best = null, bd = Infinity;
  for (const a of AREAS) {
    const cx = clamp(x, a.x0 + PILOT_R + 2, a.x1 - PILOT_R - 2);
    const cy = clamp(y, a.y0 + PILOT_R + 2, a.y1 - PILOT_R - 2);
    const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
    if (d < bd) { bd = d; best = { x: cx, y: cy }; }
  }
  return best;
}

/* クリックした点がどの部屋の中か */
function inRoom(d, x, y) {
  if (d.side === 'fore') return x > DECK.corr.x1 && x < 2410 && y > 130 && y < 250;
  const r = d.side === 'up' ? ROOM_UP : ROOM_DN;
  return x > d.x - ROOM_HW && x < d.x + ROOM_HW && y > r.y0 && y < r.y1;
}

/* 船体の外形（真上から）。艦尾の格納ブロックから艦首へ細る */
function hullPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(2460, 190);
  ctx.lineTo(2380, 130); ctx.lineTo(2260, 60); ctx.lineTo(2160, 18); ctx.lineTo(640, 18);
  ctx.lineTo(560, 6); ctx.lineTo(28, 6); ctx.lineTo(4, 50);
  ctx.lineTo(4, 330); ctx.lineTo(28, 374); ctx.lineTo(560, 374);
  ctx.lineTo(640, 362); ctx.lineTo(2160, 362); ctx.lineTo(2260, 320); ctx.lineTo(2380, 250);
  ctx.closePath();
}

const DOORS = [
  { id: 'launch',   x: 600,  side: 'up',   name: '発進口',       sub: 'LAUNCH BAY', icon: '▶', kind: 'go',
    line: 'セクターを選んで出撃する。' },
  { id: 'hangar',   x: 840,  side: 'down', name: '整備ハンガー', sub: 'HANGAR',     icon: '▚', kind: 'go',
    line: '機体の編成・改造。武装と外装を組み替える。' },
  { id: 'supply',   x: 1080, side: 'up',   name: '補給廠',       sub: 'SUPPLY',     icon: '◆', kind: 'go',
    line: 'チケットで補給ガチャを回す。' },
  { id: 'lab',      x: 1320, side: 'down', name: '研究室',       sub: 'LAB',        icon: '⌬', kind: 'panel',
    line: '持ち帰った能力データから、新しいコアや装備を作る。' },
  { id: 'training', x: 1560, side: 'up',   name: '訓練場',       sub: 'TRAINING',   icon: '◎', kind: 'go',
    line: '的と動く相手で撃ち心地を確かめる。' },
  { id: 'quarters', x: 1800, side: 'down', name: '自室',         sub: 'QUARTERS',   icon: '⌂', kind: 'panel',
    line: 'パイロットの部屋。戦績と手持ちの外装を眺める。' },
  { id: 'command',  x: 2040, side: 'up',   name: '指令室',       sub: 'COMMAND',    icon: '★', kind: 'panel',
    line: '司令官に会う。次の方針を聞ける。' },
  { id: 'bridge',   x: 2300, side: 'fore', name: '運転室',       sub: 'BRIDGE',     icon: '✦', kind: 'panel',
    line: '艦の操舵室。航路と艦の状態を見る。' },
];
/* 扉の前に立つ位置 */
for (const d of DOORS) {
  d.sx = d.side === 'fore' ? DECK.corr.x1 - 36 : d.x;
  d.sy = d.side === 'up' ? DECK.corr.y0 + 26 : d.side === 'down' ? DECK.corr.y1 - 26 : 190;
}
const DOOR_REACH = 62;      // 扉の前と見なす距離

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
    this.px = DECK.spawn.x;    // パイロットの位置（真上から見た床の座標）
    this.py = DECK.spawn.y;
    this.pvx = 0;
    this.pvy = 0;
    this.face = 0;             // 向き（ラジアン。0 で右）
    this.step = 0;
    this.camX = 0;
    this.target = null;        // クリックで歩く先
    this.stuck = 0;
    this.keys = new Set();
    this.lo = null;
    this.stars = makeStars(220, 1600, DECK.h);
    this.winStars = makeStars(12, 60, 40);   // 小窓ごしの星は疎に
    this.bind();
  }

  /* ---------------- 入力と配線 ---------------- */
  bind() {
    el('base-rooms').addEventListener('click', (e) => {
      const b = e.target.closest('.roomchip'); if (!b) return;
      /* ショートカット。その扉の前へ移してから入る */
      const d = DOORS.find((x) => x.id === b.dataset.room);
      if (d) { this.px = d.sx; this.py = d.sy; this.pvx = this.pvy = 0; this.target = null; }
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
      if (/^Arrow|^Space$/.test(e.code)) e.preventDefault();
      if (['Space', 'Enter', 'KeyE'].indexOf(e.code) >= 0) {
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
      const scale = cv.height / DECK.h;
      const wx = this.camX + ((e.clientX - r.left) / r.width) * (cv.width / scale);
      const wy = ((e.clientY - r.top) / r.height) * DECK.h;
      /* 部屋をクリックしたら、その扉の前まで歩く */
      const d = DOORS.find((dd) => inRoom(dd, wx, wy));
      this.target = d ? { x: d.sx, y: d.sy } : snapWalkable(wx, wy);
      this.stuck = 0;
    });
  }

  doorNear() {
    for (const d of DOORS) {
      if (Math.hypot(d.sx - this.px, d.sy - this.py) < DOOR_REACH) return d;
    }
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
    this.target = null;
    this.pvx = this.pvy = 0;
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
    this.target = null;
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
      : `${SHIP_NAME} 艦内 ― 制圧 ${cleared} / ${D.SECTORS.length} セクター　（← ↑ ↓ → で歩く／Space で入る）`;

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
      this.walk(dt, cv.width / (cv.height / DECK.h));
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

  /* ================= 移動（真上から見た床の上を歩く） ================= */
  walk(dt, viewW) {
    const SPD = 215;
    let dx = 0, dy = 0;
    if (!this.room) {
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dx -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) dx += 1;
      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) dy -= 1;
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) dy += 1;
      if (dx || dy) this.target = null;
      if (!dx && !dy && this.target) {
        const tx = this.target.x - this.px, ty = this.target.y - this.py;
        const L = Math.hypot(tx, ty);
        if (L < 8) this.target = null; else { dx = tx / L; dy = ty / L; }
      }
    }
    const L = Math.hypot(dx, dy) || 1;
    const k = 1 - Math.pow(0.002, dt);
    this.pvx = lerp(this.pvx, dx / L * SPD, k);
    this.pvy = lerp(this.pvy, dy / L * SPD, k);

    /* 軸ごとに判定して、壁に沿って滑らせる */
    const nx = this.px + this.pvx * dt;
    if (walkable(nx, this.py)) this.px = nx; else this.pvx = 0;
    const ny = this.py + this.pvy * dt;
    if (walkable(this.px, ny)) this.py = ny; else this.pvy = 0;

    const sp = Math.hypot(this.pvx, this.pvy);
    if (sp > 10) { this.face = Math.atan2(this.pvy, this.pvx); this.step += sp * dt * 0.055; }
    else this.step = 0;
    /* 壁に阻まれて進めないままなら、クリックの目標は諦める */
    if (this.target && sp < 26) { this.stuck += dt; if (this.stuck > 0.5) { this.target = null; this.stuck = 0; } }
    else this.stuck = 0;

    this.camX = clamp(this.px - viewW / 2, 0, Math.max(0, DECK.w - viewW));
  }

  /* ================= 艦内の絵（真上から） ================= */
  drawDeck(ctx, W, H) {
    const scale = H / DECK.h;                   // 見取り図は高さ 380 を基準に描く
    const VW = W / scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-Math.round(this.camX), 0);

    const x0 = this.camX - 80, x1 = this.camX + VW + 80;
    const c = DECK.corr;

    /* --- 船の外は宇宙 --- */
    ctx.fillStyle = '#05070f';
    ctx.fillRect(x0, 0, x1 - x0, DECK.h);
    for (let tx = Math.floor(x0 / 1600) * 1600; tx < x1; tx += 1600) {
      drawStars(ctx, this.stars, tx, 0, 1600, DECK.h, this.t * 8, 0.5);
    }

    /* --- 船体の外板 --- */
    hullPath(ctx);
    ctx.fillStyle = '#1c2537'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.26)'; ctx.lineWidth = 2;
    for (let x = Math.floor(x0 / 110) * 110; x < x1; x += 110) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, DECK.h); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(143,212,255,0.07)'; ctx.lineWidth = 3;
    for (const y of [24, DECK.h - 24]) {
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    }
    ctx.restore();
    hullPath(ctx);
    ctx.strokeStyle = '#54689a'; ctx.lineWidth = 6; ctx.stroke();

    /* --- 中央通路 --- */
    const cg = ctx.createLinearGradient(0, c.y0, 0, c.y1);
    cg.addColorStop(0, '#354463'); cg.addColorStop(0.5, '#2b3853'); cg.addColorStop(1, '#354463');
    ctx.fillStyle = cg;
    ctx.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    for (let x = Math.max(c.x0, Math.floor(x0 / 70) * 70); x < Math.min(c.x1, x1); x += 70) {
      ctx.fillRect(x, c.y0, 2, c.y1 - c.y0);
    }
    /* 天井灯の落ちる明かり */
    for (let x = Math.max(c.x0, Math.floor(x0 / 200) * 200); x < Math.min(c.x1, x1); x += 200) {
      const lg = ctx.createRadialGradient(x + 100, 190, 6, x + 100, 190, 100);
      lg.addColorStop(0, 'rgba(190,225,255,0.15)'); lg.addColorStop(1, 'rgba(190,225,255,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x, c.y0, 200, c.y1 - c.y0);
    }
    /* 中央の誘導ライン */
    ctx.strokeStyle = 'rgba(255,207,74,0.30)'; ctx.lineWidth = 4;
    ctx.setLineDash([30, 22]); ctx.lineDashOffset = -this.t * 22;
    ctx.beginPath(); ctx.moveTo(c.x0, 190); ctx.lineTo(c.x1, 190); ctx.stroke();
    ctx.setLineDash([]);
    /* 通路と各室を隔てる隔壁 */
    ctx.fillStyle = '#3a4a70';
    ctx.fillRect(c.x0, ROOM_UP.y1, c.x1 - c.x0, c.y0 - ROOM_UP.y1);
    ctx.fillRect(c.x0, c.y1, c.x1 - c.x0, ROOM_DN.y0 - c.y1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(c.x0, c.y0 - 3, c.x1 - c.x0, 3);
    ctx.fillRect(c.x0, c.y1, c.x1 - c.x0, 3);
    /* 艦首側の突き当たり */
    ctx.fillStyle = '#3a4a70';
    ctx.fillRect(c.x1, c.y0 - 8, 16, c.y1 - c.y0 + 16);

    /* --- 各室 --- */
    const nearDoor = this.doorNear();
    for (const d of DOORS) {
      if (d.x < x0 - 280 || d.x > x1 + 280) continue;
      this.drawRoom(ctx, d, nearDoor === d);
    }

    /* --- 格納デッキ --- */
    if (x0 < DECK.bay.x1 + 80) this.drawHangarBay(ctx);

    /* --- パイロット --- */
    R.drawPilotTop(ctx, this.px, this.py, 42, {
      suit: PILOT_LOOK.suit, trim: PILOT_LOOK.trim, skin: PILOT_LOOK.skin,
      step: this.step, ang: this.face,
    });

    ctx.restore();

    /* --- 画面に固定する案内 --- */
    ctx.save();
    ctx.scale(scale, scale);
    if (!this.room && nearDoor) {
      const label = `${nearDoor.name} に入る`;
      ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      const cx = clamp(nearDoor.sx - this.camX, tw / 2 + 24, VW - tw / 2 - 24);
      const cy = nearDoor.side === 'down' ? c.y0 - 52 : c.y1 + 26;
      ctx.fillStyle = 'rgba(8,14,22,0.9)';
      roundRect(ctx, cx - tw / 2 - 16, cy, tw + 32, 30, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(143,212,255,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#dff0ff'; ctx.textAlign = 'center';
      ctx.fillText(label, cx, cy + 20);
      ctx.fillStyle = 'rgba(143,212,255,0.85)';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillText('Space / Enter', cx, cy + 42);
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

  /* ---------------- 通路ぞいの部屋 ---------------- */
  drawRoom(ctx, d, near) {
    if (d.side === 'fore') return this.drawBridgeRoom(ctx, d, near);
    const up = d.side === 'up';
    const r = up ? ROOM_UP : ROOM_DN;
    const rx = d.x - ROOM_HW, ry = r.y0, rw = ROOM_HW * 2, rh = r.y1 - r.y0;

    ctx.fillStyle = '#26314a';
    roundRect(ctx, rx, ry, rw, rh, 8); ctx.fill();
    ctx.save();
    ctx.beginPath(); roundRect(ctx, rx, ry, rw, rh, 8); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let x = rx; x < rx + rw; x += 46) ctx.fillRect(x, ry, 2, rh);
    this.roomProps(ctx, d, rx, up ? ry + ROOM_LABEL : ry, rw, rh - ROOM_LABEL);
    ctx.restore();
    ctx.strokeStyle = near ? 'rgba(143,212,255,0.85)' : '#46587e';
    ctx.lineWidth = near ? 4 : 3;
    roundRect(ctx, rx, ry, rw, rh, 8); ctx.stroke();

    /* 部屋名 ― 通路から遠い側の帯にまとめる */
    const ly = up ? ry : ry + rh - ROOM_LABEL;
    ctx.fillStyle = 'rgba(9,15,26,0.62)';
    ctx.fillRect(rx + 1, ly + (up ? 1 : 0), rw - 2, ROOM_LABEL - 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = near ? '#dff0ff' : 'rgba(165,195,228,0.9)';
    ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`${d.icon} ${d.name}`, d.x, ly + 17);
    ctx.fillStyle = 'rgba(125,158,198,0.7)';
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.fillText(d.sub, d.x, ly + 29);
    ctx.textAlign = 'left';

    this.drawDoor(ctx, d, near);
  }

  /* 通路と部屋をつなぐ引き戸 */
  drawDoor(ctx, d, near) {
    const up = d.side === 'up';
    const wy0 = up ? ROOM_UP.y1 : DECK.corr.y1;
    const wy1 = up ? DECK.corr.y0 : ROOM_DN.y0;
    const gw = 34;
    ctx.fillStyle = near ? 'rgba(255,207,74,0.32)' : '#151d30';
    ctx.fillRect(d.x - gw, wy0, gw * 2, wy1 - wy0);
    const open = near ? gw - 5 : 0;
    for (const s of [-1, 1]) {
      const px = s < 0 ? d.x - gw - open : d.x + open;
      ctx.fillStyle = '#33436a';
      roundRect(ctx, px, wy0 + 1, gw, wy1 - wy0 - 2, 3); ctx.fill();
      ctx.strokeStyle = '#5f74a4'; ctx.lineWidth = 1.6;
      roundRect(ctx, px, wy0 + 1, gw, wy1 - wy0 - 2, 3); ctx.stroke();
    }
    /* 扉の前を照らす床の帯 */
    const a = near ? 0.75 : 0.22 + 0.12 * Math.sin(this.t * 2 + d.x);
    ctx.fillStyle = `rgba(255,207,74,${a})`;
    ctx.fillRect(d.x - gw, up ? DECK.corr.y0 + 7 : DECK.corr.y1 - 11, gw * 2, 4);
  }

  /* 部屋ごとの中身 */
  roomProps(ctx, d, x, y, w, h) {
    const cx = x + w / 2, cy = y + h / 2;
    const box = (bx, by, bw, bh, col) => {
      ctx.fillStyle = col || '#2f3d5c';
      roundRect(ctx, bx, by, bw, bh, 4); ctx.fill();
      ctx.strokeStyle = '#4a5b80'; ctx.lineWidth = 1.6;
      roundRect(ctx, bx, by, bw, bh, 4); ctx.stroke();
    };
    switch (d.id) {
      case 'launch': {
        /* 上（船外）へ抜ける射出路 */
        ctx.fillStyle = '#141d33';
        ctx.fillRect(cx - 34, y, 68, h);
        ctx.fillStyle = '#04060c';
        ctx.fillRect(cx - 30, y + 4, 60, 28);
        ctx.save();
        ctx.beginPath(); ctx.rect(cx - 30, y + 4, 60, 28); ctx.clip();
        drawStars(ctx, this.winStars, cx - 30, y + 4, 60, 28, this.t * 30, 1);
        ctx.restore();
        ctx.strokeStyle = 'rgba(143,212,255,0.45)'; ctx.lineWidth = 2;
        ctx.strokeRect(cx - 30, y + 4, 60, 28);
        ctx.fillStyle = 'rgba(255,207,74,0.5)';
        for (let i = 0; i < 3; i++) {
          const yy = y + 40 + i * 9 + (this.t * 16 % 9);
          ctx.beginPath();
          ctx.moveTo(cx - 18, yy + 8); ctx.lineTo(cx, yy); ctx.lineTo(cx + 18, yy + 8);
          ctx.lineTo(cx + 18, yy + 12); ctx.lineTo(cx, yy + 4); ctx.lineTo(cx - 18, yy + 12);
          ctx.closePath(); ctx.fill();
        }
        box(x + 8, y + h - 32, 30, 26); box(x + w - 38, y + h - 32, 30, 26);
        break;
      }
      case 'hangar': {
        /* 整備架台が二基 */
        for (const ox of [-52, 52]) {
          ctx.strokeStyle = 'rgba(255,207,74,0.35)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(cx + ox, cy - 4, 26, 0, TAU); ctx.stroke();
          ctx.strokeStyle = '#4a5b80'; ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx + ox - 34, cy - 26); ctx.lineTo(cx + ox + 34, cy - 26);
          ctx.moveTo(cx + ox - 34, cy + 18); ctx.lineTo(cx + ox + 34, cy + 18);
          ctx.stroke();
        }
        box(x + 6, y + h - 30, 26, 22); box(x + w - 32, y + h - 30, 26, 22);
        break;
      }
      case 'supply': {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
          box(x + 16 + i * 46, y + 8 + j * 32, 34, 26, j ? '#33415f' : '#2c3a58');
          ctx.fillStyle = '#ffcf4a';
          ctx.fillRect(x + 21 + i * 46, y + 14 + j * 32, 24, 3);
        }
        break;
      }
      case 'lab': {
        /* 中央の解析卓 */
        ctx.fillStyle = '#22304d';
        ctx.beginPath(); ctx.arc(cx, cy, 30, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#4a5b80'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 30, 0, TAU); ctx.stroke();
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = `rgba(143,212,255,${0.5 - i * 0.13})`; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 8 + i * 7, this.t * (1 + i * 0.5), this.t * (1 + i * 0.5) + 2.2);
          ctx.stroke();
        }
        box(x + 8, y + 10, 26, h - 20); box(x + w - 34, y + 10, 26, h - 20);
        break;
      }
      case 'training': {
        ctx.fillStyle = 'rgba(255,207,74,0.09)';
        roundRect(ctx, cx - 44, y + 4, 88, h - 8, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(255,207,74,0.22)'; ctx.lineWidth = 2;
        ctx.setLineDash([8, 7]);
        roundRect(ctx, cx - 44, y + 4, 88, h - 8, 8); ctx.stroke();
        ctx.setLineDash([]);
        for (const ox of [-30, 0, 30]) {
          ctx.fillStyle = '#d8e6f5';
          ctx.beginPath(); ctx.arc(cx + ox, y + 22, 11, 0, TAU); ctx.fill();
          ctx.fillStyle = '#c0392b';
          ctx.beginPath(); ctx.arc(cx + ox, y + 22, 6, 0, TAU); ctx.fill();
          ctx.fillStyle = '#d8e6f5';
          ctx.beginPath(); ctx.arc(cx + ox, y + 22, 2.4, 0, TAU); ctx.fill();
        }
        box(x + 10, y + h - 34, 30, 24); box(x + w - 40, y + h - 34, 30, 24);
        break;
      }
      case 'quarters': {
        box(x + 12, y + 10, 44, 48, '#33415f');           // 寝台
        ctx.fillStyle = '#c9d8ea';
        roundRect(ctx, x + 17, y + 15, 34, 15, 3); ctx.fill();
        box(x + w - 62, y + 10, 50, 20);                   // 机
        ctx.fillStyle = 'rgba(143,212,255,0.6)';
        roundRect(ctx, x + w - 52, y + 14, 20, 11, 2); ctx.fill();
        box(x + w - 62, y + 38, 50, 18);                   // 棚
        ctx.fillStyle = 'rgba(143,212,255,0.10)';
        ctx.beginPath(); ctx.ellipse(cx + 4, y + h - 14, 34, 12, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'command': {
        /* 作戦卓を囲む椅子と、立っている司令官 */
        const tx = cx + 18;
        ctx.fillStyle = '#22304d';
        ctx.beginPath(); ctx.ellipse(tx, cy, 44, 22, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#4a5b80'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(tx, cy, 44, 22, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(143,212,255,${0.20 + 0.07 * Math.sin(this.t * 2)})`;
        ctx.beginPath(); ctx.ellipse(tx, cy, 30, 14, 0, 0, TAU); ctx.fill();
        for (const a of [0.7, 1.6, 2.5, 3.8, 4.7, 5.6]) {
          ctx.fillStyle = '#2f3d5c';
          ctx.beginPath(); ctx.arc(tx + Math.cos(a) * 56, cy + Math.sin(a) * 29, 7, 0, TAU); ctx.fill();
        }
        R.drawPilotTop(ctx, x + 26, cy, 32, {
          suit: CHIEF_LOOK.suit, trim: CHIEF_LOOK.trim, skin: CHIEF_LOOK.skin,
          cap: true, ang: 0, step: 0,
        });
        break;
      }
    }
  }

  /* ---------------- 艦首の運転室 ---------------- */
  drawBridgeRoom(ctx, d, near) {
    const pts = [[2314, 140], [2380, 166], [2398, 190], [2380, 214], [2314, 240]];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = '#26314a'; ctx.fill();
    ctx.save(); ctx.clip();
    /* 前方の窓（宇宙が見える） */
    ctx.fillStyle = '#05070f';
    ctx.fillRect(2372, 150, 30, 80);
    drawStars(ctx, this.winStars, 2372, 150, 30, 80, this.t * 24, 1);
    ctx.fillStyle = 'rgba(120,180,255,0.16)';
    ctx.beginPath(); ctx.arc(2392, 208, 22, 0, TAU); ctx.fill();
    /* 操舵席のコンソール */
    for (const oy of [-26, 26]) {
      ctx.fillStyle = '#2f3d5c';
      roundRect(ctx, 2334, 190 + oy - 11, 34, 22, 4); ctx.fill();
      ctx.strokeStyle = '#4a5b80'; ctx.lineWidth = 1.6;
      roundRect(ctx, 2334, 190 + oy - 11, 34, 22, 4); ctx.stroke();
      ctx.fillStyle = `rgba(143,212,255,${0.35 + 0.25 * Math.sin(this.t * 3 + oy)})`;
      roundRect(ctx, 2340, 190 + oy - 6, 22, 8, 2); ctx.fill();
      ctx.fillStyle = '#2a3550';
      ctx.beginPath(); ctx.arc(2326, 190 + oy, 7, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.strokeStyle = near ? 'rgba(143,212,255,0.85)' : '#46587e';
    ctx.lineWidth = near ? 4 : 3; ctx.stroke();

    /* 突き当たりの引き戸 */
    const c = DECK.corr;
    const gh = 30;
    ctx.fillStyle = near ? 'rgba(255,207,74,0.32)' : '#151d30';
    ctx.fillRect(c.x1, 190 - gh, 16, gh * 2);
    const open = near ? gh - 5 : 0;
    for (const s of [-1, 1]) {
      const py = s < 0 ? 190 - gh - open : 190 + open;
      ctx.fillStyle = '#33436a';
      roundRect(ctx, c.x1 + 1, py, 14, gh, 3); ctx.fill();
      ctx.strokeStyle = '#5f74a4'; ctx.lineWidth = 1.6;
      roundRect(ctx, c.x1 + 1, py, 14, gh, 3); ctx.stroke();
    }
    const a = near ? 0.75 : 0.22 + 0.12 * Math.sin(this.t * 2);
    ctx.fillStyle = `rgba(255,207,74,${a})`;
    ctx.fillRect(c.x1 - 12, 190 - gh, 4, gh * 2);

    ctx.fillStyle = 'rgba(9,15,26,0.62)';
    roundRect(ctx, 2300, 102, 104, 34, 5); ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = near ? '#dff0ff' : 'rgba(165,195,228,0.9)';
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('✦ 運転室', 2352, 119);
    ctx.fillStyle = 'rgba(125,158,198,0.7)';
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.fillText('BRIDGE', 2352, 131);
    ctx.textAlign = 'left';
  }

  /* ---------------- 艦尾 ― 下部格納デッキ ---------------- */
  drawHangarBay(ctx) {
    const b = DECK.bay, bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    ctx.fillStyle = '#2b3852';
    roundRect(ctx, b.x0, b.y0, bw, bh, 12); ctx.fill();
    ctx.save();
    ctx.beginPath(); roundRect(ctx, b.x0, b.y0, bw, bh, 12); ctx.clip();

    /* 床の目地 */
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = b.x0; x < b.x1; x += 58) ctx.fillRect(x, b.y0, 2, bh);
    for (let y = b.y0; y < b.y1; y += 58) ctx.fillRect(b.x0, y, bw, 2);

    /* 着艦パッド（真上の下部ハッチのちょうど下） */
    const px = 218, py = 246;
    ctx.strokeStyle = 'rgba(255,207,74,0.35)'; ctx.lineWidth = 4;
    ctx.setLineDash([16, 12]); ctx.lineDashOffset = -this.t * 18;
    ctx.beginPath(); ctx.arc(px, py, 84, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,207,74,0.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, 60, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,207,74,0.45)';
    ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('下部ハッチ直下 / LANDING PAD', px, py - 96);
    ctx.textAlign = 'left';
    for (let i = 0; i < 8; i++) {
      const a2 = i / 8 * TAU;
      ctx.fillStyle = `rgba(255,207,74,${0.35 + 0.35 * Math.sin(this.t * 4 + i)})`;
      ctx.beginPath(); ctx.arc(px + Math.cos(a2) * 84, py + Math.sin(a2) * 84, 4, 0, TAU); ctx.fill();
    }

    /* 資材 */
    for (let i = 0; i < 5; i++) {
      const bx = b.x0 + 14 + i * 40;
      ctx.fillStyle = i % 2 ? '#33415f' : '#2c3a58';
      roundRect(ctx, bx, b.y0 + 12, 32, 26, 4); ctx.fill();
      ctx.strokeStyle = '#4a5b80'; ctx.lineWidth = 1.6;
      roundRect(ctx, bx, b.y0 + 12, 32, 26, 4); ctx.stroke();
      ctx.fillStyle = '#ffcf4a';
      ctx.fillRect(bx + 5, b.y0 + 18, 22, 3);
    }

    /* 駐機した輸送機 */
    this.planeTop(ctx, px, py, 0.78, -0.35);

    /* 自機（整備架台の上） */
    const mx = 424, my = 108;
    ctx.strokeStyle = 'rgba(143,212,255,0.28)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mx, my, 52, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#4a5b80'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(mx - 58, my - 40); ctx.lineTo(mx + 58, my - 40);
    ctx.moveTo(mx - 58, my + 40); ctx.lineTo(mx + 58, my + 40);
    ctx.stroke();
    const lo = this.lo;
    const col = lo ? lo.colors : { body: '#5b7fa8', trim: '#9fd4ff', accent: '#ffd166' };
    R.shadow(ctx, mx, my + 6, 44, 40, 0.30);
    R.drawRobot(ctx, {
      x: mx, y: my, r: 42,
      ang: 1.35 + Math.sin(this.t * 0.4) * 0.06, aim: 1.35 + Math.sin(this.t * 0.5) * 0.1,
      walkPhase: 0, muzzle: 0, recoil: 0, hitFlash: 0, thrust: false,
    }, col, { shape: lo ? lo.shape : 'standard', decal: lo ? lo.decal : null, attach: lo ? lo.attachments : [] });

    ctx.restore();
    /* 外周の壁。中央通路へ抜ける口だけ開けておく */
    const c = DECK.corr;
    ctx.strokeStyle = '#4a5f8c'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(b.x1, c.y0); ctx.lineTo(b.x1, b.y0 + 12);
    ctx.arcTo(b.x1, b.y0, b.x1 - 12, b.y0, 12);
    ctx.lineTo(b.x0 + 12, b.y0);
    ctx.arcTo(b.x0, b.y0, b.x0, b.y0 + 12, 12);
    ctx.lineTo(b.x0, b.y1 - 12);
    ctx.arcTo(b.x0, b.y1, b.x0 + 12, b.y1, 12);
    ctx.lineTo(b.x1 - 12, b.y1);
    ctx.arcTo(b.x1, b.y1, b.x1, b.y1 - 12, 12);
    ctx.lineTo(b.x1, c.y1);
    ctx.stroke();
    ctx.fillStyle = 'rgba(143,212,255,0.45)';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText('格納デッキ  LOWER HANGAR  D-04', b.x0 + 16, b.y0 + 58);
  }

  /* 真上から見た輸送機 */
  planeTop(ctx, x, y, s, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);
    ctx.scale(s, s);
    ctx.strokeStyle = '#2a323d';
    /* 主翼 */
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = sgn < 0 ? '#4b5766' : '#44505f';
      ctx.beginPath();
      ctx.moveTo(12, sgn * 12); ctx.lineTo(-28, sgn * 78); ctx.lineTo(-56, sgn * 78); ctx.lineTo(-26, sgn * 12);
      ctx.closePath(); ctx.fill();
      ctx.lineWidth = 2; ctx.stroke();
      /* 発動機 */
      ctx.fillStyle = '#39424e';
      roundRect(ctx, -30, sgn * 50 - 10, 46, 20, 8); ctx.fill();
      ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = 'rgba(127,240,255,0.55)';
      roundRect(ctx, -34, sgn * 50 - 6, 10, 12, 4); ctx.fill();
      /* 尾翼 */
      ctx.fillStyle = '#525f70';
      ctx.beginPath();
      ctx.moveTo(-74, sgn * 8); ctx.lineTo(-98, sgn * 44); ctx.lineTo(-110, sgn * 44); ctx.lineTo(-92, sgn * 8);
      ctx.closePath(); ctx.fill();
      ctx.lineWidth = 2; ctx.stroke();
    }
    /* 胴体 */
    ctx.fillStyle = '#5b6878';
    roundRect(ctx, -100, -21, 194, 42, 20); ctx.fill();
    ctx.strokeStyle = '#2a323d'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#6d7b8d';
    roundRect(ctx, -60, -14, 120, 28, 12); ctx.fill();
    /* 貨物ハッチ（開いている） */
    ctx.fillStyle = '#2a3240';
    roundRect(ctx, -98, -15, 30, 30, 6); ctx.fill();
    /* 風防 */
    ctx.fillStyle = '#8fe0ff';
    roundRect(ctx, 58, -13, 34, 26, 11); ctx.fill();
    ctx.fillStyle = '#ffcf4a';
    ctx.fillRect(-16, -21, 7, 42);
    ctx.fillStyle = 'rgba(223,230,240,0.85)';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText('SALVAGE', 4, 4);
    ctx.restore();
  }
}

window.MRBase = { Base, Cutscene, DOORS, SHIP_NAME };
})();
