/* =========================================================================
   PAINT & HIDE ― かくれんぼの 基地の地図
   マス目 (60x40) で持つ。へや・ろうか・家具・かくれ場所・ゆかの 小物。
   座標はマス単位で書き、使うときに TILE 倍してワールド座標 (px) にする。
   ========================================================================= */
'use strict';

const TILE = 40, MW = 60, MH = 40;

const ROOMS = [
  { id: 'hall', icon: 'flame', x: 23, y: 15, w: 14, h: 10, floor: 'wood' },
  { id: 'kitchen', icon: 'fish', x: 5, y: 3, w: 11, h: 8, floor: 'checker' },
  { id: 'radio', icon: 'dish', x: 25, y: 2, w: 10, h: 7, floor: 'metal' },
  { id: 'gen', icon: 'bolt', x: 44, y: 3, w: 11, h: 8, floor: 'plate' },
  { id: 'ice', icon: 'snow', x: 1, y: 15, w: 8, h: 10, floor: 'snow' },
  { id: 'obs', icon: 'telescope', x: 51, y: 15, w: 8, h: 10, floor: 'night' },
  { id: 'lab', icon: 'flask', x: 5, y: 29, w: 11, h: 8, floor: 'tile' },
  { id: 'garage', icon: 'cog', x: 44, y: 29, w: 11, h: 8, floor: 'concrete' },
  { id: 'dorm', icon: 'moon', x: 25, y: 31, w: 10, h: 7, floor: 'carpet' },
];
const ROOM = Object.fromEntries(ROOMS.map((r, i) => [r.id, Object.assign(r, { idx: i, cx: (r.x + r.w / 2) * TILE, cy: (r.y + r.h / 2) * TILE })]));

const CORRIDORS = [
  { x: 29, y: 9, w: 3, h: 6 }, { x: 29, y: 25, w: 3, h: 6 },
  { x: 9, y: 19, w: 14, h: 3 }, { x: 37, y: 19, w: 14, h: 3 },
  { x: 10, y: 11, w: 3, h: 8 }, { x: 10, y: 22, w: 3, h: 7 },
  { x: 48, y: 11, w: 3, h: 8 }, { x: 48, y: 22, w: 3, h: 7 },
  { x: 16, y: 5, w: 9, h: 3 }, { x: 35, y: 5, w: 9, h: 3 },
  { x: 16, y: 33, w: 9, h: 3 }, { x: 35, y: 33, w: 9, h: 3 },
];

/* 通れない家具。見えかたは art.js が kind ごとに描く */
const SOLIDS = [
  { kind: 'console', x: 27, y: 2, w: 6, h: 1 },
  { kind: 'counter', x: 6, y: 3, w: 5, h: 1 },
  { kind: 'table', x: 7, y: 7, w: 2, h: 2 },
  { kind: 'machine', x: 51, y: 3, w: 4, h: 2 },
  { kind: 'stove', x: 25, y: 15, w: 2, h: 1 },
  { kind: 'round', x: 29, y: 19, w: 2, h: 2 },
  { kind: 'hole', x: 3, y: 18, w: 2, h: 2 },
  { kind: 'scope', x: 55, y: 18, w: 2, h: 2 },
  { kind: 'bench', x: 6, y: 29, w: 4, h: 1 },
  { kind: 'sled', x: 50, y: 32, w: 3, h: 2 },
  { kind: 'dresser', x: 33, y: 31, w: 2, h: 1 },
];

/* 中に 入って かくれられる 場所。1か所に 1人だけ。オニに 撃たれたら 見つかる */
const SPOTS = [
  { kind: 'locker', x: 33, y: 2 }, { kind: 'locker', x: 34, y: 2 },
  { kind: 'box', x: 14, y: 9 }, { kind: 'box', x: 15, y: 9 },
  { kind: 'locker', x: 44, y: 3 }, { kind: 'locker', x: 45, y: 3 },
  { kind: 'bush', x: 7, y: 16 }, { kind: 'bush', x: 2, y: 16 },
  { kind: 'bush', x: 52, y: 23 }, { kind: 'bush', x: 58, y: 16 },
  { kind: 'locker', x: 14, y: 29 }, { kind: 'locker', x: 15, y: 29 },
  { kind: 'box', x: 44, y: 36 }, { kind: 'box', x: 45, y: 36 }, { kind: 'box', x: 54, y: 30 },
  { kind: 'bed', x: 26, y: 36, h: 2 }, { kind: 'bed', x: 28, y: 36, h: 2 },
  { kind: 'bed', x: 31, y: 36, h: 2 }, { kind: 'bed', x: 33, y: 36, h: 2 },
  { kind: 'box', x: 24, y: 24 }, { kind: 'box', x: 35, y: 24 },
];
SPOTS.forEach((s, i) => Object.assign(s, { i, w: s.w || 1, h: s.h || 1, cx: (s.x + (s.w || 1) / 2) * TILE, cy: (s.y + (s.h || 1) / 2) * TILE, occ: null }));

