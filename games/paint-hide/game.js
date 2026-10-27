/* =========================================================================
   PAINT & HIDE ― ゲームの進行と、基地の画面
   かくれる時間 (30びょう) → さがす時間 (120びょう)。
   時間まで 1人でも のこれば かくれる人の かち、ぜんいん つかまれば オニの かち。
   ========================================================================= */
'use strict';

/* オニ1人なら かくれる人 6人、2人なら 8人 */
const HIDERS = { 1: 6, 2: 8 };
const BULLET_SPEED = 950, BULLET_RANGE = 9 * TILE;

/* ---------------------------- パーティクル ---------------------------- */
const FX = {
  list: [],
  add(p) { if (this.list.length > 500) this.list.shift(); this.list.push(Object.assign({ vx: 0, vy: 0, t: 0, life: 0.8, r: 3, col: '#fff', grav: 0, star: false }, p)); },
  burst(x, y, n, col, sp = 160, star = false) {
    for (let i = 0; i < n; i++) { const a = rand(TAU), s = rand(sp * 0.3, sp); this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, life: rand(0.4, 0.9), r: rand(2, star ? 6 : 4.5), col, star }); }
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      if (p.t >= p.life) { this.list.splice(i, 1); continue; }
      p.vx *= 0.92; p.vy = p.vy * 0.92 + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  },
  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.col;
      ctx.beginPath();
      if (p.star) for (let i = 0; i < 10; i++) { const r = i % 2 ? p.r * 0.45 : p.r, a = i * TAU / 10 + p.t * 5; ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
      else ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};

