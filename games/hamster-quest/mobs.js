/* =========================================================================
   ハムスターの冒険 ― 魔物とボスと弾
   ========================================================================= */
'use strict';

let MOB_ID = 1;

const Mobs = {
  spawnT: 0,

  make(type, x, y) {
    const d = MOBS[type];
    return {
      id: MOB_ID++, type, x, y, vx: 0, vy: 0, hp: d.hp, max: d.hp, r: d.r,
      st: 'idle', t: rand(0, 1.5), shotT: rand(1, 2.5), tele: 0, cdx: 0, cdy: 0,
      kbx: 0, kby: 0, flash: 0, slow: 0, face: 1, home: { x, y }, wd: Math.random() * TAU,
      snowy: type === 'weasel' && Game.G.region === 'snow',
    };
  },

  /* ---------------------------- 大地図でわく ---------------------------- */
  spawnAround(dt) {
    const G = Game.G, p = G.p;
    this.spawnT += dt;
    if (this.spawnT < 0.9) return;
    this.spawnT = 0;
    for (let i = G.mobs.length - 1; i >= 0; i--) {
      if (dist(G.mobs[i].x, G.mobs[i].y, p.x, p.y) > 980) G.mobs.splice(i, 1);
    }
    const reg = REGIONS[G.region];
    if (!reg || !reg.spawn.length) return;
    const cap = G.region === 'forest' ? 5 : G.region === 'outskirt' || G.region === 'lake' ? 3 : 7;
    const near = G.mobs.filter((m) => dist(m.x, m.y, p.x, p.y) < 700).length;
    if (near >= cap) return;
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * TAU, r = rand(Math.max(R.vw, R.vh) * 0.55, Math.max(R.vw, R.vh) * 0.55 + 200);
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      const rg = World.regionAt(G.map, x, y);
      if (!rg || REGIONS[rg].safe || !REGIONS[rg].spawn.length) continue;
      if (!World.walkable(G.map, x, y, 12)) continue;
      if (this.nearRest(x, y)) continue;
      const tbl = REGIONS[rg].spawn;
      let tot = 0; for (const [, w] of tbl) tot += w;
      let k = Math.random() * tot, type = tbl[0][0];
      for (const [tt, w] of tbl) { if (k < w) { type = tt; break; } k -= w; }
      G.mobs.push(this.make(type, x, y));
      return;
    }
  },
  nearRest(x, y) {
    for (const k in World.rests) {
      const r = World.rests[k];
      if (dist(x, y, r.x * TILE, r.y * TILE) < 7 * TILE) return true;
    }
    return false;
  },

  /* ------------------------------ 塔でわく ------------------------------ */
  spawnTower(def, n) {
    const G = Game.G, m = G.map;
    const spots = [];
    for (let y = 3; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
      if (!m.solid[y * m.w + x] && dist(x, y, m.entry.x, m.entry.y) > 6) spots.push([x, y]);
    }
    let tot = 0; for (const [, w] of def.mobs) tot += w;
    for (let i = 0; i < n && spots.length; i++) {
      const [x, y] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      let k = Math.random() * tot, type = def.mobs[0][0];
      for (const [tt, w] of def.mobs) { if (k < w) { type = tt; break; } k -= w; }
      const mob = this.make(type, x * TILE + 16, y * TILE + 20);
      mob.aggro = true;
      G.mobs.push(mob);
    }
  },

  /* ------------------------------ うごき ------------------------------ */
  update(dt) {
    const G = Game.G, p = G.p;
    if (G.map.kind === 'over') this.spawnAround(dt);
    for (let i = G.mobs.length - 1; i >= 0; i--) {
      const m = G.mobs[i];
      this.think(m, dt);
      if (m.dead) { G.mobs.splice(i, 1); continue; }
      /* さわるとけが */
      const d = MOBS[m.type];
      if (!p.dead && dist(m.x, m.y - 6, p.x, p.y - 8) < m.r + 9) Game.hurt(d.atk, m.x, m.y);
    }
    if (G.boss) Boss.update(G.boss, dt);
    if (G.tower && !G.map.boss && !G.mobs.length) Game.floorCleared();
  },

  think(m, dt) {
    const G = Game.G, p = G.p, d = MOBS[m.type];
    m.t += dt; m.flash = Math.max(0, m.flash - dt * 4); m.slow = Math.max(0, m.slow - dt);
    const sp = d.spd * (m.slow > 0 ? 0.45 : 1);
    const dx = p.x - m.x, dy = p.y - m.y, dp = Math.hypot(dx, dy) || 1;
    const sees = !p.dead && (dp < (m.aggro ? 420 : 300));
    let vx = 0, vy = 0;
    const fly = d.ai === 'flyer';

    if (d.ai === 'walker') {
      if (sees) { vx = (dx / dp) * sp; vy = (dy / dp) * sp; }
      else this.wander(m, dt, sp * 0.4);
    } else if (d.ai === 'charger') {
      if (m.st === 'tele') {
        m.tele -= dt;
        if (m.tele <= 0) { m.st = 'charge'; m.t = 0; }
      } else if (m.st === 'charge') {
        vx = m.cdx * sp * 3.6; vy = m.cdy * sp * 3.6;
        if (m.t > 0.45) { m.st = 'rest'; m.t = 0; }
      } else if (m.st === 'rest') {
        if (m.t > 0.7) m.st = 'idle';
      } else if (sees) {
        if (dp < 130 && m.t > 1) { m.st = 'tele'; m.tele = 0.5; m.cdx = dx / dp; m.cdy = dy / dp; m.t = 0; }
        else { vx = (dx / dp) * sp; vy = (dy / dp) * sp; }
      } else this.wander(m, dt, sp * 0.4);
    } else if (d.ai === 'flyer') {
      if (sees) {
        if (m.st === 'swoop') {
          vx = m.cdx * sp * 2.4; vy = m.cdy * sp * 2.4;
          if (m.t > 0.5) { m.st = 'idle'; m.t = 0; }
        } else {
          const a = m.t * 1.6 + m.id;
          const tx = p.x + Math.cos(a) * 80, ty = p.y + Math.sin(a) * 50 - 10;
          const ex = tx - m.x, ey = ty - m.y, el = Math.hypot(ex, ey) || 1;
          vx = (ex / el) * sp; vy = (ey / el) * sp;
          if (m.t > 2.6) { m.st = 'swoop'; m.t = 0; m.cdx = dx / dp; m.cdy = dy / dp; }
        }
      } else this.wander(m, dt, sp * 0.5);
    } else if (d.ai === 'shooter') {
      if (sees) {
        if (dp < 110) { vx = -(dx / dp) * sp; vy = -(dy / dp) * sp; }
        else if (dp > 190) { vx = (dx / dp) * sp; vy = (dy / dp) * sp; }
        else { vx = (-dy / dp) * sp * 0.5 * Math.sin(m.t); vy = (dx / dp) * sp * 0.5 * Math.sin(m.t); }
        m.shotT -= dt;
        if (m.shotT <= 0) { m.shotT = rand(1.8, 2.6); this.shoot(m, Math.atan2(dy, dx)); }
      } else this.wander(m, dt, sp * 0.4);
    }
    if (m.wx !== undefined) { vx = m.wx; vy = m.wy; m.wx = undefined; }

    const mx = (vx + m.kbx) * dt, my = (vy + m.kby) * dt;
    m.kbx *= Math.pow(0.004, dt); m.kby *= Math.pow(0.004, dt);
    const ox = m.x, oy = m.y;
    World.move(G.map, m, mx, my, Math.min(m.r, 12), fly);
    /* 町には入らない */
    if (G.map.kind === 'over') {
      const rg = World.regionAt(G.map, m.x, m.y);
      if (rg && REGIONS[rg].safe) { m.x = ox; m.y = oy; }
    }
    m.vx = (m.x - ox) / Math.max(dt, 0.001);
    m.vy = (m.y - oy) / Math.max(dt, 0.001);
  },

  wander(m, dt, sp) {
    m.wd += rand(-1, 1) * dt * 2;
    if (dist(m.x, m.y, m.home.x, m.home.y) > 140) m.wd = Math.atan2(m.home.y - m.y, m.home.x - m.x);
    m.wx = Math.cos(m.wd) * sp * (Math.sin(m.t * 0.7) > -0.3 ? 1 : 0);
    m.wy = Math.sin(m.wd) * sp * (Math.sin(m.t * 0.7) > -0.3 ? 1 : 0);
  },

  shoot(m, a) {
    const G = Game.G, d = MOBS[m.type];
    const S = (ang, sp, extra) => G.shots.push(Object.assign({ x: m.x, y: m.y - 12, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, kind: d.shot, from: 'e', life: 2.4, r: 6, dmg: d.atk }, extra));
    if (d.shot === 'spore') { for (const o of [-0.3, 0, 0.3]) S(a + o, 120); }
    else if (d.shot === 'web') S(a, 150, { slow: 1.6 });
    else if (d.shot === 'dark') S(a, 130, { home: 1.4 });
    else S(a, 165);
    Sfx.shoot();
  },

  /* ------------------------------ けが ------------------------------ */
  damage(m, dmg, kx = 0, ky = 0) {
    if (m.dead) return;
    if (m.boss) { Boss.damage(m, dmg); return; }
    m.hp -= dmg; m.flash = 1;
    m.kbx = kx; m.kby = ky;
    m.aggro = true;
    if (m.st === 'tele') { m.st = 'rest'; m.t = 0; }
    FX.text(m.x, m.y - m.r * 2 - 4, String(dmg), '#fff6c8');
    FX.burst(m.x, m.y - 8, '#ffffff', 4, 40, 0.3);
    if (m.hp <= 0) this.kill(m);
  },
  kill(m) {
    const G = Game.G, d = MOBS[m.type];
    m.dead = true;
    G.kills++;
    FX.burst(m.x, m.y - 8, '#f4e6c8', 12, 80, 0.6);
    FX.ring(m.x, m.y - 6, 'rgba(255,255,255,.8)', 10, 60, 0.4);
    Game.gainExp(d.exp);
    const c = randi(d.coin[0], d.coin[1]);
    if (c > 0) Game.dropCoins(m.x, m.y, c);
    for (const [id, p] of d.drops) if (Math.random() < p) Game.drop(m.x, m.y, id, 1);
    Sfx.hit();
  },
};

