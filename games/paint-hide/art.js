/* =========================================================================
   PAINT & HIDE ― 絵
   地図は1回だけ裏の canvas に描いておき、毎フレームはそれを貼る。
   キャラクターは skin.js が描く。
   ========================================================================= */
'use strict';

const FLOORS = {
  wood: ['#b5814f', '#a87444'],
  checker: ['#e6eef5', '#bcd3e6'],
  metal: ['#5a6878', '#4e5b6a'],
  plate: ['#6f7480', '#626773'],
  snow: ['#f2f7fc', '#dfeaf5'],
  night: ['#243a66', '#1e3259'],
  tile: ['#eef4f2', '#d6e6e2'],
  concrete: ['#8d939a', '#81878e'],
  carpet: ['#7a5a9a', '#6e5090'],
  hall: ['#7f97ad', '#7389a0'],
};

const Art = {
  map: null,
  mapScale: 1,

  /* 地図を描く。scale は画面の拡大率にあわせて、ぼやけないように決める */
  buildMap(scale) {
    scale = clamp(scale, 1, 1.75);
    if (this.map && Math.abs(this.mapScale - scale) < 0.05) return;
    this.mapScale = scale;
    const c = this.map || document.createElement('canvas');
    c.width = Math.ceil(MW * TILE * scale); c.height = Math.ceil(MH * TILE * scale);
    const g = c.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    this.drawMap(g);
    this.map = c;
  },

  drawMap(g) {
    const R = seeded(7);
    /* 外は 夜の 雪原 */
    g.fillStyle = '#0d1a2e'; g.fillRect(0, 0, MW * TILE, MH * TILE);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(200,225,255,${0.04 + R() * 0.08})`;
      g.beginPath(); g.arc(R() * MW * TILE, R() * MH * TILE, 1 + R() * 2.5, 0, TAU); g.fill();
    }
    /* ゆか */
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      if (!isFloor(tx, ty)) continue;
      const room = ROOMS[roomGrid[ty * MW + tx]];
      const inRoom = tx >= room.x && tx < room.x + room.w && ty >= room.y && ty < room.y + room.h;
      this.floorTile(g, tx, ty, inRoom ? room.floor : 'hall', R);
    }
    this.props(g);
    /* へやの まんなかに うすく へやの アイコン */
    for (const r of ROOMS) {
      g.globalAlpha = 0.07;
      drawIcon(g, r.icon, r.cx, r.cy + (r.id === 'hall' ? TILE * 2.9 : 0), TILE * 3.2, r.floor === 'snow' || r.floor === 'checker' || r.floor === 'tile' ? '#1d3a5a' : '#ffffff', 2);
      g.globalAlpha = 1;
    }
    /* かべ */
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      if (isFloor(tx, ty)) continue;
      const near = isFloor(tx - 1, ty) || isFloor(tx + 1, ty) || isFloor(tx, ty - 1) || isFloor(tx, ty + 1) ||
        isFloor(tx - 1, ty - 1) || isFloor(tx + 1, ty - 1) || isFloor(tx - 1, ty + 1) || isFloor(tx + 1, ty + 1);
      if (!near) continue;
      this.wallTile(g, tx, ty);
    }
    /* 家具と かくれ場所 */
    for (const sd of SOLIDS) this.furniture(g, sd);
    for (const sp of SPOTS) this.spot(g, sp);
  },

  floorTile(g, tx, ty, kind, R) {
    const x = tx * TILE, y = ty * TILE, [a, b] = FLOORS[kind];
    if (kind === 'checker' || kind === 'tile') {
      g.fillStyle = (tx + ty) % 2 ? a : b; g.fillRect(x, y, TILE, TILE);
      g.strokeStyle = 'rgba(80,110,140,0.18)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    } else if (kind === 'wood') {
      g.fillStyle = a; g.fillRect(x, y, TILE, TILE);
      g.fillStyle = b;
      for (let i = 0; i < 4; i++) if ((i + tx) % 2) g.fillRect(x, y + i * 10, TILE, 10);
      g.strokeStyle = 'rgba(60,30,10,0.25)'; g.lineWidth = 1;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(x, y + i * 10); g.lineTo(x + TILE, y + i * 10); g.stroke(); }
      g.beginPath(); g.moveTo(x + ((ty * 13 + tx * 7) % 4) * 10, y); g.lineTo(x + ((ty * 13 + tx * 7) % 4) * 10, y + TILE); g.stroke();
    } else if (kind === 'snow') {
      g.fillStyle = a; g.fillRect(x, y, TILE, TILE);
      for (let i = 0; i < 3; i++) { g.fillStyle = b; g.beginPath(); g.ellipse(x + R() * TILE, y + R() * TILE, 6 + R() * 8, 3 + R() * 3, 0, 0, TAU); g.fill(); }
    } else if (kind === 'night') {
      g.fillStyle = (tx + ty) % 2 ? a : b; g.fillRect(x, y, TILE, TILE);
      if (R() < 0.35) { g.fillStyle = 'rgba(255,255,220,0.7)'; g.beginPath(); g.arc(x + R() * TILE, y + R() * TILE, 1 + R() * 1.3, 0, TAU); g.fill(); }
    } else if (kind === 'carpet') {
      g.fillStyle = a; g.fillRect(x, y, TILE, TILE);
      g.fillStyle = b; g.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
    } else {
      g.fillStyle = (tx + ty) % 2 ? a : b; g.fillRect(x, y, TILE, TILE);
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1.5; g.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      if (kind === 'plate' || kind === 'metal' || kind === 'hall') {
        g.fillStyle = 'rgba(255,255,255,0.18)';
        for (const [px, py] of [[5, 5], [TILE - 5, 5], [5, TILE - 5], [TILE - 5, TILE - 5]]) { g.beginPath(); g.arc(x + px, y + py, 1.6, 0, TAU); g.fill(); }
      }
      if (kind === 'concrete' && R() < 0.12) { g.fillStyle = 'rgba(30,30,40,0.25)'; g.beginPath(); g.ellipse(x + 20, y + 20, 12, 7, R() * 3, 0, TAU); g.fill(); }
    }
  },

  /* かべ。上は こおり、ゆかに 面した 下がわは かべの 面を 見せる */
  wallTile(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    const outdoor = (isFloor(tx, ty + 1) && ROOMS[roomGrid[(ty + 1) * MW + tx]].floor === 'snow') ||
      (isFloor(tx, ty - 1) && ROOMS[roomGrid[(ty - 1) * MW + tx]].floor === 'snow');
    g.fillStyle = outdoor ? '#c9dbee' : '#34496a'; g.fillRect(x, y, TILE, TILE);
    if (isFloor(tx, ty + 1)) {
      const fy = y + TILE * 0.42;
      g.fillStyle = outdoor ? '#9fb8d2' : '#6a87a8'; g.fillRect(x, fy, TILE, TILE * 0.58);
      g.fillStyle = outdoor ? '#8aa5c2' : '#5a7697'; g.fillRect(x, y + TILE - 6, TILE, 6);
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + TILE / 2, fy); g.lineTo(x + TILE / 2, y + TILE - 6); g.stroke();
      g.fillStyle = '#eaf6ff'; g.fillRect(x, fy - 3, TILE, 4);
      /* つらら */
      if ((tx * 7 + ty) % 3 === 0) {
        g.fillStyle = 'rgba(220,245,255,0.9)';
        g.beginPath(); g.moveTo(x + 10, fy); g.lineTo(x + 14, fy + 9); g.lineTo(x + 18, fy); g.fill();
      }
    }
    /* ゆかと さかいの ふち */
    g.fillStyle = 'rgba(230,246,255,0.55)';
    if (isFloor(tx, ty - 1)) g.fillRect(x, y, TILE, 3);
    if (isFloor(tx - 1, ty)) g.fillRect(x, y, 3, TILE * (isFloor(tx, ty + 1) ? 0.42 : 1));
    if (isFloor(tx + 1, ty)) g.fillRect(x + TILE - 3, y, 3, TILE * (isFloor(tx, ty + 1) ? 0.42 : 1));
  },

  furniture(g, s) {
    const x = s.x * TILE, y = s.y * TILE, w = s.w * TILE, hh = s.h * TILE;
    const box = (col, top, r = 6) => {
      g.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(g, x + 3, y + 6, w - 2, hh - 2, r); g.fill();
      g.fillStyle = col; roundRect(g, x + 2, y + 2, w - 4, hh - 4, r); g.fill();
      g.fillStyle = top; roundRect(g, x + 2, y + 2, w - 4, (hh - 4) * 0.55, r); g.fill();
    };
    const cx = x + w / 2, cy = y + hh / 2;
    switch (s.kind) {
      case 'console':
        box('#33475e', '#4a6582');
        for (let i = 0; i < 6; i++) { g.fillStyle = ['#5ce07a', '#ffd23a', '#ff6a5a'][i % 3]; g.beginPath(); g.arc(x + 20 + i * 40, y + 14, 4, 0, TAU); g.fill(); }
        g.fillStyle = '#9fe7ff'; roundRect(g, cx - 34, y + 6, 68, 16, 3); g.fill();
        g.strokeStyle = '#2a6a8a'; g.lineWidth = 2; g.beginPath();
        for (let i = 0; i <= 30; i++) g.lineTo(cx - 30 + i * 2, y + 14 + Math.sin(i * 0.9) * 4);
        g.stroke();
        break;
      case 'counter':
        box('#c9d6e2', '#eef3f8');
        g.fillStyle = '#7a8fa5'; g.beginPath(); g.arc(x + 40, y + 16, 9, 0, TAU); g.fill();
        g.fillStyle = '#9fb2c6'; g.beginPath(); g.arc(x + 40, y + 16, 5, 0, TAU); g.fill();
        drawIcon(g, 'fish', x + 120, y + 16, 22, '#e07a5a');
        drawIcon(g, 'fish', x + 160, y + 18, 20, '#5a9ae0');
        break;
      case 'table':
        box('#9a6a3e', '#c08a54', 10);
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx, cy - 6, 12, 8, 0, 0, TAU); g.fill();
        break;
      case 'machine': {
        box('#5c6370', '#7c8492');
        g.fillStyle = '#2a2e36'; roundRect(g, x + 14, y + 40, w - 28, 26, 4); g.fill();
        for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#ffcf3a' : '#2a2e36'; g.fillRect(x + 14 + i * ((w - 28) / 6), y + 66, (w - 28) / 6, 8); }
        drawIcon(g, 'bolt', cx, y + 22, 26, '#ffd23a');
        break;
      }
      case 'stove':
        box('#3a3a44', '#55555f', 8);
        g.fillStyle = '#ff8a2a'; roundRect(g, cx - 18, y + 12, 36, 20, 6); g.fill();
        g.fillStyle = '#ffd25a'; roundRect(g, cx - 10, y + 18, 20, 12, 5); g.fill();
        g.fillStyle = '#4a4a52'; g.fillRect(cx - 7, y - 26, 14, 30);
        break;
      case 'round': {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx + 2, cy + 8, 40, 34, 0, 0, TAU); g.fill();
        g.fillStyle = '#8a5a34'; g.beginPath(); g.ellipse(cx, cy + 4, 40, 34, 0, 0, TAU); g.fill();
        g.fillStyle = '#b07a48'; g.beginPath(); g.ellipse(cx, cy, 38, 31, 0, 0, TAU); g.fill();
        g.fillStyle = '#f4f0e8'; g.beginPath(); g.arc(cx, cy, 16, 0, TAU); g.fill();
        for (const [dx, dy, c] of [[-6, -3, '#e8403f'], [5, -4, '#f5c932'], [0, 5, '#7ac943']]) { g.fillStyle = c; g.beginPath(); g.arc(cx + dx, cy + dy, 6, 0, TAU); g.fill(); }
        break;
      }
      case 'hole': {
        g.fillStyle = '#cfe2f3'; g.beginPath(); g.ellipse(cx, cy, 42, 36, 0, 0, TAU); g.fill();
        const gr = g.createRadialGradient(cx, cy, 4, cx, cy, 34);
        gr.addColorStop(0, '#0a2a4a'); gr.addColorStop(1, '#1d5a8a');
        g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, 34, 28, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 2;
        g.beginPath(); g.ellipse(cx - 4, cy - 2, 18, 10, 0, 3.6, 5.6); g.stroke();
        break;
      }
      case 'scope': {
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(cx + 2, cy + 6, 30, 0, TAU); g.fill();
        g.fillStyle = '#3a4a6a'; g.beginPath(); g.arc(cx, cy, 28, 0, TAU); g.fill();
        g.save(); g.translate(cx, cy); g.rotate(-0.6);
        g.fillStyle = '#c9d2e0'; roundRect(g, -14, -46, 28, 64, 10); g.fill();
        g.fillStyle = '#8fa0b8'; roundRect(g, -16, -50, 32, 12, 5); g.fill();
        g.restore();
        break;
      }
      case 'bench':
        box('#d5e2e8', '#f5fafb');
        for (let i = 0; i < 4; i++) {
          const fx = x + 22 + i * 36;
          g.fillStyle = ['#5ae0a8', '#ff7ab0', '#7ab8ff', '#ffd23a'][i];
          g.beginPath(); g.moveTo(fx - 7, y + 26); g.lineTo(fx + 7, y + 26); g.lineTo(fx + 3, y + 12); g.lineTo(fx - 3, y + 12); g.fill();
          g.fillStyle = '#c0d0d8'; g.fillRect(fx - 2, y + 6, 4, 7);
        }
        break;
      case 'sled': {
        g.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(g, x + 4, y + 10, w - 4, hh - 6, 16); g.fill();
        g.fillStyle = '#2a2e36'; g.fillRect(x + 6, y + hh - 14, w - 12, 6); g.fillRect(x + 6, y + 6, w - 12, 6);
        g.fillStyle = '#e8403f'; roundRect(g, x + 10, y + 14, w - 20, hh - 30, 14); g.fill();
        g.fillStyle = '#ff7a6a'; roundRect(g, x + 14, y + 16, w - 52, hh - 36, 10); g.fill();
        g.fillStyle = '#1a1f2b'; roundRect(g, x + w - 44, y + 22, 26, hh - 44, 6); g.fill();
        break;
      }
      case 'dresser':
        box('#8a6040', '#a87a52');
        g.fillStyle = '#e0c090';
        for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + 18 + i * 22, y + 26, 3, 0, TAU); g.fill(); }
        break;
    }
  },


  /* 中に 入れる かくれ場所。入っていても いなくても 見た目は 同じ */
  spot(g, s) {
    const x = s.x * TILE, y = s.y * TILE, w = s.w * TILE, hh = s.h * TILE, cx = x + w / 2, cy = y + hh / 2;
    g.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(g, x + 4, y + 7, w - 4, hh - 4, 6); g.fill();
    switch (s.kind) {
      case 'locker':
        g.fillStyle = '#7d8ea3'; roundRect(g, x + 3, y + 2, w - 6, hh - 4, 4); g.fill();
        g.fillStyle = '#93a5ba'; roundRect(g, x + 6, y + 5, w - 12, hh - 10, 3); g.fill();
        g.strokeStyle = '#5d6e83'; g.lineWidth = 2;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + 11, y + 10 + i * 5); g.lineTo(x + w - 11, y + 10 + i * 5); g.stroke(); }
        g.fillStyle = '#3a4656'; g.beginPath(); g.arc(x + w - 11, cy + 6, 2.5, 0, TAU); g.fill();
        break;
      case 'box':
        g.fillStyle = '#b8864e'; roundRect(g, x + 3, y + 3, w - 6, hh - 6, 3); g.fill();
        g.fillStyle = '#c99a62'; g.fillRect(x + 3, y + 3, w - 6, (hh - 6) * 0.45);
        g.fillStyle = '#e8d8b0'; g.fillRect(cx - 3, y + 3, 6, hh - 6);
        g.strokeStyle = '#8a5a30'; g.lineWidth = 1.5; roundRect(g, x + 3, y + 3, w - 6, hh - 6, 3); g.stroke();
        break;
      case 'bush':
        for (const [dx, dy, r, c] of [[-8, 4, 13, '#2f7a42'], [8, 5, 12, '#2f7a42'], [0, -5, 14, '#3a9a52'], [-6, -2, 9, '#4ab062'], [7, -6, 7, '#5ac472']]) {
          g.fillStyle = c; g.beginPath(); g.arc(cx + dx, cy + dy, r, 0, TAU); g.fill();
        }
        break;
      case 'bed':
        g.fillStyle = '#e7e0f5'; roundRect(g, x + 3, y + 3, w - 6, hh - 6, 6); g.fill();
        g.fillStyle = '#ffffff'; roundRect(g, x + 7, y + 6, w - 14, 16, 5); g.fill();
        g.fillStyle = ['#5a8ae0', '#e07a9a', '#5ac08a', '#e0b45a'][s.i % 4]; roundRect(g, x + 3, y + 28, w - 6, hh - 31, 6); g.fill();
        break;
    }
  },

  /* ゆかの 小物。まるい ものが 多いので、まるい からだで とけこめる */
  props(g) {
    const SETS = {
      hall: { n: 12, kinds: [['ball', ['#e8403f', '#f5c932', '#3a7bf0', '#34b86a'], 10, 16], ['plant', ['#2f8a4a'], 14, 18]], mats: [[24.3, 21.3, 4.4, 2.4, '#b0333a', '#d8a040'], [32.3, 16.3, 3.4, 2.2, '#2a5a8a', '#e8ecf2']] },
      kitchen: { n: 14, kinds: [['ball', ['#ff8a2a', '#e8403f', '#7ac943', '#f5c932'], 6, 9], ['ball', ['#ffffff'], 10, 12]], mats: [[9.3, 4.3, 3.4, 2.4, '#e8b04a', '#c03a2a']] },
      radio: { n: 8, kinds: [['ring', ['#2a2e36'], 9, 13], ['ball', ['#e8ecf2', '#5ce07a'], 6, 9]] },
      gen: { n: 8, kinds: [['ball', ['#f5c932', '#e8403f'], 14, 16], ['ball', ['#2a2e36'], 9, 12]] },
      ice: { n: 14, kinds: [['snow', ['#ffffff'], 8, 20], ['ball', ['#5a9ae0'], 6, 8]] },
      obs: { n: 10, kinds: [['ball', ['#ffd23a', '#9b59d6', '#5ab8f0'], 9, 14]] },
      lab: { n: 12, kinds: [['ball', ['#5ae0a8', '#ff7ab0', '#7ab8ff'], 6, 9], ['plant', ['#3a9a5a'], 13, 16]], mats: [[6.3, 33.3, 4.4, 2.4, '#3a8a6a', '#5ae0a8']] },
      garage: { n: 9, kinds: [['ring', ['#1a1d24'], 13, 16], ['ball', ['#a8743e'], 12, 14]] },
      dorm: { n: 14, kinds: [['ball', ['#f5c932', '#e8403f', '#3a7bf0', '#34b86a', '#f27fb5'], 7, 12], ['ball', ['#ffffff'], 11, 13]], mats: [[26.3, 32.3, 3.4, 2.4, '#e8a0c0', '#ffffff']] },
    };
    const R = seeded(11);
    for (const r of ROOMS) {
      const set = SETS[r.id];
      for (const [mx, my, mw, mh, c1, c2] of set.mats || []) {
        const x = mx * TILE, y = my * TILE, w = mw * TILE, hh = mh * TILE;
        g.fillStyle = c1; roundRect(g, x, y, w, hh, 8); g.fill();
        g.strokeStyle = c2; g.lineWidth = 4; roundRect(g, x + 6, y + 6, w - 12, hh - 12, 5); g.stroke();
        g.fillStyle = c2;
        for (let i = 1; i < 4; i++) { g.beginPath(); g.arc(x + w * i / 4, y + hh / 2, 6, 0, TAU); g.fill(); }
      }
      let placed = 0;
      for (let k = 0; k < 200 && placed < set.n; k++) {
        const tx = r.x + Math.floor(R() * r.w), ty = r.y + Math.floor(R() * r.h);
        if (!isWalk(tx, ty) || !isWalk(tx - 1, ty) || !isWalk(tx + 1, ty) || !isWalk(tx, ty - 1) || !isWalk(tx, ty + 1)) continue;
        const [kind, cols, r0, r1] = set.kinds[Math.floor(R() * set.kinds.length)];
        const x = (tx + 0.2 + R() * 0.6) * TILE, y = (ty + 0.2 + R() * 0.6) * TILE, rad = r0 + R() * (r1 - r0), col = cols[Math.floor(R() * cols.length)];
        this.prop(g, kind, x, y, rad, col);
        placed++;
      }
    }
  },
  prop(g, kind, x, y, r, col) {
    if (kind === 'ring') {
      g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = '#5a5e66'; g.beginPath(); g.arc(x, y, r * 0.5, 0, TAU); g.fill();
    } else if (kind === 'plant') {
      g.fillStyle = '#8a5a34'; g.beginPath(); g.arc(x, y + r * 0.4, r * 0.55, 0, TAU); g.fill();
      for (const [dx, dy, k] of [[-0.4, -0.2, 0.6], [0.4, -0.2, 0.6], [0, -0.55, 0.65]]) { g.fillStyle = col; g.beginPath(); g.arc(x + dx * r, y + dy * r, r * k, 0, TAU); g.fill(); }
    } else {
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(x + 2, y + r * 0.35, r, r * 0.55, 0, 0, TAU); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = kind === 'snow' ? 'rgba(160,200,240,0.45)' : 'rgba(0,0,0,0.12)';
      g.beginPath(); g.arc(x + r * 0.2, y + r * 0.2, r * 0.75, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU); g.fill();
    }
  },
};

/* 雪のつぶ。画面座標で描く */
const Snow = {
  flakes: [],
  init() {
    this.flakes = [];
    for (let i = 0; i < 140; i++) this.flakes.push({ x: Math.random(), y: Math.random(), z: rand(0.4, 1.2), p: rand(TAU) });
  },
  draw(ctx, W, H, dt, heavy) {
    if (!this.flakes.length) this.init();
    const n = heavy ? this.flakes.length : Math.floor(this.flakes.length * 0.45);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < n; i++) {
      const f = this.flakes[i];
      f.y += dt * (heavy ? 0.5 : 0.08) * f.z;
      f.x += dt * ((heavy ? 0.45 : 0.02) * f.z + Math.sin(G.time + f.p) * 0.01);
      if (f.y > 1.05) { f.y = -0.05; f.x = Math.random(); }
      if (f.x > 1.05) f.x = -0.05;
      ctx.globalAlpha = heavy ? 0.85 : 0.5;
      ctx.beginPath(); ctx.arc(f.x * W, f.y * H, (heavy ? 2.4 : 1.6) * f.z, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};
