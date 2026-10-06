/* =========================================================================
   STAR FLICK ― バトル
   ターンの進行、はじく操作（引っぱって離す）、回転・バリア・ジェット、
   コンピューターの打ち方、カメラと描画。
   ========================================================================= */
'use strict';

const Battle = {
  W: null,
  cfg: null,       // { mode: 'camp'|'vs', battle, stage, sides: [{ label, ai, ships }] }
  turn: 0,
  round: 1,
  phase: 'off',
  sel: [null, null],
  spin: 0,
  drag: null,
  barDraft: null,
  barUsed: false,
  active: null,
  acc: 0,
  moveSteps: 0,
  ai: null,
  aiShow: null,
  kos: [[], []],
  cam: { s: 1, rot: false, cx: 0, cy: 0, sx: 0, sy: 0 },
  shake: 0,
  banner: null,
  over: null,
  t: 0,
  hintTimer: 0,

  /* ------------------------------ はじまり ------------------------------ */
  start(cfg) {
    this.cfg = cfg;
    const st = STAGES[cfg.stage];
    const bodies = [];
    cfg.sides.forEach((sd, side) => {
      const sp = side === 0 ? st.spawn : st.spawnE;
      sd.ships.forEach((ship, i) => {
        const [x, y] = sp[i % sp.length];
        bodies.push(makeBody(ship, side, x, y, side === 0 ? 0 : Math.PI));
      });
    });
    this.W = makeWorld(st, bodies);
    this.W.ev = (type, d) => this.onEvent(type, d);
    this.first = cfg.mode === 'vs' ? (Math.random() < 0.5 ? 0 : 1) : 0;
    this.turn = this.first; this.round = 1;
    this.sel = [bodies.find((b) => b.side === 0), bodies.find((b) => b.side === 1)];
    this.spin = 0; this.drag = null; this.barDraft = null; this.active = null; this.ai = null; this.aiShow = null;
    this.kos = [[], []]; this.over = null; this.shake = 0; this.t = 0;
    this.phase = 'intro';
    this.introT = 0;
    FX.clear();
    this.fitCam();
    Input.onDown = (x, y) => this.pDown(x, y);
    Input.onMove = (x, y) => this.pMove(x, y);
    Input.onUp = (x, y, cancel) => this.pUp(x, y, cancel);
    Input.onCancel = () => this.cancelAction();
    G.mode = 'battle';
    UI.showHud(true);
    this.syncBar();
  },
  stop() {
    this.phase = 'off';
    Input.onDown = Input.onMove = Input.onUp = Input.onCancel = null;
    UI.showHud(false);
  },
  isHuman(side) { return !this.cfg.sides[side].ai; },
  humanTurn() { return this.isHuman(this.turn); },
  sideLabel(side) { return this.cfg.sides[side].label; },

  beginTurn(side) {
    this.turn = side;
    if (side === this.first && this.phase !== 'intro') this.round++;
    /* 自分のバリアは、自分の番が来るたびに1ターン減る */
    for (let i = this.W.bars.length - 1; i >= 0; i--) {
      const b = this.W.bars[i];
      if (b.side !== side) continue;
      b.turns--;
      if (b.turns <= 0) {
        this.W.bars.splice(i, 1);
        for (let k = 0; k <= 6; k++) FX.add({ x: lerp(b.x1, b.x2, k / 6), y: lerp(b.y1, b.y2, k / 6), kind: 'hex', col: side ? '#ff6a4a' : '#39d0ff', r: 8, grow: 20, life: 0.5, drag: 1 });
      }
    }
    if (this.round > 20 && side === this.first) { this.finish(this.judge()); return; }
    const mine = this.alive(side);
    if (!this.sel[side] || this.sel[side].out) this.sel[side] = mine[0];
    this.barUsed = false;
    this.spin = 0;
    this.active = null;
    if (this.isHuman(side)) {
      this.phase = 'aim';
      const who = this.cfg.mode === 'vs' ? `${this.sideLabel(side)}の番` : 'あなたの番';
      this.say(who, TEAM[side]);
    } else {
      this.phase = 'think';
      this.say(`${this.sideLabel(side)}の番`, TEAM[side]);
      this.startAI(side);
    }
    this.syncBar();
  },
  alive(side) { return this.W.bodies.filter((b) => b.side === side && !b.out && b.fall < 0); },
  say(text, col) { this.banner = { text, col, t: 0 }; },
  judge() {
    const a = this.alive(0).length, b = this.alive(1).length;
    return a > b ? 0 : b > a ? 1 : -1;
  },

  /* ------------------------------ 操作 ------------------------------ */
  pDown(sx, sy) {
    if (this.phase === 'move') {
      if (this.active && this.isHuman(this.active.side)) this.jet();
      return;
    }
    if (!this.humanTurn()) return;
    const [wx, wy] = this.toWorld(sx, sy);
    if (this.phase === 'barrier') {
      this.barDraft = { px: wx, py: wy, x1: wx, y1: wy, x2: wx, y2: wy, ok: false };
      this.updateDraft(sx, sy);
      return;
    }
    if (this.phase !== 'aim') return;
    let hit = null, best = Infinity;
    for (const b of this.alive(this.turn)) {
      const d = Math.hypot(b.x - wx, b.y - wy);
      if (d < Math.max(b.r * 1.5, 42 / this.cam.s) && d < best) { best = d; hit = b; }
    }
    if (hit && hit !== this.sel[this.turn]) { this.sel[this.turn] = hit; this.spin = clamp(this.spin, -hit.st.spinLv, hit.st.spinLv); Sfx.select(); this.syncBar(); }
    if (!this.sel[this.turn]) return;
    this.drag = { ox: sx, oy: sy, x: sx, y: sy };
  },
  pMove(sx, sy) {
    if (this.drag) { this.drag.x = sx; this.drag.y = sy; }
    if (this.barDraft) this.updateDraft(sx, sy);
  },
  pUp(sx, sy, cancel) {
    if (this.drag && this.phase !== 'aim') this.drag = null;
    if (this.barDraft && this.phase !== 'barrier') this.barDraft = null;
    if (this.drag) {
      this.drag.x = sx; this.drag.y = sy;
      const aim = this.aimOf(this.drag);
      this.drag = null;
      if (!cancel && aim.p >= 0.06) this.launch(this.sel[this.turn], aim.ang, aim.p, this.spin);
    }
    if (this.barDraft) {
      this.updateDraft(sx, sy);
      const d = this.barDraft;
      this.barDraft = null;
      if (cancel) return;
      if (!d.ok) { toast('船やカベに重ならない場所に置いてね', 'bad'); Sfx.bad(); return; }
      this.putBarrier(this.sel[this.turn], d.x1, d.y1, d.x2, d.y2);
    }
  },
  maxDrag() { return clamp(Math.min(G.W, G.H) * 0.3, 110, 220); },
  /* 引っぱった向きの反対へ飛ぶ。強さは画面上で引いた長さで決める。 */
  aimOf(d) {
    const len = Math.hypot(d.ox - d.x, d.oy - d.y);
    const [ax, ay] = this.toWorld(d.ox, d.oy), [bx, by] = this.toWorld(d.x, d.y);
    return { ang: Math.atan2(ay - by, ax - bx), p: clamp(len / this.maxDrag(), 0, 1) };
  },
  /* 押した点からなぞった向きに線を引く。ほとんど動かさなければ、
     船と押した点を結ぶ線に直角な向きで、押した点を真ん中にして置く。 */
  updateDraft(sx, sy) {
    const d = this.barDraft, b = this.sel[this.turn];
    const [wx, wy] = this.toWorld(sx, sy);
    const len = b.st.bar.len, L = Math.hypot(wx - d.px, wy - d.py);
    if (L < 24) {
      const ang = Math.atan2(d.py - b.y, d.px - b.x) + Math.PI / 2;
      [d.x1, d.y1, d.x2, d.y2] = barrierEnds(d.px, d.py, ang, len);
    } else {
      const k = Math.min(1, len / L);
      d.x1 = d.px; d.y1 = d.py; d.x2 = d.px + (wx - d.px) * k; d.y2 = d.py + (wy - d.py) * k;
    }
    d.ok = barrierFits(this.W, d.x1, d.y1, d.x2, d.y2);
  },
  toggleBarrier() {
    if (!this.humanTurn()) return;
    this.drag = null; this.barDraft = null;
    const b = this.sel[this.turn];
    if (this.phase === 'barrier') { this.phase = 'aim'; this.syncBar(); return; }
    if (this.phase !== 'aim' || !b || b.barLeft <= 0 || this.barUsed) { Sfx.bad(); return; }
    this.phase = 'barrier';
    Sfx.ui();
    this.syncBar();
  },
  cancelAction() {
    this.drag = null; this.barDraft = null;
    if (this.phase === 'barrier') { this.phase = 'aim'; this.syncBar(); }
  },
  putBarrier(b, x1, y1, x2, y2) {
    const bar = placeBarrier(this.W, b, x1, y1, x2, y2);
    this.barUsed = true;
    if (this.phase === 'barrier') this.phase = 'aim';
    Sfx.barrier();
    for (let k = 0; k <= 8; k++) FX.add({ x: lerp(x1, x2, k / 8), y: lerp(y1, y2, k / 8), kind: 'hex', col: TEAM[bar.side], r: 6, grow: 40, life: 0.6, drag: 1 });
    this.syncBar();
  },
  changeSpin(d) {
    const b = this.sel[this.turn];
    if (!b || !this.humanTurn() || (this.phase !== 'aim' && this.phase !== 'barrier')) return;
    const v = clamp(this.spin + d, -b.st.spinLv, b.st.spinLv);
    if (v === this.spin) { Sfx.bad(); return; }
    this.spin = v; Sfx.spin(d); this.syncBar();
  },
  cycleShip(i) {
    if (!this.humanTurn() || this.phase !== 'aim') return;
    const mine = this.alive(this.turn);
    const b = mine[i];
    if (!b) return;
    this.drag = null;
    this.sel[this.turn] = b; this.spin = clamp(this.spin, -b.st.spinLv, b.st.spinLv); Sfx.select(); this.syncBar();
  },
  jet() {
    const b = this.active;
    if (!b || this.phase !== 'move') return;
    if (fireJet(this.W, b)) this.syncBar();
  },

  launch(b, ang, p, spin) {
    launchBody(b, ang, p, spin);
    this.active = b;
    this.phase = 'move';
    this.acc = 0; this.moveSteps = 0;
    Sfx.launch(p);
    FX.ring(b.x, b.y, TEAM[b.side], b.r, 200, 0.35);
    FX.burst(b.x - Math.cos(ang) * b.r, b.y - Math.sin(ang) * b.r, 10, { dir: ang + Math.PI, spread: 0.5, col: TEAM[b.side], r: 3, spMin: 80, spMax: 260 });
    this.syncBar();
  },

  /* ------------------------------ 出来事 ------------------------------ */
  onEvent(type, d) {
    if (type === 'hit') {
      const s = d.s;
      Sfx.hit(s);
      d.a.flash = d.b.flash = clamp(s / 600, 0.3, 1);
      FX.burst(d.x, d.y, 6 + Math.round(clamp(s / 60, 0, 18)), { col: '#ffe9a0', r: 2.5, spMin: 80, spMax: 160 + s * 0.6, kind: 'line', lifeMin: 0.15, lifeMax: 0.45 });
      FX.ring(d.x, d.y, '#ffffff', 6, 120 + s * 0.4, 0.3);
      this.shake = Math.min(18, this.shake + s / 70);
      if (s > 650) FX.text(d.x, d.y - 30, s > 1000 ? 'ドカーン!!' : 'ドンッ!', s > 1000 ? '#ff9a3a' : '#ffe08a', s > 1000 ? 34 : 26);
    } else if (type === 'wall' || type === 'rock') {
      Sfx.wall(d.sp);
      if (d.sp > 150) FX.burst(d.x, d.y, 5, { col: '#c8d4e8', r: 2, spMin: 40, spMax: 160, kind: 'line', lifeMin: 0.1, lifeMax: 0.3 });
    } else if (type === 'bumper') {
      Sfx.bumper();
      FX.ring(d.r.x, d.r.y, '#ff3ad9', d.r.r, 220, 0.35);
      FX.burst(d.x, d.y, 10, { col: '#3affe0', r: 2.5, spMin: 120, spMax: 320 });
    } else if (type === 'bar') {
      Sfx.barrierHit();
      d.s.flash = 1;
      FX.burst(d.x, d.y, 8, { kind: 'hex', col: TEAM[d.s.side], r: 5, spMin: 40, spMax: 140, grow: 10, lifeMin: 0.2, lifeMax: 0.5 });
    } else if (type === 'jet') {
      Sfx.jet();
      const ang = Math.atan2(d.vy, d.vx);
      FX.burst(d.x - Math.cos(ang) * d.r, d.y - Math.sin(ang) * d.r, 22, { dir: ang + Math.PI, spread: 0.35, col: '#8fd8ff', r: 4, spMin: 160, spMax: 480, lifeMin: 0.2, lifeMax: 0.5 });
      FX.ring(d.x, d.y, '#8fd8ff', d.r, 300, 0.3);
      this.shake = Math.min(18, this.shake + 4);
    } else if (type === 'fall') {
      Sfx.fall();
    } else if (type === 'out') {
      Sfx.ko();
      FX.burst(d.x, d.y, 30, { col: '#ffb04a', r: 4, spMin: 60, spMax: 360, lifeMin: 0.3, lifeMax: 0.9 });
      FX.burst(d.x, d.y, 14, { col: d.col, r: 3, spMin: 40, spMax: 200, kind: 'line', lifeMin: 0.4, lifeMax: 1 });
      FX.ring(d.x, d.y, '#ffd28a', 10, 380, 0.6);
      FX.text(d.x, d.y, 'KO!', d.side === 0 ? '#7fd6ff' : '#ff8a6a', 40);
      this.shake = Math.min(22, this.shake + 12);
      this.kos[d.side].push(d);
      this.syncBar();
    }
  },

  /* ------------------------------ 更新 ------------------------------ */
  update(dt) {
    this.t += dt;
    if (this.banner) { this.banner.t += dt; if (!this.banner.big && this.banner.t > 1.2) this.banner = null; }
    if (Input.consume('pause') && this.phase !== 'over') { if (this.phase === 'barrier') this.cancelAction(); else UI.pause(); return; }
    if (this.humanTurn() && (this.phase === 'aim' || this.phase === 'barrier')) {
      if (Input.consume('spinL')) this.changeSpin(-1);
      if (Input.consume('spinR')) this.changeSpin(1);
      if (Input.consume('barrier')) this.toggleBarrier();
      for (let i = 0; i < 3; i++) if (Input.consume('ship' + (i + 1))) this.cycleShip(i);
    }
    if (this.phase === 'move' && this.active && this.isHuman(this.active.side) && Input.consume('jet')) this.jet();

    for (const b of this.W.bodies) {
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 3);
      if (this.phase !== 'move' && b.vis) { b.a += b.vis * dt; b.vis *= Math.pow(0.4, dt); if (Math.abs(b.vis) < 0.05) b.vis = 0; }
    }
    for (const bar of this.W.bars) if (bar.flash > 0) bar.flash = Math.max(0, bar.flash - dt * 3);

    if (this.phase === 'intro') {
      this.introT += dt;
      if (this.introT > 1.5) this.beginTurn(this.first);
    } else if (this.phase === 'wait') {
      this.waitT -= dt;
      if (this.waitT <= 0) this.beginTurn(1 - this.turn);
    } else if (this.phase === 'think') {
      this.thinkAI();
    } else if (this.phase === 'aiaim') {
      this.aiShow.t += dt;
      if (this.aiShow.t > 0.85) {
        const p = this.aiShow.plan;
        this.aiShow = null;
        this.launch(this.W.bodies[p.bi], p.ang, p.frac, p.spin);
        this.ai = { jetStep: p.jetStep };
      }
    } else if (this.phase === 'move') {
      this.acc += dt;
      while (this.acc >= PH.h && this.phase === 'move') {
        this.acc -= PH.h;
        if (this.ai && this.ai.jetStep && this.moveSteps === this.ai.jetStep) fireJet(this.W, this.active);
        stepWorld(this.W);
        this.moveSteps++;
        if ((this.moveSteps > 20 && allStopped(this.W)) || this.moveSteps >= PH.maxSteps) this.endMove();
      }
      for (const b of this.W.bodies) {
        if (b.out || b.fall >= 0) continue;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 260 && Math.random() < sp / 1400) FX.add({ x: b.x - b.vx * 0.02, y: b.y - b.vy * 0.02, col: TEAM[b.side], r: b.r * 0.35, life: 0.35, alpha: 0.5 });
      }
    }
    FX.update(dt);
    this.shake *= Math.pow(0.02, dt);
  },

  endMove() {
    for (const b of this.W.bodies) { b.vx = b.vy = 0; b.vis = b.w; b.w = 0; }
    this.ai = null;
    const a = this.alive(0).length, b = this.alive(1).length;
    if (a === 0 || b === 0) {
      const winner = a === 0 && b === 0 ? 1 - this.turn : a === 0 ? 1 : 0;
      this.finish(winner);
      return;
    }
    this.phase = 'wait';
    this.waitT = 0.35;
  },
  finish(winner) {
    this.phase = 'over';
    this.over = { winner, t: 0 };
    this.syncBar();
    if (winner === 0 || this.cfg.mode === 'vs') Sfx.win(); else Sfx.lose();
    const text = winner === -1 ? 'ひきわけ' : this.cfg.mode === 'vs' ? `${this.sideLabel(winner)}の勝ち!` : winner === 0 ? 'かち!' : 'まけ…';
    this.say(text, winner === -1 ? '#ffffff' : TEAM[Math.max(0, winner)]);
    this.banner.big = true;
    setTimeout(() => { if (this.phase === 'over') UI.battleOver(winner); }, 1700);
  },

  /* ------------------------------ AI ------------------------------ */
  startAI(side) {
    const lv = AI_LEVEL[this.cfg.sides[side].ai] || AI_LEVEL[1];
    const W = this.W, st = W.st;
    const mine = this.alive(side), foes = this.alive(1 - side);
    /* バリア: 落ちそうな味方がいれば、その船と落ちる場所の間に置く */
    let bar = null;
    const gen = mine.filter((b) => b.barLeft > 0)[0];
    if (gen && Math.random() < lv.barrier) {
      let worst = null;
      for (const m of mine) { const dg = dangerAt(st, m.x, m.y); if (dg.d < 130 && (!worst || dg.d < worst.dg.d)) worst = { m, dg }; }
      if (worst) {
        const { m, dg } = worst;
        const ang = Math.atan2(dg.py - m.y, dg.px - m.x);
        const off = Math.min(m.r + 24, Math.max(m.r + 12, dg.d - 6));
        const cx = m.x + Math.cos(ang) * off, cy = m.y + Math.sin(ang) * off;
        const ends = barrierEnds(cx, cy, ang + Math.PI / 2, gen.st.bar.len);
        if (barrierFits(W, ...ends)) bar = { gen, ends };
      }
    }
    const base = bar ? cloneWorld(W) : W;
    if (bar) base.bars.push({ x1: bar.ends[0], y1: bar.ends[1], x2: bar.ends[2], y2: bar.ends[3], side, bounce: bar.gen.st.bar.bounce });
    const cands = [];
    const idx = (b) => W.bodies.indexOf(b);
    for (let i = 0; i < lv.samples; i++) {
      const s = pick(mine), tg = pick(foes);
      const lvMax = s.st.spinLv;
      let ang;
      const mode = Math.random();
      if (mode < 0.5) {
        /* 相手を、いちばん近い落ちる場所へ押し出すように当てる */
        const dg = dangerAt(st, tg.x, tg.y);
        const pa = Math.atan2(dg.py - tg.y, dg.px - tg.x);
        const gx = tg.x - Math.cos(pa) * (tg.r + s.r) * 0.95, gy = tg.y - Math.sin(pa) * (tg.r + s.r) * 0.95;
        ang = Math.atan2(gy - s.y, gx - s.x) + rand(-0.06, 0.06);
      } else if (mode < 0.85) {
        ang = Math.atan2(tg.y - s.y, tg.x - s.x) + rand(-0.2, 0.2);
      } else ang = rand(TAU);
      cands.push({
        bi: idx(s), ang, frac: rand(0.35, 1),
        spin: Math.random() < 0.5 ? 0 : randi(-lvMax, lvMax),
        jetStep: s.jetLeft > 0 && Math.random() < 0.4 ? randi(15, 90) : 0,
      });
    }
    this.ai = { side, lv, cands, i: 0, best: null, bestScore: -Infinity, base, bar, t0: performance.now() };
  },
  thinkAI() {
    const A = this.ai;
    const t0 = performance.now();
    /* 強いAIほど、狙いが少しぶれたときの結果も見て、自分が落ちにくい打ち方を選ぶ */
    const offs = A.lv.noise < 0.1 ? [0, A.lv.noise, -A.lv.noise] : [0];
    while (A.i < A.cands.length && performance.now() - t0 < 9) {
      const plan = A.cands[A.i++];
      let sc = 0;
      for (const o of offs) {
        const R = simulateShot(A.base, Object.assign({}, plan, { ang: plan.ang + o }));
        sc += this.scoreAI(A.base, R, A.side, plan.bi);
      }
      sc = sc / offs.length + rand(0, 4);
      if (sc > A.bestScore) { A.bestScore = sc; A.best = plan; }
    }
    if (A.i < A.cands.length || performance.now() - A.t0 < 700) return;
    const p = Object.assign({}, A.best);
    p.ang += (Math.random() * 2 - 1) * A.lv.noise;
    p.frac = clamp(p.frac * (1 + (Math.random() * 2 - 1) * A.lv.noise * 0.6), 0.1, 1);
    if (A.bar) this.putBarrier(A.bar.gen, ...A.bar.ends);
    this.ai = null;
    this.sel[A.side] = this.W.bodies[p.bi];
    this.aiShow = { plan: p, t: 0 };
    this.phase = 'aiaim';
  },
  scoreAI(W0, R, side, shooter) {
    let s = 0;
    R.bodies.forEach((b, i) => {
      if (W0.bodies[i].out) return;
      if (b.out || b.fall >= 0) s += b.side === side ? -170 - (i === shooter ? 30 : 0) : 160;
      else {
        const d = dangerAt(R.st, b.x, b.y).d;
        if (b.side === side) s -= 45 * clamp(1 - d / 160, 0, 1);
        else s += 45 * clamp(1 - d / 220, 0, 1);
      }
    });
    return s;
  },

  /* ------------------------------ カメラ ------------------------------ */
  fitCam() {
    const st = this.W.st, b = st.box;
    const top = G.H < 450 ? 50 : 62, bottom = G.H < 450 ? 62 : G.H < 520 ? 84 : 112;
    const aw = G.W - 16, ah = G.H - top - bottom;
    const bw = b.x1 - b.x0 + 90, bh = b.y1 - b.y0 + 90;
    const rot = ah > aw * 1.1;
    const s = rot ? Math.min(aw / bh, ah / bw) : Math.min(aw / bw, ah / bh);
    this.cam = { s, rot, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, sx: G.W / 2, sy: top + ah / 2 };
  },
  toScreen(x, y) {
    const c = this.cam, dx = (x - c.cx) * c.s, dy = (y - c.cy) * c.s;
    return c.rot ? [c.sx + dy, c.sy - dx] : [c.sx + dx, c.sy + dy];
  },
  toWorld(px, py) {
    const c = this.cam, dx = (px - c.sx) / c.s, dy = (py - c.sy) / c.s;
    return c.rot ? [c.cx - dy, c.cy + dx] : [c.cx + dx, c.cy + dy];
  },

  /* ------------------------------ 描画 ------------------------------ */
  draw(ctx) {
    const W = this.W, st = W.st, t = G.time, c = this.cam;
    drawBackground(ctx, st.theme, t, G.W, G.H);
    ctx.save();
    const sh = this.shake;
    ctx.translate(c.sx + (Math.random() - 0.5) * sh, c.sy + (Math.random() - 0.5) * sh);
    if (c.rot) ctx.rotate(-Math.PI / 2);
    ctx.scale(c.s, c.s);
    ctx.translate(-c.cx, -c.cy);

    drawStage(ctx, st, t);
    if (st.theme === 'hangar') drawCrates(ctx, st);
    for (const bar of W.bars) drawBarrier(ctx, bar, t, false);

    const sel = this.sel[this.turn];
    const showSel = sel && !sel.out && (this.phase === 'aim' || this.phase === 'barrier' || this.phase === 'aiaim');
    /* 落ちていく船は下に、ふつうの船は上に */
    const order = W.bodies.filter((b) => !b.out).sort((a, b) => (b.fall >= 0) - (a.fall >= 0));
    for (const b of order) this.drawBody(ctx, b, t, showSel && b === sel);
    if (this.phase === 'aim' && this.drag && sel) this.drawAim(ctx, sel, this.aimOf(this.drag), this.spin, true);
    if (this.phase === 'aiaim' && this.aiShow) {
      const p = this.aiShow.plan, b = W.bodies[p.bi];
      this.drawAim(ctx, b, { ang: p.ang, p: p.frac * easeOut(this.aiShow.t / 0.7) }, p.spin, false);
    }
    if (this.barDraft) drawBarrier(ctx, Object.assign({ side: this.turn, ur: sel && sel.st.bar && sel.st.bar.bounce > 1 }, this.barDraft), t, true);
    if (this.barDraft && !this.barDraft.ok) {
      const d = this.barDraft;
      ctx.strokeStyle = 'rgba(255,60,60,0.9)'; ctx.lineWidth = 4; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(d.x1, d.y1); ctx.lineTo(d.x2, d.y2); ctx.stroke(); ctx.setLineDash([]);
    }
    FX.draw(ctx);
    ctx.restore();
    FX.drawTexts(ctx, (x, y) => this.toScreen(x, y));
    this.drawHud(ctx);
  },

  drawBody(ctx, b, t, selected) {
    ctx.save();
    ctx.translate(b.x, b.y);
    let k = 1;
    if (b.fall >= 0) {
      k = 1 - b.fall / PH.fallTime;
      ctx.globalAlpha = clamp(k * 1.3, 0, 1);
      ctx.scale(0.3 + 0.7 * k, 0.3 + 0.7 * k);
    } else {
      teamRing(ctx, b.r, b.side, t);
    }
    if (selected) {
      const p = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + p * 0.5})`; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.arc(0, 0, b.r * 1.45 + p * 3, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
    if (b.jetT > 0 && b.fall < 0) {
      const sp = Math.hypot(b.vx, b.vy) || 1, ux = -b.vx / sp, uy = -b.vy / sp;
      const L = b.r * (2.2 + Math.random() * 0.8) * clamp(b.jetT / 0.5 + 0.3, 0, 1);
      const g = ctx.createLinearGradient(0, 0, ux * L, uy * L);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.3, 'rgba(140,220,255,0.8)'); g.addColorStop(1, 'rgba(80,140,255,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-uy * b.r * 0.7, ux * b.r * 0.7); ctx.lineTo(ux * L, uy * L); ctx.lineTo(uy * b.r * 0.7, -ux * b.r * 0.7); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.rotate(b.a);
    drawShip(ctx, b.ship, { t });
    if (b.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.55})`;
      ctx.beginPath(); ctx.arc(0, 0, b.r * 1.05, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  },

  /* 狙いの表示: 進む向きの矢印と、回転で曲がる道すじを途中まで */
  drawAim(ctx, b, aim, spin, human) {
    const col = TEAM[b.side];
    const ghost = makeBody(b.ship, b.side, b.x, b.y, aim.ang);
    const Wg = { st: Object.assign({}, this.W.st, { rocks: [], walls: [], holes: [], rings: [polyRect(-1e5, -1e5, 1e5, 1e5)], gravity: null }), bodies: [ghost], bars: [], steps: 0, ev: null };
    launchBody(ghost, aim.ang, aim.p, spin);
    const pts = [];
    for (let s = 0; s < 150 && (ghost.vx || ghost.vy); s++) { stepWorld(Wg); if (s % 6 === 0) pts.push([ghost.x, ghost.y]); }
    const show = Math.min(pts.length, Math.max(3, Math.floor(pts.length * (human ? 0.5 : 0.35))));
    for (let i = 0; i < show; i++) {
      const [x, y] = pts[i];
      ctx.fillStyle = rgba(col, 0.9 * (1 - i / show));
      ctx.beginPath(); ctx.arc(x, y, 4.5 - (i / show) * 2.5, 0, TAU); ctx.fill();
    }
    /* 引っぱっているゴム（うしろ側） */
    const back = 30 + aim.p * 70;
    ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - Math.cos(aim.ang) * (b.r + back), b.y - Math.sin(aim.ang) * (b.r + back)); ctx.stroke();
    /* 力のメーター（船のまわりの弧） */
    const pc = aim.p < 0.5 ? '#7ee39b' : aim.p < 0.85 ? '#ffd23a' : '#ff5a4a';
    ctx.strokeStyle = pc; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 16, aim.ang - Math.PI * aim.p, aim.ang + Math.PI * aim.p); ctx.stroke();
    const ax = b.x + Math.cos(aim.ang) * (b.r + 30), ay = b.y + Math.sin(aim.ang) * (b.r + 30);
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(aim.ang);
    ctx.fillStyle = pc; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -10); ctx.lineTo(-6, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  drawHud(ctx) {
    const W = G.W;
    const small = W < 600;
    /* 上: 両チームの船（落とされた船は×） */
    for (let side = 0; side < 2; side++) {
      const ships = this.W.bodies.filter((b) => b.side === side);
      const sz = small ? 26 : 34, gap = 4;
      const total = ships.length * (sz + gap);
      let x = side === 0 ? 58 : W - 10 - total;
      const y = 10;
      ctx.font = `800 ${small ? 11 : 12}px ${FONT}`; ctx.textBaseline = 'top';
      ctx.textAlign = side === 0 ? 'left' : 'right';
      ctx.fillStyle = TEAM[side];
      ctx.fillText(this.sideLabel(side), side === 0 ? 58 : W - 10, y + sz + 4);
      for (const b of ships) {
        ctx.save();
        ctx.translate(x + sz / 2, y + sz / 2);
        ctx.fillStyle = 'rgba(8,12,24,0.75)'; ctx.beginPath(); ctx.arc(0, 0, sz / 2, 0, TAU); ctx.fill();
        ctx.strokeStyle = b.out ? 'rgba(255,255,255,0.15)' : rgba(TEAM[side], b === this.sel[side] && side === this.turn ? 1 : 0.5);
        ctx.lineWidth = 2; ctx.stroke();
        ctx.globalAlpha = b.out ? 0.3 : 1;
        const hl = HULLS[b.hull];
        ctx.rotate(-Math.PI / 2); ctx.scale((sz * 0.36) / hl.r, (sz * 0.36) / hl.r);
        drawShip(ctx, b.ship, { t: G.time });
        ctx.restore();
        if (b.out) {
          ctx.strokeStyle = '#ff4a5a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x + 7, y + 7); ctx.lineTo(x + sz - 7, y + sz - 7); ctx.moveTo(x + sz - 7, y + 7); ctx.lineTo(x + 7, y + sz - 7); ctx.stroke();
        }
        x += sz + gap;
      }
    }
    /* 中央: ラウンドと手番 */
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `800 ${small ? 11 : 12}px ${FONT}`; ctx.fillStyle = 'rgba(220,230,255,0.75)';
    ctx.fillText(`ラウンド ${this.round}`, W / 2, 8);
    if (this.phase !== 'intro' && this.phase !== 'over') {
      ctx.font = `900 ${small ? 14 : 17}px ${FONT}`; ctx.fillStyle = TEAM[this.turn];
      const who = this.humanTurn() ? (this.cfg.mode === 'vs' ? `${this.sideLabel(this.turn)}の番` : 'あなたの番') : `${this.sideLabel(this.turn)}の番`;
      ctx.fillText(this.phase === 'think' ? who + ' …考え中' + '.'.repeat(Math.floor(G.time * 3) % 3) : who, W / 2, 24);
    }
    /* はじまりの表示 */
    if (this.phase === 'intro') {
      const k = clamp(this.introT / 0.3, 0, 1) * clamp((1.5 - this.introT) / 0.3, 0, 1);
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, G.H / 2 - 70, W, 140);
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${small ? 26 : 40}px ${FONT}`; ctx.fillStyle = '#ffffff';
      ctx.fillText(this.cfg.title || this.W.st.name, W / 2, G.H / 2 - 16);
      ctx.font = `700 ${small ? 13 : 16}px ${FONT}`; ctx.fillStyle = '#9fd8ff';
      ctx.fillText(this.W.st.desc, W / 2, G.H / 2 + 26);
      if (this.cfg.mode === 'vs') { ctx.fillStyle = TEAM[this.first]; ctx.fillText(`先攻は ${this.sideLabel(this.first)}`, W / 2, G.H / 2 + 52); }
      ctx.globalAlpha = 1;
    }
    /* 大きな文字のお知らせ */
    if (this.banner && this.phase !== 'intro') {
      const bn = this.banner, big = bn.big;
      const k = clamp(bn.t / 0.15, 0, 1) * (big ? 1 : clamp((1.2 - bn.t) / 0.3, 0, 1));
      ctx.globalAlpha = k;
      ctx.textBaseline = 'middle';
      const size = big ? (small ? 46 : 72) : (small ? 22 : 30);
      ctx.font = `900 ${Math.round(size * (0.8 + 0.2 * k))}px ${FONT}`;
      ctx.lineWidth = big ? 10 : 6; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      const y = big ? G.H * 0.42 : G.H * 0.2 + 30;
      ctx.strokeText(bn.text, W / 2, y);
      ctx.fillStyle = bn.col; ctx.fillText(bn.text, W / 2, y);
      ctx.globalAlpha = 1;
    }
  },

  /* 下の操作バー（DOM）を今の状態に合わせる */
  syncBar() {
    const bar = el('actBar');
    if (!bar || !this.W) return;
    const human = this.humanTurn();
    const sel = this.sel[this.turn];
    const showAim = human && sel && (this.phase === 'aim' || this.phase === 'barrier');
    const showMove = this.phase === 'move' && this.active && this.isHuman(this.active.side);
    bar.classList.toggle('hidden', !(showAim || showMove));
    bar.style.setProperty('--team', TEAM[this.turn]);
    const b = showMove ? this.active : sel;
    if (!b) return;
    el('abName').textContent = b.name;
    el('abHull').textContent = HULLS[b.hull].name;
    const sv = this.spin;
    el('spinVal').innerHTML = sv === 0 ? '回転なし' : `${sv < 0 ? '⟲ 左' : '⟳ 右'}<b>${Math.abs(sv)}</b>`;
    el('spinBox').classList.toggle('hidden', !showAim);
    el('spinMax').textContent = `最大 ${b.st.spinLv}`;
    const bb = el('btnBarrier');
    bb.classList.toggle('hidden', !showAim || !b.st.bar);
    bb.classList.toggle('on', this.phase === 'barrier');
    bb.disabled = !(b.barLeft > 0 && !this.barUsed);
    el('barLeft').textContent = b.barLeft;
    const jb = el('btnJet');
    jb.classList.toggle('hidden', !showMove || !b.st.jetUses);
    jb.disabled = !showMove || b.jetLeft <= 0;
    el('jetLeft').textContent = b.jetLeft;
    el('abHint').textContent = showMove
      ? (b.jetLeft > 0 ? '画面をタップするとジェット加速！' : '')
      : this.phase === 'barrier'
        ? 'なぞってバリアの線を引こう（タップでも置ける）'
        : document.body.classList.contains('touch') ? '船をうしろに引っぱって、はなすと発射！' : '船をうしろに引っぱって、はなすと発射！（Q/E で回転）';
  },
};
