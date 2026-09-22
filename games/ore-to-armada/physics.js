/* =========================================================================
   ORE TO ARMADA ― 物理
   推進器とジャイロによる操縦 / 移動 / グリッド同士の衝突
   ========================================================================= */
'use strict';

const Phys = {
  /* g.ctrl の入力 (mx,my: ローカルの左右と前後、rot: 回転、face: 向きたい角度) から
     推進器ごとの出力を決めて、力と回転を加える。 */
  control(g, dt) {
    if (g.static || g.dockedTo) return;
    g.updateMass(); g.updateSys();
    const s = g.sys, c = g.ctrl;
    const bonus = g.pilotBonus || 1;
    const pr = g.power.thrRatio == null ? 1 : g.power.thrRatio;
    const h2ok = g.h2 > 0.01;
    const bio = s.bioCores.length ? s.bioCores.length * (150 + g.mass * 5) : 0;
    const cap = [bio, bio, bio, bio];
    for (let d = 0; d < 4; d++) for (const b of s.thr[d]) { b.fire = 0; cap[d] += b.def.thrust * (b.def.h2draw ? (h2ok ? 1 : 0) : pr) * bonus; }
    const vl = g.vecToLocal(g.vx, g.vy);
    const brakeK = g.mass / Math.max(dt, 1 / 30);
    const fx = c.mx ? c.mx * 1e9 : (c.assist ? -vl.x * brakeK : 0);
    const fy = c.my ? c.my * 1e9 : (c.assist ? -vl.y * brakeK : 0);
    const thr = [0, 0, 0, 0];
    const mag = (v) => Math.min(1, Math.abs(v));
    if (fx > 0 && cap[1]) thr[1] = Math.min(1, fx / cap[1]) * (c.mx ? mag(c.mx) : 1);
    else if (fx < 0 && cap[3]) thr[3] = Math.min(1, -fx / cap[3]) * (c.mx ? mag(c.mx) : 1);
    if (fy > 0 && cap[2]) thr[2] = Math.min(1, fy / cap[2]) * (c.my ? mag(c.my) : 1);
    else if (fy < 0 && cap[0]) thr[0] = Math.min(1, -fy / cap[0]) * (c.my ? mag(c.my) : 1);

    let Fx = 0, Fy = 0, T = 0, pUse = 0, h2Use = 0;
    for (let d = 0; d < 4; d++) {
      const t = thr[d]; if (!t) continue;
      const px = DIRS[d][0], py = DIRS[d][1];
      if (bio) { Fx += px * bio * t; Fy += py * bio * t; }
      for (const b of s.thr[d]) {
        const out = b.def.h2draw ? (h2ok ? 1 : 0) : pr;
        const f = b.def.thrust * t * out * bonus;
        if (f <= 0) continue;
        const rx = b.x + b.w / 2 - g.comX, ry = b.y + b.h / 2 - g.comY;
        Fx += px * f; Fy += py * f; T += (rx * py - ry * px) * f;
        if (b.def.pdraw) pUse += b.def.pdraw * t;
        if (b.def.h2draw) h2Use += b.def.h2draw * t;
        b.fire = t;
      }
    }
    // ジャイロ (電力がないと弱る)。回転の目標速度に合わせてトルクを足す。
    const G = (s.torque + (bio ? s.bioCores.length * 20000 : 0)) * (g.power.ratio > 0.2 || !s.gyros.length ? 1 : 0.35) * bonus;
    let wDes = null;
    if (c.face != null) {
      const err = angNorm(c.face - g.a);
      const amax = G / g.inertia;
      wDes = Math.sign(err) * Math.min(TUNE.maxSpin, Math.sqrt(2 * amax * Math.abs(err)) * 0.85);
    } else if (c.rot) wDes = c.rot * TUNE.maxSpin;
    else if (c.assist) wDes = 0;
    if (wDes != null) {
      const need = g.inertia * (wDes - g.va) / dt - T;
      T += clamp(need, -G, G);
    }
    const fw = g.vecToWorld(Fx, Fy);
    g.vx += fw.x / g.mass * dt; g.vy += fw.y / g.mass * dt;
    g.va += T / g.inertia * dt;
    g.thrUse = pUse; g.h2Use = h2Use;
    if (h2Use > 0) Ship.takeH2(g, h2Use * dt);
    g.thrLocal = { x: Fx, y: Fy };
  },

  integrate(g, dt) {
    if (g.static) return;
    if (g.dockedTo) {
      const p = g.dockedTo, r = g.dockRel;
      const w = p.toWorld(r.x, r.y);
      g.x = w.x; g.y = w.y; g.a = p.a + r.a; g.vx = p.vx; g.vy = p.vy; g.va = p.va;
      return;
    }
    const sp = Math.hypot(g.vx, g.vy);
    if (sp > TUNE.maxSpeed) { const k = TUNE.maxSpeed / sp; g.vx *= k; g.vy *= k; }
    g.va = clamp(g.va, -4, 4);
    g.x += g.vx * dt; g.y += g.vy * dt; g.a = angNorm(g.a + g.va * dt);
  },

  /* ---------- 衝突 ---------- */
  collideAll(grids, onImpact) {
    const n = grids.length;
    for (const g of grids) { g.updateMass(); g.updateEdge(); g._c = Math.cos(g.a); g._s = Math.sin(g.a); }
    for (let i = 0; i < n; i++) {
      const A = grids[i];
      if (A.dead || A.dockedTo) continue;
      for (let j = i + 1; j < n; j++) {
        const B = grids[j];
        if (B.dead || B.dockedTo) continue;
        if (A.static && B.static) continue;
        const rr = A.radius + B.radius;
        if (dist2(A.x, A.y, B.x, B.y) > rr * rr) continue;
        if (A.noCollide === B.id || B.noCollide === A.id) continue;
        this.pair(A, B, onImpact);
      }
    }
  },

  pair(A, B, onImpact) {
    // 外周のマスが少ない方 (S) の各マスを、もう片方 (O) の座標に移して調べる
    let S = A, O = B;
    if (A.edge.length / 2 > B.edge.length / 2) { S = B; O = A; }
    if (!S.edge.length || !O.edge.length) return;
    const contacts = [];
    const sc = S._c, ss = S._s, oc = O._c, os = O._s;
    const R = 0.5, Or2 = (O.radius + 1) * (O.radius + 1);
    const e = S.edge;
    for (let k = 0; k < e.length; k += 2) {
      const li = e[k] + 0.5 - S.comX, lj = e[k + 1] + 0.5 - S.comY;
      const wx = S.x + sc * li - ss * lj, wy = S.y + ss * li + sc * lj;
      const dxo = wx - O.x, dyo = wy - O.y;
      if (dxo * dxo + dyo * dyo > Or2) continue;
      const qx = oc * dxo + os * dyo + O.comX, qy = -os * dxo + oc * dyo + O.comY;
      const i0 = Math.floor(qx), j0 = Math.floor(qy);
      let best = null;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ci = i0 + di, cj = j0 + dj;
        if (!O.solid(ci, cj)) continue;
        const cx = clamp(qx, ci, ci + 1), cy = clamp(qy, cj, cj + 1);
        let nx = qx - cx, ny = qy - cy, d = Math.hypot(nx, ny);
        if (d >= R) continue;
        let depth;
        if (d < 1e-6) { nx = qx - (ci + 0.5); ny = qy - (cj + 0.5); const dd = Math.hypot(nx, ny) || 1; nx /= dd; ny /= dd; depth = R + 0.5; }
        else { nx /= d; ny /= d; depth = R - d; }
        if (!best || depth > best.depth) best = { nx, ny, depth, ci, cj };
      }
      if (best) {
        // O のローカル → ワールド
        const nwx = oc * best.nx - os * best.ny, nwy = os * best.nx + oc * best.ny;
        contacts.push({ x: wx - nwx * R, y: wy - nwy * R, nx: nwx, ny: nwy, depth: best.depth, si: e[k], sj: e[k + 1], oi: best.ci, oj: best.cj });
      }
    }
    if (!contacts.length) return;
    contacts.sort((a, b) => b.depth - a.depth);
    const use = contacts.slice(0, 6);
    const imS = S.static ? 0 : 1 / S.mass, imO = O.static ? 0 : 1 / O.mass;
    const iiS = S.static ? 0 : 1 / S.inertia, iiO = O.static ? 0 : 1 / O.inertia;
    let maxImpact = 0, hit = null;
    for (const c of use) {
      const rSx = c.x - S.x, rSy = c.y - S.y, rOx = c.x - O.x, rOy = c.y - O.y;
      const vS = S.velAt(c.x, c.y), vO = O.velAt(c.x, c.y);
      const vrx = vS.x - vO.x, vry = vS.y - vO.y;
      const vn = vrx * c.nx + vry * c.ny;
      if (vn >= 0) continue;
      const rnS = rSx * c.ny - rSy * c.nx, rnO = rOx * c.ny - rOy * c.nx;
      const k = imS + imO + rnS * rnS * iiS + rnO * rnO * iiO;
      if (k <= 0) continue;
      const jn = -(1.2 * vn) / k;
      const tx = -c.ny, ty = c.nx;
      const vt = vrx * tx + vry * ty;
      const rtS = rSx * ty - rSy * tx, rtO = rOx * ty - rOy * tx;
      const kt = imS + imO + rtS * rtS * iiS + rtO * rtO * iiO;
      const jt = clamp(-vt / kt, -0.3 * jn, 0.3 * jn);
      const jx = c.nx * jn + tx * jt, jy = c.ny * jn + ty * jt;
      S.vx += jx * imS; S.vy += jy * imS; S.va += (rSx * jy - rSy * jx) * iiS;
      O.vx -= jx * imO; O.vy -= jy * imO; O.va -= (rOx * jy - rOy * jx) * iiO;
      if (-vn > maxImpact) { maxImpact = -vn; hit = c; }
    }
    // めり込みを押し戻す
    const d = use[0], tot = imS + imO;
    if (tot > 0) {
      const push = Math.min(d.depth, 1.2) * 0.8;
      S.x += d.nx * push * imS / tot; S.y += d.ny * push * imS / tot;
      O.x -= d.nx * push * imO / tot; O.y -= d.ny * push * imO / tot;
    }
    if (hit && onImpact) onImpact(S, hit.si, hit.sj, O, hit.oi, hit.oj, maxImpact);
  },
};
