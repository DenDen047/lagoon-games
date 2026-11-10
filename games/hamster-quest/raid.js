/* =========================================================================
   ハムスターの冒険 ― 騎士と 町の襲撃
   ふつうの魔物は 町の入口の騎士が追いはらう。
   ときどき 大きな魔物が町をおそってくるので、騎士といっしょに戦う。
   ========================================================================= */
'use strict';

/* 町の入口の見はり場所 (タイル) */
const KNIGHT_POSTS = [[58, 84], [58, 87], [70, 55], [73, 55], [70, 100], [73, 100], [85, 84], [85, 87]];
/* 大きな魔物があらわれる場所 (町の外) */
const RAID_GATES = [[50, 85], [71, 49], [71, 106]];
const FOUNTAIN = { x: 71.5 * TILE, y: 80 * TILE };
const RAID_EVERY = 170;

const Raid = {
  /* 冒険のすすみぐあいで 強い魔物になる */
  kind() {
    const G = Game.G;
    return G.books.wind ? 'golem' : G.books.fire ? 'troll' : 'boar';
  },
  active() { const G = Game.G; return G.mobs.find((m) => m.raider && !m.dead) || null; },

  update(dt) {
    const G = Game.G;
    if (G.map.kind !== 'over') return;
    this.knights(dt);
    const r = this.active();
    if (r) { UI.raidBar(r); return; }
    UI.raidBar(null);
    if (G.time < 300) return;
    G.raidT = (G.raidT || 0) + dt;
    if (G.raidT < RAID_EVERY) return;
    if (G.region !== 'town' && G.region !== 'outskirt') return;
    G.raidT = 0;
    this.start();
  },

  start() {
    const G = Game.G, p = G.p;
    /* 遠すぎて消えてしまわない範囲で、いちばん遠い入口から来る */
    let best = null, bd = -1;
    for (const [x, y] of RAID_GATES) {
      const wx = x * TILE + 16, wy = y * TILE + 16;
      if (!World.walkable(G.map, wx, wy, 14)) continue;
      const d = dist(wx, wy, p.x, p.y);
      if (d < 850 && d > bd) { bd = d; best = { x: wx, y: wy }; }
    }
    if (!best) return;
    const m = Mobs.make(this.kind(), best.x, best.y);
    m.raider = true; m.aggro = true; m.slamT = 3;
    G.mobs.push(m);
    Sfx.roar(); R.shake = 8;
    UI.banner(`${MOBS[m.type].name}が 町をおそってきた！`);
    toast('騎士たちと いっしょに戦おう！', 'bad');
  },

  /* 大きな魔物のうごき: 騎士かハムスターか 町のまん中へ */
  think(m, dt) {
    const G = Game.G, p = G.p, d = MOBS[m.type];
    let tgt = !p.dead && dist(m.x, m.y, p.x, p.y) < 420 ? p : null;
    if (!tgt) {
      let kd = 360;
      for (const n of G.npcs) if (n.role === 'knight' && n.map === 'over') { const dd = dist(m.x, m.y, n.x, n.y); if (dd < kd) { kd = dd; tgt = n; } }
    }
    if (!tgt) tgt = FOUNTAIN;
    m.slamT -= dt;
    if (m.st === 'tele') {
      m.tele -= dt;
      if (m.tele <= 0) {
        m.st = 'idle'; m.t = 0;
        const rr = m.r + 46;
        G.zaps.push({ kind: 'ring', x: m.x, y: m.y, r: rr * 1.3, t: 0.5, max: 0.5, col: '#ffe0b0' });
        R.shake = 7; Sfx.boom();
        if (!p.dead && dist(p.x, p.y, m.x, m.y) < rr + 8) Game.hurt(d.atk + 3, m.x, m.y);
        for (const n of G.npcs) {
          if (n.role !== 'knight' || dist(n.x, n.y, m.x, m.y) > rr + 10) continue;
          const a = Math.atan2(n.y - m.y, n.x - m.x);
          n.kbx = Math.cos(a) * 300; n.kby = Math.sin(a) * 300; n.stun = 1.4;
        }
      }
      return { vx: 0, vy: 0 };
    }
    const dx = tgt.x - m.x, dy = tgt.y - m.y, dp = Math.hypot(dx, dy) || 1;
    if (dp < m.r + 50 && m.slamT <= 0) {
      m.st = 'tele'; m.tele = 0.8; m.slamT = rand(2.6, 3.6);
      G.zaps.push({ kind: 'warn', x: m.x, y: m.y, r: m.r + 46, t: 0.8, max: 0.8 });
      Sfx.roar();
      return { vx: 0, vy: 0 };
    }
    const sp = d.spd * (m.slow > 0 ? 0.45 : 1);
    return dp > m.r + 10 ? { vx: (dx / dp) * sp, vy: (dy / dp) * sp } : { vx: 0, vy: 0 };
  },

  /* 騎士: 持ち場の近くに来た魔物と戦う。たおれない */
  knights(dt) {
    const G = Game.G;
    for (const n of G.npcs) {
      if (n.role !== 'knight' || n.map !== G.map.id) continue;
      n.stun = Math.max(0, (n.stun || 0) - dt);
      n.atkT = Math.max(0, (n.atkT || 0) - dt);
      if (n.swing >= 0) { n.swing += dt / 0.3; if (n.swing >= 1) n.swing = -1; }
      if (n.kbx || n.kby) {
        World.move(G.map, n, n.kbx * dt, n.kby * dt, 7);
        n.kbx *= Math.pow(0.01, dt); n.kby *= Math.pow(0.01, dt);
        if (Math.abs(n.kbx) + Math.abs(n.kby) < 5) { n.kbx = 0; n.kby = 0; }
      }
      if (n.stun > 0) { n.fighting = false; continue; }
      let foe = null, fd = Infinity;
      for (const m of G.mobs) {
        if (m.dead) continue;
        const range = m.raider ? 380 : 150;
        const dh = dist(m.x, m.y, n.hx, n.hy);
        if (dh > range) continue;
        const dd = dist(m.x, m.y, n.x, n.y);
        if (dd < fd) { fd = dd; foe = m; }
      }
      n.fighting = !!foe;
      if (!foe) continue;
      const dx = foe.x - n.x, dy = foe.y - n.y, dd = Math.hypot(dx, dy) || 1;
      n.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const reach = foe.r + 30;
      if (dd > reach) {
        World.move(G.map, n, (dx / dd) * 85 * dt, (dy / dd) * 85 * dt, 7);
        n.moving = true;
      } else if (n.atkT <= 0) {
        n.atkT = 1.1; n.swing = 0; n.aim = Math.atan2(dy, dx);
        const dmg = foe.raider ? 3 + Math.floor(Game.G.lv / 3) : 8 + Game.G.lv;
        Mobs.damage(foe, dmg, (dx / dd) * (foe.raider ? 30 : 200), (dy / dd) * (foe.raider ? 30 : 200));
        Sfx.swing();
      }
    }
  },
};
