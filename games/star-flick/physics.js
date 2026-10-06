/* =========================================================================
   STAR FLICK ― 物理
   円い船どうしの衝突（回転と摩擦つき）、カベ・岩・バリアとの衝突、床からの落下。
   1/120 秒きざみの固定ステップで動かすので、AI の先読みと本番の結果が一致する。
   ========================================================================= */
'use strict';

const PH = {
  h: 1 / 120,
  decel: 200,       // すべり摩擦による減速（毎秒）
  drag: 0.3,        // 速いほど強くかかる空気抵抗のようなもの
  spinDecel: 2.5,
  spinDrag: 0.3,
  curve: 0.036,     // 回転 1rad/s あたり、進む向きが毎秒どれだけ曲がるか
  curveMax: 1.2,
  eShip: 0.8,       // 船どうしのはね返り
  eWall: 0.72,
  eRock: 0.7,
  bumperKick: 260,
  wallMu: 0.2,
  wallTh: 7,        // カベ・バリアの太さの半分
  fallTime: 0.75,
  stopV: 4,
  maxSteps: 120 * 14,
};

function makeBody(ship, side, x, y, a) {
  const st = shipStats(ship);
  return {
    ship, side, name: ship.name, hull: ship.hull, col: ship.col,
    x, y, vx: 0, vy: 0, a, w: 0, vis: 0,
    r: st.r, m: st.mass, I: 0.5 * st.mass * st.r * st.r,
    grip: st.grip, punch: st.punch, bite: st.bite, st,
    jetLeft: st.jetUses, barLeft: st.bar ? st.bar.uses : 0,
    fall: -1, out: false, flash: 0, jetT: 0,
  };
}

function makeWorld(stage, bodies) { return { st: stage, bodies, bars: [], steps: 0, ev: null }; }

/* AI が打ち方を試すための複製。床やカベは共有し、動くものだけ写す。 */
function cloneWorld(W) {
  return { st: W.st, bodies: W.bodies.map((b) => Object.assign({}, b)), bars: W.bars.slice(), steps: 0, ev: null };
}

/* ------------------------------ 床の判定 ------------------------------ */
function inRings(rings, x, y) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}
function onFloor(st, x, y) {
  if (!inRings(st.rings, x, y)) return false;
  for (const ho of st.holes) if ((x - ho.x) ** 2 + (y - ho.y) ** 2 < ho.r * ho.r) return false;
  return true;
}
function zoneGrip(st, x, y) {
  for (const z of st.zones) if ((x - z.x) ** 2 + (y - z.y) ** 2 < z.r * z.r) return z.f;
  return 1;
}
function closestOnSeg(x, y, x1, y1, x2, y2) {
  const ex = x2 - x1, ey = y2 - y1, L2 = ex * ex + ey * ey || 1;
  const t = clamp(((x - x1) * ex + (y - y1) * ey) / L2, 0, 1);
  return [x1 + ex * t, y1 + ey * t];
}
/* いちばん近い「落ちる場所」までの距離と、その点。AI の判断と危険表示に使う。 */
function dangerAt(st, x, y) {
  let d = Infinity, px = x, py = y;
  const test = (qx, qy, dd) => { if (dd < d) { d = dd; px = qx; py = qy; } };
  if (st.exits) {
    for (const s of st.exits) { const [qx, qy] = closestOnSeg(x, y, s.x1, s.y1, s.x2, s.y2); test(qx, qy, Math.hypot(x - qx, y - qy)); }
  } else {
    for (const ring of st.rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [qx, qy] = closestOnSeg(x, y, ring[j][0], ring[j][1], ring[i][0], ring[i][1]);
      test(qx, qy, Math.hypot(x - qx, y - qy));
    }
  }
  for (const ho of st.holes) {
    const dd = Math.hypot(x - ho.x, y - ho.y) || 1;
    const rr = ho.r + (ho.bh ? 45 : 0);
    test(ho.x + ((x - ho.x) / dd) * ho.r, ho.y + ((y - ho.y) / dd) * ho.r, dd - rr);
  }
  return { d, px, py };
}

/* ------------------------------ うち出し ------------------------------ */
function launchBody(b, ang, frac, spinLv) {
  const v = b.st.vmax * clamp(frac, 0, 1);
  b.vx = Math.cos(ang) * v; b.vy = Math.sin(ang) * v;
  b.a = ang;
  b.w = spinLv * b.st.spinPer;
}
function fireJet(W, b) {
  if (b.jetLeft <= 0 || b.fall >= 0 || b.out) return false;
  const sp = Math.hypot(b.vx, b.vy);
  const ang = sp > 20 ? Math.atan2(b.vy, b.vx) : b.a;
  b.vx += Math.cos(ang) * b.st.jetBoost; b.vy += Math.sin(ang) * b.st.jetBoost;
  b.jetLeft--;
  b.jetT = 0.5;
  if (W.ev) W.ev('jet', b);
  return true;
}

