/* =========================================================================
   SLIME AGE ― フィールド（たたかう ところ）
   うごき / くっつく・わかれる / 武器 / てきと ボス / ひらめきと はつめい / カメラ
   ========================================================================= */
'use strict';

const BOSS_DMG = 1.35;   // ボスの こうげきは ふつうの てきの この ばい
const SLAM_R = 135;      // ボスの ジャンプ こうげきの はんい

let nextBodyId = 1;

const newWpn = (id) => ({ id, cd: rand(0.15), anim: 0, dur: 0.2, aim: 0 });

function makeBody(o) {
  const b = Object.assign({
    id: nextBodyId++, ally: true, x: 0, y: 0, vx: 0, vy: 0, mvx: 0, mvy: 0, members: ['blue'], wpns: [],
    face: 0, aim: 0, hurtT: 0, ko: false, dead: false, cand: false, candT: 0, boss: null, era: 0, minion: false,
    hop: rand(TAU), sq: 0, z: 0, lunge: 0, lungeCd: 0, lungeHit: false, spawnT: 0, mergeT: 0,
    ai: { t: 0, wx: 0, wy: 0 },
  }, o);
  b.wpns = b.wpns.filter(Boolean).map(newWpn);
  calcStats(b);
  b.hp = b.maxHp;
  return b;
}

function calcStats(b) {
  const n = b.members.length;
  const cnt = (c) => b.members.reduce((s, m) => s + (m === c ? 1 : 0), 0);
  if (b.boss) {
    b.r = b.boss.r; b.slots = b.wpns.length; b.maxHp = b.boss.hp;
    b.spd = 95 + b.era * 6; b.atk = 1; b.regen = 0; b.col = b.boss.col;
    return;
  }
  b.r = bodyRadius(n);
  b.slots = slotCount(n);
  if (b.ally) {
    const per = Prof.memberHp();
    b.maxHp = Math.round(per * (n + cnt('blue') * 0.5));
    b.spd = 215 * (1 - Math.min(0.35, 0.05 * (n - 1))) * (1 + Math.min(0.6, 0.18 * cnt('yellow')));
    b.atk = 1 + 0.1 * (n - 1) + 0.25 * cnt('red');
    b.regen = cnt('green') * per * 0.02;
    b.col = bodyColor(b.members);
  } else {
    b.maxHp = Math.round(ERAS[b.era].hp * n);
    b.spd = (110 + b.era * 8) * (1 - Math.min(0.3, 0.06 * (n - 1)));
    b.atk = 1; b.regen = 0;
    b.col = shade(bodyColor(b.members), -0.15);
  }
}

/* 武器が とどく きょり（からだの まんなかから） */
function weaponReach(b, def) {
  if (def.kind === 'shoot') return def.proj.spd * def.proj.life * 0.85;
  if (def.kind === 'throw') return def.proj.range;
  if (def.kind === 'smash') return b.r + (def.reach * 0.75 + def.aoe * 0.6) * wscale(b.r);
  return b.r + def.reach * wscale(b.r);
}
function bodyReach(b) {
  if (!b.wpns.length) return b.r + 50;
  return Math.max(...b.wpns.map((w) => weaponReach(b, WEAPONS[w.id])));
}

