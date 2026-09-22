/* =========================================================================
   ORE TO ARMADA ― 星系 (いまいる場所)
   星系を組み立てる / 出るときに覚えておく / できごと
   いまいる星系だけを細かく動かし、ほかの星系は保存した状態で待たせる。
   ========================================================================= */
'use strict';

let S = null;

const Sector = {
  build(sysId, how, from) {
    const sys = G.galaxy.systems[sysId];
    const L = systemLayout(sys, G.galaxy);
    const st = G.sysState[sysId] || {};
    S = {
      sys, layout: L, grids: [], persons: [], bullets: [], beams: [], particles: [], pickups: [], drones: [], gates: [], asteroids: [],
      star: { x: 0, y: 0, r: sys.star.r, c: sys.star.c }, station: null, markers: [],
      ev: { raid: 150 + Math.random() * 150, meteor: 420 + Math.random() * 300, distress: 360 + Math.random() * 400, storm: 500 + Math.random() * 400, derelict: 600 + Math.random() * 400, patrol: 5, baseRaid: 700 + Math.random() * 600 },
      warn: null, meteorT: 0, stormT: 0, goneRocks: {},
      onScreenGrid(g) { return !!g.onScreen; },
    };
    G.sysId = sysId;
    G.visited[sysId] = true;
    // 小惑星
    const ores = RINGS[sys.ring].ores;
    const addRock = (idx, seed, diam, x, y, o = {}) => {
      const a = makeAsteroid(seed, diam, ores, o);
      a.rockIdx = idx; a.x = x; a.y = y; a.a = (seed % 628) / 100;
      const dug = st.dug && st.dug[idx];
      if (dug) { a.dug = new Set(dug); for (const k of dug) { const [i, j] = k.split(',').map(Number); a.setTerrain(i, j, 0); } a.dirtyMass = true; a.dirtyEdge = true; }
      const pose = st.pose && st.pose[idx];
      if (pose) { [a.x, a.y, a.a, a.vx, a.vy, a.va] = pose; }
      a.updateMass();
      if (a.count === 0) { S.goneRocks[idx] = dug; return; }
      S.grids.push(a); S.asteroids.push(a);
    };
    L.clusters.forEach((c, ci) => {
      const r = new RNG(c.seed);
      for (let k = 0; k < c.big; k++) { const a = r.f(TAU), d = r.f(0, c.r * 0.5); addRock(ci + ':b' + k, c.seed + 100 + k, r.i(36, 64), c.x + Math.cos(a) * d, c.y + Math.sin(a) * d); }
      for (let k = 0; k < c.n; k++) { const a = r.f(TAU), d = r.f(c.r * 0.35, c.r); addRock(ci + ':' + k, c.seed + k, r.i(4, 15), c.x + Math.cos(a) * d, c.y + Math.sin(a) * d); }
    });
    L.comets.forEach((c, k) => addRock('c' + k, c.seed, 18, c.x, c.y, { comet: true }));
    // ステーションとゲート
    if (L.station) { S.station = makeStation(L.station, sys); S.grids.push(S.station); }
    for (const gt of L.gates) { const g = makeGate(gt, gt.to); S.grids.push(g); S.gates.push(g); }
    // 保存してあるグリッド (自分の船・基地・漂流船・隠れ家)
    if (st.grids) for (const o of st.grids) { const g = gridFromSave(o); S.grids.push(g); }
    else {
      L.hideouts.forEach((h, k) => { const g = makeHideout(h, sys, new RNG(sys.seed + k)); spawnHostiles(g, 3); S.grids.push(g); });
      L.derelicts.forEach((d) => S.grids.push(makeDerelict(d, sys)));
    }
    // 基地を小惑星にくっつける
    for (const g of S.grids) if (g.kind === 'base' && g.rockId != null) {
      const rock = S.asteroids.find((a) => a.rockIdx === g.rockId);
      if (rock) { g.rockGrid = rock; rock.base = g; g.x = rock.x; g.y = rock.y; g.a = rock.a; g.comX = rock.comX; g.comY = rock.comY; g.dirtyMass = false; g.mass = 1e6; g.inertia = 1e9; g.static = true; }
    }
    for (const g of S.grids) { if (g.savedRooms) restoreRooms(g); if (g.hideout && !g.persons) { /* 保存から戻した隠れ家には見張りを1人 */ } }
    // ボス
    if (L.boss && !G.bossDead[sys.ring]) {
      const b = makeBoss(L.boss.key, new RNG(sys.seed + 999));
      b.x = L.boss.x; b.y = L.boss.y; b.home = { x: L.boss.x, y: L.boss.y }; b.aggro = 240; b.startCount = b.count; b.prefRange = 45;
      S.grids.push(b);
      if (b.faction === 'pirate') spawnHostiles(b, 4);
    }
    // 乗員
    for (const c of G.crew) {
      if (c.sysId !== sysId) continue;
      const g = S.grids.find((o) => o.id === c.gridId);
      if (c.inPod) continue;
      if (!g) { c.grid = null; c.seat = null; if (c.mode !== 'eva' || c.x == null) { const w = arrivalPoint(sys, G.galaxy, from, how); c.x = w.x + 3; c.y = w.y; } c.mode = 'eva'; }
      else if (c.mode === 'eva' && c.x != null) { c.grid = null; c.seat = null; }
      else { c.grid = g; c.mode = 'walk'; c.seat = null; }
      c.path = null; c.jobKey = null;
      if (!S.persons.includes(c)) S.persons.push(c);
    }
    // 連合の警備艇
    if (L.station) for (let k = 0; k < (sys.ring === 0 ? 2 : 1); k++) this.spawnPatrol();
    // 外縁の小惑星帯には、はぐれ海賊がうろついている
    if (sys.id !== 0 || G.day > 1) {
      const nPir = sys.ring === 0 ? 1 : sys.ring === 1 ? 2 : 0;
      for (let k = 0; k < nPir; k++) { const c = L.clusters[(k + 1) % L.clusters.length]; if (c) this.spawnEnemy(sys.ring === 0 ? 'scout' : 'raider', c.x + 60, c.y + 60, { patrol: c }); }
    }
    for (const gr of st.graves || []) S.pickups.push({ x: gr.x, y: gr.y, vx: 0, vy: 0, items: gr.items, kind: 'grave', t: 0, id: ++G.nextId });
    for (const m of G.missions) if (m.type === 'rescue' && m.sys === sysId && !m.rescued && m.surv) { const g = S.grids.find((o) => o.rescueId === m.id); if (g) placeSurvivor(m, g); }
    Fleet.relink();
    Render.dropAll && Render.dropAll();
    return S;
  },

  /* 出るときに覚えておく */
  save() {
    if (!S) return;
    const st = G.sysState[S.sys.id] = G.sysState[S.sys.id] || {};
    st.dug = Object.assign({}, S.goneRocks); st.pose = {};
    for (const a of S.asteroids) {
      if (a.dug && a.dug.size) st.dug[a.rockIdx] = [...a.dug];
      if (!a.static && (Math.abs(a.vx) > 0.01 || Math.abs(a.vy) > 0.01 || a.moved)) st.pose[a.rockIdx] = [+a.x.toFixed(2), +a.y.toFixed(2), +a.a.toFixed(3), +a.vx.toFixed(3), +a.vy.toFixed(3), +a.va.toFixed(3)];
    }
    st.grids = [];
    for (const g of S.grids) {
      if (g.dead || g.terrain || g.kind === 'station' || g.kind === 'gate' || g.boss || (g.transient && !g.escortTo)) continue;
      if (g.escortTo) { st.grids.push(gridToSave(g)); continue; }
      if (g.faction === 'player' || g.derelict || g.hideout || (g.faction === null && g.count >= 30 && g.kind !== 'debris')) st.grids.push(gridToSave(g));
    }
    for (const c of G.crew) if (c.sysId === S.sys.id) { c.gridId = c.grid ? c.grid.id : c.gridId; }
    st.graves = S.pickups.filter((p) => p.kind === 'grave').map((p) => ({ x: p.x, y: p.y, items: p.items }));
    for (const p of S.persons) if (p.kind === 'survivor' && !p.dead) { const m = G.missions.find((x) => x.id === p.survivor); if (m) { const w = personWorld(p); m.survState = { mode: p.mode === 'eva' ? 'eva' : 'walk', lx: p.lx, ly: p.ly, x: w.x, y: w.y, vx: p.vx, vy: p.vy, suit: p.suit, hp: p.hp, o2: p.o2, follow: !!p.follow, gridId: p.grid ? p.grid.id : null }; } }
  },

  spawnEnemy(kind, x, y, o = {}) {
    if (S.grids.filter((g) => !g.terrain && !g.static).length > TUNE.maxGrids) return null;
    let blocks = 0; for (const g of S.grids) if (!g.terrain) blocks += g.count;
    if (blocks > TUNE.maxBlocksActive) return null;
    const g = makeEnemy(kind, S.sys.ring, new RNG((Math.random() * 1e9) | 0));
    g.x = x; g.y = y; g.a = Math.random() * TAU; g.transient = true; g.startCount = g.count;
    g.prefRange = kind.startsWith('swarm') ? 0 : 32;
    if (o.patrol) g.patrol = { x, y, cx: o.patrol.x, cy: o.patrol.y, r: o.patrol.r || 100 };
    if (o.target) g.target = o.target;
    S.grids.push(g);
    const t = SHIPS[g.template];
    if (t && t.crew) spawnHostiles(g, t.crew);
    else if (g.crewSlots && g.faction === 'pirate') spawnHostiles(g, Math.min(3, g.crewSlots));
    return g;
  },
  spawnPatrol() {
    const st = S.station; if (!st) return;
    const a = Math.random() * TAU;
    const g = makeEnemy('patrol', S.sys.ring, new RNG((Math.random() * 1e9) | 0));
    g.x = st.x + Math.cos(a) * 80; g.y = st.y + Math.sin(a) * 80; g.transient = true; g.faction = 'union'; g.startCount = g.count;
    g.patrol = { x: g.x, y: g.y, cx: st.x, cy: st.y, r: 160 };
    g.aggro = 220;
    S.grids.push(g);
  },

  /* ---------- できごと ---------- */
  events(dt) {
    const sys = S.sys, ev = S.ev, pl = G.player;
    const w = personWorld(pl);
    const relaxed = G.diff === 'relaxed';
    const safeStart = sys.id === 0 && G.quest < 6;
    // 警報を出してから、しばらくして起きる
    if (S.warn) {
      S.warn.t -= dt;
      if (S.warn.t <= 0) { const f = S.warn.fn; S.warn = null; f(); }
    }
    // 海賊の襲来
    ev.raid -= dt;
    if (ev.raid <= 0 && !S.warn) {
      ev.raid = (relaxed ? 420 : 240) / (1 + sys.ring * 0.25) + Math.random() * 200;
      if (!safeStart && sys.ring < 4) {
        const ring = sys.ring;
        const kinds = ring === 0 ? (G.day > 3 && Math.random() < 0.4 ? ['scout', 'raider'] : ['scout']) : ring === 1 ? ['raider', 'gunship'].concat(Math.random() < 0.4 ? ['cruiser'] : []) : ring === 2 ? ['swarm_s', 'swarm_s', 'swarm_m'] : ['swarm_m', 'swarm_m', 'swarm_s', 'swarm_s'];
        const swarm = ring >= 2;
        this.warnThen(swarm ? '群体の反応がレーダーに現れた' : '海賊の船がこちらへ向かってくる', 12, () => {
          const a = Math.random() * TAU, R = 330;
          kinds.forEach((k, n) => this.spawnEnemy(k, w.x + Math.cos(a) * R + n * 25, w.y + Math.sin(a) * R + n * 15, { target: playerShip() || null }));
        });
      }
    }
    // 隕石雨
    ev.meteor -= dt;
    if (ev.meteor <= 0 && !S.warn) {
      ev.meteor = 700 + Math.random() * 600;
      if (!safeStart) this.warnThen('隕石雨の警報。2分後に通過する。バリアか装甲で備えよう', 120, () => { S.meteorT = 25; S.meteorDir = Math.random() * TAU; Toast.show('隕石雨が来た！', 'bad'); Sfx.play('alarm'); });
    }
    if (S.meteorT > 0) {
      S.meteorT -= dt;
      if (Math.random() < dt * 5) {
        const a = S.meteorDir, off = (Math.random() - 0.5) * 160;
        const x = w.x - Math.cos(a) * 140 - Math.sin(a) * off, y = w.y - Math.sin(a) * 140 + Math.cos(a) * off;
        const r = makeAsteroid((Math.random() * 1e9) | 0, 2 + Math.random() * 2.5, ['ore_iron', 'ore_si']);
        r.static = false; r.x = x; r.y = y; r.vx = Math.cos(a) * 26; r.vy = Math.sin(a) * 26; r.va = Math.random() - 0.5; r.meteor = 12; r.transient = true;
        S.grids.push(r);
      }
    }
    for (const g of S.grids) if (g.meteor != null) { g.meteor -= dt; if (g.meteor <= 0) g.dead = true; }
    // 救難信号
    ev.distress -= dt;
    if (ev.distress <= 0) {
      ev.distress = 600 + Math.random() * 600;
      const a = Math.random() * TAU, r = 300 + Math.random() * 300;
      const m = { x: w.x + Math.cos(a) * r, y: w.y + Math.sin(a) * r, kind: 'distress', trap: Math.random() < 0.35, t: 240 };
      S.markers.push(m);
      Toast.show('救難信号を受けた。地図の黄色い印の場所だ');
    }
    for (const m of S.markers) {
      if (m.kind !== 'distress' || m.done) continue;
      m.t -= dt;
      if (m.t <= 0) { m.done = true; continue; }
      if (dist(w.x, w.y, m.x, m.y) < 60) {
        m.done = true;
        if (m.trap) { Toast.show('罠だ！海賊が待ち伏せしていた', 'bad'); Sfx.play('alarm'); for (let k = 0; k < 2 + sys.ring; k++) this.spawnEnemy(sys.ring >= 2 ? 'swarm_s' : 'scout', m.x + k * 20, m.y - 30, { target: playerShip() }); }
        else { const reward = { p_steel: 20, p_circuit: 8, ammo: 10 }; dropPickup(m.x, m.y, reward, 'loot'); Econ.earn(150 + sys.ring * 150, '救難信号の船を助けた'); G.rep += 1; }
      }
    }
    S.markers = S.markers.filter((m) => !m.done);
    // 太陽嵐 (恒星の近く)
    ev.storm -= dt;
    if (ev.storm <= 0) { ev.storm = 600 + Math.random() * 500; if (Math.hypot(w.x, w.y) < 750) this.warnThen('太陽嵐の予報。電子機器がときどき止まる', 20, () => { S.stormT = 30; }); }
    if (S.stormT > 0) S.stormT -= dt;
    // 漂流船の出現
    ev.derelict -= dt;
    if (ev.derelict <= 0) {
      ev.derelict = 900 + Math.random() * 600;
      const a = Math.random() * TAU, r = 400 + Math.random() * 500;
      const d = makeDerelict({ x: Math.cos(a) * r, y: Math.sin(a) * r, seed: (Math.random() * 1e9) | 0, key: ['hauler', 'frigate', 'gunboat'][(Math.random() * 3) | 0] }, sys);
      S.grids.push(d);
      Toast.show('新しい漂流船の信号をとらえた');
    }
    // 連合の警備艇を保つ
    ev.patrol -= dt;
    if (ev.patrol <= 0) { ev.patrol = 60; if (S.station && S.grids.filter((g) => g.faction === 'union' && g.kind === 'ship' && !g.dead).length < 1) this.spawnPatrol(); }
    // 基地への襲撃 (サバイバルだけ)
    ev.baseRaid -= dt;
    if (ev.baseRaid <= 0 && !relaxed && !S.warn) {
      ev.baseRaid = 900 + Math.random() * 900;
      const bases = S.grids.filter((g) => g.kind === 'base' && g.faction === 'player' && !g.dead);
      if (bases.length && sys.ring < 4) {
        const b = bases[(Math.random() * bases.length) | 0];
        const value = baseValue(b);
        const n = clamp(Math.round(value / 3000), 1, 6);
        this.warnThen(`${b.name} に襲撃が来る。2分で着く`, 120, () => {
          const a = Math.random() * TAU;
          for (let k = 0; k < n; k++) this.spawnEnemy(sys.ring >= 2 ? (k % 2 ? 'swarm_m' : 'swarm_s') : (k % 3 === 2 ? 'gunship' : k % 2 ? 'raider' : 'scout'), b.x + Math.cos(a) * 300 + k * 20, b.y + Math.sin(a) * 300, { target: b });
        });
      }
    }
    // 遠くへ離れた一時的な敵は消す
    for (const g of S.grids) if (g.transient && !g.terrain && g.despawn) g.dead = true;
  },
  warnThen(text, t, fn) {
    S.warn = { text, t, fn, max: t };
    Toast.show(text, 'bad'); Sfx.play('alarm');
  },
  /* ほかの星系の基地: 1日ごとに、留守中の襲撃を守りの強さで決める */
  remoteDay() {
    // 留守中の採掘: 採掘の命令を受けて動ける船は、1日ぶんの鉱石を基地 (なければ自分) に積む
    for (const id in G.sysState) {
      if (+id === S.sys.id) continue;
      const st = G.sysState[id];
      if (!st.grids) continue;
      const ores = RINGS[G.galaxy.systems[id].ring].ores;
      for (const o of st.grids) {
        if (o.faction !== 'player' || o.kind !== 'ship' || !o.order || o.order.type !== 'mine') continue;
        const g = gridFromSave(o);
        g.updateSys();
        const lasers = g.sys.fixed.filter((b) => b.def.weapon === 'mine').length + g.sys.drills.length;
        const pilot = g.sys.aicore || G.crew.some((c) => c.gridId === g.id && c.sysId === +id);
        if (!lasers || !pilot) continue;
        const home = o.order.homeId ? st.grids.find((x) => x.id === o.order.homeId) : null;
        const hg = home ? gridFromSave(home) : g;
        let n = Math.min(120 * lasers, hg.invFree());
        let got = 0;
        while (n > 0) { const k = Math.min(n, 10); hg.invAdd(ores[Math.floor(Math.random() * ores.length)], k); n -= k; got += k; }
        Object.assign(home || o, gridToSave(hg));
        if (got) Toast.show(`${G.galaxy.systems[id].name} の ${g.name} が鉱石を ${got} 個掘った`);
      }
    }
    if (G.diff === 'relaxed') return;
    for (const id in G.sysState) {
      if (+id === S.sys.id) continue;
      const st = G.sysState[id];
      if (!st.grids) continue;
      for (const o of st.grids) {
        if (o.kind !== 'base' || o.faction !== 'player' || Math.random() > 0.25) continue;
        const g = gridFromSave(o);
        g.updateSys();
        const defense = g.sys.turrets.length * 10 + g.shieldMax / 30;
        const attack = baseValue(g) / 1500 * (1 + G.galaxy.systems[id].ring);
        if (defense >= attack) { Toast.show(`${G.galaxy.systems[id].name} の ${g.name} が襲撃を追い返した`); continue; }
        const list = g.blocks.filter((b) => b && !b.def.anchor);
        const k = Math.min(list.length, Math.ceil((attack - defense) * 0.5));
        for (let n = 0; n < k; n++) g.removeBlock(list[(Math.random() * list.length) | 0]);
        Object.assign(o, gridToSave(g));
        Toast.show(`${G.galaxy.systems[id].name} の ${g.name} が襲われ、${k} ブロック壊された`, 'bad');
      }
    }
  },
};

function baseValue(g) {
  let v = 0;
  g.eachBlock((b) => { v += costValue(b.def.cost); });
  const inv = g.invAll(); for (const k in inv) v += itemDef(k).price * inv[k];
  return v;
}