/* はじめに 集まる 場所。オニは まんなかの テーブルの 下がわ */
const HALL = { x: 30 * TILE, y: 20 * TILE };

/* ------------------------------ マス目 ------------------------------ */
const floorGrid = new Uint8Array(MW * MH);   // 1 = ゆか (見通せる)
const walkGrid = new Uint8Array(MW * MH);    // 1 = 歩ける (家具の上は歩けない)
const roomGrid = new Int8Array(MW * MH);     // いちばん近い へやの番号

(function build() {
  const carve = (r) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) floorGrid[y * MW + x] = 1; };
  ROOMS.forEach(carve); CORRIDORS.forEach(carve);
  walkGrid.set(floorGrid);
  for (const s of [...SOLIDS, ...SPOTS]) for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) walkGrid[y * MW + x] = 0;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    let best = 0, bd = Infinity;
    ROOMS.forEach((r, i) => {
      const dx = Math.max(r.x - (x + 0.5), 0, (x + 0.5) - (r.x + r.w));
      const dy = Math.max(r.y - (y + 0.5), 0, (y + 0.5) - (r.y + r.h));
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    });
    roomGrid[y * MW + x] = best;
  }
})();

const isFloor = (tx, ty) => tx >= 0 && ty >= 0 && tx < MW && ty < MH && floorGrid[ty * MW + tx] === 1;
const isWalk = (tx, ty) => tx >= 0 && ty >= 0 && tx < MW && ty < MH && walkGrid[ty * MW + tx] === 1;
function roomAt(x, y) {
  const tx = clamp(Math.floor(x / TILE), 0, MW - 1), ty = clamp(Math.floor(y / TILE), 0, MH - 1);
  return ROOMS[roomGrid[ty * MW + tx]].id;
}

/* ------------------------------ 当たり判定 ------------------------------ */
/* 円 (ワールド座標) を、歩けないマスから押し出す */
function pushOut(o, r) {
  const x0 = Math.floor((o.x - r) / TILE), x1 = Math.floor((o.x + r) / TILE);
  const y0 = Math.floor((o.y - r) / TILE), y1 = Math.floor((o.y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (isWalk(tx, ty)) continue;
    const nx = clamp(o.x, tx * TILE, (tx + 1) * TILE), ny = clamp(o.y, ty * TILE, (ty + 1) * TILE);
    const dx = o.x - nx, dy = o.y - ny, d = Math.hypot(dx, dy);
    if (d < r) {
      if (d > 0.001) { o.x = nx + dx / d * r; o.y = ny + dy / d * r; }
      else { o.y = (ty + 1) * TILE + r; }
    }
  }
}

/* 太さ r の線が、歩けないマスに かからずに引けるか */
function clearLine(ax, ay, bx, by, r) {
  const d = dist(ax, ay, bx, by), n = Math.ceil(d / (TILE * 0.2));
  for (let i = 0; i <= n; i++) {
    const x = lerp(ax, bx, i / n), y = lerp(ay, by, i / n);
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
    const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (isWalk(tx, ty)) continue;
      const nx = clamp(x, tx * TILE, (tx + 1) * TILE), ny = clamp(y, ty * TILE, (ty + 1) * TILE);
      if (dist(x, y, nx, ny) < r) return false;
    }
  }
  return true;
}

/* ------------------------------ 見通し ------------------------------ */
/* マス単位の光線を、かべに当たるまで進める。家具は見通せる */
function rayDist(x, y, dx, dy, maxD) {
  let tx = Math.floor(x), ty = Math.floor(y);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const ddx = dx !== 0 ? Math.abs(1 / dx) : Infinity, ddy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let mx = dx > 0 ? (tx + 1 - x) * ddx : dx < 0 ? (x - tx) * ddx : Infinity;
  let my = dy > 0 ? (ty + 1 - y) * ddy : dy < 0 ? (y - ty) * ddy : Infinity;
  for (let guard = 0; guard < 200; guard++) {
    let t;
    if (mx < my) { t = mx; mx += ddx; tx += sx; } else { t = my; my += ddy; ty += sy; }
    if (t >= maxD) return maxD;
    if (!isFloor(tx, ty)) return t;
  }
  return maxD;
}
/* ワールド座標の2点のあいだに かべが ないか */
function los(ax, ay, bx, by) {
  const d = dist(ax, ay, bx, by) / TILE;
  if (d < 0.01) return true;
  return rayDist(ax / TILE, ay / TILE, (bx - ax) / TILE / d, (by - ay) / TILE / d, d) >= d - 1e-6;
}
function canSee(ax, ay, bx, by, r) { return dist(ax, ay, bx, by) <= r && los(ax, ay, bx, by); }

