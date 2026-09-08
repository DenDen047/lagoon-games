/* =========================================================================
   SUNSET SHIFT ― 街（見下ろし）
   道路は格子。区画のなかに建物が建ち、屋上には登れる。
   建物は「屋根 + 手前の壁」で厚みを出し、影は太陽の向きへ footprint を
   引き伸ばした多角形で落とす。
   ========================================================================= */
'use strict';

const BLOCK = 620;      // 区画の一辺
const ROADW = 132;      // 道路の幅
const COLS = 5, ROWS = 4;
const CURB = 30;        // 歩道の幅
const ELEV = 0.55;      // 高さを画面上へ持ち上げる割合。奥のものを隠しすぎないため

/* 凸包。footprint を影の向きへ掃いた形を作るのに使う。 */
function hull(pts) {
  const p = pts.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

/* 高さ h のものが落とす影を、影レイヤーへ一筆で描く。 */
function sweepShadow(sctx, cam, L, pts, h) {
  const dx = L.dir.x * h * L.len, dy = L.dir.y * h * L.len;
  const all = [];
  for (const q of pts) { all.push([q[0], q[1]]); all.push([q[0] + dx, q[1] + dy]); }
  const hl = hull(all);
  sctx.beginPath();
  for (let i = 0; i < hl.length; i++) {
    const x = hl[i][0] - cam.x, y = hl[i][1] - cam.y;
    i ? sctx.lineTo(x, y) : sctx.moveTo(x, y);
  }
  sctx.closePath();
  sctx.fill();
}

/* 丸いものの影。足元から、影の伸びる先へのカプセル。 */
function blobShadow(sctx, cam, L, wx, wy, z, h, r) {
  const dx = L.dir.x * (h + z) * L.len, dy = L.dir.y * (h + z) * L.len;
  const ox = L.dir.x * z * L.len, oy = L.dir.y * z * L.len;
  const x0 = wx - cam.x + ox, y0 = wy - cam.y + oy;
  const x1 = wx - cam.x + dx, y1 = wy - cam.y + dy;
  sctx.beginPath();
  sctx.lineCap = 'round';
  sctx.strokeStyle = sctx.fillStyle;
  sctx.lineWidth = r * 2;
  sctx.moveTo(x0, y0); sctx.lineTo(x1, y1);
  sctx.stroke();
}

const City = {
  W: ROADW + COLS * (BLOCK + ROADW),
  H: ROADW + ROWS * (BLOCK + ROADW),
  buildings: [], props: [], lights: [], spots: [], blocks: [],
  seed: 1,

  roadX(i) { return ROADW / 2 + i * (BLOCK + ROADW); },
  roadY(j) { return ROADW / 2 + j * (BLOCK + ROADW); },
  blockX(i) { return ROADW + i * (BLOCK + ROADW); },
  blockY(j) { return ROADW + j * (BLOCK + ROADW); },

  onRoad(x, y) {
    for (let i = 0; i <= COLS; i++) if (Math.abs(x - this.roadX(i)) < ROADW / 2) return true;
    for (let j = 0; j <= ROWS; j++) if (Math.abs(y - this.roadY(j)) < ROADW / 2) return true;
    return false;
  },

  gen(seed) {
    this.seed = seed;
    const rng = new RNG(seed);
    this.buildings = []; this.props = []; this.lights = []; this.spots = []; this.blocks = [];

    const STYLES = ['office', 'apart', 'shop', 'brick'];
    const COLS_ = ['#8e93a2', '#9c8f80', '#7e8a9c', '#a2907f', '#84939a', '#94879c', '#a89a8c', '#77848f'];

    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const bx = this.blockX(i), by = this.blockY(j);
        const kind = rng.chance(0.14) ? 'park' : rng.chance(0.12) ? 'lot' : 'built';
        this.blocks.push({ i, j, x: bx, y: by, kind });
        if (kind !== 'built') { this.fillOpenBlock(rng, bx, by, kind); continue; }

        const nx = rng.i(2, 3), ny = rng.i(2, 3);
        const cw = (BLOCK - CURB * 2) / nx, ch = (BLOCK - CURB * 2) / ny;
        for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
          if (rng.chance(0.12)) { this.parkingLot(rng, bx + CURB + a * cw, by + CURB + b * ch, cw, ch); continue; }
          const inx = rng.f(10, 26), iny = rng.f(10, 26);
          const style = rng.pick(STYLES);
          this.buildings.push({
            x: bx + CURB + a * cw + inx, y: by + CURB + b * ch + iny,
            w: cw - inx * 2, d: ch - iny * 2,
            h: style === 'shop' ? rng.f(58, 92) : rng.f(96, 235),
            style, col: rng.pick(COLS_), seed: rng.i(1, 99999),
            roofCol: rng.pick(['#575c66', '#3f4a52', '#7a5f4e', '#4c5f56', '#6a6258', '#404650', '#7b6f62', '#455060']),
            roofKind: rng.pick(['flat', 'flat', 'sheet', 'green', 'tile']),
            sign: rng.chance(0.55), signCol: rng.pick(['#ff6b5f', '#6fd3ff', '#ffd05c', '#7ee39b', '#ff8ac4']),
            signText: rng.pick(['定食', 'BAR', '古書', 'コインランドリー', '喫茶', '整骨院', 'RAMEN', '花', '写真', 'CLUB', '薬', '珈琲']),
            ac: rng.chance(0.7), tank: rng.chance(0.35),
          });
        }
      }
    }

    /* 歩道の設備。交差点まわりと区画のふちに置く。 */
    for (let j = 0; j <= ROWS; j++) {
      for (let i = 0; i <= COLS; i++) {
        const cx = this.roadX(i), cy = this.roadY(j);
        for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const px = cx + ox * (ROADW / 2 + 16), py = cy + oy * (ROADW / 2 + 16);
          if (px < 20 || py < 20 || px > this.W - 20 || py > this.H - 20) continue;
          this.props.push({ kind: 'lamp', x: px, y: py, h: 96, arm: -ox });
          this.lights.push({ x: px + ox * -26, y: py, r: 250, col: '#ffcf8a' });
        }
      }
    }
    for (const b of this.blocks) {
      const rr = new RNG(seed ^ (b.i * 7919) ^ (b.j * 104729));
      for (let t = 0; t < 8; t++) {
        const side = rr.i(0, 3);
        const u = rr.f(0.12, 0.88);
        let px, py;
        if (side === 0) { px = b.x + BLOCK * u; py = b.y - 15; }
        else if (side === 1) { px = b.x + BLOCK * u; py = b.y + BLOCK + 15; }
        else if (side === 2) { px = b.x - 15; py = b.y + BLOCK * u; }
        else { px = b.x + BLOCK + 15; py = b.y + BLOCK * u; }
        const kind = rr.pick(['tree', 'tree', 'bench', 'hydrant', 'bin', 'vending', 'planter', 'sign']);
        this.props.push({ kind, x: px, y: py, h: kind === 'tree' ? 78 : kind === 'vending' ? 46 : kind === 'sign' ? 52 : 26, seed: rr.i(1, 9999) });
        if (kind === 'vending') this.lights.push({ x: px, y: py, r: 140, col: '#9fe8ff' });
      }
    }

    /* 目印。E で入れる場所。 */
    const put = (id, name, icon, i, j) => {
      const bx = this.blockX(i) + BLOCK / 2, by = this.blockY(j) - 22;
      this.spots.push({ id, name, icon, x: bx, y: by });
      this.lights.push({ x: bx, y: by, r: 180, col: '#d8f0ff' });
    };
    put('home', '自宅アパート', '🏠', 0, 0);
    put('shop', 'コンビニ', '🏪', 2, 1);
    put('office', 'トウワ物流 本社', '🏢', 4, 2);
    put('shop2', 'ドラッグストア', '🏪', 1, 3);
  },

  fillOpenBlock(rng, bx, by, kind) {
    if (kind === 'park') {
      for (let t = 0; t < 14; t++) {
        this.props.push({ kind: 'tree', x: bx + rng.f(40, BLOCK - 40), y: by + rng.f(40, BLOCK - 40), h: rng.f(64, 92), seed: rng.i(1, 9999) });
      }
      for (let t = 0; t < 3; t++) this.props.push({ kind: 'bench', x: bx + rng.f(80, BLOCK - 80), y: by + rng.f(80, BLOCK - 80), h: 26 });
    } else {
      this.parkingLot(rng, bx + CURB, by + CURB, BLOCK - CURB * 2, BLOCK - CURB * 2);
    }
  },

  parkingLot(rng, x, y, w, d) {
    this.props.push({ kind: 'asphalt', x, y, w, d, h: 0 });
    for (let t = 0, n = rng.i(2, 5); t < n; t++) {
      this.props.push({ kind: 'parked', x: x + rng.f(30, w - 30), y: y + rng.f(30, d - 30), h: 26, seed: rng.i(1, 99999), ang: rng.chance(0.5) ? 0 : Math.PI / 2 });
    }
  },

  /* 当たり判定。z が屋根より高ければ通り抜けられる。 */
  blocked(x, y, z, r) {
    if (x < 14 || y < 14 || x > this.W - 14 || y > this.H - 14) return true;
    for (const b of this.buildings) {
      if (z >= b.h - 1) continue;
      if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.d + r) return true;
    }
    return false;
  },

  /* その地点の地面の高さ。屋根の上なら屋根の高さ。 */
  groundZ(x, y) {
    for (const b of this.buildings) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.d) return b.h;
    }
    return 0;
  },

  /* 主人公の位置を覆っている建物を返す。透かして見せるため。 */
  occluders(x, y, z, out) {
    out.clear();
    for (const b of this.buildings) {
      if (z >= b.h - 1) continue;
      if (y >= b.y + b.d) continue;
      if (x < b.x - 12 || x > b.x + b.w + 12) continue;
      if (y < b.y - b.h * ELEV - 26) continue;
      out.add(b);
    }
    return out;
  },

  nearestLight(x, y, maxD = 300) {
    let best = null, bd = maxD;
    for (const l of this.lights) {
      const d = dist(x, y, l.x, l.y);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  },

  /* ------------------------------ 地面 ------------------------------ */
  drawGround(ctx, cam, L, W, H) {
    const p = L.pal;
    const walk = mix('#a8aab4', mix(L.ambC, p.hor, 0.5), 0.22);
    const road = mix('#2b2e36', p.hor, 0.07 + L.golden * 0.06);
    const yard = mix('#6f7666', mix(L.ambC, p.hor, 0.4), 0.18);

    ctx.fillStyle = walk;
    ctx.fillRect(0, 0, W, H);

    /* 区画の内側。 */
    for (const b of this.blocks) {
      const sx = b.x - cam.x, sy = b.y - cam.y;
      if (sx > W || sy > H || sx + BLOCK < 0 || sy + BLOCK < 0) continue;
      ctx.fillStyle = b.kind === 'park' ? mix('#5f7a4e', p.hor, 0.12) : yard;
      ctx.fillRect(sx + CURB, sy + CURB, BLOCK - CURB * 2, BLOCK - CURB * 2);
    }

    /* 道路。 */
    ctx.fillStyle = road;
    for (let i = 0; i <= COLS; i++) {
      const x = this.roadX(i) - ROADW / 2 - cam.x;
      if (x > W || x + ROADW < 0) continue;
      ctx.fillRect(x, -cam.y, ROADW, this.H);
    }
    for (let j = 0; j <= ROWS; j++) {
      const y = this.roadY(j) - ROADW / 2 - cam.y;
      if (y > H || y + ROADW < 0) continue;
      ctx.fillRect(-cam.x, y, this.W, ROADW);
    }

    /* 縁石。 */
    ctx.strokeStyle = rgba(mix('#d8d4c8', p.hor, 0.2), 0.7);
    ctx.lineWidth = 5;
    for (const b of this.blocks) {
      const sx = b.x - cam.x, sy = b.y - cam.y;
      if (sx > W + 40 || sy > H + 40 || sx + BLOCK < -40 || sy + BLOCK < -40) continue;
      ctx.strokeRect(sx - 2, sy - 2, BLOCK + 4, BLOCK + 4);
    }

    /* センターライン。 */
    ctx.save();
    ctx.strokeStyle = rgba('#e8e2d0', 0.36);
    ctx.lineWidth = 3;
    ctx.setLineDash([30, 26]);
    for (let i = 0; i <= COLS; i++) {
      const x = this.roadX(i) - cam.x;
      if (x < -20 || x > W + 20) continue;
      ctx.beginPath(); ctx.moveTo(x, -cam.y); ctx.lineTo(x, this.H - cam.y); ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j++) {
      const y = this.roadY(j) - cam.y;
      if (y < -20 || y > H + 20) continue;
      ctx.beginPath(); ctx.moveTo(-cam.x, y); ctx.lineTo(this.W - cam.x, y); ctx.stroke();
    }
    ctx.restore();

    /* 交差点の横断歩道。 */
    ctx.fillStyle = rgba('#eae6d8', 0.5);
    for (let j = 0; j <= ROWS; j++) for (let i = 0; i <= COLS; i++) {
      const cx = this.roadX(i) - cam.x, cy = this.roadY(j) - cam.y;
      if (cx < -180 || cy < -180 || cx > W + 180 || cy > H + 180) continue;
      for (const s of [-1, 1]) {
        for (let k = 0; k < 6; k++) {
          const o = -ROADW / 2 + 12 + k * 19;
          ctx.fillRect(cx + o, cy + s * (ROADW / 2 + 4) - (s > 0 ? 0 : 16), 12, 16);
          ctx.fillRect(cx + s * (ROADW / 2 + 4) - (s > 0 ? 0 : 16), cy + o, 16, 12);
        }
      }
    }

    /* 西日。日の当たっている地面を暖める。影はこのあと上から落ちる。 */
    if (L.direct > 0.05) {
      const a = clamp(0.06 + L.golden * 0.3, 0, 0.36);
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      const x0 = L.sunSide < 0 ? 0 : W;
      const g = ctx.createLinearGradient(x0, 0, W - x0, H);
      g.addColorStop(0, rgba(L.warm, a));
      g.addColorStop(0.75, rgba(L.warm, a * 0.4));
      g.addColorStop(1, rgba(L.warm, a * 0.12));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    /* 駐車場のアスファルトと白線。 */
    for (const pr of this.props) {
      if (pr.kind !== 'asphalt') continue;
      const sx = pr.x - cam.x, sy = pr.y - cam.y;
      if (sx > W || sy > H || sx + pr.w < 0 || sy + pr.d < 0) continue;
      ctx.fillStyle = mix('#3c4048', p.hor, 0.08);
      ctx.fillRect(sx, sy, pr.w, pr.d);
      ctx.strokeStyle = 'rgba(230,226,210,0.35)';
      ctx.lineWidth = 2;
      for (let x = sx + 26; x < sx + pr.w - 10; x += 46) {
        ctx.beginPath(); ctx.moveTo(x, sy + 8); ctx.lineTo(x, sy + 54); ctx.stroke();
      }
    }
  },

  /* ------------------------------ 影 ------------------------------ */
  shadows(sctx, cam, L, W, H) {
    for (const b of this.buildings) {
      const sx = b.x - cam.x, sy = b.y - cam.y;
      const m = b.h * L.len + 60;
      if (sx > W + m || sy > H + m || sx + b.w < -m || sy + b.d < -m) continue;
      sweepShadow(sctx, cam, L, [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.d], [b.x, b.y + b.d]], b.h);
    }
    for (const pr of this.props) {
      if (pr.h <= 0) continue;
      const sx = pr.x - cam.x, sy = pr.y - cam.y;
      const m = pr.h * L.len + 60;
      if (sx > W + m || sy > H + m || sx < -m || sy < -m) continue;
      if (pr.kind === 'tree') blobShadow(sctx, cam, L, pr.x, pr.y, 0, pr.h, 30);
      else if (pr.kind === 'lamp') blobShadow(sctx, cam, L, pr.x, pr.y, 0, pr.h, 4);
      else if (pr.kind === 'parked') sweepShadow(sctx, cam, L, [[pr.x - 20, pr.y - 42], [pr.x + 20, pr.y - 42], [pr.x + 20, pr.y + 42], [pr.x - 20, pr.y + 42]], pr.h);
      else blobShadow(sctx, cam, L, pr.x, pr.y, 0, pr.h, 13);
    }
  },

  /* --------------------- 並べ替え用の描画リスト --------------------- */
  collect(list, cam, W, H) {
    for (const b of this.buildings) {
      const sx = b.x - cam.x, sy = b.y - cam.y;
      if (sx > W + 60 || sy > H + 60 || sx + b.w < -60 || sy + b.d - b.h < -260) continue;
      list.push({ key: b.y + b.d, o: b, kind: 'building' });
    }
    for (const pr of this.props) {
      if (pr.kind === 'asphalt') continue;
      const sx = pr.x - cam.x, sy = pr.y - cam.y;
      if (sx > W + 90 || sy > H + 120 || sx < -90 || sy < -120) continue;
      list.push({ key: pr.y, o: pr, kind: 'prop' });
    }
    for (const s of this.spots) {
      const sx = s.x - cam.x, sy = s.y - cam.y;
      if (sx > W + 90 || sy > H + 90 || sx < -90 || sy < -90) continue;
      list.push({ key: s.y + 0.5, o: s, kind: 'spot' });
    }
  },

  /* ---------------------------- 建物 ---------------------------- */
  drawBuilding(ctx, cam, L, b) {
    const p = L.pal;
    const sx = b.x - cam.x, sy = b.y - cam.y;
    const body = mix(b.col, L.ambC, 0.1 + (1 - L.ambient) * 0.2);
    const night = clamp(1 - L.ambient * 1.15, 0, 1);
    const sunLeft = L.sunSide < 0;

    /* 手前の壁。 */
    const eh = b.h * ELEV;
    const wallTop = sy + b.d - eh;
    const wg = ctx.createLinearGradient(0, wallTop, 0, sy + b.d);
    wg.addColorStop(0, shade(body, -0.1));
    wg.addColorStop(1, shade(body, -0.42));
    ctx.fillStyle = wg;
    ctx.fillRect(sx, wallTop, b.w, eh);

    /* 太陽の側の壁のふち。 */
    if (L.direct > 0.06) {
      ctx.fillStyle = rgba(L.warm, clamp(0.12 + L.golden * 0.5, 0, 0.6));
      ctx.fillRect(sunLeft ? sx : sx + b.w - 5, wallTop, 5, eh);
    }

    this.facade(ctx, b, sx, wallTop, night, L, eh);

    /* 屋根。 */
    const roofY = sy - eh;
    this.roof(ctx, b, sx, roofY, L);

    /* 看板。壁から突き出す。 */
    if (b.sign) {
      const sgX = sx + b.w - 16, sgY = wallTop + 6;
      const sgH = Math.max(24, Math.min(eh - 12, 70));
      ctx.fillStyle = 'rgba(12,15,22,0.85)';
      ctx.fillRect(sgX - 4, sgY, 20, sgH);
      ctx.strokeStyle = rgba(b.signCol, 0.55 + night * 0.45);
      ctx.lineWidth = 2;
      ctx.strokeRect(sgX - 4, sgY, 20, sgH);
      ctx.fillStyle = rgba(b.signCol, 0.6 + night * 0.4);
      ctx.font = `700 12px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const txt = b.signText.slice(0, 4);
      for (let i = 0; i < txt.length && 5 + i * 14 < sgH - 12; i++) ctx.fillText(txt[i], sgX + 6, sgY + 5 + i * 14);
      if (night > 0.2) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(sgX + 6, sgY + 30, 0, sgX + 6, sgY + 30, 60);
        g.addColorStop(0, rgba(b.signCol, 0.3 * night)); g.addColorStop(1, rgba(b.signCol, 0));
        ctx.fillStyle = g;
        ctx.fillRect(sgX - 60, sgY - 30, 130, 130);
        ctx.restore();
      }
    }
  },

  /* 屋上。設備を置いて、上から見て単調にならないようにする。 */
  roof(ctx, b, sx, ry, L) {
    const p = L.pal;
    const rng = mulberry32(b.seed ^ 0x5eed);
    const base = mix(b.roofCol || '#6b6f78', L.ambC, 0.08 + (1 - L.ambient) * 0.18);
    const w = b.w, d = b.d;

    const g = ctx.createLinearGradient(sx, ry, sx + w, ry + d);
    g.addColorStop(0, mix(base, p.hor, 0.05 + L.golden * 0.12));
    g.addColorStop(1, shade(base, -0.16));
    ctx.fillStyle = g;
    ctx.fillRect(sx, ry, w, d);

    /* 面のざらつき。 */
    if (b.roofKind === 'sheet') {
      ctx.strokeStyle = rgba(shade(base, -0.28), 0.6);
      ctx.lineWidth = 1;
      for (let x = sx + 24; x < sx + w; x += 24) { ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x, ry + d); ctx.stroke(); }
    } else if (b.roofKind === 'tile') {
      ctx.strokeStyle = rgba(shade(base, -0.24), 0.45);
      ctx.lineWidth = 1;
      for (let y = ry + 18; y < ry + d; y += 18) { ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + w, y); ctx.stroke(); }
    } else if (b.roofKind === 'green') {
      for (let i = 0; i < 10; i++) {
        const gx = sx + 20 + rng() * (w - 40), gy = ry + 20 + rng() * (d - 40);
        ctx.fillStyle = mix('#4a7a44', p.hor, 0.1 + L.golden * 0.2);
        ctx.beginPath(); ctx.ellipse(gx, gy, 14 + rng() * 12, 11 + rng() * 8, 0, 0, TAU); ctx.fill();
      }
    } else {
      ctx.fillStyle = rgba('#000000', 0.05);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.ellipse(sx + 20 + rng() * (w - 40), ry + 20 + rng() * (d - 40), 16 + rng() * 24, 10 + rng() * 16, rng() * 3, 0, TAU);
        ctx.fill();
      }
    }

    /* 西日の帯。 */
    if (L.direct > 0.05) {
      const a = clamp(0.05 + L.golden * 0.2, 0, 0.28);
      const x0 = L.sunSide < 0 ? sx : sx + w;
      const wgd = ctx.createLinearGradient(x0, 0, sx + w - (x0 - sx), 0);
      wgd.addColorStop(0, rgba(L.warm, a));
      wgd.addColorStop(1, rgba(L.warm, 0));
      ctx.fillStyle = wgd;
      ctx.fillRect(sx, ry, w, d);
    }

    /* 設備。 */
    const put = (x, y, ww, hh, col, top) => {
      ctx.fillStyle = rgba('#000000', 0.28);
      ctx.fillRect(x + L.dir.x * 8, y + L.dir.y * 8, ww, hh);
      ctx.fillStyle = shade(col, -0.24);
      ctx.fillRect(x, y, ww, hh);
      ctx.fillStyle = mix(top || col, L.warm, clamp(L.golden * 0.35, 0, 0.4));
      ctx.fillRect(x + 2, y + 2, ww - 4, hh - 4);
    };
    if (b.ac) {
      for (let i = 0, n = 2 + Math.floor(rng() * 4); i < n; i++) {
        const ax = sx + 16 + rng() * Math.max(6, w - 60), ay = ry + 16 + rng() * Math.max(6, d - 50);
        put(ax, ay, 30, 24, '#8a919c', '#a6adb8');
        ctx.strokeStyle = rgba('#20242c', 0.55); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(ax + 15, ay + 12, 7, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax + 8, ay + 12); ctx.lineTo(ax + 22, ay + 12); ctx.stroke();
      }
    }
    if (b.tank) {
      const tx = sx + w - 46, ty = ry + d - 48;
      ctx.fillStyle = rgba('#000000', 0.3);
      ctx.beginPath(); ctx.ellipse(tx + 18 + L.dir.x * 10, ty + 18 + L.dir.y * 10, 19, 19, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = mix('#9aa3ae', p.hor, 0.18);
      ctx.beginPath(); ctx.arc(tx + 18, ty + 18, 18, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(L.warm, clamp(0.14 + L.golden * 0.4, 0, 0.5));
      ctx.beginPath(); ctx.arc(tx + 14, ty + 14, 12, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba('#2a2f38', 0.5); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(tx + 18, ty + 18, 18, 0, TAU); ctx.stroke();
    }
    /* 階段室。屋上に上がったキャラの目印にもなる。 */
    put(sx + 12, ry + d - 40, 30, 28, '#7d8490', '#949ba7');
    ctx.fillStyle = 'rgba(20,24,32,0.8)';
    ctx.fillRect(sx + 20, ry + d - 30, 14, 16);
    /* 天窓。夕日を照り返す。 */
    for (let i = 0, n = Math.floor(rng() * 3); i < n; i++) {
      const kx = sx + 24 + rng() * Math.max(6, w - 70), ky = ry + 24 + rng() * Math.max(6, d - 60);
      ctx.fillStyle = rgba('#000000', 0.24);
      ctx.fillRect(kx + L.dir.x * 6, ky + L.dir.y * 6, 40, 26);
      ctx.fillStyle = shade(base, -0.3);
      ctx.fillRect(kx, ky, 40, 26);
      const sg = ctx.createLinearGradient(kx, ky, kx + 40, ky + 26);
      sg.addColorStop(0, mix('#9fd0e8', L.warm, clamp(0.2 + L.golden * 0.6, 0, 0.8)));
      sg.addColorStop(1, mix('#3f5a70', p.mid, 0.3));
      ctx.fillStyle = sg;
      ctx.fillRect(kx + 3, ky + 3, 34, 20);
    }

    /* 配管。 */
    ctx.strokeStyle = rgba(shade(base, -0.36), 0.7);
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx + w * 0.55, ry + 12);
    ctx.lineTo(sx + w * 0.55, ry + d * 0.4);
    ctx.lineTo(sx + w * 0.82, ry + d * 0.4);
    ctx.stroke();

    /* パラペット（ふち）。太陽側だけ明るい。 */
    ctx.lineWidth = 6;
    ctx.strokeStyle = shade(base, -0.34);
    ctx.strokeRect(sx + 3, ry + 3, w - 6, d - 6);
    if (L.direct > 0.05) {
      ctx.strokeStyle = rgba(L.warm, clamp(0.2 + L.golden * 0.55, 0, 0.8));
      ctx.lineWidth = 3;
      ctx.beginPath();
      const x = L.sunSide < 0 ? sx + 3 : sx + w - 3;
      ctx.moveTo(x, ry + 3); ctx.lineTo(x, ry + d - 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + 3, ry + 3); ctx.lineTo(sx + w - 3, ry + 3);
      ctx.stroke();
    }
  },

  facade(ctx, b, sx, top, night, L, eh) {
    const rng = mulberry32(b.seed ^ 0x9e37);
    const west = clamp(L.golden, 0, 1);
    const h = eh;
    if (b.style === 'shop') {
      const gy = top + h * 0.3;
      const g = ctx.createLinearGradient(0, gy, 0, top + h);
      const lit = 0.32 + night * 0.55;
      g.addColorStop(0, rgba('#ffe6b8', lit));
      g.addColorStop(1, rgba('#ffcf8a', lit * 0.6));
      ctx.fillStyle = g;
      ctx.fillRect(sx + 8, gy, b.w - 16, h * 0.7 - 6);
      ctx.strokeStyle = 'rgba(18,22,30,0.7)'; ctx.lineWidth = 2.5;
      ctx.strokeRect(sx + 8, gy, b.w - 16, h * 0.7 - 6);
      ctx.beginPath(); ctx.moveTo(sx + b.w * 0.5, gy); ctx.lineTo(sx + b.w * 0.5, top + h - 6); ctx.stroke();
      /* 日よけ。 */
      ctx.fillStyle = mix('#b8493c', L.pal.hor, 0.16);
      ctx.fillRect(sx + 4, gy - 12, b.w - 8, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 6; i++) ctx.fillRect(sx + 8 + i * ((b.w - 16) / 6), gy - 12, (b.w - 16) / 12, 12);
      return;
    }
    const floors = Math.max(1, Math.floor(h / 34));
    const cols = Math.max(2, Math.floor(b.w / 40));
    const fw = b.w / cols, fh = h / floors;
    for (let j = 0; j < floors; j++) for (let i = 0; i < cols; i++) {
      const r = rng();
      const x = sx + i * fw + 7, y = top + j * fh + 7, w = fw - 14, hh = fh - 15;
      if (w < 3 || hh < 3) continue;
      const on = r < 0.45 * night;
      ctx.fillStyle = on ? rgba(mix('#ffe1a8', '#fff3d0', r), 0.85)
        : mix('#1b2534', L.pal.hor, 0.18 + west * 0.36 * r);
      ctx.fillRect(x, y, w, hh);
      if (!on && west > 0.2 && r > 0.6) {
        ctx.fillStyle = rgba(L.warm, 0.4 * west);
        ctx.fillRect(x, y, w, hh * 0.45);
      }
    }
    /* 入口。 */
    ctx.fillStyle = 'rgba(16,20,28,0.75)';
    ctx.fillRect(sx + b.w * 0.5 - 14, top + h - 26, 28, 26);
    ctx.fillStyle = rgba('#ffd89a', 0.2 + night * 0.5);
    ctx.fillRect(sx + b.w * 0.5 - 11, top + h - 23, 22, 20);
  },

  /* ---------------------------- 小物 ---------------------------- */
  drawProp(ctx, cam, L, pr) {
    const x = pr.x - cam.x, y = pr.y - cam.y;
    const night = clamp(1 - L.ambient * 1.15, 0, 1);
    const p = L.pal;
    ctx.save();
    ctx.translate(x, y);
    if (pr.kind === 'tree') {
      const rng = mulberry32(pr.seed);
      ctx.fillStyle = '#4a3a2c';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = rng() * TAU, r = 12 + rng() * 20;
        const cx = Math.cos(a) * r * 0.7, cy = Math.sin(a) * r * 0.7 - pr.h * 0.12;
        ctx.fillStyle = mix(mix('#3d6b40', '#5c8a3e', rng()), p.hor, 0.1 + L.golden * 0.24);
        ctx.beginPath(); ctx.ellipse(cx, cy, 20 + rng() * 10, 18 + rng() * 8, 0, 0, TAU); ctx.fill();
      }
      if (L.direct > 0.08) {
        ctx.fillStyle = rgba(L.warm, clamp(0.1 + L.golden * 0.3, 0, 0.42));
        ctx.beginPath(); ctx.ellipse(L.sunSide * 12, -14, 18, 14, 0, 0, TAU); ctx.fill();
      }
    } else if (pr.kind === 'lamp') {
      ctx.fillStyle = '#2b3040';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
      const ax = (pr.arm || 1) * 34;
      ctx.strokeStyle = '#2b3040'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(ax, -pr.h * 0.34); ctx.stroke();
      ctx.fillStyle = night > 0.1 ? rgba('#fff0c0', 0.5 + night * 0.5) : '#5a6070';
      ctx.beginPath(); ctx.ellipse(ax, -pr.h * 0.34, 12, 8, 0, 0, TAU); ctx.fill();
    } else if (pr.kind === 'bench') {
      ctx.fillStyle = '#6b533c';
      ctx.beginPath(); ctx.roundRect(-26, -10, 52, 20, 4); ctx.fill();
      ctx.fillStyle = '#553f2e';
      ctx.fillRect(-26, -12, 52, 4);
    } else if (pr.kind === 'hydrant') {
      ctx.fillStyle = '#b8443c';
      ctx.beginPath(); ctx.arc(0, -4, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d45a50';
      ctx.beginPath(); ctx.arc(-2, -7, 5, 0, TAU); ctx.fill();
    } else if (pr.kind === 'bin') {
      ctx.fillStyle = '#3f4654';
      ctx.beginPath(); ctx.arc(0, -3, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#59606f';
      ctx.beginPath(); ctx.arc(-2, -6, 8, 0, TAU); ctx.fill();
    } else if (pr.kind === 'vending') {
      ctx.fillStyle = '#24405c';
      ctx.beginPath(); ctx.roundRect(-19, -26, 38, 30, 3); ctx.fill();
      ctx.fillStyle = rgba('#9fe8ff', 0.4 + night * 0.5);
      ctx.fillRect(-15, -22, 30, 14);
      ctx.fillStyle = rgba('#ff7a5c', 0.7);
      for (let i = 0; i < 3; i++) ctx.fillRect(-13 + i * 10, -20, 7, 10);
    } else if (pr.kind === 'planter') {
      ctx.fillStyle = '#8a7a64';
      ctx.beginPath(); ctx.roundRect(-18, -10, 36, 20, 4); ctx.fill();
      ctx.fillStyle = mix('#4f7a3a', p.hor, 0.12);
      ctx.beginPath(); ctx.ellipse(0, -4, 14, 8, 0, 0, TAU); ctx.fill();
    } else if (pr.kind === 'parked') {
      Traffic.drawParked(ctx, L, pr);
    } else {
      ctx.fillStyle = '#4a5262';
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c8d2e0';
      ctx.beginPath(); ctx.roundRect(-16, -pr.h * 0.4 - 12, 32, 22, 4); ctx.fill();
      ctx.fillStyle = '#39404e';
      ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('↑', 0, -pr.h * 0.4 - 1);
    }
    ctx.restore();
  },

  drawSpot(ctx, cam, L, s) {
    const x = s.x - cam.x, y = s.y - cam.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(12,16,28,0.82)';
    ctx.strokeStyle = rgba('#ffb454', 0.85); ctx.lineWidth = 2;
    const w = 122;
    ctx.beginPath(); ctx.roundRect(-w / 2, -34, w, 28, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe9c8';
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.icon + ' ' + s.name, 0, -20);
    ctx.fillStyle = rgba('#ffb454', 0.5);
    ctx.beginPath(); ctx.ellipse(0, 6, 26, 10, 0, 0, TAU); ctx.fill();
    ctx.restore();
  },

  drawLights(ctx, cam, L, W, H) {
    const night = clamp(1 - L.ambient * 1.15, 0, 1);
    if (night < 0.06) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.lights) {
      const sx = l.x - cam.x, sy = l.y - cam.y;
      if (sx < -l.r || sy < -l.r || sx > W + l.r || sy > H + l.r) continue;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, l.r);
      g.addColorStop(0, rgba(l.col, 0.3 * night));
      g.addColorStop(0.45, rgba(l.col, 0.11 * night));
      g.addColorStop(1, rgba(l.col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, l.r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  },
};