/* ================================ ボス ================================ */
const Boss = {
  spawn(type, x, y) {
    const d = BOSSES[type];
    const b = {
      boss: true, type, name: d.name, x, y, hp: d.hp, max: d.hp, r: d.r, atk: d.atk,
      st: 'intro', t: 0, phase: 1, face: 1, flash: 0, air: 0, tele: 0, adds: [], tx: x, ty: y, n: 0, vx: 0, vy: 0,
    };
    return b;
  },
  update(b, dt) {
    const G = Game.G, p = G.p;
    if (b.dead) return;
    b.t += dt; b.flash = Math.max(0, b.flash - dt * 4);
    b.tele = Math.max(0, b.tele - dt);
    if (b.phase === 1 && b.hp < b.max * 0.5) { b.phase = 2; Sfx.roar(); R.shake = 8; toast(`${b.name}が おこった！`, 'bad'); }
    b.face = p.x < b.x ? -1 : 1;
    const fast = b.phase === 2 ? 1.35 : 1;
    if (b.st === 'intro') { if (b.t > 1.4) this.next(b); }
    else if (b.type === 'queen') this.queen(b, dt, fast);
    else if (b.type === 'eagle') this.eagle(b, dt, fast);
    else if (b.type === 'catking') this.catking(b, dt, fast);
    /* さわるとけが */
    if (b.air < 0.4 && !p.dead && dist(b.x, b.y - b.r * 0.6, p.x, p.y - 8) < b.r + 8) Game.hurt(b.atk, b.x, b.y);
    b.x = clamp(b.x, 2 * TILE, (G.map.w - 2) * TILE);
    b.y = clamp(b.y, 4 * TILE, (G.map.h - 1.5) * TILE);
  },
  next(b) {
    const opts = { queen: ['web', 'jump', 'web', 'summon', 'jump'], eagle: ['swoop', 'feathers', 'gust', 'swoop', 'feathers'], catking: ['swipe', 'pounce', 'yarn', 'swipe', 'summon', 'pounce', 'rings'] }[b.type];
    let pick = opts[b.n % opts.length];
    if (pick === 'rings' && b.phase < 2) pick = 'yarn';
    b.n++;
    b.st = 'walk'; b.t = 0; b.after = pick;
  },
  walkTo(b, dt, sp, tx, ty) {
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
    if (d > 4) World.move(Game.G.map, b, (dx / d) * sp * dt, (dy / d) * sp * dt, Math.min(b.r, 14), b.type === 'eagle');
  },
  shot(b, a, sp, kind, extra) {
    const G = Game.G;
    G.shots.push(Object.assign({ x: b.x, y: b.y - b.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind, from: 'e', life: 3, r: 7, dmg: Math.round(b.atk * 0.8) }, extra));
  },
  addMinions(b, type, n, max) {
    const G = Game.G;
    const alive = G.mobs.filter((m) => m.minion).length;
    for (let i = 0; i < Math.min(n, max - alive); i++) {
      const a = Math.random() * TAU;
      const m = Mobs.make(type, b.x + Math.cos(a) * 50, b.y + Math.sin(a) * 30);
      m.aggro = true; m.minion = true;
      if (World.walkable(G.map, m.x, m.y, 10)) G.mobs.push(m);
    }
  },
  slam(b, r) {
    const G = Game.G, p = G.p;
    G.zaps.push({ kind: 'ring', x: b.x, y: b.y, r: r * 1.3, t: 0.5, max: 0.5, col: '#ffffff' });
    R.shake = 7; Sfx.boom();
    if (dist(p.x, p.y, b.x, b.y) < r + 8) Game.hurt(b.atk + 2, b.x, b.y);
  },

  queen(b, dt, fast) {
    const G = Game.G, p = G.p;
    const a = Math.atan2(p.y - 10 - (b.y - b.r), p.x - b.x);
    if (b.st === 'walk') {
      this.walkTo(b, dt, 45 * fast, p.x, p.y);
      if (b.t > 1.6 / fast) { b.st = b.after; b.t = 0; b.k = 0; }
    } else if (b.st === 'web') {
      if (b.t > b.k * 0.45) {
        const n = b.phase === 2 ? 7 : 5;
        for (let i = 0; i < n; i++) this.shot(b, a + (i - (n - 1) / 2) * 0.22, 150, 'web', { slow: 1.4 });
        Sfx.shoot(); b.k++;
      }
      if (b.k >= 3) this.next(b);
    } else if (b.st === 'jump') {
      if (b.k === 0) { b.tx = p.x; b.ty = p.y; G.zaps.push({ kind: 'warn', x: b.tx, y: b.ty, r: 56, t: 0.9 / fast, max: 0.9 }); b.k = 1; b.tele = 0.4; }
      const k = clamp((b.t - 0.4) / (0.55 / fast), 0, 1);
      if (b.t > 0.4) { b.air = Math.sin(k * Math.PI); b.x = lerp(b.x, b.tx, Math.min(1, dt * 6)); b.y = lerp(b.y, b.ty, Math.min(1, dt * 6)); }
      if (k >= 1 && b.k === 1) { b.k = 2; b.air = 0; this.slam(b, 56); }
      if (b.t > 1.4) this.next(b);
    } else if (b.st === 'summon') {
      if (b.k === 0) { this.addMinions(b, 'spider', 2, 4); b.k = 1; Sfx.roar(); }
      if (b.t > 0.8) this.next(b);
    }
  },

  eagle(b, dt, fast) {
    const G = Game.G, p = G.p, m = G.map;
    const cx = m.w * TILE / 2, cy = m.h * TILE / 2;
    b.air = b.st === 'swoopGo' ? 0.2 : 0.55;
    const a = Math.atan2(p.y - 10 - (b.y - 30), p.x - b.x);
    if (b.st === 'walk') {
      const ang = b.t * 1.2;
      this.walkTo(b, dt, 140 * fast, cx + Math.cos(ang) * 180, cy - 40 + Math.sin(ang) * 90);
      if (b.t > 1.4 / fast) { b.st = b.after; b.t = 0; b.k = 0; }
    } else if (b.st === 'swoop') {
      if (b.k === 0) { b.cdx = p.x - b.x; b.cdy = p.y - b.y; const l = Math.hypot(b.cdx, b.cdy) || 1; b.cdx /= l; b.cdy /= l; b.k = 1; b.tele = 0.6; G.zaps.push({ kind: 'line', x: b.x, y: b.y, x2: b.x + b.cdx * 600, y2: b.y + b.cdy * 600, r: 30, t: 0.6 / fast, max: 0.6 }); }
      if (b.t > 0.6 / fast) { b.st = 'swoopGo'; b.t = 0; Sfx.wind(); }
    } else if (b.st === 'swoopGo') {
      b.x += b.cdx * 520 * fast * dt; b.y += b.cdy * 520 * fast * dt;
      if (b.t > 0.75 || b.x < 2.2 * TILE || b.x > (m.w - 2.2) * TILE || b.y < 4.2 * TILE || b.y > (m.h - 1.7) * TILE) {
        b.again = b.phase === 2 && !b.again;
        if (b.again) { b.st = 'swoop'; b.t = 0; b.k = 0; } else this.next(b);
      }
    } else if (b.st === 'feathers') {
      if (b.t > b.k * 0.5 && b.k < 2) {
        const n = b.phase === 2 ? 9 : 7;
        for (let i = 0; i < n; i++) this.shot(b, a + (i - (n - 1) / 2) * 0.16, 200, 'feather');
        Sfx.shoot(); b.k++;
      }
      if (b.t > 1.3) this.next(b);
    } else if (b.st === 'gust') {
      if (b.k === 0) { b.k = 1; b.tele = 0.5; }
      if (b.t > 0.5 && b.k === 1) {
        b.k = 2; Sfx.wind();
        G.zaps.push({ kind: 'ring', x: b.x, y: b.y, r: 260, t: 0.6, max: 0.6, col: '#e8fbff' });
        const d = dist(p.x, p.y, b.x, b.y);
        if (d < 260) { const aa = Math.atan2(p.y - b.y, p.x - b.x); p.kbx = Math.cos(aa) * 520; p.kby = Math.sin(aa) * 520; if (d < 120) Game.hurt(b.atk, b.x, b.y); }
        this.addMinions(b, 'crow', b.phase === 2 ? 2 : 1, 3);
      }
      if (b.t > 1.2) this.next(b);
    }
  },

  catking(b, dt, fast) {
    const G = Game.G, p = G.p;
    const a = Math.atan2(p.y - b.y, p.x - b.x);
    if (b.st === 'walk') {
      this.walkTo(b, dt, 60 * fast, p.x, p.y);
      if (b.t > 1.3 / fast) { b.st = b.after; b.t = 0; b.k = 0; }
    } else if (b.st === 'swipe') {
      if (b.k === 0) { b.k = 1; b.sa = a; b.zap = { kind: 'swipe', x: b.x, y: b.y - 20, r: 110, a, arc: 1.9, t: 0.95, max: 0.95 }; G.zaps.push(b.zap); b.tele = 0.6 / fast; }
      if (b.t > 0.6 / fast && b.k === 1) {
        b.k = 2; b.zap.live = true; Sfx.swing(); R.shake = 5;
        const d = dist(p.x, p.y - 8, b.x, b.y - 20), pa = Math.atan2(p.y - 8 - (b.y - 20), p.x - b.x);
        if (d < 118 && Math.abs(angDiff(b.sa, pa)) < 0.95) Game.hurt(b.atk + 4, b.x, b.y);
      }
      if (b.t > 1.1) this.next(b);
    } else if (b.st === 'pounce') {
      if (b.k === 0) { b.tx = p.x; b.ty = p.y; G.zaps.push({ kind: 'warn', x: b.tx, y: b.ty, r: 74, t: 1.0 / fast, max: 1.0 }); b.k = 1; Sfx.roar(); }
      const k = clamp((b.t - 0.45) / (0.55 / fast), 0, 1);
      if (b.t > 0.45) { b.air = Math.sin(k * Math.PI) * 0.8; b.x = lerp(b.x, b.tx, Math.min(1, dt * 6)); b.y = lerp(b.y, b.ty, Math.min(1, dt * 6)); }
      if (k >= 1 && b.k === 1) { b.k = 2; b.air = 0; this.slam(b, 74); }
      if (b.t > 1.6) this.next(b);
    } else if (b.st === 'yarn') {
      if (b.t > b.k * 0.35 && b.k < (b.phase === 2 ? 5 : 3)) {
        this.shot(b, a + rand(-0.5, 0.5), 210, 'yarn', { bounce: true, life: 4.5, r: 9, dmg: b.atk });
        Sfx.shoot(); b.k++;
      }
      if (b.t > 2) this.next(b);
    } else if (b.st === 'summon') {
      if (b.k === 0) { b.k = 1; this.addMinions(b, b.phase === 2 ? 'catknight' : 'catsol', 2, 3); Sfx.roar(); }
      if (b.t > 0.9) this.next(b);
    } else if (b.st === 'rings') {
      if (b.t > b.k * 0.6 && b.k < 3) {
        for (let i = 0; i < 14; i++) this.shot(b, (i / 14) * TAU + b.k * 0.22, 140, 'dark', { r: 8 });
        Sfx.boom(); b.k++;
      }
      if (b.t > 2) this.next(b);
    }
  },

  damage(b, dmg) {
    const G = Game.G;
    if (b.dead || b.st === 'intro') return;
    b.hp -= dmg; b.flash = 1;
    FX.text(b.x, b.y - b.r * 2 - 10, String(dmg), '#fff6c8', 16);
    if (b.hp <= 0) this.kill(b);
  },
  kill(b) {
    const G = Game.G, d = BOSSES[b.type];
    b.dead = true; b.hp = 0;
    G.flags.bosses[b.type] = true;
    G.kills++;
    /* 弾や手下の配列は、ループの途中かもしれないので作り直さずに印だけつける */
    for (const m of G.mobs) if (m.minion) { m.dead = true; FX.burst(m.x, m.y, '#fff', 8, 60); }
    for (const sh of G.shots) if (sh.from === 'e') sh.life = 0;
    for (let i = 0; i < 4; i++) FX.burst(b.x + rand(-30, 30), b.y - rand(10, 60), ['#ffe680', '#ffffff', '#ff9a6a'][i % 3], 20, 120, 1.2);
    R.shake = 10; Sfx.boom(); Sfx.fanfare();
    Game.gainExp(d.exp);
    Game.dropCoins(b.x, b.y, d.coin);
    Game.drop(b.x, b.y - 10, null, 1, { book: d.book, vx: 0, vy: 0, delay: 1 });
    if (b.type === 'eagle') Game.drop(b.x + 30, b.y, 'feather', 5);
    G.map.structs.push({ kind: 'exit', x: 11, y: 8, w: 2, h: 1, solid: false, act: 'exit' });
    toast(`${b.name}を たおした！`, 'good');
    UI.bossBar(null);
    Music.play('tower');
    G.boss = null;
    Game.refreshObjective();
    Game.save();
  },
};
Mobs.spawnBoss = function (type, x, y) {
  const G = Game.G;
  G.boss = Boss.spawn(type, x, y);
  UI.bossBar(G.boss);
  Music.play('boss');
  Sfx.roar();
};

