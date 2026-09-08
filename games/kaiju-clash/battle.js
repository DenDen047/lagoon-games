/* =========================================================================
   KAIJU CLASH ― たたかい
   物理、技の判定、建物の巻き添え、カメラ、ラウンドの進行。
   ========================================================================= */
'use strict';

const GRAVITY = 0.78;
const GROUND_FRICTION = 0.76;
const AIR_FRICTION = 0.985;
const ROUND_SECONDS = 99;
const SPECIAL_COOLDOWN = 42;

function emptyInput() {
  return { left: false, right: false, up: false, down: false, light: false, heavy: false, special: false, super: false };
}

function makeFighter(kdata, side, mods) {
  const k = Object.assign({}, kdata);
  if (mods && mods.colors) k.colors = Object.assign({}, kdata.colors, mods.colors);
  if (mods && mods.name) { k.name = mods.name; k.en = mods.en || kdata.en; }
  const f = {
    k, side, base: kdata,
    ctrl: 'human',
    x: side === 0 ? -320 : 320, y: 0, vx: 0, vy: 0,
    facing: side === 0 ? 1 : -1,
    groundY: 0, onGround: true, jumps: 0,
    maxHp: Math.round(kdata.hp * ((mods && mods.hpMul) || 1)),
    hp: 0, gauge: 0,
    powerMul: (mods && mods.powerMul) || 1,
    speedMul: (mods && mods.speedMul) || 1,
    state: 'idle', stateT: 0, act: null, stun: 0, hitFlash: 0,
    walkPhase: 0, invuln: 0, armor: 0, cool: 0, slow: 0, blind: 0,
    combo: 0, comboT: 0, wins: 0,
    in: emptyInput(), prev: emptyInput(),
    ai: null, pose: null, stepSound: 0,
  };
  f.hp = f.maxHp;
  return f;
}