/* ------------------------------ 1ステップ ------------------------------ */
function stepWorld(W) {
  const st = W.st, h = PH.h, B = W.bodies;
  W.steps++;
  for (const b of B) {
    if (b.out) continue;
    if (b.jetT > 0) b.jetT -= h;
    if (b.fall >= 0) {
      b.fall += h;
      const hole = st.holes.find((o) => o.bh && Math.hypot(b.x - o.x, b.y - o.y) < o.r + 30);
      if (hole) { b.vx += (hole.x - b.x) * 6 * h; b.vy += (hole.y - b.y) * 6 * h; }
      b.vx *= 0.985; b.vy *= 0.985;
      b.x += b.vx * h; b.y += b.vy * h; b.a += (b.w + 6) * h;
      if (b.fall >= PH.fallTime) { b.out = true; if (W.ev) W.ev('out', b); }
      continue;
    }
    if (st.gravity) {
      const g = st.gravity, dx = g.x - b.x, dy = g.y - b.y, d = Math.hypot(dx, dy) || 1;
      const acc = Math.min(900, g.k / Math.max(d * d, 2500));
      b.vx += (dx / d) * acc * h; b.vy += (dy / d) * acc * h;
    }
    let sp = Math.hypot(b.vx, b.vy);
    if (sp > 15 && Math.abs(b.w) > 0.2) {
      const turn = clamp(PH.curve * b.w, -PH.curveMax, PH.curveMax) * h;
      const c = Math.cos(turn), s = Math.sin(turn);
      const vx = b.vx * c - b.vy * s; b.vy = b.vx * s + b.vy * c; b.vx = vx;
    }
    if (sp > 0) {
      const g = b.grip * st.grip * zoneGrip(st, b.x, b.y);
      const ns = Math.max(0, sp - (PH.decel * g + sp * PH.drag) * h);
      b.vx *= ns / sp; b.vy *= ns / sp;
    }
    const wd = (PH.spinDecel + Math.abs(b.w) * PH.spinDrag) * h;
    b.w = Math.abs(b.w) <= wd ? 0 : b.w - Math.sign(b.w) * wd;
    b.x += b.vx * h; b.y += b.vy * h; b.a += b.w * h;
  }
  for (let i = 0; i < B.length; i++) {
    const A = B[i];
    if (A.out || A.fall >= 0) continue;
    for (let j = i + 1; j < B.length; j++) {
      const C = B[j];
      if (C.out || C.fall >= 0) continue;
      shipHit(W, A, C);
    }
  }
  for (const b of B) {
    if (b.out || b.fall >= 0) continue;
    for (const s of st.walls) segHit(W, b, s, PH.eWall, null);
    for (const s of W.bars) segHit(W, b, s, s.bounce, s);
    for (const r of st.rocks) rockHit(W, b, r);
    if (!onFloor(st, b.x, b.y)) { b.fall = 0; if (W.ev) W.ev('fall', b); }
  }
}

function shipHit(W, A, C) {
  const dx = C.x - A.x, dy = C.y - A.y, rr = A.r + C.r, d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return;
  const d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d;
  const ima = 1 / A.m, imc = 1 / C.m;
  const corr = (rr - d) / (ima + imc);
  A.x -= nx * corr * ima; A.y -= ny * corr * ima; C.x += nx * corr * imc; C.y += ny * corr * imc;
  /* ふれた点の速さ（回転のぶんを足す） */
  const vax = A.vx - A.w * ny * A.r, vay = A.vy + A.w * nx * A.r;
  const vcx = C.vx + C.w * ny * C.r, vcy = C.vy - C.w * nx * C.r;
  const rvx = vcx - vax, rvy = vcy - vay;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return;
  const appA = A.vx * nx + A.vy * ny, appC = -(C.vx * nx + C.vy * ny);
  const jn = (-(1 + PH.eShip) * vn) / (ima + imc);
  const tx = -ny, ty = nx;
  const vt = rvx * tx + rvy * ty;
  const mu = Math.max(A.bite, C.bite);
  const jt = clamp(-vt / (3 * (ima + imc)), -mu * jn, mu * jn);
  const Px = jn * nx + jt * tx, Py = jn * ny + jt * ty;
  A.vx -= Px * ima; A.vy -= Py * ima; C.vx += Px * imc; C.vy += Py * imc;
  A.w -= ((nx * Py - ny * Px) * A.r) / A.I;
  C.w += ((-nx * Py + ny * Px) * C.r) / C.I;
  /* 威力: ぶつかっていった側のぶんだけ、相手をさらに押し出す */
  const atk = appA >= appC ? A : C, tgt = atk === A ? C : A, dir = atk === A ? 1 : -1;
  if (atk.punch > 0) {
    const J = jn * atk.punch * 0.7 / tgt.m;
    tgt.vx += nx * dir * J; tgt.vy += ny * dir * J;
  }
  if (W.ev) W.ev('hit', { a: A, b: C, x: A.x + nx * A.r, y: A.y + ny * A.r, s: -vn, atk, tgt });
}