/* ================================ 弾 ================================ */
const Shots = {
  update(dt) {
    const G = Game.G, p = G.p, m = G.map;
    for (let i = G.shots.length - 1; i >= 0; i--) {
      const s = G.shots[i];
      if (!s) continue;
      s.life -= dt;
      if (s.life <= 0 && s.from === 'e') { G.shots.splice(i, 1); continue; }
      if (s.home && !p.dead) {
        const a = Math.atan2(p.y - 10 - s.y, p.x - s.x), cur = Math.atan2(s.vy, s.vx), sp = Math.hypot(s.vx, s.vy);
        const na = cur + clamp(angDiff(cur, a), -s.home * dt, s.home * dt);
        s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
      }
      const ox = s.x, oy = s.y;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.kind === 'star') {
        if (s.aimAt && !s.aimAt.dead) { s.fall = s.aimAt.y - 10; s.x += (s.aimAt.x - s.x) * Math.min(1, dt * 4); }
        if (s.y >= s.fall) { this.explode(s, 40); G.shots.splice(i, 1); continue; }
        continue;
      }
      if (s.life <= 0) { if (s.aoe) this.explode(s, s.aoe); G.shots.splice(i, 1); continue; }
      if (s.kind !== 'wind' && World.blocksShot(m, s.x, s.y)) {
        if (s.bounce) {
          if (World.blocksShot(m, s.x, oy)) s.vx = -s.vx;
          if (World.blocksShot(m, ox, s.y)) s.vy = -s.vy;
          s.x = ox; s.y = oy;
          continue;
        }
        if (s.aoe) this.explode(s, s.aoe);
        else FX.burst(s.x, s.y, '#ffffff', 4, 30, 0.3);
        G.shots.splice(i, 1); continue;
      }
      if (s.from === 'p') {
        if (this.hitMobs(s, dt)) { G.shots.splice(i, 1); continue; }
      } else if (!p.dead && dist(s.x, s.y, p.x, p.y - 10) < s.r + 9) {
        if (Game.hurt(s.dmg, s.x, s.y) && s.slow) p.slowT = s.slow;
        if (p.roll < 0) { G.shots.splice(i, 1); continue; }
      }
    }
  },
  /* true なら弾は消える */
  hitMobs(s, dt) {
    const G = Game.G;
    const targets = G.boss && !G.boss.dead ? [...G.mobs, G.boss] : G.mobs;
    if (s.kind === 'wind') {
      s.tickT = (s.tickT || 0) - dt;
      for (const m of targets) {
        if (dist(s.x, s.y, m.x, m.y - 10) > s.r + m.r) continue;
        if (!m.boss) { const a = Math.atan2(m.y - s.y, m.x - s.x); m.kbx = Math.cos(a) * 320 + s.vx; m.kby = Math.sin(a) * 320 + s.vy; }
        if (s.tickT <= 0) Mobs.damage(m, s.dmg);
      }
      if (s.tickT <= 0) s.tickT = s.tick;
      return false;
    }
    for (const m of targets) {
      const hr = m.boss ? m.r : m.r + 2;
      if (dist(s.x, s.y, m.x, m.y - (m.boss ? 24 : 10)) > s.r + hr) continue;
      if (s.aoe) { this.explode(s, s.aoe); return true; }
      Mobs.damage(m, s.dmg, s.vx * 0.5, s.vy * 0.5);
      FX.burst(s.x, s.y, '#9fe8ff', 6, 50, 0.35);
      return true;
    }
    return false;
  },
  explode(s, r) {
    const G = Game.G;
    G.zaps.push({ kind: 'boom', x: s.x, y: s.y, r, t: 0.35, max: 0.35 });
    FX.burst(s.x, s.y, s.kind === 'star' ? '#ffe680' : '#ff9a3a', 12, 90, 0.5);
    Sfx.boom();
    const targets = G.boss && !G.boss.dead ? [...G.mobs, G.boss] : G.mobs.slice();
    for (const m of targets) {
      const d = dist(s.x, s.y, m.x, m.y - 10);
      if (d < r + m.r) { const a = Math.atan2(m.y - s.y, m.x - s.x); Mobs.damage(m, s.dmg, Math.cos(a) * 200, Math.sin(a) * 200); }
    }
    if (s.kind === 'fire') Game.burnAt(s.x, s.y, r);
  },
};