/* 見えている範囲の多角形 (ワールド座標)。かべの手前の面まで見えるよう少しのばす */
function visPoly(x, y, r, n = 220) {
  const pts = [], tx = x / TILE, ty = y / TILE, rt = r / TILE;
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, dx = Math.cos(a), dy = Math.sin(a);
    const t = rayDist(tx, ty, dx, dy, rt);
    const tt = t < rt ? Math.min(rt, t + 0.6) : rt;
    pts.push(x + dx * tt * TILE, y + dy * tt * TILE);
  }
  return pts;
}

/* ------------------------------ 道さがし ------------------------------ */
/* マス目の A*。ななめは角を削らないときだけ。結果はワールド座標の点の列 */
const PF = { g: new Float32Array(MW * MH), from: new Int32Array(MW * MH), seen: new Uint32Array(MW * MH), stamp: 0 };
function nearestWalk(tx, ty) {
  if (isWalk(tx, ty)) return [tx, ty];
  for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (isWalk(tx + dx, ty + dy)) return [tx + dx, ty + dy];
  }
  return [tx, ty];
}
function findPath(ax, ay, bx, by) {
  const [sx, sy] = nearestWalk(Math.floor(ax / TILE), Math.floor(ay / TILE));
  const [gx, gy] = nearestWalk(Math.floor(bx / TILE), Math.floor(by / TILE));
  const start = sy * MW + sx, goal = gy * MW + gx;
  const stamp = ++PF.stamp;
  const heap = [];
  const push = (node, f) => {
    heap.push([f, node]);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top[1];
  };
  const hcost = (n) => { const dx = Math.abs(n % MW - gx), dy = Math.abs(((n / MW) | 0) - gy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  PF.seen[start] = stamp; PF.g[start] = 0; PF.from[start] = -1;
  push(start, hcost(start));
  let found = start === goal;
  while (heap.length && !found) {
    const cur = pop();
    if (cur === goal) { found = true; break; }
    const cx = cur % MW, cy = (cur / MW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (!isWalk(nx, ny)) continue;
      if (dx && dy && (!isWalk(cx + dx, cy) || !isWalk(cx, cy + dy))) continue;
      const nb = ny * MW + nx, g = PF.g[cur] + (dx && dy ? 1.414 : 1);
      if (PF.seen[nb] === stamp && PF.g[nb] <= g) continue;
      PF.seen[nb] = stamp; PF.g[nb] = g; PF.from[nb] = cur;
      push(nb, g + hcost(nb));
    }
  }
  if (!found) return [{ x: bx, y: by }];
  const cells = [];
  for (let n = goal; n !== -1; n = PF.from[n]) cells.push(n);
  cells.reverse();
  const pts = cells.map((n) => ({ x: (n % MW + 0.5) * TILE, y: (((n / MW) | 0) + 0.5) * TILE }));
  /* ゴールが 家具の 中なら、いちばん 近い 歩ける マスで 止まる */
  if (isWalk(Math.floor(bx / TILE), Math.floor(by / TILE))) pts[pts.length - 1] = { x: bx, y: by };
  /* 見通せる点は とばして、なめらかに する */
  const out = [];
  let from = { x: ax, y: ay }, i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !clearLine(from.x, from.y, pts[j].x, pts[j].y, TILE * 0.36)) j--;
    out.push(pts[j]);
    from = pts[j]; i = j + 1;
  }
  return out;
}

/* へやの中の 歩ける場所を ひとつ えらぶ */
function randomSpot(roomId) {
  const r = ROOM[roomId];
  for (let k = 0; k < 40; k++) {
    const tx = randi(r.x, r.x + r.w - 1), ty = randi(r.y, r.y + r.h - 1);
    if (isWalk(tx, ty) && isWalk(tx - 1, ty) && isWalk(tx + 1, ty)) return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
  }
  return { x: r.cx, y: r.cy };
}

/* かくれ場所の そばに いるか。いちばん 近い 場所を かえす */
function spotNear(x, y, r = TILE * 0.9) {
  let best = null, bd = r;
  for (const s of SPOTS) {
    const dx = Math.max(s.x * TILE - x, 0, x - (s.x + s.w) * TILE), dy = Math.max(s.y * TILE - y, 0, y - (s.y + s.h) * TILE);
    const d = Math.hypot(dx, dy);
    if (d <= bd) { bd = d; best = s; }
  }
  return best;
}
function inSpotRect(s, x, y, pad = 4) {
  return x >= s.x * TILE - pad && x <= (s.x + s.w) * TILE + pad && y >= s.y * TILE - pad && y <= (s.y + s.h) * TILE + pad;
}
/* かくれ場所の となりの 歩ける マス (出入り口) */
function spotDoor(s) {
  const c = [];
  for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) {
    const side = (x === s.x - 1 || x === s.x + s.w) !== (y === s.y - 1 || y === s.y + s.h);
    if (side && isWalk(x, y)) c.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
  }
  return c[0] || { x: s.cx, y: s.cy + TILE };
}