const Battle = {
  active: false,
  fighters: [],
  stage: null,
  shots: [], zones: [], fx: [],
  cam: { x: 0, y: 0, z: 0.7 },
  shakeAmt: 0,
  timer: 0, round: 1, phase: 'intro', phaseT: 0,
  cfg: null, hitstop: 0,
  superFlash: 0,
  paused: false,

  /* ------------------------------ 開始 ------------------------------ */
  start(cfg) {
    this.cfg = cfg;
    const k1 = KAIJU_BY_ID[cfg.p1];
    let f2mods = null;
    let k2 = KAIJU_BY_ID[cfg.p2];
    if (cfg.boss) {
      k2 = KAIJU_BY_ID[BOSS.base];
      f2mods = { colors: BOSS.colors, name: BOSS.name, en: BOSS.en, hpMul: BOSS.hpMul, powerMul: BOSS.powerMul, speedMul: BOSS.speedMul };
    }
    this.fighters = [makeFighter(k1, 0), makeFighter(k2, 1, f2mods)];
    this.fighters[0].ctrl = 'human';
    this.fighters[1].ctrl = cfg.p2human ? 'human' : 'cpu';
    if (cfg.mode === 'practice') this.fighters[1].ctrl = cfg.dummy ? 'dummy' : 'cpu';
    if (this.fighters[1].ctrl === 'cpu') this.fighters[1].ai = makeAI(this.fighters[1], cfg.difficulty != null ? cfg.difficulty : G.difficulty, cfg.boss ? 1 : 0);
    if (cfg.mode !== 'versus' && G.difficulty === 0) this.fighters[0].maxHp = Math.round(this.fighters[0].maxHp * 1.15);
    this.fighters[0].hp = this.fighters[0].maxHp;

    this.stage = buildStage(STAGE_BY_ID[cfg.stage] || STAGES[0], (cfg.seed || Date.now()) & 0xffff);
    this.shots = []; this.zones = []; this.fx = [];
    this.round = 1;
    this.fighters.forEach((f) => { f.wins = 0; });
    this.resetRound();
    this.active = true;
    this.paused = false;
  },

  resetRound() {
    const [a, b] = this.fighters;
    [a, b].forEach((f, i) => {
      f.x = i === 0 ? -300 : 300;
      f.y = 0; f.vx = 0; f.vy = 0;
      f.facing = i === 0 ? 1 : -1;
      f.hp = f.maxHp; f.gauge = 0;
      f.state = 'idle'; f.stateT = 0; f.act = null; f.stun = 0;
      f.onGround = true; f.jumps = 0; f.invuln = 30; f.armor = 0;
      f.cool = 0; f.slow = 0; f.blind = 0; f.combo = 0; f.hitFlash = 0;
      f.in = emptyInput(); f.prev = emptyInput();
      if (f.ai) f.ai.reset();
    });
    this.shots = []; this.zones = []; this.fx = [];
    this.timer = ROUND_SECONDS * 60;
    this.phase = 'intro'; this.phaseT = 0;
    this.cam.x = 0; this.cam.y = 0; this.cam.z = 0.62;
    this.hitstop = 0;
    banner('ROUND ' + this.round, 1100, 'round');
    Sound.bell();
  },

  foeOf(f) { return this.fighters[1 - f.side]; },

  shake(a) { this.shakeAmt = Math.min(34, this.shakeAmt + a); },

  /* ------------------------------ 1 フレーム ------------------------------ */
  update() {
    if (!this.active || this.paused) return;
    const [a, b] = this.fighters;

    this.phaseT++;
    if (this.phase === 'intro') {
      if (this.phaseT === 70) banner('FIGHT!', 800, 'fight');
      if (this.phaseT > 100) { this.phase = 'fight'; this.phaseT = 0; }
    }

    if (this.superFlash > 0) this.superFlash--;

    /* ヒットストップ中は時間が止まる */
    if (this.hitstop > 0) {
      this.hitstop--;
      this.updateCamera();
      this.decayShake();
      return;
    }

    /* 練習は時間切れにしない */
    if (this.phase === 'fight' && this.cfg.mode !== 'practice') {
      this.timer--;
      if (this.timer <= 0) this.timeUp();
    }

    /* 入力を集める */
    [a, b].forEach((f) => {
      f.prev = f.in;
      if (f.ctrl === 'human') f.in = Input.forSide(f.side);
      else if (f.ctrl === 'cpu' && f.ai) f.in = f.ai.think(this);
      else f.in = emptyInput();
      if (this.phase !== 'fight') f.in = emptyInput();
    });

    [a, b].forEach((f) => this.updateFighter(f));
    this.separate(a, b);

    FX.updateShots(this);
    FX.updateZones(this);
    FX.updateFx(this);
    updateStage(this.stage, 1);

    /* コンボ表示の寿命 */
    [a, b].forEach((f) => { if (f.comboT > 0) { f.comboT--; if (f.comboT === 0) f.combo = 0; } });

    this.updateCamera();
    this.decayShake();

    if (this.phase === 'ko') {
      if (this.phaseT > 170) this.afterRound();
    }
  },

  decayShake() {
    this.shakeAmt *= 0.88;
    if (this.shakeAmt < 0.3) this.shakeAmt = 0;
    View.shakeX = rand(this.shakeAmt, -this.shakeAmt);
    View.shakeY = rand(this.shakeAmt, -this.shakeAmt) * 0.7;
  },

  /* ------------------------------ 怪獣 1 体 ------------------------------ */
  updateFighter(f) {
    f.stateT++;
    if (f.hitFlash > 0) f.hitFlash--;
    if (f.invuln > 0) f.invuln--;
    if (f.cool > 0) f.cool--;
    if (f.slow > 0) f.slow--;
    if (f.blind > 0) f.blind--;

    const foe = this.foeOf(f);
    const inp = f.in;
    const canAct = f.stun <= 0 && f.state !== 'ko' && f.state !== 'down' && f.state !== 'win' && this.phase === 'fight';

    if (f.stun > 0) {
      f.stun--;
      if (f.stun === 0 && f.state === 'hurt') this.setState(f, f.onGround ? 'idle' : 'idle');
    }

    /* 向き。技の最中は変えない */
    if (canAct && !f.act && f.onGround) f.facing = foe.x >= f.x ? 1 : -1;

    /* --- 技を出す --- */
    if (canAct && !f.act) {
      const pressed = (key) => inp[key] && !f.prev[key];
      if (pressed('super') && f.gauge >= 100) this.startAct(f, 'super');
      else if (pressed('special') && f.cool <= 0) this.startAct(f, 'special');
      else if (pressed('heavy')) this.startAct(f, f.onGround ? 'heavy' : 'air');
      else if (pressed('light')) this.startAct(f, f.onGround ? 'light' : 'air');
    }

    /* --- 移動 --- */
    const slowMul = f.slow > 0 ? 0.55 : 1;
    const speed = f.k.speed * f.speedMul * slowMul;
    let guarding = false;
    if (canAct && !f.act) {
      if (f.onGround && inp.down) {
        guarding = true;
        this.setState(f, 'guard');
        f.vx *= 0.6;
      } else {
        let dir = 0;
        if (inp.left) dir -= 1;
        if (inp.right) dir += 1;
        if (dir !== 0) {
          f.vx = lerp(f.vx, dir * speed, f.onGround ? 0.3 : 0.12);
          if (f.onGround) {
            this.setState(f, 'walk');
            f.walkPhase += 0.16 * (Math.abs(f.vx) / Math.max(1, speed)) + 0.03;
            const ph = Math.sin(f.walkPhase);
            if (ph * f.stepSound < 0) { f.stepSound = ph; Sound.step(); FX.dust(this, f.x, 2); }
            else f.stepSound = ph;
          }
        } else if (f.onGround) {
          this.setState(f, 'idle');
        }
        /* ジャンプ */
        const maxJumps = f.k.flyer ? 2 : 1;
        if (inp.up && !f.prev.up && f.jumps < maxJumps) {
          f.vy = f.k.jump * (f.jumps === 0 ? 1 : 0.86);
          f.jumps++;
          f.onGround = false;
          if (f.jumps > 1) FX.burst(this, f.x, f.y + f.k.size * 0.3, 26, rgba(f.k.colors.accent, 0.9));
          Sound.swing();
        }
      }
    }
    if (!f.onGround && f.k.flyer && inp.up && f.vy < 0) f.vy += 0.34;   /* ふわりと落ちる */

    /* --- 技の進行 --- */
    if (f.act) this.updateAct(f);

    /* --- 物理 --- */
    f.vy -= GRAVITY * (f.k.flyer && !f.onGround ? 0.82 : 1);
    f.x += f.vx;
    f.y += f.vy;
    if (f.onGround || f.state === 'guard') f.vx *= GROUND_FRICTION;
    else f.vx *= AIR_FRICTION;

    if (f.y <= 0) {
      const wasAir = !f.onGround;
      f.y = 0;
      if (wasAir && f.vy < -8) { FX.dust(this, f.x, 6); this.shake(Math.min(8, -f.vy * 0.4)); Sound.step(); }
      f.vy = 0;
      f.onGround = true;
      f.jumps = 0;
      if (f.state === 'hurt' && f.stun > 4) { this.setState(f, 'down'); f.stun = Math.max(f.stun, 34); f.invuln = 40; }
      if (f.act && f.act.key === 'air') { f.act = null; }
    } else {
      f.onGround = false;
    }

    /* 端 */
    const lim = WORLD_W / 2 - 60;
    if (f.x < -lim) { f.x = -lim; if (f.vx < -3) { this.shake(5); FX.dust(this, f.x, 4); } f.vx = Math.max(0, f.vx * -0.3); }
    if (f.x > lim) { f.x = lim; if (f.vx > 3) { this.shake(5); FX.dust(this, f.x, 4); } f.vx = Math.min(0, f.vx * -0.3); }

    /* 立っているだけで街は壊れる */
    if (f.onGround && Math.abs(f.vx) > 0.6 && this.phase === 'fight') {
      hitBuildings(this.stage, f.x - f.k.size * 0.3, f.x + f.k.size * 0.3, 0, f.k.size * 0.2, 1.6, sign(f.vx));
    }
    /* ふっとばされた体が建物をなぎ倒す */
    if (Math.abs(f.vx) > 9 && f.state === 'hurt') {
      if (hitBuildings(this.stage, f.x - f.k.size * 0.35, f.x + f.k.size * 0.35, f.y, f.y + f.k.size * 0.9, 90, sign(f.vx))) {
        this.shake(7);
      }
    }

    if (f.state === 'down' && f.stun <= 0) this.setState(f, 'idle');
    if (!f.onGround && f.state !== 'hurt' && f.state !== 'ko') {
      if (f.state === 'guard' || f.state === 'walk') this.setState(f, 'idle');
    }
    f.pose = computePose(f, this.stage.t);
  },

  setState(f, s) {
    if (f.state === s) return;
    if (f.state === 'ko' || f.state === 'win') return;
    f.state = s; f.stateT = 0;
  },

  /* ------------------------------ 技 ------------------------------ */
  startAct(f, key) {
    const def = f.k.moves[key];
    if (!def) return;
    f.act = { key, def, frame: 0, hitDone: false, lastHit: -99, wave: 0, shellT: 0 };
    this.setState(f, 'idle');
    if (key === 'special') f.cool = SPECIAL_COOLDOWN;
    if (key === 'super') {
      f.gauge = 0;
      this.superFlash = 26;
      this.hitstop = 16;
      banner(def.name, 1100, 'super');
      Sound.roar();
      f.invuln = Math.max(f.invuln, def.startup + 6);
    } else if (key === 'special') {
      Sound.charge();
    } else {
      Sound.swing();
    }
    if (def.step && f.onGround) f.vx += f.facing * def.step * 0.25;
  },

  updateAct(f) {
    const a = f.act, d = a.def;
    const s = d.startup, ac = d.active, rec = d.recovery;
    a.frame++;
    const foe = this.foeOf(f);

    /* active に入った瞬間 */
    if (a.frame === s + 1) {
      if (d.type === 'shot') { FX.spawnShots(this, f, d, 0); a.wave = 1; }
      else if (d.type === 'cloud' || d.type === 'storm' || d.type === 'vortex' || d.type === 'pillar') FX.spawnZone(this, f, d);
      else if (d.type === 'beam' || d.type === 'barrage') Sound.beam();
      else if (d.type === 'dash') {
        f.vx = f.facing * d.dash.speed;
        f.armor = d.dash.armor;
        Sound.heavy();
      } else if (d.type === 'rush') {
        Sound.roar();
      }
      if (d.step && f.onGround) f.vx += f.facing * d.step * 0.5;
      if (d.quake) FX.quake(this, f.x + f.facing * 60, 1);
    }

    const inActive = a.frame > s && a.frame <= s + ac;

    if (inActive) {
      /* 弾の連射 */
      const sh = d.shot;
      if (sh && sh.waves && a.wave < sh.waves && (a.frame - s) % sh.interval === 0) {
        FX.spawnShots(this, f, d, a.wave); a.wave++;
      }
      /* 全砲門 */
      if (d.type === 'barrage') {
        const bd = d.barrage;
        if (a.shellT < bd.shells && (a.frame - s) % bd.interval === 0) {
          a.shellT++;
          const m = FX.muzzle(f, 150);
          const tx = foe.x + rand(150, -150);
          const dx = tx - m.x, dy = (foe.y + 40) - m.y;
          const dist = Math.hypot(dx, dy) || 1;
          this.shots.push({
            x: m.x, y: m.y, vx: dx / dist * 12, vy: dy / dist * 12, g: 0,
            r: 14, life: 90, col: bd.color, trail: '#ffe0c0', kind: 'missile',
            spin: 0, a: 0, homing: 0.05, owner: f.side, dmg: d.dmg, def: d, t: 0,
          });
          Sound.shot();
        }
      }
      /* 光線 */
      if (d.beam) {
        const prog = (a.frame - s) / ac;
        const from = d.beamFrom || 0;
        if (prog >= from && a.frame - a.lastHit >= (d.tick || 4)) {
          const m = FX.muzzle(f, d.beam.y);
          const x0 = f.facing > 0 ? m.x : m.x - d.beam.len;
          const x1 = f.facing > 0 ? m.x + d.beam.len : m.x;
          const y0 = m.y - d.beam.thick * 1.1, y1 = m.y + d.beam.thick * 1.1;
          if (this.overlapFighter(foe, x0, x1, y0, y1)) {
            a.lastHit = a.frame;
            this.applyHit(f, foe, d, clamp(foe.x, x0, x1), m.y, { beam: true });
          }
          hitBuildings(this.stage, x0, x1, y0 - 40, y1, 22, f.facing);
          if (a.frame % 3 === 0) this.shake(2.4);
        }
      }
      /* 突進 */
      if (d.type === 'dash') {
        f.vx = f.facing * d.dash.speed;
        const b = d.dash.box;
        const r = this.boxOf(f, b);
        if (a.frame - a.lastHit >= (d.tick || 12) && this.overlapFighter(foe, r.x0, r.x1, r.y0, r.y1)) {
          a.lastHit = a.frame;
          this.applyHit(f, foe, d, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, {});
          if (d.dash.bounce) f.vx = -f.facing * 4;
        }
        hitBuildings(this.stage, r.x0, r.x1, r.y0, r.y1, 40, f.facing);
        if (a.frame % 4 === 0) FX.dust(this, f.x, 2);
        if (d.dash.flame && a.frame % 3 === 0) {
          this.fx.push({ kind: 'puff', x: f.x - f.facing * 40, y: f.y + 40, r: 24, life: 16, max: 16, col: '#ff9a3c' });
        }
      }
      /* 乱打 */
      if (d.type === 'rush') {
        const rd = d.rush;
        const near = Math.abs(foe.x - f.x) < rd.reach + foe.k.size * 0.3;
        if (near && a.frame - a.lastHit >= (d.tick || 6) && a.frame < s + ac - 12) {
          a.lastHit = a.frame;
          this.applyHit(f, foe, d, (f.x + foe.x) / 2, f.y + f.k.size * 0.5, { light: true });
        }
        if (a.frame === s + ac - 6) {
          const fin = Object.assign({}, d, { dmg: rd.finishDmg, kb: rd.finishKb, lift: rd.finishLift, stun: 34 });
          if (near) this.applyHit(f, foe, fin, (f.x + foe.x) / 2, f.y + f.k.size * 0.5, {});
          FX.quake(this, f.x + f.facing * 70, 1.4);
          Sound.heavy();
        }
        if (a.frame % 5 === 0) f.vx += f.facing * 1.2;
      }
      /* 噴火 */
      if (d.type === 'rain' && (a.frame - s) % d.rain.interval === 0 && a.shellT < d.rain.count) {
        a.shellT++;
        FX.spawnRain(this, f, d);
      }
      /* ふつうの打撃 */
      if (d.box && !a.hitDone) {
        const r = this.boxOf(f, d.box);
        if (this.overlapFighter(foe, r.x0, r.x1, r.y0, r.y1)) {
          a.hitDone = true;
          this.applyHit(f, foe, d, clamp(foe.x, r.x0, r.x1), (r.y0 + r.y1) / 2, {});
        }
        if (hitBuildings(this.stage, r.x0, r.x1, r.y0, r.y1, d.dmg * 1.6, f.facing)) this.shake(4);
      }
    }

    if (a.frame >= s + ac + rec) {
      f.act = null;
      f.armor = 0;
    }
  },

  boxOf(f, b) {
    const cx = f.x + f.facing * b.x;
    const cy = f.y + b.y;
    return { x0: cx - b.w / 2, x1: cx + b.w / 2, y0: cy - b.h / 2, y1: cy + b.h / 2 };
  },

  bodyOf(f) {
    const w = f.k.size * 0.3;
    return { x0: f.x - w, x1: f.x + w, y0: f.y, y1: f.y + f.k.size * 0.92 };
  },

  overlapFighter(f, x0, x1, y0, y1) {
    const b = this.bodyOf(f);
    return !(x1 < b.x0 || x0 > b.x1 || y1 < b.y0 || y0 > b.y1);
  },

  /* ------------------------------ 当たった ------------------------------ */
  applyHit(att, def, move, hx, hy, opt) {
    if (def.state === 'ko' || this.phase !== 'fight') return;
    if (def.invuln > 0 && !opt.zone && !opt.beam) return;

    const facingRight = def.facing > 0;
    const fromFront = (att.x > def.x) === facingRight;
    const guarding = def.state === 'guard' && def.onGround && fromFront && !opt.zone;

    let dmg = move.dmg * att.powerMul / def.k.defense;
    if (guarding) {
      dmg = move.chip;
      def.stun = Math.max(def.stun, Math.round(move.stun * 0.55));
      def.vx += sign(def.x - att.x) * move.kb * 0.5;
      Sound.guard();
      FX.hit(this, hx, hy, 20, '#bfe8ff');
      this.hitstop = Math.max(this.hitstop, 3);
      att.gauge = Math.min(100, att.gauge + move.gauge * 0.5);
      def.gauge = Math.min(100, def.gauge + move.gauge * 0.7);
    } else {
      if (def.armor > 0 && move.dmg < 70) {
        dmg *= 0.6;
        def.hitFlash = 6;
      } else {
        def.stun = Math.max(def.stun, move.stun);
        this.setState(def, 'hurt');
        def.stateT = 0;
        def.act = null;
        def.vx = (def.x < att.x ? -1 : 1) * move.kb * (1 / (0.7 + def.k.weight * 0.3));
        if (move.lift) {
          def.vy = move.lift * (1 / (0.7 + def.k.weight * 0.3));
          def.onGround = false;
        }
        def.facing = att.x > def.x ? 1 : -1;
      }
      def.hitFlash = 8;
      const heavy = move.dmg >= 70;
      this.hitstop = Math.max(this.hitstop, heavy ? 9 : 5);
      this.shake(heavy ? 11 : 5);
      FX.hit(this, hx, hy, move.dmg, heavy ? '#ffd05a' : '#fff2b0');
      if (heavy) Sound.heavy(); else Sound.punch();
      att.gauge = Math.min(100, att.gauge + move.gauge);
      def.gauge = Math.min(100, def.gauge + move.gauge * 0.6);
      att.combo++;
      att.comboT = 90;
      if (att.combo > G.bestChain) G.bestChain = att.combo;
    }

    def.hp -= dmg;
    if (def.hp <= 0) {
      if (this.cfg.mode === 'practice') {
        /* 練習では倒れずに体力が戻る */
        def.hp = def.maxHp;
        banner('体力を戻しました', 900);
      } else {
        def.hp = 0;
        this.knockOut(def, att);
      }
    }
  },

  knockOut(loser, winner) {
    this.setState(loser, 'ko');
    loser.state = 'ko'; loser.stateT = 0;
    loser.act = null; loser.stun = 999;
    loser.vx = (loser.x < winner.x ? -1 : 1) * 14;
    loser.vy = 11;
    loser.onGround = false;
    winner.act = null;
    winner.state = 'win'; winner.stateT = 0;
    winner.wins++;
    this.phase = 'ko'; this.phaseT = 0;
    this.hitstop = 22;
    this.shake(26);
    Sound.ko();
    banner('K.O.', 1600, 'ko');
    saveGame();
  },

  timeUp() {
    const [a, b] = this.fighters;
    const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
    if (Math.abs(ra - rb) < 0.001) {
      this.phase = 'ko'; this.phaseT = 0;
      a.state = 'idle'; b.state = 'idle';
      banner('DRAW', 1600, 'ko');
      a.wins++; b.wins++;
    } else {
      const w = ra > rb ? a : b, l = ra > rb ? b : a;
      this.knockOut(l, w);
      banner('TIME UP', 1600, 'ko');
    }
  },

  afterRound() {
    const [a, b] = this.fighters;
    const need = G.rounds;
    if (a.wins >= need || b.wins >= need) {
      this.active = false;
      const playerWon = a.wins >= need;
      if (playerWon) { G.wins++; Sound.win(); } else { G.losses++; Sound.lose(); }
      saveGame();
      clearBanner();
      if (this.cfg.onEnd) this.cfg.onEnd(playerWon);
      return;
    }
    this.round++;
    this.resetRound();
  },

  /* ------------------------------ 押し合い ------------------------------ */
  separate(a, b) {
    const minD = (a.k.size + b.k.size) * 0.32;
    const d = b.x - a.x;
    const ad = Math.abs(d);
    if (ad < minD && ad > 0.001) {
      const push = (minD - ad) * 0.5;
      const s = sign(d);
      a.x -= s * push * 0.5;
      b.x += s * push * 0.5;
    }
  },

  /* ------------------------------ カメラ ------------------------------ */
  updateCamera() {
    const [a, b] = this.fighters;
    const mid = (a.x + b.x) / 2;
    const dist = Math.abs(a.x - b.x);
    /* 二体が収まる大きさと、怪獣が小さくなりすぎない大きさの、きつい方を採る */
    const big = Math.max(a.k.size, b.k.size);
    /* 画面が狭いほど余白を詰めて、怪獣が豆粒にならないようにする */
    const need = dist + clamp(View.w * 0.42, 190, 380);
    const z = clamp(Math.min(View.w / need, (View.h * 0.62) / big), 0.36, 1.5);
    const topY = Math.max(a.y + a.k.size, b.y + b.k.size);
    const visible = (View.h * View.gl) / z;
    let camY = 0;
    if (topY > visible * 0.88) camY = topY - visible * 0.88;
    this.cam.z = lerp(this.cam.z, z, 0.07);
    this.cam.y = lerp(this.cam.y, camY, 0.09);
    const halfW = View.w / (2 * this.cam.z);
    let cx = mid;
    if (halfW < WORLD_W / 2) cx = clamp(cx, -WORLD_W / 2 + halfW, WORLD_W / 2 - halfW);
    else cx = 0;
    this.cam.x = lerp(this.cam.x, cx, 0.12);
    View.z = this.cam.z;
    View.cx = this.cam.x;
    View.cy = this.cam.y;
  },

  /* ------------------------------ 描画 ------------------------------ */
  render(ctx) {
    const W = View.w, H = View.h, d = View.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const st = this.stage;

    drawSky(ctx, st);
    drawParallax(ctx, st);
    drawBuildings(ctx, st);
    drawGround(ctx, st);

    /* ここから世界座標 */
    this.withWorld(ctx, () => {
      /* 影 */
      for (const f of this.fighters) {
        const w = f.k.size * 0.42 * clamp(1 - f.y / 500, 0.35, 1);
        ctx.save();
        ctx.globalAlpha = clamp(0.4 - f.y / 1400, 0.08, 0.4);
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(f.x, 0, w, w * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      FX.drawZones(ctx, this);
      /* 攻めている側をあとに描く */
      const order = this.fighters[1].act && !this.fighters[0].act
        ? [this.fighters[0], this.fighters[1]]
        : [this.fighters[1], this.fighters[0]];
      for (const f of order) {
        drawKaiju(ctx, f, st.t);
        FX.drawBeam(ctx, this, f);
      }
      FX.drawShots(ctx, this);
      FX.drawFx(ctx, this);
    });

    drawSmoke(ctx, st);
    drawStageParticles(ctx, st);
    drawForeground(ctx, st);

    /* 墨をかぶった */
    const me = this.fighters[0];
    if (me.blind > 0) FX.drawBlind(ctx, clamp(me.blind / 50, 0, 1) * 0.9, 4242);

    /* 超必殺の閃光 */
    if (this.superFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (this.superFlash / 26) * 0.5 + ')';
      ctx.fillRect(0, 0, W, H);
    }

    /* コンボ */
    this.fighters.forEach((f, i) => {
      if (f.combo < 2 || f.comboT <= 0) return;
      ctx.save();
      ctx.globalAlpha = clamp(f.comboT / 30, 0, 1);
      ctx.font = 'bold 30px "Hiragino Maru Gothic ProN", system-ui, sans-serif';
      ctx.fillStyle = '#ffd76e';
      ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 5;
      const tx = i === 0 ? 40 : W - 190;
      ctx.strokeText(f.combo + ' HIT', tx, H * 0.34);
      ctx.fillText(f.combo + ' HIT', tx, H * 0.34);
      ctx.restore();
    });

    /* 画面外に出た相手の方向 */
    this.drawOffscreenMarks(ctx);
  },

  withWorld(ctx, fn) {
    const d = View.dpr, z = View.z * d;
    ctx.save();
    ctx.setTransform(
      z, 0, 0, z,
      (View.w / 2 - View.cx * View.z + View.shakeX) * d,
      (View.h * View.gl + View.cy * View.z + View.shakeY) * d
    );
    fn();
    ctx.restore();
    ctx.setTransform(d, 0, 0, d, 0, 0);
  },

  drawOffscreenMarks(ctx) {
    for (const f of this.fighters) {
      const sx = View.x(f.x), sy = View.y(f.y + f.k.size * 0.5);
      if (sy > -10) continue;
      ctx.save();
      ctx.fillStyle = rgba(f.k.colors.accent, 0.9);
      ctx.beginPath();
      const x = clamp(sx, 24, View.w - 24);
      ctx.moveTo(x, 10); ctx.lineTo(x - 12, 30); ctx.lineTo(x + 12, 30);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  },
};