const Game = {
  agents: [], player: null, bullets: [], prints: [],
  phase: 'hide', t: HIDE_T, clock: 0,
  cam: { x: 0, y: 0, z: 1 },
  winner: null, overT: 0, paused: false,
  fog: null, mySkin: null,
  opts: { role: 'random', oni: 1 },

  start(opts) {
    this.opts = Object.assign({}, this.opts, { humans: null, auto: false }, opts);
    const oniN = clamp(this.opts.oni, 1, 2), hidersN = HIDERS[oniN], n = hidersN + oniN;
    const humans = this.opts.humans || [];
    /* オニに なる 番号。オンラインでは 人の 中から くじびき、たりない ぶんは コンピューター */
    let oniIdx;
    if (humans.length) {
      oniIdx = new Set(shuffle([...Array(humans.length + 1).keys()]).slice(0, oniN));
      for (let k = humans.length + 1; oniIdx.size < oniN; k++) oniIdx.add(k);
    } else {
      const playerOni = this.opts.role === 'oni' || (this.opts.role === 'random' && Math.random() < oniN / n);
      oniIdx = new Set(playerOni ? [0, 1].slice(0, oniN) : [1, 2].slice(0, oniN));
    }
    const names = shuffle(NAMES.slice());
    const mine = this.mySkin ? this.mySkin.clone() : makeSkin('#3a7bf0', '#ffe0c4');
    this.agents = [];
    for (let i = 0; i < n; i++) {
      const me = i === 0, h = humans[i - 1];
      const role = oniIdx.has(i) ? 'oni' : 'hider';
      const a = new Agent(i, role, me ? mine : h && h.skin ? Skin.fromData(h.skin) : randomSkin(), me, names[i]);
      if (this.opts.auto && me) a.brain = role === 'oni' ? new OniBrain(a) : new HiderBrain(a);
      if (h) { a.brain = null; a.remote = h.peer; h.agent = a; }
      this.agents.push(a);
    }
    this.player = this.agents[0];
    this.reset();
    /* はじめは みんな まんなかの テーブルの まわり。オニは テーブルの 下がわ */
    const hiders = this.agents.filter((a) => a.role === 'hider'), onis = this.agents.filter((a) => a.role === 'oni');
    hiders.forEach((a, i) => {
      const ang = i / hiders.length * TAU - Math.PI / 2;
      a.x = HALL.x + Math.cos(ang) * TILE * 3.1; a.y = HALL.y + Math.sin(ang) * TILE * 3;
    });
    onis.forEach((a, i) => { a.x = HALL.x + (i - (onis.length - 1) / 2) * TILE * 1.2; a.y = HALL.y + TILE * 1.9; a.aim = Math.PI / 2; });
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.resize();
  },

  reset() {
    for (const s of SPOTS) { s.occ = null; s.res = undefined; }
    this.bullets = []; this.prints = []; FX.list.length = 0;
    this.phase = 'hide'; this.t = HIDE_T; this.clock = 0;
    this.winner = null; this.overT = 0; this.paused = false;
    this.camoCache = new Map(); this.bulletId = 0; this.seenShots = new Set();
  },

  /* オンラインで 入った人の がわ。ホストから もらった 顔ぶれで はじめる */
  startClient(d) {
    this.opts = { oni: d.oni };
    this.agents = d.agents.map((o) => {
      const me = o.id === d.you;
      const a = new Agent(o.id, o.role, me ? (this.mySkin || makeSkin('#3a7bf0', '#ffe0c4')).clone() : Skin.fromData(o.skin), me, o.name);
      a.brain = null; a.x = a.tx = o.x; a.y = a.ty = o.y; a.vis = false; a.tp = 0;
      return a;
    });
    this.player = this.agents[d.you];
    this.reset();
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.resize();
  },

  resize() {
    /* スマホでは すこし 近づけて キャラクターを 大きく 見せる */
    const short = Math.min(G.W, G.H);
    this.cam.z = clamp(short / (TILE * (short < 600 ? 9.5 : 12)), 0.62, 2);
    Art.buildMap(this.cam.z * G.dpr);
  },

  nameOf(a) { return a === this.player ? 'あなた' : a.name; },
  left() { return this.agents.filter((a) => a.role === 'hider' && a.alive).length; },
  visionOf(a) { return a.role === 'oni' ? VISION.oni : VISION.hider; },
  playerSees(x, y) {
    const p = this.player;
    if (!p.alive) return true;
    if (p.role === 'oni' && this.phase === 'hide') return false;
    const ox = p.inSpot ? p.inSpot.cx : p.x, oy = p.inSpot ? p.inSpot.cy : p.y;
    return canSee(ox, oy, x, y, this.visionOf(p) + 12);
  },
  /* 迷彩の うまさは 動かなければ かわらないので おぼえておく */
  camoOf(h) {
    const key = `${Math.round(h.x)}:${Math.round(h.y)}:${h.skin.ver}:${h.skin.shape.bw}:${h.skin.shape.bh}`;
    let v = this.camoCache.get(h.id);
    if (!v || v.key !== key) { v = { key, s: Camo.score(h.skin, h.x, h.y) }; this.camoCache.set(h.id, v); }
    return v.s;
  },

  /* ------------------------------ 出来事 ------------------------------ */
  enterSpot(a, s) {
    if (s.occ || !a.alive || a.role !== 'hider' || a.inSpot) return false;
    s.occ = a; a.inSpot = s; a.moving = false;
    a.x = s.cx; a.y = s.cy + 4; a.tp = (a.tp || 0) + 1;
    if (a === this.player || this.playerSees(s.cx, s.cy)) Sfx.hideIn();
    return true;
  },
  exitSpot(a) {
    const s = a.inSpot;
    if (!s) return;
    const d = spotDoor(s);
    s.occ = null; a.inSpot = null;
    a.x = d.x; a.y = d.y; a.tp = (a.tp || 0) + 1;
  },

  fire(a, ang) {
    if (a.ammo < 1 || a.shotCD > 0 || this.phase !== 'hunt' || !a.alive) return false;
    a.ammo--; a.shotCD = SHOT_GAP; a.aim = ang;
    if (a.ammo < AMMO_MAX && a.reload <= 0) a.reload = AMMO_RELOAD;
    const tip = a.gunTip();
    this.bullets.push({ id: ++this.bulletId, x: tip.x, y: tip.y, vx: Math.cos(ang) * BULLET_SPEED, vy: Math.sin(ang) * BULLET_SPEED, d: 0, by: a, trail: [] });
    FX.burst(tip.x, tip.y, 5, '#ffe27a', 90);
    if (a === this.player || this.playerSees(a.x, a.y)) Sfx.shoot();
    return true;
  },

  /* 弾が (x, y) で かくれる人に 当たったか */
  hitHider(x, y) {
    for (const h of this.agents) {
      if (h.role !== 'hider' || !h.alive || h.inSpot) continue;
      if (Math.abs(x - h.x) > 40 || Math.abs(y - h.y + 30) > 60) continue;
      const P = partsOf(h.skin.shape);
      for (const k of ['face', 'body', 'handL', 'handR']) {
        const p = P[k], lx = x - h.x - p.cx, ly = y - h.y - p.cy;
        if ((lx / (p.rx + 3)) ** 2 + (ly / (p.ry + 3)) ** 2 <= 1) return h;
      }
    }
    return null;
  },

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      let dead = false;
      b.trail.push([b.x, b.y]); if (b.trail.length > 4) b.trail.shift();
      const n = Math.ceil(BULLET_SPEED * dt / 8);
      for (let k = 0; k < n && !dead; k++) {
        const px = b.x, py = b.y;
        b.x += b.vx * dt / n; b.y += b.vy * dt / n; b.d += BULLET_SPEED * dt / n;
        /* かべの 角を ななめに すりぬけないよう、1歩ごとに 見通しで たしかめる */
        if (!los(px, py, b.x, b.y) || b.d > BULLET_RANGE) { dead = true; break; }
        const h = this.hitHider(b.x, b.y);
        if (h) { this.caught(h, b.by); dead = true; break; }
        const s = SPOTS.find((sp) => inSpotRect(sp, b.x, b.y, 0));
        if (s) {
          if (s.occ) this.caught(s.occ, b.by);
          else if (this.playerSees(b.x, b.y)) Sfx.thud();
          dead = true;
        }
      }
      if (dead) { FX.burst(b.x, b.y, 6, '#d9dee6', 70); this.bullets.splice(i, 1); }
    }
  },

  caught(h, by) {
    if (!h.alive) return;
    if (h.inSpot) this.exitSpot(h);
    h.alive = false; h.caughtT = Math.round(HUNT_T - this.t);
    h.moving = false; h.painting = 0;
    if (h.brain) h.brain.clearGoal();
    Net.emit({ t: 'ev', k: 'caught', id: h.id, by: by ? by.id : -1 });
    this.announceCaught(h, by);
    if (this.left() === 0) this.finish('oni');
  },
  announceCaught(h, by) {
    if (h === this.player) Editor.close();
    FX.burst(h.x, h.y - 30, 18, '#ffe27a', 200, true);
    Sfx.hit();
    const left = this.left();
    if (h === this.player) UI.banner('みつかった！', 'ゆうれいに なって、さいごまで 見まもろう', 'bad');
    else UI.banner(`${h.name} が みつかった！`, left ? `のこり ${left}人` : 'ぜんいん みつかった', by === this.player ? 'good' : '');
  },
  phaseBanner() {
    Sfx.whistle();
    if (this.player.role === 'oni') UI.banner('さがしに 行こう！', 'あやしい ところを 撃って つかまえよう');
    else UI.banner('オニが さがしに 来た！', 'うごくと 足あとが のこるよ', 'bad');
  },

  finish(team) {
    if (this.winner) return;
    this.winner = { team };
    this.phase = 'end';
    this.overT = 1.6;
    Editor.close();
    Net.emit({ t: 'over', w: this.winner, res: this.agents.map((a) => [a.id, a.alive ? 1 : 0, a.caughtT]) });
  },

  /* ------------------------------ 毎フレーム ------------------------------ */
  update(dt) {
    if (G.mode !== 'play' || this.paused) return;
    if (Net.client) { this.clientUpdate(dt); return; }
    if (this.winner) {
      this.overT -= dt;
      FX.update(dt);
      if (this.overT <= 0) UI.over(this.winner);
      return;
    }
    this.clock += dt;
    const before = Math.ceil(this.t);
    this.t -= dt;
    const now = Math.ceil(this.t);
    if (now !== before && now <= (this.phase === 'hide' ? 5 : 10) && now > 0) Sfx.tick();
    if (this.t <= 0) {
      if (this.phase === 'hide') {
        this.phase = 'hunt'; this.t = HUNT_T;
        this.phaseBanner();
        Net.emit({ t: 'ev', k: 'phase', ph: 'hunt', tt: HUNT_T });
      } else { this.finish('hider'); return; }
    }
    for (const a of this.agents) {
      if (a.role !== 'oni') continue;
      a.shotCD = Math.max(0, a.shotCD - dt);
      if (a.ammo < AMMO_MAX) { a.reload -= dt; if (a.reload <= 0) { a.ammo++; a.reload = a.ammo < AMMO_MAX ? AMMO_RELOAD : 0; } }
    }
    this.updatePlayer(dt);
    for (const a of this.agents) if (a.remote && a.painting > 0) a.painting -= dt;
    for (const a of this.agents) if (a.brain) { a.brain.update(dt); if (this.winner) return; }
    this.updateBullets(dt);
    if (this.winner) return;
    /* 足あと (さがす時間だけ) */
    for (const a of this.agents) {
      if (this.phase !== 'hunt' || a.role !== 'hider' || !a.alive || !a.moving || a.inSpot) continue;
      a.footT -= dt;
      if (a.footT <= 0) {
        a.footT = 0.22; a.footSide = -a.footSide;
        this.prints.push({ x: a.x + a.footSide * 5, y: a.y - 2, t: this.clock });
      }
    }
    while (this.prints.length && this.clock - this.prints[0].t > 5) this.prints.shift();
    FX.update(dt);
    this.follow(dt);
    if (Net.host) Net.tick(dt);
  },
  follow(dt) {
    const p = this.player;
    this.cam.x = lerp(this.cam.x, p.x, Math.min(1, dt * 8));
    this.cam.y = lerp(this.cam.y, p.y - 20, Math.min(1, dt * 8));
  },

  /* ------------------------------ オンライン ------------------------------ */
  /* ホスト: 入った人の 「かくれる」「撃つ」 */
  remoteAct(a, d) {
    if (d.k === 'hide' && a.role === 'hider' && a.alive) {
      if (a.inSpot) this.exitSpot(a);
      else {
        const s = spotNear(a.x, a.y, TILE * 1.1);
        if (s && !s.occ) this.enterSpot(a, s);
        else if (s) { const m = Net.members.find((x) => x.agent === a); if (m) m.conn.send({ t: 'ev', k: 'full' }); }
      }
    } else if (d.k === 'shoot' && a.role === 'oni' && isFinite(d.ang)) { a.aim = d.ang; this.fire(a, d.ang); }
  },

  /* 入った人: ホストから とどいた ようす */
  applySnap(d) {
    const p = this.player;
    const was = new Set(this.agents.filter((a) => a.vis).map((a) => a.id));
    for (const a of this.agents) if (a !== p) a.vis = false;
    for (const [id, x, y, dir, mv, al, aim, pt] of d.a) {
      const a = this.agents[id];
      if (!a || a === p) continue;
      if (!was.has(id) || dist(a.x, a.y, x, y) > TILE * 3) { a.x = x; a.y = y; }
      a.tx = x; a.ty = y; a.dir = dir; a.moving = !!mv; a.alive = !!al; a.aim = aim / 100; a.painting = pt ? 0.3 : 0; a.vis = true;
    }
    const old = new Map(this.bullets.map((b) => [b.id, b]));
    for (const b of this.bullets) if (!d.b.some((x) => x[0] === b.id)) FX.burst(b.x, b.y, 6, '#d9dee6', 70);
    this.bullets = d.b.map(([id, x, y, vx, vy]) => {
      const o = old.get(id);
      if (!o && !this.seenShots.has(id)) { this.seenShots.add(id); Sfx.shoot(); FX.burst(x, y, 4, '#ffe27a', 80); }
      return Object.assign(o || { id, trail: [] }, { x, y, vx, vy });
    });
    this.prints = d.f.map(([x, y, age]) => ({ x, y, t: this.clock - age / 10 }));
    this.phase = d.ph; this.t = d.tt;
    const [al, sp, ammo, tp, x, y] = d.you;
    p.alive = !!al;
    const spot = sp >= 0 ? SPOTS[sp] : null;
    if (spot && !p.inSpot) Sfx.hideIn();
    p.inSpot = spot; p.ammo = ammo;
    if (tp !== p.tp) { p.tp = tp; p.x = x; p.y = y; }
  },
  clientEvent(d) {
    if (d.k === 'caught') {
      const h = this.agents[d.id];
      if (!h || !h.alive && h !== this.player) return;
      h.alive = false; h.moving = false;
      if (h === this.player) { h.inSpot = null; Editor.close(); }
      this.announceCaught(h, this.agents[d.by]);
    } else if (d.k === 'phase') { this.phase = d.ph; this.t = d.tt; this.phaseBanner(); }
    else if (d.k === 'full') UI.banner('そこは もう だれかが 入っている', '', 'bad');
  },
  clientOver(d) {
    for (const [id, al, ct] of d.res) { const a = this.agents[id]; if (a) { a.alive = !!al; a.caughtT = ct; } }
    this.winner = d.w; this.phase = 'end'; this.overT = 1.6;
    Editor.close();
  },
  clientUpdate(dt) {
    if (this.winner) {
      this.overT -= dt; FX.update(dt);
      if (this.overT <= 0) UI.over(this.winner);
      return;
    }
    this.clock += dt;
    const before = Math.ceil(this.t);
    this.t = Math.max(0, this.t - dt);
    const now = Math.ceil(this.t);
    if (now !== before && now <= (this.phase === 'hide' ? 5 : 10) && now > 0) Sfx.tick();
    this.updatePlayer(dt);
    const k = Math.min(1, dt * 10);
    for (const a of this.agents) {
      if (a === this.player || a.tx === undefined) continue;
      a.x = lerp(a.x, a.tx, k); a.y = lerp(a.y, a.ty, k);
      if (a.moving) a.walk += dt * 14;
    }
    for (const b of this.bullets) { b.trail.push([b.x, b.y]); if (b.trail.length > 4) b.trail.shift(); b.x += b.vx * dt; b.y += b.vy * dt; }
    FX.update(dt);
    this.follow(dt);
    Net.tick(dt);
  },

  /* 画面の 点を ワールド座標に */
  toWorld(sx, sy) { return { x: this.cam.x + (sx - G.W / 2) / this.cam.z, y: this.cam.y + (sy - G.H / 2) / this.cam.z }; },

  updatePlayer(dt) {
    const p = this.player;
    if (p.brain) return;
    if (p.painting > 0) p.painting -= dt;
    if (Editor.isOpen() || (p.role === 'oni' && this.phase === 'hide')) { p.moving = false; return; }
    if (!p.inSpot) {
      const m = Input.move();
      p.step(m.x, m.y, dt);
      if (p.moving && p.alive) Sfx.step();
    }
    if (p.role === 'oni') {
      if (Input.aim.has) {
        const w = this.toWorld(Input.aim.x, Input.aim.y);
        p.aim = Math.atan2(w.y - (p.y - p.skin.shape.bh - 2), w.x - p.x);
      } else if (p.moving) p.aim = p.dir > 0 ? 0 : Math.PI;
      if (Input.consume('shoot') && this.phase === 'hunt' && p.alive) {
        if (Net.client) { if (p.ammo > 0) Net.send({ t: 'act', k: 'shoot', ang: p.aim }); }
        else this.fire(p, p.aim);
      }
    }
    if (Input.consume('hide') && p.role === 'hider' && p.alive) {
      if (Net.client) Net.send({ t: 'act', k: 'hide' });
      else if (p.inSpot) this.exitSpot(p);
      else { const s = this.freeSpotNear(); if (s) this.enterSpot(p, s); }
    }
    if (Input.consume('paint') && p.alive && !p.inSpot) UI.openPaint();
  },
  freeSpotNear() {
    const p = this.player;
    const s = spotNear(p.x, p.y, TILE * 0.9);
    return s && !s.occ ? s : null;
  },

  /* ------------------------------ 描く ------------------------------ */
  draw(ctx) {
    const W = G.W, H = G.H, z = this.cam.z, p = this.player, t = G.time;
    ctx.fillStyle = '#0d1a2e'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-this.cam.x, -this.cam.y);
    /* 地図は 見えている ところだけ 貼る */
    const vx0 = clamp(this.cam.x - W / 2 / z, 0, MW * TILE), vy0 = clamp(this.cam.y - H / 2 / z, 0, MH * TILE);
    const vx1 = clamp(this.cam.x + W / 2 / z, 0, MW * TILE), vy1 = clamp(this.cam.y + H / 2 / z, 0, MH * TILE);
    const s = Art.mapScale;
    if (vx1 > vx0 && vy1 > vy0) ctx.drawImage(Art.map, vx0 * s, vy0 * s, (vx1 - vx0) * s, (vy1 - vy0) * s, vx0, vy0, vx1 - vx0, vy1 - vy0);
    /* 足あと */
    for (const f of this.prints) {
      ctx.globalAlpha = clamp(1 - (this.clock - f.t) / 5, 0, 1) * 0.5;
      ctx.fillStyle = '#2a1d14';
      ctx.beginPath(); ctx.ellipse(f.x, f.y, 3.6, 2.6, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    /* 自分が 入っている かくれ場所 / 入れる かくれ場所 */
    if (p.inSpot) {
      const sp = p.inSpot;
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * Math.sin(t * 4)})`; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
      roundRect(ctx, sp.x * TILE + 1, sp.y * TILE + 1, sp.w * TILE - 2, sp.h * TILE - 2, 6); ctx.stroke(); ctx.setLineDash([]);
    } else if (p.role === 'hider' && p.alive) {
      const sp = this.freeSpotNear();
      if (sp) { ctx.strokeStyle = `rgba(255,214,58,${0.5 + 0.4 * Math.sin(t * 5)})`; ctx.lineWidth = 3; roundRect(ctx, sp.x * TILE + 1, sp.y * TILE + 1, sp.w * TILE - 2, sp.h * TILE - 2, 6); ctx.stroke(); }
    }
    /* キャラクター (手前ほど あとで 描く) */
    const list = this.agents.filter((a) => {
      if (a.inSpot) return false;
      if (Net.client && a !== p && !a.vis) return false;
      if (!a.alive) return !p.alive || a === p;
      return a === p || this.playerSees(a.x, a.y - 20);
    }).sort((a, b) => a.y - b.y);
    for (const a of list) {
      drawChar(ctx, a.skin, a.x, a.y, {
        moving: a.moving, walk: a.walk, phase: a.phase,
        ghost: !a.alive, alpha: a.alive ? 1 : 0.45,
        ring: a.role === 'oni' ? '#e8403f' : null,
        gun: a.role === 'oni' && a.alive ? a.aim : null,
        me: a === p,
        outline: a === p && a.alive && !a.moving && a.role === 'hider' ? 'rgba(255,255,255,0.7)' : null,
      });
      if (a.painting > 0) for (let i = 0; i < 2; i++) FX.add({ x: a.x + rand(-18, 18), y: a.y - rand(5, 70), vy: -30, life: 0.5, r: rand(2, 4), col: pick(['#ffffff', '#ffe27a', '#9fe7ff']), star: true });
    }
    /* 弾 */
    for (const b of this.bullets) {
      ctx.strokeStyle = 'rgba(255,230,120,0.6)'; ctx.lineWidth = 3; ctx.beginPath();
      for (const [x, y] of b.trail) ctx.lineTo(x, y);
      ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, TAU); ctx.fill();
    }
    FX.draw(ctx);
    /* オニの ねらい */
    if (p.role === 'oni' && p.alive && this.phase === 'hunt' && !Editor.isOpen()) {
      const tip = p.gunTip();
      ctx.strokeStyle = 'rgba(255,90,90,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([4, 8]);
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x + Math.cos(p.aim) * TILE * 4, tip.y + Math.sin(p.aim) * TILE * 4); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    if (p.alive) this.drawFog(ctx);
    this.drawStick(ctx);
  },

  drawFog(ctx) {
    const W = G.W, H = G.H, z = this.cam.z, p = this.player;
    if (!this.fog) this.fog = document.createElement('canvas');
    const f = this.fog;
    if (f.width !== Math.floor(W * G.dpr) || f.height !== Math.floor(H * G.dpr)) { f.width = Math.floor(W * G.dpr); f.height = Math.floor(H * G.dpr); }
    const g = f.getContext('2d');
    g.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(5,10,22,0.82)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    const vis = this.visionOf(p);
    const ox = p.inSpot ? p.inSpot.cx : p.x, oy = p.inSpot ? p.inSpot.cy : p.y - 20;
    const sx = (ox - this.cam.x) * z + W / 2, sy = (oy - this.cam.y) * z + H / 2;
    const gr = g.createRadialGradient(sx, sy, 0, sx, sy, vis * z);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.8, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    const pts = visPoly(ox, oy, vis);
    g.beginPath();
    for (let i = 0; i < pts.length; i += 2) g.lineTo((pts[i] - this.cam.x) * z + W / 2, (pts[i + 1] - this.cam.y) * z + H / 2);
    g.closePath(); g.fill();
    g.beginPath(); g.arc(sx, sy, TILE * 1.2 * z, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(f, 0, 0, W, H);
  },

  drawStick(ctx) {
    const s = Input.stick;
    if (s.id === null || G.mode !== 'play') return;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.ox, s.oy, STICK_R, 0, TAU); ctx.fill(); ctx.stroke();
    const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), k = d > STICK_R ? STICK_R / d : 1;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(s.ox + dx * k, s.oy + dy * k, 24, 0, TAU); ctx.fill();
  },
};