function staticBounce(b, nx, ny, e, mu) {
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return 0;
  const jn = -(1 + e) * vn * b.m;
  const tx = -ny, ty = nx;
  const vpx = b.vx + b.w * ny * b.r, vpy = b.vy - b.w * nx * b.r;
  const vt = vpx * tx + vpy * ty;
  const jt = clamp((-vt * b.m) / 3, -mu * jn, mu * jn);
  const Px = jn * nx + jt * tx, Py = jn * ny + jt * ty;
  b.vx += Px / b.m; b.vy += Py / b.m;
  b.w += (b.r * (ny * Px - nx * Py)) / b.I;
  return -vn;
}

function segHit(W, b, s, e, bar) {
  const rr = b.r + PH.wallTh;
  /* 遠いカベはすぐ飛ばす（AI の先読みで何万回も呼ばれるので、配列も作らない） */
  if (b.x + rr < Math.min(s.x1, s.x2) || b.x - rr > Math.max(s.x1, s.x2) || b.y + rr < Math.min(s.y1, s.y2) || b.y - rr > Math.max(s.y1, s.y2)) return;
  const ex = s.x2 - s.x1, ey = s.y2 - s.y1;
  const tt = clamp(((b.x - s.x1) * ex + (b.y - s.y1) * ey) / (ex * ex + ey * ey || 1), 0, 1);
  const qx = s.x1 + ex * tt, qy = s.y1 + ey * tt;
  const dx = b.x - qx, dy = b.y - qy, d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return;
  let nx, ny;
  const d = Math.sqrt(d2);
  if (d > 1e-4) { nx = dx / d; ny = dy / d; } else {
    const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1;
    nx = -(s.y2 - s.y1) / L; ny = (s.x2 - s.x1) / L;
    if (b.vx * nx + b.vy * ny > 0) { nx = -nx; ny = -ny; }
  }
  b.x += nx * (rr - d); b.y += ny * (rr - d);
  const sp = staticBounce(b, nx, ny, e, PH.wallMu);
  if (sp > 0 && W.ev) W.ev(bar ? 'bar' : 'wall', { b, s, x: qx, y: qy, sp });
}

function rockHit(W, b, r) {
  const dx = b.x - r.x, dy = b.y - r.y, rr = b.r + r.r, d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return;
  const d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d;
  b.x += nx * (rr - d); b.y += ny * (rr - d);
  const bump = r.kind === 'bumper';
  const sp = staticBounce(b, nx, ny, bump ? 0.9 : PH.eRock, PH.wallMu);
  if (sp > 0) {
    if (bump) { b.vx += nx * PH.bumperKick; b.vy += ny * PH.bumperKick; }
    if (W.ev) W.ev(bump ? 'bumper' : 'rock', { b, r, x: r.x + nx * r.r, y: r.y + ny * r.r, sp });
  }
}

function bodyMoving(b) { return !b.out && (b.fall >= 0 || b.vx * b.vx + b.vy * b.vy > PH.stopV * PH.stopV); }
function allStopped(W) { for (const b of W.bodies) if (bodyMoving(b)) return false; return true; }

/* ------------------------------ バリア ------------------------------ */
/* 置けるかどうか。船に重なるときと、短すぎるときは置けない。 */
function barrierFits(W, x1, y1, x2, y2) {
  if (Math.hypot(x2 - x1, y2 - y1) < 40) return false;
  for (const b of W.bodies) {
    if (b.out || b.fall >= 0) continue;
    const [qx, qy] = closestOnSeg(b.x, b.y, x1, y1, x2, y2);
    if (Math.hypot(b.x - qx, b.y - qy) < b.r + PH.wallTh + 2) return false;
  }
  return true;
}
function placeBarrier(W, b, x1, y1, x2, y2) {
  const spec = b.st.bar;
  const bar = { x1, y1, x2, y2, side: b.side, turns: spec.turns, bounce: spec.bounce, ur: spec.bounce > 1, flash: 0, born: 0 };
  W.bars.push(bar);
  b.barLeft--;
  return bar;
}
/* 中心と向きと長さから、両はしを決める */
function barrierEnds(cx, cy, ang, len) {
  const hx = Math.cos(ang) * len / 2, hy = Math.sin(ang) * len / 2;
  return [cx - hx, cy - hy, cx + hx, cy + hy];
}

/* ------------------------------ 先読み ------------------------------ */
/* plan = { bi: 打つ船の番号, ang, frac, spin, jetStep } */
function simulateShot(W0, plan) {
  const W = cloneWorld(W0);
  const b = W.bodies[plan.bi];
  launchBody(b, plan.ang, plan.frac, plan.spin);
  for (let s = 0; s < PH.maxSteps; s++) {
    if (plan.jetStep && s === plan.jetStep) fireJet(W, b);
    stepWorld(W);
    if (s + 1 > 20 && allStopped(W)) break;
  }
  return W;
}
