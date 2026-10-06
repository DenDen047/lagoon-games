/* =========================================================================
   ORE TO ARMADA ― 惑星
   地上の中身 / 降りる・上がる / 地上での船と人の動き
   地上は星系の座標のずっと外 (sx, sy) に置いた区域で、同じ星系の一部として動かす。
   そのため船・乗員・保存の仕組みは宇宙と同じものがそのまま使える。
   ========================================================================= */
'use strict';

const Planet = {
  /* 地上の区域にある点なら、その惑星を返す */
  surfAt(x, y) {
    if (!S || !S.layout.planets) return null;
    for (const P of S.layout.planets) if (dist2(x, y, P.sx, P.sy) < (TUNE.surfaceR + 300) ** 2) return P;
    return null;
  },
  /* 同じ区域 (宇宙か、どの惑星の地上か) にいるか */
  zone(x, y) { const P = this.surfAt(x, y); return P ? P.k : -1; },
  /* 宇宙で、船の真下にある惑星 */
  under(g) {
    for (const P of S.layout.planets) if (dist2(g.x, g.y, P.x, P.y) < P.r * P.r) return P;
    return null;
  },
  /* 地上で取れる鉱石。よく取れる物を先に並べる (後ろほど珍しい) */
  ores(P, sys) {
    const T = PLANET_TYPES[P.type];
    const list = [...T.first, ...RINGS[sys.ring].ores, ...T.rare.filter((o) => ITEMS[o].ring <= sys.ring + 1)];
    return [...new Set(list)];
  },

  /* 星系を組み立てるとき、地上の岩山と古い基地の跡を置く */
  populate(P, addRock, st) {
    const r = new RNG(P.seed), R = TUNE.surfaceR;
    const ores = this.ores(P, S.sys);
    const spots = [];
    // 真ん中 (降りる場所) のまわりは空けておく
    const place = (rad) => {
      for (let k = 0; k < 40; k++) {
        const a = r.f(TAU), d = r.f(90 + rad, R - rad - 20);
        const x = P.sx + Math.cos(a) * d, y = P.sy + Math.sin(a) * d;
        if (spots.every((s) => dist(s.x, s.y, x, y) > s.r + rad + 8)) { spots.push({ x, y, r: rad }); return { x, y }; }
      }
      return null;
    };
    const nBig = r.i(2, 3);
    for (let k = 0; k < nBig; k++) { const dia = r.i(40, 60), p = place(dia / 2); if (p) addRock('s' + P.k + ':b' + k, P.seed + 300 + k, dia, p.x, p.y, { ores, static: true, name: '岩山' }); }
    const n = r.i(12, 18);
    for (let k = 0; k < n; k++) { const dia = r.i(6, 20), p = place(dia / 2); if (p) addRock('s' + P.k + ':' + k, P.seed + k, dia, p.x, p.y, { ores, static: true, name: '岩' }); }
    // 古い基地の跡は最初の1回だけ作る。あとは保存したグリッドとして戻ってくる
    if (!st.planetsMade) { const p = place(7); if (p) S.grids.push(makeRuin(P, p, S.sys)); }
  },

  /* ---------- 降りる・上がる ---------- */
  land(ship, P) {
    this.moveGroup(ship, P.sx - ship.x, P.sy - ship.y);
    const T = PLANET_TYPES[P.type];
    UI.flash(); Sfx.play('jump', 0.5);
    Toast.show(`${P.name} (${T.name}) に降りた。F で船を降りると地上を歩ける`, 'good');
    Toast.show(T.air ? 'ここは空気があるので、宇宙服なしで息ができる' : '空気がないので、外では酸素が減っていく', T.air ? 'good' : 'bad');
    Save.write(true);
  },
  takeoff(ship, P) {
    // ステーションのある側 (なければ恒星の側) の、惑星のふちに出る
    const st = S.station;
    const a = st ? Math.atan2(st.y - P.y, st.x - P.x) : Math.atan2(-P.y, -P.x);
    const d = P.r + ship.radius + 8;
    this.moveGroup(ship, P.x + Math.cos(a) * d - ship.x, P.y + Math.sin(a) * d - ship.y);
    UI.flash(); Sfx.play('jump', 0.5);
    Toast.show(`${P.name} から宇宙へ上がった`, 'good');
    Save.write(true);
  },
  /* 操縦している船と、ついてくる持ち船、近くを漂う乗員をまとめて動かす */
  moveGroup(lead, dx, dy) {
    const group = [lead];
    for (const g of S.grids) {
      if (g === lead || g.faction !== 'player' || g.kind !== 'ship' || g.dead || g.dockedTo || g.abandoned) continue;
      if (g.order && g.order.type === 'follow' && dist(g.x, g.y, lead.x, lead.y) < 400) group.push(g);
    }
    for (const c of S.persons) if (c.kind === 'crew' && c.mode === 'eva' && !c.att && dist(c.x, c.y, lead.x, lead.y) < 80) { c.x += dx; c.y += dy; c.vx = 0; c.vy = 0; }
    // 格納・ドッキング中の船も一緒に移る。出撃中の無人機はベイに戻す
    const moved = new Set(group);
    for (let n = 0; n < 4; n++) for (const g of S.grids) if (g.dockedTo && moved.has(g.dockedTo)) moved.add(g);
    for (const d of S.drones) if (d.bay && moved.has(d.owner)) { d.bay.drones++; d.bay.out = Math.max(0, (d.bay.out || 1) - 1); }
    S.drones = S.drones.filter((d) => !moved.has(d.owner));
    for (const g of group) { g.x += dx; g.y += dy; g.vx = 0; g.vy = 0; g.va = 0; g.target = null; g.jump = null; }
    // 格納・ドッキング中の船は母艦の位置に合わせる
    for (let n = 0; n < 3; n++) for (const g of S.grids) if (g.dockedTo && !g.dead) { const w = g.dockedTo.toWorld(g.dockRel.x, g.dockRel.y); g.x = w.x; g.y = w.y; g.a = g.dockedTo.a + g.dockRel.a; }
    S.particles.length = 0;
    Render.cam.x += dx; Render.cam.y += dy;
  },

  /* ---------- 地上での動き ----------
     空気の抵抗で船も回収物も止まりやすい。地平線の向こうへは行けない。 */
  tick(dt) {
    if (!S.layout.planets.length) return;
    const R = TUNE.surfaceR;
    for (const g of S.grids) {
      if (g.dead || g.static || g.dockedTo) continue;
      const P = this.surfAt(g.x, g.y);
      if (!P) continue;
      const k = 1 / (1 + dt * 0.8);
      g.vx *= k; g.vy *= k; g.va *= 1 / (1 + dt * 1.2);
      if (this.keepIn(g, P, R) && g === playerShip() && !(this.edgeT > G.time)) { this.edgeT = G.time + 6; Toast.show('地平線の向こうへは行けない。宇宙へ戻るには G'); }
    }
    for (const p of S.pickups) if (this.surfAt(p.x, p.y)) { p.vx *= 0.9; p.vy *= 0.9; }
  },
  /* 区域の外へ出ないように押し戻す。押し戻したら true */
  keepIn(o, P, R) {
    const dx = o.x - P.sx, dy = o.y - P.sy, d = Math.hypot(dx, dy);
    if (d <= R) return false;
    const nx = dx / d, ny = dy / d;
    o.x = P.sx + nx * R; o.y = P.sy + ny * R;
    const vn = o.vx * nx + o.vy * ny;
    if (vn > 0) { o.vx -= vn * nx; o.vy -= vn * ny; }
    return true;
  },
};