const Field = {
  phase: 'off',     // off / play / boss / clear / lose / over
  era: 0,
  def: null,
  bodies: [], projs: [], items: [], timers: [],
  cam: { x: 0, y: 0, z: 1, shake: 0 },
  ctrl: null,
  mergeCand: null,
  ground: null,

  /* ------------------------------ はじまり ------------------------------ */
  start(era) {
    this.era = era;
    this.def = ERAS[era];
    this.bodies = []; this.projs = []; this.items = []; this.timers = [];
    FX.clear();
    this.ground = groundFor(era);
    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    P.team.forEach((t, i) => {
      const a = i / Math.max(1, P.team.length - 1) * TAU;
      const d = i ? 90 : 0;
      this.bodies.push(makeBody({ ally: true, members: t.members.slice(), wpns: t.wpns.slice(), x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.7 }));
    });
    this.ctrl = this.bodies[0];
    this.spawned = 0;
    this.spawnT = 2.2;
    this.bossBody = null;
    this.t = 0; this.slow = 0; this.endT = 0;
    this.inventT = 2.6;   // つぎに はつめい できる 時こく（時代の あいさつと かさならないように）
    this.stats = { kills: 0, recruits: 0, invented: [], merges: 0 };
    this.moved = 0;
    this.toldFull = 0;
    this.toldEnemyMerge = false;
    this.tut = era === 0 && !P.tutorial ? 0 : -1;
    this.tutT = 0;
    if (era === 0) {
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + 0.5;
        this.dropWeapon('branch', cx + Math.cos(a) * (130 + i * 30), cy + Math.sin(a) * (95 + i * 18));
      }
    }
    this.cam.z = this.targetZoom();
    this.cam.x = cx; this.cam.y = cy; this.cam.shake = 0;
    this.phase = 'play';
  },
  stop() { this.phase = 'off'; this.bodies = []; this.projs = []; this.items = []; this.timers = []; FX.clear(); },

  /* ------------------------------ まいフレーム ------------------------------ */
  update(dt) {
    if (this.phase === 'off' || this.phase === 'over') return;
    const real = dt;
    if (this.slow > 0) { this.slow -= real; dt *= 0.35; }
    this.t += dt;
    if (this.phase === 'play' || this.phase === 'boss') this.control(dt);
    this.spawn(dt);
    for (const b of this.bodies) if (!b.ko && !b.dead) this.think(b, dt);
    this.physics(dt);
    for (const b of this.bodies) for (const w of b.wpns) { if (w.cd > 0) w.cd -= dt; if (w.anim > 0) w.anim -= dt; }
    this.updTimers(dt);
    this.updProjs(dt);
    this.updItems(dt);
    this.bodies = this.bodies.filter((b) => !b.dead);
    this.checkInvent();
    this.tutorial(real);
    this.checkEnd(real);
    this.camera(real);
    FX.update(dt);
  },

  later(t, fn) { this.timers.push({ t, fn }); },
  updTimers(dt) {
    const due = [];
    for (const tm of this.timers) { tm.t -= dt; if (tm.t <= 0) due.push(tm); }
    if (!due.length) return;
    this.timers = this.timers.filter((tm) => tm.t > 0);
    for (const tm of due) tm.fn();
  },

  /* ------------------------------ そうさ ------------------------------ */
  control(dt) {
    const c = this.ctrl;
    if (!c || c.ko) return;
    const m = Input.move();
    c.mvx = m.x; c.mvy = m.y;
    if (m.x || m.y) { c.face = Math.atan2(m.y, m.x); this.moved += Math.hypot(m.x, m.y) * c.spd * dt; }
    const tgt = this.nearestFoe(c, bodyReach(c) + 160);
    c.aim = tgt ? Math.atan2(tgt.y - c.y, tgt.x - c.x) : c.face;
    if (Input.attacking()) this.attack(c, c.aim, tgt, true);
    else if (P.auto && tgt) this.attack(c, c.aim, tgt, false);
    if (Input.consume('merge')) this.tryMerge(c);
    if (Input.consume('split')) this.split(c);
    if (Input.consume('switch')) this.switchCtrl(1, true);
    this.mergeCand = this.findMergePartner(c);
  },

  setCtrl(b) {
    if (!b || b.ko || b.cand || b === this.ctrl || !this.bodies.includes(b)) return;
    this.ctrl = b;
    FX.ring(b.x, b.y, '#ffe27a', b.r, 200, 0.4);
    Sfx.ui();
  },
  switchCtrl(dir, manual) {
    const list = this.bodies.filter((b) => b.ally && !b.cand && !b.ko && !b.dead);
    if (!list.length) return;
    const i = list.indexOf(this.ctrl);
    const next = list[((i + dir) % list.length + list.length) % list.length];
    if (next === this.ctrl) { if (manual) { toast('ほかに うごける なかまが いない'); Sfx.bad(); } return; }
    this.setCtrl(next);
  },

  /* ------------------------------ くっつく・わかれる ------------------------------ */
  findMergePartner(c) {
    let best = null, bd = 1e9;
    for (const b of this.bodies) {
      if (b === c || !b.ally || b.cand || b.ko || b.dead) continue;
      const d = dist(b.x, b.y, c.x, c.y) - b.r - c.r;
      if (d < 70 && d < bd) { best = b; bd = d; }
    }
    return best;
  },
  tryMerge(c) {
    const o = this.findMergePartner(c);
    if (!o) { toast('なかまの そばで おすと くっつくよ', 'bad'); Sfx.bad(); return; }
    if (c.members.length + o.members.length > MAX_MEMBERS) { toast(`くっつけられるのは ${MAX_MEMBERS}ひき まで`, 'bad'); Sfx.bad(); return; }
    this.merge(c, o);
  },
  /* o を a に くっつける */
  merge(a, o) {
    const hp = a.hp + o.hp;
    a.members = a.members.concat(o.members);
    const all = a.wpns.concat(o.wpns).sort((p, q) => rankOf(q.id) - rankOf(p.id));
    calcStats(a);
    a.wpns = all.slice(0, a.slots);
    for (const w of all.slice(a.slots)) if (a.ally || Prof.invented(w.id)) this.dropWeapon(w.id, a.x, a.y);
    a.hp = Math.min(a.maxHp, hp + a.maxHp * 0.1);
    a.x = (a.x + o.x) / 2; a.y = (a.y + o.y) / 2;
    o.dead = true;
    a.sq = 0.7;
    if (o === this.ctrl) this.ctrl = a;
    if (!a.ally) return;
    FX.ring(a.x, a.y, '#ffffff', a.r, 260, 0.45);
    FX.burst(a.x, a.y - a.r * 0.4, 18, { col: a.col, r: 5, spMax: 220 });
    FX.text(a.x, a.y - a.r * 1.9, sizeName(a.members.length) + '！', '#ffffff', 24);
    Sfx.merge();
    this.stats.merges++;
  },
  split(c) {
    if (c.members.length < 2) { toast('1ぴきの スライムは わかれられない', 'bad'); Sfx.bad(); return; }
    const team = this.bodies.filter((b) => b.ally && !b.cand && !b.dead).length;
    const k = Math.min(MAX_BODIES - team + 1, c.members.length);
    if (k < 2) { toast('なかまが いっぱいで わかれられない', 'bad'); Sfx.bad(); return; }
    const groups = Array.from({ length: k }, () => []);
    c.members.forEach((m, i) => groups[i % k].push(m));
    const ws = c.wpns.slice().sort((p, q) => rankOf(q.id) - rankOf(p.id));
    const ratio = c.hp / c.maxHp;
    const parts = groups.map((g, i) => {
      if (i === 0) { c.members = g; calcStats(c); c.wpns = []; return c; }
      return makeBody({ ally: true, members: g, x: c.x, y: c.y });
    });
    ws.forEach((w, i) => {
      const b = parts[i % k];
      if (b.wpns.length < b.slots) b.wpns.push(w); else this.dropWeapon(w.id, c.x, c.y);
    });
    parts.forEach((b, i) => {
      b.hp = Math.max(1, Math.round(b.maxHp * ratio));
      const a = c.face + i / k * TAU;
      b.vx = Math.cos(a) * 340; b.vy = Math.sin(a) * 340;
      b.sq = 0.5;
      if (i) this.bodies.push(b);
    });
    FX.ring(c.x, c.y, '#ffffff', 10, 300, 0.4);
    FX.burst(c.x, c.y, 16, { col: c.col, r: 5, spMax: 260 });
    Sfx.split();
  },

  /* ------------------------------ こうげき ------------------------------ */
  attack(b, ang, tgt, manual) {
    if (!b.wpns.length) {
      if (b.lungeCd > 0) return;
      if (!manual && (!tgt || dist(b.x, b.y, tgt.x, tgt.y) - tgt.r - b.r > 60)) return;
      b.lunge = 0.2; b.lungeCd = b.ally ? 0.7 : 1.2; b.lungeHit = false;
      b.vx = Math.cos(ang) * b.spd * 2.4; b.vy = Math.sin(ang) * b.spd * 2.4;
      b.sq = -0.35;
      Sfx.swing('swing');
      return;
    }
    for (const w of b.wpns) {
      if (w.cd > 0) continue;
      const def = WEAPONS[w.id];
      if (!manual) {
        if (!tgt) continue;
        if (dist(b.x, b.y, tgt.x, tgt.y) - tgt.r > weaponReach(b, def) + 6) continue;
      }
      this.fire(b, w, def, ang, tgt);
      w.cd = def.cd * (b.ally ? 1 : b.boss ? 1.25 : rand(1.5, 1.9));
    }
  },
  fire(b, w, def, ang, tgt) {
    w.aim = ang;
    w.dur = w.anim = def.kind === 'smash' ? 0.34 : def.kind === 'shoot' ? 0.16 : def.hits ? 0.36 : def.kind === 'throw' ? 0.3 : 0.22;
    const sc = wscale(b.r), dmg = def.dmg * b.atk;
    b.sq = -0.15;
    if (def.kind === 'swing' || def.kind === 'thrust') {
      for (let i = 0; i < (def.hits || 1); i++) this.later(0.05 + i * 0.1, () => { if (!b.ko && !b.dead) this.melee(b, def, ang, dmg); });
      Sfx.swing(w.id === 'beamsword' ? 'beam' : w.id === 'drill' ? 'drill' : 'swing');
    } else if (def.kind === 'smash') {
      this.later(0.15, () => {
        if (b.ko || b.dead) return;
        const d = b.r + def.reach * sc * 0.75;
        const x = b.x + Math.cos(ang) * d, y = b.y + Math.sin(ang) * d;
        this.area(b, x, y, def.aoe * sc * 0.9, dmg, def.kb);
        FX.ring(x, y, '#ffffff', 10, 320, 0.35);
        FX.burst(x, y, 10, { col: '#c8b89a', r: 4, spMax: 220 });
        this.shake(6);
        Sfx.slam();
      });
    } else if (def.kind === 'shoot') {
      const p = def.proj;
      const hx = b.x + Math.cos(ang) * (b.r + 6), hy = b.y + Math.sin(ang) * (b.r + 6);
      this.projs.push({ x: hx, y: hy, vx: Math.cos(ang) * p.spd, vy: Math.sin(ang) * p.spd, r: p.r, life: p.life, dmg, kb: def.kb, pierce: p.pierce, shape: p.shape, ally: b.ally, boss: !!b.boss, hit: [] });
      Sfx.swing(p.shape === 'laser' ? 'laser' : p.shape === 'bullet' ? 'gun' : 'shoot');
      if (p.shape === 'bullet') FX.burst(hx, hy, 6, { col: '#ffd27a', dir: ang, spread: 0.4, spMax: 300, glow: 1, lifeMax: 0.25 });
    } else if (def.kind === 'throw') {
      let d = def.proj.range;
      if (tgt) d = Math.min(d, Math.max(60, dist(b.x, b.y, tgt.x, tgt.y)));
      const tx = clamp(b.x + Math.cos(ang) * d, EDGE, WORLD_W - EDGE), ty = clamp(b.y + Math.sin(ang) * d, EDGE, WORLD_H - EDGE);
      this.projs.push({ throw: true, x: b.x, y: b.y, z: 0, sx: b.x, sy: b.y, tx, ty, t: 0, flight: def.proj.flight, dmg, kb: def.kb, aoe: def.aoe * Math.min(1.4, sc), ally: b.ally, boss: !!b.boss });
      Sfx.swing('swing');
    }
  },
  melee(b, def, ang, dmg) {
    const reach = b.r + def.reach * wscale(b.r);
    for (const e of this.bodies) {
      if (!this.foe(b, e)) continue;
      const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy);
      if (d - e.r > reach) continue;
      const half = def.arc / 2 + Math.asin(clamp(e.r / Math.max(d, 1), 0, 1));
      if (d > b.r + e.r && Math.abs(angDiff(ang, Math.atan2(dy, dx))) > half) continue;
      this.hurt(e, dmg, b, def.kb);
    }
  },
  area(src, x, y, rad, dmg, kb) {
    for (const e of this.bodies) {
      if (!this.foe(src, e)) continue;
      if (dist(x, y, e.x, e.y) > rad + e.r) continue;
      this.hurt(e, dmg, { x, y, boss: src.boss, ally: src.ally }, kb);
    }
  },
  foe(a, e) { return e !== a && !e.ko && !e.dead && !e.cand && e.ally !== a.ally && !(e.boss && e.z > 30); },
  nearestFoe(b, range) {
    let best = null, bd = range;
    for (const e of this.bodies) {
      if (!this.foe(b, e)) continue;
      const d = dist(b.x, b.y, e.x, e.y) - e.r;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  hurt(e, dmg, src, kb) {
    if (e.ko || e.dead || e.cand) return;
    if (this.phase === 'clear' || this.phase === 'over') return;
    if (e.ally) dmg *= this.def.foe * (src && src.boss ? BOSS_DMG : 1);
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.hurtT = 0.16; e.sq = 0.35;
    const a = src ? Math.atan2(e.y - src.y, e.x - src.x) : rand(TAU);
    const k = (kb || 100) / Math.sqrt(e.members.length) * (e.boss ? 0.12 : 1) * (e.ally ? 0.6 : 1);
    e.vx += Math.cos(a) * k; e.vy += Math.sin(a) * k;
    FX.text(e.x + rand(-8, 8), e.y - e.r * 1.4, dmg, e.ally ? '#ff9a9a' : '#ffffff', e.ally ? 16 : 20);
    FX.burst(e.x, e.y - e.r * 0.3, 4, { col: shade(e.col, 0.3), r: 3, spMax: 160 });
    if (e.ally) Sfx.hurt(); else Sfx.hit(dmg >= 40);
    if (e.hp <= 0) this.kill(e);
  },
  kill(e) {
    e.hp = 0; e.ko = true;
    FX.burst(e.x, e.y - e.r * 0.3, 14 + e.members.length * 2, { col: e.col, r: 4 + e.r * 0.08, spMax: 260 + e.r * 3, grav: 300 });
    FX.ring(e.x, e.y, '#ffffff', e.r * 0.6, 220, 0.35);
    Sfx.pop();
    if (e.ally) {
      toast(`${sizeName(e.members.length)}が やられた…（クリアすると もどってくる）`, 'bad');
      Sfx.ko();
      if (e === this.ctrl) this.switchCtrl(1, false);
      return;
    }
    e.dead = true;
    if (e.boss) { this.bossDown(e); return; }
    this.stats.kills++;
    this.drop(e);
  },
  drop(e) {
    for (let i = 0; i < e.members.length; i++) {
      this.items.push({ type: 'idea', x: e.x + rand(-12, 12), y: e.y + rand(-8, 8), vx: rand(-90, 90), vy: rand(-70, 70), t: 0, v: 1 });
    }
    const loot = e.wpns.map((w) => w.id).filter((id) => Prof.invented(id));
    if (loot.length && Math.random() < 0.22) this.dropWeapon(pick(loot), e.x, e.y);
    if (Math.random() < 0.09) this.items.push({ type: 'heart', x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), t: 0 });
    if (e.minion) return;
    const tutorial = this.tut >= 0 && (this.stats.kills === 1 || this.stats.kills === 3);
    if (tutorial || (Math.random() < 0.22 && this.canRecruit())) this.makeCandidate(e);
  },
  canRecruit() {
    const cands = this.bodies.filter((b) => b.cand && !b.dead).length;
    if (cands >= 3) return false;
    const team = this.bodies.filter((b) => b.ally && !b.cand && !b.dead);
    return team.length < MAX_BODIES || team.some((b) => b.members.length < MAX_MEMBERS);
  },
  makeCandidate(e) {
    const b = makeBody({ ally: true, cand: true, members: [pick(e.members)], x: e.x, y: e.y });
    b.candT = this.tut >= 0 ? 40 : 16;
    this.bodies.push(b);
    FX.burst(b.x, b.y - b.r, 6, { col: '#ff7ab0', kind: 'star', r: 5, spMax: 120 });
  },
  recruit(b) {
    const team = this.bodies.filter((x) => x.ally && !x.cand && !x.dead).length;
    if (team >= MAX_BODIES) {
      /* チームが いっぱいなら、さわった スライム（むりなら いちばん 小さい なかま）に そのまま くっつける */
      const hosts = this.bodies.filter((x) => x.ally && !x.cand && !x.dead && !x.ko && x.members.length < MAX_MEMBERS);
      hosts.sort((p, q) => (q === this.ctrl ? 1 : 0) - (p === this.ctrl ? 1 : 0) || p.members.length - q.members.length);
      const host = hosts[0];
      if (host) {
        b.cand = false;
        this.stats.recruits++;
        const name = COLORS[b.members[0]].name;
        this.merge(host, b);
        toast(`${name}スライムが なかまに なって くっついた！`);
        Sfx.recruit();
      } else if (this.t - this.toldFull > 3) {
        this.toldFull = this.t;
        toast('なかまが いっぱい！ くっつけて へらすと なかまに できる', 'bad');
      }
      return;
    }
    b.cand = false;
    calcStats(b); b.hp = b.maxHp;
    this.stats.recruits++;
    toast(`${COLORS[b.members[0]].name}スライムが なかまに なった！ ${COLORS[b.members[0]].trait}`);
    FX.burst(b.x, b.y - b.r, 10, { col: '#ff7ab0', kind: 'star', r: 6, spMax: 180 });
    Sfx.recruit();
  },
  bossDown(e) {
    this.phase = 'clear';
    this.endT = 2.6;
    this.slow = 1.2;
    for (let i = 0; i < 5; i++) this.later(i * 0.12, () => { FX.burst(e.x + rand(-40, 40), e.y + rand(-40, 20), 20, { col: pick([e.col, '#ffffff', '#ffe14a']), r: 6, spMax: 420, grav: 200 }); FX.ring(e.x, e.y, '#ffe14a', 20, 500, 0.6); });
    this.shake(18);
    Sfx.boom();
    this.later(0.5, () => Sfx.win());
    for (let i = 0; i < 6; i++) this.items.push({ type: 'idea', x: e.x + rand(-30, 30), y: e.y + rand(-20, 20), vx: rand(-200, 200), vy: rand(-140, 140), t: 0, v: 1 });
    for (const b of this.bodies) if (!b.ally && !b.dead) { b.dead = true; FX.burst(b.x, b.y, 12, { col: b.col, r: 4, spMax: 260 }); }
  },

  /* ------------------------------ てきを だす ------------------------------ */
  spawn(dt) {
    if (this.phase !== 'play') return;
    if (this.tut === 0 || this.tut === 1) return;   // まずは うごいて えだを ひろってから
    const alive = this.bodies.filter((b) => !b.ally && !b.dead).length;
    const cap = this.tut >= 0 && this.tut <= 4 ? 2 : this.def.alive;
    if (this.spawned < this.def.total) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && alive < cap) { this.spawnEnemy(); this.spawnT = rand(0.7, 1.5); }
    } else if (alive === 0) {
      this.spawnBoss();
    }
  },
  spawnPoint(minD) {
    let x = WORLD_W / 2, y = WORLD_H / 2;
    for (let i = 0; i < 40; i++) {
      x = rand(EDGE + 50, WORLD_W - EDGE - 50); y = rand(EDGE + 50, WORLD_H - EDGE - 50);
      const ok = this.bodies.every((b) => !b.ally || b.ko || b.cand || dist(b.x, b.y, x, y) > minD);
      const near = this.ctrl ? dist(this.ctrl.x, this.ctrl.y, x, y) < minD + 500 : true;
      if (ok && near) break;
    }
    return [x, y];
  },
  spawnEnemy() {
    const [x, y] = this.spawnPoint(this.tut >= 0 ? 320 : 460);
    const n = this.era >= 2 && Math.random() < 0.12 ? 2 : 1;
    const members = [], wpns = [];
    for (let i = 0; i < n; i++) { members.push(pick(COLOR_IDS)); const w = enemyWeapon(this.era); if (w) wpns.push(w); }
    const e = makeBody({ ally: false, era: this.era, members, wpns, x, y });
    e.spawnT = 0.5;
    this.bodies.push(e);
    this.spawned++;
    FX.ring(x, y, '#ffffff', 6, 160, 0.4);
    FX.burst(x, y, 8, { col: '#ffffff', spMax: 120 });
  },
  spawnBoss() {
    const bd = this.def.boss;
    const c = this.ctrl;
    const a = rand(TAU);
    const x = clamp(c.x + Math.cos(a) * 460, EDGE + 90, WORLD_W - EDGE - 90);
    const y = clamp(c.y + Math.sin(a) * 340, EDGE + 90, WORLD_H - EDGE - 90);
    const e = makeBody({
      ally: false, era: this.era, members: ['red', 'red', 'red', 'red', 'red', 'red', 'red', 'red'], wpns: bd.wpns, x, y,
      boss: { name: bd.name, col: bd.col, hp: Math.round(this.def.hp * 10), r: 64, slamT: 4.5, summon: 2, ringT: 3.5, tele: null, jump: null },
    });
    e.spawnT = 0.8;
    this.bossBody = e;
    this.bodies.push(e);
    this.phase = 'boss';
    UI.banner('ボス しゅつげん！', bd.name, null, true);
    Sfx.warn();
    this.shake(10);
  },
  summon(boss) {
    const n = 2 + Math.floor(this.era / 3);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      const x = clamp(boss.x + Math.cos(a) * (boss.r + 50), EDGE + 30, WORLD_W - EDGE - 30);
      const y = clamp(boss.y + Math.sin(a) * (boss.r + 40), EDGE + 30, WORLD_H - EDGE - 30);
      const w = enemyWeapon(this.era);
      const e = makeBody({ ally: false, era: this.era, members: [pick(COLOR_IDS)], wpns: w ? [w] : [], x, y, minion: true });
      e.spawnT = 0.5;
      this.bodies.push(e);
      FX.ring(x, y, '#ffffff', 6, 160, 0.4);
    }
    toast('ボスが なかまを よんだ！', 'bad');
  },

  /* ------------------------------ かんがえる（AI） ------------------------------ */
  think(b, dt) {
    if (b.spawnT > 0) { b.spawnT -= dt; b.mvx = b.mvy = 0; return; }
    if (b.boss) return this.thinkBoss(b, dt);
    if (b.cand) return this.thinkCand(b, dt);
    if (b.ally) { if (b !== this.ctrl) this.thinkAlly(b, dt); return; }
    this.thinkEnemy(b, dt);
  },
  /* あいての まわりで ちょうどいい きょりを とって こうげき */
  chase(b, tgt, dt) {
    const dx = tgt.x - b.x, dy = tgt.y - b.y, d = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    b.aim = ang; b.face = ang;
    const ranged = b.wpns.length && b.wpns.every((w) => WEAPONS[w.id].kind === 'shoot' || WEAPONS[w.id].kind === 'throw');
    const want = ranged ? bodyReach(b) * 0.6 : Math.max(b.r + tgt.r, (b.wpns.length ? bodyReach(b) * 0.7 : b.r + tgt.r));
    const mv = d - tgt.r > want ? 1 : ranged && d < want * 0.5 ? -0.7 : 0;
    const side = (b.id % 2 ? 1 : -1) * 0.4;
    b.mvx = Math.cos(ang) * mv - Math.sin(ang) * side * (mv ? 1 : 0.5);
    b.mvy = Math.sin(ang) * mv + Math.cos(ang) * side * (mv ? 1 : 0.5);
    this.attack(b, ang, tgt, false);
  },
  thinkEnemy(b, dt) {
    const tgt = this.nearestFoe(b, this.phase === 'boss' ? 2000 : 560);
    if (tgt) return this.chase(b, tgt, dt);
    b.ai.t -= dt;
    if (b.ai.t <= 0) {
      b.ai.t = rand(1, 2.6);
      const c = this.ctrl;
      /* とおくに いるときは なかまの ほうへ すこし よってくる */
      const a = c && dist(b.x, b.y, c.x, c.y) > 800 ? Math.atan2(c.y - b.y, c.x - b.x) + rand(-0.6, 0.6) : rand(TAU);
      const s = Math.random() < 0.25 ? 0 : 0.55;
      b.ai.wx = Math.cos(a) * s; b.ai.wy = Math.sin(a) * s;
    }
    b.mvx = b.ai.wx; b.mvy = b.ai.wy;
    if (b.mvx || b.mvy) b.face = b.aim = Math.atan2(b.mvy, b.mvx);
  },
  thinkAlly(b, dt) {
    const L = this.ctrl;
    if (!L || L.ko) { b.mvx = b.mvy = 0; return; }
    const dL = dist(b.x, b.y, L.x, L.y);
    if (dL < 620) {
      const tgt = this.nearestFoe(b, 380);
      if (tgt) return this.chase(b, tgt, dt);
      const it = this.wantedItem(b);
      if (it) {
        const d = dist(b.x, b.y, it.x, it.y) || 1;
        b.mvx = (it.x - b.x) / d; b.mvy = (it.y - b.y) / d;
        b.face = b.aim = Math.atan2(b.mvy, b.mvx);
        return;
      }
    }
    /* リーダーの うしろに ならぶ */
    const team = this.bodies.filter((x) => x.ally && !x.cand && !x.ko && !x.dead && x !== L);
    const i = team.indexOf(b);
    const a = L.face + Math.PI + ((i % 4) - 1.5) * 0.55;
    const fd = L.r + b.r + 30 + Math.floor(i / 4) * 64;
    const fx = L.x + Math.cos(a) * fd, fy = L.y + Math.sin(a) * fd;
    const d = dist(b.x, b.y, fx, fy);
    if (d > 20) {
      const s = Math.min(1, d / 90) * (dL > 400 ? 1.25 : 1);
      b.mvx = (fx - b.x) / d * s; b.mvy = (fy - b.y) / d * s;
      b.face = Math.atan2(b.mvy, b.mvx);
    } else { b.mvx = b.mvy = 0; b.face = L.face; }
    b.aim = b.face;
  },
  thinkCand(b, dt) {
    b.candT -= dt;
    b.mvx = Math.cos(this.t * 0.8 + b.id) * 0.15; b.mvy = Math.sin(this.t * 1.1 + b.id) * 0.1;
    const c = this.ctrl;
    if (c) b.aim = Math.atan2(c.y - b.y, c.x - b.x);
    if (b.candT <= 0) { b.dead = true; FX.burst(b.x, b.y, 8, { col: b.col, r: 3, spMax: 100 }); }
  },
  thinkBoss(b, dt) {
    const B = b.boss;
    const c = this.ctrl && !this.ctrl.ko ? this.ctrl : this.nearestFoe(b, 99999);
    if (B.jump) {
      const J = B.jump;
      J.t += dt;
      const k = Math.min(1, J.t / J.dur);
      b.x = lerp(J.sx, J.tx, k); b.y = lerp(J.sy, J.ty, k);
      b.z = Math.sin(k * Math.PI) * 170;
      b.vx = b.vy = 0; b.mvx = b.mvy = 0;
      if (k >= 1) {
        b.z = 0; B.jump = null;
        const ally = { ally: false, boss: true, x: b.x, y: b.y };
        this.area(ally, b.x, b.y, SLAM_R, this.def.hp * 0.6, 420);
        FX.ring(b.x, b.y, '#ffffff', 20, 520, 0.5);
        FX.burst(b.x, b.y, 24, { col: '#c8b89a', r: 6, spMax: 360 });
        this.shake(16);
        Sfx.slam();
        b.sq = 0.8;
      }
      return;
    }
    if (B.tele) {
      B.tele.t -= dt;
      b.mvx = b.mvy = 0;
      if (B.tele.t <= 0) { B.jump = { sx: b.x, sy: b.y, tx: B.tele.x, ty: B.tele.y, t: 0, dur: 0.75 }; B.tele = null; }
      return;
    }
    if (!c) { b.mvx = b.mvy = 0; return; }
    if (B.summon > 0 && b.hp < b.maxHp * (B.summon === 2 ? 0.66 : 0.33)) { B.summon--; this.summon(b); }
    B.slamT -= dt;
    if (B.slamT <= 0) {
      B.slamT = rand(5.5, 7.5);
      B.tele = { x: clamp(c.x, EDGE + b.r, WORLD_W - EDGE - b.r), y: clamp(c.y, EDGE + b.r, WORLD_H - EDGE - b.r), t: 1.0, max: 1.0 };
      Sfx.warn();
      return;
    }
    if (this.era === LAST_ERA) {
      B.ringT -= dt;
      if (B.ringT <= 0) {
        B.ringT = 4.5;
        for (let i = 0; i < 14; i++) {
          const a = i / 14 * TAU + this.t;
          this.projs.push({ x: b.x, y: b.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, r: 8, life: 1.6, dmg: this.def.hp * 0.3, kb: 160, pierce: 0, shape: 'laser', ally: false, boss: true, hit: [] });
        }
        Sfx.swing('laser');
      }
    }
    this.chase(b, c, dt);
  },
  /* なかまが ひろいに いく もの（もっと つよい 武器か、けがを したときの ハート） */
  wantedItem(b) {
    let best = null, bd = 260;
    const worst = b.wpns.length < b.slots ? -1 : Math.min(...b.wpns.map((w) => rankOf(w.id)));
    for (const it of this.items) {
      if (it.type === 'wpn' && rankOf(it.id) <= worst) continue;
      if (it.type === 'heart' && b.hp > b.maxHp * 0.6) continue;
      if (it.type === 'idea' || it.t < 0.6) continue;
      const d = dist(b.x, b.y, it.x, it.y);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  },

  /* ------------------------------ うごき ------------------------------ */
  physics(dt) {
    const live = this.bodies.filter((b) => !b.ko && !b.dead);
    for (const b of live) {
      if (b.ko || b.dead) continue;
      if (b.lunge > 0) b.lunge -= dt;
      if (b.lungeCd > 0) b.lungeCd -= dt;
      if (b.hurtT > 0) b.hurtT -= dt;
      b.sq = lerp(b.sq, 0, Math.min(1, dt * 9));
      if (b.lunge > 0) {
        const d = Math.pow(0.15, dt);
        b.vx *= d; b.vy *= d;
        if (!b.lungeHit) {
          for (const e of live) {
            if (!this.foe(b, e) || dist(b.x, b.y, e.x, e.y) > b.r + e.r + 4) continue;
            b.lungeHit = true;
            this.hurt(e, (b.ally ? 3 + this.def.hp * 0.1 : 6 + this.def.hp * 0.15) * b.atk, b, 220);
            break;
          }
        }
      } else {
        const sp = b.spd * (b.cand ? 0.4 : 1);
        const k = Math.min(1, dt * (b.boss ? 4 : 10));
        b.vx += (b.mvx * sp - b.vx) * k;
        b.vy += (b.mvy * sp - b.vy) * k;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.hop += dt * (3 + Math.hypot(b.vx, b.vy) / 45);
      b.x = clamp(b.x, EDGE + b.r * 0.6, WORLD_W - EDGE - b.r * 0.6);
      b.y = clamp(b.y, EDGE + b.r * 0.6, WORLD_H - EDGE - b.r * 0.4);
      if (b.regen && b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + b.regen * dt);
      b.touchE = false;
    }
    /* かさならないように おしあう */
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      if (a.ko || a.dead || (a.boss && a.z > 20)) continue;
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        if (b.ko || b.dead || (b.boss && b.z > 20)) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = (a.r + b.r) * 0.85;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.01;
        const ov = rr - d;
        const ma = a.boss ? 30 : a.members.length, mb = b.boss ? 30 : b.members.length;
        const ka = mb / (ma + mb), kb = ma / (ma + mb);
        const nx = dx / d, ny = dy / d;
        a.x -= nx * ov * ka; a.y -= ny * ov * ka;
        b.x += nx * ov * kb; b.y += ny * ov * kb;
        if (!a.ally && !b.ally && !a.boss && !b.boss) { a.touchE = b; b.touchE = a; }
        /* なかまに なりたい スライムには さわるだけで なかまに なる */
        if (a.cand && b === this.ctrl && !b.ko) this.recruit(a);
        else if (b.cand && a === this.ctrl && !a.ko) this.recruit(b);
      }
    }
    if (this.era >= 1) this.enemyMerge(live.filter((b) => !b.ko && !b.dead), dt);
  },
  /* てきも ときどき くっついて 大きくなる */
  enemyMerge(live, dt) {
    for (const b of live) {
      if (b.ally || b.boss || b.dead || b.ko) continue;
      const o = b.touchE;
      if (!o || o.dead || o.ko || b.members.length + o.members.length > 3) { b.mergeT = 0; continue; }
      b.mergeT += dt;
      if (b.mergeT < 2.2) continue;
      b.mergeT = 0;
      if (Math.random() < 0.5) continue;
      this.merge(b, o);
      FX.ring(b.x, b.y, '#ff6a6a', b.r, 240, 0.4);
      FX.text(b.x, b.y - b.r * 1.9, 'くっついた！', '#ff8a8a', 20);
      Sfx.merge();
      if (!this.toldEnemyMerge) { this.toldEnemyMerge = true; toast('てきも くっついて 大きくなる！ はやめに たおそう', 'bad'); }
    }
  },

  /* ------------------------------ とぶもの ------------------------------ */
  updProjs(dt) {
    for (const p of this.projs) {
      if (p.throw) {
        p.t += dt;
        const k = Math.min(1, p.t / p.flight);
        p.x = lerp(p.sx, p.tx, k); p.y = lerp(p.sy, p.ty, k);
        p.z = Math.sin(k * Math.PI) * 90;
        if (k >= 1) { p.dead = true; this.explode(p); }
        continue;
      }
      const sx = p.x, sy = p.y, mx = p.vx * dt, my = p.vy * dt;
      p.x += mx; p.y += my;
      p.life -= dt;
      /* この フレームで とおった すじの うえに いる あいてを、ちかい じゅんに */
      const len2 = mx * mx + my * my || 1;
      const hits = [];
      for (const e of this.bodies) {
        if (!this.foe(p, e) || p.hit.includes(e.id)) continue;
        const u = clamp(((e.x - sx) * mx + (e.y - sy) * my) / len2, 0, 1);
        if (dist(sx + mx * u, sy + my * u, e.x, e.y) <= e.r + p.r) hits.push({ e, u });
      }
      hits.sort((a, b) => a.u - b.u);
      for (const { e, u } of hits) {
        p.hit.push(e.id);
        this.hurt(e, p.dmg, { x: sx + mx * u - p.vx * 0.05, y: sy + my * u - p.vy * 0.05, boss: p.boss, ally: p.ally }, p.kb);
        if (p.pierce-- <= 0) { p.dead = true; p.x = sx + mx * u; p.y = sy + my * u; break; }
      }
      if (p.life <= 0 || p.x < EDGE * 0.5 || p.y < EDGE * 0.5 || p.x > WORLD_W - EDGE * 0.5 || p.y > WORLD_H - EDGE * 0.5) p.dead = true;
    }
    this.projs = this.projs.filter((p) => !p.dead);
  },
  explode(p) {
    this.area(p, p.x, p.y, p.aoe, p.dmg, p.kb);
    FX.ring(p.x, p.y, '#ffb04a', 10, 420, 0.4);
    FX.burst(p.x, p.y, 22, { col: '#ff8a2a', r: 7, spMax: 340, glow: 1 });
    FX.burst(p.x, p.y, 12, { col: '#5a5a5a', r: 9, spMax: 160, lifeMax: 0.9 });
    this.shake(10);
    Sfx.boom();
  },

  /* ------------------------------ 落ちているもの ------------------------------ */
  dropWeapon(id, x, y, fresh) {
    this.items.push({ type: 'wpn', id, x: clamp(x + rand(-22, 22), EDGE + 10, WORLD_W - EDGE - 10), y: clamp(y + rand(-16, 16), EDGE + 10, WORLD_H - EDGE - 10), t: 0, fresh: !!fresh });
    const wp = this.items.filter((it) => it.type === 'wpn');
    if (wp.length > 30) wp[0].dead = true;
  },
  giveWeapon(b, id) {
    if (b.wpns.length < b.slots) b.wpns.push(newWpn(id));
    else {
      let wi = 0;
      b.wpns.forEach((w, i) => { if (rankOf(w.id) < rankOf(b.wpns[wi].id)) wi = i; });
      if (rankOf(id) <= rankOf(b.wpns[wi].id)) return false;
      const old = b.wpns[wi].id;
      b.wpns[wi] = newWpn(id);
      this.dropWeapon(old, b.x, b.y);
    }
    Sfx.pickup();
    FX.text(b.x, b.y - b.r * 1.9, WEAPONS[id].name, '#ffe27a', 18);
    return true;
  },
  /* ひらめきは つぎの はつめい 1つぶんまでしか ためられない（その時代で まだ はつめいできない ときも） */
  gainIdea(v) {
    const next = Prof.next();
    if (!next) return;
    let purple = 0;
    for (const b of this.bodies) if (b.ally && !b.cand) purple += b.members.reduce((s, m) => s + (m === 'purple' ? 1 : 0), 0);
    P.ideas += v * (1 + 0.25 * purple);
    if (WEAPONS[next].era > this.era) P.ideas = Math.min(P.ideas, inventCost(P.tech));
  },
  updItems(dt) {
    const c = this.ctrl && !this.ctrl.ko ? this.ctrl : null;
    const takers = this.bodies.filter((b) => b.ally && !b.cand && !b.ko && !b.dead);
    for (const it of this.items) {
      if (it.dead) continue;
      it.t += dt;
      if (it.type === 'idea') {
        const f = Math.pow(0.03, dt);
        it.vx *= f; it.vy *= f;
        it.x += it.vx * dt; it.y += it.vy * dt;
        if (c && it.t > 0.35) {
          const d = dist(it.x, it.y, c.x, c.y) || 1;
          if (d < 200 + c.r || this.phase === 'clear') {
            const s = Math.min(d, Math.max(420, 1000 - d) * dt);
            it.x += (c.x - it.x) / d * s; it.y += (c.y - it.y) / d * s;
          }
        }
        for (const b of takers) {
          if (dist(it.x, it.y, b.x, b.y) > b.r + 12) continue;
          it.dead = true;
          this.gainIdea(it.v);
          Sfx.idea();
          FX.burst(it.x, it.y - 6, 4, { col: '#fff59a', r: 3, spMax: 100, glow: 1 });
          break;
        }
      } else if (it.type === 'heart') {
        if (it.t > 25) { it.dead = true; continue; }
        for (const b of takers) {
          if (b.hp >= b.maxHp || dist(it.x, it.y, b.x, b.y) > b.r + 14) continue;
          it.dead = true;
          const heal = Math.round(b.maxHp * 0.3);
          b.hp = Math.min(b.maxHp, b.hp + heal);
          FX.text(b.x, b.y - b.r * 1.9, '+' + heal, '#7dff9a', 20);
          Sfx.heal();
          break;
        }
      } else if (it.type === 'wpn') {
        if (it.t < 0.5) continue;
        for (const b of takers) {
          if (dist(it.x, it.y, b.x, b.y) > b.r + 18) continue;
          if (this.giveWeapon(b, it.id)) { it.dead = true; break; }
          if (b === c && !it.told) {
            it.told = true;
            toast(b.slots < 4 ? 'もっと つよい 武器を もっている（くっついて 大きくなると たくさん もてる）' : 'もっと つよい 武器を もっている');
          }
        }
      }
    }
    this.items = this.items.filter((it) => !it.dead);
  },

  /* ------------------------------ はつめい ------------------------------ */
  checkInvent() {
    if (this.phase !== 'play' && this.phase !== 'boss') return;
    if (this.t < this.inventT) return;
    const id = Prof.next();
    if (!id || WEAPONS[id].era > this.era) return;
    const cost = inventCost(P.tech);
    if (P.ideas < cost) return;
    P.ideas -= cost;
    P.tech++;
    Prof.save();
    this.inventT = this.t + 2.8;
    const c = this.ctrl;
    const a = c.face + 0.9;
    this.dropWeapon(id, c.x + Math.cos(a) * (c.r + 46), c.y + Math.sin(a) * (c.r + 36), true);
    this.stats.invented.push(id);
    this.slow = 0.7;
    Sfx.invent();
    UI.banner('💡 はつめい！', WEAPONS[id].name, id);
  },

  /* ------------------------------ チュートリアル ------------------------------ */
  tutorial(dt) {
    if (this.tut < 0) return;
    const has = this.bodies.some((b) => b.ally && !b.cand && b.wpns.length);
    switch (this.tut) {
      case 0: if (this.moved > 240) this.tut = 1; break;
      case 1: if (has) this.tut = 2; break;
      case 2: if (this.stats.kills >= 1) this.tut = 3; break;
      case 3: if (this.stats.recruits >= 1) this.tut = 4; break;
      case 4: if (this.stats.merges >= 1) this.tut = 5; break;
      case 5: {
        const next = Prof.next();
        if (this.stats.invented.length >= 1 || !next || WEAPONS[next].era > this.era) { this.tut = 6; this.tutT = 10; }
        break;
      }
      case 6:
        this.tutT -= dt;
        if (this.tutT <= 0) { this.tut = -1; P.tutorial = true; Prof.save(); }
        break;
    }
  },

  /* ------------------------------ おわり ------------------------------ */
  checkEnd(real) {
    if (this.phase === 'play' || this.phase === 'boss') {
      if (!this.bodies.some((b) => b.ally && !b.cand && !b.ko)) {
        this.phase = 'lose'; this.endT = 2;
        this.later(0.3, () => Sfx.lose());
      }
    }
    if (this.phase === 'clear' || this.phase === 'lose') {
      this.endT -= real;
      if (this.endT <= 0) this.finish(this.phase === 'clear');
    }
  },
  finish(win) {
    this.phase = 'over';
    for (const it of this.items) if (it.type === 'idea') this.gainIdea(it.v);
    this.saveTeam();
    if (win) {
      P.cleared[this.era] = true;
      if (P.era === this.era) P.era = this.era + 1;
    }
    Prof.save();
    UI.result(win, this.stats, this.era);
  },
  saveTeam() {
    const team = this.bodies.filter((b) => b.ally && !b.cand && !b.dead);
    team.sort((a, b) => (b === this.ctrl ? 1 : 0) - (a === this.ctrl ? 1 : 0));
    P.team = team.map((b) => ({ members: b.members.slice(), wpns: b.wpns.map((w) => w.id) }));
  },
  remaining() {
    const alive = this.bodies.filter((b) => !b.ally && !b.dead && !b.minion && !b.boss).length;
    return alive + this.def.total - this.spawned;
  },

  /* ------------------------------ カメラ ------------------------------ */
  shake(n) { this.cam.shake = Math.max(this.cam.shake, n); },
  targetZoom() {
    const base = clamp(Math.sqrt(G.W * G.H) / 820, 0.6, 1.3);
    const n = this.ctrl ? this.ctrl.members.length : 1;
    return base / (1 + 0.035 * (n - 1));
  },
  camera(dt) {
    const c = this.ctrl;
    if (!c) return;
    this.cam.z = lerp(this.cam.z, this.targetZoom(), Math.min(1, dt * 3));
    this.cam.x = lerp(this.cam.x, c.x + c.vx * 0.25, Math.min(1, dt * 6));
    this.cam.y = lerp(this.cam.y, c.y + c.vy * 0.25, Math.min(1, dt * 6));
    const hw = G.W / 2 / this.cam.z, hh = G.H / 2 / this.cam.z;
    this.cam.x = WORLD_W > hw * 2 ? clamp(this.cam.x, hw, WORLD_W - hw) : WORLD_W / 2;
    this.cam.y = WORLD_H > hh * 2 ? clamp(this.cam.y, hh, WORLD_H - hh) : WORLD_H / 2;
    this.cam.shake = Math.max(0, this.cam.shake - dt * 40);
  },
  toScreen(x, y) {
    return [(x - this.cam.x) * this.cam.z + G.W / 2, (y - this.cam.y) * this.cam.z + G.H / 2];
  },

  /* ------------------------------ 描く ------------------------------ */
  draw(ctx) {
    const cam = this.cam, z = cam.z;
    ctx.fillStyle = this.def.edge;
    ctx.fillRect(0, 0, G.W, G.H);
    ctx.save();
    ctx.translate(G.W / 2 + (Math.random() - 0.5) * cam.shake, G.H / 2 + (Math.random() - 0.5) * cam.shake);
    ctx.scale(z, z);
    ctx.translate(-cam.x, -cam.y);
    ctx.drawImage(this.ground, 0, 0);
    for (const it of this.items) drawItem(ctx, it, this.t);
    const bb = this.bossBody;
    if (bb && !bb.dead && bb.boss.tele) {
      const T = bb.boss.tele, k = 1 - T.t / T.max;
      ctx.fillStyle = `rgba(255,40,40,${0.15 + 0.2 * Math.abs(Math.sin(this.t * 14))})`;
      ctx.strokeStyle = 'rgba(255,60,60,0.9)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(T.x, T.y, SLAM_R, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(T.x, T.y, SLAM_R * k, 0, TAU); ctx.stroke();
    }
    const live = this.bodies.filter((b) => !b.ko && !b.dead);
    for (const b of live) this.drawShadow(ctx, b);
    live.sort((a, b) => a.y - b.y);
    for (const b of live) this.drawBody(ctx, b);
    for (const p of this.projs) drawProj(ctx, p, this.t);
    FX.draw(ctx);
    ctx.restore();
    FX.drawTexts(ctx, (x, y) => this.toScreen(x, y));
    this.drawMarks(ctx);
    this.drawStick(ctx);
  },
  drawShadow(ctx, b) {
    const s = b.z ? Math.max(0.4, 1 - b.z / 260) : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(b.x, b.y + b.r * 0.62, b.r * 1.08 * s, b.r * 0.32 * s, 0, 0, TAU); ctx.fill();
    if (b.cand) return;
    ctx.strokeStyle = b.ally ? (b === this.ctrl ? 'rgba(255,230,110,0.95)' : 'rgba(255,255,255,0.6)') : 'rgba(255,60,60,0.65)';
    ctx.lineWidth = b === this.ctrl ? 3 : 2;
    ctx.beginPath(); ctx.ellipse(b.x, b.y + b.r * 0.62, b.r * 1.15 * s, b.r * 0.36 * s, 0, 0, TAU); ctx.stroke();
  },
  drawBody(ctx, b) {
    const t = this.t;
    const moving = Math.hypot(b.vx, b.vy) > 30;
    const hopY = b.boss ? 0 : moving ? Math.abs(Math.sin(b.hop)) * b.r * 0.28 : 0;
    const sq = b.sq + (moving ? Math.cos(b.hop * 2) * 0.07 : Math.sin(t * 3 + b.id) * 0.04);
    const attacking = b.wpns.some((w) => w.anim > 0) || b.lunge > 0;
    ctx.save();
    ctx.translate(b.x, b.y - hopY - (b.z || 0));
    if (b.spawnT > 0) { const k = 1 - b.spawnT / (b.boss ? 0.8 : 0.5); ctx.scale(Math.max(0.05, k), Math.max(0.05, k)); }
    if (b.cand && b.candT < 3) ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 8));
    const shown = { id: b.id, r: b.r, aim: b.aim, wpns: b.wpns };
    drawHeldWeapons(ctx, shown, false, t);
    drawSlime(ctx, {
      r: b.r, col: b.col, members: b.boss ? null : b.members, look: b.aim,
      mood: b.cand ? 'cand' : b.hurtT > 0 ? 'ouch' : !b.ally ? 'angry' : attacking ? 'shout' : 'happy',
      flash: b.hurtT > 0 ? b.hurtT / 0.16 : 0, sq, crown: b.ally && b.members.length >= MAX_MEMBERS,
      hat: b.ally ? null : b.era, boss: !!b.boss, t,
    });
    drawHeldWeapons(ctx, shown, true, t);
    ctx.restore();
    ctx.globalAlpha = 1;
    const top = b.y - hopY - (b.z || 0) - b.r * 1.35 - (b.ally ? 0 : b.r * 0.25);
    if (b.cand) {
      const bob = Math.sin(t * 4 + b.id) * 3;
      ctx.fillStyle = '#ff5a8a'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      heartPath(ctx, b.x, top - 6 + bob, 8); ctx.fill(); ctx.stroke();
    } else if (!b.boss && b.hp < b.maxHp) {
      const w = Math.max(28, b.r * 1.4);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(b.x - w / 2 - 1, top - 1, w + 2, 6);
      ctx.fillStyle = b.ally ? '#5be37a' : '#ff5a5a';
      ctx.fillRect(b.x - w / 2, top, w * clamp(b.hp / b.maxHp, 0, 1), 4);
    }
    if (b === this.ctrl) {
      const y = top - 14 + Math.sin(t * 5) * 3;
      ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(b.x - 8, y - 8); ctx.lineTo(b.x + 8, y - 8); ctx.lineTo(b.x, y + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  },
  /* 画面の そとに いる てき・ボス・なかま候補の ばしょを はしっこに しめす。
     くっつける なかまが そばに いるときは その うえに 合図を 出す */
  drawMarks(ctx) {
    const m = this.mergeCand;
    if (m && (this.phase === 'play' || this.phase === 'boss')) {
      const [sx, sy] = this.toScreen(m.x, m.y - m.r * 1.5);
      const s = document.body.classList.contains('touch') ? 'くっつく！' : 'E で くっつく';
      ctx.font = `900 14px ${FONT}`;
      const w = ctx.measureText(s).width + 16;
      const y = sy - 22 + Math.sin(this.t * 6) * 2;
      ctx.fillStyle = 'rgba(255,226,122,0.95)';
      roundRect(ctx, sx - w / 2, y - 12, w, 24, 12); ctx.fill();
      ctx.fillStyle = '#2a1a00'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s, sx, y + 1);
    }
    const few = this.remaining() <= 4 || this.phase === 'boss';
    for (const b of this.bodies) {
      if (b.ko || b.dead) continue;
      let col;
      if (b.cand) col = '#ff7ab0';
      else if (!b.ally && (few || b.boss)) col = b.boss ? '#ff3030' : '#ff7070';
      else continue;
      const [sx, sy] = this.toScreen(b.x, b.y);
      const m = 30;
      if (sx > m && sx < G.W - m && sy > 70 && sy < G.H - m) continue;
      const x = clamp(sx, m, G.W - m), y = clamp(sy, 80, G.H - m);
      const a = Math.atan2(sy - y, sx - x);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = col; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      const s = b.boss ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(14 * s, 0); ctx.lineTo(-8 * s, -10 * s); ctx.lineTo(-8 * s, 10 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  },
  drawStick(ctx) {
    const s = Input.stick;
    if (s.id === null) return;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.ox, s.oy, STICK_R, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(s.x, s.y, 24, 0, TAU); ctx.fill();
  },
};
